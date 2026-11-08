import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadMigrations, runMigrations } from './migrate.js';

/**
 * Migration 006 contract tests.
 *
 * The static suite pins the migration/schema statements and always runs. The PostgreSQL
 * suite exercises the actual SQL against a throwaway `postgres:16-alpine` container
 * (Podman or Docker) because the rewrite depends on JSONB/CTE semantics that a fake
 * `MigrationDb` cannot evaluate. When no container runtime is available the DB suite is
 * skipped (the containerized smoke tier still covers the boot path); CI runners provide
 * Docker, so the suite runs there as well.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_NAME = '006_granular_spaceship_parts.sql';
const PREVIOUS_MIGRATIONS = [
  '001_init.sql',
  '002_economy.sql',
  '003_upgrades.sql',
  '004_idle_accrual.sql',
  '005_spaceship_customization.sql',
] as const;
const POSTGRES_IMAGE = 'docker.io/library/postgres:16-alpine';

const migrationSql = readFileSync(path.join(HERE, 'migrations', MIGRATION_NAME), 'utf8');
const schemaSql = readFileSync(path.join(HERE, 'schema.sql'), 'utf8');

const FIXTURE_USER = '10000000-0000-4000-8000-000000000001';
const OVERFLOW_USER = '10000000-0000-4000-8000-000000000002';
const COLLISION_USER = '10000000-0000-4000-8000-000000000003';
const EMPTY_USER = '10000000-0000-4000-8000-000000000004';
const DEFAULT_USER = '10000000-0000-4000-8000-000000000005';

const FIXTURE_PARTS = { 'wings-silver': 2, 'engine-blue': 1, 'body-gold': 1 };
const FIXTURE_APPEARANCE = {
  wings: 'wings-silver',
  engine: 'engine-blue',
  body: 'body-gold',
};

interface LegacyRow {
  user_id: string;
  parts: Record<string, number>;
  appearance: Record<string, string>;
}

interface CustomizationRow extends LegacyRow {
  customization_version: number;
}

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
  const name = `cubeclicker-migration-006-${process.pid}-${Date.now()}`;
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

async function seedUser(
  client: Client,
  id: string,
  index: number,
  parts: Record<string, unknown>,
  appearance: Record<string, unknown>,
): Promise<void> {
  await client.query(
    'INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)',
    [id, `migration006user${index}`, `migration006user${index}@example.test`, 'hash'],
  );
  await client.query(
    'INSERT INTO user_economy (user_id, parts, appearance) VALUES ($1, $2::jsonb, $3::jsonb)',
    [id, JSON.stringify(parts), JSON.stringify(appearance)],
  );
}

async function readLegacyRows(client: Client): Promise<LegacyRow[]> {
  const result = await client.query<LegacyRow>(
    'SELECT user_id, parts, appearance FROM user_economy ORDER BY user_id',
  );
  return result.rows;
}

async function readRows(client: Client): Promise<CustomizationRow[]> {
  const result = await client.query<CustomizationRow>(
    'SELECT user_id, parts, appearance, customization_version FROM user_economy ORDER BY user_id',
  );
  return result.rows;
}

describe('migration 006 statements', () => {
  it('loads the committed migration after 005', () => {
    const names = loadMigrations().map((migration) => migration.name);
    const index006 = names.indexOf(MIGRATION_NAME);
    expect(index006).toBeGreaterThan(-1);
    expect(names.slice(0, index006)).toEqual([...PREVIOUS_MIGRATIONS]);
  });

  it('adds customization_version with default 1, backfills 2, then sets default 2', () => {
    expect(migrationSql).toMatch(
      /ALTER TABLE user_economy\s+ADD COLUMN IF NOT EXISTS customization_version INT NOT NULL DEFAULT 1;/,
    );
    expect(migrationSql).toMatch(
      /UPDATE user_economy\s+SET customization_version = 2\s+WHERE customization_version < 2;/,
    );
    expect(migrationSql).toMatch(
      /ALTER TABLE user_economy\s+ALTER COLUMN customization_version SET DEFAULT 2;/,
    );
  });

  it('rewrites appearance keys and values through jsonb_strip_nulls', () => {
    expect(migrationSql).toContain('jsonb_strip_nulls(');
    expect(migrationSql).toContain(
      "replace(COALESCE(appearance->>'hull', appearance->>'body'), 'body-', 'hull-')",
    );
    expect(migrationSql).toContain(
      "replace(COALESCE(appearance->>'wing-left', appearance->>'wings'), 'wings-', 'wing-left-')",
    );
    expect(migrationSql).toContain(
      "replace(COALESCE(appearance->>'wing-right', appearance->>'wings'), 'wings-', 'wing-right-')",
    );
    expect(migrationSql).toContain(
      "replace(COALESCE(appearance->>'ignition-left', appearance->>'engine'), 'engine-', 'ignition-left-')",
    );
    expect(migrationSql).toContain(
      "replace(COALESCE(appearance->>'ignition-right', appearance->>'engine'), 'engine-', 'ignition-right-')",
    );
    expect(migrationSql).toContain("'nose', appearance->>'nose'");
    expect(migrationSql).toContain("'cockpit', appearance->>'cockpit'");
  });

  it('bounds part counts and skips non-numeric/overflow values', () => {
    expect(migrationSql).toContain("p.value ~ '^[0-9]+$'");
    expect(migrationSql).toContain('amount BETWEEN 0 AND 2147483647');
    expect(migrationSql).toContain("WHEN key IN ('body-default', 'body-obsidian', 'body-gold')");
    expect(migrationSql).toContain("WHEN key IN ('wings-default', 'wings-silver')");
    expect(migrationSql).toContain("WHEN key IN ('engine-default', 'engine-blue')");
    expect(migrationSql).toContain('SELECT key, SUM(amount) AS amount');
  });

  it('mirrors customization_version in schema.sql', () => {
    expect(schemaSql).toContain('customization_version INT NOT NULL DEFAULT 2');
    expect(schemaSql).toContain("parts JSONB NOT NULL DEFAULT '{}'::jsonb");
    expect(schemaSql).toContain("appearance JSONB NOT NULL DEFAULT '{}'::jsonb");
  });
});

const containerRuntime = detectContainerRuntime();
const dbDescribe = containerRuntime === null ? describe.skip : describe;

dbDescribe('migration 006 against PostgreSQL', () => {
  let client: Client;
  let stopContainer: () => void;
  let appliedInitial: string[] = [];
  let appliedSix: string[] = [];
  let appliedAgain: string[] = [];
  let preMigrationRows: LegacyRow[] = [];
  let postMigrationRows: CustomizationRow[] = [];
  let rowsBeforeRerun: CustomizationRow[] = [];
  let rerunRows: CustomizationRow[] = [];
  let columnMeta: ColumnMeta | undefined;
  let defaultUserVersion: number | undefined;
  let recordedMigration: string | undefined;

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

    await seedUser(client, FIXTURE_USER, 1, FIXTURE_PARTS, FIXTURE_APPEARANCE);
    await seedUser(client, OVERFLOW_USER, 2, {
      'wings-silver': 'not-a-number',
      'engine-blue': 2147483648,
      'body-gold': 3,
      'nose-crimson': 2147483647,
      'cockpit-oracle': -1,
      'wings-gold': 1.5,
    }, {});
    await seedUser(client, COLLISION_USER, 3, {
      'wings-silver': 2,
      'wing-left-silver': 5,
      'body-gold': 1,
      'hull-gold': 2,
      'engine-blue': 1,
      'ignition-right-blue': 4,
    }, {});
    await seedUser(client, EMPTY_USER, 4, {}, {});

    preMigrationRows = await readLegacyRows(client);

    appliedSix = await runMigrations(client);
    postMigrationRows = await readRows(client);

    const meta = await client.query<ColumnMeta>(
      `SELECT data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_name = 'user_economy' AND column_name = 'customization_version'`,
    );
    columnMeta = meta.rows[0];

    const recorded = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations WHERE name = $1',
      [MIGRATION_NAME],
    );
    recordedMigration = recorded.rows[0]?.name;

    await client.query(
      'INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, $4)',
      [DEFAULT_USER, 'migration006default', 'migration006default@example.test', 'hash'],
    );
    await client.query('INSERT INTO user_economy (user_id) VALUES ($1)', [DEFAULT_USER]);
    const defaulted = await client.query<{ customization_version: number }>(
      'SELECT customization_version FROM user_economy WHERE user_id = $1',
      [DEFAULT_USER],
    );
    defaultUserVersion = defaulted.rows[0]?.customization_version;

    // Re-execute the SQL body directly to prove the data rewrite is idempotent.
    rowsBeforeRerun = await readRows(client);
    await client.query(migrationSql);
    rerunRows = await readRows(client);
    appliedAgain = await runMigrations(client);
  }, 120_000);

  afterAll(async () => {
    await client?.end().catch(() => undefined);
    stopContainer?.();
  }, 60_000);

  it('applies 001-005 first, then exactly 006 once', () => {
    expect(appliedInitial).toEqual([...PREVIOUS_MIGRATIONS]);
    expect(appliedSix).toEqual([MIGRATION_NAME]);
    expect(appliedAgain).toEqual([]);
    expect(recordedMigration).toBe(MIGRATION_NAME);
  });

  it('keeps the pre-migration legacy row untouched before 006', () => {
    const fixture = preMigrationRows.find((row) => row.user_id === FIXTURE_USER);
    expect(fixture).toEqual({
      user_id: FIXTURE_USER,
      parts: FIXTURE_PARTS,
      appearance: FIXTURE_APPEARANCE,
    });
  });

  it('rewrites the AC-33 fixture to the exact v2 parts and appearance', () => {
    const fixture = postMigrationRows.find((row) => row.user_id === FIXTURE_USER);
    expect(fixture).toEqual({
      user_id: FIXTURE_USER,
      parts: {
        'hull-gold': 1,
        'wing-left-silver': 2,
        'wing-right-silver': 2,
        'ignition-left-blue': 1,
        'ignition-right-blue': 1,
      },
      appearance: {
        hull: 'hull-gold',
        'wing-left': 'wing-left-silver',
        'wing-right': 'wing-right-silver',
        'ignition-left': 'ignition-left-blue',
        'ignition-right': 'ignition-right-blue',
      },
      customization_version: 2,
    });
  });

  it('skips non-numeric, negative, fractional and overflow counts', () => {
    const overflow = postMigrationRows.find((row) => row.user_id === OVERFLOW_USER);
    expect(overflow).toEqual({
      user_id: OVERFLOW_USER,
      parts: {
        'hull-gold': 3,
        'nose-crimson': 2147483647,
      },
      appearance: {},
      customization_version: 2,
    });
  });

  it('sums collisions across legacy and canonical keys', () => {
    const collision = postMigrationRows.find((row) => row.user_id === COLLISION_USER);
    expect(collision).toEqual({
      user_id: COLLISION_USER,
      parts: {
        'hull-gold': 3,
        'wing-left-silver': 7,
        'wing-right-silver': 2,
        'ignition-left-blue': 1,
        'ignition-right-blue': 5,
      },
      appearance: {},
      customization_version: 2,
    });
  });

  it('rewrites empty maps and stamps version 2 on every row', () => {
    const empty = postMigrationRows.find((row) => row.user_id === EMPTY_USER);
    expect(empty).toEqual({
      user_id: EMPTY_USER,
      parts: {},
      appearance: {},
      customization_version: 2,
    });
    expect(postMigrationRows.map((row) => row.customization_version)).toEqual([2, 2, 2, 2]);
  });

  it('leaves customization_version NOT NULL with default 2', () => {
    expect(columnMeta).toEqual({
      data_type: 'integer',
      is_nullable: 'NO',
      column_default: '2',
    });
    expect(defaultUserVersion).toBe(2);
  });

  it('is idempotent when the rewrite is re-run', () => {
    expect(rerunRows).toEqual(rowsBeforeRerun);
  });
});
