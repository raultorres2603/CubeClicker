import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  Points,
  PointsMaterial,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { describe, expect, it, vi } from 'vitest';

import * as impactEffectsModule from './impact-effects';
import {
  createImpactEffects,
  DEBRIS_PER_POP,
  DEBRIS_POOL_CAP,
  IMPACT_BURST_POOL_CAP,
  IMPACT_EMBER_COLOR,
  IMPACT_EMBER_HOT_COLOR,
  IMPACT_FLASH_COLOR,
  IMPACT_FLASH_PEAK_SCALE,
  IMPACT_FLASH_POOL_CAP,
  IMPACT_FLASH_START_SCALE,
  IMPACT_SMOKE_BRIGHTNESS,
  IMPACT_SMOKE_COLOR,
  type ImpactEffects,
} from './impact-effects';

const fixedRandom = (): number => 0.5;

function createEffects(): ImpactEffects {
  return createImpactEffects(fixedRandom);
}

function childNamed(effects: ImpactEffects, name: string): Mesh | InstancedMesh | Points {
  const child = effects.group.children.find((candidate) => candidate.name === name);
  if (child === undefined) {
    throw new Error(`no ${name} impact pool`);
  }
  return child as Mesh | InstancedMesh | Points;
}

function shardMesh(effects: ImpactEffects): InstancedMesh {
  return childNamed(effects, 'impact-shards') as InstancedMesh;
}

function flashMesh(effects: ImpactEffects): InstancedMesh {
  return childNamed(effects, 'impact-flash') as InstancedMesh;
}

function burstPoints(effects: ImpactEffects): Points<BufferGeometry, PointsMaterial> {
  return childNamed(effects, 'impact-burst') as Points<BufferGeometry, PointsMaterial>;
}

function instanceMatrix(mesh: InstancedMesh, index: number): Matrix4 {
  const matrix = new Matrix4();
  mesh.getMatrixAt(index, matrix);
  return matrix;
}

function instancePosition(mesh: InstancedMesh, index: number): Vector3 {
  return new Vector3().setFromMatrixPosition(instanceMatrix(mesh, index));
}

/** The three scale factors of one instance: the length of each basis column. */
function instanceScale(mesh: InstancedMesh, index: number): number[] {
  const matrix = instanceMatrix(mesh, index);
  return [0, 1, 2].map((axis) => new Vector3().setFromMatrixColumn(matrix, axis).length());
}

function instanceColor(mesh: InstancedMesh, index: number): number[] {
  const color = mesh.instanceColor;
  if (color === null) {
    throw new Error('the impact-flash mesh has no instanceColor buffer');
  }
  return [color.getX(index), color.getY(index), color.getZ(index)];
}

function burstPosition(points: Points, index: number): number[] {
  const attribute = points.geometry.getAttribute('position');
  return [attribute.getX(index), attribute.getY(index), attribute.getZ(index)];
}

function burstColor(points: Points, index: number): number[] {
  const attribute = points.geometry.getAttribute('color');
  return [attribute.getX(index), attribute.getY(index), attribute.getZ(index)];
}

function activePositions(points: Points): Array<[number, number, number]> {
  const count = points.geometry.drawRange.count;
  return Array.from({ length: count }, (_, index) => burstPosition(points, index) as [number, number, number]);
}

function countObjects(root: Object3D): number {
  return 1 + root.children.reduce((total, child) => total + countObjects(child), 0);
}

describe('impact module contract (AC-3)', () => {
  it('exposes the three pool caps, the palette and the two pure constructors', () => {
    expect(Object.keys(impactEffectsModule).sort()).toEqual([
      'DEBRIS_PER_POP',
      'DEBRIS_POOL_CAP',
      'IMPACT_BURST_POOL_CAP',
      'IMPACT_EMBER_COLOR',
      'IMPACT_EMBER_HOT_COLOR',
      'IMPACT_FLASH_COLOR',
      'IMPACT_FLASH_PEAK_SCALE',
      'IMPACT_FLASH_POOL_CAP',
      'IMPACT_FLASH_START_SCALE',
      'IMPACT_SMOKE_BRIGHTNESS',
      'IMPACT_SMOKE_COLOR',
      'createImpactEffects',
    ]);
    expect(DEBRIS_POOL_CAP).toBe(42);
    expect(DEBRIS_PER_POP).toBe(14);
    expect(IMPACT_FLASH_POOL_CAP).toBe(6);
    expect(IMPACT_FLASH_COLOR).toBe(0xfff2dc);
    expect(IMPACT_FLASH_START_SCALE).toBe(0.18);
    expect(IMPACT_FLASH_PEAK_SCALE).toBe(0.55);
    expect(IMPACT_BURST_POOL_CAP).toBe(72);
    expect(IMPACT_EMBER_COLOR).toBe(0xff9a3c);
    expect(IMPACT_EMBER_HOT_COLOR).toBe(0xffe7c4);
    expect(IMPACT_SMOKE_COLOR).toBe(0x8a7f72);
    expect(IMPACT_SMOKE_BRIGHTNESS).toBe(0.45);
  });

  it('builds exactly the three pinned drawables in order, with no gold fan/coins/ring', () => {
    const effects = createEffects();

    expect(effects.group.name).toBe('impact-effects');
    expect(effects.group.children.map((child) => child.name)).toEqual([
      'impact-shards',
      'impact-flash',
      'impact-burst',
    ]);
    expect(effects.group.children).toHaveLength(3);
    const names = effects.group.children.map((child) => child.name);
    expect(names).not.toContain('impact-rays');
    expect(names).not.toContain('impact-coins');
    expect(names).not.toContain('impact-ring');
    expect(
      (effects.group.children as Array<Mesh | InstancedMesh | Points>).map(
        (child) => child.geometry.type,
      ),
    ).toEqual([
      'BoxGeometry',
      'OctahedronGeometry',
      'BufferGeometry',
    ]);
  });

  it('keeps the accepted green shard pool (42-cap 0.09 cube, standard material)', () => {
    const mesh = shardMesh(createEffects());

    expect(mesh.instanceMatrix.count).toBe(42);
    expect(mesh.count).toBe(0);
    expect(mesh.frustumCulled).toBe(false);
    expect(mesh.geometry).toBeInstanceOf(BoxGeometry);
    expect((mesh.geometry as BoxGeometry).parameters).toEqual({
      width: 0.09,
      height: 0.09,
      depth: 0.09,
      widthSegments: 1,
      heightSegments: 1,
      depthSegments: 1,
    });
    expect(mesh.material).toBeInstanceOf(MeshStandardMaterial);
    const material = mesh.material as MeshStandardMaterial;
    expect(material.color.getHex()).toBe(0x44cc88);
    expect(material.metalness).toBe(0.2);
    expect(material.roughness).toBe(0.5);
  });

  it('pins the 6-instance white-hot octahedron flash pool with a scalar instance colour', () => {
    const mesh = flashMesh(createEffects());
    const geometry = mesh.geometry as OctahedronGeometry;

    expect(mesh.instanceMatrix.count).toBe(6);
    expect(mesh.count).toBe(0);
    expect(mesh.frustumCulled).toBe(false);
    expect(mesh.renderOrder).toBe(10);
    expect(geometry).toBeInstanceOf(OctahedronGeometry);
    expect(geometry.parameters.radius).toBe(1);
    expect(geometry.parameters.detail).toBe(0);
    expect(geometry.getAttribute('position').count).toBe(24);
    expect(geometry.index).toBeNull();
    expect(geometry.getAttribute('position').count / 3).toBe(8);

    expect(mesh.material).toBeInstanceOf(MeshBasicMaterial);
    const material = mesh.material as MeshBasicMaterial;
    expect(material.color.getHex()).toBe(IMPACT_FLASH_COLOR);
    expect(material.transparent).toBe(true);
    expect(material.blending).toBe(AdditiveBlending);
    expect(material.depthWrite).toBe(false);
    expect(material.depthTest).toBe(false);
    expect(material.toneMapped).toBe(false);

    const instanceColor = mesh.instanceColor;
    expect(instanceColor).toBeInstanceOf(InstancedBufferAttribute);
    expect(instanceColor!.count).toBe(6);
    expect(instanceColor!.itemSize).toBe(3);
  });

  it('pins the 72-point additive burst pool with position + vertex colours', () => {
    const points = burstPoints(createEffects());
    const geometry = points.geometry;
    const material = points.material;

    expect(geometry).toBeInstanceOf(BufferGeometry);
    expect(geometry.getAttribute('position').count).toBe(72);
    expect(geometry.getAttribute('color').count).toBe(72);
    expect(geometry.drawRange).toEqual({ start: 0, count: 0 });
    expect(points.frustumCulled).toBe(false);
    expect(points.renderOrder).toBe(10);

    expect(material).toBeInstanceOf(PointsMaterial);
    expect(material.color.getHex()).toBe(0xffffff);
    expect(material.size).toBe(0.12);
    expect(material.sizeAttenuation).toBe(true);
    expect(material.vertexColors).toBe(true);
    expect(material.transparent).toBe(true);
    expect(material.blending).toBe(AdditiveBlending);
    expect(material.depthWrite).toBe(false);
    expect(material.depthTest).toBe(false);
    expect(material.toneMapped).toBe(false);
  });
});

describe('features (AC-3)', () => {
  it('defaults to 14 shards and an inert explosion until the scene wires the tier', () => {
    const effects = createEffects();

    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);

    expect(effects.activeCounts()).toEqual({ shards: 14, flash: 0, points: 0 });
    expect(shardMesh(effects).count).toBe(14);
    expect(flashMesh(effects).count).toBe(0);
    expect(burstPoints(effects).geometry.drawRange.count).toBe(0);
  });

  it('merges a partial patch and clamps every count into its pool cap', () => {
    const effects = createEffects();
    effects.setFeatures({ flash: 999, embers: 99, smoke: 99 });
    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    expect(effects.activeCounts()).toEqual({ shards: 14, flash: 6, points: 12 });

    const zeroed = createEffects();
    zeroed.setFeatures({
      shards: -3,
      flash: -1,
      embers: Number.NaN,
      smoke: Number.POSITIVE_INFINITY,
    });
    zeroed.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    expect(zeroed.activeCounts()).toEqual({ shards: 0, flash: 0, points: 0 });
  });

  it('keeps the untouched fields of an earlier patch and floors fractions', () => {
    const effects = createEffects();
    effects.setFeatures({ flash: 1, embers: 4, smoke: 2 });
    effects.setFeatures({ embers: 99, smoke: 2.9 });
    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);

    expect(effects.activeCounts()).toEqual({ shards: 14, flash: 1, points: 10 });
    expect(flashMesh(effects).count).toBe(1);
    expect(burstPoints(effects).geometry.drawRange.count).toBe(10);
  });
});

describe('white-hot flash (AC-3)', () => {
  it('spawns at the +0.02 tile surface at the 0.18 start scale and brightness 1', () => {
    const effects = createEffects();
    effects.setFeatures({ shards: 0, flash: 1 });

    effects.spawnPop(new Vector3(1, 2, 3), new Vector3(0, 0, 1), 0);

    const mesh = flashMesh(effects);
    expect(effects.activeCounts()).toEqual({ shards: 0, flash: 1, points: 0 });
    expect(mesh.count).toBe(1);
    const position = instancePosition(mesh, 0);
    expect([position.x, position.y]).toEqual([1, 2]);
    expect(position.z).toBe(3.0199999809265137);
    expect(instanceScale(mesh, 0)).toEqual([
      0.18000000715255737,
      0.18000000715255737,
      0.18000000715255737,
    ]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);
  });

  it('grows 0.18 → 0.55 over 60 ms, holds, fades 1 → 0 over the final 60 ms and releases at 140', () => {
    const effects = createEffects();
    effects.setFeatures({ shards: 0, flash: 1 });
    effects.spawnPop(new Vector3(1, 2, 3), new Vector3(0, 0, 1), 0);
    const mesh = flashMesh(effects);

    effects.update(30);
    expect(instanceScale(mesh, 0)).toEqual([
      0.5037500262260437,
      0.5037500262260437,
      0.5037500262260437,
    ]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);

    effects.update(30);
    expect(instanceScale(mesh, 0)).toEqual([
      0.550000011920929,
      0.550000011920929,
      0.550000011920929,
    ]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);

    // 60–80 ms: the scale holds and the core is still at full brightness.
    effects.update(20);
    expect(instanceScale(mesh, 0)).toEqual([
      0.550000011920929,
      0.550000011920929,
      0.550000011920929,
    ]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);

    // 80–140 ms: brightness falls linearly to zero (scale holds).
    effects.update(30);
    expect(instanceColor(mesh, 0)).toEqual([0.5, 0.5, 0.5]);
    effects.update(29);
    expect(instanceColor(mesh, 0)).toEqual([
      0.01666666753590107,
      0.01666666753590107,
      0.01666666753590107,
    ]);
    expect(effects.activeCounts().flash).toBe(1);

    effects.update(1);
    expect(effects.activeCounts().flash).toBe(0);
    expect(mesh.count).toBe(0);
  });

  it('recycles the oldest flash first at the 6 cap', () => {
    const effects = createEffects();
    effects.setFeatures({ shards: 0, flash: 1 });
    for (let index = 1; index <= 7; index += 1) {
      effects.spawnPop(new Vector3(index, 0, 0), new Vector3(0, 0, 1), index);
    }

    const mesh = flashMesh(effects);
    expect(effects.activeCounts().flash).toBe(6);
    expect(mesh.count).toBe(6);
    // The first pop was recycled; the pool now starts at the second pop.
    expect(instancePosition(mesh, 0).x).toBe(2);
    expect(instancePosition(mesh, 5).x).toBe(7);
  });
});

describe('ember and smoke burst (AC-3)', () => {
  it('spawns 8 embers + 4 smoke points at the +0.05 origin with the pinned palette', () => {
    const effects = createEffects();
    effects.setFeatures({ shards: 0, flash: 0, embers: 8, smoke: 4 });

    effects.spawnPop(new Vector3(1, 2, 3), new Vector3(0, 0, 1), 0);

    const points = burstPoints(effects);
    expect(effects.activeCounts()).toEqual({ shards: 0, flash: 0, points: 12 });
    expect(points.geometry.drawRange.count).toBe(12);
    // Fixed random 0.5 → the fallback (0,0,1) direction for every point; the jitter is
    // along that direction, so every point starts at z = 3.05 + 0.04.
    expect(burstPosition(points, 0)).toEqual([1, 2, 3.0899999141693115]);
    expect(burstPosition(points, 8)).toEqual([1, 2, 3.0899999141693115]);

    // Ember 0 is the hot one (index % 4 === 0), ember 1 the amber one; smoke is the
    // warm-grey 0x8a7f72 at 0.45 brightness (linear working-space colour).
    expect(burstColor(points, 0)).toEqual([1, 0.7991027235984802, 0.5520114302635193]);
    expect(burstColor(points, 1)).toEqual([1, 0.32314321398735046, 0.045186202973127365]);
    expect(burstColor(points, 4)).toEqual([1, 0.7991027235984802, 0.5520114302635193]);
    expect(burstColor(points, 8)).toEqual([
      Math.fround(0.11436844244401333),
      0.09550384432077408,
      0.07572122663259506,
    ]);
  });

  it('applies the accepted ember drag/gravity and the constant smoke upward bias', () => {
    const effects = createEffects();
    effects.setFeatures({ shards: 0, flash: 0, embers: 8, smoke: 4 });
    effects.spawnPop(new Vector3(1, 2, 3), new Vector3(0, 0, 1), 0);
    const points = burstPoints(effects);

    effects.update(100);

    // Ember: vy = −1.5 · 0.1 = −0.15, drag exp(−0.3), position += v · 0.1.
    expect(burstPosition(points, 0)).toEqual([1, 1.9888876676559448, 3.1863064765930176]);
    // Smoke: constant (0, +0.25, speed) velocity, no drag and no gravity.
    expect(burstPosition(points, 8)).toEqual([1, 2.0250000953674316, 3.125]);
    // Colours fade to black over each point's own lifetime.
    expect(burstColor(points, 0)).toEqual([
      0.7368420958518982,
      0.588812530040741,
      0.4067452549934387,
    ]);
    expect(burstColor(points, 8)).toEqual([
      0.09054168313741684,
      0.07560721039772034,
      0.0599459744989872,
    ]);
  });

  it('releases the 380 ms embers before the 480 ms smoke', () => {
    const effects = createEffects();
    effects.setFeatures({ shards: 0, flash: 0, embers: 8, smoke: 4 });
    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);

    effects.update(379);
    expect(effects.activeCounts().points).toBe(12);
    effects.update(1);
    expect(effects.activeCounts().points).toBe(4);
    effects.update(99);
    expect(effects.activeCounts().points).toBe(4);
    effects.update(1);
    expect(effects.activeCounts().points).toBe(0);
    expect(burstPoints(effects).geometry.drawRange.count).toBe(0);
  });

  it('recycles the oldest burst points first at the 72 cap', () => {
    const effects = createEffects();
    effects.setFeatures({ shards: 0, flash: 0, embers: 8, smoke: 4 });
    for (let index = 1; index <= 7; index += 1) {
      effects.spawnPop(new Vector3(index, 0, 0), new Vector3(0, 0, 1), index);
    }

    const points = burstPoints(effects);
    expect(effects.activeCounts().points).toBe(72);
    const xs = [...new Set(activePositions(points).map(([x]) => x))].sort((a, b) => a - b);
    // The first pop's 12 points were replaced by the newest ones; pops 2–7 remain.
    expect(xs).toEqual([2, 3, 4, 5, 6, 7]);
  });
});

describe('shard pops (unchanged AC-3 contract)', () => {
  it('spawns exactly 14 shards per default pop at the +0.02 tile surface', () => {
    const effects = createEffects();
    effects.spawnPop(new Vector3(1, 2, 3), new Vector3(0, 0, 1), 0);

    expect(shardMesh(effects).count).toBe(14);
    // The fixed random source falls back to the +z direction, so the first shard sits
    // 0.02 along the surface normal plus 0.05 along its own direction: (1, 2, 3.07).
    {
      const position = instancePosition(shardMesh(effects), 0);
      expect([position.x, position.y]).toEqual([1, 2]);
      expect(position.z).toBe(3.069999933242798);
    }
  });

  it('clamps the shard count into [0, 14]', () => {
    const capped = createEffects();
    capped.setFeatures({ shards: 999 });
    capped.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    expect(capped.activeCounts().shards).toBe(14);

    const floored = createEffects();
    floored.setFeatures({ shards: -3 });
    floored.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    expect(floored.activeCounts().shards).toBe(0);

    const nonFinite = createEffects();
    nonFinite.setFeatures({ shards: Number.NaN });
    nonFinite.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    expect(nonFinite.activeCounts().shards).toBe(0);

    const fractional = createEffects();
    fractional.setFeatures({ shards: 7.9 });
    fractional.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    expect(fractional.activeCounts().shards).toBe(7);
  });

  it('releases every shard exactly at the 1200 ms lifetime', () => {
    const effects = createEffects();
    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);

    effects.update(1199);
    expect(effects.activeCounts().shards).toBe(14);
    expect(shardMesh(effects).count).toBe(14);

    effects.update(1);
    expect(effects.activeCounts().shards).toBe(0);
    expect(shardMesh(effects).count).toBe(0);
  });

  it('recycles the oldest shard first at the 42 cap', () => {
    const effects = createEffects();
    effects.spawnPop(new Vector3(1, 0, 0), new Vector3(0, 0, 1), 0);
    effects.spawnPop(new Vector3(2, 0, 0), new Vector3(0, 0, 1), 10);
    effects.spawnPop(new Vector3(3, 0, 0), new Vector3(0, 0, 1), 20);
    effects.spawnPop(new Vector3(4, 0, 0), new Vector3(0, 0, 1), 30);

    expect(effects.activeCounts().shards).toBe(42);
    expect(shardMesh(effects).count).toBe(42);
    // The first pop's 14 shards were recycled, so instance 0 belongs to the second pop.
    expect(instancePosition(shardMesh(effects), 0).x).toBe(2);
  });

  it('steps one shard through the accepted drag/gravity physics', () => {
    const effects = createEffects();
    effects.setFeatures({ shards: 1, flash: 0, embers: 0, smoke: 0 });
    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    const mesh = shardMesh(effects);

    // Speed 1.8 + 0.5 · 1.8 = 2.7; after 100 ms vy = −6 · 0.1 = −0.6, drag exp(−0.2).
    effects.update(100);

    const position = instancePosition(mesh, 0);
    expect([position.x, position.y]).toEqual([0, -0.049123845994472504]);
    expect(position.z).toBe(0.291057288646698);
    // Angular speed 3 + 0.5 · 5 = 5.5 rad/s → 0.55 rad after 100 ms; the matrix keeps the
    // unit shard scale (only the rotation changed).
    expect(instanceScale(mesh, 0)).toEqual([1.0000000116878187, 1.0000000116878187, 1]);
    const matrix = instanceMatrix(mesh, 0);
    expect(matrix.elements[1]).toBe(0.5226872563362122);
  });
});

describe('pool discipline (AC-3, AC-8)', () => {
  it('creates no new drawable, geometry or material after construction', () => {
    const effects = createEffects();
    const children = [...effects.group.children] as Array<Mesh | InstancedMesh | Points>;
    const geometries = children.map((child) => child.geometry as BufferGeometry);
    const materials = children.map((child) => child.material as Material);
    const baselineObjects = countObjects(effects.group);
    expect(baselineObjects).toBe(4);

    for (let cycle = 0; cycle < 10; cycle += 1) {
      effects.setFeatures({ shards: 14, flash: 1, embers: 8, smoke: 4 });
      effects.spawnPop(new Vector3(cycle, 0, 0), new Vector3(0, 0, 1), cycle * 10);
      effects.update(20);
    }

    expect(effects.group.children).toHaveLength(3);
    expect(effects.group.children).toEqual(children);
    children.forEach((child, index) => {
      expect(child.geometry).toBe(geometries[index]);
      expect(child.material).toBe(materials[index]);
    });
    // Object count never grows (the frame path allocates no three.js object).
    expect(countObjects(effects.group)).toBe(baselineObjects);
  });
});

describe('dispose', () => {
  it('releases the three geometries and three materials exactly once and is idempotent', () => {
    const effects = createEffects();
    const children = [...effects.group.children] as Array<Mesh | InstancedMesh | Points>;
    const geometryDisposers = children.map((child) => vi.spyOn(child.geometry as BufferGeometry, 'dispose'));
    const materialDisposers = children.map((child) => vi.spyOn(child.material as Material, 'dispose'));

    effects.setFeatures({ shards: 14, flash: 6, embers: 8, smoke: 4 });
    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 0);
    effects.dispose();
    effects.dispose();

    expect(geometryDisposers).toHaveLength(3);
    expect(materialDisposers).toHaveLength(3);
    for (const spy of geometryDisposers) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
    for (const spy of materialDisposers) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
    expect(effects.group.children).toEqual([]);
    expect(effects.activeCounts()).toEqual({ shards: 0, flash: 0, points: 0 });

    effects.spawnPop(new Vector3(0, 0, 0), new Vector3(0, 0, 1), 100);
    effects.update(1000);
    expect(effects.activeCounts()).toEqual({ shards: 0, flash: 0, points: 0 });
    for (const spy of geometryDisposers) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
    for (const spy of materialDisposers) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });
});
