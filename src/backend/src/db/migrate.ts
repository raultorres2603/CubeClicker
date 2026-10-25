/**
 * In-repo SQL migration runner (T3, AC-30).
 *
 * Applies numbered `.sql` files from `db/migrations/` in lexicographic order,
 * tracking applied names in the `schema_migrations` table. The operation is
 * idempotent (already-applied files are skipped) and aborts on the first failure
 * (the in-flight migration is rolled back and the error rethrown), so a
 * half-migrated database is never served.
 *
 * Database access goes through the small {@link MigrationDb} interface so the
 * runner is unit-testable with a fake client; `pg.Pool` satisfies it.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Minimal database surface the runner needs (a `pg.Pool` qualifies). */
export interface MigrationDb {
  query(text: string, values?: unknown[]): Promise<{
    rows: Array<Record<string, unknown>>;
    rowCount?: number | null;
  }>;
}

export interface MigrationFile {
  name: string;
  sql: string;
}

export interface RunMigrationsOptions {
  /** Explicit migration list (overrides filesystem loading). */
  migrations?: MigrationFile[];
  /** Directory to load migrations from when `migrations` is omitted. */
  migrationsDir?: string;
}

const DEFAULT_MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
);

/**
 * Loads and sorts the `.sql` files in a migrations directory.
 */
export function loadMigrations(dir: string = DEFAULT_MIGRATIONS_DIR): MigrationFile[] {
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
  return entries.map((name) => ({
    name,
    sql: readFileSync(path.join(dir, name), 'utf8'),
  }));
}

/**
 * Applies any pending migrations and returns the names applied in this run.
 */
export async function runMigrations(
  db: MigrationDb,
  options: RunMigrationsOptions = {},
): Promise<string[]> {
  const migrations =
    options.migrations !== undefined
      ? options.migrations
      : loadMigrations(options.migrationsDir);

  await db.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
  );

  const appliedResult = await db.query('SELECT name FROM schema_migrations');
  const applied = new Set(
    appliedResult.rows.map((row) => String(row.name)),
  );

  const newlyApplied: string[] = [];

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      continue;
    }

    try {
      await db.query('BEGIN');
      await db.query(migration.sql);
      await db.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
        migration.name,
      ]);
      await db.query('COMMIT');
      newlyApplied.push(migration.name);
      applied.add(migration.name);
    } catch (error) {
      try {
        await db.query('ROLLBACK');
      } catch {
        // Ignore rollback errors; rethrow the original failure.
      }
      throw error;
    }
  }

  return newlyApplied;
}