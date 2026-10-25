/**
 * Verification-token repository (T6).
 *
 * Stores email-verification tokens hashed at rest (SHA-256 of the raw token).
 * Exposes both a low-level CRUD surface (`create`/`findByToken`/`markUsed`/
 * `deleteExpired`) and the plan-level helpers (`issue`/`consume`/
 * `invalidateForUser`) that the auth service (T9) builds on.
 */

import { createHash, randomBytes } from 'node:crypto';

export interface VerificationToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: number; // epoch ms
  usedAt: number | null; // epoch ms, or null when unused
}

export interface CreateVerificationTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: number | Date;
}

export class DuplicateVerificationTokenError extends Error {
  constructor(message = 'duplicate verification token') {
    super(message);
    this.name = 'DuplicateVerificationTokenError';
  }
}

export interface VerificationTokenDb {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
}

export interface VerificationTokenRepository {
  create(input: CreateVerificationTokenInput): Promise<VerificationToken>;
  findById(id: string): Promise<VerificationToken | null>;
  findByToken(token: string): Promise<VerificationToken | null>;
  markUsed(idOrToken: string, nowMs?: number): Promise<void>;
  deleteExpired(nowMs?: number): Promise<number>;
  issue(
    userId: string,
    ttlMs: number,
    nowMs?: number,
  ): Promise<{ token: string; expiresAt: number }>;
  consume(token: string, nowMs?: number): Promise<{ userId: string } | null>;
  invalidateForUser(userId: string): Promise<void>;
}

export interface InMemoryVerificationTokenRepositoryOptions {
  now?: () => number;
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

export function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

function toMs(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toMsOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

function rowToToken(row: Record<string, unknown>): VerificationToken {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    tokenHash: String(row.token_hash),
    expiresAt: toMs(row.expires_at as number | Date),
    usedAt: toMsOrNull(row.used_at),
  };
}

export class InMemoryVerificationTokenRepository
  implements VerificationTokenRepository
{
  private readonly tokens = new Map<string, VerificationToken>();
  private readonly now: () => number;

  constructor(options: InMemoryVerificationTokenRepositoryOptions = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  async create(input: CreateVerificationTokenInput): Promise<VerificationToken> {
    for (const existing of this.tokens.values()) {
      if (existing.tokenHash === input.tokenHash) {
        throw new DuplicateVerificationTokenError();
      }
    }
    const token: VerificationToken = {
      id: makeId(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: toMs(input.expiresAt),
      usedAt: null,
    };
    this.tokens.set(token.id, token);
    return { ...token };
  }

  async findById(id: string): Promise<VerificationToken | null> {
    const token = this.tokens.get(id);
    return token ? { ...token } : null;
  }

  async findByToken(token: string): Promise<VerificationToken | null> {
    // Accept either a raw token (hashed) or an already-hashed value.
    const direct = [...this.tokens.values()].find((t) => t.tokenHash === token);
    if (direct) return { ...direct };
    const hashed = hashVerificationToken(token);
    const found = [...this.tokens.values()].find((t) => t.tokenHash === hashed);
    return found ? { ...found } : null;
  }

  async markUsed(idOrToken: string, nowMs?: number): Promise<void> {
    const now = nowMs ?? this.now();
    let record = this.tokens.get(idOrToken);
    if (!record) {
      const found = await this.findByToken(idOrToken);
      if (found) record = this.tokens.get(found.id);
    }
    if (!record) return;
    record.usedAt = now;
  }

  async deleteExpired(nowMs?: number): Promise<number> {
    const now = nowMs ?? this.now();
    let count = 0;
    for (const [id, token] of this.tokens) {
      if (token.expiresAt <= now) {
        this.tokens.delete(id);
        count += 1;
      }
    }
    return count;
  }

  async issue(
    userId: string,
    ttlMs: number,
    nowMs?: number,
  ): Promise<{ token: string; expiresAt: number }> {
    const now = nowMs ?? this.now();
    const token = generateVerificationToken();
    const tokenHash = hashVerificationToken(token);
    const expiresAt = now + ttlMs;
    await this.create({ userId, tokenHash, expiresAt });
    return { token, expiresAt };
  }

  async consume(
    token: string,
    nowMs?: number,
  ): Promise<{ userId: string } | null> {
    const now = nowMs ?? this.now();
    const record = await this.findByToken(token);
    if (!record) return null;
    if (record.usedAt !== null) return null;
    if (record.expiresAt <= now) return null;
    await this.markUsed(record.id, now);
    return { userId: record.userId };
  }

  async invalidateForUser(userId: string): Promise<void> {
    for (const [id, token] of this.tokens) {
      if (token.userId === userId) this.tokens.delete(id);
    }
  }
}

export interface PgVerificationTokenRepositoryOptions {
  now?: () => number;
}

export class PgVerificationTokenRepository implements VerificationTokenRepository {
  private readonly db: VerificationTokenDb;
  private readonly now: () => number;

  constructor(db: VerificationTokenDb, options: PgVerificationTokenRepositoryOptions = {}) {
    this.db = db;
    this.now = options.now ?? (() => Date.now());
  }

  async create(input: CreateVerificationTokenInput): Promise<VerificationToken> {
    const expiresAt = new Date(toMs(input.expiresAt)).toISOString();
    const result = await this.db.query(
      `INSERT INTO verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3) RETURNING id, user_id, token_hash, expires_at, used_at`,
      [input.userId, input.tokenHash, expiresAt],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('INSERT returned no row');
    }
    return rowToToken(row);
  }

  async findById(id: string): Promise<VerificationToken | null> {
    const result = await this.db.query(
      `SELECT id, user_id, token_hash, expires_at, used_at FROM verification_tokens WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? rowToToken(row) : null;
  }

  async findByToken(token: string): Promise<VerificationToken | null> {
    // Direct match (already-hashed input).
    let result = await this.db.query(
      `SELECT id, user_id, token_hash, expires_at, used_at FROM verification_tokens WHERE token_hash = $1`,
      [token],
    );
    if (!result.rows[0]) {
      const hashed = hashVerificationToken(token);
      result = await this.db.query(
        `SELECT id, user_id, token_hash, expires_at, used_at FROM verification_tokens WHERE token_hash = $1`,
        [hashed],
      );
    }
    const row = result.rows[0];
    return row ? rowToToken(row) : null;
  }

  async markUsed(idOrToken: string, nowMs?: number): Promise<void> {
    const now = nowMs ?? this.now();
    let record = await this.findById(idOrToken);
    if (!record) {
      record = await this.findByToken(idOrToken);
    }
    if (!record) return;
    await this.db.query(
      `UPDATE verification_tokens SET used_at = $2 WHERE id = $1`,
      [record.id, new Date(now).toISOString()],
    );
  }

  async deleteExpired(nowMs?: number): Promise<number> {
    const now = nowMs ?? this.now();
    const result = await this.db.query(
      `DELETE FROM verification_tokens WHERE expires_at <= $1`,
      [new Date(now).toISOString()],
    );
    return result.rowCount ?? 0;
  }

  async issue(
    userId: string,
    ttlMs: number,
    nowMs?: number,
  ): Promise<{ token: string; expiresAt: number }> {
    const now = nowMs ?? this.now();
    const token = generateVerificationToken();
    const tokenHash = hashVerificationToken(token);
    const expiresAt = now + ttlMs;
    await this.create({ userId, tokenHash, expiresAt });
    return { token, expiresAt };
  }

  async consume(
    token: string,
    nowMs?: number,
  ): Promise<{ userId: string } | null> {
    const now = nowMs ?? this.now();
    const record = await this.findByToken(token);
    if (!record) return null;
    if (record.usedAt !== null) return null;
    if (record.expiresAt <= now) return null;
    await this.markUsed(record.id, now);
    return { userId: record.userId };
  }

  async invalidateForUser(userId: string): Promise<void> {
    await this.db.query(`DELETE FROM verification_tokens WHERE user_id = $1`, [
      userId,
    ]);
  }
}