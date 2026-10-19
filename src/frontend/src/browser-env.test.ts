import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CanvasLike, FrameScheduler } from './game/session';
import { browserEnvironment } from './browser-env';

/**
 * Unit tier for the browser boundary: every host global the module touches is stubbed
 * (`vi.stubGlobal`), so the test pins exactly which global is read, with which query /
 * event name, and that the returned sources forward live values and remove the listeners
 * they registered. The two WebGL bootstrap functions are mocked: they are covered by
 * `render/webgl.test.ts`, and the real renderer would need a GL context this tier must not
 * create.
 */

const webgl = vi.hoisted(() => ({
  createWebGLRenderer: vi.fn(),
  createRafScheduler: vi.fn(),
}));

vi.mock('./render/webgl', () => ({
  createWebGLRenderer: webgl.createWebGLRenderer,
  createRafScheduler: webgl.createRafScheduler,
}));

type MediaQueryListener = (event: MediaQueryListEvent) => void;
type DocumentListener = (event: Event) => void;

interface FakeMediaQuery {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  emit(event: { matches: boolean }): void;
}

/** The stubbed `window`: a key target plus the two values `browserEnvironment` reads. */
function createFakeWindow(devicePixelRatio: number): {
  window: {
    devicePixelRatio: number;
    matchMedia: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
  query: FakeMediaQuery;
} {
  const mediaListeners = new Set<MediaQueryListener>();
  const query: FakeMediaQuery = {
    matches: false,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: vi.fn((type: string, listener: MediaQueryListener) => {
      if (type === 'change') {
        mediaListeners.add(listener);
      }
    }),
    removeEventListener: vi.fn((type: string, listener: MediaQueryListener) => {
      if (type === 'change') {
        mediaListeners.delete(listener);
      }
    }),
    emit(event: { matches: boolean }): void {
      for (const listener of [...mediaListeners]) {
        listener(event as unknown as MediaQueryListEvent);
      }
    },
  };
  return {
    window: {
      devicePixelRatio,
      matchMedia: vi.fn(() => query),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    query,
  };
}

/** The stubbed `document`: its visibility state plus the change-listener registry. */
function createFakeDocument(visibilityState: DocumentVisibilityState): {
  document: {
    visibilityState: DocumentVisibilityState;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
  emitVisibility(): void;
} {
  const listeners = new Set<DocumentListener>();
  const document = {
    visibilityState,
    addEventListener: vi.fn((type: string, listener: DocumentListener) => {
      if (type === 'visibilitychange') {
        listeners.add(listener);
      }
    }),
    removeEventListener: vi.fn((type: string, listener: DocumentListener) => {
      if (type === 'visibilitychange') {
        listeners.delete(listener);
      }
    }),
  };
  return {
    document,
    emitVisibility(): void {
      for (const listener of [...listeners]) {
        listener({ type: 'visibilitychange' } as unknown as Event);
      }
    },
  };
}

interface FakeResizeObserverInstance {
  callback: () => void;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

/** One stubbed `ResizeObserver` class, recording its instances. */
function createFakeResizeObserver(): {
  resizeObserver: new (callback: () => void) => FakeResizeObserverInstance;
  instances: FakeResizeObserverInstance[];
} {
  const instances: FakeResizeObserverInstance[] = [];
  class FakeResizeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    constructor(public callback: () => void) {
      instances.push(this);
    }
  }
  return { resizeObserver: FakeResizeObserver, instances };
}

const canvas: CanvasLike = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 480 }),
  width: 0,
  height: 0,
};

beforeEach(() => {
  webgl.createWebGLRenderer.mockReset();
  webgl.createRafScheduler.mockReset();
  const scheduler: FrameScheduler = {
    schedule: () => 1,
    cancel: () => {},
  };
  webgl.createRafScheduler.mockReturnValue(scheduler);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

interface StubbedHost {
  fakeWindow: ReturnType<typeof createFakeWindow>;
  query: FakeMediaQuery;
  fakeDocument: ReturnType<typeof createFakeDocument>;
  observers: FakeResizeObserverInstance[];
}

function stubHost(options: {
  dpr?: number;
  visibilityState?: DocumentVisibilityState;
  now?: number;
  random?: number;
}): StubbedHost {
  const fakeWindow = createFakeWindow(options.dpr ?? 2);
  const fakeDocument = createFakeDocument(options.visibilityState ?? 'visible');
  const observers = createFakeResizeObserver();
  vi.stubGlobal('window', fakeWindow.window);
  vi.stubGlobal('document', fakeDocument.document);
  vi.stubGlobal('ResizeObserver', observers.resizeObserver);
  vi.stubGlobal('performance', { now: vi.fn(() => options.now ?? 1234) });
  vi.spyOn(Math, 'random').mockReturnValue(options.random ?? 0.25);
  return { fakeWindow, query: fakeWindow.query, fakeDocument, observers: observers.instances };
}

describe('browserEnvironment', () => {
  it('assembles every source from the host globals (AC-12, AC-13, AC-17)', () => {
    const host = stubHost({ dpr: 2, visibilityState: 'hidden', now: 1234, random: 0.25 });

    const env = browserEnvironment(canvas);

    expect(env.canvas).toBe(canvas);
    expect(env.keyTarget).toBe(host.fakeWindow.window);
    expect(env.devicePixelRatio()).toBe(2);
    expect(env.now()).toBe(1234);
    expect(env.random()).toBe(0.25);
    expect(env.visibility.isHidden()).toBe(true);
    expect(env.scheduler).toBe(webgl.createRafScheduler.mock.results[0]!.value);

    // The motion query is the pinned AC-12 string, asked once for the source.
    expect(host.fakeWindow.window.matchMedia).toHaveBeenCalledTimes(1);
    expect(host.fakeWindow.window.matchMedia).toHaveBeenCalledWith(
      '(prefers-reduced-motion: reduce)',
    );
    expect(webgl.createRafScheduler).toHaveBeenCalledTimes(1);
    expect(webgl.createRafScheduler).toHaveBeenCalledWith();
    expect(host.fakeWindow.query.media).toBe('(prefers-reduced-motion: reduce)');
    // The renderer factory is the WebGL bootstrap, not an eager renderer.
    expect(env.rendererFactory).toBe(webgl.createWebGLRenderer);
    expect(webgl.createWebGLRenderer).not.toHaveBeenCalled();

    env.rendererFactory(canvas);
    expect(webgl.createWebGLRenderer).toHaveBeenCalledTimes(1);
    expect(webgl.createWebGLRenderer).toHaveBeenCalledWith(canvas);
  });

  it('reads the globals at call time, not at module load', () => {
    const first = stubHost({ dpr: 1, visibilityState: 'visible' });
    const env = browserEnvironment(canvas);

    const second = createFakeWindow(3);
    const secondDocument = createFakeDocument('hidden');
    vi.stubGlobal('window', second.window);
    vi.stubGlobal('document', secondDocument.document);

    expect(env.devicePixelRatio()).toBe(3);
    expect(env.visibility.isHidden()).toBe(true);
    // The first call's key target is the object it captured, not the replacement.
    expect(env.keyTarget).toBe(first.fakeWindow.window);
    expect(second.window.matchMedia).not.toHaveBeenCalled();
  });

  it('forwards reduced-motion changes and removes the exact listener (AC-12)', () => {
    const host = stubHost({ dpr: 1 });

    const env = browserEnvironment(canvas);
    expect(env.motion.matches()).toBe(false);

    const seen: boolean[] = [];
    const unsubscribe = env.motion.subscribe((reduced) => {
      seen.push(reduced);
    });

    expect(host.query.addEventListener).toHaveBeenCalledTimes(1);
    const [type, listener] = host.query.addEventListener.mock.calls[0]!;
    expect(type).toBe('change');

    // The live value and the event both come from the query.
    host.query.matches = true;
    expect(env.motion.matches()).toBe(true);
    host.query.emit({ matches: false });
    host.query.emit({ matches: true });
    expect(seen).toEqual([false, true]);

    unsubscribe();
    expect(host.query.removeEventListener).toHaveBeenCalledTimes(1);
    expect(host.query.removeEventListener).toHaveBeenCalledWith('change', listener);
  });

  it('forwards tab visibility changes with the value read at event time', () => {
    const host = stubHost({ dpr: 1, visibilityState: 'visible' });

    const env = browserEnvironment(canvas);
    expect(env.visibility.isHidden()).toBe(false);

    const seen: boolean[] = [];
    const unsubscribe = env.visibility.subscribe((hidden) => {
      seen.push(hidden);
    });
    expect(host.fakeDocument.document.addEventListener).toHaveBeenCalledTimes(1);
    const [type, listener] = host.fakeDocument.document.addEventListener.mock.calls[0]!;
    expect(type).toBe('visibilitychange');

    host.fakeDocument.document.visibilityState = 'hidden';
    host.fakeDocument.emitVisibility();
    host.fakeDocument.document.visibilityState = 'visible';
    host.fakeDocument.emitVisibility();
    expect(seen).toEqual([true, false]);

    unsubscribe();
    expect(host.fakeDocument.document.removeEventListener).toHaveBeenCalledTimes(1);
    expect(host.fakeDocument.document.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      listener,
    );
  });

  it('observes the canvas for resizes and disconnects on unsubscribe (AC-13)', () => {
    const host = stubHost({ dpr: 1 });

    const env = browserEnvironment(canvas);
    const resizes: string[] = [];
    const unsubscribe = env.resize.subscribe(() => {
      resizes.push('resized');
    });

    expect(host.observers).toHaveLength(1);
    expect(host.observers[0]!.observe).toHaveBeenCalledTimes(1);
    expect(host.observers[0]!.observe).toHaveBeenCalledWith(canvas);

    host.observers[0]!.callback();
    host.observers[0]!.callback();
    expect(resizes).toEqual(['resized', 'resized']);

    unsubscribe();
    expect(host.observers[0]!.disconnect).toHaveBeenCalledTimes(1);
  });

  it('creates one ResizeObserver per subscription (each unsubscribe owns its observer)', () => {
    const host = stubHost({ dpr: 1 });

    const env = browserEnvironment(canvas);
    const first = env.resize.subscribe(() => {});
    const second = env.resize.subscribe(() => {});

    expect(host.observers).toHaveLength(2);

    first();
    expect(host.observers[0]!.disconnect).toHaveBeenCalledTimes(1);
    expect(host.observers[1]!.disconnect).not.toHaveBeenCalled();

    second();
    expect(host.observers[1]!.disconnect).toHaveBeenCalledTimes(1);
  });
});
