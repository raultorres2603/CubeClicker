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

import { createBoard } from './board';
import { createEngine, type EngineSnapshot, type GameEngine, type GameEvent } from './engine';
import { REDUCED_TIMINGS } from './effects';
import { CUBE_STYLES } from './progression';
import { createOrientation } from './rotation';
import {
  createGameSession,
  type CanvasLike,
  type GameSession,
  type MotionSource,
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
function createFakeEngine(initial: EngineSnapshot): FakeEngine {
  const events: GameEvent[] = [];
  const advancements: number[] = [];
  const motionCalls: boolean[] = [];
  const randomSources: Array<() => number> = [];
  let snapshot = initial;
  return {
    engine: {
      dispatch(event) {
        events.push(event);
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
    },
    events,
    advancements,
    motionCalls,
    randomSources,
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
    expect(popping.elements[0]).toBe(Math.fround(0.9 * 1.016));
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

  it('maps taps and drags to the events each phase allows (injected engine)', () => {
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

    dragOn(fake.canvas, { x: 100, y: 100 }, { x: 220, y: 100 });
    expect(recording.events).toEqual([
      { type: 'introSkip' },
      { type: 'explodeMiniCube', id: 'front:2:2' },
      { type: 'rotate', axis: 'yaw', direction: 1 },
    ]);

    dragOn(fake.canvas, { x: 100, y: 100 }, { x: 100, y: 220 });
    expect(recording.events).toEqual([
      { type: 'introSkip' },
      { type: 'explodeMiniCube', id: 'front:2:2' },
      { type: 'rotate', axis: 'yaw', direction: 1 },
      { type: 'rotate', axis: 'pitch', direction: 1 },
    ]);
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
