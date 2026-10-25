import { describe, expect, it } from 'vitest';

import {
  InMemoryUserRepository,
} from './user-repository.js';
import {
  InMemorySessionRepository,
} from './session-repository.js';
import {
  InMemoryVerificationTokenRepository,
} from './verification-token-repository.js';
import { FakeEmailService } from './email.js';
import { createPasswordHasher, DEFAULT_ARGON2_PARAMS, verifyPassword } from './password.js';
import { DEFAULT_ARGON2_MEMORY_COST, DEFAULT_ARGON2_TIME_COST, DEFAULT_ARGON2_PARALLELISM } from './config.js';
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
    const { service, email } = makeService();
    await service.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    const emailCountBefore = email.sent.length;
    let thrown: unknown;
    try {
      await service.register({ username: 'ALICE', email: 'b@x.com', password: 'password1234' });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(DuplicateAccountError);
    expect((thrown as DuplicateAccountError).status).toBe(409);
    expect((thrown as DuplicateAccountError).field).toBe('username');
    expect(email.sent.length).toBe(emailCountBefore);
  });

  it('rejects duplicate email with 409', async () => {
    const { service } = makeService();
    await service.register({ username: 'alice', email: 'a@x.com', password: 'password1234' });
    let thrown: unknown;
    try {
      await service.register({ username: 'bob', email: 'A@X.COM', password: 'password1234' });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(DuplicateAccountError);
    expect((thrown as DuplicateAccountError).field).toBe('email');
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
    const { DuplicateUserError } = await import('./user-repository.js');
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
    expect(ctx.service).toBeDefined();
  });
});
