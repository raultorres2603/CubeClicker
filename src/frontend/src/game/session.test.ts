import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Scene,
  Vector3,
  type PerspectiveCamera,
} from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { ClientMessage, MemberState, Position, ServerMessage } from '../multiplayer/protocol';
import type { Transport, TransportStatus } from '../multiplayer/transport';
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
  type RendererAdapter,
  type ResizeSource,
  type SessionEnvironment,
  type VisibilitySource,
} from './session';
import { FACE_IDS, GRID_SIZE, type FaceId, type MiniCubeId } from './types';

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

interface FakeResize {
  source: ResizeSource;
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
  calls: string[];
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
  spectatingCalls: boolean[];
  setSnapshot(snapshot: EngineSnapshot): void;
}

interface FakeEnv {
  env: SessionEnvironment;
  canvas: FakeCanvas;
  keys: FakeKeyTarget;
  scheduler: FakeScheduler;
  motion: FakeMotion;
  visibility: FakeVisibility;
  resize: FakeResize;
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

function createFakeRendererFactory(): FakeRendererFactory {
  const canvases: CanvasLike[] = [];
  const calls: string[] = [];
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
        },
        setPixelRatio(ratio) {
          ratios.push(ratio);
          calls.push(`setPixelRatio:${ratio}`);
        },
        render(scene, camera) {
          renders.push({ scene, camera });
        },
        dispose() {
          disposals += 1;
        },
      };
    },
    canvases,
    calls,
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
  } = {},
): FakeEnv {
  const canvas = createFakeCanvas(options.rect ?? { left: 0, top: 0, width: 800, height: 800 });
  const keys = createFakeKeyTarget();
  const scheduler = createFakeScheduler();
  const motion = createFakeMotion(options.reducedMotion ?? false);
  const visibility = createFakeVisibility(options.hidden ?? false);
  const resize = createFakeResize();
  const renderer = createFakeRendererFactory();
  const clock = { now: 0 };
  return {
    env: {
      canvas: canvas.surface,
      keyTarget: keys.target,
      scheduler: scheduler.scheduler,
      motion: motion.source,
      visibility: visibility.source,
      resize: resize.source,
      rendererFactory: renderer.factory,
      now: () => clock.now,
      random: options.random ?? fixedRandom,
      devicePixelRatio: () => options.dpr ?? 1,
    },
    canvas,
    keys,
    scheduler,
    motion,
    visibility,
    resize,
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
  const spectatingCalls: boolean[] = [];
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
      setSpectating(active) {
        spectatingCalls.push(active);
      },
    },
    events,
    advancements,
    motionCalls,
    randomSources,
    nextLevels,
    cubeAdoptions,
    spectatingCalls,
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

/** The multiplayer wire the session is wired to: records sends and replays frames/status. */
interface FakeTransport {
  transport: Transport;
  sent: ClientMessage[];
  connectCount(): number;
  closeCount(): number;
  messageHandlerCount(): number;
  statusHandlerCount(): number;
  emit(message: ServerMessage): void;
  emitStatus(status: TransportStatus): void;
}

function createFakeTransport(): FakeTransport {
  const messageHandlers = new Set<(message: ServerMessage) => void>();
  const statusHandlers = new Set<(status: TransportStatus) => void>();
  const sent: ClientMessage[] = [];
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
        publishStatus('connecting');
      },
      close() {
        closes += 1;
      },
      send(message) {
        sent.push(message);
      },
      onMessage(handler) {
        messageHandlers.add(handler);
        return () => {
          messageHandlers.delete(handler);
        };
      },
      onStatus(handler) {
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
    connectCount: () => connects,
    closeCount: () => closes,
    messageHandlerCount: () => messageHandlers.size,
    statusHandlerCount: () => statusHandlers.size,
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

describe('attach', () => {
  it('sizes the renderer from the container rect and the capped pixel ratio (AC-13)', () => {
    const fake = createFakeEnv({ rect: { left: 0, top: 0, width: 1600, height: 800 }, dpr: 3 });
    const session = attachSession(fake);

    // The cap: min(devicePixelRatio, PIXEL_RATIO_CAP) = min(3, 2), applied before the size.
    expect(fake.renderer.canvases).toEqual([fake.canvas.surface]);
    expect(fake.renderer.calls).toEqual(['setPixelRatio:2', 'setSize:1600:800']);
    expect(fake.scheduler.pending()).toBe(1);
    expect(session.getSnapshot().phase).toBe('intro');

    fake.scheduler.tick(0);

    expect(fake.renderer.renders).toHaveLength(1);
    const { scene, camera } = fake.renderer.renders[0]!;
    expect(scene).toBeInstanceOf(Scene);
    expect(camera.aspect).toBe(2);
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
    expect(fake.resize.subscribeCount()).toBe(1);
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

    fake.scheduler.tick(32);

    // The drained intent reached the scene: the tile is mid-pop (AC-4), still full enough
    // to be visible, and has not been zero-scaled away yet.
    const mesh = faceMesh(fake.renderer.renders.at(-1)!.scene, 'front');
    const popping = instanceMatrix(mesh, 12);
    expect(popping.elements[0]).toBe(Math.fround(0.95 * 1.016));
    expect(new Vector3().setFromMatrixPosition(popping).toArray()).toEqual([0, 0, 2.625]);

    fake.scheduler.tick(192);

    // At the end of the 160 ms pop the instance reaches the hidden end state (AC-4).
    const hidden = instanceMatrix(mesh, 12);
    expect([hidden.elements[0], hidden.elements[5], hidden.elements[10]]).toEqual([0, 0, 0]);
    expect(new Vector3().setFromMatrixPosition(hidden).toArray()).toEqual([0, 0, 2.625]);
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
  it('re-applies size, capped pixel ratio and camera projection on the injected resize (AC-13)', () => {
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

  it('never starts the loop while the tab is already hidden', () => {
    const fake = createFakeEnv({ hidden: true });
    attachSession(fake);

    expect(fake.scheduler.schedules()).toBe(0);
    expect(fake.scheduler.pending()).toBe(0);

    fake.visibility.emit(false);

    expect(fake.scheduler.pending()).toBe(1);
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
    expect(fake.canvas.listenerCount('pointerdown')).toBe(1);
    expect(fake.motion.subscribeCount()).toBe(2);
    expect(fake.renderer.disposals()).toBe(1);
    expect(fake.scheduler.pending()).toBe(1);

    fake.scheduler.tick(16);

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
        },
      ],
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

describe('authoritative cube adoption over the wire (AC-14, AC-22)', () => {
  /** A connected online session on the real engine, playing after the intro skip. */
  function playingSession(): {
    engine: GameEngine;
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
    return { engine, fake, wire, session };
  }

  it('restores a locally removed tile the server still has and forwards the next tap again', () => {
    const { fake, wire, session } = playingSession();

    tapOn(fake.canvas, 400, 400);
    expect(session.getSnapshot().stats).toEqual({ clicks: 1, facesDestroyed: 0 });
    expect(faceIds(session.getSnapshot(), 'front')).toHaveLength(24);
    expect(wire.sent).toEqual([{ type: 'explode', id: 'front:2:2', level: 0 }]);

    // The server still has the tile this client exploded (a rejected/lost click): the sync
    // must put it back, not leave the local extra in place.
    wire.emit(stateSyncMessage({ removedIds: [] }));

    const restored = session.getSnapshot();
    expect(restored.stats).toEqual({ clicks: 1, facesDestroyed: 0 });
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
    expect(session.getSnapshot().stats).toEqual({ clicks: 2, facesDestroyed: 0 });
    expect(wire.sent).toEqual([
      { type: 'explode', id: 'front:2:2', level: 0 },
      { type: 'explode', id: 'front:2:2', level: 0 },
    ]);
  });

  it('removes the authoritative ids of a stateSync exactly and never echoes them', () => {
    const { fake, wire, session } = playingSession();

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
    const { fake, wire, session } = playingSession();

    tapOn(fake.canvas, 400, 400);
    expect(session.getSnapshot().stats).toEqual({ clicks: 1, facesDestroyed: 0 });
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
    expect(synced.stats).toEqual({ clicks: 1, facesDestroyed: 0 });
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
    expect(session.getSnapshot().stats).toEqual({ clicks: 150, facesDestroyed: 6 });

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
    expect(rejoined.stats).toEqual({ clicks: 150, facesDestroyed: 6 });
    expect(rejoined.board.faces.map((face) => face.miniCubes.length)).toEqual([
      25, 25, 25, 25, 25, 25,
    ]);
    expect(rejoined.travelKind).toBeNull();
    expect(session.getMultiplayerSnapshot().world.self.playerId).toBe('p3');

    fake.scheduler.tick(2948);
    expect(faceMesh(fake.renderer.renders.at(-1)!.scene, 'front').count).toBe(25);

    // The fresh cube is playable at level 0 and the wire carries the new level.
    tapOn(fake.canvas, 400, 400);
    expect(session.getSnapshot().stats).toEqual({ clicks: 151, facesDestroyed: 6 });
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
    expect(resumed.stats).toEqual({ clicks: 150, facesDestroyed: 6 });
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
    expect(session.getSnapshot().stats).toEqual({ clicks: 151, facesDestroyed: 6 });
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
