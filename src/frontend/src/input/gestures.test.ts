import { describe, expect, it } from 'vitest';

import { createEngine } from '../game/engine';
import { classifyPointer, type PointerGesture } from './gestures';

/** The canvas surface every gesture below happens on: 800 × 600 CSS pixels. */
const RECT = { width: 800, height: 600 };

/** The rect centre — `ndcX 0`, `ndcY 0` — used as the anchor of the threshold cases. */
const CENTER = { x: 400, y: 300 };

/** A drag classified by `classifyPointer` (fails the test when it is not a drag). */
function asDrag(gesture: PointerGesture): { axis: 'yaw' | 'pitch'; direction: -1 | 1 } {
  if (gesture === null || gesture.kind !== 'drag') {
    throw new Error(`expected a drag, got ${JSON.stringify(gesture)}`);
  }
  return { axis: gesture.axis, direction: gesture.direction };
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

describe('integration — a classified drag drives the real engine', () => {
  it('steps the cube one yaw turn and settles on an exact quarter turn', () => {
    const engine = createEngine();
    engine.dispatch({ type: 'introSkip' });
    expect(engine.getSnapshot().phase).toBe('playing');

    // A rightward drag on a real 800 × 600 canvas: yaw +1 (+90° about +Y).
    const gesture = classifyPointer({ x: 300, y: 300 }, { x: 400, y: 300 }, RECT);
    const drag = asDrag(gesture);
    expect(drag).toEqual({ axis: 'yaw', direction: 1 });

    engine.dispatch({ type: 'rotate', axis: drag.axis, direction: drag.direction });

    const animating = engine.getSnapshot();
    expect(animating.orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });
    // The step is in flight: DEFAULT_TIMINGS.rotationMs is 300.
    expect(animating.rotationFrom).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(animating.rotationProgress).toBe(0);

    engine.advance(150);
    expect(engine.getSnapshot().rotationProgress).toBe(0.5);

    engine.advance(150);
    const settled = engine.getSnapshot();
    expect(settled.rotationFrom).toBeNull();
    expect(settled.rotationProgress).toBe(1);
    expect(settled.orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });
    expect(settled.phase).toBe('playing');
  });
});
