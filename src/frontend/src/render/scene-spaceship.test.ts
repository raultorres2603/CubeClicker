import { Group, Mesh, MeshStandardMaterial, Points, Vector3 } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createEngine, type EffectIntent, type EngineSnapshot } from '../game/engine';
import { MOTION } from '../game/motion';
import { CUBE_STYLES } from '../game/progression';
import { type FaceId, type MiniCubeId } from '../game/types';
import { createSceneView, type SceneView } from './scene';
import { spaceshipFollowFactor, spaceshipTargetPosition } from './spaceship';

/**
 * The level-complete fly-by seam (AC-40): `createSpaceship` is wrapped so every scene's
 * handle records its `startFlyBy` calls. The real factory and methods still run, so the
 * tests below read the live three.js ship while proving how many rolls production starts.
 */
const flyBySeam = vi.hoisted(() => ({
  starts: [] as Array<ReturnType<typeof vi.fn>>,
  ships: [] as Array<{ isFlyingBy: () => boolean }>,
}));

vi.mock('./spaceship', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./spaceship')>();
  return {
    ...actual,
    createSpaceship: (appearance?: Record<string, string>) => {
      const ship = actual.createSpaceship(appearance);
      const startFlyBy = vi.fn(ship.startFlyBy);
      ship.startFlyBy = startFlyBy;
      flyBySeam.starts.push(startFlyBy);
      flyBySeam.ships.push(ship);
      return ship;
    },
  };
});

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

/** The fly-by fire trail `Points` (capacity 16) inside the spaceship group. */
function spaceshipTrail(view: SceneView): Points {
  const trail = spaceshipGroup(view).children.find(
    (child): child is Points => child instanceof Points && child.name === 'spaceship-trail',
  );
  if (trail === undefined) {
    throw new Error('no spaceship trail');
  }
  return trail;
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

describe('scene impact and targeting integration (AC-35, AC-37)', () => {
  it('nests impact and targeting under the particle group, keeping 9 scene children', () => {
    const view = createView();

    expect(view.scene.children).toHaveLength(9);
    const particles = view.scene.children.find(
      (child): child is Group =>
        child instanceof Group && child.children.some((candidate) => candidate instanceof Points),
    )!;
    expect(particles.children.map((child) => child.name)).toContain('impact-effects');
    expect(particles.children.map((child) => child.name)).toContain('targeting');
    const impact = namedGroup(view, 'impact-effects');
    expect(impact.children).toHaveLength(1);
    expect(impact.children.map((child) => child.name)).toEqual(['impact-shards']);
    expect(namedGroup(view, 'targeting').children).toHaveLength(2);

    const names: string[] = [];
    view.scene.traverse((object) => names.push(object.name));
    expect(names).not.toContain('impact-rays');
    expect(names).not.toContain('impact-coins');
    expect(names).not.toContain('impact-ring');
  });

  it('spawns 14 shards and 24 sparks at the high-tier deferred explosion', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    expect(impactMeshCount(view, 'impact-shards')).toBe(0);

    applyIntents(view, [explosionIntent('front:0:0', 'front', 24)], 0);
    expect(impactMeshCount(view, 'impact-shards')).toBe(0);

    view.update(180);
    expect(impactMeshCount(view, 'impact-shards')).toBe(14);
    expect(particlePoints(view).geometry.drawRange.count).toBe(24);
  });

  it('reduced motion spawns no shards and no sparks', () => {
    const view = createView();
    applySnapshot(view, snapshot({ reducedMotion: true }));
    applyIntents(view, [explosionIntent('front:0:0', 'front', 24)], 0);

    expect(impactMeshCount(view, 'impact-shards')).toBe(0);
    expect(particlePoints(view).geometry.drawRange.count).toBe(0);
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

  it('keeps the camera and HUD transforms identical across a pop (AC-44)', () => {
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
    expect(impactMeshCount(view, 'impact-shards')).toBe(7);
    expect(particlePoints(view).geometry.drawRange.count).toBe(12);
  });

  it('forces low: six detail meshes hidden, no sparks, no shards', () => {
    const view = createView();
    applySnapshot(view, snapshot());
    view.setQualityTierForTesting('low');

    expect(view.getQualityTier()).toBe('low');
    expect(modelMesh(view, 'cursor-wing-left-tip').visible).toBe(false);
    expect(modelMesh(view, 'cursor-wing-right-tip').visible).toBe(false);

    applyIntents(view, [explosionIntent('front:0:0', 'front', 24)], 0);
    view.update(180);
    expect(particlePoints(view).geometry.drawRange.count).toBe(0);
    expect(impactMeshCount(view, 'impact-shards')).toBe(0);
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

  it('reduced motion overrides the tier: no trail, no reticle, no sparks, no shards', () => {
    const view = createView();
    applySnapshot(view, snapshot({ reducedMotion: true }));
    view.setHoverTarget('front:0:0');

    const targeting = namedGroup(view, 'targeting');
    const reticle = targeting.children.find((child) => child.name === 'targeting-reticle')!;
    view.update(60);
    expect(reticle.visible).toBe(false);

    applyIntents(view, [explosionIntent('front:0:0', 'front')], 0);
    expect(particlePoints(view).geometry.drawRange.count).toBe(0);
    expect(impactMeshCount(view, 'impact-shards')).toBe(0);
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

describe('scene level-complete fly-by (AC-40)', () => {
  beforeEach(() => {
    flyBySeam.starts.length = 0;
    flyBySeam.ships.length = 0;
  });

  it('starts exactly one 700 ms roll on the production levelIndex rise and returns to pointer-follow', () => {
    const view = createView();
    applySnapshot(view, snapshot({ levelIndex: 0 }));
    view.setPointerTarget(0, 0);
    expect(flyBySeam.starts).toHaveLength(1);
    const startFlyBy = flyBySeam.starts[0]!;
    expect(startFlyBy).toHaveBeenCalledTimes(0);

    // The same transition that mounts LevelCompleteBanner: one level increase.
    applySnapshot(view, snapshot({ levelIndex: 1, style: CUBE_STYLES[1]! }));
    expect(startFlyBy).toHaveBeenCalledTimes(1);

    const group = spaceshipGroup(view);
    // 350 ms: the half-turn point of the 1.2-world-unit orbit (x = -2.4) at roll angle π.
    for (let step = 0; step < 20; step += 1) {
      view.update(17.5);
    }
    expect(group.position.x).toBeCloseTo(-2.4, 6);
    expect(group.position.y).toBeCloseTo(0, 12);
    expect(group.position.z).toBeCloseTo(6, 12);
    expect(group.rotation.z).toBeCloseTo(Math.PI, 12);
    expect(spaceshipTrail(view).geometry.drawRange.count).toBe(MOTION.fireTrailCount);

    // Re-applying the same level mid-roll starts nothing more.
    applySnapshot(view, snapshot({ levelIndex: 1, style: CUBE_STYLES[1]! }));
    expect(startFlyBy).toHaveBeenCalledTimes(1);

    // The remaining 350 ms complete the full turn at the orbit start.
    for (let step = 0; step < 20; step += 1) {
      view.update(17.5);
    }
    expect(group.position.x).toBeCloseTo(0, 6);
    expect(group.position.y).toBeCloseTo(0, 12);
    expect(group.position.z).toBeCloseTo(6, 12);
    expect(group.rotation.z).toBe(0);

    // The next frame is pointer-follow again, starting from the fly-by end pose.
    view.update(16);
    const target = spaceshipTargetPosition(view.camera, 0, 0);
    const expected = new Vector3(0, 0, 6).lerp(target, spaceshipFollowFactor(16, false));
    expect(group.position.x).toBeCloseTo(expected.x, 6);
    expect(group.position.y).toBeCloseTo(expected.y, 6);
    expect(group.position.z).toBeCloseTo(expected.z, 6);
    expect(group.rotation.z).toBe(0);
    view.dispose();
  });

  it('does not start under reduced motion and cancels a running roll on a live switch', () => {
    const reduced = createView();
    applySnapshot(reduced, snapshot({ levelIndex: 0, reducedMotion: true }));
    reduced.setPointerTarget(0, 0);
    applySnapshot(reduced, snapshot({ levelIndex: 1, reducedMotion: true }));
    expect(flyBySeam.starts).toHaveLength(1);
    expect(flyBySeam.starts[0]!).toHaveBeenCalledTimes(0);
    reduced.dispose();

    const view = createView();
    applySnapshot(view, snapshot({ levelIndex: 0 }));
    view.setPointerTarget(0, 0);
    applySnapshot(view, snapshot({ levelIndex: 1 }));
    expect(flyBySeam.starts).toHaveLength(2);
    const startFlyBy = flyBySeam.starts[1]!;
    expect(startFlyBy).toHaveBeenCalledTimes(1);

    view.update(350);
    const group = spaceshipGroup(view);
    expect(group.rotation.z).toBeCloseTo(Math.PI, 12);
    expect(spaceshipTrail(view).geometry.drawRange.count).toBe(1);

    // A live reduced-motion switch cancels the roll and its trail (AC-40/AC-48).
    applySnapshot(view, snapshot({ levelIndex: 1, reducedMotion: true }));
    view.update(16);
    expect(flyBySeam.ships[1]!.isFlyingBy()).toBe(false);
    expect(group.rotation.z).toBe(0);
    expect(spaceshipTrail(view).geometry.drawRange.count).toBe(0);
    view.dispose();
  });

  it('ignores a direct trigger while a roll is already running', () => {
    const view = createView();
    applySnapshot(view, snapshot({ levelIndex: 0 }));

    view.triggerFlyBy();
    expect(flyBySeam.starts).toHaveLength(1);
    const startFlyBy = flyBySeam.starts[0]!;
    expect(startFlyBy).toHaveBeenCalledTimes(1);

    view.triggerFlyBy();
    expect(startFlyBy).toHaveBeenCalledTimes(1);
    view.dispose();
  });
});
