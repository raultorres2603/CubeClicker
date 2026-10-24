import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';

import { createEngine, type EngineSnapshot } from '../game/engine';
import { CUBE_STYLES } from '../game/progression';
import type { FaceId, MiniCubeId } from '../game/types';
import { createCubeView } from '../render/cube-view';
import { pickMiniCube } from '../render/picking';
import * as gesturesModule from './gestures';
import { classifyPointer, type PointerGesture } from './gestures';

/** The canvas surface every gesture below happens on: 800 × 600 CSS pixels. */
const RECT = { width: 800, height: 600 };

/** The rect centre — `ndcX 0`, `ndcY 0` — used as the anchor of the threshold cases. */
const CENTER = { x: 400, y: 300 };

/** The two Pointer Events pointer types this feature plays on. */
type PointerType = 'mouse' | 'touch';

/**
 * A pointer sample as Pointer Events carries it. `classifyPointer` only accepts `{ x, y }`,
 * so `pointerType` rides along at runtime but is deliberately not part of the contract; a
 * branch that read it would make the parity assertions below disagree.
 */
interface PointerSample {
  x: number;
  y: number;
  pointerType: PointerType;
}

/**
 * Classifies one gesture from a touch or mouse sample with the same coordinates. Both
 * pointer types reach `classifyPointer` with the identical three numeric arguments; only
 * the carried (unused) pointer type differs.
 */
function classifyAs(
  pointerType: PointerType,
  start: { x: number; y: number },
  current: { x: number; y: number },
  rect = RECT,
): PointerGesture {
  const startSample: PointerSample = { ...start, pointerType };
  const currentSample: PointerSample = { ...current, pointerType };
  return classifyPointer(startSample, currentSample, rect);
}

/** The ids still present on one face of the snapshot's board, in board order. */
function faceIds(snapshot: EngineSnapshot, faceId: FaceId): MiniCubeId[] {
  const face = snapshot.board.faces.find((candidate) => candidate.id === faceId);
  if (face === undefined) {
    throw new Error(`the board has no face ${faceId}`);
  }
  return face.miniCubes.map((miniCube) => miniCube.id);
}

describe('classifyPointer — tap/drag threshold (AC-6)', () => {
  it('classifies 39 px of travel as a tap at the current position', () => {
    expect(classifyPointer({ x: 361, y: 300 }, CENTER, RECT)).toEqual({
      kind: 'tap',
      ndcX: 0,
      ndcY: 0,
    });
  });

  it('classifies exactly 40 px of travel as a tap (threshold inclusive)', () => {
    expect(classifyPointer({ x: 360, y: 300 }, CENTER, RECT)).toEqual({
      kind: 'tap',
      ndcX: 0,
      ndcY: 0,
    });
  });

  it('classifies a zero-travel press/release as a tap', () => {
    expect(classifyPointer(CENTER, CENTER, RECT)).toEqual({ kind: 'tap', ndcX: 0, ndcY: 0 });
  });

  it('classifies 41 px of travel as a drag', () => {
    expect(classifyPointer({ x: 359, y: 300 }, CENTER, RECT)).toEqual({
      kind: 'drag',
      axis: 'yaw',
      direction: 1,
    });
  });

  it('holds the boundary for a diagonal gesture too (32/24 px is exactly 40 px)', () => {
    expect(classifyPointer({ x: 368, y: 324 }, CENTER, RECT)).toEqual({
      kind: 'tap',
      ndcX: 0,
      ndcY: 0,
    });
    expect(classifyPointer({ x: 367, y: 324 }, CENTER, RECT)).toEqual({
      kind: 'drag',
      axis: 'yaw',
      direction: 1,
    });
  });

  it('carries the release position into the tap NDC (a −40 px tap is still a tap)', () => {
    expect(classifyPointer({ x: 340, y: 300 }, { x: 300, y: 300 }, RECT)).toEqual({
      kind: 'tap',
      ndcX: -0.25,
      ndcY: 0,
    });
  });
});

describe('classifyPointer — touch/mouse parity at the boundary (AC-9, AC-10)', () => {
  it('classifies a 39 px touch tap exactly like a 39 px mouse tap', () => {
    expect(classifyAs('touch', { x: 361, y: 300 }, CENTER)).toEqual({
      kind: 'tap',
      ndcX: 0,
      ndcY: 0,
    });
    expect(classifyAs('mouse', { x: 361, y: 300 }, CENTER)).toEqual({
      kind: 'tap',
      ndcX: 0,
      ndcY: 0,
    });
  });

  it('classifies exactly 40 px of touch travel as a tap, like the mouse (inclusive boundary)', () => {
    // The predecessor contract is retained verbatim: 40 px is still a tap, 41 px is a drag.
    expect(classifyAs('touch', { x: 360, y: 300 }, CENTER)).toEqual({
      kind: 'tap',
      ndcX: 0,
      ndcY: 0,
    });
    expect(classifyAs('mouse', { x: 360, y: 300 }, CENTER)).toEqual({
      kind: 'tap',
      ndcX: 0,
      ndcY: 0,
    });
  });

  it('classifies a 41 px touch drag exactly like a 41 px mouse drag', () => {
    expect(classifyAs('touch', { x: 359, y: 300 }, CENTER)).toEqual({
      kind: 'drag',
      axis: 'yaw',
      direction: 1,
    });
    expect(classifyAs('mouse', { x: 359, y: 300 }, CENTER)).toEqual({
      kind: 'drag',
      axis: 'yaw',
      direction: 1,
    });
  });

  it('classifies a vertical touch drag exactly like the mouse drag', () => {
    expect(classifyAs('touch', { x: 400, y: 359 }, CENTER)).toEqual({
      kind: 'drag',
      axis: 'pitch',
      direction: -1,
    });
    expect(classifyAs('mouse', { x: 400, y: 359 }, CENTER)).toEqual({
      kind: 'drag',
      axis: 'pitch',
      direction: -1,
    });
  });

  it('carries a touch release position into the tap NDC exactly like the mouse', () => {
    expect(classifyAs('touch', { x: 340, y: 300 }, { x: 300, y: 300 })).toEqual({
      kind: 'tap',
      ndcX: -0.25,
      ndcY: 0,
    });
    expect(classifyAs('mouse', { x: 340, y: 300 }, { x: 300, y: 300 })).toEqual({
      kind: 'tap',
      ndcX: -0.25,
      ndcY: 0,
    });
  });
});

describe('classifyPointer — dominant axis and direction (AC-6)', () => {
  it('takes yaw with direction +1 for a rightward drag (content follows the pointer)', () => {
    expect(classifyPointer({ x: 300, y: 300 }, { x: 400, y: 300 }, RECT)).toEqual({
      kind: 'drag',
      axis: 'yaw',
      direction: 1,
    });
  });

  it('takes yaw with direction −1 for a leftward drag', () => {
    expect(classifyPointer({ x: 500, y: 300 }, { x: 400, y: 300 }, RECT)).toEqual({
      kind: 'drag',
      axis: 'yaw',
      direction: -1,
    });
  });

  it('takes pitch with direction +1 for a downward drag', () => {
    expect(classifyPointer({ x: 400, y: 200 }, { x: 400, y: 300 }, RECT)).toEqual({
      kind: 'drag',
      axis: 'pitch',
      direction: 1,
    });
  });

  it('takes pitch with direction −1 for an upward drag', () => {
    expect(classifyPointer({ x: 400, y: 400 }, { x: 400, y: 300 }, RECT)).toEqual({
      kind: 'drag',
      axis: 'pitch',
      direction: -1,
    });
  });

  it('picks the dominant axis of a diagonal drag: horizontal when |dx| > |dy|', () => {
    // dx = −50, dy = +30 (58.31 px of travel).
    expect(classifyPointer({ x: 450, y: 270 }, CENTER, RECT)).toEqual({
      kind: 'drag',
      axis: 'yaw',
      direction: -1,
    });
  });

  it('picks the dominant axis of a diagonal drag: vertical when |dy| > |dx|', () => {
    // dx = +30, dy = −50 (58.31 px of travel).
    expect(classifyPointer({ x: 370, y: 350 }, CENTER, RECT)).toEqual({
      kind: 'drag',
      axis: 'pitch',
      direction: -1,
    });
  });

  it('picks the vertical axis of a diagonal drag that pulls downwards', () => {
    // dx = −30, dy = +50.
    expect(classifyPointer({ x: 430, y: 250 }, CENTER, RECT)).toEqual({
      kind: 'drag',
      axis: 'pitch',
      direction: 1,
    });
  });

  it('resolves an exact |dx| = |dy| tie to the horizontal (yaw) axis', () => {
    // dx = +41, dy = +41 (57.98 px of travel).
    expect(classifyPointer({ x: 359, y: 259 }, CENTER, RECT)).toEqual({
      kind: 'drag',
      axis: 'yaw',
      direction: 1,
    });
  });
});

describe('classifyPointer — NDC mapping', () => {
  /** A press-and-release on one spot: zero travel, so the tap is always a tap. */
  function tapAt(x: number, y: number, rect: { width: number; height: number }): PointerGesture {
    return classifyPointer({ x, y }, { x, y }, rect);
  }

  it('maps the rect corners to ±1 with screen y pointing up', () => {
    expect(tapAt(0, 0, RECT)).toEqual({ kind: 'tap', ndcX: -1, ndcY: 1 });
    expect(tapAt(800, 600, RECT)).toEqual({ kind: 'tap', ndcX: 1, ndcY: -1 });
  });

  it('maps the rect midpoints to exact quarter values', () => {
    expect(tapAt(200, 150, RECT)).toEqual({ kind: 'tap', ndcX: -0.5, ndcY: 0.5 });
    expect(tapAt(600, 450, RECT)).toEqual({ kind: 'tap', ndcX: 0.5, ndcY: -0.5 });
  });

  it('treats the positions as rect-relative (same point, half-size rect → centre)', () => {
    expect(tapAt(200, 150, { width: 400, height: 300 })).toEqual({ kind: 'tap', ndcX: 0, ndcY: 0 });
  });

  it('does not clamp a release position outside the rect', () => {
    expect(tapAt(900, 300, RECT)).toEqual({ kind: 'tap', ndcX: 1.25, ndcY: 0 });
    expect(tapAt(-100, 300, RECT)).toEqual({ kind: 'tap', ndcX: -1.25, ndcY: 0 });
  });

  it('returns null for a tap on a degenerate rect (zero or negative extent)', () => {
    expect(classifyPointer(CENTER, CENTER, { width: 0, height: 600 })).toBeNull();
    expect(classifyPointer(CENTER, CENTER, { width: 800, height: 0 })).toBeNull();
    expect(classifyPointer(CENTER, CENTER, { width: -800, height: -600 })).toBeNull();
  });

  it('still classifies a drag on a degenerate rect (a drag needs no NDC)', () => {
    expect(classifyPointer({ x: 359, y: 300 }, CENTER, { width: 0, height: 0 })).toEqual({
      kind: 'drag',
      axis: 'yaw',
      direction: 1,
    });
  });
});

describe('input API surface — no joystick or rotate control (AC-12)', () => {
  it('exports only the pointer classifier, with no pointer-type or control input', () => {
    expect(Object.keys(gesturesModule)).toEqual(['classifyPointer']);
    // (start, current, rect) only: there is no pointerType/pointerId input to branch on.
    expect(gesturesModule.classifyPointer.length).toBe(3);
  });
});

describe('integration — a touch tap picks and explodes the front-face tile (AC-9)', () => {
  it('resolves the centre tap to front:2:2 and explodes it on the real engine', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 200);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, 0);
    const cubeView = createCubeView(CUBE_STYLES[0]!);

    // Pinned 5 × 5 grid (the mapped cube view's grid) so the tile id and counts are exact.
    const engine = createEngine({ gridSize: 5 });
    engine.dispatch({ type: 'introSkip' });
    expect(engine.getSnapshot().phase).toBe('playing');

    // A touch press/release on the 800 × 600 canvas centre: travel 0 → tap at ndc (0, 0).
    const gesture = classifyAs('touch', CENTER, CENTER);
    if (gesture === null || gesture.kind !== 'tap') {
      throw new Error(`expected a tap, got ${JSON.stringify(gesture)}`);
    }
    expect(gesture).toEqual({ kind: 'tap', ndcX: 0, ndcY: 0 });

    // The session's playing-tap policy: pick the current front face, then explode the hit
    // tile. The drag path never reaches this code (the session ignores classified drags).
    const id = pickMiniCube(camera, cubeView, 'front', gesture.ndcX, gesture.ndcY);
    expect(id).toBe('front:2:2');
    engine.dispatch({ type: 'explodeMiniCube', id: id! });

    const exploded = engine.getSnapshot();
    expect(exploded.stats).toEqual({ clicks: 1, facesDestroyed: 0 });
    expect(exploded.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(faceIds(exploded, 'front')).toHaveLength(24);
    expect(faceIds(exploded, 'front')).not.toContain('front:2:2');
    expect(faceIds(exploded, 'front')).toContain('front:0:0');
  });
});
