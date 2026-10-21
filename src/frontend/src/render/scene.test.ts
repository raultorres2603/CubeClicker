import {
  AmbientLight,
  Color,
  DirectionalLight,
  Frustum,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
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
import {
  FACE_IDS,
  GRID_SIZE,
  type CubeStyle,
  type FaceId,
  type MiniCubeId,
  type TravelDirection,
} from '../game/types';
import { CUBE_HALF_SIZE } from './cube-view';
import {
  createSceneView,
  CUBE_SPACING,
  introCameraPose,
  snapToQuarterTurns,
  TRAVEL_DIRECTION_OFFSETS,
  travelCameraPose,
  type SceneView,
} from './scene';
import { STARFIELD_TAN } from './starfield';

/**
 * Integration tier the spec pins for `render/**`: the scene is exercised against real
 * three.js objects (node constructs them without a GL context) and every assertion below
 * reads the scene graph, an instance matrix, a material or the camera. The only boundary
 * that is faked is the session's `RendererAdapter` (`webgl.ts`/`session.ts`) — and even
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

/** Deterministic LCG (same seed → same stream); mirrors the engine's seeded sources. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

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
function createView(style: CubeStyle = STYLE, gridSize?: number): SceneView {
  return createSceneView({ style, random: fixedRandom, gridSize });
}

/**
 * A scene whose starfield comes from the pinned density seed (7): the starfield consumes
 * its 4 × `STAR_COUNT` draws before the particle pool, so the seed fixes the sky exactly.
 */
const DENSITY_SEED = 7;

function createSeededView(): SceneView {
  return createSceneView({ style: STYLE, random: seededRandom(DENSITY_SEED) });
}

/**
 * One engine snapshot with the pinned playing defaults: the rest of the fields come from a
 * real engine, so no literal here names a field the engine may drop, and the overrides pin
 * the case at hand.
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
 * values only; the removals and pops are driven by `update`'s `dtMs`).
 */
function applySnapshot(view: SceneView, value: EngineSnapshot): void {
  view.applySnapshot(value, 0);
}

/** Applies one intent list at frame time 0. */
function applyIntents(view: SceneView, intents: EffectIntent[]): void {
  view.applyIntents(intents, 0);
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

/** The cube's eight corners around a world position, for the framing gates (AC-3). */
function cubeCorners(centreX: number, centreY: number): Vector3[] {
  return [-1, 1].flatMap((sx) =>
    [-1, 1].flatMap((sy) =>
      [-1, 1].map(
        (sz) =>
          new Vector3(
            centreX + sx * CUBE_HALF_SIZE,
            centreY + sy * CUBE_HALF_SIZE,
            sz * CUBE_HALF_SIZE,
          ),
      ),
    ),
  );
}

/** The supported aspect ratios the spec pins coverage/framing for (AC-1, AC-2). */
const SUPPORTED_ASPECTS: readonly number[] = [2 / 3, 16 / 9, 7 / 3];

/** The view axis every pinned camera pose looks down. */
const VIEW_AXIS = new Vector3(0, 0, 1);

/** The frustum of the scene's camera at `aspect`, at its current pose. */
function cameraFrustumAt(view: SceneView, aspect: number): Frustum {
  view.camera.aspect = aspect;
  view.camera.updateProjectionMatrix();
  view.camera.updateMatrixWorld();
  return new Frustum().setFromProjectionMatrix(
    new Matrix4().multiplyMatrices(view.camera.projectionMatrix, view.camera.matrixWorldInverse),
  );
}

/** Whether every cube corner is inside the camera frustum at `aspect`. */
function framesCube(view: SceneView, corners: Vector3[], aspect: number): boolean[] {
  const frustum = cameraFrustumAt(view, aspect);
  return corners.map((corner) => frustum.containsPoint(corner));
}

/**
 * Where the camera's view ray crosses the world plane z = 0 — the point `lookAt` aimed at.
 * With the identity quaternion this is exactly `(camera.x, camera.y, 0)`.
 */
function lookTarget(view: SceneView): number[] {
  const forward = new Vector3(0, 0, -1).applyQuaternion(view.camera.quaternion);
  const distance = -view.camera.position.z / forward.z;
  const point = view.camera.position.clone().addScaledVector(forward, distance);
  return [point.x + 0, point.y + 0, point.z + 0];
}

/**
 * The four NDC corner rays of the real camera frustum, expressed as starfield-cone slopes.
 *
 * The cone is anchored to the camera and turned by `swirl` about the view axis, so a
 * world-space ray is rotated back by `−swirl` to express it in the cone's local frame. The
 * travel scale `(S, S, 1)` multiplies the stars' slopes by `S`, so the frustum slopes are
 * divided by `S` to compare against the unscaled square cone's half-tan (equivalent to
 * checking `|slope| ≤ S · STARFIELD_TAN`). Slopes are `x / depth` and `y / depth` with
 * `depth = −z` (the anchored local frame puts every star at `z = −depth`).
 */
function cornerSlopes(
  view: SceneView,
  aspect: number,
  swirl: number,
  scale: number,
): Array<readonly [number, number]> {
  view.camera.aspect = aspect;
  view.camera.updateProjectionMatrix();
  view.camera.updateMatrixWorld(true);

  const slopes: Array<readonly [number, number]> = [];
  for (const ndcX of [-1, 1]) {
    for (const ndcY of [-1, 1]) {
      const near = new Vector3(ndcX, ndcY, -1).unproject(view.camera);
      const far = new Vector3(ndcX, ndcY, 1).unproject(view.camera);
      const direction = far.sub(near).normalize().applyAxisAngle(VIEW_AXIS, -swirl);
      slopes.push([direction.x / -direction.z / scale, direction.y / -direction.z / scale]);
    }
  }
  return slopes;
}

/**
 * Projects every star through the real camera and partitions the NDC viewport into a 4 × 4
 * grid (`row * 4 + col`, row 0 = bottom). Returns the in-viewport total and the per-cell
 * counts — the AC-1 density measure.
 */
function ndcStarCells(view: SceneView, aspect: number): { total: number; cells: number[] } {
  view.camera.aspect = aspect;
  view.camera.updateProjectionMatrix();
  view.camera.updateMatrixWorld(true);

  const points = starfieldPoints(view);
  points.updateMatrixWorld(true);
  const position = points.geometry.getAttribute('position');
  const cells = new Array<number>(16).fill(0);
  const projected = new Vector3();
  let total = 0;

  for (let index = 0; index < position.count; index += 1) {
    projected.fromBufferAttribute(position, index).applyMatrix4(points.matrixWorld).project(view.camera);
    if (projected.x < -1 || projected.x > 1 || projected.y < -1 || projected.y > 1) {
      continue;
    }
    total += 1;
    const col = Math.min(3, Math.max(0, Math.floor(((projected.x + 1) / 2) * 4)));
    const row = Math.min(3, Math.max(0, Math.floor(((projected.y + 1) / 2) * 4)));
    cells[row * 4 + col] += 1;
  }

  return { total, cells };
}

/**
 * The pinned intro pose table (spec AC-2, § 2): a straight dolly from `(0, 0, 60)` to the
 * rest pose `(0, 0, 12)`, always looking at the cube. Every row is an exact literal (all
 * dyadic-exact doubles) and the quaternion is the identity at every row.
 */
const INTRO_POSES: ReadonlyArray<{
  progress: number;
  position: [number, number, number];
  target: [number, number, number];
}> = [
  { progress: 0, position: [0, 0, 60], target: [0, 0, 0] },
  { progress: 0.25, position: [0, 0, 32.25], target: [0, 0, 0] },
  { progress: 0.5, position: [0, 0, 18], target: [0, 0, 0] },
  { progress: 0.75, position: [0, 0, 12.75], target: [0, 0, 0] },
  { progress: 1, position: [0, 0, 12], target: [0, 0, 0] },
];

/**
 * The pinned directional travel pose table (spec § 3, revision r2 — formula-authoritative):
 * lateral `easeInOutQuad(p) · offset`, depth `12 + 78 · travelSwing(p)`, target the lateral
 * point `(x(p), y(p), 0)`. Every cell is an exact literal.
 */
const TRAVEL_PROGRESSES: readonly number[] = [0, 0.25, 0.5, 0.75, 1];

const TRAVEL_POSES: Readonly<
  Record<
    TravelDirection,
    ReadonlyArray<{ position: [number, number, number]; target: [number, number, number] }>
  >
> = {
  right: [
    { position: [0, 0, 12], target: [0, 0, 0] },
    { position: [3, 0, 51], target: [3, 0, 0] },
    { position: [12, 0, 90], target: [12, 0, 0] },
    { position: [21, 0, 51], target: [21, 0, 0] },
    { position: [24, 0, 12], target: [24, 0, 0] },
  ],
  left: [
    { position: [0, 0, 12], target: [0, 0, 0] },
    { position: [-3, 0, 51], target: [-3, 0, 0] },
    { position: [-12, 0, 90], target: [-12, 0, 0] },
    { position: [-21, 0, 51], target: [-21, 0, 0] },
    { position: [-24, 0, 12], target: [-24, 0, 0] },
  ],
  top: [
    { position: [0, 0, 12], target: [0, 0, 0] },
    { position: [0, 3, 51], target: [0, 3, 0] },
    { position: [0, 12, 90], target: [0, 12, 0] },
    { position: [0, 21, 51], target: [0, 21, 0] },
    { position: [0, 24, 12], target: [0, 24, 0] },
  ],
  bottom: [
    { position: [0, 0, 12], target: [0, 0, 0] },
    { position: [0, -3, 51], target: [0, -3, 0] },
    { position: [0, -12, 90], target: [0, -12, 0] },
    { position: [0, -21, 51], target: [0, -21, 0] },
    { position: [0, -24, 12], target: [0, -24, 0] },
  ],
};

const DIRECTIONS: readonly TravelDirection[] = ['left', 'right', 'top', 'bottom'];

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
    // in the cube group: body + 6 grids = 7 children (AC-2, plate-free).
    expect(faceMeshes(view)).toHaveLength(6);
    expect(faceMeshes(view).map((mesh) => mesh.count)).toEqual([25, 25, 25, 25, 25, 25]);
    expect(cubeGroup(view).children).toHaveLength(7);
    expect(cubeGroup(view).children[0]).toBeInstanceOf(Mesh);
    expect((cubeGroup(view).children[0] as Mesh).material).toBeInstanceOf(MeshStandardMaterial);

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

  it('builds the cube at the injected grid size (spec AC-3, session wiring)', () => {
    const view = createView(STYLE, 7);

    expect(faceMeshes(view).map((mesh) => mesh.count)).toEqual([49, 49, 49, 49, 49, 49]);
    expect(cubeGroup(view).position.toArray()).toEqual([0, 0, 0]);
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

    // The renderer belongs to the session; composing the scene must leave it alone.
    expect(fake.disposals()).toBe(0);
  });

  it('pins the camera lens and the level-0 rest pose looking at the origin (AC-2)', () => {
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
    expect(outPosition.toArray()).toEqual([0, 0, 60]);
    expect(outTarget.toArray()).toEqual([0, 0, 0]);

    introCameraPose(2, outPosition, outTarget);
    expect(outPosition.toArray()).toEqual([0, 0, 12]);
    expect(outTarget.toArray()).toEqual([0, 0, 0]);
  });

  it('approaches monotonically along the view axis and always targets the cube', () => {
    const outPosition = new Vector3();
    const outTarget = new Vector3();
    let previousZ = Number.POSITIVE_INFINITY;

    // The pinned sweep {0, 0.1, …, 1}: x and y stay on the axis, z strictly decreases.
    for (let step = 0; step <= 10; step += 1) {
      const progress = step / 10;

      introCameraPose(progress, outPosition, outTarget);

      expect([outPosition.x, outPosition.y]).toEqual([0, 0]);
      expect(outPosition.z).toBeLessThan(previousZ);
      expect(outTarget.toArray()).toEqual([0, 0, 0]);
      previousZ = outPosition.z;
    }
  });

  it('frames the whole cube at every pinned progress and supported aspect (AC-2)', () => {
    const view = createView();
    const corners = cubeCorners(0, 0);
    const centre = new Vector3();

    for (const { progress } of INTRO_POSES) {
      applySnapshot(view, snapshot({ phase: 'intro', phaseProgress: progress }));

      // On the view axis with the identity orientation: the cube centre is the screen
      // centre and the camera looks straight at it.
      expect(view.camera.quaternion.toArray()).toEqual([0, 0, 0, 1]);

      for (const aspect of SUPPORTED_ASPECTS) {
        expect(framesCube(view, corners, aspect)).toEqual([
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
        ]);
        expect(lookTarget(view)).toEqual([0, 0, 0]);

        centre.set(0, 0, 0).project(view.camera);
        expect([centre.x + 0, centre.y + 0]).toEqual([0, 0]);
      }
    }
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

describe('intro dolly through the scene (AC-2)', () => {
  it('follows the pinned pose table through applySnapshot', () => {
    const view = createView();

    for (const { progress, position } of INTRO_POSES) {
      applySnapshot(view, snapshot({ phase: 'intro', phaseProgress: progress }));
      expect(view.camera.position.toArray()).toEqual(position);
      expect(view.camera.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    }
  });

  it('lands on the playing rest pose after a skip, whatever the intro progress was', () => {
    const view = createView();

    applySnapshot(view, snapshot({ phase: 'intro', phaseProgress: 0.2 }));
    expect(view.camera.position.toArray()).toEqual([0, 0, 36.57600000000001]);

    applySnapshot(view, snapshot({ phase: 'playing' }));
    expect(view.camera.position.toArray()).toEqual([0, 0, 12]);
    expect(view.camera.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  });

  it('keeps the camera at rest through both flown phases under reduced motion', () => {
    const view = createView();

    applySnapshot(view, snapshot({ phase: 'intro', phaseProgress: 0 }));
    expect(view.camera.position.toArray()).toEqual([0, 0, 60]);

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

  it('keeps the view-axis swirl turning under reduced motion (AC-1)', () => {
    const view = createView();
    applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 0.5, reducedMotion: true }));

    view.update(1000);

    expect(view.camera.position.toArray()).toEqual([0, 0, 12]);
    expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1]);
    // RotZ(0.0152587890625): the exact composed doubles; the euler round-trip is one ulp
    // below the ideal angle (see `starfield.test.ts`).
    expect(starfieldPoints(view).quaternion.toArray()).toEqual([
      0, 0, 0.007629320516597103, 0.9999708963107151,
    ]);
  });
});

describe('travelCameraPose (AC-3)', () => {
  it('pins CUBE_SPACING and the four direction offsets', () => {
    expect(CUBE_SPACING).toBe(24);
    expect(TRAVEL_DIRECTION_OFFSETS).toEqual({
      left: { x: -24, y: 0 },
      right: { x: 24, y: 0 },
      top: { x: 0, y: 24 },
      bottom: { x: 0, y: -24 },
    });
  });

  it('yields the pinned four-direction pose table (positions and targets)', () => {
    for (const direction of DIRECTIONS) {
      const table = TRAVEL_POSES[direction];

      for (let index = 0; index < TRAVEL_PROGRESSES.length; index += 1) {
        const outPosition = new Vector3();
        const outTarget = new Vector3();

        travelCameraPose(TRAVEL_PROGRESSES[index]!, 0, 0, direction, outPosition, outTarget);

        expect(outPosition.toArray()).toEqual(table[index]!.position);
        expect(outTarget.toArray()).toEqual(table[index]!.target);
      }
    }
  });

  it('flights from the given origin and clamps the progress to the table ends', () => {
    const outPosition = new Vector3();
    const outTarget = new Vector3();

    travelCameraPose(0.5, 24, 0, 'right', outPosition, outTarget);
    expect(outPosition.toArray()).toEqual([36, 0, 90]);
    expect(outTarget.toArray()).toEqual([36, 0, 0]);

    travelCameraPose(-1, 0, 0, 'right', outPosition, outTarget);
    expect(outPosition.toArray()).toEqual([0, 0, 12]);
    expect(outTarget.toArray()).toEqual([0, 0, 0]);

    travelCameraPose(2, 0, 0, 'right', outPosition, outTarget);
    expect(outPosition.toArray()).toEqual([24, 0, 12]);
    expect(outTarget.toArray()).toEqual([24, 0, 0]);
  });

  it('treats a null direction as a zero lateral offset (defensive)', () => {
    const outPosition = new Vector3();
    const outTarget = new Vector3();

    travelCameraPose(0.5, 0, 0, null, outPosition, outTarget);
    expect(outPosition.toArray()).toEqual([0, 0, 90]);
    expect(outTarget.toArray()).toEqual([0, 0, 0]);

    travelCameraPose(1, 0, 0, null, outPosition, outTarget);
    expect(outPosition.toArray()).toEqual([0, 0, 12]);
    expect(outTarget.toArray()).toEqual([0, 0, 0]);
  });
});

describe('backdrop coverage and density (AC-1)', () => {
  it('covers the real frustum corner rays at every pinned pose, aspect and swirl', () => {
    const view = createView();
    const poses: Array<{
      phase: 'playing' | 'intro' | 'travel';
      phaseProgress: number;
      direction: TravelDirection | null;
      position: [number, number, number];
      scale: number;
    }> = [
      { phase: 'playing', phaseProgress: 1, direction: null, position: [0, 0, 12], scale: 1 },
      { phase: 'intro', phaseProgress: 0, direction: null, position: [0, 0, 60], scale: 1 },
      { phase: 'intro', phaseProgress: 0.5, direction: null, position: [0, 0, 18], scale: 1 },
      { phase: 'travel', phaseProgress: 0.5, direction: null, position: [0, 0, 90], scale: 8 },
      { phase: 'travel', phaseProgress: 0.5, direction: 'right', position: [12, 0, 90], scale: 8 },
    ];

    for (const pose of poses) {
      // Return to `playing` first: every pose must start its own phase transition (the
      // travel origin/direction are captured on that transition).
      applySnapshot(view, snapshot({ phase: 'playing' }));
      applySnapshot(
        view,
        snapshot({
          phase: pose.phase,
          phaseProgress: pose.phaseProgress,
          travelDirection: pose.direction,
        }),
      );
      view.update(0);

      // The cone is anchored to the camera: at swirl 0 the pose is exactly the camera
      // pose, with the travel scale only in the view plane.
      expect(starfieldPoints(view).position.toArray()).toEqual(pose.position);
      expect(view.camera.position.toArray()).toEqual(pose.position);
      expect(starfieldPoints(view).quaternion.toArray()).toEqual([0, 0, 0, 1]);
      expect(starfieldPoints(view).scale.toArray()).toEqual([pose.scale, pose.scale, 1]);

      for (const aspect of SUPPORTED_ASPECTS) {
        for (const swirl of [0, Math.PI / 4]) {
          for (const [u, v] of cornerSlopes(view, aspect, swirl, pose.scale)) {
            // The starfield-local corner slopes must fit in the square cone's inradius.
            // The square's inradius 1.2513 ≥ the largest supported viewport circumradius
            // 1.1840, so the axis-aligned (translation-only) lateral poses transfer.
            expect(Math.abs(u)).toBeLessThanOrEqual(STARFIELD_TAN);
            expect(Math.abs(v)).toBeLessThanOrEqual(STARFIELD_TAN);
          }
        }
      }
    }
  });

  it('covers the cone at the spawned cube’s rest pose (24, 0, 12) after the rebuild', () => {
    const view = createView();
    applyIntents(view, [{ kind: 'levelChanged', style: NEXT_STYLE }]);
    applySnapshot(
      view,
      snapshot({
        phase: 'travel',
        phaseProgress: 0.75,
        travelDirection: 'right',
        style: NEXT_STYLE,
        levelIndex: 1,
      }),
    );
    applySnapshot(view, snapshot({ phase: 'playing', style: NEXT_STYLE, levelIndex: 1 }));
    view.update(0);

    expect(view.camera.position.toArray()).toEqual([24, 0, 12]);
    expect(starfieldPoints(view).position.toArray()).toEqual([24, 0, 12]);
    expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1]);

    for (const aspect of SUPPORTED_ASPECTS) {
      for (const swirl of [0, Math.PI / 4]) {
        for (const [u, v] of cornerSlopes(view, aspect, swirl, 1)) {
          expect(Math.abs(u)).toBeLessThanOrEqual(STARFIELD_TAN);
          expect(Math.abs(v)).toBeLessThanOrEqual(STARFIELD_TAN);
        }
      }
    }
  });

  it('keeps at least five stars in every 4 × 4 NDC cell at the sustained poses', () => {
    const view = createSeededView();
    // Seed 7 at 16:9, scale (1,1,1), square cone: row 0 = bottom; the anchored cone is
    // pose-invariant, so rest, intro start, intro mid and travel end project the same sky.
    const SUSTAINED_CELLS = [14, 14, 16, 15, 28, 28, 23, 16, 19, 14, 15, 16, 18, 19, 29, 18];
    const poses = [
      { phase: 'playing' as const, phaseProgress: 1 },
      { phase: 'intro' as const, phaseProgress: 0 },
      { phase: 'intro' as const, phaseProgress: 0.5 },
      { phase: 'travel' as const, phaseProgress: 1 },
    ];

    for (const pose of poses) {
      applySnapshot(view, snapshot({ phase: pose.phase, phaseProgress: pose.phaseProgress }));
      view.update(0);
      expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1]);

      const { total, cells } = ndcStarCells(view, 16 / 9);
      expect(cells).toEqual(SUSTAINED_CELLS);
      expect(total).toBe(302);
      for (const count of cells) {
        expect(count).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('thins but never empties the viewport at the scale-8 turn-around', () => {
    const view = createSeededView();
    applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 0.5 }));
    view.update(0);
    expect(view.camera.position.toArray()).toEqual([0, 0, 90]);
    expect(starfieldPoints(view).scale.toArray()).toEqual([8, 8, 1]);

    const { total, cells } = ndcStarCells(view, 16 / 9);

    // Exact seeded count: 5 stars stay visible at the peak expansion (spec r2 floor ≥ 2;
    // expected ≈ 5 — the accepted, brief expansion thinning, not an empty region).
    expect(total).toBe(5);
    expect(total).toBeGreaterThanOrEqual(2);
    expect(cells).toEqual([0, 1, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
  });
});

describe('directional travel through the scene (AC-3)', () => {
  it('follows the pinned pose table for all four directions', () => {
    for (const direction of DIRECTIONS) {
      const view = createView();

      for (let index = 0; index < TRAVEL_PROGRESSES.length; index += 1) {
        applySnapshot(
          view,
          snapshot({
            phase: 'travel',
            phaseProgress: TRAVEL_PROGRESSES[index]!,
            travelDirection: direction,
          }),
        );

        expect(view.camera.position.toArray()).toEqual(TRAVEL_POSES[direction][index]!.position);
        expect(lookTarget(view)).toEqual(TRAVEL_POSES[direction][index]!.target);
        expect(view.camera.quaternion.toArray()).toEqual([0, 0, 0, 1]);
      }
    }
  });

  it('keeps the retained symmetric depth and scale tables (null direction, defensive)', () => {
    const view = createView();
    const points = starfieldPoints(view);

    // The one-shot travel marker carries no state: the flight is snapshot-driven.
    applyIntents(view, [{ kind: 'travelStarted' }]);
    expect(view.camera.position.toArray()).toEqual([0, 0, 12]);

    // z(p) = 12 + 78 · travelSwing(p) and S(p) = 1 + 7 · travelSwing(p): both halves of
    // travelSwing meet at 1 at p = 0.5, so the camera peaks at 90 and the scale at (8,8,1)
    // exactly at the turn-around and land back on the rest values at p = 1.
    const table: ReadonlyArray<{ progress: number; z: number }> = [
      { progress: 0, z: 12 },
      { progress: 0.125, z: 21.75 },
      { progress: 0.25, z: 51 },
      { progress: 0.375, z: 80.25 },
      { progress: 0.5, z: 90 },
      { progress: 0.625, z: 80.25 },
      { progress: 0.75, z: 51 },
      { progress: 0.875, z: 21.75 },
      { progress: 1, z: 12 },
    ];
    const observedZ: number[] = [];
    const observedScales: number[][] = [];

    for (const { progress } of table) {
      applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: progress }));
      view.update(16);

      expect(view.camera.quaternion.toArray()).toEqual([0, 0, 0, 1]);
      expect([view.camera.position.x, view.camera.position.y]).toEqual([0, 0]);
      observedZ.push(view.camera.position.z);
      observedScales.push(starfieldPoints(view).scale.toArray());
      expect(starfieldPoints(view)).toBe(points);
    }

    expect(observedZ).toEqual([12, 21.75, 51, 80.25, 90, 80.25, 51, 21.75, 12]);
    expect(observedScales).toEqual([
      [1, 1, 1],
      [1.875, 1.875, 1],
      [4.5, 4.5, 1],
      [7.125, 7.125, 1],
      [8, 8, 1],
      [7.125, 7.125, 1],
      [4.5, 4.5, 1],
      [1.875, 1.875, 1],
      [1, 1, 1],
    ]);
  });

  it('captures the flight origin once: a mid-travel rebuild never double-counts (AC-3)', () => {
    const view = createView();
    applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 0.375, travelDirection: 'right' }));
    const before = cubeGroup(view);
    const bodyDispose = vi.spyOn((before.children[0] as Mesh).geometry, 'dispose');

    // The engine advances the level at the midpoint: the intent marks the rebuild pending.
    applyIntents(view, [{ kind: 'levelChanged', style: NEXT_STYLE }]);
    applySnapshot(
      view,
      snapshot({
        phase: 'travel',
        phaseProgress: 0.5,
        travelDirection: 'right',
        style: NEXT_STYLE,
        levelIndex: 1,
      }),
    );

    const after = cubeGroup(view);
    expect(after).not.toBe(before);
    expect(view.scene.children).not.toContain(before);
    expect(bodyDispose).toHaveBeenCalledTimes(1);
    // The new cube spawns one spacing step to the right of the finished one.
    expect(after.position.toArray()).toEqual([24, 0, 0]);
    expect(view.camera.position.toArray()).toEqual([12, 0, 90]);

    // The captured origin (0, 0) still drives the flight: p = 0.75 is the table value,
    // not a pose derived from the rebuilt cube's new position (which would give 45).
    applySnapshot(
      view,
      snapshot({
        phase: 'travel',
        phaseProgress: 0.75,
        travelDirection: 'right',
        style: NEXT_STYLE,
        levelIndex: 1,
      }),
    );
    view.update(16);
    expect(view.camera.position.toArray()).toEqual([21, 0, 51]);
    expect(lookTarget(view)).toEqual([21, 0, 0]);
    expect(starfieldPoints(view).scale.toArray()).toEqual([4.5, 4.5, 1]);

    // Landing: p = 1 equals the playing rest pose over the new cube (continuous).
    applySnapshot(
      view,
      snapshot({
        phase: 'travel',
        phaseProgress: 1,
        travelDirection: 'right',
        style: NEXT_STYLE,
        levelIndex: 1,
      }),
    );
    expect(view.camera.position.toArray()).toEqual([24, 0, 12]);
    applySnapshot(view, snapshot({ phase: 'playing', style: NEXT_STYLE, levelIndex: 1 }));
    expect(view.camera.position.toArray()).toEqual([24, 0, 12]);
    expect(lookTarget(view)).toEqual([24, 0, 0]);
    view.update(16);
    expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1]);
    expect(cubeGroup(view)).toBe(after);
  });

  it('rebuilds exactly once per level change and places the cube per direction', () => {
    for (const direction of DIRECTIONS) {
      const view = createView();
      applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 0.375, travelDirection: direction }));
      const before = cubeGroup(view);
      const body = before.children[0] as Mesh;
      const dispose = vi.spyOn(body.geometry, 'dispose');

      // The intent alone rebuilds nothing: the snapshot carries the new style/grid/direction.
      applyIntents(view, [{ kind: 'levelChanged', style: NEXT_STYLE }]);
      expect(cubeGroup(view)).toBe(before);
      expect(dispose).toHaveBeenCalledTimes(0);

      // The next snapshot rebuilds exactly once, at the new world position.
      applySnapshot(
        view,
        snapshot({
          phase: 'travel',
          phaseProgress: 0.5,
          travelDirection: direction,
          style: NEXT_STYLE,
          gridSize: 7,
          levelIndex: 1,
        }),
      );
      const after = cubeGroup(view);
      const offset = TRAVEL_DIRECTION_OFFSETS[direction];
      expect(after).not.toBe(before);
      expect(after.position.toArray()).toEqual([offset.x, offset.y, 0]);
      expect(view.scene.children).not.toContain(before);
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(view.cubeView.group).toBe(after);
      expect(((after.children[0] as Mesh).material as MeshStandardMaterial).color.getHexString()).toBe(
        '1a0b0e',
      );
      // The new cube is built at the snapshot's grid size (T1's per-level random N).
      expect(faceMeshes(view).map((mesh) => mesh.count)).toEqual([49, 49, 49, 49, 49, 49]);

      // Follow-up snapshots rebuild nothing more.
      applySnapshot(
        view,
        snapshot({
          phase: 'travel',
          phaseProgress: 0.75,
          travelDirection: direction,
          style: NEXT_STYLE,
          gridSize: 7,
          levelIndex: 1,
        }),
      );
      expect(cubeGroup(view)).toBe(after);
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(faceMeshes(view)).toHaveLength(6);
    }
  });

  it('chains a second right travel to (48, 0, 0) with rest (48, 0, 12)', () => {
    const view = createView();
    const levelOne = snapshot({
      phase: 'travel',
      phaseProgress: 0.5,
      travelDirection: 'right',
      style: NEXT_STYLE,
      levelIndex: 1,
    });

    applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 0.25, travelDirection: 'right' }));
    applyIntents(view, [{ kind: 'levelChanged', style: NEXT_STYLE }]);
    applySnapshot(view, levelOne);
    expect(cubeGroup(view).position.toArray()).toEqual([24, 0, 0]);

    applySnapshot(view, snapshot({ phase: 'playing', style: NEXT_STYLE, levelIndex: 1 }));
    expect(view.camera.position.toArray()).toEqual([24, 0, 12]);

    // Second travel: the flight starts over the level-1 cube at (24, 0).
    applySnapshot(
      view,
      snapshot({
        phase: 'travel',
        phaseProgress: 0.25,
        travelDirection: 'right',
        style: NEXT_STYLE,
        levelIndex: 1,
      }),
    );
    expect(view.camera.position.toArray()).toEqual([27, 0, 51]);

    applyIntents(view, [{ kind: 'levelChanged', style: THIRD_STYLE }]);
    applySnapshot(
      view,
      snapshot({
        phase: 'travel',
        phaseProgress: 0.5,
        travelDirection: 'right',
        style: THIRD_STYLE,
        levelIndex: 2,
      }),
    );
    expect(cubeGroup(view).position.toArray()).toEqual([48, 0, 0]);
    expect(view.camera.position.toArray()).toEqual([36, 0, 90]);

    applySnapshot(view, snapshot({ phase: 'playing', style: THIRD_STYLE, levelIndex: 2 }));
    expect(view.camera.position.toArray()).toEqual([48, 0, 12]);
    expect(lookTarget(view)).toEqual([48, 0, 0]);
  });

  it('rebuilds in place for a grid-size change that arrives without its intent', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const before = cubeGroup(view);
    const dispose = vi.spyOn((before.children[0] as Mesh).geometry, 'dispose');

    applySnapshot(view, snapshot({ gridSize: 7 }));

    const after = cubeGroup(view);
    expect(after).not.toBe(before);
    expect(after.position.toArray()).toEqual([0, 0, 0]);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(faceMeshes(view).map((mesh) => mesh.count)).toEqual([49, 49, 49, 49, 49, 49]);

    // The next snapshot with the same grid size does not rebuild again.
    applySnapshot(view, snapshot({ gridSize: 7 }));
    expect(cubeGroup(view)).toBe(after);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('rebuilds in place when a pending level change carries no direction (defensive)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const before = cubeGroup(view);

    applyIntents(view, [{ kind: 'levelChanged', style: NEXT_STYLE }]);
    // A pending level change whose snapshot has no drawn direction: the offset is zero, so
    // the new cube is placed exactly where the old one was.
    applySnapshot(view, snapshot({ style: NEXT_STYLE, travelDirection: null }));

    const after = cubeGroup(view);
    expect(after).not.toBe(before);
    expect(after.position.toArray()).toEqual([0, 0, 0]);
    expect(view.camera.position.toArray()).toEqual([0, 0, 12]);
    expect(((after.children[0] as Mesh).material as MeshStandardMaterial).color.getHexString()).toBe(
      '1a0b0e',
    );
  });

  it('swaps instantly and positionally under reduced motion (no flight, no expansion)', () => {
    const view = createView();
    applySnapshot(view, snapshot({ reducedMotion: true }));
    expect(view.camera.position.toArray()).toEqual([0, 0, 12]);

    // Departure half: rest over the current (old) cube at every p, no expansion.
    for (const progress of [0, 0.25]) {
      applySnapshot(
        view,
        snapshot({ phase: 'travel', phaseProgress: progress, travelDirection: 'right', reducedMotion: true }),
      );
      view.update(16);
      expect(view.camera.position.toArray()).toEqual([0, 0, 12]);
      expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1]);
    }

    // Midpoint: the rebuild happens, and the very same snapshot puts the camera at rest
    // over the new cube — an instant positional swap, never a flight.
    applyIntents(view, [{ kind: 'levelChanged', style: NEXT_STYLE }]);
    applySnapshot(
      view,
      snapshot({
        phase: 'travel',
        phaseProgress: 0.5,
        travelDirection: 'right',
        style: NEXT_STYLE,
        levelIndex: 1,
        reducedMotion: true,
      }),
    );
    expect(cubeGroup(view).position.toArray()).toEqual([24, 0, 0]);
    expect(view.camera.position.toArray()).toEqual([24, 0, 12]);
    expect(lookTarget(view)).toEqual([24, 0, 0]);

    for (const progress of [0.75, 1]) {
      applySnapshot(
        view,
        snapshot({
          phase: 'travel',
          phaseProgress: progress,
          travelDirection: 'right',
          style: NEXT_STYLE,
          levelIndex: 1,
          reducedMotion: true,
        }),
      );
      view.update(16);
      expect(view.camera.position.toArray()).toEqual([24, 0, 12]);
      expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1]);
    }

    applySnapshot(
      view,
      snapshot({ phase: 'playing', style: NEXT_STYLE, levelIndex: 1, reducedMotion: true }),
    );
    expect(view.camera.position.toArray()).toEqual([24, 0, 12]);
  });

  it('frames the finished cube on departure and the new cube on arrival (AC-3)', () => {
    // Departure: the old cube (origin) is fully framed at p = 0 and p = 0.25.
    const departure = createView();
    for (const progress of [0, 0.25]) {
      applySnapshot(
        departure,
        snapshot({ phase: 'travel', phaseProgress: progress, travelDirection: 'right' }),
      );
      for (const aspect of SUPPORTED_ASPECTS) {
        expect(framesCube(departure, cubeCorners(0, 0), aspect)).toEqual([
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
        ]);
      }
    }

    // Arrival: the new cube (24, 0) is fully framed at p = 0.5, 0.75 and 1.
    const arrival = createView();
    applySnapshot(arrival, snapshot({ phase: 'travel', phaseProgress: 0.25, travelDirection: 'right' }));
    applyIntents(arrival, [{ kind: 'levelChanged', style: NEXT_STYLE }]);
    applySnapshot(
      arrival,
      snapshot({
        phase: 'travel',
        phaseProgress: 0.5,
        travelDirection: 'right',
        style: NEXT_STYLE,
        levelIndex: 1,
      }),
    );
    for (const progress of [0.5, 0.75, 1]) {
      applySnapshot(
        arrival,
        snapshot({
          phase: 'travel',
          phaseProgress: progress,
          travelDirection: 'right',
          style: NEXT_STYLE,
          levelIndex: 1,
        }),
      );
      for (const aspect of SUPPORTED_ASPECTS) {
        expect(framesCube(arrival, cubeCorners(24, 0), aspect)).toEqual([
          true,
          true,
          true,
          true,
          true,
          true,
          true,
          true,
        ]);
      }
    }
  });

  it('keeps the pose and the placement stable across supported aspect changes', () => {
    const view = createView();
    applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 0.25, travelDirection: 'right' }));
    view.update(0);

    for (const aspect of SUPPORTED_ASPECTS) {
      view.camera.aspect = aspect;
      view.camera.updateProjectionMatrix();
      // Resizing the viewport must never move the camera, the cube or the backdrop anchor.
      expect(view.camera.aspect).toBe(aspect);
      expect(view.camera.position.toArray()).toEqual([3, 0, 51]);
      expect(cubeGroup(view).position.toArray()).toEqual([0, 0, 0]);
      expect(starfieldPoints(view).position.toArray()).toEqual([3, 0, 51]);
    }
  });
});

describe('snapshot application', () => {
  it("sets the cube rotation through the pinned frame (pitch, yaw, 0)", () => {
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

  it('rebuilds in place when the snapshot style changes without its levelChanged intent', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const before = cubeGroup(view);

    applySnapshot(view, snapshot({ style: THIRD_STYLE, levelIndex: 2 }));
    const after = cubeGroup(view);

    expect(after).not.toBe(before);
    expect(view.scene.children).not.toContain(before);
    expect(after.position.toArray()).toEqual([0, 0, 0]);
    expect(
      ((after.children[0] as Mesh).material as MeshStandardMaterial).color.getHexString(),
    ).toBe('0a1410');

    // Re-applying the same style is not a rebuild.
    applySnapshot(view, snapshot({ style: THIRD_STYLE, levelIndex: 2 }));
    expect(cubeGroup(view)).toBe(after);
  });

  it('rests the camera over the current cube in the playing phase (level 0 at the origin)', () => {
    const view = createView();
    applySnapshot(view, snapshot({ phase: 'playing' }));
    expect(view.camera.position.toArray()).toEqual([0, 0, 12]);
    expect(lookTarget(view)).toEqual([0, 0, 0]);
    expect(view.camera.quaternion.toArray()).toEqual([0, 0, 0, 1]);
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

    applyIntents(view, [explosionIntent('front:0:0', 'front')]);

    // Marked hidden (unpickable) at intent time, but the tile itself has not shrunk yet.
    expect(view.cubeView.isMiniCubeHidden('front:0:0')).toBe(true);
    expect(instanceScale(mesh, 0)).toEqual([1, 1, 0.25]);

    // t = 50: the pop is expanding (factor 1.05, multiplier 1.15).
    view.update(50);
    expect(instanceScale(mesh, 0)).toEqual([
      Math.fround(1 * 1.05),
      Math.fround(1 * 1.05),
      Math.fround(0.25 * 1.05),
    ]);
    expect(instanceColor(mesh, 0)).toEqual([
      Math.fround(1.15),
      Math.fround(1.15),
      Math.fround(1.15),
    ]);

    // t = 160: the hidden end state, position preserved.
    view.update(110);
    expect(instanceScale(mesh, 0)).toEqual([0, 0, 0]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);
    expect(new Vector3().setFromMatrixPosition(instanceMatrix(mesh, 0)).toArray()).toEqual([
      ...FRONT_FIRST_TILE,
    ]);

    // Every other tile is untouched.
    expect(instanceScale(mesh, 1)[0]).toBe(Math.fround(1));

    // The burst plays in front of the tile: origin (−2, 2, 2.625) + 0.5 · (0, 0, 1).
    const positions = particlePositions(view);
    expect(particlePoints(view).geometry.drawRange.count).toBe(3);
    expect([positions[0], positions[1], positions[2]]).toEqual([-2, 2, 3.125]);
    expect([positions[3], positions[4], positions[5]]).toEqual([-2, 2, 3.125]);
    expect(BURST_ORIGIN_OFFSET).toBe(0.5);
  });

  it('reads the explosion origin from the cube’s world position after a travel', () => {
    const view = createView();
    applyIntents(view, [{ kind: 'levelChanged', style: NEXT_STYLE }]);
    applySnapshot(
      view,
      snapshot({
        phase: 'travel',
        phaseProgress: 0.5,
        travelDirection: 'right',
        style: NEXT_STYLE,
        levelIndex: 1,
      }),
    );
    applySnapshot(view, snapshot({ phase: 'playing', style: NEXT_STYLE, levelIndex: 1 }));

    applyIntents(view, [explosionIntent('front:0:0', 'front')]);

    // The tile's origin is offset by the new cube's world position (24, 0, 0).
    const positions = particlePositions(view);
    expect([positions[0], positions[1], positions[2]]).toEqual([22, 2, 3.125]);
  });

  it('follows the cube rotation when placing an explosion origin and normal', () => {
    const view = createView();
    applySnapshot(view, snapshot({ orientation: { yawSteps: 1, pitchSteps: 0 } }));

    applyIntents(view, [explosionIntent('front:0:0', 'front')]);

    // +1 yaw is +90° about +Y: the tile at (−2, 2, 2.625) lands at (2.625, 2, 2) and the
    // front normal turns into +X; the quarter-turn trig residue is snapped away.
    const positions = particlePositions(view);
    expect([positions[0], positions[1], positions[2]]).toEqual([3.125, 2, 2]);
  });

  it('falls back to the cube centre when the exploding face is already gone', () => {
    const view = createView();
    applySnapshot(view, snapshot());

    applyIntents(view, [{ kind: 'faceCleared', faceId: 'back' }]);
    view.update(400);
    expect(faceMeshes(view)).toHaveLength(5);

    applyIntents(view, [explosionIntent('back:0:0', 'back', 2)]);

    // No instance left to read an origin (or a normal) from: the burst plays at the centre.
    const positions = particlePositions(view);
    expect(particlePoints(view).geometry.drawRange.count).toBe(2);
    expect([positions[0], positions[1], positions[2]]).toEqual([0, 0, 0]);
  });

  it('hides instantly with no flash under reduced motion', () => {
    const view = createView();
    applySnapshot(view, snapshot({ reducedMotion: true }));
    const mesh = faceMesh(view, 'front');

    applyIntents(view, [explosionIntent('front:0:0', 'front', 0)]);

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

    applyIntents(view, [explosionIntent('front:0:0', 'front')]);
    view.update(50);
    expect(instanceScale(mesh, 0)[0]).toBe(Math.fround(1.05));

    applySnapshot(view, snapshot({ reducedMotion: true }));

    expect(instanceScale(mesh, 0)).toEqual([0, 0, 0]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);

    view.update(50);
    expect(instanceScale(mesh, 0)).toEqual([0, 0, 0]);
  });

  it('removes a cleared face after the pinned 400 ms countdown, with no opacity write (AC-2)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const mesh = faceMesh(view, 'back');
    const material = mesh.material as MeshStandardMaterial;
    const materialDispose = vi.spyOn(material, 'dispose');
    const geometryDispose = vi.spyOn(mesh.geometry, 'dispose');

    applyIntents(view, [{ kind: 'faceCleared', faceId: 'back' }]);

    // No plate exists to fade: the surface stays fully opaque until the countdown ends.
    expect(faceMeshes(view)).toHaveLength(6);
    expect(material.opacity).toBe(1);
    expect(material.transparent).toBe(false);

    view.update(399);
    expect(faceMeshes(view)).toHaveLength(6);
    expect(material.opacity).toBe(1);
    expect(geometryDispose).toHaveBeenCalledTimes(0);

    view.update(1);
    expect(faceMeshes(view)).toHaveLength(5);
    expect(faceMeshes(view)).not.toContain(mesh);
    expect(cubeGroup(view).children).not.toContain(mesh);
    expect(cubeGroup(view).children).toHaveLength(6);
    expect(material.opacity).toBe(1);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);

    // The remaining faces stay playable.
    expect(faceMeshes(view)).toHaveLength(5);
    expect(view.cubeView.faces.size).toBe(5);
  });

  it('removes a cleared face after the reduced 100 ms countdown', () => {
    const view = createView();
    applySnapshot(view, snapshot({ reducedMotion: true }));

    applyIntents(view, [{ kind: 'faceCleared', faceId: 'left' }]);

    view.update(99);
    expect(faceMeshes(view)).toHaveLength(6);

    view.update(1);
    expect(faceMeshes(view)).toHaveLength(5);
  });

  it('does not restart a running countdown when faceCleared is applied again', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const mesh = faceMesh(view, 'right');
    const materialDispose = vi.spyOn(mesh.material as Material, 'dispose');

    applyIntents(view, [{ kind: 'faceCleared', faceId: 'right' }]);
    view.update(200);
    expect(faceMeshes(view)).toHaveLength(6);

    // A repeated intent must not reset the half-finished countdown.
    applyIntents(view, [{ kind: 'faceCleared', faceId: 'right' }]);
    view.update(200);

    expect(faceMeshes(view)).toHaveLength(5);
    expect(materialDispose).toHaveBeenCalledTimes(1);
  });

  it('treats a second faceCleared after the removal as a no-op (no double disposal)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const mesh = faceMesh(view, 'back');
    const materialDispose = vi.spyOn(mesh.material as Material, 'dispose');

    applyIntents(view, [{ kind: 'faceCleared', faceId: 'back' }]);
    view.update(400);
    expect(faceMeshes(view)).toHaveLength(5);
    expect(materialDispose).toHaveBeenCalledTimes(1);

    applyIntents(view, [{ kind: 'faceCleared', faceId: 'back' }]);
    view.update(400);

    expect(faceMeshes(view)).toHaveLength(5);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(cubeGroup(view).children).toHaveLength(6);
  });

  it('exposes the live cube view through the rebuild-aware accessor (AC-16)', () => {
    const view = createView();
    const initial = view.cubeView;

    // The accessor answers with the cube view the scene holds right now.
    expect(initial.group).toBe(cubeGroup(view));
    expect((initial.body.material as MeshStandardMaterial).color.getHexString()).toBe('0b0b12');

    // `levelChanged` alone is pending; the snapshot performs the rebuild.
    applyIntents(view, [{ kind: 'levelChanged', style: NEXT_STYLE }]);
    expect(view.cubeView).toBe(initial);

    applySnapshot(
      view,
      snapshot({
        phase: 'travel',
        phaseProgress: 0.5,
        travelDirection: 'right',
        style: NEXT_STYLE,
        levelIndex: 1,
      }),
    );

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
});

describe('frame updates and lifecycle', () => {
  it('ages a burst and releases it after its lifetime', () => {
    const view = createView();
    applySnapshot(view, snapshot());

    applyIntents(view, [explosionIntent('front:0:0', 'front', EXPLOSION_PARTICLE_COUNT)]);
    expect(particlePoints(view).geometry.drawRange.count).toBe(24);

    view.update(349);
    expect(particlePoints(view).geometry.drawRange.count).toBe(24);

    view.update(1);
    expect(particlePoints(view).geometry.drawRange.count).toBe(0);
  });

  it('returns to the plate-free baseline object counts after 10 explosion cycles (AC-16)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const baselineChildren = view.scene.children.length;
    const baselineObjects = countObjects(view.scene);
    const starfield = starfieldPoints(view);
    const particles = particlePoints(view);

    // Scene + two lights + starfield + cube group (body + 6 grids) + particle group + pool.
    expect(baselineObjects).toBe(14);
    expect(cubeGroup(view).children).toHaveLength(7);

    for (let cycle = 0; cycle < 10; cycle += 1) {
      const row = cycle % GRID_SIZE;
      const id = miniCubeId('front', row, row);
      applyIntents(view, [explosionIntent(id, 'front', EXPLOSION_PARTICLE_COUNT)]);
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

  it('keeps exactly one plate-free cube view across a level change (AC-16)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const baselineObjects = countObjects(view.scene);

    applyIntents(view, [{ kind: 'levelChanged', style: NEXT_STYLE }]);
    applySnapshot(
      view,
      snapshot({
        phase: 'travel',
        phaseProgress: 0.5,
        travelDirection: 'right',
        style: NEXT_STYLE,
        levelIndex: 1,
      }),
    );

    expect(countObjects(view.scene)).toBe(baselineObjects);
    expect(view.scene.children).toHaveLength(5);
    expect(cubeGroup(view).children).toHaveLength(7);
    expect(faceMeshes(view)).toHaveLength(6);
  });

  it('disposes every resource exactly once and is idempotent (AC-15)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const starfield = starfieldPoints(view);
    const particles = particlePoints(view);
    const body = cubeGroup(view).children[0] as Mesh;

    const spies = [
      vi.spyOn(starfield.geometry, 'dispose'),
      vi.spyOn(starfield.material as Material, 'dispose'),
      vi.spyOn(particles.geometry, 'dispose'),
      vi.spyOn(particles.material as Material, 'dispose'),
      vi.spyOn(body.geometry, 'dispose'),
      vi.spyOn(body.material as Material, 'dispose'),
      vi.spyOn(faceMesh(view, 'front').geometry, 'dispose'),
      vi.spyOn(faceMesh(view, 'front').material as Material, 'dispose'),
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
