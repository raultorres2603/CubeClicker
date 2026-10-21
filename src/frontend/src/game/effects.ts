/**
 * Timings, easings, explosion-burst math and the non-grid pinned constants (T5).
 *
 * Pure functions and plain data: no DOM, no three.js, no timers. All randomness and
 * time enter as parameters, so every value here is deterministic under test.
 *
 * **Constant homes (plan § Constant homes — F2).** This module is the single home for
 * the non-grid pinned constants: {@link STAR_COUNT}, {@link EXPLOSION_PARTICLE_COUNT},
 * {@link PARTICLE_POOL_CAP}, {@link TAP_DRAG_THRESHOLD_PX}, {@link PIXEL_RATIO_CAP},
 * {@link TRAVEL_STARFIELD_SCALE}, {@link TRAVEL_LEVEL_ADVANCE_P}, {@link BURST_ORIGIN_OFFSET}
 * and the mini-cube pop
 * constants ({@link MINI_CUBE_POP_MS}, {@link MINI_CUBE_POP_EXPAND_MS},
 * {@link MINI_CUBE_POP_PEAK_SCALE}, {@link MINI_CUBE_POP_COLOR_STRENGTH}).
 * Consumers (`render/starfield.ts`, `render/particles.ts`, `render/scene.ts`,
 * `render/cube-view.ts`, `input/**`, the engine and the session) import them from here
 * and never redefine them locally. `GRID_SIZE` is the only constant that lives in
 * `types.ts`; style values live in `progression.ts` and HUD colours in `ui/theme.ts`.
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

/**
 * Symmetric travel swing (spec AC-3).
 *
 * Rises with {@link easeInOutQuad} over the compressed first half (`p ≤ 0.5`):
 * `easeInOutQuad(2p)`; falls over the second half as `1 − easeInOutQuad(2p − 1)`.
 * Both ends are clamped to `[0, 1]` and the function is total: `0 → 0`, `0.5 → 1`,
 * `1 → 0`. The same value drives the travel camera and the backdrop expansion, so the
 * two can never drift apart mid-transition:
 *
 * - camera z = `12 + 78 · travelSwing(p)` (rest 12 → turn-around 90 → rest 12);
 * - starfield scale = `1 + 7 · travelSwing(p)` (`(1,1,1) → (8,8,1) → (1,1,1)`).
 */
export function travelSwing(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));
  if (clamped <= 0.5) {
    return easeInOutQuad(2 * clamped);
  }
  return 1 - easeInOutQuad(2 * clamped - 1);
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

/**
 * Pointer travel (px) up to and including which a gesture is a tap: travel ≤ 40 px is a
 * tap (exactly at the threshold is a tap), 41 px is a drag (AC-6).
 */
export const TAP_DRAG_THRESHOLD_PX = 40;

/** Ceiling applied to `devicePixelRatio` when sizing the renderer (spec § Pinned constants). */
export const PIXEL_RATIO_CAP = 2;

/** x/y expansion of the starfield layer at the travel midpoint (spec AC-1). */
export const TRAVEL_STARFIELD_SCALE = 8;

/**
 * Travel-progress fraction at which the level advances (spec AC-3) — the midpoint, where
 * the camera is at the turn-around and the backdrop is at its peak expansion.
 */
export const TRAVEL_LEVEL_ADVANCE_P = 0.5;

/** World units the burst origin moves out along the face normal (spec AC-3). */
export const BURST_ORIGIN_OFFSET = 0.5;

/** Total duration of the pop-then-shrink disappearance (spec AC-4). */
export const MINI_CUBE_POP_MS = 160;

/** Grow phase of the pop: `1 → MINI_CUBE_POP_PEAK_SCALE` over the first 100 ms (spec AC-4). */
export const MINI_CUBE_POP_EXPAND_MS = 100;

/** Peak scale factor of the pop (spec AC-4). */
export const MINI_CUBE_POP_PEAK_SCALE = 1.1;

/** Peak `instanceColor` multiplier delta of the pop's brightness flash (spec AC-4). */
export const MINI_CUBE_POP_COLOR_STRENGTH = 0.3;

/** Duration of the shrink phase: the remainder of the pop after the expand phase (60 ms). */
const MINI_CUBE_POP_SHRINK_MS = MINI_CUBE_POP_MS - MINI_CUBE_POP_EXPAND_MS;

/**
 * Tile scale factor of the mini-cube pop at `elapsedMs` (spec AC-4).
 *
 * Linear expand `1 → MINI_CUBE_POP_PEAK_SCALE` over `[0, MINI_CUBE_POP_EXPAND_MS]`, then a
 * linear shrink `MINI_CUBE_POP_PEAK_SCALE → 0` over the remaining 60 ms. Total function of
 * `elapsedMs` alone: non-positive elapsed time is clamped to the start pose (1) and every
 * time at or after {@link MINI_CUBE_POP_MS} yields 0 (the hidden end state).
 */
export function popScaleAt(elapsedMs: number): number {
  if (elapsedMs >= MINI_CUBE_POP_MS) {
    return 0;
  }
  if (elapsedMs <= 0) {
    return 1;
  }
  if (elapsedMs <= MINI_CUBE_POP_EXPAND_MS) {
    return 1 + (MINI_CUBE_POP_PEAK_SCALE - 1) * (elapsedMs / MINI_CUBE_POP_EXPAND_MS);
  }
  const shrinkProgress = (elapsedMs - MINI_CUBE_POP_EXPAND_MS) / MINI_CUBE_POP_SHRINK_MS;
  return MINI_CUBE_POP_PEAK_SCALE * (1 - shrinkProgress);
}

/**
 * Per-instance colour multiplier of the mini-cube pop at `elapsedMs` (spec AC-4).
 *
 * Runs `1 → 1 + MINI_CUBE_POP_COLOR_STRENGTH` over the expand phase and back to 1 over the
 * shrink phase, i.e. a bounded brightness flash toward white (hue unchanged). Total function
 * of `elapsedMs` alone: 1 outside the envelope `(0, MINI_CUBE_POP_MS)`.
 */
export function popColorMultiplierAt(elapsedMs: number): number {
  if (elapsedMs <= 0 || elapsedMs >= MINI_CUBE_POP_MS) {
    return 1;
  }
  if (elapsedMs <= MINI_CUBE_POP_EXPAND_MS) {
    return 1 + MINI_CUBE_POP_COLOR_STRENGTH * (elapsedMs / MINI_CUBE_POP_EXPAND_MS);
  }
  const shrinkProgress = (elapsedMs - MINI_CUBE_POP_EXPAND_MS) / MINI_CUBE_POP_SHRINK_MS;
  return 1 + MINI_CUBE_POP_COLOR_STRENGTH * (1 - shrinkProgress);
}

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
