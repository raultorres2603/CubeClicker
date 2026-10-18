import {
  FACE_IDS,
  GRID_SIZE,
  type Board,
  type Face,
  type FaceId,
  type MiniCube,
  type MiniCubeId,
} from './types';

/** Canonical id of one grid cell — the single place the `face:row:col` format is built. */
function miniCubeId(faceId: FaceId, row: number, col: number): MiniCubeId {
  return `${faceId}:${row}:${col}`;
}

/** One face's mini-cubes, rows ascending then columns ascending. */
function createFace(faceId: FaceId, gridSize: number): Face {
  const miniCubes: MiniCube[] = [];
  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      miniCubes.push({ id: miniCubeId(faceId, row, col), faceId, row, col });
    }
  }
  return { id: faceId, miniCubes };
}

/**
 * Fresh board: six faces in `FACE_IDS` order, each with `gridSize²` mini-cubes whose
 * ids run `face:row:col` (rows ascending, then columns ascending).
 */
export function createBoard(gridSize: number = GRID_SIZE): Board {
  return { faces: FACE_IDS.map((faceId) => createFace(faceId, gridSize)) };
}

/**
 * Immutable removal of one mini-cube.
 *
 * - `removed: false` when the id is not on the board: a no-op that returns the same board.
 * - `faceCleared` is true only for the removal that empties that face (it was present,
 *   so an empty face after removal is exactly the transition to 0).
 * - `allCleared` is true only for the removal that empties the last non-empty face.
 */
export function removeMiniCube(
  board: Board,
  id: MiniCubeId,
): { board: Board; removed: boolean; faceCleared: boolean; allCleared: boolean } {
  for (const face of board.faces) {
    const index = face.miniCubes.findIndex((miniCube) => miniCube.id === id);
    if (index === -1) {
      continue;
    }
    const miniCubes = face.miniCubes.filter((_, position) => position !== index);
    const faces = board.faces.map((current) =>
      current.id === face.id ? { id: current.id, miniCubes } : current,
    );
    return {
      board: { faces },
      removed: true,
      faceCleared: miniCubes.length === 0,
      allCleared: faces.every((current) => current.miniCubes.length === 0),
    };
  }
  return { board, removed: false, faceCleared: false, allCleared: false };
}

/** Mini-cubes still present on one face; 0 once that face is cleared. */
export function remainingOnFace(board: Board, faceId: FaceId): number {
  let remaining = 0;
  for (const face of board.faces) {
    if (face.id === faceId) {
      remaining = face.miniCubes.length;
    }
  }
  return remaining;
}
