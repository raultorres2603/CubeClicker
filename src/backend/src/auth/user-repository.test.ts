import { describe, expect, it } from 'vitest';

import {
  DuplicateUserError,
  InMemoryUserRepository,
  PgUserRepository,
  type User,
  type UserDb,
} from './user-repository.js';

const FIXED_NOW = 1_700_000_000_000;

function makeInMemory(): InMemoryUserRepository {
  return new InMemoryUserRepository({ now: () => FIXED_NOW });
}

function sampleUser(overrides: Partial<User> = {}): User {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    username: 'alice',
    email: 'alice@example.com',
    passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$abc',
    verified: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    ...overrides,
  };
}

function rowFor(user: User): Record<string, unknown> {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    password_hash: user.passwordHash,
    verified: user.verified,
    failed_login_attempts: user.failedLoginAttempts,
    locked_until:
      user.lockedUntil === null ? null : new Date(user.lockedUntil).toISOString(),
  };
}

describe('InMemoryUserRepository', () => {
  it('creates an unverified user with failedLoginAttempts 0', async () => {
    const repo = makeInMemory();
    const created = await repo.create({
      username: 'alice',
      email: 'alice@example.com',
      passwordHash: 'hash-1',
    });
    expect(created.username).toBe('alice');
    expect(created.email).toBe('alice@example.com');
    expect(created.passwordHash).toBe('hash-1');
    expect(created.verified).toBe(false);
    expect(created.failedLoginAttempts).toBe(0);
    expect(created.lockedUntil).toBeNull();
    expect(typeof created.id).toBe('string');
    expect(created.id.length).toBeGreaterThan(0);
  });

  it('findById returns the created user', async () => {
    const repo = makeInMemory();
    const created = await repo.create({
      username: 'alice',
      email: 'alice@example.com',
      passwordHash: 'hash-1',
    });
    const found = await repo.findById(created.id);
    expect(found).toEqual(created);
  });

  it('findById returns null for unknown id', async () => {
    const repo = makeInMemory();
    expect(await repo.findById('nope')).toBeNull();
  });

  it('findByUsername is case-insensitive', async () => {
    const repo = makeInMemory();
    await repo.create({ username: 'Alice', email: 'a@x.com', passwordHash: 'h' });
    const found = await repo.findByUsername('alice');
    expect(found?.username).toBe('Alice');
    const found2 = await repo.findByUsername('ALICE');
    expect(found2?.username).toBe('Alice');
  });

  it('findByUsername returns null when absent', async () => {
    const repo = makeInMemory();
    await repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' });
    expect(await repo.findByUsername('ghost')).toBeNull();
  });

  it('findByEmail is case-insensitive', async () => {
    const repo = makeInMemory();
    await repo.create({ username: 'alice', email: 'Alice@Example.com', passwordHash: 'h' });
    const found = await repo.findByEmail('alice@example.com');
    expect(found?.email).toBe('Alice@Example.com');
    const found2 = await repo.findByEmail('ALICE@EXAMPLE.COM');
    expect(found2?.email).toBe('Alice@Example.com');
  });

  it('findByEmail returns null when absent', async () => {
    const repo = makeInMemory();
    await repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' });
    expect(await repo.findByEmail('ghost@x.com')).toBeNull();
  });

  it('create throws DuplicateUserError on duplicate username (case-insensitive)', async () => {
    const repo = makeInMemory();
    await repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' });
    await expect(
      repo.create({ username: 'ALICE', email: 'b@x.com', passwordHash: 'h' }),
    ).rejects.toBeInstanceOf(DuplicateUserError);
    try {
      await repo.create({ username: 'ALICE', email: 'b@x.com', passwordHash: 'h' });
    } catch (e) {
      expect((e as DuplicateUserError).field).toBe('username');
    }
  });

  it('create throws DuplicateUserError on duplicate email (case-insensitive)', async () => {
    const repo = makeInMemory();
    await repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' });
    await expect(
      repo.create({ username: 'bob', email: 'A@X.COM', passwordHash: 'h' }),
    ).rejects.toBeInstanceOf(DuplicateUserError);
    try {
      await repo.create({ username: 'bob', email: 'A@X.COM', passwordHash: 'h' });
    } catch (e) {
      expect((e as DuplicateUserError).field).toBe('email');
    }
  });

  it('setVerified / updateVerification sets verified flag', async () => {
    const repo = makeInMemory();
    const created = await repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' });
    await repo.setVerified(created.id, true);
    const found = await repo.findById(created.id);
    expect(found?.verified).toBe(true);
    await repo.updateVerification(created.id, false);
    const found2 = await repo.findById(created.id);
    expect(found2?.verified).toBe(false);
  });

  it('updateVerification defaults to true', async () => {
    const repo = makeInMemory();
    const created = await repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' });
    await repo.updateVerification(created.id);
    const found = await repo.findById(created.id);
    expect(found?.verified).toBe(true);
  });

  it('updatePasswordHash changes the stored hash', async () => {
    const repo = makeInMemory();
    const created = await repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'old' });
    await repo.updatePasswordHash(created.id, 'new-hash');
    const found = await repo.findById(created.id);
    expect(found?.passwordHash).toBe('new-hash');
  });

  it('recordFailedLogin increments and locks on 5th attempt', async () => {
    const repo = makeInMemory();
    const created = await repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' });
    let result;
    for (let i = 0; i < 4; i++) {
      result = await repo.recordFailedLogin(created.id);
      expect(result.attempts).toBe(i + 1);
      expect(result.lockedUntil).toBeNull();
    }
    result = await repo.recordFailedLogin(created.id);
    expect(result.attempts).toBe(5);
    expect(result.lockedUntil).toBe(FIXED_NOW + 15 * 60 * 1000);
    const found = await repo.findById(created.id);
    expect(found?.failedLoginAttempts).toBe(5);
    expect(found?.lockedUntil).toBe(FIXED_NOW + 15 * 60 * 1000);
  });

  it('recordFailedLogin returns zeros for unknown user', async () => {
    const repo = makeInMemory();
    const result = await repo.recordFailedLogin('nope');
    expect(result).toEqual({ attempts: 0, lockedUntil: null });
  });

  it('resetFailedLogin clears attempts and lock', async () => {
    const repo = makeInMemory();
    const created = await repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' });
    for (let i = 0; i < 5; i++) {
      await repo.recordFailedLogin(created.id);
    }
    await repo.resetFailedLogin(created.id);
    const found = await repo.findById(created.id);
    expect(found?.failedLoginAttempts).toBe(0);
    expect(found?.lockedUntil).toBeNull();
  });

  it('create returns a copy, not the internal reference', async () => {
    const repo = makeInMemory();
    const created = await repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' });
    created.username = 'mutated';
    const found = await repo.findById(created.id);
    expect(found?.username).toBe('alice');
  });
});

describe('PgUserRepository', () => {
  function makeDb(handler: (text: string, values?: unknown[]) => unknown): UserDb & {
    calls: Array<{ text: string; values?: unknown[] }>;
  } {
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
    return db;
  }

  it('create issues an INSERT with bound params and maps the row', async () => {
    const user = sampleUser();
    const db = makeDb(() => ({ rows: [rowFor(user)], rowCount: 1 }));
    const repo = new PgUserRepository(db, { now: () => FIXED_NOW });
    const created = await repo.create({
      username: user.username,
      email: user.email,
      passwordHash: user.passwordHash,
    });
    expect(created).toEqual(user);
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].text).toContain('INSERT INTO users');
    expect(db.calls[0].text).toContain('$1');
    expect(db.calls[0].text).toContain('$2');
    expect(db.calls[0].text).toContain('$3');
    expect(db.calls[0].values).toEqual([user.username, user.email, user.passwordHash]);
  });

  it('create throws DuplicateUserError on unique violation', async () => {
    const err = Object.assign(new Error('duplicate key'), { code: '23505', detail: 'Key (username)=(alice) already exists.' });
    const db = makeDb(() => {
      throw err;
    });
    const repo = new PgUserRepository(db);
    await expect(
      repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' }),
    ).rejects.toBeInstanceOf(DuplicateUserError);
    try {
      await repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' });
    } catch (e) {
      expect((e as DuplicateUserError).field).toBe('username');
    }
  });

  it('create maps duplicate field to email', async () => {
    const err = Object.assign(new Error('dup'), { code: '23505', detail: 'Key (email)=(a@x.com) already exists.' });
    const db = makeDb(() => { throw err; });
    const repo = new PgUserRepository(db);
    try {
      await repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' });
    } catch (e) {
      expect((e as DuplicateUserError).field).toBe('email');
    }
  });

  it('create maps unknown duplicate field', async () => {
    const err = Object.assign(new Error('dup'), { code: '23505', detail: 'some other constraint' });
    const db = makeDb(() => { throw err; });
    const repo = new PgUserRepository(db);
    try {
      await repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' });
    } catch (e) {
      expect((e as DuplicateUserError).field).toBe('unknown');
    }
  });

  it('create maps duplicate with no detail/message to unknown', async () => {
    const err: { code: string } = { code: '23505' };
    const db = makeDb(() => { throw err; });
    const repo = new PgUserRepository(db);
    try {
      await repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' });
    } catch (e) {
      expect((e as DuplicateUserError).field).toBe('unknown');
    }
  });

  it('isUniqueViolation true via unique message', async () => {
    const err = new Error('violates unique constraint');
    const db = makeDb(() => { throw err; });
    const repo = new PgUserRepository(db);
    await expect(
      repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' }),
    ).rejects.toBeInstanceOf(DuplicateUserError);
  });

  it('findById issues SELECT ... WHERE id = $1 with bound id', async () => {
    const user = sampleUser();
    const db = makeDb(() => ({ rows: [rowFor(user)], rowCount: 1 }));
    const repo = new PgUserRepository(db);
    const found = await repo.findById(user.id);
    expect(found).toEqual(user);
    expect(db.calls[0].text).toContain('WHERE id = $1');
    expect(db.calls[0].values).toEqual([user.id]);
  });

  it('findById returns null when no row', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgUserRepository(db);
    expect(await repo.findById('missing')).toBeNull();
  });

  it('findByUsername is case-insensitive via lower()', async () => {
    const user = sampleUser({ username: 'Alice' });
    const db = makeDb(() => ({ rows: [rowFor(user)], rowCount: 1 }));
    const repo = new PgUserRepository(db);
    const found = await repo.findByUsername('alice');
    expect(found?.username).toBe('Alice');
    expect(db.calls[0].text).toContain('lower(username) = lower($1)');
    expect(db.calls[0].values).toEqual(['alice']);
  });

  it('findByUsername returns null when absent', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgUserRepository(db);
    expect(await repo.findByUsername('ghost')).toBeNull();
  });

  it('findByEmail is case-insensitive via lower()', async () => {
    const user = sampleUser({ email: 'Alice@Example.com' });
    const db = makeDb(() => ({ rows: [rowFor(user)], rowCount: 1 }));
    const repo = new PgUserRepository(db);
    const found = await repo.findByEmail('alice@example.com');
    expect(found?.email).toBe('Alice@Example.com');
    expect(db.calls[0].text).toContain('lower(email) = lower($1)');
    expect(db.calls[0].values).toEqual(['alice@example.com']);
  });

  it('findByEmail returns null when absent', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgUserRepository(db);
    expect(await repo.findByEmail('ghost@x.com')).toBeNull();
  });

  it('setVerified issues UPDATE with bound params', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 1 }));
    const repo = new PgUserRepository(db);
    await repo.setVerified('uid-1', true);
    expect(db.calls[0].text).toContain('UPDATE users SET verified');
    expect(db.calls[0].values).toEqual(['uid-1', true]);
  });

  it('updateVerification delegates to setVerified', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 1 }));
    const repo = new PgUserRepository(db);
    await repo.updateVerification('uid-1', false);
    expect(db.calls[0].values).toEqual(['uid-1', false]);
  });

  it('updatePasswordHash issues UPDATE with bound params', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 1 }));
    const repo = new PgUserRepository(db);
    await repo.updatePasswordHash('uid-1', 'new-hash');
    expect(db.calls[0].text).toContain('password_hash = $2');
    expect(db.calls[0].values).toEqual(['uid-1', 'new-hash']);
  });

  it('recordFailedLogin increments from current attempts and locks on 5th', async () => {
    const db = makeDb(() => ({
      rows: [{ failed_login_attempts: 4, locked_until: null }],
      rowCount: 1,
    }));
    const repo = new PgUserRepository(db, { now: () => FIXED_NOW });
    const result = await repo.recordFailedLogin('uid-1');
    expect(result).toEqual({ attempts: 4, lockedUntil: null });
    expect(db.calls).toHaveLength(1);
    const call = db.calls[0];
    expect(call.text).toContain('UPDATE users SET failed_login_attempts');
    expect(call.text).toContain('RETURNING');
    expect(call.values).toEqual([
      'uid-1',
      5,
      new Date(FIXED_NOW + 15 * 60 * 1000).toISOString(),
    ]);
  });

  it('recordFailedLogin locks on the 5th attempt with a timestamp', async () => {
    const lockedIso = new Date(FIXED_NOW + 15 * 60 * 1000).toISOString();
    const db = makeDb(() => ({
      rows: [{ failed_login_attempts: 5, locked_until: lockedIso }],
      rowCount: 1,
    }));
    const repo = new PgUserRepository(db, { now: () => FIXED_NOW });
    const result = await repo.recordFailedLogin('uid-1');
    expect(result.attempts).toBe(5);
    expect(result.lockedUntil).toBe(FIXED_NOW + 15 * 60 * 1000);
    expect(db.calls).toHaveLength(1);
    const call = db.calls[0];
    expect(call.text).toContain('UPDATE users SET failed_login_attempts');
    expect(call.text).toContain('RETURNING');
    expect(call.values?.[0]).toBe('uid-1');
    expect(call.values?.[1]).toBe(5);
    expect(call.values?.[2]).toBe(lockedIso);
  });

  it('recordFailedLogin returns zeros for unknown user', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgUserRepository(db, { now: () => FIXED_NOW });
    const result = await repo.recordFailedLogin('uid-missing');
    expect(result).toEqual({ attempts: 0, lockedUntil: null });
  });

  it('resetFailedLogin issues UPDATE resetting counters', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 1 }));
    const repo = new PgUserRepository(db);
    await repo.resetFailedLogin('uid-1');
    expect(db.calls[0].text).toContain('failed_login_attempts = 0');
    expect(db.calls[0].values).toEqual(['uid-1']);
  });

  it('create throws when INSERT returns no row', async () => {
    const db = makeDb(() => ({ rows: [], rowCount: 0 }));
    const repo = new PgUserRepository(db);
    await expect(
      repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' }),
    ).rejects.toThrow('INSERT returned no row');
  });

  it('create rethrows non-unique errors unchanged', async () => {
    const err = new Error('connection lost');
    const db = makeDb(() => {
      throw err;
    });
    const repo = new PgUserRepository(db);
    await expect(
      repo.create({ username: 'alice', email: 'a@x.com', passwordHash: 'h' }),
    ).rejects.toBe(err);
  });

  it('maps locked_until ISO string to epoch ms', async () => {
    const user = sampleUser({ lockedUntil: FIXED_NOW + 1000 });
    const db = makeDb(() => ({ rows: [rowFor(user)], rowCount: 1 }));
    const repo = new PgUserRepository(db);
    const found = await repo.findById(user.id);
    expect(found?.lockedUntil).toBe(FIXED_NOW + 1000);
  });

  it('maps verified false and Date locked_until', async () => {
    const user = sampleUser({ verified: false, lockedUntil: FIXED_NOW + 2000 });
    const row = rowFor(user);
    row.verified = false;
    row.locked_until = new Date(FIXED_NOW + 2000);
    const db = makeDb(() => ({ rows: [row], rowCount: 1 }));
    const repo = new PgUserRepository(db);
    const found = await repo.findById(user.id);
    expect(found?.verified).toBe(false);
    expect(found?.lockedUntil).toBe(FIXED_NOW + 2000);
  });

  it('maps null locked_until', async () => {
    const user = sampleUser({ lockedUntil: null });
    const row = rowFor(user);
    row.locked_until = null;
    const db = makeDb(() => ({ rows: [row], rowCount: 1 }));
    const repo = new PgUserRepository(db);
    const found = await repo.findById(user.id);
    expect(found?.lockedUntil).toBeNull();
  });
});
