import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Frustum,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { describe, expect, it, vi } from 'vitest';

import { BURST_ORIGIN_OFFSET, EXPLOSION_PARTICLE_COUNT, type Burst } from '../game/effects';
import { createEngine, type EffectIntent, type EngineSnapshot } from '../game/engine';
import { CUBE_STYLES } from '../game/progression';
import { FACE_IDS, GRID_SIZE, type CubeStyle, type FaceId, type MiniCubeId } from '../game/types';
import { CUBE_HALF_SIZE } from './cube-view';
import { createSceneView, introCameraPose, snapToQuarterTurns, type SceneView } from './scene';

/**
 * Integration tier the spec pins for `render/**`: the scene is exercised against real
 * three.js objects (node constructs them without a GL context) and every assertion below
 * reads the scene graph, an instance matrix, a material or the camera. The only boundary
 * that is faked is the session's `RendererAdapter` (`webgl.ts`/`session.ts`, T13) — and even
 * that fake only records what it receives, so the scene's real state stays under test.
 */

const STYLE = CUBE_STYLES[0]!;
const NEXT_STYLE = CUBE_STYLES[1]!;
const THIRD_STYLE = CUBE_STYLES[2]!;

/** Tile centre distance from the cube centre: `2.5 + 0.125` (see `cube-view.ts`). */
const TILE_DISTANCE = 2.625;

/** The `front:0:0` tile centre in cube-local (and, unrotated, world) space. */
const FRONT_FIRST_TILE: readonly [number, number, number] = [-2, 2, TILE_DISTANCE];

/** A random source that yields exactly zero star offsets and zero particle jitter. */
const fixedRandom = (): number => 0.5;

/** The narrow renderer surface the session hands the scene (plan § session contract). */
interface FakeRendererAdapter {
  setSize(width: number, height: number): void;
  setPixelRatio(ratio: number): void;
  render(scene: Scene, camera: PerspectiveCamera): void;
  dispose(): void;
}

/** Recording fake of {@link FakeRendererAdapter}; the scene must never call `dispose`. */
function createFakeAdapter(): {
  adapter: FakeRendererAdapter;
  sizes: Array<[number, number]>;
  ratios: number[];
  renders: Array<{ scene: Scene; camera: PerspectiveCamera }>;
  disposals: () => number;
} {
  const sizes: Array<[number, number]> = [];
  const ratios: number[] = [];
  const renders: Array<{ scene: Scene; camera: PerspectiveCamera }> = [];
  let disposals = 0;
  return {
    adapter: {
      setSize(width, height) {
        sizes.push([width, height]);
      },
      setPixelRatio(ratio) {
        ratios.push(ratio);
      },
      render(scene, camera) {
        renders.push({ scene, camera });
      },
      dispose() {
        disposals += 1;
      },
    },
    sizes,
    ratios,
    renders,
    disposals: () => disposals,
  };
}

/** A scene with a deterministic random source (see {@link fixedRandom}). */
function createView(style: CubeStyle = STYLE): SceneView {
  return createSceneView({ style, random: fixedRandom });
}

/**
 * One engine snapshot with the pinned playing defaults (plan D-6): the rest of the fields
 * come from a real engine, so no literal here names a field the engine may drop, and the
 * overrides pin the case at hand.
 */
function snapshot(overrides: Partial<EngineSnapshot> = {}): EngineSnapshot {
  return {
    ...createEngine({ random: fixedRandom }).getSnapshot(),
    phase: 'playing',
    phaseProgress: 1,
    ...overrides,
  };
}

/**
 * Applies one snapshot at frame time 0 — the pinned `SceneView.applySnapshot` signature
 * carries the loop's frame time, which the scene does not read (it applies snapshot
 * values only; the fades and pops are driven by `update`'s `dtMs`).
 */
function applySnapshot(view: SceneView, value: EngineSnapshot): void {
  view.applySnapshot(value, 0);
}

/** A burst of `count` immobile fragments (zero speed, zero jitter → they stay on origin). */
function staticBurst(count: number, lifetimeMs = 350): Burst {
  return {
    particles: Array.from({ length: count }, () => ({ dx: 0, dy: 1, dz: 0, speed: 0, size: 0.02 })),
    lifetimeMs,
  };
}

function explosionIntent(id: MiniCubeId, faceId: FaceId, count = 3): EffectIntent {
  return { kind: 'explosion', id, faceId, burst: staticBurst(count) };
}

function miniCubeId(faceId: FaceId, row: number, col: number): MiniCubeId {
  return `${faceId}:${row}:${col}` as MiniCubeId;
}

/** The starfield `Points`: the scene's only direct `Points` child (particles sit in a group). */
function starfieldPoints(view: SceneView): Points {
  const points = view.scene.children.find((child): child is Points => child instanceof Points);
  if (points === undefined) {
    throw new Error('the scene has no starfield Points');
  }
  return points;
}

/** The particle pool's `Points` (the group child holding a `Points`). */
function particlePoints(view: SceneView): Points {
  for (const child of view.scene.children) {
    if (!(child instanceof Group)) {
      continue;
    }
    const points = child.children.find((candidate): candidate is Points => candidate instanceof Points);
    if (points !== undefined) {
      return points;
    }
  }
  throw new Error('the scene has no particle Points');
}

/** The cube view's group: the scene group that holds the instanced mini-cube grids. */
function cubeGroup(view: SceneView): Group {
  const group = view.scene.children.find(
    (child): child is Group =>
      child instanceof Group && child.children.some((candidate) => candidate instanceof InstancedMesh),
  );
  if (group === undefined) {
    throw new Error('the scene has no cube group');
  }
  return group;
}

/** The face grids in `FACE_IDS` order (the order `cube-view.ts` builds them in). */
function faceMeshes(view: SceneView): InstancedMesh[] {
  return cubeGroup(view).children.filter(
    (child): child is InstancedMesh => child instanceof InstancedMesh,
  );
}

/** One face's instanced grid, addressed through the pinned `FACE_IDS` order. */
function faceMesh(view: SceneView, faceId: FaceId): InstancedMesh {
  const mesh = faceMeshes(view)[FACE_IDS.indexOf(faceId)];
  if (mesh === undefined) {
    throw new Error(`the scene has no instance mesh for ${faceId}`);
  }
  return mesh;
}

/** One face's base plate, addressed through the pinned `FACE_IDS` order. */
function facePlate(view: SceneView, faceId: FaceId): Mesh {
  const plates = cubeGroup(view).children.filter(
    (child): child is Mesh => child instanceof Mesh && child.geometry instanceof PlaneGeometry,
  );
  const plate = plates[FACE_IDS.indexOf(faceId)];
  if (plate === undefined) {
    throw new Error(`the scene has no plate for ${faceId}`);
  }
  return plate;
}

function plateMaterial(plate: Mesh): Material {
  return plate.material as Material;
}

/** The live position buffer of the particle pool. */
function particlePositions(view: SceneView): Float32Array {
  return particlePoints(view).geometry.getAttribute('position').array as Float32Array;
}

/** One instance's matrix from a face grid. */
function instanceMatrix(mesh: InstancedMesh, index: number): Matrix4 {
  const matrix = new Matrix4();
  mesh.getMatrixAt(index, matrix);
  return matrix;
}

/** The three scale factors of one instance: the length of each basis column. */
function instanceScale(mesh: InstancedMesh, index: number): number[] {
  const matrix = instanceMatrix(mesh, index);
  return [0, 1, 2].map((axis) => new Vector3().setFromMatrixColumn(matrix, axis).length());
}

/** The per-instance colour multiplier stored for one instance. */
function instanceColor(mesh: InstancedMesh, index: number): number[] {
  const color = mesh.instanceColor;
  if (color === null) {
    throw new Error('the face mesh has no instanceColor buffer');
  }
  return [color.getX(index), color.getY(index), color.getZ(index)];
}

/** Total number of three.js objects in the scene graph (groups, drawables and lights). */
function countObjects(root: Object3D): number {
  return 1 + root.children.reduce((total, child) => total + countObjects(child), 0);
}

/** The cube box: a `CUBE_SIZE` cube centred on the origin (spec AC-2 frustum gates). */
const CUBE_BOX = new Box3(
  new Vector3(-CUBE_HALF_SIZE, -CUBE_HALF_SIZE, -CUBE_HALF_SIZE),
  new Vector3(CUBE_HALF_SIZE, CUBE_HALF_SIZE, CUBE_HALF_SIZE),
);

/** The cube's eight corners, for the "fully framed" gate at the end of the find beat. */
const CUBE_CORNERS: readonly Vector3[] = [-1, 1].flatMap((sx) =>
  [-1, 1].flatMap((sy) =>
    [-1, 1].map((sz) => new Vector3(sx * CUBE_HALF_SIZE, sy * CUBE_HALF_SIZE, sz * CUBE_HALF_SIZE)),
  ),
);

/** The frustum of the scene's camera at the aspect the spec pins (16/9), at its current pose. */
function cameraFrustum(view: SceneView): Frustum {
  view.camera.aspect = 16 / 9;
  view.camera.updateProjectionMatrix();
  view.camera.updateMatrixWorld();
  return new Frustum().setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse),
  );
}

/**
 * The pinned intro pose table (spec AC-2). Every row is asserted as an exact literal; the
 * `p = 0.56` row is the only one whose f64 evaluation sits a few ulps below the table's
 * clean decimal values (0.56 is not binary-exact between the 0.4 and 0.72 segment bounds),
 * so its literals are the exact outputs of the pinned formulas, documented next to them.
 */
const INTRO_POSES: ReadonlyArray<{
  progress: number;
  position: [number, number, number];
  target: [number, number, number];
}> = [
  { progress: 0, position: [36, 20, 24], target: [0, 30, -40] },
  { progress: 0.2, position: [34, 18, 26], target: [0, 30, -40] },
  { progress: 0.4, position: [32, 16, 28], target: [0, 30, -40] },
  // 4 − 7e-15, 2 − 3.6e-15, 26.25 and 3.75 − 7e-15, −5 + 7e-15 (see the doc above).
  {
    progress: 0.56,
    position: [3.999999999999993, 1.9999999999999964, 26.25],
    target: [0, 3.749999999999993, -4.999999999999993],
  },
  { progress: 0.72, position: [0, 0, 26], target: [0, 0, 0] },
  { progress: 0.86, position: [0, 0, 13.75], target: [0, 0, 0] },
  { progress: 1, position: [0, 0, 12], target: [0, 0, 0] },
];

describe('scene composition', () => {
  it('sets a black background and assembles the starfield, lights, cube and particles (AC-16)', () => {
    const view = createView();

    expect(view.scene).toBeInstanceOf(Scene);
    expect(view.scene.background).toBeInstanceOf(Color);
    expect((view.scene.background as Color).getHex()).toBe(0x000000);

    // Starfield + cube + particles + two lights: a fixed, bounded child list.
    expect(view.scene.children).toHaveLength(5);
    expect(view.scene.children[0]).toBeInstanceOf(AmbientLight);
    expect(view.scene.children[1]).toBeInstanceOf(DirectionalLight);
    expect((view.scene.children[0] as AmbientLight).intensity).toBe(0.6);
    expect((view.scene.children[1] as DirectionalLight).intensity).toBe(1.2);
    expect((view.scene.children[1] as DirectionalLight).position.toArray()).toEqual([6, 8, 10]);

    // Exactly one starfield `Points` with exactly STAR_COUNT (1200) stars.
    expect(starfieldPoints(view)).toBeInstanceOf(Points);
    expect(starfieldPoints(view).geometry.getAttribute('position').count).toBe(1200);

    // One instanced grid per face, `GRID_SIZE²` = 25 instances each, and no third drawable
    // in the cube group: body + 6 grids + 6 plates = 13 children (AC-6).
    expect(faceMeshes(view)).toHaveLength(6);
    expect(faceMeshes(view).map((mesh) => mesh.count)).toEqual([25, 25, 25, 25, 25, 25]);
    expect(cubeGroup(view).children).toHaveLength(13);

    // One pooled particle `Points` (never a `Points` per explosion).
    expect(particlePoints(view)).toBeInstanceOf(Points);
    expect(particlePoints(view).geometry.getAttribute('position').count).toBe(72);
  });

  it('falls back to the pinned grid and a non-injected random source', () => {
    const view = createSceneView({ style: STYLE });

    expect(starfieldPoints(view).geometry.getAttribute('position').count).toBe(1200);
    expect(faceMeshes(view)).toHaveLength(6);
    expect(faceMeshes(view)[0]!.count).toBe(25);
    expect(view.camera.position.toArray()).toEqual([0, 0, 12]);
  });

  it('renders through the pinned adapter surface and never disposes the renderer', () => {
    const view = createView();
    const fake = createFakeAdapter();

    fake.adapter.setSize(1280, 720);
    fake.adapter.setPixelRatio(2);
    applySnapshot(view, snapshot());
    fake.adapter.render(view.scene, view.camera);

    expect(fake.sizes).toEqual([[1280, 720]]);
    expect(fake.ratios).toEqual([2]);
    expect(fake.renders).toHaveLength(1);
    expect(fake.renders[0]!.scene).toBe(view.scene);
    expect(fake.renders[0]!.camera).toBe(view.camera);

    view.dispose();

    // The renderer belongs to the session (T13); composing the scene must leave it alone.
    expect(fake.disposals()).toBe(0);
  });

  it('pins the camera lens and the rest position looking at the origin (AC-2)', () => {
    const view = createView();

    expect(view.camera).toBeInstanceOf(PerspectiveCamera);
    expect(view.camera.fov).toBe(50);
    expect(view.camera.near).toBe(0.1);
    expect(view.camera.far).toBe(200);
    expect(view.camera.aspect).toBe(1);
    expect(view.camera.position.toArray()).toEqual([0, 0, 12]);
    expect(view.camera.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  });
});

describe('introCameraPose (AC-2)', () => {
  it('yields the pinned pose table for every row', () => {
    for (const { progress, position, target } of INTRO_POSES) {
      const outPosition = new Vector3();
      const outTarget = new Vector3();

      introCameraPose(progress, outPosition, outTarget);

      expect(outPosition.toArray()).toEqual(position);
      expect(outTarget.toArray()).toEqual(target);
    }
  });

  it('clamps the progress to the ends of the table', () => {
    const outPosition = new Vector3();
    const outTarget = new Vector3();

    introCameraPose(-1, outPosition, outTarget);
    expect(outPosition.toArray()).toEqual([36, 20, 24]);
    expect(outTarget.toArray()).toEqual([0, 30, -40]);

    introCameraPose(2, outPosition, outTarget);
    expect(outPosition.toArray()).toEqual([0, 0, 12]);
    expect(outTarget.toArray()).toEqual([0, 0, 0]);
  });
});

describe('snapToQuarterTurns (AC-3)', () => {
  it('snaps quarter-turn trig residue to the integer and normalises -0', () => {
    const normal = new Vector3(1, 0, 6.123233995736766e-17);

    expect(snapToQuarterTurns(normal).toArray()).toEqual([1, 0, 0]);

    const negative = new Vector3(-6.123233995736766e-17, -1, 2.4492935982947064e-16);
    expect(snapToQuarterTurns(negative).toArray()).toEqual([0, -1, 0]);
  });

  it('leaves genuine in-between components untouched', () => {
    const between = new Vector3(0.5, -0.25, 0.125);

    expect(snapToQuarterTurns(between).toArray()).toEqual([0.5, -0.25, 0.125]);

    // Just outside the pinned epsilon: still untouched.
    const near = new Vector3(2e-9, 1, 0);
    expect(snapToQuarterTurns(near).toArray()).toEqual([2e-9, 1, 0]);
  });
});

describe('intro search → find → approach (AC-2)', () => {
  it('follows the pinned pose table through applySnapshot', () => {
    const view = createView();

    for (const { progress, position } of INTRO_POSES) {
      applySnapshot(view, snapshot({ phase: 'intro', phaseProgress: progress }));
      expect(view.camera.position.toArray()).toEqual(position);
    }
  });

  it('looks exactly down the cube axis at the end of the find and the whole approach', () => {
    const view = createView();

    for (const phaseProgress of [0.72, 0.86, 1]) {
      applySnapshot(view, snapshot({ phase: 'intro', phaseProgress }));
      expect(view.camera.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    }
  });

  it('searches off-screen, finds the cube centred and frames it fully (frustum gates)', () => {
    const view = createView();

    for (const phaseProgress of [0, 0.2, 0.4]) {
      applySnapshot(view, snapshot({ phase: 'intro', phaseProgress }));
      const frustum = cameraFrustum(view);

      expect(frustum.intersectsBox(CUBE_BOX)).toBe(false);
      expect(frustum.containsPoint(new Vector3(0, 0, 0))).toBe(false);
    }

    applySnapshot(view, snapshot({ phase: 'intro', phaseProgress: 0.56 }));
    const found = cameraFrustum(view);
    expect(found.containsPoint(new Vector3(0, 0, 0))).toBe(true);

    applySnapshot(view, snapshot({ phase: 'intro', phaseProgress: 0.72 }));
    const framed = cameraFrustum(view);
    expect(CUBE_CORNERS.map((corner) => framed.containsPoint(corner))).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it('lands on the playing rest pose after a skip, whatever the intro progress was', () => {
    const view = createView();

    applySnapshot(view, snapshot({ phase: 'intro', phaseProgress: 0.2 }));
    expect(view.camera.position.toArray()).toEqual([34, 18, 26]);

    applySnapshot(view, snapshot({ phase: 'playing' }));
    expect(view.camera.position.toArray()).toEqual([0, 0, 12]);
    expect(view.camera.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  });

  it('keeps the camera at rest through both flown phases under reduced motion', () => {
    const view = createView();

    applySnapshot(view, snapshot({ phase: 'intro', phaseProgress: 0 }));
    expect(view.camera.position.toArray()).toEqual([36, 20, 24]);

    for (const phase of ['intro', 'travel'] as const) {
      for (const phaseProgress of [0, 0.5, 1]) {
        applySnapshot(view, snapshot({ phase, phaseProgress, reducedMotion: true }));
        expect(view.camera.position.toArray()).toEqual([0, 0, 12]);
        expect(view.camera.quaternion.toArray()).toEqual([0, 0, 0, 1]);
      }
    }

    // No fly-through also means no starfield expansion.
    view.update(16);
    expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1]);
  });

  it('pulls away during travel through (0,0,21.75) and (0,0,51) to (0,0,90)', () => {
    const view = createView();

    // The one-shot travel marker carries no state: the flight is snapshot-driven.
    view.applyIntents([{ kind: 'travelStarted' }], 0);
    expect(view.camera.position.toArray()).toEqual([0, 0, 12]);

    applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 0.25 }));
    expect(view.camera.position.toArray()).toEqual([0, 0, 21.75]);

    applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 0.5 }));
    expect(view.camera.position.toArray()).toEqual([0, 0, 51]);

    applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 1 }));
    expect(view.camera.position.toArray()).toEqual([0, 0, 90]);

    applySnapshot(view, snapshot({ phase: 'playing' }));
    expect(view.camera.position.toArray()).toEqual([0, 0, 12]);
  });
});

describe('starfield travel expansion (AC-1)', () => {
  it('drives the in-plane expansion from the travel progress and keeps it across progress-less frames', () => {
    const view = createView();
    expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1]);

    applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 0.25 }));
    view.update(16);
    expect(starfieldPoints(view).scale.toArray()).toEqual([1.875, 1.875, 1]);

    applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 0.5 }));
    view.update(16);
    expect(starfieldPoints(view).scale.toArray()).toEqual([4.5, 4.5, 1]);

    applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 0.75 }));
    view.update(16);
    expect(starfieldPoints(view).scale.toArray()).toEqual([7.125, 7.125, 1]);

    // Frames that only advance time keep the expansion (no snapshot in between).
    view.update(16);
    expect(starfieldPoints(view).scale.toArray()).toEqual([7.125, 7.125, 1]);

    applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 1 }));
    view.update(16);
    expect(starfieldPoints(view).scale.toArray()).toEqual([8, 8, 1]);

    applySnapshot(view, snapshot({ phase: 'playing' }));
    view.update(16);
    expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1]);
  });

  it('drifts the starfield through update and never rebuilds it', () => {
    const view = createView();
    const points = starfieldPoints(view);

    view.update(1000);
    expect(points.rotation.y).toBe(0.0152587890625);

    view.update(16);
    applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 0.5 }));
    view.update(16);

    expect(starfieldPoints(view)).toBe(points);
    expect(starfieldPoints(view).scale.toArray()).toEqual([4.5, 4.5, 1]);
  });
});

describe('snapshot application', () => {
  it("sets the cube rotation through T3's pinned frame (pitch, yaw, 0)", () => {
    const view = createView();

    applySnapshot(
      view,
      snapshot({
        orientation: { yawSteps: 1, pitchSteps: 0 },
        rotationFrom: { yawSteps: 0, pitchSteps: 0 },
        rotationProgress: 0.5,
      }),
    );
    expect(cubeGroup(view).rotation.x).toBe(0);
    expect(cubeGroup(view).rotation.y).toBe(Math.PI / 4);
    expect(cubeGroup(view).rotation.z).toBe(0);

    // Settled orientation (no animation) renders the quarter-turn counters exactly.
    applySnapshot(
      view,
      snapshot({
        orientation: { yawSteps: 3, pitchSteps: 1 },
        rotationFrom: null,
        rotationProgress: 1,
      }),
    );
    expect(cubeGroup(view).rotation.x).toBe(Math.PI / 2);
    expect(cubeGroup(view).rotation.y).toBe(3 * (Math.PI / 2));
  });

  it('rebuilds the cube when the snapshot style changes without its levelChanged intent', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const before = cubeGroup(view);

    applySnapshot(view, snapshot({ style: THIRD_STYLE, levelIndex: 2 }));
    const after = cubeGroup(view);

    expect(after).not.toBe(before);
    expect(view.scene.children).not.toContain(before);
    expect(
      ((after.children[0] as Mesh).material as MeshStandardMaterial).color.getHexString(),
    ).toBe('0a1410');

    // Re-applying the same style is not a rebuild.
    applySnapshot(view, snapshot({ style: THIRD_STYLE, levelIndex: 2 }));
    expect(cubeGroup(view)).toBe(after);
  });
});

describe('intent application', () => {
  it('pops the exploding tile and fronts its burst at the clicked surface (AC-3, AC-4)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const mesh = faceMesh(view, 'front');

    // The live tile occupies row 0, col 0 → its matrix starts at the pinned position.
    expect(new Vector3().setFromMatrixPosition(instanceMatrix(mesh, 0)).toArray()).toEqual([
      ...FRONT_FIRST_TILE,
    ]);

    view.applyIntents([explosionIntent('front:0:0', 'front')], 100);

    // Marked hidden (unpickable) at intent time, but the tile itself has not shrunk yet.
    expect(view.cubeView.isMiniCubeHidden('front:0:0')).toBe(true);
    expect(instanceScale(mesh, 0)).toEqual([Math.fround(0.9), Math.fround(0.9), Math.fround(0.25)]);

    // t = 50: the pop is expanding (factor 1.05, multiplier 1.15).
    view.update(50);
    expect(instanceScale(mesh, 0)).toEqual([
      Math.fround(0.9 * 1.05),
      Math.fround(0.9 * 1.05),
      Math.fround(0.25 * 1.05),
    ]);
    expect(instanceColor(mesh, 0)).toEqual([
      Math.fround(1.15),
      Math.fround(1.15),
      Math.fround(1.15),
    ]);

    // t = 160: the predecessor's hidden end state, position preserved.
    view.update(110);
    expect(instanceScale(mesh, 0)).toEqual([0, 0, 0]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);
    expect(new Vector3().setFromMatrixPosition(instanceMatrix(mesh, 0)).toArray()).toEqual([
      ...FRONT_FIRST_TILE,
    ]);

    // Every other tile is untouched.
    expect(instanceScale(mesh, 1)[0]).toBe(Math.fround(0.9));

    // The burst plays in front of the tile: origin (−2, 2, 2.625) + 0.5 · (0, 0, 1).
    const positions = particlePositions(view);
    expect(particlePoints(view).geometry.drawRange.count).toBe(3);
    expect([positions[0], positions[1], positions[2]]).toEqual([-2, 2, 3.125]);
    expect([positions[3], positions[4], positions[5]]).toEqual([-2, 2, 3.125]);
    expect(BURST_ORIGIN_OFFSET).toBe(0.5);
  });

  it('follows the cube rotation when placing an explosion origin and normal', () => {
    const view = createView();
    applySnapshot(view, snapshot({ orientation: { yawSteps: 1, pitchSteps: 0 } }));

    view.applyIntents([explosionIntent('front:0:0', 'front')], 0);

    // +1 yaw is +90° about +Y: the tile at (−2, 2, 2.625) lands at (2.625, 2, 2) and the
    // front normal turns into +X; the quarter-turn trig residue is snapped away.
    const positions = particlePositions(view);
    expect([positions[0], positions[1], positions[2]]).toEqual([3.125, 2, 2]);
  });

  it('falls back to the cube centre when the exploding face is already gone', () => {
    const view = createView();
    applySnapshot(view, snapshot());

    view.applyIntents([{ kind: 'faceCleared', faceId: 'back' }], 0);
    view.update(400);
    expect(faceMeshes(view)).toHaveLength(5);

    view.applyIntents([explosionIntent('back:0:0', 'back', 2)], 500);

    // No instance left to read an origin (or a normal) from: the burst plays at the centre.
    const positions = particlePositions(view);
    expect(particlePoints(view).geometry.drawRange.count).toBe(2);
    expect([positions[0], positions[1], positions[2]]).toEqual([0, 0, 0]);
  });

  it('hides instantly with no flash under reduced motion', () => {
    const view = createView();
    applySnapshot(view, snapshot({ reducedMotion: true }));
    const mesh = faceMesh(view, 'front');

    view.applyIntents([explosionIntent('front:0:0', 'front', 0)], 0);

    // No record: the tile is zero-scaled at once and its colour is never written.
    expect(instanceScale(mesh, 0)).toEqual([0, 0, 0]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);
    expect(particlePoints(view).geometry.drawRange.count).toBe(0);

    view.update(50);
    expect(instanceScale(mesh, 0)).toEqual([0, 0, 0]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);
  });

  it('settles a running pop when the snapshot switches to reduced motion (AC-4)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const mesh = faceMesh(view, 'front');

    view.applyIntents([explosionIntent('front:0:0', 'front')], 0);
    view.update(50);
    expect(instanceScale(mesh, 0)[0]).toBe(Math.fround(0.9 * 1.05));

    applySnapshot(view, snapshot({ reducedMotion: true }));

    expect(instanceScale(mesh, 0)).toEqual([0, 0, 0]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);

    view.update(50);
    expect(instanceScale(mesh, 0)).toEqual([0, 0, 0]);
  });

  it('fades a cleared face over the pinned 400 ms and then removes and disposes it (AC-9)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const plate = facePlate(view, 'back');
    const mesh = faceMesh(view, 'back');
    const plateDispose = vi.spyOn(plateMaterial(plate), 'dispose');
    const geometryDispose = vi.spyOn(plate.geometry, 'dispose');

    view.applyIntents([{ kind: 'faceCleared', faceId: 'back' }], 0);
    expect(plateMaterial(plate).opacity).toBe(1);
    expect(plate.visible).toBe(true);

    view.update(200);
    expect(plateMaterial(plate).opacity).toBe(0.5);
    expect(plate.visible).toBe(true);

    view.update(200);
    expect(plateMaterial(plate).opacity).toBe(0);
    expect(plate.visible).toBe(false);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(plateDispose).toHaveBeenCalledTimes(1);

    // The face left the scene; the other five stay playable.
    expect(faceMeshes(view)).toHaveLength(5);
    expect(faceMeshes(view)).not.toContain(mesh);
    expect(cubeGroup(view).children).not.toContain(plate);
  });

  it('fades a cleared face over the reduced 100 ms under reduced motion', () => {
    const view = createView();
    applySnapshot(view, snapshot({ reducedMotion: true }));
    const plate = facePlate(view, 'left');

    view.applyIntents([{ kind: 'faceCleared', faceId: 'left' }], 0);

    view.update(50);
    expect(plateMaterial(plate).opacity).toBe(0.5);
    expect(faceMeshes(view)).toHaveLength(6);

    view.update(50);
    expect(plate.visible).toBe(false);
    expect(faceMeshes(view)).toHaveLength(5);
  });

  it('does not restart a running fade when faceCleared is applied again', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const plate = facePlate(view, 'right');
    const plateDispose = vi.spyOn(plateMaterial(plate), 'dispose');

    view.applyIntents([{ kind: 'faceCleared', faceId: 'right' }], 0);
    view.update(200);
    expect(plateMaterial(plate).opacity).toBe(0.5);

    // A repeated intent must not reset the half-finished fade.
    view.applyIntents([{ kind: 'faceCleared', faceId: 'right' }], 0);
    view.update(200);

    expect(faceMeshes(view)).toHaveLength(5);
    expect(plateDispose).toHaveBeenCalledTimes(1);
  });

  it('exposes the live cube view through the rebuild-aware accessor (plan-r3 seam, AC-6)', () => {
    const view = createView();
    const initial = view.cubeView;

    // The accessor answers with the cube view the scene holds right now.
    expect(initial.group).toBe(cubeGroup(view));
    expect((initial.body.material as MeshStandardMaterial).color.getHexString()).toBe('0b0b12');

    view.applyIntents([{ kind: 'levelChanged', style: NEXT_STYLE }], 16);

    // A handle captured once would now be the disposed previous view: the accessor follows
    // the rebuild instead.
    expect(view.cubeView).not.toBe(initial);
    expect(view.cubeView.group).toBe(cubeGroup(view));
    expect(view.cubeView.group).not.toBe(initial.group);
    expect(view.scene.children).not.toContain(initial.group);
    expect((view.cubeView.body.material as MeshStandardMaterial).color.getHexString()).toBe(
      '1a0b0e',
    );
    // The stale handle is untouched by the rebuild — it was a different cube view.
    expect((initial.body.material as MeshStandardMaterial).color.getHexString()).toBe('0b0b12');
  });

  it('rebuilds the cube view in the new style on levelChanged (AC-10)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const before = cubeGroup(view);
    const body = before.children[0] as Mesh;
    const bodyDispose = vi.spyOn(body.geometry, 'dispose');
    const frontMesh = faceMesh(view, 'front');

    // A cleared face from the previous level must not survive the rebuild.
    view.applyIntents([explosionIntent('front:0:0', 'front')], 0);
    view.applyIntents([{ kind: 'levelChanged', style: NEXT_STYLE }], 16);

    const after = cubeGroup(view);
    expect(after).not.toBe(before);
    expect(view.scene.children).not.toContain(before);
    expect(bodyDispose).toHaveBeenCalledTimes(1);
    expect(faceMeshes(view)).toHaveLength(6);
    expect(faceMeshes(view)).not.toContain(frontMesh);

    // Fresh, fully visible grid in the new style's palette.
    const newFront = faceMesh(view, 'front');
    expect(instanceMatrix(newFront, 0).elements[0]).toBe(Math.fround(0.9));
    expect(((after.children[0] as Mesh).material as MeshStandardMaterial).color.getHexString()).toBe(
      '1a0b0e',
    );
    expect(
      (newFront.material as MeshStandardMaterial).color.getHexString(),
    ).toBe('ff4d6d');
  });
});

describe('frame updates and lifecycle', () => {
  it('ages a burst and releases it after its lifetime', () => {
    const view = createView();
    applySnapshot(view, snapshot());

    view.applyIntents([explosionIntent('front:0:0', 'front', EXPLOSION_PARTICLE_COUNT)], 0);
    expect(particlePoints(view).geometry.drawRange.count).toBe(24);

    view.update(349);
    expect(particlePoints(view).geometry.drawRange.count).toBe(24);

    view.update(1);
    expect(particlePoints(view).geometry.drawRange.count).toBe(0);
  });

  it('returns to the baseline object counts after 10 explosion cycles (AC-16)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const baselineChildren = view.scene.children.length;
    const baselineObjects = countObjects(view.scene);
    const starfield = starfieldPoints(view);
    const particles = particlePoints(view);

    for (let cycle = 0; cycle < 10; cycle += 1) {
      const row = cycle % GRID_SIZE;
      const id = miniCubeId('front', row, row);
      view.applyIntents([explosionIntent(id, 'front', EXPLOSION_PARTICLE_COUNT)], cycle * 400);
      expect(particlePoints(view).geometry.drawRange.count).toBe(24);
      view.update(350);
      expect(particlePoints(view).geometry.drawRange.count).toBe(0);
      expect(instanceScale(faceMesh(view, 'front'), row * GRID_SIZE + row)).toEqual([0, 0, 0]);
    }

    // The pool, the starfield and the scene graph are reused — nothing grows per cycle.
    expect(countObjects(view.scene)).toBe(baselineObjects);
    expect(view.scene.children).toHaveLength(baselineChildren);
    expect(starfieldPoints(view)).toBe(starfield);
    expect(particlePoints(view)).toBe(particles);
  });

  it('disposes every resource exactly once and is idempotent (AC-15)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const starfield = starfieldPoints(view);
    const particles = particlePoints(view);
    const body = cubeGroup(view).children[0] as Mesh;
    const frontPlate = facePlate(view, 'front');

    const spies = [
      vi.spyOn(starfield.geometry, 'dispose'),
      vi.spyOn(starfield.material as Material, 'dispose'),
      vi.spyOn(particles.geometry, 'dispose'),
      vi.spyOn(particles.material as Material, 'dispose'),
      vi.spyOn(body.geometry, 'dispose'),
      vi.spyOn(body.material as Material, 'dispose'),
      vi.spyOn(faceMesh(view, 'front').geometry, 'dispose'),
      vi.spyOn(faceMesh(view, 'front').material as Material, 'dispose'),
      vi.spyOn(frontPlate.geometry, 'dispose'),
      vi.spyOn(plateMaterial(frontPlate), 'dispose'),
    ];

    view.dispose();
    view.dispose();

    for (const spy of spies) {
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith();
    }
    expect(view.scene.children).toEqual([]);
  });
});
