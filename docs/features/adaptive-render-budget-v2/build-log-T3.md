# Build log — T3 — Scene shadow budget

Task: T3 (2026-11-12)

Files changed:
- `src/frontend/src/render/scene.ts`
- `src/frontend/src/render/scene.test.ts`
- `docs/features/adaptive-render-budget-v2/build-log-T3.md`

Not changed (verified): `src/frontend/src/render/scene-spaceship.test.ts`, `src/frontend/src/render/scene-effects.test.ts` — both pass unchanged (37 tests, see Evidence).

What changed & why (sketch):
- `applyQuality()` now applies `features.shadowMapSize`: `keyLight.castShadow = size > 0`; on a size change it disposes and nulls the live `shadow.map`, then sets `mapSize` (2048/1024; 0 at low = shadows off, map untouched).
- `KEY_SHADOW_MAP_SIZE` is now `QUALITY_SHADOW_MAP_SIZES.high` (still `2048`); `KEY_SHADOW_BIAS`, `KEY_SHADOW_NORMAL_BIAS`, `KEY_SHADOW_RADIUS` are unchanged.
- Construction remains high: `castShadow = true` + 2048², so the first `applyQuality()` changes nothing and every existing scene pin holds.
- `scene.test.ts` gains a `scene shadow budget (AC-6, AC-7, AC-8, AC-9)` block: default high 2048/on/no target, medium 1024/no target, low off without resampling, restoration to high, and a fake `shadow.map` disposed exactly once and nulled on the 2048 → 1024 transition (no double disposal on the way back).

Decisions:
- Reduced motion is authoritative for motion only; the shadow budget is static GPU cost, so the same tier matrix applies under both motion modes (the `applyQuality()` dedupe already keys on tier + reduced flag, and the shadow values do not depend on `reducedMotion`).
- At low (`size === 0`) the map size is deliberately left at its previous value: AC-8 pins "the existing 2048/1024 map is not resampled", and the adapter (T2) already disables `renderer.shadowMap.enabled`, so nothing renders or reallocates it.
- The fake `shadow.map` uses a real `vi.fn()` `dispose` cast to `WebGLRenderTarget`; the scene never renders in node, so the fake never reaches GL code.
- Tiers are driven through the existing `setQualityTierForTesting` seam only; no production override surface was added.

Evidence:

- `npm run lint` → exit 0
```
> lint
> eslint .
```

- `npm run typecheck` → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

- `npm run test --workspace @cubeclicker/frontend` → exit 0
```
 Test Files  64 passed (64)
      Tests  1762 passed (1762)
   Duration  3.06s (transform 5.37s, setup 0ms, collect 18.16s, tests 8.95s, environment 5.14s, prepare 6.60s)
```
  (was 1757 before T3: +5 new tests, no test removed or changed)

- Focused changed-module run, `npx vitest run src/render/scene.test.ts --root src/frontend --reporter=verbose` → exit 0
```
 ✓ src/render/scene.test.ts > scene shadow budget (AC-6, AC-7, AC-8, AC-9) > starts at high with a 2048 map, shadows on and no allocated render target (AC-6) 14ms
 ✓ src/render/scene.test.ts > scene shadow budget (AC-6, AC-7, AC-8, AC-9) > resizes the map to 1024 at medium, keeping shadows on and no target allocated (AC-7) 11ms
 ✓ src/render/scene.test.ts > scene shadow budget (AC-6, AC-7, AC-8, AC-9) > turns the shadow pass off at low without resampling the existing map (AC-8) 7ms
 ✓ src/render/scene.test.ts > scene shadow budget (AC-6, AC-7, AC-8, AC-9) > restores the high shadow budget after low (AC-9) 8ms
 ✓ src/render/scene.test.ts > scene shadow budget (AC-6, AC-7, AC-8, AC-9) > disposes an allocated shadow map exactly once when the map size changes (AC-9) 8ms
 Test Files  1 passed (1)
      Tests  90 passed (90)
```
  The pre-existing `shadow quality constants (AC-2)` pins still pass unchanged (`pins KEY_SHADOW_MAP_SIZE` → `2048`, bias `-0.0001`, normal bias `0.02`, radius `2`).

- Sibling scene suites unchanged, `npx vitest run src/render/scene-spaceship.test.ts src/render/scene-effects.test.ts --root src/frontend` → exit 0
```
 ✓ src/render/scene-effects.test.ts (9 tests) 132ms
 ✓ src/render/scene-spaceship.test.ts (28 tests) 295ms
 Test Files  2 passed (2)
      Tests  37 passed (37)
```
  `git diff --exit-code --stat -- src/frontend/src/render/scene-spaceship.test.ts src/frontend/src/render/scene-effects.test.ts` → exit 0 (no edit needed: neither suite asserts an always-on shadow/SSAO assumption)

- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (threshold 80 on all four metrics)
```
 Test Files  64 passed (64)
      Tests  1762 passed (1762)
All files          |   96.46 |    95.48 |   97.49 |   96.46 |
  scene.ts         |   97.26 |    95.78 |    95.34 |   97.26 | ...1055,1063-1064
```

- `npm run coverage` (root, both workspaces; AC-15 cross-check) → exit 0
```
backend (24 files):  Test Files  24 passed (24)   Tests  868 passed (868)
All files          |   95.43 |    87.71 |    99.7  |   95.43 |
frontend (64 files): Test Files  64 passed (64)   Tests  1762 passed (1762)
All files          |   96.46 |    95.48 |   97.49 |   96.46 |
```
  Every metric ≥ 80 in both workspaces; no coverage exclusion or threshold was touched.

- High-tier parity re-check (focused): the existing `scene composition` test still pins `castShadow === true`, `mapSize.width/height === KEY_SHADOW_MAP_SIZE (2048)`, and the unchanged bias/normal-bias/radius; the new default-view test re-pins `2048/true` and `shadow.map === null` before any render.

Acceptance audit:
- AC-6 (scene half) → met: high/default view is `castShadow === true` with a `2048 × 2048` map and no allocated target before the first render; `KEY_SHADOW_MAP_SIZE === QUALITY_SHADOW_MAP_SIZES.high === 2048`; bias/normal-bias/radius unchanged.
- AC-7 (scene half) → met: forcing `medium` leaves shadows on and sets `mapSize 1024 × 1024`, with `shadow.map === null` (no stale 2048 target).
- AC-8 (scene half) → met: forcing `low` sets `keyLight.castShadow === false`; the existing 1024 map size is not resampled/reallocated (asserted after a medium step), matching the user-approved shadows-off default.
- AC-9 (scene half) → met: `low → high` restores `castShadow === true` and `2048`; a fake allocated `shadow.map` is disposed exactly once and nulled on the size-changing transition, with no double disposal on the following transition; returning to high leaves no allocated target.
- AC-15 (task scope) → met: new behavior covered at the integration tier (`scene.test.ts` drives the real three.js scene graph); the policy/unit tier is unchanged and already pinned by T1; full frontend suite 1762/1762 green and coverage ≥ 80 on all four metrics.

Deviations from spec: none.

Out-of-scope artifacts: the untracked `spec.md`, `plan.md`, `tasks.md`, `status.md`, and `reviews/**` under the feature directory are planner/reviewer/orchestrator artifacts staged by T5; this commit does not include them.
