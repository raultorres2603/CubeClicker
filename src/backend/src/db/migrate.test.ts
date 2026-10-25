import { describe, expect, it, vi } from 'vitest';

import { loadMigrations, runMigrations, type MigrationDb } from './migrate.js';

function makeDb() {
  const applied = new Set<string>();
  const query = vi.fn(async (text: string, values?: unknown[]) => {
    const t = text.trim().toUpperCase();
    if (t.startsWith('CREATE TABLE IF NOT EXISTS SCHEMA_MIGRATIONS')) {
      return { rows: [], rowCount: 0 };
    }
    if (t.startsWith('SELECT NAME FROM SCHEMA_MIGRATIONS')) {
      return {
        rows: [...applied].map((name) => ({ name })),
        rowCount: applied.size,
      };
    }
    if (t === 'BEGIN' || t === 'COMMIT' || t === 'ROLLBACK') {
      return { rows: [], rowCount: 0 };
    }
    if (t.startsWith('INSERT INTO SCHEMA_MIGRATIONS')) {
      applied.add(String(values?.[0]));
      return { rows: [], rowCount: 1 };
    }
    if (t.includes('INVALID')) {
      throw new Error('migration failed: invalid sql');
    }
    // Treat any other statement (the migration body) as success.
    return { rows: [], rowCount: 0 };
  });
  return { db: { query } as unknown as MigrationDb, query, applied };
}

describe('loadMigrations', () => {
  it('loads the committed 001_init.sql migration', () => {
    const migrations = loadMigrations();
    const names = migrations.map((m) => m.name);
    expect(names).toContain('001_init.sql');
    const init = migrations.find((m) => m.name === '001_init.sql');
    expect(init).toBeDefined();
    expect(init!.sql).toContain('CREATE TABLE');
    expect(init!.sql).toContain('users');
    expect(init!.sql).toContain('lower(username)');
    expect(init!.sql).toContain('lower(email)');
  });
});

describe('runMigrations', () => {
  it('applies pending migrations and records them', async () => {
    const { db, query, applied } = makeDb();
    const migrations = [{ name: '001_init.sql', sql: 'CREATE TABLE users (id INT)' }];
    const result = await runMigrations(db, { migrations });
    expect(result).toEqual(['001_init.sql']);
    expect(applied.has('001_init.sql')).toBe(true);
    // BEGIN/COMMIT issued
    const calls = query.mock.calls.map((c) => String(c[0]).trim().toUpperCase());
    expect(calls).toContain('BEGIN');
    expect(calls).toContain('COMMIT');
  });

  it('is idempotent: a second run applies nothing', async () => {
    const { db } = makeDb();
    const migrations = [{ name: '001_init.sql', sql: 'CREATE TABLE users (id INT)' }];
    await runMigrations(db, { migrations });
    const second = await runMigrations(db, { migrations });
    expect(second).toEqual([]);
  });

  it('applies multiple migrations in order', async () => {
    const { db } = makeDb();
    const migrations = [
      { name: '001_init.sql', sql: 'CREATE TABLE a (id INT)' },
      { name: '002_add.sql', sql: 'CREATE TABLE b (id INT)' },
    ];
    const result = await runMigrations(db, { migrations });
    expect(result).toEqual(['001_init.sql', '002_add.sql']);
  });

  it('skips already-applied migrations in a mixed list', async () => {
    const { db } = makeDb();
    const migrations = [{ name: '001_init.sql', sql: 'CREATE TABLE a (id INT)' }];
    await runMigrations(db, { migrations });
    const more = [
      { name: '001_init.sql', sql: 'CREATE TABLE a (id INT)' },
      { name: '002_add.sql', sql: 'CREATE TABLE b (id INT)' },
    ];
    const result = await runMigrations(db, { migrations: more });
    expect(result).toEqual(['002_add.sql']);
  });

  it('aborts and rolls back on failure', async () => {
    const { db, query } = makeDb();
    const migrations = [{ name: '001_bad.sql', sql: 'INVALID STATEMENT' }];
    await expect(runMigrations(db, { migrations })).rejects.toThrow('migration failed: invalid sql');
    const calls = query.mock.calls.map((c) => String(c[0]).trim().toUpperCase());
    expect(calls).toContain('ROLLBACK');
    // Not recorded
    const select = await db.query('SELECT name FROM schema_migrations');
    expect(select.rows).toHaveLength(0);
  });

  it('does not apply later migrations after a failure', async () => {
    const { db } = makeDb();
    const migrations = [
      { name: '001_bad.sql', sql: 'INVALID STATEMENT' },
      { name: '002_ok.sql', sql: 'CREATE TABLE b (id INT)' },
    ];
    await expect(runMigrations(db, { migrations })).rejects.toThrow();
    const select = await db.query('SELECT name FROM schema_migrations');
    expect(select.rows).toHaveLength(0);
  });

  it('creates the schema_migrations table first', async () => {
    const { db, query } = makeDb();
    await runMigrations(db, { migrations: [] });
    const first = String(query.mock.calls[0][0]).trim().toUpperCase();
    expect(first).toContain('CREATE TABLE IF NOT EXISTS SCHEMA_MIGRATIONS');
  });

  it('loads migrations from disk when none are provided', async () => {
    const { db } = makeDb();
    const result = await runMigrations(db);
    expect(result).toContain('001_init.sql');
  });

  it('rethrows the original error even if rollback fails', async () => {
    const query = vi.fn(async (text: string) => {
      const t = text.trim().toUpperCase();
      if (t.startsWith('CREATE TABLE IF NOT EXISTS SCHEMA_MIGRATIONS')) {
        return { rows: [], rowCount: 0 };
      }
      if (t.startsWith('SELECT NAME FROM SCHEMA_MIGRATIONS')) {
        return { rows: [], rowCount: 0 };
      }
      if (t === 'BEGIN') {
        return { rows: [], rowCount: 0 };
      }
      if (t === 'ROLLBACK') {
        throw new Error('rollback boom');
      }
      if (t.includes('INVALID')) {
        throw new Error('migration failed: invalid sql');
      }
      return { rows: [], rowCount: 0 };
    });
    const db = { query } as unknown as MigrationDb;
    await expect(
      runMigrations(db, { migrations: [{ name: '001_bad.sql', sql: 'INVALID STATEMENT' }] }),
    ).rejects.toThrow('migration failed: invalid sql');
  });
});