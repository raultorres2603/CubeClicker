/**
 * Client-side activity display lifetime (`presence-and-activity-liveness`, AC-15…AC-18).
 *
 * The server owns *eligibility*: `activity.snapshot` only carries events younger than
 * `ACTIVITY_EVENT_TTL_MS` (5000 ms), so an expired event can never travel in a
 * `welcome`/`worldEntered`. This module owns the *display* guarantee on top of it: every
 * event that enters the current feed or the pending cross-server travel feed is tracked
 * by a first-seen local deadline, and an event whose deadline has passed is removed from
 * the published world even when no newer frame arrives.
 *
 * **Keying.** Deadlines and tombstones are keyed by `serverId` then event `id` (server ids
 * are never reused and per-server event ids are monotonic, so `serverId:id` names one
 * event for the life of the process). A same-server rejoin that re-seeds the same event
 * therefore keeps its remaining lifetime; a fresh join on a different server uses a
 * separate namespace even when the numeric ids collide (both start at 1).
 *
 * **First-seen only.** `observe` records `nowMs + ttlMs` only for a key it has never seen
 * (no deadline, no active tombstone). Re-observing the same event never extends it.
 *
 * **Tombstones.** When an observed deadline is at or before `nowMs`, the key moves to a
 * tombstone that lasts `ttlMs` from the observation that found it expired (`nowMs +
 * ttlMs`). `isExpired` answers `true` while the tombstone is active, so a boundary
 * reconnect that re-seeds a locally expired event is filtered by the session's
 * synchronous prune and can never re-enter the published feed. Once the tombstone window
 * elapses the key is forgotten and a later seed would be tracked fresh again. A live
 * server's deadline is retained even after its line leaves the feed, so a prune-only
 * fallback tick cannot lose the expiry: the next `observe` converts it to a tombstone
 * before the re-seed is considered.
 *
 * **Bounded.** `observe(feeds, _)` treats the supplied feeds — the current server's feed
 * and, while travelling, the pending target's feed — as the complete live set: deadlines
 * and tombstones of every other server are dropped, and expired tombstones are pruned.
 * A live server's keys live at most two TTL windows from first sight (display deadline,
 * then tombstone), so the state is bounded by the events observed in that window instead
 * of growing with the session. `size()` exposes the live count for tests and
 * observability.
 *
 * Pure and DOM-free: no timers and no clock. Time is always the caller's `nowMs` (the
 * session's local clock); `ACTIVITY_EXPIRY_TICK_MS` is only the cadence the session uses
 * for its fallback prune, never a timer created here.
 */

import type { ActivityEvent } from './protocol';

/**
 * Fallback prune cadence owned by the session (AC-18): when no world reduction occurs, an
 * expired event is removed at the first tick at or after its display deadline (≤ 250 ms
 * late). Every reduction prunes synchronously before publishing, so this is only the
 * fallback for time passing.
 */
export const ACTIVITY_EXPIRY_TICK_MS = 250;

/** One feed slice observed by the lifetime: a server id plus its newest-first events. */
export interface ActivityFeedSlice {
  serverId: number;
  events: readonly ActivityEvent[];
}

/**
 * The display-lifetime bookkeeping handle. One instance per session attach cycle; the
 * session calls {@link ActivityLifetime.observe} after every world reduction and after
 * the travel-midpoint swap, then prunes with {@link ActivityLifetime.isExpired}.
 */
export interface ActivityLifetime {
  /**
   * Tracks first-seen deadlines for every event of `feeds` at `nowMs`, moves deadlines
   * that have passed to tombstones, prunes expired tombstones and drops the deadlines and
   * tombstones of every server that is neither current nor pending.
   */
  observe(feeds: readonly ActivityFeedSlice[], nowMs: number): void;
  /** True when the key's display deadline is at/before `nowMs`, or it is tombstoned. */
  isExpired(serverId: number, eventId: number, nowMs: number): boolean;
  /** Drops a server's deadlines and tombstones (the server is no longer current/pending). */
  dropServer(serverId: number): void;
  /** Clears every deadline and tombstone (session teardown). */
  clear(): void;
  /** The number of live deadlines plus tombstones (bounded by the feeds, tests only). */
  size(): number;
}

/** Constructor options: the display lifetime, injected from `ACTIVITY_EVENT_TTL_MS`. */
export interface ActivityLifetimeOptions {
  ttlMs: number;
}

/** `serverId` → `eventId` → timestamp (deadline, or tombstone end, for one map each). */
type ServerKeys = Map<number, Map<number, number>>;

/**
 * Creates one display-lifetime tracker. `ttlMs` is the display lifetime of every event
 * (the session passes `ACTIVITY_EVENT_TTL_MS`); tests may pin a shorter value to prove it
 * is not hard-coded.
 */
export function createActivityLifetime(options: ActivityLifetimeOptions): ActivityLifetime {
  const { ttlMs } = options;
  // A key is in at most one of the two maps: its deadline, or its tombstone end.
  const deadlines: ServerKeys = new Map();
  const tombstones: ServerKeys = new Map();

  function removeIfEmpty(keys: ServerKeys, serverId: number, inner: Map<number, number>): void {
    if (inner.size === 0) {
      keys.delete(serverId);
    }
  }

  return {
    observe(feeds: readonly ActivityFeedSlice[], nowMs: number): void {
      const liveServers = new Set<number>();
      for (const feed of feeds) {
        liveServers.add(feed.serverId);
      }

      // 1. Drop deadlines of servers that are neither current nor pending, and move every
      //    expired remaining deadline to a tombstone that lasts one TTL from this observation.
      for (const [serverId, inner] of [...deadlines]) {
        if (!liveServers.has(serverId)) {
          deadlines.delete(serverId);
          continue;
        }
        let serverTombstones = tombstones.get(serverId);
        for (const [eventId, deadline] of [...inner]) {
          if (deadline > nowMs) {
            continue;
          }
          inner.delete(eventId);
          if (serverTombstones === undefined) {
            serverTombstones = new Map();
            tombstones.set(serverId, serverTombstones);
          }
          serverTombstones.set(eventId, nowMs + ttlMs);
        }
        removeIfEmpty(deadlines, serverId, inner);
      }

      // 2. Drop tombstones of servers that are neither current nor pending, and prune the
      //    tombstones whose window has elapsed.
      for (const [serverId, inner] of [...tombstones]) {
        if (!liveServers.has(serverId)) {
          tombstones.delete(serverId);
          continue;
        }
        for (const [eventId, tombstonedUntil] of [...inner]) {
          if (tombstonedUntil <= nowMs) {
            inner.delete(eventId);
          }
        }
        removeIfEmpty(tombstones, serverId, inner);
      }

      // 3. Record a first-seen deadline for every event that has no deadline and is not
      //    tombstoned. A re-seed of a known key never moves its existing deadline.
      for (const feed of feeds) {
        const serverTombstones = tombstones.get(feed.serverId);
        let serverDeadlines = deadlines.get(feed.serverId);
        for (const event of feed.events) {
          if (serverTombstones !== undefined && serverTombstones.has(event.id)) {
            continue;
          }
          if (serverDeadlines === undefined) {
            serverDeadlines = new Map();
            deadlines.set(feed.serverId, serverDeadlines);
          }
          if (!serverDeadlines.has(event.id)) {
            serverDeadlines.set(event.id, nowMs + ttlMs);
          }
        }
      }
    },

    isExpired(serverId: number, eventId: number, nowMs: number): boolean {
      const tombstonedUntil = tombstones.get(serverId)?.get(eventId);
      if (tombstonedUntil !== undefined && nowMs < tombstonedUntil) {
        return true;
      }
      const deadline = deadlines.get(serverId)?.get(eventId);
      return deadline !== undefined && deadline <= nowMs;
    },

    dropServer(serverId: number): void {
      deadlines.delete(serverId);
      tombstones.delete(serverId);
    },

    clear(): void {
      deadlines.clear();
      tombstones.clear();
    },

    size(): number {
      let total = 0;
      for (const inner of deadlines.values()) {
        total += inner.size;
      }
      for (const inner of tombstones.values()) {
        total += inner.size;
      }
      return total;
    },
  };
}
