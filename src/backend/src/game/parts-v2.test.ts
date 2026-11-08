import { describe, expect, it } from 'vitest';

import {
  PART_CATALOG_V2,
  PART_CATALOG_VERSION,
  PART_IDS_V2,
  SLOT_CATALOG,
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
  type CustomizationState,
  type PartDefV2,
  type Rarity,
  type SlotDef,
  type SlotId,
} from './parts-v2.js';

/** The pinned spec table: exact order, ids, slots, names, rarities, colours, accents, shapes. */
const EXPECTED_PART_CATALOG: readonly PartDefV2[] = [
  { id: 'hull-default', slot: 'hull', name: 'Steel Hull', rarity: 'standard', color: '#8f9bad', accent: '#2f6fd6', shape: 'standard' },
  { id: 'hull-obsidian', slot: 'hull', name: 'Obsidian Hull', rarity: 'rare', color: '#1a2333', accent: '#3b82f6', shape: 'armored' },
  { id: 'hull-gold', slot: 'hull', name: 'Gold Hull', rarity: 'epic', color: '#ccaa44', accent: '#fff3d6', shape: 'solar' },
  { id: 'nose-default', slot: 'nose', name: 'Alloy Nose', rarity: 'standard', color: '#88aaff', accent: '#2f6fd6', shape: 'standard' },
  { id: 'nose-crimson', slot: 'nose', name: 'Crimson Lance', rarity: 'rare', color: '#cc4444', accent: '#ff7a1a', shape: 'lance' },
  { id: 'nose-emerald', slot: 'nose', name: 'Emerald Photon', rarity: 'epic', color: '#44cc88', accent: '#cffcff', shape: 'photon' },
  { id: 'cockpit-default', slot: 'cockpit', name: 'Teal Canopy', rarity: 'standard', color: '#0b2f38', accent: '#cffcff', shape: 'standard' },
  { id: 'cockpit-amber', slot: 'cockpit', name: 'Amber Razor', rarity: 'rare', color: '#3b1d0a', accent: '#ffaa44', shape: 'razor' },
  { id: 'cockpit-oracle', slot: 'cockpit', name: 'Oracle Canopy', rarity: 'epic', color: '#2e1065', accent: '#c4b5fd', shape: 'oracle' },
  { id: 'wing-left-default', slot: 'wing-left', name: 'Port Wing', rarity: 'standard', color: '#4466cc', accent: '#8f9bad', shape: 'standard' },
  { id: 'wing-left-silver', slot: 'wing-left', name: 'Port Silver Wing', rarity: 'rare', color: '#aaaaaa', accent: '#d9dee7', shape: 'razor' },
  { id: 'wing-left-gold', slot: 'wing-left', name: 'Port Gold Wing', rarity: 'epic', color: '#ccaa44', accent: '#fff3d6', shape: 'solar' },
  { id: 'wing-right-default', slot: 'wing-right', name: 'Starboard Wing', rarity: 'standard', color: '#4466cc', accent: '#8f9bad', shape: 'standard' },
  { id: 'wing-right-silver', slot: 'wing-right', name: 'Starboard Silver Wing', rarity: 'rare', color: '#aaaaaa', accent: '#d9dee7', shape: 'razor' },
  { id: 'wing-right-gold', slot: 'wing-right', name: 'Starboard Gold Wing', rarity: 'epic', color: '#ccaa44', accent: '#fff3d6', shape: 'solar' },
  { id: 'engine-left-default', slot: 'engine-left', name: 'Port Engine', rarity: 'standard', color: '#35507a', accent: '#1a2333', shape: 'standard' },
  { id: 'engine-left-vector', slot: 'engine-left', name: 'Port Vector Engine', rarity: 'rare', color: '#1e3a8a', accent: '#60a5fa', shape: 'boxed' },
  { id: 'engine-left-nova', slot: 'engine-left', name: 'Port Nova Engine', rarity: 'epic', color: '#f8fafc', accent: '#ffcc66', shape: 'nova' },
  { id: 'engine-right-default', slot: 'engine-right', name: 'Starboard Engine', rarity: 'standard', color: '#35507a', accent: '#1a2333', shape: 'standard' },
  { id: 'engine-right-vector', slot: 'engine-right', name: 'Starboard Vector Engine', rarity: 'rare', color: '#1e3a8a', accent: '#60a5fa', shape: 'boxed' },
  { id: 'engine-right-nova', slot: 'engine-right', name: 'Starboard Nova Engine', rarity: 'epic', color: '#f8fafc', accent: '#ffcc66', shape: 'nova' },
  { id: 'ignition-left-default', slot: 'ignition-left', name: 'Port Flame', rarity: 'standard', color: '#ff6600', accent: '#ffcc66', shape: 'standard' },
  { id: 'ignition-left-blue', slot: 'ignition-left', name: 'Port Blue Flame', rarity: 'rare', color: '#4488ff', accent: '#cffcff', shape: 'ion' },
  { id: 'ignition-left-plasma', slot: 'ignition-left', name: 'Port Plasma Flame', rarity: 'epic', color: '#a855f7', accent: '#f0abfc', shape: 'plasma' },
  { id: 'ignition-right-default', slot: 'ignition-right', name: 'Starboard Flame', rarity: 'standard', color: '#ff6600', accent: '#ffcc66', shape: 'standard' },
  { id: 'ignition-right-blue', slot: 'ignition-right', name: 'Starboard Blue Flame', rarity: 'rare', color: '#4488ff', accent: '#cffcff', shape: 'ion' },
  { id: 'ignition-right-plasma', slot: 'ignition-right', name: 'Starboard Plasma Flame', rarity: 'epic', color: '#a855f7', accent: '#f0abfc', shape: 'plasma' },
  { id: 'tail-fin-default', slot: 'tail-fin', name: 'Standard Fin', rarity: 'standard', color: '#14213d', accent: '#8f9bad', shape: 'standard' },
  { id: 'tail-fin-split', slot: 'tail-fin', name: 'Split Fin', rarity: 'rare', color: '#64748b', accent: '#cbd5e1', shape: 'split' },
  { id: 'tail-fin-comet', slot: 'tail-fin', name: 'Comet Fin', rarity: 'epic', color: '#ff7a1a', accent: '#ffcc66', shape: 'comet' },
];

const EXPECTED_SLOT_CATALOG: readonly SlotDef[] = [
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
];

describe('catalog constants', () => {
  it('pins PART_CATALOG_VERSION to 2', () => {
    expect(PART_CATALOG_VERSION).toBe(2);
  });

  it('pins exactly ten slots in order with display names', () => {
    expect(SLOT_CATALOG).toEqual(EXPECTED_SLOT_CATALOG);
    expect(SLOT_CATALOG).toHaveLength(10);
  });

  it('pins the exact thirty-row catalog in order', () => {
    expect(PART_CATALOG_V2).toEqual(EXPECTED_PART_CATALOG);
    expect(PART_CATALOG_V2).toHaveLength(30);
  });

  it('pins PART_IDS_V2 to the catalog order', () => {
    expect(PART_IDS_V2).toEqual(EXPECTED_PART_CATALOG.map((part) => part.id));
    expect(PART_IDS_V2).toHaveLength(30);
  });

  it('has ten standard, ten rare and ten epic parts, three per slot', () => {
    const rarities: Record<Rarity, number> = { standard: 0, rare: 0, epic: 0 };
    for (const part of PART_CATALOG_V2) {
      rarities[part.rarity] += 1;
    }
    expect(rarities).toEqual({ standard: 10, rare: 10, epic: 10 });

    for (const slot of EXPECTED_SLOT_CATALOG) {
      const entries = PART_CATALOG_V2.filter((part) => part.slot === slot.id);
      expect(entries).toHaveLength(3);
      expect(entries.map((part) => part.rarity)).toEqual(['standard', 'rare', 'epic']);
    }
  });
});

describe('isValidSlotId', () => {
  it('accepts every pinned slot id', () => {
    for (const slot of EXPECTED_SLOT_CATALOG) {
      expect(isValidSlotId(slot.id)).toBe(true);
    }
  });

  it('rejects legacy categories, empty strings and case variants', () => {
    expect(isValidSlotId('wings')).toBe(false);
    expect(isValidSlotId('engine')).toBe(false);
    expect(isValidSlotId('body')).toBe(false);
    expect(isValidSlotId('')).toBe(false);
    expect(isValidSlotId('Hull')).toBe(false);
  });
});

describe('isValidPartId', () => {
  it('accepts exactly the thirty v2 ids', () => {
    for (const part of EXPECTED_PART_CATALOG) {
      expect(isValidPartId(part.id)).toBe(true);
    }
  });

  it('rejects legacy ids, empty strings and case variants', () => {
    expect(isValidPartId('body-gold')).toBe(false);
    expect(isValidPartId('wings-silver')).toBe(false);
    expect(isValidPartId('engine-blue')).toBe(false);
    expect(isValidPartId('')).toBe(false);
    expect(isValidPartId('HULL-GOLD')).toBe(false);
    expect(isValidPartId('hull')).toBe(false);
  });
});

describe('partDefinition and partSlot', () => {
  it('returns the exact definition for a known part', () => {
    expect(partDefinition('hull-obsidian')).toEqual({
      id: 'hull-obsidian',
      slot: 'hull',
      name: 'Obsidian Hull',
      rarity: 'rare',
      color: '#1a2333',
      accent: '#3b82f6',
      shape: 'armored',
    });
    expect(partDefinition('tail-fin-comet')).toEqual({
      id: 'tail-fin-comet',
      slot: 'tail-fin',
      name: 'Comet Fin',
      rarity: 'epic',
      color: '#ff7a1a',
      accent: '#ffcc66',
      shape: 'comet',
    });
  });

  it('maps every pinned part id to its pinned slot', () => {
    for (const part of EXPECTED_PART_CATALOG) {
      expect(partSlot(part.id)).toBe(part.slot);
    }
  });

  it('throws unknown part for an unknown id', () => {
    expect(() => partDefinition('nope')).toThrow('unknown part: nope');
    expect(() => partSlot('body-gold')).toThrow('unknown part: body-gold');
  });
});

describe('partsForSlot and defaultPartForSlot', () => {
  it('returns the three parts for each slot in standard -> rare -> epic order', () => {
    for (const slot of EXPECTED_SLOT_CATALOG) {
      const entries = partsForSlot(slot.id);
      expect(entries).toHaveLength(3);
      expect(entries.map((part) => part.id)).toEqual(
        EXPECTED_PART_CATALOG.filter((part) => part.slot === slot.id).map((part) => part.id),
      );
      expect(entries.map((part) => part.rarity)).toEqual(['standard', 'rare', 'epic']);
    }
  });

  it('returns the standard id for every slot', () => {
    for (const slot of EXPECTED_SLOT_CATALOG) {
      expect(defaultPartForSlot(slot.id)).toBe(partsForSlot(slot.id)[0]!.id);
    }
    expect(defaultPartForSlot('hull')).toBe('hull-default');
    expect(defaultPartForSlot('tail-fin')).toBe('tail-fin-default');
  });

  it('throws unknown slot when no standard part can be resolved', () => {
    expect(() => defaultPartForSlot('wings' as SlotId)).toThrow('unknown slot: wings');
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

describe('selectLootPart', () => {
  it('selects the first lootable part at rng 0', () => {
    expect(selectLootPart(() => 0)).toBe('hull-obsidian');
  });

  it('selects the last lootable part at 0.999999 and clamps a 1 draw', () => {
    expect(selectLootPart(() => 0.999999)).toBe('tail-fin-comet');
    expect(selectLootPart(() => 1)).toBe('tail-fin-comet');
  });

  it('clamps out-of-range draws', () => {
    expect(selectLootPart(() => -0.5)).toBe('hull-obsidian');
    expect(selectLootPart(() => Number.NaN)).toBe('hull-obsidian');
  });

  it('consumes exactly one rng draw', () => {
    let draws = 0;
    const selected = selectLootPart(() => {
      draws += 1;
      return 0.5;
    });
    expect(draws).toBe(1);
    expect(selected).toBe('engine-left-vector');
  });

  it('places the rare/epic boundary at the weight fraction', () => {
    expect(selectLootPart(() => 0.074999)).toBe('hull-obsidian');
    expect(selectLootPart(() => 0.075)).toBe('hull-gold');
  });

  it('yields each rare part 3/40 and each epic part 1/40 of the time', () => {
    const counts: Record<string, number> = {};
    for (let index = 0; index < 40; index += 1) {
      const partId = selectLootPart(() => (index + 0.5) / 40);
      counts[partId] = (counts[partId] ?? 0) + 1;
    }

    const expectedCounts: Record<string, number> = {};
    for (const part of EXPECTED_PART_CATALOG) {
      if (part.rarity === 'rare') {
        expectedCounts[part.id] = 3;
      } else if (part.rarity === 'epic') {
        expectedCounts[part.id] = 1;
      }
    }
    expect(counts).toEqual(expectedCounts);

    const rareSelections = EXPECTED_PART_CATALOG.filter((part) => part.rarity === 'rare').reduce(
      (total, part) => total + (counts[part.id] ?? 0),
      0,
    );
    expect(rareSelections).toBe(30);
    expect(rareSelections / 40).toBe(0.75);
  });

  it('never returns a standard part', () => {
    const standardIds = EXPECTED_PART_CATALOG.filter((part) => part.rarity === 'standard').map(
      (part) => part.id,
    );
    for (let index = 0; index < 40; index += 1) {
      expect(standardIds).not.toContain(selectLootPart(() => index / 40));
    }
  });
});

describe('normalizePartMap', () => {
  it('maps the AC-33 legacy parts fixture to v2 ids', () => {
    expect(
      normalizePartMap({ 'wings-silver': 2, 'engine-blue': 1, 'body-gold': 1 }),
    ).toEqual({
      'hull-gold': 1,
      'wing-left-silver': 2,
      'wing-right-silver': 2,
      'ignition-left-blue': 1,
      'ignition-right-blue': 1,
    });
  });

  it('retains v2 ids and legacy nose/cockpit ids', () => {
    expect(
      normalizePartMap({
        'nose-crimson': 2,
        'cockpit-amber': 1,
        'hull-obsidian': 3,
        'tail-fin-comet': 4,
      }),
    ).toEqual({
      'hull-obsidian': 3,
      'nose-crimson': 2,
      'cockpit-amber': 1,
      'tail-fin-comet': 4,
    });
  });

  it('expands legacy default parts to both target slots', () => {
    expect(normalizePartMap({ 'wings-default': 1, 'engine-default': 2 })).toEqual({
      'wing-left-default': 1,
      'wing-right-default': 1,
      'ignition-left-default': 2,
      'ignition-right-default': 2,
    });
  });

  it('sums collisions between legacy and v2 keys', () => {
    expect(
      normalizePartMap({
        'wings-silver': 2,
        'wing-left-silver': 1,
        'body-gold': 1,
        'hull-gold': 3,
      }),
    ).toEqual({
      'hull-gold': 4,
      'wing-left-silver': 3,
      'wing-right-silver': 2,
    });
  });

  it('drops unknown ids and invalid counts', () => {
    const invalid = {
      'hull-gold': -1,
      'nose-crimson': 1.5,
      'cockpit-amber': Number.NaN,
      'wing-left-silver': Number.POSITIVE_INFINITY,
      'wing-right-silver': 2_147_483_648,
      'engine-blue': '2',
      'body-blue': 1,
      'BODY-GOLD': 1,
      '': 1,
    } as unknown as Record<string, number>;
    expect(normalizePartMap(invalid)).toEqual({});
  });

  it('retains zero counts, mirroring the migration bound', () => {
    expect(normalizePartMap({ 'hull-default': 0, 'engine-blue': 0 })).toEqual({
      'hull-default': 0,
      'ignition-left-blue': 0,
      'ignition-right-blue': 0,
    });
  });

  it('is idempotent', () => {
    const once = normalizePartMap({ 'wings-silver': 2, 'engine-blue': 1, 'body-gold': 1 });
    expect(normalizePartMap(once)).toEqual(once);
  });
});

describe('normalizeAppearance', () => {
  it('maps the AC-33 legacy appearance fixture to v2 slots', () => {
    expect(
      normalizeAppearance({ wings: 'wings-silver', engine: 'engine-blue', body: 'body-gold' }),
    ).toEqual({
      hull: 'hull-gold',
      'wing-left': 'wing-left-silver',
      'wing-right': 'wing-right-silver',
      'ignition-left': 'ignition-left-blue',
      'ignition-right': 'ignition-right-blue',
    });
  });

  it('retains canonical v2 slot keys and values', () => {
    expect(
      normalizeAppearance({
        nose: 'nose-crimson',
        cockpit: 'cockpit-amber',
        'wing-left': 'wing-left-gold',
        'tail-fin': 'tail-fin-comet',
      }),
    ).toEqual({
      nose: 'nose-crimson',
      cockpit: 'cockpit-amber',
      'wing-left': 'wing-left-gold',
      'tail-fin': 'tail-fin-comet',
    });
  });

  it('accepts a legacy alias carrying an already-v2 value', () => {
    expect(normalizeAppearance({ body: 'hull-gold' })).toEqual({ hull: 'hull-gold' });
  });

  it('lets canonical slot keys win over legacy aliases', () => {
    expect(
      normalizeAppearance({ wings: 'wings-silver', 'wing-left': 'wing-left-gold' }),
    ).toEqual({
      'wing-left': 'wing-left-gold',
      'wing-right': 'wing-right-silver',
    });
  });

  it('drops unknown keys, unknown ids, mismatches and non-string values', () => {
    const invalid = {
      hull: 'wing-left-silver',
      'wing-left': 'wing-right-silver',
      wings: 'hull-gold',
      body: 'body-unknown',
      'tail-fin': '',
      nope: 'wings-silver',
      nose: 42,
      engine: 42,
    } as unknown as Record<string, string>;
    expect(normalizeAppearance(invalid)).toEqual({});
  });

  it('is idempotent', () => {
    const once = normalizeAppearance({
      wings: 'wings-silver',
      engine: 'engine-blue',
      body: 'body-gold',
      nose: 'nose-crimson',
      cockpit: 'cockpit-amber',
    });
    expect(normalizeAppearance(once)).toEqual(once);
  });
});

describe('normalizeCustomizationState', () => {
  it('normalizes the AC-33 full state and preserves counts', () => {
    const state: CustomizationState = {
      lootboxes: 2,
      keys: 1,
      parts: { 'wings-silver': 2, 'engine-blue': 1, 'body-gold': 1 },
      appearance: { wings: 'wings-silver', engine: 'engine-blue', body: 'body-gold' },
    };
    expect(normalizeCustomizationState(state)).toEqual({
      lootboxes: 2,
      keys: 1,
      parts: {
        'hull-gold': 1,
        'wing-left-silver': 2,
        'wing-right-silver': 2,
        'ignition-left-blue': 1,
        'ignition-right-blue': 1,
      },
      appearance: {
        hull: 'hull-gold',
        'wing-left': 'wing-left-silver',
        'wing-right': 'wing-right-silver',
        'ignition-left': 'ignition-left-blue',
        'ignition-right': 'ignition-right-blue',
      },
    });
  });

  it('returns a defensive copy', () => {
    const source: CustomizationState = {
      lootboxes: 3,
      keys: 4,
      parts: { 'hull-gold': 1 },
      appearance: { hull: 'hull-gold' },
    };
    const normalized = normalizeCustomizationState(source);
    source.parts['hull-gold'] = 99;
    source.appearance.hull = 'hull-default';
    expect(normalized.parts).toEqual({ 'hull-gold': 1 });
    expect(normalized.appearance).toEqual({ hull: 'hull-gold' });
  });

  it('leaves an already-v2 state unchanged', () => {
    const state: CustomizationState = {
      lootboxes: 0,
      keys: 0,
      parts: { 'wing-left-default': 1, 'wing-right-default': 1 },
      appearance: { 'wing-left': 'wing-left-default', 'wing-right': 'wing-right-default' },
    };
    expect(normalizeCustomizationState(state)).toEqual(state);
  });
});
