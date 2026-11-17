/**
 * Hangar tab catalog (hangar-tabs-and-menu-motion T2; spec AC-1).
 *
 * Pure presentation grouping: the five in-panel tabs the spaceship hangar renders, each
 * holding exactly two `SLOT_CATALOG` rows in catalog order. The table is written out
 * literally (not derived from the catalog) so a catalog change fails the set-union test in
 * `hangar-tabs.test.ts` instead of silently regrouping the panel; the test asserts that the
 * union of all tabs equals the ten `SLOT_CATALOG` ids — no missing id, no duplicate, no
 * foreign id — and that each tab's own slots keep catalog order.
 *
 * The grouping is a UI concept, not a domain term: `part slot` stays the authoritative
 * domain unit (`docs/product/glossary.md`). This module is plain data and arithmetic — no
 * React, no DOM access, no timers, no randomness — so it can be unit-tested in isolation and
 * imported from the deferred customization chunk without pulling anything into the entry.
 */

import { partsForSlot, type SlotId } from '../game/parts-v2';

/** The five tab ids, in tab-strip order. */
export type HangarTabId = 'frame' | 'front' | 'wings' | 'engines' | 'ignitions';

/** One tab: its stable id, the visible label and its two slots in catalog order. */
export interface HangarTab {
  readonly id: HangarTabId;
  /** Tab-strip label, sentence case in the DOM (`Frame`, `Front`, …). */
  readonly label: string;
  /** The group's slots, in `SLOT_CATALOG` order (always exactly two). */
  readonly slots: readonly SlotId[];
}

/** The five tabs, in tab-strip order (spec § Tab set). */
export const HANGAR_TABS: readonly HangarTab[] = [
  { id: 'frame', label: 'Frame', slots: ['hull', 'tail-fin'] },
  { id: 'front', label: 'Front', slots: ['nose', 'cockpit'] },
  { id: 'wings', label: 'Wings', slots: ['wing-left', 'wing-right'] },
  { id: 'engines', label: 'Engines', slots: ['engine-left', 'engine-right'] },
  { id: 'ignitions', label: 'Ignitions', slots: ['ignition-left', 'ignition-right'] },
];

/** The tab the panel opens on, and the reset target for an unknown landing part. */
export const HANGAR_DEFAULT_TAB: HangarTabId = 'frame';

/** Lootable (rare + epic) parts per tab: two slots × two lootable parts = the badge max. */
export const HANGAR_TAB_LOOTABLE_TOTAL = 4;

/** The owning tab of a slot; throws `unknown slot: <id>` for anything else. */
export function tabForSlot(slot: SlotId): HangarTabId {
  const tab = HANGAR_TABS.find((candidate) => candidate.slots.includes(slot));
  if (tab === undefined) {
    throw new Error(`unknown slot: ${slot}`);
  }
  return tab.id;
}

/**
 * Owned lootable (non-standard) parts of a tab, `0…HANGAR_TAB_LOOTABLE_TOTAL`. Standard
 * parts never count, unknown ids are ignored, and a missing map counts `0`.
 *
 * The map is expected to be normalized (`normalizePartMap`), exactly as the panel already
 * normalizes its `parts` prop: a bilateral legacy id then already appears as its two keys,
 * so `{ 'wings-silver': 1 }` counts `2` for `wings` (AC-5).
 */
export function tabOwnedCount(
  tab: HangarTab,
  parts?: Record<string, number>,
): number {
  let owned = 0;
  for (const slot of tab.slots) {
    for (const part of partsForSlot(slot)) {
      if (part.rarity !== 'standard' && (parts?.[part.id] ?? 0) > 0) {
        owned += 1;
      }
    }
  }
  return owned;
}
