/**
 * Procedural "background life" backdrop: a fixed set of shooting stars and distant
 * spaceships (T4 — modern-ui-background-life spec AC-7/AC-8).
 */

import { BoxGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';

export const BACKGROUND_LIFE_SHOOTING_STAR_COUNT = 5;
export const BACKGROUND_LIFE_SPACESHIP_COUNT = 3;
export const BACKGROUND_LIFE_SHOOTING_STAR_SPEED = 0.05;
export const BACKGROUND_LIFE_SPACESHIP_SPEED = 0.0005;

const SHOOTING_STAR_X_MIN = -40;
const SHOOTING_STAR_X_MAX = 40;
const SHOOTING_STAR_Y_RANGE = 30;
const SHOOTING_STAR_Z_BASE = -50;
const SHOOTING_STAR_Z_RANGE = 10;

const SPACESHIP_ORBIT_RADIUS = 35;
const SPACESHIP_Z = -70;

export interface BackgroundLife {
  readonly group: Group;
  readonly shootingStars: readonly Mesh[];
  readonly spaceships: readonly Mesh[];
  update(dtMs: number, reducedMotion?: boolean): void;
  dispose(): void;
}

export function createBackgroundLife(random: () => number): BackgroundLife {
  const group = new Group();
  group.name = 'background-life';

  const shootingStars: Mesh[] = [];
  for (let index = 0; index < BACKGROUND_LIFE_SHOOTING_STAR_COUNT; index += 1) {
    const star = new Mesh(
      new SphereGeometry(0.15, 6, 6),
      new MeshBasicMaterial({ color: 0xffffff }),
    );
    star.name = 'shooting-star';
    star.position.set(
      SHOOTING_STAR_X_MIN + random() * (SHOOTING_STAR_X_MAX - SHOOTING_STAR_X_MIN),
      (random() - 0.5) * SHOOTING_STAR_Y_RANGE,
      SHOOTING_STAR_Z_BASE + (random() - 0.5) * SHOOTING_STAR_Z_RANGE,
    );
    shootingStars.push(star);
    group.add(star);
  }

  const spaceships: Mesh[] = [];
  const shipAngles: number[] = [];
  for (let index = 0; index < BACKGROUND_LIFE_SPACESHIP_COUNT; index += 1) {
    const ship = new Mesh(
      new BoxGeometry(0.6, 0.2, 0.3),
      new MeshBasicMaterial({ color: 0x88aaff }),
    );
    ship.name = 'background-spaceship';
    const angle = random() * Math.PI * 2;
    shipAngles.push(angle);
    ship.position.set(
      SPACESHIP_ORBIT_RADIUS * Math.cos(angle),
      SPACESHIP_ORBIT_RADIUS * Math.sin(angle),
      SPACESHIP_Z,
    );
    spaceships.push(ship);
    group.add(ship);
  }

  let disposed = false;

  function update(dtMs: number, reducedMotion?: boolean): void {
    if (disposed) {
      return;
    }
    const advance = Math.max(0, dtMs);
    if (reducedMotion === true) {
      return;
    }
    if (advance <= 0) {
      return;
    }

    for (const star of shootingStars) {
      star.position.x += BACKGROUND_LIFE_SHOOTING_STAR_SPEED * advance;
      if (star.position.x > SHOOTING_STAR_X_MAX) {
        star.position.x = SHOOTING_STAR_X_MIN + random() * 4;
        star.position.y = (random() - 0.5) * SHOOTING_STAR_Y_RANGE;
        star.position.z = SHOOTING_STAR_Z_BASE + (random() - 0.5) * SHOOTING_STAR_Z_RANGE;
      }
    }

    for (let index = 0; index < spaceships.length; index += 1) {
      const ship = spaceships[index]!;
      shipAngles[index] = shipAngles[index]! + BACKGROUND_LIFE_SPACESHIP_SPEED * advance;
      const angle = shipAngles[index]!;
      ship.position.x = SPACESHIP_ORBIT_RADIUS * Math.cos(angle);
      ship.position.y = SPACESHIP_ORBIT_RADIUS * Math.sin(angle);
      ship.position.z = SPACESHIP_Z;
    }
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    for (const star of shootingStars) {
      star.geometry.dispose();
      (star.material as { dispose(): void }).dispose();
    }
    for (const ship of spaceships) {
      ship.geometry.dispose();
      (ship.material as { dispose(): void }).dispose();
    }
    group.clear();
    shootingStars.length = 0;
    spaceships.length = 0;
  }

  return {
    group,
    get shootingStars(): readonly Mesh[] {
      return shootingStars;
    },
    get spaceships(): readonly Mesh[] {
      return spaceships;
    },
    update,
    dispose,
  };
}
