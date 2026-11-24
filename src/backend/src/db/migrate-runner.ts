/**
 * Migration execution on a dedicated connection (T3, AC-10).
 *
 * Neon's application URL is a transaction-mode pooler, so a migration that ran
 * through `pg.Pool` could have `BEGIN`, each migration statement and `COMMIT`
 * land on different backend connections. This module opens one dedicated
 * `pg.Client`, passes it to the existing {@link runMigrations} runner, and always
 * closes it, pinning the whole transaction to a single connection.
 *
 * `resolveStartupMigrationUrl` is shared with the startup phase (`startup.ts`),
 * which owns the advisory lock, the migrations and the schema bootstrap on one
 * dedicated client; the CLI uses `resolveMigrationUrl` + `runMigrationsAgainst`.
 */

import { Client } from 'pg';

import {
  runMigrations,
  type MigrationDb,
  type RunMigrationsOptions,
} from './migrate.js';

/** The single-connection database surface the migration runner needs. */
export interface MigrationClient extends MigrationDb {
  connect(): Promise<unknown>;
  end(): Promise<void>;
}

/** Inputs accepted by {@link runMigrationsAgainst}. */
export interface MigrationRunnerDeps extends RunMigrationsOptions {
  /** Test seam: builds the dedicated client for the resolved connection string. */
  createClient?: (connectionString: string) => MigrationClient;
}

/** Exact error raised by the CLI contract when no migration URL is configured. */
export const MISSING_MIGRATION_URL_ERROR =
  'DIRECT_DATABASE_URL or DATABASE_URL must be set';

function readNonEmpty(
  env: Record<string, string | undefined>,
  name: string,
): string | null {
  const raw = env[name];
  if (raw === undefined || raw === '') {
    return null;
  }
  return raw;
}

/**
 * Resolves the migration URL for the CLI: the direct Neon URL wins over the
 * pooled application URL, and a missing pair throws the pinned CLI error.
 */
export function resolveMigrationUrl(
  env: Record<string, string | undefined>,
): string {
  const direct = readNonEmpty(env, 'DIRECT_DATABASE_URL');
  if (direct !== null) {
    return direct;
  }
  const pooled = readNonEmpty(env, 'DATABASE_URL');
  if (pooled !== null) {
    return pooled;
  }
  throw new Error(MISSING_MIGRATION_URL_ERROR);
}

/**
 * Resolves the startup migration URL, or `null` when no database is configured.
 *
 * The direct URL is preferred (`DIRECT_DATABASE_URL` is the session-capable Neon
 * URL used by the advisory-lock/DDL phase); `DATABASE_URL` is the local fallback.
 */
export function resolveStartupMigrationUrl(
  env: Record<string, string | undefined>,
): string | null {
  return (
    readNonEmpty(env, 'DIRECT_DATABASE_URL') ?? readNonEmpty(env, 'DATABASE_URL')
  );
}

function defaultCreateClient(connectionString: string): MigrationClient {
  return new Client({ connectionString });
}

/**
 * Applies pending migrations through one dedicated `pg.Client` connection.
 *
 * The client is passed directly to {@link runMigrations} (never a `pg.Pool`), so
 * `BEGIN`, every migration statement and `COMMIT` execute on the same backend
 * connection. The client is always `end()`ed in `finally`; close failures never
 * mask the migration result.
 */
export async function runMigrationsAgainst(
  connectionString: string,
  deps: MigrationRunnerDeps = {},
): Promise<string[]> {
  const createClient = deps.createClient ?? defaultCreateClient;
  const client = createClient(connectionString);
  try {
    await client.connect();
    const options: RunMigrationsOptions = {};
    if (deps.migrations !== undefined) {
      options.migrations = deps.migrations;
    }
    if (deps.migrationsDir !== undefined) {
      options.migrationsDir = deps.migrationsDir;
    }
    return await runMigrations(client, options);
  } finally {
    try {
      await client.end();
    } catch {
      // Best-effort close: the migration result or failure must propagate.
    }
  }
}
