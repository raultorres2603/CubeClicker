import { describe, expect, it } from 'vitest';

import type { ActivityEvent, LeaderboardSnapshot, MemberState, ServerMessage } from './protocol';
import {
  applyWorldSwap,
  createWorldState,
  pruneActivity,
  reduceWorldState,
  type WorldState,
} from './server-state';

/**
 * World/roster fixtures on server 1 (X = 10), using the exact ring positions the backend
 * emits (`worldPosition(slot, 10)`): slot 1 `(38.197186342054884, 0)`, slot 2
 * `(30.902172888029035, 22.45174281092734)`, slot 3 `(11.803579717001593, 36.32768297475154)`.
 */
const SLOT_1 = { x: 38.197186342054884, y: 0 };
const SLOT_2 = { x: 30.902172888029035, y: 22.45174281092734 };
const SLOT_3 = { x: 11.803579717001593, y: 36.32768297475154 };
const SLOT_4 = { x: -11.80357971700159, y: 36.32768297475154 };

const SELF_MEMBER: MemberState = {
  playerId: 'p1',
  name: 'Player 1',
  position: SLOT_1,
  levelIndex: 2,
  gridSize: 5,
  styleId: 'emerald-crystal',
  removedIds: ['front:0:0'],
  yawSteps: 0,
  pitchSteps: 0,
};

const P2_MEMBER: MemberState = {
  playerId: 'p2',
  name: 'Player 2',
  position: SLOT_2,
  levelIndex: 0,
  gridSize: 3,
  styleId: 'obsidian-neon',
  removedIds: [],
  yawSteps: 0,
  pitchSteps: 0,
};

const P3_MEMBER: MemberState = {
  playerId: 'p3',
  name: 'Player 3',
  position: SLOT_3,
  levelIndex: 1,
  gridSize: 4,
  styleId: 'crimson-alloy',
  removedIds: ['back:1:1'],
  yawSteps: 0,
  pitchSteps: 0,
};

/** The mover's next cube after completing on server 1 (a cross-server move). */
const MOVED_SELF_MEMBER: MemberState = {
  playerId: 'p1',
  name: 'Player 1',
  position: SLOT_2,
  levelIndex: 3,
  gridSize: 7,
  styleId: 'violet-nebula',
  removedIds: [],
  yawSteps: 0,
  pitchSteps: 0,
};

/** p2 as seen on server 2, where it holds slot 1 (the ring restarts per server). */
const P2_MEMBER_SERVER_2: MemberState = { ...P2_MEMBER, position: SLOT_1 };

/** The pinned current-server snapshot (server 1) the reducer scenes start from. */
const LEADERBOARD: LeaderboardSnapshot = {
  serverId: 1,
  at: 1000,
  entries: [
    { playerId: 'p2', name: 'Player 2', cubesCompleted: 2, clicks: 40 },
    { playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 3 },
  ],
  totals: { cubesCompleted: 2, clicks: 43, facesDestroyed: 3 },
};

/** The next current-server snapshot (a later coalesced frame). */
const LEADERBOARD_NEXT: LeaderboardSnapshot = {
  serverId: 1,
  at: 2000,
  entries: [
    { playerId: 'p2', name: 'Player 2', cubesCompleted: 2, clicks: 41 },
    { playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 3 },
  ],
  totals: { cubesCompleted: 2, clicks: 44, facesDestroyed: 3 },
};

/** The target server's snapshot carried by `worldEntered`. */
const TARGET_LEADERBOARD: LeaderboardSnapshot = {
  serverId: 2,
  at: 1200,
  entries: [{ playerId: 'p3', name: 'Player 3', cubesCompleted: 1, clicks: 10 }],
  totals: { cubesCompleted: 1, clicks: 10, facesDestroyed: 2 },
};

/** A target-server update received during travel. */
const TARGET_LEADERBOARD_NEXT: LeaderboardSnapshot = {
  serverId: 2,
  at: 2200,
  entries: [
    { playerId: 'p3', name: 'Player 3', cubesCompleted: 3, clicks: 30 },
    { playerId: 'p1', name: 'Player 1', cubesCompleted: 1, clicks: 9 },
  ],
  totals: { cubesCompleted: 4, clicks: 39, facesDestroyed: 5 },
};

const WELCOME: Extract<ServerMessage, { type: 'welcome' }> = {
  type: 'welcome',
  playerId: 'p1',
  name: 'Player 1',
  token: '0123456789abcdef0123456789abcdef',
  serverId: 1,
  maxUsers: 10,
  position: SLOT_1,
  self: {
    levelIndex: 2,
    gridSize: 5,
    styleId: 'emerald-crystal',
    removedIds: ['front:0:0'],
    yawSteps: 0,
    pitchSteps: 0,
  },
  roster: [SELF_MEMBER, P2_MEMBER, P3_MEMBER],
  identity: { kind: 'guest', playerId: 'p1' },
};

/** The mover's placement on server 2: p2 already in slot 1, the mover filling slot 2. */
const WORLD_ENTERED: Extract<ServerMessage, { type: 'worldEntered' }> = {
  type: 'worldEntered',
  playerId: 'p1',
  name: 'Player 1',
  token: '0123456789abcdef0123456789abcdef',
  serverId: 2,
  maxUsers: 10,
  position: SLOT_2,
  self: {
    levelIndex: 3,
    gridSize: 7,
    styleId: 'violet-nebula',
    removedIds: [],
    yawSteps: 0,
    pitchSteps: 0,
  },
  roster: [P2_MEMBER_SERVER_2, MOVED_SELF_MEMBER],
  identity: { kind: 'guest', playerId: 'p1' },
};

/** The world after {@link WELCOME}: self seeded, roster minus self, no pending swap. */
const SEEDED: WorldState = {
  serverId: 1,
  maxUsers: 10,
  self: {
    playerId: 'p1',
    name: 'Player 1',
    position: SLOT_1,
    cube: {
      levelIndex: 2,
      gridSize: 5,
      styleId: 'emerald-crystal',
      removedIds: ['front:0:0'],
      yawSteps: 0,
      pitchSteps: 0,
    },
    economy: { coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 },
  },
  members: [P2_MEMBER, P3_MEMBER],
  activity: [],
  leaderboard: null,
  pendingWorldSwap: null,
};

function seeded(): WorldState {
  return reduceWorldState(createWorldState(), WELCOME);
}

describe('createWorldState', () => {
  it('starts with no server, no members and no pending swap', () => {
    expect(createWorldState()).toEqual({
      serverId: 0,
      maxUsers: 0,
      self: {
        playerId: '',
        name: '',
        position: { x: 0, y: 0 },
        cube: { levelIndex: 0, gridSize: 0, styleId: '', removedIds: [], yawSteps: 0, pitchSteps: 0 },
        economy: { coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 },
      },
      members: [],
      activity: [],
      leaderboard: null,
      pendingWorldSwap: null,
    });
  });
});

describe('reduceWorldState — welcome', () => {
  it('seeds serverId, maxUsers, self and the roster minus self', () => {
    expect(seeded()).toEqual(SEEDED);
  });

  it('replaces a previous world and clears a pending swap', () => {
    const swapped = applyWorldSwap(reduceWorldState(seeded(), WORLD_ENTERED));

    expect(reduceWorldState(swapped, WELCOME)).toEqual(SEEDED);
  });
});

describe('reduceWorldState — roster', () => {
  it('appends a joined member in arrival (slot) order', () => {
    const joined = reduceWorldState(seeded(), { type: 'memberJoined', member: P3_MEMBER });

    expect(joined.members).toEqual([P2_MEMBER, P3_MEMBER]);
  });

  it('appends a member that takes the next slot without reordering the existing ones', () => {
    const p4: MemberState = { ...P3_MEMBER, playerId: 'p4', name: 'Player 4', position: SLOT_4 };
    const state = reduceWorldState(seeded(), { type: 'memberJoined', member: p4 });

    expect(state.members).toEqual([P2_MEMBER, P3_MEMBER, p4]);
  });

  it('inserts a member that fills a hole ahead of later slots (T1b slot order)', () => {
    const withHole = reduceWorldState(createWorldState(), {
      type: 'welcome',
      playerId: 'p1',
      name: 'Player 1',
      token: '0123456789abcdef0123456789abcdef',
      serverId: 1,
      maxUsers: 10,
      position: SLOT_1,
      self: SELF_MEMBER,
      roster: [SELF_MEMBER, P3_MEMBER],
      identity: { kind: 'guest', playerId: 'p1' },
    });
    const p4: MemberState = { ...P3_MEMBER, playerId: 'p4', name: 'Player 4', position: SLOT_2 };

    const joined = reduceWorldState(withHole, { type: 'memberJoined', member: p4 });

    expect(joined.members).toEqual([p4, P3_MEMBER]);
  });

  it('replaces an already-known member in place instead of duplicating it', () => {
    const renamed: MemberState = { ...P2_MEMBER, levelIndex: 4, gridSize: 7, styleId: 'solar-gold' };
    const state = reduceWorldState(seeded(), { type: 'memberJoined', member: renamed });

    expect(state.members).toEqual([renamed, P3_MEMBER]);
  });

  it('ignores a memberJoined for the own identity', () => {
    const state = seeded();

    expect(reduceWorldState(state, { type: 'memberJoined', member: SELF_MEMBER })).toBe(state);
  });

  it('removes a left member and preserves the remaining order', () => {
    const state = reduceWorldState(seeded(), {
      type: 'memberLeft',
      playerId: 'p2',
      reason: 'left',
    });

    expect(state.members).toEqual([P3_MEMBER]);
  });

  it('removes a moved member', () => {
    const state = reduceWorldState(seeded(), {
      type: 'memberLeft',
      playerId: 'p3',
      reason: 'moved',
    });

    expect(state.members).toEqual([P2_MEMBER]);
  });

  it('returns the same state for an unknown member', () => {
    const state = seeded();

    expect(reduceWorldState(state, { type: 'memberLeft', playerId: 'p9', reason: 'left' })).toBe(
      state,
    );
  });
});

describe('reduceWorldState — miniCubeRemoved', () => {
  it('adds the removed tile to that member’s board', () => {
    const state = reduceWorldState(seeded(), {
      type: 'miniCubeRemoved',
      playerId: 'p2',
      id: 'front:1:2',
    });

    expect(state.members[0].removedIds).toEqual(['front:1:2']);
    expect(state.members[1].removedIds).toEqual(['back:1:1']);
  });

  it('adds the removed tile to the own board without touching the roster', () => {
    const state = seeded();
    const next = reduceWorldState(state, {
      type: 'miniCubeRemoved',
      playerId: 'p1',
      id: 'top:4:4',
    });

    expect(next.self.cube.removedIds).toEqual(['front:0:0', 'top:4:4']);
    expect(next.members).toBe(state.members);
  });

  it('is a no-op for a tile that is already removed (the server ack)', () => {
    const state = seeded();

    expect(
      reduceWorldState(state, { type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' }),
    ).toBe(state);
  });

  it('is a no-op for a duplicate tile on a remote member', () => {
    const state = reduceWorldState(seeded(), {
      type: 'miniCubeRemoved',
      playerId: 'p3',
      id: 'back:1:1',
    });

    expect(reduceWorldState(state, { type: 'miniCubeRemoved', playerId: 'p3', id: 'back:1:1' })).toBe(
      state,
    );
  });

  it('is a no-op for an unknown member', () => {
    const state = seeded();

    expect(
      reduceWorldState(state, { type: 'miniCubeRemoved', playerId: 'p9', id: 'front:0:0' }),
    ).toBe(state);
  });
});

describe('reduceWorldState — miniCubesRemoved', () => {
  it('applies every id of a self batch in acceptance order without touching the roster', () => {
    const state = seeded();
    const next = reduceWorldState(state, {
      type: 'miniCubesRemoved',
      playerId: 'p1',
      ids: ['back:0:0', 'top:4:4'],
    });

    expect(next.self.cube.removedIds).toEqual(['front:0:0', 'back:0:0', 'top:4:4']);
    expect(next.members).toBe(state.members);
  });

  it('applies every id of a remote batch in acceptance order and keeps the untouched branches', () => {
    const state = seeded();
    const next = reduceWorldState(state, {
      type: 'miniCubesRemoved',
      playerId: 'p2',
      ids: ['front:0:0', 'front:0:1'],
    });

    expect(next.members[0].removedIds).toEqual(['front:0:0', 'front:0:1']);
    expect(next.members[1]).toBe(state.members[1]);
    expect(next.self).toBe(state.self);
  });

  it('adds only the new ids of a mixed batch', () => {
    const state = seeded();
    const next = reduceWorldState(state, {
      type: 'miniCubesRemoved',
      playerId: 'p3',
      ids: ['back:1:1', 'front:2:2'],
    });

    expect(next.members[1].removedIds).toEqual(['back:1:1', 'front:2:2']);
  });

  it('is idempotent for duplicate ids inside one batch', () => {
    const state = seeded();
    const next = reduceWorldState(state, {
      type: 'miniCubesRemoved',
      playerId: 'p2',
      ids: ['front:0:0', 'front:0:0'],
    });

    expect(next.members[0].removedIds).toEqual(['front:0:0']);
  });

  it('returns the same state when every id is already present', () => {
    const state = seeded();

    expect(
      reduceWorldState(state, {
        type: 'miniCubesRemoved',
        playerId: 'p3',
        ids: ['back:1:1'],
      }),
    ).toBe(state);
  });

  it('is a no-op for an unknown member', () => {
    const state = seeded();

    expect(
      reduceWorldState(state, {
        type: 'miniCubesRemoved',
        playerId: 'p9',
        ids: ['front:0:0', 'front:0:1'],
      }),
    ).toBe(state);
  });
});

describe('reduceWorldState — levelAdvanced', () => {
  it('replaces a remote member’s cube and position with a fresh board', () => {
    const state = reduceWorldState(seeded(), {
      type: 'levelAdvanced',
      playerId: 'p2',
      levelIndex: 1,
      gridSize: 6,
      styleId: 'solar-gold',
      position: SLOT_3,
      removedIds: [],
    });

    expect(state.members[0]).toEqual({
      playerId: 'p2',
      name: 'Player 2',
      position: SLOT_3,
      levelIndex: 1,
      gridSize: 6,
      styleId: 'solar-gold',
      removedIds: [],
      yawSteps: 0,
      pitchSteps: 0,
    });
    expect(state.members[1]).toEqual(P3_MEMBER);
  });

  it('replaces the own cube and position and keeps the roster identity', () => {
    const state = seeded();
    const next = reduceWorldState(state, {
      type: 'levelAdvanced',
      playerId: 'p1',
      levelIndex: 3,
      gridSize: 7,
      styleId: 'violet-nebula',
      position: SLOT_3,
      removedIds: [],
    });

    expect(next.self).toEqual({
      playerId: 'p1',
      name: 'Player 1',
      position: SLOT_3,
      cube: { levelIndex: 3, gridSize: 7, styleId: 'violet-nebula', removedIds: [], yawSteps: 0, pitchSteps: 0 },
      economy: { coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 },
    });
    expect(next.members).toBe(state.members);
  });

  it('is a no-op for an unknown member', () => {
    const state = seeded();

    expect(
      reduceWorldState(state, {
        type: 'levelAdvanced',
        playerId: 'p9',
        levelIndex: 1,
        gridSize: 3,
        styleId: 'obsidian-neon',
        position: SLOT_3,
        removedIds: [],
      }),
    ).toBe(state);
  });
});

describe('reduceWorldState — stateSync', () => {
  it('replaces a remote member’s board with the authoritative removed set', () => {
    const state = reduceWorldState(seeded(), {
      type: 'stateSync',
      playerId: 'p2',
      levelIndex: 2,
      gridSize: 4,
      styleId: 'crimson-alloy',
      removedIds: ['front:0:0', 'front:0:1', 'left:3:3'],
      yawSteps: 0,
      pitchSteps: 0,
    });

    expect(state.members[0]).toEqual({
      playerId: 'p2',
      name: 'Player 2',
      position: SLOT_2,
      levelIndex: 2,
      gridSize: 4,
      styleId: 'crimson-alloy',
      removedIds: ['front:0:0', 'front:0:1', 'left:3:3'],
      yawSteps: 0,
      pitchSteps: 0,
    });
  });

  it('replaces the own board with the authoritative removed set', () => {
    const state = reduceWorldState(seeded(), {
      type: 'stateSync',
      playerId: 'p1',
      levelIndex: 2,
      gridSize: 5,
      styleId: 'emerald-crystal',
      removedIds: ['front:0:0', 'front:0:1'],
      yawSteps: 0,
      pitchSteps: 0,
    });

    expect(state.self.cube.removedIds).toEqual(['front:0:0', 'front:0:1']);
  });

  it('is a no-op for an unknown member', () => {
    const state = seeded();

    expect(
      reduceWorldState(state, {
        type: 'stateSync',
        playerId: 'p9',
        levelIndex: 1,
        gridSize: 3,
        styleId: 'obsidian-neon',
        removedIds: [],
        yawSteps: 0,
        pitchSteps: 0,
      }),
    ).toBe(state);
  });
});

describe('reduceWorldState — messages without world state', () => {
  it('returns the same state for hello', () => {
    const state = seeded();

    expect(
      reduceWorldState(state, { type: 'hello', serverTime: '2026-10-21T12:34:56.789Z' }),
    ).toBe(state);
  });

  it('returns the same state for error', () => {
    const state = seeded();

    expect(reduceWorldState(state, { type: 'error', code: 'rate_limited' })).toBe(state);
  });
});

describe('reduceWorldState — referential stability', () => {
  it('keeps the same top-level reference when nothing changed', () => {
    const state = seeded();
    const next = reduceWorldState(state, { type: 'miniCubeRemoved', playerId: 'p9', id: 'top:0:0' });

    expect(next).toBe(state);
  });

  it('returns a new top-level reference for a real change', () => {
    const state = seeded();
    const next = reduceWorldState(state, {
      type: 'miniCubeRemoved',
      playerId: 'p2',
      id: 'front:0:0',
    });

    expect(next).not.toBe(state);
    expect(next.self).toBe(state.self);
    expect(next.members).not.toBe(state.members);
    expect(next.members[1]).toBe(state.members[1]);
  });

  it('keeps the roster array identity when only the own cube changed', () => {
    const state = seeded();
    const next = reduceWorldState(state, {
      type: 'miniCubeRemoved',
      playerId: 'p1',
      id: 'back:0:0',
    });

    expect(next.members).toBe(state.members);
    expect(next.self).not.toBe(state.self);
    expect(next.self.cube.removedIds).toEqual(['front:0:0', 'back:0:0']);
  });
});

describe('worldEntered and applyWorldSwap (AC-12)', () => {
  it('records the pending swap without touching the current world', () => {
    const state = seeded();
    const pending = reduceWorldState(state, WORLD_ENTERED);

    expect(pending.pendingWorldSwap).toEqual({
      serverId: 2,
      maxUsers: 10,
      position: SLOT_2,
      self: { levelIndex: 3, gridSize: 7, styleId: 'violet-nebula', removedIds: [], yawSteps: 0, pitchSteps: 0 },
      roster: [P2_MEMBER_SERVER_2, MOVED_SELF_MEMBER],
      activity: [],
      leaderboard: null,
      economy: { coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 },
    });
    expect(pending.serverId).toBe(1);
    expect(pending.self).toBe(state.self);
    expect(pending.members).toBe(state.members);
  });

  it('returns the same state when there is nothing to swap', () => {
    const state = seeded();

    expect(applyWorldSwap(state)).toBe(state);
  });

  it('reduces the AC-12 move sequence (memberLeft moved → worldEntered → swap) to the target world', () => {
    const moved = reduceWorldState(seeded(), {
      type: 'memberLeft',
      playerId: 'p3',
      reason: 'moved',
    });
    const pending = reduceWorldState(moved, WORLD_ENTERED);
    const target = applyWorldSwap(pending);

    expect(target).toEqual({
      serverId: 2,
      maxUsers: 10,
      self: {
        playerId: 'p1',
        name: 'Player 1',
        position: SLOT_2,
        cube: { levelIndex: 3, gridSize: 7, styleId: 'violet-nebula', removedIds: [], yawSteps: 0, pitchSteps: 0 },
        economy: { coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 },
      },
      members: [P2_MEMBER_SERVER_2],
      activity: [],
      leaderboard: null,
      pendingWorldSwap: null,
    });
    // The swap is consumed exactly once: a second call is a no-op.
    expect(applyWorldSwap(target)).toBe(target);
  });

  it('removes the mover from the old server’s world on memberLeft (moved)', () => {
    const before = seeded();
    const after = reduceWorldState(before, {
      type: 'memberLeft',
      playerId: 'p2',
      reason: 'moved',
    });

    expect(before.members).toEqual([P2_MEMBER, P3_MEMBER]);
    expect(after.members).toEqual([P3_MEMBER]);
    expect(after.serverId).toBe(1);
    expect(after.pendingWorldSwap).toBeNull();
  });
});

describe('reduceWorldState — activity feed (AC-16, AC-17, AC-23)', () => {
  const JOIN_EVENT: ActivityEvent = {
    id: 1,
    at: 1000,
    serverId: 1,
    type: 'memberJoined',
    playerId: 'p2',
    name: 'Player 2',
  };

  const CLEARED_EVENT: ActivityEvent = {
    id: 2,
    at: 2000,
    serverId: 1,
    type: 'cubeCleared',
    playerId: 'p2',
    name: 'Player 2',
    level: 3,
  };

  const FAST_EVENT: ActivityEvent = {
    id: 3,
    at: 3000,
    serverId: 1,
    type: 'fastClear',
    playerId: 'p2',
    name: 'Player 2',
    level: 4,
    elapsedMs: 2500,
  };

  const TARGET_JOIN_EVENT: ActivityEvent = {
    id: 1,
    at: 4000,
    serverId: 2,
    type: 'memberJoined',
    playerId: 'p3',
    name: 'Player 3',
  };

  const TARGET_CLEARED_EVENT: ActivityEvent = {
    id: 2,
    at: 5000,
    serverId: 2,
    type: 'cubeCleared',
    playerId: 'p3',
    name: 'Player 3',
    level: 5,
  };

  it('welcome seeds a copied, newest-first feed and clears any pending swap', () => {
    const activity = [{ ...CLEARED_EVENT }, { ...JOIN_EVENT }];
    const state = reduceWorldState(createWorldState(), { ...WELCOME, activity });

    expect(state.activity).toEqual([CLEARED_EVENT, JOIN_EVENT]);
    expect(state.activity).not.toBe(activity);
    expect(state.activity[0]).not.toBe(activity[0]);
    expect(state.pendingWorldSwap).toBeNull();
  });

  it('welcome replaces a previous feed and an absent ring becomes an empty feed', () => {
    const withFeed = reduceWorldState(seeded(), { type: 'activityEvent', event: FAST_EVENT });
    expect(withFeed.activity).toEqual([FAST_EVENT]);

    expect(reduceWorldState(withFeed, WELCOME).activity).toEqual([]);
    expect(
      reduceWorldState(withFeed, { ...WELCOME, activity: [JOIN_EVENT] }).activity,
    ).toEqual([JOIN_EVENT]);
  });

  it('prepends a copied event to the current feed and keeps self/members identity', () => {
    const state = seeded();
    const next = reduceWorldState(state, { type: 'activityEvent', event: CLEARED_EVENT });

    expect(next.activity).toEqual([CLEARED_EVENT]);
    expect(next.activity[0]).not.toBe(CLEARED_EVENT);
    expect(next.self).toBe(state.self);
    expect(next.members).toBe(state.members);

    const older = reduceWorldState(next, { type: 'activityEvent', event: JOIN_EVENT });
    expect(older.activity).toEqual([JOIN_EVENT, CLEARED_EVENT]);
    expect(older.activity[1]).toBe(next.activity[0]);
  });

  it('copies the event so a later caller mutation cannot leak into the feed', () => {
    const source: ActivityEvent = { ...CLEARED_EVENT };
    const state = reduceWorldState(seeded(), { type: 'activityEvent', event: source });

    source.name = 'Mallory';
    source.level = 9;
    expect(state.activity).toEqual([CLEARED_EVENT]);
  });

  it('trims the current feed to the 20 newest events', () => {
    let state = seeded();
    for (let id = 1; id <= 21; id += 1) {
      state = reduceWorldState(state, {
        type: 'activityEvent',
        event: { id, at: id * 1000, serverId: 1, type: 'cubeCleared', playerId: 'p2', name: 'Player 2', level: id },
      });
    }

    expect(state.activity).toHaveLength(20);
    expect(state.activity.map((event) => event.id)).toEqual([
      21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2,
    ]);
  });

  it('ignores a duplicate id against the destination feed', () => {
    const state = reduceWorldState(seeded(), { type: 'activityEvent', event: CLEARED_EVENT });

    expect(
      reduceWorldState(state, { type: 'activityEvent', event: { ...CLEARED_EVENT, at: 9000 } }),
    ).toBe(state);
    expect(
      reduceWorldState(state, { type: 'activityEvent', event: { ...JOIN_EVENT, id: CLEARED_EVENT.id } }),
    ).toBe(state);
  });

  it('ignores an event whose serverId matches neither the current nor the pending server', () => {
    const state = seeded();

    expect(
      reduceWorldState(state, { type: 'activityEvent', event: { ...CLEARED_EVENT, serverId: 99 } }),
    ).toBe(state);

    const travelling = reduceWorldState(state, { ...WORLD_ENTERED, activity: [TARGET_JOIN_EVENT] });
    expect(
      reduceWorldState(travelling, { type: 'activityEvent', event: { ...CLEARED_EVENT, serverId: 99 } }),
    ).toBe(travelling);
  });

  it('worldEntered stores the target ring in the pending swap without changing the feed', () => {
    const state = reduceWorldState(seeded(), { type: 'activityEvent', event: CLEARED_EVENT });
    const feed = state.activity;
    const activity = [{ ...TARGET_CLEARED_EVENT }, { ...TARGET_JOIN_EVENT }];
    const travelling = reduceWorldState(state, { ...WORLD_ENTERED, activity });

    expect(travelling.activity).toBe(feed);
    expect(travelling.pendingWorldSwap!.activity).toEqual([TARGET_CLEARED_EVENT, TARGET_JOIN_EVENT]);
    expect(travelling.pendingWorldSwap!.activity).not.toBe(activity);
    expect(travelling.pendingWorldSwap!.activity[0]).not.toBe(activity[0]);
  });

  it('routes a target-server event into the pending feed and leaves the feed untouched', () => {
    const state = reduceWorldState(seeded(), { ...WORLD_ENTERED, activity: [TARGET_JOIN_EVENT] });
    const feed = state.activity;
    const next = reduceWorldState(state, { type: 'activityEvent', event: TARGET_CLEARED_EVENT });

    expect(next.activity).toBe(feed);
    expect(next.pendingWorldSwap!.activity).toEqual([TARGET_CLEARED_EVENT, TARGET_JOIN_EVENT]);
    expect(next.self).toBe(state.self);
    expect(next.members).toBe(state.members);
  });

  it('applies a target event received between worldEntered and applyWorldSwap at the swap', () => {
    const travelling = reduceWorldState(seeded(), { ...WORLD_ENTERED, activity: [TARGET_JOIN_EVENT] });
    const updated = reduceWorldState(travelling, { type: 'activityEvent', event: TARGET_CLEARED_EVENT });
    const swapped = applyWorldSwap(updated);

    expect(swapped.serverId).toBe(2);
    expect(swapped.activity).toEqual([TARGET_CLEARED_EVENT, TARGET_JOIN_EVENT]);
    expect(swapped.pendingWorldSwap).toBeNull();
  });

  it('never folds an old-server event into the pending feed during travel', () => {
    const travelling = reduceWorldState(seeded(), { ...WORLD_ENTERED, activity: [TARGET_JOIN_EVENT] });
    const withOld = reduceWorldState(travelling, { type: 'activityEvent', event: CLEARED_EVENT });

    expect(withOld.activity).toEqual([CLEARED_EVENT]);
    expect(withOld.pendingWorldSwap!.activity).toEqual([TARGET_JOIN_EVENT]);

    const swapped = applyWorldSwap(withOld);
    expect(swapped.activity).toEqual([TARGET_JOIN_EVENT]);
  });

  it('checks duplicate ids against the pending destination independently of the feed', () => {
    const travelling = reduceWorldState(seeded(), { ...WORLD_ENTERED, activity: [TARGET_JOIN_EVENT] });

    expect(
      reduceWorldState(travelling, { type: 'activityEvent', event: { ...TARGET_JOIN_EVENT, at: 9000 } }),
    ).toBe(travelling);

    const next = reduceWorldState(travelling, { type: 'activityEvent', event: { ...CLEARED_EVENT, id: 1 } });
    expect(next.activity.map((event) => event.id)).toEqual([1]);
    expect(next.pendingWorldSwap!.activity.map((event) => event.id)).toEqual([1]);
  });

  it('trims the pending feed to the 20 newest target events', () => {
    let state = reduceWorldState(seeded(), WORLD_ENTERED);
    for (let id = 1; id <= 21; id += 1) {
      state = reduceWorldState(state, {
        type: 'activityEvent',
        event: { id, at: id * 1000, serverId: 2, type: 'cubeCleared', playerId: 'p3', name: 'Player 3', level: id },
      });
    }

    expect(state.activity).toEqual([]);
    expect(state.pendingWorldSwap!.activity).toHaveLength(20);
    expect(state.pendingWorldSwap!.activity.map((event) => event.id)).toEqual([
      21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2,
    ]);
  });
});

describe('pruneActivity (AC-15, AC-18)', () => {
  // Both feeds carry the ids 7 and 8: per-server ids restart at 1, so the helper must key
  // each feed by its own server id and never let a collision cross the feeds.
  const CURRENT_EVENT: ActivityEvent = {
    id: 7,
    at: 1000,
    serverId: 1,
    type: 'memberJoined',
    playerId: 'p2',
    name: 'Player 2',
  };
  const CURRENT_NEXT_EVENT: ActivityEvent = {
    id: 8,
    at: 2000,
    serverId: 1,
    type: 'memberJoined',
    playerId: 'p3',
    name: 'Player 3',
  };
  const PENDING_EVENT: ActivityEvent = {
    id: 7,
    at: 3000,
    serverId: 2,
    type: 'memberJoined',
    playerId: 'p4',
    name: 'Player 4',
  };
  const PENDING_NEXT_EVENT: ActivityEvent = {
    id: 8,
    at: 4000,
    serverId: 2,
    type: 'memberJoined',
    playerId: 'p5',
    name: 'Player 5',
  };

  /** Current feed `[8, 7]` on server 1 plus a pending server-2 feed `[8, 7]`. */
  function travelling(): WorldState {
    const withFeed = reduceWorldState(seeded(), {
      ...WELCOME,
      activity: [CURRENT_NEXT_EVENT, CURRENT_EVENT],
    });
    return reduceWorldState(withFeed, {
      ...WORLD_ENTERED,
      activity: [PENDING_NEXT_EVENT, PENDING_EVENT],
    });
  }

  it('returns the same state when nothing expired', () => {
    const state = travelling();

    expect(pruneActivity(state, () => false)).toBe(state);
  });

  it('filters a current-feed event and preserves the pending branch identity', () => {
    const state = travelling();
    const pending = state.pendingWorldSwap;
    const pruned = pruneActivity(
      state,
      (serverId, eventId) => serverId === 1 && eventId === CURRENT_EVENT.id,
    );

    expect(pruned).not.toBe(state);
    expect(pruned.activity).toEqual([CURRENT_NEXT_EVENT]);
    expect(pruned.activity[0]).toBe(state.activity[0]);
    expect(pruned.pendingWorldSwap).toBe(pending);
    expect(pruned.self).toBe(state.self);
    expect(pruned.members).toBe(state.members);
    expect(pruned.leaderboard).toBe(state.leaderboard);
    // The input state is never mutated in place.
    expect(state.activity).toEqual([CURRENT_NEXT_EVENT, CURRENT_EVENT]);
  });

  it('filters a pending-feed event and preserves the current feed identity', () => {
    const state = travelling();
    const pending = state.pendingWorldSwap!;
    const pruned = pruneActivity(
      state,
      (serverId, eventId) => serverId === 2 && eventId === PENDING_EVENT.id,
    );

    expect(pruned).not.toBe(state);
    expect(pruned.activity).toBe(state.activity);
    expect(pruned.pendingWorldSwap).not.toBe(pending);
    expect(pruned.pendingWorldSwap!.activity).toEqual([PENDING_NEXT_EVENT]);
    expect(pruned.pendingWorldSwap!.activity[0]).toBe(pending.activity[0]);
    expect(pruned.pendingWorldSwap!.roster).toBe(pending.roster);
    expect(pruned.pendingWorldSwap!.self).toBe(pending.self);
    expect(pruned.pendingWorldSwap!.leaderboard).toBe(pending.leaderboard);
  });

  it('filters both feeds and keeps every untouched branch', () => {
    const state = travelling();
    const pending = state.pendingWorldSwap!;
    const pruned = pruneActivity(state, () => true);

    expect(pruned).not.toBe(state);
    expect(pruned.activity).toEqual([]);
    expect(pruned.pendingWorldSwap!.activity).toEqual([]);
    expect(pruned.pendingWorldSwap!.roster).toBe(pending.roster);
    expect(pruned.pendingWorldSwap!.self).toBe(pending.self);
    expect(pruned.serverId).toBe(state.serverId);
    expect(pruned.members).toBe(state.members);
  });

  it('applies the predicate to each feed’s own server id, so colliding ids expire independently', () => {
    const state = travelling();
    const pruned = pruneActivity(
      state,
      (serverId, eventId) =>
        (serverId === 1 && eventId === 7) || (serverId === 2 && eventId === 8),
    );

    expect(pruned.activity.map((event) => event.id)).toEqual([8]);
    expect(pruned.pendingWorldSwap!.activity.map((event) => event.id)).toEqual([7]);
  });

  it('prunes a current feed with no pending swap', () => {
    const state = reduceWorldState(seeded(), { type: 'activityEvent', event: CURRENT_EVENT });
    expect(pruneActivity(state, () => false)).toBe(state);

    const pruned = pruneActivity(
      state,
      (serverId, eventId) => serverId === 1 && eventId === CURRENT_EVENT.id,
    );
    expect(pruned).not.toBe(state);
    expect(pruned.activity).toEqual([]);
    expect(pruned.pendingWorldSwap).toBeNull();
  });

  it('returns the same state for an empty feed (no publish on a no-op)', () => {
    const state = seeded();

    expect(pruneActivity(state, () => true)).toBe(state);
  });
});

describe('reduceWorldState — cubeRotated', () => {
  it('updates a remote member’s orientation', () => {
    const state = reduceWorldState(seeded(), {
      type: 'cubeRotated',
      playerId: 'p2',
      yawSteps: 2,
      pitchSteps: 1,
    });

    expect(state.members[0].yawSteps).toBe(2);
    expect(state.members[0].pitchSteps).toBe(1);
    expect(state.members[1].yawSteps).toBe(0);
  });

  it('updates the own cube orientation defensively', () => {
    const state = seeded();
    const next = reduceWorldState(state, {
      type: 'cubeRotated',
      playerId: 'p1',
      yawSteps: 3,
      pitchSteps: -1,
    });

    expect(next.self.cube.yawSteps).toBe(3);
    expect(next.self.cube.pitchSteps).toBe(-1);
    expect(next.members).toBe(state.members);
  });

  it('is a no-op for an unknown member', () => {
    const state = seeded();

    expect(reduceWorldState(state, { type: 'cubeRotated', playerId: 'p9', yawSteps: 1, pitchSteps: 0 })).toBe(
      state,
    );
  });

  it('is a no-op when the orientation is unchanged', () => {
    const state = seeded();

    expect(
      reduceWorldState(state, { type: 'cubeRotated', playerId: 'p2', yawSteps: 0, pitchSteps: 0 }),
    ).toBe(state);
  });
});

describe('reduceWorldState — orientation sync', () => {
  it('stores orientation from welcome', () => {
    const welcome: ServerMessage = {
      type: 'welcome',
      playerId: 'p1',
      name: 'Player 1',
      token: '0123456789abcdef0123456789abcdef',
      serverId: 1,
      maxUsers: 10,
      position: SLOT_1,
      self: { levelIndex: 2, gridSize: 5, styleId: 'emerald-crystal', removedIds: ['front:0:0'], yawSteps: 1, pitchSteps: 1 },
      roster: [
        { ...SELF_MEMBER, yawSteps: 1, pitchSteps: 1 },
        { ...P2_MEMBER, yawSteps: 2, pitchSteps: -1 },
      ],
      identity: { kind: 'guest', playerId: 'p1' },
    };
    const state = reduceWorldState(createWorldState(), welcome);

    expect(state.self.cube.yawSteps).toBe(1);
    expect(state.self.cube.pitchSteps).toBe(1);
    expect(state.members[0].yawSteps).toBe(2);
    expect(state.members[0].pitchSteps).toBe(-1);
  });

  it('stores orientation from memberJoined', () => {
    const state = reduceWorldState(seeded(), {
      type: 'memberJoined',
      member: { ...P2_MEMBER, yawSteps: 3, pitchSteps: 1 },
    });

    expect(state.members[0].yawSteps).toBe(3);
    expect(state.members[0].pitchSteps).toBe(1);
  });

  it('adopts orientation from stateSync for self', () => {
    const state = reduceWorldState(seeded(), {
      type: 'stateSync',
      playerId: 'p1',
      levelIndex: 2,
      gridSize: 5,
      styleId: 'emerald-crystal',
      removedIds: ['front:0:0'],
      yawSteps: 2,
      pitchSteps: -1,
    });

    expect(state.self.cube.yawSteps).toBe(2);
    expect(state.self.cube.pitchSteps).toBe(-1);
  });

  it('adopts orientation from stateSync for a member', () => {
    const state = reduceWorldState(seeded(), {
      type: 'stateSync',
      playerId: 'p2',
      levelIndex: 0,
      gridSize: 3,
      styleId: 'obsidian-neon',
      removedIds: [],
      yawSteps: 3,
      pitchSteps: 1,
    });

    expect(state.members[0].yawSteps).toBe(3);
    expect(state.members[0].pitchSteps).toBe(1);
  });

  it('resets orientation to identity on levelAdvanced', () => {
    const rotated = reduceWorldState(seeded(), {
      type: 'cubeRotated',
      playerId: 'p2',
      yawSteps: 2,
      pitchSteps: 1,
    });
    const advanced = reduceWorldState(rotated, {
      type: 'levelAdvanced',
      playerId: 'p2',
      levelIndex: 1,
      gridSize: 6,
      styleId: 'solar-gold',
      position: SLOT_3,
      removedIds: [],
    });

    expect(advanced.members[0].yawSteps).toBe(0);
    expect(advanced.members[0].pitchSteps).toBe(0);
  });
});

describe('reduceWorldState — economy (T8)', () => {
  const ECO_A = { coins: 1.25, clicks: 3, facesDestroyed: 2, cubesDestroyed: 1 };
  const ECO_B = { coins: 4.5, clicks: 7, facesDestroyed: 5, cubesDestroyed: 2 };

  it('welcome adopts msg.economy into self.economy', () => {
    const welcome: ServerMessage = {
      type: 'welcome',
      playerId: 'p1',
      name: 'Player 1',
      token: '0123456789abcdef0123456789abcdef',
      serverId: 1,
      maxUsers: 10,
      position: SLOT_1,
      self: { levelIndex: 2, gridSize: 5, styleId: 'emerald-crystal', removedIds: ['front:0:0'], yawSteps: 0, pitchSteps: 0 },
      roster: [SELF_MEMBER],
      identity: { kind: 'guest', playerId: 'p1' },
      economy: ECO_A,
    };
    const state = reduceWorldState(createWorldState(), welcome);
    expect(state.self.economy).toEqual(ECO_A);
    expect(state.self.economy).not.toBe(ECO_A);
  });

  it('welcome defaults to zeros when economy is absent', () => {
    const state = seeded();
    expect(state.self.economy).toEqual({ coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 });
  });

  it('worldEntered stores msg.economy in pendingWorldSwap.economy and sets self.economy immediately', () => {
    const state = seeded();
    const entered: ServerMessage = {
      type: 'worldEntered',
      playerId: 'p1',
      name: 'Player 1',
      token: '0123456789abcdef0123456789abcdef',
      serverId: 2,
      maxUsers: 10,
      position: SLOT_2,
      self: { levelIndex: 3, gridSize: 7, styleId: 'violet-nebula', removedIds: [], yawSteps: 0, pitchSteps: 0 },
      roster: [P2_MEMBER_SERVER_2, MOVED_SELF_MEMBER],
      identity: { kind: 'guest', playerId: 'p1' },
      economy: ECO_B,
    };
    const next = reduceWorldState(state, entered);
    expect(next.pendingWorldSwap).not.toBeNull();
    expect(next.pendingWorldSwap!.economy).toEqual(ECO_B);
    expect(next.self.economy).toEqual(ECO_B);
  });

  it('economyUpdate replaces self.economy with a new reference', () => {
    const state = reduceWorldState(createWorldState(), {
      type: 'welcome',
      playerId: 'p1',
      name: 'Player 1',
      token: '0123456789abcdef0123456789abcdef',
      serverId: 1,
      maxUsers: 10,
      position: SLOT_1,
      self: { levelIndex: 2, gridSize: 5, styleId: 'emerald-crystal', removedIds: ['front:0:0'], yawSteps: 0, pitchSteps: 0 },
      roster: [SELF_MEMBER],
      identity: { kind: 'guest', playerId: 'p1' },
      economy: ECO_A,
    });
    const next = reduceWorldState(state, {
      type: 'economyUpdate',
      coins: ECO_B.coins,
      clicks: ECO_B.clicks,
      facesDestroyed: ECO_B.facesDestroyed,
      cubesDestroyed: ECO_B.cubesDestroyed,
    });
    expect(next).not.toBe(state);
    expect(next.self).not.toBe(state.self);
    expect(next.self.economy).not.toBe(state.self.economy);
    expect(next.self.economy).toEqual(ECO_B);
  });

  it('economyUpdate with identical values returns the same state', () => {
    const state = reduceWorldState(createWorldState(), {
      type: 'welcome',
      playerId: 'p1',
      name: 'Player 1',
      token: '0123456789abcdef0123456789abcdef',
      serverId: 1,
      maxUsers: 10,
      position: SLOT_1,
      self: { levelIndex: 2, gridSize: 5, styleId: 'emerald-crystal', removedIds: ['front:0:0'], yawSteps: 0, pitchSteps: 0 },
      roster: [SELF_MEMBER],
      identity: { kind: 'guest', playerId: 'p1' },
      economy: ECO_A,
    });
    const same = reduceWorldState(state, {
      type: 'economyUpdate',
      coins: ECO_A.coins,
      clicks: ECO_A.clicks,
      facesDestroyed: ECO_A.facesDestroyed,
      cubesDestroyed: ECO_A.cubesDestroyed,
    });
    expect(same).toBe(state);
  });

  it('applyWorldSwap carries pending.economy into self.economy', () => {
    const state = seeded();
    const entered: ServerMessage = {
      type: 'worldEntered',
      playerId: 'p1',
      name: 'Player 1',
      token: '0123456789abcdef0123456789abcdef',
      serverId: 2,
      maxUsers: 10,
      position: SLOT_2,
      self: { levelIndex: 3, gridSize: 7, styleId: 'violet-nebula', removedIds: [], yawSteps: 0, pitchSteps: 0 },
      roster: [P2_MEMBER_SERVER_2, MOVED_SELF_MEMBER],
      identity: { kind: 'guest', playerId: 'p1' },
      economy: ECO_B,
    };
    const pending = reduceWorldState(state, entered);
    const swapped = applyWorldSwap(pending);
    expect(swapped.self.economy).toEqual(ECO_B);
    expect(swapped.pendingWorldSwap).toBeNull();
  });
});

describe('reduceWorldState — leaderboard (AC-17, AC-18)', () => {
  function withLeaderboard(snapshot: LeaderboardSnapshot = LEADERBOARD): WorldState {
    return reduceWorldState(createWorldState(), { ...WELCOME, leaderboard: snapshot });
  }

  it('welcome seeds the current snapshot as a deep copy', () => {
    const source: LeaderboardSnapshot = {
      ...LEADERBOARD,
      entries: LEADERBOARD.entries.map((entry) => ({ ...entry })),
      totals: { ...LEADERBOARD.totals },
    };
    const state = withLeaderboard(source);

    expect(state.leaderboard).toEqual(LEADERBOARD);
    expect(state.leaderboard).not.toBe(source);
    expect(state.leaderboard!.entries).not.toBe(source.entries);
    expect(state.leaderboard!.entries[0]).not.toBe(source.entries[0]);
    expect(state.leaderboard!.totals).not.toBe(source.totals);

    source.entries[0]!.clicks = 999;
    source.totals.cubesCompleted = 999;
    expect(state.leaderboard).toEqual(LEADERBOARD);
  });

  it('welcome replaces a previous snapshot and an absent field resets to null', () => {
    const current = withLeaderboard();
    const replaced = reduceWorldState(current, { ...WELCOME, leaderboard: LEADERBOARD_NEXT });
    expect(replaced.leaderboard).toEqual(LEADERBOARD_NEXT);

    const reset = reduceWorldState(replaced, WELCOME);
    expect(reset.leaderboard).toBeNull();
  });

  it('preserves the server order of a five-entry snapshot without re-sorting', () => {
    const fiveEntries: LeaderboardSnapshot = {
      serverId: 1,
      at: 5000,
      entries: [
        { playerId: 'p5', name: 'Player 5', cubesCompleted: 0, clicks: 1 },
        { playerId: 'p4', name: 'Player 4', cubesCompleted: 1, clicks: 2 },
        { playerId: 'p3', name: 'Player 3', cubesCompleted: 2, clicks: 3 },
        { playerId: 'p2', name: 'Player 2', cubesCompleted: 3, clicks: 4 },
        { playerId: 'p1', name: 'Player 1', cubesCompleted: 4, clicks: 5 },
      ],
      totals: { cubesCompleted: 10, clicks: 15, facesDestroyed: 6 },
    };

    const state = withLeaderboard(fiveEntries);

    expect(state.leaderboard!.entries.map((entry) => entry.playerId)).toEqual([
      'p5',
      'p4',
      'p3',
      'p2',
      'p1',
    ]);
  });

  it('leaderboardUpdate replaces only the leaderboard branch as a deep copy', () => {
    const state = seeded();
    const next = reduceWorldState(state, { type: 'leaderboardUpdate', leaderboard: LEADERBOARD });

    expect(next.leaderboard).toEqual(LEADERBOARD);
    expect(next.leaderboard).not.toBe(LEADERBOARD);
    expect(next.self).toBe(state.self);
    expect(next.members).toBe(state.members);
    expect(next.activity).toBe(state.activity);
    expect(next.pendingWorldSwap).toBeNull();
  });

  it('leaderboardUpdate for the current server replaces a previous snapshot', () => {
    const state = withLeaderboard();
    const next = reduceWorldState(state, {
      type: 'leaderboardUpdate',
      leaderboard: LEADERBOARD_NEXT,
    });

    expect(next.leaderboard).toEqual(LEADERBOARD_NEXT);
    expect(next.leaderboard).not.toBe(LEADERBOARD_NEXT);
  });

  it('returns the same state for an identical snapshot', () => {
    const state = withLeaderboard();
    const identical: LeaderboardSnapshot = {
      ...LEADERBOARD,
      entries: LEADERBOARD.entries.map((entry) => ({ ...entry })),
      totals: { ...LEADERBOARD.totals },
    };

    expect(reduceWorldState(state, { type: 'leaderboardUpdate', leaderboard: identical })).toBe(
      state,
    );
  });

  it('returns the same state for a snapshot matching neither server', () => {
    const state = withLeaderboard();

    expect(
      reduceWorldState(state, {
        type: 'leaderboardUpdate',
        leaderboard: { ...LEADERBOARD, serverId: 99 },
      }),
    ).toBe(state);
  });

  it('worldEntered stores the target snapshot in the pending swap without changing the current', () => {
    const state = withLeaderboard();
    const current = state.leaderboard;
    const source: LeaderboardSnapshot = {
      ...TARGET_LEADERBOARD,
      entries: TARGET_LEADERBOARD.entries.map((entry) => ({ ...entry })),
      totals: { ...TARGET_LEADERBOARD.totals },
    };
    const travelling = reduceWorldState(state, { ...WORLD_ENTERED, leaderboard: source });

    expect(travelling.leaderboard).toBe(current);
    expect(travelling.pendingWorldSwap!.leaderboard).toEqual(TARGET_LEADERBOARD);
    expect(travelling.pendingWorldSwap!.leaderboard).not.toBe(source);
    expect(travelling.pendingWorldSwap!.leaderboard!.entries).not.toBe(source.entries);
    expect(travelling.self).toBe(state.self);
    expect(travelling.members).toBe(state.members);

    source.entries[0]!.name = 'Mallory';
    expect(travelling.pendingWorldSwap!.leaderboard!.entries[0]!.name).toBe('Player 3');
  });

  it('worldEntered without a snapshot keeps the pending leaderboard null', () => {
    const state = withLeaderboard();
    const current = state.leaderboard;
    const travelling = reduceWorldState(state, WORLD_ENTERED);

    expect(travelling.leaderboard).toBe(current);
    expect(travelling.pendingWorldSwap!.leaderboard).toBeNull();
  });

  it('routes a target update into the pending swap and leaves the current snapshot', () => {
    const travelling = reduceWorldState(withLeaderboard(), {
      ...WORLD_ENTERED,
      leaderboard: TARGET_LEADERBOARD,
    });
    const current = travelling.leaderboard;
    const next = reduceWorldState(travelling, {
      type: 'leaderboardUpdate',
      leaderboard: TARGET_LEADERBOARD_NEXT,
    });

    expect(next.leaderboard).toBe(current);
    expect(next.pendingWorldSwap!.leaderboard).toEqual(TARGET_LEADERBOARD_NEXT);
    expect(next.pendingWorldSwap!.leaderboard).not.toBe(TARGET_LEADERBOARD_NEXT);
    expect(next.self).toBe(travelling.self);
    expect(next.members).toBe(travelling.members);
  });

  it('returns the same state for an identical snapshot while a swap is pending', () => {
    const travelling = reduceWorldState(withLeaderboard(), {
      ...WORLD_ENTERED,
      leaderboard: TARGET_LEADERBOARD,
    });
    const identical: LeaderboardSnapshot = {
      ...TARGET_LEADERBOARD,
      entries: TARGET_LEADERBOARD.entries.map((entry) => ({ ...entry })),
      totals: { ...TARGET_LEADERBOARD.totals },
    };

    expect(
      reduceWorldState(travelling, { type: 'leaderboardUpdate', leaderboard: identical }),
    ).toBe(travelling);
  });

  it('applies an old-server update to the current snapshot during travel, never the pending one', () => {
    const travelling = reduceWorldState(withLeaderboard(), {
      ...WORLD_ENTERED,
      leaderboard: TARGET_LEADERBOARD,
    });
    const pending = travelling.pendingWorldSwap;
    const next = reduceWorldState(travelling, {
      type: 'leaderboardUpdate',
      leaderboard: LEADERBOARD_NEXT,
    });

    expect(next.leaderboard).toEqual(LEADERBOARD_NEXT);
    expect(next.pendingWorldSwap).toBe(pending);
    expect(next.pendingWorldSwap!.leaderboard).toEqual(TARGET_LEADERBOARD);
  });

  it('applyWorldSwap applies the pending snapshot received during travel and clears the swap', () => {
    const travelling = reduceWorldState(withLeaderboard(), {
      ...WORLD_ENTERED,
      leaderboard: TARGET_LEADERBOARD,
    });
    const updated = reduceWorldState(travelling, {
      type: 'leaderboardUpdate',
      leaderboard: TARGET_LEADERBOARD_NEXT,
    });
    const swapped = applyWorldSwap(updated);

    expect(swapped.serverId).toBe(2);
    expect(swapped.leaderboard).toEqual(TARGET_LEADERBOARD_NEXT);
    expect(swapped.leaderboard).not.toBe(updated.pendingWorldSwap!.leaderboard);
    expect(swapped.pendingWorldSwap).toBeNull();
  });

  it('applyWorldSwap replaces a current snapshot with the pending null', () => {
    const state = withLeaderboard();
    const swapped = applyWorldSwap(reduceWorldState(state, WORLD_ENTERED));

    expect(swapped.serverId).toBe(2);
    expect(swapped.leaderboard).toBeNull();
  });

  it('produces the identical leaderboard branch for a guest and an account', () => {
    const accountWelcome: ServerMessage = {
      ...WELCOME,
      identity: { kind: 'account', accountId: 'account-1', username: 'Player 1' },
      leaderboard: LEADERBOARD,
    };
    const guestState = withLeaderboard();
    const accountState = reduceWorldState(createWorldState(), accountWelcome);

    expect(accountState.leaderboard).toEqual(guestState.leaderboard);
    expect(accountState.leaderboard).not.toBe(guestState.leaderboard);
    expect(Object.keys(accountState.leaderboard!)).toEqual([
      'serverId',
      'at',
      'entries',
      'totals',
    ]);
    expect(Object.keys(accountState.leaderboard!.entries[0]!)).toEqual([
      'playerId',
      'name',
      'cubesCompleted',
      'clicks',
    ]);
  });
});
