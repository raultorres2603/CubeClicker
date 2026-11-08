/**
 * Tests for the procedural cursor ship model factory
 * (spaceship-cursor-loot-animations T8; spec AC-1…AC-4).
 *
 * Contract covered: factory shape and object counts, the exact ten-slot/twenty-one-mesh map,
 * the nineteen shared materials and their pinned AC-4 values, model-local dimensions and rest
 * pose, per-slot appearance mapping (colour/accent/shape, legacy aliases, idempotence), the
 * absence of lights/textures/loaders/DOM/randomness, and dispose-once/idempotence. Assertions
 * use concrete expected values; no snapshot or wildcard matchers.
 */

import { readFileSync } from 'node:fs';

import {
  Box3,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Light,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
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
  SLOT_CATALOG,
  type PartVisual,
  type SlotId,
} from '../game/parts-v2';
import {
  CURSOR_CANOPY_CLEARCOAT,
  CURSOR_CANOPY_CLEARCOAT_ROUGHNESS,
  CURSOR_CANOPY_METALNESS,
  CURSOR_CANOPY_ROUGHNESS,
  CURSOR_CLEARCOAT_ROUGHNESS,
  CURSOR_IGNITION_OPACITY,
  CURSOR_SHIP_HEIGHT,
  CURSOR_SHIP_LENGTH,
  CURSOR_SHIP_MATERIAL_COUNT,
  CURSOR_SHIP_MAX_TRIANGLES,
  CURSOR_SHIP_MESH_COUNT,
  CURSOR_SHIP_MODEL_OBJECT_COUNT,
  CURSOR_SHIP_SLOT_COUNT,
  CURSOR_SHIP_WIDTH,
  CURSOR_SLOT_SHAPE_TRANSFORMS,
  CURSOR_STRUCTURAL_CLEARCOAT,
  CURSOR_STRUCTURAL_METALNESS,
  CURSOR_STRUCTURAL_ROUGHNESS,
  createCursorShipModel,
  type CursorShipModel,
} from './cursor-ship';

/** The exact AC-2 name→count map: 19 distinct names, 21 meshes. */
const EXPECTED_MESH_COUNTS: Readonly<Record<string, number>> = {
  'cursor-hull': 1,
  'cursor-hull-underside': 1,
  'cursor-nose': 1,
  'cursor-cockpit': 1,
  'cursor-cockpit-frame': 1,
  'cursor-cockpit-highlight': 1,
  'cursor-wing-left': 1,
  'cursor-wing-left-tip': 1,
  'cursor-wing-right': 1,
  'cursor-wing-right-tip': 1,
  'cursor-engine-left': 1,
  'cursor-engine-left-nozzle': 1,
  'cursor-engine-right': 1,
  'cursor-engine-right-nozzle': 1,
  ignition: 2,
  'cursor-tail-fin': 1,
  'cursor-hull-seam-1': 1,
  'cursor-hull-seam-2': 1,
  'cursor-vent-left': 1,
  'cursor-vent-right': 1,
};

/** The exact slot→mesh mapping (build order inside each slot group). */
const EXPECTED_SLOT_MESHES: Readonly<Record<SlotId, readonly string[]>> = {
  hull: [
    'cursor-hull',
    'cursor-hull-underside',
    'cursor-hull-seam-1',
    'cursor-hull-seam-2',
    'cursor-vent-left',
    'cursor-vent-right',
  ],
  nose: ['cursor-nose'],
  cockpit: ['cursor-cockpit', 'cursor-cockpit-frame', 'cursor-cockpit-highlight'],
  'wing-left': ['cursor-wing-left', 'cursor-wing-left-tip'],
  'wing-right': ['cursor-wing-right', 'cursor-wing-right-tip'],
  'engine-left': ['cursor-engine-left', 'cursor-engine-left-nozzle'],
  'engine-right': ['cursor-engine-right', 'cursor-engine-right-nozzle'],
  'ignition-left': ['ignition'],
  'ignition-right': ['ignition'],
  'tail-fin': ['cursor-tail-fin'],
};

/** The exact shape-transform table (10 slots, standard/rare/epic shape keys). */
const EXPECTED_SHAPE_TRANSFORMS = {
  hull: {
    standard: { scale: [1, 1, 1], rotation: [0, 0, 0] },
    armored: { scale: [1.06, 1.1, 1.02], rotation: [0, 0, 0] },
    solar: { scale: [0.96, 1.02, 1.05], rotation: [0, 0, 0] },
  },
  nose: {
    standard: { scale: [1, 1, 1], rotation: [0, 0, 0] },
    lance: { scale: [0.9, 0.9, 1.18], rotation: [0, 0, 0] },
    photon: { scale: [1.08, 1.08, 0.98], rotation: [0, 0, 0] },
  },
  cockpit: {
    standard: { scale: [1, 1, 1], rotation: [0, 0, 0] },
    razor: { scale: [0.88, 1.12, 0.94], rotation: [0, 0, 0] },
    oracle: { scale: [1.12, 1.04, 1.14], rotation: [0, 0, 0] },
  },
  'wing-left': {
    standard: { scale: [1, 1, 1], rotation: [0, 0, 0] },
    razor: { scale: [1.16, 1, 0.9], rotation: [0, -0.12, 0] },
    solar: { scale: [1.08, 1.2, 1.04], rotation: [0, 0, 0] },
  },
  'wing-right': {
    standard: { scale: [1, 1, 1], rotation: [0, 0, 0] },
    razor: { scale: [1.16, 1, 0.9], rotation: [0, 0.12, 0] },
    solar: { scale: [1.08, 1.2, 1.04], rotation: [0, 0, 0] },
  },
  'engine-left': {
    standard: { scale: [1, 1, 1], rotation: [0, 0, 0] },
    boxed: { scale: [1.1, 1.1, 0.92], rotation: [0, 0, 0] },
    nova: { scale: [1.18, 1.18, 1.04], rotation: [0, 0, 0] },
  },
  'engine-right': {
    standard: { scale: [1, 1, 1], rotation: [0, 0, 0] },
    boxed: { scale: [1.1, 1.1, 0.92], rotation: [0, 0, 0] },
    nova: { scale: [1.18, 1.18, 1.04], rotation: [0, 0, 0] },
  },
  'ignition-left': {
    standard: { scale: [1, 1, 1], rotation: [0, 0, 0] },
    ion: { scale: [0.9, 0.9, 1.3], rotation: [0, 0, 0] },
    plasma: { scale: [1.18, 1.18, 1.12], rotation: [0, 0, 0] },
  },
  'ignition-right': {
    standard: { scale: [1, 1, 1], rotation: [0, 0, 0] },
    ion: { scale: [0.9, 0.9, 1.3], rotation: [0, 0, 0] },
    plasma: { scale: [1.18, 1.18, 1.12], rotation: [0, 0, 0] },
  },
  'tail-fin': {
    standard: { scale: [1, 1, 1], rotation: [0, 0, 0] },
    split: { scale: [1.5, 1, 0.86], rotation: [0, 0, 0] },
    comet: { scale: [1.05, 1.22, 1.12], rotation: [0, 0, 0] },
  },
};

/** The exact mixed rare/epic appearance used by the appearance tests. */
const MIXED_APPEARANCE: Readonly<Record<SlotId, string>> = {
  hull: 'hull-gold',
  nose: 'nose-crimson',
  cockpit: 'cockpit-oracle',
  'wing-left': 'wing-left-silver',
  'wing-right': 'wing-right-gold',
  'engine-left': 'engine-left-vector',
  'engine-right': 'engine-right-nova',
  'ignition-left': 'ignition-left-blue',
  'ignition-right': 'ignition-right-plasma',
  'tail-fin': 'tail-fin-comet',
};

/** Counts the root and every descendant (the AC-1 32-object subtree semantics). */
function countObjects(root: Object3D): number {
  return 1 + root.children.reduce((total, child) => total + countObjects(child), 0);
}

/** Finds one named mesh, failing loudly when it is missing. */
function meshNamed(model: CursorShipModel, name: string): Mesh {
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

/** Narrows a mesh's material to `MeshBasicMaterial`. */
function basicMaterialOf(mesh: Mesh): MeshBasicMaterial {
  const material = materialOf(mesh);
  if (!(material instanceof MeshBasicMaterial)) {
    throw new Error(`mesh ${mesh.name} must use a MeshBasicMaterial`);
  }
  return material;
}

/** Asserts the pinned AC-4 structural finish on one material. */
function expectStructuralFinish(material: MeshPhysicalMaterial): void {
  expect(material.metalness).toBe(CURSOR_STRUCTURAL_METALNESS);
  expect(material.metalness).toBe(0.55);
  expect(material.roughness).toBe(CURSOR_STRUCTURAL_ROUGHNESS);
  expect(material.roughness).toBe(0.38);
  expect(material.clearcoat).toBe(CURSOR_STRUCTURAL_CLEARCOAT);
  expect(material.clearcoat).toBe(0.4);
  expect(material.clearcoatRoughness).toBe(CURSOR_CLEARCOAT_ROUGHNESS);
  expect(material.clearcoatRoughness).toBe(0.2);
}

/** Model-local `Box3` of one named mesh, with the model group transform reset to identity. */
function modelLocalBox(model: CursorShipModel, name: string): Box3 {
  const { group } = model;
  const scale = group.scale.clone();
  const rotation = group.rotation.clone();
  group.scale.set(1, 1, 1);
  group.rotation.set(0, 0, 0);
  group.updateMatrixWorld(true);
  try {
    return new Box3().setFromObject(meshNamed(model, name));
  } finally {
    group.scale.copy(scale);
    group.rotation.copy(rotation);
    group.updateMatrixWorld(true);
  }
}

/** All distinct materials under the model, keyed by instance. */
function materialUsage(model: CursorShipModel): Map<Material, number> {
  const usage = new Map<Material, number>();
  for (const mesh of model.meshes) {
    const material = materialOf(mesh);
    usage.set(material, (usage.get(material) ?? 0) + 1);
  }
  return usage;
}

let model: CursorShipModel;

beforeEach(() => {
  model = createCursorShipModel();
});

afterEach(() => {
  model.dispose();
});

describe('cursor ship pinned constants (AC-1, AC-3, AC-4)', () => {
  it('exports the pinned counts, dimensions, budget and finish values', () => {
    expect(CURSOR_SHIP_SLOT_COUNT).toBe(10);
    expect(CURSOR_SHIP_MESH_COUNT).toBe(21);
    expect(CURSOR_SHIP_MATERIAL_COUNT).toBe(19);
    expect(CURSOR_SHIP_MODEL_OBJECT_COUNT).toBe(32);
    expect(CURSOR_SHIP_MAX_TRIANGLES).toBe(2500);
    expect(CURSOR_SHIP_LENGTH).toBe(1.4);
    expect(CURSOR_SHIP_WIDTH).toBe(0.9);
    expect(CURSOR_SHIP_HEIGHT).toBe(0.4);
    expect(CURSOR_STRUCTURAL_METALNESS).toBe(0.55);
    expect(CURSOR_STRUCTURAL_ROUGHNESS).toBe(0.38);
    expect(CURSOR_STRUCTURAL_CLEARCOAT).toBe(0.4);
    expect(CURSOR_CLEARCOAT_ROUGHNESS).toBe(0.2);
    expect(CURSOR_CANOPY_METALNESS).toBe(0.2);
    expect(CURSOR_CANOPY_ROUGHNESS).toBe(0.08);
    expect(CURSOR_CANOPY_CLEARCOAT).toBe(1);
    expect(CURSOR_CANOPY_CLEARCOAT_ROUGHNESS).toBe(0.08);
    expect(CURSOR_IGNITION_OPACITY).toBe(0.55);
  });

  it('exports the exact per-slot shape transform table', () => {
    expect(CURSOR_SLOT_SHAPE_TRANSFORMS).toEqual(EXPECTED_SHAPE_TRANSFORMS);
  });
});

describe('cursor ship model contract (AC-1, AC-2)', () => {
  it('is a parameter-free factory that builds a `cursor-ship-model` root at identity', () => {
    expect(createCursorShipModel).toHaveLength(0);
    expect(model.group).toBeInstanceOf(Group);
    expect(model.group.name).toBe('cursor-ship-model');
    expect(model.group.parent).toBeNull();
    expect(model.group.position.toArray()).toEqual([0, 0, 0]);
    expect(model.group.scale.toArray()).toEqual([1, 1, 1]);
    expect(model.group.rotation.toArray()).toEqual([0, 0, 0, 'XYZ']);
  });

  it('contains exactly the ten slot groups in SLOT_CATALOG order', () => {
    expect(model.group.children).toHaveLength(CURSOR_SHIP_SLOT_COUNT);
    expect(model.slotGroups).toHaveLength(CURSOR_SHIP_SLOT_COUNT);
    expect(model.slotGroups.map((group) => group.name)).toEqual([
      'slot-hull',
      'slot-nose',
      'slot-cockpit',
      'slot-wing-left',
      'slot-wing-right',
      'slot-engine-left',
      'slot-engine-right',
      'slot-ignition-left',
      'slot-ignition-right',
      'slot-tail-fin',
    ]);
    expect(model.group.children.map((child) => child.name)).toEqual(
      model.slotGroups.map((group) => group.name),
    );
    expect(Object.keys(model.slots)).toEqual(SLOT_CATALOG.map((slot) => slot.id));
    for (const slot of SLOT_CATALOG) {
      const group = model.slots[slot.id];
      expect(group).toBeInstanceOf(Group);
      expect(group.name).toBe(`slot-${slot.id}`);
      expect(group.parent).toBe(model.group);
      expect(model.slotGroups[SLOT_CATALOG.indexOf(slot)]).toBe(group);
    }
  });

  it('holds exactly the AC-2 name→count mesh map (20 names, 21 meshes)', () => {
    const counts: Record<string, number> = {};
    for (const mesh of model.meshes) {
      counts[mesh.name] = (counts[mesh.name] ?? 0) + 1;
    }
    expect(counts).toEqual(EXPECTED_MESH_COUNTS);
    expect(Object.keys(counts)).toHaveLength(20);
    expect(model.meshes).toHaveLength(CURSOR_SHIP_MESH_COUNT);
    expect(new Set(model.meshes).size).toBe(CURSOR_SHIP_MESH_COUNT);
    for (const mesh of model.meshes) {
      expect(mesh).toBeInstanceOf(Mesh);
      expect(Array.isArray(mesh.material)).toBe(false);
    }
  });

  it('maps every mesh into its slot group in the exact build order', () => {
    for (const slot of SLOT_CATALOG) {
      const group = model.slots[slot.id];
      expect(group.children.map((child) => child.name)).toEqual(
        EXPECTED_SLOT_MESHES[slot.id],
      );
      for (const child of group.children) {
        expect(child).toBeInstanceOf(Mesh);
        expect(model.meshes).toContain(child);
      }
    }
    const placed = SLOT_CATALOG.flatMap((slot) => model.slots[slot.id].children);
    expect(placed).toHaveLength(CURSOR_SHIP_MESH_COUNT);
    expect(new Set(placed).size).toBe(CURSOR_SHIP_MESH_COUNT);
    expect(placed).toEqual(model.meshes);
  });

  it('reports the pinned 32-object model subtree', () => {
    expect(countObjects(model.group)).toBe(CURSOR_SHIP_MODEL_OBJECT_COUNT);
    expect(countObjects(model.group)).toBe(32);
  });

  it('exposes the two ignition meshes inside their ignition slot groups', () => {
    expect(model.ignitions).toHaveLength(2);
    expect(model.ignitions.map((mesh) => mesh.name)).toEqual(['ignition', 'ignition']);
    expect(model.ignitions[0]!.parent).toBe(model.slots['ignition-left']);
    expect(model.ignitions[1]!.parent).toBe(model.slots['ignition-right']);
    expect(model.ignitions[0]!.visible).toBe(false);
    expect(model.ignitions[1]!.visible).toBe(false);
    for (const ignition of model.ignitions) {
      expect(model.meshes).toContain(ignition);
    }
  });

  it('computes a positive triangle count inside the 2,500 budget', () => {
    expect(model.triangleCount).toBe(776);
    expect(model.triangleCount).toBeGreaterThan(0);
    expect(model.triangleCount).toBeLessThanOrEqual(CURSOR_SHIP_MAX_TRIANGLES);
  });

  it('shares exactly 19 material instances across the 21 meshes', () => {
    expect(model.materialCount).toBe(CURSOR_SHIP_MATERIAL_COUNT);
    expect(model.materialCount).toBe(19);
    const usage = materialUsage(model);
    expect(usage.size).toBe(CURSOR_SHIP_MATERIAL_COUNT);

    const seamMaterial = materialOf(meshNamed(model, 'cursor-hull-seam-1'));
    const ventMaterial = materialOf(meshNamed(model, 'cursor-vent-left'));
    expect(materialOf(meshNamed(model, 'cursor-hull-seam-2'))).toBe(seamMaterial);
    expect(materialOf(meshNamed(model, 'cursor-vent-right'))).toBe(ventMaterial);
    expect(usage.get(seamMaterial)).toBe(2);
    expect(usage.get(ventMaterial)).toBe(2);

    let singleUse = 0;
    for (const [material, count] of usage) {
      if (material === seamMaterial || material === ventMaterial) {
        expect(count).toBe(2);
      } else {
        expect(count).toBe(1);
        singleUse += 1;
      }
    }
    expect(singleUse).toBe(17);
  });

  it('casts and receives no shadows', () => {
    for (const mesh of model.meshes) {
      expect(mesh.castShadow).toBe(false);
      expect(mesh.receiveShadow).toBe(false);
    }
  });

  it('is deterministic across two fresh factories', () => {
    const other = createCursorShipModel();
    expect(other.triangleCount).toBe(model.triangleCount);
    expect(other.materialCount).toBe(model.materialCount);
    expect(other.meshes.map((mesh) => mesh.name)).toEqual(
      model.meshes.map((mesh) => mesh.name),
    );
    expect(other.slotGroups.map((group) => group.name)).toEqual(
      model.slotGroups.map((group) => group.name),
    );
    other.dispose();
  });
});

describe('cursor ship materials (AC-4)', () => {
  it('pins the AC-4 finish on every structural mesh, including seams, vents and nozzles', () => {
    const structuralMeshes = [
      'cursor-hull',
      'cursor-hull-underside',
      'cursor-nose',
      'cursor-cockpit-frame',
      'cursor-wing-left',
      'cursor-wing-left-tip',
      'cursor-wing-right',
      'cursor-wing-right-tip',
      'cursor-engine-left',
      'cursor-engine-left-nozzle',
      'cursor-engine-right',
      'cursor-engine-right-nozzle',
      'cursor-tail-fin',
      'cursor-hull-seam-1',
      'cursor-vent-left',
    ];
    for (const name of structuralMeshes) {
      expectStructuralFinish(physicalMaterialOf(meshNamed(model, name)));
    }
    expectStructuralFinish(
      physicalMaterialOf(meshNamed(model, 'cursor-hull-seam-2')),
    );
    expectStructuralFinish(physicalMaterialOf(meshNamed(model, 'cursor-vent-right')));
  });

  it('uses the pinned canopy glass finish and a basic canopy highlight', () => {
    const canopy = physicalMaterialOf(meshNamed(model, 'cursor-cockpit'));
    expect(canopy.color.getHex()).toBe(0x0b2f38);
    expect(canopy.metalness).toBe(0.2);
    expect(canopy.roughness).toBe(0.08);
    expect(canopy.clearcoat).toBe(1);
    expect(canopy.clearcoatRoughness).toBe(0.08);
    expect(canopy.transparent).toBe(false);

    const highlight = basicMaterialOf(meshNamed(model, 'cursor-cockpit-highlight'));
    expect(highlight.color.getHex()).toBe(0xcffcff);

    const frame = physicalMaterialOf(meshNamed(model, 'cursor-cockpit-frame'));
    expect(frame.color.getHex()).toBe(0xcffcff);
  });

  it('builds two transparent emissive ignitions with the part colour and 0.55 opacity', () => {
    for (const ignition of model.ignitions) {
      const material = physicalMaterialOf(ignition);
      expect(material.emissive.getHex()).toBe(0xff6600);
      expect(material.color.getHex()).toBe(0xffcc66);
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(0.55);
      expectStructuralFinish(material);
    }
  });

  it('maps the default appearance onto the exact per-slot colours and accents', () => {
    expect(physicalMaterialOf(meshNamed(model, 'cursor-hull')).color.getHex()).toBe(0x8f9bad);
    expect(
      physicalMaterialOf(meshNamed(model, 'cursor-hull-underside')).color.getHex(),
    ).toBe(0x8f9bad);
    expect(
      physicalMaterialOf(meshNamed(model, 'cursor-hull-seam-1')).color.getHex(),
    ).toBe(0x2f6fd6);
    expect(physicalMaterialOf(meshNamed(model, 'cursor-vent-left')).color.getHex()).toBe(
      0x2f6fd6,
    );
    expect(physicalMaterialOf(meshNamed(model, 'cursor-nose')).color.getHex()).toBe(0x88aaff);
    expect(physicalMaterialOf(meshNamed(model, 'cursor-cockpit')).color.getHex()).toBe(
      0x0b2f38,
    );
    expect(physicalMaterialOf(meshNamed(model, 'cursor-wing-left')).color.getHex()).toBe(
      0x4466cc,
    );
    expect(physicalMaterialOf(meshNamed(model, 'cursor-wing-left-tip')).color.getHex()).toBe(
      0x8f9bad,
    );
    expect(physicalMaterialOf(meshNamed(model, 'cursor-wing-right')).color.getHex()).toBe(
      0x4466cc,
    );
    expect(physicalMaterialOf(meshNamed(model, 'cursor-wing-right-tip')).color.getHex()).toBe(
      0x8f9bad,
    );
    expect(physicalMaterialOf(meshNamed(model, 'cursor-engine-left')).color.getHex()).toBe(
      0x35507a,
    );
    expect(
      physicalMaterialOf(meshNamed(model, 'cursor-engine-left-nozzle')).color.getHex(),
    ).toBe(0x1a2333);
    expect(physicalMaterialOf(meshNamed(model, 'cursor-engine-right')).color.getHex()).toBe(
      0x35507a,
    );
    expect(
      physicalMaterialOf(meshNamed(model, 'cursor-engine-right-nozzle')).color.getHex(),
    ).toBe(0x1a2333);
    expect(physicalMaterialOf(meshNamed(model, 'cursor-tail-fin')).color.getHex()).toBe(
      0x14213d,
    );
    expect(physicalMaterialOf(model.ignitions[0]!).emissive.getHex()).toBe(0xff6600);
    expect(physicalMaterialOf(model.ignitions[1]!).emissive.getHex()).toBe(0xff6600);
  });

  it('references no texture on any material', () => {
    for (const mesh of model.meshes) {
      const material = materialOf(mesh);
      for (const value of Object.values(material)) {
        expect(value instanceof Texture).toBe(false);
      }
    }
  });
});

describe('cursor ship dimensions and rest pose (AC-3)', () => {
  it('measures 1.4 x 0.9 x 0.4 model-local units within the AC-3 ranges', () => {
    const size = new Box3().setFromObject(model.group).getSize(new Vector3());
    expect(size.z).toBeGreaterThanOrEqual(1.3);
    expect(size.z).toBeLessThanOrEqual(1.5);
    expect(size.x).toBeGreaterThanOrEqual(0.8);
    expect(size.x).toBeLessThanOrEqual(1.0);
    expect(size.y).toBeGreaterThanOrEqual(0.3);
    expect(size.y).toBeLessThanOrEqual(0.5);
  });

  it('pins the fuselage, nose and underside geometry', () => {
    const nose = meshNamed(model, 'cursor-nose');
    expect(nose.geometry).toBeInstanceOf(ConeGeometry);
    const noseParameters = (nose.geometry as ConeGeometry).parameters;
    expect(noseParameters.radius).toBe(0.16);
    expect(noseParameters.height).toBe(0.45);
    expect(noseParameters.radialSegments).toBe(12);
    expect(nose.position.toArray()).toEqual([0, 0, 0.475]);

    const hull = meshNamed(model, 'cursor-hull');
    expect(hull.geometry).toBeInstanceOf(CylinderGeometry);
    const hullParameters = (hull.geometry as CylinderGeometry).parameters;
    expect(hullParameters.radiusTop).toBe(0.16);
    expect(hullParameters.radiusBottom).toBe(0.16);
    expect(hullParameters.height).toBe(0.75);
    expect(hullParameters.radialSegments).toBe(12);
    expect(hull.position.toArray()).toEqual([0, 0, -0.125]);

    const underside = meshNamed(model, 'cursor-hull-underside');
    expect(underside.geometry).toBeInstanceOf(BoxGeometry);
    const undersideParameters = (underside.geometry as BoxGeometry).parameters;
    expect(undersideParameters.width).toBe(0.24);
    expect(undersideParameters.height).toBe(0.09);
    expect(undersideParameters.depth).toBe(0.7);
    expect(underside.position.toArray()).toEqual([0, -0.155, -0.125]);
  });

  it('puts the nose tip forward at z >= 0.65 and the flames behind z <= -0.6', () => {
    const noseBox = modelLocalBox(model, 'cursor-nose');
    expect(noseBox.max.z).toBeGreaterThanOrEqual(0.65);
    for (const ignition of model.ignitions) {
      const flameBox = new Box3().setFromObject(ignition);
      expect(flameBox.min.z).toBeLessThanOrEqual(-0.6);
    }
    expect(noseBox.max.z).toBeGreaterThan(modelLocalBox(model, 'cursor-tail-fin').max.z);
  });

  it('pins the swept wings, tip caps and engine pair transforms', () => {
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      const wing = meshNamed(model, `cursor-wing-${side}`);
      expect(wing.geometry).toBeInstanceOf(BoxGeometry);
      const wingParameters = (wing.geometry as BoxGeometry).parameters;
      expect(wingParameters.width).toBe(0.34);
      expect(wingParameters.height).toBe(0.035);
      expect(wingParameters.depth).toBe(0.26);
      expect(wing.position.toArray()).toEqual([sign * 0.245, -0.01, -0.12]);
      expect(wing.rotation.y).toBe(sign * 0.18);

      const tip = meshNamed(model, `cursor-wing-${side}-tip`);
      expect(tip.geometry).toBeInstanceOf(BoxGeometry);
      const tipParameters = (tip.geometry as BoxGeometry).parameters;
      expect(tipParameters.width).toBe(0.09);
      expect(tipParameters.height).toBe(0.03);
      expect(tipParameters.depth).toBe(0.13);
      expect(tip.position.toArray()).toEqual([sign * 0.405, 0, -0.15]);

      const engine = meshNamed(model, `cursor-engine-${side}`);
      expect(engine.geometry).toBeInstanceOf(CylinderGeometry);
      const engineParameters = (engine.geometry as CylinderGeometry).parameters;
      expect(engineParameters.radiusTop).toBe(0.055);
      expect(engineParameters.radiusBottom).toBe(0.055);
      expect(engineParameters.height).toBe(0.22);
      expect(engine.position.toArray()).toEqual([sign * 0.12, -0.03, -0.42]);

      const nozzle = meshNamed(model, `cursor-engine-${side}-nozzle`);
      expect(nozzle.geometry).toBeInstanceOf(CylinderGeometry);
      const nozzleParameters = (nozzle.geometry as CylinderGeometry).parameters;
      expect(nozzleParameters.height).toBe(0.035);
      expect(nozzleParameters.height).toBeLessThanOrEqual(0.04);
      expect(nozzle.position.toArray()).toEqual([sign * 0.12, -0.03, -0.55]);
    }
  });

  it('pins the cockpit canopy, frame and highlight', () => {
    const canopy = meshNamed(model, 'cursor-cockpit');
    expect(canopy.geometry).toBeInstanceOf(SphereGeometry);
    const canopyParameters = (canopy.geometry as SphereGeometry).parameters;
    expect(canopyParameters.radius).toBe(0.14);
    expect(canopyParameters.widthSegments).toBe(12);
    expect(canopyParameters.heightSegments).toBe(8);
    expect(canopy.position.toArray()).toEqual([0, 0.055, 0.08]);
    expect(canopy.scale.toArray()).toEqual([1, 0.92, 1.25]);

    const frame = meshNamed(model, 'cursor-cockpit-frame');
    expect(frame.geometry).toBeInstanceOf(TorusGeometry);
    const frameParameters = (frame.geometry as TorusGeometry).parameters;
    expect(frameParameters.radius).toBe(0.145);
    expect(frameParameters.tube).toBe(0.012);
    expect(frame.position.toArray()).toEqual([0, 0.06, 0.08]);

    const highlight = meshNamed(model, 'cursor-cockpit-highlight');
    expect(highlight.geometry).toBeInstanceOf(SphereGeometry);
    expect(highlight.position.toArray()).toEqual([0.04, 0.177, 0.11]);
    expect(highlight.scale.toArray()).toEqual([1, 0.5, 1.2]);
  });

  it('pins thin seams, vents and tail fin', () => {
    for (const name of ['cursor-hull-seam-1', 'cursor-hull-seam-2']) {
      const seam = meshNamed(model, name);
      expect(seam.geometry).toBeInstanceOf(BoxGeometry);
      const parameters = (seam.geometry as BoxGeometry).parameters;
      expect(parameters.width).toBe(0.014);
      expect(parameters.height).toBe(0.02);
      expect(parameters.depth).toBe(0.5);
      expect(parameters.width).toBeLessThanOrEqual(0.04);
      expect(Math.abs(seam.position.x)).toBe(0.08);
      expect(seam.position.y).toBe(0.158);
      expect(seam.position.z).toBe(-0.125);
    }
    for (const name of ['cursor-vent-left', 'cursor-vent-right']) {
      const vent = meshNamed(model, name);
      expect(vent.geometry).toBeInstanceOf(BoxGeometry);
      const parameters = (vent.geometry as BoxGeometry).parameters;
      expect(parameters.width).toBe(0.02);
      expect(parameters.height).toBe(0.06);
      expect(parameters.depth).toBe(0.18);
      expect(parameters.width).toBeLessThanOrEqual(0.04);
      expect(vent.position.y).toBe(-0.02);
      expect(vent.position.z).toBe(-0.25);
    }
    const tailFin = meshNamed(model, 'cursor-tail-fin');
    expect(tailFin.geometry).toBeInstanceOf(BoxGeometry);
    const tailParameters = (tailFin.geometry as BoxGeometry).parameters;
    expect(tailParameters.width).toBe(0.026);
    expect(tailParameters.height).toBe(0.22);
    expect(tailParameters.depth).toBe(0.28);
    expect(tailFin.position.toArray()).toEqual([0, 0.075, -0.41]);
  });

  it('starts every slot group at the identity standard pose', () => {
    for (const slot of SLOT_CATALOG) {
      const group = model.slots[slot.id];
      expect(group.position.toArray()).toEqual([0, 0, 0]);
      expect(group.scale.toArray()).toEqual([1, 1, 1]);
      expect(group.rotation.toArray()).toEqual([0, 0, 0, 'XYZ']);
    }
  });
});

describe('cursor ship appearance mapping (AC-4, AC-7 seam)', () => {
  it('recolours only the addressed slot and isolates left from right', () => {
    const rightWingMaterial = materialOf(meshNamed(model, 'cursor-wing-right'));
    const changed = model.applyAppearance({ 'wing-left': 'wing-left-silver' });
    expect(changed).toEqual(['wing-left']);

    expect(physicalMaterialOf(meshNamed(model, 'cursor-wing-left')).color.getHex()).toBe(
      0xaaaaaa,
    );
    expect(
      physicalMaterialOf(meshNamed(model, 'cursor-wing-left-tip')).color.getHex(),
    ).toBe(0xd9dee7);
    expect(materialOf(meshNamed(model, 'cursor-wing-right'))).toBe(rightWingMaterial);
    expect(physicalMaterialOf(meshNamed(model, 'cursor-wing-right')).color.getHex()).toBe(
      0x4466cc,
    );
    expect(
      physicalMaterialOf(meshNamed(model, 'cursor-wing-right-tip')).color.getHex(),
    ).toBe(0x8f9bad);

    expect(model.slots['wing-left'].scale.toArray()).toEqual([1.16, 1, 0.9]);
    expect(model.slots['wing-left'].rotation.y).toBe(-0.12);
    expect(model.slots['wing-right'].scale.toArray()).toEqual([1, 1, 1]);
    expect(model.slots['wing-right'].rotation.y).toBe(0);
  });

  it('applies a full mixed rare/epic appearance to colours, accents and shapes', () => {
    const materialInstances = new Map(
      model.meshes.map((mesh) => [mesh.name, materialOf(mesh)]),
    );

    const changed = model.applyAppearance(MIXED_APPEARANCE);
    expect(changed).toEqual(SLOT_CATALOG.map((slot) => slot.id));

    expect(physicalMaterialOf(meshNamed(model, 'cursor-hull')).color.getHex()).toBe(0xccaa44);
    expect(
      physicalMaterialOf(meshNamed(model, 'cursor-hull-underside')).color.getHex(),
    ).toBe(0xccaa44);
    expect(
      physicalMaterialOf(meshNamed(model, 'cursor-hull-seam-1')).color.getHex(),
    ).toBe(0xfff3d6);
    expect(physicalMaterialOf(meshNamed(model, 'cursor-vent-right')).color.getHex()).toBe(
      0xfff3d6,
    );
    expect(physicalMaterialOf(meshNamed(model, 'cursor-nose')).color.getHex()).toBe(0xcc4444);
    expect(physicalMaterialOf(meshNamed(model, 'cursor-cockpit')).color.getHex()).toBe(
      0x2e1065,
    );
    expect(physicalMaterialOf(meshNamed(model, 'cursor-cockpit-frame')).color.getHex()).toBe(
      0xc4b5fd,
    );
    expect(
      basicMaterialOf(meshNamed(model, 'cursor-cockpit-highlight')).color.getHex(),
    ).toBe(0xc4b5fd);
    expect(physicalMaterialOf(meshNamed(model, 'cursor-wing-left')).color.getHex()).toBe(
      0xaaaaaa,
    );
    expect(
      physicalMaterialOf(meshNamed(model, 'cursor-wing-left-tip')).color.getHex(),
    ).toBe(0xd9dee7);
    expect(physicalMaterialOf(meshNamed(model, 'cursor-wing-right')).color.getHex()).toBe(
      0xccaa44,
    );
    expect(
      physicalMaterialOf(meshNamed(model, 'cursor-wing-right-tip')).color.getHex(),
    ).toBe(0xfff3d6);
    expect(physicalMaterialOf(meshNamed(model, 'cursor-engine-left')).color.getHex()).toBe(
      0x1e3a8a,
    );
    expect(
      physicalMaterialOf(meshNamed(model, 'cursor-engine-left-nozzle')).color.getHex(),
    ).toBe(0x60a5fa);
    expect(physicalMaterialOf(meshNamed(model, 'cursor-engine-right')).color.getHex()).toBe(
      0xf8fafc,
    );
    expect(
      physicalMaterialOf(meshNamed(model, 'cursor-engine-right-nozzle')).color.getHex(),
    ).toBe(0xffcc66);
    expect(physicalMaterialOf(meshNamed(model, 'cursor-tail-fin')).color.getHex()).toBe(
      0xff7a1a,
    );

    const leftIgnition = physicalMaterialOf(model.ignitions[0]!);
    expect(leftIgnition.emissive.getHex()).toBe(0x4488ff);
    expect(leftIgnition.color.getHex()).toBe(0xcffcff);
    const rightIgnition = physicalMaterialOf(model.ignitions[1]!);
    expect(rightIgnition.emissive.getHex()).toBe(0xa855f7);
    expect(rightIgnition.color.getHex()).toBe(0xf0abfc);

    const expectedScales: Readonly<Record<SlotId, readonly [number, number, number]>> = {
      hull: [0.96, 1.02, 1.05],
      nose: [0.9, 0.9, 1.18],
      cockpit: [1.12, 1.04, 1.14],
      'wing-left': [1.16, 1, 0.9],
      'wing-right': [1.08, 1.2, 1.04],
      'engine-left': [1.1, 1.1, 0.92],
      'engine-right': [1.18, 1.18, 1.04],
      'ignition-left': [0.9, 0.9, 1.3],
      'ignition-right': [1.18, 1.18, 1.12],
      'tail-fin': [1.05, 1.22, 1.12],
    };
    for (const slot of SLOT_CATALOG) {
      expect(model.slots[slot.id].scale.toArray()).toEqual(expectedScales[slot.id]);
    }
    expect(model.slots['wing-left'].rotation.y).toBe(-0.12);
    expect(model.slots['wing-right'].rotation.y).toBe(0);
    expect(model.slots['ignition-right'].rotation.toArray()).toEqual([0, 0, 0, 'XYZ']);

    // F9: rarity recolours and reshapes only — every material keeps the AC-4 finish and the
    // exact same material instance.
    for (const name of [
      'cursor-hull',
      'cursor-hull-underside',
      'cursor-nose',
      'cursor-cockpit-frame',
      'cursor-wing-left',
      'cursor-wing-left-tip',
      'cursor-wing-right',
      'cursor-wing-right-tip',
      'cursor-engine-left',
      'cursor-engine-left-nozzle',
      'cursor-engine-right',
      'cursor-engine-right-nozzle',
      'cursor-tail-fin',
      'cursor-hull-seam-1',
      'cursor-vent-left',
    ]) {
      expect(materialOf(meshNamed(model, name))).toBe(materialInstances.get(name));
      expectStructuralFinish(physicalMaterialOf(meshNamed(model, name)));
    }
  });

  it('maps legacy appearance categories to both sides without touching other slots', () => {
    const changed = model.applyAppearance({
      body: 'body-obsidian',
      wings: 'wings-silver',
      engine: 'engine-blue',
    });
    expect(changed).toEqual(['hull', 'wing-left', 'wing-right', 'ignition-left', 'ignition-right']);

    expect(physicalMaterialOf(meshNamed(model, 'cursor-hull')).color.getHex()).toBe(0x1a2333);
    expect(
      physicalMaterialOf(meshNamed(model, 'cursor-hull-seam-1')).color.getHex(),
    ).toBe(0x3b82f6);
    expect(physicalMaterialOf(meshNamed(model, 'cursor-wing-left')).color.getHex()).toBe(
      0xaaaaaa,
    );
    expect(physicalMaterialOf(meshNamed(model, 'cursor-wing-right')).color.getHex()).toBe(
      0xaaaaaa,
    );
    expect(physicalMaterialOf(model.ignitions[0]!).emissive.getHex()).toBe(0x4488ff);
    expect(physicalMaterialOf(model.ignitions[1]!).emissive.getHex()).toBe(0x4488ff);

    expect(physicalMaterialOf(meshNamed(model, 'cursor-nose')).color.getHex()).toBe(0x88aaff);
    expect(physicalMaterialOf(meshNamed(model, 'cursor-engine-left')).color.getHex()).toBe(
      0x35507a,
    );
    expect(physicalMaterialOf(meshNamed(model, 'cursor-tail-fin')).color.getHex()).toBe(
      0x14213d,
    );
  });

  it('is a no-op when the same appearance is applied twice', () => {
    expect(model.applyAppearance(MIXED_APPEARANCE)).toHaveLength(10);

    const hullColor = physicalMaterialOf(meshNamed(model, 'cursor-hull')).color.getHex();
    const wingScale = model.slots['wing-left'].scale.toArray();
    const wingRotation = model.slots['wing-left'].rotation.toArray();

    expect(model.applyAppearance(MIXED_APPEARANCE)).toEqual([]);

    expect(physicalMaterialOf(meshNamed(model, 'cursor-hull')).color.getHex()).toBe(hullColor);
    expect(model.slots['wing-left'].scale.toArray()).toEqual(wingScale);
    expect(model.slots['wing-left'].rotation.toArray()).toEqual(wingRotation);
    const defaultNose: PartVisual = {
      partId: 'nose-default',
      slot: 'nose',
      color: '#88aaff',
      accent: '#2f6fd6',
      rarity: 'standard',
      shape: 'standard',
    };
    expect(model.applySlotVisual(defaultNose)).toBe(true);
    expect(model.applySlotVisual(defaultNose)).toBe(false);
  });

  it('falls back to the identity pose for an unknown shape key', () => {
    const visual: PartVisual = {
      partId: 'nose-default',
      slot: 'nose',
      color: '#123456',
      accent: '#654321',
      rarity: 'standard',
      shape: 'unlisted-shape',
    };
    expect(model.applySlotVisual(visual)).toBe(true);
    expect(physicalMaterialOf(meshNamed(model, 'cursor-nose')).color.getHex()).toBe(0x123456);
    expect(model.slots.nose.scale.toArray()).toEqual([1, 1, 1]);
    expect(model.slots.nose.rotation.toArray()).toEqual([0, 0, 0, 'XYZ']);
    expect(model.applySlotVisual(visual)).toBe(false);
  });

  it('detects a colour-only change for an otherwise identical visual', () => {
    const noseVisual: PartVisual = {
      partId: 'nose-default',
      slot: 'nose',
      color: '#88aaff',
      accent: '#2f6fd6',
      rarity: 'standard',
      shape: 'standard',
    };
    expect(model.applySlotVisual({ ...noseVisual, color: '#abcdef' })).toBe(true);
    expect(physicalMaterialOf(meshNamed(model, 'cursor-nose')).color.getHex()).toBe(0xabcdef);
  });
});

describe('cursor ship purity (AC-1)', () => {
  it('creates no lights, points, sprites or textures in the object graph', () => {
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
  });

  it('consumes no random draw while applying appearance', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    model.applyAppearance(MIXED_APPEARANCE);
    expect(randomSpy).toHaveBeenCalledTimes(0);
    randomSpy.mockRestore();
  });

  it('contains no random, loader, texture, DOM or light construction in its source', () => {
    const source = readFileSync(new URL('./cursor-ship.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(
      /\b(?:TextureLoader|GLTFLoader|OBJLoader|FileLoader|ImageLoader|AudioLoader)\b/,
    );
    expect(source).not.toMatch(/new\s+Texture\s*\(/);
    expect(source).not.toMatch(/https?:\/\//);
    expect(source).not.toMatch(/\.(?:png|jpe?g|webp|glb|gltf|obj)\b/);
    expect(source).not.toMatch(/\b(?:document|window)\./);
    expect(source).not.toMatch(
      /new\s+(?:AmbientLight|DirectionalLight|PointLight|SpotLight|HemisphereLight|Sprite|Points)\s*\(/,
    );
  });
});

describe('cursor ship disposal (AC-1)', () => {
  it('disposes every unique geometry/material once, clears the groups and is idempotent', () => {
    const geometries = new Set(model.meshes.map((mesh) => mesh.geometry));
    const materials = new Set(model.meshes.map((mesh) => materialOf(mesh)));
    expect(geometries.size).toBe(21);
    expect(materials.size).toBe(CURSOR_SHIP_MATERIAL_COUNT);

    const geometrySpies = [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const materialSpies = [...materials].map((material) => vi.spyOn(material, 'dispose'));

    const parent = new Group();
    parent.add(model.group);
    model.dispose();

    expect(parent.children).toEqual([]);
    expect(model.group.parent).toBeNull();
    expect(model.group.children).toEqual([]);
    expect(model.meshes).toEqual([]);
    expect(model.ignitions).toEqual([]);
    expect(model.slotGroups).toEqual([]);
    for (const slot of SLOT_CATALOG) {
      expect(model.slots[slot.id].children).toEqual([]);
    }
    for (const spy of [...geometrySpies, ...materialSpies]) {
      expect(spy).toHaveBeenCalledTimes(1);
    }

    model.dispose();
    for (const spy of [...geometrySpies, ...materialSpies]) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
  });
});
