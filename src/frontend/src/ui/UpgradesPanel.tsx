import type { ReactElement } from 'react';

import {
  UPGRADE_CATALOG,
  upgradeCost,
  upgradeLevel,
  type UpgradeId,
} from '../game/upgrades';
import type { UpgradeState } from '../game/types';

/**
 * Pinned effect preview copy for each upgrade (mirrors the catalog's pinned effects).
 * Kept here so the panel does not need to re-derive human-readable text from numbers.
 */
const EFFECT_PREVIEW: Record<UpgradeId, string> = {
  mini_cube_value: '+10% coins per mini-cube',
  cube_value: '+10% coins per cube',
  speed_window: '+2s speed-bonus window',
};

/**
 * Q-5 resolved to "yes" (approved default): guests may spend ephemeral coins, so the
 * guest mode does not lock the buy buttons. The `mode` prop is still honoured so a
 * later "no" resolution can flip this single flag without touching call sites.
 */
const GUESTS_CAN_SPEND = true;

/**
 * Shop panel for spending coins on upgrades (T10, AC-19).
 *
 * Props:
 *  - `upgrades`: current upgrade levels (record of id -> level).
 *  - `coins`: current coin balance used for affordability.
 *  - `mode`: session-owned mode signal (`'guest' | 'account'`).
 *  - `onPurchase`: called with the upgrade id when its buy button is activated while
 *    affordable.
 *
 * A buy button is enabled only when `coins >= cost` and `level < maxLevel`; otherwise
 * it is disabled. There is no in-flight `pendingId` in v1 (deferred, F16).
 */
export function UpgradesPanel({
  upgrades,
  coins,
  mode,
  onPurchase,
}: {
  upgrades: UpgradeState;
  coins: number;
  mode: 'guest' | 'account';
  onPurchase: (id: string) => void;
}): ReactElement {
  const guestLocked = mode === 'guest' && !GUESTS_CAN_SPEND;

  return (
    <section aria-label="Upgrades" data-mode={mode}>
      <ul>
        {UPGRADE_CATALOG.map((def) => {
          const level = upgradeLevel(upgrades, def.id);
          const cost = upgradeCost(def.id, level);
          const maxed = level >= def.maxLevel;
          const affordable = !maxed && !guestLocked && coins >= cost;

          return (
            <li key={def.id} data-upgrade={def.id}>
              <span data-name>{def.name}</span>
              <span data-level>
                {level}/{def.maxLevel}
              </span>
              <span data-effect>{EFFECT_PREVIEW[def.id]}</span>
              <span data-cost>{cost}</span>
              <button
                type="button"
                disabled={!affordable}
                onClick={() => {
                  if (affordable) {
                    onPurchase(def.id);
                  }
                }}
              >
                Buy
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}