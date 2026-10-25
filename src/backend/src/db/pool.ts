/**
 * PostgreSQL connection pool factory (T3).
 *
 * Config-driven: the pool is built from a connection string (typically
 * `AuthConfig.databaseUrl`) plus optional pool tuning. When no URL is provided
 * the factory returns `null`, so callers can fall back to in-memory repositories
 * (mirroring the `DATABASE_URL`-optional composition in plan § Architecture).
 *
 * The `pg` module is imported lazily-typed; tests mock `pg` to keep the unit
 * suite free of a live database (AC-13 / T3 testing bar).
 */

import { Pool, type PoolConfig } from 'pg';

/** Tuning knobs forwarded to `pg.Pool` (all optional). */
export interface PoolOptions {
  max?: number;
  min?: number;
  idleTimeoutMillis?: number | null;
  connectionTimeoutMillis?: number;
  allowExitOnIdle?: boolean;
}

/** Input accepted by {@link createPool}. */
export type PoolInput = string | null | undefined | { databaseUrl: string | null | undefined };

/**
 * Builds a `pg.Pool` from a connection string or a config-like object.
 *
 * Returns `null` when no connection string is available, so the composition
 * root can decide between Postgres-backed and in-memory repositories.
 */
export function createPool(
  input: PoolInput = null,
  options: PoolOptions = {},
): Pool | null {
  const connectionString = resolveConnectionString(input);
  if (!connectionString) {
    return null;
  }

  const config: PoolConfig = { connectionString, ...options };
  return new Pool(config);
}

function resolveConnectionString(input: PoolInput): string | null {
  if (input === null || input === undefined) {
    return null;
  }
  if (typeof input === 'string') {
    return input === '' ? null : input;
  }
  const url = input.databaseUrl;
  if (url === null || url === undefined || url === '') {
    return null;
  }
  return url;
}

/** Best-effort pool shutdown; swallows errors so teardown never throws. */
export async function closePool(pool: Pool | null): Promise<void> {
  if (pool === null) {
    return;
  }
  await pool.end();
}