---
feature: cube-tile-lines-and-controls
revision: 1
status: draft
created: 2026-10-21
updated: 2026-10-21
---

# Spec — Cube Tile Lines and Controls (seamed mini-cube surface, no pointer rotation, WASD + arrow rotation)

## Summary

Fourth design/controls pass, three changes all local to the frontend workspace: (1) **visible mini-cube lines** — the tiles must read as individual mini-cubes again: each tile is inset so a thin uniform seam shows between adjacent tiles, with the existing cube body (the dark interior) visible through every seam — no plates, no new drawables, the surface still reads as one giant cube built from mini-cubes; (2) **pointer-drag rotation is disabled** — a click/tap still explodes (fast, jittery clicks remain reliable taps), but a drag beyond the threshold now does nothing at all: no rotation, no explosion; face navigation happens only through the retained automatic face-clear auto-rotation or the keyboard; (3) **W/A/S/D join the arrows as rotation keys** — W/A/S/D map to up/left/down/right (case-insensitive) exactly like the arrows, the intro any-key skip stays, and no keyboard cursor is reintroduced. Everything else in the four accepted features stays in force; the predecessor specs are authoritative for everything not superseded and are never edited by this feature.

## Scope

### In scope

- Frontend workspace only (`src/frontend`): `render/cube-view.ts` (+`MINI_CUBE_TILE_RATIO` re-pin), `render/{cube-view,picking,scene}.test.ts` (extent/seam/pop-literal re-pins and new pick cases), `game/session.ts` (drag policy) + `game/session.test.ts` (pointer-contract reworks and one tile-extent literal), `input/gestures.ts` (doc comment only — no logic change), `input/keyboard.ts` + `keyboard.test.ts` (WASD rows + case-folding), `ui/GameCanvas.tsx` + `GameCanvas.test.tsx` + `App.test.tsx` (aria-label string), `docs/product/glossary.md` (mini-cube wording).
- The three behaviors above with pinned constants, exact values at N = 3/5/7, deterministic node tests, and updated manual visual pass steps.

### Explicitly out of scope

- Game rules: board removal, click/face stats, intents, the phase machine, style cycling, level progression, **the engine's auto-rotation** (face-clear auto-rotate), the rotation animation machine (queue/settle), travel, starfield, particles — all unchanged. `game/engine.ts`, `game/rotation.ts`, `game/board.ts`, `game/progression.ts`, `game/effects.ts`, `game/types.ts` are untouched (diff empty).
- HUD, the single live region, phase announcement copy, `ui/theme.ts`, `App.tsx` structure — unchanged (only the canvas aria-label string changes).
- Backend, WebSocket, shared/cross-client state, persistence, container assets, CI, configs, `main.tsx`, `index.html`, `ws/**` — unchanged.
- Audio, new dependencies, new drawables, new materials, browser automation, pixel/perceptual tests.
- No keyboard selection cursor (Enter/Space stay unbound); no repurposing of the drag gesture (Q-3).

## Supersessions of accepted behaviors

Everything in the four accepted features stays in force **except** the following, which this feature supersedes by AC ID:

| Superseded | Behavior replaced | Replaced by (this spec) | Retained from that AC |
| --- | --- | --- | --- |
| **cube-world-transition AC-2** (mini-cube-built surface) | Flush, edge-to-edge tiling — `MINI_CUBE_TILE_RATIO = 1`, tile edge = `CUBE_SIZE/N`, no gap between or around tiles, the outermost tiles reach the cube edges exactly | Inset tiling `MINI_CUBE_TILE_RATIO = 0.95` (AC-1): every tile's face-axis extent is `0.95 × CUBE_SIZE/N`, leaving a uniform seam of `0.05 × CUBE_SIZE/N` world units between adjacent tiles and a half-seam rim at the face perimeter, so the body shows through as thin tile lines | Plates remain removed (`plateMeshes`/`PLATE_OFFSET` stay gone); the body remains the dark interior (now the seam lines); tile *centres* unchanged; thickness 0.25; the pop matrix basis, timeline and color flash; per-face `InstancedMesh` with the `row·N + col` encoding; face-removal countdown/disposal; child list exactly body + one `InstancedMesh` per live face (no new drawables) |
| **cube-game-frontend AC-6** (pointer click vs drag classification and rotation) | A gesture beyond `TAP_DRAG_THRESHOLD_PX` commits exactly one rotation step about the dominant axis | A gesture beyond the threshold is still classified as a `drag`, but the session dispatches nothing for it — pointer drags never rotate and never explode (AC-2) | Threshold classification verbatim: travel ≤ 40 px (inclusive) is a `tap` (NDC of the release position), 41 px is a `drag`, judged per gesture from press to release; tap → front-face pick → explode; the classified drag's `axis`/`direction` stay in the classification contract; the engine's `rotate` event and its queue/settle machine (now keyboard-driven) |
| **cube-game-frontend AC-13** (touch/mobile) | Drags rotate on touch as on mouse | Drags do nothing on touch as on mouse (Pointer Events remain the single input path) (AC-2) | Tap explodes; `touch-action:none` (no scroll/zoom); pixel-ratio cap; resize handling |
| **cube-game-frontend AC-7** (keyboard rotation) | The arrows-only `playing` table | The table gains W/A/S/D → up/left/down/right, case-insensitive; the four arrows are unchanged (AC-3) | Arrow mappings, six-face reachability (now also via WASD alone), intro any-key skip, unbound keys → `null`, travel ignores every key |
| **cube-visual-polish AC-6** (cursor removed) | `w`/`a`/`s`/`d` map to `null` in `playing`; the pinned aria-label "…drag or press the arrow keys…" | WASD map to rotation (AC-3); the new pinned aria-label names W, A, S, D or the arrows (AC-4) | The cursor feature stays removed (no highlight, no cursor state, Enter/Space still `null`); arrow-key rotation; the accessibility trade-off note stands (keyboard rotates and skips but cannot explode without a pointer) |
| **cube-game-frontend AC-1 + cube-visual-polish AC-6** (canvas aria-label) | The exact string `Game canvas: click a mini-cube to explode it; drag or press the arrow keys to rotate the cube` | Exactly `Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube` (AC-4) | `tabindex="0"`, `touch-action:none`, focus ring, HUD markup and zero-state texts, skip-hint copy, the single live region |
| **cube-game-frontend AC-18 / cube-world-transition AC-5** (glossary) | mini-cube definition: "The tiles sit flush edge-to-edge, so the cube's surface reads as one giant cube built from mini-cubes" | "The tiles sit with a thin uniform seam between them — the dark interior shows through as the tile lines — so the cube's surface reads as one giant cube built from mini-cubes" (AC-1) | Random-N model, definition + example format, no other term redefined (`click`, economy terms untouched) |
| **cube-world-transition AC-4 / cube-visual-polish-followup AC-4** (ledgers) | — | Extended with the rows above | The per-AC evidence-table discipline |
| **Manual visual pass steps** (world-transition steps 1, 5, 6, 10 and their predecessors: polish steps 5, 6; followup step 5) | "surface fully tiled by flush mini-cubes — no gaps", "Drag > 40 px → one 90° rotation step", "drag rotates" | Seamed-surface and drag-does-nothing steps (spec § Manual visual pass) | All remaining manual-pass steps |

No other accepted behavior changes. In force, untouched: board removal and stats; the whole engine click path; rotation settle math and the auto-rotation machine; face destruction and the removal countdown; travel sequencing, directional flight and style cycling; the starfield cone + expansion + swirl; the intro dolly; burst fronting (polish AC-3); the pop timeline and interactions (polish AC-4/AC-5) — the same factors now scale an inset tile; reduced-motion profile values; frame-loop lifecycle and disposal; bounded drawables (≤ 6 `InstancedMesh` + one starfield `Points` + one cube body + one pooled particle `Points` — counts unchanged); the HUD and the single live region; the coverage bar; scope discipline; no new dependencies (`three` 0.186.1, named imports only); the bundle budget.

## UX behavior (pinned)

### 1. Seamed mini-cube surface (supersedes the flush tiling)

The cube reads as one giant cube built from mini-cubes with **visible lines between the tiles**: every tile is inset by a uniform fraction of its cell, so the cube body (the dark interior, `style.cubeColor`) shows through every seam as a thin tile line. There are no plates, no new geometry, and no new materials — the seam is the gap itself.

- **Ratio:** `MINI_CUBE_TILE_RATIO = 0.95` (was 1), in `render/cube-view.ts`. The seam fraction is `1 − 0.95 = 0.05` of the cell — derived from the ratio, never a second constant (no drift).
- **Tile extents:** face-axis tile edge = `0.95 × CUBE_SIZE / N`. Tile thickness stays `MINI_CUBE_THICKNESS` (0.25, proud of the body). Tile *centres* are unchanged (the pinned first/last centre positions hold).
- **Seam widths (world units)** = `0.05 × CUBE_SIZE / N`:
  | N | cell | tile edge | seam (between adjacent tiles) | half-seam rim at the face perimeter |
  | --- | --- | --- | --- | --- |
  | 3 | 5/3 | 19/12 = 1.58333… | 1/12 = 0.08333… | 1/24 = 0.04166… |
  | 5 | 1 | 0.95 | 0.05 | 0.025 |
  | 7 | 5/7 | 19/28 = 0.678571… | 1/28 = 0.035714… | 1/56 = 0.017857… |
- **Interior/seam appearance:** the body (a `CUBE_SIZE` box in `style.cubeColor`) remains behind the tile layer; with the inset tiles it is visible in every seam and in the half-seam rim around each face's perimeter. No plate, no opacity write, nothing covers the body. The appearance is judged in the manual visual pass; the node tests assert the geometric gap and that the group's children are exactly body + 6 `InstancedMesh`.
- **Picking:** the pick set is unchanged (only the front face's `InstancedMesh` is intersected — the body is never pickable). Tile-centre taps still resolve the exact ids on N = 3/5/7 grids; a tap landing in a seam (the gap between two adjacent tiles) is a miss (`null`) and explodes nothing.
- **Pops:** the pop-then-shrink animation is unchanged in factor form (`popScaleAt`/`popColorMultiplierAt` untouched) — the same timeline now scales the inset tile; the end state (zero-scale once per id) and reduced-motion instant hide are unchanged.
- **Resources:** no new objects, materials, or buffers of any kind; AC-16 ceilings hold verbatim (the child list is the same as the accepted flush surface).

### 2. Pointer contract: taps explode, drags do nothing (supersedes the drag→rotate path)

- **Classification (unchanged, retained verbatim):** per gesture, judged on Euclidean travel from press to release: ≤ `TAP_DRAG_THRESHOLD_PX` (40, inclusive) is a `tap` carrying the release-position NDC; beyond it is a `drag` (dominant axis, ±1 direction, horizontal on an exact tie). Each `pointerdown` resets the press, so a fast click with jitter ≤ 40 px is always a reliable tap; `pointercancel` clears the press.
- **Session policy (the changed part):**
  - `playing` + `tap` → pick the current front face and explode if hit (unchanged — a miss or non-front-face hit still does nothing).
  - `playing` + `drag` → **nothing**: no rotation, no explosion, no stat change, no intent, snapshot identity unchanged. Drags are ignored whatever their axis/direction, at any time (including mid-rotation-animation — they never touch the queue).
  - `intro` + `tap` → `introSkip`; `intro` + `drag` → nothing (unchanged).
  - `travel` → every pointer gesture is ignored (unchanged).
  - Touch: identical through Pointer Events (the single input path); `touch-action:none` stays, so drags never scroll the page.
- The engine is untouched: the `rotate` event, the one-step-plus-one-queued machine and the 90° settle are now driven only by the keyboard (and the engine's own auto-rotation).

### 3. Keyboard rotation: W/A/S/D *or* arrows (supersedes the arrows-only table)

The `playing` table (`input/keyboard.ts`):

| key | event |
| --- | --- |
| `w` / `W` | `rotate` `pitch +1` (up) |
| `a` / `A` | `rotate` `yaw −1` (left) |
| `s` / `S` | `rotate` `pitch −1` (down) |
| `d` / `D` | `rotate` `yaw +1` (right) |
| `ArrowLeft` | `rotate` `yaw −1` (unchanged) |
| `ArrowRight` | `rotate` `yaw +1` (unchanged) |
| `ArrowUp` | `rotate` `pitch +1` (unchanged) |
| `ArrowDown` | `rotate` `pitch −1` (unchanged) |

- **Case-insensitivity:** single-character keys are case-folded to lowercase before the table lookup; arrow names are matched exactly and are never case-folded (`ARROWLEFT`/`arrowleft` remain `null`, as accepted).
- **Everything else** (`Enter`, space, `Escape`, unknown keys) → `null` — the keyboard selection cursor stays removed.
- **Phases:** `intro` — any key is `introSkip` (unchanged); `travel` — every key is `null` (unchanged).
- WASD maps to the same directions as the arrows (W = ArrowUp, A = ArrowLeft, S = ArrowDown, D = ArrowRight), so keyboard-only play reaches all six faces with either group alone: front `[]`, left `[d]`, back `[d, d]`, right `[a]`, top `[w]`, bottom `[s]`.

### 4. Automatic rotation — unchanged

The face-clear auto-rotation (engine: when the front face empties while mini-cubes remain, step once toward the nearest face that still has mini-cubes — fewest steps, then `FACE_IDS` order — re-evaluated after each step) stays exactly as accepted. The HUD and the single live region are untouched.

## User stories

- As a player, I want to see the lines between the mini-cubes, so the surface reads as a cube built from individual mini-cubes instead of a solid shell.
- As a fast clicker, I want mouse clicks to always explode and never rotate the cube, so I can click at full speed without accidentally turning the cube away.
- As a keyboard player, I want to rotate with W/A/S/D *or* the arrow keys, so both muscle memories work.
- As a mobile player, I want taps to explode and drags to do nothing (no accidental rotation, no page scroll).

## Acceptance criteria

Verification notes: "the frontend workspace" means `src/frontend`. Evidence per AC: a test file asserting concrete values, or a command. All tests use concrete expected values (no banned matchers, no useless tests, no `toBeCloseTo` — the bounded-exception budget stays 0; where a three.js f32 round-trip is involved the exact double is composed and pinned with `Math.fround`, the predecessor's pattern). Commands (from `AGENTS.md`): `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend` (pre-gate), full `npm run coverage` (final gate), `npm run build`, optional `npm run smoke`. Transcripts recorded in `docs/features/cube-tile-lines-and-controls/build-log-T<id>.md`.

- **AC-1 — Seamed mini-cube surface (supersedes world-transition AC-2 tiling).** `render/cube-view.ts` exports `MINI_CUBE_TILE_RATIO === 0.95` (exact assertion). Every tile's face-axis extent is exactly `0.95 × CUBE_SIZE / N` — asserted on the instance matrices (via `getMatrixAt`, f32-pinned: N = 3 → `Math.fround((5/3) × 0.95)`, N = 5 → `Math.fround(0.95)`, N = 7 → `Math.fround((5/7) × 0.95)`) — and the thickness component stays `MINI_CUBE_THICKNESS` (0.25). Adjacent tiles on a face are separated by exactly the seam `0.05 × CUBE_SIZE / N` (edge-to-edge separation asserted for N = 3/5/7: 1/12, 0.05, 1/28 world units; no overlap, no flush contact), and the outermost tiles' outer faces sit exactly `CUBE_HALF_SIZE − seam/2` from the face centre (the uniform half-seam perimeter rim). Tile *centres* are unchanged: the pinned first/last centre positions per face (N = 3/5/7 fixtures) hold verbatim. The group's children are exactly the body + one `InstancedMesh` per live face (exactly 7 at construction) — no plates, no new drawables, nothing covering the body; the body material is `style.cubeColor` (the dark interior visible through every seam). Picking: on N = 3, 5 and 7 cube views, a tap at a tile centre resolves the exact `face:row:col` id; a tap at the midpoint of a seam between two adjacent tiles returns `null` (the pick set is the front face's `InstancedMesh` only). The pop timeline is unchanged in factor form — an exploding inset tile's matrix elements are `Math.fround(0.95 × cell × factor)` at the pinned times (idle scale `[Math.fround(0.95), Math.fround(0.95), 0.25]`); reduced-motion instant hide unchanged. `docs/product/glossary.md` mini-cube wording updated to the seamed description (definition + example format retained; no other term redefined). Evidence: `cube-view.test.ts`, `picking.test.ts`, `scene.test.ts`, `session.test.ts` (re-pinned tile-extent literal), file inspection.

- **AC-2 — Pointer drags never rotate (supersedes AC-6's drag→rotation and AC-13's touch-drag rotation).** *(Session)* With an injected recording engine: `playing` + a classified drag (any axis/direction, e.g. 100 px rightward yaw, 100 px downward pitch) dispatches **zero events** — no `rotate`, no `explodeMiniCube`, no stat or intent change, snapshot identity unchanged (real engine re-asserted the same way); `playing` + a tap (≤ 40 px travel) still dispatches `explodeMiniCube` for a front-face hit (existing wiring tests keep passing); `intro` + tap → `introSkip`, `intro` + drag → nothing; `travel` + any pointer gesture → nothing. *(Classification)* Boundary retained: 39 px and 40 px (inclusive) classify as taps, 41 px as a drag; classification is per gesture from press to release, so a fast click with jitter ≤ 40 px is a reliable tap and consecutive fast clicks are independent; `pointercancel` clears the press. *(Touch)* Pointer Events stay the single path; drags do nothing on touch as on mouse; `touch-action:none` is retained (no page scroll). `gestures.ts` logic is unchanged (the classified drag keeps `axis`/`direction` as the retained classification contract — Q-3); only its module doc comment is updated. Evidence: `session.test.ts` (recording-engine dispatch sequences; real-engine snapshot assertions), `gestures.test.ts` (boundary groups unchanged and passing), AC-4 for the style attribute.

- **AC-3 — WASD + arrow keyboard rotation (supersedes the arrows-only table).** `mapKey` in `playing` yields exactly the § 3 table: `w`/`W` → `{ type: 'rotate', axis: 'pitch', direction: 1 }`, `a`/`A` → yaw −1, `s`/`S` → pitch −1, `d`/`D` → yaw +1, and the four arrows unchanged; case-insensitivity via case-folding single-character keys, arrow names matched exactly (never case-folded — `ARROWLEFT`/`arrowleft` → `null`); `Enter`, `' '`, `Escape`, `q` and unknown keys → `null` (no cursor). `intro`: any key → `introSkip` (retained group); `travel`: every key → `null` (retained group). Keyboard-only play reaches all six faces with the arrows (retained group) and with WASD alone — enumerated: front `[]`, left `[d]`, back `[d, d]`, right `[a]`, top `[w]`, bottom `[s]` (one settled step per press, exact front-face assertions). Evidence: `keyboard.test.ts`.

- **AC-4 — Canvas label and untouched accessibility surface.** `ui/GameCanvas.tsx`'s canvas `aria-label` is exactly `Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube` — asserted in `GameCanvas.test.tsx` and in the `App.test.tsx` SSR markup (both literals updated; no other markup change). The HUD markup, the single live region, the skip-hint copy, `tabindex="0"`, `touch-action:none` and the focus ring are byte-identical to the accepted state (the unchanged assertion groups keep passing). Evidence: `GameCanvas.test.tsx`, `App.test.tsx`, `Hud.test.tsx`.

- **AC-5 — Automatic rotation and the game core are untouched.** The diff touches none of `game/engine.ts`, `game/rotation.ts`, `game/board.ts`, `game/progression.ts`, `game/effects.ts`, `game/types.ts`, `ui/Hud.tsx`, `ui/theme.ts`, `App.tsx`, `render/starfield.ts`, `render/particles.ts`, `render/picking.ts` (git diff empty on those paths). The retained behaviors are re-asserted by the unchanged tests: clearing the front face still auto-rotates step-by-step toward the nearest face with mini-cubes (deterministic order: fewest steps, then `FACE_IDS`); the rotation machine still animates one step and queues at most one, settling on exact 90° multiples; clicks/explosions/stats, travel, style cycling, starfield, intro, burst fronting, pop interactions, reduced-motion collapses, lifecycle/disposal and bounded drawables behave exactly as accepted. Evidence: unchanged `engine.test.ts`, `rotation.test.ts`, `board.test.ts`, `progression.test.ts`, `effects.test.ts`, `starfield.test.ts`, `particles.test.ts`, `scene.test.ts` retained groups, `Hud.test.tsx`, `session.test.ts` retained groups — all passing; git diff on the listed paths (empty).

- **AC-6 — Supersession ledger and regression gate.** The only accepted behaviors that change are the § Supersessions rows (world-transition AC-2 tiling + its glossary wording; AC-6 drag→rotation; AC-13 touch-drag rotation; AC-7 key table; polish AC-6 WASD-null clause + aria-label; AC-1 aria-label string; the ledgers and manual-pass steps); every other AC of the four accepted features holds. `npm run lint`, `npm run typecheck`, `npm test`, and `npm run coverage` (both workspaces ≥ 80 statements/branches/functions/lines; frontend pre-gate per task) all exit 0; `npm run build` succeeds within `BUNDLE_BUDGET_GZ_KB`; `git diff` on `src/backend/**`, `tests/e2e/**`, `compose*.yaml`, both Dockerfiles, `src/frontend/src/main.tsx`, `src/frontend/src/ws/**`, configs, `src/frontend/src/game/{engine,rotation,board,progression,effects,types}.ts`, `src/frontend/src/render/{picking,starfield,particles}.ts`, `src/frontend/src/ui/Hud.tsx`, `src/frontend/src/ui/theme.ts`, `src/frontend/src/App.tsx`, and `docs/features/{cube-game-frontend,cube-visual-polish,cube-visual-polish-followup,cube-world-transition}/**` is empty; no `.env*`; no banned matchers anywhere; no new dependencies (`three` 0.186.1, named imports only); no DOM globals and no `Math.random` under `game/**` (greps). The updated manual visual pass is recorded as a checklist (not an AC). Evidence: final build log with the per-AC table and raw transcripts; reviewer re-run at the code gate.

## Non-goals

- No change to game rules, stats, intents, the phase machine, level progression, style values, travel, starfield, particles, or the engine's click/rotation/auto-rotation paths (`game/**` logic is untouched except the session's pointer policy).
- No keyboard selection cursor — Enter/Space stay unbound, no highlight, no cursor state (polish AC-6's removal is retained).
- No repurposing of the drag gesture (zoom, scroll, orbit, momentum) — drags are simply ignored (Q-3).
- No HUD, live-region, theme, or `App.tsx` structural changes; no copy changes beyond the canvas aria-label.
- No new dependencies, no `three/addons`, no new drawable types or materials, no shaders/assets; bundle budget unchanged.
- No backend/WS/persistence/economy code; no container, compose, Dockerfile, CI, or config changes; `ws/connection.ts` and `main.tsx` untouched.
- No browser automation, no pixel/perceptual tests; the manual visual pass is a checklist, not an AC.
- No audio; no settings menu.

## Boundaries

- ✅ Always: keep `game/**` pure and DOM-free; named tree-shakeable imports from `three`; tests with concrete expected values beside every behavior change; run lint, typecheck, tests, and the coverage command before reporting done; record raw evidence in `build-log-T<id>.md`; stage only `files_owned` per task.
- ⚠️ Ask first: any new dependency (none needed); any pinned-constant deviation from this spec (Q-1…Q-5 are constant-only tuning); touching any file outside a task's `files_owned`; any coverage exclusion or threshold change.
- 🚫 Never: weaken assertions (banned matchers, snapshot-only, assertion-free, useless tests); exclude production code from coverage; touch `.env*`, secrets, backend/container files, `main.tsx`, `ws/connection.ts`, or configs; use `import *` from `three`; read browser globals inside `game/**`; push; rewrite the accepted features' spec/plan/tasks to match this change (this spec supersedes them, it does not edit them).

## Security considerations

- **No new dependencies, no supply-chain change.** The diff adds zero packages; `three`/`@types/three` stay exactly as resolved (0.186.1 / 0.186.0, lockfile untouched).
- **No user data, no storage, no network.** All changes are local rendering/input edits; nothing outside session memory is written; no `.env*`.
- **Rendering safety unchanged.** Fully procedural geometry; no loaders, textures, or external assets; no `innerHTML`; static DOM copy only (the new aria-label is a static string).
- **Resource bounds as robustness.** The seam adds no objects or materials (the body is already there); drawable counts stay at the accepted AC-16 ceilings; disposal paths unchanged.
- **Test integrity as a control.** The coverage bar and concrete-assertion rule protect the pure logic the future server-authority work depends on; `game/**` DOM-freedom is retained.

## Real-time impact

**None.** All three changes are local client-side rendering and input mapping. No shared or cross-client state is created or read; connection lifecycle, reconnection, multi-client behavior, and server authority are out of scope exactly as in the accepted features (their real-time statements and Q-7 stand).

## Containerization impact

**None expected.** Frontend source and test changes only: no new services, images, ports, environment variables, or health signals; no compose/Dockerfile/README change. The frontend image absorbs the diff through the existing build; the unchanged containerized smoke test (`npm run smoke`) remains the regression check at the final gate where the environment allows it.

## Testing strategy

- **Unit (Vitest, node environment, existing setup):** `keyboard.test.ts` pins the new table (WASD rows, case-folding rule, arrow-exactness, unbound keys, phase policy) and the WASD six-face enumeration; `gestures.test.ts` stays unchanged (the boundary/dominant-axis classification groups are the retained AC-6 contract); `cube-view.test.ts` pins the ratio constant and the f32-composed extents.
- **Integration (same node environment — real three.js scene graph):** `cube-view.test.ts` asserts the inset tile extents and seam separations on real instance matrices for N = 3/5/7, the unchanged centres, the exact child list, the body material, and the pop timeline on the inset tile; `picking.test.ts` asserts centre-hit ids on 3/5/7 grids and the seam-miss (`null`) at the pinned seam-midpoint NDC; `scene.test.ts` re-pins the pop scale literals to `Math.fround(0.95 × factor)` while its retained groups (travel, starfield, disposal, framing) keep passing; `session.test.ts` reworks the pointer-policy groups with the recording engine (drags → zero events, taps → explode/skip, travel ignored) and re-pins the one tile-extent pop literal; `GameCanvas.test.tsx`/`App.test.tsx` assert the new pinned aria-label with the unchanged HUD/live-region markup.
- **E2E / container:** no browser automation (accepted non-goal retained); `npm run smoke` unchanged, run at the final gate where the environment allows.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace (frontend pre-gate: `npm run coverage --workspace @cubeclicker/frontend`); config exclusions unchanged (only `src/main.tsx` + test patterns). The known honest residuals from the accepted features carry over and stay small; if a metric cannot honestly clear 80, the task reports `blocked` — no carve-outs.
- **Manual visual pass (post-build; superset of the affected accepted checklist steps — not an AC):** see § Manual visual pass.

### Manual visual pass

After `podman compose up --build` (http://localhost:5173):

1. Load → **thin seam lines** are visible between the mini-cubes on every face (the dark interior shows through), with a matching half-seam rim at the face edges; no plates, no gaps wider than the seams; complete several levels to see N = 3/5/7 surfaces; the cube still reads as one giant cube built from mini-cubes. *(supersedes the flush-surface step)*
2. Intro → unchanged: cube visible and centred from the first frame; a click/key press skips; **dragging during the intro does nothing**. *(step updated)*
3. Click mini-cubes as fast as you can → every click that lands on a tile explodes (pop + burst in front, `Clicks` +1); the cube **never rotates from clicking**, however fast or jittery; clicks in a seam do nothing. *(supersedes the click step)*
4. **Drag** with the mouse anywhere (short or long) → **nothing happens** — no rotation, no explosion. *(supersedes the drag-rotation step)*
5. **W/A/S/D rotate** (up/left/down/right) and the arrow keys rotate the same way; holding a key repeats steps; Enter/Space do nothing; no highlight appears; the canvas focus ring still shows. *(supersedes the WASD-does-nothing step)*
6. Clear a whole face → the last tile pops away, `Faces destroyed` +1, and the **auto-rotation still turns the cube toward a remaining face by itself** — exactly as before. *(auto-rotation retained)*
7. Clear all six faces → travel unchanged (directional departure, expansion, fly-in, `Cube N` +1, stats carried). *(unchanged)*
8. OS reduced motion → unchanged collapses (no flights/expansion, instant hide, instant keyboard rotation, instant positional swap). *(unchanged)*
9. Touch device (or devtools touch emulation) → tap explodes; **drag does nothing**; no page scroll/zoom. *(step updated)*

## Open questions

- **Q-1 — Seam mechanism (user checkpoint).** Pinned: **the inset/gap approach** — `MINI_CUBE_TILE_RATIO = 0.95` with the existing body as the seam lines. **Recommended: keep.** The alternative (dedicated grid-line geometry, e.g. `LineSegments` along the seams) is rejected: it adds a new drawable type and material (a supersession of the accepted AC-16 ceilings), needs per-face line rebuild/disposal on face removal and level change, and renders the same look for more code.
- **Q-2 — Tile ratio value.** Pinned `0.95` — a 5% seam (the middle of the requested 0.94–0.96 band): 0.0833 / 0.05 / 0.0357 world units at N = 3/5/7, clearly visible at N = 5 without shrinking the click target meaningfully (the hit area per tile drops ~9.75%, tile centres unchanged). **Recommended: keep.** Any value in 0.94–0.96 is a constant-only change with a spec-revision note (extents/seams re-pin mechanically).
- **Q-3 — Drag treatment.** Pinned: **drags are fully ignored** — no rotation, no explosion, no alternative use. **Recommended: keep** (the request names no other use). The classified drag's `axis`/`direction` stay in `gestures.ts` as the retained AC-6 classification contract and the documented seam for a future pointer feature (e.g., orbit or camera pan, if ever requested).
- **Q-4 — WASD mapping.** Pinned: W/A/S/D → up/left/down/right — the same directions as the arrows and as the removed cursor's WASD movement, so both muscle memories agree. **Recommended: keep.** Alternative (W/S = yaw, A/D = pitch) breaks that consistency for no gain.
- **Q-5 — Key auto-repeat.** Holding W/A/S/D or an arrow key repeats `keydown` (browser auto-repeat) and dispatches a step per repeat; the engine's queue (at most one queued while a step animates) is unchanged. No deduplication added. **Recommended: keep** — the accepted behavior for arrows; WASD inherits it.
- **Q-6 — Seam width constancy.** Pinned: a constant *ratio*, so the seam scales with the cell (0.0357–0.0833 world units across N). **Recommended: keep.** A constant world-unit seam would need an N-dependent ratio and per-level geometry constants — rejected.

## Assumptions

- "I want to see the lines of the mini-cubes" = visible seams between adjacent mini-cubes on every face, so each tile reads as an individual mini-cube — implemented as a uniform inset per tile with the existing body as the dark seam lines; the plate-less interior look (world-transition AC-2's core) is kept and the seams make the "built from mini-cubes" reading visible.
- "I want to disable rotation by using click on mouse" = remove **pointer-drag** rotation. The click (tap) still explodes; the tap-vs-drag threshold classification is retained verbatim so fast, jittery clicks remain reliable taps (a drag above 40 px is what is now ignored).
- "Rotation for the different faces will be automatic as it is" = the accepted **face-clear auto-rotation** stays exactly as is (no new continuous auto-rotation is introduced).
- "OR by using W/A/S/D or arrows" = both key groups rotate; WASD is mapped to the same directions as the arrows (W = up, A = left, S = down, D = right), case-insensitive.
- Drags are fully ignored — the request assigns them no role (Q-3).
- The seam colour is the existing `style.cubeColor` body material (the defined dark interior); no new "black" material is added, and the surface never regresses to the removed plate look.
- The user's expectations are directional, not numeric: the pinned values above (ratio 0.95, WASD directions, ignored drags) are this spec's choices — Q-1…Q-4 carry them to the checkpoint.
- The accepted features' specs/plans/tasks stay authoritative for everything not superseded; this spec is read alongside them and never edits them.
- Stack unchanged: `three@0.186.1` / `@types/three@0.186.0`, TypeScript strict, Vitest, ESLint; the project testing bar (concrete assertions, no banned matchers, ≥ 80 × 4 per workspace) governs.

## Revision history

- r1 — 2026-10-21 — initial draft (planning phase).
