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
 * **Randomness (spec AC-1, AC-3).** Randomness enters only through the current random
 * source; this module never reads the platform RNG. The pinned draw order is: one grid
 * draw at creation (level 0), the explosion bursts' draws, one direction draw at travel
 * start, one grid draw at every level advance. An injected `gridSize` skips the grid draws
 * entirely. The omitted-`random` fallback is a fixed-seed LCG, so a bare `createEngine()`
 * is still deterministic; the session injects the browser's `env.random` at attach
 * through {@link GameEngine.setRandomSource}.
 */

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

/** Everything the player can do. Bound to the engine through `dispatch`. */
export type GameEvent =
  | { type: 'introSkip' }
  | { type: 'explodeMiniCube'; id: MiniCubeId }
  | { type: 'rotate'; axis: Axis; direction: -1 | 1 };

/**
 * One-shot effect for the render layer, drained in the order it was produced.
 *
 * - `explosion` — the mini-cube is gone from the board; hide its instance and play
 *   `burst` (empty under reduced motion).
 * - `faceCleared` — that face's plate fades and its geometry is released.
 * - `levelChanged` — rebuild the cube with `style`.
 * - `travelStarted` — the galaxy travel transition begins.
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
   * The drawn direction of the running travel; non-null exactly during `travel` and
   * `null` in `intro`/`playing` (spec AC-3).
   */
  travelDirection: TravelDirection | null;
  reducedMotion: boolean;
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

/**
 * Creates one engine session.
 *
 * The `timings` option replaces the motion-derived profile wholesale (tests inject short
 * profiles); otherwise the active profile is `timingsFor(reducedMotion)` and follows
 * `setReducedMotion` live.
 */
export function createEngine(options: EngineOptions = {}): GameEngine {
  /** The injected grid size — skips every grid draw and applies to every level. */
  const gridSizeOverride = options.gridSize;
  /** The live random source; `setRandomSource` swaps it for every subsequent draw. */
  let random = options.random ?? createSeededRandom(LCG_SEED);
  const providedTimings = options.timings;

  let reducedMotion = options.reducedMotion ?? false;
  let phase: Phase = 'intro';
  let phaseElapsedMs = 0;
  let progression = createProgression();
  /** The current level's grid edge: drawn once per level unless one is injected. */
  let gridSize = gridSizeOverride ?? drawGridSize(random);
  let board = createBoard(gridSize);
  /** The running travel's drawn direction; cleared when `travel` ends (spec § 3). */
  let travelDirection: TravelDirection | null = null;
  let orientation = createOrientation();
  let rotationFrom: Orientation | null = null;
  let rotationElapsedMs = 0;
  let queuedStep: RotationStep | null = null;
  /** Milliseconds left before the sixth-face clear becomes `travel`; `null` when not pending. */
  let faceFadeRemainingMs: number | null = null;
  let intents: EffectIntent[] = [];
  let cachedSnapshot: EngineSnapshot | null = null;

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

  function buildSnapshot(): EngineSnapshot {
    return {
      phase,
      phaseProgress: phaseProgress(),
      stats: progression.stats,
      levelIndex: progression.levelIndex,
      style: currentStyle(progression),
      orientation,
      rotationFrom,
      rotationProgress: rotationProgress(),
      board,
      gridSize,
      travelDirection,
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

  function startTravel(): void {
    faceFadeRemainingMs = null;
    phase = 'travel';
    phaseElapsedMs = 0;
    // Exactly one direction draw per travel, from the current random source (spec § 3).
    travelDirection = drawTravelDirection(random);
    intents.push({ kind: 'travelStarted' });
    invalidate();
  }

  /**
   * The level advance itself (spec AC-3): progression +1, one grid draw (unless a grid
   * size is injected), fresh board, default orientation, queued step/fade cleared, one
   * `levelChanged` intent, snapshot invalidated. The phase switch stays with the caller —
   * the advance happens at the travel midpoint while the phase is still `travel`.
   */
  function advanceLevel(): void {
    progression = advanceProgression(progression);
    gridSize = gridSizeOverride ?? drawGridSize(random);
    board = createBoard(gridSize);
    orientation = createOrientation();
    rotationFrom = null;
    rotationElapsedMs = 0;
    queuedStep = null;
    faceFadeRemainingMs = null;
    intents.push({ kind: 'levelChanged', style: currentStyle(progression) });
    invalidate();
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
   */
  function advanceTravel(dtMs: number): void {
    const before = phaseElapsedMs;
    phaseElapsedMs += dtMs;
    const timings = currentTimings();
    const midpointMs = timings.travelMs * TRAVEL_LEVEL_ADVANCE_P;
    if (phaseElapsedMs >= midpointMs && (before < midpointMs || midpointMs <= 0)) {
      advanceLevel();
    }
    if (phaseElapsedMs >= timings.travelMs) {
      phase = 'playing';
      phaseElapsedMs = 0;
      // The direction is a `travel`-only value: `null` in `intro`/`playing` (spec AC-3).
      travelDirection = null;
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

    getSnapshot(): EngineSnapshot {
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
  };
}
