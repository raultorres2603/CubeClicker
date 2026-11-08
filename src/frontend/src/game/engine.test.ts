import { describe, expect, it } from 'vitest';

import {
  createEngine,
  type AuthoritativeCubeState,
  type EffectIntent,
  type GameEngine,
  type OnlineGameEngine,
} from './engine';
import { createBurst, DEFAULT_TIMINGS, REDUCED_TIMINGS, type Timings } from './effects';
import { CUBE_STYLES } from './progression';
import { COINS_PER_CUBE, COINS_PER_MINI_CUBE, roundCoins, thresholdSeconds } from './economy';
import { cubeMultiplier, miniCubeMultiplier, speedWindowSeconds } from './upgrades';
import { FACE_IDS, GRID_SIZE, TRAVEL_DIRECTIONS, type FaceId, type MiniCubeId } from './types';

/**
 * The burst every default-profile explosion carries when the engine's random source is
 * the constant `0.5`: each of the 24 particles hits the degenerate-direction fallback
 * `(0, 0, 1)`, speed `1 + 0.5 * 2 = 2`, size `0.02 + 0.5 * 0.05 = 0.045`.
 */
const FLAT_BURST = {
  particles: Array.from({ length: 24 }, () => ({ dx: 0, dy: 0, dz: 1, speed: 2, size: 0.045 })),
  lifetimeMs: 350,
};

/** No fragments under reduced motion — the mini-cube is removed instantly. */
const EMPTY_BURST = { particles: [], lifetimeMs: 0 };

/** The engine's random source in most tests: every burst is {@link FLAT_BURST}. */
function flatRandom(): number {
  return 0.5;
}

/** Deterministic LCG so the injected random can be replayed in the expectation. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** A random source that counts how many draws were taken. */
function countingRandom(value: number): { random: () => number; draws: () => number } {
  let draws = 0;
  return {
    random: () => {
      draws += 1;
      return value;
    },
    draws: () => draws,
  };
}

/**
 * A random source over a fixed script: draws come back in order and any draw beyond the
 * script throws, so the test pins the exact number of draws the engine consumes.
 */
function scriptedRandom(values: readonly number[]): () => number {
  let index = 0;
  return () => {
    if (index >= values.length) {
      throw new Error(`unexpected random draw #${index + 1}`);
    }
    const value = values[index]!;
    index += 1;
    return value;
  };
}

/** Every id of one face of a `gridSize` grid, in board order (rows, then columns). */
function idsOfFace(faceId: FaceId, gridSize: number): MiniCubeId[] {
  return Array.from({ length: gridSize * gridSize }, (_, position): MiniCubeId => {
    return `${faceId}:${Math.floor(position / gridSize)}:${position % gridSize}`;
  });
}

/** Dispatches one explode per mini-cube of one face (the board shrinks; no advance). */
function clearFace(engine: GameEngine, faceId: FaceId, gridSize: number): void {
  for (const id of idsOfFace(faceId, gridSize)) {
    engine.dispatch({ type: 'explodeMiniCube', id });
  }
}

/** An explosion intent for one id of one face, in the default profile. */
function explosion(id: MiniCubeId, faceId: FaceId): EffectIntent {
  return { kind: 'explosion', id, faceId, burst: FLAT_BURST };
}

/** The burst an authoritative adoption replay carries: no particles, default lifetime. */
function replayExplosion(id: MiniCubeId, faceId: FaceId): EffectIntent {
  return { kind: 'explosion', id, faceId, burst: { particles: [], lifetimeMs: 350 } };
}

/**
 * The default profile with the sweep phases collapsed: rotations and the face fade settle
 * within one frame, so a test reaches `travel` deterministically while `travelMs` keeps the
 * pinned 2500 (midpoint 1250). Only the arrival timeline itself is under test.
 */
const ARRIVAL_TIMINGS: Timings = {
  ...DEFAULT_TIMINGS,
  rotationMs: 0,
  faceFadeMs: 0,
};

/**
 * Builds a flat-random engine, clears every mini-cube of every face and steps into
 * `travel`, returning the engine plus the intents produced by the sweep. Both profiles
 * under test settle a rotation instantly (`rotationMs` 0), and the face fade is advanced
 * explicitly so the caller's profile alone decides when `travel` starts.
 */
function sweepIntoTravel(
  timings: Timings,
  gridSize: number,
  options: { reducedMotion?: boolean } = {},
): { engine: GameEngine; startIntents: EffectIntent[] } {
  const engine = createEngine({ ...options, timings, gridSize, random: flatRandom });
  engine.dispatch({ type: 'introSkip' });
  for (const faceId of FACE_IDS) {
    for (const id of idsOfFace(faceId, gridSize)) {
      engine.dispatch({ type: 'explodeMiniCube', id });
    }
  }
  engine.advance(Math.max(1, timings.faceFadeMs));
  const startIntents = engine.drainIntents();
  return { engine, startIntents };
}

describe('createEngine — initial state', () => {
  it('starts in the intro on a full board with the first style and no intents', () => {
    const engine = createEngine({ random: flatRandom });
    const snapshot = engine.getSnapshot();

    expect(snapshot.phase).toBe('intro');
    expect(snapshot.phaseProgress).toBe(0);
    expect(snapshot.stats.clicks).toBe(0); expect(snapshot.stats.facesDestroyed).toBe(0); expect(snapshot.stats.coins).toBe(undefined); expect(snapshot.stats.cubesDestroyed).toBe(undefined);
    expect(snapshot.levelIndex).toBe(0);
    expect(snapshot.style).toBe(CUBE_STYLES[0]);
    expect(snapshot.style.id).toBe('obsidian-neon');
    expect(snapshot.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(snapshot.rotationFrom).toBeNull();
    expect(snapshot.rotationProgress).toBe(1);
    expect(snapshot.board.faces.map((face) => face.miniCubes.length)).toEqual([25, 25, 25, 25, 25, 25]);
    expect(snapshot.gridSize).toBe(5);
    expect(snapshot.travelDirection).toBeNull();
    expect(snapshot.reducedMotion).toBe(false);
    expect(engine.drainIntents()).toEqual([]);
  });

  it('honours the gridSize and reducedMotion options', () => {
    const engine = createEngine({ gridSize: 2, reducedMotion: true, random: flatRandom });
    const snapshot = engine.getSnapshot();

    expect(snapshot.board.faces.map((face) => face.miniCubes.length)).toEqual([4, 4, 4, 4, 4, 4]);
    expect(snapshot.reducedMotion).toBe(true);

    engine.advance(REDUCED_TIMINGS.introMs - 1);
    expect(engine.getSnapshot().phase).toBe('intro');
    engine.advance(1);
    expect(engine.getSnapshot().phase).toBe('playing');
  });

  it('accepts a whole injected timing profile', () => {
    const engine = createEngine({
      random: flatRandom,
      timings: { introMs: 0, travelMs: 20, rotationMs: 10, explosionMs: 5, faceFadeMs: 2 },
    });

    expect(engine.getSnapshot().phaseProgress).toBe(1);
    engine.advance(1);
    expect(engine.getSnapshot().phase).toBe('playing');
  });
});

describe('getSnapshot — referential stability (AC-11)', () => {
  it('returns the same object until a value changes', () => {
    const engine = createEngine({ random: flatRandom });
    const first = engine.getSnapshot();

    expect(engine.getSnapshot()).toBe(first);

    engine.dispatch({ type: 'introSkip' });
    const second = engine.getSnapshot();
    expect(second).not.toBe(first);
    expect(second.phase).toBe('playing');
    expect(engine.getSnapshot()).toBe(second);

    engine.dispatch({ type: 'explodeMiniCube', id: 'front:2:2' });
    const third = engine.getSnapshot();
    expect(third).not.toBe(second);
    expect(third.stats.clicks).toBe(1); expect(third.stats.facesDestroyed).toBe(0); expect(third.stats.coins).toBe(0.1); expect(third.stats.cubesDestroyed).toBe(undefined);
    expect(engine.getSnapshot()).toBe(third);

    // A frame with nothing to advance, and draining the queue, are not state changes.
    engine.advance(16);
    expect(engine.getSnapshot()).toBe(third);
    engine.drainIntents();
    expect(engine.getSnapshot()).toBe(third);
  });

  it('keeps the identity of untouched values across a snapshot change', () => {
    const engine = createEngine({ random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    const before = engine.getSnapshot();

    engine.setReducedMotion(true);

    const after = engine.getSnapshot();
    expect(after).not.toBe(before);
    expect(after.reducedMotion).toBe(true);
    expect(after.board).toBe(before.board);
    expect(after.stats).toBe(before.stats);
    expect(after.orientation).toBe(before.orientation);
  });
});

describe('intro phase (AC-2)', () => {
  it('progresses the intro flight and hands over to playing after the full duration', () => {
    const engine = createEngine({ random: flatRandom });

    engine.advance(DEFAULT_TIMINGS.introMs / 2);
    expect(engine.getSnapshot().phaseProgress).toBe(0.5);

    engine.advance(DEFAULT_TIMINGS.introMs / 2 - 1);
    expect(engine.getSnapshot().phase).toBe('intro');

    engine.advance(1);
    const snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.phaseProgress).toBe(1);
    expect(engine.drainIntents()).toEqual([]);
  });

  it('ignores every gameplay event during the intro', () => {
    const engine = createEngine({ random: flatRandom });
    const before = engine.getSnapshot();

    engine.dispatch({ type: 'explodeMiniCube', id: 'front:2:2' });
    engine.dispatch({ type: 'rotate', axis: 'yaw', direction: 1 });

    const after = engine.getSnapshot();
    expect(after).toBe(before);
    expect(after.stats.clicks).toBe(0); expect(after.stats.facesDestroyed).toBe(0); expect(after.stats.coins).toBe(undefined); expect(after.stats.cubesDestroyed).toBe(undefined);
    expect(after.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(engine.drainIntents()).toEqual([]);
  });

  it('skips the intro on introSkip and never returns to it', () => {
    const engine = createEngine({ random: flatRandom });

    engine.dispatch({ type: 'introSkip' });
    const snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.phaseProgress).toBe(1);

    engine.dispatch({ type: 'introSkip' });
    expect(engine.getSnapshot().phase).toBe('playing');
    expect(engine.drainIntents()).toEqual([]);
  });

  it('does nothing when no time passes', () => {
    const engine = createEngine({ random: flatRandom });
    const before = engine.getSnapshot();

    engine.advance(0);
    engine.advance(-16);

    expect(engine.getSnapshot()).toBe(before);
    expect(engine.getSnapshot().phase).toBe('intro');
  });
});

describe('clicks, stats and intents (AC-5, AC-11)', () => {
  it('removes the mini-cube, counts the click and drains one explosion intent', () => {
    const engine = createEngine({ random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    engine.dispatch({ type: 'explodeMiniCube', id: 'front:2:2' });

    const snapshot = engine.getSnapshot();
    expect(snapshot.stats.clicks).toBe(1); expect(snapshot.stats.facesDestroyed).toBe(0); expect(snapshot.stats.coins).toBe(0.1); expect(snapshot.stats.cubesDestroyed).toBe(undefined);
    expect(snapshot.board.faces[0]?.miniCubes).toHaveLength(24);
    expect(snapshot.board.faces[0]?.miniCubes.some((miniCube) => miniCube.id === 'front:2:2')).toBe(false);
    expect(engine.drainIntents()).toEqual([explosion('front:2:2', 'front')]);
    expect(engine.drainIntents()).toEqual([]);
  });

  it('treats a repeat click on the same id as a no-op', () => {
    const engine = createEngine({ random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });
    engine.drainIntents();
    const afterFirst = engine.getSnapshot();

    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });

    expect(engine.getSnapshot()).toBe(afterFirst);
    expect(engine.getSnapshot().stats.clicks).toBe(1); expect(engine.getSnapshot().stats.facesDestroyed).toBe(0); expect(engine.getSnapshot().stats.coins).toBe(0.1); expect(engine.getSnapshot().stats.cubesDestroyed).toBe(undefined);
    expect(engine.getSnapshot().board.faces[0]?.miniCubes).toHaveLength(24);
    expect(engine.drainIntents()).toEqual([]);
  });

  it('falls back to the pinned deterministic LCG when no random is injected', () => {
    // LCG(1) draw 0 = 0.23645552527159452 ⇒ level 0 has N = 3 + ⌊0.236… · 5⌋ = 4.
    const engine = createEngine();
    const initial = engine.getSnapshot();
    expect(initial.gridSize).toBe(4);
    expect(initial.board.faces.map((face) => face.miniCubes.length)).toEqual([
      16, 16, 16, 16, 16, 16,
    ]);

    engine.dispatch({ type: 'introSkip' });
    engine.dispatch({ type: 'explodeMiniCube', id: 'front:2:2' });

    const intents = engine.drainIntents();
    // The burst draws continue the same stream right after the level-0 grid draw.
    const replay = seededRandom(1);
    replay();
    expect(intents).toEqual([
      { kind: 'explosion', id: 'front:2:2', faceId: 'front', burst: createBurst(replay) },
    ]);
    if (intents[0]?.kind !== 'explosion') {
      throw new Error('expected one explosion intent');
    }
    expect(intents[0].burst.lifetimeMs).toBe(350);
    // The first and last fragments, pinned as literals (LCG(1) draws 1..120).
    expect(intents[0].burst.particles[0]).toEqual({
      dx: -0.5378154675194091,
      dy: 0.01745155926329477,
      dz: 0.8428819407106544,
      speed: 1.1010872572660446,
      size: 0.03847591771511361,
    });
    expect(intents[0].burst.particles[23]).toEqual({
      dx: 0.8868520991554909,
      dy: 0.39940894235590785,
      dz: 0.23230551218090914,
      speed: 1.9012028840370476,
      size: 0.05006719280965627,
    });
  });

  it('builds each burst from the injected random source, after the level-0 grid draw', () => {
    const replay = seededRandom(42);
    // LCG(42) draw 0 = 0.25234517478384078 ⇒ level 0 has N = 3 + ⌊0.252… · 5⌋ = 4.
    const firstDraw = replay();
    const engine = createEngine({ random: seededRandom(42) });
    expect(firstDraw).toBe(0.25234517478384078);
    expect(engine.getSnapshot().gridSize).toBe(4);

    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });

    // `replay` is already one draw ahead: the grid draw precedes the burst's 120 draws.
    const intents = engine.drainIntents();
    expect(intents).toEqual([
      { kind: 'explosion', id: 'front:0:0', faceId: 'front', burst: createBurst(replay) },
    ]);
    if (intents[0]?.kind !== 'explosion') {
      throw new Error('expected one explosion intent');
    }
    expect(intents[0].burst.particles).toHaveLength(24);
    expect(intents[0].burst.lifetimeMs).toBe(350);
  });
});

describe('per-level grid draws and travel directions (AC-1, AC-3)', () => {
  /** Clears every face of the level at `gridSize` (reduced motion: no burst draws). */
  function clearLevel(engine: GameEngine, gridSize: number): void {
    for (const faceId of FACE_IDS) {
      clearFace(engine, faceId, gridSize);
    }
  }

  it('pins the travel-direction order to the draw index', () => {
    expect(TRAVEL_DIRECTIONS).toEqual(['left', 'right', 'top', 'bottom']);
  });

  it('consumes exactly one draw at creation and one at each level advance', () => {
    const counter = countingRandom(0.5);
    const engine = createEngine({ random: counter.random, reducedMotion: true });

    expect(counter.draws()).toBe(1);
    expect(engine.getSnapshot().gridSize).toBe(5);

    engine.advance(REDUCED_TIMINGS.introMs);
    clearLevel(engine, 5);
    // Reduced motion emits no burst, so the whole clear consumes no draw at all.
    expect(counter.draws()).toBe(1);

    engine.advance(REDUCED_TIMINGS.faceFadeMs);
    expect(engine.getSnapshot().phase).toBe('travel');
    expect(counter.draws()).toBe(2);
    expect(engine.getSnapshot().travelDirection).toBe('top');

    engine.advance(REDUCED_TIMINGS.travelMs);
    expect(counter.draws()).toBe(3);
    expect(engine.getSnapshot().phase).toBe('playing');
    expect(engine.getSnapshot().gridSize).toBe(5);
  });

  it('skips every grid draw when the grid size is injected', () => {
    const counter = countingRandom(0.5);
    const engine = createEngine({ gridSize: 4, random: counter.random, reducedMotion: true });

    expect(counter.draws()).toBe(0);
    expect(engine.getSnapshot().gridSize).toBe(4);

    engine.advance(REDUCED_TIMINGS.introMs);
    clearLevel(engine, 4);
    engine.advance(REDUCED_TIMINGS.faceFadeMs);
    expect(counter.draws()).toBe(1);
    expect(engine.getSnapshot().travelDirection).toBe('top');

    engine.advance(REDUCED_TIMINGS.travelMs);
    expect(counter.draws()).toBe(1);
    expect(engine.getSnapshot().gridSize).toBe(4);
    expect(engine.getSnapshot().board.faces.map((face) => face.miniCubes.length)).toEqual([
      16, 16, 16, 16, 16, 16,
    ]);
  });

  it('draws N = 5 every level and the direction top from the constant draw 0.5', () => {
    const engine = createEngine({ random: flatRandom, reducedMotion: true });
    expect(engine.getSnapshot().gridSize).toBe(5);

    engine.advance(REDUCED_TIMINGS.introMs);
    clearLevel(engine, 5);
    engine.advance(REDUCED_TIMINGS.faceFadeMs);
    expect(engine.getSnapshot().travelDirection).toBe('top');

    engine.advance(REDUCED_TIMINGS.travelMs / 2);
    expect(engine.getSnapshot().levelIndex).toBe(1);
    expect(engine.getSnapshot().gridSize).toBe(5);
    expect(engine.getSnapshot().board.faces.map((face) => face.miniCubes.length)).toEqual([
      25, 25, 25, 25, 25, 25,
    ]);
    expect(engine.getSnapshot().travelDirection).toBe('top');

    engine.advance(REDUCED_TIMINGS.travelMs / 2);
    expect(engine.getSnapshot().phase).toBe('playing');
    expect(engine.getSnapshot().travelDirection).toBeNull();

    clearLevel(engine, 5);
    engine.advance(REDUCED_TIMINGS.faceFadeMs);
    expect(engine.getSnapshot().travelDirection).toBe('top');
    engine.advance(REDUCED_TIMINGS.travelMs);
    expect(engine.getSnapshot().levelIndex).toBe(2);
    expect(engine.getSnapshot().gridSize).toBe(5);
  });

  it('reports the level grid size in every phase and changes it exactly at the advance', () => {
    // Scripted draws: 0.1 → N = 3, 0.5 → `top`, 0.7 → N = 6. Any further draw throws.
    const engine = createEngine({ random: scriptedRandom([0.1, 0.5, 0.7]), reducedMotion: true });

    expect(engine.getSnapshot().phase).toBe('intro');
    expect(engine.getSnapshot().gridSize).toBe(3);
    expect(engine.getSnapshot().travelDirection).toBeNull();

    engine.advance(REDUCED_TIMINGS.introMs);
    expect(engine.getSnapshot().phase).toBe('playing');
    expect(engine.getSnapshot().gridSize).toBe(3);

    clearLevel(engine, 3);
    engine.advance(REDUCED_TIMINGS.faceFadeMs);
    expect(engine.getSnapshot().phase).toBe('travel');
    expect(engine.getSnapshot().gridSize).toBe(3);
    expect(engine.getSnapshot().travelDirection).toBe('top');

    engine.advance(REDUCED_TIMINGS.travelMs / 2);
    expect(engine.getSnapshot().phase).toBe('travel');
    expect(engine.getSnapshot().levelIndex).toBe(1);
    expect(engine.getSnapshot().gridSize).toBe(6);
    expect(engine.getSnapshot().board.faces.map((face) => face.miniCubes.length)).toEqual([
      36, 36, 36, 36, 36, 36,
    ]);
    expect(engine.getSnapshot().travelDirection).toBe('top');

    engine.advance(REDUCED_TIMINGS.travelMs / 2);
    expect(engine.getSnapshot().phase).toBe('playing');
    expect(engine.getSnapshot().gridSize).toBe(6);
    expect(engine.getSnapshot().travelDirection).toBeNull();
  });

  it('draws a pinned per-level grid and per-travel direction sequence (seed 19)', () => {
    // LCG(19) draws: 0.24343146895989776 → N = 4, 0.00193844665773213 → `left`,
    // 0.82899093441665173 → N = 7, 0.37117785005830228 → `right`, 0.04693626845255494 → N = 3.
    const engine = createEngine({ random: seededRandom(19), reducedMotion: true });
    expect(engine.getSnapshot().gridSize).toBe(4);

    engine.advance(REDUCED_TIMINGS.introMs);
    clearLevel(engine, 4);
    engine.advance(REDUCED_TIMINGS.faceFadeMs);
    expect(engine.getSnapshot().travelDirection).toBe('left');

    engine.advance(REDUCED_TIMINGS.travelMs / 2);
    expect(engine.getSnapshot().levelIndex).toBe(1);
    expect(engine.getSnapshot().gridSize).toBe(7);
    expect(engine.getSnapshot().travelDirection).toBe('left');

    engine.advance(REDUCED_TIMINGS.travelMs / 2);
    expect(engine.getSnapshot().phase).toBe('playing');
    expect(engine.getSnapshot().travelDirection).toBeNull();

    clearLevel(engine, 7);
    engine.advance(REDUCED_TIMINGS.faceFadeMs);
    expect(engine.getSnapshot().travelDirection).toBe('right');

    engine.advance(REDUCED_TIMINGS.travelMs);
    expect(engine.getSnapshot().levelIndex).toBe(2);
    expect(engine.getSnapshot().gridSize).toBe(3);
    expect(engine.getSnapshot().board.faces.map((face) => face.miniCubes.length)).toEqual([
      9, 9, 9, 9, 9, 9,
    ]);
  });

  it('redirects every subsequent draw through setRandomSource', () => {
    // The creation draw (0.1) gives N = 3 and would pick `left` (⌊0.1 · 4⌋ = 0).
    const engine = createEngine({ random: () => 0.1, reducedMotion: true });
    expect(engine.getSnapshot().gridSize).toBe(3);

    const beforeSwap = engine.getSnapshot();
    // 0.9 gives N = 7 and `bottom` (⌊0.9 · 4⌋ = 3) for every later draw.
    engine.setRandomSource(() => 0.9);
    expect(engine.getSnapshot()).toBe(beforeSwap);

    engine.advance(REDUCED_TIMINGS.introMs);
    clearLevel(engine, 3);
    engine.advance(REDUCED_TIMINGS.faceFadeMs);
    expect(engine.getSnapshot().travelDirection).toBe('bottom');

    engine.advance(REDUCED_TIMINGS.travelMs);
    expect(engine.getSnapshot().gridSize).toBe(7);
    expect(engine.getSnapshot().board.faces.map((face) => face.miniCubes.length)).toEqual([
      49, 49, 49, 49, 49, 49,
    ]);
  });
});

describe('rotation steps (AC-6 queue)', () => {
  it('animates one step over the rotation duration and settles on the target orientation', () => {
    const engine = createEngine({ random: flatRandom });
    engine.dispatch({ type: 'introSkip' });

    engine.dispatch({ type: 'rotate', axis: 'yaw', direction: 1 });

    let snapshot = engine.getSnapshot();
    expect(snapshot.orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });
    expect(snapshot.rotationFrom).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(snapshot.rotationProgress).toBe(0);

    engine.advance(DEFAULT_TIMINGS.rotationMs / 2);
    snapshot = engine.getSnapshot();
    expect(snapshot.rotationProgress).toBe(0.5);
    expect(snapshot.rotationFrom).toEqual({ yawSteps: 0, pitchSteps: 0 });

    engine.advance(DEFAULT_TIMINGS.rotationMs / 2);
    snapshot = engine.getSnapshot();
    expect(snapshot.orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });
    expect(snapshot.rotationFrom).toBeNull();
    expect(snapshot.rotationProgress).toBe(1);
  });

  it('queues at most one further step and ignores the rest', () => {
    const engine = createEngine({ random: flatRandom });
    engine.dispatch({ type: 'introSkip' });

    engine.dispatch({ type: 'rotate', axis: 'yaw', direction: 1 }); // starts animating
    engine.dispatch({ type: 'rotate', axis: 'yaw', direction: 1 }); // queued
    engine.dispatch({ type: 'rotate', axis: 'yaw', direction: 1 }); // ignored

    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });

    engine.advance(DEFAULT_TIMINGS.rotationMs);
    let snapshot = engine.getSnapshot();
    expect(snapshot.orientation).toEqual({ yawSteps: 2, pitchSteps: 0 });
    expect(snapshot.rotationFrom).toEqual({ yawSteps: 1, pitchSteps: 0 });
    expect(snapshot.rotationProgress).toBe(0);

    engine.advance(DEFAULT_TIMINGS.rotationMs);
    snapshot = engine.getSnapshot();
    expect(snapshot.orientation).toEqual({ yawSteps: 2, pitchSteps: 0 });
    expect(snapshot.rotationFrom).toBeNull();
  });

  it('clamps pitch at the poles', () => {
    const engine = createEngine({ random: flatRandom });
    engine.dispatch({ type: 'introSkip' });

    engine.dispatch({ type: 'rotate', axis: 'pitch', direction: 1 });
    engine.advance(DEFAULT_TIMINGS.rotationMs);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 0, pitchSteps: 1 });

    engine.dispatch({ type: 'rotate', axis: 'pitch', direction: 1 });
    engine.advance(DEFAULT_TIMINGS.rotationMs);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 0, pitchSteps: 1 });

    engine.dispatch({ type: 'rotate', axis: 'pitch', direction: -1 });
    engine.dispatch({ type: 'rotate', axis: 'pitch', direction: -1 });
    engine.advance(DEFAULT_TIMINGS.rotationMs);
    engine.advance(DEFAULT_TIMINGS.rotationMs);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 0, pitchSteps: -1 });
  });
});

describe('face destruction and auto-rotation (AC-9)', () => {
  it('counts the face, drains faceCleared and starts one auto-rotation step', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    clearFace(engine, 'front', 2);

    const snapshot = engine.getSnapshot();
    expect(snapshot.stats.clicks).toBe(4); expect(snapshot.stats.facesDestroyed).toBe(1); expect(snapshot.stats.coins).toBe(0.4); expect(snapshot.stats.cubesDestroyed).toBe(undefined);
    const intents = engine.drainIntents();
    expect(intents).toEqual([
      explosion('front:0:0', 'front'),
      explosion('front:0:1', 'front'),
      explosion('front:1:0', 'front'),
      explosion('front:1:1', 'front'),
      { kind: 'faceCleared', faceId: 'front' },
    ]);
    expect(snapshot.orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });
    expect(snapshot.rotationFrom).toEqual({ yawSteps: 0, pitchSteps: 0 });

    engine.advance(DEFAULT_TIMINGS.rotationMs);
    expect(engine.getSnapshot().rotationFrom).toBeNull();
    expect(engine.drainIntents()).toEqual([]);
  });

  it('does not auto-rotate when a non-front face is cleared', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });

    clearFace(engine, 'left', 2);
    clearFace(engine, 'right', 2);

    const snapshot = engine.getSnapshot();
    expect(snapshot.stats.clicks).toBe(8); expect(snapshot.stats.facesDestroyed).toBe(2); expect(snapshot.stats.coins).toBe(0.8); expect(snapshot.stats.cubesDestroyed).toBe(undefined);
    expect(snapshot.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(snapshot.rotationFrom).toBeNull();
  });

  it('re-evaluates the target after each step until the front face has mini-cubes', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    for (const faceId of ['left', 'right', 'top', 'bottom'] as const) {
      clearFace(engine, faceId, 2);
    }
    expect(engine.getSnapshot().stats.clicks).toBe(16); expect(engine.getSnapshot().stats.facesDestroyed).toBe(4); expect(engine.getSnapshot().stats.coins).toBe(1.6); expect(engine.getSnapshot().stats.cubesDestroyed).toBe(undefined);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    engine.drainIntents();

    clearFace(engine, 'front', 2);

    // Only `back` remains: one step takes the front to the empty `left` face, so the
    // next step is evaluated after the first one settles.
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });
    engine.advance(DEFAULT_TIMINGS.rotationMs);
    let snapshot = engine.getSnapshot();
    expect(snapshot.orientation).toEqual({ yawSteps: 2, pitchSteps: 0 });
    expect(snapshot.rotationFrom).toEqual({ yawSteps: 1, pitchSteps: 0 });

    engine.advance(DEFAULT_TIMINGS.rotationMs);
    snapshot = engine.getSnapshot();
    expect(snapshot.orientation).toEqual({ yawSteps: 2, pitchSteps: 0 });
    expect(snapshot.rotationFrom).toBeNull();
    expect(snapshot.stats.clicks).toBe(20); expect(snapshot.stats.facesDestroyed).toBe(5); expect(snapshot.stats.coins).toBe(2); expect(snapshot.stats.cubesDestroyed).toBe(undefined);
  });

  it('breaks a nearest-face tie with FACE_IDS order', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    for (const faceId of ['back', 'right', 'bottom'] as const) {
      clearFace(engine, faceId, 2);
    }

    clearFace(engine, 'front', 2);

    // `left` and `top` are both one step away; `left` comes first in FACE_IDS.
    const snapshot = engine.getSnapshot();
    expect(snapshot.orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });

    engine.advance(DEFAULT_TIMINGS.rotationMs);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });
  });

  it('auto-rotates the shortest way round the yaw seam', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    for (const faceId of ['back', 'left', 'top', 'bottom'] as const) {
      clearFace(engine, faceId, 2);
    }

    clearFace(engine, 'front', 2);

    // Only `right` remains: one step back (yaw 3) is shorter than three steps forward.
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 3, pitchSteps: 0 });

    engine.advance(DEFAULT_TIMINGS.rotationMs);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 3, pitchSteps: 0 });
    expect(engine.getSnapshot().rotationFrom).toBeNull();
  });

  it('auto-rotates onto a pole face when only a pole has mini-cubes left', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    for (const faceId of ['back', 'left', 'right', 'bottom'] as const) {
      clearFace(engine, faceId, 2);
    }

    clearFace(engine, 'front', 2);

    // `top` is reachable in one pitch step; yaw is left untouched.
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 0, pitchSteps: 1 });

    engine.advance(DEFAULT_TIMINGS.rotationMs);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 0, pitchSteps: 1 });
    expect(engine.getSnapshot().rotationFrom).toBeNull();
  });
});

describe('travel and level progression (AC-10)', () => {
  it('clears a whole cube level, travels and rebuilds the next styled cube', () => {
    const engine = createEngine({ random: flatRandom });

    engine.advance(DEFAULT_TIMINGS.introMs);
    expect(engine.getSnapshot().phase).toBe('playing');

    clearFace(engine, 'front', GRID_SIZE);
    engine.advance(DEFAULT_TIMINGS.rotationMs);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });

    clearFace(engine, 'left', GRID_SIZE);
    engine.advance(DEFAULT_TIMINGS.rotationMs);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 2, pitchSteps: 0 });

    clearFace(engine, 'back', GRID_SIZE);
    engine.advance(DEFAULT_TIMINGS.rotationMs);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 3, pitchSteps: 0 });

    clearFace(engine, 'right', GRID_SIZE);
    engine.advance(DEFAULT_TIMINGS.rotationMs);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 3, pitchSteps: 1 });

    clearFace(engine, 'top', GRID_SIZE);
    engine.advance(DEFAULT_TIMINGS.rotationMs);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 3, pitchSteps: -1 });
    expect(engine.getSnapshot().rotationFrom).toEqual({ yawSteps: 3, pitchSteps: 0 });
    engine.advance(DEFAULT_TIMINGS.rotationMs);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 3, pitchSteps: -1 });
    expect(engine.getSnapshot().rotationFrom).toBeNull();

    clearFace(engine, 'bottom', GRID_SIZE);

    let snapshot = engine.getSnapshot();
    expect(snapshot.orientation).toEqual({ yawSteps: 3, pitchSteps: -1 });
    expect(snapshot.stats.clicks).toBe(150); expect(snapshot.stats.facesDestroyed).toBe(6); expect(snapshot.stats.coins).toBe(25); expect(snapshot.stats.cubesDestroyed).toBe(1);
    expect(snapshot.phase).toBe('playing');

    const levelIntents = engine.drainIntents();
    expect(levelIntents).toHaveLength(156);
    expect(levelIntents[0]).toEqual(explosion('front:0:0', 'front'));
    expect(levelIntents[154]).toEqual(explosion('bottom:4:4', 'bottom'));
    expect(levelIntents[155]).toEqual({ kind: 'faceCleared', faceId: 'bottom' });

    // The sixth clear keeps the phase in `playing` for FACE_FADE_MS, then travels.
    engine.advance(DEFAULT_TIMINGS.faceFadeMs - 1);
    expect(engine.getSnapshot().phase).toBe('playing');
    expect(engine.drainIntents()).toEqual([]);

    engine.advance(1);
    snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('travel');
    expect(snapshot.phaseProgress).toBe(0);
    expect(engine.drainIntents()).toEqual([{ kind: 'travelStarted' }]);

    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });
    engine.dispatch({ type: 'rotate', axis: 'yaw', direction: 1 });
    engine.dispatch({ type: 'introSkip' });
    snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('travel');
    expect(snapshot.stats.clicks).toBe(150); expect(snapshot.stats.facesDestroyed).toBe(6); expect(snapshot.stats.coins).toBe(25); expect(snapshot.stats.cubesDestroyed).toBe(1);
    expect(snapshot.orientation).toEqual({ yawSteps: 3, pitchSteps: -1 });
    expect(engine.drainIntents()).toEqual([]);

    engine.advance(DEFAULT_TIMINGS.travelMs / 2);
    expect(engine.getSnapshot().phaseProgress).toBe(0.5);
    engine.advance(DEFAULT_TIMINGS.travelMs / 2);

    snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.phaseProgress).toBe(1);
    expect(snapshot.levelIndex).toBe(1);
    expect(snapshot.style).toBe(CUBE_STYLES[1]);
    expect(snapshot.style.id).toBe('crimson-alloy');
    expect(snapshot.stats.clicks).toBe(150); expect(snapshot.stats.facesDestroyed).toBe(6); expect(snapshot.stats.coins).toBe(25); expect(snapshot.stats.cubesDestroyed).toBe(1);
    expect(snapshot.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(snapshot.rotationFrom).toBeNull();
    expect(snapshot.board.faces.map((face) => face.miniCubes.length)).toEqual([25, 25, 25, 25, 25, 25]);
    expect(engine.drainIntents()).toEqual([{ kind: 'levelChanged', style: CUBE_STYLES[1] }]);

    // The second level plays like the first, with the carried-over stats.
    clearFace(engine, 'front', GRID_SIZE);
    expect(engine.getSnapshot().stats.clicks).toBe(175); expect(engine.getSnapshot().stats.facesDestroyed).toBe(7); expect(engine.getSnapshot().stats.coins).toBe(27.5); expect(engine.getSnapshot().stats.cubesDestroyed).toBe(1);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });
    engine.advance(DEFAULT_TIMINGS.rotationMs);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });
    expect(engine.getSnapshot().rotationFrom).toBeNull();
  });
});

describe('travel arrival — the level advances at the midpoint (AC-3)', () => {
  it('drains nothing and keeps the old level through the first 1249 ms of travel', () => {
    const { engine } = sweepIntoTravel(ARRIVAL_TIMINGS, GRID_SIZE);

    engine.advance(1249);

    const snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('travel');
    expect(snapshot.phaseProgress).toBe(1249 / 2500);
    expect(snapshot.levelIndex).toBe(0);
    expect(snapshot.style).toBe(CUBE_STYLES[0]);
    expect(snapshot.stats.clicks).toBe(150); expect(snapshot.stats.facesDestroyed).toBe(6); expect(snapshot.stats.coins).toBe(25); expect(snapshot.stats.cubesDestroyed).toBe(1);
    expect(engine.drainIntents()).toEqual([]);
  });

  it('advances exactly one level at 1250 ms while the phase is still travel', () => {
    const { engine } = sweepIntoTravel(ARRIVAL_TIMINGS, GRID_SIZE);

    engine.advance(1249);
    engine.advance(1);

    const snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('travel');
    expect(snapshot.phaseProgress).toBe(0.5);
    expect(snapshot.levelIndex).toBe(1);
    expect(snapshot.style).toBe(CUBE_STYLES[1]);
    expect(snapshot.style.id).toBe('crimson-alloy');
    expect(snapshot.stats.clicks).toBe(150); expect(snapshot.stats.facesDestroyed).toBe(6); expect(snapshot.stats.coins).toBe(25); expect(snapshot.stats.cubesDestroyed).toBe(1);
    expect(snapshot.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(snapshot.rotationFrom).toBeNull();
    expect(snapshot.rotationProgress).toBe(1);
    expect(snapshot.board.faces.map((face) => face.miniCubes.length)).toEqual([25, 25, 25, 25, 25, 25]);
    expect(engine.drainIntents()).toEqual([{ kind: 'levelChanged', style: CUBE_STYLES[1] }]);
  });

  it('switches to playing at 2500 ms without a second levelChanged', () => {
    const { engine } = sweepIntoTravel(ARRIVAL_TIMINGS, GRID_SIZE);

    engine.advance(1250);
    expect(engine.drainIntents()).toEqual([{ kind: 'levelChanged', style: CUBE_STYLES[1] }]);

    engine.advance(1250);

    const snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.phaseProgress).toBe(1);
    expect(snapshot.levelIndex).toBe(1);
    expect(snapshot.style).toBe(CUBE_STYLES[1]);
    expect(engine.drainIntents()).toEqual([]);
  });

  it('fires the level advance first and then the phase switch on a single 2500 ms advance', () => {
    const { engine } = sweepIntoTravel(ARRIVAL_TIMINGS, GRID_SIZE);

    engine.advance(2500);

    // One crossing only: the level intent is produced while `travel`, then `playing` begins.
    expect(engine.drainIntents()).toEqual([{ kind: 'levelChanged', style: CUBE_STYLES[1] }]);
    const snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.levelIndex).toBe(1);
    expect(snapshot.style).toBe(CUBE_STYLES[1]);
    expect(snapshot.stats.clicks).toBe(150); expect(snapshot.stats.facesDestroyed).toBe(6); expect(snapshot.stats.coins).toBe(25); expect(snapshot.stats.cubesDestroyed).toBe(1);
  });

  it('follows the reduced timeline: 74 nothing, 75 levelChanged, 150 playing', () => {
    const { engine } = sweepIntoTravel(REDUCED_TIMINGS, 1, { reducedMotion: true });

    engine.advance(74);
    let snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('travel');
    expect(snapshot.levelIndex).toBe(0);
    expect(snapshot.style).toBe(CUBE_STYLES[0]);
    expect(engine.drainIntents()).toEqual([]);

    engine.advance(1);
    snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('travel');
    expect(snapshot.levelIndex).toBe(1);
    expect(snapshot.style).toBe(CUBE_STYLES[1]);
    expect(snapshot.stats.clicks).toBe(6); expect(snapshot.stats.facesDestroyed).toBe(6); expect(snapshot.stats.coins).toBe(10.6); expect(snapshot.stats.cubesDestroyed).toBe(1);
    expect(snapshot.board.faces.map((face) => face.miniCubes.length)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(engine.drainIntents()).toEqual([{ kind: 'levelChanged', style: CUBE_STYLES[1] }]);

    engine.advance(75);
    snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.levelIndex).toBe(1);
    expect(engine.drainIntents()).toEqual([]);
  });

  it('never refires the level advance while the arrival half runs on', () => {
    const { engine } = sweepIntoTravel(ARRIVAL_TIMINGS, GRID_SIZE);

    engine.advance(1250);
    expect(engine.drainIntents()).toEqual([{ kind: 'levelChanged', style: CUBE_STYLES[1] }]);

    engine.advance(100);
    engine.advance(100);
    engine.advance(300);
    engine.advance(300);

    expect(engine.getSnapshot().phase).toBe('travel');
    expect(engine.getSnapshot().levelIndex).toBe(1);
    expect(engine.drainIntents()).toEqual([]);
  });

  it('advances at once when the injected travel duration makes the midpoint zero', () => {
    const zeroTravel: Timings = { ...DEFAULT_TIMINGS, rotationMs: 0, faceFadeMs: 0, travelMs: 0 };
    const { engine } = sweepIntoTravel(zeroTravel, 1);

    engine.advance(1);

    const snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.levelIndex).toBe(1);
    expect(snapshot.style).toBe(CUBE_STYLES[1]);
    expect(snapshot.board.faces.map((face) => face.miniCubes.length)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(engine.drainIntents()).toEqual([{ kind: 'levelChanged', style: CUBE_STYLES[1] }]);
  });

  it('gates every input during the arrival half', () => {
    const { engine } = sweepIntoTravel(ARRIVAL_TIMINGS, GRID_SIZE);
    engine.advance(1250);
    engine.drainIntents();
    const before = engine.getSnapshot();

    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });
    engine.dispatch({ type: 'rotate', axis: 'yaw', direction: 1 });
    engine.dispatch({ type: 'introSkip' });

    const after = engine.getSnapshot();
    expect(after).toBe(before);
    expect(after.phase).toBe('travel');
    expect(after.stats.clicks).toBe(150); expect(after.stats.facesDestroyed).toBe(6); expect(after.stats.coins).toBe(25); expect(after.stats.cubesDestroyed).toBe(1);
    expect(after.board.faces.map((face) => face.miniCubes.length)).toEqual([25, 25, 25, 25, 25, 25]);
    expect(after.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(after.rotationFrom).toBeNull();
    expect(engine.drainIntents()).toEqual([]);
  });

  it('drains exactly one travelStarted at travel start', () => {
    const { engine, startIntents } = sweepIntoTravel(ARRIVAL_TIMINGS, 1);

    expect(startIntents).toHaveLength(13);
    expect(startIntents[11]).toEqual({ kind: 'faceCleared', faceId: 'bottom' });
    expect(startIntents[12]).toEqual({ kind: 'travelStarted' });
    expect(engine.getSnapshot().phase).toBe('travel');
    expect(engine.drainIntents()).toEqual([]);
  });

  it('ignores non-positive time during travel', () => {
    const { engine } = sweepIntoTravel(ARRIVAL_TIMINGS, GRID_SIZE);
    const before = engine.getSnapshot();

    engine.advance(0);
    engine.advance(-16);

    expect(engine.getSnapshot()).toBe(before);
    expect(engine.getSnapshot().phase).toBe('travel');
    expect(engine.getSnapshot().levelIndex).toBe(0);
    expect(engine.drainIntents()).toEqual([]);
  });
});

describe('reduced motion (AC-12)', () => {
  it('collapses the phases, the rotation and the explosion burst', () => {
    const engine = createEngine({ reducedMotion: true, random: flatRandom });

    engine.advance(REDUCED_TIMINGS.introMs);
    expect(engine.getSnapshot().phase).toBe('playing');

    engine.dispatch({ type: 'rotate', axis: 'yaw', direction: 1 });
    const rotated = engine.getSnapshot();
    expect(rotated.orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });
    expect(rotated.rotationFrom).toBeNull();
    expect(rotated.rotationProgress).toBe(1);
    expect(rotated.reducedMotion).toBe(true);

    engine.drainIntents();
    engine.dispatch({ type: 'explodeMiniCube', id: 'left:2:2' });

    expect(engine.getSnapshot().stats.clicks).toBe(1); expect(engine.getSnapshot().stats.facesDestroyed).toBe(0); expect(engine.getSnapshot().stats.coins).toBe(0.1); expect(engine.getSnapshot().stats.cubesDestroyed).toBe(undefined);
    expect(engine.drainIntents()).toEqual([
      { kind: 'explosion', id: 'left:2:2', faceId: 'left', burst: EMPTY_BURST },
    ]);
  });

  it('completes a whole face clear with the instant auto-rotation', () => {
    const engine = createEngine({ reducedMotion: true, gridSize: 2, random: flatRandom });
    engine.advance(REDUCED_TIMINGS.introMs);
    engine.drainIntents();

    clearFace(engine, 'front', 2);

    const snapshot = engine.getSnapshot();
    expect(snapshot.stats.clicks).toBe(4); expect(snapshot.stats.facesDestroyed).toBe(1); expect(snapshot.stats.coins).toBe(0.4); expect(snapshot.stats.cubesDestroyed).toBe(undefined);
    expect(snapshot.orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });
    expect(snapshot.rotationFrom).toBeNull();
    expect(snapshot.rotationProgress).toBe(1);
    expect(engine.drainIntents()).toEqual([
      { kind: 'explosion', id: 'front:0:0', faceId: 'front', burst: EMPTY_BURST },
      { kind: 'explosion', id: 'front:0:1', faceId: 'front', burst: EMPTY_BURST },
      { kind: 'explosion', id: 'front:1:0', faceId: 'front', burst: EMPTY_BURST },
      { kind: 'explosion', id: 'front:1:1', faceId: 'front', burst: EMPTY_BURST },
      { kind: 'faceCleared', faceId: 'front' },
    ]);
  });

  it('travels to the next level with the reduced durations', () => {
    const engine = createEngine({ reducedMotion: true, gridSize: 1, random: flatRandom });
    engine.advance(REDUCED_TIMINGS.introMs);
    for (const faceId of FACE_IDS) {
      engine.dispatch({ type: 'explodeMiniCube', id: `${faceId}:0:0` });
    }
    engine.drainIntents();

    expect(engine.getSnapshot().stats.clicks).toBe(6); expect(engine.getSnapshot().stats.facesDestroyed).toBe(6); expect(engine.getSnapshot().stats.coins).toBe(10.6); expect(engine.getSnapshot().stats.cubesDestroyed).toBe(1);
    expect(engine.getSnapshot().phase).toBe('playing');
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 1, pitchSteps: -1 });

    engine.advance(REDUCED_TIMINGS.faceFadeMs - 1);
    expect(engine.getSnapshot().phase).toBe('playing');
    engine.advance(1);
    expect(engine.getSnapshot().phase).toBe('travel');
    expect(engine.drainIntents()).toEqual([{ kind: 'travelStarted' }]);

    engine.advance(REDUCED_TIMINGS.travelMs);
    const snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.levelIndex).toBe(1);
    expect(snapshot.style.id).toBe('crimson-alloy');
    expect(snapshot.stats.clicks).toBe(6); expect(snapshot.stats.facesDestroyed).toBe(6); expect(snapshot.stats.coins).toBe(10.6); expect(snapshot.stats.cubesDestroyed).toBe(1);
    expect(snapshot.board.faces.map((face) => face.miniCubes.length)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('switches profiles live and collapses a rotation already in flight', () => {
    const engine = createEngine({ random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.dispatch({ type: 'rotate', axis: 'yaw', direction: 1 });
    engine.advance(100);

    expect(engine.getSnapshot().rotationProgress).toBe(100 / 300);

    engine.setReducedMotion(true);
    const collapsed = engine.getSnapshot();
    expect(collapsed.reducedMotion).toBe(true);
    expect(collapsed.orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });
    expect(collapsed.rotationFrom).toBeNull();
    expect(collapsed.rotationProgress).toBe(1);

    engine.setReducedMotion(true);
    expect(engine.getSnapshot()).toBe(collapsed);

    engine.setReducedMotion(false);
    expect(engine.getSnapshot().reducedMotion).toBe(false);
    engine.dispatch({ type: 'rotate', axis: 'yaw', direction: 1 });
    expect(engine.getSnapshot().rotationProgress).toBe(0);
    engine.advance(DEFAULT_TIMINGS.rotationMs);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 2, pitchSteps: 0 });
  });

  it('applies the reduced profile to an intro already running', () => {
    const engine = createEngine({ random: flatRandom });
    engine.advance(1000);
    expect(engine.getSnapshot().phaseProgress).toBe(0.4);

    engine.setReducedMotion(true);
    engine.advance(50);

    expect(engine.getSnapshot().phase).toBe('playing');
  });
});

/**
 * Builds an online engine, clears every mini-cube and steps into `travel`, returning the
 * engine plus the intents produced by the sweep. The face fade is advanced explicitly so
 * the caller's profile alone decides when the online hold begins.
 */
function sweepOnlineIntoTravel(
  timings: Timings,
  gridSize: number,
  options: { reducedMotion?: boolean } = {},
): { engine: OnlineGameEngine; startIntents: EffectIntent[] } {
  const engine = createEngine({ ...options, online: true, timings, gridSize, random: flatRandom });
  engine.dispatch({ type: 'introSkip' });
  for (const faceId of FACE_IDS) {
    for (const id of idsOfFace(faceId, gridSize)) {
      engine.dispatch({ type: 'explodeMiniCube', id });
    }
  }
  engine.advance(Math.max(1, timings.faceFadeMs));
  const startIntents = engine.drainIntents();
  return { engine, startIntents };
}

describe('online mode — the level advance holds for the server (AC-14, AC-23)', () => {
  it('holds in travel at progress 0 with no travelStarted and keeps the finished level', () => {
    const { engine, startIntents } = sweepOnlineIntoTravel(ARRIVAL_TIMINGS, GRID_SIZE);

    const held = engine.getSnapshot();
    expect(held.phase).toBe('travel');
    expect(held.phaseProgress).toBe(0);
    expect(held.levelIndex).toBe(0);
    expect(held.gridSize).toBe(GRID_SIZE);
    expect(held.style).toBe(CUBE_STYLES[0]);
    expect(held.stats.clicks).toBe(150); expect(held.stats.facesDestroyed).toBe(6); expect(held.stats.coins).toBe(25); expect(held.stats.cubesDestroyed).toBe(1);
    expect(held.travelDirection).toBeNull();
    expect(held.travelKind).toBe('nextLevel');
    expect(held.travelDestination).toBeNull();
    expect(held.spectating).toBe(false);
    expect(startIntents.filter((intent) => intent.kind === 'travelStarted')).toEqual([]);
    expect(startIntents[startIntents.length - 1]).toEqual({ kind: 'faceCleared', faceId: 'bottom' });

    engine.advance(10_000);

    expect(engine.getSnapshot()).toBe(held);
    expect(engine.drainIntents()).toEqual([]);
  });

  it('releases once with travelStarted and advances at the midpoint with the server cube', () => {
    const { engine } = sweepOnlineIntoTravel(ARRIVAL_TIMINGS, GRID_SIZE);
    engine.drainIntents();

    engine.completeNextLevel({ gridSize: 3, style: CUBE_STYLES[4]!, destination: { x: 24, y: 0 } });

    let snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('travel');
    expect(snapshot.phaseProgress).toBe(0);
    expect(snapshot.travelKind).toBe('nextLevel');
    expect(snapshot.travelDestination).toEqual({ x: 24, y: 0 });
    expect(snapshot.levelIndex).toBe(0);
    expect(snapshot.gridSize).toBe(GRID_SIZE);
    expect(engine.drainIntents()).toEqual([{ kind: 'travelStarted' }]);
    const destination = snapshot.travelDestination;

    // Duplicate data before the midpoint neither re-fires travelStarted nor moves the clock.
    engine.completeNextLevel({ gridSize: 6, style: CUBE_STYLES[1]!, destination: { x: -24, y: 0 } });
    expect(engine.getSnapshot()).toBe(snapshot);
    expect(engine.drainIntents()).toEqual([]);

    engine.advance(1249);
    snapshot = engine.getSnapshot();
    expect(snapshot.phaseProgress).toBe(1249 / 2500);
    expect(snapshot.levelIndex).toBe(0);
    expect(snapshot.travelDestination).toBe(destination);
    expect(engine.drainIntents()).toEqual([]);

    engine.advance(1);
    snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('travel');
    expect(snapshot.phaseProgress).toBe(0.5);
    expect(snapshot.levelIndex).toBe(1);
    expect(snapshot.gridSize).toBe(3);
    expect(snapshot.style).toBe(CUBE_STYLES[4]);
    expect(snapshot.style.id).toBe('violet-nebula');
    expect(snapshot.stats.clicks).toBe(150); expect(snapshot.stats.facesDestroyed).toBe(6); expect(snapshot.stats.coins).toBe(25); expect(snapshot.stats.cubesDestroyed).toBe(1);
    expect(snapshot.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(snapshot.rotationFrom).toBeNull();
    expect(snapshot.travelDestination).toBe(destination);
    expect(snapshot.board.faces.map((face) => face.miniCubes.length)).toEqual([9, 9, 9, 9, 9, 9]);
    expect(engine.drainIntents()).toEqual([{ kind: 'levelChanged', style: CUBE_STYLES[4] }]);

    // Late data for the same travel is stale: the level advanced exactly once.
    engine.completeNextLevel({ gridSize: 7, style: CUBE_STYLES[2]!, destination: { x: 1, y: 2 } });
    expect(engine.getSnapshot()).toBe(snapshot);
    expect(engine.drainIntents()).toEqual([]);

    engine.advance(1250);
    snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.phaseProgress).toBe(1);
    expect(snapshot.levelIndex).toBe(1);
    expect(snapshot.gridSize).toBe(3);
    expect(snapshot.style).toBe(CUBE_STYLES[4]);
    expect(snapshot.travelKind).toBeNull();
    expect(snapshot.travelDestination).toBeNull();
    expect(snapshot.travelDirection).toBeNull();
    expect(snapshot.stats.clicks).toBe(150); expect(snapshot.stats.facesDestroyed).toBe(6); expect(snapshot.stats.coins).toBe(25); expect(snapshot.stats.cubesDestroyed).toBe(1);
    expect(engine.drainIntents()).toEqual([]);
  });

  it('advances exactly once on a single advance that crosses the whole released travel', () => {
    const { engine } = sweepOnlineIntoTravel(ARRIVAL_TIMINGS, GRID_SIZE);
    engine.drainIntents();
    engine.completeNextLevel({ gridSize: 4, style: CUBE_STYLES[2]!, destination: { x: 0, y: 24 } });
    engine.drainIntents();

    engine.advance(2500);

    const snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.levelIndex).toBe(1);
    expect(snapshot.gridSize).toBe(4);
    expect(snapshot.style).toBe(CUBE_STYLES[2]);
    expect(snapshot.board.faces.map((face) => face.miniCubes.length)).toEqual([
      16, 16, 16, 16, 16, 16,
    ]);
    expect(engine.drainIntents()).toEqual([{ kind: 'levelChanged', style: CUBE_STYLES[2] }]);
  });

  it('keeps server data that arrives during the face fade and releases after it', () => {
    const engine = createEngine({ online: true, gridSize: GRID_SIZE, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();
    for (const faceId of FACE_IDS) {
      clearFace(engine, faceId, GRID_SIZE);
    }
    engine.drainIntents();

    expect(engine.getSnapshot().phase).toBe('playing');

    // A spectate request during the face fade is ignored: the pending level advance wins.
    const fading = engine.getSnapshot();
    engine.dispatch({ type: 'travelTo', kind: 'spectate', destination: { x: 1, y: 1 } });
    expect(engine.getSnapshot()).toBe(fading);

    engine.completeNextLevel({ gridSize: 6, style: CUBE_STYLES[3]!, destination: { x: -24, y: 0 } });
    const duringFade = engine.getSnapshot();
    expect(duringFade.phase).toBe('playing');
    expect(duringFade.travelKind).toBeNull();
    // A duplicate during the fade is ignored too.
    engine.completeNextLevel({ gridSize: 3, style: CUBE_STYLES[0]!, destination: { x: 0, y: 0 } });
    expect(engine.getSnapshot()).toBe(duringFade);
    expect(engine.drainIntents()).toEqual([]);

    engine.advance(DEFAULT_TIMINGS.faceFadeMs);

    let snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('travel');
    expect(snapshot.phaseProgress).toBe(0);
    expect(snapshot.travelKind).toBe('nextLevel');
    expect(snapshot.travelDestination).toEqual({ x: -24, y: 0 });
    expect(engine.drainIntents()).toEqual([{ kind: 'travelStarted' }]);

    engine.advance(DEFAULT_TIMINGS.travelMs);

    snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.levelIndex).toBe(1);
    expect(snapshot.gridSize).toBe(6);
    expect(snapshot.style).toBe(CUBE_STYLES[3]);
    expect(snapshot.board.faces.map((face) => face.miniCubes.length)).toEqual([
      36, 36, 36, 36, 36, 36,
    ]);
    expect(engine.drainIntents()).toEqual([{ kind: 'levelChanged', style: CUBE_STYLES[3] }]);
  });

  it('never draws a local grid or direction in online mode', () => {
    const counter = countingRandom(0.9);
    const engine = createEngine({
      online: true,
      gridSize: GRID_SIZE,
      reducedMotion: true,
      random: counter.random,
    });
    engine.dispatch({ type: 'introSkip' });
    for (const faceId of FACE_IDS) {
      clearFace(engine, faceId, GRID_SIZE);
    }

    engine.advance(REDUCED_TIMINGS.faceFadeMs);
    expect(engine.getSnapshot().phase).toBe('travel');
    expect(counter.draws()).toBe(0);

    engine.completeNextLevel({ gridSize: 7, style: CUBE_STYLES[4]!, destination: { x: 24, y: 24 } });
    engine.advance(REDUCED_TIMINGS.travelMs);

    expect(counter.draws()).toBe(0);
    const snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.levelIndex).toBe(1);
    expect(snapshot.gridSize).toBe(7);
    expect(snapshot.style).toBe(CUBE_STYLES[4]);
    expect(snapshot.board.faces.map((face) => face.miniCubes.length)).toEqual([
      49, 49, 49, 49, 49, 49,
    ]);
  });

  it('ignores completeNextLevel when no online advance is waiting for it', () => {
    const offline = createEngine({ gridSize: GRID_SIZE, random: flatRandom });
    const offlineSnapshot = offline.getSnapshot();
    offline.completeNextLevel({ gridSize: 3, style: CUBE_STYLES[1]!, destination: { x: 24, y: 0 } });
    expect(offline.getSnapshot()).toBe(offlineSnapshot);
    expect(offline.drainIntents()).toEqual([]);

    const online = createEngine({ online: true, gridSize: GRID_SIZE, random: flatRandom });
    const intro = online.getSnapshot();
    online.completeNextLevel({ gridSize: 3, style: CUBE_STYLES[1]!, destination: { x: 24, y: 0 } });
    expect(online.getSnapshot()).toBe(intro);

    online.dispatch({ type: 'introSkip' });
    const playing = online.getSnapshot();
    online.completeNextLevel({ gridSize: 3, style: CUBE_STYLES[1]!, destination: { x: 24, y: 0 } });
    expect(online.getSnapshot()).toBe(playing);
    expect(online.drainIntents()).toEqual([]);
  });
});

describe('authoritative cube adoption (AC-14, AC-22)', () => {
  it('adopts the removed set of the same cube exactly and forwards the removal intent', () => {
    const engine = createEngine({ online: true, gridSize: 3, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    engine.adoptCubeState({
      levelIndex: 0,
      gridSize: 3,
      style: CUBE_STYLES[0]!,
      removedIds: ['front:0:0'],
      yawSteps: 0,
      pitchSteps: 0,
    });

    const adopted = engine.getSnapshot();
    expect(adopted.levelIndex).toBe(0);
    expect(adopted.gridSize).toBe(3);
    expect(adopted.style).toBe(CUBE_STYLES[0]);
    expect(adopted.phase).toBe('playing');
    expect(adopted.board.faces.map((face) => face.miniCubes.length)).toEqual([
      8, 9, 9, 9, 9, 9,
    ]);
    expect(adopted.board.faces[0]!.miniCubes.map((miniCube) => miniCube.id)).toEqual(
      idsOfFace('front', 3).filter((id) => id !== 'front:0:0'),
    );
    // The authority removal the client had not applied counts, as the accepted reconcile does.
    expect(adopted.stats.clicks).toBe(1); expect(adopted.stats.facesDestroyed).toBe(0); expect(adopted.stats.coins).toBe(undefined); expect(adopted.stats.cubesDestroyed).toBe(undefined);
    expect(engine.drainIntents()).toEqual([replayExplosion('front:0:0', 'front')]);
  });

  it('reports a face cleared by an authoritative removal without auto-rotating', () => {
    const engine = createEngine({ online: true, gridSize: 1, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    engine.adoptCubeState({
      levelIndex: 0,
      gridSize: 1,
      style: CUBE_STYLES[0]!,
      removedIds: ['front:0:0'],
      yawSteps: 0,
      pitchSteps: 0,
    });

    const adopted = engine.getSnapshot();
    expect(adopted.stats.clicks).toBe(1); expect(adopted.stats.facesDestroyed).toBe(1); expect(adopted.stats.coins).toBe(undefined); expect(adopted.stats.cubesDestroyed).toBe(undefined);
    expect(adopted.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(adopted.board.faces.map((face) => face.miniCubes.length)).toEqual([0, 1, 1, 1, 1, 1]);
    expect(engine.drainIntents()).toEqual([
      replayExplosion('front:0:0', 'front'),
      { kind: 'faceCleared', faceId: 'front' },
    ]);
  });

  it('restores a locally missing tile with a fresh cube view (local extra is not authoritative)', () => {
    const engine = createEngine({ online: true, gridSize: 3, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.dispatch({ type: 'explodeMiniCube', id: 'front:1:1' });
    engine.drainIntents();
    expect(engine.getSnapshot().stats.clicks).toBe(1); expect(engine.getSnapshot().stats.facesDestroyed).toBe(0); expect(engine.getSnapshot().stats.coins).toBe(0.1); expect(engine.getSnapshot().stats.cubesDestroyed).toBe(undefined);

    engine.adoptCubeState({
      levelIndex: 0,
      gridSize: 3,
      style: CUBE_STYLES[0]!,
      removedIds: [],
      yawSteps: 0,
      pitchSteps: 0,
    });

    const adopted = engine.getSnapshot();
    // The server still has the tile the client removed: the whole board matches it again.
    expect(adopted.board.faces.map((face) => face.miniCubes.length)).toEqual([
      9, 9, 9, 9, 9, 9,
    ]);
    // Stats are session-local and never rolled back.
    expect(adopted.stats.clicks).toBe(1); expect(adopted.stats.facesDestroyed).toBe(0); expect(adopted.stats.coins).toBe(0.1); expect(adopted.stats.cubesDestroyed).toBe(undefined);
    // A restore needs a fresh view: the scene rebuilds from the `levelChanged` snapshot.
    expect(engine.drainIntents()).toEqual([{ kind: 'levelChanged', style: CUBE_STYLES[0] }]);

    engine.advance(16);
    expect(engine.drainIntents()).toEqual([]);
    engine.advance(16);
    expect(engine.drainIntents()).toEqual([]);
  });

  it('adopts a different level, grid and style exactly and replays its removals after the rebuild', () => {
    const engine = createEngine({ online: true, gridSize: 3, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });
    engine.drainIntents();

    engine.adoptCubeState({
      levelIndex: 1,
      gridSize: 4,
      style: CUBE_STYLES[2]!,
      removedIds: ['front:0:0', 'front:1:1'],
      yawSteps: 0,
      pitchSteps: 0,
    });

    const adopted = engine.getSnapshot();
    expect(adopted.phase).toBe('playing');
    expect(adopted.levelIndex).toBe(1);
    expect(adopted.gridSize).toBe(4);
    expect(adopted.style).toBe(CUBE_STYLES[2]);
    expect(adopted.style.id).toBe('emerald-crystal');
    expect(adopted.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(adopted.travelKind).toBeNull();
    expect(adopted.travelDestination).toBeNull();
    expect(adopted.board.faces.map((face) => face.miniCubes.length)).toEqual([
      14, 16, 16, 16, 16, 16,
    ]);
    expect(adopted.board.faces[0]!.miniCubes.map((miniCube) => miniCube.id)).toEqual(
      idsOfFace('front', 4).filter((id) => id !== 'front:0:0' && id !== 'front:1:1'),
    );
    // The old cube's stats survive; the new cube's removal set is not click accounting.
    expect(adopted.stats.clicks).toBe(1); expect(adopted.stats.facesDestroyed).toBe(0); expect(adopted.stats.coins).toBe(0.1); expect(adopted.stats.cubesDestroyed).toBe(undefined);
    expect(engine.drainIntents()).toEqual([{ kind: 'levelChanged', style: CUBE_STYLES[2] }]);

    // The scene drains the rebuild on the first frame; the removal replay follows one frame
    // later so the fresh (fully visible) view cannot undo it.
    engine.advance(16);
    expect(engine.drainIntents()).toEqual([]);
    engine.advance(16);
    expect(engine.drainIntents()).toEqual([
      replayExplosion('front:0:0', 'front'),
      replayExplosion('front:1:1', 'front'),
    ]);
    engine.advance(16);
    expect(engine.drainIntents()).toEqual([]);
  });

  it('releases the held nextLevel travel with the authoritative cube (F2)', () => {
    const { engine } = sweepOnlineIntoTravel(ARRIVAL_TIMINGS, 3);
    engine.drainIntents();
    const held = engine.getSnapshot();
    expect(held.phase).toBe('travel');
    expect(held.travelKind).toBe('nextLevel');
    expect(held.stats.clicks).toBe(54); expect(held.stats.facesDestroyed).toBe(6); expect(held.stats.coins).toBe(15.4); expect(held.stats.cubesDestroyed).toBe(1);

    engine.adoptCubeState({
      levelIndex: 1,
      gridSize: 4,
      style: CUBE_STYLES[1]!,
      removedIds: [],
      yawSteps: 0,
      pitchSteps: 0,
    });

    const adopted = engine.getSnapshot();
    expect(adopted.phase).toBe('playing');
    expect(adopted.phaseProgress).toBe(1);
    expect(adopted.travelKind).toBeNull();
    expect(adopted.travelDestination).toBeNull();
    expect(adopted.travelDirection).toBeNull();
    expect(adopted.levelIndex).toBe(1);
    expect(adopted.gridSize).toBe(4);
    expect(adopted.style).toBe(CUBE_STYLES[1]);
    expect(adopted.stats.clicks).toBe(54); expect(adopted.stats.facesDestroyed).toBe(6); expect(adopted.stats.coins).toBe(15.4); expect(adopted.stats.cubesDestroyed).toBe(1);
    expect(adopted.board.faces.map((face) => face.miniCubes.length)).toEqual([
      16, 16, 16, 16, 16, 16,
    ]);
    expect(engine.drainIntents()).toEqual([{ kind: 'levelChanged', style: CUBE_STYLES[1] }]);

    // The abandoned clock never resumes: time only runs the playing state.
    engine.advance(DEFAULT_TIMINGS.travelMs);
    expect(engine.getSnapshot().phase).toBe('playing');
    expect(engine.getSnapshot().levelIndex).toBe(1);
  });

  it('releases a running face fade so the old completion cannot start a travel (F2)', () => {
    const engine = createEngine({ online: true, gridSize: 1, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    for (const faceId of FACE_IDS) {
      engine.dispatch({ type: 'explodeMiniCube', id: `${faceId}:0:0` });
    }
    engine.drainIntents();
    expect(engine.getSnapshot().phase).toBe('playing');

    engine.adoptCubeState({
      levelIndex: 1,
      gridSize: 2,
      style: CUBE_STYLES[1]!,
      removedIds: [],
      yawSteps: 0,
      pitchSteps: 0,
    });
    expect(engine.getSnapshot().levelIndex).toBe(1);
    expect(engine.getSnapshot().gridSize).toBe(2);
    engine.drainIntents();

    engine.advance(DEFAULT_TIMINGS.faceFadeMs);

    const afterFade = engine.getSnapshot();
    expect(afterFade.phase).toBe('playing');
    expect(afterFade.levelIndex).toBe(1);
    expect(afterFade.travelKind).toBeNull();
    expect(engine.drainIntents()).toEqual([]);
  });

  it('treats a repeated identical adoption as a no-op', () => {
    const engine = createEngine({ online: true, gridSize: 3, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();
    const cube: AuthoritativeCubeState = {
      levelIndex: 1,
      gridSize: 4,
      style: CUBE_STYLES[1]!,
      removedIds: ['front:0:0'],
      yawSteps: 0,
      pitchSteps: 0,
    };

    engine.adoptCubeState(cube);
    engine.drainIntents();
    const adopted = engine.getSnapshot();

    engine.adoptCubeState(cube);

    expect(engine.getSnapshot()).toBe(adopted);
    expect(engine.drainIntents()).toEqual([]);
  });

  it('adopts a non-zero orientation on a same-cube correction (settled, no animation)', () => {
    const engine = createEngine({ online: true, gridSize: 3, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    // Put the engine into a mid-rotation so adoption must settle it.
    engine.dispatch({ type: 'rotate', axis: 'yaw', direction: 1 });
    engine.drainIntents();
    expect(engine.getSnapshot().rotationFrom).not.toBeNull();

    const before = engine.getSnapshot();
    engine.adoptCubeState({
      levelIndex: 0,
      gridSize: 3,
      style: CUBE_STYLES[0]!,
      removedIds: [],
      yawSteps: 2,
      pitchSteps: -1,
    });

    const adopted = engine.getSnapshot();
    expect(adopted.orientation).toEqual({ yawSteps: 2, pitchSteps: -1 });
    expect(adopted.rotationFrom).toBeNull();
    expect(adopted.rotationProgress).toBe(1);
    expect(adopted.stats).toEqual(before.stats);
    // No board rebuild, no removals: no intents beyond the orientation change.
    expect(engine.drainIntents()).toEqual([]);
    // The snapshot is invalidated because the orientation changed.
    expect(adopted).not.toBe(before);
  });

  it('adopts the orientation on a different-level rebuild', () => {
    const engine = createEngine({ online: true, gridSize: 3, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });
    engine.drainIntents();

    engine.adoptCubeState({
      levelIndex: 1,
      gridSize: 4,
      style: CUBE_STYLES[2]!,
      removedIds: [],
      yawSteps: 3,
      pitchSteps: 1,
    });

    const adopted = engine.getSnapshot();
    expect(adopted.levelIndex).toBe(1);
    expect(adopted.orientation).toEqual({ yawSteps: 3, pitchSteps: 1 });
    expect(adopted.rotationFrom).toBeNull();
    expect(engine.drainIntents()).toEqual([{ kind: 'levelChanged', style: CUBE_STYLES[2] }]);
  });

  it('is idempotent when only the orientation differs then matches', () => {
    const engine = createEngine({ online: true, gridSize: 3, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    engine.adoptCubeState({
      levelIndex: 0,
      gridSize: 3,
      style: CUBE_STYLES[0]!,
      removedIds: [],
      yawSteps: 1,
      pitchSteps: 0,
    });
    engine.drainIntents();
    const adopted = engine.getSnapshot();
    expect(adopted.orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });

    // Re-adopting the same cube+orientation is a no-op.
    engine.adoptCubeState({
      levelIndex: 0,
      gridSize: 3,
      style: CUBE_STYLES[0]!,
      removedIds: [],
      yawSteps: 1,
      pitchSteps: 0,
    });
    expect(engine.getSnapshot()).toBe(adopted);
    expect(engine.drainIntents()).toEqual([]);
  });
});

describe('camera-only travel kinds (AC-17)', () => {
  it('travels to a spectated cube without touching the level, the board or the stats', () => {
    const engine = createEngine({ random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    const before = engine.getSnapshot();
    engine.drainIntents();

    engine.dispatch({ type: 'travelTo', kind: 'spectate', destination: { x: 24, y: 0 } });

    let snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('travel');
    expect(snapshot.phaseProgress).toBe(0);
    expect(snapshot.travelKind).toBe('spectate');
    expect(snapshot.travelDestination).toEqual({ x: 24, y: 0 });
    expect(snapshot.travelDirection).toBeNull();
    expect(snapshot.levelIndex).toBe(0);
    expect(snapshot.board).toBe(before.board);
    expect(snapshot.stats).toBe(before.stats);
    expect(engine.drainIntents()).toEqual([{ kind: 'travelStarted' }]);
    const destination = snapshot.travelDestination;

    // Stale level data during a camera flight is ignored (no online advance is pending).
    engine.completeNextLevel({ gridSize: 3, style: CUBE_STYLES[1]!, destination: { x: 0, y: 0 } });
    expect(engine.getSnapshot()).toBe(snapshot);

    engine.advance(1250);
    snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('travel');
    expect(snapshot.phaseProgress).toBe(0.5);
    expect(snapshot.levelIndex).toBe(0);
    expect(snapshot.travelDestination).toBe(destination);
    expect(engine.drainIntents()).toEqual([]);

    engine.advance(1250);
    snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.phaseProgress).toBe(1);
    expect(snapshot.travelKind).toBeNull();
    expect(snapshot.travelDestination).toBeNull();
    expect(snapshot.levelIndex).toBe(0);
    expect(snapshot.board).toBe(before.board);
    expect(snapshot.stats.clicks).toBe(0); expect(snapshot.stats.facesDestroyed).toBe(0); expect(snapshot.stats.coins).toBe(undefined); expect(snapshot.stats.cubesDestroyed).toBe(undefined);
    expect(snapshot.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(engine.drainIntents()).toEqual([]);
  });

  it('travels back home with the return kind', () => {
    const engine = createEngine({ random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    engine.dispatch({ type: 'travelTo', kind: 'return', destination: { x: -24, y: 12 } });
    expect(engine.getSnapshot().travelKind).toBe('return');
    expect(engine.getSnapshot().travelDestination).toEqual({ x: -24, y: 12 });
    expect(engine.drainIntents()).toEqual([{ kind: 'travelStarted' }]);

    engine.advance(DEFAULT_TIMINGS.travelMs);

    const snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('playing');
    expect(snapshot.travelKind).toBeNull();
    expect(snapshot.travelDestination).toBeNull();
    expect(snapshot.levelIndex).toBe(0);
    expect(engine.drainIntents()).toEqual([]);
  });

  it('ignores a second travel request while one is running', () => {
    const engine = createEngine({ random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.dispatch({ type: 'travelTo', kind: 'spectate', destination: { x: 24, y: 0 } });
    engine.drainIntents();
    const traveling = engine.getSnapshot();

    engine.dispatch({ type: 'travelTo', kind: 'return', destination: { x: 0, y: 0 } });

    expect(engine.getSnapshot()).toBe(traveling);
    expect(engine.drainIntents()).toEqual([]);

    engine.advance(DEFAULT_TIMINGS.travelMs);
    expect(engine.getSnapshot().phase).toBe('playing');
  });

  it('ignores travelTo during the intro', () => {
    const engine = createEngine({ random: flatRandom });
    const before = engine.getSnapshot();

    engine.dispatch({ type: 'travelTo', kind: 'spectate', destination: { x: 24, y: 0 } });

    expect(engine.getSnapshot()).toBe(before);
    expect(engine.drainIntents()).toEqual([]);
  });

  it('leaves the offline travel kind and destination empty', () => {
    const { engine } = sweepIntoTravel(ARRIVAL_TIMINGS, GRID_SIZE);

    const snapshot = engine.getSnapshot();
    expect(snapshot.phase).toBe('travel');
    expect(snapshot.travelDirection).toBe('top');
    expect(snapshot.travelKind).toBeNull();
    expect(snapshot.travelDestination).toBeNull();
    expect(snapshot.spectating).toBe(false);
  });
});

describe('spectating input gate (AC-17)', () => {
  it('ignores every gameplay input while spectating, leaving board, stats and orientation untouched', () => {
    const engine = createEngine({ random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    engine.setSpectating(true);
    const gated = engine.getSnapshot();
    expect(gated.spectating).toBe(true);
    expect(engine.getSnapshot()).toBe(gated);
    engine.setSpectating(true);
    expect(engine.getSnapshot()).toBe(gated);

    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });
    engine.dispatch({ type: 'rotate', axis: 'yaw', direction: 1 });
    engine.dispatch({ type: 'rotate', axis: 'pitch', direction: -1 });
    engine.dispatch({ type: 'introSkip' });

    expect(engine.getSnapshot()).toBe(gated);
    expect(engine.getSnapshot().stats.clicks).toBe(0); expect(engine.getSnapshot().stats.facesDestroyed).toBe(0); expect(engine.getSnapshot().stats.coins).toBe(undefined); expect(engine.getSnapshot().stats.cubesDestroyed).toBe(undefined);
    expect(engine.getSnapshot().board.faces[0]?.miniCubes).toHaveLength(25);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(engine.getSnapshot().rotationFrom).toBeNull();
    expect(engine.drainIntents()).toEqual([]);
  });

  it('still allows the return travel and re-enables input after spectating ends', () => {
    const engine = createEngine({ random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.setSpectating(true);
    engine.drainIntents();

    engine.dispatch({ type: 'travelTo', kind: 'return', destination: { x: 0, y: 0 } });
    expect(engine.getSnapshot().phase).toBe('travel');
    expect(engine.getSnapshot().travelKind).toBe('return');
    expect(engine.drainIntents()).toEqual([{ kind: 'travelStarted' }]);
    engine.advance(DEFAULT_TIMINGS.travelMs);
    expect(engine.getSnapshot().phase).toBe('playing');

    engine.setSpectating(false);
    const active = engine.getSnapshot();
    expect(active.spectating).toBe(false);
    engine.setSpectating(false);
    expect(engine.getSnapshot()).toBe(active);

    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });
    expect(engine.getSnapshot().stats.clicks).toBe(1); expect(engine.getSnapshot().stats.facesDestroyed).toBe(0); expect(engine.getSnapshot().stats.coins).toBe(0.1); expect(engine.getSnapshot().stats.cubesDestroyed).toBe(undefined);
    expect(engine.getSnapshot().board.faces[0]?.miniCubes).toHaveLength(24);
    expect(engine.drainIntents()).toHaveLength(1);
  });
});

describe('travel cancel (AC-19 d, AC-22)', () => {
  it('cancels a spectate flight at once, keeping the own level and emitting no intent', () => {
    const engine = createEngine({ random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    const before = engine.getSnapshot();
    engine.drainIntents();

    engine.dispatch({ type: 'travelTo', kind: 'spectate', destination: { x: 24, y: 0 } });
    expect(engine.drainIntents()).toEqual([{ kind: 'travelStarted' }]);
    engine.advance(1000);
    expect(engine.getSnapshot().phase).toBe('travel');
    expect(engine.getSnapshot().phaseProgress).toBe(0.4);
    expect(engine.drainIntents()).toEqual([]);

    engine.cancelTravel();

    const cancelled = engine.getSnapshot();
    expect(cancelled.phase).toBe('playing');
    expect(cancelled.phaseProgress).toBe(1);
    expect(cancelled.travelKind).toBeNull();
    expect(cancelled.travelDestination).toBeNull();
    expect(cancelled.travelDirection).toBeNull();
    expect(cancelled.levelIndex).toBe(0);
    expect(cancelled.gridSize).toBe(GRID_SIZE);
    expect(cancelled.board).toBe(before.board);
    expect(cancelled.stats.clicks).toBe(0); expect(cancelled.stats.facesDestroyed).toBe(0); expect(cancelled.stats.coins).toBe(undefined); expect(cancelled.stats.cubesDestroyed).toBe(undefined);
    expect(cancelled.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(cancelled.spectating).toBe(false);
    expect(engine.drainIntents()).toEqual([]);

    // The abandoned flight never resumes: time only runs the playing clock.
    engine.advance(DEFAULT_TIMINGS.travelMs);
    expect(engine.getSnapshot()).toBe(cancelled);

    // Play is live again at the own cube.
    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });
    expect(engine.getSnapshot().stats.clicks).toBe(1); expect(engine.getSnapshot().stats.facesDestroyed).toBe(0); expect(engine.getSnapshot().stats.coins).toBe(0.1); expect(engine.getSnapshot().stats.cubesDestroyed).toBe(undefined);
    expect(engine.getSnapshot().board.faces[0]?.miniCubes).toHaveLength(24);
  });

  it('cancels a return flight and leaves the spectating gate to the caller', () => {
    const engine = createEngine({ random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.setSpectating(true);
    engine.drainIntents();

    engine.dispatch({ type: 'travelTo', kind: 'return', destination: { x: 0, y: 0 } });
    expect(engine.drainIntents()).toEqual([{ kind: 'travelStarted' }]);
    engine.advance(625);
    expect(engine.getSnapshot().phase).toBe('travel');
    expect(engine.getSnapshot().phaseProgress).toBe(0.25);
    expect(engine.drainIntents()).toEqual([]);

    engine.cancelTravel();

    const cancelled = engine.getSnapshot();
    expect(cancelled.phase).toBe('playing');
    expect(cancelled.phaseProgress).toBe(1);
    expect(cancelled.travelKind).toBeNull();
    expect(cancelled.travelDestination).toBeNull();
    expect(cancelled.spectating).toBe(true);
    expect(cancelled.levelIndex).toBe(0);
    expect(engine.drainIntents()).toEqual([]);

    // The session clears the gate itself; play then resumes at the own cube.
    engine.setSpectating(false);
    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });
    expect(engine.getSnapshot().stats.clicks).toBe(1); expect(engine.getSnapshot().stats.facesDestroyed).toBe(0); expect(engine.getSnapshot().stats.coins).toBe(0.1); expect(engine.getSnapshot().stats.cubesDestroyed).toBe(undefined);
    expect(engine.getSnapshot().board.faces[0]?.miniCubes).toHaveLength(24);
  });

  it('never cancels the online nextLevel hold, an offline level travel or a rest state', () => {
    const { engine: held } = sweepOnlineIntoTravel(ARRIVAL_TIMINGS, GRID_SIZE);
    held.drainIntents();
    const heldSnapshot = held.getSnapshot();
    expect(heldSnapshot.travelKind).toBe('nextLevel');

    held.cancelTravel();

    expect(held.getSnapshot()).toBe(heldSnapshot);
    expect(held.drainIntents()).toEqual([]);
    // The held server data still releases the level travel after the refused cancel.
    held.completeNextLevel({
      gridSize: 3,
      style: CUBE_STYLES[4]!,
      destination: { x: 24, y: 0 },
    });
    expect(held.getSnapshot().travelKind).toBe('nextLevel');
    expect(held.getSnapshot().travelDestination).toEqual({ x: 24, y: 0 });

    const { engine: offline } = sweepIntoTravel(ARRIVAL_TIMINGS, GRID_SIZE);
    offline.drainIntents();
    const offlineSnapshot = offline.getSnapshot();
    expect(offlineSnapshot.travelKind).toBeNull();

    offline.cancelTravel?.();

    expect(offline.getSnapshot()).toBe(offlineSnapshot);
    offline.advance(DEFAULT_TIMINGS.travelMs);
    expect(offline.getSnapshot().phase).toBe('playing');
    expect(offline.getSnapshot().levelIndex).toBe(1);

    const playing = createEngine({ random: flatRandom });
    playing.dispatch({ type: 'introSkip' });
    const playingSnapshot = playing.getSnapshot();
    playing.cancelTravel();
    expect(playing.getSnapshot()).toBe(playingSnapshot);
  });
});


describe('engine economy awards (AC-1..AC-4, AC-8, AC-21)', () => {
  it('per-mini: destroying one mini-cube awards COINS_PER_MINI_CUBE', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });

    const snap = engine.getSnapshot();
    expect(snap.stats.clicks).toBe(1);
    expect(snap.stats.coins).toBe(COINS_PER_MINI_CUBE);
    expect(snap.stats.cubesDestroyed).toBeUndefined();
  });

  it('guest path: earns coins and stats locally without adoptEconomy', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });
    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:1' });

    const snap = engine.getSnapshot();
    expect(snap.stats.clicks).toBe(2);
    expect(snap.stats.coins).toBe(COINS_PER_MINI_CUBE * 2);
  });

  it('per-cube: fast completion awards 2x COINS_PER_CUBE', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    for (const faceId of FACE_IDS) {
      if (faceId === 'bottom') continue;
      clearFace(engine, faceId, 2);
    }
    clearFace(engine, 'bottom', 2);

    const snap = engine.getSnapshot();
    expect(snap.stats.clicks).toBe(24);
    expect(snap.stats.facesDestroyed).toBe(6);
    expect(snap.stats.cubesDestroyed).toBe(1);
    expect(snap.stats.coins).toBe(24 * COINS_PER_MINI_CUBE + COINS_PER_CUBE * 2);
  });

  it('per-cube: slow completion awards 1x COINS_PER_CUBE', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    for (const faceId of FACE_IDS) {
      if (faceId === 'bottom') continue;
      clearFace(engine, faceId, 2);
    }
    engine.advance(100_000);
    clearFace(engine, 'bottom', 2);

    const snap = engine.getSnapshot();
    expect(snap.stats.cubesDestroyed).toBe(1);
    expect(snap.stats.coins).toBe(24 * COINS_PER_MINI_CUBE + COINS_PER_CUBE);
  });

  it('speed bonus boundary: exactly at threshold qualifies (grid 3)', () => {
    const engine = createEngine({ gridSize: 3, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    for (const faceId of FACE_IDS) {
      if (faceId === 'bottom') continue;
      clearFace(engine, faceId, 3);
    }
    engine.advance(thresholdSeconds(3) * 1000);
    clearFace(engine, 'bottom', 3);

    const snap = engine.getSnapshot();
    expect(snap.stats.cubesDestroyed).toBe(1);
    expect(snap.stats.coins).toBe(54 * COINS_PER_MINI_CUBE + COINS_PER_CUBE * 2);
  });

  it('speed bonus boundary: one ms over threshold does not qualify (grid 3)', () => {
    const engine = createEngine({ gridSize: 3, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    for (const faceId of FACE_IDS) {
      if (faceId === 'bottom') continue;
      clearFace(engine, faceId, 3);
    }
    engine.advance(thresholdSeconds(3) * 1000 + 1);
    clearFace(engine, 'bottom', 3);

    const snap = engine.getSnapshot();
    expect(snap.stats.cubesDestroyed).toBe(1);
    expect(snap.stats.coins).toBe(54 * COINS_PER_MINI_CUBE + COINS_PER_CUBE);
  });

  it('size-dependent threshold: grid 7 uses 35s boundary', () => {
    const engine = createEngine({ gridSize: 7, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    for (const faceId of FACE_IDS) {
      if (faceId === 'bottom') continue;
      clearFace(engine, faceId, 7);
    }
    engine.advance(thresholdSeconds(7) * 1000);
    clearFace(engine, 'bottom', 7);

    const snap = engine.getSnapshot();
    expect(snap.stats.cubesDestroyed).toBe(1);
    expect(snap.stats.coins).toBe(39.4);
  });
});

describe('adoptEconomy (AC-6, AC-16)', () => {
  it('sets coins and stats to absolute values', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();
    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });

    engine.adoptEconomy({ coins: 99.99, clicks: 5, facesDestroyed: 2, cubesDestroyed: 3 });

    const stats = engine.getSnapshot().stats;
    expect(stats.coins).toBe(99.99);
    expect(stats.clicks).toBe(5);
    expect(stats.facesDestroyed).toBe(2);
    expect(stats.cubesDestroyed).toBe(3);
  });

  it('overwrites lower local totals with server absolute values', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    engine.adoptEconomy({ coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 });
    const stats = engine.getSnapshot().stats;
    expect(stats.coins).toBe(0);
    expect(stats.clicks).toBe(0);
    expect(stats.facesDestroyed).toBe(0);
    expect(stats.cubesDestroyed).toBe(0);
  });
});

describe('engine upgrades (AC-2, AC-3, AC-4, AC-5, AC-16, AC-17)', () => {
  it('initial snapshot carries upgrades as {}', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    expect(engine.getSnapshot().upgrades).toEqual({});
  });

  it('mini_cube_value level L scales the mini-cube reward', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    engine.adoptUpgrades({ mini_cube_value: 2 });
    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });

    const snap = engine.getSnapshot();
    expect(snap.stats.coins).toBe(roundCoins(COINS_PER_MINI_CUBE * miniCubeMultiplier({ mini_cube_value: 2 })));
    expect(snap.upgrades).toEqual({ mini_cube_value: 2 });
  });

  it('cube_value level L scales the cube reward', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();
    engine.adoptUpgrades({ cube_value: 3 });

    for (const faceId of FACE_IDS) {
      if (faceId === 'bottom') continue;
      clearFace(engine, faceId, 2);
    }
    clearFace(engine, 'bottom', 2);

    const snap = engine.getSnapshot();
    expect(snap.stats.cubesDestroyed).toBe(1);
    expect(snap.stats.coins).toBe(
      24 * COINS_PER_MINI_CUBE + roundCoins(COINS_PER_CUBE * cubeMultiplier({ cube_value: 3 }) * 2),
    );
  });

  it('speed_window level L extends the speed-bonus threshold (boundary qualifies)', () => {
    const engine = createEngine({ gridSize: 3, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();
    engine.adoptUpgrades({ speed_window: 1 });

    for (const faceId of FACE_IDS) {
      if (faceId === 'bottom') continue;
      clearFace(engine, faceId, 3);
    }
    engine.advance(thresholdSeconds(3) * 1000 + speedWindowSeconds({ speed_window: 1 }) * 1000);
    clearFace(engine, 'bottom', 3);

    const snap = engine.getSnapshot();
    expect(snap.stats.cubesDestroyed).toBe(1);
    expect(snap.stats.coins).toBe(
      54 * COINS_PER_MINI_CUBE + roundCoins(COINS_PER_CUBE * cubeMultiplier({}) * 2),
    );
  });

  it('speed_window boundary: one ms over the extended threshold does not qualify', () => {
    const engine = createEngine({ gridSize: 3, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();
    engine.adoptUpgrades({ speed_window: 1 });

    for (const faceId of FACE_IDS) {
      if (faceId === 'bottom') continue;
      clearFace(engine, faceId, 3);
    }
    engine.advance(thresholdSeconds(3) * 1000 + speedWindowSeconds({ speed_window: 1 }) * 1000 + 1);
    clearFace(engine, 'bottom', 3);

    const snap = engine.getSnapshot();
    expect(snap.stats.cubesDestroyed).toBe(1);
    expect(snap.stats.coins).toBe(
      54 * COINS_PER_MINI_CUBE + roundCoins(COINS_PER_CUBE * cubeMultiplier({})),
    );
  });

  it('effects apply to future earnings only (no retroactive change)', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });
    const before = engine.getSnapshot().stats.coins;
    expect(before).toBe(COINS_PER_MINI_CUBE);

    engine.adoptUpgrades({ mini_cube_value: 5 });
    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:1' });

    const after = engine.getSnapshot().stats.coins;
    expect(after).toBe(roundCoins(COINS_PER_MINI_CUBE + COINS_PER_MINI_CUBE * (1 + 0.1 * 5)));
  });

  it('adoptUpgrades replaces the whole map (no merge)', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptUpgrades({ mini_cube_value: 2, cube_value: 1 });
    expect(engine.getSnapshot().upgrades).toEqual({ mini_cube_value: 2, cube_value: 1 });

    engine.adoptUpgrades({ speed_window: 3 });
    expect(engine.getSnapshot().upgrades).toEqual({ speed_window: 3 });
  });

  it('adoptUpgrades invalidates the snapshot', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    const before = engine.getSnapshot();
    engine.adoptUpgrades({ mini_cube_value: 1 });
    const after = engine.getSnapshot();
    expect(after).not.toBe(before);
    expect(after.upgrades).toEqual({ mini_cube_value: 1 });
  });
});

describe('engine customization (AC-2, AC-5, AC-8, AC-10)', () => {
  it('initial snapshot carries customization as the zero state', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    expect(engine.getSnapshot().customization).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: {},
    });
    expect(engine.getSnapshot().lastLootboxGrant).toBeNull();
  });

  it('grants +1 lootbox and +1 key on cube completion', () => {
    const engine = createEngine({ gridSize: 1, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    for (const faceId of FACE_IDS) {
      engine.dispatch({ type: 'explodeMiniCube', id: `${faceId}:0:0` });
    }

    const customization = engine.getSnapshot().customization;
    expect(customization).toEqual({
      lootboxes: 1,
      keys: 1,
      parts: {},
      appearance: {},
    });
  });

  it('grants a defensive copy of parts/appearance on cube completion', () => {
    const engine = createEngine({ gridSize: 1, random: flatRandom });
    engine.adoptCustomization({
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-gold': 1 },
      appearance: { hull: 'hull-gold' },
    });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    const before = engine.getSnapshot();
    const beforeParts = before.customization.parts;
    const beforeAppearance = before.customization.appearance;

    for (const faceId of FACE_IDS) {
      engine.dispatch({ type: 'explodeMiniCube', id: `${faceId}:0:0` });
    }

    const after = engine.getSnapshot();
    // Mutating the granted snapshot's maps must not touch the prior snapshot's maps.
    after.customization.parts['extra'] = 99;
    after.customization.appearance['extra'] = 'x';

    expect(before.customization.parts).toEqual({ 'hull-gold': 1 });
    expect(before.customization.appearance).toEqual({ hull: 'hull-gold' });
    expect(beforeParts).not.toBe(after.customization.parts);
    expect(beforeAppearance).not.toBe(after.customization.appearance);
  });

  it('openLootbox decrements counts and grants one lootable v2 part (guest)', () => {
    // Draw 0 selects the first lootable catalog entry: hull-obsidian (AC-13).
    const engine = createEngine({ gridSize: 2, random: () => 0 });
    engine.adoptCustomization({ lootboxes: 1, keys: 1, parts: {}, appearance: {} });

    const grant = engine.openLootbox();

    expect(grant).toEqual({
      partId: 'hull-obsidian',
      slot: 'hull',
      rarity: 'rare',
      duplicate: false,
      sequence: 1,
    });
    expect(engine.getSnapshot().lastLootboxGrant).toEqual(grant);
    const customization = engine.getSnapshot().customization;
    expect(customization.lootboxes).toBe(0);
    expect(customization.keys).toBe(0);
    expect(customization.parts).toEqual({ 'hull-obsidian': 1 });
    expect(customization.appearance).toEqual({});
  });

  it('openLootbox flags a duplicate and advances the grant sequence', () => {
    const engine = createEngine({ gridSize: 2, random: () => 0 });
    engine.adoptCustomization({
      lootboxes: 2,
      keys: 2,
      parts: { 'hull-obsidian': 1 },
      appearance: {},
    });

    const first = engine.openLootbox();
    const second = engine.openLootbox();

    expect(first).toEqual({
      partId: 'hull-obsidian',
      slot: 'hull',
      rarity: 'rare',
      duplicate: true,
      sequence: 1,
    });
    expect(second).toEqual({
      partId: 'hull-obsidian',
      slot: 'hull',
      rarity: 'rare',
      duplicate: true,
      sequence: 2,
    });
    expect(engine.getSnapshot().customization.parts).toEqual({ 'hull-obsidian': 3 });
    expect(engine.getSnapshot().lastLootboxGrant).toEqual(second);
  });

  it('openLootbox returns null and invalidates nothing without a lootbox or key', () => {
    const engine = createEngine({ gridSize: 2, random: () => 0 });
    engine.adoptCustomization({ lootboxes: 0, keys: 0, parts: {}, appearance: {} });
    const before = engine.getSnapshot();

    expect(engine.openLootbox()).toBeNull();
    const after = engine.getSnapshot();
    expect(after).toBe(before);
    expect(after.lastLootboxGrant).toBeNull();
  });

  it('openLootbox is a no-op when lootboxes === 0', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptCustomization({ lootboxes: 0, keys: 1, parts: {}, appearance: {} });
    const before = engine.getSnapshot();

    engine.openLootbox();

    const after = engine.getSnapshot();
    expect(after).toBe(before);
    expect(after.customization).toEqual({
      lootboxes: 0,
      keys: 1,
      parts: {},
      appearance: {},
    });
  });

  it('openLootbox is a no-op when keys === 0', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptCustomization({ lootboxes: 1, keys: 0, parts: {}, appearance: {} });
    const before = engine.getSnapshot();

    engine.openLootbox();

    const after = engine.getSnapshot();
    expect(after).toBe(before);
    expect(after.customization).toEqual({
      lootboxes: 1,
      keys: 0,
      parts: {},
      appearance: {},
    });
  });

  it('equipPart updates appearance for an owned part', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptCustomization({
      lootboxes: 0,
      keys: 0,
      parts: { 'nose-crimson': 1 },
      appearance: {},
    });

    engine.equipPart('nose-crimson');

    const customization = engine.getSnapshot().customization;
    expect(customization.appearance).toEqual({ nose: 'nose-crimson' });
    expect(customization.parts).toEqual({ 'nose-crimson': 1 });
  });

  it('equipPart is a no-op for an unknown part id', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptCustomization({
      lootboxes: 0,
      keys: 0,
      parts: { 'nose-crimson': 1 },
      appearance: {},
    });
    const before = engine.getSnapshot();

    engine.equipPart('nose-unknown');

    const after = engine.getSnapshot();
    expect(after).toBe(before);
    expect(after.customization.appearance).toEqual({});
  });

  it('equipPart is a no-op for an unowned part', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptCustomization({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: {},
    });
    const before = engine.getSnapshot();

    engine.equipPart('nose-crimson');

    const after = engine.getSnapshot();
    expect(after).toBe(before);
    expect(after.customization.appearance).toEqual({});
  });

  it('equips standard parts without ownership and isolates left/right slots', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptCustomization({
      lootboxes: 0,
      keys: 0,
      parts: { 'wing-left-silver': 1, 'wing-right-gold': 1 },
      appearance: {},
    });

    engine.equipPart('wing-left-silver');
    expect(engine.getSnapshot().customization.appearance).toEqual({
      'wing-left': 'wing-left-silver',
    });

    engine.equipPart('wing-right-gold');
    expect(engine.getSnapshot().customization.appearance).toEqual({
      'wing-left': 'wing-left-silver',
      'wing-right': 'wing-right-gold',
    });

    // Standard parts are implicitly owned (AC-12): the right wing can revert to standard.
    engine.equipPart('wing-right-default');
    expect(engine.getSnapshot().customization.appearance).toEqual({
      'wing-left': 'wing-left-silver',
      'wing-right': 'wing-right-default',
    });
  });

  it('legacy body-* equips the hull slot only when the hull part is owned', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptCustomization({
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-gold': 1 },
      appearance: {},
    });

    engine.equipPart('body-gold');
    expect(engine.getSnapshot().customization.appearance).toEqual({ hull: 'hull-gold' });

    engine.equipPart('body-obsidian');
    expect(engine.getSnapshot().customization.appearance).toEqual({ hull: 'hull-gold' });
  });

  it('legacy wings-* requires both wing parts (all-or-nothing)', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptCustomization({
      lootboxes: 0,
      keys: 0,
      parts: { 'wing-left-silver': 1 },
      appearance: {},
    });
    const partial = engine.getSnapshot();

    engine.equipPart('wings-silver');
    expect(engine.getSnapshot()).toBe(partial);
    expect(engine.getSnapshot().customization.appearance).toEqual({});

    engine.adoptCustomization({
      lootboxes: 0,
      keys: 0,
      parts: { 'wing-left-silver': 1, 'wing-right-silver': 1 },
      appearance: {},
    });
    engine.equipPart('wings-silver');
    expect(engine.getSnapshot().customization.appearance).toEqual({
      'wing-left': 'wing-left-silver',
      'wing-right': 'wing-right-silver',
    });
  });

  it('legacy engine-* requires both ignition parts and equips both slots', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptCustomization({
      lootboxes: 0,
      keys: 0,
      parts: { 'ignition-left-blue': 1, 'ignition-right-blue': 1 },
      appearance: {},
    });

    engine.equipPart('engine-blue');
    expect(engine.getSnapshot().customization.appearance).toEqual({
      'ignition-left': 'ignition-left-blue',
      'ignition-right': 'ignition-right-blue',
    });
  });

  it('re-equipping the same part is a no-op (snapshot identity preserved)', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptCustomization({
      lootboxes: 0,
      keys: 0,
      parts: { 'nose-crimson': 1 },
      appearance: { nose: 'nose-crimson' },
    });
    const before = engine.getSnapshot();

    engine.equipPart('nose-crimson');
    expect(engine.getSnapshot()).toBe(before);
  });

  it('unequipPart removes exactly one slot and leaves others untouched', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptCustomization({
      lootboxes: 0,
      keys: 0,
      parts: { 'nose-crimson': 1, 'tail-fin-split': 1 },
      appearance: { nose: 'nose-crimson', 'tail-fin': 'tail-fin-split' },
    });

    engine.unequipPart('nose');
    expect(engine.getSnapshot().customization.appearance).toEqual({
      'tail-fin': 'tail-fin-split',
    });
  });

  it('unequipPart is a no-op for an unknown slot, a missing slot and a standard part', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptCustomization({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: { nose: 'nose-default' },
    });
    const before = engine.getSnapshot();

    engine.unequipPart('wings');
    engine.unequipPart('tail-fin');
    engine.unequipPart('nose');
    expect(engine.getSnapshot()).toBe(before);
  });

  it('adoptLootboxGrant stores a defensive copy and advances the sequence', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    const grant = {
      partId: 'hull-gold',
      slot: 'hull',
      rarity: 'epic' as const,
      duplicate: false,
      sequence: 4,
    };

    engine.adoptLootboxGrant(grant);
    grant.partId = 'hull-obsidian';

    expect(engine.getSnapshot().lastLootboxGrant).toEqual({
      partId: 'hull-gold',
      slot: 'hull',
      rarity: 'epic',
      duplicate: false,
      sequence: 4,
    });

    // A later guest open continues after the adopted sequence.
    engine.adoptCustomization({ lootboxes: 1, keys: 1, parts: {}, appearance: {} });
    expect(engine.openLootbox()?.sequence).toBe(5);
  });

  it('clearLootboxGrant clears the reveal and is idempotent', () => {
    const engine = createEngine({ gridSize: 2, random: () => 0 });
    engine.adoptCustomization({ lootboxes: 1, keys: 1, parts: {}, appearance: {} });
    engine.openLootbox();
    expect(engine.getSnapshot().lastLootboxGrant).toEqual({
      partId: 'hull-obsidian',
      slot: 'hull',
      rarity: 'rare',
      duplicate: false,
      sequence: 1,
    });

    engine.clearLootboxGrant();
    expect(engine.getSnapshot().lastLootboxGrant).toBeNull();
    const cleared = engine.getSnapshot();

    engine.clearLootboxGrant();
    expect(engine.getSnapshot()).toBe(cleared);
  });

  it('adoptCustomization replaces the whole state', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptCustomization({
      lootboxes: 1,
      keys: 2,
      parts: { 'hull-gold': 3 },
      appearance: { hull: 'hull-gold' },
    });
    expect(engine.getSnapshot().customization).toEqual({
      lootboxes: 1,
      keys: 2,
      parts: { 'hull-gold': 3 },
      appearance: { hull: 'hull-gold' },
    });

    engine.adoptCustomization({ lootboxes: 0, keys: 0, parts: {}, appearance: {} });
    expect(engine.getSnapshot().customization).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: {},
      appearance: {},
    });
  });

  it('adoptCustomization normalizes a restored legacy state (AC-33)', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptCustomization({
      lootboxes: 1,
      keys: 1,
      parts: { 'wings-silver': 2, 'engine-blue': 1, 'body-gold': 1 },
      appearance: { wings: 'wings-silver', engine: 'engine-blue', body: 'body-gold' },
    });

    expect(engine.getSnapshot().customization).toEqual({
      lootboxes: 1,
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

  it('adoptCustomization invalidates the snapshot', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    const before = engine.getSnapshot();
    engine.adoptCustomization({ lootboxes: 1, keys: 1, parts: {}, appearance: {} });
    const after = engine.getSnapshot();
    expect(after).not.toBe(before);
    expect(after.customization.lootboxes).toBe(1);
  });

  it('openLootbox invalidates the snapshot on success', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptCustomization({ lootboxes: 1, keys: 1, parts: {}, appearance: {} });
    const before = engine.getSnapshot();
    engine.openLootbox();
    const after = engine.getSnapshot();
    expect(after).not.toBe(before);
  });

  it('equipPart invalidates the snapshot on success', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.adoptCustomization({ lootboxes: 0, keys: 0, parts: { 'nose-crimson': 1 }, appearance: {} });
    const before = engine.getSnapshot();
    engine.equipPart('nose-crimson');
    const after = engine.getSnapshot();
    expect(after).not.toBe(before);
  });
});
