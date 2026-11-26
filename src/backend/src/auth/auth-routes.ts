/**
 * Auth HTTP routes (T10) — Fastify plugin exposing /auth/*.
 *
 * Thin over AuthService: validation/Origin/CSRF/rate-limit/cookie handling live
 * here; all business logic stays in the service. Sliding expiry uses
 * SessionRepository.touch on authenticated requests.
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import cookie from '@fastify/cookie';

import { AuthService, AuthServiceError, DuplicateAccountError } from './auth-service.js';
import { EmailDeliveryError } from './email.js';
import type { SessionRepository } from './session-repository.js';
import type { RateLimiter } from './rate-limit.js';
import type { Clock } from './rate-limit.js';
import { createLogSink, type LogFields } from '../observability/logging.js';
import {
  DEFAULT_SESSION_COOKIE_SAMESITE,
  type AuthConfig,
  type SessionCookieSameSite,
} from './config.js';

export const SESSION_COOKIE_NAME = 'session';

const COOKIE_CANDIDATES = [SESSION_COOKIE_NAME, 'sid', 'token', 'sessionId', 'auth_session'];

export interface AuthRoutesOptions {
  authService?: AuthService;
  service?: AuthService;
  auth?: AuthService;
  authConfig?: Partial<AuthConfig>;
  config?: Partial<AuthConfig>;
  allowedOrigin?: string;
  allowedOrigins?: string[];
  sessionCookieSecure?: boolean;
  sessionCookieSameSite?: SessionCookieSameSite;
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
  allowedOrigins: readonly string[];
  secure: boolean;
  sameSite: SessionCookieSameSite;
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
  const allowedOrigins = opts.allowedOrigins ?? [allowedOrigin];
  const secure = opts.sessionCookieSecure ?? cfg.sessionCookieSecure ?? false;
  const sameSite =
    opts.sessionCookieSameSite ??
    cfg.sessionCookieSameSite ??
    DEFAULT_SESSION_COOKIE_SAMESITE;
  const sessionTtlMs =
    opts.sessionTtlMs ??
    cfg.sessionTtlMs ??
    (opts.sessionTtlDays ?? cfg.sessionTtlDays ?? 7) * 24 * 60 * 60 * 1000;
  const cookieName = opts.cookieName ?? SESSION_COOKIE_NAME;
  return { service, sessions, rateLimiter, clock, allowedOrigins, secure, sameSite, sessionTtlMs, cookieName };
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

// CSRF Origin check: a missing Origin header is allowed (F7 decision). Browser-initiated
// cross-site form POSTs always carry Origin, so rejecting only *mismatched* Origins
// blocks CSRF while permitting non-browser clients (curl, server-to-server, WebSocket
// upgrades) that legitimately omit Origin. Stricter rejection of missing Origin was
// considered and rejected to avoid breaking those clients.
function checkOrigin(
  request: FastifyRequest,
  reply: FastifyReply,
  allowedOrigins: readonly string[],
): boolean {
  const origin = request.headers.origin;
  if (origin !== undefined && origin !== null && !allowedOrigins.includes(origin)) {
    reply.code(403).send({ message: 'origin not allowed', code: 'origin_not_allowed' });
    return false;
  }
  return true;
}

/** Canonical `route` values for the delivery-failure warn event (AC-3(d)). */
type DeliveryFailureRoute = 'register' | 'resend-verification';

/**
 * Derives the canonical delivery route from the matched Fastify route. Only
 * `POST /auth/register` and the resend handler can issue a verification email,
 * so those are the only routes that can surface an `EmailDeliveryError`; both
 * resend aliases canonicalize to `resend-verification` (AC-3(d)).
 */
function deliveryFailureRoute(request: FastifyRequest): DeliveryFailureRoute {
  return request.routeOptions.url === '/auth/register' ? 'register' : 'resend-verification';
}

/**
 * Emits exactly one redacted `warn` event for a typed email delivery failure.
 * Only the route, the selected transport, the source error name, the whitelisted
 * transport code and the configured host/port reach the log; the transport
 * message (which stays on the error for the operator CLI) never does.
 */
function logDeliveryFailure(
  request: FastifyRequest,
  route: DeliveryFailureRoute,
  error: EmailDeliveryError,
): void {
  const fields: LogFields = {
    route,
    transport: error.transport,
    errorType: error.errorType,
    host: error.host,
    port: error.port,
  };
  if (error.transportCode !== undefined) {
    fields.transportCode = error.transportCode;
  }
  createLogSink(request.log).warn('verification_email_delivery_failed', fields);
}

/**
 * Maps a service error onto the HTTP contract.
 *
 * `EmailDeliveryError` becomes the fixed `502 verification_email_failed` body
 * and one per-route `warn` event; a `DuplicateAccountError` keeps the accepted
 * generic message and adds the ordered `field`/`fields`; every other service
 * error keeps its status/code/`Retry-After`; anything else is the existing
 * generic `500`.
 */
function mapError(request: FastifyRequest, reply: FastifyReply, err: unknown): void {
  if (err instanceof EmailDeliveryError) {
    logDeliveryFailure(request, deliveryFailureRoute(request), err);
    reply.code(502).send({
      message: 'verification email could not be sent',
      code: 'verification_email_failed',
      error: 'verification_email_failed',
    });
    return;
  }
  if (err instanceof AuthServiceError) {
    if (err.retryAfter !== undefined) {
      reply.header('Retry-After', String(err.retryAfter));
    }
    const body: Record<string, unknown> = {
      message: err.message,
      code: err.code ?? 'auth_error',
      error: err.code ?? 'auth_error',
    };
    if (err instanceof DuplicateAccountError) {
      body.field = err.field;
      body.fields = err.fields;
    }
    reply.code(err.status || err.statusCode || 500).send(body);
    return;
  }
  reply.code(500).send({ message: 'internal error', code: 'internal_error', error: 'internal_error' });
}

function setSessionCookie(reply: FastifyReply, r: Resolved, token: string, expiresAt?: number): void {
  const maxAge = Math.floor(r.sessionTtlMs / 1000);
  reply.setCookie(r.cookieName, token, {
    httpOnly: true,
    secure: r.secure,
    sameSite: r.sameSite,
    path: '/',
    maxAge,
    expires: expiresAt ? new Date(expiresAt) : undefined,
  });
}

function clearSessionCookie(reply: FastifyReply, r: Resolved): void {
  reply.clearCookie(r.cookieName, {
    httpOnly: true,
    secure: r.secure,
    sameSite: r.sameSite,
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
    if (!checkOrigin(request, reply, r.allowedOrigins)) return;
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
      // AC-4(a)/(f): `resumed` is serialized only when the service reports it.
      const response: Record<string, unknown> = {
        message: result.message ?? 'verification email sent',
      };
      if (result.resumed === true) {
        response.resumed = true;
      }
      reply.code(202).send(response);
    } catch (err) {
      mapError(request, reply, err);
    }
  };

  fastify.post('/auth/register', registerHandler);

  // ---------- POST /auth/login ----------
  const loginHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!checkOrigin(request, reply, r.allowedOrigins)) return;
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
      mapError(request, reply, err);
    }
  };

  fastify.post('/auth/login', loginHandler);

  // ---------- verify (GET + POST) ----------
  const verifyHandler = async (request: FastifyRequest, reply: FastifyReply, tokenOverride?: string) => {
    if (!checkOrigin(request, reply, r.allowedOrigins)) return;
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
      mapError(request, reply, err);
    }
  };

  fastify.post('/auth/verify', async (req, reply) => verifyHandler(req, reply));
  fastify.get('/auth/verify', async (req, reply) => {
    const q = (req.query ?? {}) as Record<string, unknown>;
    await verifyHandler(req, reply, str(q.token));
  });

  // ---------- resend (POST) ----------
  const resendHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!checkOrigin(request, reply, r.allowedOrigins)) return;
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
      mapError(request, reply, err);
    }
  };

  fastify.post('/auth/resend', resendHandler);
  fastify.post('/auth/resend-verification', resendHandler);

  // ---------- logout (POST) ----------
  const logoutHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!checkOrigin(request, reply, r.allowedOrigins)) return;
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
      mapError(request, reply, err);
    }
  });

  // ---------- session-touch (GET + POST) ----------
  const touchHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!checkOrigin(request, reply, r.allowedOrigins)) return;
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
      mapError(request, reply, err);
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