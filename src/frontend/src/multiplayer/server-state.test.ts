import { describe, expect, it } from 'vitest';

import type { MemberState, ServerMessage } from './protocol';
import { applyWorldSwap, createWorldState, reduceWorldState, type WorldState } from './server-state';

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

const WELCOME: ServerMessage = {
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
};

/** The mover's placement on server 2: p2 already in slot 1, the mover filling slot 2. */
const WORLD_ENTERED: ServerMessage = {
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
  },
  members: [P2_MEMBER, P3_MEMBER],
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
      },
      members: [],
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
      },
      members: [P2_MEMBER_SERVER_2],
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
