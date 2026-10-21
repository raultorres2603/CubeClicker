/**
 * Procedural galaxy backdrop (T7 — plan § Render interfaces; spec AC-1 / AC-16).
 *
 * Exactly one `THREE.Points` object holds exactly {@link STAR_COUNT} stars. Every star is
 * drawn from the injected random source (four draws per star, in `x → y → z → brightness`
 * order), so the same seed always produces the same sky: the backdrop is deterministic,
 * testable and loaded from nothing (plan § Asset strategy — all visuals are procedural).
 *
 * `STAR_COUNT`, {@link TRAVEL_STARFIELD_SCALE} and {@link easeInOutQuad} are imported from
 * `game/effects.ts` (T5), the single home for the non-grid pinned constants and easings
 * (plan § Constant homes — never redefined locally).
 *
 * The star disk is a wide, shallow box behind the cube (negative `z`), centred on the
 * origin: `x ∈ [-70, 70]`, `y ∈ [-40, 40]`, `z ∈ [-60, -8]`. The camera's travel pull-away
 * ends at `z = 90`, so even a star at `z = -60` sits 150 units away — inside the `far`
 * plane (200). The travel expansion is applied in the view plane only (`x`/`y`), which
 * keeps every star inside that same far plane at the travel extreme (spec AC-1).
 */

import { BufferAttribute, BufferGeometry, Points, PointsMaterial } from 'three';

import { easeInOutQuad, STAR_COUNT, TRAVEL_STARFIELD_SCALE } from '../game/effects';

/** Horizontal spread of the star disk (world units), centred on the origin. */
const GALAXY_WIDTH = 140;

/** Vertical spread of the star disk (world units), centred on the origin. */
const GALAXY_HEIGHT = 80;

/** Depth of the nearest star (world units behind the origin, i.e. `z = -8`). */
const GALAXY_NEAR_DEPTH = 8;

/** Extra depth span of the star disk: `z ∈ [-60, -8]`. */
const GALAXY_DEPTH_SPAN = 52;

/** World-space point size of a star (attenuated by distance). */
const STAR_SIZE = 0.6;

/** Brightness of the dimmest star; the brightest star is exactly 1. */
const STAR_MIN_BRIGHTNESS = 0.5;

/**
 * Drift rate: `2^-16 = 1/65536` radians per millisecond (≈ 0.015259 rad/s — a full slow
 * turn in about 6.9 minutes). A power of two, so any integer `dtMs` scales exactly and
 * tests can pin exact drift angles.
 */
const DRIFT_RADIANS_PER_MS = 1 / 65536;

/** The galaxy backdrop: one starfield `Points` object plus its frame-update hooks. */
export interface Starfield {
  /** The single `THREE.Points` drawable holding every star (AC-16: one object, never rebuilt). */
  readonly points: Points<BufferGeometry, PointsMaterial>;
  /**
   * Advances the backdrop by `dtMs` milliseconds: applies the slow drift.
   *
   * `travelProgress` (0..1, clamped) is the galaxy travel input (spec AC-1): it drives the
   * uniform in-plane expansion of the star disk, from `1` (rest) to
   * {@link TRAVEL_STARFIELD_SCALE} (`8`), eased with `easeInOutQuad` — the same easing the
   * camera pull-away uses, so the stars visibly move outward for the whole transition. `z`
   * stays `1`. Omit it to keep the current expansion — the frame loop advances the drift
   * every frame while the scene feeds the travel progress only while the travel phase runs.
   */
  update(dtMs: number, travelProgress?: number): void;
  /** Releases the geometry and material of the starfield. */
  dispose(): void;
}

/**
 * Builds the galaxy starfield from `random`.
 *
 * Draw order per star (four draws): `x`, `y`, `z` (mapped onto the star disk box), then the
 * per-star brightness (mapped to `[STAR_MIN_BRIGHTNESS, 1]`). The colours are pure grey —
 * each star's brightness multiplies a white point colour — so the star colours are exactly
 * the drawn brightness values.
 */
export function createStarfield(random: () => number): Starfield {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);

  for (let index = 0; index < STAR_COUNT; index += 1) {
    const offset = index * 3;
    positions[offset] = (random() - 0.5) * GALAXY_WIDTH;
    positions[offset + 1] = (random() - 0.5) * GALAXY_HEIGHT;
    positions[offset + 2] = -(GALAXY_NEAR_DEPTH + random() * GALAXY_DEPTH_SPAN);

    const brightness = STAR_MIN_BRIGHTNESS + random() * (1 - STAR_MIN_BRIGHTNESS);
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

  return {
    points,
    update(dtMs: number, travelProgress?: number): void {
      points.rotation.y += dtMs * DRIFT_RADIANS_PER_MS;

      if (travelProgress !== undefined) {
        const progress = Math.min(1, Math.max(0, travelProgress));
        const expansion = 1 + (TRAVEL_STARFIELD_SCALE - 1) * easeInOutQuad(progress);
        // In-plane only: the stars spread radially away from the screen centre while their
        // depth stays put, so no star leaves the camera's far plane.
        points.scale.set(expansion, expansion, 1);
      }
    },
    dispose(): void {
      geometry.dispose();
      material.dispose();
    },
  };
}
