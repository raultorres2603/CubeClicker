import { describe, expect, it } from 'vitest';

import {
  createOrientation,
  frontFace,
  interpolateRotation,
  rotateStep,
  type Orientation,
} from './rotation';
import { FACE_IDS, type FaceId } from './types';

/** One quarter turn in radians — the settle unit asserted throughout. */
const QUARTER_TURN = Math.PI / 2;

/** Face normals in the cube's own frame: `+X` right, `+Y` up, `+Z` towards the camera. */
const FACE_NORMALS: Readonly<Record<FaceId, readonly [number, number, number]>> = {
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  top: [0, 1, 0],
  bottom: [0, -1, 0],
};

/** One reachable orientation per face, built only from single quarter-turn steps (AC-7). */
const ORIENTATION_PER_FACE: Readonly<Record<FaceId, Orientation>> = {
  front: createOrientation(),
  left: rotateStep(createOrientation(), 'yaw', 1),
  back: rotateStep(rotateStep(createOrientation(), 'yaw', 1), 'yaw', 1),
  right: rotateStep(rotateStep(rotateStep(createOrientation(), 'yaw', 1), 'yaw', 1), 'yaw', 1),
  top: rotateStep(createOrientation(), 'pitch', 1),
  bottom: rotateStep(createOrientation(), 'pitch', -1),
};

/** `Rx(pitch)·Ry(yaw)` — the rotation the renderer applies for an interpolated orientation. */
function rotateByEulerXyz(
  vector: readonly [number, number, number],
  pitch: number,
  yaw: number,
): [number, number, number] {
  const [x, y, z] = vector;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const afterYaw: [number, number, number] = [
    x * cosYaw + z * sinYaw,
    y,
    -x * sinYaw + z * cosYaw,
  ];
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  return [
    afterYaw[0],
    afterYaw[1] * cosPitch - afterYaw[2] * sinPitch,
    afterYaw[1] * sinPitch + afterYaw[2] * cosPitch,
  ];
}

describe('createOrientation', () => {
  it('starts unrotated, so the front face faces the camera', () => {
    const orientation = createOrientation();

    expect(orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(frontFace(orientation)).toBe('front');
  });
});

describe('rotateStep', () => {
  it('turns one quarter turn per yaw step and wraps at a full revolution', () => {
    const start = createOrientation();

    const left = rotateStep(start, 'yaw', 1);
    const back = rotateStep(left, 'yaw', 1);
    const right = rotateStep(back, 'yaw', 1);
    const front = rotateStep(right, 'yaw', 1);

    expect(left).toEqual({ yawSteps: 1, pitchSteps: 0 });
    expect(back).toEqual({ yawSteps: 2, pitchSteps: 0 });
    expect(right).toEqual({ yawSteps: 3, pitchSteps: 0 });
    expect(front).toEqual({ yawSteps: 0, pitchSteps: 0 });
  });

  it('keeps yaw inside 0..3 when stepping backwards from the default orientation', () => {
    expect(rotateStep(createOrientation(), 'yaw', -1)).toEqual({ yawSteps: 3, pitchSteps: 0 });
  });

  it('clamps pitch to one quarter turn at both poles', () => {
    const top = rotateStep(createOrientation(), 'pitch', 1);
    const fromTop = rotateStep(top, 'pitch', 1);
    const bottom = rotateStep(rotateStep(top, 'pitch', -1), 'pitch', -1);
    const fromBottom = rotateStep(bottom, 'pitch', -1);

    expect(top).toEqual({ yawSteps: 0, pitchSteps: 1 });
    expect(fromTop).toEqual({ yawSteps: 0, pitchSteps: 1 });
    expect(bottom).toEqual({ yawSteps: 0, pitchSteps: -1 });
    expect(fromBottom).toEqual({ yawSteps: 0, pitchSteps: -1 });
  });

  it('leaves the other axis untouched', () => {
    expect(rotateStep({ yawSteps: 2, pitchSteps: -1 }, 'yaw', 1)).toEqual({
      yawSteps: 3,
      pitchSteps: -1,
    });
    expect(rotateStep({ yawSteps: 3, pitchSteps: 1 }, 'pitch', -1)).toEqual({
      yawSteps: 3,
      pitchSteps: 0,
    });
  });

  it('returns a fresh orientation and never mutates its input', () => {
    const before: Orientation = { yawSteps: 1, pitchSteps: 0 };

    const after = rotateStep(before, 'yaw', 1);

    expect(after).not.toBe(before);
    expect(before).toEqual({ yawSteps: 1, pitchSteps: 0 });
  });
});

describe('frontFace', () => {
  it('reports the face each single keyboard step brings to the front', () => {
    const start = createOrientation();

    expect(frontFace(rotateStep(start, 'yaw', 1))).toBe('left');
    expect(frontFace(rotateStep(start, 'yaw', -1))).toBe('right');
    expect(frontFace(rotateStep(start, 'pitch', 1))).toBe('top');
    expect(frontFace(rotateStep(start, 'pitch', -1))).toBe('bottom');
  });

  it('reaches all six faces through keyboard steps only (AC-7)', () => {
    const start = createOrientation();
    const left = rotateStep(start, 'yaw', 1);
    const back = rotateStep(left, 'yaw', 1);
    const right = rotateStep(back, 'yaw', 1);
    const top = rotateStep(start, 'pitch', 1);
    const bottom = rotateStep(start, 'pitch', -1);

    expect([
      frontFace(start),
      frontFace(left),
      frontFace(back),
      frontFace(right),
      frontFace(top),
      frontFace(bottom),
    ]).toEqual(['front', 'left', 'back', 'right', 'top', 'bottom']);
  });

  it('keeps a pole in front whatever the yaw is', () => {
    const yawSteps = [0, 1, 2, 3];

    expect(yawSteps.map((yawSteps_) => frontFace({ yawSteps: yawSteps_, pitchSteps: 1 }))).toEqual([
      'top',
      'top',
      'top',
      'top',
    ]);
    expect(yawSteps.map((yawSteps_) => frontFace({ yawSteps: yawSteps_, pitchSteps: -1 }))).toEqual([
      'bottom',
      'bottom',
      'bottom',
      'bottom',
    ]);
  });

  it('agrees with the camera-facing face of the rotation the renderer applies', () => {
    for (const faceId of FACE_IDS) {
      const orientation = ORIENTATION_PER_FACE[faceId];
      const { yaw, pitch } = interpolateRotation(createOrientation(), orientation, 1);

      const rotated = rotateByEulerXyz(FACE_NORMALS[faceId], pitch, yaw);

      expect(frontFace(orientation)).toBe(faceId);
      // Quarter-turn trigonometry is exact up to float noise (~1e-16), so each axis
      // is compared as the integer it is (`+ 0` folds a rounded `-0` into `0`): the
      // face normal must point at the camera.
      expect(rotated.map((component) => Math.round(component) + 0)).toEqual([0, 0, 1]);
    }
  });
});

describe('interpolateRotation', () => {
  it('starts at the source rotation and settles on an exact quarter turn', () => {
    const from = createOrientation();
    const to = rotateStep(from, 'yaw', 1);

    expect(interpolateRotation(from, to, 0)).toEqual({ yaw: 0, pitch: 0 });
    expect(interpolateRotation(from, to, 0.5)).toEqual({ yaw: 0.5 * QUARTER_TURN, pitch: 0 });
    expect(interpolateRotation(from, to, 1)).toEqual({ yaw: 1 * QUARTER_TURN, pitch: 0 });
  });

  it('interpolates pitch towards the top and settles one quarter turn up', () => {
    const from = createOrientation();
    const to = rotateStep(from, 'pitch', 1);

    expect(interpolateRotation(from, to, 0)).toEqual({ yaw: 0, pitch: 0 });
    expect(interpolateRotation(from, to, 0.25)).toEqual({ yaw: 0, pitch: 0.25 * QUARTER_TURN });
    expect(interpolateRotation(from, to, 1)).toEqual({ yaw: 0, pitch: 1 * QUARTER_TURN });
  });

  it('takes the short way around the yaw seam', () => {
    const threeQuarters = rotateStep(createOrientation(), 'yaw', -1); // right face in front
    const wrapped = rotateStep(threeQuarters, 'yaw', 1); // back to the front face

    expect(threeQuarters).toEqual({ yawSteps: 3, pitchSteps: 0 });
    expect(wrapped).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(interpolateRotation(threeQuarters, wrapped, 0)).toEqual({
      yaw: 3 * QUARTER_TURN,
      pitch: 0,
    });
    expect(interpolateRotation(threeQuarters, wrapped, 0.5)).toEqual({
      yaw: 3.5 * QUARTER_TURN,
      pitch: 0,
    });
    expect(interpolateRotation(threeQuarters, wrapped, 1)).toEqual({ yaw: 4 * QUARTER_TURN, pitch: 0 });
  });

  it('turns both axes at once and never mutates its inputs', () => {
    const from: Orientation = { yawSteps: 1, pitchSteps: 0 };
    const to: Orientation = { yawSteps: 3, pitchSteps: -1 };

    expect(interpolateRotation(from, to, 0.25)).toEqual({
      yaw: 1.5 * QUARTER_TURN,
      pitch: -0.25 * QUARTER_TURN,
    });
    expect(from).toEqual({ yawSteps: 1, pitchSteps: 0 });
    expect(to).toEqual({ yawSteps: 3, pitchSteps: -1 });
  });

  it('settles on exact quarter-turn multiples for every reachable face', () => {
    const settled: Readonly<Record<FaceId, { yaw: number; pitch: number }>> = {
      front: { yaw: 0, pitch: 0 },
      left: { yaw: 1 * QUARTER_TURN, pitch: 0 },
      back: { yaw: 2 * QUARTER_TURN, pitch: 0 },
      right: { yaw: -1 * QUARTER_TURN, pitch: 0 },
      top: { yaw: 0, pitch: 1 * QUARTER_TURN },
      bottom: { yaw: 0, pitch: -1 * QUARTER_TURN },
    };

    for (const faceId of FACE_IDS) {
      const rotation = interpolateRotation(createOrientation(), ORIENTATION_PER_FACE[faceId], 1);

      expect(rotation).toEqual(settled[faceId]);
    }
  });
});
