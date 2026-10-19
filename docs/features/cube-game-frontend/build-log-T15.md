# Build log — T15 — Verify & integrate (final verification gate)

Task: T15 (2026-10-19) — `docs/features/cube-game-frontend/tasks.md` (r4)
Feature build-start baseline: **`3ca4d57`** (`Initial commit`-era parent of T1 `035d5c1`; the last
pre-feature commit — `git rev-parse 035d5c1^` = `3ca4d5789133e81f521705b714f7938cf29648ad`).
Verified tree: `2ca10ce` (T14) + this log's commit.
Branch: `main`. Not rewritten: the T7 hash supersessions and the T8 commit-index race are audited
below against the *current* linear history (no history rewrite performed).

Files changed (only `files_owned`):
- `docs/features/cube-game-frontend/build-log-T15.md` (this file)

**Verification-only task: no source, test, config, container, spec, plan, tasks or status edit.**

## Verify command results (raw)

### 1. `npm ci` → exit 0

```
$ npm ci
npm warn deprecated glob@10.5.0: ...
npm warn deprecated eslint@9.39.5: ...

added 333 packages, and audited 336 packages in 2s

92 packages are looking for funding
  run `npm fund` for details

4 vulnerabilities (2 moderate, 2 critical)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
npm warn install-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn install-scripts   esbuild@0.28.2 (postinstall: node install.js)
...
EXIT=0
```

`node --version` v24.22.0, `npm --version` 11.19.1. Lockfile-clean install (no diff produced by
`npm ci`). The 4 advisories are **pre-existing Vitest dev-tooling advisories**, not from this
feature's dependencies (see § Dependency audit).

### 2. `npm run lint` → exit 0

```
$ npm run lint
> eslint .

EXIT=0
```

### 3. `npm run typecheck` → exit 0 (both workspaces)

```
$ npm run typecheck
> npm run typecheck --workspaces --if-present

> typecheck   (backend)   > tsc --noEmit
> typecheck   (frontend)  > tsc --noEmit
EXIT=0
```

### 4. `npm test` → exit 0 (both workspaces)

```
> test
> npm run test --workspaces --if-present

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
 ✓ src/app.test.ts (4 tests) 106ms
 Test Files  1 passed (1)
      Tests  4 passed (4)

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
 ✓ src/ui/theme.test.ts (2 tests) 3ms
 ✓ src/render/webgl.test.ts (5 tests) 7ms
 ✓ src/browser-env.test.ts (6 tests) 13ms
 ✓ src/game/progression.test.ts (10 tests) 6ms
 ✓ src/game/effects.test.ts (18 tests) 9ms
 ✓ src/ws/connection.test.ts (10 tests) 16ms
 ✓ src/game/board.test.ts (14 tests) 26ms
 ✓ src/game/rotation.test.ts (31 tests) 10ms
 ✓ src/game/engine.test.ts (33 tests) 25ms
 ✓ src/input/keyboard.test.ts (11 tests) 7ms
 ✓ src/input/gestures.test.ts (21 tests) 9ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 10ms
 ✓ src/render/particles.test.ts (19 tests) 15ms
 ✓ src/render/starfield.test.ts (10 tests) 20ms
 ✓ src/ui/Hud.test.tsx (3 tests) 11ms
 ✓ src/render/cube-view.test.ts (23 tests) 26ms
 ✓ src/render/picking.test.ts (9 tests) 25ms
 ✓ src/App.test.tsx (4 tests) 14ms
 ✓ src/render/scene.test.ts (23 tests) 70ms
 ✓ src/game/session.test.ts (19 tests) 59ms

 Test Files  20 passed (20)
      Tests  273 passed (273)
EXIT=0
```

Every feature test file is listed by the transcript: all 19 new/changed test files
(`board`, `rotation`, `progression`, `effects`, `engine`, `starfield`, `cube-view`, `particles`,
`picking`, `gestures`, `keyboard`, `session`, `browser-env`, `webgl`, `scene`, `App.test.tsx`,
`ui/Hud.test.tsx`, `ui/GameCanvas.test.tsx`, `ui/theme.test.ts`), plus the retained scaffold
`src/ws/connection.test.ts` (10 tests, untouched, still green). Raw log:
`/tmp/opencode/t15/test.log`.

### 5. `npm run coverage` → exit 0 (both workspaces, per-metric numbers)

```
> coverage
> npm run coverage --workspaces --if-present

 RUN  v3.2.7 .../src/backend
 % Coverage report from v8
----------|---------|----------|---------|---------|-------------------
File      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------|---------|----------|---------|---------|-------------------
All files |     100 |      100 |     100 |     100 |
 app.ts   |     100 |      100 |     100 |     100 |
----------|---------|----------|---------|---------|-------------------
 Test Files  1 passed (1) / Tests  4 passed (4)

 RUN  v3.2.7 .../src/frontend
 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.17 |    99.13 |     100 |   99.17 |
 src             |     100 |      100 |     100 |     100 |
  App.tsx        |     100 |      100 |     100 |     100 |
  browser-env.ts |     100 |      100 |     100 |     100 |
 src/game        |     100 |     99.6  |     100 |     100 |
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
 src/render      |   99.68 |    99.27 |     100 |   99.68 |
  cube-view.ts   |     100 |      100 |     100 |     100 |
  particles.ts   |     100 |      100 |     100 |     100 |
  picking.ts     |   93.54 |     87.5 |     100 |   93.54 | 88-89
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
 Test Files  20 passed (20) / Tests  273 passed (273)
EXIT=0
```

**Per-workspace per-metric (the gate, thresholds 80 on all four):**

| Workspace | Statements | Branches | Functions | Lines | ≥ 80 all four? |
| --- | --- | --- | --- | --- | --- |
| `@cubeclicker/backend` | 100 | 100 | 100 | 100 | ✅ |
| `@cubeclicker/frontend` | 99.17 | 99.13 | 100 | 99.17 | ✅ |

Exclusions unchanged (verified: `src/frontend/vitest.config.ts` diff empty — still only
`src/main.tsx` + test patterns); no threshold change. Raw log: `/tmp/opencode/t15/coverage.log`.

### 6. `npm run build` → exit 0; gzip initial JS ≤ 350 KB (AC-20)

```
> build
> npm run build --workspaces --if-present

> build  (backend)  > tsc
> build  (frontend) > vite build
vite v7.3.7 building client environment for production...
✓ 49 modules transformed.
dist/index.html                   0.40 kB │ gzip:   0.27 kB
dist/assets/index-BaygJ9fo.css    1.32 kB │ gzip:   0.63 kB
dist/assets/index-BOpRCXKK.js   770.83 kB │ gzip: 209.10 kB

(!) Some chunks are larger than 500 kB after minification. ...
✓ built in 1.26s
EXIT=0
```

Initial JS = **209.10 kB gzip** (raw 770.83 kB) — identical to the T14 baseline and **140.90 kB
under** the `BUNDLE_BUDGET_GZ_KB` = 350 kB AC-20 budget. The 500 kB warning is Vite's uncompressed
chunk advisory, exit code 0. Raw log: `/tmp/opencode/t15/build.log`.

### 7. `npm ls three @types/three` → exact versions

```
$ npm ls three @types/three
cubeclicker@ /var/home/raultorraco/Documents/Projects/CubeClicker
└─┬ @cubeclicker/frontend@ -> ./src/frontend
  ├── @types/three@0.186.0
  └── three@0.186.1
EXIT=0
```

Exactly the two sanctioned dependencies, version-aligned in the 0.186 line (spec Q-1 checkpoint).
Raw log: `/tmp/opencode/t15/npm-ls.log`.

## Container / main / ws / config integrity (AC-19, AC-21)

Baseline `3ca4d57`. Both the scoped `git diff --stat` and `git diff` are **empty (0 lines)** for:

`compose.yaml`, `compose.smoke.yaml`, `.dockerignore`, `src/frontend/Dockerfile`,
`src/backend/Dockerfile`, `src/frontend/src/main.tsx`, `src/frontend/src/ws/**`,
`src/frontend/vite.config.ts`, `src/frontend/vitest.config.ts`, `src/frontend/tsconfig.json`,
`src/frontend/index.html`, `src/frontend/nginx.conf`, `src/backend/tsconfig.json`,
`src/backend/vitest.config.ts`, `eslint.config.mjs`, `tsconfig.json`, `README.md`, `tests/e2e/**`.

```
$ git diff --stat 3ca4d57..HEAD -- compose.yaml compose.smoke.yaml .dockerignore \
    src/frontend/Dockerfile src/backend/Dockerfile src/frontend/src/main.tsx src/frontend/src/ws \
    src/frontend/vite.config.ts src/frontend/vitest.config.ts src/frontend/tsconfig.json \
    src/frontend/index.html src/backend/tsconfig.json src/backend/vitest.config.ts \
    eslint.config.mjs tsconfig.json
lines=0
($ wc -c /tmp/opencode/t15/container-config-diff.log → 0)
```

`src/backend`, `tests/e2e`, `README.md`, `.env*` are all unchanged: `git diff --name-only` over
those paths is empty and `git status --porcelain -- '.env*'` is empty.

Per-commit path audit (§ below) shows **no commit in the feature range touched any** container,
config, backend, `main.tsx`, `ws/**` or `.env*` path.

### Optional `npm run smoke` → **executed, PASS 4/4**

```
$ npm run smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke
...
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
SMOKE PASS (4/4 checks)
EXIT=0
```

The stack was torn down afterwards (`podman compose -f compose.yaml -f compose.smoke.yaml down` →
containers + network removed; `podman ps` empty). This is the unchanged container regression
check: no new service/image/port/env/health signal (AC-21). Raw log:
`/tmp/opencode/t15/smoke.log`.

## Banned-matcher grep over all new/changed test files → no banned forms

Test files in the feature range (`git diff --name-only 3ca4d57..HEAD -- src/frontend/src`, filtered
to `*.test.ts(x)`) — 19 files:

```
src/frontend/src/App.test.tsx
src/frontend/src/browser-env.test.ts
src/frontend/src/game/board.test.ts
src/frontend/src/game/effects.test.ts
src/frontend/src/game/engine.test.ts
src/frontend/src/game/progression.test.ts
src/frontend/src/game/rotation.test.ts
src/frontend/src/game/session.test.ts
src/frontend/src/input/gestures.test.ts
src/frontend/src/input/keyboard.test.ts
src/frontend/src/render/cube-view.test.ts
src/frontend/src/render/particles.test.ts
src/frontend/src/render/picking.test.ts
src/frontend/src/render/scene.test.ts
src/frontend/src/render/starfield.test.ts
src/frontend/src/render/webgl.test.ts
src/frontend/src/ui/GameCanvas.test.tsx
src/frontend/src/ui/Hud.test.tsx
src/frontend/src/ui/theme.test.ts
```

```
$ grep -nE "expect\.anything|expect\.any\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeTruthy|toBeDefined|not\.toThrow|toHaveBeenCalled\(\)|toMatchSnapshot|toMatchInlineSnapshot" <all 19 files>
src/frontend/src/browser-env.test.ts:203:    expect(webgl.createWebGLRenderer).not.toHaveBeenCalled();
src/frontend/src/browser-env.test.ts:223:    expect(second.window.matchMedia).not.toHaveBeenCalled();
src/frontend/src/browser-env.test.ts:313:    expect(host.observers[1]!.disconnect).not.toHaveBeenCalled();
src/frontend/src/render/webgl.test.ts:91:    expect(threeMock.instances[1]!.setSize).not.toHaveBeenCalled();
EXIT=0
```

Assessment: **no banned matcher**. The only four hits are `not.toHaveBeenCalled()` **negative
zero-call assertions** (no eager renderer, no second-window matchMedia, observer #2 not
disconnected, renderer #2 not sized before its own call) — complete assertions of an empty call
log, not argument-unchecked positive `toHaveBeenCalled()`. No `expect.anything/any`, no
`objectContaining`/`arrayContaining`/`stringContaining`/`stringMatching`, no `toMatchObject`, no
snapshot matchers, no `toBeTruthy`/`toBeDefined`/`not.toThrow`.

Bounded exception count: **0** — `grep -nE "closeTo|toBeCloseTo" <19 files>` → no matches
(exit 1). Float/contrast values are asserted exactly (`18.26`, exact radians, exact gzip-free
numeric pins). Raw logs: `/tmp/opencode/t15/banned-matcher-grep-all.log`,
`/tmp/opencode/t15/closeTo-grep-all.log`.

## DOM-globals grep under `src/frontend/src/game/**` → none

```
$ grep -rnE "\bwindow\b|\bdocument\b|\bperformance\b|matchMedia|requestAnimationFrame|cancelAnimationFrame|\bnavigator\b|localStorage|sessionStorage|\bResizeObserver\b" src/frontend/src/game
(no output; exit 1; wc -c = 0)
```

`game/**` reads no DOM global. The word `devicePixelRatio` appears only as an **injected
environment method** (`session.ts:105` interface member, used at `session.ts:186` as
`env.devicePixelRatio()`), never as a global read; the only platform-**global** default fallback in
`game/**` is `options.random ?? Math.random` (`engine.ts:228`), which is not a DOM global and is
pinned by `engine.test.ts` "falls back to the platform random source when none is injected". The
sanctioned global reader stays `src/frontend/src/browser-env.ts` (outside `game/**`), covered by
`browser-env.test.ts` (6 stubbed-global tests). Raw logs:
`/tmp/opencode/t15/dom-globals-game.log`, `/tmp/opencode/t15/dom-globals-precise.log`.

## Dependency / scope greps (AC-19, AC-20)

- `from 'three'` imports are **named imports only** (14 sites); `grep -rnE "import \* as .* from 'three'|three/addons" src/frontend/src` → no matches (exit 1).
- `src/frontend/package.json` diff vs baseline adds exactly `three: ^0.186.1` (dependencies) and `@types/three: ^0.186.0` (devDependencies); the lockfile adds only those trees + their dev-only transitive entries (`@dimforge/rapier3d-compat`, `@tweenjs/tween.js`, `@types/stats.js`, `@types/webxr`, `fflate`, `meshoptimizer`).
- `grep -rnE "connection|localStorage|sessionStorage|\bfetch\(|WebSocket" src/frontend/src` (non-test): only the untouched `ws/connection.ts` scaffold and one `session.ts` doc-comment word "connections". The old `App.tsx` scaffold import of `createConnection` is gone (T14 rewrite, expected); no gameplay code references WS/persistence/economy.
- `grep -rnE "innerHTML|dangerouslySetInnerHTML|\beval\(|three/addons|import \* as .* from 'three'" src/frontend/src` → no matches (exit 1).
- No `.env*` change; no secret. `git status --porcelain -- '.env*'` → empty.

## Dependency audit (honest flag, not an AC)

`npm ci` reports 4 advisories; `npm audit` attributes all of them to **pre-existing Vitest dev
tooling**, none to this feature's dependencies:

```
metadata: {'info': 0, 'low': 0, 'moderate': 2, 'high': 0, 'critical': 2, 'total': 4}
vitest critical (direct) via @vitest/mocker, tinypool — fixAvailable vitest@5.0.5 (semver-major)
tinypool critical (transitive)
@vitest/coverage-v8 moderate (direct, via vitest)
@vitest/mocker moderate (transitive)
```

The lockfile diff adds no Vitest entry, so these advisories predate the feature and changing them
would be a semver-major dependency change — out of T15's scope (and out of `files_owned`). Flagged
for the project backlog, not treated as a feature defect. Raw log:
`/tmp/opencode/t15/npm-audit-summary.log`.

## Per-task diff audit against build-start baselines

Method: for each commit the **full path list** (`git show --name-only`) was checked against that
task's `files_owned` (tasks.md r4); any path outside ownership would print `UNEXPECTED`. Script
`/tmp/opencode/t15/audit-commits.sh`, output `/tmp/opencode/t15/commit-audit.log`:
**18/18 OK, zero unexpected paths.**

| Task | Commit(s) | Build-start baseline (parent) | Paths outside `files_owned` | Note |
| --- | --- | --- | --- | --- |
| T1 | `035d5c1` | `3ca4d57` | none | package.json + lockfile + log |
| T2 | `67eb4e2` | `035d5c1` | none | types/board/tests + glossary + log |
| T3 | `6e0ebe9` | `9056dd5` | none | (parallel batch; landed after T5) |
| T4 | `8dfcd30` | `67eb4e2` | none | |
| T5 | `9056dd5` | `8dfcd30` | none | |
| T6 | `91a21f2` | `4363f9a` | none | engine + 33 tests + log |
| T7 | `b17058a` | `824cdff` | none | **final hash `b17058a`**; reflog: `5e7fddc` → amended `5709f45` → re-committed `b17058a` (index-race repair). Brief's `5709f45 → 5e7fddc` order is the stale supersession record; both are superseded, no history rewrite |
| T8 | `2e5a321` + docs `824cdff`, `c212968` | `b17058a` / `91a21f2` | none | `+ docs` commits log-only (T8 ownership); the earlier index-race incident (`bbf403e` briefly carrying T8 files, superseded by `4363f9a`) is not in the current history: `git log --all --format=%h` has no `bbf403e`; `cube-view.ts`/`cube-view.test.ts` appear in exactly one commit (`2e5a321`) |
| T9 | `4363f9a` | `6e0ebe9` | none | superseded original hash `6494791` (cited by T6's log); not in current history |
| T10 | `c1b8d0d` | `1c91ad7` | none | |
| T11 | `1c91ad7` | `c212968` | none | |
| T12 | `7135d47` + docs `95b13d6` | `c1b8d0d` / `7135d47` | none | `+ docs` commit log-only (T12 ownership) |
| T13 | `02228ac` (skeleton) + `9b90190` (completion) | `95b13d6` / `1c1163c` | none against its (broadened) ownership | `02228ac` is the **non-conventional mixed commit** that also landed the previously-untracked feature docs (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/*`); code paths are exactly the T13 skeleton. Its `effects.ts`/`gestures.ts` hunks are **comment-only** (filtered diff has zero non-comment changed lines). `9b90190` carries `files_owned` only (+ its log) |
| T14 | `2ca10ce` | `9b90190` | none | App rewrite + `ui/**` + log |

File→commit map (`/tmp/opencode/t15/file-commit-map.log`) confirms no source file is touched by a
task other than its owner, with exactly the four planned T13 exceptions:

- `src/frontend/src/game/effects.ts` → `9056dd5` (T5) + `02228ac` (T13 comment-only);
- `src/frontend/src/input/gestures.ts` → `1c91ad7` (T11) + `02228ac` (T13 comment-only);
- `src/frontend/src/render/scene.ts` / `scene.test.ts` → `7135d47` (T12) + `02228ac` (T13 plan-r3 seam only);
- `src/frontend/src/game/session.ts` / `session.test.ts` → `02228ac` + `9b90190` (both T13).

### Explicit history notes audited

- **T7 hash supersession** — `git reflog --all | grep -E "b17058a|5709f45|5e7fddc"`:
  `b17058a HEAD@{15} commit`, `5709f45 HEAD@{17} commit (amend)`, `5e7fddc HEAD@{18} commit`.
  Current tree hash is `b17058a`; its path list is T7-only. No other hash remains reachable.
- **T13 commit shape** — `02228ac` ("First steps with frontend", non-conventional) + `9b90190`
  (`feat: add session wiring and WebGL bootstrap (T13)`). Both audited; contents as annotated
  above; no rewrite performed.
- **Unrelated commits inside the range** — `7ed1791` (`.opencode/agents/*.md` +
  `docs/features/agent-model-tuning/build-log-T1.md`) and `1c1163c`
  (`docs/features/agent-model-tuning/build-log-T2.md`) belong to the accepted
  `agent-model-tuning` feature, not to this one. Evidence: `git show --name-only 7ed1791 1c1163c`
  (`/tmp/opencode/t15/unrelated-commits.log`). No cube-game-frontend path is involved.
- **No history rewrite** was performed by T15 (no `rebase`/`amend`/`commit --amend`).

## Per-AC met/unmet table (AC-1 … AC-22)

| AC | Status | Evidence location |
| --- | --- | --- |
| AC-1 — Game shell renders on first paint | **met** | `App.test.tsx` "renders the full intro shell on first paint (default session, no DOM)" (exact `renderToStaticMarkup(<App/>)` incl. `tabindex="0"`, pinned `aria-label`, `touch-action:none`, HUD `Game statistics`, `Clicks: 0`, `Faces destroyed: 0`, `Cube 1`, skip hint); `ui/GameCanvas.test.tsx` "renders a focusable, labelled canvas…"; `ui/Hud.test.tsx` zero state |
| AC-2 — Intro phase and skip | **met** | `game/engine.test.ts` intro-phase group ("progresses the intro flight…", "ignores every gameplay event during the intro", "skips the intro on introSkip and never returns to it"); `game/session.test.ts` "skips the intro on a tap and ignores an intro drag (AC-2)", "maps taps and drags to the events each phase allows (injected engine)"; `input/keyboard.test.ts` "skips the intro on any key" |
| AC-3 — Galaxy starfield backdrop | **met** | `render/starfield.test.ts` "builds exactly STAR_COUNT stars inside one Points object", "maps the first and last star draws onto the star disk exactly", "never rebuilds the starfield…"; `render/scene.test.ts` "sets a black background and assembles the starfield…(AC-3, AC-16)", "drives the streak from the travel progress…" |
| AC-4 — Cube level structure | **met** | `game/board.test.ts` "creates six faces…25 mini-cubes each", "ids every mini-cube `face:row:col`…"; `render/cube-view.test.ts` "builds one body, six face grids, six plates…", "lays every face grid on the pinned first and last positions" |
| AC-5 — Click explodes a mini-cube (instant stats) | **met** | `game/engine.test.ts` "removes the mini-cube, counts the click and drains one explosion intent", "treats a repeat click…as a no-op"; `render/cube-view.test.ts` "zeroes one instance matrix while keeping its position"; `render/particles.test.ts` "plays a real EXPLOSION_PARTICLE_COUNT burst and releases it after its lifetime"; `render/scene.test.ts` "hides the exploding instance and plays its burst at the mini-cube origin (AC-5)" |
| AC-6 — Pointer tap/drag classification + rotation | **met** | `input/gestures.test.ts` "classifies 39 px…", "classifies exactly 40 px…(threshold inclusive)", "classifies 41 px…as a drag", dominant-axis group; `render/picking.test.ts` "ignores a hit on a face that is not the given front face"; `game/rotation.test.ts` "settles on exact quarter-turn multiples for every reachable face"; `game/session.test.ts` "explodes the front-face mini-cube under a playing tap…", "re-reads the live front face and cube view on every tap (AC-6)"; `render/scene.test.ts` "exposes the live cube view through the rebuild-aware accessor (plan-r3 seam, AC-6)". **Note (plan-delta-r3 F2):** spec Q-3's paraphrase "drag ≥ 40 px" is a pre-existing non-AC wording mismatch; AC-6 evidence is the 39/40/41 px test pins, and spec r2 is deliberately **not** edited |
| AC-7 — Keyboard rotation reaches every face | **met** | `input/keyboard.test.ts` "maps the arrow keys…", "reaches all six faces with arrow keys alone (AC-7)"; `game/rotation.test.ts` "reaches all six faces through keyboard steps only (AC-7)" |
| AC-8 — Keyboard selection cursor | **met** | `game/rotation.test.ts` cursor group ("clamps at all four edges…", "re-anchors to the nearest remaining…", "breaks ties by the lowest row…"); `game/engine.test.ts` "explodes the cursor cell through the identical path as a click (AC-8)" |
| AC-9 — Face destruction | **met** | `game/board.test.ts` "flags `faceCleared` only on the removal that empties that face"; `game/engine.test.ts` "counts the face, drains faceCleared and starts one auto-rotation step", "re-evaluates the target after each step…", "breaks a nearest-face tie with FACE_IDS order"; `render/cube-view.test.ts` "detaches the face, zeroes its plate opacity and disposes its resources once"; `render/scene.test.ts` "fades a cleared face over the pinned 400 ms…(AC-9)" |
| AC-10 — All faces gone → travel → next styled cube | **met** | `game/engine.test.ts` "clears a whole cube level, travels and rebuilds the next styled cube"; `game/progression.test.ts` "cycles the style ids across seven levels…"; `render/scene.test.ts` "rebuilds the cube view in the new style on levelChanged (AC-10)" |
| AC-11 — Live HUD stats | **met** | `game/engine.test.ts` referential-stability group ("returns the same object until a value changes"); `ui/Hud.test.tsx` "renders live counters and the 1-based cube level from its props"; `App.test.tsx` "binds the HUD to the session snapshot values (AC-11)"; `game/session.test.ts` "notifies on snapshot changes and stops after unsubscribe (AC-11)" |
| AC-12 — Reduced motion profile | **met** | `game/effects.test.ts` "pins the reduced-motion profile to 150/150/0/0/100"; `game/engine.test.ts` reduced-motion group ("collapses the phases, the rotation and the explosion burst", "completes a whole face clear…", "switches profiles live…"); `game/session.test.ts` "follows the injected motion source from attach and on a live change (AC-12)"; `browser-env.test.ts` "forwards reduced-motion changes and removes the exact listener (AC-12)" |
| AC-13 — Touch/mobile and responsive canvas | **met** | `game/session.test.ts` "sizes the renderer from the container rect and the capped pixel ratio (AC-13)", "re-applies size, capped pixel ratio and camera projection on the injected resize (AC-13)"; `render/webgl.test.ts` "constructs three with the host canvas and antialiasing (AC-13)"; `input/gestures.test.ts` pointer-type coverage; AC-1 row for `touch-action:none` |
| AC-14 — Accessibility semantics and announcements | **met** | `App.test.tsx` three per-phase live-region tests (intro/travel/playing, playing empty but present); `ui/Hud.test.tsx` "is not a live region: neither counter span carries role or aria-live (AC-14)"; `ui/theme.test.ts` "keeps HUD text at WCAG AA contrast…" (exact `18.26`, `≥ 4.5`); rationale code comment at `App.tsx:10–19` |
| AC-15 — Frame loop lifecycle and disposal | **met** | `game/session.test.ts` "cancels the frame, releases everything exactly once and never renders again (AC-15)", "pauses the loop while hidden and resumes it from the current time (AC-15)", "never starts the loop while the tab is already hidden", "is idempotent: a second attach adds no listener, frame or renderer"; `render/webgl.test.ts` rAF group; `render/scene.test.ts` "disposes every resource exactly once and is idempotent (AC-15)" |
| AC-16 — Bounded rendering resources | **met** | `render/scene.test.ts` "sets a black background and assembles the starfield, lights, cube and particles (AC-3, AC-16)", "returns to the baseline object counts after 10 explosion cycles (AC-16)"; `render/particles.test.ts` "recycles the oldest burst when a 4th 24-particle burst is spawned", "reuses the same drawable and buffers across 10 spawn/release cycles" |
| AC-17 — Coverage gate and test bar | **met** | § 5 coverage (both workspaces ≥ 80 × four metrics), § Banned-matcher grep (0 banned forms, 0 bounded exceptions), § DOM-globals grep (none), exclusions unchanged (config diff empty) |
| AC-18 — Glossary terms | **met** | `docs/product/glossary.md` diff (T2 `67eb4e2`): adds **cube level**, **face**, **mini-cube** in the existing definition+example format; no existing term redefined (`click`, economy terms untouched); `/tmp/opencode/t15/glossary-diff.log` |
| AC-19 — Scope discipline | **met** | § Container/main/ws/config integrity (scoped diff empty), § Dependency/scope greps (two deps only; no backend/WS/persistence/economy code), `npm ls` exact versions, no `.env*`, per-commit path audit 18/18 |
| AC-20 — Build within bundle budget | **met** | § 6 build: success, initial JS gzip **209.10 kB ≤ 350 kB**; § Dependency/scope greps: named `three` imports only, no addons/namespace import |
| AC-21 — Containerization additive-only | **met** | § Container/main/ws/config integrity: no service/image/port/env/health change; `npm run smoke` **PASS 4/4** on the unchanged container stack |
| AC-22 — Camera flights: intro and travel | **met** | `render/scene.test.ts` "pins the camera lens and the rest position looking at the origin (AC-22)", "flies the intro from (0,0,60) through (0,0,18) to rest", "pulls away during travel through (0,0,21.75) and (0,0,51) to (0,0,90)", "keeps the camera at rest through both flown phases under reduced motion"; exact easing values also pinned in `game/effects.test.ts` ("yields the AC-22 intro camera positions…", "yields the AC-22 travel camera positions…") |

**All 22 ACs met; none unmet.**

## Known residuals (recorded explicitly, not omitted)

1. **Thin React effect bodies** — `ui/GameCanvas.tsx` lines 23–30 (the mount effect
   `attach`/`dispose`) are not executed by the SSR-only tier (no DOM environment by design, plan
   D-5): `src/ui` 79.48 % statements / 61.9 % on `GameCanvas.tsx`. The session lifecycle itself is
   fully covered in `game/session.test.ts`; the workspace aggregate still clears 80 on all four
   metrics (99.17 / 99.13 / 100 / 99.17).
2. **Real GL context mocked** — `render/webgl.test.ts` mocks the `three` `WebGLRenderer`
   constructor (the one thing node cannot create); everything else in the render tier runs against
   real three.js objects. Documented in spec § Testing strategy.
3. **Two small uncovered branch lines outside T15's scope** — `game/session.ts:173` (98.18 %
   branches; T13 default-argument arm) and `render/picking.ts:88–89` (93.54 % / 87.5 %). Both are
   documented by T12/T13 and do not threaten the aggregate gate.
4. **Retained scaffold `ws/connection.ts`** at 95.34 % (lines 53–54, 99–100) — pre-existing
   module kept for the future real-time feature; unchanged by this feature.
5. **plan-delta-r3 F2** — spec Q-3 "≥ 40 px" paraphrase contradicts the inclusive-tap semantics
   pinned by tests (39→tap, 40→tap, 41→drag). Non-AC, pre-existing; AC-6 evidence is the tests.
   Spec r2 deliberately not edited (per the delta ruling).
6. **`02228ac` commit shape** — non-conventional message and mixed content (T13 skeleton +
   previously-untracked feature docs). No history rewrite; audited above.
7. **Superseded hashes in the audit trail** — T7 (`5e7fddc`/`5709f45` → final `b17058a`), T9
   (`6494791` → final `4363f9a`), T8's index-race incident (`bbf403e` superseded by `4363f9a`).
   None reachable in the current tree; final tree is clean (per-commit audit 18/18 OK).
8. **`npm audit` advisories** — 4 (2 moderate, 2 critical) all traced to pre-existing Vitest dev
   tooling, not the feature deps; a semver-major upgrade is out of T15's scope (flagged, not
   fixed).
9. **Existing working-tree doc changes** — `docs/features/README.md`,
   `docs/features/cube-game-frontend/status.md`, `tasks.md` and the untracked
   `docs/features/agent-model-tuning/**` were already modified/untracked before T15
   (orchestrator/other feature) and are **not** staged or committed here.

## Manual browser checklist (not an AC) — **not executed — environment**

No browser (headed or automated) is available to this agent, and browser automation is explicitly
out of scope for this feature (spec § Testing strategy: "no browser automation … no browser
dependency is added"). Steps recorded for a human pass after `podman compose up --build`
(http://localhost:5173), all **not executed — environment**:

1. Initial load → black page with the galaxy starfield visible immediately; intro camera flight in
   progress; skip hint "Click or press any key to skip" visible. — not executed — environment
2. Click / press any key during the intro → flight ends, hint clears (live region empties), phase
   `playing`. — not executed — environment
3. Click a mini-cube on the front face → cube disappears, particle burst, `Clicks` +1 immediately.
   — not executed — environment
4. Click a mini-cube on a partially visible non-front face → nothing happens (no explosion, no
   stat change). — not executed — environment
5. Drag the canvas > 40 px → one 90° rotation step; drag on touch (`touch-action:none`) does not
   scroll the page. — not executed — environment
6. Arrow keys rotate; W/A/S/D move the highlight cursor; Enter/Space explode the highlighted
   mini-cube; canvas shows a visible focus ring. — not executed — environment
7. Clear a whole face → plate fades out, `Faces destroyed` +1, remaining faces playable. — not
   executed — environment
8. Clear all six faces → travel transition (streak), then a new cube in a different style with
   stats carried over and `Cube 2`. — not executed — environment
9. Enable OS reduced motion → short intro/travel, instant rotation, no particle bursts. — not
   executed — environment
10. Mobile/touch device (or devtools touch emulation) → tap explodes, drag rotates, no page
    scroll/zoom. — not executed — environment

Structural stand-ins recorded instead: `npm run smoke` PASS 4/4 (page served `text/html`,
backend health + two concurrent WS clients) and the SSR markup tests; these do not substitute for
the visual pass, which remains open for a human.

## Acceptance audit (T15's own `acceptance:` line)

- **All ACs (verification gate; per-AC evidence table required) → met.** Table above, all 22 met.
- **AC-17 → met.** Both workspaces ≥ 80 on all four metrics; 0 banned matchers; 0 bounded
  exceptions; no exclusion/threshold change.
- **AC-19 → met.** Container/config/`main.tsx`/`ws/**` diffs empty; two dependencies only; no
  backend/WS/persistence/economy code.
- **AC-20 → met.** `npm run build` exit 0; initial JS **209.10 kB gzip ≤ 350 kB**; named imports
  only.
- **AC-21 → met.** Container files structurally unchanged; `npm run smoke` **PASS 4/4**.

## Deviations from spec

- None. This task changed no source, test, config, container, spec, plan, tasks or status file;
  only `docs/features/cube-game-frontend/build-log-T15.md` (its `files_owned`) is added.

## Commands / logs

| Command | Log | Exit |
| --- | --- | --- |
| `npm ci` | `/tmp/opencode/t15/npm-ci.log` | 0 |
| `npm run lint` | `/tmp/opencode/t15/lint.log` | 0 |
| `npm run typecheck` | `/tmp/opencode/t15/typecheck.log` | 0 |
| `npm test` | `/tmp/opencode/t15/test.log` | 0 |
| `npm run coverage` | `/tmp/opencode/t15/coverage.log` | 0 |
| `npm run build` | `/tmp/opencode/t15/build.log` | 0 |
| `npm ls three @types/three` | `/tmp/opencode/t15/npm-ls.log` | 0 |
| `npm run smoke` | `/tmp/opencode/t15/smoke.log` | 0 (PASS 4/4) |
| container/config diff (empty) | `/tmp/opencode/t15/container-config-diff.log` (0 bytes) | 0 |
| banned-matcher grep | `/tmp/opencode/t15/banned-matcher-grep-all.log` | 4 negatives only |
| DOM-globals grep | `/tmp/opencode/t15/dom-globals-game.log` (0 bytes) | 1 (no matches) |
| per-commit audit | `/tmp/opencode/t15/commit-audit.log` | 18/18 OK |
| file→commit map | `/tmp/opencode/t15/file-commit-map.log` | — |
