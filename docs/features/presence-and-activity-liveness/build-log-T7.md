# Build log — T7 — Containerized smoke

Task: T7 — Containerized smoke `[P]` (2026-11-16)
Files changed: `tests/e2e/smoke.mjs`, `docs/features/presence-and-activity-liveness/build-log-T7.md`

What changed & why: `checkMultiplayerFlow` keeps B's abrupt-close grace check byte-for-byte (`LEAVE_CHECK_LABEL`,
`GRACE_LOWER_BOUND_MS = 900`, socket closed without `leave`) and adds the AC-22 explicit-leave path after that
grace expiry: D joins the run's server in B's freed slot 2, sends `{ type: 'leave' }`, and A must receive
`memberLeft(left)` in < 900 ms; E then joins D's freed slot with `welcome.roster` exactly `[A, E]`. The header
gains item 7c and two new PASS labels; the existing activity-leave check for B is untouched and no fixed wait is
added. Test-only change: no production code, no coverage delta (T9 runs the root coverage gate).

## Decisions

- **Two new labels instead of one.** `EXPLICIT_LEAVE_CHECK_LABEL` isolates D's immediate `memberLeft` and
  `SLOT_REUSE_CHECK_LABEL` isolates E's freed-slot welcome, so a regression points at one behavior. Both are
  gated on the B grace check passing (only then is slot 2 provably free) and the slot check is additionally
  gated on D's leave check passing.
- **Slot proof is exact.** D's welcome must be on `welcomeA.serverId` with `maxUsers 2`, roster `[A, D]` in slot
  order and `position` equal to B's original slot-2 position; E must be on the same server with roster
  `[A, E]` and `position` equal to D's slot-2 position. `rosterProblems()` pins `playerId` and `name` per index,
  so a missing, extra or reordered member fails.
- **Timing.** D's budget is measured from the `leave` send to A's `memberLeft` receipt and asserted
  `< GRACE_LOWER_BOUND_MS` (the same 900 ms constant; no new literal). Waits reuse `MULTIPLAYER_TIMEOUT_MS` /
  `MEMBER_LEFT_TIMEOUT_MS`; there is no new fixed delay and no 5 s sleep.
- **D's activity event is not asserted** (AC-22): the 1 s activity gate decides whether it is accepted.

## New checks (exact)

In `checkMultiplayerFlow`, after the B abrupt-close + activity-leave checks:

1. D: `connectAndJoin('client D')` → `welcome` within `MULTIPLAYER_TIMEOUT_MS`; assert `serverId ===
   welcomeA.serverId`, `maxUsers === 2`, roster length 2 with `[welcomeA.playerId/name, welcomeD.playerId/name]`,
   and `welcomeD.position.x/y === welcomeB.position.x/y` (B's freed slot 2).
2. D's leave: measure `leaveSentAt = Date.now()`, send `{ type: 'leave' }`, wait on A for
   `memberLeft && playerId === welcomeD.playerId`; assert `reason === 'left'` and
   `elapsed < GRACE_LOWER_BOUND_MS` (900 ms). PASS line: `multiplayer explicit leave: D's leave yields
   memberLeft(left) on A in under 900ms without the grace window`.
3. E: `connectAndJoin('client E')` → `welcome`; assert same server, `maxUsers 2`, roster exactly
   `[A, E]` in slot order, and `welcomeE.position.x/y === welcomeD.position.x/y` (D's freed slot 2). PASS line:
   `multiplayer slot reuse: E fills D's freed slot 2 with welcome.roster exactly [A, E]`.

## Evidence

### `node --check tests/e2e/smoke.mjs` — exit 0

```text
exit=0
```

### `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` — exit 0

First (uncached) build excerpt:

```text
entry index assets/index-D1fiPtRN.js raw=99269 gzip=30532
initial files=2 raw=320968 gzip=99491 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154326 budget=165000
total files=6 raw=995915 gzip=277568 budget=300000
...
Bundle budget OK.
...
[3/3] STEP 6/6: LABEL "com.docker.compose.image.builder"="classic"
--> 1c708e05e08f
Successfully tagged docker.io/library/cubeclicker-frontend:prod-smoke
1c708e05e08ffa95f9b72f440a18fea128777cd54aa057a3c7a56368301021ed
Successfully built 1c708e05e08f
Successfully tagged cubeclicker-frontend:prod-smoke
 Image cubeclicker-frontend:prod-smoke Built
```

Cached re-run of the exact verify command:

```text
--> 1c708e05e08f
Successfully tagged docker.io/library/cubeclicker-frontend:prod-smoke
1c708e05e08ffa95f9b72f440a18fea128777cd54aa057a3c7a56368301021ed
Successfully built 1c708e05e08f
Successfully tagged cubeclicker-frontend:prod-smoke
 Image cubeclicker-frontend:prod-smoke Built
 Image cubeclicker-frontend:prod-smoke Built
exit=0
```

### `npm run smoke` — exit 0

The stack was pre-started with `podman compose -f compose.yaml -f compose.smoke.yaml up -d --build`
(the one-shot `run` never starts Mailpit). Raw transcript of the verify run:

```text
> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

 Container cubeclicker-mailpit-1 Running
 Container cubeclicker-backend-1 Running
 Container cubeclicker-frontend-1 Running
 Container cubeclicker-db-1 Running
 Container cubeclicker-frontend-prod-1 Running
 Container cubeclicker-db-1 Waiting
 Container cubeclicker-db-1 Healthy
 Container cubeclicker-smoke-run-301f2095e56a Creating
 Container cubeclicker-smoke-run-301f2095e56a Created
smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 9
PASS activity snapshot: A's welcome feed is empty and B's welcome carries exactly A's memberJoined event — server 9; memberJoined id 1 for p15
PASS leaderboard join: A's welcome is a one-entry zero snapshot and B's welcome carries A and B with zero counters and totals — server 9
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 10
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)
PASS multiplayer batching: front:0:1 and front:0:2 never arrive as single miniCubeRemoved frames on A or B
PASS leaderboard update: the accepted explodes yield a coalesced leaderboardUpdate with A clicks >= 3, B clicks = 0 and totals clicks >= 3 — A clicks 3, B clicks 0, totals clicks 3
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1002ms
PASS activity leave: A receives the memberLeft activity event with B's name and an id newer than the snapshot id — memberLeft id 2 for p16
PASS multiplayer explicit leave: D's leave yields memberLeft(left) on A in under 900ms without the grace window — memberLeft(left) received after 1ms
PASS multiplayer slot reuse: E fills D's freed slot 2 with welcome.roster exactly [A, E] — server 9; roster [A, E] in D's freed slot 2
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=27 cubeclicker_ws_messages_received_total{type="join"}=21 cubeclicker_ws_frames_sent_total{type="hello"}=27
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-D1fiPtRN.js is served gzip with immutable caching — content-encoding gzip; 99269 B decompressed
PASS prod /assets/three-4rmoIDEa.js is served gzip with immutable caching — content-encoding gzip; 609337 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (28/28 checks)
```

(`exit=0`, `grep -c '^PASS'` = 28.) Repeats on the warm backend also passed 28/28 — the run remains
run-relative (server ids 1→2 became 5→6, then 9→10) and the 1.5 s end-of-run drain keeps the next run clean.

### `git diff --check` — exit 0

```text
exit=0
```

## Acceptance audit

- **AC-22 — Existing abrupt check retained → met.** `LEAVE_CHECK_LABEL` and `GRACE_LOWER_BOUND_MS` are
  unchanged (diff touches neither), B still closes its socket with no `leave`, and the transcript shows
  `memberLeft(left) received after 1002ms` (≥ 900 ms). The existing activity-leave check for B is unchanged
  (`memberLeft id 2 for p16`).
- **AC-22 — D explicit leave added → met.** D joins the run's server in B's freed slot 2 (welcome server,
  `maxUsers 2`, roster `[A, D]`, position equal to B's), sends `leave`, and A receives
  `memberLeft(left)` after **1 ms** (< 900 ms). PASS line recorded above.
- **AC-22 — E frees the slot → met.** E joins server 1 in D's freed slot 2; `welcome.roster` is exactly
  `[A, E]` in slot order (playerId + name pinned per index) and its position equals D's slot-2 position.
  PASS line recorded above.
- **AC-22 — Header/labels extended, no fixed wait → met.** Header item 7c and the two new labels describe both
  paths; no new `delay(...)`/sleep was added (only frame waits inside the existing timeouts), and the run
  settles through the existing `SMOKE_SETTLE_MS`.

## Deviations from spec

None. This is a test-only task: no production code, no coverage delta, and no container/package/compose change.
