/**
 * Backend composition root (T8, AC-10, AC-11, AC-21, AC-22).
 *
 * The app is built first so the database startup phase (advisory lock →
 * migrations → schema bootstrap) logs through the same Fastify/Pino instance,
 * including its levels, redaction and serializers. Only after that phase
 * succeeds does the process listen. On failure the phase's
 * {@link DatabaseStartupError} fields (stage/errorType/code only) become one
 * `db_startup_failed` line, the app is closed (hub + pool) and the process exits
 * `1` without ever accepting a client.
 *
 * Once listening, the expired-verification cleanup scheduler starts over the app
 * pool; `installShutdownHandlers` receives a `beforeClose` hook that stops it
 * before `app.close()` closes the pool. With no database URL the startup phase is
 * skipped, the app keeps its in-memory repositories and no scheduler is created.
 *
 * `startServer` is exported for the wiring suite; the direct-invocation guard
 * keeps importing this module side-effect free.
 */

import { pathToFileURL } from 'node:url';

import type { FastifyInstance } from 'fastify';

import { buildApp } from './app.js';
import { loadAuthConfig } from './auth/config.js';
import { PgVerificationTokenRepository } from './auth/verification-token-repository.js';
import { loadDbLifecycleConfig } from './db/lifecycle-config.js';
import { createPool } from './db/pool.js';
import { DatabaseStartupError, runDatabaseStartup } from './db/startup.js';
import {
  createVerificationCleanupScheduler,
  type VerificationCleanupScheduler,
} from './db/verification-cleanup.js';
import { createLogSink, type LogFields } from './observability/logging.js';
import { installShutdownHandlers } from './observability/shutdown.js';

/** Default bind address when `HOST` is unset (container-friendly). */
const DEFAULT_HOST = '0.0.0.0';
/** Default port when `PORT` is unset. */
const DEFAULT_PORT = 8080;

/** Test seams for {@link startServer}. */
export interface StartServerDeps {
  /** Process-exit seam; defaults to `process.exit`. */
  exit?: (code: number) => void;
}

/** The wiring outcome, exported so tests can assert both branches. */
export type StartServerResult =
  | {
      started: true;
      app: FastifyInstance;
      cleanup: VerificationCleanupScheduler | null;
    }
  | { started: false; app: FastifyInstance; cleanup: null };

/**
 * Maps a startup-phase rejection to the log contract's `db_startup_failed`
 * fields.
 *
 * `runDatabaseStartup` wraps every failure in a {@link DatabaseStartupError}
 * carrying `stage`, `errorType` and an optional string SQLSTATE `code`; the
 * cause message and stack are never copied (AC-23). A failure that is not tagged
 * (an internal contract violation) is still fail-closed and logged as the
 * earliest stage with only its error type.
 */
function startupFailureFields(error: unknown): LogFields {
  if (error instanceof DatabaseStartupError) {
    const fields: LogFields = {
      stage: error.stage,
      errorType: error.errorType,
    };
    if (error.code !== undefined) {
      fields.code = error.code;
    }
    return fields;
  }
  return {
    stage: 'connect',
    errorType: error instanceof Error ? error.name : 'unknown',
  };
}

/**
 * Builds the app, runs the database startup phase, then listens and starts the
 * expired-verification cleanup scheduler.
 *
 * The pool is created once and handed to `buildApp`, so the app repositories and
 * the cleanup scheduler share it and `app.close()` is the only pool teardown.
 */
export async function startServer(
  env: NodeJS.ProcessEnv,
  deps: StartServerDeps = {},
): Promise<StartServerResult> {
  const exit = deps.exit ?? ((code: number): void => process.exit(code));
  const authConfig = loadAuthConfig(env);
  const pool = createPool(authConfig.databaseUrl);
  const dbConfig = loadDbLifecycleConfig(env);
  const app = buildApp(
    // Host-only default: the container/Dockerfile sets NODE_ENV=development, but a
    // bare `node dist/server.js` should still log; `buildApp({})` stays silent in tests.
    { ...env, NODE_ENV: env.NODE_ENV ?? 'development' },
    pool !== null ? { auth: { pool } } : {},
  );
  const log = createLogSink(app.log);

  try {
    await runDatabaseStartup(env, { config: dbConfig, log });
  } catch (error) {
    log.error('db_startup_failed', startupFailureFields(error));
    // The app owns the pool and hub: closing it releases both. A close failure
    // must not mask the startup failure or prevent the non-zero exit.
    await app.close().catch(() => undefined);
    exit(1);
    return { started: false, app, cleanup: null };
  }

  const host = env.HOST ?? DEFAULT_HOST;
  const port = Number(env.PORT ?? DEFAULT_PORT);
  await app.listen({ host, port });

  let cleanup: VerificationCleanupScheduler | null = null;
  if (pool === null) {
    log.debug('db_verification_cleanup_skipped', { reason: 'no_database' });
  } else if (!dbConfig.cleanupEnabled) {
    log.info('db_verification_cleanup_skipped', { reason: 'disabled' });
  } else {
    cleanup = createVerificationCleanupScheduler({
      repository: new PgVerificationTokenRepository(pool),
      intervalMs: dbConfig.cleanupIntervalMs,
      log,
    });
    cleanup.start();
  }

  // Installed after `listen` so a signal during startup cannot close a half-built
  // app; `beforeClose` stops the scheduler before the pool is closed (AC-20).
  installShutdownHandlers({
    app,
    metrics: app.metrics,
    log,
    beforeClose: () => cleanup?.stop(),
  });

  console.log(
    `CubeClicker backend listening on http://${host}:${port} (WebSocket ws://${host}:${port}/ws)`,
  );

  return { started: true, app, cleanup };
}

const entryPoint = process.argv[1];
if (
  entryPoint !== undefined &&
  import.meta.url === pathToFileURL(entryPoint).href
) {
  await startServer(process.env);
}
