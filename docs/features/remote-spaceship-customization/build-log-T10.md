# Build log — T10 — Shot visuals + `Spaceship.applyShotStyle` + pulse composition

Task: T10 (2026-11-18)
Files changed: `src/frontend/src/render/shot-visuals.ts` (new), `src/frontend/src/render/shot-visuals.test.ts` (new), `src/frontend/src/render/spaceship.ts`, `src/frontend/src/render/spaceship.test.ts`, `src/frontend/src/game/motion.ts`, `src/frontend/src/game/motion.test.ts`, `docs/features/remote-spaceship-customization/build-log-T10.md` (this log)
Branch: `feat/remote-spaceship-customization` (from `61191e9`; the pending one-line T9 hash record was committed first as `0a1b330` — `docs: record T9 build log commit hash`, content unchanged)
Commit: `feat: add v3 shot visuals and pulse composition` (feature + this log; the hash record lands in a follow-up `docs:` commit, mirroring T1/T2/T9/T14 — not pushed)

## What changed & why

- New `render/shot-visuals.ts`: the four pinned projectile geometries (`bolt` = the accepted
  0.55 × 0.07 six-sided cone with its tip at local `+z`, `orb` octahedron, `wave` torus, `shard`
  tetrahedron), the three muzzle geometries (`spark` = the accepted 0.22 octahedron, `ring`
  torus, `petal` = three crossed quads at 0°/60°/120°), and a factory for the one shared
  additive projectile material + one shared additive muzzle material. One geometry set and one
  material pair per ship; nothing is created per shot.
- `Spaceship` now resolves the equipped shot style (`shot-default` fallback) from its
  appearance at construction and on every `applyAppearance` (the existing scene call site),
  exposes `applyShotStyle(style)`, captures geometry/scale/muzzle at spawn (in-flight shots keep
  them) and writes only the two shared material colours on a style change; a repeated identical
  style is a no-op. Shot pacing (`SHOT_TRAVEL_MS` 180 / 80 ms muzzle flash / 120 ms recoil) is
  untouched.
- `Spaceship.applyPulse()` now calls `model.applyPulseScale(pulseScale)`; the low-tier reset
  also routes through `model.applyPulseScale(1)`, so the model is the only writer of its scale
  (chassis × pulse).
- `MOTION` gains `remoteShipRecoilMs: 120` and `remoteShotFlashMs: 120` for T11/T12.

## Decisions

- **Materials live in a separate `createShotMaterials()` factory.** The plan's `ShotGeometrySet`
  interface stays geometries-only (`projectiles`/`muzzles`/`dispose`), while AC-24's "plus one
  additive projectile material and one additive muzzle material" is satisfied by the module's
  material factory; `Spaceship` calls it once and owns the pair. T11's `RemoteShip` uses the same
  two factories for its own set/pair.
- **`applyAppearance` resolves the shot style defensively.** `resolveShotStyle` normalizes the
  record through `normalizeAppearanceV3` first (`appearance.shot ?? 'shot-default'`), so an
  unknown/wrong-slot `shot` entry falls back to the default instead of throwing (AC-18); this
  also makes the own ship follow a live shot equip through the scene's existing
  `spaceship.applyAppearance(nextRecord)` call. T12's explicit
  `applyShotStyle(shotStyleForPart(...))` (AC-25) is then an idempotent no-op.
- **Style signature includes `partId`** in addition to geometry/scale/muzzle/color/accent, so a
  switch between two visually identical styles is still one accepted change; identical values
  (as `shotStyleForPart` returns fresh objects) write nothing.
- **Unpinned geometry sizes are module constants** (`SHOT_ORB_RADIUS` 0.16, `SHOT_WAVE_RADIUS`
  0.18 / tube 0.05, `SHOT_SHARD_RADIUS` 0.14, `SHOT_RING_RADIUS` 0.2 / tube 0.045,
  `SHOT_PETAL_HALF_SIZE` 0.17); the accepted bolt/spark parameters are preserved exactly. The
  spec pins the four/three shape kinds, not these radii.
- **The petal is one non-indexed geometry (6 triangles)** built once, and the muzzle material is
  `DoubleSide` so the crossed quads (and a torus seen edge-on) read from behind the shot.
- **Testing tiers.** Unit: `shot-visuals.test.ts` (real three.js geometry/material objects, no
  I/O) and `motion.test.ts`. Integration: `spaceship.test.ts` exercises the real `createSpaceship`
  factory over the real three.js object graph — model + trail + prebuilt shot visuals + shot
  lifecycle + dispose — through the public handle (style switch, spawn capture, pulse
  composition, teardown). No mocking of three.js internals.

## Evidence

### `npm run lint`

```
> lint
> eslint .

EXIT:0
```

### `npm run typecheck`

```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

EXIT:0
```

### `npm test --workspace @cubeclicker/frontend`

```
 Test Files  82 passed (82)
      Tests  2643 passed (2643)
   Duration  3.75s (transform 9.12s, setup 0ms, collect 24.64s, tests 15.31s, environment 11.50s, prepare 6.45s)

EXIT:0
```

Baseline at `61191e9` (post-T9): 81 files / 2,624 tests. Delta: +1 file
(`shot-visuals.test.ts`, 8 tests), `spaceship.test.ts` 40 → 50 (+10), `motion.test.ts` 14 → 15
(+1): **+19 tests**.

Focused run:

```
$ npx vitest run src/render/shot-visuals.test.ts src/render/spaceship.test.ts src/game/motion.test.ts --root src/frontend

 ✓ src/game/motion.test.ts (15 tests) 5ms
 ✓ src/render/shot-visuals.test.ts (8 tests) 11ms
 ✓ src/render/spaceship.test.ts (50 tests) 80ms

 Test Files  3 passed (3)
      Tests  73 passed (73)
EXIT:0
```

### `npm run coverage --workspace @cubeclicker/frontend`

```
 Test Files  82 passed (82)
      Tests  2643 passed (2643)
   Duration  5.99s (transform 9.40s, setup 0ms, collect 25.66s, tests 23.36s, environment 13.18s, prepare 8.60s)
All files          |   97.02 |    96.66 |   98.13 |   97.02 |
  motion.ts        |     100 |      100 |     100 |     100 |
  shot-visuals.ts  |     100 |      100 |     100 |     100 |
  spaceship.ts     |   96.33 |      100 |   97.29 |   96.33 | ...23-724,750-753

EXIT:0
```

Frontend coverage: **statements 97.02 / branches 96.66 / functions 98.13 / lines 97.02** —
thresholds (≥ 80 on all four) passed. `shot-visuals.ts` and `motion.ts` are 100 % on all four;
`spaceship.ts`'s uncovered lines are the pre-existing defensive `updateShots` branches
(`disposed` guard 723-724 and "arrival before flash expiry" 750-753), untouched in behaviour by
T10.

### Pinned values exercised (spot check)

```
shot-default                 -> bolt/1/spark, color #fff1c8, accent #ffd27a
shot-lance-azure             -> bolt/1.25/spark,    #2f6fd6 / #7cf6ff
shot-hauler-jade             -> orb/1.1/ring,       #15803d / #86efac
shot-orca-violet             -> wave/1.2/petal,     #6d28d9 / #c4b5fd
shot-arrow-crimson           -> shard/1/petal,      #9f1239 / #fb7185
shot-kite-solar              -> orb/0.95/ring,      #f59e0b / #fef3c7
hull-dart-chrome rest        -> chassis [0.95, 0.9, 1.25]
hull-dart-chrome pulse 130ms -> [0.988, 0.936, 1.3] (within 1e-9)
classic hull rest / 130 ms   -> [1, 1, 1] / [1.04, 1.04, 1.04]
MOTION.remoteShipRecoilMs = 120; MOTION.remoteShotFlashMs = 120
```

## Acceptance audit

- **AC-17 — met (T10 scope: chassis × pulse composition).** `spaceship.test.ts` asserts the
  generated hull (`hull-dart-chrome`) at rest → `[0.95, 0.9, 1.25]` and at the 130 ms pulse peak
  (`getPulseScale() === 1.04`) → `[0.988, 0.936, 1.3]` within `1e-9`, and the classic hull
  (`hull-gold`) `[1, 1, 1]` at rest, `[1.04, 1.04, 1.04]` at 130 ms, `[1, 1, 1]` at 260 ms. A
  source guard pins `model.applyPulseScale(...)` as the only model-scale writer (no
  `model.group.scale.setScalar` / `.set`). The cursor-model API/values are T9's; the remote
  ship (no pulse), live re-skin and the preview are T11/T12/T9.
- **AC-23 — met (consumption).** The tests call the real `shotStyleForPart` and pin
  `shot-default` and four generated profiles field-for-field (`geometry`, `scale`, `muzzle`,
  `color`, `accent`); the catalog resolution itself is T2's `parts-v3.test.ts`. `shot-visuals`
  pins the accepted octahedron `spark` and adds `ring`/`petal`.
- **AC-24 — met.** `shot-visuals.test.ts` asserts exactly four projectile kinds in order
  (`bolt`/`orb`/`wave`/`shard`), three muzzle kinds (`spark`/`ring`/`petal`), the accepted bolt
  cone (radius 0.07, height 0.55, 6 segments, 12 triangles, tip at local `+z`), the octahedron
  and tetrahedron parameters/triangle counts, the torus planes, the petal's 18 vertices/6
  triangles/crossed bounds, exactly two additive materials (`#fff1c8`/0.95 and
  `#ffd27a`/0.9, no depth write, tone-mapped off, muzzle double-sided), and disposal of all
  seven geometries exactly once. `spaceship.test.ts` asserts the style switch across all four
  projectiles/three muzzles with the style colours, spawn capture (an in-flight bolt keeps its
  geometry/scale/spark after an equip while the new shot gets wave/petal/1.2), the shared
  material colour write, identical-style no-op (zero `color.set` calls) and one write per
  change, no per-shot geometry/material allocation (three shots share the same geometry and
  materials; a style switch reuses the materials), and teardown of all seven geometries + two
  materials exactly once.
- **AC-25 — met (own-ship path).** `createSpaceship({ shot: 'shot-orca-violet' })` fires
  wave/1.2/petal with `#6d28d9`/`#c4b5fd`; `applyAppearance({ shot: 'shot-arrow-crimson' })`
  switches live to shard/`#9f1239`; unknown/absent shot entries fall back to the
  bolt/1/spark `shot-default` colours. The scene's existing `spaceship.applyAppearance` call is
  the integration path; T12's explicit `shotStyleForPart` call (AC-25's wording) is an
  idempotent reinforcement.
- **MOTION tokens — met.** `motion.test.ts` pins the full object (98 keys) plus
  `remoteShipRecoilMs === 120` and `remoteShotFlashMs === 120`; the accepted tokens, the CSS
  mapping test and the mirror values stay green.

## Scope / diff checks

- `git status --porcelain` after the change lists only the six T10 code/test files plus this
  log (and the already-untracked orchestrator feature artifacts).
- Untouched: `render/remote-ship.ts`, `render/scene.ts`/`world.ts`/`cube-view.ts`,
  `multiplayer/**`, `game/engine.ts`, `game/session.ts`, `ui/SpaceshipCustomizationPanel.tsx`/
  `SpaceshipPreview.tsx`/`hangar-tabs.ts`, `parts-v2.ts`/test, backend, `package.json`,
  lockfiles, compose/Docker, `.env*`.
- No new dependency; no schema/migration change; `coin-economy` files untouched.

## Deviations from spec

None. The unpinned geometry radii are recorded under Decisions; the materials factory split is
an interface-level implementation choice that keeps the plan's `ShotGeometrySet` contract intact.
