# Build log — T10 — Cosmic backdrop (asteroids, meteors, comet, hero ship)

Task: T10 (2026-11-07)
Files changed: `src/frontend/src/render/cosmic-backdrop.ts`, `src/frontend/src/render/cosmic-backdrop.test.ts`, `docs/features/reference-image-game-view/build-log-T10.md`

## What changed & why

- New pure render module `createCosmicBackdrop(random)` owns one `Group` named `cosmic-backdrop` with exactly `COSMIC_BACKDROP_OBJECT_COUNT = 28` objects: the group, 7 `DodecahedronGeometry`/`MeshStandardMaterial` asteroids, 3 meteor groups (head + additive, non-depth-writing tail), 1 `comet` group (orange `comet-head`, additive tail) and 1 `hero-ship` group (blue hull, nose, two wings, cockpit, two orange `hero-engine` flames, `rotation.y = Math.PI / 2`).
- Every object stays behind the cube (`z < -4`); the comet and hero ship sit on the right (`x > 0`) at the AC-11 pinned positions `(7.5, 2.2, -18)` and `(9, -2.5, -14)`.
- Slow `update(dtMs, reducedMotion?)` clamps the advance with `Math.max(0, dtMs)`; asteroids tumble, meteors drift inside their bands, the comet and hero ship bob around their pinned positions. Reduced motion and non-positive dt freeze every transform.
- `dispose()` detaches the group from its parent, releases all 22 owned geometries/materials and the nebula texture exactly once (idempotent), then clears the group.
- `cosmic-backdrop.test.ts` pins counts/names/colours/positions/rotation, the two engines, no shadow casting, the behind-the-cube band, exact positive-dt motion for every object family, the reduced-motion freeze, dt clamping and disposal-once/removal.

## Decisions

- Layout is fixed (the shared `random` is forwarded to `createNebulaTexture` only); motion uses binary-exact speeds so tests assert exact post-update numbers instead of tolerances.
- Asteroids rotate on x; meteors translate in x/y and wrap inside a fixed band; the comet and hero ship bob on y around their pinned positions. All other axes stay fixed, so the z band and the hero's `rotation.y` survive every update.
- Integration-tier exception: `render/cosmic-backdrop.ts` is a pure three.js object factory with no I/O/UI/network boundary; its composition boundary (scene child, `scene.background`, update forwarding, scene disposal) is owned by T11 and asserted in `scene.test.ts`, which this task is explicitly barred from touching.

## Evidence

### Targeted task test

```text
$ npm test --workspace @cubeclicker/frontend -- src/render/cosmic-backdrop.test.ts

> test
> vitest run src/render/cosmic-backdrop.test.ts


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/render/cosmic-backdrop.test.ts (13 tests) 102ms

 Test Files  1 passed (1)
      Tests  13 passed (13)
   Start at  21:49:36
   Duration  390ms (transform 56ms, setup 0ms, collect 86ms, tests 102ms, environment 0ms, prepare 57ms)
```

### `npm run lint`

```text
$ npm run lint

> lint
> eslint .

LINT_EXIT=0
```

### `npm run typecheck`

```text
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

### `npm test --workspace @cubeclicker/frontend`

```text
$ npm test --workspace @cubeclicker/frontend

 ✓ src/render/cosmic-backdrop.test.ts (13 tests) 154ms
 ...
 Test Files  1 failed | 52 passed (53)
      Tests  1 failed | 1305 passed (1306)
   Duration  2.72s (transform 5.90s, setup 0ms, collect 13.92s, tests 5.82s, environment 3.33s, prepare 4.19s)
```

The only failure is the known-red `src/render/scene.test.ts` old-palette expectation (T11 owns the scene wiring and updates this literal):

```text
 FAIL  src/render/scene.test.ts > intent application > exposes the live cube view through the rebuild-aware accessor (AC-16)
AssertionError: expected '0a2418' to be '0b0b12' // Object.is equality
 ❯ src/render/scene.test.ts:1596:82
```

`cosmic-backdrop.test.ts` and the other 52 frontend test files pass.

### `npm run coverage --workspace @cubeclicker/frontend`

Exact task command (the known-red scene test makes the process exit 1, so `--coverage.reportOnFailure` surfaces the table; the table itself is above every threshold — no threshold error is printed):

```text
$ npm run coverage --workspace @cubeclicker/frontend -- --coverage.reportOnFailure

 Test Files  1 failed | 52 passed (53)
      Tests  1 failed | 1305 passed (1306)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |    95.6 |     95.3 |   96.55 |    95.6 |
 src/render        |   98.88 |    96.56 |   98.55 |   98.88 |
  ...c-backdrop.ts |   99.28 |    95.83 |     100 |   99.28 | 380-381
-------------------|---------|----------|---------|---------|-------------------
```

(Only line 380-381, the defensive `update()` after `dispose()` guard, is uncovered. All four workspace metrics are ≥ 80; the frontend aggregate is 95.6 % statements / 95.3 % branches / 96.55 % functions / 95.6 % lines.)

Excluding only the known-red `src/render/scene.test.ts` (T11-owned) produces a green exit, confirming the gate and covering the backdrop through the remaining suite:

```text
$ npm run coverage --workspace @cubeclicker/frontend -- --coverage.reportOnFailure --coverage.reportsDirectory=/tmp/opencode/coverage-t10-green --exclude src/render/scene.test.ts

 Test Files  52 passed (52)
      Tests  1229 passed (1229)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   94.84 |    94.44 |   96.16 |   94.84 |
 src/render        |   98.88 |    96.56 |   98.55 |   98.88 |
  ...c-backdrop.ts |   99.28 |    95.83 |     100 |   99.28 | 380-381
-------------------|---------|----------|---------|---------|-------------------
COVERAGE_GREEN_EXIT=0
```

## Acceptance audit

- AC-11 → met: `cosmic-backdrop.test.ts` asserts the `cosmic-backdrop` name, `countObjects === 28`, 7 dodecahedron/standard-material asteroids, 3 meteor groups with additive/non-depth-writing tails, the `comet` position/head colour/tail, the `hero-ship` position, `rotation.y === Math.PI / 2`, exactly seven meshes including two `hero-engine` flames with `HERO_FLAME_COLOR`, the blue `HERO_HULL_COLOR`, `z < -4` for every object and no shadow casting.
- AC-12 → met: motion test proves every asteroid, meteor, the comet and the hero ship change exactly the expected transform for `dt = 128`; the reduced-motion test freezes the full transform snapshot; the clamp test covers negative and zero dt; the disposal test spies 22 geometries, 22 materials and the texture and asserts each `dispose` once, plus parent/children removal and idempotence.
- AC-19 (backdrop share) → met: reduced motion freezes all cosmic motion.

## Deviations from spec

None. Scene wiring, `scene.test.ts` and the old-palette literal remain T11's work; `App.test.tsx` and the other in-flight files were not touched.
