# Build log — T16 — Containerized smoke check

Task: T16 (2026-11-19)
Files changed: `tests/e2e/smoke.mjs`, `docs/features/remote-spaceship-customization/build-log-T16.md` (this log)
Branch: `feat/remote-spaceship-customization`
Commit: `test: cover guest appearance in smoke` (hash in `git log`; not pushed)

## Sketch (≤5 lines)

- Reuse the accepted two-guest join in `checkMultiplayerFlow`; capture A's `memberJoined` for B.
- Assert B's roster entry starts `appearance: {}`; B sends one valid 11-slot `setAppearance`.
- A must receive exactly one `memberAppearance` for B with the same 11-entry record.
- B sends an unknown-slot-key frame → B gets `{ type: 'error', code: 'bad_message' }`; settle and pin
  exactly one `memberAppearance` on A (no broadcast).
- No service/port/env/compose change; one new PASS/FAIL check line.

## What changed & why

- `tests/e2e/smoke.mjs` gains one check (label `APPEARANCE_CHECK_LABEL`, executed inside the existing
  `checkMultiplayerFlow` after the join/activity checks) that pins the AC-35 public appearance
  round trip end to end:
  - the existing guest pair A/B is reused (the compose smoke backend keeps
    `MAX_USERS_PER_SERVER=2`, so both are on the run's first server; no new client/server/port);
  - the `memberJoined` frame A received for B is retained as `memberJoinedB`, and
    `appearanceProblems('A memberJoined for B appearance', …, {})` proves A's roster entry for B
    started with an **empty** appearance before any `setAppearance`;
  - both `welcome`s are asserted to be guests (`identity.kind === 'guest'`), so the check cannot
    silently pass against the account no-op path;
  - B sends `{ type: 'setAppearance', appearance: FULL_APPEARANCE }` where `FULL_APPEARANCE` is the
    full 11-slot v3 record (`<slot>-bulwark-crimson`, the T6 worst-case fixture, so the longest
    accepted part ids travel);
  - A's `memberAppearance` for B is compared key-by-key against `FULL_APPEARANCE` with the new
    concrete `appearanceProblems` helper (plain object, exactly 11 entries, no extra keys);
  - B then sends `{ type: 'setAppearance', appearance: { spoiler: 'hull-obsidian' } }` (unknown slot
    key); B must receive exactly `{ type: 'error', code: 'bad_message' }`;
  - after a 250 ms settle, A's history must contain **exactly one** `memberAppearance` frame in
    total (the accepted one) — a broadcast caused by the rejected frame would land in the settle.
- The header check list documents the new check as 4c; no existing check was changed or removed.

## Decisions

- **Reuse the established A/B pair instead of opening a new one.** The two guests are already proven
  to share the run's first server, and `memberJoined` is the exact "A's roster entry for B" the AC
  names. A separate client pair would add another join/settle cycle and depend on the slot registry
  being empty again; reusing the pair adds only one `setAppearance`/error round trip (~250 ms).
- **Guest identity is asserted explicitly.** `setAppearance` from an account is a specified silent
  no-op, so `identity.kind === 'guest'` on both welcomes keeps the check from passing vacuously if
  the smoke run were ever authenticated.
- **Concrete equality, no wildcards.** `appearanceProblems` checks entry count, every expected
  slot→part-id pair and rejects unexpected keys; the negative assertion is an exact history count,
  not a truthiness check.
- **One PASS/FAIL line for the whole AC-35 sequence**, wrapped in the existing `record` convention
  (`PASS`/`FAIL` plus a concrete detail string), so the transcript remains one line per check.
- **No Vitest tier in this task.** There is no production behavior change: T3 (`protocol.test.ts`)
  and T6 (`hub.test.ts`, `app.test.ts`) already cover the codec, hub authority and fan-out at the
  unit/integration tiers. T16's brief and verify command are the containerized smoke tier
  (`npm run smoke`); the syntax check below covers the only edited file, which the repo ESLint
  config intentionally ignores (`tests/e2e/**`).

## Evidence

### `npm run smoke` — PASS (29/29)

```
> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-frontend-prod-1 Creating 
 Container cubeclicker-frontend-prod-1 Created 
 Container cubeclicker-mailpit-1 Starting 
 Container cubeclicker-frontend-1 Starting 
 Container cubeclicker-frontend-prod-1 Starting 
 Container cubeclicker-db-1 Starting 
 Container cubeclicker-mailpit-1 Started 
 Container cubeclicker-frontend-1 Started 
 Container cubeclicker-frontend-prod-1 Started 
 Container cubeclicker-db-1 Started 
 Container cubeclicker-db-1 Waiting 
 Container cubeclicker-db-1 Healthy 
 Container cubeclicker-backend-1 Starting 
 Container cubeclicker-backend-1 Started 
 Container cubeclicker-smoke-run-d9285705c9e6 Creating 
 Container cubeclicker-smoke-run-d9285705c9e6 Created 
smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 1
PASS activity snapshot: A's welcome feed is empty and B's welcome carries exactly A's memberJoined event — server 1; memberJoined id 1 for p1
PASS appearance projection: guest B's 11-slot setAppearance yields exactly one memberAppearance on guest A, and an unknown slot key yields bad_message without a broadcast — playerId p2; 11 slots; unknown slot key rejected with bad_message; 1 memberAppearance frame(s) seen by A
PASS leaderboard join: A's welcome is a one-entry zero snapshot and B's welcome carries A and B with zero counters and totals — server 1
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 2
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)
PASS multiplayer batching: front:0:1 and front:0:2 never arrive as single miniCubeRemoved frames on A or B
PASS leaderboard update: the accepted explodes yield a coalesced leaderboardUpdate with A clicks >= 3, B clicks = 0 and totals clicks >= 3 — A clicks 3, B clicks 0, totals clicks 3
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1005ms
PASS activity leave: A receives the memberLeft activity event with B's name and an id newer than the snapshot id — memberLeft id 2 for p2
PASS multiplayer explicit leave: D's leave yields memberLeft(left) on A in under 900ms without the grace window — memberLeft(left) received after 0ms
PASS multiplayer slot reuse: E fills D's freed slot 2 with welcome.roster exactly [A, E] — server 1; roster [A, E] in D's freed slot 2
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=9 cubeclicker_ws_messages_received_total{type="join"}=7 cubeclicker_ws_frames_sent_total{type="hello"}=9
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-6XwuB9OH.js is served gzip with immutable caching — content-encoding gzip; 101707 B decompressed
PASS prod /assets/three-4kUmpljF.js is served gzip with immutable caching — content-encoding gzip; 610310 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (29/29 checks)
SMOKE EXIT: 0
```

The new check appears once in the transcript (`PASS appearance projection: … — playerId p2; 11 slots;
unknown slot key rejected with bad_message; 1 memberAppearance frame(s) seen by A`); the other 28
accepted checks are unchanged and still pass.

### Syntax check of the changed file

Repo ESLint explicitly ignores `tests/e2e/**` (no repo lint coverage for the smoke script), so:

```
$ npx eslint tests/e2e/smoke.mjs
/…/tests/e2e/smoke.mjs
  0:0  warning  File ignored because of a matching ignore pattern. Use "--no-ignore" to disable file ignore settings or use "--no-warn-ignored" to suppress this warning

✖ 1 problem (0 errors, 1 warning)
eslint exit: 0
```

Syntax proof for the changed file (Node parser, same runtime as the smoke image):

```
$ node --check tests/e2e/smoke.mjs
node --check: OK
```

### `npm run lint` (whole repo)

```
> lint
> eslint .

LINT EXIT: 0
```

### Scope / diff checks

```
$ git diff --exit-code -- compose.yaml compose.smoke.yaml ':(glob)**/Dockerfile' package.json package-lock.json src/backend/package.json src/frontend/package.json src/backend/src src/frontend/src
out-of-scope diff exit: 0

$ git status --porcelain -- tests/e2e docs/features/remote-spaceship-customization/build-log-T16.md
 M tests/e2e/smoke.mjs
?? docs/features/remote-spaceship-customization/build-log-T16.md

$ git diff --check
diff-check exit: 0
```

- Only `tests/e2e/smoke.mjs` and this build log are task changes. The pre-existing unrelated
  modifications (`docs/features/README.md`, `docs/features/coin-economy/reviews/code-r2.md`,
  `docs/features/coin-economy/status.md`) and the untracked feature artifacts
  (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/`) are **not** staged by T16.
- No container path changed: `compose.yaml`, `compose.smoke.yaml`, both `src/*/Dockerfile` files are
  byte-identical to `HEAD`; no service, image, deployable, port, host mapping, environment variable
  or health signal was added. The backend `GET /ws` endpoint and `podman compose up` are untouched.
- No dependency, workspace/package change, app source, protocol, other test, schema or migration.

## Acceptance audit

- **AC-35 — met.**
  - No new service/image/deployable/port/host mapping/environment variable/health signal;
    `compose.yaml`, `compose.smoke.yaml`, both Dockerfiles and the `GET /ws` endpoint are unchanged
    (diff gate exit 0; `git status` above).
  - `tests/e2e/smoke.mjs` gained exactly **one** check (`APPEARANCE_CHECK_LABEL`): guest B sends a
    valid 11-slot `setAppearance`; guest A receives exactly one `memberAppearance` for B with the
    same record (key-by-key equality, and exactly one `memberAppearance` in A's total history after
    the settle); A's roster entry for B (`memberJoined.member.appearance`) was `{}` before the
    frame; a malformed frame with an unknown slot key (`spoiler`) yields
    `{ type: 'error', code: 'bad_message' }` on B and no additional broadcast (A still has exactly
    one `memberAppearance`).
  - Evidence: the `npm run smoke` transcript above — 29/29 PASS, new check PASS, `SMOKE EXIT: 0`.

## Deviations from spec

- **None.** Podman was available, so the smoke result is a real PASS (not `not applicable`). No
  spec, plan, task, status, review, compose, Docker, app or package file was edited.
