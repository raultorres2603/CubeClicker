/**
 * Spaceship cursor — the spaceship group, its in-flight shots and the pure follow/target
 * helpers (spaceship-cursor spec AC-2, AC-3; plan § 2).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. The module
 * exports pure, deterministic helpers ({@link spaceshipFollowFactor},
 * {@link spaceshipTargetPosition}) plus a factory {@link createSpaceship} that owns the
 * spaceship mesh group and the shot list.
 */

import {
  BoxGeometry,
  Camera,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';

import {
  SHOT_TRAVEL_MS,
  SPACESHIP_CURSOR_NDC_OFFSET_X,
  SPACESHIP_CURSOR_NDC_OFFSET_Y,
  SPACESHIP_FOLLOW_TAU_MS,
  SPACESHIP_IGNITION_COUNT,
  SPACESHIP_IGNITION_FLICKER_PERIOD_MS,
  SPACESHIP_IGNITION_MOVEMENT_THRESHOLD,
  SPACESHIP_PLANE_DISTANCE,
  SPACESHIP_SCALE,
} from '../game/effects';
import { appearanceToSpaceshipParams, type SpaceshipVisualParams } from '../game/parts';

/** One in-flight shot: a small sphere travelling linearly from `start` to `target`. */
export interface Shot {
  /** The shot's mesh (a small sphere). */
  readonly mesh: Mesh;
  /** Start position, captured at fire time. */
  start: Vector3;
  /** Target position (the mini-cube's world origin), captured at fire time. */
  target: Vector3;
  /** Milliseconds remaining until arrival. */
  remainingMs: number;
}

/** The spaceship handle handed to the scene. */
export interface Spaceship {
  /** The spaceship group (`group.name === 'spaceship'`). */
  readonly group: Group;
  /** A separate group holding the in-flight shot meshes (added to the scene by the caller). */
  readonly shotsGroup: Group;
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
  /** Convenience wrapper matching the plan's `updateSpaceship(dtMs, camera, pointerNdc, …)` shape. */
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
  /** Spawns a shot from `start` to `target` and returns it. */
  spawnShot(start: Vector3, target: Vector3): Shot;
  /** Advances the shots; returns the shots that arrived this step. */
  updateShots(dtMs: number): Shot[];
  /** Releases every geometry/material the spaceship and its shots own. */
  dispose(): void;
}

/**
 * Follow factor for one frame (spaceship-cursor spec AC-2).
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

function resolveSpaceshipAppearance(
  input: Record<string, string> | Partial<SpaceshipVisualParams> | undefined,
): SpaceshipVisualParams {
  if (input === undefined) {
    return appearanceToSpaceshipParams({});
  }
  const colorKeys: Array<keyof SpaceshipVisualParams> = [
    'noseColor',
    'bodyColor',
    'wingColor',
    'cockpitColor',
    'engineColor',
  ];
  const hasColorKey = colorKeys.some((key) =>
    Object.prototype.hasOwnProperty.call(input, key),
  );
  if (hasColorKey) {
    const defaults = appearanceToSpaceshipParams({});
    const record = input as Partial<SpaceshipVisualParams>;
    return {
      noseColor: record.noseColor ?? defaults.noseColor,
      bodyColor: record.bodyColor ?? defaults.bodyColor,
      wingColor: record.wingColor ?? defaults.wingColor,
      cockpitColor: record.cockpitColor ?? defaults.cockpitColor,
      engineColor: record.engineColor ?? defaults.engineColor,
    };
  }
  return appearanceToSpaceshipParams(input as Record<string, string>);
}

/** Builds the spaceship (cone nose + cylinder body + sphere cockpit) and its shot manager. */
export function createSpaceship(
  appearance?: Record<string, string> | Partial<SpaceshipVisualParams>,
): Spaceship {
  const params = resolveSpaceshipAppearance(appearance);

  const group = new Group();
  group.name = 'spaceship';
  group.position.set(0, 0, 6);
  group.scale.set(SPACESHIP_SCALE, SPACESHIP_SCALE, SPACESHIP_SCALE);

  const nose = new Mesh(
    new ConeGeometry(0.2, 0.8, 8),
    new MeshStandardMaterial({ color: params.noseColor, metalness: 0.5, roughness: 0.5 }),
  );
  nose.position.set(0, 0, 0.4);
  nose.rotation.x = Math.PI / 2;

  const body = new Mesh(
    new CylinderGeometry(0.25, 0.25, 0.9, 8),
    new MeshStandardMaterial({ color: params.bodyColor, metalness: 0.5, roughness: 0.5 }),
  );
  body.rotation.x = Math.PI / 2;

  const cockpit = new Mesh(
    new SphereGeometry(0.15, 8, 8),
    new MeshStandardMaterial({ color: params.cockpitColor, metalness: 0.5, roughness: 0.5 }),
  );
  cockpit.position.set(0, 0.15, 0.1);

  // Fighter wings.
  for (let i = 0; i < 2; i += 1) {
    const wing = new Mesh(
      new BoxGeometry(0.6, 0.05, 0.3),
      new MeshStandardMaterial({ color: params.wingColor, metalness: 0.5, roughness: 0.5 }),
    );
    wing.name = 'wing';
    const side = i === 0 ? 1 : -1;
    wing.position.set(side * 0.35, 0, 0);
    group.add(wing);
  }

  group.add(nose, body, cockpit);

  // Ignition flames at the rear.
  const ignitions: Mesh[] = [];
  for (let i = 0; i < SPACESHIP_IGNITION_COUNT; i += 1) {
    const ignition = new Mesh(
      new ConeGeometry(0.12, 0.35, 8),
      new MeshStandardMaterial({
        color: params.engineColor,
        transparent: true,
        opacity: 0.5,
        emissive: params.engineColor,
        metalness: 0.5,
        roughness: 0.5,
      }),
    );
    ignition.name = 'ignition';
    ignition.visible = false;
    const offset = (i - (SPACESHIP_IGNITION_COUNT - 1) / 2) * 0.25;
    ignition.position.set(offset, 0, -0.6);
    ignition.rotation.x = -Math.PI / 2;
    group.add(ignition);
    ignitions.push(ignition);
  }

  const shotsGroup = new Group();
  shotsGroup.name = 'spaceship-shots';

  const shots: Shot[] = [];
  let disposed = false;

  let ignitionTimeMs = 0;
  let intensity = 0;

  function getPosition(): Vector3 {
    return group.position.clone();
  }

  function getIgnitionIntensity(): number {
    return intensity;
  }

  function spawnShot(start: Vector3, target: Vector3): Shot {
    const mesh = new Mesh(
      new SphereGeometry(0.08, 8, 8),
      new MeshBasicMaterial({ color: 0xffff66 }),
    );
    mesh.position.copy(start);
    const shot: Shot = {
      mesh,
      start: start.clone(),
      target: target.clone(),
      remainingMs: SHOT_TRAVEL_MS,
    };
    shots.push(shot);
    shotsGroup.add(mesh);
    return shot;
  }

  function resetIgnitions(): void {
    intensity = 0;
    for (const flame of ignitions) {
      flame.visible = false;
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
    if (!hasPointer) {
      resetIgnitions();
      return;
    }
    const target = spaceshipTargetPosition(camera, ndcX, ndcY);
    const previous = group.position.clone();
    const factor = spaceshipFollowFactor(dtMs, reducedMotion);
    group.position.lerp(target, factor);
    const delta = group.position.distanceTo(previous);

    // Reset baseline: flames never linger after a prior moving update.
    resetIgnitions();

    // Early-return: no time advance, no intensity.
    if (reducedMotion || dtMs <= 0 || delta < SPACESHIP_IGNITION_MOVEMENT_THRESHOLD) {
      return;
    }

    intensity = Math.min(1, Math.max(0, delta / SPACESHIP_IGNITION_MOVEMENT_THRESHOLD));
    ignitionTimeMs += Math.max(0, dtMs);
    for (const flame of ignitions) {
      flame.visible = true;
      const s = Math.abs(Math.sin((ignitionTimeMs / SPACESHIP_IGNITION_FLICKER_PERIOD_MS) * 2 * Math.PI));
      flame.scale.z = 0.6 + 0.4 * s;
      const material = flame.material as MeshStandardMaterial;
      material.opacity = 0.5 + 0.5 * s;
    }
  }

  function updateSpaceship(
    dtMs: number,
    camera: Camera,
    pointerNdc: { readonly x: number; readonly y: number } | Vector3 | null,
    hasPointer: boolean,
    reducedMotion: boolean,
  ): void {
    const ndcX = pointerNdc === null ? 0 : (pointerNdc as { x: number }).x;
    const ndcY = pointerNdc === null ? 0 : (pointerNdc as { y: number }).y;
    update(camera, ndcX, ndcY, hasPointer, dtMs, reducedMotion);
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
      shot.mesh.position.copy(shot.start).lerp(shot.target, t);
      if (shot.remainingMs <= 0) {
        shot.mesh.position.copy(shot.target);
        shots.splice(index, 1);
        shotsGroup.remove(shot.mesh);
        shot.mesh.geometry.dispose();
        const material = shot.mesh.material;
        if (Array.isArray(material)) {
          for (const m of material) m.dispose();
        } else {
          material.dispose();
        }
        completed.push(shot);
      }
    }
    return completed;
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    for (const shot of [...shots]) {
      shotsGroup.remove(shot.mesh);
      shot.mesh.geometry.dispose();
      const material = shot.mesh.material;
      if (Array.isArray(material)) {
        for (const m of material) m.dispose();
      } else {
        material.dispose();
      }
    }
    shots.length = 0;
    group.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) {
          for (const m of material) m.dispose();
        } else {
          material.dispose();
        }
      }
    });
    group.clear();
    shotsGroup.clear();
  }

  const handle: Spaceship = {
    group,
    shotsGroup,
    get shots(): readonly Shot[] {
      return shots;
    },
    ignitions,
    update,
    updateSpaceship,
    getPosition,
    getIgnitionIntensity,
    spawnShot,
    updateShots,
    dispose,
  };

  return handle;
}
