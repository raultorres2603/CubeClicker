import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createConnection, type ConnectionStatus } from './connection';

/**
 * Minimal stand-in for the browser WebSocket surface the connection module uses:
 * the three event handler properties and `close()`.
 */
class FakeSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closeCalls = 0;

  constructor(readonly url: string) {}

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
}

interface Harness {
  sockets: FakeSocket[];
  statuses: ConnectionStatus[];
  connection: { close(): void };
}

function harness(options: {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}): Harness {
  const sockets: FakeSocket[] = [];
  const statuses: ConnectionStatus[] = [];
  const connection = createConnection({
    url: 'ws://localhost:8080/ws',
    socketFactory: (url) => {
      const socket = new FakeSocket(url);
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    onStatus: (status) => statuses.push(status),
    ...options,
  });
  return { sockets, statuses, connection };
}

/** Current socket (the last one the factory produced). */
function current(h: Harness): FakeSocket {
  return h.sockets[h.sockets.length - 1]!;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createConnection', () => {
  it('starts in `connecting` and reports `connected` on open', () => {
    const h = harness({});
    expect(h.statuses).toEqual(['connecting']);
    expect(h.sockets).toHaveLength(1);

    current(h).emitOpen();

    expect(h.statuses).toEqual(['connecting', 'connected']);
    expect(current(h).url).toBe('ws://localhost:8080/ws');

    h.connection.close();
  });

  it('reports `disconnected` when the socket drops and retries once per attempt', () => {
    const h = harness({ maxAttempts: 1, baseDelayMs: 100, maxDelayMs: 1000 });
    current(h).emitOpen();
    current(h).emitFailure();

    expect(h.statuses).toEqual(['connecting', 'connected', 'disconnected']);

    // Backoff: the first retry waits exactly baseDelayMs.
    vi.advanceTimersByTime(99);
    expect(h.sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(h.sockets).toHaveLength(2);
    expect(h.statuses).toEqual(['connecting', 'connected', 'disconnected', 'connecting']);

    h.connection.close();
  });

  it('consumes exactly one attempt per dropped socket (error + close dedupe)', () => {
    const h = harness({ maxAttempts: 1, baseDelayMs: 100, maxDelayMs: 1000 });
    const first = current(h);
    first.emitFailure(); // fires onerror and onclose
    first.onclose?.(); // a late duplicate close must be a no-op

    vi.advanceTimersByTime(100);
    expect(h.sockets).toHaveLength(2);

    h.connection.close();
  });

  it('stops retrying once the attempt cap is reached', () => {
    const h = harness({ maxAttempts: 2, baseDelayMs: 100, maxDelayMs: 1000 });

    current(h).emitFailure(); // attempt 1 → retry in 100ms
    vi.advanceTimersByTime(100);
    expect(h.sockets).toHaveLength(2);

    current(h).emitFailure(); // attempt 2 → retry in 200ms
    vi.advanceTimersByTime(200);
    expect(h.sockets).toHaveLength(3);

    current(h).emitFailure(); // attempt 3 > maxAttempts → stop

    vi.advanceTimersByTime(60_000);
    expect(h.sockets).toHaveLength(3);
    expect(h.statuses).toEqual([
      'connecting',
      'disconnected',
      'connecting',
      'disconnected',
      'connecting',
      'disconnected',
    ]);

    h.connection.close();
  });

  it('caps the backoff delay at maxDelayMs', () => {
    const h = harness({ maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 1500 });

    current(h).emitFailure(); // attempt 1 → 1000ms
    vi.advanceTimersByTime(999);
    expect(h.sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(h.sockets).toHaveLength(2);

    current(h).emitFailure(); // attempt 2 → min(2000, 1500) = 1500ms
    vi.advanceTimersByTime(1499);
    expect(h.sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(h.sockets).toHaveLength(3);

    h.connection.close();
  });

  it('resets the retry counter after a successful open', () => {
    const h = harness({ maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 5000 });

    current(h).emitFailure(); // attempt 1 → 100ms
    vi.advanceTimersByTime(100);
    expect(h.sockets).toHaveLength(2);

    current(h).emitOpen(); // success resets the counter
    current(h).emitFailure(); // attempt 1 again → 100ms (not 200ms)
    vi.advanceTimersByTime(99);
    expect(h.sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(h.sockets).toHaveLength(3);

    h.connection.close();
  });

  it('close() cancels a pending retry and prevents further status changes', () => {
    const h = harness({ maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 1000 });
    const first = current(h);
    first.emitFailure();
    expect(h.statuses).toEqual(['connecting', 'disconnected']);

    h.connection.close();

    vi.advanceTimersByTime(60_000);
    expect(h.sockets).toHaveLength(1);
    expect(h.statuses).toEqual(['connecting', 'disconnected']);
  });

  it('close() closes the live socket and is idempotent', () => {
    const h = harness({});
    const first = current(h);

    h.connection.close();
    h.connection.close();

    expect(first.closeCalls).toBe(1);
    expect(first.onopen).toBeNull();
    expect(first.onclose).toBeNull();
    expect(first.onerror).toBeNull();
  });

  it('ignores a drop that arrives after close()', () => {
    const h = harness({ maxAttempts: 5, baseDelayMs: 100, maxDelayMs: 1000 });
    const first = current(h);
    const lateOpen = first.onopen;

    h.connection.close();
    lateOpen?.();
    first.onerror?.();
    vi.advanceTimersByTime(1000);

    expect(h.sockets).toHaveLength(1);
    expect(h.statuses).toEqual(['connecting']);
  });
});
