/**
 * Level progression, session stats and cube styles (T4).
 *
 * Pure data + pure functions: no DOM, no three.js, no timers. This module is the
 * single home for the pinned style list (plan § Pinned style list) — consumers read
 * colors/materials from {@link CUBE_STYLES}, never redefine them locally.
 */

import { type CubeStyle, type GameStats } from './types';

/**
 * The five cube-level styles, cycled in order (`levelIndex % CUBE_STYLES.length`).
 * Ids, palettes (`'#rrggbb'`), metalness and roughness are pinned by the plan and
 * asserted verbatim in `progression.test.ts`.
 */
export const CUBE_STYLES: readonly CubeStyle[] = [
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
];

/** Level index plus the cumulative session stats carried across cube levels. */
export interface Progression {
  levelIndex: number;
  stats: GameStats;
}

/** Fresh progression: level 0, both counters at zero. */
export function createProgression(): Progression {
  return { levelIndex: 0, stats: { clicks: 0, facesDestroyed: 0 } };
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

/**
 * Immutable: `levelIndex + 1` with the stats carried over unchanged — the same
 * `stats` object, never a mutated or re-zeroed copy.
 */
export function advanceLevel(p: Progression): Progression {
  return { levelIndex: p.levelIndex + 1, stats: p.stats };
}
