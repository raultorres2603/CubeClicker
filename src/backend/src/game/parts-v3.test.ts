import { describe, expect, it } from 'vitest';

import { PART_CATALOG_V2, type CustomizationState } from './parts-v2.js';

import {
  CATALOG_ROW_COUNT,
  CATALOG_ROWS_HASH,
  FINISH_CATALOG,
  FORM_CATALOG,
  LOOTABLE_ROW_COUNT,
  PART_CATALOG_V3,
  PART_CATALOG_VERSION,
  SLOT_CATALOG_V3,
  SLOT_NOUN,
  catalogForSlot,
  catalogForSlotForm,
  computeCatalogRowsHash,
  defaultPartForSlotV3,
  isValidPartIdV3,
  isValidSlotIdV3,
  normalizeAppearanceV3,
  normalizeCustomizationStateV3,
  normalizePartMapV3,
  partDefinitionV3,
  selectLootPartV3,
  shotStyleForPart,
  type FinishDef,
  type FormDef,
  type PartDefV3,
  type SlotDefV3,
  type SlotIdV3,
} from './parts-v3.js';

/** The pinned spec table: eleven slots, exact order and display names. */
const EXPECTED_SLOTS: readonly SlotDefV3[] = [
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
  { id: 'shot', name: 'Shot' },
];

const EXPECTED_SLOT_NOUN: Readonly<Record<SlotIdV3, string>> = {
  hull: 'Hull',
  nose: 'Nose',
  cockpit: 'Canopy',
  'wing-left': 'Port Wing',
  'wing-right': 'Starboard Wing',
  'engine-left': 'Port Engine',
  'engine-right': 'Starboard Engine',
  'ignition-left': 'Port Flame',
  'ignition-right': 'Starboard Flame',
  'tail-fin': 'Tail Fin',
  shot: 'Bolt',
};

const EXPECTED_FORMS: readonly FormDef[] = [
  { id: 'classic', label: 'Classic', recipe: null },
  {
    id: 'dart',
    label: 'Dart',
    recipe: {
      lengthScale: 1.15,
      widthScale: 0.85,
      sweepDeg: 18,
      thicknessScale: 0.9,
      offsetZ: 0.02,
      chassis: [0.95, 0.9, 1.25],
      shot: { geometry: 'bolt', scale: 1, muzzle: 'spark' },
    },
  },
  {
    id: 'lance',
    label: 'Lance',
    recipe: {
      lengthScale: 1.3,
      widthScale: 0.8,
      sweepDeg: 12,
      thicknessScale: 0.95,
      offsetZ: 0.04,
      chassis: [0.9, 0.85, 1.35],
      shot: { geometry: 'bolt', scale: 1.25, muzzle: 'spark' },
    },
  },
  {
    id: 'needle',
    label: 'Needle',
    recipe: {
      lengthScale: 1.25,
      widthScale: 0.7,
      sweepDeg: 8,
      thicknessScale: 0.8,
      offsetZ: 0.05,
      chassis: [0.8, 0.8, 1.4],
      shot: { geometry: 'bolt', scale: 0.85, muzzle: 'spark' },
    },
  },
  {
    id: 'manta',
    label: 'Manta',
    recipe: {
      lengthScale: 1.0,
      widthScale: 1.25,
      sweepDeg: 32,
      thicknessScale: 0.85,
      offsetZ: 0,
      chassis: [1.2, 0.85, 1.0],
      shot: { geometry: 'wave', scale: 1.15, muzzle: 'petal' },
    },
  },
  {
    id: 'hauler',
    label: 'Hauler',
    recipe: {
      lengthScale: 0.9,
      widthScale: 1.15,
      sweepDeg: 6,
      thicknessScale: 1.2,
      offsetZ: -0.02,
      chassis: [1.15, 1.1, 0.85],
      shot: { geometry: 'orb', scale: 1.1, muzzle: 'ring' },
    },
  },
  {
    id: 'bulwark',
    label: 'Bulwark',
    recipe: {
      lengthScale: 0.95,
      widthScale: 1.1,
      sweepDeg: 10,
      thicknessScale: 1.3,
      offsetZ: -0.03,
      chassis: [1.1, 1.15, 0.9],
      shot: { geometry: 'orb', scale: 1.2, muzzle: 'ring' },
    },
  },
  {
    id: 'arrow',
    label: 'Arrow',
    recipe: {
      lengthScale: 1.1,
      widthScale: 0.95,
      sweepDeg: 24,
      thicknessScale: 0.9,
      offsetZ: 0.01,
      chassis: [0.95, 0.95, 1.2],
      shot: { geometry: 'shard', scale: 1, muzzle: 'petal' },
    },
  },
  {
    id: 'orca',
    label: 'Orca',
    recipe: {
      lengthScale: 1.05,
      widthScale: 1.2,
      sweepDeg: 14,
      thicknessScale: 1.0,
      offsetZ: 0,
      chassis: [1.1, 1.0, 1.05],
      shot: { geometry: 'wave', scale: 1.2, muzzle: 'petal' },
    },
  },
  {
    id: 'talon',
    label: 'Talon',
    recipe: {
      lengthScale: 1.0,
      widthScale: 1.0,
      sweepDeg: 28,
      thicknessScale: 0.85,
      offsetZ: 0.03,
      chassis: [1.0, 0.9, 1.1],
      shot: { geometry: 'shard', scale: 1.05, muzzle: 'spark' },
    },
  },
  {
    id: 'kite',
    label: 'Kite',
    recipe: {
      lengthScale: 1.1,
      widthScale: 1.05,
      sweepDeg: 38,
      thicknessScale: 0.9,
      offsetZ: 0,
      chassis: [1.05, 1.0, 1.1],
      shot: { geometry: 'orb', scale: 0.95, muzzle: 'ring' },
    },
  },
];

const EXPECTED_FINISHES: readonly FinishDef[] = [
  { id: 'chrome', label: 'Chrome', color: '#c9d4e2', accent: '#ffffff', rarity: 'rare' },
  { id: 'azure', label: 'Azure', color: '#2f6fd6', accent: '#7cf6ff', rarity: 'rare' },
  { id: 'ember', label: 'Ember', color: '#c2410c', accent: '#ffb35c', rarity: 'rare' },
  { id: 'jade', label: 'Jade', color: '#15803d', accent: '#86efac', rarity: 'rare' },
  { id: 'steel', label: 'Steel', color: '#64748b', accent: '#cbd5e1', rarity: 'rare' },
  { id: 'ivory', label: 'Ivory', color: '#e7e5e4', accent: '#fafaf9', rarity: 'rare' },
  { id: 'abyss', label: 'Abyss', color: '#0f172a', accent: '#38bdf8', rarity: 'epic' },
  { id: 'aurum', label: 'Aurum', color: '#ccaa44', accent: '#fff3d6', rarity: 'epic' },
  { id: 'violet', label: 'Violet', color: '#6d28d9', accent: '#c4b5fd', rarity: 'epic' },
  { id: 'crimson', label: 'Crimson', color: '#9f1239', accent: '#fb7185', rarity: 'epic' },
  { id: 'plasma', label: 'Plasma', color: '#a855f7', accent: '#f0abfc', rarity: 'epic' },
  { id: 'solar', label: 'Solar', color: '#f59e0b', accent: '#fef3c7', rarity: 'epic' },
];

const GENERATED_FORMS = EXPECTED_FORMS.filter((form) => form.recipe !== null);

describe('catalog constants', () => {
  it('pins PART_CATALOG_VERSION to 3', () => {
    expect(PART_CATALOG_VERSION).toBe(3);
  });

  it('pins exactly eleven slots in order with display names', () => {
    expect(SLOT_CATALOG_V3).toEqual(EXPECTED_SLOTS);
    expect(SLOT_CATALOG_V3).toHaveLength(11);
  });

  it('pins SLOT_NOUN for every slot', () => {
    expect(SLOT_NOUN).toEqual(EXPECTED_SLOT_NOUN);
  });

  it('pins exactly eleven forms in order with their recipes', () => {
    expect(FORM_CATALOG).toEqual(EXPECTED_FORMS);
    expect(FORM_CATALOG).toHaveLength(11);
  });

  it('pins exactly twelve finishes in order, six rare and six epic', () => {
    expect(FINISH_CATALOG).toEqual(EXPECTED_FINISHES);
    expect(FINISH_CATALOG).toHaveLength(12);
    expect(FINISH_CATALOG.map((finish) => finish.rarity)).toEqual([
      'rare',
      'rare',
      'rare',
      'rare',
      'rare',
      'rare',
      'epic',
      'epic',
      'epic',
      'epic',
      'epic',
      'epic',
    ]);
  });

  it('pins the row counts: 1,351 rows and 1,340 lootable', () => {
    expect(CATALOG_ROW_COUNT).toBe(1351);
    expect(LOOTABLE_ROW_COUNT).toBe(1340);
    expect(PART_CATALOG_V3).toHaveLength(1351);
    expect(PART_CATALOG_V3.filter((part) => part.rarity !== 'standard')).toHaveLength(1340);
  });

  it('has exactly 123 rows per ship slot and 121 for shot', () => {
    const counts: Record<string, number> = {};
    for (const part of PART_CATALOG_V3) {
      counts[part.slot] = (counts[part.slot] ?? 0) + 1;
    }
    expect(counts).toEqual({
      hull: 123,
      nose: 123,
      cockpit: 123,
      'wing-left': 123,
      'wing-right': 123,
      'engine-left': 123,
      'engine-right': 123,
      'ignition-left': 123,
      'ignition-right': 123,
      'tail-fin': 123,
      shot: 121,
    });
  });

  it('has exactly 11 standard, 670 rare and 670 epic rows', () => {
    const rarities: Record<string, number> = { standard: 0, rare: 0, epic: 0 };
    for (const part of PART_CATALOG_V3) {
      rarities[part.rarity] = (rarities[part.rarity] ?? 0) + 1;
    }
    expect(rarities).toEqual({ standard: 11, rare: 670, epic: 670 });

    const standardIds = PART_CATALOG_V3.filter((part) => part.rarity === 'standard').map(
      (part) => part.id,
    );
    expect(standardIds).toEqual([
      'hull-default',
      'nose-default',
      'cockpit-default',
      'wing-left-default',
      'wing-right-default',
      'engine-left-default',
      'engine-right-default',
      'ignition-left-default',
      'ignition-right-default',
      'tail-fin-default',
      'shot-default',
    ]);
  });

  it('groups every slot in SLOT_CATALOG_V3 order', () => {
    const slotSequence: SlotIdV3[] = [];
    for (const part of PART_CATALOG_V3) {
      if (slotSequence[slotSequence.length - 1] !== part.slot) {
        slotSequence.push(part.slot);
      }
    }
    expect(slotSequence).toEqual(EXPECTED_SLOTS.map((slot) => slot.id));
  });

  it('places the classic rows first in every slot, then forms × finishes', () => {
    for (const slot of EXPECTED_SLOTS) {
      const rows = catalogForSlot(slot.id);
      const classicRows = rows.filter((part) => part.form === 'classic');
      expect(rows.slice(0, classicRows.length)).toEqual(classicRows);
      expect(classicRows).toHaveLength(slot.id === 'shot' ? 1 : 3);

      const expectedGeneratedForms = GENERATED_FORMS.flatMap((form) =>
        EXPECTED_FINISHES.map(() => form.id),
      );
      expect(rows.slice(classicRows.length).map((part) => part.form)).toEqual(
        expectedGeneratedForms,
      );
      expect(rows.slice(classicRows.length).map((part) => part.finish)).toEqual(
        GENERATED_FORMS.flatMap(() => EXPECTED_FINISHES.map((finish) => finish.id)),
      );
    }
  });
});

describe('deterministic ids, names and grid shape', () => {
  it('makes all 1,351 ids unique and never longer than 40 characters', () => {
    const ids = PART_CATALOG_V3.map((part) => part.id);
    expect(new Set(ids).size).toBe(1351);
    expect(Math.max(...ids.map((id) => id.length))).toBe(30);
    expect(ids.filter((id) => id.length === 30)).toEqual(['ignition-right-bulwark-crimson']);
    expect(ids.filter((id) => id.length > 40)).toEqual([]);
  });

  it('makes all 1,351 names unique', () => {
    const names = PART_CATALOG_V3.map((part) => part.name);
    expect(new Set(names).size).toBe(1351);
  });

  it('builds every generated row as slot-form-finish with the pinned name and finish data', () => {
    const generated = PART_CATALOG_V3.filter((part) => part.form !== 'classic');
    expect(generated).toHaveLength(1320);

    for (const part of generated) {
      const form = EXPECTED_FORMS.find((entry) => entry.id === part.form);
      const finish = EXPECTED_FINISHES.find((entry) => entry.id === part.finish);
      if (form === undefined || finish === undefined) {
        throw new Error(`unexpected form/finish: ${part.form}/${part.finish}`);
      }
      expect(part.id).toBe(`${part.slot}-${form.id}-${finish.id}`);
      expect(part.name).toBe(`${finish.label} ${form.label} ${EXPECTED_SLOT_NOUN[part.slot]}`);
      expect(part.rarity).toBe(finish.rarity);
      expect(part.color).toBe(finish.color);
      expect(part.accent).toBe(finish.accent);
      expect(part.shape).toBe(form.id);
    }
  });

  it('keeps every form in FORM_CATALOG and every classic shape in the v2 table', () => {
    const formIds = new Set(EXPECTED_FORMS.map((form) => form.id));
    const v2Shapes = new Set([
      'standard',
      'armored',
      'solar',
      'lance',
      'photon',
      'razor',
      'oracle',
      'boxed',
      'nova',
      'ion',
      'plasma',
      'split',
      'comet',
    ]);
    for (const part of PART_CATALOG_V3) {
      expect(formIds.has(part.form)).toBe(true);
      if (part.form === 'classic') {
        expect(v2Shapes.has(part.shape)).toBe(true);
      }
    }
  });

  it('pins the hull-dart-chrome row verbatim', () => {
    expect(partDefinitionV3('hull-dart-chrome')).toEqual({
      id: 'hull-dart-chrome',
      slot: 'hull',
      name: 'Chrome Dart Hull',
      rarity: 'rare',
      color: '#c9d4e2',
      accent: '#ffffff',
      form: 'dart',
      finish: 'chrome',
      shape: 'dart',
    });
  });

  it('pins the shot-default row verbatim', () => {
    expect(partDefinitionV3('shot-default')).toEqual({
      id: 'shot-default',
      slot: 'shot',
      name: 'Standard Bolt',
      rarity: 'standard',
      color: '#fff1c8',
      accent: '#ffd27a',
      form: 'classic',
      finish: 'classic',
      shape: 'standard',
    });
  });

  it('returns three classic rows per ship slot and one for shot', () => {
    for (const slot of EXPECTED_SLOTS) {
      const rows = catalogForSlotForm(slot.id, 'classic');
      expect(rows).toHaveLength(slot.id === 'shot' ? 1 : 3);
      expect(rows.every((part) => part.form === 'classic')).toBe(true);
      expect(rows.every((part) => part.finish === 'classic')).toBe(true);
    }
    expect(catalogForSlotForm('hull', 'classic').map((part) => part.id)).toEqual([
      'hull-default',
      'hull-obsidian',
      'hull-gold',
    ]);
    expect(catalogForSlotForm('shot', 'classic').map((part) => part.id)).toEqual([
      'shot-default',
    ]);
  });

  it('returns exactly twelve rows per slot/form pair in finish order', () => {
    for (const slot of EXPECTED_SLOTS) {
      for (const form of GENERATED_FORMS) {
        const rows = catalogForSlotForm(slot.id, form.id);
        expect(rows).toHaveLength(12);
        expect(rows.map((part) => part.id)).toEqual(
          EXPECTED_FINISHES.map((finish) => `${slot.id}-${form.id}-${finish.id}`),
        );
        expect(rows.map((part) => part.finish)).toEqual(
          EXPECTED_FINISHES.map((finish) => finish.id),
        );
        expect(rows[0]!.name).toBe(
          `${EXPECTED_FINISHES[0]!.label} ${form.label} ${EXPECTED_SLOT_NOUN[slot.id]}`,
        );
        expect(rows[11]!.name).toBe(
          `${EXPECTED_FINISHES[11]!.label} ${form.label} ${EXPECTED_SLOT_NOUN[slot.id]}`,
        );
      }
    }
  });

  it('returns every slot row through catalogForSlot', () => {
    for (const slot of EXPECTED_SLOTS) {
      expect(catalogForSlot(slot.id)).toEqual(
        PART_CATALOG_V3.filter((part) => part.slot === slot.id),
      );
    }
    expect(catalogForSlot('shot')[0]!.id).toBe('shot-default');
    expect(catalogForSlot('shot')[120]!.id).toBe('shot-kite-solar');
    expect(PART_CATALOG_V3[1350]!.id).toBe('shot-kite-solar');
  });
});

describe('v2 rows preserved verbatim', () => {
  it('keeps the 30 v2 rows with identical fields in v2 order as the classic subset', () => {
    const expectedClassic: readonly PartDefV3[] = PART_CATALOG_V2.map((row) => ({
      ...row,
      form: 'classic' as const,
      finish: 'classic' as const,
    }));
    const classicRows = PART_CATALOG_V3.filter(
      (part) => part.form === 'classic' && part.slot !== 'shot',
    );
    expect(classicRows).toEqual(expectedClassic);
    expect(classicRows).toHaveLength(30);
  });
});

describe('isValidSlotIdV3', () => {
  it('accepts every pinned slot id', () => {
    for (const slot of EXPECTED_SLOTS) {
      expect(isValidSlotIdV3(slot.id)).toBe(true);
    }
  });

  it('rejects legacy categories, empty strings and case variants', () => {
    expect(isValidSlotIdV3('wings')).toBe(false);
    expect(isValidSlotIdV3('engine')).toBe(false);
    expect(isValidSlotIdV3('body')).toBe(false);
    expect(isValidSlotIdV3('')).toBe(false);
    expect(isValidSlotIdV3('Hull')).toBe(false);
    expect(isValidSlotIdV3('shot ')).toBe(false);
  });
});

describe('isValidPartIdV3', () => {
  it('accepts every generated, classic and shot id', () => {
    for (const part of PART_CATALOG_V3) {
      expect(isValidPartIdV3(part.id)).toBe(true);
    }
  });

  it('rejects legacy ids, empty strings, partial ids and case variants', () => {
    expect(isValidPartIdV3('body-gold')).toBe(false);
    expect(isValidPartIdV3('wings-silver')).toBe(false);
    expect(isValidPartIdV3('engine-blue')).toBe(false);
    expect(isValidPartIdV3('')).toBe(false);
    expect(isValidPartIdV3('HULL-GOLD')).toBe(false);
    expect(isValidPartIdV3('hull')).toBe(false);
    expect(isValidPartIdV3('hull-dart')).toBe(false);
    expect(isValidPartIdV3('hull-dart-chrome ')).toBe(false);
  });
});

describe('partDefinitionV3', () => {
  it('returns the exact definition for a classic row', () => {
    expect(partDefinitionV3('hull-obsidian')).toEqual({
      id: 'hull-obsidian',
      slot: 'hull',
      name: 'Obsidian Hull',
      rarity: 'rare',
      color: '#1a2333',
      accent: '#3b82f6',
      form: 'classic',
      finish: 'classic',
      shape: 'armored',
    });
  });

  it('returns the exact definition for a generated row', () => {
    expect(partDefinitionV3('shot-kite-solar')).toEqual({
      id: 'shot-kite-solar',
      slot: 'shot',
      name: 'Solar Kite Bolt',
      rarity: 'epic',
      color: '#f59e0b',
      accent: '#fef3c7',
      form: 'kite',
      finish: 'solar',
      shape: 'kite',
    });
  });

  it('throws unknown part for an unknown or legacy id', () => {
    expect(() => partDefinitionV3('nope')).toThrow('unknown part: nope');
    expect(() => partDefinitionV3('body-gold')).toThrow('unknown part: body-gold');
  });
});

describe('defaultPartForSlotV3', () => {
  it('returns the standard id for every slot', () => {
    const defaults: Record<string, string> = {};
    for (const slot of EXPECTED_SLOTS) {
      defaults[slot.id] = defaultPartForSlotV3(slot.id);
    }
    expect(defaults).toEqual({
      hull: 'hull-default',
      nose: 'nose-default',
      cockpit: 'cockpit-default',
      'wing-left': 'wing-left-default',
      'wing-right': 'wing-right-default',
      'engine-left': 'engine-left-default',
      'engine-right': 'engine-right-default',
      'ignition-left': 'ignition-left-default',
      'ignition-right': 'ignition-right-default',
      'tail-fin': 'tail-fin-default',
      shot: 'shot-default',
    });
  });

  it('throws unknown slot when no standard part can be resolved', () => {
    expect(() => defaultPartForSlotV3('wings' as SlotIdV3)).toThrow('unknown slot: wings');
  });
});

describe('CATALOG_ROWS_HASH', () => {
  it('pins the FNV-1a mirror literal', () => {
    expect(CATALOG_ROWS_HASH).toBe('4a8df5e0');
  });

  it('computes the pinned row string with FNV-1a 32-bit', () => {
    expect(computeCatalogRowsHash([])).toBe('811c9dc5');
    const synthetic: PartDefV3 = {
      id: 'a',
      slot: 'hull',
      name: 'b',
      rarity: 'rare',
      color: 'c',
      accent: 'd',
      form: 'classic',
      finish: 'classic',
      shape: 'standard',
    };
    expect(computeCatalogRowsHash([synthetic])).toBe('7b95907e');
  });
});

describe('selectLootPartV3', () => {
  it('consumes exactly one rng draw', () => {
    let draws = 0;
    const selected = selectLootPartV3(() => {
      draws += 1;
      return 0.5;
    });
    expect(draws).toBe(1);
    expect(selected).toBe('engine-left-hauler-violet');
  });

  it('selects the first lootable row at rng 0', () => {
    expect(selectLootPartV3(() => 0)).toBe('hull-obsidian');
  });

  it('selects the last lootable row at 0.999999 and clamps values >= 1', () => {
    expect(selectLootPartV3(() => 0.999999)).toBe('shot-kite-solar');
    expect(selectLootPartV3(() => 1)).toBe('shot-kite-solar');
    expect(selectLootPartV3(() => 2)).toBe('shot-kite-solar');
    expect(selectLootPartV3(() => Number.POSITIVE_INFINITY)).toBe('shot-kite-solar');
  });

  it('maps NaN and negative values to the first lootable row', () => {
    expect(selectLootPartV3(() => Number.NaN)).toBe('hull-obsidian');
    expect(selectLootPartV3(() => -0.5)).toBe('hull-obsidian');
    expect(selectLootPartV3(() => Number.NEGATIVE_INFINITY)).toBe('hull-obsidian');
  });

  it('places the first rare/epic boundary at the 3/2680 weight fraction', () => {
    expect(selectLootPartV3(() => 0.001)).toBe('hull-obsidian');
    expect(selectLootPartV3(() => 0.00112)).toBe('hull-gold');
  });

  it('walks all 1,340 lootable rows with weights rare 3 / epic 1', () => {
    const counts = new Map<string, number>();
    for (let index = 0; index < 2680; index += 1) {
      const partId = selectLootPartV3(() => (index + 0.5) / 2680);
      counts.set(partId, (counts.get(partId) ?? 0) + 1);
    }

    expect(counts.size).toBe(1340);
    for (const part of PART_CATALOG_V3) {
      if (part.rarity === 'standard') {
        expect(counts.get(part.id)).toBeUndefined();
      } else {
        expect(counts.get(part.id)).toBe(part.rarity === 'rare' ? 3 : 1);
      }
    }

    let rareSelections = 0;
    let epicSelections = 0;
    for (const part of PART_CATALOG_V3) {
      if (part.rarity === 'rare') {
        rareSelections += counts.get(part.id) ?? 0;
      } else if (part.rarity === 'epic') {
        epicSelections += counts.get(part.id) ?? 0;
      }
    }
    expect(rareSelections).toBe(2010);
    expect(epicSelections).toBe(670);
    expect(rareSelections / 2680).toBe(0.75);
  });

  it('returns different parts for the successive draws of a seeded sequence', () => {
    let state = 42;
    const rng = (): number => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
    expect(selectLootPartV3(rng)).toBe('cockpit-orca-ivory');
    expect(selectLootPartV3(rng)).toBe('hull-kite-ivory');
  });
});

describe('shotStyleForPart', () => {
  it('pins the classic shot-default style', () => {
    expect(shotStyleForPart('shot-default')).toEqual({
      partId: 'shot-default',
      geometry: 'bolt',
      scale: 1,
      muzzle: 'spark',
      color: '#fff1c8',
      accent: '#ffd27a',
    });
  });

  it('resolves a generated shot row through its form and finish', () => {
    expect(shotStyleForPart('shot-kite-solar')).toEqual({
      partId: 'shot-kite-solar',
      geometry: 'orb',
      scale: 0.95,
      muzzle: 'ring',
      color: '#f59e0b',
      accent: '#fef3c7',
    });
    expect(shotStyleForPart('shot-dart-chrome')).toEqual({
      partId: 'shot-dart-chrome',
      geometry: 'bolt',
      scale: 1,
      muzzle: 'spark',
      color: '#c9d4e2',
      accent: '#ffffff',
    });
    expect(shotStyleForPart('shot-manta-abyss')).toEqual({
      partId: 'shot-manta-abyss',
      geometry: 'wave',
      scale: 1.15,
      muzzle: 'petal',
      color: '#0f172a',
      accent: '#38bdf8',
    });
  });

  it('uses every generated form shot profile for a shot row', () => {
    for (const form of GENERATED_FORMS) {
      if (form.recipe === null) {
        continue;
      }
      const style = shotStyleForPart(`shot-${form.id}-chrome`);
      expect(style.geometry).toBe(form.recipe.shot.geometry);
      expect(style.scale).toBe(form.recipe.shot.scale);
      expect(style.muzzle).toBe(form.recipe.shot.muzzle);
      expect(style.color).toBe('#c9d4e2');
      expect(style.accent).toBe('#ffffff');
    }
  });

  it('falls back to shot-default for any non-shot part', () => {
    expect(shotStyleForPart('hull-dart-chrome')).toEqual({
      partId: 'shot-default',
      geometry: 'bolt',
      scale: 1,
      muzzle: 'spark',
      color: '#fff1c8',
      accent: '#ffd27a',
    });
    expect(shotStyleForPart('tail-fin-comet')).toEqual({
      partId: 'shot-default',
      geometry: 'bolt',
      scale: 1,
      muzzle: 'spark',
      color: '#fff1c8',
      accent: '#ffd27a',
    });
  });

  it('throws unknown part for an unknown id', () => {
    expect(() => shotStyleForPart('nope')).toThrow('unknown part: nope');
  });
});

describe('normalizePartMapV3', () => {
  it('maps the legacy v1 parts fixture to v3 ids', () => {
    expect(
      normalizePartMapV3({ 'wings-silver': 2, 'engine-blue': 1, 'body-gold': 1 }),
    ).toEqual({
      'hull-gold': 1,
      'wing-left-silver': 2,
      'wing-right-silver': 2,
      'ignition-left-blue': 1,
      'ignition-right-blue': 1,
    });
  });

  it('retains v2 and generated v3 ids', () => {
    expect(
      normalizePartMapV3({
        'hull-dart-chrome': 2,
        'shot-kite-solar': 1,
        'nose-crimson': 3,
        'tail-fin-comet': 4,
      }),
    ).toEqual({
      'hull-dart-chrome': 2,
      'nose-crimson': 3,
      'tail-fin-comet': 4,
      'shot-kite-solar': 1,
    });
  });

  it('expands legacy default parts to both target slots', () => {
    expect(normalizePartMapV3({ 'wings-default': 1, 'engine-default': 2 })).toEqual({
      'wing-left-default': 1,
      'wing-right-default': 1,
      'ignition-left-default': 2,
      'ignition-right-default': 2,
    });
  });

  it('sums collisions between legacy and canonical keys', () => {
    expect(
      normalizePartMapV3({
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

  it('emits keys in catalog order', () => {
    const normalized = normalizePartMapV3({
      'shot-kite-solar': 1,
      'hull-dart-chrome': 1,
      'hull-default': 1,
    });
    expect(Object.keys(normalized)).toEqual([
      'hull-default',
      'hull-dart-chrome',
      'shot-kite-solar',
    ]);
  });

  it('drops unknown ids and invalid counts', () => {
    const invalid = {
      'hull-dart-chrome': -1,
      'nose-crimson': 1.5,
      'cockpit-amber': Number.NaN,
      'wing-left-silver': Number.POSITIVE_INFINITY,
      'wing-right-silver': 2_147_483_648,
      'engine-blue': '2',
      'body-blue': 1,
      'BODY-GOLD': 1,
      'hull-unknown': 1,
      '': 1,
    } as unknown as Record<string, number>;
    expect(normalizePartMapV3(invalid)).toEqual({});
  });

  it('retains zero counts, mirroring the migration bound', () => {
    expect(normalizePartMapV3({ 'hull-default': 0, 'shot-kite-solar': 0 })).toEqual({
      'hull-default': 0,
      'shot-kite-solar': 0,
    });
  });

  it('is idempotent', () => {
    const once = normalizePartMapV3({
      'wings-silver': 2,
      'engine-blue': 1,
      'body-gold': 1,
      'shot-kite-solar': 3,
    });
    expect(normalizePartMapV3(once)).toEqual(once);
  });
});

describe('normalizeAppearanceV3', () => {
  it('maps the legacy v1 appearance fixture to v3 slots', () => {
    expect(
      normalizeAppearanceV3({ wings: 'wings-silver', engine: 'engine-blue', body: 'body-gold' }),
    ).toEqual({
      hull: 'hull-gold',
      'wing-left': 'wing-left-silver',
      'wing-right': 'wing-right-silver',
      'ignition-left': 'ignition-left-blue',
      'ignition-right': 'ignition-right-blue',
    });
  });

  it('retains every canonical v2 id', () => {
    const appearance = {
      hull: 'hull-obsidian',
      nose: 'nose-crimson',
      cockpit: 'cockpit-amber',
      'wing-left': 'wing-left-gold',
      'wing-right': 'wing-right-silver',
      'engine-left': 'engine-left-nova',
      'engine-right': 'engine-right-vector',
      'ignition-left': 'ignition-left-plasma',
      'ignition-right': 'ignition-right-blue',
      'tail-fin': 'tail-fin-comet',
    };
    expect(normalizeAppearanceV3(appearance)).toEqual(appearance);
  });

  it('keeps v3 generated ids and the shot slot', () => {
    const appearance = {
      hull: 'hull-dart-chrome',
      'ignition-right': 'ignition-right-bulwark-crimson',
      shot: 'shot-kite-solar',
    };
    expect(normalizeAppearanceV3(appearance)).toEqual(appearance);
  });

  it('supports a full eleven-entry v3 appearance', () => {
    const appearance = {
      hull: 'hull-orca-aurum',
      nose: 'nose-needle-jade',
      cockpit: 'cockpit-arrow-violet',
      'wing-left': 'wing-left-manta-crimson',
      'wing-right': 'wing-right-talon-plasma',
      'engine-left': 'engine-left-hauler-solar',
      'engine-right': 'engine-right-bulwark-abyss',
      'ignition-left': 'ignition-left-lance-ember',
      'ignition-right': 'ignition-right-dart-steel',
      'tail-fin': 'tail-fin-kite-ivory',
      shot: 'shot-orca-violet',
    };
    const normalized = normalizeAppearanceV3(appearance);
    expect(normalized).toEqual(appearance);
    expect(Object.keys(normalized)).toEqual(EXPECTED_SLOTS.map((slot) => slot.id));
  });

  it('drops wrong-slot ids, unknown ids and non-string values', () => {
    const invalid = {
      hull: 'wing-left-gold',
      'wing-left': 'wing-right-silver',
      shot: 'hull-dart-chrome',
      wings: 'hull-gold',
      body: 'body-unknown',
      'tail-fin': '',
      nope: 'wings-silver',
      nose: 42,
      engine: 42,
      'cockpit': 'cockpit-unknown',
    } as unknown as Record<string, string>;
    expect(normalizeAppearanceV3(invalid)).toEqual({});
  });

  it('lets canonical slot keys win over legacy aliases', () => {
    expect(
      normalizeAppearanceV3({ wings: 'wings-silver', 'wing-left': 'wing-left-gold' }),
    ).toEqual({
      'wing-left': 'wing-left-gold',
      'wing-right': 'wing-right-silver',
    });
  });

  it('accepts a legacy alias carrying an already-v3 value', () => {
    expect(normalizeAppearanceV3({ body: 'hull-dart-chrome' })).toEqual({
      hull: 'hull-dart-chrome',
    });
    expect(normalizeAppearanceV3({ wings: 'wing-left-gold' })).toEqual({
      'wing-left': 'wing-left-gold',
    });
  });

  it('emits keys in SLOT_CATALOG_V3 order regardless of insertion order', () => {
    const normalized = normalizeAppearanceV3({
      shot: 'shot-kite-solar',
      'tail-fin': 'tail-fin-comet',
      'ignition-left': 'ignition-left-plasma',
      'engine-left': 'engine-left-nova',
      'wing-left': 'wing-left-gold',
      cockpit: 'cockpit-oracle',
      nose: 'nose-emerald',
      hull: 'hull-gold',
    });
    expect(Object.keys(normalized)).toEqual([
      'hull',
      'nose',
      'cockpit',
      'wing-left',
      'engine-left',
      'ignition-left',
      'tail-fin',
      'shot',
    ]);
  });

  it('is idempotent', () => {
    const once = normalizeAppearanceV3({
      wings: 'wings-silver',
      engine: 'engine-blue',
      body: 'body-gold',
      shot: 'shot-kite-solar',
      hull: 'hull-dart-chrome',
    });
    expect(normalizeAppearanceV3(once)).toEqual(once);
  });
});

describe('normalizeCustomizationStateV3', () => {
  it('normalizes a full state with v1, v2 and v3 ids and preserves counts', () => {
    const state: CustomizationState = {
      lootboxes: 2,
      keys: 1,
      parts: {
        'wings-silver': 2,
        'engine-blue': 1,
        'body-gold': 1,
        'hull-dart-chrome': 3,
      },
      appearance: {
        wings: 'wings-silver',
        engine: 'engine-blue',
        body: 'hull-gold',
        shot: 'shot-kite-solar',
      },
    };
    expect(normalizeCustomizationStateV3(state)).toEqual({
      lootboxes: 2,
      keys: 1,
      parts: {
        'hull-gold': 1,
        'wing-left-silver': 2,
        'wing-right-silver': 2,
        'ignition-left-blue': 1,
        'ignition-right-blue': 1,
        'hull-dart-chrome': 3,
      },
      appearance: {
        hull: 'hull-gold',
        'wing-left': 'wing-left-silver',
        'wing-right': 'wing-right-silver',
        'ignition-left': 'ignition-left-blue',
        'ignition-right': 'ignition-right-blue',
        shot: 'shot-kite-solar',
      },
    });
  });

  it('returns a defensive copy', () => {
    const source: CustomizationState = {
      lootboxes: 3,
      keys: 4,
      parts: { 'hull-dart-chrome': 1 },
      appearance: { hull: 'hull-dart-chrome', shot: 'shot-kite-solar' },
    };
    const normalized = normalizeCustomizationStateV3(source);
    source.parts['hull-dart-chrome'] = 99;
    source.appearance.hull = 'hull-default';
    source.appearance.shot = 'shot-default';
    expect(normalized.parts).toEqual({ 'hull-dart-chrome': 1 });
    expect(normalized.appearance).toEqual({
      hull: 'hull-dart-chrome',
      shot: 'shot-kite-solar',
    });
  });

  it('leaves an already-v3 state unchanged', () => {
    const state: CustomizationState = {
      lootboxes: 0,
      keys: 0,
      parts: { 'wing-left-default': 1, 'shot-kite-solar': 2 },
      appearance: { 'wing-left': 'wing-left-default', shot: 'shot-kite-solar' },
    };
    expect(normalizeCustomizationStateV3(state)).toEqual(state);
  });
});
