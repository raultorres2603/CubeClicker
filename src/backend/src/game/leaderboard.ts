/**
 * Per-server live leaderboard core (feature `server-live-leaderboard`, T1).
 *
 * This module owns ranking, the snapshot builder and the per-server flush scheduler only —
 * no peers, no hub imports and no message shapes. It imports the protocol types/constant and
 * the injected `TimerFns`, so it stays pure and deterministic:
 *
 * - {@link buildLeaderboardSnapshot} takes one server's members **in registry/slot order**
 *   and returns the ranked top `limit` entries plus totals over **every** input member. A
 *   copy is sorted by `cubesCompleted` desc, `clicks` desc, then original index asc (the
 *   explicit equivalent of a stable sort, so the final tie-break is slot order). The input is
 *   never mutated and the clock is never read.
 * - {@link createLeaderboardCoalescer} schedules exactly one `flush(serverId)` per dirty
 *   server at `intervalMs` (the pinned {@link LEADERBOARD_INTERVAL_MS}, 1000 ms). Further
 *   marks inside the window are included in the pending flush; they do not schedule another.
 *   The timer entry is deleted before `flush` runs, so a callback that marks the same server
 *   dirty again starts a fresh window. `dropServer` clears one server's timer, `discard` is
 *   terminal (every timer is cleared and later marks are no-ops) and `pendingServers` exposes
 *   the pending-timer count for tests/observability.
 *
 * No snapshot is cached and no timer is created outside `markDirty`: the hub builds the
 * snapshot at flush time from live members, so ranks and totals can never be stale relative
 * to the roster or the counters.
 */

import type { TimerFns } from './broadcast.js';
import {
  LEADERBOARD_TOP_LIMIT,
  type LeaderboardEntry,
  type LeaderboardSnapshot,
} from './protocol.js';

/** The pinned per-server coalescing interval: at most one frame per server per second. */
export const LEADERBOARD_INTERVAL_MS = 1000;

/**
 * One server member as the hub supplies it, in registry/slot order.
 *
 * The shape is the leaderboard's whole universe: server-issued identity plus session
 * counters. There is deliberately no `accountId`, economy, coins or upgrade field.
 */
export interface LeaderboardMember {
  playerId: string;
  name: string;
  clicks: number;
  facesDestroyed: number;
  cubesCompleted: number;
}

/** One member plus its original slot index (the deterministic final tie-break). */
interface RankedMember {
  member: LeaderboardMember;
  index: number;
}

/**
 * Builds one server's ranked snapshot.
 *
 * `members` must be the server's current members in registry/slot order. `totals` sums all
 * of them (including any member outside the top `limit`); `entries` holds at most `limit`
 * fresh `{ playerId, name, cubesCompleted, clicks }` objects in rank order.
 */
export function buildLeaderboardSnapshot(
  serverId: number,
  at: number,
  members: readonly LeaderboardMember[],
  limit: number = LEADERBOARD_TOP_LIMIT,
): LeaderboardSnapshot {
  let cubesCompleted = 0;
  let clicks = 0;
  let facesDestroyed = 0;
  for (const member of members) {
    cubesCompleted += member.cubesCompleted;
    clicks += member.clicks;
    facesDestroyed += member.facesDestroyed;
  }

  const ranked: RankedMember[] = members.map((member, index) => ({ member, index }));
  ranked.sort(compareRankedMembers);

  const entries: LeaderboardEntry[] = ranked.slice(0, limit).map(({ member }) => ({
    playerId: member.playerId,
    name: member.name,
    cubesCompleted: member.cubesCompleted,
    clicks: member.clicks,
  }));

  return {
    serverId,
    at,
    entries,
    totals: { cubesCompleted, clicks, facesDestroyed },
  };
}

/** Cubes desc → clicks desc → original slot index asc (a total order, never name collation). */
function compareRankedMembers(a: RankedMember, b: RankedMember): number {
  if (a.member.cubesCompleted !== b.member.cubesCompleted) {
    return b.member.cubesCompleted - a.member.cubesCompleted;
  }
  if (a.member.clicks !== b.member.clicks) {
    return b.member.clicks - a.member.clicks;
  }
  return a.index - b.index;
}

/** The per-server flush scheduler the hub drives; every method is inert after `discard()`. */
export interface LeaderboardCoalescer {
  /** Marks one server dirty; schedules its single flush unless one is already pending. */
  markDirty(serverId: number): void;
  /** Clears that server's pending flush timer (a server destroyed or left empty). */
  dropServer(serverId: number): void;
  /** Terminal teardown: clears every pending timer and makes later calls no-ops. */
  discard(): void;
  /** Number of servers with a pending flush (tests/observability). */
  pendingServers(): number;
}

/**
 * Creates the per-server coalescer over the injected timers.
 *
 * The flush callback receives only the `serverId`: the hub builds the snapshot from live
 * members at that moment, so changes made inside the window are included and no snapshot is
 * ever queued or cached.
 */
export function createLeaderboardCoalescer(options: {
  intervalMs: number;
  timers: TimerFns;
  flush: (serverId: number) => void;
}): LeaderboardCoalescer {
  const { intervalMs, timers } = options;
  const onFlush = options.flush;
  const timersByServer = new Map<number, ReturnType<typeof setTimeout>>();
  let discarded = false;

  function onInterval(serverId: number): void {
    // Delete before flushing: a callback that marks the same server dirty starts a new window.
    timersByServer.delete(serverId);
    onFlush(serverId);
  }

  return {
    markDirty(serverId: number): void {
      if (discarded || timersByServer.has(serverId)) {
        return;
      }
      timersByServer.set(
        serverId,
        timers.setTimeout(() => onInterval(serverId), intervalMs),
      );
    },

    dropServer(serverId: number): void {
      if (discarded) {
        return;
      }
      const handle = timersByServer.get(serverId);
      if (handle !== undefined) {
        timers.clearTimeout(handle);
        timersByServer.delete(serverId);
      }
    },

    discard(): void {
      if (discarded) {
        return;
      }
      discarded = true;
      for (const handle of timersByServer.values()) {
        timers.clearTimeout(handle);
      }
      timersByServer.clear();
    },

    pendingServers(): number {
      return timersByServer.size;
    },
  };
}
