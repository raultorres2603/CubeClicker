import { describe, expect, it } from 'vitest';

import {
  COIN_DECIMALS,
  COINS_PER_CUBE,
  COINS_PER_MINI_CUBE,
  SPEED_BONUS_MULTIPLIER,
  roundCoins,
  speedBonusApplies,
  thresholdSeconds,
} from './economy';

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
});