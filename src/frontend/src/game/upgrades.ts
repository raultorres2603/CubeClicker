/**
 * Frontend upgrades constants and pure helpers (T6).
 *
 * Mirror of `src/backend/src/game/upgrades.ts` for optimistic UX; server
 * totals/levels reconcile. Pinned values (approval-gated by Q-1/Q-2/Q-3):
 *   - catalog: `mini_cube_value` ("Click Power", +10% coins per mini-cube per
 *     level, max 10), `cube_value` ("Cube Bonus", +10% coins per cube per
 *     level, max 10), `speed_window` ("Quick Hands", +2 s to the speed-bonus
 *     threshold per level, max 5).
 *   - cost formula: `cost = baseCost * (currentLevel + 1)` with base costs
 *     10 / 50 / 25 coins.
 *   - max levels: 10 / 10 / 5.
 */
import type { UpgradeState } from './types';

export type { UpgradeState } from './types';

export type UpgradeId = 'mini_cube_value' | 'cube_value' | 'speed_window';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  baseCost: number;
  maxLevel: number;
}

/** Alias matching the task's requested public name. */
export type UpgradeDefinition = UpgradeDef;

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

export function isValidUpgradeId(id: string): id is UpgradeId {
  return UPGRADE_IDS.includes(id as UpgradeId);
}

export function upgradeLevel(upgrades: UpgradeState, id: UpgradeId): number {
  const raw = upgrades[id];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

export function upgradeCost(id: UpgradeId, currentLevel: number): number {
  const def = definition(id);
  if (currentLevel >= def.maxLevel) {
    return Infinity;
  }
  return def.baseCost * (currentLevel + 1);
}

export function miniCubeMultiplier(upgrades: UpgradeState): number {
  return 1 + 0.1 * upgradeLevel(upgrades, 'mini_cube_value');
}

export function cubeMultiplier(upgrades: UpgradeState): number {
  return 1 + 0.1 * upgradeLevel(upgrades, 'cube_value');
}

export function speedWindowSeconds(upgrades: UpgradeState): number {
  return 2 * upgradeLevel(upgrades, 'speed_window');
}

