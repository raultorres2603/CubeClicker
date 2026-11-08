import { LineBasicMaterial, LineSegments, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { CUBE_STYLES } from '../game/progression';
import type { MiniCubeId } from '../game/types';
import { createCubeView } from './cube-view';
import {
  createTargeting,
  RETICLE_TICK_COUNT,
  RETICLE_TICK_LENGTH,
  RETICLE_TICK_RADIUS,
  RETICLE_VERTEX_COUNT,
  TARGETING_OUTLINE_RENDER_ORDER,
  TARGETING_OUTLINE_SCALE,
} from './targeting';

const STYLE = CUBE_STYLES[0]!;

function createView() {
  return createCubeView(STYLE);
}

function linesNamed(group: ReturnType<typeof createTargeting>['group'], name: string): LineSegments {
  const line = group.children.find(
    (child): child is LineSegments => child instanceof LineSegments && child.name === name,
  );
  if (line === undefined) {
    throw new Error(`no ${name} line`);
  }
  return line;
}

describe('targeting outline (AC-35)', () => {
  it('builds one group with an outline and a six-tick reticle, hidden initially', () => {
    const targeting = createTargeting();

    expect(targeting.group.name).toBe('targeting');
    expect(targeting.group.children).toHaveLength(2);
    expect(targeting.group.children.map((child) => child.name)).toEqual([
      'targeting-outline',
      'targeting-reticle',
    ]);
    expect(targeting.group.visible).toBe(false);
    for (const child of targeting.group.children as LineSegments[]) {
      expect(child.material).toBeInstanceOf(LineBasicMaterial);
      expect((child.material as LineBasicMaterial).depthTest).toBe(false);
      expect(child.renderOrder).toBe(TARGETING_OUTLINE_RENDER_ORDER);
    }
    expect(TARGETING_OUTLINE_RENDER_ORDER).toBe(11);
  });

  it('places a 1.03-scale outline on the hovered tile', () => {
    const targeting = createTargeting();
    const cube = createView();

    targeting.setHoverTarget('front:0:0', cube);

    const outline = linesNamed(targeting.group, 'targeting-outline');
    expect(targeting.group.visible).toBe(true);
    expect(targeting.isVisible()).toBe(true);
    expect(outline.position.toArray()).toEqual([-2, 2, 2.625]);
    expect(outline.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    expect(outline.scale.x).toBeCloseTo(0.95 * TARGETING_OUTLINE_SCALE, 6);
    expect(outline.scale.y).toBeCloseTo(0.95 * TARGETING_OUTLINE_SCALE, 6);
    expect(outline.scale.z).toBeCloseTo(0.25 * TARGETING_OUTLINE_SCALE, 6);
    expect(TARGETING_OUTLINE_SCALE).toBe(1.03);
  });

  it('orients the outline with a rotated face', () => {
    const targeting = createTargeting();
    const cube = createView();

    targeting.setHoverTarget('top:1:1', cube);

    const outline = linesNamed(targeting.group, 'targeting-outline');
    const normal = new Vector3(0, 0, 1).applyQuaternion(outline.quaternion);
    expect(normal.x).toBeCloseTo(0, 6);
    expect(normal.y).toBeCloseTo(1, 6);
    expect(normal.z).toBeCloseTo(0, 6);
    expect(outline.position.toArray()).toEqual([-1, 2.625, -1]);
  });

  it('builds exactly 12 reticle vertices: six 60° ticks', () => {
    const targeting = createTargeting();
    const reticle = linesNamed(targeting.group, 'targeting-reticle');
    const positions = reticle.geometry.getAttribute('position');
    const array = positions.array as Float32Array;

    expect(RETICLE_TICK_COUNT).toBe(6);
    expect(RETICLE_VERTEX_COUNT).toBe(12);
    expect(positions.count).toBe(12);
    expect(array[0]).toBeCloseTo(RETICLE_TICK_RADIUS, 6);
    expect(array[1]).toBe(0);
    expect(array[2]).toBe(0);
    expect(array[3]).toBeCloseTo(RETICLE_TICK_RADIUS + RETICLE_TICK_LENGTH, 6);
    expect(array[4]).toBe(0);
    expect(array[5]).toBe(0);
    // Tick 1 is at 60° and starts exactly on the radius circle.
    const angle = Math.PI / 3;
    expect(array[6]).toBeCloseTo(Math.cos(angle) * RETICLE_TICK_RADIUS, 6);
    expect(array[7]).toBeCloseTo(Math.sin(angle) * RETICLE_TICK_RADIUS, 6);
  });

  it('hides on a miss and on an already-hidden tile', () => {
    const targeting = createTargeting();
    const cube = createView();

    targeting.setHoverTarget('front:0:0', cube);
    expect(targeting.group.visible).toBe(true);

    targeting.setHoverTarget(null, cube);
    expect(targeting.group.visible).toBe(false);

    cube.hideMiniCube('front:1:1');
    targeting.setHoverTarget('front:1:1', cube);
    expect(targeting.group.visible).toBe(false);
    expect(targeting.isVisible()).toBe(false);
  });

  it('rejects a malformed id', () => {
    const targeting = createTargeting();
    const cube = createView();

    expect(() => targeting.setHoverTarget('front' as MiniCubeId, cube)).toThrow(
      new Error('invalid mini-cube id "front"'),
    );
    expect(() => targeting.setHoverTarget('front:0:0:0' as MiniCubeId, cube)).toThrow(
      new Error('invalid mini-cube id "front:0:0:0"'),
    );
  });
});

describe('reticle fade and dwell (AC-35)', () => {
  it('fades in over 120 ms and holds while the target persists', () => {
    const targeting = createTargeting();
    const cube = createView();
    targeting.setHoverTarget('front:0:0', cube);

    expect(targeting.getReticleOpacity()).toBe(0);
    targeting.update(60, false);
    expect(targeting.getReticleOpacity()).toBe(0.5);
    targeting.update(60, false);
    expect(targeting.getReticleOpacity()).toBe(1);
    expect(linesNamed(targeting.group, 'targeting-reticle').visible).toBe(true);

    // The 250 ms dwell does not hide a persistent hover.
    targeting.update(250, false);
    expect(targeting.getReticleOpacity()).toBe(1);
    expect(targeting.group.visible).toBe(true);
  });

  it('starts the fade again for a new hovered tile', () => {
    const targeting = createTargeting();
    const cube = createView();
    targeting.setHoverTarget('front:0:0', cube);
    targeting.update(120, false);
    expect(targeting.getReticleOpacity()).toBe(1);

    targeting.setHoverTarget('front:0:1', cube);
    expect(targeting.getReticleOpacity()).toBe(0);
    targeting.update(60, false);
    expect(targeting.getReticleOpacity()).toBe(0.5);
  });

  it('reduced motion keeps a static outline and turns the ticks off', () => {
    const targeting = createTargeting();
    const cube = createView();
    targeting.setHoverTarget('front:0:0', cube);

    targeting.update(0, true);
    expect(targeting.getReticleOpacity()).toBe(1);
    expect(targeting.group.visible).toBe(true);
    expect(linesNamed(targeting.group, 'targeting-outline').visible).toBe(true);
    expect(linesNamed(targeting.group, 'targeting-reticle').visible).toBe(false);

    targeting.update(300, true);
    expect(targeting.getReticleOpacity()).toBe(1);
  });
});

describe('quality reticle flag (AC-52)', () => {
  it('disables and re-enables the six ticks without hiding the outline', () => {
    const targeting = createTargeting();
    const cube = createView();
    targeting.setHoverTarget('front:0:0', cube);

    targeting.setReticleEnabled(false);
    expect(linesNamed(targeting.group, 'targeting-reticle').visible).toBe(false);
    expect(linesNamed(targeting.group, 'targeting-outline').visible).toBe(true);

    targeting.setReticleEnabled(true);
    expect(linesNamed(targeting.group, 'targeting-reticle').visible).toBe(true);
  });
});

describe('dispose', () => {
  it('releases both geometries and materials exactly once and empties the group', () => {
    const targeting = createTargeting();
    const outline = linesNamed(targeting.group, 'targeting-outline');
    const reticle = linesNamed(targeting.group, 'targeting-reticle');
    const spies = [
      vi.spyOn(outline.geometry, 'dispose'),
      vi.spyOn(outline.material as LineBasicMaterial, 'dispose'),
      vi.spyOn(reticle.geometry, 'dispose'),
      vi.spyOn(reticle.material as LineBasicMaterial, 'dispose'),
    ];

    targeting.dispose();
    targeting.dispose();

    for (const spy of spies) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
    expect(targeting.group.children).toEqual([]);
    expect(targeting.group.visible).toBe(false);
    expect(targeting.isVisible()).toBe(false);
  });
});
