import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ServerMessage } from './protocol';
import {
  createTransport,
  type Transport,
  type TransportOptions,
  type TransportStatus,
} from './transport';

/**
 * Stand-in for the browser WebSocket surface the retry connection and the transport use:
 * the four event handler properties, `send()` and `close()`.
 */
class FakeSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;

  readonly sent: string[] = [];
  closeCalls = 0;

  constructor(readonly url: string) {}

  send(text: string): void {
    this.sent.push(text);
  }

  close(): void {
    this.closeCalls += 1;
  }

  /** Simulates a successful upgrade. */
  emitOpen(): void {
    this.onopen?.();
  }

  /** Simulates a transport failure: the browser fires `error`, then `close`. */
  emitFailure(): void {
    this.onerror?.();
    this.onclose?.();
  }

  /** Delivers one raw frame (a string, or any non-text payload for the drop cases). */
  emitMessage(data: unknown): void {
    this.onmessage?.({ data });
  }
}

interface Harness {
  sockets: FakeSocket[];
  statuses: TransportStatus[];
  messages: ServerMessage[];
  transport: Transport;
}

function harness(overrides: Partial<TransportOptions> = {}): Harness {
  const sockets: FakeSocket[] = [];
  const statuses: TransportStatus[] = [];
  const messages: ServerMessage[] = [];
  const transport = createTransport({
    url: 'ws://test.local/ws',
    maxAttempts: 2,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    socketFactory: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    ...overrides,
  });
  transport.onMessage((message) => messages.push(message));
  transport.onStatus((status) => statuses.push(status));
  return { sockets, statuses, messages, transport };
}

/** The socket of the current (latest) connection attempt. */
function current(h: Harness): FakeSocket {
  return h.sockets[h.sockets.length - 1]!;
}

const SERVER_TIME = '2026-10-22T09:00:00.000Z';
const HELLO: ServerMessage = { type: 'hello', serverTime: SERVER_TIME };
const HELLO_TEXT = '{"type":"hello","serverTime":"2026-10-22T09:00:00.000Z"}';

const TOKEN_1 = '4f1c2b3a9d8e7f607152635465778899';
const TOKEN_2 = '00112233445566778899aabbccddeeff';

const SLOT_1 = { x: 38.197186342054884, y: 0 };

/** One member row as the backend emits it (only the transport-relevant shape matters). */
const MEMBER_1 = {
  playerId: 'p1',
  name: 'Player 1',
  position: SLOT_1,
  levelIndex: 0,
  gridSize: 3,
  styleId: 'obsidian-neon',
  removedIds: [],
  yawSteps: 0,
  pitchSteps: 0,
};

/** A full placement frame; `welcome` is the token's only issuer (AC-22). */
function welcome(playerId: string, token: string): ServerMessage {
  return {
    type: 'welcome',
    playerId,
    name: `Player ${playerId.slice(1)}`,
    token,
    serverId: 1,
    maxUsers: 10,
    position: SLOT_1,
    self: { levelIndex: 0, gridSize: 3, styleId: 'obsidian-neon', removedIds: [], yawSteps: 0, pitchSteps: 0 },
    roster: [MEMBER_1],
    identity: { kind: 'guest', playerId },
  };
}

const WELCOME_1 = welcome('p1', TOKEN_1);
const WELCOME_2 = welcome('p2', TOKEN_2);

/**
 * A storage surface that records every property access. The transport must never touch it:
 * the session token lives in memory only (spec AC-6 / Q-3).
 */
function storageTrap(): { value: Record<string, unknown>; touches: string[] } {
  const touches: string[] = [];
  const value = new Proxy(
    {},
    {
      get(_target, property) {
        touches.push(`get:${String(property)}`);
        return () => undefined;
      },
      set(_target, property) {
        touches.push(`set:${String(property)}`);
        return true;
      },
    },
  );
  return { value, touches };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('createTransport — connection, status and send (unit)', () => {
  it('connects to the configured url and sends only while a socket is open', () => {
    const h = harness();
    h.transport.connect();

    expect(h.statuses).toEqual(['connecting']);
    expect(h.sockets).toHaveLength(1);
    expect(current(h).url).toBe('ws://test.local/ws');

    h.transport.send({ type: 'join' });
    expect(current(h).sent).toEqual([]);

    current(h).emitOpen();
    expect(h.statuses).toEqual(['connecting', 'connected']);

    h.transport.send({ type: 'explode', id: 'front:0:0', level: 2 });
    expect(current(h).sent).toEqual(['{"type":"explode","id":"front:0:0","level":2}']);

    current(h).emitFailure();
    h.transport.send({ type: 'join' });
    expect(current(h).sent).toEqual(['{"type":"explode","id":"front:0:0","level":2}']);

    h.transport.close();
  });

  it('connect() is idempotent while a connection is live', () => {
    const h = harness();
    h.transport.connect();
    h.transport.connect();

    expect(h.sockets).toHaveLength(1);

    h.transport.close();
    h.transport.close(); // idempotent teardown: no second close, no status change
    expect(current(h).closeCalls).toBe(1);
    expect(h.statuses).toEqual(['connecting']);
  });

  it('close() detaches the live socket and ignores late events', () => {
    const h = harness();
    h.transport.connect();
    const socket = current(h);
    socket.emitOpen();

    h.transport.close();

    expect(socket.closeCalls).toBe(1);
    expect(socket.onopen).toBeNull();
    expect(socket.onclose).toBeNull();
    expect(socket.onerror).toBeNull();
    expect(socket.onmessage).toBeNull();

    socket.emitOpen();
    socket.emitMessage(HELLO_TEXT);
    expect(h.statuses).toEqual(['connecting', 'connected']);
    expect(h.messages).toEqual([]);
  });

  it('replays the current status to a late subscriber and stops after unsubscribe', () => {
    const h = harness();
    h.transport.connect();

    const late: TransportStatus[] = [];
    const unsubscribe = h.transport.onStatus((status) => late.push(status));
    expect(late).toEqual(['connecting']);

    current(h).emitOpen();
    expect(late).toEqual(['connecting', 'connected']);

    unsubscribe();
    current(h).emitFailure();
    expect(late).toEqual(['connecting', 'connected']);

    h.transport.close();
  });

  it('stops message delivery after the subscriber unsubscribes', () => {
    const h = harness();
    h.transport.connect();
    const socket = current(h);
    socket.emitOpen();

    const received: ServerMessage[] = [];
    const unsubscribe = h.transport.onMessage((message) => received.push(message));
    socket.emitMessage(HELLO_TEXT);
    expect(received).toEqual([HELLO]);

    unsubscribe();
    socket.emitMessage(JSON.stringify(WELCOME_1));
    expect(received).toEqual([HELLO]);

    h.transport.close();
  });

  it('maps retry exhaustion to `exhausted` and restarts on close() + connect()', () => {
    const h = harness({ maxAttempts: 2, baseDelayMs: 100, maxDelayMs: 1000 });
    h.transport.connect();

    current(h).emitFailure(); // attempt 1 fails → retry in 100 ms
    vi.advanceTimersByTime(100);
    expect(h.sockets).toHaveLength(2);

    current(h).emitFailure(); // attempt 2 fails → retry in 200 ms
    vi.advanceTimersByTime(200);
    expect(h.sockets).toHaveLength(3);

    current(h).emitFailure(); // attempt 3 > 2 → the connection stays down
    expect(h.statuses).toEqual([
      'connecting',
      'disconnected',
      'connecting',
      'disconnected',
      'connecting',
      'exhausted',
    ]);

    vi.advanceTimersByTime(60_000);
    expect(h.sockets).toHaveLength(3);

    // The pinned `Retry` path: teardown, then a fresh connection cycle.
    h.transport.close();
    h.transport.connect();
    expect(h.sockets).toHaveLength(4);
    expect(current(h).url).toBe('ws://test.local/ws');

    current(h).emitOpen();
    expect(h.statuses).toEqual([
      'connecting',
      'disconnected',
      'connecting',
      'disconnected',
      'connecting',
      'exhausted',
      'connecting',
      'connected',
    ]);

    h.transport.close();
  });

  it('drops malformed and non-text frames without throwing', () => {
    const h = harness();
    h.transport.connect();
    const socket = current(h);
    socket.emitOpen();

    socket.emitMessage('not json');
    socket.emitMessage('{"type":"tick"}');
    socket.emitMessage('[{"type":"hello"}]');
    socket.emitMessage(42);
    socket.emitMessage({ type: 'hello', serverTime: SERVER_TIME });

    expect(h.messages).toEqual([]);
    expect(socket.sent).toEqual([]);

    socket.emitMessage(HELLO_TEXT);
    expect(h.messages).toEqual([HELLO]);
    expect(socket.sent).toEqual([]);

    h.transport.close();
  });

  it('ignores frames that escape a socket replaced by a retry', () => {
    const h = harness({ maxAttempts: 2, baseDelayMs: 100, maxDelayMs: 1000 });
    h.transport.connect();
    const first = current(h);
    first.emitOpen();
    first.emitFailure();

    vi.advanceTimersByTime(100);
    const second = current(h);
    second.emitOpen();

    first.emitMessage(HELLO_TEXT);
    expect(first.sent).toEqual([]);
    expect(h.messages).toEqual([]);

    second.emitMessage(HELLO_TEXT);
    expect(second.sent).toEqual([]);
    expect(h.messages).toEqual([HELLO]);

    h.transport.close();
  });

  it('uses the ambient WebSocket global and resolves VITE_WS_URL with the pinned default', () => {
    class RecordingGlobalSocket {
      static opened: string[] = [];

      onopen: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((event: { data: unknown }) => void) | null = null;

      constructor(readonly url: string) {
        RecordingGlobalSocket.opened.push(url);
      }

      send(): void {}

      close(): void {}
    }

    RecordingGlobalSocket.opened = [];
    vi.stubGlobal('WebSocket', RecordingGlobalSocket);

    vi.stubEnv('VITE_WS_URL', undefined);
    const defaulted = createTransport();
    defaulted.connect();
    defaulted.close();

    vi.stubEnv('VITE_WS_URL', 'wss://mp.example.test/ws');
    const configured = createTransport();
    configured.connect();
    configured.close();

    vi.stubEnv('VITE_WS_URL', '');
    const blank = createTransport();
    blank.connect();
    blank.close();

    expect(RecordingGlobalSocket.opened).toEqual([
      'ws://localhost:8080/ws',
      'wss://mp.example.test/ws',
      'ws://localhost:8080/ws',
    ]);
  });

  it('leaves no live socket when a status subscriber closes during the first connect', () => {
    const sockets: FakeSocket[] = [];
    const statuses: TransportStatus[] = [];
    const transport = createTransport({
      url: 'ws://test.local/ws',
      socketFactory: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });
    transport.onStatus((status) => {
      statuses.push(status);
      if (status === 'connecting') {
        transport.close();
      }
    });

    transport.connect();

    expect(statuses).toEqual(['connecting']);
    expect(sockets).toHaveLength(1);
    expect(sockets[0]!.closeCalls).toBe(1);

    sockets[0]!.emitOpen();
    transport.send({ type: 'join' });
    expect(statuses).toEqual(['connecting']);
    expect(sockets[0]!.sent).toEqual([]);
  });

  it('rejoins with a seeded token on the first hello', () => {
    const h = harness({ token: TOKEN_1 });
    h.transport.connect();
    current(h).emitOpen();

    current(h).emitMessage(HELLO_TEXT);

    expect(current(h).sent).toEqual([`{"type":"rejoin","token":"${TOKEN_1}"}`]);
    h.transport.close();
  });
});

describe('createTransport — join/resume over the retry connection (integration)', () => {
  it('joins, keeps the token in memory and rejoins after the socket drops (AC-22)', () => {
    const local = storageTrap();
    const session = storageTrap();
    vi.stubGlobal('localStorage', local.value);
    vi.stubGlobal('sessionStorage', session.value);

    const h = harness({ maxAttempts: 1, baseDelayMs: 100, maxDelayMs: 1000 });
    h.transport.connect();
    const first = current(h);
    first.emitOpen();
    first.emitMessage(HELLO_TEXT);
    expect(first.sent).toEqual([]);
    h.transport.join('guest');
    expect(first.sent).toEqual(['{"type":"join","mode":"guest"}']);

    first.emitMessage(JSON.stringify(WELCOME_1));
    expect(h.messages).toEqual([HELLO, WELCOME_1]);

    first.emitFailure();
    expect(h.statuses).toEqual(['connecting', 'connected', 'disconnected']);

    vi.advanceTimersByTime(100);
    const second = current(h);
    expect(h.sockets).toHaveLength(2);
    second.emitOpen();
    second.emitMessage(HELLO_TEXT);

    expect(second.sent).toEqual([`{"type":"rejoin","token":"${TOKEN_1}"}`]);
    expect(first.sent).toEqual(['{"type":"join","mode":"guest"}']);

    second.emitMessage(JSON.stringify(WELCOME_1));
    expect(h.messages).toEqual([HELLO, WELCOME_1, HELLO, WELCOME_1]);

    // Memory-only token: the whole join → welcome → drop → rejoin cycle touched no storage.
    expect([...local.touches, ...session.touches]).toEqual([]);

    h.transport.close();
  });

  it('falls back to a fresh join after resume_failed and rejoins with the next token', () => {
    const h = harness({ maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000 });
    h.transport.connect();
    const first = current(h);
    first.emitOpen();
    first.emitMessage(HELLO_TEXT);
    first.emitMessage(JSON.stringify(WELCOME_1));

    first.emitFailure();
    vi.advanceTimersByTime(100);
    const second = current(h);
    second.emitOpen();
    second.emitMessage(HELLO_TEXT);
    expect(second.sent).toEqual([`{"type":"rejoin","token":"${TOKEN_1}"}`]);

    second.emitMessage('{"type":"error","code":"resume_failed"}');
    expect(second.sent).toEqual([
      `{"type":"rejoin","token":"${TOKEN_1}"}`,
      '{"type":"join"}',
    ]);

    // No welcome arrived: the dead token must not be retried on the next connection.
    second.emitFailure();
    vi.advanceTimersByTime(100);
    const third = current(h);
    third.emitOpen();
    third.emitMessage(HELLO_TEXT);
    expect(third.sent).toEqual([]);

    third.emitMessage(JSON.stringify(WELCOME_2));
    third.emitFailure();
    vi.advanceTimersByTime(100);
    const fourth = current(h);
    fourth.emitOpen();
    fourth.emitMessage(HELLO_TEXT);
    expect(fourth.sent).toEqual([`{"type":"rejoin","token":"${TOKEN_2}"}`]);

    h.transport.close();
  });

  it('answers each socket hello once and forwards catalog frames untouched', () => {
    const h = harness();
    h.transport.connect();
    const socket = current(h);
    socket.emitOpen();

    socket.emitMessage(HELLO_TEXT);
    socket.emitMessage(HELLO_TEXT);
    expect(socket.sent).toEqual([]);

    socket.emitMessage('{"type":"error","code":"invalid_click"}');
    socket.emitMessage('{"type":"miniCubeRemoved","playerId":"p2","id":"back:1:1"}');

    expect(socket.sent).toEqual([]);
    expect(h.messages).toEqual([
      HELLO,
      HELLO,
      { type: 'error', code: 'invalid_click' },
      { type: 'miniCubeRemoved', playerId: 'p2', id: 'back:1:1' },
    ]);

    h.transport.close();
  });
});
