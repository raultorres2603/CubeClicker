import {
  AmbientLight,
  Color,
  DirectionalLight,
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

import type { EffectIntent, EngineSnapshot } from '../game/engine';
import { EXPLOSION_PARTICLE_COUNT, type Burst } from '../game/effects';
import { CUBE_STYLES } from '../game/progression';
import { createOrientation } from '../game/rotation';
import { createBoard } from '../game/board';
import { FACE_IDS, GRID_SIZE, type CubeStyle, type FaceId, type MiniCubeId } from '../game/types';
import { createSceneView, type SceneView } from './scene';

/**
 * Integration tier the spec pins for `render/**`: the scene is exercised against real
 * three.js objects (node constructs them without a GL context) and every assertion below
 * reads the scene graph, a material or the camera. The only boundary that is faked is the
 * session's `RendererAdapter` (`webgl.ts`/`session.ts`, T13) — and even that fake only
 * records what it receives, so the scene's real state stays under test.
 */

const STYLE = CUBE_STYLES[0]!;
const NEXT_STYLE = CUBE_STYLES[1]!;
const THIRD_STYLE = CUBE_STYLES[2]!;

/** Tile centre distance from the cube centre: `2.5 + 0.125` (see `cube-view.ts`). */
const TILE_DISTANCE = 2.625;

/** The `front:0:0` tile centre in cube-local (and, unrotated, world) space. */
const FRONT_FIRST_TILE: readonly [number, number, number] = [-2, 2, TILE_DISTANCE];

/** The `front:4:4` tile centre — the opposite corner of the same face. */
const FRONT_LAST_TILE: readonly [number, number, number] = [2, -2, TILE_DISTANCE];

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

/** One engine snapshot with the pinned playing defaults; overrides pin the case at hand. */
function snapshot(overrides: Partial<EngineSnapshot> = {}): EngineSnapshot {
  return {
    phase: 'playing',
    phaseProgress: 1,
    stats: { clicks: 0, facesDestroyed: 0 },
    levelIndex: 0,
    style: STYLE,
    orientation: createOrientation(),
    rotationFrom: null,
    rotationProgress: 1,
    cursor: null,
    board: createBoard(),
    reducedMotion: false,
    ...overrides,
  };
}

/**
 * Applies one snapshot at frame time 0 — the pinned `SceneView.applySnapshot` signature
 * carries the loop's frame time, which the scene does not read (it applies snapshot
 * values only; the fades are driven by `update`'s `dtMs`).
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

/** Total number of three.js objects in the scene graph (groups, drawables and lights). */
function countObjects(root: Object3D): number {
  return 1 + root.children.reduce((total, child) => total + countObjects(child), 0);
}

describe('scene composition', () => {
  it('sets a black background and assembles the starfield, lights, cube and particles (AC-3, AC-16)', () => {
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

    // One instanced grid per face, `GRID_SIZE²` = 25 instances each.
    expect(faceMeshes(view)).toHaveLength(6);
    expect(faceMeshes(view).map((mesh) => mesh.count)).toEqual([25, 25, 25, 25, 25, 25]);

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

  it('pins the camera lens and the rest position looking at the origin (AC-22)', () => {
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

describe('camera flights (AC-22)', () => {
  it('flies the intro from (0,0,60) through (0,0,18) to rest', () => {
    const view = createView();

    applySnapshot(view, snapshot({ phase: 'intro', phaseProgress: 0 }));
    expect(view.camera.position.toArray()).toEqual([0, 0, 60]);

    applySnapshot(view, snapshot({ phase: 'intro', phaseProgress: 0.5 }));
    expect(view.camera.position.toArray()).toEqual([0, 0, 18]);

    applySnapshot(view, snapshot({ phase: 'intro', phaseProgress: 1 }));
    expect(view.camera.position.toArray()).toEqual([0, 0, 12]);
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

  it('keeps the camera at rest through both flown phases under reduced motion', () => {
    const view = createView();

    applySnapshot(view, snapshot({ phase: 'intro', phaseProgress: 0 }));
    expect(view.camera.position.z).toBe(60);

    for (const phase of ['intro', 'travel'] as const) {
      for (const phaseProgress of [0, 0.5, 1]) {
        applySnapshot(view, snapshot({ phase, phaseProgress, reducedMotion: true }));
        expect(view.camera.position.toArray()).toEqual([0, 0, 12]);
      }
    }

    // No fly-through also means no starfield streak input.
    view.update(16);
    expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1]);
  });
});

describe('starfield travel progress (AC-3)', () => {
  it('drives the streak from the travel progress and keeps it across progress-less frames', () => {
    const view = createView();
    expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1]);

    applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 0.5 }));
    view.update(16);
    expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1.25]);

    // Frames that only advance time keep the streak (no snapshot in between).
    view.update(16);
    view.update(16);
    expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1.25]);

    applySnapshot(view, snapshot({ phase: 'travel', phaseProgress: 1 }));
    view.update(16);
    expect(starfieldPoints(view).scale.toArray()).toEqual([1, 1, 1.5]);

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

  it('moves the cursor highlight onto the snapshot cell and hides it for a null cursor', () => {
    const view = createView();

    applySnapshot(view, snapshot({ cursor: { faceId: 'front', row: 0, col: 0 } }));
    const highlight = cubeGroup(view).children[1] as Mesh;
    expect(highlight.visible).toBe(true);
    expect(highlight.position.toArray()).toEqual([...FRONT_FIRST_TILE]);

    applySnapshot(view, snapshot({ cursor: { faceId: 'front', row: 4, col: 4 } }));
    expect(highlight.position.toArray()).toEqual([...FRONT_LAST_TILE]);
    expect(highlight.visible).toBe(true);

    applySnapshot(view, snapshot({ cursor: null }));
    expect(highlight.visible).toBe(false);
    expect(highlight.position.toArray()).toEqual([...FRONT_LAST_TILE]);
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
  it('hides the exploding instance and plays its burst at the mini-cube origin (AC-5)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const mesh = faceMesh(view, 'front');

    // The live tile occupies row 0, col 0 → its matrix starts at the pinned position.
    expect(new Vector3().setFromMatrixPosition(instanceMatrix(mesh, 0)).toArray()).toEqual([
      ...FRONT_FIRST_TILE,
    ]);

    view.applyIntents([explosionIntent('front:0:0', 'front')], 100);

    // Hidden: the instance keeps its slot and position, only its scale is zeroed.
    const hidden = instanceMatrix(mesh, 0);
    expect([hidden.elements[0], hidden.elements[5], hidden.elements[10]]).toEqual([0, 0, 0]);
    expect(new Vector3().setFromMatrixPosition(hidden).toArray()).toEqual([...FRONT_FIRST_TILE]);

    // Every other tile is untouched.
    expect(instanceMatrix(mesh, 1).elements[0]).toBe(Math.fround(0.9));

    // The burst plays, one fragment per particle, all sitting on the tile origin.
    const positions = particlePositions(view);
    expect(particlePoints(view).geometry.drawRange.count).toBe(3);
    expect([positions[0], positions[1], positions[2]]).toEqual([...FRONT_FIRST_TILE]);
    expect([positions[3], positions[4], positions[5]]).toEqual([...FRONT_FIRST_TILE]);
  });

  it('follows the cube rotation when placing an explosion origin', () => {
    const view = createView();
    applySnapshot(view, snapshot({ orientation: { yawSteps: 1, pitchSteps: 0 } }));

    view.applyIntents([explosionIntent('front:0:0', 'front')], 0);

    // +1 yaw is +90° about +Y: (x, z) → (z, -x) for the tile at (-2, 2, 2.625).
    const positions = particlePositions(view);
    expect([positions[0], positions[1], positions[2]]).toEqual([2.625, 2, 2]);
  });

  it('falls back to the cube centre when the exploding face is already gone', () => {
    const view = createView();
    applySnapshot(view, snapshot());

    view.applyIntents([{ kind: 'faceCleared', faceId: 'back' }], 0);
    view.update(400);
    expect(faceMeshes(view)).toHaveLength(5);

    view.applyIntents([explosionIntent('back:0:0', 'back', 2)], 500);

    // No instance left to read an origin from: the burst plays at the cube centre.
    const positions = particlePositions(view);
    expect(particlePoints(view).geometry.drawRange.count).toBe(2);
    expect([positions[0], positions[1], positions[2]]).toEqual([0, 0, 0]);
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
    const highlight = cubeGroup(view).children[1] as Mesh;

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
      vi.spyOn(highlight.geometry, 'dispose'),
      vi.spyOn(highlight.material as Material, 'dispose'),
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
