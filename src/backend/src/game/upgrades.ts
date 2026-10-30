/**
 * Backend upgrades constants and pure helpers (T1).
 *
 * Pinned values (approval-gated by Q-1/Q-2/Q-3 in the spending-upgrades spec; approved
 * defaults recorded here):
 *   - Q-1 catalog: `mini_cube_value` ("Click Power", +10% coins per mini-cube per
 *     level, max 10), `cube_value` ("Cube Bonus", +10% coins per cube per level,
 *     max 10), `speed_window` ("Quick Hands", +2 s to the speed-bonus threshold
 *     per level, max 5).
 *   - Q-2 cost formula: `cost = baseCost * (currentLevel + 1)` with base costs
 *     10 / 50 / 25 coins.
 *   - Q-3 max levels: 10 / 10 / 5.
 *
 * Everything here is pure: no I/O, no timers, no DOM. The frontend mirrors the
 * same values in `src/frontend/src/game/upgrades.ts` for optimistic UX; server
 * totals/levels reconcile.
 */

export type UpgradeId = 'mini_cube_value' | 'cube_value' | 'speed_window';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  baseCost: number;
  maxLevel: number;
}

export type UpgradeState = Record<string, number>;

export const UPGRADE_CATALOG: readonly UpgradeDef[] = [
  { id: 'mini_cube_value', name: 'Click Power', baseCost: 10, maxLevel: 10 },
  { id: 'cube_value', name: 'Cube Bonus', baseCost: 50, maxLevel: 10 },
  { id: 'speed_window', name: 'Quick Hands', baseCost: 25, maxLevel: 5 },
];

export const UPGRADE_IDS: readonly UpgradeId[] = UPGRADE_CATALOG.map((entry) => entry.id);

function definition(id: UpgradeId): UpgradeDef {
  const found = UPGRADE_CATALOG.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`unknown upgrade: ${id}`);
  }
  return found;
}

/** Type guard for a client-supplied upgrade id. */
export function isValidUpgradeId(id: string): id is UpgradeId {
  return UPGRADE_IDS.includes(id as UpgradeId);
}

/** Reads an upgrade's current level from a state map (missing => 0). */
export function upgradeLevel(upgrades: UpgradeState, id: UpgradeId): number {
  const raw = upgrades[id];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

/**
 * Cost of the next level for `id` given `currentLevel`.
 *
 * Returns `Infinity` when `currentLevel >= maxLevel` (client-only preview sentinel;
 * never persisted or serialized).
 */
export function upgradeCost(id: UpgradeId, currentLevel: number): number {
  const def = definition(id);
  if (currentLevel >= def.maxLevel) {
    return Infinity;
  }
  return def.baseCost * (currentLevel + 1);
}

/** Multiplier applied to `COINS_PER_MINI_CUBE` for the given upgrades. */
export function miniCubeMultiplier(upgrades: UpgradeState): number {
  return 1 + 0.1 * upgradeLevel(upgrades, 'mini_cube_value');
}

/** Multiplier applied to `COINS_PER_CUBE` for the given upgrades. */
export function cubeMultiplier(upgrades: UpgradeState): number {
  return 1 + 0.1 * upgradeLevel(upgrades, 'cube_value');
}

/** Extra seconds added to the speed-bonus threshold for the given upgrades. */
export function speedWindowSeconds(upgrades: UpgradeState): number {
  return 2 * upgradeLevel(upgrades, 'speed_window');
}
