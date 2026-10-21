/**
 * Procedural galaxy backdrop: a camera-anchored, view-axis **square** cone volume
 * (follow-up plan § `render/starfield.ts`, r2; spec AC-1 / AC-16).
 *
 * Exactly one `THREE.Points` object holds exactly {@link STAR_COUNT} stars. Every star is
 * drawn from the injected random source (four draws per star, in `x → y → depth →
 * brightness` order), so the same seed always produces the same sky: the backdrop is
 * deterministic, testable and loaded from nothing (plan § Asset strategy — all visuals are
 * procedural).
 *
 * **Distribution (spec AC-1).** Each star sits on the **square** cone
 * `depth ∈ [STARFIELD_DEPTH_NEAR, STARFIELD_DEPTH_FAR]` with the local position
 * `x = (draw − 0.5) · 2 · depth · STARFIELD_TAN`, `y = (draw − 0.5) · 2 · depth ·
 * STARFIELD_TAN`, `z = −depth` — one half-tangent for both axes (r2 correction: the r1
 * rectangle was not rotation-invariant). The square's inradius ({@link STARFIELD_TAN})
 * exceeds the largest supported viewport circumradius (`1.1840` at 21:9), so its
 * cross-section contains the frustum cross-section at every depth and at **every swirl
 * angle**; the uniform-in-slope distribution keeps the on-screen density constant over
 * depth and aspect (spec § 1).
 *
 * **Anchor and swirl (spec AC-1).** `update` re-anchors the `Points` to the caller's camera
 * pose: `position = anchor.position`, `quaternion = anchor.quaternion × RotZ(swirlAngle)`
 * with `swirlAngle += max(0, dtMs) · DRIFT_RADIANS_PER_MS`. The swirl is about the **view
 * axis**, under which the square is rotation-invariant in the coverage sense (every
 * direction within its inradius is inside), so coverage can never degrade over time (the
 * predecessor's world-y drift rotated a bounded disk until one side of the frame went
 * starless — the reported defect; r1's rectangular cone failed the same way at 45° and was
 * corrected to the square in r2). With no anchor the starfield anchors to the
 * world-identity pose. The preallocated swirl quaternion and the caller-owned anchor
 * references allocate nothing per frame.
 *
 * **Expansion (spec AC-3).** The travel input drives the uniform in-plane scale
 * `(S, S, 1)` about the anchor (= the screen centre), `S = 1 + (TRAVEL_STARFIELD_SCALE − 1)
 * · travelSwing(clamp(progress))`; `z` stays `1`, so the expansion never moves a star out of
 * the camera's far plane. `S ≥ 1` at every progress, so the expanded backdrop remains a
 * superset of the cone (coverage at the scale-8 turn-around is asserted in
 * `scene.test.ts`).
 *
 * `STAR_COUNT`, {@link TRAVEL_STARFIELD_SCALE} and {@link travelSwing} are imported from
 * `game/effects.ts`, the single home for the non-grid pinned constants and easings
 * (plan § Constant homes — never redefined locally).
 */

import {
  BufferAttribute,
  BufferGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  Vector3,
} from 'three';

import { STAR_COUNT, TRAVEL_STARFIELD_SCALE, travelSwing } from '../game/effects';

/**
 * Nearest star depth along the view axis (spec AC-1). Every star lies at
 * `z = −depth` in the anchored local frame, i.e. this many units in front of the camera.
 */
export const STARFIELD_DEPTH_NEAR = 20;

/** Farthest star depth along the view axis — inside the camera far plane (200) (AC-1). */
export const STARFIELD_DEPTH_FAR = 160;

/** Widest supported aspect ratio: 21:9 ultrawide (spec AC-1). */
const STARFIELD_ASPECT_MAX = 7 / 3;

/** Coverage margin over the supported frustum (spec AC-1): 15%. */
const STARFIELD_COVERAGE_MARGIN = 0.15;

/**
 * Single half-angle tangent of the **square** cone, used for both axes:
 * `tan(25°) · STARFIELD_ASPECT_MAX · (1 + STARFIELD_COVERAGE_MARGIN) = 1.251258882715913`
 * — the 50° vertical lens's half angle (25°), the widest supported aspect (21:9) and the
 * coverage margin. This is the inradius of the square cross-section; it exceeds the largest
 * supported viewport circumradius (`√((tan25° · 7/3)² + tan²25°) = 1.1840`), so the volume
 * covers the viewport at every depth and every swirl angle (spec AC-1, r2). It is the
 * frustum-coverage contract itself; `scene.test.ts` verifies it against the real camera's
 * corner rays, so a divergent lens or aspect bound fails the build (plan D-4).
 */
export const STARFIELD_TAN =
  Math.tan((Math.PI * 50) / 360) * STARFIELD_ASPECT_MAX * (1 + STARFIELD_COVERAGE_MARGIN);

/** World-space point size of a star (attenuated by distance). */
const STAR_SIZE = 0.6;

/** Brightness of the dimmest star; the brightest star is exactly 1. */
const STAR_MIN_BRIGHTNESS = 0.5;

/**
 * Swirl rate: `2^-16 = 1/65536` radians per millisecond (≈ 0.015259 rad/s — a full slow
 * turn in about 6.9 minutes). A power of two, so any integer `dtMs` scales exactly and
 * tests can pin exact swirl angles. Retained from the predecessor's drift (spec AC-1).
 */
const DRIFT_RADIANS_PER_MS = 1 / 65536;

/** The view axis the cone is anchored along and the swirl turns about. */
const VIEW_AXIS = new Vector3(0, 0, 1);

/** World-identity anchor position used when the caller passes no anchor. */
const WORLD_IDENTITY_POSITION = new Vector3(0, 0, 0);

/** World-identity anchor orientation used when the caller passes no anchor. */
const WORLD_IDENTITY_QUATERNION = new Quaternion();

/** Camera pose the starfield anchors to (caller-owned references; never copied per frame). */
export interface StarfieldAnchor {
  /** The camera's live position vector. */
  position: Vector3;
  /** The camera's live orientation quaternion. */
  quaternion: Quaternion;
}

/** The galaxy backdrop: one starfield `Points` object plus its frame-update hooks. */
export interface Starfield {
  /** The single `THREE.Points` drawable holding every star (AC-16: one object, never rebuilt). */
  readonly points: Points<BufferGeometry, PointsMaterial>;
  /**
   * Advances the backdrop by `dtMs` milliseconds, re-anchors it to `anchor` and applies the
   * travel scale.
   *
   * - Swirl: `swirlAngle += max(0, dtMs) · DRIFT_RADIANS_PER_MS`; the anchored quaternion is
   *   `anchor.quaternion × RotZ(swirlAngle)` (no anchor → the world-identity pose).
   * - Anchor: `points.position` copies `anchor.position` (no anchor → the origin).
   * - Scale: `travelProgress` (0..1, clamped) drives the uniform in-plane scale
   *   `(S, S, 1)` with `S = 1 + (TRAVEL_STARFIELD_SCALE − 1) · travelSwing(progress)`; `z`
   *   stays `1`. Omit it to keep the current scale — the frame loop feeds the travel
   *   progress only while the travel phase runs (spec AC-1/AC-3).
   *
   * The anchor references and the swirl quaternion are preallocated: no per-frame allocation.
   */
  update(dtMs: number, travelProgress?: number, anchor?: StarfieldAnchor): void;
  /** Releases the geometry and material of the starfield. */
  dispose(): void;
}

/**
 * Builds the galaxy starfield from `random`.
 *
 * Draw order per star (four draws): `x`, `y`, `depth` (mapped onto the cone), then the
 * per-star brightness (mapped to `[STAR_MIN_BRIGHTNESS, 1]`). The colours are pure grey —
 * each star's brightness multiplies a white point colour — so the star colours are exactly
 * the drawn brightness values.
 */
export function createStarfield(random: () => number): Starfield {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const depthSpan = STARFIELD_DEPTH_FAR - STARFIELD_DEPTH_NEAR;

  for (let index = 0; index < STAR_COUNT; index += 1) {
    const offset = index * 3;
    const xDraw = random();
    const yDraw = random();
    const depthDraw = random();
    const brightnessDraw = random();

    const depth = STARFIELD_DEPTH_NEAR + depthDraw * depthSpan;
    positions[offset] = (xDraw - 0.5) * 2 * depth * STARFIELD_TAN;
    positions[offset + 1] = (yDraw - 0.5) * 2 * depth * STARFIELD_TAN;
    positions[offset + 2] = -depth;

    const brightness = STAR_MIN_BRIGHTNESS + brightnessDraw * (1 - STAR_MIN_BRIGHTNESS);
    colors[offset] = brightness;
    colors[offset + 1] = brightness;
    colors[offset + 2] = brightness;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));

  const material = new PointsMaterial({
    size: STAR_SIZE,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });

  const points = new Points<BufferGeometry, PointsMaterial>(geometry, material);

  /** Accumulated swirl angle about the view axis (radians). */
  let swirlAngle = 0;
  /** Preallocated `RotZ(swirlAngle)`: the view-axis swirl composed with the anchor. */
  const swirlQuaternion = new Quaternion();

  return {
    points,
    update(dtMs: number, travelProgress?: number, anchor?: StarfieldAnchor): void {
      swirlAngle += Math.max(0, dtMs) * DRIFT_RADIANS_PER_MS;

      const anchorPosition = anchor?.position ?? WORLD_IDENTITY_POSITION;
      const anchorQuaternion = anchor?.quaternion ?? WORLD_IDENTITY_QUATERNION;
      points.position.copy(anchorPosition);
      swirlQuaternion.setFromAxisAngle(VIEW_AXIS, swirlAngle);
      points.quaternion.copy(anchorQuaternion).multiply(swirlQuaternion);

      if (travelProgress !== undefined) {
        const progress = Math.min(1, Math.max(0, travelProgress));
        const expansion = 1 + (TRAVEL_STARFIELD_SCALE - 1) * travelSwing(progress);
        // In-plane only: the stars spread radially away from the screen centre while their
        // depth stays put, so no star leaves the camera's far plane (depth ≤ 160 < 200).
        points.scale.set(expansion, expansion, 1);
      }
    },
    dispose(): void {
      geometry.dispose();
      material.dispose();
    },
  };
}
