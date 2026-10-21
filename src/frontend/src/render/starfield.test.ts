import { BufferGeometry, Points, PointsMaterial } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { STAR_COUNT } from '../game/effects';
import { createStarfield } from './starfield';

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
    expect(starfield.points.rotation.toArray()).toEqual([0, 0, 0, 'XYZ']);
  });

  it('pins the point material that draws the stars', () => {
    const starfield = createStarfield(seededRandom(2));

    expect(starfield.points.material.size).toBe(0.6);
    expect(starfield.points.material.sizeAttenuation).toBe(true);
    expect(starfield.points.material.vertexColors).toBe(true);
  });

  it('maps the first and last star draws onto the star disk exactly', () => {
    // Draw order per star: x, y, z, brightness.
    const starfield = createStarfield(sequenceRandom([0.5, 0.5, 0.5, 1, 1, 0, 1, 0]));
    const position = starfield.points.geometry.getAttribute('position');
    const color = starfield.points.geometry.getAttribute('color');

    // Star 0: x = (0.5 - 0.5) * 140 = 0, y = 0, z = -(8 + 0.5 * 52) = -34,
    // brightness = 0.5 + 1 * 0.5 = 1.
    expect([position.getX(0), position.getY(0), position.getZ(0)]).toEqual([0, 0, -34]);
    expect([color.getX(0), color.getY(0), color.getZ(0)]).toEqual([1, 1, 1]);

    // Star 1199 (odd index → the second repeated draw pattern): x = (1 - 0.5) * 140 = 70,
    // y = (0 - 0.5) * 80 = -40, z = -(8 + 1 * 52) = -60, brightness = 0.5 + 0 * 0.5 = 0.5.
    expect([position.getX(1199), position.getY(1199), position.getZ(1199)]).toEqual([
      70, -40, -60,
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

    // Seed 7: the first and the last star of the seeded stream, exactly.
    const position = first.points.geometry.getAttribute('position');
    const color = first.points.geometry.getAttribute('color');
    expect([position.getX(0), position.getY(0), position.getZ(0)]).toEqual([
      -36.570682525634766, 33.07946014404297, -39.84956741333008,
    ]);
    expect([color.getX(0), color.getY(0), color.getZ(0)]).toEqual([
      0.9634907245635986, 0.9634907245635986, 0.9634907245635986,
    ]);
    expect([position.getX(1199), position.getY(1199), position.getZ(1199)]).toEqual([
      -42.426448822021484, -39.72283935546875, -9.103534698486328,
    ]);
    expect(color.getX(1199)).toBe(0.7416720986366272);
  });
});

describe('starfield drift', () => {
  it('drifts around y at the pinned slow rate and leaves the other axes alone', () => {
    const starfield = createStarfield(seededRandom(4));

    expect(starfield.points.rotation.y).toBe(0);

    starfield.update(1000);
    expect(starfield.points.rotation.y).toBe(0.0152587890625);

    starfield.update(1000);
    expect(starfield.points.rotation.y).toBe(0.030517578125);

    starfield.update(0);
    expect(starfield.points.rotation.y).toBe(0.030517578125);

    // Slow: one minute of drift is under one radian (a full turn takes ~6.9 minutes).
    starfield.update(58_000);
    expect(starfield.points.rotation.y).toBe(0.91552734375);

    expect(starfield.points.rotation.x).toBe(0);
    expect(starfield.points.rotation.z).toBe(0);
  });

  it('never rebuilds the starfield, its geometry or its star positions', () => {
    const starfield = createStarfield(seededRandom(5));
    const points = starfield.points;
    const geometry = starfield.points.geometry;
    const position = geometry.getAttribute('position');
    const before = Float32Array.from(position.array as Float32Array);

    starfield.update(16);
    starfield.update(16, 0.5);
    starfield.update(16, 1);

    expect(starfield.points).toBe(points);
    expect(starfield.points.geometry).toBe(geometry);
    expect(starfield.points.geometry.getAttribute('position')).toBe(position);
    expect(Array.from(position.array as Float32Array)).toEqual(Array.from(before));
  });
});

describe('travel expansion', () => {
  it('scales the star disk uniformly in the view plane, leaving z at 1', () => {
    const starfield = createStarfield(seededRandom(6));

    expect(starfield.points.scale.toArray()).toEqual([1, 1, 1]);

    starfield.update(16, 0);
    expect(starfield.points.scale.toArray()).toEqual([1, 1, 1]);

    // 1 + 7 * easeInOutQuad(p): 0.25 → 1.875, 0.5 → 4.5, 0.75 → 7.125, 1 → 8.
    starfield.update(16, 0.25);
    expect(starfield.points.scale.toArray()).toEqual([1.875, 1.875, 1]);

    starfield.update(16, 0.5);
    expect(starfield.points.scale.toArray()).toEqual([4.5, 4.5, 1]);

    starfield.update(16, 0.75);
    expect(starfield.points.scale.toArray()).toEqual([7.125, 7.125, 1]);

    starfield.update(16, 1);
    expect(starfield.points.scale.toArray()).toEqual([8, 8, 1]);
  });

  it('clamps the travel input at both ends', () => {
    const starfield = createStarfield(seededRandom(10));

    starfield.update(16, 2);
    expect(starfield.points.scale.toArray()).toEqual([8, 8, 1]);

    starfield.update(16, 5);
    expect(starfield.points.scale.toArray()).toEqual([8, 8, 1]);

    starfield.update(16, -1);
    expect(starfield.points.scale.toArray()).toEqual([1, 1, 1]);

    starfield.update(16, -0.5);
    expect(starfield.points.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('keeps the last expansion when the frame advance omits the travel progress', () => {
    const starfield = createStarfield(seededRandom(7));

    starfield.update(16, 0.25);
    expect(starfield.points.scale.toArray()).toEqual([1.875, 1.875, 1]);

    starfield.update(16);
    expect(starfield.points.scale.toArray()).toEqual([1.875, 1.875, 1]);

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
