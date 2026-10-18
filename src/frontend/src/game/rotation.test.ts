import { describe, expect, it } from 'vitest';

import { createBoard, removeMiniCube } from './board';
import {
  createCursor,
  createOrientation,
  frontFace,
  interpolateRotation,
  moveCursor,
  reanchorCursor,
  rotateStep,
  type Cursor,
  type Orientation,
} from './rotation';
import { FACE_IDS, GRID_SIZE, type Board, type FaceId, type MiniCubeId } from './types';

/** One quarter turn in radians — the settle unit asserted throughout. */
const QUARTER_TURN = Math.PI / 2;

/** Center cell of the default grid (row 2, col 2). */
const CENTER = Math.floor(GRID_SIZE / 2);

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

/** A front-face cursor at explicit coordinates. */
function cursorAt(row: number, col: number): Cursor {
  return { faceId: 'front', row, col };
}

/** Removes a list of ids from a board, returning the resulting board. */
function removeIds(board: Board, ids: readonly MiniCubeId[]): Board {
  let current = board;
  for (const id of ids) {
    current = removeMiniCube(current, id).board;
  }
  return current;
}

/** Every id of one face of the default grid, in board order (rows, then columns). */
function idsOfFace(faceId: FaceId): MiniCubeId[] {
  return Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, position): MiniCubeId => {
    return `${faceId}:${Math.floor(position / GRID_SIZE)}:${position % GRID_SIZE}`;
  });
}

/** Empties one face, leaving the other five playable. */
function removeFace(board: Board, faceId: FaceId): Board {
  return removeIds(board, idsOfFace(faceId));
}

/** Keeps only the listed `[row, col]` cells of one face (everything else is removed). */
function keepOnlyOnFace(
  board: Board,
  faceId: FaceId,
  coords: readonly (readonly [number, number])[],
): Board {
  const keep = new Set(coords.map(([row, col]) => `${faceId}:${row}:${col}`));
  return removeIds(
    board,
    idsOfFace(faceId).filter((id) => !keep.has(id)),
  );
}

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

describe('createCursor', () => {
  it('anchors to the center of the front face', () => {
    expect(createCursor()).toEqual({ faceId: 'front', row: 2, col: 2 });
    expect(createCursor()).toEqual({ faceId: 'front', row: CENTER, col: CENTER });
  });

  it('scales the center to an explicit grid size', () => {
    expect(createCursor(1)).toEqual({ faceId: 'front', row: 0, col: 0 });
    expect(createCursor(3)).toEqual({ faceId: 'front', row: 1, col: 1 });
    expect(createCursor(4)).toEqual({ faceId: 'front', row: 2, col: 2 });
  });

  it('returns a fresh cursor on every call', () => {
    expect(createCursor()).not.toBe(createCursor());
  });
});

describe('moveCursor', () => {
  it('moves one cell per step: dy for rows, dx for columns', () => {
    const center = createCursor();

    expect(moveCursor(center, 0, -1)).toEqual({ faceId: 'front', row: 1, col: 2 }); // up
    expect(moveCursor(center, 0, 1)).toEqual({ faceId: 'front', row: 3, col: 2 }); // down
    expect(moveCursor(center, -1, 0)).toEqual({ faceId: 'front', row: 2, col: 1 }); // left
    expect(moveCursor(center, 1, 0)).toEqual({ faceId: 'front', row: 2, col: 3 }); // right
  });

  it('clamps at all four edges instead of wrapping', () => {
    expect(moveCursor({ faceId: 'front', row: 0, col: 0 }, -1, -1)).toEqual({
      faceId: 'front',
      row: 0,
      col: 0,
    });
    expect(moveCursor({ faceId: 'front', row: 0, col: 0 }, 0, -1)).toEqual({
      faceId: 'front',
      row: 0,
      col: 0,
    });
    expect(moveCursor({ faceId: 'front', row: 4, col: 4 }, 1, 1)).toEqual({
      faceId: 'front',
      row: 4,
      col: 4,
    });
    expect(moveCursor({ faceId: 'front', row: 4, col: 0 }, -1, 1)).toEqual({
      faceId: 'front',
      row: 4,
      col: 0,
    });
    expect(moveCursor({ faceId: 'front', row: 0, col: 4 }, 1, -1)).toEqual({
      faceId: 'front',
      row: 0,
      col: 4,
    });
  });

  it('clamps to an explicit grid size and keeps the cursor on its face', () => {
    expect(moveCursor({ faceId: 'top', row: 2, col: 2 }, 1, 1, 3)).toEqual({
      faceId: 'top',
      row: 2,
      col: 2,
    });
    expect(moveCursor({ faceId: 'top', row: 0, col: 0 }, -1, -1, 3)).toEqual({
      faceId: 'top',
      row: 0,
      col: 0,
    });
    expect(moveCursor({ faceId: 'top', row: 1, col: 1 }, 1, 0, 3)).toEqual({
      faceId: 'top',
      row: 1,
      col: 2,
    });
  });

  it('returns a fresh cursor and never mutates its input', () => {
    const cursor = createCursor();

    const moved = moveCursor(cursor, 1, 1);

    expect(moved).toEqual({ faceId: 'front', row: 3, col: 3 });
    expect(moved).not.toBe(cursor);
    expect(cursor).toEqual({ faceId: 'front', row: 2, col: 2 });
  });
});

describe('reanchorCursor', () => {
  it('keeps the preferred cell while its mini-cube is still on the front face', () => {
    const board = removeIds(createBoard(), ['front:0:0']);

    expect(reanchorCursor(board, createOrientation(), cursorAt(2, 2))).toEqual({
      faceId: 'front',
      row: 2,
      col: 2,
    });
  });

  it('re-anchors to the nearest remaining mini-cube after its own is destroyed', () => {
    // (2,2) and its horizontal neighbours are gone: nearest leftovers are (1,2) and (3,2).
    const board = removeIds(createBoard(), ['front:2:1', 'front:2:2', 'front:2:3']);

    expect(reanchorCursor(board, createOrientation(), cursorAt(2, 2))).toEqual({
      faceId: 'front',
      row: 1,
      col: 2,
    });
  });

  it('measures grid distance as the row plus column delta', () => {
    // Only two cells survive: (0,2) at |Δrow|+|Δcol| = 2 and (1,1) at 1 + 1 = 2.
    // Chebyshev distance would pick (1,1); Manhattan distance ties, so the lowest
    // row decides — that is the pinned metric.
    const board = keepOnlyOnFace(createBoard(), 'front', [
      [0, 2],
      [1, 1],
    ]);

    expect(reanchorCursor(board, createOrientation(), cursorAt(2, 2))).toEqual({
      faceId: 'front',
      row: 0,
      col: 2,
    });
  });

  it('breaks ties by the lowest row and then the lowest column', () => {
    const rowTie = keepOnlyOnFace(createBoard(), 'front', [
      [1, 4],
      [3, 0],
    ]);
    const columnTie = keepOnlyOnFace(createBoard(), 'front', [
      [3, 3],
      [3, 1],
    ]);

    expect(reanchorCursor(rowTie, createOrientation(), cursorAt(2, 2))).toEqual({
      faceId: 'front',
      row: 1,
      col: 4,
    });
    expect(reanchorCursor(columnTie, createOrientation(), cursorAt(2, 2))).toEqual({
      faceId: 'front',
      row: 3,
      col: 1,
    });
  });

  it('uses board order (lowest row, then lowest column) when no cursor is preferred', () => {
    const board = removeIds(createBoard(), ['front:0:0', 'front:0:1']);

    expect(reanchorCursor(board, createOrientation())).toEqual({
      faceId: 'front',
      row: 0,
      col: 2,
    });
    expect(reanchorCursor(board, createOrientation(), null)).toEqual({
      faceId: 'front',
      row: 0,
      col: 2,
    });
  });

  it('follows the orientation to the new front face', () => {
    const board = removeIds(createBoard(), ['left:0:0']);
    const yawed = rotateStep(createOrientation(), 'yaw', 1);
    const pitched = rotateStep(createOrientation(), 'pitch', 1);
    const pitchedBoard = keepOnlyOnFace(createBoard(), 'top', [
      [1, 1],
      [4, 4],
    ]);

    expect(frontFace(yawed)).toBe('left');
    // The preferred cell is gone on the new front face, so its neighbour takes over.
    expect(reanchorCursor(board, yawed, cursorAt(0, 0))).toEqual({
      faceId: 'left',
      row: 0,
      col: 1,
    });
    // A cursor kept from the previous front face is only a row/col hint, never a face.
    expect(reanchorCursor(board, yawed, { faceId: 'front', row: 4, col: 3 })).toEqual({
      faceId: 'left',
      row: 4,
      col: 3,
    });
    expect(frontFace(pitched)).toBe('top');
    expect(reanchorCursor(pitchedBoard, pitched, cursorAt(4, 4))).toEqual({
      faceId: 'top',
      row: 4,
      col: 4,
    });
  });

  it('returns null when the front face is empty while other faces remain', () => {
    const board = removeFace(createBoard(), 'front');

    expect(reanchorCursor(board, createOrientation(), cursorAt(2, 2))).toBeNull();
    expect(reanchorCursor(board, rotateStep(createOrientation(), 'pitch', 1), cursorAt(2, 2))).toEqual(
      { faceId: 'top', row: 2, col: 2 },
    );
  });

  it('returns null when every face has been cleared', () => {
    let board = createBoard();
    for (const faceId of FACE_IDS) {
      board = removeFace(board, faceId);
    }

    expect(reanchorCursor(board, createOrientation(), cursorAt(2, 2))).toBeNull();
    expect(reanchorCursor(board, rotateStep(createOrientation(), 'yaw', 1), cursorAt(2, 2))).toBeNull();
  });

  it('never mutates the board it reads', () => {
    const board = removeIds(createBoard(), ['front:2:2']);
    const before = board.faces.map((face) => face.miniCubes.length);

    reanchorCursor(board, createOrientation(), cursorAt(2, 2));

    expect(board.faces.map((face) => face.miniCubes.length)).toEqual(before);
  });
});
