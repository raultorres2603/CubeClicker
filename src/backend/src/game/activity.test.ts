import { describe, expect, it, vi } from 'vitest';

import {
  ACTIVITY_MILESTONE_EVERY,
  ACTIVITY_MIN_INTERVAL_MS,
  createActivityFeed,
  type ActivityEventInput,
} from './activity.js';
import { ACTIVITY_EVENT_TTL_MS, type ActivityEvent } from './protocol.js';

/** A manual clock: the feed never reads wall time, so tests move time explicitly. */
interface ManualClock {
  now: () => number;
  set: (ms: number) => void;
  advance: (ms: number) => void;
}

function createClock(start = 0): ManualClock {
  let current = start;
  return {
    now: () => current,
    set: (ms: number) => {
      current = ms;
    },
    advance: (ms: number) => {
      current += ms;
    },
  };
}

const CUBE_CLEARED: ActivityEventInput = {
  type: 'cubeCleared',
  playerId: 'p2',
  name: 'Player 2',
  level: 3,
};

const FAST_CLEAR: ActivityEventInput = {
  type: 'fastClear',
  playerId: 'p2',
  name: 'Player 2',
  level: 4,
  elapsedMs: 2500,
};

const MILESTONE: ActivityEventInput = {
  type: 'levelMilestone',
  playerId: 'p2',
  name: 'Player 2',
  level: 5,
};

const EPIC_LOOT: ActivityEventInput = {
  type: 'epicLoot',
  playerId: 'p2',
  name: 'Player 2',
  partId: 'crown-epic',
};

const MEMBER_JOINED: ActivityEventInput = {
  type: 'memberJoined',
  playerId: 'p1',
  name: 'Player 1',
};

const MEMBER_LEFT: ActivityEventInput = {
  type: 'memberLeft',
  playerId: 'p1',
  name: 'Player 1',
};

/** One acceptance per closed input type: the input plus the exact event the feed builds. */
const RECORDED_CASES: ReadonlyArray<readonly [string, ActivityEventInput, ActivityEvent]> = [
  [
    'cubeCleared',
    CUBE_CLEARED,
    {
      id: 1,
      at: 1000,
      serverId: 1,
      type: 'cubeCleared',
      playerId: 'p2',
      name: 'Player 2',
      level: 3,
    },
  ],
  [
    'fastClear',
    FAST_CLEAR,
    {
      id: 1,
      at: 1000,
      serverId: 1,
      type: 'fastClear',
      playerId: 'p2',
      name: 'Player 2',
      level: 4,
      elapsedMs: 2500,
    },
  ],
  [
    'levelMilestone',
    MILESTONE,
    {
      id: 1,
      at: 1000,
      serverId: 1,
      type: 'levelMilestone',
      playerId: 'p2',
      name: 'Player 2',
      level: 5,
    },
  ],
  [
    'epicLoot',
    EPIC_LOOT,
    {
      id: 1,
      at: 1000,
      serverId: 1,
      type: 'epicLoot',
      playerId: 'p2',
      name: 'Player 2',
      partId: 'crown-epic',
    },
  ],
  [
    'memberJoined',
    MEMBER_JOINED,
    {
      id: 1,
      at: 1000,
      serverId: 1,
      type: 'memberJoined',
      playerId: 'p1',
      name: 'Player 1',
    },
  ],
  [
    'memberLeft',
    MEMBER_LEFT,
    {
      id: 1,
      at: 1000,
      serverId: 1,
      type: 'memberLeft',
      playerId: 'p1',
      name: 'Player 1',
    },
  ],
];

describe('activity feed constants', () => {
  it('pins the inclusive 1 s window and the 5-cube milestone cadence', () => {
    expect(ACTIVITY_MIN_INTERVAL_MS).toBe(1000);
    expect(ACTIVITY_MILESTONE_EVERY).toBe(5);
  });

  it('pins the 5000 ms activity eligibility TTL', () => {
    expect(ACTIVITY_EVENT_TTL_MS).toBe(5000);
  });
});

describe('createActivityFeed — acceptance', () => {
  it.each(RECORDED_CASES)('records %s with the pinned envelope', (_label, input, expected) => {
    const clock = createClock(1000);
    const feed = createActivityFeed({ now: clock.now });

    expect(feed.record(1, input)).toEqual(expected);
    expect(feed.snapshot(1)).toEqual([expected]);
  });

  it('assigns the injected clock at acceptance and advances the id per server', () => {
    const clock = createClock(250);
    const feed = createActivityFeed({ now: clock.now });

    expect(feed.record(1, CUBE_CLEARED)).toEqual({
      id: 1,
      at: 250,
      serverId: 1,
      type: 'cubeCleared',
      playerId: 'p2',
      name: 'Player 2',
      level: 3,
    });

    clock.set(1250);
    expect(feed.record(1, MILESTONE)).toEqual({
      id: 2,
      at: 1250,
      serverId: 1,
      type: 'levelMilestone',
      playerId: 'p2',
      name: 'Player 2',
      level: 5,
    });
  });
});

describe('createActivityFeed — 1/s per-server gate', () => {
  it('drops at 999 ms and accepts at exactly 1000 ms', () => {
    const clock = createClock(0);
    const feed = createActivityFeed({ now: clock.now });

    expect(feed.record(1, CUBE_CLEARED)?.id).toBe(1);

    clock.set(999);
    expect(feed.record(1, FAST_CLEAR)).toBeNull();
    expect(feed.snapshot(1).map((event) => event.id)).toEqual([1]);

    clock.set(1000);
    expect(feed.record(1, MILESTONE)?.id).toBe(2);
    expect(feed.snapshot(1).map((event) => event.id)).toEqual([2, 1]);

    clock.set(1999);
    expect(feed.record(1, EPIC_LOOT)).toBeNull();

    clock.set(2000);
    expect(feed.record(1, MEMBER_JOINED)?.id).toBe(3);
    expect(feed.snapshot(1).map((event) => event.id)).toEqual([3, 2, 1]);
  });

  it('accepts the ten-candidate 0..4500 ms sequence exactly at 0/1000/2000/3000/4000', () => {
    const clock = createClock(0);
    const feed = createActivityFeed({ now: clock.now });

    const accepted: ActivityEvent[] = [];
    for (let index = 0; index < 10; index += 1) {
      clock.set(index * 500);
      const event = feed.record(1, CUBE_CLEARED);
      if (event !== null) {
        accepted.push(event);
      }
    }

    expect(accepted.map((event) => [event.id, event.at])).toEqual([
      [1, 0],
      [2, 1000],
      [3, 2000],
      [4, 3000],
      [5, 4000],
    ]);
    expect(feed.snapshot(1).map((event) => event.at)).toEqual([4000, 3000, 2000, 1000, 0]);
  });

  it('applies the same window across event types without moving it on a drop', () => {
    const clock = createClock(0);
    const feed = createActivityFeed({ now: clock.now });

    expect(feed.record(1, MEMBER_JOINED)?.id).toBe(1);

    clock.set(500);
    expect(feed.record(1, CUBE_CLEARED)).toBeNull();
    expect(feed.record(1, EPIC_LOOT)).toBeNull();

    // The dropped candidates did not move the window: 1000 is still exactly one second
    // after the only acceptance.
    clock.set(1000);
    expect(feed.record(1, MEMBER_LEFT)).toEqual({
      id: 2,
      at: 1000,
      serverId: 1,
      type: 'memberLeft',
      playerId: 'p1',
      name: 'Player 1',
    });
  });

  it('honours custom limit and window options', () => {
    const clock = createClock(0);
    const feed = createActivityFeed({ now: clock.now, limit: 2, minIntervalMs: 500 });

    expect(feed.record(1, MEMBER_JOINED)?.id).toBe(1);

    clock.set(499);
    expect(feed.record(1, MEMBER_LEFT)).toBeNull();

    clock.set(500);
    expect(feed.record(1, MEMBER_JOINED)?.id).toBe(2);

    clock.set(1000);
    expect(feed.record(1, MEMBER_LEFT)?.id).toBe(3);

    clock.set(1500);
    expect(feed.record(1, MEMBER_JOINED)?.id).toBe(4);

    expect(feed.snapshot(1).map((event) => event.id)).toEqual([4, 3]);
  });
});

describe('createActivityFeed — activity TTL (default 5000 ms)', () => {
  it('serves an event at 4999 ms and expires it at exactly 5000 ms', () => {
    const clock = createClock(0);
    const feed = createActivityFeed({ now: clock.now });

    expect(feed.record(1, CUBE_CLEARED)).toEqual({
      id: 1,
      at: 0,
      serverId: 1,
      type: 'cubeCleared',
      playerId: 'p2',
      name: 'Player 2',
      level: 3,
    });

    clock.set(4999);
    expect(feed.snapshot(1)).toEqual([
      {
        id: 1,
        at: 0,
        serverId: 1,
        type: 'cubeCleared',
        playerId: 'p2',
        name: 'Player 2',
        level: 3,
      },
    ]);

    clock.set(5000);
    expect(feed.snapshot(1)).toEqual([]);
  });

  it('filters independently: events at 0/1000/2000 leave only at: 2000 at 6000', () => {
    const clock = createClock(0);
    const feed = createActivityFeed({ now: clock.now });

    expect(feed.record(1, CUBE_CLEARED)?.id).toBe(1);
    clock.set(1000);
    expect(feed.record(1, FAST_CLEAR)?.id).toBe(2);
    clock.set(2000);
    expect(feed.record(1, MILESTONE)?.id).toBe(3);

    clock.set(6000);
    expect(feed.snapshot(1)).toEqual([
      {
        id: 3,
        at: 2000,
        serverId: 1,
        type: 'levelMilestone',
        playerId: 'p2',
        name: 'Player 2',
        level: 5,
      },
    ]);
  });

  it('prunes the expired tail without moving nextId or lastAcceptedAt', () => {
    const clock = createClock(0);
    const feed = createActivityFeed({ now: clock.now });

    for (let index = 0; index < 7; index += 1) {
      clock.set(index * 1000);
      expect(feed.record(1, CUBE_CLEARED)?.id).toBe(index + 1);
    }

    // 6000: at: 0/1000 are 6000/5000 ms old (expired); 2000..6000 are fresh.
    clock.set(6000);
    expect(feed.snapshot(1).map((event) => [event.id, event.at])).toEqual([
      [7, 6000],
      [6, 5000],
      [5, 4000],
      [4, 3000],
      [3, 2000],
    ]);

    // 999 ms after the last acceptance at 6000: still dropped, so the window did not move.
    clock.set(6999);
    expect(feed.record(1, CUBE_CLEARED)).toBeNull();

    // Exactly 1000 ms after it: accepted with id 8, so pruning reset neither nextId nor the gate.
    clock.set(7000);
    expect(feed.record(1, CUBE_CLEARED)).toEqual({
      id: 8,
      at: 7000,
      serverId: 1,
      type: 'cubeCleared',
      playerId: 'p2',
      name: 'Player 2',
      level: 3,
    });
  });

  it('serves exactly the five freshest events at 24 000 and keeps advancing ids', () => {
    const clock = createClock(0);
    const feed = createActivityFeed({ now: clock.now });

    for (let index = 0; index < 25; index += 1) {
      clock.set(index * 1000);
      expect(feed.record(1, CUBE_CLEARED)?.id).toBe(index + 1);
    }

    clock.set(24_000);
    expect(feed.snapshot(1)).toEqual([
      {
        id: 25,
        at: 24_000,
        serverId: 1,
        type: 'cubeCleared',
        playerId: 'p2',
        name: 'Player 2',
        level: 3,
      },
      {
        id: 24,
        at: 23_000,
        serverId: 1,
        type: 'cubeCleared',
        playerId: 'p2',
        name: 'Player 2',
        level: 3,
      },
      {
        id: 23,
        at: 22_000,
        serverId: 1,
        type: 'cubeCleared',
        playerId: 'p2',
        name: 'Player 2',
        level: 3,
      },
      {
        id: 22,
        at: 21_000,
        serverId: 1,
        type: 'cubeCleared',
        playerId: 'p2',
        name: 'Player 2',
        level: 3,
      },
      {
        id: 21,
        at: 20_000,
        serverId: 1,
        type: 'cubeCleared',
        playerId: 'p2',
        name: 'Player 2',
        level: 3,
      },
    ]);

    clock.set(25_000);
    expect(feed.record(1, MILESTONE)).toEqual({
      id: 26,
      at: 25_000,
      serverId: 1,
      type: 'levelMilestone',
      playerId: 'p2',
      name: 'Player 2',
      level: 5,
    });
  });
});

describe('createActivityFeed — per-server isolation', () => {
  it('starts each server at id 1 with independent windows and rings', () => {
    const clock = createClock(0);
    const feed = createActivityFeed({ now: clock.now });

    expect(feed.record(1, CUBE_CLEARED)).toEqual({
      id: 1,
      at: 0,
      serverId: 1,
      type: 'cubeCleared',
      playerId: 'p2',
      name: 'Player 2',
      level: 3,
    });
    expect(feed.record(2, EPIC_LOOT)).toEqual({
      id: 1,
      at: 0,
      serverId: 2,
      type: 'epicLoot',
      playerId: 'p2',
      name: 'Player 2',
      partId: 'crown-epic',
    });

    clock.set(500);
    expect(feed.record(1, MILESTONE)).toBeNull();

    // Server 2 already accepted at 0, so it drops at 500 and accepts at 1000, independently.
    expect(feed.record(2, MEMBER_JOINED)).toBeNull();

    clock.set(1000);
    expect(feed.record(2, MEMBER_JOINED)?.id).toBe(2);

    expect(feed.snapshot(1).map((event) => event.id)).toEqual([1]);
    expect(feed.snapshot(2).map((event) => event.id)).toEqual([2, 1]);
    expect(feed.snapshot(1)[0]!.serverId).toBe(1);
    expect(feed.snapshot(2)[0]!.serverId).toBe(2);
  });
});

describe('createActivityFeed — ring buffer', () => {
  it('keeps the 20 newest events newest first with a long TTL seam', () => {
    const clock = createClock(0);
    const feed = createActivityFeed({ now: clock.now, ttlMs: 1_000_000 });

    for (let index = 0; index < 25; index += 1) {
      clock.set(index * 1000);
      expect(feed.record(1, CUBE_CLEARED)?.id).toBe(index + 1);
    }

    const snapshot = feed.snapshot(1);
    expect(snapshot).toHaveLength(20);
    expect(snapshot.map((event) => event.id)).toEqual([
      25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6,
    ]);
    expect(snapshot[0]!.at).toBe(24_000);
    expect(snapshot[19]!.at).toBe(5000);
  });

  it('returns [] for an unknown server and for a server with no accepted events', () => {
    const feed = createActivityFeed({ now: () => 0 });

    expect(feed.snapshot(1)).toEqual([]);
    expect(feed.snapshot(99)).toEqual([]);
  });
});

describe('createActivityFeed — snapshot copy semantics', () => {
  it('returns a fresh array of fresh event objects on every read', () => {
    const feed = createActivityFeed({ now: () => 0 });
    const accepted = feed.record(1, FAST_CLEAR);
    expect(accepted).toEqual({
      id: 1,
      at: 0,
      serverId: 1,
      type: 'fastClear',
      playerId: 'p2',
      name: 'Player 2',
      level: 4,
      elapsedMs: 2500,
    });

    const first = feed.snapshot(1);
    const second = feed.snapshot(1);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first[0]).not.toBe(second[0]);

    first[0]!.name = 'Mallory';
    first[0]!.elapsedMs = 1;
    first.push({ ...second[0]! });
    expect(feed.snapshot(1)).toEqual([
      {
        id: 1,
        at: 0,
        serverId: 1,
        type: 'fastClear',
        playerId: 'p2',
        name: 'Player 2',
        level: 4,
        elapsedMs: 2500,
      },
    ]);
  });
});

describe('createActivityFeed — lifecycle', () => {
  it('drops only the named server buffer', () => {
    const clock = createClock(0);
    const feed = createActivityFeed({ now: clock.now });

    feed.record(1, CUBE_CLEARED);
    feed.record(2, EPIC_LOOT);

    feed.dropServer(1);

    expect(feed.snapshot(1)).toEqual([]);
    expect(feed.snapshot(2).map((event) => event.id)).toEqual([1]);
    expect(feed.snapshot(2)[0]!.serverId).toBe(2);

    // A dropped server starts over with a fresh id sequence when it is seen again.
    clock.set(1000);
    expect(feed.record(1, MEMBER_JOINED)?.id).toBe(1);
  });

  it('is terminal after clear(): record null, snapshot [], drop and repeat clear are no-ops', () => {
    const clock = createClock(0);
    const feed = createActivityFeed({ now: clock.now });

    expect(feed.record(1, MEMBER_JOINED)?.id).toBe(1);
    feed.clear();

    clock.set(5000);
    expect(feed.record(1, MEMBER_LEFT)).toBeNull();
    expect(feed.record(2, CUBE_CLEARED)).toBeNull();
    expect(feed.snapshot(1)).toEqual([]);
    expect(feed.snapshot(2)).toEqual([]);

    feed.dropServer(1);
    feed.clear();
    expect(feed.snapshot(1)).toEqual([]);
    expect(feed.record(1, MEMBER_JOINED)).toBeNull();
  });

  it('creates no timer in any path', () => {
    vi.useFakeTimers();
    try {
      const feed = createActivityFeed({ now: () => 0 });
      feed.record(1, CUBE_CLEARED);
      feed.record(1, FAST_CLEAR);
      feed.snapshot(1);
      feed.dropServer(1);
      feed.clear();

      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
