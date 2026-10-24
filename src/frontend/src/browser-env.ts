/**
 * Browser environment assembly (T13) — the single module that reads host globals.
 *
 * Layer: session boundary (workspace `src/` root, i.e. deliberately *outside*
 * `game/**`, AC-17). It turns the host globals into the narrow
 * {@link SessionEnvironment} the session consumes, so every other module stays free of
 * them and each value is replaceable with a fake in tests.
 *
 * The default renderer factory and frame scheduler come from the render adapter's
 * bootstrap (`render/webgl.ts`); this module never constructs a renderer itself. The
 * key target is the top-level event target, the motion reader follows the pinned
 * `prefers-reduced-motion: reduce` query, the visibility reader follows the tab's own
 * visibility state plus its change event, the size reader follows a resize observer on
 * the canvas, the orientation reader follows the window's `orientationchange` event, the
 * frame clock is the monotonic time source and the layout seed is the host's random
 * function.
 */

import type {
  CanvasLike,
  MotionSource,
  OrientationSource,
  ResizeSource,
  SessionEnvironment,
  VisibilitySource,
} from './game/session';
import { createRafScheduler, createWebGLRenderer } from './render/webgl';

/** The pinned reduced-motion query (AC-12). */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Builds the default environment for `canvas`.
 *
 * Read at call time (never at module load), so a page that stubs or replaces these
 * globals — and every stubbed-global test — sees its own values.
 */
export function browserEnvironment(canvas: CanvasLike): SessionEnvironment {
  const motionQuery = window.matchMedia(REDUCED_MOTION_QUERY);

  const motion: MotionSource = {
    matches: () => motionQuery.matches,
    subscribe(cb: (reduced: boolean) => void): () => void {
      const handler = (event: MediaQueryListEvent): void => cb(event.matches);
      motionQuery.addEventListener('change', handler);
      return () => motionQuery.removeEventListener('change', handler);
    },
  };

  const visibility: VisibilitySource = {
    isHidden: () => document.visibilityState === 'hidden',
    subscribe(cb: (hidden: boolean) => void): () => void {
      const handler = (): void => cb(document.visibilityState === 'hidden');
      document.addEventListener('visibilitychange', handler);
      return () => document.removeEventListener('visibilitychange', handler);
    },
  };

  const resize: ResizeSource = {
    subscribe(cb: () => void): () => void {
      const observer = new ResizeObserver(() => cb());
      observer.observe(canvas as unknown as Element);
      return () => observer.disconnect();
    },
  };

  const orientation: OrientationSource = {
    subscribe(cb: () => void): () => void {
      const handler = (): void => cb();
      window.addEventListener('orientationchange', handler);
      return () => window.removeEventListener('orientationchange', handler);
    },
  };

  return {
    canvas,
    keyTarget: window,
    scheduler: createRafScheduler(),
    motion,
    visibility,
    resize,
    orientation,
    rendererFactory: createWebGLRenderer,
    now: () => performance.now(),
    random: () => Math.random(),
    devicePixelRatio: () => window.devicePixelRatio,
  };
}
