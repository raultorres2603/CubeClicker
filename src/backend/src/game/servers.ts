/**
 * Game servers: ring layout, join assignment, move plan and the in-memory registry (T1/T1b).
 *
 * A "game server" is a logical room inside the single backend process (spec § 1, Q-9):
 * an explicit slot occupancy plus the members' cube states, which live outside this module.
 * Everything here is pure state over explicit inputs — no timers, no DOM, no randomness, no I/O.
 *
 * Pinned rules implemented here:
 * - ring layout: slot `s` (1-based) of a server with capacity X sits at angle
 *   `2π·(s−1)/X`, radius `X·SLOT_SPACING/(2π)` (spec § 5, AC-13);
 * - stable occupancy: a member owns their slot for as long as they stay, a vacated slot is a
 *   hole that only a joining/moving member fills (lowest free slot first) — existing members
 *   never shuffle (spec § 5);
 * - join rule: the lowest-numbered server with a free slot, else a new server with a fresh
 *   monotonic id (spec § 4, AC-9);
 * - move plan: pack membership toward the lowest ids; donors are members of higher-id servers
 *   taken in **join order** (a refilled hole can make slot order differ); a planned target is
 *   always strictly lower (spec § 4, AC-10);
 * - empty servers are destroyed immediately and ids are never reused (spec § 1, AC-3).
 */

/** Pinned ring arc spacing — the accepted cube spacing (`CUBE_SPACING`), spec § 5. */
export const SLOT_SPACING = 24;

/** A position on the world plane (`z = 0` is implied by the world layout). */
export interface Position {
  x: number;
  y: number;
}

/**
 * One game server: an id plus its explicit slot occupancy.
 *
 * `members[i]` is the player in slot `i + 1`, or `null` when that slot is free. The array is
 * the server's slot table — not a dense list — so removing a member vacates exactly their slot
 * and leaves every other member's index (their slot) untouched. Trailing free slots are
 * trimmed, so the array length is the highest occupied slot and never exceeds the capacity.
 */
export interface ServerState {
  id: number;
  members: (string | null)[];
}

/** The result of a join assignment: where the member landed. */
export interface ServerAssignment {
  serverId: number;
  slot: number;
}

/** The result of a server creation attempt in {@link pickServer}. */
export interface PickedServer extends ServerAssignment {
  created: boolean;
}

/** The result of removing a member: whether it was found and whether its server died. */
export interface MemberRemoval {
  left: boolean;
  serverDestroyed: boolean;
}

/**
 * The deterministic ring position of a slot.
 *
 * Slot `s` (1-based) of a server with capacity `maxUsers` → angle `2π·(s−1)/maxUsers`,
 * radius `maxUsers·SLOT_SPACING/(2π)`, position `(R·cos θ, R·sin θ)`. Occupancy is by
 * construction: distinct slots have distinct angles, so positions never collide.
 */
export function worldPosition(slot: number, maxUsers: number): Position {
  const radius = (maxUsers * SLOT_SPACING) / (2 * Math.PI);
  const angle = (2 * Math.PI * (slot - 1)) / maxUsers;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

/** Servers in ascending id order (the canonical order for every rule in this module). */
function byId(servers: readonly ServerState[]): ServerState[] {
  return [...servers].sort((a, b) => a.id - b.id);
}

/**
 * The lowest free slot of a slot table (1-based), or `null` when it is at capacity.
 *
 * Index `i` is slot `i + 1`. A `null` entry is a vacated slot; an index at or past the array
 * length is a trimmed free slot. Exactly `maxUsers` slots are considered, so a malformed
 * over-long table still reports "full".
 */
function firstFreeSlot(members: readonly (string | null)[], maxUsers: number): number | null {
  for (let slot = 1; slot <= maxUsers; slot += 1) {
    if ((members[slot - 1] ?? null) === null) {
      return slot;
    }
  }
  return null;
}

/** How many of a server's slots are taken. */
function occupiedCount(members: readonly (string | null)[]): number {
  return members.filter((member) => member !== null).length;
}

/** Frees one slot and trims trailing holes (the array length tracks the highest used slot). */
function vacate(server: ServerState, slot: number): void {
  server.members[slot - 1] = null;
  while (server.members.length > 0 && server.members[server.members.length - 1] === null) {
    server.members.pop();
  }
}

/** Occupies a free slot, padding with holes only when the slot is beyond the current length. */
function place(server: ServerState, slot: number, playerId: string): void {
  while (server.members.length < slot) {
    server.members.push(null);
  }
  server.members[slot - 1] = playerId;
}

/**
 * The join rule: the lowest-numbered server with a free slot, else a new server.
 *
 * `nextId` is the id a new server would receive; the caller owns the monotonic counter.
 * The result reports `created` so the caller knows to materialise the server.
 */
export function pickServer(
  servers: readonly ServerState[],
  maxUsers: number,
  nextId: number,
): PickedServer {
  for (const server of byId(servers)) {
    const slot = firstFreeSlot(server.members, maxUsers);
    if (slot !== null) {
      return { serverId: server.id, slot, created: false };
    }
  }
  return { serverId: nextId, slot: 1, created: true };
}

/**
 * A global join sequence: `playerId →` the monotonic order in which the member joined.
 *
 * The registry maintains one for its live members; a fixture can supply one explicitly to
 * exercise the spec § 4 donor rule (donors are taken in join order).
 */
export type JoinSequence = ReadonlyMap<string, number>;

/**
 * The move plan for the current membership (spec § 4, AC-10).
 *
 * Destinations are the servers with free slots, considered in ascending id order; donors are
 * the members of higher-id servers taken in **join order** when a sequence is supplied. A
 * refilled hole can put a later join in a lower slot, so slot order is not join order — the
 * registry always passes its tracked sequence (F6). Without a sequence the enumeration order
 * (server id, then slot) is kept, which keeps plain fixtures deterministic.
 *
 * Each donor is planned onto the lowest-id server with remaining capacity, but only when that
 * target is strictly lower than the donor's current server id — so a plan can never move a
 * member up or keep them in place. Deterministic and idempotent for a given membership state;
 * the returned map preserves plan order.
 */
export function computeMovePlan(
  servers: readonly ServerState[],
  maxUsers: number,
  joinSequence?: JoinSequence,
): Map<string, number> {
  const ordered = byId(servers);
  const freeSlots = new Map<number, number>();
  for (const server of ordered) {
    const free = maxUsers - occupiedCount(server.members);
    if (free > 0) {
      freeSlots.set(server.id, free);
    }
  }

  const donors: Array<{ playerId: string; serverId: number }> = [];
  for (const server of ordered) {
    for (const playerId of server.members) {
      if (playerId !== null) {
        donors.push({ playerId, serverId: server.id });
      }
    }
  }
  if (joinSequence !== undefined) {
    // Stable sort: an id missing from the sequence keeps its enumeration position at the end.
    donors.sort(
      (left, right) =>
        (joinSequence.get(left.playerId) ?? Number.MAX_SAFE_INTEGER) -
        (joinSequence.get(right.playerId) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  const plan = new Map<string, number>();
  for (const donor of donors) {
    const targetId = lowestServerWithFreeSlot(freeSlots);
    if (targetId === null || targetId >= donor.serverId) {
      continue;
    }
    plan.set(donor.playerId, targetId);
    const remaining = freeSlots.get(targetId)! - 1;
    if (remaining === 0) {
      freeSlots.delete(targetId);
    } else {
      freeSlots.set(targetId, remaining);
    }
  }
  return plan;
}

/**
 * The lowest-id entry with remaining capacity. Map iteration is insertion order, and the
 * map is populated in ascending id order (entries drop out only at zero), so the first
 * key is the lowest id with a free slot.
 */
function lowestServerWithFreeSlot(freeSlots: Map<number, number>): number | null {
  for (const serverId of freeSlots.keys()) {
    return serverId;
  }
  return null;
}

/**
 * The mutable registry wrapper over the pure rules.
 *
 * Invariants: servers are kept in ascending id order, ids come from a monotonic counter
 * and are never reused, a member's slot is stable until they leave, and a server with no
 * members is destroyed immediately.
 */
export interface ServerRegistry {
  /** Number of live servers (0 before the first join — AC-1). */
  serverCount(): number;
  /** A snapshot of the live servers in ascending id order (defensive copies of the slot tables). */
  servers(): ServerState[];
  /** Applies the join rule: picks the lowest-id server with a free slot (lowest free slot), creating one when needed. */
  assign(joining: string): ServerAssignment;
  /** Removes a member, vacating exactly their slot and destroying their server when it becomes empty. */
  removeMember(playerId: string): MemberRemoval;
  /**
   * Executes a planned move: re-validates that the target still exists, has a free slot
   * and is strictly lower than the member's current server; on any failure returns `null`
   * and leaves the membership untouched (the member stays). On success the mover takes the
   * target's lowest free slot and their old slot is vacated (nobody else shifts).
   */
  moveMember(playerId: string, targetServerId: number): { slot: number } | null;
  /** Recomputes the move plan from the current membership (donors in tracked join order). */
  plan(): Map<string, number>;
}

/**
 * Creates an empty registry for servers of capacity `maxUsersPerServer`.
 *
 * No server exists until the first {@link ServerRegistry.assign}, and nothing is
 * persisted: a fresh registry per process boot is the whole lifecycle (spec AC-4).
 */
export function createServerRegistry(maxUsersPerServer: number): ServerRegistry {
  const servers: ServerState[] = [];
  /** Monotonic join sequence per live member (spec § 4: donors are taken in join order). */
  const joinSequence = new Map<string, number>();
  let joinCounter = 0;
  let nextId = 1;

  /** Finds a member's server and its 1-based slot (the slot table index is `slot − 1`). */
  function locate(playerId: string): { serverIndex: number; slot: number } | null {
    for (let serverIndex = 0; serverIndex < servers.length; serverIndex += 1) {
      const slot = servers[serverIndex].members.indexOf(playerId);
      if (slot !== -1) {
        return { serverIndex, slot: slot + 1 };
      }
    }
    return null;
  }

  return {
    serverCount(): number {
      return servers.length;
    },

    servers(): ServerState[] {
      return servers.map((server) => ({ id: server.id, members: [...server.members] }));
    },

    assign(joining: string): ServerAssignment {
      const picked = pickServer(servers, maxUsersPerServer, nextId);
      if (picked.created) {
        // A fresh id is always the highest, so appending keeps the ascending invariant.
        servers.push({ id: picked.serverId, members: [] });
        nextId = picked.serverId + 1;
      }
      const server = servers.find((candidate) => candidate.id === picked.serverId)!;
      place(server, picked.slot, joining);
      joinCounter += 1;
      joinSequence.set(joining, joinCounter);
      return { serverId: picked.serverId, slot: picked.slot };
    },

    removeMember(playerId: string): MemberRemoval {
      const where = locate(playerId);
      if (where === null) {
        return { left: false, serverDestroyed: false };
      }
      const server = servers[where.serverIndex];
      vacate(server, where.slot);
      joinSequence.delete(playerId);
      if (occupiedCount(server.members) === 0) {
        servers.splice(where.serverIndex, 1);
        return { left: true, serverDestroyed: true };
      }
      return { left: true, serverDestroyed: false };
    },

    moveMember(playerId: string, targetServerId: number): { slot: number } | null {
      const where = locate(playerId);
      if (where === null) {
        return null;
      }
      const current = servers[where.serverIndex];
      // Moves only ever go down: equal or higher targets are rejected (stability, AC-10).
      if (targetServerId >= current.id) {
        return null;
      }
      const target = servers.find((candidate) => candidate.id === targetServerId);
      if (target === undefined) {
        return null;
      }
      const slot = firstFreeSlot(target.members, maxUsersPerServer);
      if (slot === null) {
        return null;
      }

      vacate(current, where.slot);
      place(target, slot, playerId);
      if (occupiedCount(current.members) === 0) {
        servers.splice(where.serverIndex, 1);
      }
      return { slot };
    },

    plan(): Map<string, number> {
      return computeMovePlan(servers, maxUsersPerServer, joinSequence);
    },
  };
}
