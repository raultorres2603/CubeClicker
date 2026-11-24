/**
 * Server wiring tests (T8, AC-10, AC-11, AC-21, AC-22, AC-23).
 *
 * `server.ts` is the composition root and stays under the pre-existing coverage
 * exclusion; this suite asserts its behavior through module mocks: the app is
 * built before the startup phase, a startup failure logs only the contract fields
 * and closes the app before `exit(1)` without ever listening, the no-database
 * path listens with the in-memory repositories and no scheduler, and the cleanup
 * scheduler starts after `listen` and is awaited through the shutdown
 * `beforeClose` hook. A fake `app.log` records the real `createLogSink` adapter's
 * output, so the exact event names, levels and fields are pinned (AC-23).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DbLifecycleConfig } from './db/lifecycle-config.js';
import type { LogFields, LogSink } from './observability/logging.js';

const mocks = vi.hoisted(() => {
  /** Mirrors the real `DatabaseStartupError` contract used by `startServer`. */
  class DatabaseStartupError extends Error {
    readonly stage: string;
    readonly errorType: string;
    readonly code?: string;

    constructor(stage: string, cause: unknown) {
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

  return {
    DatabaseStartupError,
    PgVerificationTokenRepository: vi.fn(),
    buildApp: vi.fn(),
    createPool: vi.fn(),
    createVerificationCleanupScheduler: vi.fn(),
    installShutdownHandlers: vi.fn(),
    runDatabaseStartup: vi.fn(),
  };
});

vi.mock('./app.js', () => ({ buildApp: mocks.buildApp }));
vi.mock('./auth/verification-token-repository.js', () => ({
  PgVerificationTokenRepository: mocks.PgVerificationTokenRepository,
}));
vi.mock('./db/pool.js', () => ({ createPool: mocks.createPool }));
vi.mock('./db/startup.js', () => ({
  DatabaseStartupError: mocks.DatabaseStartupError,
  runDatabaseStartup: mocks.runDatabaseStartup,
}));
vi.mock('./db/verification-cleanup.js', () => ({
  createVerificationCleanupScheduler: mocks.createVerificationCleanupScheduler,
}));
vi.mock('./observability/shutdown.js', () => ({
  installShutdownHandlers: mocks.installShutdownHandlers,
}));

import { startServer } from './server.js';

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  fields: LogFields;
}

interface FakeApp {
  entries: LogEntry[];
  log: {
    debug(fields: object, event: string): void;
    info(fields: object, event: string): void;
    warn(fields: object, event: string): void;
    error(fields: object, event: string): void;
  };
  metrics: { inc: ReturnType<typeof vi.fn> };
  listen: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

interface FakeScheduler {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn<() => Promise<void>>>;
  runOnce: ReturnType<typeof vi.fn<() => Promise<number>>>;
}

interface ShutdownOptions {
  app: FakeApp;
  metrics: FakeApp['metrics'];
  log: LogSink;
  beforeClose: () => void | Promise<void>;
}

interface StartupCall {
  env: NodeJS.ProcessEnv;
  deps: { config: DbLifecycleConfig; log: LogSink };
}

function createFakeApp(events: string[]): FakeApp {
  const entries: LogEntry[] = [];
  const recorder =
    (level: LogEntry['level']) =>
    (fields: object, event: string): void => {
      entries.push({ level, event, fields: fields as LogFields });
    };
  return {
    entries,
    log: {
      debug: recorder('debug'),
      info: recorder('info'),
      warn: recorder('warn'),
      error: recorder('error'),
    },
    metrics: { inc: vi.fn() },
    listen: vi.fn(async () => {
      events.push('listen');
    }),
    close: vi.fn(async () => {
      events.push('close');
    }),
  };
}

/** The `runDatabaseStartup` call arguments with concrete types. */
function startupCall(): StartupCall {
  const [env, deps] = mocks.runDatabaseStartup.mock.calls[0] as [
    NodeJS.ProcessEnv,
    StartupCall['deps'],
  ];
  return { env, deps };
}

function shutdownOptions(): ShutdownOptions {
  return mocks.installShutdownHandlers.mock.calls[0][0] as ShutdownOptions;
}

let events: string[];
let app: FakeApp;

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  events = [];
  app = createFakeApp(events);
  mocks.buildApp.mockImplementation(() => {
    events.push('buildApp');
    return app;
  });
  mocks.createPool.mockReturnValue(null);
  mocks.runDatabaseStartup.mockImplementation(async () => {
    events.push('startup');
    return { skipped: true, applied: [], bootstrap: null };
  });
  mocks.installShutdownHandlers.mockImplementation(() => {
    events.push('shutdown');
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('startServer — no database (AC-10, AC-21)', () => {
  it('builds first, listens with in-memory repositories and creates no scheduler', async () => {
    const env: NodeJS.ProcessEnv = {};

    const result = await startServer(env);

    expect(events).toEqual(['buildApp', 'startup', 'listen', 'shutdown']);
    expect(mocks.buildApp).toHaveBeenCalledTimes(1);
    expect(mocks.buildApp).toHaveBeenCalledWith({ NODE_ENV: 'development' }, {});
    expect(mocks.createPool).toHaveBeenCalledWith(null);

    const call = startupCall();
    expect(call.env).toBe(env);
    expect(call.deps.config).toEqual({
      bootstrapEnabled: true,
      cleanupEnabled: true,
      cleanupIntervalMs: 3_600_000,
    });

    // The startup phase receives the adapter over the app's own Pino logger (D11).
    call.deps.log.info('startup_log_probe', { count: 1 });

    expect(app.listen).toHaveBeenCalledWith({ host: '0.0.0.0', port: 8080 });
    expect(app.entries).toEqual([
      {
        level: 'debug',
        event: 'db_verification_cleanup_skipped',
        fields: { reason: 'no_database' },
      },
      { level: 'info', event: 'startup_log_probe', fields: { count: 1 } },
    ]);
    expect(mocks.PgVerificationTokenRepository).not.toHaveBeenCalled();
    expect(mocks.createVerificationCleanupScheduler).not.toHaveBeenCalled();

    const options = shutdownOptions();
    expect(options.app).toBe(app);
    expect(options.metrics).toBe(app.metrics);
    expect(options.log).toBe(call.deps.log);
    expect(options.beforeClose()).toBeUndefined();

    expect(result.started).toBe(true);
    expect(result.app).toBe(app);
    expect(result.cleanup).toBeNull();
  });
});

describe('startServer — startup failure (AC-11, AC-22, AC-23)', () => {
  it('logs the lock stage, closes the app, exits 1 and never listens', async () => {
    const pool = { query: vi.fn() };
    mocks.createPool.mockReturnValue(pool);
    const cause = Object.assign(
      new Error('advisory lock blocked for alice@example.com'),
      { code: '55P03' },
    );
    mocks.runDatabaseStartup.mockImplementation(async () => {
      events.push('startup');
      throw new mocks.DatabaseStartupError('lock', cause);
    });
    const exit = vi.fn<(code: number) => void>();
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: 'postgres://user:secret@db.example:5432/app',
    };

    const result = await startServer(env, { exit });

    expect(events).toEqual(['buildApp', 'startup', 'close']);
    expect(mocks.buildApp).toHaveBeenCalledWith(
      { ...env, NODE_ENV: 'development' },
      { auth: { pool } },
    );
    expect(app.entries).toEqual([
      {
        level: 'error',
        event: 'db_startup_failed',
        fields: { stage: 'lock', errorType: 'Error', code: '55P03' },
      },
    ]);
    const logged = JSON.stringify(app.entries);
    expect(logged).not.toContain('alice@example.com');
    expect(logged).not.toContain('advisory lock blocked');
    expect(logged).not.toContain('postgres://');
    expect(app.listen).not.toHaveBeenCalled();
    expect(app.close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(mocks.PgVerificationTokenRepository).not.toHaveBeenCalled();
    expect(mocks.createVerificationCleanupScheduler).not.toHaveBeenCalled();
    expect(mocks.installShutdownHandlers).not.toHaveBeenCalled();

    expect(result.started).toBe(false);
    expect(result.app).toBe(app);
    expect(result.cleanup).toBeNull();
  });

  it('logs the bootstrap stage without a code and never listens (AC-22)', async () => {
    const pool = { query: vi.fn() };
    mocks.createPool.mockReturnValue(pool);
    mocks.runDatabaseStartup.mockImplementation(async () => {
      events.push('startup');
      throw new mocks.DatabaseStartupError(
        'bootstrap',
        new Error('CREATE TABLE users failed'),
      );
    });
    const exit = vi.fn<(code: number) => void>();

    const result = await startServer({ DATABASE_URL: 'postgres://db/app' }, { exit });

    expect(app.entries).toEqual([
      {
        level: 'error',
        event: 'db_startup_failed',
        fields: { stage: 'bootstrap', errorType: 'Error' },
      },
    ]);
    expect(JSON.stringify(app.entries)).not.toContain('CREATE TABLE');
    expect(events).toEqual(['buildApp', 'startup', 'close']);
    expect(app.listen).not.toHaveBeenCalled();
    expect(app.close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(result.started).toBe(false);
    expect(result.cleanup).toBeNull();
  });

  it('still exits 1 when app.close rejects during the failure path', async () => {
    const pool = { query: vi.fn() };
    mocks.createPool.mockReturnValue(pool);
    mocks.runDatabaseStartup.mockImplementation(async () => {
      events.push('startup');
      throw new mocks.DatabaseStartupError(
        'migrations',
        Object.assign(new Error('migration failed'), { code: '42P01' }),
      );
    });
    app.close.mockRejectedValue(new Error('close failed'));
    const exit = vi.fn<(code: number) => void>();

    const result = await startServer({ DATABASE_URL: 'postgres://db/app' }, { exit });

    expect(app.entries).toEqual([
      {
        level: 'error',
        event: 'db_startup_failed',
        fields: { stage: 'migrations', errorType: 'Error', code: '42P01' },
      },
    ]);
    expect(app.close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(app.listen).not.toHaveBeenCalled();
    expect(result.started).toBe(false);
    expect(result.cleanup).toBeNull();
  });
});

describe('startServer — cleanup lifecycle (AC-21)', () => {
  it('skips cleanup at info when disabled and keeps listening', async () => {
    const pool = { query: vi.fn() };
    mocks.createPool.mockReturnValue(pool);
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: 'postgres://db/app',
      DB_EXPIRED_TOKEN_CLEANUP_ENABLED: 'false',
      HOST: '127.0.0.1',
      PORT: '9090',
    };

    const result = await startServer(env);

    expect(events).toEqual(['buildApp', 'startup', 'listen', 'shutdown']);
    expect(mocks.buildApp).toHaveBeenCalledWith(
      { ...env, NODE_ENV: 'development' },
      { auth: { pool } },
    );
    expect(app.listen).toHaveBeenCalledWith({ host: '127.0.0.1', port: 9090 });
    expect(app.entries).toEqual([
      {
        level: 'info',
        event: 'db_verification_cleanup_skipped',
        fields: { reason: 'disabled' },
      },
    ]);
    expect(mocks.PgVerificationTokenRepository).not.toHaveBeenCalled();
    expect(mocks.createVerificationCleanupScheduler).not.toHaveBeenCalled();

    const options = shutdownOptions();
    expect(options.log).toBe(startupCall().deps.log);
    expect(options.beforeClose()).toBeUndefined();

    expect(result.started).toBe(true);
    expect(result.app).toBe(app);
    expect(result.cleanup).toBeNull();
  });

  it('starts the scheduler after listen and awaits stop through beforeClose', async () => {
    const pool = { query: vi.fn() };
    mocks.createPool.mockReturnValue(pool);

    let releaseStop: () => void = () => {};
    const scheduler: FakeScheduler = {
      start: vi.fn(() => {
        events.push('cleanupStart');
      }),
      stop: vi.fn(
        (): Promise<void> =>
          new Promise((resolve) => {
            releaseStop = resolve;
          }),
      ),
      runOnce: vi.fn(async () => 0),
    };
    mocks.PgVerificationTokenRepository.mockImplementation(() => {
      events.push('repository');
      return { deleteExpired: vi.fn() };
    });
    mocks.createVerificationCleanupScheduler.mockImplementation(() => {
      events.push('cleanupFactory');
      return scheduler;
    });
    const env: NodeJS.ProcessEnv = { DATABASE_URL: 'postgres://db/app' };

    const result = await startServer(env);

    expect(events).toEqual([
      'buildApp',
      'startup',
      'listen',
      'repository',
      'cleanupFactory',
      'cleanupStart',
      'shutdown',
    ]);
    expect(mocks.createPool).toHaveBeenCalledTimes(1);
    expect(mocks.createPool).toHaveBeenCalledWith('postgres://db/app');
    expect(mocks.PgVerificationTokenRepository).toHaveBeenCalledWith(pool);
    expect(mocks.PgVerificationTokenRepository).toHaveBeenCalledTimes(1);
    expect(mocks.createVerificationCleanupScheduler).toHaveBeenCalledTimes(1);

    const factoryOptions = mocks.createVerificationCleanupScheduler.mock
      .calls[0][0] as {
      repository: unknown;
      intervalMs: number;
      log: LogSink;
    };
    expect(factoryOptions.repository).toBe(
      mocks.PgVerificationTokenRepository.mock.results[0].value,
    );
    expect(factoryOptions.intervalMs).toBe(3_600_000);
    expect(factoryOptions.log).toBe(startupCall().deps.log);

    // The scheduler logs through the same app-bound sink.
    factoryOptions.log.info('cleanup_log_probe', { deleted: 2 });
    expect(app.entries).toEqual([
      { level: 'info', event: 'cleanup_log_probe', fields: { deleted: 2 } },
    ]);
    expect(scheduler.start).toHaveBeenCalledTimes(1);

    const options = shutdownOptions();
    let resolved = false;
    const pending = Promise.resolve(options.beforeClose()).then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(scheduler.stop).toHaveBeenCalledTimes(1);
    expect(resolved).toBe(false);
    releaseStop();
    await pending;
    expect(resolved).toBe(true);

    expect(result.started).toBe(true);
    expect(result.app).toBe(app);
    expect(result.cleanup).toBe(scheduler);
  });
});
