import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import { loadGameConfig } from './game/config.js';
import { createGameHub, type Peer } from './game/hub.js';

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
 *
 * Declared structurally because `@fastify/websocket`'s socket type resolves through the
 * untyped `ws` package; the adapter is the single place that knows about `readyState`.
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

/**
 * Builds the backend app: HTTP health at `GET /healthz` and the WebSocket endpoint at
 * `GET /ws`. The route sends exactly one `hello` first (the retained envelope) and then
 * hands the socket to the multiplayer hub, which owns everything after it. No side effects
 * on import — listening is the entrypoint's job (`server.ts`); the environment is read here
 * (validated by `game/config.ts`) and a fresh hub is created per build (in-memory lifecycle,
 * AC-4).
 */
export function buildApp(env: Record<string, string | undefined> = process.env): FastifyInstance {
  const config = loadGameConfig(env);
  const hub = createGameHub({
    config,
    now: () => Date.now(),
    random: () => Math.random,
    timers: { setInterval, clearInterval, setTimeout, clearTimeout },
  });
  const app = Fastify();

  app.addHook('onClose', async () => {
    hub.close();
  });

  app.get('/healthz', async () => ({ status: 'ok' }));

  // The websocket plugin installs the route hook that turns `{ websocket: true }` routes
  // into upgrade handlers, so it must finish loading before the `/ws` route is registered.
  app.register(async (instance) => {
    await instance.register(websocket);

    instance.get('/ws', { websocket: true }, (socket) => {
      // `hello` is always the first frame (AC-20); the hub never sends it, so there can be
      // no duplicate and no message can precede it.
      socket.send(JSON.stringify(helloMessage()));
      hub.attach(toPeer(socket));
    });
  });

  return app;
}
