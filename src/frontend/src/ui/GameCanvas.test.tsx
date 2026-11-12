/** @vitest-environment jsdom */
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { createEngine } from '../game/engine';
import {
  createGameSession,
  type CanvasLike,
  type GameSession,
  type SessionEnvironment,
} from '../game/session';
import { GameCanvas } from './GameCanvas';

/**
 * Canvas integration test through React: SSR pins the element contract (AC-1, AC-13) and
 * jsdom pins the gate-deferred effect (AC-1, AC-3, AC-4, AC-13). The effect is exercised
 * against the real session with a single fake boundary — the host environment — so
 * "attach 0" also means "no listener, no frame, no renderer": the session creates all
 * three only inside `attach`.
 */

const ARIA_LABEL =
  'Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube';

/** The five pointer handlers the session binds to the canvas (AC-13g). */
const POINTER_LISTENERS = [
  'pointercancel',
  'pointerdown',
  'pointerleave',
  'pointermove',
  'pointerup',
];

/** A session fake that records attach calls; SSR must not trigger any. */
function createSessionSpy(): { session: GameSession; attachCalls: () => number } {
  let attaches = 0;
  return {
    attachCalls: () => attaches,
    session: {
      attach: () => {
        attaches += 1;
      },
      dispose: () => {},
      getSnapshot: () => {
        throw new Error('GameCanvas must not read the snapshot during render');
      },
      subscribe: () => () => {},
      setPointerTarget: () => {},
    },
  };
}

interface SubscriptionCounts {
  motion: number;
  visibility: number;
  resize: number;
  orientation: number;
}

interface SessionProbe {
  session: GameSession;
  attach: MockInstance<(target: CanvasLike) => void>;
  dispose: MockInstance<() => void>;
  rendererCanvases: () => CanvasLike[];
  schedules: () => number;
  cancels: () => number;
  pending: () => number;
  keyListeners: () => number;
  subscriptions: () => SubscriptionCounts;
  unsubscriptions: () => SubscriptionCounts;
  adapterDisposals: () => number;
}

/**
 * The real session plus a counting `SessionEnvironment`. Every side effect the session
 * would have on the host — renderer creation, rAF scheduling, canvas/window listeners —
 * is a number here, so the `active` gate is asserted on observable host effects.
 */
function createSessionProbe(): SessionProbe {
  const rendererCanvases: CanvasLike[] = [];
  const scheduled = new Map<number, (nowMs: number) => void>();
  let scheduleCount = 0;
  let cancelCount = 0;
  let nextHandle = 0;
  let adapterDisposals = 0;
  let keyListeners = 0;
  const subscriptions: SubscriptionCounts = { motion: 0, visibility: 0, resize: 0, orientation: 0 };
  const unsubscriptions: SubscriptionCounts = {
    motion: 0,
    visibility: 0,
    resize: 0,
    orientation: 0,
  };

  const env: SessionEnvironment = {
    // `attach` uses the component's real canvas; this field completes the host contract.
    canvas: {
      addEventListener: () => {},
      removeEventListener: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
      width: 0,
      height: 0,
    },
    keyTarget: {
      addEventListener: () => {
        keyListeners += 1;
      },
      removeEventListener: () => {
        keyListeners -= 1;
      },
    },
    scheduler: {
      schedule(callback) {
        nextHandle += 1;
        scheduleCount += 1;
        scheduled.set(nextHandle, callback);
        return nextHandle;
      },
      cancel(handle) {
        cancelCount += 1;
        scheduled.delete(handle);
      },
    },
    motion: {
      matches: () => false,
      subscribe: () => {
        subscriptions.motion += 1;
        return () => {
          unsubscriptions.motion += 1;
        };
      },
    },
    visibility: {
      isHidden: () => false,
      subscribe: () => {
        subscriptions.visibility += 1;
        return () => {
          unsubscriptions.visibility += 1;
        };
      },
    },
    resize: {
      subscribe: () => {
        subscriptions.resize += 1;
        return () => {
          unsubscriptions.resize += 1;
        };
      },
    },
    orientation: {
      subscribe: () => {
        subscriptions.orientation += 1;
        return () => {
          unsubscriptions.orientation += 1;
        };
      },
    },
    rendererFactory: (canvas) => {
      rendererCanvases.push(canvas);
      return {
        setSize: () => {},
        setPixelRatio: () => {},
        setQuality: () => {},
        render: () => {},
        dispose: () => {
          adapterDisposals += 1;
        },
      };
    },
    now: () => 0,
    random: () => 0.5,
    devicePixelRatio: () => 1,
  };

  const session = createGameSession({ env, engine: createEngine({ random: () => 0.5 }) });
  const attach = vi.spyOn(session, 'attach');
  const dispose = vi.spyOn(session, 'dispose');

  return {
    session,
    attach,
    dispose,
    rendererCanvases: () => [...rendererCanvases],
    schedules: () => scheduleCount,
    cancels: () => cancelCount,
    pending: () => scheduled.size,
    keyListeners: () => keyListeners,
    subscriptions: () => ({ ...subscriptions }),
    unsubscriptions: () => ({ ...unsubscriptions }),
    adapterDisposals: () => adapterDisposals,
  };
}

/** The rendered canvas, or a concrete failure when the component dropped it. */
function requireCanvas(): HTMLCanvasElement {
  const canvas = document.querySelector<HTMLCanvasElement>('canvas');
  if (canvas === null) {
    throw new Error('GameCanvas did not render a canvas element');
  }
  return canvas;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('GameCanvas', () => {
  it('renders a focusable, labelled canvas with pointer gestures left to the game', () => {
    const { session } = createSessionSpy();

    const html = renderToStaticMarkup(<GameCanvas session={session} active={false} />);

    expect(html).toBe(
      `<canvas tabindex="0" aria-label="${ARIA_LABEL}" style="touch-action:none"></canvas>`,
    );
  });

  it('does not attach the session during server rendering (the effect is client-only)', () => {
    const { session, attachCalls } = createSessionSpy();

    renderToStaticMarkup(<GameCanvas session={session} active />);

    expect(attachCalls()).toBe(0);
  });
});

describe('GameCanvas — gate-deferred attach (AC-1, AC-3, AC-4, AC-13)', () => {
  it('attaches nothing and creates no listener, frame or renderer while inactive', () => {
    const probe = createSessionProbe();

    render(<GameCanvas session={probe.session} active={false} />);

    expect(probe.attach).toHaveBeenCalledTimes(0);
    expect(probe.rendererCanvases()).toEqual([]);
    expect(probe.schedules()).toBe(0);
    expect(probe.pending()).toBe(0);
    expect(probe.keyListeners()).toBe(0);
    expect(probe.subscriptions()).toEqual({
      motion: 0,
      visibility: 0,
      resize: 0,
      orientation: 0,
    });
  });

  it('attaches once and schedules exactly one frame when it becomes active', () => {
    const probe = createSessionProbe();
    const { rerender } = render(<GameCanvas session={probe.session} active={false} />);
    const canvas = requireCanvas();
    const addListener = vi.spyOn(canvas, 'addEventListener');

    rerender(<GameCanvas session={probe.session} active />);

    expect(probe.attach).toHaveBeenCalledTimes(1);
    expect(probe.attach).toHaveBeenCalledWith(canvas);
    expect(probe.rendererCanvases()).toEqual([canvas]);
    expect(probe.schedules()).toBe(1);
    expect(probe.pending()).toBe(1);
    expect(probe.keyListeners()).toBe(1);
    expect(probe.subscriptions()).toEqual({
      motion: 1,
      visibility: 1,
      resize: 1,
      orientation: 1,
    });
    expect(addListener.mock.calls.map((call) => String(call[0])).sort()).toEqual([
      ...POINTER_LISTENERS,
    ]);
  });

  it('disposes the session exactly once on unmount, releasing every listener and the renderer', () => {
    const probe = createSessionProbe();
    const { unmount } = render(<GameCanvas session={probe.session} active />);
    const canvas = requireCanvas();
    const removeListener = vi.spyOn(canvas, 'removeEventListener');

    expect(probe.attach).toHaveBeenCalledTimes(1);

    unmount();

    expect(probe.dispose).toHaveBeenCalledTimes(1);
    expect(probe.cancels()).toBe(1);
    expect(probe.pending()).toBe(0);
    expect(probe.keyListeners()).toBe(0);
    expect(probe.unsubscriptions()).toEqual({
      motion: 1,
      visibility: 1,
      resize: 1,
      orientation: 1,
    });
    expect(probe.adapterDisposals()).toBe(1);
    expect(removeListener.mock.calls.map((call) => String(call[0])).sort()).toEqual([
      ...POINTER_LISTENERS,
    ]);
  });

  it('disposes on true → false and attaches a fresh cycle on false → true (AC-4)', () => {
    const probe = createSessionProbe();
    const { rerender } = render(<GameCanvas session={probe.session} active />);

    expect(probe.attach).toHaveBeenCalledTimes(1);
    expect(probe.schedules()).toBe(1);
    expect(probe.pending()).toBe(1);

    rerender(<GameCanvas session={probe.session} active={false} />);

    expect(probe.dispose).toHaveBeenCalledTimes(1);
    expect(probe.attach).toHaveBeenCalledTimes(1);
    expect(probe.cancels()).toBe(1);
    expect(probe.pending()).toBe(0);
    expect(probe.adapterDisposals()).toBe(1);

    rerender(<GameCanvas session={probe.session} active />);

    expect(probe.attach).toHaveBeenCalledTimes(2);
    expect(probe.dispose).toHaveBeenCalledTimes(1);
    expect(probe.rendererCanvases()).toEqual([requireCanvas(), requireCanvas()]);
    // One frame per active cycle: the first attach scheduled one, the second one more.
    expect(probe.schedules()).toBe(2);
    expect(probe.pending()).toBe(1);
  });

  it('survives the StrictMode-like mount → unmount → remount path with attach 2 and dispose 1 (AC-4)', () => {
    const probe = createSessionProbe();
    const first = render(<GameCanvas session={probe.session} active />);

    expect(probe.attach).toHaveBeenCalledTimes(1);

    first.unmount();

    expect(probe.dispose).toHaveBeenCalledTimes(1);

    render(<GameCanvas session={probe.session} active />);

    expect(probe.attach).toHaveBeenCalledTimes(2);
    expect(probe.dispose).toHaveBeenCalledTimes(1);
    expect(probe.rendererCanvases()).toHaveLength(2);
    expect(probe.schedules()).toBe(2);
  });
});
