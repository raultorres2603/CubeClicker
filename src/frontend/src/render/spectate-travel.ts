/**
 * Spectate flight pose math (T11; plan § Interfaces `render/spectate-travel.ts`; spec
 * AC-17, § 6).
 *
 * Layer: render math (`render/**`) — plain arithmetic, no three.js objects, no DOM, no
 * engine or authority state. The scene (T12) calls this each frame to place the camera
 * during a `spectate`/`return` flight; the destination is always the server-assigned
 * member position, and this module only shapes the interpolation.
 *
 * The accepted flight formula is reused verbatim, not re-derived:
 *
 * - lateral interpolation `easeInOutQuad(p)` (`game/effects.ts`), exactly as the scene's
 *   accepted directional travel applies its offset: `x = fromX + dx · easeInOutQuad(p)`
 *   (the same construction as `scene.ts` `travelCameraPose`);
 * - depth `z = 12 + 78 · travelSwing(p)` (rest `12` → turn-around `90` → rest `12`, the
 *   scene's `REST_Z`/`TRAVEL_END_Z` constants and `travelSwing` from `game/effects.ts`);
 * - look target `(x(p), y(p), 0)`, so the camera looks straight down the view axis with
 *   its up vector `(0, 1, 0)` and the quaternion is the identity at every `p`;
 * - `progress` clamped to `[0, 1]`, like the accepted pose function.
 *
 * A flight whose endpoints share the same lateral `(x, y)` is the rest pose at every
 * progress: the depth deliberately does not swing, because there is nowhere to fly. This
 * is the pinned `origin === destination` behaviour and it also prevents a pointless
 * 78-unit pull-back when a spectate request targets the current position.
 *
 * Endpoint `z` is accepted so pose-shaped 3D call sites (`{ x, y, z: 12 }`) typecheck, but
 * it does not enter the formula: the rest depth is the pinned `12` and the flight always
 * starts and ends there.
 */

import { easeInOutQuad, travelSwing } from '../game/effects';

/** Camera rest distance — the accepted gameplay rest pose. */
const REST_Z = 12;

/** Depth the travel adds at its turn-around: `90 − 12` in the accepted z table. */
const TRAVEL_RISE_Z = 78;

/**
 * One lateral endpoint of a flight. `z` is optional and unused by the formula (see the
 * module header); it exists for call sites that already hold a 3D rest pose.
 */
export interface FlightEndpoint {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}

/** A camera pose point: the camera position or the point it looks at. */
export interface PosePoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** The camera pose for one instant of a spectate flight. */
export interface SpectateTravelPose {
  readonly position: PosePoint;
  readonly lookTarget: PosePoint;
}

/**
 * Pose of the camera at `progress` of a flight from `origin` to `destination` (AC-17).
 *
 * Lateral: `origin + (destination − origin) · easeInOutQuad(clamp(progress, 0, 1))`.
 * Depth: `12 + 78 · travelSwing(clamp(progress, 0, 1))`. Look target: the lateral point
 * `(x, y, 0)`. Coincident lateral endpoints return `(origin.x, origin.y, 12)` looking at
 * `(origin.x, origin.y, 0)` at every progress.
 */
export function travelCameraPose(
  origin: FlightEndpoint,
  destination: FlightEndpoint,
  progress: number,
): SpectateTravelPose {
  const clamped = Math.min(1, Math.max(0, progress));
  const dx = destination.x - origin.x;
  const dy = destination.y - origin.y;

  if (dx === 0 && dy === 0) {
    return {
      position: { x: origin.x, y: origin.y, z: REST_Z },
      lookTarget: { x: origin.x, y: origin.y, z: 0 },
    };
  }

  const lateral = easeInOutQuad(clamped);
  const x = origin.x + dx * lateral;
  const y = origin.y + dy * lateral;

  return {
    position: { x, y, z: REST_Z + TRAVEL_RISE_Z * travelSwing(clamped) },
    lookTarget: { x, y, z: 0 },
  };
}
