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
 * 3. the motion / visibility / resize / orientation sources → live motion switching, loop
 *    pause and viewport refresh (resize trailing-debounced, orientation immediate).
 *
 * **Multiplayer (T13).** An optional {@link Transport} turns the session into the
 * composition root of the online protocol: it is the only owner of the transport
 * lifecycle (connect on attach, close on dispose, subscriptions removed on teardown) and
 * the only writer of server authority into the engine:
 *
 * - every message is reduced into the pure `server-state` world; the remote-cube subset is
 *   forwarded to the scene;
 * - the per-server activity feed is presentation state owned by the world reducer:
 *   `welcome`/`worldEntered` seed it (the mover's target ring travels in `pendingWorldSwap`)
 *   and `activityEvent` frames only update the store, so the session has no engine/scene
 *   action for them. The session owns the client-side display lifetime on top of it: every
 *   world reduction and the travel-midpoint swap run `observe → synchronous prune →
 *   publish`, and one 250 ms interval is the fallback for time passing without a
 *   reduction (presence-and-activity-liveness AC-15…AC-18);
 * - a non-bfcache `pagehide` while welcomed and connected sends the additive, self-only
 *   `leave` so the server finalizes presence immediately; the send is exception-safe (a
 *   CLOSING/CLOSED socket may throw) and `dispose()` never sends it (AC-7);
 * - the per-server leaderboard is presentation state owned by the same reducer:
 *   `welcome`/`worldEntered` carry the snapshot (the target ranking travels in
 *   `pendingWorldSwap`) and `leaderboardUpdate` frames only update the store, so the
 *   session has no engine/scene action for them either;
 * - the engine holds its intro at progress 0 until `welcome`, then the intro clock starts
 *   and the scene enters the server world at the own slot position (AC-23);
 * - own-cube play stays optimistic: a successful `explodeMiniCube` is forwarded as
 *   `explode { id, level }`; the server's `miniCubeRemoved`/`miniCubesRemoved` ack is a
 *   no-op when the local board already matches (every id of a batch is reconciled in
 *   acceptance order), and `stateSync`/`welcome` adopt the authoritative cube exactly in
 *   both directions (restored and removed tiles, level/grid/style) — stats are never rolled
 *   back (AC-14);
 * - clearing the sixth face sends `cubeCompleted { level }` and the engine (created in
 *   online mode) holds the level travel until the server's `levelAdvanced`/`worldEntered`
 *   data releases it; `worldEntered` also queues the scene's midpoint world swap and the
 *   session applies the reducer's world swap at the level midpoint (AC-12);
 * - spectate flights are camera-only engine travels: selection → `travelTo (spectate,
 *   destination)` → arrival → `setSpectating(true)`; return / target left → `travelTo
 *   (return, own position)` → arrival → `setSpectating(false)` (AC-18, AC-19);
 * - the opener-only `lootboxOpened` grant is adopted into the engine for the 3D reveal; a
 *   `welcome` (fresh join or resume) and every non-`connected` transport status clear it
 *   through `engine.clearLootboxGrant`, and the status path publishes the engine snapshot
 *   before the status store so the cleared grant is observable (AC-11);
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
 * **three.js surface.** The only references to three.js here are type-only (`Scene`,
 * `PerspectiveCamera`, `SceneViewOptions`, `SceneView`, `CubeView`, `HoverPick`); the
 * scene construction and picking functions themselves arrive through
 * {@link SessionEnvironment.renderRuntime}. Production resolves the environment through a
 * dynamic `import('../browser-env')`, so `session.ts` and its render boundary stay out of
 * the auth/menu entry graph (frontend-delivery-hardening).
 *
 * **Runtime loading.** `attach` with an injected environment starts synchronously (the
 * accepted attach contract, status `ready`). Without one, the status becomes `loading`,
 * the loader resolves the environment once, and the start body runs on resolve (`ready`)
 * or the status becomes `error` on reject (the UI offers a retry `attach`). The loader
 * runs *before* the start body and never advances the engine: the frame baseline is set
 * at the runtime start, so the loader's elapsed time is skipped and the intro still
 * begins at progress 0 (the accepted gate-close timing is preserved). An attach-generation
 * token makes a `dispose()` during loading cancel the pending start, and an attach while
 * loading/active idempotent.
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
import {
  ACTIVITY_EXPIRY_TICK_MS,
  createActivityLifetime,
  type ActivityFeedSlice,
} from '../multiplayer/activity-lifetime';
import { ACTIVITY_EVENT_TTL_MS, memberAppearanceOf } from '../multiplayer/protocol';
import type { ClientMessage, CubeState, ServerMessage } from '../multiplayer/protocol';
import {
  applyWorldSwap,
  createWorldState,
  pruneActivity,
  reduceWorldState,
  type WorldState,
} from '../multiplayer/server-state';
import { createSpectateController, type SpectateStatus } from '../multiplayer/spectate';
import type { Transport, TransportStatus } from '../multiplayer/transport';
import type { CubeView } from '../render/cube-view';
import type { HoverPick } from '../render/picking';
import { QUALITY_PIXEL_RATIO_CAPS } from '../render/quality';
import type { QualityTier } from '../render/quality';
import type { SceneView, SceneViewOptions } from '../render/scene';
import type { PerfStats } from '../perf/overlay';
import { createEngine, type EngineSnapshot, type GameEngine, type GameEvent } from './engine';
import { normalizeAppearanceV3 } from './parts-v3';
import { isValidUpgradeId, upgradeCost, upgradeLevel } from './upgrades';
import { CUBE_STYLES } from './progression';
import { frontFace } from './rotation';
import type { Board, CubeStyle, FaceId, LootboxGrant, MiniCubeId } from './types';

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

/**
 * Page-lifecycle reader: fires when the page is hidden away (`pagehide`) with the bfcache
 * flag. `persisted === true` means the page is entering the back/forward cache and may
 * return with the same socket, so it is never a deliberate close.
 */
export interface PageLifecycleSource {
  /** Subscribes to `pagehide`; the callback receives `event.persisted === true`. */
  subscribe(cb: (persisted: boolean) => void): () => void;
}

/** Surface-size reader: fires whenever the element's box changes. */
export interface ResizeSource {
  subscribe(cb: () => void): () => void;
}

/** Orientation reader: fires whenever the window/device orientation changes. */
export interface OrientationSource {
  subscribe(cb: () => void): () => void;
}

/** The narrow renderer surface the session drives (three's `WebGLRenderer` fits it). */
export interface RendererAdapter {
  setSize(width: number, height: number): void;
  setPixelRatio(ratio: number): void;
  /** Applies the tier's GPU budget (composer passes, shadow pass); idempotent per tier. */
  setQuality(tier: QualityTier): void;
  render(scene: Scene, camera: PerspectiveCamera): void;
  /**
   * The renderer's per-frame draw stats (`renderer.info.render`). Optional so existing
   * adapters keep type-checking; the session reports zeroes when it is absent.
   */
  stats?(): { calls: number; triangles: number };
  dispose(): void;
}

/**
 * The Three-touching functions the session drives, injected through
 * {@link SessionEnvironment}.
 *
 * The session refers to scene construction and picking only through this runtime, so
 * `session.ts` never statically imports the render modules. In production the whole
 * environment (and with it `browser-env → render/scene`/`render/picking`) arrives through
 * a dynamic import behind the auth gate; tests inject the real functions directly.
 */
export interface RenderRuntime {
  createSceneView(options: SceneViewOptions): SceneView;
  pickHoverTarget(
    camera: PerspectiveCamera,
    cubeView: CubeView,
    frontFaceId: FaceId,
    ndcX: number,
    ndcY: number,
  ): HoverPick;
  pickMiniCube(
    camera: PerspectiveCamera,
    cubeView: CubeView,
    frontFaceId: FaceId,
    ndcX: number,
    ndcY: number,
  ): MiniCubeId | null;
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
  /**
   * Orientation changes. Optional so existing custom environments keep type-checking;
   * the browser environment always provides it.
   */
  orientation?: OrientationSource;
  /**
   * The page-lifecycle source (`pagehide` + `persisted`). Optional so custom environments
   * keep type-checking; the browser environment always provides it. Without it the session
   * never sends the deliberate-close `leave` (AC-7), which is the safe degradation.
   */
  pageLifecycle?: PageLifecycleSource;
  rendererFactory: (canvas: CanvasLike) => RendererAdapter;
  now(): number;
  random(): number;
  devicePixelRatio(): number;
  /** The scene/picking functions (type-only surface in this module). */
  renderRuntime: RenderRuntime;
}

/**
 * The lifecycle of the runtime environment an attach cycle needs.
 *
 * `idle` before the first attach (and after a dispose), `loading` while the environment
 * loader is pending, `ready` once the start body has run, `error` when the loader
 * rejected. Only the `loading`/`error` states are observable additions for the UI; the
 * accepted synchronous attach path reports `ready` immediately.
 */
export type RuntimeStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * The production environment loader: the dynamic import keeps `browser-env` (and with it
 * `render/scene`, `render/picking` and three.js) out of the entry chunk. It is the default
 * of {@link GameSessionOptions.loadEnvironment}.
 */
function loadBrowserEnvironment(canvas: CanvasLike): Promise<SessionEnvironment> {
  return import('../browser-env').then(({ browserEnvironment }) => browserEnvironment(canvas));
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
  /** Forwards a pointer target (clamped NDC) to the live scene; no-op while detached. */
  setPointerTarget(ndcX: number, ndcY: number): void;
  /**
   * The current runtime-environment status.
   *
   * Optional in the shared UI contract for source compatibility with existing session
   * fakes; {@link createGameSession} always implements it.
   */
  getRuntimeStatus?(): RuntimeStatus;
  /**
   * Subscribes to runtime-status changes; the returned function unsubscribes.
   *
   * Optional in the shared UI contract for source compatibility with existing session
   * fakes; {@link createGameSession} always implements it.
   */
  subscribeRuntime?(listener: () => void): () => void;
  /**
   * The latest completed frame's stats (frame time, quality tier and the renderer
   * adapter's draw calls/triangles), or `null` before the first frame and after dispose.
   *
   * Optional in the shared UI contract for source compatibility with existing session
   * fakes; {@link createGameSession} always implements it. The dev overlay is the only
   * reader, and `App` gates the call on `VITE_PERF_OVERLAY`.
   */
  getPerfStats?(): PerfStats | null;
  /**
   * Measures one WebSocket round trip with the additive diagnostic `ping`/`pong` pair.
   *
   * Resolves the elapsed milliseconds on the matching `pong`, or `null` when the
   * transport is not connected, the 2000 ms timeout elapses, the transport leaves
   * `connected`, or the session is disposed. Flag-agnostic: the overlay gate lives in
   * `App` (AC-19/AC-22).
   */
  measureRtt?(): Promise<number | null>;
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
  /** Session-owned mode from the last successful `join(mode)` (default `'guest'`). */
  mode?: 'guest' | 'account';
  /**
   * True while an account `openLootbox` is in flight (AC-29): set when the account message
   * is sent and cleared by `lootboxOpened`, `customizationUpdate`, `error`, a transport
   * status change or `welcome`. Guest opens are synchronous and never set it.
   */
  pendingLootboxOpen?: boolean;
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
  /** Deferred join entry point: chooses guest/account mode (no-op offline). */
  join(mode: 'guest' | 'account'): void;
  /** Spends coins on an upgrade (account: sends a message; guest: local debit). */
  purchaseUpgrade(upgradeId: string): void;
  /** Opens a lootbox (account: sends a message; guest: local open). */
  openLootbox(): void;
  /** Equips an owned part (account: sends a message; guest: local equip). */
  equipPart(partId: string): void;
  /**
   * Unequips one slot (account: sends a message; guest: local unequip).
   *
   * Optional in the shared UI contract for source compatibility with pre-v2 session fakes
   * (owned by other tasks); {@link createGameSession} always implements it.
   */
  unequipPart?(slotId: string): void;
  /**
   * Clears the reveal metadata (AC-32); the panel's dismiss action.
   *
   * Optional in the shared UI contract for source compatibility with pre-v2 session fakes
   * (owned by other tasks); {@link createGameSession} always implements it.
   */
  dismissLootboxReveal?(): void;
}

/** Construction options; the environment, the engine and the transport are all injectable. */
export interface GameSessionOptions {
  /**
   * A synchronously available environment. When present, `attach` starts the runtime
   * immediately (the accepted attach contract); when omitted, `attach` loads the
   * environment through {@link GameSessionOptions.loadEnvironment} and reports
   * `loading`/`ready`/`error` through {@link GameSession.getRuntimeStatus}.
   */
  env?: SessionEnvironment;
  engine?: GameEngine;
  /**
   * The multiplayer transport. Omitting it keeps the offline behaviour (and the existing
   * session contract): the session never connects, never reads a frame and does not gate
   * input. Supplying it enables the protocol wiring described in the module header.
   */
  transport?: Transport;
  /**
   * Resolves the environment for an async attach. Test seam: production defaults to
   * `import('../browser-env').then(({ browserEnvironment }) => browserEnvironment(canvas))`.
   */
  loadEnvironment?: (canvas: CanvasLike) => Promise<SessionEnvironment>;
}

/**
 * Trailing debounce for container resizes (AC-8): one 60 Hz frame. The attach-time apply
 * and orientation changes stay synchronous.
 */
const RESIZE_DEBOUNCE_MS = 16;

/**
 * Diagnostic ping timeout: an unanswered `pong` resolves `null` after exactly this many
 * milliseconds (AC-22). The overlay polls once per second, so a timed-out measurement is
 * replaced by the next one.
 */
export const RTT_TIMEOUT_MS = 2000;

/** One in-flight RTT measurement, matched by the echoed `t` and settled exactly once. */
interface PendingRtt {
  t: number;
  sentAtMs: number;
  timer: ReturnType<typeof setTimeout> | null;
  resolve(value: number | null): void;
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
 * True when two appearance records carry exactly the same slot→part mapping. Both sides
 * reach this helper normalized (catalog order), but the per-entry comparison keeps the
 * decision independent of key order.
 */
function sameAppearanceRecord(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) {
    return false;
  }
  return keys.every((key) => b[key] === a[key]);
}

/**
 * Creates one game session. Nothing is attached until {@link GameSession.attach} is
 * called; the engine (injected or created here) exists from this point on, so
 * `getSnapshot`/`subscribe` are safe to use before the first attach.
 */
export function createGameSession(options: GameSessionOptions = {}): OnlineGameSession {
  const providedEnv = options.env;
  const transport = options.transport;
  /** The environment loader: the production dynamic import unless a test injects one. */
  const loadEnvironment = options.loadEnvironment ?? loadBrowserEnvironment;
  /** Online only when a transport was injected: no transport keeps the offline defaults. */
  const online = transport !== undefined;
  /** Only an engine created here may be replaced to adopt the server's level-0 cube. */
  const ownsEngine = options.engine === undefined;
  let engine: GameEngine =
    options.engine ?? (online ? createEngine({ online: true }) : createEngine());

  const spectate = createSpectateController();
  /** The server-authoritative world, reduced from every received frame. */
  let world = createWorldState();
  /**
   * The client-side activity display lifetime (AC-15…AC-18): first-seen deadlines and
   * tombstones for the current and pending feeds. Anchored on local receipt, never on the
   * server's `at` (the event clock may be skewed).
   */
  const activityLifetime = createActivityLifetime({ ttlMs: ACTIVITY_EVENT_TTL_MS });
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
  /**
   * The normalized appearance the server is known to hold for this guest (AC-13 b): the
   * roster record after a `welcome` and every accepted `setAppearance`. A local change only
   * reports when this record actually differs.
   */
  let lastSentAppearance: Record<string, string> = {};
  /**
   * The member to mount after the arrival frame applies its `playing` snapshot: the scene
   * refuses a mount while its retained snapshot still says `travel`, so the call waits until
   * after `applySnapshot` (AC-15).
   */
  let pendingSpectatedMount: string | null = null;

  /** Throttle state for outbound `rotate` messages (50 ms coalescing window). */
  let lastBroadcastOrientation: { yawSteps: number; pitchSteps: number } | null = null;
  let lastSendMs = 0;
  let pendingOrientation: { yawSteps: number; pitchSteps: number } | null = null;
  let rotateTimer: ReturnType<typeof setTimeout> | null = null;
  /** The attach cycle's fallback activity-expiry interval (`null` while not scheduled). */
  let activityExpiryTimer: ReturnType<typeof setInterval> | null = null;
  /** The scene of the live attach cycle; `null` while detached. */
  let activeScene: SceneView | null = null;
  /** The environment of the live attach cycle (the owned engine's replacement random). */
  let activeEnv: SessionEnvironment | null = null;
  /** The latest completed frame's stats; `null` before the first frame and after dispose. */
  let latestPerf: PerfStats | null = null;
  /** Every in-flight RTT measurement, settled by pong/timeout/status change/dispose. */
  const pendingRtt: PendingRtt[] = [];

  /** True between a successful `attach` and its `dispose`. */
  let active = false;
  /** Releases everything the current attach cycle created; `null` while detached. */
  let teardown: (() => void) | null = null;
  /** The runtime-environment status the UI observes (`idle` → `loading` → `ready`/`error`). */
  let runtimeStatus: RuntimeStatus = 'idle';
  /** The runtime-status listeners (the UI's `useSyncExternalStore` source). */
  const runtimeListeners = new Set<() => void>();
  /**
   * Attach-cycle generation: bumped by every `attach` and every `dispose`. A loader
   * resolution may start the runtime only when its cycle is still the current one, so a
   * dispose (or a remount's new attach) during loading can never start a stale cycle.
   */
  let attachGeneration = 0;
  const unsubscribers: Array<() => void> = [];
  const listeners = new Set<() => void>();
  /** The snapshot the listeners were last told about (identity = "nothing changed"). */
  let publishedSnapshot: EngineSnapshot | null = null;

  const multiplayerListeners = new Set<() => void>();
  /** The last built multiplayer object; reused while status/world/spectate/mode are unchanged. */
  let multiplayerCache: MultiplayerSnapshot | null = null;
  /** Session-owned mode from the last successful `join(mode)` (default `'guest'`). */
  let joinedMode: 'guest' | 'account' = 'guest';
  /** True while an account open is awaiting its server answer (AC-29). */
  let pendingLootboxOpen = false;
  /** The client-owned reveal sequence for account grants (the server never sends one). */
  let lootboxSequence = 0;
  /** The multiplayer object the listeners were last told about. */
  let publishedMultiplayer: MultiplayerSnapshot;

  /** The pointer NDC retained for the next hover pick (preallocated, AC-35). */
  const hoverNdc = { x: 0, y: 0 };
  /** True when a pointer move arrived since the last frame's hover pick. */
  let hoverPickPending = false;
  /** The currently displayed target-lock id, so an unchanged hover skips the scene call. */
  let hoveredId: MiniCubeId | null = null;

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

  /** Applies a runtime-status transition and notifies the UI when it changed. */
  function setRuntimeStatus(next: RuntimeStatus): void {
    if (runtimeStatus === next) {
      return;
    }
    runtimeStatus = next;
    for (const listener of runtimeListeners) {
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
      cached.spectate !== currentSpectate ||
      cached.mode !== joinedMode ||
      cached.pendingLootboxOpen !== pendingLootboxOpen
        ? { status, world, spectate: currentSpectate, mode: joinedMode, pendingLootboxOpen }
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

  /** Wall-clock read from the active (or provided) environment. */
  function currentNow(): number {
    const env = activeEnv ?? providedEnv;
    if (env === undefined || env === null) {
      return 0;
    }
    return env.now();
  }

  /** The current feed plus, while a cross-server move travels, the pending target feed. */
  function activityFeeds(state: WorldState): ActivityFeedSlice[] {
    const feeds: ActivityFeedSlice[] = [{ serverId: state.serverId, events: state.activity }];
    if (state.pendingWorldSwap !== null) {
      feeds.push({
        serverId: state.pendingWorldSwap.serverId,
        events: state.pendingWorldSwap.activity,
      });
    }
    return feeds;
  }

  /**
   * The pinned order after every world change (AC-15…AC-18): observe the current and
   * pending feeds with the local clock — recording a first-seen deadline only for keys not
   * seen before — then remove expired events synchronously, before any handler-specific or
   * final publish. A tombstoned/expired seed therefore never enters the published feed, not
   * even for one tick. Returns the same `WorldState` reference when nothing expired.
   */
  function pruneWorldActivity(state: WorldState, nowMs: number): WorldState {
    activityLifetime.observe(activityFeeds(state), nowMs);
    return pruneActivity(state, (serverId, eventId) =>
      activityLifetime.isExpired(serverId, eventId, nowMs),
    );
  }

  /**
   * The fallback for time passing without a reduction (AC-18): prune both feeds at the
   * current local time and publish only when a line actually expired. An empty feed (or a
   * no-op prune) performs no publish.
   */
  function pruneExpiredActivity(): void {
    const pruned = pruneWorldActivity(world, currentNow());
    if (pruned === world) {
      return;
    }
    world = pruned;
    publishMultiplayer();
  }

  /**
   * The deliberate-close signal (AC-7): a non-bfcache `pagehide` while welcomed and
   * connected sends the additive, self-only `leave`. Best-effort during unload — the frame
   * rides the live socket, and a CLOSING/CLOSED `WebSocket.send` throws — so the send is
   * guarded: a failed leave must not throw out of the unload handler or skip the remaining
   * teardown, and no other frame is sent. `dispose()` never sends `leave` (a StrictMode
   * remount is not a deliberate close), and neither do bfcache, tab switches, a dropped
   * socket or a disposed session.
   */
  function onPageHide(persisted: boolean): void {
    if (persisted || !active || !welcomed || status !== 'connected' || transport === undefined) {
      return;
    }
    try {
      transport.send({ type: 'leave' });
    } catch {
      // Best-effort unload: the frame is discarded; no other frame is sent.
      return;
    }
  }

  /** Settles one measurement exactly once: clears its timer and removes it from the list. */
  function settlePendingRtt(pending: PendingRtt, value: number | null): void {
    const index = pendingRtt.indexOf(pending);
    if (index === -1) {
      return;
    }
    pendingRtt.splice(index, 1);
    if (pending.timer !== null) {
      clearTimeout(pending.timer);
      pending.timer = null;
    }
    pending.resolve(value);
  }

  /** Resolves every in-flight measurement with `null` (disconnect / dispose / teardown). */
  function clearPendingRtt(): void {
    for (const pending of [...pendingRtt]) {
      settlePendingRtt(pending, null);
    }
  }

  /** Resolves the measurement whose echoed `t` matches; an unknown echo is ignored. */
  function resolvePendingRtt(t: number): void {
    const pending = pendingRtt.find((candidate) => candidate.t === t);
    if (pending === undefined) {
      return;
    }
    settlePendingRtt(pending, Math.max(0, currentNow() - pending.sentAtMs));
  }

  /**
   * One diagnostic round trip (AC-22): sends `{ type: 'ping', t }` only while the
   * transport is connected and resolves on the matching `pong`. The session never gates
   * this on the overlay flag — `App` owns that gate.
   */
  function measureRtt(): Promise<number | null> {
    if (transport === undefined || status !== 'connected') {
      return Promise.resolve(null);
    }
    const t = Math.round(currentNow());
    return new Promise<number | null>((resolve) => {
      const pending: PendingRtt = { t, sentAtMs: currentNow(), timer: null, resolve };
      pending.timer = setTimeout(() => {
        settlePendingRtt(pending, null);
      }, RTT_TIMEOUT_MS);
      pendingRtt.push(pending);
      transport.send({ type: 'ping', t });
    });
  }

  /** The latest frame stats; `null` before the first frame and after dispose (AC-21). */
  function getPerfStats(): PerfStats | null {
    return latestPerf;
  }

  function clearRotateTimer(): void {
    if (rotateTimer !== null) {
      clearTimeout(rotateTimer);
      rotateTimer = null;
    }
  }

  function sendRotateNow(orientation: { yawSteps: number; pitchSteps: number }): void {
    if (transport === undefined) {
      return;
    }
    transport.send({ type: 'rotate', yawSteps: orientation.yawSteps, pitchSteps: orientation.pitchSteps });
    lastBroadcastOrientation = { yawSteps: orientation.yawSteps, pitchSteps: orientation.pitchSteps };
    lastSendMs = currentNow();
    pendingOrientation = null;
    clearRotateTimer();
  }

  function flushPendingRotate(): void {
    if (pendingOrientation === null) {
      return;
    }
    if (lastBroadcastOrientation !== null &&
        lastBroadcastOrientation.yawSteps === pendingOrientation.yawSteps &&
        lastBroadcastOrientation.pitchSteps === pendingOrientation.pitchSteps) {
      pendingOrientation = null;
      clearRotateTimer();
      return;
    }
    if (!canRun()) {
      return;
    }
    const po = pendingOrientation;
    pendingOrientation = null;
    sendRotateNow(po);
  }

  function requestRotateSend(orientation: { yawSteps: number; pitchSteps: number }): void {
    if (!online || transport === undefined) {
      return;
    }
    if (lastBroadcastOrientation !== null &&
        lastBroadcastOrientation.yawSteps === orientation.yawSteps &&
        lastBroadcastOrientation.pitchSteps === orientation.pitchSteps) {
      // Only send when the value changed from the last sent.
      return;
    }
    if (!canRun()) {
      // Disconnected: queue the latest value, flush on reconnect.
      pendingOrientation = { yawSteps: orientation.yawSteps, pitchSteps: orientation.pitchSteps };
      return;
    }
    const now = currentNow();
    if (lastBroadcastOrientation === null || now - lastSendMs >= 50) {
      sendRotateNow(orientation);
      return;
    }
    pendingOrientation = { yawSteps: orientation.yawSteps, pitchSteps: orientation.pitchSteps };
    if (rotateTimer === null) {
      const delay = Math.max(0, 50 - (now - lastSendMs));
      rotateTimer = setTimeout(() => {
        rotateTimer = null;
        if (pendingOrientation !== null && canRun()) {
          flushPendingRotate();
        }
      }, delay);
    }
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
        yawSteps: cube.yawSteps,
        pitchSteps: cube.pitchSteps,
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

  /** The engine's current appearance, normalized against the v3 catalog. */
  function normalizedEngineAppearance(): Record<string, string> {
    return normalizeAppearanceV3(engine.getSnapshot().customization?.appearance ?? {});
  }

  /**
   * Reports one guest appearance (AC-13 b): never for an account, never while the game
   * cannot run, and never for a record the server already holds.
   */
  function sendGuestAppearance(appearance: Record<string, string>): void {
    if (joinedMode === 'account' || transport === undefined || !canRun()) {
      return;
    }
    const normalized = normalizeAppearanceV3(appearance);
    if (sameAppearanceRecord(lastSentAppearance, normalized)) {
      return;
    }
    transport.send({ type: 'setAppearance', appearance: { ...normalized } });
    lastSentAppearance = { ...normalized };
  }

  /**
   * `welcome` guest convergence (AC-13 b): adopt the roster self record into the engine
   * when the local record is empty (so the own ship, preview and hangar show the stored
   * loadout), then report the local record exactly once that `welcome` when it is non-empty
   * and differs from the roster self entry. Accounts never report: the hub owns their state
   * and answers through `customizationUpdate`.
   */
  function convergeGuestAppearance(message: Extract<ServerMessage, { type: 'welcome' }>): void {
    if (joinedMode === 'account' || message.identity.kind === 'account') {
      return;
    }
    const selfEntry = message.roster.find((entry) => entry.playerId === message.playerId);
    const rosterSelf =
      selfEntry === undefined ? {} : normalizeAppearanceV3(memberAppearanceOf(selfEntry));
    // The roster entry is what the server is known to hold after this welcome, so the
    // report decision is made against it (not against an earlier connection's send).
    lastSentAppearance = { ...rosterSelf };
    let effective = normalizedEngineAppearance();
    if (Object.keys(effective).length === 0) {
      // The server's stored loadout wins for a guest whose own record is empty.
      engine.adoptAppearance?.(rosterSelf);
      effective = { ...rosterSelf };
    }
    if (Object.keys(effective).length > 0 && !sameAppearanceRecord(effective, rosterSelf)) {
      sendGuestAppearance(effective);
    }
    // Equal (or both empty): the server already holds this record; only a later local
    // change may report. `sendGuestAppearance` already recorded the differing one.
  }

  /**
   * Applies the session world's authoritative appearance to the mounted ship when
   * `playerId` is the currently viewed member. The scene's own world copy is built at
   * `welcome` and does not consume `memberAppearance`, so the session re-applies its
   * authoritative projection after a mount or a remote rebuild (no remount; the ship's
   * `applyAppearance` is idempotent).
   */
  function syncSpectatedAppearance(playerId: string): void {
    const status = spectate.get();
    if (status.mode !== 'viewing' || status.target !== playerId) {
      return;
    }
    const member = world.members.find((candidate) => candidate.playerId === playerId);
    if (member === undefined) {
      return;
    }
    activeScene?.setSpectatedAppearance(playerId, memberAppearanceOf(member));
  }

  /**
   * `memberAppearance` (AC-15/AC-17): the reducer has already stored the projection; the
   * mounted ship is re-skinned in place only when the updated member is the one currently
   * spectated (never a remount, and never for the own/unknown member).
   */
  function handleMemberAppearance(
    message: Extract<ServerMessage, { type: 'memberAppearance' }>,
  ): void {
    syncSpectatedAppearance(message.playerId);
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
    }
    // Every welcome (join or resume, any identity) clears the spectate state and the view
    // resets to the own cube instantly (AC-12, AC-14). The remote ship is released through
    // the explicit lifecycle call even when `enterWorld` below also disposes the old world.
    spectate.reset();
    engine.setSpectating?.(false);
    pendingSpectatedMount = null;
    activeScene?.setSpectatedMember(null);
    reconcileCube(message.self);
    if (message.economy !== undefined && engine.adoptEconomy !== undefined) {
      engine.adoptEconomy(message.economy);
    }
    if (message.upgrades !== undefined && engine.adoptUpgrades !== undefined) {
      engine.adoptUpgrades(message.upgrades);
    }
    const welcomeCustomization = message.customization;
    if (welcomeCustomization !== undefined && engine.adoptCustomization !== undefined) {
      engine.adoptCustomization(welcomeCustomization);
    }
    welcomed = true;
    completionLevel = null;
    pendingLootboxOpen = false;
    // Guest convergence (AC-13 b): adopt the roster self record when the local one is
    // empty, then report the local record once this welcome when it really differs. An
    // account is skipped entirely (the adopted `customization` above is its authority).
    convergeGuestAppearance(message);
    // A welcome is a fresh view of the world, for a join and a resume alike: the one-shot
    // reveal grant never survives it, so a rejoin can never replay a stale animation
    // (AC-11). The `publish` below makes the cleared grant observable to the store.
    engine.clearLootboxGrant?.();
    flushPendingRotate();
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
      // The swap makes the pending feed current: observe → prune before the publish below.
      world = pruneWorldActivity(world, currentNow());
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
    if (message.economy !== undefined && engine.adoptEconomy !== undefined) {
      engine.adoptEconomy(message.economy);
    }
    if (message.upgrades !== undefined && engine.adoptUpgrades !== undefined) {
      engine.adoptUpgrades(message.upgrades);
    }
    const worldEnteredCustomization = message.customization;
    if (worldEnteredCustomization !== undefined && engine.adoptCustomization !== undefined) {
      engine.adoptCustomization(worldEnteredCustomization);
    }
    flushPendingRotate();
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

  /**
   * `miniCubesRemoved` batch ack: reconcile every id of the own board in acceptance order.
   * Remote members are presentation-only here — their board lives in the world reducer and
   * the scene's world view, so this handler does no engine work for them.
   */
  function handleMiniCubesRemoved(
    message: Extract<ServerMessage, { type: 'miniCubesRemoved' }>,
  ): void {
    if (message.playerId !== world.self.playerId) {
      return;
    }
    for (const id of message.ids) {
      applyAuthoritativeRemoval(id);
    }
  }

  /** `stateSync`: the server's full cube replaces the own board exactly (no stat rollback). */
  function handleStateSync(message: Extract<ServerMessage, { type: 'stateSync' }>): void {
    if (message.playerId !== world.self.playerId) {
      return;
    }
    completionLevel = null;
    reconcileCube(message);
    publish(engine.getSnapshot());
    flushPendingRotate();
  }

  /** `economyUpdate`: adopt the server's absolute totals into the engine (no play interruption). */
  function handleEconomyUpdate(message: Extract<ServerMessage, { type: 'economyUpdate' }>): void {
    if (engine.adoptEconomy !== undefined) {
      engine.adoptEconomy({
        coins: message.coins,
        clicks: message.clicks,
        facesDestroyed: message.facesDestroyed,
        cubesDestroyed: message.cubesDestroyed,
      });
    }
    publish(engine.getSnapshot());
  }

  /** `upgradesUpdate`: replace the engine's upgrade levels with the carried absolute map. */
  function handleUpgradesUpdate(message: Extract<ServerMessage, { type: 'upgradesUpdate' }>): void {
    if (engine.adoptUpgrades !== undefined) {
      engine.adoptUpgrades(message.upgrades);
    }
    publish(engine.getSnapshot());
  }

  /** `customizationUpdate`: replace the engine's customization state with the carried absolute state. */
  function handleCustomizationUpdate(message: Extract<ServerMessage, { type: 'customizationUpdate' }>): void {
    if (engine.adoptCustomization !== undefined) {
      engine.adoptCustomization({
        lootboxes: message.lootboxes,
        keys: message.keys,
        parts: message.parts,
        appearance: message.appearance,
      });
    }
    // Any authoritative customization answer ends an in-flight account open (AC-29).
    pendingLootboxOpen = false;
    publish(engine.getSnapshot());
    publishMultiplayer();
  }

  /**
   * `lootboxOpened`: adopt the opener-only grant and its absolute state (AC-24/AC-32).
   * Only this connection receives the message, so only this tab plays the reveal; the
   * account-wide `customizationUpdate` follows without replacing the grant.
   */
  function handleLootboxOpened(message: Extract<ServerMessage, { type: 'lootboxOpened' }>): void {
    if (engine.adoptCustomization !== undefined) {
      engine.adoptCustomization({
        lootboxes: message.lootboxes,
        keys: message.keys,
        parts: message.parts,
        appearance: message.appearance,
      });
    }
    if (engine.adoptLootboxGrant !== undefined) {
      lootboxSequence += 1;
      const grant: LootboxGrant = {
        partId: message.partId,
        slot: message.slot,
        rarity: message.rarity,
        duplicate: message.duplicate,
        sequence: lootboxSequence,
      };
      engine.adoptLootboxGrant(grant);
    }
    pendingLootboxOpen = false;
    publish(engine.getSnapshot());
  }

  /** A member left: the spectated/travelled target triggers the flight home (AC-19 a/b). */
  function handleMemberLeft(playerId: string): void {
    const mode = spectate.get().mode;
    if (!spectate.onMemberLeft(playerId)) {
      return;
    }
    // The viewed member is gone: release the mounted ship immediately (AC-15); the scene
    // may already have dropped it from its own world, so `null` stays a no-op there.
    pendingSpectatedMount = null;
    activeScene?.setSpectatedMember(null);
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
    if (message.type === 'pong') {
      // Diagnostic echo: connection-local, never reduced into the world or the scene (AC-22).
      resolvePendingRtt(message.t);
      return;
    }
    const previousSelfId = world.self.playerId;
    world = reduceWorldState(world, message);
    // Pinned order (AC-15…AC-18): reduce → observe → synchronous prune → the switch below
    // and its handler-specific publishes, so a welcome/worldEntered seed is already pruned.
    world = pruneWorldActivity(world, currentNow());
    switch (message.type) {
      case 'welcome':
        handleWelcome(message, previousSelfId);
        break;
      case 'worldEntered':
        handleWorldEntered(message);
        break;
      case 'memberJoined':
        break;
      case 'memberAppearance':
        handleMemberAppearance(message);
        break;
      case 'memberLeft':
        handleMemberLeft(message.playerId);
        break;
      case 'miniCubeRemoved':
        handleMiniCubeRemoved(message);
        break;
      case 'miniCubesRemoved':
        handleMiniCubesRemoved(message);
        break;
      case 'levelAdvanced':
        handleLevelAdvanced(message);
        break;
      case 'stateSync':
        handleStateSync(message);
        break;
      case 'economyUpdate':
        handleEconomyUpdate(message);
        break;
      case 'upgradesUpdate':
        handleUpgradesUpdate(message);
        break;
      case 'customizationUpdate':
        handleCustomizationUpdate(message);
        break;
      case 'lootboxOpened':
        handleLootboxOpened(message);
        break;
      case 'activityEvent':
        // The world reducer owns the feed; there is no engine/scene action, and the
        // `publishMultiplayer()` below notifies the store when the feed changed.
        break;
      case 'leaderboardUpdate':
        // The world reducer owns the ranking; there is no engine/scene action, and the
        // `publishMultiplayer()` below notifies the store when the snapshot changed.
        break;
      case 'error':
        // A rejected account open ends its in-flight state; the panel re-enables the button.
        pendingLootboxOpen = false;
        break;
      default:
        // `hello` (transport handshake) carries no world/engine action here.
        break;
    }
    activeScene?.applyWorldMessage(message);
    if (message.type === 'levelAdvanced') {
      // A remote rebuild re-skins from the scene's roster copy, which does not consume
      // `memberAppearance`; re-apply the session's live projection after it (AC-15/AC-17).
      syncSpectatedAppearance(message.playerId);
    }
    publishMultiplayer();
  }

  /** Transport status: leaving `connected` closes the input/clock gate until `welcome`. */
  function handleStatus(next: TransportStatus): void {
    status = next;
    // A status change never keeps a remote ship from the previous world (AC-15): the ship
    // is cleared on every transition (an idempotent no-op when none is mounted) and only a
    // spectate arrival mounts one again.
    pendingSpectatedMount = null;
    activeScene?.setSpectatedMember(null);
    if (next !== 'connected') {
      welcomed = false;
      // A dropped socket can never deliver the pong: settle every in-flight measurement.
      clearPendingRtt();
      // A broken transport ends the reveal: the grant is cleared and the engine snapshot is
      // published before the status publish so `App` observes the clear and unmounts the
      // reveal (AC-11). The clear sends no message and leaves `pendingLootboxOpen` to the
      // existing status rule below.
      engine.clearLootboxGrant?.();
      publish(engine.getSnapshot());
    }
    // A transport status change abandons any in-flight account open (AC-29).
    pendingLootboxOpen = false;
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
    const orientationChanged =
      before.orientation.yawSteps !== after.orientation.yawSteps ||
      before.orientation.pitchSteps !== after.orientation.pitchSteps;
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
    if (orientationChanged) {
      requestRotateSend(after.orientation);
    }
    publish(after);
  }

  /** Marks a finished camera-only flight: spectate lands in view mode, return lands home. */
  function handleTravelArrival(before: EngineSnapshot, after: EngineSnapshot): void {
    if (before.phase !== 'travel' || after.phase !== 'playing') {
      return;
    }
    const status = spectate.get();
    if (before.travelKind === 'spectate' && status.mode === 'traveling') {
      spectate.arrive();
      engine.setSpectating?.(true);
      // The scene refuses a mount while its retained snapshot still says `travel`; the
      // frame loop calls `setSpectatedMember` right after `applySnapshot` applies this
      // `playing` snapshot (AC-15).
      pendingSpectatedMount = status.target;
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
    // The ship is only ever the spectated member's; the return flight starts from view mode,
    // so the mounted ship is released immediately (AC-15).
    pendingSpectatedMount = null;
    activeScene?.setSpectatedMember(null);
    return true;
  }

  /** The banner's `Retry`: a fresh connection cycle with the pinned `connecting` status. */
  function retryConnection(): void {
    if (transport === undefined) {
      return;
    }
    status = 'connecting';
    welcomed = false;
    // The retry closes the socket: a pending measurement can no longer receive its pong.
    clearPendingRtt();
    // A reconnect cycle never keeps a remote ship from the previous world (AC-15).
    pendingSpectatedMount = null;
    activeScene?.setSpectatedMember(null);
    publishMultiplayer();
    if (!active) {
      // Detached (pre-attach login): the attach-time `connect()` opens the socket with the
      // current session cookie, and the attach-time subscriptions cannot miss `welcome`.
      return;
    }
    transport.close();
    transport.connect();
  }

  function join(mode: 'guest' | 'account'): void {
    joinedMode = mode;
    transport?.join(mode);
    publishMultiplayer();
  }

  function purchaseUpgrade(upgradeId: string): void {
    if (!online || transport === undefined) {
      return;
    }
    if (joinedMode === 'account') {
      transport.send({ type: 'purchaseUpgrade', upgradeId });
      return;
    }
    // Guest path (Q-5 default): validate against the mirrored catalog/cost using the
    // engine snapshot, then adopt the debited coins + incremented level locally.
    if (!isValidUpgradeId(upgradeId)) {
      return;
    }
    const snapshotBefore = engine.getSnapshot();
    const upgrades = snapshotBefore.upgrades ?? {};
    const currentLevel = upgradeLevel(upgrades, upgradeId);
    const cost = upgradeCost(upgradeId, currentLevel);
    if (!Number.isFinite(cost)) {
      return;
    }
    const coins = snapshotBefore.stats.coins ?? 0;
    if (coins < cost) {
      return;
    }
    const stats = snapshotBefore.stats;
    engine.adoptEconomy?.({
      coins: coins - cost,
      clicks: stats.clicks,
      facesDestroyed: stats.facesDestroyed,
      cubesDestroyed: stats.cubesDestroyed ?? 0,
    });
    const nextUpgrades: Record<string, number> = { ...upgrades };
    nextUpgrades[upgradeId] = currentLevel + 1;
    engine.adoptUpgrades?.(nextUpgrades);
    publish(engine.getSnapshot());
  }

  function openLootbox(): void {
    if (!online || transport === undefined) {
      return;
    }
    if (joinedMode === 'account') {
      transport.send({ type: 'openLootbox' });
      // The account open is asynchronous: the button stays disabled until the server
      // answers with `lootboxOpened`/`customizationUpdate`, an error or a status change.
      pendingLootboxOpen = true;
      publishMultiplayer();
      return;
    }
    // Guest opens are synchronous and never pending (AC-27/AC-29).
    engine.openLootbox?.();
    publish(engine.getSnapshot());
  }

  function equipPart(partId: string): void {
    if (!online || transport === undefined) {
      return;
    }
    if (joinedMode === 'account') {
      transport.send({ type: 'equipPart', partId });
      return;
    }
    const before = normalizedEngineAppearance();
    engine.equipPart?.(partId);
    const after = normalizedEngineAppearance();
    publish(engine.getSnapshot());
    if (!sameAppearanceRecord(before, after)) {
      // One report per accepted local change; an unowned/unknown id leaves the record
      // unchanged and therefore sends nothing (AC-13 b).
      sendGuestAppearance(after);
    }
  }

  function unequipPart(slotId: string): void {
    if (!online || transport === undefined) {
      return;
    }
    if (joinedMode === 'account') {
      transport.send({ type: 'unequipPart', slotId });
      return;
    }
    const before = normalizedEngineAppearance();
    engine.unequipPart?.(slotId);
    const after = normalizedEngineAppearance();
    publish(engine.getSnapshot());
    if (!sameAppearanceRecord(before, after)) {
      sendGuestAppearance(after);
    }
  }

  function dismissLootboxReveal(): void {
    engine.clearLootboxGrant?.();
    publish(engine.getSnapshot());
  }

  function setPointerTarget(ndcX: number, ndcY: number): void {
    activeScene?.setPointerTarget(ndcX, ndcY);
  }

  /**
   * Starts one attach cycle with the resolved environment — the accepted attach body.
   * `attach` calls this synchronously when an environment was provided, or from the
   * loader's resolution for an async attach. The frame baseline is set here, at the
   * runtime start, so the loader's elapsed time is never passed to `engine.advance`.
   */
  function start(target: CanvasLike, env: SessionEnvironment): void {
    // The engine exists from session creation, so pre-attach snapshots run on its
    // deterministic fallback; attach is where the host's randomness arrives. The scene
    // is built at the level's drawn grid size (the engine's own value).
    engine.setRandomSource(env.random);
    const initialSnapshot = engine.getSnapshot();
    const view = env.renderRuntime.createSceneView({
      style: initialSnapshot.style,
      random: env.random,
      gridSize: initialSnapshot.gridSize,
    });
    const adapter: RendererAdapter = env.rendererFactory(target);
    activeScene = view;
    activeEnv = env;

    /** The tier already pushed to the adapter; the first frame adds no call (AC-10). */
    let appliedTier: QualityTier = view.getQualityTier();
    // The adapter must know the starting tier before it receives the first viewport.
    adapter.setQuality(appliedTier);

    let frameHandle: number | null = null;
    /** Frame time the next delta is measured from (a rewind never produces a negative dt). */
    let frameBaselineMs = env.now();
    let hidden = env.visibility.isHidden();
    let press: PressPosition | null = null;

    /** Pending trailing resize apply; `null` when no resize is queued. */
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;

    /** Pushes the container size, the tier-capped pixel ratio and the camera aspect. */
    function applyViewport(): void {
      const rect = target.getBoundingClientRect();
      adapter.setPixelRatio(
        Math.min(env.devicePixelRatio(), QUALITY_PIXEL_RATIO_CAPS[view.getQualityTier()]),
      );
      adapter.setSize(rect.width, rect.height);
      // Before the first layout the box is empty; a 1:1 aspect keeps the projection valid.
      view.camera.aspect = rect.height > 0 ? rect.width / rect.height : 1;
      view.camera.updateProjectionMatrix();
    }

    function clearResizeTimer(): void {
      if (resizeTimer !== null) {
        clearTimeout(resizeTimer);
        resizeTimer = null;
      }
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
      if (pendingOrientation !== null && canRun()) {
        if (currentNow() - lastSendMs >= 50) {
          flushPendingRotate();
        }
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
        // The pending target feed is now the current feed: observe → prune synchronously
        // before this frame's publish (AC-15/AC-18).
        world = pruneWorldActivity(world, currentNow());
      }
      handleTravelArrival(before, after);
      view.applyIntents(engine.drainIntents(), nowMs);
      const snapshot = engine.getSnapshot();
      // Target lock (AC-35): resolve the hovered front-face mini-cube at most once per
      // animation frame; pointer moves only record the latest NDC.
      if (snapshot.phase !== 'playing') {
        hoverPickPending = false;
        if (hoveredId !== null) {
          hoveredId = null;
          view.setHoverTarget(null);
        }
      } else if (hoverPickPending) {
        hoverPickPending = false;
        const pick = env.renderRuntime.pickHoverTarget(
          view.camera,
          view.cubeView,
          frontFace(snapshot.orientation),
          hoverNdc.x,
          hoverNdc.y,
        );
        hoveredId = pick.id;
        // Always pushed: a level rebuild clears the scene's target lock, so an
        // unchanged id string must still be re-applied on the next pointer frame.
        view.setHoverTarget(pick.id);
      }
      view.applySnapshot(snapshot, nowMs);
      if (pendingSpectatedMount !== null) {
        // The arrival's `playing` snapshot is now retained by the scene, so the mount gate
        // no longer sees a camera-only flight: mount the one spectated ship (AC-15).
        const target = pendingSpectatedMount;
        pendingSpectatedMount = null;
        activeScene?.setSpectatedMember(target);
        // The scene mounted from its roster copy; re-apply the session's authoritative live
        // projection so a `memberAppearance` received during the flight is honoured (AC-15).
        syncSpectatedAppearance(target);
      }
      view.update(dtMs);
      const tier = view.getQualityTier();
      if (tier !== appliedTier) {
        // The policy changed this frame: rebuild the GPU budget and re-cap the DPR
        // before the frame renders (AC-10).
        appliedTier = tier;
        adapter.setQuality(tier);
        applyViewport();
      }
      adapter.render(view.scene, view.camera);
      // The frame is complete: record what this frame cost for the dev overlay (AC-21).
      const frameStats = adapter.stats?.();
      latestPerf = {
        frameMs: dtMs,
        tier,
        drawCalls: frameStats?.calls ?? 0,
        triangles: frameStats?.triangles ?? 0,
      };
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
     * Tracks pointer movement for the spaceship cursor (AC-7) and records the NDC for
     * the frame's hover pick (AC-35). The pointer event itself never raycasts.
     */
    function onPointerMove(event: unknown): void {
      const { clientX, clientY } = event as { clientX: number; clientY: number };
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        return;
      }
      const rawX = (clientX - rect.left) / rect.width * 2 - 1;
      const rawY = 1 - (clientY - rect.top) / rect.height * 2;
      const clamp = (value: number): number => Math.min(1, Math.max(-1, value));
      hoverNdc.x = clamp(rawX);
      hoverNdc.y = clamp(rawY);
      hoverPickPending = true;
      activeScene?.setPointerTarget(hoverNdc.x, hoverNdc.y);
    }

    /** A pointer leaving the canvas hides the reticle immediately (a miss, AC-35). */
    function onPointerLeave(): void {
      hoverPickPending = false;
      if (hoveredId !== null) {
        hoveredId = null;
        activeScene?.setHoverTarget(null);
      }
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
      const id = env.renderRuntime.pickMiniCube(
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
      // A throttled background tab returns with lines past their deadline: prune immediately
      // (before the next frame) so it never renders stale activity (AC-18).
      pruneExpiredActivity();
      frameBaselineMs = env.now();
      scheduleFrame();
    }

    /** Trailing resize: coalesces a burst of box changes into one viewport apply (AC-8). */
    function onResize(): void {
      if (!active) {
        return;
      }
      clearResizeTimer();
      resizeTimer = setTimeout(() => {
        resizeTimer = null;
        if (active) {
          applyViewport();
        }
      }, RESIZE_DEBOUNCE_MS);
    }

    /** A rotation lands on the final box: apply now and drop any queued resize (AC-8). */
    function onOrientation(): void {
      if (!active) {
        return;
      }
      clearResizeTimer();
      applyViewport();
    }

    // Motion is applied before the first frame so the starting profile is the current one.
    engine.setReducedMotion(env.motion.matches());
    applyViewport();
    target.addEventListener('pointerdown', onPointerDown);
    target.addEventListener('pointerup', onPointerUp);
    target.addEventListener('pointercancel', onPointerCancel);
    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerleave', onPointerLeave);
    env.keyTarget.addEventListener('keydown', onKeyDown);
    unsubscribers.push(env.motion.subscribe(onMotionChange));
    unsubscribers.push(env.visibility.subscribe(onVisibilityChange));
    unsubscribers.push(env.resize.subscribe(onResize));
    if (env.orientation !== undefined) {
      unsubscribers.push(env.orientation.subscribe(onOrientation));
    }
    if (env.pageLifecycle !== undefined) {
      unsubscribers.push(env.pageLifecycle.subscribe(onPageHide));
    }

    // One fallback expiry interval per attach cycle: world reductions already prune
    // synchronously, so this only covers time passing without a reduction (AC-18). It is
    // only meaningful online, where the world can carry activity feeds at all.
    if (online) {
      activityExpiryTimer = setInterval(pruneExpiredActivity, ACTIVITY_EXPIRY_TICK_MS);
    }

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
      if (activityExpiryTimer !== null) {
        clearInterval(activityExpiryTimer);
        activityExpiryTimer = null;
      }
      clearResizeTimer();
      target.removeEventListener('pointerdown', onPointerDown);
      target.removeEventListener('pointerup', onPointerUp);
      target.removeEventListener('pointercancel', onPointerCancel);
      target.removeEventListener('pointermove', onPointerMove);
      target.removeEventListener('pointerleave', onPointerLeave);
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
      pendingLootboxOpen = false;
      pendingSpectatedMount = null;
      lastSentAppearance = {};
      hoverPickPending = false;
      hoveredId = null;
      clearRotateTimer();
      lastBroadcastOrientation = null;
      pendingOrientation = null;
      lastSendMs = 0;
      latestPerf = null;
      spectate.reset();
      engine.setSpectating?.(false);
      activityLifetime.clear();
      publishMultiplayer();
      adapter.dispose();
      view.dispose();
    };
  }

  return {
    attach(target: CanvasLike): void {
      if (active) {
        return;
      }
      active = true;
      attachGeneration += 1;
      const generation = attachGeneration;
      if (online) {
        // A fresh attach cycle must not run on a previous connection's welcome.
        welcomed = false;
        pendingLootboxOpen = false;
        clearRotateTimer();
        lastBroadcastOrientation = null;
        pendingOrientation = null;
        lastSendMs = 0;
      }
      hoverPickPending = false;
      hoveredId = null;
      hoverNdc.x = 0;
      hoverNdc.y = 0;

      if (providedEnv !== undefined) {
        // The injected environment is synchronously available: the accepted attach body
        // runs before `attach` returns, so the status is `ready` immediately.
        start(target, providedEnv);
        setRuntimeStatus('ready');
        return;
      }

      // Async attach: the loader runs before the start body and never advances the
      // engine, so the intro clock stays anchored at the runtime start (AC-3).
      setRuntimeStatus('loading');
      void loadEnvironment(target).then(
        (env) => {
          if (!active || generation !== attachGeneration) {
            // Disposed (or superseded by a newer attach) while loading: creates nothing.
            return;
          }
          start(target, env);
          setRuntimeStatus('ready');
        },
        () => {
          if (!active || generation !== attachGeneration) {
            return;
          }
          // A rejected load creates no renderer/listener/frame/connection; attach retries.
          active = false;
          setRuntimeStatus('error');
        },
      );
    },

    dispose(): void {
      // A pending measurement can exist while detached (a connected transport before the
      // first attach), so settle it before the early return: no timer may outlive dispose.
      clearPendingRtt();
      latestPerf = null;
      if (!active) {
        return;
      }
      active = false;
      attachGeneration += 1;
      teardown?.();
      teardown = null;
      setRuntimeStatus('idle');
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

    getRuntimeStatus(): RuntimeStatus {
      return runtimeStatus;
    },

    subscribeRuntime(listener: () => void): () => void {
      runtimeListeners.add(listener);
      return () => {
        runtimeListeners.delete(listener);
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
    join,
    purchaseUpgrade,
    openLootbox,
    equipPart,
    unequipPart,
    dismissLootboxReveal,
    setPointerTarget,
    getPerfStats,
    measureRtt,
  };
}
