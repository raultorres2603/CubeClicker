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

import {
  ACESFilmicToneMapping,
  PCFSoftShadowMap,
  SRGBColorSpace,
  WebGLRenderer,
  type PerspectiveCamera,
  type Scene,
} from 'three';

import { createPostprocessing } from './postprocessing';
import type { Postprocessing } from './postprocessing';

import type { CanvasLike, FrameScheduler, RendererAdapter } from '../game/session';

/** Pinned renderer tone-mapping exposure (AC-1). */
export const TONE_MAPPING_EXPOSURE = 1.0;

/** Configures the base renderer's tone mapping, color space and soft-shadow type (AC-1). */
function configureBaseRenderer(renderer: WebGLRenderer): void {
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.shadowMap.enabled = true;
}

/** Constructs and configures the base WebGL renderer for `canvas`. */
function buildBaseRenderer(canvas: CanvasLike): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas: canvas as unknown as HTMLCanvasElement,
    antialias: true,
  });
  configureBaseRenderer(renderer);
  return renderer;
}

/**
 * Creates the WebGL renderer for `canvas` behind {@link RendererAdapter}.
 */
export function createWebGLRenderer(canvas: CanvasLike): RendererAdapter {
  const renderer = buildBaseRenderer(canvas);

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

/**
 * Builds a renderer whose post-processing composer is constructed lazily on the first
 * `render(scene, camera)` call (AC-6).
 */
export function createRealisticRenderer(canvas: CanvasLike): RendererAdapter {
  const renderer = buildBaseRenderer(canvas);

  let composer: Postprocessing | null = null;
  let bufferedWidth: number | null = null;
  let bufferedHeight: number | null = null;
  let bufferedPixelRatio: number | null = null;
  let disposed = false;

  return {
    setSize(width: number, height: number): void {
      renderer.setSize(width, height);
      if (composer !== null) {
        composer.setSize(width, height);
      } else {
        bufferedWidth = width;
        bufferedHeight = height;
      }
    },
    setPixelRatio(ratio: number): void {
      renderer.setPixelRatio(ratio);
      if (composer !== null) {
        composer.setPixelRatio(ratio);
      } else {
        bufferedPixelRatio = ratio;
      }
    },
    render(scene: Scene, camera: PerspectiveCamera): void {
      if (disposed) {
        return;
      }
      if (composer === null) {
        composer = createPostprocessing(renderer, scene, camera);
        if (bufferedWidth !== null && bufferedHeight !== null) {
          composer.setSize(bufferedWidth, bufferedHeight);
        }
        if (bufferedPixelRatio !== null) {
          composer.setPixelRatio(bufferedPixelRatio);
        }
      }
      composer.render();
    },
    dispose(): void {
      if (composer !== null) {
        composer.dispose();
        composer = null;
      }
      renderer.dispose();
      disposed = true;
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