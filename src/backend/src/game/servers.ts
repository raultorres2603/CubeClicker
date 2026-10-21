/**
 * Game servers: ring layout, join assignment, move plan and the in-memory registry (T1).
 *
 * A "game server" is a logical room inside the single backend process (spec § 1, Q-9):
 * an ordered membership (join order = slot order) plus the members' cube states, which
 * live outside this module. Everything here is pure state over explicit inputs — no
 * timers, no DOM, no randomness, no I/O.
 *
 * Pinned rules implemented here:
 * - ring layout: slot `s` (1-based) of a server with capacity X sits at angle
 *   `2π·(s−1)/X`, radius `X·SLOT_SPACING/(2π)` (spec § 5, AC-13);
 * - join rule: the lowest-numbered server with a free slot, else a new server with a
 *   fresh monotonic id (spec § 4, AC-9);
 * - move plan: pack membership toward the lowest ids; donors are members of higher-id
 *   servers in join order; a planned target is always strictly lower (spec § 4, AC-10);
 * - empty servers are destroyed immediately and ids are never reused (spec § 1, AC-3).
 */

/** Pinned ring arc spacing — the accepted cube spacing (`CUBE_SPACING`), spec § 5. */
export const SLOT_SPACING = 24;

/** A position on the world plane (`z = 0` is implied by the world layout). */
export interface Position {
  x: number;
  y: number;
}

/** One game server: an id plus its members in slot (join) order. */
export interface ServerState {
  id: number;
  members: string[];
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
    if (server.members.length < maxUsers) {
      return { serverId: server.id, slot: server.members.length + 1, created: false };
    }
  }
  return { serverId: nextId, slot: 1, created: true };
}

/**
 * The move plan for the current membership (spec § 4, AC-10).
 *
 * Destinations are the servers with free slots, considered in ascending id order; donors
 * are the members of higher-id servers taken in join order (server ascending, then slot
 * order). Each donor is planned onto the lowest-id server with remaining capacity, but
 * only when that target is strictly lower than the donor's current server id — so a plan
 * can never move a member up or keep them in place. Deterministic and idempotent for a
 * given membership state; the returned map preserves plan order.
 */
export function computeMovePlan(
  servers: readonly ServerState[],
  maxUsers: number,
): Map<string, number> {
  const ordered = byId(servers);
  const freeSlots = new Map<number, number>();
  for (const server of ordered) {
    const free = maxUsers - server.members.length;
    if (free > 0) {
      freeSlots.set(server.id, free);
    }
  }

  const plan = new Map<string, number>();
  for (const server of ordered) {
    for (const playerId of server.members) {
      const targetId = lowestServerWithFreeSlot(freeSlots);
      if (targetId === null || targetId >= server.id) {
        continue;
      }
      plan.set(playerId, targetId);
      const remaining = freeSlots.get(targetId)! - 1;
      if (remaining === 0) {
        freeSlots.delete(targetId);
      } else {
        freeSlots.set(targetId, remaining);
      }
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
 * and are never reused, and a server with no members is destroyed immediately.
 */
export interface ServerRegistry {
  /** Number of live servers (0 before the first join — AC-1). */
  serverCount(): number;
  /** A snapshot of the live servers in ascending id order (defensive copies). */
  servers(): ServerState[];
  /** Applies the join rule: picks the lowest-id server with a free slot, creating one when needed. */
  assign(joining: string): ServerAssignment;
  /** Removes a member, destroying its server when it becomes empty. */
  removeMember(playerId: string): MemberRemoval;
  /**
   * Executes a planned move: re-validates that the target still exists, has a free slot
   * and is strictly lower than the member's current server; on any failure returns `null`
   * and leaves the membership untouched (the member stays).
   */
  moveMember(playerId: string, targetServerId: number): { slot: number } | null;
  /** Recomputes the move plan from the current membership. */
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
  let nextId = 1;

  function locate(playerId: string): { serverIndex: number; memberIndex: number } | null {
    for (let serverIndex = 0; serverIndex < servers.length; serverIndex += 1) {
      const memberIndex = servers[serverIndex].members.indexOf(playerId);
      if (memberIndex !== -1) {
        return { serverIndex, memberIndex };
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
      server.members.push(joining);
      return { serverId: picked.serverId, slot: picked.slot };
    },

    removeMember(playerId: string): MemberRemoval {
      const where = locate(playerId);
      if (where === null) {
        return { left: false, serverDestroyed: false };
      }
      const server = servers[where.serverIndex];
      server.members.splice(where.memberIndex, 1);
      if (server.members.length === 0) {
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
      if (target === undefined || target.members.length >= maxUsersPerServer) {
        return null;
      }

      current.members.splice(where.memberIndex, 1);
      target.members.push(playerId);
      if (current.members.length === 0) {
        servers.splice(where.serverIndex, 1);
      }
      return { slot: target.members.length };
    },

    plan(): Map<string, number> {
      return computeMovePlan(servers, maxUsersPerServer);
    },
  };
}
