/**
 * Pop impact effects (T9; spec AC-37, AC-38; plan § Picking / targeting / impact / banner).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. One pop
 * starts four pooled drawables, all inside this module's group:
 *
 * - a 12-ray tapered gold fan (`RAY_POOL_CAP = 3` active fans, 36 instances, one
 *   `InstancedMesh`): grow 80 ms, hold 100 ms, fade 270 ms, total 450 ms;
 * - 14 green shards (`DEBRIS_POOL_CAP = 42`, one `InstancedMesh`): speed 1.8–3.6,
 *   drag 2 s⁻¹, gravity 6, angular 3–8 rad/s, lifetime 1200 ms;
 * - 6 gold coin discs (`COIN_POOL_CAP = 18`, one `InstancedMesh`): speed 0.8–1.2,
 *   spin, lifetime 1000 ms;
 * - one ring shockwave (`RING_POOL_CAP = 3`, one prebuilt merged geometry + one additive
 *   material): grow 1 → 5 over 330 ms with `easeOutQuad`, fade over 150 ms, visible 480 ms;
 *   reduced motion uses a static 120 ms opacity flash at the final scale.
 *
 * Every pool recycles its oldest entry first, writes instance matrices only, and creates
 * no geometry/material/object after construction. The scene owns the mapping from the
 * adaptive quality tier to per-pop counts via {@link ImpactEffects.setFeatures}.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { REFERENCE_PIXEL_WORLD } from '../game/effects';
import { MOTION, clamp01, easeOutQuad, easeOutQuint } from '../game/motion';

/** Active ray fans: 3 (each fan draws up to 12 rays). */
export const RAY_POOL_CAP = 3;

/** Maximum ray count per fan (high tier). */
export const RAYS_PER_POP = MOTION.rayCount;

/** Active green shards: 42. */
export const DEBRIS_POOL_CAP = MOTION.debrisPoolCap;

/** Maximum shards per pop (high tier). */
export const DEBRIS_PER_POP = MOTION.debrisPerPop;

/** Active gold coins: 18. */
export const COIN_POOL_CAP = MOTION.coinPoolCap;

/** Maximum coins per pop (high tier). */
export const COINS_PER_POP = MOTION.coinsPerPop;

/** Ring pool size: exactly 3 instances of one prebuilt geometry. */
export const RING_POOL_CAP = 3;

/** Reduced-motion ring flash duration (AC-38/AC-48). */
export const REDUCED_RING_FLASH_MS = 120;

/** Short ray length: 90 px-equivalent. */
export const RAY_LENGTH_MIN = 90 * REFERENCE_PIXEL_WORLD;

/** Long ray length: 160 px-equivalent. */
export const RAY_LENGTH_MAX = 160 * REFERENCE_PIXEL_WORLD;

/** Effect counts the scene sets from the adaptive quality tier. */
export interface ImpactFeatures {
  /** Rays per pop (0/6/12). */
  readonly rays: number;
  /** Shards per pop (0/7/14). */
  readonly shards: number;
  /** Coins per pop (0/3/6). */
  readonly coins: number;
  /** Ring expansion (false → reduced-motion 120 ms static flash). */
  readonly shockwaveExpand: boolean;
}

/** The impact handle handed to the scene. */
export interface ImpactEffects {
  /** Group holding exactly four `InstancedMesh` drawables. */
  readonly group: Group;
  /** Starts one pop at `origin` with outward `normal`; `nowMs` orders recycling. */
  spawnPop(origin: Vector3, normal: Vector3, nowMs: number): void;
  /** Advances every pool, writes matrices/colours and recycles expired effects. */
  update(dtMs: number): void;
  /** Active counts of each pool (rays count individual ray instances). */
  activeCounts(): { rays: number; shards: number; coins: number; rings: number };
  /** Applies the per-tier counts and the reduced-motion ring mode. */
  setFeatures(features: ImpactFeatures): void;
  /** Releases the four geometries and materials exactly once; idempotent. */
  dispose(): void;
}

interface RayFan {
  readonly origin: Vector3;
  readonly normal: Vector3;
  /** Unit directions for the rays actually played by this fan. */
  readonly directions: Vector3[];
  /** Alternating 90/160 px-equivalent lengths for the played rays. */
  readonly lengths: number[];
  readonly spawnedAtMs: number;
  elapsedMs: number;
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

interface Coin {
  readonly position: Vector3;
  readonly velocity: Vector3;
  readonly axis: Vector3;
  angle: number;
  readonly angularSpeed: number;
  readonly spawnedAtMs: number;
  elapsedMs: number;
}

interface Ring {
  readonly origin: Vector3;
  readonly orientation: Quaternion;
  readonly spawnedAtMs: number;
  elapsedMs: number;
}

/** Builds the 32-segment ring with eight baked radial spokes and four satellite rings. */
function createRingGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [new RingGeometry(0.92, 1, 32)];
  for (let index = 0; index < 8; index += 1) {
    const spoke = new BoxGeometry(2, 0.035, 0.02);
    spoke.rotateZ((index * Math.PI) / 4);
    parts.push(spoke);
  }
  for (let index = 0; index < 4; index += 1) {
    const angle = (index * Math.PI) / 2 + Math.PI / 4;
    const satellite = new RingGeometry(0.12, 0.17, 16);
    satellite.translate(Math.cos(angle) * 1.35, Math.sin(angle) * 1.35, 0);
    parts.push(satellite);
  }
  const merged = mergeGeometries(parts, false);
  if (merged === null) {
    throw new Error('failed to merge the ring shockwave geometry');
  }
  for (const part of parts) {
    part.dispose();
  }
  return merged;
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
 * @param random source for shard/coin directions, speeds and spins; deterministic.
 */
export function createImpactEffects(random: () => number): ImpactEffects {
  const group = new Group();
  group.name = 'impact-effects';

  // Rays: one tapered cone per ray, one InstancedMesh per pool.
  const rayGeometry = new ConeGeometry(0.04, 1, 4);
  rayGeometry.translate(0, 0.5, 0);
  rayGeometry.rotateX(Math.PI / 2);
  const rayMaterial = new MeshBasicMaterial({
    color: 0xffcc66,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
  const rayMesh = new InstancedMesh(rayGeometry, rayMaterial, RAY_POOL_CAP * RAYS_PER_POP);
  rayMesh.name = 'impact-rays';
  rayMesh.count = 0;
  rayMesh.frustumCulled = false;
  const rayColors = new InstancedBufferAttribute(
    new Float32Array(RAY_POOL_CAP * RAYS_PER_POP * 3),
    3,
  );
  rayColors.array.fill(1);
  rayColors.needsUpdate = true;
  rayMesh.instanceColor = rayColors;

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

  // Coins: flat gold discs.
  const coinGeometry = new CylinderGeometry(0.075, 0.075, 0.018, 12);
  coinGeometry.rotateX(Math.PI / 2);
  const coinMaterial = new MeshStandardMaterial({
    color: 0xffcc66,
    metalness: 0.7,
    roughness: 0.3,
  });
  const coinMesh = new InstancedMesh(coinGeometry, coinMaterial, COIN_POOL_CAP);
  coinMesh.name = 'impact-coins';
  coinMesh.count = 0;
  coinMesh.frustumCulled = false;

  // Ring: one prebuilt merged geometry and one additive material for all three instances.
  const ringGeometry = createRingGeometry();
  const ringMaterial = new MeshBasicMaterial({
    color: 0xffd27f,
    transparent: true,
    opacity: 0.9,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
  const ringMesh = new InstancedMesh(ringGeometry, ringMaterial, RING_POOL_CAP);
  ringMesh.name = 'impact-ring';
  ringMesh.count = 0;
  ringMesh.frustumCulled = false;

  const ringColors = new InstancedBufferAttribute(new Float32Array(RING_POOL_CAP * 3), 3);
  ringColors.array.fill(1);
  ringColors.needsUpdate = true;
  ringMesh.instanceColor = ringColors;

  group.add(rayMesh, shardMesh, coinMesh, ringMesh);

  const fans: RayFan[] = [];
  const shards: Shard[] = [];
  const coins: Coin[] = [];
  const rings: Ring[] = [];

  let features: ImpactFeatures = {
    rays: RAYS_PER_POP,
    shards: DEBRIS_PER_POP,
    coins: COINS_PER_POP,
    shockwaveExpand: true,
  };

  const scratchMatrix = new Matrix4();
  const scratchPosition = new Vector3();
  const scratchScale = new Vector3();
  const scratchQuaternion = new Quaternion();
  const scratchDirection = new Vector3();
  const scratchRight = new Vector3();
  const scratchUp = new Vector3();
  const zAxis = new Vector3(0, 0, 1);
  const normalScratch = new Vector3();
  let disposed = false;

  /** Orthonormal basis around `normal` written into the two scratch vectors. */
  function basisFor(normal: Vector3): void {
    normalScratch.copy(normal);
    if (normalScratch.lengthSq() < 1e-12) {
      normalScratch.set(0, 0, 1);
    } else {
      normalScratch.normalize();
    }
    scratchRight.set(1, 0, 0);
    if (Math.abs(normalScratch.x) > 0.9) {
      scratchRight.set(0, 1, 0);
    }
    scratchRight.cross(normalScratch).normalize();
    scratchUp.copy(normalScratch).cross(scratchRight).normalize();
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
    features = {
      rays: clampCount(next.rays, RAYS_PER_POP),
      shards: clampCount(next.shards, DEBRIS_PER_POP),
      coins: clampCount(next.coins, COINS_PER_POP),
      shockwaveExpand: next.shockwaveExpand,
    };
  }

  function writeRays(): void {
    let instance = 0;
    for (const fan of fans) {
      const brightness =
        fan.elapsedMs <= MOTION.rayGrowMs + MOTION.rayHoldMs
          ? 1
          : Math.max(0, 1 - (fan.elapsedMs - MOTION.rayGrowMs - MOTION.rayHoldMs) / MOTION.rayFadeMs);
      const grow =
        fan.elapsedMs <= MOTION.rayGrowMs
          ? easeOutQuint(clamp01(fan.elapsedMs / MOTION.rayGrowMs))
          : 1;
      for (let index = 0; index < fan.directions.length; index += 1) {
        const direction = fan.directions[index]!;
        const length = fan.lengths[index]! * grow;
        scratchQuaternion.setFromUnitVectors(zAxis, direction);
        scratchScale.set(1, 1, Math.max(0, length));
        writeInstance(
          rayMesh,
          instance,
          scratchPosition.copy(fan.origin),
          scratchQuaternion,
          scratchScale,
          scratchMatrix,
        );
        rayColors.setXYZ(instance, brightness, brightness, brightness);
        instance += 1;
      }
    }
    rayMesh.count = instance;
    rayMesh.instanceMatrix.needsUpdate = true;
    rayColors.needsUpdate = true;
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

  function writeCoins(): void {
    for (let index = 0; index < coins.length; index += 1) {
      const coin = coins[index]!;
      scratchQuaternion.setFromAxisAngle(coin.axis, coin.angle);
      scratchScale.set(1, 1, 1);
      writeInstance(coinMesh, index, coin.position, scratchQuaternion, scratchScale, scratchMatrix);
    }
    coinMesh.count = coins.length;
    coinMesh.instanceMatrix.needsUpdate = true;
  }

  function writeRings(): void {
    for (let index = 0; index < rings.length; index += 1) {
      const ring = rings[index]!;
      let scale = 1;
      let brightness = 1;
      if (features.shockwaveExpand) {
        if (ring.elapsedMs <= MOTION.shockwaveGrowMs) {
          scale = 1 + (MOTION.shockwaveMaxScale - 1) * easeOutQuad(clamp01(ring.elapsedMs / MOTION.shockwaveGrowMs));
          brightness = 1;
        } else {
          scale = MOTION.shockwaveMaxScale;
          brightness = Math.max(
            0,
            1 - (ring.elapsedMs - MOTION.shockwaveGrowMs) / MOTION.shockwaveFadeMs,
          );
        }
      } else {
        // Reduced motion: no expansion — a static final-scale opacity flash.
        scale = MOTION.shockwaveMaxScale;
        brightness = Math.max(0, 1 - ring.elapsedMs / REDUCED_RING_FLASH_MS);
      }
      scratchScale.set(scale, scale, scale);
      writeInstance(ringMesh, index, ring.origin, ring.orientation, scratchScale, scratchMatrix);
      ringColors.setXYZ(index, brightness, brightness, brightness);
    }
    ringMesh.count = rings.length;
    ringMesh.instanceMatrix.needsUpdate = true;
    ringColors.needsUpdate = true;
  }

  function writeAll(): void {
    writeRays();
    writeShards();
    writeCoins();
    writeRings();
  }

  function spawnPop(origin: Vector3, normal: Vector3, nowMs: number): void {
    if (disposed) {
      return;
    }
    basisFor(normal);
    const base = scratchPosition.copy(origin).addScaledVector(normalScratch, 0.02).clone();
    const normalCopy = normalScratch.clone();

    if (features.rays > 0) {
      if (fans.length >= RAY_POOL_CAP) {
        // Recycle the fan spawned earliest (ties broken by insertion order).
        let oldest = 0;
        for (let index = 1; index < fans.length; index += 1) {
          if (fans[index]!.spawnedAtMs < fans[oldest]!.spawnedAtMs) {
            oldest = index;
          }
        }
        fans.splice(oldest, 1);
      }
      const directions: Vector3[] = [];
      const lengths: number[] = [];
      for (let index = 0; index < features.rays; index += 1) {
        const angle = (index / features.rays) * Math.PI * 2;
        directions.push(
          new Vector3()
            .addScaledVector(scratchRight, Math.cos(angle))
            .addScaledVector(scratchUp, Math.sin(angle))
            .normalize(),
        );
        lengths.push(index % 2 === 0 ? RAY_LENGTH_MIN : RAY_LENGTH_MAX);
      }
      fans.push({ origin: base, normal: normalCopy, directions, lengths, spawnedAtMs: nowMs, elapsedMs: 0 });
    }

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

    if (features.coins > 0) {
      for (let index = 0; index < features.coins; index += 1) {
        if (coins.length >= COIN_POOL_CAP) {
          let oldest = 0;
          for (let scan = 1; scan < coins.length; scan += 1) {
            if (coins[scan]!.spawnedAtMs < coins[oldest]!.spawnedAtMs) {
              oldest = scan;
            }
          }
          coins.splice(oldest, 1);
        }
        const angle = (index / features.coins) * Math.PI * 2;
        const direction = new Vector3()
          .addScaledVector(scratchRight, Math.cos(angle))
          .addScaledVector(scratchUp, Math.sin(angle))
          .addScaledVector(normalScratch, 0.6)
          .normalize();
        const speed = 0.8 + random() * 0.4;
        coins.push({
          position: base.clone().addScaledVector(direction, 0.04),
          velocity: direction.clone().multiplyScalar(speed),
          axis: randomUnit(new Vector3()),
          angle: 0,
          angularSpeed: 3 + random() * 5,
          spawnedAtMs: nowMs,
          elapsedMs: 0,
        });
      }
    }

    if (rings.length >= RING_POOL_CAP) {
      let oldest = 0;
      for (let index = 1; index < rings.length; index += 1) {
        if (rings[index]!.spawnedAtMs < rings[oldest]!.spawnedAtMs) {
          oldest = index;
        }
      }
      rings.splice(oldest, 1);
    }
    rings.push({
      origin: base,
      orientation: new Quaternion().setFromUnitVectors(zAxis, normalCopy),
      spawnedAtMs: nowMs,
      elapsedMs: 0,
    });

    writeAll();
  }

  function update(dtMs: number): void {
    if (disposed) {
      return;
    }
    const advance = Math.max(0, dtMs);
    const seconds = advance / 1000;
    const drag = Math.exp(-MOTION.debrisDragPerS * seconds);

    for (let index = fans.length - 1; index >= 0; index -= 1) {
      const fan = fans[index]!;
      fan.elapsedMs += advance;
      if (fan.elapsedMs >= MOTION.rayTotalMs) {
        fans.splice(index, 1);
      }
    }
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
    for (let index = coins.length - 1; index >= 0; index -= 1) {
      const coin = coins[index]!;
      coin.elapsedMs += advance;
      if (coin.elapsedMs >= MOTION.coinLifetimeMs) {
        coins.splice(index, 1);
        continue;
      }
      coin.position.addScaledVector(coin.velocity, seconds);
      coin.angle += coin.angularSpeed * seconds;
    }
    for (let index = rings.length - 1; index >= 0; index -= 1) {
      const ring = rings[index]!;
      ring.elapsedMs += advance;
      const lifetime = features.shockwaveExpand
        ? MOTION.shockwaveVisibleMs
        : REDUCED_RING_FLASH_MS;
      if (ring.elapsedMs >= lifetime) {
        rings.splice(index, 1);
      }
    }
    writeAll();
  }

  function activeCounts(): { rays: number; shards: number; coins: number; rings: number } {
    let rays = 0;
    for (const fan of fans) {
      rays += fan.directions.length;
    }
    return { rays, shards: shards.length, coins: coins.length, rings: rings.length };
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    fans.length = 0;
    shards.length = 0;
    coins.length = 0;
    rings.length = 0;
    group.clear();
    rayGeometry.dispose();
    rayMaterial.dispose();
    shardGeometry.dispose();
    shardMaterial.dispose();
    coinGeometry.dispose();
    coinMaterial.dispose();
    ringGeometry.dispose();
    ringMaterial.dispose();
  }

  return { group, spawnPop, update, activeCounts, setFeatures, dispose };
}
