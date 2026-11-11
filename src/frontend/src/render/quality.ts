/**
 * Adaptive quality policy (T9; spec AC-52; plan § Adaptive quality).
 *
 * Layer: pure render policy — plain arithmetic over an injected frame-time stream. No DOM,
 * no three.js, no timers, no randomness. The scene owns one policy, pushes the frame delta
 * once per rendered frame (`pushFrameTime`) and applies the resulting feature matrix to the
 * cursor, targeting, impact effects and spark pool.
 *
 * Policy contract (AC-52):
 * - starts at `high`; consumes clamped frame times (`0 < dt <= 250`; non-finite/≤0 ignored)
 *   into a rolling {@link QUALITY_WINDOW_FRAMES} window;
 * - no decision before {@link QUALITY_MIN_SAMPLES} samples;
 * - `avg` is the arithmetic mean and `p95` the nearest-rank value of the sorted live window
 *   (`ceil(0.95 * n) - 1`, zero-based);
 * - downgrade high→medium on `avg > 18.0 || p95 > 24.0` sustained for 60 frames;
 *   medium→low on `avg > 20.0 || p95 > 28.0` sustained for 60 frames; both gated by a
 *   1000 ms cooldown;
 * - upgrade medium→high on `avg <= 16.0 && p95 <= 20.0` sustained for 180 frames;
 *   low→medium on `avg <= 17.0 && p95 <= 22.0` sustained for 240 frames; both gated by a
 *   3000 ms cooldown;
 * - at most one tier change per frame/decision.
 *
 * `qualityFeatures(tier, reducedMotion)` is the single source of the visual matrix.
 * Reduced motion is authoritative: it disables every motion layer regardless of tier while
 * the tier may still downgrade static detail. The banner remains the core level-feedback
 * surface at every tier.
 */

/** The three automatic tiers; there is no user-facing setting. */
export type QualityTier = 'high' | 'medium' | 'low';

/** Rolling window length in frames (AC-52). */
export const QUALITY_WINDOW_FRAMES = 120;

/** Frame times are clamped into `(0, QUALITY_MAX_FRAME_MS]` (AC-52). */
export const QUALITY_MAX_FRAME_MS = 250;

/** Minimum live-window size before any decision (AC-52). */
export const QUALITY_MIN_SAMPLES = 60;

/** Frames a downgrade condition must be sustained (AC-52). */
export const QUALITY_DOWNGRADE_STABLE_FRAMES = 60;

/** Frames an upgrade condition must be sustained for medium→high (AC-52). */
export const QUALITY_UPGRADE_STABLE_FRAMES = 180;

/** Frames an upgrade condition must be sustained for low→medium (AC-52). */
export const QUALITY_LOW_UPGRADE_STABLE_FRAMES = 240;

/** No downgrade within this many milliseconds of the last tier change (AC-52). */
export const QUALITY_DOWNGRADE_COOLDOWN_MS = 1000;

/** No upgrade within this many milliseconds of the last tier change (AC-52). */
export const QUALITY_UPGRADE_COOLDOWN_MS = 3000;

/** Cursor detail meshes hidden at medium and low tiers (AC-52). */
export const QUALITY_MEDIUM_HIDDEN_MESHES: readonly string[] = [
  'cursor-hull-seam-1',
  'cursor-hull-seam-2',
  'cursor-vent-left',
  'cursor-vent-right',
];

/** Cursor detail meshes hidden at the low tier (medium set plus the wing tips). */
export const QUALITY_LOW_HIDDEN_MESHES: readonly string[] = [
  ...QUALITY_MEDIUM_HIDDEN_MESHES,
  'cursor-wing-left-tip',
  'cursor-wing-right-tip',
];

/** Mesh counts per tier: high 21, medium 17, low 15 (AC-52). */
export const QUALITY_CURSOR_MESH_COUNTS: Readonly<Record<QualityTier, number>> = {
  high: 21,
  medium: 17,
  low: 15,
};

/** Green shards per pop per tier (AC-52). */
export const QUALITY_SHARD_COUNTS: Readonly<Record<QualityTier, number>> = {
  high: 14,
  medium: 7,
  low: 0,
};

/** Spark fragments per explosion per tier (AC-52). */
export const QUALITY_SPARK_COUNTS: Readonly<Record<QualityTier, number>> = {
  high: 24,
  medium: 12,
  low: 0,
};

/** The exact per-tier visual feature matrix, reduced-motion aware (AC-52). */
export interface QualityFeatures {
  /** The tier the matrix was computed for. */
  readonly tier: QualityTier;
  /** Hover reticle ticks + fade are enabled (high only; never under reduced motion). */
  readonly reticle: boolean;
  /** Cursor follow trail is rendered (high only; never under reduced motion). */
  readonly trail: boolean;
  /** Cursor bank/pitch/idle bob/equip pulse are driven (high/medium; never reduced/low). */
  readonly cursorMotion: boolean;
  /** Cursor meshes hidden at this tier (empty at high). */
  readonly hiddenCursorMeshes: readonly string[];
  /** Number of visible cursor meshes (21/17/15). */
  readonly cursorMeshCount: number;
  /** Green shard count per pop (14/7/0; 0 under reduced motion). */
  readonly impactShards: number;
  /** Spark fragments per explosion (24/12/0; 0 under reduced motion). */
  readonly sparks: number;
  /** Coin popup stays core at every tier. */
  readonly coinPopup: boolean;
  /** Banner stays core; this flag disables its motion only under reduced motion. */
  readonly bannerMotion: boolean;
}

/**
 * Builds the exact feature matrix for `tier` (AC-52). Reduced motion forces every motion
 * layer off regardless of tier while the selected tier's static detail still applies.
 */
export function qualityFeatures(
  tier: QualityTier,
  reducedMotion: boolean,
): QualityFeatures {
  const high = tier === 'high';
  return {
    tier,
    reticle: high && !reducedMotion,
    trail: high && !reducedMotion,
    cursorMotion: tier !== 'low' && !reducedMotion,
    hiddenCursorMeshes:
      tier === 'low' ? QUALITY_LOW_HIDDEN_MESHES : tier === 'medium' ? QUALITY_MEDIUM_HIDDEN_MESHES : [],
    cursorMeshCount: QUALITY_CURSOR_MESH_COUNTS[tier],
    impactShards: reducedMotion ? 0 : QUALITY_SHARD_COUNTS[tier],
    sparks: reducedMotion ? 0 : QUALITY_SPARK_COUNTS[tier],
    coinPopup: true,
    bannerMotion: !reducedMotion,
  };
}

/** The manager handed to the scene: read the tier and push one frame delta per frame. */
export interface QualityPolicy {
  /** Current automatic tier. */
  getTier(): QualityTier;
  /**
   * Pushes one frame delta: clamps it into `(0, 250]`, ignores non-finite/≤0 values and
   * evaluates at most one tier change. Returns the (possibly changed) tier.
   */
  pushFrameTime(dtMs: number): QualityTier;
  /** Live rolling-window size (`0..120`). */
  getWindowSize(): number;
  /** Arithmetic mean of the live window (`0` when empty). */
  getAverageFrameMs(): number;
  /** Nearest-rank p95 of the live window (`0` when empty). */
  getP95FrameMs(): number;
  /**
   * Forces a tier (test hook / T14 forced-tier traces). Treated as a tier change at the
   * current policy clock, so the normal cooldowns and recovery windows still apply.
   */
  setTier(tier: QualityTier): void;
}

/** Nearest-rank p95 index: `ceil(0.95 * n) - 1`, zero-based (AC-52). */
function nearestRank95(sorted: readonly number[]): number {
  const index = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, index))]!;
}

/**
 * Builds a quality policy. `initialTier` defaults to `high`; tests use it to exercise the
 * upgrade branches deterministically without replaying a downgrade first.
 */
export function createQualityPolicy(initialTier: QualityTier = 'high'): QualityPolicy {
  let tier: QualityTier = initialTier;
  const window: number[] = [];
  let windowSum = 0;
  /** Policy clock: the sum of every accepted (clamped) frame time. */
  let nowMs = 0;
  /** Clock value of the last tier change; `-Infinity` before the first. */
  let lastChangeMs = -Infinity;
  let downgradeStreak = 0;
  let upgradeStreak = 0;

  function average(): number {
    return window.length === 0 ? 0 : windowSum / window.length;
  }

  function p95(): number {
    if (window.length === 0) {
      return 0;
    }
    const sorted = [...window].sort((a, b) => a - b);
    return nearestRank95(sorted);
  }

  function resetStreaks(): void {
    downgradeStreak = 0;
    upgradeStreak = 0;
  }

  function changeTo(next: QualityTier): void {
    tier = next;
    lastChangeMs = nowMs;
    resetStreaks();
  }

  function evaluate(): void {
    if (window.length === 0) {
      return;
    }
    const avg = average();
    const p95Value = p95();
    // The condition streaks count from the first live sample; a change additionally
    // requires the minimum window size (60) and its cooldown. A constant 30 ms stream
    // therefore downgrades on its 60th frame — the minimum sample is the decision gate.
    const enoughSamples = window.length >= QUALITY_MIN_SAMPLES;
    switch (tier) {
      case 'high': {
        const miss = avg > 18.0 || p95Value > 24.0;
        downgradeStreak = miss ? downgradeStreak + 1 : 0;
        if (
          enoughSamples &&
          downgradeStreak >= QUALITY_DOWNGRADE_STABLE_FRAMES &&
          nowMs - lastChangeMs >= QUALITY_DOWNGRADE_COOLDOWN_MS
        ) {
          changeTo('medium');
        }
        return;
      }
      case 'medium': {
        const miss = avg > 20.0 || p95Value > 28.0;
        const stable = avg <= 16.0 && p95Value <= 20.0;
        downgradeStreak = miss ? downgradeStreak + 1 : 0;
        upgradeStreak = stable ? upgradeStreak + 1 : 0;
        if (
          enoughSamples &&
          downgradeStreak >= QUALITY_DOWNGRADE_STABLE_FRAMES &&
          nowMs - lastChangeMs >= QUALITY_DOWNGRADE_COOLDOWN_MS
        ) {
          changeTo('low');
          return;
        }
        if (
          enoughSamples &&
          upgradeStreak >= QUALITY_UPGRADE_STABLE_FRAMES &&
          nowMs - lastChangeMs >= QUALITY_UPGRADE_COOLDOWN_MS
        ) {
          changeTo('high');
        }
        return;
      }
      case 'low': {
        const stable = avg <= 17.0 && p95Value <= 22.0;
        upgradeStreak = stable ? upgradeStreak + 1 : 0;
        if (
          enoughSamples &&
          upgradeStreak >= QUALITY_LOW_UPGRADE_STABLE_FRAMES &&
          nowMs - lastChangeMs >= QUALITY_UPGRADE_COOLDOWN_MS
        ) {
          changeTo('medium');
        }
        return;
      }
    }
  }

  function pushFrameTime(dtMs: number): QualityTier {
    if (!Number.isFinite(dtMs) || dtMs <= 0) {
      return tier;
    }
    const clamped = Math.min(QUALITY_MAX_FRAME_MS, dtMs);
    nowMs += clamped;
    window.push(clamped);
    windowSum += clamped;
    if (window.length > QUALITY_WINDOW_FRAMES) {
      windowSum -= window.shift()!;
    }
    evaluate();
    return tier;
  }

  return {
    getTier: () => tier,
    pushFrameTime,
    getWindowSize: () => window.length,
    getAverageFrameMs: average,
    getP95FrameMs: p95,
    setTier(next: QualityTier): void {
      if (next === tier) {
        return;
      }
      changeTo(next);
    },
  };
}
