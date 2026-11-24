/**
 * Schema contract catalog equivalence against real PostgreSQL (T2, AC-2).
 *
 * Applies the consolidated `schema.sql` and the compile-time contract DDL into
 * two separate schemas of a throwaway `postgres:16-alpine` container (Podman or
 * Docker, same helper pattern as `migration-006.test.ts`/`migration-007.test.ts`),
 * then compares normalized catalog metadata: columns (`data_type`,
 * `is_nullable`, `column_default`, numeric precision/scale), primary/foreign/
 * unique constraints and index definitions modulo schema qualification.
 *
 * The suite skips only when neither container runtime is available; any failure
 * to start an available runtime fails the suite rather than hiding the proof.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { REQUIRED_TABLES } from './schema-contract.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POSTGRES_IMAGE = 'docker.io/library/postgres:16-alpine';
const SCHEMA_FILE_SCHEMA = 'contract_from_schema_file';
const CONTRACT_DDL_SCHEMA = 'contract_from_required_tables';

const schemaSql = readFileSync(path.join(HERE, 'schema.sql'), 'utf8');

type ContainerRuntime = 'podman' | 'docker';

interface ColumnRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

interface ConstraintRow {
  table_name: string;
  constraint_name: string;
  constraint_type: string;
  definition: string;
}

interface IndexRow {
  table_name: string;
  index_name: string;
  is_unique: boolean;
  is_primary: boolean;
  definition: string;
}

interface Catalog {
  tables: string[];
  columns: ColumnRow[];
  constraints: ConstraintRow[];
  indexes: IndexRow[];
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
  const name = `cubeclicker-schema-contract-${process.pid}-${Date.now()}`;
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

/** Drops the schema qualifier so the two applications compare structurally. */
function normalizeDefinition(definition: string, schema: string): string {
  return definition
    .split(`${schema}.`)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

async function readCatalog(client: Client, schema: string): Promise<Catalog> {
  // A search_path containing only pg_catalog makes pg_get_*_def qualify every
  // user-schema object, so normalization is symmetric for both applications.
  await client.query('SET search_path TO pg_catalog');

  const tables = await client.query<{ table_name: string }>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
    [schema],
  );
  const columns = await client.query<ColumnRow>(
    `SELECT table_name, column_name, data_type, is_nullable, column_default,
            numeric_precision, numeric_scale
       FROM information_schema.columns
      WHERE table_schema = $1
      ORDER BY table_name, column_name`,
    [schema],
  );
  const constraints = await client.query<ConstraintRow>(
    `SELECT rel.relname AS table_name,
            con.conname AS constraint_name,
            con.contype AS constraint_type,
            pg_get_constraintdef(con.oid) AS definition
       FROM pg_constraint con
       JOIN pg_class rel ON rel.oid = con.conrelid
       JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      WHERE ns.nspname = $1 AND con.contype IN ('p', 'f', 'u')
      ORDER BY rel.relname, con.conname`,
    [schema],
  );
  const indexes = await client.query<IndexRow>(
    `SELECT tbl.relname AS table_name,
            idx.relname AS index_name,
            ind.indisunique AS is_unique,
            ind.indisprimary AS is_primary,
            pg_get_indexdef(ind.indexrelid) AS definition
       FROM pg_index ind
       JOIN pg_class idx ON idx.oid = ind.indexrelid
       JOIN pg_class tbl ON tbl.oid = ind.indrelid
       JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
      WHERE ns.nspname = $1
      ORDER BY tbl.relname, idx.relname`,
    [schema],
  );

  return {
    tables: tables.rows.map((row) => row.table_name),
    columns: columns.rows,
    constraints: constraints.rows.map((row) => ({
      ...row,
      definition: normalizeDefinition(row.definition, schema),
    })),
    indexes: indexes.rows.map((row) => ({
      ...row,
      definition: normalizeDefinition(row.definition, schema),
    })),
  };
}

const containerRuntime = detectContainerRuntime();
const dbDescribe = containerRuntime === null ? describe.skip : describe;

dbDescribe('schema contract catalog equivalence on PostgreSQL', () => {
  let client: Client;
  let stopContainer: () => void;
  let fromSchemaFile: Catalog;
  let fromContractDdl: Catalog;

  beforeAll(async () => {
    const database = startPostgres(containerRuntime as ContainerRuntime);
    stopContainer = database.stop;
    client = await waitForPostgres(database.connectionString);

    await client.query(`DROP SCHEMA IF EXISTS ${SCHEMA_FILE_SCHEMA} CASCADE`);
    await client.query(`CREATE SCHEMA ${SCHEMA_FILE_SCHEMA}`);
    await client.query(`SET search_path TO ${SCHEMA_FILE_SCHEMA}`);
    await client.query(schemaSql);

    await client.query(`DROP SCHEMA IF EXISTS ${CONTRACT_DDL_SCHEMA} CASCADE`);
    await client.query(`CREATE SCHEMA ${CONTRACT_DDL_SCHEMA}`);
    await client.query(`SET search_path TO ${CONTRACT_DDL_SCHEMA}`);
    for (const table of REQUIRED_TABLES) {
      for (const statement of table.statements) {
        await client.query(statement);
      }
    }

    fromSchemaFile = await readCatalog(client, SCHEMA_FILE_SCHEMA);
    fromContractDdl = await readCatalog(client, CONTRACT_DDL_SCHEMA);
  }, 120_000);

  afterAll(async () => {
    await client?.end().catch(() => undefined);
    stopContainer?.();
  }, 60_000);

  it('creates the same five tables in both schemas', () => {
    expect(fromSchemaFile.tables).toEqual([
      'schema_migrations',
      'sessions',
      'user_economy',
      'users',
      'verification_tokens',
    ]);
    expect(fromContractDdl.tables).toEqual(fromSchemaFile.tables);
  });

  it('produces identical normalized columns', () => {
    expect(fromSchemaFile.columns).toHaveLength(37);
    expect(fromContractDdl.columns).toEqual(fromSchemaFile.columns);

    expect(fromSchemaFile.columns.find((column) => column.column_name === 'id')).toEqual({
      table_name: 'sessions',
      column_name: 'id',
      data_type: 'uuid',
      is_nullable: 'NO',
      column_default: 'gen_random_uuid()',
      numeric_precision: null,
      numeric_scale: null,
    });
    expect(
      fromSchemaFile.columns.find(
        (column) =>
          column.table_name === 'verification_tokens' && column.column_name === 'id',
      ),
    ).toEqual({
      table_name: 'verification_tokens',
      column_name: 'id',
      data_type: 'uuid',
      is_nullable: 'NO',
      column_default: 'gen_random_uuid()',
      numeric_precision: null,
      numeric_scale: null,
    });
    expect(
      fromSchemaFile.columns.find(
        (column) => column.table_name === 'user_economy' && column.column_name === 'coins',
      ),
    ).toEqual({
      table_name: 'user_economy',
      column_name: 'coins',
      data_type: 'numeric',
      is_nullable: 'NO',
      column_default: '0',
      numeric_precision: 18,
      numeric_scale: 2,
    });
    expect(
      fromSchemaFile.columns.find(
        (column) =>
          column.table_name === 'user_economy' &&
          column.column_name === 'customization_version',
      ),
    ).toEqual({
      table_name: 'user_economy',
      column_name: 'customization_version',
      data_type: 'integer',
      is_nullable: 'NO',
      column_default: '2',
      numeric_precision: 32,
      numeric_scale: 0,
    });
    expect(
      fromSchemaFile.columns.find(
        (column) =>
          column.table_name === 'verification_tokens' && column.column_name === 'expires_at',
      ),
    ).toEqual({
      table_name: 'verification_tokens',
      column_name: 'expires_at',
      data_type: 'timestamp with time zone',
      is_nullable: 'NO',
      column_default: null,
      numeric_precision: null,
      numeric_scale: null,
    });
    expect(
      fromSchemaFile.columns.find(
        (column) => column.table_name === 'users' && column.column_name === 'locked_until',
      ),
    ).toEqual({
      table_name: 'users',
      column_name: 'locked_until',
      data_type: 'timestamp with time zone',
      is_nullable: 'YES',
      column_default: null,
      numeric_precision: null,
      numeric_scale: null,
    });
  });

  it('produces identical normalized primary, foreign and unique constraints', () => {
    expect(fromSchemaFile.constraints).toHaveLength(10);
    expect(fromContractDdl.constraints).toEqual(fromSchemaFile.constraints);

    expect(fromSchemaFile.constraints).toEqual([
      {
        table_name: 'schema_migrations',
        constraint_name: 'schema_migrations_pkey',
        constraint_type: 'p',
        definition: 'PRIMARY KEY (name)',
      },
      {
        table_name: 'sessions',
        constraint_name: 'sessions_pkey',
        constraint_type: 'p',
        definition: 'PRIMARY KEY (id)',
      },
      {
        table_name: 'sessions',
        constraint_name: 'sessions_token_hash_key',
        constraint_type: 'u',
        definition: 'UNIQUE (token_hash)',
      },
      {
        table_name: 'sessions',
        constraint_name: 'sessions_user_id_fkey',
        constraint_type: 'f',
        definition: 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
      },
      {
        table_name: 'user_economy',
        constraint_name: 'user_economy_pkey',
        constraint_type: 'p',
        definition: 'PRIMARY KEY (user_id)',
      },
      {
        table_name: 'user_economy',
        constraint_name: 'user_economy_user_id_fkey',
        constraint_type: 'f',
        definition: 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
      },
      {
        table_name: 'users',
        constraint_name: 'users_pkey',
        constraint_type: 'p',
        definition: 'PRIMARY KEY (id)',
      },
      {
        table_name: 'verification_tokens',
        constraint_name: 'verification_tokens_pkey',
        constraint_type: 'p',
        definition: 'PRIMARY KEY (id)',
      },
      {
        table_name: 'verification_tokens',
        constraint_name: 'verification_tokens_token_hash_key',
        constraint_type: 'u',
        definition: 'UNIQUE (token_hash)',
      },
      {
        table_name: 'verification_tokens',
        constraint_name: 'verification_tokens_user_id_fkey',
        constraint_type: 'f',
        definition: 'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
      },
    ]);
  });

  it('produces identical normalized index definitions, including the functional users indexes', () => {
    expect(fromSchemaFile.indexes).toHaveLength(9);
    expect(fromContractDdl.indexes).toEqual(fromSchemaFile.indexes);

    expect(fromSchemaFile.indexes.map((index) => index.index_name)).toEqual([
      'schema_migrations_pkey',
      'sessions_pkey',
      'sessions_token_hash_key',
      'user_economy_pkey',
      'users_email_lower_uq',
      'users_pkey',
      'users_username_lower_uq',
      'verification_tokens_pkey',
      'verification_tokens_token_hash_key',
    ]);
    expect(
      fromSchemaFile.indexes
        .filter((index) => index.index_name.endsWith('_lower_uq'))
        .map((index) => index.definition),
    ).toEqual([
      'CREATE UNIQUE INDEX users_email_lower_uq ON users USING btree (lower(email))',
      'CREATE UNIQUE INDEX users_username_lower_uq ON users USING btree (lower(username))',
    ]);
  });
});
