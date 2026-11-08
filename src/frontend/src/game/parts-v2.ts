/**
 * Frontend granular spaceship parts catalog v2 (spaceship-cursor-loot-animations T6).
 *
 * Mirror of `src/backend/src/game/parts-v2.ts`: the same 10 slots, the same exact
 * 30-part table (standard/rare/epic per slot), the same rarity weights and weighted
 * loot draw, and the same legacy-inventory normalizers. The legacy `parts.ts` module
 * stays untouched; this module is additive and is the canonical catalog for the
 * granular part model.
 *
 * Everything here is pure: no I/O, no timers, no DOM, no randomness of its own
 * (randomness arrives as the injected `rng`). It also derives the renderer-facing
 * {@link PartVisual} map without importing three.js.
 */
import type { CustomizationState } from './types.js';

/** The ten equippable slots, in canonical order. */
export type SlotId =
  | 'hull'
  | 'nose'
  | 'cockpit'
  | 'wing-left'
  | 'wing-right'
  | 'engine-left'
  | 'engine-right'
  | 'ignition-left'
  | 'ignition-right'
  | 'tail-fin';

/** The three rarities. Only `rare` and `epic` parts are lootable. */
export type Rarity = 'standard' | 'rare' | 'epic';

/** Every v2 part id (3 per slot, 30 total). */
export type PartIdV2 =
  | 'hull-default'
  | 'hull-obsidian'
  | 'hull-gold'
  | 'nose-default'
  | 'nose-crimson'
  | 'nose-emerald'
  | 'cockpit-default'
  | 'cockpit-amber'
  | 'cockpit-oracle'
  | 'wing-left-default'
  | 'wing-left-silver'
  | 'wing-left-gold'
  | 'wing-right-default'
  | 'wing-right-silver'
  | 'wing-right-gold'
  | 'engine-left-default'
  | 'engine-left-vector'
  | 'engine-left-nova'
  | 'engine-right-default'
  | 'engine-right-vector'
  | 'engine-right-nova'
  | 'ignition-left-default'
  | 'ignition-left-blue'
  | 'ignition-left-plasma'
  | 'ignition-right-default'
  | 'ignition-right-blue'
  | 'ignition-right-plasma'
  | 'tail-fin-default'
  | 'tail-fin-split'
  | 'tail-fin-comet';

/** One slot's stable id and display name. */
export interface SlotDef {
  id: SlotId;
  name: string;
}

/** One catalog row (id, owning slot, display name, rarity, colour, accent, shape key). */
export interface PartDefV2 {
  id: PartIdV2;
  slot: SlotId;
  name: string;
  rarity: Rarity;
  color: string;
  accent: string;
  shape: string;
}

/** Renderer-facing appearance of one equipped slot. */
export interface PartVisual {
  partId: PartIdV2;
  slot: SlotId;
  color: string;
  accent: string;
  rarity: Rarity;
  shape: string;
}

/** Catalog generation, bumped when slots/parts change (migration 006 backfills v2). */
export const PART_CATALOG_VERSION = 2;

/** The ten slots, in the canonical `SLOT_CATALOG` order. */
export const SLOT_CATALOG: readonly SlotDef[] = [
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

/**
 * The exact v2 part table from the spec: 3 rows per slot in
 * standard → rare → epic order, slots in {@link SLOT_CATALOG} order.
 */
export const PART_CATALOG_V2: readonly PartDefV2[] = [
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

/** The 30 v2 part ids in catalog order. */
export const PART_IDS_V2: readonly PartIdV2[] = PART_CATALOG_V2.map((part) => part.id);

const PART_BY_ID: ReadonlyMap<string, PartDefV2> = new Map(
  PART_CATALOG_V2.map((part) => [part.id, part]),
);

const SLOT_IDS: ReadonlySet<string> = new Set(SLOT_CATALOG.map((slot) => slot.id));

/** Accepted stored part-count upper bound (matches migration 006's numeric guard). */
const MAX_PART_COUNT = 2147483647;

/** True for each of the ten canonical slot ids (exact case-sensitive match). */
export function isValidSlotId(id: string): id is SlotId {
  return SLOT_IDS.has(id);
}

/** True for exactly the 30 v2 part ids; legacy ids are handled by the normalizers. */
export function isValidPartId(id: string): id is PartIdV2 {
  return PART_BY_ID.has(id);
}

/** Returns the catalog row for a known v2 id; throws `unknown part: <id>` otherwise. */
export function partDefinition(id: string): PartDefV2 {
  const found = PART_BY_ID.get(id);
  if (found === undefined) {
    throw new Error(`unknown part: ${id}`);
  }
  return found;
}

/** Returns the owning slot of a known v2 id; throws `unknown part: <id>` otherwise. */
export function partSlot(id: string): SlotId {
  return partDefinition(id).slot;
}

/** Returns the slot's three parts in standard → rare → epic order. */
export function partsForSlot(slot: SlotId): readonly PartDefV2[] {
  return PART_CATALOG_V2.filter((part) => part.slot === slot);
}

/** Returns the slot's standard (implicitly owned) part id. */
export function defaultPartForSlot(slot: SlotId): PartIdV2 {
  const standard = PART_CATALOG_V2.find(
    (part) => part.slot === slot && part.rarity === 'standard',
  );
  if (standard === undefined) {
    throw new Error(`unknown slot: ${slot}`);
  }
  return standard.id;
}

/** Loot weight: standard 0 (never lootable), rare 3, epic 1. */
export function rarityWeight(rarity: Rarity): number {
  switch (rarity) {
    case 'standard':
      return 0;
    case 'rare':
      return 3;
    case 'epic':
      return 1;
    default:
      throw new Error(`unknown rarity: ${String(rarity)}`);
  }
}

const LOOTABLE_PARTS: readonly PartDefV2[] = PART_CATALOG_V2.filter(
  (part) => rarityWeight(part.rarity) > 0,
);

const TOTAL_LOOT_WEIGHT = LOOTABLE_PARTS.reduce(
  (total, part) => total + rarityWeight(part.rarity),
  0,
);

/**
 * Selects exactly one lootable part from one weighted draw over the 20 rare/epic
 * entries (rare weight 3, epic weight 1, total 40 → 75% rare / 25% epic). The
 * injected `rng` is consumed exactly once; draws outside `[0, 1)` are clamped, a
 * non-finite draw resolves to `0`, and a draw of `1` selects the last part
 * (`tail-fin-comet`). Standard parts never drop.
 */
export function selectLootPart(rng: () => number): PartIdV2 {
  const raw = rng();
  const draw = Number.isNaN(raw) ? 0 : Math.min(1, Math.max(0, raw));
  let remaining = draw * TOTAL_LOOT_WEIGHT;
  for (const part of LOOTABLE_PARTS) {
    remaining -= rarityWeight(part.rarity);
    if (remaining < 0) {
      return part.id;
    }
  }
  return LOOTABLE_PARTS[LOOTABLE_PARTS.length - 1].id;
}

/** Legacy part ids expanded to their v2 target(s). Nose/cockpit ids are already v2. */
const LEGACY_PART_MAP: Readonly<Record<string, readonly PartIdV2[]>> = {
  'body-default': ['hull-default'],
  'body-obsidian': ['hull-obsidian'],
  'body-gold': ['hull-gold'],
  'wings-default': ['wing-left-default', 'wing-right-default'],
  'wings-silver': ['wing-left-silver', 'wing-right-silver'],
  'engine-default': ['ignition-left-default', 'ignition-right-default'],
  'engine-blue': ['ignition-left-blue', 'ignition-right-blue'],
};

/** Legacy appearance category keys expanded to their v2 slot(s). */
const LEGACY_SLOT_MAP: Readonly<Record<string, readonly SlotId[]>> = {
  body: ['hull'],
  wings: ['wing-left', 'wing-right'],
  engine: ['ignition-left', 'ignition-right'],
};

function resolvePartIds(id: string): readonly PartIdV2[] | undefined {
  const legacy = LEGACY_PART_MAP[id];
  if (legacy !== undefined) {
    return legacy;
  }
  return isValidPartId(id) ? [id] : undefined;
}

function isStoredCount(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_PART_COUNT
  );
}

/**
 * Normalizes a stored `parts` map: legacy ids expand to their v2 targets (both wings /
 * both ignitions with the same count), collisions are summed, unknown ids and invalid
 * counts are dropped, and the result is emitted in catalog order (AC-15/AC-16).
 */
export function normalizePartMap(parts: Record<string, number>): Record<string, number> {
  const totals = new Map<PartIdV2, number>();
  for (const [id, count] of Object.entries(parts)) {
    if (!isStoredCount(count)) {
      continue;
    }
    const targets = resolvePartIds(id);
    if (targets === undefined) {
      continue;
    }
    for (const target of targets) {
      totals.set(target, (totals.get(target) ?? 0) + count);
    }
  }
  const normalized: Record<string, number> = {};
  for (const part of PART_CATALOG_V2) {
    const count = totals.get(part.id);
    if (count !== undefined) {
      normalized[part.id] = count;
    }
  }
  return normalized;
}

/**
 * Normalizes a stored `appearance` map: legacy categories/values map to the v2 slot and
 * part (wings/engine expand to both slots), unknown slots/ids and slot/part mismatches
 * are dropped, and canonical v2 slot keys win over legacy aliases. The result is
 * emitted in slot order (AC-15/AC-16/AC-28).
 */
export function normalizeAppearance(appearance: Record<string, string>): Record<string, string> {
  const resolved = new Map<SlotId, PartIdV2>();

  // Canonical slot keys win over legacy aliases regardless of object insertion order.
  for (const [key, value] of Object.entries(appearance)) {
    if (!isValidSlotId(key) || typeof value !== 'string') {
      continue;
    }
    const targets = resolvePartIds(value);
    if (targets === undefined) {
      continue;
    }
    for (const target of targets) {
      if (partDefinition(target).slot === key) {
        resolved.set(key, target);
      }
    }
  }

  for (const [key, value] of Object.entries(appearance)) {
    const slots = LEGACY_SLOT_MAP[key];
    if (slots === undefined || typeof value !== 'string') {
      continue;
    }
    const targets = resolvePartIds(value);
    if (targets === undefined) {
      continue;
    }
    for (const target of targets) {
      const slot = partDefinition(target).slot;
      if (slots.includes(slot) && !resolved.has(slot)) {
        resolved.set(slot, target);
      }
    }
  }

  const normalized: Record<string, string> = {};
  for (const slot of SLOT_CATALOG) {
    const partId = resolved.get(slot.id);
    if (partId !== undefined) {
      normalized[slot.id] = partId;
    }
  }
  return normalized;
}

/** Normalizes a full customization state (legacy parts + appearance maps). */
export function normalizeCustomizationState(state: CustomizationState): CustomizationState {
  return {
    lootboxes: state.lootboxes,
    keys: state.keys,
    parts: normalizePartMap(state.parts),
    appearance: normalizeAppearance(state.appearance),
  };
}

/**
 * Maps a slot→part-id appearance to the 10 renderer-facing slot visuals, always in
 * `SLOT_CATALOG` order. Missing, unknown, mismatched or legacy values resolve through
 * the normalizer and fall back to the slot's standard part.
 */
export function appearanceToCursorShipParams(
  appearance: Record<string, string>,
): Record<SlotId, PartVisual> {
  const normalized = normalizeAppearance(appearance);
  const params = {} as Record<SlotId, PartVisual>;
  for (const slot of SLOT_CATALOG) {
    const equipped = normalized[slot.id];
    const definition = partDefinition(equipped ?? defaultPartForSlot(slot.id));
    params[slot.id] = {
      partId: definition.id,
      slot: definition.slot,
      color: definition.color,
      accent: definition.accent,
      rarity: definition.rarity,
      shape: definition.shape,
    };
  }
  return params;
}
