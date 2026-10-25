/**
 * Auth HTTP routes (T10) — Fastify plugin exposing /auth/*.
 *
 * Thin over AuthService: validation/Origin/CSRF/rate-limit/cookie handling live
 * here; all business logic stays in the service. Sliding expiry uses
 * SessionRepository.touch on authenticated requests.
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import cookie from '@fastify/cookie';

import { AuthService, AuthServiceError } from './auth-service.js';
import type { SessionRepository } from './session-repository.js';
import type { RateLimiter } from './rate-limit.js';
import type { Clock } from './rate-limit.js';
import type { AuthConfig } from './config.js';

export const SESSION_COOKIE_NAME = 'session';

const COOKIE_CANDIDATES = [SESSION_COOKIE_NAME, 'sid', 'token', 'sessionId', 'auth_session'];

export interface AuthRoutesOptions {
  authService?: AuthService;
  service?: AuthService;
  auth?: AuthService;
  authConfig?: Partial<AuthConfig>;
  config?: Partial<AuthConfig>;
  allowedOrigin?: string;
  sessionCookieSecure?: boolean;
  sessionTtlMs?: number;
  sessionTtlDays?: number;
  cookieName?: string;
  rateLimiter?: RateLimiter;
  rateLimit?: RateLimiter;
  limiter?: RateLimiter;
  sessions?: SessionRepository;
  sessionRepository?: SessionRepository;
  sessionRepo?: SessionRepository;
  clock?: Clock;
  now?: Clock;
}

interface Resolved {
  service: AuthService | null;
  sessions: SessionRepository | null;
  rateLimiter: RateLimiter | null;
  clock: Clock;
  allowedOrigin: string;
  secure: boolean;
  sessionTtlMs: number;
  cookieName: string;
}

function pick<T>(...c: Array<T | undefined | null>): T | undefined {
  for (const v of c) if (v !== undefined && v !== null) return v as T;
  return undefined;
}

function resolveOpts(opts: AuthRoutesOptions): Resolved {
  const service = pick(opts.authService, opts.service, opts.auth) ?? null;
  const sessions = pick(opts.sessions, opts.sessionRepository, opts.sessionRepo) ?? null;
  const rateLimiter = pick(opts.rateLimiter, opts.rateLimit, opts.limiter) ?? null;
  const clock = opts.clock ?? opts.now ?? (() => Date.now());
  const cfg = opts.authConfig ?? opts.config ?? {};
  const allowedOrigin = opts.allowedOrigin ?? cfg.allowedOrigin ?? 'http://localhost:5173';
  const secure = opts.sessionCookieSecure ?? cfg.sessionCookieSecure ?? false;
  const sessionTtlMs =
    opts.sessionTtlMs ??
    cfg.sessionTtlMs ??
    (opts.sessionTtlDays ?? cfg.sessionTtlDays ?? 7) * 24 * 60 * 60 * 1000;
  const cookieName = opts.cookieName ?? SESSION_COOKIE_NAME;
  return { service, sessions, rateLimiter, clock, allowedOrigin, secure, sessionTtlMs, cookieName };
}

function getBody(request: FastifyRequest): Record<string, unknown> {
  const b = request.body;
  if (b && typeof b === 'object' && !Array.isArray(b)) return b as Record<string, unknown>;
  return {};
}

function getTokenFromCookie(request: FastifyRequest, cookieName: string): string | undefined {
  const cookies = (request.cookies ?? {}) as Record<string, string | undefined>;
  for (const name of [cookieName, ...COOKIE_CANDIDATES]) {
    const v = cookies[name];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return undefined;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function checkOrigin(request: FastifyRequest, reply: FastifyReply, allowedOrigin: string): boolean {
  const origin = request.headers.origin;
  if (origin !== undefined && origin !== null && origin !== allowedOrigin) {
    reply.code(403).send({ message: 'origin not allowed', code: 'origin_not_allowed' });
    return false;
  }
  return true;
}

function mapError(reply: FastifyReply, err: unknown): void {
  if (err instanceof AuthServiceError) {
    if (err.retryAfter !== undefined) {
      reply.header('Retry-After', String(err.retryAfter));
    }
    reply.code(err.status || err.statusCode || 500).send({
      message: err.message,
      code: err.code ?? 'auth_error',
      error: err.code ?? 'auth_error',
    });
    return;
  }
  reply.code(500).send({ message: 'internal error', code: 'internal_error', error: 'internal_error' });
}

function setSessionCookie(reply: FastifyReply, r: Resolved, token: string, expiresAt?: number): void {
  const maxAge = Math.floor(r.sessionTtlMs / 1000);
  reply.setCookie(r.cookieName, token, {
    httpOnly: true,
    secure: r.secure,
    sameSite: 'lax',
    path: '/',
    maxAge,
    expires: expiresAt ? new Date(expiresAt) : undefined,
  });
}

function clearSessionCookie(reply: FastifyReply, r: Resolved): void {
  reply.clearCookie(r.cookieName, {
    httpOnly: true,
    secure: r.secure,
    sameSite: 'lax',
    path: '/',
  });
}

const authRoutesPlugin: FastifyPluginAsync<AuthRoutesOptions> = async (fastify, opts) => {
  const r = resolveOpts(opts);

  // Ensure cookie support is available (idempotent-ish).
  if (typeof (fastify as unknown as { parseCookie?: unknown }).parseCookie !== 'function') {
    await fastify.register(cookie);
  }

  // ---------- POST /auth/register ----------
  const registerHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!checkOrigin(request, reply, r.allowedOrigin)) return;
    const ip = request.ip || (request.socket as { remoteAddress?: string })?.remoteAddress || 'unknown';
    if (r.rateLimiter && !r.rateLimiter.allow(`ip:${ip}:register`, 5, 60 * 1000)) {
      reply.code(429).send({ message: 'rate limit exceeded', code: 'rate_limited', error: 'rate_limited' });
      return;
    }
    if (!r.service) {
      reply.code(503).send({ message: 'auth service unavailable', code: 'service_unavailable' });
      return;
    }
    const body = getBody(request);
    try {
      const result = await r.service.register({
        username: str(body.username ?? body.userName ?? body.login),
        email: str(body.email),
        password: str(body.password ?? body.pass),
      });
      reply.code(202).send({ message: result.message ?? 'verification email sent' });
    } catch (err) {
      mapError(reply, err);
    }
  };

  fastify.post('/auth/register', registerHandler);

  // ---------- POST /auth/login ----------
  const loginHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!checkOrigin(request, reply, r.allowedOrigin)) return;
    const ip = request.ip || (request.socket as { remoteAddress?: string })?.remoteAddress || 'unknown';
    if (r.rateLimiter && !r.rateLimiter.allow(`ip:${ip}:login`, 10, 60 * 1000)) {
      reply.code(429).send({ message: 'rate limit exceeded', code: 'rate_limited', error: 'rate_limited' });
      return;
    }
    if (!r.service) {
      reply.code(503).send({ message: 'auth service unavailable', code: 'service_unavailable' });
      return;
    }
    const body = getBody(request);
    try {
      const result = await r.service.login({
        username: str(body.username ?? body.userName ?? body.login ?? body.identifier),
        password: str(body.password ?? body.pass),
      });
      setSessionCookie(reply, r, result.token ?? result.sessionToken ?? '', result.expiresAt);
      reply.code(200).send({ user: result.user });
    } catch (err) {
      mapError(reply, err);
    }
  };

  fastify.post('/auth/login', loginHandler);

  // ---------- verify (GET + POST) ----------
  const verifyHandler = async (request: FastifyRequest, reply: FastifyReply, tokenOverride?: string) => {
    if (!checkOrigin(request, reply, r.allowedOrigin)) return;
    if (!r.service) {
      reply.code(503).send({ message: 'auth service unavailable', code: 'service_unavailable' });
      return;
    }
    const body = getBody(request);
    const token = tokenOverride ?? str(body.token ?? (request.query as Record<string, unknown>)?.token);
    try {
      const result = await r.service.verifyEmail({ token });
      const sessionToken = result.token ?? result.sessionToken ?? '';
      if (sessionToken) setSessionCookie(reply, r, sessionToken, result.expiresAt);
      reply.code(200).send({ user: result.user });
    } catch (err) {
      mapError(reply, err);
    }
  };

  fastify.post('/auth/verify', async (req, reply) => verifyHandler(req, reply));
  fastify.get('/auth/verify', async (req, reply) => {
    const q = (req.query ?? {}) as Record<string, unknown>;
    await verifyHandler(req, reply, str(q.token));
  });

  // ---------- resend (POST) ----------
  const resendHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!checkOrigin(request, reply, r.allowedOrigin)) return;
    const ip = request.ip || (request.socket as { remoteAddress?: string })?.remoteAddress || 'unknown';
    if (r.rateLimiter && !r.rateLimiter.allow(`ip:${ip}:resend`, 3, 60 * 60 * 1000)) {
      reply.code(429).send({ message: 'rate limit exceeded', code: 'rate_limited', error: 'rate_limited' });
      return;
    }
    if (!r.service) {
      reply.code(503).send({ message: 'auth service unavailable', code: 'service_unavailable' });
      return;
    }
    const body = getBody(request);
    const email = str(body.email);
    try {
      const result = await r.service.resendVerification(email ? { email } : (body as { email?: string }));
      // service may throw ValidationError for empty email; ensure we still call with email
      reply.code(202).send({ message: result.message ?? 'verification email sent' });
    } catch (err) {
      mapError(reply, err);
    }
  };

  fastify.post('/auth/resend', resendHandler);
  fastify.post('/auth/resend-verification', resendHandler);

  // ---------- logout (POST) ----------
  const logoutHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!checkOrigin(request, reply, r.allowedOrigin)) return;
    const token = getTokenFromCookie(request, r.cookieName);
    if (r.service && token) {
      try {
        await r.service.logout(token);
      } catch {
        // ignore
      }
    } else if (r.service) {
      const body = getBody(request);
      const sid = str(body.sessionId ?? body.id);
      if (sid) {
        try { await r.service.logout({ sessionId: sid }); } catch { /* ignore */ }
      }
    }
    clearSessionCookie(reply, r);
    reply.code(204).send();
  };

  fastify.post('/auth/logout', logoutHandler);

  // ---------- me (GET) ----------
  fastify.get('/auth/me', async (request, reply) => {
    if (!r.service) {
      reply.code(503).send({ message: 'auth service unavailable', code: 'service_unavailable' });
      return;
    }
    const token = getTokenFromCookie(request, r.cookieName);
    if (!token) {
      reply.code(401).send({ message: 'not authenticated', code: 'not_authenticated', error: 'not_authenticated' });
      return;
    }
    try {
      const user = await r.service.getSession(token);
      if (!user) {
        reply.code(401).send({ message: 'not authenticated', code: 'not_authenticated', error: 'not_authenticated' });
        return;
      }
      // sliding touch (best-effort)
      if (r.sessions) {
        try {
          const session = await r.sessions.findByToken(token);
          if (session) {
            const { expiresAt } = await r.sessions.touch(session.id, r.sessionTtlMs);
            setSessionCookie(reply, r, token, expiresAt);
          }
        } catch {
          // ignore
        }
      }
      reply.code(200).send({ user });
    } catch (err) {
      mapError(reply, err);
    }
  });

  // ---------- session-touch (GET + POST) ----------
  const touchHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!checkOrigin(request, reply, r.allowedOrigin)) return;
    if (!r.service) {
      reply.code(503).send({ message: 'auth service unavailable', code: 'service_unavailable' });
      return;
    }
    const token = getTokenFromCookie(request, r.cookieName);
    if (!token) {
      reply.code(401).send({ message: 'not authenticated', code: 'not_authenticated', error: 'not_authenticated' });
      return;
    }
    if (!r.sessions) {
      // fallback: validate via service, no sliding
      const user = await r.service.getSession(token);
      if (!user) {
        reply.code(401).send({ message: 'not authenticated', code: 'not_authenticated', error: 'not_authenticated' });
        return;
      }
      reply.code(200).send({ user });
      return;
    }
    try {
      const session = await r.sessions.findByToken(token);
      if (!session) {
        reply.code(401).send({ message: 'not authenticated', code: 'not_authenticated', error: 'not_authenticated' });
        return;
      }
      const now = r.clock();
      if (session.expiresAt <= now) {
        reply.code(401).send({ message: 'not authenticated', code: 'not_authenticated', error: 'not_authenticated' });
        return;
      }
      const { expiresAt } = await r.sessions.touch(session.id, r.sessionTtlMs);
      setSessionCookie(reply, r, token, expiresAt);
      const user = await r.service.getSession(token);
      reply.code(200).send({ user: user ?? undefined, expiresAt });
    } catch (err) {
      mapError(reply, err);
    }
  };

  fastify.get('/auth/session-touch', touchHandler);
  fastify.post('/auth/session-touch', touchHandler);
  fastify.get('/auth/touch', touchHandler);
  fastify.post('/auth/touch', touchHandler);
  fastify.get('/auth/session', touchHandler);
  fastify.post('/auth/session', touchHandler);
};

export const authRoutes = authRoutesPlugin;
export default authRoutesPlugin;