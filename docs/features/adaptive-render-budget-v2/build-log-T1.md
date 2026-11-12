# Build log — T1 — Quality GPU matrix and sorted-window p95

Task: T1 (2026-11-12)
Files changed:
- `src/frontend/src/render/quality.ts`
- `src/frontend/src/render/quality.test.ts`
- `docs/features/adaptive-render-budget-v2/build-log-T1.md`

What changed & why:
- `QualityFeatures` gains `ssao`, `bloom`, `shadowMapSize`, `pixelRatioCap` (GPU budget, AC-5); the four fields are identical for `reducedMotion` true/false.
- New exported constants `QUALITY_SHADOW_MAP_SIZES = { high: 2048, medium: 1024, low: 0 }` and `QUALITY_PIXEL_RATIO_CAPS = { high: 2, medium: 1.5, low: 1 }`; the high cap imports `PIXEL_RATIO_CAP` from `game/effects.ts` (2048 stays the literal high value for the shadow map, matching `KEY_SHADOW_MAP_SIZE`).
- `p95()` no longer copies and sorts the live window per call: a parallel ascending `sortedWindow` is maintained by binary insertion (`lowerBound` + in-place right shift) and one-occurrence removal on eviction; `nearestRank95` index/clamp and every policy constant/threshold are unchanged.
- `quality.test.ts`: exact-object matrix for high/medium/low under both motion modes (new fields added), `Object.keys` pin updated, constant pins, a dedicated GPU-invariance test, a naive-reference equivalence test over 400 pushes (duplicates + eviction), the `Array.prototype.sort` throw-spy over 10,000 pushes, and the pinned AC-12 stream test. The existing `describe('quality policy (AC-52)')` block is unchanged (the diff contains no removed test lines).

Decisions:
- The sorted view uses in-place shift loops rather than `splice`, so a push/eviction allocates no temporary removed-elements array (plan § P95 strategy permits either).
- Duplicate handling: `lowerBound` inserts before equal values; eviction removes one occurrence at `lowerBound(oldest)`. Equal values are indistinguishable, so nearest-rank semantics are preserved.
- Spike verification: the `Array.prototype.sort` spy wraps only the 10,000 pushes plus `getP95FrameMs()`/`getAverageFrameMs()` reads; `sort` is restored in `finally` and the naive reference is computed after restoration.
- High-tier values are preserved exactly: `{ ssao: true, bloom: true, shadowMapSize: 2048, pixelRatioCap: 2 }`.

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
      Tests  1743 passed (1743)
   Duration  3.02s (transform 8.87s, setup 0ms, collect 19.59s, tests 8.92s, environment 5.05s, prepare 4.71s)
```

- Focused run of the changed module, `npx vitest run src/render/quality.test.ts --reporter=verbose` → exit 0, 29 tests; new tests green:
```
 ✓ src/render/quality.test.ts > quality GPU matrix (AC-5) > pins the shadow-map size and DPR-cap constants 0ms
 ✓ src/render/quality.test.ts > quality GPU matrix (AC-5) > exposes the exact GPU fields for every tier with and without reduced motion 0ms
 ✓ src/render/quality.test.ts > sorted-window p95 (AC-11, AC-12) > matches a naive nearest-rank reference across pushes, duplicates and eviction 15ms
 ✓ src/render/quality.test.ts > sorted-window p95 (AC-11, AC-12) > never sorts over 10,000 pushes and keeps the final tier and p95 exact 9ms
 ✓ src/render/quality.test.ts > sorted-window p95 (AC-11, AC-12) > matches the pinned stream: 60×30, 60×10, 60×10 1ms
```

- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds 80 on all four metrics)
```
 Test Files  64 passed (64)
      Tests  1743 passed (1743)
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
All files          |   96.45 |    95.45 |   97.48 |   96.45 |                   
 src/render        |   98.57 |    96.52 |   98.77 |   98.57 |                   
  quality.ts       |   98.31 |    97.43 |     100 |   98.31 | 316-317,400-401   
```
  (The two uncovered spots are pre-existing branches: the empty-window guard inside `evaluate()` — unreachable because `pushFrameTime` only calls it after a push — and the same-tier early return in `setTier`; the module remains far above the 80 gate.)

AC-12 post-block values observed by the pinned test (asserted, not logged):
- 60 × `30`: window `60`, average `30`, p95 `30`, tier `medium`.
- +60 × `10`: window `120`, average `20`, p95 `30`, tier `medium`.
- +60 × `10`: window `120`, average `10`, p95 `10`, tier `low`.
- Tier sequence: `high` pushes 1–59, `medium` 60–159, `low` 160–180.

Acceptance audit:
- AC-5 → met: constants pinned to `{ high: 2048, medium: 1024, low: 0 }` and `{ high: 2, medium: 1.5, low: 1 }`; high cap asserted equal to `PIXEL_RATIO_CAP`; full exact-object matrix for high/medium/low × reduced motion true/false includes `ssao`/`bloom`/`shadowMapSize`/`pixelRatioCap`; the dedicated GPU test pins the same four values for both motion modes; existing CPU counts unchanged and still pinned.
- AC-11 → met: naive nearest-rank equivalence holds after every one of 400 pushes (duplicates + eviction past 120); 10,000 pushes with `Array.prototype.sort` throwing complete and end with window `120`, average `13.875`, p95 `20`, tier `high`; all pre-existing policy tests (thresholds, boundaries, hysteresis, cooldowns, one-tier-per-decision, clamping, min samples, recovery) pass unchanged; constant 30 ms still downgrades on push 60.
- AC-12 → met: test named exactly `'matches the pinned stream: 60×30, 60×10, 60×10'`; asserts the observable table values `60/30/30`, `120/20/30`, `120/10/10` and the exhaustive tier array (59 `high`, 100 `medium`, 21 `low`); no internal streak is asserted.

Deviations from spec: none
