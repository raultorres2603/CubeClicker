import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import cookie from '@fastify/cookie';
import { loadGameConfig, type GameConfig } from './game/config.js';
import { createGameHub, type Peer, type AccountSession } from './game/hub.js';
import { loadAuthConfig, type AuthConfig } from './auth/config.js';
import { createPool, closePool } from './db/pool.js';
import { InMemoryUserRepository, PgUserRepository } from './auth/user-repository.js';
import { InMemorySessionRepository, PgSessionRepository } from './auth/session-repository.js';
import { InMemoryVerificationTokenRepository, PgVerificationTokenRepository } from './auth/verification-token-repository.js';
import { FakeEmailService, SmtpEmailService } from './auth/email.js';
import { createRateLimiter } from './auth/rate-limit.js';
import { createAuthService, type AuthService } from './auth/auth-service.js';
import { authRoutes } from './auth/auth-routes.js';

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
  /** Test seam: auth wiring overrides. */
  auth?: {
    sessionResolver?: (cookieHeader: string | undefined) => AccountSession | null | Promise<AccountSession | null>;
    authService?: AuthService;
    users?: unknown;
    sessions?: unknown;
    verificationTokens?: unknown;
    email?: unknown;
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

  // Repositories / pool
  const pool = (options.auth?.pool as { end?: () => Promise<void> } | null | undefined) ??
    createPool(authConfig.databaseUrl);

  const nowFn = () => Date.now();

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

  const email =
    options.auth?.email ??
    (authConfig.smtpHost
      ? new SmtpEmailService({
          host: authConfig.smtpHost,
          port: authConfig.smtpPort,
          user: authConfig.smtpUser,
          pass: authConfig.smtpPass,
          from: authConfig.smtpFrom,
        })
      : new FakeEmailService());

  const rateLimiter = options.auth?.rateLimiter ?? createRateLimiter(() => Date.now());

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
    now: () => Date.now(),
    random: options.random ?? (() => Math.random),
    timers: { setInterval, clearInterval, setTimeout, clearTimeout },
  });

  const app = Fastify();

  // cookie support
  app.register(cookie);

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
    sessionCookieSecure: authConfig.sessionCookieSecure,
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
      if (session.expiresAt <= Date.now()) return null;
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

  app.register(async (instance) => {
    await instance.register(websocket);

    instance.get('/ws', { websocket: true }, async (socket, req) => {
      if (!hub.hasCapacity()) {
        socket.close();
        return;
      }
      const accountSession = await sessionResolver(req.headers.cookie as string | undefined);
      socket.send(JSON.stringify(helloMessage()));
      hub.attach(toPeer(socket as never), accountSession);
    });
  });

  return app;
}
