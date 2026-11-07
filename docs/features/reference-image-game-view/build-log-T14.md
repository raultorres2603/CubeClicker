# Build log — T14 — Golden burst tint

Task: T14 (2026-11-07)
Files changed: `src/frontend/src/render/particles.ts`, `src/frontend/src/render/particles.test.ts`
What changed & why:

- Exported `PARTICLE_COLOR = 0xffcc66` and passed it as the `PointsMaterial` `color`, so the additive burst reads gold (spec AC-15, plan § render/particles.ts).
- Documented the gold tint in the module header and the constant's doc comment.
- Added a concrete `particles.test.ts` assertion: `PARTICLE_COLOR === 0xffcc66` and `material.color.getHex() === PARTICLE_COLOR`.
- Nothing else touched: pool cap, fade math, spawn jitter, recycling, draw range, depth/blending and render order are byte-identical (diff is color + comments + one test).

Decisions:

- Material `color` is a multiplier over the per-vertex fade, so the existing linear fade to black is unchanged while every fragment is tinted gold; `vertexColors` stays `true`.
- Integration exception: `particles.ts` is a leaf render adapter whose only boundary is three.js itself (`PointsMaterial.color` is asserted through a real `Points` instance); the scene-level integration lives in `scene.ts`/`scene.test.ts`, which are T11-owned and out of this task's `files_owned`. No integration tier file could be added without an out-of-scope edit.
- Known-red integration files in the shared tree during this run: `App.test.tsx` (T8-owned) and `scene.test.ts` (T11-owned, still pinning the old `0b0b12` palette literal). `cube-view.test.ts` (T13) was green at run time. Their failures are documented below and the rest of the suite is shown green with only those two files excluded.

Evidence:

## `npm run lint` — exit 0

```
> lint
> eslint .
```

## `npm run typecheck` — exit 0

```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

## `npm test --workspace @cubeclicker/frontend` — exit 1 (known-red files only)

Raw summary and failing tests (full log: 348 lines; the omitted lines are the HTML-diff
bodies of the two known-red files):

```
 FAIL  src/App.test.tsx > App > announces a spectate flight with the target member name (AC-17)
 FAIL  src/App.test.tsx > App > announces the return flight with the pinned copy (AC-18)
 FAIL  src/App.test.tsx > App > binds the HUD to the engine snapshot and the server id to the multiplayer store (AC-11, AC-23)
 FAIL  src/App.test.tsx > App > keeps the stats visible without a server line before the first welcome (F7)
 FAIL  src/App.test.tsx > App > renders Return to my cube in the shell exactly while spectating (AC-18)
 FAIL  src/App.test.tsx > App > renders the full intro shell on first paint (default online session, no DOM)
 FAIL  src/App.test.tsx > App > renders the pinned banner copy per transport status (AC-22)
 FAIL  src/App.test.tsx > App > renders the playing phase with an empty live region that is still present
 FAIL  src/App.test.tsx > App > renders the travel phase copy in the same single live region
 FAIL  src/render/scene.test.ts > intent application > exposes the live cube view through the rebuild-aware accessor (AC-16)
 Test Files  2 failed | 51 passed (53)
      Tests  10 failed | 1293 passed (1303)
```

Cause of the `scene.test.ts` failure is the known T11-owned palette literal only:

```
AssertionError: expected '0a2418' to be '0b0b12' // Object.is equality
 ❯ src/render/scene.test.ts:1596:82
```

`App.test.tsx` failures are the T8-owned golden shell markup (new HUD/UserPanel/UpgradesPanel/
CustomizationToggle markup vs. the old expected strings) — outside this task.

### Green rest-of-suite proof (only the two known-red files excluded)

Command: `npx vitest run --exclude "**/App.test.tsx" --exclude "**/render/scene.test.ts"` — exit 0

```
 Test Files  51 passed (51)
      Tests  1203 passed (1203)
```

## `npx vitest run src/render/particles.test.ts` — exit 0

```
 ✓ src/render/particles.test.ts (20 tests) 16ms

 Test Files  1 passed (1)
      Tests  20 passed (20)
```

## `npm run coverage --workspace @cubeclicker/frontend -- --coverage.reportOnFailure` — exit 1 (known-red tests only; no threshold errors)

`--coverage.reportOnFailure` was used so the table prints despite the two known-red files. Raw
table (full log: 411 lines), thresholds ≥ 80 statements/branches/functions/lines:

```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.43 |    94.98 |   96.16 |   95.43 |
...
  particles.ts     |     100 |      100 |     100 |     100 |
...
-------------------|---------|----------|---------|---------|-------------------
```

No `ERROR: Coverage ... does not meet` line appears in the log — the gate passes at
95.43 / 94.98 / 96.16 / 95.43 (statements / branches / functions / lines). `particles.ts`
itself is at 100% on all four metrics.

Acceptance audit: AC-15 → met (`PARTICLE_COLOR` exported with literal `0xffcc66`; the pooled
`PointsMaterial.color.getHex()` is asserted to equal it; all 20 particle tests including fade,
pool cap, recycling, jitter, draw range, depth/blending and render order pass unchanged).

Deviations from spec: none.
