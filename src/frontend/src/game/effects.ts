/**
 * Timings, easings, explosion-burst math and the non-grid pinned constants (T5).
 *
 * Pure functions and plain data: no DOM, no three.js, no timers. All randomness and
 * time enter as parameters, so every value here is deterministic under test.
 *
 * **Constant homes (plan § Constant homes — F2).** This module is the single home for
 * the non-grid pinned constants: {@link STAR_COUNT}, {@link EXPLOSION_PARTICLE_COUNT},
 * {@link PARTICLE_POOL_CAP}, {@link TAP_DRAG_THRESHOLD_PX} and {@link PIXEL_RATIO_CAP}.
 * Consumers (`render/starfield.ts`, `render/particles.ts`, `input/**`, the engine and
 * the session) import them from here and never redefine them locally. `GRID_SIZE` is
 * the only constant that lives in `types.ts`; style values live in `progression.ts`
 * and HUD colours in `ui/theme.ts`.
 */

/** Duration profile for the animated phases and effects (spec § Pinned constants). */
export interface Timings {
  /** Intro camera flight (`INTRO_DURATION_MS`). */
  introMs: number;
  /** Galaxy travel transition (`TRAVEL_DURATION_MS`). */
  travelMs: number;
  /** One 90° rotation step (`ROTATION_DURATION_MS`). */
  rotationMs: number;
  /** Explosion burst lifetime (`EXPLOSION_DURATION_MS`). */
  explosionMs: number;
  /** Cleared-face fade (`FACE_FADE_MS`). */
  faceFadeMs: number;
}

/** Default profile: 2500 / 2500 / 300 / 350 / 400. */
export const DEFAULT_TIMINGS: Timings = {
  introMs: 2500,
  travelMs: 2500,
  rotationMs: 300,
  explosionMs: 350,
  faceFadeMs: 400,
};

/**
 * `prefers-reduced-motion: reduce` profile: 150 / 150 / 0 / 0 / 100.
 *
 * `rotationMs` and `explosionMs` are 0 — rotation settles instantly and explosions
 * remove the mini-cube with no particle burst at all (the engine emits the zero
 * particle path; see spec § Reduced motion).
 */
export const REDUCED_TIMINGS: Timings = {
  introMs: 150,
  travelMs: 150,
  rotationMs: 0,
  explosionMs: 0,
  faceFadeMs: 100,
};

/**
 * Picks the animation profile for the current motion setting. Returns one of the two
 * shared profile objects (same identity as {@link DEFAULT_TIMINGS} /
 * {@link REDUCED_TIMINGS}) so callers may compare by reference.
 */
export function timingsFor(reducedMotion: boolean): Timings {
  return reducedMotion ? REDUCED_TIMINGS : DEFAULT_TIMINGS;
}

/** Intro camera flight easing: `1 - (1 - t)³` (pinned by AC-22). */
export function easeOutCubic(t: number): number {
  const inverted = 1 - t;
  return 1 - inverted * inverted * inverted;
}

/** Travel camera-pull easing: quadratic in/out (pinned by AC-22). */
export function easeInOutQuad(t: number): number {
  if (t < 0.5) {
    return 2 * t * t;
  }
  const inverted = -2 * t + 2;
  return 1 - (inverted * inverted) / 2;
}

/** One explosion fragment: unit direction, speed and point size. */
export interface BurstParticle {
  dx: number;
  dy: number;
  dz: number;
  speed: number;
  size: number;
}

/** One explosion: its fragments plus the lifetime after which it is released. */
export interface Burst {
  particles: BurstParticle[];
  lifetimeMs: number;
}

/** Starfield star count (spec § Pinned constants; consumed by `render/starfield.ts`). */
export const STAR_COUNT = 1200;

/** Fragments per explosion (spec § Pinned constants). */
export const EXPLOSION_PARTICLE_COUNT = 24;

/**
 * Hard ceiling on simultaneously active explosion particles: three concurrent
 * 24-particle bursts (spec § Pinned constants). At the cap the particle system
 * recycles the oldest active burst, so the newest burst always plays.
 */
export const PARTICLE_POOL_CAP = 3 * EXPLOSION_PARTICLE_COUNT;

/** Pointer travel (px) below which a gesture is a tap, at/above which it is a drag. */
export const TAP_DRAG_THRESHOLD_PX = 40;

/** Ceiling applied to `devicePixelRatio` when sizing the renderer (spec § Pinned constants). */
export const PIXEL_RATIO_CAP = 2;

/** Speed range of a fragment: `[BURST_SPEED_MIN, BURST_SPEED_MIN + BURST_SPEED_RANGE)`. */
const BURST_SPEED_MIN = 1;
const BURST_SPEED_RANGE = 2;

/** Point-size range of a fragment. */
const BURST_SIZE_MIN = 0.02;
const BURST_SIZE_RANGE = 0.05;

/** Drawn direction vectors shorter than this cannot be normalised and use the fallback. */
const MIN_DIRECTION_LENGTH = 1e-6;

/** Fallback direction for a degenerate (zero-length) draw — straight towards the camera. */
const FALLBACK_DIRECTION = { dx: 0, dy: 0, dz: 1 } as const;

/**
 * Builds one explosion burst.
 *
 * Deterministic given `random`: each particle consumes exactly five draws in order —
 * `dx`, `dy`, `dz` (mapped from `[0, 1)` to `[-1, 1)`, then normalised to a unit
 * direction), then `speed`, then `size`. A draw triple whose vector is too short to
 * normalise falls back to the fixed direction `(0, 0, 1)`.
 *
 * `particleCount` defaults to {@link EXPLOSION_PARTICLE_COUNT} (24). The lifetime is
 * the default explosion duration ({@link DEFAULT_TIMINGS}`.explosionMs`, 350 ms):
 * bursts only exist in the default profile — under reduced motion the engine hides
 * the mini-cube without creating one.
 */
export function createBurst(
  random: () => number,
  particleCount: number = EXPLOSION_PARTICLE_COUNT,
): Burst {
  const particles: BurstParticle[] = [];
  for (let index = 0; index < particleCount; index += 1) {
    const rawX = random() * 2 - 1;
    const rawY = random() * 2 - 1;
    const rawZ = random() * 2 - 1;
    const length = Math.sqrt(rawX * rawX + rawY * rawY + rawZ * rawZ);
    const direction =
      length < MIN_DIRECTION_LENGTH
        ? FALLBACK_DIRECTION
        : { dx: rawX / length, dy: rawY / length, dz: rawZ / length };
    particles.push({
      dx: direction.dx,
      dy: direction.dy,
      dz: direction.dz,
      speed: BURST_SPEED_MIN + random() * BURST_SPEED_RANGE,
      size: BURST_SIZE_MIN + random() * BURST_SIZE_RANGE,
    });
  }
  return { particles, lifetimeMs: DEFAULT_TIMINGS.explosionMs };
}
