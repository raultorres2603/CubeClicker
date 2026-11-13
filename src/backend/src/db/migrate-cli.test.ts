import { describe, expect, it, vi } from 'vitest';

import type { MigrationClient } from './migrate-runner.js';
import { migrateFromEnv, runMigrateCli } from './migrate-cli.js';

const ONE_MIGRATION = [
  { name: '001_init.sql', sql: 'CREATE TABLE users (id INT)' },
];
const TWO_MIGRATIONS = [
  { name: '001_init.sql', sql: 'CREATE TABLE users (id INT)' },
  { name: '002_add.sql', sql: 'ALTER TABLE users ADD COLUMN email TEXT' },
];

interface FakeClientEntry {
  client: MigrationClient;
  connectionString: string;
  calls: string[];
  applied: Set<string>;
}

function makeClient(connectionString: string): FakeClientEntry {
  const calls: string[] = [];
  const applied = new Set<string>();
  const client: MigrationClient = {
    async connect() {
      calls.push('CONNECT');
    },
    async query(text: string, values?: unknown[]) {
      const upper = text.trim().toUpperCase();
      calls.push(upper);
      if (upper.startsWith('CREATE TABLE IF NOT EXISTS SCHEMA_MIGRATIONS')) {
        return { rows: [], rowCount: 0 };
      }
      if (upper.startsWith('SELECT NAME FROM SCHEMA_MIGRATIONS')) {
        return {
          rows: [...applied].map((name) => ({ name })),
          rowCount: applied.size,
        };
      }
      if (upper === 'BEGIN' || upper === 'COMMIT' || upper === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      if (upper.startsWith('INSERT INTO SCHEMA_MIGRATIONS')) {
        applied.add(String(values?.[0]));
        return { rows: [], rowCount: 1 };
      }
      if (upper === 'FAIL') {
        throw new Error('migration failed: boom');
      }
      return { rows: [], rowCount: 0 };
    },
    async end() {
      calls.push('END');
    },
  };
  return { client, connectionString, calls, applied };
}

function createClientFactory(entries: FakeClientEntry[]) {
  return (connectionString: string): MigrationClient => {
    const entry = makeClient(connectionString);
    entries.push(entry);
    return entry.client;
  };
}

describe('migrateFromEnv', () => {
  it('runs migrations against the direct URL through the runner', async () => {
    const entries: FakeClientEntry[] = [];
    const createClient = vi.fn(createClientFactory(entries));

    const applied = await migrateFromEnv(
      {
        DIRECT_DATABASE_URL: 'postgres://direct.example:5432/app',
        DATABASE_URL: 'postgres://pooled.example:5432/app',
      },
      { createClient, migrations: ONE_MIGRATION },
    );

    expect(applied).toEqual(['001_init.sql']);
    expect(createClient).toHaveBeenCalledWith(
      'postgres://direct.example:5432/app',
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].calls).toEqual([
      'CONNECT',
      'CREATE TABLE IF NOT EXISTS SCHEMA_MIGRATIONS (NAME TEXT PRIMARY KEY, APPLIED_AT TIMESTAMPTZ NOT NULL DEFAULT NOW())',
      'SELECT NAME FROM SCHEMA_MIGRATIONS',
      'BEGIN',
      'CREATE TABLE USERS (ID INT)',
      'INSERT INTO SCHEMA_MIGRATIONS (NAME) VALUES ($1)',
      'COMMIT',
      'END',
    ]);
  });

  it('throws the pinned error when no URL is configured', async () => {
    await expect(migrateFromEnv({})).rejects.toThrow(
      'DIRECT_DATABASE_URL or DATABASE_URL must be set',
    );
  });
});

describe('runMigrateCli --list', () => {
  it('prints the committed migration names without opening a database connection', async () => {
    const lines: string[] = [];
    const createClient = vi.fn(createClientFactory([]));

    const code = await runMigrateCli(['--list'], {}, {
      createClient,
      log: (message) => lines.push(message),
    });

    expect(code).toBe(0);
    expect(lines).toEqual([
      '001_init.sql',
      '002_economy.sql',
      '003_upgrades.sql',
      '004_idle_accrual.sql',
      '005_spaceship_customization.sql',
      '006_granular_spaceship_parts.sql',
      '007_economy_revision.sql',
    ]);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('uses the injected listing when provided', async () => {
    const lines: string[] = [];

    const code = await runMigrateCli(['--list'], {}, {
      loadMigrations: () => [
        { name: '001_init.sql', sql: 'SELECT 1' },
        { name: '002_add.sql', sql: 'SELECT 2' },
      ],
      log: (message) => lines.push(message),
    });

    expect(code).toBe(0);
    expect(lines).toEqual(['001_init.sql', '002_add.sql']);
  });
});

describe('runMigrateCli run path', () => {
  it('applies pending migrations and logs each applied name', async () => {
    const lines: string[] = [];
    const entries: FakeClientEntry[] = [];

    const code = await runMigrateCli([], { DATABASE_URL: 'postgres://pooled.example:5432/app' }, {
      createClient: createClientFactory(entries),
      migrations: TWO_MIGRATIONS,
      log: (message) => lines.push(message),
    });

    expect(code).toBe(0);
    expect(lines).toEqual(['Applied 001_init.sql', 'Applied 002_add.sql']);
    expect(entries).toHaveLength(1);
    expect(entries[0].connectionString).toBe(
      'postgres://pooled.example:5432/app',
    );
  });

  it('reports that there is nothing to apply', async () => {
    const lines: string[] = [];

    const code = await runMigrateCli([], { DATABASE_URL: 'postgres://pooled.example:5432/app' }, {
      createClient: createClientFactory([]),
      migrations: [],
      log: (message) => lines.push(message),
    });

    expect(code).toBe(0);
    expect(lines).toEqual(['No pending migrations.']);
  });

  it('returns exit code 1 and logs the cause when no URL is configured', async () => {
    const logError = vi.fn<(message: string, error: unknown) => void>();

    const code = await runMigrateCli([], {}, {
      log: () => undefined,
      logError,
    });

    expect(code).toBe(1);
    expect(logError).toHaveBeenCalledTimes(1);
    const [message, error] = logError.mock.calls[0];
    expect(message).toBe('Failed to apply database migrations.');
    expect((error as Error).message).toBe(
      'DIRECT_DATABASE_URL or DATABASE_URL must be set',
    );
  });

  it('returns exit code 1 when the migration itself fails', async () => {
    const logError = vi.fn<(message: string, error: unknown) => void>();
    const entries: FakeClientEntry[] = [];

    const code = await runMigrateCli([], { DATABASE_URL: 'postgres://pooled.example:5432/app' }, {
      createClient: createClientFactory(entries),
      migrations: [{ name: '001_bad.sql', sql: 'FAIL' }],
      log: () => undefined,
      logError,
    });

    expect(code).toBe(1);
    expect(logError).toHaveBeenCalledTimes(1);
    const [message, error] = logError.mock.calls[0];
    expect(message).toBe('Failed to apply database migrations.');
    expect((error as Error).message).toBe('migration failed: boom');
    expect(entries[0].calls).toContain('ROLLBACK');
    expect(entries[0].calls[entries[0].calls.length - 1]).toBe('END');
  });
});
