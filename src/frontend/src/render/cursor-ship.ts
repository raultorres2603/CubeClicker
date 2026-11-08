/**
 * Procedural pointer-ship model factory (spaceship-cursor-loot-animations T8; spec AC-1…AC-4).
 *
 * Layer: render adapter (`render/**`) — three.js geometry/materials only. The factory is
 * deterministic and parameter-free: no scene, camera, DOM, light, texture, loader, external
 * asset or random source. Time and appearance enter later, through
 * {@link CursorShipModel.applySlotVisual}/{@link CursorShipModel.applyAppearance}.
 *
 * Hierarchy (AC-1/AC-8): the `cursor-ship-model` root holds exactly ten `slot-*` groups
 * (SLOT_CATALOG order) holding exactly twenty-one named meshes — 32 objects in the model
 * subtree. Local +z is the nose direction and local −z is the exhaust direction; the outer
 * `spaceship` group (T9) owns scale, position and bank/pitch motion.
 *
 * Materials (AC-4): every structural mesh uses one shared finish (`metalness 0.55`,
 * `roughness 0.38`, `clearcoat 0.4`, `clearcoatRoughness 0.2`); rarity changes colour,
 * accent and slot shape only, never the finish. The canopy is the single glass surface
 * (`0.2 / 0.08 / 1 / 0.08`), the canopy highlight is basic, and the two ignition flames are
 * transparent emissive meshes (`emissive` = ignition part colour, `opacity 0.55`).
 */

import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
} from 'three';

import {
  SLOT_CATALOG,
  appearanceToCursorShipParams,
  type PartVisual,
  type SlotId,
} from '../game/parts-v2';

/** Exactly ten slot groups (AC-1). */
export const CURSOR_SHIP_SLOT_COUNT = 10;

/** Exactly twenty-one named meshes (AC-1/AC-2). */
export const CURSOR_SHIP_MESH_COUNT = 21;

/** Exactly nineteen unique material instances (AC-1/AC-4). */
export const CURSOR_SHIP_MATERIAL_COUNT = 19;

/** Model-subtree objects: root + ten slot groups + twenty-one meshes (AC-1/AC-8). */
export const CURSOR_SHIP_MODEL_OBJECT_COUNT = 32;

/** Triangle budget for the cursor model (AC-1/AC-8). */
export const CURSOR_SHIP_MAX_TRIANGLES = 2500;

/** Nose-to-exhaust target length in model-local units (AC-3). */
export const CURSOR_SHIP_LENGTH = 1.4;

/** Wingspan target in model-local units (AC-3). */
export const CURSOR_SHIP_WIDTH = 0.9;

/** Height target in model-local units (AC-3). */
export const CURSOR_SHIP_HEIGHT = 0.4;

/** Structural metalness shared by every structural mesh (AC-4). */
export const CURSOR_STRUCTURAL_METALNESS = 0.55;

/** Structural roughness shared by every structural mesh (AC-4). */
export const CURSOR_STRUCTURAL_ROUGHNESS = 0.38;

/** Structural clearcoat shared by every structural mesh (AC-4). */
export const CURSOR_STRUCTURAL_CLEARCOAT = 0.4;

/** Pinned clearcoat roughness for every structural mesh, rarity included (AC-4/F9). */
export const CURSOR_CLEARCOAT_ROUGHNESS = 0.2;

/** Canopy glass metalness (AC-4). */
export const CURSOR_CANOPY_METALNESS = 0.2;

/** Canopy glass roughness (AC-4). */
export const CURSOR_CANOPY_ROUGHNESS = 0.08;

/** Canopy glass clearcoat (AC-4). */
export const CURSOR_CANOPY_CLEARCOAT = 1;

/** Canopy glass clearcoat roughness (AC-4). */
export const CURSOR_CANOPY_CLEARCOAT_ROUGHNESS = 0.08;

/** Ignition flame opacity (AC-4). */
export const CURSOR_IGNITION_OPACITY = 0.55;

/** Slot-group scale/rotation applied for one shape key. */
export interface CursorSlotShapeTransform {
  readonly scale: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
}

const IDENTITY_TRANSFORM: CursorSlotShapeTransform = {
  scale: [1, 1, 1],
  rotation: [0, 0, 0],
};

/**
 * Rarity shape keys mapped to slot-group transforms (plan § Cursor model). Every slot's
 * `standard` entry is identity, so the default appearance is the AC-3 rest pose. Left and
 * right slots are independent: the razor wings sweep towards −z on their own side.
 */
export const CURSOR_SLOT_SHAPE_TRANSFORMS: Readonly<
  Record<SlotId, Readonly<Record<string, CursorSlotShapeTransform>>>
> = {
  hull: {
    standard: IDENTITY_TRANSFORM,
    armored: { scale: [1.06, 1.1, 1.02], rotation: [0, 0, 0] },
    solar: { scale: [0.96, 1.02, 1.05], rotation: [0, 0, 0] },
  },
  nose: {
    standard: IDENTITY_TRANSFORM,
    lance: { scale: [0.9, 0.9, 1.18], rotation: [0, 0, 0] },
    photon: { scale: [1.08, 1.08, 0.98], rotation: [0, 0, 0] },
  },
  cockpit: {
    standard: IDENTITY_TRANSFORM,
    razor: { scale: [0.88, 1.12, 0.94], rotation: [0, 0, 0] },
    oracle: { scale: [1.12, 1.04, 1.14], rotation: [0, 0, 0] },
  },
  'wing-left': {
    standard: IDENTITY_TRANSFORM,
    razor: { scale: [1.16, 1, 0.9], rotation: [0, -0.12, 0] },
    solar: { scale: [1.08, 1.2, 1.04], rotation: [0, 0, 0] },
  },
  'wing-right': {
    standard: IDENTITY_TRANSFORM,
    razor: { scale: [1.16, 1, 0.9], rotation: [0, 0.12, 0] },
    solar: { scale: [1.08, 1.2, 1.04], rotation: [0, 0, 0] },
  },
  'engine-left': {
    standard: IDENTITY_TRANSFORM,
    boxed: { scale: [1.1, 1.1, 0.92], rotation: [0, 0, 0] },
    nova: { scale: [1.18, 1.18, 1.04], rotation: [0, 0, 0] },
  },
  'engine-right': {
    standard: IDENTITY_TRANSFORM,
    boxed: { scale: [1.1, 1.1, 0.92], rotation: [0, 0, 0] },
    nova: { scale: [1.18, 1.18, 1.04], rotation: [0, 0, 0] },
  },
  'ignition-left': {
    standard: IDENTITY_TRANSFORM,
    ion: { scale: [0.9, 0.9, 1.3], rotation: [0, 0, 0] },
    plasma: { scale: [1.18, 1.18, 1.12], rotation: [0, 0, 0] },
  },
  'ignition-right': {
    standard: IDENTITY_TRANSFORM,
    ion: { scale: [0.9, 0.9, 1.3], rotation: [0, 0, 0] },
    plasma: { scale: [1.18, 1.18, 1.12], rotation: [0, 0, 0] },
  },
  'tail-fin': {
    standard: IDENTITY_TRANSFORM,
    split: { scale: [1.5, 1, 0.86], rotation: [0, 0, 0] },
    comet: { scale: [1.05, 1.22, 1.12], rotation: [0, 0, 0] },
  },
};

/** The cursor-model handle handed to the cursor integration (T9). */
export interface CursorShipModel {
  /** Root group (`name === 'cursor-ship-model'`); identity transform, 32-object subtree. */
  readonly group: Group;
  /** The ten slot groups keyed by slot id. */
  readonly slots: Readonly<Record<SlotId, Group>>;
  /** The ten slot groups in `SLOT_CATALOG` order. */
  readonly slotGroups: readonly Group[];
  /** The twenty-one named meshes, in build order. */
  readonly meshes: readonly Mesh[];
  /** The two `ignition` meshes (hidden at rest), one per ignition slot. */
  readonly ignitions: readonly Mesh[];
  /** Triangles across the built geometries (> 0 and <= `CURSOR_SHIP_MAX_TRIANGLES`). */
  readonly triangleCount: number;
  /** Unique material instances across the meshes (19). */
  readonly materialCount: number;
  /**
   * Applies one slot's appearance: writes colour/accent to the slot's existing materials and
   * the shape transform to the slot group. Returns true when anything changed; repeating the
   * same visual is a no-op.
   */
  applySlotVisual(visual: PartVisual): boolean;
  /**
   * Maps a slot→part-id record through `appearanceToCursorShipParams` and applies all ten
   * slots, returning the slots whose visual changed (in `SLOT_CATALOG` order).
   */
  applyAppearance(appearance: Record<string, string>): readonly SlotId[];
  /** Releases each unique geometry/material once, clears the groups; idempotent. */
  dispose(): void;
}

/** One slot's material roles: primary surfaces, accent details and the ignition flame. */
interface SlotMaterialBinding {
  readonly colorMaterials: readonly (MeshPhysicalMaterial | MeshBasicMaterial)[];
  readonly accentMaterials: readonly (MeshPhysicalMaterial | MeshBasicMaterial)[];
  readonly ignitionMaterials?: readonly MeshPhysicalMaterial[];
}

/** Triangles a geometry contributes to a draw (indexed or not). */
function countGeometryTriangles(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  if (index !== null) {
    return index.count / 3;
  }
  return geometry.getAttribute('position').count / 3;
}

/** Resolves a shape key to its slot transform, falling back to the slot's standard pose. */
function cursorShapeTransform(slot: SlotId, shape: string): CursorSlotShapeTransform {
  const table = CURSOR_SLOT_SHAPE_TRANSFORMS[slot];
  const found: CursorSlotShapeTransform | undefined = table[shape];
  return found ?? table.standard;
}

/** Stable comparison key for a slot visual (all catalog-derived fields). */
function visualSignature(visual: PartVisual): string {
  return [visual.partId, visual.slot, visual.color, visual.accent, visual.rarity, visual.shape].join(
    '|',
  );
}

/** Builds one structural PBR material with the pinned AC-4 finish. */
function createStructuralMaterial(color: string): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color,
    metalness: CURSOR_STRUCTURAL_METALNESS,
    roughness: CURSOR_STRUCTURAL_ROUGHNESS,
    clearcoat: CURSOR_STRUCTURAL_CLEARCOAT,
    clearcoatRoughness: CURSOR_CLEARCOAT_ROUGHNESS,
  });
}

/**
 * Builds the cursor ship model.
 *
 * Deterministic and self-contained: no parameters, no random draw, no scene, camera, DOM,
 * external asset, texture or light. The caller mounts {@link CursorShipModel.group} under the
 * outer `spaceship` group and must call {@link CursorShipModel.dispose} on teardown.
 */
export function createCursorShipModel(): CursorShipModel {
  const defaults = appearanceToCursorShipParams({});

  const group = new Group();
  group.name = 'cursor-ship-model';

  const slots = {} as Record<SlotId, Group>;
  const slotGroups: Group[] = [];
  for (const slot of SLOT_CATALOG) {
    const slotGroup = new Group();
    slotGroup.name = `slot-${slot.id}`;
    group.add(slotGroup);
    slots[slot.id] = slotGroup;
    slotGroups.push(slotGroup);
  }

  const meshes: Mesh[] = [];
  const ignitions: Mesh[] = [];

  function addMesh(
    slot: SlotId,
    name: string,
    geometry: BufferGeometry,
    material: Material,
  ): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    slots[slot].add(mesh);
    meshes.push(mesh);
    return mesh;
  }

  // Exactly 19 material instances (AC-4). The two hull seams and the two side vents each
  // share one instance, so 21 meshes still resolve to 19 materials.
  const hullMaterial = createStructuralMaterial(defaults.hull.color);
  const undersideMaterial = createStructuralMaterial(defaults.hull.color);
  const seamMaterial = createStructuralMaterial(defaults.hull.accent);
  const ventMaterial = createStructuralMaterial(defaults.hull.accent);
  const noseMaterial = createStructuralMaterial(defaults.nose.color);
  const canopyMaterial = new MeshPhysicalMaterial({
    color: defaults.cockpit.color,
    metalness: CURSOR_CANOPY_METALNESS,
    roughness: CURSOR_CANOPY_ROUGHNESS,
    clearcoat: CURSOR_CANOPY_CLEARCOAT,
    clearcoatRoughness: CURSOR_CANOPY_CLEARCOAT_ROUGHNESS,
  });
  const cockpitFrameMaterial = createStructuralMaterial(defaults.cockpit.accent);
  const cockpitHighlightMaterial = new MeshBasicMaterial({ color: defaults.cockpit.accent });
  const wingLeftMaterial = createStructuralMaterial(defaults['wing-left'].color);
  const wingLeftTipMaterial = createStructuralMaterial(defaults['wing-left'].accent);
  const wingRightMaterial = createStructuralMaterial(defaults['wing-right'].color);
  const wingRightTipMaterial = createStructuralMaterial(defaults['wing-right'].accent);
  const engineLeftMaterial = createStructuralMaterial(defaults['engine-left'].color);
  const engineLeftNozzleMaterial = createStructuralMaterial(defaults['engine-left'].accent);
  const engineRightMaterial = createStructuralMaterial(defaults['engine-right'].color);
  const engineRightNozzleMaterial = createStructuralMaterial(defaults['engine-right'].accent);
  const tailFinMaterial = createStructuralMaterial(defaults['tail-fin'].color);
  const ignitionLeftMaterial = new MeshPhysicalMaterial({
    color: defaults['ignition-left'].accent,
    emissive: defaults['ignition-left'].color,
    metalness: CURSOR_STRUCTURAL_METALNESS,
    roughness: CURSOR_STRUCTURAL_ROUGHNESS,
    clearcoat: CURSOR_STRUCTURAL_CLEARCOAT,
    clearcoatRoughness: CURSOR_CLEARCOAT_ROUGHNESS,
    transparent: true,
    opacity: CURSOR_IGNITION_OPACITY,
  });
  const ignitionRightMaterial = new MeshPhysicalMaterial({
    color: defaults['ignition-right'].accent,
    emissive: defaults['ignition-right'].color,
    metalness: CURSOR_STRUCTURAL_METALNESS,
    roughness: CURSOR_STRUCTURAL_ROUGHNESS,
    clearcoat: CURSOR_STRUCTURAL_CLEARCOAT,
    clearcoatRoughness: CURSOR_CLEARCOAT_ROUGHNESS,
    transparent: true,
    opacity: CURSOR_IGNITION_OPACITY,
  });

  // Fuselage: a 12-sided hull cylinder, a keel plate, two dorsal seams and two side vents.
  const hullGeometry = new CylinderGeometry(0.16, 0.16, 0.75, 12);
  hullGeometry.rotateX(Math.PI / 2);
  addMesh('hull', 'cursor-hull', hullGeometry, hullMaterial).position.set(0, 0, -0.125);

  addMesh(
    'hull',
    'cursor-hull-underside',
    new BoxGeometry(0.24, 0.09, 0.7),
    undersideMaterial,
  ).position.set(0, -0.155, -0.125);

  const seamGeometry = new BoxGeometry(0.014, 0.02, 0.5);
  addMesh('hull', 'cursor-hull-seam-1', seamGeometry, seamMaterial).position.set(
    0.08,
    0.158,
    -0.125,
  );
  addMesh('hull', 'cursor-hull-seam-2', seamGeometry.clone(), seamMaterial).position.set(
    -0.08,
    0.158,
    -0.125,
  );

  const ventGeometry = new BoxGeometry(0.02, 0.06, 0.18);
  addMesh('hull', 'cursor-vent-left', ventGeometry, ventMaterial).position.set(
    -0.166,
    -0.02,
    -0.25,
  );
  addMesh('hull', 'cursor-vent-right', ventGeometry.clone(), ventMaterial).position.set(
    0.166,
    -0.02,
    -0.25,
  );

  // Nose cone: base meets the hull front at z = 0.25, tip at z = 0.7.
  const noseGeometry = new ConeGeometry(0.16, 0.45, 12);
  noseGeometry.rotateX(Math.PI / 2);
  addMesh('nose', 'cursor-nose', noseGeometry, noseMaterial).position.set(0, 0, 0.475);

  // Cockpit: glass canopy, bezel ring and a small basic glint (procedural, not a decal).
  const canopy = addMesh(
    'cockpit',
    'cursor-cockpit',
    new SphereGeometry(0.14, 12, 8),
    canopyMaterial,
  );
  canopy.position.set(0, 0.055, 0.08);
  canopy.scale.set(1, 0.92, 1.25);

  const frameGeometry = new TorusGeometry(0.145, 0.012, 6, 12);
  frameGeometry.rotateX(Math.PI / 2);
  addMesh('cockpit', 'cursor-cockpit-frame', frameGeometry, cockpitFrameMaterial).position.set(
    0,
    0.06,
    0.08,
  );

  const highlight = addMesh(
    'cockpit',
    'cursor-cockpit-highlight',
    new SphereGeometry(0.03, 8, 6),
    cockpitHighlightMaterial,
  );
  highlight.position.set(0.04, 0.177, 0.11);
  highlight.scale.set(1, 0.5, 1.2);

  // Wings: swept panels with independent left/right slot groups and thin tip caps.
  const sides = [
    {
      slot: 'wing-left',
      suffix: 'left',
      sign: -1,
      wingMaterial: wingLeftMaterial,
      tipMaterial: wingLeftTipMaterial,
    },
    {
      slot: 'wing-right',
      suffix: 'right',
      sign: 1,
      wingMaterial: wingRightMaterial,
      tipMaterial: wingRightTipMaterial,
    },
  ] as const;
  for (const side of sides) {
    const wing = addMesh(
      side.slot,
      `cursor-wing-${side.suffix}`,
      new BoxGeometry(0.34, 0.035, 0.26),
      side.wingMaterial,
    );
    wing.position.set(side.sign * 0.245, -0.01, -0.12);
    wing.rotation.y = side.sign * 0.18;

    const tip = addMesh(
      side.slot,
      `cursor-wing-${side.suffix}-tip`,
      new BoxGeometry(0.09, 0.03, 0.13),
      side.tipMaterial,
    );
    tip.position.set(side.sign * 0.405, 0, -0.15);
  }

  // Twin engines: nacelle cylinder, thin nozzle disc and the rear-facing flame.
  const engineSides = [
    {
      slot: 'engine-left',
      suffix: 'left',
      sign: -1,
      material: engineLeftMaterial,
      nozzleMaterial: engineLeftNozzleMaterial,
    },
    {
      slot: 'engine-right',
      suffix: 'right',
      sign: 1,
      material: engineRightMaterial,
      nozzleMaterial: engineRightNozzleMaterial,
    },
  ] as const;
  for (const side of engineSides) {
    const engineGeometry = new CylinderGeometry(0.055, 0.055, 0.22, 8);
    engineGeometry.rotateX(Math.PI / 2);
    addMesh(
      side.slot,
      `cursor-engine-${side.suffix}`,
      engineGeometry,
      side.material,
    ).position.set(side.sign * 0.12, -0.03, -0.42);

    const nozzleGeometry = new CylinderGeometry(0.055, 0.062, 0.035, 12);
    nozzleGeometry.rotateX(Math.PI / 2);
    addMesh(
      side.slot,
      `cursor-engine-${side.suffix}-nozzle`,
      nozzleGeometry,
      side.nozzleMaterial,
    ).position.set(side.sign * 0.12, -0.03, -0.55);
  }

  // Rear-facing flames, one per ignition slot (hidden at rest; T9 drives visibility).
  const ignitionSides = [
    { slot: 'ignition-left', sign: -1, material: ignitionLeftMaterial },
    { slot: 'ignition-right', sign: 1, material: ignitionRightMaterial },
  ] as const;
  for (const side of ignitionSides) {
    const ignitionGeometry = new ConeGeometry(0.05, 0.18, 8);
    ignitionGeometry.rotateX(-Math.PI / 2);
    const ignition = addMesh(side.slot, 'ignition', ignitionGeometry, side.material);
    ignition.position.set(side.sign * 0.12, -0.03, -0.61);
    ignition.visible = false;
    ignitions.push(ignition);
  }

  // Tail fin: a thin vertical blade behind the cockpit.
  addMesh('tail-fin', 'cursor-tail-fin', new BoxGeometry(0.026, 0.22, 0.28), tailFinMaterial)
    .position.set(0, 0.075, -0.41);

  const bindings: Readonly<Record<SlotId, SlotMaterialBinding>> = {
    hull: {
      colorMaterials: [hullMaterial, undersideMaterial],
      accentMaterials: [seamMaterial, ventMaterial],
    },
    nose: { colorMaterials: [noseMaterial], accentMaterials: [] },
    cockpit: {
      colorMaterials: [canopyMaterial],
      accentMaterials: [cockpitFrameMaterial, cockpitHighlightMaterial],
    },
    'wing-left': {
      colorMaterials: [wingLeftMaterial],
      accentMaterials: [wingLeftTipMaterial],
    },
    'wing-right': {
      colorMaterials: [wingRightMaterial],
      accentMaterials: [wingRightTipMaterial],
    },
    'engine-left': {
      colorMaterials: [engineLeftMaterial],
      accentMaterials: [engineLeftNozzleMaterial],
    },
    'engine-right': {
      colorMaterials: [engineRightMaterial],
      accentMaterials: [engineRightNozzleMaterial],
    },
    'ignition-left': {
      colorMaterials: [],
      accentMaterials: [],
      ignitionMaterials: [ignitionLeftMaterial],
    },
    'ignition-right': {
      colorMaterials: [],
      accentMaterials: [],
      ignitionMaterials: [ignitionRightMaterial],
    },
    'tail-fin': { colorMaterials: [tailFinMaterial], accentMaterials: [] },
  };

  const currentSignatures = new Map<SlotId, string>();
  for (const slot of SLOT_CATALOG) {
    currentSignatures.set(slot.id, visualSignature(defaults[slot.id]));
  }

  function applySlotVisual(visual: PartVisual): boolean {
    const signature = visualSignature(visual);
    if (currentSignatures.get(visual.slot) === signature) {
      return false;
    }

    const binding = bindings[visual.slot];
    for (const material of binding.colorMaterials) {
      material.color.set(visual.color);
    }
    for (const material of binding.accentMaterials) {
      material.color.set(visual.accent);
    }
    if (binding.ignitionMaterials !== undefined) {
      for (const material of binding.ignitionMaterials) {
        material.color.set(visual.accent);
        material.emissive.set(visual.color);
      }
    }

    const transform = cursorShapeTransform(visual.slot, visual.shape);
    const slotGroup = slots[visual.slot];
    slotGroup.scale.set(transform.scale[0], transform.scale[1], transform.scale[2]);
    slotGroup.rotation.set(transform.rotation[0], transform.rotation[1], transform.rotation[2]);

    currentSignatures.set(visual.slot, signature);
    return true;
  }

  function applyAppearance(appearance: Record<string, string>): readonly SlotId[] {
    const params = appearanceToCursorShipParams(appearance);
    const changed: SlotId[] = [];
    for (const slot of SLOT_CATALOG) {
      if (applySlotVisual(params[slot.id])) {
        changed.push(slot.id);
      }
    }
    return changed;
  }

  let triangleCount = 0;
  const materials = new Set<Material>();
  for (const mesh of meshes) {
    triangleCount += countGeometryTriangles(mesh.geometry);
    // Every cursor mesh is built with exactly one material (never a material array).
    materials.add(mesh.material as Material);
  }

  let disposed = false;

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    if (group.parent !== null) {
      group.parent.remove(group);
    }
    for (const geometry of new Set(meshes.map((mesh) => mesh.geometry))) {
      geometry.dispose();
    }
    for (const material of materials) {
      material.dispose();
    }
    for (const slotGroup of slotGroups) {
      slotGroup.clear();
    }
    meshes.length = 0;
    ignitions.length = 0;
    slotGroups.length = 0;
    group.clear();
  }

  return {
    group,
    slots,
    get slotGroups(): readonly Group[] {
      return slotGroups;
    },
    get meshes(): readonly Mesh[] {
      return meshes;
    },
    get ignitions(): readonly Mesh[] {
      return ignitions;
    },
    triangleCount,
    materialCount: materials.size,
    applySlotVisual,
    applyAppearance,
    dispose,
  };
}
