# Build log — T1 — Seamed mini-cube surface + pointer drag removal

Task: T1 (2026-10-21), spec r1 AC-1 / AC-2, plan r1 § Interfaces.
Files changed: `src/frontend/src/render/cube-view.ts`, `render/cube-view.test.ts`,
`render/picking.test.ts`, `render/scene.test.ts`, `src/frontend/src/game/session.ts`,
`game/session.test.ts`, `src/frontend/src/input/gestures.ts` (doc comment only),
`docs/product/glossary.md`, this build log.

What changed & why: `MINI_CUBE_TILE_RATIO` 1 → 0.95 so every tile is inset and the body
shows through a uniform 5% seam (no plates, no new objects); the session's `playing` + drag
branch now returns before the pick path so a classified drag dispatches nothing; the
tests re-pin the inset extents/seams/pop literals, the pick seam-misses and the
drag-ignored pointer policy; the glossary and the `gestures.ts` doc describe the seamed
surface and the ignored drag.

Decisions:
- Extents/seams are asserted with the pinned `Math.fround` composition (the matrices are
  `Float32Array`). The seam readback is pinned per pair because storing the extent as a
  float32 shifts the ideal seam (`cell × 0.05`: 1/12, 0.05, 1/28) by a few float32 ulps;
  the ideal values and the ulp note live beside the fixtures.
- **Deviation (test literal only, spec-compliant):** the task text asked for the former
  grid-gap NDC literals `0.11` / `0.12` to become `null` seam misses. They do not: the
  pick ray converges towards the face and the tile is 0.25 thick, so on the tile's near
  plane (`z = 2.75`) NDC 0.11 is world x ≈ 0.4745 (inside col 2's inset tile edge 0.475)
  and NDC 0.12 is world x ≈ 0.5316 at the far plane (`z = 2.5`), where it crosses into
  col 3's side face. Verified empirically: with the reworked group the picks return
  `front:2:2` / `front:2:3`. The true N=5 seam-miss window at the front plane is
  `(0.110123, 0.118512)`; the group now pins the seam-midpoint projection `0.1144` and
  `0.118` as `null` (both axes) plus the required inset hits (`0.10294` → `front:2:2`,
  `0.12581` → `front:2:3`). AC-1's "a tap in a seam is a miss" is asserted; the N = 3 / 7
  pairs use the seam midpoints (`0.190623`, `0.081696`). `picking.ts` is untouched.
- `cube-view.ts` doc comments that described the old flush tiling (module doc + the
  `tileSize` comment) were updated to the seamed wording; no logic changed.

## Evidence

### `npm test --workspace @cubeclicker/frontend` → 0

```
 ✓ src/render/cube-view.test.ts (32 tests)
 ✓ src/render/picking.test.ts (12 tests)
 ✓ src/game/session.test.ts (25 tests)
 ✓ src/render/scene.test.ts (51 tests)
 Test Files  20 passed (20)
      Tests  336 passed (336)
```

Focused verbose run of the changed suites (`npx vitest run <4 files> --root src/frontend
--reporter=verbose`) → exit 0, including:

```
 ✓ picking.test.ts > pickMiniCube > misses in the seam between two tiles and still hits just inside their edges (N = 5)
 ✓ picking.test.ts > pickMiniCube > misses at the N = 3 and N = 7 seam midpoints and hits just inside the tiles
 ✓ picking.test.ts > pickMiniCube > decodes a 1 × 1 grid: the single inset tile spans 95% of the face
 ✓ cube-view.test.ts > cube geometry constants > pins the body and inset tile geometry values (AC-1)
 ✓ cube-view.test.ts > seamed tiling (AC-1) > sizes every tile to 0.95 of a cell on its face axes (N = 3, 5, 7)
 ✓ cube-view.test.ts > seamed tiling (AC-1) > keeps the pinned first/last centres and the exact cell spacing (N = 3, 5, 7)
 ✓ cube-view.test.ts > seamed tiling (AC-1) > leaves the uniform seam between adjacent tiles and the half-seam rim (N = 3, 5, 7)
 ✓ cube-view.test.ts > seamed tiling (AC-1) > orients each tile on its face with the inset cell extent (N = 5)
 ✓ cube-view.test.ts > hideMiniCube > plays the pinned pop timeline on the inset tile (N = 5)
 ✓ cube-view.test.ts > hideMiniCube > scales the pop from the inset cell of a larger grid (N = 7)
 ✓ session.test.ts > pointer wiring > skips the intro on a tap and ignores an intro drag (AC-2)
 ✓ session.test.ts > pointer wiring > maps taps and drags to the events each phase allows (injected engine, drags do nothing)
 ✓ session.test.ts > pointer wiring > ignores a playing drag: no rotation, no click, no publish (AC-2)
 ✓ session.test.ts > pointer wiring > keeps fast, jittery clicks as independent taps and drops a 41 px drag (AC-2)
```

### `npm run coverage --workspace @cubeclicker/frontend` → 0 (four metrics ≥ 80)

```
 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.33 |    99.41 |     100 |   99.33 |
 src/game        |     100 |     99.6 |     100 |     100 |
  session.ts     |     100 |    98.18 |     100 |     100 | 175
 src/input       |     100 |      100 |     100 |     100 |
  gestures.ts    |     100 |      100 |     100 |     100 |
 src/render      |     100 |      100 |     100 |     100 |
  cube-view.ts   |     100 |      100 |     100 |     100 |
  picking.ts     |     100 |      100 |     100 |     100 |
  scene.ts       |     100 |      100 |     100 |     100 |
-----------------|---------|----------|---------|---------|-------------------
```

Statements 99.33, branches 99.41, functions 100, lines 99.33 — all ≥ 80. No exclusions or
threshold changes; `src/frontend/vitest.config.ts` untouched.

### `npm run typecheck --workspace @cubeclicker/frontend` → 0

```
> typecheck
> tsc --noEmit
typecheck exit=0
```

### `npm run lint` → 0

```
> lint
> eslint .
lint exit=0
```

### `grep -n "plateMeshes\|PLATE_OFFSET" src/frontend/src/render/cube-view.ts src/frontend/src/render/scene.ts` → no matches

```
exit=1   (grep: no matches)
```

### `grep -n "tiles sit flush" docs/product/glossary.md` → no matches

```
exit=1   (grep: no matches)
```

### Banned-matcher grep over the changed test files → no matches

```
grep -nE "expect\.(anything|any|objectContaining|arrayContaining|stringContaining|stringMatching)|toMatchObject|toMatchSnapshot|toHaveBeenCalled\(\)|toBeTruthy|toBeDefined|not\.toThrow|toBeCloseTo" \
  src/frontend/src/render/cube-view.test.ts src/frontend/src/render/picking.test.ts \
  src/frontend/src/render/scene.test.ts src/frontend/src/game/session.test.ts
exit=1   (grep: no matches)
```

### Pinned seam / extent spot checks (f32 composition used by the fixtures)

```
N=3 cell=1.6666666666666667 tileEdge=1.5833333730697632 centreStep=1.6666666269302368 seam=0.08333325386047363 rim=0.04166668653488159
N=5 cell=1                  tileEdge=0.949999988079071  centreStep=1                  seam=0.050000011920928955 rim=0.025000005960464478
N=7 cell=0.7142857142857143 tileEdge=0.6785714030265808 centreStep=0.7142856121063232 seam=0.03571420907974243 rim=0.017857223749160767
```

Ideal seam `cell × 0.05` = 1/12, 0.05, 1/28; ideal rim = half seam (1/24, 0.025, 1/56).
The fixtures pin the readback values above (`SEAMED_LAYOUTS.seamGaps` / `.outerRim`), the
extent as `Math.fround((CUBE_SIZE / N) × 0.95)`, and the retained centres/`columnSteps`
verbatim. N = 7's outermost centre pairs are one float32 ulp inside `Math.fround(5/7)`, so
their gaps are pinned separately (0.03571420907… vs 0.03571432828…).

Pop literals re-pinned: cube-view `Math.fround(TILE_SIZE × factor)` (TILE_SIZE = 0.95) at
0/50/100/130/160 ms, N = 7 peak `Math.fround(cell × 0.95 × 1.1)`; scene idle
`[Math.fround(0.95), Math.fround(0.95), 0.25]`, t = 50 `Math.fround(0.95 × 1.05)` /
`Math.fround(0.25 × 1.05)`, neighbour idle `Math.fround(0.95)`, reduced-motion settle
`Math.fround(0.95 × 1.05)`; session t = 16 ms `Math.fround(0.95 × 1.016)` (position
`[0, 0, 2.625]` unchanged).

## Acceptance audit

- **AC-1 — seamed mini-cube surface:** met. `MINI_CUBE_TILE_RATIO === 0.95` asserted;
  face-axis extents `Math.fround((CUBE_SIZE/N) × 0.95)` with thickness 0.25 for N = 3/5/7;
  adjacent-tile seams and the `CUBE_HALF_SIZE − seam/2` perimeter rim asserted on every
  face for N = 3/5/7; centres/child list (body + 6 `InstancedMesh`, 7) and body material
  (`style.cubeColor`) retained; centre picks resolve ids on 3/5/7, seam taps return `null`;
  pop timeline unchanged in factor form; reduced motion unchanged; glossary wording
  updated (no "flush"). Evidence: the four suites above, the greps, `git diff`.
- **AC-2 — pointer drags never rotate:** met. Recording engine: `playing` drags (yaw and
  pitch) record zero events; real engine: snapshot identity unchanged after the same
  drags, no publish; tap → `explodeMiniCube` and intro/travel groups retained; fast 5 px
  jitter clicks are two independent taps (two explosions / two real-engine clicks 60 ms
  apart) and a 41 px release is a drag → zero events; `gestures.ts` logic byte-identical
  (its 21 tests, incl. the 39/40/41 boundary, pass unmodified). Evidence: `session.test.ts`,
  `gestures.test.ts`.

Deviations from spec: none. Deviation from the task's suggested test literals: the N = 5
seam-miss NDC values (`0.11` / `0.12` → `null` is geometrically impossible without
changing `picking.ts`); pinned the true seam-miss window instead — see Decisions above.
