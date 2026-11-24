import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MigrationClient } from './migrate-runner.js';

interface FakeClientState {
  config: { connectionString?: string };
  events: string[];
  applied: Set<string>;
  ended: boolean;
}

const mocks = vi.hoisted(() => ({
  clientInstances: [] as FakeClientState[],
  poolConstructions: [] as unknown[],
}));

vi.mock('pg', () => {
  class Client implements FakeClientState {
    config: { connectionString?: string };
    events: string[] = [];
    applied = new Set<string>();
    ended = false;

    constructor(config: { connectionString?: string }) {
      this.config = config;
      mocks.clientInstances.push(this);
    }

    async connect(): Promise<void> {
      this.events.push('connect');
    }

    async query(
      text: string,
      values?: unknown[],
    ): Promise<{ rows: Array<Record<string, unknown>>; rowCount: number }> {
      const normalized = text.trim();
      const upper = normalized.toUpperCase();
      const suffix = values === undefined ? '' : ` [${values.join(',')}]`;
      this.events.push(`query:${normalized}${suffix}`);

      if (upper.startsWith('CREATE TABLE IF NOT EXISTS SCHEMA_MIGRATIONS')) {
        return { rows: [], rowCount: 0 };
      }
      if (upper.startsWith('SELECT NAME FROM SCHEMA_MIGRATIONS')) {
        return {
          rows: [...this.applied].map((name) => ({ name })),
          rowCount: this.applied.size,
        };
      }
      if (upper === 'BEGIN' || upper === 'COMMIT' || upper === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
      }
      if (upper.startsWith('INSERT INTO SCHEMA_MIGRATIONS')) {
        this.applied.add(String(values?.[0]));
        return { rows: [], rowCount: 1 };
      }
      if (upper === 'FAIL') {
        throw new Error('migration failed: boom');
      }
      return { rows: [], rowCount: 0 };
    }

    async end(): Promise<void> {
      this.events.push('end');
      this.ended = true;
    }
  }

  class Pool {
    constructor(config: unknown) {
      mocks.poolConstructions.push(config);
      throw new Error('pg.Pool must not be used by the migration runner');
    }
  }

  return { Client, Pool };
});

import {
  MISSING_MIGRATION_URL_ERROR,
  resolveMigrationUrl,
  runMigrationsAgainst,
} from './migrate-runner.js';

const CREATE_TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())';
const SELECT_APPLIED_SQL = 'SELECT name FROM schema_migrations';

const ONE_MIGRATION = [
  { name: '001_init.sql', sql: 'CREATE TABLE users (id INT)' },
];

beforeEach(() => {
  mocks.clientInstances.length = 0;
  mocks.poolConstructions.length = 0;
});

describe('resolveMigrationUrl', () => {
  it('prefers DIRECT_DATABASE_URL over DATABASE_URL', () => {
    const url = resolveMigrationUrl({
      DIRECT_DATABASE_URL: 'postgres://direct.example:5432/app',
      DATABASE_URL: 'postgres://pooled.example:5432/app',
    });
    expect(url).toBe('postgres://direct.example:5432/app');
  });

  it('falls back to DATABASE_URL when the direct URL is absent', () => {
    const url = resolveMigrationUrl({
      DATABASE_URL: 'postgres://pooled.example:5432/app',
    });
    expect(url).toBe('postgres://pooled.example:5432/app');
  });

  it('treats an empty DIRECT_DATABASE_URL as absent', () => {
    const url = resolveMigrationUrl({
      DIRECT_DATABASE_URL: '',
      DATABASE_URL: 'postgres://pooled.example:5432/app',
    });
    expect(url).toBe('postgres://pooled.example:5432/app');
  });

  it('throws the pinned CLI error when neither URL is set', () => {
    expect(() => resolveMigrationUrl({})).toThrow(MISSING_MIGRATION_URL_ERROR);
    expect(() =>
      resolveMigrationUrl({ DIRECT_DATABASE_URL: '', DATABASE_URL: '' }),
    ).toThrow('DIRECT_DATABASE_URL or DATABASE_URL must be set');
  });
});

describe('runMigrationsAgainst', () => {
  it('runs BEGIN, the migration and COMMIT on one dedicated client', async () => {
    const applied = await runMigrationsAgainst(
      'postgres://direct.example:5432/app',
      { migrations: ONE_MIGRATION },
    );

    expect(applied).toEqual(['001_init.sql']);
    expect(mocks.poolConstructions).toEqual([]);
    expect(mocks.clientInstances).toHaveLength(1);

    const client = mocks.clientInstances[0];
    expect(client.config).toEqual({
      connectionString: 'postgres://direct.example:5432/app',
    });
    expect(client.events).toEqual([
      'connect',
      `query:${CREATE_TABLE_SQL}`,
      `query:${SELECT_APPLIED_SQL}`,
      'query:BEGIN',
      'query:CREATE TABLE users (id INT)',
      'query:INSERT INTO schema_migrations (name) VALUES ($1) [001_init.sql]',
      'query:COMMIT',
      'end',
    ]);
    expect(client.ended).toBe(true);
  });

  it('loads and applies the committed migrations when no list is injected', async () => {
    const applied = await runMigrationsAgainst('postgres://direct.example:5432/app');

    expect(applied).toEqual([
      '001_init.sql',
      '002_economy.sql',
      '003_upgrades.sql',
      '004_idle_accrual.sql',
      '005_spaceship_customization.sql',
      '006_granular_spaceship_parts.sql',
      '007_economy_revision.sql',
    ]);
    expect(mocks.clientInstances).toHaveLength(1);
  });

  it('propagates a migration failure after rollback and always ends the client', async () => {
    await expect(
      runMigrationsAgainst('postgres://direct.example:5432/app', {
        migrations: [{ name: '001_bad.sql', sql: 'FAIL' }],
      }),
    ).rejects.toThrow('migration failed: boom');

    const client = mocks.clientInstances[0];
    expect(client.events).toEqual([
      'connect',
      `query:${CREATE_TABLE_SQL}`,
      `query:${SELECT_APPLIED_SQL}`,
      'query:BEGIN',
      'query:FAIL',
      'query:ROLLBACK',
      'end',
    ]);
    expect(client.events).not.toContain('query:COMMIT');
    expect(client.ended).toBe(true);
  });

  it('ends the client when connect() fails', async () => {
    const events: string[] = [];
    const injected: MigrationClient = {
      async connect() {
        events.push('connect');
        throw new Error('connect failed');
      },
      async query() {
        events.push('query');
        return { rows: [], rowCount: 0 };
      },
      async end() {
        events.push('end');
      },
    };

    await expect(
      runMigrationsAgainst('postgres://direct.example:5432/app', {
        createClient: () => injected,
      }),
    ).rejects.toThrow('connect failed');
    expect(events).toEqual(['connect', 'end']);
    expect(mocks.clientInstances).toHaveLength(0);
  });

  it('does not let an end() failure mask a successful migration', async () => {
    const injected: MigrationClient = {
      async connect() {},
      async query(text: string) {
        if (text.trim().toUpperCase().startsWith('SELECT NAME')) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      },
      async end() {
        throw new Error('end failed');
      },
    };

    const applied = await runMigrationsAgainst(
      'postgres://direct.example:5432/app',
      { createClient: () => injected, migrations: ONE_MIGRATION },
    );
    expect(applied).toEqual(['001_init.sql']);
  });
});
