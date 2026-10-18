---
feature: cube-game-frontend
revision: 3
---
# Plan — Cube Game Frontend (first playable 3D experience)

## Architecture

Four layers inside the frontend workspace, dependency direction top→bottom (higher layers depend on lower, never the reverse):

1. **Pure game core (`src/frontend/src/game/**`)** — no DOM, no three.js, no timers: domain types + `GRID_SIZE` (`types.ts`), board model (`board.ts`), orientation/cursor model (`rotation.ts`), level progression + styles + stats (`progression.ts`), timings/easing/burst math + the non-grid pinned constants (`effects.ts`), the engine — phases, events, intents, snapshot (`engine.ts`). All inputs are values (events, `advance(dtMs)`); all randomness/timing is injected. This layer carries the vast majority of behavior tests.
2. **Render adapter (`src/frontend/src/render/**`)** — three.js only: cube view (`cube-view.ts`), starfield (`starfield.ts`), explosion particles (`particles.ts`), picking (`picking.ts`), scene composition + camera flights (`scene.ts`), WebGL bootstrap + rAF scheduler (`webgl.ts`). Constructs real three.js objects (node-testable) and consumes engine snapshots **pull-style** (the scene receives the snapshot each frame; no back-channel into logic).
3. **Input mapping (`src/frontend/src/input/**`)** — pure functions mapping raw pointer/keyboard input to engine events (`gestures.ts`, `keyboard.ts`).
4. **Session + UI (`game/session.ts`, `browser-env.ts`, `ui/**`, `App.tsx`)** — `session.ts` wires the browser boundary: engine dispatch/advance, scheduler loop, renderer adapter, event listeners, motion/visibility sources — every environment value injectable; `browser-env.ts` (workspace `src/` root, outside `game/**`) is the single place that reads browser globals; React components render the HUD/canvas from session snapshots via `useSyncExternalStore` (no per-frame React renders).

**Data flow:** DOM pointer/key event → `input/*` maps to a `GameEvent` → `engine.dispatch(event)` (or `engine.advance(dt)` from the frame loop) → engine updates pure state and records `EffectIntent`s → frame loop drains intents into `scene.applyIntents(...)`, calls `scene.applySnapshot(engine.getSnapshot())`, then `adapter.render(scene, camera)` → HUD subscribes to the session snapshot (React re-renders only when stats/phase/level change). **State ownership:** the engine owns all game state (board, orientation, cursor, stats, phase); the scene owns only three.js objects; React owns only view state derived from snapshots. `getSnapshot()` is referentially stable until a value changes (React contract).

**Asset strategy:** fully procedural — no image, model, or font files. The galaxy/starfield is a `THREE.Points` field with deterministic star positions; cubes/materials are solid palettes; explosions are `Points`-based particle bursts; all text is DOM (HUD), never textures. Nothing to load, nothing to cache, nothing in the bundle but code.

## Interfaces / contracts

Pinned enough for parallel builders; wording may vary slightly if the semantics hold. All `game/**` code is DOM-free.

### Domain model (`game/types.ts`, `game/board.ts`)

```ts
export type FaceId = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
export const FACE_IDS: readonly FaceId[];            // stable order: front, back, left, right, top, bottom
export const GRID_SIZE = 5;                          // pinned; 25 per face, 150 per cube level
export type MiniCubeId = `${FaceId}:${number}:${number}`; // row:col, 0-based
export interface MiniCube { id: MiniCubeId; faceId: FaceId; row: number; col: number }
export interface Face { id: FaceId; miniCubes: MiniCube[] }
export interface Board { faces: Face[] }             // always exactly 6 faces (cleared faces keep 0 mini-cubes)
export interface GameStats { clicks: number; facesDestroyed: number }
export interface CubeStyle {
  id: string; name: string;
  cubeColor: string; miniCubeColor: string; accentColor: string;  // '#rrggbb'
  metalness: number; roughness: number;
}
export type Phase = 'intro' | 'playing' | 'travel';
```

- `createBoard(gridSize = GRID_SIZE): Board` — 6 faces, each with `gridSize²` mini-cubes, id `face:row:col`, rows/cols ascending.
- `removeMiniCube(board, id): { board: Board; removed: boolean; faceCleared: boolean; allCleared: boolean }` — immutable; `removed: false` when the id is absent (no-op); `faceCleared` true only on the transition to 0 mini-cubes on that face; `allCleared` true when every face has 0.
- `remainingOnFace(board, faceId): number`; `frontFace(orientation): FaceId` lives in `rotation.ts`.

**Constant homes (one place per constant — F2 pin).** `GRID_SIZE` lives in `types.ts` (T2). All other non-grid pinned constants live in `effects.ts` (T5): `STAR_COUNT`, `EXPLOSION_PARTICLE_COUNT`, `PARTICLE_POOL_CAP`, `TAP_DRAG_THRESHOLD_PX`, `PIXEL_RATIO_CAP`. Consumers (`starfield.ts`, `particles.ts`, `input/**`, engine/session) import them — never redefine locally. Style values live in `progression.ts`; HUD colours in `ui/theme.ts`.

### Orientation & cursor (`game/rotation.ts`)

```ts
export type Axis = 'yaw' | 'pitch';
export interface Orientation { yawSteps: number; pitchSteps: number }  // quarter turns; yaw mod 4, pitch clamped to -1|0|1
export interface Cursor { faceId: FaceId; row: number; col: number }
export function createOrientation(): Orientation;                       // { yawSteps: 0, pitchSteps: 0 }
export function rotateStep(o: Orientation, axis: Axis, direction: -1 | 1): Orientation;
export function frontFace(o: Orientation): FaceId;                      // FaceId currently facing the camera
export function interpolateRotation(from: Orientation, to: Orientation, t: number): { yaw: number; pitch: number };
                                                                        // radians; t eased by caller; t=1 → exact multiples of PI/2
export function createCursor(gridSize?: number): Cursor;                // front face center
export function moveCursor(cursor: Cursor, dx: -1 | 0 | 1, dy: -1 | 0 | 1, gridSize?: number): Cursor; // clamped
export function reanchorCursor(board: Board, orientation: Orientation, preferred?: Cursor | null): Cursor | null;
                                                                        // nearest remaining mini-cube on front face:
                                                                        // grid distance, then lowest row, then lowest col; null if front face empty
```

### Progression, stats & styles (`game/progression.ts`)

```ts
export const CUBE_STYLES: readonly CubeStyle[];   // 5 entries, cycled in order (values pinned in § Pinned style list below)
export interface Progression { levelIndex: number; stats: GameStats }
export function createProgression(): Progression;                       // levelIndex 0, stats { clicks: 0, facesDestroyed: 0 }
export function currentStyle(p: Progression): CubeStyle;                // CUBE_STYLES[p.levelIndex % CUBE_STYLES.length]
export function recordClick(p: Progression): Progression;               // stats.clicks + 1
export function recordFaceDestroyed(p: Progression): Progression;       // stats.facesDestroyed + 1
export function advanceLevel(p: Progression): Progression;              // levelIndex + 1, stats carried over
```

### Timings & effect math (`game/effects.ts`)

```ts
export interface Timings { introMs: number; travelMs: number; rotationMs: number; explosionMs: number; faceFadeMs: number }
export const DEFAULT_TIMINGS: Timings;  // 2500, 2500, 300, 350, 400
export const REDUCED_TIMINGS: Timings;  // 150, 150, 0, 0, 100
export function timingsFor(reducedMotion: boolean): Timings;
export function easeOutCubic(t: number): number;
export function easeInOutQuad(t: number): number;
export interface Burst { particles: { dx: number; dy: number; dz: number; speed: number; size: number }[]; lifetimeMs: number }
export function createBurst(random: () => number, particleCount?: number): Burst; // default EXPLOSION_PARTICLE_COUNT (24); deterministic given random
export const EXPLOSION_PARTICLE_COUNT = 24;
export const PARTICLE_POOL_CAP = 3 * EXPLOSION_PARTICLE_COUNT; // 72 — max active particles (3 concurrent bursts; at cap the oldest burst is recycled)
export const TAP_DRAG_THRESHOLD_PX = 40;
export const PIXEL_RATIO_CAP = 2;
export const STAR_COUNT = 1200;
```

### Engine (`game/engine.ts`)

```ts
export type GameEvent =
  | { type: 'introSkip' }
  | { type: 'explodeMiniCube'; id: MiniCubeId }
  | { type: 'explodeCursor' }
  | { type: 'rotate'; axis: Axis; direction: -1 | 1 }
  | { type: 'cursorMove'; dx: -1 | 0 | 1; dy: -1 | 0 | 1 };

export type EffectIntent =
  | { kind: 'explosion'; id: MiniCubeId; faceId: FaceId; burst: Burst }
  | { kind: 'faceCleared'; faceId: FaceId }
  | { kind: 'levelChanged'; style: CubeStyle }
  | { kind: 'travelStarted' };

export interface EngineOptions { gridSize?: number; reducedMotion?: boolean; random?: () => number; timings?: Timings }
export interface EngineSnapshot {
  phase: Phase; phaseProgress: number;              // 0..1 during intro/travel; 1 while playing
  stats: GameStats; levelIndex: number; style: CubeStyle;
  orientation: Orientation; rotationFrom: Orientation | null; rotationProgress: number; // 0..1 (1 when idle)
  cursor: Cursor | null; board: Board; reducedMotion: boolean;
}
export interface GameEngine {
  dispatch(event: GameEvent): void;   // gated: intro honors introSkip only; travel ignores all; playing honors the rest
  advance(dtMs: number): void;        // time only; drives phase/rotation/animations
  drainIntents(): EffectIntent[];     // order-preserving; clears the queue
  getSnapshot(): EngineSnapshot;      // referentially stable until a change
  setReducedMotion(reduced: boolean): void;
}
export function createEngine(options?: EngineOptions): GameEngine;
```

Engine invariants (test-pinned): clicks during `intro`/`travel` are no-ops; a removed id clicked again is a no-op; `clicks` increments exactly once per successful removal, synchronously in `dispatch`; `facesDestroyed` exactly once per face-clear transition; rotation queue depth ≤ 1; after a rotation settles the front face is checked — if cleared but other faces remain, auto-rotate one step toward the nearest face with mini-cubes (fewest steps, then `FACE_IDS` order), repeating until the front face has mini-cubes or none remain; `cursor` re-anchors via `reanchorCursor` after every board/orientation change; when the sixth face clears: after `faceFadeMs` the phase becomes `travel`, `travelStarted` drains once, after `travelMs` the level advances (fresh board, next style, default orientation/cursor, stats carried) and a `levelChanged` intent drains once.

### Session & browser boundary (`game/session.ts`, `browser-env.ts`, `render/webgl.ts`)

```ts
// browser-facing shapes kept minimal so tests can fake them
export interface CanvasLike {
  addEventListener(type: string, handler: (event: unknown) => void): void;
  removeEventListener(type: string, handler: (event: unknown) => void): void;
  getBoundingClientRect(): { left: number; top: number; width: number; height: number };
  width: number; height: number;
}
export interface FrameScheduler { schedule(cb: (nowMs: number) => void): number; cancel(handle: number): void }
export interface MotionSource { matches(): boolean; subscribe(cb: (reduced: boolean) => void): () => void }
export interface VisibilitySource { isHidden(): boolean; subscribe(cb: (hidden: boolean) => void): () => void }
export interface RendererAdapter {           // narrow surface of three's WebGLRenderer
  setSize(width: number, height: number): void;
  setPixelRatio(ratio: number): void;
  render(scene: Scene, camera: PerspectiveCamera): void;
  dispose(): void;
}
export interface SessionEnvironment {
  canvas: CanvasLike; keyTarget: { addEventListener(type: string, handler: (event: unknown) => void): void;
                                   removeEventListener(type: string, handler: (event: unknown) => void): void };
  scheduler: FrameScheduler; motion: MotionSource; visibility: VisibilitySource;
  rendererFactory: (canvas: CanvasLike) => RendererAdapter;
  now(): number; random(): number; devicePixelRatio(): number;
}
export interface GameSession {
  attach(canvas: CanvasLike): void;      // resolves env (injected or browser defaults), starts engine + loop; idempotent
  dispose(): void;                       // cancels frame, removes listeners, disposes renderer + scene; idempotent
  getSnapshot(): EngineSnapshot;         // engine snapshot passthrough
  subscribe(listener: () => void): () => void;
}
export function createGameSession(options?: { env?: SessionEnvironment; engine?: GameEngine }): GameSession;
```

- `browser-env.ts` (`src/frontend/src/browser-env.ts`, outside `game/**`): `browserEnvironment(canvas: CanvasLike): SessionEnvironment` — the **only** module reading browser globals (`window`, `document`, `requestAnimationFrame`, `performance`, `matchMedia('(prefers-reduced-motion: reduce)')`, `ResizeObserver`); default `rendererFactory` is `webgl.createWebGLRenderer`; tested via `vi.stubGlobal` fakes.
- `render/webgl.ts`: `createWebGLRenderer(canvas): RendererAdapter` — `new WebGLRenderer({ canvas, antialias: true })`, `setPixelRatio(ratio)` supplied by the session (`min(devicePixelRatio(), PIXEL_RATIO_CAP)`); `createRafScheduler(): FrameScheduler`.
- Session wiring behaviors (AC-2, AC-6, AC-12, AC-13, AC-15): pointer handlers classify gestures and dispatch per phase — `intro`: `tap` → `introSkip`, `drag` → nothing (a click during intro never picks/explodes); `playing`: `tap` → `pickMiniCube(sceneView.camera, sceneView.cubeView, frontFace(snapshot.orientation), ndcX, ndcY)` (front-face gate; hit → `explodeMiniCube`; non-front-face hit or miss → nothing; both handles are read from the live scene at pick time — `cubeView` through the rebuild-aware accessor in § Render interfaces), `drag` → `rotate`; `travel`: pointer input ignored; key handler maps via `keyboard.ts`; motion source sets `engine.setReducedMotion`; visibility source pauses/resumes the loop; `attach` sets canvas size/ratio from `getBoundingClientRect` and `devicePixelRatio()`; resize (window `resize` via env or ResizeObserver) repeats size/ratio/camera-aspect. `dispose` releases everything and stops frames.

### Render interfaces

```ts
// render/scene.ts
export interface SceneView {
  scene: Scene; camera: PerspectiveCamera;                      // exposed for tests
  readonly cubeView: CubeView;                                  // rebuild-aware accessor (getter over the CURRENT cube-view handle;
                                                                // re-read at pick time — a cached handle goes stale after levelChanged)
  applyIntents(intents: EffectIntent[], nowMs: number): void;   // explosion → hide instance + spawn burst;
                                                                // faceCleared → fade/remove plate; levelChanged → rebuild cube view with new style
  applySnapshot(snapshot: EngineSnapshot, nowMs: number): void; // camera flights (intro/travel), orientation interpolation,
                                                                // cursor highlight, starfield travel-progress, level reconciliation
  update(dtMs: number): void;                                   // starfield drift, particle aging; returns nothing
  dispose(): void;                                              // disposes geometries/materials/objects it created
}
export function createSceneView(options: { style: CubeStyle; gridSize?: number; random?: () => number }): SceneView;
```

- `SceneView.cubeView` — r3 seam (AC-6), chosen over a scene-owned `pick(ndcX, ndcY, frontFaceId)` delegate so the `pickMiniCube(camera, cubeView, …)` call-site and its front-face gate stay exactly where the session contract pins them: a `readonly` getter (not a stored field) returns the current handle at call time, so the session's per-tap re-read can never hold a stale reference across a `levelChanged` rebuild; no new drawables, same disposal (AC-15/AC-16 unaffected). T13 adds it to the landed `scene.ts` and pins the rebuild-following behavior in `scene.test.ts`.
- `cube-view.ts`: `createCubeView(style, gridSize)` → `{ group: Group; faces: ReadonlyMap<FaceId, InstancedMesh>; plateMeshes: ReadonlyMap<FaceId, Mesh>; body: Mesh; hideMiniCube(id); highlightCursor(cursor | null); removeFace(faceId); applyStyle(style); dispose() }` — one `InstancedMesh` per face (`gridSize²` instances), ids encoded in instance index (`row * gridSize + col`); face plate meshes fade out via `material.opacity` (transparent material) before removal.
- `starfield.ts`: `createStarfield(random)` → `{ points: Points; update(dtMs, travelProgress?): void; dispose() }` — exactly `STAR_COUNT` deterministic stars (imported from `game/effects.ts` — never hardcoded locally); slow drift; travel streak scales star elongation by `travelProgress` (0..1).
- `particles.ts`: `createParticleSystem(random, cap = PARTICLE_POOL_CAP)` → `{ group: Group; spawn(burst: Burst, origin: Vector3, nowMs): void; update(dtMs): void; activeCount(): number; dispose() }` — pooled bursts, hard cap `PARTICLE_POOL_CAP` (72; spawning at cap recycles the oldest active burst so `activeCount()` never exceeds the cap), released after `burst.lifetimeMs`.
- `picking.ts`: `pickMiniCube(camera, cubeView, frontFaceId, ndcX, ndcY): MiniCubeId | null` — real `THREE.Raycaster`; only intersections with the current front face's `InstancedMesh` resolve (hits on other faces are ignored — returns null); resolves `instanceId` → `face:row:col`; returns null on miss or hidden instance; the session supplies both handles from the live `SceneView` (`cubeView` via the rebuild-aware accessor above).
- Camera pinned (AC-22): rest position `(0, 0, 12)` looking at origin; intro flies `(0, 0, 60)` → `(0, 0, 12)` eased with `easeOutCubic` over `phaseProgress` (z = 18 at 0.5); travel pulls away `(0, 0, 12)` → `(0, 0, 90)` eased with `easeInOutQuad` (z = 21.75 at 0.25, 51 at 0.5) with starfield streak; under reduced motion there is no fly-through (camera stays at rest through `intro`/`travel`); FOV 50; near 0.1; far 200.

### Input interfaces (`input/**`)

```ts
// gestures.ts
export type PointerGesture = { kind: 'tap'; ndcX: number; ndcY: number } | { kind: 'drag'; axis: Axis; direction: -1 | 1 } | null;
export function classifyPointer(start: {x: number; y: number}, current: {x: number; y: number}, rect: {width: number; height: number}): PointerGesture;
// tap: travel ≤ TAP_DRAG_THRESHOLD_PX (inclusive — exactly at the threshold is a tap: 39 px tap, 40 px tap, 41 px drag) → ndcX/ndcY in [-1, 1] from rect; drag: travel > TAP_DRAG_THRESHOLD_PX, dominant axis of (dx, dy), direction = sign; null: a tap without a valid rect (width/height ≤ 0)
// classifyPointer is phase-agnostic; the session applies the phase policy (intro: tap → introSkip, drag → nothing;
// playing: tap → front-face-gated pick, drag → rotate; travel: all ignored)
// keyboard.ts
export function mapKey(key: string, phase: Phase): GameEvent | null;
// intro: any key → { type: 'introSkip' }; playing: ArrowLeft/Right → rotate yaw -1/+1; ArrowUp/Down → rotate pitch +1/-1;
// w/a/s/d (case-insensitive) → cursorMove dy -1 / dx -1 / dy +1 / dx +1; Enter/' ' → explodeCursor; travel: null; unknown → null
```

### UI interfaces (`ui/**`, `App.tsx`)

```ts
// ui/Hud.tsx — pure props, no session reference (SSR-testable)
export function Hud(props: { stats: GameStats; levelIndex: number }): JSX.Element;
// markup pinned: <section aria-label="Game statistics"> with <p>Clicks: <span data-stat="clicks">N</span></p>,
// <p>Faces destroyed: <span data-stat="faces-destroyed">N</span></p>,
// <p>Cube <span data-stat="cube">N+1</span></p>
// neither counter span carries role/aria-live (AC-14: the single phase region is the only live region)
// ui/GameCanvas.tsx — owns the <canvas>; creates nothing; receives session
export function GameCanvas(props: { session: GameSession }): JSX.Element;  // effect: attach(canvas) / dispose; SSR renders <canvas>
// ui/theme.ts — pinned colour constants (contrast-checked): HUD_TEXT = '#e8f6ff', HUD_BACKGROUND = 'rgba(6, 10, 20, 0.72)',
// ACCENT = '#7cf6ff'; HUD text vs page background (black #000000 under the starfield) ≥ 4.5:1.
// App.tsx — creates the session once (useState initializer; side-effect-free), subscribes via useSyncExternalStore
// (getSnapshot as the server snapshot), composes <main> with GameCanvas + Hud + the single phase-announcement region:
// <div role="status" aria-live="polite">{text}</div> — always rendered in every phase (no hidden attribute; CSS-only
// visual treatment), text pinned per phase: intro = 'Click or press any key to skip' (the visible skip hint),
// travel = 'Traveling to the next cube…', playing = '' (empty content — AC-14).
```

### Pinned style list (contract for `game/progression.ts`)

| # | id | name | cubeColor | miniCubeColor | accentColor | metalness | roughness |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | `obsidian-neon` | Obsidian Neon | `#0b0b12` | `#1de9b6` | `#7cf6ff` | 0.6 | 0.35 |
| 1 | `crimson-alloy` | Crimson Alloy | `#1a0b0e` | `#ff4d6d` | `#ffb3c1` | 0.8 | 0.30 |
| 2 | `emerald-crystal` | Emerald Crystal | `#0a1410` | `#34d399` | `#a7f3d0` | 0.2 | 0.15 |
| 3 | `solar-gold` | Solar Gold | `#2a1a05` | `#ffcc66` | `#ffe9b3` | 0.9 | 0.25 |
| 4 | `violet-nebula` | Violet Nebula | `#140a1f` | `#a78bfa` | `#d8ccff` | 0.7 | 0.40 |

## File inventory

| Path | New/Edit | Purpose | Owner task |
| --- | --- | --- | --- |
| `src/frontend/package.json` | Edit | +`three`, +`@types/three` (dependencies/devDependencies) | T1 |
| `package-lock.json` | Edit (npm-generated) | Locked dep tree | T1 |
| `src/frontend/src/game/types.ts` | New | Domain types + `GRID_SIZE` (the only constant living here) | T2 |
| `src/frontend/src/game/board.ts` | New | Board model (create/remove/flags) | T2 |
| `src/frontend/src/game/board.test.ts` | New | Board unit tests | T2 |
| `docs/product/glossary.md` | Edit | +mini-cube, +face, +cube level | T2 |
| `src/frontend/src/game/rotation.ts` | New | Orientation, front face, interpolation, cursor | T3 |
| `src/frontend/src/game/rotation.test.ts` | New | Rotation/cursor unit tests | T3 |
| `src/frontend/src/game/progression.ts` | New | Styles list, level advance, stats | T4 |
| `src/frontend/src/game/progression.test.ts` | New | Progression unit tests | T4 |
| `src/frontend/src/game/effects.ts` | New | Timings, easings, burst math + the non-grid pinned constants (`STAR_COUNT`, `EXPLOSION_PARTICLE_COUNT`, `PARTICLE_POOL_CAP`, `TAP_DRAG_THRESHOLD_PX`, `PIXEL_RATIO_CAP`) | T5 |
| `src/frontend/src/game/effects.test.ts` | New | Effects/timings unit tests | T5 |
| `src/frontend/src/game/engine.ts` | New | Phases, events, intents, snapshot | T6 |
| `src/frontend/src/game/engine.test.ts` | New | Engine unit tests (fake time/random) | T6 |
| `src/frontend/src/render/starfield.ts` | New | Starfield Points + travel progress | T7 |
| `src/frontend/src/render/starfield.test.ts` | New | Starfield node tests | T7 |
| `src/frontend/src/render/cube-view.ts` | New | Cube/faces/instances/highlight/removal/dispose | T8 |
| `src/frontend/src/render/cube-view.test.ts` | New | Cube-view node tests | T8 |
| `src/frontend/src/render/particles.ts` | New | Pooled explosion bursts (hard cap `PARTICLE_POOL_CAP`) | T9 |
| `src/frontend/src/render/particles.test.ts` | New | Particle system node tests | T9 |
| `src/frontend/src/render/picking.ts` | New | Raycast NDC → mini-cube id | T10 |
| `src/frontend/src/render/picking.test.ts` | New | Picking node tests | T10 |
| `src/frontend/src/input/gestures.ts` | New | Pointer gesture classification | T11 |
| `src/frontend/src/input/gestures.test.ts` | New | Gesture unit tests | T11 |
| `src/frontend/src/input/keyboard.ts` | New | Key → event mapping | T11 |
| `src/frontend/src/input/keyboard.test.ts` | New | Keyboard unit tests | T11 |
| `src/frontend/src/render/scene.ts` | New | Scene composition, camera flights, intent application | T12 |
| `src/frontend/src/render/scene.test.ts` | New | Scene node tests (fake adapter) | T12 |
| `src/frontend/src/game/session.ts` | New | Browser wiring (engine+scene+input+loop) | T13 |
| `src/frontend/src/game/session.test.ts` | New | Session integration tests (fake env) | T13 |
| `src/frontend/src/browser-env.ts` | New | Browser-global environment assembly (sanctioned reader) | T13 |
| `src/frontend/src/browser-env.test.ts` | New | Stub-global tests | T13 |
| `src/frontend/src/render/webgl.ts` | New | WebGLRenderer adapter + rAF scheduler | T13 |
| `src/frontend/src/render/webgl.test.ts` | New | Mocked-`three` + stub-global tests | T13 |
| `src/frontend/src/App.tsx` | Edit (rewrite) | Game shell (session, HUD, status region) | T14 |
| `src/frontend/src/App.test.tsx` | Edit (rewrite) | SSR shell tests (replaces scaffold test) | T14 |
| `src/frontend/src/ui/Hud.tsx` | New | Stats HUD (pure props) | T14 |
| `src/frontend/src/ui/Hud.test.tsx` | New | HUD SSR tests | T14 |
| `src/frontend/src/ui/GameCanvas.tsx` | New | Canvas element + session lifecycle | T14 |
| `src/frontend/src/ui/GameCanvas.test.tsx` | New | Canvas SSR tests | T14 |
| `src/frontend/src/ui/theme.ts` | New | Pinned HUD colours | T14 |
| `src/frontend/src/ui/theme.test.ts` | New | Contrast tests | T14 |
| `src/frontend/src/ui/app.css` | New | Page/canvas/HUD layout + focus ring | T14 |
| `docs/features/cube-game-frontend/build-log-T1.md` … `-T15.md` | New | Per-task evidence | T1…T15 |

## Files intentionally unchanged

| Path | Why |
| --- | --- |
| `src/frontend/src/main.tsx` | Composition root (already excluded from coverage); `App` needs no new entrypoint wiring. |
| `src/frontend/src/ws/connection.ts`, `…/connection.test.ts` | Real-time scaffold retained for future sync features; unreferenced by the game (AC-19). |
| `src/frontend/index.html` | Title/viewport already correct; no new assets to preload. |
| `src/backend/**`, `tests/e2e/**`, `compose*.yaml`, `src/*/Dockerfile`, `README.md`, `AGENTS.md`, `docs/architecture/**` | No backend/container/run-instruction change; rebuild after the dependency change is already documented (`podman compose up --build`). |
| `src/frontend/vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `eslint.config.mjs` | No config change needed: node test env suffices (no DOM dep), coverage/exclusions stay as the testing-criteria feature set them, Vite resolves `three` without plugins. |
| `docs/product/vision.md`, other features | No direction change; only the glossary gains terms (T2). |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | three.js directly (tree-shaken named imports) behind a narrow adapter; no R3F | Imperative game loop (camera flights, per-frame interpolation, particles) doesn't benefit from a declarative bridge; smallest dep surface + bundle; node-testable scene graph; React-version independent | R3F + drei — rejected (extra deps incl. test renderer, React peer coupling, reconciler overhead); hand-rolled WebGL / CSS 3D — rejected (visual ceiling or build cost; see spec § 3D rendering library decision) |
| D-2 | Pure `game/**` core with injected time/random/motion; renderer is a leaf | Maximizes tested surface under the existing node Vitest setup with no DOM dependency; future server-authority work can reuse the same reducer core | Logic inside React components — rejected (untestable without jsdom); logic inside three.js objects — rejected (couples rules to rendering) |
| D-3 | Engine snapshot + ordered intents as the only engine→render/UI surface | Snapshot drives HUD (referential stability for React) and scene state; intents drive one-shot effects (explosion/face/level) without back-channels | Event-emitter per concern — rejected (order/lifecycle ambiguity); scene reading engine internals — rejected (coupling, untestable) |
| D-4 | Instanced mini-cubes (one `InstancedMesh` per face) + `Points` starfield/particles | Bounded drawables (AC-16), simple instance-id picking, easy dispose | One `Mesh` per mini-cube — rejected (150+ objects; picking/disposal overhead) |
| D-5 | Node-only tests; no jsdom/RTL; React verified by SSR markup + thin effects | Repo convention (testing-criteria feature): DOM env is a new dependency and was deliberately avoided; effects are deliberately thin (session owns logic) so the residual is small and documented | jsdom + RTL — deferred (Q-8) |
| D-6 | Coverage: no new exclusions; residual = thin React effect bodies + real GL context (mocked in one test) | Honest and small; if the gate cannot clear 80, tasks report `blocked` — no carve-outs | Excluding `App.tsx`/`GameCanvas.tsx` — rejected (exclusion gaming) |
| D-7 | rAF loop with hidden-tab pause; pixel ratio capped at 2; disposable resources | 60 fps + battery/memory hygiene with structural, testable evidence (no fps benchmark available in CI) | setInterval loop — rejected (background throttling, drift); uncapped DPR — rejected (mobile GPU cost) |
| D-8 | Gestures: 40 px tap/drag threshold, one 90° step per gesture, queue ≤ 1; arrows = steps; WASD cursor | Predictable, motion-sickness-friendly, keyboard-complete; simple deterministic state | Free-orbit + snap — rejected (ambiguous tap targets); continuous rotation while dragging — rejected (feel/complexity) |
| D-9 | Reduced motion as an injected motion source with a pinned constant profile | Testable at both engine and session level, including live toggle; keeps accessibility an explicit behavior not a wish | CSS-only `@media` handling — impossible (canvas animation); ignoring the preference — rejected (vision principle) |
| D-10 | All visuals procedural; no assets | Zero loads, deterministic star/particle layouts testable with seeded random, smallest bundle | Textured sprites/models — rejected (assets, CORS, memory, testability) |
| D-11 | Keyboard/gamepad-style cursor model for mini-cube selection | Full keyboard operability without DOM-shim hacks over WebGL; pure-logic and testable | DOM overlay buttons per mini-cube — rejected (positioning sync complexity, defeats the renderer model) |
| D-12 | Two deps only (`three`, `@types/three`), flagged at the user checkpoint | AGENTS.md ⚠️ Ask first; version-aligned; nothing else needed to meet the ACs | R3F/drei/tween libs — rejected (D-1); jsdom — deferred (D-5) |

## Risks & mitigations

- **User declines `three`** (Q-1) → building is blocked at the approval checkpoint by design; the fallback (CSS 3D) needs a spec revision — no silent workaround.
- **three.js DOM-bound import at module load** → prefer granular imports from `three` core; if a probe fails in node, import from the specific source module (`three/src/...` via the package's `./src/*` export) and record it; tests must still exercise real three.js objects (spec Assumptions).
- **Scene/particle code dragging coverage down** → node-testable by design (real objects, fake adapter, seeded random); per-task workspace-scoped coverage runs catch a dip early; if a metric cannot honestly clear 80, report `blocked` (D-6).
- **React 19 `useSyncExternalStore` snapshot churn** → engine snapshot referential-stability contract (AC-11) plus `getServerSnapshot` passthrough; App re-renders only on stats/phase/level changes.
- **Gesture/picking edge cases on mobile** (double-fire, scroll interference) → Pointer Events single path, `touch-action:none`, threshold boundary tests at 39/40/41 px, picking returns null on miss; manual pass steps recorded for the final log.
- **Hidden-tab pause bugs (frozen animations, duplicated loops)** → single scheduler owned by the session; visibility/stop/resume/dispose sequences pinned in `session.test.ts` with exact call counts.
- **Level-transition leaks (repeated rebuilds)** → `levelChanged` rebuild path disposes the old cube view/geometry/materials; AC-16 object-count assertions after simulated cycles.
- **Coverage aggregate sees intermediate tasks with partially-tested layers** → each task's own files land with their tests; workspace-scoped pre-gate per task; the final task runs the full gate and records per-AC evidence.
- **Pinned constants drift** → values live in one place (`game/types.ts` only for `GRID_SIZE`; `game/effects.ts` for the non-grid constants; `game/progression.ts` for styles; `ui/theme.ts` for colours) and consumers import them, never redefine (F2); tests assert exact values; changing them requires the spec revision trail (Q-2…Q-4).
- **Scope creep into economy/backend territory** → non-goals are explicit; Q-7 documents the hook-in seam only; the reviewer checks AC-19.

## Open questions

- Q-1…Q-9 mirror spec § Open questions (dependency approval; grid size; rotation feel; pacing; HUD extras; auto-rotate; future real-time hook-in; DOM test env; audio). Recommended defaults are pinned in the artifacts and in the constants tables; none blocks building except Q-1's checkpoint.

## Revision history

- r3 — 2026-10-18 — **mid-build amendment** (plan + tasks only; spec r2 and its ACs unchanged; no behavior change). Two internal inconsistencies found while building: (1) the session wiring called `pickMiniCube(…, cubeView, …)`, but the pinned `SceneView` exposed no cube-view handle — and since `levelChanged` rebuilds the cube internally, a cached handle would also be a stale-reference hazard. Pinned seam: `SceneView` gains a rebuild-aware `readonly cubeView` accessor (§ Render interfaces, chosen over a scene-owned `pick()` delegate so the AC-6 call-site stays in the session); § Session wiring now reads `sceneView.camera`/`sceneView.cubeView` at pick time. (2) The gesture-classification comment in § Input interfaces contradicted the AC-6 inclusive threshold semantics (exactly at the threshold is a tap — the landed 39/40/41 px boundary tests); corrected there, and the same mismatch in the landed `game/effects.ts` `TAP_DRAG_THRESHOLD_PX` doc comment is routed to T13 as a comment-only correction. Ownership per tasks r3: T13's `files_owned` gains the bounded additive `scene.ts`/`scene.test.ts` seam changes and the comment-only `effects.ts` edit; no new task, no dependency change.
