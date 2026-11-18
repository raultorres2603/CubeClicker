/**
 * Spaceship cursor — the outer cursor group, its detailed model, trail, shots and the
 * pure follow/target helpers (T9; spaceship-cursor spec AC-2/AC-3, this feature AC-5,
 * AC-6, AC-7, AC-9, AC-42).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. The module
 * exports pure, deterministic helpers ({@link spaceshipFollowFactor},
 * {@link spaceshipTargetPosition}) plus a factory {@link createSpaceship} that owns:
 *
 * - the `spaceship` group (`SPACESHIP_SCALE`, rest `(0, 0, 6)`) holding the
 *   {@link createCursorShipModel} subtree (32 objects) and one trail `Points` — 34
 *   cursor objects, 21 meshes, 22 draws at high tier;
 * - per-slot appearance through `CursorShipModel.applyAppearance` (no-op + no pulse for an
 *   unchanged appearance);
 * - banking/pitch, the 8-point/220 ms trail, the 0.015/2600 ms idle bob, the 260 ms/4 %
 *   equip pulse and the observed 100 ms plume flicker;
 * - the 700 ms/360° fly-by roll on a 1.2-world-unit orbit with a 16-point/700 ms fire
 *   trail;
 * - the unchanged shot list and 180 ms travel, presented through the prebuilt shot styles
 *   (T10): the default `shot-bolt` glowing tapered bolt (or the equipped style's `orb`/`wave`/
 *   `shard` geometry) with an 80 ms additive muzzle flash (`shot-muzzle-flash`, `spark`/`ring`/
 *   `petal`) and a 120 ms model-local recoil (0.12 local units). A shot captures its geometry,
 *   scale and muzzle at spawn; the shared projectile/muzzle materials follow the equipped
 *   style's `color`/`accent`. `Shot.start` stays the ship anchor, `Shot.muzzle` is the visual
 *   origin, and only `model.group.position.z` moves — the outer group, camera and HUD never
 *   shake. Low tier / reduced motion suppress the flash and recoil.
 *
 * Reduced motion snaps to the pointer, hides the ignitions, clears the trail and yields
 * exact zero bank/pitch, pulse scale 1 and no fly-by.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Camera,
  DynamicDrawUsage,
  Group,
  Mesh,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';

import {
  SHOT_TRAVEL_MS,
  SPACESHIP_CURSOR_NDC_OFFSET_X,
  SPACESHIP_CURSOR_NDC_OFFSET_Y,
  SPACESHIP_FOLLOW_TAU_MS,
  SPACESHIP_IGNITION_FLICKER_PERIOD_MS,
  SPACESHIP_IGNITION_MOVEMENT_THRESHOLD,
  SPACESHIP_PLANE_DISTANCE,
  SPACESHIP_SCALE,
} from '../game/effects';
import { MOTION, easeInOutCubic, easeOutCubic } from '../game/motion';
import { type SlotId } from '../game/parts-v2';
import {
  normalizeAppearanceV3,
  shotStyleForPart,
  type ShotStyleDef,
} from '../game/parts-v3';
import {
  createCursorShipModel,
  type CursorShipModel,
  CURSOR_IGNITION_OPACITY,
} from './cursor-ship';
import {
  createShotGeometries,
  createShotMaterials,
  SHOT_MUZZLE_COLOR,
  SHOT_MUZZLE_OPACITY,
  SHOT_PROJECTILE_COLOR,
} from './shot-visuals';
import {
  shipBankRad,
  shipEquipPulseScale,
  shipIdleOffsetY,
  shipPitchRad,
  shipRollRad,
  shipVelocityPerMs,
} from './ship-motion';

/** Trail `Points` capacity: the 16-point fly-by fire trail (the normal trail uses 8). */
export const SPACESHIP_TRAIL_CAPACITY = MOTION.fireTrailCount;

/** World-space point size of one trail point. */
const TRAIL_POINT_SIZE = 0.12;

/** Warm exhaust colour of the trail. */
export const SPACESHIP_TRAIL_COLOR = 0xff8844;

/** Forward offset (local, unrotated group units) of the shot's visual origin. */
export const SHOT_MUZZLE_OFFSET = 0.78;

/** Lifetime of the additive muzzle flash in ms (`MOTION.shotMuzzleFlashMs`, 80). */
export const SHOT_MUZZLE_FLASH_MS = MOTION.shotMuzzleFlashMs;

/** Bolt colour: a warm white-hot tracer (the `shot-default` projectile colour). */
export const SHOT_BOLT_COLOR = SHOT_PROJECTILE_COLOR;

/** Muzzle-flash colour: a warmer amber than the bolt (the `shot-default` accent). */
export const SHOT_MUZZLE_FLASH_COLOR = SHOT_MUZZLE_COLOR;

/** Stable comparison key for one shot style (every catalog-derived field). */
function shotStyleSignatureOf(style: ShotStyleDef): string {
  return [
    style.partId,
    style.geometry,
    style.scale,
    style.muzzle,
    style.color,
    style.accent,
  ].join('|');
}

/** One in-flight shot: a glowing projectile travelling linearly from `muzzle` to `target`. */
export interface Shot {
  /**
   * The captured projectile mesh (`name === 'shot-<geometry>'`, so the default is
   * `shot-bolt`); its geometry/scale were captured at spawn.
   */
  readonly mesh: Mesh;
  /** The ship anchor captured at fire time (`spawnShot`'s `start`). */
  readonly start: Vector3;
  /** The bolt's visual origin: `start + rotate(group.quaternion, (0, 0, 0.78))`. */
  readonly muzzle: Vector3;
  /** Target position (the mini-cube's world origin), captured at fire time. */
  readonly target: Vector3;
  /** The muzzle-flash mesh (`name === 'shot-muzzle-flash'`); detached when suppressed. */
  readonly muzzleFlash: Mesh;
  /** Milliseconds remaining of the 80 ms muzzle flash (0 when suppressed/expired). */
  muzzleRemainingMs: number;
  /** Milliseconds remaining until arrival (180 ms). */
  remainingMs: number;
}

/**
 * Model-local recoil offset at `elapsedMs` after the shot (spec AC-6).
 *
 * `-0.12 · (1 − easeOutCubic(clamp01(elapsedMs / 120)))` for `0 ≤ elapsedMs < 120`, and
 * `0` otherwise (including a negative elapsed): `0 → -0.12`, `60 → -0.015`, `120 → 0`.
 */
export function shotRecoilOffsetAt(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= MOTION.shotRecoilMs) {
    return 0;
  }
  return (
    -MOTION.shotRecoilDistance *
    (1 - easeOutCubic(elapsedMs / MOTION.shotRecoilMs))
  );
}

/** The spaceship handle handed to the scene. */
export interface Spaceship {
  /** The outer group (`group.name === 'spaceship'`); 34 objects at high tier. */
  readonly group: Group;
  /** A separate group holding the in-flight shot meshes (added to the scene by the caller). */
  readonly shotsGroup: Group;
  /** The detailed 21-mesh cursor model (10 slot groups, 19 materials). */
  readonly model: CursorShipModel;
  /** The trail `Points` drawable (one draw). */
  readonly trailPoints: Points<BufferGeometry, PointsMaterial>;
  /** In-flight shots (delegated to by `SceneView.shots`). */
  readonly shots: readonly Shot[];
  /** Ignition flame meshes (length === SPACESHIP_IGNITION_COUNT, each name === 'ignition'). */
  readonly ignitions: readonly Mesh[];
  /** Follows the pointer for one frame. */
  update(
    camera: Camera,
    ndcX: number,
    ndcY: number,
    hasPointer: boolean,
    dtMs: number,
    reducedMotion: boolean,
  ): void;
  /** Convenience wrapper matching the plan's `updateSpaceship` shape. */
  updateSpaceship(
    dtMs: number,
    camera: Camera,
    pointerNdc: { readonly x: number; readonly y: number } | Vector3 | null,
    hasPointer: boolean,
    reducedMotion: boolean,
  ): void;
  /** Current spaceship position (a fresh clone). */
  getPosition(): Vector3;
  /** Current ignition intensity (0..1). */
  getIgnitionIntensity(): number;
  /** Current equip pulse scale (exactly 1 at rest/reduced/unchanged). */
  getPulseScale(): number;
  /** Number of live trail points (0 at rest, reduced motion, or trail disabled). */
  getTrailCount(): number;
  /** Spawns a shot from `start` to `target` and returns it. */
  spawnShot(start: Vector3, target: Vector3): Shot;
  /** Advances the shots; returns the shots that arrived this step. */
  updateShots(dtMs: number): Shot[];
  /** Applies a slot→part-id record; returns the slots that actually changed. */
  applyAppearance(appearance: Record<string, string>): readonly SlotId[];
  /**
   * Switches the equipped shot style (T10 AC-24): the next shot captures the style's
   * geometry/scale/muzzle, and the shared projectile/muzzle materials take the style's
   * `color`/`accent`. Repeating an identical style is a no-op.
   */
  applyShotStyle(style: ShotStyleDef): void;
  /** Starts the 700 ms/360° level-complete fly-by. */
  startFlyBy(): void;
  /** Whether a fly-by is running. */
  isFlyingBy(): boolean;
  /** Adaptive quality: renders the trail `Points` (clears it when disabled). */
  setTrailEnabled(enabled: boolean): void;
  /** Adaptive quality: drives bank/pitch/idle/equip pulse. */
  setCursorMotionEnabled(enabled: boolean): void;
  /** Adaptive quality: hides the named model meshes (empty restores all). */
  setHiddenMeshes(names: readonly string[]): void;
  /** Adaptive quality: enables the muzzle flash and recoil; the bolt always travels. */
  setShotFxEnabled(enabled: boolean): void;
  /** Live muzzle-flash meshes (1 per allowed shot for 80 ms; 0 when suppressed). */
  getMuzzleFlashCount(): number;
  /** The recoil offset currently applied to `model.group.position.z` (0 at rest). */
  getRecoilOffset(): number;
  /** Releases every geometry/material the spaceship and its shots own; idempotent. */
  dispose(): void;
}

/**
 * Follow factor for one frame (spaceship-cursor spec AC-2; this feature AC-5).
 *
 * Reduced motion snaps (factor 1) for any `dtMs >= 0`; otherwise `1 - exp(-dtMs / tau)`,
 * which is 0 at `dtMs === 0`.
 */
export function spaceshipFollowFactor(dtMs: number, reducedMotion: boolean): number {
  if (reducedMotion) {
    return 1;
  }
  return 1 - Math.exp(-dtMs / SPACESHIP_FOLLOW_TAU_MS);
}

/**
 * Target world position for the spaceship given the pointer NDC (spaceship-cursor spec AC-3).
 *
 * Unprojects the offset NDC at the camera's own projection and places the point
 * {@link SPACESHIP_PLANE_DISTANCE} world units along the resulting ray.
 */
export function spaceshipTargetPosition(camera: Camera, ndcX: number, ndcY: number): Vector3 {
  camera.updateMatrixWorld(true);
  const ndc = new Vector3(
    ndcX + SPACESHIP_CURSOR_NDC_OFFSET_X,
    ndcY + SPACESHIP_CURSOR_NDC_OFFSET_Y,
    0,
  );
  ndc.unproject(camera);
  const direction = ndc.sub(camera.position).normalize();
  return camera.position.clone().add(direction.multiplyScalar(SPACESHIP_PLANE_DISTANCE));
}

/** Mutable trail ring storage: preallocated arrays, no per-frame object allocation. */
interface TrailStore {
  readonly capacity: number;
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly z: Float64Array;
  readonly at: Float64Array;
  count: number;
}

function createTrailStore(capacity: number): TrailStore {
  return {
    capacity,
    x: new Float64Array(capacity),
    y: new Float64Array(capacity),
    z: new Float64Array(capacity),
    at: new Float64Array(capacity),
    count: 0,
  };
}

/**
 * Builds the cursor ship and its shot manager.
 *
 * @param appearance slot→part-id record (v3 ids; legacy categories and unknown/wrong-slot
 *   entries are normalized by `appearanceToShipParamsV3`, and a `shot` entry selects only the
 *   shot style).
 */
export function createSpaceship(appearance?: Record<string, string>): Spaceship {
  const group = new Group();
  group.name = 'spaceship';
  group.position.set(0, 0, 6);
  group.scale.set(SPACESHIP_SCALE, SPACESHIP_SCALE, SPACESHIP_SCALE);

  const model = createCursorShipModel();
  const trailStore = createTrailStore(SPACESHIP_TRAIL_CAPACITY);
  const trailPositions = new Float32Array(SPACESHIP_TRAIL_CAPACITY * 3);
  const trailGeometry = new BufferGeometry();
  const trailAttribute = new BufferAttribute(trailPositions, 3).setUsage(DynamicDrawUsage);
  trailGeometry.setAttribute('position', trailAttribute);
  trailGeometry.setDrawRange(0, 0);
  const trailMaterial = new PointsMaterial({
    color: SPACESHIP_TRAIL_COLOR,
    size: TRAIL_POINT_SIZE,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const trailPoints = new Points<BufferGeometry, PointsMaterial>(trailGeometry, trailMaterial);
  trailPoints.name = 'spaceship-trail';
  trailPoints.frustumCulled = false;
  trailPoints.renderOrder = 10;

  group.add(model.group, trailPoints);

  if (appearance !== undefined && Object.keys(appearance).length > 0) {
    model.applyAppearance(appearance);
  }

  const shotsGroup = new Group();
  shotsGroup.name = 'spaceship-shots';

  const shots: Shot[] = [];
  const ignitions = model.ignitions;

  const deltaScratch = new Vector3();
  const targetScratch = new Vector3();
  const previousPositionScratch = new Vector3();
  // Shot presentation (T10 AC-24): one prebuilt geometry set (four projectiles + three
  // muzzles) and one shared additive material per role, all created once. One mesh per shot
  // re-uses them — no geometry or material is created after construction.
  const shotGeometries = createShotGeometries();
  const shotMaterials = createShotMaterials();
  const projectileMaterial = shotMaterials.projectile;
  const muzzleMaterial = shotMaterials.muzzle;
  const shotForward = new Vector3(0, 0, 1);
  const shotDirection = new Vector3();

  let disposed = false;
  let timeMs = 0;
  let ignitionTimeMs = 0;
  let intensity = 0;
  let previousNdcX = 0;
  let previousNdcY = 0;
  let hasPreviousNdc = false;
  let reduced = false;
  let cursorMotionEnabled = true;
  let trailEnabled = true;
  let shotFxEnabled = true;
  let liveMuzzleFlashCount = 0;
  let recoilStartMs = Number.NEGATIVE_INFINITY;
  let recoilOffset = 0;
  let pulseStartMs = Number.NEGATIVE_INFINITY;
  let pulseScale = 1;

  // The equipped shot style. `shot-default` is the accepted bolt/spark look; a style change
  // only rewrites the shared material colours — geometry/scale/muzzle are captured at spawn.
  let currentShotStyle: ShotStyleDef = shotStyleForPart('shot-default');
  let shotStyleSignature = shotStyleSignatureOf(currentShotStyle);

  if (appearance !== undefined) {
    // Resolve defensively: an absent/unknown/wrong-slot `shot` entry falls back to
    // `shot-default` through the same v3 normalizer the model already used (never throws).
    applyShotStyle(resolveShotStyle(appearance));
  }

  let flyByActive = false;
  let flyByElapsedMs = 0;
  const flyByCenter = new Vector3();

  function getPosition(): Vector3 {
    return group.position.clone();
  }

  function getIgnitionIntensity(): number {
    return intensity;
  }

  function getPulseScale(): number {
    return pulseScale;
  }

  function getTrailCount(): number {
    return trailStore.count;
  }

  function trailLifetime(): number {
    return flyByActive ? MOTION.fireTrailMs : MOTION.trailLifetimeMs;
  }

  function trailLimit(): number {
    return flyByActive ? SPACESHIP_TRAIL_CAPACITY : MOTION.trailCount;
  }

  function pruneTrail(nowMs: number): void {
    const lifetime = trailLifetime();
    let drop = 0;
    while (drop < trailStore.count && nowMs - trailStore.at[drop]! >= lifetime) {
      drop += 1;
    }
    if (drop === 0) {
      return;
    }
    for (let index = drop; index < trailStore.count; index += 1) {
      const write = index - drop;
      trailStore.x[write] = trailStore.x[index]!;
      trailStore.y[write] = trailStore.y[index]!;
      trailStore.z[write] = trailStore.z[index]!;
      trailStore.at[write] = trailStore.at[index]!;
    }
    trailStore.count -= drop;
  }

  function pushTrail(x: number, y: number, z: number, nowMs: number): void {
    if (!trailEnabled || reduced) {
      return;
    }
    pruneTrail(nowMs);
    const limit = trailLimit();
    while (trailStore.count >= limit) {
      for (let index = 1; index < trailStore.count; index += 1) {
        trailStore.x[index - 1] = trailStore.x[index]!;
        trailStore.y[index - 1] = trailStore.y[index]!;
        trailStore.z[index - 1] = trailStore.z[index]!;
        trailStore.at[index - 1] = trailStore.at[index]!;
      }
      trailStore.count -= 1;
    }
    const slot = trailStore.count;
    trailStore.x[slot] = x;
    trailStore.y[slot] = y;
    trailStore.z[slot] = z;
    trailStore.at[slot] = nowMs;
    trailStore.count += 1;
  }

  function writeTrailBuffer(): void {
    const count = trailEnabled && !reduced ? trailStore.count : 0;
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3;
      trailPositions[offset] = trailStore.x[index]!;
      trailPositions[offset + 1] = trailStore.y[index]!;
      trailPositions[offset + 2] = trailStore.z[index]!;
    }
    trailGeometry.setDrawRange(0, count);
    trailAttribute.needsUpdate = true;
    trailPoints.visible = count > 0;
  }

  function resetIgnitions(): void {
    intensity = 0;
    for (const flame of ignitions) {
      flame.visible = false;
    }
  }

  /** Detaches every live muzzle flash (quality disable / reduced motion / teardown). */
  function clearMuzzleFlashes(): void {
    if (liveMuzzleFlashCount === 0) {
      return;
    }
    for (const shot of shots) {
      if (shot.muzzleRemainingMs > 0) {
        shot.muzzleRemainingMs = 0;
        shotsGroup.remove(shot.muzzleFlash);
      }
    }
    liveMuzzleFlashCount = 0;
  }

  /** Cancels the recoil and restores the model subgroup to its neutral z. */
  function resetRecoil(): void {
    recoilStartMs = Number.NEGATIVE_INFINITY;
    recoilOffset = 0;
    model.group.position.z = 0;
  }

  function updateIgnitions(dtMs: number, delta: number): void {
    if (reduced || dtMs <= 0 || delta < SPACESHIP_IGNITION_MOVEMENT_THRESHOLD) {
      resetIgnitions();
      return;
    }
    intensity = Math.min(1, Math.max(0, delta / SPACESHIP_IGNITION_MOVEMENT_THRESHOLD));
    ignitionTimeMs += Math.max(0, dtMs);
    for (const flame of ignitions) {
      flame.visible = true;
      const flicker = Math.abs(
        Math.sin((ignitionTimeMs / SPACESHIP_IGNITION_FLICKER_PERIOD_MS) * 2 * Math.PI),
      );
      flame.scale.z = 0.6 + 0.4 * flicker;
      (flame.material as { opacity: number }).opacity =
        CURSOR_IGNITION_OPACITY + (1 - CURSOR_IGNITION_OPACITY) * flicker;
    }
  }

  /** Normalizes an appearance record and resolves its shot style (`shot-default` fallback). */
  function resolveShotStyle(appearance: Record<string, string>): ShotStyleDef {
    return shotStyleForPart(normalizeAppearanceV3(appearance).shot ?? 'shot-default');
  }

  function applyShotStyle(style: ShotStyleDef): void {
    const signature = shotStyleSignatureOf(style);
    if (signature === shotStyleSignature) {
      return;
    }
    shotStyleSignature = signature;
    currentShotStyle = {
      partId: style.partId,
      geometry: style.geometry,
      scale: style.scale,
      muzzle: style.muzzle,
      color: style.color,
      accent: style.accent,
    };
    projectileMaterial.color.set(style.color);
    muzzleMaterial.color.set(style.accent);
  }

  function applyAppearance(appearance: Record<string, string>): readonly SlotId[] {
    const changed = model.applyAppearance(appearance);
    applyShotStyle(resolveShotStyle(appearance));
    if (changed.length > 0) {
      pulseStartMs = timeMs;
    }
    return changed;
  }

  function startFlyBy(): void {
    if (disposed) {
      return;
    }
    flyByActive = true;
    flyByElapsedMs = 0;
    // Continuous loop: the orbit centre sits one radius to the left of the current
    // position, so the ship starts and ends exactly where it was.
    flyByCenter.copy(group.position).addScaledVector(new Vector3(1, 0, 0), -MOTION.shipOrbitRadius);
    if (reduced) {
      flyByActive = false;
    }
  }

  function update(
    camera: Camera,
    ndcX: number,
    ndcY: number,
    hasPointer: boolean,
    dtMs: number,
    reducedMotion: boolean,
  ): void {
    if (disposed) {
      return;
    }
    reduced = reducedMotion;
    const advanceMs = dtMs > 0 ? dtMs : 0;
    timeMs += advanceMs;
    // Expire old trail points on every frame, even when the ship is at rest.
    pruneTrail(timeMs);

    if (reduced) {
      if (flyByActive) {
        // A reduced-motion switch cancels the fly-by and restores the loop's start pose.
        flyByActive = false;
        flyByElapsedMs = 0;
        group.position.copy(flyByCenter);
        group.position.x += MOTION.shipOrbitRadius;
        group.rotation.set(0, 0, 0);
      }
      trailStore.count = 0;
      writeTrailBuffer();
      // Reduced motion is authoritative for the shot reaction: no flash, no recoil.
      clearMuzzleFlashes();
      resetRecoil();
    }

    if (!hasPointer) {
      resetIgnitions();
      group.rotation.set(0, 0, 0);
      model.group.rotation.set(0, 0, 0);
      model.group.position.set(0, 0, 0);
      resetRecoil();
      applyPulse();
      hasPreviousNdc = false;
      writeTrailBuffer();
      return;
    }

    const target = spaceshipTargetPosition(camera, ndcX, ndcY);
    targetScratch.copy(target);
    const deltaX = hasPreviousNdc ? ndcX - previousNdcX : 0;
    const deltaY = hasPreviousNdc ? ndcY - previousNdcY : 0;
    previousNdcX = ndcX;
    previousNdcY = ndcY;
    hasPreviousNdc = true;

    if (flyByActive) {
      flyByElapsedMs += advanceMs;
      const progress = Math.min(1, flyByElapsedMs / MOTION.shipRollMs);
      const angle = 2 * Math.PI * easeInOutCubic(progress);
      group.position.set(
        flyByCenter.x + Math.cos(angle) * MOTION.shipOrbitRadius,
        flyByCenter.y + Math.sin(angle) * MOTION.shipOrbitRadius,
        flyByCenter.z,
      );
      group.rotation.set(0, 0, shipRollRad(flyByElapsedMs, reducedMotion));
      model.group.position.set(0, 0, 0);
      model.group.rotation.set(0, 0, 0);
      resetRecoil();
      pushTrail(group.position.x, group.position.y, group.position.z, timeMs);
      writeTrailBuffer();
      if (progress >= 1) {
        // The full turn is complete: hand the cursor back to pointer-follow in the
        // neutral pose on the frame the fly-by ends.
        flyByActive = false;
        flyByElapsedMs = 0;
        group.rotation.set(0, 0, 0);
      }
      return;
    }

    const factor = spaceshipFollowFactor(dtMs, reducedMotion);
    previousPositionScratch.copy(group.position);
    group.position.lerp(targetScratch, factor);
    const delta = deltaScratch.copy(group.position).sub(previousPositionScratch).length();

    const vx = shipVelocityPerMs(deltaX, dtMs);
    const vy = shipVelocityPerMs(deltaY, dtMs);
    if (cursorMotionEnabled && !reducedMotion) {
      group.rotation.z = shipBankRad(vx, false);
      group.rotation.x = shipPitchRad(vy, false);
      model.group.rotation.set(0, 0, 0);
    } else {
      group.rotation.set(0, 0, 0);
      model.group.rotation.set(0, 0, 0);
    }

    if (!reducedMotion && cursorMotionEnabled) {
      model.group.position.y = shipIdleOffsetY(timeMs, false);
    } else {
      model.group.position.y = 0;
    }
    // The recoil is a model-local z offset (never the camera/HUD/outer group): 0.12 local
    // units over 120 ms, applied only when the shot layer is enabled and motion is allowed.
    recoilOffset = shotFxEnabled && !reduced ? shotRecoilOffsetAt(timeMs - recoilStartMs) : 0;
    model.group.position.z = recoilOffset;

    applyPulse();
    updateIgnitions(dtMs, delta);
    if (delta > 0) {
      pushTrail(group.position.x, group.position.y, group.position.z, timeMs);
    }
    writeTrailBuffer();
  }

  function applyPulse(): void {
    if (!cursorMotionEnabled || reduced) {
      pulseScale = 1;
    } else {
      pulseScale = shipEquipPulseScale(timeMs - pulseStartMs, false);
    }
    // The model multiplies its equipped chassis by the pulse (T9 API); never overwrite the
    // chassis with a scalar (AC-17/R12).
    model.applyPulseScale(pulseScale);
  }

  function updateSpaceship(
    dtMs: number,
    camera: Camera,
    pointerNdc: { readonly x: number; readonly y: number } | Vector3 | null,
    hasPointer: boolean,
    reducedMotion: boolean,
  ): void {
    const ndcX = pointerNdc === null ? 0 : pointerNdc.x;
    const ndcY = pointerNdc === null ? 0 : pointerNdc.y;
    update(camera, ndcX, ndcY, hasPointer, dtMs, reducedMotion);
  }

  function spawnShot(start: Vector3, target: Vector3): Shot {
    // `Shot.muzzle` is the bolt's real origin: the anchor plus the local forward offset
    // rotated by the ship's current bank/pitch (scale is deliberately not applied).
    const muzzle = new Vector3(0, 0, SHOT_MUZZLE_OFFSET)
      .applyQuaternion(group.quaternion)
      .add(start);
    // Capture the equipped style at spawn (AC-24): an in-flight shot keeps its geometry,
    // scale and muzzle form even if the owner equips another style before it lands.
    const style = currentShotStyle;
    const mesh = new Mesh(shotGeometries.projectiles[style.geometry], projectileMaterial);
    mesh.name = `shot-${style.geometry}`;
    mesh.position.copy(muzzle);
    mesh.scale.setScalar(style.scale);
    shotDirection.copy(target).sub(muzzle);
    if (shotDirection.lengthSq() > 1e-12) {
      shotDirection.normalize();
      mesh.quaternion.setFromUnitVectors(shotForward, shotDirection);
    }

    const muzzleFlash = new Mesh(shotGeometries.muzzles[style.muzzle], muzzleMaterial);
    muzzleFlash.name = 'shot-muzzle-flash';
    muzzleFlash.position.copy(muzzle);
    muzzleFlash.quaternion.copy(mesh.quaternion);

    const flashEnabled = shotFxEnabled && !reduced;
    if (flashEnabled) {
      muzzleFlash.scale.setScalar(1);
      muzzleMaterial.opacity = SHOT_MUZZLE_OPACITY;
      shotsGroup.add(muzzleFlash);
      liveMuzzleFlashCount += 1;
      recoilStartMs = timeMs;
    }

    const shot: Shot = {
      mesh,
      start: start.clone(),
      muzzle,
      target: target.clone(),
      muzzleFlash,
      muzzleRemainingMs: flashEnabled ? SHOT_MUZZLE_FLASH_MS : 0,
      remainingMs: SHOT_TRAVEL_MS,
    };
    shots.push(shot);
    shotsGroup.add(mesh);
    return shot;
  }

  function updateShots(dtMs: number): Shot[] {
    if (disposed) {
      return [];
    }
    const advance = Math.max(0, dtMs);
    const completed: Shot[] = [];
    for (let index = shots.length - 1; index >= 0; index -= 1) {
      const shot = shots[index]!;
      shot.remainingMs = Math.max(0, shot.remainingMs - advance);
      const elapsed = SHOT_TRAVEL_MS - shot.remainingMs;
      const t = SHOT_TRAVEL_MS > 0 ? elapsed / SHOT_TRAVEL_MS : 1;
      shot.mesh.position.copy(shot.muzzle).lerp(shot.target, t);
      if (shot.muzzleRemainingMs > 0) {
        shot.muzzleRemainingMs = Math.max(0, shot.muzzleRemainingMs - advance);
        const flashElapsed = SHOT_MUZZLE_FLASH_MS - shot.muzzleRemainingMs;
        const flashProgress =
          SHOT_MUZZLE_FLASH_MS > 0 ? flashElapsed / SHOT_MUZZLE_FLASH_MS : 1;
        shot.muzzleFlash.scale.setScalar(1 + 0.4 * easeOutCubic(flashProgress));
        muzzleMaterial.opacity = SHOT_MUZZLE_OPACITY * (1 - flashProgress);
        if (shot.muzzleRemainingMs <= 0) {
          shotsGroup.remove(shot.muzzleFlash);
          liveMuzzleFlashCount -= 1;
        }
      }
      if (shot.remainingMs <= 0) {
        shot.mesh.position.copy(shot.target);
        if (shot.muzzleRemainingMs > 0) {
          // Defensive: an arrival can never precede the 80 ms flash at the pinned 180 ms
          // travel, but a future shortened travel must not leak a live flash.
          shot.muzzleRemainingMs = 0;
          shotsGroup.remove(shot.muzzleFlash);
          liveMuzzleFlashCount -= 1;
        }
        shots.splice(index, 1);
        shotsGroup.remove(shot.mesh);
        completed.push(shot);
      }
    }
    return completed;
  }

  function setTrailEnabled(enabled: boolean): void {
    trailEnabled = enabled;
    if (!enabled) {
      trailStore.count = 0;
    }
    writeTrailBuffer();
  }

  function setCursorMotionEnabled(enabled: boolean): void {
    cursorMotionEnabled = enabled;
    if (!enabled) {
      group.rotation.set(0, 0, 0);
      model.group.position.set(0, 0, 0);
      model.group.rotation.set(0, 0, 0);
      pulseScale = 1;
      model.applyPulseScale(1);
    }
  }

  function setHiddenMeshes(names: readonly string[]): void {
    const hidden = new Set(names);
    for (const mesh of model.meshes) {
      mesh.visible = !hidden.has(mesh.name);
    }
  }

  function setShotFxEnabled(enabled: boolean): void {
    shotFxEnabled = enabled;
    if (!enabled) {
      clearMuzzleFlashes();
      resetRecoil();
    }
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    shots.length = 0;
    liveMuzzleFlashCount = 0;
    shotsGroup.clear();
    resetRecoil();
    trailStore.count = 0;
    group.clear();
    model.dispose();
    trailGeometry.dispose();
    trailMaterial.dispose();
    shotGeometries.dispose();
    projectileMaterial.dispose();
    muzzleMaterial.dispose();
  }

  const handle: Spaceship = {
    group,
    shotsGroup,
    model,
    trailPoints,
    get shots(): readonly Shot[] {
      return shots;
    },
    ignitions,
    update,
    updateSpaceship,
    getPosition,
    getIgnitionIntensity,
    getPulseScale,
    getTrailCount,
    spawnShot,
    updateShots,
    applyAppearance,
    applyShotStyle,
    startFlyBy,
    isFlyingBy: () => flyByActive,
    setTrailEnabled,
    setCursorMotionEnabled,
    setHiddenMeshes,
    setShotFxEnabled,
    getMuzzleFlashCount: () => liveMuzzleFlashCount,
    getRecoilOffset: () => recoilOffset,
    dispose,
  };

  return handle;
}
