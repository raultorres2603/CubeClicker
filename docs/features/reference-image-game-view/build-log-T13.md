# Build log — T13 — Beveled mini-cube geometry

Task: T13 (2026-11-07)
Files changed: `src/frontend/src/render/cube-view.ts`, `src/frontend/src/render/cube-view.test.ts`

## Sketch

1. Import `RoundedBoxGeometry` from `three/examples/jsm/geometries/RoundedBoxGeometry.js`.
2. Export `MINI_CUBE_BEVEL_SEGMENTS = 2` and `MINI_CUBE_BEVEL_RADIUS = 0.08`.
3. Build every face's tile geometry as `new RoundedBoxGeometry(1, 1, 1, 2, 0.08)`; keep the body `BoxGeometry(5, 5, 5)`.
4. Leave instance matrices, pop math, materials and removal logic untouched.
5. Update `cube-view.test.ts`: pin the rounded geometry type/parameters, keep the body/material/pop/removal tests, and replace the style-0 literals with the T12 emerald palette.

## What changed & why

- `cube-view.ts` now owns the two exported bevel constants and uses
  `new RoundedBoxGeometry(1, 1, 1, MINI_CUBE_BEVEL_SEGMENTS, MINI_CUBE_BEVEL_RADIUS)` for each
  face's `InstancedMesh` geometry (AC-14). The instance matrix still scales the unit tile to
  `tileSize × tileSize × MINI_CUBE_THICKNESS`, so the pop/removal matrix math is unchanged.
- The body remains `new BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE)`; materials
  (`MeshPhysicalMaterial` + clearcoat constants), instance colours, hidden/pop/removal
  bookkeeping and disposal are byte-identical.
- The header comment now describes the beveled tiles and the plain-box body.
- `cube-view.test.ts` asserts `RoundedBoxGeometry` (`type` and exact
  `{ width: 1, height: 1, depth: 1, segments: 2, radius: 0.08 }` parameters) on every face,
  asserts the body is a plain `BoxGeometry` (and not a `RoundedBoxGeometry`) with its exact
  parameters, and pins the new constants. The style-0 assertions now expect body `0a2418`
  (metalness `0.3`, roughness `0.18`), tile colour `2ee27f` (metalness `0.3`, roughness
  `0.18`), including the disposed-face retention assertions.
- All pop, removal, applyStyle, dispose, pick-free-body and instance-layout tests are
  unchanged and still pass; no assertion was weakened.

## Decisions

- Only the tile geometry changed; the body, materials and every matrix write stay as
  accepted, so the change is confined to AC-14.
- The rounded geometry is constructed per face (as the predecessor built one `BoxGeometry`
  per face) so `removeFace`/`dispose` keep releasing each face's own resources exactly once.
- `cube-view.test.ts` is the render-adapter integration tier (real three.js objects read
  through the scene graph), per the spec's testing strategy; there is no separate unit
  module boundary to test.
- Other workers were editing `App.tsx`, `particles.*` and the untracked
  `cosmic-backdrop.*`/`CustomizationToggle` files while the suite ran. Only the two owned
  files plus this log are staged.

## Evidence

### `npm run lint` (root)

```
> lint
> eslint .

```
exit 0.

### `npm run typecheck` (root)

```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```
exit 0.

### Owned test file — `npx vitest run src/render/cube-view.test.ts` (in `src/frontend`)

```
 ✓ src/render/cube-view.test.ts (33 tests) 83ms

 Test Files  1 passed (1)
      Tests  33 passed (33)
```
exit 0.

### `npm test --workspace @cubeclicker/frontend` (full frontend suite)

```
 Test Files  2 failed | 51 passed (53)
      Tests  10 failed | 1293 passed (1303)
```
exit 1. The failures are confined to the two known-red integration files not owned by T13:

- `src/App.test.tsx` — 9 failures. The full-shell markup goldens still pin the pre-T4/T5/T6/T8
  markup while `App.tsx` is mid-integration by the T8 worker:
  - `renders the full intro shell on first paint (default online session, no DOM)`
  - `keeps the stats visible without a server line before the first welcome (F7)`
  - `renders the travel phase copy in the same single live region`
  - `announces a spectate flight with the target member name (AC-17)`
  - `announces the return flight with the pinned copy (AC-18)`
  - `renders the playing phase with an empty live region that is still present`
  - `binds the HUD to the engine snapshot and the server id to the multiplayer store (AC-11, AC-23)`
  - `renders Return to my cube in the shell exactly while spectating (AC-18)`
  - `renders the pinned banner copy per transport status (AC-22)`
- `src/render/scene.test.ts` — 1 failure, the stale style-0 body literal (T11 owns it):

```
 FAIL  src/render/scene.test.ts > intent application > exposes the live cube view through the rebuild-aware accessor (AC-16)
AssertionError: expected '0a2418' to be '0b0b12' // Object.is equality

Expected: "0b0b12"
Received: "0a2418"
 ❯ src/render/scene.test.ts:1596:82
```

All other 51 test files (1293 tests) pass, including `cube-view.test.ts` (33/33),
`world.test.ts`, `progression.test.ts`, `particles.test.ts` and the UI suite.

### `npm run coverage --workspace @cubeclicker/frontend -- --coverage.reportOnFailure` (working tree with the known-red files)

```
 Test Files  2 failed | 51 passed (53)
      Tests  10 failed | 1293 passed (1303)

All files          |   95.51 |     95.1 |   93.49 |   95.51 |
  cube-view.ts     |     100 |    98.61 |    92.3 |     100 | 218
```
exit 1 from the two known-red test files; no threshold error is emitted. (The per-file
`cube-view.ts` branch/function dip is a failing-worker coverage artifact: the file is 100%
on all four metrics when its own test file runs and in the passing run below.)

### Coverage gate green with only the known-red files excluded

`npm run coverage --workspace @cubeclicker/frontend -- --coverage.reportOnFailure --exclude src/App.test.tsx --exclude src/render/scene.test.ts` (in the repository root):

```
 Test Files  51 passed (51)
      Tests  1203 passed (1203)

All files          |   89.96 |    93.26 |    95.77 |   89.96 |
  cube-view.ts     |     100 |      100 |     100 |     100 |
```
exit 0 — all four metrics are ≥ 80 (statements 89.96, branches 93.26, functions 95.77,
lines 89.96).

Standalone confirmation: `npx vitest run src/render/cube-view.test.ts --coverage` (in
`src/frontend`) reports `cube-view.ts | 100 | 100 | 100 | 100 |` (the global threshold
error in that single-file run is expected because of all-files semantics; the multi-file
passing run above is the gate).

## Acceptance audit

- AC-13 → met for this task's file: every style-0 literal in `cube-view.test.ts` expects the
  T12 emerald palette (`0a2418`, `2ee27f`, metalness `0.3`, roughness `0.18`), matching
  `progression.ts`; the tests pass.
- AC-14 → met: both constants are exported with the pinned values (`2`, `0.08`); every face
  `InstancedMesh` uses `RoundedBoxGeometry(1, 1, 1, 2, 0.08)` (asserted for all six faces);
  the body remains a plain `BoxGeometry(5, 5, 5)`; clearcoat and hidden/pop/removal
  behaviour tests are preserved and green.

## Deviations from spec

None.
