# Build log — T15b — Smoke harness idempotency (review r1 F8) + docs errata (F9)

Task: T15b (2026-10-22)
Files changed: `tests/e2e/smoke.mjs`, `docs/product/glossary.md` (errata commit),
`docs/features/multiplayer-servers/build-log-T15b.md` (this log).
`compose.yaml` and `compose.smoke.yaml` are unchanged (not needed for this approach).

Acceptance: AC-25 (containerization impact unchanged), AC-26 (extended container smoke,
repeatable). Review findings: F8 (smoke non-idempotent on a warm backend) and F9 (stale
`cube level` glossary parenthetical).

## Sketch (≤5 lines)

Keep the eight smoke checks and make the two placement checks run-relative: the first welcome's
server id anchors the run, B must share it, and C must land on exactly that id + 1 — server ids
are never reused (AC-3), so a warm backend yields 3 → 4 instead of the hard-coded 1 → 2. Drain the
run's own members through the pinned 1 s smoke grace before exiting so back-to-back runs start
from an empty registry. Fix the glossary parenthetical in the separate docs commit.

## What changed & why

- **`tests/e2e/smoke.mjs` — run-relative server ids.** `checkMultiplayerFlow` now reads the run's
  first `welcome.serverId` (`runServerId`) and asserts:
  - A's and B's welcomes both carry `runServerId` (`maxUsers 2`, roster sizes 1 then 2),
  - C's `welcome.serverId` is exactly `runServerId + 1` (overflow at X = 2),
  - every observed id is a positive integer (`serverIdProblems`), so a missing id fails loudly
    instead of comparing `undefined === undefined`.
  The PASS lines print the observed ids (`server 1`/`server 2` cold, `server 3`/`server 4` warm),
  so the transcript itself shows which chain the run exercised. Check **count and substance are
  unchanged**: health, HTML, hello ×2, join/roster, overflow, explode ack+broadcast, grace leave.
- **`tests/e2e/smoke.mjs` — end-of-run drain.** After closing every socket, the run waits
  `SMOKE_SETTLE_MS = 1500` (the smoke backend's pinned 1000 ms `RECONNECT_GRACE_MS` plus margin)
  before exiting. Without it, a second run that starts within the grace window of the first run's
  last sockets could join a server that still holds those members in grace and see roster sizes
  2/2 instead of 1/2 — the ids would be right but the placement assertions would be a race. The
  drain makes the warm-backend case deterministic; ids still increase monotonically (never
  reused), which the relative assertions accept.
- **`docs/product/glossary.md` — F9.** The `cube level` parenthetical changed from
  `(online occupancy of those positions is a future feature)` to
  `(in online play the next cube level's position is the server-assigned ring slot — see **cube world position**)`.
  No other glossary term was touched.
- **No compose or Dockerfile change.** `compose.yaml` and `compose.smoke.yaml` are byte-identical
  to their T15 state; the approach needs no new service, image, port, health signal or backend
  reset (see Decision 1). `npm run smoke` remains exactly
  `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`.

## Decisions

1. **Run-relative assertions over a forced backend recreate.** A forced reset would have to run
   outside the smoke container: `npm run smoke` is pinned in `package.json` (out of T15b's
   `files_owned`), and `compose run` reuses an already-running dependency, so a compose-only
   "recreate the backend for this run" is not expressible without a new service or a wrapper
   script. The reviewer's finding explicitly allows "assert id-relative behavior instead of
   hard-coded ids"; that is the smallest honest change and it keeps AC-25 exactly as-is. The cold
   run still demonstrates the AC-26 literal chain (1 → 2); the warm run demonstrates the same
   invariant on a reused process (3 → 4).
2. **Anchor on the first welcome, not on a guessed offset.** The first join of a quiescent
   backend is on the lowest-id server with a free slot, and the third client overflows to the
   next created id; both are relative facts, so the run's own first id is the only honest anchor.
3. **Drain instead of documenting a cooldown.** Waiting inside the run (after all checks) keeps
   the required "twice consecutively with no manual cleanup" property; a documented sleep between
   invocations would push the burden back onto the operator.
4. **Scope of the warm guarantee.** The guarantee is a warm backend created by the smoke compose
   config (X = 2, grace 1 s) — the documented smoke procedure. A backend created by a plain
   `podman compose up` (X = 10, grace 30 s) is a different configuration and would still fail the
   `maxUsers 2` assertion, correctly, because it is not the smoke backend. This limitation existed
   before, is unchanged by T15b, and is not a state-leak race.
5. **Testing tier.** T15b changes only the containerized e2e harness and a doc line; there is no
   production behavior and no unit/integration boundary to add. The documented exception applies:
   the two real container runs below are the task's verification tier. Full lint/typecheck/unit/
   coverage are still re-run and recorded (thresholds unchanged).

## Evidence (raw command output)

Environment: Node `v24.22.0`, npm `11.19.1`, Podman `5.8.7` (compose provider
`/usr/local/bin/docker-compose`, Docker Compose `v5.6.0`). Raw logs kept in
`/tmp/opencode/t15b-*.log`.

### 1. Syntax check

```text
$ node --check tests/e2e/smoke.mjs
node-check exit=0
```

### 2. `npm run lint` → exit 0

```text
$ npm run lint

> lint
> eslint .

lint exit=0
```

### 3. `npm run typecheck` → exit 0

```text
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

typecheck exit=0
```

### 4. `npm test` → exit 0 (810 tests)

```text
$ npm test

> test
> npm run test --workspaces --if-present


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/config.test.ts (13 tests) 7ms
 ✓ src/game/cubes.test.ts (24 tests) 9ms
 ✓ src/game/servers.test.ts (38 tests) 15ms
 ✓ src/game/players.test.ts (13 tests) 15ms
 ✓ src/game/hub.test.ts (34 tests) 30ms
 ✓ src/game/protocol.test.ts (56 tests) 12ms
 ✓ src/app.test.ts (10 tests) 1176ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1020ms

 Test Files  7 passed (7)
      Tests  188 passed (188)


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/game/progression.test.ts (10 tests) 9ms
 ✓ src/game/effects.test.ts (28 tests) 8ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 6ms
 ✓ src/ws/connection.test.ts (10 tests) 17ms
 ✓ src/browser-env.test.ts (6 tests) 17ms
 ✓ src/ui/theme.test.ts (2 tests) 4ms
 ✓ src/render/webgl.test.ts (5 tests) 11ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 17ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 9ms
 ✓ src/game/rotation.test.ts (15 tests) 8ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 9ms
 ✓ src/game/board.test.ts (18 tests) 17ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 19ms
 ✓ src/render/particles.test.ts (19 tests) 21ms
 ✓ src/ui/Hud.test.tsx (3 tests) 12ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 12ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 14ms
 ✓ src/input/keyboard.test.ts (13 tests) 12ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 10ms
 ✓ src/input/gestures.test.ts (21 tests) 10ms
 ✓ src/render/cube-view.test.ts (32 tests) 60ms
 ✓ src/game/engine.test.ts (68 tests) 54ms
 ✓ src/render/picking.test.ts (12 tests) 35ms
 ✓ src/render/starfield.test.ts (15 tests) 103ms
 ✓ src/render/world.test.ts (19 tests) 43ms
 ✓ src/App.test.tsx (9 tests) 26ms
 ✓ src/render/scene.test.ts (69 tests) 131ms
 ✓ src/game/session.test.ts (48 tests) 148ms

 Test Files  28 passed (28)
      Tests  622 passed (622)

test exit=0
```

**810 tests** (backend 188 + frontend 622). The counts are higher than the code-review snapshot
(788) because T5b/T17b landed after the review; T15b itself touches no unit/integration test.

### 5. `npm run coverage` → exit 0 (both workspaces ≥ 80 on all four metrics)

```text
$ npm run coverage

> coverage
> npm run coverage --workspaces --if-present


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/config.test.ts (13 tests) 8ms
 ✓ src/game/cubes.test.ts (24 tests) 14ms
 ✓ src/game/servers.test.ts (38 tests) 10ms
 ✓ src/game/players.test.ts (13 tests) 12ms
 ✓ src/game/protocol.test.ts (56 tests) 8ms
 ✓ src/game/hub.test.ts (34 tests) 41ms
 ✓ src/app.test.ts (10 tests) 1173ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1021ms

 Test Files  7 passed (7)
      Tests  188 passed (188)

 % Coverage report from v8
--------------|---------|----------|---------|---------|------------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------|---------|----------|---------|---------|------------------------
All files     |   98.51 |    97.16 |     100 |   98.51 |
 src          |     100 |      100 |     100 |     100 |
  app.ts      |     100 |      100 |     100 |     100 |
 src/game     |   98.42 |    96.92 |     100 |   98.42 |
  config.ts   |     100 |      100 |     100 |     100 |
  cubes.ts    |     100 |      100 |     100 |     100 |
  hub.ts      |   96.64 |    92.85 |     100 |   96.64 | ...352,380-381,398-400
  players.ts  |     100 |      100 |     100 |     100 |
  protocol.ts |     100 |      100 |     100 |     100 |
  servers.ts  |     100 |      100 |     100 |     100 |
--------------|---------|----------|---------|---------|------------------------

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/game/progression.test.ts (10 tests) 8ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 10ms
 ✓ src/ui/theme.test.ts (2 tests) 5ms
 ✓ src/ws/connection.test.ts (10 tests) 11ms
 ✓ src/game/effects.test.ts (28 tests) 9ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 9ms
 ✓ src/game/rotation.test.ts (15 tests) 8ms
 ✓ src/render/webgl.test.ts (5 tests) 10ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 19ms
 ✓ src/browser-env.test.ts (6 tests) 17ms
 ✓ src/game/board.test.ts (18 tests) 30ms
 ✓ src/ui/Hud.test.tsx (3 tests) 14ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 20ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 7ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 15ms
 ✓ src/render/particles.test.ts (19 tests) 15ms
 ✓ src/game/engine.test.ts (68 tests) 50ms
 ✓ src/input/gestures.test.ts (21 tests) 10ms
 ✓ src/input/keyboard.test.ts (13 tests) 10ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 13ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 17ms
 ✓ src/render/starfield.test.ts (15 tests) 76ms
 ✓ src/render/cube-view.test.ts (32 tests) 69ms
 ✓ src/render/picking.test.ts (12 tests) 35ms
 ✓ src/render/world.test.ts (19 tests) 62ms
 ✓ src/App.test.tsx (9 tests) 29ms
 ✓ src/render/scene.test.ts (69 tests) 143ms
 ✓ src/game/session.test.ts (48 tests) 164ms

 Test Files  28 passed (28)
      Tests  622 passed (622)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   99.01 |    98.28 |   99.28 |   99.01 |
 src               |     100 |      100 |     100 |     100 |
  App.tsx          |     100 |      100 |     100 |     100 |
  browser-env.ts   |     100 |      100 |     100 |     100 |
 src/game          |   98.87 |    98.11 |     100 |   98.87 |
  board.ts         |     100 |      100 |     100 |     100 |
  effects.ts       |     100 |      100 |     100 |     100 |
  engine.ts        |   99.65 |    99.54 |     100 |   99.65 | 811-812
  progression.ts   |     100 |      100 |     100 |     100 |
  rotation.ts      |     100 |      100 |     100 |     100 |
  session.ts       |   97.58 |    95.65 |     100 |   97.58 | ...36-637,641-644
  types.ts         |     100 |      100 |     100 |     100 |
 src/input         |     100 |      100 |     100 |     100 |
  gestures.ts      |     100 |      100 |     100 |     100 |
  keyboard.ts      |     100 |      100 |     100 |     100 |
 src/multiplayer   |   99.73 |    99.24 |     100 |   99.73 |
  protocol.ts      |     100 |      100 |     100 |     100 |
  server-state.ts  |   99.18 |    97.18 |     100 |   99.18 | 119-120
  spectate.ts      |     100 |      100 |     100 |     100 |
  transport.ts     |     100 |      100 |     100 |     100 |
 src/render        |   99.83 |    97.83 |     100 |   99.83 |
  cube-view.ts     |     100 |      100 |     100 |     100 |
  particles.ts     |     100 |      100 |     100 |     100 |
  picking.ts       |     100 |      100 |     100 |     100 |
  scene.ts         |   99.54 |    98.38 |     100 |   99.54 | 757-758
  ...ate-travel.ts |     100 |      100 |     100 |     100 |
  starfield.ts     |     100 |      100 |     100 |     100 |
  webgl.ts         |     100 |      100 |     100 |     100 |
  world.ts         |     100 |    93.58 |     100 |     100 | ...85,193,271-274
 src/ui            |   89.34 |      100 |   66.66 |   89.34 |
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |
  GameCanvas.tsx   |    61.9 |      100 |     100 |    61.9 | 23-30
  Hud.tsx          |     100 |      100 |     100 |     100 |
  UserPanel.tsx    |   90.74 |      100 |   33.33 |   90.74 | 59-60,82-84
  theme.ts         |     100 |      100 |     100 |     100 |
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100
-------------------|---------|----------|---------|---------|-------------------
coverage exit=0
```

| Workspace | Statements | Branches | Functions | Lines | Gate |
| --- | --- | --- | --- | --- | --- |
| `@cubeclicker/backend` | **98.51** | **97.16** | **100** | **98.51** | PASS (≥ 80 each) |
| `@cubeclicker/frontend` | **99.01** | **98.28** | **99.28** | **99.01** | PASS (≥ 80 each) |

Thresholds and exclusions unchanged; no production file was modified by this task.

### 6. Container smoke — twice consecutively, no cleanup between runs

Environment setup: the pre-existing dev stack was created by a plain `podman compose up`
(base env `MAX_USERS_PER_SERVER=10`, grace 30 s) and `compose run` reuses running dependencies,
so it was stopped first — the documented T15/T16 smoke procedure — and `npm run smoke` recreated
the backend from the merged smoke config (X = 2, grace 1000 ms):

```text
$ podman compose -f compose.yaml -f compose.smoke.yaml down
 Container cubeclicker-frontend-1 Stopping
 Container cubeclicker-backend-1 Stopping
 Container cubeclicker-frontend-1 Stopped
 Container cubeclicker-frontend-1 Removing
 Container cubeclicker-frontend-1 Removed
 Container cubeclicker-backend-1 Stopped
 Container cubeclicker-backend-1 Removing
 Container cubeclicker-backend-1 Removed
 Network cubeclicker_default Removing
 Network cubeclicker_default Removed
down exit=0
```

#### Run 1 — cold backend

```text
$ npm run smoke

> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Network cubeclicker_default Creating
 Network cubeclicker_default Created
 Container cubeclicker-frontend-1 Creating
 Container cubeclicker-backend-1 Creating
 Container cubeclicker-frontend-1 Created
 Container cubeclicker-backend-1 Created
 Container cubeclicker-frontend-1 Starting
 Container cubeclicker-backend-1 Starting
 Container cubeclicker-frontend-1 Started
 Container cubeclicker-backend-1 Started
 Container cubeclicker-smoke-run-0346b26ac286 Creating
 Container cubeclicker-smoke-run-0346b26ac286 Created
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 1
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 2
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1002ms
SMOKE PASS (8/8 checks)
smoke1 exit=0
```

#### Run 2 — warm backend (immediately after run 1, no `down`, no cleanup)

```text
$ npm run smoke

> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-backend-1 Running
 Container cubeclicker-frontend-1 Running
 Container cubeclicker-smoke-run-5b3c3b9a6fd2 Creating
 Container cubeclicker-smoke-run-5b3c3b9a6fd2 Created
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 3
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 4
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1002ms
SMOKE PASS (8/8 checks)
smoke2 exit=0
```

The warm run reused the same backend container (`Running`, no recreate) and observed ids 3/4
because server ids are never reused after the cold run's servers 1/2 were destroyed — exactly the
warm case that failed 6/8 before T15b. Both runs exited **0** with **8/8 PASS**.

Afterwards the baseline development stack was restored (it is runtime state only, no repository
change):

```text
$ podman compose -f compose.yaml -f compose.smoke.yaml down   # exit 0
$ podman compose up -d                                        # exit 0
cubeclicker-frontend-1	Up Less than a second (starting)
cubeclicker-backend-1	Up Less than a second (starting)
```

### 7. Scope check — compose/Dockerfiles untouched

```text
$ git status --short -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile
(empty)

$ git diff --stat -- tests/e2e/smoke.mjs
 tests/e2e/smoke.mjs | 61 +++++++++++++++++++++++++++++++++++++++++++----------
 1 file changed, 50 insertions(+), 11 deletions(-)
```

## Acceptance audit

- **AC-25 — Containerization impact → met (unchanged).** No service, image, port, health signal,
  Dockerfile, README or `podman compose up` change: the scope check above is empty, so this task
  adds nothing to the T15 container delta. `npm run smoke` remains the pinned compose command and
  the backend still exposes `/ws` on 8080 (smoke hello/welcome/explode checks).
- **AC-26 — Extended containerized smoke test → met and now repeatable.** All eight checks run
  and PASS in both consecutive container runs (cold 1/2 and warm 3/4), exit 0 each. The checks
  retain: hello-first per client, two joins with `maxUsers 2` and roster 1 → 2 plus
  `memberJoined`, overflow to the next server id at X = 2, A's `explode` observed on A (ack) and
  B (broadcast), and B's close yielding `memberLeft(left)` after the 1 s grace window
  (1002 ms observed). F8 closed: the harness no longer depends on absolute ids.
- **F9 — glossary `cube level` stale parenthetical → met.** The sentence now points at the
  server-assigned ring slot and the `cube world position` entry; committed in the separate docs
  errata commit (with spec.md/tasks.md r2).

## Deviations from spec

None. The one documented process note: to run the smoke against the merged smoke configuration
the pre-existing base dev stack had to be stopped first (same procedure T15/T16 recorded); this is
runtime state, not a repository change, and no cleanup happened between run 1 and run 2.

## Open questions

None blocking. Residual, unchanged: a warm backend created with the *base* dev env (X = 10,
grace 30 s) is not the smoke backend, so `npm run smoke` against it fails the `maxUsers 2`
assertion by design; the documented smoke procedure creates the backend from
`compose.smoke.yaml`.
