/**
 * Session repository (T5).
 */

import { createHash, randomBytes } from 'node:crypto';

export interface Session {
  id: string;
  userId: string | null;
  expiresAt: number;
}

export interface CreateSessionResult {
  id: string;
  token: string;
  expiresAt: number;
}

export interface SessionDb {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
}

export interface SessionRepository {
  create(userId: string | null, ttlMs: number): Promise<CreateSessionResult>;
  findById(id: string): Promise<Session | null>;
  findByToken(token: string): Promise<Session | null>;
  touch(id: string, ttlMs: number): Promise<{ expiresAt: number }>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}

export interface InMemorySessionRepositoryOptions {
  now?: () => number;
}

const TOKEN_BYTES = 32;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface SessionRecord {
  id: string;
  userId: string | null;
  tokenHash: string;
  expiresAt: number;
  lastSeenAt: number;
}

export class InMemorySessionRepository implements SessionRepository {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly now: () => number;

  constructor(options: InMemorySessionRepositoryOptions = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  async create(userId: string | null, ttlMs: number): Promise<CreateSessionResult> {
    const now = this.now();
    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = now + ttlMs;
    const record: SessionRecord = {
      id: makeId(),
      userId,
      tokenHash,
      expiresAt,
      lastSeenAt: now,
    };
    this.sessions.set(record.id, record);
    return { id: record.id, token, expiresAt };
  }

  async findById(id: string): Promise<Session | null> {
    const record = this.sessions.get(id);
    if (!record) return null;
    const now = this.now();
    if (record.expiresAt <= now) return null;
    return { id: record.id, userId: record.userId, expiresAt: record.expiresAt };
  }

  async findByToken(token: string): Promise<Session | null> {
    const tokenHash = hashToken(token);
    const now = this.now();
    for (const record of this.sessions.values()) {
      if (record.tokenHash === tokenHash) {
        if (record.expiresAt <= now) return null;
        return { id: record.id, userId: record.userId, expiresAt: record.expiresAt };
      }
    }
    return null;
  }

  async touch(id: string, ttlMs: number): Promise<{ expiresAt: number }> {
    const record = this.sessions.get(id);
    if (!record) {
      throw new Error('session not found');
    }
    const now = this.now();
    if (record.expiresAt <= now) {
      throw new Error('session expired');
    }
    record.expiresAt = now + ttlMs;
    record.lastSeenAt = now;
    return { expiresAt: record.expiresAt };
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async deleteByUserId(userId: string): Promise<void> {
    for (const [id, record] of this.sessions) {
      if (record.userId === userId) {
        this.sessions.delete(id);
      }
    }
  }
}

export interface PgSessionRepositoryOptions {
  now?: () => number;
}

function toEpochMs(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export class PgSessionRepository implements SessionRepository {
  private readonly db: SessionDb;
  private readonly now: () => number;

  constructor(db: SessionDb, options: PgSessionRepositoryOptions = {}) {
    this.db = db;
    this.now = options.now ?? (() => Date.now());
  }

  async create(userId: string | null, ttlMs: number): Promise<CreateSessionResult> {
    const now = this.now();
    const token = randomBytes(TOKEN_BYTES).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = now + ttlMs;
    const result = await this.db.query(
      'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING id, expires_at',
      [userId, tokenHash, new Date(expiresAt).toISOString()],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('INSERT returned no row');
    }
    const id = String(row.id);
    const storedExpiresAt = toEpochMs(row.expires_at);
    const finalExpiresAt = storedExpiresAt > 0 ? storedExpiresAt : expiresAt;
    return { id, token, expiresAt: finalExpiresAt };
  }

  async findById(id: string): Promise<Session | null> {
    const result = await this.db.query(
      'SELECT id, user_id, expires_at FROM sessions WHERE id = $1',
      [id],
    );
    const row = result.rows[0];
    if (!row) return null;
    const expiresAt = toEpochMs(row.expires_at);
    const now = this.now();
    if (expiresAt <= now) return null;
    return {
      id: String(row.id),
      userId: row.user_id === null || row.user_id === undefined ? null : String(row.user_id),
      expiresAt,
    };
  }

  async findByToken(token: string): Promise<Session | null> {
    const tokenHash = hashToken(token);
    const result = await this.db.query(
      'SELECT id, user_id, expires_at FROM sessions WHERE token_hash = $1',
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    const expiresAt = toEpochMs(row.expires_at);
    const now = this.now();
    if (expiresAt <= now) return null;
    return {
      id: String(row.id),
      userId: row.user_id === null || row.user_id === undefined ? null : String(row.user_id),
      expiresAt,
    };
  }

  async touch(id: string, ttlMs: number): Promise<{ expiresAt: number }> {
    const now = this.now();
    const result = await this.db.query(
      'SELECT id, expires_at FROM sessions WHERE id = $1',
      [id],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('session not found');
    }
    const currentExpires = toEpochMs(row.expires_at);
    if (currentExpires <= now) {
      throw new Error('session expired');
    }
    const expiresAt = now + ttlMs;
    await this.db.query(
      'UPDATE sessions SET expires_at = $2, last_seen_at = $3 WHERE id = $1',
      [id, new Date(expiresAt).toISOString(), new Date(now).toISOString()],
    );
    return { expiresAt };
  }

  async delete(id: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE id = $1', [id]);
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }
}
