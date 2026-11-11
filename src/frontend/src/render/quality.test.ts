import { describe, expect, it } from 'vitest';

import * as qualityModule from './quality';
import {
  createQualityPolicy,
  QUALITY_CURSOR_MESH_COUNTS,
  QUALITY_DOWNGRADE_COOLDOWN_MS,
  QUALITY_DOWNGRADE_STABLE_FRAMES,
  QUALITY_LOW_HIDDEN_MESHES,
  QUALITY_LOW_UPGRADE_STABLE_FRAMES,
  QUALITY_MAX_FRAME_MS,
  QUALITY_MEDIUM_HIDDEN_MESHES,
  QUALITY_MIN_SAMPLES,
  QUALITY_SHARD_COUNTS,
  QUALITY_SPARK_COUNTS,
  QUALITY_UPGRADE_COOLDOWN_MS,
  QUALITY_UPGRADE_STABLE_FRAMES,
  QUALITY_WINDOW_FRAMES,
  qualityFeatures,
  type QualityPolicy,
} from './quality';

function push(policy: QualityPolicy, count: number, dtMs: number): void {
  for (let index = 0; index < count; index += 1) {
    policy.pushFrameTime(dtMs);
  }
}

describe('quality constants (AC-52)', () => {
  it('pins the window, sample, stability and cooldown values', () => {
    expect(QUALITY_WINDOW_FRAMES).toBe(120);
    expect(QUALITY_MAX_FRAME_MS).toBe(250);
    expect(QUALITY_MIN_SAMPLES).toBe(60);
    expect(QUALITY_DOWNGRADE_STABLE_FRAMES).toBe(60);
    expect(QUALITY_UPGRADE_STABLE_FRAMES).toBe(180);
    expect(QUALITY_LOW_UPGRADE_STABLE_FRAMES).toBe(240);
    expect(QUALITY_DOWNGRADE_COOLDOWN_MS).toBe(1000);
    expect(QUALITY_UPGRADE_COOLDOWN_MS).toBe(3000);
  });

  it('pins the per-tier mesh, shard and spark counts', () => {
    expect(QUALITY_CURSOR_MESH_COUNTS).toEqual({ high: 21, medium: 17, low: 15 });
    expect(QUALITY_SHARD_COUNTS).toEqual({ high: 14, medium: 7, low: 0 });
    expect(QUALITY_SPARK_COUNTS).toEqual({ high: 24, medium: 12, low: 0 });
    expect(QUALITY_MEDIUM_HIDDEN_MESHES).toEqual([
      'cursor-hull-seam-1',
      'cursor-hull-seam-2',
      'cursor-vent-left',
      'cursor-vent-right',
    ]);
    expect(QUALITY_LOW_HIDDEN_MESHES).toEqual([
      'cursor-hull-seam-1',
      'cursor-hull-seam-2',
      'cursor-vent-left',
      'cursor-vent-right',
      'cursor-wing-left-tip',
      'cursor-wing-right-tip',
    ]);
  });
});

describe('qualityFeatures matrix (AC-52)', () => {
  it('drops the retired impact fields and constant', () => {
    expect(Object.keys(qualityModule)).not.toContain('QUALITY_IMPACT_COUNTS');
    expect(Object.keys(qualityFeatures('high', false)).sort()).toEqual([
      'bannerMotion',
      'coinPopup',
      'cursorMeshCount',
      'cursorMotion',
      'hiddenCursorMeshes',
      'impactShards',
      'reticle',
      'sparks',
      'tier',
      'trail',
    ]);
  });

  it('high tier enables every layer', () => {
    expect(qualityFeatures('high', false)).toEqual({
      tier: 'high',
      reticle: true,
      trail: true,
      cursorMotion: true,
      hiddenCursorMeshes: [],
      cursorMeshCount: 21,
      impactShards: 14,
      sparks: 24,
      coinPopup: true,
      bannerMotion: true,
    });
  });

  it('medium tier hides four detail meshes and reduces the effect counts', () => {
    expect(qualityFeatures('medium', false)).toEqual({
      tier: 'medium',
      reticle: false,
      trail: false,
      cursorMotion: true,
      hiddenCursorMeshes: QUALITY_MEDIUM_HIDDEN_MESHES,
      cursorMeshCount: 17,
      impactShards: 7,
      sparks: 12,
      coinPopup: true,
      bannerMotion: true,
    });
  });

  it('low tier keeps only the minimal cursor, coin popup and banner core', () => {
    expect(qualityFeatures('low', false)).toEqual({
      tier: 'low',
      reticle: false,
      trail: false,
      cursorMotion: false,
      hiddenCursorMeshes: QUALITY_LOW_HIDDEN_MESHES,
      cursorMeshCount: 15,
      impactShards: 0,
      sparks: 0,
      coinPopup: true,
      bannerMotion: true,
    });
  });

  it('reduced motion disables every motion layer at every tier while detail still downgrades', () => {
    expect(qualityFeatures('high', true)).toEqual({
      tier: 'high',
      reticle: false,
      trail: false,
      cursorMotion: false,
      hiddenCursorMeshes: [],
      cursorMeshCount: 21,
      impactShards: 0,
      sparks: 0,
      coinPopup: true,
      bannerMotion: false,
    });
    expect(qualityFeatures('medium', true)).toEqual({
      tier: 'medium',
      reticle: false,
      trail: false,
      cursorMotion: false,
      hiddenCursorMeshes: QUALITY_MEDIUM_HIDDEN_MESHES,
      cursorMeshCount: 17,
      impactShards: 0,
      sparks: 0,
      coinPopup: true,
      bannerMotion: false,
    });
    expect(qualityFeatures('low', true)).toEqual({
      tier: 'low',
      reticle: false,
      trail: false,
      cursorMotion: false,
      hiddenCursorMeshes: QUALITY_LOW_HIDDEN_MESHES,
      cursorMeshCount: 15,
      impactShards: 0,
      sparks: 0,
      coinPopup: true,
      bannerMotion: false,
    });
  });
});

describe('quality policy (AC-52)', () => {
  it('starts at high and reports an empty window', () => {
    const policy = createQualityPolicy();

    expect(policy.getTier()).toBe('high');
    expect(policy.getWindowSize()).toBe(0);
    expect(policy.getAverageFrameMs()).toBe(0);
    expect(policy.getP95FrameMs()).toBe(0);
  });

  it('ignores non-finite and non-positive values and clamps frames above 250 ms', () => {
    const policy = createQualityPolicy('low');

    policy.pushFrameTime(Number.NaN);
    policy.pushFrameTime(Number.POSITIVE_INFINITY);
    policy.pushFrameTime(0);
    policy.pushFrameTime(-16);
    expect(policy.getWindowSize()).toBe(0);

    push(policy, 60, 1000);
    expect(policy.getWindowSize()).toBe(60);
    expect(policy.getAverageFrameMs()).toBe(250);
    expect(policy.getP95FrameMs()).toBe(250);
  });

  it('keeps only the last 120 frames in the rolling window', () => {
    const policy = createQualityPolicy('low');
    push(policy, 130, 10);

    expect(policy.getWindowSize()).toBe(120);
    expect(policy.getAverageFrameMs()).toBe(10);
    expect(policy.getP95FrameMs()).toBe(10);
  });

  it('needs 60 samples before any decision', () => {
    const policy = createQualityPolicy();

    push(policy, 59, 30);
    expect(policy.getTier()).toBe('high');

    policy.pushFrameTime(30);
    expect(policy.getTier()).toBe('medium');
  });

  it('high→medium: avg must exceed 18.0 and p95 must exceed 24.0', () => {
    const atAverage = createQualityPolicy();
    push(atAverage, 60, 18);
    expect(atAverage.getAverageFrameMs()).toBe(18);
    expect(atAverage.getP95FrameMs()).toBe(18);
    expect(atAverage.getTier()).toBe('high');

    const aboveAverage = createQualityPolicy();
    push(aboveAverage, 60, 18.1);
    expect(aboveAverage.getTier()).toBe('medium');

    // A 14-fast/1-slow cycle keeps the p95 in the slow tail while the average stays well
    // below the 18 ms threshold; the p95 alone decides.
    const atP95 = createQualityPolicy();
    for (let cycle = 0; cycle < 8; cycle += 1) {
      push(atP95, 14, 10);
      atP95.pushFrameTime(24);
    }
    expect(atP95.getP95FrameMs()).toBe(24);
    expect(atP95.getAverageFrameMs()).toBeLessThan(18);
    expect(atP95.getTier()).toBe('high');

    const aboveP95 = createQualityPolicy();
    for (let cycle = 0; cycle < 8; cycle += 1) {
      push(aboveP95, 14, 10);
      aboveP95.pushFrameTime(25);
    }
    expect(aboveP95.getP95FrameMs()).toBe(25);
    expect(aboveP95.getAverageFrameMs()).toBeLessThan(18);
    expect(aboveP95.getTier()).toBe('medium');
  });

  it('high→medium needs the condition sustained for exactly 60 frames', () => {
    const policy = createQualityPolicy();
    push(policy, 59, 19);
    expect(policy.getTier()).toBe('high');
    policy.pushFrameTime(19);
    expect(policy.getTier()).toBe('medium');
  });

  it('medium→low: avg must exceed 20.0 or p95 must exceed 28.0', () => {
    const atAverage = createQualityPolicy('medium');
    push(atAverage, 60, 20);
    expect(atAverage.getAverageFrameMs()).toBe(20);
    expect(atAverage.getP95FrameMs()).toBe(20);
    expect(atAverage.getTier()).toBe('medium');

    const aboveAverage = createQualityPolicy('medium');
    push(aboveAverage, 60, 20.1);
    expect(aboveAverage.getTier()).toBe('low');

    const atP95 = createQualityPolicy('medium');
    for (let cycle = 0; cycle < 8; cycle += 1) {
      push(atP95, 14, 10);
      atP95.pushFrameTime(28);
    }
    expect(atP95.getP95FrameMs()).toBe(28);
    expect(atP95.getAverageFrameMs()).toBeLessThan(20);
    expect(atP95.getTier()).toBe('medium');

    const aboveP95 = createQualityPolicy('medium');
    for (let cycle = 0; cycle < 8; cycle += 1) {
      push(aboveP95, 14, 10);
      aboveP95.pushFrameTime(28.1);
    }
    expect(aboveP95.getP95FrameMs()).toBe(28.1);
    expect(aboveP95.getAverageFrameMs()).toBeLessThan(20);
    expect(aboveP95.getTier()).toBe('low');
  });

  it('medium→low downgrades after the downgrade cooldown', () => {
    const policy = createQualityPolicy();
    push(policy, 60, 19);
    expect(policy.getTier()).toBe('medium');

    // The 60-frame window still holds the previous 19 ms samples; the avg crosses 20 ms
    // on the 13th 25 ms frame, so the sustained condition reaches 60 at the 72nd.
    push(policy, 71, 25);
    expect(policy.getTier()).toBe('medium');
    policy.pushFrameTime(25);
    expect(policy.getTier()).toBe('low');
  });

  it('medium→high upgrades after 180 stable frames (avg <= 16 and p95 <= 20)', () => {
    const policy = createQualityPolicy('medium');
    push(policy, QUALITY_UPGRADE_STABLE_FRAMES - 1, 16);
    expect(policy.getTier()).toBe('medium');
    policy.pushFrameTime(16);
    expect(policy.getTier()).toBe('high');
  });

  it('medium→high rejects avg above 16 and p95 above 20', () => {
    const aboveAverage = createQualityPolicy('medium');
    push(aboveAverage, 200, 16.1);
    expect(aboveAverage.getTier()).toBe('medium');

    const aboveP95 = createQualityPolicy('medium');
    // A 15-fast/1-slow cycle keeps ~7 slow frames in every 120-frame window (p95 = 21)
    // while the average stays well below the medium→low threshold.
    for (let cycle = 0; cycle < QUALITY_UPGRADE_STABLE_FRAMES; cycle += 1) {
      push(aboveP95, 15, 10);
      aboveP95.pushFrameTime(21);
    }
    expect(aboveP95.getP95FrameMs()).toBe(21);
    expect(aboveP95.getAverageFrameMs()).toBeLessThan(16);
    expect(aboveP95.getTier()).toBe('medium');
  });

  it('low→medium upgrades after 240 stable frames (avg <= 17 and p95 <= 22)', () => {
    const policy = createQualityPolicy('low');
    push(policy, QUALITY_LOW_UPGRADE_STABLE_FRAMES - 1, 17);
    expect(policy.getTier()).toBe('low');
    policy.pushFrameTime(17);
    expect(policy.getTier()).toBe('medium');
  });

  it('low→medium rejects avg above 17', () => {
    const policy = createQualityPolicy('low');
    push(policy, 260, 17.1);
    expect(policy.getTier()).toBe('low');
  });

  it('applies the 3000 ms upgrade cooldown after a downgrade', () => {
    const policy = createQualityPolicy();
    push(policy, 60, 19);
    expect(policy.getTier()).toBe('medium');

    // The first 120 fast frames replace the slow window; the 180-frame stable streak then
    // starts. 298 fast frames end one frame short of the streak; the 299th upgrades.
    push(policy, 298, 16);
    expect(policy.getTier()).toBe('medium');
    policy.pushFrameTime(16);
    expect(policy.getTier()).toBe('high');
  });

  it('changes at most one tier per decision', () => {
    const policy = createQualityPolicy();
    push(policy, 60, 40);
    expect(policy.getTier()).toBe('medium');
  });

  it('computes p95 with the nearest-rank index ceil(0.95·n) − 1', () => {
    const policy = createQualityPolicy('low');
    push(policy, 113, 10);
    push(policy, 7, 100);

    expect(policy.getWindowSize()).toBe(120);
    expect(policy.getAverageFrameMs()).toBe((113 * 10 + 7 * 100) / 120);
    // Sorted index 113 (the 114th value) is the first 100 ms sample.
    expect(policy.getP95FrameMs()).toBe(100);
    expect(policy.getTier()).toBe('low');
  });

  it('recovers deterministically high → medium → low → medium → high', () => {
    const policy = createQualityPolicy();
    push(policy, 60, 19);
    expect(policy.getTier()).toBe('medium');

    push(policy, 72, 25);
    expect(policy.getTier()).toBe('low');

    // The first 120 stable frames replace the slow probe window; the 240-frame streak
    // then completes 240 frames later.
    push(policy, 360, 17);
    expect(policy.getTier()).toBe('medium');

    push(policy, 298, 16);
    expect(policy.getTier()).toBe('medium');
    policy.pushFrameTime(16);
    expect(policy.getTier()).toBe('high');
  });

  it('setTier forces a tier and applies the normal cooldown afterwards', () => {
    const policy = createQualityPolicy();
    policy.setTier('low');
    expect(policy.getTier()).toBe('low');

    push(policy, 240, 17);
    expect(policy.getTier()).toBe('medium');
  });
});
