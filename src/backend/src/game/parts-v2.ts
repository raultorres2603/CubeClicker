/**
 * Backend spaceship parts catalog v2 (spaceship-cursor-loot-animations T1).
 *
 * Additive compatibility (F5/F1): the legacy `parts.ts` catalog and its helpers stay
 * untouched until their consumers migrate. This module is the canonical catalog for the
 * granular slot model: 10 slots × 3 parts (standard/rare/epic) = 30 parts, of which the
 * 20 non-standard parts are lootable with weights rare 3 / epic 1 (75 % / 25 % aggregate).
 *
 * Everything here is pure: no I/O, no timers, no DOM, no randomness of its own. Randomness
 * arrives as an injected `rng`, so loot selection is deterministic in tests.
 */

/** The ten independently collectible/equippable slots, in catalog order. */
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

export type Rarity = 'standard' | 'rare' | 'epic';

/** Every v2 part id; legacy ids (`body-*`, `wings-*`, `engine-*`) are not v2 ids. */
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

export interface SlotDef {
  id: SlotId;
  name: string;
}

export interface PartDefV2 {
  id: PartIdV2;
  slot: SlotId;
  name: string;
  rarity: Rarity;
  color: string;
  accent: string;
  shape: string;
}

/**
 * The persistence shape consumed by the normalizers. It is structurally identical to the
 * protocol/repository `CustomizationState`; defining it locally keeps this module import-free
 * and usable by both backend consumers.
 */
export interface CustomizationState {
  lootboxes: number;
  keys: number;
  parts: Record<string, number>;
  appearance: Record<string, string>;
}

export const PART_CATALOG_VERSION = 2;

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

const SLOT_IDS: readonly SlotId[] = SLOT_CATALOG.map((slot) => slot.id);

/** The pinned 30-row catalog, in spec order (three parts per slot). */
export const PART_CATALOG_V2: readonly PartDefV2[] = [
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

export const PART_IDS_V2: readonly PartIdV2[] = PART_CATALOG_V2.map((part) => part.id);

const PART_BY_ID = new Map<string, PartDefV2>(PART_CATALOG_V2.map((part) => [part.id, part]));

/** Type guard for a client-supplied slot id. */
export function isValidSlotId(id: string): id is SlotId {
  return SLOT_IDS.includes(id as SlotId);
}

/** Type guard for a v2 part id; legacy ids are rejected. */
export function isValidPartId(id: string): id is PartIdV2 {
  return PART_BY_ID.has(id);
}

/** Returns the v2 definition for a known id; throws `unknown part: <id>` otherwise. */
export function partDefinition(id: string): PartDefV2 {
  const found = PART_BY_ID.get(id);
  if (found === undefined) {
    throw new Error(`unknown part: ${id}`);
  }
  return found;
}

/** Returns the slot of a known v2 part id; throws `unknown part: <id>` otherwise. */
export function partSlot(id: string): SlotId {
  return partDefinition(id).slot;
}

/** The exactly three catalog entries for a slot, in standard→rare→epic order. */
export function partsForSlot(slot: SlotId): readonly PartDefV2[] {
  return PART_CATALOG_V2.filter((part) => part.slot === slot);
}

/** The implicitly-owned standard part for a slot. */
export function defaultPartForSlot(slot: SlotId): PartIdV2 {
  const found = PART_CATALOG_V2.find(
    (part) => part.slot === slot && part.rarity === 'standard',
  );
  if (found === undefined) {
    throw new Error(`unknown slot: ${slot}`);
  }
  return found.id;
}

/** Loot weight by rarity: standard 0 (not lootable), rare 3, epic 1. */
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

const LOOT_WEIGHT_TOTAL = LOOTABLE_PARTS.reduce(
  (total, part) => total + rarityWeight(part.rarity),
  0,
);

/**
 * One weighted draw over the 20 lootable parts using the injected rng.
 *
 * Rare parts weigh 3 and epic parts 1 (total 40 → 75 % rare / 25 % epic aggregate,
 * 7.5 % per rare part and 2.5 % per epic part). The rng is consumed exactly once; values
 * outside `[0, 1]` are clamped and a `1` draw resolves to the last part.
 */
export function selectLootPart(rng: () => number): PartIdV2 {
  const raw = rng();
  const draw = Number.isNaN(raw) ? 0 : Math.min(1, Math.max(0, raw));
  let remaining = draw * LOOT_WEIGHT_TOTAL;
  for (const part of LOOTABLE_PARTS) {
    remaining -= rarityWeight(part.rarity);
    if (remaining < 0) {
      return part.id;
    }
  }
  return LOOTABLE_PARTS[LOOTABLE_PARTS.length - 1]!.id;
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
 * Normalizes a persisted `parts` map: legacy ids expand to their v2 targets (both wings /
 * both ignitions with the same count), collisions are summed, unknown ids and invalid
 * counts are dropped, and the result is emitted in catalog order.
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
 * Normalizes a persisted `appearance` map: legacy categories/values map to the v2 slot and
 * part (wings/engine expand to both slots), unknown slots/ids and slot/part mismatches are
 * dropped, and the result is emitted in slot order. Canonical v2 slot keys take precedence
 * over legacy aliases when both are present.
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

/** Normalizes a full persisted customization state (defensive copy). */
export function normalizeCustomizationState(state: CustomizationState): CustomizationState {
  return {
    lootboxes: state.lootboxes,
    keys: state.keys,
    parts: normalizePartMap(state.parts),
    appearance: normalizeAppearance(state.appearance),
  };
}
