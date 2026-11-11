/**
 * Pop impact debris (T9; spec AC-37; plan § Picking / targeting / impact / banner).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. One pop
 * starts the single pooled drawable this module owns:
 *
 * - 14 green shards (`DEBRIS_POOL_CAP = 42`, one `InstancedMesh` named `impact-shards`):
 *   speed 1.8–3.6, drag 2 s⁻¹, gravity 6, angular 3–8 rad/s, lifetime 1200 ms.
 *
 * The pool recycles its oldest shard first, writes instance matrices only and creates no
 * geometry/material/object after construction. The scene owns the mapping from the adaptive
 * quality tier to the per-pop shard count via {@link ImpactEffects.setFeatures}.
 */

import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';

import { MOTION } from '../game/motion';

/** Active green shards: 42. */
export const DEBRIS_POOL_CAP = MOTION.debrisPoolCap;

/** Maximum shards per pop (high tier). */
export const DEBRIS_PER_POP = MOTION.debrisPerPop;

/** Effect counts the scene sets from the adaptive quality tier. */
export interface ImpactFeatures {
  /** Shards per pop (0/7/14). */
  readonly shards: number;
}

/** The impact handle handed to the scene. */
export interface ImpactEffects {
  /** Group holding exactly one `InstancedMesh` named `impact-shards`. */
  readonly group: Group;
  /** Starts one pop at `origin` with outward `normal`; `nowMs` orders recycling. */
  spawnPop(origin: Vector3, normal: Vector3, nowMs: number): void;
  /** Advances the shards, writes their matrices and recycles expired debris. */
  update(dtMs: number): void;
  /** Active shard count. */
  activeCounts(): { shards: number };
  /** Applies the per-tier shard count. */
  setFeatures(features: ImpactFeatures): void;
  /** Releases the one geometry and material exactly once; idempotent. */
  dispose(): void;
}

interface Shard {
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly axis: Vector3;
  angle: number;
  readonly angularSpeed: number;
  readonly spawnedAtMs: number;
  elapsedMs: number;
}

/** Writes a scale-only instance matrix with a quaternion and position (no allocation). */
function writeInstance(
  mesh: InstancedMesh,
  index: number,
  position: Vector3,
  quaternion: Quaternion,
  scale: Vector3,
  scratch: Matrix4,
): void {
  scratch.compose(position, quaternion, scale);
  mesh.setMatrixAt(index, scratch);
}

/**
 * Builds the impact system.
 *
 * @param random source for shard directions, speeds and spins; deterministic.
 */
export function createImpactEffects(random: () => number): ImpactEffects {
  const group = new Group();
  group.name = 'impact-effects';

  // Shards: small green beveled cubes.
  const shardGeometry = new BoxGeometry(0.09, 0.09, 0.09);
  const shardMaterial = new MeshStandardMaterial({
    color: 0x44cc88,
    metalness: 0.2,
    roughness: 0.5,
  });
  const shardMesh = new InstancedMesh(shardGeometry, shardMaterial, DEBRIS_POOL_CAP);
  shardMesh.name = 'impact-shards';
  shardMesh.count = 0;
  shardMesh.frustumCulled = false;

  group.add(shardMesh);

  const shards: Shard[] = [];

  let features: ImpactFeatures = { shards: DEBRIS_PER_POP };

  const scratchMatrix = new Matrix4();
  const scratchPosition = new Vector3();
  const scratchScale = new Vector3();
  const scratchQuaternion = new Quaternion();
  const scratchDirection = new Vector3();
  const normalScratch = new Vector3();
  let disposed = false;

  /** Normalises `normal` into the scratch surface normal, defaulting a zero vector to +z. */
  function surfaceNormal(normal: Vector3): void {
    normalScratch.copy(normal);
    if (normalScratch.lengthSq() < 1e-12) {
      normalScratch.set(0, 0, 1);
    } else {
      normalScratch.normalize();
    }
  }

  function randomUnit(out: Vector3): Vector3 {
    const x = random() * 2 - 1;
    const y = random() * 2 - 1;
    const z = random() * 2 - 1;
    const length = Math.sqrt(x * x + y * y + z * z);
    if (length < 1e-6) {
      return out.set(0, 0, 1);
    }
    return out.set(x / length, y / length, z / length);
  }

  function clampCount(value: number, max: number): number {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.min(max, Math.max(0, Math.floor(value)));
  }

  function setFeatures(next: ImpactFeatures): void {
    features = { shards: clampCount(next.shards, DEBRIS_PER_POP) };
  }

  function writeShards(): void {
    for (let index = 0; index < shards.length; index += 1) {
      const shard = shards[index]!;
      scratchQuaternion.setFromAxisAngle(shard.axis, shard.angle);
      scratchScale.set(1, 1, 1);
      writeInstance(shardMesh, index, shard.position, scratchQuaternion, scratchScale, scratchMatrix);
    }
    shardMesh.count = shards.length;
    shardMesh.instanceMatrix.needsUpdate = true;
  }

  function spawnPop(origin: Vector3, normal: Vector3, nowMs: number): void {
    if (disposed) {
      return;
    }
    surfaceNormal(normal);
    const base = scratchPosition.copy(origin).addScaledVector(normalScratch, 0.02).clone();

    if (features.shards > 0) {
      for (let index = 0; index < features.shards; index += 1) {
        if (shards.length >= DEBRIS_POOL_CAP) {
          let oldest = 0;
          for (let scan = 1; scan < shards.length; scan += 1) {
            if (shards[scan]!.spawnedAtMs < shards[oldest]!.spawnedAtMs) {
              oldest = scan;
            }
          }
          shards.splice(oldest, 1);
        }
        const direction = randomUnit(scratchDirection);
        const speed =
          MOTION.debrisSpeedMin + random() * (MOTION.debrisSpeedMax - MOTION.debrisSpeedMin);
        const axis = randomUnit(new Vector3());
        shards.push({
          position: base.clone().addScaledVector(direction, 0.05),
          velocity: direction.clone().multiplyScalar(speed),
          axis,
          angle: 0,
          angularSpeed:
            MOTION.debrisAngularMin +
            random() * (MOTION.debrisAngularMax - MOTION.debrisAngularMin),
          spawnedAtMs: nowMs,
          elapsedMs: 0,
        });
      }
    }

    writeShards();
  }

  function update(dtMs: number): void {
    if (disposed) {
      return;
    }
    const advance = Math.max(0, dtMs);
    const seconds = advance / 1000;
    const drag = Math.exp(-MOTION.debrisDragPerS * seconds);

    for (let index = shards.length - 1; index >= 0; index -= 1) {
      const shard = shards[index]!;
      shard.elapsedMs += advance;
      if (shard.elapsedMs >= MOTION.debrisLifetimeMs) {
        shards.splice(index, 1);
        continue;
      }
      shard.velocity.y -= MOTION.debrisGravity * seconds;
      shard.velocity.multiplyScalar(drag);
      shard.position.addScaledVector(shard.velocity, seconds);
      shard.angle += shard.angularSpeed * seconds;
    }
    writeShards();
  }

  function activeCounts(): { shards: number } {
    return { shards: shards.length };
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    shards.length = 0;
    group.clear();
    shardGeometry.dispose();
    shardMaterial.dispose();
  }

  return { group, spawnPop, update, activeCounts, setFeatures, dispose };
}
