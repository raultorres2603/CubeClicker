/**
 * The game engine (T6): phases, events, effect intents and the render/UI snapshot.
 *
 * Pure state machine: no DOM, no three.js, no timers. Time enters only through
 * {@link GameEngine.advance} (`dtMs`), randomness only through the injected `random`,
 * so every behaviour below is deterministic under test.
 *
 * **State ownership (plan § Architecture).** The engine owns the board, orientation,
 * stats and phase. Renderers and React read {@link GameEngine.getSnapshot}
 * (referentially stable until a value changes) and consume one-shot
 * {@link EffectIntent}s drained in order — there is no back-channel into the engine.
 *
 * **Gating (plan § Engine invariants).** `intro` honours `introSkip` only; `travel`
 * ignores every event; `playing` honours the rest. A repeated click on an already
 * removed id is a no-op, and `stats.clicks` increments synchronously in `dispatch`.
 *
 * **Rotation machine.** At most one step animates at a time and at most one further
 * step is queued while it does; further dispatches during the animation are ignored.
 * `orientation` is always the settled *target* of the machine and `rotationFrom` the
 * settled orientation the animation started at (`null` while idle, `rotationProgress`
 * then 1). The frame convention is the one pinned in `rotation.ts` (`+1` yaw = `+90°`
 * about `+Y`, `frontFace` = the camera-facing face).
 *
 * **Auto-rotation (spec Q-6).** Whenever a step settles, and after every removal, the
 * front face is checked: while it is empty but mini-cubes remain elsewhere, one step
 * is taken toward the face that is fewest steps away (ties by {@link FACE_IDS} order),
 * re-evaluated after each step until the front face has mini-cubes or none remain.
 * The step walk is finite because every step strictly reduces the distance to the
 * current nearest face (yaw distance ≤ 2, pitch distance ≤ 2).
 *
 * **Travel.** When the sixth face clears, the engine waits `timings.faceFadeMs`, then
 * enters `travel` (draining one `travelStarted`). At the travel midpoint
 * (`timings.travelMs · TRAVEL_LEVEL_ADVANCE_P`, crossed exactly once) the level advances —
 * fresh board, next style, default orientation, stats carried — draining one
 * `levelChanged` while the camera is at the turn-around; `playing` resumes at
 * `timings.travelMs`, so the new cube is already built when the camera lands.
 *
 * **Online mode (`EngineOptions.online`).** The sixth-face advance is server-authoritative
 * (spec § Supersessions, AC-14/AC-23): after the same face fade the engine enters
 * `travel` but holds — progress 0, camera at rest, no `travelStarted`, no local grid or
 * direction draw — until {@link GameEngine.completeNextLevel} supplies the server's next
 * cube. Data may also arrive during the face fade; it is kept and released when the fade
 * ends. Releasing drains exactly one `travelStarted`, then the normal travel clock runs and
 * the midpoint advance uses the server's `gridSize`/`style` (still exactly once, stats
 * carried). Offline mode is unchanged and keeps its own draws.
 *
 * **Camera-only travel (`travelTo`).** `spectate`/`return` flights enter `travel` with a
 * server-assigned destination, never advance a level and return to `playing` on completion.
 * While {@link GameEngine.setSpectating} is active every gameplay event is ignored (clicks,
 * rotations, intro skips); only a return travel may still be dispatched.
 * {@link GameEngine.cancelTravel} abandons a running camera-only flight without intents so a
 * resume can reset the view to the own rest pose instantly (AC-19 d/AC-22); the server-driven
 * `nextLevel` advance and the offline level travel are never cancelled.
 *
 * **Authoritative adoption (`adoptCubeState`).** `welcome`/`stateSync` deliver the server's
 * exact own-cube state (level, grid, style and removed-id set, AC-14/AC-22). The engine
 * replaces the board in both directions — tiles the authority says still exist are restored,
 * tiles it says are gone are removed — adopts a different level/grid/style, keeps the
 * session-local stats, and releases any pending level travel or face fade (a completion the
 * authority answered while the socket was down must not strand the engine). Because a fresh
 * board is fully visible, a rebuild replays the authoritative removals as burst-free
 * removal intents on the following frame so the rendered board matches the engine exactly.
 *
 * **Randomness (spec AC-1, AC-3).** Randomness enters only through the current random
 * source; this module never reads the platform RNG. The pinned draw order is: one grid
 * draw at creation (level 0), the explosion bursts' draws, one direction draw at travel
 * start, one grid draw at every level advance. An injected `gridSize` skips the grid draws
 * entirely. The omitted-`random` fallback is a fixed-seed LCG, so a bare `createEngine()`
 * is still deterministic; the session injects the browser's `env.random` at attach
 * through {@link GameEngine.setRandomSource}.
 */

import type { Position } from '../multiplayer/protocol';
import { createBoard, remainingOnFace, removeMiniCube } from './board';
import {
  TRAVEL_LEVEL_ADVANCE_P,
  createBurst,
  timingsFor,
  type Burst,
  type Timings,
} from './effects';
import {
  advanceLevel as advanceProgression,
  createProgression,
  currentStyle,
  recordClick,
  recordFaceDestroyed,
} from './progression';
import {
  createOrientation,
  frontFace,
  rotateStep,
  type Axis,
  type Orientation,
} from './rotation';
import {
  FACE_IDS,
  MINI_CUBE_GRID_MAX,
  MINI_CUBE_GRID_MIN,
  TRAVEL_DIRECTIONS,
  type Board,
  type CubeStyle,
  type FaceId,
  type GameStats,
  type MiniCubeId,
  type Phase,
  type TravelDirection,
} from './types';

/** A camera-only travel: to another member's cube (`spectate`) or back home (`return`). */
export type CameraTravelKind = 'spectate' | 'return';

/**
 * The kind of the running travel: an online server-driven level advance (`nextLevel`), a
 * camera-only flight (`spectate`/`return`), or `null` outside a travel and for the offline
 * level travel (which keeps its drawn direction and no destination).
 */
export type TravelKind = 'nextLevel' | CameraTravelKind;

/** The server's next cube, delivered at the online level advance (spec AC-14/AC-15). */
export interface NextLevelData {
  gridSize: number;
  style: CubeStyle;
  destination: Position;
}

/**
 * The exact own-cube state the server reports in `welcome.self` and `stateSync` (spec AC-14,
 * AC-22): the level, its grid edge, the assigned style and every removed mini-cube id.
 */
export interface AuthoritativeCubeState {
  levelIndex: number;
  gridSize: number;
  style: CubeStyle;
  removedIds: readonly MiniCubeId[];
}

/** Everything the player can do. Bound to the engine through `dispatch`. */
export type GameEvent =
  | { type: 'introSkip' }
  | { type: 'explodeMiniCube'; id: MiniCubeId }
  | { type: 'rotate'; axis: Axis; direction: -1 | 1 }
  | { type: 'travelTo'; kind: CameraTravelKind; destination: Position };

/**
 * One-shot effect for the render layer, drained in the order it was produced.
 *
 * - `explosion` — the mini-cube is gone from the board; hide its instance and play
 *   `burst` (empty under reduced motion).
 * - `faceCleared` — that face's plate fades and its geometry is released.
 * - `levelChanged` — rebuild the cube with `style`.
 * - `travelStarted` — a travel transition begins: the level advance (offline, or online
 *   once the server data releases the hold) or a camera-only spectate/return flight.
 */
export type EffectIntent =
  | { kind: 'explosion'; id: MiniCubeId; faceId: FaceId; burst: Burst }
  | { kind: 'faceCleared'; faceId: FaceId }
  | { kind: 'levelChanged'; style: CubeStyle }
  | { kind: 'travelStarted' };

/** Construction options; every environment value is injectable. */
export interface EngineOptions {
  /**
   * Fixed grid edge for every level. When set, no grid draw is consumed and every level
   * uses this size (the tests' determinism seam); otherwise each level draws its own.
   */
  gridSize?: number;
  reducedMotion?: boolean;
  /** Random source for the grid/direction draws and the bursts; defaults to the LCG. */
  random?: () => number;
  timings?: Timings;
  /**
   * Online mode: the sixth-face advance holds after the face fade until
   * {@link GameEngine.completeNextLevel} supplies the server's next cube; no local grid or
   * direction draw is consumed. Offline (default) keeps the local draws unchanged.
   */
  online?: boolean;
}

/**
 * The single read surface for renderers and UI. Field references are stable until the
 * value behind them changes (React contract): `orientation`, `board`, `stats` and
 * `style` are the engine's own immutable values, never copies per call.
 */
export interface EngineSnapshot {
  phase: Phase;
  /** 0..1 during `intro`/`travel`; 1 while `playing`. */
  phaseProgress: number;
  stats: GameStats;
  levelIndex: number;
  style: CubeStyle;
  /** The settled orientation — during an animation the target of the running step. */
  orientation: Orientation;
  /** The settled orientation a running rotation started from; `null` while idle. */
  rotationFrom: Orientation | null;
  /** 0..1 during a rotation; 1 when idle. */
  rotationProgress: number;
  board: Board;
  /**
   * The current level's grid edge (`MINI_CUBE_GRID_MIN`..`MINI_CUBE_GRID_MAX`). Drawn once
   * per level, so it changes exactly at the level advance (spec AC-1).
   */
  gridSize: number;
  /**
   * The drawn direction of the running offline travel; non-null exactly during an offline
   * `travel` and `null` in `intro`/`playing` and for every online travel (spec AC-3).
   */
  travelDirection: TravelDirection | null;
  /**
   * The kind of the running travel. `nextLevel` covers the online server-driven advance
   * (including the pre-data hold, when `travelDestination` is still `null`); `spectate`/
   * `return` are camera-only flights; `null` in `intro`/`playing` and for the offline
   * level travel.
   *
   * Optional in this base contract only for source compatibility with pre-online snapshot
   * fakes (owned by other tasks); every snapshot built by {@link createEngine} carries it
   * (see {@link OnlineEngineSnapshot}).
   */
  travelKind?: TravelKind | null;
  /** The server-assigned destination of the running travel; `null` without one. */
  travelDestination?: Position | null;
  /** True while the camera rests over another member's cube and every game input is gated. */
  spectating?: boolean;
  reducedMotion: boolean;
}

/**
 * The exact snapshot every {@link createEngine} snapshot satisfies: the online fields are
 * always present (the compatibility optionals of {@link EngineSnapshot} are filled in).
 */
export interface OnlineEngineSnapshot extends EngineSnapshot {
  travelKind: TravelKind | null;
  travelDestination: Position | null;
  spectating: boolean;
}

export interface GameEngine {
  /** Gated by phase: `intro` honours `introSkip` only, `travel` ignores everything. */
  dispatch(event: GameEvent): void;
  /** Time only: drives the phases, the rotation animation and the travel countdowns. */
  advance(dtMs: number): void;
  /** Order-preserving; clears the queue. */
  drainIntents(): EffectIntent[];
  /** Referentially stable until a value changes. */
  getSnapshot(): EngineSnapshot;
  /** Live switch; an in-flight rotation collapses immediately when motion is reduced. */
  setReducedMotion(reduced: boolean): void;
  /**
   * Replaces the random source; every subsequent draw (grid, direction, bursts) uses it.
   * The session injects the host's `env.random` here at attach (spec Assumptions).
   */
  setRandomSource(random: () => number): void;
  /**
   * Online only: supplies the server's next cube and releases the held travel. Accepted
   * while the face fade runs (the data is kept until the fade ends) and during the hold;
   * ignored in every other state and after the first release.
   *
   * Optional in this base contract only for source compatibility with pre-online engine
   * fakes (owned by other tasks); {@link createEngine} always implements it.
   */
  completeNextLevel?(data: NextLevelData): void;
  /**
   * Abandons a running camera-only travel (`spectate`/`return`): the phase returns to
   * `playing`, the travel fields are cleared and no intent is emitted, so the next snapshot
   * rests over the own cube. The server-driven `nextLevel` hold and the offline level
   * travel are never cancelled (their level data must survive); every other state is a
   * no-op.
   *
   * Optional in this base contract only for source compatibility with pre-online engine
   * fakes (owned by other tasks); {@link createEngine} always implements it.
   */
  cancelTravel?(): void;
  /**
   * Replaces the own board with the server's exact cube state (AC-14/AC-22): restores ids the
   * authority says exist, removes ids it says are gone, adopts a different level/grid/style
   * and releases a pending level travel or face fade. Session-local stats are never rolled
   * back.
   *
   * Optional in this base contract only for source compatibility with pre-online engine
   * fakes (owned by other tasks); {@link createEngine} always implements it.
   */
  adoptCubeState?(cube: AuthoritativeCubeState): void;
  /** View-only gate: while true every gameplay event is ignored (spectating mode). */
  setSpectating?(active: boolean): void;
}

/** The engine {@link createEngine} returns: the online seams are always present. */
export interface OnlineGameEngine extends GameEngine {
  getSnapshot(): OnlineEngineSnapshot;
  completeNextLevel(data: NextLevelData): void;
  cancelTravel(): void;
  adoptCubeState(cube: AuthoritativeCubeState): void;
  setSpectating(active: boolean): void;
}

/** One quarter turn in yaw counters. */
const YAW_STEPS_PER_TURN = 4;

/** Seed of the deterministic fallback LCG (spec § 1). */
const LCG_SEED = 1;

/** LCG modulus: 2³². */
const LCG_MODULUS = 4294967296;

/** LCG multiplier (the pinned `1664525`). */
const LCG_MULTIPLIER = 1664525;

/** LCG increment (the pinned `1013904223`). */
const LCG_INCREMENT = 1013904223;

/**
 * The deterministic RNG fallback (spec § 1): a plain LCG — seed 1, multiplier 1664525,
 * increment 1013904223, modulus 2³² — so an engine created without a `random` option is
 * still fully deterministic and this layer never reads the platform RNG. Production
 * injects the host's `env.random` through {@link GameEngine.setRandomSource} at attach.
 */
function createSeededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS;
    return state / LCG_MODULUS;
  };
}

/** One grid draw: `N = MINI_CUBE_GRID_MIN + ⌊draw · (MAX − MIN + 1)⌋` (spec § 1). */
function drawGridSize(random: () => number): number {
  return (
    MINI_CUBE_GRID_MIN +
    Math.floor(random() * (MINI_CUBE_GRID_MAX - MINI_CUBE_GRID_MIN + 1))
  );
}

/** One direction draw: `TRAVEL_DIRECTIONS[⌊draw · 4⌋]` (spec § 3). */
function drawTravelDirection(random: () => number): TravelDirection {
  return TRAVEL_DIRECTIONS[Math.floor(random() * TRAVEL_DIRECTIONS.length)];
}

/** An exact half turn: both directions are shortest, so `+1` is preferred. */
const HALF_TURN = YAW_STEPS_PER_TURN / 2;

/** One quarter-turn step; the engine's internal form of a `rotate` event. */
interface RotationStep {
  axis: Axis;
  direction: -1 | 1;
}

/** Yaw quarter turns that bring each side face to the front (pinned by `rotation.ts`). */
const SIDE_FACE_YAW: Readonly<Record<'front' | 'back' | 'left' | 'right', number>> = {
  front: 0,
  back: 2,
  left: 1,
  right: 3,
};

/** Pitch quarter turns that bring each pole face to the front. */
const POLE_FACE_PITCH: Readonly<Record<'top' | 'bottom', number>> = { top: 1, bottom: -1 };

/** Folds any yaw counter into `0..3` (negative counters included). */
function normalizeYaw(yawSteps: number): number {
  return ((yawSteps % YAW_STEPS_PER_TURN) + YAW_STEPS_PER_TURN) % YAW_STEPS_PER_TURN;
}

/** Fewest quarter turns between two yaw counters: 0, 1 or 2. */
function yawDistance(fromYawSteps: number, toYawSteps: number): number {
  const forward = normalizeYaw(toYawSteps - fromYawSteps);
  return Math.min(forward, YAW_STEPS_PER_TURN - forward);
}

/** The shortest yaw direction, preferring `+1` on an exact half turn. */
function shortestYawDirection(fromYawSteps: number, toYawSteps: number): -1 | 1 {
  return normalizeYaw(toYawSteps - fromYawSteps) <= HALF_TURN ? 1 : -1;
}

/** True for the pole faces, whose showing orientation keeps the current yaw. */
function isPoleFace(faceId: FaceId): faceId is 'top' | 'bottom' {
  return faceId === 'top' || faceId === 'bottom';
}

/** The orientation showing `faceId` that is nearest to `from`. */
function targetOrientationFor(from: Orientation, faceId: FaceId): Orientation {
  if (isPoleFace(faceId)) {
    return { yawSteps: from.yawSteps, pitchSteps: POLE_FACE_PITCH[faceId] };
  }
  return { yawSteps: SIDE_FACE_YAW[faceId], pitchSteps: 0 };
}

/** Fewest quarter-turn steps from `from` to any orientation showing `faceId`. */
function stepsToFace(from: Orientation, faceId: FaceId): number {
  const target = targetOrientationFor(from, faceId);
  return yawDistance(from.yawSteps, target.yawSteps) + Math.abs(target.pitchSteps - from.pitchSteps);
}

/** One step along a shortest path from `from` to `target` (pitch first, then yaw). */
function stepToward(from: Orientation, target: Orientation): RotationStep {
  if (from.pitchSteps !== target.pitchSteps) {
    return { axis: 'pitch', direction: target.pitchSteps > from.pitchSteps ? 1 : -1 };
  }
  return { axis: 'yaw', direction: shortestYawDirection(from.yawSteps, target.yawSteps) };
}

/** `face:row:col` earned back as `face` — the prefix is a `FaceId` by construction. */
function faceIdOf(id: MiniCubeId): FaceId {
  return id.slice(0, id.indexOf(':')) as FaceId;
}

/** True when the id is still present on the board (the authoritative restore lookup). */
function boardHasId(board: Board, id: MiniCubeId): boolean {
  return board.faces.some((face) => face.miniCubes.some((miniCube) => miniCube.id === id));
}

/**
 * Creates one engine session.
 *
 * The `timings` option replaces the motion-derived profile wholesale (tests inject short
 * profiles); otherwise the active profile is `timingsFor(reducedMotion)` and follows
 * `setReducedMotion` live.
 */
export function createEngine(options: EngineOptions = {}): OnlineGameEngine {
  /** The injected grid size — skips every grid draw and applies to every level. */
  const gridSizeOverride = options.gridSize;
  /** The live random source; `setRandomSource` swaps it for every subsequent draw. */
  let random = options.random ?? createSeededRandom(LCG_SEED);
  const providedTimings = options.timings;
  /** Online: the level advance is server-driven and holds for `completeNextLevel`. */
  const online = options.online ?? false;

  let reducedMotion = options.reducedMotion ?? false;
  let phase: Phase = 'intro';
  let phaseElapsedMs = 0;
  let progression = createProgression();
  /**
   * The style the server assigned to the current level (`null` offline). It overrides the
   * local style cycle until the next server-driven advance replaces it.
   */
  let styleOverride: CubeStyle | null = null;
  /** The current level's grid edge: drawn once per level unless one is injected. */
  let gridSize = gridSizeOverride ?? drawGridSize(random);
  let board = createBoard(gridSize);
  /** The running travel's drawn direction; cleared when `travel` ends (spec § 3). */
  let travelDirection: TravelDirection | null = null;
  let travelKind: TravelKind | null = null;
  let travelDestination: Position | null = null;
  /** The server's next cube, held from arrival until the travel midpoint consumes it. */
  let pendingNextLevel: NextLevelData | null = null;
  /** Online: true once `completeNextLevel` released the travel clock (one `travelStarted`). */
  let onlineTravelReleased = false;
  /**
   * The authoritative removals to replay after an adoption rebuilt the cube view. The scene
   * rebuilds from the snapshot (fully visible), so the engine hides the removed tiles again
   * on the following frame; `boardReplayArmed` marks the frame the rebuild was drained in.
   */
  let pendingBoardReplay: { removedIds: MiniCubeId[]; clearedFaceIds: FaceId[] } | null = null;
  let boardReplayArmed = false;
  let spectating = false;
  let orientation = createOrientation();
  let rotationFrom: Orientation | null = null;
  let rotationElapsedMs = 0;
  let queuedStep: RotationStep | null = null;
  /** Milliseconds left before the sixth-face clear becomes `travel`; `null` when not pending. */
  let faceFadeRemainingMs: number | null = null;
  let intents: EffectIntent[] = [];
  let cachedSnapshot: OnlineEngineSnapshot | null = null;

  function currentTimings(): Timings {
    return providedTimings ?? timingsFor(reducedMotion);
  }

  function invalidate(): void {
    cachedSnapshot = null;
  }

  function phaseProgress(): number {
    if (phase === 'playing') {
      return 1;
    }
    const durationMs = phase === 'intro' ? currentTimings().introMs : currentTimings().travelMs;
    if (durationMs <= 0) {
      return 1;
    }
    return Math.min(1, phaseElapsedMs / durationMs);
  }

  function rotationProgress(): number {
    if (rotationFrom === null) {
      return 1;
    }
    // `rotationFrom` is only ever set by a step that animated (`rotationMs > 0`), and a
    // live switch to the reduced profile settles such a step immediately.
    return Math.min(1, rotationElapsedMs / currentTimings().rotationMs);
  }

  function buildSnapshot(): OnlineEngineSnapshot {
    return {
      phase,
      phaseProgress: phaseProgress(),
      stats: progression.stats,
      levelIndex: progression.levelIndex,
      style: styleOverride ?? currentStyle(progression),
      orientation,
      rotationFrom,
      rotationProgress: rotationProgress(),
      board,
      gridSize,
      travelDirection,
      travelKind,
      travelDestination,
      spectating,
      reducedMotion,
    };
  }

  /** One auto-rotation step toward the nearest face that still has mini-cubes. */
  function nextAutoRotateStep(): RotationStep | null {
    let bestFace: FaceId | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const faceId of FACE_IDS) {
      if (remainingOnFace(board, faceId) === 0) {
        continue;
      }
      const distance = stepsToFace(orientation, faceId);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestFace = faceId;
      }
    }
    if (bestFace === null) {
      return null;
    }
    return stepToward(orientation, targetOrientationFor(orientation, bestFace));
  }

  function explosionBurst(): Burst {
    if (reducedMotion) {
      // Reduced motion removes the mini-cube instantly and never spawns fragments.
      return { particles: [], lifetimeMs: currentTimings().explosionMs };
    }
    return createBurst(random);
  }

  /** Auto-rotates while the front face is empty and mini-cubes remain elsewhere. */
  function settleFrontFace(): void {
    while (phase === 'playing' && faceFadeRemainingMs === null) {
      if (remainingOnFace(board, frontFace(orientation)) > 0) {
        return;
      }
      const step = nextAutoRotateStep();
      if (step === null) {
        faceFadeRemainingMs = currentTimings().faceFadeMs;
        return;
      }
      requestStep(step);
      if (rotationFrom !== null) {
        return;
      }
    }
  }

  /** Applies one step; returns `true` when it collapsed instantly (reduced motion). */
  function applyStep(step: RotationStep): boolean {
    const from = orientation;
    orientation = rotateStep(orientation, step.axis, step.direction);
    invalidate();
    if (currentTimings().rotationMs <= 0) {
      rotationFrom = null;
      rotationElapsedMs = 0;
      return true;
    }
    rotationFrom = from;
    rotationElapsedMs = 0;
    return false;
  }

  /** Starts a step, or queues it (depth ≤ 1) while another one animates. */
  function requestStep(step: RotationStep): void {
    if (rotationFrom !== null) {
      if (queuedStep === null) {
        queuedStep = step;
      }
      return;
    }
    applyStep(step);
  }

  /** Completes the running step: the queued one starts, otherwise the front face settles. */
  function settleRotation(): void {
    rotationFrom = null;
    rotationElapsedMs = 0;
    invalidate();
    const queued = queuedStep;
    if (queued !== null) {
      queuedStep = null;
      requestStep(queued);
    }
    if (rotationFrom === null) {
      settleFrontFace();
    }
  }

  function advanceRotation(dtMs: number): void {
    if (rotationFrom === null) {
      return;
    }
    rotationElapsedMs += dtMs;
    if (rotationProgress() < 1) {
      invalidate();
      return;
    }
    settleRotation();
  }

  /** Removes one mini-cube with its stats and intents — the pointer-click path. */
  function explode(id: MiniCubeId): void {
    const removal = removeMiniCube(board, id);
    if (!removal.removed) {
      return;
    }
    board = removal.board;
    progression = recordClick(progression);
    const faceId = faceIdOf(id);
    intents.push({ kind: 'explosion', id, faceId, burst: explosionBurst() });
    if (removal.faceCleared) {
      progression = recordFaceDestroyed(progression);
      intents.push({ kind: 'faceCleared', faceId });
    }
    invalidate();
    settleFrontFace();
  }

  function skipIntro(): void {
    phase = 'playing';
    phaseElapsedMs = 0;
    invalidate();
  }

  /** Copies a destination once, so the snapshot never has to rebuild it per frame. */
  function copyDestination(destination: Position): Position {
    return { x: destination.x, y: destination.y };
  }

  /**
   * Releases a held online level travel with the server's data: exactly one
   * `travelStarted`, the destination published, the travel clock allowed to run.
   */
  function releaseNextLevelTravel(data: NextLevelData): void {
    travelDestination = copyDestination(data.destination);
    onlineTravelReleased = true;
    intents.push({ kind: 'travelStarted' });
    invalidate();
  }

  function startTravel(): void {
    faceFadeRemainingMs = null;
    phase = 'travel';
    phaseElapsedMs = 0;
    if (online) {
      // Online: the server owns the grid draw and the destination, so no local draw
      // happens here. Data that arrived during the face fade releases the hold at once.
      travelDirection = null;
      travelKind = 'nextLevel';
      travelDestination = null;
      onlineTravelReleased = false;
      if (pendingNextLevel !== null) {
        releaseNextLevelTravel(pendingNextLevel);
      }
    } else {
      // Exactly one direction draw per travel, from the current random source (spec § 3).
      travelDirection = drawTravelDirection(random);
      intents.push({ kind: 'travelStarted' });
    }
    invalidate();
  }

  /**
   * The level advance itself (spec AC-3): progression +1, the level's grid edge (the local
   * draw unless the server supplied `next`), fresh board, default orientation, queued
   * step/fade cleared, one `levelChanged` intent, snapshot invalidated. The phase switch
   * stays with the caller — the advance happens at the travel midpoint while the phase is
   * still `travel`.
   */
  function advanceLevel(next: NextLevelData | null): void {
    progression = advanceProgression(progression);
    if (next === null) {
      gridSize = gridSizeOverride ?? drawGridSize(random);
      styleOverride = null;
    } else {
      // Online authority: the server's N and style replace the local draw/cycle.
      gridSize = next.gridSize;
      styleOverride = next.style;
    }
    board = createBoard(gridSize);
    orientation = createOrientation();
    rotationFrom = null;
    rotationElapsedMs = 0;
    queuedStep = null;
    faceFadeRemainingMs = null;
    intents.push({ kind: 'levelChanged', style: next?.style ?? currentStyle(progression) });
    invalidate();
  }

  /** A camera-only flight: no level data, no draw, no level advance on arrival. */
  function startCameraTravel(kind: CameraTravelKind, destination: Position): void {
    phase = 'travel';
    phaseElapsedMs = 0;
    travelDirection = null;
    travelKind = kind;
    travelDestination = copyDestination(destination);
    pendingNextLevel = null;
    onlineTravelReleased = false;
    intents.push({ kind: 'travelStarted' });
    invalidate();
  }

  /** The burst of an authoritative reconciliation: hides the tile without particles. */
  function replayBurst(): Burst {
    return { particles: [], lifetimeMs: currentTimings().explosionMs };
  }

  /**
   * Applies one authoritative removal without auto-rotation or auto-settle: the id leaves the
   * board and the click/face counters follow the accepted reconcile semantics. The scene
   * intent is optional: an adoption that rebuilds the cube view replays its removals after
   * the rebuild instead of hiding tiles on the view being discarded.
   */
  function removeForAuthority(id: MiniCubeId, emitIntent: boolean): boolean {
    const removal = removeMiniCube(board, id);
    if (!removal.removed) {
      return false;
    }
    board = removal.board;
    progression = recordClick(progression);
    const faceId = faceIdOf(id);
    if (removal.faceCleared) {
      progression = recordFaceDestroyed(progression);
    }
    if (emitIntent) {
      intents.push({ kind: 'explosion', id, faceId, burst: replayBurst() });
      if (removal.faceCleared) {
        intents.push({ kind: 'faceCleared', faceId });
      }
    }
    return true;
  }

  /** The exact board and removal sets of an authoritative cube (invalid ids ignored). */
  function authoritativeBoard(cube: AuthoritativeCubeState): {
    board: Board;
    removedIds: MiniCubeId[];
    clearedFaceIds: FaceId[];
  } {
    let next = createBoard(cube.gridSize);
    const removedIds: MiniCubeId[] = [];
    for (const id of cube.removedIds) {
      const removal = removeMiniCube(next, id);
      if (removal.removed) {
        next = removal.board;
        removedIds.push(id);
      }
    }
    return {
      board: next,
      removedIds,
      clearedFaceIds: next.faces
        .filter((face) => face.miniCubes.length === 0)
        .map((face) => face.id),
    };
  }

  /**
   * Releases the level travel / face fade an authoritative adoption supersedes: the server's
   * cube is the only continuation left, so a held `nextLevel` travel must not keep the
   * engine frozen (F2). Returns whether anything was released.
   */
  function releaseAuthorityTravel(): boolean {
    const held = phase === 'travel' || faceFadeRemainingMs !== null || pendingNextLevel !== null;
    if (!held) {
      return false;
    }
    if (phase === 'travel') {
      phase = 'playing';
      phaseElapsedMs = 0;
    }
    faceFadeRemainingMs = null;
    travelDirection = null;
    travelKind = null;
    travelDestination = null;
    pendingNextLevel = null;
    onlineTravelReleased = false;
    return true;
  }

  /**
   * Replays the authoritative removals once the scene has rebuilt the fresh cube view: the
   * first `advance` after an adoption is the frame that drains the `levelChanged` rebuild,
   * the next one hides the removed tiles (one frame later, so the rebuild cannot undo it).
   */
  function flushBoardReplay(): void {
    if (pendingBoardReplay === null) {
      return;
    }
    if (!boardReplayArmed) {
      boardReplayArmed = true;
      return;
    }
    const replay = pendingBoardReplay;
    pendingBoardReplay = null;
    boardReplayArmed = false;
    for (const id of replay.removedIds) {
      intents.push({ kind: 'explosion', id, faceId: faceIdOf(id), burst: replayBurst() });
    }
    for (const faceId of replay.clearedFaceIds) {
      intents.push({ kind: 'faceCleared', faceId });
    }
  }

  function advanceIntro(dtMs: number): void {
    phaseElapsedMs += dtMs;
    if (phaseElapsedMs >= currentTimings().introMs) {
      skipIntro();
      return;
    }
    invalidate();
  }

  function advancePlaying(dtMs: number): void {
    if (faceFadeRemainingMs !== null) {
      faceFadeRemainingMs -= dtMs;
      if (faceFadeRemainingMs <= 0) {
        startTravel();
        return;
      }
    }
    advanceRotation(dtMs);
  }

  /**
   * Travel countdown (spec AC-3): the level advances once at the midpoint crossing
   * (`travelMs · TRAVEL_LEVEL_ADVANCE_P`, with a zero midpoint firing immediately) and
   * the phase switches to `playing` at `travelMs`. A single advance that crosses both
   * thresholds therefore fires the level advance first, then the phase switch.
   *
   * In online mode nothing runs until `completeNextLevel` released the hold (the progress
   * stays 0 and the snapshot keeps its identity), and the midpoint advance uses the
   * server's data instead of a local draw. `spectate`/`return` flights never advance a
   * level; they only run the clock and hand back to `playing`.
   */
  function advanceTravel(dtMs: number): void {
    if (travelKind === 'nextLevel' && !onlineTravelReleased) {
      return;
    }
    const before = phaseElapsedMs;
    phaseElapsedMs += dtMs;
    const timings = currentTimings();
    const midpointMs = timings.travelMs * TRAVEL_LEVEL_ADVANCE_P;
    if (phaseElapsedMs >= midpointMs && (before < midpointMs || midpointMs <= 0)) {
      if (travelKind === 'nextLevel' && pendingNextLevel !== null) {
        const next = pendingNextLevel;
        pendingNextLevel = null;
        advanceLevel(next);
      } else if (travelKind === null) {
        // Offline level travel keeps its local draw.
        advanceLevel(null);
      }
      // `spectate`/`return`: camera-only, so the midpoint is just camera math.
    }
    if (phaseElapsedMs >= timings.travelMs) {
      phase = 'playing';
      phaseElapsedMs = 0;
      // Travel-only values: `null` in `intro`/`playing` (spec AC-3).
      travelDirection = null;
      travelKind = null;
      travelDestination = null;
      pendingNextLevel = null;
      onlineTravelReleased = false;
      invalidate();
      return;
    }
    invalidate();
  }

  return {
    dispatch(event: GameEvent): void {
      if (phase === 'intro') {
        if (event.type === 'introSkip') {
          skipIntro();
        }
        return;
      }
      if (phase === 'travel') {
        return;
      }
      // The return flight must stay reachable while spectating; every gameplay event below
      // is view-only gated (spec AC-17 — clicks, WASD/arrows and rotations dispatch nothing).
      if (event.type === 'travelTo') {
        // A sixth-face advance is already pending (face fade or online hold): one
        // transition at a time, and the held server data must not be overwritten.
        if (faceFadeRemainingMs === null) {
          startCameraTravel(event.kind, event.destination);
        }
        return;
      }
      if (spectating) {
        return;
      }
      switch (event.type) {
        case 'explodeMiniCube':
          explode(event.id);
          return;
        case 'rotate':
          requestStep({ axis: event.axis, direction: event.direction });
          return;
        default:
          return;
      }
    },

    advance(dtMs: number): void {
      if (dtMs <= 0) {
        return;
      }
      flushBoardReplay();
      if (phase === 'intro') {
        advanceIntro(dtMs);
        return;
      }
      if (phase === 'travel') {
        advanceTravel(dtMs);
        return;
      }
      advancePlaying(dtMs);
    },

    drainIntents(): EffectIntent[] {
      const drained = intents;
      intents = [];
      return drained;
    },

    getSnapshot(): OnlineEngineSnapshot {
      if (cachedSnapshot === null) {
        cachedSnapshot = buildSnapshot();
      }
      return cachedSnapshot;
    },

    setReducedMotion(reduced: boolean): void {
      if (reducedMotion === reduced) {
        return;
      }
      reducedMotion = reduced;
      invalidate();
      if (reduced && rotationFrom !== null) {
        // The running step is already in the orientation counters: only its animation goes.
        settleRotation();
      }
    },

    setRandomSource(source: () => number): void {
      // Only future draws change; nothing in the snapshot reads randomness, so the
      // published snapshot keeps its identity.
      random = source;
    },

    completeNextLevel(data: NextLevelData): void {
      // Only an online advance that is waiting for the server can be released, and only
      // once: stale or duplicate data is ignored without changing the snapshot.
      if (!online || pendingNextLevel !== null) {
        return;
      }
      const next: NextLevelData = {
        gridSize: data.gridSize,
        style: data.style,
        destination: copyDestination(data.destination),
      };
      if (phase === 'travel' && travelKind === 'nextLevel' && !onlineTravelReleased) {
        pendingNextLevel = next;
        releaseNextLevelTravel(next);
        return;
      }
      if (phase === 'playing' && faceFadeRemainingMs !== null) {
        // The server answered before the face fade elapsed: hold the data, release when
        // `startTravel` runs (the fade pacing is retained).
        pendingNextLevel = next;
      }
    },

    adoptCubeState(cube: AuthoritativeCubeState): void {
      const target = authoritativeBoard(cube);
      const styleBefore = styleOverride ?? currentStyle(progression);
      const levelDiffers = cube.levelIndex !== progression.levelIndex;
      const gridDiffers = cube.gridSize !== gridSize;
      const styleDiffers = cube.style.id !== styleBefore.id;
      // A tile the authority still has but the local board removed needs a fresh view: the
      // scene has no "show tile again" seam, so any restore rebuilds the cube view.
      const restoreNeeded =
        !levelDiffers &&
        !gridDiffers &&
        !styleDiffers &&
        target.board.faces.some((face) =>
          face.miniCubes.some((miniCube) => !boardHasId(board, miniCube.id)),
        );
      const rebuild = levelDiffers || gridDiffers || styleDiffers || restoreNeeded;

      // Preserve the accepted reconcile accounting: on the same cube, authority removals the
      // client had not applied yet count as removals (stats are session-local and never
      // rolled back). A different level/grid is a different cube: its removal set says
      // nothing about clicks this client made, so it only replaces the board.
      const sameLevelAndGrid = !levelDiffers && !gridDiffers;
      let removalApplied = false;
      for (const id of target.removedIds) {
        if (sameLevelAndGrid && removeForAuthority(id, !rebuild)) {
          removalApplied = true;
        }
      }

      if (rebuild) {
        progression = { levelIndex: cube.levelIndex, stats: progression.stats };
        gridSize = cube.gridSize;
        styleOverride = cube.style;
        board = target.board;
        if (levelDiffers) {
          // A different level is a fresh cube, exactly like `advanceLevel`: default view.
          orientation = createOrientation();
          rotationFrom = null;
          rotationElapsedMs = 0;
          queuedStep = null;
        }
        intents.push({ kind: 'levelChanged', style: cube.style });
        pendingBoardReplay = {
          removedIds: target.removedIds,
          clearedFaceIds: target.clearedFaceIds,
        };
        boardReplayArmed = false;
      }

      const released = releaseAuthorityTravel();
      if (removalApplied || rebuild || released) {
        invalidate();
      }
    },

    cancelTravel(): void {
      // Resume reset (AC-19 d/AC-22): only a camera-only flight may be abandoned. The
      // online `nextLevel` hold owns the server's next cube and the offline level travel
      // owns the next level, so both always run to completion.
      if (phase !== 'travel' || travelKind === null || travelKind === 'nextLevel') {
        return;
      }
      // No intent is emitted: the scene reads the phase and rests over the own cube.
      phase = 'playing';
      phaseElapsedMs = 0;
      travelDirection = null;
      travelKind = null;
      travelDestination = null;
      pendingNextLevel = null;
      onlineTravelReleased = false;
      invalidate();
    },

    setSpectating(active: boolean): void {
      if (spectating === active) {
        return;
      }
      spectating = active;
      invalidate();
    },
  };
}
