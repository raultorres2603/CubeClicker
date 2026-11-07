/**
 * Tests for the detailed procedural hero spaceship factory
 * (detailed-hero-spaceship spec AC-2…AC-10, plan § Model hierarchy and part list).
 *
 * Contract covered: factory shape and object counts, the exact 48-name mesh map, the 11
 * shared materials and their pinned PBR/basic values, model-local dimensions and attitude,
 * cockpit/canopy, swept extruded wings, tail fins, twin nacelles/exhaust, surface-detail
 * thinness/offset and dispose-once/idempotence. All boxes are measured with the model
 * group's scale/rotation reset to identity, i.e. in model-local units before the 1.7 scale.
 * Assertions are concrete: exact names/counts/colours/values and pinned ranges; no snapshot
 * or wildcard matchers.
 */

import {
  AdditiveBlending,
  Box3,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Light,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Points,
  SphereGeometry,
  Sprite,
  Texture,
  TorusGeometry,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  HERO_ACCENT_ORANGE,
  HERO_CANOPY_COLOR,
  HERO_CANOPY_HIGHLIGHT,
  HERO_DETAIL_OFFSET,
  HERO_ENGINE_HOUSING_COLOR,
  HERO_ENGINE_NOZZLE_COLOR,
  HERO_FLAME_COLOR,
  HERO_FLAME_CORE_COLOR,
  HERO_HULL_COLOR,
  HERO_MATERIAL_COUNT,
  HERO_PANEL_LIGHT,
  HERO_PANEL_MID,
  HERO_SHIP_HEIGHT,
  HERO_SHIP_LENGTH,
  HERO_SHIP_MAX_TRIANGLES,
  HERO_SHIP_MESH_COUNT,
  HERO_SHIP_MODEL_OBJECT_COUNT,
  HERO_SHIP_PITCH,
  HERO_SHIP_SCALE,
  HERO_SHIP_SUBTREE_OBJECT_COUNT,
  HERO_SHIP_WIDTH,
  HERO_SHIP_YAW,
  HERO_TRIM_NAVY,
  HERO_WING_ROOT_X,
  HERO_WING_SHAPE_SPAN,
  HERO_WINGTIP_X,
  createHeroSpaceshipModel,
  type HeroSpaceshipModel,
} from './spaceship-model';

/** The exact AC-3 name→count map: 46 distinct names, 48 meshes in total. */
const EXPECTED_MESH_COUNTS: Readonly<Record<string, number>> = {
  'hero-hull': 1,
  'hero-hull-underside': 1,
  'hero-nose': 1,
  'hero-dorsal-spine': 1,
  'hero-tail-fin-left': 1,
  'hero-tail-fin-right': 1,
  'hero-tail-fin-tip-left': 1,
  'hero-tail-fin-tip-right': 1,
  'hero-cockpit': 1,
  'hero-cockpit-frame': 1,
  'hero-cockpit-highlight': 1,
  'hero-hull-seam-1': 1,
  'hero-hull-seam-2': 1,
  'hero-hull-seam-3': 1,
  'hero-wing-left': 1,
  'hero-wing-right': 1,
  'hero-wing-leading-left': 1,
  'hero-wing-leading-right': 1,
  'hero-wingtip-left': 1,
  'hero-wingtip-right': 1,
  'hero-wing-seam-left-1': 1,
  'hero-wing-seam-left-2': 1,
  'hero-wing-seam-left-3': 1,
  'hero-wing-seam-right-1': 1,
  'hero-wing-seam-right-2': 1,
  'hero-wing-seam-right-3': 1,
  'hero-engine-pylon-left': 1,
  'hero-engine-pylon-right': 1,
  'hero-engine-housing-left': 1,
  'hero-engine-housing-right': 1,
  'hero-engine-rib-left-1': 1,
  'hero-engine-rib-left-2': 1,
  'hero-engine-rib-right-1': 1,
  'hero-engine-rib-right-2': 1,
  'hero-engine-nozzle-left': 1,
  'hero-engine-nozzle-right': 1,
  'hero-engine': 2,
  'hero-engine-core': 2,
  'hero-hull-stripe-left': 1,
  'hero-hull-stripe-right': 1,
  'hero-vent-left': 1,
  'hero-vent-right': 1,
  'hero-antenna-fore': 1,
  'hero-antenna-aft': 1,
  'hero-greeble-1': 1,
  'hero-greeble-2': 1,
};

/** Counts the root and every descendant (the AC-2 "including the group" semantics). */
function countObjects(root: Object3D): number {
  return 1 + root.children.reduce((total, child) => total + countObjects(child), 0);
}

/** Finds one named mesh in the model's mesh list, failing loudly when it is missing. */
function meshNamed(model: HeroSpaceshipModel, name: string): Mesh {
  const mesh = model.meshes.find((candidate) => candidate.name === name);
  if (mesh === undefined) {
    throw new Error(`expected a Mesh named ${name}`);
  }
  return mesh;
}

/** Returns the single material of a mesh (the model never uses material arrays). */
function materialOf(mesh: Mesh): Material {
  const material = mesh.material;
  if (Array.isArray(material)) {
    throw new Error(`mesh ${mesh.name} must have a single material`);
  }
  return material;
}

/** Narrows a mesh's material to `MeshPhysicalMaterial`. */
function physicalMaterialOf(mesh: Mesh): MeshPhysicalMaterial {
  const material = materialOf(mesh);
  if (!(material instanceof MeshPhysicalMaterial)) {
    throw new Error(`mesh ${mesh.name} must use a MeshPhysicalMaterial`);
  }
  return material;
}

/** Narrows a mesh's material to `MeshStandardMaterial`. */
function standardMaterialOf(mesh: Mesh): MeshStandardMaterial {
  const material = materialOf(mesh);
  if (!(material instanceof MeshStandardMaterial)) {
    throw new Error(`mesh ${mesh.name} must use a MeshStandardMaterial`);
  }
  return material;
}

/** Narrows a mesh's material to `MeshBasicMaterial`. */
function basicMaterialOf(mesh: Mesh): MeshBasicMaterial {
  const material = materialOf(mesh);
  if (!(material instanceof MeshBasicMaterial)) {
    throw new Error(`mesh ${mesh.name} must use a MeshBasicMaterial`);
  }
  return material;
}

/** Computes and returns a mesh's model-local geometry bounding box (before its transform). */
function geometryBox(mesh: Mesh): Box3 {
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  if (box === null) {
    throw new Error(`mesh ${mesh.name} has no geometry bounding box`);
  }
  return box;
}

/**
 * Runs `measure` with the model group's scale/rotation reset to identity, then restores the
 * pinned transform. This is the AC-5 "model-local units before the 1.7 scale" measurement.
 */
function withIdentityModel<T>(model: HeroSpaceshipModel, measure: () => T): T {
  const { group } = model;
  const scale = group.scale.clone();
  const rotation = group.rotation.clone();
  group.scale.set(1, 1, 1);
  group.rotation.set(0, 0, 0);
  group.updateMatrixWorld(true);
  try {
    return measure();
  } finally {
    group.scale.copy(scale);
    group.rotation.copy(rotation);
    group.updateMatrixWorld(true);
  }
}

/** Model-local `Box3` of one named mesh (group transform reset). */
function modelLocalBox(model: HeroSpaceshipModel, name: string): Box3 {
  return withIdentityModel(model, () => new Box3().setFromObject(meshNamed(model, name)));
}

let model: HeroSpaceshipModel;

beforeEach(() => {
  model = createHeroSpaceshipModel();
});

afterEach(() => {
  model.dispose();
});

describe('hero spaceship pinned constants (AC-2, AC-4, AC-5, AC-8, AC-10)', () => {
  it('exports the pinned scale, attitude, counts, budget and dimension constants', () => {
    expect(HERO_SHIP_SCALE).toBe(1.7);
    expect(HERO_SHIP_YAW).toBe(0.26);
    expect(HERO_SHIP_PITCH).toBe(0.1);
    expect(HERO_SHIP_MESH_COUNT).toBe(48);
    expect(HERO_SHIP_MODEL_OBJECT_COUNT).toBe(49);
    expect(HERO_SHIP_SUBTREE_OBJECT_COUNT).toBe(50);
    expect(HERO_SHIP_MAX_TRIANGLES).toBe(6000);
    expect(HERO_SHIP_LENGTH).toBe(4.6);
    expect(HERO_SHIP_WIDTH).toBe(3.3);
    expect(HERO_SHIP_HEIGHT).toBe(1.0);
    expect(HERO_MATERIAL_COUNT).toBe(11);
    expect(HERO_DETAIL_OFFSET).toBe(0.012);
    expect(HERO_WING_ROOT_X).toBe(0.4);
    expect(HERO_WINGTIP_X).toBe(1.65);
    expect(HERO_WING_SHAPE_SPAN).toBe(1.25);
  });

  it('exports the 11 pinned palette colours', () => {
    expect(HERO_HULL_COLOR).toBe(0x2f6fd6);
    expect(HERO_PANEL_LIGHT).toBe(0xd9dee7);
    expect(HERO_PANEL_MID).toBe(0x8f9bad);
    expect(HERO_TRIM_NAVY).toBe(0x14213d);
    expect(HERO_ACCENT_ORANGE).toBe(0xff7a1a);
    expect(HERO_CANOPY_COLOR).toBe(0x0b2f38);
    expect(HERO_CANOPY_HIGHLIGHT).toBe(0xcffcff);
    expect(HERO_FLAME_COLOR).toBe(0xff9a3c);
    expect(HERO_FLAME_CORE_COLOR).toBe(0xfff3d6);
    expect(HERO_ENGINE_HOUSING_COLOR).toBe(0x35507a);
    expect(HERO_ENGINE_NOZZLE_COLOR).toBe(0x1a2333);
  });
});

describe('hero spaceship model contract (AC-2)', () => {
  it('builds one `hero-ship-model` group with the pinned transform and 48 direct meshes', () => {
    expect(model.group).toBeInstanceOf(Group);
    expect(model.group.name).toBe('hero-ship-model');
    expect(model.group.parent).toBeNull();
    expect(model.group.scale.toArray()).toEqual([1.7, 1.7, 1.7]);
    expect(model.group.rotation.x).toBe(-0.1);
    expect(model.group.rotation.y).toBe(0.26);
    expect(model.group.rotation.z).toBe(0);

    expect(model.meshes).toHaveLength(HERO_SHIP_MESH_COUNT);
    expect(new Set(model.meshes).size).toBe(HERO_SHIP_MESH_COUNT);
    expect(model.group.children).toHaveLength(HERO_SHIP_MESH_COUNT);
    for (const child of model.group.children) {
      expect(child).toBeInstanceOf(Mesh);
    }
    expect(model.group.children.map((child) => child.name).sort()).toEqual(
      model.meshes.map((mesh) => mesh.name).sort(),
    );
  });

  it('contains exactly the AC-3 name→count map (46 names, 48 meshes)', () => {
    const counts: Record<string, number> = {};
    for (const mesh of model.meshes) {
      counts[mesh.name] = (counts[mesh.name] ?? 0) + 1;
    }
    expect(counts).toEqual(EXPECTED_MESH_COUNTS);
    expect(Object.keys(counts)).toHaveLength(46);
    expect(model.meshes).toHaveLength(48);
  });

  it('reports the pinned model and hero subtree object counts', () => {
    expect(countObjects(model.group)).toBe(HERO_SHIP_MODEL_OBJECT_COUNT);
    const heroGroup = new Group();
    heroGroup.add(model.group);
    expect(countObjects(heroGroup)).toBe(HERO_SHIP_SUBTREE_OBJECT_COUNT);
  });

  it('exposes the two flame and two core meshes by the pinned names', () => {
    expect(model.flames).toHaveLength(2);
    expect(model.flames.map((flame) => flame.name)).toEqual(['hero-engine', 'hero-engine']);
    expect(model.flameCores).toHaveLength(2);
    expect(model.flameCores.map((core) => core.name)).toEqual([
      'hero-engine-core',
      'hero-engine-core',
    ]);
    for (const flame of model.flames) {
      expect(model.meshes).toContain(flame);
    }
    for (const core of model.flameCores) {
      expect(model.meshes).toContain(core);
    }
  });

  it('computes a positive triangle count within the 6,000 budget', () => {
    expect(model.triangleCount).toBe(1852);
    expect(model.triangleCount).toBeGreaterThan(0);
    expect(model.triangleCount).toBeLessThanOrEqual(HERO_SHIP_MAX_TRIANGLES);
  });

  it('is deterministic and parameter-free (no random source)', () => {
    expect(createHeroSpaceshipModel).toHaveLength(0);
    const other = createHeroSpaceshipModel();
    expect(other.triangleCount).toBe(model.triangleCount);
    expect(other.meshes.map((mesh) => mesh.name)).toEqual(
      model.meshes.map((mesh) => mesh.name),
    );
    other.dispose();
  });

  it('casts and receives no shadows', () => {
    for (const mesh of model.meshes) {
      expect(mesh.castShadow).toBe(false);
      expect(mesh.receiveShadow).toBe(false);
    }
  });

  it('creates no lights, points, sprites or textures', () => {
    let lights = 0;
    let points = 0;
    let sprites = 0;
    model.group.traverse((object) => {
      if (object instanceof Light) {
        lights += 1;
      }
      if (object instanceof Points) {
        points += 1;
      }
      if (object instanceof Sprite) {
        sprites += 1;
      }
    });
    expect(lights).toBe(0);
    expect(points).toBe(0);
    expect(sprites).toBe(0);

    for (const mesh of model.meshes) {
      const material = materialOf(mesh);
      const textures = Object.values(material).filter((value) => value instanceof Texture);
      expect(textures).toHaveLength(0);
    }
  });
});

describe('hero spaceship palette and shared materials (AC-4)', () => {
  it('creates exactly 11 shared materials with the pinned per-family mesh usage', () => {
    const usage = new Map<Material, number>();
    for (const mesh of model.meshes) {
      const material = materialOf(mesh);
      usage.set(material, (usage.get(material) ?? 0) + 1);
    }
    expect(usage.size).toBe(HERO_MATERIAL_COUNT);

    expect(usage.get(materialOf(meshNamed(model, 'hero-hull')))).toBe(4);
    expect(usage.get(materialOf(meshNamed(model, 'hero-hull-underside')))).toBe(1);
    expect(usage.get(materialOf(meshNamed(model, 'hero-nose')))).toBe(10);
    expect(usage.get(materialOf(meshNamed(model, 'hero-hull-seam-1')))).toBe(17);
    expect(usage.get(materialOf(meshNamed(model, 'hero-wingtip-left')))).toBe(6);
    expect(usage.get(materialOf(meshNamed(model, 'hero-cockpit')))).toBe(1);
    expect(usage.get(materialOf(meshNamed(model, 'hero-cockpit-highlight')))).toBe(1);
    expect(usage.get(materialOf(meshNamed(model, 'hero-engine')))).toBe(2);
    expect(usage.get(materialOf(meshNamed(model, 'hero-engine-core')))).toBe(2);
    expect(usage.get(materialOf(meshNamed(model, 'hero-engine-housing-left')))).toBe(2);
    expect(usage.get(materialOf(meshNamed(model, 'hero-engine-nozzle-left')))).toBe(2);
  });

  it('reuses the same instances across each shape family', () => {
    const hull = materialOf(meshNamed(model, 'hero-hull'));
    expect(materialOf(meshNamed(model, 'hero-dorsal-spine'))).toBe(hull);
    expect(materialOf(meshNamed(model, 'hero-wing-left'))).toBe(hull);
    expect(materialOf(meshNamed(model, 'hero-wing-right'))).toBe(hull);

    const mid = materialOf(meshNamed(model, 'hero-nose'));
    expect(materialOf(meshNamed(model, 'hero-cockpit-frame'))).toBe(mid);
    expect(materialOf(meshNamed(model, 'hero-wing-leading-left'))).toBe(mid);
    expect(materialOf(meshNamed(model, 'hero-wing-leading-right'))).toBe(mid);
    expect(materialOf(meshNamed(model, 'hero-engine-rib-left-1'))).toBe(mid);
    expect(materialOf(meshNamed(model, 'hero-engine-rib-right-2'))).toBe(mid);
    expect(materialOf(meshNamed(model, 'hero-antenna-fore'))).toBe(mid);
    expect(materialOf(meshNamed(model, 'hero-antenna-aft'))).toBe(mid);

    const navy = materialOf(meshNamed(model, 'hero-hull-seam-1'));
    expect(materialOf(meshNamed(model, 'hero-hull-seam-2'))).toBe(navy);
    expect(materialOf(meshNamed(model, 'hero-hull-seam-3'))).toBe(navy);
    expect(materialOf(meshNamed(model, 'hero-tail-fin-left'))).toBe(navy);
    expect(materialOf(meshNamed(model, 'hero-tail-fin-right'))).toBe(navy);
    expect(materialOf(meshNamed(model, 'hero-wing-seam-left-1'))).toBe(navy);
    expect(materialOf(meshNamed(model, 'hero-wing-seam-right-3'))).toBe(navy);
    expect(materialOf(meshNamed(model, 'hero-engine-pylon-left'))).toBe(navy);
    expect(materialOf(meshNamed(model, 'hero-engine-pylon-right'))).toBe(navy);
    expect(materialOf(meshNamed(model, 'hero-vent-left'))).toBe(navy);
    expect(materialOf(meshNamed(model, 'hero-greeble-1'))).toBe(navy);
    expect(materialOf(meshNamed(model, 'hero-greeble-2'))).toBe(navy);

    const orange = materialOf(meshNamed(model, 'hero-wingtip-left'));
    expect(materialOf(meshNamed(model, 'hero-wingtip-right'))).toBe(orange);
    expect(materialOf(meshNamed(model, 'hero-tail-fin-tip-left'))).toBe(orange);
    expect(materialOf(meshNamed(model, 'hero-tail-fin-tip-right'))).toBe(orange);
    expect(materialOf(meshNamed(model, 'hero-hull-stripe-left'))).toBe(orange);
    expect(materialOf(meshNamed(model, 'hero-hull-stripe-right'))).toBe(orange);

    const housing = materialOf(meshNamed(model, 'hero-engine-housing-left'));
    expect(materialOf(meshNamed(model, 'hero-engine-housing-right'))).toBe(housing);
    const nozzle = materialOf(meshNamed(model, 'hero-engine-nozzle-left'));
    expect(materialOf(meshNamed(model, 'hero-engine-nozzle-right'))).toBe(nozzle);
    const flame = materialOf(meshNamed(model, 'hero-engine'));
    expect(model.flames.map(materialOf)).toEqual([flame, flame]);
    const core = materialOf(meshNamed(model, 'hero-engine-core'));
    expect(model.flameCores.map(materialOf)).toEqual([core, core]);
  });

  it('pins the hull, light-panel, mid-gray, navy and orange PBR values', () => {
    const hull = physicalMaterialOf(meshNamed(model, 'hero-hull'));
    expect(hull.color.getHex()).toBe(HERO_HULL_COLOR);
    expect(hull.metalness).toBe(0.45);
    expect(hull.roughness).toBe(0.35);
    expect(hull.clearcoat).toBe(0.6);
    expect(hull.clearcoatRoughness).toBe(0.2);

    const light = physicalMaterialOf(meshNamed(model, 'hero-hull-underside'));
    expect(light.color.getHex()).toBe(HERO_PANEL_LIGHT);
    expect(light.metalness).toBe(0.25);
    expect(light.roughness).toBe(0.45);
    expect(light.clearcoat).toBe(0.4);
    expect(light.clearcoatRoughness).toBe(0.25);

    const mid = physicalMaterialOf(meshNamed(model, 'hero-nose'));
    expect(mid.color.getHex()).toBe(HERO_PANEL_MID);
    expect(mid.metalness).toBe(0.4);
    expect(mid.roughness).toBe(0.4);
    expect(mid.clearcoat).toBe(0.3);

    const navy = standardMaterialOf(meshNamed(model, 'hero-hull-seam-1'));
    expect(navy.color.getHex()).toBe(HERO_TRIM_NAVY);
    expect(navy.metalness).toBe(0.5);
    expect(navy.roughness).toBe(0.4);

    const orange = physicalMaterialOf(meshNamed(model, 'hero-wingtip-left'));
    expect(orange.color.getHex()).toBe(HERO_ACCENT_ORANGE);
    expect(orange.emissive.getHex()).toBe(HERO_ACCENT_ORANGE);
    expect(orange.emissiveIntensity).toBe(0.4);
    expect(orange.metalness).toBe(0.3);
    expect(orange.roughness).toBe(0.4);
  });

  it('pins the canopy glass and highlight basic values', () => {
    const canopy = physicalMaterialOf(meshNamed(model, 'hero-cockpit'));
    expect(canopy.color.getHex()).toBe(HERO_CANOPY_COLOR);
    expect(canopy.metalness).toBe(0.2);
    expect(canopy.roughness).toBe(0.08);
    expect(canopy.clearcoat).toBe(1);
    expect(canopy.clearcoatRoughness).toBe(0.08);
    expect(canopy.emissive.getHex()).toBe(0x0a3a44);
    expect(canopy.emissiveIntensity).toBe(0.35);

    const highlight = basicMaterialOf(meshNamed(model, 'hero-cockpit-highlight'));
    expect(highlight.color.getHex()).toBe(HERO_CANOPY_HIGHLIGHT);
    expect(highlight.transparent).toBe(true);
    expect(highlight.opacity).toBe(0.9);
  });

  it('pins the additive flame, white-hot core, housing and nozzle values', () => {
    for (const flame of model.flames) {
      const material = basicMaterialOf(flame);
      expect(material.color.getHex()).toBe(HERO_FLAME_COLOR);
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(0.85);
      expect(material.blending).toBe(AdditiveBlending);
      expect(material.depthWrite).toBe(false);
    }
    for (const core of model.flameCores) {
      const material = basicMaterialOf(core);
      expect(material.color.getHex()).toBe(HERO_FLAME_CORE_COLOR);
    }

    const housing = physicalMaterialOf(meshNamed(model, 'hero-engine-housing-left'));
    expect(housing.color.getHex()).toBe(HERO_ENGINE_HOUSING_COLOR);
    expect(housing.metalness).toBe(0.45);
    expect(housing.roughness).toBe(0.4);
    expect(housing.clearcoat).toBe(0.4);

    const nozzle = standardMaterialOf(meshNamed(model, 'hero-engine-nozzle-left'));
    expect(nozzle.color.getHex()).toBe(HERO_ENGINE_NOZZLE_COLOR);
    expect(nozzle.metalness).toBe(0.6);
    expect(nozzle.roughness).toBe(0.45);
  });
});

describe('hero spaceship dimensions and attitude (AC-5, AC-6)', () => {
  it('measures the pinned wingspan, height and length with the group transform reset', () => {
    const size = withIdentityModel(model, () =>
      new Box3().setFromObject(model.group).getSize(new Vector3()),
    );
    expect(size.x).toBeGreaterThanOrEqual(3.2);
    expect(size.x).toBeLessThanOrEqual(3.4);
    expect(size.y).toBeGreaterThanOrEqual(0.9);
    expect(size.y).toBeLessThanOrEqual(1.1);
    expect(size.z).toBeGreaterThanOrEqual(4.2);
    expect(size.z).toBeLessThanOrEqual(4.8);
  });

  it('puts the nose tip forward of z = 1.9 and the exhaust behind z = -2.0', () => {
    const noseBox = modelLocalBox(model, 'hero-nose');
    expect(noseBox.max.z).toBeGreaterThanOrEqual(1.9);
    for (const flame of model.flames) {
      const flameBox = withIdentityModel(model, () => new Box3().setFromObject(flame));
      expect(flameBox.min.z).toBeLessThanOrEqual(-2.0);
    }
    for (const core of model.flameCores) {
      const coreBox = withIdentityModel(model, () => new Box3().setFromObject(core));
      expect(coreBox.min.z).toBeLessThanOrEqual(-2.1);
    }
  });

  it('yaws and pitches so the nose leads screen-right and above the nacelles', () => {
    const heroGroup = new Group();
    heroGroup.name = 'hero-ship';
    heroGroup.position.set(9, -2.5, -14);
    heroGroup.rotation.y = Math.PI / 2;
    heroGroup.add(model.group);
    heroGroup.updateMatrixWorld(true);

    expect(heroGroup.position.toArray()).toEqual([9, -2.5, -14]);
    expect(heroGroup.rotation.y).toBe(Math.PI / 2);
    expect(model.group.rotation.x).toBe(-HERO_SHIP_PITCH);
    expect(model.group.rotation.y).toBe(HERO_SHIP_YAW);

    const nose = meshNamed(model, 'hero-nose');
    const noseGeometry = nose.geometry as ConeGeometry;
    const noseTip = nose.localToWorld(new Vector3(0, 0, noseGeometry.parameters.height / 2));

    const housingLeft = meshNamed(model, 'hero-engine-housing-left').getWorldPosition(
      new Vector3(),
    );
    const housingRight = meshNamed(model, 'hero-engine-housing-right').getWorldPosition(
      new Vector3(),
    );
    expect(noseTip.x).toBeGreaterThan(housingLeft.x);
    expect(noseTip.x).toBeGreaterThan(housingRight.x);
    expect(noseTip.y - housingLeft.y).toBeGreaterThanOrEqual(0.2);
    expect(noseTip.y - housingRight.y).toBeGreaterThanOrEqual(0.2);

    for (const name of [
      'hero-engine-nozzle-left',
      'hero-engine-nozzle-right',
    ]) {
      const nozzle = meshNamed(model, name).getWorldPosition(new Vector3());
      expect(noseTip.y - nozzle.y).toBeGreaterThanOrEqual(0.2);
    }
  });
});

describe('hero spaceship cockpit and canopy (AC-7)', () => {
  it('places the teal sphere canopy in the front/top half', () => {
    const cockpit = meshNamed(model, 'hero-cockpit');
    expect(cockpit).toBeInstanceOf(Mesh);
    expect(cockpit.geometry).toBeInstanceOf(SphereGeometry);
    expect(cockpit.geometry.type).toBe('SphereGeometry');
    expect(cockpit.position.z).toBeGreaterThanOrEqual(0.7);
    expect(cockpit.position.y).toBeGreaterThanOrEqual(0.25);
    expect(cockpit.position.z).toBe(0.82);
    expect(cockpit.position.y).toBe(0.33);
    expect(physicalMaterialOf(cockpit).color.getHex()).toBe(HERO_CANOPY_COLOR);
    expect(model.meshes.some((mesh) => mesh.name.includes('pilot'))).toBe(false);
  });

  it('wraps the canopy in the mid-gray bezel ring with contained bounds and centres', () => {
    const cockpit = meshNamed(model, 'hero-cockpit');
    const frame = meshNamed(model, 'hero-cockpit-frame');
    const mid = materialOf(meshNamed(model, 'hero-nose'));
    expect(materialOf(frame)).toBe(mid);

    const { cockpitBox, frameBox } = withIdentityModel(model, () => ({
      cockpitBox: new Box3().setFromObject(cockpit),
      frameBox: new Box3().setFromObject(frame),
    }));
    expect(frameBox.min.x).toBeLessThanOrEqual(cockpitBox.min.x);
    expect(frameBox.max.x).toBeGreaterThanOrEqual(cockpitBox.max.x);
    expect(frameBox.min.z).toBeLessThanOrEqual(cockpitBox.min.z);
    expect(frameBox.max.z).toBeGreaterThanOrEqual(cockpitBox.max.z);

    const cockpitCenter = cockpitBox.getCenter(new Vector3());
    const frameCenter = frameBox.getCenter(new Vector3());
    expect(Math.abs(frameCenter.x - cockpitCenter.x)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(frameCenter.z - cockpitCenter.z)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(frame.position.y - cockpit.position.y)).toBeLessThanOrEqual(0.05);
  });

  it('places the bright highlight strip above the canopy glass', () => {
    const cockpit = meshNamed(model, 'hero-cockpit');
    const highlight = meshNamed(model, 'hero-cockpit-highlight');
    expect(highlight.position.y).toBeGreaterThan(cockpit.position.y);
    expect(basicMaterialOf(highlight).color.getHex()).toBe(HERO_CANOPY_HIGHLIGHT);
    expect(basicMaterialOf(highlight).transparent).toBe(true);
    expect(basicMaterialOf(highlight).opacity).toBe(0.9);
  });
});

describe('hero spaceship wings and tail fins (AC-8)', () => {
  it('builds two swept ExtrudeGeometry wings with a 1.25 × 1.4+ planform', () => {
    for (const side of ['left', 'right'] as const) {
      const wing = meshNamed(model, `hero-wing-${side}`);
      expect(wing.geometry).toBeInstanceOf(ExtrudeGeometry);
      expect(materialOf(wing)).toBe(materialOf(meshNamed(model, 'hero-hull')));
      const box = geometryBox(wing);
      expect(box.max.x - box.min.x).toBeGreaterThanOrEqual(HERO_WING_SHAPE_SPAN);
      expect(box.max.y - box.min.y).toBeGreaterThanOrEqual(1.4);
    }
  });

  it('sets gray leading edges on the swept edge and orange wingtips at ±1.65', () => {
    const mid = materialOf(meshNamed(model, 'hero-nose'));
    const orange = materialOf(meshNamed(model, 'hero-wingtip-left'));
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      const leading = meshNamed(model, `hero-wing-leading-${side}`);
      expect(materialOf(leading)).toBe(mid);
      expect(leading.position.x).toBe(sign * 1.03);
      expect(leading.position.y).toBe(0.045);
      expect(leading.position.z).toBe(-0.1);

      const wingtip = meshNamed(model, `hero-wingtip-${side}`);
      expect(materialOf(wingtip)).toBe(orange);
      expect(wingtip.position.x).toBe(sign * HERO_WINGTIP_X);
      expect(wingtip.position.y).toBe(0);
    }
  });

  it('builds canted navy tail fins with orange tips at the fin tops', () => {
    const navy = materialOf(meshNamed(model, 'hero-hull-seam-1'));
    const orange = materialOf(meshNamed(model, 'hero-wingtip-left'));
    for (const side of ['left', 'right'] as const) {
      const fin = meshNamed(model, `hero-tail-fin-${side}`);
      expect(materialOf(fin)).toBe(navy);
      expect(fin.position.z).toBeLessThanOrEqual(-1.2);
      expect(fin.position.z).toBe(-1.25);
      expect(fin.geometry).toBeInstanceOf(BoxGeometry);
      const height = (fin.geometry as BoxGeometry).parameters.height;
      expect(height).toBeGreaterThanOrEqual(0.5);
      expect(height).toBe(0.55);
      expect(fin.position.y + height / 2).toBeGreaterThanOrEqual(0.55);

      const tip = meshNamed(model, `hero-tail-fin-tip-${side}`);
      expect(materialOf(tip)).toBe(orange);
      expect(tip.position.y).toBeGreaterThan(fin.position.y + height / 2);
      expect(tip.position.y).toBe(0.65);
    }
  });
});

describe('hero spaceship engines and exhaust (AC-9)', () => {
  it('places two 12-segment housing cylinders at the pinned nacelle centres', () => {
    const housingMaterial = materialOf(meshNamed(model, 'hero-engine-housing-left'));
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      const housing = meshNamed(model, `hero-engine-housing-${side}`);
      expect(housing.geometry).toBeInstanceOf(CylinderGeometry);
      expect(materialOf(housing)).toBe(housingMaterial);
      expect((housing.geometry as CylinderGeometry).parameters.radialSegments).toBe(12);
      expect((housing.geometry as CylinderGeometry).parameters.radialSegments).toBeGreaterThanOrEqual(
        10,
      );
      expect(housing.position.x).toBe(sign * 1.1);
      expect(housing.position.y).toBe(-0.05);
      expect(housing.position.z).toBe(-1.0);
    }
  });

  it('rings each nacelle with two mid-gray torus ribs', () => {
    const mid = materialOf(meshNamed(model, 'hero-nose'));
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      for (const index of [1, 2] as const) {
        const rib = meshNamed(model, `hero-engine-rib-${side}-${index}`);
        expect(rib.geometry).toBeInstanceOf(TorusGeometry);
        expect(materialOf(rib)).toBe(mid);
        expect(rib.position.x).toBe(sign * 1.1);
        expect(rib.position.y).toBe(-0.05);
      }
      expect(meshNamed(model, `hero-engine-rib-${side}-1`).position.z).toBe(-0.75);
      expect(meshNamed(model, `hero-engine-rib-${side}-2`).position.z).toBe(-1.25);
    }
  });

  it('ends each nacelle in a dark nozzle and two additive flames with cores', () => {
    const nozzleMaterial = materialOf(meshNamed(model, 'hero-engine-nozzle-left'));
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      const nozzle = meshNamed(model, `hero-engine-nozzle-${side}`);
      expect(materialOf(nozzle)).toBe(nozzleMaterial);
      expect(nozzle.geometry).toBeInstanceOf(CylinderGeometry);
      expect(nozzle.position.x).toBe(sign * 1.1);
      expect(nozzle.position.y).toBe(-0.05);
      expect(nozzle.position.z).toBeLessThan(0);
    }

    expect(model.flames).toHaveLength(2);
    expect(model.flameCores).toHaveLength(2);
    const flameMaterial = materialOf(model.flames[0]!);
    const coreMaterial = materialOf(model.flameCores[0]!);
    for (const flame of model.flames) {
      expect(flame.geometry).toBeInstanceOf(ConeGeometry);
      expect(materialOf(flame)).toBe(flameMaterial);
      expect(flame.position.y).toBe(-0.05);
      expect(flame.position.z).toBeLessThanOrEqual(-2.0);
      expect(flame.position.z).toBe(-2.05);
      expect(Math.abs(flame.position.x)).toBe(1.1);
      expect(basicMaterialOf(flame).blending).toBe(AdditiveBlending);
      expect(basicMaterialOf(flame).depthWrite).toBe(false);
    }
    for (const core of model.flameCores) {
      expect(core.geometry).toBeInstanceOf(ConeGeometry);
      expect(materialOf(core)).toBe(coreMaterial);
      expect(core.position.y).toBe(-0.05);
      expect(core.position.z).toBeLessThanOrEqual(-2.1);
      expect(core.position.z).toBe(-2.15);
      expect(Math.abs(core.position.x)).toBe(1.1);
    }
    expect(model.flames[0]!.position.x).toBe(-1.1);
    expect(model.flames[1]!.position.x).toBe(1.1);
  });

  it('connects each nacelle to the hull with a navy pylon', () => {
    const navy = materialOf(meshNamed(model, 'hero-hull-seam-1'));
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      const pylon = meshNamed(model, `hero-engine-pylon-${side}`);
      expect(materialOf(pylon)).toBe(navy);
      expect(pylon.position.x).toBe(sign * 0.62);
      expect(pylon.position.z).toBe(-0.9);
    }
  });
});

describe('hero spaceship surface detail (AC-10)', () => {
  it('builds exactly three hull seams, six wing seams, two vents, two antennae and two greebles', () => {
    expect(
      model.meshes.filter((mesh) => mesh.name.startsWith('hero-hull-seam-')),
    ).toHaveLength(3);
    expect(
      model.meshes.filter((mesh) => mesh.name.startsWith('hero-wing-seam-')),
    ).toHaveLength(6);
    expect(model.meshes.filter((mesh) => mesh.name.startsWith('hero-vent-'))).toHaveLength(2);
    expect(model.meshes.filter((mesh) => mesh.name.startsWith('hero-antenna-'))).toHaveLength(2);
    expect(model.meshes.filter((mesh) => mesh.name.startsWith('hero-greeble-'))).toHaveLength(2);
    expect(model.meshes.filter((mesh) => mesh.name.startsWith('hero-hull-stripe-'))).toHaveLength(
      2,
    );
  });

  it('keeps every seam, vent, antenna and greeble thin in model-local geometry units', () => {
    const detailNames = model.meshes
      .map((mesh) => mesh.name)
      .filter((name) => /^hero-(hull-seam|wing-seam|vent|antenna|greeble)-/.test(name));
    expect(detailNames).toHaveLength(15);

    const navy = materialOf(meshNamed(model, 'hero-hull-seam-1'));
    const mid = materialOf(meshNamed(model, 'hero-nose'));
    for (const name of detailNames) {
      const mesh = meshNamed(model, name);
      const geometry = mesh.geometry;
      const isBoxOrCylinder =
        geometry instanceof BoxGeometry || geometry instanceof CylinderGeometry;
      expect(isBoxOrCylinder).toBe(true);
      const size = geometryBox(mesh).getSize(new Vector3());
      expect(Math.min(size.x, size.y, size.z)).toBeLessThanOrEqual(0.06);
      const material = materialOf(mesh);
      expect(material === navy || material === mid).toBe(true);
    }
  });

  it('offsets the detail strips at least HERO_DETAIL_OFFSET from their base surfaces', () => {
    const wingTop = modelLocalBox(model, 'hero-wing-left').max.y;
    const wingSeamBottom = modelLocalBox(model, 'hero-wing-seam-left-1').min.y;
    expect(wingSeamBottom - wingTop).toBeGreaterThanOrEqual(HERO_DETAIL_OFFSET);

    const spineTop = modelLocalBox(model, 'hero-dorsal-spine').max.y;
    const greebleBottom = modelLocalBox(model, 'hero-greeble-1').min.y;
    expect(greebleBottom - spineTop).toBeGreaterThanOrEqual(HERO_DETAIL_OFFSET);

    const antennaBottom = modelLocalBox(model, 'hero-antenna-fore').min.y;
    expect(antennaBottom - spineTop).toBeGreaterThanOrEqual(HERO_DETAIL_OFFSET);
  });

  it('paints both hull stripes with the orange accent material', () => {
    const orange = materialOf(meshNamed(model, 'hero-wingtip-left'));
    for (const side of ['left', 'right'] as const) {
      const stripe = meshNamed(model, `hero-hull-stripe-${side}`);
      expect(materialOf(stripe)).toBe(orange);
    }
  });
});

describe('hero spaceship disposal (AC-2)', () => {
  it('disposes every unique geometry/material once, clears the group and is idempotent', () => {
    const geometries = new Set(model.meshes.map((mesh) => mesh.geometry));
    const materials = new Set(model.meshes.map((mesh) => materialOf(mesh)));
    expect(geometries.size).toBe(48);
    expect(materials.size).toBe(HERO_MATERIAL_COUNT);

    const geometrySpies = [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const materialSpies = [...materials].map((material) => vi.spyOn(material, 'dispose'));

    const parent = new Group();
    parent.add(model.group);
    model.dispose();

    expect(parent.children).toEqual([]);
    expect(model.group.parent).toBeNull();
    expect(model.group.children).toEqual([]);
    expect(model.meshes).toEqual([]);
    expect(model.flames).toEqual([]);
    expect(model.flameCores).toEqual([]);
    for (const spy of [...geometrySpies, ...materialSpies]) {
      expect(spy).toHaveBeenCalledTimes(1);
    }

    model.dispose();
    for (const spy of [...geometrySpies, ...materialSpies]) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });
});
