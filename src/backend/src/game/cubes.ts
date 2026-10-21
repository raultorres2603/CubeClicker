/**
 * Backend cube state: mini-cube ids, click/completion validation and the server's
 * next-cube draw (T3).
 *
 * The server is the authority over every member's board (spec § 5, § Real-time impact):
 * it owns the removed-id set, validates client `explode`/`cubeCompleted` requests against
 * it, and draws the next level's grid edge. Everything here is pure over explicit inputs —
 * randomness arrives as an injected `random`, the style cycle as an injected `styleFor`
 * (plus the mirrored {@link styleForLevel} helper), no timers, no DOM, no I/O.
 *
 * **Mirrored from the accepted frontend engine (not invented here).** The id scheme and the
 * style cycle copy the accepted `cube-world-transition` implementation exactly:
 * - ids: `face:row:col`, 0-based row/column, faces in the stable `FACE_IDS` order, rows then
 *   columns ascending — `src/frontend/src/game/board.ts` (`miniCubeId`, `createFace`) and
 *   `src/frontend/src/game/types.ts` (`FACE_IDS`, `MiniCubeId`).
 * - grid draw: `N = 3 + ⌊draw·5⌋` — `src/frontend/src/game/engine.ts` `drawGridSize`
 *   (`MINI_CUBE_GRID_MIN + ⌊draw·(MAX − MIN + 1)⌋`, bounds 3..7 from `types.ts`).
 * - style cycle: `CUBE_STYLES[levelIndex % 5]` in `src/frontend/src/game/progression.ts`
 *   (`currentStyle`), ids pinned by `progression.test.ts`.
 *
 * Pinned rules implemented here:
 * - a valid `explode` id exists in the current level, is not already removed and its
 *   `level` field equals the cube's `levelIndex` (spec § 5, AC-14);
 * - `isComplete` holds exactly when the removed set covers all `6·N²` ids of the level
 *   (spec AC-15);
 * - the next cube is `levelIndex + 1`, `N = 3 + ⌊random()·5⌋`, style by `levelIndex` and an
 *   empty removed set (spec § Pinned constants, AC-15).
 */

/** The six faces of a cube — mirrored from the frontend `FaceId` (stable order). */
export type FaceId = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

/**
 * Stable face order (`front, back, left, right, top, bottom`), mirrored from the frontend
 * `FACE_IDS`: boards are built in this order, so `allIds` is deterministic.
 */
export const FACE_IDS: readonly FaceId[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];

/** Smallest per-level grid edge (mirrors the accepted `MINI_CUBE_GRID_MIN`). */
export const MIN_GRID_SIZE = 3;

/** Largest per-level grid edge (mirrors the accepted `MINI_CUBE_GRID_MAX`). */
export const MAX_GRID_SIZE = 7;

/**
 * The accepted five-style cycle, in order, mirrored verbatim from the frontend
 * `CUBE_STYLES` ids (`src/frontend/src/game/progression.ts`, pinned by
 * `progression.test.ts`). The server assigns `levelIndex % 5`; the client renders the style
 * with matching id.
 */
export const CUBE_STYLE_IDS = [
  'obsidian-neon',
  'crimson-alloy',
  'emerald-crystal',
  'solar-gold',
  'violet-nebula',
] as const;

/**
 * One member's cube at one level: the drawn grid edge, the assigned style and the ids the
 * member has already cleared. `removedIds` is the authoritative board state the hub
 * validates against.
 */
export interface CubeState {
  /** 0-based level of this cube; the client shows `levelIndex + 1`. */
  levelIndex: number;
  /** Grid edge N of this level (3..7), drawn by the server. */
  gridSize: number;
  /** Style id from the accepted five-style cycle (see {@link CUBE_STYLE_IDS}). */
  styleId: string;
  /** Ids already removed, i.e. the tiles that no longer exist. */
  removedIds: Set<string>;
}

/**
 * Every mini-cube id of a level with grid edge `gridSize`: `6·N²` ids in canonical order —
 * faces in {@link FACE_IDS} order, then rows ascending, then columns ascending. Same order
 * and format as the frontend `createBoard` (`face:row:col`, 0-based).
 */
export function allIds(gridSize: number): string[] {
  const ids: string[] = [];
  for (const faceId of FACE_IDS) {
    for (let row = 0; row < gridSize; row += 1) {
      for (let col = 0; col < gridSize; col += 1) {
        ids.push(`${faceId}:${row}:${col}`);
      }
    }
  }
  return ids;
}

/**
 * The style id for a level: the accepted cycle at `levelIndex % 5` (mirrors the frontend
 * `currentStyle`). The hub passes this (or an equivalent) as `styleFor` to
 * {@link createNextCube}.
 */
export function styleForLevel(levelIndex: number): string {
  return CUBE_STYLE_IDS[levelIndex % CUBE_STYLE_IDS.length]!;
}

/** One grid draw: `N = 3 + ⌊draw·5⌋` (spec § Pinned constants), mirroring the engine. */
function drawGridSize(random: () => number): number {
  return MIN_GRID_SIZE + Math.floor(random() * (MAX_GRID_SIZE - MIN_GRID_SIZE + 1));
}

/**
 * Creates the next cube of a member.
 *
 * `prev === null` is the member's first cube (level 0); otherwise the level advances by
 * exactly one. Exactly one `random` draw is consumed: `N = 3 + ⌊draw·5⌋` ∈ [3, 7]. The
 * style comes from `styleFor(levelIndex)` and the removed set is fresh and empty — the
 * previous level's removals never leak into the next board.
 */
export function createNextCube(
  prev: CubeState | null,
  styleFor: (levelIndex: number) => string,
  random: () => number,
): CubeState {
  const levelIndex = prev === null ? 0 : prev.levelIndex + 1;
  return {
    levelIndex,
    gridSize: drawGridSize(random),
    styleId: styleFor(levelIndex),
    removedIds: new Set(),
  };
}

/**
 * Validates an `explode` request against the authoritative board (spec § 5, AC-14).
 *
 * True only when the level matches the cube's current level, the id exists in that level's
 * `6·N²` ids and it has not been removed yet. Removed ids, unknown ids (wrong face, out of
 * range, malformed, non-canonical numbers) and stale levels are all rejected — the caller
 * answers with `error invalid_click` + `stateSync` and applies nothing.
 */
export function validateExplode(cube: CubeState, id: string, level: number): boolean {
  if (level !== cube.levelIndex) {
    return false;
  }
  if (cube.removedIds.has(id)) {
    return false;
  }
  return allIds(cube.gridSize).includes(id);
}

/**
 * Whether the member's cube is fully cleared (spec AC-15).
 *
 * True exactly when the level matches and `removedIds` covers every one of the `6·N²` ids
 * of that level. Extra ids in the set (which cannot occur through `validateExplode`) never
 * substitute for a missing canonical id.
 */
export function isComplete(cube: CubeState, level: number): boolean {
  if (level !== cube.levelIndex) {
    return false;
  }
  return allIds(cube.gridSize).every((id) => cube.removedIds.has(id));
}
