import { describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, helloMessage, toPeer } from './app.js';
import type { ServerMessage } from './game/protocol.js';

interface HelloEnvelope {
  type: unknown;
  serverTime: unknown;
}

function isIsoDate(value: unknown): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function listenPort(app: FastifyInstance): number {
  const address = app.server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('expected an inet address after listen');
  }
  return address.port;
}

/** Opens a real client (Node's global WebSocket) and resolves with the first message. */
function nextHello(url: string): Promise<HelloEnvelope> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`no hello received from ${url} within 2000ms`));
    }, 2000);

    socket.addEventListener('message', (event) => {
      clearTimeout(timer);
      socket.close();
      try {
        resolve(JSON.parse(String(event.data)) as HelloEnvelope);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error(`socket error while connecting to ${url}`));
    });
  });
}

describe('helloMessage', () => {
  it('builds the pinned envelope with an ISO-8601 serverTime', () => {
    const now = new Date('2026-10-18T10:00:00.000Z');

    expect(helloMessage(now)).toEqual({
      type: 'hello',
      serverTime: '2026-10-18T10:00:00.000Z',
    });
  });

  it('stamps the current server clock by default', () => {
    const before = Date.now();
    const message = helloMessage();
    const after = Date.now();
    const serverTime = Date.parse(message.serverTime);

    expect(message.type).toBe('hello');
    expect(Number.isNaN(serverTime)).toBe(false);
    expect(serverTime).toBeGreaterThanOrEqual(before);
    expect(serverTime).toBeLessThanOrEqual(after);
  });
});

describe('GET /healthz', () => {
  it('returns 200 with the pinned body', async () => {
    const app = buildApp();
    try {
      const response = await app.inject({ method: 'GET', url: '/healthz' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.json()).toEqual({ status: 'ok' });
    } finally {
      await app.close();
    }
  });
});

describe('GET /ws', () => {
  it('sends the pinned hello envelope to each concurrent client', async () => {
    const app = buildApp();
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;

    try {
      const [first, second] = await Promise.all([nextHello(url), nextHello(url)]);

      for (const envelope of [first, second]) {
        expect(envelope.type).toBe('hello');
        expect(isIsoDate(envelope.serverTime)).toBe(true);
      }
    } finally {
      await app.close();
    }
  });

  it('plays the full handshake over a live socket: hello, join, welcome, memberJoined', async () => {
    const app = buildApp({});
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;
    const first = await connectClient(url);
    const second = await connectClient(url);

    try {
      const firstHello = helloOf(await first.next());
      expect(isIsoDate(firstHello.serverTime)).toBe(true);
      const secondHello = helloOf(await second.next());
      expect(isIsoDate(secondHello.serverTime)).toBe(true);

      first.send({ type: 'join' });
      const firstWelcome = welcomeOf(await first.next());
      expect(firstWelcome.playerId).toBe('p1');
      expect(firstWelcome.name).toBe('Player 1');
      expect(firstWelcome.serverId).toBe(1);
      expect(firstWelcome.maxUsers).toBe(10);
      expect(firstWelcome.position).toEqual({ x: 38.197186342054884, y: 0 });
      expect(firstWelcome.self.levelIndex).toBe(0);
      // The app draws with the real RNG; the pinned draw formula is tested in hub.test.
      expect([3, 4, 5, 6, 7]).toContain(firstWelcome.self.gridSize);
      expect(firstWelcome.self.styleId).toBe('obsidian-neon');
      expect(firstWelcome.self.removedIds).toEqual([]);
      expect(firstWelcome.roster).toHaveLength(1);
      expect(firstWelcome.roster[0]!.playerId).toBe('p1');

      second.send({ type: 'join' });
      const secondWelcome = welcomeOf(await second.next());
      expect(secondWelcome.playerId).toBe('p2');
      expect(secondWelcome.serverId).toBe(1);
      expect(secondWelcome.position).toEqual({ x: 30.902172888029035, y: 22.45174281092734 });
      expect(secondWelcome.roster).toHaveLength(2);

      // The first client sees the join as a server-scoped broadcast (no hello/welcome repeat).
      const joined = await first.next();
      expect(joined).toEqual({
        type: 'memberJoined',
        member: {
          playerId: 'p2',
          name: 'Player 2',
          position: secondWelcome.position,
          levelIndex: secondWelcome.self.levelIndex,
          gridSize: secondWelcome.self.gridSize,
          styleId: secondWelcome.self.styleId,
          removedIds: secondWelcome.self.removedIds,
        },
      });
    } finally {
      first.close();
      second.close();
      await app.close();
    }
  });

  it('keeps each app build independent (in-memory lifecycle, AC-4)', async () => {
    const firstApp = buildApp({});
    const secondApp = buildApp({});
    await firstApp.listen({ host: '127.0.0.1', port: 0 });
    await secondApp.listen({ host: '127.0.0.1', port: 0 });
    const firstUrl = `ws://127.0.0.1:${listenPort(firstApp)}/ws`;
    const secondUrl = `ws://127.0.0.1:${listenPort(secondApp)}/ws`;
    const firstClient = await connectClient(firstUrl);
    const secondClient = await connectClient(firstUrl);
    const otherWorldClient = await connectClient(secondUrl);

    try {
      await firstClient.next(); // hello
      await secondClient.next(); // hello
      await otherWorldClient.next(); // hello
      firstClient.send({ type: 'join' });
      const firstWelcome = welcomeOf(await firstClient.next());
      secondClient.send({ type: 'join' });
      const secondWelcome = welcomeOf(await secondClient.next());
      otherWorldClient.send({ type: 'join' });
      const otherWelcome = welcomeOf(await otherWorldClient.next());

      expect(firstWelcome.playerId).toBe('p1');
      expect(firstWelcome.serverId).toBe(1);
      expect(secondWelcome.playerId).toBe('p2');
      expect(secondWelcome.serverId).toBe(1);
      // The second build never saw the first build's members: it starts at p1/server 1.
      expect(otherWelcome.playerId).toBe('p1');
      expect(otherWelcome.serverId).toBe(1);
      expect(otherWelcome.roster).toHaveLength(1);
    } finally {
      firstClient.close();
      secondClient.close();
      otherWorldClient.close();
      await firstApp.close();
      await secondApp.close();
    }
  });
});

type WelcomeMessage = Extract<ServerMessage, { type: 'welcome' }>;

/** A minimal stand-in for the `ws` socket surface the adapter consumes. */
class FakeSocket {
  readyState = 1;
  readonly sent: string[] = [];
  closed = false;
  pingCount = 0;
  private readonly handlers: Record<
    'message' | 'close' | 'pong',
    Array<(arg?: unknown) => void>
  > = { message: [], close: [], pong: [] };

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
  }

  ping(): void {
    this.pingCount += 1;
  }

  on(event: 'message' | 'close' | 'pong', handler: (arg?: unknown) => void): void {
    this.handlers[event].push(handler);
  }

  emit(event: 'message' | 'close' | 'pong', arg?: unknown): void {
    for (const handler of this.handlers[event]) {
      handler(arg);
    }
  }
}

describe('toPeer', () => {
  it('adapts send, close, ping, readyState and the three transport events', () => {
    const socket = new FakeSocket();
    const peer = toPeer(socket as unknown as Parameters<typeof toPeer>[0]);

    expect(peer.isOpen()).toBe(true);
    socket.readyState = 3;
    expect(peer.isOpen()).toBe(false);
    socket.readyState = 1;

    peer.send('{"type":"join"}');
    peer.ping();
    expect(socket.sent).toEqual(['{"type":"join"}']);
    expect(socket.pingCount).toBe(1);

    let received: unknown = null;
    peer.on('message', (arg) => {
      received = arg;
    });
    socket.emit('message', 'frame');
    expect(received).toBe('frame');

    let closes = 0;
    peer.on('close', () => {
      closes += 1;
    });
    socket.emit('close');
    expect(closes).toBe(1);

    let pongs = 0;
    peer.on('pong', () => {
      pongs += 1;
    });
    socket.emit('pong');
    expect(pongs).toBe(1);

    peer.close();
    expect(socket.closed).toBe(true);
  });
});

/** A minimal async client over Node's global WebSocket (no test dependencies). */
interface TestClient {
  send(message: unknown): void;
  next(): Promise<ServerMessage>;
  close(): void;
}

function connectClient(url: string): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const queued: ServerMessage[] = [];
    const waiters: Array<(message: ServerMessage) => void> = [];

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      const waiter = waiters.shift();
      if (waiter === undefined) {
        queued.push(message);
      } else {
        waiter(message);
      }
    });
    socket.addEventListener('error', () => {
      reject(new Error(`socket error while connecting to ${url}`));
    });
    socket.addEventListener('open', () => {
      resolve({
        send(message: unknown): void {
          socket.send(JSON.stringify(message));
        },
        next(): Promise<ServerMessage> {
          return new Promise<ServerMessage>((resolveNext, rejectNext) => {
            const queuedMessage = queued.shift();
            if (queuedMessage !== undefined) {
              resolveNext(queuedMessage);
              return;
            }
            const timer = setTimeout(() => {
              rejectNext(new Error(`no message from ${url} within 2000ms`));
            }, 2000);
            waiters.push((message) => {
              clearTimeout(timer);
              resolveNext(message);
            });
          });
        },
        close(): void {
          socket.close();
        },
      });
    });
  });
}

function helloOf(message: ServerMessage): { type: 'hello'; serverTime: string } {
  expect(message.type).toBe('hello');
  if (message.type !== 'hello') {
    throw new Error('expected a hello message');
  }
  return message;
}

function welcomeOf(message: ServerMessage): WelcomeMessage {
  expect(message.type).toBe('welcome');
  if (message.type !== 'welcome') {
    throw new Error('expected a welcome message');
  }
  return message;
}
