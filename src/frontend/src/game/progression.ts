/**
 * Level progression, session stats and cube styles (T4).
 *
 * Pure data + pure functions: no DOM, no three.js, no timers. This module is the
 * single home for the pinned style list (plan § Pinned style list) — consumers read
 * colors/materials from {@link CUBE_STYLES}, never redefine them locally.
 */

import { type CubeStyle, type EconomyState, type GameStats } from './types';

/**
 * The five cube-level styles, cycled in order (`levelIndex % CUBE_STYLES.length`).
 * Ids, palettes (`'#rrggbb'`), metalness and roughness are pinned by the plan and
 * asserted verbatim in `progression.test.ts`.
 */
export const CUBE_STYLES: readonly CubeStyle[] = [
  {
    id: 'obsidian-neon',
    name: 'Emerald Neon',
    cubeColor: '#0a2418',
    miniCubeColor: '#2ee27f',
    accentColor: '#b6ffd9',
    metalness: 0.3,
    roughness: 0.18,
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
];

/** Level index plus the cumulative session stats carried across cube levels. */
export interface Progression {
  levelIndex: number;
  stats: GameStats;
}

/** Fresh progression: level 0, counters seeded from `initialStats` (optional fields omitted when not supplied). */
export function createProgression(initialStats?: Partial<GameStats> | EconomyState): Progression {
  const stats: GameStats = {
    clicks: initialStats?.clicks ?? 0,
    facesDestroyed: initialStats?.facesDestroyed ?? 0,
  };
  if (initialStats?.cubesDestroyed !== undefined) {
    stats.cubesDestroyed = initialStats.cubesDestroyed;
  }
  if (initialStats?.coins !== undefined) {
    stats.coins = initialStats.coins;
  }
  return { levelIndex: 0, stats };
}

/** The style for the current level, cycling through {@link CUBE_STYLES} in order. */
export function currentStyle(p: Progression): CubeStyle {
  return CUBE_STYLES[p.levelIndex % CUBE_STYLES.length]!;
}

/** Immutable: `stats.clicks + 1`; level index and `facesDestroyed` untouched. */
export function recordClick(p: Progression): Progression {
  return { levelIndex: p.levelIndex, stats: { ...p.stats, clicks: p.stats.clicks + 1 } };
}

/** Immutable: `stats.facesDestroyed + 1`; level index and `clicks` untouched. */
export function recordFaceDestroyed(p: Progression): Progression {
  return { levelIndex: p.levelIndex, stats: { ...p.stats, facesDestroyed: p.stats.facesDestroyed + 1 } };
}

/** Rounds a coin value to 2 decimals (half-up). */
function roundCoins(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Immutable: `stats.coins + amount` (rounded to 2 decimals); other stats untouched. */
export function recordCoins(p: Progression, amount: number): Progression {
  const current = p.stats.coins ?? 0;
  return {
    levelIndex: p.levelIndex,
    stats: { ...p.stats, coins: roundCoins(current + amount) },
  };
}

/** Immutable: `stats.cubesDestroyed + 1`; other stats untouched. */
export function recordCubeDestroyed(p: Progression): Progression {
  const current = p.stats.cubesDestroyed ?? 0;
  return {
    levelIndex: p.levelIndex,
    stats: { ...p.stats, cubesDestroyed: current + 1 },
  };
}

/**
 * Immutable: `levelIndex + 1` with the stats carried over unchanged — the same
 * `stats` object, never a mutated or re-zeroed copy.
 */
export function advanceLevel(p: Progression): Progression {
  return { levelIndex: p.levelIndex + 1, stats: p.stats };
}
