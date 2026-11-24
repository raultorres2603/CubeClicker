/**
 * Database startup phase unit tests (T6, AC-9 … AC-13, AC-23).
 *
 * A fake direct-URL client records every statement so the tests can pin the
 * exact order (connect → advisory lock → migrations → bootstrap → unlock →
 * end), the URL precedence, the bounded lock wait, the skip/disable paths and
 * the `DatabaseStartupError.stage`/`errorType`/`code` contract. A recording
 * `LogSink` pins every startup-owned event name, level and field, including the
 * full AC-13 sequence and the absence of the connection string, SQL text or the
 * underlying error message. The `pg` module is mocked so one test can prove the
 * default factory builds exactly one `pg.Client` and never a `pg.Pool`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pgMocks = vi.hoisted(() => ({
  clients: [] as Array<{
    config: { connectionString?: string };
    ended: boolean;
  }>,
  poolConstructions: [] as unknown[],
}));

vi.mock('pg', () => {
  class Client {
    config: { connectionString?: string };
    ended = false;

    constructor(config: { connectionString?: string }) {
      this.config = config;
      pgMocks.clients.push(this);
    }

    async connect(): Promise<void> {
      // The default-factory test only needs a connected client.
    }

    async query(
      text: string,
    ): Promise<{ rows: Array<Record<string, unknown>>; rowCount: number }> {
      if (text.includes('pg_try_advisory_lock')) {
        return { rows: [{ locked: true }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    async end(): Promise<void> {
      this.ended = true;
    }
  }

  class Pool {
    constructor(config: unknown) {
      pgMocks.poolConstructions.push(config);
      throw new Error('pg.Pool must not be used by the startup phase');
    }
  }

  return { Client, Pool };
});

import type { LogFields, LogSink } from '../observability/logging.js';
import type { MigrationFile } from './migrate.js';
import type { MigrationClient } from './migrate-runner.js';
import { REQUIRED_TABLES } from './schema-contract.js';
import {
  DatabaseStartupError,
  runDatabaseStartup,
  STARTUP_ADVISORY_LOCK_KEY,
  STARTUP_LOCK_RETRY_MS,
  STARTUP_LOCK_TIMEOUT_MS,
} from './startup.js';

const DATABASE_URL = 'postgres://pooled.example:5432/app';
const DIRECT_DATABASE_URL = 'postgres://direct.example:5432/app';
const TABLE_NAMES = REQUIRED_TABLES.map((table) => table.name);
const COMPLETE_COLUMNS: Readonly<Record<string, readonly string[]>> =
  Object.fromEntries(
    REQUIRED_TABLES.map((table) => [table.name, [...table.columns]]),
  );

const MIGRATION_SQL = 'CREATE TABLE migration_marker (id INT)';
const ONE_MIGRATION: MigrationFile[] = [
  { name: '001_init.sql', sql: MIGRATION_SQL },
];

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  fields: LogFields;
}

function createLogRecorder(): { log: LogSink; entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  return {
    entries,
    log: {
      debug: (event, fields) => entries.push({ level: 'debug', event, fields }),
      info: (event, fields) => entries.push({ level: 'info', event, fields }),
      warn: (event, fields) => entries.push({ level: 'warn', event, fields }),
      error: (event, fields) => entries.push({ level: 'error', event, fields }),
    },
  };
}

interface RecordedQuery {
  text: string;
  values: unknown[] | undefined;
}

interface FakeClientOptions {
  /** Migration names already recorded in `schema_migrations`. */
  applied?: readonly string[];
  /** Lock results consumed in order; when exhausted `lockDefault` is used. */
  lockResults?: readonly boolean[];
  /** Result once `lockResults` is exhausted; defaults to `true`. */
  lockDefault?: boolean;
  failConnect?: unknown;
  failLock?: unknown;
  failUnlock?: unknown;
  failEnd?: unknown;
  failCatalog?: unknown;
  /** Rejection thrown when the injected migration SQL executes. */
  migrationFailure?: unknown;
  /** Table names reported by `information_schema.tables`. */
  existingTables?: readonly string[];
  /** Columns reported by `information_schema.columns`. */
  columns?: Readonly<Record<string, readonly string[]>>;
}

interface FakeClient {
  client: MigrationClient;
  steps: string[];
  queries: RecordedQuery[];
  lockAttempts: number;
  endCalls: number;
}

/** Classifies a statement into a stable step label for exact order assertions. */
function statementStep(text: string): string {
  if (text.includes('pg_try_advisory_lock')) {
    return 'lock';
  }
  if (text.includes('pg_advisory_unlock')) {
    return 'unlock';
  }
  if (text.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations')) {
    return 'ledger:create';
  }
  if (text === 'SELECT name FROM schema_migrations') {
    return 'ledger:select';
  }
  if (text === 'BEGIN') {
    return 'begin';
  }
  if (text === 'COMMIT') {
    return 'commit';
  }
  if (text === 'ROLLBACK') {
    return 'rollback';
  }
  if (text.startsWith('INSERT INTO schema_migrations')) {
    return 'ledger:insert';
  }
  if (text.includes('information_schema.tables')) {
    return 'catalog:tables';
  }
  if (text.includes('information_schema.columns')) {
    return 'catalog:columns';
  }
  if (text.startsWith('CREATE TABLE IF NOT EXISTS')) {
    return 'ddl:create-table';
  }
  if (text.startsWith('CREATE UNIQUE INDEX IF NOT EXISTS')) {
    return 'ddl:create-index';
  }
  return `sql:${text}`;
}

function createFakeClient(options: FakeClientOptions = {}): FakeClient {
  const steps: string[] = [];
  const queries: RecordedQuery[] = [];
  const applied = new Set(options.applied ?? []);
  const lockResults = [...(options.lockResults ?? [])];
  const lockDefault = options.lockDefault ?? true;
  const existingTables = options.existingTables ?? TABLE_NAMES;
  const columns = options.columns ?? COMPLETE_COLUMNS;
  let lockAttempts = 0;
  let endCalls = 0;

  const client: MigrationClient = {
    async connect() {
      steps.push('connect');
      if (options.failConnect !== undefined) {
        throw options.failConnect;
      }
    },
    async query(text, values) {
      const normalized = text.trim();
      queries.push({ text: normalized, values });
      steps.push(statementStep(normalized));

      if (normalized.includes('pg_try_advisory_lock')) {
        lockAttempts += 1;
        if (options.failLock !== undefined) {
          throw options.failLock;
        }
        const locked =
          lockResults.length > 0
            ? (lockResults.shift() ?? lockDefault)
            : lockDefault;
        return { rows: [{ locked }], rowCount: 1 };
      }
      if (normalized.includes('pg_advisory_unlock')) {
        if (options.failUnlock !== undefined) {
          throw options.failUnlock;
        }
        return { rows: [{ pg_advisory_unlock: true }], rowCount: 1 };
      }
      if (
        normalized.startsWith('CREATE TABLE IF NOT EXISTS schema_migrations')
      ) {
        return { rows: [], rowCount: 0 };
      }
      if (normalized === 'SELECT name FROM schema_migrations') {
        return {
          rows: [...applied].map((name) => ({ name })),
          rowCount: applied.size,
        };
      }
      if (
        normalized === 'BEGIN' ||
        normalized === 'COMMIT' ||
        normalized === 'ROLLBACK'
      ) {
        return { rows: [], rowCount: 0 };
      }
      if (normalized.startsWith('INSERT INTO schema_migrations')) {
        applied.add(String(values?.[0]));
        return { rows: [], rowCount: 1 };
      }
      if (normalized.includes('information_schema')) {
        if (options.failCatalog !== undefined) {
          throw options.failCatalog;
        }
        if (normalized.includes('information_schema.tables')) {
          return {
            rows: existingTables.map((table_name) => ({ table_name })),
            rowCount: existingTables.length,
          };
        }
        return {
          rows: Object.entries(columns).flatMap(([table_name, names]) =>
            names.map((column_name) => ({ table_name, column_name })),
          ),
        };
      }
      if (
        options.migrationFailure !== undefined &&
        normalized === MIGRATION_SQL
      ) {
        throw options.migrationFailure;
      }
      return { rows: [], rowCount: 0 };
    },
    async end() {
      steps.push('end');
      endCalls += 1;
      if (options.failEnd !== undefined) {
        throw options.failEnd;
      }
    },
  };

  return {
    client,
    steps,
    queries,
    get lockAttempts() {
      return lockAttempts;
    },
    get endCalls() {
      return endCalls;
    },
  };
}

interface TestClock {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  sleeps: number[];
}

function createClock(): TestClock {
  let elapsed = 0;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => elapsed,
    sleep: async (ms) => {
      sleeps.push(ms);
      elapsed += ms;
    },
  };
}

async function captureStartupError(
  promise: Promise<unknown>,
): Promise<DatabaseStartupError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof DatabaseStartupError) {
      return error;
    }
    throw error;
  }
  throw new Error('expected runDatabaseStartup to reject');
}

/** Flushes the startup promise chain without advancing fake time. */
async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

/** The `db_schema_table_present` entries of a complete-schema bootstrap run. */
const PRESENT_ENTRIES: LogEntry[] = TABLE_NAMES.map((table) => ({
  level: 'debug',
  event: 'db_schema_table_present',
  fields: { table },
}));

beforeEach(() => {
  pgMocks.clients.length = 0;
  pgMocks.poolConstructions.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('runDatabaseStartup — no database (AC-10)', () => {
  it('skips without a client and traces reason no_database at debug', async () => {
    const createClient = vi.fn((): MigrationClient => {
      throw new Error('a client must not be created without a database');
    });
    const { log, entries } = createLogRecorder();

    const result = await runDatabaseStartup({}, { createClient, log });

    expect(result).toEqual({ skipped: true, applied: [], bootstrap: null });
    expect(entries).toEqual([
      {
        level: 'debug',
        event: 'db_schema_bootstrap_skipped',
        fields: { reason: 'no_database' },
      },
    ]);
    expect(createClient).toHaveBeenCalledTimes(0);
  });

  it('treats empty URL values as no database', async () => {
    const createClient = vi.fn((): MigrationClient => {
      throw new Error('a client must not be created without a database');
    });
    const { log, entries } = createLogRecorder();

    const result = await runDatabaseStartup(
      { DIRECT_DATABASE_URL: '', DATABASE_URL: '' },
      { createClient, log },
    );

    expect(result).toEqual({ skipped: true, applied: [], bootstrap: null });
    expect(entries).toEqual([
      {
        level: 'debug',
        event: 'db_schema_bootstrap_skipped',
        fields: { reason: 'no_database' },
      },
    ]);
    expect(createClient).toHaveBeenCalledTimes(0);
  });
});

describe('runDatabaseStartup — one client and exact statement order (AC-9)', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
  });

  it('prefers DIRECT_DATABASE_URL and locks before migrating then bootstrapping', async () => {
    const fake = createFakeClient();
    const createClient = vi.fn(() => fake.client);
    const { log } = createLogRecorder();
    const clock = createClock();

    const result = await runDatabaseStartup(
      { DIRECT_DATABASE_URL, DATABASE_URL },
      {
        createClient,
        migrations: ONE_MIGRATION,
        log,
        now: clock.now,
        sleep: clock.sleep,
      },
    );

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(DIRECT_DATABASE_URL);
    expect(fake.steps).toEqual([
      'connect',
      'lock',
      'ledger:create',
      'ledger:select',
      'begin',
      `sql:${MIGRATION_SQL}`,
      'ledger:insert',
      'commit',
      'catalog:tables',
      'catalog:columns',
      'unlock',
      'end',
    ]);
    expect(fake.endCalls).toBe(1);
    expect(result).toEqual({
      skipped: false,
      applied: ['001_init.sql'],
      bootstrap: { checked: 5, created: [], outdated: [], durationMs: 0 },
    });

    const lockQueries = fake.queries.filter((query) =>
      query.text.includes('pg_try_advisory_lock'),
    );
    const unlockQueries = fake.queries.filter((query) =>
      query.text.includes('pg_advisory_unlock'),
    );
    expect(lockQueries).toHaveLength(1);
    expect(lockQueries[0].values).toEqual([STARTUP_ADVISORY_LOCK_KEY]);
    expect(unlockQueries).toHaveLength(1);
    expect(unlockQueries[0].values).toEqual([STARTUP_ADVISORY_LOCK_KEY]);
  });

  it('falls back to DATABASE_URL when DIRECT_DATABASE_URL is empty', async () => {
    const fake = createFakeClient();
    const createClient = vi.fn(() => fake.client);

    const result = await runDatabaseStartup(
      { DIRECT_DATABASE_URL: '', DATABASE_URL },
      {
        createClient,
        migrations: ONE_MIGRATION,
        now: () => 0,
        sleep: async () => {},
      },
    );

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(DATABASE_URL);
    expect(result.skipped).toBe(false);
  });
});

describe('runDatabaseStartup — startup traces (AC-13, AC-23)', () => {
  it('traces the lock retry, migration count, bootstrap summary and completion in order', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    const fake = createFakeClient({ lockResults: [false, true] });
    const { log, entries } = createLogRecorder();
    const clock = createClock();

    await runDatabaseStartup(
      { DATABASE_URL },
      {
        config: {
          bootstrapEnabled: true,
          cleanupEnabled: true,
          cleanupIntervalMs: 3_600_000,
        },
        createClient: () => fake.client,
        migrations: ONE_MIGRATION,
        log,
        now: clock.now,
        sleep: clock.sleep,
      },
    );

    expect(entries).toEqual([
      {
        level: 'debug',
        event: 'db_startup_lock_wait',
        fields: { waitedMs: 0 },
      },
      {
        level: 'debug',
        event: 'db_startup_lock_acquired',
        fields: { waitedMs: STARTUP_LOCK_RETRY_MS },
      },
      { level: 'info', event: 'db_migrations_applied', fields: { count: 1 } },
      {
        level: 'info',
        event: 'db_schema_bootstrap_started',
        fields: { tables: 5 },
      },
      ...PRESENT_ENTRIES,
      {
        level: 'info',
        event: 'db_schema_bootstrap_completed',
        fields: { checked: 5, created: 0, outdated: 0, durationMs: 0 },
      },
      {
        level: 'info',
        event: 'db_startup_completed',
        fields: {
          migrated: 1,
          created: 0,
          outdated: 0,
          durationMs: STARTUP_LOCK_RETRY_MS,
        },
      },
    ]);
  });

  it('traces db_migrations_up_to_date at debug when nothing is pending', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    const fake = createFakeClient({ applied: ['001_init.sql'] });
    const { log, entries } = createLogRecorder();

    const result = await runDatabaseStartup(
      { DATABASE_URL },
      {
        createClient: () => fake.client,
        migrations: ONE_MIGRATION,
        log,
        now: () => 0,
        sleep: async () => {},
      },
    );

    expect(result).toEqual({
      skipped: false,
      applied: [],
      bootstrap: { checked: 5, created: [], outdated: [], durationMs: 0 },
    });
    expect(entries).toEqual([
      {
        level: 'debug',
        event: 'db_startup_lock_acquired',
        fields: { waitedMs: 0 },
      },
      { level: 'debug', event: 'db_migrations_up_to_date', fields: {} },
      {
        level: 'info',
        event: 'db_schema_bootstrap_started',
        fields: { tables: 5 },
      },
      ...PRESENT_ENTRIES,
      {
        level: 'info',
        event: 'db_schema_bootstrap_completed',
        fields: { checked: 5, created: 0, outdated: 0, durationMs: 0 },
      },
      {
        level: 'info',
        event: 'db_startup_completed',
        fields: { migrated: 0, created: 0, outdated: 0, durationMs: 0 },
      },
    ]);
  });
});

describe('runDatabaseStartup — bootstrap disabled (AC-12)', () => {
  it('still migrates, skips the bootstrap at info and runs no catalog query', async () => {
    const fake = createFakeClient();
    const { log, entries } = createLogRecorder();

    const result = await runDatabaseStartup(
      { DATABASE_URL, DB_SCHEMA_BOOTSTRAP_ENABLED: 'false' },
      {
        createClient: () => fake.client,
        migrations: ONE_MIGRATION,
        log,
        now: () => 0,
        sleep: async () => {},
      },
    );

    expect(result).toEqual({
      skipped: false,
      applied: ['001_init.sql'],
      bootstrap: null,
    });
    expect(entries).toEqual([
      {
        level: 'debug',
        event: 'db_startup_lock_acquired',
        fields: { waitedMs: 0 },
      },
      { level: 'info', event: 'db_migrations_applied', fields: { count: 1 } },
      {
        level: 'info',
        event: 'db_schema_bootstrap_skipped',
        fields: { reason: 'disabled' },
      },
      {
        level: 'info',
        event: 'db_startup_completed',
        fields: { migrated: 1, created: 0, outdated: 0, durationMs: 0 },
      },
    ]);
    expect(
      fake.queries.filter((query) =>
        query.text.includes('information_schema'),
      ),
    ).toEqual([]);
  });
});

describe('runDatabaseStartup — bounded advisory lock (AC-11)', () => {
  it('times out after the 30 s budget without a migration statement and ends the client', async () => {
    const fake = createFakeClient({ lockDefault: false });
    const { log, entries } = createLogRecorder();
    const clock = createClock();
    const retries = STARTUP_LOCK_TIMEOUT_MS / STARTUP_LOCK_RETRY_MS;

    const error = await captureStartupError(
      runDatabaseStartup(
        { DATABASE_URL },
        {
          createClient: () => fake.client,
          migrations: ONE_MIGRATION,
          log,
          now: clock.now,
          sleep: clock.sleep,
        },
      ),
    );

    expect(error.stage).toBe('lock');
    expect(error.errorType).toBe('Error');
    expect(error.code).toBeUndefined();
    expect(fake.lockAttempts).toBe(retries + 1);
    expect(clock.sleeps).toEqual(
      Array.from({ length: retries }, () => STARTUP_LOCK_RETRY_MS),
    );
    expect(fake.steps).toEqual([
      'connect',
      ...Array.from({ length: retries + 1 }, () => 'lock'),
      'end',
    ]);
    expect(entries).toEqual(
      Array.from({ length: retries }, (_, index) => ({
        level: 'debug',
        event: 'db_startup_lock_wait',
        fields: { waitedMs: index * STARTUP_LOCK_RETRY_MS },
      })),
    );
    expect(fake.endCalls).toBe(1);
  });

  it('wraps a lock-query failure with its SQLSTATE and runs no migration', async () => {
    const failure = Object.assign(new Error('lock function unavailable'), {
      code: '55P03',
    });
    const fake = createFakeClient({ failLock: failure });

    const error = await captureStartupError(
      runDatabaseStartup(
        { DATABASE_URL },
        { createClient: () => fake.client, migrations: ONE_MIGRATION },
      ),
    );

    expect(error.stage).toBe('lock');
    expect(error.errorType).toBe('Error');
    expect(error.code).toBe('55P03');
    expect(fake.steps).toEqual(['connect', 'lock', 'end']);
  });

  it('normalizes a non-Error lock rejection to errorType unknown', async () => {
    const fake = createFakeClient({ failLock: 'lock unavailable' });

    const error = await captureStartupError(
      runDatabaseStartup(
        { DATABASE_URL },
        { createClient: () => fake.client, migrations: ONE_MIGRATION },
      ),
    );

    expect(error.stage).toBe('lock');
    expect(error.errorType).toBe('unknown');
    expect(error.code).toBeUndefined();
  });
});

describe('runDatabaseStartup — failure stages (AC-9, AC-23)', () => {
  it('tags a client-construction failure as the connect stage', async () => {
    const failure = Object.assign(new Error('cannot build client'), {
      code: 'ENOENT',
    });
    const createClient = vi.fn((): MigrationClient => {
      throw failure;
    });

    const error = await captureStartupError(
      runDatabaseStartup({ DATABASE_URL }, { createClient }),
    );

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith(DATABASE_URL);
    expect(error.stage).toBe('connect');
    expect(error.errorType).toBe('Error');
    expect(error.code).toBe('ENOENT');
  });

  it('tags a connect rejection, ends the client and issues no unlock', async () => {
    const failure = Object.assign(new Error('connection refused'), {
      code: 'ECONNREFUSED',
    });
    const fake = createFakeClient({ failConnect: failure });

    const error = await captureStartupError(
      runDatabaseStartup(
        { DATABASE_URL },
        { createClient: () => fake.client, migrations: ONE_MIGRATION },
      ),
    );

    expect(error.stage).toBe('connect');
    expect(error.errorType).toBe('Error');
    expect(error.code).toBe('ECONNREFUSED');
    expect(fake.steps).toEqual(['connect', 'end']);
    expect(fake.queries).toEqual([]);
    expect(fake.endCalls).toBe(1);
  });

  it('tags a migration failure, releases the lock, ends the client and leaks no cause text (AC-23)', async () => {
    const failure = Object.assign(
      new Error(
        'migration failed for alice@example.com while running SELECT secret_token',
      ),
      { code: '42P01' },
    );
    const fake = createFakeClient({ migrationFailure: failure });
    const { log, entries } = createLogRecorder();

    const error = await captureStartupError(
      runDatabaseStartup(
        { DATABASE_URL },
        {
          createClient: () => fake.client,
          migrations: ONE_MIGRATION,
          log,
          now: () => 0,
          sleep: async () => {},
        },
      ),
    );

    expect(error.stage).toBe('migrations');
    expect(error.errorType).toBe('Error');
    expect(error.code).toBe('42P01');
    expect(fake.steps).toEqual([
      'connect',
      'lock',
      'ledger:create',
      'ledger:select',
      'begin',
      `sql:${MIGRATION_SQL}`,
      'rollback',
      'unlock',
      'end',
    ]);
    expect(entries).toEqual([
      {
        level: 'debug',
        event: 'db_startup_lock_acquired',
        fields: { waitedMs: 0 },
      },
    ]);

    const logged = JSON.stringify(entries);
    expect(logged).not.toContain('alice@example.com');
    expect(logged).not.toContain('SELECT');
    expect(logged).not.toContain('secret_token');
    expect(logged).not.toContain(DATABASE_URL);
  });

  it('tags a bootstrap failure and emits no completion summary', async () => {
    const failure = Object.assign(new Error('catalog unavailable'), {
      code: '08006',
    });
    const fake = createFakeClient({ failCatalog: failure });
    const { log, entries } = createLogRecorder();

    const error = await captureStartupError(
      runDatabaseStartup(
        { DATABASE_URL },
        {
          createClient: () => fake.client,
          migrations: ONE_MIGRATION,
          log,
          now: () => 0,
          sleep: async () => {},
        },
      ),
    );

    expect(error.stage).toBe('bootstrap');
    expect(error.errorType).toBe('Error');
    expect(error.code).toBe('08006');
    expect(fake.steps).toEqual([
      'connect',
      'lock',
      'ledger:create',
      'ledger:select',
      'begin',
      `sql:${MIGRATION_SQL}`,
      'ledger:insert',
      'commit',
      'catalog:tables',
      'unlock',
      'end',
    ]);
    expect(entries).toEqual([
      {
        level: 'debug',
        event: 'db_startup_lock_acquired',
        fields: { waitedMs: 0 },
      },
      { level: 'info', event: 'db_migrations_applied', fields: { count: 1 } },
      {
        level: 'info',
        event: 'db_schema_bootstrap_started',
        fields: { tables: 5 },
      },
    ]);
  });

  it('keeps a successful result when unlock and end both fail', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);
    const fake = createFakeClient({
      failUnlock: Object.assign(new Error('unlock failed'), {
        code: '57P01',
      }),
      failEnd: new Error('end failed'),
    });

    const result = await runDatabaseStartup(
      { DATABASE_URL },
      {
        createClient: () => fake.client,
        migrations: ONE_MIGRATION,
        now: () => 0,
        sleep: async () => {},
      },
    );

    expect(result).toEqual({
      skipped: false,
      applied: ['001_init.sql'],
      bootstrap: { checked: 5, created: [], outdated: [], durationMs: 0 },
    });
    expect(fake.steps).toEqual([
      'connect',
      'lock',
      'ledger:create',
      'ledger:select',
      'begin',
      `sql:${MIGRATION_SQL}`,
      'ledger:insert',
      'commit',
      'catalog:tables',
      'catalog:columns',
      'unlock',
      'end',
    ]);
    expect(fake.endCalls).toBe(1);
  });

  it('keeps the original failure when unlock and end both fail', async () => {
    const failure = Object.assign(new Error('migration failed'), {
      code: '42P01',
    });
    const fake = createFakeClient({
      migrationFailure: failure,
      failUnlock: new Error('unlock failed'),
      failEnd: new Error('end failed'),
    });

    const error = await captureStartupError(
      runDatabaseStartup(
        { DATABASE_URL },
        { createClient: () => fake.client, migrations: ONE_MIGRATION },
      ),
    );

    expect(error.stage).toBe('migrations');
    expect(error.errorType).toBe('Error');
    expect(error.code).toBe('42P01');
    expect(fake.endCalls).toBe(1);
  });
});

describe('runDatabaseStartup — default wiring (AC-9)', () => {
  it('constructs exactly one pg.Client with the direct URL and never a pg.Pool', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(0);

    const result = await runDatabaseStartup(
      { DIRECT_DATABASE_URL, DATABASE_URL },
      { migrations: ONE_MIGRATION },
    );

    expect(pgMocks.clients).toHaveLength(1);
    expect(pgMocks.poolConstructions).toEqual([]);
    expect(pgMocks.clients[0].config).toEqual({
      connectionString: DIRECT_DATABASE_URL,
    });
    expect(pgMocks.clients[0].ended).toBe(true);
    expect(result).toEqual({
      skipped: false,
      applied: ['001_init.sql'],
      bootstrap: {
        checked: 5,
        created: [...TABLE_NAMES],
        outdated: [],
        durationMs: 0,
      },
    });
  });

  it('sleeps 250 ms between attempts with the default timer', async () => {
    vi.useFakeTimers({ now: 0 });
    const fake = createFakeClient({ lockResults: [false, true] });
    const { log, entries } = createLogRecorder();

    const startup = runDatabaseStartup(
      { DATABASE_URL },
      {
        createClient: () => fake.client,
        migrations: ONE_MIGRATION,
        log,
      },
    );
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(STARTUP_LOCK_RETRY_MS);
    const result = await startup;

    expect(result).toEqual({
      skipped: false,
      applied: ['001_init.sql'],
      bootstrap: { checked: 5, created: [], outdated: [], durationMs: 0 },
    });
    expect(entries.slice(0, 2)).toEqual([
      {
        level: 'debug',
        event: 'db_startup_lock_wait',
        fields: { waitedMs: 0 },
      },
      {
        level: 'debug',
        event: 'db_startup_lock_acquired',
        fields: { waitedMs: STARTUP_LOCK_RETRY_MS },
      },
    ]);
    expect(fake.lockAttempts).toBe(2);
  });
});
