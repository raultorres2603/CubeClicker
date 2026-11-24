# Build log — T8 — Verify & integrate

Task: T8 (2026-11-24)
Files changed: `docs/features/registration-account-exists/build-log-T8.md` (evidence only — no source, test, config, workflow, compose, migration, spec, plan, tasks or status edit)
Branch: `feat/registration-account-exists` (7 feature commits ahead of `origin/main` at `faf8909`)

## What changed & why
- This is the verification task (AC-10): nothing in the application changes. The full T1–T7 delivery was re-gated across both workspaces and recorded here.
- The exact `tasks.md` § T8 `verify` block was executed as a single script under `set -euo pipefail` from the repository root, with only a final marker echo appended.
- The Mailpit-primed containerized smoke was executed after a cold compose project; its `podman` healthcheck path needed a supported-provider workaround on this host (recorded in § Smoke, with the default-provider failure and the same commands re-run green).
- Any address-shaped fixture value would be redacted to `<test-address>`; no address, token, verification link, credential or username is recorded here.

## Decisions
- **Evidence only.** Per the task scope, a failing check reopens its owning task; no file outside this log was touched.
- **Consolidated block + per-command runs.** Every command was first run on its own so its asserted lines and exit status are captured individually; the consolidated block then re-ran the whole gate verbatim as the final authority.
- **Smoke provider.** The pinned compose commands are unchanged. On this host the default `podman compose` provider (`docker-compose` v5.6.0 over the rootless Podman API) produces containers with `OomScoreAdj=200`, and `podman exec` — which the `db` HEALTHCHECK uses — fails, so the health gate never opens. The same pinned commands were re-run with the other supported provider (`podman-compose` 1.6.0, selected by the documented `PODMAN_COMPOSE_PROVIDER` environment variable), which creates containers through the CLI with `OomScoreAdj=0`; the full 29-check smoke passed. No compose file, Dockerfile or repository environment file was edited.

## Environment
- Node v24.22.3, npm 11.19.1.
- Podman 6.2.0, rootless, `overlay` storage, OCI runtime `crun 1.30.1`.
- Default `podman compose` provider: Docker Compose v5.6.0.
- Alternative supported provider used for the smoke: `podman-compose` 1.6.0 (Python, isolated virtual environment outside the repository).
- `origin/main` = `faf8909` (resolvable in the local repository).

## Gate evidence

### 1. `npm run lint` → exit 0
```
> lint
> eslint .
EXIT=0
```
No diagnostics.

### 2. `npm run typecheck` → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

EXIT=0
```
No diagnostics in either workspace.

### 3. `npm test` → exit 0
Backend 52 files / 2004 tests passed; frontend 83 files / 2867 tests passed. (Excerpt: the AC-10(f) suites and both workspace summaries; the remaining passing files are omitted for length.)

```
[backend]
 ✓ src/deploy/render-env.test.ts (46 tests)
 ✓ src/auth/email.test.ts (36 tests)
 ✓ src/auth/email-cli.test.ts (21 tests)
 ✓ src/deploy/render-env-cli.test.ts (28 tests)
 ✓ src/auth/auth-routes.test.ts (40 tests)
 ✓ src/auth/auth-service.test.ts (73 tests)
 ✓ src/app.test.ts (50 tests)
 Test Files  52 passed (52)
      Tests  2004 passed (2004)

[frontend]
 ✓ src/auth/api.test.ts (34 tests)
 ✓ src/ui/VerificationPending.test.tsx (6 tests)
 ✓ src/ui/AuthForms.test.tsx (60 tests)
 Test Files  83 passed (83)
      Tests  2867 passed (2867)

EXIT=0
```

### 4. `npm run coverage` → exit 0 (thresholds ≥ 80 on all four metrics, per workspace)
Thresholds are pinned at `statements: 80, branches: 80, functions: 80, lines: 80` in `src/backend/vitest.config.ts` and `src/frontend/vitest.config.ts`; both configs are unchanged versus `origin/main` (empty diff). (Excerpt: the per-workspace summaries and aggregate rows; the full per-file tables are omitted for length.)

```
[backend]
 Test Files  52 passed (52)
      Tests  2004 passed (2004)
 % Coverage report from v8
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files          |   96.96 |    91.88 |   99.64 |   96.96 |

[frontend]
 Test Files  83 passed (83)
      Tests  2867 passed (2867)
 % Coverage report from v8
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files          |   97.22 |     96.8 |    98.6 |   97.22 |

EXIT=0
```
Per-workspace aggregate: backend 96.96 / 91.88 / 99.64 / 96.96; frontend 97.22 / 96.8 / 98.6 / 97.22 — every metric above the 80 bar. No exclusion or threshold change in the feature diff.

### 5. `npm run build` → exit 0
```
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
dist/assets/cursor-ship-gTMZusq0.js                    8.41 kB │ gzip:   2.74 kB
dist/assets/SpaceshipCustomizationPanel-DOz_-J6g.js   17.90 kB │ gzip:   6.38 kB
dist/assets/browser-env-BR2BUkSd.js                   57.26 kB │ gzip:  20.84 kB
dist/assets/index-DCVPnCyo.js                        111.21 kB │ gzip:  33.66 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-Ddozhxko.js                        610.56 kB │ gzip: 154.65 kB
✓ built in 1.48s
entry index assets/index-DCVPnCyo.js raw=111213 gzip=33660
initial files=2 raw=332912 gzip=102616 budget=150000
three assets/three-Ddozhxko.js raw=610563 gzip=154647 budget=165000
total files=6 raw=1027045 gzip=287223 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-DOz_-J6g.js raw=17903 gzip=6381 initial=false
chunk browser-env assets/browser-env-BR2BUkSd.js raw=57261 gzip=20843 initial=false
chunk cursor-ship assets/cursor-ship-gTMZusq0.js raw=8406 gzip=2736 initial=false
chunk index assets/index-DCVPnCyo.js raw=111213 gzip=33660 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-Ddozhxko.js raw=610563 gzip=154647 initial=false

Bundle budget OK.
EXIT=0
```

### 6. Mailpit-primed containerized smoke

#### 6a. Pinned block with the default compose provider — failed in the environment
```
$ podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit
 Container cubeclicker-mailpit-1 Started
EXIT=0

$ npm run smoke
> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

 Container cubeclicker-mailpit-1 Running
 Container cubeclicker-frontend-prod-1 Creating
 Container cubeclicker-db-1 Creating
 Container cubeclicker-frontend-1 Creating
 Container cubeclicker-db-1 Created
 Container cubeclicker-frontend-1 Created
 Container cubeclicker-backend-1 Creating
 Container cubeclicker-frontend-prod-1 Created
 Container cubeclicker-backend-1 Created
 Container cubeclicker-db-1 Starting
 Container cubeclicker-frontend-1 Starting
 Container cubeclicker-frontend-prod-1 Starting
 Container cubeclicker-db-1 Started
 Container cubeclicker-db-1 Waiting
 Container cubeclicker-frontend-1 Started
 Container cubeclicker-frontend-prod-1 Started
 Container cubeclicker-db-1 Error dependency db failed to start
dependency failed to start: container cubeclicker-db-1 is unhealthy
Error: executing /usr/local/bin/docker-compose -f compose.yaml -f compose.smoke.yaml run --rm smoke: exit status 1
EXIT=1
```

#### 6b. Exact failure and root cause
The `db` HEALTHCHECK never passes, and compose waits on `condition: service_healthy`:
```
$ podman inspect cubeclicker-db-1 --format '{{.State.Health.Status}}'
unhealthy
$ podman exec cubeclicker-mailpit-1 true
Error: crun: write to `/proc/self/oom_score_adj`: Permission denied: OCI permission denied
```
The rootless Podman API service runs with OOM score adjustment `200`, so every container it creates carries `OomScoreAdj=200`; the exec process inside the container cannot raise its own `/proc/self/oom_score_adj` to that value in the nested user namespace. Direct CLI `podman run` containers carry `OomScoreAdj=0` and are unaffected. This is a host-runtime limitation of the default provider path, not an application failure: the database itself logs `database system is ready to accept connections` and the health command (`pg_isready`) is the exec that crun refuses to start.

#### 6c. Same pinned commands with the other supported provider — 29/29 checks pass
`podman compose` delegates to an external provider; `PODMAN_COMPOSE_PROVIDER` selects the supported alternative without touching any recipe. The `frontend-prod` image was rebuilt from the current tree first, per the explicit instruction at the top of `compose.smoke.yaml`.

```
$ PODMAN_COMPOSE_PROVIDER=<podman-compose> podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit
 Container cubeclicker_mailpit_1
EXIT=0

$ PODMAN_COMPOSE_PROVIDER=<podman-compose> npm run smoke
> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

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
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1003ms
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
PASS prod /assets/index-2xID-oc4.js is served gzip with immutable caching — content-encoding gzip; 111279 B decompressed
PASS prod /assets/three-Ddozhxko.js is served gzip with immutable caching — content-encoding gzip; 610563 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (29/29 checks)
EXIT=0
```

Register → Mailpit → verify → login passes with `compose.smoke.yaml` still pinning Mailpit (`SMTP_HOST: "mailpit"`, `SMTP_PORT: "1025"`, `SMTP_SECURE: "false"`); `compose.yaml` and `compose.smoke.yaml` have an empty diff versus `origin/main`.

### 7. `actionlint` over both workflows → exit 0
```
$ podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml
EXIT=0
```
No findings (silent success).

### 8. Vercel JSON and Render YAML parses → exit 0
```
$ node -e "JSON.parse(require('node:fs').readFileSync('src/frontend/vercel.json','utf8'));console.log('vercel.json: valid JSON')"
vercel.json: valid JSON
EXIT=0

$ node -e "const fs=require('node:fs');const yaml=require('js-yaml');const b=yaml.load(fs.readFileSync('render.yaml','utf8'));if(!Array.isArray(b.services)||b.services.length!==1)throw new Error('render.yaml must declare exactly one service');console.log('render.yaml: valid YAML, one service')"
render.yaml: valid YAML, one service
EXIT=0
```

### 9. Unchanged email-CLI suite → exit 0
```
$ npm test --workspace @cubeclicker/backend -- src/auth/email-cli.test.ts
 ✓ src/auth/email-cli.test.ts (21 tests)
 Test Files  1 passed (1)
      Tests  21 passed (21)
EXIT=0
```

### 10. T1 process fixtures re-run (the `tasks.md` T8 fixtures) → all assertions matched
```
FIXTURE-1 587-block: exit=1 first-line=OK
FIXTURE-2 587abc-invalid: exit=1 first-line=OK
FIXTURE-3 2525-secure-true: exit=1 first-line=OK
FIXTURE-4 1025-local: exit=1 first-line=OK
FIXTURE-5 2525-accept: exit=0 exact-OK-line=OK
T1 PROCESS FIXTURES: ALL ASSERTIONS MATCHED
EXIT=0
```
Each fixture asserted the exact blocked first line from AC-1(b); the accepting fixture asserted exactly `Deploy configuration OK: 9 value(s) present for the 'development' environment.` with exit 0.

### 11. T7 per-file documentation checks re-run verbatim → all matched
```
T7-DOC loop (3 files x 3 anchors): OK
T7-DOC README anchors + no development 587: OK
T7-DOC recovery section (9 anchors): OK
T7-DOC README 502/production/removed text: OK
T7-DOC deployment.md: OK
T7-DOC vercel-render-neon.md: OK
T7-DOC observability.md (4 events + levels + fields + no-PII): OK
T7-DOC docs/features/README.md absent from working diff: OK
T7-DOC origin/main resolvable: OK
T7 DOCUMENTATION CHECKS: ALL MATCHED
EXIT=0
```

### 12. Credential, PII and token audits → all passed
The repository guard patterns, the branch-diff guard, the branch-history guard, the `.env`-addition guard, the docs-diff address guard and the added-lines docs token guard (with the single synthetic CLI value exemption) were all executed from the T8 block:
```
AUDIT tracked-tree credential guard: OK (no match)
AUDIT untracked-inclusive credential guard: OK (no match)
AUDIT branch-diff credential guard: OK (no match)
AUDIT branch-history credential guard: OK (no match)
AUDIT branch history adds no .env file: OK
AUDIT docs-diff address guard: OK (only allowlisted placeholders)
AUDIT docs-diff token guard (added lines, synthetic value exempt): OK
AUDIT feature artifacts spec/plan/tasks/status present: OK
AUDITS: ALL GUARDS PASSED
EXIT=0
```

### 13. Consolidated T8 verify block
The block from `tasks.md` lines 266–388 was extracted verbatim into a script, with one final marker echo appended, and executed from the repository root with the supported compose provider selected for the smoke lines:
```
$ PODMAN_COMPOSE_PROVIDER=<podman-compose> bash <the T8 verify script>
T8 VERIFY BLOCK: ALL COMMANDS EXITED 0
EXIT=0
```
The block re-ran lint, typecheck, both workspaces' tests, coverage and build; the Mailpit pre-start and the smoke; actionlint over both workflows; the Vercel/Render parses; the email-CLI suite; the T1 process fixtures; the T7 per-file documentation checks; the repository, branch-diff and branch-history credential guards; the docs-diff address and token guards; and the build-log redaction guards against this file.

## Acceptance audit
- AC-10(a) → met: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` and `npm run build` all exit 0; coverage is 96.96/91.88/99.64/96.96 (backend) and 97.22/96.8/98.6/97.22 (frontend) against the unchanged 80 thresholds; no exclusion or threshold change in the feature diff.
- AC-10(b) → met: `npm run smoke` returns `SMOKE PASS (29/29 checks)` — including `auth register: POST /auth/register returns 202`, `auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account` and `auth login: POST /auth/login returns 200 with a session cookie` — with `compose.smoke.yaml` unchanged and still pinning the in-stack Mailpit. The default-provider attempt and the provider-level workaround are recorded in § 6.
- AC-10(c) → met: actionlint exits 0 over `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`; `vercel.json` parses as JSON; `render.yaml` parses as YAML with exactly one service.
- AC-10(d) → met: the credential guard passes over the tracked tree, the untracked-inclusive tree, the branch diff and `git log -p origin/main..HEAD`; branch history adds no `.env*` file; this log carries no address, token, link, credential or username.
- AC-10(e) → met: the five T1 process fixtures (587 blocked, malformed, 2525 with secure=true, 1025 local, 2525 accepted) and the T7 per-file documentation checks were re-executed with their exact expected strings and exit codes.
- AC-10(f) → met: the full suites include `render-env.test.ts` (46), `email.test.ts` (36), `email-cli.test.ts` (21), `render-env-cli.test.ts` (28), `auth-routes.test.ts` (40), `auth-service.test.ts` (73), `app.test.ts` (50), `api.test.ts` (34), `AuthForms.test.tsx` (60) and `VerificationPending.test.tsx` (6), all passing; no supersession regression observed.

## Deviations from spec
- **Compose provider for the smoke (environment-level only).** The pinned recipe assumes a healthy `podman compose` default provider. On this host that provider creates containers with `OomScoreAdj=200`, and `podman exec` (used by the `db` HEALTHCHECK) fails with a crun permission error, so the compose health gate never opens. The same pinned commands were re-run green with the other supported provider selected through `PODMAN_COMPOSE_PROVIDER`; no repository file changed. Both outcomes are recorded above for reproduction.
- No source, test, config, workflow, compose, Dockerfile, migration or feature-artifact edit was made; this task's only write is this log.

## Feature-index note
No index edit is made here; the T7 build log already carries the orchestrator-owned feature-index row proposal for `registration-account-exists` (state `building`, date 2026-11-24).

## Final build-log guards (post-edit re-run)

The three redaction guards over this file plus the file-existence check from the T8 verify block (its last four `build-log-T8.md` lines) were re-run against this log as the final step before the evidence commit. The guarded revision was 321 lines; the commands are the exact negated `grep` lines and `test -f` from the block. The patterns themselves are not reproduced here, so this log stays clean under them (they are visible in `tasks.md` § T8).

```
$ ! grep -qE <guard 1 pattern: address-shaped string> docs/features/registration-account-exists/build-log-T8.md
EXIT=0
$ ! grep -qE <guard 2 pattern: verification link, long hex token or username> docs/features/registration-account-exists/build-log-T8.md
EXIT=0
$ ! grep -qE <guard 3 pattern: provider credential forms> docs/features/registration-account-exists/build-log-T8.md
EXIT=0
$ test -f docs/features/registration-account-exists/build-log-T8.md
EXIT=0
GUARD RE-RUN: ALL FOUR EXITED 0
```

The same four commands were then re-executed against this appended version of the file and all four again exited 0: no address-shaped string, verification link, long hex token, username or credential form appears anywhere in this log.
