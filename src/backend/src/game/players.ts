/**
 * Ephemeral player identity and reconnect grace tracking (T2).
 *
 * Identity is server-issued and in-memory only (spec § 3, AC-6/AC-8): a monotonic counter
 * yields `playerId` `p<N>` and display name `Player <N>`, and a 128-bit CSPRNG token
 * (`crypto.randomBytes(16)` → 32 lowercase hex chars) is the session credential. Nothing
 * here touches storage, cookies or the filesystem.
 *
 * The grace window (spec § 3, AC-7) is a pure mapping `playerId → deadline`:
 * `begin` stamps `now() + graceMs`, `expired` compares the caller-supplied `nowMs` against
 * that deadline (expired at exactly the deadline), and `cancel` drops it. Time is injected
 * (`now`), so there are no wall-clock reads and no timers inside this module — the hub
 * owns scheduling and drives expiry checks with its own injected clock/timers.
 */

import { randomBytes } from 'node:crypto';

/** Pinned token length in bytes: 16 bytes → 32 hex chars (spec § Pinned constants). */
const TOKEN_BYTES = 16;

/** An ephemeral identity issued on `join`; never persisted (AC-6). */
export interface PlayerRecord {
  /** `p<N>` from the monotonic player counter. */
  playerId: string;
  /** `Player <N>` — same counter as `playerId`, so names are unique and stable (AC-8). */
  name: string;
  /** 32 lowercase hex chars from `crypto.randomBytes(16)` (AC-6). */
  token: string;
}

/**
 * Creates the identity record for the `counter`-th player.
 *
 * The counter is owned by the hub (monotonic, starting at 1); this function only formats
 * it, so `counter` 1 → `p1` / `Player 1`. The token is freshly drawn per call.
 */
export function createPlayerRecord(counter: number): PlayerRecord {
  return {
    playerId: `p${counter}`,
    name: `Player ${counter}`,
    token: randomBytes(TOKEN_BYTES).toString('hex'),
  };
}

/**
 * Reconnect grace windows keyed by player id (spec § 3, AC-7).
 *
 * A member stays in the world and roster for the whole window; the hub removes them only
 * after {@link GraceTracker.expired} reports true.
 */
export interface GraceTracker {
  /** Starts (or restarts) the window for a player, anchored at the injected clock's now. */
  begin(playerId: string): void;
  /** The deadline in clock milliseconds, or `Infinity` when the player has no window. */
  expiresAt(playerId: string): number;
  /** Drops the window (successful resume, or removal already handled). No-op if absent. */
  cancel(playerId: string): void;
  /** Whether the window has ended at `nowMs` — true at exactly the deadline. */
  expired(playerId: string, nowMs: number): boolean;
}

/** Injected dependencies for {@link createGraceTracker}. */
export interface GraceTrackerOptions {
  /** Window length in milliseconds — `GameConfig.reconnectGraceMs` (`RECONNECT_GRACE_MS`). */
  graceMs: number;
  /** Injectable clock in milliseconds since the epoch (the hub passes its `now`). */
  now: () => number;
}

/**
 * Creates a grace tracker over the injected clock.
 *
 * Expiry is evaluated by comparison (not scheduled), which keeps the boundary exact and
 * the logic deterministic: `expired(id, t)` is true iff `t >= expiresAt(id)`.
 */
export function createGraceTracker(options: GraceTrackerOptions): GraceTracker {
  const { graceMs, now } = options;
  const deadlines = new Map<string, number>();

  return {
    begin(playerId: string): void {
      deadlines.set(playerId, now() + graceMs);
    },

    expiresAt(playerId: string): number {
      return deadlines.get(playerId) ?? Number.POSITIVE_INFINITY;
    },

    cancel(playerId: string): void {
      deadlines.delete(playerId);
    },

    expired(playerId: string, nowMs: number): boolean {
      const deadline = deadlines.get(playerId);
      return deadline !== undefined && nowMs >= deadline;
    },
  };
}
