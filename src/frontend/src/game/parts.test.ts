import { describe, expect, it } from 'vitest';

import {
  PART_CATALOG,
  PARTS,
  PART_LIST,
  PART_IDS,
  isValidPartId,
  partCategory,
  partDefinition,
  randomPartId,
  listParts,
  list,
  appearanceToSpaceshipParams,
  createSeededRandom,
  seededRandom,
  LCG_SEED,
  type PartCategory,
  type SpaceshipVisualParams,
} from './parts.js';

describe('PART_CATALOG', () => {
  it('pins exactly twelve parts', () => {
    expect(PART_CATALOG).toHaveLength(12);
    expect(PARTS).toHaveLength(12);
    expect(PART_LIST).toHaveLength(12);
    expect(PART_IDS).toHaveLength(12);
  });

  it('pins the twelve ids in the approved order', () => {
    expect(PART_IDS).toEqual([
      'nose-default',
      'nose-crimson',
      'nose-emerald',
      'body-default',
      'body-obsidian',
      'body-gold',
      'wings-default',
      'wings-silver',
      'cockpit-default',
      'cockpit-amber',
      'engine-default',
      'engine-blue',
    ]);
  });

  it('pins each part id, category, name and color', () => {
    expect(PART_CATALOG[0]).toEqual({
      id: 'nose-default',
      category: 'nose',
      name: 'Default Nose',
      color: '#88aaff',
    });
    expect(PART_CATALOG[11]).toEqual({
      id: 'engine-blue',
      category: 'engine',
      name: 'Blue Engine',
      color: '#4488ff',
    });
  });

  it('has three nose, three body, two wings, two cockpit, two engine', () => {
    const counts: Record<PartCategory, number> = {
      nose: 0,
      body: 0,
      wings: 0,
      cockpit: 0,
      engine: 0,
    };
    for (const part of PART_CATALOG) {
      counts[part.category] += 1;
    }
    expect(counts).toEqual({ nose: 3, body: 3, wings: 2, cockpit: 2, engine: 2 });
  });
});

describe('isValidPartId', () => {
  it('accepts every pinned id', () => {
    for (const id of PART_IDS) {
      expect(isValidPartId(id)).toBe(true);
    }
  });

  it('rejects unknown and malformed ids', () => {
    expect(isValidPartId('')).toBe(false);
    expect(isValidPartId('unknown')).toBe(false);
    expect(isValidPartId('NOSE-DEFAULT')).toBe(false);
    expect(isValidPartId('nose')).toBe(false);
  });
});

describe('partCategory', () => {
  it('returns the category for each pinned part', () => {
    expect(partCategory('nose-default')).toBe('nose');
    expect(partCategory('body-gold')).toBe('body');
    expect(partCategory('wings-silver')).toBe('wings');
    expect(partCategory('cockpit-amber')).toBe('cockpit');
    expect(partCategory('engine-blue')).toBe('engine');
  });

  it('throws on an unknown id', () => {
    expect(() => partCategory('nope')).toThrow(/unknown part: nope/);
  });
});

describe('partDefinition', () => {
  it('returns the matching definition', () => {
    expect(partDefinition('body-gold')).toEqual({
      id: 'body-gold',
      category: 'body',
      name: 'Gold Body',
      color: '#ccaa44',
    });
  });

  it('throws on an unknown id', () => {
    expect(() => partDefinition('missing')).toThrow(/unknown part: missing/);
  });
});

describe('randomPartId', () => {
  it('selects the first part when rng returns 0', () => {
    expect(randomPartId(() => 0)).toBe('nose-default');
  });

  it('selects the last part when rng returns just under 1', () => {
    expect(randomPartId(() => 0.9999)).toBe('engine-blue');
  });

  it('is deterministic for a fixed rng sequence', () => {
    const values = [0.1, 0.5, 0.9];
    let i = 0;
    const rng = () => values[i++ % values.length]!;
    expect(randomPartId(rng)).toBe(PART_CATALOG[Math.floor(0.1 * 12)]!.id);
  });

  it('clamps out-of-range rng draws', () => {
    expect(randomPartId(() => 1)).toBe('engine-blue');
    expect(randomPartId(() => -0.5)).toBe('nose-default');
  });

  it('supports a numeric seed (seeded LCG)', () => {
    const rng = createSeededRandom(42);
    expect(randomPartId(rng)).toBe(randomPartId(42));
  });

  it('uses the pinned LCG when no argument is given', () => {
    const rng = createSeededRandom(LCG_SEED);
    expect(randomPartId()).toBe(randomPartId(rng));
  });
});

describe('createSeededRandom', () => {
  it('is deterministic for a given seed', () => {
    const a = createSeededRandom(7);
    const b = createSeededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('seededRandom alias matches', () => {
    const a = seededRandom(9);
    const b = createSeededRandom(9);
    expect([a(), a()]).toEqual([b(), b()]);
  });
});

describe('list helpers', () => {
  it('listParts returns the catalog', () => {
    expect(listParts()).toBe(PART_CATALOG);
  });

  it('list returns the catalog', () => {
    expect(list()).toBe(PART_CATALOG);
  });
});

describe('appearanceToSpaceshipParams', () => {
  it('returns default colors for an empty appearance', () => {
    const params: SpaceshipVisualParams = appearanceToSpaceshipParams({});
    expect(params).toEqual({
      noseColor: '#88aaff',
      bodyColor: '#4466cc',
      wingColor: '#4466cc',
      cockpitColor: '#ffffff',
      engineColor: '#ff6600',
    });
  });

  it('uses equipped part colors', () => {
    const params = appearanceToSpaceshipParams({
      nose: 'nose-crimson',
      body: 'body-gold',
      wings: 'wings-silver',
      cockpit: 'cockpit-amber',
      engine: 'engine-blue',
    });
    expect(params).toEqual({
      noseColor: '#cc4444',
      bodyColor: '#ccaa44',
      wingColor: '#aaaaaa',
      cockpitColor: '#ffaa44',
      engineColor: '#4488ff',
    });
  });

  it('falls back to defaults for unknown part ids', () => {
    const params = appearanceToSpaceshipParams({ nose: 'nope', body: '' });
    expect(params.noseColor).toBe('#88aaff');
    expect(params.bodyColor).toBe('#4466cc');
  });
});