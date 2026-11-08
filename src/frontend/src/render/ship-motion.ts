/**
 * Cursor-ship motion math (T7; spec AC-42; plan § Cursor model).
 *
 * Layer: render math (`render/**`) — plain arithmetic and a small ring buffer. No DOM, no
 * three.js objects, no timers, no randomness: time and pointer deltas enter as parameters,
 * so every value is deterministic under test. The scene/cursor integration (T9) consumes
 * these helpers and only writes the resulting transforms.
 *
 * Pinned behaviour (AC-42, preserving the accepted spaceship-cursor values):
 * - follow smoothing `1 − exp(−dt / 240 ms)`;
 * - bank `rotation.z = clamp(−vx · 2.4, ±0.28)` and pitch
 *   `rotation.x = clamp(−vy · 1.6, ±0.18)` for pointer velocity in NDC per millisecond;
 * - idle bob `0.015 · sin(2π · t / 2600 ms)` world units on y;
 * - equip pulse `1 + 0.04 · sin(π · elapsed / 260 ms)` (exactly `1.04` at mid-duration,
 *   back to `1` at the end);
 * - fly-by roll `2π · easeInOutCubic(elapsed / 700 ms)`;
 * - an 8-point trail whose points expire after 220 ms.
 *
 * `dtMs === 0`, a rest pointer or reduced motion yields exact zero bank/pitch, no trail
 * points and scale `1` — {@link shipVelocityPerMs} returns `0` for a non-positive frame
 * delta, and every reduced-motion path returns the neutral pose.
 */

import { SPACESHIP_FOLLOW_TAU_MS } from '../game/effects';
import { MOTION, easeInOutCubic } from '../game/motion';

/** One recorded cursor-ship trail position. */
export interface ShipTrailPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Timestamp at which the point was recorded, in the caller's clock (milliseconds). */
  readonly atMs: number;
}

/**
 * Fixed-capacity cursor-ship trail (8 points, 220 ms lifetime).
 *
 * Points are stored oldest-first; when the buffer is full the oldest point is recycled.
 * Expired points (age ≥ `MOTION.trailLifetimeMs`) are dropped by {@link ShipTrail.prune},
 * which {@link ShipTrail.push} also runs before inserting.
 */
export interface ShipTrail {
  /** Maximum number of stored points (`MOTION.trailCount` unless overridden). */
  readonly capacity: number;
  /** Number of stored points, including not-yet-pruned expired ones. */
  readonly length: number;
  /** Snapshot of the stored points, oldest first. */
  readonly points: readonly ShipTrailPoint[];
  /**
   * Records one point. Reduced motion stores nothing, so a reduced-motion ship reports
   * zero trail points with no additional branch at the render site.
   */
  push(x: number, y: number, z: number, nowMs: number, reducedMotion?: boolean): void;
  /** Drops points whose age is at least `MOTION.trailLifetimeMs`. */
  prune(nowMs: number): void;
  /** Drops every stored point. */
  clear(): void;
}

/**
 * Follow smoothing factor for one frame (AC-42, predecessor AC-2).
 *
 * Non-reduced: `1 − exp(−max(dt, 0) / 240 ms)`, exactly `0` for `dtMs ≤ 0`; reduced motion
 * snaps at `1`.
 */
export function shipFollowFactor(dtMs: number, reducedMotion = false): number {
  if (reducedMotion) {
    return 1;
  }
  const clampedMs = dtMs > 0 ? dtMs : 0;
  return 1 - Math.exp(-clampedMs / SPACESHIP_FOLLOW_TAU_MS);
}

/**
 * Pointer velocity in NDC per millisecond. A non-positive or non-numeric frame delta
 * yields exactly `0`, so `dtMs === 0` can never produce an infinite bank/pitch.
 */
export function shipVelocityPerMs(delta: number, dtMs: number): number {
  return dtMs > 0 ? delta / dtMs : 0;
}

/** Bank angle in radians: `clamp(−vx · 2.4, ±0.28)` (AC-42). */
export function shipBankRad(vxPerMs: number, reducedMotion = false): number {
  if (reducedMotion) {
    return 0;
  }
  const bank = -vxPerMs * MOTION.shipBankGain;
  const clamped = Math.min(MOTION.shipBankMaxRad, Math.max(-MOTION.shipBankMaxRad, bank));
  // Normalise -0 so a rest pointer yields the exact positive zero pose.
  return clamped === 0 ? 0 : clamped;
}

/** Pitch angle in radians: `clamp(−vy · 1.6, ±0.18)` (AC-42). */
export function shipPitchRad(vyPerMs: number, reducedMotion = false): number {
  if (reducedMotion) {
    return 0;
  }
  const pitch = -vyPerMs * MOTION.shipPitchGain;
  const clamped = Math.min(
    MOTION.shipPitchMaxRad,
    Math.max(-MOTION.shipPitchMaxRad, pitch),
  );
  // Normalise -0 so a rest pointer yields the exact positive zero pose.
  return clamped === 0 ? 0 : clamped;
}

/** Idle bob offset on y in world units: `0.015 · sin(2π · t / 2600 ms)` (AC-42). */
export function shipIdleOffsetY(elapsedMs: number, reducedMotion = false): number {
  if (reducedMotion) {
    return 0;
  }
  const phase = 2 * Math.PI * (elapsedMs / MOTION.shipIdlePeriodMs);
  return MOTION.shipIdleAmplitude * Math.sin(phase);
}

/** Equip pulse scale: `1 → 1.04 → 1` over 260 ms; exactly `1` outside the window (AC-42). */
export function shipEquipPulseScale(elapsedMs: number, reducedMotion = false): number {
  if (reducedMotion || elapsedMs <= 0 || elapsedMs >= MOTION.equipPulseMs) {
    return 1;
  }
  const progress = elapsedMs / MOTION.equipPulseMs;
  return 1 + MOTION.equipPulseScale * Math.sin(Math.PI * progress);
}

/** Fly-by roll in radians: one 360° turn over 700 ms with `easeInOutCubic` (AC-40/AC-42). */
export function shipRollRad(elapsedMs: number, reducedMotion = false): number {
  if (reducedMotion) {
    return 0;
  }
  const clampedMs = elapsedMs > 0 ? Math.min(elapsedMs, MOTION.shipRollMs) : 0;
  return 2 * Math.PI * easeInOutCubic(clampedMs / MOTION.shipRollMs);
}

/**
 * Builds an empty trail ring buffer.
 *
 * @param capacity number of points kept (defaults to `MOTION.trailCount`, 8)
 */
export function createShipTrail(capacity: number = MOTION.trailCount): ShipTrail {
  const slots: Array<ShipTrailPoint | undefined> = new Array<ShipTrailPoint | undefined>(
    capacity,
  );
  let start = 0;
  let count = 0;

  function prune(nowMs: number): void {
    while (count > 0) {
      const oldest = slots[start];
      if (oldest === undefined || nowMs - oldest.atMs < MOTION.trailLifetimeMs) {
        return;
      }
      slots[start] = undefined;
      start = (start + 1) % capacity;
      count -= 1;
    }
  }

  function push(
    x: number,
    y: number,
    z: number,
    nowMs: number,
    reducedMotion = false,
  ): void {
    if (reducedMotion) {
      return;
    }
    prune(nowMs);
    const point: ShipTrailPoint = { x, y, z, atMs: nowMs };
    if (count === capacity) {
      slots[start] = point;
      start = (start + 1) % capacity;
      return;
    }
    slots[(start + count) % capacity] = point;
    count += 1;
  }

  function clear(): void {
    slots.fill(undefined);
    start = 0;
    count = 0;
  }

  return {
    capacity,
    get length(): number {
      return count;
    },
    get points(): readonly ShipTrailPoint[] {
      const snapshot: ShipTrailPoint[] = [];
      for (let index = 0; index < count; index += 1) {
        const point = slots[(start + index) % capacity];
        if (point !== undefined) {
          snapshot.push(point);
        }
      }
      return snapshot;
    },
    push,
    prune,
    clear,
  };
}
