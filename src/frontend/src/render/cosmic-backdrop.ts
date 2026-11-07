/**
 * Procedural cosmic backdrop: asteroids, meteors, a comet and a hero ship behind the cube
 * (T10 — reference-image-game-view spec AC-11, AC-12).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. The factory
 * owns one {@link Group} named `cosmic-backdrop` and every three.js object inside it, so the
 * scene can append it as a single child, advance it once per frame and dispose it exactly
 * once. The only texture is the generated nebula handed to the scene as
 * `scene.background` (T11); the rest of the backdrop is procedural geometry and materials
 * (no loader, URL or external asset).
 *
 * Layout. Everything is pinned: {@link COMET_POSITION} and {@link HERO_SHIP_POSITION} come
 * straight from AC-11 (right side, `x > 0`), the asteroid/meteor bands are fixed in world
 * space and every object sits behind the cube (`z < -4`). The injected `random` is forwarded
 * to {@link createNebulaTexture} only, so the seeded sequence starts exactly where T9's
 * texture generator expects it and the layout itself is deterministic.
 *
 * Motion (AC-12). `update` clamps the advance with `Math.max(0, dtMs)`; with a positive dt
 * the asteroids tumble, the meteors drift and wrap inside their band, and the comet and hero
 * ship bob slowly around their pinned positions. With `reducedMotion` (or a non-positive
 * advance) nothing changes. No per-frame allocations: the loop touches preallocated
 * meshes/groups only.
 *
 * Disposal (AC-12). {@link CosmicBackdrop.dispose} detaches the group from its parent and
 * releases every geometry and material it owns plus the nebula texture exactly once; calling
 * it again is a no-op.
 */

import {
  AdditiveBlending,
  BoxGeometry,
  ConeGeometry,
  DataTexture,
  DodecahedronGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';

import { createNebulaTexture } from './nebula';

/** Number of asteroids in the backdrop (AC-11). */
export const COSMIC_ASTEROID_COUNT = 7;

/** Number of meteors in the backdrop (AC-11); each is a head + tail group. */
export const COSMIC_METEOR_COUNT = 3;

/**
 * Total object count of the backdrop, including the `cosmic-backdrop` group itself
 * (AC-11): 1 group + 7 asteroids + 3 meteor groups + 6 meteor meshes + 1 comet group +
 * 2 comet meshes + 1 hero-ship group + 7 hero meshes.
 */
export const COSMIC_BACKDROP_OBJECT_COUNT = 28;

/** Pinned comet-head colour (AC-11) — glowing orange. */
export const COMET_HEAD_COLOR = 0xff8a3d;

/** Pinned hero-ship hull colour (AC-11) — blue. */
export const HERO_HULL_COLOR = 0x2f6fd6;

/** Pinned hero-ship engine-flame colour (AC-11) — orange. */
export const HERO_FLAME_COLOR = 0xff9a3c;

/** Pinned comet position (AC-11): right side, behind the cube. */
export const COMET_POSITION = { x: 7.5, y: 2.2, z: -18 } as const;

/** Pinned hero-ship position (AC-11): right side, behind the cube. */
export const HERO_SHIP_POSITION = { x: 9, y: -2.5, z: -14 } as const;

/**
 * Asteroid tumble rate in radians per millisecond (AC-12, slow motion): 1/8192 ≈
 * 0.000122 rad/ms, a full turn in about 51 seconds. A power of two, so integer frame times
 * scale exactly and tests can pin the post-update angles.
 */
export const COSMIC_ASTEROID_ROTATION_SPEED = 1 / 8192;

/** Meteor drift on x in world units per millisecond (AC-12, slow motion). */
export const COSMIC_METEOR_SPEED_X = 1 / 512;

/** Meteor drift on y in world units per millisecond (AC-12, slow motion). */
export const COSMIC_METEOR_SPEED_Y = 1 / 1024;

/** Comet bob angular speed in radians per millisecond (AC-12, slow motion). */
export const COSMIC_COMET_BOB_SPEED = 1 / 4096;

/** Comet bob amplitude in world units around {@link COMET_POSITION}. */
export const COSMIC_COMET_BOB_AMPLITUDE = 0.25;

/** Hero-ship bob angular speed in radians per millisecond (AC-12, slow motion). */
export const COSMIC_HERO_BOB_SPEED = 1 / 2048;

/** Hero-ship bob amplitude in world units around {@link HERO_SHIP_POSITION}. */
export const COSMIC_HERO_BOB_AMPLITUDE = 0.25;

/** Asteroid material colours: muted rocky greys/blues, one per asteroid. */
const ASTEROID_COLORS = [
  0x6b7280, 0x7c8698, 0x5d6774, 0x8792a2, 0x4e5866, 0x72808f, 0x616c7c,
] as const;

/** Meteor head/tail colours (not pinned by AC-11; warm streak against the nebula). */
const METEOR_HEAD_COLOR = 0xffe6c7;
const METEOR_TAIL_COLOR = 0xffa94d;

/** Comet tail tint (the head keeps the pinned {@link COMET_HEAD_COLOR}). */
const COMET_TAIL_COLOR = 0xffb27a;

/** Nose, wing and cockpit tints around the pinned blue hull. */
const HERO_NOSE_COLOR = 0x8ec5ff;
const HERO_WING_COLOR = 0x1d4ed8;
const HERO_COCKPIT_COLOR = 0x9bd8ff;

/** Meteor drift band on x; a meteor past the maximum wraps back to the minimum. */
const METEOR_BAND_MIN_X = -16;
const METEOR_BAND_MAX_X = 16;

/** Meteor drift band on y; a meteor past the maximum wraps back to the minimum. */
const METEOR_BAND_MIN_Y = -10;
const METEOR_BAND_MAX_Y = 10;

interface AsteroidLayout {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
  readonly rotationX: number;
  readonly rotationY: number;
  readonly rotationZ: number;
}

/** Pinned asteroid positions (all behind the cube) and initial tumbles. */
const ASTEROID_LAYOUT: readonly AsteroidLayout[] = [
  { x: -10.5, y: 4.2, z: -13, radius: 0.55, rotationX: 0.4, rotationY: 0.9, rotationZ: 0.2 },
  { x: -6.8, y: -3.1, z: -9.5, radius: 0.42, rotationX: 1.1, rotationY: 0.2, rotationZ: 0.7 },
  { x: -13.2, y: -5.6, z: -17, radius: 0.72, rotationX: 0.2, rotationY: 1.4, rotationZ: 0.5 },
  { x: 3.8, y: 7.4, z: -21, radius: 0.36, rotationX: 0.8, rotationY: 0.3, rotationZ: 1.2 },
  { x: -2.6, y: -7.8, z: -24, radius: 0.88, rotationX: 1.6, rotationY: 0.7, rotationZ: 0.1 },
  { x: 12.5, y: 6.2, z: -27, radius: 0.5, rotationX: 0.3, rotationY: 1.9, rotationZ: 0.9 },
  { x: 5.8, y: -5.2, z: -11.5, radius: 0.64, rotationX: 1.2, rotationY: 0.5, rotationZ: 1.5 },
];

/** Pinned meteor start positions (all behind the cube, inside the drift band). */
const METEOR_LAYOUT = [
  { x: -8.5, y: 5.5, z: -16 },
  { x: -12, y: 0.5, z: -22 },
  { x: 4.5, y: 9, z: -26 },
] as const;

/** The cosmic backdrop handed to the scene. */
export interface CosmicBackdrop {
  /** The single drawable group added to the scene; `group.name === 'cosmic-backdrop'`. */
  readonly group: Group;
  /** The generated nebula texture the scene uses as `scene.background` (owned here). */
  readonly nebulaTexture: DataTexture;
  /** The seven asteroids (`Mesh`, `DodecahedronGeometry`, `MeshStandardMaterial`). */
  readonly asteroids: readonly Mesh[];
  /** The three meteor groups, each holding a `meteor-head` and a `meteor-tail` mesh. */
  readonly meteors: readonly Group[];
  /** The comet group (`name === 'comet'`): `comet-head` + `comet-tail`. */
  readonly comet: Group;
  /** The hero-ship group (`name === 'hero-ship'`, `rotation.y === Math.PI / 2`). */
  readonly heroShip: Group;
  /**
   * Advances the backdrop by `dtMs` milliseconds (clamped with `Math.max(0, dtMs)`).
   * A positive advance moves every object; `reducedMotion === true` freezes every transform.
   */
  update(dtMs: number, reducedMotion?: boolean): void;
  /** Detaches the group, releases every owned geometry/material and the texture once. */
  dispose(): void;
}

/**
 * Builds the cosmic backdrop from `random`.
 *
 * Draw order: `random` is consumed only by {@link createNebulaTexture}; every mesh, material
 * and position is fixed, so the backdrop is deterministic regardless of the seed.
 */
export function createCosmicBackdrop(random: () => number): CosmicBackdrop {
  const group = new Group();
  group.name = 'cosmic-backdrop';

  const nebulaTexture = createNebulaTexture(random);
  /** Every mesh the backdrop owns, disposed exactly once (one geometry/material each). */
  const ownedMeshes: Mesh[] = [];
  const asteroids: Mesh[] = [];
  const meteors: Group[] = [];

  for (let index = 0; index < ASTEROID_LAYOUT.length; index += 1) {
    const layout = ASTEROID_LAYOUT[index]!;
    const asteroid = new Mesh(
      new DodecahedronGeometry(layout.radius, 0),
      new MeshStandardMaterial({
        color: ASTEROID_COLORS[index]!,
        metalness: 0.15,
        roughness: 0.9,
        flatShading: true,
      }),
    );
    asteroid.name = 'asteroid';
    asteroid.position.set(layout.x, layout.y, layout.z);
    asteroid.rotation.set(layout.rotationX, layout.rotationY, layout.rotationZ);
    asteroid.castShadow = false;
    asteroid.receiveShadow = false;
    asteroids.push(asteroid);
    ownedMeshes.push(asteroid);
    group.add(asteroid);
  }

  for (const layout of METEOR_LAYOUT) {
    const meteor = new Group();
    meteor.name = 'meteor';
    meteor.position.set(layout.x, layout.y, layout.z);

    const head = new Mesh(
      new SphereGeometry(0.16, 10, 8),
      new MeshBasicMaterial({ color: METEOR_HEAD_COLOR }),
    );
    head.name = 'meteor-head';

    // The tail trails the +x drift: the cone points to −x with its base at the head.
    const tail = new Mesh(
      new ConeGeometry(0.12, 1.1, 8),
      new MeshBasicMaterial({
        color: METEOR_TAIL_COLOR,
        transparent: true,
        opacity: 0.7,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    tail.name = 'meteor-tail';
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -0.55;

    head.castShadow = false;
    head.receiveShadow = false;
    tail.castShadow = false;
    tail.receiveShadow = false;
    meteor.add(head, tail);
    meteors.push(meteor);
    ownedMeshes.push(head, tail);
    group.add(meteor);
  }

  const comet = new Group();
  comet.name = 'comet';
  comet.position.set(COMET_POSITION.x, COMET_POSITION.y, COMET_POSITION.z);

  const cometHead = new Mesh(
    new SphereGeometry(0.55, 16, 12),
    new MeshBasicMaterial({ color: COMET_HEAD_COLOR }),
  );
  cometHead.name = 'comet-head';

  const cometTail = new Mesh(
    new ConeGeometry(0.42, 3.4, 16),
    new MeshBasicMaterial({
      color: COMET_TAIL_COLOR,
      transparent: true,
      opacity: 0.6,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  cometTail.name = 'comet-tail';
  cometTail.rotation.x = -Math.PI / 2;
  cometTail.position.z = -1.9;
  cometHead.castShadow = false;
  cometHead.receiveShadow = false;
  cometTail.castShadow = false;
  cometTail.receiveShadow = false;
  comet.add(cometHead, cometTail);
  ownedMeshes.push(cometHead, cometTail);
  group.add(comet);

  const heroShip = new Group();
  heroShip.name = 'hero-ship';
  heroShip.position.set(HERO_SHIP_POSITION.x, HERO_SHIP_POSITION.y, HERO_SHIP_POSITION.z);
  // The ship model points along local +z; the quarter turn makes the nose face world +x.
  heroShip.rotation.y = Math.PI / 2;

  const heroHull = new Mesh(
    new BoxGeometry(1, 0.42, 2.2),
    new MeshStandardMaterial({
      color: HERO_HULL_COLOR,
      metalness: 0.55,
      roughness: 0.35,
    }),
  );
  heroHull.name = 'hero-hull';

  const heroNose = new Mesh(
    new ConeGeometry(0.38, 1, 4),
    new MeshStandardMaterial({
      color: HERO_NOSE_COLOR,
      metalness: 0.5,
      roughness: 0.3,
    }),
  );
  heroNose.name = 'hero-nose';
  heroNose.position.z = 1.55;
  heroNose.rotation.x = Math.PI / 2;

  const heroWingLeft = new Mesh(
    new BoxGeometry(1.3, 0.1, 0.85),
    new MeshStandardMaterial({
      color: HERO_WING_COLOR,
      metalness: 0.5,
      roughness: 0.4,
    }),
  );
  heroWingLeft.name = 'hero-wing-left';
  heroWingLeft.position.set(-1, 0, -0.35);

  const heroWingRight = new Mesh(
    new BoxGeometry(1.3, 0.1, 0.85),
    new MeshStandardMaterial({
      color: HERO_WING_COLOR,
      metalness: 0.5,
      roughness: 0.4,
    }),
  );
  heroWingRight.name = 'hero-wing-right';
  heroWingRight.position.set(1, 0, -0.35);

  const heroCockpit = new Mesh(
    new SphereGeometry(0.3, 12, 10),
    new MeshStandardMaterial({
      color: HERO_COCKPIT_COLOR,
      metalness: 0.2,
      roughness: 0.15,
    }),
  );
  heroCockpit.name = 'hero-cockpit';
  heroCockpit.position.set(0, 0.3, 0.45);

  const heroEngines: Mesh[] = [];
  for (const offset of [-0.32, 0.32]) {
    const engine = new Mesh(
      new ConeGeometry(0.2, 0.8, 10),
      new MeshBasicMaterial({
        color: HERO_FLAME_COLOR,
        transparent: true,
        opacity: 0.9,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    engine.name = 'hero-engine';
    engine.position.set(offset, 0, -1.5);
    // The cone points backwards along local −z, away from the nose at local +z.
    engine.rotation.x = -Math.PI / 2;
    heroEngines.push(engine);
  }

  for (const mesh of [
    heroHull,
    heroNose,
    heroWingLeft,
    heroWingRight,
    heroCockpit,
    ...heroEngines,
  ]) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    ownedMeshes.push(mesh);
    heroShip.add(mesh);
  }
  group.add(heroShip);

  /** Accumulated comet bob phase in milliseconds. */
  let cometPhaseMs = 0;
  /** Accumulated hero-ship bob phase in milliseconds. */
  let heroPhaseMs = 0;
  let disposed = false;

  function update(dtMs: number, reducedMotion?: boolean): void {
    if (disposed) {
      return;
    }
    const advance = Math.max(0, dtMs);
    if (reducedMotion === true || advance <= 0) {
      return;
    }

    for (const asteroid of asteroids) {
      asteroid.rotation.x += COSMIC_ASTEROID_ROTATION_SPEED * advance;
    }

    for (const meteor of meteors) {
      meteor.position.x += COSMIC_METEOR_SPEED_X * advance;
      meteor.position.y += COSMIC_METEOR_SPEED_Y * advance;
      if (meteor.position.x > METEOR_BAND_MAX_X) {
        meteor.position.x = METEOR_BAND_MIN_X;
      }
      if (meteor.position.y > METEOR_BAND_MAX_Y) {
        meteor.position.y = METEOR_BAND_MIN_Y;
      }
    }

    cometPhaseMs += advance;
    comet.position.y =
      COMET_POSITION.y +
      Math.sin(cometPhaseMs * COSMIC_COMET_BOB_SPEED) * COSMIC_COMET_BOB_AMPLITUDE;

    heroPhaseMs += advance;
    heroShip.position.y =
      HERO_SHIP_POSITION.y +
      Math.sin(heroPhaseMs * COSMIC_HERO_BOB_SPEED) * COSMIC_HERO_BOB_AMPLITUDE;
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    if (group.parent !== null) {
      group.parent.remove(group);
    }
    for (const mesh of ownedMeshes) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial | MeshStandardMaterial).dispose();
    }
    ownedMeshes.length = 0;
    asteroids.length = 0;
    meteors.length = 0;
    nebulaTexture.dispose();
    group.clear();
  }

  return {
    group,
    nebulaTexture,
    get asteroids(): readonly Mesh[] {
      return asteroids;
    },
    get meteors(): readonly Group[] {
      return meteors;
    },
    comet,
    heroShip,
    update,
    dispose,
  };
}
