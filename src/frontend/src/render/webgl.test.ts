import type { PerspectiveCamera, Scene } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CanvasLike } from '../game/session';
import { createRafScheduler, createWebGLRenderer } from './webgl';

/**
 * Unit tier for the WebGL bootstrap. `three`'s `WebGLRenderer` is mocked (a real one needs
 * a GL context this tier must not create): the mock records its constructor options and
 * every forwarded call, so the adapter and the renderer constructor arguments are pinned
 * exactly. `createRafScheduler` is tested against stubbed `requestAnimationFrame` /
 * `cancelAnimationFrame` globals.
 */

interface FakeThreeRenderer {
  options: unknown;
  setSize: ReturnType<typeof vi.fn>;
  setPixelRatio: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

const threeMock = vi.hoisted(() => ({ instances: [] as FakeThreeRenderer[] }));

vi.mock('three', () => ({
  WebGLRenderer: class {
    options: unknown;
    setSize = vi.fn();
    setPixelRatio = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    constructor(options: unknown) {
      this.options = options;
      threeMock.instances.push(this as unknown as FakeThreeRenderer);
    }
  },
}));

const canvas: CanvasLike = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }),
  width: 0,
  height: 0,
};

beforeEach(() => {
  threeMock.instances.length = 0;
  vi.unstubAllGlobals();
});

describe('createWebGLRenderer', () => {
  it('constructs three with the host canvas and antialiasing (AC-13)', () => {
    const adapter = createWebGLRenderer(canvas);

    expect(threeMock.instances).toHaveLength(1);
    expect(threeMock.instances[0]!.options).toEqual({ canvas, antialias: true });
    expect(Object.keys(adapter)).toEqual(['setSize', 'setPixelRatio', 'render', 'dispose']);
  });

  it('forwards each adapter call to the renderer with the exact arguments', () => {
    const adapter = createWebGLRenderer(canvas);
    const renderer = threeMock.instances[0]!;
    const scene = { isScene: true } as unknown as Scene;
    const camera = { isCamera: true } as unknown as PerspectiveCamera;

    adapter.setPixelRatio(2);
    adapter.setSize(1600, 800);
    adapter.render(scene, camera);
    adapter.dispose();

    expect(renderer.setPixelRatio).toHaveBeenCalledTimes(1);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
    expect(renderer.setSize).toHaveBeenCalledTimes(1);
    expect(renderer.setSize).toHaveBeenCalledWith(1600, 800);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenCalledWith(scene, camera);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledWith();
  });

  it('builds one renderer per call (no shared singleton)', () => {
    const first = createWebGLRenderer(canvas);
    const second = createWebGLRenderer(canvas);

    expect(threeMock.instances).toHaveLength(2);
    expect(threeMock.instances[0]).not.toBe(threeMock.instances[1]);

    first.setSize(1, 2);
    expect(threeMock.instances[0]!.setSize).toHaveBeenCalledWith(1, 2);
    expect(threeMock.instances[1]!.setSize).not.toHaveBeenCalled();
    second.setSize(3, 4);
    expect(threeMock.instances[1]!.setSize).toHaveBeenCalledWith(3, 4);
  });
});

describe('createRafScheduler', () => {
  it('schedules through requestAnimationFrame and cancels through cancelAnimationFrame', () => {
    const requestFrame = vi.fn(() => 42);
    const cancelFrame = vi.fn();
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', cancelFrame);

    const scheduler = createRafScheduler();
    const onFrame = vi.fn();

    expect(scheduler.schedule(onFrame)).toBe(42);
    expect(requestFrame).toHaveBeenCalledTimes(1);
    expect(requestFrame).toHaveBeenCalledWith(onFrame);

    scheduler.cancel(42);
    expect(cancelFrame).toHaveBeenCalledTimes(1);
    expect(cancelFrame).toHaveBeenCalledWith(42);
  });

  it('returns the handle requestAnimationFrame assigned, per call', () => {
    const handles = [7, 9];
    const requestFrame = vi.fn(() => handles.shift()!);
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const scheduler = createRafScheduler();

    expect(scheduler.schedule(() => {})).toBe(7);
    expect(scheduler.schedule(() => {})).toBe(9);
    expect(requestFrame).toHaveBeenCalledTimes(2);
  });
});
