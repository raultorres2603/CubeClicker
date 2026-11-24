/**
 * Schema bootstrap against real PostgreSQL (T4, AC-3, AC-5, AC-6, AC-7, AC-23).
 *
 * A throwaway `postgres:16-alpine` container (Podman or Docker, same helper
 * pattern as `schema-contract-postgres.test.ts`) proves the bootstrap against
 * the real catalog instead of a fake:
 *
 * - an empty `public` schema becomes complete, with the pinned defaults/NOT NULL
 *   attributes and both `users` functional unique indexes, and the shipped
 *   repositories can insert their real row shapes afterwards (AC-3);
 * - a second `runSchemaBootstrap` on the complete schema issues only the two
 *   catalog `SELECT`s (AC-5);
 * - with fixture rows in `users`, `sessions` and `user_economy`, dropping
 *   `verification_tokens` recreates exactly that table, leaves the fixture rows
 *   untouched and accepts a real `PgVerificationTokenRepository.create` insert
 *   (AC-6);
 * - dropping `users.locked_until` (and, in a second fixture, also
 *   `users.failed_login_attempts`) is reported in the normative DDL order
 *   without any `ALTER`/`DROP` (AC-7).
 *
 * The suite skips only when neither container runtime is available; any failure
 * to start an available runtime fails the suite rather than hiding the proof.
 */

import { spawnSync } from 'node:child_process';

import { Client } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PgSessionRepository } from '../auth/session-repository.js';
import { PgUserRepository } from '../auth/user-repository.js';
import { PgVerificationTokenRepository } from '../auth/verification-token-repository.js';
import type { LogFields, LogSink } from '../observability/logging.js';
import { runSchemaBootstrap, type SchemaBootstrapDb } from './schema-bootstrap.js';
import { REQUIRED_TABLES, type RequiredTable } from './schema-contract.js';

const POSTGRES_IMAGE = 'docker.io/library/postgres:16-alpine';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SESSION_TOKEN = /^[0-9a-f]{64}$/;
const FIXED_NOW = 1_760_000_000_000;

const USERS_FIXTURE_SQL = `SELECT id, username, email, password_hash, verified,
         failed_login_attempts, locked_until, created_at, updated_at
    FROM users ORDER BY id`;

const SESSIONS_FIXTURE_SQL = `SELECT id, user_id, token_hash, expires_at, created_at, last_seen_at
    FROM sessions ORDER BY id`;

type ContainerRuntime = 'podman' | 'docker';

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  fields: LogFields;
}

interface RecordedQuery {
  text: string;
  values: unknown[] | undefined;
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

/** Wraps the real client so a run's statements can be inspected. */
function createRecordingDb(client: Client): {
  db: SchemaBootstrapDb;
  queries: RecordedQuery[];
} {
  const queries: RecordedQuery[] = [];
  return {
    queries,
    db: {
      async query(text, values) {
        queries.push({ text, values });
        return client.query(text, values);
      },
    },
  };
}

/** Returns the executed statements that would change the schema or data. */
function mutatingStatements(queries: readonly RecordedQuery[]): string[] {
  return queries
    .map((query) => query.text.trim())
    .filter((text) => /^(CREATE|ALTER|DROP|UPDATE)\b/i.test(text));
}

function requiredTable(name: string): RequiredTable {
  const table = REQUIRED_TABLES.find((candidate) => candidate.name === name);
  if (table === undefined) {
    throw new Error(`missing required table: ${name}`);
  }
  return table;
}

function column(
  table_name: string,
  column_name: string,
  data_type: string,
  is_nullable: string,
  column_default: string | null,
): ColumnRow {
  return { table_name, column_name, data_type, is_nullable, column_default };
}

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
  const name = `cubeclicker-schema-bootstrap-${process.pid}-${Date.now()}`;
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

/** Drops and recreates `public`, so every test starts from an empty schema. */
async function resetPublicSchema(client: Client): Promise<void> {
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
}

const containerRuntime = detectContainerRuntime();
const dbDescribe = containerRuntime === null ? describe.skip : describe;

dbDescribe('schema bootstrap on PostgreSQL', () => {
  let client: Client;
  let stopContainer: () => void;

  beforeAll(async () => {
    const database = startPostgres(containerRuntime as ContainerRuntime);
    stopContainer = database.stop;
    client = await waitForPostgres(database.connectionString);
    await client.query('SET search_path TO public');
  }, 120_000);

  afterAll(async () => {
    await client?.end().catch(() => undefined);
    stopContainer?.();
  }, 60_000);

  beforeEach(async () => {
    await resetPublicSchema(client);
  }, 30_000);

  describe('empty database', () => {
    it('creates the five tables and both users functional unique indexes (AC-3)', async () => {
      const { log, entries } = createLogRecorder();

      const result = await runSchemaBootstrap(client, { log, now: () => 0 });

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

      const tables = await client.query<{ table_name: string }>(
        `SELECT table_name
           FROM information_schema.tables
          WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
          ORDER BY table_name`,
      );
      expect(tables.rows.map((row) => row.table_name)).toEqual([
        'schema_migrations',
        'sessions',
        'user_economy',
        'users',
        'verification_tokens',
      ]);

      const indexes = await client.query<{ indexname: string }>(
        `SELECT indexname
           FROM pg_indexes
          WHERE schemaname = 'public' AND tablename = 'users'
          ORDER BY indexname`,
      );
      expect(indexes.rows.map((row) => row.indexname)).toEqual([
        'users_email_lower_uq',
        'users_pkey',
        'users_username_lower_uq',
      ]);
    }, 30_000);

    it('creates the pinned column defaults and NOT NULL attributes (AC-3)', async () => {
      await runSchemaBootstrap(client);

      const result = await client.query<ColumnRow>(
        `SELECT table_name, column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position`,
      );
      const byKey = new Map(
        result.rows.map((row) => [`${row.table_name}.${row.column_name}`, row]),
      );
      const keys = [
        'users.id',
        'sessions.id',
        'verification_tokens.id',
        'users.verified',
        'users.failed_login_attempts',
        'users.locked_until',
        'users.created_at',
        'users.updated_at',
        'sessions.created_at',
        'sessions.last_seen_at',
        'verification_tokens.expires_at',
        'user_economy.coins',
        'user_economy.clicks',
        'user_economy.faces_destroyed',
        'user_economy.cubes_destroyed',
        'user_economy.economy_revision',
        'user_economy.upgrades',
        'user_economy.lootboxes',
        'user_economy.keys',
        'user_economy.parts',
        'user_economy.appearance',
        'user_economy.customization_version',
        'user_economy.last_seen_at',
        'user_economy.updated_at',
        'schema_migrations.applied_at',
      ];

      expect(keys.map((key) => byKey.get(key))).toEqual([
        column('users', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
        column('sessions', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
        column('verification_tokens', 'id', 'uuid', 'NO', 'gen_random_uuid()'),
        column('users', 'verified', 'boolean', 'NO', 'false'),
        column('users', 'failed_login_attempts', 'integer', 'NO', '0'),
        column('users', 'locked_until', 'timestamp with time zone', 'YES', null),
        column('users', 'created_at', 'timestamp with time zone', 'NO', 'now()'),
        column('users', 'updated_at', 'timestamp with time zone', 'NO', 'now()'),
        column('sessions', 'created_at', 'timestamp with time zone', 'NO', 'now()'),
        column('sessions', 'last_seen_at', 'timestamp with time zone', 'NO', 'now()'),
        column('verification_tokens', 'expires_at', 'timestamp with time zone', 'NO', null),
        column('user_economy', 'coins', 'numeric', 'NO', '0'),
        column('user_economy', 'clicks', 'bigint', 'NO', '0'),
        column('user_economy', 'faces_destroyed', 'bigint', 'NO', '0'),
        column('user_economy', 'cubes_destroyed', 'bigint', 'NO', '0'),
        column('user_economy', 'economy_revision', 'bigint', 'NO', '0'),
        column('user_economy', 'upgrades', 'jsonb', 'NO', "'{}'::jsonb"),
        column('user_economy', 'lootboxes', 'integer', 'NO', '0'),
        column('user_economy', 'keys', 'integer', 'NO', '0'),
        column('user_economy', 'parts', 'jsonb', 'NO', "'{}'::jsonb"),
        column('user_economy', 'appearance', 'jsonb', 'NO', "'{}'::jsonb"),
        column('user_economy', 'customization_version', 'integer', 'NO', '2'),
        column('user_economy', 'last_seen_at', 'timestamp with time zone', 'NO', 'now()'),
        column('user_economy', 'updated_at', 'timestamp with time zone', 'NO', 'now()'),
        column('schema_migrations', 'applied_at', 'timestamp with time zone', 'NO', 'now()'),
      ]);

      const coins = await client.query<{
        numeric_precision: number;
        numeric_scale: number;
      }>(
        `SELECT numeric_precision, numeric_scale
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'user_economy'
            AND column_name = 'coins'`,
      );
      expect(coins.rows).toEqual([{ numeric_precision: 18, numeric_scale: 2 }]);
    }, 30_000);

    it('accepts the repository insert shapes and the user_economy defaults (AC-3)', async () => {
      await runSchemaBootstrap(client);

      const users = new PgUserRepository(client);
      const user = await users.create({
        username: 'ac3fixture',
        email: 'ac3fixture@example.test',
        passwordHash: 'argon2-fixture-hash',
      });
      expect(user.id).toMatch(UUID_V4);
      expect(user.username).toBe('ac3fixture');
      expect(user.email).toBe('ac3fixture@example.test');
      expect(user.passwordHash).toBe('argon2-fixture-hash');
      expect(user.verified).toBe(false);
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lockedUntil).toBeNull();

      const sessions = new PgSessionRepository(client, { now: () => FIXED_NOW });
      const session = await sessions.create(user.id, 3_600_000);
      expect(session.id).toMatch(UUID_V4);
      expect(session.token).toMatch(SESSION_TOKEN);
      expect(session.expiresAt).toBe(FIXED_NOW + 3_600_000);

      const tokens = new PgVerificationTokenRepository(client, {
        now: () => FIXED_NOW,
      });
      const token = await tokens.create({
        userId: user.id,
        tokenHash: 'ac3-verification-token-hash',
        expiresAt: FIXED_NOW + 86_400_000,
      });
      expect(token.id).toMatch(UUID_V4);
      expect(token.userId).toBe(user.id);
      expect(token.tokenHash).toBe('ac3-verification-token-hash');
      expect(token.expiresAt).toBe(FIXED_NOW + 86_400_000);
      expect(token.usedAt).toBeNull();

      await client.query('INSERT INTO user_economy (user_id) VALUES ($1)', [user.id]);
      const economy = await client.query(
        `SELECT user_id,
                coins::text AS coins,
                clicks::text AS clicks,
                faces_destroyed::text AS faces_destroyed,
                cubes_destroyed::text AS cubes_destroyed,
                economy_revision::text AS economy_revision,
                upgrades,
                lootboxes,
                keys,
                parts,
                appearance,
                customization_version
           FROM user_economy
          WHERE user_id = $1`,
        [user.id],
      );
      expect(economy.rows).toEqual([
        {
          user_id: user.id,
          coins: '0.00',
          clicks: '0',
          faces_destroyed: '0',
          cubes_destroyed: '0',
          economy_revision: '0',
          upgrades: {},
          lootboxes: 0,
          keys: 0,
          parts: {},
          appearance: {},
          customization_version: 2,
        },
      ]);
    }, 30_000);

    it('issues no DDL on a second bootstrap run over the complete schema (AC-5)', async () => {
      await runSchemaBootstrap(client);
      const { db, queries } = createRecordingDb(client);
      const { log, entries } = createLogRecorder();

      const result = await runSchemaBootstrap(db, { log, now: () => 0 });

      expect(result).toEqual({
        checked: 5,
        created: [],
        outdated: [],
        durationMs: 0,
      });
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
          fields: { checked: 5, created: 0, outdated: 0, durationMs: 0 },
        },
      ]);

      expect(
        queries.map((query) => query.text.trim().split(/\s+/)[0]),
      ).toEqual(['SELECT', 'SELECT']);
      expect(mutatingStatements(queries)).toEqual([]);
    }, 30_000);
  });

  describe('a single missing table', () => {
    it('recreates only verification_tokens and accepts a real token insert (AC-6)', async () => {
      await runSchemaBootstrap(client);

      const users = new PgUserRepository(client);
      const user = await users.create({
        username: 'ac6fixture',
        email: 'ac6fixture@example.test',
        passwordHash: 'argon2-fixture-hash',
      });
      const sessions = new PgSessionRepository(client, { now: () => FIXED_NOW });
      await sessions.create(user.id, 3_600_000);
      await client.query('INSERT INTO user_economy (user_id) VALUES ($1)', [user.id]);

      const usersBefore = await client.query(USERS_FIXTURE_SQL);
      const sessionsBefore = await client.query(SESSIONS_FIXTURE_SQL);
      const economyBefore = await client.query(
        'SELECT * FROM user_economy ORDER BY user_id',
      );

      await client.query('DROP TABLE verification_tokens');

      const { db, queries } = createRecordingDb(client);
      const { log, entries } = createLogRecorder();

      const result = await runSchemaBootstrap(db, { log, now: () => 0 });

      expect(result).toEqual({
        checked: 5,
        created: ['verification_tokens'],
        outdated: [],
        durationMs: 0,
      });
      expect(entries).toEqual([
        { level: 'info', event: 'db_schema_bootstrap_started', fields: { tables: 5 } },
        {
          level: 'info',
          event: 'db_schema_table_created',
          fields: { table: 'verification_tokens' },
        },
        { level: 'debug', event: 'db_schema_table_present', fields: { table: 'users' } },
        { level: 'debug', event: 'db_schema_table_present', fields: { table: 'sessions' } },
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
          fields: { checked: 5, created: 1, outdated: 0, durationMs: 0 },
        },
      ]);

      const statements = queries.map((query) => query.text.trim());
      const beginIndex = statements.indexOf('BEGIN');
      expect(statements.slice(beginIndex, beginIndex + 3)).toEqual([
        'BEGIN',
        requiredTable('verification_tokens').statements[0],
        'COMMIT',
      ]);

      expect((await client.query(USERS_FIXTURE_SQL)).rows).toEqual(
        usersBefore.rows,
      );
      expect((await client.query(SESSIONS_FIXTURE_SQL)).rows).toEqual(
        sessionsBefore.rows,
      );
      expect(
        (await client.query('SELECT * FROM user_economy ORDER BY user_id')).rows,
      ).toEqual(economyBefore.rows);

      const tokens = new PgVerificationTokenRepository(client, {
        now: () => FIXED_NOW,
      });
      const token = await tokens.create({
        userId: user.id,
        tokenHash: 'ac6-recreated-token-hash',
        expiresAt: FIXED_NOW + 3_600_000,
      });
      expect(token.id).toMatch(UUID_V4);
      expect(token.userId).toBe(user.id);
      expect(token.tokenHash).toBe('ac6-recreated-token-hash');
      expect(token.expiresAt).toBe(FIXED_NOW + 3_600_000);
      expect(token.usedAt).toBeNull();
    }, 30_000);
  });

  describe('an outdated existing table', () => {
    it('reports users.locked_until in DDL order without altering the table (AC-7)', async () => {
      await runSchemaBootstrap(client);
      await client.query('ALTER TABLE users DROP COLUMN locked_until');

      const { db, queries } = createRecordingDb(client);
      const { log, entries } = createLogRecorder();

      const result = await runSchemaBootstrap(db, { log, now: () => 0 });

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
      expect(mutatingStatements(queries)).toEqual([]);

      const columns = await client.query<{ column_name: string }>(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users'
          ORDER BY ordinal_position`,
      );
      expect(columns.rows.map((row) => row.column_name)).toEqual([
        'id',
        'username',
        'email',
        'password_hash',
        'verified',
        'failed_login_attempts',
        'created_at',
        'updated_at',
      ]);
    }, 30_000);

    it('joins two missing columns in the normative DDL order, not alphabetical (AC-7)', async () => {
      await runSchemaBootstrap(client);
      await client.query(
        `ALTER TABLE users
           DROP COLUMN failed_login_attempts,
           DROP COLUMN locked_until`,
      );

      const { db, queries } = createRecordingDb(client);
      const { log, entries } = createLogRecorder();

      const result = await runSchemaBootstrap(db, { log, now: () => 0 });

      expect(result.outdated).toEqual([
        {
          table: 'users',
          missingColumns: ['failed_login_attempts', 'locked_until'],
        },
      ]);
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
      expect(mutatingStatements(queries)).toEqual([]);

      const columns = await client.query<{ column_name: string }>(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users'
          ORDER BY ordinal_position`,
      );
      expect(columns.rows.map((row) => row.column_name)).toEqual([
        'id',
        'username',
        'email',
        'password_hash',
        'verified',
        'created_at',
        'updated_at',
      ]);
    }, 30_000);
  });
});
