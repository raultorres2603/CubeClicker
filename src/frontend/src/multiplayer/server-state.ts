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
 * the receiver (T5), `members` excludes it. Every stored member carries a normalized public
 * appearance (`{}` when the optional wire field is absent or malformed) and `memberAppearance`
 * replaces exactly one member's record in place (AC-7/AC-8).
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

import type { ActivityEvent, CubeState, EconomyState, LeaderboardSnapshot, MemberState, Position, ServerMessage } from './protocol';
import { ACTIVITY_FEED_LIMIT, copyActivityEvent, copyLeaderboardSnapshot, memberAppearanceOf, parseAppearance } from './protocol';

export type { ActivityEvent, CubeState, EconomyState, MemberState, Position };

/** The own identity, placement and cube as the server reported them. */
export interface SelfState {
  playerId: string;
  name: string;
  position: Position;
  cube: CubeState;
  economy: EconomyState;
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
  /** The target server's activity ring at `worldEntered`, newest first (≤ 20). */
  activity: ActivityEvent[];
  /** The target server's leaderboard snapshot at `worldEntered` (or `null`). */
  leaderboard: LeaderboardSnapshot | null;
  economy: EconomyState;
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
  /** The server's activity feed, newest first, at most {@link ACTIVITY_FEED_LIMIT} events. */
  activity: ActivityEvent[];
  /** The current server's ranked leaderboard snapshot; `null` until a snapshot arrives. */
  leaderboard: LeaderboardSnapshot | null;
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
      economy: { coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 },
    },
    members: [],
    activity: [],
    leaderboard: null,
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
    // AC-7: the reducer is a client copy path, so a member without the optional field (or
    // with a malformed one) stores `{}`; a present valid record is copied fresh.
    appearance: memberAppearanceOf(member),
  };
}

function copyEconomy(economy: EconomyState): EconomyState {
  return {
    coins: economy.coins,
    clicks: economy.clicks,
    facesDestroyed: economy.facesDestroyed,
    cubesDestroyed: economy.cubesDestroyed,
  };
}

/** A defensive copy of an activity ring, newest first (each event is a fresh object). */
function copyActivityFeed(events: readonly ActivityEvent[]): ActivityEvent[] {
  return events.map(copyActivityEvent);
}

/**
 * Prepends a copied event to an activity ring and trims it to the pinned limit.
 *
 * The duplicate-`id` check runs against the destination ring: a replayed frame returns
 * `null`, so the caller can return the same state reference. Untouched entries keep their
 * identity; only the new event is copied and only the array is replaced.
 */
function prependActivityEvent(
  events: readonly ActivityEvent[],
  event: ActivityEvent,
): ActivityEvent[] | null {
  if (events.some((current) => current.id === event.id)) {
    return null;
  }
  return [copyActivityEvent(event), ...events].slice(0, ACTIVITY_FEED_LIMIT);
}

function economiesEqual(a: EconomyState, b: EconomyState): boolean {
  return (
    a.coins === b.coins &&
    a.clicks === b.clicks &&
    a.facesDestroyed === b.facesDestroyed &&
    a.cubesDestroyed === b.cubesDestroyed
  );
}

/**
 * Deep equality of two leaderboard snapshots (or `null`s). Identical snapshots must return
 * the same state reference; a difference in any pinned field is a real change.
 */
function leaderboardsEqual(
  a: LeaderboardSnapshot | null,
  b: LeaderboardSnapshot | null,
): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  if (a.serverId !== b.serverId || a.at !== b.at || a.entries.length !== b.entries.length) {
    return false;
  }
  for (let index = 0; index < a.entries.length; index += 1) {
    const left = a.entries[index]!;
    const right = b.entries[index]!;
    if (
      left.playerId !== right.playerId ||
      left.name !== right.name ||
      left.cubesCompleted !== right.cubesCompleted ||
      left.clicks !== right.clicks
    ) {
      return false;
    }
  }
  return (
    a.totals.cubesCompleted === b.totals.cubesCompleted &&
    a.totals.clicks === b.totals.clicks &&
    a.totals.facesDestroyed === b.totals.facesDestroyed
  );
}

const ZERO_ECONOMY: EconomyState = { coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 };

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

/** Key-order-independent equality of two normalized appearance records. */
function appearancesEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) {
    return false;
  }
  for (const key of keys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

/**
 * `memberAppearance` (AC-8): replace one roster member's public slot→part-id projection.
 *
 * The incoming record is normalized and copied through the shared appearance codec, so an
 * invalid payload (despite the static type) stores nothing. An unknown `playerId` is a no-op.
 * The own `playerId` is also a no-op: `WorldState.self` (a `SelfState`) intentionally carries no
 * appearance — the engine owns the local loadout and a guest adopts the server record once on
 * `welcome` — so there is nothing to update. An unchanged record returns the same state
 * reference (React contract) and a changed one replaces only the target member.
 */
function withAppearance(
  state: WorldState,
  msg: Extract<ServerMessage, { type: 'memberAppearance' }>,
): WorldState {
  if (msg.playerId === state.self.playerId) {
    return state;
  }
  const index = state.members.findIndex((current) => current.playerId === msg.playerId);
  if (index === -1) {
    return state;
  }
  const nextAppearance = parseAppearance(msg.appearance);
  if (nextAppearance === null) {
    return state;
  }
  const target = state.members[index]!;
  if (appearancesEqual(memberAppearanceOf(target), nextAppearance)) {
    return state;
  }
  return {
    ...state,
    members: state.members.map((current, position) =>
      position === index ? { ...current, appearance: nextAppearance } : current,
    ),
  };
}

/**
 * `miniCubeRemoved`/`miniCubesRemoved`: add one removed tile id to its owner's board
 * (idempotent — ack no-op). The batched frame folds this over its ids in acceptance order.
 */
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
 * Handled: `welcome` (seed identity/placement/roster/activity, clear any pending swap),
 * `worldEntered` (record the pending swap and its activity ring), `memberJoined`/`memberLeft`
 * (roster), `memberAppearance` (one member's public appearance projection), `miniCubeRemoved`
 * (one board delta), `miniCubesRemoved` (every id of a batch, in order), `levelAdvanced` (fresh
 * cube + position), `stateSync` (authoritative board), `cubeRotated` (orientation),
 * `activityEvent` (the per-server feed, or the pending target feed while a swap is pending) and
 * `leaderboardUpdate` (the current server's ranking, or the pending target ranking while a swap
 * is pending). `hello` and `error` carry no world state and return the same reference.
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
          economy: msg.economy ? copyEconomy(msg.economy) : { ...ZERO_ECONOMY },
        },
        members: othersFrom(msg.roster, msg.playerId, msg.maxUsers),
        activity: copyActivityFeed(msg.activity ?? []),
        leaderboard: msg.leaderboard === undefined ? null : copyLeaderboardSnapshot(msg.leaderboard),
        pendingWorldSwap: null,
      };

    case 'worldEntered': {
      const pendingEconomy = msg.economy ? copyEconomy(msg.economy) : ZERO_ECONOMY;
      const selfEconomy = msg.economy ? copyEconomy(msg.economy) : state.self.economy;
      const selfWithEconomy = msg.economy
        ? economiesEqual(state.self.economy, selfEconomy)
          ? state.self
          : { ...state.self, economy: selfEconomy }
        : state.self;
      return {
        ...state,
        self: selfWithEconomy,
        pendingWorldSwap: {
          serverId: msg.serverId,
          maxUsers: msg.maxUsers,
          position: copyPosition(msg.position),
          self: copyCube(msg.self),
          roster: msg.roster.map(copyMember),
          activity: copyActivityFeed(msg.activity ?? []),
          leaderboard:
            msg.leaderboard === undefined ? null : copyLeaderboardSnapshot(msg.leaderboard),
          economy: pendingEconomy,
        },
      };
    }

    case 'activityEvent': {
      const { event } = msg;
      const pending = state.pendingWorldSwap;
      // While a cross-server swap is pending, the target server's events belong to the
      // pending feed; the old server's feed is untouched until the midpoint swap.
      if (pending !== null && event.serverId === pending.serverId) {
        const nextPendingActivity = prependActivityEvent(pending.activity, event);
        if (nextPendingActivity === null) {
          return state;
        }
        return {
          ...state,
          pendingWorldSwap: { ...pending, activity: nextPendingActivity },
        };
      }
      if (event.serverId === state.serverId) {
        const nextActivity = prependActivityEvent(state.activity, event);
        if (nextActivity === null) {
          return state;
        }
        return { ...state, activity: nextActivity };
      }
      // A different server's event can never reach this client's feed (cross-server guard).
      return state;
    }

    case 'leaderboardUpdate': {
      const { leaderboard } = msg;
      const pending = state.pendingWorldSwap;
      // While a cross-server swap is pending, the target server's snapshot belongs to the
      // pending swap; the old server's current snapshot stays untouched until the midpoint.
      if (pending !== null && leaderboard.serverId === pending.serverId) {
        if (leaderboardsEqual(pending.leaderboard, leaderboard)) {
          return state;
        }
        return {
          ...state,
          pendingWorldSwap: { ...pending, leaderboard: copyLeaderboardSnapshot(leaderboard) },
        };
      }
      if (leaderboard.serverId === state.serverId) {
        if (leaderboardsEqual(state.leaderboard, leaderboard)) {
          return state;
        }
        return { ...state, leaderboard: copyLeaderboardSnapshot(leaderboard) };
      }
      // A snapshot matching neither the current server nor the pending target is the
      // cross-server guard: no state change (same reference).
      return state;
    }

    case 'memberJoined':
      return withMember(state, msg.member);

    case 'memberAppearance':
      return withAppearance(state, msg);

    case 'memberLeft':
      return withoutMember(state, msg.playerId);

    case 'miniCubeRemoved':
      return withRemovedId(state, msg.playerId, msg.id);

    case 'miniCubesRemoved': {
      // Fold in acceptance order: each id is applied exactly once, so a replayed frame or a
      // duplicate id returns the same reference as soon as nothing new is left to apply.
      let next = state;
      for (const id of msg.ids) {
        next = withRemovedId(next, msg.playerId, id);
      }
      return next;
    }

    case 'levelAdvanced':
      return withAdvanced(state, msg);

    case 'stateSync':
      return withSync(state, msg);

    case 'cubeRotated':
      return withRotated(state, msg);

    case 'economyUpdate': {
      const nextEconomy: EconomyState = {
        coins: msg.coins,
        clicks: msg.clicks,
        facesDestroyed: msg.facesDestroyed,
        cubesDestroyed: msg.cubesDestroyed,
      };
      if (economiesEqual(state.self.economy, nextEconomy)) {
        return state;
      }
      return {
        ...state,
        self: { ...state.self, economy: nextEconomy },
      };
    }

    default:
      // `hello` (liveness only) and `error` (banner/telemetry) carry no world state.
      return state;
  }
}

/**
 * Applies the pending cross-server swap (AC-12): the mover's own placement and cube from
 * `worldEntered`, the target server's roster minus self, the target capacity, the target
 * activity ring and the target leaderboard snapshot (including any update folded in during
 * travel). Called at the travel midpoint by the session; with no pending swap it returns
 * the same reference.
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
      economy: copyEconomy(pending.economy),
    },
    members: othersFrom(pending.roster, state.self.playerId, pending.maxUsers),
    activity: copyActivityFeed(pending.activity),
    leaderboard:
      pending.leaderboard === null ? null : copyLeaderboardSnapshot(pending.leaderboard),
    pendingWorldSwap: null,
  };
}

/**
 * Removes locally expired activity events from the current feed and, while a cross-server
 * move is travelling, from the pending target feed (`presence-and-activity-liveness`,
 * AC-15/AC-18).
 *
 * Pure: the caller supplies the clock-based predicate (`isExpired(serverId, eventId)`,
 * normally the session's `ActivityLifetime.isExpired` reader), so this helper never reads
 * a clock or a timer. Each feed is filtered against its own `serverId` — the current feed
 * with `state.serverId`, the pending feed with `pendingWorldSwap.serverId` — because
 * per-server event ids collide across servers (both start at 1).
 *
 * **Referential stability (React contract).** When nothing expired the same `WorldState`
 * reference is returned. When only one feed changed, the other feed's array *and* the
 * untouched object that owns it keep their identity (`pendingWorldSwap` for a current-only
 * removal, `activity` for a pending-only removal); surviving events keep their identity in
 * both cases, so only the changed arrays are replaced.
 */
export function pruneActivity(
  state: WorldState,
  isExpired: (serverId: number, eventId: number) => boolean,
): WorldState {
  const filterFeed = (serverId: number, events: readonly ActivityEvent[]): ActivityEvent[] =>
    events.filter((event) => !isExpired(serverId, event.id));

  const activity = filterFeed(state.serverId, state.activity);
  const pending = state.pendingWorldSwap;

  if (pending === null) {
    if (activity.length === state.activity.length) {
      return state;
    }
    return { ...state, activity };
  }

  const pendingActivity = filterFeed(pending.serverId, pending.activity);
  const activityChanged = activity.length !== state.activity.length;
  const pendingChanged = pendingActivity.length !== pending.activity.length;
  if (!activityChanged && !pendingChanged) {
    return state;
  }
  return {
    ...state,
    activity: activityChanged ? activity : state.activity,
    pendingWorldSwap: pendingChanged ? { ...pending, activity: pendingActivity } : pending,
  };
}
