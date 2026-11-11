import { BoxGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';

import * as impactEffectsModule from './impact-effects';
import { createImpactEffects, type ImpactEffects } from './impact-effects';

const fixedRandom = (): number => 0.5;

function createEffects(): ImpactEffects {
  return createImpactEffects(fixedRandom);
}

function shardMesh(effects: ImpactEffects): InstancedMesh {
  const [child] = effects.group.children;
  if (!(child instanceof InstancedMesh)) {
    throw new Error('no impact-shards mesh');
  }
  return child;
}

function instancePosition(mesh: InstancedMesh, index: number): Vector3 {
  const matrix = new Matrix4();
  mesh.getMatrixAt(index, matrix);
  return new Vector3().setFromMatrixPosition(matrix);
}

describe('impact module contract (AC-1)', () => {
  it('exposes exactly the three runtime exports', () => {
    expect(Object.keys(impactEffectsModule).sort()).toEqual([
      'DEBRIS_PER_POP',
      'DEBRIS_POOL_CAP',
      'createImpactEffects',
    ]);
    expect(impactEffectsModule.DEBRIS_POOL_CAP).toBe(42);
    expect(impactEffectsModule.DEBRIS_PER_POP).toBe(14);
  });

  it('builds exactly one green shard drawable named impact-shards', () => {
    const effects = createEffects();

    expect(effects.group.name).toBe('impact-effects');
    expect(effects.group.children).toHaveLength(1);
    expect(effects.group.children.map((child) => child.name)).toEqual(['impact-shards']);
    expect(effects.group.children.map((child) => child.name)).not.toContain('impact-rays');
    expect(effects.group.children.map((child) => child.name)).not.toContain('impact-coins');
    expect(effects.group.children.map((child) => child.name)).not.toContain('impact-ring');

    const mesh = shardMesh(effects);
    expect(mesh.instanceMatrix.count).toBe(42);
    expect(mesh.count).toBe(0);
    expect(mesh.frustumCulled).toBe(false);

    expect(mesh.geometry).toBeInstanceOf(BoxGeometry);
    expect(mesh.geometry.type).toBe('BoxGeometry');
    const parameters = (mesh.geometry as BoxGeometry).parameters;
    expect(parameters.width).toBe(0.09);
    expect(parameters.height).toBe(0.09);
    expect(parameters.depth).toBe(0.09);

    expect(mesh.material).toBeInstanceOf(MeshStandardMaterial);
    const material = mesh.material as MeshStandardMaterial;
    expect(material.color.getHex()).toBe(0x44cc88);
    expect(material.metalness).toBe(0.2);
    expect(material.roughness).toBe(0.5);
  });
});

describe('shard pops (AC-1)', () => {
  it('spawns exactly 14 shards per default pop at the +0.02 tile surface', () => {
    const effects = createEffects();
    effects.spawnPop(new Vector3(1, 2, 3), new Vector3(0, 0, 1), 0);

    expect(effects.activeCounts()).toEqual({ shards: 14 });
    expect(shardMesh(effects).count).toBe(14);
    // The fixed random source falls back to the +z direction, so the first shard sits
    // 0.02 along the surface normal plus 0.05 along its own direction: (1, 2, 3.07).
    // The instance matrix stores Float32 values, so the z read-back is the one value in
    // this task that cannot be asserted as an exact double (the x/y components are exact).
    const position = instancePosition(shardMesh(effects), 0);
    expect([position.x, position.y]).toEqual([1, 2]);
    expect(position.z).toBeCloseTo(3.07, 5);
  });

  it('clamps the shard count into [0, 14]', () => {
    const capped = createEffects();
    capped.setFeatures({ shards: 999 });
    capped.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    expect(capped.activeCounts()).toEqual({ shards: 14 });

    const floored = createEffects();
    floored.setFeatures({ shards: -3 });
    floored.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    expect(floored.activeCounts()).toEqual({ shards: 0 });

    const nonFinite = createEffects();
    nonFinite.setFeatures({ shards: Number.NaN });
    nonFinite.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    expect(nonFinite.activeCounts()).toEqual({ shards: 0 });

    const fractional = createEffects();
    fractional.setFeatures({ shards: 7.9 });
    fractional.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    expect(fractional.activeCounts()).toEqual({ shards: 7 });
  });

  it('releases every shard exactly at the 1200 ms lifetime', () => {
    const effects = createEffects();
    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);

    effects.update(1199);
    expect(effects.activeCounts()).toEqual({ shards: 14 });
    expect(shardMesh(effects).count).toBe(14);

    effects.update(1);
    expect(effects.activeCounts()).toEqual({ shards: 0 });
    expect(shardMesh(effects).count).toBe(0);
  });

  it('recycles the oldest shard first at the 42 cap', () => {
    const effects = createEffects();
    effects.spawnPop(new Vector3(1, 0, 0), new Vector3(0, 0, 1), 0);
    effects.spawnPop(new Vector3(2, 0, 0), new Vector3(0, 0, 1), 10);
    effects.spawnPop(new Vector3(3, 0, 0), new Vector3(0, 0, 1), 20);
    effects.spawnPop(new Vector3(4, 0, 0), new Vector3(0, 0, 1), 30);

    expect(effects.activeCounts()).toEqual({ shards: 42 });
    expect(shardMesh(effects).count).toBe(42);
    // The first pop's 14 shards were recycled, so instance 0 belongs to the second pop.
    expect(instancePosition(shardMesh(effects), 0).x).toBe(2);
  });
});

describe('dispose', () => {
  it('releases the one geometry and material exactly once and is idempotent', () => {
    const effects = createEffects();
    const mesh = shardMesh(effects);
    const geometryDispose = vi.spyOn(mesh.geometry, 'dispose');
    const materialDispose = vi.spyOn(mesh.material as { dispose: () => void }, 'dispose');

    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    effects.dispose();
    effects.dispose();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(effects.group.children).toEqual([]);
    expect(effects.activeCounts()).toEqual({ shards: 0 });

    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 100);
    effects.update(1000);
    expect(effects.activeCounts()).toEqual({ shards: 0 });
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
  });
});
