import { describe, expect, it } from 'vitest';

import {
  CUBE_STYLES,
  advanceLevel,
  createProgression,
  currentStyle,
  recordClick,
  recordFaceDestroyed,
  type Progression,
} from './progression';

/** Builds a progression directly from a level and stats — input values, not a factory. */
function progressionAt(levelIndex: number, clicks: number, facesDestroyed: number): Progression {
  return { levelIndex, stats: { clicks, facesDestroyed } };
}

describe('CUBE_STYLES', () => {
  it('pins the five styles in cycling order with exact colours and materials', () => {
    expect(CUBE_STYLES).toEqual([
      {
        id: 'obsidian-neon',
        name: 'Obsidian Neon',
        cubeColor: '#0b0b12',
        miniCubeColor: '#1de9b6',
        accentColor: '#7cf6ff',
        metalness: 0.6,
        roughness: 0.35,
      },
      {
        id: 'crimson-alloy',
        name: 'Crimson Alloy',
        cubeColor: '#1a0b0e',
        miniCubeColor: '#ff4d6d',
        accentColor: '#ffb3c1',
        metalness: 0.8,
        roughness: 0.3,
      },
      {
        id: 'emerald-crystal',
        name: 'Emerald Crystal',
        cubeColor: '#0a1410',
        miniCubeColor: '#34d399',
        accentColor: '#a7f3d0',
        metalness: 0.2,
        roughness: 0.15,
      },
      {
        id: 'solar-gold',
        name: 'Solar Gold',
        cubeColor: '#2a1a05',
        miniCubeColor: '#ffcc66',
        accentColor: '#ffe9b3',
        metalness: 0.9,
        roughness: 0.25,
      },
      {
        id: 'violet-nebula',
        name: 'Violet Nebula',
        cubeColor: '#140a1f',
        miniCubeColor: '#a78bfa',
        accentColor: '#d8ccff',
        metalness: 0.7,
        roughness: 0.4,
      },
    ]);
    expect(CUBE_STYLES).toHaveLength(5);
    expect(CUBE_STYLES.map((style) => style.id)).toEqual([
      'obsidian-neon',
      'crimson-alloy',
      'emerald-crystal',
      'solar-gold',
      'violet-nebula',
    ]);
  });
});

describe('createProgression', () => {
  it('starts at level 0 with both counters at zero', () => {
    expect(createProgression()).toEqual({ levelIndex: 0, stats: { clicks: 0, facesDestroyed: 0 } });
  });

  it('returns a fresh, independent progression on every call', () => {
    const first = createProgression();
    const second = createProgression();

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.stats).not.toBe(first.stats);
  });
});

describe('currentStyle', () => {
  it('selects the style matching the level index in list order', () => {
    expect(currentStyle(progressionAt(0, 0, 0))).toEqual(CUBE_STYLES[0]);
    expect(currentStyle(progressionAt(1, 0, 0))).toEqual(CUBE_STYLES[1]);
    expect(currentStyle(progressionAt(2, 0, 0))).toEqual(CUBE_STYLES[2]);
    expect(currentStyle(progressionAt(3, 0, 0))).toEqual(CUBE_STYLES[3]);
    expect(currentStyle(progressionAt(4, 0, 0))).toEqual(CUBE_STYLES[4]);
  });

  it('cycles the style ids across seven levels, wrapping after the fifth style', () => {
    let p = createProgression();
    const ids: string[] = [];
    for (let level = 0; level < 7; level += 1) {
      ids.push(currentStyle(p).id);
      p = advanceLevel(p);
    }

    expect(ids).toEqual([
      'obsidian-neon',
      'crimson-alloy',
      'emerald-crystal',
      'solar-gold',
      'violet-nebula',
      'obsidian-neon',
      'crimson-alloy',
    ]);
    expect(ids[4]).toBe('violet-nebula');
    expect(ids[5]).not.toBe(ids[4]);
  });
});

describe('recordClick', () => {
  it('increments clicks by exactly one and leaves everything else untouched', () => {
    const before = progressionAt(2, 3, 1);

    const after = recordClick(before);

    expect(after).toEqual({ levelIndex: 2, stats: { clicks: 4, facesDestroyed: 1 } });
    expect(after).not.toBe(before);
    expect(after.stats).not.toBe(before.stats);
    // Immutability: the input progression is unchanged.
    expect(before).toEqual({ levelIndex: 2, stats: { clicks: 3, facesDestroyed: 1 } });
  });

  it('accumulates one click per call', () => {
    let p = createProgression();
    p = recordClick(p);
    p = recordClick(p);
    p = recordClick(p);

    expect(p.stats).toEqual({ clicks: 3, facesDestroyed: 0 });
  });
});

describe('recordFaceDestroyed', () => {
  it('increments facesDestroyed by exactly one and leaves everything else untouched', () => {
    const before = progressionAt(4, 7, 2);

    const after = recordFaceDestroyed(before);

    expect(after).toEqual({ levelIndex: 4, stats: { clicks: 7, facesDestroyed: 3 } });
    expect(after).not.toBe(before);
    expect(after.stats).not.toBe(before.stats);
    expect(before).toEqual({ levelIndex: 4, stats: { clicks: 7, facesDestroyed: 2 } });
  });
});

describe('advanceLevel', () => {
  it('increments the level index and carries the stats over unchanged', () => {
    const before = progressionAt(0, 5, 2);

    const after = advanceLevel(before);

    expect(after).toEqual({ levelIndex: 1, stats: { clicks: 5, facesDestroyed: 2 } });
    expect(after.stats).toBe(before.stats);
    // Immutability: the input progression keeps its level.
    expect(before.levelIndex).toBe(0);
  });

  it('keeps both counters across several level advances and a full styling cycle', () => {
    let p = progressionAt(3, 11, 4);

    p = advanceLevel(p);
    p = advanceLevel(p);

    expect(p).toEqual({ levelIndex: 5, stats: { clicks: 11, facesDestroyed: 4 } });
    expect(currentStyle(p).id).toBe('obsidian-neon');

    const next = recordClick(recordFaceDestroyed(advanceLevel(p)));
    expect(next).toEqual({ levelIndex: 6, stats: { clicks: 12, facesDestroyed: 5 } });
    expect(currentStyle(next).id).toBe('crimson-alloy');
  });
});
