import { describe, expect, it } from 'vitest';

import { createEngine, type GameEngine, type GameEvent } from '../game/engine';
import { frontFace, type Orientation } from '../game/rotation';
import type { FaceId, Phase } from '../game/types';
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

/** One raw key through the real map → dispatch path; a `null` mapping dispatches nothing. */
function pressKey(engine: GameEngine, key: string, phase: Phase): void {
  const event = mapKey(key, phase);
  if (event !== null) {
    engine.dispatch(event);
  }
}

/** Every key the removed keyboard selection cursor used to bind (spec AC-6). */
const REMOVED_CURSOR_KEYS = ['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'Enter', ' '] as const;

describe('mapKey — playing key→event table (AC-7)', () => {
  it('maps the arrow keys to one rotation step each', () => {
    expectMapping('ArrowLeft', 'playing', { type: 'rotate', axis: 'yaw', direction: -1 });
    expectMapping('ArrowRight', 'playing', { type: 'rotate', axis: 'yaw', direction: 1 });
    expectMapping('ArrowUp', 'playing', { type: 'rotate', axis: 'pitch', direction: 1 });
    expectMapping('ArrowDown', 'playing', { type: 'rotate', axis: 'pitch', direction: -1 });
  });

  it('maps the removed WASD, Enter and space keys to no command at all (AC-6)', () => {
    for (const key of REMOVED_CURSOR_KEYS) {
      expectMapping(key, 'playing', null);
    }
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
  it('skips the intro with an unbound key, rotates with the arrows and ignores the removed keys', () => {
    const engine = createEngine({ random: () => 0.5 });
    expect(engine.getSnapshot().phase).toBe('intro');

    pressKey(engine, 'Escape', 'intro');
    expect(engine.getSnapshot().phase).toBe('playing');
    engine.drainIntents();

    pressKey(engine, 'ArrowRight', 'playing');
    expect(engine.getSnapshot().orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });
    engine.advance(300); // DEFAULT_TIMINGS.rotationMs: the step settles.
    expect(engine.getSnapshot().rotationFrom).toBeNull();

    // The removed cursor keys produce no event, so the engine state does not move at all.
    const before = engine.getSnapshot();
    for (const key of REMOVED_CURSOR_KEYS) {
      pressKey(engine, key, 'playing');
    }
    expect(engine.getSnapshot()).toBe(before);
    expect(engine.getSnapshot().stats).toEqual({ clicks: 0, facesDestroyed: 0 });
    expect(engine.drainIntents()).toEqual([]);
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
