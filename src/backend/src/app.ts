import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from 'fastify';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';
import { loadGameConfig, type GameConfig } from './game/config.js';
import { createGameHub, type Peer, type AccountSession } from './game/hub.js';
import { loadAuthConfig, type AuthConfig } from './auth/config.js';
import { createPool, closePool } from './db/pool.js';
import { InMemoryUserRepository, PgUserRepository } from './auth/user-repository.js';
import { InMemorySessionRepository, PgSessionRepository } from './auth/session-repository.js';
import { InMemoryVerificationTokenRepository, PgVerificationTokenRepository } from './auth/verification-token-repository.js';
import { InMemoryEconomyRepository, PgEconomyRepository } from './auth/economy-repository.js';
import {
  FakeEmailService,
  createSmtpEmailService,
  type SmtpTransportFactory,
} from './auth/email.js';
import { createRateLimiter } from './auth/rate-limit.js';
import { createAuthService, type AuthService } from './auth/auth-service.js';
import { authRoutes } from './auth/auth-routes.js';
import {
  isWebSocketOriginAllowed,
  registerCors,
  resolveCorsOrigins,
  WEBSOCKET_ORIGIN_REJECTED_CLOSE_CODE,
} from './cors.js';
import { loadObservabilityConfig } from './observability/config.js';
import { createMetrics, type Metrics } from './observability/metrics.js';
import { buildLoggerOptions, createLogSink } from './observability/logging.js';
import { metricsRoutes } from './observability/metrics-route.js';
import {
  collectPoolMetrics,
  instrumentPool,
  type PoolGauges,
  type Queryable,
} from './observability/db-metrics.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** In-process Prometheus registry, exposed to `server.ts` (T3). */
    metrics: Metrics;
  }
}

/** The pinned `hello` envelope the backend sends to every client that connects. */
export interface HelloMessage {
  type: 'hello';
  serverTime: string;
}

/**
 * Builds the pinned `hello` message. The timestamp comes from the server clock at
 * connect time (injectable so the value stays testable).
 */
export function helloMessage(now: Date = new Date()): HelloMessage {
  return { type: 'hello', serverTime: now.toISOString() };
}

/** `ws` readyState for an open socket (`WebSocket.OPEN`). */
const WS_OPEN = 1;

/**
 * The `ws` socket surface the `/ws` route adapts to the hub's {@link Peer}.
 */
interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(): void;
  ping(): void;
  on(event: 'message', handler: (data: unknown) => void): void;
  on(event: 'close', handler: () => void): void;
  on(event: 'pong', handler: () => void): void;
}

/** Adapts one `ws` socket to the hub's transport-neutral {@link Peer}. */
export function toPeer(socket: SocketLike): Peer {
  return {
    send: (text) => socket.send(text),
    close: () => socket.close(),
    isOpen: () => socket.readyState === WS_OPEN,
    on: (event, handler) => {
      if (event === 'message') {
        socket.on('message', handler);
      } else if (event === 'close') {
        socket.on('close', () => handler());
      } else {
        socket.on('pong', () => handler());
      }
    },
    ping: () => socket.ping(),
  };
}

/** Test seam for `buildApp`: overrides merged over the environment-derived config. */
export interface BuildAppOptions {
  config?: Partial<GameConfig>;
  /** Test seam: the RNG factory the hub draws next-cube grids from (defaults to `Math.random`). */
  random?: () => () => number;
  /** Test seam: shared clock (ms since epoch) used by the hub and repositories (defaults to `Date.now`). */
  now?: () => number;
  /**
   * Test seam: Fastify/Pino logger options. Defaults to `buildLoggerOptions(env)`,
   * which disables logging for tests/unset `NODE_ENV` and honours `LOG_LEVEL`.
   */
  logger?: FastifyServerOptions['logger'];
  /** Test seam: the metrics registry (defaults to a fresh 30-metric registry). */
  metrics?: Metrics;
  /** Test seam: auth wiring overrides. */
  auth?: {
    sessionResolver?: (cookieHeader: string | undefined) => AccountSession | null | Promise<AccountSession | null>;
    authService?: AuthService;
    users?: unknown;
    sessions?: unknown;
    verificationTokens?: unknown;
    economy?: unknown;
    email?: unknown;
    /** Test seam: SMTP transport factory used by `createSmtpEmailService` (defaults to nodemailer). */
    emailTransportFactory?: SmtpTransportFactory;
    rateLimiter?: unknown;
    pool?: unknown;
    authConfig?: Partial<AuthConfig>;
  };
  authConfig?: Partial<AuthConfig>;
}

function parseCookieHeader(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const parts = header.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (key === name) {
      const value = trimmed.slice(eq + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

/**
 * Builds the backend app.
 */
export function buildApp(
  env: Record<string, string | undefined> = process.env,
  options: BuildAppOptions = {},
): FastifyInstance {
  const config: GameConfig = { ...loadGameConfig(env), ...options.config };
  const authConfig: AuthConfig = { ...loadAuthConfig(env), ...(options.authConfig ?? {}), ...(options.auth?.authConfig ?? {}) };
  // Exact-origin allowlist for CORS, the CSRF Origin check and the WS upgrade guard.
  // `CORS_ORIGIN` is authoritative; `ALLOWED_ORIGIN` (including a buildApp override)
  // remains the fallback so the local same-origin path is unchanged.
  const allowedOrigins = resolveCorsOrigins({
    ...env,
    ALLOWED_ORIGIN: env.ALLOWED_ORIGIN ?? authConfig.allowedOrigin,
  });

  const observability = loadObservabilityConfig(env);
  const metrics = options.metrics ?? createMetrics();

  // Fly terminates TLS at its edge proxy and forwards X-Forwarded-For/Proto to the
  // machine. Trust those headers only in production (Fly sets NODE_ENV=production via
  // fly.config.toml) so `request.ip` is the client for auth rate limiting and
  // `request.protocol` reflects the public https origin; local compose keeps direct
  // connection semantics and cannot spoof its IP into the limiter.
  //
  // The app is created before the hub so the hub receives an event-first `LogSink`
  // built from the configured Pino logger (AC-3); every WS lifecycle line then shares
  // the request logger's level, redaction and serializers.
  const app = Fastify({
    trustProxy: env.NODE_ENV === 'production',
    logger: options.logger ?? buildLoggerOptions(env),
  });
  const log = createLogSink(app.log);
  app.decorate('metrics', metrics);

  // Repositories / pool
  const pool = (options.auth?.pool as { end?: () => Promise<void> } | null | undefined) ??
    createPool(authConfig.databaseUrl);

  // Exactly one instrumentation pass per runtime pool; the wrapper preserves the
  // original result/error/`this` and only records duration and outcome (AC-16).
  if (pool !== null) {
    instrumentPool(pool as unknown as Queryable, metrics);
  }

  const nowFn = options.now ?? (() => Date.now());

  const users =
    options.auth?.users ??
    (pool !== null
      ? new PgUserRepository(pool as never, { now: nowFn })
      : new InMemoryUserRepository({ now: nowFn }));

  const sessions =
    options.auth?.sessions ??
    (pool !== null
      ? new PgSessionRepository(pool as never, { now: nowFn })
      : new InMemorySessionRepository({ now: nowFn }));

  const verificationTokens =
    options.auth?.verificationTokens ??
    (pool !== null
      ? new PgVerificationTokenRepository(pool as never, { now: nowFn })
      : new InMemoryVerificationTokenRepository({ now: nowFn }));

  const economy =
    options.auth?.economy ??
    (pool !== null
      ? new PgEconomyRepository(pool as never, { now: nowFn })
      : new InMemoryEconomyRepository({ now: nowFn }));

  const email =
    options.auth?.email ??
    (authConfig.smtpHost
      ? createSmtpEmailService(authConfig, options.auth?.emailTransportFactory)
      : new FakeEmailService());

  const rateLimiter =
    options.auth?.rateLimiter ??
    // The key (IP/email) is discarded here: only the drop is counted, never logged or
    // labelled (AC-14).
    createRateLimiter(nowFn, () => {
      metrics.inc('cubeclicker_rate_limit_drops_total', { scope: 'http' });
    });

  const authService =
    options.auth?.authService ??
    createAuthService({
      users: users as never,
      sessions: sessions as never,
      verificationTokens: verificationTokens as never,
      email: email as never,
      rateLimiter: rateLimiter as never,
      clock: nowFn,
      config: {
        appBaseUrl: authConfig.appBaseUrl,
        allowedOrigin: authConfig.allowedOrigin,
        sessionCookieSecure: authConfig.sessionCookieSecure,
        sessionTtlMs: authConfig.sessionTtlMs,
        sessionTtlDays: authConfig.sessionTtlDays,
        verificationTokenTtlMs: authConfig.verificationTokenTtlMs,
        argon2MemoryCost: authConfig.argon2MemoryCost,
        argon2TimeCost: authConfig.argon2TimeCost,
        argon2Parallelism: authConfig.argon2Parallelism,
      },
    });

  const hub = createGameHub({
    config,
    now: nowFn,
    random: options.random ?? (() => Math.random),
    timers: { setInterval, clearInterval, setTimeout, clearTimeout },
    economy: economy as never,
    metrics,
    log,
  });

  // cookie support
  app.register(cookie);

  // CORS must run before auth routes so preflights never reach auth/cookie handling.
  registerCors(app, { allowedOrigins });

  // auth routes
  app.register(authRoutes, {
    auth: authService,
    authService,
    service: authService,
    sessions: sessions as never,
    sessionRepository: sessions as never,
    sessionRepo: sessions as never,
    rateLimiter: rateLimiter as never,
    rateLimit: rateLimiter as never,
    limiter: rateLimiter as never,
    authConfig,
    config: authConfig,
    allowedOrigin: authConfig.allowedOrigin,
    allowedOrigins,
    sessionCookieSecure: authConfig.sessionCookieSecure,
    sessionCookieSameSite: authConfig.sessionCookieSameSite,
    sessionTtlMs: authConfig.sessionTtlMs,
    clock: nowFn,
    now: nowFn,
  });

  // session resolver
  const providedResolver = options.auth?.sessionResolver;
  const sessionResolver = async (cookieHeader: string | undefined): Promise<AccountSession | null> => {
    if (providedResolver) {
      return await Promise.resolve(providedResolver(cookieHeader));
    }
    const token = parseCookieHeader(cookieHeader, 'session');
    if (!token) return null;
    try {
      const sessionRepo = sessions as {
      findByToken: (token: string) => Promise<{ expiresAt: number; userId: string | null } | null>;
    };
    const session = await sessionRepo.findByToken(token);
      if (!session) return null;
      if (session.expiresAt <= nowFn()) return null;
      const userId = session.userId;
      if (!userId) return null;
      const userRepo = users as {
        findById: (id: string) => Promise<{ id: string; username: string; verified: boolean } | null>;
      };
      const user = await userRepo.findById(userId);
      if (!user) return null;
      return { userId: user.id, username: user.username, verified: user.verified };
    } catch {
      return null;
    }
  };

  app.addHook('onClose', async () => {
    hub.close();
    await closePool(pool as never);
  });

  app.get('/healthz', async () => ({ status: 'ok' }));

  // Prometheus scrape on the existing port (AC-8). The route is not registered at
  // all when `METRICS_ENABLED=false`: deployed Fly sets false on its one public host
  // (no path filter), local compose keeps true on the loopback, and the CORS hook
  // never grants `/metrics`. Pool gauges are sampled at scrape.
  app.register(metricsRoutes, {
    metrics,
    enabled: observability.metricsEnabled,
    collect: () => {
      collectPoolMetrics(pool as PoolGauges | null, metrics);
    },
  });

  app.register(async (instance) => {
    await instance.register(websocket);

    instance.get('/ws', {
      websocket: true,
      // Browsers do not enforce CORS on WebSocket upgrades: validate a present Origin
      // against the same exact allowlist. The rejection happens here, in the Fastify
      // request lifecycle, so a disallowed Origin gets a real HTTP 403 and never a `101`:
      // Render's free edge does not relay the immediate post-upgrade close frame, so the
      // client would otherwise only observe a bare FIN/1006. The `1008` close in the
      // handler below stays as defense in depth for a transport that reaches it directly.
      preValidation: async (request, reply) => {
        if (typeof request.headers.upgrade !== 'string' || request.headers.upgrade.toLowerCase() !== 'websocket') {
          return;
        }
        if (isWebSocketOriginAllowed(request.headers.origin, allowedOrigins)) {
          return;
        }
        reply.header('vary', 'Origin');
        await reply.code(403).send({ message: 'origin not allowed', code: 'origin_not_allowed' });
      },
    }, async (socket, req) => {
      // Defense in depth for direct/different transports (no Fastify lifecycle): repeat
      // the Origin decision and close `1008` before `hello`. A missing Origin stays
      // allowed for non-browser clients (Node smoke/CLI).
      if (!isWebSocketOriginAllowed(req.headers.origin, allowedOrigins)) {
        socket.close(WEBSOCKET_ORIGIN_REJECTED_CLOSE_CODE);
        return;
      }
      if (!hub.hasCapacity()) {
        // Pre-attach rejection: counted and logged with the Fastify request id. The hub
        // `attach` backstop counts the same way if it is ever reached directly.
        metrics.inc('cubeclicker_ws_connections_rejected_total', { reason: 'capacity' });
        log.warn('ws_connection_rejected', { connectionId: req.id, reason: 'capacity' });
        socket.close();
        return;
      }
      const accountSession = await sessionResolver(req.headers.cookie as string | undefined);
      socket.send(JSON.stringify(helloMessage()));
      // The hub does not send `hello`; the app counts the one encode and the one frame
      // delivery here so the catalog covers the handshake frame (AC-9/AC-11).
      metrics.inc('cubeclicker_ws_messages_encoded_total', { type: 'hello' });
      metrics.inc('cubeclicker_ws_frames_sent_total', { type: 'hello' });
      // `req.id` correlates the upgrade request log with the hub lifecycle logs (AC-3).
      hub.attach(toPeer(socket as never), accountSession, req.id);
    });
  });

  return app;
}
