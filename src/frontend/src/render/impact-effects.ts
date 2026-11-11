/**
 * Pop impact effects — green shard debris plus the little explosion (T2; spec AC-3).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. One pop
 * starts three pooled drawables, in this order, under the `impact-effects` group:
 *
 * - {@link DEBRIS_PER_POP} green shards (`impact-shards`, `DEBRIS_POOL_CAP = 42`): speed
 *   1.8–3.6, drag 2 s⁻¹, gravity 6, angular 3–8 rad/s, lifetime 1200 ms — unchanged from
 *   the accepted particle-only module.
 * - `impact-flash` (`IMPACT_FLASH_POOL_CAP = 6`): one additive white-hot
 *   `OctahedronGeometry(0.5, 0)` instance per pop, growing
 *   {@link IMPACT_FLASH_START_SCALE} → {@link IMPACT_FLASH_PEAK_SCALE} over 60 ms, holding
 *   from 60–80 ms at brightness 1 and fading its per-instance scalar brightness to 0 over
 *   80–140 ms. The material is warm white ({@link IMPACT_FLASH_COLOR}); the amber/orange
 *   read comes from the ember points, never a hue shift of the core.
 * - `impact-burst` (`IMPACT_BURST_POOL_CAP = 72`): one additive `Points` pool carrying the
 *   amber/white embers (8 per high-tier pop, 380 ms) and the warm-grey smoke haze (4 per
 *   pop, 480 ms). Colours fade to black over each point's lifetime.
 *
 * No object, geometry or material named `impact-rays`, `impact-coins` or `impact-ring`
 * exists, and no `ConeGeometry`/`CylinderGeometry`/`RingGeometry` is imported: this is the
 * little local explosion, not the removed gold fan. The pools recycle oldest-first and
 * create no drawable/geometry/material after construction; every buffer is preallocated
 * and the frame path allocates nothing. The scene owns the tier mapping through
 * {@link ImpactEffects.setFeatures}.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  Vector3,
} from 'three';

import { MOTION, easeOutCubic } from '../game/motion';

/** Active green shards: 42. */
export const DEBRIS_POOL_CAP = MOTION.debrisPoolCap;

/** Maximum shards per pop (high tier). */
export const DEBRIS_PER_POP = MOTION.debrisPerPop;

/** Active white-hot flash instances: 6 (one per pop, oldest-first recycle). */
export const IMPACT_FLASH_POOL_CAP = 6;

/** Warm-white colour of the additive core (the flash is scalar-brightness only). */
export const IMPACT_FLASH_COLOR = 0xfff2dc;

/** Core world scale at the impact frame (spec AC-3). */
export const IMPACT_FLASH_START_SCALE = 0.18;

/** Core world scale at the 60 ms peak (spec AC-3). */
export const IMPACT_FLASH_PEAK_SCALE = 0.55;

/**
 * Radius of the prebuilt flash octahedron. `OctahedronGeometry` takes a radius, so the
 * 0.5-radius geometry scaled by {@link IMPACT_FLASH_PEAK_SCALE} renders the spec's
 * 0.55 world-unit-diameter core (review B1 geometry-radius fix).
 */
const IMPACT_FLASH_GEOMETRY_RADIUS = 0.5;

/** Active ember + smoke points: 72 (oldest-first recycle). */
export const IMPACT_BURST_POOL_CAP = 72;

/** Amber ember colour (every ember except the hot one). */
export const IMPACT_EMBER_COLOR = 0xff9a3c;

/** White-hot ember colour (every 4th point, index % 4 === 0). */
export const IMPACT_EMBER_HOT_COLOR = 0xffe7c4;

/** Warm-grey smoke-haze colour (drawn at {@link IMPACT_SMOKE_BRIGHTNESS}). */
export const IMPACT_SMOKE_COLOR = 0x8a7f72;

/** Additive brightness multiplier of the smoke haze (a faint plasma puff, not soot). */
export const IMPACT_SMOKE_BRIGHTNESS = 0.45;

/** World-space point size of one ember/smoke point. */
const IMPACT_BURST_POINT_SIZE = 0.12;

/** Flash/burst draw order above the opaque cube and the starfield. */
const IMPACT_RENDER_ORDER = 10;

/** Surface offset shared by the shards and the flash (`origin + normal · 0.02`). */
const IMPACT_SURFACE_OFFSET = 0.02;

/** The burst points start `origin + normal · 0.05` in front of the tile. */
const IMPACT_BURST_ORIGIN_OFFSET = 0.05;

/** Spawn jitter along the point's own unit direction (≤ 0.04 world per axis). */
const IMPACT_BURST_JITTER = 0.04;

/** Ember speed range: `[0.8, 1.8)` world/s. */
const EMBER_SPEED_MIN = 0.8;
const EMBER_SPEED_RANGE = 1;
/** Ember velocity drag (s⁻¹) and downward gravity (world/s²). */
const EMBER_DRAG_PER_S = 3;
const EMBER_GRAVITY = 1.5;
/** Outward normal bias of the ember direction: `normalize(unit + normal · 1.5)`. */
const EMBER_NORMAL_BIAS = 1.5;

/** Smoke speed range: `[0.2, 0.5)` world/s. */
const SMOKE_SPEED_MIN = 0.2;
const SMOKE_SPEED_RANGE = 0.3;
/** Outward normal bias of the smoke direction: `normalize(unit + normal · 0.8)`. */
const SMOKE_NORMAL_BIAS = 0.8;
/** Constant upward world/s bias applied once at spawn (no per-frame acceleration). */
const SMOKE_UPWARD_BIAS = 0.25;

/** Effect counts the scene sets from the adaptive quality tier. */
export interface ImpactFeatures {
  /** Shards per pop (0/7/14). */
  readonly shards: number;
  /** White-hot core instances per pop (0/1/1). */
  readonly flash: number;
  /** Amber/white ember points per pop (0/4/8). */
  readonly embers: number;
  /** Warm-grey smoke points per pop (0/2/4). */
  readonly smoke: number;
}

/** The impact handle handed to the scene. */
export interface ImpactEffects {
  /** Group holding exactly `impact-shards`, `impact-flash` and `impact-burst`, in order. */
  readonly group: Group;
  /** Starts one pop at `origin` with outward `normal`; `nowMs` orders recycling. */
  spawnPop(origin: Vector3, normal: Vector3, nowMs: number): void;
  /** Ages all three pools, writes their buffers and recycles expired records. */
  update(dtMs: number): void;
  /** Live shard, flash and ember+smoke counts. */
  activeCounts(): { shards: number; flash: number; points: number };
  /** Merges a partial per-tier feature patch and clamps every value into its pool cap. */
  setFeatures(features: Partial<ImpactFeatures>): void;
  /** Releases the three geometries and three materials exactly once; idempotent. */
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

/** One live white-hot core: a fixed position, an age and its spawn order. */
interface Flash {
  readonly position: Vector3;
  elapsedMs: number;
  readonly spawnedAtMs: number;
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
 * @param random source for shard directions/speeds/spins and the ember/smoke directions and
 *   speeds; deterministic draws in the pinned order (shards first).
 */
export function createImpactEffects(random: () => number): ImpactEffects {
  const group = new Group();
  group.name = 'impact-effects';

  // --- Shards (unchanged): small green cubes. -------------------------------------------
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

  // --- Flash: one instanced white-hot octahedron pool. ----------------------------------
  const flashGeometry = new OctahedronGeometry(IMPACT_FLASH_GEOMETRY_RADIUS, 0);
  const flashMaterial = new MeshBasicMaterial({
    color: IMPACT_FLASH_COLOR,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const flashMesh = new InstancedMesh(flashGeometry, flashMaterial, IMPACT_FLASH_POOL_CAP);
  flashMesh.name = 'impact-flash';
  flashMesh.count = 0;
  flashMesh.frustumCulled = false;
  flashMesh.renderOrder = IMPACT_RENDER_ORDER;
  const flashColors = new InstancedBufferAttribute(
    new Float32Array(IMPACT_FLASH_POOL_CAP * 3),
    3,
  );
  flashMesh.instanceColor = flashColors;

  // --- Burst: one additive Points pool for the embers and the smoke haze. ---------------
  const burstPositions = new Float32Array(IMPACT_BURST_POOL_CAP * 3);
  const burstColors = new Float32Array(IMPACT_BURST_POOL_CAP * 3);
  const burstPositionAttribute = new BufferAttribute(burstPositions, 3).setUsage(
    DynamicDrawUsage,
  );
  const burstColorAttribute = new BufferAttribute(burstColors, 3).setUsage(DynamicDrawUsage);
  const burstGeometry = new BufferGeometry();
  burstGeometry.setAttribute('position', burstPositionAttribute);
  burstGeometry.setAttribute('color', burstColorAttribute);
  burstGeometry.setDrawRange(0, 0);
  const burstMaterial = new PointsMaterial({
    color: 0xffffff,
    size: IMPACT_BURST_POINT_SIZE,
    sizeAttenuation: true,
    vertexColors: true,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const burstPoints = new Points<BufferGeometry, PointsMaterial>(burstGeometry, burstMaterial);
  burstPoints.name = 'impact-burst';
  burstPoints.frustumCulled = false;
  burstPoints.renderOrder = IMPACT_RENDER_ORDER;

  group.add(shardMesh, flashMesh, burstPoints);

  const shards: Shard[] = [];
  const flashes: Flash[] = [];

  // Preallocated burst-point state (no per-frame object allocation).
  const burstX = new Float64Array(IMPACT_BURST_POOL_CAP);
  const burstY = new Float64Array(IMPACT_BURST_POOL_CAP);
  const burstZ = new Float64Array(IMPACT_BURST_POOL_CAP);
  const burstVx = new Float64Array(IMPACT_BURST_POOL_CAP);
  const burstVy = new Float64Array(IMPACT_BURST_POOL_CAP);
  const burstVz = new Float64Array(IMPACT_BURST_POOL_CAP);
  const burstAge = new Float64Array(IMPACT_BURST_POOL_CAP);
  const burstLifetime = new Float64Array(IMPACT_BURST_POOL_CAP);
  const burstDragPerS = new Float64Array(IMPACT_BURST_POOL_CAP);
  const burstGravity = new Float64Array(IMPACT_BURST_POOL_CAP);
  const burstR = new Float64Array(IMPACT_BURST_POOL_CAP);
  const burstG = new Float64Array(IMPACT_BURST_POOL_CAP);
  const burstB = new Float64Array(IMPACT_BURST_POOL_CAP);
  const burstSpawnedAt = new Float64Array(IMPACT_BURST_POOL_CAP);
  let burstCount = 0;

  let features: ImpactFeatures = {
    shards: DEBRIS_PER_POP,
    flash: 0,
    embers: 0,
    smoke: 0,
  };

  const emberColor = new Color(IMPACT_EMBER_COLOR);
  const emberHotColor = new Color(IMPACT_EMBER_HOT_COLOR);
  const smokeColor = new Color(IMPACT_SMOKE_COLOR).multiplyScalar(IMPACT_SMOKE_BRIGHTNESS);

  const scratchMatrix = new Matrix4();
  const scratchPosition = new Vector3();
  const scratchScale = new Vector3();
  const scratchQuaternion = new Quaternion();
  const identityQuaternion = new Quaternion();
  const scratchDirection = new Vector3();
  const normalScratch = new Vector3();
  const burstBase = new Vector3();
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

  function clampCount(value: number | undefined, current: number, max: number): number {
    if (value === undefined) {
      return current;
    }
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.min(max, Math.max(0, Math.floor(value)));
  }

  function setFeatures(next: Partial<ImpactFeatures>): void {
    features = {
      shards: clampCount(next.shards, features.shards, DEBRIS_PER_POP),
      flash: clampCount(next.flash, features.flash, IMPACT_FLASH_POOL_CAP),
      embers: clampCount(next.embers, features.embers, MOTION.impactEmberCount),
      smoke: clampCount(next.smoke, features.smoke, MOTION.impactSmokeCount),
    };
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

  /** Drops the flash spawned earliest (`nowMs`, ties broken by spawn order). */
  function recycleOldestFlash(): void {
    let oldest = 0;
    for (let index = 1; index < flashes.length; index += 1) {
      if (flashes[index]!.spawnedAtMs < flashes[oldest]!.spawnedAtMs) {
        oldest = index;
      }
    }
    flashes.splice(oldest, 1);
  }

  function writeFlashes(): void {
    const fadeStartMs = MOTION.impactFlashMs - MOTION.impactFlashGrowMs;
    for (let index = 0; index < flashes.length; index += 1) {
      const flash = flashes[index]!;
      const grow = Math.min(1, flash.elapsedMs / MOTION.impactFlashGrowMs);
      const scale =
        IMPACT_FLASH_START_SCALE +
        (IMPACT_FLASH_PEAK_SCALE - IMPACT_FLASH_START_SCALE) * easeOutCubic(grow);
      scratchScale.set(scale, scale, scale);
      scratchMatrix.compose(flash.position, identityQuaternion, scratchScale);
      flashMesh.setMatrixAt(index, scratchMatrix);
      const brightness =
        flash.elapsedMs <= fadeStartMs
          ? 1
          : Math.max(
              0,
              1 - (flash.elapsedMs - fadeStartMs) / MOTION.impactFlashGrowMs,
            );
      flashColors.setXYZ(index, brightness, brightness, brightness);
    }
    flashMesh.count = flashes.length;
    flashMesh.instanceMatrix.needsUpdate = true;
    flashColors.needsUpdate = true;
  }

  /** Copies one burst-point slot over another (used by oldest-first replacement/removal). */
  function copyBurstPoint(from: number, to: number): void {
    burstX[to] = burstX[from]!;
    burstY[to] = burstY[from]!;
    burstZ[to] = burstZ[from]!;
    burstVx[to] = burstVx[from]!;
    burstVy[to] = burstVy[from]!;
    burstVz[to] = burstVz[from]!;
    burstAge[to] = burstAge[from]!;
    burstLifetime[to] = burstLifetime[from]!;
    burstDragPerS[to] = burstDragPerS[from]!;
    burstGravity[to] = burstGravity[from]!;
    burstR[to] = burstR[from]!;
    burstG[to] = burstG[from]!;
    burstB[to] = burstB[from]!;
    burstSpawnedAt[to] = burstSpawnedAt[from]!;
  }

  /** Appends one ember/smoke point, replacing the oldest slot at the 72 cap. */
  function appendBurstPoint(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    lifetimeMs: number,
    dragPerS: number,
    gravity: number,
    r: number,
    g: number,
    b: number,
    nowMs: number,
  ): void {
    let slot = burstCount;
    if (burstCount >= IMPACT_BURST_POOL_CAP) {
      slot = 0;
      for (let scan = 1; scan < burstCount; scan += 1) {
        if (burstSpawnedAt[scan]! < burstSpawnedAt[slot]!) {
          slot = scan;
        }
      }
    } else {
      burstCount += 1;
    }
    burstX[slot] = x;
    burstY[slot] = y;
    burstZ[slot] = z;
    burstVx[slot] = vx;
    burstVy[slot] = vy;
    burstVz[slot] = vz;
    burstAge[slot] = 0;
    burstLifetime[slot] = lifetimeMs;
    burstDragPerS[slot] = dragPerS;
    burstGravity[slot] = gravity;
    burstR[slot] = r;
    burstG[slot] = g;
    burstB[slot] = b;
    burstSpawnedAt[slot] = nowMs;
  }

  function writeBurst(): void {
    for (let index = 0; index < burstCount; index += 1) {
      const offset = index * 3;
      const fade = Math.max(0, 1 - burstAge[index]! / burstLifetime[index]!);
      burstPositions[offset] = burstX[index]!;
      burstPositions[offset + 1] = burstY[index]!;
      burstPositions[offset + 2] = burstZ[index]!;
      burstColors[offset] = burstR[index]! * fade;
      burstColors[offset + 1] = burstG[index]! * fade;
      burstColors[offset + 2] = burstB[index]! * fade;
    }
    // The released tail must not keep drawing stale points (the draw range hides it, but a
    // zeroed tail keeps the buffer honest for callers and tests).
    burstPositions.fill(0, burstCount * 3);
    burstColors.fill(0, burstCount * 3);
    burstGeometry.setDrawRange(0, burstCount);
    burstPositionAttribute.needsUpdate = true;
    burstColorAttribute.needsUpdate = true;
  }

  function spawnPop(origin: Vector3, normal: Vector3, nowMs: number): void {
    if (disposed) {
      return;
    }
    surfaceNormal(normal);
    const base = scratchPosition.copy(origin).addScaledVector(normalScratch, IMPACT_SURFACE_OFFSET).clone();

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

    if (features.flash > 0) {
      for (let index = 0; index < features.flash; index += 1) {
        while (flashes.length >= IMPACT_FLASH_POOL_CAP) {
          recycleOldestFlash();
        }
        flashes.push({ position: base.clone(), elapsedMs: 0, spawnedAtMs: nowMs });
      }
    }

    if (features.embers > 0 || features.smoke > 0) {
      burstBase.copy(origin).addScaledVector(normalScratch, IMPACT_BURST_ORIGIN_OFFSET);

      // Embers: outward-biased unit direction, speed 0.8–1.8, drag 3, gravity 1.5.
      for (let index = 0; index < features.embers; index += 1) {
        const direction = randomUnit(scratchDirection);
        direction.addScaledVector(normalScratch, EMBER_NORMAL_BIAS).normalize();
        const speed = EMBER_SPEED_MIN + random() * EMBER_SPEED_RANGE;
        const color = index % 4 === 0 ? emberHotColor : emberColor;
        appendBurstPoint(
          burstBase.x + direction.x * IMPACT_BURST_JITTER,
          burstBase.y + direction.y * IMPACT_BURST_JITTER,
          burstBase.z + direction.z * IMPACT_BURST_JITTER,
          direction.x * speed,
          direction.y * speed,
          direction.z * speed,
          MOTION.impactEmberLifetimeMs,
          EMBER_DRAG_PER_S,
          EMBER_GRAVITY,
          color.r,
          color.g,
          color.b,
          nowMs,
        );
      }

      // Smoke: outward-biased direction, speed 0.2–0.5, constant +0.25 upward bias at
      // spawn, no drag and no gravity.
      for (let index = 0; index < features.smoke; index += 1) {
        const direction = randomUnit(scratchDirection);
        direction.addScaledVector(normalScratch, SMOKE_NORMAL_BIAS).normalize();
        const speed = SMOKE_SPEED_MIN + random() * SMOKE_SPEED_RANGE;
        appendBurstPoint(
          burstBase.x + direction.x * IMPACT_BURST_JITTER,
          burstBase.y + direction.y * IMPACT_BURST_JITTER,
          burstBase.z + direction.z * IMPACT_BURST_JITTER,
          direction.x * speed,
          direction.y * speed + SMOKE_UPWARD_BIAS,
          direction.z * speed,
          MOTION.impactSmokeLifetimeMs,
          0,
          0,
          smokeColor.r,
          smokeColor.g,
          smokeColor.b,
          nowMs,
        );
      }
    }

    writeShards();
    writeFlashes();
    writeBurst();
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

    for (let index = flashes.length - 1; index >= 0; index -= 1) {
      const flash = flashes[index]!;
      flash.elapsedMs += advance;
      if (flash.elapsedMs >= MOTION.impactFlashMs) {
        flashes.splice(index, 1);
      }
    }

    for (let index = burstCount - 1; index >= 0; index -= 1) {
      burstAge[index] += advance;
      if (burstAge[index]! >= burstLifetime[index]!) {
        // Swap the last live point into this slot (draw order is irrelevant in one Points).
        burstCount -= 1;
        if (index !== burstCount) {
          copyBurstPoint(burstCount, index);
        }
        continue;
      }
      const pointDrag = Math.exp(-burstDragPerS[index]! * seconds);
      burstVy[index] -= burstGravity[index]! * seconds;
      burstVx[index] *= pointDrag;
      burstVy[index] *= pointDrag;
      burstVz[index] *= pointDrag;
      burstX[index] += burstVx[index]! * seconds;
      burstY[index] += burstVy[index]! * seconds;
      burstZ[index] += burstVz[index]! * seconds;
    }

    writeShards();
    writeFlashes();
    writeBurst();
  }

  function activeCounts(): { shards: number; flash: number; points: number } {
    return { shards: shards.length, flash: flashes.length, points: burstCount };
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    shards.length = 0;
    flashes.length = 0;
    burstCount = 0;
    group.clear();
    shardGeometry.dispose();
    shardMaterial.dispose();
    flashGeometry.dispose();
    flashMaterial.dispose();
    burstGeometry.dispose();
    burstMaterial.dispose();
  }

  return { group, spawnPop, update, activeCounts, setFeatures, dispose };
}
