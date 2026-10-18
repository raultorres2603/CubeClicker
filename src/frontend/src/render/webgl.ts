/**
 * WebGL bootstrap (T13) — the three.js renderer behind the session's narrow adapter
 * surface, plus the single frame-schedule wrapper.
 *
 * Layer: render adapter (`render/**`), three.js only. These two functions are the
 * default environment's renderer factory and frame scheduler (`browser-env.ts`), i.e.
 * the only place the drawing context and the display-refresh callback are touched on
 * the render side; the session itself receives both through its injected environment.
 *
 * The pixel ratio and the drawing-buffer size are *not* decided here: the session owns
 * them (`min(devicePixelRatio, PIXEL_RATIO_CAP)` and the container rect) and this
 * adapter only forwards the values it is handed.
 */

import { WebGLRenderer, type PerspectiveCamera, type Scene } from 'three';

import type { CanvasLike, FrameScheduler, RendererAdapter } from '../game/session';

/**
 * Creates the WebGL renderer for `canvas` behind {@link RendererAdapter}.
 *
 * The constructor arguments are pinned by the plan: the host canvas plus `antialias`.
 */
export function createWebGLRenderer(canvas: CanvasLike): RendererAdapter {
  // The session's `CanvasLike` is structurally the canvas element (plan § session
  // contract keeps the surface minimal so tests can fake it); three.js needs the DOM
  // element type for its own parameters object.
  const renderer = new WebGLRenderer({
    canvas: canvas as unknown as HTMLCanvasElement,
    antialias: true,
  });

  return {
    setSize(width: number, height: number): void {
      renderer.setSize(width, height);
    },
    setPixelRatio(ratio: number): void {
      renderer.setPixelRatio(ratio);
    },
    render(scene: Scene, camera: PerspectiveCamera): void {
      renderer.render(scene, camera);
    },
    dispose(): void {
      renderer.dispose();
    },
  };
}

/** Wraps the host's display-refresh callback in the pinned {@link FrameScheduler} surface. */
export function createRafScheduler(): FrameScheduler {
  return {
    schedule(cb: (nowMs: number) => void): number {
      return requestAnimationFrame(cb);
    },
    cancel(handle: number): void {
      cancelAnimationFrame(handle);
    },
  };
}
