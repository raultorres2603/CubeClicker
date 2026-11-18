/**
 * Prebuilt shot and muzzle visuals (remote-spaceship-customization T10; spec AC-23/AC-24;
 * plan § Muzzle and shot visuals).
 *
 * Layer: render adapter (`render/**`) — three.js geometry/material objects only. No DOM, no
 * game rules, no timers, no randomness, no external asset. Every geometry and both materials
 * are built once per owner (`Spaceship`, and later `RemoteShip`); a shot only re-uses them
 * through its mesh, so there is no geometry/material allocation on the firing path.
 *
 * Pinned set (AC-24):
 * - projectiles: `bolt` = the accepted 0.55 × 0.07 six-sided cone with its tip at local `+z`,
 *   `orb` = octahedron, `wave` = torus (hole facing local `+z`, the travel direction),
 *   `shard` = tetrahedron;
 * - muzzles: `spark` = the accepted octahedron, `ring` = torus, `petal` = three crossed quads
 *   (0°, 60°, 120° about `z`, rendered double-sided so it is visible from the camera behind
 *   the shot);
 * - materials: one additive projectile material and one additive muzzle material. Their
 *   colours start at the accepted `shot-default` bolt/muzzle colours and are re-written by
 *   `Spaceship.applyShotStyle` from the equipped style's `color`/`accent`.
 *
 * `dispose()` releases each geometry exactly once and is idempotent; the materials are owned
 * by the caller that created them and are disposed by it.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  DoubleSide,
  MeshBasicMaterial,
  OctahedronGeometry,
  TetrahedronGeometry,
  TorusGeometry,
} from 'three';

/** The four projectile geometry kinds (plan § Muzzle and shot visuals). */
export type ShotGeometryKind = 'bolt' | 'orb' | 'wave' | 'shard';

/** The three muzzle-flash geometry kinds. */
export type MuzzleKind = 'spark' | 'ring' | 'petal';

/** Accepted bolt cone (spaceship-cursor spec AC-6): 0.07 radius, 0.55 height, 6 sides. */
export const SHOT_BOLT_RADIUS = 0.07;
export const SHOT_BOLT_HEIGHT = 0.55;
export const SHOT_BOLT_RADIAL_SEGMENTS = 6;

/** Orb octahedron radius. */
export const SHOT_ORB_RADIUS = 0.16;

/** Wave torus ring and tube radii (the hole faces local `+z`). */
export const SHOT_WAVE_RADIUS = 0.18;
export const SHOT_WAVE_TUBE = 0.05;

/** Shard tetrahedron radius. */
export const SHOT_SHARD_RADIUS = 0.14;

/** Accepted spark octahedron (spaceship-cursor spec AC-6): 0.22 radius, detail 0. */
export const SHOT_SPARK_RADIUS = 0.22;

/** Ring torus ring and tube radii. */
export const SHOT_RING_RADIUS = 0.2;
export const SHOT_RING_TUBE = 0.045;

/** Petal blade half-size: three `2 · SHOT_PETAL_HALF_SIZE`-wide quads crossed about `z`. */
export const SHOT_PETAL_HALF_SIZE = 0.17;

/** Shared projectile material: the accepted warm white-hot tracer colour (`#fff1c8`). */
export const SHOT_PROJECTILE_COLOR = 0xfff1c8;
export const SHOT_PROJECTILE_OPACITY = 0.95;

/** Shared muzzle material: the accepted warmer amber flash colour (`#ffd27a`). */
export const SHOT_MUZZLE_COLOR = 0xffd27a;
export const SHOT_MUZZLE_OPACITY = 0.9;

/** The prebuilt geometries one ship owns (four projectiles + three muzzles). */
export interface ShotGeometrySet {
  readonly projectiles: Readonly<Record<ShotGeometryKind, BufferGeometry>>;
  readonly muzzles: Readonly<Record<MuzzleKind, BufferGeometry>>;
  /** Releases every geometry exactly once; idempotent. */
  dispose(): void;
}

/** The two shared materials one ship owns (every live shot re-uses them). */
export interface ShotMaterials {
  readonly projectile: MeshBasicMaterial;
  readonly muzzle: MeshBasicMaterial;
}

/**
 * Builds the three crossed petal quads as one non-indexed geometry (6 triangles).
 *
 * Each blade is a `2 · SHOT_PETAL_HALF_SIZE` square in the local XY plane, rotated about `z`
 * by 0°, 60° and 120°; the shared muzzle material is double-sided, so the crossed blades
 * read from both the firing side and the camera side.
 */
function createPetalGeometry(): BufferGeometry {
  const half = SHOT_PETAL_HALF_SIZE;
  const corners = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, -half],
    [half, half],
    [-half, half],
  ] as const;
  const positions: number[] = [];
  for (let blade = 0; blade < 3; blade += 1) {
    const angle = (blade * Math.PI) / 3;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    for (const [x, y] of corners) {
      positions.push(x * cos - y * sin, x * sin + y * cos, 0);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  return geometry;
}

/**
 * Builds the four projectile and three muzzle geometries once.
 *
 * The bolt keeps the accepted cone parameters and orientation (tip at local `+z`); `spark`
 * keeps the accepted octahedron. The caller must call {@link ShotGeometrySet.dispose} on
 * teardown and must never create a geometry per shot.
 */
export function createShotGeometries(): ShotGeometrySet {
  const bolt = new ConeGeometry(
    SHOT_BOLT_RADIUS,
    SHOT_BOLT_HEIGHT,
    SHOT_BOLT_RADIAL_SEGMENTS,
  );
  // Tip at local +z (the assembled shot is aimed by rotating local +z onto the shot
  // direction), exactly the accepted spaceship-cursor bolt.
  bolt.rotateX(Math.PI / 2);

  const projectiles: Record<ShotGeometryKind, BufferGeometry> = {
    bolt,
    orb: new OctahedronGeometry(SHOT_ORB_RADIUS, 0),
    wave: new TorusGeometry(SHOT_WAVE_RADIUS, SHOT_WAVE_TUBE, 6, 16),
    shard: new TetrahedronGeometry(SHOT_SHARD_RADIUS, 0),
  };
  const muzzles: Record<MuzzleKind, BufferGeometry> = {
    spark: new OctahedronGeometry(SHOT_SPARK_RADIUS, 0),
    ring: new TorusGeometry(SHOT_RING_RADIUS, SHOT_RING_TUBE, 6, 14),
    petal: createPetalGeometry(),
  };

  let disposed = false;

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    for (const geometry of Object.values(projectiles)) {
      geometry.dispose();
    }
    for (const geometry of Object.values(muzzles)) {
      geometry.dispose();
    }
  }

  return { projectiles, muzzles, dispose };
}

/**
 * Builds the one shared additive projectile material and the one shared additive muzzle
 * material a ship owns. They start at the accepted `shot-default` colours; a style change
 * only re-writes `color`, never creates another material.
 */
export function createShotMaterials(): ShotMaterials {
  return {
    projectile: new MeshBasicMaterial({
      color: SHOT_PROJECTILE_COLOR,
      transparent: true,
      opacity: SHOT_PROJECTILE_OPACITY,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    muzzle: new MeshBasicMaterial({
      color: SHOT_MUZZLE_COLOR,
      transparent: true,
      opacity: SHOT_MUZZLE_OPACITY,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      // The crossed petal quads (and a torus seen edge-on) need both faces.
      side: DoubleSide,
    }),
  };
}
