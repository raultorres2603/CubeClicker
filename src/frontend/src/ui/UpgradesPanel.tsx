import type { ComponentType, ReactElement } from 'react';

import {
  UPGRADE_CATALOG,
  upgradeCost,
  upgradeLevel,
  type UpgradeId,
} from '../game/upgrades';
import type { UpgradeState } from '../game/types';
import {
  DiamondIcon,
  UpgradeClickIcon,
  UpgradeCubeIcon,
  UpgradeSpeedIcon,
  type IconProps,
} from './icons';

const EFFECT_PREVIEW: Record<UpgradeId, string> = {
  mini_cube_value: '+10% coins per mini-cube',
  cube_value: '+10% coins per cube',
  speed_window: '+2s speed-bonus window',
};

const ROW_ICON: Record<UpgradeId, ComponentType<IconProps>> = {
  mini_cube_value: UpgradeClickIcon,
  cube_value: UpgradeCubeIcon,
  speed_window: UpgradeSpeedIcon,
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
          const RowIcon = ROW_ICON[def.id];

          return (
            <li className="upgrade-row" data-upgrade={def.id} key={def.id}>
              <RowIcon />
              <span data-name>{def.name}</span>
              <span data-level>
                {level}/{def.maxLevel}
              </span>
              <span data-effect>{EFFECT_PREVIEW[def.id]}</span>
              <DiamondIcon />
              <span data-cost>{cost}</span>
              <button
                type="button"
                className="upgrade-buy"
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
