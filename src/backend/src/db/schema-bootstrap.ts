/**
 * Schema bootstrap runner (T4, AC-3…AC-8).
 *
 * After the migration phase and before the backend listens, this runner reads
 * `information_schema` for the five required tables (`REQUIRED_TABLES`, in
 * dependency order) and creates any table that is missing together with its
 * indexes. Every table creation runs its contract statements in one
 * transaction, so a failed creation rolls back instead of leaving a half-built
 * table, and the DDL is idempotent (`IF NOT EXISTS`) so a concurrent instance
 * serialized by the startup advisory lock cannot collide.
 *
 * The runner does not evolve an existing table: when a table exists but lacks
 * required columns it logs `db_schema_table_outdated` with the missing columns
 * in the normative DDL order and leaves the table untouched. Types, defaults,
 * indexes and constraints on existing tables are not re-verified — the numbered
 * migrations remain the schema authority (D3/D13).
 *
 * A catalog or DDL failure is rethrown so startup can fail fast; a table
 * creation failure also emits `db_schema_bootstrap_failed` with only the table
 * name, the error type and an optional string SQLSTATE code (never the message,
 * stack or SQL text). Logging is optional so the runner can be used without a
 * sink; time is injected so the summary duration is deterministic in tests.
 */

import type { LogFields, LogSink } from '../observability/logging.js';
import { REQUIRED_TABLES, type RequiredTable } from './schema-contract.js';

/** Minimal database surface the bootstrap needs (a `pg.Client` qualifies). */
export interface SchemaBootstrapDb {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
}

/** Inputs accepted by {@link runSchemaBootstrap}. */
export interface SchemaBootstrapOptions {
  /** Event-first structured sink; when omitted the run is silent. */
  log?: LogSink;
  /** Test seam: the required-table contract; defaults to `REQUIRED_TABLES`. */
  tables?: readonly RequiredTable[];
  /** Clock used only for `durationMs`; defaults to `Date.now`. */
  now?: () => number;
}

/** A pre-existing table that is missing at least one required column. */
export interface OutdatedTable {
  table: string;
  /** Required columns absent from the table, in the contract's DDL order. */
  missingColumns: readonly string[];
}

/** Outcome of one bootstrap run. */
export interface SchemaBootstrapResult {
  /** Number of contract tables checked (the contract length). */
  checked: number;
  /** Tables created by this run, in contract order. */
  created: readonly string[];
  /** Pre-existing tables with at least one missing required column. */
  outdated: readonly OutdatedTable[];
  /** Wall-clock duration of the run in milliseconds. */
  durationMs: number;
}

/**
 * Lists the contract table names in `public`. The name array is the only bound
 * parameter in the whole bootstrap (`$1::text[]`), so no input reaches the SQL.
 */
const LIST_TABLES_SQL = `SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name = ANY($1::text[])
 ORDER BY table_name`;

/** Lists the columns of the contract tables in `public` (same `$1` parameter). */
const LIST_COLUMNS_SQL = `SELECT table_name, column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = ANY($1::text[])
 ORDER BY table_name, ordinal_position`;

/**
 * Maps a rejection to the log contract's `{ table, errorType, code? }` fields.
 *
 * The message and stack are deliberately dropped: both can contain SQL, query
 * parameters or row data, and the contract allows only the type and the
 * optional string `code` (for example a PostgreSQL SQLSTATE).
 */
function failureFields(table: string, error: unknown): LogFields {
  if (!(error instanceof Error)) {
    return { table, errorType: 'unknown' };
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string'
    ? { table, errorType: error.name, code }
    : { table, errorType: error.name };
}

/** Groups the column rows by table name. */
function columnsByTable(
  rows: ReadonlyArray<Record<string, unknown>>,
): Map<string, Set<string>> {
  const grouped = new Map<string, Set<string>>();
  for (const row of rows) {
    const table = String(row.table_name);
    const column = String(row.column_name);
    const columns = grouped.get(table) ?? new Set<string>();
    columns.add(column);
    grouped.set(table, columns);
  }
  return grouped;
}

/** Creates one missing table and its indexes inside one transaction. */
async function createTable(
  db: SchemaBootstrapDb,
  table: RequiredTable,
  log: LogSink | undefined,
): Promise<void> {
  try {
    await db.query('BEGIN');
    for (const statement of table.statements) {
      await db.query(statement);
    }
    await db.query('COMMIT');
  } catch (error) {
    try {
      await db.query('ROLLBACK');
    } catch {
      // Best-effort rollback: the original creation failure must propagate.
    }
    log?.error('db_schema_bootstrap_failed', failureFields(table.name, error));
    throw error;
  }
  log?.info('db_schema_table_created', { table: table.name });
}

/**
 * Creates every missing required table and reports outdated existing tables.
 *
 * Tables are read once from `information_schema`, then created in contract order
 * (each in its own transaction) before the existing tables are checked, so a
 * table created here is never reported present or outdated. The completed
 * summary is emitted only when the whole run succeeds; a creation failure logs
 * `db_schema_bootstrap_failed` and rethrows.
 */
export async function runSchemaBootstrap(
  db: SchemaBootstrapDb,
  options: SchemaBootstrapOptions = {},
): Promise<SchemaBootstrapResult> {
  const tables = options.tables ?? REQUIRED_TABLES;
  const log = options.log;
  const now = options.now ?? ((): number => Date.now());
  const startedAt = now();
  const tableNames = tables.map((table) => table.name);

  log?.info('db_schema_bootstrap_started', { tables: tables.length });

  const tableRows = await db.query(LIST_TABLES_SQL, [tableNames]);
  const columnRows = await db.query(LIST_COLUMNS_SQL, [tableNames]);

  const existingTables = new Set(
    tableRows.rows.map((row) => String(row.table_name)),
  );
  const existingColumns = columnsByTable(columnRows.rows);

  const created: string[] = [];
  for (const table of tables) {
    if (existingTables.has(table.name)) {
      continue;
    }
    await createTable(db, table, log);
    created.push(table.name);
  }

  const outdated: OutdatedTable[] = [];
  for (const table of tables) {
    if (!existingTables.has(table.name)) {
      continue;
    }
    const present = existingColumns.get(table.name) ?? new Set<string>();
    const missingColumns = table.columns.filter((column) => !present.has(column));
    if (missingColumns.length === 0) {
      log?.debug('db_schema_table_present', { table: table.name });
      continue;
    }
    outdated.push({ table: table.name, missingColumns });
    log?.warn('db_schema_table_outdated', {
      table: table.name,
      missingColumns: missingColumns.join(','),
    });
  }

  const result: SchemaBootstrapResult = {
    checked: tables.length,
    created,
    outdated,
    durationMs: now() - startedAt,
  };

  log?.info('db_schema_bootstrap_completed', {
    checked: result.checked,
    created: created.length,
    outdated: outdated.length,
    durationMs: result.durationMs,
  });

  return result;
}
