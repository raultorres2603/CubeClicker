import {
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  type Object3D,
} from 'three';
import { describe, expect, it, vi } from 'vitest';

import { CUBE_STYLES } from '../game/progression';
import type { MiniCubeId } from '../game/types';
import type { MemberState, Position, ServerMessage } from '../multiplayer/protocol';
import { createCubeView } from './cube-view';
import { pickMiniCube } from './picking';
import { createWorldView, type WorldView } from './world';

/**
 * Two tiers in one file, as the render layer is pinned by the spec:
 *
 * - Unit: the world view is driven directly through its public API against real three.js
 *   objects (no mocked collaborators) — roster reconciliation, broadcast application,
 *   drawable counts and disposal are read back from the scene graph, instance matrices and
 *   the particle buffer.
 * - Integration: the picker isolation case composes the world with the own cube view, a
 *   real `PerspectiveCamera` and a real `Raycaster`/`pickMiniCube`, and proves a ray that
 *   hits only a remote cube view resolves to `null`.
 *
 * Remote positions are the exact server-assigned ring literals the backend emits for
 * X = 10 (`worldPosition(slot, 10)`); the world view never recomputes them.
 */

const OBSIDIAN = CUBE_STYLES[0]!;
const CRIMSON = CUBE_STYLES[1]!;
const VIOLET = CUBE_STYLES[4]!;

/** The X = 10 ring positions of the remote slots used below (backend literals). */
const SLOT_2: Position = { x: 30.902172888029035, y: 22.45174281092734 };
const SLOT_3: Position = { x: 11.803579717001593, y: 36.32768297475154 };
const SLOT_4: Position = { x: -11.80357971700159, y: 36.32768297475154 };
const SLOT_9: Position = { x: 11.803579717001586, y: -36.32768297475154 };

/** All remote slots of a full X = 10 server (the own cube at slot 1 is the scene's). */
const FULL_ROSTER_SLOTS: ReadonlyArray<{ slot: number; position: Position }> = [
  { slot: 2, position: SLOT_2 },
  { slot: 3, position: SLOT_3 },
  { slot: 4, position: SLOT_4 },
  { slot: 5, position: { x: -30.902172888029032, y: 22.451742810927342 } },
  { slot: 6, position: { x: -38.197186342054884, y: 4.6778061990232514e-15 } },
  { slot: 7, position: { x: -30.902172888029035, y: -22.451742810927335 } },
  { slot: 8, position: { x: -11.803579717001599, y: -36.32768297475154 } },
  { slot: 9, position: SLOT_9 },
  { slot: 10, position: { x: 30.902172888029032, y: -22.451742810927346 } },
];

/** A random source that yields zero burst jitter and the fixed fallback direction. */
const fixedRandom = (): number => 0.5;

function createWorld(maxUsers = 10): WorldView {
  return createWorldView({ maxUsers, random: fixedRandom });
}

function member(
  playerId: string,
  position: Position,
  overrides: Partial<MemberState> = {},
): MemberState {
  return {
    playerId,
    name: `Player ${playerId.slice(1)}`,
    position,
    levelIndex: 0,
    gridSize: 5,
    styleId: OBSIDIAN.id,
    removedIds: [],
    ...overrides,
  };
}

function frontIds(gridSize: number): MiniCubeId[] {
  const ids: MiniCubeId[] = [];
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      ids.push(`front:${row}:${col}`);
    }
  }
  return ids;
}

/** Total `Mesh`/`InstancedMesh` drawables under a root (the accepted drawable count). */
function countMeshes(root: Object3D): number {
  const self = root instanceof Mesh ? 1 : 0;
  return root.children.reduce((total, child) => total + countMeshes(child), self);
}

/** Total three.js objects under a root (groups, drawables and lights). */
function countObjects(root: Object3D): number {
  return 1 + root.children.reduce((total, child) => total + countObjects(child), 0);
}

/** The three scale factors of one instance: the length of each basis column. */
function instanceScale(mesh: InstancedMesh, index: number): number[] {
  const matrix = new Matrix4();
  mesh.getMatrixAt(index, matrix);
  return [0, 1, 2].map((axis) => new Vector3().setFromMatrixColumn(matrix, axis).length());
}

/** The world's pooled particle `Points` (its only `Points` drawable). */
function particlePositions(world: WorldView): Float32Array {
  const points = world.particles.group.children.find(
    (child): child is Points => child instanceof Points,
  );
  if (points === undefined) {
    throw new Error('the world view has no particle Points');
  }
  return points.geometry.getAttribute('position').array as Float32Array;
}

describe('createWorldView', () => {
  it('starts with no member views and only the particle drawable', () => {
    const world = createWorld();

    expect(world.views().size).toBe(0);
    expect(world.group.children).toHaveLength(1);
    expect(world.group.children[0]).toBe(world.particles.group);
  });

  it('rejects a capacity that is not a non-negative integer', () => {
    expect(() => createWorldView({ maxUsers: 1.5 })).toThrow(
      new RangeError('maxUsers must be a non-negative integer, received 1.5'),
    );
    expect(() => createWorldView({ maxUsers: -1 })).toThrow(
      new RangeError('maxUsers must be a non-negative integer, received -1'),
    );
  });
});

describe('applyRoster', () => {
  it('builds one cube view per member at the exact server-assigned ring position', () => {
    const world = createWorld();
    const p2 = member('p2', SLOT_2, { gridSize: 5, styleId: OBSIDIAN.id });
    const p3 = member('p3', SLOT_3, {
      levelIndex: 1,
      gridSize: 3,
      styleId: CRIMSON.id,
    });

    world.applyRoster([p2, p3]);

    expect([...world.views().keys()]).toEqual(['p2', 'p3']);
    const p2View = world.views().get('p2')!;
    const p3View = world.views().get('p3')!;
    expect(p2View.group.position.toArray()).toEqual([SLOT_2.x, SLOT_2.y, 0]);
    expect(p3View.group.position.toArray()).toEqual([SLOT_3.x, SLOT_3.y, 0]);
    expect(p2View.faces.get('front')!.count).toBe(25);
    expect(p3View.faces.get('front')!.count).toBe(9);
    expect(p2View.faces.size).toBe(6);
    expect((p2View.body.material as MeshStandardMaterial).color.getHexString()).toBe('0b0b12');
    expect(
      (p2View.faces.get('front')!.material as MeshStandardMaterial).color.getHexString(),
    ).toBe('1de9b6');
    expect((p3View.body.material as MeshStandardMaterial).color.getHexString()).toBe('1a0b0e');
  });

  it('applies the removed tiles of a roster snapshot instantly, including a fully cleared face', () => {
    const world = createWorld();
    const fullFront = frontIds(3);
    const p4 = member('p4', SLOT_4, {
      gridSize: 3,
      styleId: CRIMSON.id,
      removedIds: [...fullFront, 'back:0:0'],
    });

    world.applyRoster([p4]);

    const view = world.views().get('p4')!;
    expect(view.faces.has('front')).toBe(false);
    expect(view.faces.has('back')).toBe(true);
    expect(view.faces.size).toBe(5);
    expect(view.isMiniCubeHidden('front:0:0')).toBe(true);
    expect(view.isMiniCubeHidden('front:2:2')).toBe(true);
    expect(view.isMiniCubeHidden('back:0:0')).toBe(true);
    expect(view.isMiniCubeHidden('back:0:1')).toBe(false);
    // A snapshot is state, not an event: no pop and no burst is replayed.
    expect(world.particles.activeCount()).toBe(0);
  });

  it('keeps existing views and disposes a removed member exactly once', () => {
    const world = createWorld();
    const p2 = member('p2', SLOT_2);
    const p3 = member('p3', SLOT_3, { gridSize: 3 });
    world.applyRoster([p2]);
    const first = world.views().get('p2')!;
    const disposeSpy = vi.spyOn(first.body.geometry, 'dispose');

    world.applyRoster([p2, p3]);
    expect(world.views().get('p2')).toBe(first);
    expect(world.views().size).toBe(2);

    world.applyRoster([p3]);
    expect(world.views().has('p2')).toBe(false);
    expect(world.views().size).toBe(1);
    expect(world.group.children.includes(first.group)).toBe(false);
    expect(disposeSpy).toHaveBeenCalledTimes(1);

    // A repeated reconcile with the same roster never double-disposes.
    world.applyRoster([p3]);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it('repositions a member without rebuilding when only the position changed', () => {
    const world = createWorld();
    const p3 = member('p3', SLOT_3, { gridSize: 3 });
    world.applyRoster([p3]);
    const view = world.views().get('p3')!;

    world.applyRoster([{ ...p3, position: SLOT_4 }]);

    expect(world.views().get('p3')).toBe(view);
    expect(view.group.position.toArray()).toEqual([SLOT_4.x, SLOT_4.y, 0]);
  });

  it('rebuilds a member whose level changed, disposing the old view once', () => {
    const world = createWorld();
    const p3 = member('p3', SLOT_3, { gridSize: 3, styleId: CRIMSON.id });
    world.applyRoster([p3]);
    const old = world.views().get('p3')!;
    const disposeSpy = vi.spyOn(old.body.geometry, 'dispose');

    world.applyRoster([
      {
        ...p3,
        levelIndex: 2,
        gridSize: 7,
        styleId: VIOLET.id,
        removedIds: [],
      },
    ]);

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    const next = world.views().get('p3')!;
    expect(next).not.toBe(old);
    expect(world.views().size).toBe(1);
    expect(next.group.position.toArray()).toEqual([SLOT_3.x, SLOT_3.y, 0]);
    expect(next.faces.get('front')!.count).toBe(49);
    expect((next.body.material as MeshStandardMaterial).color.getHexString()).toBe('140a1f');
  });

  it('applies newly reported removed tiles on a same-level roster refresh without a pop', () => {
    const world = createWorld();
    const p3 = member('p3', SLOT_3, { gridSize: 3, styleId: CRIMSON.id });
    world.applyRoster([p3]);
    const view = world.views().get('p3')!;

    world.applyRoster([{ ...p3, removedIds: ['front:0:0', 'front:0:0'] }]);

    expect(world.views().get('p3')).toBe(view);
    expect(view.isMiniCubeHidden('front:0:0')).toBe(true);
    expect(view.isMiniCubeHidden('front:0:1')).toBe(false);
    expect(world.particles.activeCount()).toBe(0);
  });

  it('rejects a roster beyond the remote capacity of the server', () => {
    const world = createWorldView({ maxUsers: 2, random: fixedRandom });

    expect(() => world.applyRoster([member('p2', SLOT_2), member('p3', SLOT_3)])).toThrow(
      new RangeError('roster of 2 exceeds the 1 remote slots of a 2-member server'),
    );
    expect(world.views().size).toBe(0);
  });

  it('renders at most (X - 1) x 7 meshes for a full X = 10 roster', () => {
    const world = createWorld(10);
    const roster = FULL_ROSTER_SLOTS.map(({ slot, position }) =>
      member(`p${slot}`, position, { gridSize: 7, styleId: CUBE_STYLES[slot % 5]!.id }),
    );

    world.applyRoster(roster);

    expect(world.views().size).toBe(9);
    for (const entry of roster) {
      const view = world.views().get(entry.playerId)!;
      expect(view.group.position.toArray()).toEqual([entry.position.x, entry.position.y, 0]);
      expect(view.faces.size).toBe(6);
      for (const face of view.faces.values()) {
        expect(face.count).toBe(49);
      }
    }
    const meshes = countMeshes(world.group);
    expect(meshes).toBe(9 * 7);
    expect(meshes).toBeLessThanOrEqual(9 * 7);
    expect(meshes).toBeLessThanOrEqual(10 * 7);
  });

  it('falls back to the pinned first style for an unknown style id', () => {
    const world = createWorld();

    world.applyRoster([member('p2', SLOT_2, { styleId: 'not-a-style' })]);

    expect(
      (world.views().get('p2')!.body.material as MeshStandardMaterial).color.getHexString(),
    ).toBe('0b0b12');
  });
});

describe('applyMessage', () => {
  it('hides the exact tile, starts its pop and spawns the burst at the tile origin', () => {
    const world = createWorld();
    const p2 = member('p2', SLOT_2, { gridSize: 5, styleId: OBSIDIAN.id });
    world.applyRoster([p2]);
    const view = world.views().get('p2')!;

    world.applyMessage({ type: 'miniCubeRemoved', playerId: 'p2', id: 'front:1:2' });

    expect(view.isMiniCubeHidden('front:1:2')).toBe(true);
    expect(view.isMiniCubeHidden('front:1:3')).toBe(false);
    expect(world.particles.activeCount()).toBe(24);
    // `random = 0.5` gives zero jitter and the zero-length fallback direction, so every
    // fragment starts exactly on the burst origin: the `front:1:2` tile centre plus the
    // accepted 0.5 outward offset. The buffer is float32 — the pinned `Math.fround` pattern.
    const positions = particlePositions(world);
    expect(Array.from(positions.slice(0, 3))).toEqual([
      Math.fround(SLOT_2.x),
      Math.fround(SLOT_2.y + 1),
      3.125,
    ]);

    // Repeated/foreign broadcasts never restart the pop or spawn another burst.
    world.applyMessage({ type: 'miniCubeRemoved', playerId: 'p2', id: 'front:1:2' });
    world.applyMessage({ type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' });
    world.applyMessage({ type: 'miniCubeRemoved', playerId: 'p9', id: 'front:0:0' });
    expect(world.particles.activeCount()).toBe(24);

    world.update(160);
    expect(instanceScale(view.faces.get('front')!, 7)).toEqual([0, 0, 0]);
    expect(instanceScale(view.faces.get('front')!, 8)).toEqual([
      Math.fround(0.95),
      Math.fround(0.95),
      0.25,
    ]);
    expect(world.particles.activeCount()).toBe(24);

    world.update(190);
    expect(world.particles.activeCount()).toBe(0);
  });

  it('derives a face clear from the 0-remaining transition after the accepted fade', () => {
    const world = createWorld();
    const p3 = member('p3', SLOT_3, { gridSize: 3, styleId: CRIMSON.id });
    world.applyRoster([p3]);
    const view = world.views().get('p3')!;
    const mesh = view.faces.get('front')!;
    const disposeSpy = vi.spyOn(mesh.geometry, 'dispose');

    const front = frontIds(3);
    for (const id of front.slice(0, front.length - 1)) {
      world.applyMessage({ type: 'miniCubeRemoved', playerId: 'p3', id });
    }
    expect(view.faces.has('front')).toBe(true);
    expect(disposeSpy).toHaveBeenCalledTimes(0);

    world.applyMessage({ type: 'miniCubeRemoved', playerId: 'p3', id: 'front:2:2' });
    expect(view.faces.has('front')).toBe(true);
    expect(disposeSpy).toHaveBeenCalledTimes(0);

    world.update(399);
    expect(view.faces.has('front')).toBe(true);
    expect(disposeSpy).toHaveBeenCalledTimes(0);

    world.update(1);
    expect(view.faces.has('front')).toBe(false);
    expect(view.faces.size).toBe(5);
    expect(view.isMiniCubeHidden('front:2:2')).toBe(true);
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it('rebuilds a member on levelAdvanced exactly once at the new position and cube', () => {
    const world = createWorld();
    const p2 = member('p2', SLOT_2, { gridSize: 5, styleId: OBSIDIAN.id });
    world.applyRoster([p2]);
    const old = world.views().get('p2')!;
    const disposeSpy = vi.spyOn(old.body.geometry, 'dispose');

    world.applyMessage({
      type: 'levelAdvanced',
      playerId: 'p2',
      levelIndex: 3,
      gridSize: 7,
      styleId: VIOLET.id,
      position: SLOT_9,
      removedIds: [],
    });

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    const next = world.views().get('p2')!;
    expect(next).not.toBe(old);
    expect(world.views().size).toBe(1);
    expect(next.group.position.toArray()).toEqual([SLOT_9.x, SLOT_9.y, 0]);
    expect(next.faces.get('front')!.count).toBe(49);
    expect((next.body.material as MeshStandardMaterial).color.getHexString()).toBe('140a1f');
  });

  it('ignores levelAdvanced for a member the world does not render', () => {
    const world = createWorld();
    world.applyRoster([member('p2', SLOT_2)]);

    world.applyMessage({
      type: 'levelAdvanced',
      playerId: 'p1',
      levelIndex: 1,
      gridSize: 3,
      styleId: CRIMSON.id,
      position: SLOT_9,
      removedIds: [],
    });

    expect(world.views().size).toBe(1);
    expect(world.views().get('p2')!.faces.get('front')!.count).toBe(25);
  });

  it('adds and removes members from memberJoined and memberLeft', () => {
    const world = createWorld();

    world.applyMessage({ type: 'memberJoined', member: member('p2', SLOT_2) });
    expect([...world.views().keys()]).toEqual(['p2']);
    expect(world.views().get('p2')!.group.position.toArray()).toEqual([SLOT_2.x, SLOT_2.y, 0]);

    const view = world.views().get('p2')!;
    const disposeSpy = vi.spyOn(view.body.geometry, 'dispose');
    world.applyMessage({ type: 'memberLeft', playerId: 'p2', reason: 'moved' });
    expect(world.views().size).toBe(0);
    expect(world.group.children.includes(view.group)).toBe(false);
    expect(disposeSpy).toHaveBeenCalledTimes(1);

    world.applyMessage({ type: 'memberLeft', playerId: 'p2', reason: 'left' });
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it('ignores messages the world does not own', () => {
    const world = createWorld();
    world.applyRoster([member('p2', SLOT_2)]);
    const view = world.views().get('p2')!;

    world.applyMessage({ type: 'hello', serverTime: '2026-10-22T00:00:00.000Z' });
    world.applyMessage({
      type: 'stateSync',
      playerId: 'p2',
      levelIndex: 4,
      gridSize: 7,
      styleId: 'solar-gold',
      removedIds: ['front:0:0'],
    } satisfies ServerMessage);

    expect(world.views().get('p2')).toBe(view);
    expect(world.views().size).toBe(1);
    expect(view.isMiniCubeHidden('front:0:0')).toBe(false);
  });
});

describe('dispose', () => {
  it('returns the scene to its pre-world object count and is idempotent', () => {
    const scene = new Scene();
    const own = createCubeView(OBSIDIAN, 7);
    scene.add(own.group);
    // Scene + own cube group + body + six faces.
    const baseline = countObjects(scene);
    expect(baseline).toBe(9);

    const world = createWorld();
    world.applyRoster(FULL_ROSTER_SLOTS.map(({ slot, position }) =>
      member(`p${slot}`, position, { gridSize: 7 }),
    ));
    scene.add(world.group);

    world.dispose();

    expect(countObjects(scene)).toBe(baseline);
    expect(world.group.parent).toBe(null);
    expect(world.group.children).toHaveLength(0);
    expect(world.views().size).toBe(0);

    // Idempotent teardown and post-dispose no-ops.
    world.dispose();
    world.applyRoster([]);
    world.applyMessage({ type: 'memberLeft', playerId: 'p2', reason: 'left' });
    world.update(16);
    expect(countObjects(scene)).toBe(baseline);
  });
});

describe('picker isolation', () => {
  it('resolves null for a ray that hits only a remote cube view', () => {
    const scene = new Scene();
    const own = createCubeView(OBSIDIAN, 5);
    scene.add(own.group);
    const world = createWorld();
    world.applyRoster([member('p2', { x: 24, y: 0 }, { gridSize: 5 })]);
    scene.add(world.group);

    const camera = new PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(24, 0, 12);
    camera.lookAt(24, 0, 0);
    camera.updateMatrixWorld();
    scene.updateMatrixWorld(true);
    const remoteFront = world.views().get('p2')!.faces.get('front')!;
    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2(0, 0), camera);
    // The ray really crosses the remote cube's front grid — centre instance 12 (row 2, col 2).
    expect(raycaster.intersectObject(remoteFront, false)[0]?.instanceId).toBe(12);

    // The own handle is the only pickable one: the same ray resolves to no mini-cube.
    expect(pickMiniCube(camera, own, 'front', 0, 0)).toBe(null);

    // Sanity anchor: over the own cube the own handle picks its centre tile.
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    expect(pickMiniCube(camera, own, 'front', 0, 0)).toBe('front:2:2');
  });
});
