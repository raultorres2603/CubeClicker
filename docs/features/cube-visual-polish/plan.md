---
feature: cube-visual-polish
revision: 1
---

# Plan — Cube Visual Polish (follow-up to cube-game-frontend)

## Architecture

No new layers and no new modules: the existing four-layer architecture (pure `game/**` core → `render/**` three.js adapter → `input/**` mapping → `session.ts`/`ui/**` shell) is unchanged, and every edit lands inside an existing file (plus its colocated test). Dependency direction stays top→bottom; `game/**` stays DOM-free and three-free; the scene still receives snapshots pull-style and drains intents in order; the engine's click/rotation/travel semantics are untouched except the cursor removal.

| Layer | Change |
| --- | --- |
| `game/effects.ts` (pure) | New pinned constants + two pure timeline functions (`popScaleAt`, `popColorMultiplierAt`) — the single home for the new non-grid constants (F2 convention: consumers import, never redefine) |
| `render/starfield.ts` | Travel input now drives the uniform x/y expansion `1 → 8` (`easeInOutQuad`) instead of the z-elongation streak; drift/identity unchanged |
| `render/particles.ts` | Material gains `depthTest: false`; `Points` gains `renderOrder = PARTICLE_RENDER_ORDER` (10); pool mechanics unchanged |
| `render/cube-view.ts` | Pop animation on `hideMiniCube` (+ `instant` mode, `update`, `settlePops`, per-face `instanceColor` buffers); exported `FACE_NORMALS`; highlight mesh/API removed; `removeFace`/`dispose` cancel records |
| `render/scene.ts` | New intro choreography (`introCameraPose` + `lookAt`), burst origin offset with quarter-turn snap, `cube.update` wiring, `settlePops` on reduced snapshots; highlight call removed |
| `render/picking.ts` | Doc comment only (highlight references removed) |
| `game/engine.ts`, `game/rotation.ts`, `input/keyboard.ts`, `ui/GameCanvas.tsx` | Keyboard selection cursor removed (events, state, snapshot field, key table, aria-label) |

**Data flow (unchanged):** input → `engine.dispatch` → snapshot/intents → `scene.applyIntents`/`applySnapshot`/`update` → renderer. The pop animation is driven by `scene.update` → `cube.update(dtMs)`; the travel expansion by `scene.update` → `starfield.update(dtMs, travelProgress)`; the intro choreography is a pure function of `phaseProgress` evaluated in `applySnapshot`.

## Interfaces / contracts

Pinned enough for an independent builder; wording may vary slightly if semantics hold.

### `game/effects.ts` (additions)

```ts
/** x/y expansion of the starfield layer at travel progress 1 (spec AC-1). */
export const TRAVEL_STARFIELD_SCALE = 8;
/** World units the burst origin moves out along the face normal (spec AC-3). */
export const BURST_ORIGIN_OFFSET = 0.5;
/** Pop-then-shrink animation (spec AC-4). */
export const MINI_CUBE_POP_MS = 160;            // total: expand + shrink
export const MINI_CUBE_POP_EXPAND_MS = 100;     // grow phase: 1 → peak
export const MINI_CUBE_POP_PEAK_SCALE = 1.1;    // peak scale factor
export const MINI_CUBE_POP_COLOR_STRENGTH = 0.3; // peak instanceColor multiplier delta
/** Tile scale factor of the pop at `elapsedMs` (linear expand 1→1.1 over 100 ms,
 *  linear shrink 1.1→0 over 60 ms; 0 at and after MINI_CUBE_POP_MS). */
export function popScaleAt(elapsedMs: number): number;
/** Per-instance colour multiplier of the pop: 1 → 1.3 over the expand phase,
 *  back to 1 over the shrink phase; 1 outside (0, MINI_CUBE_POP_MS). */
export function popColorMultiplierAt(elapsedMs: number): number;
```

Pinned outputs (exact, asserted in `effects.test.ts`): `popScaleAt`: 0→1, 50→1.05, 100→1.1, 130→0.55, 160→0, 161→0; `popColorMultiplierAt`: 0→1, 50→1.15, 100→1.3, 130→1.15, 160→1, 161→1. Both are total functions of elapsedMs only (three-free, DOM-free).

### `render/starfield.ts` (travel input semantics)

`update(dtMs, travelProgress?)` — drift unchanged; when `travelProgress` is provided:

```ts
const progress = Math.min(1, Math.max(0, travelProgress));
const expansion = 1 + (TRAVEL_STARFIELD_SCALE - 1) * easeInOutQuad(progress);
points.scale.set(expansion, expansion, 1);   // z stays 1: stars remain within the far plane
```

`easeInOutQuad` and `TRAVEL_STARFIELD_SCALE` imported from `../game/effects` (never redefined locally). Reduced motion needs no starfield change: the scene already holds the travel input at 0 under reduced motion, so the scale stays `(1,1,1)`.

### `render/particles.ts` (layering pins)

```ts
const PARTICLE_RENDER_ORDER = 10;   // above starfield/plates (default 0); particles draw last
// material: existing options plus  depthTest: false  (depthWrite stays false)
// points:  points.renderOrder = PARTICLE_RENDER_ORDER;  (frustumCulled stays false)
```

Pool contract (`spawn`/`update`/`activeCount`/`dispose`, cap semantics) is unchanged.

### `render/cube-view.ts` (pop + removal + normals)

```ts
/** Group-space unit outward normals, one per face (exact 0/±1 components). */
export const FACE_NORMALS: Readonly<Record<FaceId, Vector3>>;

export interface CubeView {
  readonly group: Group; readonly body: Mesh;
  readonly faces: ReadonlyMap<FaceId, InstancedMesh>;
  readonly plateMeshes: ReadonlyMap<FaceId, Mesh>;
  // REMOVED: readonly highlight: Mesh; highlightCursor(cursor): void; CursorAnchor; CURSOR_* constants
  /** Marks the id hidden (unpickable) and starts its pop animation; `instant` (reduced
   *  motion) zero-scales immediately with no record and no colour write. Idempotent:
   *  an id already animating or hidden is never restarted. */
  hideMiniCube(id: MiniCubeId, instant?: boolean): void;
  isMiniCubeHidden(id: MiniCubeId): boolean;
  /** Advances pop animations by `dtMs`: rewrites the instance matrix
   *  (basis · tileScale · popScaleAt(t), position preserved) and the instanceColor
   *  slot (popColorMultiplierAt(t) on all three channels); settled records are removed. */
  update(dtMs: number): void;
  /** Instantly zero-scales every running pop and clears the records (live reduced-motion switch). */
  settlePops(): void;
  removeFace(faceId: FaceId): void;   // additionally cancels that face's pop records
  applyStyle(style: CubeStyle): void; // instanceColor buffers untouched (style change rebuilds)
  dispose(): void;                    // clears records; otherwise unchanged
}
```

Construction changes: each face's `InstancedMesh` gains a static `instanceColor` buffer (`new InstancedBufferAttribute(new Float32Array(gridSize²·3), 3)`, filled with `1`s, `needsUpdate = true`) — idle rendering is byte-identical to today (white multiplier). The highlight mesh, its material, and their disposal entries are removed; cube-group children become exactly `[body, 6 InstancedMesh, 6 plates]` (13 objects). Pop records are `{ faceId, index, elapsedMs }` kept in one array; `hideMiniCube` pushes at most one per id, `update` advances all and removes settled ones, `removeFace` filters by face, `settlePops`/`dispose` empty it. Removed-face guard keeps today's behavior (record hidden index only, no matrix write).

### `render/scene.ts` (intro + offset + wiring)

```ts
/** Pure intro choreography (spec AC-2). Writes the camera pose for clamped `progress`
 *  into the caller-owned vectors — zero allocation per frame. Segments: search
 *  p∈[0,0.4] (position lerp (36,20,24)→(32,16,28), target fixed (0,30,−40)); find
 *  p∈[0.4,0.72] (position →(0,0,26), target →(0,0,0), both easeOutCubic(q=(p−0.4)/0.32));
 *  approach p∈[0.72,1] (z 26→12 easeOutCubic(q=(p−0.72)/0.28), target (0,0,0)). */
export function introCameraPose(progress: number, outPosition: Vector3, outTarget: Vector3): void;

/** Snaps components within 1e-9 of an integer to that integer (quarter-turn trig residue). */
export function snapToQuarterTurns(v: Vector3): Vector3;
```

- `applyCamera`: `intro` branch → `introCameraPose(progress, scratchPos, scratchTarget)` + `camera.lookAt(scratchTarget)`; `reducedMotion` branch → rest `(0,0,12)` + `lookAt(ORIGIN)` + `travelProgress = 0` (unchanged collapse); `travel` and `playing` branches unchanged (travel pull-away values identical to the predecessor).
- `applyExplosion`: **read the origin and normal first, then hide.** Order: `mesh = cube.faces.get(intent.faceId)`; if gone → `hideMiniCube(id, instant)` + spawn at `(0,0,0)` (unchanged fallback, no offset). Otherwise: `origin = instanceOrigin(mesh, id)`; `normal = snapToQuarterTurns(FACE_NORMALS[faceId].clone().transformDirection(cube.group.matrixWorld))`; `cube.hideMiniCube(id, reducedMotion)`; `origin.addScaledVector(normal, BURST_ORIGIN_OFFSET)`; `particles.spawn(intent.burst, origin, nowMs)`.
- `applySnapshot`: keep everything except the highlight call; after storing `reducedMotion`, when the snapshot reports reduced motion call `cube.settlePops()`.
- `update(dtMs)`: additionally calls `cube.update(dtMs)`.

### `game/engine.ts`, `game/rotation.ts`, `input/keyboard.ts` (cursor removal)

- `rotation.ts`: delete `Cursor`, `createCursor`, `moveCursor`, `reanchorCursor` (and the now-unused `clampToGrid` helper); keep `createOrientation`, `rotateStep`, `frontFace`, `interpolateRotation` and their exports unchanged; update the module doc.
- `engine.ts`: `GameEvent` = `introSkip | explodeMiniCube | rotate`; `EngineSnapshot` loses `cursor`; delete `cursor` state, `reanchor()`, `cursorId`, `sameCursor`, `moveCursorBy`, the `explodeCursor`/`cursorMove` dispatch arms, and the `reanchor()` calls in `applyStep`/`explode`; `advanceLevelAndRebuild` no longer resets a cursor. Everything else (gating, rotation machine, auto-rotate, travel sequencing, intents, snapshot stability) byte-for-byte unchanged in behavior.
- `keyboard.ts`: `PLAYING_KEY_EVENTS` = the four arrow rows only; `w/a/s/d/Enter/' '` → `null` (they are simply absent from the table; `intro` any-key skip and `travel` null are unchanged); update the doc table.
- `ui/GameCanvas.tsx`: aria-label → `Game canvas: click a mini-cube to explode it; drag or press the arrow keys to rotate the cube`.

### Test-fixture rework (the snapshot-type landmine)

`scene.test.ts`'s `snapshot()` helper stops writing a `cursor` literal: it builds the default snapshot from a real engine (`createEngine({ random }).getSnapshot()`) and spreads the overrides — so the helper compiles both before and after the `cursor` field leaves `EngineSnapshot` (the cursor-highlight tests, which passed `cursor:` overrides, are deleted in the same change). `session.test.ts` (line 410) and `App.test.tsx` (line 38) drop their `cursor` fields with the type change. No other file references `snapshot.cursor` after the render task lands.

## File inventory

| Path | New/Edit | Purpose | Owner task |
| --- | --- | --- | --- |
| `src/frontend/src/game/effects.ts` | Edit | +6 pinned constants, +`popScaleAt`, +`popColorMultiplierAt` | T1 |
| `src/frontend/src/game/effects.test.ts` | Edit | Pin constants + exact timeline values | T1 |
| `src/frontend/src/render/particles.ts` | Edit | `depthTest: false`, `renderOrder = PARTICLE_RENDER_ORDER` | T1 |
| `src/frontend/src/render/particles.test.ts` | Edit | Material/drawable pins (+ existing pool assertions retained) | T1 |
| `src/frontend/src/render/starfield.ts` | Edit | Uniform x/y travel expansion (replaces z-elongation) | T2 |
| `src/frontend/src/render/starfield.test.ts` | Edit | Expansion values, identity, drift, reduced-mode `(1,1,1)` | T2 |
| `src/frontend/src/render/cube-view.ts` | Edit | Pop animation + `instanceColor` + `FACE_NORMALS` + highlight removal | T2 |
| `src/frontend/src/render/cube-view.test.ts` | Edit | Pop timeline, idle `(1,1,1)` slots, instant/settle/removeFace/level-change behavior, highlight-free child list | T2 |
| `src/frontend/src/render/scene.ts` | Edit | `introCameraPose` + `snapToQuarterTurns`, offset burst origin, pop wiring, highlight call removal | T2 |
| `src/frontend/src/render/scene.test.ts` | Edit | AC-2 pose table + Frustum gates; expansion through scene; offset origins `(−2,2,3.125)`/`(3.125,2,2)`; pop-driven AC-5 rewrite; cursor tests removed; engine-backed `snapshot()` helper | T2 |
| `src/frontend/src/render/picking.ts` | Edit | Doc comment only (highlight references removed) | T2 |
| `src/frontend/src/render/picking.test.ts` | Edit | Remove the "picks through the cursor highlight" test | T2 |
| `src/frontend/src/game/rotation.ts` | Edit | Delete cursor model | T3 |
| `src/frontend/src/game/rotation.test.ts` | Edit | Delete cursor group; keep six-face reachability | T3 |
| `src/frontend/src/game/engine.ts` | Edit | Delete cursor events/state/snapshot field | T3 |
| `src/frontend/src/game/engine.test.ts` | Edit | Delete cursor groups/assertions; keep click/rotate/travel tests | T3 |
| `src/frontend/src/input/keyboard.ts` | Edit | WASD/Enter/Space removed from the playing table | T3 |
| `src/frontend/src/input/keyboard.test.ts` | Edit | Null-mapping tests; arrow tests retained | T3 |
| `src/frontend/src/game/session.test.ts` | Edit | Drop the `cursor` field from the snapshot fixture | T3 |
| `src/frontend/src/App.test.tsx` | Edit | Drop `cursor` from the injected snapshot; new aria-label in SSR markup | T3 |
| `src/frontend/src/ui/GameCanvas.tsx` | Edit | New pinned aria-label | T3 |
| `src/frontend/src/ui/GameCanvas.test.tsx` | Edit | Assert the new exact label | T3 |
| `docs/features/cube-visual-polish/build-log-T1.md` … `-T4.md` | New | Per-task evidence | T1…T4 |

## Files intentionally unchanged

| Path | Why |
| --- | --- |
| `src/frontend/src/game/{board,progression,types}.ts` (+tests) | No board/style/type change (cursor removal leaves `game/types.ts` untouched — `Cursor` never lived there) |
| `src/frontend/src/game/session.ts`, `src/frontend/src/browser-env.ts`, `src/frontend/src/render/webgl.ts` (+tests) | Session wiring never references the cursor; no lifecycle change |
| `src/frontend/src/input/gestures.ts` (+test), `src/frontend/src/ui/{Hud.tsx,theme.ts,app.css}` (+tests) | Unaffected behaviors |
| `src/frontend/src/App.tsx`, `src/frontend/src/main.tsx`, `src/frontend/src/ws/**`, `src/frontend/index.html` | Shell/live-region/scaffold unchanged (only the canvas label, owned by T3's `GameCanvas.tsx`) |
| `src/frontend/package.json`, `package-lock.json`, configs, `compose*.yaml`, Dockerfiles, `src/backend/**`, `tests/e2e/**`, `README.md`, `docs/features/cube-game-frontend/**`, `docs/product/glossary.md` | No dependency, container, backend, or predecessor-artifact change; no new glossary term |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Expansion = uniform x/y scale `1 → 8` eased with `easeInOutQuad`, replacing the z-elongation streak | The streak was invisible (screen-space point size + z-stretch) — the reported defect. With `S(p) = 1+7q > 1+6.5q = z_c(p)/12` (same easing as the pull-away), every star on screen moves strictly outward at every frame — a provable "expansion", never a reversal | Smaller scale — rejected (late-travel inward reversal, the defect again); constant-apparent-size tracking — rejected (reads as no expansion); per-star radial offsets — rejected (rebuilds/cost, no testability gain) |
| D-2 | Intro = pure three-segment function of `phaseProgress`, poses pinned as integer/quarter literals | Deterministic and node-assertable (position arrays + real `Frustum` gates); segment joins are continuous; the find beat decelerates into the centred pose (`easeOutCubic`) | Spline/random search path — rejected (non-deterministic); keeping a straight z-flight with a lateral pan added — rejected (does not read as "search then find") |
| D-3 | Burst-in-front = `depthTest: false` + `renderOrder 10` + forward spawn offset `0.5` along the face normal | Transparent geometry always draws after the opaque tiles; the depth-test removal eliminates surface occlusion; the offset makes the spawn point itself in front of the surface — all three pins are node-assertable | Directional bias of burst vectors toward the camera — rejected (changes burst math in `game/effects.ts`, couples to face orientation, weaker testability); depth-only — rejected (burst could still start inside the tile) |
| D-4 | Pop implemented with per-face static `instanceColor` buffers + plain records advanced by `cube.update` | No new drawables (AC-16 ceilings hold), per-instance independence, exact float timeline assertable on real matrices/buffers; colour flash is a uniform scalar multiplier (no colour-space conversion math in tests) | One `Mesh` per animating tile — rejected (drawable growth, dispose cost); animating the material colour per face — rejected (no per-instance independence for rapid clicks) |
| D-5 | Cursor removal = Option B (whole feature), with the aria-label updated and the trade-off documented | An invisible cursor (Option A) is an accessibility trap; the user dislikes the visible highlight; arrow rotation preserves a keyboard path. Removal is honest and shrinks the bundle | Option A (visual-only removal) — rejected (Q-1); restyled highlight — deferred as a future feature |
| D-6 | `snapshot()` test helper builds from a real engine snapshot (no `cursor` literal) | Removes the cross-task compile landmine: the helper stays valid before and after `EngineSnapshot` loses `cursor`, so the render task and the cursor-removal task never share a file. Pinned shape: `{ ...createEngine({ random }).getSnapshot(), phase: 'playing', phaseProgress: 1, ...overrides }` — the old literal defaults (playing phase, progress 1) are pinned explicitly on top, and the engine supplies the rest (stats, style, board, orientation, reduced-motion defaults are identical to the predecessor's helper) | Keeping the literal helper — rejected (the type change would force a cross-task edit of `scene.test.ts`) |
| D-7 | Quarter-turn snap (`snapToQuarterTurns`, 1e-9) on the transformed face normal | `cos(π/2) ≈ 6.12e-17` residue would otherwise leak into asserted positions (`(3.125, 2, 2.0000000000000003)`); genuine mid-animation normals are far from integers and pass through untouched | `toBeCloseTo` assertions — rejected (bounded-exception budget); asserting via the same pipeline — rejected (tautological/useless test) |
| D-8 | New constants live in `game/effects.ts` (F2 single-home convention) | Same convention as `STAR_COUNT`/`PARTICLE_POOL_CAP`; consumers import, never redefine; tests pin exact values | Render-local constants — rejected (drift risk across modules, precedent violation) |
| D-9 | All tasks sequential (`T1 → T2 → T3 → T4`), no `[P]` | Two genuine order constraints: T2 imports T1's constants/helpers; T3's removal of the `cursor` snapshot field requires T2's scene to have stopped reading it (compile-order safety). Parallelism would force shared-file edits | `[P]` anywhere — rejected (would violate `files_owned` exclusivity or leave a red intermediate tree) |

## Risks & mitigations

- **Frustum gate assertions are pose-sensitive** → poses were hand-verified with ≥ 9° margin against the 25° vertical half-angle (aspect-independent, since FOV is vertical); the tests use the real `Frustum` + `containsPoint`/`intersectsBox`, so any residual error fails the build loudly rather than shipping a wrong cinematic. If a pose fails, the builder reports `blocked` — pinned values change only via a spec revision (Q-4).
- **Exact-float assertions on f32-backed instance matrices** → tests assert `Math.fround(tileSize × factor)` with the pinned factors (the predecessor's existing pattern for `Math.fround(0.9)`); pure timeline math is asserted on f64 literals in `effects.test.ts`.
- **`instanceColor` interplay with `applyStyle`/rebuild** → the buffers are per-face and owned by the mesh; `applyStyle` never touches them, `levelChanged` rebuilds the whole view (buffers disposed with it); a test pins that idle slots read `(1,1,1)` after a style application.
- **Pop records leaking across face removal/rebuild/dispose** → `removeFace` filters by face, rebuild disposes the view, `dispose` clears records; AC-5 asserts object-count baseline and post-removal silence.
- **Mid-chain red tree from the snapshot-type change** → D-6 (engine-backed test helper) + the strict `T2 → T3` order; the builder runs the workspace test/coverage suite after each task.
- **Bundle/coverage regressions from deleted code** → removals can only shrink the bundle and reduce uncovered lines; per-task workspace coverage runs catch any dip; if a metric cannot honestly clear 80, report `blocked` (no carve-outs).
- **Scope creep into the predecessor's artifacts** → the supersession table is the only bridge; `git diff` on `docs/features/cube-game-frontend/**` must be empty at the final gate.

## Open questions

- Q-1…Q-5 mirror spec § Open questions (cursor removal scope — user checkpoint; expansion magnitude; colour-flash interpretation; intro choreography values; live-toggle pop collapse). All recommended defaults are pinned in the artifacts; only Q-1's choice changes structure (Option A would need a spec revision).

## Revision history

- r1 — 2026-10-20 — initial draft (planning phase).
