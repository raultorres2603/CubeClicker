import { describe, expect, it, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { createAuthService } from './auth-service.js';
import { InMemoryUserRepository } from './user-repository.js';
import { InMemorySessionRepository } from './session-repository.js';
import { InMemoryVerificationTokenRepository } from './verification-token-repository.js';
import { FakeEmailService, type CapturedVerificationEmail, type EmailService } from './email.js';
import type { VerificationEmailOptions } from './email-template.js';
import { createPasswordHasher, DEFAULT_ARGON2_PARAMS } from './password.js';
import { createRateLimiter } from './rate-limit.js';
import authRoutes, { SESSION_COOKIE_NAME } from './auth-routes.js';
import type { SessionCookieSameSite } from './config.js';

const FIXED_NOW = 1_700_000_000_000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

interface RecordingEmailService extends EmailService {
  readonly sent: CapturedVerificationEmail[];
}

/** Records every send attempt, then rejects the configured number of times. */
class FlakyRecordingEmailService implements RecordingEmailService {
  readonly sent: CapturedVerificationEmail[] = [];
  private failuresRemaining: number;

  constructor(failuresRemaining: number) {
    this.failuresRemaining = failuresRemaining;
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

interface Ctx {
  app: FastifyInstance;
  service: ReturnType<typeof createAuthService>;
  users: InMemoryUserRepository;
  sessions: InMemorySessionRepository;
  tokens: InMemoryVerificationTokenRepository;
  email: RecordingEmailService;
  rateLimiter: ReturnType<typeof createRateLimiter>;
  clock: () => number;
}

interface CookieOptions {
  sessionCookieSecure?: boolean;
  sessionCookieSameSite?: SessionCookieSameSite;
}

async function buildCtx(
  cookieOptions: CookieOptions = {},
  emailService: RecordingEmailService = new FakeEmailService(),
): Promise<Ctx> {
  let now = FIXED_NOW;
  const clock = () => now;
  const users = new InMemoryUserRepository({ now: clock });
  const sessions = new InMemorySessionRepository({ now: clock });
  const tokens = new InMemoryVerificationTokenRepository({ now: clock });
  const email = emailService;
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
    config: { appBaseUrl: 'http://localhost:5173', sessionTtlMs: SESSION_TTL_MS, verificationTokenTtlMs: VERIFICATION_TTL_MS },
  });

  const app = Fastify();
  await app.register(authRoutes, {
    authService: service,
    sessions,
    rateLimiter,
    clock,
    allowedOrigin: 'http://localhost:5173',
    sessionCookieSecure: cookieOptions.sessionCookieSecure ?? false,
    sessionCookieSameSite: cookieOptions.sessionCookieSameSite ?? 'lax',
    sessionTtlMs: SESSION_TTL_MS,
  });
  await app.ready();
  return { app, service, users, sessions, tokens, email, rateLimiter, clock: () => now, advance: (ms: number) => { now += ms; } } as Ctx & { advance: (ms: number) => void };
}

function getSetCookie(res: { headers: Record<string, unknown> }): string {
  const v = res.headers['set-cookie'];
  if (Array.isArray(v)) return v.join('; ');
  return String(v ?? '');
}

function cookieValue(setCookie: string, name: string): string | undefined {
  const m = setCookie.match(new RegExp(`(?:^|;\\s*|,\\s*)${name}=([^;]+)`));
  return m ? m[1] : undefined;
}

describe('auth routes', () => {
  let ctx: Ctx & { advance: (ms: number) => void };

  beforeEach(async () => {
    ctx = await buildCtx();
  });

  it('POST /auth/register returns 202 and message', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'Alice@Example.com', password: 'password1234' },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().message).toBe('verification email sent');
  });

  it('POST /auth/register duplicate username returns 409', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    const res = await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'ALICE', email: 'b@x.com', password: 'password1234' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('POST /auth/register duplicate email returns 409', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    const res = await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'bob', email: 'A@X.COM', password: 'password1234' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('POST /auth/register password boundaries', async () => {
    const short = await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'u1', email: 'u1@x.com', password: 'a'.repeat(11) },
    });
    expect(short.statusCode).toBe(400);
    const ok12 = await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'u2', email: 'u2@x.com', password: 'a'.repeat(12) },
    });
    expect(ok12.statusCode).toBe(202);
    const long129 = await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'u3', email: 'u3@x.com', password: 'a'.repeat(129) },
    });
    expect(long129.statusCode).toBe(400);
  });

  it('POST /auth/register rate limit 5/min returns 429', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await ctx.app.inject({
        method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
        payload: { username: `u${i}`, email: `u${i}@x.com`, password: 'password1234' },
      });
      expect(r.statusCode).toBe(202);
    }
    const r = await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'u9', email: 'u9@x.com', password: 'password1234' },
    });
    expect(r.statusCode).toBe(429);
  });

  it('POST /auth/login success sets cookie and returns user', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    const res = await ctx.app.inject({
      method: 'POST', url: '/auth/login', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', password: 'password1234' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.username).toBe('alice');
    expect(res.json().user.email).toBe('a@x.com');
    expect(res.json().user.verified).toBe(false);
    const sc = getSetCookie(res);
    expect(sc).toContain('HttpOnly');
    expect(sc).toContain('SameSite=Lax');
    expect(sc).not.toContain('Secure');
    expect(sc).toContain('Path=/');
    expect(cookieValue(sc, SESSION_COOKIE_NAME)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('POST /auth/login invalid credentials returns 401', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    const res = await ctx.app.inject({
      method: 'POST', url: '/auth/login', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', password: 'wrongpassword1' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /auth/login unknown user returns 401', async () => {
    const res = await ctx.app.inject({
      method: 'POST', url: '/auth/login', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'ghost', password: 'password1234' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /auth/login rate limit 10/min returns 429', async () => {
    for (let i = 0; i < 10; i++) {
      const r = await ctx.app.inject({
        method: 'POST', url: '/auth/login', headers: { origin: 'http://localhost:5173' },
        payload: { username: 'ghost', password: 'wrongpassword1' },
      });
      expect(r.statusCode).toBe(401);
    }
    const r = await ctx.app.inject({
      method: 'POST', url: '/auth/login', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', password: 'wrongpassword1' },
    });
    expect(r.statusCode).toBe(429);
  });

  it('POST /auth/login locked account returns 429 with Retry-After', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    for (let i = 0; i < 5; i++) {
      await ctx.app.inject({
        method: 'POST', url: '/auth/login', headers: { origin: 'http://localhost:5173' },
        payload: { username: 'alice', password: 'wrongpassword1' },
      });
    }
    const res = await ctx.app.inject({
      method: 'POST', url: '/auth/login', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', password: 'password1234' },
    });
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBe('900');
  });

  it('GET /auth/me without cookie returns 401', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /auth/me with valid cookie returns user', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    const login = await ctx.app.inject({
      method: 'POST', url: '/auth/login', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', password: 'password1234' },
    });
    const sc = getSetCookie(login);
    const token = cookieValue(sc, SESSION_COOKIE_NAME)!;
    const res = await ctx.app.inject({
      method: 'GET', url: '/auth/me', headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.username).toBe('alice');
  });

  it('POST /auth/logout revokes session and clears cookie', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    const login = await ctx.app.inject({
      method: 'POST', url: '/auth/login', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', password: 'password1234' },
    });
    const token = cookieValue(getSetCookie(login), SESSION_COOKIE_NAME)!;
    const logout = await ctx.app.inject({
      method: 'POST', url: '/auth/logout', headers: { origin: 'http://localhost:5173', cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    expect(logout.statusCode).toBe(204);
    const sc = getSetCookie(logout);
    const cleared = sc.toLowerCase().includes('max-age=0') || sc.includes('Expires=Thu, 01 Jan 1970');
    expect(cleared).toBe(true);
    const me = await ctx.app.inject({
      method: 'GET', url: '/auth/me', headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    expect(me.statusCode).toBe(401);
  });

  it('POST /auth/verify with token sets cookie and activates', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    const url = ctx.email.sent[0].verificationUrl;
    const token = new URL(url).searchParams.get('token')!;
    const res = await ctx.app.inject({
      method: 'POST', url: '/auth/verify', headers: { origin: 'http://localhost:5173' },
      payload: { token },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.verified).toBe(true);
    const sc = getSetCookie(res);
    expect(sc).toContain('HttpOnly');
    expect(cookieValue(sc, SESSION_COOKIE_NAME)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('GET /auth/verify with query token activates', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    const url = ctx.email.sent[0].verificationUrl;
    const token = new URL(url).searchParams.get('token')!;
    const res = await ctx.app.inject({
      method: 'GET', url: `/auth/verify?token=${token}`, headers: { origin: 'http://localhost:5173' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.verified).toBe(true);
  });

  it('POST /auth/verify reused token returns 400', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    const url = ctx.email.sent[0].verificationUrl;
    const token = new URL(url).searchParams.get('token')!;
    await ctx.app.inject({ method: 'POST', url: '/auth/verify', headers: { origin: 'http://localhost:5173' }, payload: { token } });
    const res = await ctx.app.inject({ method: 'POST', url: '/auth/verify', headers: { origin: 'http://localhost:5173' }, payload: { token } });
    expect(res.statusCode).toBe(400);
  });

  it('POST /auth/verify unknown token returns 400', async () => {
    const res = await ctx.app.inject({
      method: 'POST', url: '/auth/verify', headers: { origin: 'http://localhost:5173' },
      payload: { token: 'deadbeef' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /auth/resend returns 202 and sends email', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    const before = ctx.email.sent.length;
    const res = await ctx.app.inject({
      method: 'POST', url: '/auth/resend', headers: { origin: 'http://localhost:5173' },
      payload: { email: 'a@x.com' },
    });
    expect(res.statusCode).toBe(202);
    expect(ctx.email.sent.length).toBe(before + 1);
  });

  it('POST /auth/resend-verification alias works', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    const res = await ctx.app.inject({
      method: 'POST', url: '/auth/resend-verification', headers: { origin: 'http://localhost:5173' },
      payload: { email: 'a@x.com' },
    });
    expect(res.statusCode).toBe(202);
  });

  it('POST /auth/resend unknown email still 202 (no enumeration)', async () => {
    const res = await ctx.app.inject({
      method: 'POST', url: '/auth/resend', headers: { origin: 'http://localhost:5173' },
      payload: { email: 'ghost@x.com' },
    });
    expect(res.statusCode).toBe(202);
  });

  it('POST /auth/resend rate limit 3/hour returns 429', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    for (let i = 0; i < 3; i++) {
      const r = await ctx.app.inject({
        method: 'POST', url: '/auth/resend', headers: { origin: 'http://localhost:5173' },
        payload: { email: 'a@x.com' },
      });
      expect(r.statusCode).toBe(202);
    }
    const r = await ctx.app.inject({
      method: 'POST', url: '/auth/resend', headers: { origin: 'http://localhost:5173' },
      payload: { email: 'a@x.com' },
    });
    expect(r.statusCode).toBe(429);
  });

  it('Origin mismatch returns 403 on state-changing endpoints', async () => {
    const res = await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://evil.example' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('sliding touch updates cookie expiry', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    const login = await ctx.app.inject({
      method: 'POST', url: '/auth/login', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', password: 'password1234' },
    });
    const token = cookieValue(getSetCookie(login), SESSION_COOKIE_NAME)!;
    // advance clock
    (ctx as unknown as { advance: (n: number) => void }).advance(1000);
    const touch = await ctx.app.inject({
      method: 'POST', url: '/auth/session-touch', headers: { origin: 'http://localhost:5173', cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
    expect(touch.statusCode).toBe(200);
    const sc = getSetCookie(touch);
    expect(cookieValue(sc, SESSION_COOKIE_NAME)).toBe(token);
  });

  it('single active session: revoked token returns 401 after re-login', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    const first = await ctx.app.inject({
      method: 'POST', url: '/auth/login', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', password: 'password1234' },
    });
    const firstToken = cookieValue(getSetCookie(first), SESSION_COOKIE_NAME)!;
    await ctx.app.inject({
      method: 'POST', url: '/auth/login', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', password: 'password1234' },
    });
    const me = await ctx.app.inject({
      method: 'GET', url: '/auth/me', headers: { cookie: `${SESSION_COOKIE_NAME}=${firstToken}` },
    });
    expect(me.statusCode).toBe(401);
  });

  it('secure cookie flag reflects config', async () => {
    // build a separate app with secure true
    const now = FIXED_NOW;
    const clock = () => now;
    const users = new InMemoryUserRepository({ now: clock });
    const sessions = new InMemorySessionRepository({ now: clock });
    const tokens = new InMemoryVerificationTokenRepository({ now: clock });
    const email = new FakeEmailService();
    const hasher = createPasswordHasher(DEFAULT_ARGON2_PARAMS);
    const rl = createRateLimiter(clock);
    const service = createAuthService({ users, sessions, verificationTokens: tokens, email, passwordHasher: hasher, rateLimiter: rl, clock, config: { appBaseUrl: 'http://localhost:5173', sessionTtlMs: SESSION_TTL_MS, verificationTokenTtlMs: 24 * 60 * 60 * 1000 } });
    const app = Fastify();
    await app.register(authRoutes, { authService: service, sessions, rateLimiter: rl, clock, allowedOrigin: 'http://localhost:5173', sessionCookieSecure: true, sessionTtlMs: SESSION_TTL_MS });
    await app.ready();
    await app.inject({ method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' }, payload: { username: 'alice', email: 'a@x.com', password: 'password1234' } });
    const login = await app.inject({ method: 'POST', url: '/auth/login', headers: { origin: 'http://localhost:5173' }, payload: { username: 'alice', password: 'password1234' } });
    const sc = getSetCookie(login);
    expect(sc).toContain('Secure');
    await app.close();
  });

  it('sets and clears a SameSite=None; Secure cookie when configured', async () => {
    const cloud = await buildCtx({ sessionCookieSecure: true, sessionCookieSameSite: 'none' });
    try {
      await cloud.app.inject({
        method: 'POST',
        url: '/auth/register',
        headers: { origin: 'http://localhost:5173' },
        payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
      });
      const login = await cloud.app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { origin: 'http://localhost:5173' },
        payload: { username: 'alice', password: 'password1234' },
      });
      expect(login.statusCode).toBe(200);
      const sc = getSetCookie(login);
      expect(sc).toContain('HttpOnly');
      expect(sc).toContain('Secure');
      expect(sc).toContain('SameSite=None');
      expect(sc).toContain('Path=/');

      const token = cookieValue(sc, SESSION_COOKIE_NAME)!;
      const logout = await cloud.app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { origin: 'http://localhost:5173', cookie: `${SESSION_COOKIE_NAME}=${token}` },
      });
      expect(logout.statusCode).toBe(204);
      const cleared = getSetCookie(logout);
      expect(cleared).toContain('Secure');
      expect(cleared).toContain('SameSite=None');
      expect(cleared).toContain('Path=/');
    } finally {
      await cloud.app.close();
    }
  });

  it('uses the configured SameSite=Strict value for set and clear', async () => {
    const strict = await buildCtx({ sessionCookieSameSite: 'strict' });
    try {
      await strict.app.inject({
        method: 'POST',
        url: '/auth/register',
        headers: { origin: 'http://localhost:5173' },
        payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
      });
      const login = await strict.app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { origin: 'http://localhost:5173' },
        payload: { username: 'alice', password: 'password1234' },
      });
      const sc = getSetCookie(login);
      expect(sc).toContain('SameSite=Strict');
      expect(sc).not.toContain('Secure');

      const token = cookieValue(sc, SESSION_COOKIE_NAME)!;
      const logout = await strict.app.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: { origin: 'http://localhost:5173', cookie: `${SESSION_COOKIE_NAME}=${token}` },
      });
      const cleared = getSetCookie(logout);
      expect(cleared).toContain('SameSite=Strict');
      expect(cleared).not.toContain('Secure');
    } finally {
      await strict.app.close();
    }
  });

  it('accepts every origin in the configured allowlist and rejects others', async () => {
    const now = FIXED_NOW;
    const clock = () => now;
    const users = new InMemoryUserRepository({ now: clock });
    const sessions = new InMemorySessionRepository({ now: clock });
    const tokens = new InMemoryVerificationTokenRepository({ now: clock });
    const email = new FakeEmailService();
    const hasher = createPasswordHasher(DEFAULT_ARGON2_PARAMS);
    const rl = createRateLimiter(clock);
    const service = createAuthService({ users, sessions, verificationTokens: tokens, email, passwordHasher: hasher, rateLimiter: rl, clock, config: { appBaseUrl: 'http://localhost:5173', sessionTtlMs: SESSION_TTL_MS, verificationTokenTtlMs: 24 * 60 * 60 * 1000 } });
    const app = Fastify();
    await app.register(authRoutes, {
      authService: service,
      sessions,
      rateLimiter: rl,
      clock,
      allowedOrigins: ['https://app.example.test', 'https://admin.example.test'],
      sessionTtlMs: SESSION_TTL_MS,
    });
    await app.ready();
    try {
      const allowed = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { origin: 'https://admin.example.test' },
        payload: { username: 'ghost', password: 'password1234' },
      });
      expect(allowed.statusCode).toBe(401);

      const denied = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { origin: 'https://evil.example' },
        payload: { username: 'ghost', password: 'password1234' },
      });
      expect(denied.statusCode).toBe(403);
      expect(denied.json()).toEqual({ message: 'origin not allowed', code: 'origin_not_allowed' });
    } finally {
      await app.close();
    }
  });

  it('POST /auth/register transport rejection returns 500 internal_error, then resend recovers with a fresh token', async () => {
    const email = new FlakyRecordingEmailService(1);
    const failing = await buildCtx({}, email);
    const createdSessionUserIds: string[] = [];
    const createSession = failing.sessions.create.bind(failing.sessions);
    failing.sessions.create = async (userId, ttlMs) => {
      createdSessionUserIds.push(String(userId));
      return createSession(userId, ttlMs);
    };
    const headers = { origin: 'http://localhost:5173' };
    try {
      const res = await failing.app.inject({
        method: 'POST',
        url: '/auth/register',
        headers,
        payload: { username: 'flaky', email: 'flaky@x.com', password: 'password1234' },
      });
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({ message: 'internal error', code: 'internal_error', error: 'internal_error' });
      expect(getSetCookie(res)).toBe('');
      expect(createdSessionUserIds).toEqual([]);

      const persisted = await failing.users.findByEmail('flaky@x.com');
      expect(persisted).not.toBeNull();
      expect(persisted!.username).toBe('flaky');
      expect(persisted!.verified).toBe(false);

      const resend = await failing.app.inject({
        method: 'POST',
        url: '/auth/resend',
        headers,
        payload: { email: 'flaky@x.com' },
      });
      expect(resend.statusCode).toBe(202);
      expect(resend.json()).toEqual({ message: 'verification email sent' });
      expect(email.sent).toHaveLength(2);
      expect(email.sent[0].to).toBe('flaky@x.com');
      expect(email.sent[0].expiresInMs).toBe(VERIFICATION_TTL_MS);
      expect(email.sent[1].to).toBe('flaky@x.com');
      expect(email.sent[1].expiresInMs).toBe(VERIFICATION_TTL_MS);

      const firstToken = new URL(email.sent[0].verificationUrl).searchParams.get('token');
      const secondToken = new URL(email.sent[1].verificationUrl).searchParams.get('token');
      expect(firstToken).toMatch(/^[0-9a-f]{64}$/);
      expect(secondToken).toMatch(/^[0-9a-f]{64}$/);
      expect(secondToken).not.toBe(firstToken);

      const oldToken = await failing.app.inject({
        method: 'POST',
        url: '/auth/verify',
        headers,
        payload: { token: firstToken },
      });
      expect(oldToken.statusCode).toBe(400);
      expect(oldToken.json()).toEqual({ message: 'invalid or expired token', code: 'invalid_token', error: 'invalid_token' });

      const verification = await failing.app.inject({
        method: 'POST',
        url: '/auth/verify',
        headers,
        payload: { token: secondToken },
      });
      expect(verification.statusCode).toBe(200);
      expect(verification.json().user.email).toBe('flaky@x.com');
      expect(verification.json().user.verified).toBe(true);
      expect(getSetCookie(verification)).toContain('HttpOnly');
    } finally {
      await failing.app.close();
    }
  });
});
