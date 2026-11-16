# Build log — T9 — Verify & integrate

Task: T9 — Verify & integrate `[seq]` (2026-11-16)
Files changed: `docs/features/presence-and-activity-liveness/build-log-T9.md`
Branch: `feat/presence-and-activity-liveness` @ `dd223ee1704d60c48401925e3f23ad54797577ad`
No source, test, documentation (other than this log), package, compose or Dockerfile change.

What changed & why: nothing in the product. This task runs the full root gate on the completed
feature branch, records the raw output, confirms T1–T8 are `[x]` with their own raw verify
evidence, re-audits AC-1…AC-23 against the shipped tests and transcripts, proves the protected
container/package files are byte-unchanged, and proposes the `docs/features/README.md` row for the
orchestrator (not applied here).

## Environment

```text
$ node --version
v24.22.3
$ npm --version
11.19.1
$ podman --version
podman version 6.1.3
$ podman compose version
Docker Compose version v5.6.0   (external provider /usr/local/bin/docker-compose)
$ git rev-parse HEAD
dd223ee1704d60c48401925e3f23ad54797577ad
$ git branch --show-current
feat/presence-and-activity-liveness
```

The smoke stack was already up from the T7 pre-start with the smoke override
(`podman compose -f compose.yaml -f compose.smoke.yaml up -d --build`). It was verified to be the
current tree before the run: `cubeclicker-backend-1` carries
`MAX_USERS_PER_SERVER=2`, `RECONNECT_GRACE_MS=1000`; the backend/frontend `dev` containers bind-mount
the current clean checkout; `cubeclicker-frontend-prod-1` runs image id
`1c708e05e08ffa95f9b72f440a18fea128777cd54aa057a3c7a56368301021ed`, which is the image the T9
`build frontend-prod` step reproduces (fully cached).

## Gate summary

| # | Command | Exit | Evidence |
| --- | --- | --- | --- |
| 1 | `npm run lint` | 0 | no diagnostics |
| 2 | `npm run typecheck` | 0 | both workspaces |
| 3 | `npm test` | 0 | backend 37 files / 1537 tests; frontend 75 files / 2301 tests |
| 4 | `npm run coverage` | 0 | backend 96.2 / 89.92 / 99.57 / 96.2; frontend 96.68 / 96.43 / 97.85 / 96.68 |
| 5 | `npm run build` | 0 | tsc + vite build + `Bundle budget OK.` |
| 6 | `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` | 0 | image `1c708e05e08f` |
| 7 | `npm run smoke` | 0 | `SMOKE PASS (28/28 checks)` |
| 8 | `git diff --exit-code -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json` | 0 | no output |

## Raw gate output

### 1. `npm run lint` — exit 0

```text
> lint
> eslint .

LINT_EXIT=0
```

### 2. `npm run typecheck` — exit 0

```text
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

### 3. `npm test` — exit 0

```text
> test
> npm run test --workspaces --if-present


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/broadcast.test.ts (13 tests) 15ms
 ✓ src/game/cubes.test.ts (24 tests) 15ms
 ✓ src/auth/session-repository.test.ts (35 tests) 22ms
 ✓ src/game/activity.test.ts (24 tests) 19ms
 ✓ src/game/protocol.test.ts (467 tests) 70ms
 ✓ src/game/hub.test.ts (193 tests) 320ms
 ... (remaining backend files)
 Test Files  37 passed (37)
      Tests  1537 passed (1537)
   Duration  3.63s (transform 5.58s, setup 0ms, collect 14.87s, tests 14.27s, environment 7ms, prepare 3.54s)


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/game-view.css.test.ts (58 tests) 21ms
 ✓ src/multiplayer/protocol.test.ts (554 tests) 76ms
 ✓ src/multiplayer/activity-lifetime.test.ts (18 tests) 14ms
 ✓ src/multiplayer/server-state.test.ts (87 tests) 37ms
 ✓ src/browser-env.test.ts (7 tests) 18ms
 ✓ src/ui/ActivityFeed.test.tsx (7 tests) 44ms
 ✓ src/game/session.test.ts (123 tests) 1950ms
 ✓ src/App.test.tsx (50 tests) 1133ms
 ... (remaining frontend files)
 Test Files  75 passed (75)
      Tests  2301 passed (2301)
   Duration  4.05s (transform 10.66s, setup 0ms, collect 27.74s, tests 13.44s, environment 9.24s, prepare 7.09s)

TEST_EXIT=0
```

Total: **3838 tests** (1537 backend + 2301 frontend), 112 test files, 0 failures.
(The `stderr` `HTMLCanvasElement.getContext` / `THREE.WebGLRenderer` notices are the pre-existing
jsdom canvas environment noise, not failures.)

### 4. `npm run coverage` — exit 0 (both workspaces above the 80 gate)

```text
> coverage
> npm run coverage --workspaces --if-present


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 Test Files  37 passed (37)
      Tests  1537 passed (1537)
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |    96.2 |    89.92 |   99.57 |    96.2 |
 src               |   96.78 |    90.56 |     100 |   96.78 |
 src/game          |   95.64 |    94.35 |   99.03 |   95.64 |
  activity.ts      |     100 |      100 |     100 |     100 |
  hub.ts           |    91.1 |    88.69 |   98.48 |    91.1 | ...1716,1767-1770
  protocol.ts      |   99.28 |     99.1 |   97.56 |   99.28 | 386-387,987-988
 src/observability |   99.67 |     96.5 |     100 |   99.67 |
  metrics.ts       |   99.45 |    93.54 |     100 |   99.45 | 248-249
 ... (remaining file rows elided)
-------------------|---------|----------|---------|---------|-------------------


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 Test Files  75 passed (75)
      Tests  2301 passed (2301)
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.68 |    96.43 |   97.85 |   96.68 |
 src               |   88.22 |    85.53 |   95.65 |   88.22 |
  browser-env.ts   |   93.65 |      100 |   92.85 |   93.65 | 76-79
 src/game          |   96.41 |     99.4 |   99.01 |   96.41 |
  session.ts       |   91.29 |    98.84 |   97.43 |   91.29 | ...1670,1805-1806
 src/multiplayer   |   94.88 |    97.35 |   96.87 |   94.88 |
  ...y-lifetime.ts |     100 |      100 |     100 |     100 |
  protocol.ts      |   91.85 |    97.15 |   92.85 |   91.85 | ...1575,1579-1589
  server-state.ts  |   97.79 |    95.67 |     100 |   97.79 | ...88,390-391,454
  transport.ts     |   99.49 |      100 |     100 |   99.49 | 200
 src/ui            |   96.97 |    94.52 |   95.23 |   96.97 |
  ActivityFeed.tsx |     100 |      100 |     100 |     100 |
 ... (remaining file rows elided)
-------------------|---------|----------|---------|---------|-------------------
COVERAGE_EXIT=0
```

**Per-workspace coverage (V8, thresholds 80/80/80/80):**

| Workspace | Statements | Branches | Functions | Lines | Result |
| --- | --- | --- | --- | --- | --- |
| `@cubeclicker/backend` | 96.2 | 89.92 | 99.57 | 96.2 | pass |
| `@cubeclicker/frontend` | 96.68 | 96.43 | 97.85 | 96.68 | pass |

The feature's new files: backend `activity.ts` 100/100/100/100, `hub.ts` 91.1/88.69/98.48/91.1;
frontend `activity-lifetime.ts` 100/100/100/100, `server-state.ts` 97.79/95.67/100/97.79,
`session.ts` 91.29/98.84/97.43/91.29, `browser-env.ts` 93.65/100/92.85/93.65. No coverage
exclusion or threshold was added or changed (no Vitest/ESLint/tsconfig file appears in the
feature diff).

### 5. `npm run build` — exit 0

```text
> build
> npm run build --workspaces --if-present


> build
> tsc


> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
transforming...
✓ 110 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.49 kB │ gzip:   0.31 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-KuxM9rl7.css                        28.80 kB │ gzip:   5.68 kB
dist/assets/cursor-ship-l83NC1yv.js                    6.73 kB │ gzip:   2.21 kB
dist/assets/SpaceshipCustomizationPanel-C4UIZYzZ.js    9.54 kB │ gzip:   3.34 kB
dist/assets/browser-env-BqTD6d93.js                   49.34 kB │ gzip:  18.20 kB
dist/assets/index-DBMsE5gI.js                         99.20 kB │ gzip:  30.51 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-4rmoIDEa.js                        609.34 kB │ gzip: 154.32 kB
✓ built in 1.65s
entry index assets/index-DBMsE5gI.js raw=99203 gzip=30505
initial files=2 raw=320902 gzip=99461 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=165000
total files=6 raw=995849 gzip=277535 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-C4UIZYzZ.js raw=9537 gzip=3337 initial=false
chunk browser-env assets/browser-env-BqTD6d93.js raw=49344 gzip=18204 initial=false
chunk cursor-ship assets/cursor-ship-l83NC1yv.js raw=6729 gzip=2210 initial=false
chunk index assets/index-DBMsE5gI.js raw=99203 gzip=30505 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-4rmoIDEa.js raw=609337 gzip=154323 initial=false

Bundle budget OK.
BUILD_EXIT=0
```

(The local bundle hashes differ from the smoke image's `index-D1fiPtRN.js` because the image build
injects `VITE_WS_URL` via its Docker `ARG`/`ENV` while this local build ran without `VITE_WS_URL` /
`VITE_API_URL` in the environment (both verified unset); the smoke assertions read
`/bundle-report.json` dynamically, so no filename is hard-coded.)

### 6. `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` — exit 0

```text
[2/3] STEP 7/10: COPY src/frontend src/frontend
--> Using cache 062a8cb0883e144ea016e558b233d6b3a6fe96b089ccdabbaf144d7e553eb9d6
[2/3] STEP 10/10: RUN npm run build -w @cubeclicker/frontend
--> Using cache 3c5c1313f4cda4cedc60e48dc6beedfe9ff148740427db65fb2ce1cc910b1a57
[3/3] COMMIT docker.io/library/cubeclicker-frontend:prod-smoke
--> 1c708e05e08f
Successfully tagged docker.io/library/cubeclicker-frontend:prod-smoke
1c708e05e08ffa95f9b72f440a18fea128777cd54aa057a3c7a56368301021ed
Successfully built 1c708e05e08f
Successfully tagged cubeclicker-frontend:prod-smoke
 Image cubeclicker-frontend:prod-smoke Built
PROD_BUILD_EXIT=0
```

Every layer was cached from the current-tree build; the resulting image id equals the running
`cubeclicker-frontend-prod-1` image.

### 7. `npm run smoke` — exit 0 (`SMOKE PASS (28/28 checks)`)

```text
> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

 Container cubeclicker-backend-1 Running
 Container cubeclicker-frontend-1 Running
 Container cubeclicker-db-1 Running
 Container cubeclicker-frontend-prod-1 Running
 Container cubeclicker-mailpit-1 Running
 Container cubeclicker-db-1 Waiting
 Container cubeclicker-db-1 Healthy
 Container cubeclicker-smoke-run-1891cd8b4aad Creating
 Container cubeclicker-smoke-run-1891cd8b4aad Created
smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 13
PASS activity snapshot: A's welcome feed is empty and B's welcome carries exactly A's memberJoined event — server 13; memberJoined id 1 for p22
PASS leaderboard join: A's welcome is a one-entry zero snapshot and B's welcome carries A and B with zero counters and totals — server 13
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 14
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)
PASS multiplayer batching: front:0:1 and front:0:2 never arrive as single miniCubeRemoved frames on A or B
PASS leaderboard update: the accepted explodes yield a coalesced leaderboardUpdate with A clicks >= 3, B clicks = 0 and totals clicks >= 3 — A clicks 3, B clicks 0, totals clicks 3
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1002ms
PASS activity leave: A receives the memberLeft activity event with B's name and an id newer than the snapshot id — memberLeft id 2 for p23
PASS multiplayer explicit leave: D's leave yields memberLeft(left) on A in under 900ms without the grace window — memberLeft(left) received after 0ms
PASS multiplayer slot reuse: E fills D's freed slot 2 with welcome.roster exactly [A, E] — server 13; roster [A, E] in D's freed slot 2
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=36 cubeclicker_ws_messages_received_total{type="join"}=28 cubeclicker_ws_frames_sent_total{type="hello"}=36
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-D1fiPtRN.js is served gzip with immutable caching — content-encoding gzip; 99269 B decompressed
PASS prod /assets/three-4rmoIDEa.js is served gzip with immutable caching — content-encoding gzip; 609337 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (28/28 checks)
SMOKE_EXIT=0
```

`grep -c '^PASS'` = **28**. The three feature-specific lines:

```text
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1002ms
PASS multiplayer explicit leave: D's leave yields memberLeft(left) on A in under 900ms without the grace window — memberLeft(left) received after 0ms
PASS multiplayer slot reuse: E fills D's freed slot 2 with welcome.roster exactly [A, E] — server 13; roster [A, E] in D's freed slot 2
```

The abrupt-close check is unchanged (B closes its socket with no `leave`; `memberLeft(left)` arrives
after 1002 ms, i.e. ≥ the 900 ms `GRACE_LOWER_BOUND_MS`), and D's explicit leave arrives in 0 ms
(< 900 ms), followed by E's `welcome.roster` exactly `[A, E]`.

### 8. Protected container/package files — exit 0, byte-unchanged

```text
$ git diff --exit-code -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json
(no output)
PROTECTED_DIFF_EXIT=0
```

The feature diff (`git diff --name-only $(git merge-base HEAD main)..HEAD`) contains no
`compose*.yaml`, Dockerfile, `package.json`, `package-lock.json`, Vitest, ESLint or tsconfig file.

## Task-board and build-log audit (T1–T8)

`tasks.md` mark all eight dependency tasks `[x]`; T9 is `[>]` (in progress, this task). Each build
log records raw verify evidence:

| Task | Status | Raw verify evidence in its log |
| --- | --- | --- |
| T1 | `[x]` | `lint` 0, `typecheck` 0, backend test 37/1520, backend coverage 96.15/89.81/99.57/96.15 exit 0 |
| T2 | `[x]` | original red evidence retained + post-T3 green re-verification: backend 1537 tests, coverage 96.2/89.92/99.57/96.2 exit 0 |
| T3 | `[x]` | `lint` 0, `typecheck` 0, backend 1537 tests, coverage 96.2/89.92/99.57/96.2 exit 0, `git diff --check` 0 |
| T4 | `[x]` | `lint` 0, `typecheck` 0, frontend 2262 tests, coverage 96.63/96.35/97.8/96.63 exit 0, fixture parity 11/11 |
| T5 | `[x]` | `lint` 0, `typecheck` 0, frontend 2287 tests, coverage 96.66/96.41/97.83/96.66 exit 0, `git diff --check` 0 |
| T6 | `[x]` | `lint` 0, `typecheck` 0, frontend 2301 tests, coverage 96.68/96.43/97.85/96.68 exit 0, `git diff --check` 0 |
| T7 | `[x]` | `node --check` 0, prod image build 0, `npm run smoke` 28/28 PASS exit 0, `git diff --check` 0 |
| T8 | `[x]` | nine `grep -F` checks 0, link check 0, `git diff --check` 0, untouched-docs diff 0 |

Gaps / notes (none blocking):

- T2's gate was red when it committed (five T3-owned `hub.test.ts` welcome expectations) by design;
  its log records the red raw output and the post-T3 green re-verification (`5b678e1`). No open gap.
- T1/T2/T4/T5 are pure-module/test-only tasks; each log documents the integration-tier exception
  assigned by `tasks.md` (T3 hub suite, T6 session suite, T7 containerized smoke). T7 is a
  test-only and T8 a documentation-only task with no coverage delta, as their logs state.
- T9 remains `[>]` in `tasks.md`/`status.md`: those files are orchestrator-owned and outside this
  task's `files_owned`; the orchestrator closes T9 and the building phase.
- Pre-existing whitespace nit outside this task's scope: `git diff --check` over the whole feature
  range flags `docs/features/presence-and-activity-liveness/build-log-T2.md:188: new blank line at
  EOF.` The T9-owned file is clean; T2's log is not editable by T9 (`files_owned`).
- The feature artifacts `spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/` remain untracked
  in the checkout (as they were throughout the build); this task commits only its build log.

## Final AC-1…AC-23 audit

All acceptance criteria are **met** on this commit; every citation below is part of the green
`npm test`/`npm run coverage` run recorded above unless it is a command/transcript item.

### Presence and explicit leave

- **AC-1 — met.** `hub.test.ts` `removes the member immediately on leave, closes the peer and
  leaves no grace timer (AC-1)`: B receives exactly
  `{"type":"memberLeft","playerId":"p1","reason":"left"}` then the `memberLeft` activity event; A
  receives `[]`; `closeCalls === 1`; `vi.getTimerCount()` 3 → 2; gauges `members_active` 1 /
  `servers_active` 1; one full grace later still exactly one `memberLeft` for p1.
- **AC-2 — met.** `keeps the accepted grace and resumes identity, cube and counters on rejoin
  (AC-2)` (no `memberLeft` before the deadline; at `grace − 1` the same `p1`, server 1, slot-1
  position, `removedIds`, roster `[A,B]`, resumed `leaderboard.entries` `p1 clicks 54`/`p2 clicks 0`,
  `totals.facesDestroyed 6`) and `finalizes an unrejoined abrupt close exactly at the grace deadline
  and frees the slot (AC-2)` (exactly one `memberLeft(left)` + activity at `t + 30 000`, then p3 in
  slot 1).
- **AC-3 — met.** `fails rejoin after leave and creates a fresh member in the freed slot (AC-3)`:
  two `resume_failed` errors, then `p3` / `Player 3` at A's slot-1 position, a new token and roster
  `[p3,p2]`.
- **AC-4 — met.** `destroys the last member server immediately on leave and starts no grace
  (AC-4)` (timers 2 → 0, both gauges 0, one peer close, no frames, token fails, next join server 2),
  `keeps an abruptly closed last member server alive through the grace window (AC-4)` and the
  unchanged `activity.test.ts` `dropServer`/`clear` ring-teardown tests.
- **AC-5 — met.** `rebuilds roster and leaderboard inputs from the surviving members after leave
  (AC-5)`: next coalesced snapshot exactly `[p2]` with zero totals, C fills slot 1,
  `welcome.roster` exactly `[p3,p2]` in slot order, C's position equals A's old slot-1 position,
  `welcome.leaderboard.entries` exactly `[p3,p2]`, totals zero. The `memberLeft` reducer removal is
  green in `server-state.test.ts`.
- **AC-6 — met.** `leaves only the sending tab and keeps the account other tab playing (AC-6)`:
  only p1 leaves, tab 2 stays open/joined, one `p2 alice` row with zero totals, and tab 2's
  accepted `explode` is broadcast.
- **AC-7 — met.** `session.test.ts` `pagehide leave (AC-7)` (exactly
  `['{"type":"join","mode":"guest"}','{"type":"leave"}']`; bfcache/pre-welcome/disconnected/dispose
  silence; escaped callback silence; throwing socket attempts exactly `[{type:'leave'}]`, completes
  and tears down with `getTimerCount() === 0`; no-source attach silent) and `browser-env.test.ts`
  `forwards pagehide with the strict bfcache flag and removes the exact listener (AC-7)`.
- **AC-8 — met.** Both mirrors' `client leave` fixture matrices (parity 11/11 recorded in T4),
  extra-field dropping, re-encode exactly `{"type":"leave"}`, unknown/malformed/`memberLeft` frames
  `bad_message`; `hub.test.ts` `rejects leave from a connection that never joined and removes
  nothing (AC-8)` returns exactly `error not_joined`, closes nothing, removes nothing.
- **AC-9 — met.** `metrics.test.ts` allow-list acceptance and `hub.test.ts` `counts the leave frame
  and the client close reason exactly once (AC-9)`: received `leave` 1, `members_active` 1,
  `servers_active` 1, `ws_connections_open` 1, closed `reason="client"` 1, encoded `leave` absent;
  the catalog count is unchanged (no new metric).
- **AC-10 — met.** The `protocol.ts` diff adds only the `ACTIVITY_EVENT_TTL_MS` constant, the
  `leave` client union member and its decoder case (both mirrors); no `ServerMessage` variant, no
  `MemberState`/`LeaderboardSnapshot`/`ActivityEvent`/`welcome`/`worldEntered` shape change, no
  presence field and no version bump. The representative `welcome` frame is pinned byte-identical in
  both suites; the frontend suite asserts `leave` as a *server* frame is `bad_message`. The
  old-client/new-backend behavior is the documented graceful degradation (spec § Mixed versions),
  not a wire obligation. Evidence: `protocol.test.ts` (both workspaces) + final diff.
- **AC-11 — met.** `activity.test.ts` `pins the 5000 ms activity eligibility TTL`, `serves an event
  at 4999 ms and expires it at exactly 5000 ms`, and the independent-events snapshot at 6000; both
  mirrors pin `ACTIVITY_EVENT_TTL_MS === 5000`; fresh arrays/objects are covered by the copy tests.
- **AC-12 — met.** `activity.test.ts` `keeps the 20 newest events newest first with a long TTL seam`
  (`ttlMs: 1_000_000`, ids `[25…6]`), `serves exactly the five freshest events at 24 000 and keeps
  advancing ids` (`[25,24,23,22,21]`, next id 26), `prunes the expired tail without moving nextId or
  lastAcceptedAt`, plus the unchanged 1 s gate/drop/cadence and `dropServer`/`clear` tests.
- **AC-13 — met.** `hub.test.ts` `carries only unexpired events on welcome across the 4999/5000
  boundary (AC-13)` (both at 4999; only the 1000 event at exactly 5000; `[]` for a fresh join at
  6000) and `carries only the target server unexpired events on worldEntered (AC-13)`; the ring
  reconnect test now asserts `[26,25,24,23,22]`.
- **AC-14 — met.** The unchanged `encodes an accepted event once and fans the identical text to
  every member (AC-14)` hub test (one `JSON.stringify` per accepted event, identical bytes) and
  `session.test.ts` `expires a live event exactly 5000 ms after local receipt (AC-14)` (present at
  4999, absent after the 5000 tick).

### Temporal activity

- **AC-15 — met.** `activity-lifetime.test.ts` `expires the current feed at 5000 and the pending feed
  at 6000/8000, then the swap carries only e3` and `session.test.ts` `expires the current feed at
  5000 and the pending feed at 6000/8000 across the travel midpoint (AC-15)`; the exact 0/1000/3000/
  5000/6000/7000/8000 timeline runs with no post-seed `welcome`, and the untouched branch identity is
  asserted with `toBe`.
- **AC-16 — met.** `activity-lifetime.test.ts` `preserves the remaining lifetime of a re-seeded
  event and anchors a new id at its own receipt` and `session.test.ts` `keeps the remaining lifetime
  across a same-server rejoin and anchors new ids at receipt (AC-16)` (e1 present at 4999, absent at
  5000, not extended to 9000; new id expires at 9000; no pending swap).
- **AC-17 — met.** `activity-lifetime.test.ts` `filters a locally expired key from a 5001 re-seed
  synchronously, before any tick` and `session.test.ts` `filters a locally expired re-seed
  synchronously on the next reduction, before any tick (AC-17)`: immediately after the 5001
  `welcome` (no timer) the feed is `[]` and every publish on that reduction is `[]`; empty through
  9999; fresh again at 10000; a server-2 welcome drops server-1 keys and tracks the colliding id
  independently; `size()` bounded.
- **AC-18 — met.** `activity-lifetime.test.ts` `pins the 250 ms fallback prune cadence (AC-18)`;
  `session.test.ts` `owns one 250 ms fallback interval per online attach cycle and clears it on
  dispose (AC-18)`, `publishes nothing while no line is expiring (AC-18)`, `prunes immediately when
  the tab becomes visible, before the next frame (AC-18)`, `runs no callback, publish or state change
  after dispose (AC-18)`; `server-state.test.ts` `pruneActivity (AC-15, AC-18)` pins same-reference
  no-ops and per-branch identity.
- **AC-19 — met.** No `src/ui` or CSS file appears in the feature diff; `ActivityFeed.test.tsx`
  (7), `App.test.tsx` (50) and `game-view.css.test.ts` (58) are green unchanged in the final
  frontend run (single live region, no exit animation, reduced-motion entry untouched).

### Documentation, containers and gates

- **AC-20 — met.** Re-verified on `dd223ee`: the nine `grep -F` checks (all `OK`), the
  dependency-free relative-link check (`LINKCHECK_EXIT=0`) and
  `git diff --exit-code -- README.md docs/architecture/containerization.md docs/features/README.md`
  (`UNTOUCHED_EXIT=0`). `docs/features/README.md` is proposed below, not edited.
- **AC-21 — met.** Protected-file diff exit 0 with no output (gate #8); the backend still serves
  `GET /ws` (smoke `hello` PASS); no new service, image, port, env var or health signal.
- **AC-22 — met.** The smoke transcript retains the abrupt check (1002 ms ≥ 900 ms) and adds the
  explicit leave (0 ms < 900 ms) and E's freed-slot `welcome.roster` exactly `[A, E]`; 28/28 checks
  PASS. The existing activity-leave check is unchanged.
- **AC-23 — met.** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (both
  workspaces ≥ 80 in all four metrics), `npm run build` and `npm run smoke` all exit 0 with the raw
  output above; no assertion was weakened and no coverage exclusion/threshold was added (no config
  file in the feature diff; zero banned wildcard matchers in added test lines, zero `closeTo`).

## Proposed `docs/features/README.md` row (NOT applied)

Smallest possible row addition, appended after the last row (before the `States:` line), matching
the existing columns:

```diff
+| presence-and-activity-liveness | Presence & Activity Liveness (explicit leave on pagehide; five-second activity lifetime) | code_review | 2026-11-16 |
```

`code_review` is the state this feature enters when T9 completes; if the orchestrator applies the
row while the building phase is still open it should use `building` instead. No other row changes.

## Deviations from spec

None. T9 is a verification task: no product, test, documentation (other than this log), package,
compose, Dockerfile or coverage-configuration change; no assertion was relaxed and no AC was
downgraded. The only observations are the non-blocking notes recorded in the task-board audit.

## Post-review bookkeeping (code-review r1)

This log is retained as written at T9 completion; this note reconciles its task-state wording with
the state that followed, without rewriting the recorded history.

- T9 is now `[x]` in `tasks.md`, and `status.md` records `building → code_review`. The statements
  above that T9 remains `[>]` and that `tasks.md`/`status.md` are orchestrator-owned describe the
  moment this log was written; the orchestrator closed T9 and the building phase afterwards.
- The feature artifacts (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/`) are now tracked
  by the `docs: track presence feature artifacts and close review r1` commit, so the committed
  `docs/architecture/realtime.md` relative link to `spec.md` resolves on a clean checkout (F1).
- `build-log-T2.md` now ends with exactly one newline, so `git diff --check` over the feature range
  is clean (F3).
- `spec.md` frontmatter now declares `status: approved` (F5); the r3 content is unchanged.
- Code-review F4 (delayed close reason) is fixed in `hub.ts`/`hub.test.ts` and recorded in
  `build-log-r1-fixes.md`.
