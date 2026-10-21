import { BufferGeometry, Points, PointsMaterial, Quaternion, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { STAR_COUNT } from '../game/effects';
import {
  createStarfield,
  STARFIELD_DEPTH_FAR,
  STARFIELD_DEPTH_NEAR,
  STARFIELD_TAN,
} from './starfield';

/** Random source replaying the given draws in order (cycling) — fully reproducible. */
function sequenceRandom(draws: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = draws[index % draws.length];
    index += 1;
    return value;
  };
}

/** Deterministic LCG (same seed → same stream); mirrors the engine's seeded sources. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Random source counting how many draws the starfield consumes. */
function countingRandom(source: () => number): { random: () => number; calls: () => number } {
  let calls = 0;
  return {
    random: () => {
      calls += 1;
      return source();
    },
    calls: () => calls,
  };
}

/** A fake camera anchor with caller-owned live vectors. */
function createAnchor(position: [number, number, number], quaternion: Quaternion): {
  position: Vector3;
  quaternion: Quaternion;
} {
  return { position: new Vector3(...position), quaternion };
}

describe('createStarfield', () => {
  it('builds exactly STAR_COUNT stars inside one Points object', () => {
    const starfield = createStarfield(seededRandom(1));
    const position = starfield.points.geometry.getAttribute('position');
    const color = starfield.points.geometry.getAttribute('color');

    expect(starfield.points).toBeInstanceOf(Points);
    expect(starfield.points.geometry).toBeInstanceOf(BufferGeometry);
    expect(starfield.points.material).toBeInstanceOf(PointsMaterial);
    expect(position.count).toBe(STAR_COUNT);
    expect(position.count).toBe(1200);
    expect(position.itemSize).toBe(3);
    expect(color.count).toBe(STAR_COUNT);
    expect(color.itemSize).toBe(3);
    expect(starfield.points.scale.toArray()).toEqual([1, 1, 1]);
    expect(starfield.points.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    expect(starfield.points.rotation.toArray()).toEqual([0, 0, 0, 'XYZ']);
  });

  it('pins the point material that draws the stars', () => {
    const starfield = createStarfield(seededRandom(2));

    expect(starfield.points.material.size).toBe(0.6);
    expect(starfield.points.material.sizeAttenuation).toBe(true);
    expect(starfield.points.material.vertexColors).toBe(true);
  });

  it('places every star inside the camera-anchored cone (AC-1)', () => {
    const starfield = createStarfield(seededRandom(1));
    const position = starfield.points.geometry.getAttribute('position');

    for (let index = 0; index < STAR_COUNT; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const depth = -position.getZ(index);

      expect(depth).toBeGreaterThanOrEqual(STARFIELD_DEPTH_NEAR);
      expect(depth).toBeLessThanOrEqual(STARFIELD_DEPTH_FAR);
      expect(Math.abs(x) / depth).toBeLessThanOrEqual(STARFIELD_TAN);
      expect(Math.abs(y) / depth).toBeLessThanOrEqual(STARFIELD_TAN);
    }

    // The pinned contract values (spec r2 AC-1): depths [20, 160] and the single square
    // half-tangent derived from the 50° lens, the 21:9 aspect bound and the 15% margin.
    expect([STARFIELD_DEPTH_NEAR, STARFIELD_DEPTH_FAR]).toEqual([20, 160]);
    expect(STARFIELD_TAN).toBe(1.251258882715913);
  });

  it('maps the first and last star draws onto the cone exactly', () => {
    // Draw order per star: x, y, depth, brightness.
    const starfield = createStarfield(sequenceRandom([0.5, 0.5, 0.5, 1, 1, 0, 1, 0]));
    const position = starfield.points.geometry.getAttribute('position');
    const color = starfield.points.geometry.getAttribute('color');

    // Star 0: x = 0, y = 0, depth = 20 + 0.5 · 140 = 90 (z = −90),
    // brightness = 0.5 + 1 · 0.5 = 1.
    expect([position.getX(0), position.getY(0), position.getZ(0)]).toEqual([0, 0, -90]);
    expect([color.getX(0), color.getY(0), color.getZ(0)]).toEqual([1, 1, 1]);

    // Star 1199 (odd index → the second repeated draw pattern): depth = 160,
    // x = (1 − 0.5) · 2 · 160 · TAN = 160 · TAN (stored as f32),
    // y = (0 − 0.5) · 2 · 160 · TAN = −160 · TAN (f32), z = −160, brightness 0.5.
    expect([position.getX(1199), position.getY(1199), position.getZ(1199)]).toEqual([
      200.201416015625, -200.201416015625, -160,
    ]);
    expect([color.getX(1199), color.getY(1199), color.getZ(1199)]).toEqual([0.5, 0.5, 0.5]);
  });

  it('consumes exactly four draws per star, whatever the drawn values are', () => {
    const seeded = countingRandom(seededRandom(3));
    createStarfield(seeded.random);
    expect(seeded.calls()).toBe(4 * STAR_COUNT);

    const uniform = countingRandom(sequenceRandom([0.25]));
    createStarfield(uniform.random);
    expect(uniform.calls()).toBe(4 * STAR_COUNT);
  });

  it('is reproducible from a seeded source and varies with the seed', () => {
    const first = createStarfield(seededRandom(7));
    const second = createStarfield(seededRandom(7));
    const other = createStarfield(seededRandom(8));

    const firstPositions = Array.from(
      first.points.geometry.getAttribute('position').array as Float32Array,
    );
    const secondPositions = Array.from(
      second.points.geometry.getAttribute('position').array as Float32Array,
    );
    const otherPositions = Array.from(
      other.points.geometry.getAttribute('position').array as Float32Array,
    );

    expect(secondPositions).toEqual(firstPositions);
    expect(otherPositions).not.toEqual(firstPositions);

    // Seed 7: the first and the last star of the seeded stream, exactly (f32 storage).
    const position = first.points.geometry.getAttribute('position');
    const color = first.points.geometry.getAttribute('color');
    expect([position.getX(0), position.getY(0), position.getZ(0)]).toEqual([
      -69.12860107421875, 109.4261703491211, -105.74883270263672,
    ]);
    expect([color.getX(0), color.getY(0), color.getZ(0)]).toEqual([
      0.9634907245635986, 0.9634907245635986, 0.9634907245635986,
    ]);
    expect([position.getX(1199), position.getY(1199), position.getZ(1199)]).toEqual([
      -17.420745849609375, -28.543577194213867, -22.971054077148438,
    ]);
    expect(color.getX(1199)).toBe(0.7416720986366272);
  });
});

describe('view-axis swirl (AC-1)', () => {
  it('swirls about the view axis at the pinned rate and never advances backwards', () => {
    const starfield = createStarfield(seededRandom(4));

    expect(starfield.points.quaternion.toArray()).toEqual([0, 0, 0, 1]);

    starfield.update(1000);
    // RotZ(1000 / 65536) = RotZ(0.0152587890625). Three's Euler round-trip of this exact
    // quaternion lands one ulp below the ideal angle (0.015258789062499998), so the exact
    // composed doubles are pinned: z = sin(θ/2), w = cos(θ/2).
    expect(starfield.points.quaternion.toArray()).toEqual([
      0, 0, 0.007629320516597103, 0.9999708963107151,
    ]);
    expect(starfield.points.rotation.z).toBe(0.015258789062499998);

    starfield.update(1000);
    // RotZ(0.030517578125): the euler round-trip is exact here.
    expect(starfield.points.quaternion.toArray()).toEqual([
      0, 0, 0.015258196950446667, 0.99988358693691,
    ]);
    expect(starfield.points.rotation.z).toBe(0.030517578125);

    // A zero (or negative) frame time advances nothing (the rate is max(0, dtMs) · 1/65536).
    starfield.update(0);
    starfield.update(-1000);
    expect(starfield.points.rotation.z).toBe(0.030517578125);

    // Slow: one minute of swirl is under one radian (a full turn takes ~6.9 minutes).
    starfield.update(58_000);
    expect(starfield.points.quaternion.toArray()).toEqual([
      0, 0, 0.4419431311060369, 0.897043069684055,
    ]);
    expect(starfield.points.rotation.z).toBe(0.9155273437500001);
  });

  it('anchors to the world-identity pose when no anchor is passed', () => {
    const starfield = createStarfield(seededRandom(5));

    starfield.update(1000, undefined, createAnchor([3, 4, 5], new Quaternion()));
    expect(starfield.points.position.toArray()).toEqual([3, 4, 5]);

    // No anchor: the backdrop returns to the origin and keeps the swirl.
    starfield.update(0);
    expect(starfield.points.position.toArray()).toEqual([0, 0, 0]);
    expect(starfield.points.quaternion.toArray()).toEqual([
      0, 0, 0.007629320516597103, 0.9999708963107151,
    ]);
    expect(starfield.points.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('copies the anchor position and orientation, composing the swirl with it', () => {
    const starfield = createStarfield(seededRandom(6));
    const anchorQuaternion = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);
    const anchor = createAnchor([3, 4, 5], anchorQuaternion);

    starfield.update(0, undefined, anchor);

    expect(starfield.points.position.toArray()).toEqual([3, 4, 5]);
    // Anchor quaternion × RotZ(0) = the anchor quaternion itself.
    expect(starfield.points.quaternion.toArray()).toEqual([
      0, 0.7071067811865475, 0, 0.7071067811865476,
    ]);

    // The anchor holds the caller's live vectors: moving them moves the backdrop.
    anchor.position.set(-1, -2, -3);
    anchor.quaternion.set(0, 0, 0, 1);
    starfield.update(0, undefined, anchor);
    expect(starfield.points.position.toArray()).toEqual([-1, -2, -3]);
    expect(starfield.points.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  });

  it('never rebuilds the starfield, its geometry or its star positions', () => {
    const starfield = createStarfield(seededRandom(5));
    const points = starfield.points;
    const geometry = starfield.points.geometry;
    const position = geometry.getAttribute('position');
    const before = Float32Array.from(position.array as Float32Array);

    starfield.update(16);
    starfield.update(16, 0.5, createAnchor([1, 1, 1], new Quaternion()));
    starfield.update(16, 1);

    expect(starfield.points).toBe(points);
    expect(starfield.points.geometry).toBe(geometry);
    expect(starfield.points.geometry.getAttribute('position')).toBe(position);
    expect(Array.from(position.array as Float32Array)).toEqual(Array.from(before));
  });
});

describe('travel expansion (AC-3)', () => {
  it('follows the symmetric expand → contract scale table, leaving z at 1', () => {
    const starfield = createStarfield(seededRandom(6));

    expect(starfield.points.scale.toArray()).toEqual([1, 1, 1]);

    // S = 1 + 7 · travelSwing(p) at the pinned progress values (spec AC-3).
    const table: ReadonlyArray<readonly [number, readonly [number, number, number]]> = [
      [0, [1, 1, 1]],
      [0.125, [1.875, 1.875, 1]],
      [0.25, [4.5, 4.5, 1]],
      [0.375, [7.125, 7.125, 1]],
      [0.5, [8, 8, 1]],
      [0.625, [7.125, 7.125, 1]],
      [0.75, [4.5, 4.5, 1]],
      [0.875, [1.875, 1.875, 1]],
      [1, [1, 1, 1]],
    ];

    for (const [progress, scale] of table) {
      starfield.update(0, progress);
      expect(starfield.points.scale.toArray()).toEqual(scale);
    }
  });

  it('clamps the travel input at both ends', () => {
    const starfield = createStarfield(seededRandom(10));

    starfield.update(0, 2);
    expect(starfield.points.scale.toArray()).toEqual([1, 1, 1]);

    starfield.update(0, 5);
    expect(starfield.points.scale.toArray()).toEqual([1, 1, 1]);

    starfield.update(0, -1);
    expect(starfield.points.scale.toArray()).toEqual([1, 1, 1]);

    starfield.update(0, -0.5);
    expect(starfield.points.scale.toArray()).toEqual([1, 1, 1]);

    // The midpoint is the peak: any input beyond it clamps through the symmetric swing.
    starfield.update(0, 0.5);
    expect(starfield.points.scale.toArray()).toEqual([8, 8, 1]);
  });

  it('keeps the last expansion when the frame advance omits the travel progress', () => {
    const starfield = createStarfield(seededRandom(7));

    starfield.update(16, 0.25);
    expect(starfield.points.scale.toArray()).toEqual([4.5, 4.5, 1]);

    starfield.update(16);
    expect(starfield.points.scale.toArray()).toEqual([4.5, 4.5, 1]);

    starfield.update(16, 0);
    expect(starfield.points.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('scales the same Points object without touching its stars', () => {
    const starfield = createStarfield(seededRandom(11));
    const points = starfield.points;
    const position = points.geometry.getAttribute('position');
    const before = Float32Array.from(position.array as Float32Array);

    starfield.update(16, 0.5);
    starfield.update(16, 1);

    expect(starfield.points).toBe(points);
    expect(points.geometry.getAttribute('position')).toBe(position);
    expect(Array.from(position.array as Float32Array)).toEqual(Array.from(before));
  });
});

describe('dispose', () => {
  it('releases the geometry and the material exactly once', () => {
    const starfield = createStarfield(seededRandom(9));
    const geometryDispose = vi.spyOn(starfield.points.geometry, 'dispose');
    const materialDispose = vi.spyOn(starfield.points.material, 'dispose');

    starfield.dispose();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).toHaveBeenCalledWith();
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledWith();
  });
});
