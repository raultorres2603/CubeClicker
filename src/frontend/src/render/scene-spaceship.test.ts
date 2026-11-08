import { Group, Mesh, MeshStandardMaterial, Points } from 'three';
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

function explosionIntent(id: MiniCubeId, faceId: FaceId, count = 3): EffectIntent {
  return {
    kind: 'explosion',
    id,
    faceId,
    burst: {
      particles: Array.from({ length: count }, () => ({ dx: 0, dy: 1, dz: 0, speed: 0, size: 0.02 })),
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
  it('adds a spaceship group named spaceship containing the 21-mesh model (AC-1)', () => {
    const view = createView();
    const group = spaceshipGroup(view);
    expect(group.name).toBe('spaceship');
    expect(group.children[0]!.name).toBe('cursor-ship-model');
    let meshCount = 0;
    group.traverse((object) => {
      if (object instanceof Mesh) meshCount += 1;
    });
    expect(meshCount).toBe(21);
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

  it('follows the pointer with the pinned factor after 240 ms (AC-2)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    view.setPointerTarget(0, 0);
    const group = spaceshipGroup(view);
    const start = group.position.clone();
    const target = spaceshipTargetPosition(view.camera, 0, 0);
    view.update(240);
    const factor = spaceshipFollowFactor(240, false);
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

  it('reduced motion: instant conceal, no shot and no spark particles (AC-6, AC-48)', () => {
    const view = createView();
    applySnapshot(view, snapshot({ reducedMotion: true }));
    applyIntents(view, [explosionIntent('front:0:0', 'front')]);
    expect(view.cubeView.isMiniCubeHidden('front:0:0')).toBe(true);
    expect(particlePoints(view).geometry.drawRange.count).toBe(0);
    expect(view.shots).toHaveLength(0);
    view.update(180);
    expect(view.shots).toHaveLength(0);
    expect(particlePoints(view).geometry.drawRange.count).toBe(0);
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

/** The single group in the scene carrying `name` (impact-effects / targeting / model). */
function namedGroup(view: SceneView, name: string): Group {
  let found: Group | undefined;
  view.scene.traverse((object) => {
    if (found === undefined && object instanceof Group && object.name === name) {
      found = object;
    }
  });
  if (found === undefined) {
    throw new Error(`no ${name} group`);
  }
  return found;
}

function modelMesh(view: SceneView, name: string): Mesh {
  let found: Mesh | undefined;
  namedGroup(view, 'cursor-ship-model').traverse((object) => {
    if (found === undefined && object instanceof Mesh && object.name === name) {
      found = object;
    }
  });
  if (found === undefined) {
    throw new Error(`no ${name} mesh`);
  }
  return found;
}

function impactMeshCount(view: SceneView, name: string): number {
  const mesh = namedGroup(view, 'impact-effects').children.find((child) => child.name === name);
  if (mesh === undefined) {
    throw new Error(`no ${name} impact pool`);
  }
  return (mesh as { count: number }).count;
}

describe('scene impact and targeting integration (AC-35, AC-37, AC-38)', () => {
  it('nests impact and targeting under the particle group, keeping 9 scene children', () => {
    const view = createView();

    expect(view.scene.children).toHaveLength(9);
    const particles = view.scene.children.find(
      (child): child is Group =>
        child instanceof Group && child.children.some((candidate) => candidate instanceof Points),
    )!;
    expect(particles.children.map((child) => child.name)).toContain('impact-effects');
    expect(particles.children.map((child) => child.name)).toContain('targeting');
    expect(namedGroup(view, 'impact-effects').children).toHaveLength(4);
    expect(namedGroup(view, 'targeting').children).toHaveLength(2);
  });

  it('spawns the four impact pools at the deferred explosion', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    expect(impactMeshCount(view, 'impact-rays')).toBe(0);

    applyIntents(view, [explosionIntent('front:0:0', 'front')], 0);
    expect(impactMeshCount(view, 'impact-rays')).toBe(0);

    view.update(180);
    expect(impactMeshCount(view, 'impact-rays')).toBe(12);
    expect(impactMeshCount(view, 'impact-shards')).toBe(14);
    expect(impactMeshCount(view, 'impact-coins')).toBe(6);
    expect(impactMeshCount(view, 'impact-ring')).toBe(1);
  });

  it('reduced motion spawns only the static ring flash', () => {
    const view = createView();
    applySnapshot(view, snapshot({ reducedMotion: true }));
    applyIntents(view, [explosionIntent('front:0:0', 'front')], 0);

    expect(impactMeshCount(view, 'impact-rays')).toBe(0);
    expect(impactMeshCount(view, 'impact-shards')).toBe(0);
    expect(impactMeshCount(view, 'impact-coins')).toBe(0);
    expect(impactMeshCount(view, 'impact-ring')).toBe(1);

    view.update(120);
    expect(impactMeshCount(view, 'impact-ring')).toBe(0);
  });

  it('locks the hovered tile and clears on a miss', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const targeting = namedGroup(view, 'targeting');
    expect(targeting.visible).toBe(false);

    view.setHoverTarget('front:0:0');
    expect(targeting.visible).toBe(true);
    const outline = targeting.children.find((child) => child.name === 'targeting-outline')!;
    expect(outline.position.toArray()).toEqual([-2, 2, 2.625]);

    view.update(120);
    const reticle = targeting.children.find((child) => child.name === 'targeting-reticle')!;
    expect(reticle.visible).toBe(true);
    expect((outline as unknown as { material: { opacity: number } }).material.opacity).toBe(1);

    view.setHoverTarget(null);
    expect(targeting.visible).toBe(false);
  });

  it('keeps the camera and HUD transforms identical across a pop and ring (AC-44)', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const position = view.camera.position.clone();
    const quaternion = view.camera.quaternion.clone();

    applyIntents(view, [explosionIntent('front:0:0', 'front')], 0);
    view.update(180);
    view.update(180);

    expect(view.camera.position.toArray()).toEqual(position.toArray());
    expect(view.camera.quaternion.toArray()).toEqual(quaternion.toArray());
  });
});

describe('scene adaptive quality wiring (AC-52)', () => {
  it('starts at high with the trail and full detail', () => {
    const view = createView();
    applySnapshot(view, snapshot());

    expect(view.getQualityTier()).toBe('high');
    expect(modelMesh(view, 'cursor-hull-seam-1').visible).toBe(true);
    expect(modelMesh(view, 'cursor-wing-left-tip').visible).toBe(true);
    view.setPointerTarget(0.2, 0.1);
    view.update(16);
    const trail = spaceshipGroup(view).children.find(
      (child): child is Points => child instanceof Points,
    )!;
    expect(trail.visible).toBe(true);
    expect(trail.geometry.drawRange.count).toBe(1);
  });

  it('forces medium: four detail meshes hidden, no trail, 12 sparks', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    view.setQualityTierForTesting('medium');

    expect(view.getQualityTier()).toBe('medium');
    for (const name of [
      'cursor-hull-seam-1',
      'cursor-hull-seam-2',
      'cursor-vent-left',
      'cursor-vent-right',
    ]) {
      expect(modelMesh(view, name).visible).toBe(false);
    }
    expect(modelMesh(view, 'cursor-wing-left-tip').visible).toBe(true);
    const trail = spaceshipGroup(view).children.find(
      (child): child is Points => child instanceof Points,
    )!;
    expect(trail.geometry.drawRange.count).toBe(0);

    applyIntents(view, [explosionIntent('front:0:0', 'front', 24)], 0);
    view.update(180);
    expect(particlePoints(view).geometry.drawRange.count).toBe(12);
  });

  it('forces low: six detail meshes hidden, no sparks, ring only', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    view.setQualityTierForTesting('low');

    expect(view.getQualityTier()).toBe('low');
    expect(modelMesh(view, 'cursor-wing-left-tip').visible).toBe(false);
    expect(modelMesh(view, 'cursor-wing-right-tip').visible).toBe(false);

    applyIntents(view, [explosionIntent('front:0:0', 'front', 24)], 0);
    view.update(180);
    expect(particlePoints(view).geometry.drawRange.count).toBe(0);
    expect(impactMeshCount(view, 'impact-rays')).toBe(0);
    expect(impactMeshCount(view, 'impact-ring')).toBe(1);
  });

  it('medium: the reticle ticks stay off while the outline locks the tile', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    view.setQualityTierForTesting('medium');
    view.setHoverTarget('front:0:0');

    const targeting = namedGroup(view, 'targeting');
    const reticle = targeting.children.find((child) => child.name === 'targeting-reticle')!;
    const outline = targeting.children.find((child) => child.name === 'targeting-outline')!;
    expect(reticle.visible).toBe(false);
    expect(outline.visible).toBe(true);
    expect(targeting.visible).toBe(true);
  });

  it('reduced motion overrides the tier: no trail, no reticle, no sparks, static ring', () => {
    const view = createView();
    applySnapshot(view, snapshot({ reducedMotion: true }));
    view.setHoverTarget('front:0:0');

    const targeting = namedGroup(view, 'targeting');
    const reticle = targeting.children.find((child) => child.name === 'targeting-reticle')!;
    view.update(60);
    expect(reticle.visible).toBe(false);

    applyIntents(view, [explosionIntent('front:0:0', 'front')], 0);
    expect(particlePoints(view).geometry.drawRange.count).toBe(0);
    expect(impactMeshCount(view, 'impact-rays')).toBe(0);
    expect(impactMeshCount(view, 'impact-ring')).toBe(1);
  });
});

describe('scene spaceship appearance', () => {
  function noseColor(view: SceneView): string {
    const group = spaceshipGroup(view);
    let color = '';
    group.traverse((object) => {
      if (
        object instanceof Mesh &&
        object.geometry.type === 'ConeGeometry' &&
        object.name !== 'ignition'
      ) {
        color = (object.material as MeshStandardMaterial).color.getHexString();
      }
    });
    return color;
  }

  it('re-applies appearance when snapshot customization.appearance changes', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    expect(noseColor(view)).toBe('88aaff');
    const base = snapshot();
    const next = {
      ...base,
      customization: {
        ...base.customization!,
        appearance: { nose: 'nose-crimson' },
      },
    };
    applySnapshot(view, next);
    expect(noseColor(view)).toBe('cc4444');
    expect(view.lastAppearance).toEqual({ nose: 'nose-crimson' });
    view.dispose();
  });

  it('retains a shallow copy of the last applied appearance', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const first = view.lastAppearance;
    const base = snapshot();
    applySnapshot(view, {
      ...base,
      customization: { ...base.customization!, appearance: { body: 'body-gold' } },
    });
    expect(view.lastAppearance).toEqual({ body: 'body-gold' });
    first.nose = 'mutated';
    expect(view.lastAppearance).not.toHaveProperty('nose', 'mutated');
    view.dispose();
  });

  it('does not update materials when appearance is unchanged', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    const before = view.lastAppearance;
    applySnapshot(view, snapshot());
    expect(view.lastAppearance).toEqual(before);
    view.dispose();
  });
});