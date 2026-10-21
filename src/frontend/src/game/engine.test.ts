import { describe, expect, it } from 'vitest';

import { createEngine, type EffectIntent, type GameEngine } from './engine';
import { createBurst, DEFAULT_TIMINGS, REDUCED_TIMINGS } from './effects';
import { CUBE_STYLES } from './progression';
import { FACE_IDS, GRID_SIZE, type FaceId, type MiniCubeId } from './types';

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

describe('createEngine — initial state', () => {
  it('starts in the intro on a full board with the first style and no intents', () => {
    const engine = createEngine({ random: flatRandom });
    const snapshot = engine.getSnapshot();

    expect(snapshot.phase).toBe('intro');
    expect(snapshot.phaseProgress).toBe(0);
    expect(snapshot.stats).toEqual({ clicks: 0, facesDestroyed: 0 });
    expect(snapshot.levelIndex).toBe(0);
    expect(snapshot.style).toBe(CUBE_STYLES[0]);
    expect(snapshot.style.id).toBe('obsidian-neon');
    expect(snapshot.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(snapshot.rotationFrom).toBeNull();
    expect(snapshot.rotationProgress).toBe(1);
    expect(snapshot.board.faces.map((face) => face.miniCubes.length)).toEqual([25, 25, 25, 25, 25, 25]);
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
    expect(third.stats).toEqual({ clicks: 1, facesDestroyed: 0 });
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
    expect(after.stats).toEqual({ clicks: 0, facesDestroyed: 0 });
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
    expect(snapshot.stats).toEqual({ clicks: 1, facesDestroyed: 0 });
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
    expect(engine.getSnapshot().stats).toEqual({ clicks: 1, facesDestroyed: 0 });
    expect(engine.getSnapshot().board.faces[0]?.miniCubes).toHaveLength(24);
    expect(engine.drainIntents()).toEqual([]);
  });

  it('falls back to the platform random source when none is injected', () => {
    const engine = createEngine();
    engine.dispatch({ type: 'introSkip' });
    engine.dispatch({ type: 'explodeMiniCube', id: 'front:2:2' });

    const intents = engine.drainIntents();
    if (intents[0]?.kind !== 'explosion') {
      throw new Error('expected one explosion intent');
    }
    expect(intents[0].id).toBe('front:2:2');
    expect(intents[0].burst.particles).toHaveLength(24);
    expect(intents[0].burst.lifetimeMs).toBe(350);
  });

  it('builds each burst from the injected random source', () => {
    const engine = createEngine({ random: seededRandom(42) });
    engine.dispatch({ type: 'introSkip' });
    engine.drainIntents();

    engine.dispatch({ type: 'explodeMiniCube', id: 'front:0:0' });

    const intents = engine.drainIntents();
    expect(intents).toEqual([
      { kind: 'explosion', id: 'front:0:0', faceId: 'front', burst: createBurst(seededRandom(42)) },
    ]);
    if (intents[0]?.kind !== 'explosion') {
      throw new Error('expected one explosion intent');
    }
    expect(intents[0].burst.particles).toHaveLength(24);
    expect(intents[0].burst.lifetimeMs).toBe(350);
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
    expect(snapshot.stats).toEqual({ clicks: 4, facesDestroyed: 1 });
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
    expect(snapshot.stats).toEqual({ clicks: 8, facesDestroyed: 2 });
    expect(snapshot.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(snapshot.rotationFrom).toBeNull();
  });

  it('re-evaluates the target after each step until the front face has mini-cubes', () => {
    const engine = createEngine({ gridSize: 2, random: flatRandom });
    engine.dispatch({ type: 'introSkip' });
    for (const faceId of ['left', 'right', 'top', 'bottom'] as const) {
      clearFace(engine, faceId, 2);
    }
    expect(engine.getSnapshot().stats).toEqual({ clicks: 16, facesDestroyed: 4 });
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
    expect(snapshot.stats).toEqual({ clicks: 20, facesDestroyed: 5 });
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
    expect(snapshot.stats).toEqual({ clicks: 150, facesDestroyed: 6 });
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
    expect(snapshot.stats).toEqual({ clicks: 150, facesDestroyed: 6 });
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
    expect(snapshot.stats).toEqual({ clicks: 150, facesDestroyed: 6 });
    expect(snapshot.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(snapshot.rotationFrom).toBeNull();
    expect(snapshot.board.faces.map((face) => face.miniCubes.length)).toEqual([25, 25, 25, 25, 25, 25]);
    expect(engine.drainIntents()).toEqual([{ kind: 'levelChanged', style: CUBE_STYLES[1] }]);

    // The second level plays like the first, with the carried-over stats.
    clearFace(engine, 'front', GRID_SIZE);
    expect(engine.getSnapshot().stats).toEqual({ clicks: 175, facesDestroyed: 7 });
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });
    engine.advance(DEFAULT_TIMINGS.rotationMs);
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });
    expect(engine.getSnapshot().rotationFrom).toBeNull();
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

    expect(engine.getSnapshot().stats).toEqual({ clicks: 1, facesDestroyed: 0 });
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
    expect(snapshot.stats).toEqual({ clicks: 4, facesDestroyed: 1 });
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

    expect(engine.getSnapshot().stats).toEqual({ clicks: 6, facesDestroyed: 6 });
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
    expect(snapshot.stats).toEqual({ clicks: 6, facesDestroyed: 6 });
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
