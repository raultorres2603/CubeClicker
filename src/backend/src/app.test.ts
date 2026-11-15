import http from 'node:http';
import { describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, helloMessage, toPeer } from './app.js';
import { allIds } from './game/cubes.js';
import type { ServerMessage } from './game/protocol.js';
import { InMemoryEconomyRepository } from './auth/economy-repository.js';
import { FakeEmailService } from './auth/email.js';
import type { PartId } from './game/parts.js';
import { roundCoins, idleCoins } from './game/economy.js';
import { WEBSOCKET_ORIGIN_REJECTED_CLOSE_CODE } from './cors.js';
import { buildLoggerOptions } from './observability/logging.js';
import { METRIC_DEFINITIONS, type MetricDefinition } from './observability/metrics.js';

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

interface RawFrame {
  opcode: number;
  payload: Buffer;
}

interface RawUpgradeResult {
  statusCode: number;
  frames: RawFrame[];
}

/** Parses one unmasked server frame; returns null until the full frame is buffered. */
function parseRawFrame(buffer: Buffer): { frame: RawFrame; rest: Buffer } | null {
  if (buffer.length < 2) return null;
  const opcode = buffer[0]! & 0x0f;
  const masked = (buffer[1]! & 0x80) !== 0;
  let length = buffer[1]! & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return null;
    length = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }
  const maskBytes = masked ? 4 : 0;
  if (buffer.length < offset + maskBytes + length) return null;
  let payload = buffer.subarray(offset + maskBytes, offset + maskBytes + length);
  if (masked) {
    const mask = buffer.subarray(offset, offset + 4);
    payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]!));
  }
  return {
    frame: { opcode, payload },
    rest: buffer.subarray(offset + maskBytes + length),
  };
}

/**
 * Performs a raw `node:http` WebSocket upgrade (no client dependency) and resolves with
 * the upgrade status plus the first frame the server sends. A close frame (opcode 8) or
 * the first text frame (opcode 1) ends the collection, so an allowed upgrade resolves on
 * `hello` and a denied upgrade resolves on the close frame, proving no `hello` was sent.
 */
function rawUpgrade(port: number, origin?: string): Promise<RawUpgradeResult> {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port,
      path: '/ws',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        // RFC 6455 example nonce: 16 bytes, accepted by the ws handshake.
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13',
        ...(origin === undefined ? {} : { Origin: origin }),
      },
    });
    let settled = false;
    let buffer = Buffer.alloc(0);
    const frames: RawFrame[] = [];
    const timer = setTimeout(() => {
      fail(new Error('timed out waiting for WebSocket frames'));
    }, 2000);

    function fail(error: Error): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    }

    function settle(response: http.IncomingMessage): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ statusCode: response.statusCode ?? 0, frames });
    }

    request.on('upgrade', (response, socket, head) => {
      buffer = Buffer.from(head);
      const drain = (): void => {
        for (;;) {
          const parsed = parseRawFrame(buffer);
          if (parsed === null) return;
          buffer = parsed.rest;
          frames.push(parsed.frame);
          if (parsed.frame.opcode === 8 || parsed.frame.opcode === 1) {
            socket.end();
            settle(response);
            return;
          }
        }
      };
      socket.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        drain();
      });
      socket.on('close', () => {
        settle(response);
      });
      socket.on('error', fail);
      drain();
    });
    request.on('response', (response) => {
      fail(new Error(`expected a WebSocket upgrade, received HTTP ${response.statusCode}`));
    });
    request.on('error', fail);
    request.end();
  });
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

/** Opens a client and resolves with every frame received before the server closed it. */
function framesBeforeClose(url: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const frames: unknown[] = [];
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`socket at ${url} was not closed within 2000ms`));
    }, 2000);

    socket.addEventListener('message', (event) => {
      frames.push(JSON.parse(String(event.data)) as unknown);
    });
    socket.addEventListener('error', () => {
      clearTimeout(timer);
      reject(new Error(`socket error while connecting to ${url}`));
    });
    socket.addEventListener('close', () => {
      clearTimeout(timer);
      resolve(frames);
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
          yawSteps: 0,
          pitchSteps: 0,
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

  it('drops the 31st explode in a trailing second over a live socket (AC-14, F4)', async () => {
    const app = buildApp({});
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;
    const client = await connectClient(url);

    try {
      expect(helloOf(await client.next()).type).toBe('hello');
      client.send({ type: 'join' });
      const welcome = welcomeOf(await client.next());
      expect(welcome.playerId).toBe('p1');
      // The first 30 ids of the smallest grid exist on every server draw (N = 3…7).
      const ids = allIds(welcome.self.gridSize).slice(0, 31);

      for (let index = 0; index < 30; index += 1) {
        client.send({ type: 'explode', id: ids[index]!, level: 0 });
      }
      // The 40 ms removal window collapses the burst into one batch frame (AC-8/AC-10).
      expect(await client.next()).toEqual({
        type: 'miniCubesRemoved',
        playerId: 'p1',
        ids: ids.slice(0, 30),
      });

      // The 31st click in the same trailing second is dropped with a single error.
      client.send({ type: 'explode', id: ids[30]!, level: 0 });
      expect(await client.next()).toEqual({ type: 'error', code: 'rate_limited' });
    } finally {
      client.close();
      await app.close();
    }
  });

  it('packs three servers after each completion over live sockets (X = 2, AC-10, F3)', async () => {
    const app = buildApp(
      { MAX_USERS_PER_SERVER: '2', RECONNECT_GRACE_MS: '1000' },
      // Pin N = 3 (54-tile levels) and keep the bursts clear of the separately pinned limiter.
      { config: { clickRateLimitPerSecond: 100 }, random: () => () => 0 },
    );
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;
    const clients = await Promise.all([
      connectClient(url),
      connectClient(url),
      connectClient(url),
      connectClient(url),
      connectClient(url),
    ]);
    const [first, second, third, fourth, fifth] = clients as [
      TestClient,
      TestClient,
      TestClient,
      TestClient,
      TestClient,
    ];

    try {
      for (const client of clients) {
        expect(helloOf(await client.next()).type).toBe('hello');
      }
      first.send({ type: 'join' });
      const firstWelcome = welcomeOf(await first.next());
      second.send({ type: 'join' });
      const secondWelcome = welcomeOf(await second.next());
      third.send({ type: 'join' });
      const thirdWelcome = welcomeOf(await third.next());
      fourth.send({ type: 'join' });
      const fourthWelcome = welcomeOf(await fourth.next());
      fifth.send({ type: 'join' });
      const fifthWelcome = welcomeOf(await fifth.next());

      // [1: p1, p2] [2: p3, p4] [3: p5].
      expect(firstWelcome.serverId).toBe(1);
      expect(secondWelcome.serverId).toBe(1);
      expect(thirdWelcome.serverId).toBe(2);
      expect(fourthWelcome.serverId).toBe(2);
      expect(fifthWelcome.serverId).toBe(3);
      expect(firstWelcome.position).toEqual({ x: 7.639437268410976, y: 0 });
      expect(secondWelcome.position).toEqual({
        x: -7.639437268410976,
        y: 9.355612398046502e-16,
      });
      expect(thirdWelcome.position).toEqual({ x: 7.639437268410976, y: 0 });
      expect(fourthWelcome.position).toEqual({
        x: -7.639437268410976,
        y: 9.355612398046502e-16,
      });
      expect(fifthWelcome.position).toEqual({ x: 7.639437268410976, y: 0 });

      // p3 still has p4's join broadcast queued.
      expect(await third.next()).toEqual({
        type: 'memberJoined',
        member: {
          playerId: 'p4',
          name: 'Player 4',
          position: fourthWelcome.position,
          levelIndex: 0,
          gridSize: fourthWelcome.self.gridSize,
          styleId: fourthWelcome.self.styleId,
          removedIds: [],
          yawSteps: 0,
          pitchSteps: 0,
        },
      });
      expect(fourthWelcome.roster[0]).toEqual({
        playerId: 'p3',
        name: 'Player 3',
        position: thirdWelcome.position,
        levelIndex: 0,
        gridSize: thirdWelcome.self.gridSize,
        styleId: thirdWelcome.self.styleId,
        removedIds: [],
        yawSteps: 0,
        pitchSteps: 0,
      });

      // p1's grace expires; only p2 (server 1) hears about it.
      first.close();
      expect(await second.next()).toEqual({ type: 'memberLeft', playerId: 'p1', reason: 'left' });

      // p3 completes: the planned move executes into server 1's freed slot.
      const thirdIds = allIds(thirdWelcome.self.gridSize);
      for (const id of thirdIds) {
        third.send({ type: 'explode', id, level: 0 });
      }
      // One 40 ms window holds the whole level: one batch frame per recipient.
      const thirdBatch = await third.next();
      expect(thirdBatch).toEqual({
        type: 'miniCubesRemoved',
        playerId: 'p3',
        ids: thirdIds,
      });
      expect(await fourth.next()).toEqual(thirdBatch);
      third.send({ type: 'cubeCompleted', level: 0 });
      const enteredThird = await third.next();
      expect(enteredThird.type).toBe('worldEntered');
      if (enteredThird.type !== 'worldEntered') {
        throw new Error('expected p3 to enter the target world');
      }
      expect(enteredThird.playerId).toBe('p3');
      expect(enteredThird.name).toBe('Player 3');
      expect(enteredThird.token).toBe(thirdWelcome.token);
      expect(enteredThird.serverId).toBe(1);
      expect(enteredThird.maxUsers).toBe(2);
      expect(enteredThird.position).toEqual({ x: 7.639437268410976, y: 0 });
      expect(enteredThird.self.levelIndex).toBe(1);
      expect(enteredThird.self.gridSize).toBe(3);
      expect(enteredThird.self.styleId).toBe('crimson-alloy');
      expect(enteredThird.self.removedIds).toEqual([]);
      expect(enteredThird.roster).toEqual([
        {
          playerId: 'p3',
          name: 'Player 3',
          position: { x: 7.639437268410976, y: 0 },
          levelIndex: 1,
          gridSize: 3,
          styleId: 'crimson-alloy',
          removedIds: [],
          yawSteps: 0,
          pitchSteps: 0,
        },
        {
          playerId: 'p2',
          name: 'Player 2',
          position: secondWelcome.position,
          levelIndex: 0,
          gridSize: secondWelcome.self.gridSize,
          styleId: secondWelcome.self.styleId,
          removedIds: [],
          yawSteps: 0,
          pitchSteps: 0,
        },
      ]);
      expect(await second.next()).toEqual({
        type: 'memberJoined',
        member: enteredThird.roster[0],
      });
      expect(await fourth.next()).toEqual({
        type: 'memberLeft',
        playerId: 'p3',
        reason: 'moved',
      });

      // p5 completes: the re-planned move executes into server 2's hole.
      const fifthIds = allIds(fifthWelcome.self.gridSize);
      for (const id of fifthIds) {
        fifth.send({ type: 'explode', id, level: 0 });
      }
      expect(await fifth.next()).toEqual({
        type: 'miniCubesRemoved',
        playerId: 'p5',
        ids: fifthIds,
      });
      fifth.send({ type: 'cubeCompleted', level: 0 });
      const enteredFifth = await fifth.next();
      expect(enteredFifth.type).toBe('worldEntered');
      if (enteredFifth.type !== 'worldEntered') {
        throw new Error('expected p5 to enter the target world');
      }
      expect(enteredFifth.playerId).toBe('p5');
      expect(enteredFifth.name).toBe('Player 5');
      expect(enteredFifth.token).toBe(fifthWelcome.token);
      expect(enteredFifth.serverId).toBe(2);
      expect(enteredFifth.maxUsers).toBe(2);
      expect(enteredFifth.position).toEqual({ x: 7.639437268410976, y: 0 });
      expect(enteredFifth.self.levelIndex).toBe(1);
      expect(enteredFifth.self.gridSize).toBe(3);
      expect(enteredFifth.self.styleId).toBe('crimson-alloy');
      expect(enteredFifth.self.removedIds).toEqual([]);
      expect(enteredFifth.roster).toEqual([
        {
          playerId: 'p5',
          name: 'Player 5',
          position: { x: 7.639437268410976, y: 0 },
          levelIndex: 1,
          gridSize: 3,
          styleId: 'crimson-alloy',
          removedIds: [],
          yawSteps: 0,
          pitchSteps: 0,
        },
        {
          playerId: 'p4',
          name: 'Player 4',
          position: fourthWelcome.position,
          levelIndex: 0,
          gridSize: fourthWelcome.self.gridSize,
          styleId: fourthWelcome.self.styleId,
          removedIds: [],
          yawSteps: 0,
          pitchSteps: 0,
        },
      ]);
      expect(await fourth.next()).toEqual({
        type: 'memberJoined',
        member: enteredFifth.roster[0],
      });

      // Servers 1 and 2 are full and server 3 is gone: a fresh join gets id 4.
      const sixth = await connectClient(url);
      try {
        expect(helloOf(await sixth.next()).type).toBe('hello');
        sixth.send({ type: 'join' });
        const sixthWelcome = welcomeOf(await sixth.next());
        expect(sixthWelcome.serverId).toBe(4);
        expect(sixthWelcome.position).toEqual({ x: 7.639437268410976, y: 0 });
        expect(sixthWelcome.roster).toEqual([
          {
            playerId: 'p6',
            name: 'Player 6',
            position: { x: 7.639437268410976, y: 0 },
            levelIndex: 0,
            gridSize: 3,
            styleId: 'obsidian-neon',
            removedIds: [],
            yawSteps: 0,
            pitchSteps: 0,
          },
        ]);
      } finally {
        sixth.close();
      }
    } finally {
      for (const client of clients) {
        client.close();
      }
      await app.close();
    }
  }, 10_000);

  it('closes a socket over the connection cap without sending hello first (AC-20, F5)', async () => {
    const app = buildApp({}, { config: { maxConnections: 1 } });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;
    const accepted = await connectClient(url);

    try {
      expect(helloOf(await accepted.next()).type).toBe('hello');

      // The over-cap upgrade is terminated before the protocol starts: no hello frame.
      expect(await framesBeforeClose(url)).toEqual([]);

      // The accepted socket still works for the full handshake.
      accepted.send({ type: 'join' });
      const welcome = welcomeOf(await accepted.next());
      expect(welcome.playerId).toBe('p1');
      expect(welcome.serverId).toBe(1);
    } finally {
      accepted.close();
      await app.close();
    }
  });
});

describe('GET /ws Origin guard (AC-7)', () => {
  it('closes a present, non-allowlisted Origin with 1008 and sends no hello', async () => {
    const app = buildApp({ CORS_ORIGIN: 'https://app.example.test' });
    await app.listen({ host: '127.0.0.1', port: 0 });
    try {
      const result = await rawUpgrade(listenPort(app), 'https://evil.example');

      expect(result.statusCode).toBe(101);
      expect(result.frames.map((frame) => frame.opcode)).toEqual([8]);
      expect(result.frames[0]!.payload.readUInt16BE(0)).toBe(
        WEBSOCKET_ORIGIN_REJECTED_CLOSE_CODE,
      );
      expect(WEBSOCKET_ORIGIN_REJECTED_CLOSE_CODE).toBe(1008);
    } finally {
      await app.close();
    }
  });

  it('sends the pinned hello to an allowlisted Origin', async () => {
    const app = buildApp({ CORS_ORIGIN: 'https://app.example.test' });
    await app.listen({ host: '127.0.0.1', port: 0 });
    try {
      const result = await rawUpgrade(listenPort(app), 'https://app.example.test');

      expect(result.statusCode).toBe(101);
      expect(result.frames.map((frame) => frame.opcode)).toEqual([1]);
      const message = JSON.parse(result.frames[0]!.payload.toString('utf8')) as HelloEnvelope;
      expect(message.type).toBe('hello');
      expect(isIsoDate(message.serverTime)).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('sends hello when Origin is absent for non-browser clients', async () => {
    const app = buildApp({ CORS_ORIGIN: 'https://app.example.test' });
    await app.listen({ host: '127.0.0.1', port: 0 });
    try {
      const result = await rawUpgrade(listenPort(app));

      expect(result.statusCode).toBe(101);
      expect(result.frames.map((frame) => frame.opcode)).toEqual([1]);
      const message = JSON.parse(result.frames[0]!.payload.toString('utf8')) as HelloEnvelope;
      expect(message.type).toBe('hello');
      expect(isIsoDate(message.serverTime)).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('keeps the local dev origin allowed with the default allowlist', async () => {
    const app = buildApp({});
    await app.listen({ host: '127.0.0.1', port: 0 });
    try {
      const result = await rawUpgrade(listenPort(app), 'http://localhost:5173');

      expect(result.statusCode).toBe(101);
      expect(result.frames.map((frame) => frame.opcode)).toEqual([1]);
      const message = JSON.parse(result.frames[0]!.payload.toString('utf8')) as HelloEnvelope;
      expect(message.type).toBe('hello');
      expect(isIsoDate(message.serverTime)).toBe(true);
    } finally {
      await app.close();
    }
  });
});

describe('trust proxy (Fly)', () => {
  it('trusts X-Forwarded-For/Proto in production and ignores them locally', async () => {
    // `logger: false` keeps the additive structured logging out of the test output;
    // this suite asserts trust-proxy behavior only.
    const production = buildApp({ NODE_ENV: 'production' }, { logger: false });
    production.get('/test/request-origin', async (request) => ({
      ip: request.ip,
      protocol: request.protocol,
    }));
    await production.ready();
    try {
      const response = await production.inject({
        method: 'GET',
        url: '/test/request-origin',
        headers: { 'x-forwarded-for': '203.0.113.9', 'x-forwarded-proto': 'https' },
        remoteAddress: '10.0.0.2',
      });
      expect(response.json()).toEqual({ ip: '203.0.113.9', protocol: 'https' });
    } finally {
      await production.close();
    }

    const local = buildApp({ NODE_ENV: 'development' }, { logger: false });
    local.get('/test/request-origin', async (request) => ({
      ip: request.ip,
      protocol: request.protocol,
    }));
    await local.ready();
    try {
      const response = await local.inject({
        method: 'GET',
        url: '/test/request-origin',
        headers: { 'x-forwarded-for': '203.0.113.9', 'x-forwarded-proto': 'https' },
        remoteAddress: '127.0.0.1',
      });
      expect(response.json()).toEqual({ ip: '127.0.0.1', protocol: 'http' });
    } finally {
      await local.close();
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
  /** Frames received and not yet consumed by `next()` (used to assert silence). */
  queuedCount(): number;
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
        queuedCount(): number {
          return queued.length;
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

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
}

function nextOrTimeout(client: TestClient, ms: number): Promise<ServerMessage | null> {
  return Promise.race([
    client.next(),
    new Promise<ServerMessage | null>((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

/** Waits briefly and asserts the client received no frame (no waiter is left behind). */
async function expectNoFrame(client: TestClient): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 50);
  });
  expect(client.queuedCount()).toBe(0);
}

describe('account economy integration (T12)', () => {
  it('account join with seeded economy repo returns persisted totals in welcome.economy', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit('u1', { coins: 1.25, clicks: 3, facesDestroyed: 2, cubesDestroyed: 1 });

    const app = buildApp({}, {
      auth: {
        sessionResolver: () => ({ userId: 'u1', username: 'alice', verified: true }),
        economy: repo,
      },
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;
    const client = await connectClient(url);

    try {
      expect(helloOf(await client.next()).type).toBe('hello');
      client.send({ type: 'join' });
      const welcome = welcomeOf(await client.next());
      expect(welcome.economy).toEqual({ coins: 1.25, clicks: 3, facesDestroyed: 2, cubesDestroyed: 1 });
    } finally {
      client.close();
      await app.close();
    }
  });

  it('explode credits and sends economyUpdate for an account', async () => {
    const repo = new InMemoryEconomyRepository();
    const app = buildApp({}, {
      auth: {
        sessionResolver: () => ({ userId: 'u1', username: 'alice', verified: true }),
        economy: repo,
      },
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;
    const client = await connectClient(url);

    try {
      expect(helloOf(await client.next()).type).toBe('hello');
      client.send({ type: 'join' });
      const welcome = welcomeOf(await client.next());
      expect(welcome.playerId).toBe('p1');

      client.send({ type: 'explode', id: 'front:0:0', level: 0 });
      await flushMicrotasks();

      const removed = await client.next();
      expect(removed).toEqual({ type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' });

      const update = await client.next();
      expect(update).toEqual({
        type: 'economyUpdate',
        coins: 0.1,
        clicks: 1,
        facesDestroyed: 0,
        cubesDestroyed: 0,
      });

      expect(await repo.findByUserId('u1')).toEqual({
        coins: 0.1,
        clicks: 1,
        facesDestroyed: 0,
        cubesDestroyed: 0,
      });
    } finally {
      client.close();
      await app.close();
    }
  });

  it('guest does not persist and sends no economyUpdate', async () => {
    const repo = new InMemoryEconomyRepository();
    const app = buildApp({}, {
      auth: { economy: repo },
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;
    const client = await connectClient(url);

    try {
      expect(helloOf(await client.next()).type).toBe('hello');
      client.send({ type: 'join' });
      const welcome = welcomeOf(await client.next());
      expect(welcome.playerId).toBe('p1');

      client.send({ type: 'explode', id: 'front:0:0', level: 0 });
      await flushMicrotasks();

      const removed = await client.next();
      expect(removed).toEqual({ type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' });

      const maybeUpdate = await nextOrTimeout(client, 50);
      expect(maybeUpdate).toBeNull();

      expect(await repo.findByUserId('u1')).toBeNull();
    } finally {
      client.close();
      await app.close();
    }
  });
});

describe('spending upgrades integration (T5)', () => {
  it('account join with seeded upgrades returns persisted levels in welcome.upgrades', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit('u1', { coins: 100 });
    await repo.purchaseUpgrade('u1', 'mini_cube_value', 10, 0);
    await repo.purchaseUpgrade('u1', 'mini_cube_value', 20, 1);

    const app = buildApp({}, {
      auth: {
        sessionResolver: () => ({ userId: 'u1', username: 'alice', verified: true }),
        economy: repo,
      },
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;
    const client = await connectClient(url);

    try {
      expect(helloOf(await client.next()).type).toBe('hello');
      client.send({ type: 'join' });
      const welcome = welcomeOf(await client.next());
      expect(welcome.upgrades).toEqual({ mini_cube_value: 2 });
      expect(welcome.economy).toEqual({ coins: 70, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 });
    } finally {
      client.close();
      await app.close();
    }
  });

  it('purchaseUpgrade debits coins and broadcasts economyUpdate + upgradesUpdate', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit('u1', { coins: 100 });

    const app = buildApp({}, {
      auth: {
        sessionResolver: () => ({ userId: 'u1', username: 'alice', verified: true }),
        economy: repo,
      },
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;
    const client = await connectClient(url);

    try {
      expect(helloOf(await client.next()).type).toBe('hello');
      client.send({ type: 'join' });
      const welcome = welcomeOf(await client.next());
      expect(welcome.playerId).toBe('p1');

      client.send({ type: 'purchaseUpgrade', upgradeId: 'mini_cube_value' });
      await flushMicrotasks();

      const update = await client.next();
      expect(update).toEqual({
        type: 'economyUpdate',
        coins: 90,
        clicks: 0,
        facesDestroyed: 0,
        cubesDestroyed: 0,
      });

      const upgrades = await client.next();
      expect(upgrades).toEqual({
        type: 'upgradesUpdate',
        upgrades: { mini_cube_value: 1 },
      });

      expect(await repo.findByUserId('u1')).toEqual({
        coins: 90,
        clicks: 0,
        facesDestroyed: 0,
        cubesDestroyed: 0,
      });
      expect(await repo.findUpgradesByUserId('u1')).toEqual({ mini_cube_value: 1 });
    } finally {
      client.close();
      await app.close();
    }
  });

  it('purchaseUpgrade with insufficient funds sends error and persists nothing', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.credit('u1', { coins: 5 });

    const app = buildApp({}, {
      auth: {
        sessionResolver: () => ({ userId: 'u1', username: 'alice', verified: true }),
        economy: repo,
      },
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;
    const client = await connectClient(url);

    try {
      expect(helloOf(await client.next()).type).toBe('hello');
      client.send({ type: 'join' });
      const welcome = welcomeOf(await client.next());
      expect(welcome.playerId).toBe('p1');

      client.send({ type: 'purchaseUpgrade', upgradeId: 'mini_cube_value' });
      await flushMicrotasks();

      const reply = await client.next();
      expect(reply).toEqual({ type: 'error', code: 'insufficient_funds' });

      const maybeUpdate = await nextOrTimeout(client, 50);
      expect(maybeUpdate).toBeNull();

      expect(await repo.findByUserId('u1')).toEqual({
        coins: 5,
        clicks: 0,
        facesDestroyed: 0,
        cubesDestroyed: 0,
      });
      expect(await repo.findUpgradesByUserId('u1')).toEqual({});
    } finally {
      client.close();
      await app.close();
    }
  });

  it('guest purchase does not persist or broadcast', async () => {
    const repo = new InMemoryEconomyRepository();

    const app = buildApp({}, {
      auth: { economy: repo },
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;
    const client = await connectClient(url);

    try {
      expect(helloOf(await client.next()).type).toBe('hello');
      client.send({ type: 'join' });
      const welcome = welcomeOf(await client.next());
      expect(welcome.playerId).toBe('p1');

      client.send({ type: 'purchaseUpgrade', upgradeId: 'mini_cube_value' });
      await flushMicrotasks();

      const maybeMessage = await nextOrTimeout(client, 50);
      expect(maybeMessage).toBeNull();

      expect(await repo.findByUserId('u1')).toBeNull();
      expect(await repo.findUpgradesByUserId('u1')).toEqual({});
    } finally {
      client.close();
      await app.close();
    }
  });
});

describe('idle accrual integration (T5)', () => {
  it('account join with stale last_seen_at accrues and returns post-accrual totals', async () => {
    let now = 0;
    const nowFn = () => now;
    const repo = new InMemoryEconomyRepository({ now: nowFn });
    await repo.credit('u1', { coins: 5 });
    // Seed a stale last_seen_at at epoch 0 (far in the past).
    await repo.touchLastSeen('u1', 0, null);

    // Advance the shared clock so the gap exceeds the away threshold (capped accrual).
    now = 120_000;

    const app = buildApp({}, {
      now: nowFn,
      auth: {
        sessionResolver: () => ({ userId: 'u1', username: 'alice', verified: true }),
        economy: repo,
      },
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;
    const client = await connectClient(url);

    try {
      expect(helloOf(await client.next()).type).toBe('hello');
      client.send({ type: 'join' });
      await flushMicrotasks();

      // Accrual broadcasts economyUpdate before welcome.
      const update = await client.next();
      const expectedCoins = roundCoins(5 + idleCoins(120_000, {}));
      expect(update).toEqual({
        type: 'economyUpdate',
        coins: expectedCoins,
        clicks: 0,
        facesDestroyed: 0,
        cubesDestroyed: 0,
      });

      const welcome = welcomeOf(await client.next());
      expect(welcome.economy).toEqual({
        coins: expectedCoins,
        clicks: 0,
        facesDestroyed: 0,
        cubesDestroyed: 0,
      });

      expect(await repo.findByUserId('u1')).toEqual({
        coins: expectedCoins,
        clicks: 0,
        facesDestroyed: 0,
        cubesDestroyed: 0,
      });
      expect(await repo.findLastSeenAt('u1')).toBe(120_000);
    } finally {
      client.close();
      await app.close();
    }
  });

  it('account join with stale last_seen_at and upgrades accrues with upgrade multiplier', async () => {
    let now = 0;
    const nowFn = () => now;
    const repo = new InMemoryEconomyRepository({ now: nowFn });
    await repo.credit('u1', { coins: 100 });
    await repo.purchaseUpgrade('u1', 'mini_cube_value', 10, 0);
    await repo.touchLastSeen('u1', 0, null);

    now = 60_000;

    const app = buildApp({}, {
      now: nowFn,
      auth: {
        sessionResolver: () => ({ userId: 'u1', username: 'alice', verified: true }),
        economy: repo,
      },
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;
    const client = await connectClient(url);

    try {
      expect(helloOf(await client.next()).type).toBe('hello');
      client.send({ type: 'join' });
      await flushMicrotasks();

      const update = await client.next();
      const expectedCoins = roundCoins(90 + idleCoins(60_000, { mini_cube_value: 1 }));
      expect(update).toEqual({
        type: 'economyUpdate',
        coins: expectedCoins,
        clicks: 0,
        facesDestroyed: 0,
        cubesDestroyed: 0,
      });

      const welcome = welcomeOf(await client.next());
      expect(welcome.upgrades).toEqual({ mini_cube_value: 1 });
      expect(welcome.economy.coins).toBe(expectedCoins);

      expect(await repo.findLastSeenAt('u1')).toBe(60_000);
    } finally {
      client.close();
      await app.close();
    }
  });

  it('account join with recent last_seen_at does not accrue', async () => {
    const now = 100_000;
    const nowFn = () => now;
    const repo = new InMemoryEconomyRepository({ now: nowFn });
    await repo.credit('u1', { coins: 5 });
    // last_seen_at only 30s ago -> below threshold
    await repo.touchLastSeen('u1', now - 30_000, null);

    const app = buildApp({}, {
      now: nowFn,
      auth: {
        sessionResolver: () => ({ userId: 'u1', username: 'alice', verified: true }),
        economy: repo,
      },
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;
    const client = await connectClient(url);

    try {
      expect(helloOf(await client.next()).type).toBe('hello');
      client.send({ type: 'join' });
      await flushMicrotasks();

      const welcome = welcomeOf(await client.next());
      expect(welcome.economy).toEqual({ coins: 5, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 });

      // No economyUpdate broadcast.
      const maybeUpdate = await nextOrTimeout(client, 50);
      expect(maybeUpdate).toBeNull();

      expect(await repo.findLastSeenAt('u1')).toBe(now);
    } finally {
      client.close();
      await app.close();
    }
  });
});

describe('granular customization integration (T5)', () => {
  it('account open reveals to the opener only, second tabs adopt state, and equip/unequip persist', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 2, keys: 2 });

    const app = buildApp({}, {
      now: () => 0,
      random: () => () => 0,
      auth: {
        sessionResolver: () => ({ userId: 'u1', username: 'alice', verified: true }),
        economy: repo,
      },
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;
    const opener = await connectClient(url);
    const secondTab = await connectClient(url);

    try {
      expect(helloOf(await opener.next()).type).toBe('hello');
      expect(helloOf(await secondTab.next()).type).toBe('hello');

      opener.send({ type: 'join' });
      expect(welcomeOf(await opener.next()).customization).toEqual({
        lootboxes: 2,
        keys: 2,
        parts: {},
        appearance: {},
      });

      secondTab.send({ type: 'join' });
      expect(welcomeOf(await secondTab.next()).customization).toEqual({
        lootboxes: 2,
        keys: 2,
        parts: {},
        appearance: {},
      });
      expect((await opener.next()).type).toBe('memberJoined');

      opener.send({ type: 'openLootbox' });
      const openedUpdate = await opener.next();
      expect(openedUpdate).toEqual({
        type: 'customizationUpdate',
        lootboxes: 1,
        keys: 1,
        parts: { 'hull-obsidian': 1 },
        appearance: {},
      });
      expect(await opener.next()).toEqual({
        type: 'lootboxOpened',
        partId: 'hull-obsidian',
        slot: 'hull',
        rarity: 'rare',
        duplicate: false,
        lootboxes: 1,
        keys: 1,
        parts: { 'hull-obsidian': 1 },
        appearance: {},
      });

      // The second tab receives the absolute state without replaying the reveal.
      expect(await secondTab.next()).toEqual(openedUpdate);
      await expectNoFrame(secondTab);

      // The second tab opens the next box: duplicate feedback goes to that tab only.
      secondTab.send({ type: 'openLootbox' });
      const duplicateUpdate = {
        type: 'customizationUpdate',
        lootboxes: 0,
        keys: 0,
        parts: { 'hull-obsidian': 2 },
        appearance: {},
      };
      expect(await opener.next()).toEqual(duplicateUpdate);
      expect(await secondTab.next()).toEqual(duplicateUpdate);
      expect(await secondTab.next()).toEqual({
        type: 'lootboxOpened',
        partId: 'hull-obsidian',
        slot: 'hull',
        rarity: 'rare',
        duplicate: true,
        lootboxes: 0,
        keys: 0,
        parts: { 'hull-obsidian': 2 },
        appearance: {},
      });
      await expectNoFrame(opener);

      secondTab.send({ type: 'equipPart', partId: 'hull-obsidian' });
      const equipped = {
        type: 'customizationUpdate',
        lootboxes: 0,
        keys: 0,
        parts: { 'hull-obsidian': 2 },
        appearance: { hull: 'hull-obsidian' },
      };
      expect(await opener.next()).toEqual(equipped);
      expect(await secondTab.next()).toEqual(equipped);

      // A later connection adopts the persisted loadout with no reveal.
      const late = await connectClient(url);
      try {
        expect(helloOf(await late.next()).type).toBe('hello');
        late.send({ type: 'join' });
        expect(welcomeOf(await late.next()).customization).toEqual({
          lootboxes: 0,
          keys: 0,
          parts: { 'hull-obsidian': 2 },
          appearance: { hull: 'hull-obsidian' },
        });
        await expectNoFrame(late);
        expect((await opener.next()).type).toBe('memberJoined');
        expect((await secondTab.next()).type).toBe('memberJoined');

        late.send({ type: 'unequipPart', slotId: 'hull' });
        const unequipped = {
          type: 'customizationUpdate',
          lootboxes: 0,
          keys: 0,
          parts: { 'hull-obsidian': 2 },
          appearance: {},
        };
        expect(await late.next()).toEqual(unequipped);
        expect(await opener.next()).toEqual(unequipped);
        expect(await secondTab.next()).toEqual(unequipped);

        late.send({ type: 'unequipPart', slotId: 'wings' });
        expect(await late.next()).toEqual({ type: 'error', code: 'unknown_slot' });
        await expectNoFrame(opener);
        await expectNoFrame(secondTab);
      } finally {
        late.close();
      }

      expect(await repo.findCustomizationByUserId('u1')).toEqual({
        lootboxes: 0,
        keys: 0,
        parts: { 'hull-obsidian': 2 },
        appearance: {},
      });
    } finally {
      opener.close();
      secondTab.close();
      await app.close();
    }
  });

  it('normalizes a legacy customization row on account join (AC-33 fixture)', async () => {
    const repo = new InMemoryEconomyRepository();
    await repo.grantCustomization('u1', { lootboxes: 4, keys: 4 });
    await repo.applyLootboxOpen('u1', 'wings-silver' as PartId);
    await repo.applyLootboxOpen('u1', 'wings-silver' as PartId);
    await repo.applyLootboxOpen('u1', 'engine-blue' as PartId);
    await repo.applyLootboxOpen('u1', 'body-gold' as PartId);
    await repo.setAppearance('u1', {
      wings: 'wings-silver',
      engine: 'engine-blue',
      body: 'body-gold',
    });

    const app = buildApp({}, {
      now: () => 0,
      auth: {
        sessionResolver: () => ({ userId: 'u1', username: 'alice', verified: true }),
        economy: repo,
      },
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const url = `ws://127.0.0.1:${listenPort(app)}/ws`;
    const client = await connectClient(url);

    try {
      expect(helloOf(await client.next()).type).toBe('hello');
      client.send({ type: 'join' });
      expect(welcomeOf(await client.next()).customization).toEqual({
        lootboxes: 0,
        keys: 0,
        parts: {
          'hull-gold': 1,
          'wing-left-silver': 2,
          'wing-right-silver': 2,
          'ignition-left-blue': 1,
          'ignition-right-blue': 1,
        },
        appearance: {
          hull: 'hull-gold',
          'wing-left': 'wing-left-silver',
          'wing-right': 'wing-right-silver',
          'ignition-left': 'ignition-left-blue',
          'ignition-right': 'ignition-right-blue',
        },
      });
    } finally {
      client.close();
      await app.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Observability integration (T3): logging/redaction, /metrics, DB gauges,
// rate-limit drops, request-id correlation and the bounded label catalog.
// ---------------------------------------------------------------------------

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

function parseLogLines(capture: CaptureStream): Array<Record<string, unknown>> {
  return capture.lines().map((line) => JSON.parse(line) as Record<string, unknown>);
}

/** Returns the single log entry matching `predicate`; throws when absent. */
function logEntryWhere(
  capture: CaptureStream,
  predicate: (entry: Record<string, unknown>) => boolean,
  description: string,
): Record<string, unknown> {
  const entry = parseLogLines(capture).find(predicate);
  if (entry === undefined) {
    throw new Error(`missing log entry: ${description}`);
  }
  return entry;
}

function logEntry(capture: CaptureStream, message: string): Record<string, unknown> {
  return logEntryWhere(capture, (entry) => entry['msg'] === message, message);
}

/** Waits (bounded) for a log line the server writes asynchronously on socket close. */
async function waitForLog(
  capture: CaptureStream,
  message: string,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 2000;
  for (;;) {
    const entry = parseLogLines(capture).find((line) => line['msg'] === message);
    if (entry !== undefined) {
      return entry;
    }
    if (Date.now() > deadline) {
      throw new Error(`no ${message} log within 2000ms`);
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 5);
    });
  }
}

/** Extracts the 64-hex session token from a `set-cookie` response header. */
function sessionTokenOf(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers['set-cookie'];
  const setCookie = Array.isArray(raw) ? raw.join('; ') : String(raw ?? '');
  const match = /session=([0-9a-f]{64})/.exec(setCookie);
  if (match === null) {
    throw new Error('expected a session cookie');
  }
  return match[1]!;
}

interface RawClient {
  nextFrame(): Promise<RawFrame>;
  sendText(text: string): void;
  close(): void;
}

/** Encodes one masked client text frame (small control payloads only). */
function encodeClientTextFrame(text: string): Buffer {
  const payload = Buffer.from(text, 'utf8');
  if (payload.length > 125) {
    throw new Error('test client only supports payloads up to 125 bytes');
  }
  const mask = Buffer.from([0x12, 0x34, 0x56, 0x78]);
  const masked = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]!));
  return Buffer.concat([Buffer.from([0x81, 0x80 | payload.length]), mask, masked]);
}

/**
 * Opens a raw WebSocket client with extra request headers (the session cookie) so the
 * account-join path can be exercised end to end without a client dependency.
 */
function connectRawClient(options: {
  host: string;
  port: number;
  headers?: Record<string, string>;
}): Promise<RawClient> {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: options.host,
      port: options.port,
      path: '/ws',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': 'dGhlIHNhbXBsZSBub25jZQ==',
        'Sec-WebSocket-Version': '13',
        ...(options.headers ?? {}),
      },
    });

    request.on('upgrade', (response, socket, head) => {
      let buffer = Buffer.from(head);
      const queued: RawFrame[] = [];
      const waiters: Array<(frame: RawFrame) => void> = [];

      const deliver = (frame: RawFrame): void => {
        const waiter = waiters.shift();
        if (waiter === undefined) {
          queued.push(frame);
        } else {
          waiter(frame);
        }
      };
      const drain = (): void => {
        for (;;) {
          const parsed = parseRawFrame(buffer);
          if (parsed === null) {
            return;
          }
          buffer = parsed.rest;
          deliver(parsed.frame);
        }
      };

      socket.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        drain();
      });
      socket.on('error', reject);

      resolve({
        nextFrame: () =>
          new Promise<RawFrame>((resolveFrame, rejectFrame) => {
            const frame = queued.shift();
            if (frame !== undefined) {
              resolveFrame(frame);
              return;
            }
            const timer = setTimeout(() => {
              rejectFrame(new Error('no WebSocket frame within 2000ms'));
            }, 2000);
            waiters.push((incoming) => {
              clearTimeout(timer);
              resolveFrame(incoming);
            });
          }),
        sendText: (text: string) => {
          socket.write(encodeClientTextFrame(text));
        },
        close: () => {
          socket.end();
        },
      });
      drain();
    });
    request.on('response', (response) => {
      reject(new Error(`expected a WebSocket upgrade, received HTTP ${response.statusCode}`));
    });
    request.on('error', reject);
    request.end();
  });
}

function frameJson(frame: RawFrame): Record<string, unknown> {
  return JSON.parse(frame.payload.toString('utf8')) as Record<string, unknown>;
}

interface ParsedSample {
  name: string;
  labels: Array<[string, string]>;
  value: string;
}

const SAMPLE_PATTERN = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})? (\S+)$/;

function parseSamples(body: string): ParsedSample[] {
  const samples: ParsedSample[] = [];
  for (const line of body.split('\n')) {
    if (line === '' || line.startsWith('#')) {
      continue;
    }
    const match = SAMPLE_PATTERN.exec(line);
    if (match === null) {
      throw new Error(`unparseable metrics line: ${line}`);
    }
    const [, name, rawLabels, value] = match;
    const labels: Array<[string, string]> = [];
    if (rawLabels !== undefined && rawLabels !== '') {
      for (const pair of rawLabels.split(',')) {
        const equals = pair.indexOf('=');
        labels.push([pair.slice(0, equals), pair.slice(equals + 2, -1)]);
      }
    }
    samples.push({ name: name!, labels, value: value! });
  }
  return samples;
}

function baseMetricName(sampleName: string): string {
  for (const suffix of ['_bucket', '_sum', '_count']) {
    if (sampleName.endsWith(suffix)) {
      return sampleName.slice(0, -suffix.length);
    }
  }
  return sampleName;
}

/**
 * Returns every catalog violation in a scraped body: unknown metrics, undeclared or
 * missing labels, and label values outside the allow-list. `le` is accepted only on
 * `_bucket` samples (the renderer-reserved histogram label).
 */
function metricViolations(body: string): string[] {
  const violations: string[] = [];
  for (const sample of parseSamples(body)) {
    const definition = (METRIC_DEFINITIONS as Record<string, MetricDefinition | undefined>)[
      baseMetricName(sample.name)
    ];
    if (definition === undefined) {
      violations.push(`unknown metric ${sample.name}`);
      continue;
    }
    const declared = definition.labels ?? {};
    for (const [labelName, labelValue] of sample.labels) {
      if (labelName === 'le') {
        if (!sample.name.endsWith('_bucket')) {
          violations.push(`reserved le label outside a bucket sample: ${sample.name}`);
        }
        continue;
      }
      const allowed = declared[labelName];
      if (allowed === undefined) {
        violations.push(`undeclared label ${labelName} on ${sample.name}`);
      } else if (!allowed.includes(labelValue)) {
        violations.push(`value ${labelValue} outside the allow-list for ${labelName}`);
      }
    }
    for (const labelName of Object.keys(declared)) {
      if (!sample.labels.some(([name]) => name === labelName)) {
        violations.push(`missing label ${labelName} on ${sample.name}`);
      }
    }
  }
  return violations;
}

interface TestAccount {
  email: string;
  password: string;
  username: string;
  verificationToken: string;
  sessionToken: string;
  accountId: string;
}

/** Registers, logs in and resolves the session for one account through real HTTP. */
async function createAccount(
  app: FastifyInstance,
  emailService: FakeEmailService,
  username: string,
): Promise<TestAccount> {
  const email = `${username}@example.test`;
  const password = `password-for-${username}`;
  const origin = { origin: 'http://localhost:5173' };

  const register = await app.inject({
    method: 'POST',
    url: '/auth/register',
    headers: origin,
    payload: { username, email, password },
  });
  expect(register.statusCode).toBe(202);
  const sent = emailService.sent.at(-1);
  if (sent === undefined) {
    throw new Error('expected a verification email');
  }
  expect(sent.to).toBe(email);
  const verificationToken = new URL(sent.verificationUrl).searchParams.get('token');
  expect(verificationToken).toHaveLength(64);

  // Verify the address so the WS join takes the account path (verified accounts).
  const verify = await app.inject({
    method: 'POST',
    url: '/auth/verify',
    headers: origin,
    payload: { token: verificationToken },
  });
  expect(verify.statusCode).toBe(200);
  expect((verify.json() as { user: { verified: boolean } }).user.verified).toBe(true);

  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: origin,
    payload: { username, password },
  });
  expect(login.statusCode).toBe(200);
  const sessionToken = sessionTokenOf(login);

  const me = await app.inject({
    method: 'GET',
    url: '/auth/me',
    headers: { cookie: `session=${sessionToken}` },
  });
  expect(me.statusCode).toBe(200);
  const accountId = (me.json() as { user: { id: string } }).user.id;
  expect(accountId).toHaveLength(36);

  return {
    email,
    password,
    username,
    verificationToken: verificationToken!,
    sessionToken,
    accountId,
  };
}

describe('observability wiring (T3)', () => {
  it('resolves the logger level from NODE_ENV and stays silent without one (AC-1)', async () => {
    const production = buildApp({ NODE_ENV: 'production' });
    const development = buildApp({ NODE_ENV: 'development' });
    const silent = buildApp({});

    try {
      expect(production.log.level).toBe('info');
      expect(development.log.level).toBe('debug');
      // A disabled Pino logger exposes no level (the noop logger has none).
      const silentLevel: string | undefined = silent.log.level;
      expect(silentLevel).toBe(undefined);
      // Keep the enabled loggers from printing the hub close line during teardown.
      production.log.level = 'silent';
      development.log.level = 'silent';
    } finally {
      await Promise.all([production.close(), development.close(), silent.close()]);
    }
  });

  it('redacts top-level and nested secrets in captured log lines (AC-2, AC-4)', async () => {
    const capture = createCaptureStream();
    const app = buildApp(
      {},
      { logger: buildLoggerOptions({ LOG_LEVEL: 'info' }, capture.stream) },
    );
    await app.ready();

    try {
      app.log.info(
        {
          email: 'alice@example.test',
          password: 'hunter2',
          token: 'tok-1',
          cookie: 'session-secret',
          authorization: 'Bearer secret',
          body: { password: 'nested-pass', email: 'nested@example.test' },
          headers: { cookie: 'nested-cookie', authorization: 'Bearer nested' },
        },
        'redaction-probe',
      );
      app.log.error({ err: new Error('alice@example.test') }, 'error-probe');
      app.log.error(
        { err: Object.assign(new Error('connection reset'), { code: 'ECONNRESET' }) },
        'coded-error-probe',
      );

      const probe = logEntry(capture, 'redaction-probe');
      expect(probe['email']).toBe('[REDACTED]');
      expect(probe['password']).toBe('[REDACTED]');
      expect(probe['token']).toBe('[REDACTED]');
      expect(probe['cookie']).toBe('[REDACTED]');
      expect(probe['authorization']).toBe('[REDACTED]');
      expect(probe['body']).toEqual({ password: '[REDACTED]', email: '[REDACTED]' });
      expect(probe['headers']).toEqual({
        cookie: '[REDACTED]',
        authorization: '[REDACTED]',
      });

      const errorProbe = logEntry(capture, 'error-probe');
      expect(errorProbe['err']).toEqual({ type: 'Error' });
      const codedProbe = logEntry(capture, 'coded-error-probe');
      expect(codedProbe['err']).toEqual({ type: 'Error', code: 'ECONNRESET' });

      for (const secret of [
        'alice@example.test',
        'hunter2',
        'tok-1',
        'session-secret',
        'Bearer secret',
        'nested-pass',
        'nested@example.test',
        'nested-cookie',
        'Bearer nested',
      ]) {
        expect(capture.text()).not.toContain(secret);
      }
      // The error message never reaches the line; only the serialized type/code do.
      expect(capture.text()).not.toContain('connection reset');
    } finally {
      await app.close();
    }
  });

  it('serves Prometheus text on the existing port when METRICS_ENABLED is unset (AC-6, AC-8)', async () => {
    const app = buildApp({});

    try {
      const response = await app.inject({ method: 'GET', url: '/metrics' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/plain; version=0.0.4; charset=utf-8');
      expect(response.headers['cache-control']).toBe('no-store');
      // Sorted catalog: db_pool_idle is the first metric name.
      expect(
        response.body.startsWith(
          '# HELP cubeclicker_db_pool_idle Postgres pool idle connections at scrape.\n',
        ),
      ).toBe(true);
      // The scrape-time collector reported the null pool as zeroes.
      expect(response.body).toContain('cubeclicker_db_pool_total 0');
      expect(response.body).toContain('cubeclicker_db_pool_idle 0');
      expect(response.body).toContain('cubeclicker_db_pool_waiting 0');
      // The hub published the configured capacities at construction.
      expect(response.body).toContain('cubeclicker_ws_connections_capacity 200');
      expect(response.body).toContain('cubeclicker_ws_connections_open 0');
      expect(response.body).toContain('cubeclicker_server_capacity 10');
      expect(response.body).toContain('# TYPE cubeclicker_ws_connections_open gauge');
      expect(response.body.endsWith('\n')).toBe(true);
      expect(response.body.endsWith('\n\n')).toBe(false);
    } finally {
      await app.close();
    }
  });

  it('does not register /metrics when METRICS_ENABLED=false (AC-8)', async () => {
    const app = buildApp({ METRICS_ENABLED: 'false', CORS_ORIGIN: 'https://app.example.test' });

    try {
      const metricsResponse = await app.inject({
        method: 'GET',
        url: '/metrics',
        headers: { origin: 'https://app.example.test' },
      });
      expect(metricsResponse.statusCode).toBe(404);
      expect(metricsResponse.json()).toEqual({
        message: 'Route GET:/metrics not found',
        error: 'Not Found',
        statusCode: 404,
      });
      expect(metricsResponse.headers['access-control-allow-origin']).toBeUndefined();
      expect(metricsResponse.headers['access-control-allow-credentials']).toBeUndefined();

      const health = await app.inject({ method: 'GET', url: '/healthz' });
      expect(health.statusCode).toBe(200);
      expect(health.json()).toEqual({ status: 'ok' });
    } finally {
      await app.close();
    }
  });

  it('serves /metrics locally but never grants it to the frontend origin (AC-8)', async () => {
    const app = buildApp({ CORS_ORIGIN: 'https://app.example.test' });

    try {
      const scrape = await app.inject({
        method: 'GET',
        url: '/metrics',
        headers: { origin: 'https://app.example.test' },
      });
      expect(scrape.statusCode).toBe(200);
      expect(scrape.headers['content-type']).toBe('text/plain; version=0.0.4; charset=utf-8');
      expect(scrape.headers['access-control-allow-origin']).toBeUndefined();
      expect(scrape.headers['access-control-allow-credentials']).toBeUndefined();

      const preflight = await app.inject({
        method: 'OPTIONS',
        url: '/metrics',
        headers: {
          origin: 'https://app.example.test',
          'access-control-request-method': 'GET',
        },
      });
      expect(preflight.statusCode).toBe(404);
      expect(preflight.json()).toEqual({
        message: 'Route OPTIONS:/metrics not found',
        error: 'Not Found',
        statusCode: 404,
      });
      expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
      expect(preflight.headers['access-control-allow-credentials']).toBeUndefined();
      expect(preflight.headers['access-control-allow-methods']).toBeUndefined();
    } finally {
      await app.close();
    }
  });

  it('instruments the runtime pool and samples its gauges on scrape (AC-16)', async () => {
    const queries: unknown[][] = [];
    const pool = {
      totalCount: 4,
      idleCount: 3,
      waitingCount: 1,
      ended: 0,
      query(...args: unknown[]) {
        queries.push(args);
        return Promise.resolve({ rows: [] });
      },
      async end() {
        this.ended += 1;
      },
    };
    const app = buildApp({}, {
      auth: { pool, sessionResolver: () => null },
    });

    try {
      await app.ready();
      await expect(pool.query('select $1', [42])).resolves.toEqual({ rows: [] });
      expect(queries).toEqual([['select $1', [42]]]);

      const scrape = await app.inject({ method: 'GET', url: '/metrics' });
      expect(scrape.statusCode).toBe(200);
      expect(scrape.body).toContain('cubeclicker_db_queries_total{result="ok"} 1');
      expect(scrape.body).toContain('cubeclicker_db_query_duration_seconds_count 1');
      expect(scrape.body).toContain('cubeclicker_db_pool_total 4');
      expect(scrape.body).toContain('cubeclicker_db_pool_idle 3');
      expect(scrape.body).toContain('cubeclicker_db_pool_waiting 1');
    } finally {
      await app.close();
    }
    expect(pool.ended).toBe(1);
  });

  it('counts an HTTP auth rate-limit drop without logging the key (AC-14)', async () => {
    const app = buildApp({});

    try {
      for (let attempt = 0; attempt < 11; attempt += 1) {
        const response = await app.inject({
          method: 'POST',
          url: '/auth/login',
          headers: { origin: 'http://localhost:5173' },
          payload: { username: 'ghost', password: 'password1234' },
        });
        expect(response.statusCode).toBe(attempt < 10 ? 401 : 429);
      }

      const scrape = await app.inject({ method: 'GET', url: '/metrics' });
      expect(scrape.body).toContain('cubeclicker_rate_limit_drops_total{scope="http"} 1');
      // The limiter key (IP) is never a label or a log field.
      expect(scrape.body).not.toContain('127.0.0.1');
    } finally {
      await app.close();
    }
  });

  it('correlates hub lifecycle logs with the Fastify request id (AC-3)', async () => {
    const capture = createCaptureStream();
    const app = buildApp(
      {},
      { logger: buildLoggerOptions({ LOG_LEVEL: 'info' }, capture.stream) },
    );
    await app.listen({ host: '127.0.0.1', port: 0 });
    const port = listenPort(app);
    const url = `ws://127.0.0.1:${port}/ws`;
    const client = await connectClient(url);

    try {
      expect(helloOf(await client.next()).type).toBe('hello');
      client.send({ type: 'join' });
      expect(welcomeOf(await client.next()).playerId).toBe('p1');
      client.close();

      const closed = await waitForLog(capture, 'ws_connection_closed');
      const incoming = logEntry(capture, 'incoming request');
      expect(incoming['reqId']).toBe('req-1');
      expect(incoming['req']).toEqual({
        method: 'GET',
        url: '/ws',
        host: `127.0.0.1:${port}`,
      });

      const opened = logEntry(capture, 'ws_connection_opened');
      expect(opened['level']).toBe(30);
      expect(opened['connectionId']).toBe(incoming['reqId']);
      expect(closed['connectionId']).toBe('req-1');
      expect(closed['reason']).toBe('client');
      expect(closed['wasJoined']).toBe(true);
      expect(closed['durationMs']).toBeGreaterThanOrEqual(0);
      for (const entry of [opened, closed]) {
        for (const forbidden of ['playerId', 'accountId', 'username', 'email', 'remoteAddress']) {
          expect(forbidden in entry).toBe(false);
        }
      }

      const scrape = await app.inject({ method: 'GET', url: '/metrics' });
      expect(scrape.body).toContain('cubeclicker_ws_connections_total 1');
      expect(scrape.body).toContain('cubeclicker_ws_connections_open 0');
      expect(scrape.body).toContain('cubeclicker_ws_connections_closed_total{reason="client"} 1');
      expect(scrape.body).toContain('cubeclicker_ws_messages_encoded_total{type="hello"} 1');
      expect(scrape.body).toContain('cubeclicker_ws_frames_sent_total{type="hello"} 1');
    } finally {
      client.close();
      await app.close();
    }
  });

  it('logs no PII across a real login, /auth/me and a session-cookie WS join (AC-2, AC-5)', async () => {
    const capture = createCaptureStream();
    const emailService = new FakeEmailService();
    const app = buildApp({}, {
      logger: buildLoggerOptions({ LOG_LEVEL: 'info' }, capture.stream),
      auth: { email: emailService },
    });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const port = listenPort(app);

    try {
      const account = await createAccount(app, emailService, 'alice-observability');

      // The raw client's Host header is `localhost` so the logged `req.host` cannot be
      // confused with the socket remote address (AC-5).
      const client = await connectRawClient({
        host: '127.0.0.1',
        port,
        headers: {
          Host: `localhost:${port}`,
          Cookie: `session=${account.sessionToken}`,
        },
      });
      try {
        const hello = frameJson(await client.nextFrame());
        expect(hello['type']).toBe('hello');
        expect(isIsoDate(hello['serverTime'])).toBe(true);

        client.sendText(JSON.stringify({ type: 'join' }));
        const welcome = frameJson(await client.nextFrame());
        expect(welcome['type']).toBe('welcome');
        expect(welcome['playerId']).toBe('p1');
        expect(welcome['name']).toBe('alice-observability');
        expect(welcome['serverId']).toBe(1);

        client.close();
        const closed = await waitForLog(capture, 'ws_connection_closed');
        expect(closed['wasJoined']).toBe(true);
      } finally {
        client.close();
      }

      // The login request logs method/path/host only: no body, headers or query.
      const loginRequest = logEntryWhere(
        capture,
        (entry) =>
          entry['msg'] === 'incoming request' &&
          (entry['req'] as { url?: string }).url === '/auth/login',
        'login request',
      );
      expect(loginRequest['req']).toEqual({
        method: 'POST',
        url: '/auth/login',
        host: 'localhost:80',
      });
      expect(Object.keys(loginRequest['req'] as object)).toEqual(['method', 'url', 'host']);
      const loginCompleted = logEntryWhere(
        capture,
        (entry) =>
          entry['msg'] === 'request completed' && entry['reqId'] === loginRequest['reqId'],
        'login completion',
      );
      expect(loginCompleted['res']).toEqual({ statusCode: 200 });

      // Exclude only Fastify's own startup line ("Server listening at http://127.0.0.1:…"):
      // it carries the local bind address, never a client value. Every request and WS
      // lifecycle line stays in scope for the PII check.
      const piiText = capture
        .lines()
        .filter((line) => !line.includes('"msg":"Server listening at '))
        .join('\n');
      for (const secret of [
        account.email,
        account.password,
        account.username,
        account.sessionToken,
        account.verificationToken,
        account.accountId,
        'p1',
        '127.0.0.1',
      ]) {
        expect(piiText).not.toContain(secret);
      }
    } finally {
      await app.close();
    }
  });

  it('scrapes two account joins with only allow-listed labels and no PII (AC-7, AC-18)', async () => {
    const emailService = new FakeEmailService();
    const app = buildApp({}, { auth: { email: emailService } });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const port = listenPort(app);

    try {
      const alice = await createAccount(app, emailService, 'alice');
      const bob = await createAccount(app, emailService, 'bob');
      const aliceClient = await connectRawClient({
        host: '127.0.0.1',
        port,
        headers: { Cookie: `session=${alice.sessionToken}` },
      });
      const bobClient = await connectRawClient({
        host: '127.0.0.1',
        port,
        headers: { Cookie: `session=${bob.sessionToken}` },
      });

      try {
        expect(frameJson(await aliceClient.nextFrame())['type']).toBe('hello');
        aliceClient.sendText(JSON.stringify({ type: 'join' }));
        const aliceWelcome = frameJson(await aliceClient.nextFrame());
        expect(aliceWelcome['type']).toBe('welcome');
        expect(aliceWelcome['playerId']).toBe('p1');
        expect(aliceWelcome['name']).toBe('alice');

        expect(frameJson(await bobClient.nextFrame())['type']).toBe('hello');
        bobClient.sendText(JSON.stringify({ type: 'join' }));
        const bobWelcome = frameJson(await bobClient.nextFrame());
        expect(bobWelcome['type']).toBe('welcome');
        expect(bobWelcome['playerId']).toBe('p2');
        expect(bobWelcome['name']).toBe('bob');
        expect(bobWelcome['serverId']).toBe(1);

        const scrape = await app.inject({ method: 'GET', url: '/metrics' });
        expect(scrape.statusCode).toBe(200);
        expect(scrape.body).toContain('cubeclicker_ws_connections_total 2');
        expect(scrape.body).toContain('cubeclicker_ws_connections_open 2');
        expect(scrape.body).toContain('cubeclicker_servers_active 1');
        expect(scrape.body).toContain('cubeclicker_members_active 2');
        expect(scrape.body).toContain('cubeclicker_ws_messages_received_total{type="join"} 2');
        expect(scrape.body).toContain('cubeclicker_ws_messages_encoded_total{type="welcome"} 2');
        expect(scrape.body).toContain('cubeclicker_ws_frames_sent_total{type="hello"} 2');
        expect(metricViolations(scrape.body)).toEqual([]);

        for (const secret of [
          alice.email,
          bob.email,
          alice.username,
          bob.username,
          alice.password,
          bob.password,
          alice.sessionToken,
          bob.sessionToken,
          alice.verificationToken,
          bob.verificationToken,
          alice.accountId,
          bob.accountId,
          'p1',
          'p2',
          '127.0.0.1',
        ]) {
          expect(scrape.body).not.toContain(secret);
        }
      } finally {
        aliceClient.close();
        bobClient.close();
      }
    } finally {
      await app.close();
    }
  });
});
