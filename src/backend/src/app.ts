import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';

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

/**
 * Builds the backend app: HTTP health at `GET /healthz` and the WebSocket endpoint at
 * `GET /ws` (which sends exactly one `hello` message per connection). No side effects on
 * import — listening is the entrypoint's job (`server.ts`).
 */
export function buildApp(): FastifyInstance {
  const app = Fastify();

  app.get('/healthz', async () => ({ status: 'ok' }));

  // The websocket plugin installs the route hook that turns `{ websocket: true }` routes
  // into upgrade handlers, so it must finish loading before the `/ws` route is registered.
  app.register(async (instance) => {
    await instance.register(websocket);

    instance.get('/ws', { websocket: true }, (socket) => {
      socket.send(JSON.stringify(helloMessage()));
    });
  });

  return app;
}
