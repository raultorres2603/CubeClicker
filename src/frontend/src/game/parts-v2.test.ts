import { describe, expect, it } from 'vitest';

import {
  PART_CATALOG_V2,
  PART_CATALOG_VERSION,
  PART_IDS_V2,
  SLOT_CATALOG,
  appearanceToCursorShipParams,
  defaultPartForSlot,
  isValidPartId,
  isValidSlotId,
  normalizeAppearance,
  normalizeCustomizationState,
  normalizePartMap,
  partDefinition,
  partSlot,
  partsForSlot,
  rarityWeight,
  selectLootPart,
  type PartDefV2,
  type PartIdV2,
  type Rarity,
  type SlotId,
} from './parts-v2.js';
import type { CustomizationState } from './types.js';

const EXPECTED_CATALOG: readonly PartDefV2[] = [
  {
    id: 'hull-default',
    slot: 'hull',
    name: 'Steel Hull',
    rarity: 'standard',
    color: '#8f9bad',
    accent: '#2f6fd6',
    shape: 'standard',
  },
  {
    id: 'hull-obsidian',
    slot: 'hull',
    name: 'Obsidian Hull',
    rarity: 'rare',
    color: '#1a2333',
    accent: '#3b82f6',
    shape: 'armored',
  },
  {
    id: 'hull-gold',
    slot: 'hull',
    name: 'Gold Hull',
    rarity: 'epic',
    color: '#ccaa44',
    accent: '#fff3d6',
    shape: 'solar',
  },
  {
    id: 'nose-default',
    slot: 'nose',
    name: 'Alloy Nose',
    rarity: 'standard',
    color: '#88aaff',
    accent: '#2f6fd6',
    shape: 'standard',
  },
  {
    id: 'nose-crimson',
    slot: 'nose',
    name: 'Crimson Lance',
    rarity: 'rare',
    color: '#cc4444',
    accent: '#ff7a1a',
    shape: 'lance',
  },
  {
    id: 'nose-emerald',
    slot: 'nose',
    name: 'Emerald Photon',
    rarity: 'epic',
    color: '#44cc88',
    accent: '#cffcff',
    shape: 'photon',
  },
  {
    id: 'cockpit-default',
    slot: 'cockpit',
    name: 'Teal Canopy',
    rarity: 'standard',
    color: '#0b2f38',
    accent: '#cffcff',
    shape: 'standard',
  },
  {
    id: 'cockpit-amber',
    slot: 'cockpit',
    name: 'Amber Razor',
    rarity: 'rare',
    color: '#3b1d0a',
    accent: '#ffaa44',
    shape: 'razor',
  },
  {
    id: 'cockpit-oracle',
    slot: 'cockpit',
    name: 'Oracle Canopy',
    rarity: 'epic',
    color: '#2e1065',
    accent: '#c4b5fd',
    shape: 'oracle',
  },
  {
    id: 'wing-left-default',
    slot: 'wing-left',
    name: 'Port Wing',
    rarity: 'standard',
    color: '#4466cc',
    accent: '#8f9bad',
    shape: 'standard',
  },
  {
    id: 'wing-left-silver',
    slot: 'wing-left',
    name: 'Port Silver Wing',
    rarity: 'rare',
    color: '#aaaaaa',
    accent: '#d9dee7',
    shape: 'razor',
  },
  {
    id: 'wing-left-gold',
    slot: 'wing-left',
    name: 'Port Gold Wing',
    rarity: 'epic',
    color: '#ccaa44',
    accent: '#fff3d6',
    shape: 'solar',
  },
  {
    id: 'wing-right-default',
    slot: 'wing-right',
    name: 'Starboard Wing',
    rarity: 'standard',
    color: '#4466cc',
    accent: '#8f9bad',
    shape: 'standard',
  },
  {
    id: 'wing-right-silver',
    slot: 'wing-right',
    name: 'Starboard Silver Wing',
    rarity: 'rare',
    color: '#aaaaaa',
    accent: '#d9dee7',
    shape: 'razor',
  },
  {
    id: 'wing-right-gold',
    slot: 'wing-right',
    name: 'Starboard Gold Wing',
    rarity: 'epic',
    color: '#ccaa44',
    accent: '#fff3d6',
    shape: 'solar',
  },
  {
    id: 'engine-left-default',
    slot: 'engine-left',
    name: 'Port Engine',
    rarity: 'standard',
    color: '#35507a',
    accent: '#1a2333',
    shape: 'standard',
  },
  {
    id: 'engine-left-vector',
    slot: 'engine-left',
    name: 'Port Vector Engine',
    rarity: 'rare',
    color: '#1e3a8a',
    accent: '#60a5fa',
    shape: 'boxed',
  },
  {
    id: 'engine-left-nova',
    slot: 'engine-left',
    name: 'Port Nova Engine',
    rarity: 'epic',
    color: '#f8fafc',
    accent: '#ffcc66',
    shape: 'nova',
  },
  {
    id: 'engine-right-default',
    slot: 'engine-right',
    name: 'Starboard Engine',
    rarity: 'standard',
    color: '#35507a',
    accent: '#1a2333',
    shape: 'standard',
  },
  {
    id: 'engine-right-vector',
    slot: 'engine-right',
    name: 'Starboard Vector Engine',
    rarity: 'rare',
    color: '#1e3a8a',
    accent: '#60a5fa',
    shape: 'boxed',
  },
  {
    id: 'engine-right-nova',
    slot: 'engine-right',
    name: 'Starboard Nova Engine',
    rarity: 'epic',
    color: '#f8fafc',
    accent: '#ffcc66',
    shape: 'nova',
  },
  {
    id: 'ignition-left-default',
    slot: 'ignition-left',
    name: 'Port Flame',
    rarity: 'standard',
    color: '#ff6600',
    accent: '#ffcc66',
    shape: 'standard',
  },
  {
    id: 'ignition-left-blue',
    slot: 'ignition-left',
    name: 'Port Blue Flame',
    rarity: 'rare',
    color: '#4488ff',
    accent: '#cffcff',
    shape: 'ion',
  },
  {
    id: 'ignition-left-plasma',
    slot: 'ignition-left',
    name: 'Port Plasma Flame',
    rarity: 'epic',
    color: '#a855f7',
    accent: '#f0abfc',
    shape: 'plasma',
  },
  {
    id: 'ignition-right-default',
    slot: 'ignition-right',
    name: 'Starboard Flame',
    rarity: 'standard',
    color: '#ff6600',
    accent: '#ffcc66',
    shape: 'standard',
  },
  {
    id: 'ignition-right-blue',
    slot: 'ignition-right',
    name: 'Starboard Blue Flame',
    rarity: 'rare',
    color: '#4488ff',
    accent: '#cffcff',
    shape: 'ion',
  },
  {
    id: 'ignition-right-plasma',
    slot: 'ignition-right',
    name: 'Starboard Plasma Flame',
    rarity: 'epic',
    color: '#a855f7',
    accent: '#f0abfc',
    shape: 'plasma',
  },
  {
    id: 'tail-fin-default',
    slot: 'tail-fin',
    name: 'Standard Fin',
    rarity: 'standard',
    color: '#14213d',
    accent: '#8f9bad',
    shape: 'standard',
  },
  {
    id: 'tail-fin-split',
    slot: 'tail-fin',
    name: 'Split Fin',
    rarity: 'rare',
    color: '#64748b',
    accent: '#cbd5e1',
    shape: 'split',
  },
  {
    id: 'tail-fin-comet',
    slot: 'tail-fin',
    name: 'Comet Fin',
    rarity: 'epic',
    color: '#ff7a1a',
    accent: '#ffcc66',
    shape: 'comet',
  },
];

const EXPECTED_SLOTS = [
  { id: 'hull', name: 'Hull' },
  { id: 'nose', name: 'Nose' },
  { id: 'cockpit', name: 'Cockpit' },
  { id: 'wing-left', name: 'Port Wing' },
  { id: 'wing-right', name: 'Starboard Wing' },
  { id: 'engine-left', name: 'Port Engine' },
  { id: 'engine-right', name: 'Starboard Engine' },
  { id: 'ignition-left', name: 'Port Ignition' },
  { id: 'ignition-right', name: 'Starboard Ignition' },
  { id: 'tail-fin', name: 'Tail Fin' },
] as const;

const EXPECTED_IDS_BY_SLOT: Readonly<Record<SlotId, readonly PartIdV2[]>> = {
  hull: ['hull-default', 'hull-obsidian', 'hull-gold'],
  nose: ['nose-default', 'nose-crimson', 'nose-emerald'],
  cockpit: ['cockpit-default', 'cockpit-amber', 'cockpit-oracle'],
  'wing-left': ['wing-left-default', 'wing-left-silver', 'wing-left-gold'],
  'wing-right': ['wing-right-default', 'wing-right-silver', 'wing-right-gold'],
  'engine-left': ['engine-left-default', 'engine-left-vector', 'engine-left-nova'],
  'engine-right': ['engine-right-default', 'engine-right-vector', 'engine-right-nova'],
  'ignition-left': ['ignition-left-default', 'ignition-left-blue', 'ignition-left-plasma'],
  'ignition-right': ['ignition-right-default', 'ignition-right-blue', 'ignition-right-plasma'],
  'tail-fin': ['tail-fin-default', 'tail-fin-split', 'tail-fin-comet'],
};

describe('SLOT_CATALOG', () => {
  it('pins the ten slots and display names in order', () => {
    expect(SLOT_CATALOG).toEqual(EXPECTED_SLOTS);
    expect(SLOT_CATALOG).toHaveLength(10);
  });

  it('accepts every canonical slot id', () => {
    for (const slot of SLOT_CATALOG) {
      expect(isValidSlotId(slot.id)).toBe(true);
      expect(slot.name.length).toBeGreaterThan(0);
    }
  });

  it('rejects legacy and malformed slot ids', () => {
    expect(isValidSlotId('wings')).toBe(false);
    expect(isValidSlotId('engine')).toBe(false);
    expect(isValidSlotId('body')).toBe(false);
    expect(isValidSlotId('')).toBe(false);
    expect(isValidSlotId('Hull')).toBe(false);
  });
});

describe('PART_CATALOG_V2', () => {
  it('pins the exact 30-row table', () => {
    expect(PART_CATALOG_V2).toEqual(EXPECTED_CATALOG);
    expect(PART_CATALOG_V2).toHaveLength(30);
  });

  it('pins the 30 part ids in catalog order', () => {
    expect(PART_IDS_V2).toEqual(EXPECTED_CATALOG.map((part) => part.id));
    expect(PART_IDS_V2).toHaveLength(30);
  });

  it('pins the catalog version', () => {
    expect(PART_CATALOG_VERSION).toBe(2);
  });

  it('has ten standard, ten rare and ten epic parts (three per slot)', () => {
    const counts: Record<Rarity, number> = { standard: 0, rare: 0, epic: 0 };
    for (const part of PART_CATALOG_V2) {
      counts[part.rarity] += 1;
    }
    expect(counts).toEqual({ standard: 10, rare: 10, epic: 10 });
    for (const slot of SLOT_CATALOG) {
      expect(PART_CATALOG_V2.filter((part) => part.slot === slot.id)).toHaveLength(3);
    }
  });
});

describe('isValidPartId', () => {
  it('accepts exactly the 30 v2 ids', () => {
    for (const id of PART_IDS_V2) {
      expect(isValidPartId(id)).toBe(true);
    }
  });

  it('rejects legacy, malformed and case-changed ids', () => {
    expect(isValidPartId('')).toBe(false);
    expect(isValidPartId('unknown')).toBe(false);
    expect(isValidPartId('wings-silver')).toBe(false);
    expect(isValidPartId('body-gold')).toBe(false);
    expect(isValidPartId('engine-blue')).toBe(false);
    expect(isValidPartId('HULL-DEFAULT')).toBe(false);
    expect(isValidPartId('hull')).toBe(false);
  });
});

describe('partDefinition and partSlot', () => {
  it('returns the exact row for every v2 id', () => {
    for (const part of EXPECTED_CATALOG) {
      expect(partDefinition(part.id)).toEqual(part);
      expect(partSlot(part.id)).toBe(part.slot);
    }
  });

  it('throws the pinned error for unknown ids', () => {
    expect(() => partDefinition('nope')).toThrow('unknown part: nope');
    expect(() => partSlot('body-gold')).toThrow('unknown part: body-gold');
  });
});

describe('partsForSlot', () => {
  it('returns exactly three parts per slot in standard to epic order', () => {
    for (const slot of SLOT_CATALOG) {
      const parts = partsForSlot(slot.id);
      expect(parts.map((part) => part.id)).toEqual(EXPECTED_IDS_BY_SLOT[slot.id]);
      expect(parts.map((part) => part.rarity)).toEqual(['standard', 'rare', 'epic']);
      expect(parts.every((part) => part.slot === slot.id)).toBe(true);
    }
  });

  it('returns an empty list for a legacy slot key', () => {
    expect(partsForSlot('wings' as SlotId)).toEqual([]);
  });
});

describe('defaultPartForSlot', () => {
  it('returns the standard id for every slot', () => {
    for (const slot of SLOT_CATALOG) {
      expect(defaultPartForSlot(slot.id)).toBe(EXPECTED_IDS_BY_SLOT[slot.id][0]);
    }
  });

  it('throws for an unknown slot', () => {
    expect(() => defaultPartForSlot('engine' as SlotId)).toThrow('unknown slot: engine');
  });
});

describe('rarityWeight', () => {
  it('pins standard 0, rare 3 and epic 1', () => {
    expect(rarityWeight('standard')).toBe(0);
    expect(rarityWeight('rare')).toBe(3);
    expect(rarityWeight('epic')).toBe(1);
  });

  it('throws for an unknown rarity', () => {
    expect(() => rarityWeight('legendary' as Rarity)).toThrow('unknown rarity: legendary');
  });
});

const EXPECTED_LOOT_DISTRIBUTION: ReadonlyArray<readonly [PartIdV2, number]> = [
  ['hull-obsidian', 3],
  ['hull-gold', 1],
  ['nose-crimson', 3],
  ['nose-emerald', 1],
  ['cockpit-amber', 3],
  ['cockpit-oracle', 1],
  ['wing-left-silver', 3],
  ['wing-left-gold', 1],
  ['wing-right-silver', 3],
  ['wing-right-gold', 1],
  ['engine-left-vector', 3],
  ['engine-left-nova', 1],
  ['engine-right-vector', 3],
  ['engine-right-nova', 1],
  ['ignition-left-blue', 3],
  ['ignition-left-plasma', 1],
  ['ignition-right-blue', 3],
  ['ignition-right-plasma', 1],
  ['tail-fin-split', 3],
  ['tail-fin-comet', 1],
];

describe('selectLootPart', () => {
  it('selects the first lootable part for a draw of 0', () => {
    expect(selectLootPart(() => 0)).toBe('hull-obsidian');
  });

  it('selects the last lootable part for a draw just under 1', () => {
    expect(selectLootPart(() => 0.999999)).toBe('tail-fin-comet');
  });

  it('clamps a draw of 1 to the last part', () => {
    expect(selectLootPart(() => 1)).toBe('tail-fin-comet');
  });

  it('treats a non-finite draw as 0', () => {
    expect(selectLootPart(() => Number.NaN)).toBe('hull-obsidian');
  });

  it('matches the exact 20-segment 40-weight distribution', () => {
    let cumulative = 0;
    for (const [id, weight] of EXPECTED_LOOT_DISTRIBUTION) {
      expect(selectLootPart(() => cumulative / 40)).toBe(id);
      expect(selectLootPart(() => (cumulative + weight / 2) / 40)).toBe(id);
      cumulative += weight;
    }
    expect(cumulative).toBe(40);
  });

  it('pins 75 percent rare and 25 percent epic aggregates', () => {
    const rare = EXPECTED_LOOT_DISTRIBUTION.filter(
      ([id]) => partDefinition(id).rarity === 'rare',
    );
    const epic = EXPECTED_LOOT_DISTRIBUTION.filter(
      ([id]) => partDefinition(id).rarity === 'epic',
    );
    expect(rare).toHaveLength(10);
    expect(epic).toHaveLength(10);
    for (const [id, weight] of rare) {
      expect(weight).toBe(3);
      expect(rarityWeight(partDefinition(id).rarity)).toBe(3);
    }
    for (const [id, weight] of epic) {
      expect(weight).toBe(1);
      expect(rarityWeight(partDefinition(id).rarity)).toBe(1);
    }
    const rareTotal = rare.reduce((total, [, weight]) => total + weight, 0);
    const epicTotal = epic.reduce((total, [, weight]) => total + weight, 0);
    expect(rareTotal).toBe(30);
    expect(epicTotal).toBe(10);
    expect(rareTotal / 40).toBe(0.75);
    expect(epicTotal / 40).toBe(0.25);
    expect(3 / 40).toBe(0.075);
    expect(1 / 40).toBe(0.025);
  });

  it('consumes exactly one rng draw', () => {
    let calls = 0;
    const id = selectLootPart(() => {
      calls += 1;
      return 0.5;
    });
    expect(id).toBe('engine-left-vector');
    expect(calls).toBe(1);
  });

  it('never returns a standard part', () => {
    for (let step = 0; step < 100; step += 1) {
      const id = selectLootPart(() => step / 100);
      expect(partDefinition(id).rarity).not.toBe('standard');
    }
  });
});

describe('normalizePartMap', () => {
  it('keeps a canonical v2 map unchanged', () => {
    expect(normalizePartMap({ 'hull-obsidian': 2, 'tail-fin-comet': 1 })).toEqual({
      'hull-obsidian': 2,
      'tail-fin-comet': 1,
    });
  });

  it('emits keys in catalog order', () => {
    expect(Object.keys(normalizePartMap({ 'tail-fin-comet': 1, 'hull-obsidian': 2 }))).toEqual([
      'hull-obsidian',
      'tail-fin-comet',
    ]);
  });

  it('maps the legacy body, wings and engine keys to v2 ids', () => {
    expect(normalizePartMap({ 'body-gold': 1, 'wings-silver': 2, 'engine-blue': 1 })).toEqual({
      'hull-gold': 1,
      'wing-left-silver': 2,
      'wing-right-silver': 2,
      'ignition-left-blue': 1,
      'ignition-right-blue': 1,
    });
  });

  it('sums collisions between legacy and canonical keys', () => {
    expect(
      normalizePartMap({ 'wings-silver': 2, 'wing-left-silver': 3, 'body-gold': 1, 'hull-gold': 4 }),
    ).toEqual({
      'wing-left-silver': 5,
      'wing-right-silver': 2,
      'hull-gold': 5,
    });
  });

  it('keeps explicitly stored zero counts', () => {
    expect(normalizePartMap({ 'hull-default': 0, 'nose-crimson': 0 })).toEqual({
      'hull-default': 0,
      'nose-crimson': 0,
    });
  });

  it('accepts the maximum stored count', () => {
    expect(normalizePartMap({ 'cockpit-oracle': 2147483647 })).toEqual({
      'cockpit-oracle': 2147483647,
    });
  });

  it('drops unknown ids, malformed keys and invalid counts', () => {
    expect(
      normalizePartMap({
        'wings-nope': 1,
        'wings-gold': 1,
        'engine-plasma': 1,
        'body-unknown': 2,
        'nose-unknown': 3,
        '-gold': 4,
        'body-': 5,
        'mystery-gold': 6,
        'hull-obsidian': -1,
        'hull-gold': 1.5,
        'nose-crimson': Number.NaN,
        'nose-emerald': Number.POSITIVE_INFINITY,
        'cockpit-amber': 2147483648,
        'cockpit-oracle': '2' as unknown as number,
      }),
    ).toEqual({});
  });

  it('does not mutate the input', () => {
    const input: Record<string, number> = { 'wings-silver': 2 };
    Object.freeze(input);
    const normalized = normalizePartMap(input);
    expect(normalized).toEqual({ 'wing-left-silver': 2, 'wing-right-silver': 2 });
    expect(normalized).not.toBe(input);
    expect(input).toEqual({ 'wings-silver': 2 });
  });
});

describe('normalizeAppearance', () => {
  it('maps the AC-33 legacy appearance fixture to canonical slots', () => {
    expect(
      normalizeAppearance({
        wings: 'wings-silver',
        engine: 'engine-blue',
        body: 'body-gold',
      }),
    ).toEqual({
      'wing-left': 'wing-left-silver',
      'wing-right': 'wing-right-silver',
      'ignition-left': 'ignition-left-blue',
      'ignition-right': 'ignition-right-blue',
      hull: 'hull-gold',
    });
  });

  it('keeps a canonical v2 appearance unchanged', () => {
    expect(
      normalizeAppearance({
        hull: 'hull-obsidian',
        'wing-left': 'wing-left-gold',
        'ignition-right': 'ignition-right-plasma',
      }),
    ).toEqual({
      hull: 'hull-obsidian',
      'wing-left': 'wing-left-gold',
      'ignition-right': 'ignition-right-plasma',
    });
  });

  it('keeps canonical nose and cockpit values', () => {
    expect(normalizeAppearance({ nose: 'nose-crimson', cockpit: 'cockpit-amber' })).toEqual({
      nose: 'nose-crimson',
      cockpit: 'cockpit-amber',
    });
  });

  it('maps a legacy part value stored under a canonical slot key', () => {
    expect(normalizeAppearance({ hull: 'body-gold', 'wing-left': 'wings-silver' })).toEqual({
      hull: 'hull-gold',
      'wing-left': 'wing-left-silver',
    });
  });

  it('maps a canonical part value stored under a legacy category key', () => {
    expect(normalizeAppearance({ wings: 'wing-left-silver' })).toEqual({
      'wing-left': 'wing-left-silver',
    });
  });

  it('emits keys in slot order', () => {
    expect(
      Object.keys(normalizeAppearance({ 'tail-fin': 'tail-fin-comet', hull: 'hull-obsidian' })),
    ).toEqual(['hull', 'tail-fin']);
  });

  it('lets an explicit canonical slot win over a legacy category in either order', () => {
    expect(
      normalizeAppearance({ wings: 'wings-silver', 'wing-left': 'wing-left-gold' }),
    ).toEqual({
      'wing-left': 'wing-left-gold',
      'wing-right': 'wing-right-silver',
    });
    expect(
      normalizeAppearance({ 'wing-left': 'wing-left-gold', wings: 'wings-silver' }),
    ).toEqual({
      'wing-left': 'wing-left-gold',
      'wing-right': 'wing-right-silver',
    });
  });

  it('drops slot/part mismatches and unknown keys or values', () => {
    expect(
      normalizeAppearance({
        'wing-left': 'wing-right-silver',
        hull: 'hull-nope',
        mystery: 'hull-gold',
        body: 'wings-silver',
        wings: 'hull-gold',
        engine: 'engine-unknown',
        cockpit: 'cockpit-amber',
      }),
    ).toEqual({ cockpit: 'cockpit-amber' });
  });

  it('drops legacy values without a suffix and non-string values', () => {
    expect(
      normalizeAppearance({
        wings: 'wings-',
        hull: 7 as unknown as string,
      }),
    ).toEqual({});
  });

  it('does not mutate the input', () => {
    const input: Record<string, string> = { wings: 'wings-silver' };
    Object.freeze(input);
    const normalized = normalizeAppearance(input);
    expect(normalized).toEqual({
      'wing-left': 'wing-left-silver',
      'wing-right': 'wing-right-silver',
    });
    expect(normalized).not.toBe(input);
    expect(input).toEqual({ wings: 'wings-silver' });
  });
});

describe('normalizeCustomizationState', () => {
  it('normalizes parts and appearance while preserving counts', () => {
    const state: CustomizationState = {
      lootboxes: 3,
      keys: 2,
      parts: { 'wings-silver': 2, 'engine-blue': 1, 'body-gold': 1 },
      appearance: { wings: 'wings-silver', engine: 'engine-blue', body: 'body-gold' },
    };
    expect(normalizeCustomizationState(state)).toEqual({
      lootboxes: 3,
      keys: 2,
      parts: {
        'wing-left-silver': 2,
        'wing-right-silver': 2,
        'ignition-left-blue': 1,
        'ignition-right-blue': 1,
        'hull-gold': 1,
      },
      appearance: {
        'wing-left': 'wing-left-silver',
        'wing-right': 'wing-right-silver',
        'ignition-left': 'ignition-left-blue',
        'ignition-right': 'ignition-right-blue',
        hull: 'hull-gold',
      },
    });
  });

  it('normalizes the zero state to empty maps', () => {
    expect(
      normalizeCustomizationState({ lootboxes: 0, keys: 0, parts: {}, appearance: {} }),
    ).toEqual({ lootboxes: 0, keys: 0, parts: {}, appearance: {} });
  });

  it('returns defensive copies and is idempotent', () => {
    const state: CustomizationState = {
      lootboxes: 1,
      keys: 1,
      parts: { 'hull-obsidian': 1 },
      appearance: { hull: 'hull-obsidian' },
    };
    const normalized = normalizeCustomizationState(state);
    expect(normalized.parts).not.toBe(state.parts);
    expect(normalized.appearance).not.toBe(state.appearance);
    expect(normalizeCustomizationState(normalized)).toEqual(normalized);

    normalized.parts['hull-obsidian'] = 9;
    normalized.appearance.hull = 'hull-gold';
    expect(state.parts).toEqual({ 'hull-obsidian': 1 });
    expect(state.appearance).toEqual({ hull: 'hull-obsidian' });
  });
});

describe('appearanceToCursorShipParams', () => {
  it('returns all ten standard visuals for an empty appearance', () => {
    const params = appearanceToCursorShipParams({});
    expect(Object.keys(params)).toEqual(EXPECTED_SLOTS.map((slot) => slot.id));
    expect(params).toEqual({
      hull: {
        partId: 'hull-default',
        slot: 'hull',
        color: '#8f9bad',
        accent: '#2f6fd6',
        rarity: 'standard',
        shape: 'standard',
      },
      nose: {
        partId: 'nose-default',
        slot: 'nose',
        color: '#88aaff',
        accent: '#2f6fd6',
        rarity: 'standard',
        shape: 'standard',
      },
      cockpit: {
        partId: 'cockpit-default',
        slot: 'cockpit',
        color: '#0b2f38',
        accent: '#cffcff',
        rarity: 'standard',
        shape: 'standard',
      },
      'wing-left': {
        partId: 'wing-left-default',
        slot: 'wing-left',
        color: '#4466cc',
        accent: '#8f9bad',
        rarity: 'standard',
        shape: 'standard',
      },
      'wing-right': {
        partId: 'wing-right-default',
        slot: 'wing-right',
        color: '#4466cc',
        accent: '#8f9bad',
        rarity: 'standard',
        shape: 'standard',
      },
      'engine-left': {
        partId: 'engine-left-default',
        slot: 'engine-left',
        color: '#35507a',
        accent: '#1a2333',
        rarity: 'standard',
        shape: 'standard',
      },
      'engine-right': {
        partId: 'engine-right-default',
        slot: 'engine-right',
        color: '#35507a',
        accent: '#1a2333',
        rarity: 'standard',
        shape: 'standard',
      },
      'ignition-left': {
        partId: 'ignition-left-default',
        slot: 'ignition-left',
        color: '#ff6600',
        accent: '#ffcc66',
        rarity: 'standard',
        shape: 'standard',
      },
      'ignition-right': {
        partId: 'ignition-right-default',
        slot: 'ignition-right',
        color: '#ff6600',
        accent: '#ffcc66',
        rarity: 'standard',
        shape: 'standard',
      },
      'tail-fin': {
        partId: 'tail-fin-default',
        slot: 'tail-fin',
        color: '#14213d',
        accent: '#8f9bad',
        rarity: 'standard',
        shape: 'standard',
      },
    });
  });

  it('uses equipped part colour, accent, rarity and shape per slot', () => {
    const params = appearanceToCursorShipParams({
      hull: 'hull-obsidian',
      cockpit: 'cockpit-oracle',
      'wing-left': 'wing-left-gold',
      'ignition-right': 'ignition-right-plasma',
      'tail-fin': 'tail-fin-comet',
    });
    expect(params.hull).toEqual({
      partId: 'hull-obsidian',
      slot: 'hull',
      color: '#1a2333',
      accent: '#3b82f6',
      rarity: 'rare',
      shape: 'armored',
    });
    expect(params.cockpit).toEqual({
      partId: 'cockpit-oracle',
      slot: 'cockpit',
      color: '#2e1065',
      accent: '#c4b5fd',
      rarity: 'epic',
      shape: 'oracle',
    });
    expect(params['wing-left']).toEqual({
      partId: 'wing-left-gold',
      slot: 'wing-left',
      color: '#ccaa44',
      accent: '#fff3d6',
      rarity: 'epic',
      shape: 'solar',
    });
    expect(params['ignition-right']).toEqual({
      partId: 'ignition-right-plasma',
      slot: 'ignition-right',
      color: '#a855f7',
      accent: '#f0abfc',
      rarity: 'epic',
      shape: 'plasma',
    });
    expect(params['tail-fin']).toEqual({
      partId: 'tail-fin-comet',
      slot: 'tail-fin',
      color: '#ff7a1a',
      accent: '#ffcc66',
      rarity: 'epic',
      shape: 'comet',
    });
    expect(params['wing-right'].partId).toBe('wing-right-default');
    expect(params.nose.partId).toBe('nose-default');
  });

  it('maps a legacy appearance to both wings and both ignitions', () => {
    const params = appearanceToCursorShipParams({
      wings: 'wings-silver',
      engine: 'engine-blue',
      body: 'body-gold',
    });
    expect(params['wing-left']).toEqual({
      partId: 'wing-left-silver',
      slot: 'wing-left',
      color: '#aaaaaa',
      accent: '#d9dee7',
      rarity: 'rare',
      shape: 'razor',
    });
    expect(params['wing-right']).toEqual({
      partId: 'wing-right-silver',
      slot: 'wing-right',
      color: '#aaaaaa',
      accent: '#d9dee7',
      rarity: 'rare',
      shape: 'razor',
    });
    expect(params['ignition-left']).toEqual({
      partId: 'ignition-left-blue',
      slot: 'ignition-left',
      color: '#4488ff',
      accent: '#cffcff',
      rarity: 'rare',
      shape: 'ion',
    });
    expect(params['ignition-right']).toEqual({
      partId: 'ignition-right-blue',
      slot: 'ignition-right',
      color: '#4488ff',
      accent: '#cffcff',
      rarity: 'rare',
      shape: 'ion',
    });
    expect(params.hull).toEqual({
      partId: 'hull-gold',
      slot: 'hull',
      color: '#ccaa44',
      accent: '#fff3d6',
      rarity: 'epic',
      shape: 'solar',
    });
  });

  it('falls back to the standard part for missing, invalid and mismatched values', () => {
    const params = appearanceToCursorShipParams({
      'wing-left': 'wing-right-gold',
      hull: 'nope',
      nose: 'nose-crimson',
    });
    expect(params['wing-left']).toEqual({
      partId: 'wing-left-default',
      slot: 'wing-left',
      color: '#4466cc',
      accent: '#8f9bad',
      rarity: 'standard',
      shape: 'standard',
    });
    expect(params.hull.partId).toBe('hull-default');
    expect(params.nose).toEqual({
      partId: 'nose-crimson',
      slot: 'nose',
      color: '#cc4444',
      accent: '#ff7a1a',
      rarity: 'rare',
      shape: 'lance',
    });
  });
});
