/**
 * Scene composition, camera flights, world travel and intent application (plan § Render
 * interfaces; spec AC-1 … AC-4, AC-9, AC-10, AC-15, AC-16).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. The scene
 * assembles the pieces the other render tasks own ({@link createStarfield} backdrop,
 * {@link createCubeView} cube, {@link createParticleSystem} explosions) plus the lights
 * and the pinned camera, and is the single place that turns engine output into three.js
 * state:
 *
 * - {@link SceneView.applyIntents} consumes the engine's one-shot `EffectIntent`s:
 *   an `explosion` reads the tile's world origin and outward face normal, starts the
 *   pop-then-shrink removal and spawns the burst `BURST_ORIGIN_OFFSET` in front of that
 *   surface (AC-3, AC-4); `faceCleared` starts the face-removal countdown (there is no
 *   plate to fade — spec AC-2); `levelChanged` only marks the rebuild *pending* (the next
 *   snapshot carries the new style, grid size and travel direction); and `travelStarted`
 *   needs nothing of its own — the travel transition is driven by the snapshot.
 * - {@link SceneView.applySnapshot} is the per-frame pull, in the pinned order: motion
 *   setting → rebuild step → camera (intro dolly, directional travel flight or the rest
 *   pose over the current cube) → cube orientation → reduced-motion pop settle.
 * - {@link SceneView.update} advances the frame-driven parts: the camera-anchored starfield
 *   swirl and scale, particle aging, the face-removal countdowns and the running mini-cube
 *   pops (AC-4).
 *
 * World model (spec § 3): cubes live on a flat plane and the camera is always axis-aligned
 * with the identity quaternion, so screen-right is world +x and screen-up is world +y. A
 * level's cube sits at its own world position ({@link SceneView} keeps `cubePosition`) and
 * the next cube spawns one {@link CUBE_SPACING} step in the drawn direction; at the travel
 * midpoint the old cube view is disposed and the new one is built at the new position.
 *
 * Online integration (T12; spec § 5, § 6, § 9). The own cube sits at the server-assigned
 * slot position (`ownPosition`), so the rest pose and the intro dolly are centred on it.
 * A `nextLevel` travel is destination-driven: the flight interpolation is the accepted
 * formula with `travelDestination − travelFrom` as its offset (the z table is retained),
 * and while the online hold has no destination yet the camera stays at rest with progress
 * 0. `spectate`/`return` flights render the T11 pose from the current rest to the target
 * and never rebuild a level. The remote cubes live in a {@link WorldView}: it is built on
 * `enterWorld` (after `welcome`, with the server's `maxUsers`) and replaced exactly at the
 * level midpoint when a queued `worldEntered` swap is applied.
 *
 * The scene receives values only; it never reads the engine (plan § Data flow) and it
 * owns every three.js object it creates, so `dispose()` can release them exactly once
 * (AC-15). Drawables stay bounded: one starfield `Points`, one cube view (body + ≤ 6
 * `InstancedMesh`), one pooled particle `Points` and, online, one remote world of ≤ (X − 1)
 * cube views (AC-16).
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  InstancedMesh,
  Matrix4,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three';

import {
  BURST_ORIGIN_OFFSET,
  easeInOutQuad,
  easeOutCubic,
  timingsFor,
  travelSwing,
} from '../game/effects';
import type { EffectIntent, EngineSnapshot } from '../game/engine';
import { interpolateRotation } from '../game/rotation';
import {
  GRID_SIZE,
  type CubeStyle,
  type FaceId,
  type MiniCubeId,
  type Phase,
  type TravelDirection,
} from '../game/types';
import type { MemberState, Position, ServerMessage } from '../multiplayer/protocol';
import { createCubeView, FACE_NORMALS, type CubeView } from './cube-view';
import { createParticleSystem, type ParticleSystem } from './particles';
import { travelCameraPose as spectateTravelPose } from './spectate-travel';
import { createStarfield, type Starfield, type StarfieldAnchor } from './starfield';
import { createWorldView, type WorldView } from './world';

/** Black backdrop behind the starfield (AC-3). */
const BACKGROUND_COLOR = 0x000000;

/** Ambient fill-light intensity. */
const AMBIENT_INTENSITY = 0.6;

/** Key-light intensity. */
const KEY_INTENSITY = 1.2;

/** Key-light position: front-top-right of the cube. */
const KEY_LIGHT_POSITION = { x: 6, y: 8, z: 10 };

/** Camera rest distance — the gameplay position, and the end of the intro dolly (AC-2). */
const REST_Z = 12;

/** Travel pull-away end distance (AC-3, retained from the predecessor AC-22). */
const TRAVEL_END_Z = 90;

/** Intro start distance (spec AC-2) — the original AC-22 value, now always pointing at the cube. */
const INTRO_START_Z = 60;

/** Pinned lens (AC-2). */
const CAMERA_FOV = 50;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 200;

/** The camera always looks at the cube centre, wherever the flights put it. */
const ORIGIN = new Vector3(0, 0, 0);

/** Components this close to an integer are quarter-turn trig residue (spec AC-3). */
const QUARTER_TURN_EPSILON = 1e-9;

/** Distance between consecutive cube world positions (spec § 3). */
export const CUBE_SPACING = 24;

/**
 * World offsets of the four travel directions (spec § 3, pinned): screen axes equal world
 * axes because the camera is always axis-aligned, so `right` is +x, `top` is +y, etc.
 */
export const TRAVEL_DIRECTION_OFFSETS: Readonly<
  Record<TravelDirection, { readonly x: number; readonly y: number }>
> = {
  left: { x: -CUBE_SPACING, y: 0 },
  right: { x: CUBE_SPACING, y: 0 },
  top: { x: 0, y: CUBE_SPACING },
  bottom: { x: 0, y: -CUBE_SPACING },
};

/**
 * Writes the intro camera pose for clamped `progress` into the caller-owned vectors
 * (spec AC-2) — zero allocation per frame.
 *
 * A straight, eased dolly-in along the view axis: the target is the cube centre at every
 * progress and the position is `(0, 0, 60 − 48 · easeOutCubic(p))`, i.e. from
 * {@link INTRO_START_Z} (`60`) to the rest pose (`12`). The cube is centred and fully framed
 * from the first frame; the path is strictly monotonic and the camera quaternion is the
 * identity at every instant (spec § 2).
 */
export function introCameraPose(
  progress: number,
  outPosition: Vector3,
  outTarget: Vector3,
): void {
  const clamped = Math.min(1, Math.max(0, progress));
  const travelled = easeOutCubic(clamped);

  outPosition.set(0, 0, INTRO_START_Z - (INTRO_START_Z - REST_Z) * travelled);
  outTarget.set(ORIGIN.x, ORIGIN.y, ORIGIN.z);
}

/**
 * Writes the directional travel pose for clamped `progress` into the caller-owned vectors
 * (spec § 3) — zero allocation per frame.
 *
 * Over the old cube at `(fromX, fromY)` and the drawn direction's offset `(dx, dy)`:
 * `x(p) = fromX + dx · easeInOutQuad(p)`, `y(p) = fromY + dy · easeInOutQuad(p)` and the
 * retained symmetric pull-back `z(p) = 12 + 78 · travelSwing(p)` (12 → 90 at the midpoint →
 * 12). The look target is the lateral point `(x(p), y(p), 0)`, so the camera looks straight
 * down the view axis and its quaternion stays the identity at every p.
 *
 * `direction === null` is the defensive case (no drawn direction): the lateral offset is
 * zero and the camera pulls back over `(fromX, fromY)`.
 */
export function travelCameraPose(
  progress: number,
  fromX: number,
  fromY: number,
  direction: TravelDirection | null,
  outPosition: Vector3,
  outTarget: Vector3,
): void {
  const offset = direction === null ? null : TRAVEL_DIRECTION_OFFSETS[direction];
  writeTravelPose(
    progress,
    fromX,
    fromY,
    offset === null ? 0 : offset.x,
    offset === null ? 0 : offset.y,
    outPosition,
    outTarget,
  );
}

/**
 * Writes the accepted travel pose for one explicit lateral offset into the caller-owned
 * vectors (zero allocation per frame). This is the common core of the offline
 * direction-driven flight ({@link travelCameraPose}) and the online destination-driven
 * flight (`travelDestination − travelFrom`): the lateral interpolation is
 * `easeInOutQuad(p)` and the retained symmetric depth is `12 + 78 · travelSwing(p)`.
 */
function writeTravelPose(
  progress: number,
  fromX: number,
  fromY: number,
  dx: number,
  dy: number,
  outPosition: Vector3,
  outTarget: Vector3,
): void {
  const clamped = Math.min(1, Math.max(0, progress));
  const lateral = easeInOutQuad(clamped);
  const x = fromX + dx * lateral;
  const y = fromY + dy * lateral;

  outPosition.set(x, y, REST_Z + (TRAVEL_END_Z - REST_Z) * travelSwing(clamped));
  outTarget.set(x, y, 0);
}

/**
 * Snaps every component of `v` within {@link QUARTER_TURN_EPSILON} of an integer to that
 * integer and returns `v` (in place, for chaining). A quarter-turn matrix carries residue
 * such as `cos(π/2) ≈ 6.12e-17`, which would otherwise leak into asserted burst positions;
 * genuine in-between normals are far from integers and pass through untouched. `-0` is
 * normalised to `0`, so the snapped vector compares exactly.
 */
export function snapToQuarterTurns(v: Vector3): Vector3 {
  v.set(snapComponent(v.x), snapComponent(v.y), snapComponent(v.z));
  return v;
}

/** One component of {@link snapToQuarterTurns}. */
function snapComponent(value: number): number {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) <= QUARTER_TURN_EPSILON) {
    // `+ 0` turns a `Math.round(-1e-17)` result of `-0` into a plain `0`.
    return rounded + 0;
  }
  return value;
}

/** One cleared face waiting for its removal countdown (spec AC-2: no plate, no fading). */
interface FaceRemoval {
  /** Milliseconds the countdown has run so far. */
  elapsedMs: number;
  /** Total countdown: the active profile's `faceFadeMs` (400 / 100 ms). */
  readonly durationMs: number;
}

/**
 * The authoritative server world the scene renders (T12; spec § 5, § 9). Values only:
 * they arrive from `multiplayer/server-state.ts` after `welcome`/`worldEntered` and the
 * scene never invents or re-derives a shared position.
 */
export interface SceneWorld {
  /** Server capacity X — the remote world renders at most `X − 1` cubes (Q-T10-1). */
  maxUsers: number;
  /** The own member's server-assigned slot position (`rest pose = (px, py, 12)`). */
  ownPosition: Position;
  /** The server's other members in slot order; the own member is never in this list. */
  roster: readonly MemberState[];
}

/**
 * The composed scene handed to the session/loop: the three.js root, the camera, the
 * per-frame inputs and the lifecycle hooks.
 */
export interface SceneView {
  /** The scene root (starfield, cube view, particles, lights). Exposed for tests/loop. */
  scene: Scene;
  /** The pinned camera (AC-2). */
  camera: PerspectiveCamera;
  /**
   * The cube view currently in the scene, for callers that need its handles at call
   * time (the session's `pickMiniCube(camera, cubeView, …)` pick).
   *
   * A `readonly` accessor, not a stored field: the snapshot rebuild replaces the cube
   * view, so a reference captured once would be the disposed previous handle. Re-read it
   * at the point of use.
   */
  readonly cubeView: CubeView;
  /**
   * The remote-cube world view, or `null` before the first `welcome` (offline defaults and
   * the pre-welcome intro). It is rebuilt exactly once at a cross-server level midpoint.
   */
  readonly worldView: WorldView | null;
  /**
   * Enters a server world immediately (`welcome`/resume): builds the {@link WorldView} with
   * the server's `maxUsers`, applies the remote roster, moves the own cube to
   * `ownPosition` and clears any queued cross-server swap. Replaces a previous world by
   * disposing it exactly once.
   */
  enterWorld(world: SceneWorld): void;
  /**
   * Queues a cross-server move (`worldEntered`): the replacement world is applied at the
   * next level midpoint, together with the `levelChanged` rebuild. The old {@link WorldView}
   * is disposed exactly once and the new one is built from the new roster.
   */
  queueWorldSwap(world: SceneWorld): void;
  /**
   * Applies one remote-cube server message (`miniCubeRemoved`, `levelAdvanced`,
   * `memberJoined`, `memberLeft`) to the live {@link WorldView}; a no-op before `welcome`.
   */
  applyWorldMessage(msg: ServerMessage): void;
  /**
   * Applies the engine's ordered effect intents: explosion → start the tile's pop and spawn
   * its burst in front of the face surface; `faceCleared` → start the face-removal
   * countdown; `levelChanged` → mark the cube rebuild pending (the next snapshot performs
   * it). `nowMs` is the frame time used to order pooled bursts.
   */
  applyIntents(intents: EffectIntent[], nowMs: number): void;
  /**
   * Applies one engine snapshot in the pinned order: motion setting, rebuild step (exactly
   * one rebuild when a level change is pending or the style/grid size changed), camera
   * (intro dolly, the destination-driven online flight or the drawn-directional offline
   * flight, a spectate/return flight, or the rest pose over the current cube) and, under
   * reduced motion, the instant settle of any running pop.
   *
   * `nowMs` is the frame time the plan's contract carries (the loop passes it); the
   * snapshot application itself is a pure function of the snapshot values — the flights
   * read `phaseProgress`, the expansion is applied on {@link SceneView.update} — so the
   * scene does not consume it.
   */
  applySnapshot(snapshot: EngineSnapshot, nowMs: number): void;
  /** Advances the frame-driven parts: the starfield swirl/scale, particles, removals, pops. */
  update(dtMs: number): void;
  /** Disposes every geometry/material it owns (exactly once) and empties the scene. */
  dispose(): void;
}

/**
 * Builds the composed scene for one cube level.
 *
 * @param options.style starting cube style (the cube view's materials).
 * @param options.gridSize tiles per face edge; defaults to the pinned `GRID_SIZE` (5).
 * @param options.random source for the starfield layout and the particle jitter; injected
 * so a seeded source makes the whole scene deterministic (defaults to `Math.random`).
 * @param options.ownPosition the own member's server slot position; defaults to the
 * offline origin `(0, 0)`, so the offline rest pose and intro stay exactly at `(0,0,12)`.
 */
export function createSceneView(options: {
  style: CubeStyle;
  gridSize?: number;
  random?: () => number;
  ownPosition?: Position;
}): SceneView {
  const gridSize = options.gridSize ?? GRID_SIZE;
  const random = options.random ?? Math.random;

  const scene = new Scene();
  scene.background = new Color(BACKGROUND_COLOR);

  const ambientLight = new AmbientLight(0xffffff, AMBIENT_INTENSITY);
  const keyLight = new DirectionalLight(0xffffff, KEY_INTENSITY);
  keyLight.position.set(KEY_LIGHT_POSITION.x, KEY_LIGHT_POSITION.y, KEY_LIGHT_POSITION.z);

  const starfield: Starfield = createStarfield(random);
  /** The own cube's world position on the flat plane (z = 0). */
  const cubePosition = new Vector3(
    options.ownPosition?.x ?? 0,
    options.ownPosition?.y ?? 0,
    0,
  );
  let cube: CubeView = createCubeView(options.style, gridSize);
  cube.group.position.copy(cubePosition);
  const particles: ParticleSystem = createParticleSystem(random);

  scene.add(ambientLight, keyLight, starfield.points, cube.group, particles.group);

  const camera = new PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR);
  camera.position.set(cubePosition.x, cubePosition.y, REST_Z);
  camera.lookAt(cubePosition.x, cubePosition.y, 0);

  /**
   * The camera pose the starfield anchors to. The anchor holds the camera's live vectors
   * (plan D-7), so it follows every flight — including the lateral travel — with zero
   * per-frame allocation.
   */
  const starfieldAnchor: StarfieldAnchor = {
    position: camera.position,
    quaternion: camera.quaternion,
  };

  /** Style of the cube view currently in the scene (the rebuild step compares it). */
  let currentStyle = options.style;
  /** Grid edge of the cube view currently in the scene (the rebuild step compares it). */
  let currentGridSize = gridSize;
  /** Style of a `levelChanged` intent awaiting its snapshot (spec AC-3: pending rebuild). */
  let pendingLevelChanged: CubeStyle | null = null;
  /** Latest motion setting; decides the removal countdown and the instant pop mode. */
  let reducedMotion = false;
  /** Starfield travel input kept for `update` — 0..1, 0 outside a travel phase. */
  let travelProgress = 0;
  /** Phase of the previous snapshot (detects the travel-start transition). */
  let lastPhase: Phase | null = null;
  /** The finished cube's world position, captured when the travel phase starts. */
  const travelFrom = new Vector3();
  /** The drawn direction of the running travel, captured with {@link travelFrom}. */
  let travelDirection: TravelDirection | null = null;
  /** The live remote-cube world (built after `welcome`); `null` offline / before welcome. */
  let world: WorldView | null = null;
  /** A `worldEntered` replacement waiting for the next level midpoint (AC-12). */
  let pendingWorld: SceneWorld | null = null;
  /** The last `spectate` target's rest position: the camera rests over it while spectating. */
  let spectateTarget: Vector3 | null = null;
  /** The snapshot's spectating flag (drives the playing rest pose). */
  let spectating = false;
  const faceRemovals = new Map<FaceId, FaceRemoval>();
  const instanceMatrix = new Matrix4();
  const introPosition = new Vector3();
  const introTarget = new Vector3();
  const travelPosition = new Vector3();
  const travelTarget = new Vector3();
  let disposed = false;

  /**
   * World-space origin of the instance an explosion belongs to. `hideMiniCube` validated
   * the id (and keeps the tile's position through the pop), so the index is on the grid;
   * the cube's world matrix carries the current orientation and world position.
   */
  function instanceOrigin(mesh: InstancedMesh, id: MiniCubeId): Vector3 {
    const [, rowText, colText] = id.split(':');
    const index = Number(rowText) * currentGridSize + Number(colText);
    cube.group.updateMatrixWorld(true);
    mesh.getMatrixAt(index, instanceMatrix);
    instanceMatrix.premultiply(cube.group.matrixWorld);
    return new Vector3().setFromMatrixPosition(instanceMatrix);
  }

  /**
   * World-space outward normal of a face: the group-space {@link FACE_NORMALS} entry turned
   * by the cube's current orientation, with the quarter-turn trig residue snapped away so
   * the burst offset stays exactly assertable (spec AC-3).
   */
  function worldFaceNormal(faceId: FaceId): Vector3 {
    cube.group.updateMatrixWorld(true);
    const normal = FACE_NORMALS[faceId].clone().transformDirection(cube.group.matrixWorld);
    return snapToQuarterTurns(normal);
  }

  /**
   * One explosion: the tile starts its pop, and its burst plays {@link BURST_ORIGIN_OFFSET}
   * in front of the clicked surface so the particles read as blowing towards the camera.
   * Origin and normal are read *before* the hide, so the pop can never affect the burst.
   */
  function applyExplosion(
    intent: Extract<EffectIntent, { kind: 'explosion' }>,
    nowMs: number,
  ): void {
    const mesh = cube.faces.get(intent.faceId);
    if (mesh === undefined) {
      // A face whose instances are already gone has no origin left; the burst falls back to
      // the cube centre (no normal, no offset) rather than producing a NaN position.
      cube.hideMiniCube(intent.id, reducedMotion);
      particles.spawn(intent.burst, new Vector3(), nowMs);
      return;
    }
    const origin = instanceOrigin(mesh, intent.id);
    const normal = worldFaceNormal(intent.faceId);
    cube.hideMiniCube(intent.id, reducedMotion);
    origin.addScaledVector(normal, BURST_ORIGIN_OFFSET);
    particles.spawn(intent.burst, origin, nowMs);
  }

  /**
   * One cleared face: with no plate left to fade (spec AC-2), the face stays in place for
   * the active profile's `faceFadeMs` — long enough for its last tile's 160 ms pop — and is
   * then detached and disposed by {@link advanceFaceRemovals}. Nothing about the material changes.
   */
  function applyFaceCleared(faceId: FaceId): void {
    if (faceRemovals.has(faceId)) {
      return;
    }
    faceRemovals.set(faceId, { elapsedMs: 0, durationMs: timingsFor(reducedMotion).faceFadeMs });
  }

  /** Sets the camera to the rest pose over a world-plane point (AC-3). */
  function applyRestAt(x: number, y: number): void {
    camera.position.set(x, y, REST_Z);
    camera.lookAt(x, y, 0);
  }

  /** Sets the camera to the rest pose over the own cube (AC-3). */
  function applyRestPose(): void {
    applyRestAt(cubePosition.x, cubePosition.y);
  }

  /**
   * The rest pose the current mode rests over: the spectated member's cube while
   * spectating, the own cube otherwise (spec § 6).
   */
  function applyCurrentRestPose(): void {
    if (spectating && spectateTarget !== null) {
      applyRestAt(spectateTarget.x, spectateTarget.y);
      return;
    }
    applyRestPose();
  }

  /** Builds a remote world; a roster that violates the server capacity is disposed at once. */
  function buildWorld(state: SceneWorld): WorldView {
    const built = createWorldView({ maxUsers: state.maxUsers, random });
    try {
      built.applyRoster(state.roster);
    } catch (error) {
      built.dispose();
      throw error;
    }
    return built;
  }

  /** Disposes the live remote world exactly once and detaches it from the scene. */
  function disposeWorld(): void {
    if (world === null) {
      return;
    }
    const previous = world;
    world = null;
    scene.remove(previous.group);
    previous.dispose();
  }

  /**
   * Enters a server world (welcome/resume): the fresh world is built first (so a rejected
   * roster leaves the current world intact), then the previous world is disposed exactly
   * once, the own cube moves to the server position and the pending swap is cleared.
   */
  function enterServerWorld(state: SceneWorld): void {
    if (disposed) {
      return;
    }
    const replacement = buildWorld(state);
    disposeWorld();
    pendingWorld = null;
    spectateTarget = null;
    cubePosition.set(state.ownPosition.x, state.ownPosition.y, 0);
    cube.group.position.copy(cubePosition);
    world = replacement;
    scene.add(world.group);
  }

  /**
   * Applies a queued cross-server move at the level midpoint: the old world is disposed
   * exactly once and the new one is built from the new roster (AC-12). The own cube's
   * final position is the server-assigned slot of the target world.
   */
  function applyPendingWorldSwap(): void {
    const next = pendingWorld;
    if (next === null) {
      return;
    }
    pendingWorld = null;
    const replacement = buildWorld(next);
    disposeWorld();
    cubePosition.set(next.ownPosition.x, next.ownPosition.y, 0);
    cube.group.position.copy(cubePosition);
    world = replacement;
    scene.add(world.group);
  }

  /**
   * The pinned rebuild step (spec AC-3). Runs exactly once when a `levelChanged` is pending
   * or the snapshot's style id / grid size no longer matches the live cube view: the old
   * view is disposed exactly once, the world position advances to the snapshot's target
   * (the drawn direction's offset offline, the server-assigned destination online — a
   * style/grid reconciliation rebuilds in place), and the fresh view is built at the
   * snapshot's style and grid size. A queued `worldEntered` swap is applied here, at the
   * level midpoint, after the own cube has moved.
   */
  function rebuildCubeIfNeeded(snapshot: EngineSnapshot): void {
    const pending = pendingLevelChanged;
    const styleChanged = snapshot.style.id !== currentStyle.id;
    const gridChanged = snapshot.gridSize !== currentGridSize;
    if (pending === null && !styleChanged && !gridChanged) {
      return;
    }
    if (pending !== null) {
      const kind = snapshot.travelKind ?? null;
      const destination = snapshot.travelDestination ?? null;
      if (kind === 'nextLevel' && destination !== null) {
        // Destination-driven online advance: the server assigned the slot (AC-12).
        cubePosition.set(destination.x, destination.y, 0);
      } else if (kind === 'spectate' || kind === 'return') {
        // Camera-only flights never move the own cube.
      } else {
        // `travelDirection` is null outside a travel (defensive): the offset is then zero.
        const offset =
          snapshot.travelDirection === null
            ? null
            : TRAVEL_DIRECTION_OFFSETS[snapshot.travelDirection];
        cubePosition.x += offset === null ? 0 : offset.x;
        cubePosition.y += offset === null ? 0 : offset.y;
      }
    }
    const previous = cube;
    // A pending removal belongs to the cube that is leaving; the new cube is untouched.
    faceRemovals.clear();
    cube = createCubeView(snapshot.style, snapshot.gridSize);
    cube.group.position.copy(cubePosition);
    currentStyle = snapshot.style;
    currentGridSize = snapshot.gridSize;
    pendingLevelChanged = null;
    scene.remove(previous.group);
    scene.add(cube.group);
    previous.dispose();
    if (pending !== null) {
      // The world swap rides the same level-change midpoint: the old world is disposed
      // exactly once and the new roster is built at the server-assigned target position.
      // A style/grid reconciliation (no level change) never swaps worlds.
      applyPendingWorldSwap();
    }
  }

  /**
   * The intro dolly, the travel flights and the rest pose over the current cube
   * (AC-2/AC-3, AC-12, AC-17), plus the starfield travel input the travel phase drives
   * (AC-1/AC-3).
   */
  function applyCamera(snapshot: EngineSnapshot): void {
    const progress = Math.min(1, Math.max(0, snapshot.phaseProgress));
    const kind = snapshot.travelKind ?? null;
    const destination = snapshot.travelDestination ?? null;

    // Capture the flight origin on the travel-start transition, before anything can move
    // `cubePosition` (the midpoint rebuild happens later in this same function's frame):
    // neither the lateral offset nor a destination may be counted twice. A return flight
    // starts from the rest the camera currently holds (the spectated cube), the others
    // from the own cube.
    if (snapshot.phase === 'travel' && lastPhase !== 'travel') {
      const restOrigin = spectateTarget;
      if (restOrigin !== null && (kind === 'return' || spectating)) {
        // A return (or a selection while already spectating) starts from the rest the
        // camera currently holds: the spectated member's cube.
        travelFrom.copy(restOrigin);
      } else {
        travelFrom.copy(cubePosition);
      }
      travelDirection = snapshot.travelDirection;
      if (kind === 'spectate' && destination !== null) {
        spectateTarget = new Vector3(destination.x, destination.y, 0);
      }
    }

    if (snapshot.reducedMotion) {
      // No fly-through and no expansion: the camera rests over its target at every
      // progress. A camera-only flight is an instant positional swap (AC-17); a level
      // travel swaps the cube (and therefore the rest pose) at the midpoint.
      travelProgress = 0;
      if (
        snapshot.phase === 'travel' &&
        (kind === 'spectate' || kind === 'return') &&
        destination !== null
      ) {
        applyRestAt(destination.x, destination.y);
        return;
      }
      applyCurrentRestPose();
      return;
    }
    if (snapshot.phase === 'intro') {
      travelProgress = 0;
      introCameraPose(progress, introPosition, introTarget);
      // The dolly targets the own server slot: offline the position is (0,0), so the
      // accepted (0,0,60) → (0,0,12) table is unchanged (AC-24).
      camera.position.set(
        introPosition.x + cubePosition.x,
        introPosition.y + cubePosition.y,
        introPosition.z,
      );
      camera.lookAt(
        introTarget.x + cubePosition.x,
        introTarget.y + cubePosition.y,
        introTarget.z,
      );
      return;
    }
    if (snapshot.phase === 'travel') {
      if (kind === 'nextLevel') {
        if (destination === null) {
          // The online hold: no destination yet, so no flight starts. The camera stays at
          // the rest pose with progress 0 (Q-T8-2, AC-12).
          travelProgress = 0;
          applyCurrentRestPose();
          return;
        }
        travelProgress = progress;
        writeTravelPose(
          progress,
          travelFrom.x,
          travelFrom.y,
          destination.x - travelFrom.x,
          destination.y - travelFrom.y,
          travelPosition,
          travelTarget,
        );
        camera.position.copy(travelPosition);
        camera.lookAt(travelTarget);
        return;
      }
      if (kind === 'spectate' || kind === 'return') {
        if (destination === null) {
          // Defensive: a camera-only flight always carries its server destination.
          travelProgress = 0;
          applyCurrentRestPose();
          return;
        }
        travelProgress = progress;
        const pose = spectateTravelPose(travelFrom, destination, progress);
        camera.position.set(pose.position.x, pose.position.y, pose.position.z);
        camera.lookAt(pose.lookTarget.x, pose.lookTarget.y, pose.lookTarget.z);
        return;
      }
      travelProgress = progress;
      // Offline directional flight from the captured origin: lateral toward the drawn
      // offset while the depth keeps the retained symmetric swing (12 → 90 → 12).
      travelCameraPose(
        progress,
        travelFrom.x,
        travelFrom.y,
        travelDirection,
        travelPosition,
        travelTarget,
      );
      camera.position.copy(travelPosition);
      camera.lookAt(travelTarget);
      return;
    }
    travelProgress = 0;
    // A skip can leave the intro mid-pan; the rest pose is the position *and* the
    // orientation, so the camera always lands looking straight at the current cube.
    applyCurrentRestPose();
  }

  /** Advances the face-removal countdowns; a completed countdown removes (and disposes) its face. */
  function advanceFaceRemovals(dtMs: number): void {
    const advanceMs = Math.max(0, dtMs);
    for (const [faceId, removal] of faceRemovals) {
      removal.elapsedMs += advanceMs;
      if (removal.elapsedMs >= removal.durationMs) {
        faceRemovals.delete(faceId);
        cube.removeFace(faceId);
      }
    }
  }

  const view: SceneView = {
    scene,
    camera,

    get cubeView(): CubeView {
      // Rebuild-aware: the rebuild step re-assigns the binding, so the getter always
      // answers with the cube view the scene currently holds (never a stale one).
      return cube;
    },

    get worldView(): WorldView | null {
      return world;
    },

    enterWorld(state: SceneWorld): void {
      enterServerWorld(state);
    },

    queueWorldSwap(state: SceneWorld): void {
      if (disposed) {
        return;
      }
      pendingWorld = {
        maxUsers: state.maxUsers,
        ownPosition: { x: state.ownPosition.x, y: state.ownPosition.y },
        roster: [...state.roster],
      };
    },

    applyWorldMessage(msg: ServerMessage): void {
      world?.applyMessage(msg);
    },

    applyIntents(intents: EffectIntent[], nowMs: number): void {
      for (const intent of intents) {
        switch (intent.kind) {
          case 'explosion':
            applyExplosion(intent, nowMs);
            break;
          case 'faceCleared':
            applyFaceCleared(intent.faceId);
            break;
          case 'levelChanged':
            // Pending: the next snapshot carries the new style, grid size and direction.
            pendingLevelChanged = intent.style;
            break;
          case 'travelStarted':
            // Travel lives in the snapshot: the directional camera flight and the starfield
            // scale follow `phaseProgress`, so the one-shot marker needs no state of its own.
            break;
        }
      }
    },

    applySnapshot(snapshot: EngineSnapshot): void {
      // The frame time stays in the pinned `SceneView` signature for the loop; every value
      // applied here comes from the snapshot (removals/pops are driven by `update`'s dt).
      // Pinned order: motion setting → rebuild → camera → orientation → reduced settle.
      reducedMotion = snapshot.reducedMotion;
      spectating = snapshot.spectating ?? false;
      rebuildCubeIfNeeded(snapshot);
      applyCamera(snapshot);
      const from = snapshot.rotationFrom ?? snapshot.orientation;
      const progress = snapshot.rotationFrom === null ? 1 : snapshot.rotationProgress;
      const rotation = interpolateRotation(from, snapshot.orientation, progress);
      // `game/rotation.ts` pins the frame: `rotation.set(pitch, yaw, 0)` in the default
      // three.js 'XYZ' order puts `frontFace(orientation)` at the camera.
      cube.group.rotation.set(rotation.pitch, rotation.yaw, 0);
      if (snapshot.reducedMotion) {
        // A live switch to reduced motion settles any running pop on the spot (AC-4).
        cube.settlePops();
      }
      lastPhase = snapshot.phase;
    },

    update(dtMs: number): void {
      // The travel input persists between snapshots: a frame that only advances time
      // keeps the current expansion and the swirl (see `starfield.update`). The anchor is
      // the live camera pose, so the backdrop stays camera-centred in every phase.
      starfield.update(dtMs, travelProgress, starfieldAnchor);
      particles.update(dtMs);
      advanceFaceRemovals(dtMs);
      // Remote cubes and their pops advance on the same clock, after the own removals.
      world?.update(dtMs);
      // Pops advance after the removals, so a face removed this frame never receives a write.
      cube.update(dtMs);
    },

    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      faceRemovals.clear();
      starfield.dispose();
      cube.dispose();
      particles.dispose();
      disposeWorld();
      scene.clear();
    },
  };

  return view;
}
