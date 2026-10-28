import { Mesh } from 'three';
import { describe, expect, it } from 'vitest';

import {
  BACKGROUND_LIFE_SHOOTING_STAR_COUNT,
  BACKGROUND_LIFE_SHOOTING_STAR_SPEED,
  BACKGROUND_LIFE_SPACESHIP_COUNT,
  BACKGROUND_LIFE_SPACESHIP_SPEED,
  createBackgroundLife,
} from './background-life';

function sequenceRandom(draws: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = draws[index % draws.length];
    index += 1;
    return value;
  };
}

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('background-life constants (AC-7)', () => {
  it('pins the shooting-star and spaceship counts', () => {
    expect(BACKGROUND_LIFE_SHOOTING_STAR_COUNT).toBe(5);
    expect(BACKGROUND_LIFE_SPACESHIP_COUNT).toBe(3);
  });

  it('exports finite positive speeds', () => {
    expect(Number.isFinite(BACKGROUND_LIFE_SHOOTING_STAR_SPEED)).toBe(true);
    expect(BACKGROUND_LIFE_SHOOTING_STAR_SPEED).toBeGreaterThan(0);
    expect(Number.isFinite(BACKGROUND_LIFE_SPACESHIP_SPEED)).toBe(true);
    expect(BACKGROUND_LIFE_SPACESHIP_SPEED).toBeGreaterThan(0);
  });
});

describe('createBackgroundLife (AC-7)', () => {
  it('builds a group named background-life', () => {
    const bg = createBackgroundLife(seededRandom(1));
    expect(bg.group.name).toBe('background-life');
    expect(bg.group.children.length).toBe(
      BACKGROUND_LIFE_SHOOTING_STAR_COUNT + BACKGROUND_LIFE_SPACESHIP_COUNT,
    );
  });

  it('exposes the pinned counts as arrays of Mesh', () => {
    const bg = createBackgroundLife(seededRandom(2));
    expect(bg.shootingStars.length).toBe(BACKGROUND_LIFE_SHOOTING_STAR_COUNT);
    expect(bg.spaceships.length).toBe(BACKGROUND_LIFE_SPACESHIP_COUNT);
    for (const star of bg.shootingStars) {
      expect(star).toBeInstanceOf(Mesh);
    }
    for (const ship of bg.spaceships) {
      expect(ship).toBeInstanceOf(Mesh);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = createBackgroundLife(seededRandom(7));
    const b = createBackgroundLife(seededRandom(7));
    const aPos = a.shootingStars.map((s) => s.position.toArray());
    const bPos = b.shootingStars.map((s) => s.position.toArray());
    expect(bPos).toEqual(aPos);
  });
});

describe('background-life motion (AC-8)', () => {
  it('clamps negative dtMs so nothing advances', () => {
    const bg = createBackgroundLife(sequenceRandom([0.5]));
    const before = bg.shootingStars.map((s) => s.position.x);
    bg.update(-100);
    const after = bg.shootingStars.map((s) => s.position.x);
    expect(after).toEqual(before);
    const shipBefore = bg.spaceships.map((s) => s.position.toArray());
    bg.update(-50);
    const shipAfter = bg.spaceships.map((s) => s.position.toArray());
    expect(shipAfter).toEqual(shipBefore);
  });

  it('advances shooting stars along x for a positive dtMs', () => {
    const bg = createBackgroundLife(sequenceRandom([0.5]));
    const before = bg.shootingStars.map((s) => s.position.x);
    bg.update(100);
    const after = bg.shootingStars.map((s) => s.position.x);
    const delta = BACKGROUND_LIFE_SHOOTING_STAR_SPEED * 100;
    for (let index = 0; index < after.length; index += 1) {
      expect(after[index]).toBeCloseTo(before[index]! + delta, 5);
    }
  });

  it('advances spaceships for a positive dtMs', () => {
    const bg = createBackgroundLife(sequenceRandom([0.5]));
    const before = bg.spaceships.map((s) => s.position.toArray());
    bg.update(100);
    const after = bg.spaceships.map((s) => s.position.toArray());
    let changed = false;
    for (let index = 0; index < after.length; index += 1) {
      if (after[index]![0] !== before[index]![0] || after[index]![1] !== before[index]![1]) {
        changed = true;
      }
    }
    expect(changed).toBe(true);
  });

  it('recycles a shooting star to the opposite edge for a large dtMs', () => {
    const bg = createBackgroundLife(sequenceRandom([0.99]));
    bg.update(100000);
    for (const star of bg.shootingStars) {
      expect(star.position.x).toBeGreaterThanOrEqual(-40);
      expect(star.position.x).toBeLessThanOrEqual(40);
    }
    const leftSide = bg.shootingStars.filter((s) => s.position.x < 0);
    expect(leftSide.length).toBeGreaterThan(0);
  });

  it('is a no-op under reduced motion for any positive dtMs', () => {
    const bg = createBackgroundLife(sequenceRandom([0.5]));
    const starBefore = bg.shootingStars.map((s) => s.position.toArray());
    const shipBefore = bg.spaceships.map((s) => s.position.toArray());
    bg.update(1000, true);
    const starAfter = bg.shootingStars.map((s) => s.position.toArray());
    const shipAfter = bg.spaceships.map((s) => s.position.toArray());
    expect(starAfter).toEqual(starBefore);
    expect(shipAfter).toEqual(shipBefore);
  });

  it('update is a no-op after dispose', () => {
    const bg = createBackgroundLife(sequenceRandom([0.5]));
    bg.dispose();
    bg.update(100);
    expect(bg.shootingStars.length).toBe(0);
  });

  it('defaults reducedMotion to false (motion happens)', () => {
    const bg = createBackgroundLife(sequenceRandom([0.5]));
    const before = bg.shootingStars.map((s) => s.position.x);
    bg.update(100);
    const after = bg.shootingStars.map((s) => s.position.x);
    expect(after).not.toEqual(before);
  });
});

describe('background-life dispose (AC-7)', () => {
  it('clears the group', () => {
    const bg = createBackgroundLife(seededRandom(3));
    bg.dispose();
    expect(bg.group.children.length).toBe(0);
  });

  it('dispose is idempotent', () => {
    const bg = createBackgroundLife(seededRandom(3));
    bg.dispose();
    bg.dispose();
    expect(bg.group.children.length).toBe(0);
  });
});
