/**
 * Tests for the procedural cosmic backdrop (T10 — reference-image-game-view spec AC-11,
 * AC-12, AC-19): object counts/names, pinned colours/positions, the hero-ship mesh set,
 * shadow-free meshes, the behind-the-cube band, positive-dt motion for every object family,
 * the reduced-motion freeze, dt clamping and dispose-once/removal.
 */

import {
  AdditiveBlending,
  DataTexture,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  COMET_HEAD_COLOR,
  COMET_POSITION,
  COSMIC_ASTEROID_COUNT,
  COSMIC_BACKDROP_OBJECT_COUNT,
  COSMIC_METEOR_COUNT,
  HERO_FLAME_COLOR,
  HERO_HULL_COLOR,
  HERO_SHIP_POSITION,
  createCosmicBackdrop,
  type CosmicBackdrop,
} from './cosmic-backdrop';

/** Deterministic LCG (same seed → same stream), mirroring the other render tests. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Counts the root and every descendant (the AC-11 "including the group" semantics). */
function countObjects(root: Object3D): number {
  return 1 + root.children.reduce((total, child) => total + countObjects(child), 0);
}

/** Collects every mesh in a subtree. */
function collectMeshes(root: Object3D): Mesh[] {
  const meshes: Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh) {
      meshes.push(object);
    }
  });
  return meshes;
}

/** Finds a named mesh, failing loudly when the object is missing or not a mesh. */
function findMesh(parent: Object3D, name: string): Mesh {
  const object = parent.getObjectByName(name);
  if (!(object instanceof Mesh)) {
    throw new Error(`expected a Mesh named ${name}`);
  }
  return object;
}

/** Returns the single material of a mesh (every backdrop mesh owns exactly one). */
function materialOf(mesh: Mesh): MeshBasicMaterial | MeshStandardMaterial {
  const material = mesh.material;
  if (Array.isArray(material)) {
    throw new Error('backdrop meshes must have a single material');
  }
  if (!(material instanceof MeshBasicMaterial) && !(material instanceof MeshStandardMaterial)) {
    throw new Error('unexpected backdrop material');
  }
  return material;
}

/** Exact colour of a mesh's material as a 0xRRGGBB number. */
function materialColor(mesh: Mesh): number {
  return materialOf(mesh).color.getHex();
}

interface TransformRow {
  readonly name: string;
  readonly position: readonly number[];
  readonly rotation: readonly [number, number, number];
  readonly scale: readonly number[];
}

/** Stable snapshot of every transform in a subtree, for freeze assertions. */
function snapshotTransforms(root: Object3D): TransformRow[] {
  const rows: TransformRow[] = [];
  root.traverse((object) => {
    rows.push({
      name: object.name,
      position: object.position.toArray(),
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: object.scale.toArray(),
    });
  });
  return rows;
}

let backdrop: CosmicBackdrop;

beforeEach(() => {
  backdrop = createCosmicBackdrop(seededRandom(11));
});

afterEach(() => {
  backdrop.dispose();
});

describe('cosmic backdrop contents (AC-11)', () => {
  it('pins the exported counts, colours and positions', () => {
    expect(COSMIC_ASTEROID_COUNT).toBe(7);
    expect(COSMIC_METEOR_COUNT).toBe(3);
    expect(COSMIC_BACKDROP_OBJECT_COUNT).toBe(28);
    expect(COMET_HEAD_COLOR).toBe(0xff8a3d);
    expect(HERO_HULL_COLOR).toBe(0x2f6fd6);
    expect(HERO_FLAME_COLOR).toBe(0xff9a3c);
    expect(COMET_POSITION).toEqual({ x: 7.5, y: 2.2, z: -18 });
    expect(HERO_SHIP_POSITION).toEqual({ x: 9, y: -2.5, z: -14 });
  });

  it('builds one named group with exactly the pinned object count', () => {
    expect(backdrop.group.name).toBe('cosmic-backdrop');
    expect(backdrop.group.parent).toBeNull();
    expect(backdrop.group.children).toHaveLength(12);
    expect(countObjects(backdrop.group)).toBe(28);
  });

  it('exposes the generated nebula texture (256 × 128 RGBA)', () => {
    expect(backdrop.nebulaTexture).toBeInstanceOf(DataTexture);
    const image = backdrop.nebulaTexture.image as {
      width: number;
      height: number;
      data: Uint8Array;
    };
    expect(image.width).toBe(256);
    expect(image.height).toBe(128);
    expect(image.data).toHaveLength(256 * 128 * 4);
  });

  it('builds seven dodecahedron asteroids with MeshStandardMaterial', () => {
    expect(backdrop.asteroids).toHaveLength(7);
    expect(backdrop.group.children.filter((child) => child.name === 'asteroid')).toHaveLength(7);
    for (const asteroid of backdrop.asteroids) {
      expect(asteroid).toBeInstanceOf(Mesh);
      expect(asteroid.name).toBe('asteroid');
      expect(asteroid.geometry).toBeInstanceOf(DodecahedronGeometry);
      expect(materialOf(asteroid)).toBeInstanceOf(MeshStandardMaterial);
    }
  });

  it('builds three meteor groups, each with a glowing non-depth-writing tail', () => {
    expect(backdrop.meteors).toHaveLength(3);
    for (const meteor of backdrop.meteors) {
      expect(meteor).toBeInstanceOf(Group);
      expect(meteor.name).toBe('meteor');
      expect(meteor.children).toHaveLength(2);

      const head = findMesh(meteor, 'meteor-head');
      expect(materialOf(head)).toBeInstanceOf(MeshBasicMaterial);

      const tail = findMesh(meteor, 'meteor-tail');
      const tailMaterial = materialOf(tail);
      expect(tailMaterial).toBeInstanceOf(MeshBasicMaterial);
      expect(tailMaterial.blending).toBe(AdditiveBlending);
      expect(tailMaterial.transparent).toBe(true);
      expect(tailMaterial.depthWrite).toBe(false);
    }
  });

  it('places the comet and its orange head at the pinned right-side position', () => {
    expect(backdrop.comet).toBeInstanceOf(Group);
    expect(backdrop.comet.name).toBe('comet');
    expect(backdrop.comet.position.x).toBe(7.5);
    expect(backdrop.comet.position.y).toBe(2.2);
    expect(backdrop.comet.position.z).toBe(-18);
    expect(backdrop.comet.children).toHaveLength(2);
    expect(backdrop.comet.children.map((child) => child.name).sort()).toEqual([
      'comet-head',
      'comet-tail',
    ]);
    expect(materialColor(findMesh(backdrop.comet, 'comet-head'))).toBe(COMET_HEAD_COLOR);
  });

  it('builds the hero ship facing +x with a blue hull and exactly two orange engines', () => {
    const heroShip = backdrop.heroShip;
    expect(heroShip).toBeInstanceOf(Group);
    expect(heroShip.name).toBe('hero-ship');
    expect(heroShip.position.x).toBe(9);
    expect(heroShip.position.y).toBe(-2.5);
    expect(heroShip.position.z).toBe(-14);
    expect(heroShip.rotation.y).toBe(Math.PI / 2);
    expect(heroShip.children).toHaveLength(7);

    const names = heroShip.children.map((child) => child.name).sort();
    expect(names).toEqual([
      'hero-cockpit',
      'hero-engine',
      'hero-engine',
      'hero-hull',
      'hero-nose',
      'hero-wing-left',
      'hero-wing-right',
    ]);
    for (const child of heroShip.children) {
      expect(child).toBeInstanceOf(Mesh);
    }

    const engines = heroShip.children.filter((child) => child.name === 'hero-engine');
    expect(engines).toHaveLength(2);
    for (const engine of engines) {
      expect(materialColor(engine as Mesh)).toBe(HERO_FLAME_COLOR);
    }
    expect(materialColor(findMesh(heroShip, 'hero-hull'))).toBe(HERO_HULL_COLOR);
  });

  it('casts no shadows and keeps every object behind the cube', () => {
    const worldPosition = new Vector3();
    backdrop.group.updateMatrixWorld(true);
    backdrop.group.traverse((object) => {
      if (object === backdrop.group) {
        return;
      }
      object.getWorldPosition(worldPosition);
      expect(worldPosition.z).toBeLessThan(-4);
      if (object instanceof Mesh) {
        expect(object.castShadow).toBe(false);
        expect(object.receiveShadow).toBe(false);
      }
    });
  });
});

describe('cosmic backdrop motion (AC-12)', () => {
  it('moves every asteroid, meteor, the comet and the hero ship for a positive dt', () => {
    const asteroidRotations = backdrop.asteroids.map((asteroid) => asteroid.rotation.x);
    const meteorPositions = backdrop.meteors.map(
      (meteor) => [meteor.position.x, meteor.position.y] as const,
    );

    backdrop.update(128);

    backdrop.asteroids.forEach((asteroid, index) => {
      expect(asteroid.rotation.x).toBe(asteroidRotations[index]! + 0.015625);
    });
    backdrop.meteors.forEach((meteor, index) => {
      expect(meteor.position.x).toBe(meteorPositions[index]![0] + 0.25);
      expect(meteor.position.y).toBe(meteorPositions[index]![1] + 0.125);
    });

    expect(backdrop.comet.position.x).toBe(7.5);
    expect(backdrop.comet.position.y).toBe(2.2 + Math.sin(0.03125) * 0.25);
    expect(backdrop.comet.position.z).toBe(-18);

    expect(backdrop.heroShip.position.x).toBe(9);
    expect(backdrop.heroShip.position.y).toBe(-2.5 + Math.sin(0.0625) * 0.25);
    expect(backdrop.heroShip.position.z).toBe(-14);
    expect(backdrop.heroShip.rotation.y).toBe(Math.PI / 2);
  });

  it('wraps meteors back inside their band over a long advance', () => {
    backdrop.update(20000);
    for (const meteor of backdrop.meteors) {
      expect(meteor.position.x).toBe(-16);
      expect(meteor.position.y).toBe(-10);
      expect(meteor.position.z).toBeLessThan(-4);
    }
  });

  it('freezes every transform under reduced motion', () => {
    backdrop.update(128);
    const frozen = snapshotTransforms(backdrop.group);
    backdrop.update(4096, true);
    expect(snapshotTransforms(backdrop.group)).toEqual(frozen);
  });

  it('clamps non-positive dt so nothing advances', () => {
    const initial = snapshotTransforms(backdrop.group);
    backdrop.update(-500);
    expect(snapshotTransforms(backdrop.group)).toEqual(initial);
    backdrop.update(0);
    expect(snapshotTransforms(backdrop.group)).toEqual(initial);
  });
});

describe('cosmic backdrop disposal (AC-12)', () => {
  it('releases every geometry/material and the texture exactly once, then detaches', () => {
    const meshes = collectMeshes(backdrop.group);
    expect(meshes).toHaveLength(22);

    const geometrySpies = meshes.map((mesh) => vi.spyOn(mesh.geometry, 'dispose'));
    const materialSpies = meshes.map((mesh) => {
      const material = mesh.material;
      if (Array.isArray(material)) {
        throw new Error('backdrop meshes must have a single material');
      }
      return vi.spyOn(material, 'dispose');
    });
    const textureSpy = vi.spyOn(backdrop.nebulaTexture, 'dispose');

    const parent = new Group();
    parent.add(backdrop.group);
    backdrop.dispose();

    expect(parent.children).toEqual([]);
    expect(backdrop.group.parent).toBeNull();
    expect(backdrop.group.children).toEqual([]);
    expect(backdrop.asteroids).toEqual([]);
    expect(backdrop.meteors).toEqual([]);
    for (const spy of [...geometrySpies, ...materialSpies, textureSpy]) {
      expect(spy).toHaveBeenCalledTimes(1);
    }

    backdrop.dispose();
    for (const spy of [...geometrySpies, ...materialSpies, textureSpy]) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });
});
