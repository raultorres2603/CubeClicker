/**
 * Backend spaceship parts catalog and pure helpers (T1).
 *
 * Pinned values (spec § Part catalog): 12 parts across 5 categories
 * (nose, body, wings, cockpit, engine), uniform random selection. The frontend
 * mirrors the same catalog in `src/frontend/src/game/parts.ts` for rendering;
 * server totals/inventory reconcile.
 *
 * Everything here is pure: no I/O, no timers, no DOM, no randomness of its own.
 * Randomness arrives as an injected `rng`, so selection is deterministic in tests.
 */
export type PartCategory = 'nose' | 'body' | 'wings' | 'cockpit' | 'engine';

export type PartId =
  | 'nose-default'
  | 'nose-crimson'
  | 'nose-emerald'
  | 'body-default'
  | 'body-obsidian'
  | 'body-gold'
  | 'wings-default'
  | 'wings-silver'
  | 'cockpit-default'
  | 'cockpit-amber'
  | 'engine-default'
  | 'engine-blue';

export interface PartDef {
  id: PartId;
  category: PartCategory;
  name: string;
  color: string;
}

/** Alias matching the task's requested public name. */
export type PartDefinition = PartDef;

export const PART_CATALOG: readonly PartDef[] = [
  { id: 'nose-default', category: 'nose', name: 'Default Nose', color: '#88aaff' },
  { id: 'nose-crimson', category: 'nose', name: 'Crimson Nose', color: '#cc4444' },
  { id: 'nose-emerald', category: 'nose', name: 'Emerald Nose', color: '#44cc88' },
  { id: 'body-default', category: 'body', name: 'Default Body', color: '#4466cc' },
  { id: 'body-obsidian', category: 'body', name: 'Obsidian Body', color: '#222233' },
  { id: 'body-gold', category: 'body', name: 'Gold Body', color: '#ccaa44' },
  { id: 'wings-default', category: 'wings', name: 'Default Wings', color: '#4466cc' },
  { id: 'wings-silver', category: 'wings', name: 'Silver Wings', color: '#aaaaaa' },
  { id: 'cockpit-default', category: 'cockpit', name: 'Default Cockpit', color: '#ffffff' },
  { id: 'cockpit-amber', category: 'cockpit', name: 'Amber Cockpit', color: '#ffaa44' },
  { id: 'engine-default', category: 'engine', name: 'Engine Flame', color: '#ff6600' },
  { id: 'engine-blue', category: 'engine', name: 'Blue Engine', color: '#4488ff' },
];

export const PARTS: readonly PartDef[] = PART_CATALOG;
export const PART_LIST: readonly PartDef[] = PART_CATALOG;

export const PART_IDS: readonly PartId[] = PART_CATALOG.map((entry) => entry.id);

export interface SpaceshipVisualParams {
  noseColor: string;
  bodyColor: string;
  wingColor: string;
  cockpitColor: string;
  engineColor: string;
}

/** Alias matching shorter public names. */
export type VisualParams = SpaceshipVisualParams;

function definition(id: string): PartDef | undefined {
  return PART_CATALOG.find((entry) => entry.id === id);
}

/** Type guard for a client-supplied part id. */
export function isValidPartId(id: string): id is PartId {
  return PART_IDS.includes(id as PartId);
}

/** Returns the category of a part; throws on an unknown id. */
export function partCategory(id: string): PartCategory {
  const found = definition(id);
  if (found === undefined) {
    throw new Error(`unknown part: ${id}`);
  }
  return found.category;
}

/** Returns the part definition for a known id; throws on an unknown id. */
export function partDefinition(id: string): PartDef {
  const found = definition(id);
  if (found === undefined) {
    throw new Error(`unknown part: ${id}`);
  }
  return found;
}

/** Uniform selection over the catalog using the injected rng. */
export function randomPartId(rng: () => number): PartId {
  const count = PART_CATALOG.length;
  const raw = Math.floor(rng() * count);
  const index = Math.min(count - 1, Math.max(0, raw));
  return PART_CATALOG[index]!.id;
}

/** Returns the (pinned) catalog as a list. */
export function listParts(): readonly PartDef[] {
  return PART_CATALOG;
}

/** Alias for {@link listParts}. */
export function list(): readonly PartDef[] {
  return PART_CATALOG;
}

const DEFAULT_COLORS: Record<PartCategory, string> = {
  nose: '#88aaff',
  body: '#4466cc',
  wings: '#4466cc',
  cockpit: '#ffffff',
  engine: '#ff6600',
};

function colorForCategory(category: PartCategory, appearance: Record<string, string>): string {
  const partId = appearance[category];
  if (typeof partId === 'string' && isValidPartId(partId)) {
    const def = definition(partId);
    if (def !== undefined && def.category === category) {
      return def.color;
    }
  }
  return DEFAULT_COLORS[category];
}

/** Maps an equipped appearance (category -> partId) to spaceship visual params. */
export function appearanceToSpaceshipParams(
  appearance: Record<string, string>,
): SpaceshipVisualParams {
  return {
    noseColor: colorForCategory('nose', appearance),
    bodyColor: colorForCategory('body', appearance),
    wingColor: colorForCategory('wings', appearance),
    cockpitColor: colorForCategory('cockpit', appearance),
    engineColor: colorForCategory('engine', appearance),
  };
}