# Build log — T2 — Starfield expansion, pop animation, burst front-offset & intro cinematic

Task: T2 (2026-10-20 / resumed 2026-10-21)
Commit message (pinned): `feat: expand the travel backdrop, pop the mini-cube, front the burst and replace the intro flight (T2)`

Files changed (owned):
- `src/frontend/src/render/starfield.ts`, `src/frontend/src/render/starfield.test.ts`
- `src/frontend/src/render/cube-view.ts`, `src/frontend/src/render/cube-view.test.ts`
- `src/frontend/src/render/scene.ts`, `src/frontend/src/render/scene.test.ts`
- `src/frontend/src/render/picking.ts`, `src/frontend/src/render/picking.test.ts`
- `docs/features/cube-visual-polish/build-log-T2.md`

Files changed (outside `files_owned`, documented deviation — see § Deviations D-1):
- `src/frontend/src/game/session.test.ts` (2 assertions of superseded predecessor behaviour)

## What changed & why

- **Starfield (AC-1).** `starfield.update(dtMs, travelProgress?)` now applies the uniform in-plane expansion
  `S = 1 + (TRAVEL_STARFIELD_SCALE − 1) · easeInOutQuad(clamp(p))` to `points.scale = (S, S, 1)`; `z` stays 1,
  drift unchanged, same `Points` identity. `easeInOutQuad` + `TRAVEL_STARFIELD_SCALE` are imported from
  `game/effects` (never redefined). The z-elongation constant/`streak` wording is gone from code and header.
- **Cube view (AC-4 / AC-5 / AC-6).** Highlight mesh/material/API plus `CURSOR_PADDING`,
  `CURSOR_THICKNESS_FACTOR` and `CursorAnchor` removed; cube-group children are now exactly
  `[body, grid, plate] × 6` (13 objects). Added `FACE_NORMALS`, one static per-face `instanceColor`
  buffer (`InstancedBufferAttribute`, all `1`s, `needsUpdate`), plain pop records advanced by
  `update(dtMs)` (matrix basis · `tileSize · popScaleAt(t)`, position preserved; colour slot
  `popColorMultiplierAt(t)` on all three channels), `hideMiniCube(id, instant?)`, `settlePops()`, and
  pop cancellation in `removeFace`/`dispose`.
- **Scene (AC-2 / AC-3 / AC-4 / AC-5 / AC-6).** Added exported pure `introCameraPose(progress, outPosition,
  outTarget)` (search → find → approach) and `snapToQuarterTurns(v)` (1e-9, `-0` normalised). `applyCamera`
  now uses the pose + `lookAt` for `intro`, rest + `lookAt(ORIGIN)` for reduced motion, and keeps the travel
  pull-away values. `applyExplosion` reads the instance origin and the snapped world face normal **before**
  hiding, passes `instant = reducedMotion`, and spawns at `origin + BURST_ORIGIN_OFFSET · normal` (gone-face
  fallback `(0,0,0)`, no offset). `applySnapshot` calls `cube.settlePops()` when the snapshot reports reduced
  motion; the highlight call is gone. `update` advances `cube.update(dtMs)` after the face fades.
- **Picking.** Highlight-gate doc comment removed; the hidden-instance comment now states the AC-4 contract
  (unpickable from intent time, before the pop finishes). The stale "picks through the highlight" test is
  replaced by "returns null while a mini-cube is still playing its pop".
- **Tests.** `starfield.test.ts` pins the five expansion rows, clamping, expansion persistence across
  progress-less frames, same-`Points` identity and the unchanged drift; `cube-view.test.ts` pins the exact
  child list, `FACE_NORMALS`, all-white `instanceColor`, the pop timeline on real matrices/buffers, instant
  mode, settle, repeat-id, 60 ms-independent records, `removeFace` cancellation and disposal; `scene.test.ts`
  is reworked around an engine-backed `snapshot()` helper (plan D-6), the AC-2 pose/Frustum suite, the burst
  offset origins and the pop timeline; `picking.test.ts` drops the highlight gate.

## Decisions

- **`hideMiniCube` at t = 0 does not rewrite the matrix**: the pop starts at factor `1`, which is exactly the
  tile's own matrix, so the first observable write is the first `update`. No behavioural difference; the
  instant path does write the zero matrix immediately.
- **`settlePops` writes the timeline's end state** (zero matrix **and** colour multiplier 1), not just the
  matrix: the spec's end pose is "zero scale, colour 1", so a live collapse is indistinguishable from a
  completed pop. All record writes then stop (asserted with `setMatrixAt` spies).
- **`lookAt(ORIGIN)` is also called in the `travel` and `playing` branches.** Positions are byte-identical to
  the predecessor; the extra `lookAt` is what makes a skip from an oblique intro pose land on the **rest
  orientation** (identity quaternion), which AC-2 requires ("a skip puts the camera at rest immediately").
  Without it the camera would keep the mid-search tilt at `(0,0,12)`.
- **`removeFace` cancels only that face's records in place** (backwards splice loop, no array reallocation).
  Because records can never reference a removed face, `settlePops` needs no removed-face guard (kept out to
  avoid an unreachable branch).
- **`snapToQuarterTurns` returns `rounded + 0`** so `Math.round(-1e-17) = -0` is normalised to `0`; otherwise
  `toEqual([0, 0, 0])` would fail on signed zero.
- **Test helper `instanceScale` reads basis-column lengths** rather than matrix diagonal elements: on the
  mirrored faces (`back`, `left`, `right`, `top`, `bottom`) the basis axes are not the diagonal, so lengths
  are the only face-independent scale read.

## Evidence

### `npm test --workspace @cubeclicker/frontend` → exit 0

```
 ✓ src/ws/connection.test.ts (10 tests)
 ✓ src/ui/theme.test.ts (2 tests)
 ✓ src/browser-env.test.ts (6 tests)
 ✓ src/game/effects.test.ts (23 tests)
 ✓ src/render/webgl.test.ts (5 tests)
 ✓ src/game/progression.test.ts (10 tests)
 ✓ src/game/board.test.ts (14 tests)
 ✓ src/game/rotation.test.ts (31 tests)
 ✓ src/input/gestures.test.ts (21 tests)
 ✓ src/game/engine.test.ts (33 tests)
 ✓ src/input/keyboard.test.ts (11 tests)
 ✓ src/ui/Hud.test.tsx (3 tests)
 ✓ src/ui/GameCanvas.test.tsx (2 tests)
 ✓ src/render/particles.test.ts (19 tests)
 ✓ src/render/starfield.test.ts (12 tests)
 ✓ src/render/picking.test.ts (9 tests)
 ✓ src/render/cube-view.test.ts (28 tests)
 ✓ src/game/session.test.ts (19 tests)
 ✓ src/App.test.tsx (4 tests)
 ✓ src/render/scene.test.ts (31 tests)

 Test Files  20 passed (20)
      Tests  293 passed (293)
```

### `npm run coverage --workspace @cubeclicker/frontend` → exit 0

```
 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.34 |     99.4 |     100 |   99.34 |
 src             |     100 |      100 |     100 |     100 |
 src/game        |     100 |    99.63 |     100 |     100 |
  session.ts     |     100 |    98.18 |     100 |     100 | 173
 src/input       |     100 |      100 |     100 |     100 |
 src/render      |     100 |      100 |     100 |     100 |
  cube-view.ts   |     100 |      100 |     100 |     100 |
  particles.ts   |     100 |      100 |     100 |     100 |
  picking.ts     |     100 |      100 |     100 |     100 |
  scene.ts       |     100 |      100 |     100 |     100 |
  starfield.ts   |     100 |      100 |     100 |     100 |
  webgl.ts       |     100 |      100 |     100 |     100 |
 src/ui          |   79.48 |      100 |     100 |   79.48 |
  GameCanvas.tsx |    61.9 |      100 |     100 |    61.9 | 23-30
 src/ws          |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts  |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
-----------------|---------|----------|---------|---------|-------------------
```

Per-metric workspace totals: **statements 99.34, branches 99.4, functions 100, lines 99.34** — all four ≥ 80.
The four changed render modules are 100/100/100/100. No exclusion or threshold change (config untouched).

### `npm run typecheck --workspace @cubeclicker/frontend` → exit 0

```
> typecheck
> tsc --noEmit
```

### `npm run lint` → exit 0

```
> lint
> eslint .
```

### `grep -in "cursor\|highlight" src/frontend/src/render/*.ts src/frontend/src/render/*.test.ts`

```
$ grep -in "cursor\|highlight" src/frontend/src/render/*.ts src/frontend/src/render/*.test.ts
grep exit=1 (1 = no matches)
```

`grep -in "streak" …` → also `exit=1` (no matches): the superseded wording is gone from the render layer's
code, APIs and module headers.

### Banned-matcher audit (changed test files)

```
$ grep -nE "toBeCloseTo|expect\.anything|expect\.any\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toMatchSnapshot|toHaveBeenCalled\(\)" \
    src/frontend/src/render/starfield.test.ts src/frontend/src/render/cube-view.test.ts \
    src/frontend/src/render/scene.test.ts src/frontend/src/render/picking.test.ts src/frontend/src/game/session.test.ts
banned grep exit=1 (none)
```

Bounded-exception budget: **0** (no `toBeCloseTo`, no wildcard matcher).

### Pinned-value spot checks (asserted literals in the landed tests)

| Value | Where | Assertion |
| --- | --- | --- |
| expansion @0 / .25 / .5 / .75 / 1 | `starfield.test.ts:179-188` | `[1,1,1]`, `[1.875,1.875,1]`, `[4.5,4.5,1]`, `[7.125,7.125,1]`, `[8,8,1]` |
| expansion through the scene | `scene.test.ts` (`starfield travel expansion (AC-1)`) | same five rows via `applySnapshot` + `update` |
| pop scale @50 / @100 / @130 / @160 | `cube-view.test.ts:378-400` | `Math.fround(0.9·1.05)`, `Math.fround(0.9·1.1)`, `Math.fround(0.9·0.55)`, `0` (and `Math.fround(0.25·x)`) |
| pop colour @50 / @100 / @130 / @160 | `cube-view.test.ts` | `Math.fround(1.15)`, `Math.fround(1.3)`, `Math.fround(1.15)`, `1` |
| idle colour slots | `cube-view.test.ts` (`all-white instanceColor buffer`) | 75 × `1` per face, `(1,1,1)` at slots 0/24 |
| burst origin, front | `scene.test.ts:643` | `[-2, 2, 3.125]` (`2.625 + 0.5`) |
| burst origin, `+1` yaw | `scene.test.ts:657` | `[3.125, 2, 2]` (snapped normal `(1,0,0)`) |
| burst origin, gone face | `scene.test.ts:673` | `[0, 0, 0]` |
| intro poses (7 rows, position + target) | `scene.test.ts` (`INTRO_POSES`) | exact literals, incl. `(0,0,26)@0.72`, `(0,0,13.75)@0.86`, `(0,0,12)@1` |
| identity quaternion @0.72/0.86/1 | `scene.test.ts` | `[0, 0, 0, 1]` |
| travel pull-away | `scene.test.ts` | `21.75@0.25`, `51@0.5`, `90@1` |

### Render suites (verbose, AC coverage by test name) → exit 0

```
 ✓ src/render/starfield.test.ts (12 tests)
 ✓ src/render/picking.test.ts (9 tests)
 ✓ src/render/cube-view.test.ts (28 tests)
 ✓ src/render/scene.test.ts (31 tests)
   … including:
   ✓ cube-view.test.ts > hideMiniCube > plays the pinned pop timeline on the real instance matrix and colour
   ✓ cube-view.test.ts > hideMiniCube > hides instantly for reduced motion: zero scale, no colour write
   ✓ cube-view.test.ts > hideMiniCube > runs independent records 60 ms apart, side by side
   ✓ cube-view.test.ts > removeFace > cancels that face’s pop records and keeps the others running
   ✓ cube-view.test.ts > settlePops > zero-scales every running pop at once and clears the records
   ✓ scene.test.ts > introCameraPose (AC-2) > yields the pinned pose table for every row
   ✓ scene.test.ts > intro search → find → approach (AC-2) > searches off-screen, finds the cube centred and frames it fully (frustum gates)
   ✓ scene.test.ts > intent application > pops the exploding tile and fronts its burst at the clicked surface (AC-3, AC-4)
   ✓ scene.test.ts > intent application > settles a running pop when the snapshot switches to reduced motion (AC-4)
```

## Acceptance audit (T2 scope)

- **AC-1 — Travel backdrop expansion** → met. `starfield.test.ts` pins the five expansion rows directly on the
  real `Points`, clamping, expansion persistence, same-`Points` identity and the exact drift (`update(1000)` →
  `0.0152587890625`); `scene.test.ts` pins the same rows through the snapshot + `update` wiring and the
  reduced-motion `(1,1,1)` collapse.
- **AC-2 — Intro search → find → approach** → met. `introCameraPose` pinned at the pure level for all 7 rows
  (position **and** target); `applySnapshot` position arrays, identity quaternion at p = 0.72/0.86/1, real
  `Frustum` gates (off-screen at 0/0.2/0.4, centre-in at 0.56, all eight corners in at 0.72), skip/`playing` →
  rest, reduced → rest at every p, travel pull-away unchanged.
- **AC-3 — Burst in front of the clicked mini-cube** → met (render side). `applyExplosion` reads origin +
  snapped world normal before hiding and offsets by `BURST_ORIGIN_OFFSET = 0.5`: `(-2,2,3.125)` front,
  `(3.125,2,2)` after `+1` yaw, `(0,0,0)` gone-face fallback; `snapToQuarterTurns` pinned (1e-9, `-0`
  normalised, genuine in-between values untouched).
- **AC-4 — Pop-then-shrink with bounded colour flash** → met. The pure timeline is T1's; `cube-view.test.ts`
  pins the matrix evolution on the real instance matrices (`Math.fround(0.9 × factor)`,
  `Math.fround(0.25 × factor)`) and the `instanceColor` slots at t = 0/50/100/130/160/≥160, position
  preserved, end state zero-scale reached once; instant mode writes no colour and creates no record;
  `scene.test.ts` covers the same through `update`, plus `settlePops` on a reduced-motion snapshot.
- **AC-5 — Pop interactions and bounded resources** → met. Repeat-id no restart, two records 60 ms apart stay
  60 ms apart at the pinned checkpoints, `removeFace` cancels only its face's records (asserted with a
  `setMatrixAt` spy on the removed mesh), `dispose` clears the records, no new drawables (13 cube children,
  10-cycle object-count baseline green), `applyStyle` leaves the `instanceColor` buffers untouched.
- **AC-6 — Selection cursor removed (render side)** → met. No highlight mesh/material/API, no `CURSOR_*` or
  `CursorAnchor` exports, scene never updates a highlight, cube group = body + 6 grids + 6 plates; render
  layer grep for `cursor|highlight` is empty (code, APIs, headers).
- **AC-7 (partial)** → met: lint / typecheck / workspace tests / workspace coverage all exit 0 with all four
  metrics ≥ 80; no exclusions, no threshold changes, no new dependencies; only the owned files plus the
  documented `session.test.ts` assertion fix changed.

## Deviations

- **D-1 — `session.test.ts` (not in T2 `files_owned`): two assertions of superseded predecessor behaviour.**
  Required by the T2 verify gate (`npm test --workspace @cubeclicker/frontend` → 0) and by the spec's
  Supersessions table; no production code changed in that file:
  - `attach > sizes the renderer …`: expected the predecessor intro start `[0,0,60]` → now the AC-2 opening
    pose `[36,20,24]` (the old assertion is exactly the superseded AC-22 path).
  - `pointer wiring > explodes the front-face mini-cube …`: expected the AC-5 instant zero-scale after one
    frame → now asserts the AC-4 mid-pop factor at t = 16 ms (`Math.fround(0.9 · 1.016)`, position preserved)
    and the zero-scale end state after `tick(192)` (t = 160 ms).
  Both are test-only, three lines of assertions, and do not collide with T3's planned `cursor`-field edit in
  the same file. Flagged for the orchestrator in the Subagent Report (files_owned should have listed
  `session.test.ts` for T2).
- **D-2 — Intro pose row p = 0.56 is f64-exact, not decimal-exact.** `0.56` is not binary-exact between the
  0.4/0.72 segment bounds, so the pinned formulas evaluate to
  `(3.999999999999993, 1.9999999999999964, 26.25)` / target `(0, 3.749999999999993, -4.999999999999993)`
  instead of the table's `(4, 2, 26.25)` / `(0, 3.75, -5)` (≤ 7e-15). The test pins the exact f64 outputs with
  an in-test comment; the other six rows are bit-exact to the table. No `toBeCloseTo`, no assertion weakening
  — a wrong formula or a transposed axis still fails.
- **D-3 — `lookAt(ORIGIN)` added to the `travel`/`playing` camera branches** (positions unchanged). See
  Decisions: needed so an intro skip lands on the pinned rest *orientation*, as AC-2 requires.
- **D-4 — `settlePops` also restores the colour multiplier to 1** (spec says "zero-scales"; the timeline's end
  state is zero scale **and** multiplier 1). Invisible either way at zero scale; keeps the end state single.

## Scope discipline

No changes outside the owned render files, their tests and the documented `session.test.ts` assertion fix.
`game/**` production code, `ui/**`, `ws/**`, configs, `docs/features/cube-game-frontend/**` and the feature's
planning artifacts (spec/plan/tasks/status/reviews) are untouched by this task. No new dependencies; lockfile
unchanged.
