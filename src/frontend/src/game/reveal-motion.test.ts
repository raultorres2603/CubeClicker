import { describe, expect, it } from 'vitest';

import { PREVIEW_REST_ROTATION_RAD } from '../render/preview';
import type { SlotId } from './parts-v2';
import {
  createRevealStagePose,
  REVEAL_RARITY_HEX,
  REVEAL_SLOT_YAW_RAD,
  REVEAL_START_YAW_RAD,
  revealStagePose,
  type RevealStagePhase,
  type RevealStagePose,
} from './reveal-motion';

/** One pose at `elapsedMs` in a fresh buffer (the production path reuses one buffer). */
function poseAt(
  elapsedMs: number,
  slot: SlotId = 'hull',
  reducedMotion = false,
): RevealStagePose {
  return revealStagePose(elapsedMs, slot, reducedMotion, createRevealStagePose());
}

describe('REVEAL_SLOT_YAW_RAD (AC-6)', () => {
  it('pins the ten slot yaw values exactly', () => {
    expect(REVEAL_SLOT_YAW_RAD).toEqual({
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
    });
  });

  it('yaws the ship to each slot once the charge phase ends', () => {
    for (const [slot, yaw] of Object.entries(REVEAL_SLOT_YAW_RAD)) {
      expect(poseAt(420, slot as SlotId).yawRad).toBe(yaw);
      expect(poseAt(1290, slot as SlotId).yawRad).toBe(yaw);
    }
  });

  it('falls back to the hull yaw for an unknown slot instead of throwing', () => {
    expect(poseAt(420, 'reactor' as SlotId).yawRad).toBe(0.35);
    expect(poseAt(1290, 'reactor' as SlotId).yawRad).toBe(0.35);
  });

  it('starts from the preview rest yaw', () => {
    expect(REVEAL_START_YAW_RAD).toBe(0.55);
    expect(REVEAL_START_YAW_RAD).toBe(PREVIEW_REST_ROTATION_RAD);
  });
});

describe('REVEAL_RARITY_HEX (AC-6)', () => {
  it('pins the rare and epic ring colours exactly', () => {
    expect(REVEAL_RARITY_HEX).toEqual({ rare: '#60a5fa', epic: '#c084fc' });
  });
});

describe('phase windows (AC-6)', () => {
  const cases: readonly [number, RevealStagePhase][] = [
    [0, 'charge'],
    [419, 'charge'],
    [420, 'orb'],
    [669, 'orb'],
    [670, 'flash'],
    [789, 'flash'],
    [790, 'reveal'],
    [1149, 'reveal'],
    [1150, 'settle'],
    [1289, 'settle'],
    [1290, 'rest'],
    [5000, 'rest'],
  ];

  it.each(cases)('reports phase %s → %s', (elapsedMs, phase) => {
    expect(poseAt(elapsedMs).phase).toBe(phase);
  });
});

describe('pinned boundary values (AC-6)', () => {
  it('starts on the charge row at 0 ms', () => {
    expect(poseAt(0)).toEqual({
      phase: 'charge',
      yawRad: REVEAL_START_YAW_RAD,
      scale: 1,
      slotPulse: 1,
      ringScale: 0.4,
      ringOpacity: 0,
      flashOpacity: 0,
    });
  });

  it('reaches the slot yaw and the 1.04 charge scale at 420 ms', () => {
    expect(poseAt(420)).toEqual({
      phase: 'orb',
      yawRad: 0.35,
      scale: 1.04,
      slotPulse: 1,
      ringScale: 0.4,
      ringOpacity: 0,
      flashOpacity: 0,
    });
  });

  it('reaches the 1.10 orb scale at 670 ms', () => {
    expect(poseAt(670)).toEqual({
      phase: 'flash',
      yawRad: 0.35,
      scale: 1.1,
      slotPulse: 1,
      ringScale: 0.4,
      ringOpacity: 0,
      flashOpacity: 0,
    });
  });

  it('peaks the flash opacity at 0.85 mid-flash (730 ms)', () => {
    expect(poseAt(730)).toEqual({
      phase: 'flash',
      yawRad: 0.35,
      scale: 1.1,
      slotPulse: 1,
      ringScale: 0.4,
      ringOpacity: 0,
      flashOpacity: 0.85,
    });
  });

  it('peaks the slot pulse at 1.10 and the ring opacity at 0.9 mid-reveal (970 ms)', () => {
    const pose = poseAt(970);
    expect(pose.phase).toBe('reveal');
    expect(pose.yawRad).toBe(0.35);
    expect(pose.slotPulse).toBe(1.1);
    expect(pose.ringOpacity).toBe(0.9);
    expect(pose.flashOpacity).toBe(0);
  });

  it('settles to scale 1 with the ring at 2.4 and fully faded at 1150 ms', () => {
    expect(poseAt(1150)).toEqual({
      phase: 'settle',
      yawRad: 0.35,
      scale: 1,
      slotPulse: 1,
      ringScale: 2.4,
      ringOpacity: 0,
      flashOpacity: 0,
    });
  });

  it('reaches the rest row at 1290 ms', () => {
    expect(poseAt(1290)).toEqual({
      phase: 'rest',
      yawRad: 0.35,
      scale: 1,
      slotPulse: 1,
      ringScale: 1,
      ringOpacity: 0,
      flashOpacity: 0,
    });
  });

  it('uses the granted slot yaw in the rest row', () => {
    expect(poseAt(1290, 'tail-fin')).toEqual({
      phase: 'rest',
      yawRad: 1.2,
      scale: 1,
      slotPulse: 1,
      ringScale: 1,
      ringOpacity: 0,
      flashOpacity: 0,
    });
  });
});

describe('clamping (AC-6)', () => {
  const zeroRow = {
    phase: 'charge',
    yawRad: REVEAL_START_YAW_RAD,
    scale: 1,
    slotPulse: 1,
    ringScale: 0.4,
    ringOpacity: 0,
    flashOpacity: 0,
  } as const;

  it('clamps negative time to the 0 ms charge row', () => {
    expect(poseAt(-1)).toEqual(zeroRow);
    expect(poseAt(-1000)).toEqual(zeroRow);
  });

  it('clamps NaN to the 0 ms charge row', () => {
    expect(poseAt(Number.NaN)).toEqual(zeroRow);
  });

  it('treats negative infinity as 0', () => {
    expect(poseAt(Number.NEGATIVE_INFINITY)).toEqual(zeroRow);
  });

  it('clamps positive infinity to the 1290 ms rest row', () => {
    expect(poseAt(Number.POSITIVE_INFINITY)).toEqual({
      phase: 'rest',
      yawRad: 0.35,
      scale: 1,
      slotPulse: 1,
      ringScale: 1,
      ringOpacity: 0,
      flashOpacity: 0,
    });
    expect(poseAt(Number.POSITIVE_INFINITY)).toEqual(poseAt(1290));
  });

  it('clamps time beyond 1290 ms to the rest row', () => {
    expect(poseAt(5000)).toEqual(poseAt(1290));
    expect(poseAt(1290.5)).toEqual(poseAt(1290));
  });
});

describe('reduced motion (AC-6)', () => {
  const restRow = {
    phase: 'rest',
    yawRad: 1.2,
    scale: 1,
    slotPulse: 1,
    ringScale: 1,
    ringOpacity: 0,
    flashOpacity: 0,
  } as const;

  it.each([-50, 0, 420, 670, 730, 970, 1150, 1289, 1290, 5000, Number.NaN, Number.POSITIVE_INFINITY])(
    'returns the static rest row at %s ms',
    (elapsedMs) => {
      expect(poseAt(elapsedMs, 'tail-fin', true)).toEqual(restRow);
    },
  );

  it('ignores the slot yaw animation but keeps the granted slot yaw', () => {
    expect(poseAt(730, 'ignition-left', true).yawRad).toBe(1.0);
    expect(poseAt(730, 'wing-right', true).yawRad).toBe(-0.85);
  });
});

describe('allocation-free writing (AC-6)', () => {
  it('writes and returns the same out object across frames', () => {
    const out = createRevealStagePose();

    const flash = revealStagePose(730, 'cockpit', false, out);
    expect(flash).toBe(out);
    expect(out).toEqual({
      phase: 'flash',
      yawRad: 0.45,
      scale: 1.1,
      slotPulse: 1,
      ringScale: 0.4,
      ringOpacity: 0,
      flashOpacity: 0.85,
    });

    const charge = revealStagePose(0, 'hull', false, flash);
    expect(charge).toBe(out);
    expect(out).toEqual({
      phase: 'charge',
      yawRad: REVEAL_START_YAW_RAD,
      scale: 1,
      slotPulse: 1,
      ringScale: 0.4,
      ringOpacity: 0,
      flashOpacity: 0,
    });
  });

  it('creates a fresh rest-row buffer per call', () => {
    const first = createRevealStagePose();
    const second = createRevealStagePose();
    expect(first).not.toBe(second);
    expect(second).toEqual({
      phase: 'rest',
      yawRad: 0.35,
      scale: 1,
      slotPulse: 1,
      ringScale: 1,
      ringOpacity: 0,
      flashOpacity: 0,
    });
  });
});
