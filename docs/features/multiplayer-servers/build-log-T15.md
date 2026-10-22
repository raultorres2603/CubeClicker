# Build log — T15 — Containers & e2e: compose env passthrough, smoke extension

Task: T15 (2026-10-22)
Files changed: `compose.yaml`, `compose.smoke.yaml`, `tests/e2e/smoke.mjs`,
`docs/features/multiplayer-servers/build-log-T15.md` (this log)

## Sketch (≤5 lines)

`compose.yaml` passes the capacity env through with the pinned default; `compose.smoke.yaml`
overrides capacity to 2 and grace to 1 s for the smoke run; `smoke.mjs` adds a small queued
WebSocket client and runs the AC-26 sequence after the retained health/HTML/hello checks:
join/roster, overflow, explode ack + broadcast, and close → `memberLeft (left)`, one
PASS/FAIL line per check.

## What changed & why

- **`compose.yaml`** — exactly one backend environment line:
  `MAX_USERS_PER_SERVER: "${MAX_USERS_PER_SERVER:-10}"`. It exposes the pinned capacity knob to
  the backend container with the pinned default 10, so a plain `podman compose up` keeps working
  and the value can still be overridden from the shell. No service, image, port, volume,
  healthcheck or build-context change.
- **`compose.smoke.yaml`** — one merge-only `backend` block:
  `MAX_USERS_PER_SERVER: "2"` and `RECONNECT_GRACE_MS: "1000"` (smoke-only settings). X = 2
  makes the third joiner overflow deterministically; the 1 s grace keeps the `memberLeft`
  check inside the smoke budget. The base `NODE_ENV: development` survives the merge (verified
  with `podman compose … config`, output below).
- **`tests/e2e/smoke.mjs`** — the health/HTML/two-hello checks are retained verbatim in
  behavior (the two hello checks now also state that `hello` is the first frame). A queued
  `SmokeSocket` (open → wait for the pinned `hello` → send `join`) plus `checkMultiplayerFlow()`
  add the AC-26 checks, one PASS/FAIL line each:
  1. **join/roster** — A and B join; A's `welcome` has `serverId 1`, `maxUsers 2`, roster size
     1; B's has `serverId 1`, `maxUsers 2`, roster size 2; A also receives `memberJoined` for
     B's `playerId`.
  2. **overflow** — C joins and its `welcome.serverId` is `2` (X = 2).
  3. **explode sync** — A sends a valid `explode` (`front:0:0`, level from A's `welcome.self`)
     and both A (ack) and B (broadcast) receive `miniCubeRemoved` with A's `playerId` and the
     exact id.
  4. **leave/grace** — B's socket is closed; A receives `memberLeft` with B's `playerId` and
     `reason: 'left'`. Elapsed time must be ≥ 900 ms (proving the grace window actually ran,
     not an instant removal) and the 5 s budget enforces the upper bound; the PASS line prints
     the observed elapsed time.
- **No production source, Dockerfile, healthcheck, package, lockfile or README change.**

## Decisions

- **A queued socket instead of counting frames.** The checks need specific frames
  (`welcome`, `memberJoined`, `miniCubeRemoved`, `memberLeft`) while unrelated frames may
  arrive between them, so `SmokeSocket` keeps a FIFO and `waitForMessage` consumes until the
  predicate matches, failing on a server `error` frame, a closed socket, or the timeout. Each
  check's timeout is bounded (5 s per frame; 5 s for the grace leave).
- **Hello safety is kept in the new clients too.** `connectAndJoin` only sends `join` after
  receiving a `hello` whose `serverTime` parses, so the new path cannot accidentally depend on
  a non-hello first frame. The retained two-client hello check is unchanged.
- **Valid explode id.** The server's starting grid is always N ∈ [3, 7], so `front:0:0` is
  guaranteed to exist at level 0; the client sends the level it was given in `welcome.self`
  (server authority — the check does not invent a level).
- **Grace lower bound 900 ms.** The smoke backend override is exactly 1000 ms; the measured
  interval starts before the client close and ends at the broadcast, so ≥ 900 ms distinguishes
  "through the grace timer" from "removed immediately" without introducing a flaky exact-ms
  comparison. The run below observed 1001 ms.
- **Fresh backend required.** The smoke check expects a fresh registry (server 1 then 2), which
  is the AC-26/plan assumption for `npm run smoke`. The pre-existing 2-day-old dev stack was
  running with the base environment (no smoke overrides), so it was stopped and left for the
  smoke command to recreate the dependencies from the merged config; afterwards the base dev
  stack was restored (`podman compose down` + `podman compose up -d`). This is environment
  handling, not a repository change.
- **Testing bar.** T15 changes no production behavior; its deliverable *is* the containerized
  e2e tier. There is no new unit/integration surface to add (compose config + e2e script), so
  the documented exception applies to this task. The full lint/typecheck/unit/coverage suite is
  re-run below and unchanged in thresholds.

## Evidence (raw command output)

### lint

```
$ npm run lint
> lint
> eslint .

lint exit=0
```

### typecheck

```
$ npm run typecheck
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

typecheck exit=0
```

### unit tests

```
$ npm test
> test
> npm run test --workspaces --if-present


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/config.test.ts (13 tests) 9ms
 ✓ src/game/cubes.test.ts (24 tests) 11ms
 ✓ src/game/servers.test.ts (36 tests) 13ms
 ✓ src/game/players.test.ts (13 tests) 13ms
 ✓ src/game/protocol.test.ts (56 tests) 7ms
 ✓ src/game/hub.test.ts (31 tests) 48ms
 ✓ src/app.test.ts (7 tests) 158ms

 Test Files  7 passed (7)
      Tests  180 passed (180)
   Start at  10:32:27
   Duration  578ms (transform 343ms, setup 0ms, collect 728ms, tests 259ms, environment 1ms, prepare 511ms)


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/browser-env.test.ts (6 tests) 17ms
 ✓ src/render/webgl.test.ts (5 tests) 12ms
 ✓ src/ui/theme.test.ts (2 tests) 6ms
 ✓ src/ws/connection.test.ts (10 tests) 13ms
 ✓ src/game/rotation.test.ts (15 tests) 7ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 15ms
 ✓ src/game/progression.test.ts (10 tests) 10ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 16ms
 ✓ src/game/effects.test.ts (28 tests) 15ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 19ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 13ms
 ✓ src/game/board.test.ts (18 tests) 27ms
 ✓ src/input/keyboard.test.ts (13 tests) 11ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 9ms
 ✓ src/game/engine.test.ts (58 tests) 52ms
 ✓ src/render/particles.test.ts (19 tests) 20ms
 ✓ src/ui/Hud.test.tsx (3 tests) 16ms
 ✓ src/input/gestures.test.ts (21 tests) 9ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 13ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 11ms
 ✓ src/ui/UserPanel.test.tsx (5 tests) 21ms
 ✓ src/render/cube-view.test.ts (32 tests) 50ms
 ✓ src/render/starfield.test.ts (15 tests) 98ms
 ✓ src/render/picking.test.ts (12 tests) 55ms
 ✓ src/render/world.test.ts (19 tests) 60ms
 ✓ src/App.test.tsx (8 tests) 24ms
 ✓ src/game/session.test.ts (41 tests) 125ms
 ✓ src/render/scene.test.ts (68 tests) 142ms

 Test Files  28 passed (28)
      Tests  602 passed (602)
   Start at  10:32:28
   Duration  900ms (transform 3.82s, setup 0ms, collect 9.64s, tests 887ms, environment 6ms, prepare 2.53s)

test exit=0
```

### coverage (both workspaces, unchanged thresholds)

```
$ npm run coverage
> coverage
> npm run coverage --workspaces --if-present


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/config.test.ts (13 tests) 8ms
 ✓ src/game/cubes.test.ts (24 tests) 14ms
 ✓ src/game/players.test.ts (13 tests) 9ms
 ✓ src/game/servers.test.ts (36 tests) 15ms
 ✓ src/game/hub.test.ts (31 tests) 49ms
 ✓ src/game/protocol.test.ts (56 tests) 11ms
 ✓ src/app.test.ts (7 tests) 173ms

 Test Files  7 passed (7)
      Tests  180 passed (180)
   Start at  10:32:34
   Duration  712ms (transform 274ms, setup 0ms, collect 777ms, tests 279ms, environment 1ms, prepare 603ms)

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

 ✓ src/game/effects.test.ts (28 tests) 10ms
 ✓ src/browser-env.test.ts (6 tests) 12ms
 ✓ src/ws/connection.test.ts (10 tests) 12ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 7ms
 ✓ src/game/progression.test.ts (10 tests) 8ms
 ✓ src/render/webgl.test.ts (5 tests) 12ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 16ms
 ✓ src/ui/theme.test.ts (2 tests) 6ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 18ms
 ✓ src/render/particles.test.ts (19 tests) 15ms
 ✓ src/game/board.test.ts (18 tests) 30ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 28ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 17ms
 ✓ src/ui/Hud.test.tsx (3 tests) 13ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 7ms
 ✓ src/game/engine.test.ts (58 tests) 57ms
 ✓ src/input/gestures.test.ts (21 tests) 15ms
 ✓ src/render/cube-view.test.ts (32 tests) 49ms
 ✓ src/render/starfield.test.ts (15 tests) 82ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 17ms
 ✓ src/input/keyboard.test.ts (13 tests) 17ms
 ✓ src/ui/UserPanel.test.tsx (5 tests) 27ms
 ✓ src/render/picking.test.ts (12 tests) 40ms
 ✓ src/render/world.test.ts (19 tests) 77ms
 ✓ src/App.test.tsx (8 tests) 30ms
 ✓ src/game/session.test.ts (41 tests) 146ms
 ✓ src/render/scene.test.ts (68 tests) 193ms

 Test Files  28 passed (28)
      Tests  602 passed (602)
   Start at  10:32:35
   Duration  1.30s (transform 3.45s, setup 0ms, collect 10.45s, tests 972ms, environment 6ms, prepare 3.69s)

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
  world.ts         |     100 |     93.5 |     100 |     100 | ...85,193,271-274
 src/ui            |   88.98 |      100 |    66.66 |   88.98 |
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |
  GameCanvas.tsx   |    61.9 |      100 |     100 |    61.9 | 23-30
  Hud.tsx          |     100 |      100 |     100 |     100 |
  UserPanel.tsx    |      90 |      100 |   33.33 |      90 | 48-49,71-73
  theme.ts         |     100 |      100 |     100 |     100 |
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100
-------------------|---------|----------|---------|---------|-------------------

coverage exit=0
```

Backend aggregate: 98.47 statements / 97.09 branches / 100 functions / 98.47 lines.
Frontend aggregate: 99.04 statements / 98.28 branches / 99.25 functions / 99.04 lines.
Both are above the unchanged 80% bar on all four metrics.

### compose merge check (AC-25)

```
$ podman compose -f compose.yaml -f compose.smoke.yaml config
name: cubeclicker
services:
  backend:
    environment:
      MAX_USERS_PER_SERVER: "2"
      NODE_ENV: development
      RECONNECT_GRACE_MS: "1000"
    image: cubeclicker-backend:dev
    ...
    ports:
      - mode: ingress
        host_ip: 127.0.0.1
        target: 8080
        published: "8080"
        protocol: tcp
  frontend:
    environment:
      NODE_ENV: development
      VITE_WS_URL: ws://localhost:8080/ws
    ...
  smoke:
    ...
config exit=0
```

The smoke override merges into the base backend environment (the base `NODE_ENV` is retained),
and no service/image/port/healthcheck is added beyond the existing `smoke` service.

### containerized smoke

The pre-existing dev containers had been up for 13 hours with the base environment (no smoke
overrides), and `run` reuses running dependencies, so the stack was stopped first so the smoke
command would create the backend from the merged config:

```
$ podman compose -f compose.yaml -f compose.smoke.yaml down
 Container cubeclicker-frontend-1 Stopped
 Container cubeclicker-backend-1 Stopped
 ...
down exit=0
```

Then the task's exact verify command:

```
$ npm run smoke
> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

 Network cubeclicker_default Created
 Container cubeclicker-frontend-1 Started
 Container cubeclicker-backend-1 Started
 Container cubeclicker-smoke-run-5d99111feece Created
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on server 1 (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined
PASS multiplayer overflow: the third client lands on server 2 (X = 2)
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1001ms
SMOKE PASS (8/8 checks)
smoke exit=0
```

Afterwards the baseline development stack was restored:

```
$ podman compose down          # exit 0
$ podman compose up -d         # exit 0
NAME                     IMAGE                                        ... STATUS
cubeclicker-backend-1    docker.io/library/cubeclicker-backend:dev    ... Up
cubeclicker-frontend-1   docker.io/library/cubeclicker-frontend:dev   ... Up
```

### unchanged paths check

```
$ git diff --name-only -- src/backend/Dockerfile src/frontend/Dockerfile README.md src/frontend/src/main.tsx src/frontend/index.html
(empty)
```

## Acceptance audit

- **AC-25 — Containerization impact.** **Met.** `compose.yaml` diff is exactly the one
  `MAX_USERS_PER_SERVER: "${MAX_USERS_PER_SERVER:-10}"` line under the backend environment;
  `compose.smoke.yaml` adds only the backend environment overrides
  `MAX_USERS_PER_SERVER: "2"` + `RECONNECT_GRACE_MS: "1000"`. No new services, images, ports,
  volumes or health signals; the merged config above proves the backend still exposes port
  8080 and the existing `/ws`; `git diff --name-only` on both Dockerfiles and `README.md` is
  empty. `podman compose up` remains the single local command (the restored stack is the
  unchanged base compose).
- **AC-26 — Extended containerized smoke test.** **Met.** The smoke transcript is a real
  container run: hello first for two clients (retained), both joins on server 1 with
  `maxUsers 2` and roster sizes 1 then 2 plus A's `memberJoined`, third client on server 2,
  A's `explode` observed on A (ack) and B (broadcast), and B's close producing
  `memberLeft(left)` on A after 1001 ms (inside the 1 s grace + 4 s budget). One PASS/FAIL line
  per check, the existing summary counts 8/8, and the script keeps the pre-existing
  `record(false)` + non-zero exit path (smoke exit 0 on success).

## Deviations from spec

None in the owned files. Environment note: the pre-existing 13-hour dev stack had to be
stopped before the smoke run so the smoke-only env overrides applied to the recreated backend;
the stack was restored afterwards. This is runtime state, not a repository deviation.

## Open questions

- Q-T15-1: The new smoke checks (like AC-26) assume a fresh backend registry (server 1/2). A
  smoke run against a long-lived backend that already has members could fail placement even
  though the code is correct. The pinned command/AC assume a fresh smoke backend; the script
  does not reset state. Confirm that keeping the fresh-registry assumption (rather than adding
  a restart step to `npm run smoke`) is intended.

## Appendix — exact `git diff` of the three owned files

```diff
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
 
diff --git a/tests/e2e/smoke.mjs b/tests/e2e/smoke.mjs
index fa05ead..3276f0a 100644
--- a/tests/e2e/smoke.mjs
+++ b/tests/e2e/smoke.mjs
@@ -11,7 +11,16 @@
 //   1. backend  GET /healthz  → 200 + `{"status":"ok"}`
 //   2. frontend GET /         → 200 + `text/html`
 //   3. two concurrent WebSocket clients, each receiving the pinned `hello` envelope with a
-//      parseable `serverTime` within 5s
+//      parseable `serverTime` within 5s (the first frame on every connection)
+//   4. two clients `join` → both `welcome`s report `serverId 1`/`maxUsers 2`, the roster grows
+//      from 1 (A's welcome) to 2 (B's welcome), and A also receives `memberJoined`
+//   5. a third client `join`s → `welcome.serverId 2` (overflow with X = 2)
+//   6. A's valid `explode` → `miniCubeRemoved` on A (ack) and B (broadcast)
+//   7. closing B's socket → A receives `memberLeft { reason: 'left' }` after the grace window
+//
+// Checks 4–7 exercise the multiplayer hub. `compose.smoke.yaml` pins
+// `MAX_USERS_PER_SERVER=2` and `RECONNECT_GRACE_MS=1000` for the smoke-run backend so the
+// overflow and leave checks finish inside the smoke budget.
 //
 // Readiness for (1) and (2) is polled within a bounded budget (`READY_TIMEOUT_MS`); the script
 // prints one PASS/FAIL line per check and exits non-zero if any check failed.
@@ -23,6 +32,12 @@ const READY_TIMEOUT_MS = Number(process.env.READY_TIMEOUT_MS ?? 30000);
 const HELLO_TIMEOUT_MS = 5000;
 const POLL_INTERVAL_MS = 500;
 const REQUEST_TIMEOUT_MS = 3000;
+/** Per-frame budget for the multiplayer checks (join/welcome/broadcast). */
+const MULTIPLAYER_TIMEOUT_MS = 5000;
+/** Leave budget: the smoke grace window is 1s, plus time for the timer and the broadcast. */
+const MEMBER_LEFT_TIMEOUT_MS = 5000;
+/** Lower bound proving the leave went through the grace window instead of firing instantly. */
+const GRACE_LOWER_BOUND_MS = 900;
 
 const results = [];
 
@@ -157,12 +172,354 @@ async function checkConcurrentWebSocketClients() {
   });
 }
 
+/** True for an ISO-8601 string `Date.parse` can read (the pinned `serverTime` contract). */
+function isParseableTimestamp(value) {
+  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
+}
+
+function problemText(error) {
+  return error instanceof Error ? error.message : String(error);
+}
+
+const JOIN_CHECK_LABEL =
+  'multiplayer join: two clients land on server 1 (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined';
+const OVERFLOW_CHECK_LABEL = 'multiplayer overflow: the third client lands on server 2 (X = 2)';
+const EXPLODE_CHECK_LABEL =
+  "multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)";
+const LEAVE_CHECK_LABEL =
+  "multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window";
+
+/**
+ * One WebSocket connection with a small message queue, so a check can wait for one specific
+ * frame without losing frames that arrived earlier (welcome, memberJoined, ...).
+ */
+class SmokeSocket {
+  #queue = [];
+  #waiters = [];
+  #closed = false;
+
+  constructor(label, url) {
+    this.label = label;
+    this.url = url;
+    this.socket = null;
+  }
+
+  open() {
+    return new Promise((resolve, reject) => {
+      const socket = new WebSocket(this.url);
+      this.socket = socket;
+      let settled = false;
+      let timer = null;
+
+      const fail = (problem) => {
+        if (settled) {
+          return;
+        }
+        settled = true;
+        if (timer !== null) {
+          clearTimeout(timer);
+        }
+        this.close();
+        reject(new Error(`${this.label}: ${problem}`));
+      };
+
+      timer = setTimeout(() => {
+        fail(`websocket did not open within ${HELLO_TIMEOUT_MS}ms`);
+      }, HELLO_TIMEOUT_MS);
+
+      socket.addEventListener(
+        'open',
+        () => {
+          if (settled) {
+            return;
+          }
+          settled = true;
+          clearTimeout(timer);
+          resolve();
+        },
+        { once: true },
+      );
+      socket.addEventListener(
+        'error',
+        () => {
+          fail('websocket error before open');
+        },
+        { once: true },
+      );
+      socket.addEventListener('message', (event) => {
+        this.#receive(event.data);
+      });
+      socket.addEventListener('close', () => {
+        this.#rejectWaiters();
+        fail('websocket closed before open');
+      });
+    });
+  }
+
+  next(timeoutMs) {
+    if (this.#queue.length > 0) {
+      return Promise.resolve(this.#queue.shift());
+    }
+    if (this.#closed) {
+      return Promise.reject(new Error(`${this.label}: socket closed before the expected message`));
+    }
+    return new Promise((resolve, reject) => {
+      const waiter = { resolve, reject, timer: null };
+      waiter.timer = setTimeout(() => {
+        const index = this.#waiters.indexOf(waiter);
+        if (index !== -1) {
+          this.#waiters.splice(index, 1);
+        }
+        reject(new Error(`${this.label}: no message within ${timeoutMs}ms`));
+      }, timeoutMs);
+      this.#waiters.push(waiter);
+    });
+  }
+
+  send(message) {
+    this.socket.send(JSON.stringify(message));
+  }
+
+  close() {
+    try {
+      this.socket?.close();
+    } catch {
+      // already closed
+    }
+  }
+
+  #receive(data) {
+    let message;
+    try {
+      message = JSON.parse(String(data));
+    } catch {
+      message = { type: '__unparseable__', raw: String(data) };
+    }
+    const waiter = this.#waiters.shift();
+    if (waiter === undefined) {
+      this.#queue.push(message);
+      return;
+    }
+    clearTimeout(waiter.timer);
+    waiter.resolve(message);
+  }
+
+  #rejectWaiters() {
+    this.#closed = true;
+    for (const waiter of this.#waiters.splice(0)) {
+      clearTimeout(waiter.timer);
+      waiter.reject(new Error(`${this.label}: socket closed before the expected message`));
+    }
+  }
+}
+
+/** Opens a socket and completes the retained handshake: `hello` first, then `join`. */
+async function connectAndJoin(label) {
+  const client = new SmokeSocket(label, WS_URL);
+  try {
+    await client.open();
+    const hello = await client.next(HELLO_TIMEOUT_MS);
+    if (hello?.type !== 'hello' || !isParseableTimestamp(hello.serverTime)) {
+      throw new Error(`${label}: expected the pinned hello first, got ${JSON.stringify(hello)}`);
+    }
+    client.send({ type: 'join' });
+    return client;
+  } catch (error) {
+    client.close();
+    throw error;
+  }
+}
+
+/**
+ * Consumes frames until `predicate` matches, failing on a server `error` frame, a closed
+ * socket, or the timeout. `expectation` names the awaited frame in failure output.
+ */
+async function waitForMessage(client, predicate, timeoutMs, expectation) {
+  const deadline = Date.now() + timeoutMs;
+  for (;;) {
+    const remaining = deadline - Date.now();
+    if (remaining <= 0) {
+      throw new Error(`${client.label}: timed out waiting for ${expectation}`);
+    }
+    const message = await client.next(remaining);
+    if (predicate(message)) {
+      return message;
+    }
+    if (message?.type === 'error') {
+      throw new Error(
+        `${client.label}: server error ${JSON.stringify(message.code)} while waiting for ${expectation}`,
+      );
+    }
+  }
+}
+
+/** The exact pinned checks for one `welcome` (assignment, capacity, self-inclusive roster). */
+function welcomeProblems(label, welcome, serverId, maxUsers, rosterSize) {
+  const problems = [];
+  if (welcome?.serverId !== serverId) {
+    problems.push(`${label} welcome.serverId expected ${serverId}, got ${JSON.stringify(welcome?.serverId)}`);
+  }
+  if (welcome?.maxUsers !== maxUsers) {
+    problems.push(`${label} welcome.maxUsers expected ${maxUsers}, got ${JSON.stringify(welcome?.maxUsers)}`);
+  }
+  if (welcome?.roster?.length !== rosterSize) {
+    problems.push(
+      `${label} welcome.roster expected ${rosterSize} member(s), got ${JSON.stringify(welcome?.roster?.length)}`,
+    );
+  }
+  return problems;
+}
+
+/**
+ * AC-26 end-to-end sequence against the smoke-run backend (X = 2, grace 1 s): join/roster,
+ * overflow, an explode ack + broadcast, and a disconnect that expires through the grace window.
+ * Every frame is server-authored; the script only asserts the concrete values it receives.
+ */
+async function checkMultiplayerFlow() {
+  const sockets = [];
+  let clientA = null;
+  let clientB = null;
+  let welcomeA = null;
+  let welcomeB = null;
+  let setupProblem = null;
+
+  try {
+    try {
+      clientA = await connectAndJoin('client A');
+      sockets.push(clientA);
+      welcomeA = await waitForMessage(
+        clientA,
+        (message) => message.type === 'welcome',
+        MULTIPLAYER_TIMEOUT_MS,
+        'welcome',
+      );
+
+      clientB = await connectAndJoin('client B');
+      sockets.push(clientB);
+      welcomeB = await waitForMessage(
+        clientB,
+        (message) => message.type === 'welcome',
+        MULTIPLAYER_TIMEOUT_MS,
+        'welcome',
+      );
+      await waitForMessage(
+        clientA,
+        (message) =>
+          message.type === 'memberJoined' && message.member?.playerId === welcomeB.playerId,
+        MULTIPLAYER_TIMEOUT_MS,
+        `memberJoined for ${welcomeB.playerId}`,
+      );
+    } catch (error) {
+      setupProblem = problemText(error);
+    }
+
+    const setupComplete = setupProblem === null;
+
+    if (setupComplete) {
+      const problems = [
+        ...welcomeProblems('A', welcomeA, 1, 2, 1),
+        ...welcomeProblems('B', welcomeB, 1, 2, 2),
+      ];
+      record(problems.length === 0, JOIN_CHECK_LABEL, problems.join('; '));
+    } else {
+      record(false, JOIN_CHECK_LABEL, setupProblem);
+    }
+
+    if (!setupComplete) {
+      record(false, OVERFLOW_CHECK_LABEL, 'not run — the two-client join failed');
+    } else {
+      let problem = null;
+      try {
+        const clientC = await connectAndJoin('client C');
+        sockets.push(clientC);
+        const welcomeC = await waitForMessage(
+          clientC,
+          (message) => message.type === 'welcome',
+          MULTIPLAYER_TIMEOUT_MS,
+          'welcome',
+        );
+        if (welcomeC.serverId !== 2) {
+          problem = `expected C welcome.serverId 2 (overflow at X = 2), got ${JSON.stringify(welcomeC.serverId)}`;
+        }
+      } catch (error) {
+        problem = problemText(error);
+      }
+      record(problem === null, OVERFLOW_CHECK_LABEL, problem ?? '');
+    }
+
+    if (!setupComplete) {
+      record(false, EXPLODE_CHECK_LABEL, 'not run — the two-client join failed');
+    } else {
+      const id = 'front:0:0';
+      const level = welcomeA.self.levelIndex;
+      let problem = null;
+      try {
+        clientA.send({ type: 'explode', id, level });
+        await Promise.all([
+          waitForMessage(
+            clientA,
+            (message) =>
+              message.type === 'miniCubeRemoved' &&
+              message.playerId === welcomeA.playerId &&
+              message.id === id,
+            MULTIPLAYER_TIMEOUT_MS,
+            `miniCubeRemoved ${id} on A (ack)`,
+          ),
+          waitForMessage(
+            clientB,
+            (message) =>
+              message.type === 'miniCubeRemoved' &&
+              message.playerId === welcomeA.playerId &&
+              message.id === id,
+            MULTIPLAYER_TIMEOUT_MS,
+            `miniCubeRemoved ${id} on B (broadcast)`,
+          ),
+        ]);
+      } catch (error) {
+        problem = problemText(error);
+      }
+      record(problem === null, EXPLODE_CHECK_LABEL, problem ?? '');
+    }
+
+    if (!setupComplete) {
+      record(false, LEAVE_CHECK_LABEL, 'not run — the two-client join failed');
+    } else {
+      let problem = null;
+      let elapsedMs = null;
+      try {
+        const closedAt = Date.now();
+        clientB.close();
+        const left = await waitForMessage(
+          clientA,
+          (message) => message.type === 'memberLeft' && message.playerId === welcomeB.playerId,
+          MEMBER_LEFT_TIMEOUT_MS,
+          `memberLeft for ${welcomeB.playerId}`,
+        );
+        elapsedMs = Date.now() - closedAt;
+        if (left.reason !== 'left') {
+          problem = `expected reason "left", got ${JSON.stringify(left.reason)}`;
+        } else if (elapsedMs < GRACE_LOWER_BOUND_MS) {
+          problem = `memberLeft arrived after ${elapsedMs}ms, before the 1000ms grace window`;
+        }
+      } catch (error) {
+        problem = problemText(error);
+      }
+      record(problem === null, LEAVE_CHECK_LABEL, problem ?? `memberLeft(left) received after ${elapsedMs}ms`);
+    }
+  } finally {
+    for (const socket of sockets) {
+      socket.close();
+    }
+  }
+}
+
 async function main() {
   console.log(`smoke: backend=${BACKEND_URL} frontend=${FRONTEND_URL} ws=${WS_URL} readyTimeoutMs=${READY_TIMEOUT_MS}`);
 
   await checkBackendHealth();
   await checkFrontendServesHtml();
   await checkConcurrentWebSocketClients();
+  await checkMultiplayerFlow();
 
   const failures = results.filter((result) => !result.ok).length;
   if (failures === 0) {
```
