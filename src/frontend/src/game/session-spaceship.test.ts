import { Group, type PerspectiveCamera, type Scene } from 'three';
import { describe, expect, it } from 'vitest';

import { createGameSession, type CanvasLike, type SessionEnvironment } from './session';
import { spaceshipTargetPosition } from '../render/spaceship';

type Rect = { left: number; top: number; width: number; height: number };

interface FakeCanvas {
  surface: CanvasLike;
  listenerCount(type: string): number;
  emit(type: string, event: unknown): void;
}

function createFakeCanvas(rect: Rect): FakeCanvas {
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  const surface: CanvasLike = {
    addEventListener(type, handler) {
      const handlers = listeners.get(type) ?? [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    removeEventListener(type, handler) {
      const handlers = listeners.get(type) ?? [];
      const index = handlers.indexOf(handler);
      if (index !== -1) handlers.splice(index, 1);
      listeners.set(type, handlers);
    },
    getBoundingClientRect: () => ({ ...rect }),
    width: 0,
    height: 0,
  };
  const emit = (type: string, event: unknown): void => {
    for (const handler of [...(listeners.get(type) ?? [])]) handler(event);
  };
  return {
    surface,
    listenerCount: (type) => listeners.get(type)?.length ?? 0,
    emit,
  };
}

function attach(rect: Rect) {
  const canvas = createFakeCanvas(rect);
  const renders: Array<{ scene: Scene; camera: PerspectiveCamera }> = [];
  const schedulerPending = new Map<number, (n: number) => void>();
  let handle = 0;
  const env: SessionEnvironment = {
    canvas: canvas.surface,
    keyTarget: { addEventListener() {}, removeEventListener() {} },
    scheduler: {
      schedule(cb) { handle += 1; schedulerPending.set(handle, cb); return handle; },
      cancel(h) { schedulerPending.delete(h); },
    },
    motion: { matches: () => true, subscribe: () => () => {} },
    visibility: { isHidden: () => false, subscribe: () => () => {} },
    resize: { subscribe: () => () => {} },
    orientation: { subscribe: () => () => {} },
    rendererFactory: () => ({
      setSize() {},
      setPixelRatio() {},
      render(scene, camera) { renders.push({ scene, camera }); },
      dispose() {},
    }),
    now: () => 0,
    random: () => 0.5,
    devicePixelRatio: () => 1,
  };
  const session = createGameSession({ env });
  session.attach(canvas.surface);
  const due = [...schedulerPending.entries()];
  schedulerPending.clear();
  for (const [, cb] of due) cb(0);
  const tick = (nowMs: number) => {
    const due2 = [...schedulerPending.entries()];
    schedulerPending.clear();
    for (const [, cb] of due2) cb(nowMs);
  };
  return { canvas, renders, session, tick };
}

function spaceshipGroup(scene: Scene): Group {
  const group = scene.children.find((child: unknown) => child instanceof Group && child.name === 'spaceship');
  if (group === undefined) throw new Error('no spaceship group');
  return group as Group;
}

describe('session spaceship pointer tracking (AC-7)', () => {
  it('exposes setPointerTarget on GameSession', () => {
    const { session } = attach({ left: 0, top: 0, width: 800, height: 800 });
    expect(typeof session.setPointerTarget).toBe('function');
    session.setPointerTarget(0, 0);
  });

  it('pointermove converts client coords to clamped NDC and drives the spaceship', () => {
    const rect = { left: 10, top: 20, width: 800, height: 800 };
    const { canvas, renders, tick } = attach(rect);
    canvas.emit('pointermove', { clientX: 10 + 400, clientY: 20 + 400 });
    tick(16);
    const last = renders.at(-1)!;
    const group = spaceshipGroup(last.scene);
    const target = spaceshipTargetPosition(last.camera, 0, 0);
    expect(group.position.x).toBeCloseTo(target.x, 5);
    expect(group.position.y).toBeCloseTo(target.y, 5);
    expect(group.position.z).toBeCloseTo(target.z, 5);
  });

  it('clamps out-of-range pointer coords to [-1, 1]', () => {
    const rect = { left: 0, top: 0, width: 800, height: 800 };
    const { canvas, renders, tick } = attach(rect);
    canvas.emit('pointermove', { clientX: -1000, clientY: 2000 });
    tick(16);
    const last = renders.at(-1)!;
    const group = spaceshipGroup(last.scene);
    const target = spaceshipTargetPosition(last.camera, -1, -1);
    expect(group.position.x).toBeCloseTo(target.x, 5);
    expect(group.position.y).toBeCloseTo(target.y, 5);
    expect(group.position.z).toBeCloseTo(target.z, 5);
  });

  it('ignores pointermove when the rect has zero size', () => {
    const rect = { left: 0, top: 0, width: 0, height: 800 };
    const { canvas, renders, tick } = attach(rect);
    canvas.emit('pointermove', { clientX: 10, clientY: 10 });
    tick(16);
    const last = renders.at(-1)!;
    const group = spaceshipGroup(last.scene);
    expect(group.position.toArray()).toEqual([0, 0, 6]);
  });

  it('setPointerTarget is a no-op while detached', () => {
    const canvas = createFakeCanvas({ left: 0, top: 0, width: 800, height: 800 });
    const env: SessionEnvironment = {
      canvas: canvas.surface,
      keyTarget: { addEventListener() {}, removeEventListener() {} },
      scheduler: { schedule: () => 1, cancel: () => {} },
      motion: { matches: () => true, subscribe: () => () => {} },
      visibility: { isHidden: () => false, subscribe: () => () => {} },
      resize: { subscribe: () => () => {} },
      orientation: { subscribe: () => () => {} },
      rendererFactory: () => ({ setSize() {}, setPixelRatio() {}, render() {}, dispose() {} }),
      now: () => 0,
      random: () => 0.5,
      devicePixelRatio: () => 1,
    };
    const session = createGameSession({ env });
    expect(() => session.setPointerTarget(0, 0)).not.toThrow();
  });

  it('removes the pointermove listener on dispose', () => {
    const { canvas, session } = attach({ left: 0, top: 0, width: 800, height: 800 });
    expect(canvas.listenerCount('pointermove')).toBe(1);
    session.dispose();
    expect(canvas.listenerCount('pointermove')).toBe(0);
  });
});
