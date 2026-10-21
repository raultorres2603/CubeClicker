# Build log — T3 — Verify & integrate (final gate)

Task: T3 (2026-10-21) — `docs/features/cube-tile-lines-and-controls/tasks.md` § T3
Acceptance: AC-5, AC-6 (spec r1); verifies AC-1…AC-4 built in T1/T2.
Files changed: **this log only** (`docs/features/cube-tile-lines-and-controls/build-log-T3.md`).
No source, test, spec, plan, task, status or accepted-feature file was edited by T3.

What this task did:
1. Ran the full gate from a clean install (`npm ci` → lint → typecheck → test → coverage →
   build → smoke) and recorded the raw transcripts below.
2. Re-verified feature integrity against the baseline commit before T1/T2 (exact ref
   `d45de3f`): commit diff, untouched paths, retained test-file hashes, greps.
3. Re-verified the three behaviours independently of the tests (a throw-away scene-graph
   probe outside the repository) — seams at N = 3/5/7, the picking seam window, the
   pointer contract, the key table, auto-rotation, the three aria-label pins.
4. Judged the T1 picking-literal deviation against AC-1/plan (met; see § 5).
5. Recorded the manual visual pass steps as "not executed — environment" (no browser in
   this builder environment) and flagged the dev-server observation that affects step 1.

## Environment and baselines

| Item | Value |
| --- | --- |
| Node / npm | `v24.22.0` / `11.19.1` |
| `three` resolved | `0.186.1` (lockfile unchanged, see § 3) |
| Feature baseline (commit before T1/T2) | `d45de3f` — `docs: record T3 verification pass for cube-world-transition (T3)` |
| T2 commit | `2dae075291caa4ef28efe897d3aa37c637f10120` — `feat: rotate with WASD or the arrow keys and update the canvas label (T2)` (parent `d45de3f`) |
| T1 commit | `6e227bcbefb99788d4dba51aaff45f7a56ef8e9e` — `feat: seam the mini-cube surface and remove pointer-drag rotation (T1)` (parent `2dae075`) |
| T3 HEAD at gate start | `6e227bc` (working tree clean for all source/test paths) |

`git log -2 --format='%H%n  %s'`:

```
6e227bcbefb99788d4dba51aaff45f7a56ef8e9e
  feat: seam the mini-cube surface and remove pointer-drag rotation (T1)
2dae075291caa4ef28efe897d3aa37c637f10120
  feat: rotate with WASD or the arrow keys and update the canvas label (T2)
```

---

## 1. Full gate (all commands exit 0)

### 1.1 `npm ci` → 0

```
$ npm ci
added 333 packages, and audited 336 packages in 2s
...
4 vulnerabilities (2 moderate, 2 critical)          # pre-existing, dev tooling (see residual)
NPM_CI_EXIT=0
```

### 1.2 `npm run lint` → 0

```
$ npm run lint
> lint
> eslint .
LINT_EXIT=0
```

### 1.3 `npm run typecheck` → 0 (both workspaces)

```
$ npm run typecheck
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit          # backend

> typecheck
> tsc --noEmit          # frontend
TYPECHECK_EXIT=0
```

### 1.4 `npm test` → 0 (both workspaces, every test file listed)

```
> test
> vitest run
 RUN  v3.2.7 .../src/backend
 ✓ src/app.test.ts (4 tests) 101ms
 Test Files  1 passed (1)
      Tests  4 passed (4)

> test
> vitest run
 RUN  v3.2.7 .../src/frontend
 ✓ src/ui/theme.test.ts (2 tests) 4ms
 ✓ src/browser-env.test.ts (6 tests) 16ms
 ✓ src/game/rotation.test.ts (15 tests) 6ms
 ✓ src/render/webgl.test.ts (5 tests) 8ms
 ✓ src/game/progression.test.ts (10 tests) 8ms
 ✓ src/game/effects.test.ts (28 tests) 12ms
 ✓ src/ws/connection.test.ts (10 tests) 17ms
 ✓ src/game/board.test.ts (18 tests) 23ms
 ✓ src/input/keyboard.test.ts (13 tests) 6ms
 ✓ src/game/engine.test.ts (45 tests) 34ms
 ✓ src/input/gestures.test.ts (21 tests) 9ms
 ✓ src/ui/Hud.test.tsx (3 tests) 12ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 11ms
 ✓ src/render/particles.test.ts (19 tests) 21ms
 ✓ src/render/picking.test.ts (12 tests) 23ms
 ✓ src/render/starfield.test.ts (15 tests) 71ms
 ✓ src/render/cube-view.test.ts (32 tests) 60ms
 ✓ src/game/session.test.ts (25 tests) 57ms
 ✓ src/App.test.tsx (4 tests) 17ms
 ✓ src/render/scene.test.ts (51 tests) 104ms
 Test Files  20 passed (20)
      Tests  336 passed (336)
TEST_EXIT=0
```

Totals: backend 4 tests / 1 file; frontend 336 tests / 20 files; **340 tests, 0 failing**.

Changed test files (the T1/T2 `files_owned` tests), with their counts:

| Test file | Owned by | Tests |
| --- | --- | --- |
| `src/render/cube-view.test.ts` | T1 | 32 |
| `src/render/picking.test.ts` | T1 | 12 |
| `src/render/scene.test.ts` | T1 | 51 |
| `src/game/session.test.ts` | T1 | 25 |
| `src/input/keyboard.test.ts` | T2 | 13 |
| `src/ui/GameCanvas.test.tsx` | T2 | 2 |
| `src/App.test.tsx` | T2 | 4 |
| **changed-test total** | | **139** |

Retained (byte-identical, see § 3.3) test files carry the other **197** tests; 139 + 197 =
336, i.e. every frontend test file is accounted for.

Focused verbose re-run of the changed suites plus the retained contract suites
(`gestures`, `engine`): **9 files, 205 tests passed, exit 0** — test names quoted in § 5.

### 1.5 `npm run coverage` → 0 (both workspaces ≥ 80 on all four metrics)

Backend (`src/backend`):

```
 % Coverage report from v8
----------|---------|----------|---------|---------|
File      | % Stmts | % Branch | % Funcs | % Lines |
----------|---------|----------|---------|---------|
All files |     100 |      100 |     100 |     100 |
 app.ts   |     100 |      100 |     100 |     100 |
```

Frontend (`src/frontend`):

```
 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.33 |    99.41 |     100 |   99.33 |
 src             |     100 |      100 |     100 |     100 |
  App.tsx        |     100 |      100 |     100 |     100 |
  browser-env.ts |     100 |      100 |     100 |     100 |
 src/game        |     100 |     99.6 |     100 |     100 |
  board.ts       |     100 |      100 |     100 |     100 |
  effects.ts     |     100 |      100 |     100 |     100 |
  engine.ts      |     100 |      100 |     100 |     100 |
  progression.ts |     100 |      100 |     100 |     100 |
  rotation.ts    |     100 |      100 |     100 |     100 |
  session.ts     |     100 |    98.18 |     100 |     100 | 175
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
COVERAGE_EXIT=0
```

Recorded numbers: **backend 100 / 100 / 100 / 100**; **frontend statements 99.33,
branches 99.41, functions 100, lines 99.33** — both workspaces clear the 80 bar on all
four metrics. No exclusion or threshold change (`src/frontend/vitest.config.ts` and
`src/backend/vitest.config.ts` are baseline-identical, § 3). The only file-level
shortfalls are the pre-existing `src/ui` aggregate (79.48 statements, driven by the SSR
effect body) and `src/ws` (95.34): both are workspace-internal residuals, not gate
failures, because the workspace aggregate is what the threshold applies to.

### 1.6 `npm run build` → 0 (sizes recorded, gzip initial JS ≤ 350 KB)

```
> build
> vite build
vite v7.3.7 building client environment for production...
✓ 49 modules transformed.
dist/index.html                   0.40 kB │ gzip:   0.26 kB
dist/assets/index-BaygJ9fo.css    1.32 kB │ gzip:   0.63 kB
dist/assets/index-Bn8HFl_g.js   772.18 kB │ gzip: 209.69 kB
✓ built in 1.32s
BUILD_EXIT=0
```

Independent gzip measurement of `src/frontend/dist/assets` (node `zlib.gzipSync`):

```
index-BaygJ9fo.css 1322 bytes gzip 627 bytes
index-Bn8HFl_g.js 772182 bytes gzip 209685 bytes
```

Initial JS gzip = **209.69 KB (209 685 bytes)** vs the predecessor's pinned
`BUNDLE_BUDGET_GZ_KB = 350` (cube-game-frontend spec AC-20, retained) → **within budget
by 140.31 KB**. The 500 kB chunk warning is the pre-existing single-chunk build, not a
budget breach.

### 1.7 `npm run smoke` → 0 (containerized e2e, stack was up)

```
$ npm run smoke
 Container cubeclicker-backend-1 Running
 Container cubeclicker-frontend-1 Running
 Container cubeclicker-smoke-run-b0bd808aa592 Created
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
SMOKE PASS (4/4 checks)
SMOKE_EXIT=0
```

(Excerpt: the podman-compose provider banner and the intermediate `Creating` line are
elided; the four `PASS` lines and the final summary are verbatim.)

### 1.8 Live stack precondition (HTTP, no browser)

```
GET / (http://127.0.0.1:5173/)           status=200 bytes=569 hasRoot=true
GET /healthz (http://127.0.0.1:8080/)    status=200 {"status":"ok"}
```

The dev containers are the current ones (`cubeclicker-frontend-1` and
`cubeclicker-backend-1`, both healthy, loopback-published on 5173/8080). See § 8 for the
one dev-server observation this check surfaced.

---

## 2. Integrity vs the feature baseline (`d45de3f`)

### 2.1 The whole feature diff

`git diff --name-status d45de3f..HEAD` — 15 files, all of them T1/T2 `files_owned` paths
plus their two build logs:

```
A	docs/features/cube-tile-lines-and-controls/build-log-T1.md
A	docs/features/cube-tile-lines-and-controls/build-log-T2.md
M	docs/product/glossary.md
M	src/frontend/src/App.test.tsx
M	src/frontend/src/game/session.test.ts
M	src/frontend/src/game/session.ts
M	src/frontend/src/input/gestures.ts
M	src/frontend/src/input/keyboard.test.ts
M	src/frontend/src/input/keyboard.ts
M	src/frontend/src/render/cube-view.test.ts
M	src/frontend/src/render/cube-view.ts
M	src/frontend/src/render/picking.test.ts
M	src/frontend/src/render/scene.test.ts
M	src/frontend/src/ui/GameCanvas.test.tsx
M	src/frontend/src/ui/GameCanvas.tsx
```

Because that list is the complete commit diff, every path not named there is
byte-identical between `d45de3f` and HEAD — including all AC-6 paths. The explicit query
below returned **0 files**:

```
$ git diff --name-only d45de3f..HEAD -- \
    src/backend tests/e2e 'compose*.yaml' src/backend/Dockerfile src/frontend/Dockerfile \
    src/frontend/src/main.tsx src/frontend/src/ws \
    package.json package-lock.json tsconfig.json eslint.config.mjs \
    src/backend/package.json src/backend/tsconfig.json src/backend/vitest.config.ts \
    src/frontend/package.json src/frontend/tsconfig.json src/frontend/vite.config.ts \
    src/frontend/vitest.config.ts \
    src/frontend/src/game/engine.ts src/frontend/src/game/rotation.ts \
    src/frontend/src/game/board.ts src/frontend/src/game/progression.ts \
    src/frontend/src/game/effects.ts src/frontend/src/game/types.ts \
    src/frontend/src/render/picking.ts src/frontend/src/render/starfield.ts \
    src/frontend/src/render/particles.ts \
    src/frontend/src/ui/Hud.tsx src/frontend/src/ui/theme.ts src/frontend/src/App.tsx \
    docs/features/cube-game-frontend docs/features/cube-visual-polish \
    docs/features/cube-visual-polish-followup docs/features/cube-world-transition \
  | wc -l
0
DIFF_EXIT=0
```

`git diff --stat` on the same paths → empty output (no hunks).

### 2.2 Lockfile, dependencies, `.env*`

```
$ git diff --stat d45de3f..HEAD -- package-lock.json     # (empty)
$ git diff --stat -- package-lock.json                   # (empty)
$ git diff --name-only d45de3f..HEAD | grep -iE '(^|/)\.env'   # exit 1 (no matches)
$ git status --porcelain | grep -iE '\.env'                    # exit 1 (no matches)
```

No dependency change (`three` still `0.186.1` from the unchanged lockfile), no `.env*`
file touched or staged.

### 2.3 Retained test files are byte-identical to the baseline

`sha256sum` of the working tree file vs `git show d45de3f:<path>` for every retained test
file:

```
SAME  src/frontend/src/game/engine.test.ts         b8f18c166a68083fa3791b53eed6606024c2cb8ad8e78753fd6742aeabbbf857
SAME  src/frontend/src/game/rotation.test.ts       dd3b4358e155ec94a68e51611124b47b4a0f7c081e312a1d2b338c63db947e33
SAME  src/frontend/src/game/board.test.ts          9b31c0477f0f6689e4fe015df9fad3493529fd3f3781d1abd97161422d5ee213
SAME  src/frontend/src/game/progression.test.ts    52650e3cef829fd3032fe85e02394f5f884a234c5e9e7cbe494a6145edd1ea10
SAME  src/frontend/src/game/effects.test.ts        c0a57f6e9863923ee0240f92a26cd6c85fbe462d8ffb656d3c0bafaf314b7b65
SAME  src/frontend/src/render/starfield.test.ts    88f08d0de71c8e939a8e8d5b462f4796bbac465d9cf27f68d9fe4d9342ab1494
SAME  src/frontend/src/render/particles.test.ts    a14f886601ef5a8ba797ed8035bc2920c5f1ce69603e31dcdfd9ed4e827e4895
SAME  src/frontend/src/input/gestures.test.ts      6d4ae0343953545faeb27937c2beac6c4deee8b1a2a9a1296db8bd8112ac8ac0
SAME  src/frontend/src/ui/Hud.test.tsx             3709c81cea25d2e8214c9674f7bb03e32afde39fe9e74e22ae40ca83a839295a
SAME  src/frontend/src/ui/theme.test.ts            5bc80a49adb25809e6f59797c5dbb4386255a2d626c4d5e91b5413606a0683a7
SAME  src/frontend/src/render/webgl.test.ts        cc988acd5128055968a40254dc12d3aad004b3b8114354d186fe1760de7f151a
SAME  src/frontend/src/ws/connection.test.ts       e464a4e0c10d38744e2dc7d6429fc9c48e8e304c4b30cc53aa59b4a76622b6f6
SAME  src/frontend/src/browser-env.test.ts         002ab5922670dfc249e9c50a3bf2889aac702d43e1ae3cc7f2b51ff8dd975895
```

All 13 files pass in the § 1.4 run (197 tests), so AC-5's "retained behaviours are
re-asserted by the unchanged tests" holds literally, not just nominally.

### 2.4 `gestures.ts` is a doc-comment-only change (AC-2's "logic unchanged")

`git diff d45de3f..HEAD -- src/frontend/src/input/gestures.ts` shows only the module header
sentences (`drag` → "ignored by the session — pointer rotation was removed; the
`axis`/`direction` payload remains the classification contract"). No executable line
changed; the 21 `gestures.test.ts` assertions (39/40/41 boundary, dominant axis, NDC
mapping, the engine integration case) pass unmodified.

### 2.5 Glossary wording (AC-1 supersession)

```
-**Definition:** … The tiles sit flush edge-to-edge, so the cube's surface reads as one giant cube built from mini-cubes; …
+**Definition:** … The tiles sit with a thin uniform seam between them — the dark interior
+shows through as the tile lines — so the cube's surface reads as one giant cube built from
+mini-cubes; …
```

Definition + example format retained, no other glossary term touched (one-line diff).

---

## 3. Banned matchers and purity greps

### 3.1 Banned-matcher grep over every changed test file → no matches

Files: `cube-view.test.ts`, `picking.test.ts`, `scene.test.ts`, `session.test.ts`,
`keyboard.test.ts`, `GameCanvas.test.tsx`, `App.test.tsx`.

```
$ grep -nE "expect\.(anything|any\(|objectContaining|arrayContaining|stringContaining|stringMatching|closeTo)|toMatchObject|toMatchSnapshot|toHaveBeenCalled\(\)|toBeTruthy|toBeDefined|not\.toThrow|toBeCloseTo" <7 changed test files>
(no output)  BANNED_EXIT=1 (1 = no matches)

per-file hits: cube-view 0 | picking 0 | scene 0 | session 0 | keyboard 0 | GameCanvas.test 0 | App.test 0
```

No `toBeCloseTo` / `expect.closeTo` anywhere in `src/frontend/src` (exit 1), so the
bounded-exception budget stays 0. The matcher census of the changed files is exact-value
only: `toEqual` (273), `toBe` (256), `toArray` (97), `toHaveLength` (46),
`toHaveBeenCalledTimes` (34), `toBeNull` (21), `toThrow` (16), `toContain` (16),
`toBeInstanceOf` (15), plus 4 `toBeLessThanOrEqual` / 2 `toBeGreaterThanOrEqual` /
1 `toBeLessThan` (all pre-existing retained `scene.test.ts` cone-coverage range checks,
unchanged by this feature) and 1 `toHaveBeenCalledWith`. `toHaveBeenCalled()` with no
arguments: 0.

### 3.2 Purity greps under `game/**` → no matches

```
$ grep -rnE "Math\.random" src/frontend/src/game
(no output)  RANDOM_EXIT=1

$ grep -rnE "\b(document|window|navigator|localStorage|sessionStorage|requestAnimationFrame|cancelAnimationFrame|HTMLElement|HTMLCanvasElement|PointerEvent|KeyboardEvent)\b" src/frontend/src/game
(no output)  DOM_EXIT=1
```

### 3.3 Import hygiene and plate removal

```
$ grep -rn "import \* as" src/frontend/src        # exit 1 (no namespace imports)
$ grep -rn "from 'three'" src/frontend/src        # only named imports (7 modules)
$ grep -rnE "plateMeshes|PLATE_OFFSET" src/frontend/src/render src/frontend/src/game
src/frontend/src/render/cube-view.test.ts:275: expect('plateMeshes' in view).toBe(false)   # test-only absence pin
(no production match)
```

`three` resolves to `0.186.1`.

---

## 4. Independent scene-graph / picking probe (outside the repository)

A throw-away `tsx` script in `/tmp/opencode/t3/probe.mts` (symlinked `node_modules`, never
added to the repo) imports the **shipped** `createCubeView` / `pickMiniCube` and reads the
real instance matrices and a real `PerspectiveCamera` (fov 50, at `(0,0,12)`), so the
numbers below do not depend on the tests' own comments:

```
MINI_CUBE_TILE_RATIO = 0.95
CUBE_SIZE = 5  CUBE_HALF_SIZE = 2.5  THICKNESS = 0.25

N=3 cell=1.6666666666666667 idealTileEdge=1.5833333333333333 idealSeam=0.08333333333333334 idealRim=0.04166666666666667
  children(7) = Mesh, Mesh, Mesh, Mesh, Mesh, Mesh, Mesh
  body color = #0b0b12  style.cubeColor = ##0b0b12
  col0: scale=[1.5833333730697632, 1.5833333730697632, 0.25] centre=[-1.6666666269302368, 1.6666666269302368, 2.625]
  col0->1: centreStep=1.666666626930 seam=0.083333253860
  col1->2: centreStep=1.666666626930 seam=0.083333253860
  last col: scale.x=1.5833333730697632 outerRim=0.041666686535
  centre pick -> front:1:1

N=5 cell=1 idealTileEdge=0.95 idealSeam=0.05 idealRim=0.025
  children(7) = Mesh, Mesh, Mesh, Mesh, Mesh, Mesh, Mesh
  body color = #0b0b12  style.cubeColor = ##0b0b12
  col0: scale=[0.949999988079071, 0.949999988079071, 0.25] centre=[-2, 2, 2.625]
  col0->1: centreStep=1.000000000000 seam=0.050000011921
  col1->2: centreStep=1.000000000000 seam=0.050000011921
  col2->3: centreStep=1.000000000000 seam=0.050000011921
  col3->4: centreStep=1.000000000000 seam=0.050000011921
  last col: scale.x=0.949999988079071 outerRim=0.025000005960
  centre pick -> front:2:2

N=7 cell=0.7142857142857143 idealTileEdge=0.6785714285714286 idealSeam=0.03571428571428572 idealRim=0.01785714285714286
  children(7) = Mesh, Mesh, Mesh, Mesh, Mesh, Mesh, Mesh
  body color = #0b0b12  style.cubeColor = ##0b0b12
  col0: scale=[0.6785714030265808, 0.6785714030265808, 0.25] centre=[-2.142857074737549, 2.142857074737549, 2.625]
  col0->1: centreStep=0.714285612106 seam=0.035714209080
  col1->2: centreStep=0.714285731316 seam=0.035714328289
  col2->3: centreStep=0.714285731316 seam=0.035714328289
  col3->4: centreStep=0.714285731316 seam=0.035714328289
  col4->5: centreStep=0.714285731316 seam=0.035714328289
  col5->6: centreStep=0.714285612106 seam=0.035714209080
  last col: scale.x=0.6785714030265808 outerRim=0.017857223749
  centre pick -> front:3:3
```

Reading: every face-axis extent is `0.95 × cell` with thickness `0.25`; adjacent tiles are
separated by the ideal seam (`1/12`, `0.05`, `1/28` world units, off by a few float32 ulps
as the T1 log documents); the outer face sits `CUBE_HALF_SIZE − seam/2` from the face
centre; the group holds exactly 7 children (body + 6 `InstancedMesh`), the body is the
style's dark interior `#0b0b12`, and centre picks resolve the exact ids on all three grids.

---

## 5. Integration re-verification and the T1 picking-literal deviation

### 5.1 Seams at N = 3 / 5 / 7 (AC-1)

Focused verbose run (`npx vitest run --root src/frontend --reporter=verbose <9 files>` →
**exit 0, 9 files, 205 tests**), selected lines:

```
 ✓ src/render/cube-view.test.ts > cube geometry constants > pins the body and inset tile geometry values (AC-1)
 ✓ src/render/cube-view.test.ts > seamed tiling (AC-1) > sizes every tile to 0.95 of a cell on its face axes (N = 3, 5, 7)
 ✓ src/render/cube-view.test.ts > seamed tiling (AC-1) > keeps the pinned first/last centres and the exact cell spacing (N = 3, 5, 7)
 ✓ src/render/cube-view.test.ts > seamed tiling (AC-1) > leaves the uniform seam between adjacent tiles and the half-seam rim (N = 3, 5, 7)
 ✓ src/render/cube-view.test.ts > seamed tiling (AC-1) > orients each tile on its face with the inset cell extent (N = 5)
 ✓ src/render/cube-view.test.ts > createCubeView > builds exactly one body and six face grids, in order (AC-2: no plates)
 ✓ src/render/cube-view.test.ts > createCubeView > exposes the plate-free CubeView surface (AC-2)
 ✓ src/render/cube-view.test.ts > createCubeView > takes the pinned colours and PBR values from the style (body = dark interior)
 ✓ src/render/cube-view.test.ts > hideMiniCube > plays the pinned pop timeline on the inset tile (N = 5)
 ✓ src/render/cube-view.test.ts > hideMiniCube > scales the pop from the inset cell of a larger grid (N = 7)
 ✓ src/render/scene.test.ts > intent application > pops the exploding tile and fronts its burst at the clicked surface (AC-3, AC-4)
```

The dark interior through the seams is the body mesh (`style.cubeColor`, `#0b0b12`)
behind the inset tiles — asserted by the body-material assertion and measured in § 4;
"nothing covers the body" is the child-list/pick-set fact (7 children, pick set = the front
`InstancedMesh` only), and the visual judgement belongs to the manual pass.

### 5.2 Picking: centre hits, seam misses, and the T1 deviation

```
 ✓ src/render/picking.test.ts > pickMiniCube > resolves the mini-cube under the viewport centre
 ✓ src/render/picking.test.ts > pickMiniCube > decodes the instance index into the face row and col of the id
 ✓ src/render/picking.test.ts > pickMiniCube > misses in the seam between two tiles and still hits just inside their edges (N = 5)
 ✓ src/render/picking.test.ts > pickMiniCube > misses at the N = 3 and N = 7 seam midpoints and hits just inside the tiles
 ✓ src/render/picking.test.ts > pickMiniCube > decodes a 3 × 3 grid from its own instance count
 ✓ src/render/picking.test.ts > pickMiniCube > decodes a 7 × 7 grid from its own instance count
 ✓ src/render/picking.test.ts > pickMiniCube > decodes a 1 × 1 grid: the single inset tile spans 95% of the face
```

**Deviation (recorded honestly).** `tasks.md` § T1 suggested turning the former grid-gap
NDC literals `0.11` / `0.12` into seam misses. They are not seams. The probe measured the
N = 5 x-axis answer directly:

```
N=5 x-axis pick sweep 0.1000..0.1300 (step 0.0001):
  measured null window = (0.1102, 0.1185)
  ndc=0.10294 -> front:2:2
  ndc=0.11 -> front:2:2
  ndc=0.1144 -> null
  ndc=0.118 -> null
  ndc=0.12 -> front:2:3
  ndc=0.12581 -> front:2:3
```

Analytic cross-check for the same camera: the seam gap between col 2 (max `x = 0.475`)
and col 3 (min `x = 0.525`) is only a miss when the ray clears the near edge of col 2's
front face at `z = 2.75` and stays short of col 3's side face at `z = 2.5`:
`0.475 / (0.46631 × 9.25) = 0.110123` … `0.525 / (0.46631 × 9.5) = 0.118512`. Measured
window `(0.1102, 0.1185)` at 0.0001 resolution matches. So `0.11` enters col 2's front face
(0.0005 inside) and `0.12` crosses into col 3's side face — pinning them as `null` would
have required changing `picking.ts`, which the spec forbids.

T1 pinned the true window instead: `0.1144` and `0.118` → `null` on both axes, plus inset
hits `0.10294` → `front:2:2` and `0.12581` → `front:2:3`; N = 3 (`0.190623`) and N = 7
(`0.081696`) pin their own seam midpoints with inset hits either side. **Judgement: AC-1 is
met.** The AC requires "a tap at the midpoint of a seam between two adjacent tiles returns
`null`" plus centre-hit resolution on N = 3/5/7 — that is exactly what is asserted and
measured; the task text's `0.11`/`0.12` were a numeric hint, not acceptance, and were
geometrically impossible. The plan's file inventory ("seam-miss case at the pinned
seam-midpoint NDC → `null`") is satisfied. This deviation is test-literal-only and leaves
production code untouched.

### 5.3 Pointer contract: drags do nothing, taps explode, fast clicks stay taps (AC-2)

```
 ✓ src/game/session.test.ts > pointer wiring > skips the intro on a tap and ignores an intro drag (AC-2)
 ✓ src/game/session.test.ts > pointer wiring > explodes the front-face mini-cube under a playing tap and drives the scene (AC-5, AC-6)
 ✓ src/game/session.test.ts > pointer wiring > ignores a playing tap that misses the cube
 ✓ src/game/session.test.ts > pointer wiring > re-reads the live front face and cube view on every tap (AC-6)
 ✓ src/game/session.test.ts > pointer wiring > maps taps and drags to the events each phase allows (injected engine, drags do nothing)
 ✓ src/game/session.test.ts > pointer wiring > ignores a playing drag: no rotation, no click, no publish (AC-2)
 ✓ src/game/session.test.ts > pointer wiring > keeps fast, jittery clicks as independent taps and drops a 41 px drag (AC-2)
 ✓ src/game/session.test.ts > pointer wiring > ignores a pointer release without a press and cancels a running press
 ✓ src/input/gestures.test.ts > classifyPointer — tap/drag threshold (AC-6) > classifies 39 px of travel as a tap at the current position
 ✓ src/input/gestures.test.ts > classifyPointer — tap/drag threshold (AC-6) > classifies exactly 40 px of travel as a tap (threshold inclusive)
 ✓ src/input/gestures.test.ts > classifyPointer — tap/drag threshold (AC-6) > classifies 41 px of travel as a drag
 ✓ src/input/gestures.test.ts > classifyPointer — dominant axis and direction (AC-6) > resolves an exact |dx| = |dy| tie to the horizontal (yaw) axis
```

Concrete assertions inspected in `session.test.ts`: 120 px rightward and 120 px downward
playing drags record **zero** events on the injected recording engine; on the real engine
`session.getSnapshot()` is referentially identical after the drags, orientation stays
`{ yawSteps: 0, pitchSteps: 0 }`, stats stay `{ clicks: 0, facesDestroyed: 0 }`, 25 front
tiles remain and the subscriber is never called; a 5 px-jitter click followed 60 ms later
by a neighbouring tap yields exactly two `explodeMiniCube` events (`front:2:2`,
`front:2:3`) and a 41 px release yields none. The retained `gestures.test.ts` still proves
the classification layer itself produces a drag payload (and the engine still accepts a
rotate event when driven directly) — the removal is the session policy, exactly as
specified.

### 5.4 Keyboard: W/A/S/D + arrows, case-insensitive, intro/travel retained (AC-3)

```
 ✓ src/input/keyboard.test.ts > mapKey — playing key→event table (AC-3) > maps the arrow keys to one rotation step each (retained table)
 ✓ src/input/keyboard.test.ts > mapKey — playing key→event table (AC-3) > maps W/A/S/D to the same four rotation steps, in either case (AC-3)
 ✓ src/input/keyboard.test.ts > mapKey — playing key→event table (AC-3) > folds single-character keys to lowercase instead of adding case variants to the table (AC-3)
 ✓ src/input/keyboard.test.ts > mapKey — playing key→event table (AC-3) > matches named keys exactly — arrow names are never case-folded (retained contract)
 ✓ src/input/keyboard.test.ts > mapKey — playing key→event table (AC-3) > maps the removed cursor keys Enter and space to no command at all (AC-6 retained)
 ✓ src/input/keyboard.test.ts > mapKey — phase policy (AC-2) > skips the intro on any key, bound or not
 ✓ src/input/keyboard.test.ts > mapKey — phase policy (AC-2) > returns null for keys that are not bound while playing
 ✓ src/input/keyboard.test.ts > mapKey — phase policy (AC-2) > returns null for every key while traveling
 ✓ src/input/keyboard.test.ts > integration — mapKey results drive the real engine > reaches all six faces with arrow keys alone (retained)
 ✓ src/input/keyboard.test.ts > integration — mapKey results drive the real engine > reaches all six faces with W/A/S/D alone (AC-3)
 ✓ src/input/keyboard.test.ts > integration — mapKey results drive the real engine > pins the exact orientation counters the arrows reach
 ✓ src/input/keyboard.test.ts > integration — mapKey results drive the real engine > pins the exact orientation counters the WASD keys reach, uppercase included
```

`keyboard.ts` inspected: `w/a/s/d` rows map to pitch +1 / yaw −1 / pitch −1 / yaw +1; the
lookup retries `key.toLowerCase()` only when `key.length === 1`, so `ARROWLEFT`/`arrowleft`
stay `null`; `Enter`, space, `Escape`, `q`, unknown keys → `null`; `intro` → `introSkip`
for every key; `travel` → `null`. WASD-only reachability enumerated front `[]`, left
`[d]`, back `[d, d]`, right `[a]`, top `[w]`, bottom `[s]` with `rotationFrom: null`,
`rotationProgress: 1` after each settled 300 ms step.

### 5.5 Auto-rotation untouched (AC-5)

`engine.ts` and `engine.test.ts` are baseline-identical (§ 2.1, § 2.3); the retained group
passes in the focused run:

```
 ✓ src/game/engine.test.ts > face destruction and auto-rotation (AC-9) > counts the face, drains faceCleared and starts one auto-rotation step
 ✓ src/game/engine.test.ts > face destruction and auto-rotation (AC-9) > does not auto-rotate when a non-front face is cleared
 ✓ src/game/engine.test.ts > face destruction and auto-rotation (AC-9) > re-evaluates the target after each step until the front face has mini-cubes
 ✓ src/game/engine.test.ts > face destruction and auto-rotation (AC-9) > breaks a nearest-face tie with FACE_IDS order
 ✓ src/game/engine.test.ts > face destruction and auto-rotation (AC-9) > auto-rotates the shortest way round the yaw seam
 ✓ src/game/engine.test.ts > face destruction and auto-rotation (AC-9) > auto-rotates onto a pole face when only a pole has mini-cubes left
```

### 5.6 Canvas label pinned in all three places (AC-4)

```
$ grep -rn "press W, A, S, D or the arrow keys" src/frontend/src
src/frontend/src/App.test.tsx:22:  'Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube';
src/frontend/src/ui/GameCanvas.tsx:37:      aria-label="Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube"
src/frontend/src/ui/GameCanvas.test.tsx:14:  'Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube';
LABEL_EXIT=0   (exactly one match per file: 1 / 1 / 1)

$ grep -rn "drag or press" src/frontend/src
OLD_EXIT=1     (no matches — old label gone)
```

`GameCanvas.test.tsx` asserts the full SSR markup `<canvas tabindex="0"
aria-label="…" style="touch-action:none"></canvas>`; `App.test.tsx` asserts the same
literal inside the full shell markup; `Hud.test.tsx` (unchanged, passing) still pins the
HUD markup and the non-live-region contract. No other markup/copy changed
(`GameCanvas.tsx` diff is the one attribute line).

---

## 6. Acceptance audit — per AC met/unmet

| AC | Status | Evidence (location) |
| --- | --- | --- |
| **AC-1 — seamed mini-cube surface** | **met** | `MINI_CUBE_TILE_RATIO === 0.95` asserted in `cube-view.test.ts`; face-axis extents `Math.fround((5/N) × 0.95)` with thickness `0.25` and seams `1/12` / `0.05` / `1/28` + half-seam rim for N = 3/5/7 (`cube-view.test.ts` § "seamed tiling"); independent measurement § 4; centres/7-children/body-material pins retained; centre picks + seam-miss `null` on N = 3/5/7 (`picking.test.ts`); pop literals re-pinned (`cube-view.test.ts`, `scene.test.ts`, `session.test.ts`); glossary diff § 2.5; greps § 3.3 |
| **AC-2 — pointer drags never rotate** | **met** | `session.test.ts` § pointer wiring (recording-engine zero events, real-engine snapshot identity, fast-jitter taps, 41 px drag, intro/travel groups); `gestures.ts` executable lines unchanged + its 21 tests unchanged and passing (39/40/41 boundary); `touch-action:none` pinned in `GameCanvas.test.tsx` |
| **AC-3 — WASD + arrow keyboard rotation** | **met** | `keyboard.test.ts` § table (W/A/S/D both cases, arrows retained), case-folding + arrow exactness, Enter/space/unknown `null`, intro any-key, travel all-null, WASD-only six-face enumeration ± orientation counters |
| **AC-4 — canvas label + untouched a11y surface** | **met** | exact string in `GameCanvas.tsx:37`, `GameCanvas.test.tsx:14`, `App.test.tsx:22` (one match each; old label gone); full SSR markup assertions; `Hud.test.tsx` byte-identical and passing |
| **AC-5 — automatic rotation and game core untouched** | **met** | `git diff d45de3f..HEAD` contains none of `game/{engine,rotation,board,progression,effects,types}.ts`, `ui/Hud.tsx`, `ui/theme.ts`, `App.tsx`, `render/{picking,starfield,particles}.ts` (§ 2.1); 13 retained test files byte-identical and passing (§ 2.3), incl. engine auto-rotation (§ 5.5) and `gestures.test.ts` |
| **AC-6 — supersession ledger + regression gate** | **met** | `npm ci` / `lint` / `typecheck` / `test` / `coverage` / `build` all exit 0 with both workspaces ≥ 80 on all four metrics (§ 1); build gzip 209.69 KB ≤ 350 KB; AC-6 path diff 0 files (§ 2.1); no `.env*`, no new deps, lockfile unchanged (§ 2.2); banned-matcher grep 0 (§ 3.1); `Math.random` 0 and DOM-globals 0 under `game/**` (§ 3.2); smoke 4/4 (§ 1.7) |

No AC is unmet. One deviation is recorded and judged compliant in § 5.2 (T1's picking
literals — test data only).

---

## 7. Supersession ledger confirmation

Only the nine ledged behaviours changed; everything else is untouched:

| Superseded (accepted feature AC) | Changed? | Evidence |
| --- | --- | --- |
| cube-world-transition AC-2 — flush tiling | yes, as specced | `cube-view.ts` ratio 1 → 0.95; seam assertions § 5.1 |
| cube-world-transition AC-2 / cube-game-frontend AC-18 — glossary mini-cube wording | yes, as specced | one-line glossary diff § 2.5 |
| cube-game-frontend AC-6 — drag → one rotation step | yes, as specced | session drag branch removed; § 5.3 |
| cube-game-frontend AC-13 — touch drags rotate | yes, as specced | same session branch (single Pointer Events path); `touch-action:none` retained |
| cube-game-frontend AC-7 — arrows-only key table | yes, as specced | WASD rows + case-folding; § 5.4 |
| cube-visual-polish AC-6 — WASD map to `null` | yes, as specced | WASD bound; `REMOVED_CURSOR_KEYS` now `['Enter', ' ']` |
| cube-game-frontend AC-1 / cube-visual-polish AC-6 — aria-label string | yes, as specced | § 5.6 |
| world-transition AC-4 / polish-followup AC-4 — ledgers | extended by this feature's docs | this table + AC table; ledger rows in spec r1 |
| Manual-pass steps 1, 2, 3, 4, 5, 8, 9 wording | updated | spec § Manual visual pass; recorded in § 8 |

**Retained ACs re-asserted by unchanged tests (all passing):** board removal and stats
(`board.test.ts` 18, `engine.test.ts` 45), rotation settle machine (`rotation.test.ts` 15),
level progression/style cycling (`progression.test.ts` 10), pop constants (`effects.test.ts`
28), starfield cone/expansion (`starfield.test.ts` 15), particles/burst fronting
(`particles.test.ts` 19), drag classification contract (`gestures.test.ts` 21), HUD and
single live region (`Hud.test.tsx` 3), theme contrast (`theme.test.ts` 2), renderer adapter
(`webgl.test.ts` 5), WS scaffold (`connection.test.ts` 10), browser environment
(`browser-env.test.ts` 6), plus the retained groups inside the changed files (travel poses,
intro dolly, disposal/countdown, framing, reduced motion in `scene.test.ts`; tap/skip/travel
and subscription in `session.test.ts`; arrow table and phase policy in `keyboard.test.ts`).

---

## 8. Manual visual pass (spec § Manual visual pass — not an AC)

**Outcome: not executed — environment.** This builder environment has no browser (the
project's accepted non-goal forbids browser automation), so all nine steps are recorded as
unrun. Preconditions were verified instead: the dev stack is up (frontend `GET /` 200,
backend `GET /healthz` 200 — § 1.8) and the containerized smoke test passes 4/4 (§ 1.7).

| # | Step (spec r1) | Outcome |
| --- | --- | --- |
| 1 | Thin seam lines between mini-cubes on every face, dark interior through them, half-seam rim, no plates; N = 3/5/7 surfaces; still reads as one giant cube | not executed — environment (no browser). *Precondition warning:* the running dev server serves a **stale** `cube-view.ts` transform (ratio 1), so this step would currently show the old flush surface — see the flag below. Geometry itself is verified (§ 4, § 5.1). |
| 2 | Intro: cube visible/centred first frame; click/key skips; dragging does nothing | not executed — environment. Behaviour covered by `session.test.ts` intro group. |
| 3 | Fast clicking: every tile click explodes (pop + burst in front, `Clicks` +1); never rotates; seam clicks do nothing | not executed — environment. Covered by `session.test.ts` fast-click group, `scene.test.ts` pop/burst, `picking.test.ts` seam misses. |
| 4 | Mouse drag (short or long) → nothing (no rotation, no explosion) | not executed — environment. Covered by `session.test.ts` drag groups. |
| 5 | W/A/S/D rotate up/left/down/right; arrows same; key repeat steps; Enter/Space do nothing; no highlight; focus ring | not executed — environment. Covered by `keyboard.test.ts` + `GameCanvas.test.tsx` markup. |
| 6 | Clear a face → last tile pops, `Faces destroyed` +1, auto-rotation turns to a remaining face | not executed — environment. Covered by unchanged `engine.test.ts` auto-rotation groups. |
| 7 | Clear all six faces → travel unchanged (directional departure, expansion, fly-in, `Cube N` +1, stats carried) | not executed — environment. Covered by unchanged `scene.test.ts` travel groups. |
| 8 | OS reduced motion → unchanged collapses | not executed — environment. Covered by `scene.test.ts` / `session.test.ts` reduced-motion groups. |
| 9 | Touch/touch emulation → tap explodes, drag does nothing, no page scroll/zoom | not executed — environment. Covered by the same pointer groups + retained `touch-action:none` pin. |

**Dev-server flag (environment, not a source defect).** The frontend container's Vite dev
server (started ~3 h before the gate, before T1) serves a stale transformed module for
`/src/render/cube-view.ts`:

```
GET /src/render/cube-view.ts?t=9999999999999  status=200  ratio0.95=false  ratio1=true
GET /src/ui/GameCanvas.tsx?t=…               status=200  newLabel=true        (fresh)
GET /src/input/keyboard.ts?t=…               status=200  wasd=true            (fresh)

$ podman exec cubeclicker-frontend-1 grep -n "MINI_CUBE_TILE_RATIO = " /app/src/frontend/src/render/cube-view.ts
70:export const MINI_CUBE_TILE_RATIO = 0.95;      # bind mount has the current file
```

The bind mount is current and the built bundle is current (§ 1.6); only the dev server's
in-memory transform for that one module is stale (its HMR watcher missed the T1 edit while
picking up T2's files). A manual pass against this stack must first restart the frontend
dev server (`podman compose restart frontend`, or `podman compose up --build`), otherwise
step 1 would show the pre-T1 flush surface. Not fixed here: restarting the user's live dev
stack is outside T3's verification scope.

---

## 9. Known residuals (carried, explicitly)

- **`ui/GameCanvas.tsx` effect body** — lines 23–30 (`useEffect` attach/dispose) never run
  under SSR: 61.9 % statements/lines for the file; `src/ui` aggregate 79.48. Documented
  residual from the accepted features; the workspace aggregate is 99.33. No exclusion.
- **Mocked `WebGLRenderer`** — `webgl.test.ts` exercises the renderer adapter against a
  mocked WebGL context (no real GL in node); unchanged by this feature.
- **`ws/connection.ts` 95.34 % / 92.59 % branch** — lines 53–54, 99–100 (closed/guard paths);
  retained scaffold, untouched.
- **`game/session.ts` branch 98.18 %, line 175** — the `if (active) return;` double-attach
  guard; pre-existing (T1's `session.ts` diff touches only the module doc comment and the
  drag branch around line 276 — not line 175). Not newly introduced.
- **`npm audit`: 4 advisories (2 moderate, 2 critical)** — pre-existing Vitest/dev-tooling
  advisories; no dependency change in this feature.
- **Single 772 kB chunk (209.69 KB gzip)** — the pre-existing build shape; within the
  350 KB budget.

---

## 10. Drift / flags (exact locations)

1. **Dev-server stale transform** — `cube-view.ts` served as ratio 1 by the running Vite
   container; file on disk and built bundle are ratio 0.95. Environment only; remedy above.
   Recorded, not papered over.
2. **Accepted-feature docs are partially untracked in the repository** — `docs/features/
   cube-visual-polish/**`, `cube-visual-polish-followup/**`, `cube-world-transition/**`
   are untracked working-tree files (never committed); `docs/features/cube-game-frontend/
   status.md` carries an **uncommitted** one-line backlog edit and `docs/features/README.md`
   three uncommitted accepted-feature rows. All were present before T3 started (captured in
   the first `git status`) and none is in the T1/T2 commits (`git diff d45de3f..HEAD` on
   those paths is empty), so the feature attributable diff is empty — but the working tree
   is not pristine for `docs/features/cube-game-frontend/**` relative to `d45de3f`. This is
   pre-existing documentation/status drift outside T3's `files_owned`; flagged for the
   orchestrator to commit or discard deliberately.
3. **This feature's spec/plan/tasks/status/reviews are still untracked** (only T1/T2 build
   logs were committed by their tasks). T3 commits this log only, per `files_owned`;
   committing the remaining feature artifacts is the orchestrator's/reviewer's call.
4. **No source/test/spec/plan/tasks/status edit by T3** — `git status` after the gate shows
   only this log added plus the pre-existing items in 2/3.

---

## 11. Verdict

The full gate is green from a clean install: lint 0, typecheck 0, 340/340 tests 0, coverage
0 with backend 100/100/100/100 and frontend 99.33/99.41/100/99.33, build 0 at 209.69 KB
gzip, smoke 4/4. The feature diff is confined to the T1/T2 `files_owned` files (15 files,
all frontend source/tests + glossary + the two build logs); every AC-5/AC-6 path is
baseline-identical; all 13 retained test files are byte-identical and passing; no banned
matchers, no `Math.random`/DOM globals under `game/**`, no new dependencies, no `.env*`
changes. AC-1…AC-6 are met; the only deviation (T1's `0.11/0.12` picking literals) is
test-data-only, independently measured, and compliant with AC-1. The manual visual pass is
unexecuted (no browser) and would require a frontend dev-server restart first (flag 1).

Committed: `docs: record T3 verification pass for cube-tile-lines-and-controls (T3)` —
this file only.
