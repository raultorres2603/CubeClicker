import { InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { MOTION } from '../game/motion';
import {
  COIN_POOL_CAP,
  COINS_PER_POP,
  createImpactEffects,
  DEBRIS_PER_POP,
  DEBRIS_POOL_CAP,
  RAY_LENGTH_MAX,
  RAY_LENGTH_MIN,
  RAY_POOL_CAP,
  RAYS_PER_POP,
  REDUCED_RING_FLASH_MS,
  RING_POOL_CAP,
  type ImpactEffects,
} from './impact-effects';

const fixedRandom = (): number => 0.5;

function createEffects(): ImpactEffects {
  return createImpactEffects(fixedRandom);
}

function meshNamed(effects: ImpactEffects, name: string): InstancedMesh {
  const mesh = effects.group.children.find(
    (child): child is InstancedMesh => child instanceof InstancedMesh && child.name === name,
  );
  if (mesh === undefined) {
    throw new Error(`no ${name} pool`);
  }
  return mesh;
}

function instanceMatrix(mesh: InstancedMesh, index: number): Matrix4 {
  const matrix = new Matrix4();
  mesh.getMatrixAt(index, matrix);
  return matrix;
}

describe('impact pools (AC-37/AC-38)', () => {
  it('pins the pool capacities and per-pop counts', () => {
    expect(RAY_POOL_CAP).toBe(3);
    expect(RAYS_PER_POP).toBe(12);
    expect(DEBRIS_POOL_CAP).toBe(42);
    expect(DEBRIS_PER_POP).toBe(14);
    expect(COIN_POOL_CAP).toBe(18);
    expect(COINS_PER_POP).toBe(6);
    expect(RING_POOL_CAP).toBe(3);
    expect(RAY_LENGTH_MAX / RAY_LENGTH_MIN).toBeCloseTo(160 / 90, 6);
  });

  it('builds exactly four InstancedMesh drawables under the group', () => {
    const effects = createEffects();

    expect(effects.group.name).toBe('impact-effects');
    expect(effects.group.children).toHaveLength(4);
    expect(effects.group.children.map((child) => child.name)).toEqual([
      'impact-rays',
      'impact-shards',
      'impact-coins',
      'impact-ring',
    ]);
    expect(meshNamed(effects, 'impact-rays').instanceMatrix.count).toBe(36);
    expect(meshNamed(effects, 'impact-shards').instanceMatrix.count).toBe(42);
    expect(meshNamed(effects, 'impact-coins').instanceMatrix.count).toBe(18);
    expect(meshNamed(effects, 'impact-ring').instanceMatrix.count).toBe(3);
    for (const mesh of effects.group.children as InstancedMesh[]) {
      expect(mesh.count).toBe(0);
    }
  });

  it('bakes the 32-segment ring, eight spokes and four satellites into one geometry', () => {
    const effects = createEffects();
    const ring = meshNamed(effects, 'impact-ring');
    const positions = ring.geometry.getAttribute('position');

    // 66 ring vertices + 8 × 24 box vertices + 4 × 34 satellite-ring vertices.
    expect(positions.count).toBe(394);
    expect(positions.count).toBe(66 + 8 * 24 + 4 * 34);
  });

  it('spawns 12 rays, 14 shards, 6 coins and one ring per pop', () => {
    const effects = createEffects();
    effects.spawnPop(new Vector3(1, 2, 3), new Vector3(0, 0, 1), 0);

    expect(effects.activeCounts()).toEqual({ rays: 12, shards: 14, coins: 6, rings: 1 });
    expect(meshNamed(effects, 'impact-rays').count).toBe(12);
    expect(meshNamed(effects, 'impact-shards').count).toBe(14);
    expect(meshNamed(effects, 'impact-coins').count).toBe(6);
    expect(meshNamed(effects, 'impact-ring').count).toBe(1);
  });

  it('starts every pool at the tile surface (+0.02 along the outward normal)', () => {
    const effects = createEffects();
    effects.spawnPop(new Vector3(1, 2, 3), new Vector3(0, 0, 1), 0);

    const ringMatrix = instanceMatrix(meshNamed(effects, 'impact-ring'), 0);
    const ringOrigin = new Vector3().setFromMatrixPosition(ringMatrix);
    expect(ringOrigin.x).toBeCloseTo(1, 6);
    expect(ringOrigin.y).toBeCloseTo(2, 6);
    expect(ringOrigin.z).toBeCloseTo(3.02, 6);
    const rayMatrix = instanceMatrix(meshNamed(effects, 'impact-rays'), 0);
    const rayOrigin = new Vector3().setFromMatrixPosition(rayMatrix);
    expect(rayOrigin.x).toBeCloseTo(1, 6);
    expect(rayOrigin.y).toBeCloseTo(2, 6);
    expect(rayOrigin.z).toBeCloseTo(3.02, 6);
  });

  it('orients the ring so +z aligns with the face normal', () => {
    const effects = createEffects();
    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(1, 0, 0), 0);

    const matrix = instanceMatrix(meshNamed(effects, 'impact-ring'), 0);
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    matrix.decompose(position, quaternion, scale);
    const localNormal = new Vector3(0, 0, 1).applyQuaternion(quaternion);
    expect(localNormal.x).toBeCloseTo(1, 6);
    expect(localNormal.y).toBeCloseTo(0, 6);
    expect(localNormal.z).toBeCloseTo(0, 6);
  });

  it('grows the ring 1 → 5 over 330 ms and fades it out', () => {
    const effects = createEffects();
    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    const ring = meshNamed(effects, 'impact-ring');

    const initialScale = new Vector3().setFromMatrixScale(instanceMatrix(ring, 0));
    expect(initialScale.x).toBeCloseTo(1, 6);

    effects.update(330);
    const peakScale = new Vector3().setFromMatrixScale(instanceMatrix(ring, 0));
    expect(peakScale.x).toBeCloseTo(MOTION.shockwaveMaxScale, 6);
    expect(effects.activeCounts().rings).toBe(1);

    effects.update(MOTION.shockwaveFadeMs);
    expect(effects.activeCounts().rings).toBe(0);
  });

  it('alternates the 90/160 px-equivalent ray lengths', () => {
    const effects = createEffects();
    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    const rays = meshNamed(effects, 'impact-rays');
    effects.update(MOTION.rayGrowMs);

    const first = new Vector3().setFromMatrixScale(instanceMatrix(rays, 0));
    const second = new Vector3().setFromMatrixScale(instanceMatrix(rays, 1));
    expect(first.z).toBeCloseTo(RAY_LENGTH_MIN, 5);
    expect(second.z).toBeCloseTo(RAY_LENGTH_MAX, 5);
  });

  it('releases each pool exactly at its pinned lifetime', () => {
    const effects = createEffects();
    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);

    effects.update(MOTION.rayTotalMs - 1);
    expect(effects.activeCounts()).toEqual({ rays: 12, shards: 14, coins: 6, rings: 1 });

    effects.update(1);
    expect(effects.activeCounts()).toEqual({ rays: 0, shards: 14, coins: 6, rings: 1 });

    effects.update(MOTION.shockwaveVisibleMs - MOTION.rayTotalMs);
    expect(effects.activeCounts()).toEqual({ rays: 0, shards: 14, coins: 6, rings: 0 });

    effects.update(MOTION.coinLifetimeMs - MOTION.shockwaveVisibleMs);
    expect(effects.activeCounts()).toEqual({ rays: 0, shards: 14, coins: 0, rings: 0 });

    effects.update(MOTION.debrisLifetimeMs - MOTION.coinLifetimeMs);
    expect(effects.activeCounts()).toEqual({ rays: 0, shards: 0, coins: 0, rings: 0 });
  });
});

describe('recycling and quality limits', () => {
  it('recycles the oldest entries first at every pool cap', () => {
    const effects = createEffects();
    effects.setFeatures({ rays: 12, shards: 14, coins: 6, shockwaveExpand: true });
    effects.spawnPop(new Vector3(1, 0, 0), new Vector3(0, 0, 1), 0);
    effects.spawnPop(new Vector3(2, 0, 0), new Vector3(0, 0, 1), 10);
    effects.spawnPop(new Vector3(3, 0, 0), new Vector3(0, 0, 1), 20);
    effects.spawnPop(new Vector3(4, 0, 0), new Vector3(0, 0, 1), 30);

    expect(effects.activeCounts()).toEqual({ rays: 36, shards: 42, coins: 18, rings: 3 });
    const rays = meshNamed(effects, 'impact-rays');
    const firstRayOrigin = new Vector3().setFromMatrixPosition(instanceMatrix(rays, 0));
    expect(firstRayOrigin.x).toBeCloseTo(2, 6);
    expect(effects.group.children).toHaveLength(4);
  });

  it('medium quality plays 6 rays, 7 shards and 3 coins', () => {
    const effects = createEffects();
    effects.setFeatures({ rays: 6, shards: 7, coins: 3, shockwaveExpand: true });
    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);

    expect(effects.activeCounts()).toEqual({ rays: 6, shards: 7, coins: 3, rings: 1 });
  });

  it('low quality keeps only the ring shockwave', () => {
    const effects = createEffects();
    effects.setFeatures({ rays: 0, shards: 0, coins: 0, shockwaveExpand: true });
    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);

    expect(effects.activeCounts()).toEqual({ rays: 0, shards: 0, coins: 0, rings: 1 });
    expect(meshNamed(effects, 'impact-ring').count).toBe(1);
  });

  it('reduced motion plays a static final-scale ring flash for 120 ms', () => {
    const effects = createEffects();
    effects.setFeatures({ rays: 0, shards: 0, coins: 0, shockwaveExpand: false });
    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    const ring = meshNamed(effects, 'impact-ring');

    expect(effects.activeCounts()).toEqual({ rays: 0, shards: 0, coins: 0, rings: 1 });
    const scale = new Vector3().setFromMatrixScale(instanceMatrix(ring, 0));
    expect(scale.x).toBeCloseTo(MOTION.shockwaveMaxScale, 6);

    effects.update(REDUCED_RING_FLASH_MS / 2);
    expect(effects.activeCounts().rings).toBe(1);
    const colors = ring.instanceColor!;
    expect(colors.getX(0)).toBeCloseTo(0.5, 6);

    effects.update(REDUCED_RING_FLASH_MS / 2);
    expect(effects.activeCounts().rings).toBe(0);
  });

  it('clamps invalid feature counts into the pool capacities', () => {
    const effects = createEffects();
    effects.setFeatures({ rays: -3, shards: 999, coins: Number.NaN, shockwaveExpand: true });
    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);

    // Clamped to the per-pop maxima (12/14/6), not the whole-pool capacities.
    expect(effects.activeCounts()).toEqual({ rays: 0, shards: 14, coins: 0, rings: 1 });
  });
});

describe('dispose', () => {
  it('releases the four geometries and materials exactly once and empties the group', () => {
    const effects = createEffects();
    const meshes = effects.group.children as InstancedMesh[];
    const disposals = meshes.flatMap((mesh) => [
      vi.spyOn(mesh.geometry, 'dispose'),
      vi.spyOn(mesh.material as { dispose: () => void }, 'dispose'),
    ]);

    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    effects.dispose();
    effects.dispose();

    for (const spy of disposals) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
    expect(effects.group.children).toEqual([]);
    expect(effects.activeCounts()).toEqual({ rays: 0, shards: 0, coins: 0, rings: 0 });

    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 100);
    effects.update(1000);
    expect(effects.activeCounts()).toEqual({ rays: 0, shards: 0, coins: 0, rings: 0 });
  });
});
