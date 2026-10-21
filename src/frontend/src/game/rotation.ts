/**
 * Orientation, front face and rotation interpolation.
 *
 * Pure logic: no DOM, no three.js, no timers. An orientation is a pair of
 * quarter-turn counters (never radians), so every animation settles on an exact
 * multiple of `PI/2`; radians exist only inside {@link interpolateRotation}.
 *
 * **Rotation convention** — the frame the renderer applies (`scene.ts`, T12):
 *
 * - `rot.yaw` is the cube's rotation about the world `+Y` axis, `rot.pitch` is its
 *   rotation about `+X`; the renderer applies them in that order (`rotation.set(pitch, yaw, 0)`,
 *   the default three.js `'XYZ'` Euler order). Under exactly this composition the face
 *   returned by {@link frontFace} is the face pointing at the camera.
 * - A `+1` yaw step is `+90°` about `+Y`: the `front` face slides to the player's
 *   right and the `left` face arrives at the front (`left → back → right`, wrapping).
 * - A `+1` pitch step is `+90°` about `+X`: the `top` face tilts towards the player
 *   and arrives at the front. Pitch is clamped to ∓1 quarter turn, so `top`/`bottom`
 *   are reachable from any yaw.
 *
 * `rotation.test.ts` re-derives that geometry numerically: feeding
 * `interpolateRotation` output through `Rx(pitch)·Ry(yaw)` puts exactly the
 * `frontFace` normal at `(0, 0, 1)` for all six faces.
 */

import type { FaceId } from './types';

/** Rotation axes of a single step: `yaw` about `+Y`, `pitch` about `+X`. */
export type Axis = 'yaw' | 'pitch';

/**
 * A settled orientation: quarter-turn counters, never radians.
 * `yawSteps` is kept in `0..3` (yaw mod 4); `pitchSteps` is clamped to `-1 | 0 | 1`.
 */
export interface Orientation {
  yawSteps: number;
  pitchSteps: number;
}

/** One quarter turn in radians: the only rotation the game ever settles on. */
const QUARTER_TURN = Math.PI / 2;

/** Quarter turns in a full yaw revolution. */
const YAW_STEPS_PER_TURN = 4;

/** Folds any yaw counter into `0..3` (negative counters included). */
function normalizeYaw(yawSteps: number): number {
  return ((yawSteps % YAW_STEPS_PER_TURN) + YAW_STEPS_PER_TURN) % YAW_STEPS_PER_TURN;
}

/** Fresh orientation: nothing rotated, so the `front` face faces the camera. */
export function createOrientation(): Orientation {
  return { yawSteps: 0, pitchSteps: 0 };
}

/**
 * One immutable 90° step.
 *
 * - `yaw`: `direction` quarter turn about `+Y`, wrapped mod 4.
 * - `pitch`: `direction` quarter turn about `+X`, clamped to `-1 | 0 | 1` so the
 *   `top`/`bottom` faces stay reachable and the cube never flips over.
 */
export function rotateStep(o: Orientation, axis: Axis, direction: -1 | 1): Orientation {
  if (axis === 'yaw') {
    return { yawSteps: normalizeYaw(o.yawSteps + direction), pitchSteps: o.pitchSteps };
  }
  return {
    yawSteps: o.yawSteps,
    pitchSteps: Math.max(-1, Math.min(1, o.pitchSteps + direction)),
  };
}

/** The face a settled yaw brings to the front: 0 `front`, 1 `left`, 2 `back`, 3 `right`. */
function yawFace(yawSteps: number): FaceId {
  switch (normalizeYaw(yawSteps)) {
    case 1:
      return 'left';
    case 2:
      return 'back';
    case 3:
      return 'right';
    default:
      return 'front';
  }
}

/**
 * The face currently pointing at the camera. A non-zero pitch faces a pole
 * (`top`/`bottom`) from any yaw — exactly what the ±90° pole rotations render.
 */
export function frontFace(o: Orientation): FaceId {
  if (o.pitchSteps > 0) {
    return 'top';
  }
  if (o.pitchSteps < 0) {
    return 'bottom';
  }
  return yawFace(o.yawSteps);
}

/** Shortest signed yaw distance in quarter turns: `-1 | 0 | 1 | 2`. */
function shortestYawDelta(fromYawSteps: number, toYawSteps: number): number {
  const delta = normalizeYaw(toYawSteps - fromYawSteps); // 0..3
  // Three steps forward are one step backwards; a half turn stays a half turn.
  return delta > YAW_STEPS_PER_TURN / 2 ? delta - YAW_STEPS_PER_TURN : delta;
}

/**
 * The cube rotation `t` of the way from `from` to `to`, in radians
 * (`rotation.y = yaw`, `rotation.x = pitch`). `t` is eased by the caller.
 *
 * Yaw takes the shortest way round (so `3 → 0` animates `+90°`, not `-270°`);
 * pitch interpolates linearly between the poles. At `t = 1` both values are exact
 * multiples of `PI/2` — the settle state required by AC-6.
 */
export function interpolateRotation(
  from: Orientation,
  to: Orientation,
  t: number,
): { yaw: number; pitch: number } {
  const yawDelta = shortestYawDelta(from.yawSteps, to.yawSteps);
  return {
    yaw: (from.yawSteps + yawDelta * t) * QUARTER_TURN,
    pitch: (from.pitchSteps + (to.pitchSteps - from.pitchSteps) * t) * QUARTER_TURN,
  };
}
