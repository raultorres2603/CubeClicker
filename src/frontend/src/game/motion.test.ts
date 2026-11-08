import { describe, expect, it } from 'vitest';

import {
  clamp01,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  easeOutQuad,
  easeOutQuint,
  MOTION,
} from './motion';

describe('MOTION tokens (AC-34)', () => {
  it('pins every observed and extrapolated value exactly', () => {
    expect(MOTION).toEqual({
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
    });
  });

  it('pins the observed animation headline values from the brief', () => {
    expect(MOTION.coinPopMs).toBe(1100);
    expect(MOTION.shockwaveGrowMs).toBe(330);
    expect(MOTION.orbOvershootMs).toBe(250);
    expect(MOTION.orbOvershootScale).toBe(1.25);
    expect(MOTION.bannerPeakMs).toBe(250);
    expect(MOTION.bannerOvershootScale).toBe(1.08);
    expect(MOTION.levelBurstMs).toBe(760);
    expect(MOTION.debrisLifetimeMs).toBe(1200);
    expect(MOTION.shipRollMs).toBe(700);
    expect(MOTION.fireTrailMs).toBe(700);
  });

  it('pins the extrapolated lootbox stage sum to the 1290 ms total', () => {
    expect(MOTION.lootboxChargeMs).toBe(420);
    expect(MOTION.orbOvershootMs).toBe(250);
    expect(MOTION.lootboxFlashMs).toBe(120);
    expect(MOTION.lootboxRevealMs).toBe(360);
    expect(MOTION.lootboxSettleMs).toBe(140);
    expect(
      MOTION.lootboxChargeMs +
        MOTION.orbOvershootMs +
        MOTION.lootboxFlashMs +
        MOTION.lootboxRevealMs +
        MOTION.lootboxSettleMs,
    ).toBe(MOTION.lootboxTotalMs);
    expect(MOTION.lootboxTotalMs).toBe(1290);
  });

  it('pins the level burst, ray and pool decompositions', () => {
    expect(MOTION.levelBurstAttackMs + MOTION.levelBurstReleaseMs).toBe(
      MOTION.levelBurstMs,
    );
    expect(MOTION.rayGrowMs + MOTION.rayHoldMs + MOTION.rayFadeMs).toBe(
      MOTION.rayTotalMs,
    );
    expect(MOTION.debrisPoolCap).toBe(MOTION.debrisPerPop * 3);
    expect(MOTION.coinPoolCap).toBe(MOTION.coinsPerPop * 3);
    expect(MOTION.reticleFadeMs).toBe(120);
    expect(MOTION.equipPulseMs).toBe(260);
    expect(MOTION.equipPulseScale).toBe(0.04);
    expect(MOTION.equipRowFlashMs).toBe(260);
    expect(MOTION.upgradePulseMs).toBe(260);
    expect(MOTION.trailLifetimeMs).toBe(220);
    expect(MOTION.trailCount).toBe(8);
  });
});

describe('easeOutCubic (AC-34)', () => {
  it('pins the endpoints and quarter/half points', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(0.25)).toBe(0.578125);
    expect(easeOutCubic(0.5)).toBe(0.875);
    expect(easeOutCubic(1)).toBe(1);
  });
});

describe('easeOutQuad (AC-34)', () => {
  it('pins the endpoints and half point', () => {
    expect(easeOutQuad(0)).toBe(0);
    expect(easeOutQuad(0.5)).toBe(0.75);
    expect(easeOutQuad(1)).toBe(1);
  });
});

describe('easeOutQuint (AC-34)', () => {
  it('pins the endpoints and half point', () => {
    expect(easeOutQuint(0)).toBe(0);
    expect(easeOutQuint(0.5)).toBe(0.96875);
    expect(easeOutQuint(1)).toBe(1);
  });
});

describe('easeInOutCubic (AC-34)', () => {
  it('pins the endpoints and quarter/half/three-quarter points', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.25)).toBe(0.0625);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(0.75)).toBe(0.9375);
    expect(easeInOutCubic(1)).toBe(1);
  });
});

describe('easeOutBack (AC-34)', () => {
  it('defaults to c1 = 1.5 and pins its 1.08 peak at t = 0.6', () => {
    expect(easeOutBack(0)).toBe(0);
    expect(easeOutBack(0.5)).toBe(1.0625);
    expect(easeOutBack(0.6)).toBe(1.08);
    expect(easeOutBack(1)).toBe(1);
  });

  it('pins the c1 = 3.0 orb envelope with its 1.25 peak at t = 0.5', () => {
    expect(easeOutBack(0, 3)).toBe(0);
    expect(easeOutBack(0.5, 3)).toBe(1.25);
    expect(easeOutBack(1, 3)).toBe(1);
  });
});

describe('clamp01 (AC-34)', () => {
  it('clamps into [0, 1] and passes through in-range values', () => {
    expect(clamp01(-2)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(7)).toBe(1);
  });
});
