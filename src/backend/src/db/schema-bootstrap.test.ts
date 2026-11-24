/**
 * Schema bootstrap runner unit tests (T4, AC-4, AC-5, AC-7, AC-8, AC-23).
 *
 * The fake database answers the two `information_schema` catalog queries from
 * the fixture state, records every statement, and can reject one creation
 * statement (optionally its rollback) to prove fail-fast behavior. The
 * recording `LogSink` pins the exact event names, levels and fields, including
 * the empty-database trace, the no-op repeat, the outdated report in DDL order
 * and the failure trace. The real-database proofs live in
 * `schema-bootstrap-postgres.test.ts`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LogFields, LogSink } from '../observability/logging.js';
import { runSchemaBootstrap, type SchemaBootstrapDb } from './schema-bootstrap.js';
import { REQUIRED_TABLES, type RequiredTable } from './schema-contract.js';

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

interface FakeDbOptions {
  /** Table names reported by `information_schema.tables`. */
  existingTables?: readonly string[];
  /** Columns per table reported by `information_schema.columns`. */
  columns?: Readonly<Record<string, readonly string[]>>;
  /** Statement prefix that rejects (the failure fixture). */
  failStatementPrefix?: string;
  /** Rejection value for the matching statement. */
  failWith?: unknown;
  /** When set, both catalog queries reject with this value. */
  failCatalog?: unknown;
  /** When set, `ROLLBACK` also rejects with this value. */
  failRollback?: unknown;
}

function createFakeDb(options: FakeDbOptions = {}): {
  db: SchemaBootstrapDb;
  queries: RecordedQuery[];
} {
  const queries: RecordedQuery[] = [];
  const existingTables = options.existingTables ?? [];
  const columns = options.columns ?? {};
  return {
    queries,
    db: {
      async query(text, values) {
        queries.push({ text, values });
        if (options.failCatalog !== undefined && text.includes('information_schema')) {
          throw options.failCatalog;
        }
        if (text.includes('information_schema.tables')) {
          return { rows: existingTables.map((table_name) => ({ table_name })) };
        }
        if (text.includes('information_schema.columns')) {
          return {
            rows: Object.entries(columns).flatMap(([table_name, names]) =>
              names.map((column_name) => ({ table_name, column_name })),
            ),
          };
        }
        if (
          options.failStatementPrefix !== undefined &&
          text.startsWith(options.failStatementPrefix)
        ) {
          throw options.failWith ?? new Error('unexpected statement failure');
        }
        if (options.failRollback !== undefined && text === 'ROLLBACK') {
          throw options.failRollback;
        }
        return { rows: [], rowCount: 0 };
      },
    },
  };
}

const TABLE_NAMES = REQUIRED_TABLES.map((table) => table.name);

/** The complete column set per table, built from the contract (test fixture state). */
const COMPLETE_COLUMNS: Record<string, string[]> = Object.fromEntries(
  REQUIRED_TABLES.map((table) => [table.name, [...table.columns]]),
);

function completeColumns(
  overrides: Readonly<Record<string, readonly string[]>> = {},
): Record<string, readonly string[]> {
  return { ...COMPLETE_COLUMNS, ...overrides };
}

/** Returns the non-catalog statements the fake database executed. */
function ddlStatements(queries: readonly RecordedQuery[]): string[] {
  return queries
    .filter((query) => !query.text.startsWith('SELECT'))
    .map((query) => query.text);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runSchemaBootstrap on an empty database', () => {
  it('creates every table in contract order inside one transaction per table and traces it (AC-4)', async () => {
    const { db, queries } = createFakeDb();
    const { log, entries } = createLogRecorder();

    const result = await runSchemaBootstrap(db, { log, now: () => 1_000 });

    expect(result).toEqual({
      checked: 5,
      created: [
        'users',
        'sessions',
        'verification_tokens',
        'user_economy',
        'schema_migrations',
      ],
      outdated: [],
      durationMs: 0,
    });
    expect(entries).toEqual([
      { level: 'info', event: 'db_schema_bootstrap_started', fields: { tables: 5 } },
      { level: 'info', event: 'db_schema_table_created', fields: { table: 'users' } },
      { level: 'info', event: 'db_schema_table_created', fields: { table: 'sessions' } },
      {
        level: 'info',
        event: 'db_schema_table_created',
        fields: { table: 'verification_tokens' },
      },
      {
        level: 'info',
        event: 'db_schema_table_created',
        fields: { table: 'user_economy' },
      },
      {
        level: 'info',
        event: 'db_schema_table_created',
        fields: { table: 'schema_migrations' },
      },
      {
        level: 'info',
        event: 'db_schema_bootstrap_completed',
        fields: { checked: 5, created: 5, outdated: 0, durationMs: 0 },
      },
    ]);

    expect(ddlStatements(queries)).toEqual(
      REQUIRED_TABLES.flatMap((table) => ['BEGIN', ...table.statements, 'COMMIT']),
    );
  });

  it('binds the constant table-name array as $1 and reads only the public schema', async () => {
    const { db, queries } = createFakeDb();

    await runSchemaBootstrap(db, { now: () => 0 });

    const catalogQueries = queries.filter((query) =>
      query.text.includes('information_schema'),
    );
    expect(catalogQueries.map((query) => query.values)).toEqual([
      [TABLE_NAMES],
      [TABLE_NAMES],
    ]);
    expect(
      catalogQueries.map((query) => query.text.includes("table_schema = 'public'")),
    ).toEqual([true, true]);
  });
});

describe('runSchemaBootstrap on a complete schema', () => {
  it('is a no-op that reports every table present and issues no DDL (AC-5)', async () => {
    const { db, queries } = createFakeDb({
      existingTables: TABLE_NAMES,
      // An extra column on an existing table is ignored: only required columns
      // are compared (the table stays "present").
      columns: completeColumns({
        users: [...COMPLETE_COLUMNS.users, 'legacy_extra'],
      }),
    });
    const { log, entries } = createLogRecorder();
    let clock = 5_000;
    const now = (): number => {
      const current = clock;
      clock += 250;
      return current;
    };

    const result = await runSchemaBootstrap(db, { log, now });

    expect(result).toEqual({ checked: 5, created: [], outdated: [], durationMs: 250 });
    expect(entries).toEqual([
      { level: 'info', event: 'db_schema_bootstrap_started', fields: { tables: 5 } },
      { level: 'debug', event: 'db_schema_table_present', fields: { table: 'users' } },
      { level: 'debug', event: 'db_schema_table_present', fields: { table: 'sessions' } },
      {
        level: 'debug',
        event: 'db_schema_table_present',
        fields: { table: 'verification_tokens' },
      },
      {
        level: 'debug',
        event: 'db_schema_table_present',
        fields: { table: 'user_economy' },
      },
      {
        level: 'debug',
        event: 'db_schema_table_present',
        fields: { table: 'schema_migrations' },
      },
      {
        level: 'info',
        event: 'db_schema_bootstrap_completed',
        fields: { checked: 5, created: 0, outdated: 0, durationMs: 250 },
      },
    ]);
    expect(ddlStatements(queries)).toEqual([]);
  });
});

describe('runSchemaBootstrap on an outdated schema', () => {
  it('reports one missing column in DDL order without altering anything (AC-7)', async () => {
    const { db, queries } = createFakeDb({
      existingTables: TABLE_NAMES,
      columns: completeColumns({
        users: COMPLETE_COLUMNS.users.filter((column) => column !== 'locked_until'),
      }),
    });
    const { log, entries } = createLogRecorder();

    const result = await runSchemaBootstrap(db, { log, now: () => 8_000 });

    expect(result).toEqual({
      checked: 5,
      created: [],
      outdated: [{ table: 'users', missingColumns: ['locked_until'] }],
      durationMs: 0,
    });
    expect(entries).toEqual([
      { level: 'info', event: 'db_schema_bootstrap_started', fields: { tables: 5 } },
      {
        level: 'warn',
        event: 'db_schema_table_outdated',
        fields: { table: 'users', missingColumns: 'locked_until' },
      },
      { level: 'debug', event: 'db_schema_table_present', fields: { table: 'sessions' } },
      {
        level: 'debug',
        event: 'db_schema_table_present',
        fields: { table: 'verification_tokens' },
      },
      {
        level: 'debug',
        event: 'db_schema_table_present',
        fields: { table: 'user_economy' },
      },
      {
        level: 'debug',
        event: 'db_schema_table_present',
        fields: { table: 'schema_migrations' },
      },
      {
        level: 'info',
        event: 'db_schema_bootstrap_completed',
        fields: { checked: 5, created: 0, outdated: 1, durationMs: 0 },
      },
    ]);
    expect(ddlStatements(queries)).toEqual([]);
  });

  it('joins two missing columns in the normative DDL order, not catalog order (AC-7)', async () => {
    const scrambledUsers = COMPLETE_COLUMNS.users
      .filter(
        (column) =>
          column !== 'failed_login_attempts' && column !== 'locked_until',
      )
      .reverse();
    const { db } = createFakeDb({
      existingTables: TABLE_NAMES,
      columns: completeColumns({ users: scrambledUsers }),
    });
    const { log, entries } = createLogRecorder();

    const result = await runSchemaBootstrap(db, { log, now: () => 0 });

    expect(
      entries.filter((entry) => entry.event === 'db_schema_table_outdated'),
    ).toEqual([
      {
        level: 'warn',
        event: 'db_schema_table_outdated',
        fields: {
          table: 'users',
          missingColumns: 'failed_login_attempts,locked_until',
        },
      },
    ]);
    expect(result.outdated).toEqual([
      {
        table: 'users',
        missingColumns: ['failed_login_attempts', 'locked_until'],
      },
    ]);
  });
});

describe('runSchemaBootstrap failures', () => {
  it('rejects on a creation failure, rolls back and traces it without a summary (AC-8)', async () => {
    const failure = new Error('sessions ddl rejected');
    const { db, queries } = createFakeDb({
      failStatementPrefix: 'CREATE TABLE IF NOT EXISTS sessions',
      failWith: failure,
    });
    const { log, entries } = createLogRecorder();

    await expect(runSchemaBootstrap(db, { log, now: () => 0 })).rejects.toBe(failure);

    expect(entries).toEqual([
      { level: 'info', event: 'db_schema_bootstrap_started', fields: { tables: 5 } },
      { level: 'info', event: 'db_schema_table_created', fields: { table: 'users' } },
      {
        level: 'error',
        event: 'db_schema_bootstrap_failed',
        fields: { table: 'sessions', errorType: 'Error' },
      },
    ]);

    const sessionsTable = REQUIRED_TABLES.find((table) => table.name === 'sessions');
    if (sessionsTable === undefined) {
      throw new Error('sessions is missing from the required-table contract');
    }
    const statements = ddlStatements(queries);
    expect(statements.slice(-3)).toEqual([
      'BEGIN',
      sessionsTable.statements[0],
      'ROLLBACK',
    ]);
    expect(statements.filter((statement) => statement === 'COMMIT')).toEqual([
      'COMMIT',
    ]);
  });

  it('logs only the error type and the SQLSTATE code on a creation failure (AC-23)', async () => {
    const failure = Object.assign(new Error('relation already exists'), {
      code: '42P07',
    });
    const { db } = createFakeDb({
      failStatementPrefix: 'CREATE TABLE IF NOT EXISTS sessions',
      failWith: failure,
    });
    const { log, entries } = createLogRecorder();

    await expect(runSchemaBootstrap(db, { log, now: () => 0 })).rejects.toBe(failure);

    expect(entries[entries.length - 1]).toEqual({
      level: 'error',
      event: 'db_schema_bootstrap_failed',
      fields: { table: 'sessions', errorType: 'Error', code: '42P07' },
    });
  });

  it('normalizes a non-Error rejection to errorType unknown (AC-23)', async () => {
    const { db } = createFakeDb({
      failStatementPrefix: 'CREATE TABLE IF NOT EXISTS sessions',
      failWith: 'sessions ddl rejected',
    });
    const { log, entries } = createLogRecorder();

    await expect(runSchemaBootstrap(db, { log, now: () => 0 })).rejects.toBe(
      'sessions ddl rejected',
    );

    expect(entries[entries.length - 1]).toEqual({
      level: 'error',
      event: 'db_schema_bootstrap_failed',
      fields: { table: 'sessions', errorType: 'unknown' },
    });
  });

  it('keeps the original creation failure when the rollback also fails', async () => {
    const failure = new Error('sessions ddl rejected');
    const { db } = createFakeDb({
      failStatementPrefix: 'CREATE TABLE IF NOT EXISTS sessions',
      failWith: failure,
      failRollback: new Error('rollback connection lost'),
    });
    const { log, entries } = createLogRecorder();

    await expect(runSchemaBootstrap(db, { log, now: () => 0 })).rejects.toBe(failure);

    expect(
      entries.filter((entry) => entry.event === 'db_schema_bootstrap_failed'),
    ).toEqual([
      {
        level: 'error',
        event: 'db_schema_bootstrap_failed',
        fields: { table: 'sessions', errorType: 'Error' },
      },
    ]);
  });

  it('propagates a catalog query failure after the started event and without a summary', async () => {
    const failure = new Error('catalog unavailable');
    const { db } = createFakeDb({ failCatalog: failure });
    const { log, entries } = createLogRecorder();

    await expect(runSchemaBootstrap(db, { log, now: () => 0 })).rejects.toBe(failure);

    expect(entries).toEqual([
      { level: 'info', event: 'db_schema_bootstrap_started', fields: { tables: 5 } },
    ]);
  });
});

describe('runSchemaBootstrap seams', () => {
  it('runs silently with the default clock when no options are supplied', async () => {
    const { db } = createFakeDb();
    vi.spyOn(Date, 'now').mockReturnValueOnce(2_000).mockReturnValueOnce(3_250);

    const result = await runSchemaBootstrap(db);

    expect(result).toEqual({
      checked: 5,
      created: [
        'users',
        'sessions',
        'verification_tokens',
        'user_economy',
        'schema_migrations',
      ],
      outdated: [],
      durationMs: 1_250,
    });
  });

  it('uses a supplied table contract instead of REQUIRED_TABLES', async () => {
    const tables: readonly RequiredTable[] = [
      {
        name: 'widgets',
        columns: ['id', 'label'],
        statements: ['CREATE TABLE IF NOT EXISTS widgets (id TEXT PRIMARY KEY);'],
      },
    ];
    const { db, queries } = createFakeDb();
    const { log, entries } = createLogRecorder();

    const result = await runSchemaBootstrap(db, { tables, log, now: () => 7 });

    expect(result).toEqual({
      checked: 1,
      created: ['widgets'],
      outdated: [],
      durationMs: 0,
    });
    expect(entries).toEqual([
      { level: 'info', event: 'db_schema_bootstrap_started', fields: { tables: 1 } },
      { level: 'info', event: 'db_schema_table_created', fields: { table: 'widgets' } },
      {
        level: 'info',
        event: 'db_schema_bootstrap_completed',
        fields: { checked: 1, created: 1, outdated: 0, durationMs: 0 },
      },
    ]);
    expect(
      queries
        .filter((query) => query.text.includes('information_schema'))
        .map((query) => query.values),
    ).toEqual([[['widgets']], [['widgets']]]);
  });
});
