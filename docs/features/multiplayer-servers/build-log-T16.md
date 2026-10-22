# Build log — T16 — Verify & integrate

Task: T16 (2026-10-22); second verification pass 2026-10-22 after T17 (`caab534`)
Files changed: first pass — `docs/product/glossary.md`, `docs/features/multiplayer-servers/build-log-T16.md`; second pass — `docs/features/multiplayer-servers/build-log-T16.md` only
What changed & why: added the AC-27 glossary terms (**game server**, **server member**, **spectating**) and extended **cube world position** with the online ring-slot definition; ran the full T16 verification suite and recorded raw evidence, a per-AC met/unmet table, the honest coverage residual, the manual browser checklist status, and the diff/branch audit. The second pass re-ran the same gate after T17 and updates the AC-19/AC-22 rows (§ 1.1).

Decisions:
- Verification only: no source, test, compose, package or other doc file was modified in either pass. In the first pass the two unmet ACs (AC-19, AC-22) were recorded precisely for the follow-up corrective task (T17); the second pass records their closure.
- Second pass (post-T17): AC-19 and AC-22 are **met** with T17's engine/session/scene tests (§ 1.1, § 4). The only red command encountered was `npm run smoke` against the warm dev stack, which is the documented "fresh backend required" precondition (T15 § Decisions, Q-T15-1), not a code failure; stopping the stack first (T15's documented smoke procedure) produced `SMOKE PASS (8/8 checks)` (§ 1.1.2, F7).
- AC-27's "no other term redefined" is read literally: only the `cube world position` entry changed and the three new entries were added. The stale parenthetical in `cube level` ("online occupancy of those positions is a future feature") was left untouched and is noted in § Findings.
- Evidence locations are test names, not line numbers, except where a source/build-log line is needed to prove a gap. Test names are quoted exactly as they appear in the files.

---

## 1. Verification environment

| Item | Value |
| --- | --- |
| Node | `v24.22.0` |
| npm | `11.19.1` |
| Podman | `5.8.7` (compose provider: `/usr/local/bin/docker-compose`) |
| Repo HEAD before T16 commit | `29c8d93 chore: extend the container smoke test for multiplayer servers (T15)` |
| Branch | `main` (tracking `origin/main`, **ahead 30**, no push performed) |
| Feature baseline used for diff audit | `f8cf3e1^` = `37dd07c docs: record T3 verification pass for cube-tile-lines-and-controls (T3)` |

Command transcripts below are the actual stdout/stderr of this run; the coverage and smoke transcripts were captured to `/tmp/opencode/t16-*.log` and are reproduced verbatim (coverage tables included in full).

---

## 1.1 Second pass (post-T17) — 2026-10-22

T17 (`caab534 fix: reset the view instantly on mid-flight resume and keep spectators viewing (T17)`) changed only `src/frontend/src/game/engine.ts`, `src/frontend/src/game/session.ts`, `engine.test.ts`, `session.test.ts`, `src/frontend/src/render/scene.test.ts` and its build log (6 files, +794/−4). No backend, compose, package, lockfile, config or threshold file changed. This pass re-ran the full T16 gate at that HEAD; § 2 below remains the first-pass transcript, and this section supersedes its numbers where they differ.

| Item | Second-pass value |
| --- | --- |
| HEAD | `caab534cc9c173393525777eff52b9c71033f4e8` (`caab534`) |
| Branch | `main` (tracking `origin/main`, **ahead 32**, no push performed) |
| Node / npm / Podman | `v24.22.0` / `11.19.1` / `5.8.7` |
| `npm ci` | **skipped** — `git diff --name-only 22c8298..HEAD -- package.json package-lock.json src/backend/package.json src/frontend/package.json` is empty, `node_modules` is present in the root and both workspaces, and `package-lock.json` keeps its pre-feature mtime `2026-10-18 19:51:26`; no dependency changed between the passes |
| Raw logs | `/tmp/opencode/t16-pass2-{lint,typecheck,test,coverage,build,smoke,smoke-clean}.log` (ANSI colour escapes stripped below) |

### 1.1.1 Gate results

| Command | Exit | Result |
| --- | --- | --- |
| `npm run lint` | **0** | no diagnostics |
| `npm run typecheck` | **0** | both workspaces |
| `npm test` | **0** | 782 → **788 tests** (backend 180, frontend 602 → **608**) |
| `npm run coverage` | **0** | backend **98.47 / 97.09 / 100 / 98.47**; frontend **99.11 / 98.29 / 99.26 / 99.11** (statements/branches/functions/lines, both ≥ 80) |
| `npm run build` | **0** | initial JS **793.98 kB / gzip 216.30 kB** ≤ the pinned 350 KB budget |
| `npm run smoke` | **0** | `SMOKE PASS (8/8 checks)` on the documented fresh-backend stack (§ 1.1.2) |

#### `npm run lint` → exit 0

```text
$ npm run lint

> lint
> eslint .
```

#### `npm run typecheck` → exit 0

```text
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

#### `npm test` → exit 0 (788 tests)

```text
$ npm test

> test
> npm run test --workspaces --if-present


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/cubes.test.ts (24 tests) 6ms
 ✓ src/game/config.test.ts (13 tests) 5ms
 ✓ src/game/servers.test.ts (36 tests) 7ms
 ✓ src/game/players.test.ts (13 tests) 8ms
 ✓ src/game/protocol.test.ts (56 tests) 7ms
 ✓ src/game/hub.test.ts (31 tests) 40ms
 ✓ src/app.test.ts (7 tests) 112ms

 Test Files  7 passed (7)
      Tests  180 passed (180)
   Start at  11:19:59
   Duration  446ms (transform 324ms, setup 0ms, collect 636ms, tests 184ms, environment 1ms, prepare 379ms)


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/multiplayer/spectate.test.ts (23 tests) 5ms
 ✓ src/ui/theme.test.ts (2 tests) 4ms
 ✓ src/render/webgl.test.ts (5 tests) 10ms
 ✓ src/game/effects.test.ts (28 tests) 13ms
 ✓ src/game/progression.test.ts (10 tests) 10ms
 ✓ src/browser-env.test.ts (6 tests) 18ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 15ms
 ✓ src/ws/connection.test.ts (10 tests) 26ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 17ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 11ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 5ms
 ✓ src/game/rotation.test.ts (15 tests) 8ms
 ✓ src/game/board.test.ts (18 tests) 21ms
 ✓ src/ui/Hud.test.tsx (3 tests) 9ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 12ms
 ✓ src/ui/UserPanel.test.tsx (5 tests) 11ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 12ms
 ✓ src/game/engine.test.ts (61 tests) 36ms
 ✓ src/input/gestures.test.ts (21 tests) 7ms
 ✓ src/input/keyboard.test.ts (13 tests) 12ms
 ✓ src/render/particles.test.ts (19 tests) 20ms
 ✓ src/render/cube-view.test.ts (32 tests) 59ms
 ✓ src/render/picking.test.ts (12 tests) 37ms
 ✓ src/render/starfield.test.ts (15 tests) 89ms
 ✓ src/render/world.test.ts (19 tests) 52ms
 ✓ src/App.test.tsx (8 tests) 25ms
 ✓ src/render/scene.test.ts (69 tests) 133ms
 ✓ src/game/session.test.ts (43 tests) 123ms

 Test Files  28 passed (28)
      Tests  608 passed (608)
   Start at  11:20:00
   Duration  720ms (transform 2.97s, setup 0ms, collect 7.52s, tests 799ms, environment 4ms, prepare 2.00s)
```

Deltas vs the first pass (§ 2.4): `engine.test.ts` 58 → **61** (+3), `session.test.ts` 41 → **43** (+2), `scene.test.ts` 68 → **69** (+1); backend unchanged at 180; frontend 602 → **608**; total 782 → **788**.

#### `npm run coverage` → exit 0 (both workspaces ≥ 80 on all four metrics)

```text
$ npm run coverage

> coverage
> npm run coverage --workspaces --if-present


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/config.test.ts (13 tests) 7ms
 ✓ src/game/cubes.test.ts (24 tests) 8ms
 ✓ src/game/players.test.ts (13 tests) 7ms
 ✓ src/game/servers.test.ts (36 tests) 7ms
 ✓ src/game/hub.test.ts (31 tests) 26ms
 ✓ src/game/protocol.test.ts (56 tests) 8ms
 ✓ src/app.test.ts (7 tests) 125ms

 Test Files  7 passed (7)
      Tests  180 passed (180)
   Start at  11:20:04
   Duration  554ms (transform 232ms, setup 0ms, collect 586ms, tests 189ms, environment 1ms, prepare 534ms)

 % Coverage report from v8
--------------|---------|----------|---------|---------|------------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s      
--------------|---------|----------|---------|---------|------------------------
All files     |   98.47 |    97.09 |     100 |   98.47 |                        
 src          |     100 |      100 |     100 |     100 |                        
  app.ts      |     100 |      100 |     100 |     100 |                        
 src/game     |   98.38 |    96.87 |     100 |   98.38 |                        
  config.ts   |     100 |      100 |     100 |     100 |                        
  cubes.ts    |     100 |      100 |     100 |     100 |                        
  hub.ts      |   96.62 |    92.79 |     100 |   96.62 | ...344,372-373,390-392 
  players.ts  |     100 |      100 |     100 |     100 |                        
  protocol.ts |     100 |      100 |     100 |     100 |                        
  servers.ts  |     100 |      100 |     100 |     100 |                        
--------------|---------|----------|---------|---------|------------------------

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/game/progression.test.ts (10 tests) 6ms
 ✓ src/ui/theme.test.ts (2 tests) 3ms
 ✓ src/ws/connection.test.ts (10 tests) 15ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 8ms
 ✓ src/render/webgl.test.ts (5 tests) 12ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 6ms
 ✓ src/browser-env.test.ts (6 tests) 9ms
 ✓ src/game/effects.test.ts (28 tests) 13ms
 ✓ src/game/rotation.test.ts (15 tests) 9ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 19ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 20ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 6ms
 ✓ src/game/board.test.ts (18 tests) 22ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 12ms
 ✓ src/render/particles.test.ts (19 tests) 21ms
 ✓ src/input/gestures.test.ts (21 tests) 11ms
 ✓ src/input/keyboard.test.ts (13 tests) 13ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 15ms
 ✓ src/ui/Hud.test.tsx (3 tests) 16ms
 ✓ src/ui/UserPanel.test.tsx (5 tests) 13ms
 ✓ src/render/cube-view.test.ts (32 tests) 63ms
 ✓ src/render/starfield.test.ts (15 tests) 81ms
 ✓ src/game/engine.test.ts (61 tests) 57ms
 ✓ src/render/picking.test.ts (12 tests) 33ms
 ✓ src/render/world.test.ts (19 tests) 46ms
 ✓ src/App.test.tsx (8 tests) 21ms
 ✓ src/game/session.test.ts (43 tests) 111ms
 ✓ src/render/scene.test.ts (69 tests) 149ms

 Test Files  28 passed (28)
      Tests  608 passed (608)
   Start at  11:20:05
   Duration  920ms (transform 2.98s, setup 0ms, collect 7.68s, tests 812ms, environment 6ms, prepare 2.50s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   99.11 |    98.29 |   99.26 |   99.11 |                   
 src               |     100 |      100 |     100 |     100 |                   
  App.tsx          |     100 |      100 |     100 |     100 |                   
  browser-env.ts   |     100 |      100 |     100 |     100 |                   
 src/game          |   99.14 |    98.14 |     100 |   99.14 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |     100 |      100 |     100 |     100 |                   
  progression.ts   |     100 |      100 |     100 |     100 |                   
  rotation.ts      |     100 |      100 |     100 |     100 |                   
  session.ts       |   98.08 |    95.76 |     100 |   98.08 | ...28-629,633-636 
  types.ts         |     100 |      100 |     100 |     100 |                   
 src/input         |     100 |      100 |     100 |     100 |                   
  gestures.ts      |     100 |      100 |     100 |     100 |                   
  keyboard.ts      |     100 |      100 |     100 |     100 |                   
 src/multiplayer   |   99.73 |    99.24 |     100 |   99.73 |                   
  protocol.ts      |     100 |      100 |     100 |     100 |                   
  server-state.ts  |   99.18 |    97.22 |     100 |   99.18 | 119-120           
  spectate.ts      |     100 |      100 |     100 |     100 |                   
  transport.ts     |     100 |      100 |     100 |     100 |                   
 src/render        |   99.83 |    97.85 |     100 |   99.83 |                   
  cube-view.ts     |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |     100 |      100 |     100 |     100 |                   
  scene.ts         |   99.54 |    98.41 |     100 |   99.54 | 757-758           
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |     100 |    93.58 |     100 |     100 | ...85,193,271-274 
 src/ui            |   88.98 |      100 |   66.66 |   88.98 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  GameCanvas.tsx   |    61.9 |      100 |     100 |    61.9 | 23-30             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  UserPanel.tsx    |      90 |      100 |   33.33 |      90 | 48-49,71-73       
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------
```

| Workspace | Statements | Branches | Functions | Lines | Gate |
| --- | --- | --- | --- | --- | --- |
| `@cubeclicker/backend` | **98.47** | **97.09** | **100** | **98.47** | PASS (≥ 80 each) |
| `@cubeclicker/frontend` | **99.11** | **98.29** | **99.26** | **99.11** | PASS (≥ 80 each) |

First pass → second pass: backend identical; frontend 99.04/98.28/99.25/99.04 → **99.11/98.29/99.26/99.11**. `engine.ts` is **100/100/100/100** (the new cancel seam is fully exercised); `session.ts` 97.71/95.65/100/97.71 → **98.08/95.76/100/98.08**. The remaining `session.ts` uncovered ranges (`...28-629,633-636`) are the same pre-existing reconnection/attachment guards recorded in § 5; no threshold, exclusion or config changed.

#### `npm run build` → exit 0 (initial JS gzip 216.30 KB)

```text
$ npm run build

> build
> npm run build --workspaces --if-present


> build
> tsc


> build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 58 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.40 kB │ gzip:   0.27 kB
dist/assets/index-DTvgIu_V.css    2.96 kB │ gzip:   0.94 kB
dist/assets/index-DeHy2RIV.js   793.98 kB │ gzip: 216.30 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.25s
```

Exit **0**; initial JS gzip **216.30 KB** (same artifact hash as T17, +0.03 KB vs the first pass) ≤ the pinned `BUNDLE_BUDGET_GZ_KB = 350` (AC-24). The >500 KB chunk warning is the pre-existing three.js bundle warning, not a budget failure.

### 1.1.2 `npm run smoke` — 8/8 PASS on the documented fresh-backend stack

The **first** second-pass invocation ran against the warm dev stack left behind by T16's smoke run (backend container created `2026-10-22 10:38`, `Up 42 minutes`). `compose run` reuses running dependencies and the hub keeps `nextServerId` for the process lifetime (server ids are never reused, AC-3), so the first joins saw ids 3/4 instead of the hard-coded 1/2:

```text
$ npm run smoke

> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-frontend-1 Running 
 Container cubeclicker-backend-1 Running 
 Container cubeclicker-smoke-run-f18388a65c65 Creating 
 Container cubeclicker-smoke-run-f18388a65c65 Created 
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
FAIL multiplayer join: two clients land on server 1 (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — A welcome.serverId expected 1, got 3; B welcome.serverId expected 1, got 3
FAIL multiplayer overflow: the third client lands on server 2 (X = 2) — expected C welcome.serverId 2 (overflow at X = 2), got 4
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1002ms
SMOKE FAIL (6/8 checks passed)

Error: executing /usr/local/bin/docker-compose -f compose.yaml -f compose.smoke.yaml run --rm smoke: exit status 1
```

This is **not a code failure**: T17 changed no backend/compose file, and T15 already recorded the identical precondition — "**Fresh backend required.** The smoke check expects a fresh registry (server 1 then 2) … `run` reuses running dependencies" — plus open question Q-T15-1 ("the script does not reset state"). T15's documented procedure is to stop the stack first so the smoke command creates the backend from the merged smoke config. Re-run after exactly that:

```text
$ podman compose -f compose.yaml -f compose.smoke.yaml down
 Container cubeclicker-frontend-1 Stopping 
 Container cubeclicker-backend-1 Stopping 
 Container cubeclicker-backend-1 Stopped 
 Container cubeclicker-backend-1 Removing 
 Container cubeclicker-backend-1 Removed 
 Container cubeclicker-frontend-1 Stopped 
 Container cubeclicker-frontend-1 Removing 
 Container cubeclicker-frontend-1 Removed 
 Network cubeclicker_default Removing 
 Network cubeclicker_default Removed 

$ npm run smoke

> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Network cubeclicker_default Creating 
 Network cubeclicker_default Creating 
 Network cubeclicker_default Created 
 Network cubeclicker_default Created 
 Container cubeclicker-frontend-1 Creating 
 Container cubeclicker-backend-1 Creating 
 Container cubeclicker-frontend-1 Created 
 Container cubeclicker-backend-1 Created 
 Container cubeclicker-frontend-1 Starting 
 Container cubeclicker-backend-1 Starting 
 Container cubeclicker-frontend-1 Started 
 Container cubeclicker-backend-1 Started 
 Container cubeclicker-smoke-run-68b73d0cf4c5 Creating 
 Container cubeclicker-smoke-run-68b73d0cf4c5 Created 
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on server 1 (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined
PASS multiplayer overflow: the third client lands on server 2 (X = 2)
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1003ms
SMOKE PASS (8/8 checks)
```

Smoke exit: **0**. The base dev stack was restored afterwards with `podman compose up -d` (exit **0**), as T15 did. The warm-stack non-idempotency is recorded as observation **F7** (§ 7); a restart step or id-scoped assertions would be a `tests/e2e/smoke.mjs` change owned by a future task, not by this verification pass.

### 1.1.3 Banned-matcher and storage/purity re-scan

Same scope as § 2.8 — the 20 test files changed by the feature range `f8cf3e1^..HEAD` (T17 changed three **existing** test files and added none):

```text
$ FILES=$(git diff --name-only f8cf3e1^..HEAD | grep -E '\.(test|spec)\.(ts|tsx)$')
$ echo "FILES=$(echo "$FILES" | wc -l)"
FILES=20
$ grep -nE 'expect\.(anything|any)\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toHaveBeenCalled\(\)|toBeTruthy\(|toBeDefined\(|not\.toThrow\(|toMatchSnapshot|toMatchInlineSnapshot|toBeCloseTo|expect\.closeTo' $FILES
banned_grep_exit=1   # NO MATCHES
$ grep -nE '\.toHaveBeenCalled\(\)' $FILES
called_grep_exit=1   # NO MATCHES
$ grep -nE 'toMatchSnapshot|toMatchInlineSnapshot|expect\.hasAssertions|expect\.assertions' $FILES
snapshot_grep_exit=1   # NO MATCHES
```

Argument-unchecked `toHaveBeenCalled()` is clean. The only call-count assertions are exact zero checks, reviewed and unchanged from § 2.8:

```text
src/frontend/src/game/session.test.ts:1036:    expect(listener).toHaveBeenCalledTimes(0);
src/frontend/src/render/scene.test.ts:1031:      expect(dispose).toHaveBeenCalledTimes(0);
src/frontend/src/render/scene.test.ts:1512:    expect(geometryDispose).toHaveBeenCalledTimes(0);
src/frontend/src/render/scene.test.ts:1985:    expect(oldWorldApply).toHaveBeenCalledTimes(0);
src/frontend/src/render/world.test.ts:365:    expect(disposeSpy).toHaveBeenCalledTimes(0);
src/frontend/src/render/world.test.ts:369:    expect(disposeSpy).toHaveBeenCalledTimes(0);
src/frontend/src/render/world.test.ts:373:    expect(disposeSpy).toHaveBeenCalledTimes(0);
```

Storage / persistence / purity greps (same commands as § 2.9):

```text
$ grep -rnE "document\.cookie|localStorage|sessionStorage" src/frontend/src --include='*.ts' --include='*.tsx' --exclude='*.test.*' \
  | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(/\*|\*|//)'
storage_exit=1   # NO MATCHES
$ grep -rnE "\bfrom ['\"](node:)?fs|require\(['\"](node:)?fs|readFile|writeFile|createWriteStream|sqlite|database" src/backend/src --include='*.ts' --exclude='*.test.ts'
fs_exit=1   # NO MATCHES
$ grep -rnE "Math\.random|\b(window|document|navigator|globalThis)\." \
    src/backend/src/game src/frontend/src/game src/frontend/src/multiplayer \
    --include='*.ts' --exclude='*.test.ts' \
  | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(/\*|\*|//)'
random_dom_exit=1   # NO MATCHES
$ git status --porcelain | grep -E '\.env'
env_grep_exit=1
$ git ls-files | grep -E '(^|/)\.env'
env_ls_exit=1
```

No storage, filesystem, `Math.random`, DOM-global or `.env*` use was added by T17 or this pass; the production tree is unchanged by the second pass.

### 1.1.4 AC table impact

The § 4 rows for **AC-19** and **AC-22** are replaced with the met evidence; no other AC row was downgraded. The second-pass numbers in § 1.1.1 also refresh the AC-24 (788/788 tests, banned-matcher scan clean, gzip 216.30 ≤ 350) and AC-26 (smoke `8/8`) evidence references. The per-AC outcome is now **27/27 met** (AC-1 met-with-note; AC-10 met with the spec erratum noted).

---

## 2. Gate transcripts (first pass, pre-T17)

These are the first-pass transcripts and remain the record of the T16 verification before the corrective task. § 1.1 already re-ran every command after T17; the AC-19/AC-22 conclusions below were superseded there.

### 2.1 `npm ci` → exit 0

```text
$ npm ci
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 333 packages, and audited 336 packages in 2s

92 packages are looking for funding
  run `npm fund` for details

4 vulnerabilities (2 moderate, 2 critical)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
npm warn install-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn install-scripts   esbuild@0.28.2 (postinstall: node install.js)
npm warn install-scripts
npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.
```

Exit: **0**. The 4 audit findings are pre-existing dependency advisories, not new packages (the lockfile is unchanged by this feature).

### 2.2 `npm run lint` → exit 0

```text
$ npm run lint

> lint
> eslint .
```

Exit: **0** (no diagnostics).

### 2.3 `npm run typecheck` → exit 0

```text
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

Exit: **0** (both workspaces).

### 2.4 `npm test` → exit 0 (782 tests)

```text
$ npm test

> test
> npm run test --workspaces --if-present


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/config.test.ts (13 tests) 5ms
 ✓ src/game/cubes.test.ts (24 tests) 7ms
 ✓ src/game/servers.test.ts (36 tests) 10ms
 ✓ src/game/players.test.ts (13 tests) 7ms
 ✓ src/game/hub.test.ts (31 tests) 24ms
 ✓ src/game/protocol.test.ts (56 tests) 7ms
 ✓ src/app.test.ts (7 tests) 116ms

 Test Files  7 passed (7)
      Tests  180 passed (180)
   Start at  10:51:16
   Duration  454ms (transform 321ms, setup 0ms, collect 625ms, tests 175ms, environment 1ms, prepare 420ms)


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/theme.test.ts (2 tests) 4ms
 ✓ src/browser-env.test.ts (6 tests) 13ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 12ms
 ✓ src/game/progression.test.ts (10 tests) 9ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 10ms
 ✓ src/game/effects.test.ts (28 tests) 12ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 11ms
 ✓ src/game/rotation.test.ts (15 tests) 8ms
 ✓ src/ws/connection.test.ts (10 tests) 21ms
 ✓ src/render/webgl.test.ts (5 tests) 8ms
 ✓ src/game/board.test.ts (18 tests) 21ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 12ms
 ✓ src/game/engine.test.ts (58 tests) 38ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 8ms
 ✓ src/input/keyboard.test.ts (13 tests) 8ms
 ✓ src/input/gestures.test.ts (21 tests) 9ms
 ✓ src/ui/Hud.test.tsx (3 tests) 11ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 12ms
 ✓ src/render/particles.test.ts (19 tests) 14ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 10ms
 ✓ src/ui/UserPanel.test.tsx (5 tests) 15ms
 ✓ src/render/cube-view.test.ts (32 tests) 54ms
 ✓ src/render/picking.test.ts (12 tests) 44ms
 ✓ src/render/starfield.test.ts (15 tests) 101ms
 ✓ src/render/world.test.ts (19 tests) 58ms
 ✓ src/App.test.tsx (8 tests) 17ms
 ✓ src/render/scene.test.ts (68 tests) 122ms
 ✓ src/game/session.test.ts (41 tests) 117ms

 Test Files  28 passed (28)
      Tests  602 passed (602)
   Start at  10:51:17
   Duration  727ms (transform 2.76s, setup 0ms, collect 6.96s, tests 778ms, environment 4ms, prepare 2.74s)
```

Exit: **0**. 7 backend files / 180 tests; 28 frontend files / 602 tests; **782 tests total**. Every file above is either new in this feature or an existing file extended additively (see § 2.8 and § 5).

### 2.5 `npm run coverage` → exit 0 (both workspaces ≥ 80 on all four metrics)

```text
$ npm run coverage

> coverage
> npm run coverage --workspaces --if-present


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/config.test.ts (13 tests) 6ms
 ✓ src/game/cubes.test.ts (24 tests) 10ms
 ✓ src/game/players.test.ts (13 tests) 7ms
 ✓ src/game/servers.test.ts (36 tests) 8ms
 ✓ src/game/hub.test.ts (31 tests) 32ms
 ✓ src/game/protocol.test.ts (56 tests) 15ms
 ✓ src/app.test.ts (7 tests) 127ms

 Test Files  7 passed (7)
      Tests  180 passed (180)
   Start at  10:37:27
   Duration  581ms (transform 347ms, setup 0ms, collect 700ms, tests 204ms, environment 1ms, prepare 488ms)

 % Coverage report from v8
--------------|---------|----------|---------|---------|------------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s      
--------------|---------|----------|---------|---------|------------------------
All files     |   98.47 |    97.09 |     100 |   98.47 |                        
 src          |     100 |      100 |     100 |     100 |                        
  app.ts      |     100 |      100 |     100 |     100 |                        
 src/game     |   98.38 |    96.87 |     100 |   98.38 |                        
  config.ts   |     100 |      100 |     100 |     100 |                        
  cubes.ts    |     100 |      100 |     100 |     100 |                        
  hub.ts      |   96.62 |    92.79 |     100 |   96.62 | ...344,372-373,390-392 
  players.ts  |     100 |      100 |     100 |     100 |                        
  protocol.ts |     100 |      100 |     100 |     100 |                        
  servers.ts  |     100 |      100 |     100 |     100 |                        
--------------|---------|----------|---------|---------|------------------------

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ui/theme.test.ts (2 tests) 5ms
 ✓ src/game/progression.test.ts (10 tests) 7ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 7ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 12ms
 ✓ src/browser-env.test.ts (6 tests) 14ms
 ✓ src/game/effects.test.ts (28 tests) 10ms
 ✓ src/ws/connection.test.ts (10 tests) 16ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 18ms
 ✓ src/render/webgl.test.ts (5 tests) 7ms
 ✓ src/game/rotation.test.ts (15 tests) 7ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 13ms
 ✓ src/game/board.test.ts (18 tests) 23ms
 ✓ src/render/particles.test.ts (19 tests) 15ms
 ✓ src/game/engine.test.ts (58 tests) 43ms
 ✓ src/input/gestures.test.ts (21 tests) 10ms
 ✓ src/input/keyboard.test.ts (13 tests) 13ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 12ms
 ✓ src/ui/Hud.test.tsx (3 tests) 14ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 10ms
 ✓ src/render/cube-view.test.ts (32 tests) 63ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 14ms
 ✓ src/ui/UserPanel.test.tsx (5 tests) 12ms
 ✓ src/render/picking.test.ts (12 tests) 24ms
 ✓ src/render/starfield.test.ts (15 tests) 114ms
 ✓ src/render/world.test.ts (19 tests) 70ms
 ✓ src/App.test.tsx (8 tests) 23ms
 ✓ src/render/scene.test.ts (68 tests) 154ms
 ✓ src/game/session.test.ts (41 tests) 136ms

 Test Files  28 passed (28)
      Tests  602 passed (602)
   Start at  10:37:28
   Duration  954ms (transform 2.99s, setup 0ms, collect 7.14s, tests 864ms, environment 6ms, prepare 3.28s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   99.04 |    98.28 |   99.25 |   99.04 |                   
 src               |     100 |      100 |     100 |     100 |                   
  App.tsx          |     100 |      100 |     100 |     100 |                   
  browser-env.ts   |     100 |      100 |     100 |     100 |                   
 src/game          |   98.98 |    98.11 |     100 |   98.98 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |     100 |      100 |     100 |     100 |                   
  progression.ts   |     100 |      100 |     100 |     100 |                   
  rotation.ts      |     100 |      100 |     100 |     100 |                   
  session.ts       |   97.71 |    95.65 |     100 |   97.71 | ...21-622,626-629 
  types.ts         |     100 |      100 |     100 |     100 |                   
 src/input         |     100 |      100 |     100 |     100 |                   
  gestures.ts      |     100 |      100 |     100 |     100 |                   
  keyboard.ts      |     100 |      100 |     100 |     100 |                   
 src/multiplayer   |   99.73 |    99.24 |     100 |   99.73 |                   
  protocol.ts      |     100 |      100 |     100 |     100 |                   
  server-state.ts  |   99.18 |    97.18 |     100 |   99.18 | 119-120           
  spectate.ts      |     100 |      100 |     100 |     100 |                   
  transport.ts     |     100 |      100 |     100 |     100 |                   
 src/render        |   99.83 |    97.84 |     100 |   99.83 |                   
  cube-view.ts     |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |     100 |      100 |     100 |     100 |                   
  scene.ts         |   99.54 |    98.41 |     100 |   99.54 | 757-758           
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |     100 |    93.5 |     100 |     100 | ...85,193,271-274 
 src/ui            |   88.98 |      100 |   66.66 |   88.98 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  GameCanvas.tsx   |    61.9 |      100 |     100 |    61.9 | 23-30             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  UserPanel.tsx    |      90 |      100 |   33.33 |      90 | 48-49,71-73       
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------
```

Exit: **0**.

| Workspace | Statements | Branches | Functions | Lines | Gate |
| --- | --- | --- | --- | --- | --- |
| `@cubeclicker/backend` | **98.47** | **97.09** | **100** | **98.47** | PASS (≥ 80 each) |
| `@cubeclicker/frontend` | **99.04** | **98.28** | **99.25** | **99.04** | PASS (≥ 80 each) |

Thresholds are the pinned 80/80/80/80 in both `vitest.config.ts` files; exclusions are unchanged (`server.ts` backend, `main.tsx` frontend, test globs + Vitest defaults only). No threshold, exclusion or assertion was changed in T16.

### 2.6 `npm run build` → exit 0 (initial JS gzip 216.27 KB)

```text
$ npm run build

> build
> npm run build --workspaces --if-present


> build
> tsc


> build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 58 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.40 kB │ gzip:   0.27 kB
dist/assets/index-DTvgIu_V.css    2.96 kB │ gzip:   0.94 kB
dist/assets/index-BBbyci5a.js   793.75 kB │ gzip: 216.27 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.35s
```

Exit: **0**. Initial JS gzip **216.27 KB** ≤ the pinned `BUNDLE_BUDGET_GZ_KB = 350` (AC-24). The >500 KB chunk warning is pre-existing (three.js bundle), not a budget failure.

### 2.7 `npm run smoke` → exit 0 (8/8 PASS)

```text
$ npm run smoke

> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-frontend-1 Running 
 Container cubeclicker-backend-1 Recreate 
 Container cubeclicker-backend-1 Recreated 
 Container cubeclicker-backend-1 Starting 
 Container cubeclicker-backend-1 Started 
 Container cubeclicker-smoke-run-f00533b00576 Creating 
 Container cubeclicker-smoke-run-f00533b00576 Created 
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on server 1 (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined
PASS multiplayer overflow: the third client lands on server 2 (X = 2)
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1002ms
SMOKE PASS (8/8 checks)
```

Exit: **0**. The script prints one PASS/FAIL line per check and sets `process.exitCode = 1` on any failure (`tests/e2e/smoke.mjs` `main()`); the leave check asserts a lower bound of 900 ms, proving the leave went through the 1 s grace window rather than firing instantly.

### 2.8 Banned-matcher scan over all new/changed test files

Scope: the 20 test files changed by the feature commit range `f8cf3e1^..HEAD`:

```text
src/backend/src/app.test.ts
src/backend/src/game/config.test.ts
src/backend/src/game/cubes.test.ts
src/backend/src/game/hub.test.ts
src/backend/src/game/players.test.ts
src/backend/src/game/protocol.test.ts
src/backend/src/game/servers.test.ts
src/frontend/src/App.test.tsx
src/frontend/src/game/engine.test.ts
src/frontend/src/game/session.test.ts
src/frontend/src/multiplayer/protocol.test.ts
src/frontend/src/multiplayer/server-state.test.ts
src/frontend/src/multiplayer/spectate.test.ts
src/frontend/src/multiplayer/transport.test.ts
src/frontend/src/render/scene.test.ts
src/frontend/src/render/spectate-travel.test.ts
src/frontend/src/render/world.test.ts
src/frontend/src/ui/ConnectionBanner.test.tsx
src/frontend/src/ui/Hud.test.tsx
src/frontend/src/ui/UserPanel.test.tsx
```

Strict banned list (`expect.anything`, `expect.any(`, `objectContaining`, `arrayContaining`, `stringContaining`, `stringMatching`, `toMatchObject`, argument-unchecked `toHaveBeenCalled()`, `toBeTruthy`, `toBeDefined`, `not.toThrow`, `toMatchSnapshot`, `toMatchInlineSnapshot`, `toBeCloseTo`, `expect.closeTo`):

```text
$ FILES=$(git diff --name-only f8cf3e1^..HEAD | grep -E '\.(test|spec)\.(ts|tsx)$')
$ echo "FILES=$(echo "$FILES" | wc -l)"
FILES=20
$ grep -nE 'expect\.(anything|any)\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toHaveBeenCalled\(\)|toBeTruthy\(|toBeDefined\(|not\.toThrow\(|toMatchSnapshot|toMatchInlineSnapshot|toBeCloseTo|expect\.closeTo' $FILES
grep_exit=1
$ grep -nE '\.toHaveBeenCalled\(\)' $FILES
grep_exit=1
```

No matches (exit 1 = clean). `toHaveBeenCalledTimes(0)` was inspected separately: it is an exact call-count assertion, not the banned argument-unchecked `toHaveBeenCalled()`, and all uses were reviewed:

```text
src/frontend/src/game/session.test.ts:1036:    expect(listener).toHaveBeenCalledTimes(0);
src/frontend/src/render/scene.test.ts:1031:      expect(dispose).toHaveBeenCalledTimes(0);
src/frontend/src/render/scene.test.ts:1512:    expect(geometryDispose).toHaveBeenCalledTimes(0);
src/frontend/src/render/scene.test.ts:1985:    expect(oldWorldApply).toHaveBeenCalledTimes(0);
src/frontend/src/render/world.test.ts:365:    expect(disposeSpy).toHaveBeenCalledTimes(0);
src/frontend/src/render/world.test.ts:369:    expect(disposeSpy).toHaveBeenCalledTimes(0);
src/frontend/src/render/world.test.ts:373:    expect(disposeSpy).toHaveBeenCalledTimes(0);
```

Snapshot/assertion-free scan: no `expect.hasAssertions`/`expect.assertions`-only files, no snapshot files (`grep` returned no matches).

### 2.9 Storage / persistence / purity greps

**No `localStorage`/`sessionStorage`/cookie additions in frontend production code** (comments excluded):

```text
$ grep -rnE "document\.cookie|localStorage|sessionStorage" src/frontend/src --include='*.ts' --include='*.tsx' --exclude='*.test.*' \
  | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(/\*|\*|//)'
exit=1   # NO MATCHES
```

The only storage-related lines are a comment in `src/frontend/src/multiplayer/transport.ts` stating the token is memory-only, and a test that stubs the globals to assert zero touches (`transport.test.ts` "joins, keeps the token in memory and rejoins after the socket drops (AC-22)" asserts `[...local.touches, ...session.touches]` equals `[]`).

**No `fs`/persistence writes under `src/backend`:**

```text
$ grep -rnE "\bfrom ['\"](node:)?fs|require\(['\"](node:)?fs|readFile|writeFile|createWriteStream|sqlite|database" src/backend/src --include='*.ts' --exclude='*.test.ts'
exit=1   # NO MATCHES
```

**No `Math.random` or DOM globals under `game/**` and `multiplayer/**` (production code, comments excluded):**

```text
$ grep -rnE "Math\.random|\b(window|document|navigator|globalThis)\." \
    src/backend/src/game src/frontend/src/game src/frontend/src/multiplayer \
    --include='*.ts' --exclude='*.test.ts' \
  | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(/\*|\*|//)'
exit=1   # NO MATCHES
```

(Without the comment filter the grep only matches the English word "window" in doc comments about the reconnect grace window; no code use.)

### 2.10 `.env*`, secrets, push

```text
$ git status --porcelain | grep -E '\.env'
status_grep_exit=1
$ git ls-files | grep -E '(^|/)\.env'
ls_exit=1
```

No `.env*` file is tracked, modified, created or deleted. No secrets were added (the session token is generated at runtime by `crypto.randomBytes(16)`; nothing is written to storage or logs).

Push: **not performed**. `git status -sb` before the T16 commit shows `## main...origin/main [ahead 30]`; all T16 work is local.

---

## 3. Diff audit

### 3.1 Feature commit range `f8cf3e1^..HEAD`

```text
$ git diff --stat f8cf3e1^..HEAD
59 files changed, 17688 insertions(+), 130 deletions(-)
```

Directory distribution (all feature-owned):

```text
$ git diff --name-only f8cf3e1^..HEAD | awk -F/ '{...}' | sort | uniq -c
      1 compose.smoke.yaml
      1 compose.yaml
     15 docs/features/multiplayer-servers   # build logs T1…T15
     14 src/backend                          # app.ts + game/** + tests
     27 src/frontend                         # App/UI + game + multiplayer + render + tests
      1 tests/e2e
```

The complete path list is in § 3.4. No path outside the feature's inventory appears: no package files, lockfile, Dockerfiles, configs, `main.tsx`, `index.html`, `ws/connection.ts`, `server.ts`, README, AGENTS.md or predecessor feature docs.

### 3.2 Protected paths unchanged since the feature baseline

```text
$ git diff --name-only f8cf3e1^..HEAD -- \
    src/frontend/src/main.tsx src/frontend/index.html src/frontend/src/ws/connection.ts \
    src/backend/src/server.ts src/backend/Dockerfile src/frontend/Dockerfile \
    src/backend/vitest.config.ts src/frontend/vitest.config.ts \
    src/backend/package.json src/frontend/package.json package.json package-lock.json \
    README.md AGENTS.md
(empty above = unchanged)
```

Confirmed: `main.tsx`, `index.html`, `ws/connection.ts`, `server.ts`, both Dockerfiles, both Vitest configs, both workspace `package.json` files, the root `package.json`, `package-lock.json`, `README.md` and `AGENTS.md` are unchanged by the feature.

### 3.3 Container hunks (AC-25)

```diff
$ git diff f8cf3e1^..HEAD -- compose.yaml compose.smoke.yaml
diff --git a/compose.smoke.yaml b/compose.smoke.yaml
index 2bafbc8..c25a16e 100644
--- a/compose.smoke.yaml
+++ b/compose.smoke.yaml
@@ -1,6 +1,11 @@
 # Containerized smoke test — opt-in override, never started by a plain `podman compose up`.
 # Run: podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke
 services:
+  backend:
+    environment:
+      MAX_USERS_PER_SERVER: "2"
+      RECONNECT_GRACE_MS: "1000"
+
   smoke:
     image: docker.io/library/node:24-alpine
     working_dir: /smoke
diff --git a/compose.yaml b/compose.yaml
index fcceb9f..bf72c83 100644
--- a/compose.yaml
+++ b/compose.yaml
@@ -13,6 +13,7 @@ services:
       - "127.0.0.1:${BACKEND_PORT:-8080}:8080"
     environment:
       NODE_ENV: development
+      MAX_USERS_PER_SERVER: "${MAX_USERS_PER_SERVER:-10}"
     volumes:
       - "./src/backend:/app/src/backend:z"
       - "./src/frontend:/app/src/frontend:z"
```

Exactly the T15/AC-25 hunks: one backend env passthrough in `compose.yaml`, the two smoke-only overrides in `compose.smoke.yaml` (plus one separating blank line). No new service, image, port, health signal or Dockerfile change; the `smoke` service is the pre-existing opt-in container.

### 3.4 Working-tree diff and pre-existing dirty files

At the start of T16 (before any edit) the working tree already contained unrelated modifications. They were present when this task began and were not touched:

```text
$ git status -sb
## main...origin/main [ahead 30]
 M .opencode/agents/builder.md
 M .opencode/agents/orchestrator.md
 M .opencode/agents/planner.md
 M .opencode/agents/reviewer.md
 M docs/features/README.md
 M docs/features/cube-game-frontend/status.md
?? docs/features/cube-tile-lines-and-controls/... (5 files)
?? docs/features/cube-visual-polish-followup/... (5 files)
?? docs/features/cube-visual-polish/... (5 files)
?? docs/features/cube-world-transition/... (5 files)
?? docs/features/multiplayer-servers/plan.md
?? docs/features/multiplayer-servers/reviews/
?? docs/features/multiplayer-servers/spec.md
?? docs/features/multiplayer-servers/status.md
?? docs/features/multiplayer-servers/tasks.md
```

`git diff --stat` before the T16 commit:

```text
 .opencode/agents/builder.md                |  1 -
 .opencode/agents/orchestrator.md           |  1 -
 .opencode/agents/planner.md                |  1 -
 .opencode/agents/reviewer.md               |  1 -
 docs/features/README.md                    |  4 ++++
 docs/features/cube-game-frontend/status.md |  2 +-
 docs/product/glossary.md                   | 19 +++++++++++++++++--
 7 files changed, 22 insertions(+), 7 deletions(-)
```

Only `docs/product/glossary.md` is T16's (plus the new build log). The `.opencode/agents/*`, `docs/features/README.md` and `docs/features/cube-game-frontend/status.md` changes are pre-existing and outside this task's `files_owned`; they were left untouched and are not staged.

### 3.5 Branch observation

The feature commits landed on **`main`**, not on a `feat/multiplayer-servers` branch: `git log --oneline` shows `f8cf3e1` (T1) through `29c8d93` (T15) all on the current branch (`main`), which tracks `origin/main` and is **ahead 30** commits. This is recorded as an observation only; T16 did not create, rename or push any branch.

---

## 4. Per-AC verification table (AC-1 … AC-27)

Legend: **met** = the AC's behavior is implemented and evidenced with concrete test/command evidence; **met-with-note** = met, with an evidence limitation recorded; **unmet** = at least one clause is not fully implemented or not fully evidenced. "Test name" is the exact `it(...)` title; the file is given when ambiguous.

| AC | Status | Evidence |
| --- | --- | --- |
| **AC-1** — First connection creates server 1 | **met-with-note** | `src/backend/src/game/servers.test.ts` › `createServerRegistry` › "starts empty: no server exists before the first join" (`serverCount()` 0, `servers()` `[]`, empty plan); `src/backend/src/app.test.ts` › `GET /healthz` › "returns 200 with the pinned body"; `src/backend/src/app.test.ts` › `GET /ws` › "plays the full handshake over a live socket: hello, join, welcome, memberJoined" (first join → `serverId 1`, `playerId p1`). **Note:** there is no direct assertion that `serverCount()` stays 0 after a `/healthz` call — `GameHub` exposes only `attach`/`connectionCount`/`close`. The healthz handler is the literal `{ status: 'ok' }` return in `app.ts` and never touches the hub, so "creates nothing" is evidenced by code inspection + the registry boot test, not by a cross-assertion. |
| **AC-2** — Fill to X, then overflow | **met** | `servers.test.ts` › `createServerRegistry` › "fills server 1 to capacity then overflows into server 2" (X = 3: p1/p2/p3 slots 1–3 on server 1, p4 → server 2 slot 1); `hub.test.ts` › "overflows into the next fresh server and keeps broadcasts server-scoped" (X = 2: p3 → server 2 slot 1 with the pinned ring position); `app.test.ts` handshake; smoke `multiplayer join…` and `multiplayer overflow…` (X = 2, `serverId 1` then `2`). |
| **AC-3** — Empty servers destroyed, ids never reused | **met** | `servers.test.ts` › "destroys an emptied server and never reuses its id"; `servers.test.ts` › "executes a planned move into the target’s lowest free slot and destroys the vacated server"; `hub.test.ts` › "destroys an emptied server at grace expiry and never reuses its id"; `hub.test.ts` › "merges a lone server-2 member into server 1 when they complete (X = 2, AC-11)" (after the move, the next join gets **server 3**, proving server 2 was destroyed and its id not reused). |
| **AC-4** — In-memory lifecycle across restart | **met** | `app.test.ts` › "keeps each app build independent (in-memory lifecycle, AC-4)" (two `buildApp()` instances; the second build's first join is again `p1`/server 1); grep shows no `fs`/persistence imports or writes under `src/backend` (§ 2.9); `docs/features/multiplayer-servers/build-log-T5.md` records the fresh-hub-per-build design. |
| **AC-5** — Capacity X config | **met** | `config.test.ts` › "pins every constant from the spec table" (10/2/24, 30 000/1 000/600 000, rate 30, heartbeat 30 000, missed pongs 2, 200 connections); "returns the pinned defaults for an empty environment"; "accepts the range boundaries 2, 10 and 24"; "rejects 1 with an error naming the variable"; "rejects 25 …"; "rejects a non-numeric value …"; "rejects a non-integer value and an empty value"; grace boundary tests 1 000/600 000 and 999/600 001 with exact error texts; "reports the first invalid variable when both are invalid". Capacity analysis: `plan.md` § Capacity analysis (tradeoff table, X = 10 recommendation). |
| **AC-6** — Ephemeral identity, no storage | **met** | `players.test.ts` › "formats playerId and name from the same counter (1 → p1 / Player 1)"; "issues a 32-character lowercase hex token"; "issues a distinct token to every record (100 joins)"; `transport.test.ts` › "joins, keeps the token in memory and rejoins after the socket drops (AC-22)" asserts `[...local.touches, ...session.touches]` equals `[]` after join → welcome → drop → rejoin; production grep shows no `localStorage`/`sessionStorage`/cookies (§ 2.9). |
| **AC-7** — Grace window & reconnect | **met** | `players.test.ts` › "begins a window at exactly now + RECONNECT_GRACE_MS from config"; "expires at exactly the deadline instant, not one millisecond before"; "honours the configured RECONNECT_GRACE_MS override"; `hub.test.ts` › "keeps a disconnected member in the roster during the window (their slot stays taken)"; "removes the member at exactly the grace deadline and broadcasts memberLeft left"; "resumes the same identity, server and cube within the window without a roster change"; "fails a resume at exactly the deadline and finalises the removal"; "answers resume_failed for an unknown token and then accepts a join on the same connection"; "drops broadcasts to a member in grace without disturbing active members". |
| **AC-8** — Display names | **met** | `players.test.ts` › "formats playerId and name from the same counter (1 → p1 / Player 1)" and "formats later counters identically in both fields (2 and 42)"; `hub.test.ts` › "merges a lone server-2 member into server 1 when they complete (X = 2, AC-11)" asserts `worldEntered.name` is `'Player 3'` and the target roster entry is `memberOf('p3', 'Player 3', …)`; `hub.test.ts` › "announces memberLeft moved …" keeps `'Player 4'` across the move. |
| **AC-9** — Join assignment rule | **met** | `servers.test.ts` › `pickServer` › "picks the lowest-id server with a free slot"; "skips full servers and keeps a gap in the id sequence"; "picks the lowest id regardless of the input order"; "uses the caller-owned next id for a new server"; registry overflow test. |
| **AC-10** — Move plan: deterministic packing, execution only at completion, strictly lower ids | **met (erratum noted)** | `servers.test.ts` › `computeMovePlan` › "moves the lone member of server 2 down into the free slot of server 1"; "moves both members of server 2 to server 1 in join order when two slots are free"; "returns an empty plan when server 1 is full (nowhere to go)"; "plans only strictly lower targets"; "is deterministic and does not mutate its input"; re-validation: "rejects a move to a detached server and leaves the member in place", "rejects a move into a full target and leaves the member in place", "rejects upward and same-server targets and unknown members"; `hub.test.ts` › "announces memberLeft moved to the vacated server and memberJoined to the target" (no roster change until the mover's `cubeCompleted`, then `worldEntered` + roster). **Erratum:** `spec.md` AC-10 still contains contradictory fixtures (`[1: X, 2: 1] → { p2: 1 }` and, later, `[1: X, 2: 1] → empty plan`). The normative § 4 rule ("lowest-id server with a free slot"; targets strictly lower) resolves it as `[1: X−1, 2: 1] → { p2: 1 }` / `[1: X, 2: 1] → {}`; T1 tests pin that and `status.md` records the erratum. The code is correct per § 4; the spec prose needs a planner/orchestrator correction (out of T16 scope). |
| **AC-11** — Lone-user merge scenario | **met** | `hub.test.ts` › "merges a lone server-2 member into server 1 when they complete (X = 2, AC-11)": p1/p2 fill server 1, p3 → server 2; p1 disconnect + grace expiry; p3 completes → `worldEntered` with `serverId 1`, `position X2_SLOT_1`, full roster, `memberJoined` to p2, and the next join creates server 3; `servers.test.ts` › "merges a lone server-2 member into server 1 at its next free slot on completion" (registry-level composition). |
| **AC-12** — Client-visible move effect | **met** | `server-state.test.ts` › "reduces the AC-12 move sequence (memberLeft moved → worldEntered → swap) to the target world" and "removes the mover from the old server’s world on memberLeft (moved)"; `scene.test.ts` › "moves the own cube to the destination at the midpoint and swaps the world exactly once" (old world disposed once, new roster, concrete positions) and "holds at the own rest pose while the server destination is unknown (Q-T8-2)"; `session.test.ts` › "queues the worldEntered swap for the midpoint and applies the new world (AC-12)" and "releases the held online travel with levelAdvanced and advances at the midpoint (AC-12)". |
| **AC-13** — World layout & remote cubes | **met** | `servers.test.ts` › `worldPosition` › "pins the ring positions for a full default server (X = 10, slots 1/2/3/10)" (exact literals incl. `38.197186342054884`) and "pins the ring positions for X = 2 (both slots)"; `world.test.ts` › "builds one cube view per member at the exact server-assigned ring position"; "keeps existing views and disposes a removed member exactly once"; "renders at most (X - 1) x 7 meshes for a full X = 10 roster"; "hides the exact tile…" / "derives a face clear…" / "rebuilds a member on levelAdvanced exactly once…"; "resolves null for a ray that hits only a remote cube view" (real `Raycaster`). |
| **AC-14** — Server-authoritative board, optimistic own-cube play | **met** | `cubes.test.ts` › `validateExplode` matrix ("accepts an existing, unremoved id…", "rejects an id that was already removed…", "rejects unknown or malformed ids…", "rejects a stale or future level…", "applies the same matrix for N = 7"); `hub.test.ts` › "broadcasts a valid explode to every member of the server including the origin"; "rejects unknown, removed and wrong-level clicks with invalid_click + stateSync to the origin only"; "drops the 31st explode in a trailing second and reports rate_limited at most once per second"; `engine.test.ts` retains the optimistic removal test; `session.test.ts` › "forwards a successful explode, reports the sixth face and releases the held travel" and "treats a consistent ack as a no-op and reconciles stateSync without rollback" (removed-set equality). |
| **AC-15** — Completion validation & server-drawn levels | **met** | `cubes.test.ts` › `allIds` ("lists the 54 ids…", "lists all 294 ids…"), `createNextCube` ("pins the grid draw N = 3 + ⌊draw·5⌋ for concrete draws", "advances one level per cube and cycles the style ids across two advances"), `isComplete` ("is false one removal short and true on the full 3×3 board", "…full 7×7 board", "rejects a full board reported for another level"); `hub.test.ts` › "advances a completed cube on the same server and announces levelAdvanced to all members" (grid/style/position) and "rejects incomplete cubes and wrong levels with invalid_completion + stateSync to the origin". |
| **AC-16** — "Users on Server" button & panel | **met** | `UserPanel.test.tsx` › "renders only the pinned toggle while closed"; "renders only the disabled own row when alone on the server (AC-16)" (exact SSR markup `Users on Server`, `aria-label="Users on server"`, `Player 1 (You)`); "lists the other members in slot order with 1-based cube levels (AC-16)" (exact `Player 2 · Cube 2`, `Player 3 · Cube 1`); `App.test.tsx` shell markup. |
| **AC-17** — Spectate travel & view-only mode | **met** | `spectate-travel.test.ts` › "flies (0, 0, 12) → (24, 0, 12) through the pinned rows", "flies the non-axis-aligned (24, 0, 12) → (0, 24, 12) through the pinned rows", "keeps the identity camera quaternion at every pinned row"; `spectate.test.ts` › "starts a member flight with the server-assigned destination", "ignores a second selection while a travel is in flight (AC-17)", "enters viewing when the member flight lands"; `engine.test.ts` › "travels to a spectated cube without touching the level, the board or the stats", "ignores every gameplay input while spectating, leaving board, stats and orientation untouched"; `scene.test.ts` › "renders the T11 pose table from the own cube to the target and rests there", "swaps position instantly for camera-only flights under reduced motion"; `session.test.ts` › "flies to a member, gates play while viewing, and flies home on return" (tap + ArrowRight dispatch nothing; camera `[12,0,90]` mid-flight, `[24,0,12]` at rest). |
| **AC-18** — Return to my cube | **met** | `UserPanel.test.tsx` › "renders Return to my cube exactly while spectating" (exact presence/absence markup); `App.test.tsx` › "renders Return to my cube in the shell exactly while spectating"; `spectate.test.ts` › "starts the flight home only while viewing", "refuses a return while the member flight is in flight (one travel at a time)"; `session.test.ts` › "flies to a member, gates play while viewing, and flies home on return" (return flight camera rows, then a tap explodes → `clicks` 1). |
| **AC-19** — Spectate edge cases | **met** | (a) met: `spectate.test.ts` › "reports an auto-return and drops to none when the viewed member leaves"; `session.test.ts` › "auto-returns with the flight when the viewed member leaves (AC-19 a/b)"; grace expiry proven in `hub.test.ts` › "removes the member at exactly the grace deadline…". (b) met: same tests with `reason: 'moved'` in `session.test.ts` › "reverses home after landing when the target leaves mid-flight"; `hub.test.ts` moved sequence. (c) **met (T17)**: `session.test.ts` › "keeps viewing the target when their same-server cube advances (AC-19 c)" — after `levelAdvancedMessage({ playerId: 'p2', levelIndex: 2, gridSize: 6, styleId: 'emerald-crystal', position: { x: 24, y: 0 } })` the spectate state stays `{ mode: 'viewing', target: 'p2' }`, `spectating` is `true`, phase is `playing`, travel kind/destination are `null`, own level 0/grid 5 and stats `{ clicks: 0, facesDestroyed: 0 }` are untouched, the p2 world member is exactly `{ playerId: 'p2', name: 'Player 2', position: { x: 24, y: 0 }, levelIndex: 2, gridSize: 6, styleId: 'emerald-crystal', removedIds: [] }`, the camera remains `[24, 0, 12]` and `wire.sent` is `[]`; the view-rebuild half is `world.test.ts` › "rebuilds a member on levelAdvanced exactly once at the new position and cube". (d) **met (T17)**: engine `describe('travel cancel (AC-19 d, AC-22)')` › "cancels a spectate flight at once, keeping the own level and emitting no intent", "cancels a return flight and leaves the spectating gate to the caller", "never cancels the online nextLevel hold, an offline level travel or a rest state"; `session.test.ts` › "resets a mid-flight spectate to the own rest on a resume welcome (AC-19 d, AC-22)" (drop at progress 0.4, camera `[7.6800000000000015, 0, 83.76]` → resume `welcome` → phase `playing`, progress 1, travel fields `null`, `spectating` false, 24 front tiles with `removedIds: ['front:0:0']`, next frame `[0,0,12]`, still `[0,0,12]` at the abandoned flight's landing time, tap sends `{ type: 'explode', id: 'front:2:2', level: 0 }`); `scene.test.ts` › "rests at the own cube on the first snapshot after a mid-flight reset" (`[12,12,90]` mid-flight → `enterWorld` + `playing` → camera `[24,0,12]`, identity quaternion, cube group `[24,0,0]`, `update(16)` keeps starfield `[1,1,1]`). Negative control (T17 log § 5): the session test fails with `expected 'travel' to be 'playing'` without the T17 session change. (e) met: `world.test.ts` › "hides the exact tile, starts its pop and spawns the burst at the tile origin". |
| **AC-20** — Message catalog & hello-first | **met** | `protocol.test.ts` codec matrix (happy paths for join/rejoin/explode/cubeCompleted; missing/wrong-type/unknown frame rejections; `MAX_MESSAGE_BYTES` 1024; hello envelope byte-shape); `hub.test.ts` › "answers not_joined to game messages before a successful join"; "answers bad_message for malformed, unknown and oversized frames"; "joins with identity…"; "rejects a second join or rejoin on a joined connection with bad_message"; "overflows … and keeps broadcasts server-scoped"; `app.test.ts` › "sends the pinned hello envelope to each concurrent client" and live handshake (hello first); frontend `multiplayer/protocol.test.ts` mirrors the catalog (112 tests, including the retained hello, placement shapes, all server messages, rejection matrices). |
| **AC-21** — Heartbeat | **met** | `hub.test.ts` › "pings every 30 s and terminates at the second missed pong" (pings at 30 s/60 s/90 s; `close()` at the second miss); "resets the missed-pong count on every pong"; "keeps a socket alive when a pong arrives after two missed pings"; "closes sockets beyond the connection cap" (`MAX_CONNECTIONS`). |
| **AC-22** — Connection states & offline behavior | **met** | Banner: `ConnectionBanner.test.tsx` › "renders the pinned connecting copy", "…retrying copy…", "…exhausted copy with the pinned Retry button", "renders nothing while connected" (exact strings). Transport: `transport.test.ts` › "joins, keeps the token in memory and rejoins after the socket drops (AC-22)", "falls back to a fresh join after resume_failed…", "maps retry exhaustion to `exhausted` and restarts on close() + connect()". Gating/resume: `session.test.ts` › "gates every input while disconnected and resumes after welcome" (tap/ArrowRight/spectate/return dispatch nothing; board re-sync; next tap sends the exact explode) and "holds a running camera flight while the transport is down". **Mid-flight reset clause (T17 — the previously unmet part):** `session.test.ts` › "resets a mid-flight spectate to the own rest on a resume welcome (AC-19 d, AC-22)" clears spectate to `{ mode: 'none' }`, sets phase `playing` with travel fields `null` and `spectating` false, renders `[0,0,12]` on the next frame (still there at the abandoned flight's landing time), re-syncs the board (`removedIds: ['front:0:0']`) and dispatches the next tap as `{ type: 'explode', id: 'front:2:2', level: 0 }`; the engine cancel tests pin phase `playing`, progress `1`, zero intents and the non-cancellable `nextLevel`/offline-travel/rest guards; `scene.test.ts` › "rests at the own cube on the first snapshot after a mid-flight reset" proves the scene applies the next `playing` snapshot instantly. T17 log § 5 negative control (`expected 'travel' to be 'playing'` without the fix). |
| **AC-23** — Intro after welcome; HUD server line | **met** | `session.test.ts` › "holds the intro at progress 0 until welcome, then adopts the server grid and own slot" (before welcome: phase `intro`, progress 0; after: grid/own slot adopted); `Hud.test.tsx` › "renders live counters, the 1-based cube level and the server id from its props" (`Server 1` exact markup); `App.test.tsx` › "binds the HUD to the engine snapshot and the server id to the multiplayer store (AC-11, AC-23)"; `scene.test.ts` › "dollies the intro onto the own position, keeping the accepted z table", "enters the server world on welcome…". |
| **AC-24** — No weakening (supersession ledger) | **met** | First pass: full suite 782/782 pass (§ 2.4); second pass: **788/788** (§ 1.1.1). Banned-matcher scan clean (§ 2.8, re-run § 1.1.3); build succeeds with initial JS gzip **216.27 KB** first pass / **216.30 KB** second pass ≤ 350 (§ 2.6, § 1.1.1); existing engine/scene/session tests were extended additively (deletion scan of the changed existing test files shows only import/comment restructuring and the ledgered App/Hud exact-markup re-pins, e.g. the `Server N` HUD line; T17 added tests only); snapshot referential stability retained (`engine.test.ts` "returns the same object until a value changes", `server-state.test.ts` referential-stability tests). |
| **AC-25** — Containerization impact | **met** | § 3.3: exact compose hunks only; § 3.2: Dockerfiles, healthchecks (image-based), ports, services and README unchanged; `compose.yaml` still `GET /ws` on 8080; `podman compose up` remains the single command. |
| **AC-26** — Extended containerized smoke test | **met** | § 2.7: `SMOKE PASS (8/8 checks)` including hello-first for both clients, two joins on server 1 (`maxUsers 2`, roster 1 then 2, `memberJoined`), third client → server 2, A's explode → `miniCubeRemoved` on A (ack) and B (broadcast), B close → `memberLeft(left)` after the 1 s grace (1002 ms). Script records one PASS/FAIL line per check and exits non-zero on any failure. |
| **AC-27** — Glossary terms | **met** | `docs/product/glossary.md`: new **game server** (logical room, lazy creation, destroy-on-empty, ids never reused), **server member** (assigned user, one cube on the ring, ephemeral identity, slot retention), **spectating** (view-only camera travel, return, auto-end on leave), and **cube world position** extended with the online slot formula + offline/online examples. No other term's definition/example was changed; the stale `cube level` parenthetical is noted in § 6 rather than edited, per "no other term redefined". |

**Summary:** **all 27 ACs met** (AC-1 met-with-note; AC-10 met with the spec erratum noted), including **AC-19 and AC-22**, which the first pass recorded as unmet and T17 (`caab534`) closed (§ 1.1). Second-pass gate: lint 0, typecheck 0, **788/788 tests**, coverage backend **98.47/97.09/100/98.47** and frontend **99.11/98.29/99.26/99.11**, build gzip **216.30 KB ≤ 350**, smoke **8/8** on the documented fresh-backend stack.

---

## 5. Coverage residual (honest, not an omission)

The residual below is the first-pass narrative. The second-pass numbers are in § 1.1.1 and describe the same areas: `session.ts` improved to **98.08/95.76/100/98.08**, `server-state.ts` 97.22 branches and `world.ts` 93.58 branches show V8 run-to-run variance, and `engine.ts` is **100/100/100/100** (the T17 cancel seam is fully covered). No exclusion or threshold changed.

The gate passes comfortably, but these are the real uncovered/limited areas and why they remain:

1. **Thin React effect bodies (documented React residual).** `GameCanvas.tsx` is **61.9% lines** with lines **23–30** uncovered — the `useEffect` that calls `session.attach(canvas)` / `session.dispose()` only runs in a real DOM. The SSR/node test tier renders markup and cannot execute effects; the effect is deliberately thin (the session owns the runtime), so the untested body is the two-line attach/dispose wiring.
2. **UserPanel event handlers.** `UserPanel.tsx` is **90% lines / 33.33% functions**, with lines **48–49, 71–73** uncovered — the toggle `onClick` updater and the member-button `onClick` (`setOpen(false); onSpectate(...)`) only run on DOM events. SSR tests pin the markup exactly; the handlers are covered indirectly by the session tests that call `spectateMember`/`returnToOwnCube`, not by clicking the rendered buttons.
3. **`ws/connection.ts` lifecycle guards.** **95.34% statements / 92.85% branches**, lines **53–54, 99–100** uncovered — the two `if (closed) return` guards in `setStatus`/`open` (post-close callbacks). This is the pre-existing retry connection, used unchanged by the transport; the transport tests exercise connect/reconnect/exhaustion but not a late callback after an explicit close. The file is outside T16's `files_owned` and was not modified.
4. **Mocked `WebGLRenderer` / fake renderer adapter.** `webgl.test.ts` mocks `three`'s `WebGLRenderer` (a real one needs a GL context), and `scene.test.ts` drives a recording `RendererAdapter`. `webgl.ts` shows 100% coverage against that mock, but no real GPU/WebGL context is created in Node; the real-browser rendering path is the manual/browser residual (and the container smoke only checks that the frontend serves HTML).
5. **Defensive branches above the gate.** These files are above 80 on all metrics but retain uncovered defensive/error branches: `hub.ts` **96.62/92.79** (ranges printed as `...344,372-373,390-392` — invalid/resume/heartbeat defensive paths), `session.ts` **97.71/95.65** (printed `...21-622,626-629` — reconnection/attachment guards), `server-state.ts` **99.18/97.18** lines **119–120** (defensive unknown-member path), `scene.ts` **99.54/98.41** lines **757–758** (defensive world-swap guard), `world.ts` **100/93.5** (printed `...85,193,271-274` — defensive message branches). They are not excluded or threshold-adjusted; the aggregate remains far above 80.
6. **No coverage exclusions were added or changed.** Both configs exclude only test globs + the single composition-root entrypoint (`server.ts` / `main.tsx`) + Vitest defaults; thresholds stay 80/80/80/80 per workspace.

---

## 6. Manual browser checklist (not an AC)

Status: **not executed — environment.** The builder runtime has no interactive browser/display session, and browser automation beyond the existing containerized smoke test is explicitly out of scope. The stack was up during `npm run smoke` (backend `/healthz` 200, frontend `/` HTML), but camera/UI interactions require a human browser and were not run.

| # | Step | Expected outcome | Outcome |
| --- | --- | --- | --- |
| 1 | `podman compose up`; open `http://localhost:5173` in two independent clients (two browser profiles, or two tabs — each connection is one member). | Both clients connect (`Connecting…` clears), each sees `Server 1` in the HUD and exactly one cube per member on the ring. | **not executed — environment** |
| 2 | Open `Users on Server` on client A. | Panel `aria-label="Users on server"` lists A's own disabled row `Player N (You)` first and B in slot order with `Cube <n>`; with no other member only the own row shows. | **not executed — environment** |
| 3 | Click B in the panel (spectate travel). | Panel closes; 2.5 s camera flight to B's cube (`Traveling to Player N's cube…` live announcement); on arrival the camera rests over B's cube, clicks/WASD/arrows do nothing, and `Return to my cube` is visible. | **not executed — environment** |
| 4 | Click `Return to my cube`. | Return flight (`Returning to your cube…`), camera returns to own cube, `Return to my cube` disappears, clicks dispatch again. | **not executed — environment** |
| 5 | Restart with `MAX_USERS_PER_SERVER=2 podman compose up`; connect three clients. | First two clients on `Server 1`; the third gets `Server 2` (overflow) with a roster of itself; no cross-server events. | **not executed — environment** |
| 6 | With X = 2 and server 1 full + server 2 holding one member, close one server-1 client and wait out the grace (default 30 s; use `RECONNECT_GRACE_MS=1000` for a quick check). The lone server-2 member clears their cube. | On completion the mover travels/swaps to server 1, the `Users on Server` panel shows the server-1 roster, server 2 is destroyed and the next join creates server 3. | **not executed — environment** |

The containerized smoke test (§ 2.7) covers the protocol-level equivalents of steps 1, 5 and the leave half of step 6 (join/overflow/ack/broadcast/leave); it does not exercise the camera flights, rendered UI, or the completion-triggered merge.

---

## 7. Findings, drift and open questions

### F1 — AC-19(c): missing "spectator stays" assertion (evidence gap)

**Closed by T17 (`caab534`).** `session.test.ts` › "keeps viewing the target when their same-server cube advances (AC-19 c)" now pins the behavior (spectate stays `{ mode: 'viewing', target: 'p2' }`, `spectating` true, no travel, camera `[24,0,12]`, `wire.sent []`); see § 1.1 and the AC-19 row. The first-pass finding is kept below for the record.

`world.test.ts` proves the target's cube view rebuilds in place (view count 1, old view disposed exactly once, new position/grid/style). What is missing is an assertion for the other half of AC-19(c): after a remote `levelAdvanced` while the session is `{ mode: 'viewing', target: 'p2' }`, the spectate state must remain viewing (and `engine…spectating` must stay true). The production code does keep it (`handleLevelAdvanced` returns early for non-self and never touches the spectate controller), but no test pins it. **Status: unmet clause at the first pass (closed by T17 — see the closure note above); test-only follow-up.**

### F2 — AC-19(d) / AC-22: mid-flight reconnect does not reset instantly (behavior gap)

**Closed by T17 (`caab534`).** The engine `cancelTravel()` seam is called from the resume `welcome` path for `spectate`/`return` flights, and the engine/session/scene tests pin the instant reset (§ 1.1; T17 log § 3 and § 5 negative control). The first-pass finding is kept below for the record.

T13 build-log deviation 4 (lines 367–372) is explicit: "Mid-flight reconnect cannot reset the view instantly. The engine has no travel-cancel teleport seam. AC-19(d) is met for a landed spectator … If the reconnect lands while a spectate flight is still in `travel`, the engine cannot be stopped; the camera completes the flight and the deferred return/normal state follows."

Code path: on a resume `welcome`, `handleWelcome` calls `spectate.reset()` and `engine.setSpectating(false)`, but does not cancel the engine travel; `handleTravelArrival` then completes the flight (for a reset spectate mode it lands with `setSpectating(false)`). The tests cover only the landed spectator (`session.test.ts` "resumes the own cube, resets spectate and re-enters the world on a resume welcome", camera `[0,0,12]` on the next frame). **Status: unmet clause for AC-19(d) and AC-22 at the first pass (closed by T17 — see the closure note above).** This is a reachable case (drop + rejoin during the 2.5 s flight) and needs a product/engineering decision (see § 8).

### F3 — AC-1 evidence note (not a failure)

The registry boot emptiness and `/healthz` 200 body are separately asserted, and the healthz handler never touches the hub; there is no direct `serverCount()`-after-healthz assertion because `GameHub` exposes no server count. Recorded as **met-with-note** for the reviewer. A future instrumentation test could expose a read-only `serverCount()` on the hub and assert it stays 0 after healthz/attach-without-join.

### F4 — AC-10 spec erratum (doc drift, code correct)

`spec.md` AC-10 (line 188) states both `[1: X members, 2: 1] → { p2: 1 }` and `[1: X, 2: 1] → empty plan`. The normative § 4 rule (free slots, strictly lower target) yields `[1: X−1, 2: 1] → { p2: 1 }` and `[1: X, 2: 1] → {}`; T1's tests pin that and `status.md` records the erratum. The feature behavior is correct; the spec text needs a planner/orchestrator correction (not editable in T16's `files_owned`).

### F5 — Glossary `cube level` stale parenthetical (observation)

`docs/product/glossary.md` `cube level` still says "(online occupancy of those positions is a future feature)". AC-27 says "no other term redefined", so T16 left it untouched; the `cube world position` entry now supersedes that claim. If the reviewer wants a fully consistent glossary, a docs follow-up may remove that parenthetical (it does not change the definition's meaning).

### F6 — Branch and dirty working tree (observation, not a change)

All feature commits are on `main`, not `feat/multiplayer-servers`; the branch is 30 commits ahead of `origin/main` at the first pass (32 after T17 `caab534` and this pass) and nothing was pushed. Unrelated pre-existing working-tree modifications (`.opencode/agents/*`, `docs/features/README.md`, `docs/features/cube-game-frontend/status.md`, and untracked predecessor feature docs) were present before T16 and were left untouched; only the two T16 files were staged in the first pass and only this log in the second pass.

### F7 — Smoke harness is not idempotent on a warm backend (environment observation)

`npm run smoke` assumes a fresh backend registry: `compose run` reuses running dependencies and the hub keeps `nextServerId` for the process lifetime (server ids are never reused, AC-3), so the hard-coded server ids 1/2 in `smoke.mjs` fail on a second run against the same container. The second pass observed exactly that (warm backend created by T16's smoke run → ids 3/4, 6/8 checks, § 1.1.2); T15 already recorded the precondition and Q-T15-1. The documented stop-then-smoke procedure produced 8/8 PASS. This is a `tests/e2e/smoke.mjs` / `compose.smoke.yaml` harness concern (T15-owned), not a T16/T17 code regression; a future task could add a backend restart/`--force-recreate` step or id-scoped assertions. Out of scope for this verification pass.

---

## 8. Follow-up work required to make AC-19(c), AC-19(d) and AC-22 met

**Status: done in T17 (`caab534`).** Items 1–2 were implemented and evidenced there; item 3 is this second pass (§ 1.1). The text below is the first-pass follow-up specification, kept for the record.

A corrective task (not T16) must own the files below; T16 only records the gap.

1. **AC-19(c) — pin the "spectator stays" behavior (test-only, no production change).**
   - File: `src/frontend/src/game/session.test.ts` (T13-owned in the current inventory; the follow-up task must own it).
   - Add a test: put the session in `{ mode: 'viewing', target: 'p2' }` (welcome with p2, `spectateMember('p2')`, advance the scheduler past the flight), then emit `levelAdvanced { playerId: 'p2', levelIndex: 1, gridSize: 5, styleId: <next style>, position: { x: 24, y: 0 }, removedIds: [] }`.
   - Assert: `session.getMultiplayerSnapshot().spectate` is still `{ mode: 'viewing', target: 'p2' }`; `session.getSnapshot().spectating` is still `true`; the engine phase stays `playing` (no travel, no level change for the own cube); the store's p2 member reflects the new level/position; the camera still rests at the target (`[24, 0, 12]`). The world-view rebuild half is already pinned by `world.test.ts` and need not be duplicated; optionally assert the scene's world view for p2 rebuilt once after `applyWorldMessage`.
2. **AC-19(d) and AC-22 — make reconnect-during-travel reset instantly (production + tests).**
   - Decision first: either (A) implement the reset, or (B) revise the spec to narrow AC-19(d)/AC-22 to the landed spectator. The spec currently says "instantly (no flight)", so the default is (A).
   - (A) Files: `src/frontend/src/game/engine.ts` (T8-owned) for a public travel-cancel/teleport seam (e.g. `cancelTravel({ restPosition })` or `resetView()` that sets phase `playing`, clears `travelKind`/`travelDestination`, sets `spectating` as requested, and does not emit `travelStarted`/`levelChanged`), plus `src/frontend/src/game/session.ts` (T13-owned) to call it on a resume `welcome` when `engine.getSnapshot().phase === 'travel'` and the travel kind is `spectate`/`return`, before `spectate.reset()`/`enterWorld`; `src/frontend/src/render/scene.ts` may need no change if the next snapshot is `playing` at the own position.
   - Tests: `engine.test.ts` (cancel during spectate and return travels: phase `playing`, no extra intents, own rest pose retained); `session.test.ts` (drop mid-flight → resume `welcome` → no flight frames, next render camera `[0,0,12]`, spectate `none`, board re-synced, clicks dispatch again); `scene.test.ts` (camera at own rest immediately after a mid-flight resume).
   - (B) If the product owner prefers narrowing: edit `spec.md` / `tasks.md` AC-19(d) and AC-22 to "a landed spectator resets instantly; a reconnect during a flight completes that flight then resets", and record the revision in the spec history. No code change; AC-19(d)/AC-22 then become met with the revised text.
3. **Re-run this gate and update this log.** After the corrective task, re-run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `npm run smoke` and the greps; update the § 4 rows for AC-19/AC-22 to met with the new test names and any new line numbers, and add a note that this log's unmet rows were superseded.

Optional follow-ups (not gates): expose a read-only `serverCount()`/`registrySize()` on the hub for the AC-1 healthz assertion (F3); correct the AC-10 fixture text in `spec.md` (F4); remove the stale `cube level` parenthetical in a docs task (F5).

---

## 9. Commit

Staged explicitly (never `git add .`):

```text
$ git add docs/product/glossary.md docs/features/multiplayer-servers/build-log-T16.md
$ git diff --cached --name-only
docs/features/multiplayer-servers/build-log-T16.md
docs/product/glossary.md
```

Commit message:

```text
docs: record T16 verification pass and glossary terms for multiplayer-servers (T16)
```

No push. The pre-existing unrelated dirty files (§ 3.4) were not staged.

### 9.1 Second pass commit (post-T17)

Staged explicitly (never `git add .`):

```text
$ git add docs/features/multiplayer-servers/build-log-T16.md
$ git diff --cached --name-only
docs/features/multiplayer-servers/build-log-T16.md
```

Commit message:

```text
docs: record the post-T17 verification pass for multiplayer-servers (T16)
```

No push; no source or test file was staged. The pre-existing unrelated dirty files (§ 3.4) remain unstaged.
