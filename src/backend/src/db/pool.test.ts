import { describe, expect, it, vi } from 'vitest';

import { closePool, createPool } from './pool.js';

const poolInstances: Array<{ config: unknown; ended: boolean }> = [];

vi.mock('pg', () => {
  class Pool {
    config: unknown;
    ended = false;
    constructor(config: unknown) {
      this.config = config;
      poolInstances.push(this);
    }
    async query() {
      return { rows: [], rowCount: 0 };
    }
    async end() {
      this.ended = true;
    }
  }
  return { Pool };
});

describe('createPool', () => {
  it('returns null when given null', () => {
    expect(createPool(null)).toBeNull();
  });

  it('returns null when given undefined', () => {
    expect(createPool(undefined)).toBeNull();
  });

  it('returns null for an empty connection string', () => {
    expect(createPool('')).toBeNull();
  });

  it('returns null when a config object has no databaseUrl', () => {
    expect(createPool({ databaseUrl: null })).toBeNull();
    expect(createPool({ databaseUrl: undefined })).toBeNull();
    expect(createPool({ databaseUrl: '' })).toBeNull();
  });

  it('constructs a Pool with connectionString for a string URL', () => {
    poolInstances.length = 0;
    const pool = createPool('postgres://user:pass@db:5432/cubeclicker');
    expect(pool).not.toBeNull();
    expect(poolInstances).toHaveLength(1);
    expect(poolInstances[0].config).toEqual({
      connectionString: 'postgres://user:pass@db:5432/cubeclicker',
    });
  });

  it('constructs a Pool from a config object databaseUrl', () => {
    poolInstances.length = 0;
    const pool = createPool({ databaseUrl: 'postgres://u:p@host:5432/app' });
    expect(pool).not.toBeNull();
    expect(poolInstances).toHaveLength(1);
    expect(poolInstances[0].config).toEqual({
      connectionString: 'postgres://u:p@host:5432/app',
    });
  });

  it('forwards pool tuning options', () => {
    poolInstances.length = 0;
    createPool('postgres://x', { max: 7, min: 2, idleTimeoutMillis: 1000, connectionTimeoutMillis: 5000, allowExitOnIdle: true });
    expect(poolInstances).toHaveLength(1);
    expect(poolInstances[0].config).toEqual({
      connectionString: 'postgres://x',
      max: 7,
      min: 2,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: true,
    });
  });

  it('returns null and does not construct a Pool when URL is absent', () => {
    poolInstances.length = 0;
    const pool = createPool({ databaseUrl: null });
    expect(pool).toBeNull();
    expect(poolInstances).toHaveLength(0);
  });
});

describe('closePool', () => {
  it('does nothing for null', async () => {
    await expect(closePool(null)).resolves.toBeUndefined();
  });

  it('calls end() on a pool', async () => {
    poolInstances.length = 0;
    const pool = createPool('postgres://x')!;
    expect(pool).not.toBeNull();
    await closePool(pool);
    expect((pool as unknown as { ended: boolean }).ended).toBe(true);
  });
});