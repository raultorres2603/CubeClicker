/**
 * The multiplayer world/roster reducer (T7).
 *
 * Pure and DOM-free: one decoded {@link ServerMessage} plus the previous {@link WorldState}
 * produce the next {@link WorldState}, with no clock, no randomness and no I/O. This is the
 * single source of truth for everything the server broadcasts about a client's server —
 * the roster, the other members' boards, the own placement, and the pending world swap of
 * a cross-server move. The engine keeps the local (optimistic) play state; the scene and
 * the React store read this module's state.
 *
 * **Authority.** Every value here comes from a server message; the reducer never invents a
 * position, a board or a member (spec § Real-time impact — the client never trusts
 * reported values). The only derived value is the roster split: the wire `roster` includes
 * the receiver (T5), `members` excludes it.
 *
 * **Referential stability (React contract).** A message that changes nothing returns the
 * *same* state object; a message that changes something returns a new state whose untouched
 * branches keep their identity (a remote member's change never replaces `self`, an own-cube
 * change never replaces `members`).
 *
 * **Slot order.** `MemberState` carries no slot index on the wire, only the server-assigned
 * ring position, so `members` is ordered by the slot derived from that position (spec § 5).
 * Arrival order alone is not enough: since T1b a join fills the lowest free slot, so a
 * member can join a hole *ahead* of members who were already there. Existing members never
 * change position, so the order is stable for the life of a membership.
 */

import type { CubeState, MemberState, Position, ServerMessage } from './protocol';

export type { CubeState, MemberState, Position };

/** The own identity, placement and cube as the server reported them. */
export interface SelfState {
  playerId: string;
  name: string;
  position: Position;
  cube: CubeState;
}

/**
 * The placement of a cross-server move, recorded by `worldEntered` and applied by
 * {@link applyWorldSwap} at the travel midpoint (AC-12).
 *
 * Superset of the plan's pinned `{ serverId, position, roster }`: the mover's next-cube
 * state and the target capacity travel with it so the swap can seed the world exactly like
 * a `welcome` (the mover never receives a `levelAdvanced` for that level).
 */
export interface PendingWorldSwap {
  serverId: number;
  maxUsers: number;
  position: Position;
  self: CubeState;
  roster: MemberState[];
}

/** The full client-side world state: own placement, the server's other members, pending swap. */
export interface WorldState {
  /** The server id the client is on; `0` until the first `welcome` (no server assigned yet). */
  serverId: number;
  /** Server capacity X; `0` until the first `welcome`. */
  maxUsers: number;
  self: SelfState;
  /** The server's other members, in arrival (slot) order; the own member is never here. */
  members: MemberState[];
  /** Set by `worldEntered`, cleared by the swap / a fresh `welcome`. */
  pendingWorldSwap: PendingWorldSwap | null;
}

/**
 * The pre-`welcome` world: no server assigned yet, no members, no pending swap. The
 * placeholder identity is never rendered (the session holds the intro until `welcome`).
 */
export function createWorldState(): WorldState {
  return {
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
  };
}

function copyPosition(position: Position): Position {
  return { x: position.x, y: position.y };
}

function copyCube(cube: CubeState): CubeState {
  return {
    ...cube,
    removedIds: [...cube.removedIds],
  };
}

function copyMember(member: MemberState): MemberState {
  return {
    ...member,
    position: copyPosition(member.position),
    removedIds: [...member.removedIds],
  };
}

/**
 * The member's 0-based slot index, derived from the server-assigned ring position
 * (`angle = 2π·(slot−1)/X`, spec § 5). Ties keep the input order (stable sort).
 */
function slotIndex(position: Position, maxUsers: number): number {
  if (maxUsers <= 0) {
    return 0;
  }
  const turns = (Math.atan2(position.y, position.x) / (2 * Math.PI)) * maxUsers;
  const index = Math.round(turns) % maxUsers;
  return index < 0 ? index + maxUsers : index;
}

/** A copy of the member list in slot order (the wire carries positions, never slot ids). */
function orderedMembers(members: readonly MemberState[], maxUsers: number): MemberState[] {
  return [...members].sort(
    (a, b) => slotIndex(a.position, maxUsers) - slotIndex(b.position, maxUsers),
  );
}

/** The wire roster minus the receiver, in slot order, defensively copied. */
function othersFrom(
  roster: readonly MemberState[],
  selfId: string,
  maxUsers: number,
): MemberState[] {
  const others: MemberState[] = [];
  for (const member of roster) {
    if (member.playerId !== selfId) {
      others.push(copyMember(member));
    }
  }
  return orderedMembers(others, maxUsers);
}

/** `memberJoined`: insert a new member in slot order, or update a known one in place. */
function withMember(state: WorldState, member: MemberState): WorldState {
  if (member.playerId === state.self.playerId) {
    return state;
  }
  const index = state.members.findIndex((current) => current.playerId === member.playerId);
  if (index === -1) {
    return {
      ...state,
      members: orderedMembers([...state.members, copyMember(member)], state.maxUsers),
    };
  }
  return {
    ...state,
    members: orderedMembers(
      state.members.map((current, position) =>
        position === index ? copyMember(member) : current,
      ),
      state.maxUsers,
    ),
  };
}

/** `memberLeft`: drop the member, preserving every other member's order. */
function withoutMember(state: WorldState, playerId: string): WorldState {
  const index = state.members.findIndex((current) => current.playerId === playerId);
  if (index === -1) {
    return state;
  }
  return { ...state, members: state.members.filter((_, position) => position !== index) };
}

/** `miniCubeRemoved`: add one removed tile id to its owner's board (idempotent — ack no-op). */
function withRemovedId(state: WorldState, playerId: string, id: string): WorldState {
  if (playerId === state.self.playerId) {
    if (state.self.cube.removedIds.includes(id)) {
      return state;
    }
    return {
      ...state,
      self: {
        ...state.self,
        cube: { ...state.self.cube, removedIds: [...state.self.cube.removedIds, id] },
      },
    };
  }
  const index = state.members.findIndex((current) => current.playerId === playerId);
  if (index === -1) {
    return state;
  }
  const target = state.members[index]!;
  if (target.removedIds.includes(id)) {
    return state;
  }
  return {
    ...state,
    members: state.members.map((current, position) =>
      position === index ? { ...current, removedIds: [...current.removedIds, id] } : current,
    ),
  };
}

/** `levelAdvanced`: the member's fresh cube (empty board) and its (possibly new) position. */
function withAdvanced(
  state: WorldState,
  msg: Extract<ServerMessage, { type: 'levelAdvanced' }>,
): WorldState {
  const cube: CubeState = {
    levelIndex: msg.levelIndex,
    gridSize: msg.gridSize,
    styleId: msg.styleId,
    removedIds: [],
    yawSteps: 0,
    pitchSteps: 0,
  };
  if (msg.playerId === state.self.playerId) {
    return {
      ...state,
      self: { ...state.self, position: copyPosition(msg.position), cube },
    };
  }
  const index = state.members.findIndex((current) => current.playerId === msg.playerId);
  if (index === -1) {
    return state;
  }
  return {
    ...state,
    members: state.members.map((current, position) =>
      position === index
        ? {
            ...current,
            position: copyPosition(msg.position),
            levelIndex: cube.levelIndex,
            gridSize: cube.gridSize,
            styleId: cube.styleId,
            removedIds: [],
            yawSteps: 0,
            pitchSteps: 0,
          }
        : current,
    ),
  };
}

/** `stateSync`: authoritative board replace for one member's cube (position untouched). */
function withSync(
  state: WorldState,
  msg: Extract<ServerMessage, { type: 'stateSync' }>,
): WorldState {
  const cube: CubeState = {
    levelIndex: msg.levelIndex,
    gridSize: msg.gridSize,
    styleId: msg.styleId,
    removedIds: [...msg.removedIds],
    yawSteps: msg.yawSteps,
    pitchSteps: msg.pitchSteps,
  };
  if (msg.playerId === state.self.playerId) {
    return { ...state, self: { ...state.self, cube } };
  }
  const index = state.members.findIndex((current) => current.playerId === msg.playerId);
  if (index === -1) {
    return state;
  }
  return {
    ...state,
    members: state.members.map((current, position) =>
      position === index
        ? {
            ...current,
            levelIndex: cube.levelIndex,
            gridSize: cube.gridSize,
            styleId: cube.styleId,
            removedIds: [...cube.removedIds],
            yawSteps: cube.yawSteps,
            pitchSteps: cube.pitchSteps,
          }
        : current,
    ),
  };
}

/**
 * `cubeRotated`: update the matching member's (or, defensively, self's) settled
 * orientation. Unknown members are a no-op. Identical orientation is a no-op (same
 * reference) so repeated broadcasts do not churn the store.
 */
function withRotated(state: WorldState, msg: Extract<ServerMessage, { type: 'cubeRotated' }>): WorldState {
  if (msg.playerId === state.self.playerId) {
    if (
      state.self.cube.yawSteps === msg.yawSteps &&
      state.self.cube.pitchSteps === msg.pitchSteps
    ) {
      return state;
    }
    return {
      ...state,
      self: {
        ...state.self,
        cube: { ...state.self.cube, yawSteps: msg.yawSteps, pitchSteps: msg.pitchSteps },
      },
    };
  }
  const index = state.members.findIndex((current) => current.playerId === msg.playerId);
  if (index === -1) {
    return state;
  }
  const target = state.members[index]!;
  if (target.yawSteps === msg.yawSteps && target.pitchSteps === msg.pitchSteps) {
    return state;
  }
  return {
    ...state,
    members: state.members.map((current, position) =>
      position === index
        ? { ...current, yawSteps: msg.yawSteps, pitchSteps: msg.pitchSteps }
        : current,
    ),
  };
}

/**
 * Reduces one decoded server message into the world state.
 *
 * Handled: `welcome` (seed identity/placement/roster, clear any pending swap),
 * `worldEntered` (record the pending swap), `memberJoined`/`memberLeft` (roster),
 * `miniCubeRemoved` (board delta), `levelAdvanced` (fresh cube + position), `stateSync`
 * (authoritative board), `cubeRotated` (orientation). `hello` and `error` carry no world
 * state and return the same reference.
 */
export function reduceWorldState(state: WorldState, msg: ServerMessage): WorldState {
  switch (msg.type) {
    case 'welcome':
      return {
        serverId: msg.serverId,
        maxUsers: msg.maxUsers,
        self: {
          playerId: msg.playerId,
          name: msg.name,
          position: copyPosition(msg.position),
          cube: copyCube(msg.self),
        },
        members: othersFrom(msg.roster, msg.playerId, msg.maxUsers),
        pendingWorldSwap: null,
      };

    case 'worldEntered':
      return {
        ...state,
        pendingWorldSwap: {
          serverId: msg.serverId,
          maxUsers: msg.maxUsers,
          position: copyPosition(msg.position),
          self: copyCube(msg.self),
          roster: msg.roster.map(copyMember),
        },
      };

    case 'memberJoined':
      return withMember(state, msg.member);

    case 'memberLeft':
      return withoutMember(state, msg.playerId);

    case 'miniCubeRemoved':
      return withRemovedId(state, msg.playerId, msg.id);

    case 'levelAdvanced':
      return withAdvanced(state, msg);

    case 'stateSync':
      return withSync(state, msg);

    case 'cubeRotated':
      return withRotated(state, msg);

    default:
      // `hello` (liveness only) and `error` (banner/telemetry) carry no world state.
      return state;
  }
}

/**
 * Applies the pending cross-server swap (AC-12): the mover's own placement and cube from
 * `worldEntered`, the target server's roster minus self, and the target capacity. Called at
 * the travel midpoint by the session; with no pending swap it returns the same reference.
 */
export function applyWorldSwap(state: WorldState): WorldState {
  const pending = state.pendingWorldSwap;
  if (pending === null) {
    return state;
  }
  return {
    serverId: pending.serverId,
    maxUsers: pending.maxUsers,
    self: {
      playerId: state.self.playerId,
      name: state.self.name,
      position: copyPosition(pending.position),
      cube: copyCube(pending.self),
    },
    members: othersFrom(pending.roster, state.self.playerId, pending.maxUsers),
    pendingWorldSwap: null,
  };
}
