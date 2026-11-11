/**
 * Presentation-only motion tokens and easing functions (T7; spec AC-34; plan § Motion).
 *
 * Layer: game logic (`game/**`) — plain data and arithmetic. No DOM, no three.js, no timers,
 * no randomness. All durations are milliseconds; suffixes name the other units
 * (`Px`, `Deg`, `Rad`, `Scale`, `Count`, `PerS`, `PerPop`, `Gain`).
 *
 * {@link MOTION} is the single home for the v2 presentation tokens: the observed `[O]`
 * values copied from the reference analysis and the extrapolated `[E]` values chosen for the
 * interactions the video does not show. {@link easeOutCubic} is the single implementation in
 * the app — `game/effects.ts` re-exports it in T9 (F14), so no second copy may exist.
 */

/**
 * Pinned motion tokens (spec AC-34). Observed values are traceable to
 * `video-analysis.md`; implementation choices are marked `[E]` there.
 */
export const MOTION = {
  // Observed [O].
  reticleDwellMs: 250,
  coinPopMs: 1100,
  coinRisePx: 45,
  coinRiseMs: 220,
  coinMaxConcurrent: 3,
  shockwaveGrowMs: 330,
  shockwaveFadeMs: 150,
  shockwaveVisibleMs: 480,
  shockwaveMaxScale: 5,
  orbOvershootMs: 250,
  orbOvershootScale: 1.25,
  bannerOvershootMs: 450,
  bannerOvershootScale: 1.08,
  bannerPeakMs: 250,
  bannerHaloMs: 250,
  bannerRotateDeg: 8,
  bannerWobbleDeg: 2,
  bannerHoldMs: 1600,
  levelBurstMs: 760,
  levelBurstAttackMs: 250,
  levelBurstReleaseMs: 510,
  levelRayGold: 16,
  levelRayCyan: 8,
  levelRingCount: 3,
  levelStarCount: 12,
  levelCoinCount: 20,
  rayCount: 12,
  rayGrowMs: 80,
  rayHoldMs: 100,
  rayFadeMs: 270,
  rayTotalMs: 450,
  debrisPerPop: 14,
  debrisPoolCap: 42,
  debrisLifetimeMs: 1200,
  debrisSpeedMin: 1.8,
  debrisSpeedMax: 3.6,
  debrisDragPerS: 2,
  debrisGravity: 6,
  debrisAngularMin: 3,
  debrisAngularMax: 8,
  coinsPerPop: 6,
  coinPoolCap: 18,
  coinLifetimeMs: 1000,
  shipRollMs: 700,
  shipOrbitRadius: 1.2,
  fireTrailMs: 700,
  fireTrailCount: 16,
  plumeFlickerMs: 100,
  // Implementation choices [E].
  reticleFadeMs: 120,
  lootboxChargeMs: 420,
  lootboxFlashMs: 120,
  lootboxRevealMs: 360,
  lootboxSettleMs: 140,
  lootboxTotalMs: 1290,
  equipPulseMs: 260,
  equipPulseScale: 0.04,
  equipRowFlashMs: 260,
  upgradePulseMs: 260,
  trailLifetimeMs: 220,
  trailCount: 8,
  shipBankMaxRad: 0.28,
  shipBankGain: 2.4,
  shipPitchMaxRad: 0.18,
  shipPitchGain: 1.6,
  shipIdleAmplitude: 0.015,
  shipIdlePeriodMs: 2600,
  // Small destruction and realistic shot FX (spec AC-1).
  miniCubeDestroyMs: 140,
  miniCubeDestroyGrowMs: 30,
  miniCubeDestroyPeakScale: 1.08,
  miniCubeDestroyFlashMs: 90,
  miniCubeDestroyFlashGain: 3,
  impactFlashMs: 140,
  impactFlashGrowMs: 60,
  impactEmberCount: 8,
  impactEmberLifetimeMs: 380,
  impactSmokeCount: 4,
  impactSmokeLifetimeMs: 480,
  shotMuzzleFlashMs: 80,
  shotRecoilMs: 120,
  shotRecoilDistance: 0.12,
} as const;

/** Standard cubic ease-out: `1 − (1 − t)³` (AC-34; the app's only implementation). */
export function easeOutCubic(t: number): number {
  const inverted = 1 - t;
  return 1 - inverted * inverted * inverted;
}

/** Standard quadratic ease-out: `1 − (1 − t)²` (AC-34; ring shockwave growth). */
export function easeOutQuad(t: number): number {
  const inverted = 1 - t;
  return 1 - inverted * inverted;
}

/** Standard quintic ease-out: `1 − (1 − t)⁵` (AC-34; starburst-ray growth). */
export function easeOutQuint(t: number): number {
  const inverted = 1 - t;
  return 1 - inverted * inverted * inverted * inverted * inverted;
}

/** Standard cubic ease-in-out (AC-34; level fly-by roll). */
export function easeInOutCubic(t: number): number {
  if (t < 0.5) {
    return 4 * t * t * t;
  }
  const inverted = -2 * t + 2;
  return 1 - (inverted * inverted * inverted) / 2;
}

/**
 * Standard back ease-out (AC-34): `1 + c3·(t − 1)³ + c1·(t − 1)²` with `c3 = c1 + 1`
 * and the default `c1 = 1.5`; the curve peaks at `1.08` for `t = 0.6`. Passing `c1 = 3.0`
 * gives the observed orb envelope, peaking at `1.25` at `t = 0.5`.
 */
export function easeOutBack(t: number, c1 = 1.5): number {
  const c3 = c1 + 1;
  const shifted = t - 1;
  return 1 + c3 * shifted * shifted * shifted + c1 * shifted * shifted;
}

/** Clamps `value` into `[0, 1]` (AC-34). */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
