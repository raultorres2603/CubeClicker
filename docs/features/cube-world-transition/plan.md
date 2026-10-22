---
feature: cube-world-transition
revision: 2
---

# Plan — Cube World Transition (directional travel, mini-cube-built surface, random mini-cube counts)

## Architecture

No new layers and no new modules: the existing four-layer architecture (pure `game/**` core → `render/**` three.js adapter → `input/**` mapping → `session.ts`/`ui/**` shell) is unchanged. Dependency direction stays top→bottom; `game/**` stays DOM-free, three-free and now also **`Math.random`-free** (randomness enters only through the injected RNG); the scene still receives snapshots pull-style and drains intents in order; the engine's click/rotation semantics are untouched.

**State ownership additions (this feature):**

- The **engine** owns the level's grid size (drawn per level) and the travel direction (drawn at travel start) — pure values drawn from the injected RNG, exposed through two new snapshot fields (`gridSize`, `travelDirection`) and passed to the session/scene. The `levelChanged`/`travelStarted` intent shapes are **unchanged**.
- The **scene** owns the world geometry: the current cube's world position (`cubePosition`, starts at the origin), the travel flight origin (`travelFrom`, captured at the first travel snapshot), the travel offset (mapped from `snapshot.travelDirection` at the same capture), and the rebuild bookkeeping (a `levelChanged` intent marks the rebuild *pending*; the next `applySnapshot` performs it with the snapshot's style + grid size + direction — the session loop's pinned order `applyIntents → applySnapshot` makes this the same frame, so the rebuild still happens exactly once at the midpoint).
- The **session** wires the new data: at attach it injects `env.random` into the engine (`setRandomSource`) and passes the engine's `snapshot.gridSize` into `createSceneView`.

**Data flow (unchanged):** input → `engine.dispatch` → snapshot/intents → `scene.applyIntents`/`applySnapshot`/`update` → renderer. The directional flight is a pure function of `phaseProgress`, `travelFrom` and the captured offset, evaluated in `applySnapshot`; the starfield anchor (already the camera's live pose) follows the lateral motion with zero change to `starfield.ts`.

**The cube surface.** `cube-view.ts` drops the per-face plates and their materials entirely and grows the tiles to flush, edge-to-edge coverage (`MINI_CUBE_TILE_RATIO = 1`); the body stays as the dark interior. The scene's `faceCleared` handling becomes a pure countdown (no opacity writes) so the face's last pop (160 ms) finishes before detachment.

## Interfaces / contracts

Pinned enough for an independent builder; wording may vary slightly if semantics hold. All `game/**` code is DOM-free and `Math.random`-free.

### `game/types.ts` (additions — additive, no existing export changes)

```ts
/** Per-level random grid range (spec AC-1). */
export const MINI_CUBE_GRID_MIN = 3;
export const MINI_CUBE_GRID_MAX = 7;

/** The four cardinal travel directions, in the pinned draw-order index. */
export type TravelDirection = 'left' | 'right' | 'top' | 'bottom';
export const TRAVEL_DIRECTIONS: readonly TravelDirection[] = ['left', 'right', 'top', 'bottom'];
```

### `game/engine.ts` (draws, snapshot fields, RNG fallback)

```ts
/** Draw order pinned (spec § 1/§ 3): grid at creation + each level advance; direction at travel start. */
function drawGridSize(random: () => number): number {
  return MINI_CUBE_GRID_MIN + Math.floor(random() * (MINI_CUBE_GRID_MAX - MINI_CUBE_GRID_MIN + 1));
}
// direction: TRAVEL_DIRECTIONS[Math.floor(random() * 4)]  (random() ∈ [0,1) ⇒ index 0..3)

/** Deterministic fallback when no random is injected (spec Assumptions): LCG seed 1,
 *  multiplier 1664525, increment 1013904223, modulus 2^32. Production always gets
 *  env.random via the session's setRandomSource — game/** never reads Math.random. */
function createSeededRandom(seed: number): () => number { /* inline LCG */ }

export interface EngineSnapshot {
  /* … existing fields unchanged … */
  /** The current level's grid edge (3..7); changes exactly at the level advance. */
  gridSize: number;
  /** The drawn direction of the running travel; null in intro/playing. */
  travelDirection: TravelDirection | null;
}

export interface GameEngine {
  /* … existing members unchanged … */
  /** Replaces the RNG source (the session's attach wiring); future draws use it. */
  setRandomSource(random: () => number): void;
}
```

- `createEngine(options)`: `const random = options.random ?? createSeededRandom(1)`; `let gridSize = options.gridSize ?? drawGridSize(random)`; `options.gridSize` skips the grid draws for every level.
- `startTravel()`: draws the direction once (`TRAVEL_DIRECTIONS[Math.floor(random() * 4)]`), stores it, and the snapshot carries it during `travel`; cleared (null) when `advanceTravel` switches to `playing`.
- `advanceLevel()`: unchanged except `board = createBoard(gridSize)` where `gridSize` was re-drawn (unless the override). The `levelChanged` intent keeps its exact current shape `{ kind: 'levelChanged'; style }`.
- `buildSnapshot()` gains the two fields; `invalidate()` coverage unchanged (both change only at level/travel boundaries).

### `game/session.ts` (wiring only)

- `attach`: before the first frame — `engine.setRandomSource(env.random)`; the scene creation becomes `createSceneView({ style: engine.getSnapshot().style, random: env.random, gridSize: engine.getSnapshot().gridSize })`. Nothing else changes (the loop order `applyIntents → applySnapshot → update → render` already supports the pending-rebuild design).

### `render/cube-view.ts` (flush tiling, plates removed)

```ts
export const MINI_CUBE_TILE_RATIO = 1;   // was 0.9 — flush, edge-to-edge tiles (spec AC-2)
// PLATE_OFFSET removed; plate meshes, plate materials and FaceRecord.plate are deleted.

export interface CubeView {
  readonly group: Group;                          // children: body + one InstancedMesh per live face
  readonly body: Mesh;                            // the dark interior (style.cubeColor)
  readonly faces: ReadonlyMap<FaceId, InstancedMesh>;
  // plateMeshes REMOVED (spec AC-2)
  hideMiniCube(id: MiniCubeId, instant?: boolean): void;   // unchanged (pop over the flush tile)
  isMiniCubeHidden(id: MiniCubeId): boolean;
  update(dtMs: number): void;                     // unchanged
  settlePops(): void;                             // unchanged
  removeFace(faceId: FaceId): void;               // cancels pops, detaches + disposes mesh/material once; no plate writes
  applyStyle(style: CubeStyle): void;             // body + live tile materials only
  dispose(): void;                                // unchanged contract (fewer resources)
}
```

- `tileSize = cellSize * MINI_CUBE_TILE_RATIO` = `CUBE_SIZE / gridSize` on the face axes; `tileScale` unchanged in form; tile *centres* unchanged (`tileDistance` 2.625), so the pinned first/last positions hold; the outermost tiles' outer faces reach `CUBE_HALF_SIZE` exactly.

### `render/scene.ts` (world positions, directional flight, snapshot-driven rebuild)

```ts
/** Distance between consecutive cube world positions (spec AC-3). */
export const CUBE_SPACING = 24;

/** World offsets of the four directions; screen axes = world axes (identity camera). */
export const TRAVEL_DIRECTION_OFFSETS: Readonly<Record<TravelDirection, { x: number; y: number }>> = {
  left: { x: -CUBE_SPACING, y: 0 }, right: { x: CUBE_SPACING, y: 0 },
  top: { x: 0, y: CUBE_SPACING }, bottom: { x: 0, y: -CUBE_SPACING },
};

/** Pure directional travel pose (spec AC-3): lateral easeInOutQuad toward the offset,
 *  z = 12 + 78·travelSwing(p); target = (x(p), y(p), 0) — identity quaternion at every p. */
export function travelCameraPose(
  progress: number,
  fromX: number, fromY: number,
  direction: TravelDirection | null,   // null (defensive) → zero offset
  outPosition: Vector3, outTarget: Vector3,
): void;
```

Scene state and behavior:

- `cubePosition = new Vector3(0, 0, 0)` (current cube's world position); `travelFrom = new Vector3()` + `travelOffset = { x: 0, y: 0 }` captured when the phase first becomes `travel` (tracked via a `lastPhase` variable); `currentStyle`/`currentGridSize` (init: construction values); `pendingLevelChanged: CubeStyle | null`.
- `applyIntents`: `explosion` unchanged; `faceCleared` → countdown record (no opacity writes; on completion `cube.removeFace`); `levelChanged` → `pendingLevelChanged = intent.style` (no rebuild here); `travelStarted` → no-op (unchanged).
- `applySnapshot` (order pinned): (1) store `reducedMotion`; (2) **rebuild step** — if `pendingLevelChanged !== null` or `snapshot.style.id !== currentStyle.id` or `snapshot.gridSize !== currentGridSize`: rebuild exactly once — dispose the old view (once), `cubePosition` advances by the offset when `pendingLevelChanged !== null` (offset from `snapshot.travelDirection`, zero if null — defensive, tested), build `createCubeView(style, gridSize)`, set `cube.group.position = cubePosition`, clear `pendingLevelChanged`; (3) camera (`applyCamera`): `intro` branch unchanged; `travel` branch — capture `travelFrom`/`travelOffset` on the `lastPhase` transition, then `travelCameraPose(progress, travelFrom.x, travelFrom.y, snapshot.travelDirection, …)`; `playing` and reduced branches — rest over `cubePosition` `(cx, cy, 12)` looking at `(cx, cy, 0)`; (4) orientation interpolation; (5) reduced-motion `settlePops`. `update`/`dispose` unchanged except the countdown replaces the fade writes.
- `introCameraPose` and `snapToQuarterTurns` are unchanged.

### `render/picking.ts` — unchanged

The `Math.round(Math.sqrt(mesh.count))` decode is exact for square grids (count = N², N ∈ 3..7). `picking.test.ts` only gains multi-size cases.

## File inventory

| Path | New/Edit | Purpose | Owner task |
| --- | --- | --- | --- |
| `src/frontend/src/game/types.ts` | Edit | +`MINI_CUBE_GRID_MIN/MAX`, +`TravelDirection`, +`TRAVEL_DIRECTIONS` | T1 |
| `src/frontend/src/game/engine.ts` | Edit | Grid/direction draws, snapshot fields, `setRandomSource`, LCG fallback | T1 |
| `src/frontend/src/game/engine.test.ts` | Edit | Draw-order pins, seeded sequences, snapshot lifecycles, LCG fallback, re-pinned seeded burst, retained groups | T1 |
| `src/frontend/src/game/board.test.ts` | Edit | `createBoard(3..7)` counts/ids | T1 |
| `src/frontend/src/game/session.ts` | Edit | `setRandomSource(env.random)` + `gridSize` pass-through | T1 |
| `src/frontend/src/game/session.test.ts` | Edit | Snapshot fixture re-pin (+2 fields), grid-size/random wiring tests, fake-engine `setRandomSource` | T1 |
| `src/frontend/src/App.test.tsx` | Edit (test-only fixture) | `snapshotFor` gains `gridSize`/`travelDirection`; no UI change | T1 |
| `docs/product/glossary.md` | Edit | Updated mini-cube/face/cube level definitions + new **cube world position** | T1 |
| `src/frontend/src/render/cube-view.ts` | Edit | Flush tiles, plates removed, interface change | T2 |
| `src/frontend/src/render/cube-view.test.ts` | Edit | Flush-tiling geometry (N = 3/5/7), plate-free children, pop/removal/disposal | T2 |
| `src/frontend/src/render/picking.test.ts` | Edit | Multi-size pick cases (3×3, 7×7) | T2 |
| `src/frontend/src/render/scene.ts` | Edit | `CUBE_SPACING`, offsets, `travelCameraPose`, world positions, snapshot-driven rebuild, countdown | T2 |
| `src/frontend/src/render/scene.test.ts` | Edit | Pose tables ×4, travelFrom regression, pending-rebuild, framing gates, rest pose, coverage extensions, reduced swap, retained groups | T2 |
| `docs/features/cube-world-transition/build-log-T1.md` … `-T3.md` | New | Per-task evidence | T1…T3 |

## Files intentionally unchanged

| Path | Why |
| --- | --- |
| `src/frontend/src/game/{board,rotation,progression,effects}.ts` (+`board.test.ts` except the multi-size additions in T1) | No model/easing/style change; `GRID_SIZE` and the effect constants keep their homes |
| `src/frontend/src/render/{starfield,particles,webgl,picking}.ts` (+`starfield.test.ts`, `particles.test.ts`, `webgl.test.ts`) | The anchored cone, the expansion table and the pool need no change; only `picking.test.ts` gains multi-size cases |
| `src/frontend/src/input/**`, `src/frontend/src/browser-env.ts`, `src/frontend/src/App.tsx`, `src/frontend/src/ui/**`, `src/frontend/src/main.tsx`, `src/frontend/src/ws/**`, `src/frontend/index.html` | No input/UI/boundary change (`browser-env.ts` already exports `random`; the session now forwards it) |
| `src/frontend/package.json`, `package-lock.json`, configs, `compose*.yaml`, Dockerfiles, `src/backend/**`, `tests/e2e/**`, `README.md`, `docs/features/cube-game-frontend/**`, `docs/features/cube-visual-polish/**`, `docs/features/cube-visual-polish-followup/**`, `docs/architecture/**` | No dependency, container, backend, or accepted-artifact change; the glossary is the only doc edit (T1) |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Random **square** grid N ∈ [3, 7] per level (option (a); N² per face, 6N² per cube) | One integer per level keeps "all faces identical" trivially; the flush tiling stays a uniform grid (a partial last row would reintroduce the uncovered-strip look this feature removes); board/cube-view are already `gridSize`-parameterized and picking's `√count` decode stays exact for square counts; N = 5 at draw 0.5 keeps the accepted tests' 25-per-face assertions valid | Arbitrary per-face count C with a near-square partial row (Q-1/b) — rejected: layout state per face, picking decode change, visible uncovered strip |
| D-2 | Flush tiles (`MINI_CUBE_TILE_RATIO = 1`) + plates removed; body = dark interior | "A giant cube made of mini-cubes" is exactly edge-to-edge tiling; the plates were the visible "black face" between tiles; the body behind removed tiles is the pinned interior (no lit plate), keeps AC-16 ceilings *lower* than today | Volumetric N³ lattice (Q-3) — rejected (board/picking/instancing rework); keeping plates but recolouring — rejected (still a face showing between tiles); hollow interior — rejected (see-through/culling complexity) |
| D-3 | Engine owns grid size + direction as pure seeded draws; scene owns world coordinates and maps direction → `CUBE_SPACING` offsets | `game/**` stays three-free and deterministic; the future online occupancy hook replaces exactly these two seams (direction draw + offset map) with server-assigned positions; screen axes = world axes because the camera is always axis-aligned | Scene-local randomness — rejected (untestable, breaks determinism); engine owning world units — rejected (three-free purity) |
| D-4 | Directional flight = lateral `easeInOutQuad(p)·offset` + retained z swing `12 + 78·travelSwing(p)`, looking straight down the view axis | The departure half moves the camera *toward* the next cube while pulling back ("going away … depending on where the other cube is"); identity quaternion at every p preserves the followup's quaternion property and the starfield coverage argument (translation only); continuity at p = 0 and p = 1 with the playing rest pose (no snap) | Fully three-segment paths with separate look targets — rejected (extra constants, quaternion gates break); re-using `travelSwing` for the lateral (0→1→0) — rejected (wrong direction of travel, the camera would return laterally) |
| D-5 | Spawn data rides the **snapshot** (`travelDirection`, `gridSize`); `levelChanged` marks the rebuild **pending** and `applySnapshot` performs it (session loop order makes it the same frame); the intent shapes stay untouched | The departure needs the direction from the first travel frame (before any midpoint intent exists) and the rebuild needs the post-advance grid size (fresh board) — both only in the snapshot; keeping the intent shapes untouched limits the supersession ledger to scene mechanics and keeps every accepted engine test's intent equality valid | Direction/grid on a new intent at travel start — rejected (extra intent, and the grid size is only knowable at the midpoint); board-derived grid size — rejected (partial boards during play make `√count` wrong) |
| D-6 | **Sequential tasks** (T1 game layer → T2 render layer → T3 verify) | Two hard compile couplings force it: (1) the snapshot gains two required fields, and the hand-built fixtures in `session.test.ts`/`App.test.tsx` must be updated in the same change (workspace-wide typecheck is every task's gate — the followup's plan calls this the "snapshot-type landmine"); (2) `cube-view.ts`'s plate removal breaks `scene.ts`'s fade code, so cube-view and scene must land together. T1 therefore owns the whole game layer including its fixtures; T2 owns the render layer; mid-chain (after T1) levels > 0 render at level 0's grid size and out-of-range picks no-op — documented, resolved at T2 | Parallel T2 ∥ T3 (the followup's shape) — rejected: the snapshot-type landmine exists here (it did not for the followup); splitting cube-view from scene — rejected (breaking interface change) |
| D-7 | Engine RNG fallback = deterministic LCG(1); session injects `env.random` at attach via the additive `setRandomSource` | Satisfies the constraint "no `Math.random` in `game/**`" without weakening the engine-exists-from-creation contract (SSR/pre-attach snapshots use the LCG; gameplay gets real randomness at attach); additive method keeps the intent shapes untouched | Required `random` option — rejected (breaks the no-arg `createEngine()` surface and the pre-attach contract); lazy engine creation in attach — rejected (breaks the pre-attach `getSnapshot` contract pinned in `session.ts`) |

## Risks & mitigations

- **Snapshot-type landmine (D-6).** The two required snapshot fields break the hand-built fixtures in `session.test.ts` and `App.test.tsx`; T1 owns both files (App.test.tsx test-only), so every intermediate tree is green. `scene.test.ts`'s fixture derives from a real engine — no break.
- **`travelFrom` double-count.** After the midpoint rebuild advances `cubePosition`, the camera path must not re-derive the lateral from the *new* position (it would double the offset). Mitigation: the flight origin is captured once at the travel-start transition; a pinned regression test rebuilds at p = 0.5 and asserts the p = 0.75 pose still matches the table.
- **Pending-rebuild ordering.** A `levelChanged` intent must not rebuild before the snapshot carries the new style/grid/direction. The session loop order (intents then snapshot) guarantees it; scene tests pin "intents alone rebuild nothing".
- **Mid-chain visual inconsistency (after T1).** Levels > 0 render at level 0's grid size until T2; picks outside the rendered grid produce ids the board rejects (no-op) — documented, no test claims otherwise mid-chain.
- **Seeded-sequence re-pins.** The level-0 grid draw shifts the seeded-burst expectation in `engine.test.ts` (the `seededRandom(42)` test) and the former "platform random" fallback test becomes the pinned-LCG test — both owned by T1 and re-pinned with concrete values.
- **Coverage at the new poses.** The corner-ray gates at `(12, 0, 90)`/`(24, 0, 12)` use the real camera; the margin (cone inradius 1.2513 vs viewport circumradius ≤ 1.1840) is far from any boundary — a failure means the constants diverged, loudly, not flakily.
- **Reduced-motion teleport.** The "rest over the current cube" branch reads the live `cubePosition`, so the midpoint rebuild automatically teleports the camera — pinned by a dedicated test (no flight, no expansion, rest over the new cube after the advance).
- **Regression into the accepted artifacts.** The supersession ledger is the only bridge; `git diff` on the three accepted feature directories and all container/config paths must be empty at the final gate.
- **Bundle/coverage regressions.** Plate removal deletes geometry/material code and the changes add one pure function + constants — the bundle can only shrink; per-task workspace coverage runs catch any dip; if a metric cannot honestly clear 80, report `blocked` (no carve-outs).

## Open questions

- Q-1…Q-8 mirror spec § Open questions (per-face count scheme; grid range; surface vs volumetric; direction set; spacing/geometry; old-cube disposal; advance timing; future online occupancy). Recommended defaults are pinned in the artifacts; every alternative is a constant-only change with a spec-revision note.

## Revision history

- r1 — 2026-10-21 — initial draft (planning phase).
- r2 — 2026-10-21 — verification pass per the T2 block (`build-log-T2.md`, used as the review artifact). **No substantive change needed:** the plan pins `travelCameraPose` only by its formula (§ Interfaces comment, D-4) and never repeats the superseded 9-row table's values, so the plan was already on the formula-authoritative side of the contradiction; the spec r2 ruling (a) — formula authoritative, pose tables corrected — therefore leaves every plan statement intact. D-4's rationale is unchanged and still holds under the correction (the z column is the retained `travelSwing`, preserving the camera↔starfield coupling; the lateral is `easeInOutQuad`, monotonic toward the spawn). Revision bumped for traceability only.
