import { Group, Mesh } from 'three';
import { describe, expect, it } from 'vitest';

import { createEngine, type EffectIntent, type EngineSnapshot } from '../game/engine';
import { CUBE_STYLES } from '../game/progression';
import { type FaceId, type MiniCubeId } from '../game/types';
import { createSceneView, type SceneView } from './scene';
import { spaceshipFollowFactor, spaceshipTargetPosition } from './spaceship';

const STYLE = CUBE_STYLES[0]!;
const fixedRandom = (): number => 0.5;

function createView() {
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

function applyIntents(view: SceneView, intents: EffectIntent[], nowMs = 0): void {
  view.applyIntents(intents, nowMs);
}

function explosionIntent(id: MiniCubeId, faceId: FaceId): EffectIntent {
  return {
    kind: 'explosion',
    id,
    faceId,
    burst: {
      particles: Array.from({ length: 3 }, () => ({ dx: 0, dy: 1, dz: 0, speed: 0, size: 0.02 })),
      lifetimeMs: 350,
    },
  };
}

function spaceshipGroup(view: SceneView): Group {
  const group = view.scene.children.find(
    (child): child is Group => child instanceof Group && child.name === 'spaceship',
  );
  if (group === undefined) {
    throw new Error('no spaceship group');
  }
  return group;
}

function particlePoints(view: SceneView) {
  for (const child of view.scene.children) {
    if (!(child instanceof Group)) continue;
    const points = child.children.find((c) => (c as { isPoints?: boolean }).isPoints);
    if (points !== undefined) return points as unknown as { geometry: { drawRange: { count: number } } };
  }
  throw new Error('no particle points');
}

describe('scene spaceship integration', () => {
  it('adds a spaceship group named spaceship containing a Mesh (AC-1)', () => {
    const view = createView();
    const group = spaceshipGroup(view);
    expect(group.name).toBe('spaceship');
    expect(group.children.some((c) => c instanceof Mesh)).toBe(true);
    expect(view.scene.children).toContain(group);
  });

  it('survives a cube rebuild without duplication (AC-1, AC-8)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    applyIntents(view, [{ kind: 'levelChanged', style: CUBE_STYLES[1]! }]);
    applySnapshot(view, snapshot({ style: CUBE_STYLES[1]!, levelIndex: 1 }));
    const groups = view.scene.children.filter(
      (c) => c instanceof Group && c.name === 'spaceship',
    );
    expect(groups).toHaveLength(1);
  });

  it('follows the pointer with the pinned factor after 120 ms (AC-2)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    view.setPointerTarget(0, 0);
    const group = spaceshipGroup(view);
    const start = group.position.clone();
    const target = spaceshipTargetPosition(view.camera, 0, 0);
    view.update(120);
    const factor = spaceshipFollowFactor(120, false);
    const expected = start.clone().lerp(target, factor);
    expect(group.position.x).toBeCloseTo(expected.x, 6);
    expect(group.position.y).toBeCloseTo(expected.y, 6);
    expect(group.position.z).toBeCloseTo(expected.z, 6);
  });

  it('snaps under reduced motion for dtMs 0 (AC-2)', () => {
    const view = createView();
    applySnapshot(view, snapshot({ reducedMotion: true }));
    view.setPointerTarget(0, 0);
    const group = spaceshipGroup(view);
    const target = spaceshipTargetPosition(view.camera, 0, 0);
    view.update(0);
    expect(group.position.x).toBeCloseTo(target.x, 6);
    expect(group.position.y).toBeCloseTo(target.y, 6);
    expect(group.position.z).toBeCloseTo(target.z, 6);
  });

  it('does not move with dtMs 0 without reduced motion (AC-2)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    view.setPointerTarget(0, 0);
    const group = spaceshipGroup(view);
    const before = group.position.clone();
    view.update(0);
    expect(group.position.toArray()).toEqual(before.toArray());
  });

  it('stays at default (0,0,6) with no pointer (AC-2)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const group = spaceshipGroup(view);
    view.update(120);
    expect(group.position.toArray()).toEqual([0, 0, 6]);
  });

  it('defers explosion on non-reduced motion (AC-4)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const beforeHidden = view.cubeView.isMiniCubeHidden('front:0:0');
    expect(beforeHidden).toBe(false);
    applyIntents(view, [explosionIntent('front:0:0', 'front')]);
    expect(view.cubeView.isMiniCubeHidden('front:0:0')).toBe(false);
    expect(particlePoints(view).geometry.drawRange.count).toBe(0);
    expect(view.shots).toHaveLength(1);
    const shot = view.shots[0]!;
    const group = spaceshipGroup(view);
    expect(shot.start.toArray()).toEqual(group.position.toArray());
    // target is mini-cube origin
    expect(shot.target.toArray()).toEqual([-2, 2, 2.625]);
  });

  it('travels and triggers explosion on arrival (AC-5)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    applyIntents(view, [explosionIntent('front:0:0', 'front')], 42);
    const shot = view.shots[0]!;
    const start = shot.start.clone();
    const target = shot.target.clone();
    // midpoint
    view.update(90);
    expect(view.shots).toHaveLength(1);
    const midShot = view.shots[0]!;
    expect(midShot.mesh.position.x).toBeCloseTo((start.x + target.x) / 2, 6);
    expect(midShot.mesh.position.y).toBeCloseTo((start.y + target.y) / 2, 6);
    expect(midShot.mesh.position.z).toBeCloseTo((start.z + target.z) / 2, 6);
    // arrival
    view.update(90);
    expect(view.shots).toHaveLength(0);
    expect(view.cubeView.isMiniCubeHidden('front:0:0')).toBe(true);
    expect(particlePoints(view).geometry.drawRange.count).toBeGreaterThanOrEqual(3);
    expect(view.lastFrameTime).toBe(42);
  });

  it('uses default frame time 0 when no prior frame (AC-5)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    // update without prior applyIntents? But explosion needs applyIntents. We'll set lastFrameTime by not passing? applyIntents with 0.
    applyIntents(view, [explosionIntent('front:0:0', 'front')], 0);
    view.update(180);
    expect(view.lastFrameTime).toBe(0);
  });

  it('reduced motion: instant, no shot (AC-6)', () => {
    const view = createView();
    applySnapshot(view, snapshot({ reducedMotion: true }));
    applyIntents(view, [explosionIntent('front:0:0', 'front')]);
    expect(view.cubeView.isMiniCubeHidden('front:0:0')).toBe(true);
    expect(particlePoints(view).geometry.drawRange.count).toBeGreaterThanOrEqual(3);
    expect(view.shots).toHaveLength(0);
    view.update(180);
    expect(view.shots).toHaveLength(0);
  });

  it('dispose empties shots and removes spaceship (AC-8)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    applyIntents(view, [explosionIntent('front:0:0', 'front')]);
    expect(view.shots).toHaveLength(1);
    view.dispose();
    expect(view.shots).toHaveLength(0);
    const groups = view.scene.children.filter(
      (c) => c instanceof Group && c.name === 'spaceship',
    );
    expect(groups).toHaveLength(0);
  });
});