---
feature: cube-visual-polish
revision: 1
status: draft
created: 2026-10-20
updated: 2026-10-20
---

# Spec — Cube Visual Polish (follow-up to cube-game-frontend)

## Summary

Follow-up to the user's manual visual pass over the accepted `cube-game-frontend` feature. Five changes, all local to the frontend's rendering and input surface, none touching game rules, stats, the HUD, the live region, the backend, or the container path: (1) the galaxy backdrop now visibly **expands outward** during the travel transition (replacing the invisible z-elongation streak); (2) the intro becomes a **search → find → approach** cinematic — the camera searches the sky, the cube enters view and is centred, then a smooth eased approach lands exactly at the playing rest pose; (3) explosion particles **render in front of the clicked mini-cube** (pinned render-order/depth pins plus a spawn offset along the face normal); (4) a clicked mini-cube plays a **pop-then-shrink disappearance animation** with a bounded, subtle colour flash instead of vanishing instantly; (5) the **highlighted mini-cube (keyboard selection cursor) is removed entirely** — Option B: the WASD + Enter/Space selection feature is removed while arrow-key rotation stays, with the accessibility trade-off documented (the alternative is listed as Q-1).

Every value below is pinned so node tests assert exact scene state — no browser-only acceptance. The predecessor spec `docs/features/cube-game-frontend/spec.md` (r2) remains authoritative for everything not superseded here; § Supersessions lists the superseded behaviors by predecessor AC ID and this document never edits the predecessor's artifacts.

## Scope

### In scope

- Frontend workspace only (`src/frontend`): changes in `game/effects.ts`, `render/{starfield,particles,cube-view,scene,picking}.ts`, `game/{engine,rotation}.ts`, `input/keyboard.ts`, `ui/GameCanvas.tsx`, plus their colocated tests and `App.test.tsx` / `session.test.ts` cursor-related assertions.
- The five behaviors above, with pinned constants, exact values at pinned progress/times, reduced-motion collapses, and deterministic tests.

### Explicitly out of scope

- Game rules: board removal semantics, click/face stats, intents, phases, level progression, style cycling, rotation settle values — all unchanged (the engine's click path is untouched; only cursor-specific code is removed).
- HUD, the single live region, phase announcement copy, `ui/theme.ts`, `App.tsx` structure — unchanged.
- Backend, WebSocket, shared/cross-client state, persistence, container assets, CI, configs, `main.tsx`, `index.html` — unchanged.
- Audio, new dependencies, new drawables, browser automation, pixel/perceptual tests.
- Restyling the keyboard cursor as a different highlight (future feature if wanted — Q-1).

## Supersessions of cube-game-frontend behaviors

Everything in the predecessor spec stays in force **except** the following, which this feature supersedes by AC ID:

| Predecessor AC | Superseded behavior | Replaced by (this spec) | Retained from that AC |
| --- | --- | --- | --- |
| **AC-3** (travel visual) | The starfield "streak": z-axis elongation scale `(1,1,1) → (1,1,1.5)` as the travel-progress visual | Uniform x/y expansion `1 → 8` eased with `easeInOutQuad` over the same travel-progress input (AC-1). The streak is dropped (invisible: point size is screen-space, so z-stretch changed nothing on screen — the reported defect's root cause) | Black background, exactly one `Points` with `STAR_COUNT` stars, deterministic seeded layout, slow drift, never rebuilt across frames |
| **AC-5** (click/explosion instant hide) | The instance is hidden instantly at intent application; the burst plays at the exact mini-cube origin | A 160 ms pop-then-shrink animation with a bounded colour flash (AC-4); the burst spawns `BURST_ORIGIN_OFFSET` in front of the surface and the particle drawable carries pinned depth/render-order values (AC-3) | Board removal, `clicks +1` at dispatch, one `explosion` intent per removal, repeat-click no-op, `EXPLOSION_DURATION_MS` burst lifetime, pool cap, other mini-cubes clickable throughout |
| **AC-8** (keyboard selection cursor) | Visible highlight + WASD movement + Enter/Space explode + cursor re-anchoring | Feature removed entirely (AC-6): no highlight mesh, no cursor state/events, WASD/Enter/Space map to nothing. Arrow-key rotation (predecessor AC-7) stays | Keyboard rotation reaching all six faces (AC-7); intro any-key skip (AC-2); canvas focus ring |
| **AC-22** (intro flight) | Intro path `(0,0,60) → (0,0,18)@0.5 → (0,0,12)`, `easeOutCubic`, straight in | Search → find → approach choreography (AC-2), landing exactly at rest `(0,0,12)` | Rest pose, FOV 50 / near 0.1 / far 200, travel pull-away `(0,0,12)→(0,0,90)` with `easeInOutQuad` (`(0,0,21.75)`@0.25, `(0,0,51)`@0.5), reduced-motion no-fly collapse |
| **AC-1** (pinned canvas aria-label) | The exact aria-label string mentions `W A S D … Enter or Space` | New pinned string without cursor keys (AC-6) | `tabindex="0"`, `touch-action:none`, HUD markup and zero-state texts, skip-hint copy |

No other predecessor behavior changes: rotation settle math, face destruction/fade, all-faces-gone travel sequencing and style cycling, live HUD stats and snapshot stability, pointer gesture classification and front-face picking gate, reduced-motion profile values, frame-loop lifecycle and disposal, bounded drawables (`≤ 6 InstancedMesh` + one starfield `Points` + one cube body — the highlight removal only *reduces* counts), coverage bar, scope discipline, no-new-dependencies, bundle budget — all in force.

## UX behavior (pinned)

### 1. Travel backdrop expansion (supersedes the AC-3 streak)

During `travel`, the starfield layer scales uniformly in the view plane: `scale = (S, S, 1)` with `S = 1 + (TRAVEL_STARFIELD_SCALE − 1) · easeInOutQuad(progress)`, `TRAVEL_STARFIELD_SCALE = 8`, driven by the existing travel-progress input (0..1, clamped) the scene already feeds. The x/y-only scaling keeps every star inside the camera's far plane (z is untouched; stars stay within `z ∈ [−60, −8]`, distance from the camera ≤ 150 < 200 even at the travel extreme). Design guarantee: because the camera's pull-away eases with the *same* `easeInOutQuad` (z: `12 → 90`, i.e. `z_c(p)/12 = 1 + 6.5·q(p)`), and `S(p) = 1 + 7·q(p) > 1 + 6.5·q(p)` for every `p > 0`, every star that is on screen at any moment moves strictly outward (radially away from the screen centre) for the whole transition — a visible expansion at every frame, never a reversal. The same `Points` object persists (no rebuild); drift is unchanged. Reduced motion: the expansion is skipped — the starfield scale stays `(1,1,1)` throughout `travel` (consistent with the AC-12 no-streak collapse; the scene already holds the travel input at 0 under reduced motion).

### 2. Intro search → find → approach cinematic (supersedes the AC-22 intro path)

The intro phase keeps `INTRO_DURATION_MS` (2500) and its skip semantics (tap/any key → `playing` immediately). The camera choreography is a deterministic pure function of `phaseProgress` (p, clamped 0..1), in three segments:

- **Search** (p ∈ [0, 0.4]): the camera pans slowly across the starfield — position lerps linearly `(36, 20, 24) → (32, 16, 28)` while looking at the fixed point `(0, 30, −40)`. The cube (extent `CUBE_SIZE` box centred on the origin) is **fully outside the frustum** for the whole segment.
- **Find** (p ∈ [0.4, 0.72]): the camera swings — position lerps `(32, 16, 28) → (0, 0, 26)` and the look target lerps `(0, 30, −40) → (0, 0, 0)`, both eased `easeOutCubic` over `q = (p − 0.4)/0.32`. The cube **enters the frame** inside this segment: fully outside at p = 0.4 (bracket start), centre inside the frustum at p = 0.56, and **fully framed** (all eight corners inside) at p = 0.72, looking exactly at the cube.
- **Approach** (p ∈ [0.72, 1]): a smooth eased approach straight down the view axis — position `(0, 0, 26) → (0, 0, 12)` with `easeOutCubic` over `q = (p − 0.72)/0.28`, always looking at the origin. It lands **exactly** at the playing rest pose `(0,0,12)` with the identity quaternion (p = 1).

Pinned pose table (exact values asserted by node tests):

| p | camera position | lookAt target |
| --- | --- | --- |
| 0 | `(36, 20, 24)` | `(0, 30, −40)` |
| 0.2 | `(34, 18, 26)` | `(0, 30, −40)` |
| 0.4 | `(32, 16, 28)` | `(0, 30, −40)` |
| 0.56 | `(4, 2, 26.25)` | `(0, 3.75, −5)` |
| 0.72 | `(0, 0, 26)` | `(0, 0, 0)` |
| 0.86 | `(0, 0, 13.75)` | `(0, 0, 0)` |
| 1 | `(0, 0, 12)` | `(0, 0, 0)` |

Skip: a skip event moves the phase to `playing`, and the scene's `playing` branch puts the camera at rest immediately (existing behavior). Reduced motion: no fly-through — the camera stays at rest `(0,0,12)` looking at the origin at every p (AC-22's collapse retained). The travel pull-away and the `playing` rest branch are unchanged. During the search the starfield fills the view; the cube exists in the scene the whole time and is "found" by the camera, never spawned late.

### 3. Particles render in front of the clicked mini-cube (defect fix, supersedes AC-5 layering)

Three pinned changes, all node-assertable:

1. **Depth pins:** the particle pool's `PointsMaterial` sets `depthTest: false` (keeps `depthWrite: false`) and the pool's `Points` object sets `renderOrder = PARTICLE_RENDER_ORDER` (`10` — above every other transparent drawable: starfield and face plates sit at the default 0). Transparent geometry always draws after the opaque cube tiles; disabling the depth test removes the cube-surface occlusion that hid the burst.
2. **Spawn offset:** the burst origin is the clicked mini-cube's world origin **plus** `BURST_ORIGIN_OFFSET` (`0.5` world units) along the face's outward normal in world space. With spawn jitter `±0.0625`, the nearest fragment starts ≥ 0.3125 in front of the mini-cube's outer surface.
3. **Fallback unchanged:** when the exploding face is already gone (no instance origin exists), the burst still plays at the cube centre `(0,0,0)` with no offset.

The face normal is read from the cube view's group-space normals transformed by the cube group's world rotation; components within `1e-9` of an integer are snapped to that integer (three's quarter-turn trig residue `cos(π/2) ≈ 6.12e-17` otherwise leaks into asserted positions). Reduced motion: no burst exists to place (unchanged).

### 4. Click disappearance animation: pop, shrink, subtle colour flash (supersedes AC-5 instant hide)

On an `explosion` intent, the mini-cube instance no longer zero-scales instantly. It plays a deterministic two-stage animation, total `MINI_CUBE_POP_MS` (160 ms):

- **Expand** (`0 → MINI_CUBE_POP_EXPAND_MS` = 100 ms): scale factor `1 → MINI_CUBE_POP_PEAK_SCALE` (1.1), linear — "expanding a little bit".
- **Shrink** (`100 → 160` ms): scale factor `1.1 → 0`, linear — "minimizing quickly" (60 ms).
- **Colour flash:** simultaneously, the instance's per-instance colour multiplier runs `1 → 1 + MINI_CUBE_POP_COLOR_STRENGTH` (1.3) over the expand phase and back to 1 over the shrink phase — a bounded brightness flash toward white (max delta 0.3; hue unchanged), never "drastic".

Pinned timeline (scale factor / colour multiplier):

| t (ms) | scale factor | colour multiplier |
| --- | --- | --- |
| 0 | 1 | 1 |
| 50 | 1.05 | 1.15 |
| 100 | 1.1 | 1.3 |
| 130 | 0.55 | 1.15 |
| 160 | 0 | 1 |
| ≥ 160 | 0 | 1 |

The factor multiplies the tile's base scale along the face's local axes; the position is preserved throughout. The end state is exactly the predecessor's hidden form: a zero-scale matrix keeping its slot and position, applied exactly once per id. Semantics that must NOT change: board removal, `clicks` increment, intent count, and burst lifetime stay synchronous at dispatch time (the engine's click path is untouched — predecessor engine click tests keep passing unmodified). The instance is marked hidden (unpickable) at intent time, before the visual animation — a tap on the animating tile can never double-fire.

Interactions, all deterministic:

- **Reduced motion:** the animation is skipped — the instance hides instantly at intent time with no flash and no record (consistent with AC-12's instant-removal profile). A live switch to reduced motion settles any running pops instantly (`settlePops`).
- **Rapid clicks:** each explosion intent starts an independent per-instance animation; two records started 60 ms apart are 60 ms apart at every later time.
- **Repeat intent for the same id:** never restarts a running pop (engine already no-ops the second click; the view guards anyway).
- **Face cleared / plate fade:** the fade and face removal proceed unchanged; `removeFace` cancels that face's animation records.
- **Level change / dispose:** the rebuild path disposes the whole cube view (records go with it); `dispose()` is idempotent.

Resources stay bounded: the pop needs no new three.js objects (one static per-face `instanceColor` buffer — a typed array, not a drawable; all slots initialized to `(1,1,1)` so idle appearance is unchanged). The predecessor AC-16 ceilings still hold, and the 10-explosion-cycles object-count baseline test keeps passing.

### 5. Keyboard selection cursor removed (Option B — supersedes AC-8)

The whole keyboard selection cursor feature is removed: the accent highlight mesh, the cursor state (`Cursor`, `createCursor`, `moveCursor`, `reanchorCursor`), the `cursorMove` / `explodeCursor` events, the `cursor` field in `EngineSnapshot`, and the WASD / Enter / Space key bindings. What stays: arrow-key rotation (predecessor AC-7 — all six faces reachable), the intro any-key skip, the focusable canvas with its focus ring, and the pointer path. The canvas aria-label is updated to the new pinned string (supersedes AC-1's string):

`Game canvas: click a mini-cube to explode it; drag or press the arrow keys to rotate the cube`

**Accessibility trade-off (stated honestly):** keyboard-only players can still rotate and skip, but can no longer target or explode mini-cubes without a pointer — the game is no longer keyboard-complete. This is the documented consequence of the requested removal. Option A (remove only the visual highlight, keep an invisible cursor) was rejected: an invisible Enter/Space target is an accessibility trap worse than no feature. The HUD and the single live region are untouched; the AC-14 single-live-region rule is unaffected.

## User stories

- As a player, I want the galaxy to visibly expand during the travel transition, so the jump to the next cube feels like a real departure, not a frozen background.
- As a player, I want the intro to search the sky, find the cube on screen and then approach it smoothly, so entering the game feels like discovering the cube.
- As a player, I want the explosion burst to appear in front of the mini-cube I clicked, so the effect reads as the cube blowing outward toward me.
- As a player, I want the clicked mini-cube to pop slightly and shrink away with a subtle colour change, so clicking feels tactile instead of abrupt.
- As a player, I want no more highlight cursor over the mini-cubes (I find it distracting), while arrow keys still rotate the cube.
- As a player who prefers reduced motion, I want the same collapses as before — no flights, no expansion, instant hide, no bursts.

## Acceptance criteria

Verification notes: "the frontend workspace" means `src/frontend`. Evidence per AC: a test file asserting concrete values, or a command. All tests use concrete expected values (no banned matchers, no useless tests). Commands (from `AGENTS.md`): `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend` (pre-gate), full `npm run coverage` (final gate), `npm run build`. Transcripts recorded in `docs/features/cube-visual-polish/build-log-T<id>.md`.

- **AC-1 — Travel backdrop expansion.** Given travel progress `p`, the starfield `Points` scale is `(S, S, 1)` with `S = 1 + (TRAVEL_STARFIELD_SCALE − 1) · easeInOutQuad(clamp(p))` and `TRAVEL_STARFIELD_SCALE = 8`: `(1,1,1)` at 0, `(1.875, 1.875, 1)` at 0.25, `(4.5, 4.5, 1)` at 0.5, `(7.125, 7.125, 1)` at 0.75, `(8, 8, 1)` at 1 — asserted on the real `Points` object, through the scene wiring (snapshot `phase: 'travel'` + `update`) and directly. The starfield is never rebuilt (same `Points` identity across the travel), drift is unchanged (pinned rotation after `update(1000)`), and under reduced motion the scale stays `(1,1,1)` at every p. Evidence: `starfield.test.ts`, `scene.test.ts`.
- **AC-2 — Intro search → find → approach cinematic.** The pure function `introCameraPose(progress, outPosition, outTarget)` yields exactly the § 2 pose table (all 7 rows, positions and targets asserted as exact literals at the function level). Through `applySnapshot`, the camera follows it: exact position arrays at the pinned progress values; the camera quaternion is exactly the identity at p = 0.72, 0.86, 1 (axis-aligned, looking straight at the cube). Frustum gates with the real camera (`camera.aspect` 16/9, `updateProjectionMatrix`, `updateMatrixWorld`, `Frustum.setFromProjectionMatrix`): at p = 0, 0.2, 0.4 the cube's box (extent `CUBE_SIZE` centred at origin) has no intersection with the frustum (searching — the cube is off-screen); at p = 0.56 the cube centre is inside (found); at p = 0.72 all eight corners are inside (fully framed). At p = 1 the camera is at rest `(0,0,12)` with the identity quaternion. A `playing` snapshot (skip) puts the camera at rest immediately; under reduced motion the camera stays at rest at every intro p; the travel pull-away positions (`(0,0,21.75)`@0.25, `(0,0,51)`@0.5, `(0,0,90)`@1) are unchanged. Evidence: `scene.test.ts` (replaces the predecessor AC-22 intro tests), `effects.test.ts` easings unchanged.
- **AC-3 — Burst renders in front of the clicked mini-cube.** The particle pool's material has `depthTest === false`, `depthWrite === false`, and its `Points` has `renderOrder === 10` (pinned `PARTICLE_RENDER_ORDER`). On an explosion intent, the first fragment of a zero-jitter burst sits exactly at `instanceOrigin + BURST_ORIGIN_OFFSET (0.5) × worldFaceNormal`: front face `front:0:0` → `(−2, 2, 3.125)`; with `+1` yaw → `(3.125, 2, 2)` (quarter-turn residue snapped — components within `1e-9` of an integer snap to it); the gone-face fallback still spawns at `(0,0,0)` with no offset. Pool cap, recycling and release are unchanged (existing `particles.test.ts`/`scene.test.ts` assertions keep passing, updated only where the origin changed). Evidence: `particles.test.ts`, `scene.test.ts`.
- **AC-4 — Pop-then-shrink disappearance with bounded colour flash.** Pure math `popScaleAt` / `popColorMultiplierAt` (three-free, in `game/effects.ts`) yields exactly the § 4 timeline (scale 1 / 1.05 / 1.1 / 0.55 / 0 and multiplier 1 / 1.15 / 1.3 / 1.15 / 1 at t = 0 / 50 / 100 / 130 / 160, and 0 / 1 for every t ≥ 160). On an explosion intent the instance's matrix evolves through the timeline — elements `[0,5,10]` equal `Math.fround(tileSize × factor)` / `Math.fround(0.25 × factor)` with the position preserved — and the per-instance colour reads `(m, m, m)` with the pinned m. The end state is a zero-scale matrix reached exactly once per id. Idle instances read `instanceColor (1,1,1)` and their material colour is unchanged. Board removal, `clicks +1`, intent count and burst lifetime stay synchronous (predecessor engine click tests pass unmodified — evidence by inspection of the untouched engine click path). Reduced motion: instant zero-scale at intent time, no flash, no record. Evidence: `effects.test.ts`, `cube-view.test.ts`, `scene.test.ts`.
- **AC-5 — Pop interactions and bounded resources.** Two rapid intents on the same face start independent animations (second record's factor trails the first by the spawn-time gap — pinned at 60 ms). A repeated intent for an already-animating id does not restart its animation. `removeFace` cancels that face's records (no writes, no growth); `levelChanged` and `dispose()` clear everything. No new drawables are created (one static per-face `instanceColor` buffer); after 10 explosion cycles the scene's object count returns to baseline (existing AC-16 test keeps passing). A live reduced-motion switch settles running pops instantly (`settlePops` — all animating instances zero-scaled, records emptied). Evidence: `cube-view.test.ts`, `scene.test.ts`.
- **AC-6 — Keyboard selection cursor removed (Option B).** `game/rotation.ts` exports no `Cursor`/`createCursor`/`moveCursor`/`reanchorCursor`; `game/engine.ts` has no `cursorMove`/`explodeCursor` events and `EngineSnapshot` has no `cursor` field; `input/keyboard.ts` maps `w`/`a`/`s`/`d`/`Enter`/`' '` (case-insensitive for letters) to `null` in `playing` while the four arrow keys still map to rotation; `render/cube-view.ts` has no highlight mesh or `highlightCursor` (cube group children = body + 6 `InstancedMesh` + 6 plates, exact count asserted); `scene.ts` never updates a highlight. `ui/GameCanvas.tsx`'s canvas `aria-label` is exactly the § 5 pinned string (asserted in `GameCanvas.test.tsx` and the `App.test.tsx` SSR markup); the HUD markup and the single live region are byte-identical to the predecessor. Arrow-only keyboard rotation still reaches all six faces (predecessor AC-7 tests retained), and the intro any-key skip still works. Evidence: `rotation.test.ts`, `engine.test.ts`, `keyboard.test.ts`, `cube-view.test.ts`, `scene.test.ts`, `picking.test.ts` (highlight gate test removed), `App.test.tsx`, `GameCanvas.test.tsx`, `session.test.ts`.
- **AC-7 — Supersession ledger and regression gate.** The only predecessor behaviors that change are those in the § Supersessions table (AC-3 travel visual, AC-5 instant hide/layering, AC-8 cursor, AC-22 intro path, AC-1 aria-label string); every other predecessor AC holds: board/rotation/progression logic, face destruction and fade, travel sequencing and style cycling, HUD stats and snapshot stability, gesture classification and front-face pick gate, reduced-motion values (plus the AC-4 collapse), frame-loop lifecycle and disposal, bounded drawables (the highlight removal only reduces counts), single live region, scope discipline, no new dependencies (`three` 0.186.1, named imports only), bundle ≤ `BUNDLE_BUDGET_GZ_KB`. `npm run lint`, `npm run typecheck`, `npm test`, and `npm run coverage` (both workspaces ≥ 80 statements/branches/functions/lines; frontend pre-gate per task) all exit 0; `npm run build` succeeds within the budget; backend/ws/container/config files and `main.tsx` are byte-identical (git diff empty). Evidence: final build log with the per-AC table and raw transcripts; reviewer re-run at the code gate.

## Non-goals

- No change to game rules, stats, intents, phase sequencing, level progression, or style values (cursor-removal aside, the engine's click/rotate/travel paths are untouched).
- No HUD, live-region, theme, or `App.tsx` structural changes; no copy changes beyond the canvas aria-label.
- No new dependencies, no `three/addons`, no new drawable types, no shaders/assets; bundle budget unchanged.
- No backend/WS/persistence/economy code; no container, compose, Dockerfile, CI, or config changes; `ws/connection.ts` and `main.tsx` untouched.
- No browser automation, no pixel/perceptual tests; the manual visual pass is a checklist, not an AC.
- No restyle of the keyboard cursor (Q-1); no audio; no settings menu.

## Boundaries

- ✅ Always: keep `game/**` pure and DOM-free; named tree-shakeable imports from `three`; tests with concrete expected values beside every behavior change; run lint, typecheck, tests, and the coverage command before reporting done; record raw evidence in `build-log-T<id>.md`; stage only `files_owned` per task.
- ⚠️ Ask first: any new dependency (none needed); any pinned-constant deviation from this spec (Q-2…Q-4 are constant-only tuning); touching any file outside a task's `files_owned`; any coverage exclusion or threshold change.
- 🚫 Never: weaken assertions (banned matchers, snapshot-only, assertion-free, useless tests); exclude production code from coverage; touch `.env*`, secrets, backend/container files, `main.tsx`, `ws/connection.ts`, or configs; use `import *` from `three`; read browser globals inside `game/**`; push; rewrite the predecessor's spec/plan/tasks to match this change (this spec supersedes it, it does not edit it).

## Security considerations

- **No new dependencies, no supply-chain change.** The diff adds zero packages; `three`/`@types/three` stay exactly as resolved (0.186.1 / 0.186.0, lockfile untouched).
- **No user data, no storage, no network.** All changes are local visual/input edits; nothing outside session memory is written; no `.env*`.
- **Rendering safety unchanged.** Fully procedural geometry; no loaders, textures, or external assets; no `innerHTML`; static DOM copy only; React escapes numeric stats by construction.
- **Resource bounds as robustness.** The pop adds one static per-face colour buffer (bounded, typed array); animations are plain records advanced by the frame loop and cancelled on face removal/rebuild/dispose — nothing can grow without bound (AC-5).
- **Test integrity as a control.** The coverage bar and concrete-assertion rule protect the unchanged pure logic the future server-authority work depends on; `game/**` DOM-freedom is retained.

## Real-time impact

**None.** All five changes are local client-side visual effects and input mapping. No shared or cross-client state is created or read; connection lifecycle, reconnection, multi-client behavior, and server authority are out of scope exactly as in the predecessor (its § Non-goals and Q-7 stand).

## Containerization impact

**None expected.** Frontend source changes only: no new services, images, ports, environment variables, or health signals; no compose/Dockerfile/README change. The frontend image absorbs the diff through the existing build; the unchanged containerized smoke test (`npm run smoke`) remains the regression check at the final gate where the environment allows it.

## Testing strategy

- **Unit (Vitest, node environment, existing setup):** pure math — `effects.test.ts` pins the new constants (`TRAVEL_STARFIELD_SCALE` 8, `BURST_ORIGIN_OFFSET` 0.5, `MINI_CUBE_POP_MS` 160, `MINI_CUBE_POP_EXPAND_MS` 100, `MINI_CUBE_POP_PEAK_SCALE` 1.1, `MINI_CUBE_POP_COLOR_STRENGTH` 0.3) and the `popScaleAt`/`popColorMultiplierAt` timeline with exact literals; `keyboard.test.ts` pins the reduced key table; `rotation.test.ts` keeps the six-face reachability group.
- **Integration (same node environment — real three.js scene graph):** `starfield.test.ts` asserts the expansion values and object identity; `particles.test.ts` asserts the material depth/render-order pins; `cube-view.test.ts` asserts the pop timeline on real instance matrices and `instanceColor` buffers, record cancellation, and the highlight-free child list; `scene.test.ts` asserts the intro pose table, the Frustum on-screen gates, the burst origin offset (including the quarter-turn snap), the reduced-motion collapses, and the unchanged travel/playing/disposal behaviors. `App.test.tsx`/`GameCanvas.test.tsx` assert the SSR markup with the new pinned aria-label; `session.test.ts` keeps its lifecycle coverage minus the removed cursor field.
- **E2E / container:** no browser automation (predecessor non-goal retained); `npm run smoke` unchanged, run at the final gate where the environment allows.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace (frontend pre-gate: `npm run coverage --workspace @cubeclicker/frontend`); config exclusions unchanged (only `src/main.tsx` + test patterns). The known honest residuals from the predecessor (thin `GameCanvas.tsx` effect body, mocked `WebGLRenderer`) carry over and stay small; if a metric cannot honestly clear 80, the task reports `blocked` — no carve-outs.
- **Manual visual pass (post-build; superset of the affected predecessor checklist steps — not an AC):** see § Manual visual pass.

### Manual visual pass

After `podman compose up --build` (http://localhost:5173):

1. Load → starfield visible; the camera *searches* the sky (the cube is not on screen at first), the cube enters view and is centred, then a smooth approach lands at the playing distance; skip hint visible; a click/key press skips straight to `playing`. *(supersedes checklist steps 1–2)*
2. Click a mini-cube → it pops slightly larger with a subtle flash, then shrinks away; the particle burst plays clearly **in front of** the cube; `Clicks` +1 immediately. *(supersedes step 3)*
3. Click a mini-cube on a partially visible non-front face → nothing (unchanged). *(step 4)*
4. Drag > 40 px → one 90° rotation step; touch drag does not scroll. *(step 5)*
5. Arrow keys rotate; W/A/S/D and Enter/Space do nothing; **no highlight** appears anywhere; the canvas focus ring still shows. *(supersedes step 6)*
6. Clear a whole face → plate fades, `Faces destroyed` +1, remaining faces playable. *(step 7)*
7. Clear all six faces → travel: the **galaxy visibly expands outward** while the camera pulls back, then a new styled cube arrives with `Cube 2` and stats carried. *(supersedes step 8 — the reported defect)*
8. OS reduced motion → short intro/travel with no flights and no expansion, instant hide with no pop/flash, no bursts, instant rotation. *(supersedes step 9)*
9. Touch device (or devtools touch emulation) → tap explodes (with the pop), drag rotates, no page scroll/zoom. *(step 10)*

## Open questions

- **Q-1 — Cursor removal scope (user checkpoint).** Pinned: **Option B** — remove the whole keyboard selection cursor feature (highlight + WASD + Enter/Space), keeping arrow-key rotation. **Recommended: keep B** — Option A (remove only the visual highlight, keep an invisible keyboard target) was rejected as an accessibility trap, and the user's dislike targets the feature's visible form; arrow rotation preserves a meaningful keyboard path. Alternative: if keyboard-only explode play is wanted, revisit as a future feature with a redesigned (visible) selection affordance — one-constant/no-structural change then. The user approves at the checkpoint; choosing A requires a spec revision.
- **Q-2 — Expansion magnitude.** Pinned `TRAVEL_STARFIELD_SCALE = 8` because it guarantees strictly outward on-screen star motion for the whole travel despite the camera pull-away (`S(p) = 1 + 7q > 1 + 6.5q = z_c(p)/12`). **Recommended: keep.** Alternatives: a smaller scale accepts a late-travel inward reversal (rejected — that is the reported defect); scaling to a constant apparent size (rejected — reads as no expansion). A visual-tuning change is a constant-only edit with a spec-revision note.
- **Q-3 — "Changing color, but not drastically" interpretation.** Pinned: a bounded brightness flash toward white via the per-instance colour multiplier (1 → 1.3 → 1, hue unchanged). **Recommended: keep.** Alternative: a hue shift toward each style's accent colour (rejected: needs five per-style pinned multipliers for the same testability, more visual risk). No colour change at all is also acceptable to the user if the flash reads as too much (constant-only change).
- **Q-4 — Intro choreography values.** Pinned: search/find/approach at 40% / 32% / 28% of `INTRO_DURATION_MS` with the § 2 poses. **Recommended: keep.** Alternatives (longer search, different oblique pose) are pinned-constant changes, never silent.
- **Q-5 — Live reduced-motion switch during a pop.** Pinned: running pops settle instantly (AC-12 symmetry with rotation). **Recommended: keep.** Alternative: let a running ≤ 160 ms pop finish (harmless, slightly less consistent).

## Assumptions

- "Background doesn't expand" refers to the travel starfield streak being invisible (z-elongation with screen-space point size); interpreted as "the starfield must visibly expand outward during travel" — implemented as the uniform in-plane expansion (AC-1).
- "Search the new cube, find it on screen, then smoothly go to it" = the three-segment deterministic camera choreography inside the existing intro phase; `INTRO_DURATION_MS` and skip semantics are reused unchanged.
- "Particles explode in front of the mini-cube" = depth/layering pins plus a forward spawn offset; node-assertable scene state, not a perceptual judgment.
- "Expanding a little bit and minimizing quickly" = 100 ms grow to 1.1×, 60 ms shrink to 0 (AC-4).
- "Changing color, but not drastically" = the bounded brightness flash (AC-4, Q-3).
- "Remove the highlighted minicube" = remove the keyboard selection cursor feature (Option B, Q-1); arrow-key rotation is retained.
- The predecessor spec/plan/tasks stay authoritative for everything not superseded; this spec is read alongside them and never edits them.
- Stack unchanged: `three@0.186.1` / `@types/three@0.186.0`, TypeScript strict, Vitest, ESLint; the project testing bar (concrete assertions, no banned matchers, ≥ 80 × 4 per workspace) governs.
- The `session.test.ts` / `scene.test.ts` snapshot fixtures that currently include `cursor` are reworked so no snapshot literal mentions the field after the type loses it (plan § Interfaces).

## Revision history

- r1 — 2026-10-20 — initial draft (planning phase).
