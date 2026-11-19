import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACTIVITY_EXPIRY_TICK_MS,
} from '../multiplayer/activity-lifetime';
import { leaderboardUpdateMessage, type ActivityEvent, type ClientMessage, type LeaderboardSnapshot, type MemberState, type Position, type ServerMessage } from '../multiplayer/protocol';
import { pickHoverTarget, pickMiniCube } from '../render/picking';
import type { QualityTier } from '../render/quality';
import { createSceneView, type SceneView, type SceneWorld } from '../render/scene';
import { createWorldView, type WorldView } from '../render/world';
import {
  createTransport,
  type Transport,
  type TransportStatus,
} from '../multiplayer/transport';
import { createBoard, removeMiniCube } from './board';
import {
  createEngine,
  type AuthoritativeCubeState,
  type EngineSnapshot,
  type GameEngine,
  type GameEvent,
  type NextLevelData,
} from './engine';
import { REDUCED_TIMINGS } from './effects';
import { CUBE_STYLES } from './progression';
import { createOrientation } from './rotation';
import {
  createGameSession,
  type CanvasLike,
  type GameSession,
  type MotionSource,
  type OnlineGameSession,
  type OrientationSource,
  type PageLifecycleSource,
  type RendererAdapter,
  type ResizeSource,
  type RuntimeStatus,
  type SessionEnvironment,
  type VisibilitySource,
} from './session';
import { FACE_IDS, GRID_SIZE, type EconomyState, type FaceId, type LootboxGrant, type MiniCubeId, type UpgradeState } from './types';

/**
 * The hover pick is wrapped so the coalescing contract is observable from the session
 * boundary: the real raycast still runs, and every call is recorded for the per-frame
 * assertions below.
 */
vi.mock('../render/picking', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../render/picking')>();
  return { ...actual, pickHoverTarget: vi.fn(actual.pickHoverTarget) };
});

const hoverPick = vi.mocked(pickHoverTarget);

/**
 * Integration tier for the session: every test below runs the *real* engine and the
 * *real* three.js scene and fakes a single boundary — the host environment
 * (`SessionEnvironment`). The recording fakes only log what the session did to them
 * (schedules, cancels, listener registrations, renderer calls) or drive callbacks the
 * host would fire, so the assertions stay on observable session behaviour.
 *
 * A second, smaller group injects a recording engine instead: it exists to pin the
 * phase policy and the exact frame deltas, which the real engine deliberately hides.
 */

type Rect = { left: number; top: number; width: number; height: number };

/** One frame callback the session handed the scheduler, in schedule order. */
type FrameCallback = (nowMs: number) => void;

interface FakeCanvas {
  surface: CanvasLike;
  rect: Rect;
  listenerCount(type: string): number;
  emit(type: string, event: unknown): void;
}

interface FakeKeyTarget {
  target: SessionEnvironment['keyTarget'];
  listenerCount(): number;
  emitKey(key: string): void;
}

interface FakeScheduler {
  scheduler: SessionEnvironment['scheduler'];
  schedules(): number;
  cancels(): number[];
  pending(): number;
  last(): FrameCallback | undefined;
  tick(nowMs: number): void;
}

interface FakeMotion {
  source: MotionSource;
  subscribeCount(): number;
  unsubscribeCount(): number;
  emit(reduced: boolean): void;
}

interface FakeVisibility {
  source: VisibilitySource;
  subscribeCount(): number;
  unsubscribeCount(): number;
  callbacks(): Array<(hidden: boolean) => void>;
  emit(hidden: boolean): void;
}

interface FakePageLifecycle {
  source: PageLifecycleSource;
  subscribeCount(): number;
  unsubscribeCount(): number;
  callbacks(): Array<(persisted: boolean) => void>;
  emit(persisted: boolean): void;
}

interface FakeResize {
  source: ResizeSource;
  subscribeCount(): number;
  unsubscribeCount(): number;
  emit(): void;
}

interface FakeOrientation {
  source: OrientationSource;
  subscribeCount(): number;
  unsubscribeCount(): number;
  emit(): void;
}

/** One recorded `render` call — the scene and camera the frame handed the renderer. */
interface RenderCall {
  scene: Scene;
  camera: PerspectiveCamera;
}

interface FakeRendererFactory {
  factory: (canvas: CanvasLike) => RendererAdapter;
  canvases: CanvasLike[];
  /** Viewport calls in arrival order (`setPixelRatio`/`setSize` only). */
  calls: string[];
  /** Every adapter call in arrival order, including `setQuality` and `render`. */
  order: string[];
  qualities: QualityTier[];
  sizes: Array<[number, number]>;
  ratios: number[];
  renders: RenderCall[];
  disposals(): number;
}

interface FakeEngine {
  engine: GameEngine;
  events: GameEvent[];
  advancements: number[];
  motionCalls: boolean[];
  randomSources: Array<() => number>;
  nextLevels: NextLevelData[];
  cubeAdoptions: AuthoritativeCubeState[];
  economyAdoptions: EconomyState[];
  upgradeAdoptions: UpgradeState[];
  spectatingCalls: boolean[];
  clearGrants(): number;
  setSnapshot(snapshot: EngineSnapshot): void;
}

interface FakeEnv {
  env: SessionEnvironment;
  canvas: FakeCanvas;
  keys: FakeKeyTarget;
  scheduler: FakeScheduler;
  motion: FakeMotion;
  visibility: FakeVisibility;
  pageLifecycle: FakePageLifecycle;
  resize: FakeResize;
  orientation: FakeOrientation;
  renderer: FakeRendererFactory;
  clock: { now: number };
}

/** A deterministic starfield/particle seed (the scene layout is irrelevant to the wiring). */
const fixedRandom = (): number => 0.5;

function createFakeCanvas(rect: Rect): FakeCanvas {
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  const surface: CanvasLike = {
    addEventListener(type, handler) {
      const handlers = listeners.get(type) ?? [];
      handlers.push(handler);
      listeners.set(type, handlers);
    },
    removeEventListener(type, handler) {
      const handlers = listeners.get(type) ?? [];
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
      listeners.set(type, handlers);
    },
    getBoundingClientRect: () => ({ ...rect }),
    width: 0,
    height: 0,
  };
  const emit = (type: string, event: unknown): void => {
    for (const handler of [...(listeners.get(type) ?? [])]) {
      handler(event);
    }
  };
  return {
    surface,
    rect,
    listenerCount: (type) => listeners.get(type)?.length ?? 0,
    emit,
  };
}

function createFakeKeyTarget(): FakeKeyTarget {
  const listeners = new Set<(event: unknown) => void>();
  return {
    target: {
      addEventListener(_type, handler) {
        listeners.add(handler);
      },
      removeEventListener(_type, handler) {
        listeners.delete(handler);
      },
    },
    listenerCount: () => listeners.size,
    emitKey(key: string) {
      for (const listener of [...listeners]) {
        listener({ key });
      }
    },
  };
}

function createFakeScheduler(): FakeScheduler {
  const pending = new Map<number, FrameCallback>();
  const scheduled: FrameCallback[] = [];
  const cancels: number[] = [];
  let handle = 0;
  return {
    scheduler: {
      schedule(cb) {
        handle += 1;
        pending.set(handle, cb);
        scheduled.push(cb);
        return handle;
      },
      cancel(handle) {
        cancels.push(handle);
        pending.delete(handle);
      },
    },
    schedules: () => scheduled.length,
    cancels: () => cancels,
    pending: () => pending.size,
    last: () => scheduled.at(-1),
    tick(nowMs) {
      const due = [...pending.entries()];
      pending.clear();
      for (const [, cb] of due) {
        cb(nowMs);
      }
    },
  };
}

function createFakeMotion(initial: boolean): FakeMotion {
  const callbacks = new Set<(reduced: boolean) => void>();
  let value = initial;
  let subscribes = 0;
  let unsubscribes = 0;
  return {
    source: {
      matches: () => value,
      subscribe(cb) {
        subscribes += 1;
        callbacks.add(cb);
        return () => {
          unsubscribes += 1;
          callbacks.delete(cb);
        };
      },
    },
    subscribeCount: () => subscribes,
    unsubscribeCount: () => unsubscribes,
    emit(reduced) {
      value = reduced;
      for (const cb of [...callbacks]) {
        cb(reduced);
      }
    },
  };
}

function createFakeVisibility(initial: boolean): FakeVisibility {
  const callbacks = new Set<(hidden: boolean) => void>();
  let value = initial;
  let subscribes = 0;
  let unsubscribes = 0;
  return {
    source: {
      isHidden: () => value,
      subscribe(cb) {
        subscribes += 1;
        callbacks.add(cb);
        return () => {
          unsubscribes += 1;
          callbacks.delete(cb);
        };
      },
    },
    subscribeCount: () => subscribes,
    unsubscribeCount: () => unsubscribes,
    callbacks: () => [...callbacks],
    emit(hidden) {
      value = hidden;
      for (const cb of [...callbacks]) {
        cb(hidden);
      }
    },
  };
}

function createFakePageLifecycle(): FakePageLifecycle {
  const callbacks = new Set<(persisted: boolean) => void>();
  let subscribes = 0;
  let unsubscribes = 0;
  return {
    source: {
      subscribe(cb) {
        subscribes += 1;
        callbacks.add(cb);
        return () => {
          unsubscribes += 1;
          callbacks.delete(cb);
        };
      },
    },
    subscribeCount: () => subscribes,
    unsubscribeCount: () => unsubscribes,
    callbacks: () => [...callbacks],
    emit(persisted) {
      for (const cb of [...callbacks]) {
        cb(persisted);
      }
    },
  };
}

function createFakeResize(): FakeResize {
  const callbacks = new Set<() => void>();
  let subscribes = 0;
  let unsubscribes = 0;
  return {
    source: {
      subscribe(cb) {
        subscribes += 1;
        callbacks.add(cb);
        return () => {
          unsubscribes += 1;
          callbacks.delete(cb);
        };
      },
    },
    subscribeCount: () => subscribes,
    unsubscribeCount: () => unsubscribes,
    emit() {
      for (const cb of [...callbacks]) {
        cb();
      }
    },
  };
}

function createFakeOrientation(): FakeOrientation {
  const callbacks = new Set<() => void>();
  let subscribes = 0;
  let unsubscribes = 0;
  return {
    source: {
      subscribe(cb) {
        subscribes += 1;
        callbacks.add(cb);
        return () => {
          unsubscribes += 1;
          callbacks.delete(cb);
        };
      },
    },
    subscribeCount: () => subscribes,
    unsubscribeCount: () => unsubscribes,
    emit() {
      for (const cb of [...callbacks]) {
        cb();
      }
    },
  };
}

function createFakeRendererFactory(
  stats?: { calls: number; triangles: number },
): FakeRendererFactory {
  const canvases: CanvasLike[] = [];
  const calls: string[] = [];
  const order: string[] = [];
  const qualities: QualityTier[] = [];
  const sizes: Array<[number, number]> = [];
  const ratios: number[] = [];
  const renders: RenderCall[] = [];
  let disposals = 0;
  return {
    factory: (canvas) => {
      canvases.push(canvas);
      return {
        setSize(width, height) {
          sizes.push([width, height]);
          calls.push(`setSize:${width}:${height}`);
          order.push(`setSize:${width}:${height}`);
        },
        setPixelRatio(ratio) {
          ratios.push(ratio);
          calls.push(`setPixelRatio:${ratio}`);
          order.push(`setPixelRatio:${ratio}`);
        },
        setQuality(tier) {
          qualities.push(tier);
          order.push(`setQuality:${tier}`);
        },
        render(scene, camera) {
          renders.push({ scene, camera });
          order.push('render');
        },
        ...(stats === undefined
          ? {}
          : {
              stats: () => ({ calls: stats.calls, triangles: stats.triangles }),
            }),
        dispose() {
          disposals += 1;
          order.push('dispose');
        },
      };
    },
    canvases,
    calls,
    order,
    qualities,
    sizes,
    ratios,
    renders,
    disposals: () => disposals,
  };
}

function createFakeEnv(
  options: {
    rect?: Rect;
    dpr?: number;
    reducedMotion?: boolean;
    hidden?: boolean;
    random?: () => number;
    stats?: { calls: number; triangles: number };
  } = {},
): FakeEnv {
  const canvas = createFakeCanvas(options.rect ?? { left: 0, top: 0, width: 800, height: 800 });
  const keys = createFakeKeyTarget();
  const scheduler = createFakeScheduler();
  const motion = createFakeMotion(options.reducedMotion ?? false);
  const visibility = createFakeVisibility(options.hidden ?? false);
  const pageLifecycle = createFakePageLifecycle();
  const resize = createFakeResize();
  const orientation = createFakeOrientation();
  const renderer = createFakeRendererFactory(options.stats);
  const clock = { now: 0 };
  return {
    env: {
      canvas: canvas.surface,
      keyTarget: keys.target,
      scheduler: scheduler.scheduler,
      motion: motion.source,
      visibility: visibility.source,
      pageLifecycle: pageLifecycle.source,
      resize: resize.source,
      orientation: orientation.source,
      rendererFactory: renderer.factory,
      now: () => clock.now,
      random: options.random ?? fixedRandom,
      devicePixelRatio: () => options.dpr ?? 1,
      // The real Three-touching runtime: the session reaches scene/picking only through
      // the injected environment. `pickHoverTarget` is the module mock above so the
      // per-frame coalescing assertions stay observable.
      renderRuntime: {
        createSceneView,
        pickHoverTarget,
        pickMiniCube,
      },
    },
    canvas,
    keys,
    scheduler,
    motion,
    visibility,
    pageLifecycle,
    resize,
    orientation,
    renderer,
    clock,
  };
}

/** A recording engine: it logs every call and exposes a replaceable snapshot. */
function createFakeEngine(
  initial: EngineSnapshot,
  options: { mutateExplosions?: boolean } = {},
): FakeEngine {
  const events: GameEvent[] = [];
  const advancements: number[] = [];
  const motionCalls: boolean[] = [];
  const randomSources: Array<() => number> = [];
  const nextLevels: NextLevelData[] = [];
  const cubeAdoptions: AuthoritativeCubeState[] = [];
  const economyAdoptions: EconomyState[] = [];
  const upgradeAdoptions: UpgradeState[] = [];
  const spectatingCalls: boolean[] = [];
  let clearGrantCalls = 0;
  let snapshot = initial;
  return {
    engine: {
      dispatch(event) {
        events.push(event);
        if (options.mutateExplosions === true && event.type === 'explodeMiniCube') {
          const removal = removeMiniCube(snapshot.board, event.id);
          if (removal.removed) {
            snapshot = {
              ...snapshot,
              board: removal.board,
              stats: { ...snapshot.stats, clicks: snapshot.stats.clicks + 1 },
            };
          }
        }
      },
      advance(dtMs) {
        advancements.push(dtMs);
      },
      drainIntents: () => [],
      getSnapshot: () => snapshot,
      setReducedMotion(reduced) {
        motionCalls.push(reduced);
      },
      setRandomSource(source) {
        randomSources.push(source);
      },
      completeNextLevel(data) {
        nextLevels.push(data);
      },
      adoptCubeState(cube) {
        // Recording only: the engine contract is owned by `engine.test.ts`; the session
        // tests here pin *which* exact cube the session hands over.
        cubeAdoptions.push({
          levelIndex: cube.levelIndex,
          gridSize: cube.gridSize,
          style: cube.style,
          removedIds: [...cube.removedIds],
        });
      },
      adoptEconomy(economy) {
        economyAdoptions.push({
          coins: economy.coins,
          clicks: economy.clicks,
          facesDestroyed: economy.facesDestroyed,
          cubesDestroyed: economy.cubesDestroyed,
        });
        snapshot = {
          ...snapshot,
          stats: {
            ...snapshot.stats,
            clicks: economy.clicks,
            facesDestroyed: economy.facesDestroyed,
            cubesDestroyed: economy.cubesDestroyed,
            coins: economy.coins,
          },
        };
      },
      adoptUpgrades(upgrades) {
        upgradeAdoptions.push({ ...upgrades });
        snapshot = {
          ...snapshot,
          upgrades: { ...upgrades },
        };
      },
      setSpectating(active) {
        spectatingCalls.push(active);
      },
      clearLootboxGrant() {
        // Recording only: the engine contract is owned by `engine.test.ts`; the session
        // tests here pin *that* the documented clear seam is used (AC-11).
        clearGrantCalls += 1;
      },
    },
    events,
    advancements,
    motionCalls,
    randomSources,
    nextLevels,
    cubeAdoptions,
    economyAdoptions,
    upgradeAdoptions,
    spectatingCalls,
    clearGrants: () => clearGrantCalls,
    setSnapshot(next) {
      snapshot = next;
    },
  };
}

/** One engine snapshot with the pinned playing defaults; overrides pin the case at hand. */
function snapshot(overrides: Partial<EngineSnapshot> = {}): EngineSnapshot {
  return {
    phase: 'playing',
    phaseProgress: 1,
    stats: { clicks: 0, facesDestroyed: 0 },
    levelIndex: 0,
    style: CUBE_STYLES[0]!,
    orientation: createOrientation(),
    rotationFrom: null,
    rotationProgress: 1,
    board: createBoard(),
    gridSize: GRID_SIZE,
    travelDirection: null,
    reducedMotion: false,
    ...overrides,
  };
}

/** A session over a fake environment and the real engine (seeded random). */
function createRealSession(fake: FakeEnv, engine?: GameEngine): GameSession {
  return createGameSession({ env: fake.env, engine: engine ?? createEngine({ random: fixedRandom }) });
}

function attachSession(fake: FakeEnv, engine?: GameEngine): GameSession {
  const session = createRealSession(fake, engine);
  session.attach(fake.canvas.surface);
  return session;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

/** A promise the test settles explicitly — the injected environment loader. */
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

/** Press and release at one position — a gesture with zero travel, i.e. a tap. */
function tapOn(canvas: FakeCanvas, clientX: number, clientY: number): void {
  canvas.emit('pointerdown', { clientX, clientY });
  canvas.emit('pointerup', { clientX, clientY });
}

/** Press at `from` and release at `to` — the travel decides tap vs drag. */
function dragOn(
  canvas: FakeCanvas,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  canvas.emit('pointerdown', { clientX: from.x, clientY: from.y });
  canvas.emit('pointerup', { clientX: to.x, clientY: to.y });
}

/**
 * A touch tap on the same Pointer Events path as a mouse tap. The session reads only the
 * coordinates, so `pointerType` is carried to prove it never participates in the decision.
 */
function touchTapOn(canvas: FakeCanvas, clientX: number, clientY: number): void {
  const touch = { clientX, clientY, pointerType: 'touch', pointerId: 7, isPrimary: true };
  canvas.emit('pointerdown', touch);
  canvas.emit('pointerup', touch);
}

/** A touch press/drag/release on the same Pointer Events path as a mouse drag. */
function touchDragOn(
  canvas: FakeCanvas,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  canvas.emit('pointerdown', {
    clientX: from.x,
    clientY: from.y,
    pointerType: 'touch',
    pointerId: 7,
    isPrimary: true,
  });
  canvas.emit('pointerup', {
    clientX: to.x,
    clientY: to.y,
    pointerType: 'touch',
    pointerId: 7,
    isPrimary: true,
  });
}

/** The ids still present on one face of the snapshot's board, in board order. */
function faceIds(current: EngineSnapshot, faceId: FaceId): MiniCubeId[] {
  const face = current.board.faces.find((candidate) => candidate.id === faceId);
  if (face === undefined) {
    throw new Error(`the board has no face ${faceId}`);
  }
  return face.miniCubes.map((miniCube) => miniCube.id);
}

/** The cube group of a rendered scene: the group holding the instanced face grids. */
function cubeGroup(scene: Scene): Group {
  const group = scene.children.find(
    (child): child is Group =>
      child instanceof Group && child.children.some((candidate) => candidate instanceof InstancedMesh),
  );
  if (group === undefined) {
    throw new Error('the rendered scene has no cube group');
  }
  return group;
}

/** The body mesh — the cube group's first child (`cube-view.ts`). */
function cubeBody(scene: Scene): Mesh {
  const body = cubeGroup(scene).children[0];
  if (!(body instanceof Mesh)) {
    throw new Error('the cube group has no body mesh');
  }
  return body;
}

/** One face's instanced grid, addressed through the pinned `FACE_IDS` order. */
function faceMesh(scene: Scene, faceId: FaceId): InstancedMesh {
  const meshes = cubeGroup(scene).children.filter(
    (child): child is InstancedMesh => child instanceof InstancedMesh,
  );
  const mesh = meshes[FACE_IDS.indexOf(faceId)];
  if (mesh === undefined) {
    throw new Error(`the scene has no instance mesh for ${faceId}`);
  }
  return mesh;
}

function instanceMatrix(mesh: InstancedMesh, index: number): Matrix4 {
  const matrix = new Matrix4();
  mesh.getMatrixAt(index, matrix);
  return matrix;
}

/** Skips the intro through the wired pointer path and leaves the engine playing. */
function skipIntro(fake: FakeEnv, session: GameSession, rect: Rect): void {
  tapOn(fake.canvas, rect.left + rect.width / 2, rect.top + rect.height / 2);
  if (session.getSnapshot().phase !== 'playing') {
    throw new Error('the intro tap did not reach the engine');
  }
}

/** Clears every mini-cube of every face of one level, directly on the engine. */
function clearLevel(engine: GameEngine, gridSize: number): void {
  for (const faceId of FACE_IDS) {
    for (let row = 0; row < gridSize; row += 1) {
      for (let col = 0; col < gridSize; col += 1) {
        engine.dispatch({ type: 'explodeMiniCube', id: `${faceId}:${row}:${col}` });
      }
    }
  }
}

/** Runs `frames` scheduled frames of `deltaMs` each on the attach-time baseline. */
function tickFrames(fake: FakeEnv, frames: number, deltaMs: number): void {
  for (let index = 0; index < frames; index += 1) {
    fake.clock.now += deltaMs;
    fake.scheduler.tick(fake.clock.now);
  }
}

/** The multiplayer wire the session is wired to: records sends and replays frames/status. */
interface FakeTransport {
  transport: Transport;
  sent: ClientMessage[];
  /** Transport lifecycle/subscription calls in arrival order. */
  events: string[];
  connectCount(): number;
  closeCount(): number;
  messageHandlerCount(): number;
  statusHandlerCount(): number;
  joinCalls(): Array<'guest' | 'account'>;
  emit(message: ServerMessage): void;
  emitStatus(status: TransportStatus): void;
}

function createFakeTransport(options: { throwOnSend?: boolean } = {}): FakeTransport {
  const messageHandlers = new Set<(message: ServerMessage) => void>();
  const statusHandlers = new Set<(status: TransportStatus) => void>();
  const sent: ClientMessage[] = [];
  const events: string[] = [];
  const joinCallsList: Array<'guest' | 'account'> = [];
  let connects = 0;
  let closes = 0;
  let currentStatus: TransportStatus | null = null;
  const publishStatus = (status: TransportStatus): void => {
    currentStatus = status;
    for (const handler of [...statusHandlers]) {
      handler(status);
    }
  };
  return {
    transport: {
      connect() {
        connects += 1;
        events.push('connect');
        publishStatus('connecting');
      },
      close() {
        closes += 1;
        events.push('close');
      },
      join(mode) {
        joinCallsList.push(mode);
        events.push(`join:${mode}`);
      },
      send(message) {
        sent.push(message);
        if (options.throwOnSend === true) {
          // A socket in CLOSING/CLOSED throws from `WebSocket.send` (AC-7 fake-socket case).
          throw new Error('socket is closing');
        }
      },
      onMessage(handler) {
        events.push('onMessage');
        messageHandlers.add(handler);
        return () => {
          messageHandlers.delete(handler);
        };
      },
      onStatus(handler) {
        events.push('onStatus');
        statusHandlers.add(handler);
        if (currentStatus !== null) {
          handler(currentStatus);
        }
        return () => {
          statusHandlers.delete(handler);
        };
      },
    },
    sent,
    events,
    connectCount: () => connects,
    closeCount: () => closes,
    messageHandlerCount: () => messageHandlers.size,
    statusHandlerCount: () => statusHandlers.size,
    joinCalls: () => [...joinCallsList],
    emit(message) {
      for (const handler of [...messageHandlers]) {
        handler(message);
      }
    },
    emitStatus: publishStatus,
  };
}

type WelcomeMessage = Extract<ServerMessage, { type: 'welcome' }>;
type WorldEnteredMessage = Extract<ServerMessage, { type: 'worldEntered' }>;
type LevelAdvancedMessage = Extract<ServerMessage, { type: 'levelAdvanced' }>;
type StateSyncMessage = Extract<ServerMessage, { type: 'stateSync' }>;

/** One roster member with the pinned defaults; overrides pin the case at hand. */
function member(overrides: Partial<MemberState> = {}): MemberState {
  return {
    playerId: 'p2',
    name: 'Player 2',
    position: { x: 24, y: 0 },
    levelIndex: 0,
    gridSize: 5,
    styleId: CUBE_STYLES[0]!.id,
    removedIds: [],
    yawSteps: 0,
    pitchSteps: 0,
    ...overrides,
  };
}

/** The own member as the server includes it in the welcome roster. */
function selfMember(overrides: Partial<MemberState> = {}): MemberState {
  return member({ playerId: 'p1', name: 'Player 1', position: { x: 0, y: 0 }, ...overrides });
}

/** A `welcome` frame with the pinned defaults; the roster defaults to the own member only. */
function welcomeMessage(options: {
  playerId?: string;
  name?: string;
  position?: Position;
  levelIndex?: number;
  gridSize?: number;
  styleId?: string;
  removedIds?: string[];
  yawSteps?: number;
  pitchSteps?: number;
  roster?: MemberState[];
  serverId?: number;
  maxUsers?: number;
  activity?: ActivityEvent[];
  leaderboard?: LeaderboardSnapshot;
  economy?: { coins: number; clicks: number; facesDestroyed: number; cubesDestroyed: number };
  upgrades?: UpgradeState;
  customization?: { lootboxes: number; keys: number; parts: Record<string, number>; appearance: Record<string, string> };
} = {}): WelcomeMessage {
  const playerId = options.playerId ?? 'p1';
  const name = options.name ?? 'Player 1';
  const position = options.position ?? { x: 0, y: 0 };
  const levelIndex = options.levelIndex ?? 0;
  const gridSize = options.gridSize ?? 5;
  const styleId = options.styleId ?? CUBE_STYLES[0]!.id;
  const removedIds = options.removedIds ?? [];
  return {
    type: 'welcome',
    playerId,
    name,
    token: 'token-1',
    serverId: options.serverId ?? 1,
    maxUsers: options.maxUsers ?? 4,
    position,
    self: { levelIndex, gridSize, styleId, removedIds, yawSteps: options.yawSteps ?? 0, pitchSteps: options.pitchSteps ?? 0 },
    roster:
      options.roster ?? [
        member({ playerId, name, position, levelIndex, gridSize, styleId, removedIds }),
      ],
    identity: { kind: 'guest', playerId },
    ...(options.activity === undefined ? {} : { activity: options.activity }),
    ...(options.leaderboard === undefined ? {} : { leaderboard: options.leaderboard }),
    ...(options.economy === undefined ? {} : { economy: options.economy }),
    ...(options.upgrades === undefined ? {} : { upgrades: options.upgrades }),
    ...(options.customization === undefined ? {} : { customization: options.customization }),
  };
}

/** A `worldEntered` frame for the mover; the roster defaults to the mover only. */
function worldEnteredMessage(options: {
  position?: Position;
  levelIndex?: number;
  gridSize?: number;
  styleId?: string;
  roster?: MemberState[];
  serverId?: number;
  maxUsers?: number;
  activity?: ActivityEvent[];
  leaderboard?: LeaderboardSnapshot;
  economy?: { coins: number; clicks: number; facesDestroyed: number; cubesDestroyed: number };
  upgrades?: UpgradeState;
  customization?: { lootboxes: number; keys: number; parts: Record<string, number>; appearance: Record<string, string> };
} = {}): WorldEnteredMessage {
  const position = options.position ?? { x: 0, y: 24 };
  const levelIndex = options.levelIndex ?? 1;
  const gridSize = options.gridSize ?? 4;
  const styleId = options.styleId ?? CUBE_STYLES[1]!.id;
  return {
    type: 'worldEntered',
    playerId: 'p1',
    name: 'Player 1',
    token: 'token-1',
    serverId: options.serverId ?? 2,
    maxUsers: options.maxUsers ?? 2,
    position,
    self: { levelIndex, gridSize, styleId, removedIds: [], yawSteps: 0, pitchSteps: 0 },
    roster:
      options.roster ?? [
        member({ playerId: 'p1', name: 'Player 1', position, levelIndex, gridSize, styleId }),
      ],
    identity: { kind: 'guest', playerId: 'p1' },
    ...(options.activity === undefined ? {} : { activity: options.activity }),
    ...(options.leaderboard === undefined ? {} : { leaderboard: options.leaderboard }),
    ...(options.economy === undefined ? {} : { economy: options.economy }),
    ...(options.upgrades === undefined ? {} : { upgrades: options.upgrades }),
    ...(options.customization === undefined ? {} : { customization: options.customization }),
  };
}

function levelAdvancedMessage(
  overrides: Partial<LevelAdvancedMessage> = {},
): LevelAdvancedMessage {
  return {
    type: 'levelAdvanced',
    playerId: 'p1',
    levelIndex: 1,
    gridSize: 4,
    styleId: CUBE_STYLES[1]!.id,
    position: { x: 0, y: 0 },
    removedIds: [],
    ...overrides,
  };
}

function stateSyncMessage(overrides: Partial<StateSyncMessage> = {}): StateSyncMessage {
  return {
    type: 'stateSync',
    playerId: 'p1',
    levelIndex: 0,
    gridSize: 5,
    styleId: CUBE_STYLES[0]!.id,
    removedIds: [],
    yawSteps: 0,
    pitchSteps: 0,
    ...overrides,
  };
}

/** A session wired to the fake transport, before any connection or frame. */
function createOnlineSession(
  fake: FakeEnv,
  wire: FakeTransport,
  engine?: GameEngine,
): OnlineGameSession {
  return createGameSession({
    env: fake.env,
    transport: wire.transport,
    ...(engine === undefined ? {} : { engine }),
  });
}

beforeEach(() => {
  hoverPick.mockClear();
});

afterEach(() => {
  // The resize debounce is the only session behaviour that uses host timers; a test that
  // installs fake timers must never leak them into the next one.
  vi.useRealTimers();
});

describe('attach', () => {
  it('sizes the renderer from the container rect and the capped pixel ratio (AC-6, AC-7)', () => {
    vi.useFakeTimers();
    const fake = createFakeEnv({ rect: { left: 0, top: 0, width: 800, height: 600 }, dpr: 3 });
    const session = attachSession(fake);

    // The cap: min(devicePixelRatio, PIXEL_RATIO_CAP) = min(3, 2), applied before the size,
    // with the starting tier pushed before either viewport call (AC-10).
    expect(fake.renderer.canvases).toEqual([fake.canvas.surface]);
    expect(fake.renderer.calls).toEqual(['setPixelRatio:2', 'setSize:800:600']);
    expect(fake.renderer.qualities).toEqual(['high']);
    expect(fake.renderer.order).toEqual(['setQuality:high', 'setPixelRatio:2', 'setSize:800:600']);
    // Attach applies the viewport directly: nothing is queued behind the resize debounce.
    expect(vi.getTimerCount()).toBe(0);
    expect(fake.scheduler.pending()).toBe(1);
    expect(session.getSnapshot().phase).toBe('intro');

    fake.scheduler.tick(0);

    expect(fake.renderer.renders).toHaveLength(1);
    const { scene, camera } = fake.renderer.renders[0]!;
    expect(scene).toBeInstanceOf(Scene);
    // 800 / 600: the container aspect reaches the projection on the first frame.
    expect(camera.aspect).toBe(4 / 3);
    // The first frame applies the intro dolly's opening pose (AC-2).
    expect(camera.position.toArray()).toEqual([0, 0, 60]);
  });

  it('keeps a square projection on an empty rect', () => {
    const fake = createFakeEnv({ rect: { left: 0, top: 0, width: 0, height: 0 } });
    attachSession(fake);

    expect(fake.renderer.sizes).toEqual([[0, 0]]);
    fake.scheduler.tick(0);
    expect(fake.renderer.renders[0]!.camera.aspect).toBe(1);
  });

  it('is idempotent: a second attach adds no listener, frame or renderer', () => {
    const fake = createFakeEnv();
    const session = attachSession(fake);
    session.attach(fake.canvas.surface);

    expect(fake.renderer.canvases).toHaveLength(1);
    expect(fake.scheduler.schedules()).toBe(1);
    expect(fake.canvas.listenerCount('pointerdown')).toBe(1);
    expect(fake.canvas.listenerCount('pointerup')).toBe(1);
    expect(fake.canvas.listenerCount('pointercancel')).toBe(1);
    expect(fake.keys.listenerCount()).toBe(1);
    expect(fake.motion.subscribeCount()).toBe(1);
    expect(fake.visibility.subscribeCount()).toBe(1);
    expect(fake.pageLifecycle.subscribeCount()).toBe(1);
    expect(fake.resize.subscribeCount()).toBe(1);
    expect(fake.orientation.subscribeCount()).toBe(1);
  });

  it('applies a tier change before that frame renders and re-caps the DPR (AC-10)', () => {
    const fake = createFakeEnv({ dpr: 3 });
    attachSession(fake);

    // The first frame has a zero delta; the next 60 accepted frames are 30 ms each, so
    // the pinned 60-sample/60-frame downgrade fires on the 60th real frame.
    fake.scheduler.tick(0);
    tickFrames(fake, 60, 30);

    expect(fake.renderer.qualities).toEqual(['high', 'medium']);
    expect(fake.renderer.order.slice(-4)).toEqual([
      'setQuality:medium',
      'setPixelRatio:1.5',
      'setSize:800:800',
      'render',
    ]);

    const stableFrom = fake.renderer.order.length;
    tickFrames(fake, 3, 30);

    // A stable tier adds no setQuality call and no extra pixel-ratio apply.
    expect(fake.renderer.qualities).toEqual(['high', 'medium']);
    expect(fake.renderer.ratios).toEqual([2, 1.5]);
    expect(fake.renderer.order.slice(stableFrom)).toEqual(['render', 'render', 'render']);

    tickFrames(fake, 57, 30);

    // The medium→low downgrade fires on push 120 and re-caps the DPR to 1.
    expect(fake.renderer.qualities).toEqual(['high', 'medium', 'low']);
    expect(fake.renderer.ratios).toEqual([2, 1.5, 1]);
    expect(fake.renderer.order.slice(-4)).toEqual([
      'setQuality:low',
      'setPixelRatio:1',
      'setSize:800:800',
      'render',
    ]);
  });
});

describe('performance stats (AC-21)', () => {
  it('reports the frame time, the current tier and the adapter stats after one 16 ms frame', () => {
    const fake = createFakeEnv({ stats: { calls: 7, triangles: 700 } });
    const session = attachSession(fake);

    expect(session.getPerfStats?.()).toBeNull();

    fake.scheduler.tick(0);
    fake.scheduler.tick(16);

    expect(session.getPerfStats?.()).toEqual({
      frameMs: 16,
      tier: 'high',
      drawCalls: 7,
      triangles: 700,
    });
  });

  it('reflects the tier change on the frame that applies it', () => {
    const fake = createFakeEnv({ stats: { calls: 3, triangles: 30 }, dpr: 2 });
    const session = attachSession(fake);

    fake.scheduler.tick(0);
    expect(session.getPerfStats?.()).toEqual({
      frameMs: 0,
      tier: 'high',
      drawCalls: 3,
      triangles: 30,
    });

    // 60 accepted 30 ms frames trigger the pinned high→medium downgrade (AC-10/AC-52).
    tickFrames(fake, 60, 30);

    expect(fake.renderer.qualities).toEqual(['high', 'medium']);
    expect(session.getPerfStats?.()).toEqual({
      frameMs: 30,
      tier: 'medium',
      drawCalls: 3,
      triangles: 30,
    });
  });

  it('reports zero draw stats when the adapter exposes no stats()', () => {
    const fake = createFakeEnv();
    const session = attachSession(fake);

    fake.scheduler.tick(0);
    fake.scheduler.tick(16);

    expect(session.getPerfStats?.()).toEqual({
      frameMs: 16,
      tier: 'high',
      drawCalls: 0,
      triangles: 0,
    });
  });

  it('returns null after dispose and stays null until the next frame', () => {
    const fake = createFakeEnv({ stats: { calls: 7, triangles: 700 } });
    const session = attachSession(fake);
    fake.scheduler.tick(0);
    fake.scheduler.tick(16);

    expect(session.getPerfStats?.()).toEqual({
      frameMs: 16,
      tier: 'high',
      drawCalls: 7,
      triangles: 700,
    });

    session.dispose();

    expect(session.getPerfStats?.()).toBeNull();
  });
});

describe('diagnostic WebSocket RTT (AC-22)', () => {
  it('sends exactly one rounded ping and resolves the elapsed milliseconds on the matching pong', async () => {
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');

    fake.clock.now = 1234.6;
    const pending = session.measureRtt!();

    expect(wire.sent).toEqual([{ type: 'ping', t: 1235 }]);

    fake.clock.now = 1258.6;
    wire.emit({ type: 'pong', t: 1235 });

    await expect(pending).resolves.toBe(24);
    expect(wire.sent).toEqual([{ type: 'ping', t: 1235 }]);
  });

  it('ignores a pong whose t does not match the pending ping', async () => {
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');

    fake.clock.now = 500;
    const pending = session.measureRtt!();
    const settled: Array<number | null> = [];
    void pending.then((value) => settled.push(value));

    wire.emit({ type: 'pong', t: 499 });
    await Promise.resolve();
    expect(settled).toEqual([]);

    fake.clock.now = 507;
    wire.emit({ type: 'pong', t: 500 });
    await expect(pending).resolves.toBe(7);
    expect(settled).toEqual([7]);
  });

  it('resolves null after exactly 2000 ms without a pong and sends no second ping', async () => {
    vi.useFakeTimers();
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');

    const pending = session.measureRtt!();
    const settled: Array<number | null> = [];
    void pending.then((value) => settled.push(value));

    await vi.advanceTimersByTimeAsync(1999);
    expect(settled).toEqual([]);

    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toEqual([null]);
    expect(wire.sent).toEqual([{ type: 'ping', t: 0 }]);
  });

  it('resolves null without sending when the transport is not connected', async () => {
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);

    await expect(session.measureRtt!()).resolves.toBeNull();
    expect(wire.sent).toEqual([]);

    const offline = attachSession(createFakeEnv());
    await expect(offline.measureRtt!()).resolves.toBeNull();
  });

  it('resolves every pending measurement with null when the transport leaves connected', async () => {
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');

    const first = session.measureRtt!();
    const second = session.measureRtt!();
    expect(wire.sent).toEqual([
      { type: 'ping', t: 0 },
      { type: 'ping', t: 0 },
    ]);

    wire.emitStatus('disconnected');

    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toBeNull();
  });

  it('dispose clears the pending timer and resolves pending calls with null', async () => {
    vi.useFakeTimers();
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');

    const pending = session.measureRtt!();
    // The RTT timeout plus the attach cycle's activity-expiry fallback interval (AC-18).
    expect(vi.getTimerCount()).toBe(2);

    session.dispose();

    await expect(pending).resolves.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('runtime environment loading (AC-2 session half, AC-3)', () => {
  /** The status a concrete session reports (`createGameSession` always implements it). */
  function statusOf(session: GameSession): RuntimeStatus | undefined {
    return session.getRuntimeStatus?.();
  }

  it('starts synchronously and reports ready for a provided environment (loader unused)', () => {
    const fake = createFakeEnv();
    const loadEnvironment = vi.fn<(canvas: CanvasLike) => Promise<SessionEnvironment>>();
    const session = createGameSession({ env: fake.env, loadEnvironment });
    const statuses: RuntimeStatus[] = [];
    session.subscribeRuntime?.(() => {
      statuses.push(statusOf(session)!);
    });

    expect(statusOf(session)).toBe('idle');

    session.attach(fake.canvas.surface);

    expect(loadEnvironment).not.toHaveBeenCalled();
    expect(statusOf(session)).toBe('ready');
    expect(statuses).toEqual(['ready']);
    expect(fake.renderer.canvases).toEqual([fake.canvas.surface]);
    expect(fake.scheduler.schedules()).toBe(1);
    expect(fake.canvas.listenerCount('pointerdown')).toBe(1);
  });

  it('loads a deferred environment once: loading creates no host effects, then ready starts one cycle', async () => {
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const pending = deferred<SessionEnvironment>();
    const loadEnvironment = vi.fn(() => pending.promise);
    const session = createGameSession({ loadEnvironment, transport: wire.transport });

    session.attach(fake.canvas.surface);

    expect(statusOf(session)).toBe('loading');
    expect(loadEnvironment).toHaveBeenCalledTimes(1);
    expect(loadEnvironment).toHaveBeenCalledWith(fake.canvas.surface);
    expect(fake.renderer.canvases).toEqual([]);
    expect(fake.scheduler.schedules()).toBe(0);
    expect(fake.canvas.listenerCount('pointerdown')).toBe(0);
    expect(fake.keys.listenerCount()).toBe(0);
    expect(fake.motion.subscribeCount()).toBe(0);
    expect(fake.visibility.subscribeCount()).toBe(0);
    expect(fake.resize.subscribeCount()).toBe(0);
    expect(fake.orientation.subscribeCount()).toBe(0);
    expect(wire.events).toEqual([]);
    expect(wire.connectCount()).toBe(0);

    pending.resolve(fake.env);
    await pending.promise;

    expect(statusOf(session)).toBe('ready');
    expect(fake.renderer.canvases).toEqual([fake.canvas.surface]);
    expect(fake.scheduler.pending()).toBe(1);
    expect(fake.canvas.listenerCount('pointerdown')).toBe(1);
    expect(fake.keys.listenerCount()).toBe(1);
    expect(fake.motion.subscribeCount()).toBe(1);
    expect(fake.visibility.subscribeCount()).toBe(1);
    expect(fake.resize.subscribeCount()).toBe(1);
    expect(fake.orientation.subscribeCount()).toBe(1);
    expect(wire.events).toEqual(['onMessage', 'onStatus', 'connect']);
    expect(wire.connectCount()).toBe(1);
  });

  it('cancels a pending load on dispose: the late resolution creates nothing', async () => {
    const fake = createFakeEnv();
    const pending = deferred<SessionEnvironment>();
    const session = createGameSession({ loadEnvironment: () => pending.promise });

    session.attach(fake.canvas.surface);
    expect(statusOf(session)).toBe('loading');

    session.dispose();
    expect(statusOf(session)).toBe('idle');

    pending.resolve(fake.env);
    await pending.promise;

    expect(statusOf(session)).toBe('idle');
    expect(fake.renderer.canvases).toEqual([]);
    expect(fake.scheduler.schedules()).toBe(0);
    expect(fake.canvas.listenerCount('pointerdown')).toBe(0);
    expect(fake.motion.subscribeCount()).toBe(0);
  });

  it('reports error on a rejected load without listeners, frames or connections', async () => {
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const pending = deferred<SessionEnvironment>();
    const session = createGameSession({
      loadEnvironment: () => pending.promise,
      transport: wire.transport,
    });

    session.attach(fake.canvas.surface);
    pending.reject(new Error('runtime chunk failed'));
    await pending.promise.catch(() => undefined);

    expect(statusOf(session)).toBe('error');
    expect(fake.renderer.canvases).toEqual([]);
    expect(fake.scheduler.schedules()).toBe(0);
    expect(fake.canvas.listenerCount('pointerdown')).toBe(0);
    expect(fake.keys.listenerCount()).toBe(0);
    expect(wire.events).toEqual([]);
    expect(wire.connectCount()).toBe(0);
  });

  it('retries after an error with a second loader call and starts exactly one cycle', async () => {
    const fake = createFakeEnv();
    const first = deferred<SessionEnvironment>();
    const second = deferred<SessionEnvironment>();
    const loadEnvironment = vi.fn<(canvas: CanvasLike) => Promise<SessionEnvironment>>();
    loadEnvironment.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const session = createGameSession({ loadEnvironment });

    session.attach(fake.canvas.surface);
    first.reject(new Error('runtime chunk failed'));
    await first.promise.catch(() => undefined);

    expect(statusOf(session)).toBe('error');
    expect(loadEnvironment).toHaveBeenCalledTimes(1);

    session.attach(fake.canvas.surface);

    expect(statusOf(session)).toBe('loading');
    expect(loadEnvironment).toHaveBeenCalledTimes(2);

    second.resolve(fake.env);
    await second.promise;

    expect(statusOf(session)).toBe('ready');
    expect(fake.renderer.canvases).toEqual([fake.canvas.surface]);
    expect(fake.scheduler.schedules()).toBe(1);
    expect(fake.canvas.listenerCount('pointerdown')).toBe(1);
  });

  it('is idempotent while loading: a second attach neither reloads nor starts twice', async () => {
    const fake = createFakeEnv();
    const pending = deferred<SessionEnvironment>();
    const loadEnvironment = vi.fn(() => pending.promise);
    const session = createGameSession({ loadEnvironment });

    session.attach(fake.canvas.surface);
    session.attach(fake.canvas.surface);

    expect(loadEnvironment).toHaveBeenCalledTimes(1);
    expect(statusOf(session)).toBe('loading');

    pending.resolve(fake.env);
    await pending.promise;

    expect(statusOf(session)).toBe('ready');
    expect(fake.renderer.canvases).toEqual([fake.canvas.surface]);
    expect(fake.scheduler.schedules()).toBe(1);
  });

  it('drops a StrictMode-shaped first load: two loader calls, only the second starts', async () => {
    const fake = createFakeEnv();
    const first = deferred<SessionEnvironment>();
    const second = deferred<SessionEnvironment>();
    const loadEnvironment = vi.fn<(canvas: CanvasLike) => Promise<SessionEnvironment>>();
    loadEnvironment.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const session = createGameSession({ loadEnvironment });

    session.attach(fake.canvas.surface); // mount
    session.dispose(); // unmount cancels the first load
    session.attach(fake.canvas.surface); // remount

    expect(loadEnvironment).toHaveBeenCalledTimes(2);
    expect(statusOf(session)).toBe('loading');

    first.resolve(fake.env);
    await first.promise;

    expect(statusOf(session)).toBe('loading');
    expect(fake.renderer.canvases).toEqual([]);
    expect(fake.scheduler.schedules()).toBe(0);

    second.resolve(fake.env);
    await second.promise;

    expect(statusOf(session)).toBe('ready');
    expect(fake.renderer.canvases).toEqual([fake.canvas.surface]);
    expect(fake.scheduler.schedules()).toBe(1);
  });

  it('anchors the intro clock at runtime start, skipping the loader elapsed (16 / introMs)', async () => {
    // Baseline: an immediate (provided) environment whose first frame is 16 ms after attach.
    const immediateFake = createFakeEnv();
    const immediate = createGameSession({ env: immediateFake.env });
    immediate.attach(immediateFake.canvas.surface);
    immediateFake.clock.now = 16;
    immediateFake.scheduler.tick(16);
    expect(immediate.getSnapshot().phaseProgress).toBe(16 / 2500);

    // Deferred: attach at t0, loader resolves at t0 + 500, first frame at t0 + 516.
    const fake = createFakeEnv();
    const pending = deferred<SessionEnvironment>();
    const session = createGameSession({ loadEnvironment: () => pending.promise });
    session.attach(fake.canvas.surface);

    // The loader is pending: the engine is never advanced.
    fake.clock.now = 500;
    expect(session.getSnapshot().phaseProgress).toBe(0);

    pending.resolve(fake.env);
    await pending.promise;

    expect(statusOf(session)).toBe('ready');
    expect(session.getSnapshot().phaseProgress).toBe(0);
    expect(fake.scheduler.pending()).toBe(1);

    fake.clock.now = 516;
    fake.scheduler.tick(516);

    // The frame baseline is the runtime-start clock (500), so dt is 16 — never 516.
    expect(session.getSnapshot().phase).toBe('intro');
    expect(session.getSnapshot().phaseProgress).toBe(16 / 2500);
    expect(session.getSnapshot().phaseProgress).toBe(immediate.getSnapshot().phaseProgress);
  });
});

describe('random and grid wiring (AC-1, AC-3)', () => {
  it('injects the environment random into the engine at attach', () => {
    const recording = createFakeEngine(snapshot());
    const fake = createFakeEnv();
    const session = createGameSession({ env: fake.env, engine: recording.engine });

    session.attach(fake.canvas.surface);

    expect(recording.randomSources).toEqual([fake.env.random]);

    session.dispose();
    session.attach(fake.canvas.surface);

    expect(recording.randomSources).toEqual([fake.env.random, fake.env.random]);
  });

  it('builds the scene at the engine grid size and draws later directions from env.random', () => {
    // The engine is created without a random: the pinned LCG(1) draw 0 = 0.23645552527159452
    // gives level 0 N = 4. The environment source is a constant 0 (⌊0 · 4⌋ = 0 → `left`),
    // whereas the LCG's next draw (0.369…) would pick `right` — so the travel direction
    // proves the attach-time injection and the scene geometry proves the grid pass-through.
    const engine = createEngine();
    const fake = createFakeEnv({ reducedMotion: true, random: () => 0 });
    const session = createGameSession({ env: fake.env, engine });
    session.attach(fake.canvas.surface);
    fake.scheduler.tick(0);

    expect(session.getSnapshot().gridSize).toBe(4);
    const scene = fake.renderer.renders[0]!.scene;
    expect(faceMesh(scene, 'front').count).toBe(16);
    expect(faceMesh(scene, 'right').count).toBe(16);
    // The first tile of the 4×4 front face: ((0 − 1.5) · 1.25, (1.5 − 0) · 1.25, 2.625).
    const firstTile = instanceMatrix(faceMesh(scene, 'front'), 0);
    expect(new Vector3().setFromMatrixPosition(firstTile).toArray()).toEqual([-1.875, 1.875, 2.625]);

    engine.dispatch({ type: 'introSkip' });
    clearLevel(engine, 4);
    engine.advance(REDUCED_TIMINGS.faceFadeMs);

    expect(session.getSnapshot().phase).toBe('travel');
    expect(session.getSnapshot().travelDirection).toBe('left');
  });

  it('exposes the drawn travel direction only while travelling', () => {
    // The default environment source is the constant 0.5: ⌊0.5 · 4⌋ = 2 → `top`.
    const engine = createEngine({ gridSize: 4, reducedMotion: true });
    const fake = createFakeEnv({ reducedMotion: true });
    const session = createGameSession({ env: fake.env, engine });
    session.attach(fake.canvas.surface);
    fake.scheduler.tick(0);

    expect(session.getSnapshot().phase).toBe('intro');
    expect(session.getSnapshot().travelDirection).toBeNull();

    engine.dispatch({ type: 'introSkip' });
    expect(session.getSnapshot().phase).toBe('playing');
    expect(session.getSnapshot().travelDirection).toBeNull();

    clearLevel(engine, 4);
    engine.advance(REDUCED_TIMINGS.faceFadeMs);
    expect(session.getSnapshot().phase).toBe('travel');
    expect(session.getSnapshot().travelDirection).toBe('top');

    engine.advance(REDUCED_TIMINGS.travelMs / 2);
    expect(session.getSnapshot().phase).toBe('travel');
    expect(session.getSnapshot().levelIndex).toBe(1);
    expect(session.getSnapshot().travelDirection).toBe('top');

    engine.advance(REDUCED_TIMINGS.travelMs / 2);
    expect(session.getSnapshot().phase).toBe('playing');
    expect(session.getSnapshot().travelDirection).toBeNull();
  });

  it('keeps the deterministic fallback before attach', () => {
    const session = createGameSession();

    const snapshot = session.getSnapshot();
    expect(snapshot.phase).toBe('intro');
    expect(snapshot.gridSize).toBe(4);
    expect(snapshot.travelDirection).toBeNull();
    expect(snapshot.stats).toEqual({ clicks: 0, facesDestroyed: 0 });
    expect(snapshot.board.faces.map((face) => face.miniCubes.length)).toEqual([
      16, 16, 16, 16, 16, 16,
    ]);
  });
});

describe('pointer wiring', () => {
  it('skips the intro on a tap and ignores an intro drag (AC-2)', () => {
    const fake = createFakeEnv();
    const session = attachSession(fake);
    fake.scheduler.tick(0);

    dragOn(fake.canvas, { x: 100, y: 100 }, { x: 220, y: 100 });

    const afterDrag = session.getSnapshot();
    expect(afterDrag.phase).toBe('intro');
    expect(afterDrag.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(afterDrag.rotationFrom).toBeNull();
    expect(afterDrag.stats.clicks).toBe(0);

    tapOn(fake.canvas, 400, 400);

    expect(session.getSnapshot().phase).toBe('playing');
    expect(session.getSnapshot().stats.clicks).toBe(0);
  });

  it('explodes the front-face mini-cube under a playing tap and drives the scene (AC-5, AC-6)', () => {
    const fake = createFakeEnv();
    const session = attachSession(fake);
    fake.scheduler.tick(0);
    skipIntro(fake, session, fake.canvas.rect);
    fake.scheduler.tick(16);

    // The canvas centre is the centre of the `front` face's `2:2` tile.
    tapOn(fake.canvas, 400, 400);

    const snapshot = session.getSnapshot();
    expect(snapshot.stats.clicks).toBe(1);
    expect(faceIds(snapshot, 'front')).toHaveLength(24);
    expect(faceIds(snapshot, 'front')).not.toContain('front:2:2');
    expect(faceIds(snapshot, 'front')).toContain('front:0:0');

    const mesh = faceMesh(fake.renderer.renders.at(-1)!.scene, 'front');

    fake.scheduler.tick(32);

    // The shot is in flight: the tile is not yet hidden (AC-4 deferred).
    const stillVisible = instanceMatrix(mesh, 12);
    expect(stillVisible.elements[0]).toBe(Math.fround(0.95));
    expect(new Vector3().setFromMatrixPosition(stillVisible).toArray()).toEqual([0, 0, 2.625]);

    fake.scheduler.tick(400);

    // When the shot lands the deferred explosion starts the 140 ms destroy: the tile is
    // already unclickable (the snapshot dropped it) but flashes at full extent, brightness
    // 3, on the arrival frame (AC-7).
    const flashing = instanceMatrix(mesh, 12);
    expect([flashing.elements[0], flashing.elements[5], flashing.elements[10]]).toEqual([
      Math.fround(0.95),
      Math.fround(0.95),
      0.25,
    ]);
    expect(new Vector3().setFromMatrixPosition(flashing).toArray()).toEqual([0, 0, 2.625]);
    expect(mesh.instanceColor?.getX(12)).toBe(3);

    // +70 ms: the pinned mid-collapse extent.
    fake.scheduler.tick(470);
    const collapsing = instanceMatrix(mesh, 12);
    expect([collapsing.elements[0], collapsing.elements[5], collapsing.elements[10]]).toEqual([
      0.4154876172542572,
      0.4154876172542572,
      0.10933884233236313,
    ]);

    // +140 ms: fully zero-scaled, colour back to the idle multiplier (AC-4/AC-7).
    fake.scheduler.tick(540);
    const hidden = instanceMatrix(mesh, 12);
    expect([hidden.elements[0], hidden.elements[5], hidden.elements[10]]).toEqual([0, 0, 0]);
    expect(new Vector3().setFromMatrixPosition(hidden).toArray()).toEqual([0, 0, 2.625]);
    expect(mesh.instanceColor?.getX(12)).toBe(1);
  });

  it('ignores a playing tap that misses the cube', () => {
    const fake = createFakeEnv();
    const session = attachSession(fake);
    fake.scheduler.tick(0);
    skipIntro(fake, session, fake.canvas.rect);
    fake.scheduler.tick(16);

    // ndc (-0.8, 0.8): outside the front face's silhouette.
    tapOn(fake.canvas, 80, 80);

    expect(session.getSnapshot().stats.clicks).toBe(0);
    expect(faceIds(session.getSnapshot(), 'front')).toHaveLength(25);
  });

  it('re-reads the live front face and cube view on every tap (AC-6)', () => {
    const fake = createFakeEnv();
    const session = attachSession(fake);
    fake.scheduler.tick(0);
    skipIntro(fake, session, fake.canvas.rect);
    fake.scheduler.tick(16);

    // A quarter turn about +Y: the front face is `left` from now on.
    fake.keys.emitKey('ArrowRight');
    expect(session.getSnapshot().orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });

    // No frame in between: the cube is still drawn unrotated, so the tap lands where the
    // previous front face is — and not on the current front face, which is invisible.
    tapOn(fake.canvas, 400, 400);
    expect(session.getSnapshot().stats.clicks).toBe(0);
    expect(faceIds(session.getSnapshot(), 'front')).toHaveLength(25);

    fake.scheduler.tick(316);

    // Once the step is drawn, the same tap resolves against the new front face's handle.
    tapOn(fake.canvas, 400, 400);
    expect(session.getSnapshot().stats.clicks).toBe(1);
    expect(faceIds(session.getSnapshot(), 'left')).toHaveLength(24);
    expect(faceIds(session.getSnapshot(), 'left')).not.toContain('left:2:2');
    expect(faceIds(session.getSnapshot(), 'front')).toHaveLength(25);
  });

  it('maps taps and drags to the events each phase allows (injected engine, drags do nothing)', () => {
    const recording = createFakeEngine(snapshot({ phase: 'intro' }));
    const fake = createFakeEnv();
    const session = createGameSession({ env: fake.env, engine: recording.engine });
    session.attach(fake.canvas.surface);
    fake.scheduler.tick(0);

    dragOn(fake.canvas, { x: 100, y: 100 }, { x: 220, y: 100 });
    expect(recording.events).toEqual([]);

    tapOn(fake.canvas, 400, 400);
    expect(recording.events).toEqual([{ type: 'introSkip' }]);

    recording.setSnapshot(snapshot({ phase: 'travel' }));
    tapOn(fake.canvas, 400, 400);
    dragOn(fake.canvas, { x: 100, y: 100 }, { x: 100, y: 220 });
    // The same travel gate applies to touch pointers (AC-11): no dispatch at all.
    touchTapOn(fake.canvas, 400, 400);
    touchDragOn(fake.canvas, { x: 100, y: 100 }, { x: 100, y: 220 });
    fake.keys.emitKey('ArrowRight');
    expect(recording.events).toEqual([{ type: 'introSkip' }]);

    recording.setSnapshot(snapshot({ phase: 'playing' }));
    tapOn(fake.canvas, 400, 400);
    expect(recording.events).toEqual([
      { type: 'introSkip' },
      { type: 'explodeMiniCube', id: 'front:2:2' },
    ]);

    // Playing drags dispatch nothing at all — no rotation on either axis (AC-2).
    dragOn(fake.canvas, { x: 100, y: 100 }, { x: 220, y: 100 });
    dragOn(fake.canvas, { x: 100, y: 100 }, { x: 100, y: 220 });
    expect(recording.events).toEqual([
      { type: 'introSkip' },
      { type: 'explodeMiniCube', id: 'front:2:2' },
    ]);
  });

  it('ignores a playing drag: no rotation, no click, no publish (AC-2)', () => {
    const fake = createFakeEnv();
    const session = attachSession(fake);
    fake.scheduler.tick(0);
    skipIntro(fake, session, fake.canvas.rect);
    fake.scheduler.tick(16);

    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    const before = session.getSnapshot();
    expect(before.phase).toBe('playing');
    expect(before.orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });

    // 120 px rightward (yaw +1) and 120 px downward (pitch +1) are both classified drags.
    dragOn(fake.canvas, { x: 400, y: 400 }, { x: 520, y: 400 });
    dragOn(fake.canvas, { x: 400, y: 400 }, { x: 400, y: 520 });

    // Nothing rotated, nothing exploded, nothing was published: the snapshot is the same
    // object (the referential-stability contract), and later frames cannot rotate it.
    expect(session.getSnapshot()).toBe(before);
    expect(session.getSnapshot().orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(session.getSnapshot().rotationFrom).toBeNull();
    expect(session.getSnapshot().stats).toEqual({ clicks: 0, facesDestroyed: 0 });
    expect(faceIds(session.getSnapshot(), 'front')).toHaveLength(25);
    expect(listener).toHaveBeenCalledTimes(0);

    fake.scheduler.tick(316);
    expect(session.getSnapshot().orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    unsubscribe();
  });

  it('keeps fast, jittery clicks as independent taps and drops a 41 px drag (AC-2)', () => {
    // Recording engine: the exact event sequence for two jittery clicks and a 41 px release.
    const recording = createFakeEngine(snapshot({ phase: 'playing' }));
    const fake = createFakeEnv();
    const session = createGameSession({ env: fake.env, engine: recording.engine });
    session.attach(fake.canvas.surface);
    fake.scheduler.tick(0);

    // 5 px of jitter on the release: travel √50 ≈ 7.07 px is still a tap.
    fake.canvas.emit('pointerdown', { clientX: 400, clientY: 400 });
    fake.canvas.emit('pointerup', { clientX: 405, clientY: 405 });

    // 60 ms later, a second independent tap on the neighbouring tile.
    fake.clock.now = 60;
    fake.scheduler.tick(60);
    tapOn(fake.canvas, 460, 400);

    // 41 px of travel (one pixel past the inclusive 40 px threshold) is a drag: nothing.
    dragOn(fake.canvas, { x: 400, y: 400 }, { x: 441, y: 400 });

    expect(recording.events).toEqual([
      { type: 'explodeMiniCube', id: 'front:2:2' },
      { type: 'explodeMiniCube', id: 'front:2:3' },
    ]);
    session.dispose();

    // Real engine: the same three gestures yield two clicks and no rotation at all.
    const real = createFakeEnv();
    const realSession = attachSession(real);
    real.scheduler.tick(0);
    skipIntro(real, realSession, real.canvas.rect);
    real.scheduler.tick(16);

    real.canvas.emit('pointerdown', { clientX: 400, clientY: 400 });
    real.canvas.emit('pointerup', { clientX: 405, clientY: 405 });
    real.clock.now = 60;
    real.scheduler.tick(60);
    tapOn(real.canvas, 460, 400);

    const beforeDrag = realSession.getSnapshot();
    expect(beforeDrag.stats.clicks).toBe(2);
    expect(faceIds(beforeDrag, 'front')).toHaveLength(23);
    expect(faceIds(beforeDrag, 'front')).not.toContain('front:2:2');
    expect(faceIds(beforeDrag, 'front')).not.toContain('front:2:3');

    dragOn(real.canvas, { x: 400, y: 400 }, { x: 441, y: 400 });

    expect(realSession.getSnapshot()).toBe(beforeDrag);
    expect(realSession.getSnapshot().stats.clicks).toBe(2);
    expect(realSession.getSnapshot().orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
  });

  it('ignores a pointer release without a press and cancels a running press', () => {
    const fake = createFakeEnv();
    const session = attachSession(fake);
    fake.scheduler.tick(0);
    skipIntro(fake, session, fake.canvas.rect);
    fake.scheduler.tick(16);

    fake.canvas.emit('pointerup', { clientX: 400, clientY: 400 });
    expect(session.getSnapshot().stats.clicks).toBe(0);

    fake.canvas.emit('pointerdown', { clientX: 400, clientY: 400 });
    fake.canvas.emit('pointercancel', {});
    fake.canvas.emit('pointerup', { clientX: 400, clientY: 400 });
    expect(session.getSnapshot().stats.clicks).toBe(0);

    // A degenerate rect cannot produce NDC coordinates, so the gesture is dropped.
    fake.canvas.rect.width = 0;
    tapOn(fake.canvas, 0, 0);
    expect(session.getSnapshot().stats.clicks).toBe(0);
  });
});

describe('resize and visibility', () => {
  it('re-applies size, capped pixel ratio and camera projection on the injected resize (AC-6, AC-7)', () => {
    vi.useFakeTimers();
    const fake = createFakeEnv({ rect: { left: 0, top: 0, width: 1600, height: 800 } });
    const session = attachSession(fake);
    fake.scheduler.tick(0);
    skipIntro(fake, session, { left: 0, top: 0, width: 1600, height: 800 });
    fake.scheduler.tick(16);

    // ndcX 0.3 under the wide 2:1 projection: the ray leaves the cube's silhouette.
    tapOn(fake.canvas, 1040, 400);
    expect(session.getSnapshot().stats.clicks).toBe(0);

    fake.canvas.rect.width = 800;
    fake.canvas.rect.height = 800;
    fake.resize.emit();

    // A resize emission never applies synchronously: the attach pair is still the last.
    expect(fake.renderer.calls).toEqual(['setPixelRatio:1', 'setSize:1600:800']);
    vi.advanceTimersByTime(15);
    expect(fake.renderer.calls).toEqual(['setPixelRatio:1', 'setSize:1600:800']);
    // ...and the trailing timer lands within the pinned 16 ms window.
    vi.advanceTimersByTime(1);
    expect(fake.renderer.calls).toEqual([
      'setPixelRatio:1',
      'setSize:1600:800',
      'setPixelRatio:1',
      'setSize:800:800',
    ]);

    fake.scheduler.tick(32);
    expect(fake.renderer.renders.at(-1)!.camera.aspect).toBe(1);

    // Same NDC position, square projection: it now lands on `front:2:3`. Only the
    // refreshed aspect (and the projection matrix behind it) makes the pick agree with
    // the frame it is rendered with.
    tapOn(fake.canvas, 520, 400);
    expect(session.getSnapshot().stats.clicks).toBe(1);
    expect(faceIds(session.getSnapshot(), 'front')).toHaveLength(24);
    expect(faceIds(session.getSnapshot(), 'front')).not.toContain('front:2:3');
  });

  it('coalesces a burst of resize emissions into one trailing apply (AC-8)', () => {
    vi.useFakeTimers();
    const fake = createFakeEnv({ rect: { left: 0, top: 0, width: 800, height: 600 } });
    attachSession(fake);

    fake.canvas.rect.width = 1024;
    fake.canvas.rect.height = 768;
    fake.resize.emit();
    vi.advanceTimersByTime(10);
    fake.canvas.rect.width = 1280;
    fake.canvas.rect.height = 720;
    fake.resize.emit();

    // The second emission cleared the first timer: nothing lands at the original 16 ms.
    vi.advanceTimersByTime(15);
    expect(fake.renderer.calls).toEqual(['setPixelRatio:1', 'setSize:800:600']);
    // The restarted trailing timer applies only the final box, once.
    vi.advanceTimersByTime(1);
    expect(fake.renderer.calls).toEqual([
      'setPixelRatio:1',
      'setSize:800:600',
      'setPixelRatio:1',
      'setSize:1280:720',
    ]);
  });

  it('applies an orientation change synchronously and clears the pending resize (AC-8)', () => {
    vi.useFakeTimers();
    const fake = createFakeEnv({ rect: { left: 0, top: 0, width: 800, height: 600 } });
    attachSession(fake);
    fake.scheduler.tick(0);

    fake.canvas.rect.width = 600;
    fake.canvas.rect.height = 800;
    fake.resize.emit();
    expect(fake.renderer.calls).toEqual(['setPixelRatio:1', 'setSize:800:600']);

    fake.orientation.emit();

    // Immediate, before any timer can run: the rotated box already reached the adapter.
    expect(fake.renderer.calls).toEqual([
      'setPixelRatio:1',
      'setSize:800:600',
      'setPixelRatio:1',
      'setSize:600:800',
    ]);
    expect(fake.renderer.renders.at(-1)!.camera.aspect).toBe(0.75);

    // The orientation apply cleared the queued resize: no duplicate lands at 16 ms.
    vi.advanceTimersByTime(16);
    expect(fake.renderer.calls).toEqual([
      'setPixelRatio:1',
      'setSize:800:600',
      'setPixelRatio:1',
      'setSize:600:800',
    ]);
  });

  it('cancels a pending debounced resize on teardown (AC-8)', () => {
    vi.useFakeTimers();
    const fake = createFakeEnv();
    const session = attachSession(fake);
    fake.canvas.rect.width = 640;
    fake.canvas.rect.height = 480;
    fake.resize.emit();

    expect(vi.getTimerCount()).toBe(1);
    session.dispose();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(16);

    expect(fake.renderer.calls).toEqual(['setPixelRatio:1', 'setSize:800:800']);
    expect(fake.resize.unsubscribeCount()).toBe(1);
    expect(fake.orientation.unsubscribeCount()).toBe(1);
  });

  it('pauses the loop while hidden and resumes it from the current time (AC-15)', () => {
    const recording = createFakeEngine(snapshot());
    const fake = createFakeEnv();
    const session = createGameSession({ env: fake.env, engine: recording.engine });
    session.attach(fake.canvas.surface);
    fake.scheduler.tick(0);

    expect(recording.advancements).toEqual([0]);
    expect(fake.scheduler.schedules()).toBe(2);

    fake.visibility.emit(true);

    expect(fake.scheduler.cancels()).toEqual([2]);
    expect(fake.scheduler.pending()).toBe(0);
    expect(fake.scheduler.schedules()).toBe(2);

    // A second hidden event has no pending frame left to cancel.
    fake.visibility.emit(true);
    expect(fake.scheduler.cancels()).toEqual([2]);

    fake.clock.now = 5000;
    fake.visibility.emit(false);

    expect(fake.scheduler.pending()).toBe(1);
    expect(fake.scheduler.schedules()).toBe(3);

    fake.clock.now = 5016;
    fake.scheduler.tick(5016);

    // The hidden span never turns into one giant delta.
    expect(recording.advancements).toEqual([0, 16]);
    expect(fake.renderer.renders).toHaveLength(2);
  });

  it('attaches while hidden: creates the renderer, schedules no frame and resumes once visible', () => {
    const fake = createFakeEnv({ hidden: true, dpr: 3 });
    const session = attachSession(fake);

    // Attach still builds the adapter and applies the tier + viewport; only the loop waits.
    expect(fake.renderer.canvases).toEqual([fake.canvas.surface]);
    expect(fake.renderer.order).toEqual(['setQuality:high', 'setPixelRatio:2', 'setSize:800:800']);
    expect(fake.scheduler.schedules()).toBe(0);
    expect(fake.scheduler.pending()).toBe(0);
    expect(fake.renderer.renders).toHaveLength(0);
    expect(session.getSnapshot().phase).toBe('intro');

    fake.visibility.emit(false);

    expect(fake.scheduler.pending()).toBe(1);
    expect(fake.scheduler.schedules()).toBe(1);

    tickFrames(fake, 1, 16);

    expect(fake.renderer.renders).toHaveLength(1);
  });

  it('ignores a visibility callback that escapes after dispose', () => {
    const fake = createFakeEnv();
    const session = attachSession(fake);
    const escaped = fake.visibility.callbacks()[0]!;

    session.dispose();
    escaped(false);

    expect(fake.scheduler.schedules()).toBe(1);
    expect(fake.scheduler.pending()).toBe(0);
  });
});

describe('frame loop', () => {
  it('advances by the frame delta, renders and reschedules (AC-15)', () => {
    const recording = createFakeEngine(snapshot({ phase: 'intro', phaseProgress: 0.5 }));
    const fake = createFakeEnv();
    const session = createGameSession({ env: fake.env, engine: recording.engine });
    session.attach(fake.canvas.surface);

    fake.scheduler.tick(0);
    fake.scheduler.tick(16);
    fake.scheduler.tick(8);
    fake.scheduler.tick(24);

    // The first frame measures from the attach time; a rewind never becomes a negative delta.
    expect(recording.advancements).toEqual([0, 16, 0, 16]);
    expect(fake.renderer.renders).toHaveLength(4);
    expect(fake.scheduler.pending()).toBe(1);
    expect(session.getSnapshot()).toBe(recording.engine.getSnapshot());
  });
});

describe('reduced motion', () => {
  it('follows the injected motion source from attach and on a live change (AC-12)', () => {
    const fake = createFakeEnv({ reducedMotion: true });
    const session = attachSession(fake);

    expect(session.getSnapshot().reducedMotion).toBe(true);

    fake.motion.emit(false);
    expect(session.getSnapshot().reducedMotion).toBe(false);

    fake.motion.emit(true);
    expect(session.getSnapshot().reducedMotion).toBe(true);
  });

  it('applies the motion setting before the first frame', () => {
    const recording = createFakeEngine(snapshot({ reducedMotion: false }));
    const fake = createFakeEnv({ reducedMotion: true });
    const session = createGameSession({ env: fake.env, engine: recording.engine });
    session.attach(fake.canvas.surface);

    expect(recording.motionCalls).toEqual([true]);
    expect(recording.advancements).toEqual([]);

    fake.motion.emit(false);
    expect(recording.motionCalls).toEqual([true, false]);
  });
});

describe('subscription', () => {
  it('notifies on snapshot changes and stops after unsubscribe (AC-11)', () => {
    const fake = createFakeEnv();
    const session = attachSession(fake);
    fake.scheduler.tick(0);

    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    const before = session.getSnapshot();

    tapOn(fake.canvas, 400, 400);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot().phase).toBe('playing');

    fake.keys.emitKey('ArrowRight');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(session.getSnapshot()).not.toBe(before);

    unsubscribe();
    fake.keys.emitKey('ArrowLeft');
    // The engine still receives the event (only the subscription is gone): the left step is
    // queued behind the running right step, so the orientation counters stay where they are.
    expect(listener).toHaveBeenCalledTimes(2);
    expect(session.getSnapshot().orientation).toEqual({ yawSteps: 1, pitchSteps: 0 });
  });
});

describe('dispose', () => {
  it('cancels the frame, releases everything exactly once and never renders again (AC-15)', () => {
    const fake = createFakeEnv();
    const session = attachSession(fake);
    fake.scheduler.tick(0);

    const scene = fake.renderer.renders.at(-1)!.scene;
    let bodyDisposals = 0;
    cubeBody(scene).geometry.addEventListener('dispose', () => {
      bodyDisposals += 1;
    });
    const escaped = fake.scheduler.last()!;

    session.dispose();

    expect(fake.scheduler.cancels()).toEqual([2]);
    expect(fake.scheduler.pending()).toBe(0);
    expect(fake.canvas.listenerCount('pointerdown')).toBe(0);
    expect(fake.canvas.listenerCount('pointerup')).toBe(0);
    expect(fake.canvas.listenerCount('pointercancel')).toBe(0);
    expect(fake.keys.listenerCount()).toBe(0);
    expect(fake.motion.unsubscribeCount()).toBe(1);
    expect(fake.visibility.unsubscribeCount()).toBe(1);
    expect(fake.resize.unsubscribeCount()).toBe(1);
    expect(fake.orientation.unsubscribeCount()).toBe(1);
    expect(fake.renderer.disposals()).toBe(1);
    expect(bodyDisposals).toBe(1);
    expect(scene.children).toEqual([]);

    session.dispose();

    expect(fake.renderer.disposals()).toBe(1);
    expect(bodyDisposals).toBe(1);

    // A callback that escaped the cancel must neither render nor reschedule.
    escaped(64);
    expect(fake.renderer.renders).toHaveLength(1);
    expect(fake.scheduler.schedules()).toBe(2);
  });

  it('can be attached again for the same engine state', () => {
    const fake = createFakeEnv();
    const session = attachSession(fake);
    fake.scheduler.tick(0);
    session.dispose();

    session.attach(fake.canvas.surface);

    expect(fake.renderer.canvases).toEqual([fake.canvas.surface, fake.canvas.surface]);
    expect(fake.renderer.calls).toEqual([
      'setPixelRatio:1',
      'setSize:800:800',
      'setPixelRatio:1',
      'setSize:800:800',
    ]);
    expect(fake.renderer.qualities).toEqual(['high', 'high']);
    expect(fake.renderer.order).toEqual([
      'setQuality:high',
      'setPixelRatio:1',
      'setSize:800:800',
      'render',
      'dispose',
      'setQuality:high',
      'setPixelRatio:1',
      'setSize:800:800',
    ]);
    expect(fake.canvas.listenerCount('pointerdown')).toBe(1);
    expect(fake.motion.subscribeCount()).toBe(2);
    expect(fake.renderer.disposals()).toBe(1);
    expect(fake.scheduler.pending()).toBe(1);

    fake.scheduler.tick(16);

    expect(fake.renderer.renders).toHaveLength(2);
  });
});

describe('deferred lifecycle probes (AC-13)', () => {
  it('ignores a resize emitted before attach without creating a renderer', () => {
    const fake = createFakeEnv();
    const session = createRealSession(fake);

    fake.resize.emit();

    expect(fake.renderer.canvases).toEqual([]);
    expect(fake.scheduler.schedules()).toBe(0);
    expect(fake.resize.subscribeCount()).toBe(0);
    expect(session.getSnapshot().phase).toBe('intro');
  });

  it('survives a synthetic context loss/restore during the intro without listeners or frames', () => {
    const fake = createFakeEnv();
    const session = attachSession(fake);
    fake.scheduler.tick(0);

    expect(fake.scheduler.schedules()).toBe(2);
    expect(fake.scheduler.pending()).toBe(1);
    expect(fake.renderer.renders).toHaveLength(1);

    fake.canvas.emit('webglcontextlost', {});
    fake.canvas.emit('webglcontextrestored', {});

    // No context listener is ours: three.js owns the restore path.
    expect(fake.canvas.listenerCount('webglcontextlost')).toBe(0);
    expect(fake.canvas.listenerCount('webglcontextrestored')).toBe(0);
    expect(fake.canvas.listenerCount('pointerdown')).toBe(1);
    expect(fake.canvas.listenerCount('pointerup')).toBe(1);
    expect(fake.canvas.listenerCount('pointercancel')).toBe(1);
    expect(fake.canvas.listenerCount('pointermove')).toBe(1);
    expect(fake.canvas.listenerCount('pointerleave')).toBe(1);
    // Neither the schedule nor the render count changed.
    expect(fake.scheduler.schedules()).toBe(2);
    expect(fake.scheduler.pending()).toBe(1);
    expect(fake.renderer.renders).toHaveLength(1);
    expect(session.getSnapshot().phase).toBe('intro');

    tickFrames(fake, 1, 16);

    expect(fake.renderer.renders).toHaveLength(2);
    expect(fake.scheduler.schedules()).toBe(3);
  });
});

describe('detached login path (AC-2, AC-14)', () => {
  it('retryConnection before attach is status-only and never touches the transport', () => {
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);

    session.retryConnection();

    expect(wire.events).toEqual([]);
    expect(wire.connectCount()).toBe(0);
    expect(wire.closeCount()).toBe(0);
    expect(wire.messageHandlerCount()).toBe(0);
    expect(wire.statusHandlerCount()).toBe(0);
    expect(fake.renderer.canvases).toEqual([]);
    expect(fake.scheduler.schedules()).toBe(0);
    expect(session.getMultiplayerSnapshot().status).toBe('connecting');
  });

  it('receives welcome after a detached retryConnection → join(account) → attach cycle', () => {
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);

    // The auth gate's verified-login path: retry, then join, then attach (gate close).
    session.retryConnection();
    session.join('account');

    expect(wire.events).toEqual(['join:account']);
    expect(wire.connectCount()).toBe(0);
    expect(wire.closeCount()).toBe(0);

    session.attach(fake.canvas.surface);

    // Subscribe-before-connect: both handlers exist before the single socket opens.
    expect(wire.events).toEqual(['join:account', 'onMessage', 'onStatus', 'connect']);
    expect(wire.messageHandlerCount()).toBe(1);
    expect(wire.statusHandlerCount()).toBe(1);
    expect(wire.connectCount()).toBe(1);
    expect(wire.closeCount()).toBe(0);

    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ serverId: 42, roster: [selfMember()] }));

    expect(session.getMultiplayerSnapshot().world.serverId).toBe(42);
    expect(session.getMultiplayerSnapshot().status).toBe('connected');

    // The welcome releases `canRun`: the next scheduled frame advances the intro.
    fake.scheduler.tick(0);
    expect(session.getSnapshot().phaseProgress).toBe(0);
    tickFrames(fake, 1, 16);
    expect(session.getSnapshot().phase).toBe('intro');
    expect(session.getSnapshot().phaseProgress).toBe(16 / 2500);
    expect(fake.renderer.renders).toHaveLength(2);
  });
});

describe('multiplayer welcome and intro hold (AC-23, AC-12)', () => {
  it('holds the intro at progress 0 until welcome, then adopts the server grid and own slot', () => {
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);

    expect(wire.connectCount()).toBe(1);
    const beforeWelcome = session.getMultiplayerSnapshot();
    expect(beforeWelcome.status).toBe('connecting');
    expect(beforeWelcome.world.serverId).toBe(0);
    expect(beforeWelcome.world.self.playerId).toBe('');
    expect(beforeWelcome.spectate).toEqual({ mode: 'none' });

    wire.emitStatus('connected');
    fake.scheduler.tick(0);
    fake.scheduler.tick(2000);

    // No welcome yet: the engine is frozen at the intro start and the starfield renders.
    expect(session.getSnapshot().phase).toBe('intro');
    expect(session.getSnapshot().phaseProgress).toBe(0);
    expect(fake.renderer.renders).toHaveLength(2);
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([0, 0, 60]);

    // A tap before welcome may not skip the intro (the gate is closed).
    tapOn(fake.canvas, 400, 400);
    expect(session.getSnapshot().phase).toBe('intro');

    wire.emit(
      welcomeMessage({
        gridSize: 6,
        position: { x: 24, y: 0 },
        roster: [
          selfMember({ position: { x: 24, y: 0 }, gridSize: 6 }),
          member({ position: { x: 0, y: 24 }, gridSize: 6 }),
        ],
      }),
    );

    const released = session.getSnapshot();
    expect(released.phase).toBe('intro');
    expect(released.phaseProgress).toBe(0);
    expect(released.gridSize).toBe(6);
    expect(session.getMultiplayerSnapshot().status).toBe('connected');
    expect(session.getMultiplayerSnapshot().world.self.cube).toEqual({
      levelIndex: 0,
      gridSize: 6,
      styleId: 'obsidian-neon',
      removedIds: [],
      yawSteps: 0,
      pitchSteps: 0,
    });
    expect(session.getMultiplayerSnapshot().world.members.map((entry) => entry.playerId)).toEqual([
      'p2',
    ]);
    // The session never writes the handshake: join/rejoin belong to the transport.
    expect(wire.sent).toEqual([]);

    fake.scheduler.tick(2016);

    // The intro clock starts at the first frame after welcome (16 ms of the 2500 ms intro).
    expect(session.getSnapshot().phaseProgress).toBe(16 / 2500);
    const scene = fake.renderer.renders.at(-1)!.scene;
    expect(faceMesh(scene, 'front').count).toBe(36);
    expect(cubeGroup(scene).position.toArray()).toEqual([24, 0, 0]);
  });

  it('resumes the own cube, resets spectate and re-enters the world on a resume welcome', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    fake.scheduler.tick(0);
    tapOn(fake.canvas, 400, 400); // intro skip
    fake.scheduler.tick(16);
    expect(session.getSnapshot().phase).toBe('playing');

    // Fly to p2 and land in view mode.
    expect(session.spectateMember('p2')).toBe(true);
    fake.scheduler.tick(2516);
    expect(session.getMultiplayerSnapshot().spectate).toEqual({ mode: 'viewing', target: 'p2' });
    expect(session.getSnapshot().spectating).toBe(true);

    wire.emitStatus('disconnected');
    expect(session.getMultiplayerSnapshot().status).toBe('disconnected');
    // While disconnected the flight/click gate is closed and the view is frozen.
    tapOn(fake.canvas, 400, 400);
    expect(session.getSnapshot().stats.clicks).toBe(0);
    expect(session.spectateMember('p2')).toBe(false);
    expect(session.returnToOwnCube()).toBe(false);

    wire.emitStatus('connected');
    wire.emit(
      welcomeMessage({
        removedIds: ['front:0:0'],
        roster: [selfMember({ removedIds: ['front:0:0'] }), member()],
      }),
    );

    // The resume resets the view instantly (no flight), re-syncs the board and clears the
    // spectate state; the local stats are not rolled back by the reconcile.
    expect(session.getMultiplayerSnapshot().spectate).toEqual({ mode: 'none' });
    expect(session.getSnapshot().spectating).toBe(false);
    expect(session.getMultiplayerSnapshot().world.self.cube.removedIds).toEqual(['front:0:0']);
    expect(session.getSnapshot().stats.clicks).toBe(1);

    fake.scheduler.tick(32);
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([0, 0, 12]);

    // Normal play resumes: the same tap that was gated now explodes front:2:3.
    tapOn(fake.canvas, 460, 400);
    expect(session.getSnapshot().stats.clicks).toBe(2);
    expect(wire.sent).toEqual([{ type: 'explode', id: 'front:2:3', level: 0 }]);
  });
});

describe('multiplayer authority (AC-14, AC-12, AC-18)', () => {
  it('forwards a successful explode, reports the sixth face and releases the held travel', () => {
    // One tile left on the whole cube: the next tap clears the sixth face.
    let board = createBoard(5);
    for (const faceId of FACE_IDS) {
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          const id: MiniCubeId = `${faceId}:${row}:${col}`;
          if (id !== 'front:2:2') {
            board = removeMiniCube(board, id).board;
          }
        }
      }
    }
    const recording = createFakeEngine(snapshot({ phase: 'playing', board }), {
      mutateExplosions: true,
    });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, recording.engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));

    tapOn(fake.canvas, 400, 400);

    expect(recording.events).toEqual([{ type: 'explodeMiniCube', id: 'front:2:2' }]);
    expect(wire.sent).toEqual([
      { type: 'explode', id: 'front:2:2', level: 0 },
      { type: 'cubeCompleted', level: 0 },
    ]);
    expect(session.getSnapshot().stats.clicks).toBe(1);
    // Between cubeCompleted and authority data a spectate request is refused (Q-T8-3).
    expect(session.spectateMember('p2')).toBe(false);

    wire.emit(levelAdvancedMessage({ gridSize: 4, position: { x: 24, y: 0 } }));

    expect(recording.nextLevels).toEqual([
      { gridSize: 4, style: CUBE_STYLES[1], destination: { x: 24, y: 0 } },
    ]);
    expect(session.getMultiplayerSnapshot().world.self.cube).toEqual({
      levelIndex: 1,
      gridSize: 4,
      styleId: 'crimson-alloy',
      removedIds: [],
      yawSteps: 0,
      pitchSteps: 0,
    });
    // No second completion ever leaves for the same level.
    wire.emit(levelAdvancedMessage({ gridSize: 4, position: { x: 24, y: 0 } }));
    expect(wire.sent).toEqual([
      { type: 'explode', id: 'front:2:2', level: 0 },
      { type: 'cubeCompleted', level: 0 },
    ]);
  });

  it('treats a consistent ack as a no-op and hands stateSync to the adoption seam', () => {
    const recording = createFakeEngine(snapshot({ phase: 'playing' }), {
      mutateExplosions: true,
    });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, recording.engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));

    // The server acked a click this client did not apply yet: reconcile it, never echo it.
    wire.emit({ type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' });
    expect(recording.events).toEqual([{ type: 'explodeMiniCube', id: 'front:0:0' }]);
    expect(recording.engine.getSnapshot().stats.clicks).toBe(1);

    const reconciled = recording.engine.getSnapshot();
    wire.emit({ type: 'miniCubeRemoved', playerId: 'p1', id: 'front:0:0' });
    expect(recording.events).toEqual([{ type: 'explodeMiniCube', id: 'front:0:0' }]);
    expect(recording.engine.getSnapshot()).toBe(reconciled);

    // The full sync is not replayed tile by tile: the session hands the exact cube over.
    wire.emit(
      stateSyncMessage({ removedIds: ['front:0:0', 'front:0:1', 'front:0:2'] }),
    );
    expect(recording.events).toEqual([{ type: 'explodeMiniCube', id: 'front:0:0' }]);
    expect(recording.cubeAdoptions).toEqual([
      { levelIndex: 0, gridSize: 5, style: CUBE_STYLES[0], removedIds: [] },
      {
        levelIndex: 0,
        gridSize: 5,
        style: CUBE_STYLES[0],
        removedIds: ['front:0:0', 'front:0:1', 'front:0:2'],
      },
    ]);
    expect(wire.sent).toEqual([]);

    // A different level/grid/style is adopted too instead of being ignored.
    wire.emit(stateSyncMessage({ levelIndex: 1, gridSize: 4, styleId: 'crimson-alloy' }));
    expect(recording.cubeAdoptions).toEqual([
      { levelIndex: 0, gridSize: 5, style: CUBE_STYLES[0], removedIds: [] },
      {
        levelIndex: 0,
        gridSize: 5,
        style: CUBE_STYLES[0],
        removedIds: ['front:0:0', 'front:0:1', 'front:0:2'],
      },
      { levelIndex: 1, gridSize: 4, style: CUBE_STYLES[1], removedIds: [] },
    ]);

    // Remote authority never touches the own engine; the world store carries it.
    wire.emit(
      stateSyncMessage({
        playerId: 'p2',
        removedIds: ['front:1:1'],
      }),
    );
    expect(recording.cubeAdoptions).toHaveLength(3);
    expect(recording.events).toEqual([{ type: 'explodeMiniCube', id: 'front:0:0' }]);
    expect(session.getMultiplayerSnapshot().world.members[0]!.removedIds).toEqual(['front:1:1']);
  });

  it('releases the held online travel with levelAdvanced and advances at the midpoint (AC-12)', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage());
    fake.scheduler.tick(0);
    tapOn(fake.canvas, 400, 400); // intro skip
    fake.scheduler.tick(16);
    expect(session.getSnapshot().phase).toBe('playing');

    // Clear every tile but the front face's centre through the engine: no sends happen.
    for (const faceId of FACE_IDS) {
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          if (faceId !== 'front' || row !== 2 || col !== 2) {
            engine.dispatch({ type: 'explodeMiniCube', id: `${faceId}:${row}:${col}` });
          }
        }
      }
    }
    expect(wire.sent).toEqual([]);
    tapOn(fake.canvas, 400, 400);
    expect(wire.sent).toEqual([
      { type: 'explode', id: 'front:2:2', level: 0 },
      { type: 'cubeCompleted', level: 0 },
    ]);

    fake.scheduler.tick(416); // face fade 400 ms: the online travel starts held
    const held = session.getSnapshot();
    expect(held.phase).toBe('travel');
    expect(held.travelKind).toBe('nextLevel');
    expect(held.travelDestination).toBeNull();
    expect(held.phaseProgress).toBe(0);

    wire.emit(
      levelAdvancedMessage({
        levelIndex: 1,
        gridSize: 3,
        styleId: 'emerald-crystal',
        position: { x: 24, y: 0 },
      }),
    );
    expect(session.getSnapshot().travelDestination).toEqual({ x: 24, y: 0 });
    expect(session.getSnapshot().phaseProgress).toBe(0);

    fake.scheduler.tick(1666); // 1250 ms into the 2500 ms flight: the midpoint
    const midpoint = session.getSnapshot();
    expect(midpoint.levelIndex).toBe(1);
    expect(midpoint.gridSize).toBe(3);
    expect(midpoint.style.id).toBe('emerald-crystal');
    const scene = fake.renderer.renders.at(-1)!.scene;
    expect(cubeGroup(scene).position.toArray()).toEqual([24, 0, 0]);
    expect(faceMesh(scene, 'front').count).toBe(9);
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([12, 0, 90]);

    fake.scheduler.tick(2916); // 2500 ms: playing again
    expect(session.getSnapshot().phase).toBe('playing');
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([24, 0, 12]);
    expect(session.getSnapshot().stats.clicks).toBe(150);
  });

  it('queues the worldEntered swap for the midpoint and applies the new world (AC-12)', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    fake.scheduler.tick(0);
    tapOn(fake.canvas, 400, 400);
    fake.scheduler.tick(16);

    for (const faceId of FACE_IDS) {
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          if (faceId !== 'front' || row !== 2 || col !== 2) {
            engine.dispatch({ type: 'explodeMiniCube', id: `${faceId}:${row}:${col}` });
          }
        }
      }
    }
    tapOn(fake.canvas, 400, 400);
    fake.scheduler.tick(416);
    expect(session.getSnapshot().phase).toBe('travel');

    wire.emit(
      worldEnteredMessage({
        position: { x: 0, y: 24 },
        roster: [
          selfMember({
            position: { x: 0, y: 24 },
            levelIndex: 1,
            gridSize: 4,
            styleId: 'crimson-alloy',
          }),
          member({
            playerId: 'p3',
            name: 'Player 3',
            position: { x: 24, y: 0 },
            levelIndex: 3,
            gridSize: 6,
            styleId: 'solar-gold',
          }),
        ],
      }),
    );

    expect(session.getSnapshot().travelDestination).toEqual({ x: 0, y: 24 });
    expect(session.getMultiplayerSnapshot().world.pendingWorldSwap).toEqual({
      serverId: 2,
      maxUsers: 2,
      position: { x: 0, y: 24 },
      self: { levelIndex: 1, gridSize: 4, styleId: 'crimson-alloy', removedIds: [], yawSteps: 0, pitchSteps: 0 },
      roster: [
        {
          playerId: 'p1',
          name: 'Player 1',
          position: { x: 0, y: 24 },
          levelIndex: 1,
          gridSize: 4,
          styleId: 'crimson-alloy',
          removedIds: [],
          yawSteps: 0,
          pitchSteps: 0,
          appearance: {},
        },
        {
          playerId: 'p3',
          name: 'Player 3',
          position: { x: 24, y: 0 },
          levelIndex: 3,
          gridSize: 6,
          styleId: 'solar-gold',
          removedIds: [],
          yawSteps: 0,
          pitchSteps: 0,
          appearance: {},
        },
      ],
      activity: [],
      leaderboard: null,
      economy: { coins: 0, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 },
    });

    fake.scheduler.tick(1666); // midpoint

    const swapped = session.getMultiplayerSnapshot().world;
    expect(swapped.serverId).toBe(2);
    expect(swapped.maxUsers).toBe(2);
    expect(swapped.self.position).toEqual({ x: 0, y: 24 });
    expect(swapped.pendingWorldSwap).toBeNull();
    expect(swapped.members.map((entry) => entry.playerId)).toEqual(['p3']);
    const scene = fake.renderer.renders.at(-1)!.scene;
    expect(cubeGroup(scene).position.toArray()).toEqual([0, 24, 0]);
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([0, 12, 90]);

    fake.scheduler.tick(2916);
    expect(session.getSnapshot().phase).toBe('playing');
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([0, 24, 12]);
  });

  it('enters a worldEntered world immediately when no travel is waiting (defensive)', () => {
    const recording = createFakeEngine(snapshot({ phase: 'playing' }));
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, recording.engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));

    wire.emit(
      worldEnteredMessage({
        roster: [
          selfMember({ position: { x: 0, y: 24 }, levelIndex: 1, gridSize: 4 }),
          member({ playerId: 'p3', name: 'Player 3', position: { x: 24, y: 0 } }),
        ],
      }),
    );

    expect(recording.nextLevels).toEqual([
      { gridSize: 4, style: CUBE_STYLES[1], destination: { x: 0, y: 24 } },
    ]);
    expect(session.getMultiplayerSnapshot().world.serverId).toBe(2);
    expect(session.getMultiplayerSnapshot().world.members.map((entry) => entry.playerId)).toEqual([
      'p3',
    ]);

    fake.scheduler.tick(0);
    expect(cubeGroup(fake.renderer.renders.at(-1)!.scene).position.toArray()).toEqual([0, 24, 0]);
  });
});

describe('batched mini-cube removals (AC-17, AC-18)', () => {
  /**
   * Stand-in for the browser WebSocket surface the real retry connection and transport use
   * (the same shape as `transport.test.ts`): the transport still runs its real decode path.
   */
  class FakeBatchSocket {
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;

    readonly sent: string[] = [];

    constructor(readonly url: string) {}

    send(text: string): void {
      this.sent.push(text);
    }

    close(): void {}

    emitOpen(): void {
      this.onopen?.();
    }

    emitMessage(data: unknown): void {
      this.onmessage?.({ data });
    }
  }

  /**
   * The AC-18 scene delegate: a fake `SceneView` whose only real work is the remote world —
   * `enterWorld` applies the roster to a real `WorldView` and `applyWorldMessage` delegates
   * straight to its real `applyMessage`. No session dependency is mocked here.
   */
  function createDelegatingScene(worldView: WorldView): SceneView {
    return {
      scene: new Scene(),
      camera: new PerspectiveCamera(),
      cubeView: null as unknown as SceneView['cubeView'],
      worldView,
      cosmicBackdrop: null as unknown as SceneView['cosmicBackdrop'],
      enterWorld(world: SceneWorld): void {
        worldView.applyRoster(world.roster);
      },
      queueWorldSwap(): void {},
      applyWorldMessage(message: ServerMessage): void {
        worldView.applyMessage(message);
      },
      setPointerTarget(): void {},
      setHoverTarget(): void {},
      triggerFlyBy(): void {},
      getQualityTier(): QualityTier {
        return 'high';
      },
      setQualityTierForTesting(): void {},
      shots: [],
      lastFrameTime: 0,
      lastAppearance: {},
      lastAppliedAppearance: {},
      appliedAppearance: {},
      applyIntents(): void {},
      applySnapshot(): void {},
      update(): void {},
      dispose(): void {
        worldView.dispose();
      },
    };
  }

  it('reconciles every self id and never touches the engine for remote, duplicate or unknown batches', () => {
    const recording = createFakeEngine(snapshot({ phase: 'playing' }), {
      mutateExplosions: true,
    });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, recording.engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));

    wire.emit({
      type: 'miniCubesRemoved',
      playerId: 'p1',
      ids: ['front:0:0', 'front:0:1'],
    });

    expect(recording.events).toEqual([
      { type: 'explodeMiniCube', id: 'front:0:0' },
      { type: 'explodeMiniCube', id: 'front:0:1' },
    ]);
    expect(recording.engine.getSnapshot().stats.clicks).toBe(2);
    expect(session.getMultiplayerSnapshot().world.self.cube.removedIds).toEqual([
      'front:0:0',
      'front:0:1',
    ]);
    expect(wire.sent).toEqual([]);

    // A replayed self batch changes nothing: no extra engine dispatch, no store churn.
    const stable = session.getMultiplayerSnapshot();
    wire.emit({
      type: 'miniCubesRemoved',
      playerId: 'p1',
      ids: ['front:0:0', 'front:0:1'],
    });
    expect(recording.events).toEqual([
      { type: 'explodeMiniCube', id: 'front:0:0' },
      { type: 'explodeMiniCube', id: 'front:0:1' },
    ]);
    expect(session.getMultiplayerSnapshot()).toBe(stable);

    // A remote batch is presentation-only for the session: the world reducer carries it and
    // the own engine receives no removal work.
    wire.emit({
      type: 'miniCubesRemoved',
      playerId: 'p2',
      ids: ['back:1:1', 'top:0:0'],
    });
    expect(recording.events).toEqual([
      { type: 'explodeMiniCube', id: 'front:0:0' },
      { type: 'explodeMiniCube', id: 'front:0:1' },
    ]);
    expect(session.getMultiplayerSnapshot().world.members[0]!.removedIds).toEqual([
      'back:1:1',
      'top:0:0',
    ]);
    expect(wire.sent).toEqual([]);
  });

  it('proves the backend batch frame end-to-end through transport → decoder → reducer → session → WorldView (AC-18)', () => {
    const fake = createFakeEnv();
    const worldView = createWorldView({ maxUsers: 10, random: () => 0.5 });
    fake.env.renderRuntime = {
      ...fake.env.renderRuntime,
      createSceneView: () => createDelegatingScene(worldView),
    };
    const recording = createFakeEngine(snapshot({ phase: 'playing' }), {
      mutateExplosions: true,
    });
    const sockets: FakeBatchSocket[] = [];
    const transport = createTransport({
      url: 'ws://test.local/ws',
      socketFactory: (url) => {
        const socket = new FakeBatchSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });
    const session = createGameSession({
      env: fake.env,
      engine: recording.engine,
      transport,
    });
    session.attach(fake.canvas.surface);

    const socket = sockets[0]!;
    socket.emitOpen();
    transport.join('guest');
    socket.emitMessage('{"type":"hello","serverTime":"2026-11-13T00:00:00.000Z"}');
    socket.emitMessage(
      JSON.stringify(welcomeMessage({ maxUsers: 10, roster: [selfMember(), member()] })),
    );

    expect(session.getMultiplayerSnapshot().world.self.playerId).toBe('p1');
    expect(
      session.getMultiplayerSnapshot().world.members.map((entry) => entry.playerId),
    ).toEqual(['p2']);
    expect([...worldView.views().keys()]).toEqual(['p2']);

    // Remote two-id batch, byte-for-byte the backend frame: one reducer application per id
    // and one live-view removal per id.
    socket.emitMessage(
      '{"type":"miniCubesRemoved","playerId":"p2","ids":["back:1:1","top:0:0"]}',
    );
    expect(session.getMultiplayerSnapshot().world.members[0]!.removedIds).toEqual([
      'back:1:1',
      'top:0:0',
    ]);
    const p2View = worldView.views().get('p2')!;
    expect(p2View.isMiniCubeHidden('back:1:1')).toBe(true);
    expect(p2View.isMiniCubeHidden('top:0:0')).toBe(true);
    expect(worldView.particles.activeCount()).toBe(48);
    expect(recording.events).toEqual([]);

    // Self two-id batch: the real session reconciles each id into the own engine.
    socket.emitMessage(
      '{"type":"miniCubesRemoved","playerId":"p1","ids":["front:0:0","front:0:1"]}',
    );
    expect(recording.events).toEqual([
      { type: 'explodeMiniCube', id: 'front:0:0' },
      { type: 'explodeMiniCube', id: 'front:0:1' },
    ]);
    expect(session.getMultiplayerSnapshot().world.self.cube.removedIds).toEqual([
      'front:0:0',
      'front:0:1',
    ]);
    // The own cube belongs to the scene, never to the remote world view.
    expect(worldView.particles.activeCount()).toBe(48);

    // Duplicate frame: the reducer returns the same reference and no effect restarts.
    const duplicateCheck = session.getMultiplayerSnapshot();
    socket.emitMessage(
      '{"type":"miniCubesRemoved","playerId":"p2","ids":["back:1:1","top:0:0"]}',
    );
    expect(session.getMultiplayerSnapshot()).toBe(duplicateCheck);
    expect(worldView.particles.activeCount()).toBe(48);
    expect(recording.events).toHaveLength(2);

    // Unknown member: no reducer, engine or world-view change.
    const unknownCheck = session.getMultiplayerSnapshot();
    socket.emitMessage(
      '{"type":"miniCubesRemoved","playerId":"p9","ids":["front:0:0","front:0:1"]}',
    );
    expect(session.getMultiplayerSnapshot()).toBe(unknownCheck);
    expect(worldView.particles.activeCount()).toBe(48);
    expect(recording.events).toHaveLength(2);

    // Malformed empty batch: the real decoder drops it with no state change.
    socket.emitMessage('{"type":"miniCubesRemoved","playerId":"p2","ids":[]}');
    expect(session.getMultiplayerSnapshot()).toBe(unknownCheck);
    expect(worldView.particles.activeCount()).toBe(48);
    expect(recording.events).toHaveLength(2);

    session.dispose();
  });
});

describe('activity feed over the wire (AC-16, AC-17, AC-18)', () => {
  /** The browser WebSocket surface the real transport drives (same shape as above). */
  class FakeActivitySocket {
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;

    readonly sent: string[] = [];

    constructor(readonly url: string) {}

    send(text: string): void {
      this.sent.push(text);
    }

    close(): void {}

    emitOpen(): void {
      this.onopen?.();
    }

    emitMessage(data: unknown): void {
      this.onmessage?.({ data });
    }
  }

  const JOIN_EVENT: ActivityEvent = {
    id: 1,
    at: 1000,
    serverId: 1,
    type: 'memberJoined',
    playerId: 'p2',
    name: 'Player 2',
  };

  const CLEARED_EVENT: ActivityEvent = {
    id: 2,
    at: 2000,
    serverId: 1,
    type: 'cubeCleared',
    playerId: 'p2',
    name: 'Player 2',
    level: 3,
  };

  const LOOT_EVENT: ActivityEvent = {
    id: 3,
    at: 3000,
    serverId: 1,
    type: 'epicLoot',
    playerId: 'p2',
    name: 'Player 2',
    partId: 'crown-epic',
  };

  const TARGET_JOIN_EVENT: ActivityEvent = {
    id: 1,
    at: 4000,
    serverId: 2,
    type: 'memberJoined',
    playerId: 'p3',
    name: 'Player 3',
  };

  const TARGET_CLEARED_EVENT: ActivityEvent = {
    id: 2,
    at: 5000,
    serverId: 2,
    type: 'cubeCleared',
    playerId: 'p3',
    name: 'Player 3',
    level: 6,
  };

  it('passes the exact welcome.activity and activityEvent frames through the real decoder and reducer', () => {
    const fake = createFakeEnv();
    const sockets: FakeActivitySocket[] = [];
    const transport = createTransport({
      url: 'ws://test.local/ws',
      socketFactory: (url) => {
        const socket = new FakeActivitySocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });
    const session = createGameSession({ env: fake.env, transport });
    session.attach(fake.canvas.surface);

    const socket = sockets[0]!;
    socket.emitOpen();
    session.join('guest');
    socket.emitMessage('{"type":"hello","serverTime":"2026-11-15T00:00:00.000Z"}');
    socket.emitMessage(
      JSON.stringify(
        welcomeMessage({ roster: [selfMember(), member()], activity: [CLEARED_EVENT, JOIN_EVENT] }),
      ),
    );

    expect(session.getMultiplayerSnapshot().world.activity).toEqual([
      CLEARED_EVENT,
      JOIN_EVENT,
    ]);

    // The exact backend frame (AC-12) prepends a fresh copy, newest first.
    socket.emitMessage(
      '{"type":"activityEvent","event":{"id":3,"at":3000,"serverId":1,"type":"epicLoot","playerId":"p2","name":"Player 2","partId":"crown-epic"}}',
    );
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([
      LOOT_EVENT,
      CLEARED_EVENT,
      JOIN_EVENT,
    ]);

    // A malformed frame is dropped by the real decoder with no state change.
    const stable = session.getMultiplayerSnapshot();
    socket.emitMessage(
      '{"type":"activityEvent","event":{"id":0,"at":4000,"serverId":1,"type":"memberJoined","playerId":"p9","name":"Player 9"}}',
    );
    expect(session.getMultiplayerSnapshot()).toBe(stable);

    // Another server's event is rejected by the reducer with no state change (AC-23).
    socket.emitMessage(
      '{"type":"activityEvent","event":{"id":9,"at":4000,"serverId":9,"type":"memberJoined","playerId":"p9","name":"Player 9"}}',
    );
    expect(session.getMultiplayerSnapshot()).toBe(stable);

    session.dispose();
  });

  it('updates the pending feed during travel and applies it at the midpoint swap', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()], activity: [JOIN_EVENT] }));
    fake.scheduler.tick(0);
    tapOn(fake.canvas, 400, 400);
    fake.scheduler.tick(16);

    for (const faceId of FACE_IDS) {
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          if (faceId !== 'front' || row !== 2 || col !== 2) {
            engine.dispatch({ type: 'explodeMiniCube', id: `${faceId}:${row}:${col}` });
          }
        }
      }
    }
    tapOn(fake.canvas, 400, 400);
    fake.scheduler.tick(416);
    expect(session.getSnapshot().phase).toBe('travel');

    wire.emit(
      worldEnteredMessage({
        activity: [TARGET_JOIN_EVENT],
        roster: [
          selfMember({ position: { x: 0, y: 24 }, levelIndex: 1, gridSize: 4 }),
          member({ playerId: 'p3', name: 'Player 3', position: { x: 24, y: 0 } }),
        ],
      }),
    );

    // The target event arrives before the travel midpoint: it joins the pending feed only.
    wire.emit({ type: 'activityEvent', event: TARGET_CLEARED_EVENT });
    const duringTravel = session.getMultiplayerSnapshot().world;
    expect(duringTravel.activity).toEqual([JOIN_EVENT]);
    expect(duringTravel.pendingWorldSwap!.activity).toEqual([
      TARGET_CLEARED_EVENT,
      TARGET_JOIN_EVENT,
    ]);

    fake.scheduler.tick(1666); // midpoint: the pending world (and its feed) becomes current
    const swapped = session.getMultiplayerSnapshot().world;
    expect(swapped.serverId).toBe(2);
    expect(swapped.activity).toEqual([TARGET_CLEARED_EVENT, TARGET_JOIN_EVENT]);
    expect(swapped.pendingWorldSwap).toBeNull();

    session.dispose();
  });
});

describe('pagehide leave (AC-7)', () => {
  /** The browser WebSocket surface the real transport drives (exact encoded frames). */
  class FakeLeaveSocket {
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;

    readonly sent: string[] = [];

    constructor(readonly url: string) {}

    send(text: string): void {
      this.sent.push(text);
    }

    close(): void {}

    emitOpen(): void {
      this.onopen?.();
    }

    emitMessage(data: unknown): void {
      this.onmessage?.({ data });
    }
  }

  it('sends exactly one {"type":"leave"} frame on a non-bfcache pagehide after welcome', () => {
    const fake = createFakeEnv();
    const sockets: FakeLeaveSocket[] = [];
    const transport = createTransport({
      url: 'ws://test.local/ws',
      socketFactory: (url) => {
        const socket = new FakeLeaveSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });
    const session = createGameSession({ env: fake.env, transport });
    session.attach(fake.canvas.surface);

    const socket = sockets[0]!;
    socket.emitOpen();
    session.join('guest');
    socket.emitMessage('{"type":"hello","serverTime":"2026-11-16T00:00:00.000Z"}');
    socket.emitMessage(JSON.stringify(welcomeMessage({ roster: [selfMember(), member()] })));

    // The transport's own hello handshake wrote the join frame; pagehide adds exactly one.
    expect(socket.sent).toEqual(['{"type":"join","mode":"guest"}']);

    fake.pageLifecycle.emit(false);
    expect(socket.sent).toEqual(['{"type":"join","mode":"guest"}', '{"type":"leave"}']);

    // A bfcache entry is not a close: the same page/socket may return, so no frame is sent.
    fake.pageLifecycle.emit(true);
    expect(socket.sent).toEqual(['{"type":"join","mode":"guest"}', '{"type":"leave"}']);

    session.dispose();
  });

  it('sends nothing before welcome, after a disconnect, or on dispose alone', () => {
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);

    // Connected but not welcomed: the server would answer `not_joined`, so no frame at all.
    wire.emitStatus('connected');
    fake.pageLifecycle.emit(false);
    expect(wire.sent).toEqual([]);

    wire.emit(welcomeMessage({ roster: [selfMember()] }));

    // A dropped socket is an abrupt close: the accepted grace/rejoin path applies.
    wire.emitStatus('disconnected');
    fake.pageLifecycle.emit(false);
    expect(wire.sent).toEqual([]);

    // dispose() alone never sends `leave`: a StrictMode/remount teardown keeps the grace.
    session.dispose();
    expect(wire.sent).toEqual([]);
    expect(fake.pageLifecycle.unsubscribeCount()).toBe(1);
  });

  it('ignores a pagehide callback that escapes after dispose', () => {
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember()] }));
    const escaped = fake.pageLifecycle.callbacks()[0]!;

    session.dispose();
    escaped(false);

    expect(wire.sent).toEqual([]);
  });

  it('swallows a throwing socket send: no other frame, handler completes, teardown unaffected', () => {
    vi.useFakeTimers();
    const fake = createFakeEnv();
    const wire = createFakeTransport({ throwOnSend: true });
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember()] }));
    expect(vi.getTimerCount()).toBe(1);

    // The fake send records the attempted frame and throws, like a CLOSING/CLOSED socket.
    fake.pageLifecycle.emit(false);
    expect(wire.sent).toEqual([{ type: 'leave' }]);

    // The unload handler completed: teardown still unsubscribes and clears every timer.
    session.dispose();
    expect(wire.messageHandlerCount()).toBe(0);
    expect(wire.statusHandlerCount()).toBe(0);
    expect(fake.pageLifecycle.unsubscribeCount()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('attaches and stays silent when the environment has no page-lifecycle source', () => {
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const env: SessionEnvironment = { ...fake.env };
    delete env.pageLifecycle;
    const session = createGameSession({ env, transport: wire.transport });
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember()] }));

    fake.pageLifecycle.emit(false);

    expect(wire.sent).toEqual([]);
    expect(fake.pageLifecycle.subscribeCount()).toBe(0);
    session.dispose();
  });
});

describe('activity display expiry in the session (AC-14, AC-15, AC-16, AC-17, AC-18)', () => {
  const SESSION_JOIN: ActivityEvent = {
    id: 1,
    at: 1000,
    serverId: 1,
    type: 'memberJoined',
    playerId: 'p2',
    name: 'Player 2',
  };

  const SESSION_CLEAR: ActivityEvent = {
    id: 2,
    at: 2000,
    serverId: 1,
    type: 'cubeCleared',
    playerId: 'p2',
    name: 'Player 2',
    level: 3,
  };

  const TARGET_JOIN: ActivityEvent = {
    id: 1,
    at: 4000,
    serverId: 2,
    type: 'memberJoined',
    playerId: 'p3',
    name: 'Player 3',
  };

  const TARGET_CLEAR: ActivityEvent = {
    id: 2,
    at: 5000,
    serverId: 2,
    type: 'cubeCleared',
    playerId: 'p3',
    name: 'Player 3',
    level: 6,
  };

  it('expires a live event exactly 5000 ms after local receipt (AC-14)', () => {
    vi.useFakeTimers();
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');

    fake.clock.now = 0;
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    wire.emit({ type: 'activityEvent', event: SESSION_JOIN });
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([SESSION_JOIN]);

    fake.clock.now = 4999;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS);
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([SESSION_JOIN]);

    fake.clock.now = 5000;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS);
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([]);

    session.dispose();
  });

  it('expires the current feed at 5000 and the pending feed at 6000/8000 across the travel midpoint (AC-15)', () => {
    vi.useFakeTimers();
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');

    // t = 0: the welcome seeds the current feed with e1 and starts the real level travel.
    fake.clock.now = 0;
    wire.emit(welcomeMessage({ roster: [selfMember(), member()], activity: [SESSION_JOIN] }));
    fake.scheduler.tick(0);
    tapOn(fake.canvas, 400, 400);
    fake.scheduler.tick(16);
    for (const faceId of FACE_IDS) {
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          if (faceId !== 'front' || row !== 2 || col !== 2) {
            engine.dispatch({ type: 'explodeMiniCube', id: `${faceId}:${row}:${col}` });
          }
        }
      }
    }
    fake.clock.now = 1000;
    tapOn(fake.canvas, 400, 400);
    fake.scheduler.tick(416);
    expect(session.getSnapshot().phase).toBe('travel');

    // t = 1000: worldEntered seeds the pending target feed with e2. No welcome follows.
    wire.emit(
      worldEnteredMessage({
        activity: [TARGET_JOIN],
        roster: [
          selfMember({ position: { x: 0, y: 24 }, levelIndex: 1, gridSize: 4 }),
          member({ playerId: 'p3', name: 'Player 3', position: { x: 24, y: 0 } }),
        ],
      }),
    );
    const duringTravel = session.getMultiplayerSnapshot().world;
    expect(duringTravel.activity).toEqual([SESSION_JOIN]);
    expect(duringTravel.pendingWorldSwap!.serverId).toBe(2);
    expect(duringTravel.pendingWorldSwap!.activity).toEqual([TARGET_JOIN]);

    // t = 3000: a live target event e3 is prepended to the pending feed only.
    fake.clock.now = 3000;
    wire.emit({ type: 'activityEvent', event: TARGET_CLEAR });
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([SESSION_JOIN]);
    expect(session.getMultiplayerSnapshot().world.pendingWorldSwap!.activity).toEqual([
      TARGET_CLEAR,
      TARGET_JOIN,
    ]);

    // t = 4999: e1 is still current, e2/e3 still pending.
    fake.clock.now = 4999;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS);
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([SESSION_JOIN]);
    expect(session.getMultiplayerSnapshot().world.pendingWorldSwap!.activity).toEqual([
      TARGET_CLEAR,
      TARGET_JOIN,
    ]);

    // t = 5000: e1 leaves the current feed; the pending feed is untouched.
    fake.clock.now = 5000;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS);
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([]);
    expect(session.getMultiplayerSnapshot().world.pendingWorldSwap!.activity).toEqual([
      TARGET_CLEAR,
      TARGET_JOIN,
    ]);

    // t = 6000: e2 leaves the pending feed; e3 remains.
    fake.clock.now = 6000;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS);
    expect(session.getMultiplayerSnapshot().world.pendingWorldSwap!.activity).toEqual([
      TARGET_CLEAR,
    ]);

    // t = 7000: the midpoint swap makes server 2 current; e3 keeps its 8000 deadline.
    fake.clock.now = 7000;
    fake.scheduler.tick(1666);
    const swapped = session.getMultiplayerSnapshot().world;
    expect(swapped.serverId).toBe(2);
    expect(swapped.pendingWorldSwap).toBeNull();
    expect(swapped.activity).toEqual([TARGET_CLEAR]);

    // t = 8000: e3 leaves the current feed.
    fake.clock.now = 8000;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS);
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([]);

    session.dispose();
  });

  it('keeps the remaining lifetime across a same-server rejoin and anchors new ids at receipt (AC-16)', () => {
    vi.useFakeTimers();
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');

    // t = 0: e1 gets a 5000 deadline.
    fake.clock.now = 0;
    wire.emit(welcomeMessage({ roster: [selfMember(), member()], activity: [SESSION_JOIN] }));

    // t = 1000: the socket drops abruptly — no reduction, the world keeps the event.
    fake.clock.now = 1000;
    wire.emitStatus('disconnected');
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([SESSION_JOIN]);

    // t = 4000: a same-server rejoin welcome re-seeds e1 and a new id 2. No pending swap.
    fake.clock.now = 4000;
    wire.emitStatus('connected');
    wire.emit(
      welcomeMessage({ roster: [selfMember(), member()], activity: [SESSION_CLEAR, SESSION_JOIN] }),
    );
    const rejoined = session.getMultiplayerSnapshot().world;
    expect(rejoined.pendingWorldSwap).toBeNull();
    expect(rejoined.activity).toEqual([SESSION_CLEAR, SESSION_JOIN]);

    // e1 keeps its 5000 deadline (not extended to 9000); e2 is anchored at 9000.
    fake.clock.now = 4999;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS);
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([
      SESSION_CLEAR,
      SESSION_JOIN,
    ]);

    fake.clock.now = 5000;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS);
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([SESSION_CLEAR]);

    fake.clock.now = 8999;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS);
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([SESSION_CLEAR]);

    fake.clock.now = 9000;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS);
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([]);

    session.dispose();
  });

  it('filters a locally expired re-seed synchronously on the next reduction, before any tick (AC-17)', () => {
    vi.useFakeTimers();
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');

    // t = 0: e1 current; t = 5000: expired and tombstoned.
    fake.clock.now = 0;
    wire.emit(welcomeMessage({ roster: [selfMember(), member()], activity: [SESSION_JOIN] }));
    fake.clock.now = 5000;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS);
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([]);

    // Every publish from here on is recorded: an expired seed must never appear, not even
    // for one tick.
    const publishedFeeds: ActivityEvent[][] = [];
    session.subscribeMultiplayer(() => {
      publishedFeeds.push(session.getMultiplayerSnapshot().world.activity);
    });

    // t = 5001: the same-server welcome re-seeds e1. No timer runs; the reduction's
    // synchronous prune filters the tombstoned key before the handler publish.
    fake.clock.now = 5001;
    wire.emit(welcomeMessage({ roster: [selfMember(), member()], activity: [SESSION_JOIN] }));
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([]);
    expect(publishedFeeds).toEqual([[]]);

    // Any other reduction (a re-delivered live frame) is filtered the same way.
    wire.emit({ type: 'activityEvent', event: SESSION_JOIN });
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([]);

    // The feed stays empty through the tombstone window.
    fake.clock.now = 6000;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS);
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([]);

    fake.clock.now = 9999;
    wire.emit(welcomeMessage({ roster: [selfMember(), member()], activity: [SESSION_JOIN] }));
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([]);

    // t = 10000: the tombstone (observed expiry 5000 + 5000) is released; the seed is fresh.
    fake.clock.now = 10000;
    wire.emit(welcomeMessage({ roster: [selfMember(), member()], activity: [SESSION_JOIN] }));
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([SESSION_JOIN]);

    fake.clock.now = 15000;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS);
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([]);

    // A different server drops server 1's keys; its own id 1 is tracked independently.
    fake.clock.now = 15001;
    wire.emit(
      welcomeMessage({ serverId: 2, roster: [selfMember()], activity: [TARGET_JOIN] }),
    );
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([TARGET_JOIN]);

    fake.clock.now = 20000;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS);
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([TARGET_JOIN]);

    fake.clock.now = 20001;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS);
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([]);

    session.dispose();
  });

  it('owns one 250 ms fallback interval per online attach cycle and clears it on dispose (AC-18)', () => {
    vi.useFakeTimers();
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);
    expect(vi.getTimerCount()).toBe(1);

    session.dispose();
    expect(vi.getTimerCount()).toBe(0);

    session.attach(fake.canvas.surface);
    expect(vi.getTimerCount()).toBe(1);

    session.dispose();
    expect(vi.getTimerCount()).toBe(0);

    // Offline sessions have no activity feed to prune, so they schedule no interval.
    const offline = attachSession(createFakeEnv());
    expect(vi.getTimerCount()).toBe(0);
    offline.dispose();
  });

  it('publishes nothing while no line is expiring (AC-18)', () => {
    vi.useFakeTimers();
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember()] }));

    const publishes: number[] = [];
    session.subscribeMultiplayer(() => {
      publishes.push(fake.clock.now);
    });

    // Four fallback ticks with an empty feed: no publish, no state change.
    fake.clock.now = 250;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS * 4);
    expect(publishes).toEqual([]);

    session.dispose();
  });

  it('prunes immediately when the tab becomes visible, before the next frame (AC-18)', () => {
    vi.useFakeTimers();
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    fake.clock.now = 0;
    wire.emit(welcomeMessage({ roster: [selfMember(), member()], activity: [SESSION_JOIN] }));
    fake.scheduler.tick(0);

    fake.visibility.emit(true);
    expect(fake.scheduler.pending()).toBe(0);

    // A throttled background tab: only the local clock passes, no fallback tick runs.
    fake.clock.now = 5000;
    const publishes: number[] = [];
    session.subscribeMultiplayer(() => {
      publishes.push(fake.clock.now);
    });

    fake.visibility.emit(false);

    expect(session.getMultiplayerSnapshot().world.activity).toEqual([]);
    expect(publishes).toEqual([5000]);
    expect(fake.scheduler.pending()).toBe(1);

    session.dispose();
  });

  it('runs no callback, publish or state change after dispose (AC-18)', () => {
    vi.useFakeTimers();
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    fake.clock.now = 0;
    wire.emit(welcomeMessage({ roster: [selfMember(), member()], activity: [SESSION_JOIN] }));
    const escapedVisibility = fake.visibility.callbacks()[0]!;
    const escapedPageHide = fake.pageLifecycle.callbacks()[0]!;

    session.dispose();
    expect(vi.getTimerCount()).toBe(0);

    let publishes = 0;
    session.subscribeMultiplayer(() => {
      publishes += 1;
    });
    fake.clock.now = 20000;
    vi.advanceTimersByTime(ACTIVITY_EXPIRY_TICK_MS * 40);
    escapedVisibility(false);
    escapedPageHide(false);

    // The disposed session keeps its last published world: no late prune, publish or send.
    expect(session.getMultiplayerSnapshot().world.activity).toEqual([SESSION_JOIN]);
    expect(publishes).toBe(0);
    expect(wire.sent).toEqual([]);
    expect(fake.scheduler.pending()).toBe(0);
  });
});

describe('live leaderboard over the wire (AC-15, AC-19)', () => {
  /** The browser WebSocket surface the real transport drives (same shape as above). */
  class FakeLeaderboardSocket {
    onopen: (() => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;

    readonly sent: string[] = [];

    constructor(readonly url: string) {}

    send(text: string): void {
      this.sent.push(text);
    }

    close(): void {}

    emitOpen(): void {
      this.onopen?.();
    }

    emitMessage(data: unknown): void {
      this.onmessage?.({ data });
    }
  }

  const CURRENT_LEADERBOARD: LeaderboardSnapshot = {
    serverId: 1,
    at: 1000,
    entries: [
      { playerId: 'p2', name: 'Player 2', cubesCompleted: 2, clicks: 40 },
      { playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 3 },
    ],
    totals: { cubesCompleted: 2, clicks: 43, facesDestroyed: 3 },
  };

  const UPDATE_LEADERBOARD: LeaderboardSnapshot = {
    serverId: 1,
    at: 2000,
    entries: [
      { playerId: 'p2', name: 'Player 2', cubesCompleted: 2, clicks: 41 },
      { playerId: 'p1', name: 'Player 1', cubesCompleted: 0, clicks: 3 },
    ],
    totals: { cubesCompleted: 2, clicks: 44, facesDestroyed: 3 },
  };

  const TARGET_LEADERBOARD: LeaderboardSnapshot = {
    serverId: 2,
    at: 1200,
    entries: [{ playerId: 'p3', name: 'Player 3', cubesCompleted: 1, clicks: 10 }],
    totals: { cubesCompleted: 1, clicks: 10, facesDestroyed: 2 },
  };

  const TARGET_LEADERBOARD_NEXT: LeaderboardSnapshot = {
    serverId: 2,
    at: 2200,
    entries: [
      { playerId: 'p3', name: 'Player 3', cubesCompleted: 3, clicks: 30 },
      { playerId: 'p1', name: 'Player 1', cubesCompleted: 1, clicks: 9 },
    ],
    totals: { cubesCompleted: 4, clicks: 39, facesDestroyed: 5 },
  };

  it('passes the exact welcome.leaderboard and leaderboardUpdate frames through the real decoder and reducer', () => {
    const recording = createFakeEngine(snapshot({ phase: 'playing' }));
    const fake = createFakeEnv();
    const sockets: FakeLeaderboardSocket[] = [];
    const transport = createTransport({
      url: 'ws://test.local/ws',
      socketFactory: (url) => {
        const socket = new FakeLeaderboardSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });
    const session = createGameSession({ env: fake.env, engine: recording.engine, transport });
    session.attach(fake.canvas.surface);

    const socket = sockets[0]!;
    socket.emitOpen();
    session.join('guest');
    socket.emitMessage('{"type":"hello","serverTime":"2026-11-16T00:00:00.000Z"}');
    socket.emitMessage(
      JSON.stringify(
        welcomeMessage({ roster: [selfMember(), member()], leaderboard: CURRENT_LEADERBOARD }),
      ),
    );

    expect(session.getMultiplayerSnapshot().world.leaderboard).toEqual(CURRENT_LEADERBOARD);

    // The exact backend builder frame replaces the current snapshot.
    socket.emitMessage(JSON.stringify(leaderboardUpdateMessage(UPDATE_LEADERBOARD)));
    expect(session.getMultiplayerSnapshot().world.leaderboard).toEqual(UPDATE_LEADERBOARD);
    expect(session.getMultiplayerSnapshot().world.serverId).toBe(1);

    // A leaderboard frame carries no engine or scene action.
    expect(recording.events).toEqual([]);

    // A malformed over-long frame is dropped by the real decoder with no state change.
    const stable = session.getMultiplayerSnapshot();
    const sixEntries = Array.from({ length: 6 }, (_, index) => ({
      playerId: `p${index + 1}`,
      name: `Player ${index + 1}`,
      cubesCompleted: index,
      clicks: index * 10,
    }));
    socket.emitMessage(
      JSON.stringify({
        type: 'leaderboardUpdate',
        leaderboard: { ...UPDATE_LEADERBOARD, entries: sixEntries },
      }),
    );
    expect(session.getMultiplayerSnapshot()).toBe(stable);

    // A snapshot for another server is rejected by the reducer with no state change.
    socket.emitMessage(
      JSON.stringify(leaderboardUpdateMessage({ ...UPDATE_LEADERBOARD, serverId: 9 })),
    );
    expect(session.getMultiplayerSnapshot()).toBe(stable);

    // A repeated identical snapshot returns the same store reference.
    socket.emitMessage(JSON.stringify(leaderboardUpdateMessage(UPDATE_LEADERBOARD)));
    expect(session.getMultiplayerSnapshot()).toBe(stable);
    expect(recording.events).toEqual([]);

    session.dispose();
  });

  it('routes the target update during travel and applies it at the midpoint swap', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()], leaderboard: CURRENT_LEADERBOARD }));
    fake.scheduler.tick(0);
    tapOn(fake.canvas, 400, 400);
    fake.scheduler.tick(16);

    for (const faceId of FACE_IDS) {
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          if (faceId !== 'front' || row !== 2 || col !== 2) {
            engine.dispatch({ type: 'explodeMiniCube', id: `${faceId}:${row}:${col}` });
          }
        }
      }
    }
    tapOn(fake.canvas, 400, 400);
    fake.scheduler.tick(416);
    expect(session.getSnapshot().phase).toBe('travel');

    wire.emit(
      worldEnteredMessage({
        leaderboard: TARGET_LEADERBOARD,
        roster: [
          selfMember({ position: { x: 0, y: 24 }, levelIndex: 1, gridSize: 4 }),
          member({ playerId: 'p3', name: 'Player 3', position: { x: 24, y: 0 } }),
        ],
      }),
    );

    // The target update arrives before the travel midpoint: it joins the pending swap only.
    wire.emit(leaderboardUpdateMessage(TARGET_LEADERBOARD_NEXT));
    const duringTravel = session.getMultiplayerSnapshot().world;
    expect(duringTravel.leaderboard).toEqual(CURRENT_LEADERBOARD);
    expect(duringTravel.pendingWorldSwap!.leaderboard).toEqual(TARGET_LEADERBOARD_NEXT);

    // An old-server update during travel applies to the current snapshot, never the pending one.
    wire.emit(leaderboardUpdateMessage(UPDATE_LEADERBOARD));
    const withOld = session.getMultiplayerSnapshot().world;
    expect(withOld.leaderboard).toEqual(UPDATE_LEADERBOARD);
    expect(withOld.pendingWorldSwap!.leaderboard).toEqual(TARGET_LEADERBOARD_NEXT);

    fake.scheduler.tick(1666); // midpoint: the pending world (and its ranking) becomes current
    const swapped = session.getMultiplayerSnapshot().world;
    expect(swapped.serverId).toBe(2);
    expect(swapped.leaderboard).toEqual(TARGET_LEADERBOARD_NEXT);
    expect(swapped.pendingWorldSwap).toBeNull();

    session.dispose();
  });
});

describe('authoritative cube adoption over the wire (AC-14, AC-22)', () => {
  /** A connected online session on the real engine, playing after the intro skip. */
  function playingSession(reducedMotion = false): {
    engine: GameEngine;
    fake: FakeEnv;
    wire: FakeTransport;
    session: OnlineGameSession;
  } {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom, reducedMotion });
    const fake = createFakeEnv({ reducedMotion });
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    fake.scheduler.tick(0);
    tapOn(fake.canvas, 400, 400); // intro skip
    fake.scheduler.tick(16);
    return { engine, fake, wire, session };
  }

  it('restores a locally removed tile the server still has and forwards the next tap again', () => {
    const { fake, wire, session } = playingSession();

    tapOn(fake.canvas, 400, 400);
    expect(session.getSnapshot().stats.clicks).toBe(1); expect(session.getSnapshot().stats.facesDestroyed).toBe(0);
    expect(faceIds(session.getSnapshot(), 'front')).toHaveLength(24);
    expect(wire.sent).toEqual([{ type: 'explode', id: 'front:2:2', level: 0 }]);

    // The server still has the tile this client exploded (a rejected/lost click): the sync
    // must put it back, not leave the local extra in place.
    wire.emit(stateSyncMessage({ removedIds: [] }));

    const restored = session.getSnapshot();
    expect(restored.stats.clicks).toBe(1); expect(restored.stats.facesDestroyed).toBe(0);
    expect(faceIds(restored, 'front')).toHaveLength(25);
    expect(faceIds(restored, 'front')).toContain('front:2:2');
    expect(wire.sent).toEqual([{ type: 'explode', id: 'front:2:2', level: 0 }]);

    fake.scheduler.tick(32);
    // The rebuild recreated the tile: the instance is visible at its cell again.
    const restoredFront = faceMesh(fake.renderer.renders.at(-1)!.scene, 'front');
    const restoredTile = instanceMatrix(restoredFront, 12);
    expect(restoredTile.elements[0]).toBe(Math.fround(0.95));
    expect(new Vector3().setFromMatrixPosition(restoredTile).toArray()).toEqual([0, 0, 2.625]);

    // The restored tile is playable again and forwards the same optimistic message.
    tapOn(fake.canvas, 400, 400);
    expect(session.getSnapshot().stats.clicks).toBe(2); expect(session.getSnapshot().stats.facesDestroyed).toBe(0);
    expect(wire.sent).toEqual([
      { type: 'explode', id: 'front:2:2', level: 0 },
      { type: 'explode', id: 'front:2:2', level: 0 },
    ]);
  });

  it('removes the authoritative ids of a stateSync exactly and never echoes them', () => {
    const { fake, wire, session } = playingSession(true);

    wire.emit(stateSyncMessage({ removedIds: ['front:0:0', 'front:0:1'] }));

    const synced = session.getSnapshot();
    expect(synced.stats).toEqual({ clicks: 2, facesDestroyed: 0 });
    expect(faceIds(synced, 'front')).toEqual([
      'front:0:2',
      'front:0:3',
      'front:0:4',
      'front:1:0',
      'front:1:1',
      'front:1:2',
      'front:1:3',
      'front:1:4',
      'front:2:0',
      'front:2:1',
      'front:2:2',
      'front:2:3',
      'front:2:4',
      'front:3:0',
      'front:3:1',
      'front:3:2',
      'front:3:3',
      'front:3:4',
      'front:4:0',
      'front:4:1',
      'front:4:2',
      'front:4:3',
      'front:4:4',
    ]);
    // Authoritative removals are never forwarded back to the server.
    expect(wire.sent).toEqual([]);

    fake.scheduler.tick(32);
    expect(faceMesh(fake.renderer.renders.at(-1)!.scene, 'front').count).toBe(25);
    // The drained intent hides the tile: after its 160 ms pop the instance is zero-scaled.
    fake.scheduler.tick(192);
    const hidden = instanceMatrix(faceMesh(fake.renderer.renders.at(-1)!.scene, 'front'), 0);
    expect([hidden.elements[0], hidden.elements[5], hidden.elements[10]]).toEqual([0, 0, 0]);
    expect(new Vector3().setFromMatrixPosition(hidden).toArray()).toEqual([-2, 2, 2.625]);

    // A duplicate sync is a no-op: the same snapshot object and no extra intents.
    const before = session.getSnapshot();
    wire.emit(stateSyncMessage({ removedIds: ['front:0:0', 'front:0:1'] }));
    expect(session.getSnapshot()).toBe(before);
    expect(wire.sent).toEqual([]);
  });

  it('adopts a different level, grid and style from stateSync exactly (AC-14)', () => {
    const { fake, wire, session } = playingSession(true);

    tapOn(fake.canvas, 400, 400);
    expect(session.getSnapshot().stats.clicks).toBe(1); expect(session.getSnapshot().stats.facesDestroyed).toBe(0);
    wire.emit(
      stateSyncMessage({
        levelIndex: 1,
        gridSize: 4,
        styleId: 'crimson-alloy',
        removedIds: ['front:1:1'],
      }),
    );

    const synced = session.getSnapshot();
    expect(synced.levelIndex).toBe(1);
    expect(synced.gridSize).toBe(4);
    expect(synced.style.id).toBe('crimson-alloy');
    // Stats are session-local: the fresh cube never rolls the previous clicks back.
    expect(synced.stats.clicks).toBe(1); expect(synced.stats.facesDestroyed).toBe(0);
    expect(synced.travelKind).toBeNull();
    expect(synced.board.faces.map((face) => face.miniCubes.length)).toEqual([
      15, 16, 16, 16, 16, 16,
    ]);
    expect(faceIds(synced, 'front')).toHaveLength(15);
    expect(faceIds(synced, 'front')).not.toContain('front:1:1');
    expect(wire.sent).toEqual([{ type: 'explode', id: 'front:2:2', level: 0 }]);

    // Frame one drains the rebuild (the fresh view is fully visible); frame two replays the
    // authoritative removal, and once its pop elapses the instance is zero-scaled.
    fake.scheduler.tick(32);
    const rebuilt = fake.renderer.renders.at(-1)!.scene;
    expect(faceMesh(rebuilt, 'front').count).toBe(16);
    fake.scheduler.tick(48);
    fake.scheduler.tick(208);
    const rendered = fake.renderer.renders.at(-1)!.scene;
    const hidden = instanceMatrix(faceMesh(rendered, 'front'), 5);
    expect([hidden.elements[0], hidden.elements[5], hidden.elements[10]]).toEqual([0, 0, 0]);
    expect(new Vector3().setFromMatrixPosition(hidden).toArray()).toEqual([-0.625, 0.625, 2.625]);
    const visible = instanceMatrix(faceMesh(rendered, 'front'), 0);
    expect(visible.elements[0]).toBe(Math.fround(1.1875));
    expect(faceMesh(rendered, 'top').count).toBe(16);
  });

  it('adopts a fresh level-0 cube when a resume fails and the client rejoins as a new identity', () => {
    const { engine, fake, wire, session } = playingSession();

    // Finish level 0 through the real level advance so the client holds a level-1 cube.
    clearLevel(engine, 5);
    fake.scheduler.tick(416);
    expect(session.getSnapshot().phase).toBe('travel');
    expect(session.getSnapshot().travelKind).toBe('nextLevel');
    wire.emit(levelAdvancedMessage({ gridSize: 4, styleId: 'crimson-alloy' }));
    fake.scheduler.tick(1666); // midpoint
    fake.scheduler.tick(2916); // landed
    expect(session.getSnapshot().phase).toBe('playing');
    expect(session.getSnapshot().levelIndex).toBe(1);
    expect(session.getSnapshot().gridSize).toBe(4);
    expect(session.getSnapshot().stats.clicks).toBe(150); expect(session.getSnapshot().stats.facesDestroyed).toBe(6);

    // `resume_failed` is transport-level: the session sees a new identity's `welcome`, which
    // restarts it at level 0 on a full cube with the old stats.
    wire.emitStatus('disconnected');
    wire.emitStatus('connected');
    wire.emit(
      welcomeMessage({
        playerId: 'p3',
        name: 'Player 3',
        roster: [
          selfMember({ playerId: 'p3', name: 'Player 3' }),
          member({ playerId: 'p2', name: 'Player 2' }),
        ],
      }),
    );

    const rejoined = session.getSnapshot();
    expect(rejoined.phase).toBe('playing');
    expect(rejoined.levelIndex).toBe(0);
    expect(rejoined.gridSize).toBe(5);
    expect(rejoined.style.id).toBe('obsidian-neon');
    expect(rejoined.stats.clicks).toBe(150); expect(rejoined.stats.facesDestroyed).toBe(6);
    expect(rejoined.board.faces.map((face) => face.miniCubes.length)).toEqual([
      25, 25, 25, 25, 25, 25,
    ]);
    expect(rejoined.travelKind).toBeNull();
    expect(session.getMultiplayerSnapshot().world.self.playerId).toBe('p3');

    fake.scheduler.tick(2948);
    expect(faceMesh(fake.renderer.renders.at(-1)!.scene, 'front').count).toBe(25);

    // The fresh cube is playable at level 0 and the wire carries the new level.
    tapOn(fake.canvas, 400, 400);
    expect(session.getSnapshot().stats.clicks).toBe(151); expect(session.getSnapshot().stats.facesDestroyed).toBe(6);
    expect(wire.sent).toEqual([{ type: 'explode', id: 'front:2:2', level: 0 }]);
  });

  it('releases the held nextLevel travel when a resume welcome answers the completion (F2)', () => {
    const { engine, fake, wire, session } = playingSession();

    // One tile left on the whole cube: the next tap is the sixth face and sends the completion.
    for (const faceId of FACE_IDS) {
      for (let row = 0; row < 5; row += 1) {
        for (let col = 0; col < 5; col += 1) {
          if (faceId !== 'front' || row !== 2 || col !== 2) {
            engine.dispatch({ type: 'explodeMiniCube', id: `${faceId}:${row}:${col}` });
          }
        }
      }
    }
    tapOn(fake.canvas, 400, 400);
    expect(wire.sent).toEqual([
      { type: 'explode', id: 'front:2:2', level: 0 },
      { type: 'cubeCompleted', level: 0 },
    ]);

    fake.scheduler.tick(416); // the face fade elapsed: the online travel runs held
    const held = session.getSnapshot();
    expect(held.phase).toBe('travel');
    expect(held.travelKind).toBe('nextLevel');
    expect(held.phaseProgress).toBe(0);

    // The socket drops before the server answers; a resume restores the same identity but
    // the completion is over: the authoritative cube must release the non-cancellable hold.
    wire.emitStatus('disconnected');
    wire.emitStatus('connected');
    wire.emit(
      welcomeMessage({
        levelIndex: 1,
        gridSize: 4,
        styleId: 'crimson-alloy',
        roster: [
          selfMember({ levelIndex: 1, gridSize: 4, styleId: 'crimson-alloy' }),
          member(),
        ],
      }),
    );

    const resumed = session.getSnapshot();
    expect(resumed.phase).toBe('playing');
    expect(resumed.phaseProgress).toBe(1);
    expect(resumed.travelKind).toBeNull();
    expect(resumed.travelDestination).toBeNull();
    expect(resumed.levelIndex).toBe(1);
    expect(resumed.gridSize).toBe(4);
    expect(resumed.style.id).toBe('crimson-alloy');
    expect(resumed.stats.clicks).toBe(150); expect(resumed.stats.facesDestroyed).toBe(6);
    expect(resumed.board.faces.map((face) => face.miniCubes.length)).toEqual([
      16, 16, 16, 16, 16, 16,
    ]);
    expect(session.getMultiplayerSnapshot().world.self.cube).toEqual({
      levelIndex: 1,
      gridSize: 4,
      styleId: 'crimson-alloy',
      removedIds: [],
      yawSteps: 0,
      pitchSteps: 0,
    });

    // The released hold never flies: the old 2500 ms window leaves the session playing.
    fake.scheduler.tick(2916);
    expect(session.getSnapshot().phase).toBe('playing');
    expect(session.getSnapshot().levelIndex).toBe(1);
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([0, 0, 12]);

    // Play is live on the adopted 4×4 cube: the quarter-offset tap hits front:1:1.
    tapOn(fake.canvas, 362, 362);
    expect(session.getSnapshot().stats.clicks).toBe(151); expect(session.getSnapshot().stats.facesDestroyed).toBe(6);
    expect(wire.sent).toEqual([
      { type: 'explode', id: 'front:2:2', level: 0 },
      { type: 'cubeCompleted', level: 0 },
      { type: 'explode', id: 'front:1:1', level: 1 },
    ]);
  });
});

describe('multiplayer spectate (AC-18, AC-19)', () => {
  function spectateSetup(): {
    fake: FakeEnv;
    wire: FakeTransport;
    session: OnlineGameSession;
  } {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    fake.scheduler.tick(0);
    tapOn(fake.canvas, 400, 400); // intro skip
    fake.scheduler.tick(16);
    return { fake, wire, session };
  }

  it('flies to a member, gates play while viewing, and flies home on return', () => {
    const { fake, session } = spectateSetup();

    expect(session.spectateMember('p2')).toBe(true);
    expect(session.getMultiplayerSnapshot().spectate).toEqual({
      mode: 'traveling',
      target: 'p2',
      destination: { x: 24, y: 0 },
    });
    const flight = session.getSnapshot();
    expect(flight.phase).toBe('travel');
    expect(flight.travelKind).toBe('spectate');
    expect(flight.travelDestination).toEqual({ x: 24, y: 0 });
    expect(flight.phaseProgress).toBe(0);
    // One travel at a time: a second selection and a mid-flight return are refused.
    expect(session.spectateMember('p2')).toBe(false);
    expect(session.returnToOwnCube()).toBe(false);

    fake.scheduler.tick(1266);
    expect(session.getSnapshot().phaseProgress).toBe(0.5);
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([12, 0, 90]);
    expect(session.getSnapshot().levelIndex).toBe(0);

    fake.scheduler.tick(2516);
    expect(session.getSnapshot().phase).toBe('playing');
    expect(session.getSnapshot().spectating).toBe(true);
    expect(session.getMultiplayerSnapshot().spectate).toEqual({ mode: 'viewing', target: 'p2' });
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([24, 0, 12]);
    // Gameplay is view-only while spectating: taps and rotations dispatch nothing.
    tapOn(fake.canvas, 400, 400);
    fake.keys.emitKey('ArrowRight');
    expect(session.getSnapshot().stats.clicks).toBe(0);
    expect(session.getSnapshot().orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });

    expect(session.returnToOwnCube()).toBe(true);
    expect(session.getMultiplayerSnapshot().spectate).toEqual({
      mode: 'returning',
      destination: { x: 0, y: 0 },
    });
    expect(session.getSnapshot().travelKind).toBe('return');
    expect(session.getSnapshot().travelDestination).toEqual({ x: 0, y: 0 });

    fake.scheduler.tick(3766);
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([12, 0, 90]);
    fake.scheduler.tick(5016);
    expect(session.getSnapshot().phase).toBe('playing');
    expect(session.getSnapshot().spectating).toBe(false);
    expect(session.getMultiplayerSnapshot().spectate).toEqual({ mode: 'none' });
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([0, 0, 12]);

    // Home again: the same tap explodes the centre tile.
    tapOn(fake.canvas, 400, 400);
    expect(session.getSnapshot().stats.clicks).toBe(1);
  });

  it('gates touch taps and drags exactly like mouse during travel and view-only (AC-11)', () => {
    const { fake, wire, session } = spectateSetup();
    expect(session.spectateMember('p2')).toBe(true);

    // Spectate travel: the phase gate drops pointer input before any dispatch.
    const traveling = session.getSnapshot();
    expect(traveling.phase).toBe('travel');
    expect(traveling.travelKind).toBe('spectate');
    touchTapOn(fake.canvas, 400, 400);
    touchDragOn(fake.canvas, { x: 100, y: 100 }, { x: 220, y: 100 });
    fake.keys.emitKey('ArrowRight');
    expect(session.getSnapshot()).toBe(traveling);
    expect(session.getSnapshot().stats.clicks).toBe(0);
    expect(session.getSnapshot().orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(wire.sent).toEqual([]);

    fake.scheduler.tick(2516);
    expect(session.getSnapshot().spectating).toBe(true);
    expect(session.getMultiplayerSnapshot().spectate).toEqual({ mode: 'viewing', target: 'p2' });

    // View-only: the engine's spectating gate drops the same touch gestures, exactly as
    // it drops the mouse tap and the keyboard step.
    const viewing = session.getSnapshot();
    touchTapOn(fake.canvas, 400, 400);
    touchDragOn(fake.canvas, { x: 400, y: 400 }, { x: 400, y: 520 });
    fake.keys.emitKey('ArrowLeft');
    expect(session.getSnapshot()).toBe(viewing);
    expect(session.getSnapshot().stats.clicks).toBe(0);
    expect(session.getSnapshot().orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(wire.sent).toEqual([]);

    // Home again: the very same touch tap now explodes the front-face centre, proving the
    // gestures above were gated by the phase and not by their pointer type.
    expect(session.returnToOwnCube()).toBe(true);
    fake.scheduler.tick(5016);
    expect(session.getSnapshot().phase).toBe('playing');
    expect(session.getSnapshot().spectating).toBe(false);
    touchTapOn(fake.canvas, 400, 400);
    expect(session.getSnapshot().stats.clicks).toBe(1);
    expect(wire.sent).toEqual([{ type: 'explode', id: 'front:2:2', level: 0 }]);
  });

  it('keeps viewing the target when their same-server cube advances (AC-19 c)', () => {
    const { fake, wire, session } = spectateSetup();
    expect(session.spectateMember('p2')).toBe(true);
    fake.scheduler.tick(1016);
    fake.scheduler.tick(2516);
    expect(session.getMultiplayerSnapshot().spectate).toEqual({ mode: 'viewing', target: 'p2' });
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([24, 0, 12]);

    wire.emit(
      levelAdvancedMessage({
        playerId: 'p2',
        levelIndex: 2,
        gridSize: 6,
        styleId: CUBE_STYLES[2]!.id,
        position: { x: 24, y: 0 },
      }),
    );

    // A remote same-server advance never moves the spectator: no travel starts and the
    // own cube/board/stats are untouched.
    expect(session.getMultiplayerSnapshot().spectate).toEqual({ mode: 'viewing', target: 'p2' });
    expect(session.getSnapshot().spectating).toBe(true);
    expect(session.getSnapshot().phase).toBe('playing');
    expect(session.getSnapshot().travelKind).toBeNull();
    expect(session.getSnapshot().travelDestination).toBeNull();
    expect(session.getSnapshot().levelIndex).toBe(0);
    expect(session.getSnapshot().gridSize).toBe(5);
    expect(session.getSnapshot().stats).toEqual({ clicks: 0, facesDestroyed: 0 });
    expect(session.getMultiplayerSnapshot().world.members).toEqual([
      {
        playerId: 'p2',
        name: 'Player 2',
        position: { x: 24, y: 0 },
        levelIndex: 2,
        gridSize: 6,
        styleId: 'emerald-crystal',
        removedIds: [],
        yawSteps: 0,
        pitchSteps: 0,
        appearance: {},
      },
    ]);

    // The next frame still rests over the target's cube.
    fake.scheduler.tick(2532);
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([24, 0, 12]);
    expect(session.getSnapshot().phase).toBe('playing');
    expect(wire.sent).toEqual([]);
  });

  it('auto-returns with the flight when the viewed member leaves (AC-19 a/b)', () => {
    const { fake, wire, session } = spectateSetup();
    expect(session.spectateMember('p2')).toBe(true);
    fake.scheduler.tick(1016); // mid-flight: the scene captures the target rest pose
    fake.scheduler.tick(2516);
    expect(session.getMultiplayerSnapshot().spectate).toEqual({ mode: 'viewing', target: 'p2' });
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([24, 0, 12]);

    wire.emit({ type: 'memberLeft', playerId: 'p2', reason: 'left' });

    expect(session.getMultiplayerSnapshot().spectate).toEqual({ mode: 'none' });
    expect(session.getMultiplayerSnapshot().world.members).toEqual([]);
    expect(session.getSnapshot().travelKind).toBe('return');
    expect(session.getSnapshot().travelDestination).toEqual({ x: 0, y: 0 });

    fake.scheduler.tick(3766);
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([12, 0, 90]);
    fake.scheduler.tick(5016);
    expect(session.getSnapshot().phase).toBe('playing');
    expect(session.getSnapshot().spectating).toBe(false);
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([0, 0, 12]);
  });

  it('reverses home after landing when the target leaves mid-flight', () => {
    const { fake, wire, session } = spectateSetup();
    expect(session.spectateMember('p2')).toBe(true);

    fake.scheduler.tick(1016);
    expect(session.getSnapshot().phaseProgress).toBe(0.4);

    wire.emit({ type: 'memberLeft', playerId: 'p2', reason: 'moved' });
    expect(session.getMultiplayerSnapshot().spectate).toEqual({ mode: 'none' });
    // The engine cannot cancel a flight: it lands, then the deferred return starts.
    expect(session.getSnapshot().phase).toBe('travel');
    expect(session.getSnapshot().phaseProgress).toBe(0.4);

    fake.scheduler.tick(2600);
    expect(session.getSnapshot().phase).toBe('playing');
    expect(session.getSnapshot().spectating).toBe(false);
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([0, 0, 12]);

    fake.scheduler.tick(2616);
    expect(session.getSnapshot().phase).toBe('travel');
    expect(session.getSnapshot().travelKind).toBe('return');
    expect(session.getSnapshot().travelDestination).toEqual({ x: 0, y: 0 });
    expect(session.getSnapshot().phaseProgress).toBe(16 / 2500);

    fake.scheduler.tick(5100);
    expect(session.getSnapshot().phase).toBe('playing');
    expect(session.getSnapshot().spectating).toBe(false);
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([0, 0, 12]);
  });

  it('refuses unknown, own and offline selections (inert session surface)', () => {
    const { session } = spectateSetup();
    expect(session.spectateMember('ghost')).toBe(false);
    expect(session.spectateMember('p1')).toBe(false);

    const offline = createGameSession({ env: createFakeEnv().env });
    expect(offline.spectateMember('p2')).toBe(false);
    expect(offline.returnToOwnCube()).toBe(false);
    offline.retryConnection();
    expect(offline.getMultiplayerSnapshot().status).toBe('connecting');
    expect(offline.getMultiplayerSnapshot().world.self.playerId).toBe('');
    const unsubscribe = offline.subscribeMultiplayer(() => {
      throw new Error('an offline session never publishes a multiplayer change');
    });
    unsubscribe();
    expect(session.spectateMember('p2')).toBe(true);
  });

  it('resets the state machine when the engine refuses a camera-only travel', () => {
    const recording = createFakeEngine(snapshot({ phase: 'playing' }));
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, recording.engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));

    expect(session.spectateMember('p2')).toBe(false);

    expect(recording.events).toEqual([
      { type: 'travelTo', kind: 'spectate', destination: { x: 24, y: 0 } },
    ]);
    expect(session.getMultiplayerSnapshot().spectate).toEqual({ mode: 'none' });
  });
});

describe('multiplayer connection gating (AC-22)', () => {
  it('gates every input while disconnected and resumes after welcome', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    fake.scheduler.tick(0);
    tapOn(fake.canvas, 400, 400);
    fake.scheduler.tick(16);

    tapOn(fake.canvas, 400, 400);
    expect(session.getSnapshot().stats.clicks).toBe(1);
    expect(wire.sent).toEqual([{ type: 'explode', id: 'front:2:2', level: 0 }]);

    wire.emitStatus('disconnected');

    // Every gameplay path is gated: pointer, keyboard, spectate and return.
    tapOn(fake.canvas, 460, 400);
    fake.keys.emitKey('ArrowRight');
    expect(session.getSnapshot().stats.clicks).toBe(1);
    expect(session.getSnapshot().orientation).toEqual({ yawSteps: 0, pitchSteps: 0 });
    expect(session.spectateMember('p2')).toBe(false);
    expect(session.returnToOwnCube()).toBe(false);
    expect(wire.sent).toEqual([{ type: 'explode', id: 'front:2:2', level: 0 }]);

    // An open socket alone is not enough: the gate opens on welcome (resume).
    wire.emitStatus('connected');
    tapOn(fake.canvas, 460, 400);
    expect(session.getSnapshot().stats.clicks).toBe(1);

    wire.emit(
      welcomeMessage({
        removedIds: ['front:0:0'],
        roster: [selfMember({ removedIds: ['front:0:0'] }), member()],
      }),
    );
    expect(session.getSnapshot().stats.clicks).toBe(2);

    fake.scheduler.tick(32);
    tapOn(fake.canvas, 460, 400);
    expect(session.getSnapshot().stats.clicks).toBe(3);
    expect(wire.sent).toEqual([
      { type: 'explode', id: 'front:2:2', level: 0 },
      { type: 'explode', id: 'front:2:3', level: 0 },
    ]);
  });

  it('holds a running camera flight while the transport is down', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    fake.scheduler.tick(0);
    tapOn(fake.canvas, 400, 400);
    fake.scheduler.tick(16);

    expect(session.spectateMember('p2')).toBe(true);
    fake.scheduler.tick(1016);
    expect(session.getSnapshot().phaseProgress).toBe(0.4);

    wire.emitStatus('disconnected');
    fake.scheduler.tick(2016);

    expect(session.getSnapshot().phase).toBe('travel');
    expect(session.getSnapshot().phaseProgress).toBe(0.4);
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([
      7.6800000000000015, 0, 83.76,
    ]);
  });

  it('resets a mid-flight spectate to the own rest on a resume welcome (AC-19 d, AC-22)', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    fake.scheduler.tick(0);
    tapOn(fake.canvas, 400, 400);
    fake.scheduler.tick(16);

    expect(session.spectateMember('p2')).toBe(true);
    fake.scheduler.tick(1016);
    const flight = session.getSnapshot();
    expect(flight.phase).toBe('travel');
    expect(flight.travelKind).toBe('spectate');
    expect(flight.phaseProgress).toBe(0.4);
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([
      7.6800000000000015, 0, 83.76,
    ]);

    // The socket drops mid-flight; the resume restores the same identity with one
    // authoritative removal. Not a single remaining flight frame may play.
    wire.emitStatus('disconnected');
    wire.emitStatus('connected');
    wire.emit(
      welcomeMessage({
        removedIds: ['front:0:0'],
        roster: [selfMember({ removedIds: ['front:0:0'] }), member()],
      }),
    );

    const resumed = session.getSnapshot();
    expect(resumed.phase).toBe('playing');
    expect(resumed.phaseProgress).toBe(1);
    expect(resumed.travelKind).toBeNull();
    expect(resumed.travelDestination).toBeNull();
    expect(resumed.spectating).toBe(false);
    expect(resumed.levelIndex).toBe(0);
    expect(resumed.stats).toEqual({ clicks: 1, facesDestroyed: 0 });
    expect(faceIds(resumed, 'front')).toHaveLength(24);
    expect(session.getMultiplayerSnapshot().spectate).toEqual({ mode: 'none' });
    expect(session.getMultiplayerSnapshot().world.self.cube.removedIds).toEqual(['front:0:0']);

    const rendersAfterResume = fake.renderer.renders.length;
    fake.scheduler.tick(1032);
    expect(fake.renderer.renders).toHaveLength(rendersAfterResume + 1);
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([0, 0, 12]);

    // The abandoned flight would have landed at 2516 ms; it is gone and the view stays home.
    fake.scheduler.tick(2516);
    expect(session.getSnapshot().phase).toBe('playing');
    expect(session.getSnapshot().travelKind).toBeNull();
    expect(fake.renderer.renders.at(-1)!.camera.position.toArray()).toEqual([0, 0, 12]);

    // Normal play resumes: the centre tap explodes and forwards again.
    tapOn(fake.canvas, 400, 400);
    expect(session.getSnapshot().stats.clicks).toBe(2);
    expect(wire.sent).toEqual([{ type: 'explode', id: 'front:2:2', level: 0 }]);
  });

  it('publishes the multiplayer store only when status/world/spectate change', () => {
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);

    const first = session.getMultiplayerSnapshot();
    expect(session.getMultiplayerSnapshot()).toBe(first);

    const listener = vi.fn();
    const unsubscribe = session.subscribeMultiplayer(listener);

    wire.emitStatus('connected');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(session.getMultiplayerSnapshot().status).toBe('connected');

    wire.emit({ type: 'hello', serverTime: '2026-10-22T00:00:00.000Z' });
    wire.emit({ type: 'memberLeft', playerId: 'ghost', reason: 'left' });
    expect(listener).toHaveBeenCalledTimes(1);

    wire.emit(welcomeMessage());
    expect(listener).toHaveBeenCalledTimes(2);
    expect(session.getMultiplayerSnapshot().world.self.playerId).toBe('p1');

    wire.emitStatus('exhausted');
    expect(listener).toHaveBeenCalledTimes(3);
    expect(session.getMultiplayerSnapshot().status).toBe('exhausted');

    unsubscribe();
    wire.emit({ type: 'memberJoined', member: member() });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('connects on attach, closes on dispose and reconnects on retry', () => {
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);

    session.attach(fake.canvas.surface);
    expect(wire.connectCount()).toBe(1);
    expect(wire.messageHandlerCount()).toBe(1);
    expect(wire.statusHandlerCount()).toBe(1);

    wire.emitStatus('exhausted');
    session.retryConnection();
    expect(wire.closeCount()).toBe(1);
    expect(wire.connectCount()).toBe(2);
    expect(session.getMultiplayerSnapshot().status).toBe('connecting');

    session.dispose();
    expect(wire.closeCount()).toBe(2);
    expect(wire.messageHandlerCount()).toBe(0);
    expect(wire.statusHandlerCount()).toBe(0);

    session.attach(fake.canvas.surface);
    expect(wire.connectCount()).toBe(3);
    expect(wire.messageHandlerCount()).toBe(1);
    expect(wire.statusHandlerCount()).toBe(1);
  });
});

describe('multiplayer economy adoption (AC-6, AC-11, AC-16, AC-18)', () => {
  it('adopts economy totals from welcome into the engine', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(
      welcomeMessage({
        economy: { coins: 1.5, clicks: 3, facesDestroyed: 2, cubesDestroyed: 1 },
        roster: [selfMember(), member()],
      }),
    );

    expect(session.getSnapshot().stats).toEqual({
      clicks: 3,
      facesDestroyed: 2,
      cubesDestroyed: 1,
      coins: 1.5,
    });
    expect(session.getSnapshot().phase).toBe('intro');
  });

  it('adopts economy totals from worldEntered into the engine', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    fake.scheduler.tick(0);
    tapOn(fake.canvas, 400, 400);
    fake.scheduler.tick(16);
    expect(session.getSnapshot().phase).toBe('playing');

    wire.emit(
      worldEnteredMessage({
        economy: { coins: 2.5, clicks: 7, facesDestroyed: 4, cubesDestroyed: 2 },
        roster: [selfMember({ position: { x: 0, y: 24 }, levelIndex: 1, gridSize: 4 }), member()],
      }),
    );

    expect(session.getSnapshot().stats).toEqual({
      clicks: 7,
      facesDestroyed: 4,
      cubesDestroyed: 2,
      coins: 2.5,
    });
  });

  it('adopts economy totals from economyUpdate without interrupting play', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    fake.scheduler.tick(0);
    tapOn(fake.canvas, 400, 400);
    fake.scheduler.tick(16);
    const beforePhase = session.getSnapshot().phase;

    wire.emit({
      type: 'economyUpdate',
      coins: 9,
      clicks: 10,
      facesDestroyed: 4,
      cubesDestroyed: 2,
    });

    expect(session.getSnapshot().phase).toBe(beforePhase);
    expect(session.getSnapshot().stats).toEqual({
      clicks: 10,
      facesDestroyed: 4,
      cubesDestroyed: 2,
      coins: 9,
    });
    tapOn(fake.canvas, 460, 400);
    expect(session.getSnapshot().stats.clicks).toBeGreaterThanOrEqual(10);
  });

  it('reconnect reconciles persisted totals via welcome', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    fake.scheduler.tick(0);
    tapOn(fake.canvas, 400, 400);
    fake.scheduler.tick(16);

    wire.emitStatus('disconnected');
    wire.emitStatus('connected');
    wire.emit(
      welcomeMessage({
        economy: { coins: 5, clicks: 100, facesDestroyed: 6, cubesDestroyed: 1 },
        roster: [selfMember(), member()],
      }),
    );

    expect(session.getSnapshot().stats).toEqual({
      clicks: 100,
      facesDestroyed: 6,
      cubesDestroyed: 1,
      coins: 5,
    });
  });
});

describe('multiplayer upgrades wiring (T9)', () => {
  it('adopts upgrades from welcome', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(
      welcomeMessage({
        upgrades: { mini_cube_value: 2 },
        roster: [selfMember(), member()],
      }),
    );
    expect(session.getSnapshot().upgrades).toEqual({ mini_cube_value: 2 });
  });

  it('adopts upgrades from worldEntered', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    fake.scheduler.tick(0);
    tapOn(fake.canvas, 400, 400);
    fake.scheduler.tick(16);
    wire.emit(
      worldEnteredMessage({
        upgrades: { cube_value: 1 },
        roster: [selfMember({ position: { x: 0, y: 24 }, levelIndex: 1, gridSize: 4 }), member()],
      }),
    );
    expect(session.getSnapshot().upgrades).toEqual({ cube_value: 1 });
  });

  it('adopts upgrades from upgradesUpdate and publishes', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    const listener = vi.fn();
    session.subscribe(listener);
    wire.emit({ type: 'upgradesUpdate', upgrades: { speed_window: 3 } });
    expect(session.getSnapshot().upgrades).toEqual({ speed_window: 3 });
    expect(listener).toHaveBeenCalled();
  });

  it('sends purchaseUpgrade for accounts', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    session.join('account');
    session.purchaseUpgrade('cube_value');
    expect(wire.sent).toContainEqual({ type: 'purchaseUpgrade', upgradeId: 'cube_value' });
  });

  it('applies guest local purchase', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    // seed coins
    engine.adoptEconomy({ coins: 100, clicks: 0, facesDestroyed: 0, cubesDestroyed: 0 });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    // default joinedMode guest
    session.purchaseUpgrade('mini_cube_value');
    expect(session.getSnapshot().stats.coins).toBe(90);
    expect(session.getSnapshot().upgrades).toEqual({ mini_cube_value: 1 });
    expect(wire.sent).toEqual([]);
  });

  it('propagates mode on join', () => {
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire);
    session.attach(fake.canvas.surface);
    expect(session.getMultiplayerSnapshot().mode).toBe('guest');
    session.join('account');
    expect(session.getMultiplayerSnapshot().mode).toBe('account');
    session.join('guest');
    expect(session.getMultiplayerSnapshot().mode).toBe('guest');
  });
});

describe('multiplayer customization wiring (T11)', () => {
  it('adopts customization from welcome', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(
      welcomeMessage({
        customization: { lootboxes: 2, keys: 1, parts: { 'nose-crimson': 1 }, appearance: { nose: 'nose-crimson' } },
        roster: [selfMember(), member()],
      }),
    );
    expect(session.getSnapshot().customization).toEqual({
      lootboxes: 2,
      keys: 1,
      parts: { 'nose-crimson': 1 },
      appearance: { nose: 'nose-crimson' },
    });
  });

  it('normalizes a legacy customization state carried by welcome (AC-33)', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(
      welcomeMessage({
        customization: {
          lootboxes: 1,
          keys: 1,
          parts: { 'wings-silver': 2, 'engine-blue': 1, 'body-gold': 1 },
          appearance: { wings: 'wings-silver', engine: 'engine-blue', body: 'body-gold' },
        },
        roster: [selfMember(), member()],
      }),
    );

    expect(session.getSnapshot().customization).toEqual({
      lootboxes: 1,
      keys: 1,
      parts: {
        'hull-gold': 1,
        'wing-left-silver': 2,
        'wing-right-silver': 2,
        'ignition-left-blue': 1,
        'ignition-right-blue': 1,
      },
      appearance: {
        hull: 'hull-gold',
        'wing-left': 'wing-left-silver',
        'wing-right': 'wing-right-silver',
        'ignition-left': 'ignition-left-blue',
        'ignition-right': 'ignition-right-blue',
      },
    });
  });

  it('adopts customization from worldEntered', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    fake.scheduler.tick(0);
    wire.emit(
      worldEnteredMessage({
        customization: { lootboxes: 3, keys: 2, parts: {}, appearance: {} },
        roster: [selfMember({ position: { x: 0, y: 24 }, levelIndex: 1, gridSize: 4 }), member()],
      }),
    );
    expect(session.getSnapshot().customization).toEqual({
      lootboxes: 3,
      keys: 2,
      parts: {},
      appearance: {},
    });
  });

  it('adopts customization from customizationUpdate and publishes', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    const listener = vi.fn();
    session.subscribe(listener);
    wire.emit({ type: 'customizationUpdate', lootboxes: 0, keys: 0, parts: { 'body-gold': 2 }, appearance: { body: 'body-gold' } });
    // A restored/unmigrated server row is normalized on adoption (AC-16/AC-33).
    expect(session.getSnapshot().customization).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-gold': 2 },
      appearance: { hull: 'hull-gold' },
    });
    expect(listener).toHaveBeenCalled();
  });

  it('sends openLootbox for accounts', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    session.join('account');
    const before = session.getSnapshot().customization;
    expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(false);

    session.openLootbox();

    expect(wire.sent).toContainEqual({ type: 'openLootbox' });
    // No optimistic mutation; the account open is pending until the server answers.
    expect(session.getSnapshot().customization).toEqual(before);
    expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(true);
  });

  it('sends equipPart for accounts', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    session.join('account');
    session.equipPart('nose-crimson');
    expect(wire.sent).toContainEqual({ type: 'equipPart', partId: 'nose-crimson' });
  });

  it('sends unequipPart for accounts', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    session.join('account');

    session.unequipPart!('wing-left');

    expect(wire.sent).toContainEqual({ type: 'unequipPart', slotId: 'wing-left' });
  });

  it('applies guest local open', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    engine.adoptCustomization({ lootboxes: 1, keys: 1, parts: {}, appearance: {} });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    // default joinedMode guest
    const listener = vi.fn();
    session.subscribe(listener);
    session.openLootbox();
    expect(wire.sent).toEqual([]);
    // Guest opens are synchronous and never set the account pending flag (AC-29).
    expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(false);
    const c = session.getSnapshot().customization!;
    expect(c.lootboxes).toBe(0);
    expect(c.keys).toBe(0);
    const totalCount = Object.values(c.parts).reduce((a, b) => a + b, 0);
    expect(totalCount).toBe(1);
    expect(session.getSnapshot().lastLootboxGrant).toEqual({
      partId: 'engine-left-vector',
      slot: 'engine-left',
      rarity: 'rare',
      duplicate: false,
      sequence: 1,
    });
    expect(listener).toHaveBeenCalled();
  });

  it('applies guest local equip', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    engine.adoptCustomization({ lootboxes: 0, keys: 0, parts: { 'nose-crimson': 1 }, appearance: {} });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    session.equipPart('nose-crimson');
    expect(session.getSnapshot().customization!.appearance).toEqual({ nose: 'nose-crimson' });
    expect(wire.sent).toEqual([]);
  });

  it('applies guest local unequip', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    engine.adoptCustomization({
      lootboxes: 0,
      keys: 0,
      parts: { 'nose-crimson': 1, 'tail-fin-split': 1 },
      appearance: { nose: 'nose-crimson', 'tail-fin': 'tail-fin-split' },
    });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));

    session.unequipPart!('nose');

    expect(session.getSnapshot().customization!.appearance).toEqual({
      'tail-fin': 'tail-fin-split',
    });
    expect(wire.sent).toEqual([]);
  });

  it('guest open with insufficient counts is a no-op', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    engine.adoptCustomization({ lootboxes: 0, keys: 1, parts: {}, appearance: {} });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    const before = session.getSnapshot().customization;
    const listener = vi.fn();
    session.subscribe(listener);
    session.openLootbox();
    expect(session.getSnapshot().customization).toEqual(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('guest equip unknown/unowned is a no-op', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    engine.adoptCustomization({ lootboxes: 0, keys: 0, parts: {}, appearance: {} });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    const before = session.getSnapshot().customization;
    const listener = vi.fn();
    session.subscribe(listener);
    session.equipPart('nose-crimson');
    session.equipPart('totally-unknown');
    expect(session.getSnapshot().customization).toEqual(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('adopts lootboxOpened, clears pending and advances the grant sequence', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    session.join('account');

    session.openLootbox();
    expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(true);

    wire.emit({
      type: 'lootboxOpened',
      partId: 'hull-obsidian',
      slot: 'hull',
      rarity: 'rare',
      duplicate: false,
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-obsidian': 1 },
      appearance: {},
    });

    expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(false);
    expect(session.getSnapshot().customization).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-obsidian': 1 },
      appearance: {},
    });
    expect(session.getSnapshot().lastLootboxGrant).toEqual({
      partId: 'hull-obsidian',
      slot: 'hull',
      rarity: 'rare',
      duplicate: false,
      sequence: 1,
    });

    wire.emit({
      type: 'lootboxOpened',
      partId: 'hull-obsidian',
      slot: 'hull',
      rarity: 'rare',
      duplicate: true,
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-obsidian': 2 },
      appearance: {},
    });

    // Reopening the same part restarts the reveal with the next sequence (AC-32).
    expect(session.getSnapshot().lastLootboxGrant).toEqual({
      partId: 'hull-obsidian',
      slot: 'hull',
      rarity: 'rare',
      duplicate: true,
      sequence: 2,
    });
  });

  it('customizationUpdate clears pending without clearing the reveal grant', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    session.join('account');

    wire.emit({
      type: 'lootboxOpened',
      partId: 'hull-gold',
      slot: 'hull',
      rarity: 'epic',
      duplicate: false,
      lootboxes: 1,
      keys: 1,
      parts: { 'hull-gold': 1 },
      appearance: {},
    });
    session.openLootbox();
    expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(true);

    wire.emit({ type: 'customizationUpdate', lootboxes: 0, keys: 0, parts: { 'hull-gold': 1 }, appearance: {} });

    expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(false);
    // The account-wide update never replaces the opener-only grant (AC-32).
    expect(session.getSnapshot().lastLootboxGrant).toEqual({
      partId: 'hull-gold',
      slot: 'hull',
      rarity: 'epic',
      duplicate: false,
      sequence: 1,
    });

    session.dismissLootboxReveal!();
    expect(session.getSnapshot().lastLootboxGrant).toBeNull();
  });

  it('clears pending on an error frame', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    session.join('account');

    session.openLootbox();
    expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(true);

    wire.emit({ type: 'error', code: 'no_lootbox' });
    expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(false);
  });

  it('clears pending on a transport status change', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    session.join('account');

    session.openLootbox();
    expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(true);

    wire.emitStatus('disconnected');
    expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(false);
  });

  it('clears pending on a resume welcome', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    session.join('account');

    session.openLootbox();
    expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(true);

    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(false);
  });
});

describe('lootbox grant lifecycle (AC-2, AC-3, AC-11)', () => {
  /** One opener-only account grant, exactly as the hub sends it to the opening connection. */
  function emitAccountGrant(wire: FakeTransport): void {
    wire.emit({
      type: 'lootboxOpened',
      partId: 'hull-obsidian',
      slot: 'hull',
      rarity: 'rare',
      duplicate: false,
      lootboxes: 0,
      keys: 0,
      parts: { 'hull-obsidian': 1 },
      appearance: {},
    });
  }

  /** The exact grant the opener's session holds after {@link emitAccountGrant}. */
  const accountGrant: LootboxGrant = {
    partId: 'hull-obsidian',
    slot: 'hull',
    rarity: 'rare',
    duplicate: false,
    sequence: 1,
  };

  it('clears the account grant on a rejoin welcome and publishes the engine snapshot', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    session.join('account');

    emitAccountGrant(wire);
    expect(session.getSnapshot().lastLootboxGrant).toEqual(accountGrant);

    // A second account open is in flight when the resume welcome arrives.
    session.openLootbox();
    expect(wire.sent).toEqual([{ type: 'openLootbox' }]);
    expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(true);

    const publishedGrants: Array<LootboxGrant | null | undefined> = [];
    session.subscribe(() => {
      publishedGrants.push(session.getSnapshot().lastLootboxGrant);
    });

    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));

    // The subscriber observes the cleared grant in the published snapshot, and the clear
    // adds no wire message and keeps the existing welcome pending rule.
    expect(publishedGrants).toEqual([null]);
    expect(session.getSnapshot().lastLootboxGrant).toBeNull();
    expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(false);
    expect(wire.sent).toEqual([{ type: 'openLootbox' }]);
    expect(session.getMultiplayerSnapshot().status).toBe('connected');
  });

  it('clears a pre-seeded grant on the attach-time connecting status (fresh join)', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    engine.adoptLootboxGrant({ partId: 'hull-gold', slot: 'hull', rarity: 'epic', duplicate: true, sequence: 6 });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    const publishedGrants: Array<LootboxGrant | null | undefined> = [];
    session.subscribe(() => {
      publishedGrants.push(session.getSnapshot().lastLootboxGrant);
    });

    session.attach(fake.canvas.surface);

    // The transport's first status is `connecting`: a fresh session never starts with a
    // reveal, and the clear reaches the engine-snapshot subscribers.
    expect(publishedGrants).toEqual([null]);
    expect(session.getSnapshot().lastLootboxGrant).toBeNull();

    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    expect(session.getSnapshot().lastLootboxGrant).toBeNull();
    expect(wire.sent).toEqual([]);
  });

  it.each(['connecting', 'disconnected', 'exhausted'] as const)(
    'clears a mid-reveal grant and publishes the engine snapshot before the store on %s',
    (next) => {
      const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
      const fake = createFakeEnv();
      const wire = createFakeTransport();
      const session = createOnlineSession(fake, wire, engine);
      session.attach(fake.canvas.surface);
      wire.emitStatus('connected');
      wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
      session.join('account');
      emitAccountGrant(wire);
      expect(session.getSnapshot().lastLootboxGrant).toEqual(accountGrant);

      const publishes: string[] = [];
      const publishedGrants: Array<LootboxGrant | null | undefined> = [];
      session.subscribe(() => {
        publishes.push('engine');
        publishedGrants.push(session.getSnapshot().lastLootboxGrant);
      });
      session.subscribeMultiplayer(() => {
        publishes.push('multiplayer');
      });

      wire.emitStatus(next);

      expect(session.getSnapshot().lastLootboxGrant).toBeNull();
      expect(publishedGrants).toEqual([null]);
      expect(publishes).toEqual(['engine', 'multiplayer']);
      expect(session.getMultiplayerSnapshot().status).toBe(next);
      expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(false);
      expect(wire.sent).toEqual([]);
    },
  );

  it('keeps the grant on a connected status', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    session.join('account');
    emitAccountGrant(wire);

    const engineListener = vi.fn();
    session.subscribe(engineListener);

    wire.emitStatus('connected');

    expect(session.getSnapshot().lastLootboxGrant).toEqual(accountGrant);
    expect(engineListener).toHaveBeenCalledTimes(0);
  });

  it('never sets a grant on a second tab that only receives customizationUpdate', () => {
    const firstEnv = createFakeEnv();
    const secondEnv = createFakeEnv();
    const firstWire = createFakeTransport();
    const secondWire = createFakeTransport();
    const first = createOnlineSession(
      firstEnv,
      firstWire,
      createEngine({ online: true, gridSize: 5, random: fixedRandom }),
    );
    const second = createOnlineSession(
      secondEnv,
      secondWire,
      createEngine({ online: true, gridSize: 5, random: fixedRandom }),
    );
    first.attach(firstEnv.canvas.surface);
    second.attach(secondEnv.canvas.surface);
    firstWire.emitStatus('connected');
    secondWire.emitStatus('connected');
    firstWire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    secondWire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    first.join('account');
    second.join('account');

    // The hub sends `lootboxOpened` only to the opening connection; the second tab sees
    // the account-wide customization delta and must never start a reveal.
    emitAccountGrant(firstWire);
    secondWire.emit({ type: 'customizationUpdate', lootboxes: 0, keys: 0, parts: { 'hull-obsidian': 1 }, appearance: {} });

    expect(first.getSnapshot().lastLootboxGrant).toEqual(accountGrant);
    expect(second.getSnapshot().lastLootboxGrant).toBeNull();
    expect(firstWire.sent).toEqual([]);
    expect(secondWire.sent).toEqual([]);
  });

  it('advances the guest grant sequence and keeps the grant on an insufficient open', () => {
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    engine.adoptCustomization({ lootboxes: 2, keys: 2, parts: {}, appearance: {} });
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));

    session.openLootbox();
    expect(session.getSnapshot().lastLootboxGrant).toEqual({
      partId: 'engine-left-vector',
      slot: 'engine-left',
      rarity: 'rare',
      duplicate: false,
      sequence: 1,
    });

    session.openLootbox();
    expect(session.getSnapshot().lastLootboxGrant).toEqual({
      partId: 'engine-left-vector',
      slot: 'engine-left',
      rarity: 'rare',
      duplicate: true,
      sequence: 2,
    });

    // No lootboxes left: the draw never runs and the previous grant is untouched.
    session.openLootbox();
    expect(session.getSnapshot().lastLootboxGrant).toEqual({
      partId: 'engine-left-vector',
      slot: 'engine-left',
      rarity: 'rare',
      duplicate: true,
      sequence: 2,
    });
    expect(session.getSnapshot().customization).toEqual({
      lootboxes: 0,
      keys: 0,
      parts: { 'engine-left-vector': 2 },
      appearance: {},
    });
    expect(session.getMultiplayerSnapshot().pendingLootboxOpen).toBe(false);
    expect(wire.sent).toEqual([]);
  });

  it('delegates every clear to engine.clearLootboxGrant (welcome and non-connected status)', () => {
    const recording = createFakeEngine(
      snapshot({
        lastLootboxGrant: { partId: 'hull-gold', slot: 'hull', rarity: 'epic', duplicate: false, sequence: 3 },
      }),
    );
    const fake = createFakeEnv();
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, recording.engine);

    session.attach(fake.canvas.surface);
    // Attach connects, and the transport reports `connecting`: the non-connected path clears.
    expect(recording.clearGrants()).toBe(1);

    wire.emitStatus('connected');
    expect(recording.clearGrants()).toBe(1);

    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    expect(recording.clearGrants()).toBe(2);

    wire.emitStatus('exhausted');
    expect(recording.clearGrants()).toBe(3);
  });
});

describe('hover target picking (AC-35)', () => {
  it('coalesces pointer moves into at most one front-face pick per animation frame', () => {
    const rect = { left: 0, top: 0, width: 800, height: 800 };
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv({ rect });
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    skipIntro(fake, session, rect);
    hoverPick.mockClear();

    fake.canvas.emit('pointermove', { clientX: 400, clientY: 400 });
    fake.canvas.emit('pointermove', { clientX: 600, clientY: 400 });
    // The pointer events only record the NDC; the raycast waits for the frame.
    expect(hoverPick).not.toHaveBeenCalled();

    fake.scheduler.tick(16);

    expect(hoverPick).toHaveBeenCalledTimes(1);
    const call = hoverPick.mock.calls[0]!;
    expect(call[2]).toBe('front');
    expect(call[3]).toBe(0.5);
    expect(call[4]).toBe(0);

    // A frame without a new pointer event never raycasts again.
    fake.scheduler.tick(32);
    expect(hoverPick).toHaveBeenCalledTimes(1);
  });

  it('does not pick during the intro and hides the target on pointer leave', () => {
    const rect = { left: 0, top: 0, width: 800, height: 800 };
    const engine = createEngine({ online: true, gridSize: 5, random: fixedRandom });
    const fake = createFakeEnv({ rect });
    const wire = createFakeTransport();
    const session = createOnlineSession(fake, wire, engine);
    session.attach(fake.canvas.surface);
    wire.emitStatus('connected');
    wire.emit(welcomeMessage({ roster: [selfMember(), member()] }));
    hoverPick.mockClear();

    fake.canvas.emit('pointermove', { clientX: 400, clientY: 400 });
    fake.scheduler.tick(0);
    expect(hoverPick).not.toHaveBeenCalled();

    skipIntro(fake, session, rect);
    fake.canvas.emit('pointermove', { clientX: 400, clientY: 400 });
    fake.canvas.emit('pointerleave', {});
    fake.scheduler.tick(16);

    // The leave cleared the pending pick: no raycast and no stale reticle.
    expect(hoverPick).not.toHaveBeenCalled();
  });
});
