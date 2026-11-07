/**
 * Tests for the procedural cosmic backdrop (T10/T2 — reference-image-game-view spec AC-11,
 * AC-12, detailed-hero-spaceship spec AC-11…AC-13): object counts/names, pinned
 * colours/positions, the mounted detailed hero model, shadow-free meshes, the
 * behind-the-cube band, positive-dt motion for every object family, the reduced-motion
 * freeze, dt clamping and dispose-once/removal.
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
import {
  HERO_ACCENT_ORANGE,
  HERO_CANOPY_COLOR,
  HERO_CANOPY_HIGHLIGHT,
  HERO_ENGINE_HOUSING_COLOR,
  HERO_ENGINE_NOZZLE_COLOR,
  HERO_FLAME_COLOR as MODEL_FLAME_COLOR,
  HERO_FLAME_CORE_COLOR,
  HERO_HULL_COLOR as MODEL_HULL_COLOR,
  HERO_MATERIAL_COUNT,
  HERO_PANEL_LIGHT,
  HERO_PANEL_MID,
  HERO_SHIP_MESH_COUNT,
  HERO_SHIP_MODEL_OBJECT_COUNT,
  HERO_SHIP_SUBTREE_OBJECT_COUNT,
  HERO_TRIM_NAVY,
  type HeroSpaceshipModel,
} from './spaceship-model';

/**
 * Every model the backdrop factory creates. The model's `dispose()` is a per-instance
 * closure (not a prototype method), so the wrapper records the handle to spy on the exact
 * disposal seam the backdrop calls (AC-12).
 */
const createdModels = vi.hoisted(() => [] as HeroSpaceshipModel[]);

vi.mock('./spaceship-model', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./spaceship-model')>();
  return {
    ...actual,
    createHeroSpaceshipModel: (): HeroSpaceshipModel => {
      const model = actual.createHeroSpaceshipModel();
      createdModels.push(model);
      return model;
    },
  };
});

/** The exact 48-mesh name→count map mounted inside `hero-ship-model` (AC-3, AC-11). */
const HERO_NAME_COUNTS: Readonly<Record<string, number>> = {
  'hero-antenna-aft': 1,
  'hero-antenna-fore': 1,
  'hero-cockpit': 1,
  'hero-cockpit-frame': 1,
  'hero-cockpit-highlight': 1,
  'hero-dorsal-spine': 1,
  'hero-engine': 2,
  'hero-engine-core': 2,
  'hero-engine-housing-left': 1,
  'hero-engine-housing-right': 1,
  'hero-engine-nozzle-left': 1,
  'hero-engine-nozzle-right': 1,
  'hero-engine-pylon-left': 1,
  'hero-engine-pylon-right': 1,
  'hero-engine-rib-left-1': 1,
  'hero-engine-rib-left-2': 1,
  'hero-engine-rib-right-1': 1,
  'hero-engine-rib-right-2': 1,
  'hero-greeble-1': 1,
  'hero-greeble-2': 1,
  'hero-hull': 1,
  'hero-hull-seam-1': 1,
  'hero-hull-seam-2': 1,
  'hero-hull-seam-3': 1,
  'hero-hull-stripe-left': 1,
  'hero-hull-stripe-right': 1,
  'hero-hull-underside': 1,
  'hero-nose': 1,
  'hero-tail-fin-left': 1,
  'hero-tail-fin-right': 1,
  'hero-tail-fin-tip-left': 1,
  'hero-tail-fin-tip-right': 1,
  'hero-vent-left': 1,
  'hero-vent-right': 1,
  'hero-wing-leading-left': 1,
  'hero-wing-leading-right': 1,
  'hero-wing-left': 1,
  'hero-wing-right': 1,
  'hero-wing-seam-left-1': 1,
  'hero-wing-seam-left-2': 1,
  'hero-wing-seam-left-3': 1,
  'hero-wing-seam-right-1': 1,
  'hero-wing-seam-right-2': 1,
  'hero-wing-seam-right-3': 1,
  'hero-wingtip-left': 1,
  'hero-wingtip-right': 1,
};

/**
 * Exact palette→mesh-count map across the 48 hero meshes: 11 shared material instances,
 * each reused by its pinned part family (AC-4, AC-11).
 */
const HERO_COLOR_MESH_COUNTS: Readonly<Record<number, number>> = {
  [HERO_HULL_COLOR]: 4,
  [HERO_PANEL_LIGHT]: 1,
  [HERO_PANEL_MID]: 10,
  [HERO_TRIM_NAVY]: 17,
  [HERO_ACCENT_ORANGE]: 6,
  [HERO_CANOPY_COLOR]: 1,
  [HERO_CANOPY_HIGHLIGHT]: 1,
  [HERO_FLAME_COLOR]: 2,
  [HERO_FLAME_CORE_COLOR]: 2,
  [HERO_ENGINE_HOUSING_COLOR]: 2,
  [HERO_ENGINE_NOZZLE_COLOR]: 2,
};

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
let heroModel: HeroSpaceshipModel;

beforeEach(() => {
  createdModels.length = 0;
  backdrop = createCosmicBackdrop(seededRandom(11));
  heroModel = createdModels[0]!;
});

afterEach(() => {
  backdrop.dispose();
});

describe('cosmic backdrop contents (AC-11)', () => {
  it('pins the exported counts, colours and positions', () => {
    expect(COSMIC_ASTEROID_COUNT).toBe(7);
    expect(COSMIC_METEOR_COUNT).toBe(3);
    expect(COSMIC_BACKDROP_OBJECT_COUNT).toBe(70);
    expect(COMET_HEAD_COLOR).toBe(0xff8a3d);
    expect(HERO_HULL_COLOR).toBe(0x2f6fd6);
    expect(HERO_FLAME_COLOR).toBe(0xff9a3c);
    // The palette is re-exported from the model module, not duplicated (AC-11).
    expect(HERO_HULL_COLOR).toBe(MODEL_HULL_COLOR);
    expect(HERO_FLAME_COLOR).toBe(MODEL_FLAME_COLOR);
    expect(HERO_MATERIAL_COUNT).toBe(11);
    expect(HERO_SHIP_MESH_COUNT).toBe(48);
    expect(COMET_POSITION).toEqual({ x: 7.5, y: 2.2, z: -18 });
    expect(HERO_SHIP_POSITION).toEqual({ x: 9, y: -2.5, z: -14 });
  });

  it('builds one named group with exactly the pinned object count', () => {
    expect(backdrop.group.name).toBe('cosmic-backdrop');
    expect(backdrop.group.parent).toBeNull();
    expect(backdrop.group.children).toHaveLength(12);
    expect(countObjects(backdrop.group)).toBe(70);
    expect(HERO_SHIP_SUBTREE_OBJECT_COUNT).toBe(50);
    expect(countObjects(backdrop.heroShip)).toBe(HERO_SHIP_SUBTREE_OBJECT_COUNT);
    expect(countObjects(backdrop.heroShip.children[0]!)).toBe(HERO_SHIP_MODEL_OBJECT_COUNT);
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

  it('mounts exactly one detailed hero-ship-model inside the pinned hero-ship group', () => {
    const heroShip = backdrop.heroShip;
    expect(heroShip).toBeInstanceOf(Group);
    expect(heroShip.name).toBe('hero-ship');
    expect(heroShip.position.x).toBe(9);
    expect(heroShip.position.y).toBe(-2.5);
    expect(heroShip.position.z).toBe(-14);
    expect(heroShip.rotation.y).toBe(Math.PI / 2);
    // The outer group keeps its pinned composition and holds only the model group.
    expect(heroShip.children).toHaveLength(1);

    const model = heroShip.children[0]!;
    expect(model).toBeInstanceOf(Group);
    expect(model.name).toBe('hero-ship-model');
    expect(model.scale.toArray()).toEqual([1.7, 1.7, 1.7]);
    expect(model.rotation.x).toBe(-0.1);
    expect(model.rotation.y).toBe(0.26);
    expect(model.rotation.z).toBe(0);
    expect(model.children).toHaveLength(HERO_SHIP_MESH_COUNT);

    const heroMeshes = collectMeshes(model);
    expect(heroMeshes).toHaveLength(48);
    for (const child of model.children) {
      expect(child).toBeInstanceOf(Mesh);
    }

    const nameCounts: Record<string, number> = {};
    for (const mesh of heroMeshes) {
      nameCounts[mesh.name] = (nameCounts[mesh.name] ?? 0) + 1;
    }
    expect(nameCounts).toEqual(HERO_NAME_COUNTS);

    const engines = heroMeshes.filter((mesh) => mesh.name === 'hero-engine');
    expect(engines).toHaveLength(2);
    for (const engine of engines) {
      expect(materialColor(engine)).toBe(HERO_FLAME_COLOR);
    }
    expect(materialColor(findMesh(model, 'hero-hull'))).toBe(HERO_HULL_COLOR);
  });

  it('shares exactly eleven hero materials with the pinned per-family mesh counts', () => {
    const heroMeshes = collectMeshes(backdrop.heroShip);
    const materials = new Set(heroMeshes.map((mesh) => materialOf(mesh)));
    expect(materials.size).toBe(HERO_MATERIAL_COUNT);

    const colorCounts: Record<number, number> = {};
    for (const mesh of heroMeshes) {
      const color = materialColor(mesh);
      colorCounts[color] = (colorCounts[color] ?? 0) + 1;
    }
    expect(colorCounts).toEqual(HERO_COLOR_MESH_COUNTS);
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
    // Only the outer hero group bobs: the model group and its 48 meshes keep their local
    // transforms (AC-12).
    const modelTransforms = snapshotTransforms(backdrop.heroShip.children[0]!);

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
    expect(snapshotTransforms(backdrop.heroShip.children[0]!)).toEqual(modelTransforms);
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
  it('releases every unique geometry/material and the texture exactly once, then detaches', () => {
    const meshes = collectMeshes(backdrop.group);
    // 63 total = 15 non-hero (7 asteroids + 6 meteor meshes + 2 comet meshes) + 48 hero.
    expect(meshes).toHaveLength(63);

    const heroMeshes = collectMeshes(backdrop.heroShip);
    expect(heroMeshes).toHaveLength(48);
    const nonHeroMeshes = meshes.filter((mesh) => !heroMeshes.includes(mesh));
    expect(nonHeroMeshes).toHaveLength(15);

    const geometries = [...new Set(meshes.map((mesh) => mesh.geometry))];
    // Unique sets: 48 hero geometries + 15 non-hero, and 11 shared hero materials + 15
    // one-material non-hero meshes.
    expect(geometries).toHaveLength(63);
    const materials = [...new Set(meshes.map((mesh) => materialOf(mesh)))];
    expect(materials).toHaveLength(15 + HERO_MATERIAL_COUNT);

    const geometrySpies = geometries.map((geometry) => vi.spyOn(geometry, 'dispose'));
    const materialSpies = materials.map((material) => vi.spyOn(material, 'dispose'));
    const textureSpy = vi.spyOn(backdrop.nebulaTexture, 'dispose');
    const modelDispose = vi.spyOn(heroModel, 'dispose');

    const parent = new Group();
    parent.add(backdrop.group);
    backdrop.dispose();

    expect(parent.children).toEqual([]);
    expect(backdrop.group.parent).toBeNull();
    expect(backdrop.group.children).toEqual([]);
    expect(backdrop.asteroids).toEqual([]);
    expect(backdrop.meteors).toEqual([]);
    expect(backdrop.heroShip.children).toEqual([]);
    expect(modelDispose).toHaveBeenCalledTimes(1);
    expect(modelDispose).toHaveBeenCalledWith();
    for (const spy of [...geometrySpies, ...materialSpies, textureSpy]) {
      expect(spy).toHaveBeenCalledTimes(1);
    }

    backdrop.dispose();
    expect(modelDispose).toHaveBeenCalledTimes(1);
    for (const spy of [...geometrySpies, ...materialSpies, textureSpy]) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });
});
