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
 * them (the tier's `QUALITY_PIXEL_RATIO_CAPS` ceiling and the container rect) and this
 * adapter only forwards the values it is handed. The adapter does own the tier's
 * renderer-side GPU budget: the shadow pass toggle and the composer pass list.
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
import type { QualityTier } from './quality';

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
  // The adapter owns the reset point (start of every adapter render), so a post-processing
  // pass list accumulates into one full-frame total instead of reporting only the last pass
  // (AC-21). Three's default auto-reset would clear `info` on every inner `render` call.
  renderer.info.autoReset = false;
  return renderer;
}

/** The renderer's per-frame draw stats, read through the adapter (AC-21). */
function rendererStats(renderer: WebGLRenderer): { calls: number; triangles: number } {
  return {
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
  };
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
    setQuality(): void {
      // The plain renderer has no post-processing or shadow policy of its own.
    },
    render(scene: Scene, camera: PerspectiveCamera): void {
      renderer.info.reset();
      renderer.render(scene, camera);
    },
    stats(): { calls: number; triangles: number } {
      return rendererStats(renderer);
    },
    dispose(): void {
      renderer.dispose();
    },
  };
}

/**
 * Builds a renderer whose post-processing composer is constructed lazily on the first
 * `render(scene, camera)` call and rebuilt on every tier change (AC-6, AC-9, AC-10).
 *
 * The adapter starts at high and owns the tier's GPU budget on the renderer side:
 * `shadowMap.enabled` is on at high/medium and off at low; low bypasses the composer
 * entirely. A composer replacement is disposed exactly once and the last forwarded size
 * and pixel ratio are replayed onto the rebuilt composer exactly once.
 */
export function createRealisticRenderer(canvas: CanvasLike): RendererAdapter {
  const renderer = buildBaseRenderer(canvas);

  let tier: QualityTier = 'high';
  let composer: Postprocessing | null = null;
  let lastWidth: number | null = null;
  let lastHeight: number | null = null;
  let lastPixelRatio: number | null = null;
  let disposed = false;

  function disposeComposer(): void {
    if (composer !== null) {
      composer.dispose();
      composer = null;
    }
  }

  return {
    setSize(width: number, height: number): void {
      renderer.setSize(width, height);
      lastWidth = width;
      lastHeight = height;
      if (composer !== null) {
        composer.setSize(width, height);
      }
    },
    setPixelRatio(ratio: number): void {
      renderer.setPixelRatio(ratio);
      lastPixelRatio = ratio;
      if (composer !== null) {
        composer.setPixelRatio(ratio);
      }
    },
    setQuality(next: QualityTier): void {
      if (next === tier) {
        return;
      }
      tier = next;
      renderer.shadowMap.enabled = next !== 'low';
      // The next render rebuilds the composer for the new tier; retaining the last size
      // and ratio lets that rebuild replay them exactly once.
      disposeComposer();
    },
    render(scene: Scene, camera: PerspectiveCamera): void {
      if (disposed) {
        return;
      }
      renderer.info.reset();
      if (tier === 'low') {
        // Defensive: `setQuality` already released the composer on the transition.
        disposeComposer();
        renderer.render(scene, camera);
        return;
      }
      if (composer === null) {
        composer = createPostprocessing(renderer, scene, camera, tier);
        if (lastWidth !== null && lastHeight !== null) {
          composer.setSize(lastWidth, lastHeight);
        }
        if (lastPixelRatio !== null) {
          composer.setPixelRatio(lastPixelRatio);
        }
      }
      composer.render();
    },
    stats(): { calls: number; triangles: number } {
      return rendererStats(renderer);
    },
    dispose(): void {
      disposeComposer();
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