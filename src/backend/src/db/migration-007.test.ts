import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  PgEconomyRepository,
  type EconomyDb,
} from '../auth/economy-repository.js';
import { loadMigrations, runMigrations } from './migrate.js';

/**
 * Migration 007 contract tests.
 *
 * The static suite pins the additive migration/schema statement and always runs. The
 * PostgreSQL suite (same `dbDescribe` pattern as `migration-006.test.ts`) applies the real
 * migrations to a throwaway `postgres:16-alpine` container: it proves the column is absent
 * before 007, lands as `BIGINT NOT NULL DEFAULT 0` with existing/new rows reading 0, is
 * idempotent, and that the shipped `PgEconomyRepository` revision API works against the
 * migrated schema. When no container runtime is available the DB suite is skipped.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_NAME = '007_economy_revision.sql';
const PREVIOUS_MIGRATIONS = [
  '001_init.sql',
  '002_economy.sql',
  '003_upgrades.sql',
  '004_idle_accrual.sql',
  '005_spaceship_customization.sql',
  '006_granular_spaceship_parts.sql',
] as const;
const POSTGRES_IMAGE = 'docker.io/library/postgres:16-alpine';

const migrationSql = readFileSync(path.join(HERE, 'migrations', MIGRATION_NAME), 'utf8');
const schemaSql = readFileSync(path.join(HERE, 'schema.sql'), 'utf8');

const FIXTURE_USER = '10000000-0000-4000-8000-000000000071';
const DEFAULT_USER = '10000000-0000-4000-8000-000000000072';
const REVISION_USER = '10000000-0000-4000-8000-000000000073';

interface ColumnMeta {
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

type ContainerRuntime = 'podman' | 'docker';

function detectContainerRuntime(): ContainerRuntime | null {
  for (const candidate of ['podman', 'docker'] as const) {
    const result = spawnSync(candidate, ['info'], {
      stdio: 'ignore',
      timeout: 10_000,
    });
    if (result.status === 0) {
      return candidate;
    }
  }
  return null;
}

function startPostgres(runtime: ContainerRuntime): {
  connectionString: string;
  stop: () => void;
} {
  const name = `cubeclicker-migration-007-${process.pid}-${Date.now()}`;
  const run = spawnSync(
    runtime,
    [
      'run',
      '-d',
      '--rm',
      '--name',
      name,
      '-e',
      'POSTGRES_USER=cubeclicker',
      '-e',
      'POSTGRES_PASSWORD=cubeclicker',
      '-e',
      'POSTGRES_DB=cubeclicker',
      '-p',
      '127.0.0.1::5432',
      POSTGRES_IMAGE,
    ],
    { encoding: 'utf8', timeout: 120_000 },
  );
  if (run.status !== 0) {
    throw new Error(`failed to start ${POSTGRES_IMAGE}: ${run.stderr}`);
  }

  const stop = (): void => {
    spawnSync(runtime, ['rm', '-f', name], { stdio: 'ignore', timeout: 30_000 });
  };

  try {
    const portResult = spawnSync(runtime, ['port', name, '5432/tcp'], {
      encoding: 'utf8',
      timeout: 15_000,
    });
    if (portResult.status !== 0) {
      throw new Error(`failed to read mapped port: ${portResult.stderr}`);
    }
    const match =
      portResult.stdout.match(/127\.0\.0\.1:(\d+)/) ??
      portResult.stdout.match(/0\.0\.0\.0:(\d+)/) ??
      portResult.stdout.match(/:(\d+)\s*$/m);
    if (match === null) {
      throw new Error(`could not parse mapped port from: ${portResult.stdout}`);
    }
    return {
      connectionString: `postgres://cubeclicker:cubeclicker@127.0.0.1:${match[1]}/cubeclicker`,
      stop,
    };
  } catch (error) {
    stop();
    throw error;
  }
}

async function waitForPostgres(connectionString: string): Promise<Client> {
  const deadline = Date.now() + 60_000;
  let lastError: unknown = new Error('not attempted');
  while (Date.now() < deadline) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      await client.query('SELECT 1');
      return client;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`PostgreSQL did not become ready: ${String(lastError)}`);
}

describe('migration 007 statements', () => {
  it('loads the committed migration after 006', () => {
    const names = loadMigrations().map((migration) => migration.name);
    const index007 = names.indexOf(MIGRATION_NAME);
    expect(index007).toBeGreaterThan(-1);
    expect(names.slice(0, index007)).toEqual([...PREVIOUS_MIGRATIONS]);
  });

  it('adds economy_revision as one additive, idempotent BIGINT column', () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE user_economy\s+ADD COLUMN IF NOT EXISTS economy_revision BIGINT NOT NULL DEFAULT 0;/,
    );
    expect(migrationSql.match(/ALTER TABLE/g)).toHaveLength(1);
    expect(migrationSql).not.toContain('UPDATE user_economy');
  });

  it('mirrors the column in schema.sql', () => {
    expect(schemaSql).toContain('economy_revision BIGINT NOT NULL DEFAULT 0');
  });
});

const containerRuntime = detectContainerRuntime();
const dbDescribe = containerRuntime === null ? describe.skip : describe;

dbDescribe('migration 007 against PostgreSQL', () => {
  let client: Client;
  let repo: PgEconomyRepository;
  let stopContainer: () => void;
  let appliedInitial: string[] = [];
  let appliedSeven: string[] = [];
  let appliedAgain: string[] = [];
  let preColumnCount = -1;
  let columnMeta: ColumnMeta | undefined;
  let postMigrationRevision: string | undefined;
  let defaultRevision: string | undefined;
  let recordedMigration: string | undefined;
  let rerunRevision: string | undefined;

  beforeAll(async () => {
    const database = startPostgres(containerRuntime as ContainerRuntime);
    stopContainer = database.stop;
    client = await waitForPostgres(database.connectionString);
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');

    const allMigrations = loadMigrations();
    appliedInitial = await runMigrations(client, {
      migrations: allMigrations.filter((migration) => migration.name !== MIGRATION_NAME),
    });

    await client.query(
      'INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)',
      [FIXTURE_USER, 'migration007fixture', 'migration007fixture@example.test', 'hash'],
    );
    await client.query(
      `INSERT INTO user_economy (user_id, coins, clicks, faces_destroyed, cubes_destroyed)
       VALUES ($1, 3.25, 9, 4, 2)`,
      [FIXTURE_USER],
    );

    const before = await client.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_name = 'user_economy' AND column_name = 'economy_revision'`,
    );
    preColumnCount = before.rows.length;

    appliedSeven = await runMigrations(client);

    const meta = await client.query<ColumnMeta>(
      `SELECT data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_name = 'user_economy' AND column_name = 'economy_revision'`,
    );
    columnMeta = meta.rows[0];

    const existing = await client.query<{ economy_revision: string }>(
      'SELECT economy_revision FROM user_economy WHERE user_id = $1',
      [FIXTURE_USER],
    );
    postMigrationRevision = existing.rows[0]?.economy_revision;

    await client.query(
      'INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)',
      [DEFAULT_USER, 'migration007default', 'migration007default@example.test', 'hash'],
    );
    await client.query(
      'INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)',
      [REVISION_USER, 'migration007revision', 'migration007revision@example.test', 'hash'],
    );
    await client.query('INSERT INTO user_economy (user_id) VALUES ($1)', [DEFAULT_USER]);
    const defaulted = await client.query<{ economy_revision: string }>(
      'SELECT economy_revision FROM user_economy WHERE user_id = $1',
      [DEFAULT_USER],
    );
    defaultRevision = defaulted.rows[0]?.economy_revision;

    const recorded = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations WHERE name = $1',
      [MIGRATION_NAME],
    );
    recordedMigration = recorded.rows[0]?.name;

    // Re-execute the SQL body directly to prove the additive statement is idempotent.
    await client.query(migrationSql);
    const rerun = await client.query<{ economy_revision: string }>(
      'SELECT economy_revision FROM user_economy WHERE user_id = $1',
      [FIXTURE_USER],
    );
    rerunRevision = rerun.rows[0]?.economy_revision;
    appliedAgain = await runMigrations(client);

    const db: EconomyDb = {
      async query(text, values) {
        const result = await client.query(text, values);
        return {
          rows: result.rows as Array<Record<string, unknown>>,
          rowCount: result.rowCount,
        };
      },
    };
    repo = new PgEconomyRepository(db);
  }, 120_000);

  afterAll(async () => {
    await client?.end().catch(() => undefined);
    stopContainer?.();
  }, 60_000);

  it('applies 001-006 first, then exactly 007 once', () => {
    expect(appliedInitial).toEqual([...PREVIOUS_MIGRATIONS]);
    expect(appliedSeven).toEqual([MIGRATION_NAME]);
    expect(appliedAgain).toEqual([]);
    expect(recordedMigration).toBe(MIGRATION_NAME);
  });

  it('did not exist before 007 and leaves existing rows reading 0', () => {
    expect(preColumnCount).toBe(0);
    expect(postMigrationRevision).toBe('0');
  });

  it('defaults new rows to 0 and stays NOT NULL BIGINT DEFAULT 0', () => {
    expect(columnMeta).toEqual({
      data_type: 'bigint',
      is_nullable: 'NO',
      column_default: '0',
    });
    expect(defaultRevision).toBe('0');
  });

  it('is idempotent when the migration body is re-run', () => {
    expect(rerunRevision).toBe('0');
  });

  it('creditWithRevision writes revision 1 then increments it on the migrated schema', async () => {
    expect(
      await repo.creditWithRevision(REVISION_USER, {
        coins: 20,
        clicks: 1,
        facesDestroyed: 2,
      }),
    ).toEqual({
      economy: { coins: 20, clicks: 1, facesDestroyed: 2, cubesDestroyed: 0 },
      revision: 1,
    });
    expect(await repo.creditWithRevision(REVISION_USER, { coins: 0.5, clicks: 1 })).toEqual({
      economy: { coins: 20.5, clicks: 2, facesDestroyed: 2, cubesDestroyed: 0 },
      revision: 2,
    });
    expect(await repo.findEconomySnapshot(REVISION_USER)).toEqual({
      economy: { coins: 20.5, clicks: 2, facesDestroyed: 2, cubesDestroyed: 0 },
      revision: 2,
    });
    expect(await repo.findUpgradesSnapshot(REVISION_USER)).toEqual({
      upgrades: {},
      revision: 2,
    });
  });

  it('purchaseUpgrade bumps the same revision and the upgrade snapshot reads it atomically', async () => {
    expect(await repo.purchaseUpgrade(REVISION_USER, 'mini_cube_value', 10, 0)).toEqual({
      economy: { coins: 10.5, clicks: 2, facesDestroyed: 2, cubesDestroyed: 0 },
      upgrades: { mini_cube_value: 1 },
      revision: 3,
    });
    expect(await repo.findUpgradesSnapshot(REVISION_USER)).toEqual({
      upgrades: { mini_cube_value: 1 },
      revision: 3,
    });
    expect(await repo.findUpgradesByUserId(REVISION_USER)).toEqual({ mini_cube_value: 1 });
  });

  it('the credit wrapper continues the same revision space on the migrated schema', async () => {
    expect(await repo.credit(REVISION_USER, { clicks: 1 })).toEqual({
      coins: 10.5,
      clicks: 3,
      facesDestroyed: 2,
      cubesDestroyed: 0,
    });
    expect(await repo.findEconomySnapshot(REVISION_USER)).toEqual({
      economy: { coins: 10.5, clicks: 3, facesDestroyed: 2, cubesDestroyed: 0 },
      revision: 4,
    });
    const stored = await client.query<{ economy_revision: string }>(
      'SELECT economy_revision FROM user_economy WHERE user_id = $1',
      [REVISION_USER],
    );
    expect(stored.rows[0]?.economy_revision).toBe('4');
  });

  it('the first purchase on a migrated pre-existing row starts at revision 1', async () => {
    expect(await repo.purchaseUpgrade(FIXTURE_USER, 'mini_cube_value', 1, 0)).toEqual({
      economy: { coins: 2.25, clicks: 9, facesDestroyed: 4, cubesDestroyed: 2 },
      upgrades: { mini_cube_value: 1 },
      revision: 1,
    });
  });
});
