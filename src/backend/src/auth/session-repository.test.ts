import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  InMemorySessionRepository,
  PgSessionRepository,
  type Session,
  type SessionDb,
} from './session-repository.js';

const FIXED_NOW = 1_700_000_000_000;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SHA256_HEX = /^[0-9a-f]{64}$/;

function makeInMemory(now: () => number = () => FIXED_NOW) {
  return new InMemorySessionRepository({ now });
}

function sampleSession(overrides: Partial<Session> = {}): Session {
  return {
    id: '22222222-3333-4444-5555-666666666666',
    userId: '11111111-2222-3333-4444-555555555555',
    expiresAt: FIXED_NOW + TTL_MS,
    ...overrides,
  };
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

describe('InMemorySessionRepository', () => {
  it('create returns a 64-hex token, an id, and expiresAt = now + ttlMs', async () => {
    const repo = makeInMemory();
    const created = await repo.create('user-1', TTL_MS);
    expect(typeof created.id).toBe('string');
    expect(created.id.length).toBeGreaterThan(0);
    expect(created.token).toMatch(SHA256_HEX);
    expect(created.expiresAt).toBe(FIXED_NOW + TTL_MS);
  });

  it('create stores userId on the session', async () => {
    const repo = makeInMemory();
    const created = await repo.create('user-1', TTL_MS);
    const found = await repo.findById(created.id);
    expect(found?.userId).toBe('user-1');
  });

  it('create supports null userId (guest session)', async () => {
    const repo = makeInMemory();
    const created = await repo.create(null, TTL_MS);
    const found = await repo.findById(created.id);
    expect(found?.userId).toBeNull();
  });

  it('create produces distinct tokens on repeated calls', async () => {
    const repo = makeInMemory();
    const a = await repo.create('u', TTL_MS);
    const b = await repo.create('u', TTL_MS);
    expect(a.token).not.toBe(b.token);
    expect(a.id).not.toBe(b.id);
  });

  it('findById returns the created session', async () => {
    const repo = makeInMemory();
    const created = await repo.create('user-1', TTL_MS);
    const found = await repo.findById(created.id);
    expect(found).toEqual({
      id: created.id,
      userId: 'user-1',
      expiresAt: created.expiresAt,
    });
  });

  it('findById returns null for unknown id', async () => {
    const repo = makeInMemory();
    expect(await repo.findById('nope')).toBeNull();
  });

  it('findById returns null when expired', async () => {
    const repo = makeInMemory(() => FIXED_NOW);
    const created = await repo.create('user-1', 0);
    expect(await repo.findById(created.id)).toBeNull();
  });

  it('findByToken returns the session for the raw token', async () => {
    const repo = makeInMemory();
    const created = await repo.create('user-1', TTL_MS);
    const found = await repo.findByToken(created.token);
    expect(found?.id).toBe(created.id);
    expect(found?.userId).toBe('user-1');
    expect(found?.expiresAt).toBe(created.expiresAt);
  });

  it('findByToken returns null for unknown token', async () => {
    const repo = makeInMemory();
    await repo.create('user-1', TTL_MS);
    expect(await repo.findByToken('0'.repeat(64))).toBeNull();
  });

  it('findByToken returns null for expired session', async () => {
    const repo = makeInMemory(() => FIXED_NOW);
    const created = await repo.create('user-1', 0);
    expect(await repo.findByToken(created.token)).toBeNull();
  });

  it('findByToken does not expose the token hash', async () => {
    const repo = makeInMemory();
    const created = await repo.create('user-1', TTL_MS);
    const found = await repo.findByToken(created.token);
    expect(Object.keys(found ?? {})).toEqual(['id', 'userId', 'expiresAt']);
  });

  it('touch extends expiry to now + ttlMs', async () => {
    const repo = makeInMemory();
    const created = await repo.create('user-1', 1000);
    const result = await repo.touch(created.id, 5000);
    expect(result).toEqual({ expiresAt: FIXED_NOW + 5000 });
    const found = await repo.findById(created.id);
    expect(found?.expiresAt).toBe(FIXED_NOW + 5000);
  });

  it('touch throws for unknown session', async () => {
    const repo = makeInMemory();
    await expect(repo.touch('nope', TTL_MS)).rejects.toThrow('session not found');
  });

  it('touch throws for expired session', async () => {
    const repo = makeInMemory(() => FIXED_NOW);
    const created = await repo.create('user-1', 0);
    await expect(repo.touch(created.id, TTL_MS)).rejects.toThrow('session expired');
  });

  it('delete removes the session', async () => {
    const repo = makeInMemory();
    const created = await repo.create('user-1', TTL_MS);
    await repo.delete(created.id);
    expect(await repo.findById(created.id)).toBeNull();
    expect(await repo.findByToken(created.token)).toBeNull();
  });

  it('delete is a no-op for unknown id', async () => {
    const repo = makeInMemory();
    await expect(repo.delete('nope')).resolves.toBeUndefined();
  });

  it('deleteByUserId removes all sessions for that user', async () => {
    const repo = makeInMemory();
    const a = await repo.create('user-1', TTL_MS);
    const b = await repo.create('user-1', TTL_MS);
    const c = await repo.create('user-2', TTL_MS);
    await repo.deleteByUserId('user-1');
    expect(await repo.findById(a.id)).toBeNull();
    expect(await repo.findById(b.id)).toBeNull();
    expect(await repo.findById(c.id)).not.toBeNull();
  });

  it('deleteByUserId leaves other users untouched', async () => {
    const repo = makeInMemory();
    const c = await repo.create('user-2', TTL_MS);
    await repo.deleteByUserId('user-1');
    expect(await repo.findById(c.id)).not.toBeNull();
  });
});

describe('PgSessionRepository', () => {
  function makeDb(handler: (text: string, values?: unknown[]) => unknown) {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const db: SessionDb & { calls: typeof calls } = {
      calls,
      async query(text: string, values?: unknown[]) {
        calls.push({ text, values });
        const result = handler(text, values);
        if (result instanceof Error) throw result;
        return result as { rows: Array<Record<string, unknown>>; rowCount?: number | null };
      },
    };
    return db;
  }

  it('create issues INSERT with bound params and maps the row', async () => {
    const session = sampleSession();
    const tokenHashPlaceholder = 'placeholder';
    const db = makeDb(() => ({
      rows: [{ id: session.id, expires_at: new Date(session.expiresAt).toISOString() }],
      rowCount: 1,
    }));
    const repo = new PgSessionRepository(db, { now: () => FIXED_NOW });
    const created = await repo.create(session.userId, TTL_MS);
    expect(created.id).toBe(session.id);
    expect(created.token).toMatch(SHA256_HEX);
    expect(created.expiresAt).toBe(session.expiresAt);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].text).toContain('INSERT INTO sessions');
    expect(db.calls[0].text).toContain('$1');
    expect(db.calls[0].text).toContain('$2');
    expect(db.calls[0].text).toContain('$3');
    expect(db.calls[0].values?.[0]).toBe(session.userId);
    expect(String(db.calls[0].values?.[1])).toMatch(SHA256_HEX);
    expect(db.calls[0].values?.[2]).toBe(new Date(FIXED_NOW + TTL_MS).toISOString());
    void tokenHashPlaceholder;
  });

  it('create hashes the returned token consistently (sha256)', async () => {
    const session = sampleSession();
    const db = makeDb(() => ({
      rows: [{ id: session.id, expires_at: new Date(session.expiresAt).toISOString() }],
      rowCount: 1,
    }));
    const repo = new PgSessionRepository(db, { now: () => FIXED_NOW });
    const created = await repo.create(session.userId, TTL_MS);
    expect(sha256Hex(created.token)).toMatch(SHA256_HEX);
    // The persisted hash must equal sha256 of the returned raw token.
    expect(db.calls[0].values?.[1]).toBe(sha256Hex(created.token));
  });

  it('create throws when INSERT returns no row', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgSessionRepository(db, { now: () => FIXED_NOW });
    await expect(repo.create('u', TTL_MS)).rejects.toThrow('INSERT returned no row');
  });

  it('create supports null userId', async () => {
    const db = makeDb(() => ({
      rows: [{ id: 'sid-1', expires_at: new Date(FIXED_NOW + TTL_MS).toISOString() }],
      rowCount: 1,
    }));
    const repo = new PgSessionRepository(db, { now: () => FIXED_NOW });
    const created = await repo.create(null, TTL_MS);
    expect(db.calls[0].values?.[0]).toBeNull();
    expect(created.id).toBe('sid-1');
  });

  it('findById issues SELECT ... WHERE id = $1 with bound id', async () => {
    const session = sampleSession();
    const db = makeDb(() => ({
      rows: [{ id: session.id, user_id: session.userId, expires_at: new Date(session.expiresAt).toISOString() }],
      rowCount: 1,
    }));
    const repo = new PgSessionRepository(db, { now: () => FIXED_NOW });
    const found = await repo.findById(session.id);
    expect(found).toEqual(session);
    expect(db.calls[0].text).toContain('WHERE id = $1');
    expect(db.calls[0].values).toEqual([session.id]);
  });

  it('findById returns null when no row', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgSessionRepository(db, { now: () => FIXED_NOW });
    expect(await repo.findById('missing')).toBeNull();
  });

  it('findById returns null when expired', async () => {
    const session = sampleSession({ expiresAt: FIXED_NOW - 1 });
    const db = makeDb(() => ({
      rows: [{ id: session.id, user_id: session.userId, expires_at: new Date(session.expiresAt).toISOString() }],
      rowCount: 1,
    }));
    const repo = new PgSessionRepository(db, { now: () => FIXED_NOW });
    expect(await repo.findById(session.id)).toBeNull();
  });

  it('findById maps null user_id to null', async () => {
    const db = makeDb(() => ({
      rows: [{ id: 'sid-1', user_id: null, expires_at: new Date(FIXED_NOW + TTL_MS).toISOString() }],
      rowCount: 1,
    }));
    const repo = new PgSessionRepository(db, { now: () => FIXED_NOW });
    const found = await repo.findById('sid-1');
    expect(found?.userId).toBeNull();
  });

  it('findById maps Date expires_at', async () => {
    const expiresAt = FIXED_NOW + TTL_MS;
    const db = makeDb(() => ({
      rows: [{ id: 'sid-1', user_id: 'u', expires_at: new Date(expiresAt) }],
      rowCount: 1,
    }));
    const repo = new PgSessionRepository(db, { now: () => FIXED_NOW });
    const found = await repo.findById('sid-1');
    expect(found?.expiresAt).toBe(expiresAt);
  });

  it('findByToken hashes the input token and queries by token_hash', async () => {
    const rawToken = 'a'.repeat(64);
    const tokenHash = sha256Hex(rawToken);
    const session = sampleSession();
    const db = makeDb(() => ({
      rows: [{ id: session.id, user_id: session.userId, expires_at: new Date(session.expiresAt).toISOString() }],
      rowCount: 1,
    }));
    // Force the row's token_hash match by overriding handler to ignore input? Instead verify query values.
    const db2 = makeDb((text, values) => {
      expect(values?.[0]).toBe(tokenHash);
      return {
        rows: [{ id: session.id, user_id: session.userId, expires_at: new Date(session.expiresAt).toISOString() }],
        rowCount: 1,
      };
    });
    const repo = new PgSessionRepository(db2, { now: () => FIXED_NOW });
    const found = await repo.findByToken(rawToken);
    expect(found?.id).toBe(session.id);
    expect(db2.calls[0].text).toContain('WHERE token_hash = $1');
    expect(db2.calls[0].values).toEqual([tokenHash]);
    void db;
  });

  it('findByToken returns null when no row', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgSessionRepository(db, { now: () => FIXED_NOW });
    expect(await repo.findByToken('b'.repeat(64))).toBeNull();
  });

  it('findByToken returns null when expired', async () => {
    const session = sampleSession({ expiresAt: FIXED_NOW - 1 });
    const db = makeDb(() => ({
      rows: [{ id: session.id, user_id: session.userId, expires_at: new Date(session.expiresAt).toISOString() }],
      rowCount: 1,
    }));
    const repo = new PgSessionRepository(db, { now: () => FIXED_NOW });
    expect(await repo.findByToken('c'.repeat(64))).toBeNull();
  });

  it('touch checks existence then issues UPDATE with bound params', async () => {
    const session = sampleSession();
    let call = 0;
    const db = makeDb((text) => {
      call += 1;
      if (text.startsWith('SELECT')) {
        return {
          rows: [{ id: session.id, user_id: session.userId, expires_at: new Date(session.expiresAt).toISOString() }],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 1 };
    });
    const repo = new PgSessionRepository(db, { now: () => FIXED_NOW });
    const result = await repo.touch(session.id, 5000);
    expect(result).toEqual({ expiresAt: FIXED_NOW + 5000 });
    expect(db.calls).toHaveLength(2);
    const updateCall = db.calls[1];
    expect(updateCall.text).toContain('UPDATE sessions SET expires_at');
    expect(updateCall.values).toEqual([
      session.id,
      new Date(FIXED_NOW + 5000).toISOString(),
      new Date(FIXED_NOW).toISOString(),
    ]);
    void call;
  });

  it('touch throws session not found when missing', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgSessionRepository(db, { now: () => FIXED_NOW });
    await expect(repo.touch('missing', TTL_MS)).rejects.toThrow('session not found');
  });

  it('touch throws session expired when expired', async () => {
    const session = sampleSession({ expiresAt: FIXED_NOW - 1 });
    const db = makeDb(() => ({
      rows: [{ id: session.id, user_id: session.userId, expires_at: new Date(session.expiresAt).toISOString() }],
      rowCount: 1,
    }));
    const repo = new PgSessionRepository(db, { now: () => FIXED_NOW });
    await expect(repo.touch(session.id, TTL_MS)).rejects.toThrow('session expired');
  });

  it('delete issues DELETE ... WHERE id = $1', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 1 }));
    const repo = new PgSessionRepository(db, { now: () => FIXED_NOW });
    await repo.delete('sid-1');
    expect(db.calls[0].text).toContain('DELETE FROM sessions WHERE id = $1');
    expect(db.calls[0].values).toEqual(['sid-1']);
  });

  it('deleteByUserId issues DELETE ... WHERE user_id = $1', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 1 }));
    const repo = new PgSessionRepository(db, { now: () => FIXED_NOW });
    await repo.deleteByUserId('user-1');
    expect(db.calls[0].text).toContain('DELETE FROM sessions WHERE user_id = $1');
    expect(db.calls[0].values).toEqual(['user-1']);
  });

});
