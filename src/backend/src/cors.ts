/**
 * In-repo exact-origin CORS hook (plan contract 2) and the shared WebSocket Origin
 * allowlist (plan contract 4).
 *
 * The allowlist is a comma-separated `CORS_ORIGIN`; when unset it falls back to
 * `ALLOWED_ORIGIN` (the single CSRF origin), which keeps the local same-origin
 * development path unchanged. No wildcard is ever emitted and an origin is never
 * reflected unless it matches an allowlist entry exactly.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';

/** Local same-origin frontend default, used when neither origin variable is set. */
export const DEFAULT_CORS_ORIGIN = 'http://localhost:5173';

/** Methods advertised on a preflight response. */
export const CORS_ALLOW_METHODS = 'GET,POST,OPTIONS';
/** Request headers advertised on a preflight response. */
export const CORS_ALLOW_HEADERS = 'Content-Type,Accept';
/** Preflight cache lifetime in seconds. */
export const CORS_MAX_AGE_SECONDS = 600;

/** WebSocket close code sent to a present, non-allowlisted upgrade Origin (AC-7). */
export const WEBSOCKET_ORIGIN_REJECTED_CLOSE_CODE = 1008;

/**
 * Resolves the exact-origin allowlist from the environment.
 *
 * `CORS_ORIGIN` wins when it carries at least one non-empty entry; otherwise
 * `ALLOWED_ORIGIN` is used, so a deployment that only sets the CSRF origin keeps
 * working. Entries are trimmed and empty entries are dropped.
 */
export function resolveCorsOrigins(env: Record<string, string | undefined>): string[] {
  const configured = env.CORS_ORIGIN;
  const raw =
    configured !== undefined && configured.trim() !== ''
      ? configured
      : (env.ALLOWED_ORIGIN ?? DEFAULT_CORS_ORIGIN);
  const origins = raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (origins.length === 0) {
    throw new Error('CORS_ORIGIN must list at least one origin');
  }
  return origins;
}

/** Exact string match: `https://app.example.test.evil.example` never matches. */
export function isOriginAllowed(origin: string, allowedOrigins: readonly string[]): boolean {
  return allowedOrigins.includes(origin);
}

/**
 * WebSocket Origin decision: a missing Origin is allowed for non-browser clients
 * (Node smoke/CLI), a present Origin must match the allowlist exactly.
 */
export function isWebSocketOriginAllowed(
  origin: string | undefined,
  allowedOrigins: readonly string[],
): boolean {
  return origin === undefined || isOriginAllowed(origin, allowedOrigins);
}

/** Options for {@link registerCors}. */
export interface CorsOptions {
  allowedOrigins: readonly string[];
}

function isPreflight(request: FastifyRequest): boolean {
  return (
    request.method === 'OPTIONS' &&
    request.headers['access-control-request-method'] !== undefined
  );
}

/**
 * Registers the CORS hook on the app's root scope. It must run before the auth
 * routes are registered so preflights never reach auth/cookie handling.
 */
export function registerCors(app: FastifyInstance, options: CorsOptions): void {
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (typeof origin !== 'string' || origin.length === 0) {
      return;
    }
    if (!isOriginAllowed(origin, options.allowedOrigins)) {
      // A preflight from an unknown origin is denied outright. Actual requests fall
      // through so the auth CSRF check keeps ownership of the 403 on /auth/* and
      // public routes such as /healthz stay reachable without a CORS grant.
      if (isPreflight(request)) {
        reply.header('vary', 'Origin');
        reply.code(403).send({ message: 'origin not allowed', code: 'origin_not_allowed' });
      }
      return;
    }
    reply.header('access-control-allow-origin', origin);
    reply.header('access-control-allow-credentials', 'true');
    reply.header('vary', 'Origin');
    if (isPreflight(request)) {
      reply.header('access-control-allow-methods', CORS_ALLOW_METHODS);
      reply.header('access-control-allow-headers', CORS_ALLOW_HEADERS);
      reply.header('access-control-max-age', String(CORS_MAX_AGE_SECONDS));
      reply.code(204).send();
    }
  });
}
