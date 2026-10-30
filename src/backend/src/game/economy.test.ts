import { describe, expect, it } from 'vitest';

import {
  COIN_DECIMALS,
  COINS_PER_CUBE,
  COINS_PER_MINI_CUBE,
  IDLE_CAP_MS,
  IDLE_COINS_PER_SECOND,
  IDLE_MIN_AWAY_MS,
  SPEED_BONUS_MULTIPLIER,
  idleCoins,
  idleMultiplier,
  roundCoins,
  speedBonusApplies,
  thresholdSeconds,
} from './economy.js';
import { miniCubeMultiplier } from './upgrades.js';
import type { UpgradeState } from './upgrades.js';

describe('economy constants', () => {
  it('pins the approved default values', () => {
    expect(COINS_PER_MINI_CUBE).toBe(0.1);
    expect(COINS_PER_CUBE).toBe(5);
    expect(SPEED_BONUS_MULTIPLIER).toBe(2);
    expect(COIN_DECIMALS).toBe(2);
  });
});

describe('thresholdSeconds', () => {
  it('returns gridSize * 5 seconds', () => {
    expect(thresholdSeconds(3)).toBe(15);
    expect(thresholdSeconds(7)).toBe(35);
    expect(thresholdSeconds(5)).toBe(25);
  });

  it('increases with gridSize', () => {
    expect(thresholdSeconds(4)).toBeGreaterThan(thresholdSeconds(3));
    expect(thresholdSeconds(7)).toBeGreaterThan(thresholdSeconds(3));
  });
});

describe('speedBonusApplies', () => {
  it('applies when elapsed is below the threshold', () => {
    expect(speedBonusApplies(14_999, 3)).toBe(true);
    expect(speedBonusApplies(0, 3)).toBe(true);
  });

  it('applies at exactly the threshold (inclusive boundary)', () => {
    expect(speedBonusApplies(15_000, 3)).toBe(true);
    expect(speedBonusApplies(35_000, 7)).toBe(true);
  });

  it('does not apply one millisecond past the threshold', () => {
    expect(speedBonusApplies(15_001, 3)).toBe(false);
    expect(speedBonusApplies(35_001, 7)).toBe(false);
  });
});

describe('roundCoins', () => {
  it('rounds to two decimals, half-up', () => {
    expect(roundCoins(0.1)).toBe(0.1);
    expect(roundCoins(0.123)).toBe(0.12);
    expect(roundCoins(0.125)).toBe(0.13);
    expect(roundCoins(0.126)).toBe(0.13);
    expect(roundCoins(0.124)).toBe(0.12);
  });

  it('rounds a sum that drifts in floating point', () => {
    expect(roundCoins(0.1 + 0.2)).toBe(0.3);
  });

  it('keeps an already-rounded value unchanged', () => {
    expect(roundCoins(5)).toBe(5);
    expect(roundCoins(2.5)).toBe(2.5);
  });
});

describe('idle constants', () => {
  it('pins the approved default values', () => {
    expect(IDLE_COINS_PER_SECOND).toBe(0.01);
    expect(IDLE_CAP_MS).toBe(8 * 60 * 60 * 1000);
    expect(IDLE_MIN_AWAY_MS).toBe(60 * 1000);
  });
});

describe('idleMultiplier', () => {
  it('equals miniCubeMultiplier (Click Power applies, others do not)', () => {
    const cases: UpgradeState[] = [
      {},
      { mini_cube_value: 3 },
      { cube_value: 5, speed_window: 2 },
      { mini_cube_value: 10, cube_value: 10, speed_window: 5 },
    ];
    for (const upgrades of cases) {
      expect(idleMultiplier(upgrades)).toBe(miniCubeMultiplier(upgrades));
    }
  });

  it('does not depend on cube level (no level parameter)', () => {
    expect(idleMultiplier({ mini_cube_value: 2 })).toBe(miniCubeMultiplier({ mini_cube_value: 2 }));
  });
});

describe('idleCoins', () => {
  it('returns 0 when elapsed is below the threshold', () => {
    expect(idleCoins(0, {})).toBe(0);
    expect(idleCoins(-1000, {})).toBe(0);
    expect(idleCoins(59_999, {})).toBe(0);
    expect(idleCoins(IDLE_MIN_AWAY_MS - 1, {})).toBe(0);
  });

  it('returns 0 at exactly one millisecond below threshold', () => {
    expect(idleCoins(59_999, { mini_cube_value: 5 })).toBe(0);
  });

  it('accrues at the threshold boundary', () => {
    expect(idleCoins(IDLE_MIN_AWAY_MS, {})).toBe(0.6);
  });

  it('rounds once to two decimals', () => {
    // 90s * 0.01 = 0.9 (exact-ish)
    expect(idleCoins(90_000, {})).toBe(0.9);
    // 12345ms -> 12.345s * 0.01 = 0.12345 -> 0.12
    expect(idleCoins(12_345, {})).toBe(0); // below 1 min -> 0
    expect(idleCoins(120_000, {})).toBe(1.2);
  });

  it('caps elapsed time at IDLE_CAP_MS', () => {
    const atCap = idleCoins(IDLE_CAP_MS, {});
    const beyond = idleCoins(IDLE_CAP_MS + 1_000_000, {});
    expect(beyond).toBe(atCap);
    expect(atCap).toBe(288);
  });

  it('applies the upgrade multiplier (Click Power)', () => {
    expect(idleCoins(60_000, { mini_cube_value: 3 })).toBe(0.78);
  });

  it('ignores Cube Bonus and speed window', () => {
    expect(idleCoins(60_000, { cube_value: 5, speed_window: 3 })).toBe(0.6);
  });

  it('combines multiplier and cap', () => {
    expect(idleCoins(IDLE_CAP_MS, { mini_cube_value: 10 })).toBe(576);
  });
});
