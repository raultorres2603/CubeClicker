/**
 * Per-server activity feed core (feature `live-activity-feed`, T1).
 *
 * This module owns timing, the per-server id sequence and the bounded ring only — no peers,
 * no message shapes and no game state. The hub derives an already validated transition into
 * an {@link ActivityEventInput}, offers it to {@link ActivityFeed.record}, and broadcasts the
 * returned event (if any) through its existing encode-once fan-out.
 *
 * Pinned rules (spec § Event catalog and thresholds / § Cadence / § Buffer):
 * - per-server state is lazy `{ nextId, lastAcceptedAt, events }`; `nextId` starts at 1 for
 *   every server and advances only on acceptance, so two servers' first events both have
 *   `id: 1` and a dropped candidate never consumes an id;
 * - each server accepts at most one event per trailing window (`ACTIVITY_MIN_INTERVAL_MS`,
 *   inclusive boundary `at - lastAcceptedAt >= minIntervalMs`); a candidate inside the
 *   window is dropped, not queued: it changes no id, no ring and no window;
 * - the ring keeps the newest `ACTIVITY_FEED_LIMIT` accepted events, `index 0` newest;
 * - an event is fresh iff `now - event.at < ACTIVITY_EVENT_TTL_MS` (5000 ms): `snapshot`
 *   returns only fresh events, newest first, and `record`/`snapshot` prune the always-expired
 *   tail in place; pruning changes neither `nextId` nor `lastAcceptedAt`, so ids keep
 *   advancing monotonically and the 1 s gate is unaffected;
 * - `snapshot` returns a fresh array of fresh objects (`[]` for unknown/empty servers);
 * - `dropServer` deletes one server's state and `clear()` is terminal for the instance:
 *   after it `record` returns `null`, `snapshot` returns `[]`, `dropServer` and a second
 *   `clear()` are no-ops;
 * - no timer is created in any path: the gate is a timestamp comparison on the low-frequency
 *   candidate paths, and time comes only from the injected clock.
 */

import {
  ACTIVITY_EVENT_TTL_MS,
  ACTIVITY_FEED_LIMIT,
  copyActivityEvent,
  type ActivityEvent,
} from './protocol.js';

/** The inclusive per-server acceptance window in milliseconds (at most one event/second). */
export const ACTIVITY_MIN_INTERVAL_MS = 1000;

/** Every Nth completed cube is a `levelMilestone` (the first is cube 5). */
export const ACTIVITY_MILESTONE_EVERY = 5;

/**
 * One candidate event as the hub derives it: everything except the feed-owned `id`/`at` and
 * the server key (passed to `record`). The type union is closed; no client value can add a
 * type or a field.
 */
export type ActivityEventInput =
  | { type: 'cubeCleared'; playerId: string; name: string; level: number }
  | { type: 'fastClear'; playerId: string; name: string; level: number; elapsedMs: number }
  | { type: 'levelMilestone'; playerId: string; name: string; level: number }
  | { type: 'epicLoot'; playerId: string; name: string; partId: string }
  | { type: 'memberJoined'; playerId: string; name: string }
  | { type: 'memberLeft'; playerId: string; name: string };

/** One server's feed state (created on the first accepted event, deleted on drop/clear). */
interface FeedState {
  /** The id the next accepted event receives; starts at 1 per server. */
  nextId: number;
  /** The clock value of the last acceptance; `null` until the first accepted event. */
  lastAcceptedAt: number | null;
  /** Accepted events, newest first, at most the configured limit. */
  events: ActivityEvent[];
}

/** The feed facade the hub drives; every method is inert after `clear()`. */
export interface ActivityFeed {
  /**
   * Offers one candidate to the server's gate.
   *
   * Returns a fresh copy of the accepted event (with `id`/`at`/`serverId` assigned) or
   * `null` when the candidate falls inside the window or the feed is closed. A dropped
   * candidate consumes no id, changes no ring entry and does not move the window.
   */
  record(serverId: number, input: ActivityEventInput): ActivityEvent | null;
  /**
   * The server's fresh ring, newest first, as fresh objects; `[]` when unknown, empty or
   * every stored event is at least `ttlMs` old. Expired events are pruned from the ring.
   */
  snapshot(serverId: number): ActivityEvent[];
  /** Deletes one server's ring; a no-op after `clear()`. */
  dropServer(serverId: number): void;
  /** Terminal teardown: closes the instance and clears every ring. */
  clear(): void;
}

/**
 * Creates one activity feed over the injected clock.
 *
 * `now` is the only time source (the hub passes `HubDeps.now`); `limit`/`minIntervalMs`/
 * `ttlMs` default to the pinned constants and exist so tests can pin smaller windows or a
 * long eligibility TTL without changing production values. The factory creates no timer.
 */
export function createActivityFeed(options: {
  now: () => number;
  limit?: number;
  minIntervalMs?: number;
  ttlMs?: number;
}): ActivityFeed {
  const { now } = options;
  const limit = options.limit ?? ACTIVITY_FEED_LIMIT;
  const minIntervalMs = options.minIntervalMs ?? ACTIVITY_MIN_INTERVAL_MS;
  const ttlMs = options.ttlMs ?? ACTIVITY_EVENT_TTL_MS;
  const servers = new Map<number, FeedState>();
  let closed = false;

  return {
    record(serverId: number, input: ActivityEventInput): ActivityEvent | null {
      if (closed) {
        return null;
      }
      const at = now();
      const existing = servers.get(serverId);
      if (existing !== undefined) {
        // Every access drops the always-expired suffix; ids and the gate stay untouched.
        pruneExpired(existing, at, ttlMs);
      }
      if (
        existing !== undefined &&
        existing.lastAcceptedAt !== null &&
        at - existing.lastAcceptedAt < minIntervalMs
      ) {
        // Dropped, not queued: no id, no ring entry and no window move.
        return null;
      }

      const state = existing ?? { nextId: 1, lastAcceptedAt: null, events: [] };
      const event = buildAcceptedEvent(state.nextId, at, serverId, input);
      state.nextId += 1;
      state.lastAcceptedAt = at;
      state.events.unshift(event);
      if (state.events.length > limit) {
        state.events.length = limit;
      }
      servers.set(serverId, state);
      return copyActivityEvent(event);
    },

    snapshot(serverId: number): ActivityEvent[] {
      if (closed) {
        return [];
      }
      const state = servers.get(serverId);
      if (state === undefined) {
        return [];
      }
      pruneExpired(state, now(), ttlMs);
      return state.events.map(copyActivityEvent);
    },

    dropServer(serverId: number): void {
      if (closed) {
        return;
      }
      servers.delete(serverId);
    },

    clear(): void {
      if (closed) {
        return;
      }
      closed = true;
      servers.clear();
    },
  };
}

/**
 * Drops the expired suffix of the ring (`now - event.at >= ttlMs`) in place.
 *
 * Events are stored newest first and `at` is non-decreasing down the array, so everything
 * from the first expired entry to the end is expired too. Only `events` is touched: the id
 * sequence and the acceptance window survive pruning.
 */
function pruneExpired(state: FeedState, now: number, ttlMs: number): void {
  const expiredFrom = state.events.findIndex((event) => now - event.at >= ttlMs);
  if (expiredFrom !== -1) {
    state.events.length = expiredFrom;
  }
}

/**
 * Builds one accepted event in the pinned wire key order (`id`, `at`, `serverId`, `type`,
 * `playerId`, `name`, then `level` / `elapsedMs` / `partId`).
 */
function buildAcceptedEvent(
  id: number,
  at: number,
  serverId: number,
  input: ActivityEventInput,
): ActivityEvent {
  switch (input.type) {
    case 'cubeCleared':
      return {
        id,
        at,
        serverId,
        type: 'cubeCleared',
        playerId: input.playerId,
        name: input.name,
        level: input.level,
      };

    case 'fastClear':
      return {
        id,
        at,
        serverId,
        type: 'fastClear',
        playerId: input.playerId,
        name: input.name,
        level: input.level,
        elapsedMs: input.elapsedMs,
      };

    case 'levelMilestone':
      return {
        id,
        at,
        serverId,
        type: 'levelMilestone',
        playerId: input.playerId,
        name: input.name,
        level: input.level,
      };

    case 'epicLoot':
      return {
        id,
        at,
        serverId,
        type: 'epicLoot',
        playerId: input.playerId,
        name: input.name,
        partId: input.partId,
      };

    case 'memberJoined':
      return {
        id,
        at,
        serverId,
        type: 'memberJoined',
        playerId: input.playerId,
        name: input.name,
      };

    case 'memberLeft':
      return {
        id,
        at,
        serverId,
        type: 'memberLeft',
        playerId: input.playerId,
        name: input.name,
      };
  }
}
