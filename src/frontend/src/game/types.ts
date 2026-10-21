/**
 * Cube domain model (T2).
 *
 * Pure data: no DOM, no three.js, no timers. The grid-domain constants
 * ({@link GRID_SIZE}, {@link MINI_CUBE_GRID_MIN}, {@link MINI_CUBE_GRID_MAX}) and the
 * pinned travel-direction order live here — every other pinned constant has exactly one
 * home (F2): styles in `progression.ts`, the non-grid effect constants in `effects.ts`.
 */

/** The six faces of a cube. The order of {@link FACE_IDS} is the stable one. */
export type FaceId = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

/**
 * Stable face order: `front, back, left, right, top, bottom`. Boards are built in
 * this order and it is also the engine's auto-rotate tie-break order (plan § Engine).
 */
export const FACE_IDS: readonly FaceId[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];

/**
 * Default/fallback grid edge: `GRID_SIZE²` (25) mini-cubes per face, 150 per cube level.
 * A level's grid edge is drawn per level in `[MINI_CUBE_GRID_MIN, MINI_CUBE_GRID_MAX]`;
 * 5 is what the constant draw 0.5 yields, and the value used when a grid size is injected.
 */
export const GRID_SIZE = 5;

/** Smallest per-level random grid edge (spec AC-1): 3×3 = 9 mini-cubes per face. */
export const MINI_CUBE_GRID_MIN = 3;

/** Largest per-level random grid edge (spec AC-1): 7×7 = 49 mini-cubes per face. */
export const MINI_CUBE_GRID_MAX = 7;

/** Mini-cube id: face, 0-based row, 0-based column — e.g. `front:0:0`. */
export type MiniCubeId = `${FaceId}:${number}:${number}`;

/** One clickable tile of a face's grid. */
export interface MiniCube {
  id: MiniCubeId;
  faceId: FaceId;
  row: number;
  col: number;
}

/** One face of the cube and the mini-cubes still present on it. */
export interface Face {
  id: FaceId;
  miniCubes: MiniCube[];
}

/**
 * A board always holds exactly six faces in {@link FACE_IDS} order. A cleared face
 * keeps its entry with an empty `miniCubes` array (it does not disappear from the board).
 */
export interface Board {
  faces: Face[];
}

/** Local player statistics for the current run. */
export interface GameStats {
  clicks: number;
  facesDestroyed: number;
}

/** One progression style: palette (`'#rrggbb'`) plus PBR material parameters. */
export interface CubeStyle {
  id: string;
  name: string;
  cubeColor: string;
  miniCubeColor: string;
  accentColor: string;
  metalness: number;
  roughness: number;
}

/** Game phase: intro fly-in, playable, travelling to the next cube level. */
export type Phase = 'intro' | 'playing' | 'travel';

/**
 * The four cardinal travel directions of the world plane (spec § 3). Screen axes equal
 * world axes (the camera is always axis-aligned), so `left`/`right` are world ∓x and
 * `bottom`/`top` are world ∓y.
 */
export type TravelDirection = 'left' | 'right' | 'top' | 'bottom';

/**
 * Pinned direction order — the draw index is `⌊draw · 4⌋` into this array, so the
 * constant draw 0.5 selects `top` (spec AC-3).
 */
export const TRAVEL_DIRECTIONS: readonly TravelDirection[] = ['left', 'right', 'top', 'bottom'];
