/**
 * 3D lootbox reveal stage (game-feel-overhaul T2; spec AC-4, AC-5, AC-14, AC-15).
 *
 * Layer: render adapter (`render/**`) — three.js only. The stage owns one scene, one camera,
 * the cursor model, the staged try-on appearance and the rarity ring; it owns **no** renderer
 * and **no** frame loop. `ui/LootboxReveal.tsx` (T3) creates the single WebGL context and the
 * bounded 30 fps loop and calls {@link RevealStage.update} / {@link RevealStage.dispose}.
 *
 * Pinned scene (AC-4): `lootbox-reveal-scene` holds exactly four children in this order —
 * `reveal-ambient` (`AmbientLight`), `reveal-key-light` (`DirectionalLight`), the
 * `cursor-ship-model` group and `reveal-slot-ring` (one `RingGeometry` mesh). No shadow is
 * enabled, no texture/loader/sprite/points is created, the module touches no browser global
 * and it consumes no random draw.
 *
 * Try-on staging (AC-5): the stage resolves the slot from the catalog
 * (`partDefinition(grant.partId).slot`, never the wire `slot`), copies the normalized
 * appearance and replaces only that slot, then applies it through the cursor model's single
 * `applyAppearance` path — the same `appearanceToCursorShipParams` mapping the cursor and the
 * preview use, so no second visual mapping exists. The caller's `appearance` object is never
 * mutated.
 *
 * Per-frame work (AC-15): {@link RevealStage.update} writes one pre-allocated pose buffer into
 * the scene graph — whole-ship yaw/scale, the granted slot's base scale times the reveal
 * pulse, the ring's scale/opacity and the key-light flash lift `3.0 * (1 + flashOpacity)` —
 * so a frame allocates nothing. {@link RevealStage.dispose} releases every unique
 * geometry/material exactly once, clears the scene and is idempotent.
 */

import {
  AmbientLight,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  RingGeometry,
  Scene,
} from 'three';

import { normalizeAppearance, partDefinition } from '../game/parts-v2';
import {
  createRevealStagePose,
  REVEAL_RARITY_HEX,
  revealStagePose,
  type RevealStagePose,
} from '../game/reveal-motion';
import type { LootboxGrant } from '../game/types';
import {
  CURSOR_SHIP_MAX_TRIANGLES,
  createCursorShipModel,
  type CursorShipModel,
} from './cursor-ship';

/** Scene name of the reveal context (AC-4). */
export const REVEAL_STAGE_SCENE_NAME = 'lootbox-reveal-scene';

/** Ambient fill light name (AC-4). */
export const REVEAL_AMBIENT_NAME = 'reveal-ambient';

/** Ambient fill colour of the reveal rig (plan § Reveal stage). */
export const REVEAL_AMBIENT_COLOR = 0xbcd6ff;

/** Ambient fill intensity of the reveal rig (AC-4). */
export const REVEAL_AMBIENT_INTENSITY = 1.1;

/** Key light name (AC-4). */
export const REVEAL_KEY_LIGHT_NAME = 'reveal-key-light';

/** Key light colour of the reveal rig (plan § Reveal stage). */
export const REVEAL_KEY_LIGHT_COLOR = 0xffffff;

/** Key light base intensity; each frame applies `base * (1 + flashOpacity)` (AC-4). */
export const REVEAL_KEY_LIGHT_BASE_INTENSITY = 3.0;

/** Key light position relative to the model (plan § Reveal stage). */
export const REVEAL_KEY_LIGHT_POSITION: readonly [number, number, number] = [2.5, 3.5, 4];

/** Reveal camera vertical field of view, in degrees (AC-4). */
export const REVEAL_CAMERA_FOV = 32;

/** Reveal camera near plane (AC-4). */
export const REVEAL_CAMERA_NEAR = 0.1;

/** Reveal camera far plane (AC-4). */
export const REVEAL_CAMERA_FAR = 20;

/** Reveal camera position (AC-4). */
export const REVEAL_CAMERA_POSITION: readonly [number, number, number] = [0, 0.42, 2.35];

/** Reveal camera look-at target (AC-4). */
export const REVEAL_CAMERA_TARGET: readonly [number, number, number] = [0, 0.03, 0];

/** Rarity ring mesh name (AC-4). */
export const REVEAL_RING_NAME = 'reveal-slot-ring';

/** Rarity ring inner radius (AC-4). */
export const REVEAL_RING_INNER_RADIUS = 0.86;

/** Rarity ring outer radius (AC-4). */
export const REVEAL_RING_OUTER_RADIUS = 0.9;

/** Rarity ring angular segments (AC-4): 48 segments → 96 triangles. */
export const REVEAL_RING_THETA_SEGMENTS = 48;

/** Triangles contributed by the rarity ring (AC-4/AC-15). */
export const REVEAL_RING_TRIANGLES = 96;

/** Rarity ring height below the model origin (plan § Reveal stage). */
export const REVEAL_RING_POSITION_Y = -0.25;

/** Per-frame draw-call ceiling: 21 cursor meshes + 1 ring + 2 margin (AC-15). */
export const REVEAL_MAX_DRAW_CALLS = 24;

/** Per-frame triangle ceiling: cursor model budget + ring triangles (AC-15). */
export const REVEAL_MAX_TRIANGLES = CURSOR_SHIP_MAX_TRIANGLES + REVEAL_RING_TRIANGLES;

/** The reveal-stage handle handed to the UI component. */
export interface RevealStage {
  /** The `lootbox-reveal-scene` scene (four children, see the module contract). */
  readonly scene: Scene;
  /** The fixed reveal camera (the component sets `aspect` from the canvas size). */
  readonly camera: PerspectiveCamera;
  /** The cursor model, already showing the staged try-on appearance. */
  readonly model: CursorShipModel;
  /** The normalized appearance with only the granted catalog slot replaced (AC-5). */
  readonly stageAppearance: Readonly<Record<string, string>>;
  /** The rarity-coloured ring mesh (AC-4). */
  readonly ring: Mesh;
  /**
   * Writes the pose for `elapsedMs` into the scene graph and returns the reused pose buffer.
   * An unknown/out-of-range elapsed value clamps through `revealStagePose`; reduced motion
   * always writes the static rest row. After {@link RevealStage.dispose} the call is a no-op
   * that returns the last pose.
   */
  update(elapsedMs: number, reducedMotion: boolean): RevealStagePose;
  /** Releases every unique geometry/material once, clears the scene; idempotent. */
  dispose(): void;
}

/**
 * Builds the reveal stage for one try-on appearance and one grant.
 *
 * @param appearance the player's slot→part-id appearance; it is normalized into a copy and
 *   never mutated.
 * @param grant the granted lootbox; its catalog slot (`partDefinition(partId).slot`) is the
 *   only slot the stage replaces. An unknown part id throws `unknown part: <id>` before any
 *   GPU resource is built, so the component can fall back.
 */
export function createRevealStage(
  appearance: Record<string, string>,
  grant: LootboxGrant,
): RevealStage {
  const resolvedSlot = partDefinition(grant.partId).slot;

  // A fresh copy: the passed appearance is the player's real customization state and must
  // never be mutated by the reveal (AC-5). The catalog slot wins over any wire slot.
  const stageAppearance: Record<string, string> = {
    ...normalizeAppearance(appearance),
    [resolvedSlot]: grant.partId,
  };

  const scene = new Scene();
  scene.name = REVEAL_STAGE_SCENE_NAME;

  const camera = new PerspectiveCamera(
    REVEAL_CAMERA_FOV,
    1,
    REVEAL_CAMERA_NEAR,
    REVEAL_CAMERA_FAR,
  );
  camera.position.set(
    REVEAL_CAMERA_POSITION[0],
    REVEAL_CAMERA_POSITION[1],
    REVEAL_CAMERA_POSITION[2],
  );
  camera.lookAt(REVEAL_CAMERA_TARGET[0], REVEAL_CAMERA_TARGET[1], REVEAL_CAMERA_TARGET[2]);

  const ambient = new AmbientLight(REVEAL_AMBIENT_COLOR, REVEAL_AMBIENT_INTENSITY);
  ambient.name = REVEAL_AMBIENT_NAME;

  const keyLight = new DirectionalLight(
    REVEAL_KEY_LIGHT_COLOR,
    REVEAL_KEY_LIGHT_BASE_INTENSITY,
  );
  keyLight.name = REVEAL_KEY_LIGHT_NAME;
  keyLight.position.set(
    REVEAL_KEY_LIGHT_POSITION[0],
    REVEAL_KEY_LIGHT_POSITION[1],
    REVEAL_KEY_LIGHT_POSITION[2],
  );

  const model = createCursorShipModel();
  // The single appearance path: the model's `applyAppearance` is the one place that maps the
  // staged record through `appearanceToCursorShipParams` (AC-5).
  model.applyAppearance(stageAppearance);

  // Base transforms after the appearance apply: the reveal pulse multiplies only the granted
  // slot's scale, and every slot rotation is restored from these values each frame.
  const slotGroups = model.slotGroups;
  const baseScaleX = new Float64Array(slotGroups.length);
  const baseScaleY = new Float64Array(slotGroups.length);
  const baseScaleZ = new Float64Array(slotGroups.length);
  const baseRotationX = new Float64Array(slotGroups.length);
  const baseRotationY = new Float64Array(slotGroups.length);
  const baseRotationZ = new Float64Array(slotGroups.length);
  for (let index = 0; index < slotGroups.length; index += 1) {
    const slotGroup = slotGroups[index];
    baseScaleX[index] = slotGroup.scale.x;
    baseScaleY[index] = slotGroup.scale.y;
    baseScaleZ[index] = slotGroup.scale.z;
    baseRotationX[index] = slotGroup.rotation.x;
    baseRotationY[index] = slotGroup.rotation.y;
    baseRotationZ[index] = slotGroup.rotation.z;
  }
  // Identity lookup over the model's own slot groups; a slot the model does not build would
  // simply never pulse (cannot happen for a catalog part).
  const grantedIndex = slotGroups.indexOf(model.slots[resolvedSlot]);

  const ringGeometry = new RingGeometry(
    REVEAL_RING_INNER_RADIUS,
    REVEAL_RING_OUTER_RADIUS,
    REVEAL_RING_THETA_SEGMENTS,
  );
  const ringMaterial = new MeshBasicMaterial({
    color: REVEAL_RARITY_HEX[grant.rarity],
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  const ring = new Mesh(ringGeometry, ringMaterial);
  ring.name = REVEAL_RING_NAME;
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = REVEAL_RING_POSITION_Y;

  scene.add(ambient, keyLight, model.group, ring);

  const pose = createRevealStagePose();
  let disposed = false;

  /** Writes one pose into the scene graph without allocating (AC-15). */
  function applyPose(next: RevealStagePose): RevealStagePose {
    model.group.rotation.y = next.yawRad;
    model.group.scale.setScalar(next.scale);
    for (let index = 0; index < slotGroups.length; index += 1) {
      const slotGroup = slotGroups[index];
      const pulse = index === grantedIndex ? next.slotPulse : 1;
      slotGroup.scale.set(
        baseScaleX[index] * pulse,
        baseScaleY[index] * pulse,
        baseScaleZ[index] * pulse,
      );
      slotGroup.rotation.set(
        baseRotationX[index],
        baseRotationY[index],
        baseRotationZ[index],
      );
    }
    ring.scale.setScalar(next.ringScale);
    ringMaterial.opacity = next.ringOpacity;
    keyLight.intensity = REVEAL_KEY_LIGHT_BASE_INTENSITY * (1 + next.flashOpacity);
    return next;
  }

  // Start on the pinned charge row so a frame painted before the first `update` already shows
  // the preview rest yaw, a hidden ring and the unflashed key light.
  applyPose(revealStagePose(0, resolvedSlot, false, pose));

  return {
    scene,
    camera,
    model,
    stageAppearance,
    ring,
    update(elapsedMs: number, reducedMotion: boolean): RevealStagePose {
      if (disposed) {
        return pose;
      }
      return applyPose(revealStagePose(elapsedMs, resolvedSlot, reducedMotion, pose));
    },
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      model.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      scene.clear();
    },
  };
}
