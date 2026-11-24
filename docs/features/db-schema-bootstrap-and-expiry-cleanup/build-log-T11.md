# Build log — T11 — Verify & integrate

Task: T11 (2026-11-24)
Files changed: `docs/features/db-schema-bootstrap-and-expiry-cleanup/build-log-T11.md` (this log only — T11 owns no source files)
What changed & why: no repository behavior change. Ran the complete T11 gate from `tasks.md` on HEAD `f0f23eb` (after T1–T10) and recorded the raw evidence: lint, typecheck, all tests, coverage, build, the frontend-prod image build, the full stack smoke, the unchanged-file diff list, the log-field grep audit and the manual `.env*` boundary confirmation.

Decisions:
- The gate was run exactly as pinned in `tasks.md` § T11. The two container commands used the T9-documented host-only crun workaround (see Environment); the repository, compose file and Dockerfiles are untouched.
- `npm test`/`npm run coverage` were run without any runtime override, so the real-Postgres suites selected `podman` themselves via the existing `detectContainerRuntime()` helper (`podman info` exits 0) and ran; nothing self-skipped. The three feature Postgres suites and the two pre-existing migration Postgres suites are visible as passed suites below.
- No source/config/doc/compose/render/workflow/`tasks.md`/`status.md`/`docs/features/README.md`/`.env*` file was edited by T11. `package.json`/`package-lock.json`, `app.ts`, `metrics.ts`, the Dockerfiles, `deploy.yml` and `docs/features/README.md` are byte-identical to HEAD (`git diff --exit-code` exits 0).
- Per the T11 notes: the grep is a secondary audit; the captured-log assertions in the unit tests are the primary AC-23 evidence, and the zero-match grep result below was reviewed, not blanket-ignored. The `.env*` boundary is procedural (gitignored), so no git check is claimed to prove it.

Environment (host-only, not a repository change):
- This host still has the crun 1.31 regression (containers/crun#2466): `crun exec` fails `write to /proc/self/oom_score_adj: Permission denied`, which breaks Podman healthchecks (the db container never becomes healthy). Host: `podman version 6.2.0`, default runtime `crun 1.31` (`/usr/bin/crun`).
- T9 documented the workaround; the same one was reused: `crun 1.30.1` at `/var/home/raultorraco/.local/bin/crun-1.30.1` with `/tmp/opencode/containers.conf` (`[engine] runtime = "/var/home/raultorraco/.local/bin/crun-1.30.1"`), a temporary `podman system service` on `unix:///run/user/1000/podman/t11.sock`, and `DOCKER_HOST=unix:///run/user/1000/podman/t11.sock` for the two compose commands. Verified through that socket:

```text
$ podman --remote --url unix:///run/user/1000/podman/t11.sock info --format '{{.Host.OCIRuntime.Name}} | {{.Host.OCIRuntime.Version}} | {{.Host.OCIRuntime.Path}}'
/var/home/raultorraco/.local/bin/crun-1.30.1 | crun version 1.30.1
commit: 079ff6a7a16d029460af882f9ea44674e6a510b6
rundir: /run/user/1000/crun
spec: 1.0.0
+SYSTEMD +SELINUX +APPARMOR +CAP +SECCOMP +EBPF +CRIU +LIBKRUN +WASM:wasmedge +JSON_C | /var/home/raultorraco/.local/bin/crun-1.30.1
```

- After the smoke the compose project was removed (`podman compose ... down --remove-orphans`, exit 0) and the temporary service was stopped and its socket deleted; only the pre-existing default `podman.sock` service remains. The repository is unaffected by the workaround. A host without the crun 1.31 regression runs the same pinned commands without the override.

Evidence:

## 1. `npm run lint` — exit 0

```text
$ npm run lint

> lint
> eslint .

lint-exit=0
```

## 2. `npm run typecheck` — exit 0

```text
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

typecheck-exit=0
```

## 3. `npm test` — exit 0

Backend (`src/backend`, Vitest):

```text
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ...
 ✓ src/db/schema-contract-postgres.test.ts (4 tests) 3152ms
 ✓ src/db/verification-cleanup-postgres.test.ts (2 tests) 3152ms
 ✓ src/db/migration-006.test.ts (13 tests) 3161ms
 ✓ src/db/migration-007.test.ts (11 tests) 3135ms
 ✓ src/db/schema-bootstrap-postgres.test.ts (7 tests) 3343ms

 Test Files  52 passed (52)
      Tests  1926 passed (1926)
   Start at  10:12:01
   Duration  4.27s (transform 5.60s, setup 0ms, collect 15.63s, tests 27.12s, environment 9ms, prepare 4.33s)
```

Frontend (`src/frontend`, Vitest):

```text
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ...
 Test Files  83 passed (83)
      Tests  2844 passed (2844)
   Start at  10:12:05
   Duration  4.26s (transform 9.14s, setup 0ms, collect 28.79s, tests 16.62s, environment 13.02s, prepare 6.24s)
```

test-exit=0

**Real-Postgres suites: ran, did not self-skip.** `grep -niE 'skipped|skip'` over the complete test log returns no matches. `schema-contract-postgres.test.ts` (4), `verification-cleanup-postgres.test.ts` (2), `schema-bootstrap-postgres.test.ts` (7), `migration-006.test.ts` (13) and `migration-007.test.ts` (11) all report passed tests with multi-second durations (throwaway `postgres:16-alpine` containers), not `describe.skip`. The helper's `detectContainerRuntime()` ran `podman info` successfully (exit 0). The expected stderr noise from jsdom/three WebGL-context tests is unrelated and does not affect the exit code.

## 4. `npm run coverage` — exit 0

Backend workspace (V8, per-workspace thresholds 80):

```text
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.81 |    91.16 |   99.63 |   96.81 |
 src               |   96.72 |    91.45 |     100 |   96.72 |
  app.ts           |   95.74 |     88.5 |     100 |   95.74 | ...18-319,367-369
  cors.ts          |     100 |      100 |     100 |     100 |
 src/auth          |   96.17 |    83.58 |     100 |   96.17 |
  auth-routes.ts   |    81.4 |     55.3 |     100 |    81.4 | ...61-363,369-370
  auth-service.ts  |     100 |    81.87 |     100 |     100 | ...97,402,419,507
  config.ts        |     100 |      100 |     100 |     100 |
  ...repository.ts |   95.74 |     86.2 |     100 |   95.74 | ...77-778,834-847
  email-cli.ts     |    98.3 |    80.55 |     100 |    98.3 | 176-177
  ...l-template.ts |     100 |      100 |     100 |     100 |
  email.ts         |     100 |      100 |     100 |     100 |
  password.ts      |     100 |      100 |     100 |     100 |
  rate-limit.ts    |     100 |      100 |     100 |     100 |
  ...repository.ts |   96.53 |    84.37 |     100 |   96.53 | ...40-141,146-147
  ...repository.ts |    98.8 |    89.65 |     100 |    98.8 | 61-62,315
  ...repository.ts |   97.29 |    91.66 |     100 |   97.29 | 63-68
 src/db            |   99.07 |    96.44 |     100 |   99.07 |
  ...cle-config.ts |     100 |      100 |     100 |     100 |
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 | 82-83
  ...ate-runner.ts |   96.61 |    95.45 |     100 |   96.61 | 107-108
  migrate.ts       |     100 |      100 |     100 |     100 |
  pool.ts          |     100 |      100 |     100 |     100 |
  ...-bootstrap.ts |     100 |    97.56 |     100 |     100 | 181
  ...a-contract.ts |     100 |      100 |     100 |     100 |
  startup.ts       |    98.5 |    96.29 |     100 |    98.5 | 162-163
  ...on-cleanup.ts |     100 |      100 |     100 |     100 |
 src/deploy        |   98.09 |    98.75 |     100 |   98.09 |
  ...er-env-cli.ts |      95 |    96.15 |     100 |      95 | 160-164
  render-env.ts    |     100 |      100 |     100 |     100 |
 src/game          |   96.25 |    94.92 |   99.13 |   96.25 |
 src/observability |   99.67 |    96.64 |     100 |   99.67 |
  config.ts        |     100 |      100 |     100 |     100 |
  db-metrics.ts    |     100 |      100 |     100 |     100 |
  logging.ts       |     100 |      100 |     100 |     100 |
  metrics-route.ts |     100 |      100 |     100 |     100 |
  metrics.ts       |   99.45 |    93.54 |     100 |   99.45 | 251-252
  shutdown.ts      |     100 |    94.73 |     100 |     100 | 74
-------------------|---------|----------|---------|---------|-------------------
```

Backend totals: statements 96.81, branches 91.16, functions 99.63, lines 96.81 — all ≥ 80. Every new non-composition module is ≥ 80 on every metric: `logging.ts` 100/100/100/100, `schema-contract.ts` 100/100/100/100, `schema-bootstrap.ts` 100/97.56/100/100, `lifecycle-config.ts` 100/100/100/100, `startup.ts` 98.5/96.29/100/98.5, `verification-cleanup.ts` 100/100/100/100, `shutdown.ts` 100/94.73/100/100. `src/server.ts` remains the pre-existing composition-root exclusion (no new exclusion was added).

Frontend workspace (V8, per-workspace thresholds 80):

```text
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   97.15 |    96.75 |   98.36 |   97.15 |
...
-------------------|---------|----------|---------|---------|-------------------
```

Frontend totals: statements 97.15, branches 96.75, functions 98.36, lines 97.15 — all ≥ 80.

coverage-exit=0

## 5. `npm run build` — exit 0

```text
$ npm run build

> build
> npm run build --workspaces --if-present

> build
> tsc

> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
transforming...
✓ 117 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.49 kB │ gzip:   0.30 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-laKoxB0N.css                        45.63 kB │ gzip:   8.21 kB
dist/assets/cursor-ship-CYbML0fs.js                    8.41 kB │ gzip:   2.74 kB
dist/assets/SpaceshipCustomizationPanel-DZfa07sQ.js   17.90 kB │ gzip:   6.38 kB
dist/assets/browser-env-wuGf4aCr.js                   57.26 kB │ gzip:  20.84 kB
dist/assets/index-CouI9G8n.js                        108.81 kB │ gzip:  33.03 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-Ddozhxko.js                        610.56 kB │ gzip: 154.65 kB
✓ built in 1.50s
entry index assets/index-CouI9G8n.js raw=108805 gzip=33034
initial files=2 raw=330504 gzip=101990 budget=150000
three assets/three-Ddozhxko.js raw=610563 gzip=154647 budget=165000
total files=6 raw=1024637 gzip=286599 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-DZfa07sQ.js raw=17903 gzip=6382 initial=false
chunk browser-env assets/browser-env-wuGf4aCr.js raw=57261 gzip=20844 initial=false
chunk cursor-ship assets/cursor-ship-CYbML0fs.js raw=8406 gzip=2736 initial=false
chunk index assets/index-CouI9G8n.js raw=108805 gzip=33034 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-Ddozhxko.js raw=610563 gzip=154647 initial=false

Bundle budget OK.
build-exit=0
```

## 6. `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` — exit 0

```text
$ DOCKER_HOST=unix:///run/user/1000/podman/t11.sock podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Image cubeclicker-frontend:prod-smoke Building
[2/3] STEP 1/10: FROM docker.io/library/node:24-alpine AS build
...
[3/3] STEP 6/6: LABEL "com.docker.compose.image.builder"="classic"
--> Using cache ddeea053efe27c4491ca2189f3a7451c7a870c0aa0d03da1ae7fbad20f814377
[3/3] COMMIT docker.io/library/cubeclicker-frontend:prod-smoke
--> ddeea053efe2
Successfully tagged docker.io/library/cubeclicker-frontend:prod-smoke
ddeea053efe27c4491ca2189f3a7451c7a870c0aa0d03da1ae7fbad20f814377
Successfully built ddeea053efe2
Successfully tagged cubeclicker-frontend:prod-smoke
 Image cubeclicker-frontend:prod-smoke Built
frontend-prod-build-exit=0
```

## 7. `npm run smoke` — exit 0 (`SMOKE PASS (29/29 checks)`)

Run with the T9-documented host workaround (environment prefix only; same npm script):

```text
$ DOCKER_HOST=unix:///run/user/1000/podman/t11.sock npm run smoke

> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Network cubeclicker_default Creating
 Network cubeclicker_default Created
 Container cubeclicker-mailpit-1 Creating
 Container cubeclicker-frontend-1 Creating
 Container cubeclicker-frontend-prod-1 Creating
 Container cubeclicker-db-1 Creating
 Container cubeclicker-mailpit-1 Created
 Container cubeclicker-frontend-prod-1 Created
 Container cubeclicker-frontend-1 Created
 Container cubeclicker-db-1 Created
 Container cubeclicker-backend-1 Creating
 Container cubeclicker-backend-1 Created
 Container cubeclicker-mailpit-1 Starting
 Container cubeclicker-frontend-prod-1 Starting
 Container cubeclicker-db-1 Starting
 Container cubeclicker-frontend-1 Starting
 Container cubeclicker-mailpit-1 Started
 Container cubeclicker-frontend-prod-1 Started
 Container cubeclicker-db-1 Started
 Container cubeclicker-db-1 Waiting
 Container cubeclicker-frontend-1 Started
 Container cubeclicker-db-1 Healthy
 Container cubeclicker-backend-1 Starting
 Container cubeclicker-backend-1 Started
 Container cubeclicker-smoke-run-555b85ec066d Creating
 Container cubeclicker-smoke-run-555b85ec066d Created
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
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1002ms
PASS activity leave: A receives the memberLeft activity event with B's name and an id newer than the snapshot id — memberLeft id 2 for p2
PASS multiplayer explicit leave: D's leave yields memberLeft(left) on A in under 900ms without the grace window — memberLeft(left) received after 1ms
PASS multiplayer slot reuse: E fills D's freed slot 2 with welcome.roster exactly [A, E] — server 1; roster [A, E] in D's freed slot 2
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=9 cubeclicker_ws_messages_received_total{type="join"}=7 cubeclicker_ws_frames_sent_total{type="hello"}=9
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-CrRKL0ON.js is served gzip with immutable caching — content-encoding gzip; 108871 B decompressed
PASS prod /assets/three-Ddozhxko.js is served gzip with immutable caching — content-encoding gzip; 610563 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (29/29 checks)
smoke-exit=0
```

(ANSI escape sequences from the compose-provider banner are omitted; the transcript is otherwise verbatim.)

## 8. Live stack proof of the feature after the smoke — feature-appropriate extra evidence

The smoke stack was left running long enough to inspect it through the same temporary socket:

```text
$ podman inspect cubeclicker-backend-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -E 'DB_SCHEMA_BOOTSTRAP_ENABLED|DB_EXPIRED_TOKEN_CLEANUP'
DB_EXPIRED_TOKEN_CLEANUP_ENABLED=true
DB_SCHEMA_BOOTSTRAP_ENABLED=true
DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS=3600000

$ podman logs cubeclicker-backend-1 2>&1 | grep -E 'db_schema_bootstrap|db_verification_cleanup|db_startup'
{"level":20,"time":1795511631334,"pid":33,"hostname":"d58238600dee","waitedMs":0,"msg":"db_startup_lock_acquired"}
{"level":30,"time":1795511631338,"pid":33,"hostname":"d58238600dee","tables":5,"msg":"db_schema_bootstrap_started"}
{"level":30,"time":1795511631356,"pid":33,"hostname":"d58238600dee","checked":5,"created":0,"outdated":0,"durationMs":18,"msg":"db_schema_bootstrap_completed"}
{"level":30,"time":1795511631356,"pid":33,"hostname":"d58238600dee","migrated":0,"created":0,"outdated":0,"durationMs":47,"msg":"db_startup_completed"}
{"level":30,"time":1795511631372,"pid":33,"hostname":"d58238600dee","intervalMs":3600000,"msg":"db_verification_cleanup_started"}
{"level":20,"time":1795511631386,"pid":33,"hostname":"d58238600dee","deleted":0,"durationMs":12,"msg":"db_verification_cleanup_run"}

$ podman exec cubeclicker-backend-1 node -e 'fetch("http://127.0.0.1:8080/healthz").then(async (r) => { console.log("status=" + r.status); console.log(await r.text()); })'
status=200
{"status":"ok"}

$ podman exec cubeclicker-backend-1 node -e 'fetch("http://127.0.0.1:8080/metrics").then(async (r) => { const t = await r.text(); const lines = t.split("\n").filter((l) => l.startsWith("cubeclicker_")); const names = new Set(lines.map((l) => l.split(/[ {]/)[0])); console.log("status=" + r.status); console.log("series-lines=" + lines.length); console.log("distinct-metric-names=" + names.size); console.log("db_bootstrap_or_cleanup=" + (t.includes("cubeclicker_db_bootstrap") || t.includes("cubeclicker_db_cleanup"))); console.log([...names].sort().join("\n")); })'
status=200
series-lines=92
distinct-metric-names=35
db_bootstrap_or_cleanup=false
cubeclicker_db_pool_idle
cubeclicker_db_pool_total
cubeclicker_db_pool_waiting
cubeclicker_db_queries_total
cubeclicker_db_query_duration_seconds_bucket
cubeclicker_db_query_duration_seconds_count
cubeclicker_db_query_duration_seconds_sum
cubeclicker_economy_flushes_total
cubeclicker_economy_pending_accounts
cubeclicker_economy_revision_rejections_total
cubeclicker_members_active
cubeclicker_removal_batch_pending_groups
cubeclicker_removal_batch_size_bucket
cubeclicker_removal_batch_size_count
cubeclicker_removal_batch_size_sum
cubeclicker_removal_flushes_total
cubeclicker_removal_ids_total
cubeclicker_server_capacity
cubeclicker_servers_active
cubeclicker_upgrade_revision_rejections_total
cubeclicker_ws_broadcast_fanout_bucket
cubeclicker_ws_broadcast_fanout_count
cubeclicker_ws_broadcast_fanout_sum
cubeclicker_ws_broadcasts_total
cubeclicker_ws_connection_duration_seconds_bucket
cubeclicker_ws_connection_duration_seconds_count
cubeclicker_ws_connection_duration_seconds_sum
cubeclicker_ws_connections_capacity
cubeclicker_ws_connections_closed_total
cubeclicker_ws_connections_open
cubeclicker_ws_connections_total
cubeclicker_ws_frames_sent_total
cubeclicker_ws_heartbeat_timeouts_total
cubeclicker_ws_messages_encoded_total
cubeclicker_ws_messages_received_total
```

The live scrape contains no `cubeclicker_db_bootstrap*`/`cubeclicker_db_cleanup*` series. The 30-entry catalog itself is pinned by the unchanged `metrics.test.ts` (`pins exactly the 30 catalog metric names`, 37 tests passed in § 3); the 35 distinct exposition names above are the 27 metric families that had series plus the three exposition names of each of the four histograms — not a catalog growth.

Cleanup after the run:

```text
$ DOCKER_HOST=unix:///run/user/1000/podman/t11.sock podman compose -f compose.yaml -f compose.smoke.yaml down --remove-orphans
 Container cubeclicker-frontend-prod-1 Removed
 Container cubeclicker-frontend-1 Removed
 Container cubeclicker-backend-1 Removed
 Container cubeclicker-db-1 Removed
 Container cubeclicker-mailpit-1 Removed
 Network cubeclicker_default Removed
compose-down-exit=0

$ kill <temporary podman service pid>   # service and /run/user/1000/podman/t11.sock removed afterwards
$ pgrep -af 'podman system service'
8318 flatpak-spawn --host podman system service --time=0
8327 podman system service --time=0
$ ls -la /run/user/1000/podman/
srw-------. 1 raultorraco raultorraco 0 Nov 24 07:43 podman.sock
```

Only the pre-existing default `podman.sock` service remains (it was running before T11); no smoke container or temporary socket is left behind.

## 9. Unchanged-file gate — `git diff --exit-code` exits 0

```text
$ git diff --exit-code -- package.json package-lock.json src/backend/src/app.ts src/backend/src/app.test.ts src/backend/src/observability/metrics.ts src/backend/src/observability/metrics.test.ts .github/workflows/deploy.yml src/backend/Dockerfile src/frontend/Dockerfile docs/features/README.md
unchanged-files-exit=0
```

The command prints nothing (no diff), so `app.ts`, `app.test.ts`, `metrics.ts`, `metrics.test.ts`, `package.json`, `package-lock.json`, `deploy.yml`, both Dockerfiles and `docs/features/README.md` are unchanged; no new dependency, route, metric or deploy step exists. This is the AC-24 unchanged-surface evidence.

## 10. Log-field grep audit — no matches

```text
$ grep -RInE '(email|password|token|cookie|authorization|message|stack):' src/backend/src/db/schema-bootstrap.ts src/backend/src/db/startup.ts src/backend/src/db/verification-cleanup.ts src/backend/src/server.ts || true
log-field-grep-exit=1
```

The grep found zero matching lines (a direct exit 1; the pinned `|| true` makes the verify command exit 0). This was reviewed: the four files contain no `email:`/`password:`/`token:`/`cookie:`/`authorization:`/`message:`/`stack:` field keys in their log objects; the captured-log assertions in `logging.test.ts`, `schema-bootstrap.test.ts`, `startup.test.ts`, `verification-cleanup.test.ts` and `server.test.ts` remain the primary AC-23 evidence.

## 11. `.env*` manual boundary confirmation

`.env*` is gitignored, so no git command can prove it was untouched. Confirmed procedurally:

```text
$ git check-ignore -v .env
.gitignore:10:.env*	.env
$ stat -c '%n | mtime=%y | size=%s bytes' .env
.env | mtime=2026-10-24 19:18:10.857574326 +0200 | size=70 bytes
$ git status --porcelain --ignored -- '.env*'
!! .env
```

Only `.env` exists (no other `.env*` file). Its mtime (2026-10-24 19:18) predates this feature's work (2026-11-24) and every task; no task owns or edited `.env*`, and T11 did not open it. The `!!` line is the ignored-file marker, not a content inspection.

## 12. Final repository state

```text
$ git rev-parse HEAD
f0f23eb85a2e4842ec0ae1244ec5fea9657f02c4

$ git status --porcelain
?? docs/features/db-schema-bootstrap-and-expiry-cleanup/plan.md
?? docs/features/db-schema-bootstrap-and-expiry-cleanup/reviews/
?? docs/features/db-schema-bootstrap-and-expiry-cleanup/spec.md
?? docs/features/db-schema-bootstrap-and-expiry-cleanup/status.md
?? docs/features/db-schema-bootstrap-and-expiry-cleanup/tasks.md
```

(Recorded before this build log was written and committed.) All tracked files are unchanged; the untracked feature artifacts pre-date T11 and are orchestrator-owned — T11 did not edit or stage them. Build outputs (`src/*/dist`) are gitignored.

Acceptance audit:
- AC-24 → met. `git diff --exit-code` on `app.ts`, `app.test.ts`, `metrics.ts`, `metrics.test.ts` and `docs/features/README.md` exits 0 (no route/metric/public-surface change); the unchanged `metrics.test.ts` pins exactly the 30 catalog names and the unchanged `app.test.ts` passes in § 3; the live smoke backend returns `200 {"status":"ok"}` from `/healthz` and its `/metrics` scrape has `db_bootstrap_or_cleanup=false` (no `cubeclicker_db_bootstrap*`/`cubeclicker_db_cleanup*` series).
- AC-27 → met. `npm run lint` (exit 0), `npm run typecheck` (exit 0), `npm test` (52/52 backend files, 1926 tests; 83/83 frontend files, 2844 tests; exit 0), `npm run coverage` (exit 0; backend 96.81/91.16/99.63/96.81 and frontend 97.15/96.75/98.36/97.15, all ≥ 80; every new non-composition module ≥ 80 on every metric), `npm run build` (exit 0), `podman compose ... build frontend-prod` (exit 0) and `npm run smoke` (`SMOKE PASS (29/29 checks)`, exit 0) all pass. `src/server.ts` remains under the pre-existing composition-root coverage exclusion; no new exclusion was added. `package.json`/`package-lock.json` are unchanged (no new dependency). The `.env*` manual boundary is recorded above; no task edited it. The real-Postgres suites ran and passed rather than self-skipping.

Deviations from spec: none in the repository. Host-only environment workaround: the crun 1.31 regression required crun 1.30.1 and a temporary Podman service socket for the two compose commands, exactly as documented in `build-log-T9.md`; no compose service, image, port, volume, healthcheck, Dockerfile, workflow or deploy step changed. T11 owns no source files and made no source edit.
