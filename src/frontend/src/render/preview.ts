/**
 * Live spaceship preview scene (T11; spec AC-31; plan § Preview / UI; remote-spaceship-
 * customization T9 for the v3 catalog).
 *
 * Layer: render adapter (`render/**`) — three.js only. The preview reuses the exact cursor
 * model factory and the exact `appearanceToShipParamsV3` mapping as the in-game cursor,
 * applies the ten ship slots of the 11-entry appearance (the `shot` entry selects the shot
 * style only and has no preview geometry), wraps the model in a small key/ambient-lit scene
 * with a fixed camera, and rotates the model at {@link PREVIEW_ROTATION_RAD_PER_MS} per
 * millisecond while motion is allowed. Reduced motion keeps the static rest pose.
 *
 * The renderer and the frame loop are deliberately **not** owned here: the React component
 * creates the single WebGL context, renders at most {@link PREVIEW_MAX_FPS} frames per second
 * and calls {@link PreviewScene.dispose} (then the renderer's own `dispose`) on unmount.
 */

import { AmbientLight, DirectionalLight, PerspectiveCamera, Scene } from 'three';

import { SLOT_CATALOG_V3, appearanceToShipParamsV3 } from '../game/parts-v3';
import { createCursorShipModel, type CursorShipModel } from './cursor-ship';

/** Hard cap on preview frames per second (AC-31). */
export const PREVIEW_MAX_FPS = 30;

/** Minimum gap between two rendered preview frames (`1000 / 30` ms). */
export const PREVIEW_FRAME_INTERVAL_MS = 1000 / PREVIEW_MAX_FPS;

/** Idle yaw speed of the preview model, in radians per millisecond (AC-31). */
export const PREVIEW_ROTATION_RAD_PER_MS = 0.0004;

/** Rest yaw of the preview model: a three-quarter view of the craft. */
export const PREVIEW_REST_ROTATION_RAD = 0.55;

/** Preview camera vertical field of view, in degrees. */
export const PREVIEW_CAMERA_FOV = 35;

/** Preview camera near plane. */
export const PREVIEW_CAMERA_NEAR = 0.1;

/** Preview camera far plane. */
export const PREVIEW_CAMERA_FAR = 20;

/** Preview camera position: slightly above and in front of the craft. */
export const PREVIEW_CAMERA_POSITION: readonly [number, number, number] = [0, 0.32, 2.15];

/** Preview camera look-at target: just above the model origin. */
export const PREVIEW_CAMERA_TARGET: readonly [number, number, number] = [0, 0.02, 0];

/** Ambient fill colour of the preview rig. */
export const PREVIEW_AMBIENT_COLOR = 0xbcd6ff;

/** Ambient fill intensity of the preview rig. */
export const PREVIEW_AMBIENT_INTENSITY = 1.2;

/** Key light colour of the preview rig. */
export const PREVIEW_KEY_LIGHT_COLOR = 0xffffff;

/** Key light intensity of the preview rig. */
export const PREVIEW_KEY_LIGHT_INTENSITY = 2.6;

/** Key light position relative to the model. */
export const PREVIEW_KEY_LIGHT_POSITION: readonly [number, number, number] = [2, 3, 4];

/** The preview handle handed to the UI component. */
export interface PreviewScene {
  /** The scene holding the two lights and the cursor model. */
  readonly scene: Scene;
  /** The preview camera (the component sets `aspect` from the canvas size). */
  readonly camera: PerspectiveCamera;
  /** The cursor model, already showing the requested appearance. */
  readonly model: CursorShipModel;
  /**
   * Advances the idle rotation. Non-positive deltas and reduced motion leave the model at its
   * current yaw, so a reduced-motion preview is a static frame.
   */
  update(dtMs: number, reducedMotion: boolean): void;
  /** Removes the scene contents and disposes the model; idempotent. */
  dispose(): void;
}

/**
 * Builds the preview scene for one appearance.
 *
 * @param appearance slot→part-id record (v3 ids; legacy categories/ids are normalized by the
 *   same `appearanceToShipParamsV3` mapping the cursor uses). The `shot` entry is resolved (it
 *   is part of the 11-slot record) but selects no preview geometry.
 */
export function createPreviewScene(
  appearance: Record<string, string> = {},
): PreviewScene {
  const scene = new Scene();
  scene.name = 'spaceship-preview-scene';

  const camera = new PerspectiveCamera(
    PREVIEW_CAMERA_FOV,
    1,
    PREVIEW_CAMERA_NEAR,
    PREVIEW_CAMERA_FAR,
  );
  camera.position.set(
    PREVIEW_CAMERA_POSITION[0],
    PREVIEW_CAMERA_POSITION[1],
    PREVIEW_CAMERA_POSITION[2],
  );
  camera.lookAt(
    PREVIEW_CAMERA_TARGET[0],
    PREVIEW_CAMERA_TARGET[1],
    PREVIEW_CAMERA_TARGET[2],
  );

  const ambient = new AmbientLight(PREVIEW_AMBIENT_COLOR, PREVIEW_AMBIENT_INTENSITY);
  ambient.name = 'preview-ambient';

  const keyLight = new DirectionalLight(PREVIEW_KEY_LIGHT_COLOR, PREVIEW_KEY_LIGHT_INTENSITY);
  keyLight.name = 'preview-key-light';
  keyLight.position.set(
    PREVIEW_KEY_LIGHT_POSITION[0],
    PREVIEW_KEY_LIGHT_POSITION[1],
    PREVIEW_KEY_LIGHT_POSITION[2],
  );

  const model = createCursorShipModel();
  model.group.rotation.y = PREVIEW_REST_ROTATION_RAD;
  // The 11-entry v3 record: the ten ship slots drive the geometry (and the hull's chassis),
  // the `shot` entry selects the shot style only (T10/T11) and has no preview geometry.
  const visuals = appearanceToShipParamsV3(appearance);
  for (const slot of SLOT_CATALOG_V3) {
    if (slot.id === 'shot') {
      continue;
    }
    model.applySlotVisual(visuals[slot.id]);
  }

  scene.add(ambient, keyLight, model.group);

  let disposed = false;

  return {
    scene,
    camera,
    model,
    update(dtMs: number, reducedMotion: boolean): void {
      if (disposed || reducedMotion || !Number.isFinite(dtMs) || dtMs <= 0) {
        return;
      }
      model.group.rotation.y += PREVIEW_ROTATION_RAD_PER_MS * dtMs;
    },
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      scene.clear();
      model.dispose();
    },
  };
}
