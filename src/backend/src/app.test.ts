import { describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, helloMessage } from './app.js';

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
});
