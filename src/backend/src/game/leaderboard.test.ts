import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TimerFns } from './broadcast.js';
import {
  LEADERBOARD_INTERVAL_MS,
  type LeaderboardCoalescer,
  type LeaderboardMember,
  buildLeaderboardSnapshot,
  createLeaderboardCoalescer,
} from './leaderboard.js';
import { LEADERBOARD_TOP_LIMIT, type LeaderboardEntry } from './protocol.js';

/** One server member fixture; the name mirrors the server-issued guest naming. */
function member(
  playerId: string,
  cubesCompleted: number,
  clicks: number,
  facesDestroyed = 0,
): LeaderboardMember {
  return {
    playerId,
    name: `Player ${playerId.slice(1)}`,
    clicks,
    facesDestroyed,
    cubesCompleted,
  };
}

/** One expected ranked row (the builder drops `facesDestroyed` from entries). */
function entry(playerId: string, cubesCompleted: number, clicks: number): LeaderboardEntry {
  return {
    playerId,
    name: `Player ${playerId.slice(1)}`,
    cubesCompleted,
    clicks,
  };
}

/** The fake timer functions installed by `vi.useFakeTimers()` for the current test. */
function fakeTimers(): TimerFns {
  return { setTimeout, clearTimeout };
}

interface CoalescerHarness {
  coalescer: LeaderboardCoalescer;
  flushes: number[];
}

function createHarness(
  intervalMs = LEADERBOARD_INTERVAL_MS,
  timers: TimerFns = fakeTimers(),
  onFlush?: (serverId: number) => void,
): CoalescerHarness {
  const flushes: number[] = [];
  const coalescer = createLeaderboardCoalescer({
    intervalMs,
    timers,
    flush: (serverId) => {
      flushes.push(serverId);
      onFlush?.(serverId);
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

describe('LEADERBOARD_TOP_LIMIT / LEADERBOARD_INTERVAL_MS', () => {
  it('pins the top-five row cap', () => {
    expect(LEADERBOARD_TOP_LIMIT).toBe(5);
  });

  it('pins the one-second per-server coalescing interval', () => {
    expect(LEADERBOARD_INTERVAL_MS).toBe(1000);
  });
});

describe('buildLeaderboardSnapshot — ranking (AC-5, AC-6)', () => {
  it('ranks by cubes desc, then clicks desc, then slot order', () => {
    const members = [
      member('p1', 0, 100, 2),
      member('p2', 1, 5, 1),
      member('p3', 1, 4, 0),
      member('p4', 1, 5, 3),
      member('p5', 2, 0, 0),
    ];

    const snapshot = buildLeaderboardSnapshot(3, 1000, members);

    expect(snapshot).toStrictEqual({
      serverId: 3,
      at: 1000,
      entries: [
        entry('p5', 2, 0),
        entry('p2', 1, 5),
        entry('p4', 1, 5),
        entry('p3', 1, 4),
        entry('p1', 0, 100),
      ],
      totals: { cubesCompleted: 5, clicks: 114, facesDestroyed: 6 },
    });
    // The input keeps its registry/slot order: the builder sorts a copy.
    expect(members.map((candidate) => candidate.playerId)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
    ]);
  });

  it('ranks one completed cube above one hundred clicks', () => {
    const snapshot = buildLeaderboardSnapshot(1, 0, [
      member('p1', 0, 100),
      member('p2', 1, 0),
    ]);

    expect(snapshot.entries).toStrictEqual([entry('p2', 1, 0), entry('p1', 0, 100)]);
  });

  it('ranks one cube with five clicks above one cube with four clicks', () => {
    const snapshot = buildLeaderboardSnapshot(1, 0, [
      member('p1', 1, 4),
      member('p2', 1, 5),
    ]);

    expect(snapshot.entries).toStrictEqual([entry('p2', 1, 5), entry('p1', 1, 4)]);
  });

  it('ranks equal cubes and clicks in ascending slot order', () => {
    const snapshot = buildLeaderboardSnapshot(1, 0, [
      member('p1', 2, 7),
      member('p2', 2, 7),
      member('p3', 2, 7),
    ]);

    expect(snapshot.entries).toStrictEqual([
      entry('p1', 2, 7),
      entry('p2', 2, 7),
      entry('p3', 2, 7),
    ]);
  });

  it('keeps the lower slot at the fifth/sixth cutoff and omits the higher slot', () => {
    const members = [1, 2, 3, 4, 5, 6].map((index) => member(`p${index}`, 1, 1));

    const snapshot = buildLeaderboardSnapshot(2, 500, members);

    expect(snapshot.entries).toStrictEqual([
      entry('p1', 1, 1),
      entry('p2', 1, 1),
      entry('p3', 1, 1),
      entry('p4', 1, 1),
      entry('p5', 1, 1),
    ]);
    expect(snapshot.totals).toStrictEqual({
      cubesCompleted: 6,
      clicks: 6,
      facesDestroyed: 0,
    });
  });
});

describe('buildLeaderboardSnapshot — top five and all-member totals (AC-5)', () => {
  it('returns exactly five entries and totals over all six members', () => {
    const members = [
      member('p1', 5, 50, 1),
      member('p2', 3, 30, 2),
      member('p3', 0, 90, 0),
      member('p4', 1, 10, 3),
      member('p5', 0, 5, 4),
      member('p6', 2, 20, 5),
    ];

    const snapshot = buildLeaderboardSnapshot(4, 2500, members);

    expect(snapshot).toStrictEqual({
      serverId: 4,
      at: 2500,
      entries: [
        entry('p1', 5, 50),
        entry('p2', 3, 30),
        entry('p6', 2, 20),
        entry('p4', 1, 10),
        entry('p3', 0, 90),
      ],
      totals: { cubesCompleted: 11, clicks: 205, facesDestroyed: 15 },
    });
  });

  it('returns every member when the server has fewer than five', () => {
    const snapshot = buildLeaderboardSnapshot(1, 10, [
      member('p1', 2, 20, 1),
      member('p2', 0, 3, 2),
      member('p3', 1, 11, 3),
    ]);

    expect(snapshot.entries).toStrictEqual([
      entry('p1', 2, 20),
      entry('p3', 1, 11),
      entry('p2', 0, 3),
    ]);
    expect(snapshot.totals).toStrictEqual({
      cubesCompleted: 3,
      clicks: 34,
      facesDestroyed: 6,
    });
  });

  it('returns the solo member with equal entry and total counters', () => {
    const snapshot = buildLeaderboardSnapshot(7, 1000, [member('p9', 4, 41, 6)]);

    expect(snapshot).toStrictEqual({
      serverId: 7,
      at: 1000,
      entries: [entry('p9', 4, 41)],
      totals: { cubesCompleted: 4, clicks: 41, facesDestroyed: 6 },
    });
  });

  it('returns an empty ranking and zero totals for an empty server', () => {
    expect(buildLeaderboardSnapshot(5, 0, [])).toStrictEqual({
      serverId: 5,
      at: 0,
      entries: [],
      totals: { cubesCompleted: 0, clicks: 0, facesDestroyed: 0 },
    });
  });

  it('honours an explicit row limit while still totalling every member', () => {
    const snapshot = buildLeaderboardSnapshot(
      1,
      1000,
      [member('p1', 3, 30), member('p2', 2, 20), member('p3', 1, 10)],
      2,
    );

    expect(snapshot.entries).toStrictEqual([entry('p1', 3, 30), entry('p2', 2, 20)]);
    expect(snapshot.totals).toStrictEqual({
      cubesCompleted: 6,
      clicks: 60,
      facesDestroyed: 0,
    });
  });
});

describe('buildLeaderboardSnapshot — copies, parity and privacy (AC-3, AC-24)', () => {
  it('returns fresh entries and totals that later input mutations cannot rewrite', () => {
    const members = [member('p1', 2, 40, 3)];
    const snapshot = buildLeaderboardSnapshot(1, 1000, members);

    members[0]!.cubesCompleted = 99;
    members[0]!.clicks = 99;
    members.push(member('p2', 50, 500, 50));

    expect(snapshot).toStrictEqual({
      serverId: 1,
      at: 1000,
      entries: [entry('p1', 2, 40)],
      totals: { cubesCompleted: 2, clicks: 40, facesDestroyed: 3 },
    });
    expect(snapshot.entries[0]).not.toBe(members[0]);
  });

  it('builds the same snapshot for guest and account inputs and carries no account data', () => {
    const guest = member('p1', 2, 40, 3);
    const account = {
      ...guest,
      accountId: 'acct-1',
      coins: 1234,
      economy: { coins: 999, cubesDestroyed: 7 },
    } as unknown as LeaderboardMember;

    const guestSnapshot = buildLeaderboardSnapshot(1, 1000, [guest]);
    const accountSnapshot = buildLeaderboardSnapshot(1, 1000, [account]);

    expect(accountSnapshot).toStrictEqual(guestSnapshot);
    expect(JSON.stringify(accountSnapshot)).toBe(
      '{"serverId":1,"at":1000,"entries":[{"playerId":"p1","name":"Player 1","cubesCompleted":2,"clicks":40}],"totals":{"cubesCompleted":2,"clicks":40,"facesDestroyed":3}}',
    );
  });
});

describe('createLeaderboardCoalescer — cadence (AC-9)', () => {
  it('does not flush at 999 ms and flushes exactly once at 1000 ms', () => {
    const { coalescer, flushes } = createHarness();

    coalescer.markDirty(1);
    expect(coalescer.pendingServers()).toBe(1);

    vi.advanceTimersByTime(999);
    expect(flushes).toEqual([]);
    expect(coalescer.pendingServers()).toBe(1);

    vi.advanceTimersByTime(1);
    expect(flushes).toEqual([1]);
    expect(coalescer.pendingServers()).toBe(0);

    vi.advanceTimersByTime(1000);
    expect(flushes).toEqual([1]);
  });

  it('includes further marks inside the window in the original boundary flush', () => {
    const { coalescer, flushes } = createHarness();

    coalescer.markDirty(4);
    vi.advanceTimersByTime(500);
    coalescer.markDirty(4);
    coalescer.markDirty(4);
    expect(coalescer.pendingServers()).toBe(1);

    vi.advanceTimersByTime(499);
    expect(flushes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(flushes).toEqual([4]);
  });

  it('turns ten marks across one window into exactly one flush', () => {
    const { coalescer, flushes } = createHarness();

    for (let index = 0; index < 10; index += 1) {
      coalescer.markDirty(7);
      expect(coalescer.pendingServers()).toBe(1);
      if (index < 9) {
        vi.advanceTimersByTime(100);
      }
    }

    // Changes at 0, 100, …, 900 ms: nothing at 900 ms, one frame at 1000 ms.
    expect(flushes).toEqual([]);
    vi.advanceTimersByTime(100);
    expect(flushes).toEqual([7]);

    vi.advanceTimersByTime(1000);
    expect(flushes).toEqual([7]);
  });

  it('starts a second window for a change at t + 1001 and flushes it at t + 2001', () => {
    const { coalescer, flushes } = createHarness();

    coalescer.markDirty(1);
    vi.advanceTimersByTime(1000);
    expect(flushes).toEqual([1]);

    vi.advanceTimersByTime(1);
    coalescer.markDirty(1);
    vi.advanceTimersByTime(999);
    expect(flushes).toEqual([1]);

    vi.advanceTimersByTime(1);
    expect(flushes).toEqual([1, 1]);
  });

  it('keeps one independent timer per dirty server', () => {
    const { coalescer, flushes } = createHarness();

    coalescer.markDirty(1);
    vi.advanceTimersByTime(400);
    coalescer.markDirty(2);
    expect(coalescer.pendingServers()).toBe(2);

    vi.advanceTimersByTime(599);
    expect(flushes).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(flushes).toEqual([1]);
    expect(coalescer.pendingServers()).toBe(1);

    vi.advanceTimersByTime(399);
    expect(flushes).toEqual([1]);
    vi.advanceTimersByTime(1);
    expect(flushes).toEqual([1, 2]);
    expect(coalescer.pendingServers()).toBe(0);
  });

  it('starts a fresh window when the flush callback marks the same server dirty', () => {
    const flushes: number[] = [];
    let reentered = false;
    const coalescer: LeaderboardCoalescer = createLeaderboardCoalescer({
      intervalMs: LEADERBOARD_INTERVAL_MS,
      timers: fakeTimers(),
      flush: (serverId) => {
        flushes.push(serverId);
        if (!reentered) {
          reentered = true;
          coalescer.markDirty(serverId);
        }
      },
    });

    coalescer.markDirty(1);
    vi.advanceTimersByTime(1000);
    expect(flushes).toEqual([1]);
    expect(coalescer.pendingServers()).toBe(1);

    vi.advanceTimersByTime(999);
    expect(flushes).toEqual([1]);
    vi.advanceTimersByTime(1);
    expect(flushes).toEqual([1, 1]);
    expect(coalescer.pendingServers()).toBe(0);
  });
});

describe('createLeaderboardCoalescer — cleanup (AC-13)', () => {
  it('drops only the named server and treats an unknown server as a no-op', () => {
    const { coalescer, flushes } = createHarness();

    coalescer.markDirty(1);
    coalescer.markDirty(2);
    coalescer.dropServer(9);
    expect(coalescer.pendingServers()).toBe(2);

    coalescer.dropServer(1);
    expect(coalescer.pendingServers()).toBe(1);

    vi.advanceTimersByTime(1000);
    expect(flushes).toEqual([2]);
    expect(coalescer.pendingServers()).toBe(0);
  });

  it('discard() clears every timer and is terminal', () => {
    const { coalescer, flushes } = createHarness();

    coalescer.markDirty(1);
    coalescer.markDirty(2);
    expect(vi.getTimerCount()).toBe(2);

    coalescer.discard();
    expect(coalescer.pendingServers()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(2000);
    expect(flushes).toEqual([]);

    coalescer.markDirty(3);
    coalescer.dropServer(4);
    expect(coalescer.pendingServers()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    coalescer.discard();
    expect(coalescer.pendingServers()).toBe(0);
  });

  it('schedules exactly one injected timer with the pinned interval and clears it on drop', () => {
    const setTimeoutSpy = vi.fn((callback: () => void, delay?: number) =>
      setTimeout(callback, delay),
    );
    const clearTimeoutSpy = vi.fn((handle: ReturnType<typeof setTimeout>) => {
      clearTimeout(handle);
    });
    const { coalescer, flushes } = createHarness(LEADERBOARD_INTERVAL_MS, {
      setTimeout: setTimeoutSpy as unknown as typeof setTimeout,
      clearTimeout: clearTimeoutSpy as unknown as typeof clearTimeout,
    });

    coalescer.markDirty(1);
    coalescer.markDirty(1);
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(typeof setTimeoutSpy.mock.calls[0]![0]).toBe('function');
    expect(setTimeoutSpy.mock.calls[0]![1]).toBe(1000);

    vi.advanceTimersByTime(1000);
    expect(flushes).toEqual([1]);

    coalescer.markDirty(2);
    coalescer.dropServer(2);
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    expect(coalescer.pendingServers()).toBe(0);
  });
});
