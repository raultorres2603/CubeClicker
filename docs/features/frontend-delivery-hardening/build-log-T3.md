# Build log — T3 — Vite chunking and bundle-budget gate

Task: T3 (2026-11-12)
Files changed:
- `src/frontend/vite.config.ts` (edit: `build.manifest`, `chunkSizeWarningLimit: 900`, `manualChunks` for `three`/`react`)
- `src/frontend/src/build/vite-config.test.ts` (new)
- `src/frontend/scripts/check-bundle-budget.mjs` (new)
- `src/frontend/scripts/check-bundle-budget.d.mts` (new)
- `src/frontend/src/build/bundle-budget.test.ts` (new)
- `src/frontend/package.json` (edit: `build` = `vite build && node scripts/check-bundle-budget.mjs`)
- `docs/features/frontend-delivery-hardening/build-log-T3.md` (this file)

**Status: COMPLETE (r3 budget revision)** — the initial run below was BLOCKED: the fresh build exceeded the then-pinned `threeGzipBytes` ceiling (**154,323 B > 140,000 B**). That run is kept as history in § Blocked report. The user-approved r3 spec revision raised only the Three.js ceiling to **165,000 B** (initial 150,000 and total 300,000 unchanged); the T3 fix-up was applied to `BUDGETS`, the `.d.mts` literal, and the test fixtures/messages, and the full verify now passes with **95,903 / 154,323 / 273,854 B**. The passing rerun evidence is in § r3 rerun — approved 165,000 B ceiling (passing), appended after the historical blocked run.

What changed & why:
- `vite.config.ts` now emits `dist/.vite/manifest.json` (`manifest: true`), raises the chunk warning to 900 kB, and pins two function-form `manualChunks`: `'three'` for `/node_modules/three/`, `'react'` for `/node_modules/react/`, `/node_modules/react-dom/`, and `/node_modules/scheduler/`, `undefined` otherwise. Path separators are normalized (`\\` → `/`) before the `node_modules` match.
- `scripts/check-bundle-budget.mjs` resolves `dist` from its own file URL (`new URL('../dist', import.meta.url)`), reads `dist/.vite/manifest.json`, builds the initial closure from the entry's recursive static `imports` (never `dynamicImports`), measures every manifest JS file with `zlib.gzipSync(buffer, { level: 6 })`, writes the plan-schema `dist/bundle-report.json`, prints the chunk table, and exits 1 with concrete violations. Pure helpers (`initialClosure`, `buildReport`, `evaluateReport`, `formatReport`, `findEntryKey`) and `BUDGETS` are exported; Node built-ins use `node:` specifiers so the frontend ESLint browser-globals block does not flag `process`.
- `scripts/check-bundle-budget.d.mts` declares the manifest/report/helper contract for the TypeScript test.
- The two new suites pin the config (`manifest`, warning limit, each `manualChunks` result including Windows separators and look-alike packages) and the budget logic (synthetic post-split manifest with an entry → react static import and a dynamic game runtime → three; initial-closure exclusion of three, report classification, exact `formatReport` text, and all five violations: initial over, three over, total over, missing three, three-in-initial).
- `package.json` chains the gate after `vite build`, so root `npm run build`, CI's Build step, and the frontend Docker build stage inherit the exit code without workflow/Dockerfile edits.

Decisions:
- `three` detection is by the manifest chunk's `name === 'three'` (A-2); the real manifest emits exactly `_three-<hash>.js` with `"name": "three"`.
- `three.initial` is computed from `initial.files` rather than hard-coded `false`: on a passing build it is exactly `false` (pinned by the unit test and the AC-9 smoke), and on the three-in-initial violation the report tells the truth instead of contradicting its own `initial.files`. The `.d.mts` documents this.
- Violations are evaluated with strict `>` (a value exactly at a ceiling passes), so the total-over test uses `initial = 150000`, `three = 140000`, runtime `10001` to hit `total = 300001` with both individual ceilings exactly met.
- The report is written before evaluation, so a failing build still leaves the measured `dist/bundle-report.json` for inspection.
- Script/config coverage is test-level (AC-10): `scripts/check-bundle-budget.mjs` and `vite.config.ts` sit outside the frontend `src` coverage include; no exclusion and no threshold change was added.

Evidence:

- `npm run lint` → exit 0
```
> lint
> eslint .

LINT_EXIT=0
```

- `npm run typecheck` → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

- `npx vitest run src/build/vite-config.test.ts src/build/bundle-budget.test.ts --reporter=verbose` (from `src/frontend`) → exit 0
```
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > pins the approved gzip ceilings 1ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > finds the HTML entry, falls back to isEntry, and rejects a missing entry 1ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > builds the initial closure from static imports only 0ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > classifies the entry, initial closure, three vendor, and total 0ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > passes when every ceiling holds and three is lazy 1ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > reports an initial-closure gzip overrun with the measured bytes 0ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > reports a three-chunk gzip overrun 1ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > reports a total gzip overrun while both individual ceilings hold 0ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > reports a missing three chunk 1ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > reports three in the initial closure even when every ceiling holds 0ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > formats every chunk and the totals for the build log 0ms
 ✓ src/build/vite-config.test.ts > vite build configuration > emits the manifest the bundle-budget gate reads 1ms
 ✓ src/build/vite-config.test.ts > vite build configuration > pins the post-split chunk warning limit 0ms
 ✓ src/build/vite-config.test.ts > vite build configuration > splits the Three.js vendor packages into a named three chunk 0ms
 ✓ src/build/vite-config.test.ts > vite build configuration > splits react, react-dom, and scheduler into a named react chunk 0ms
 ✓ src/build/vite-config.test.ts > vite build configuration > leaves app code and look-alike packages in their default chunks 0ms

 Test Files  2 passed (2)
      Tests  16 passed (16)
```

- `npm run test --workspace @cubeclicker/frontend` → exit 0 (jsdom WebGL "not implemented" stderr lines are the pre-existing `SpaceshipPreview` no-WebGL fallback noise)
```
 ✓ src/App.test.tsx (41 tests) 983ms

 Test Files  68 passed (68)
      Tests  1807 passed (1807)
```

- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds 80 on statements/branches/functions/lines per workspace; no exclusion or threshold change)
```
 Test Files  68 passed (68)
      Tests  1807 passed (1807)
All files          |   96.42 |     96.1 |   97.53 |   96.42 |
```

- `npm run build` → **exit 1** (the `three` ceiling; initial and total pass)
```
> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
transforming...
✓ 104 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.49 kB │ gzip:   0.30 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-CWGWNrMl.css                        26.36 kB │ gzip:   5.32 kB
dist/assets/cursor-ship-fi2YCtK6.js                    6.73 kB │ gzip:   2.21 kB
dist/assets/SpaceshipCustomizationPanel-PD8H8p33.js    9.54 kB │ gzip:   3.34 kB
dist/assets/browser-env-CX-sYLqK.js                   48.95 kB │ gzip:  18.08 kB
dist/assets/index-Cu7lmcVH.js                         87.06 kB │ gzip:  26.95 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-4rmoIDEa.js                        609.34 kB │ gzip: 154.32 kB
✓ built in 1.43s
entry index assets/index-Cu7lmcVH.js raw=87059 gzip=26947
initial files=2 raw=308758 gzip=95903 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=140000
total files=6 raw=983312 gzip=273854 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-PD8H8p33.js raw=9537 gzip=3337 initial=false
chunk browser-env assets/browser-env-CX-sYLqK.js raw=48951 gzip=18081 initial=false
chunk cursor-ship assets/cursor-ship-fi2YCtK6.js raw=6729 gzip=2210 initial=false
chunk index assets/index-Cu7lmcVH.js raw=87059 gzip=26947 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-4rmoIDEa.js raw=609337 gzip=154323 initial=false

Bundle budget violations:
- three chunk gzip 154323 B exceeds the 140000 B budget
npm error Lifecycle script `build` failed with error:
npm error code 1
npm error path /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
npm error workspace @cubeclicker/frontend
npm error location /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
npm error command failed
npm error command sh -c vite build && node scripts/check-bundle-budget.mjs
BUILD_EXIT=1
```

- Root `npm run build` → **exit 1** (the workspace chain inherits the gate's exit code, so CI's Build step and the Docker build stage fail the same way)
```
$ npm run build
... (backend build succeeds)
> build
> vite build && node scripts/check-bundle-budget.mjs
...
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=140000
total files=6 raw=983312 gzip=273854 budget=300000
...
Bundle budget violations:
- three chunk gzip 154323 B exceeds the 140000 B budget
npm error Lifecycle script `build` failed with error:
npm error code 1
npm error path /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
npm error workspace @cubeclicker/frontend
npm error command failed
npm error command sh -c vite build && node scripts/check-bundle-budget.mjs
ROOT_BUILD_EXIT=1
```

- `cat src/frontend/dist/bundle-report.json` → written before the gate evaluation (values in the failing build)
```json
{
  "version": 1,
  "budgets": {
    "initialGzipBytes": 150000,
    "threeGzipBytes": 140000,
    "totalGzipBytes": 300000
  },
  "entry": {
    "name": "index",
    "file": "assets/index-Cu7lmcVH.js",
    "gzipBytes": 26947,
    "rawBytes": 87059
  },
  "initial": {
    "files": [
      "assets/index-Cu7lmcVH.js",
      "assets/react-BYqCGoBQ.js"
    ],
    "gzipBytes": 95903,
    "rawBytes": 308758
  },
  "three": {
    "file": "assets/three-4rmoIDEa.js",
    "name": "three",
    "initial": false,
    "gzipBytes": 154323,
    "rawBytes": 609337
  },
  "total": {
    "files": [
      "assets/cursor-ship-fi2YCtK6.js",
      "assets/react-BYqCGoBQ.js",
      "assets/three-4rmoIDEa.js",
      "assets/index-Cu7lmcVH.js",
      "assets/browser-env-CX-sYLqK.js",
      "assets/SpaceshipCustomizationPanel-PD8H8p33.js"
    ],
    "gzipBytes": 273854,
    "rawBytes": 983312
  },
  "chunks": [
    {
      "name": "SpaceshipCustomizationPanel",
      "file": "assets/SpaceshipCustomizationPanel-PD8H8p33.js",
      "initial": false,
      "gzipBytes": 3337,
      "rawBytes": 9537
    },
    {
      "name": "browser-env",
      "file": "assets/browser-env-CX-sYLqK.js",
      "initial": false,
      "gzipBytes": 18081,
      "rawBytes": 48951
    },
    {
      "name": "cursor-ship",
      "file": "assets/cursor-ship-fi2YCtK6.js",
      "initial": false,
      "gzipBytes": 2210,
      "rawBytes": 6729
    },
    {
      "name": "index",
      "file": "assets/index-Cu7lmcVH.js",
      "initial": true,
      "gzipBytes": 26947,
      "rawBytes": 87059
    },
    {
      "name": "react",
      "file": "assets/react-BYqCGoBQ.js",
      "initial": true,
      "gzipBytes": 68956,
      "rawBytes": 221699
    },
    {
      "name": "three",
      "file": "assets/three-4rmoIDEa.js",
      "initial": false,
      "gzipBytes": 154323,
      "rawBytes": 609337
    }
  ]
}
```

- `! grep -qE 'rel="(modulepreload|preload)"[^>]*href="[^"]*three-' src/frontend/dist/index.html` → exit 0 (no shell preload of the Three vendor chunk). Tolerant attribute-order check (review F7) confirms only the React preload and the stylesheet:
```
$ node -e "... collect <link> tags, filter /three-/ ..."
links: ["<link rel=\"modulepreload\" crossorigin href=\"/assets/react-BYqCGoBQ.js\">","<link rel=\"stylesheet\" crossorigin href=\"/assets/index-CWGWNrMl.css\">"]
three links: []
TOLERANT_EXIT=0
```
  The emitted shell's only script is `/assets/index-Cu7lmcVH.js`; the manifest's entry `dynamicImports` are `src/browser-env.ts` and `src/ui/SpaceshipCustomizationPanel.tsx`, so the game runtime and preview load only after the gate closes / the panel opens.

- Fresh values recorded (AC-6):
  - `entry.file` = `assets/index-Cu7lmcVH.js` (raw 87,059 B / gzip 26,947 B)
  - `initial.files` = `["assets/index-Cu7lmcVH.js", "assets/react-BYqCGoBQ.js"]`
  - `initial.gzipBytes` = **95,903 B** (budget 150,000; pass)
  - `three.file` = `assets/three-4rmoIDEa.js`
  - `three.gzipBytes` = **154,323 B** (budget 140,000; **FAIL, over by 14,323 B**)
  - `total.gzipBytes` = **273,854 B** (budget 300,000; pass)

## Root cause of the `three` ceiling miss

The 140,000 B ceiling was derived from the audit's "Three.js 662,772 bytes raw / 131,382 bytes gzip". That is the **unminified** `node_modules/three/build/three.module.js` file measured standalone, not a production chunk:

```
$ node -e "raw + zlib.gzipSync(level 6) for the three build file and the chunk"
src/frontend/dist/assets/three-4rmoIDEa.js raw=609337 gzip6=154323
node_modules/three/build/three.module.js      raw=662772 gzip6=131517
node_modules/three/build/three.core.js        raw=1458113 gzip6=287966
```

`662,772 raw / 131,517 B gzip` reproduces the audit's `662,772 / 131,382` (≈135 B zlib/version difference), so the ceiling compares a gzip-friendly **unminified** source file against a **minified** Rollup chunk. Minification strips the repeated whitespace, newlines, and long identifiers that gzip exploits, so the minified Three chunk compresses to a *larger* gzip size despite a smaller raw size (609,337 B vs 662,772 B): 154,323 B vs 131,517 B. Raw and gzip do not move together here.

Alternative split compositions do not close the gap either (measured with the same pinned level-6 gate):

- `manualChunks` restricted to `/node_modules/three/build/` (moving `three/examples/jsm` addons into the dynamic app chunk): `three` = **572,727 B raw / 145,319 B gzip**, still over 140,000; the `browser-env` chunk grows from 48,951 B to 86,154 B raw.
- `build.target: 'esnext'`: `three` = **609,270 B raw / 154,276 B gzip**, a 47 B saving.

No in-scope minifier/target/split tweak closes a 14,323 B (10.2%) gap while keeping the pinned `manualChunks` rule, the pinned level-6 measurement, and the high-tier Three visuals. Raising the ceiling or changing the pinned chunk/measurement contract requires a spec revision.

Test-level coverage note (AC-10): `src/frontend/scripts/check-bundle-budget.mjs` and `src/frontend/vite.config.ts` are outside the frontend `src` coverage include. They are covered at test level by `src/build/bundle-budget.test.ts` (16 tests: helper contract, classification, every violation, formatting) and `src/build/vite-config.test.ts` (5 tests: manifest/warning limit/manualChunks). No coverage exclusion was added and no threshold was changed; `npm run coverage --workspace @cubeclicker/frontend` stays at 96.42 / 96.1 / 97.53 / 96.42.

Acceptance audit:
- AC-1 → met: the fresh `bundle-report.json` has `initial.files = [index, react]` with no `three` file; the manifest entry (`index.html`) has only `_react-…` in static `imports` and `browser-env`/`SpaceshipCustomizationPanel` in `dynamicImports`; `dist/index.html` has no `modulepreload`/`preload` link containing `three-` (both the pinned grep and the attribute-order-tolerant check); `bundle-budget.test.ts` pins the initial-closure exclusion.
- AC-5 → **unmet at the pinned ceiling**: the gate is implemented and wired into `package.json`, writes the report, and exits 1 with concrete violations (unit-tested for all five conditions), but the fresh build exits 1 on `three.gzipBytes = 154,323 > 140,000`. The build cannot be green without a spec revision.
- AC-6 → met: the fresh `npm run build` output and the authoritative `initial`/`three`/`total` values are recorded above; the builder stopped and did not raise the ceiling.
- AC-10 (T3 portion) → met: all four verify suites are green except the budget-gate build result itself; coverage is 96.42 / 96.1 / 97.53 / 96.42 with no exclusion/threshold change; the script/config are test-level covered.

Deviations from spec: none in the implementation. The task is blocked on the approved Q-1 `threeGzipBytes` ceiling vs. the fresh measurement.

## Blocked report

**Question:** How should T3 proceed given the fresh post-split measurement `three.gzipBytes = 154,323 B` exceeds the approved 140,000 B ceiling?

Measured (fresh, reproducible): initial 95,903 / 150,000 (pass); three 154,323 / 140,000 (**fail, +14,323 B**); total 273,854 / 300,000 (pass). The audit's 131,382 B was the unminified `three.module.js` file, not a minified chunk; no in-scope build change closes the gap.

Candidate answers:
1. **Raise `threeGzipBytes` via a spec revision** (recommended: 165,000 B, ≈6.9% headroom over 154,323 B; keep initial 150,000 and total 300,000). Then update `BUDGETS`, the `.d.mts` literal, the `bundle-budget.test.ts` budget literal/expected messages, and the planner artifacts; re-run T3 verify and commit.
2. **Rebalance the approved ceilings** to keep total 300,000 (e.g., initial 120,000 / three 165,000 / total 300,000; fresh initial 95,903 retains ≈25 KB headroom). Same code/doc edits as option 1.
3. **Redefine the `three` chunk to core-only** (`three/build/` only, addons in the dynamic app chunk): measured 145,319 B gzip — still over 140,000, so it only helps in combination with a ceiling near 150,000, changes the pinned `manualChunks` rule/plan decision 3, and weakens the single-vendor-chunk caching rationale. Not recommended.

No option keeps 140,000 B with the pinned graph, pinned measurement, and high-tier visuals; option 1 is the minimal revision.

**Commit:** none. Committing the T3 change as-is would leave `npm run build` (and therefore CI's Build step and the Docker build stage) red on `main` until the ceiling is revised. The implementation is left in the working tree for the revised run:

```
 M src/frontend/package.json
 M src/frontend/vite.config.ts
?? src/frontend/scripts/
?? src/frontend/src/build/
?? docs/features/frontend-delivery-hardening/build-log-T3.md
```

No out-of-scope edits: `session.ts`, `GameCanvas.tsx`, `App.tsx`, nginx, compose, root `package.json`/lockfile, and docs outside this feature directory are untouched.

---

## r3 rerun — approved 165,000 B ceiling (passing)

After the user-approved r3 revision (three gzip ceiling 140,000 → **165,000 B**; initial 150,000 and total 300,000 unchanged), the fix-up specified in `tasks.md:44` was applied and the full T3 verify was re-run:

- `src/frontend/scripts/check-bundle-budget.mjs` — `BUDGETS.threeGzipBytes = 165000`.
- `src/frontend/scripts/check-bundle-budget.d.mts` — `readonly threeGzipBytes: 165000`.
- `src/frontend/src/build/bundle-budget.test.ts` — `BUDGET_VALUES` three value 165000; the three-over fixture/message is now 165001 / 165000; the old total-over fixture (initial 150000, three 140000, runtime 10001) was replaced with initial 100000 (entry 400 + react 99,600), three 165000, runtime 35,001 → **total 300001** with both individual ceilings exactly met; the `formatReport` expectation is `budget=165000`. `grep -rn "140000\|140001" src/frontend/scripts src/frontend/src/build src/frontend/vite.config.ts src/frontend/package.json` → no match (140,000 now appears only as historical context in this log and the planner artifacts).

The blocked first run above is preserved as history. The rerun evidence:

- `npx vitest run src/build/vite-config.test.ts src/build/bundle-budget.test.ts --reporter=verbose` (from `src/frontend`) → exit 0
```
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > pins the approved gzip ceilings 2ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > finds the HTML entry, falls back to isEntry, and rejects a missing entry 1ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > builds the initial closure from static imports only 0ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > classifies the entry, initial closure, three vendor, and total 1ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > passes when every ceiling holds and three is lazy 0ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > reports an initial-closure gzip overrun with the measured bytes 0ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > reports a three-chunk gzip overrun 0ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > reports a total gzip overrun while both individual ceilings hold 0ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > reports a missing three chunk 1ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > reports three in the initial closure even when every ceiling holds 0ms
 ✓ src/build/bundle-budget.test.ts > bundle-budget helpers > formats every chunk and the totals for the build log 0ms
 ✓ src/build/vite-config.test.ts > vite build configuration > emits the manifest the bundle-budget gate reads 1ms
 ✓ src/build/vite-config.test.ts > vite build configuration > pins the post-split chunk warning limit 0ms
 ✓ src/build/vite-config.test.ts > vite build configuration > splits the Three.js vendor packages into a named three chunk 0ms
 ✓ src/build/vite-config.test.ts > vite build configuration > splits react, react-dom, and scheduler into a named react chunk 0ms
 ✓ src/build/vite-config.test.ts > vite build configuration > leaves app code and look-alike packages in their default chunks 0ms

 Test Files  2 passed (2)
      Tests  16 passed (16)
```

- `npm run lint` → exit 0
```
> lint
> eslint .

LINT_EXIT=0
```

- `npm run typecheck` → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

- `npm run test --workspace @cubeclicker/frontend` → exit 0 (jsdom WebGL "not implemented" stderr lines are the pre-existing `SpaceshipPreview` no-WebGL fallback noise)
```
 ✓ src/App.test.tsx (41 tests) 974ms

 Test Files  68 passed (68)
      Tests  1807 passed (1807)
TEST_EXIT=0
```

- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds 80 on statements/branches/functions/lines; no exclusion or threshold change)
```
 Test Files  68 passed (68)
      Tests  1807 passed (1807)
All files          |   96.42 |     96.1 |   97.53 |   96.42 |
COVERAGE_EXIT=0
```

- `npm run build` (root, so the workspace chain and the root exit code are proven) → **exit 0**
```
> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
transforming...
✓ 104 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.49 kB │ gzip:   0.30 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-CWGWNrMl.css                        26.36 kB │ gzip:   5.32 kB
dist/assets/cursor-ship-fi2YCtK6.js                    6.73 kB │ gzip:   2.21 kB
dist/assets/SpaceshipCustomizationPanel-PD8H8p33.js    9.54 kB │ gzip:   3.34 kB
dist/assets/browser-env-CX-sYLqK.js                   48.95 kB │ gzip:  18.08 kB
dist/assets/index-Cu7lmcVH.js                         87.06 kB │ gzip:  26.95 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-4rmoIDEa.js                        609.34 kB │ gzip: 154.32 kB
✓ built in 1.43s
entry index assets/index-Cu7lmcVH.js raw=87059 gzip=26947
initial files=2 raw=308758 gzip=95903 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=165000
total files=6 raw=983312 gzip=273854 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-PD8H8p33.js raw=9537 gzip=3337 initial=false
chunk browser-env assets/browser-env-CX-sYLqK.js raw=48951 gzip=18081 initial=false
chunk cursor-ship assets/cursor-ship-fi2YCtK6.js raw=6729 gzip=2210 initial=false
chunk index assets/index-Cu7lmcVH.js raw=87059 gzip=26947 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-4rmoIDEa.js raw=609337 gzip=154323 initial=false

Bundle budget OK.
ROOT_BUILD_EXIT=0
```

- `cat src/frontend/dist/bundle-report.json` → fresh passing report
```json
{
  "version": 1,
  "budgets": {
    "initialGzipBytes": 150000,
    "threeGzipBytes": 165000,
    "totalGzipBytes": 300000
  },
  "entry": {
    "name": "index",
    "file": "assets/index-Cu7lmcVH.js",
    "gzipBytes": 26947,
    "rawBytes": 87059
  },
  "initial": {
    "files": [
      "assets/index-Cu7lmcVH.js",
      "assets/react-BYqCGoBQ.js"
    ],
    "gzipBytes": 95903,
    "rawBytes": 308758
  },
  "three": {
    "file": "assets/three-4rmoIDEa.js",
    "name": "three",
    "initial": false,
    "gzipBytes": 154323,
    "rawBytes": 609337
  },
  "total": {
    "files": [
      "assets/cursor-ship-fi2YCtK6.js",
      "assets/react-BYqCGoBQ.js",
      "assets/three-4rmoIDEa.js",
      "assets/index-Cu7lmcVH.js",
      "assets/browser-env-CX-sYLqK.js",
      "assets/SpaceshipCustomizationPanel-PD8H8p33.js"
    ],
    "gzipBytes": 273854,
    "rawBytes": 983312
  },
  "chunks": [
    {
      "name": "SpaceshipCustomizationPanel",
      "file": "assets/SpaceshipCustomizationPanel-PD8H8p33.js",
      "initial": false,
      "gzipBytes": 3337,
      "rawBytes": 9537
    },
    {
      "name": "browser-env",
      "file": "assets/browser-env-CX-sYLqK.js",
      "initial": false,
      "gzipBytes": 18081,
      "rawBytes": 48951
    },
    {
      "name": "cursor-ship",
      "file": "assets/cursor-ship-fi2YCtK6.js",
      "initial": false,
      "gzipBytes": 2210,
      "rawBytes": 6729
    },
    {
      "name": "index",
      "file": "assets/index-Cu7lmcVH.js",
      "initial": true,
      "gzipBytes": 26947,
      "rawBytes": 87059
    },
    {
      "name": "react",
      "file": "assets/react-BYqCGoBQ.js",
      "initial": true,
      "gzipBytes": 68956,
      "rawBytes": 221699
    },
    {
      "name": "three",
      "file": "assets/three-4rmoIDEa.js",
      "initial": false,
      "gzipBytes": 154323,
      "rawBytes": 609337
    }
  ]
}
```

- `! grep -qE 'rel="(modulepreload|preload)"[^>]*href="[^"]*three-' src/frontend/dist/index.html` → exit 0; tolerant attribute-order check confirms only the React preload and the stylesheet:
```
links: ["<link rel=\"modulepreload\" crossorigin href=\"/assets/react-BYqCGoBQ.js\">","<link rel=\"stylesheet\" crossorigin href=\"/assets/index-CWGWNrMl.css\">"]
three links: []
TOLERANT_EXIT=0
GREP_EXIT=0
```
  The shell's only script is `/assets/index-Cu7lmcVH.js`; the Three chunk is not preloaded.

### Final acceptance audit (r3)

- AC-1 → **met**: fresh `bundle-report.json` has `initial.files = ["assets/index-Cu7lmcVH.js", "assets/react-BYqCGoBQ.js"]` with no `three` file; the manifest entry's static `imports` are only the React vendor, with `browser-env`/`SpaceshipCustomizationPanel` in `dynamicImports`; `dist/index.html` has no `modulepreload`/`preload` link containing `three-`; `bundle-budget.test.ts` pins the initial-closure exclusion.
- AC-5 → **met**: `src/frontend/package.json` runs `vite build && node scripts/check-bundle-budget.mjs`; the gate writes the report, prints every chunk/total, and exits 0 on the fresh build; the unit suite pins all five violations. The root `npm run build` exits 0, so CI's Build step and the Docker build stage inherit a passing gate.
- AC-6 → **met**: the fresh values are recorded above — initial **95,903 B** ≤ 150,000; three **154,323 B** ≤ 165,000; total **273,854 B** ≤ 300,000. Only the user-approved three ceiling changed; initial and total are unchanged.
- AC-10 (T3 portion) → **met**: all four verify suites are green; `npm run coverage --workspace @cubeclicker/frontend` is 96.42 / 96.1 / 97.53 / 96.42 with no exclusion or threshold change; the script/config remain test-level covered (16 tests across the two new suites).

Deviations from spec: none. The only budget change is the user-approved r3 `threeGzipBytes` 140,000 → 165,000 B.

**Commit:** the T3 implementation and this log are committed together with `perf: split three.js bundle and enforce gzip budget` (no push).

