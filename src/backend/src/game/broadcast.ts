/**
 * Broadcast schedulers for the outbound path (feature `realtime-broadcast-batching`, T2).
 *
 * This module owns timing and aggregation only — no peers, no game state and no message
 * shapes. The hub calls the injected callbacks and performs the actual broadcasts, so the
 * schedulers stay pure, deterministic and unit-testable:
 *
 * - {@link createRemovalBatcher}: buffers accepted mini-cube removals per player for one
 *   window (`MINI_CUBE_BATCH_WINDOW_MS`, 40 ms). A group records the server of its **first**
 *   enqueue; ids keep acceptance order. One timer per batcher; `flush()` runs the callback
 *   synchronously at a window/boundary flush and `discard()` makes the batcher inert (hub
 *   shutdown).
 * - {@link createEconomyCoalescer}: buffers one absolute economy snapshot per account for
 *   one cadence interval (`ECONOMY_BROADCAST_INTERVAL_MS`, 250 ms). The highest write
 *   revision wins; a revision at or below the highest seen is ignored (so an async result
 *   that resolves late can never regress the published totals). One timer per account;
 *   `flush(userId)` sends the pending snapshot now and cancels that account's timer;
 *   `discard()` clears every timer/state and makes the coalescer inert.
 *
 * Time comes exclusively from the injected {@link TimerFns}, so tests use fake timers and
 * never sleep. Both callbacks are invoked after the pending maps are cleared, so a callback
 * that enqueues/queues again starts a fresh window instead of losing the update.
 */

import type { EconomyState, MiniCubeId } from './protocol.js';

/** The timer functions the schedulers use (fake timers in tests, the hub's timers in production). */
export interface TimerFns {
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
}

/** One player's pending removals, pinned to the server where they were accepted. */
export interface RemovalGroup {
  serverId: number;
  playerId: string;
  ids: MiniCubeId[];
}

/** Buffers accepted removals into one 40 ms window (one timer, one group per player). */
export interface RemovalBatcher {
  /** Adds one accepted id; starts the window on the first enqueue. */
  enqueue(serverId: number, playerId: string, id: MiniCubeId): void;
  /** Flushes every pending group now and clears the timer (boundary flush). */
  flush(): void;
  /** Clears the timer and drops pending ids; later calls are inert (hub shutdown). */
  discard(): void;
  /** Number of pending groups (tests/benchmark observability). */
  pendingGroups(): number;
}

/** Buffers one absolute economy snapshot per account at the highest pending revision. */
export interface EconomyCoalescer {
  /**
   * Records the latest absolute state with its write revision.
   * Ignores a revision at or below the account's highest queued revision.
   */
  queue(userId: string, revision: number, economy: EconomyState): void;
  /** Sends the highest-revision pending state now, cancels that account's timer. */
  flush(userId: string): void;
  /** Clears every account timer and pending state and makes the coalescer inert. */
  discard(): void;
  /** Number of accounts with a pending state (tests/benchmark observability). */
  pendingAccounts(): number;
}

/**
 * Creates the removal batcher over the injected timers.
 *
 * A per-player map keeps each group's ids in acceptance order; the map insertion order is
 * the groups' first-enqueue order, which is the flush order. The server of a later enqueue
 * for the same player does not replace the recorded one (a boundary flush moves/removes a
 * player between servers, so one window cannot legitimately span two servers).
 */
export function createRemovalBatcher(options: {
  windowMs: number;
  timers: TimerFns;
  flush: (groups: readonly RemovalGroup[]) => void;
}): RemovalBatcher {
  const { windowMs, timers } = options;
  const onFlush = options.flush;
  const groups = new Map<string, { serverId: number; ids: MiniCubeId[] }>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let discarded = false;

  function clearTimer(): void {
    if (timer !== null) {
      timers.clearTimeout(timer);
      timer = null;
    }
  }

  /** Snapshots and clears the pending groups, then invokes the callback synchronously. */
  function flushPending(): void {
    clearTimer();
    if (groups.size === 0) {
      return;
    }
    const pending: RemovalGroup[] = [];
    for (const [playerId, group] of groups) {
      pending.push({ serverId: group.serverId, playerId, ids: [...group.ids] });
    }
    groups.clear();
    onFlush(pending);
  }

  function onWindowElapsed(): void {
    timer = null;
    flushPending();
  }

  return {
    enqueue(serverId: number, playerId: string, id: MiniCubeId): void {
      if (discarded) {
        return;
      }
      const group = groups.get(playerId);
      if (group === undefined) {
        groups.set(playerId, { serverId, ids: [id] });
      } else {
        group.ids.push(id);
      }
      if (timer === null) {
        timer = timers.setTimeout(onWindowElapsed, windowMs);
      }
    },

    flush(): void {
      if (discarded) {
        return;
      }
      flushPending();
    },

    discard(): void {
      if (discarded) {
        return;
      }
      discarded = true;
      clearTimer();
      groups.clear();
    },

    pendingGroups(): number {
      return groups.size;
    },
  };
}

/** Defensive copy of the absolute economy totals (state is never mutated after receipt). */
function copyEconomy(economy: EconomyState): EconomyState {
  return {
    coins: economy.coins,
    clicks: economy.clicks,
    facesDestroyed: economy.facesDestroyed,
    cubesDestroyed: economy.cubesDestroyed,
  };
}

/**
 * Creates the per-account economy coalescer over the injected timers.
 *
 * `lastRevision` is never reset on flush: a result that resolves after its newer sibling
 * already flushed must still be dropped. `pending` holds only the highest-revision absolute
 * state per account, so the frame always carries totals and never deltas.
 */
export function createEconomyCoalescer(options: {
  intervalMs: number;
  timers: TimerFns;
  flush: (userId: string, revision: number, economy: EconomyState) => void;
}): EconomyCoalescer {
  const { intervalMs, timers } = options;
  const onFlush = options.flush;
  const pending = new Map<string, { revision: number; economy: EconomyState }>();
  const accountTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const lastRevision = new Map<string, number>();
  let discarded = false;

  function clearTimer(userId: string): void {
    const handle = accountTimers.get(userId);
    if (handle !== undefined) {
      timers.clearTimeout(handle);
      accountTimers.delete(userId);
    }
  }

  /** Sends the account's pending snapshot now (no pending entry is a no-op). */
  function flushAccount(userId: string): void {
    clearTimer(userId);
    const entry = pending.get(userId);
    if (entry === undefined) {
      return;
    }
    pending.delete(userId);
    onFlush(userId, entry.revision, copyEconomy(entry.economy));
  }

  function onInterval(userId: string): void {
    accountTimers.delete(userId);
    flushAccount(userId);
  }

  return {
    queue(userId: string, revision: number, economy: EconomyState): void {
      if (discarded) {
        return;
      }
      const highest = lastRevision.get(userId);
      if (highest !== undefined && revision <= highest) {
        return;
      }
      lastRevision.set(userId, revision);
      pending.set(userId, { revision, economy: copyEconomy(economy) });
      if (!accountTimers.has(userId)) {
        accountTimers.set(
          userId,
          timers.setTimeout(() => onInterval(userId), intervalMs),
        );
      }
    },

    flush(userId: string): void {
      if (discarded) {
        return;
      }
      flushAccount(userId);
    },

    discard(): void {
      if (discarded) {
        return;
      }
      discarded = true;
      for (const handle of accountTimers.values()) {
        timers.clearTimeout(handle);
      }
      accountTimers.clear();
      pending.clear();
    },

    pendingAccounts(): number {
      return pending.size;
    },
  };
}
