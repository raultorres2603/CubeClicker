import { describe, expect, it } from 'vitest';

import {
  BURST_ORIGIN_OFFSET,
  createBurst,
  DEFAULT_TIMINGS,
  easeInOutQuad,
  easeOutCubic,
  EXPLOSION_PARTICLE_COUNT,
  MINI_CUBE_POP_COLOR_STRENGTH,
  MINI_CUBE_POP_EXPAND_MS,
  MINI_CUBE_POP_MS,
  MINI_CUBE_POP_PEAK_SCALE,
  PARTICLE_POOL_CAP,
  PIXEL_RATIO_CAP,
  popColorMultiplierAt,
  popScaleAt,
  REDUCED_TIMINGS,
  STAR_COUNT,
  TAP_DRAG_THRESHOLD_PX,
  timingsFor,
  TRAVEL_LEVEL_ADVANCE_P,
  TRAVEL_STARFIELD_SCALE,
  travelSwing,
} from './effects';

/** Random source replaying the given draws in order (cycling) — fully reproducible. */
function sequenceRandom(draws: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = draws[index % draws.length];
    index += 1;
    return value;
  };
}

/** Deterministic LCG for multi-particle bursts (same seed → same burst). */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('pinned timing profiles', () => {
  it('pins the default profile to 2500/2500/300/350/400', () => {
    expect(DEFAULT_TIMINGS).toEqual({
      introMs: 2500,
      travelMs: 2500,
      rotationMs: 300,
      explosionMs: 350,
      faceFadeMs: 400,
    });
  });

  it('pins the reduced-motion profile to 150/150/0/0/100', () => {
    expect(REDUCED_TIMINGS).toEqual({
      introMs: 150,
      travelMs: 150,
      rotationMs: 0,
      explosionMs: 0,
      faceFadeMs: 100,
    });
  });

  it('collapses rotation and explosion to 0 ms in the reduced profile', () => {
    expect(DEFAULT_TIMINGS.rotationMs).toBe(300);
    expect(REDUCED_TIMINGS.rotationMs).toBe(0);
    expect(DEFAULT_TIMINGS.explosionMs).toBe(350);
    expect(REDUCED_TIMINGS.explosionMs).toBe(0);
  });

  it('selects the profile from the motion flag and returns the shared profile objects', () => {
    expect(timingsFor(false)).toBe(DEFAULT_TIMINGS);
    expect(timingsFor(true)).toBe(REDUCED_TIMINGS);
  });
});

describe('non-grid pinned constants', () => {
  it('pins the star count, particle count, pool cap, tap threshold and pixel-ratio cap', () => {
    expect(STAR_COUNT).toBe(1200);
    expect(EXPLOSION_PARTICLE_COUNT).toBe(24);
    expect(PARTICLE_POOL_CAP).toBe(72);
    expect(TAP_DRAG_THRESHOLD_PX).toBe(40);
    expect(PIXEL_RATIO_CAP).toBe(2);
  });

  it('derives the pool cap from three concurrent bursts', () => {
    expect(PARTICLE_POOL_CAP).toBe(3 * EXPLOSION_PARTICLE_COUNT);
    expect(PARTICLE_POOL_CAP / EXPLOSION_PARTICLE_COUNT).toBe(3);
  });

  it('pins the visual-polish constants (AC-1, AC-3, AC-4)', () => {
    expect(TRAVEL_STARFIELD_SCALE).toBe(8);
    expect(BURST_ORIGIN_OFFSET).toBe(0.5);
    expect(MINI_CUBE_POP_MS).toBe(160);
    expect(MINI_CUBE_POP_EXPAND_MS).toBe(100);
    expect(MINI_CUBE_POP_PEAK_SCALE).toBe(1.1);
    expect(MINI_CUBE_POP_COLOR_STRENGTH).toBe(0.3);
  });

  it('pins the travel level-advance fraction to the midpoint (AC-3)', () => {
    expect(TRAVEL_LEVEL_ADVANCE_P).toBe(0.5);
  });
});

describe('easeOutCubic', () => {
  it('returns the exact values at t = 0, 0.25, 0.5, 0.75 and 1', () => {
    expect([0, 0.25, 0.5, 0.75, 1].map(easeOutCubic)).toEqual([
      0, 0.578125, 0.875, 0.984375, 1,
    ]);
  });

  it('yields the AC-22 intro camera positions (60 → 18 at 0.5 → 12)', () => {
    // scene.ts interpolates the intro flight as z = 60 - 48 * easeOutCubic(progress).
    expect([0, 0.5, 1].map((progress) => 60 - 48 * easeOutCubic(progress))).toEqual([60, 18, 12]);
  });
});

describe('easeInOutQuad', () => {
  it('returns the exact values at t = 0, 0.25, 0.5, 0.75 and 1', () => {
    expect([0, 0.25, 0.5, 0.75, 1].map(easeInOutQuad)).toEqual([0, 0.125, 0.5, 0.875, 1]);
  });
});

describe('travelSwing', () => {
  /** Pinned travel progress samples: rest → turn-around → rest (spec AC-3). */
  const PINNED_PROGRESS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];

  it('pins the swing table 0 → 1 → 0 symmetrically', () => {
    expect(PINNED_PROGRESS.map(travelSwing)).toEqual([
      0, 0.125, 0.5, 0.875, 1, 0.875, 0.5, 0.125, 0,
    ]);
  });

  it('clamps both ends of the progress range', () => {
    expect([-1, -0.001, 0].map(travelSwing)).toEqual([0, 0, 0]);
    expect([1, 1.001, 2].map(travelSwing)).toEqual([0, 0, 0]);
  });

  it('rises strictly to the midpoint and falls strictly back to the rest value', () => {
    const values = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map(travelSwing);

    for (let index = 1; index <= 5; index += 1) {
      expect(values[index]).toBeGreaterThan(values[index - 1]);
    }
    for (let index = 6; index < values.length; index += 1) {
      expect(values[index]).toBeLessThan(values[index - 1]);
    }
  });

  it('yields the AC-3 travel camera positions (12 → 90 → 12)', () => {
    // scene.ts flies the camera as z = 12 + 78 * travelSwing(progress).
    expect(PINNED_PROGRESS.map((progress) => 12 + 78 * travelSwing(progress))).toEqual([
      12, 21.75, 51, 80.25, 90, 80.25, 51, 21.75, 12,
    ]);
  });

  it('yields the AC-3 starfield scale table (1 → 8 → 1, z stays 1)', () => {
    // starfield.ts scales the backdrop as S = 1 + 7 * travelSwing(progress), applied as (S, S, 1).
    expect(PINNED_PROGRESS.map((progress) => 1 + 7 * travelSwing(progress))).toEqual([
      1, 1.875, 4.5, 7.125, 8, 7.125, 4.5, 1.875, 1,
    ]);
  });
});

describe('popScaleAt', () => {
  it('follows the pinned pop timeline at t = 0 / 50 / 100 / 130 / 160 / 161 ms', () => {
    // Expand 1 → 1.1 over 100 ms, shrink 1.1 → 0 over the remaining 60 ms (AC-4).
    expect([0, 50, 100, 130, 160, 161].map(popScaleAt)).toEqual([1, 1.05, 1.1, 0.55, 0, 0]);
  });

  it('settles to the hidden zero-scale at and after the total duration, clamping earlier time to the start', () => {
    expect([-10, 0].map(popScaleAt)).toEqual([1, 1]);
    expect([200, 1000].map(popScaleAt)).toEqual([0, 0]);
  });
});

describe('popColorMultiplierAt', () => {
  it('follows the pinned colour-flash timeline at t = 0 / 50 / 100 / 130 / 160 / 161 ms', () => {
    // 1 → 1.3 over the expand phase, back to 1 over the shrink phase (AC-4, bounded flash).
    expect([0, 50, 100, 130, 160, 161].map(popColorMultiplierAt)).toEqual([
      1, 1.15, 1.3, 1.15, 1, 1,
    ]);
  });

  it('returns to exactly 1 outside the envelope and peaks at the bounded flash strength', () => {
    expect([-10, 200, 1000].map(popColorMultiplierAt)).toEqual([1, 1, 1]);
    expect(popColorMultiplierAt(100)).toBe(1 + MINI_CUBE_POP_COLOR_STRENGTH);
  });
});

describe('createBurst', () => {
  it('creates EXPLOSION_PARTICLE_COUNT particles with the default explosion lifetime', () => {
    const burst = createBurst(seededRandom(7));

    expect(burst.particles).toHaveLength(24);
    expect(burst.particles).toHaveLength(EXPLOSION_PARTICLE_COUNT);
    expect(burst.lifetimeMs).toBe(350);
    expect(burst.lifetimeMs).toBe(DEFAULT_TIMINGS.explosionMs);
  });

  it('turns the injected draws into the first particle exactly', () => {
    // (0.75, 0.5, 0.5) → raw (0.5, 0, 0) → unit direction (1, 0, 0); then speed 0.25 → 1.5,
    // then size 0.5 → 0.045.
    const burst = createBurst(sequenceRandom([0.75, 0.5, 0.5, 0.25, 0.5]), 1);

    expect(burst).toEqual({
      particles: [{ dx: 1, dy: 0, dz: 0, speed: 1.5, size: 0.045 }],
      lifetimeMs: 350,
    });
  });

  it('consumes five draws per particle, in direction → speed → size order', () => {
    // Particle 2 draws: (0.5, 0.75, 0.5) → raw (0, 0.5, 0) → unit direction (0, 1, 0);
    // then speed 1 → 3, then size 0 → 0.02.
    const burst = createBurst(
      sequenceRandom([0.75, 0.5, 0.5, 0.25, 0.5, 0.5, 0.75, 0.5, 1, 0]),
      2,
    );

    expect(burst.particles).toEqual([
      { dx: 1, dy: 0, dz: 0, speed: 1.5, size: 0.045 },
      { dx: 0, dy: 1, dz: 0, speed: 3, size: 0.02 },
    ]);
  });

  it('normalises an off-axis direction to a unit vector', () => {
    // (0.75, 0.75, 0.5) → raw (0.5, 0.5, 0) → scaled by 1/√0.5 = 1.4142135623730951.
    const burst = createBurst(sequenceRandom([0.75, 0.75, 0.5, 0, 0]), 1);

    expect(burst.particles).toEqual([
      { dx: 0.7071067811865475, dy: 0.7071067811865475, dz: 0, speed: 1, size: 0.02 },
    ]);
  });

  it('falls back to a fixed direction when the drawn vector is degenerate', () => {
    // All draws 0.5 → raw (0, 0, 0), which cannot be normalised.
    const burst = createBurst(sequenceRandom([0.5]), 1);

    expect(burst.particles).toEqual([{ dx: 0, dy: 0, dz: 1, speed: 2, size: 0.045 }]);
  });

  it('is deterministic for one seed and hands out fresh particle objects per burst', () => {
    const first = createBurst(seededRandom(42));
    const second = createBurst(seededRandom(42));

    expect(second).toEqual(first);
    expect(second.particles).toHaveLength(24);
    expect(second.particles[0]).not.toBe(first.particles[0]);
    expect(second.particles[23]).not.toBe(first.particles[23]);
  });

  it('derives the whole burst from the injected random source', () => {
    const burst = createBurst(seededRandom(43));

    expect(burst.particles[0]).toEqual({
      dx: -0.5260517053149611,
      dy: -0.6832794732179386,
      dz: -0.5063583363728079,
      speed: 1.519141263794154,
      size: 0.022106322743929922,
    });
  });

  it('honours an explicit particle count, including zero', () => {
    expect(createBurst(seededRandom(5), 3).particles).toHaveLength(3);
    expect(createBurst(seededRandom(5), 0).particles).toEqual([]);
    expect(createBurst(seededRandom(5), 0).lifetimeMs).toBe(350);
  });
});
