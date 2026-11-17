import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  SLOT_CATALOG,
  normalizePartMap,
  partsForSlot,
  type PartIdV2,
  type SlotId,
} from '../game/parts-v2';
import {
  HANGAR_DEFAULT_TAB,
  HANGAR_TABS,
  HANGAR_TAB_LOOTABLE_TOTAL,
  tabForSlot,
  tabOwnedCount,
  type HangarTab,
  type HangarTabId,
} from './hangar-tabs';

/** The pinned spec § Tab set table, verbatim (ids, labels, slots and their order). */
const EXPECTED_TABS = [
  { id: 'frame', label: 'Frame', slots: ['hull', 'tail-fin'] },
  { id: 'front', label: 'Front', slots: ['nose', 'cockpit'] },
  { id: 'wings', label: 'Wings', slots: ['wing-left', 'wing-right'] },
  { id: 'engines', label: 'Engines', slots: ['engine-left', 'engine-right'] },
  { id: 'ignitions', label: 'Ignitions', slots: ['ignition-left', 'ignition-right'] },
] as const;

/** Every lootable (rare + epic) catalog id per tab, in catalog order. */
const EXPECTED_LOOTABLE_IDS: Readonly<Record<HangarTabId, readonly PartIdV2[]>> = {
  frame: ['hull-obsidian', 'hull-gold', 'tail-fin-split', 'tail-fin-comet'],
  front: ['nose-crimson', 'nose-emerald', 'cockpit-amber', 'cockpit-oracle'],
  wings: ['wing-left-silver', 'wing-left-gold', 'wing-right-silver', 'wing-right-gold'],
  engines: [
    'engine-left-vector',
    'engine-left-nova',
    'engine-right-vector',
    'engine-right-nova',
  ],
  ignitions: [
    'ignition-left-blue',
    'ignition-left-plasma',
    'ignition-right-blue',
    'ignition-right-plasma',
  ],
};

const ZERO_COUNTS: Readonly<Record<HangarTabId, number>> = {
  frame: 0,
  front: 0,
  wings: 0,
  engines: 0,
  ignitions: 0,
};

function tabById(id: HangarTabId): HangarTab {
  const found = HANGAR_TABS.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`hangar-tabs.test.ts: missing tab ${id}`);
  }
  return found;
}

/** `tabOwnedCount` for all five tabs, keyed by tab id — one exact object per assertion. */
function ownedByTab(parts: Record<string, number>): Record<HangarTabId, number> {
  return {
    frame: tabOwnedCount(tabById('frame'), parts),
    front: tabOwnedCount(tabById('front'), parts),
    wings: tabOwnedCount(tabById('wings'), parts),
    engines: tabOwnedCount(tabById('engines'), parts),
    ignitions: tabOwnedCount(tabById('ignitions'), parts),
  };
}

describe('HANGAR_TABS (AC-1)', () => {
  it('pins the five tabs in tab-strip order with their exact ids, labels and slots', () => {
    expect(HANGAR_TABS).toEqual(EXPECTED_TABS);
    expect(HANGAR_TABS.map((tab) => tab.id)).toEqual([
      'frame',
      'front',
      'wings',
      'engines',
      'ignitions',
    ]);
    expect(HANGAR_TABS.map((tab) => tab.label)).toEqual([
      'Frame',
      'Front',
      'Wings',
      'Engines',
      'Ignitions',
    ]);
    expect(HANGAR_TABS.map((tab) => tab.slots)).toEqual([
      ['hull', 'tail-fin'],
      ['nose', 'cockpit'],
      ['wing-left', 'wing-right'],
      ['engine-left', 'engine-right'],
      ['ignition-left', 'ignition-right'],
    ]);
    expect(new Set(HANGAR_TABS.map((tab) => tab.id)).size).toBe(5);
  });

  it('covers every catalog slot exactly once (set equality, no duplicate, no foreign id)', () => {
    const catalogIds = SLOT_CATALOG.map((slot) => slot.id);
    const flattened = HANGAR_TABS.flatMap((tab) => tab.slots);

    expect(flattened).toHaveLength(10);
    expect(HANGAR_TABS.map((tab) => tab.slots.length)).toEqual([2, 2, 2, 2, 2]);
    expect(new Set(flattened).size).toBe(10);
    expect([...new Set(flattened)].sort()).toEqual([...catalogIds].sort());
    expect(flattened.filter((id) => !catalogIds.includes(id))).toEqual([]);
  });

  it('keeps each tab slots in SLOT_CATALOG order', () => {
    const catalogIds = SLOT_CATALOG.map((slot) => slot.id);
    for (const tab of HANGAR_TABS) {
      expect(tab.slots).toEqual(catalogIds.filter((id) => tab.slots.includes(id as SlotId)));
    }
  });

  it('exposes exactly four lootable parts per tab (rare + epic of both slots)', () => {
    expect(HANGAR_TAB_LOOTABLE_TOTAL).toBe(4);
    for (const tab of HANGAR_TABS) {
      const lootableIds = tab.slots.flatMap((slot) =>
        partsForSlot(slot)
          .filter((part) => part.rarity !== 'standard')
          .map((part) => part.id),
      );
      expect(lootableIds).toEqual(EXPECTED_LOOTABLE_IDS[tab.id]);
      expect(lootableIds).toHaveLength(HANGAR_TAB_LOOTABLE_TOTAL);
    }
  });

  it('defaults to the frame tab', () => {
    expect(HANGAR_DEFAULT_TAB).toBe('frame');
  });
});

describe('tabForSlot (AC-1)', () => {
  it('returns the owning tab for all ten catalog slots', () => {
    expect(SLOT_CATALOG.map((slot) => tabForSlot(slot.id))).toEqual([
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
    ]);
  });

  it('throws `unknown slot: <id>` for legacy keys, display names and empty ids', () => {
    const invalidSlots = ['wings', 'engine', 'body', '', 'Hull', 'tail_fin'];
    for (const invalid of invalidSlots) {
      expect(() => tabForSlot(invalid as SlotId)).toThrow(`unknown slot: ${invalid}`);
    }
  });
});

describe('tabOwnedCount (AC-1, AC-5)', () => {
  it('counts 0 for every tab when the parts map is empty or missing', () => {
    expect(ownedByTab({})).toEqual(ZERO_COUNTS);
    expect(HANGAR_TABS.map((tab) => tabOwnedCount(tab))).toEqual([0, 0, 0, 0, 0]);
    expect(HANGAR_TABS.map((tab) => tabOwnedCount(tab, undefined))).toEqual([0, 0, 0, 0, 0]);
  });

  it('counts only owned lootable parts, per tab', () => {
    const partiallyOwned = {
      'hull-gold': 2,
      'nose-crimson': 1,
      'cockpit-oracle': 1,
      'wing-left-silver': 1,
      'engine-right-nova': 3,
      'ignition-right-blue': 1,
      'ignition-right-plasma': 1,
    };
    expect(ownedByTab(partiallyOwned)).toEqual({
      frame: 1,
      front: 2,
      wings: 1,
      engines: 1,
      ignitions: 2,
    });
  });

  it('counts one owned part per tab as 1 across the strip', () => {
    expect(
      ownedByTab({
        'hull-obsidian': 1,
        'nose-crimson': 1,
        'wing-right-silver': 1,
        'engine-left-vector': 1,
        'ignition-left-plasma': 1,
      }),
    ).toEqual({ frame: 1, front: 1, wings: 1, engines: 1, ignitions: 1 });
  });

  it('counts both rare and both epic parts of both slots as the badge max', () => {
    expect(
      ownedByTab({
        'hull-obsidian': 1,
        'hull-gold': 1,
        'tail-fin-split': 1,
        'tail-fin-comet': 1,
      }),
    ).toEqual({ ...ZERO_COUNTS, frame: HANGAR_TAB_LOOTABLE_TOTAL });
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
        'nose-crimson': 0,
        'cockpit-oracle': 0,
        'not-a-part': 5,
        'wings': 5,
      }),
    ).toEqual(ZERO_COUNTS);
  });

  it('counts a bilateral legacy id twice after normalizePartMap (wings-silver → 2)', () => {
    const normalized = normalizePartMap({ 'wings-silver': 1 });
    expect(normalized).toEqual({ 'wing-left-silver': 1, 'wing-right-silver': 1 });
    expect(ownedByTab(normalized)).toEqual({ ...ZERO_COUNTS, wings: 2 });
  });

  it('counts the legacy engine id for both ignitions after normalizePartMap (engine-blue → 2)', () => {
    const normalized = normalizePartMap({ 'engine-blue': 3 });
    expect(normalized).toEqual({ 'ignition-left-blue': 3, 'ignition-right-blue': 3 });
    expect(ownedByTab(normalized)).toEqual({ ...ZERO_COUNTS, ignitions: 2 });
  });

  it('counts a single-slot legacy id once after normalizePartMap (body-obsidian → frame 1)', () => {
    const normalized = normalizePartMap({ 'body-obsidian': 1 });
    expect(normalized).toEqual({ 'hull-obsidian': 1 });
    expect(ownedByTab(normalized)).toEqual({ ...ZERO_COUNTS, frame: 1 });
  });
});

describe('module purity (AC-1)', () => {
  const source = readFileSync(new URL('./hangar-tabs.ts', import.meta.url), 'utf8');

  it('imports only ../game/parts-v2', () => {
    const specifiers = [...source.matchAll(/^import\s[^;]*?from\s+'([^']+)';/gmu)].map(
      (match) => match[1],
    );
    expect(specifiers).toEqual(['../game/parts-v2']);
  });

  it('has no timer, randomness or DOM access', () => {
    expect(source).not.toMatch(
      /\b(?:setTimeout|setInterval|requestAnimationFrame|queueMicrotask)\b/u,
    );
    expect(source).not.toMatch(/\bMath\.random\b/u);
    expect(source).not.toMatch(/\b(?:document|window|localStorage|sessionStorage)\b/u);
  });
});
