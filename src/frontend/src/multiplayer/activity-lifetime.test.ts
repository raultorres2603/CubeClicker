import { describe, expect, it } from 'vitest';

import type { ActivityEvent, CubeState, MemberState, ServerMessage } from './protocol';
import { ACTIVITY_EVENT_TTL_MS, ACTIVITY_FEED_LIMIT } from './protocol';
import {
  ACTIVITY_EXPIRY_TICK_MS,
  createActivityLifetime,
  type ActivityFeedSlice,
  type ActivityLifetime,
} from './activity-lifetime';
import {
  applyWorldSwap,
  createWorldState,
  pruneActivity,
  reduceWorldState,
  type WorldState,
} from './server-state';

/**
 * The scenarios below drive the exact session order pinned by the spec — reduce →
 * `lifetime.observe` → synchronous `pruneActivity` → publish — so the module pair is
 * exercised through the real reducer and the real travel-midpoint swap, not only in
 * isolation. Local times are exact milliseconds from first receipt (`t = 0`).
 */

const SELF_MEMBER: MemberState = {
  playerId: 'p1',
  name: 'Player 1',
  position: { x: 38.197186342054884, y: 0 },
  levelIndex: 0,
  gridSize: 3,
  styleId: 'obsidian-neon',
  removedIds: [],
  yawSteps: 0,
  pitchSteps: 0,
};

const SELF_CUBE: CubeState = {
  levelIndex: 0,
  gridSize: 3,
  styleId: 'obsidian-neon',
  removedIds: [],
  yawSteps: 0,
  pitchSteps: 0,
};

/** The current server's seeded event (server 1, id 1). */
const SERVER_1_JOIN: ActivityEvent = {
  id: 1,
  at: 0,
  serverId: 1,
  type: 'memberJoined',
  playerId: 'p2',
  name: 'Player 2',
};

/** A new server-1 event seeded by the same-server rejoin at local 4000 (id 2). */
const SERVER_1_CLEAR: ActivityEvent = {
  id: 2,
  at: 4000,
  serverId: 1,
  type: 'cubeCleared',
  playerId: 'p2',
  name: 'Player 2',
  level: 2,
};

/** The pending target's seeded event (server 2, id 1 — ids restart per server). */
const SERVER_2_JOIN: ActivityEvent = {
  id: 1,
  at: 1000,
  serverId: 2,
  type: 'memberJoined',
  playerId: 'p3',
  name: 'Player 3',
};

/** A live target event received in travel at local 3000 (server 2, id 2). */
const SERVER_2_CLEAR: ActivityEvent = {
  id: 2,
  at: 3000,
  serverId: 2,
  type: 'cubeCleared',
  playerId: 'p3',
  name: 'Player 3',
  level: 3,
};

const TOKEN = '0123456789abcdef0123456789abcdef';

function welcome(
  serverId: number,
  activity: ActivityEvent[],
): Extract<ServerMessage, { type: 'welcome' }> {
  return {
    type: 'welcome',
    playerId: 'p1',
    name: 'Player 1',
    token: TOKEN,
    serverId,
    maxUsers: 10,
    position: SELF_MEMBER.position,
    self: SELF_CUBE,
    roster: [SELF_MEMBER],
    activity,
    identity: { kind: 'guest', playerId: 'p1' },
  };
}

function worldEntered(
  serverId: number,
  activity: ActivityEvent[],
): Extract<ServerMessage, { type: 'worldEntered' }> {
  return { ...welcome(serverId, activity), type: 'worldEntered' };
}

/** The current feed plus, while travelling, the pending target feed. */
function feedsOf(state: WorldState): ActivityFeedSlice[] {
  const feeds: ActivityFeedSlice[] = [{ serverId: state.serverId, events: state.activity }];
  if (state.pendingWorldSwap !== null) {
    feeds.push({
      serverId: state.pendingWorldSwap.serverId,
      events: state.pendingWorldSwap.activity,
    });
  }
  return feeds;
}

function pruneAt(state: WorldState, lifetime: ActivityLifetime, nowMs: number): WorldState {
  return pruneActivity(state, (serverId, eventId) => lifetime.isExpired(serverId, eventId, nowMs));
}

/** The session's reduction order: reduce → observe → synchronous prune (AC-15…AC-18). */
function reduceAt(
  state: WorldState,
  message: ServerMessage,
  lifetime: ActivityLifetime,
  nowMs: number,
): WorldState {
  const reduced = reduceWorldState(state, message);
  lifetime.observe(feedsOf(reduced), nowMs);
  return pruneAt(reduced, lifetime, nowMs);
}

/** The fallback tick / post-swap order: observe → synchronous prune. */
function pruneFeedsAt(
  state: WorldState,
  lifetime: ActivityLifetime,
  nowMs: number,
): WorldState {
  lifetime.observe(feedsOf(state), nowMs);
  return pruneAt(state, lifetime, nowMs);
}

/** The travel midpoint: applyWorldSwap → observe → synchronous prune. */
function swapAt(state: WorldState, lifetime: ActivityLifetime, nowMs: number): WorldState {
  const swapped = applyWorldSwap(state);
  lifetime.observe(feedsOf(swapped), nowMs);
  return pruneAt(swapped, lifetime, nowMs);
}

function generatedEvent(serverId: number, id: number): ActivityEvent {
  return {
    id,
    at: id * 1000,
    serverId,
    type: 'cubeCleared',
    playerId: 'p2',
    name: 'Player 2',
    level: id,
  };
}

describe('activity display-lifetime constants', () => {
  it('pins the 250 ms fallback prune cadence (AC-18)', () => {
    expect(ACTIVITY_EXPIRY_TICK_MS).toBe(250);
  });
});

describe('createActivityLifetime — first-seen deadlines', () => {
  it('anchors a deadline at first receipt: present at 4999 ms, expired at exactly 5000 ms', () => {
    const lifetime = createActivityLifetime({ ttlMs: 5000 });
    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 0);

    expect(lifetime.isExpired(1, 1, 0)).toBe(false);
    expect(lifetime.isExpired(1, 1, 4999)).toBe(false);
    expect(lifetime.isExpired(1, 1, 5000)).toBe(true);
    expect(lifetime.size()).toBe(1);
  });

  it('honours the injected ttl instead of a hard-coded 5000 ms', () => {
    const lifetime = createActivityLifetime({ ttlMs: 1000 });
    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 0);

    expect(lifetime.isExpired(1, 1, 999)).toBe(false);
    expect(lifetime.isExpired(1, 1, 1000)).toBe(true);
  });

  it('never extends a deadline when the same key is re-seeded', () => {
    const lifetime = createActivityLifetime({ ttlMs: 5000 });
    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 0);
    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 4000);

    expect(lifetime.isExpired(1, 1, 4999)).toBe(false);
    expect(lifetime.isExpired(1, 1, 5000)).toBe(true);
    expect(lifetime.size()).toBe(1);
  });

  it('anchors a newly seeded event at its own first sighting', () => {
    const lifetime = createActivityLifetime({ ttlMs: 5000 });
    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 0);
    lifetime.observe([{ serverId: 1, events: [SERVER_1_CLEAR, SERVER_1_JOIN] }], 4000);

    expect(lifetime.isExpired(1, 1, 5000)).toBe(true);
    expect(lifetime.isExpired(1, 2, 8999)).toBe(false);
    expect(lifetime.isExpired(1, 2, 9000)).toBe(true);
    expect(lifetime.size()).toBe(2);
  });

  it('treats an unseen key as not expired and keys numeric ids per server', () => {
    const lifetime = createActivityLifetime({ ttlMs: 5000 });

    expect(lifetime.isExpired(1, 1, 0)).toBe(false);

    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 0);
    lifetime.observe([{ serverId: 2, events: [SERVER_2_JOIN] }], 0);
    expect(lifetime.isExpired(2, 1, 4999)).toBe(false);
    expect(lifetime.isExpired(2, 1, 5000)).toBe(true);
    // Server 1's keys were dropped when the feed moved to server 2 (AC-17).
    expect(lifetime.isExpired(1, 1, 5000)).toBe(false);
    expect(lifetime.size()).toBe(1);
  });
});

describe('createActivityLifetime — tombstones', () => {
  it('tombstones an expired key for the TTL and filters a re-seed synchronously', () => {
    const lifetime = createActivityLifetime({ ttlMs: 5000 });
    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 0);

    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 5000);
    expect(lifetime.isExpired(1, 1, 5000)).toBe(true);
    expect(lifetime.size()).toBe(1);

    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 5001);
    expect(lifetime.isExpired(1, 1, 5001)).toBe(true);
    expect(lifetime.size()).toBe(1);

    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 9999);
    expect(lifetime.isExpired(1, 1, 9999)).toBe(true);

    // The tombstone lasts 5000 ms from the observation that found the deadline expired.
    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 10000);
    expect(lifetime.isExpired(1, 1, 10000)).toBe(false);
    expect(lifetime.isExpired(1, 1, 14999)).toBe(false);
    expect(lifetime.isExpired(1, 1, 15000)).toBe(true);
    expect(lifetime.size()).toBe(1);
  });

  it('ages a tombstone out and re-tracks the same key after the window', () => {
    const lifetime = createActivityLifetime({ ttlMs: 5000 });
    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 0);
    lifetime.observe([{ serverId: 1, events: [] }], 5000);
    expect(lifetime.size()).toBe(1);

    lifetime.observe([{ serverId: 1, events: [] }], 10000);
    expect(lifetime.size()).toBe(0);

    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 10001);
    expect(lifetime.isExpired(1, 1, 15000)).toBe(false);
    expect(lifetime.isExpired(1, 1, 15001)).toBe(true);
  });

  it('converts a retained deadline to a tombstone even when a prune ran before any observe', () => {
    const lifetime = createActivityLifetime({ ttlMs: 5000 });
    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 0);

    // A prune-only tick (isExpired without observe) removes the line but cannot erase the
    // tracked deadline; the next observe converts it before the seed is considered.
    expect(lifetime.isExpired(1, 1, 5000)).toBe(true);

    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 5001);
    expect(lifetime.isExpired(1, 1, 5001)).toBe(true);
    expect(lifetime.size()).toBe(1);
  });
});

describe('createActivityLifetime — stale servers and bounds', () => {
  it('drops the deadlines of a server that is no longer current or pending', () => {
    const lifetime = createActivityLifetime({ ttlMs: 5000 });
    lifetime.observe(
      [
        { serverId: 1, events: [SERVER_1_JOIN] },
        { serverId: 2, events: [SERVER_2_JOIN] },
      ],
      0,
    );
    expect(lifetime.size()).toBe(2);

    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 1000);
    expect(lifetime.size()).toBe(1);
    expect(lifetime.isExpired(2, 1, 4001)).toBe(false);

    // A server-2 seed later is a fresh event, not the dropped one.
    lifetime.observe([{ serverId: 2, events: [SERVER_2_JOIN] }], 2000);
    expect(lifetime.size()).toBe(1);
    expect(lifetime.isExpired(2, 1, 6999)).toBe(false);
    expect(lifetime.isExpired(2, 1, 7000)).toBe(true);
  });

  it('drops a tombstone when its server leaves the feeds', () => {
    const lifetime = createActivityLifetime({ ttlMs: 5000 });
    lifetime.observe([{ serverId: 1, events: [SERVER_1_JOIN] }], 0);
    lifetime.observe([{ serverId: 1, events: [] }], 5000);
    expect(lifetime.size()).toBe(1);

    lifetime.observe([{ serverId: 2, events: [] }], 5001);
    expect(lifetime.size()).toBe(0);
  });

  it('dropServer removes only that server’s deadlines and tombstones', () => {
    const lifetime = createActivityLifetime({ ttlMs: 5000 });
    lifetime.observe(
      [
        { serverId: 1, events: [SERVER_1_JOIN] },
        { serverId: 2, events: [SERVER_2_JOIN] },
      ],
      0,
    );
    expect(lifetime.size()).toBe(2);

    lifetime.dropServer(1);
    expect(lifetime.size()).toBe(1);
    expect(lifetime.isExpired(1, 1, 5000)).toBe(false);
    expect(lifetime.isExpired(2, 1, 5000)).toBe(true);
  });

  it('clear empties every deadline and tombstone', () => {
    const lifetime = createActivityLifetime({ ttlMs: 5000 });
    lifetime.observe(
      [
        { serverId: 1, events: [SERVER_1_JOIN] },
        { serverId: 2, events: [SERVER_2_JOIN] },
      ],
      0,
    );
    expect(lifetime.size()).toBe(2);

    lifetime.clear();
    expect(lifetime.size()).toBe(0);
    expect(lifetime.isExpired(1, 1, 5000)).toBe(false);
    expect(lifetime.isExpired(2, 1, 5000)).toBe(false);
  });

  it('stays bounded: one key per event, no growth on re-observe, full cleanup after the window', () => {
    const lifetime = createActivityLifetime({ ttlMs: 5000 });
    const current = Array.from({ length: ACTIVITY_FEED_LIMIT }, (_, index) =>
      generatedEvent(1, index + 1),
    );
    const pending = Array.from({ length: ACTIVITY_FEED_LIMIT }, (_, index) =>
      generatedEvent(2, index + 1),
    );
    const feeds: ActivityFeedSlice[] = [
      { serverId: 1, events: current },
      { serverId: 2, events: pending },
    ];

    lifetime.observe(feeds, 0);
    expect(lifetime.size()).toBe(2 * ACTIVITY_FEED_LIMIT);

    // Re-observing both full feeds four seconds later adds no keys and extends nothing.
    lifetime.observe(feeds, 4000);
    expect(lifetime.size()).toBe(2 * ACTIVITY_FEED_LIMIT);
    expect(lifetime.isExpired(1, 1, 4999)).toBe(false);
    expect(lifetime.isExpired(1, 1, 5000)).toBe(true);

    // Every deadline becomes a tombstone; no key is added or lost.
    lifetime.observe(
      [
        { serverId: 1, events: [] },
        { serverId: 2, events: [] },
      ],
      5000,
    );
    expect(lifetime.size()).toBe(2 * ACTIVITY_FEED_LIMIT);

    // One TTL after the expiry observation the tombstones are pruned.
    lifetime.observe(
      [
        { serverId: 1, events: [] },
        { serverId: 2, events: [] },
      ],
      10000,
    );
    expect(lifetime.size()).toBe(0);
  });
});

describe('activity display expiry — current + pending travel, no post-seed welcome (AC-15)', () => {
  it('expires the current feed at 5000 and the pending feed at 6000/8000, then the swap carries only e3', () => {
    const lifetime = createActivityLifetime({ ttlMs: ACTIVITY_EVENT_TTL_MS });

    // t = 0: welcome on server 1 seeds the current feed with e1.
    let state = reduceAt(createWorldState(), welcome(1, [SERVER_1_JOIN]), lifetime, 0);
    expect(state.activity).toEqual([SERVER_1_JOIN]);
    expect(state.pendingWorldSwap).toBeNull();

    // t = 1000: worldEntered on server 2 seeds the pending target feed with e2.
    state = reduceAt(state, worldEntered(2, [SERVER_2_JOIN]), lifetime, 1000);
    expect(state.activity).toEqual([SERVER_1_JOIN]);
    expect(state.pendingWorldSwap!.serverId).toBe(2);
    expect(state.pendingWorldSwap!.activity).toEqual([SERVER_2_JOIN]);

    // t = 3000: a live target event e3 is prepended to the pending feed. No welcome follows.
    state = reduceAt(state, { type: 'activityEvent', event: SERVER_2_CLEAR }, lifetime, 3000);
    expect(state.activity).toEqual([SERVER_1_JOIN]);
    expect(state.pendingWorldSwap!.activity).toEqual([SERVER_2_CLEAR, SERVER_2_JOIN]);

    const pendingBranch = state.pendingWorldSwap;

    // t = 4999: e1 is still current, e2/e3 still pending.
    state = pruneFeedsAt(state, lifetime, 4999);
    expect(state.activity).toEqual([SERVER_1_JOIN]);
    expect(state.pendingWorldSwap!.activity).toEqual([SERVER_2_CLEAR, SERVER_2_JOIN]);

    // t = 5000: e1 (deadline 5000) leaves the current feed; the pending branch is untouched.
    state = pruneFeedsAt(state, lifetime, 5000);
    expect(state.activity).toEqual([]);
    expect(state.pendingWorldSwap).toBe(pendingBranch);
    expect(state.pendingWorldSwap!.activity).toEqual([SERVER_2_CLEAR, SERVER_2_JOIN]);

    // t = 6000: e2 (deadline 6000) leaves the pending feed; the current feed keeps identity.
    const currentFeed = state.activity;
    state = pruneFeedsAt(state, lifetime, 6000);
    expect(state.activity).toBe(currentFeed);
    expect(state.pendingWorldSwap!.activity).toEqual([SERVER_2_CLEAR]);
    // Server 1's tombstone (until 10000) plus server 2's e2 tombstone and e3 deadline.
    expect(lifetime.size()).toBe(3);

    // t = 7000: the travel midpoint swaps to server 2; only e3 survives and keeps its 8000 deadline.
    state = swapAt(state, lifetime, 7000);
    expect(state.serverId).toBe(2);
    expect(state.pendingWorldSwap).toBeNull();
    expect(state.activity).toEqual([SERVER_2_CLEAR]);
    expect(lifetime.size()).toBe(2);
    expect(lifetime.isExpired(2, 2, 7999)).toBe(false);

    // t = 8000: e3 (deadline 8000, not re-anchored at the 7000 swap) leaves the feed.
    state = pruneFeedsAt(state, lifetime, 8000);
    expect(state.activity).toEqual([]);
    expect(lifetime.isExpired(2, 2, 8000)).toBe(true);
  });
});

describe('activity display expiry — same-server rejoin, no pending swap (AC-16)', () => {
  it('preserves the remaining lifetime of a re-seeded event and anchors a new id at its own receipt', () => {
    const lifetime = createActivityLifetime({ ttlMs: ACTIVITY_EVENT_TTL_MS });

    // t = 0: welcome on server 1 seeds e1 with a 5000 deadline.
    let state = reduceAt(createWorldState(), welcome(1, [SERVER_1_JOIN]), lifetime, 0);
    expect(state.activity).toEqual([SERVER_1_JOIN]);
    expect(lifetime.isExpired(1, 1, 4999)).toBe(false);
    expect(lifetime.isExpired(1, 1, 5000)).toBe(true);

    // t = 1000: the socket drops abruptly — no reduction, no world change. The fallback
    // prune still runs; nothing has expired.
    state = pruneFeedsAt(state, lifetime, 1000);
    expect(state.activity).toEqual([SERVER_1_JOIN]);

    // t = 4000: a same-server rejoin welcome re-seeds e1 and seeds a new id e2.
    state = reduceAt(state, welcome(1, [SERVER_1_CLEAR, SERVER_1_JOIN]), lifetime, 4000);
    expect(state.pendingWorldSwap).toBeNull();
    expect(state.activity).toEqual([SERVER_1_CLEAR, SERVER_1_JOIN]);
    // e1 keeps its 5000 deadline (not extended to 9000); e2 is anchored at 9000.
    expect(lifetime.isExpired(1, 1, 4999)).toBe(false);
    expect(lifetime.isExpired(1, 1, 5000)).toBe(true);
    expect(lifetime.isExpired(1, 2, 8999)).toBe(false);
    expect(lifetime.isExpired(1, 2, 9000)).toBe(true);

    // e1 is present at 4999 and absent at 5000.
    state = pruneFeedsAt(state, lifetime, 4999);
    expect(state.activity).toEqual([SERVER_1_CLEAR, SERVER_1_JOIN]);

    state = pruneFeedsAt(state, lifetime, 5000);
    expect(state.activity).toEqual([SERVER_1_CLEAR]);

    // e2 survives until its own 9000 deadline.
    state = pruneFeedsAt(state, lifetime, 8999);
    expect(state.activity).toEqual([SERVER_1_CLEAR]);

    state = pruneFeedsAt(state, lifetime, 9000);
    expect(state.activity).toEqual([]);
  });
});

describe('activity display expiry — tombstones and stale servers (AC-17)', () => {
  it('filters a locally expired key from a 5001 re-seed synchronously, before any tick', () => {
    const lifetime = createActivityLifetime({ ttlMs: ACTIVITY_EVENT_TTL_MS });

    // t = 0: e1 current with a 5000 deadline.
    let state = reduceAt(createWorldState(), welcome(1, [SERVER_1_JOIN]), lifetime, 0);
    expect(state.activity).toEqual([SERVER_1_JOIN]);

    // t = 5000: e1 expires and is tombstoned; the feed is empty immediately.
    state = pruneFeedsAt(state, lifetime, 5000);
    expect(state.activity).toEqual([]);
    expect(lifetime.size()).toBe(1);

    // t = 5001: a same-server welcome re-seeds e1. The synchronous prune on that
    // reduction filters it — no ACTIVITY_EXPIRY_TICK_MS tick is needed.
    state = reduceAt(state, welcome(1, [SERVER_1_JOIN]), lifetime, 5001);
    expect(state.activity).toEqual([]);

    // The feed stays empty for the rest of the tombstone window.
    state = pruneFeedsAt(state, lifetime, 6000);
    expect(state.activity).toEqual([]);

    state = reduceAt(state, welcome(1, [SERVER_1_JOIN]), lifetime, 9999);
    expect(state.activity).toEqual([]);

    // At 10000 the tombstone (observed expiry 5000 + 5000) is gone: a later seed is fresh.
    state = reduceAt(state, welcome(1, [SERVER_1_JOIN]), lifetime, 10000);
    expect(state.activity).toEqual([SERVER_1_JOIN]);
    expect(lifetime.isExpired(1, 1, 14999)).toBe(false);
    expect(lifetime.isExpired(1, 1, 15000)).toBe(true);
  });

  it('drops server 1’s tombstone on a server-2 welcome and tracks the same numeric id independently', () => {
    const lifetime = createActivityLifetime({ ttlMs: ACTIVITY_EVENT_TTL_MS });

    let state = reduceAt(createWorldState(), welcome(1, [SERVER_1_JOIN]), lifetime, 0);
    state = pruneFeedsAt(state, lifetime, 5000);
    expect(state.activity).toEqual([]);
    expect(lifetime.isExpired(1, 1, 5001)).toBe(true);

    // t = 5001: a different server replaces the current feed. Server 1's tombstone is
    // dropped; server 2's id 1 is a separate key with its own deadline (10001).
    state = reduceAt(state, welcome(2, [SERVER_2_JOIN]), lifetime, 5001);
    expect(state.serverId).toBe(2);
    expect(state.activity).toEqual([SERVER_2_JOIN]);
    expect(lifetime.size()).toBe(1);
    expect(lifetime.isExpired(1, 1, 5001)).toBe(false);
    expect(lifetime.isExpired(2, 1, 10000)).toBe(false);
    expect(lifetime.isExpired(2, 1, 10001)).toBe(true);

    // After expiry the key becomes a tombstone; one TTL later the state is empty.
    state = pruneFeedsAt(state, lifetime, 10001);
    expect(state.activity).toEqual([]);
    expect(lifetime.size()).toBe(1);

    state = pruneFeedsAt(state, lifetime, 15001);
    expect(state.activity).toEqual([]);
    expect(lifetime.size()).toBe(0);
  });
});
