/**
 * Pure pose math for the 3D lootbox reveal (game-feel-overhaul T1; spec AC-6, AC-32).
 *
 * Layer: game logic (`game/**`) — plain arithmetic plus the pinned angle/colour tables.
 * No DOM, no three.js, no timers, no randomness: the elapsed time, the granted slot and the
 * reduced-motion flag all arrive as parameters, so every frame value is deterministic under
 * test.
 *
 * The timeline is the accepted 1290 ms DOM stage (`game/motion.ts`), split into the pinned
 * phase windows:
 *
 * | phase  | window     |
 * | ------ | ---------- |
 * | charge | 0–419      |
 * | orb    | 420–669    |
 * | flash  | 670–789    |
 * | reveal | 790–1149   |
 * | settle | 1150–1289  |
 * | rest   | ≥ 1290     |
 *
 * {@link revealStagePose} writes every field of the caller-owned `out` record and returns
 * that same reference, so the render loop can reuse one pose object for the whole reveal
 * without per-frame allocation (AC-6/AC-15). Reduced motion always writes the static rest
 * row, whatever the elapsed time.
 */

import { easeInOutCubic, easeOutCubic, MOTION } from './motion';
import type { SlotId } from './parts-v2';

/**
 * Reveal yaw of the whole ship per slot, in radians (spec AC-6, exact table).
 *
 * The sign turns each slot toward the camera; `wing-right`, `engine-right` and
 * `ignition-right` are negative so their port counterparts stay on the opposite side.
 */
export const REVEAL_SLOT_YAW_RAD: Readonly<Record<SlotId, number>> = {
  hull: 0.35,
  nose: 0.15,
  cockpit: 0.45,
  'wing-left': 0.85,
  'wing-right': -0.85,
  'engine-left': 0.7,
  'engine-right': -0.7,
  'ignition-left': 1.0,
  'ignition-right': -1.0,
  'tail-fin': 1.2,
};

/**
 * Yaw the reveal starts from, in radians (spec AC-6).
 *
 * Equal to `PREVIEW_REST_ROTATION_RAD` in `render/preview.ts`: the reveal picks the ship up
 * in exactly the three-quarter view the customization preview shows.
 */
export const REVEAL_START_YAW_RAD = 0.55;

/** Rarity colour channel per loot rarity (spec AC-6; the reveal ring's material colour). */
export const REVEAL_RARITY_HEX: Readonly<{ rare: '#60a5fa'; epic: '#c084fc' }> = {
  rare: '#60a5fa',
  epic: '#c084fc',
};

/** The six stage phases written to `RevealStagePose.phase` (never `idle`). */
export type RevealStagePhase = 'charge' | 'orb' | 'flash' | 'reveal' | 'settle' | 'rest';

/**
 * The UI-facing phase: the panel may still be `idle` on the first grant render; the reveal
 * component maps `idle` to `charge` (or `rest` under reduced motion).
 */
export type RevealUiPhase = 'idle' | RevealStagePhase;

/** One frame's reveal pose, written in place by {@link revealStagePose}. */
export interface RevealStagePose {
  phase: RevealStagePhase;
  /** Whole-ship yaw, radians. */
  yawRad: number;
  /** Whole-ship uniform scale. */
  scale: number;
  /** Multiplier applied to the granted slot group's base scale. */
  slotPulse: number;
  /** Rarity-ring uniform scale. */
  ringScale: number;
  /** Rarity-ring material opacity, `0…0.9`. */
  ringOpacity: number;
  /** Key-light flash lift, `0…0.85`; the stage scales the light by `1 + flashOpacity`. */
  flashOpacity: number;
}

/** End of the charge phase / start of the orb phase (420 ms). */
const ORB_START_MS = MOTION.lootboxChargeMs;

/** End of the orb phase / start of the flash phase (670 ms). */
const FLASH_START_MS = ORB_START_MS + MOTION.orbOvershootMs;

/** End of the flash phase / start of the reveal phase (790 ms). */
const REVEAL_START_MS = FLASH_START_MS + MOTION.lootboxFlashMs;

/** End of the reveal phase / start of the settle phase (1150 ms). */
const SETTLE_START_MS = REVEAL_START_MS + MOTION.lootboxRevealMs;

/** End of the settle phase / start of the rest phase (1290 ms). */
const REST_START_MS = SETTLE_START_MS + MOTION.lootboxSettleMs;

/** Scale at the end of the charge phase (spec AC-6 table: `1 → 1.04`). */
const CHARGE_END_SCALE = 1.04;

/**
 * Linear interpolation of the eased phase progress. At `t = 0` the result is `from` exactly,
 * which keeps every phase boundary on its pinned start value.
 */
function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** The granted slot's yaw; an unknown slot falls back to `hull` defensively, never throws. */
function slotYawFor(slot: SlotId): number {
  return REVEAL_SLOT_YAW_RAD[slot] ?? REVEAL_SLOT_YAW_RAD.hull;
}

/**
 * Clamps `elapsedMs` to `[0, 1290]`: `NaN`/`-Infinity`/non-positive values become `0`,
 * `+Infinity` resolves to the 1290 ms rest row (AC-6: `> 1290` clamps to 1290).
 */
function normalizeElapsed(elapsedMs: number): number {
  if (Number.isNaN(elapsedMs) || elapsedMs <= 0) {
    return 0;
  }
  return Math.min(elapsedMs, REST_START_MS);
}

/** Writes the static rest row for `slotYaw` and returns `out`. */
function writeRestRow(slotYaw: number, out: RevealStagePose): RevealStagePose {
  out.phase = 'rest';
  out.yawRad = slotYaw;
  out.scale = 1;
  out.slotPulse = 1;
  out.ringScale = 1;
  out.ringOpacity = 0;
  out.flashOpacity = 0;
  return out;
}

/**
 * Creates a reusable pose buffer.
 *
 * The buffer starts on the settled rest row for `hull` (a static, motion-free pose), so a
 * reader that observes it before the first {@link revealStagePose} call never sees an
 * uninitialised or mid-animation state.
 */
export function createRevealStagePose(): RevealStagePose {
  return {
    phase: 'rest',
    yawRad: REVEAL_SLOT_YAW_RAD.hull,
    scale: 1,
    slotPulse: 1,
    ringScale: 1,
    ringOpacity: 0,
    flashOpacity: 0,
  };
}

/**
 * Writes the AC-6 pose for `elapsedMs` into `out` and returns `out` (same reference, no
 * allocation).
 *
 * Easing: the charge phase uses `easeInOutCubic`, the orb, reveal scale and reveal ring
 * growth use `easeOutCubic`, the flash and reveal pulses use `sin(πt)`. At exactly 1290 ms
 * (and beyond) the static rest row is written; reduced motion writes it for every input.
 *
 * @param elapsedMs milliseconds since the reveal mounted; clamped to `[0, 1290]`.
 * @param slot the granted slot (already validated by the caller).
 * @param reducedMotion when true, always the rest row.
 * @param out the caller-owned pose record to write.
 */
export function revealStagePose(
  elapsedMs: number,
  slot: SlotId,
  reducedMotion: boolean,
  out: RevealStagePose,
): RevealStagePose {
  const slotYaw = slotYawFor(slot);

  if (reducedMotion) {
    return writeRestRow(slotYaw, out);
  }

  const elapsed = normalizeElapsed(elapsedMs);

  if (elapsed >= REST_START_MS) {
    return writeRestRow(slotYaw, out);
  }

  // Values shared by every animated phase.
  out.yawRad = slotYaw;
  out.slotPulse = 1;
  out.ringOpacity = 0;
  out.flashOpacity = 0;

  if (elapsed < ORB_START_MS) {
    const t = elapsed / ORB_START_MS;
    const eased = easeInOutCubic(t);
    out.phase = 'charge';
    out.yawRad = lerp(REVEAL_START_YAW_RAD, slotYaw, eased);
    out.scale = lerp(1, CHARGE_END_SCALE, eased);
    out.ringScale = MOTION.revealStageRingMinScale;
    return out;
  }

  if (elapsed < FLASH_START_MS) {
    const t = (elapsed - ORB_START_MS) / MOTION.orbOvershootMs;
    out.phase = 'orb';
    out.scale = lerp(CHARGE_END_SCALE, MOTION.revealStageOrbScale, easeOutCubic(t));
    out.ringScale = MOTION.revealStageRingMinScale;
    return out;
  }

  if (elapsed < REVEAL_START_MS) {
    const t = (elapsed - FLASH_START_MS) / MOTION.lootboxFlashMs;
    out.phase = 'flash';
    out.scale = MOTION.revealStageOrbScale;
    out.ringScale = MOTION.revealStageRingMinScale;
    out.flashOpacity = MOTION.revealStageFlashOpacity * Math.sin(Math.PI * t);
    return out;
  }

  if (elapsed < SETTLE_START_MS) {
    const t = (elapsed - REVEAL_START_MS) / MOTION.lootboxRevealMs;
    const wave = Math.sin(Math.PI * t);
    out.phase = 'reveal';
    out.scale = lerp(MOTION.revealStageOrbScale, 1, easeOutCubic(t));
    out.slotPulse = 1 + (MOTION.revealStageSlotPulse - 1) * wave;
    out.ringScale = lerp(
      MOTION.revealStageRingMinScale,
      MOTION.revealStageRingMaxScale,
      easeOutCubic(t),
    );
    out.ringOpacity = MOTION.revealStageRingOpacity * wave;
    return out;
  }

  out.phase = 'settle';
  out.scale = 1;
  out.ringScale = MOTION.revealStageRingMaxScale;
  return out;
}
