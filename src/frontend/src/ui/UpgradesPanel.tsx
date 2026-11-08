import { useEffect, useRef, useState, type ComponentType, type ReactElement } from 'react';

import { MOTION } from '../game/motion';
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
  reducedMotion = false,
  onPurchase,
}: {
  upgrades: UpgradeState;
  coins: number;
  mode: 'guest' | 'account';
  /** Skips the purchase pulse (AC-43/AC-48). */
  reducedMotion?: boolean;
  onPurchase: (id: string) => void;
}): ReactElement {
  const guestLocked = mode === 'guest' && !GUESTS_CAN_SPEND;
  const [purchased, setPurchased] = useState<ReadonlySet<string>>(() => new Set());
  const previousRef = useRef<UpgradeState | null>(null);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = upgrades;
    if (previous === null || reducedMotion) {
      return;
    }
    const changed: UpgradeId[] = [];
    for (const def of UPGRADE_CATALOG) {
      if (upgradeLevel(upgrades, def.id) > upgradeLevel(previous, def.id)) {
        changed.push(def.id);
      }
    }
    if (changed.length === 0) {
      return;
    }
    setPurchased((current) => {
      const next = new Set(current);
      for (const id of changed) {
        next.add(id);
      }
      return next;
    });
    for (const id of changed) {
      const existing = timersRef.current.get(id);
      if (existing !== undefined) {
        clearTimeout(existing);
      }
      const timer = setTimeout(() => {
        setPurchased((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        timersRef.current.delete(id);
      }, MOTION.upgradePulseMs);
      timersRef.current.set(id, timer);
    }
  }, [upgrades, reducedMotion]);

  useEffect(() => {
    if (!reducedMotion) {
      return;
    }
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
    setPurchased((current) => (current.size === 0 ? current : new Set()));
  }, [reducedMotion]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  return (
    <section aria-label="Upgrades" className="upgrades-panel" data-mode={mode}>
      <ul>
        {UPGRADE_CATALOG.map((def) => {
          const level = upgradeLevel(upgrades, def.id);
          const cost = upgradeCost(def.id, level);
          const maxed = level >= def.maxLevel;
          const affordable = !maxed && !guestLocked && coins >= cost;
          const RowIcon = ROW_ICON[def.id];

          return (
            <li
              className="upgrade-row"
              data-upgrade={def.id}
              key={def.id}
              {...(purchased.has(def.id) ? { 'data-purchased': 'true' } : {})}
            >
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
