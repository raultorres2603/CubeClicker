/**
 * Frontend economy constants and pure helpers (T9) — mirror of
 * `src/backend/src/game/economy.ts`. Pinned values (approval-gated by Q-1/Q-2/Q-3):
 *   - Q-1 `COINS_PER_MINI_CUBE = 0.1`
 *   - Q-2 `COINS_PER_CUBE = 5`
 *   - Q-3 `thresholdSeconds(gridSize) = gridSize * 5`
 *
 * Pure: no I/O, no timers, no DOM. The frontend computes coins optimistically for UX
 * using these; server totals reconcile via `adoptEconomy`.
 */
export const COINS_PER_MINI_CUBE = 0.1;

export const COINS_PER_CUBE = 5;

export const SPEED_BONUS_MULTIPLIER = 2;

export const COIN_DECIMALS = 2;

export function thresholdSeconds(gridSize: number): number {
  return gridSize * 5;
}

export function roundCoins(value: number): number {
  return Math.round(value * 100) / 100;
}

export function speedBonusApplies(elapsedMs: number, gridSize: number): boolean {
  return elapsedMs <= thresholdSeconds(gridSize) * 1000;
}