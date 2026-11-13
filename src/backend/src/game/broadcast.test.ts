import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createEconomyCoalescer,
  createRemovalBatcher,
  type EconomyCoalescer,
  type RemovalBatcher,
  type RemovalGroup,
  type TimerFns,
} from './broadcast.js';
import type { EconomyState } from './protocol.js';

/** The fake functions installed by `vi.useFakeTimers()` for the current test. */
function fakeTimers(): TimerFns {
  return { setTimeout, clearTimeout };
}

/** A concrete absolute economy fixture: every field scales with `coins` (no deltas). */
function economy(coins: number): EconomyState {
  return {
    coins,
    clicks: coins * 10,
    facesDestroyed: coins * 2,
    cubesDestroyed: coins * 3,
  };
}

interface RemovalHarness {
  batcher: RemovalBatcher;
  flushes: RemovalGroup[][];
}

function createRemovalHarness(windowMs = 40, timers: TimerFns = fakeTimers()): RemovalHarness {
  const flushes: RemovalGroup[][] = [];
  const batcher = createRemovalBatcher({
    windowMs,
    timers,
    flush: (groups) => {
      flushes.push(
        groups.map((group) => ({
          serverId: group.serverId,
          playerId: group.playerId,
          ids: [...group.ids],
        })),
      );
    },
  });
  return { batcher, flushes };
}

interface EconomyFlush {
  userId: string;
  revision: number;
  economy: EconomyState;
}

interface EconomyHarness {
  coalescer: EconomyCoalescer;
  flushes: EconomyFlush[];
}

function createEconomyHarness(
  intervalMs = 250,
  timers: TimerFns = fakeTimers(),
): EconomyHarness {
  const flushes: EconomyFlush[] = [];
  const coalescer = createEconomyCoalescer({
    intervalMs,
    timers,
    flush: (userId, revision, state) => {
      flushes.push({ userId, revision, economy: state });
    },
  });
  return { coalescer, flushes };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createRemovalBatcher', () => {
  it('buffers one player’s ids in acceptance order and flushes once at the window boundary', () => {
    const { batcher, flushes } = createRemovalHarness();

    batcher.enqueue(3, 'p1', 'front:0:0');
    batcher.enqueue(3, 'p1', 'front:0:1');
    expect(batcher.pendingGroups()).toBe(1);

    vi.advanceTimersByTime(39);
    expect(flushes).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(flushes).toEqual([
      [{ serverId: 3, playerId: 'p1', ids: ['front:0:0', 'front:0:1'] }],
    ]);
    expect(batcher.pendingGroups()).toBe(0);

    // The one-shot window does not fire again.
    vi.advanceTimersByTime(1000);
    expect(flushes).toHaveLength(1);
  });

  it('keeps one group per player in first-enqueue order and pins the server of the first enqueue', () => {
    const { batcher, flushes } = createRemovalHarness();

    batcher.enqueue(2, 'p2', 'front:0:0');
    batcher.enqueue(2, 'p1', 'back:1:1');
    batcher.enqueue(2, 'p2', 'front:0:1');
    // A later enqueue for the same player keeps the first recorded server.
    batcher.enqueue(9, 'p2', 'top:2:2');

    vi.advanceTimersByTime(40);
    expect(flushes).toEqual([
      [
        { serverId: 2, playerId: 'p2', ids: ['front:0:0', 'front:0:1', 'top:2:2'] },
        { serverId: 2, playerId: 'p1', ids: ['back:1:1'] },
      ],
    ]);
    expect(batcher.pendingGroups()).toBe(0);
  });

  it('flush() emits pending groups synchronously and cancels the window', () => {
    const { batcher, flushes } = createRemovalHarness();

    batcher.enqueue(1, 'p1', 'front:0:0');
    batcher.flush();

    expect(flushes).toEqual([[{ serverId: 1, playerId: 'p1', ids: ['front:0:0'] }]]);
    expect(batcher.pendingGroups()).toBe(0);

    vi.advanceTimersByTime(40);
    expect(flushes).toHaveLength(1);
  });

  it('does not invoke the callback when flush() has nothing pending', () => {
    const { batcher, flushes } = createRemovalHarness();

    batcher.flush();
    vi.advanceTimersByTime(1000);

    expect(flushes).toEqual([]);
    expect(batcher.pendingGroups()).toBe(0);
  });

  it('starts a fresh window after a flush, including an enqueue from the flush callback', () => {
    const flushes: RemovalGroup[][] = [];
    let reentered = false;
    const batcher = createRemovalBatcher({
      windowMs: 40,
      timers: fakeTimers(),
      flush: (groups) => {
        flushes.push(groups.map((group) => ({ ...group, ids: [...group.ids] })));
        if (!reentered) {
          reentered = true;
          batcher.enqueue(1, 'p1', 'back:0:0');
        }
      },
    });

    batcher.enqueue(1, 'p1', 'front:0:0');
    vi.advanceTimersByTime(40);
    expect(flushes).toEqual([[{ serverId: 1, playerId: 'p1', ids: ['front:0:0'] }]]);

    vi.advanceTimersByTime(39);
    expect(flushes).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(flushes).toEqual([
      [{ serverId: 1, playerId: 'p1', ids: ['front:0:0'] }],
      [{ serverId: 1, playerId: 'p1', ids: ['back:0:0'] }],
    ]);
  });

  it('discard() clears the timer and makes later enqueue/flush inert', () => {
    const { batcher, flushes } = createRemovalHarness();

    batcher.enqueue(1, 'p1', 'front:0:0');
    batcher.discard();
    expect(batcher.pendingGroups()).toBe(0);

    vi.advanceTimersByTime(1000);
    expect(flushes).toEqual([]);

    batcher.enqueue(1, 'p1', 'front:0:1');
    expect(batcher.pendingGroups()).toBe(0);
    batcher.flush();
    vi.advanceTimersByTime(1000);
    expect(flushes).toEqual([]);
  });

  it('schedules exactly one injected timer with the configured window and clears it on flush', () => {
    const setTimeoutSpy = vi.fn((callback: () => void, delay?: number) =>
      setTimeout(callback, delay),
    );
    const clearTimeoutSpy = vi.fn((handle: ReturnType<typeof setTimeout>) => {
      clearTimeout(handle);
    });
    const { batcher, flushes } = createRemovalHarness(40, {
      setTimeout: setTimeoutSpy as unknown as typeof setTimeout,
      clearTimeout: clearTimeoutSpy as unknown as typeof clearTimeout,
    });

    batcher.enqueue(1, 'p1', 'front:0:0');
    batcher.enqueue(1, 'p1', 'front:0:1');
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(typeof setTimeoutSpy.mock.calls[0]![0]).toBe('function');
    expect(setTimeoutSpy.mock.calls[0]![1]).toBe(40);

    batcher.flush();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(flushes).toEqual([
      [{ serverId: 1, playerId: 'p1', ids: ['front:0:0', 'front:0:1'] }],
    ]);
  });
});

describe('createEconomyCoalescer', () => {
  it('flushes only the highest revision, once per interval', () => {
    const { coalescer, flushes } = createEconomyHarness();

    coalescer.queue('acct-1', 1, economy(1));
    coalescer.queue('acct-1', 3, economy(3));
    coalescer.queue('acct-1', 2, economy(2));
    expect(coalescer.pendingAccounts()).toBe(1);

    vi.advanceTimersByTime(249);
    expect(flushes).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(flushes).toEqual([{ userId: 'acct-1', revision: 3, economy: economy(3) }]);
    expect(coalescer.pendingAccounts()).toBe(0);

    vi.advanceTimersByTime(1000);
    expect(flushes).toHaveLength(1);
  });

  it('ignores a lower revision queued before or after the flush', () => {
    const { coalescer, flushes } = createEconomyHarness();

    coalescer.queue('acct-1', 3, economy(3));
    coalescer.queue('acct-1', 1, economy(1));
    vi.advanceTimersByTime(250);
    expect(flushes).toEqual([{ userId: 'acct-1', revision: 3, economy: economy(3) }]);

    // A late older async result after the flush is still ignored, and a same revision too.
    coalescer.queue('acct-1', 1, economy(1));
    expect(coalescer.pendingAccounts()).toBe(0);
    coalescer.queue('acct-1', 3, economy(3));
    expect(coalescer.pendingAccounts()).toBe(0);
    coalescer.flush('acct-1');
    vi.advanceTimersByTime(250);
    expect(flushes).toHaveLength(1);
  });

  it('flushes immediately on purchase and drops an older late purchase result', () => {
    const { coalescer, flushes } = createEconomyHarness();

    // Two credits pending; a purchase forces the newest pending state now.
    coalescer.queue('acct-1', 1, economy(1));
    coalescer.queue('acct-1', 2, economy(2));
    coalescer.flush('acct-1');
    expect(flushes).toEqual([{ userId: 'acct-1', revision: 2, economy: economy(2) }]);

    // The forced flush cancelled the automatic window: no duplicate at 250 ms.
    vi.advanceTimersByTime(250);
    expect(flushes).toHaveLength(1);

    // An older purchase resolves late: ignored even by a forced flush.
    coalescer.queue('acct-1', 1, economy(1));
    coalescer.flush('acct-1');
    expect(flushes).toHaveLength(1);
    expect(coalescer.pendingAccounts()).toBe(0);

    // The newest purchase applies and flushes immediately.
    coalescer.queue('acct-1', 3, economy(3));
    coalescer.flush('acct-1');
    expect(flushes).toEqual([
      { userId: 'acct-1', revision: 2, economy: economy(2) },
      { userId: 'acct-1', revision: 3, economy: economy(3) },
    ]);
    expect(coalescer.pendingAccounts()).toBe(0);
  });

  it('keeps one independent timer per account', () => {
    const { coalescer, flushes } = createEconomyHarness();

    coalescer.queue('acct-a', 1, economy(1));
    vi.advanceTimersByTime(100);
    coalescer.queue('acct-b', 1, economy(10));

    vi.advanceTimersByTime(149);
    expect(flushes).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(flushes).toEqual([{ userId: 'acct-a', revision: 1, economy: economy(1) }]);

    vi.advanceTimersByTime(100);
    expect(flushes).toEqual([
      { userId: 'acct-a', revision: 1, economy: economy(1) },
      { userId: 'acct-b', revision: 1, economy: economy(10) },
    ]);
  });

  it('discard() clears every pending account and makes queue/flush inert', () => {
    const { coalescer, flushes } = createEconomyHarness();

    coalescer.queue('acct-a', 1, economy(1));
    coalescer.queue('acct-b', 2, economy(2));
    expect(coalescer.pendingAccounts()).toBe(2);

    coalescer.discard();
    expect(coalescer.pendingAccounts()).toBe(0);

    vi.advanceTimersByTime(1000);
    expect(flushes).toEqual([]);

    coalescer.queue('acct-c', 1, economy(3));
    expect(coalescer.pendingAccounts()).toBe(0);
    coalescer.flush('acct-c');
    vi.advanceTimersByTime(1000);
    expect(flushes).toEqual([]);
  });

  it('schedules exactly one injected timer per account with the configured interval', () => {
    const setTimeoutSpy = vi.fn((callback: () => void, delay?: number) =>
      setTimeout(callback, delay),
    );
    const { coalescer, flushes } = createEconomyHarness(250, {
      setTimeout: setTimeoutSpy as unknown as typeof setTimeout,
      clearTimeout: clearTimeout as unknown as typeof clearTimeout,
    });

    coalescer.queue('acct-1', 1, economy(1));
    coalescer.queue('acct-1', 2, economy(2));
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(typeof setTimeoutSpy.mock.calls[0]![0]).toBe('function');
    expect(setTimeoutSpy.mock.calls[0]![1]).toBe(250);

    vi.advanceTimersByTime(250);
    expect(flushes).toEqual([{ userId: 'acct-1', revision: 2, economy: economy(2) }]);
  });
});
