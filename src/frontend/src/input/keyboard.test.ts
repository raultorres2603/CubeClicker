import { describe, expect, it } from 'vitest';

import { remainingOnFace } from '../game/board';
import { createEngine, type GameEvent } from '../game/engine';
import { frontFace, type Orientation } from '../game/rotation';
import { GRID_SIZE, type FaceId, type Phase } from '../game/types';
import { mapKey } from './keyboard';

/** Asserts one row of the key table: `mapKey(key, phase)` is exactly `expected`. */
function expectMapping(key: string, phase: Phase, expected: GameEvent | null): void {
  expect({ key, phase, event: mapKey(key, phase) }).toEqual({ key, phase, event: expected });
}

/** The `mapKey` result for a key that must map (a wrong `null` fails the test). */
function mustMap(key: string, phase: Phase): GameEvent {
  const event = mapKey(key, phase);
  if (event === null) {
    throw new Error(`${JSON.stringify(key)} did not map in phase ${phase}`);
  }
  return event;
}

describe('mapKey — playing key→event table (AC-7)', () => {
  it('maps the arrow keys to one rotation step each', () => {
    expectMapping('ArrowLeft', 'playing', { type: 'rotate', axis: 'yaw', direction: -1 });
    expectMapping('ArrowRight', 'playing', { type: 'rotate', axis: 'yaw', direction: 1 });
    expectMapping('ArrowUp', 'playing', { type: 'rotate', axis: 'pitch', direction: 1 });
    expectMapping('ArrowDown', 'playing', { type: 'rotate', axis: 'pitch', direction: -1 });
  });

  it('maps lower-case WASD to the four cursor steps', () => {
    expectMapping('w', 'playing', { type: 'cursorMove', dx: 0, dy: -1 });
    expectMapping('a', 'playing', { type: 'cursorMove', dx: -1, dy: 0 });
    expectMapping('s', 'playing', { type: 'cursorMove', dx: 0, dy: 1 });
    expectMapping('d', 'playing', { type: 'cursorMove', dx: 1, dy: 0 });
  });

  it('maps upper-case WASD identically (case-insensitive)', () => {
    expectMapping('W', 'playing', { type: 'cursorMove', dx: 0, dy: -1 });
    expectMapping('A', 'playing', { type: 'cursorMove', dx: -1, dy: 0 });
    expectMapping('S', 'playing', { type: 'cursorMove', dx: 0, dy: 1 });
    expectMapping('D', 'playing', { type: 'cursorMove', dx: 1, dy: 0 });
  });

  it('maps Enter and space to explodeCursor', () => {
    expectMapping('Enter', 'playing', { type: 'explodeCursor' });
    expectMapping(' ', 'playing', { type: 'explodeCursor' });
  });
});

describe('mapKey — phase policy (AC-2)', () => {
  it('skips the intro on any key, bound or not', () => {
    for (const key of ['a', 'W', 'd', 'ArrowLeft', 'ArrowUp', 'Enter', ' ', 'Escape', 'F5', '?', '']) {
      expectMapping(key, 'intro', { type: 'introSkip' });
    }
  });

  it('returns null for keys that are not bound while playing', () => {
    for (const key of ['Escape', 'q', 'p', 'e', 'ARROWLEFT', 'arrowleft', 'wasd', 'Token', 'Tab', 'Shift', '?', '']) {
      expectMapping(key, 'playing', null);
    }
  });

  it('returns null for every key while traveling', () => {
    const keys = [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'w',
      'W',
      'a',
      'A',
      's',
      'S',
      'd',
      'D',
      'Enter',
      ' ',
      'Escape',
    ];
    for (const key of keys) {
      expectMapping(key, 'travel', null);
    }
  });
});

describe('integration — mapKey results drive the real engine', () => {
  it('skips the intro with an unbound key, then moves the cursor and explodes with Enter', () => {
    const engine = createEngine({ random: () => 0.5 });
    expect(engine.getSnapshot().phase).toBe('intro');
    expect(mapKey('Escape', 'intro')).toEqual({ type: 'introSkip' });

    engine.dispatch(mustMap('Escape', 'intro'));
    expect(engine.getSnapshot().phase).toBe('playing');

    // `w` steps the cursor one row up from the front-face centre (row 2, col 2).
    engine.dispatch(mustMap('w', 'playing'));
    expect(engine.getSnapshot().cursor).toEqual({ faceId: 'front', row: 1, col: 2 });

    // Enter explodes the highlighted mini-cube through the click-identical path.
    engine.dispatch(mustMap('Enter', 'playing'));
    const snapshot = engine.getSnapshot();
    expect(snapshot.stats).toEqual({ clicks: 1, facesDestroyed: 0 });
    expect(remainingOnFace(snapshot.board, 'front')).toBe(GRID_SIZE * GRID_SIZE - 1);
    // The cursor re-anchors to the nearest remaining cell: row-major lowest row first.
    expect(snapshot.cursor).toEqual({ faceId: 'front', row: 0, col: 2 });

    const intents = engine.drainIntents();
    expect(intents).toHaveLength(1);
    const [explosion] = intents;
    if (explosion === undefined || explosion.kind !== 'explosion') {
      throw new Error(`expected one explosion intent, got ${JSON.stringify(intents)}`);
    }
    expect(explosion.id).toBe('front:1:2');
    expect(explosion.faceId).toBe('front');
    expect(explosion.burst.particles).toHaveLength(24);
  });

  it('drives the cursor with WASD and clamps it at the grid edge', () => {
    const engine = createEngine();
    engine.dispatch(mustMap('Escape', 'intro'));

    for (let press = 0; press < GRID_SIZE; press++) {
      engine.dispatch(mustMap('a', 'playing'));
    }
    expect(engine.getSnapshot().cursor).toEqual({ faceId: 'front', row: 2, col: 0 });

    engine.dispatch(mustMap('d', 'playing'));
    engine.dispatch(mustMap('S', 'playing'));
    expect(engine.getSnapshot().cursor).toEqual({ faceId: 'front', row: 3, col: 1 });
  });

  it('reaches all six faces with arrow keys alone (AC-7)', () => {
    const reachable: ReadonlyArray<readonly [FaceId, readonly string[]]> = [
      ['front', []],
      ['left', ['ArrowRight']],
      ['back', ['ArrowRight', 'ArrowRight']],
      ['right', ['ArrowLeft']],
      ['top', ['ArrowUp']],
      ['bottom', ['ArrowDown']],
    ];

    for (const [faceId, keys] of reachable) {
      const engine = createEngine();
      engine.dispatch(mustMap('Escape', 'intro'));
      for (const key of keys) {
        engine.dispatch(mustMap(key, 'playing'));
        engine.advance(300); // DEFAULT_TIMINGS.rotationMs: one settled step per press.
      }
      const snapshot = engine.getSnapshot();
      expect({
        keys,
        front: frontFace(snapshot.orientation),
        rotationFrom: snapshot.rotationFrom,
        rotationProgress: snapshot.rotationProgress,
      }).toEqual({ keys, front: faceId, rotationFrom: null, rotationProgress: 1 });
    }
  });

  it('pins the exact orientation counters the arrows reach', () => {
    const engine = createEngine({ random: () => 0.5 });
    engine.dispatch(mustMap('Escape', 'intro'));

    const steps: ReadonlyArray<readonly [string, Orientation]> = [
      ['ArrowLeft', { yawSteps: 3, pitchSteps: 0 }],
      ['ArrowUp', { yawSteps: 3, pitchSteps: 1 }],
      ['ArrowRight', { yawSteps: 0, pitchSteps: 1 }],
      ['ArrowDown', { yawSteps: 0, pitchSteps: 0 }],
    ];

    for (const [key, expected] of steps) {
      engine.dispatch(mustMap(key, 'playing'));
      engine.advance(300);
      const snapshot = engine.getSnapshot();
      expect({ key, orientation: snapshot.orientation, rotationFrom: snapshot.rotationFrom }).toEqual({
        key,
        orientation: expected,
        rotationFrom: null,
      });
    }
  });
});
