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
  SPACESHIP_PLANE_DISTANCE,
} from '../game/effects';

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

/** Builds the spaceship (cone nose + box body + sphere cockpit) and its shot manager. */
export function createSpaceship(): Spaceship {
  const group = new Group();
  group.name = 'spaceship';
  group.position.set(0, 0, 6);

  const nose = new Mesh(
    new ConeGeometry(0.25, 0.6, 8),
    new MeshStandardMaterial({ color: 0x88aaff }),
  );
  nose.position.set(0, 0, 0.3);
  nose.rotation.x = Math.PI / 2;

  const body = new Mesh(
    new BoxGeometry(0.4, 0.3, 0.8),
    new MeshStandardMaterial({ color: 0x4466cc }),
  );

  const cockpit = new Mesh(
    new SphereGeometry(0.15, 8, 8),
    new MeshStandardMaterial({ color: 0xffffff }),
  );
  cockpit.position.set(0, 0.15, 0.1);

  group.add(nose, body, cockpit);

  const shotsGroup = new Group();
  shotsGroup.name = 'spaceship-shots';

  const shots: Shot[] = [];
  let disposed = false;

  function getPosition(): Vector3 {
    return group.position.clone();
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

  function update(
    camera: Camera,
    ndcX: number,
    ndcY: number,
    hasPointer: boolean,
    dtMs: number,
    reducedMotion: boolean,
  ): void {
    if (disposed || !hasPointer) {
      return;
    }
    const target = spaceshipTargetPosition(camera, ndcX, ndcY);
    const factor = spaceshipFollowFactor(dtMs, reducedMotion);
    group.position.lerp(target, factor);
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
    update,
    updateSpaceship,
    getPosition,
    spawnShot,
    updateShots,
    dispose,
  };

  return handle;
}