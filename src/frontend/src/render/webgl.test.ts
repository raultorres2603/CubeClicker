import type { PerspectiveCamera, Scene } from 'three';
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CanvasLike } from '../game/session';
import {
  TONE_MAPPING_EXPOSURE,
  createRafScheduler,
  createRealisticRenderer,
  createWebGLRenderer,
} from './webgl';

/**
 * Unit tier for the WebGL bootstrap. `three`'s `WebGLRenderer` is mocked (a real one needs
 * a GL context this tier must not create): the mock records its constructor options and
 * every forwarded call, so the adapter and the renderer constructor arguments are pinned
 * exactly. `createRafScheduler` is tested against stubbed `requestAnimationFrame` /
 * `cancelAnimationFrame` globals.
 */

interface FakeThreeRenderer {
  options: unknown;
  toneMapping: number;
  toneMappingExposure: number;
  outputColorSpace: string;
  shadowMap: { enabled: boolean; type: number };
  info: {
    autoReset: boolean;
    render: { calls: number; triangles: number };
    reset: ReturnType<typeof vi.fn>;
  };
  setSize: ReturnType<typeof vi.fn>;
  setPixelRatio: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

const threeMock = vi.hoisted(() => ({ instances: [] as FakeThreeRenderer[] }));

vi.mock('three', () => ({
  ACESFilmicToneMapping: 4,
  SRGBColorSpace: 'srgb',
  PCFSoftShadowMap: 2,
  WebGLRenderer: class {
    options: unknown;
    toneMapping = 0;
    toneMappingExposure = 0;
    outputColorSpace = '';
    shadowMap = { enabled: false, type: 0 };
    info = { autoReset: true, render: { calls: 0, triangles: 0 }, reset: vi.fn() };
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

interface FakeComposer {
  render: ReturnType<typeof vi.fn>;
  setSize: ReturnType<typeof vi.fn>;
  setPixelRatio: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

const composers = vi.hoisted(() => [] as FakeComposer[]);
const postprocessingMock = vi.hoisted(() => ({
  createPostprocessing: vi.fn(),
}));

vi.mock('./postprocessing', () => ({
  createPostprocessing: postprocessingMock.createPostprocessing,
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
  composers.length = 0;
  vi.unstubAllGlobals();
  postprocessingMock.createPostprocessing.mockReset();
  postprocessingMock.createPostprocessing.mockImplementation(() => {
    const composer: FakeComposer = {
      render: vi.fn(),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      dispose: vi.fn(),
    };
    composers.push(composer);
    return composer;
  });
});

describe('TONE_MAPPING_EXPOSURE', () => {
  it('equals 1.0', () => {
    expect(TONE_MAPPING_EXPOSURE).toBe(1.0);
  });
});

describe('createWebGLRenderer', () => {
  it('constructs three with the host canvas and antialiasing (AC-1)', () => {
    const adapter = createWebGLRenderer(canvas);

    expect(threeMock.instances).toHaveLength(1);
    expect(threeMock.instances[0]!.options).toEqual({ canvas, antialias: true });
    expect(Object.keys(adapter)).toEqual([
      'setSize',
      'setPixelRatio',
      'setQuality',
      'render',
      'stats',
      'dispose',
    ]);
  });

  it('configures tone mapping, color space, shadow type and enabled (AC-1)', () => {
    createWebGLRenderer(canvas);

    const renderer = threeMock.instances[0]!;
    expect(renderer.toneMapping).toBe(ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBe(TONE_MAPPING_EXPOSURE);
    expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
    expect(renderer.shadowMap.type).toBe(PCFSoftShadowMap);
    expect(renderer.shadowMap.enabled).toBe(true);
  });

  it('disables info.autoReset and resets info once per adapter render (AC-21)', () => {
    const adapter = createWebGLRenderer(canvas);
    const renderer = threeMock.instances[0]!;
    const scene = { isScene: true } as unknown as Scene;
    const camera = { isCamera: true } as unknown as PerspectiveCamera;

    expect(renderer.info.autoReset).toBe(false);
    expect(renderer.info.reset).not.toHaveBeenCalled();

    adapter.render(scene, camera);
    expect(renderer.info.reset).toHaveBeenCalledTimes(1);

    adapter.render(scene, camera);
    expect(renderer.info.reset).toHaveBeenCalledTimes(2);
  });

  it('exposes renderer.info render stats as { calls, triangles } (AC-21)', () => {
    const adapter = createWebGLRenderer(canvas);
    const renderer = threeMock.instances[0]!;

    renderer.info.render.calls = 7;
    renderer.info.render.triangles = 700;

    expect(adapter.stats?.()).toEqual({ calls: 7, triangles: 700 });

    renderer.info.render.calls = 9;
    renderer.info.render.triangles = 900;
    expect(adapter.stats?.()).toEqual({ calls: 9, triangles: 900 });
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

  it('exposes a no-op setQuality that keeps the plain renderer shadow pass enabled', () => {
    const adapter = createWebGLRenderer(canvas);
    const renderer = threeMock.instances[0]!;

    adapter.setQuality('medium');
    adapter.setQuality('low');

    expect(renderer.shadowMap.enabled).toBe(true);
    expect(postprocessingMock.createPostprocessing).not.toHaveBeenCalled();
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

describe('createRealisticRenderer', () => {
  it('builds the base renderer immediately and no composer until first render', () => {
    const adapter = createRealisticRenderer(canvas);

    expect(threeMock.instances).toHaveLength(1);
    expect(postprocessingMock.createPostprocessing).not.toHaveBeenCalled();
    expect(Object.keys(adapter)).toEqual([
      'setSize',
      'setPixelRatio',
      'setQuality',
      'render',
      'stats',
      'dispose',
    ]);
  });

  it('configures the base renderer (AC-1)', () => {
    createRealisticRenderer(canvas);

    const renderer = threeMock.instances[0]!;
    expect(renderer.toneMapping).toBe(ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBe(TONE_MAPPING_EXPOSURE);
    expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
    expect(renderer.shadowMap.type).toBe(PCFSoftShadowMap);
    expect(renderer.shadowMap.enabled).toBe(true);
  });

  it('resets info once per composed frame and exposes the accumulated stats (AC-21)', () => {
    const adapter = createRealisticRenderer(canvas);
    const renderer = threeMock.instances[0]!;
    const scene = { isScene: true } as unknown as Scene;
    const camera = { isCamera: true } as unknown as PerspectiveCamera;

    expect(renderer.info.autoReset).toBe(false);
    expect(renderer.info.reset).not.toHaveBeenCalled();

    renderer.info.render.calls = 12;
    renderer.info.render.triangles = 1200;
    expect(adapter.stats?.()).toEqual({ calls: 12, triangles: 1200 });

    adapter.render(scene, camera);
    adapter.render(scene, camera);

    expect(renderer.info.reset).toHaveBeenCalledTimes(2);
    expect(composers[0]!.render).toHaveBeenCalledTimes(2);
  });

  it('constructs the composer lazily on first render using that call scene/camera', () => {
    const adapter = createRealisticRenderer(canvas);
    const renderer = threeMock.instances[0]!;
    const scene = { isScene: true } as unknown as Scene;
    const camera = { isCamera: true } as unknown as PerspectiveCamera;

    adapter.render(scene, camera);

    expect(postprocessingMock.createPostprocessing).toHaveBeenCalledTimes(1);
    expect(postprocessingMock.createPostprocessing).toHaveBeenCalledWith(
      renderer,
      scene,
      camera,
      'high',
    );
    expect(composers[0]!.render).toHaveBeenCalledTimes(1);
  });

  it('delegates subsequent renders to the composer without rebuilding', () => {
    const adapter = createRealisticRenderer(canvas);
    const scene = { isScene: true } as unknown as Scene;
    const camera = { isCamera: true } as unknown as PerspectiveCamera;
    const scene2 = { isScene: 2 } as unknown as Scene;
    const camera2 = { isCamera: 2 } as unknown as PerspectiveCamera;

    adapter.render(scene, camera);
    adapter.render(scene2, camera2);

    expect(postprocessingMock.createPostprocessing).toHaveBeenCalledTimes(1);
    expect(composers[0]!.render).toHaveBeenCalledTimes(2);
  });

  it('applies setSize/setPixelRatio to base renderer immediately and buffers before composer', () => {
    const adapter = createRealisticRenderer(canvas);
    const renderer = threeMock.instances[0]!;

    adapter.setPixelRatio(2);
    adapter.setSize(1600, 800);

    expect(renderer.setPixelRatio).toHaveBeenCalledTimes(1);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
    expect(renderer.setSize).toHaveBeenCalledTimes(1);
    expect(renderer.setSize).toHaveBeenCalledWith(1600, 800);
    expect(postprocessingMock.createPostprocessing).not.toHaveBeenCalled();
  });

  it('replays buffered setSize/setPixelRatio onto the composer at construction (last value wins)', () => {
    const adapter = createRealisticRenderer(canvas);

    adapter.setSize(100, 50);
    adapter.setSize(200, 100);
    adapter.setPixelRatio(1.5);
    adapter.setPixelRatio(2);

    const scene = { isScene: true } as unknown as Scene;
    const camera = { isCamera: true } as unknown as PerspectiveCamera;
    adapter.render(scene, camera);

    const composer = composers[0]!;
    expect(composer.setSize).toHaveBeenCalledTimes(1);
    expect(composer.setSize).toHaveBeenCalledWith(200, 100);
    expect(composer.setPixelRatio).toHaveBeenCalledTimes(1);
    expect(composer.setPixelRatio).toHaveBeenCalledWith(2);
  });

  it('propagates setSize/setPixelRatio to both renderer and composer once constructed', () => {
    const adapter = createRealisticRenderer(canvas);
    const renderer = threeMock.instances[0]!;
    const scene = { isScene: true } as unknown as Scene;
    const camera = { isCamera: true } as unknown as PerspectiveCamera;

    adapter.render(scene, camera);
    const composer = composers[0]!;

    renderer.setSize.mockClear();
    renderer.setPixelRatio.mockClear();
    composer.setSize.mockClear();
    composer.setPixelRatio.mockClear();

    adapter.setSize(320, 240);
    adapter.setPixelRatio(3);

    expect(renderer.setSize).toHaveBeenCalledTimes(1);
    expect(renderer.setSize).toHaveBeenCalledWith(320, 240);
    expect(composer.setSize).toHaveBeenCalledTimes(1);
    expect(composer.setSize).toHaveBeenCalledWith(320, 240);
    expect(renderer.setPixelRatio).toHaveBeenCalledTimes(1);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(3);
    expect(composer.setPixelRatio).toHaveBeenCalledTimes(1);
    expect(composer.setPixelRatio).toHaveBeenCalledWith(3);
  });

  it('is idempotent for the current tier (AC-9)', () => {
    const adapter = createRealisticRenderer(canvas);
    const renderer = threeMock.instances[0]!;
    const scene = { isScene: true } as unknown as Scene;
    const camera = { isCamera: true } as unknown as PerspectiveCamera;

    adapter.setQuality('high');
    adapter.render(scene, camera);
    const composer = composers[0]!;

    adapter.setQuality('high');

    expect(composer.dispose).not.toHaveBeenCalled();
    expect(postprocessingMock.createPostprocessing).toHaveBeenCalledTimes(1);
    adapter.render(scene, camera);
    expect(postprocessingMock.createPostprocessing).toHaveBeenCalledTimes(1);
    expect(composer.render).toHaveBeenCalledTimes(2);
    expect(renderer.shadowMap.enabled).toBe(true);
  });

  it('toggles shadows, disposes the old composer exactly once and replays the last size/ratio on rebuild (AC-9)', () => {
    const adapter = createRealisticRenderer(canvas);
    const renderer = threeMock.instances[0]!;
    const scene = { isScene: true } as unknown as Scene;
    const camera = { isCamera: true } as unknown as PerspectiveCamera;

    adapter.setPixelRatio(2);
    adapter.setSize(1600, 800);
    adapter.render(scene, camera);
    const highComposer = composers[0]!;
    expect(postprocessingMock.createPostprocessing).toHaveBeenLastCalledWith(
      renderer,
      scene,
      camera,
      'high',
    );

    adapter.setQuality('medium');

    expect(renderer.shadowMap.enabled).toBe(true);
    expect(highComposer.dispose).toHaveBeenCalledTimes(1);
    expect(composers).toHaveLength(1);
    expect(postprocessingMock.createPostprocessing).toHaveBeenCalledTimes(1);

    adapter.setSize(1000, 500);
    adapter.setSize(1200, 600);
    adapter.setPixelRatio(1.5);
    adapter.render(scene, camera);

    const mediumComposer = composers[1]!;
    expect(postprocessingMock.createPostprocessing).toHaveBeenCalledTimes(2);
    expect(postprocessingMock.createPostprocessing).toHaveBeenLastCalledWith(
      renderer,
      scene,
      camera,
      'medium',
    );
    expect(mediumComposer.setSize).toHaveBeenCalledTimes(1);
    expect(mediumComposer.setSize).toHaveBeenCalledWith(1200, 600);
    expect(mediumComposer.setPixelRatio).toHaveBeenCalledTimes(1);
    expect(mediumComposer.setPixelRatio).toHaveBeenCalledWith(1.5);
    expect(mediumComposer.render).toHaveBeenCalledTimes(1);

    adapter.setQuality('low');

    expect(renderer.shadowMap.enabled).toBe(false);
    expect(mediumComposer.dispose).toHaveBeenCalledTimes(1);

    adapter.setSize(800, 400);
    adapter.setPixelRatio(1);
    adapter.render(scene, camera);

    expect(postprocessingMock.createPostprocessing).toHaveBeenCalledTimes(2);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenCalledWith(scene, camera);
    expect(highComposer.dispose).toHaveBeenCalledTimes(1);
    expect(mediumComposer.dispose).toHaveBeenCalledTimes(1);
  });

  it('never constructs a composer at low and renders the base scene exactly once per call (AC-8)', () => {
    const adapter = createRealisticRenderer(canvas);
    const renderer = threeMock.instances[0]!;
    const scene = { isScene: true } as unknown as Scene;
    const camera = { isCamera: true } as unknown as PerspectiveCamera;

    adapter.setQuality('low');
    expect(renderer.shadowMap.enabled).toBe(false);

    adapter.render(scene, camera);

    expect(postprocessingMock.createPostprocessing).not.toHaveBeenCalled();
    expect(composers).toHaveLength(0);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenCalledWith(scene, camera);

    adapter.render(scene, camera);

    expect(renderer.render).toHaveBeenCalledTimes(2);
    expect(postprocessingMock.createPostprocessing).not.toHaveBeenCalled();
  });

  it('matches the session contract: setQuality(medium) → setPixelRatio → setSize → render → setQuality(low) → render → setQuality(low) → setQuality(high) → render (AC-10)', () => {
    const adapter = createRealisticRenderer(canvas);
    const renderer = threeMock.instances[0]!;
    const scene = { isScene: true } as unknown as Scene;
    const camera = { isCamera: true } as unknown as PerspectiveCamera;

    adapter.setQuality('medium');
    adapter.setPixelRatio(1.5);
    adapter.setSize(1200, 800);
    adapter.render(scene, camera);

    expect(postprocessingMock.createPostprocessing).toHaveBeenNthCalledWith(
      1,
      renderer,
      scene,
      camera,
      'medium',
    );
    expect(composers[0]!.setPixelRatio).toHaveBeenCalledWith(1.5);
    expect(composers[0]!.setSize).toHaveBeenCalledWith(1200, 800);
    expect(composers[0]!.render).toHaveBeenCalledTimes(1);

    adapter.setQuality('low');
    adapter.render(scene, camera);

    expect(composers[0]!.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(renderer.render).toHaveBeenCalledWith(scene, camera);
    expect(postprocessingMock.createPostprocessing).toHaveBeenCalledTimes(1);

    adapter.setQuality('low');
    expect(composers[0]!.dispose).toHaveBeenCalledTimes(1);
    expect(postprocessingMock.createPostprocessing).toHaveBeenCalledTimes(1);

    adapter.setQuality('high');
    adapter.render(scene, camera);

    expect(postprocessingMock.createPostprocessing).toHaveBeenCalledTimes(2);
    expect(postprocessingMock.createPostprocessing).toHaveBeenNthCalledWith(
      2,
      renderer,
      scene,
      camera,
      'high',
    );
    expect(composers[1]!.setPixelRatio).toHaveBeenCalledWith(1.5);
    expect(composers[1]!.setSize).toHaveBeenCalledWith(1200, 800);
    expect(composers[1]!.render).toHaveBeenCalledTimes(1);
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it('releases the composer and base renderer on dispose when constructed', () => {
    const adapter = createRealisticRenderer(canvas);
    const renderer = threeMock.instances[0]!;
    const scene = { isScene: true } as unknown as Scene;
    const camera = { isCamera: true } as unknown as PerspectiveCamera;

    adapter.render(scene, camera);
    const composer = composers[0]!;

    adapter.dispose();

    expect(composer.dispose).toHaveBeenCalledTimes(1);
    expect(renderer.dispose).toHaveBeenCalledTimes(1);
  });

  it('releases only the base renderer on dispose when composer not constructed', () => {
    const adapter = createRealisticRenderer(canvas);
    const renderer = threeMock.instances[0]!;

    adapter.dispose();

    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(postprocessingMock.createPostprocessing).not.toHaveBeenCalled();
  });

  it('does not construct or render a composer when render is called after dispose', () => {
    const adapter = createRealisticRenderer(canvas);
    const renderer = threeMock.instances[0]!;

    adapter.dispose();
    const scene = { isScene: true } as unknown as Scene;
    const camera = { isCamera: true } as unknown as PerspectiveCamera;
    adapter.render(scene, camera);

    expect(postprocessingMock.createPostprocessing).not.toHaveBeenCalled();
    expect(renderer.render).not.toHaveBeenCalled();
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