# Build log — T1 — Remove the gold impact explosion; keep shard debris and sparks

Task: T1 (2026-11-11)
Feature: particle-only-click-effects (spec r2, plan r2)

## Fork point (recorded before the first T1 edit)

Precondition commit (orchestrator-authorized; only `docs/features/README.md` staged):

```
$ git add -- docs/features/README.md
$ git commit -m "docs: freeze accepted feature index rows"
[main d5a83f6] docs: freeze accepted feature index rows
 1 file changed, 1 insertion(+)
$ git status --porcelain -- docs/features/README.md
(empty)
$ BASE_SHA=$(git rev-parse HEAD)
BASE_SHA=d5a83f6d3fcdee93a4b61c9848cdec818a5a317a
```

`BASE_SHA=d5a83f6d3fcdee93a4b61c9848cdec818a5a317a` (not `git merge-base main HEAD`).

## Files changed

- `src/frontend/src/render/impact-effects.ts`
- `src/frontend/src/render/impact-effects.test.ts`
- `src/frontend/src/render/quality.ts`
- `src/frontend/src/render/quality.test.ts`
- `src/frontend/src/render/scene.ts`
- `src/frontend/src/render/scene.test.ts`
- `src/frontend/src/render/scene-spaceship.test.ts`
- `docs/features/particle-only-click-effects/build-log-T1.md`

## What changed & why

Impact module reduced to the single `impact-shards` `InstancedMesh`: ray fan, coin discs, ring shockwave, their geometries/materials/instance-colour buffers, spawn/update/write paths, constants and imports removed; shard pool/physics kept verbatim. Quality matrix now `QUALITY_SHARD_COUNTS` (14/7/0) plus the unchanged `QUALITY_SPARK_COUNTS` (24/12/0); `impactRays`/`impactCoins`/`shockwaveExpand` and `QUALITY_IMPACT_COUNTS` removed. Scene forwards `{ shards: features.impactShards }` and keeps both `impact.spawnPop(...)` and `particles.spawn(...)`. Tests pin one impact child, no gold pool names, green material, 14 default, `[0, 14]` clamp, 1200 ms lifetime, 42-cap oldest-first recycle, idempotent dispose, the exact quality matrix and the 133-object/9-child baseline.

## Decisions / notes

- Module name, `createImpactEffects` factory, `spawnPop(origin, normal, nowMs)` signature and all shard constants/physics unchanged; runtime exports are exactly `DEBRIS_POOL_CAP`, `DEBRIS_PER_POP`, `createImpactEffects` (pinned with `import * as`).
- No `particles.ts`/`game/motion.ts`/UI/backend/protocol/container/config change; no dependency added.
- One bounded float-tolerance assertion is used in `impact-effects.test.ts` (`toBeCloseTo(3.07, 5)`) because `InstancedMesh.instanceMatrix` stores Float32 values and the read-back cannot equal the exact double; the x/y components are asserted exactly and the recycle test uses the exact integer x. This is the task's single tolerance assertion (bounded exception rule).

## Evidence

```
$ npm run lint
> lint
> eslint .

exit 0
```

```
$ npm run typecheck --workspace @cubeclicker/frontend
> typecheck
> tsc --noEmit

exit 0
```

```
$ npm test --workspace @cubeclicker/frontend
> test
> vitest run

 Test Files  63 passed (63)
      Tests  1693 passed (1693)
   Duration  3.02s (transform 6.17s, setup 0ms, collect 17.69s, tests 9.22s, environment 5.63s, prepare 6.69s)

exit 0
```

```
$ npm run coverage --workspace @cubeclicker/frontend
> coverage
> vitest run --coverage

 Test Files  63 passed (63)
      Tests  1693 passed (1693)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.31 |    95.35 |   97.41 |   96.31 |
 src/render        |   98.53 |    96.37 |   98.69 |   98.53 |
  ...ct-effects.ts |   97.27 |     90.9 |     100 |   97.27 | 117,131,169-170
  quality.ts       |   97.61 |    96.87 |     100 |   97.61 | 208-209,289-290
  scene.ts         |    97.2 |     95.7 |   95.34 |    97.2 | ...1025,1033-1034
-------------------|---------|----------|---------|---------|-------------------

exit 0
```

Focused impact/quality/scene run (during implementation):

```
$ npx vitest run src/render/impact-effects.test.ts src/render/quality.test.ts src/render/scene-spaceship.test.ts src/render/scene.test.ts
 Test Files  4 passed (4)
      Tests  143 passed (143)
```

`scene.test.ts` baseline evidence: `countObjects(view.scene) === 63 + COSMIC_BACKDROP_OBJECT_COUNT === 133`, `scene.children` 9 (10 with a remote world), 10 explosion cycles return to the same object count — all passed in the full run above.

## Acceptance audit

- AC-1 → met. `impact-effects.test.ts`: exact runtime exports; one child named `impact-shards` (no `impact-rays`/`impact-coins`/`impact-ring`); `BoxGeometry(0.09, 0.09, 0.09)`; `MeshStandardMaterial` colour `0x44cc88`, metalness 0.2, roughness 0.5; capacity 42; default 14; clamp `[0, 14]`; 1200 ms lifetime release; 42-cap oldest-first recycle; dispose once + idempotent. Shard constants/physics untouched in the implementation.
- AC-2 → met. `quality.test.ts`: `QUALITY_SHARD_COUNTS` `{ high: 14, medium: 7, low: 0 }`, `QUALITY_SPARK_COUNTS` `{ high: 24, medium: 12, low: 0 }`, exact high/medium/low × normal/reduced `toEqual` matrices without `impactRays`/`impactCoins`/`shockwaveExpand`, `QUALITY_IMPACT_COUNTS` absent; the untouched policy tests pass.
- AC-3 → met. `scene-spaceship.test.ts`: high 14 shards + 24 sparks, medium 7 + 12, low 0 + 0, reduced motion 0 + 0; one `impact-effects` child; no scene object named `impact-rays`/`impact-coins`/`impact-ring`; conceal/targeting/camera-equality assertions still pass.
- AC-4 → met. Full frontend suite 63 files / 1693 tests passed without weakened assertions (`npm test` exit 0 above).
- AC-5 → met. `scene.test.ts`: 133 objects = 63 pre-backdrop (two-object impact group) + 70 cosmic; 9 scene children (10 with a remote world); the impact group contributes one drawable.
- AC-9 → met. `npm run coverage` exit 0; aggregate 96.31 statements / 95.35 branches / 97.41 functions / 96.31 lines (≥ 80 on all four); no exclusion or threshold changed.

## Deviations from spec

none
