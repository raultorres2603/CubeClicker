# Build log — T5 — Documentation and final verification

Task: T5 (2026-11-16)

Files changed:
- `docs/architecture/realtime.md` (edit: new `## Activity feed` section before `## Benchmark`)
- `docs/product/glossary.md` (edit: `### activity feed` between `### account` and `### appearance`)
- `docs/features/live-activity-feed/build-log-T5.md` (this file)

Committed only (staged unchanged per T5 `commits_also`; no edits):
- `docs/features/live-activity-feed/spec.md`
- `docs/features/live-activity-feed/plan.md`
- `docs/features/live-activity-feed/tasks.md`
- `docs/features/live-activity-feed/status.md`
- `docs/features/live-activity-feed/reviews/spec-review-r1.md`
- `docs/features/live-activity-feed/reviews/spec-review-r2.md`
- `docs/features/live-activity-feed/build-log-T1.md` … `build-log-T4.md` (already tracked; re-staged with no change)

What changed & why:
- `docs/architecture/realtime.md` gains `## Activity feed` (before `## Benchmark`) documenting the
  six gate-accepted event types and thresholds, the 1/s per-server cadence
  (`ACTIVITY_MIN_INTERVAL_MS`), the 20-event newest-first ring (`ACTIVITY_FEED_LIMIT`) with
  retention/cleanup, the `welcome`/rejoin/`worldEntered` snapshot and eviction behavior, the move
  completion-before-join precedence and travel-window pending feed, per-server isolation and the
  `serverId` guard, the two metrics `type` allow-list values, the single-live-region/`aria-live="off"`/
  reduced-motion accessibility contract, privacy, and additivity/rollback. It links the feature spec
  and the glossary entry.
- `docs/product/glossary.md` gains `### activity feed` in alphabetical position: per-server,
  server-derived, at most one event per second, 20 in memory, five shown, no free text and no
  persistence.
- No behavior source, `README.md`, `docs/features/README.md`, compose, Dockerfile, package file or
  `.env*` change. Everything else in this commit is the planner/orchestrator/reviewer artifact set
  that T5 stages without editing.

Decisions:
- The documentation lives in the existing outbound-path document (spec Q-13): a new architecture
  doc would fragment the broadcast contract, and `README.md` has no command/port/feature change to
  document.
- The doc names the shipped constants verbatim (`ACTIVITY_MIN_INTERVAL_MS`,
  `ACTIVITY_FEED_LIMIT`, `ACTIVITY_MILESTONE_EVERY`) and the shipped component contract
  (`<aside>` + `aria-live="off"`, five newest, 160 ms entry, both reduced-motion disables) rather
  than restating aspiration.
- `docs/features/README.md` is orchestrator-owned: not edited; the proposed single-row update is
  recorded at the end of this log.
- The T4-era `frontend-prod` image was rebuilt from current `HEAD`; the build was fully cached and
  produced the identical image digest `1c9286e80b7b`, which is the image the running container
  already serves, so the smoke prod checks exercised this build.

Evidence:

`npm run lint` (root) → exit 0
```
> lint
> eslint .

LINT_EXIT=0
```

`npm run typecheck` (root, both workspaces) → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

`npm test` (root, both workspaces) → exit 0
```
> test
> npm run test --workspaces --if-present

> test
> vitest run                (backend)

 Test Files  36 passed (36)
      Tests  1324 passed (1324)
   Start at  08:02:17
   Duration  3.45s (transform 3.86s, setup 0ms, collect 12.50s, tests 13.19s, environment 6ms, prepare 3.37s)

> test
> vitest run                (frontend)

 Test Files  73 passed (73)
      Tests  2069 passed (2069)
   Start at  08:02:20
   Duration  3.22s (transform 8.28s, setup 0ms, collect 21.69s, tests 10.85s, environment 8.03s, prepare 5.63s)

TEST_EXIT=0
```
(The frontend run includes `src/docs/links.test.ts` and the jsdom canvas `getContext`/THREE WebGL
stderr noise is unchanged and pre-existing.)

`npm run coverage` (root, per workspace) → exit 0, thresholds 80/80/80/80
```
> coverage
> npm run coverage --workspaces --if-present

--- backend ---
 Test Files  36 passed (36)
      Tests  1324 passed (1324)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.13 |    89.58 |   99.55 |   96.13 |                   
 src/game          |   95.33 |    93.94 |   98.94 |   95.33 |                   
  activity.ts      |     100 |      100 |     100 |     100 |                   
  hub.ts           |   90.76 |    88.45 |   98.36 |   90.76 | ...1585,1636-1639 
  protocol.ts      |   99.18 |    98.93 |   97.29 |   99.18 | 327-328,817-818   
 src/observability |   99.66 |     96.5 |     100 |   99.66 |                   
  metrics.ts       |   99.44 |    93.54 |     100 |   99.44 | 245-246           
-------------------|---------|----------|---------|---------|-------------------

--- frontend ---
 Test Files  73 passed (73)
      Tests  2069 passed (2069)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.61 |    96.31 |   97.78 |   96.61 |                   
 src/game          |   96.34 |    99.39 |      99 |   96.34 |                   
  session.ts       |   90.85 |    98.78 |   97.29 |   90.85 | ...1553,1673-1674 
 src/multiplayer   |   94.27 |    97.09 |   96.34 |   94.27 |                   
  protocol.ts      |   91.08 |    96.77 |    92.1 |   91.08 | ...1382,1386-1396 
  server-state.ts  |   98.38 |    95.79 |     100 |   98.38 | ...47,349-350,411 
 src/ui            |   96.88 |    94.38 |      95 |   96.88 |                   
  ActivityFeed.tsx |     100 |      100 |     100 |     100 |                   
-------------------|---------|----------|---------|---------|-------------------

COVERAGE_EXIT=0
```
Both workspaces clear the gate on all four metrics (backend 96.13 / 89.58 / 99.55 / 96.13;
frontend 96.61 / 96.31 / 97.78 / 96.61), with the new modules `activity.ts` and
`ActivityFeed.tsx` at 100 %.

`npm run build` (root, backend `tsc` + frontend `vite build` + bundle budget) → exit 0
```
> build
> npm run build --workspaces --if-present

> build
> tsc

> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
transforming...
✓ 108 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.49 kB │ gzip:   0.31 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-CirLJlxj.css                        27.26 kB │ gzip:   5.46 kB
dist/assets/cursor-ship-BGpPDzKE.js                    6.73 kB │ gzip:   2.21 kB
dist/assets/SpaceshipCustomizationPanel-D_iz0uC5.js    9.54 kB │ gzip:   3.34 kB
dist/assets/browser-env-D0GQg6df.js                   49.19 kB │ gzip:  18.16 kB
dist/assets/index-D9_xQ_JO.js                         94.17 kB │ gzip:  29.03 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-4rmoIDEa.js                        609.34 kB │ gzip: 154.32 kB
✓ built in 1.47s
entry index assets/index-D9_xQ_JO.js raw=94165 gzip=29033
initial files=2 raw=315864 gzip=97989 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=165000
total files=6 raw=990656 gzip=276021 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-D_iz0uC5.js raw=9537 gzip=3339 initial=false
chunk browser-env assets/browser-env-D0GQg6df.js raw=49189 gzip=18160 initial=false
chunk cursor-ship assets/cursor-ship-BGpPDzKE.js raw=6729 gzip=2210 initial=false
chunk index assets/index-D9_xQ_JO.js raw=94165 gzip=29033 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-4rmoIDEa.js raw=609337 gzip=154323 initial=false

Bundle budget OK.
BUILD_EXIT=0
```

`podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` → exit 0
```
[2/3] STEP 10/10: RUN npm run build -w @cubeclicker/frontend
--> Using cache ca6795ca08f71c9cf0e95652ee4a27dcf4db8c779eef7eb694f6289c457c885c
--> ca6795ca08f7
[3/3] STEP 6/6: LABEL "com.docker.compose.image.builder"="classic"
--> Using cache 1c9286e80b7b9a9e0d109f1eb2d6b781a355f54d710e4176a6f645d67218cb45
[3/3] COMMIT docker.io/library/cubeclicker-frontend:prod-smoke
--> 1c9286e80b7b
Successfully tagged docker.io/library/cubeclicker-frontend:prod-smoke
1c9286e80b7b9a9e0d109f1eb2d6b781a355f54d710e4176a6f645d67218cb45
Successfully built 1c9286e80b7b
Successfully tagged cubeclicker-frontend:prod-smoke
 Image cubeclicker-frontend:prod-smoke Built 
PROD_BUILD_EXIT=0
```
(The cache hit is expected: T5 changes documentation only. The produced digest matches the running
`cubeclicker-frontend-prod-1` container image, which the smoke checks below exercised:
`podman ps` → `cubeclicker-frontend-prod-1 Up ... (healthy) docker.io/library/cubeclicker-frontend:prod-smoke`.)

`npm run smoke` → exit 0
```
> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 5
PASS activity snapshot: A's welcome feed is empty and B's welcome carries exactly A's memberJoined event — server 5; memberJoined id 1 for p6
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 6
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)
PASS multiplayer batching: front:0:1 and front:0:2 never arrive as single miniCubeRemoved frames on A or B
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1003ms
PASS activity leave: A receives the memberLeft activity event with B's name and an id newer than the snapshot id — memberLeft id 2 for p7
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=14 cubeclicker_ws_messages_received_total{type="join"}=10 cubeclicker_ws_frames_sent_total{type="hello"}=14
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-BC6ZsTxs.js is served gzip with immutable caching — content-encoding gzip; 94231 B decompressed
PASS prod /assets/three-4rmoIDEa.js is served gzip with immutable caching — content-encoding gzip; 609337 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (24/24 checks)
SMOKE_EXIT=0
```
(The server/member ids are from the long-running smoke backend; both activity checks — the welcome
snapshot and the live leave event — are included in the 24/24.)

Documentation checks (T5 verify set) → all pass
```
$ test -f docs/architecture/realtime.md                                 → PASS (exit 0)
$ grep -qx '## Activity feed' docs/architecture/realtime.md             → PASS (exit 0)
$ grep -F 'ACTIVITY_MIN_INTERVAL_MS' docs/architecture/realtime.md      → PASS (exit 0)
$ grep -F 'ACTIVITY_FEED_LIMIT' docs/architecture/realtime.md           → PASS (exit 0)
$ grep -F 'activityEvent' docs/architecture/realtime.md                 → PASS (exit 0)
$ grep -F 'aria-live="off"' docs/architecture/realtime.md               → PASS (exit 0)
$ grep -F '### activity feed' docs/product/glossary.md                  → PASS (exit 0)
$ test -z "$(git status --porcelain -- docs/features/README.md)"        → PASS (exit 0)
$ git diff --exit-code -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json
PROTECTED_EXIT=0
```

Section order and glossary position:
```
$ grep -n '^## ' docs/architecture/realtime.md
14:## Fan-out
37:## Removal batching
74:## Economy coalescing
104:## Reconnect and authority
126:## Activity feed
256:## Benchmark

$ grep -n '^### ' docs/product/glossary.md | head -4
8:### account
13:### activity feed
18:### appearance
23:### click
```
The added relative links resolve: `../features/live-activity-feed/spec.md` →
`docs/features/live-activity-feed/spec.md` (exists) and `../product/glossary.md#activity-feed` →
`docs/product/glossary.md` (exists; the `### activity feed` heading supplies the anchor). The
repository's `src/docs/links.test.ts` stays green in `npm test`.

Document excerpt — `docs/architecture/realtime.md` lines 126–255 (the complete added section):
````markdown
## Activity feed

Added by feature `live-activity-feed` (2026-11-16); the full contract and acceptance criteria are
in the [feature spec](../features/live-activity-feed/spec.md), and the player-facing term is in the
[glossary](../product/glossary.md#activity-feed). The feed is a small, per-server, read-only stream
of notable server transitions on a second additive path: the hub derives each event from a
transition it has already validated, offers it to that server's gate, and only when the gate
accepts it broadcasts one `activityEvent` frame through the same encode-once fan-out described in
§ Fan-out. No client message creates, names or modifies an event, and the protocol version is
unchanged.

### Event catalog

Every event has the same envelope: a positive-integer `id` (per-server sequence, starting at 1,
assigned only on acceptance), a finite non-negative `at` (the hub's injected clock), a
positive-integer `serverId` (the server that owns the event, also the client's cross-server guard),
a closed `type`, the server-issued `playerId` and the server-issued `name` at event time. Six types
exist, with the type-specific fields below. The catalog defines **candidates**; every candidate is
then offered to the cadence gate, so a candidate is not guaranteed to reach the wire.

| `type` | Candidate at | Exact condition | Extra fields |
| --- | --- | --- | --- |
| `levelMilestone` | accepted full-board completion | the completed 1-based cube number is a multiple of `ACTIVITY_MILESTONE_EVERY` (5), starting at cube 5 | `level` |
| `fastClear` | accepted full-board completion | not a milestone, and the completion meets the existing speed-bonus predicate (`elapsedMs <= (thresholdSeconds(previousGridSize) + speedWindowSeconds(upgrades)) * 1000`) | `level`, `elapsedMs` |
| `cubeCleared` | accepted full-board completion | not a milestone and not a fast clear | `level` |
| `epicLoot` | successful account `openLootbox` | the drawn part's rarity is `epic`, new or duplicate; rare draws, failed/in-flight opens and guest local opens never qualify | `partId` |
| `memberJoined` | fresh `join` | recorded after the `welcome`/`memberJoined` transition; a rejoin and a move-in never qualify | — |
| `memberLeft` | final grace-expiry removal or move-out | recorded after the `memberLeft` broadcast; a socket close (grace start) and a server-destroying removal never qualify | — |

One completion produces exactly one candidate, with precedence `levelMilestone` > `fastClear` >
`cubeCleared`. The fast-clear predicate is the same boolean that doubles the completion's coins,
so the feed and the economy can never disagree about what a fast clear is. An invalid completion
and an incomplete board create no candidate.

**Moves.** A cross-server completion is attributed to the target server, where the member is after
the move resolves. After the existing `worldEntered`/`memberLeft (moved)`/`memberJoined` protocol
broadcasts, the completion is the **sole new-server activity candidate** (recorded before a move-in
join would be considered), and the move-in `memberJoined` activity is suppressed for the move
whether the completion is accepted or dropped; the protocol `memberJoined` broadcast is unchanged.
The old server's `memberLeft` is a separate candidate on its own server and does not share the
target server's window.

### Cadence

Each server accepts at most one event in any trailing `ACTIVITY_MIN_INTERVAL_MS` (1000 ms) window,
with an inclusive boundary (`now - lastAcceptedAt >= 1000`). A candidate inside the window is
**dropped, not queued**: it sends no frame, consumes no `id`, does not enter the ring and does not
move the window. A dropped candidate is forgotten — the feed keeps no pending candidate, no
per-client queue and no timer; the gate is a timestamp comparison on the low-frequency candidate
paths. Two servers have independent windows, so each can accept one event in the same second, and
a quiet server's first candidate is always accepted.

### Ring buffer

Each server keeps at most the newest `ACTIVITY_FEED_LIMIT` (20) accepted events, newest first
(`index 0` is the newest). State is created lazily on the first accepted event and holds
`nextId`/`lastAcceptedAt`/`events`; `nextId` starts at 1 for every server, so two servers' first
accepted events both have `id: 1`. Every read returns a fresh array of fresh event objects.
Retention is bounded by construction: the ring drops its oldest entry when a 21st event arrives.
Cleanup deletes a server's ring when that server is destroyed — its last member is removed or
moves away — and `hub.close()` clears every ring and closes the feed: after close `record` returns
nothing, `snapshot` returns `[]`, and `dropServer` and a second `clear()` are no-ops. The number of
rings never exceeds the number of live servers.

### Welcome, reconnect and `worldEntered`

`welcome` (fresh join and rejoin) and `worldEntered` (cross-server move) carry the target server's
current ring as `activity` (newest first, at most 20) as a defensive copy; a server with no
accepted events sends `[]`. A member that was disconnected while events occurred receives the
current ring in the rejoin `welcome`: the missed events are included while they fit, and if more
than 20 were accepted they are evicted by the ring by design. This is the same "presentation
delta, not state" contract as § Removal batching and § Economy coalescing: the hub keeps no
per-client outbound queue and never replays one missed frame.

**Travel window.** `worldEntered` supplies the target ring without changing the mover's current
feed. Target-server `activityEvent` frames received between `worldEntered` and the travel midpoint
are folded into the pending swap feed (newest first, capped at 20); the midpoint `applyWorldSwap`
replaces the feed with that updated target ring. No old-server event is applied to the new feed
once a swap is pending.

### Isolation and authority

Buffers and events are keyed by `serverId`, and an event is delivered only to that server's members
through the server's existing slot visitor; no client ever receives another server's event. The
event carries its `serverId`, and the client reducer ignores an event matching neither the current
server nor a pending target server. Every event originates from an already validated server
transition — a full-board completion, a successful loot draw or an accepted membership transition
— and its time is the hub's injected clock, never a client value.

### Metrics

The encode-once path already counts every broadcast. `activityEvent` is added to the closed `type`
allow-lists of `cubeclicker_ws_messages_encoded_total` and `cubeclicker_ws_frames_sent_total` —
two catalog values, no new metric. The allow-list entry is required, not optional instrumentation:
the counter throws on an unlisted `type` value.

### Client presentation and accessibility

The frontend stores the feed in `WorldState.activity` (and `pendingWorldSwap.activity` during a
travel) and renders a non-interactive `<aside class="activity-feed" aria-label="Server activity"
aria-live="off">` with an `<h2>` heading and an `<ol>` of the five newest events, each with a full
text sentence. The feed contributes no live-region semantics — no `role="status"`, `role="alert"`
or `role="log"` and no live `aria-live` — so `.phase-announcement` stays the shell's only
polite/assertive live region; the feed is readable on demand via its landmark. It has no focusable
control and no timestamp (the server clock is not the client clock). The ticker is placed
top-center below the connection banner with a mobile offset, capped at five visible items, and is
`pointer-events: none`. New entries use a 160 ms entry animation that is disabled both by the
session's reduced-motion preference (`data-reduced-motion="true"`) and independently by
`@media (prefers-reduced-motion: reduce)`; reduced motion changes animation only, and the content
stays fully readable.

### Privacy

Every field is server-issued: ids, the injected-clock timestamp, the catalog `level`/`elapsedMs`
numbers, the catalog `partId`, and the member's `name` as already published in the roster (guest
`Player N` or the account username). No event carries `accountId`, token, email, IP, free text or
any client-supplied string, and the client catalog still has no activity message, so no client
frame can create, name or modify an event.

### Additivity and rollback

The frame is a new `ServerMessage` variant, `activity` is optional in the wire type (absent decodes
to `[]`), and no protocol version bump is made, so both deploy orders are safe: an old client drops
an unknown `activityEvent` frame at its decoder and ignores the extra `activity` field, and a new
client against an old backend renders an empty feed. Backend rollback removes the union/builder,
the `activity` field, the feed module, the hub derivation hooks and the two metrics allow-list
values; frontend rollback removes the component, its render and the reducer case. There is nothing
to roll back operationally: the feed is process memory only, has no feature flag and no stored
data, and a restart clears it.
````

Document excerpt — `docs/product/glossary.md` (the complete added entry):
````markdown
### activity feed

**Definition:** A compact, per-**game server** ticker of notable events the backend has already validated — cube cleared, fast clear, level milestone, epic loot, member joined and member left. The hub derives each event on the server that owns it, accepts at most one event per server per second, keeps the newest 20 in memory (newest first) and includes the current ring in the `welcome` snapshot, so a joining or reconnecting member sees the recent activity. The frontend shows the five newest entries in a non-interactive, non-live ticker below the connection banner. The feed is server-derived and per server: it carries no free text (only server-issued names and catalog identifiers) and no history across restarts — a backend restart clears every feed.
**Example:** `Player 2 joined` appears in the ticker of game server 1, and a member reconnecting to that server sees it in the welcome snapshot until 20 newer events push it out of the ring.
````

Acceptance audit:
- AC-26 → met: `docs/architecture/realtime.md` has exactly one `## Activity feed` (line 126, before
  `## Benchmark` at line 256) covering the six event types/thresholds as gate-accepted candidates,
  `ACTIVITY_MIN_INTERVAL_MS` 1/s cadence with inclusive boundary, `ACTIVITY_FEED_LIMIT` 20 newest-
  first ring with retention/cleanup, `welcome`/rejoin/`worldEntered` snapshots with eviction, move
  completion-before-join precedence and the travel-window pending feed, per-server isolation and the
  `serverId` guard, the two metrics allow-list values, the single-live-region/`aria-live="off"`/
  reduced-motion contract, privacy, and additivity/rollback; `docs/product/glossary.md` has
  `### activity feed` in alphabetical position (line 13); every added relative link resolves and
  `src/docs/links.test.ts` passes; `docs/features/README.md` is untouched (`git status --porcelain`
  empty) with the proposed row below; `README.md`, `compose.yaml`, `compose.smoke.yaml`, both
  Dockerfiles and both package files are unchanged (protected diff exit 0).
- AC-28 → met: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`
  and `npm run smoke` all exit 0; coverage is ≥ 80 on statements, branches, functions and lines in
  both workspaces (backend 96.13/89.58/99.55/96.13, frontend 96.61/96.31/97.78/96.61);
  `compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile`, `src/frontend/Dockerfile`,
  `package.json` and `package-lock.json` are byte-identical (`git diff --exit-code` exit 0); no npm
  dependency, script, `.env*` or secret change is present.

Final working-tree state before staging (`git status --porcelain`, `git diff --stat`):
```
 M docs/architecture/realtime.md
 M docs/product/glossary.md
?? docs/features/live-activity-feed/build-log-T5.md
?? docs/features/live-activity-feed/plan.md
?? docs/features/live-activity-feed/reviews/
?? docs/features/live-activity-feed/spec.md
?? docs/features/live-activity-feed/status.md
?? docs/features/live-activity-feed/tasks.md

 docs/architecture/realtime.md | 130 ++++++++++++++++++++++++++++++++++++++++++
 docs/product/glossary.md      |   5 ++
 2 files changed, 135 insertions(+)
```

Staged state for this commit before this final append (`git status --porcelain`):
```
M  docs/architecture/realtime.md
A  docs/features/live-activity-feed/build-log-T5.md
A  docs/features/live-activity-feed/plan.md
A  docs/features/live-activity-feed/reviews/spec-review-r1.md
A  docs/features/live-activity-feed/reviews/spec-review-r2.md
A  docs/features/live-activity-feed/spec.md
A  docs/features/live-activity-feed/status.md
A  docs/features/live-activity-feed/tasks.md
M  docs/product/glossary.md
```
(`git diff --cached --stat` at that point: 9 files changed, 1371 insertions; `build-log-T1.md`–`build-log-T4.md`
were already tracked by their own commits, so re-staging them is a no-op. This append adds its own
lines to `build-log-T5.md`.)

Proposed `docs/features/README.md` row (orchestrator-owned; not edited by the builder):
```
| live-activity-feed | Live Activity Feed (per-server events, 1/s cadence, 20-event ring, top-center ticker) | planning | 2026-11-16 |
```

Deviations from spec: none. (The doc section names `ACTIVITY_MILESTONE_EVERY` as the milestone
constant because it is the shipped feed rule; the pinned checks cover the two required constants.)

Out-of-scope files untouched: `src/**` (no behavior source change), `tests/**`, `compose.yaml`,
`compose.smoke.yaml`, `src/backend/Dockerfile`, `src/frontend/Dockerfile`, `package.json`,
`package-lock.json`, `README.md`, `docs/features/README.md`, `docs/architecture/**` other than
`realtime.md`, `docs/product/**` other than `glossary.md`, `.env*`. The T1–T4 build logs, spec,
plan, tasks, status and reviews are staged unchanged, not edited.
