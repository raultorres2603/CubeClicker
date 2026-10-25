/**
 * User repository (T4).
 */

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  verified: boolean;
  failedLoginAttempts: number;
  lockedUntil: number | null;
}

export interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
}

export class DuplicateUserError extends Error {
  readonly field: 'username' | 'email' | 'unknown';
  constructor(field: 'username' | 'email' | 'unknown' = 'unknown') {
    super(`duplicate user (${field})`);
    this.name = 'DuplicateUserError';
    this.field = field;
  }
}

export interface UserRepository {
  create(input: CreateUserInput): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  setVerified(id: string, verified?: boolean): Promise<void>;
  updateVerification(id: string, verified?: boolean): Promise<void>;
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;
  recordFailedLogin(
    id: string,
    nowMs?: number,
  ): Promise<{ attempts: number; lockedUntil: number | null }>;
  resetFailedLogin(id: string): Promise<void>;
}

export interface UserDb {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
}

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

function normalize(value: string): string {
  return value.toLowerCase();
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

export interface InMemoryUserRepositoryOptions {
  now?: () => number;
}

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();
  private readonly now: () => number;

  constructor(options: InMemoryUserRepositoryOptions = {}) {
    this.now = options.now ?? (() => Date.now());
  }

  async create(input: CreateUserInput): Promise<User> {
    const usernameKey = normalize(input.username);
    const emailKey = normalize(input.email);
    for (const existing of this.users.values()) {
      if (normalize(existing.username) === usernameKey) {
        throw new DuplicateUserError('username');
      }
      if (normalize(existing.email) === emailKey) {
        throw new DuplicateUserError('email');
      }
    }
    const user: User = {
      id: makeId(),
      username: input.username,
      email: input.email,
      passwordHash: input.passwordHash,
      verified: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    };
    this.users.set(user.id, user);
    return { ...user };
  }

  async findById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const key = normalize(username);
    for (const user of this.users.values()) {
      if (normalize(user.username) === key) {
        return { ...user };
      }
    }
    return null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const key = normalize(email);
    for (const user of this.users.values()) {
      if (normalize(user.email) === key) {
        return { ...user };
      }
    }
    return null;
  }

  async setVerified(id: string, verified: boolean = true): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.verified = verified;
    }
  }

  async updateVerification(id: string, verified: boolean = true): Promise<void> {
    await this.setVerified(id, verified);
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.passwordHash = passwordHash;
    }
  }

  async recordFailedLogin(
    id: string,
    nowMs?: number,
  ): Promise<{ attempts: number; lockedUntil: number | null }> {
    const user = this.users.get(id);
    if (!user) {
      return { attempts: 0, lockedUntil: null };
    }
    const now = nowMs ?? this.now();
    const attempts = user.failedLoginAttempts + 1;
    user.failedLoginAttempts = attempts;
    let lockedUntil: number | null = null;
    if (attempts >= LOCKOUT_THRESHOLD) {
      lockedUntil = now + LOCKOUT_DURATION_MS;
      user.lockedUntil = lockedUntil;
    }
    return { attempts, lockedUntil };
  }

  async resetFailedLogin(id: string): Promise<void> {
    const user = this.users.get(id);
    if (user) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
    }
  }
}

export interface PgUserRepositoryOptions {
  now?: () => number;
}

const USER_COLUMNS =
  'id, username, email, password_hash, verified, failed_login_attempts, locked_until';

function rowToUser(row: Record<string, unknown>): User {
  const lockedRaw = row.locked_until;
  let lockedUntil: number | null = null;
  if (lockedRaw !== null && lockedRaw !== undefined) {
    if (lockedRaw instanceof Date) {
      lockedUntil = lockedRaw.getTime();
    } else {
      const parsed = Date.parse(String(lockedRaw));
      lockedUntil = Number.isNaN(parsed) ? null : parsed;
    }
  }
  return {
    id: String(row.id),
    username: String(row.username),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    verified: row.verified === true || row.verified === 't' || row.verified === 1,
    failedLoginAttempts: Number(row.failed_login_attempts ?? 0),
    lockedUntil,
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (error !== null && typeof error === 'object') {
    const code = (error as { code?: unknown }).code;
    if (code === '23505') return true;
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && /unique/i.test(message)) return true;
  }
  return false;
}

function uniqueField(error: unknown): 'username' | 'email' | 'unknown' {
  const detail = String(
    (error as { detail?: unknown; message?: unknown })?.detail ??
      (error as { message?: unknown })?.message ??
      '',
  ).toLowerCase();
  if (detail.includes('username')) return 'username';
  if (detail.includes('email')) return 'email';
  return 'unknown';
}

export class PgUserRepository implements UserRepository {
  private readonly db: UserDb;
  private readonly now: () => number;

  constructor(db: UserDb, options: PgUserRepositoryOptions = {}) {
    this.db = db;
    this.now = options.now ?? (() => Date.now());
  }

  async create(input: CreateUserInput): Promise<User> {
    try {
      const result = await this.db.query(
        `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING ${USER_COLUMNS}`,
        [input.username, input.email, input.passwordHash],
      );
      const row = result.rows[0];
      if (!row) {
        throw new Error('INSERT returned no row');
      }
      return rowToUser(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DuplicateUserError(uniqueField(error));
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? rowToUser(row) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const result = await this.db.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE lower(username) = lower($1)`,
      [username],
    );
    const row = result.rows[0];
    return row ? rowToUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query(
      `SELECT ${USER_COLUMNS} FROM users WHERE lower(email) = lower($1)`,
      [email],
    );
    const row = result.rows[0];
    return row ? rowToUser(row) : null;
  }

  async setVerified(id: string, verified: boolean = true): Promise<void> {
    await this.db.query('UPDATE users SET verified = $2, updated_at = now() WHERE id = $1', [
      id,
      verified,
    ]);
  }

  async updateVerification(id: string, verified: boolean = true): Promise<void> {
    await this.setVerified(id, verified);
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.db.query(
      'UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1',
      [id, passwordHash],
    );
  }

  async recordFailedLogin(
    id: string,
    nowMs?: number,
  ): Promise<{ attempts: number; lockedUntil: number | null }> {
    const selectResult = await this.db.query(
      'SELECT failed_login_attempts FROM users WHERE id = $1',
      [id],
    );
    const row = selectResult.rows[0];
    if (!row) {
      return { attempts: 0, lockedUntil: null };
    }
    const now = nowMs ?? this.now();
    const attempts = Number(row.failed_login_attempts ?? 0) + 1;
    let lockedUntil: number | null = null;
    if (attempts >= LOCKOUT_THRESHOLD) {
      lockedUntil = now + LOCKOUT_DURATION_MS;
    }
    await this.db.query(
      'UPDATE users SET failed_login_attempts = $2, locked_until = $3, updated_at = now() WHERE id = $1',
      [id, attempts, lockedUntil === null ? null : new Date(lockedUntil).toISOString()],
    );
    return { attempts, lockedUntil };
  }

  async resetFailedLogin(id: string): Promise<void> {
    await this.db.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = now() WHERE id = $1',
      [id],
    );
  }
}
