/**
 * `db:migrate` CLI entry point (T3, AC-10).
 *
 * Uses the dedicated-connection runner from `migrate-runner.ts`, so the CLI and
 * the startup safety net share one implementation:
 *   node dist/db/migrate-cli.js            # apply pending migrations
 *   node dist/db/migrate-cli.js --list     # print migration names (no DB access)
 *
 * Any failure logs the cause and exits `1`; `--list` never opens a connection.
 */

import { pathToFileURL } from 'node:url';

import { loadMigrations, type MigrationFile } from './migrate.js';
import {
  resolveMigrationUrl,
  runMigrationsAgainst,
  type MigrationRunnerDeps,
} from './migrate-runner.js';

/** Inputs accepted by {@link runMigrateCli}; the extras are CLI-only seams. */
export interface MigrateCliDeps extends MigrationRunnerDeps {
  /** Test seam: migration listing (defaults to the filesystem loader). */
  loadMigrations?: () => MigrationFile[];
  /** Test seam: stdout writer. */
  log?: (message: string) => void;
  /** Test seam: failure writer (message plus the underlying error). */
  logError?: (message: string, error: unknown) => void;
}

/** Runs migrations from an environment object (CLI contract). */
export async function migrateFromEnv(
  env: Record<string, string | undefined>,
  deps: MigrationRunnerDeps = {},
): Promise<string[]> {
  return runMigrationsAgainst(resolveMigrationUrl(env), deps);
}

/**
 * Runs the CLI and returns its exit code instead of exiting the process, so the
 * behavior is unit-testable. `--list` prints names without opening a database.
 */
export async function runMigrateCli(
  argv: string[],
  env: Record<string, string | undefined>,
  deps: MigrateCliDeps = {},
): Promise<number> {
  const log = deps.log ?? ((message: string) => console.log(message));
  const logError =
    deps.logError ??
    ((message: string, error: unknown) => console.error(message, error));

  if (argv.includes('--list')) {
    const list = deps.loadMigrations ?? (() => loadMigrations());
    for (const migration of list()) {
      log(migration.name);
    }
    return 0;
  }

  try {
    const applied = await migrateFromEnv(env, deps);
    if (applied.length === 0) {
      log('No pending migrations.');
    } else {
      for (const name of applied) {
        log(`Applied ${name}`);
      }
    }
    return 0;
  } catch (error) {
    logError('Failed to apply database migrations.', error);
    return 1;
  }
}

const invokedPath = process.argv[1];
if (
  invokedPath !== undefined &&
  import.meta.url === pathToFileURL(invokedPath).href
) {
  process.exitCode = await runMigrateCli(process.argv.slice(2), process.env);
}
