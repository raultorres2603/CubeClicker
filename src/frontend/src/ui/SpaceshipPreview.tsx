/**
 * Live spaceship preview (T11; spec AC-31; plan § Preview / UI; remote-spaceship-
 * customization T15 for the v3 attributes).
 *
 * A real single-context WebGL preview of the cursor model with the current slot appearance.
 * The component owns exactly one `WebGLRenderer` and one requestAnimationFrame loop, renders at
 * most 30 frames per second (see `render/preview.ts`) and disposes both the scene model and the
 * renderer on unmount.
 *
 * If WebGL construction fails (no context, blocked GPU, headless environment) the effect stops
 * early: the canvas stays an empty labeled preview and the surrounding customization panel keeps
 * working.
 *
 * The legacy canvas contract is preserved for backward compatibility: the
 * `spaceship-preview` class, the `Spaceship preview` accessible name and the five predecessor
 * `data-*-color` attributes — now derived from the same v3 mapping (hull→body, nose→nose,
 * wing-left→wings, cockpit→cockpit, ignition-left→engine) so a v3 part never renders a default
 * colour. The ten `data-preview-slot-<slotId>` attributes expose the resolved v3 part id per
 * ship slot; the eleventh `shot` entry selects only the shot style and has no preview geometry,
 * so it publishes no attribute.
 */

import { useEffect, useRef, type ReactElement } from 'react';
import { WebGLRenderer } from 'three';

import { appearanceToShipParamsV3 } from '../game/parts-v3';
import {
  PREVIEW_FRAME_INTERVAL_MS,
  createPreviewScene,
  type PreviewScene,
} from '../render/preview';

/** The pinned reduced-motion query. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Pixel-ratio cap for the preview context. */
const MAX_PREVIEW_PIXEL_RATIO = 2;

/** Stable fallback appearance so an omitted prop never churns the render effect. */
const EMPTY_APPEARANCE: Record<string, string> = {};

export interface SpaceshipPreviewProps {
  appearance?: Record<string, string>;
}

export function SpaceshipPreview({
  appearance = EMPTY_APPEARANCE,
}: SpaceshipPreviewProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<PreviewScene | null>(null);
  const appearanceRef = useRef(appearance);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      // No WebGL context: keep the empty labeled canvas, the panel stays usable.
      return;
    }

    let preview: PreviewScene;
    try {
      preview = createPreviewScene(appearanceRef.current);
    } catch {
      renderer.dispose();
      return;
    }
    previewRef.current = preview;

    const motionQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia(REDUCED_MOTION_QUERY)
        : null;
    let reducedMotion = motionQuery !== null && motionQuery.matches;
    const handleMotionChange = (event: MediaQueryListEvent): void => {
      reducedMotion = event.matches;
    };
    if (motionQuery !== null) {
      if (typeof motionQuery.addEventListener === 'function') {
        motionQuery.addEventListener('change', handleMotionChange);
      } else {
        motionQuery.addListener(handleMotionChange);
      }
    }

    const resize = (): void => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setPixelRatio(Math.min(MAX_PREVIEW_PIXEL_RATIO, window.devicePixelRatio || 1));
      renderer.setSize(width, height, false);
      preview.camera.aspect = width / height;
      preview.camera.updateProjectionMatrix();
    };
    resize();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
    }

    let frameHandle: number | null = null;
    let lastRenderMs: number | null = null;
    const frame = (nowMs: number): void => {
      frameHandle = requestAnimationFrame(frame);
      if (lastRenderMs !== null && nowMs - lastRenderMs < PREVIEW_FRAME_INTERVAL_MS) {
        return;
      }
      const dtMs = lastRenderMs === null ? 0 : nowMs - lastRenderMs;
      lastRenderMs = nowMs;
      preview.update(dtMs, reducedMotion);
      renderer.render(preview.scene, preview.camera);
    };
    frameHandle = requestAnimationFrame(frame);

    return () => {
      if (frameHandle !== null) {
        cancelAnimationFrame(frameHandle);
      }
      if (resizeObserver !== null) {
        resizeObserver.disconnect();
      }
      if (motionQuery !== null) {
        if (typeof motionQuery.removeEventListener === 'function') {
          motionQuery.removeEventListener('change', handleMotionChange);
        } else {
          motionQuery.removeListener(handleMotionChange);
        }
      }
      previewRef.current = null;
      preview.dispose();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    appearanceRef.current = appearance;
    const preview = previewRef.current;
    if (preview !== null) {
      preview.model.applyAppearance(appearance);
    }
  }, [appearance]);

  const visuals = appearanceToShipParamsV3(appearance);

  return (
    <canvas
      ref={canvasRef}
      className="spaceship-preview"
      aria-label="Spaceship preview"
      data-nose-color={visuals.nose.color}
      data-body-color={visuals.hull.color}
      data-wing-color={visuals['wing-left'].color}
      data-cockpit-color={visuals.cockpit.color}
      data-engine-color={visuals['ignition-left'].color}
      data-preview-slot-hull={visuals.hull.partId}
      data-preview-slot-nose={visuals.nose.partId}
      data-preview-slot-cockpit={visuals.cockpit.partId}
      data-preview-slot-wing-left={visuals['wing-left'].partId}
      data-preview-slot-wing-right={visuals['wing-right'].partId}
      data-preview-slot-engine-left={visuals['engine-left'].partId}
      data-preview-slot-engine-right={visuals['engine-right'].partId}
      data-preview-slot-ignition-left={visuals['ignition-left'].partId}
      data-preview-slot-ignition-right={visuals['ignition-right'].partId}
      data-preview-slot-tail-fin={visuals['tail-fin'].partId}
    />
  );
}
