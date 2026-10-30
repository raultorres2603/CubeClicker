import { describe, expect, it } from 'vitest';

import {
  UPGRADE_CATALOG,
  UPGRADE_IDS,
  isValidUpgradeId,
  upgradeLevel,
  upgradeCost,
  miniCubeMultiplier,
  cubeMultiplier,
  speedWindowSeconds,
  type UpgradeState,
} from './upgrades.js';

describe('UPGRADE_CATALOG', () => {
  it('pins exactly three upgrades in the approved order', () => {
    expect(UPGRADE_CATALOG).toHaveLength(3);
    expect(UPGRADE_IDS).toEqual(['mini_cube_value', 'cube_value', 'speed_window']);
  });

  it('pins each upgrade id, name, baseCost and maxLevel', () => {
    expect(UPGRADE_CATALOG[0]).toEqual({
      id: 'mini_cube_value',
      name: 'Click Power',
      baseCost: 10,
      maxLevel: 10,
    });
    expect(UPGRADE_CATALOG[1]).toEqual({
      id: 'cube_value',
      name: 'Cube Bonus',
      baseCost: 50,
      maxLevel: 10,
    });
    expect(UPGRADE_CATALOG[2]).toEqual({
      id: 'speed_window',
      name: 'Quick Hands',
      baseCost: 25,
      maxLevel: 5,
    });
  });
});

describe('isValidUpgradeId', () => {
  it('accepts the three pinned ids and rejects everything else', () => {
    expect(isValidUpgradeId('mini_cube_value')).toBe(true);
    expect(isValidUpgradeId('cube_value')).toBe(true);
    expect(isValidUpgradeId('speed_window')).toBe(true);
    expect(isValidUpgradeId('')).toBe(false);
    expect(isValidUpgradeId('unknown')).toBe(false);
    expect(isValidUpgradeId('MINI_CUBE_VALUE')).toBe(false);
  });
});

describe('upgradeLevel', () => {
  it('returns 0 for a missing upgrade', () => {
    const upgrades: UpgradeState = {};
    expect(upgradeLevel(upgrades, 'mini_cube_value')).toBe(0);
    expect(upgradeLevel(upgrades, 'cube_value')).toBe(0);
    expect(upgradeLevel(upgrades, 'speed_window')).toBe(0);
  });

  it('reads the stored level', () => {
    const upgrades: UpgradeState = { mini_cube_value: 3, cube_value: 7, speed_window: 2 };
    expect(upgradeLevel(upgrades, 'mini_cube_value')).toBe(3);
    expect(upgradeLevel(upgrades, 'cube_value')).toBe(7);
    expect(upgradeLevel(upgrades, 'speed_window')).toBe(2);
  });

  it('treats a non-number as 0', () => {
    const upgrades = { mini_cube_value: '3' } as unknown as UpgradeState;
    expect(upgradeLevel(upgrades, 'mini_cube_value')).toBe(0);
  });
});

describe('upgradeCost', () => {
  it('computes baseCost * (currentLevel + 1) for mini_cube_value', () => {
    expect(upgradeCost('mini_cube_value', 0)).toBe(10);
    expect(upgradeCost('mini_cube_value', 1)).toBe(20);
    expect(upgradeCost('mini_cube_value', 9)).toBe(100);
  });

  it('computes baseCost * (currentLevel + 1) for cube_value', () => {
    expect(upgradeCost('cube_value', 0)).toBe(50);
    expect(upgradeCost('cube_value', 1)).toBe(100);
    expect(upgradeCost('cube_value', 9)).toBe(500);
  });

  it('computes baseCost * (currentLevel + 1) for speed_window', () => {
    expect(upgradeCost('speed_window', 0)).toBe(25);
    expect(upgradeCost('speed_window', 1)).toBe(50);
    expect(upgradeCost('speed_window', 4)).toBe(125);
  });

  it('returns Infinity at max level', () => {
    expect(upgradeCost('mini_cube_value', 10)).toBe(Infinity);
    expect(upgradeCost('cube_value', 10)).toBe(Infinity);
    expect(upgradeCost('speed_window', 5)).toBe(Infinity);
  });

  it('returns Infinity for levels beyond max', () => {
    expect(upgradeCost('mini_cube_value', 11)).toBe(Infinity);
    expect(upgradeCost('speed_window', 6)).toBe(Infinity);
  });
});

describe('miniCubeMultiplier', () => {
  it('is 1 with no upgrades', () => {
    expect(miniCubeMultiplier({})).toBe(1);
  });

  it('adds 10% per level', () => {
    expect(miniCubeMultiplier({ mini_cube_value: 1 })).toBeCloseTo(1.1, 10);
    expect(miniCubeMultiplier({ mini_cube_value: 10 })).toBeCloseTo(2.0, 10);
  });

  it('ignores unrelated upgrades', () => {
    expect(miniCubeMultiplier({ cube_value: 5, speed_window: 3 })).toBe(1);
  });
});

describe('cubeMultiplier', () => {
  it('is 1 with no upgrades', () => {
    expect(cubeMultiplier({})).toBe(1);
  });

  it('adds 10% per level', () => {
    expect(cubeMultiplier({ cube_value: 1 })).toBeCloseTo(1.1, 10);
    expect(cubeMultiplier({ cube_value: 10 })).toBeCloseTo(2.0, 10);
  });

  it('ignores unrelated upgrades', () => {
    expect(cubeMultiplier({ mini_cube_value: 5 })).toBe(1);
  });
});

describe('speedWindowSeconds', () => {
  it('is 0 with no upgrades', () => {
    expect(speedWindowSeconds({})).toBe(0);
  });

  it('adds 2 seconds per level', () => {
    expect(speedWindowSeconds({ speed_window: 1 })).toBe(2);
    expect(speedWindowSeconds({ speed_window: 5 })).toBe(10);
  });

  it('ignores unrelated upgrades', () => {
    expect(speedWindowSeconds({ mini_cube_value: 5 })).toBe(0);
  });
});
