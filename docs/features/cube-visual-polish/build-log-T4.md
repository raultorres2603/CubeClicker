# Build log — T4 — Verify & integrate

Task: T4 (2026-10-21) — verification-only gate; no source, test, spec, plan, tasks, status or predecessor changes.
Files changed by this task: `docs/features/cube-visual-polish/build-log-T4.md` (only).

**Baseline ref for every integrity comparison: `76e9ea5`** — `First version of cube clicker`, the direct parent of T1's
commit `4d786b4` (`git rev-parse 4d786b4^` = `76e9ea56c1f09a4b3b80f608a1c81798ea99ad88`). Verified tree:
`4d786b4` (T1) → `5804730` (T2) → `b6f71e6` (T3, HEAD). The feature diff is therefore exactly
`git diff 76e9ea5..HEAD`, and the T4 working tree is compared against `b6f71e6`. (Every command below ran with
`HEAD = b6f71e6`; this log file is the only addition afterwards.)

Sketch (≤5 lines):
1. Run `npm ci` → lint → typecheck → test → coverage → build on the clean tree; record raw output.
2. Diff the protected paths (container, `main.tsx`, `ws/**`, configs, predecessor artifacts) over the feature range.
3. Grep changed test files for banned matchers; grep `game/**` for DOM globals; re-run the cursor/highlight/streak greps.
4. Map every AC-1…AC-7 to its landed test/command; confirm the supersession ledger and the retained predecessor ACs.
5. Record the manual visual pass (not executable here — no browser), residuals and carried deviations; commit only the log.

Environment: Node v24.22.0, npm 11.19.1, Podman 5.8.7 with Docker Compose v5.6.0 provider. Local stack up
(`cubeclicker-frontend-1 Up 15 hours (healthy) 127.0.0.1:5173->5173/tcp`, `cubeclicker-backend-1 Up 15 hours (healthy) 127.0.0.1:8080->8080/tcp`).

---

## 1. Full gate

### 1.1 `npm ci` → exit 0

```
$ npm ci
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update.
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 333 packages, and audited 336 packages in 2s

92 packages are looking for funding
  run `npm fund` for details

4 vulnerabilities (2 moderate, 2 critical)

To address all issues (including breaking changes), run:
  npm audit fix --force
```

Exit 0. `package-lock.json` unchanged (`git status` shows no lockfile modification); the 4 advisories are the
pre-existing Vitest/esbuild dev-tooling set recorded in the predecessor status.

### 1.2 `npm run lint` → exit 0

```
> lint
> eslint .
```

### 1.3 `npm run typecheck` → exit 0 (both workspaces)

```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
```

### 1.4 `npm test` → exit 0 (both workspaces)

```
> test
> npm run test --workspaces --if-present

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
 ✓ src/app.test.ts (4 tests) 93ms
 Test Files  1 passed (1)
      Tests  4 passed (4)

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
 ✓ src/ui/theme.test.ts (2 tests) 2ms
 ✓ src/game/progression.test.ts (10 tests) 9ms
 ✓ src/render/webgl.test.ts (5 tests) 11ms
 ✓ src/browser-env.test.ts (6 tests) 16ms
 ✓ src/game/effects.test.ts (23 tests) 11ms
 ✓ src/game/rotation.test.ts (15 tests) 10ms
 ✓ src/game/board.test.ts (14 tests) 17ms
 ✓ src/ws/connection.test.ts (10 tests) 18ms
 ✓ src/input/gestures.test.ts (21 tests) 9ms
 ✓ src/input/keyboard.test.ts (8 tests) 6ms
 ✓ src/game/engine.test.ts (28 tests) 21ms
 ✓ src/ui/Hud.test.tsx (3 tests) 12ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 10ms
 ✓ src/render/starfield.test.ts (12 tests) 20ms
 ✓ src/render/particles.test.ts (19 tests) 20ms
 ✓ src/render/picking.test.ts (9 tests) 18ms
 ✓ src/render/cube-view.test.ts (28 tests) 35ms
 ✓ src/App.test.tsx (4 tests) 14ms
 ✓ src/game/session.test.ts (19 tests) 66ms
 ✓ src/render/scene.test.ts (31 tests) 79ms
 Test Files  20 passed (20)
      Tests  269 passed (269)
```

Totals: backend 1 file / 4 tests; frontend 20 files / 269 tests → **21 files / 273 tests, all green**.

**Every changed test file is listed in that transcript** (12 files, feature range `76e9ea5..HEAD`):

| Changed test file | Tests |
| --- | --- |
| `src/frontend/src/App.test.tsx` | 4 |
| `src/frontend/src/game/effects.test.ts` | 23 |
| `src/frontend/src/game/engine.test.ts` | 28 |
| `src/frontend/src/game/rotation.test.ts` | 15 |
| `src/frontend/src/game/session.test.ts` | 19 |
| `src/frontend/src/input/keyboard.test.ts` | 8 |
| `src/frontend/src/render/cube-view.test.ts` | 28 |
| `src/frontend/src/render/particles.test.ts` | 19 |
| `src/frontend/src/render/picking.test.ts` | 9 |
| `src/frontend/src/render/scene.test.ts` | 31 |
| `src/frontend/src/render/starfield.test.ts` | 12 |
| `src/frontend/src/ui/GameCanvas.test.tsx` | 2 |

Unchanged test files (retained predecessor coverage, passing unmodified): `board` (14), `progression` (10),
`gestures` (21), `Hud` (3), `theme` (2), `webgl` (5), `connection` (10), `browser-env` (6) + backend `app` (4).

### 1.5 `npm run coverage` → exit 0, both workspaces ≥ 80 on all four metrics

```
> coverage
> npm run coverage --workspaces --if-present

 RUN  v3.2.7 .../src/backend   Coverage enabled with v8
 ✓ src/app.test.ts (4 tests) 103ms
 Test Files  1 passed (1)
      Tests  4 passed (4)

 % Coverage report from v8
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------|---------|----------|---------|---------|-------------------
All files |     100 |      100 |     100 |     100 |
 app.ts   |     100 |      100 |     100 |     100 |
----------|---------|----------|---------|---------|-------------------

 RUN  v3.2.7 .../src/frontend   Coverage enabled with v8
 ✓ src/ui/theme.test.ts (2 tests)
 ✓ src/game/effects.test.ts (23 tests)
 ✓ src/ws/connection.test.ts (10 tests)
 ✓ src/game/rotation.test.ts (15 tests)
 ✓ src/render/webgl.test.ts (5 tests)
 ✓ src/browser-env.test.ts (6 tests)
 ✓ src/game/board.test.ts (14 tests)
 ✓ src/game/progression.test.ts (10 tests)
 ✓ src/render/particles.test.ts (19 tests)
 ✓ src/render/starfield.test.ts (12 tests)
 ✓ src/game/engine.test.ts (28 tests)
 ✓ src/input/keyboard.test.ts (8 tests)
 ✓ src/input/gestures.test.ts (21 tests)
 ✓ src/ui/Hud.test.tsx (3 tests)
 ✓ src/ui/GameCanvas.test.tsx (2 tests)
 ✓ src/render/cube-view.test.ts (28 tests)
 ✓ src/render/picking.test.ts (9 tests)
 ✓ src/game/session.test.ts (19 tests)
 ✓ src/App.test.tsx (4 tests)
 ✓ src/render/scene.test.ts (31 tests)
 Test Files  20 passed (20)
      Tests  269 passed (269)

 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.31 |    99.36 |     100 |   99.31 |
 src             |     100 |      100 |     100 |     100 |
  App.tsx        |     100 |      100 |     100 |     100 |
  browser-env.ts |     100 |      100 |     100 |     100 |
 src/game        |     100 |    99.58 |     100 |     100 |
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

**Per-workspace totals (the gate):**

| Workspace | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| `@cubeclicker/backend` | 100 | 100 | 100 | 100 |
| `@cubeclicker/frontend` | 99.31 | 99.36 | 100 | 99.31 |

All eight numbers ≥ 80. No exclusion added, no threshold changed (`vitest.config.ts` untouched by the feature).

### 1.6 `npm run build` → exit 0, gzip initial JS within budget

```
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
dist/assets/index-6ujYOokL.js   771.43 kB │ gzip: 209.49 kB

(!) Some chunks are larger than 500 kB after minification. ...
✓ built in 1.26s
```

Recorded sizes: HTML 0.40 kB (gzip 0.27), CSS 1.32 kB (gzip 0.63), initial JS **771.43 kB (gzip 209.49)**.
`BUNDLE_BUDGET_GZ_KB` = 350 (predecessor spec, line 86): **209.49 kB ≤ 350 kB — AC-20 holds**. The 500 kB Vite
warning is the uncompressed chunk (predecessor T15 already documented it as informational; gzip is the budget).
Named `three` imports only, pinned versions (`npm ls three @types/three`):

```
└─┬ @cubeclicker/frontend@ -> ./src/frontend
  ├── @types/three@0.186.0
  └── three@0.186.1
```

`grep -rn "import \* as" src/frontend/src` → no matches (exit 1); the seven `from 'three'` sites are all named imports.

### 1.7 `npm run smoke` → exit 0 (executed — environment allows it)

```
> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

 Container cubeclicker-backend-1 Running
 Container cubeclicker-frontend-1 Running
 Container cubeclicker-smoke-run-57b2d79d083b Creating
 Container cubeclicker-smoke-run-57b2d79d083b Created
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
SMOKE PASS (4/4 checks)
```

Containerized cross-service e2e green incl. two WebSocket clients on `/ws` — AC-21's optional regression check.

---

## 2. Integrity vs the T4 baseline (`76e9ea5`; working tree vs `b6f71e6`)

### 2.1 Protected paths — feature range and working tree both clean

```
$ PATHS="compose.yaml compose.smoke.yaml .dockerignore src/backend/Dockerfile src/frontend/Dockerfile \
  src/frontend/index.html src/frontend/src/main.tsx src/frontend/src/ws src/frontend/vite.config.ts \
  src/frontend/vitest.config.ts src/frontend/tsconfig.json src/frontend/package.json src/backend/package.json \
  src/backend/tsconfig.json tsconfig.json eslint.config.mjs package.json package-lock.json tests README.md \
  docs/product/glossary.md docs/features/cube-game-frontend/spec.md docs/features/cube-game-frontend/plan.md \
  docs/features/cube-game-frontend/tasks.md docs/features/cube-game-frontend/reviews"
feature-range diff stat lines: 0
feature-range diff lines: 0
working-tree diff stat lines: 0
untracked in protected set: 0
```

- `git diff --stat 76e9ea5..HEAD -- <protected>` → **empty** (container assets, Dockerfiles, `.dockerignore`,
  `index.html`, `main.tsx`, `ws/**`, all configs, both `package.json`s, lockfile, `tests/`, `README.md`,
  glossary, predecessor spec/plan/tasks/reviews byte-identical across T1–T3).
- `git diff -- <protected>` (working tree) → **empty**.
- Lockfile/deps: `git diff --stat 76e9ea5..HEAD -- package-lock.json src/frontend/package.json src/backend/package.json` → empty (no dependency added).

### 2.2 Flagged exception — predecessor `status.md` in the working tree (pre-existing, not from this feature)

```
$ git diff -- docs/features/cube-game-frontend/status.md
-  - Manual browser visual pass not executed (environment): recommend `podman compose up` + the game shell checklist before merge/next feature.
+  - Manual browser visual pass executed 2026-10-20 (user, local stack): issues found — travel backdrop doesn't expand; explosion particles render behind the clicked mini-cube; plus design changes requested (intro search/find cinematic, pop-then-shrink click animation, remove cursor highlight) → follow-up feature `cube-visual-polish` opened.
```

One workflow-note line in the predecessor's **status** file (the orchestrator's note that opened this feature).
It is **not** in the feature range (`git diff 76e9ea5..HEAD -- docs/features/cube-game-frontend` is empty), its
mtime `2026-10-20 17:54` predates T1's commit (`2026-10-20 18:22`), and T1/T3 both recorded it as pre-existing.
It is not a behaviour/spec artifact and T4 does not stage it. Recorded here as drift-on-disk, not a defect.

Also untracked (outside this feature's commits, owned by planning/orchestration, not touched):
`docs/features/cube-visual-polish/{spec.md,plan.md,tasks.md,status.md,reviews/}`.

### 2.3 Feature diff shape (`git diff --stat 76e9ea5..HEAD`, excluding untracked planning docs)

```
 docs/features/cube-visual-polish/build-log-T1.md |  81 +++++
 docs/features/cube-visual-polish/build-log-T2.md | 255 +++++++++++++++
 docs/features/cube-visual-polish/build-log-T3.md | 307 ++++++++++++++++++
 src/frontend/src/App.test.tsx                    |   3 +-
 src/frontend/src/game/effects.test.ts            |  43 +++
 src/frontend/src/game/effects.ts                 |  74 +++-
 src/frontend/src/game/engine.test.ts             | 114 +------
 src/frontend/src/game/engine.ts                  |  67 +---
 src/frontend/src/game/rotation.test.ts           | 267 +-------------
 src/frontend/src/game/rotation.ts                |  79 +----
 src/frontend/src/game/session.test.ts            |  15 +-
 src/frontend/src/input/keyboard.test.ts          |  87 +---
 src/frontend/src/input/keyboard.ts               |  29 +-
 src/frontend/src/render/cube-view.test.ts        | 384 ++++++++++++++-------
 src/frontend/src/render/cube-view.ts             | 219 +++++++-----
 src/frontend/src/render/particles.test.ts        |  10 +-
 src/frontend/src/render/particles.ts             |  16 +
 src/frontend/src/render/picking.test.ts          |  24 +-
 src/frontend/src/render/picking.ts               |  11 +-
 src/frontend/src/render/scene.test.ts            | 367 +++++++++++++++++-----
 src/frontend/src/render/scene.ts                 | 228 +++++++++++---
 src/frontend/src/render/starfield.test.ts        |  52 ++-
 src/frontend/src/render/starfield.ts             |  38 +--
 src/frontend/src/ui/GameCanvas.test.tsx          |   2 +-
 src/frontend/src/ui/GameCanvas.tsx                |   2 +-
 25 files changed, 1789 insertions(+), 985 deletions(-)
```

Only the spec's in-scope frontend files changed. `Hud.tsx`, `App.tsx`, `theme.ts`, `gestures.ts`, `webgl.ts`,
`session.ts`, `board/progression/types.ts`, `browser-env.ts` and `ws/**` are absent from the diff (unchanged).

---

## 3. Greps

### 3.1 Banned matchers over all 12 changed test files → no matches

```
$ grep -nE "toBeCloseTo|expect\.anything|expect\.any\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toMatchSnapshot|toHaveBeenCalled\(\)" \
    src/frontend/src/App.test.tsx src/frontend/src/game/effects.test.ts src/frontend/src/game/engine.test.ts \
    src/frontend/src/game/rotation.test.ts src/frontend/src/game/session.test.ts src/frontend/src/input/keyboard.test.ts \
    src/frontend/src/render/cube-view.test.ts src/frontend/src/render/particles.test.ts src/frontend/src/render/picking.test.ts \
    src/frontend/src/render/scene.test.ts src/frontend/src/render/starfield.test.ts src/frontend/src/ui/GameCanvas.test.tsx
BANNED_GREP_EXIT=1
```

No matches (exit 1). Bounded-exception budget stayed **0** across T1–T3 (no `toBeCloseTo` either).

### 3.2 DOM globals under `src/frontend/src/game/**` → none

```
$ grep -rnE "\b(window|document|navigator|HTMLElement|requestAnimationFrame|cancelAnimationFrame|localStorage|sessionStorage)\b" src/frontend/src/game/
DOM_GREP_EXIT=1
```

### 3.3 Cursor/highlight fully removed from production code; no streak wording left

```
$ grep -rin "cursor\|highlight" src/frontend/src --include="*.ts" --include="*.tsx" | grep -v "\.test\."
PROD_GREP_EXIT=1

$ grep -rin "streak" src/frontend/src/render/
STREAK_GREP_EXIT=1
```

Both empty. (`picking.ts`/`scene.ts`/`cube-view.ts`/`starfield.ts` module docs are clean; T3 removed the last
`game/**`, `input/**`, `ui/**` references.)

---

## 4. Per-AC evidence table (AC-1 … AC-7)

| AC | Verdict | Evidence (landed test / command, with location) |
| --- | --- | --- |
| **AC-1 — Travel backdrop expansion** | **met** | `effects.test.ts:93` (`TRAVEL_STARFIELD_SCALE === 8`); `starfield.test.ts:167-191` — real `Points` scale `[1,1,1]@0`, `[1.875,1.875,1]@0.25`, `[4.5,4.5,1]@0.5`, `[7.125,7.125,1]@0.75`, `[8,8,1]@1` (z stays 1); clamp both ends; same-`Points` identity + unchanged drift (`rotation.y === 0.030517578125`); `scene.test.ts:504-533` — same five rows through `applySnapshot` + `update`, expansion persisted across progress-less frames, and reduced motion `[1,1,1]` (`scene.test.ts:478-480`). |
| **AC-2 — Intro search → find → approach** | **met** | `scene.test.ts:264-280` — `INTRO_POSES`, all 7 rows position+target (p=0.56 documented as the f64-exact row); `:359` pose table through `applySnapshot`; identity quaternion `[0,0,0,1]` at p=0.72/0.86/1 (`:420`) and after skip (`:461`); real `Frustum` gates `:424-450` (box non-intersecting at p=0/0.2/0.4, centre inside at 0.56, eight corners inside at 0.72); skip → rest `:452-460`; reduced → rest at every p `:464-482`; travel pull-away unchanged `(0,0,21.75)@0.25`, `(0,0,51)@0.5`, `(0,0,90)@1` (`:484-501`). |
| **AC-3 — Burst in front of the clicked mini-cube** | **met** | `particles.test.ts:125-129` — `depthWrite === false`, `depthTest === false`, `renderOrder === 10`; `scene.test.ts:643-644` front face spawn `[-2, 2, 3.125]`, `:657` `+1` yaw `[3.125, 2, 2]`, `:673` gone-face fallback `[0,0,0]`; `snapToQuarterTurns` suite (1e-9 snap, `-0` normalised, in-between untouched); existing pool cap/recycle/release tests green. |
| **AC-4 — Pop-then-shrink with bounded colour flash** | **met** | `effects.test.ts:93-98` (six constants), `:131` `popScaleAt` `[1,1.05,1.1,0.55,0,0]`, `:143-150` `popColorMultiplierAt` `[1,1.15,1.3,1.15,1,1]`; `cube-view.test.ts:213-226` idle `instanceColor (1,1,1)`; `:375-402` real matrices `Math.fround(0.9×f)` / `Math.fround(0.25×f)` + colour slots at t=50/100/130; `:405-414` t=160 zero scale, colour 1, position `[-2, 2, TILE_DISTANCE]`, record gone; `scene.test.ts:676-691` reduced motion instant hide, no flash/record; `scene.test.ts:693-704` live settle. Click path synchronous/unchanged: `git diff 76e9ea5..HEAD -- src/frontend/src/game/engine.ts` removes only cursor code (`reanchor`, `cursorId`, `sameCursor`, `moveCursorBy`, events, snapshot field); `engine.test.ts` click group lost only `snapshot.cursor` assertions (diff hunks at `@@ -205`, `@@ -224`) — `clicks +1`, one `explosion` intent, repeat no-op, `EXPLOSION_DURATION_MS` lifetime all still asserted. |
| **AC-5 — Pop interactions & bounded resources** | **met** | `cube-view.test.ts` — "never restarts a running pop when the same id is hidden again", "runs independent records 60 ms apart, side by side", "cancels that face's pop records and keeps the others running", "dispose … clears running pop records", "leaves every other instance and face untouched", child list `toHaveLength(13)` + exact order (`:182-190`), no new drawables; `scene.test.ts:842` "returns to the baseline object counts after 10 explosion cycles (AC-16)". |
| **AC-6 — Keyboard selection cursor removed (Option B)** | **met** | `rotation.test.ts` has no cursor group and `frontFace` six-face reachability stays; `engine.ts` `GameEvent` = `introSkip|explodeMiniCube|rotate`, no `cursor` in `EngineSnapshot` (typecheck enforces); `keyboard.test.ts:8` tests incl. "maps the removed WASD, Enter and space keys to no command at all (AC-6)" and the map→dispatch integration test (ten keys leave the snapshot referentially identical); `cube-view.ts` child list 13 (no highlight); `GameCanvas.tsx:37` pinned label; exact-string pins in `GameCanvas.test.tsx:14` and `App.test.tsx:22` (both pass); greps § 3.3; HUD/live region untouched (`Hud.tsx`/`App.tsx` not in the feature diff). |
| **AC-7 — Supersession ledger & regression gate** | **met** | § 1 gates all exit 0 (lint/typecheck/test/coverage both workspaces/build); § 2 protected-path diffs empty; § 3 greps clean; § 5 ledger + retained-AC table; bundle 209.49 ≤ 350 kB. |

No AC is unmet. No drift found except the pre-existing predecessor `status.md` working-tree line (§ 2.2), which
is outside the feature range and outside T4's `files_owned`.

---

## 5. Supersession ledger confirmation

Exactly the five named predecessor behaviours changed — nothing else:

| Predecessor AC | What changed | Where | Retained |
| --- | --- | --- | --- |
| **AC-3** travel visual | z-elongation streak → uniform x/y `1→8` `easeInOutQuad` | `starfield.ts`/`starfield.test.ts` (AC-1 rows) | black bg, one `Points`, `STAR_COUNT`, seeded layout, drift, never rebuilt |
| **AC-5** instant hide / layering | instant zero-scale → 160 ms pop + colour flash; burst offset 0.5 along world normal + `depthTest:false`/`renderOrder 10` | `cube-view.ts`, `particles.ts`, `scene.ts` (+tests) | board removal, `clicks+1` at dispatch, one `explosion` intent, repeat no-op, burst lifetime, pool cap |
| **AC-8** keyboard cursor | feature removed (no highlight, WASD/Enter/Space unbound, no cursor state/event/snapshot field) | `rotation.ts`, `engine.ts`, `keyboard.ts`, `cube-view.ts`, `scene.ts`, `picking.ts` | arrow rotation all six faces, any-key intro skip, canvas focus ring |
| **AC-22** intro path | straight `z 60→12` → search/find/approach pose function | `scene.ts` `introCameraPose` (+tests) | rest pose, FOV 50 / near .1 / far 200, travel pull-away values, reduced-motion collapse |
| **AC-1** aria-label string | string now names only click + arrow rotation | `GameCanvas.tsx:37` (+2 tests) | `tabindex="0"`, `touch-action:none`, HUD markup/texts, skip hint |

### Retained predecessor ACs — evidence (unchanged tests passing)

| Predecessor AC (retained) | Evidence in this run |
| --- | --- |
| AC-1 shell renders / HUD texts / skip hint (label string superseded) | `App.test.tsx` 4/4 exact SSR markup; `Hud.test.tsx` 3/3 |
| AC-2 intro phase + skip | `engine.test.ts` intro group 4 tests; `keyboard.test.ts` phase policy 3; `session.test.ts` tap-skip 1 |
| AC-4 level structure / grid instances | `board.test.ts` 14; `cube-view.test.ts` instance matrices 2 |
| AC-6 pointer classification / front-face picking / settle | `gestures.test.ts` 21; `picking.test.ts` 9; `rotation.test.ts` interpolate 5; `session.test.ts` pointer wiring |
| AC-7 arrow rotation reaches six faces | `rotation.test.ts` "reaches all six faces through keyboard steps only (AC-7)"; `keyboard.test.ts` arrow mapping + integration |
| AC-9 face destruction / auto-rotation | `engine.test.ts` 6; `cube-view.test.ts` removeFace 4; `scene.test.ts` fade 3 |
| AC-10 travel → next styled cube | `engine.test.ts` 1 (full sequence); `progression.test.ts` 10; `scene.test.ts` levelChanged rebuild |
| AC-11 live HUD stats / snapshot stability | `engine.test.ts` referential stability 2 + clicks 3; `Hud.test.tsx`; `App.test.tsx` AC-11 |
| AC-12 reduced motion | `effects.test.ts` profiles 3; `engine.test.ts` reduced 5; `session.test.ts` reduced 2; `scene.test.ts` reduced fades/settle |
| AC-13 touch/responsive canvas | `session.test.ts` attach/resize 3; `browser-env.test.ts` 6; `webgl.test.ts` 5 |
| AC-14 accessibility semantics / single live region | `Hud.test.tsx` "is not a live region: neither counter span carries role or aria-live (AC-14)"; `App.test.tsx` phase markup; `theme.test.ts` contrast 2 |
| AC-15 frame loop lifecycle / disposal | `session.test.ts` frame/hidden/dispose 6; `webgl.test.ts` 5; `scene.test.ts` dispose 1 |
| AC-16 bounded resources | `scene.test.ts` object count + 10-cycle baseline; `particles.test.ts` cap/recycle 19 |
| AC-17 coverage/test bar / DOM-free `game/**` | § 1.5 coverage; § 3.1/3.2 greps |
| AC-18 glossary terms | `docs/product/glossary.md` not in the feature diff |
| AC-19 scope discipline | § 2.1/§ 2.3 |
| AC-20 build within budget | § 1.6 (209.49 ≤ 350 kB gzip, named imports only) |
| AC-21 containerization additive-only | § 2.1 (container paths empty) + § 1.7 smoke 4/4 |

---

## 6. Manual visual pass (spec § Manual visual pass — **not an AC**)

Stack state: `podman ps` shows both services healthy; the frontend answers HTTP (`http://localhost:5173/` →
document titled `CubeClicker`) and the backend health endpoint answers `{"status":"ok"}`. **No browser/WebGL
renderer is available to this builder agent**, so no visual claim is made.

| # | Step | Outcome |
| --- | --- | --- |
| 1 | Load → search/find/approach intro, skip hint, click/key skips | not executed — no browser available to the builder agent (stack reachable) |
| 2 | Click a mini-cube → pop + flash, burst in front, `Clicks` +1 | not executed — no browser |
| 3 | Click a non-front visible face → nothing | not executed — no browser |
| 4 | Drag > 40 px → one 90° step, no touch scroll | not executed — no browser |
| 5 | Arrows rotate; WASD/Enter/Space do nothing; no highlight; focus ring | not executed — no browser |
| 6 | Clear a whole face → plate fades, `Faces destroyed` +1, others playable | not executed — no browser |
| 7 | Clear all six → galaxy visibly expands while pulling back, `Cube 2` arrives | not executed — no browser |
| 8 | OS reduced motion → no flights/expansion/pop/burst, instant rotation | not executed — no browser |
| 9 | Touch emulation → tap explodes (with pop), drag rotates, no scroll/zoom | not executed — no browser |

The node-assertable substitutes are the AC-1…AC-6 tests above; the visual confirmation remains a user step.

---

## 7. Known residuals (explicit)

- **`ui/GameCanvas.tsx` effect body unexecuted under SSR** — `61.9 %` statements/lines, uncovered `23-30`,
  `src/ui` 79.48 aggregate (≥ 80 workspace-wide). Pre-existing predecessor residual; the task's label change
  is asserted by the SSR markup tests, but the client effect needs a DOM/WebGL host.
- **`WebGLRenderer` is mocked** in `webgl.test.ts` (5 tests) — no real GL context in the node test environment;
  pre-existing, unchanged by this feature.
- **`ws/connection.ts` 95.34 stmts / 92.59 branch, uncovered `53-54,99-100`** — pre-existing scaffold, untouched.
- **`game/session.ts:173` branch uncovered** (100/100/100 statements/functions/lines) — pre-existing.
- **`render/picking.ts` is now 100/100/100/100** — the predecessor residual (`picking.ts:88–89`) is gone because
  T2 rewrote that guard; an improvement, not a regression (recorded instead of silently dropped).
- Frontend aggregate 99.31/99.36/100/99.31 ≥ 80 on all four metrics — gate genuinely green, no exclusions.

### Carried deviations (from T2/T3 build logs — all ratified/documented there)

- **T2 D-1** — `game/session.test.ts` edited although not in T2's `files_owned`: two assertions encoded superseded
  predecessor behaviour (intro start `[0,0,60]`; instant zero-scale). Ratified in `tasks.md` r2 (T2 `files_owned`
  amended: 3 expected values, test-only). T3 then removed the fixture `cursor` field.
- **T2 D-2** — intro pose row p = 0.56 is pinned at its f64-exact output (`3.999999999999993`, `1.9999999999999964`,
  `26.25` / target `3.749999999999993`, `-4.999999999999993`), documented in `scene.test.ts`; other six rows are
  decimal-exact. No `toBeCloseTo` used.
- **T2 D-3** — `lookAt(ORIGIN)` also runs on the `travel`/`playing` branches (positions unchanged) so an intro skip
  lands on the pinned rest *orientation* (identity quaternion, AC-2).
- **T2 D-4** — `settlePops` restores the colour multiplier to 1 as well as zero-scaling (the timeline's end state).
- **T3** — the aria-label verify grep in the task text omits `-r`; the recursive equivalent returned no matches.
  `engine.test.ts`'s snapshot-identity test now triggers on `setReducedMotion(true)` (the `cursorMove` trigger no
  longer exists); the subject (referential stability) and strength are unchanged. Test-only.

---

## 8. Drift / unmet ACs

- **Unmet ACs: none** (AC-1…AC-7 all met with the evidence in § 4).
- **Defects: none found** in the feature's scope.
- **Drift on disk (pre-existing, not this feature, not staged):** `docs/features/cube-game-frontend/status.md`
  carries one orchestrator note line (§ 2.2). Feature-range diff on it is empty.
- **Feature planning docs are untracked** (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/`) — outside
  T4's `files_owned`; T4 commits only this build log.

## 9. Scope / commit

Only `docs/features/cube-visual-polish/build-log-T4.md` was written; no source, test, spec, plan, tasks, status,
predecessor doc, container, config or `.env*` file was modified (`git status` after the commit still shows only
the pre-existing `docs/features/cube-game-frontend/status.md` modification plus the untracked planning docs; this
log was staged alone). Commit: `docs: record T4 verification pass for cube-visual-polish (T4)` — explicit path only
(`git add -- docs/features/cube-visual-polish/build-log-T4.md` + `git commit … --only -- <same path>`).
