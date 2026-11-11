import { Group, InstancedMesh, Matrix4, Points, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { createEngine, type EffectIntent, type EngineSnapshot } from '../game/engine';
import { CUBE_STYLES } from '../game/progression';
import { type FaceId, type MiniCubeId } from '../game/types';
import { createSceneView, type SceneView } from './scene';

/**
 * Integration tier for T3's scene wiring (spec AC-7): the real `SceneView` feeds the real
 * quality matrix into the real impact pools, cube view and spaceship. Every assertion reads
 * the live three.js state through the scene graph or an instance buffer; nothing about the
 * modules is mocked.
 */

const STYLE = CUBE_STYLES[0]!;

/** A random source that yields exactly zero jitter (same pinned source as the scene tests). */
const fixedRandom = (): number => 0.5;

function createView(): SceneView {
  return createSceneView({ style: STYLE, random: fixedRandom });
}

function snapshot(overrides: Partial<EngineSnapshot> = {}): EngineSnapshot {
  return {
    ...createEngine({ random: fixedRandom }).getSnapshot(),
    phase: 'playing',
    phaseProgress: 1,
    ...overrides,
  };
}

function applySnapshot(view: SceneView, value: EngineSnapshot): void {
  view.applySnapshot(value, 0);
}

/** A click intent whose burst carries the pinned 24 immobile high-tier spark fragments. */
function explosionIntent(id: MiniCubeId, faceId: FaceId, count = 24): EffectIntent {
  return {
    kind: 'explosion',
    id,
    faceId,
    burst: {
      particles: Array.from({ length: count }, () => ({
        dx: 0,
        dy: 1,
        dz: 0,
        speed: 0,
        size: 0.02,
      })),
      lifetimeMs: 350,
    },
  };
}

function click(view: SceneView, id: MiniCubeId, faceId: FaceId, count = 24): void {
  view.applyIntents([explosionIntent(id, faceId, count)], 0);
}

/** The three-child impact group. */
function impactGroup(view: SceneView): Group {
  const group = view.scene.getObjectByName('impact-effects');
  if (!(group instanceof Group)) {
    throw new Error('no impact-effects group');
  }
  return group;
}

/** One impact-pool drawable by its pinned name. */
function impactChild<T extends InstancedMesh | Points>(view: SceneView, name: string): T {
  const child = impactGroup(view).children.find((candidate) => candidate.name === name);
  if (child === undefined) {
    throw new Error(`no ${name} impact child`);
  }
  return child as T;
}

/** The scene's own spark `Points` (the particle group's direct `Points` child). */
function sparkPoints(view: SceneView): Points {
  for (const child of view.scene.children) {
    if (!(child instanceof Group)) {
      continue;
    }
    const points = child.children.find(
      (candidate): candidate is Points => candidate instanceof Points,
    );
    if (points !== undefined) {
      return points;
    }
  }
  throw new Error('no spark Points');
}

function shotsGroup(view: SceneView): Group {
  const group = view.scene.getObjectByName('spaceship-shots');
  if (!(group instanceof Group)) {
    throw new Error('no spaceship-shots group');
  }
  return group;
}

function modelGroup(view: SceneView): Group {
  const group = view.scene.getObjectByName('cursor-ship-model');
  if (!(group instanceof Group)) {
    throw new Error('no cursor-ship-model group');
  }
  return group;
}

/** The three scale factors of one instance: the length of each basis column. */
function instanceScale(mesh: InstancedMesh, index: number): number[] {
  const matrix = new Matrix4();
  mesh.getMatrixAt(index, matrix);
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

/** The front face's first instance (`front:0:0`). */
function frontTile(view: SceneView): InstancedMesh {
  const mesh = view.cubeView.faces.get('front');
  if (mesh === undefined) {
    throw new Error('no front face');
  }
  return mesh;
}

describe('scene impact wiring (AC-7)', () => {
  it('wires the high tier to 14 shards, 24 sparks, 1 flash and 12 burst points', () => {
    const view = createView();
    applySnapshot(view, snapshot());

    click(view, 'front:0:0', 'front');
    view.update(180);

    expect(impactChild<InstancedMesh>(view, 'impact-shards').count).toBe(14);
    expect(sparkPoints(view).geometry.drawRange.count).toBe(24);
    expect(impactChild<InstancedMesh>(view, 'impact-flash').count).toBe(1);
    expect(impactChild<Points>(view, 'impact-burst').geometry.drawRange.count).toBe(12);
  });

  it('wires the medium tier to 7 shards, 12 sparks, 1 flash and 6 burst points', () => {
    const view = createView();
    view.setQualityTierForTesting('medium');
    applySnapshot(view, snapshot({ reducedMotion: false }));

    click(view, 'front:0:0', 'front');
    view.update(180);

    expect(impactChild<InstancedMesh>(view, 'impact-shards').count).toBe(7);
    expect(sparkPoints(view).geometry.drawRange.count).toBe(12);
    expect(impactChild<InstancedMesh>(view, 'impact-flash').count).toBe(1);
    expect(impactChild<Points>(view, 'impact-burst').geometry.drawRange.count).toBe(6);
  });

  it('suppresses every impact pool at the low tier but keeps the destroy collapse', () => {
    const view = createView();
    view.setQualityTierForTesting('low');
    applySnapshot(view, snapshot());
    const tile = frontTile(view);

    click(view, 'front:0:0', 'front');
    view.update(180);

    expect(impactChild<InstancedMesh>(view, 'impact-shards').count).toBe(0);
    expect(sparkPoints(view).geometry.drawRange.count).toBe(0);
    expect(impactChild<InstancedMesh>(view, 'impact-flash').count).toBe(0);
    expect(impactChild<Points>(view, 'impact-burst').geometry.drawRange.count).toBe(0);

    // Q-6: low keeps the 140 ms collapse (flash 3, full extent at the impact frame).
    expect(instanceScale(tile, 0)).toEqual([Math.fround(0.95), Math.fround(0.95), 0.25]);
    expect(instanceColor(tile, 0)).toEqual([3, 3, 3]);
    view.update(70);
    expect(instanceColor(tile, 0)).toEqual([1.4444444179534912, 1.4444444179534912, 1.4444444179534912]);
    view.update(70);
    expect(instanceScale(tile, 0)).toEqual([0, 0, 0]);
    expect(instanceColor(tile, 0)).toEqual([1, 1, 1]);
  });

  it('suppresses every impact pool and spawns no shot under reduced motion', () => {
    const view = createView();
    applySnapshot(view, snapshot({ reducedMotion: true }));
    const tile = frontTile(view);

    click(view, 'front:0:0', 'front');

    // Reduced motion is the accepted instant conceal: zero on the click frame, colour 1.
    expect(view.cubeView.isMiniCubeHidden('front:0:0')).toBe(true);
    expect(instanceScale(tile, 0)).toEqual([0, 0, 0]);
    expect(instanceColor(tile, 0)).toEqual([1, 1, 1]);
    expect(view.shots).toHaveLength(0);

    view.update(180);
    expect(impactChild<InstancedMesh>(view, 'impact-shards').count).toBe(0);
    expect(sparkPoints(view).geometry.drawRange.count).toBe(0);
    expect(impactChild<InstancedMesh>(view, 'impact-flash').count).toBe(0);
    expect(impactChild<Points>(view, 'impact-burst').geometry.drawRange.count).toBe(0);
    expect(view.shots).toHaveLength(0);
  });

  it('keeps exactly the three impact children and no gold ray/coin/ring object', () => {
    const view = createView();

    expect(impactGroup(view).children.map((child) => child.name)).toEqual([
      'impact-shards',
      'impact-flash',
      'impact-burst',
    ]);

    const names: string[] = [];
    view.scene.traverse((object) => names.push(object.name));
    expect(names).not.toContain('impact-rays');
    expect(names).not.toContain('impact-coins');
    expect(names).not.toContain('impact-ring');
    expect(names.filter((name) => name.toLowerCase().includes('gold'))).toEqual([]);
  });
});

describe('scene destroy timeline (AC-7)', () => {
  it('starts the destroy on the arrival frame and completes it 140 ms later', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const tile = frontTile(view);

    click(view, 'front:0:0', 'front');
    // Before the shot arrives the tile keeps its idle extent and colour.
    expect(instanceScale(tile, 0)).toEqual([Math.fround(0.95), Math.fround(0.95), 0.25]);
    expect(instanceColor(tile, 0)).toEqual([1, 1, 1]);
    expect(view.shots).toHaveLength(1);

    view.update(180);
    // Arrival frame: hidden/unpickable, flash brightness 3 and full pop extent (scale 1).
    expect(view.cubeView.isMiniCubeHidden('front:0:0')).toBe(true);
    expect(instanceScale(tile, 0)).toEqual([Math.fround(0.95), Math.fround(0.95), 0.25]);
    expect(instanceColor(tile, 0)).toEqual([3, 3, 3]);

    // +70 ms: mid-collapse (the pinned 0.437355… pop factor of the 0.95 tile edge).
    view.update(70);
    expect(instanceScale(tile, 0)).toEqual([
      0.4154876172542572,
      0.4154876172542572,
      0.10933884233236313,
    ]);
    expect(instanceColor(tile, 0)).toEqual([
      1.4444444179534912,
      1.4444444179534912,
      1.4444444179534912,
    ]);

    // +140 ms: fully zero-scaled, colour restored to the idle multiplier.
    view.update(70);
    expect(instanceScale(tile, 0)).toEqual([0, 0, 0]);
    expect(instanceColor(tile, 0)).toEqual([1, 1, 1]);
  });
});

describe('scene shot sequence (AC-7)', () => {
  it('fires the bolt from the muzzle with a flash and a settling recoil', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    view.setPointerTarget(0, 0);

    click(view, 'front:0:0', 'front');
    const shot = view.shots[0]!;
    expect(shot.start.toArray()).toEqual([0, 0, 6]);
    expect(shot.muzzle.toArray()).toEqual([0, 0, 6.78]);
    expect(shot.mesh.name).toBe('shot-bolt');
    expect(shot.muzzleFlash.name).toBe('shot-muzzle-flash');
    expect(shotsGroup(view).children.map((child) => child.name).sort()).toEqual([
      'shot-bolt',
      'shot-muzzle-flash',
    ]);
    expect(modelGroup(view).position.z).toBe(0);

    // The shot reaction starts immediately (recoil offset at the spawn frame).
    view.update(0);
    expect(modelGroup(view).position.z).toBe(-0.12);

    // The muzzle flash is still drawn one millisecond before its 80 ms lifetime ends.
    view.update(79);
    expect(shot.muzzleRemainingMs).toBe(1);
    expect(shotsGroup(view).children.map((child) => child.name).sort()).toEqual([
      'shot-bolt',
      'shot-muzzle-flash',
    ]);
    expect(modelGroup(view).position.z).toBe(-0.004786180555555552);

    // By 80 ms the flash is removed; the bolt keeps travelling.
    view.update(1);
    expect(shot.muzzleRemainingMs).toBe(0);
    expect(shotsGroup(view).children.map((child) => child.name)).toEqual(['shot-bolt']);
    expect(view.shots).toHaveLength(1);
    expect(modelGroup(view).position.z).toBe(-0.0044444444444444505);

    // By 120 ms the recoil has settled exactly to zero.
    view.update(40);
    expect(modelGroup(view).position.z).toBe(0);
    expect(view.shots).toHaveLength(1);

    // The shot arrives at 180 ms and the impact starts on that frame.
    view.update(60);
    expect(view.shots).toHaveLength(0);
    expect(view.cubeView.isMiniCubeHidden('front:0:0')).toBe(true);
    expect(impactChild<InstancedMesh>(view, 'impact-shards').count).toBe(14);
  });

  it('keeps the bolt but suppresses the muzzle flash and recoil at the low tier', () => {
    const view = createView();
    view.setQualityTierForTesting('low');
    applySnapshot(view, snapshot());
    view.setPointerTarget(0, 0);

    click(view, 'front:0:0', 'front');
    expect(shotsGroup(view).children.map((child) => child.name)).toEqual(['shot-bolt']);
    view.update(0);
    expect(modelGroup(view).position.z).toBe(0);
    view.update(79);
    expect(modelGroup(view).position.z).toBe(0);
    view.update(101);
    expect(view.shots).toHaveLength(0);
    expect(view.cubeView.isMiniCubeHidden('front:0:0')).toBe(true);
  });

  it('keeps the camera position and quaternion identical across the whole sequence', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const position = view.camera.position.toArray();
    const quaternion = view.camera.quaternion.toArray();

    click(view, 'front:0:0', 'front');
    view.update(180);
    view.update(70);
    view.update(70);
    view.update(340);

    expect(view.camera.position.toArray()).toEqual(position);
    expect(view.camera.quaternion.toArray()).toEqual(quaternion);
  });
});
