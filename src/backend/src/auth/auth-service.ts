/**
 * Auth service orchestration (T9).
 */

import {
  DEFAULT_APP_BASE_URL,
  DEFAULT_SESSION_TTL_DAYS,
  DEFAULT_VERIFICATION_TOKEN_TTL_MS,
} from './config.js';
import type { AuthConfig } from './config.js';
import { createPasswordHasher, type PasswordHasher, type Argon2Params, DEFAULT_ARGON2_PARAMS } from './password.js';
import type { UserRepository, User, DuplicateUserError } from './user-repository.js';
import type { SessionRepository } from './session-repository.js';
import type { VerificationTokenRepository } from './verification-token-repository.js';
import type { EmailService } from './email.js';
import { RateLimiter, createRateLimiter, type Clock } from './rate-limit.js';

export interface SanitizedUser {
  id: string;
  username: string;
  email: string;
  verified: boolean;
}

export interface SessionInfo {
  id: string;
  token: string;
  expiresAt: number;
}

export interface AuthServiceDeps {
  users?: UserRepository;
  userRepository?: UserRepository;
  userRepo?: UserRepository;
  sessions?: SessionRepository;
  sessionRepository?: SessionRepository;
  sessionRepo?: SessionRepository;
  verificationTokens?: VerificationTokenRepository;
  verificationTokenRepository?: VerificationTokenRepository;
  verificationTokenRepo?: VerificationTokenRepository;
  tokens?: VerificationTokenRepository;
  tokenRepository?: VerificationTokenRepository;

  email?: EmailService;
  emailService?: EmailService;
  mailer?: EmailService;
  passwordHasher?: PasswordHasher;
  password?: PasswordHasher;
  passwords?: PasswordHasher;
  hasher?: PasswordHasher;
  rateLimiter?: RateLimiter;
  rateLimit?: RateLimiter;
  limiter?: RateLimiter;

  clock?: Clock;
  now?: Clock;
  config?: Partial<AuthConfig> & {
    appBaseUrl?: string;
    sessionTtlMs?: number;
    sessionTtlDays?: number;
    verificationTokenTtlMs?: number;
    argon2MemoryCost?: number;
    argon2TimeCost?: number;
    argon2Parallelism?: number;
  };
  appBaseUrl?: string;
  sessionTtlMs?: number;
  sessionTtlDays?: number;
  verificationTokenTtlMs?: number;
  argon2MemoryCost?: number;
  argon2TimeCost?: number;
  argon2Parallelism?: number;
}

export class AuthServiceError extends Error {
  status: number;
  statusCode: number;
  retryAfter?: number;
  code?: string;
  constructor(message: string, status: number, retryAfter?: number, code?: string) {
    super(message);
    this.name = 'AuthServiceError';
    this.status = status;
    this.statusCode = status;
    this.retryAfter = retryAfter;
    this.code = code;
  }
}

export class ValidationError extends AuthServiceError {
  constructor(message: string) {
    super(message, 400, undefined, 'validation_error');
    this.name = 'ValidationError';
  }
}

export class DuplicateAccountError extends AuthServiceError {
  readonly field?: 'username' | 'email' | 'unknown';
  constructor(field?: 'username' | 'email' | 'unknown') {
    super('account already exists', 409, undefined, 'duplicate_account');
    this.name = 'DuplicateAccountError';
    this.field = field;
  }
}

export class InvalidCredentialsError extends AuthServiceError {
  constructor(message = 'invalid credentials') {
    super(message, 401, undefined, 'invalid_credentials');
    this.name = 'InvalidCredentialsError';
  }
}

export class AccountLockedError extends AuthServiceError {
  constructor(retryAfter: number) {
    super('account locked', 429, retryAfter, 'account_locked');
    this.name = 'AccountLockedError';
  }
}

export class InvalidTokenError extends AuthServiceError {
  constructor(message = 'invalid or expired token') {
    super(message, 400, undefined, 'invalid_token');
    this.name = 'InvalidTokenError';
  }
}

export class RateLimitError extends AuthServiceError {
  constructor(message = 'rate limit exceeded') {
    super(message, 429, undefined, 'rate_limited');
    this.name = 'RateLimitError';
  }
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface RegisterResult {
  user: SanitizedUser;
  id?: string;
  username?: string;
  email?: string;
  verified?: boolean;
  message?: string;
}

export interface LoginResult {
  user: SanitizedUser;
  token: string;
  sessionToken?: string;
  sessionId?: string;
  id?: string;
  expiresAt?: number;
  session?: SessionInfo;
  username?: string;
  email?: string;
  verified?: boolean;
}

export interface VerifyResult {
  user: SanitizedUser;
  token: string;
  sessionToken?: string;
  sessionId?: string;
  id?: string;
  expiresAt?: number;
  session?: SessionInfo;
  username?: string;
  email?: string;
  verified?: boolean;
}

function sanitize(user: User): SanitizedUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    verified: user.verified,
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function makeVerificationUrl(base: string, token: string): string {
  const trimmed = base.replace(/\/+$/, '');
  return `${trimmed}/verify?token=${token}`;
}

function pick<T>(...candidates: Array<T | undefined | null>): T | undefined {
  for (const c of candidates) {
    if (c !== undefined && c !== null) return c as T;
  }
  return undefined;
}

export class AuthService {
  private readonly users: UserRepository;
  private readonly sessions: SessionRepository;
  private readonly verificationTokens: VerificationTokenRepository;
  private readonly email: EmailService;
  private readonly passwordHasher: PasswordHasher;
  private readonly rateLimiter: RateLimiter;
  private readonly clock: Clock;
  private readonly appBaseUrl: string;
  private readonly sessionTtlMs: number;
  private readonly verificationTokenTtlMs: number;

  constructor(deps: AuthServiceDeps = {}) {
    this.users = pick(
      deps.users,
      deps.userRepository,
      deps.userRepo,
    ) as UserRepository;
    if (!this.users) {
      throw new Error('AuthService requires a UserRepository (users)');
    }
    this.sessions = pick(
      deps.sessions,
      deps.sessionRepository,
      deps.sessionRepo,
    ) as SessionRepository;
    if (!this.sessions) {
      throw new Error('AuthService requires a SessionRepository (sessions)');
    }
    this.verificationTokens = pick(
      deps.verificationTokens,
      deps.verificationTokenRepository,
      deps.verificationTokenRepo,
      deps.tokens,
      deps.tokenRepository,
    ) as VerificationTokenRepository;
    if (!this.verificationTokens) {
      throw new Error('AuthService requires a VerificationTokenRepository (verificationTokens)');
    }
    this.email = pick(deps.email, deps.emailService, deps.mailer) as EmailService;
    if (!this.email) {
      throw new Error('AuthService requires an EmailService (email)');
    }

    if (pick(deps.passwordHasher, deps.password, deps.passwords, deps.hasher)) {
      this.passwordHasher = pick(deps.passwordHasher, deps.password, deps.passwords, deps.hasher) as PasswordHasher;
    } else {
      const cfg = deps.config ?? {};
      const params: Argon2Params = {
        memoryCost: pick(deps.argon2MemoryCost, cfg.argon2MemoryCost) ?? DEFAULT_ARGON2_PARAMS.memoryCost,
        timeCost: pick(deps.argon2TimeCost, cfg.argon2TimeCost) ?? DEFAULT_ARGON2_PARAMS.timeCost,
        parallelism: pick(deps.argon2Parallelism, cfg.argon2Parallelism) ?? DEFAULT_ARGON2_PARAMS.parallelism,
      };
      this.passwordHasher = createPasswordHasher(params);
    }

    this.rateLimiter = pick(deps.rateLimiter, deps.rateLimit, deps.limiter) ?? createRateLimiter(deps.clock ?? deps.now ?? (() => Date.now()));
    this.clock = deps.clock ?? deps.now ?? (() => Date.now());

    const cfg = deps.config ?? {};
    this.appBaseUrl = pick(deps.appBaseUrl, cfg.appBaseUrl) ?? DEFAULT_APP_BASE_URL;
    this.sessionTtlMs =
      pick(deps.sessionTtlMs, cfg.sessionTtlMs) ??
      (pick(deps.sessionTtlDays, cfg.sessionTtlDays) ?? DEFAULT_SESSION_TTL_DAYS) * 24 * 60 * 60 * 1000;
    this.verificationTokenTtlMs =
      pick(deps.verificationTokenTtlMs, cfg.verificationTokenTtlMs) ?? DEFAULT_VERIFICATION_TOKEN_TTL_MS;
  }

  async register(inputOrUsername: RegisterInput | string, emailArg?: string, passwordArg?: string): Promise<RegisterResult> {
    const input = this.normalizeRegisterInput(inputOrUsername, emailArg, passwordArg);
    const username = input.username;
    const email = normalizeEmail(input.email);
    const password = input.password;

    if (typeof username !== 'string' || username.trim() === '') {
      throw new ValidationError('username is required');
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError('invalid email');
    }
    if (typeof password !== 'string' || password.length < 12) {
      throw new ValidationError('password must be at least 12 characters');
    }
    if (password.length > 128) {
      throw new ValidationError('password must be at most 128 characters');
    }

    const existingByUsername = await this.users.findByUsername(username);
    if (existingByUsername) {
      throw new DuplicateAccountError('username');
    }
    const existingByEmail = await this.users.findByEmail(email);
    if (existingByEmail) {
      throw new DuplicateAccountError('email');
    }

    const passwordHash = await this.passwordHasher.hash(password);

    let user: User;
    try {
      user = await this.users.create({ username, email, passwordHash });
    } catch (error) {
      const dup = error as DuplicateUserError;
      if (dup && (dup as { name?: string }).name === 'DuplicateUserError') {
        throw new DuplicateAccountError(dup.field);
      }
      throw error;
    }

    const { token } = await this.verificationTokens.issue(user.id, this.verificationTokenTtlMs, this.clock());
    const verificationUrl = makeVerificationUrl(this.appBaseUrl, token);
    await this.email.sendVerification(user.email, verificationUrl);

    const sanitized = sanitize(user);
    const result: RegisterResult = {
      user: sanitized,
      id: sanitized.id,
      username: sanitized.username,
      email: sanitized.email,
      verified: sanitized.verified,
      message: 'verification email sent',
    };
    return result;
  }

  private normalizeRegisterInput(
    inputOrUsername: RegisterInput | string,
    emailArg?: string,
    passwordArg?: string,
  ): RegisterInput {
    if (typeof inputOrUsername === 'string') {
      return { username: inputOrUsername, email: emailArg ?? '', password: passwordArg ?? '' };
    }
    const i = inputOrUsername as unknown as Record<string, unknown>;
    return {
      username: String(i.username ?? i.userName ?? i.login ?? ''),
      email: String(i.email ?? ''),
      password: String(i.password ?? i.pass ?? ''),
    };
  }

  async login(inputOrUsername: LoginInput | string, passwordArg?: string): Promise<LoginResult> {
    const input = this.normalizeLoginInput(inputOrUsername, passwordArg);
    const username = input.username;
    const password = input.password;

    const user = await this.users.findByUsername(username);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    const now = this.clock();
    if (user.lockedUntil !== null && user.lockedUntil > now) {
      const retryAfter = Math.ceil((user.lockedUntil - now) / 1000);
      throw new AccountLockedError(retryAfter);
    }

    const ok = await this.passwordHasher.verify(user.passwordHash, password);
    if (!ok) {
      await this.users.recordFailedLogin(user.id, now);
      throw new InvalidCredentialsError();
    }

    await this.users.resetFailedLogin(user.id);
    await this.sessions.deleteByUserId(user.id);

    const { id, token, expiresAt } = await this.sessions.create(user.id, this.sessionTtlMs);
    const sanitized = sanitize(user);
    const result: LoginResult = {
      user: sanitized,
      token,
      sessionToken: token,
      sessionId: id,
      id,
      expiresAt,
      session: { id, token, expiresAt },
      username: sanitized.username,
      email: sanitized.email,
      verified: sanitized.verified,
    };
    return result;
  }

  private normalizeLoginInput(inputOrUsername: LoginInput | string, passwordArg?: string): LoginInput {
    if (typeof inputOrUsername === 'string') {
      return { username: inputOrUsername, password: passwordArg ?? '' };
    }
    const i = inputOrUsername as unknown as Record<string, unknown>;
    return {
      username: String(i.username ?? i.userName ?? i.login ?? i.identifier ?? ''),
      password: String(i.password ?? i.pass ?? ''),
    };
  }

  async verifyEmail(input: string | { token?: string }): Promise<VerifyResult> {
    const token = typeof input === 'string' ? input : String((input as { token?: string }).token ?? '');
    if (!token) {
      throw new InvalidTokenError('token is required');
    }

    const now = this.clock();
    const consumed = await this.verificationTokens.consume(token, now);
    if (!consumed) {
      throw new InvalidTokenError();
    }

    const user = await this.users.findById(consumed.userId);
    if (!user) {
      throw new InvalidTokenError();
    }

    await this.users.setVerified(user.id, true);
    const fresh = (await this.users.findById(user.id)) ?? user;
    fresh.verified = true;

    await this.sessions.deleteByUserId(fresh.id);
    const { id, token: sessionToken, expiresAt } = await this.sessions.create(fresh.id, this.sessionTtlMs);

    const sanitized = sanitize(fresh);
    const result: VerifyResult = {
      user: sanitized,
      token: sessionToken,
      sessionToken,
      sessionId: id,
      id,
      expiresAt,
      session: { id, token: sessionToken, expiresAt },
      username: sanitized.username,
      email: sanitized.email,
      verified: true,
    };
    return result;
  }

  async verify(input: string | { token?: string }): Promise<VerifyResult> {
    return this.verifyEmail(input);
  }

  async consumeVerificationToken(input: string | { token?: string }): Promise<VerifyResult> {
    return this.verifyEmail(input);
  }

  async resendVerification(input: string | { email?: string }): Promise<{ message: string }> {
    const email = normalizeEmail(typeof input === 'string' ? input : String((input as { email?: string }).email ?? ''));
    if (!email) {
      throw new ValidationError('email is required');
    }

    const user = await this.users.findByEmail(email);
    if (!user) {
      return { message: 'verification email sent' };
    }

    const allowed = this.rateLimiter.allow(`account:${user.id}:resend`, 3, 60 * 60 * 1000);
    if (!allowed) {
      throw new RateLimitError();
    }

    await this.verificationTokens.invalidateForUser(user.id);
    const { token } = await this.verificationTokens.issue(user.id, this.verificationTokenTtlMs, this.clock());
    const verificationUrl = makeVerificationUrl(this.appBaseUrl, token);
    await this.email.sendVerification(user.email, verificationUrl);

    return { message: 'verification email sent' };
  }

  async logout(input?: string | { token?: string; sessionId?: string; id?: string; sessionToken?: string }): Promise<void> {
    if (!input) return;
    let token: string | undefined;
    let sessionId: string | undefined;
    if (typeof input === 'string') {
      token = input;
    } else {
      token = (input as { token?: string; sessionToken?: string }).token ?? (input as { sessionToken?: string }).sessionToken;
      sessionId = (input as { sessionId?: string; id?: string }).sessionId ?? (input as { id?: string }).id;
    }

    if (sessionId) {
      await this.sessions.delete(sessionId);
      return;
    }
    if (token) {
      const session = await this.sessions.findByToken(token);
      if (session) {
        await this.sessions.delete(session.id);
      }
    }
  }

  async getSession(input?: string | { token?: string; sessionToken?: string }): Promise<SanitizedUser | null> {
    const token = typeof input === 'string'
      ? input
      : (input as { token?: string; sessionToken?: string })?.token ?? (input as { sessionToken?: string })?.sessionToken;
    if (!token) return null;

    const session = await this.sessions.findByToken(token);
    if (!session) return null;
    const now = this.clock();
    if (session.expiresAt <= now) return null;

    const user = await this.users.findById(session.userId ?? '');
    if (!user) return null;
    return sanitize(user);
  }

  async registerUser(...args: Parameters<AuthService['register']>): Promise<RegisterResult> {
    return this.register(...args);
  }

  async createUser(...args: Parameters<AuthService['register']>): Promise<RegisterResult> {
    return this.register(...args);
  }

  async signIn(...args: Parameters<AuthService['login']>): Promise<LoginResult> {
    return this.login(...args);
  }

  async signInWithPassword(...args: Parameters<AuthService['login']>): Promise<LoginResult> {
    return this.login(...args);
  }

  async resend(...args: Parameters<AuthService['resendVerification']>): Promise<{ message: string }> {
    return this.resendVerification(...args);
  }

  async signOut(...args: Parameters<AuthService['logout']>): Promise<void> {
    return this.logout(...args);
  }

  async me(...args: Parameters<AuthService['getSession']>): Promise<SanitizedUser | null> {
    return this.getSession(...args);
  }

  async getCurrentUser(...args: Parameters<AuthService['getSession']>): Promise<SanitizedUser | null> {
    return this.getSession(...args);
  }

  async getUserBySession(...args: Parameters<AuthService['getSession']>): Promise<SanitizedUser | null> {
    return this.getSession(...args);
  }
}

export function createAuthService(deps: AuthServiceDeps = {}): AuthService {
  return new AuthService(deps);
}

export default AuthService;
