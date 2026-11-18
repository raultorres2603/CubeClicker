/**
 * Hangar tab catalog (remote-spaceship-customization T15; spec AC-27).
 *
 * Pure presentation grouping: the six in-panel tabs the spaceship hangar renders. Five tabs
 * hold two ship slots each in `SLOT_CATALOG_V3` order; the sixth (`shots`) holds the single
 * `shot` slot. The table is written out literally (not derived from the catalog) so a catalog
 * change fails the set-union test in `hangar-tabs.test.ts` instead of silently regrouping the
 * panel; the test asserts that the union of all tabs equals the eleven `SLOT_CATALOG_V3` ids —
 * no missing id, no duplicate, no foreign id — and that each tab's own slots keep catalog order.
 *
 * The grouping is a UI concept, not a domain term: `part slot` stays the authoritative
 * domain unit (`docs/product/glossary.md`). This module is plain data and arithmetic — no
 * React, no DOM access, no timers, no randomness — so it can be unit-tested in isolation and
 * imported from the deferred customization chunk without pulling anything into the entry.
 */

import {
  catalogForSlot,
  normalizePartMapV3,
  type SlotIdV3,
} from '../game/parts-v3';

/** The six tab ids, in tab-strip order. */
export type HangarTabId =
  | 'frame'
  | 'front'
  | 'wings'
  | 'engines'
  | 'ignitions'
  | 'shots';

/** One tab: its stable id, the visible label and its slots in catalog order. */
export interface HangarTab {
  readonly id: HangarTabId;
  /** Tab-strip label, sentence case in the DOM (`Frame`, `Front`, …). */
  readonly label: string;
  /** The group's slots, in `SLOT_CATALOG_V3` order (two, or one on `Shots`). */
  readonly slots: readonly SlotIdV3[];
}

/** The six tabs, in tab-strip order (spec AC-27). */
export const HANGAR_TABS: readonly HangarTab[] = [
  { id: 'frame', label: 'Frame', slots: ['hull', 'tail-fin'] },
  { id: 'front', label: 'Front', slots: ['nose', 'cockpit'] },
  { id: 'wings', label: 'Wings', slots: ['wing-left', 'wing-right'] },
  { id: 'engines', label: 'Engines', slots: ['engine-left', 'engine-right'] },
  { id: 'ignitions', label: 'Ignitions', slots: ['ignition-left', 'ignition-right'] },
  { id: 'shots', label: 'Shots', slots: ['shot'] },
];

/** The tab the panel opens on, and the reset target for an unknown landing part. */
export const HANGAR_DEFAULT_TAB: HangarTabId = 'frame';

/**
 * Lootable (rare + epic) parts per tab: the badge maximum, and the `x/<total>` denominator.
 * Ship slots have 122 lootable rows each (123 catalog rows minus the standard part), `shot`
 * has 120 (121 minus `shot-default`), so each ship tab totals 244 and `Shots` totals 120.
 */
export const HANGAR_TAB_LOOTABLE_TOTALS: Readonly<Record<HangarTabId, number>> = {
  frame: 244,
  front: 244,
  wings: 244,
  engines: 244,
  ignitions: 244,
  shots: 120,
};

/** The owning tab of a slot; throws `unknown slot: <id>` for anything else. */
export function tabForSlot(slot: SlotIdV3): HangarTabId {
  const tab = HANGAR_TABS.find((candidate) => candidate.slots.includes(slot));
  if (tab === undefined) {
    throw new Error(`unknown slot: ${slot}`);
  }
  return tab.id;
}

/**
 * Owned lootable (non-standard) v3 parts of a tab, `0…HANGAR_TAB_LOOTABLE_TOTALS[tab.id]`.
 * Standard parts never count, unknown ids and invalid counts are ignored, and a missing map
 * counts `0`. The map is normalized through the v3 normalizer first, so a bilateral legacy
 * id (`wings-silver`, `engine-blue`) counts for both slots (AC-5/AC-27).
 */
export function tabOwnedCount(
  tab: HangarTab,
  parts?: Record<string, number>,
): number {
  const normalized = normalizePartMapV3(parts ?? {});
  let owned = 0;
  for (const slot of tab.slots) {
    for (const part of catalogForSlot(slot)) {
      if (part.rarity !== 'standard' && (normalized[part.id] ?? 0) > 0) {
        owned += 1;
      }
    }
  }
  return owned;
}
