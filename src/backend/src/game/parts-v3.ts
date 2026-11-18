/**
 * Backend spaceship parts catalog v3 (remote-spaceship-customization T1).
 *
 * The catalog is deterministic and mirrored by the frontend module of the same name: it is
 * never sent over the wire, only equipped ids travel. Eleven slots × (classic rows + 10
 * generated forms × 12 finishes) produce exactly 1,351 rows, of which 1,340 are lootable
 * (670 rare / 670 epic) and 11 are standard.
 *
 * Classic rows are the accepted v2 catalog plus `shot-default`, preserved verbatim with
 * `form: 'classic'` / `finish: 'classic'`. Generated rows are
 * `{ id: slot-form-finish, name: '<Finish> <Form> <noun>', rarity/color/accent from the
 * finish, shape: form }`.
 *
 * Everything here is pure: no I/O, no timers, no DOM, no randomness of its own. Randomness
 * arrives as an injected `rng`, so loot selection is deterministic in tests.
 */

import {
  PART_CATALOG_V2,
  SLOT_CATALOG,
  type CustomizationState,
  type Rarity,
  type SlotId,
} from './parts-v2.js';

/** The eleven catalog slots, in catalog order: the ten v2 ship slots plus `shot`. */
export type SlotIdV3 = SlotId | 'shot';

/** Every v3 part id. Legacy v1 ids (`body-*`, `wings-*`, `engine-*`) are not v3 ids. */
export type PartIdV3 = `${SlotIdV3}-${string}`;

export type RarityV3 = Rarity;

/** The eleven forms, in catalog order. `classic` keeps the accepted v2 transforms. */
export type FormId =
  | 'classic'
  | 'dart'
  | 'lance'
  | 'needle'
  | 'manta'
  | 'hauler'
  | 'bulwark'
  | 'arrow'
  | 'orca'
  | 'talon'
  | 'kite';

export type ShotGeometry = 'bolt' | 'orb' | 'wave' | 'shard';

export type MuzzleKind = 'spark' | 'ring' | 'petal';

/** The numeric inputs of the renderer's form transform plus the form's shot profile. */
export interface FormRecipe {
  lengthScale: number;
  widthScale: number;
  sweepDeg: number;
  thicknessScale: number;
  offsetZ: number;
  chassis: readonly [number, number, number];
  shot: {
    geometry: ShotGeometry;
    scale: number;
    muzzle: MuzzleKind;
  };
}

export interface FormDef {
  id: FormId;
  label: string;
  /** `null` for `classic`, whose transforms are the accepted v2 tables. */
  recipe: FormRecipe | null;
}

export interface FinishDef {
  id: string;
  label: string;
  color: string;
  accent: string;
  rarity: 'rare' | 'epic';
}

export interface SlotDefV3 {
  id: SlotIdV3;
  name: string;
}

export interface PartDefV3 {
  id: string;
  slot: SlotIdV3;
  name: string;
  rarity: RarityV3;
  color: string;
  accent: string;
  form: FormId;
  finish: string;
  shape: string;
}

export interface ShotStyleDef {
  partId: string;
  geometry: ShotGeometry;
  scale: number;
  muzzle: MuzzleKind;
  color: string;
  accent: string;
}

export const PART_CATALOG_VERSION = 3;

export const CATALOG_ROW_COUNT = 1351;

export const LOOTABLE_ROW_COUNT = 1340;

/** The eleven slots in catalog order; the ten ship slots come from the accepted v2 table. */
export const SLOT_CATALOG_V3: readonly SlotDefV3[] = [
  ...SLOT_CATALOG.map((slot): SlotDefV3 => ({ id: slot.id, name: slot.name })),
  { id: 'shot', name: 'Shot' },
];

/** The noun appended to a generated part name, per slot. */
export const SLOT_NOUN: Readonly<Record<SlotIdV3, string>> = {
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

/** The eleven forms in catalog order (recipes from the pinned spec table). */
export const FORM_CATALOG: readonly FormDef[] = [
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

/** The twelve finishes in catalog order: six rare, then six epic. */
export const FINISH_CATALOG: readonly FinishDef[] = [
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

/** The `shot` slot's standard row (no v2 equivalent). */
const SHOT_DEFAULT_ROW: PartDefV3 = {
  id: 'shot-default',
  slot: 'shot',
  name: 'Standard Bolt',
  rarity: 'standard',
  color: '#fff1c8',
  accent: '#ffd27a',
  form: 'classic',
  finish: 'classic',
  shape: 'standard',
};

function buildCatalog(): readonly PartDefV3[] {
  const rows: PartDefV3[] = [];
  for (const slot of SLOT_CATALOG_V3) {
    if (slot.id === 'shot') {
      rows.push(SHOT_DEFAULT_ROW);
    } else {
      for (const classic of PART_CATALOG_V2) {
        if (classic.slot !== slot.id) {
          continue;
        }
        rows.push({ ...classic, form: 'classic', finish: 'classic' });
      }
    }
    for (const form of FORM_CATALOG) {
      if (form.recipe === null) {
        continue;
      }
      for (const finish of FINISH_CATALOG) {
        rows.push({
          id: `${slot.id}-${form.id}-${finish.id}`,
          slot: slot.id,
          name: `${finish.label} ${form.label} ${SLOT_NOUN[slot.id]}`,
          rarity: finish.rarity,
          color: finish.color,
          accent: finish.accent,
          form: form.id,
          finish: finish.id,
          shape: form.id,
        });
      }
    }
  }
  return rows;
}

/** The pinned 1,351-row catalog in spec order. */
export const PART_CATALOG_V3: readonly PartDefV3[] = buildCatalog();

const SLOT_IDS_V3: readonly SlotIdV3[] = SLOT_CATALOG_V3.map((slot) => slot.id);

const PART_BY_ID = new Map<string, PartDefV3>(
  PART_CATALOG_V3.map((part) => [part.id, part]),
);

const FORM_BY_ID = new Map<FormId, FormDef>(FORM_CATALOG.map((form) => [form.id, form]));

/**
 * FNV-1a 32-bit over the pinned row string of AC-6, formatted as 8 lowercase hex digits.
 * Exported as a test seam so the mirror parity literal is reproducible.
 */
export function computeCatalogRowsHash(rows: readonly PartDefV3[]): string {
  const payload = rows
    .map((row) =>
      [
        row.id,
        row.slot,
        row.name,
        row.rarity,
        row.color,
        row.accent,
        row.form,
        row.finish,
      ].join('|'),
    )
    .join('\n');
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(payload)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Pinned mirror-parity checksum of all catalog rows (both workspaces must match). */
export const CATALOG_ROWS_HASH = computeCatalogRowsHash(PART_CATALOG_V3);

/** Type guard for a client-supplied v3 slot id. */
export function isValidSlotIdV3(id: string): id is SlotIdV3 {
  return SLOT_IDS_V3.includes(id as SlotIdV3);
}

/** Type guard for a v3 part id; legacy v1 ids are rejected. */
export function isValidPartIdV3(id: string): id is PartIdV3 {
  return PART_BY_ID.has(id);
}

/** Returns the v3 definition for a known id; throws `unknown part: <id>` otherwise. */
export function partDefinitionV3(id: string): PartDefV3 {
  const found = PART_BY_ID.get(id);
  if (found === undefined) {
    throw new Error(`unknown part: ${id}`);
  }
  return found;
}

/** Every catalog row of a slot, in catalog order. */
export function catalogForSlot(slot: SlotIdV3): readonly PartDefV3[] {
  return PART_CATALOG_V3.filter((part) => part.slot === slot);
}

/**
 * Every catalog row of a slot/form pair, in finish order. `classic` returns the slot's
 * accepted v2 rows (three per ship slot, one for `shot`) and a generated form returns
 * exactly twelve.
 */
export function catalogForSlotForm(slot: SlotIdV3, form: FormId): readonly PartDefV3[] {
  return PART_CATALOG_V3.filter((part) => part.slot === slot && part.form === form);
}

/** The implicitly-owned standard part for a slot; throws `unknown slot: <id>` otherwise. */
export function defaultPartForSlotV3(slot: SlotIdV3): string {
  const found = PART_CATALOG_V3.find(
    (part) => part.slot === slot && part.rarity === 'standard',
  );
  if (found === undefined) {
    throw new Error(`unknown slot: ${slot}`);
  }
  return found.id;
}

/** Loot weight by rarity: standard 0 (not lootable), rare 3, epic 1. */
const LOOT_WEIGHT: Readonly<Record<Rarity, number>> = {
  standard: 0,
  rare: 3,
  epic: 1,
};

const LOOTABLE_PARTS: readonly PartDefV3[] = PART_CATALOG_V3.filter(
  (part) => LOOT_WEIGHT[part.rarity] > 0,
);

const LOOT_WEIGHT_TOTAL = LOOTABLE_PARTS.reduce(
  (total, part) => total + LOOT_WEIGHT[part.rarity],
  0,
);

/**
 * One weighted draw over the 1,340 lootable rows in catalog order using the injected rng.
 *
 * Rare rows weigh 3 and epic rows 1 (total 2,680 → 75 % rare / 25 % epic aggregate). The
 * rng is consumed exactly once; `NaN`/`-Infinity`/values ≤ 0 resolve to 0, `Infinity`/values
 * ≥ 1 clamp to 1, so `0` selects `hull-obsidian` and `0.999999`/`1` select `shot-kite-solar`.
 */
export function selectLootPartV3(rng: () => number): string {
  const raw = rng();
  const draw = Number.isNaN(raw) ? 0 : Math.min(1, Math.max(0, raw));
  let remaining = draw * LOOT_WEIGHT_TOTAL;
  for (const part of LOOTABLE_PARTS) {
    remaining -= LOOT_WEIGHT[part.rarity];
    if (remaining < 0) {
      return part.id;
    }
  }
  return LOOTABLE_PARTS[LOOTABLE_PARTS.length - 1]!.id;
}

function classicShotStyle(part: PartDefV3): ShotStyleDef {
  return {
    partId: part.id,
    geometry: 'bolt',
    scale: 1,
    muzzle: 'spark',
    color: part.color,
    accent: part.accent,
  };
}

/**
 * Resolves a v3 part to the shot style fired while it is equipped. A `shot` row uses its
 * form's pinned profile and the finish's colours; every other slot uses the accepted
 * `shot-default` bolt. Throws `unknown part: <id>` for an unknown id.
 */
export function shotStyleForPart(partId: string): ShotStyleDef {
  const part = partDefinitionV3(partId);
  if (part.slot !== 'shot') {
    return classicShotStyle(partDefinitionV3('shot-default'));
  }
  const form = FORM_BY_ID.get(part.form);
  if (form === undefined || form.recipe === null) {
    return classicShotStyle(part);
  }
  return {
    partId: part.id,
    geometry: form.recipe.shot.geometry,
    scale: form.recipe.shot.scale,
    muzzle: form.recipe.shot.muzzle,
    color: part.color,
    accent: part.accent,
  };
}

/** Legacy v1 part ids expanded to their v3 target(s). Nose/cockpit ids are already v3. */
const LEGACY_PART_MAP: Readonly<Record<string, readonly string[]>> = {
  'body-default': ['hull-default'],
  'body-obsidian': ['hull-obsidian'],
  'body-gold': ['hull-gold'],
  'wings-default': ['wing-left-default', 'wing-right-default'],
  'wings-silver': ['wing-left-silver', 'wing-right-silver'],
  'engine-default': ['ignition-left-default', 'ignition-right-default'],
  'engine-blue': ['ignition-left-blue', 'ignition-right-blue'],
};

/** Legacy appearance category keys expanded to their v3 slot(s). */
const LEGACY_SLOT_MAP: Readonly<Record<string, readonly SlotIdV3[]>> = {
  body: ['hull'],
  wings: ['wing-left', 'wing-right'],
  engine: ['ignition-left', 'ignition-right'],
};

function resolvePartIdsV3(id: string): readonly string[] | undefined {
  const legacy = LEGACY_PART_MAP[id];
  if (legacy !== undefined) {
    return legacy;
  }
  return isValidPartIdV3(id) ? [id] : undefined;
}

/** Mirrors migration 006: counts are non-negative int4 values. */
const MAX_PART_COUNT = 2_147_483_647;

function isStoredCount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_PART_COUNT
  );
}

/**
 * Normalizes a persisted `parts` map against the v3 catalog: legacy ids expand to their v3
 * targets (both wings / both ignitions with the same count), collisions are summed, unknown
 * ids and invalid counts are dropped, and the result is emitted in catalog order.
 */
export function normalizePartMapV3(parts: Record<string, number>): Record<string, number> {
  const totals = new Map<string, number>();
  for (const [id, count] of Object.entries(parts)) {
    if (!isStoredCount(count)) {
      continue;
    }
    const targets = resolvePartIdsV3(id);
    if (targets === undefined) {
      continue;
    }
    for (const target of targets) {
      totals.set(target, (totals.get(target) ?? 0) + count);
    }
  }
  const normalized: Record<string, number> = {};
  for (const part of PART_CATALOG_V3) {
    const count = totals.get(part.id);
    if (count !== undefined) {
      normalized[part.id] = count;
    }
  }
  return normalized;
}

/**
 * Normalizes a persisted `appearance` map against the v3 catalog: legacy categories/values
 * map to v3 slots (wings/engine expand to both slots), unknown slots/ids and slot/part
 * mismatches are dropped, and the result is emitted in `SLOT_CATALOG_V3` order. Canonical v3
 * slot keys take precedence over legacy aliases when both are present. Normalization is
 * independent of the stored `customization_version`.
 */
export function normalizeAppearanceV3(
  appearance: Record<string, string>,
): Record<string, string> {
  const resolved = new Map<SlotIdV3, string>();

  // Canonical slot keys win over legacy aliases regardless of object insertion order.
  for (const [key, value] of Object.entries(appearance)) {
    if (!isValidSlotIdV3(key) || typeof value !== 'string') {
      continue;
    }
    const targets = resolvePartIdsV3(value);
    if (targets === undefined) {
      continue;
    }
    for (const target of targets) {
      if (partDefinitionV3(target).slot === key) {
        resolved.set(key, target);
      }
    }
  }

  for (const [key, value] of Object.entries(appearance)) {
    const slots = LEGACY_SLOT_MAP[key];
    if (slots === undefined || typeof value !== 'string') {
      continue;
    }
    const targets = resolvePartIdsV3(value);
    if (targets === undefined) {
      continue;
    }
    for (const target of targets) {
      const slot = partDefinitionV3(target).slot;
      if (slots.includes(slot) && !resolved.has(slot)) {
        resolved.set(slot, target);
      }
    }
  }

  const normalized: Record<string, string> = {};
  for (const slot of SLOT_CATALOG_V3) {
    const partId = resolved.get(slot.id);
    if (partId !== undefined) {
      normalized[slot.id] = partId;
    }
  }
  return normalized;
}

/** Normalizes a full persisted customization state against the v3 catalog (defensive copy). */
export function normalizeCustomizationStateV3(
  state: CustomizationState,
): CustomizationState {
  return {
    lootboxes: state.lootboxes,
    keys: state.keys,
    parts: normalizePartMapV3(state.parts),
    appearance: normalizeAppearanceV3(state.appearance),
  };
}
