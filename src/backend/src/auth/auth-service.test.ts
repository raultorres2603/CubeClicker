import { describe, expect, it, vi } from 'vitest';

import {
  DuplicateUserError,
  InMemoryUserRepository,
} from './user-repository.js';
import {
  InMemorySessionRepository,
} from './session-repository.js';
import {
  InMemoryVerificationTokenRepository,
} from './verification-token-repository.js';
import { FakeEmailService, SmtpEmailService, type CapturedVerificationEmail, type EmailService, type OutgoingEmail } from './email.js';
import type { VerificationEmailOptions } from './email-template.js';
import { createPasswordHasher, DEFAULT_ARGON2_PARAMS, verifyPassword } from './password.js';
import { DEFAULT_ARGON2_MEMORY_COST, DEFAULT_ARGON2_TIME_COST, DEFAULT_ARGON2_PARALLELISM, loadAuthConfig } from './config.js';
import { createRateLimiter } from './rate-limit.js';
import { AuthService, createAuthService, ValidationError, DuplicateAccountError, InvalidCredentialsError, AccountLockedError, InvalidTokenError, RateLimitError } from './auth-service.js';

const FIXED_NOW = 1_700_000_000_000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

function makeService(overrides: Record<string, unknown> = {}) {
  let now = FIXED_NOW;
  const clock = () => now;
  const users = new InMemoryUserRepository({ now: clock });
  const sessions = new InMemorySessionRepository({ now: clock });
  const tokens = new InMemoryVerificationTokenRepository({ now: clock });
  const email = new FakeEmailService();
  const hasher = createPasswordHasher(DEFAULT_ARGON2_PARAMS);
  const rateLimiter = createRateLimiter(clock);
  const service = createAuthService({
    users,
    sessions,
    verificationTokens: tokens,
    email,
    passwordHasher: hasher,
    rateLimiter,
    clock,
    config: {
      appBaseUrl: 'http://localhost:5173',
      sessionTtlMs: SESSION_TTL_MS,
      verificationTokenTtlMs: VERIFY_TTL_MS,
    },
    ...overrides,
  });
  return { service, users, sessions, tokens, email, hasher, clock, advance: (ms: number) => { now += ms; }, nowRef: () => now };
}

describe('AuthService.register', () => {
  it('creates an unverified account, hashes password, issues token, sends one email', async () => {
    const { service, users, email } = makeService();
    const result = await service.register({ username: 'alice', email: 'Alice@Example.com', password: 'password1234' });
    expect(result.user.verified).toBe(false);
    expect(result.user.username).toBe('alice');
    expect(result.user.email).toBe('alice@example.com');
    expect(result.verified).toBe(false);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0].to).toBe('alice@example.com');
    expect(email.sent[0].verificationUrl).toContain('token=');

    const found = await users.findByEmail('alice@example.com');
    expect(found).not.toBeNull();
    expect(found!.verified).toBe(false);
    expect(found!.passwordHash).not.toBe('password1234');
    const ok = await verifyPassword(found!.passwordHash, 'password1234');
    expect(ok).toBe(true);
  });

  it('rejects duplicate username with 409 and sends no email', async () => {
    const { service, email, tokens } = makeService();
    await service.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    const emailCountBefore = email.sent.length;
    const issueSpy = vi.spyOn(tokens, 'issue');
    let thrown: unknown;
    try {
      await service.register({ username: 'ALICE', email: 'b@x.com', password: 'password1234' });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(DuplicateAccountError);
    expect((thrown as DuplicateAccountError).status).toBe(409);
    expect((thrown as DuplicateAccountError).field).toBe('username');
    expect((thrown as DuplicateAccountError).fields).toEqual(['username']);
    expect((thrown as DuplicateAccountError).message).toBe('account already exists');
    expect((thrown as DuplicateAccountError).code).toBe('duplicate_account');
    expect(email.sent.length).toBe(emailCountBefore);
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('rejects duplicate email with 409 and issues no token', async () => {
    const { service, email, tokens } = makeService();
    await service.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    const emailCountBefore = email.sent.length;
    const issueSpy = vi.spyOn(tokens, 'issue');
    let thrown: unknown;
    try {
      await service.register({ username: 'bob', email: 'A@X.COM', password: 'password1234' });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(DuplicateAccountError);
    expect((thrown as DuplicateAccountError).field).toBe('email');
    expect((thrown as DuplicateAccountError).fields).toEqual(['email']);
    expect(email.sent.length).toBe(emailCountBefore);
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('enforces password length boundaries', async () => {
    const { service } = makeService();
    const short = 'a'.repeat(11);
    const ok12 = 'a'.repeat(12);
    const ok128 = 'a'.repeat(128);
    const long129 = 'a'.repeat(129);

    await expect(service.register({ username: 'u1', email: 'u1@x.com', password: short })).rejects.toBeInstanceOf(ValidationError);
    // 12 accepted
    const r12 = await service.register({ username: 'u2', email: 'u2@x.com', password: ok12 });
    expect(r12.user.verified).toBe(false);
    // 128 accepted
    const r128 = await service.register({ username: 'u3', email: 'u3@x.com', password: ok128 });
    expect(r128.user.verified).toBe(false);
    // 129 rejected
    await expect(service.register({ username: 'u4', email: 'u4@x.com', password: long129 })).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects invalid email and empty username', async () => {
    const { service } = makeService();
    await expect(service.register({ username: '', email: 'a@x.com', password: 'password1234' })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.register({ username: 'bob', email: 'not-an-email', password: 'password1234' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('supports positional arguments', async () => {
    const { service } = makeService();
    const r = await service.register('posuser', 'pos@x.com', 'password1234');
    expect(r.user.username).toBe('posuser');
  });
});

describe('AuthService.login', () => {
  async function seed(service: ReturnType<typeof makeService>['service']) {
    return service.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
  }

  it('logs in with valid credentials, returns user+token, revokes prior sessions', async () => {
    const ctx = makeService();
    await seed(ctx.service);
    // create a prior session by logging in once
    const first = await ctx.service.login({ username: 'alice', password: 'password1234' });
    expect(first.user.username).toBe('alice');
    expect(typeof first.token).toBe('string');
    expect(first.token.length).toBeGreaterThan(0);
    expect(first.sessionId).toBe(first.id);
    expect(first.expiresAt).toBe(FIXED_NOW + SESSION_TTL_MS);

    // second login revokes first session
    const second = await ctx.service.login({ username: 'alice', password: 'password1234' });
    expect(second.token).not.toBe(first.token);
    const stillValid = await ctx.service.getSession(first.token);
    expect(stillValid).toBeNull();
    const valid = await ctx.service.getSession(second.token);
    expect(valid?.username).toBe('alice');
  });

  it('rejects unknown user with 401', async () => {
    const { service } = makeService();
    await expect(service.login({ username: 'ghost', password: 'password1234' })).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('rejects wrong password with 401 and increments counter', async () => {
    const ctx = makeService();
    await seed(ctx.service);
    await expect(ctx.service.login({ username: 'alice', password: 'wrongpassword1' })).rejects.toBeInstanceOf(InvalidCredentialsError);
    const user = await ctx.users.findByUsername('alice');
    expect(user!.failedLoginAttempts).toBe(1);
    expect(user!.lockedUntil).toBeNull();
  });

  it('locks after 5 failed attempts and reports retryAfter', async () => {
    const ctx = makeService();
    await seed(ctx.service);
    for (let i = 0; i < 4; i++) {
      await expect(ctx.service.login({ username: 'alice', password: 'wrongpassword1' })).rejects.toBeInstanceOf(InvalidCredentialsError);
    }
    // 5th failure locks
    await expect(ctx.service.login({ username: 'alice', password: 'wrongpassword1' })).rejects.toBeInstanceOf(InvalidCredentialsError);
    const user = await ctx.users.findByUsername('alice');
    expect(user!.failedLoginAttempts).toBe(5);
    expect(user!.lockedUntil).toBe(FIXED_NOW + 15 * 60 * 1000);

    // now account locked -> AccountLockedError
    let thrown: unknown;
    try {
      await ctx.service.login({ username: 'alice', password: 'password1234' });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(AccountLockedError);
    expect((thrown as AccountLockedError).status).toBe(429);
    expect((thrown as AccountLockedError).retryAfter).toBe(15 * 60);
  });

  it('successful login resets counter', async () => {
    const ctx = makeService();
    await seed(ctx.service);
    for (let i = 0; i < 3; i++) {
      await expect(ctx.service.login({ username: 'alice', password: 'wrongpassword1' })).rejects.toBeInstanceOf(InvalidCredentialsError);
    }
    const before = await ctx.users.findByUsername('alice');
    expect(before!.failedLoginAttempts).toBe(3);
    await ctx.service.login({ username: 'alice', password: 'password1234' });
    const after = await ctx.users.findByUsername('alice');
    expect(after!.failedLoginAttempts).toBe(0);
    expect(after!.lockedUntil).toBeNull();
  });

  it('supports positional arguments', async () => {
    const ctx = makeService();
    await seed(ctx.service);
    const r = await ctx.service.login('alice', 'password1234');
    expect(r.user.username).toBe('alice');
  });
});

describe('AuthService.verifyEmail', () => {
  it('consumes valid token, sets verified, creates session', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    const url = ctx.email.sent[0].verificationUrl;
    const token = new URL(url).searchParams.get('token')!;
    expect(token.length).toBeGreaterThan(0);

    const result = await ctx.service.verifyEmail(token);
    expect(result.user.verified).toBe(true);
    expect(result.verified).toBe(true);
    expect(typeof result.token).toBe('string');
    const found = await ctx.users.findByUsername('alice');
    expect(found!.verified).toBe(true);

    // token reused -> invalid
    await expect(ctx.service.verifyEmail(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('rejects reused token without changing state', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    const token = new URL(ctx.email.sent[0].verificationUrl).searchParams.get('token')!;
    await ctx.service.verifyEmail(token);
    const verifiedBefore = (await ctx.users.findByUsername('alice'))!.verified;
    expect(verifiedBefore).toBe(true);
    await expect(ctx.service.verifyEmail(token)).rejects.toBeInstanceOf(InvalidTokenError);
    const verifiedAfter = (await ctx.users.findByUsername('alice'))!.verified;
    expect(verifiedAfter).toBe(true);
  });

  it('rejects expired token', async () => {
    const ctx = makeService({ config: { appBaseUrl: 'http://localhost:5173', sessionTtlMs: SESSION_TTL_MS, verificationTokenTtlMs: 1 } });
    await ctx.service.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    const token = new URL(ctx.email.sent[0].verificationUrl).searchParams.get('token')!;
    ctx.advance(5);
    await expect(ctx.service.verifyEmail(token)).rejects.toBeInstanceOf(InvalidTokenError);
    const user = await ctx.users.findByUsername('alice');
    expect(user!.verified).toBe(false);
  });

  it('rejects unknown token', async () => {
    const ctx = makeService();
    await expect(ctx.service.verifyEmail('deadbeef')).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('supports object input { token } and verify alias', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    const token = new URL(ctx.email.sent[0].verificationUrl).searchParams.get('token')!;
    const result = await ctx.service.verify({ token });
    expect(result.user.verified).toBe(true);
  });
});

describe('AuthService.resendVerification', () => {
  it('issues new token, invalidates previous, sends new email', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    const firstToken = new URL(ctx.email.sent[0].verificationUrl).searchParams.get('token')!;
    expect(ctx.email.sent).toHaveLength(1);

    const res = await ctx.service.resendVerification('a@x.com');
    expect(res.message).toBe('verification email sent');
    expect(ctx.email.sent).toHaveLength(2);

    // previous token invalid
    await expect(ctx.service.verifyEmail(firstToken)).rejects.toBeInstanceOf(InvalidTokenError);
    // new token works
    const newToken = new URL(ctx.email.sent[1].verificationUrl).searchParams.get('token')!;
    expect(newToken).not.toBe(firstToken);
    const v = await ctx.service.verifyEmail(newToken);
    expect(v.user.verified).toBe(true);
  });

  it('returns success without sending for unknown email (no enumeration)', async () => {
    const ctx = makeService();
    const res = await ctx.service.resendVerification('ghost@x.com');
    expect(res.message).toBe('verification email sent');
    expect(ctx.email.sent).toHaveLength(0);
  });

  it('rate limits to 3 per hour per account', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    // 3 resends allowed (plus registration already sent one email, but rate limit is separate)
    await ctx.service.resendVerification('a@x.com');
    await ctx.service.resendVerification('a@x.com');
    await ctx.service.resendVerification('a@x.com');
    await expect(ctx.service.resendVerification('a@x.com')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('supports object input { email }', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    const res = await ctx.service.resendVerification({ email: 'a@x.com' });
    expect(res.message).toBe('verification email sent');
  });
});

describe('AuthService.logout and getSession', () => {
  it('logout revokes session; getSession returns null after', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    const login = await ctx.service.login({ username: 'alice', password: 'password1234' });
    const before = await ctx.service.getSession(login.token);
    expect(before?.username).toBe('alice');

    await ctx.service.logout(login.token);
    const after = await ctx.service.getSession(login.token);
    expect(after).toBeNull();
  });

  it('logout by sessionId works', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    const login = await ctx.service.login({ username: 'alice', password: 'password1234' });
    await ctx.service.logout({ sessionId: login.sessionId });
    const after = await ctx.service.getSession(login.token);
    expect(after).toBeNull();
  });

  it('getSession returns null for expired session', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    const login = await ctx.service.login({ username: 'alice', password: 'password1234' });
    // advance clock beyond session ttl
    ctx.advance(SESSION_TTL_MS + 1);
    const res = await ctx.service.getSession(login.token);
    expect(res).toBeNull();
  });

  it('getSession returns null for unknown token', async () => {
    const ctx = makeService();
    expect(await ctx.service.getSession('nope')).toBeNull();
    expect(await ctx.service.getSession()).toBeNull();
  });

  it('single active session: revoked token returns null (getSession)', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    const first = await ctx.service.login({ username: 'alice', password: 'password1234' });
    await ctx.service.login({ username: 'alice', password: 'password1234' });
    expect(await ctx.service.getSession(first.token)).toBeNull();
  });
});


describe('AuthService edge cases and aliases', () => {
  it('constructor throws when deps missing', () => {
    expect(() => new AuthService({})).toThrow();
  });

  it('registerUser alias works', async () => {
    const ctx = makeService();
    const r = await ctx.service.registerUser({ username: 'a2', email: 'a2@x.com', password: 'password1234' });
    expect(r.user.username).toBe('a2');
  });

  it('signIn alias works', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'a3', email: 'a3@x.com', password: 'password1234' });
    const r = await ctx.service.signIn({ username: 'a3', password: 'password1234' });
    expect(r.user.username).toBe('a3');
  });

  it('verify alias and consumeVerificationToken alias work', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'a4', email: 'a4@x.com', password: 'password1234' });
    const token = new URL(ctx.email.sent[0].verificationUrl).searchParams.get('token')!;
    const r = await ctx.service.consumeVerificationToken(token);
    expect(r.user.verified).toBe(true);
  });

  it('resend alias works', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'a5', email: 'a5@x.com', password: 'password1234' });
    const r = await ctx.service.resend('a5@x.com');
    expect(r.message).toBe('verification email sent');
  });

  it('signOut alias works', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'a6', email: 'a6@x.com', password: 'password1234' });
    const login = await ctx.service.login({ username: 'a6', password: 'password1234' });
    await ctx.service.signOut(login.token);
    expect(await ctx.service.getSession(login.token)).toBeNull();
  });

  it('me/getCurrentUser/getUserBySession aliases work', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'a7', email: 'a7@x.com', password: 'password1234' });
    const login = await ctx.service.login({ username: 'a7', password: 'password1234' });
    expect((await ctx.service.me(login.token))?.username).toBe('a7');
    expect((await ctx.service.getCurrentUser(login.token))?.username).toBe('a7');
    expect((await ctx.service.getUserBySession(login.token))?.username).toBe('a7');
  });

  it('logout with no input and unknown token does nothing', async () => {
    const ctx = makeService();
    await ctx.service.logout();
    await ctx.service.logout('unknown-token');
    expect(true).toBe(true);
  });

  it('verifyEmail with empty token throws', async () => {
    const ctx = makeService();
    await expect(ctx.service.verifyEmail('')).rejects.toBeInstanceOf(InvalidTokenError);
    await expect(ctx.service.verifyEmail({ token: '' })).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('verifyEmail when user missing throws', async () => {
    // consume a token whose user doesn't exist by tampering: issue then delete user
    const ctx = makeService();
    await ctx.service.register({ username: 'a8', email: 'a8@x.com', password: 'password1234' });
    const user = await ctx.users.findByUsername('a8');
    await ctx.tokens.issue(user!.id, 1000, ctx.nowRef());
    // delete user by not possible in repo; instead use a fresh token for nonexistent user id by direct repo
    const fakeTokenRepo = ctx.tokens;
    // issue for a nonexistent user id
    const { token: t2 } = await fakeTokenRepo.issue('nonexistent-user-id', 1000, ctx.nowRef());
    await expect(ctx.service.verifyEmail(t2)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('register catch branch when create throws DuplicateUserError', async () => {
    // Use a repo where findByUsername/findByEmail return null but create throws DuplicateUserError
    const ctx = makeService();
    // monkeypatch users
    const origFind = ctx.users.findByUsername.bind(ctx.users);
    const origFindEmail = ctx.users.findByEmail.bind(ctx.users);
    ctx.users.findByUsername = async () => null;
    ctx.users.findByEmail = async () => null;
    ctx.users.create = async () => { throw new DuplicateUserError('username'); };
    await expect(ctx.service.register({ username: 'dup', email: 'dup@x.com', password: 'password1234' })).rejects.toBeInstanceOf(DuplicateAccountError);
    ctx.users.findByUsername = origFind;
    ctx.users.findByEmail = origFindEmail;
  });

  it('constructor alias names work', async () => {
    const users = new (await import('./user-repository.js')).InMemoryUserRepository({ now: () => FIXED_NOW });
    const sessions = new (await import('./session-repository.js')).InMemorySessionRepository({ now: () => FIXED_NOW });
    const tokens = new (await import('./verification-token-repository.js')).InMemoryVerificationTokenRepository({ now: () => FIXED_NOW });
    const email = new (await import('./email.js')).FakeEmailService();
    const hasher = createPasswordHasher(DEFAULT_ARGON2_PARAMS);
    const rl = createRateLimiter(() => FIXED_NOW);
    const svc = new (await import('./auth-service.js')).AuthService({
      userRepo: users,
      sessionRepo: sessions,
      verificationTokenRepo: tokens,
      mailer: email,
      passwords: hasher,
      rateLimit: rl,
      now: () => FIXED_NOW,
      appBaseUrl: 'http://localhost:5173',
      sessionTtlDays: 7,
      verificationTokenTtlMs: VERIFY_TTL_MS,
    });
    const r = await svc.register({ username: 'alias', email: 'alias@x.com', password: 'password1234' });
    expect(r.user.username).toBe('alias');
  });

  it('register with config-provided argon params', async () => {
    makeService({
      passwordHasher: undefined,
      config: {
        appBaseUrl: 'http://localhost:5173',
        sessionTtlMs: SESSION_TTL_MS,
        verificationTokenTtlMs: VERIFY_TTL_MS,
        argon2MemoryCost: DEFAULT_ARGON2_MEMORY_COST,
        argon2TimeCost: DEFAULT_ARGON2_TIME_COST,
        argon2Parallelism: DEFAULT_ARGON2_PARALLELISM,
      },
    });
    // rebuild service manually to use config hasher path
    const users = new InMemoryUserRepository({ now: () => FIXED_NOW });
    const sessions = new InMemorySessionRepository({ now: () => FIXED_NOW });
    const tokens = new InMemoryVerificationTokenRepository({ now: () => FIXED_NOW });
    const email = new FakeEmailService();
    const rl = createRateLimiter(() => FIXED_NOW);
    const svc = createAuthService({
      users, sessions, verificationTokens: tokens, email, rateLimiter: rl, clock: () => FIXED_NOW,
      config: { appBaseUrl: 'http://localhost:5173', sessionTtlMs: SESSION_TTL_MS, verificationTokenTtlMs: VERIFY_TTL_MS, argon2MemoryCost: DEFAULT_ARGON2_MEMORY_COST, argon2TimeCost: DEFAULT_ARGON2_TIME_COST, argon2Parallelism: DEFAULT_ARGON2_PARALLELISM },
    });
    const r = await svc.register({ username: 'cfg', email: 'cfg@x.com', password: 'password1234' });
    expect(r.user.username).toBe('cfg');
  });
});


  it('createUser alias works', async () => {
    const ctx = makeService();
    const r = await ctx.service.createUser({ username: 'cu', email: 'cu@x.com', password: 'password1234' });
    expect(r.user.username).toBe('cu');
  });

  it('signInWithPassword alias works', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'sip', email: 'sip@x.com', password: 'password1234' });
    const r = await ctx.service.signInWithPassword({ username: 'sip', password: 'password1234' });
    expect(r.user.username).toBe('sip');
  });

  it('resendVerification with empty email throws', async () => {
    const ctx = makeService();
    await expect(ctx.service.resendVerification('')).rejects.toBeInstanceOf(ValidationError);
    await expect(ctx.service.resendVerification({ email: '' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('register rethrows non-duplicate errors from create', async () => {
    const ctx = makeService();
    ctx.users.findByUsername = async () => null;
    ctx.users.findByEmail = async () => null;
    ctx.users.create = async () => { throw new Error('boom'); };
    await expect(ctx.service.register({ username: 'x', email: 'x@x.com', password: 'password1234' })).rejects.toThrow('boom');
  });

  it('constructor throws for missing sessions/tokens/email', () => {
    const users = new InMemoryUserRepository({ now: () => FIXED_NOW });
    expect(() => createAuthService({ users } as unknown as Parameters<typeof createAuthService>[0])).toThrow();
    const sessions = new InMemorySessionRepository({ now: () => FIXED_NOW });
    expect(() => createAuthService({ users, sessions } as unknown as Parameters<typeof createAuthService>[0])).toThrow();
    const tokens = new InMemoryVerificationTokenRepository({ now: () => FIXED_NOW });
    expect(() => createAuthService({ users, sessions, verificationTokens: tokens } as unknown as Parameters<typeof createAuthService>[0])).toThrow();
  });


  it('getSession supports sessionToken property', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'st', email: 'st@x.com', password: 'password1234' });
    const login = await ctx.service.login({ username: 'st', password: 'password1234' });
    const u = await ctx.service.getSession({ sessionToken: login.token });
    expect(u?.username).toBe('st');
  });

  it('getSession returns null when user missing', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'mu', email: 'mu@x.com', password: 'password1234' });
    const login = await ctx.service.login({ username: 'mu', password: 'password1234' });
    const origFind = ctx.users.findById.bind(ctx.users);
    ctx.users.findById = async () => null;
    const res = await ctx.service.getSession(login.token);
    expect(res).toBeNull();
    ctx.users.findById = origFind;
  });


  it('resendVerification with missing email property throws', async () => {
    const ctx = makeService();
    await expect(ctx.service.resendVerification({} as unknown as { email?: string })).rejects.toBeInstanceOf(ValidationError);
  });

  it('logout with id property revokes by id', async () => {
    const ctx = makeService();
    await ctx.service.register({ username: 'lid', email: 'lid@x.com', password: 'password1234' });
    const login = await ctx.service.login({ username: 'lid', password: 'password1234' });
    await ctx.service.logout({ id: login.sessionId } as unknown as { token?: string; sessionId?: string; id?: string; sessionToken?: string });
    expect(await ctx.service.getSession(login.token)).toBeNull();
  });

  it('getSession returns null when session userId is null', async () => {
    const ctx = makeService();
    const orig = ctx.sessions.findByToken.bind(ctx.sessions);
    ctx.sessions.findByToken = async () => ({ id: 'sid', userId: null, expiresAt: ctx.nowRef() + 1000 });
    const res = await ctx.service.getSession('any-token');
    expect(res).toBeNull();
    ctx.sessions.findByToken = orig;
  });

describe('AuthService aliases and factory', () => {
  it('createAuthService works', async () => {
    const ctx = makeService();
    const r = await ctx.service.register({ username: 'factory', email: 'factory@x.com', password: 'password1234' });
    expect(r.user.username).toBe('factory');
  });
});

const TTL_2_HOURS_MS = 2 * 60 * 60 * 1000;

function makeServiceWithTtl(ttlMs: number) {
  return makeService({
    config: {
      appBaseUrl: 'http://localhost:5173',
      sessionTtlMs: SESSION_TTL_MS,
      verificationTokenTtlMs: ttlMs,
    },
  });
}

/** Records every send attempt, then rejects the configured number of times. */
class RejectingEmailService implements EmailService {
  readonly sent: CapturedVerificationEmail[] = [];
  private failuresRemaining: number;

  constructor(failuresRemaining: number) {
    this.failuresRemaining = failuresRemaining;
  }

  /** Makes the next send fail (after recording it), then clears. */
  failNextSend(): void {
    this.failuresRemaining += 1;
  }

  async sendVerification(
    to: string,
    verificationUrl: string,
    options?: VerificationEmailOptions,
  ): Promise<void> {
    this.sent.push({ to, verificationUrl, expiresInMs: options?.expiresInMs });
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error('SMTP transport failed: connection refused');
    }
  }
}

describe('AuthService verification TTL propagation (AC-19(b))', () => {
  it('register passes the non-default VERIFICATION_TOKEN_TTL_HOURS=2 lifetime to sendVerification', async () => {
    const { verificationTokenTtlMs } = loadAuthConfig({ VERIFICATION_TOKEN_TTL_HOURS: '2' });
    expect(verificationTokenTtlMs).toBe(TTL_2_HOURS_MS);

    const ctx = makeServiceWithTtl(verificationTokenTtlMs);
    await ctx.service.register({ username: 'ttl', email: 'ttl@x.com', password: 'password1234' });

    expect(ctx.email.sent).toHaveLength(1);
    expect(ctx.email.sent[0].to).toBe('ttl@x.com');
    expect(ctx.email.sent[0].expiresInMs).toBe(TTL_2_HOURS_MS);
  });

  it('resendVerification passes the same configured lifetime to sendVerification', async () => {
    const ctx = makeServiceWithTtl(TTL_2_HOURS_MS);
    await ctx.service.register({ username: 'ttl', email: 'ttl@x.com', password: 'password1234' });
    await ctx.service.resendVerification('ttl@x.com');

    expect(ctx.email.sent).toHaveLength(2);
    expect(ctx.email.sent[0].expiresInMs).toBe(TTL_2_HOURS_MS);
    expect(ctx.email.sent[1].to).toBe('ttl@x.com');
    expect(ctx.email.sent[1].expiresInMs).toBe(TTL_2_HOURS_MS);
  });

  it('renders "This link expires in 2 hours." through SmtpEmailService for VERIFICATION_TOKEN_TTL_HOURS=2', async () => {
    const sent: OutgoingEmail[] = [];
    const email = new SmtpEmailService(
      { host: 'mailpit', port: 1025, from: 'no-reply@cubeclicker.local' },
      () => ({
        sendMail: async (mail: OutgoingEmail) => {
          sent.push(mail);
        },
      }),
    );
    const { verificationTokenTtlMs } = loadAuthConfig({ VERIFICATION_TOKEN_TTL_HOURS: '2' });
    const ctx = makeService({
      email,
      config: {
        appBaseUrl: 'http://localhost:5173',
        sessionTtlMs: SESSION_TTL_MS,
        verificationTokenTtlMs,
      },
    });

    await ctx.service.register({ username: 'ttl', email: 'ttl@x.com', password: 'password1234' });

    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('ttl@x.com');
    expect(sent[0].subject).toBe('Verify your CubeClicker email');
    expect(sent[0].html).toContain('This link expires in 2 hours.');
  });
});

async function captureRejection<T extends Error>(promise: Promise<unknown>): Promise<T> {
  try {
    await promise;
  } catch (error) {
    return error as T;
  }
  throw new Error('expected the operation to reject');
}

describe('AuthService registration decision table (AC-4)', () => {
  const credentials = {
    username: 'alice',
    email: 'alice@example.com',
    password: 'password1234',
  };

  it('resumes one unverified row, rotates the token and omits resumed on a new registration', async () => {
    const ctx = makeService();
    const original = await ctx.service.register(credentials);
    const originalToken = new URL(ctx.email.sent[0].verificationUrl).searchParams.get('token')!;
    expect('resumed' in original).toBe(false);

    const createSpy = vi.spyOn(ctx.users, 'create');
    const issueSpy = vi.spyOn(ctx.tokens, 'issue');

    const resumed = await ctx.service.register({
      username: 'ALICE',
      email: 'Alice@Example.COM',
      password: credentials.password,
    });

    expect(resumed.resumed).toBe(true);
    expect(resumed.message).toBe('verification email sent');
    expect(resumed.user).toEqual({
      id: original.user.id,
      username: 'alice',
      email: 'alice@example.com',
      verified: false,
    });
    expect(createSpy).not.toHaveBeenCalled();
    expect(issueSpy).toHaveBeenCalledTimes(1);
    expect(issueSpy).toHaveBeenCalledWith(original.user.id, VERIFY_TTL_MS, FIXED_NOW);
    expect(ctx.email.sent).toHaveLength(2);
    expect(ctx.email.sent[1].to).toBe('alice@example.com');
    expect(ctx.email.sent[1].expiresInMs).toBe(VERIFY_TTL_MS);

    const freshToken = new URL(ctx.email.sent[1].verificationUrl).searchParams.get('token')!;
    expect(freshToken).not.toBe(originalToken);
    await expect(ctx.service.verifyEmail(originalToken)).rejects.toBeInstanceOf(InvalidTokenError);
    const verified = await ctx.service.verifyEmail(freshToken);
    expect(verified.user.id).toBe(original.user.id);
  });

  it('rejects a wrong password on the same row with both ordered fields and no send or token', async () => {
    const ctx = makeService();
    await ctx.service.register(credentials);
    const issueSpy = vi.spyOn(ctx.tokens, 'issue');
    const invalidateSpy = vi.spyOn(ctx.tokens, 'invalidateForUser');

    const error = await captureRejection<DuplicateAccountError>(
      ctx.service.register({ ...credentials, password: 'wrongpassword1' }),
    );

    expect(error).toBeInstanceOf(DuplicateAccountError);
    expect(error.status).toBe(409);
    expect(error.code).toBe('duplicate_account');
    expect(error.message).toBe('account already exists');
    expect(error.field).toBe('both');
    expect(error.fields).toEqual(['username', 'email']);
    expect(ctx.email.sent).toHaveLength(1);
    expect(issueSpy).not.toHaveBeenCalled();
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('rejects an already-verified same-pair row with both fields and no resume', async () => {
    const ctx = makeService();
    await ctx.service.register(credentials);
    const token = new URL(ctx.email.sent[0].verificationUrl).searchParams.get('token')!;
    await ctx.service.verifyEmail(token);
    const issueSpy = vi.spyOn(ctx.tokens, 'issue');

    const error = await captureRejection<DuplicateAccountError>(
      ctx.service.register(credentials),
    );

    expect(error.field).toBe('both');
    expect(error.fields).toEqual(['username', 'email']);
    expect(ctx.email.sent).toHaveLength(1);
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it('limits resume to three per hour per account and opens a new window after one hour', async () => {
    const ctx = makeService();
    await ctx.service.register(credentials);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await ctx.service.register(credentials);
      expect(result.resumed).toBe(true);
    }
    expect(ctx.email.sent).toHaveLength(4);

    const error = await captureRejection<RateLimitError>(ctx.service.register(credentials));
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.status).toBe(429);
    expect(error.code).toBe('rate_limited');
    expect(error.message).toBe('rate limit exceeded');
    expect(ctx.email.sent).toHaveLength(4);

    ctx.advance(60 * 60 * 1000);
    const afterWindow = await ctx.service.register(credentials);
    expect(afterWindow.resumed).toBe(true);
    expect(ctx.email.sent).toHaveLength(5);
  });

  it('reports both ordered fields when username and email belong to different rows (U1/U2)', async () => {
    const ctx = makeService();
    await ctx.service.register({
      username: 'raultorraco',
      email: 'one@example.com',
      password: 'password1234',
    });
    await ctx.service.register({
      username: 'raultorraco123',
      email: 'two@example.com',
      password: 'differentpass1',
    });
    const issueSpy = vi.spyOn(ctx.tokens, 'issue');

    const error = await captureRejection<DuplicateAccountError>(
      ctx.service.register({
        username: 'RAULTORRACO',
        email: 'TWO@EXAMPLE.COM',
        password: 'password1234',
      }),
    );

    expect(error).toBeInstanceOf(DuplicateAccountError);
    expect(error.field).toBe('both');
    expect(error.fields).toEqual(['username', 'email']);
    expect(ctx.email.sent).toHaveLength(2);
    expect(issueSpy).not.toHaveBeenCalled();
  });
});

describe('DuplicateAccountError field contract (AC-5)', () => {
  it('canonicalizes arrays and never omits fields', () => {
    const reordered = new DuplicateAccountError(['email', 'username']);
    expect(reordered.field).toBe('both');
    expect(reordered.fields).toEqual(['username', 'email']);

    const unknown = new DuplicateAccountError('unknown');
    expect(unknown.field).toBe('both');
    expect(unknown.fields).toEqual(['username', 'email']);

    const absent = new DuplicateAccountError();
    expect(absent.field).toBe('both');
    expect(absent.fields).toEqual(['username', 'email']);

    const empty = new DuplicateAccountError([]);
    expect(empty.field).toBe('both');
    expect(empty.fields).toEqual(['username', 'email']);
  });
});

describe('AuthService duplicate race re-query (AC-5(f))', () => {
  it('re-queries both identifiers on an unknown duplicate and reports the raced username', async () => {
    const ctx = makeService();
    await ctx.users.create({
      username: 'taken',
      email: 'taken@example.com',
      passwordHash: await ctx.hasher.hash('password1234'),
    });
    const realFindByUsername = ctx.users.findByUsername.bind(ctx.users);
    let usernameLookups = 0;
    const findByUsername = vi
      .spyOn(ctx.users, 'findByUsername')
      .mockImplementation(async (username: string) => {
        usernameLookups += 1;
        return usernameLookups === 1 ? null : realFindByUsername(username);
      });
    const findByEmail = vi.spyOn(ctx.users, 'findByEmail');
    const create = vi
      .spyOn(ctx.users, 'create')
      .mockRejectedValue(new DuplicateUserError('unknown'));

    const error = await captureRejection<DuplicateAccountError>(
      ctx.service.register({
        username: 'taken',
        email: 'new@example.com',
        password: 'password1234',
      }),
    );

    expect(error).toBeInstanceOf(DuplicateAccountError);
    expect(error.field).toBe('username');
    expect(error.fields).toEqual(['username']);
    expect(create).toHaveBeenCalledTimes(1);
    expect(findByUsername).toHaveBeenCalledTimes(2);
    expect(findByEmail).toHaveBeenCalledTimes(2);
    expect(ctx.email.sent).toHaveLength(0);
  });

  it('falls back to both fields when the unknown-duplicate re-query finds nothing', async () => {
    const ctx = makeService();
    vi.spyOn(ctx.users, 'create').mockRejectedValue(new DuplicateUserError('unknown'));
    const findByUsername = vi.spyOn(ctx.users, 'findByUsername');
    const findByEmail = vi.spyOn(ctx.users, 'findByEmail');

    const error = await captureRejection<DuplicateAccountError>(
      ctx.service.register({
        username: 'ghost',
        email: 'ghost@example.com',
        password: 'password1234',
      }),
    );

    expect(error.field).toBe('both');
    expect(error.fields).toEqual(['username', 'email']);
    expect(findByUsername).toHaveBeenCalledTimes(2);
    expect(findByEmail).toHaveBeenCalledTimes(2);
    expect(ctx.email.sent).toHaveLength(0);
  });
});

describe('AuthService failed-send token invalidation (AC-3(c))', () => {
  const credentials = {
    username: 'flaky',
    email: 'flaky@example.com',
    password: 'password1234',
  };

  it('invalidates the create-issued token when the send rejects', async () => {
    const rejecting = new RejectingEmailService(1);
    const ctx = makeService({ email: rejecting });
    const issueSpy = vi.spyOn(ctx.tokens, 'issue');
    const invalidateSpy = vi.spyOn(ctx.tokens, 'invalidateForUser');

    const error = await captureRejection<Error>(ctx.service.register(credentials));

    expect(error.message).toBe('SMTP transport failed: connection refused');
    expect(issueSpy).toHaveBeenCalledTimes(1);
    const issued = (await issueSpy.mock.results[0]!.value) as { token: string };
    expect(issued.token).toHaveLength(64);
    expect(await ctx.tokens.consume(issued.token)).toBeNull();

    const persisted = await ctx.users.findByEmail(credentials.email);
    if (persisted === null) throw new Error('expected the account to persist');
    expect(persisted.username).toBe('flaky');
    expect(persisted.verified).toBe(false);
    expect(issueSpy.mock.calls[0]![0]).toBe(persisted.id);
    expect(invalidateSpy).toHaveBeenCalledWith(persisted.id);
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });

  it('invalidates the resume-issued token when the resume send rejects', async () => {
    const rejecting = new RejectingEmailService(0);
    const ctx = makeService({ email: rejecting });
    const original = await ctx.service.register(credentials);
    const originalToken = new URL(rejecting.sent[0]!.verificationUrl).searchParams.get('token')!;
    rejecting.failNextSend();

    const issueSpy = vi.spyOn(ctx.tokens, 'issue');
    const invalidateSpy = vi.spyOn(ctx.tokens, 'invalidateForUser');

    const error = await captureRejection<Error>(ctx.service.register(credentials));

    expect(error.message).toBe('SMTP transport failed: connection refused');
    expect(issueSpy).toHaveBeenCalledTimes(1);
    const issued = (await issueSpy.mock.results[0]!.value) as { token: string };
    expect(issued.token).toHaveLength(64);
    expect(await ctx.tokens.consume(issued.token)).toBeNull();
    expect(await ctx.tokens.consume(originalToken)).toBeNull();
    expect(rejecting.sent).toHaveLength(2);
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, original.user.id);
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, original.user.id);
  });

  it('invalidates the resend-issued token when the resend send rejects', async () => {
    const rejecting = new RejectingEmailService(0);
    const ctx = makeService({ email: rejecting });
    const original = await ctx.service.register(credentials);
    const originalToken = new URL(rejecting.sent[0]!.verificationUrl).searchParams.get('token')!;
    rejecting.failNextSend();

    const issueSpy = vi.spyOn(ctx.tokens, 'issue');
    const invalidateSpy = vi.spyOn(ctx.tokens, 'invalidateForUser');

    const error = await captureRejection<Error>(ctx.service.resendVerification(credentials.email));

    expect(error.message).toBe('SMTP transport failed: connection refused');
    expect(issueSpy).toHaveBeenCalledTimes(1);
    const issued = (await issueSpy.mock.results[0]!.value) as { token: string };
    expect(issued.token).toHaveLength(64);
    expect(await ctx.tokens.consume(issued.token)).toBeNull();
    expect(await ctx.tokens.consume(originalToken)).toBeNull();
    expect(rejecting.sent).toHaveLength(2);
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, original.user.id);
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, original.user.id);
  });

  it('still surfaces the delivery failure when best-effort invalidation rejects', async () => {
    const rejecting = new RejectingEmailService(1);
    const ctx = makeService({ email: rejecting });
    ctx.tokens.invalidateForUser = async () => {
      throw new Error('invalidation failed');
    };

    const error = await captureRejection<Error>(ctx.service.register(credentials));

    expect(error.name).toBe('Error');
    expect(error.message).toBe('SMTP transport failed: connection refused');
    expect(rejecting.sent).toHaveLength(1);
  });
});

describe('AuthService email identifier login (AC-6)', () => {
  const credentials = {
    username: 'alice',
    email: 'alice@example.com',
    password: 'password1234',
  };

  it('logs in by a mixed-case email identifier and issues one session', async () => {
    const ctx = makeService();
    const registered = await ctx.service.register(credentials);

    const result = await ctx.service.login({
      username: 'Alice@Example.COM',
      password: credentials.password,
    });

    expect(result.user).toEqual({
      id: registered.user.id,
      username: 'alice',
      email: 'alice@example.com',
      verified: false,
    });
    expect(result.token).toHaveLength(64);
    expect(result.expiresAt).toBe(FIXED_NOW + SESSION_TTL_MS);
    const sessionUser = await ctx.service.getSession(result.token);
    expect(sessionUser?.username).toBe('alice');
  });

  it('accepts the identifier alias and prefers username when both are present', async () => {
    const ctx = makeService();
    await ctx.service.register(credentials);

    const byIdentifier = await ctx.service.login({
      identifier: 'alice@example.com',
      password: credentials.password,
    } as unknown as { username: string; password: string });
    expect(byIdentifier.user.username).toBe('alice');

    const usernameWins = await ctx.service.login({
      username: 'alice',
      identifier: 'ghost@example.com',
      password: credentials.password,
    } as unknown as { username: string; password: string });
    expect(usernameWins.user.username).toBe('alice');
  });

  it('returns the generic 401 for an unknown email and only queries by email', async () => {
    const ctx = makeService();
    const findByUsername = vi.spyOn(ctx.users, 'findByUsername');
    const findByEmail = vi.spyOn(ctx.users, 'findByEmail');

    const error = await captureRejection<InvalidCredentialsError>(
      ctx.service.login({ username: 'ghost@example.com', password: credentials.password }),
    );

    expect(error).toBeInstanceOf(InvalidCredentialsError);
    expect(error.status).toBe(401);
    expect(error.code).toBe('invalid_credentials');
    expect(error.message).toBe('invalid credentials');
    expect(findByUsername).not.toHaveBeenCalled();
    expect(findByEmail).toHaveBeenCalledTimes(1);
    expect(findByEmail).toHaveBeenCalledWith('ghost@example.com');
  });

  it('never falls back to a username lookup when the identifier contains @', async () => {
    const ctx = makeService();
    await ctx.service.register({
      username: 'at@name.example',
      email: 'real@example.com',
      password: credentials.password,
    });
    const findByUsername = vi.spyOn(ctx.users, 'findByUsername');

    const error = await captureRejection<InvalidCredentialsError>(
      ctx.service.login({ username: 'at@name.example', password: credentials.password }),
    );

    expect(error.status).toBe(401);
    expect(error.message).toBe('invalid credentials');
    expect(findByUsername).not.toHaveBeenCalled();
  });

  it('increments the failure counter for a wrong password on an email identifier', async () => {
    const ctx = makeService();
    await ctx.service.register(credentials);

    const error = await captureRejection<InvalidCredentialsError>(
      ctx.service.login({ username: 'alice@example.com', password: 'wrongpassword1' }),
    );

    expect(error.status).toBe(401);
    expect(error.code).toBe('invalid_credentials');
    const user = await ctx.users.findByEmail(credentials.email);
    if (user === null) throw new Error('expected the account to exist');
    expect(user.failedLoginAttempts).toBe(1);
    expect(user.lockedUntil).toBeNull();
  });

  it('locks after five failed email logins and returns Retry-After on a locked email login', async () => {
    const ctx = makeService();
    await ctx.service.register(credentials);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(
        ctx.service.login({ username: 'alice@example.com', password: 'wrongpassword1' }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    }
    await expect(
      ctx.service.login({ username: 'alice@example.com', password: 'wrongpassword1' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);

    const error = await captureRejection<AccountLockedError>(
      ctx.service.login({ username: 'ALICE@EXAMPLE.COM', password: credentials.password }),
    );

    expect(error).toBeInstanceOf(AccountLockedError);
    expect(error.status).toBe(429);
    expect(error.code).toBe('account_locked');
    expect(error.message).toBe('account locked');
    expect(error.retryAfter).toBe(15 * 60);
  });
});

describe('AuthService transport failure recovery (AC-10)', () => {
  it('persists the account unverified and issues no session when the transport rejects on register', async () => {
    const rejecting = new RejectingEmailService(1);
    const ctx = makeService({ email: rejecting });
    const createdSessionUserIds: string[] = [];
    const createSession = ctx.sessions.create.bind(ctx.sessions);
    ctx.sessions.create = async (userId, ttlMs) => {
      createdSessionUserIds.push(String(userId));
      return createSession(userId, ttlMs);
    };

    const error = await ctx.service
      .register({ username: 'flaky', email: 'flaky@x.com', password: 'password1234' })
      .catch((reason: unknown) => reason as Error);

    expect(error.message).toBe('SMTP transport failed: connection refused');
    expect(rejecting.sent).toHaveLength(1);
    expect(rejecting.sent[0].to).toBe('flaky@x.com');
    expect(rejecting.sent[0].expiresInMs).toBe(VERIFY_TTL_MS);

    const persisted = await ctx.users.findByEmail('flaky@x.com');
    expect(persisted).not.toBeNull();
    expect(persisted!.username).toBe('flaky');
    expect(persisted!.verified).toBe(false);
    expect(createdSessionUserIds).toEqual([]);
  });

  it('resend recovers after a registration transport failure with a new email and a fresh token', async () => {
    const rejecting = new RejectingEmailService(1);
    const ctx = makeService({ email: rejecting });

    const error = await ctx.service
      .register({ username: 'flaky', email: 'flaky@x.com', password: 'password1234' })
      .catch((reason: unknown) => reason as Error);
    expect(error.message).toBe('SMTP transport failed: connection refused');

    const res = await ctx.service.resendVerification('flaky@x.com');
    expect(res.message).toBe('verification email sent');
    expect(rejecting.sent).toHaveLength(2);

    const firstToken = new URL(rejecting.sent[0].verificationUrl).searchParams.get('token');
    const secondToken = new URL(rejecting.sent[1].verificationUrl).searchParams.get('token');
    expect(firstToken).toMatch(/^[0-9a-f]{64}$/);
    expect(secondToken).toMatch(/^[0-9a-f]{64}$/);
    expect(secondToken).not.toBe(firstToken);
    expect(rejecting.sent[1].to).toBe('flaky@x.com');
    expect(rejecting.sent[1].expiresInMs).toBe(VERIFY_TTL_MS);

    await expect(ctx.service.verifyEmail(firstToken!)).rejects.toBeInstanceOf(InvalidTokenError);
    const verified = await ctx.service.verifyEmail(secondToken!);
    expect(verified.user.verified).toBe(true);
  });
});
