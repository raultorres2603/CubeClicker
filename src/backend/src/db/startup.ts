/**
 * Database startup phase (T6, AC-9 … AC-13).
 *
 * After the app is built (so the phase can log through the real Pino sink) and
 * before the backend listens, this module opens exactly one dedicated
 * `pg.Client` on the direct database URL and:
 *
 * 1. acquires a session-level Postgres advisory lock, retrying every 250 ms for
 *    at most 30 s, so two instances starting together serialize the DDL phase;
 * 2. applies pending numbered migrations through the existing runner;
 * 3. runs the schema bootstrap (unless `DB_SCHEMA_BOOTSTRAP_ENABLED` disables
 *    it), which checks/creates the five required tables.
 *
 * The lock is released and the client ended in a `finally`, so the lock is also
 * freed when the connection drops. Every failure is rethrown as a
 * {@link DatabaseStartupError} carrying the failing `stage`, the underlying
 * error type and an optional string SQLSTATE `code`; the caller logs
 * `db_startup_failed` from those fields (never from a message or stack) and
 * refuses to serve traffic.
 *
 * With neither `DIRECT_DATABASE_URL` nor `DATABASE_URL` configured the phase is
 * skipped without creating a client, preserving the in-memory repositories used
 * by host-only runs. Time and sleeping are injected so the lock wait and the
 * summary durations are deterministic in tests.
 */

import { Client } from 'pg';

import type { LogSink } from '../observability/logging.js';
import {
  loadDbLifecycleConfig,
  type DbLifecycleConfig,
} from './lifecycle-config.js';
import {
  runMigrations,
  type MigrationFile,
  type RunMigrationsOptions,
} from './migrate.js';
import {
  resolveStartupMigrationUrl,
  type MigrationClient,
} from './migrate-runner.js';
import {
  runSchemaBootstrap,
  type SchemaBootstrapResult,
} from './schema-bootstrap.js';

/** Session advisory lock key shared by every backend instance of this app. */
export const STARTUP_ADVISORY_LOCK_KEY = 7_284_571_001;
/** Upper bound on waiting for the startup advisory lock. */
export const STARTUP_LOCK_TIMEOUT_MS = 30_000;
/** Delay between advisory-lock attempts. */
export const STARTUP_LOCK_RETRY_MS = 250;

/** Session-level lock attempt; `locked` is a boolean in the result row. */
const LOCK_SQL = 'SELECT pg_try_advisory_lock($1::bigint) AS locked';
/** Session-level unlock; also happens implicitly when the client disconnects. */
const UNLOCK_SQL = 'SELECT pg_advisory_unlock($1::bigint)';

/** The phase a startup failure belongs to (log contract `db_startup_failed.stage`). */
export type DatabaseStartupStage =
  | 'connect'
  | 'lock'
  | 'migrations'
  | 'bootstrap';

/**
 * A database startup failure tagged with the stage that failed.
 *
 * Only the cause's `name` (or `'unknown'`) and an optional string `code` are
 * exposed: PostgreSQL messages, details and hints can contain SQL text or row
 * data, so they must never reach a log field. The message itself names only the
 * stage and carries no cause text.
 */
export class DatabaseStartupError extends Error {
  readonly stage: DatabaseStartupStage;
  /** `cause.name` (or `'unknown'`), so the caller can log the actionable type. */
  readonly errorType: string;
  /** `cause.code` only when it is a string (for example a PostgreSQL SQLSTATE). */
  readonly code?: string;

  constructor(stage: DatabaseStartupStage, cause: unknown) {
    super(`database startup failed during the ${stage} stage`);
    this.name = 'DatabaseStartupError';
    this.stage = stage;
    if (cause instanceof Error) {
      this.errorType = cause.name;
      const code = (cause as { code?: unknown }).code;
      if (typeof code === 'string') {
        this.code = code;
      }
    } else {
      this.errorType = 'unknown';
    }
  }
}

/** Dependencies and test seams for {@link runDatabaseStartup}. */
export interface DatabaseStartupDeps {
  /** Validated lifecycle config (the server loads it once); defaults to parsing `env`. */
  config?: DbLifecycleConfig;
  /** Event-first structured sink; when omitted the phase is silent. */
  log?: LogSink;
  /** Test seam: builds the dedicated direct-URL client. */
  createClient?: (connectionString: string) => MigrationClient;
  /** Explicit migration list (overrides filesystem loading). */
  migrations?: MigrationFile[];
  /** Directory to load migrations from when `migrations` is omitted. */
  migrationsDir?: string;
  /** Upper bound on waiting for the advisory lock; defaults to 30 s. */
  lockTimeoutMs?: number;
  /** Sleep seam; defaults to a real `setTimeout` promise. */
  sleep?: (ms: number) => Promise<void>;
  /** Clock seam; defaults to `Date.now`. */
  now?: () => number;
}

/** Outcome when no database URL is configured. */
export interface DatabaseStartupSkipped {
  skipped: true;
  applied: readonly [];
  bootstrap: null;
}

/** Outcome when the startup phase ran. */
export interface DatabaseStartupCompleted {
  skipped: false;
  /** Migration names applied by this run, in order. */
  applied: readonly string[];
  /** Bootstrap summary, or `null` when the bootstrap was disabled. */
  bootstrap: SchemaBootstrapResult | null;
}

export type DatabaseStartupResult =
  | DatabaseStartupSkipped
  | DatabaseStartupCompleted;

function defaultCreateClient(connectionString: string): MigrationClient {
  return new Client({ connectionString });
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Reads the boolean `locked` column of a `pg_try_advisory_lock` result. */
function isLocked(result: {
  rows: Array<Record<string, unknown>>;
}): boolean {
  return result.rows[0]?.locked === true;
}

/** Copies only the migration options the caller supplied. */
function migrationOptions(deps: DatabaseStartupDeps): RunMigrationsOptions {
  const options: RunMigrationsOptions = {};
  if (deps.migrations !== undefined) {
    options.migrations = deps.migrations;
  }
  if (deps.migrationsDir !== undefined) {
    options.migrationsDir = deps.migrationsDir;
  }
  return options;
}

/**
 * Runs the database startup phase: advisory lock → migrations → bootstrap.
 *
 * One dedicated `pg.Client` (never a `pg.Pool`) carries the session lock, the
 * migration transactions and the bootstrap catalog/DDL statements, so the whole
 * phase stays on one connection and the lock cannot be lost between steps. The
 * client is always `end()`ed; close failures never mask the result or the
 * original failure.
 */
export async function runDatabaseStartup(
  env: Record<string, string | undefined>,
  deps: DatabaseStartupDeps = {},
): Promise<DatabaseStartupResult> {
  const log = deps.log;
  const connectionString = resolveStartupMigrationUrl(env);

  if (connectionString === null) {
    log?.debug('db_schema_bootstrap_skipped', { reason: 'no_database' });
    return { skipped: true, applied: [], bootstrap: null };
  }

  const config = deps.config ?? loadDbLifecycleConfig(env);
  const createClient = deps.createClient ?? defaultCreateClient;
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? ((): number => Date.now());
  const lockTimeoutMs = deps.lockTimeoutMs ?? STARTUP_LOCK_TIMEOUT_MS;
  const startedAt = now();

  let client: MigrationClient;
  try {
    client = createClient(connectionString);
  } catch (error) {
    throw new DatabaseStartupError('connect', error);
  }

  let stage: DatabaseStartupStage = 'connect';
  let lockAcquired = false;

  try {
    await client.connect();

    stage = 'lock';
    const lockStartedAt = now();
    let waitedMs = 0;
    for (;;) {
      const attempt = await client.query(LOCK_SQL, [
        STARTUP_ADVISORY_LOCK_KEY,
      ]);
      if (isLocked(attempt)) {
        lockAcquired = true;
        log?.debug('db_startup_lock_acquired', { waitedMs });
        break;
      }
      if (waitedMs >= lockTimeoutMs) {
        throw new Error(
          `advisory lock not acquired within ${lockTimeoutMs} ms`,
        );
      }
      log?.debug('db_startup_lock_wait', { waitedMs });
      await sleep(STARTUP_LOCK_RETRY_MS);
      waitedMs = now() - lockStartedAt;
    }

    stage = 'migrations';
    const applied = await runMigrations(client, migrationOptions(deps));
    if (applied.length > 0) {
      log?.info('db_migrations_applied', { count: applied.length });
    } else {
      log?.debug('db_migrations_up_to_date', {});
    }

    stage = 'bootstrap';
    let bootstrap: SchemaBootstrapResult | null = null;
    if (config.bootstrapEnabled) {
      bootstrap = await runSchemaBootstrap(client, { log });
    } else {
      log?.info('db_schema_bootstrap_skipped', { reason: 'disabled' });
    }

    log?.info('db_startup_completed', {
      migrated: applied.length,
      created: bootstrap?.created.length ?? 0,
      outdated: bootstrap?.outdated.length ?? 0,
      durationMs: now() - startedAt,
    });

    return { skipped: false, applied, bootstrap };
  } catch (error) {
    throw new DatabaseStartupError(stage, error);
  } finally {
    if (lockAcquired) {
      try {
        await client.query(UNLOCK_SQL, [STARTUP_ADVISORY_LOCK_KEY]);
      } catch {
        // Best-effort unlock: ending the session releases the lock anyway.
      }
    }
    try {
      await client.end();
    } catch {
      // Best-effort close: the startup result or failure must propagate.
    }
  }
}
