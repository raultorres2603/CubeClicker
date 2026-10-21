# Build log — T4 — Verify & integrate

Task: T4 (2026-10-21), final verification gate. **Verification only — no source, test, config,
spec, plan, tasks or accepted-artifact change.**
Files changed: `docs/features/cube-visual-polish-followup/build-log-T4.md` (this file) only.

## Repo state at verify time

```
$ git log --oneline -4
51de432 feat: camera-anchored square starfield cone, pointing intro dolly and travel arrival path (T2)
bef14a7 feat: advance the cube level at the travel midpoint (T3)
62616bb feat: add travelSwing and the arrival constant (T1)
423004f docs: record T4 verification pass for cube-visual-polish (T4)
```

- **Feature baseline (task's "parent of T1"): `423004f52b58ed5ce3f435d26d8a58528aca123b`**
  (`git rev-parse 62616bb^`), subject `docs: record T4 verification pass for cube-visual-polish (T4)`.
- T1 `62616bb`, T3 `bef14a7`, T2 `51de432` (T2 merged last, so HEAD = T2 commit on `main`).
- Host tooling: `node v24.22.0`, `npm 11.19.1`, `three 0.186.1`.

Working tree before the gate run (`git status --porcelain`):

```
 M docs/features/README.md
 M docs/features/cube-game-frontend/status.md
?? docs/features/cube-visual-polish-followup/plan.md
?? docs/features/cube-visual-polish-followup/reviews/
?? docs/features/cube-visual-polish-followup/spec.md
?? docs/features/cube-visual-polish-followup/status.md
?? docs/features/cube-visual-polish-followup/tasks.md
?? docs/features/cube-visual-polish/plan.md
?? docs/features/cube-visual-polish/reviews/
?? docs/features/cube-visual-polish/spec.md
?? docs/features/cube-visual-polish/status.md
?? docs/features/cube-visual-polish/tasks.md
```

These are **pre-existing planning-phase artifacts**, not build drift: the accepted-feature
docs and the two modified tracked docs all predate the T1 commit (2026-10-21 09:22):
`docs/features/cube-visual-polish/spec.md` 2026-10-20 18:12, `plan.md` 18:11,
`reviews/spec-r1.md` 18:16, `tasks.md` 2026-10-21 08:39, `status.md` 08:49,
`reviews/code-r1.md` 08:44, `docs/features/cube-game-frontend/status.md` 2026-10-20 17:54,
`docs/features/README.md` 2026-10-21 08:44. The follow-up's *own* planning docs are newer,
which is expected and outside the integrity set: `reviews/spec-r1.md` 09:20,
`spec.md`/`plan.md` 09:43 (the approved r2 revision during T2), `reviews/spec-r2.md` 09:48,
`status.md`/`tasks.md` 09:52 (task bookkeeping). No T1–T3 commit touched any of them
(`git diff 423004f..HEAD` lists only the 12 paths below). They stay untouched by T4 (outside
`files_owned`) and are flagged in § Drift flags below.

## The gate (raw transcripts)

### 1. `npm ci` → 0

```
$ npm ci
NPM_CI_EXIT=0
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 333 packages, and audited 336 packages in 2s

92 packages are looking for funding
  run `npm fund` for details

4 vulnerabilities (2 moderate, 2 critical)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
```

(The 4 advisories are the pre-existing dev-tooling ones recorded in the accepted
`cube-game-frontend` status — not `three`; unchanged by this feature: the lockfile diff is
empty, see § Integrity.)

### 2. `npm run lint` → 0

```
$ npm run lint
LINT_EXIT=0

> lint
> eslint .
```

(no findings)

### 3. `npm run typecheck` → 0

```
$ npm run typecheck
TYPECHECK_EXIT=0

> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
```

Both workspaces clean (backend + frontend, no diagnostics).

### 4. `npm test` → 0 (both workspaces)

```
$ npm test
TEST_EXIT=0

> test
> npm run test --workspaces --if-present

> test
> vitest run

 ✓ src/app.test.ts (4 tests) 95ms
 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  391ms (...)

> test
> vitest run

 ✓ src/game/rotation.test.ts (15 tests) 10ms
 ✓ src/browser-env.test.ts (6 tests) 28ms
 ✓ src/ui/theme.test.ts (2 tests) 4ms
 ✓ src/game/progression.test.ts (10 tests) 13ms
 ✓ src/render/webgl.test.ts (5 tests) 13ms
 ✓ src/game/effects.test.ts (28 tests) 17ms
 ✓ src/input/keyboard.test.ts (8 tests) 6ms
 ✓ src/game/board.test.ts (14 tests) 23ms
 ✓ src/input/gestures.test.ts (21 tests) 6ms
 ✓ src/ws/connection.test.ts (10 tests) 16ms
 ✓ src/game/engine.test.ts (38 tests) 34ms
 ✓ src/ui/Hud.test.tsx (3 tests) 8ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 9ms
 ✓ src/render/particles.test.ts (19 tests) 18ms
 ✓ src/render/cube-view.test.ts (28 tests) 28ms
 ✓ src/render/picking.test.ts (9 tests) 28ms
 ✓ src/render/starfield.test.ts (15 tests) 55ms
 ✓ src/App.test.tsx (4 tests) 15ms
 ✓ src/game/session.test.ts (19 tests) 62ms
 ✓ src/render/scene.test.ts (35 tests) 74ms
 Test Files  20 passed (20)
      Tests  291 passed (291)
   Duration  547ms (...)
```

Totals: **backend 1 file / 4 tests; frontend 20 files / 291 tests; 295 tests green.**

**Changed test files (all listed in the transcript above, all passing):**

| Test file | Tests | Commit |
| --- | --- | --- |
| `src/frontend/src/game/effects.test.ts` | 28 | T1 |
| `src/frontend/src/game/engine.test.ts` | 38 | T3 |
| `src/frontend/src/game/session.test.ts` | 19 | T2 (one literal re-pinned) |
| `src/frontend/src/render/scene.test.ts` | 35 | T2 |
| `src/frontend/src/render/starfield.test.ts` | 15 | T2 |

**Unchanged test files (16, all passing):** `src/backend/src/app.test.ts` (4),
`src/frontend/src/App.test.tsx` (4), `src/frontend/src/browser-env.test.ts` (6),
`src/frontend/src/game/board.test.ts` (14), `src/frontend/src/game/progression.test.ts` (10),
`src/frontend/src/game/rotation.test.ts` (15), `src/frontend/src/input/gestures.test.ts` (21),
`src/frontend/src/input/keyboard.test.ts` (8), `src/frontend/src/render/cube-view.test.ts` (28),
`src/frontend/src/render/particles.test.ts` (19), `src/frontend/src/render/picking.test.ts` (9),
`src/frontend/src/render/webgl.test.ts` (5), `src/frontend/src/ui/GameCanvas.test.tsx` (2),
`src/frontend/src/ui/Hud.test.tsx` (3), `src/frontend/src/ui/theme.test.ts` (2),
`src/frontend/src/ws/connection.test.ts` (10).

### 5. `npm run coverage` → 0 (both workspaces ≥ 80 on all four metrics)

```
$ npm run coverage
COVERAGE_EXIT=0

> coverage
> npm run coverage --workspaces --if-present

> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
 ✓ src/app.test.ts (4 tests) 100ms
 Test Files  1 passed (1)
      Tests  4 passed (4)

 % Coverage report from v8
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------|---------|----------|---------|---------|-------------------
All files |     100 |      100 |     100 |     100 |                   
 app.ts   |     100 |      100 |     100 |     100 |                   
----------|---------|----------|---------|---------|-------------------

> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
 Test Files  20 passed (20)
      Tests  291 passed (291)

 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.31 |    99.36 |     100 |   99.31 |                   
 src             |     100 |      100 |     100 |     100 |                   
  App.tsx        |     100 |      100 |     100 |     100 |                   
  browser-env.ts |     100 |      100 |     100 |     100 |                   
 src/game        |     100 |    99.59 |     100 |     100 |                   
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
-----------------|---------|----------|---------|---------|-------------------
```

Per-workspace aggregate (the gate is ≥ 80 on each metric per workspace):

| Workspace | Statements | Branches | Functions | Lines | Verdict |
| --- | --- | --- | --- | --- | --- |
| `@cubeclicker/backend` | 100 | 100 | 100 | 100 | pass |
| `@cubeclicker/frontend` | **99.31** | **99.36** | **100** | **99.31** | pass |

No exclusion was added and no threshold was changed (`src/frontend/vitest.config.ts` is
byte-identical to the baseline — see § Integrity). The four feature-touched production
files are at 100/100/100/100: `game/effects.ts`, `game/engine.ts`, `render/scene.ts`,
`render/starfield.ts`.

### 6. `npm run build` → 0 (sizes recorded; initial JS gzip ≤ 350 KB)

```
$ npm run build
BUILD_EXIT=0

> build
> npm run build --workspaces --if-present

> build
> tsc

> build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 49 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.40 kB │ gzip:   0.27 kB
dist/assets/index-BaygJ9fo.css    1.32 kB │ gzip:   0.63 kB
dist/assets/index-CRg_3CaN.js   771.46 kB │ gzip: 209.38 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.22s
```

| Artifact | Raw | Gzip |
| --- | --- | --- |
| `dist/index.html` | 0.40 kB | 0.27 kB |
| `dist/assets/index-BaygJ9fo.css` | 1.32 kB | 0.63 kB |
| `dist/assets/index-CRg_3CaN.js` (initial JS) | 771.46 kB | **209.38 kB** |

**AC-20 budget (`BUNDLE_BUDGET_GZ_KB` = 350): 209.38 kB ≤ 350 kB → holds** (59.8 % of the
budget; the accepted `cube-visual-polish` T4 measured 209.49 kB, so this feature's bundle is
0.11 kB *smaller*). The >500 kB warning is Vite's **uncompressed** advisory and pre-exists
the feature.

### 7. `npm run smoke` (optional containerized e2e) → 0

The local stack was already up (`podman compose ps`: backend `127.0.0.1:8080->8080`,
frontend `127.0.0.1:5173->5173`, both `Up 16 hours`).

```
$ npm run smoke
> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

 Container cubeclicker-backend-1 Running 
 Container cubeclicker-frontend-1 Running 
 Container cubeclicker-smoke-run-47e2c09952ce Creating 
 Container cubeclicker-smoke-run-47e2c09952ce Created 
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
SMOKE PASS (4/4 checks)
SMOKE_EXIT=0
```

Both changed frontend containers serve the build and the WebSocket endpoint still accepts
two concurrent clients — the container path is unaffected.

## Integrity vs the feature baseline (`423004f`)

The whole feature diff, `git diff --stat 423004f..HEAD`:

```
 .../cube-visual-polish-followup/build-log-T1.md    |  69 ++++
 .../cube-visual-polish-followup/build-log-T2.md    | 139 +++++++
 .../cube-visual-polish-followup/build-log-T3.md    | 144 +++++++
 src/frontend/src/game/effects.test.ts              |  48 ++-
 src/frontend/src/game/effects.ts                   |  31 +-
 src/frontend/src/game/engine.test.ts               | 201 +++++++++-
 src/frontend/src/game/engine.ts                    |  48 ++-
 src/frontend/src/game/session.test.ts              |   4 +-
 src/frontend/src/render/scene.test.ts              | 431 ++++++++++++++++-----
 src/frontend/src/render/scene.ts                   | 123 ++----
 src/frontend/src/render/starfield.test.ts          | 188 ++++++---
 src/frontend/src/render/starfield.ts               | 168 ++++++--
 12 files changed, 1307 insertions(+), 287 deletions(-)
```

**Exactly 12 paths: 3 feature build logs + 4 production source files (`game/effects.ts`, `game/engine.ts`, `render/scene.ts`, `render/starfield.ts`) + 5 test files.** Nothing else.

Per-path integrity check (all must be empty — spec AC-4 "accepted features untouched"):

```
$ B=423004f52b58ed5ce3f435d26d8a58528aca123b
$ git diff --stat $B HEAD -- compose.yaml compose.smoke.yaml .dockerignore        → (empty), exit=0
$ git diff --stat $B HEAD -- src/backend/Dockerfile src/frontend/Dockerfile       → (empty), exit=0
$ git diff --stat $B HEAD -- src/frontend/src/main.tsx src/frontend/index.html    → (empty), exit=0
$ git diff --stat $B HEAD -- src/frontend/src/ws                                  → (empty), exit=0
$ git diff --stat $B HEAD -- eslint.config.mjs tsconfig.json package.json \
    package-lock.json src/frontend/package.json src/frontend/tsconfig.json \
    src/frontend/vitest.config.ts src/frontend/vite.config.ts \
    src/backend/package.json src/backend/tsconfig.json src/backend/vitest.config.ts \
    src/frontend/nginx.conf                                                       → (empty), exit=0
$ git diff --stat $B HEAD -- src/backend                                           → (empty), exit=0
$ git diff --stat $B HEAD -- tests                                                 → (empty), exit=0
$ git diff --stat $B HEAD -- docs/features/cube-game-frontend docs/features/cube-visual-polish
                                                                                   → (empty), exit=0
```

- Container assets, `main.tsx`, `index.html`, `ws/**`, every config, the backend workspace,
  `tests/e2e/` and **both accepted feature directories** are byte-identical across the whole
  feature range.
- **No new dependency:** `git diff 423004f..HEAD -- package-lock.json | wc -l` → `0`;
  `three` resolves to `0.186.1`; `grep -rn "three/addons" src/frontend/src` → none;
  `grep -rnE "import \* as .* from 'three('|/addons)"` → none; all 14 `from 'three'` imports
  in `src/frontend/src` are named imports.
- **No `.env*`:** `git status --porcelain | grep -E '\.env'` → none.

## Supersession ledger — the six named accepted behaviors, and nothing else

Every removed assertion/hunk in the feature range maps to one of the six rows (audit below:
`git diff 423004f..HEAD` removed lines only inside these groups).

| # | Superseded accepted behavior | Where it changed | Evidence (old → new) |
| --- | --- | --- | --- |
| 1 | **polish AC-1** — travel backdrop values + drift mechanics | `render/starfield.ts` (cone distribution, camera anchor, view-axis swirl, symmetric scale), `render/starfield.test.ts` (`star disk` positions, y-axis drift, monotone scale table), `scene.ts` travel branch, `effects.ts`/`effects.test.ts` (`travelSwing` tables) | disk `x∈[-70,70], y∈[-40,40], z∈[-60,-8]` + `points.rotation.y += dt·1/65536` + `1+7·easeInOutQuad(p)` → square cone `|x|/depth, |y|/depth ≤ 1.251258882715913`, `rotation.z` swirl, `1+7·travelSwing(p)`; scale peak 8 and the rate `1/65536` retained |
| 2 | **polish AC-2** — intro path | `render/scene.ts` `introCameraPose`, `render/scene.test.ts` intro groups → `intro dolly through the scene (AC-2)`, `game/session.test.ts` one literal | search → find → approach (opening `[36,20,24]` looking at `[0,30,-40]`, cube off-screen for p ∈ [0, 0.4]) → `(0,0,60) → (0,0,12)`, target `(0,0,0)`, `easeOutCubic`, 5-row table |
| 3 | **polish AC-1 § Manual step 1** | docs only (this feature's spec supersedes the checklist step; no accepted artifact edited) | "the camera *searches* the sky" → "cube visible and framed from the first frame"; `git diff` on `docs/features/cube-visual-polish/**` empty |
| 4 | **predecessor AC-22** — camera flights | `effects.test.ts` (AC-22 travel-position helper removed), `scene.test.ts` travel pull-away test removed, `scene.ts` intro + travel | travel `(0,0,21.75)@0.25, (0,0,51)@0.5, (0,0,90)@1` → symmetric `12/21.75/51/80.25/90/80.25/51/21.75/12`; intro reinstates the original AC-22 values `60/18/12` with the always-pointing guarantee |
| 5 | **predecessor AC-10** — level-advance timing | `game/engine.ts` (`advanceLevelAndRebuild` → `advanceLevel()` + crossing guard), `game/engine.test.ts` | advance + phase switch both at `travelMs` → advance at `travelMs · 0.5` once, phase switch still at `travelMs`; every other engine semantic retained |
| 6 | **predecessor AC-3** — star positions | `render/starfield.ts` distribution loop, `render/starfield.test.ts` `maps the first and last star draws` | seeded disk positions (`[0,0,-34]`, `[70,-40,-60]`, seed-7 first/last) → cone positions (`[0,0,-90]`, `[200.201416015625,-200.201416015625,-160]`, seed-7 `[-69.12860107421875,109.4261703491211,-105.74883270263672]`); 4 draws/star, 1200 stars, determinism retained |

Removed-line audit (`git diff 423004f..HEAD -- <changed test file> | grep -E '^-\s*(it|describe|expect)\('`):

```
effects.test.ts   : removed the AC-22 travel-camera-position helper (row 4)
engine.test.ts    : only `-import { createBurst, DEFAULT_TIMINGS, REDUCED_TIMINGS } from './effects';` (replaced by the fuller import)
session.test.ts   : `-expect(camera.position.toArray()).toEqual([36, 20, 24]);` (row 2)
scene.test.ts     : removed intro search/find tests + first-frame literals + the AC-22 travel pull-away test
                    + the monotone starfield-expansion test and the y-drift assertion (rows 1, 2, 4)
starfield.test.ts : removed the disk-position test, `describe('starfield drift')` (rotation.y pins),
                    and the monotone travel-expansion table (rows 1, 6)
```

No other assertion, test or production hunk was removed.

## Retained accepted behaviors — evidence (unchanged test files, all passing)

| Retained behavior (AC-4) | Tier-2 evidence (test file → tests, all green) |
| --- | --- |
| Game rules, board, click path, progression | `game/board.test.ts` (14 — **unchanged**), `game/progression.test.ts` (10 — **unchanged**), `game/engine.test.ts` retained groups (clicks, auto-rotation, full-level sweep: `clears a whole cube level, travels and rebuilds the next styled cube`) |
| Rotation settle math | `game/rotation.test.ts` (15 — **unchanged**), `scene.test.ts` `snapToQuarterTurns` group (unchanged) |
| Face destruction / fade (AC-9) | `scene.test.ts` `fades a cleared face over the pinned 400 ms…`, `…reduced 100 ms`, `does not restart a running fade` (retained), `cube-view.test.ts` (28 — **unchanged**) |
| HUD, single live region, snapshot stability | `ui/Hud.test.tsx` (3 — **unchanged**), `App.test.tsx` (4 — **unchanged**), `game/session.test.ts` (19 — only the one intro literal changed) |
| Gesture classification + front-face pick gate | `input/gestures.test.ts` (21 — **unchanged**), `render/picking.test.ts` (9 — **unchanged**) |
| Keyboard arrow rotation, W/A/S/D+Enter/Space inert, cursor removed (polish AC-6) | `input/keyboard.test.ts` (8 — **unchanged**; `:30` "Every key the removed keyboard selection cursor used to bind (spec AC-6)", `:99` the removed cursor keys produce no event), `App.test.tsx:61` (canvas `aria-label` + `touch-action:none`, no cursor), `ui/GameCanvas.test.tsx:41` (same canvas pin) — all unchanged |
| Pop animation + burst fronting (polish AC-3/4/5) | `render/particles.test.ts` (19 — **unchanged**), `scene.test.ts` `pops the exploding tile and fronts its burst…`, `follows the cube rotation when placing an explosion origin`, `hides instantly with no flash under reduced motion` (retained) |
| Reduced-motion profile values | `game/effects.test.ts` `pinned timing profiles` (150/150/0/0/100 — unchanged assertions), `engine.test.ts` reduced groups (`collapses the phases, the rotation and the explosion burst`, `travels to the next level with the reduced durations`), `scene.test.ts` `keeps the camera at rest through both flown phases under reduced motion` |
| Lifecycle / disposal / bounded drawables (AC-15/AC-16) | `scene.test.ts` `returns to the baseline object counts after 10 explosion cycles (AC-16)`, `disposes every resource exactly once and is idempotent (AC-15)`, `starfield.test.ts` `dispose` (4 → unchanged dispose assertions + new identity pins), `ui/GameCanvas.test.tsx` (2 — **unchanged**), `render/webgl.test.ts` (5 — **unchanged**) |
| Backend / real-time surface | `src/backend/src/app.test.ts` (4 — **unchanged**) + containerized smoke 4/4 |
| Bundle ≤ `BUNDLE_BUDGET_GZ_KB`, coverage bar, no new deps | § Gate 5 and 6, § Integrity (lockfile diff 0) |

## Banned matchers and DOM globals

```
$ cd src/frontend/src && FILES="game/effects.test.ts game/engine.test.ts game/session.test.ts render/scene.test.ts render/starfield.test.ts"
$ grep -nE "expect\.(anything|any|objectContaining|stringContaining|stringMatching|arrayContaining)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toMatchSnapshot|toBeTruthy|toBeDefined|not\.toThrow|toHaveBeenCalled\(\)" $FILES
BANNED_GREP_EXIT=1      # no matches

$ grep -rn "toBeCloseTo" src/frontend/src   # whole frontend, not only changed files
(none)                                      # bounded-exception budget 0 honoured

$ grep -nE "toHaveBeenCalled" $FILES
game/session.test.ts:857:    expect(listener).toHaveBeenCalledTimes(1);
game/session.test.ts:861:    expect(listener).toHaveBeenCalledTimes(2);
game/session.test.ts:868:    expect(listener).toHaveBeenCalledTimes(2);
render/scene.test.ts:738:    expect(bodyDispose).toHaveBeenCalledTimes(1);
render/scene.test.ts:967:    expect(geometryDispose).toHaveBeenCalledTimes(1);
render/scene.test.ts:968:    expect(plateDispose).toHaveBeenCalledTimes(1);
render/scene.test.ts:1007:    expect(plateDispose).toHaveBeenCalledTimes(1);
render/scene.test.ts:1048:    expect(bodyDispose).toHaveBeenCalledTimes(1);
render/scene.test.ts:1129:      expect(spy).toHaveBeenCalledTimes(1);
render/scene.test.ts:1130:      expect(spy).toHaveBeenCalledWith();
render/starfield.test.ts:333:    expect(geometryDispose).toHaveBeenCalledTimes(1);
render/starfield.test.ts:334:    expect(geometryDispose).toHaveBeenCalledWith();
render/starfield.test.ts:335:    expect(materialDispose).toHaveBeenCalledTimes(1);
render/starfield.test.ts:336:    expect(materialDispose).toHaveBeenCalledWith();
```

Every spy assertion is either an exact call count (`*Times`, the behaviour itself) or
argument-checked (`toHaveBeenCalledWith()` = the no-argument dispose).

Whole-repository sweep (`--include='*.test.ts' --include='*.test.tsx' src/`) returns **four
pre-existing matches, all in files this feature never touched** (the skill's retroactivity
rule leaves pre-existing test content alone):

```
$ grep -rnE "expect\.(anything|any)\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toMatchSnapshot|toBeTruthy|toBeDefined|not\.toThrow|toHaveBeenCalled\(\)" --include='*.test.ts' --include='*.test.tsx' src/
src/frontend/src/render/webgl.test.ts:91:    expect(threeMock.instances[1]!.setSize).not.toHaveBeenCalled();
src/frontend/src/browser-env.test.ts:203:    expect(webgl.createWebGLRenderer).not.toHaveBeenCalled();
src/frontend/src/browser-env.test.ts:223:    expect(second.window.matchMedia).not.toHaveBeenCalled();
src/frontend/src/browser-env.test.ts:313:    expect(host.observers[1]!.disconnect).not.toHaveBeenCalled();
```

`render/webgl.test.ts` and `browser-env.test.ts` are both **unchanged** by this feature
(`git diff 423004f..HEAD` does not list them); the five changed test files are clean.


```
$ cd src/frontend/src && grep -rnE "\b(document|window|requestAnimationFrame|cancelAnimationFrame|performance|localStorage|navigator|HTMLElement|Element|Event)\b" game/ --include='*.ts'
DOM_GREP_EXIT=1      # no DOM globals anywhere under game/**
```

`game/**` is DOM-free. (Pre-existing, unchanged: `game/session.ts` carries a
**type-only** `import type { PerspectiveCamera, Scene } from 'three'` in its composition-shell
position — no runtime three value is used in the pure layer; that file is untouched by this
feature.)

## T3-delegated integration re-verification — scene ↔ engine mid-travel `levelChanged`

T3's documented integration exception (build-log-T3 § Decisions) delegated the scene↔engine
coupling to T4. Two layers of evidence:

**(a) Existing integration tests (real three.js scene graph + real engine snapshots), green:**

- `scene.test.ts:714` `rebuilds the next cube once at the mid-travel levelChanged and lands at
  rest (AC-3)` — applies a `phase: 'travel', phaseProgress: 0.5, style: NEXT_STYLE,
  levelIndex: 1` snapshot, drains `{ kind: 'levelChanged', style: NEXT_STYLE }`, asserts the
  cube group is a **new** object, the old group left the scene, `bodyDispose` called **once**,
  the new body colour `1a0b0e` while the phase is `travel`, no second rebuild from the
  follow-up new-style snapshot, and then `p = 1` → camera `[0,0,12]` / scale `[1,1,1]` /
  `playing` keeps both.
- `scene.test.ts:665` `follows the symmetric camera and backdrop table at every pinned
  progress` — the full 9-row `12/21.75/51/80.25/90/80.25/51/21.75/12` +
  `[1,1,1]/[1.875…]/[4.5…]/[7.125…]/[8,8,1]/…/[1,1,1]` table with identity quaternion and the
  same `Points` identity.
- `engine.test.ts:568` `travel arrival — the level advances at the midpoint (AC-3)` (10 cases)
  pins the engine half including "phase is still `travel` when `levelChanged` drains".

**(b) Direct end-to-end check (scratch, outside the repo — not a test, not committed):**
`/tmp/opencode/t4-integration-check.ts`, run with
`cd src/frontend && npx vite-node /tmp/opencode/t4-integration-check.ts`, drives the **real**
`createEngine()` + the **real** `createSceneView()` through the session's frame order
(`engine.advance → engine.drainIntents → view.applyIntents → view.applySnapshot → view.update`)
and counts cube-group identity changes. Default timings (travel 2500 ms), only the sweep
phases collapsed (`rotationMs: 0, faceFadeMs: 0`), seeded starfield (`seeded(7)`):

```
TRAVEL_STARTED {"phase":"travel","levelIndex":0,"rebuilds":0,"cameraZ":12}
AT_1249 {"phase":"travel","levelIndex":0,"rebuilds":0,"cameraZ":89.99990016}
AT_1250 {"phase":"travel","levelIndex":1,"styleId":"crimson-alloy","rebuilds":1,"levelChangedFrame":{"label":"travel-1250","enginePhase":"travel","phaseProgress":0.5,"levelIndex":1,"styleId":"crimson-alloy","cameraZ":90,"cameraPosition":[0,0,90],"starfieldScale":[8,8,1],"intents":["levelChanged"]}}
AT_PLAYING {"phase":"playing","levelIndex":1,"rebuilds":1,"cameraPosition":[0,0,12],"cameraQuaternion":[0,0,0,1],"starfieldScale":[1,1,1],"starfieldPosition":[0,0,12]}
AFTER_PLAYING {"rebuilds":1,"phase":"playing","cameraPosition":[0,0,12],"starfieldScale":[1,1,1],"quaternion":[0,0,0.026402266096295514,0.999651399411305]}
INTEGRATION_EXIT=0
```

Reading of the run, point by point (the T4 brief's three questions):

1. **Re-build happens while the phase is `travel`** — `levelChangedFrame.enginePhase =
   "travel"`, `phaseProgress = 0.5`, `levelIndex = 1`, `styleId = "crimson-alloy"`.
2. **Exactly once** — `rebuilds = 1` at 1250 ms, still `1` at `playing` and after 60 further
   16 ms frames; the follow-up new-style snapshot triggers no second rebuild.
3. **Camera lands at rest with the backdrop at rest** — `AT_PLAYING`: camera
   `[0,0,12]`, quaternion `[0,0,0,1]` (identity), starfield scale `[1,1,1]`, starfield anchored
   at `[0,0,12]`; the swirl keeps accumulating (`z ≈ 0.0264`), i.e. the ambient drift survives
   the landing.

The turn-around frame shows the new cube already built while the camera is 90 units out and
the backdrop at `(8,8,1)` — the "no pop at the rest pose" property holds end-to-end.

## T2 carry-forward — seeded density fixtures and the r1 negative evidence

Confirmed **asserted in the committed tests** (not just described in a build log):

| Carry-forward | Assertion location | Asserted value |
| --- | --- | --- |
| Sustained-pose density, seed 7, 16:9, 4×4 NDC cells | `render/scene.test.ts:625,639,640,642` | `SUSTAINED_CELLS = [14,14,16,15,28,28,23,16,19,14,15,16,18,19,29,18]`, `expect(cells).toEqual(SUSTAINED_CELLS)`, `expect(total).toBe(302)`, every cell `≥ 5` (min cell **14**, floor 5) |
| Scale-8 turn-around density | `render/scene.test.ts:658,659` | `expect(total).toBe(5)`, `expect(total).toBeGreaterThanOrEqual(2)` (floor 2), exact cells `[0,1,0,0,1,1,1,0,0,0,1,0,0,0,0,0]` |
| r1 negative evidence (rectangle fails at swirl π/4) | `render/scene.test.ts:610` in-test comment next to the corrected assertion | "inverse-rotated \|v\| reached **1.0991** at 7/3 / swirl π/4 against **TAN_Y = 0.5363**" — kept as the documented pre-fix failure |
| Square-cone contract constants | `render/starfield.test.ts:95,96` | `[STARFIELD_DEPTH_NEAR, STARFIELD_DEPTH_FAR] = [20, 160]`, `STARFIELD_TAN === 1.251258882715913` |
| Swing tables (single source for camera + scale) | `game/effects.test.ts:104,132,138,139,155,162` | `TRAVEL_LEVEL_ADVANCE_P === 0.5`; swing `0/0.125/0.5/0.875/1/0.875/0.5/0.125/0`; camera `12/21.75/51/80.25/90/…/12`; scale `1/1.875/4.5/7.125/8/…/1` |

The peak measurement (5) sits exactly on the spec's expected ≈ 5 and above the floor 2, and
the sustained minimum (14) is well above the floor 5 — no blocked-with-measurement path was
needed.

## Manual visual pass (spec § Manual visual pass — **not an AC**)

Environment: **no browser is available in the builder sandbox**
(`which google-chrome chromium chromium-browser firefox` → all absent; no
`playwright`/`puppeteer` dependency, and browser automation is an explicit non-goal). The
dev stack itself was up (`podman compose ps`: frontend `127.0.0.1:5173->5173` up 16 h) and the
containerized smoke hit it (`PASS frontend http://frontend:5173/ responds 200`), but a
response code is not a visual pass, so every step is recorded honestly as **not executed**.

| # | Step (spec r2) | Outcome |
| --- | --- | --- |
| 1 | Backdrop fills the whole viewport incl. the right edge at rest/intro/travel; resize across widescreen/16:9/portrait, ≥ 60 s — no side or corner starless | **not executed — environment** (no browser). Nearest automated evidence: `scene.test.ts` corner-ray coverage at 4 poses × 3 aspects × swirls 0 and π/4 incl. scale-8, and the swirl-rate test |
| 2 | Intro: cube visible and centred from the first frame; smooth straight approach; skip hint; click/key skips to `playing` | **not executed — environment**. Nearest: `scene.test.ts` pose table + framing gates (all 8 corners, 5 p × 3 aspects) + skip-to-rest; `session.test.ts` first-frame `[0,0,60]` |
| 3 | Click a mini-cube → pop + subtle flash, shrink away, burst in front of the cube, `Clicks` +1 immediately | **not executed — environment**. Nearest: `scene.test.ts` `pops the exploding tile and fronts its burst…` |
| 4 | Click a mini-cube on a partially visible non-front face → nothing | **not executed — environment**. Nearest: `picking.test.ts` (9) + `gestures.test.ts` (21) |
| 5 | Drag > 40 px → one 90° step; touch drag does not scroll | **not executed — environment**. Nearest: `gestures.test.ts` |
| 6 | Arrow keys rotate; W/A/S/D and Enter/Space inert; no highlight anywhere; canvas focus ring shows | **not executed — environment**. Nearest: `input/keyboard.test.ts` (cursor keys inert) + `App.test.tsx:61` / `ui/GameCanvas.test.tsx:41` (canvas `aria-label`, `tabindex="0"`, no cursor style) |
| 7 | Clear a whole face → plate fades, `Faces destroyed` +1, remaining faces playable | **not executed — environment**. Nearest: `scene.test.ts` fade group + `engine.test.ts` face-clear group |
| 8 | Clear all six faces → galaxy visibly expands, camera pulls back, next cube appears far away at the turn-around, camera flies back in, `Cube 2` during the fly-in, continuous landing, stats carried | **not executed — environment**. Nearest: the T4 integration check above (rebuild at z = 90, scale `(8,8,1)`, landing `(0,0,12)`/`(1,1,1)` at `playing`, stats carried `{clicks:150, facesDestroyed:6}` in `engine.test.ts`) |
| 9 | OS reduced motion → short intro/travel, no flights, no expansion, instant level swap, instant hide, no bursts, instant rotation | **not executed — environment**. Nearest: `engine.test.ts` reduced groups + `scene.test.ts` reduced camera/scale group + `effects.test.ts` reduced profile pins |
| 10 | Touch device / devtools touch emulation → tap explodes (with pop), drag rotates, no page scroll/zoom | **not executed — environment**. Nearest: `gestures.test.ts` (unchanged) |

**Recommendation:** the orchestrator/user must run steps 1–10 in a real browser (the stack is
up at `http://localhost:5173`) before the feature is marked accepted; steps 1, 2 and 8 are
the defect fixes and deserve the most attention.

## Known residuals (explicit, all pre-existing unless stated)

| Residual | Where | Status in this run |
| --- | --- | --- |
| Thin `GameCanvas.tsx` effect body (unexecuted under the node test environment — it only runs in a real browser mount) | `src/ui/GameCanvas.tsx` 61.9 % stmts/lines, lines 23–30 | 61.9/100/100/61.9; `src/ui` directory 79.48 — pre-existing and **not** below the gate because the gate is the workspace aggregate (99.31 ≥ 80). No exclusion added. |
| `WebGLRenderer` is mocked in tests (no real GL context in node) | `src/render/webgl.test.ts` (5 tests) | unchanged; the real renderer is only exercised in a browser |
| `ws/connection.ts` uncovered branches | `src/ws/connection.ts:53–54, 99–100` (95.34 / 92.59 / 100 / 95.34) | unchanged, scaffold code, untouched by this feature (`ws/**` diff empty) |
| `session.ts` uncovered branch | `src/game/session.ts:173` (branch 98.18) | unchanged, untouched by this feature |
| **Correction to the brief's residual list:** `picking.ts` uncovered lines | `src/render/picking.ts` | **none in the current tree — 100/100/100/100.** The accepted feature's status note mentioned `picking.ts:88–89`; that residual is closed (already 100 % in build-log-T2's run). Not a regression. |
| Vite >500 kB chunk advisory (uncompressed 771.46 kB) | build output | informational only; gzip 209.38 kB is inside the 350 kB budget |
| 4 npm advisories (2 moderate / 2 critical) in pre-existing dev tooling | `npm ci` output | unchanged by this feature (lockfile diff empty); out of scope |
| 4 pre-existing banned-matcher forms (`not.toHaveBeenCalled()`) | `render/webgl.test.ts:91`, `browser-env.test.ts:203,223,313` | unchanged files, not introduced or touched by this feature; the retroactivity rule keeps them out of scope. The five changed test files are clean. |

## Drift flags

1. **Pre-existing working-tree docs drift (not introduced by this feature, outside T4's
   `files_owned`):** `docs/features/README.md` and
   `docs/features/cube-game-frontend/status.md` are **modified but uncommitted**, and the
   accepted feature's `spec.md`/`plan.md`/`tasks.md`/`status.md`/`reviews/` plus this
   feature's `plan.md`/`spec.md`/`tasks.md`/`status.md`/`reviews/` are **untracked**. Both
   predate the T1 commit (mtimes above). Consequence for AC-4's "`git diff` on
   `docs/features/cube-game-frontend/**` and `docs/features/cube-visual-polish/**` must be
   empty": the **feature range (`423004f..HEAD`) is empty for those paths** (verified above),
   and every tracked file under them is byte-identical; the working-tree edits are the
   planner/orchestrator's own artifacts and were **not** made by T1–T4. They are left
   untouched by T4; committing them is a planning-phase decision outside this task's write
   scope. **Flagged for the orchestrator, not papered over.**
2. No other drift found: source diff, test diff, spec/plan/tasks content (untouchable by T4),
   configs, container assets and both accepted features' tracked files all match the
   supersession ledger.

## Per-AC table

| AC | Verdict | Evidence |
| --- | --- | --- |
| **AC-1 — backdrop fills the viewport in every phase** | **met** | Square-cone bounds per star + contract constants: `render/starfield.test.ts:78–96` (depths `[20,160]`, `|x|/depth`, `|y|/depth ≤ 1.251258882715913`, literal pin at line 96). Corner-ray coverage against the **real** `PerspectiveCamera` at 4 poses (rest `(0,0,12)`, intro `(0,0,60)`, intro mid `(0,0,18)`, turn-around `(0,0,90)` with scale 8) × 3 aspects (`2/3`, `16/9`, `7/3`) × swirls `0`, `π/4`: `render/scene.test.ts:586`. Density: 302 total / min cell 14 (floor 5) at the 4 sustained poses, exact cells pinned (`scene.test.ts:621`); scale-8 peak 5 (floor 2) (`scene.test.ts:647`). Swirl: exact composed quaternion after `update(1000)`, `update(0)`/`update(-1000)` no-advance, world-identity fallback, anchor copy/compose (`starfield.test.ts:163–250`). Never rebuilt (same `Points`): `starfield.test.ts` + `scene.test.ts:767`. Reduced motion: scale `(1,1,1)` at travel p = 0.5 with the swirl still turning (`scene.test.ts:569`). Production coverage: `starfield.ts` and `scene.ts` 100/100/100/100 (§ Gate 5). Negative evidence (r1 rectangle) retained at `scene.test.ts:610`. Commands: `npm test` (291 green), `npm run coverage` (exit 0). |
| **AC-2 — intro points at the cube from the first frame, approaches to rest** | **met** | 5-row pose table with exact literals `[0,0,60] / [0,0,32.25] / [0,0,18] / [0,0,12.75] / [0,0,12]`, target `[0,0,0]` (`scene.test.ts:432`), through `applySnapshot` (`scene.test.ts:529`); clamping (`:444`); strict monotonic sweep `{0, 0.1, …, 1}` (`:457`); framing gates — all eight cube corners inside the real frustum at `p ∈ {0,0.25,0.5,0.75,1}` × aspects `{2/3,16/9,7/3}` and the cube centre on the view axis (`:475`); skip → rest immediately (`:539`); reduced motion at rest at every p (`:550`); `INTRO_DURATION_MS` 2500 and the skip wiring unchanged (`effects.test.ts:46` timing-profile group; `engine.test.ts` skip tests); `session.test.ts` first-frame literal re-pinned to `[0,0,60]` (only that block changed). |
| **AC-3 — arrival: depart, next cube at the turn-around, fly in, land at rest** | **met** | *Pure math:* `travelSwing` table/clamping/monotonic halves and `TRAVEL_LEVEL_ADVANCE_P === 0.5` (`effects.test.ts:104,127–166`); derived camera and scale tables (`:155,:162`). *Engine:* `engine.test.ts:568` (10 cases) — 1249 nothing / +1 → one `levelChanged` (next style `crimson-alloy`) while `phase` is still `travel`, `levelIndex +1`, fresh 25-per-face board, default orientation, stats `{150,6}`, input gated in the arrival half; +1250 → `playing`, no second intent; single `advance(2500)` advance-then-switch; reduced 74 / 1 / 75; once-only firing; zero-midpoint arm; `travelStarted` once; `dtMs ≤ 0` no-op. *Scene:* symmetric camera/scale table with identity quaternion and same `Points` (`scene.test.ts:665`); mid-travel rebuild once + landing `(0,0,12)` / `(1,1,1)` (`:714`); reduced motion at rest with scale `(1,1,1)` (`:550`). *Integrated:* T4's engine+scene frame-loop check — rebuild while `travel` at `cameraZ = 90` / scale `(8,8,1)`, exactly one rebuild, landing `[0,0,12]` + `[1,1,1]` at `playing` (§ T3-delegated). |
| **AC-4 — supersession ledger and regression gate** | **met** | Only the six named behaviors changed (§ Supersession ledger, with the removed-line audit). Retained ACs evidenced by the 16 unchanged test files (§ Retained accepted behaviors) — 156 of the 291 frontend tests plus the 4 backend tests run in files this feature never touched. `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (backend 100×4; frontend 99.31/99.36/100/99.31), `npm run build` (initial JS gzip **209.38 kB ≤ 350 kB**), `npm run smoke` (4/4) all exit 0. `git diff` on container paths / `main.tsx` / `index.html` / `ws/**` / all configs / `src/backend/**` / `tests/` / `docs/features/cube-game-frontend/**` / `docs/features/cube-visual-polish/**` → **empty**; lockfile diff 0 (`three 0.186.1`, named imports only); no `.env*`; banned-matcher grep → no matches in the five changed test files (the whole frontend has zero `toBeCloseTo`; four pre-existing `not.toHaveBeenCalled()` remain in the untouched `webgl.test.ts:91` / `browser-env.test.ts:203,223,313`, left alone per the retroactivity rule); DOM-globals grep under `game/**` → none. Caveat recorded: the pre-existing **uncommitted** docs drift in § Drift flags (predates T1, untouched by this feature). Note: AC-4's "no banned matchers anywhere" holds for every file this feature touched; four pre-existing `not.toHaveBeenCalled()` occurrences in `webgl.test.ts`/`browser-env.test.ts` exist in the baseline and are unchanged (retroactivity rule — noted, not hidden). |

**No AC is unmet. No declared behavior is unverified at the test/command layer.** The only
non-executed item is the manual visual pass, which the spec explicitly declares *not an AC*.

## Deviations from spec

None. T4 is verification-only: the sole file written by this task is this build log.

## Commit

Staged explicitly (`git add <path>`, never `-A`/`.`), then:

```
$ git commit --only docs/features/cube-visual-polish-followup/build-log-T4.md \
    -m "docs: record T4 verification pass for cube-visual-polish-followup (T4)"
[main 56f8920] docs: record T4 verification pass for cube-visual-polish-followup (T4)
 1 file changed, 617 insertions(+)
 create mode 100644 docs/features/cube-visual-polish-followup/build-log-T4.md

$ git show --stat --oneline HEAD
56f8920 docs: record T4 verification pass for cube-visual-polish-followup (T4)
 .../cube-visual-polish-followup/build-log-T4.md    | 617 +++++++++++++++++++++
 1 file changed, 617 insertions(+)
```

The commit was then amended once (`git commit --amend --only <this path> --no-edit`) to fold
in this § Commit section; the final commit is the tip of `main` with the same message, one
file changed, no other path touched. Verify with `git log --oneline -1` /
`git show --stat HEAD` (the hash necessarily changes when this section itself is amended in).

One file, this build log only. The pre-existing working-tree docs drift (§ Drift flags) was
**not** staged and remains uncommitted. Never pushed.
