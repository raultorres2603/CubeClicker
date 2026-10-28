/**
 * Backend economy constants and pure helpers (T1).
 *
 * Pinned values (approval-gated by Q-1/Q-2/Q-3 in the coin-economy spec; approved
 * defaults recorded here):
 *   - Q-1 `COINS_PER_MINI_CUBE = 0.1`
 *   - Q-2 `COINS_PER_CUBE = 5`
 *   - Q-3 `thresholdSeconds(gridSize) = gridSize * 5`
 *   - Q-4 (default with notice): the speed bonus doubles only the per-cube
 *     completion reward (`COINS_PER_CUBE`), never the mini-cube coins.
 *   - Q-8 (default with notice): coin precision is 2 decimals, rounded half-up.
 *
 * Everything here is pure: no I/O, no timers, no DOM. The frontend mirrors the
 * same values in `src/frontend/src/game/economy.ts` for optimistic UX; server
 * totals reconcile.
 */

/** Coins awarded for destroying one mini-cube (Q-1, approval-gated). */
export const COINS_PER_MINI_CUBE = 0.1;

/** Coins awarded for completing a cube, before any speed bonus (Q-2, approval-gated). */
export const COINS_PER_CUBE = 5;

/** Multiplier applied to `COINS_PER_CUBE` when the speed bonus applies (Q-4). */
export const SPEED_BONUS_MULTIPLIER = 2;

/** Coin precision: number of decimal places (Q-8). */
export const COIN_DECIMALS = 2;

/**
 * Size-dependent speed-bonus threshold in seconds (Q-3, approval-gated).
 *
 * Increases with `gridSize`: a grid-3 cube allows 15 s, a grid-7 cube 35 s.
 */
export function thresholdSeconds(gridSize: number): number {
  return gridSize * 5;
}

/**
 * Rounds a coin value to {@link COIN_DECIMALS} decimals, half-up (Q-8).
 *
 * Coins are non-negative in practice; the rounding is half-up for positives.
 */
export function roundCoins(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Whether the speed bonus applies for a cube completed `elapsedMs` milliseconds
 * after that cube started, given its `gridSize`.
 *
 * The threshold is converted to milliseconds; completing exactly at the threshold
 * still qualifies (boundary inclusive).
 */
export function speedBonusApplies(elapsedMs: number, gridSize: number): boolean {
  return elapsedMs <= thresholdSeconds(gridSize) * 1000;
}
