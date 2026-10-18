import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Group,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';
import { describe, expect, it, vi } from 'vitest';

import { createBurst, EXPLOSION_PARTICLE_COUNT, PARTICLE_POOL_CAP, type Burst } from '../game/effects';
import { createParticleSystem, type ParticleSystem } from './particles';

/** Random source replaying the given draws in order (cycling) — fully reproducible. */
function sequenceRandom(draws: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = draws[index % draws.length];
    index += 1;
    return value;
  };
}

/** Deterministic LCG (same seed → same stream); mirrors the other render tests. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Random source counting its draws (used to pin how many draws the pool consumes). */
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

/** Jitter draw producing exactly zero offset — a burst whose fragments sit on the origin. */
const noJitter = (): number => 0.5;

/** A `count`-fragment burst moving along `+x` at `speed` world units per second. */
function makeBurst(count: number, lifetimeMs: number, speed = 0): Burst {
  return {
    particles: Array.from({ length: count }, () => ({ dx: 1, dy: 0, dz: 0, speed, size: 0.02 })),
    lifetimeMs,
  };
}

/** `count` repetitions of one origin triple — the exact buffer a jitter-free burst writes. */
function originTriples(origin: readonly [number, number, number], count: number): number[] {
  return Array.from({ length: count }, () => [origin[0], origin[1], origin[2]]).flat();
}

/** The system's single `Points` drawable (the plan's contract exposes the group only). */
function pointsOf(system: ParticleSystem): Points<BufferGeometry, PointsMaterial> {
  return system.group.children[0] as Points<BufferGeometry, PointsMaterial>;
}

/** The live position buffer of the pool. */
function positionsOf(system: ParticleSystem): Float32Array {
  return pointsOf(system).geometry.getAttribute('position').array as Float32Array;
}

/** The live per-fragment colour buffer of the pool. */
function colorsOf(system: ParticleSystem): Float32Array {
  return pointsOf(system).geometry.getAttribute('color').array as Float32Array;
}

describe('createParticleSystem', () => {
  it('rejects a cap that is not a positive integer', () => {
    expect(() => createParticleSystem(noJitter, 0)).toThrowError(
      'particle pool cap must be a positive integer, received 0',
    );
    expect(() => createParticleSystem(noJitter, 2.5)).toThrowError(
      'particle pool cap must be a positive integer, received 2.5',
    );
    expect(() => createParticleSystem(noJitter, -3)).toThrowError(
      'particle pool cap must be a positive integer, received -3',
    );
  });

  it('builds one Points drawable with a PARTICLE_POOL_CAP-slot buffer and nothing drawn', () => {
    const system = createParticleSystem(noJitter);
    const points = pointsOf(system);
    const position = points.geometry.getAttribute('position');
    const color = points.geometry.getAttribute('color');

    expect(system.group).toBeInstanceOf(Group);
    expect(system.group.children).toHaveLength(1);
    expect(points).toBeInstanceOf(Points);
    expect(points.geometry).toBeInstanceOf(BufferGeometry);
    expect(points.material).toBeInstanceOf(PointsMaterial);

    expect(position.count).toBe(PARTICLE_POOL_CAP);
    expect(position.count).toBe(72);
    expect(position.itemSize).toBe(3);
    expect((position.array as Float32Array).length).toBe(216);
    expect((position as BufferAttribute).usage).toBe(DynamicDrawUsage);
    expect(color.count).toBe(72);
    expect(color.itemSize).toBe(3);
    expect((color as BufferAttribute).usage).toBe(DynamicDrawUsage);

    expect(points.geometry.drawRange).toEqual({ start: 0, count: 0 });
    expect(Array.from(positionsOf(system))).toEqual(new Array(216).fill(0));
    expect(system.activeCount()).toBe(0);
  });

  it('pins the additive point material the pool draws with', () => {
    const material = pointsOf(createParticleSystem(noJitter)).material;

    expect(material.size).toBe(0.15);
    expect(material.sizeAttenuation).toBe(true);
    expect(material.vertexColors).toBe(true);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.blending).toBe(AdditiveBlending);
    expect(pointsOf(createParticleSystem(noJitter)).frustumCulled).toBe(false);
  });
});

describe('spawn', () => {
  it('activates exactly burst.particles.length particles at the origin offsets', () => {
    const system = createParticleSystem(noJitter);
    const burst = makeBurst(3, 350);

    system.spawn(burst, new Vector3(1.5, -2, 0.25), 0);

    expect(system.activeCount()).toBe(burst.particles.length);
    expect(system.activeCount()).toBe(3);
    expect(pointsOf(system).geometry.drawRange).toEqual({ start: 0, count: 3 });
    expect(Array.from(positionsOf(system).slice(0, 9))).toEqual([
      1.5, -2, 0.25, 1.5, -2, 0.25, 1.5, -2, 0.25,
    ]);
    expect(Array.from(colorsOf(system).slice(0, 9))).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1]);
    // Everything past the active slice stays zeroed (no stale fragment is left behind).
    expect(Array.from(positionsOf(system).slice(9))).toEqual(new Array(207).fill(0));
  });

  it('offsets each particle by its own jitter draws, in x → y → z order', () => {
    // Jitter is (draw - 0.5) * 2 * 0.0625: 1 → +0.0625, 0.5 → 0, 0 → -0.0625.
    const system = createParticleSystem(sequenceRandom([1, 0.5, 0, 0, 0.5, 1, 1, 0.5, 0]));

    system.spawn(makeBurst(3, 350), new Vector3(0, 0, 0), 0);

    expect(Array.from(positionsOf(system).slice(0, 9))).toEqual([
      0.0625, 0, -0.0625,
      -0.0625, 0, 0.0625,
      0.0625, 0, -0.0625,
    ]);
  });

  it('consumes exactly three jitter draws per played particle', () => {
    const source = countingRandom(noJitter);
    const system = createParticleSystem(source.random);

    system.spawn(makeBurst(4, 350), new Vector3(0, 0, 0), 0);
    expect(source.calls()).toBe(12);
    expect(source.calls()).toBe(4 * 3);

    system.spawn(makeBurst(2, 350), new Vector3(0, 0, 0), 16);
    expect(source.calls()).toBe(18);
    expect(system.activeCount()).toBe(6);
  });

  it('copies the origin instead of retaining the caller’s Vector3', () => {
    const system = createParticleSystem(noJitter);
    const origin = new Vector3(1, 2, 3);

    system.spawn(makeBurst(2, 350), origin, 0);
    origin.set(-9, -9, -9);
    system.update(0);

    expect(Array.from(positionsOf(system).slice(0, 6))).toEqual([1, 2, 3, 1, 2, 3]);
  });

  it('plays a real EXPLOSION_PARTICLE_COUNT burst and releases it after its lifetime', () => {
    const system = createParticleSystem(noJitter);
    const burst = createBurst(seededRandom(7));

    system.spawn(burst, new Vector3(0, 0, 0), 0);

    expect(burst.lifetimeMs).toBe(350);
    expect(system.activeCount()).toBe(burst.particles.length);
    expect(system.activeCount()).toBe(EXPLOSION_PARTICLE_COUNT);
    expect(system.activeCount()).toBe(24);
    expect(Array.from(positionsOf(system).slice(0, 6))).toEqual([0, 0, 0, 0, 0, 0]);

    system.update(349);
    expect(system.activeCount()).toBe(24);

    system.update(1);
    expect(system.activeCount()).toBe(0);
    expect(pointsOf(system).geometry.drawRange).toEqual({ start: 0, count: 0 });
    expect(Array.from(positionsOf(system).slice(0, 6))).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('ignores an empty burst and a burst with a non-positive lifetime', () => {
    const system = createParticleSystem(noJitter);

    system.spawn(makeBurst(0, 350), new Vector3(1, 0, 0), 0);
    expect(system.activeCount()).toBe(0);

    system.spawn(makeBurst(24, 0), new Vector3(1, 0, 0), 0);
    expect(system.activeCount()).toBe(0);

    system.spawn(makeBurst(24, -10), new Vector3(1, 0, 0), 0);
    expect(system.activeCount()).toBe(0);

    expect(pointsOf(system).geometry.drawRange).toEqual({ start: 0, count: 0 });
    expect(Array.from(positionsOf(system))).toEqual(new Array(216).fill(0));
  });

  it('truncates a burst that is larger than the cap', () => {
    const system = createParticleSystem(noJitter, 4);

    system.spawn(makeBurst(6, 350), new Vector3(1, 0, 0), 0);

    expect(system.activeCount()).toBe(4);
    expect(pointsOf(system).geometry.drawRange).toEqual({ start: 0, count: 4 });
    expect(Array.from(positionsOf(system).slice(0, 12))).toEqual([
      1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    ]);
  });
});

describe('recycling at the cap', () => {
  it('recycles the oldest burst when a 4th 24-particle burst is spawned', () => {
    const system = createParticleSystem(noJitter);
    const [first, second, third, fourth] = [
      new Vector3(1, 0, 0),
      new Vector3(2, 0, 0),
      new Vector3(3, 0, 0),
      new Vector3(4, 0, 0),
    ];

    system.spawn(makeBurst(24, 350), first, 0);
    system.spawn(makeBurst(24, 350), second, 10);
    system.spawn(makeBurst(24, 350), third, 20);
    expect(system.activeCount()).toBe(PARTICLE_POOL_CAP);
    expect(system.activeCount()).toBe(72);

    system.spawn(makeBurst(24, 350), fourth, 30);

    expect(system.activeCount()).toBe(72);
    expect(pointsOf(system).geometry.drawRange).toEqual({ start: 0, count: 72 });
    // The first burst's particles are gone; the second, third and fourth bursts remain.
    expect(Array.from(positionsOf(system))).toEqual([
      ...originTriples([2, 0, 0], 24),
      ...originTriples([3, 0, 0], 24),
      ...originTriples([4, 0, 0], 24),
    ]);
  });

  it('recycles by spawn time rather than by insertion order', () => {
    const system = createParticleSystem(noJitter);

    system.spawn(makeBurst(24, 350), new Vector3(1, 0, 0), 100);
    system.spawn(makeBurst(24, 350), new Vector3(2, 0, 0), 50);
    system.spawn(makeBurst(24, 350), new Vector3(3, 0, 0), 200);
    system.spawn(makeBurst(24, 350), new Vector3(4, 0, 0), 300);

    expect(system.activeCount()).toBe(72);
    // The burst spawned at t=50 (inserted second) is the earliest, so it is the one recycled.
    expect(Array.from(positionsOf(system))).toEqual([
      ...originTriples([1, 0, 0], 24),
      ...originTriples([3, 0, 0], 24),
      ...originTriples([4, 0, 0], 24),
    ]);
  });

  it('releases each concurrent burst on its own lifetime', () => {
    const system = createParticleSystem(noJitter, 48);

    system.spawn(makeBurst(24, 350), new Vector3(1, 0, 0), 0);
    system.spawn(makeBurst(24, 100), new Vector3(2, 0, 0), 0);
    expect(system.activeCount()).toBe(48);

    system.update(100);
    expect(system.activeCount()).toBe(24);
    expect(Array.from(positionsOf(system).slice(0, 3))).toEqual([1, 0, 0]);
    expect(Array.from(positionsOf(system).slice(72))).toEqual(new Array(72).fill(0));

    system.update(250);
    expect(system.activeCount()).toBe(0);
  });
});

describe('update', () => {
  it('moves fragments at their speed in world units per second, each frame', () => {
    const system = createParticleSystem(noJitter);
    const burst: Burst = {
      particles: [
        { dx: 1, dy: 0, dz: 0, speed: 2, size: 0.02 },
        { dx: 0, dy: 1, dz: 0, speed: 1, size: 0.02 },
      ],
      lifetimeMs: 1000,
    };

    system.spawn(burst, new Vector3(0, 0, 0), 0);
    expect(Array.from(positionsOf(system).slice(0, 6))).toEqual([0, 0, 0, 0, 0, 0]);

    system.update(500);
    expect(Array.from(positionsOf(system).slice(0, 6))).toEqual([1, 0, 0, 0, 0.5, 0]);

    system.update(250);
    expect(Array.from(positionsOf(system).slice(0, 6))).toEqual([1.5, 0, 0, 0, 0.75, 0]);

    system.update(250);
    expect(system.activeCount()).toBe(0);
    expect(Array.from(positionsOf(system).slice(0, 6))).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('fades the fragments linearly to zero across the lifetime', () => {
    const system = createParticleSystem(noJitter);

    system.spawn(makeBurst(1, 1000), new Vector3(0, 0, 0), 0);
    expect(Array.from(colorsOf(system).slice(0, 3))).toEqual([1, 1, 1]);

    system.update(250);
    expect(Array.from(colorsOf(system).slice(0, 3))).toEqual([0.75, 0.75, 0.75]);

    system.update(250);
    expect(Array.from(colorsOf(system).slice(0, 3))).toEqual([0.5, 0.5, 0.5]);
  });

  it('releases exactly at the lifetime boundary', () => {
    const system = createParticleSystem(noJitter);
    system.spawn(makeBurst(24, 350), new Vector3(1, 0, 0), 0);

    system.update(350);

    expect(system.activeCount()).toBe(0);
    expect(pointsOf(system).geometry.drawRange).toEqual({ start: 0, count: 0 });
  });

  it('ages nothing for a non-positive advance', () => {
    const system = createParticleSystem(noJitter);
    system.spawn(makeBurst(1, 500, 2), new Vector3(0, 0, 0), 0);

    system.update(0);
    expect(positionsOf(system)[0]).toBe(0);
    system.update(-50);
    expect(positionsOf(system)[0]).toBe(0);
    expect(system.activeCount()).toBe(1);

    system.update(500);
    expect(system.activeCount()).toBe(0);
  });
});

describe('dispose', () => {
  it('disposes the geometry and material exactly once and replaces them with no-ops', () => {
    const system = createParticleSystem(noJitter);
    const points = pointsOf(system);
    const geometryDispose = vi.spyOn(points.geometry, 'dispose');
    const materialDispose = vi.spyOn(points.material, 'dispose');

    system.spawn(makeBurst(24, 350), new Vector3(1, 0, 0), 0);
    expect(system.activeCount()).toBe(24);

    system.dispose();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).toHaveBeenCalledWith();
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledWith();
    expect(system.group.children).toEqual([]);
    expect(system.activeCount()).toBe(0);
    expect(points.geometry.drawRange).toEqual({ start: 0, count: 0 });

    // Idempotent, and the pool stays inert afterwards.
    system.dispose();
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);

    system.spawn(makeBurst(24, 350), new Vector3(1, 0, 0), 100);
    expect(system.activeCount()).toBe(0);
    system.update(1000);
    expect(system.activeCount()).toBe(0);
  });
});

describe('bounded resources', () => {
  it('reuses the same drawable and buffers across 10 spawn/release cycles', () => {
    const system = createParticleSystem(noJitter);
    const points = pointsOf(system);
    const geometry = points.geometry;
    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    const baseline = Array.from(positionsOf(system));

    for (let cycle = 0; cycle < 10; cycle += 1) {
      system.spawn(makeBurst(24, 350), new Vector3(1, 0, 0), cycle * 100);

      expect(system.group.children).toHaveLength(1);
      expect(system.group.children[0]).toBe(points);
      expect(system.activeCount()).toBe(24);

      system.update(350);
      expect(system.activeCount()).toBe(0);
    }

    expect(system.group.children).toHaveLength(1);
    expect(pointsOf(system)).toBe(points);
    expect(geometry.getAttribute('position')).toBe(position);
    expect(geometry.getAttribute('color')).toBe(color);
    expect((position.array as Float32Array).length).toBe(PARTICLE_POOL_CAP * 3);
    expect(Array.from(positionsOf(system))).toEqual(baseline);
  });
});
