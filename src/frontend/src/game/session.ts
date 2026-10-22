/**
 * Game session (T13) — the browser boundary the UI drives.
 *
 * Layer: session (`game/session.ts`). It owns the whole runtime lifecycle: environment
 * resolution, the engine, the scene view, the renderer adapter, the event listeners and
 * the frame loop. Every environment value arrives through {@link SessionEnvironment}, so
 * the module itself reads no host globals and the whole wiring is testable with a fake
 * environment (the default environment is assembled in `browser-env.ts`).
 *
 * **Ownership.** The engine owns the game state (plan § Data flow); the scene owns the
 * three.js objects; the session owns the *loop* and the *connections* between them:
 *
 * 1. input listeners (pointer on the canvas, keys on the key target) → `input/**` →
 *    `engine.dispatch`,
 * 2. the scheduler's frame → `engine.advance(dt)` → drain intents → `scene.applyIntents`
 *    → `scene.applySnapshot` → `scene.update` → `renderer.render` → reschedule,
 * 3. the motion / visibility / resize sources → live motion switching, loop pause and
 *    viewport refresh.
 *
 * **Multiplayer (T13).** An optional {@link Transport} turns the session into the
 * composition root of the online protocol: it is the only owner of the transport
 * lifecycle (connect on attach, close on dispose, subscriptions removed on teardown) and
 * the only writer of server authority into the engine:
 *
 * - every message is reduced into the pure `server-state` world; the remote-cube subset is
 *   forwarded to the scene;
 * - the engine holds its intro at progress 0 until `welcome`, then the intro clock starts
 *   and the scene enters the server world at the own slot position (AC-23);
 * - own-cube play stays optimistic: a successful `explodeMiniCube` is forwarded as
 *   `explode { id, level }`; the server's `miniCubeRemoved` ack is a no-op when the local
 *   board already matches, and `stateSync`/`welcome` adopt the authoritative cube exactly in
 *   both directions (restored and removed tiles, level/grid/style) — stats are never rolled
 *   back (AC-14);
 * - clearing the sixth face sends `cubeCompleted { level }` and the engine (created in
 *   online mode) holds the level travel until the server's `levelAdvanced`/`worldEntered`
 *   data releases it; `worldEntered` also queues the scene's midpoint world swap and the
 *   session applies the reducer's world swap at the level midpoint (AC-12);
 * - spectate flights are camera-only engine travels: selection → `travelTo (spectate,
 *   destination)` → arrival → `setSpectating(true)`; return / target left → `travelTo
 *   (return, own position)` → arrival → `setSpectating(false)` (AC-18, AC-19);
 * - while the transport is not connected every gameplay input dispatch is gated and the
 *   engine is frozen, so a level travel holds; a resume `welcome` abandons a running
 *   camera-only flight (the engine returns to `playing` with no intents), adopts the
 *   authoritative own cube (which also releases a held level travel) and re-enters the world
 *   instantly (AC-22, AC-19 d).
 *
 * Without a transport the session keeps its offline behaviour unchanged: no transport is
 * connected, no message is reduced, and `canRun()` is always true. The T14-facing
 * multiplayer surface ({@link OnlineGameSession}) still exists and reports the inert
 * `connecting` status / empty world, so the UI can be composed the same way.
 *
 * **Phase policy for pointer input** (plan § session contract; `gestures.ts` is
 * phase-agnostic and classifies only): during `intro` a tap skips and a drag does
 * nothing; while `playing` a tap picks the current front face through
 * `pickMiniCube(sceneView.camera, sceneView.cubeView, frontFace(snapshot.orientation), …)`
 * (a hit explodes that mini-cube, a miss or a non-front-face hit does nothing) and a
 * **drag does nothing at all** — pointer rotation was removed, so a drag never rotates
 * and never explodes, at any time (mid-rotation included); `travel` ignores pointer input
 * entirely. Both scene handles are read from the live scene view at pick time —
 * `cubeView` through the rebuild-aware accessor, so a `levelChanged` rebuild can never
 * leave the pick with a disposed handle.
 *
 * **three.js surface.** The only reference to three.js here is the type-only
 * `RendererAdapter` signature the plan pins; the session never imports or constructs it.
 *
 * **Lifecycle.** `attach` is idempotent and `dispose` is idempotent; disposing cancels the
 * pending frame, removes every listener it added, unsubscribes every source and transport
 * handler, closes the transport, disposes the renderer and the scene, and leaves no
 * callback that could render again. A session that was disposed may be attached again (a
 * fresh renderer/scene cycle for the same engine state, plus a fresh transport connect),
 * which keeps the component contract valid when a host mounts the same session instance
 * twice.
 */

import type { PerspectiveCamera, Scene } from 'three';

import { classifyPointer, type PointerGesture } from '../input/gestures';
import { mapKey } from '../input/keyboard';
import type { ClientMessage, CubeState, ServerMessage } from '../multiplayer/protocol';
import {
  applyWorldSwap,
  createWorldState,
  reduceWorldState,
  type WorldState,
} from '../multiplayer/server-state';
import { createSpectateController, type SpectateStatus } from '../multiplayer/spectate';
import type { Transport, TransportStatus } from '../multiplayer/transport';
import { pickMiniCube } from '../render/picking';
import { createSceneView, type SceneView } from '../render/scene';
import { browserEnvironment } from '../browser-env';
import { PIXEL_RATIO_CAP } from './effects';
import { createEngine, type EngineSnapshot, type GameEngine, type GameEvent } from './engine';
import { CUBE_STYLES } from './progression';
import { frontFace } from './rotation';
import type { Board, CubeStyle, MiniCubeId } from './types';

/** The drawing surface the session listens on and sizes. */
export interface CanvasLike {
  addEventListener(type: string, handler: (event: unknown) => void): void;
  removeEventListener(type: string, handler: (event: unknown) => void): void;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
  width: number;
  height: number;
}

/** The only frame source the loop may use (the default wraps the refresh callback). */
export interface FrameScheduler {
  schedule(cb: (nowMs: number) => void): number;
  cancel(handle: number): void;
}

/** `prefers-reduced-motion` reader: the current value plus live changes. */
export interface MotionSource {
  matches(): boolean;
  subscribe(cb: (reduced: boolean) => void): () => void;
}

/** Tab visibility reader: the current value plus live changes. */
export interface VisibilitySource {
  isHidden(): boolean;
  subscribe(cb: (hidden: boolean) => void): () => void;
}

/** Surface-size reader: fires whenever the element's box changes. */
export interface ResizeSource {
  subscribe(cb: () => void): () => void;
}

/** The narrow renderer surface the session drives (three's `WebGLRenderer` fits it). */
export interface RendererAdapter {
  setSize(width: number, height: number): void;
  setPixelRatio(ratio: number): void;
  render(scene: Scene, camera: PerspectiveCamera): void;
  dispose(): void;
}

/** Everything the session needs from the host, injectable end to end. */
export interface SessionEnvironment {
  canvas: CanvasLike;
  keyTarget: {
    addEventListener(type: string, handler: (event: unknown) => void): void;
    removeEventListener(type: string, handler: (event: unknown) => void): void;
  };
  scheduler: FrameScheduler;
  motion: MotionSource;
  visibility: VisibilitySource;
  resize: ResizeSource;
  rendererFactory: (canvas: CanvasLike) => RendererAdapter;
  now(): number;
  random(): number;
  devicePixelRatio(): number;
}

/** The runtime handle the UI holds. */
export interface GameSession {
  /** Resolves the environment, starts the engine and the frame loop; idempotent. */
  attach(canvas: CanvasLike): void;
  /** Stops the loop, releases the renderer and the scene, removes every listener; idempotent. */
  dispose(): void;
  /** The engine snapshot passthrough (the React store reads this). */
  getSnapshot(): EngineSnapshot;
  /** Subscribes to snapshot changes; the returned function unsubscribes. */
  subscribe(listener: () => void): () => void;
}

/**
 * Everything the multiplayer UI reads (T14): the transport status, the authoritative
 * world (reduced from server messages) and the client-local spectate state. The object is
 * referentially stable until one of its three branches changes.
 */
export interface MultiplayerSnapshot {
  status: TransportStatus;
  world: WorldState;
  spectate: SpectateStatus;
}

/**
 * The online session surface: the offline {@link GameSession} contract plus the commands
 * and the store the multiplayer UI drives. Offline sessions expose it too (inert): the
 * status stays `connecting`, the world is empty and the commands return `false`.
 */
export interface OnlineGameSession extends GameSession {
  /** The multiplayer store read (referentially stable until status/world/spectate change). */
  getMultiplayerSnapshot(): MultiplayerSnapshot;
  /** Subscribes to multiplayer store changes; the returned function unsubscribes. */
  subscribeMultiplayer(listener: () => void): () => void;
  /** Selects one server member's cube; `false` when the request is not allowed right now. */
  spectateMember(playerId: string): boolean;
  /** Flies back to the own cube from spectating; `false` when not viewing a member. */
  returnToOwnCube(): boolean;
  /** The banner's `Retry`: closes and restarts the connection (no-op offline). */
  retryConnection(): void;
}

/** Construction options; the environment, the engine and the transport are all injectable. */
export interface GameSessionOptions {
  env?: SessionEnvironment;
  engine?: GameEngine;
  /**
   * The multiplayer transport. Omitting it keeps the offline behaviour (and the existing
   * session contract): the session never connects, never reads a frame and does not gate
   * input. Supplying it enables the protocol wiring described in the module header.
   */
  transport?: Transport;
}

/** One press, in client coordinates (the canvas origin is subtracted when it is classified). */
interface PressPosition {
  x: number;
  y: number;
}

/** True when the id is still present on the board (the reconcile decision). */
function boardHasId(board: Board, id: MiniCubeId): boolean {
  return board.faces.some((face) => face.miniCubes.some((miniCube) => miniCube.id === id));
}

/** True when every face is empty — the sixth-face clear that triggers `cubeCompleted`. */
function isBoardCleared(board: Board): boolean {
  return board.faces.every((face) => face.miniCubes.length === 0);
}

/** The server's style id resolved to the pinned style list, falling back to the cycle. */
function resolveStyle(styleId: string, levelIndex: number): CubeStyle {
  return (
    CUBE_STYLES.find((style) => style.id === styleId) ??
    CUBE_STYLES[levelIndex % CUBE_STYLES.length]!
  );
}

/**
 * Creates one game session. Nothing is attached until {@link GameSession.attach} is
 * called; the engine (injected or created here) exists from this point on, so
 * `getSnapshot`/`subscribe` are safe to use before the first attach.
 */
export function createGameSession(options: GameSessionOptions = {}): OnlineGameSession {
  const providedEnv = options.env;
  const transport = options.transport;
  /** Online only when a transport was injected: no transport keeps the offline defaults. */
  const online = transport !== undefined;
  /** Only an engine created here may be replaced to adopt the server's level-0 cube. */
  const ownsEngine = options.engine === undefined;
  let engine: GameEngine =
    options.engine ?? (online ? createEngine({ online: true }) : createEngine());

  const spectate = createSpectateController();
  /** The server-authoritative world, reduced from every received frame. */
  let world = createWorldState();
  /** The transport status the banner reads. */
  let status: TransportStatus = 'connecting';
  /** True between a `welcome` and the next non-connected status (input/travel gate). */
  let welcomed = false;
  /** The level whose `cubeCompleted` was sent, and not yet answered by authority. */
  let completionLevel: number | null = null;
  /** Set when the spectated target left mid-flight: fly home once the current flight lands. */
  let pendingAutoReturn = false;
  /** The owned engine adopted the server's level-0 grid/style exactly once. */
  let adoptedInitialCube = false;
  /** The scene of the live attach cycle; `null` while detached. */
  let activeScene: SceneView | null = null;
  /** The environment of the live attach cycle (the owned engine's replacement random). */
  let activeEnv: SessionEnvironment | null = null;

  /** True between a successful `attach` and its `dispose`. */
  let active = false;
  /** Releases everything the current attach cycle created; `null` while detached. */
  let teardown: (() => void) | null = null;
  const unsubscribers: Array<() => void> = [];
  const listeners = new Set<() => void>();
  /** The snapshot the listeners were last told about (identity = "nothing changed"). */
  let publishedSnapshot: EngineSnapshot | null = null;

  const multiplayerListeners = new Set<() => void>();
  /** The last built multiplayer object; reused while status/world/spectate are unchanged. */
  let multiplayerCache: MultiplayerSnapshot | null = null;
  /** The multiplayer object the listeners were last told about. */
  let publishedMultiplayer: MultiplayerSnapshot;

  /** Notifies subscribers when the snapshot changed — the referential-stability contract. */
  function publish(snapshot: EngineSnapshot): void {
    if (snapshot === publishedSnapshot) {
      return;
    }
    publishedSnapshot = snapshot;
    for (const listener of listeners) {
      listener();
    }
  }

  /** The multiplayer store read; branches keep their identity until they change. */
  function getMultiplayerSnapshot(): MultiplayerSnapshot {
    const currentSpectate = spectate.get();
    const cached = multiplayerCache;
    const next =
      cached === null ||
      cached.status !== status ||
      cached.world !== world ||
      cached.spectate !== currentSpectate
        ? { status, world, spectate: currentSpectate }
        : cached;
    multiplayerCache = next;
    return next;
  }

  publishedMultiplayer = getMultiplayerSnapshot();

  /** Notifies multiplayer listeners only when the combined store object changed. */
  function publishMultiplayer(): void {
    const snapshot = getMultiplayerSnapshot();
    if (snapshot === publishedMultiplayer) {
      return;
    }
    publishedMultiplayer = snapshot;
    for (const listener of multiplayerListeners) {
      listener();
    }
  }

  /**
   * Whether gameplay may run right now. Offline is always runnable; online needs an open
   * socket *and* a `welcome` — the intro holds at progress 0 until then (AC-23) and a
   * disconnect freezes every clock, so a running travel holds (AC-22).
   */
  function canRun(): boolean {
    return !online || (status === 'connected' && welcomed);
  }

  /** Applies one authoritative removal without forwarding it back to the server. */
  function applyAuthoritativeRemoval(id: MiniCubeId): void {
    const before = engine.getSnapshot();
    if (!boardHasId(before.board, id)) {
      return;
    }
    engine.dispatch({ type: 'explodeMiniCube', id });
    const after = engine.getSnapshot();
    if (after !== before) {
      publish(after);
    }
  }

  /**
   * Adopts an authoritative cube exactly (AC-14/AC-22): the engine restores tiles the server
   * still has, removes the authoritative extras, adopts a different level/grid/style and
   * releases a held level travel. Stats are never rolled back. Pre-online engine fakes
   * without the adoption seam fall back to the removal-only reconcile (their tests own that
   * contract; the real engine always implements it).
   */
  function reconcileCube(cube: CubeState): void {
    if (engine.adoptCubeState !== undefined) {
      engine.adoptCubeState({
        levelIndex: cube.levelIndex,
        gridSize: cube.gridSize,
        style: resolveStyle(cube.styleId, cube.levelIndex),
        removedIds: cube.removedIds as MiniCubeId[],
      });
      return;
    }
    for (const id of cube.removedIds) {
      applyAuthoritativeRemoval(id as MiniCubeId);
    }
  }

  /** Starts the camera-only flight back to the own server position. */
  function startOwnReturn(): void {
    dispatchAndPublish({
      type: 'travelTo',
      kind: 'return',
      destination: { x: world.self.position.x, y: world.self.position.y },
    });
  }

  /** `welcome` (join or resume): adopt the level-0 cube, enter the world, release the intro. */
  function handleWelcome(
    message: Extract<ServerMessage, { type: 'welcome' }>,
    previousSelfId: string,
  ): void {
    if (ownsEngine && !adoptedInitialCube) {
      const before = engine.getSnapshot();
      if (before.levelIndex === 0) {
        // The server draws level 0's grid and style; the provisional engine was built
        // before `welcome` and had to draw its own. Rebuilding adopts the server's cube.
        engine = createEngine({
          online: true,
          gridSize: message.self.gridSize,
          reducedMotion: before.reducedMotion,
          random: activeEnv?.random,
        });
      }
      adoptedInitialCube = true;
    }
    // A resume (same identity) resets the local-only view; a fresh join has nothing to
    // reset. A camera-only flight is abandoned first, so the next frame renders the own
    // rest pose without the remaining flight frames (AC-19 d / AC-22); the gate must be
    // lifted before the board reconcile: a spectating engine ignores removals. The adoption
    // that follows also releases a held `nextLevel` travel with the authoritative cube (F2).
    if (previousSelfId.length > 0 && previousSelfId === message.playerId) {
      const snapshot = engine.getSnapshot();
      const travelKind = snapshot.travelKind ?? null;
      if (snapshot.phase === 'travel' && (travelKind === 'spectate' || travelKind === 'return')) {
        engine.cancelTravel?.();
      }
      spectate.reset();
      engine.setSpectating?.(false);
    }
    reconcileCube(message.self);
    welcomed = true;
    completionLevel = null;
    pendingAutoReturn = false;
    activeScene?.enterWorld({
      maxUsers: world.maxUsers,
      ownPosition: world.self.position,
      roster: world.members,
    });
    publish(engine.getSnapshot());
    publishMultiplayer();
  }

  /**
   * `worldEntered` (cross-server mover): the target world is queued for the scene's
   * midpoint swap and the server's next cube releases the held level travel. Applied
   * immediately so both are in place before the midpoint snapshot (Q-T12-1).
   */
  function handleWorldEntered(
    message: Extract<ServerMessage, { type: 'worldEntered' }>,
  ): void {
    const snapshot = engine.getSnapshot();
    const waiting =
      (snapshot.phase === 'travel' && (snapshot.travelKind ?? null) === 'nextLevel') ||
      completionLevel !== null;
    if (waiting) {
      // The scene cannot read the store's pending swap (it must stay pending until the
      // midpoint), so its target world is built from the message's pending placement.
      const pending = world.pendingWorldSwap;
      if (pending !== null) {
        activeScene?.queueWorldSwap({
          maxUsers: pending.maxUsers,
          ownPosition: pending.position,
          roster: pending.roster.filter((entry) => entry.playerId !== world.self.playerId),
        });
      }
    } else {
      // Defensive fallback (protocol violation): enter the assigned world immediately.
      world = applyWorldSwap(world);
      activeScene?.enterWorld({
        maxUsers: world.maxUsers,
        ownPosition: world.self.position,
        roster: world.members,
      });
      publishMultiplayer();
    }
    completionLevel = null;
    engine.completeNextLevel?.({
      gridSize: message.self.gridSize,
      style: resolveStyle(message.self.styleId, message.self.levelIndex),
      destination: message.position,
    });
    publish(engine.getSnapshot());
  }

  /** `levelAdvanced` for the own cube: release the held travel with the server's next cube. */
  function handleLevelAdvanced(
    message: Extract<ServerMessage, { type: 'levelAdvanced' }>,
  ): void {
    if (message.playerId !== world.self.playerId) {
      return;
    }
    completionLevel = null;
    engine.completeNextLevel?.({
      gridSize: message.gridSize,
      style: resolveStyle(message.styleId, message.levelIndex),
      destination: message.position,
    });
    publish(engine.getSnapshot());
  }

  /** `miniCubeRemoved` ack: a consistent ack is a no-op; a missing tile is reconciled. */
  function handleMiniCubeRemoved(
    message: Extract<ServerMessage, { type: 'miniCubeRemoved' }>,
  ): void {
    if (message.playerId !== world.self.playerId) {
      return;
    }
    applyAuthoritativeRemoval(message.id);
  }

  /** `stateSync`: the server's full cube replaces the own board exactly (no stat rollback). */
  function handleStateSync(message: Extract<ServerMessage, { type: 'stateSync' }>): void {
    if (message.playerId !== world.self.playerId) {
      return;
    }
    completionLevel = null;
    reconcileCube(message);
    publish(engine.getSnapshot());
  }

  /** A member left: the spectated/travelled target triggers the flight home (AC-19 a/b). */
  function handleMemberLeft(playerId: string): void {
    const mode = spectate.get().mode;
    if (!spectate.onMemberLeft(playerId)) {
      return;
    }
    if (mode === 'viewing') {
      // The controller dropped to `none`; the flight home is the session's job.
      startOwnReturn();
      return;
    }
    if (mode === 'traveling') {
      // The engine cannot cancel a flight: remember to fly home once it lands.
      pendingAutoReturn = true;
    }
  }

  /** Reduces one decoded server frame into the world and applies its engine/scene effects. */
  function handleServerMessage(message: ServerMessage): void {
    const previousSelfId = world.self.playerId;
    world = reduceWorldState(world, message);
    switch (message.type) {
      case 'welcome':
        handleWelcome(message, previousSelfId);
        break;
      case 'worldEntered':
        handleWorldEntered(message);
        break;
      case 'memberJoined':
        break;
      case 'memberLeft':
        handleMemberLeft(message.playerId);
        break;
      case 'miniCubeRemoved':
        handleMiniCubeRemoved(message);
        break;
      case 'levelAdvanced':
        handleLevelAdvanced(message);
        break;
      case 'stateSync':
        handleStateSync(message);
        break;
      default:
        // `hello` (transport handshake) and `error` carry no world/engine action here.
        break;
    }
    activeScene?.applyWorldMessage(message);
    publishMultiplayer();
  }

  /** Transport status: leaving `connected` closes the input/clock gate until `welcome`. */
  function handleStatus(next: TransportStatus): void {
    status = next;
    if (next !== 'connected') {
      welcomed = false;
    }
    publishMultiplayer();
  }

  /** Dispatches one user event with the online gate, the `explode` forward and the publish. */
  function dispatchAndPublish(event: GameEvent): void {
    if (!canRun()) {
      return;
    }
    const before = engine.getSnapshot();
    engine.dispatch(event);
    const after = engine.getSnapshot();
    if (
      event.type === 'explodeMiniCube' &&
      after.stats.clicks > before.stats.clicks &&
      transport !== undefined
    ) {
      const message: ClientMessage = { type: 'explode', id: event.id, level: after.levelIndex };
      transport.send(message);
      if (completionLevel !== after.levelIndex && isBoardCleared(after.board)) {
        // The sixth face cleared: the server owns the next cube, so report completion and
        // let the online engine hold the travel until authority data releases it.
        completionLevel = after.levelIndex;
        transport.send({ type: 'cubeCompleted', level: after.levelIndex });
      }
    }
    publish(after);
  }

  /** Marks a finished camera-only flight: spectate lands in view mode, return lands home. */
  function handleTravelArrival(before: EngineSnapshot, after: EngineSnapshot): void {
    if (before.phase !== 'travel' || after.phase !== 'playing') {
      return;
    }
    if (before.travelKind === 'spectate' && spectate.get().mode === 'traveling') {
      spectate.arrive();
      engine.setSpectating?.(true);
      return;
    }
    if (before.travelKind === 'spectate' || before.travelKind === 'return') {
      // A return flight always ends home; a reset/reconnect mid-flight lands with no view.
      spectate.arrive();
      engine.setSpectating?.(false);
    }
  }

  /** Selects a member's cube: state machine first, then the camera-only engine travel. */
  function spectateMember(playerId: string): boolean {
    if (!online || !canRun()) {
      return false;
    }
    const snapshot = engine.getSnapshot();
    if (
      snapshot.phase !== 'playing' ||
      (snapshot.spectating ?? false) ||
      completionLevel !== null ||
      playerId === world.self.playerId
    ) {
      return false;
    }
    const member = world.members.find((candidate) => candidate.playerId === playerId);
    if (member === undefined) {
      return false;
    }
    const destination = { x: member.position.x, y: member.position.y };
    if (!spectate.requestTravel(playerId, destination)) {
      return false;
    }
    dispatchAndPublish({ type: 'travelTo', kind: 'spectate', destination });
    const after = engine.getSnapshot();
    if (after.phase !== 'travel' || after.travelKind !== 'spectate') {
      spectate.reset();
      publishMultiplayer();
      return false;
    }
    return true;
  }

  /** The `Return to my cube` command: a camera-only flight back to the own position. */
  function returnToOwnCube(): boolean {
    if (!online || !canRun() || spectate.get().mode !== 'viewing') {
      return false;
    }
    const destination = { x: world.self.position.x, y: world.self.position.y };
    if (!spectate.requestReturn(destination)) {
      return false;
    }
    dispatchAndPublish({ type: 'travelTo', kind: 'return', destination });
    const after = engine.getSnapshot();
    if (after.phase !== 'travel' || after.travelKind !== 'return') {
      spectate.arrivedHome();
      publishMultiplayer();
      return false;
    }
    return true;
  }

  /** The banner's `Retry`: a fresh connection cycle with the pinned `connecting` status. */
  function retryConnection(): void {
    if (transport === undefined) {
      return;
    }
    status = 'connecting';
    welcomed = false;
    publishMultiplayer();
    transport.close();
    transport.connect();
  }

  return {
    attach(target: CanvasLike): void {
      if (active) {
        return;
      }
      active = true;
      if (online) {
        // A fresh attach cycle must not run on a previous connection's welcome.
        welcomed = false;
      }

      const env = providedEnv ?? browserEnvironment(target);
      // The engine exists from session creation, so pre-attach snapshots run on its
      // deterministic fallback; attach is where the host's randomness arrives. The scene
      // is built at the level's drawn grid size (the engine's own value).
      engine.setRandomSource(env.random);
      const initialSnapshot = engine.getSnapshot();
      const view = createSceneView({
        style: initialSnapshot.style,
        random: env.random,
        gridSize: initialSnapshot.gridSize,
      });
      const adapter: RendererAdapter = env.rendererFactory(target);
      activeScene = view;
      activeEnv = env;

      let frameHandle: number | null = null;
      /** Frame time the next delta is measured from (a rewind never produces a negative dt). */
      let frameBaselineMs = env.now();
      let hidden = env.visibility.isHidden();
      let press: PressPosition | null = null;

      /** Pushes the container size, the capped pixel ratio and the camera aspect. */
      function applyViewport(): void {
        const rect = target.getBoundingClientRect();
        adapter.setPixelRatio(Math.min(env.devicePixelRatio(), PIXEL_RATIO_CAP));
        adapter.setSize(rect.width, rect.height);
        // Before the first layout the box is empty; a 1:1 aspect keeps the projection valid.
        view.camera.aspect = rect.height > 0 ? rect.width / rect.height : 1;
        view.camera.updateProjectionMatrix();
      }

      function scheduleFrame(): void {
        if (hidden || frameHandle !== null) {
          return;
        }
        frameHandle = env.scheduler.schedule(onFrame);
      }

      /** One frame: time → intents → snapshot → render, then the next frame. */
      function onFrame(nowMs: number): void {
        frameHandle = null;
        if (!active) {
          // A callback that escaped `cancel`: the session is gone and must not render.
          return;
        }
        const dtMs = Math.max(0, nowMs - frameBaselineMs);
        frameBaselineMs = nowMs;
        if (pendingAutoReturn && canRun() && engine.getSnapshot().phase === 'playing') {
          // The target left mid-flight; the current flight has landed, so fly home now.
          pendingAutoReturn = false;
          startOwnReturn();
        }
        const before = engine.getSnapshot();
        if (canRun()) {
          engine.advance(dtMs);
        }
        const after = engine.getSnapshot();
        if (after.levelIndex !== before.levelIndex) {
          // The online level midpoint: the queued cross-server world becomes current.
          world = applyWorldSwap(world);
        }
        handleTravelArrival(before, after);
        view.applyIntents(engine.drainIntents(), nowMs);
        const snapshot = engine.getSnapshot();
        view.applySnapshot(snapshot, nowMs);
        view.update(dtMs);
        adapter.render(view.scene, view.camera);
        publish(snapshot);
        publishMultiplayer();
        scheduleFrame();
      }

      function onPointerDown(event: unknown): void {
        const { clientX, clientY } = event as { clientX: number; clientY: number };
        press = { x: clientX, y: clientY };
      }

      /** Classifies the gesture at release: pointer events are the single input path. */
      function onPointerUp(event: unknown): void {
        const start = press;
        press = null;
        if (start === null) {
          return;
        }
        const { clientX, clientY } = event as { clientX: number; clientY: number };
        const rect = target.getBoundingClientRect();
        dispatchGesture(
          classifyPointer(
            { x: start.x - rect.left, y: start.y - rect.top },
            { x: clientX - rect.left, y: clientY - rect.top },
            { width: rect.width, height: rect.height },
          ),
        );
      }

      function onPointerCancel(): void {
        press = null;
      }

      /**
       * The phase policy: what one classified gesture means right now.
       *
       * A drag is classified by `gestures.ts` but dispatches nothing in any phase — the
       * pointer never rotates the cube (rotation is keyboard/auto only) and never explodes.
       */
      function dispatchGesture(gesture: PointerGesture): void {
        if (gesture === null) {
          return;
        }
        const snapshot = engine.getSnapshot();
        if (snapshot.phase === 'intro') {
          // A click during the intro only ever skips it — never picks, never explodes.
          if (gesture.kind === 'tap') {
            dispatchAndPublish({ type: 'introSkip' });
          }
          return;
        }
        if (snapshot.phase === 'travel') {
          return;
        }
        if (gesture.kind === 'drag') {
          // Pointer rotation was removed (spec AC-2): a drag does nothing at all — no
          // rotation, no explosion, no publish, so the snapshot identity is unchanged.
          return;
        }
        // Front-face gate: only the current front face is pickable (a hit on any other
        // face, a miss and a hidden instance all come back as `null`).
        const id = pickMiniCube(
          view.camera,
          view.cubeView,
          frontFace(snapshot.orientation),
          gesture.ndcX,
          gesture.ndcY,
        );
        if (id !== null) {
          dispatchAndPublish({ type: 'explodeMiniCube', id });
        }
      }

      function onKeyDown(event: unknown): void {
        const { key } = event as { key: string };
        const mapped = mapKey(key, engine.getSnapshot().phase);
        if (mapped !== null) {
          dispatchAndPublish(mapped);
        }
      }

      function onMotionChange(reduced: boolean): void {
        engine.setReducedMotion(reduced);
        publish(engine.getSnapshot());
      }

      /** Hidden tabs stop the loop; becoming visible resumes it without a time jump. */
      function onVisibilityChange(isHidden: boolean): void {
        if (!active) {
          return;
        }
        hidden = isHidden;
        if (hidden) {
          if (frameHandle !== null) {
            env.scheduler.cancel(frameHandle);
            frameHandle = null;
          }
          return;
        }
        frameBaselineMs = env.now();
        scheduleFrame();
      }

      function onResize(): void {
        applyViewport();
      }

      // Motion is applied before the first frame so the starting profile is the current one.
      engine.setReducedMotion(env.motion.matches());
      applyViewport();
      target.addEventListener('pointerdown', onPointerDown);
      target.addEventListener('pointerup', onPointerUp);
      target.addEventListener('pointercancel', onPointerCancel);
      env.keyTarget.addEventListener('keydown', onKeyDown);
      unsubscribers.push(env.motion.subscribe(onMotionChange));
      unsubscribers.push(env.visibility.subscribe(onVisibilityChange));
      unsubscribers.push(env.resize.subscribe(onResize));

      // The transport shares the attach lifecycle: the session subscribes first, then
      // connects, and teardown removes the handlers before closing the socket.
      let unsubscribeTransportMessage: (() => void) | null = null;
      let unsubscribeTransportStatus: (() => void) | null = null;
      if (transport !== undefined) {
        unsubscribeTransportMessage = transport.onMessage(handleServerMessage);
        unsubscribeTransportStatus = transport.onStatus(handleStatus);
        transport.connect();
      }

      scheduleFrame();

      teardown = (): void => {
        if (frameHandle !== null) {
          env.scheduler.cancel(frameHandle);
          frameHandle = null;
        }
        target.removeEventListener('pointerdown', onPointerDown);
        target.removeEventListener('pointerup', onPointerUp);
        target.removeEventListener('pointercancel', onPointerCancel);
        env.keyTarget.removeEventListener('keydown', onKeyDown);
        for (const unsubscribe of unsubscribers.splice(0)) {
          unsubscribe();
        }
        unsubscribeTransportMessage?.();
        unsubscribeTransportStatus?.();
        transport?.close();
        if (activeScene === view) {
          activeScene = null;
        }
        if (activeEnv === env) {
          activeEnv = null;
        }
        welcomed = false;
        completionLevel = null;
        pendingAutoReturn = false;
        spectate.reset();
        engine.setSpectating?.(false);
        publishMultiplayer();
        adapter.dispose();
        view.dispose();
      };
    },

    dispose(): void {
      if (!active) {
        return;
      }
      active = false;
      teardown?.();
      teardown = null;
    },

    getSnapshot(): EngineSnapshot {
      return engine.getSnapshot();
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    getMultiplayerSnapshot,

    subscribeMultiplayer(listener: () => void): () => void {
      multiplayerListeners.add(listener);
      return () => {
        multiplayerListeners.delete(listener);
      };
    },

    spectateMember,

    returnToOwnCube,

    retryConnection,
  };
}
