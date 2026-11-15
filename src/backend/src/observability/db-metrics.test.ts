import { describe, expect, it } from 'vitest';

import { createMetrics } from './metrics.js';
import { collectPoolMetrics, instrumentPool } from './db-metrics.js';

/** A deterministic monotonic clock: each call returns the next queued value. */
function clockOf(...values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index];
    if (value === undefined) {
      throw new Error('test clock exhausted');
    }
    index += 1;
    return value;
  };
}

/** The exact bucket/sum/count samples of the query-duration histogram. */
function durationSamples(metrics: ReturnType<typeof createMetrics>): string[] {
  return metrics
    .render()
    .split('\n')
    .filter(
      (line) =>
        line.startsWith('cubeclicker_db_query_duration_seconds_bucket') ||
        line.startsWith('cubeclicker_db_query_duration_seconds_sum ') ||
        line.startsWith('cubeclicker_db_query_duration_seconds_count '),
    );
}

const BUCKETS = ['0.001', '0.005', '0.01', '0.025', '0.05', '0.1', '0.25', '0.5', '1', '2.5', '5'];

function expectedDurationSamples(
  cumulativeUpTo: string,
  sum: string,
  count: number,
): string[] {
  const samples: string[] = [];
  let reached = false;
  for (const bucket of BUCKETS) {
    if (bucket === cumulativeUpTo) {
      reached = true;
    }
    samples.push(
      `cubeclicker_db_query_duration_seconds_bucket{le="${bucket}"} ${reached ? count : 0}`,
    );
  }
  samples.push(`cubeclicker_db_query_duration_seconds_bucket{le="+Inf"} ${count}`);
  samples.push(`cubeclicker_db_query_duration_seconds_sum ${sum}`);
  samples.push(`cubeclicker_db_query_duration_seconds_count ${count}`);
  return samples;
}

describe('instrumentPool', () => {
  it('observes 0.012s and counts an ok query while preserving args, this and the result', async () => {
    const metrics = createMetrics();
    const pool = {
      tag: 'pool-a',
      seen: [] as unknown[][],
      query(...args: unknown[]) {
        this.seen.push(args);
        return Promise.resolve({ rows: [{ id: 'row-1' }], tag: this.tag });
      },
    };
    instrumentPool(pool, metrics, clockOf(100, 112));

    const result = await pool.query('select $1', ['value-1']);

    expect(result).toEqual({ rows: [{ id: 'row-1' }], tag: 'pool-a' });
    expect(pool.seen).toEqual([['select $1', ['value-1']]]);
    expect(metrics.render()).toContain('cubeclicker_db_queries_total{result="ok"} 1');
    expect(durationSamples(metrics)).toEqual(expectedDurationSamples('0.025', '0.012', 1));
  });

  it('counts an error and rethrows the original rejection reason', async () => {
    const metrics = createMetrics();
    const error = new Error('connection reset');
    const seen: unknown[][] = [];
    const pool = {
      query: (...args: unknown[]) => {
        seen.push(args);
        return Promise.reject(error);
      },
    };
    instrumentPool(pool, metrics, clockOf(0, 5));

    await expect(pool.query('select 1')).rejects.toBe(error);

    expect(seen).toEqual([['select 1']]);
    expect(metrics.render()).toContain('cubeclicker_db_queries_total{result="error"} 1');
    expect(durationSamples(metrics)).toEqual(expectedDurationSamples('0.005', '0.005', 1));
  });

  it('counts a synchronous throw, rethrows it and leaves the ok series empty', () => {
    const metrics = createMetrics();
    const error = new Error('syntax error');
    const seen: unknown[][] = [];
    const pool = {
      query: (...args: unknown[]): unknown => {
        seen.push(args);
        throw error;
      },
    };
    instrumentPool(pool, metrics, clockOf(10, 12));

    let caught: unknown = null;
    try {
      pool.query('select nope');
    } catch (thrown) {
      caught = thrown;
    }

    expect(caught).toBe(error);
    expect(seen).toEqual([['select nope']]);
    expect(metrics.render()).toContain('cubeclicker_db_queries_total{result="error"} 1');
    expect(metrics.render()).not.toContain('cubeclicker_db_queries_total{result="ok"}');
    expect(durationSamples(metrics)).toEqual(expectedDurationSamples('0.005', '0.002', 1));
  });

  it('instruments a pool exactly once (symbol guard)', async () => {
    const metrics = createMetrics();
    const pool = { query: () => Promise.resolve('row') };

    expect(instrumentPool(pool, metrics, clockOf(0, 1))).toBe(pool);
    expect(instrumentPool(pool, metrics, clockOf(0, 1))).toBe(pool);

    await expect(pool.query()).resolves.toBe('row');

    expect(metrics.render()).toContain('cubeclicker_db_queries_total{result="ok"} 1');
    expect(durationSamples(metrics)).toEqual(expectedDurationSamples('0.001', '0.001', 1));
  });

  it('counts a synchronous non-promise result as ok and returns it unchanged', () => {
    const metrics = createMetrics();
    const pool = { query: (...args: unknown[]) => args.length };

    instrumentPool(pool, metrics, clockOf(0, 1));

    expect(pool.query('a', 'b')).toBe(2);
    expect(metrics.render()).toContain('cubeclicker_db_queries_total{result="ok"} 1');
    expect(durationSamples(metrics)).toEqual(expectedDurationSamples('0.001', '0.001', 1));
  });
});

describe('collectPoolMetrics', () => {
  it('sets the three gauges from the live pool counters', () => {
    const metrics = createMetrics();

    collectPoolMetrics({ totalCount: 5, idleCount: 3, waitingCount: 2 }, metrics);

    expect(metrics.render()).toContain('cubeclicker_db_pool_total 5');
    expect(metrics.render()).toContain('cubeclicker_db_pool_idle 3');
    expect(metrics.render()).toContain('cubeclicker_db_pool_waiting 2');
  });

  it('reports zeroes when no database pool exists', () => {
    const metrics = createMetrics();
    metrics.set('cubeclicker_db_pool_total', 9);

    collectPoolMetrics(null, metrics);

    expect(metrics.render()).toContain('cubeclicker_db_pool_total 0');
    expect(metrics.render()).toContain('cubeclicker_db_pool_idle 0');
    expect(metrics.render()).toContain('cubeclicker_db_pool_waiting 0');
    expect(metrics.render()).not.toContain('cubeclicker_db_pool_total 9');
  });

  it('reports zeroes for a pool whose getters are absent', () => {
    const metrics = createMetrics();

    collectPoolMetrics({}, metrics);

    expect(metrics.render()).toContain('cubeclicker_db_pool_total 0');
    expect(metrics.render()).toContain('cubeclicker_db_pool_idle 0');
    expect(metrics.render()).toContain('cubeclicker_db_pool_waiting 0');
  });
});
