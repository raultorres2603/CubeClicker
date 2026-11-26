import { describe, expect, it, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { createAuthService } from './auth-service.js';
import { InMemoryUserRepository } from './user-repository.js';
import { InMemorySessionRepository } from './session-repository.js';
import { InMemoryVerificationTokenRepository } from './verification-token-repository.js';
import {
  EmailDeliveryError,
  FakeEmailService,
  createEmailService,
  renderVerificationEmail,
  type BrevoRequest,
  type BrevoRequestInit,
  type CapturedVerificationEmail,
  type EmailService,
} from './email.js';
import type { VerificationEmailOptions } from './email-template.js';
import { createPasswordHasher, DEFAULT_ARGON2_PARAMS } from './password.js';
import { createRateLimiter } from './rate-limit.js';
import authRoutes, { SESSION_COOKIE_NAME } from './auth-routes.js';
import type { SessionCookieSameSite } from './config.js';
import { buildLoggerOptions } from '../observability/logging.js';

const FIXED_NOW = 1_700_000_000_000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const SMTP_HOST = 'smtp-relay.brevo.com';
const SMTP_PORT = 2525;

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

/**
 * Applies a scripted outcome per send: `null` succeeds, an `Error` rejects that
 * attempt. Attempts past the script succeed. It records the attempt first, so a
 * rejected send still proves which address was targeted.
 */
class ScriptedEmailService implements RecordingEmailService {
  readonly sent: CapturedVerificationEmail[] = [];
  private readonly outcomes: Array<Error | null>;

  constructor(outcomes: Array<Error | null> = []) {
    this.outcomes = [...outcomes];
  }

  async sendVerification(
    to: string,
    verificationUrl: string,
    options?: VerificationEmailOptions,
  ): Promise<void> {
    this.sent.push({ to, verificationUrl, expiresInMs: options?.expiresInMs });
    const outcome = this.outcomes.shift() ?? null;
    if (outcome !== null) {
      throw outcome;
    }
  }
}

/** Builds the typed failure the SMTP service raises for a transport rejection. */
function deliveryFailure(
  message = 'SMTP transport failed: connection refused',
  options: { code?: string; name?: string } = {},
): EmailDeliveryError {
  const source = new Error(message);
  if (options.name !== undefined) source.name = options.name;
  if (options.code !== undefined) Object.assign(source, { code: options.code });
  return new EmailDeliveryError(source, SMTP_HOST, SMTP_PORT);
}

interface CaptureStream {
  stream: { write(line: string): void };
  lines(): string[];
  text(): string;
}

/** Captures the JSON lines Pino writes through the logger test seam. */
function createCaptureStream(): CaptureStream {
  const chunks: string[] = [];
  return {
    stream: {
      write: (line: string) => {
        chunks.push(line);
      },
    },
    lines: () => chunks.flatMap((chunk) => chunk.split('\n')).filter((line) => line !== ''),
    text: () => chunks.join(''),
  };
}

function logEntries(capture: CaptureStream): Array<Record<string, unknown>> {
  return capture.lines().map((line) => JSON.parse(line) as Record<string, unknown>);
}

function deliveryFailureWarnings(capture: CaptureStream): Array<Record<string, unknown>> {
  return logEntries(capture).filter(
    (entry) => entry['msg'] === 'verification_email_delivery_failed',
  );
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
  logger?: FastifyServerOptions['logger'],
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

  const app = Fastify({ logger });
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

  it('POST /auth/register duplicate username returns 409 with the username field', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    const res = await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'ALICE', email: 'b@x.com', password: 'password1234' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      message: 'account already exists',
      code: 'duplicate_account',
      error: 'duplicate_account',
      field: 'username',
      fields: ['username'],
    });
    expect(getSetCookie(res)).toBe('');
  });

  it('POST /auth/register duplicate email returns 409 with the email field', async () => {
    await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'a@x.com', password: 'password1234' },
    });
    const res = await ctx.app.inject({
      method: 'POST', url: '/auth/register', headers: { origin: 'http://localhost:5173' },
      payload: { username: 'bob', email: 'A@X.COM', password: 'password1234' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      message: 'account already exists',
      code: 'duplicate_account',
      error: 'duplicate_account',
      field: 'email',
      fields: ['email'],
    });
    expect(getSetCookie(res)).toBe('');
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

  it('POST /auth/register untyped email failure returns 500 internal_error, then resend recovers with a fresh token', async () => {
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

describe('registration route contract (AC-3, AC-4, AC-5)', () => {
  let ctx: Ctx & { advance: (ms: number) => void };

  beforeEach(async () => {
    ctx = await buildCtx();
  });

  it('serializes resumed:true only on a resume and omits it for a new registration', async () => {
    const headers = { origin: 'http://localhost:5173' };
    const payload = {
      username: 'resumer',
      email: 'resumer@example.test',
      password: 'password1234',
    };

    const created = await ctx.app.inject({ method: 'POST', url: '/auth/register', headers, payload });
    expect(created.statusCode).toBe(202);
    expect(created.json()).toEqual({ message: 'verification email sent' });
    expect(getSetCookie(created)).toBe('');

    const resumed = await ctx.app.inject({ method: 'POST', url: '/auth/register', headers, payload });
    expect(resumed.statusCode).toBe(202);
    expect(resumed.json()).toEqual({ message: 'verification email sent', resumed: true });
    expect(getSetCookie(resumed)).toBe('');

    expect(ctx.email.sent).toHaveLength(2);
    expect(ctx.email.sent[0].to).toBe('resumer@example.test');
    expect(ctx.email.sent[1].to).toBe('resumer@example.test');
  });

  it('preserves the resume 429 body after three resumes per hour without sending another email', async () => {
    const headers = { origin: 'http://localhost:5173' };
    const payload = {
      username: 'limited',
      email: 'limited@example.test',
      password: 'password1234',
    };

    const created = await ctx.app.inject({ method: 'POST', url: '/auth/register', headers, payload });
    expect(created.statusCode).toBe(202);

    for (let i = 0; i < 3; i += 1) {
      const resumed = await ctx.app.inject({ method: 'POST', url: '/auth/register', headers, payload });
      expect(resumed.statusCode).toBe(202);
      expect(resumed.json()).toEqual({ message: 'verification email sent', resumed: true });
    }
    expect(ctx.email.sent).toHaveLength(4);

    const limited = await ctx.app.inject({ method: 'POST', url: '/auth/register', headers, payload });
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toEqual({
      message: 'rate limit exceeded',
      code: 'rate_limited',
      error: 'rate_limited',
    });
    expect(getSetCookie(limited)).toBe('');
    expect(ctx.email.sent).toHaveLength(4);
  });

  it('reports both ordered fields when the username and email belong to different unverified rows (U1/U2)', async () => {
    const headers = { origin: 'http://localhost:5173' };
    const u1 = await ctx.app.inject({
      method: 'POST',
      url: '/auth/register',
      headers,
      payload: { username: 'u1-holder', email: 'u1@example.test', password: 'password1234' },
    });
    const u2 = await ctx.app.inject({
      method: 'POST',
      url: '/auth/register',
      headers,
      payload: { username: 'u2-holder', email: 'u2@example.test', password: 'password1234' },
    });
    expect(u1.statusCode).toBe(202);
    expect(u2.statusCode).toBe(202);
    const u1Row = await ctx.users.findByUsername('u1-holder');
    const u2Row = await ctx.users.findByEmail('u2@example.test');
    expect(u1Row!.verified).toBe(false);
    expect(u2Row!.verified).toBe(false);
    expect(u1Row!.id).not.toBe(u2Row!.id);

    const conflict = await ctx.app.inject({
      method: 'POST',
      url: '/auth/register',
      headers,
      payload: { username: 'u1-holder', email: 'u2@example.test', password: 'password1234' },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({
      message: 'account already exists',
      code: 'duplicate_account',
      error: 'duplicate_account',
      field: 'both',
      fields: ['username', 'email'],
    });
    expect(getSetCookie(conflict)).toBe('');
    expect(ctx.email.sent).toHaveLength(2);

    const stillU1 = await ctx.users.findByUsername('u1-holder');
    const stillU2 = await ctx.users.findByEmail('u2@example.test');
    expect(stillU1!.id).toBe(u1Row!.id);
    expect(stillU2!.id).toBe(u2Row!.id);
  });

  it('does not resume a wrong password on the same unverified row and sends no email', async () => {
    const headers = { origin: 'http://localhost:5173' };
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/auth/register',
      headers,
      payload: { username: 'alice', email: 'alice@example.test', password: 'password1234' },
    });
    expect(created.statusCode).toBe(202);
    expect(ctx.email.sent).toHaveLength(1);

    const conflict = await ctx.app.inject({
      method: 'POST',
      url: '/auth/register',
      headers,
      payload: { username: 'alice', email: 'alice@example.test', password: 'wrongpassword1' },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({
      message: 'account already exists',
      code: 'duplicate_account',
      error: 'duplicate_account',
      field: 'both',
      fields: ['username', 'email'],
    });
    expect(getSetCookie(conflict)).toBe('');
    expect(ctx.email.sent).toHaveLength(1);
  });

  it('does not resume an already-verified pair and sends no email', async () => {
    const headers = { origin: 'http://localhost:5173' };
    const payload = {
      username: 'alice',
      email: 'alice@example.test',
      password: 'password1234',
    };
    const created = await ctx.app.inject({ method: 'POST', url: '/auth/register', headers, payload });
    expect(created.statusCode).toBe(202);
    const token = new URL(ctx.email.sent[0].verificationUrl).searchParams.get('token')!;
    const verified = await ctx.app.inject({
      method: 'POST',
      url: '/auth/verify',
      headers,
      payload: { token },
    });
    expect(verified.statusCode).toBe(200);
    expect(verified.json().user.verified).toBe(true);

    const conflict = await ctx.app.inject({ method: 'POST', url: '/auth/register', headers, payload });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({
      message: 'account already exists',
      code: 'duplicate_account',
      error: 'duplicate_account',
      field: 'both',
      fields: ['username', 'email'],
    });
    expect(getSetCookie(conflict)).toBe('');
    expect(ctx.email.sent).toHaveLength(1);
  });
});

describe('delivery failure logging (AC-3)', () => {
  it('register delivery failure returns the fixed 502 body, sets no session and logs one redacted warn event', async () => {
    const capture = createCaptureStream();
    const email = new ScriptedEmailService([
      deliveryFailure('SMTP transport failed: connection refused', {
        code: 'ECONNECTION',
        name: 'SmtpError',
      }),
    ]);
    const failing = await buildCtx(
      {},
      email,
      buildLoggerOptions({ LOG_LEVEL: 'warn' }, capture.stream),
    );
    const sessionCreate = vi.spyOn(failing.sessions, 'create');

    const res = await failing.app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { origin: 'http://localhost:5173' },
      payload: { username: 'delivery-user', email: 'delivery@example.test', password: 'password1234' },
    });

    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({
      message: 'verification email could not be sent',
      code: 'verification_email_failed',
      error: 'verification_email_failed',
    });
    expect(getSetCookie(res)).toBe('');
    expect(sessionCreate).not.toHaveBeenCalled();

    const persisted = await failing.users.findByEmail('delivery@example.test');
    expect(persisted).not.toBeNull();
    expect(persisted!.username).toBe('delivery-user');
    expect(persisted!.verified).toBe(false);

    const warnings = deliveryFailureWarnings(capture);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]['level']).toBe(40);
    expect(warnings[0]['route']).toBe('register');
    expect(warnings[0]['transport']).toBe('smtp');
    expect(warnings[0]['errorType']).toBe('SmtpError');
    expect(warnings[0]['transportCode']).toBe('ECONNECTION');
    expect(warnings[0]['host']).toBe(SMTP_HOST);
    expect(warnings[0]['port']).toBe(SMTP_PORT);

    const text = capture.text();
    expect(text).not.toContain('delivery@example.test');
    expect(text).not.toContain('delivery-user');
    expect(text).not.toContain('password1234');
    expect(text).not.toContain('SMTP transport failed');
    expect(text).not.toContain('verify?token=');
  });

  it('resend-verification delivery failure returns the same 502 body and logs the resend route without transportCode', async () => {
    const capture = createCaptureStream();
    const email = new ScriptedEmailService([null, deliveryFailure()]);
    const failing = await buildCtx(
      {},
      email,
      buildLoggerOptions({ LOG_LEVEL: 'warn' }, capture.stream),
    );

    const registered = await failing.app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { origin: 'http://localhost:5173' },
      payload: { username: 'alice', email: 'alice@example.test', password: 'password1234' },
    });
    expect(registered.statusCode).toBe(202);
    expect(email.sent).toHaveLength(1);

    const res = await failing.app.inject({
      method: 'POST',
      url: '/auth/resend-verification',
      headers: { origin: 'http://localhost:5173' },
      payload: { email: 'alice@example.test' },
    });

    expect(res.statusCode).toBe(502);
    expect(res.json()).toEqual({
      message: 'verification email could not be sent',
      code: 'verification_email_failed',
      error: 'verification_email_failed',
    });
    expect(getSetCookie(res)).toBe('');
    expect(email.sent).toHaveLength(2);

    const warnings = deliveryFailureWarnings(capture);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]['level']).toBe(40);
    expect(warnings[0]['route']).toBe('resend-verification');
    expect(warnings[0]['transport']).toBe('smtp');
    expect(warnings[0]['errorType']).toBe('Error');
    expect(warnings[0]['host']).toBe(SMTP_HOST);
    expect(warnings[0]['port']).toBe(SMTP_PORT);
    expect('transportCode' in warnings[0]).toBe(false);

    const text = capture.text();
    expect(text).not.toContain('alice@example.test');
    expect(text).not.toContain('alice');
    expect(text).not.toContain('SMTP transport failed');
    expect(text).not.toContain('verify?token=');
  });
});

describe('email identifier login (AC-6)', () => {
  let ctx: Ctx & { advance: (ms: number) => void };

  beforeEach(async () => {
    ctx = await buildCtx();
  });

  const headers = { origin: 'http://localhost:5173' };

  async function registerAlice(): Promise<void> {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/register',
      headers,
      payload: { username: 'alice', email: 'alice@example.test', password: 'password1234' },
    });
    expect(res.statusCode).toBe(202);
  }

  it('logs in with a mixed-case email in the username field and returns the session', async () => {
    await registerAlice();
    const stored = await ctx.users.findByEmail('alice@example.test');

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      headers,
      payload: { username: 'ALICE@EXAMPLE.TEST', password: 'password1234' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      user: {
        id: stored!.id,
        username: 'alice',
        email: 'alice@example.test',
        verified: false,
      },
    });
    const sc = getSetCookie(res);
    expect(sc).toContain('HttpOnly');
    expect(cookieValue(sc, SESSION_COOKIE_NAME)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('logs in with the identifier alias for an email', async () => {
    await registerAlice();

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      headers,
      payload: { identifier: 'alice@example.test', password: 'password1234' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.username).toBe('alice');
    expect(res.json().user.email).toBe('alice@example.test');
  });

  it('returns the generic 401 for an unknown email and for a wrong email password', async () => {
    await registerAlice();

    const unknown = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      headers,
      payload: { username: 'ghost@example.test', password: 'password1234' },
    });
    expect(unknown.statusCode).toBe(401);
    expect(unknown.json()).toEqual({
      message: 'invalid credentials',
      code: 'invalid_credentials',
      error: 'invalid_credentials',
    });
    expect(getSetCookie(unknown)).toBe('');

    const wrong = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      headers,
      payload: { username: 'alice@example.test', password: 'wrongpassword1' },
    });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json()).toEqual({
      message: 'invalid credentials',
      code: 'invalid_credentials',
      error: 'invalid_credentials',
    });
    expect(getSetCookie(wrong)).toBe('');
  });

  it('locks an email identifier after five failures and returns Retry-After on the 429', async () => {
    await registerAlice();

    for (let i = 0; i < 5; i += 1) {
      const failed = await ctx.app.inject({
        method: 'POST',
        url: '/auth/login',
        headers,
        payload: { username: 'alice@example.test', password: 'wrongpassword1' },
      });
      expect(failed.statusCode).toBe(401);
    }

    const locked = await ctx.app.inject({
      method: 'POST',
      url: '/auth/login',
      headers,
      payload: { username: 'alice@example.test', password: 'password1234' },
    });
    expect(locked.statusCode).toBe(429);
    expect(locked.headers['retry-after']).toBe('900');
    expect(locked.json()).toEqual({
      message: 'account locked',
      code: 'account_locked',
      error: 'account_locked',
    });
  });
});

/**
 * Brevo API delivery failures (T3, AC-6). These exercise the real
 * `BrevoApiEmailService` through `createEmailService` at the route boundary: the
 * typed 502 mapping, the one redacted `verification_email_delivery_failed` warn
 * with `transport`, token invalidation on a rejected send, and resend recovery.
 */
describe('Brevo API delivery failure and token invalidation (T3, AC-6)', () => {
  const BREVO_API_KEY_FIXTURE = 'brevo-rest-key-for-tests';
  const BREVO_FROM = 'CubeClicker <no-reply@example.test>';
  const RECIPIENT = 'delivery@example.test';
  const headers = { origin: 'http://localhost:5173' };
  const exact502 = {
    message: 'verification email could not be sent',
    code: 'verification_email_failed',
    error: 'verification_email_failed',
  };

  interface BrevoOutcome {
    status: number;
  }

  interface BrevoCtx {
    app: FastifyInstance;
    users: InMemoryUserRepository;
    sessions: InMemorySessionRepository;
    tokens: InMemoryVerificationTokenRepository;
    calls: Array<{ url: string; init: BrevoRequestInit }>;
    issued: string[];
  }

  /** Builds the real API service from a scripted request seam (one outcome per call). */
  async function buildBrevoCtx(
    outcomes: BrevoOutcome[],
    logger?: FastifyServerOptions['logger'],
  ): Promise<BrevoCtx> {
    const clock = () => FIXED_NOW;
    const users = new InMemoryUserRepository({ now: clock });
    const sessions = new InMemorySessionRepository({ now: clock });
    const tokens = new InMemoryVerificationTokenRepository({ now: clock });
    const calls: Array<{ url: string; init: BrevoRequestInit }> = [];
    let requestIndex = 0;
    const brevoRequest: BrevoRequest = async (url, init) => {
      calls.push({ url, init });
      const outcome = outcomes[Math.min(requestIndex, outcomes.length - 1)] ?? { status: 500 };
      requestIndex += 1;
      return { ok: outcome.status >= 200 && outcome.status < 300, status: outcome.status };
    };
    const email = createEmailService(
      {
        emailTransport: 'brevo-api',
        brevoApiKey: BREVO_API_KEY_FIXTURE,
        smtpHost: 'mailpit',
        smtpPort: 1025,
        smtpSecure: false,
        smtpUser: null,
        smtpPass: null,
        smtpFrom: BREVO_FROM,
        smtpConnectionTimeoutMs: 10_000,
      },
      { brevoRequest },
    );
    const issued: string[] = [];
    const originalIssue = tokens.issue.bind(tokens);
    vi.spyOn(tokens, 'issue').mockImplementation(
      async (userId: string, ttlMs: number, nowMs?: number) => {
        const result = await originalIssue(userId, ttlMs, nowMs);
        issued.push(result.token);
        return result;
      },
    );
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
        verificationTokenTtlMs: VERIFICATION_TTL_MS,
      },
    });
    const app = Fastify({ logger });
    await app.register(authRoutes, {
      authService: service,
      sessions,
      rateLimiter,
      clock,
      allowedOrigin: 'http://localhost:5173',
      sessionCookieSecure: false,
      sessionCookieSameSite: 'lax',
      sessionTtlMs: SESSION_TTL_MS,
    });
    await app.ready();
    return { app, users, sessions, tokens, calls, issued };
  }

  async function register(ctx: BrevoCtx) {
    return ctx.app.inject({
      method: 'POST',
      url: '/auth/register',
      headers,
      payload: { username: 'brevo-delivery', email: RECIPIENT, password: 'password1234' },
    });
  }

  it('register returns the exact 502, logs one transport-tagged warn and invalidates the issued token (AC-6(a), AC-6(c), AC-6(d))', async () => {
    const capture = createCaptureStream();
    const ctx = await buildBrevoCtx(
      [{ status: 401 }],
      buildLoggerOptions({ LOG_LEVEL: 'warn' }, capture.stream),
    );
    const sessionCreate = vi.spyOn(ctx.sessions, 'create');

    try {
      const res = await register(ctx);

      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual(exact502);
      expect(getSetCookie(res)).toBe('');
      expect(sessionCreate).not.toHaveBeenCalled();

      expect(ctx.issued).toHaveLength(1);
      const issuedToken = ctx.issued[0]!;
      expect(await ctx.tokens.consume(issuedToken)).toBeNull();

      const persisted = await ctx.users.findByEmail(RECIPIENT);
      expect(persisted).not.toBeNull();
      expect(persisted!.username).toBe('brevo-delivery');
      expect(persisted!.verified).toBe(false);

      const warnings = deliveryFailureWarnings(capture);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!['level']).toBe(40);
      expect(warnings[0]!['msg']).toBe('verification_email_delivery_failed');
      expect(warnings[0]!['route']).toBe('register');
      expect(warnings[0]!['transport']).toBe('brevo-api');
      expect(warnings[0]!['errorType']).toBe('BrevoApiError');
      expect(warnings[0]!['transportCode']).toBe('HTTP_401');
      expect(warnings[0]!['host']).toBe('api.brevo.com');
      expect(warnings[0]!['port']).toBe(443);
      expect('err' in warnings[0]!).toBe(false);
      expect('stack' in warnings[0]!).toBe(false);

      const text = capture.text();
      expect(text).not.toContain(RECIPIENT);
      expect(text).not.toContain('brevo-delivery');
      expect(text).not.toContain(persisted!.id);
      expect(text).not.toContain(BREVO_API_KEY_FIXTURE);
      expect(text).not.toContain('no-reply@example.test');
      expect(text).not.toContain(issuedToken);
      expect(text).not.toContain('verify?token=');
      expect(text).not.toContain('Brevo API responded');
    } finally {
      await ctx.app.close();
    }
  });

  it('resend returns the same exact 502 and invalidates the resend token when the API rejects (AC-6(b), AC-6(c), AC-6(d))', async () => {
    const capture = createCaptureStream();
    const ctx = await buildBrevoCtx(
      [{ status: 201 }, { status: 401 }],
      buildLoggerOptions({ LOG_LEVEL: 'warn' }, capture.stream),
    );

    try {
      const registered = await register(ctx);
      expect(registered.statusCode).toBe(202);
      expect(registered.json()).toEqual({ message: 'verification email sent' });
      expect(ctx.issued).toHaveLength(1);

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/auth/resend-verification',
        headers,
        payload: { email: RECIPIENT },
      });

      expect(res.statusCode).toBe(502);
      expect(res.json()).toEqual(exact502);
      expect(getSetCookie(res)).toBe('');
      expect(ctx.issued).toHaveLength(2);
      expect(await ctx.tokens.consume(ctx.issued[1]!)).toBeNull();

      const warnings = deliveryFailureWarnings(capture);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]!['level']).toBe(40);
      expect(warnings[0]!['route']).toBe('resend-verification');
      expect(warnings[0]!['transport']).toBe('brevo-api');
      expect(warnings[0]!['errorType']).toBe('BrevoApiError');
      expect(warnings[0]!['transportCode']).toBe('HTTP_401');
      expect(warnings[0]!['host']).toBe('api.brevo.com');
      expect(warnings[0]!['port']).toBe(443);
      expect(capture.text()).not.toContain(RECIPIENT);
      expect(capture.text()).not.toContain('Brevo API responded');
    } finally {
      await ctx.app.close();
    }
  });

  it('a later resend returns the exact 202 body and sends exactly once through the API (AC-6(e))', async () => {
    const ctx = await buildBrevoCtx([{ status: 401 }, { status: 201 }]);

    try {
      const failed = await register(ctx);
      expect(failed.statusCode).toBe(502);
      expect(failed.json()).toEqual(exact502);
      expect(ctx.issued).toHaveLength(1);
      expect(await ctx.tokens.consume(ctx.issued[0]!)).toBeNull();

      const resend = await ctx.app.inject({
        method: 'POST',
        url: '/auth/resend-verification',
        headers,
        payload: { email: RECIPIENT },
      });

      expect(resend.statusCode).toBe(202);
      expect(resend.json()).toEqual({ message: 'verification email sent' });
      expect(ctx.issued).toHaveLength(2);
      const recoveryToken = ctx.issued[1]!;
      const persisted = await ctx.users.findByEmail(RECIPIENT);
      expect(persisted).not.toBeNull();
      expect(await ctx.tokens.consume(recoveryToken)).toEqual({ userId: persisted!.id });

      // The failed register plus exactly one successful resend attempt reach the API.
      expect(ctx.calls).toHaveLength(2);
      const recoverySends = ctx.calls.filter((call) =>
        (call.init.body ?? '').includes(recoveryToken),
      );
      expect(recoverySends).toHaveLength(1);
      const send = recoverySends[0]!;
      expect(send.url).toBe('https://api.brevo.com/v3/smtp/email');
      expect(send.init.method).toBe('POST');
      expect(send.init.headers).toEqual({
        'api-key': BREVO_API_KEY_FIXTURE,
        'content-type': 'application/json',
        accept: 'application/json',
      });
      const verificationUrl = `http://localhost:5173/verify?token=${recoveryToken}`;
      expect(JSON.parse(send.init.body as string)).toEqual({
        sender: { email: 'no-reply@example.test', name: 'CubeClicker' },
        to: [{ email: RECIPIENT }],
        subject: 'Verify your CubeClicker email',
        htmlContent: renderVerificationEmail(verificationUrl).html,
        textContent: renderVerificationEmail(verificationUrl).text,
      });
    } finally {
      await ctx.app.close();
    }
  });
});
