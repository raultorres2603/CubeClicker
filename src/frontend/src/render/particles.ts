/**
 * Pooled explosion particles (T9 — plan § Render interfaces; spec AC-5, AC-16).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. The scene
 * pushes explosions in (`spawn`) and advances them once per frame (`update`); the system
 * owns a single `Points` drawable and every buffer inside it, so AC-16's bounded-drawables
 * promise holds: the pool never holds more than {@link PARTICLE_POOL_CAP} active particles
 * and never creates another three.js object after construction.
 *
 * Model. One `Points` object carries `cap` preallocated slots (position + colour
 * attributes, `DynamicDrawUsage`). A spawned burst owns a contiguous slice of that buffer:
 * `spawn` records the burst (fragments, an origin copy, one jitter offset per fragment) and
 * rewrites the buffer; `update` ages every live burst, releases those that reached their
 * lifetime and rewrites the fragment positions from the recorded state. When a spawn would
 * push the active total past `cap`, the pool recycles the earliest-spawned burst, so the
 * newest explosion always plays.
 *
 * Appearance. Fragments are additive points of the pinned world size
 * {@link PARTICLE_POINT_SIZE}; each burst fades linearly to black over its lifetime through
 * the per-vertex colour attribute (one material, one draw call for the whole pool). The
 * per-fragment `BurstParticle.size` of the burst contract is not consumed here:
 * `PointsMaterial` carries a single size per draw call, and the pool deliberately stays one
 * drawable (AC-16) rather than one `Points` per fragment.
 *
 * Layering (spec AC-3). Transparent geometry draws after the opaque cube tiles, and the
 * pool's material disables the depth test (`depthTest: false`, `depthWrite` stays false) so
 * a burst is never occluded by the mini-cube surface it spawns in front of. The drawable
 * also carries {@link PARTICLE_RENDER_ORDER} (10) — above the starfield and the face plates,
 * which keep the default 0 — so the burst draws last within the transparent pass.
 *
 * `PARTICLE_POOL_CAP` is imported from `game/effects.ts` (T5), the single home for the
 * non-grid pinned constants (plan § Constant homes — never redefined locally).
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Group,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';

import { PARTICLE_POOL_CAP, type Burst, type BurstParticle } from '../game/effects';

/** World-space point size of one fragment (attenuated by distance). */
const PARTICLE_POINT_SIZE = 0.15;

/**
 * Render order of the particle drawable (spec AC-3). Above the starfield and the face
 * plates, which keep three's default order 0, so the burst draws last in the transparent
 * pass; combined with `depthTest: false` this keeps it in front of the clicked mini-cube.
 */
const PARTICLE_RENDER_ORDER = 10;

/**
 * Half-range of the spawn jitter: a fragment starts within
 * `±PARTICLE_SPAWN_JITTER` world units of the explosion origin, so a burst reads as a cloud
 * instead of every fragment starting on the same pixel. `0.0625` (2⁻⁴) is exact in binary
 * floating point, which keeps the spawned positions exactly assertable.
 */
const PARTICLE_SPAWN_JITTER = 0.0625;

/** Jitter draws consumed per played fragment, in `x → y → z` order. */
const JITTER_DRAWS_PER_FRAGMENT = 3;

/** The pooled particle system handed to the scene. */
export interface ParticleSystem {
  /** Everything the system adds to the scene (one `Points`) lives under this group. */
  readonly group: Group;
  /**
   * Plays `burst` centred on `origin`: the burst's fragments become active immediately,
   * offset from the origin by their spawn jitter.
   *
   * Exactly `min(burst.particles.length, cap)` fragments become active. If that would push
   * the active total past `cap`, the bursts spawned *earliest* (smallest `nowMs`, ties broken
   * by spawn order) are recycled until the new burst fits — i.e. spawning at the cap drops
   * the oldest explosion so the newest one always plays. Bursts with no fragments, or with a
   * non-positive lifetime (the reduced-motion instant-removal path), are ignored.
   *
   * `origin` is copied, so the caller keeps ownership; `nowMs` is the frame time used to
   * order bursts for recycling.
   */
  spawn(burst: Burst, origin: Vector3, nowMs: number): void;
  /**
   * Advances every live burst by `dtMs` milliseconds (a non-positive advance ages nothing),
   * releases the bursts that reached their lifetime and rewrites the fragment buffer.
   */
  update(dtMs: number): void;
  /** Total number of fragments currently played by the pool (never above `cap`). */
  activeCount(): number;
  /** Releases the burst state, the geometry and the material exactly once; idempotent. */
  dispose(): void;
}

/** One explosion held by the pool: its fragments plus the state needed to draw them. */
interface ActiveBurst {
  /** The burst's fragments; only the first {@link ActiveBurst.count} are played. */
  readonly particles: readonly BurstParticle[];
  /** Fragments actually played — `min(particles.length, cap)` at spawn time. */
  readonly count: number;
  /** Copy of the spawn origin (the caller's `Vector3` is never retained). */
  readonly origin: Vector3;
  /** Per-fragment spawn jitter, three floats per played fragment. */
  readonly offsets: Float32Array;
  /** Milliseconds the burst plays before it is released. */
  readonly lifetimeMs: number;
  /** Frame time of the spawn, used to recycle the earliest-spawned burst first. */
  readonly spawnedAtMs: number;
  /** Milliseconds elapsed since the spawn (`spawn` starts it at 0). */
  elapsedMs: number;
}

/**
 * Builds the pooled particle system.
 *
 * @param random source for the per-fragment spawn jitter (three draws per played fragment,
 * `x → y → z`); deterministic, so identical draws always produce identical bursts.
 * @param cap hard ceiling on active fragments; defaults to {@link PARTICLE_POOL_CAP} (72).
 */
export function createParticleSystem(
  random: () => number,
  cap: number = PARTICLE_POOL_CAP,
): ParticleSystem {
  if (!Number.isInteger(cap) || cap < 1) {
    throw new RangeError(`particle pool cap must be a positive integer, received ${cap}`);
  }

  const positions = new Float32Array(cap * 3);
  const colors = new Float32Array(cap * 3);
  const positionAttribute = new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage);
  const colorAttribute = new BufferAttribute(colors, 3).setUsage(DynamicDrawUsage);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', colorAttribute);
  geometry.setDrawRange(0, 0);

  const material = new PointsMaterial({
    size: PARTICLE_POINT_SIZE,
    sizeAttenuation: true,
    vertexColors: true,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });

  const points = new Points<BufferGeometry, PointsMaterial>(geometry, material);
  // Above the starfield and the face plates (default order 0) — see PARTICLE_RENDER_ORDER.
  points.renderOrder = PARTICLE_RENDER_ORDER;
  // The buffer is rewritten every frame and its slots start at the origin, so a
  // bounding-sphere cull would be stale — the pool is always submitted instead.
  points.frustumCulled = false;

  const group = new Group();
  group.add(points);

  const bursts: ActiveBurst[] = [];
  let disposed = false;

  /** Rewrites the fragment buffer: active fragments first, the rest of the slots zeroed. */
  function writeBuffer(): void {
    let write = 0;
    for (const burst of bursts) {
      const brightness = 1 - burst.elapsedMs / burst.lifetimeMs;
      for (let index = 0; index < burst.count; index += 1) {
        const particle = burst.particles[index]!;
        const slot = write * 3;
        const jitter = index * 3;
        // `speed` is world units per second; multiplying before dividing by 1000 keeps
        // integer frame times exact (e.g. 1.5 * 100 / 1000 === 0.15).
        const distance = (particle.speed * burst.elapsedMs) / 1000;
        positions[slot] = burst.origin.x + burst.offsets[jitter]! + particle.dx * distance;
        positions[slot + 1] = burst.origin.y + burst.offsets[jitter + 1]! + particle.dy * distance;
        positions[slot + 2] = burst.origin.z + burst.offsets[jitter + 2]! + particle.dz * distance;
        colors[slot] = brightness;
        colors[slot + 1] = brightness;
        colors[slot + 2] = brightness;
        write += 1;
      }
    }
    // The released slots must not keep drawing stale fragments (the draw range hides them
    // from the GPU, but a zeroed tail keeps the buffer honest for callers and tests).
    positions.fill(0, write * 3);
    colors.fill(0, write * 3);
    geometry.setDrawRange(0, write);
    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
  }

  /** Drops the active burst spawned earliest (`nowMs`, ties broken by spawn order). */
  function recycleOldest(): void {
    let oldest = 0;
    for (let index = 1; index < bursts.length; index += 1) {
      if (bursts[index]!.spawnedAtMs < bursts[oldest]!.spawnedAtMs) {
        oldest = index;
      }
    }
    bursts.splice(oldest, 1);
  }

  /** Drops every burst that has played for its full lifetime. */
  function releaseExpired(): void {
    for (let index = bursts.length - 1; index >= 0; index -= 1) {
      if (bursts[index]!.elapsedMs >= bursts[index]!.lifetimeMs) {
        bursts.splice(index, 1);
      }
    }
  }

  function activeCount(): number {
    let total = 0;
    for (const burst of bursts) {
      total += burst.count;
    }
    return total;
  }

  function spawn(burst: Burst, origin: Vector3, nowMs: number): void {
    if (disposed) {
      return;
    }
    if (burst.particles.length === 0) {
      // Nothing to play (AC-12's reduced-motion path sends no burst at all).
      return;
    }
    if (burst.lifetimeMs <= 0) {
      return;
    }

    const count = Math.min(burst.particles.length, cap);
    while (activeCount() + count > cap) {
      recycleOldest();
    }

    const offsets = new Float32Array(count * JITTER_DRAWS_PER_FRAGMENT);
    for (let index = 0; index < offsets.length; index += 1) {
      offsets[index] = (random() - 0.5) * 2 * PARTICLE_SPAWN_JITTER;
    }

    bursts.push({
      particles: burst.particles,
      count,
      origin: origin.clone(),
      offsets,
      lifetimeMs: burst.lifetimeMs,
      spawnedAtMs: nowMs,
      elapsedMs: 0,
    });

    writeBuffer();
  }

  function update(dtMs: number): void {
    if (disposed) {
      return;
    }
    const advance = Math.max(0, dtMs);
    for (const burst of bursts) {
      burst.elapsedMs += advance;
    }
    releaseExpired();
    writeBuffer();
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    bursts.length = 0;
    geometry.setDrawRange(0, 0);
    group.clear();
    geometry.dispose();
    material.dispose();
  }

  return { group, spawn, update, activeCount, dispose };
}
