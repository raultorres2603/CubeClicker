/**
 * Database pool/query instrumentation (T3, AC-16).
 *
 * The wrapper records duration and outcome only: it never captures SQL text,
 * parameters or row data, so no user value can reach a metric name, label or log
 * line. Query behavior is preserved exactly — the original `this`, arguments,
 * resolved value and rejection reason are forwarded unchanged, and a synchronous
 * throw is rethrown as-is.
 *
 * Pool gauges are sampled at scrape time (`collectPoolMetrics`) because the `pg`
 * pool exposes them as live getters, not events.
 */

import type { Metrics } from './metrics.js';

/** The structural pool surface the wrapper needs (`pg.Pool` satisfies it). */
export interface Queryable {
  query: (...args: unknown[]) => unknown;
}

/** Live `pg.Pool` counters sampled at scrape time. */
export interface PoolGauges {
  totalCount?: number;
  idleCount?: number;
  waitingCount?: number;
}

/** Marks an already-wrapped pool so a second instrumentation call is a no-op. */
const INSTRUMENTED = Symbol.for('cubeclicker.instrumentedPool');

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * Wraps one pool's `query` with duration/outcome metrics.
 *
 * The original query is bound to the pool and invoked with `apply`, so `this` and
 * every argument are preserved. The wrapper is installed once per pool (symbol
 * guard); repeated calls return the same object without double counting.
 *
 * `now` is an injectable monotonic clock (milliseconds) defaulting to
 * `performance.now()`, so tests can pin the observed duration exactly.
 */
export function instrumentPool<T extends Queryable>(
  pool: T,
  metrics: Metrics,
  now: () => number = () => performance.now(),
): T {
  const guarded = pool as T & { [INSTRUMENTED]?: boolean };
  if (guarded[INSTRUMENTED] === true) {
    return pool;
  }

  const original = pool.query;
  const instrumented = function instrumentedQuery(
    this: Queryable,
    ...args: unknown[]
  ): unknown {
    const startedAt = now();
    const record = (result: 'ok' | 'error'): void => {
      metrics.inc('cubeclicker_db_queries_total', { result });
      metrics.observe('cubeclicker_db_query_duration_seconds', (now() - startedAt) / 1000);
    };

    let result: unknown;
    try {
      result = original.apply(this, args);
    } catch (error) {
      // A synchronous throw still had a measurable duration and is an error outcome.
      record('error');
      throw error;
    }

    if (isThenable(result)) {
      return result.then(
        (value) => {
          record('ok');
          return value;
        },
        (error: unknown) => {
          record('error');
          throw error;
        },
      );
    }

    // A non-promise result (callback-style or a fake pool) completed synchronously.
    record('ok');
    return result;
  };

  guarded.query = instrumented as T['query'];
  guarded[INSTRUMENTED] = true;
  return pool;
}

/**
 * Samples the pool gauges into the registry at scrape time.
 *
 * A `null` pool (in-memory repositories) reports zeroes for all three gauges so
 * the series is always present and scrapeable.
 */
export function collectPoolMetrics(pool: PoolGauges | null, metrics: Metrics): void {
  metrics.set('cubeclicker_db_pool_total', pool?.totalCount ?? 0);
  metrics.set('cubeclicker_db_pool_idle', pool?.idleCount ?? 0);
  metrics.set('cubeclicker_db_pool_waiting', pool?.waitingCount ?? 0);
}
