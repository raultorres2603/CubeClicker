import type { ReactElement } from 'react';

import {
  PART_CATALOG,
  type PartDef,
} from '../game/parts';
import type { CustomizationState } from '../game/types';
import { SpaceshipPreview } from './SpaceshipPreview';

type Mode = 'guest' | 'account';

export interface SpaceshipCustomizationPanelProps {
  customization?: CustomizationState;
  lootboxes?: number;
  keys?: number;
  parts?: Record<string, number>;
  appearance?: Record<string, string>;
  mode?: Mode;
  onOpenLootbox?: () => void;
  onOpen?: () => void;
  onEquip?: (partId: string) => void;
  onEquipPart?: (partId: string) => void;
}

function normalize(props: SpaceshipCustomizationPanelProps): {
  lootboxes: number;
  keys: number;
  parts: Record<string, number>;
  appearance: Record<string, string>;
} {
  const c = props.customization;
  const lootboxes = props.lootboxes ?? c?.lootboxes ?? 0;
  const keys = props.keys ?? c?.keys ?? 0;
  const parts = props.parts ?? c?.parts ?? {};
  const appearance = props.appearance ?? c?.appearance ?? {};
  return { lootboxes, keys, parts, appearance };
}

export function SpaceshipCustomizationPanel(
  props: SpaceshipCustomizationPanelProps,
): ReactElement {
  const { lootboxes, keys, parts, appearance } = normalize(props);
  const mode: Mode = props.mode ?? 'guest';
  const handleOpen = (): void => {
    if (props.onOpenLootbox !== undefined) {
      props.onOpenLootbox();
    } else if (props.onOpen !== undefined) {
      props.onOpen();
    }
  };
  const handleEquip = (partId: string): void => {
    if (props.onEquip !== undefined) {
      props.onEquip(partId);
    } else if (props.onEquipPart !== undefined) {
      props.onEquipPart(partId);
    }
  };

  const canOpen = lootboxes > 0 && keys > 0;

  const ownedParts: Array<{ def: PartDef; count: number }> = [];
  for (const def of PART_CATALOG) {
    const count = parts[def.id];
    if (typeof count === 'number' && count > 0) {
      ownedParts.push({ def, count });
    }
  }

  return (
    <section
      aria-label="Spaceship customization"
      className="customization-panel"
      data-mode={mode}
    >
      <div className="customization-counts">
        <span
          data-lootboxes={lootboxes}
          data-lootbox-count={lootboxes}
          data-lootbox={lootboxes}
        >
          {`Lootboxes: ${lootboxes}`}
        </span>
        <span
          data-keys={keys}
          data-key-count={keys}
          data-key={keys}
        >
          {`Keys: ${keys}`}
        </span>
      </div>
      <button
        type="button"
        className="customization-open"
        disabled={!canOpen}
        onClick={() => {
          if (canOpen) {
            handleOpen();
          }
        }}
      >
        Open lootbox
      </button>
      <ul className="customization-parts">
        {ownedParts.map(({ def, count }) => (
          <li key={def.id} data-part={def.id}>
            <span data-name>{def.name}</span>
            <span data-count>{count}</span>
            <button
              type="button"
              className="customization-equip"
              onClick={() => handleEquip(def.id)}
            >
              Equip
            </button>
          </li>
        ))}
      </ul>
      <SpaceshipPreview appearance={appearance} />
    </section>
  );
}
