import { describe, expect, it } from 'vitest';

import { createBoard, remainingOnFace, removeMiniCube } from './board';
import {
  FACE_IDS,
  GRID_SIZE,
  MINI_CUBE_GRID_MAX,
  MINI_CUBE_GRID_MIN,
  type Board,
  type Face,
  type FaceId,
  type MiniCubeId,
} from './types';

/** Six faces in the pinned order (asserted against `FACE_IDS` below). */
const FACE_ORDER: readonly FaceId[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];

/** The 150 ids of a fresh default board, in creation order. */
const ALL_IDS: readonly MiniCubeId[] = FACE_ORDER.flatMap((faceId) =>
  Array.from(
    { length: 25 },
    (_, position): MiniCubeId => `${faceId}:${Math.floor(position / 5)}:${position % 5}`,
  ),
);

function faceOf(board: Board, faceId: FaceId): Face {
  const found = board.faces.find((face) => face.id === faceId);
  if (found === undefined) {
    throw new Error(`face ${faceId} is missing from the board`);
  }
  return found;
}

function idsOf(board: Board): string[] {
  return board.faces.flatMap((face) => face.miniCubes.map((miniCube) => miniCube.id));
}

/** Removes every mini-cube of one face, recording the flags of each removal. */
function clearFace(
  board: Board,
  faceId: FaceId,
): { board: Board; faceCleared: boolean[]; allCleared: boolean[] } {
  let current = board;
  const faceCleared: boolean[] = [];
  const allCleared: boolean[] = [];
  for (const miniCube of faceOf(board, faceId).miniCubes) {
    const result = removeMiniCube(current, miniCube.id);
    current = result.board;
    faceCleared.push(result.faceCleared);
    allCleared.push(result.allCleared);
  }
  return { board: current, faceCleared, allCleared };
}

/** Removes all 150 mini-cubes of a fresh board, recording the flags of each removal. */
function clearBoard(board: Board): { board: Board; faceCleared: boolean[]; allCleared: boolean[] } {
  let current = board;
  const faceCleared: boolean[] = [];
  const allCleared: boolean[] = [];
  for (const id of ALL_IDS) {
    const result = removeMiniCube(current, id);
    current = result.board;
    faceCleared.push(result.faceCleared);
    allCleared.push(result.allCleared);
  }
  return { board: current, faceCleared, allCleared };
}

describe('domain constants', () => {
  it('pins the face order and the grid size', () => {
    expect(FACE_IDS).toEqual(['front', 'back', 'left', 'right', 'top', 'bottom']);
    expect(GRID_SIZE).toBe(5);
  });

  it('pins the per-level random grid range to 3..7 (AC-1)', () => {
    expect(MINI_CUBE_GRID_MIN).toBe(3);
    expect(MINI_CUBE_GRID_MAX).toBe(7);
  });
});

describe('createBoard', () => {
  it('creates six faces in the pinned order with 25 mini-cubes each', () => {
    const board = createBoard();

    expect(board.faces.map((face) => face.id)).toEqual([
      'front',
      'back',
      'left',
      'right',
      'top',
      'bottom',
    ]);
    expect(board.faces.map((face) => face.miniCubes.length)).toEqual([25, 25, 25, 25, 25, 25]);
    expect(board.faces.flatMap((face) => face.miniCubes)).toHaveLength(150);
  });

  it('ids every mini-cube `face:row:col` with ascending rows then columns', () => {
    const front = faceOf(createBoard(), 'front');

    expect(front.miniCubes[0]).toEqual({ id: 'front:0:0', faceId: 'front', row: 0, col: 0 });
    expect(front.miniCubes[4]).toEqual({ id: 'front:0:4', faceId: 'front', row: 0, col: 4 });
    expect(front.miniCubes[5]).toEqual({ id: 'front:1:0', faceId: 'front', row: 1, col: 0 });
    expect(front.miniCubes[24]).toEqual({ id: 'front:4:4', faceId: 'front', row: 4, col: 4 });
    expect(front.miniCubes.map((miniCube) => miniCube.row)).toEqual([
      0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4,
    ]);
    expect(front.miniCubes.map((miniCube) => miniCube.col)).toEqual([
      0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4,
    ]);
  });

  it('gives every mini-cube a unique id that matches its own face and coordinates', () => {
    const board = createBoard();

    expect(idsOf(board)).toEqual(ALL_IDS);
    expect(new Set(idsOf(board)).size).toBe(150);
    for (const face of board.faces) {
      for (const miniCube of face.miniCubes) {
        expect(miniCube.faceId).toBe(face.id);
        expect(miniCube.id).toBe(`${face.id}:${miniCube.row}:${miniCube.col}`);
      }
    }
  });

  it('accepts an explicit grid size', () => {
    const board = createBoard(3);

    expect(board.faces.map((face) => face.id)).toEqual(FACE_ORDER);
    expect(board.faces.map((face) => face.miniCubes.length)).toEqual([9, 9, 9, 9, 9, 9]);
    expect(faceOf(board, 'top').miniCubes.map((miniCube) => miniCube.id)).toEqual([
      'top:0:0',
      'top:0:1',
      'top:0:2',
      'top:1:0',
      'top:1:1',
      'top:1:2',
      'top:2:0',
      'top:2:1',
      'top:2:2',
    ]);
  });

  it('returns a fresh, independent graph on every call', () => {
    const first = createBoard();
    const second = createBoard();

    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second.faces[0]!.miniCubes).not.toBe(first.faces[0]!.miniCubes);
    expect(second.faces[0]!.miniCubes[0]).not.toBe(first.faces[0]!.miniCubes[0]);
  });
});

describe('createBoard — every per-level grid size (AC-1)', () => {
  /** `N` → mini-cubes per face (`N²`) and per cube level (`6N²`). */
  const SIZES: ReadonlyArray<{ gridSize: number; perFace: number; total: number }> = [
    { gridSize: 3, perFace: 9, total: 54 },
    { gridSize: 4, perFace: 16, total: 96 },
    { gridSize: 5, perFace: 25, total: 150 },
    { gridSize: 6, perFace: 36, total: 216 },
    { gridSize: 7, perFace: 49, total: 294 },
  ];

  it('creates six faces of N² unique ids for N = 3, 4, 5, 6 and 7', () => {
    for (const { gridSize, perFace, total } of SIZES) {
      const board = createBoard(gridSize);
      const ids = idsOf(board);

      expect(board.faces.map((face) => face.id)).toEqual(FACE_ORDER);
      expect(board.faces.map((face) => face.miniCubes.length)).toEqual([
        perFace,
        perFace,
        perFace,
        perFace,
        perFace,
        perFace,
      ]);
      expect(ids).toHaveLength(total);
      expect(new Set(ids).size).toBe(total);
      for (const face of board.faces) {
        expect(face.miniCubes[0]!.id).toBe(`${face.id}:0:0`);
        expect(face.miniCubes.at(-1)!.id).toBe(`${face.id}:${gridSize - 1}:${gridSize - 1}`);
        expect(ids.filter((id) => id.startsWith(`${face.id}:`))).toHaveLength(perFace);
      }
    }
  });

  it('keeps rows ascending then columns ascending on a 6×6 face', () => {
    const front = faceOf(createBoard(6), 'front');

    expect(front.miniCubes[0]).toEqual({ id: 'front:0:0', faceId: 'front', row: 0, col: 0 });
    expect(front.miniCubes[5]).toEqual({ id: 'front:0:5', faceId: 'front', row: 0, col: 5 });
    expect(front.miniCubes[6]).toEqual({ id: 'front:1:0', faceId: 'front', row: 1, col: 0 });
    expect(front.miniCubes[35]).toEqual({ id: 'front:5:5', faceId: 'front', row: 5, col: 5 });
    expect(front.miniCubes.map((miniCube) => miniCube.row)).toEqual([
      0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4,
      5, 5, 5, 5, 5, 5,
    ]);
    expect(front.miniCubes.map((miniCube) => miniCube.col)).toEqual([
      0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5,
      0, 1, 2, 3, 4, 5,
    ]);
  });

  it('gives the 7×7 and 3×3 extremes the ids the render/pick layers decode', () => {
    const large = createBoard(7);
    const small = createBoard(3);

    expect(faceOf(large, 'top').miniCubes).toHaveLength(49);
    expect(faceOf(large, 'top').miniCubes[48]).toEqual({
      id: 'top:6:6',
      faceId: 'top',
      row: 6,
      col: 6,
    });
    expect(faceOf(large, 'bottom').miniCubes[24]).toEqual({
      id: 'bottom:3:3',
      faceId: 'bottom',
      row: 3,
      col: 3,
    });
    expect(faceOf(small, 'right').miniCubes).toHaveLength(9);
    expect(faceOf(small, 'right').miniCubes[8]).toEqual({
      id: 'right:2:2',
      faceId: 'right',
      row: 2,
      col: 2,
    });
  });
});

describe('removeMiniCube', () => {
  it('removes exactly the requested mini-cube and leaves the input board untouched', () => {
    const board = createBoard();

    const result = removeMiniCube(board, 'front:2:3');

    expect(result.removed).toBe(true);
    expect(result.faceCleared).toBe(false);
    expect(result.allCleared).toBe(false);
    expect(result.board).not.toBe(board);
    expect(faceOf(result.board, 'front').miniCubes).toHaveLength(24);
    expect(faceOf(result.board, 'front').miniCubes.map((miniCube) => miniCube.id)).not.toContain(
      'front:2:3',
    );
    // Immutability: the input board is unchanged.
    expect(faceOf(board, 'front').miniCubes).toHaveLength(25);
    expect(faceOf(board, 'front').miniCubes.map((miniCube) => miniCube.id)).toContain('front:2:3');
    expect(remainingOnFace(board, 'front')).toBe(25);
  });

  it('leaves every other face fully intact', () => {
    const board = createBoard();

    const result = removeMiniCube(board, 'bottom:4:4');

    expect(idsOf(result.board)).toEqual(ALL_IDS.filter((id) => id !== 'bottom:4:4'));
    expect(result.board.faces.map((face) => face.id)).toEqual(FACE_ORDER);
    expect(result.board.faces.map((face) => face.miniCubes.length)).toEqual([25, 25, 25, 25, 25, 24]);
    expect(result.faceCleared).toBe(false);
    expect(result.allCleared).toBe(false);
  });

  it('is a no-op that echoes the board when the id is not on it', () => {
    const board = createBoard();

    const result = removeMiniCube(board, 'front:9:9');

    expect(result.removed).toBe(false);
    expect(result.faceCleared).toBe(false);
    expect(result.allCleared).toBe(false);
    expect(result.board).toBe(board);
    expect(idsOf(result.board)).toEqual(ALL_IDS);
  });

  it('reports `removed: false` for a second removal of the same id', () => {
    const first = removeMiniCube(createBoard(), 'front:0:0');

    const second = removeMiniCube(first.board, 'front:0:0');

    expect(first.removed).toBe(true);
    expect(second.removed).toBe(false);
    expect(second.faceCleared).toBe(false);
    expect(second.allCleared).toBe(false);
    expect(second.board).toBe(first.board);
    expect(remainingOnFace(second.board, 'front')).toBe(24);
  });

  it('flags `faceCleared` only on the removal that empties that face', () => {
    const cleared = clearFace(createBoard(), 'front');

    expect(cleared.faceCleared).toEqual([...new Array<boolean>(24).fill(false), true]);
    expect(cleared.allCleared).toEqual(new Array<boolean>(25).fill(false));
    expect(remainingOnFace(cleared.board, 'front')).toBe(0);
    // The cleared face keeps its entry; the other five faces stay fully playable.
    expect(cleared.board.faces).toHaveLength(6);
    expect(cleared.board.faces.map((face) => face.id)).toEqual(FACE_ORDER);
    expect(faceOf(cleared.board, 'front').miniCubes).toEqual([]);
    expect(remainingOnFace(cleared.board, 'back')).toBe(25);
  });

  it('flags `allCleared` exactly once, on the removal that empties the last face', () => {
    const cleared = clearBoard(createBoard());

    expect(cleared.allCleared.at(-1)).toBe(true);
    expect(cleared.allCleared.at(-2)).toBe(false);
    expect(cleared.allCleared.filter((flag) => flag)).toHaveLength(1);
    expect(cleared.faceCleared.filter((flag) => flag)).toHaveLength(6);
    expect(cleared.board.faces.map((face) => face.miniCubes.length)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(idsOf(cleared.board)).toEqual([]);
  });

  it('reports an unknown face id as absent instead of removing anything', () => {
    const board = createBoard(1);

    const result = removeMiniCube(board, 'left:1:0');

    expect(result.removed).toBe(false);
    expect(result.board).toBe(board);
    expect(remainingOnFace(board, 'left')).toBe(1);
  });
});

describe('remainingOnFace', () => {
  it('counts the mini-cubes still present on a face', () => {
    const board = createBoard();

    expect(remainingOnFace(board, 'front')).toBe(25);
    expect(remainingOnFace(board, 'top')).toBe(25);
    expect(remainingOnFace(removeMiniCube(board, 'top:3:1').board, 'top')).toBe(24);
    expect(remainingOnFace(clearFace(board, 'right').board, 'right')).toBe(0);
  });
});
