# Build log — T3 — Verify & integrate (final verification gate)

Task: T3 (`cube-world-transition`, 2026-10-21)
Status: **completed** — every gate command exits 0, both workspaces clear the coverage bar on all four
metrics, the feature diff is confined to the plan's file inventory, no banned matcher is present in any
changed test file, and `game/**` is `Math.random`-free and DOM-free. AC-1…AC-5 are **met** (table below).
The manual visual pass was **not executed — environment** (no browser binary in this environment; the
spec explicitly rules out browser automation), recorded step by step as required.

Files changed: `docs/features/cube-world-transition/build-log-T3.md` **only**. No source, test, config,
container, accepted-feature or `.env*` file was touched by this task.

Exact refs used for the integrity comparison:

```
$ git rev-parse 814f6f5^
90f407a721c8720e830b843ab0dbad53eeada4d4
$ git log --oneline -1 814f6f5^
90f407a docs: record T4 verification pass for cube-visual-polish-followup (T4)
$ git rev-parse --short=7 HEAD
757a0c5
$ git log --oneline 814f6f5^..HEAD
757a0c5 feat: build the cube surface from flush mini-cubes and fly directionally to the next cube (T2)
c7031aa docs: record the blocked T2 run (spec § 3 pose table contradicts the travel formula)
814f6f5 feat: add random mini-cube counts, travel direction and the snapshot contract (T1)
```

Baseline = **`90f407a`** (the parent of T1 `814f6f5`; `c7031aa` between T1 and T2 is the docs-only
`build-log-T2.md` block record and changes no code).

Environment: Linux, repository root `/var/home/raultorraco/Documents/Projects/CubeClicker`, branch
`main`, local stack running (`podman compose ps` → `cubeclicker-frontend-1` up on
`127.0.0.1:5173`, `cubeclicker-backend-1` up on `127.0.0.1:8080`). All commands below were run on
2026-10-21.

---

## 1. Gate results (summary)

| Gate | Command | Exit | Result |
| --- | --- | --- | --- |
| Install | `npm ci` | 0 | 333 packages, lockfile clean |
| Lint | `npm run lint` | 0 | clean |
| Typecheck | `npm run typecheck` | 0 | both workspaces, `tsc --noEmit` clean |
| Tests | `npm test` | 0 | backend 4/4, frontend 328/328 (20 files) |
| Coverage | `npm run coverage` | 0 | backend 100/100/100/100; frontend 99.33 / 99.4 / 100 / 99.33 (all ≥ 80) |
| Build | `npm run build` | 0 | initial JS `771.97 kB` → gzip **209.65 kB** ≤ 350 KB budget |
| Smoke (optional) | `npm run smoke` | 0 | `SMOKE PASS (4/4 checks)` |

## 2. Raw transcripts

### 2.1 `npm ci` → 0

```
$ npm ci
npm warn deprecated glob@10.5.0: Old versions of glob are not supported ...
npm warn deprecated eslint@9.39.5: This version is no longer supported ...
added 333 packages, and audited 336 packages in 2s
92 packages are looking for funding
4 vulnerabilities (2 moderate, 2 critical)
npm warn install-scripts   esbuild@0.28.2 (postinstall: node install.js)
NPM_CI_EXIT=0
```

(The 4 advisories are the pre-existing Vitest/esbuild dev-tooling ones recorded by the accepted feature;
no dependency changed in this feature — see § 3.4.)

### 2.2 `npm run lint` → 0 and `npm run typecheck` → 0

```
$ npm run lint
> lint
> eslint .
LINT_EXIT=0

$ npm run typecheck
> typecheck
> npm run typecheck --workspaces --if-present
> typecheck  (backend)
> tsc --noEmit
> typecheck  (frontend)
> tsc --noEmit
TYPECHECK_EXIT=0
```

### 2.3 `npm test` → 0 (both workspaces; every changed test file listed)

```
$ npm test
> test
> npm run test --workspaces --if-present

> test  (backend)
 RUN  v3.2.7 .../src/backend
 ✓ src/app.test.ts (4 tests) 94ms
 Test Files  1 passed (1)
      Tests  4 passed (4)
TEST backend → 0

> test  (frontend)
 RUN  v3.2.7 .../src/frontend
 ✓ src/render/webgl.test.ts (5 tests) 7ms
 ✓ src/ui/theme.test.ts (2 tests) 4ms
 ✓ src/game/effects.test.ts (28 tests) 13ms
 ✓ src/game/progression.test.ts (10 tests) 9ms
 ✓ src/game/rotation.test.ts (15 tests) 8ms
 ✓ src/ws/connection.test.ts (10 tests) 19ms
 ✓ src/browser-env.test.ts (6 tests) 19ms
 ✓ src/game/board.test.ts (18 tests) 31ms
 ✓ src/input/keyboard.test.ts (8 tests) 7ms
 ✓ src/game/engine.test.ts (45 tests) 25ms
 ✓ src/render/particles.test.ts (19 tests) 13ms
 ✓ src/input/gestures.test.ts (21 tests) 5ms
 ✓ src/ui/Hud.test.tsx (3 tests) 9ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 9ms
 ✓ src/render/picking.test.ts (11 tests) 29ms
 ✓ src/render/cube-view.test.ts (32 tests) 56ms
 ✓ src/render/starfield.test.ts (15 tests) 77ms
 ✓ src/App.test.tsx (4 tests) 13ms
 ✓ src/game/session.test.ts (23 tests) 73ms
 ✓ src/render/scene.test.ts (51 tests) 91ms
 Test Files  20 passed (20)
      Tests  328 passed (328)
TEST_EXIT=0
```

Changed test files and their pass counts in this run (`git diff --name-only 90f407a..HEAD -- '*.test.ts' '*.test.tsx'`):

| Changed test file | Tests in the final run |
| --- | --- |
| `src/frontend/src/App.test.tsx` (T1 fixture only) | 4 |
| `src/frontend/src/game/board.test.ts` (T1) | 18 |
| `src/frontend/src/game/engine.test.ts` (T1) | 45 |
| `src/frontend/src/game/session.test.ts` (T1 + T2 one-line re-pin) | 23 |
| `src/frontend/src/render/cube-view.test.ts` (T2) | 32 |
| `src/frontend/src/render/picking.test.ts` (T2) | 11 |
| `src/frontend/src/render/scene.test.ts` (T2) | 51 |

Every other frontend test file is unchanged from the baseline (§ 4.2) and passes in the same run
(`webgl`, `theme`, `effects`, `progression`, `rotation`, `connection`, `browser-env`, `keyboard`,
`particles`, `gestures`, `Hud`, `GameCanvas`, `starfield`).

### 2.4 `npm run coverage` → 0 (full per-workspace numbers)

```
$ npm run coverage
> coverage
> npm run coverage --workspaces --if-present

> coverage  (backend)
 % Coverage report from v8
----------|---------|----------|---------|---------|
File      | % Stmts | % Branch | % Funcs | % Lines |
----------|---------|----------|---------|---------|
All files |     100 |      100 |     100 |     100 |
 app.ts   |     100 |      100 |     100 |     100 |
----------|---------|----------|---------|---------|
 Test Files  1 passed (1)
      Tests  4 passed (4)

> coverage  (frontend)
 % Coverage report from v8
-----------------|---------|----------|---------|---------|
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.33 |     99.4 |     100 |   99.33 |
 src             |     100 |      100 |     100 |     100 |
  App.tsx        |     100 |      100 |     100 |     100 |
  browser-env.ts |     100 |      100 |     100 |     100 |
 src/game        |     100 |     99.6 |     100 |     100 |
  board.ts       |     100 |      100 |     100 |     100 |
  effects.ts     |     100 |      100 |     100 |     100 |
  engine.ts      |     100 |      100 |     100 |     100 |
  progression.ts |     100 |      100 |     100 |     100 |
  rotation.ts    |     100 |      100 |     100 |     100 |
  session.ts     |     100 |    98.18 |     100 |     100 | 173
  types.ts       |     100 |      100 |     100 |     100 |
 src/input       |     100 |      100 |     100 |     100 |
  gestures.ts    |     100 |      100 |     100 |     100 |
  keyboard.ts    |     100 |      100 |     100 |     100 |
 src/render      |     100 |      100 |     100 |     100 |
  cube-view.ts   |     100 |      100 |     100 |     100 |
  particles.ts   |     100 |      100 |     100 |     100 |
  picking.ts     |     100 |      100 |     100 |     100 |
  scene.ts       |     100 |      100 |     100 |     100 |
  starfield.ts   |     100 |      100 |     100 |     100 |
  webgl.ts       |     100 |      100 |     100 |     100 |
 src/ui          |   79.48 |      100 |     100 |   79.48 |
  GameCanvas.tsx |    61.9 |      100 |     100 |    61.9 | 23-30
  Hud.tsx        |     100 |      100 |     100 |     100 |
  theme.ts       |     100 |      100 |     100 |     100 |
 src/ws          |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts  |   95.34 |    92.59 |     100 |   95.34 | 53-54,99-100
-----------------|---------|----------|---------|---------|
 Test Files  20 passed (20)
      Tests  328 passed (328)
COVERAGE_EXIT=0
```

Per-workspace four-metric record:

| Workspace | Statements | Branches | Functions | Lines | ≥ 80 × 4 |
| --- | --- | --- | --- | --- | --- |
| `@cubeclicker/backend` | 100 | 100 | 100 | 100 | yes |
| `@cubeclicker/frontend` | 99.33 | 99.4 | 100 | 99.33 | yes |

No exclusion and no threshold was changed in this feature (`git diff 90f407a..HEAD -- '*vitest.config*'
'*package.json'` is empty, § 3.4). The two render modules this feature rewrote are at 100 % on all four
metrics; the only uncovered lines are the accepted residuals listed in § 8.

### 2.5 `npm run build` → 0 (sizes, gzip budget)

```
$ npm run build
> build --workspaces --if-present
> build  (backend)  → tsc
> build  (frontend) → vite build

vite v7.3.7 building client environment for production...
✓ 49 modules transformed.
dist/index.html                   0.40 kB │ gzip:   0.27 kB
dist/assets/index-BaygJ9fo.css    1.32 kB │ gzip:   0.63 kB
dist/assets/index-CEYSBeM7.js   771.97 kB │ gzip: 209.65 kB
(!) Some chunks are larger than 500 kB after minification. [advisory only]
✓ built in 1.31s
BUILD_EXIT=0
```

Initial JS gzip = **209.65 kB ≤ `BUNDLE_BUDGET_GZ_KB` 350** (accepted cube-game-frontend AC-20 budget,
unchanged). The chunk-size advisory is the retained pre-existing one (Vite's 500 kB *uncompressed*
warning; the gzip budget is met).

### 2.6 `npm run smoke` (optional) → 0

```
$ npm run smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke
 Container cubeclicker-backend-1 Running
 Container cubeclicker-frontend-1 Running
 Container cubeclicker-smoke-run-b8cb44e5f4f7 Created
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
SMOKE PASS (4/4 checks)
SMOKE_EXIT=0
```

---

## 3. Integrity against the feature baseline (`90f407a`)

### 3.1 Committed feature diff — inventory only

```
$ git diff --stat 90f407a..HEAD
 docs/features/cube-world-transition/build-log-T1.md | 199 +++++
 docs/features/cube-world-transition/build-log-T2.md | 193 +++++
 docs/product/glossary.md                           |  13 +-
 src/frontend/src/App.test.tsx                      |   4 +-
 src/frontend/src/game/board.test.ts                |  85 ++
 src/frontend/src/game/engine.test.ts               | 248 +++++-
 src/frontend/src/game/engine.ts                    | 103 ++-
 src/frontend/src/game/session.test.ts              | 114 ++-
 src/frontend/src/game/session.ts                   |  11 +-
 src/frontend/src/game/types.ts                     |  32 +-
 src/frontend/src/render/cube-view.test.ts          | 421 ++++++----
 src/frontend/src/render/cube-view.ts               |  83 +-
 src/frontend/src/render/picking.test.ts            |  67 +-
 src/frontend/src/render/scene.test.ts              | 905 ++++++++++++++++-----
 src/frontend/src/render/scene.ts                   | 280 +++++--
 15 files changed, 2226 insertions(+), 532 deletions(-)
```

```
$ git diff --name-only 90f407a..HEAD | grep -vE '^docs/features/cube-world-transition/|^docs/product/glossary.md|^src/frontend/src/(game|render)/|^src/frontend/src/App\.test\.tsx$'
OUTSIDE_INVENTORY_EXIT=1 (1 = none)
```

Every changed path is on the plan § File inventory (T1/T2 `files_owned` + the two build logs + the
glossary). No test or source file outside `src/frontend/src/{game,render}/` was modified except the T1
test-only `App.test.tsx` fixture.

### 3.2 Gated paths — committed diff empty (spec AC-4)

```
$ git diff --stat 90f407a..HEAD -- \
    compose.yaml compose.smoke.yaml 'src/*/Dockerfile' .dockerignore \
    src/frontend/src/main.tsx src/frontend/src/ws src/backend tests/e2e \
    docs/features/cube-game-frontend docs/features/cube-visual-polish docs/features/cube-visual-polish-followup \
    package.json package-lock.json eslint.config.mjs tsconfig.json \
    'src/frontend/vite.config.*' 'src/frontend/vitest.config.*' 'src/frontend/tsconfig*.json' \
    'src/backend/tsconfig*.json' 'src/backend/vitest.config.*' src/frontend/index.html
(no output)
DIFF_EXIT=0
```

Container paths (`compose.yaml`, `compose.smoke.yaml`, `src/*/Dockerfile`, `.dockerignore`), `main.tsx`,
`ws/**`, all configs, `src/backend/**`, `tests/e2e/**` and all three accepted feature directories are
**byte-identical to the baseline** across the whole feature. No `.env*` file is staged or modified:

```
$ git status --porcelain -- '.env*' 'src/**/.env*'
(no output)
```

### 3.3 Worktree observation (flagged, not touched)

`git diff` without a ref (working tree vs index) on the same paths is **not** empty:

```
$ git diff --stat -- <gated paths>
 docs/features/cube-game-frontend/status.md | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

This is a **pre-existing, uncommitted doc edit that predates the feature**: the file's mtime is
`2026-10-20 17:54` (before T1 ran on 2026-10-21), the edited line is the cube-game-frontend backlog
entry recording the 2026-10-20 manual visual pass, and `git log --oneline -3 -- docs/features/cube-game-frontend/status.md`
shows the file was last committed in `76e9ea5`/`02228ac` — no T1/T2/T2-block commit touches it
(`git diff 90f407a..HEAD -- docs/features/cube-game-frontend` is empty). The accepted-feature docs of
`cube-visual-polish/**` and `cube-visual-polish-followup/**` are likewise **untracked in this repository
history** (they appear as `??`), so they cannot appear in any commit-range diff.

Attribution: not produced by this feature; outside T3's `files_owned`; left exactly as found. The AC-4
claim ("the feature changes none of these paths") holds on the feature commits, which is what the diff gate
measures. Recorded here instead of being silently dropped.

### 3.4 Dependencies and tooling unchanged

```
$ git diff --stat 90f407a..HEAD -- package.json package-lock.json src/frontend/package.json src/backend/package.json
(no output)
$ grep -n '"three"\|"@types/three"' package-lock.json
5343:        "three": "^0.186.1"
5348:        "@types/three": "^0.186.0",
```

`three` 0.186.1 / `@types/three` 0.186.0, lockfile untouched, no new dependency.

---

## 4. Banned-matcher and purity greps

### 4.1 Banned matchers over **all changed test files** → none

```
$ grep -nE "expect\.anything|expect\.any\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toBeTruthy|toBeDefined|not\.toThrow" \
    src/frontend/src/App.test.tsx \
    src/frontend/src/game/board.test.ts \
    src/frontend/src/game/engine.test.ts \
    src/frontend/src/game/session.test.ts \
    src/frontend/src/render/cube-view.test.ts \
    src/frontend/src/render/picking.test.ts \
    src/frontend/src/render/scene.test.ts
(no output)
BANNED_EXIT=1            # 1 = no matches

$ grep -nE "toHaveBeenCalled\(\)" <same seven files>
(no output)
CALLED_EXIT=1            # no argument-unchecked call assertion
```

A whole-`src/frontend/src` sweep of the same matcher set also produces no output. No `toBeCloseTo`, so
the bounded-exception budget for this feature stays **0** (as the spec requires). Idempotency/次数
assertions are all argument-checked or count-only (`toHaveBeenCalledTimes(1)`), never bare
`toHaveBeenCalled()`.

### 4.2 `game/**` is `Math.random`-free and DOM-free → none

```
$ grep -rnE "Math\.random" src/frontend/src/game
MATH_RANDOM_EXIT=1       # no matches

$ grep -rnE "\b(window|document|localStorage|sessionStorage|navigator|requestAnimationFrame|performance)\b" src/frontend/src/game
DOM_GLOBALS_EXIT=1       # no matches
```

The only `Math.random` reads left in the frontend are the two sanctioned/pre-existing ones outside
`game/**`:

```
$ grep -rnE "Math\.random" src/frontend/src
src/frontend/src/render/scene.ts:257:  const random = options.random ?? Math.random;   # starfield/particle source (pre-existing)
src/frontend/src/browser-env.ts:74:    random: () => Math.random(),                     # the sanctioned platform reader
```

`game/**` draws exclusively from the injected RNG (engine LCG fallback) — confirmed by the pinned seed
tests in § 6.7 and by the diff (no `Math.random` line survives in `engine.ts`).

### 4.3 Plate/opacity removal (AC-2 support)

```
$ grep -nE "plateMeshes|Plate|PLATE_OFFSET" src/frontend/src/render/cube-view.ts src/frontend/src/render/scene.ts
(no output)
PLATE_EXIT=1             # plate identifiers fully removed

$ grep -n "opacity" src/frontend/src/render/scene.ts src/frontend/src/render/cube-view.ts
src/frontend/src/render/cube-view.ts:95:   * plate and no opacity write anywhere on the cube.
src/frontend/src/render/cube-view.ts:375:    // plate and no opacity write: the body behind the removed tiles is the dark interior.
```

Both `opacity` hits are **comments**; there is no material-opacity write in either file. The scene test
asserts `material.opacity === 1` and `material.transparent === false` at 0/399/400 ms
(`scene.test.ts:1462`), so the countdown never fades.

---

## 5. Supersession ledger — only the ledged behaviors changed

| Ledger row (spec § Supersessions) | Changed? | Where the change lives | Evidence |
| --- | --- | --- | --- |
| Predecessor **AC-4 structure** (fixed 5×5 → random N ∈ [3,7]) | yes, as ledged | `game/types.ts` (range constants), `game/engine.ts` (draws + snapshot fields) | `board.test.ts:164` (N = 3…7 → 6 × N²), `engine.test.ts:369` (one draw at creation + per advance), `engine.test.ts:413` (0.5 → N = 5), `engine.test.ts:475` (seed 19 → 4/7/3) |
| Predecessor **AC-4 tile geometry** (0.9 × cell + plate → flush) | yes, as ledged | `render/cube-view.ts` (`MINI_CUBE_TILE_RATIO = 1`, plates deleted) | `cube-view.test.ts:192` (ratio `toBe(1)`), `:207` (children = body + 6 meshes), `:237` (`'plateMeshes' in view` is `false`), `:332/:349/:380` (flush extents/spacing/edges N = 3/5/7) |
| Predecessor **AC-9 plate fade** (opacity fade → removal countdown) | yes, as ledged | `render/scene.ts` (`faceRemovals` countdown, no opacity writes) | `scene.test.ts:1462` (400 ms, opacity stays 1, disposal once), `:1496` (100 ms reduced), `:1509` (no restart), `:1527` (no double disposal) |
| Predecessor **AC-10 scene placement** (rebuild in place → at drawn world position) | yes, as ledged | `render/scene.ts` (`cubePosition`, pending rebuild on `applySnapshot`) | `scene.test.ts:988` (per-direction `(24,0,0)/(0,24,0)/(−24,0,0)/(0,−24,0)`, exactly one rebuild), `:1044` (chained `(48,0,0)`) |
| Predecessor **AC-22 rest pose** (`(0,0,12)` → over the current cube) | yes, as ledged (level 0 unchanged) | `render/scene.ts` (`applyRestPose` over `cubePosition`) | `scene.test.ts` playing-rest group (`(0,0,12)` at level 0), `:1044` (`(48,0,12)` rest after chained travel) |
| Predecessor **AC-18 glossary** (25/5×5 → random-N, + cube world position) | yes, as ledged | `docs/product/glossary.md` | § 5.1 diff below |
| Followup **AC-3** scene path / rebuild trigger / reduced collapse | yes, as ledged | `render/scene.ts` (`travelCameraPose`, countdown, snapshot rebuild, instant swap) | `scene.test.ts:680` (pose table), `:924` (travelFrom regression), `:988` (pending rebuild), `:1133` (reduced instant swap) |
| Followup AC-3 retained **z table / scale table / landing continuity / engine semantics** | no change | — | `scene.test.ts:924` (scale `[4.5,4.5,1]` at p = 0.75, `[1,1,1]` at p = 1; rest `(24,0,12)`), engine travel groups in § 6.3 |

### 5.1 Glossary diff (the only documentation behavior change)

```
$ git diff 90f407a..HEAD -- docs/product/glossary.md
- **Definition:** A single cube in the run, made of six **faces** of 25 **mini-cubes** each (150 mini-cubes per cube level). Clearing every face ...
+ **Definition:** ... six **faces** of N² **mini-cubes** each (6N² mini-cubes per cube level), where N is the level's random grid size — every cube level draws its own N in 3 to 7 ... spawns at a random **cube world position** — left, right, above or below the finished cube, 24 world units away ...
+### cube world position
+**Definition:** The fixed position of a **cube level** in the game's flat world plane ... plus the travel-direction offset of 24 world units ... Future online play will assign positions with occupancy checks ...
+**Example:** ... two consecutive rightward travels land at 48 world units.
 ### face
- **Definition:** ... each a 5×5 grid of **mini-cubes** ...
+ **Definition:** ... each an N×N grid of **mini-cubes**, where N is the cube level's random grid size (3 to 7), identical on all six faces ...
 ### mini-cube
- **Definition:** ... one of the 25 cells of that face's 5×5 grid ...
+ **Definition:** ... one of the N² cells of that face's N×N grid (N is the cube level's random grid size, 3 to 7) ... The tiles sit flush edge-to-edge ...
```

Exactly the three superseded terms were edited plus the one new canonical term; no other glossary
section appears in the diff.

### 5.2 Retained ACs — unchanged test files passing

`git diff --stat 90f407a..HEAD` on every retained test file is empty (byte-identical), and every one of
them passes in the final run (§ 2.3):

```
$ git diff --stat 90f407a..HEAD -- \
    src/frontend/src/render/starfield.test.ts src/frontend/src/render/particles.test.ts \
    src/frontend/src/game/effects.test.ts src/frontend/src/game/rotation.test.ts \
    src/frontend/src/game/progression.test.ts src/frontend/src/input/keyboard.test.ts \
    src/frontend/src/input/gestures.test.ts src/frontend/src/ui/Hud.test.tsx \
    src/frontend/src/ui/GameCanvas.test.tsx src/frontend/src/ui/theme.test.ts \
    src/frontend/src/browser-env.test.ts src/frontend/src/render/webgl.test.ts \
    src/frontend/src/ws/connection.test.ts
(no output — all 13 unchanged)
```

| Retained behavior | Evidence (unchanged file, passing) |
| --- | --- |
| Starfield anchored cone, expansion table, coverage (polish AC-1, followup AC-1) | `starfield.test.ts` 15 tests |
| Explosion particles / burst pool (polish AC-3) | `particles.test.ts` 19 tests |
| Pop timeline + easings (polish AC-4) | `effects.test.ts` 28 tests |
| Rotation machine / settle (AC-6 queue) | `rotation.test.ts` 15 tests |
| Style list / progression values | `progression.test.ts` 10 tests |
| Keyboard mapping / arrow-only rotation (polish AC-6) | `keyboard.test.ts` 8 tests |
| Pointer gestures / 40 px drag / touch (AC-13) | `gestures.test.ts` 21 tests |
| HUD, live region, stats copy (AC-11) | `Hud.test.tsx` 3 tests |
| Frame-loop canvas lifecycle (AC-15) | `GameCanvas.test.tsx` 2 tests |
| Theme tokens / contrast (AC-19) | `theme.test.ts` 2 tests |
| SSR shell groups | `App.test.tsx` 4 tests — diff is the 2-field snapshot fixture only (§ 5.3) |
| Browser-global reader (AC-14) | `browser-env.test.ts` 6 tests |
| WebGL adapter surface (AC-15) | `webgl.test.ts` 5 tests |
| WS connection lifecycle (AC-17) | `connection.test.ts` 10 tests |

### 5.3 The two test-only edits (both ledged / ratified)

```
$ git diff 90f407a..HEAD -- src/frontend/src/App.test.tsx
-import type { GameStats, Phase } from './game/types';
+import { GRID_SIZE, type GameStats, type Phase } from './game/types';
     board: createBoard(),
+    gridSize: GRID_SIZE,
+    travelDirection: null,
```

The T2-r3 re-pin (`src/frontend/src/game/session.test.ts`) is the single superseded tile-extent literal:

```
-    expect(popping.elements[0]).toBe(Math.fround(0.9 * 1.016));
+    expect(popping.elements[0]).toBe(Math.fround(1 * 1.016));
```

Both are test-only and trace to AC-2/AC-4 (flush tile extent) and the new required snapshot fields; no
production behavior is asserted differently.

---

## 6. Integration behaviors re-verified (re-run, not just quoted)

All of the following were re-executed in this pass; the command was
`cd src/frontend && npx vitest run <file> --reporter=verbose` (exit 0) — the transcripts are the verbose
runs below.

### 6.1 Flush tiling at N = 3 / 5 / 7 — verified

`npx vitest run src/render/cube-view.test.ts src/render/picking.test.ts --reporter=verbose` → **43/43
passed** (`cube-view` 32, `picking` 11), including:

```
✓ flush tiling (AC-2) > sizes every tile to exactly one cell on its face axes (N = 3 and N = 7)
✓ flush tiling (AC-2) > keeps the pinned first/last centres and the exact cell spacing (N = 3, 5, 7)
✓ flush tiling (AC-2) > reaches the cube edges with the outermost tiles on every face (N = 3, 5, 7)
✓ createCubeView > builds exactly one body and six face grids, in order (AC-2: no plates)
✓ createCubeView > exposes the plate-free CubeView surface (AC-2)
✓ removeFace > detaches the face and disposes its geometry and material exactly once (no plate)
✓ pickMiniCube > decodes a 3 × 3 grid from its own instance count
✓ pickMiniCube > decodes a 7 × 7 grid from its own instance count
```

Pinned layout table the assertions read (`cube-view.test.ts:56`):

| N | cell | first centre (front) | last centre | column steps |
| --- | --- | --- | --- | --- |
| 3 | `5/3` | `[-1.6666666269302368, 1.6666666269302368, 2.625]` | `[1.6666666269302368, -1.6666666269302368, 2.625]` | `[1.6666666269302368, 1.6666666269302368]` |
| 5 | `1` | `[-2, 2, 2.625]` | `[2, -2, 2.625]` | `[1, 1, 1, 1]` |
| 7 | `5/7` | `[-2.142857074737549, 2.142857074737549, 2.625]` | `[2.142857074737549, -2.142857074737549, 2.625]` | `0.7142856121063232 ×1, 0.7142857313156128 ×4, 0.7142856121063232 ×1` (float32 readback; exact double spacing `5/7`) |

Outermost outer faces assert exactly `±CUBE_HALF_SIZE` on all six faces (N = 3/5/7).

### 6.2 Four-direction placements and chained offsets — verified

`scene.test.ts:988` (`rebuilds exactly once per level change and places the cube per direction`) loops all
four directions and asserts the new group's position equals `TRAVEL_DIRECTION_OFFSETS[direction]`
(`(24,0,0)`, `(0,24,0)`, `(−24,0,0)`, `(0,−24,0)`), exactly one disposal, and the rebuilt cube at
`gridSize: 7` (`[49,49,49,49,49,49]`). `scene.test.ts:1044` chains a second `right` travel:
`(24,0,0)` → rest `(24,0,12)` → flight `p = 0.25` `(27,0,51)` → rebuild `(48,0,0)` → p = 0.5 `(36,0,90)`
→ rest `(48,0,12)` looking at `(48,0,0)`.

### 6.3 Mid-travel `levelChanged` rebuild exactly once, position advance only on level change — verified

- `scene.test.ts:988`: after `applyIntents([levelChanged])` alone → `cubeGroup(view)` is the **same**
  object and `dispose` called **0** times; the next `applySnapshot` → new group, old group removed from
  the scene, `dispose` **1** time; the next two snapshots → same group, `dispose` still **1**.
- `scene.test.ts:924` (mid-travel regression): rebuild at p = 0.5 places the cube at `(24,0,0)` and keeps
  the camera at the table value `(12,0,90)`; p = 0.75 is still `(21,0,51)` (not `45`) because the flight
  origin was captured once.
- `scene.test.ts:1094` (grid change arriving **without** an intent): rebuild in place, position stays
  `(0,0,0)`, one disposal, no second rebuild on the repeated snapshot — i.e. the positional advance is
  gated on `pendingLevelChanged`, not on "any rebuild".
- `scene.test.ts:1114` (defensive null direction with a pending change): rebuild in place at `(0,0,0)`.

### 6.4 Travel pose formula — verified (`p = 0.25 → (3,0,51)`, `p = 0.75 → (21,0,51)`)

`scene.test.ts:393-425` pins the full table and `:680` asserts positions **and** targets for all four
directions (through-the-scene loop at `:853`); the `right` row re-run in this pass:

```
p = 0     position [0, 0, 12]    target [0, 0, 0]
p = 0.25  position [3, 0, 51]    target [3, 0, 0]
p = 0.5   position [12, 0, 90]   target [12, 0, 0]
p = 0.75  position [21, 0, 51]   target [21, 0, 0]
p = 1     position [24, 0, 12]   target [24, 0, 0]
```

`left`/`top`/`bottom` mirror the lateral sign on x/y; `CUBE_SPACING === 24` and the offset record are
asserted at `:670`. Recomputation from the shipped easings agrees with the formula-authoritative table:
`easeInOutQuad(0.25) = 0.125 → 24 × 0.125 = 3`, `travelSwing(0.25) = 0.5 → 12 + 78 × 0.5 = 51`;
`easeInOutQuad(0.75) = 0.875 → 21`, `travelSwing(0.75) = 0.5 → 51`. Identity quaternion at every pinned
p is asserted in the through-the-scene pose loop (`scene.test.ts` directional travel group). Framing
gates `:1191` pass at aspects {2/3, 16/9, 7/3} for the old cube at p ∈ {0, 0.25} and the new cube at
p ∈ {0.5, 0.75, 1}.

### 6.5 Reduced-motion instant positional swap — verified

`scene.test.ts:1133` (`swaps instantly and positionally under reduced motion`): rest `(0,0,12)` at the
departure p ∈ {0, 0.25} with starfield scale `[1,1,1]`; at the midpoint the rebuild places the cube at
`(24,0,0)` and the same snapshot puts the camera at `(24,0,12)` looking at `(24,0,0)`; p ∈ {0.75, 1}
stay at `(24,0,12)` with scale `[1,1,1]` — no flight, no expansion.

### 6.6 Face-clear countdown 400 / 100 ms — verified

`scene.test.ts:1462`: face present at 399 ms, detached at 400 ms, `material.opacity === 1` and
`material.transparent === false` throughout, geometry and material disposed exactly once, remaining
faces still in `view.cubeView.faces` (size 5). `:1496`: present at 99 ms, removed at 100 ms under
reduced motion. `:1509`: a repeated `faceCleared` does not restart the countdown (200 + 200 ms removes,
one disposal). `:1527`: a second intent after removal is a no-op (no double disposal).

### 6.7 Seeded per-level N and directions — verified

`engine.test.ts:475` (seed 19, scripted through two level completions):

```
level 0         gridSize 4   (draw 0.24343146895989776 → N = 4)
travel start    travelDirection 'left'   (draw 0.00193844665773213 → ⌊·4⌋ = 0)
midpoint        levelIndex 1, gridSize 7 (draw 0.82899093441665173 → N = 7), direction still 'left'
playing         travelDirection null
second travel   travelDirection 'right'  (draw 0.37117785005830228 → ⌊·4⌋ = 1)
level 2         gridSize 3, board faces [9,9,9,9,9,9]
```

`engine.test.ts:413` (constant 0.5):
gridSize 5 in intro/playing, direction `top` during travel, back to `null` after arrival, next level
still 5. `engine.test.ts:369`: exactly one draw at creation + one per level advance (a scripted source
throws on any extra draw). `engine.test.ts:392`: injected `gridSize` consumes **0** grid draws.
`engine.test.ts:291`: no injected random → pinned LCG(1) (`gridSize` 4, burst values 0.23645552527159452…);
`engine.test.ts:331`: the seeded burst is replayed one draw after the level-0 grid draw.
`engine.test.ts:507` (`setRandomSource`): `0.1 → N = 3`, after the swap `0.9 → direction 'bottom'`, next
level `N = 7` (`[49 × 6]`), and `getSnapshot()` identity is preserved across the swap.

`session.test.ts` (integration, real engine + real scene through a mocked renderer):
`:568` attach injects `env.random` into the engine; `:583` the scene is built at the engine's grid size
and later directions come from `env.random`; `:610` the travel direction is exposed only while
travelling; `:640` pre-attach snapshots run on the deterministic fallback.

### 6.8 `game/**` `Math.random`-free — verified

See § 4.2 (both greps exit 1 / no output), reinforced by the seed-pinned tests above.

---

## 7. Acceptance audit — AC-1 … AC-5

| AC | Verdict | Evidence |
| --- | --- | --- |
| **AC-1** Random per-level mini-cube count | **met** | Constants `MINI_CUBE_GRID_MIN === 3` / `MINI_CUBE_GRID_MAX === 7` / `TRAVEL_DIRECTIONS = ['left','right','top','bottom']` (`types.ts:27,30,88`; pinned in `board.test.ts:75`). `createBoard(N)` for N = 3…7 → six faces × N² unique ascending ids (`board.test.ts:164`). Engine: one creation draw + one per advance (`engine.test.ts:369`), `N = 3 + ⌊draw·5⌋` with 0.5 → 5 (`:413`), seed-19 sequence 4/7/3 (`:475`), injected `gridSize` draws nothing (`:392`), `snapshot.gridSize` lifecycle (`:442`), every level's six faces `N²` (`:475`/`:507`, `[9…]`/`[49…]`). Retained click/stats/repeat-no-op groups pass. |
| **AC-2** Mini-cube-built surface (plates gone, countdown) | **met** | `MINI_CUBE_TILE_RATIO === 1` (`cube-view.test.ts:192`); no `plateMeshes` key (`:237`); children = body + 6 meshes (`:207`); flush extents/spacing/edges N = 3/5/7 (`:332/:349/:380`); `removeFace` disposal once, no opacity write (`:682`); pop timeline on the flush tile, idle `(1,1,1)`, reduced instant hide, idempotent `dispose()`; body = `style.cubeColor` (`:272`). Scene countdown 400/100 ms, no opacity (`scene.test.ts:1462/:1496`); greps in § 4.3. |
| **AC-3** Directional travel to a randomly placed cube | **met** | Engine: one direction draw (`engine.test.ts:365/:413/:475`), `travelDirection` non-null only in `travel` (`:413/:442`), midpoint/intent/travelStarted/gating/dt retained (travel groups pass). Scene: `CUBE_SPACING === 24` + offsets (`scene.test.ts:670`), four-direction pose tables (`:680`, through-the-scene `:853`), `travelFrom` regression (`:924`), pending rebuild exactly once + per-direction placement (`:988`), chained `(48,0,0)` (`:1044`), in-place reconciliation (`:1094`), reduced instant swap (`:1133`), framing gates (`:1191`), rest over the current cube incl. level 0 `(0,0,12)` (playing-rest group), starfield anchor + scale `1→8→1` (`:924`, `:728`), extended corner-ray coverage at `(12,0,90)`/`(24,0,12)` (`:728/:779`), one cube view + plate-free object counts (frame-lifecycle group). Session wiring (§ 6.7). |
| **AC-4** Supersession ledger + regression gate | **met** | Ledger confirmed row by row (§ 5); only the ledged behaviors changed; 13 retained test files byte-identical and passing (§ 5.2); `npm ci`/`lint`/`typecheck`/`test`/`coverage` exit 0 with both workspaces ≥ 80 × 4 (§ 2); `npm run build` inside the 350 KB gzip budget (209.65 kB, § 2.5); gated-path diff empty on the feature commits (§ 3.2; pre-existing uncommitted doc edit flagged in § 3.3); no `.env*`; no banned matchers (§ 4.1); no DOM globals / no `Math.random` in `game/**` (§ 4.2); no new dependencies (§ 3.4). |
| **AC-5** Glossary consistency | **met** | § 5.1 diff: **mini-cube**, **face**, **cube level** updated to the random-N model in the existing definition+example format, new canonical **cube world position** added; no other term appears in the diff. |

No unmet AC. No AC is marked met on the strength of a T1/T2 log alone — each row above cites a command
re-run in this T3 pass or a grep/`git diff` executed here.

---

## 8. Manual visual pass (spec § Manual visual pass) — not an AC

Environment finding: no browser binary is available to this agent (`which firefox chromium google-chrome`
→ `no … in (PATH)`, exit 3), and browser automation is an explicit spec non-goal, so there is nothing to
drive. The local stack itself is up (`podman compose ps`: frontend `127.0.0.1:5173`, backend
`127.0.0.1:8080`) and the containerized smoke pass confirms it serves and speaks WebSocket (§ 2.6);
direct `curl` to `localhost:5173` is blocked by this agent's shell permission policy, so no page content
was inspected. **Not executed — environment.**

| # | Step (spec wording abridged) | Outcome |
| --- | --- | --- |
| 1 | Load → random 3–7 grid; flush surface, no plates/gaps; removed tiles show dark interior; rotation unchanged | not executed — environment |
| 2 | Intro unchanged: cube visible/centred from the first frame; skip works | not executed — environment |
| 3 | Click a mini-cube → pop/shrink + burst in front; `Clicks` +1 immediately | not executed — environment |
| 4 | Click a partially visible non-front face → nothing | not executed — environment |
| 5 | Drag > 40 px / arrow keys → one rotation step | not executed — environment |
| 6 | Clear a whole face → last tile pops, no plate fade; `Faces destroyed` +1; remaining faces playable | not executed — environment |
| 7 | Clear all six → camera departs toward the spawn direction while the backdrop expands; next cube appears far away at the turn-around; fly-in lands at rest; `Cube N` +1; stats carried; several levels show multiple sizes/directions | not executed — environment |
| 8 | OS reduced motion → instant positional swap, no flights/expansion, instant hide, no bursts | not executed — environment |
| 9 | Starfield fills the viewport at rest/during travel/at new spawns; resize widescreen/16:9/narrow, run ≥ 60 s | not executed — environment |
| 10 | Touch device (or emulation) → tap explodes, drag rotates, no page scroll/zoom | not executed — environment |

The deterministic node tests cover the observable mechanics of every step (geometry, countdown, flight
tables, framing, reduced collapse, HUD counts via the unchanged `App.test.tsx`/`Hud.test.tsx`), but the
spec is right that this is a human checklist, not an AC — it stays open.

---

## 9. Known residuals (explicit)

| Residual | Detail | Status |
| --- | --- | --- |
| Thin `GameCanvas.tsx` effect body | `src/frontend/src/ui/GameCanvas.tsx:23-30` — `session.attach` / `session.dispose` inside `useEffect` never executes under SSR/jsdom, so the file reports 61.9 % statements / lines (`src/ui` 79.48). It is a deliberate composition root: the session owns the runtime and lifecycle. | pre-existing, unchanged by this feature, accepted |
| Mocked `WebGLRenderer` | `src/frontend/src/render/webgl.test.ts:25` mocks `three`'s `WebGLRenderer` (a real GL context is unavailable in the node test environment); the adapter surface and the ping-pong frame path are asserted, the driver itself is not. | pre-existing, accepted |
| Pre-existing uncovered lines | `src/frontend/src/ws/connection.ts:53-54` and `:99-100` (`setStatus` after close / retry edges) — 95.34 % statements, 92.59 % branches; `src/frontend/src/game/session.ts:173` (`active` re-entry guard) — 98.18 % branches. | pre-existing, unchanged by this feature, accepted; workspace bars still met |
| `docs/features/cube-game-frontend/status.md` uncommitted edit | Working-tree-only, mtime 2026-10-20 (pre-feature) — see § 3.3. | flagged, out of T3 scope, untouched |
| Accepted-feature docs untracked | `docs/features/cube-visual-polish/**` and `docs/features/cube-visual-polish-followup/**` are untracked in the repository history (`??`); their `git diff` is empty by construction. | repository hygiene observation, not a feature change |
| Chunk-size advisory | Vite warns the uncompressed JS chunk exceeds 500 kB (771.97 kB). The gzip budget (350 kB) is met at 209.65 kB. | pre-existing advisory, accepted |

## 10. Drift check

- No source/test/config/container/doc behavior outside the § 5 ledger changed (§ 3.1 inventory, § 3.2
  gated paths empty).
- No deviation from the spec's pinned values was found: `MINI_CUBE_TILE_RATIO = 1`, `CUBE_SPACING = 24`,
  offsets `(−24,0)/(24,0)/(0,24)/(0,−24)`, pose table `(3,0,51)`/`(21,0,51)`, 400/100 ms countdown,
  N ∈ [3,7] with `3 + ⌊draw·5⌋`, direction `⌊draw·4⌋`, LCG(1) fallback — all asserted and green.
- T2's r1 blocker (spec pose table vs formula) is closed by spec r2 and the tests now pin the
  formula-authoritative values; no stale table cell survives. The remaining `21.75` occurrences are the
  **retained z-column** of the followup table at p = 0.125 / 0.875 (`12 + 78·travelSwing`), asserted at
  `scene.test.ts:887`, `:893`, `:910` as `[12, 21.75, 51, 80.25, 90, 80.25, 51, 21.75, 12]`; there is no
  p = 0.25 z of `21.75` and no p = 0.75 lateral of `18` anywhere. The p = 0.25 z and p = 0.75 lateral
  cells are `51` and `21` (`scene.test.ts:400-404`).

## 11. Deviations from spec

None. This task changed exactly one file (this log) and made no source, test, config, container,
accepted-doc or `.env*` edit. Manual visual pass not executed — environment (not an AC).

## 12. Commit

```
docs: record T3 verification pass for cube-world-transition (T3)
```

Staged explicitly (`git commit --only -- docs/features/cube-world-transition/build-log-T3.md`); no
`git add .`/`-A`, no push.
