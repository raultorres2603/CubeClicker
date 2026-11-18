import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  PART_CATALOG_V3,
  SLOT_CATALOG_V3,
  catalogForSlot,
  type SlotIdV3,
} from '../game/parts-v3';
import {
  HANGAR_DEFAULT_TAB,
  HANGAR_TABS,
  HANGAR_TAB_LOOTABLE_TOTALS,
  tabForSlot,
  tabOwnedCount,
  type HangarTab,
  type HangarTabId,
} from './hangar-tabs';

/** The pinned spec AC-27 table, verbatim (ids, labels, slots and their order). */
const EXPECTED_TABS = [
  { id: 'frame', label: 'Frame', slots: ['hull', 'tail-fin'] },
  { id: 'front', label: 'Front', slots: ['nose', 'cockpit'] },
  { id: 'wings', label: 'Wings', slots: ['wing-left', 'wing-right'] },
  { id: 'engines', label: 'Engines', slots: ['engine-left', 'engine-right'] },
  { id: 'ignitions', label: 'Ignitions', slots: ['ignition-left', 'ignition-right'] },
  { id: 'shots', label: 'Shots', slots: ['shot'] },
] as const;

/** The pinned badge maxima: 244 per ship tab, 120 for `Shots` (AC-27). */
const EXPECTED_TOTALS: Readonly<Record<HangarTabId, number>> = {
  frame: 244,
  front: 244,
  wings: 244,
  engines: 244,
  ignitions: 244,
  shots: 120,
};

const ZERO_COUNTS: Readonly<Record<HangarTabId, number>> = {
  frame: 0,
  front: 0,
  wings: 0,
  engines: 0,
  ignitions: 0,
  shots: 0,
};

const ALL_OWNED_TOTALS: Readonly<Record<HangarTabId, number>> = {
  frame: 244,
  front: 244,
  wings: 244,
  engines: 244,
  ignitions: 244,
  shots: 120,
};

function tabById(id: HangarTabId): HangarTab {
  const found = HANGAR_TABS.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`hangar-tabs.test.ts: missing tab ${id}`);
  }
  return found;
}

/** `tabOwnedCount` for all six tabs, keyed by tab id — one exact object per assertion. */
function ownedByTab(parts: Record<string, number>): Record<HangarTabId, number> {
  return {
    frame: tabOwnedCount(tabById('frame'), parts),
    front: tabOwnedCount(tabById('front'), parts),
    wings: tabOwnedCount(tabById('wings'), parts),
    engines: tabOwnedCount(tabById('engines'), parts),
    ignitions: tabOwnedCount(tabById('ignitions'), parts),
    shots: tabOwnedCount(tabById('shots'), parts),
  };
}

/** Every v3 catalog row at count 1 (the full 1,351-row inventory). */
function allOwnedParts(): Record<string, number> {
  return Object.fromEntries(PART_CATALOG_V3.map((part) => [part.id, 1]));
}

describe('HANGAR_TABS (AC-27)', () => {
  it('pins the six tabs in tab-strip order with their exact ids, labels and slots', () => {
    expect(HANGAR_TABS).toEqual(EXPECTED_TABS);
    expect(HANGAR_TABS.map((tab) => tab.id)).toEqual([
      'frame',
      'front',
      'wings',
      'engines',
      'ignitions',
      'shots',
    ]);
    expect(HANGAR_TABS.map((tab) => tab.label)).toEqual([
      'Frame',
      'Front',
      'Wings',
      'Engines',
      'Ignitions',
      'Shots',
    ]);
    expect(HANGAR_TABS.map((tab) => tab.slots)).toEqual([
      ['hull', 'tail-fin'],
      ['nose', 'cockpit'],
      ['wing-left', 'wing-right'],
      ['engine-left', 'engine-right'],
      ['ignition-left', 'ignition-right'],
      ['shot'],
    ]);
    expect(new Set(HANGAR_TABS.map((tab) => tab.id)).size).toBe(6);
  });

  it('covers every v3 catalog slot exactly once (set equality, no duplicate, no foreign id)', () => {
    const catalogIds = SLOT_CATALOG_V3.map((slot) => slot.id);
    const flattened = HANGAR_TABS.flatMap((tab) => tab.slots);

    expect(catalogIds).toEqual([
      'hull',
      'nose',
      'cockpit',
      'wing-left',
      'wing-right',
      'engine-left',
      'engine-right',
      'ignition-left',
      'ignition-right',
      'tail-fin',
      'shot',
    ]);
    expect(flattened).toHaveLength(11);
    expect(HANGAR_TABS.map((tab) => tab.slots.length)).toEqual([2, 2, 2, 2, 2, 1]);
    expect(new Set(flattened).size).toBe(11);
    expect([...new Set(flattened)].sort()).toEqual([...catalogIds].sort());
    expect(flattened.filter((id) => !catalogIds.includes(id))).toEqual([]);
  });

  it('keeps each tab slots in SLOT_CATALOG_V3 order', () => {
    const catalogIds = SLOT_CATALOG_V3.map((slot) => slot.id);
    for (const tab of HANGAR_TABS) {
      expect(tab.slots).toEqual(
        catalogIds.filter((id) => tab.slots.includes(id as SlotIdV3)),
      );
    }
  });

  it('exposes the pinned 244 / 120 lootable totals, matching the catalog rows', () => {
    expect(HANGAR_TAB_LOOTABLE_TOTALS).toEqual(EXPECTED_TOTALS);
    for (const tab of HANGAR_TABS) {
      const lootableIds = tab.slots.flatMap((slot) =>
        catalogForSlot(slot)
          .filter((part) => part.rarity !== 'standard')
          .map((part) => part.id),
      );
      expect(lootableIds).toHaveLength(HANGAR_TAB_LOOTABLE_TOTALS[tab.id]);
      expect(new Set(lootableIds).size).toBe(HANGAR_TAB_LOOTABLE_TOTALS[tab.id]);
    }
    expect(
      catalogForSlot('hull').filter((part) => part.rarity !== 'standard'),
    ).toHaveLength(122);
    expect(
      catalogForSlot('shot').filter((part) => part.rarity !== 'standard'),
    ).toHaveLength(120);
  });

  it('defaults to the frame tab', () => {
    expect(HANGAR_DEFAULT_TAB).toBe('frame');
  });
});

describe('tabForSlot (AC-27)', () => {
  it('returns the owning tab for all eleven catalog slots', () => {
    expect(SLOT_CATALOG_V3.map((slot) => tabForSlot(slot.id))).toEqual([
      'frame',
      'front',
      'front',
      'wings',
      'wings',
      'engines',
      'engines',
      'ignitions',
      'ignitions',
      'frame',
      'shots',
    ]);
  });

  it('throws `unknown slot: <id>` for legacy keys, display names and empty ids', () => {
    const invalidSlots = ['wings', 'engine', 'body', '', 'Hull', 'tail_fin', 'shots'];
    for (const invalid of invalidSlots) {
      expect(() => tabForSlot(invalid as SlotIdV3)).toThrow(`unknown slot: ${invalid}`);
    }
  });
});

describe('tabOwnedCount (AC-27)', () => {
  it('counts 0 for every tab when the parts map is empty or missing', () => {
    expect(ownedByTab({})).toEqual(ZERO_COUNTS);
    expect(HANGAR_TABS.map((tab) => tabOwnedCount(tab))).toEqual([0, 0, 0, 0, 0, 0]);
    expect(HANGAR_TABS.map((tab) => tabOwnedCount(tab, undefined))).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
  });

  it('counts only owned lootable v3 parts, per tab', () => {
    const partiallyOwned = {
      'hull-dart-chrome': 1,
      'nose-crimson': 1,
      'cockpit-kite-solar': 2,
      'wing-left-silver': 1,
      'engine-right-nova': 3,
      'ignition-right-blue': 1,
      'ignition-right-plasma': 1,
      'shot-orca-violet': 1,
    };
    expect(ownedByTab(partiallyOwned)).toEqual({
      frame: 1,
      front: 2,
      wings: 1,
      engines: 1,
      ignitions: 2,
      shots: 1,
    });
  });

  it('reaches every tab total for a full 1,351-row inventory', () => {
    const all = allOwnedParts();
    expect(Object.keys(all)).toHaveLength(1351);
    expect(ownedByTab(all)).toEqual(ALL_OWNED_TOTALS);
  });

  it('never counts standard parts, zero counts or unknown ids', () => {
    expect(
      ownedByTab({
        'hull-default': 9,
        'tail-fin-default': 4,
        'nose-default': 1,
        'cockpit-default': 1,
        'wing-left-default': 1,
        'wing-right-default': 1,
        'engine-left-default': 1,
        'engine-right-default': 1,
        'ignition-left-default': 1,
        'ignition-right-default': 1,
        'shot-default': 6,
        'nose-crimson': 0,
        'cockpit-oracle': 0,
        'not-a-part': 5,
        'wings': 5,
        'shot': 5,
      }),
    ).toEqual(ZERO_COUNTS);
  });

  it('counts a bilateral legacy wing id twice after normalization (wings-silver → 2)', () => {
    expect(ownedByTab({ 'wings-silver': 1 })).toEqual({ ...ZERO_COUNTS, wings: 2 });
  });

  it('counts the legacy engine id for both ignitions after normalization (engine-blue → 2)', () => {
    expect(ownedByTab({ 'engine-blue': 3 })).toEqual({ ...ZERO_COUNTS, ignitions: 2 });
  });

  it('counts a single-slot legacy hull id once after normalization (body-obsidian → frame 1)', () => {
    expect(ownedByTab({ 'body-obsidian': 1 })).toEqual({ ...ZERO_COUNTS, frame: 1 });
  });

  it('accepts an already-normalized map without double counting', () => {
    expect(
      ownedByTab({
        'wing-left-silver': 1,
        'wing-right-silver': 1,
      }),
    ).toEqual({ ...ZERO_COUNTS, wings: 2 });
  });
});

describe('module purity (AC-27)', () => {
  const source = readFileSync(new URL('./hangar-tabs.ts', import.meta.url), 'utf8');

  it('imports only ../game/parts-v3', () => {
    const specifiers = [...source.matchAll(/^import\s[^;]*?from\s+'([^']+)';/gmu)].map(
      (match) => match[1],
    );
    expect(specifiers).toEqual(['../game/parts-v3']);
  });

  it('has no timer, randomness or DOM access', () => {
    expect(source).not.toMatch(
      /\b(?:setTimeout|setInterval|requestAnimationFrame|queueMicrotask)\b/u,
    );
    expect(source).not.toMatch(/\bMath\.random\b/u);
    expect(source).not.toMatch(/\b(?:document|window|localStorage|sessionStorage)\b/u);
  });
});
