import type { ReactElement } from 'react';

import {
  UPGRADE_CATALOG,
  upgradeCost,
  upgradeLevel,
  type UpgradeId,
} from '../game/upgrades';
import type { UpgradeState } from '../game/types';

const EFFECT_PREVIEW: Record<UpgradeId, string> = {
  mini_cube_value: '+10% coins per mini-cube',
  cube_value: '+10% coins per cube',
  speed_window: '+2s speed-bonus window',
};

const GUESTS_CAN_SPEND = true;

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
    <section
      aria-label="Upgrades"
      className="upgrades-panel"
      data-mode={mode}
    >
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
                aria-label="Buy"
                disabled={!affordable}
                onClick={() => {
                  if (affordable) {
                    onPurchase(def.id);
                  }
                }}
              >
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
