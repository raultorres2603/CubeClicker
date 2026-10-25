import { describe, expect, it } from 'vitest';

import {
  InMemoryVerificationTokenRepository,
  PgVerificationTokenRepository,
  type VerificationToken,
  type VerificationTokenDb,
  hashVerificationToken,
} from './verification-token-repository.js';

const FIXED_NOW = 1_700_000_000_000;
const TTL_MS = 24 * 60 * 60 * 1000;

function makeInMemory(now: number = FIXED_NOW) {
  return new InMemoryVerificationTokenRepository({ now: () => now });
}

function sampleToken(overrides: Partial<VerificationToken> = {}): VerificationToken {
  return {
    id: 'tok-1',
    userId: 'user-1',
    tokenHash: 'a'.repeat(64),
    expiresAt: FIXED_NOW + TTL_MS,
    usedAt: null,
    ...overrides,
  };
}

function rowFor(token: VerificationToken): Record<string, unknown> {
  return {
    id: token.id,
    user_id: token.userId,
    token_hash: token.tokenHash,
    expires_at:
      token.expiresAt === null ? null : new Date(token.expiresAt).toISOString(),
    used_at: token.usedAt === null ? null : new Date(token.usedAt).toISOString(),
  };
}

describe('InMemoryVerificationTokenRepository', () => {
  it('create stores a token and returns a copy', async () => {
    const repo = makeInMemory();
    const created = await repo.create({
      userId: 'user-1',
      tokenHash: 'hash-1',
      expiresAt: FIXED_NOW + TTL_MS,
    });
    expect(created.userId).toBe('user-1');
    expect(created.tokenHash).toBe('hash-1');
    expect(created.expiresAt).toBe(FIXED_NOW + TTL_MS);
    expect(created.usedAt).toBeNull();
    expect(typeof created.id).toBe('string');
    expect(created.id.length).toBeGreaterThan(0);
    // copy
    created.userId = 'mutated';
    const found = await repo.findById(created.id);
    expect(found?.userId).toBe('user-1');
  });

  it('findById returns the created token', async () => {
    const repo = makeInMemory();
    const created = await repo.create({
      userId: 'user-1',
      tokenHash: 'hash-1',
      expiresAt: FIXED_NOW + TTL_MS,
    });
    expect(await repo.findById(created.id)).toEqual(created);
  });

  it('findById returns null for unknown id', async () => {
    const repo = makeInMemory();
    expect(await repo.findById('nope')).toBeNull();
  });

  it('findByToken finds by raw token (hashed internally)', async () => {
    const repo = makeInMemory();
    const { token } = await repo.issue('user-1', TTL_MS, FIXED_NOW);
    const found = await repo.findByToken(token);
    expect(found?.userId).toBe('user-1');
    expect(found?.tokenHash).toBe(hashVerificationToken(token));
  });

  it('findByToken finds by an already-hashed value', async () => {
    const repo = makeInMemory();
    const { token } = await repo.issue('user-1', TTL_MS, FIXED_NOW);
    const hash = hashVerificationToken(token);
    const found = await repo.findByToken(hash);
    expect(found?.userId).toBe('user-1');
  });

  it('findByToken returns null for unknown token', async () => {
    const repo = makeInMemory();
    await repo.issue('user-1', TTL_MS, FIXED_NOW);
    expect(await repo.findByToken('deadbeef')).toBeNull();
  });

  it('markUsed by id sets usedAt', async () => {
    const repo = makeInMemory();
    const { token } = await repo.issue('user-1', TTL_MS, FIXED_NOW);
    const record = await repo.findByToken(token);
    expect(record).not.toBeNull();
    await repo.markUsed(record!.id, FIXED_NOW + 1000);
    const updated = await repo.findByToken(token);
    expect(updated?.usedAt).toBe(FIXED_NOW + 1000);
  });

  it('markUsed by raw token sets usedAt', async () => {
    const repo = makeInMemory();
    const { token } = await repo.issue('user-1', TTL_MS, FIXED_NOW);
    await repo.markUsed(token, FIXED_NOW + 2000);
    const updated = await repo.findByToken(token);
    expect(updated?.usedAt).toBe(FIXED_NOW + 2000);
  });

  it('markUsed is a no-op for unknown token', async () => {
    const repo = makeInMemory();
    await repo.markUsed('nope', FIXED_NOW);
    // no throw
    expect(true).toBe(true);
  });

  it('markUsed defaults nowMs to injected clock', async () => {
    const repo = makeInMemory(FIXED_NOW);
    const { token } = await repo.issue('user-1', TTL_MS, FIXED_NOW);
    const record = await repo.findByToken(token);
    await repo.markUsed(record!.id);
    const updated = await repo.findByToken(token);
    expect(updated?.usedAt).toBe(FIXED_NOW);
  });

  it('deleteExpired removes expired tokens and returns count', async () => {
    const repo = makeInMemory();
    await repo.issue('user-1', TTL_MS, FIXED_NOW); // expires FIXED_NOW+TTL
    // issue an already-expired token by hand
    await repo.create({
      userId: 'user-2',
      tokenHash: 'expired-hash',
      expiresAt: FIXED_NOW - 1,
    });
    const deleted = await repo.deleteExpired(FIXED_NOW);
    expect(deleted).toBe(1);
    // the expired one gone
    expect(await repo.findByToken('expired-hash')).toBeNull();
  });

  it('deleteExpired keeps non-expired tokens', async () => {
    const repo = makeInMemory();
    const { token } = await repo.issue('user-1', TTL_MS, FIXED_NOW);
    const deleted = await repo.deleteExpired(FIXED_NOW);
    expect(deleted).toBe(0);
    expect(await repo.findByToken(token)).not.toBeNull();
  });

  it('deleteExpired uses injected clock when nowMs omitted', async () => {
    const repo = new InMemoryVerificationTokenRepository({ now: () => FIXED_NOW });
    await repo.create({
      userId: 'u',
      tokenHash: 'h',
      expiresAt: FIXED_NOW - 1,
    });
    const deleted = await repo.deleteExpired();
    expect(deleted).toBe(1);
  });

  it('issue returns a 64-hex raw token and matching expiry', async () => {
    const repo = makeInMemory();
    const result = await repo.issue('user-1', TTL_MS, FIXED_NOW);
    expect(result.expiresAt).toBe(FIXED_NOW + TTL_MS);
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    const record = await repo.findByToken(result.token);
    expect(record?.tokenHash).toBe(hashVerificationToken(result.token));
    expect(record?.tokenHash).not.toBe(result.token);
  });

  it('consume returns userId and marks token used', async () => {
    const repo = makeInMemory();
    const { token } = await repo.issue('user-1', TTL_MS, FIXED_NOW);
    const result = await repo.consume(token, FIXED_NOW);
    expect(result).toEqual({ userId: 'user-1' });
    const record = await repo.findByToken(token);
    expect(record?.usedAt).toBe(FIXED_NOW);
  });

  it('consume returns null for unknown token', async () => {
    const repo = makeInMemory();
    expect(await repo.consume('nope', FIXED_NOW)).toBeNull();
  });

  it('consume returns null for already-used token', async () => {
    const repo = makeInMemory();
    const { token } = await repo.issue('user-1', TTL_MS, FIXED_NOW);
    await repo.consume(token, FIXED_NOW);
    expect(await repo.consume(token, FIXED_NOW)).toBeNull();
  });

  it('consume returns null for expired token and leaves it unused', async () => {
    const repo = makeInMemory();
    const { token } = await repo.issue('user-1', TTL_MS, FIXED_NOW);
    const expiredNow = FIXED_NOW + TTL_MS + 1;
    expect(await repo.consume(token, expiredNow)).toBeNull();
    const record = await repo.findByToken(token);
    expect(record?.usedAt).toBeNull();
  });

  it('consume uses injected clock when nowMs omitted', async () => {
    const repo = makeInMemory(FIXED_NOW);
    const { token } = await repo.issue('user-1', TTL_MS, FIXED_NOW);
    expect(await repo.consume(token)).toEqual({ userId: 'user-1' });
  });

  it('invalidateForUser removes only that user tokens', async () => {
    const repo = makeInMemory();
    const { token: t1 } = await repo.issue('user-1', TTL_MS, FIXED_NOW);
    const { token: t2 } = await repo.issue('user-2', TTL_MS, FIXED_NOW);
    await repo.invalidateForUser('user-1');
    expect(await repo.findByToken(t1)).toBeNull();
    expect(await repo.findByToken(t2)).not.toBeNull();
  });

  it('create throws on duplicate tokenHash', async () => {
    const repo = makeInMemory();
    await repo.create({ userId: 'u', tokenHash: 'dup', expiresAt: FIXED_NOW + TTL_MS });
    await expect(
      repo.create({ userId: 'u2', tokenHash: 'dup', expiresAt: FIXED_NOW + TTL_MS }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('issue uses injected clock when nowMs omitted', async () => {
    const repo = makeInMemory(FIXED_NOW);
    const result = await repo.issue('user-1', TTL_MS);
    expect(result.expiresAt).toBe(FIXED_NOW + TTL_MS);
  });
});

describe('PgVerificationTokenRepository', () => {
  function makeDb(handler: (text: string, values?: unknown[]) => unknown) {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const db = {
      calls,
      async query(text: string, values?: unknown[]) {
        calls.push({ text, values });
        const result = handler(text, values);
        if (result instanceof Error) throw result;
        return result as { rows: Array<Record<string, unknown>>; rowCount?: number | null };
      },
    };
    return db as VerificationTokenDb & { calls: typeof calls };
  }

  it('create issues INSERT with bound params and maps row', async () => {
    const token = sampleToken();
    const db = makeDb(() => ({ rows: [rowFor(token)], rowCount: 1 }));
    const repo = new PgVerificationTokenRepository(db, { now: () => FIXED_NOW });
    const created = await repo.create({
      userId: token.userId,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
    });
    expect(created).toEqual(token);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].text).toContain('INSERT INTO verification_tokens');
    expect(db.calls[0].text).toContain('$1');
    expect(db.calls[0].text).toContain('$2');
    expect(db.calls[0].text).toContain('$3');
    expect(db.calls[0].values).toEqual([
      token.userId,
      token.tokenHash,
      new Date(token.expiresAt).toISOString(),
    ]);
  });

  it('create throws when INSERT returns no row', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgVerificationTokenRepository(db);
    await expect(
      repo.create({ userId: 'u', tokenHash: 'h', expiresAt: FIXED_NOW }),
    ).rejects.toThrow('INSERT returned no row');
  });

  it('findById issues SELECT ... WHERE id = $1', async () => {
    const token = sampleToken();
    const db = makeDb(() => ({ rows: [rowFor(token)], rowCount: 1 }));
    const repo = new PgVerificationTokenRepository(db);
    const found = await repo.findById(token.id);
    expect(found).toEqual(token);
    expect(db.calls[0].text).toContain('WHERE id = $1');
    expect(db.calls[0].values).toEqual([token.id]);
  });

  it('findById returns null when no row', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgVerificationTokenRepository(db);
    expect(await repo.findById('missing')).toBeNull();
  });

  it('findByToken direct (hashed input) issues one query', async () => {
    const token = sampleToken();
    const db = makeDb(() => ({ rows: [rowFor(token)], rowCount: 1 }));
    const repo = new PgVerificationTokenRepository(db);
    const found = await repo.findByToken(token.tokenHash);
    expect(found).toEqual(token);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].values).toEqual([token.tokenHash]);
  });

  it('findByToken raw hashes and issues second query', async () => {
    const token = sampleToken();
    const raw = 'raw-token-value';
    const hashed = hashVerificationToken(raw);
    // make sample token's hash match hashed
    const t = { ...token, tokenHash: hashed };
    const db = makeDb((text, values) => {
      if (values && values[0] === raw) return { rows: [], rowCount: 0 };
      return { rows: [rowFor(t)], rowCount: 1 };
    });
    const repo = new PgVerificationTokenRepository(db);
    const found = await repo.findByToken(raw);
    expect(found?.tokenHash).toBe(hashed);
    expect(db.calls).toHaveLength(2);
    expect(db.calls[0].values).toEqual([raw]);
    expect(db.calls[1].values).toEqual([hashed]);
  });

  it('findByToken returns null when absent', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgVerificationTokenRepository(db);
    expect(await repo.findByToken('nope')).toBeNull();
  });

  it('markUsed by id issues UPDATE with bound params', async () => {
    const token = sampleToken();
    const db = makeDb((text) => {
      if (text.startsWith('SELECT')) return { rows: [rowFor(token)], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const repo = new PgVerificationTokenRepository(db, { now: () => FIXED_NOW });
    await repo.markUsed(token.id, FIXED_NOW + 5);
    const updateCall = db.calls[db.calls.length - 1];
    expect(updateCall.text).toContain('UPDATE verification_tokens SET used_at');
    expect(updateCall.values?.[0]).toBe(token.id);
    expect(updateCall.values?.[1]).toBe(new Date(FIXED_NOW + 5).toISOString());
  });

  it('markUsed by raw token resolves then updates', async () => {
    const raw = 'raw-token-2';
    const hashed = hashVerificationToken(raw);
    const token = sampleToken({ tokenHash: hashed });
    const db = makeDb((text, values) => {
      if (text.includes('WHERE id = $1')) return { rows: [], rowCount: 0 };
      if (text.includes('WHERE token_hash = $1')) {
        if (values && values[0] === raw) return { rows: [], rowCount: 0 };
        return { rows: [rowFor(token)], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    const repo = new PgVerificationTokenRepository(db, { now: () => FIXED_NOW });
    await repo.markUsed(raw, FIXED_NOW + 7);
    const updateCall = db.calls[db.calls.length - 1];
    expect(updateCall.text).toContain('UPDATE verification_tokens SET used_at');
    expect(updateCall.values?.[0]).toBe(token.id);
  });

  it('markUsed is a no-op for unknown token', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgVerificationTokenRepository(db, { now: () => FIXED_NOW });
    await repo.markUsed('nope', FIXED_NOW);
    // no UPDATE call
    const updates = db.calls.filter((c) => c.text.includes('UPDATE'));
    expect(updates).toHaveLength(0);
  });

  it('markUsed defaults nowMs to injected clock', async () => {
    const token = sampleToken();
    const db = makeDb((text) => {
      if (text.startsWith('SELECT')) return { rows: [rowFor(token)], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const repo = new PgVerificationTokenRepository(db, { now: () => FIXED_NOW });
    await repo.markUsed(token.id);
    const updateCall = db.calls[db.calls.length - 1];
    expect(updateCall.values?.[1]).toBe(new Date(FIXED_NOW).toISOString());
  });

  it('deleteExpired issues DELETE with bound now and returns rowCount', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 3 }));
    const repo = new PgVerificationTokenRepository(db, { now: () => FIXED_NOW });
    const deleted = await repo.deleteExpired(FIXED_NOW + 10);
    expect(deleted).toBe(3);
    expect(db.calls[0].text).toContain('DELETE FROM verification_tokens');
    expect(db.calls[0].text).toContain('expires_at <= $1');
    expect(db.calls[0].values).toEqual([new Date(FIXED_NOW + 10).toISOString()]);
  });

  it('deleteExpired uses injected clock when nowMs omitted', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgVerificationTokenRepository(db, { now: () => FIXED_NOW });
    await repo.deleteExpired();
    expect(db.calls[0].values).toEqual([new Date(FIXED_NOW).toISOString()]);
  });

  it('deleteExpired returns 0 when rowCount null', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: null }));
    const repo = new PgVerificationTokenRepository(db);
    expect(await repo.deleteExpired(FIXED_NOW)).toBe(0);
  });

  it('issue inserts and returns raw token + expiry', async () => {
    // issue calls create which needs a returned row; provide row echoing by capturing last insert values via closure.
    let inserted: unknown[] | undefined;
    const db2 = {
      calls: [] as Array<{ text: string; values?: unknown[] }>,
      async query(text: string, values?: unknown[]) {
        (db2.calls as Array<{ text: string; values?: unknown[] }>).push({ text, values });
        if (text.includes('INSERT')) {
          inserted = values;
          const row = {
            id: 'tok-issued',
            user_id: values![0],
            token_hash: values![1],
            expires_at: values![2],
            used_at: null,
          };
          return { rows: [row], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    const repo = new PgVerificationTokenRepository(db2 as unknown as VerificationTokenDb, {
      now: () => FIXED_NOW,
    });
    const result = await repo.issue('user-1', TTL_MS);
    expect(result.expiresAt).toBe(FIXED_NOW + TTL_MS);
    expect(result.token).toMatch(/^[0-9a-f]{64}$/);
    expect(hashVerificationToken(result.token)).toBe(inserted![1]);
  });

  it('consume returns userId and marks used', async () => {
    const raw = 'consume-token';
    const hashed = hashVerificationToken(raw);
    const token = sampleToken({ tokenHash: hashed });
    const db = makeDb((text, values) => {
      if (text.includes('WHERE token_hash = $1')) {
        if (values && values[0] === raw) return { rows: [], rowCount: 0 };
        return { rows: [rowFor(token)], rowCount: 1 };
      }
      if (text.includes('WHERE id = $1')) return { rows: [rowFor(token)], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const repo = new PgVerificationTokenRepository(db, { now: () => FIXED_NOW });
    const result = await repo.consume(raw, FIXED_NOW);
    expect(result).toEqual({ userId: token.userId });
  });

  it('consume returns null for unknown token', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgVerificationTokenRepository(db);
    expect(await repo.consume('nope', FIXED_NOW)).toBeNull();
  });

  it('consume returns null for already-used token', async () => {
    const raw = 'used-token';
    const hashed = hashVerificationToken(raw);
    const token = sampleToken({ tokenHash: hashed, usedAt: FIXED_NOW - 1 });
    const db = makeDb((text, values) => {
      if (text.includes('WHERE token_hash = $1')) {
        if (values && values[0] === raw) return { rows: [], rowCount: 0 };
        return { rows: [rowFor(token)], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const repo = new PgVerificationTokenRepository(db, { now: () => FIXED_NOW });
    expect(await repo.consume(raw, FIXED_NOW)).toBeNull();
  });

  it('consume returns null for expired token', async () => {
    const raw = 'expired-token';
    const hashed = hashVerificationToken(raw);
    const token = sampleToken({ tokenHash: hashed, expiresAt: FIXED_NOW - 1 });
    const db = makeDb((text, values) => {
      if (text.includes('WHERE token_hash = $1')) {
        if (values && values[0] === raw) return { rows: [], rowCount: 0 };
        return { rows: [rowFor(token)], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const repo = new PgVerificationTokenRepository(db, { now: () => FIXED_NOW });
    expect(await repo.consume(raw, FIXED_NOW)).toBeNull();
  });

  it('invalidateForUser issues DELETE by user_id', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 2 }));
    const repo = new PgVerificationTokenRepository(db);
    await repo.invalidateForUser('user-1');
    expect(db.calls[0].text).toContain('DELETE FROM verification_tokens WHERE user_id = $1');
    expect(db.calls[0].values).toEqual(['user-1']);
  });

  it('maps used_at and expires_at from Date and string', async () => {
    const token = sampleToken({ usedAt: FIXED_NOW + 50, expiresAt: FIXED_NOW + 100 });
    const row = rowFor(token);
    row.expires_at = new Date(token.expiresAt);
    row.used_at = new Date(token.usedAt!).toISOString();
    const db = makeDb(() => ({ rows: [row], rowCount: 1 }));
    const repo = new PgVerificationTokenRepository(db);
    const found = await repo.findById(token.id);
    expect(found?.expiresAt).toBe(token.expiresAt);
    expect(found?.usedAt).toBe(token.usedAt);
  });

  it('maps null used_at', async () => {
    const token = sampleToken({ usedAt: null });
    const row = rowFor(token);
    row.used_at = null;
    const db = makeDb(() => ({ rows: [row], rowCount: 1 }));
    const repo = new PgVerificationTokenRepository(db);
    const found = await repo.findById(token.id);
    expect(found?.usedAt).toBeNull();
  });
});