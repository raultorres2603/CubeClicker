import { describe, expect, it } from 'vitest';

import {
  CUBE_STYLE_IDS,
  FACE_IDS,
  MAX_GRID_SIZE,
  MIN_GRID_SIZE,
  allIds,
  createNextCube,
  isComplete,
  styleForLevel,
  validateExplode,
  type CubeState,
} from './cubes.js';

/** A cube fixture: level, grid edge and the ids already removed. */
function cube(levelIndex: number, gridSize: number, removed: readonly string[] = []): CubeState {
  return { levelIndex, gridSize, styleId: styleForLevel(levelIndex), removedIds: new Set(removed) };
}

/** A random source that always returns `value`, counting how many draws it served. */
function countingRandom(value: number): { random: () => number; draws: () => number } {
  let calls = 0;
  return {
    random: () => {
      calls += 1;
      return value;
    },
    draws: () => calls,
  };
}

describe('pinned constants', () => {
  it('pins the accepted grid-edge bounds of the engine (3..7)', () => {
    expect(MIN_GRID_SIZE).toBe(3);
    expect(MAX_GRID_SIZE).toBe(7);
  });

  it('mirrors the frontend face order', () => {
    expect(FACE_IDS).toEqual(['front', 'back', 'left', 'right', 'top', 'bottom']);
  });

  it('mirrors the accepted five-style cycle', () => {
    expect(CUBE_STYLE_IDS).toEqual([
      'obsidian-neon',
      'crimson-alloy',
      'emerald-crystal',
      'solar-gold',
      'violet-nebula',
    ]);
    expect(CUBE_STYLE_IDS).toHaveLength(5);
  });
});

describe('allIds', () => {
  it('lists the 54 ids of a 3×3 level in face, row, column order', () => {
    expect(allIds(3)).toEqual([
      'front:0:0',
      'front:0:1',
      'front:0:2',
      'front:1:0',
      'front:1:1',
      'front:1:2',
      'front:2:0',
      'front:2:1',
      'front:2:2',
      'back:0:0',
      'back:0:1',
      'back:0:2',
      'back:1:0',
      'back:1:1',
      'back:1:2',
      'back:2:0',
      'back:2:1',
      'back:2:2',
      'left:0:0',
      'left:0:1',
      'left:0:2',
      'left:1:0',
      'left:1:1',
      'left:1:2',
      'left:2:0',
      'left:2:1',
      'left:2:2',
      'right:0:0',
      'right:0:1',
      'right:0:2',
      'right:1:0',
      'right:1:1',
      'right:1:2',
      'right:2:0',
      'right:2:1',
      'right:2:2',
      'top:0:0',
      'top:0:1',
      'top:0:2',
      'top:1:0',
      'top:1:1',
      'top:1:2',
      'top:2:0',
      'top:2:1',
      'top:2:2',
      'bottom:0:0',
      'bottom:0:1',
      'bottom:0:2',
      'bottom:1:0',
      'bottom:1:1',
      'bottom:1:2',
      'bottom:2:0',
      'bottom:2:1',
      'bottom:2:2',
    ]);
  });

  it('lists all 294 ids of a 7×7 level with the same ordering', () => {
    const ids = allIds(7);

    expect(ids).toHaveLength(294);
    expect(ids[0]).toBe('front:0:0');
    expect(ids[48]).toBe('front:6:6');
    expect(ids[49]).toBe('back:0:0');
    expect(ids[97]).toBe('back:6:6');
    expect(ids[98]).toBe('left:0:0');
    expect(ids[293]).toBe('bottom:6:6');
    expect(new Set(ids).size).toBe(294);
  });

  it('scales the count with 6·N²', () => {
    expect(allIds(3)).toHaveLength(6 * 3 ** 2);
    expect(allIds(4)).toHaveLength(6 * 4 ** 2);
    expect(allIds(5)).toHaveLength(6 * 5 ** 2);
    expect(allIds(6)).toHaveLength(6 * 6 ** 2);
    expect(allIds(7)).toHaveLength(6 * 7 ** 2);
  });
});

describe('styleForLevel', () => {
  it('selects the accepted cycle by level index and wraps after the fifth style', () => {
    expect(styleForLevel(0)).toBe('obsidian-neon');
    expect(styleForLevel(1)).toBe('crimson-alloy');
    expect(styleForLevel(2)).toBe('emerald-crystal');
    expect(styleForLevel(3)).toBe('solar-gold');
    expect(styleForLevel(4)).toBe('violet-nebula');
    expect(styleForLevel(5)).toBe('obsidian-neon');
    expect(styleForLevel(6)).toBe('crimson-alloy');
  });
});

describe('createNextCube', () => {
  it('creates the first cube at level 0 from exactly one draw', () => {
    const source = countingRandom(0);
    const next = createNextCube(null, styleForLevel, source.random);

    expect(next.levelIndex).toBe(0);
    expect(next.gridSize).toBe(3);
    expect(next.styleId).toBe('obsidian-neon');
    expect(next.removedIds).toEqual(new Set());
    expect(source.draws()).toBe(1);
  });

  it('pins the grid draw N = 3 + ⌊draw·5⌋ for concrete draws', () => {
    const cases: ReadonlyArray<readonly [number, number]> = [
      [0, 3],
      [0.1999, 3],
      [0.2, 4],
      [0.5, 5],
      [0.6, 6],
      [0.99, 7],
      [0.9999, 7],
    ];

    for (const [draw, expectedGridSize] of cases) {
      const source = countingRandom(draw);
      const next = createNextCube(null, styleForLevel, source.random);

      expect(next.gridSize).toBe(expectedGridSize);
      expect(source.draws()).toBe(1);
    }
  });

  it('advances one level per cube and cycles the style ids across two advances', () => {
    const first = createNextCube(null, styleForLevel, () => 0);
    const second = createNextCube(first, styleForLevel, () => 0);
    const third = createNextCube(second, styleForLevel, () => 0);

    expect([first.levelIndex, second.levelIndex, third.levelIndex]).toEqual([0, 1, 2]);
    expect([first.styleId, second.styleId, third.styleId]).toEqual([
      'obsidian-neon',
      'crimson-alloy',
      'emerald-crystal',
    ]);
    expect([first.gridSize, second.gridSize, third.gridSize]).toEqual([3, 3, 3]);
  });

  it('wraps the style cycle from level 4 to level 5', () => {
    const fourth = createNextCube(null, styleForLevel, () => 0.9999);
    const atFour = { ...fourth, levelIndex: 4, styleId: styleForLevel(4) };
    const atFive = createNextCube(atFour, styleForLevel, () => 0.5);

    expect(atFour.styleId).toBe('violet-nebula');
    expect(atFive.levelIndex).toBe(5);
    expect(atFive.styleId).toBe('obsidian-neon');
    expect(atFive.gridSize).toBe(5);
  });

  it('allocates a fresh empty removed set and leaves the previous cube untouched', () => {
    const previous = cube(2, 3, ['front:0:0', 'front:0:1']);
    const next = createNextCube(previous, styleForLevel, () => 0);

    expect(next.levelIndex).toBe(3);
    expect(next.styleId).toBe('solar-gold');
    expect(next.removedIds.size).toBe(0);
    expect(next.removedIds.has('front:0:0')).toBe(false);
    expect(next.removedIds).not.toBe(previous.removedIds);
    expect(previous.removedIds.size).toBe(2);
  });

  it('uses the injected style lookup with the advanced level index', () => {
    const requested: number[] = [];
    const styleFor = (levelIndex: number): string => {
      requested.push(levelIndex);
      return 'injected-style';
    };
    const next = createNextCube(cube(6, 7), styleFor, () => 0.9999);

    expect(next.levelIndex).toBe(7);
    expect(next.gridSize).toBe(7);
    expect(next.styleId).toBe('injected-style');
    expect(requested).toEqual([7]);
  });
});

describe('validateExplode', () => {
  it('accepts an existing, unremoved id of the current level (N = 3)', () => {
    const current = cube(2, 3, ['front:0:0']);

    expect(validateExplode(current, 'front:0:1', 2)).toBe(true);
    expect(validateExplode(current, 'back:2:2', 2)).toBe(true);
    expect(validateExplode(current, 'bottom:1:0', 2)).toBe(true);
  });

  it('rejects an id that was already removed (N = 3)', () => {
    const current = cube(2, 3, ['front:0:0']);

    expect(validateExplode(current, 'front:0:0', 2)).toBe(false);
  });

  it('rejects unknown or malformed ids (N = 3)', () => {
    const current = cube(2, 3);

    for (const id of [
      'front:0:3',
      'front:3:0',
      'bottom:2:3',
      'middle:0:0',
      'FRONT:0:0',
      'front:0',
      'front:0:0:0',
      'front:00:0',
      'front:0:00',
      'front:-0:0',
      'front:0.0:0',
      'front:0:0 ',
      '',
    ]) {
      expect(validateExplode(current, id, 2)).toBe(false);
    }
  });

  it('rejects a stale or future level (N = 3)', () => {
    const current = cube(2, 3);

    expect(validateExplode(current, 'front:0:0', 1)).toBe(false);
    expect(validateExplode(current, 'front:0:0', 3)).toBe(false);
    expect(validateExplode(current, 'front:0:0', 0)).toBe(false);
  });

  it('applies the same matrix for N = 7', () => {
    const current = cube(0, 7, ['bottom:6:6']);

    expect(validateExplode(current, 'front:0:0', 0)).toBe(true);
    expect(validateExplode(current, 'front:0:3', 0)).toBe(true);
    expect(validateExplode(current, 'bottom:6:5', 0)).toBe(true);
    expect(validateExplode(current, 'top:6:6', 0)).toBe(true);

    expect(validateExplode(current, 'bottom:6:6', 0)).toBe(false);
    expect(validateExplode(current, 'bottom:7:0', 0)).toBe(false);
    expect(validateExplode(current, 'front:7:0', 0)).toBe(false);
    expect(validateExplode(current, 'front:0', 0)).toBe(false);
    expect(validateExplode(current, 'front:0:0', 4)).toBe(false);
  });

  it('validates the id against the cube’s own grid edge', () => {
    // `front:0:3` exists only from N = 4 on: the same id must flip with the grid edge.
    expect(validateExplode(cube(2, 3), 'front:0:3', 2)).toBe(false);
    expect(validateExplode(cube(2, 4), 'front:0:3', 2)).toBe(true);
  });
});

describe('isComplete', () => {
  it('is false one removal short and true on the full 3×3 board', () => {
    const ids = allIds(3);
    const oneShort = cube(0, 3, ids.slice(0, ids.length - 1));
    const full = cube(0, 3, ids);

    expect(ids).toHaveLength(54);
    expect(oneShort.removedIds.size).toBe(53);
    expect(isComplete(oneShort, 0)).toBe(false);
    expect(isComplete(full, 0)).toBe(true);
  });

  it('is false one removal short and true on the full 7×7 board', () => {
    const ids = allIds(7);
    const oneShort = cube(3, 7, ids.slice(0, ids.length - 1));
    const full = cube(3, 7, ids);

    expect(ids).toHaveLength(294);
    expect(oneShort.removedIds.size).toBe(293);
    expect(isComplete(oneShort, 3)).toBe(false);
    expect(isComplete(full, 3)).toBe(true);
  });

  it('rejects a full board reported for another level', () => {
    const full = cube(2, 3, allIds(3));

    expect(isComplete(full, 1)).toBe(false);
    expect(isComplete(full, 3)).toBe(false);
    expect(isComplete(full, 2)).toBe(true);
  });

  it('requires coverage of the canonical ids, not a large enough set', () => {
    const ids = allIds(3);
    const almost = cube(0, 3, [...ids.slice(0, ids.length - 1), 'front:9:9']);

    expect(almost.removedIds.size).toBe(54);
    expect(isComplete(almost, 0)).toBe(false);
  });

  it('is false for an untouched cube', () => {
    expect(isComplete(cube(0, 3), 0)).toBe(false);
    expect(isComplete(cube(0, 7), 0)).toBe(false);
  });
});
