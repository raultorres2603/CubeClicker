/**
 * Detailed procedural hero spaceship — the right-side backdrop craft
 * (detailed-hero-spaceship spec AC-2…AC-10, plan § Model hierarchy and part list).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules, no `random`
 * source. The factory builds one {@link Group} named `hero-ship-model` holding exactly
 * {@link HERO_SHIP_MESH_COUNT} named meshes as direct children (no sub-groups), so the
 * backdrop can mount the whole craft as one child, advance only its existing bob and
 * dispose it through one seam.
 *
 * Layout. Nose points local +z, exhaust local −z; the inner group is scaled
 * {@link HERO_SHIP_SCALE} and yawed/pitched to {@link HERO_SHIP_YAW} /
 * {@link HERO_SHIP_PITCH} for the three-quarter attitude. The outer `hero-ship` group keeps
 * its pinned position and quarter turn (T2), so the model-local attitude stays local.
 * Every detail strip (seams, vents, greebles, antennae) is offset from its base surface by at
 * least {@link HERO_DETAIL_OFFSET} model-local units and is geometrically thin, avoiding
 * coplanar overlays and z-fighting.
 *
 * Materials. Exactly {@link HERO_MATERIAL_COUNT} shared instances (PBR physical/standard for
 * the hull and trim, basic for the canopy highlight and exhaust) are reused across the 48
 * meshes: no per-mesh material state, no texture, no light, no post-processing change. The
 * two outer flames are additive transparent cones (static geometry, no flicker animation);
 * their white-hot cores are smaller cones inside them.
 *
 * Budget. The pinned primitives stay far below {@link HERO_SHIP_MAX_TRIANGLES}; the factory
 * computes {@link HeroSpaceshipModel.triangleCount} once from the built geometries.
 * {@link HeroSpaceshipModel.dispose} releases every unique geometry and material exactly
 * once, detaches/clears the group and is idempotent.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
} from 'three';

/** Inner model scale (AC-2/AC-5). */
export const HERO_SHIP_SCALE = 1.7;

/** Three-quarter yaw of the inner model group in radians (AC-2/AC-6). */
export const HERO_SHIP_YAW = 0.26;

/** Upward nose pitch of the inner model group in radians (AC-2/AC-6). */
export const HERO_SHIP_PITCH = 0.1;

/** Number of named meshes in the model (AC-2/AC-3). */
export const HERO_SHIP_MESH_COUNT = 48;

/** Model subtree objects: the `hero-ship-model` group plus its 48 meshes (AC-2). */
export const HERO_SHIP_MODEL_OBJECT_COUNT = 49;

/** Hero subtree objects: the outer `hero-ship` group plus the 49-object model (AC-2). */
export const HERO_SHIP_SUBTREE_OBJECT_COUNT = 50;

/** Triangle budget for the hero model (AC-2). */
export const HERO_SHIP_MAX_TRIANGLES = 6000;

/** Target nose-to-exhaust length in model-local units (AC-5). */
export const HERO_SHIP_LENGTH = 4.6;

/** Target wingspan in model-local units (AC-5). */
export const HERO_SHIP_WIDTH = 3.3;

/** Target height in model-local units (AC-5). */
export const HERO_SHIP_HEIGHT = 1.0;

/** Number of shared material instances (AC-4). */
export const HERO_MATERIAL_COUNT = 11;

/** Model-local offset of every detail strip from its base surface (AC-10). */
export const HERO_DETAIL_OFFSET = 0.012;

/** Wing planform root x (AC-8). */
export const HERO_WING_ROOT_X = 0.4;

/** Wingtip cap x (AC-8). */
export const HERO_WINGTIP_X = 1.65;

/** Pinned minimum wing planform span on the shape x axis (AC-8). */
export const HERO_WING_SHAPE_SPAN = 1.25;

/** Cobalt/royal-blue upper-hull colour (AC-4). */
export const HERO_HULL_COLOR = 0x2f6fd6;

/** Light gray/white mid and underside panel colour (AC-4). */
export const HERO_PANEL_LIGHT = 0xd9dee7;

/** Mid-gray nose/leading-edge/bezel colour (AC-4). */
export const HERO_PANEL_MID = 0x8f9bad;

/** Dark navy trim colour (AC-4). */
export const HERO_TRIM_NAVY = 0x14213d;

/** Vivid orange accent colour (AC-4). */
export const HERO_ACCENT_ORANGE = 0xff7a1a;

/** Dark teal canopy glass colour (AC-4). */
export const HERO_CANOPY_COLOR = 0x0b2f38;

/** Canopy highlight colour (AC-4). */
export const HERO_CANOPY_HIGHLIGHT = 0xcffcff;

/** Warm orange outer-flame colour (AC-4). */
export const HERO_FLAME_COLOR = 0xff9a3c;

/** White-hot flame-core colour (AC-4). */
export const HERO_FLAME_CORE_COLOR = 0xfff3d6;

/** Engine housing blue-gray colour (AC-4). */
export const HERO_ENGINE_HOUSING_COLOR = 0x35507a;

/** Dark engine nozzle colour (AC-4). */
export const HERO_ENGINE_NOZZLE_COLOR = 0x1a2333;

/** Fuselage front (nose-side) model-local z. */
const HULL_FRONT_Z = 1.35;

/** Fuselage length along z; the hull cylinder spans the full length. */
const HULL_LENGTH = 2.6;

/** Fuselage radius at the nose-side end. */
const HULL_RADIUS_FRONT = 0.3;

/** Fuselage radius at the tail-side end. */
const HULL_RADIUS_BACK = 0.42;

/** Vertical flattening of the low-poly fuselage and nose (10-segment octagonal read). */
const HULL_FLATTEN = 0.62;

/** Hull seam ring positions (fore/mid/aft). */
const HULL_SEAM_Z = [0.85, 0.05, -0.75] as const;

/** Stepped underplate fore half-width (the narrower tier). */
const UNDERPLATE_FORE_HALF_WIDTH = 0.4;

/** Stepped underplate aft half-width (the wider tier). */
const UNDERPLATE_AFT_HALF_WIDTH = 0.55;

/** Stepped underplate tier break and end z positions. */
const UNDERPLATE_TIER_Z = -0.1;
const UNDERPLATE_FORE_Z = 0.9;
const UNDERPLATE_AFT_Z = -1.2;

/** Underplate thickness below the hull. */
const UNDERPLATE_THICKNESS = 0.07;

/** Dorsal spine half-height/centre (top surface at y = 0.32). */
const SPINE_TOP_Y = 0.32;

/** Wing planform root leading-edge z. */
const WING_ROOT_LEADING_Z = 0.35;

/** Wing planform tip leading-edge z (swept delta). */
const WING_TIP_LEADING_Z = -0.55;

/** Wing planform trailing-edge z (both root and tip). */
const WING_TRAILING_Z = -1.15;

/** Wing geometry tip x: slightly past the pinned cap so the shape span clears 1.25. */
const WING_TIP_GEOMETRY_X = 1.66;

/** Wing extrusion thickness along the model y axis. */
const WING_THICKNESS = 0.08;

/** Wing leading-edge strip midpoint and height (design literals on the swept edge). */
const WING_LEADING_MID_X = 1.03;
const WING_LEADING_MID_Z = -0.1;
const WING_LEADING_Y = 0.045;

/** Wing panel-line layout: three chordwise seams per wing. */
const WING_SEAM_LAYOUT = [
  { x: 0.7, z: -0.5 },
  { x: 1.0, z: -0.65 },
  { x: 1.3, z: -0.72 },
] as const;

/** Engine nacelle centres (AC-9). */
const ENGINE_X = 1.1;
const ENGINE_Y = -0.05;
const ENGINE_Z = -1.0;

/** Engine rib positions along the nacelle. */
const ENGINE_RIB_Z = [-0.75, -1.25] as const;

/** Nozzle and exhaust positions along −z. */
const NOZZLE_Z = -1.68;
const FLAME_Z = -2.05;
const FLAME_CORE_Z = -2.15;

/** Mirror pairs: suffix plus the sign applied on x. */
const SHIP_SIDES = [
  { suffix: 'left', sign: -1 },
  { suffix: 'right', sign: 1 },
] as const;

/** Nacelle/pylons attach at the aft hull flanks. */
const PYLON_X = 0.62;
const PYLON_Y = -0.02;
const PYLON_Z = -0.9;

/** Thickness of every thin detail strip (well under the 0.06 local predicate). */
const DETAIL_THICKNESS = 0.03;

/** The hero model handed to the backdrop. */
export interface HeroSpaceshipModel {
  /** Root group (`name === 'hero-ship-model'`); scale/yaw/pitch pinned by AC-2/AC-6. */
  readonly group: Group;
  /** The 48 named meshes, in build order; every mesh is a direct child of {@link group}. */
  readonly meshes: readonly Mesh[];
  /** The two outer additive exhaust flames (`name === 'hero-engine'`). */
  readonly flames: readonly Mesh[];
  /** The two white-hot exhaust cores (`name === 'hero-engine-core'`). */
  readonly flameCores: readonly Mesh[];
  /** Triangles across the built geometries (AC-2: `> 0` and `<= 6000`). */
  readonly triangleCount: number;
  /** Releases each unique geometry/material once, clears the group; idempotent. */
  dispose(): void;
}

/** Fuselage radius at a model-local z, matching the built cylinder's linear taper. */
function hullRadiusAt(z: number): number {
  const frontFraction = (HULL_FRONT_Z - z) / HULL_LENGTH;
  return HULL_RADIUS_FRONT + frontFraction * (HULL_RADIUS_BACK - HULL_RADIUS_FRONT);
}

/** Triangles a geometry contributes to a draw (indexed or not). */
function countGeometryTriangles(geometry: BufferGeometry): number {
  const index = geometry.getIndex();
  if (index !== null) {
    return index.count / 3;
  }
  return geometry.getAttribute('position').count / 3;
}

/**
 * Builds one swept delta wing in shape space. The shape x axis is the wingspan axis and the
 * shape y axis is the model z (chord) axis; the mesh rotation lays it horizontal. The left
 * and right outlines keep the same counter-clockwise winding, so no mirrored normal flip is
 * needed.
 */
function createWingGeometry(sign: -1 | 1): ExtrudeGeometry {
  const rootX = sign * HERO_WING_ROOT_X;
  const tipX = sign * WING_TIP_GEOMETRY_X;
  const points: Array<readonly [number, number]> =
    sign < 0
      ? [
          [rootX, WING_ROOT_LEADING_Z],
          [tipX, WING_TIP_LEADING_Z],
          [tipX, WING_TRAILING_Z],
          [rootX, WING_TRAILING_Z],
        ]
      : [
          [rootX, WING_ROOT_LEADING_Z],
          [rootX, WING_TRAILING_Z],
          [tipX, WING_TRAILING_Z],
          [tipX, WING_TIP_LEADING_Z],
        ];

  const shape = new Shape();
  shape.moveTo(points[0]![0], points[0]![1]);
  for (let index = 1; index < points.length; index += 1) {
    shape.lineTo(points[index]![0], points[index]![1]);
  }
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth: WING_THICKNESS, bevelEnabled: false });
}

/**
 * Builds the detailed hero spaceship.
 *
 * Deterministic and self-contained: no parameters, no `random` draw, no scene, camera, DOM,
 * loader, texture, light or external asset. The caller owns the returned group and must call
 * {@link HeroSpaceshipModel.dispose} once when the backdrop is torn down.
 */
export function createHeroSpaceshipModel(): HeroSpaceshipModel {
  const group = new Group();
  group.name = 'hero-ship-model';
  group.scale.setScalar(HERO_SHIP_SCALE);
  group.rotation.x = -HERO_SHIP_PITCH;
  group.rotation.y = HERO_SHIP_YAW;
  group.rotation.z = 0;

  // Exactly 11 shared materials (AC-4). All of them are referenced by at least one mesh.
  const hullMaterial = new MeshPhysicalMaterial({
    color: HERO_HULL_COLOR,
    metalness: 0.45,
    roughness: 0.35,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
  });
  const lightPanelMaterial = new MeshPhysicalMaterial({
    color: HERO_PANEL_LIGHT,
    metalness: 0.25,
    roughness: 0.45,
    clearcoat: 0.4,
    clearcoatRoughness: 0.25,
  });
  const midPanelMaterial = new MeshPhysicalMaterial({
    color: HERO_PANEL_MID,
    metalness: 0.4,
    roughness: 0.4,
    clearcoat: 0.3,
  });
  const navyTrimMaterial = new MeshStandardMaterial({
    color: HERO_TRIM_NAVY,
    metalness: 0.5,
    roughness: 0.4,
  });
  const orangeAccentMaterial = new MeshPhysicalMaterial({
    color: HERO_ACCENT_ORANGE,
    emissive: HERO_ACCENT_ORANGE,
    emissiveIntensity: 0.4,
    metalness: 0.3,
    roughness: 0.4,
  });
  const canopyMaterial = new MeshPhysicalMaterial({
    color: HERO_CANOPY_COLOR,
    metalness: 0.2,
    roughness: 0.08,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    emissive: 0x0a3a44,
    emissiveIntensity: 0.35,
  });
  const canopyHighlightMaterial = new MeshBasicMaterial({
    color: HERO_CANOPY_HIGHLIGHT,
    transparent: true,
    opacity: 0.9,
  });
  const flameMaterial = new MeshBasicMaterial({
    color: HERO_FLAME_COLOR,
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  const flameCoreMaterial = new MeshBasicMaterial({ color: HERO_FLAME_CORE_COLOR });
  const engineHousingMaterial = new MeshPhysicalMaterial({
    color: HERO_ENGINE_HOUSING_COLOR,
    metalness: 0.45,
    roughness: 0.4,
    clearcoat: 0.4,
  });
  const engineNozzleMaterial = new MeshStandardMaterial({
    color: HERO_ENGINE_NOZZLE_COLOR,
    metalness: 0.6,
    roughness: 0.45,
  });
  const materials: readonly Material[] = [
    hullMaterial,
    lightPanelMaterial,
    midPanelMaterial,
    navyTrimMaterial,
    orangeAccentMaterial,
    canopyMaterial,
    canopyHighlightMaterial,
    flameMaterial,
    flameCoreMaterial,
    engineHousingMaterial,
    engineNozzleMaterial,
  ];

  const meshes: Mesh[] = [];
  const flames: Mesh[] = [];
  const flameCores: Mesh[] = [];

  /** Adds one shadow-free named mesh as a direct child of the model group. */
  function addMesh(name: string, geometry: BufferGeometry, material: Material): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    meshes.push(mesh);
    group.add(mesh);
    return mesh;
  }

  // Fuselage: low-poly 10-segment cylinder, axis moved to z and flattened vertically.
  const hullGeometry = new CylinderGeometry(
    HULL_RADIUS_FRONT,
    HULL_RADIUS_BACK,
    HULL_LENGTH,
    10,
  );
  hullGeometry.rotateX(Math.PI / 2);
  hullGeometry.scale(1, HULL_FLATTEN, 1);
  const hull = addMesh('hero-hull', hullGeometry, hullMaterial);
  hull.position.set(0, 0, HULL_FRONT_Z - HULL_LENGTH / 2);

  // Stepped two-tier mid/underside armor plate (the layered-armor read, F20).
  const underplateShape = new Shape();
  underplateShape.moveTo(-UNDERPLATE_AFT_HALF_WIDTH, UNDERPLATE_AFT_Z);
  underplateShape.lineTo(UNDERPLATE_AFT_HALF_WIDTH, UNDERPLATE_AFT_Z);
  underplateShape.lineTo(UNDERPLATE_AFT_HALF_WIDTH, UNDERPLATE_TIER_Z);
  underplateShape.lineTo(UNDERPLATE_FORE_HALF_WIDTH, UNDERPLATE_TIER_Z);
  underplateShape.lineTo(UNDERPLATE_FORE_HALF_WIDTH, UNDERPLATE_FORE_Z);
  underplateShape.lineTo(-UNDERPLATE_FORE_HALF_WIDTH, UNDERPLATE_FORE_Z);
  underplateShape.lineTo(-UNDERPLATE_FORE_HALF_WIDTH, UNDERPLATE_TIER_Z);
  underplateShape.lineTo(-UNDERPLATE_AFT_HALF_WIDTH, UNDERPLATE_TIER_Z);
  underplateShape.closePath();
  const underplateGeometry = new ExtrudeGeometry(underplateShape, {
    depth: UNDERPLATE_THICKNESS,
    bevelEnabled: false,
  });
  underplateGeometry.rotateX(Math.PI / 2);
  const underplate = addMesh('hero-hull-underside', underplateGeometry, lightPanelMaterial);
  underplate.position.set(0, -0.28, 0);

  // Pointed gray nose meeting the fuselage front.
  const noseGeometry = new ConeGeometry(0.3, 0.9, 10);
  noseGeometry.rotateX(Math.PI / 2);
  noseGeometry.scale(1, HULL_FLATTEN, 1);
  const nose = addMesh('hero-nose', noseGeometry, midPanelMaterial);
  nose.position.set(0, 0, 1.75);

  // Raised dorsal spine running from the cockpit to the tail.
  const spine = addMesh('hero-dorsal-spine', new BoxGeometry(0.16, 0.1, 2.0), hullMaterial);
  spine.position.set(0, SPINE_TOP_Y - 0.05, -0.15);

  // Cockpit: teal glass canopy with a gray bezel ring and a bright highlight strip.
  const cockpit = addMesh('hero-cockpit', new SphereGeometry(1, 16, 12), canopyMaterial);
  cockpit.position.set(0, 0.33, 0.82);
  cockpit.scale.set(0.2, 0.13, 0.32);

  const cockpitFrameGeometry = new TorusGeometry(0.27, 0.035, 6, 12);
  cockpitFrameGeometry.rotateX(Math.PI / 2);
  cockpitFrameGeometry.scale(1, 1, 1.2);
  const cockpitFrame = addMesh('hero-cockpit-frame', cockpitFrameGeometry, midPanelMaterial);
  cockpitFrame.position.set(0, 0.31, 0.82);

  const cockpitHighlight = addMesh(
    'hero-cockpit-highlight',
    new BoxGeometry(0.1, 0.012, 0.18),
    canopyHighlightMaterial,
  );
  cockpitHighlight.position.set(0.045, 0.462, 0.8);

  // Circumferential hull seams: thin open rings offset radially from the fuselage.
  for (let index = 0; index < HULL_SEAM_Z.length; index += 1) {
    const z = HULL_SEAM_Z[index]!;
    const seamRadius = hullRadiusAt(z) + HERO_DETAIL_OFFSET;
    const seamGeometry = new CylinderGeometry(seamRadius, seamRadius, 0.035, 10, 1, true);
    seamGeometry.rotateX(Math.PI / 2);
    seamGeometry.scale(1, HULL_FLATTEN, 1);
    const seam = addMesh(`hero-hull-seam-${index + 1}`, seamGeometry, navyTrimMaterial);
    seam.position.set(0, 0, z);
  }

  // Swept delta wings, gray leading edges, orange tip caps and three panel lines per wing.
  const leadingEdgeLength = Math.hypot(
    WING_TIP_GEOMETRY_X - HERO_WING_ROOT_X,
    WING_ROOT_LEADING_Z - WING_TIP_LEADING_Z,
  );
  const leadingEdgeAngle = Math.atan2(
    WING_ROOT_LEADING_Z - WING_TIP_LEADING_Z,
    WING_TIP_GEOMETRY_X - HERO_WING_ROOT_X,
  );

  for (const side of SHIP_SIDES) {
    const wing = addMesh(`hero-wing-${side.suffix}`, createWingGeometry(side.sign), hullMaterial);
    // Shape y maps to model z and the extrusion depth maps downwards on y.
    wing.rotation.x = Math.PI / 2;

    const leadingEdge = addMesh(
      `hero-wing-leading-${side.suffix}`,
      new BoxGeometry(leadingEdgeLength, 0.06, 0.06),
      midPanelMaterial,
    );
    leadingEdge.position.set(
      side.sign * WING_LEADING_MID_X,
      WING_LEADING_Y,
      WING_LEADING_MID_Z,
    );
    leadingEdge.rotation.y = side.sign * leadingEdgeAngle;

    const wingtip = addMesh(
      `hero-wingtip-${side.suffix}`,
      new BoxGeometry(0.08, 0.12, 0.62),
      orangeAccentMaterial,
    );
    wingtip.position.set(side.sign * HERO_WINGTIP_X, 0, -0.85);

    for (let index = 0; index < WING_SEAM_LAYOUT.length; index += 1) {
      const layout = WING_SEAM_LAYOUT[index]!;
      const seam = addMesh(
        `hero-wing-seam-${side.suffix}-${index + 1}`,
        new BoxGeometry(DETAIL_THICKNESS, DETAIL_THICKNESS, 0.6),
        navyTrimMaterial,
      );
      seam.position.set(side.sign * layout.x, 0.03, layout.z);
    }
  }

  // Canted tail fins with orange tips.
  for (const side of SHIP_SIDES) {
    const cant = -side.sign * 0.25;
    const fin = addMesh(
      `hero-tail-fin-${side.suffix}`,
      new BoxGeometry(0.05, 0.55, 0.5),
      navyTrimMaterial,
    );
    fin.position.set(side.sign * 0.42, 0.35, -1.25);
    fin.rotation.z = cant;

    const finTip = addMesh(
      `hero-tail-fin-tip-${side.suffix}`,
      new BoxGeometry(0.07, 0.12, 0.5),
      orangeAccentMaterial,
    );
    finTip.position.set(side.sign * 0.49, 0.65, -1.25);
    finTip.rotation.z = cant;
  }

  // Twin engine nacelles: pylons, housings, ring ribs, nozzles, flames and cores.
  for (const side of SHIP_SIDES) {
    const x = side.sign * ENGINE_X;

    const pylon = addMesh(
      `hero-engine-pylon-${side.suffix}`,
      new BoxGeometry(0.56, 0.08, 0.3),
      navyTrimMaterial,
    );
    pylon.position.set(side.sign * PYLON_X, PYLON_Y, PYLON_Z);

    const housingGeometry = new CylinderGeometry(0.22, 0.22, 1.2, 12);
    housingGeometry.rotateX(Math.PI / 2);
    const housing = addMesh(
      `hero-engine-housing-${side.suffix}`,
      housingGeometry,
      engineHousingMaterial,
    );
    housing.position.set(x, ENGINE_Y, ENGINE_Z);

    for (let index = 0; index < ENGINE_RIB_Z.length; index += 1) {
      const rib = addMesh(
        `hero-engine-rib-${side.suffix}-${index + 1}`,
        new TorusGeometry(0.24, 0.025, 6, 12),
        midPanelMaterial,
      );
      rib.position.set(x, ENGINE_Y, ENGINE_RIB_Z[index]!);
    }

    const nozzleGeometry = new CylinderGeometry(0.2, 0.26, 0.22, 12);
    nozzleGeometry.rotateX(Math.PI / 2);
    const nozzle = addMesh(
      `hero-engine-nozzle-${side.suffix}`,
      nozzleGeometry,
      engineNozzleMaterial,
    );
    nozzle.position.set(x, ENGINE_Y, NOZZLE_Z);

    // Outer flame: a cone pointing backwards (−z), additive and transparent.
    const flameGeometry = new ConeGeometry(0.18, 0.6, 10);
    flameGeometry.rotateX(-Math.PI / 2);
    const flame = addMesh('hero-engine', flameGeometry, flameMaterial);
    flame.position.set(x, ENGINE_Y, FLAME_Z);
    flames.push(flame);

    // White-hot core inside/behind the outer flame, slightly smaller and further back.
    const coreGeometry = new ConeGeometry(0.1, 0.38, 10);
    coreGeometry.rotateX(-Math.PI / 2);
    const core = addMesh('hero-engine-core', coreGeometry, flameCoreMaterial);
    core.position.set(x, ENGINE_Y, FLAME_CORE_Z);
    flameCores.push(core);
  }

  // Upper-side orange warning stripes.
  for (const side of SHIP_SIDES) {
    const stripe = addMesh(
      `hero-hull-stripe-${side.suffix}`,
      new BoxGeometry(0.04, 0.05, 1.4),
      orangeAccentMaterial,
    );
    stripe.position.set(side.sign * 0.365, 0.03, -0.15);
  }

  // Side vents, offset from the hull flanks.
  for (const side of SHIP_SIDES) {
    const vent = addMesh(
      `hero-vent-${side.suffix}`,
      new BoxGeometry(0.05, 0.1, 0.28),
      navyTrimMaterial,
    );
    vent.position.set(side.sign * 0.395, 0.12, -0.85);
  }

  // Dorsal antennae, standing on the spine with the pinned detail offset.
  const foreAntenna = addMesh(
    'hero-antenna-fore',
    new CylinderGeometry(0.012, 0.012, 0.25, 6),
    midPanelMaterial,
  );
  foreAntenna.position.set(0.03, 0.46, 0.32);
  const aftAntenna = addMesh(
    'hero-antenna-aft',
    new CylinderGeometry(0.012, 0.012, 0.25, 6),
    midPanelMaterial,
  );
  aftAntenna.position.set(-0.03, 0.46, -0.7);

  // Small rivet/greeble clusters on the spine.
  const greebleOne = addMesh(
    'hero-greeble-1',
    new BoxGeometry(0.09, 0.04, 0.12),
    navyTrimMaterial,
  );
  greebleOne.position.set(0, 0.355, 0.15);
  const greebleTwo = addMesh(
    'hero-greeble-2',
    new BoxGeometry(0.09, 0.04, 0.12),
    navyTrimMaterial,
  );
  greebleTwo.position.set(0, 0.355, -0.35);

  let triangleCount = 0;
  for (const mesh of meshes) {
    triangleCount += countGeometryTriangles(mesh.geometry);
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
    for (const material of new Set(materials)) {
      material.dispose();
    }
    meshes.length = 0;
    flames.length = 0;
    flameCores.length = 0;
    group.clear();
  }

  return {
    group,
    get meshes(): readonly Mesh[] {
      return meshes;
    },
    get flames(): readonly Mesh[] {
      return flames;
    },
    get flameCores(): readonly Mesh[] {
      return flameCores;
    },
    triangleCount,
    dispose,
  };
}
