# Build log — T7 — Verify & integrate (full gate)

Task: T7 (2026-11-26)
Files changed: `docs/features/brevo-api-email-transport/build-log-T7.md` (this log only)

What changed & why: ran the full T7 gate from `docs/features/brevo-api-email-transport/tasks.md` (lines 262–369) over both workspaces — lint, typecheck, tests, coverage (≥ 80% per workspace), build, the coverage-config and compose top-level diffs, the Mailpit-primed containerized smoke, `actionlint` over both workflows, the Vercel/Render config parses, the parsed `deploy.yml` comparison, the deploy CLI process fixtures, the T6 documentation checks, the shared build-log guard over every `build-log-*.md`, and the credential/PII/token/branch-history/scope audits — and recorded the raw evidence below. T7 made no source, config, workflow, compose or documentation change.

Decisions:
- The gate was run against the feature branch at `<commit>` (T6) with the shared base `origin/main` at `<commit>`; this untracked log is the only T7 write and is added by this commit.
- The pre-existing, orchestrator-owned uncommitted edits to `docs/features/README.md` and `docs/features/registration-account-exists/status.md` were left untouched; the feature-index check reads the committed `origin/main...HEAD` diff, per the T7 amendment.
- Fixture addresses, container identifiers and commit ids in captured output are recorded as `<address>`, `<container-id>` and `<commit>`; exit codes and asserted lines are kept verbatim. No match is ever printed by the guards.

## Environment

- Host: Node.js `v24.22.3`, npm `11.19.1`, Podman `6.2.0`, rootless.
- Default compose provider: `/usr/local/bin/docker-compose` (Docker Compose `v5.6.0`). On this host it reproduces the known provider limitation: containers are created with `OomScoreAdj=200` and the `db` HEALTHCHECK (`pg_isready`) runs through `podman exec`, which fails:

```
$ podman inspect --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}no-health{{end}}' cubeclicker-db-1
running starting
$ podman exec cubeclicker-db-1 pg_isready -U cubeclicker -d cubeclicker
Error: crun: write to `/proc/self/oom_score_adj`: Permission denied: OCI permission denied
exec_exit=126
```

- Fallback (documented, environment-level only): `PODMAN_COMPOSE_PROVIDER=/tmp/opencode/pcvenv/bin/podman-compose`, with `podman-compose` 1.6.0 installed in a throwaway venv outside the repository (`python3 -m venv /tmp/opencode/pcvenv && /tmp/opencode/pcvenv/bin/pip install podman-compose`). The same pinned compose commands run green through that provider; no repository file was edited. This mirrors the fallback documented in `docs/features/registration-account-exists/build-log-T8.md`.
- Smoke-state note: the first `npm run smoke` attempt ran from a container state left by the default-provider probe and printed only provider-level `no container … found` lines before the 900 s bound, with no smoke output (no application check executed). A clean `podman compose … down` followed by the exact pinned cold sequence (`up -d mailpit` → `npm run smoke`) then passed **29/29**, and the verbatim T7 block re-ran the same pinned sequence green. The provider noise is a host/provider artifact; the smoke checks themselves all passed.

## Evidence

### 1. Lint, typecheck, tests, coverage, build (both workspaces)

```
$ npm run lint
> lint
> eslint .
(no findings)
lint_exit=0

$ npm run typecheck
> typecheck
> npm run typecheck --workspaces --if-present
> typecheck
> tsc --noEmit
> typecheck
> tsc --noEmit
typecheck_exit=0

$ npm test
> test   (backend)
 Test Files  52 passed (52)
      Tests  2093 passed (2093)
   Duration  4.22s (transform 5.76s, setup 0ms, collect 16.97s, tests 27.27s, environment 10ms, prepare 5.31s)
> test   (frontend)
 Test Files  83 passed (83)
      Tests  2867 passed (2867)
   Duration  4.75s (transform 11.15s, setup 0ms, collect 29.01s, tests 18.74s, environment 13.63s, prepare 7.37s)
test_exit=0

$ npm run coverage
> coverage   (backend, v8)
 % Coverage report from v8
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files          |   97.09 |    92.24 |   99.65 |   97.09 |
> coverage   (frontend, v8)
 % Coverage report from v8
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files          |   97.22 |     96.8 |    98.6 |   97.22 |
coverage_exit=0

$ npm run build
> build
> tsc
> build
> vite build && node scripts/check-bundle-budget.mjs
✓ 117 modules transformed.
dist/assets/index-DCVPnCyo.js                        111.21 kB │ gzip:  33.66 kB
dist/assets/three-Ddozhxko.js                        610.56 kB │ gzip: 154.65 kB
entry index assets/index-DCVPnCyo.js raw=111213 gzip=33660
initial files=2 raw=332912 gzip=102616 budget=150000
three assets/three-Ddozhxko.js raw=610563 gzip=154647 budget=165000
total files=6 raw=1027045 gzip=287223 budget=300000
Bundle budget OK.
build_exit=0
```

Both workspaces exceed the 80 thresholds on statements, branches, functions and lines.

### 2. Coverage configuration diff (AC-12(a))

```
$ git diff --exit-code origin/main...HEAD -- src/backend/vitest.config.ts src/frontend/vitest.config.ts
(no output)
coverage_config_diff_exit=0

$ grep -n -A5 "thresholds" src/backend/vitest.config.ts src/frontend/vitest.config.ts
src/backend/vitest.config.ts:24:      thresholds: {
src/backend/vitest.config.ts-25-        statements: 80,
src/backend/vitest.config.ts-26-        branches: 80,
src/backend/vitest.config.ts-27-        functions: 80,
src/backend/vitest.config.ts-28-        lines: 80,
src/frontend/vitest.config.ts:24:      thresholds: {
src/frontend/vitest.config.ts-25-        statements: 80,
src/frontend/vitest.config.ts-26-        branches: 80,
src/frontend/vitest.config.ts-27-        functions: 80,
src/frontend/vitest.config.ts-28-        lines: 80,
```

The configs are unchanged against `origin/main`; the four thresholds remain exactly `80` in both workspaces, with no exclusion or threshold edit.

### 3. Compose top-level comparison (AC-10(c))

```
$ node -   # strip every service.environment, compare both files against origin/main
compose: services/images/builds/ports/volumes/depends_on/healthchecks/top-level volumes unchanged; only environment values changed
compose_compare_exit=0
```

The required `EMAIL_TRANSPORT`/`BREVO_API_KEY` pass-throughs are the only compose differences; no service, image, port, volume, `depends_on` or healthcheck changed.

### 4. Mailpit-primed containerized smoke (AC-10(b))

```
$ PODMAN_COMPOSE_PROVIDER=/tmp/opencode/pcvenv/bin/podman-compose podman compose -f compose.yaml -f compose.smoke.yaml down
down_exit=0
$ PODMAN_COMPOSE_PROVIDER=/tmp/opencode/pcvenv/bin/podman-compose podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit
<container-id>
cubeclicker_mailpit_1
up_mailpit_exit=0
$ PODMAN_COMPOSE_PROVIDER=/tmp/opencode/pcvenv/bin/podman-compose npm run smoke
> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke
smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 5
PASS activity snapshot: A's welcome feed is empty and B's welcome carries exactly A's memberJoined event — server 5; memberJoined id 1 for p8
PASS appearance projection: guest B's 11-slot setAppearance yields exactly one memberAppearance on guest A, and an unknown slot key yields bad_message without a broadcast — playerId p9; 11 slots; unknown slot key rejected with bad_message; 1 memberAppearance frame(s) seen by A
PASS leaderboard join: A's welcome is a one-entry zero snapshot and B's welcome carries A and B with zero counters and totals — server 5
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 6
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)
PASS multiplayer batching: front:0:1 and front:0:2 never arrive as single miniCubeRemoved frames on A or B
PASS leaderboard update: the accepted explodes yield a coalesced leaderboardUpdate with A clicks >= 3, B clicks = 0 and totals clicks >= 3 — A clicks 3, B clicks 0, totals clicks 3
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1006ms
PASS activity leave: A receives the memberLeft activity event with B's name and an id newer than the snapshot id — memberLeft id 2 for p9
PASS multiplayer explicit leave: D's leave yields memberLeft(left) on A in under 900ms without the grace window — memberLeft(left) received after 1ms
PASS multiplayer slot reuse: E fills D's freed slot 2 with welcome.roster exactly [A, E] — server 5; roster [A, E] in D's freed slot 2
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=18 cubeclicker_ws_messages_received_total{type="join"}=14 cubeclicker_ws_frames_sent_total{type="hello"}=18
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-2xID-oc4.js is served gzip with immutable caching — content-encoding gzip; 111279 B decompressed
PASS prod /assets/three-Ddozhxko.js is served gzip with immutable caching — content-encoding gzip; 610563 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (29/29 checks)
smoke_cold_exit=0
```

The backend was warm from the preceding run, so the smoke's run-relative server ids start at 5/6 (the script asserts the id chain, not literals). `compose.smoke.yaml` still pins `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `EMAIL_TRANSPORT=smtp` and an empty `BREVO_API_KEY`; the smoke never contacts Brevo (it reads the verification message from Mailpit).

### 5. actionlint and deployment-config parses (AC-12(c))

```
$ podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml
actionlint_exit=0   (no findings)

$ node -e "JSON.parse(require('node:fs').readFileSync('src/frontend/vercel.json','utf8'));…"
vercel.json: valid JSON
vercel_parse_exit=0

$ node -e "…render.yaml services[0] envVars EMAIL_TRANSPORT/BREVO_API_KEY sync:false, no value…"
render.yaml: valid YAML, new names sync:false
render_parse_exit=0
```

### 6. Parsed `deploy.yml` comparison (AC-8(f) re-run)

```
$ node -   # parsed comparison against origin/main:.github/workflows/deploy.yml
deploy.yml: triggers/concurrency/permissions/job/step order/uses/run/with unchanged; only the two CLI steps gained EMAIL_TRANSPORT and BREVO_API_KEY
deploy_yml_compare_exit=0
```

### 7. Deploy CLI process fixtures (AC-12(d))

Each fixture is a real process (`npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only`); output is shown with the repository slug redacted as `<repo>` and no credential or sender value:

```
--- development complete (11 values) → exit 0
Deploy configuration OK: 11 value(s) present for the 'development' environment.

--- production placeholders (6) → exit 1
Deploy blocked: the 'production' environment has 6 unset or placeholder value(s).
  Placeholder: SMTP_FROM, SMTP_USER, SMTP_PASS, BREVO_API_KEY, RENDER_SERVICE_ID, RENDER_API_KEY
Remediation (names only; never paste a value into a command argument):
  variables: gh variable set <NAME> --env production --repo <repo>
  secrets:   gh secret set <NAME> --env production --repo <repo>
Runbook: README.md § Deployment Brevo runbook

--- development EMAIL_TRANSPORT=smtp → exit 1
Deploy blocked: EMAIL_TRANSPORT must be "brevo-api" for the 'development' environment; received "smtp".
  Deployed verification email uses Brevo's HTTPS API (port 443); SMTP authentication is not used.
  Runbook: README.md § Deployment Brevo runbook

--- development SMTP_PORT=587 blocked → exit 1
Deploy blocked: SMTP_PORT=587 is blocked for outbound SMTP on the Render free plan ('development' environment).
  Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS); ports 25, 465 and 587 stay blocked on Render free.
  Runbook: README.md § Deployment Brevo runbook

--- development SMTP key reused → exit 1
Deploy blocked: BREVO_API_KEY is the Brevo SMTP key, not the REST API key ('development' environment).
  Create a Brevo API key under Settings → SMTP & API → API Keys and store it as the BREVO_API_KEY secret.
  Runbook: README.md § Deployment Brevo runbook

--- development local sender → exit 1
Deploy blocked: SMTP_FROM is the local Mailpit default and cannot deliver through the Brevo API ('development' environment).
  Set SMTP_FROM to the Brevo-verified sender.
  Runbook: README.md § Deployment Brevo runbook

fixtures_visible_exit=0
```

The verbatim block additionally asserts the production output contains neither `Deploy blocked: SMTP_PORT=` nor `Deploy blocked: EMAIL_TRANSPORT must be` and that the success/rejection exit codes and exact lines match; it passed (`deploy_cli_fixtures_exit=0`).

### 8. T6 documentation checks re-run (AC-11 evidence consumed by T7)

The T6 documentation block (tasks.md § T6, the positive/negative loops over `README.md`, `docs/architecture/email.md`, `deployment.md`, `vercel-render-neon.md`, `observability.md`, `containerization.md`, plus the T6 log guard) was re-run with the T7 amendment: the T6 working-tree `docs/features/README.md` diff line was replaced by the committed `origin/main...HEAD` feature-index check. Exit 0, and the required positive sentence is present:

```
README.md: positive sentence count=1
docs/architecture/email.md: positive sentence count=1
docs/architecture/deployment.md: positive sentence count=2
docs/architecture/vercel-render-neon.md: positive sentence count=2
README.md: EMAIL_TRANSPORT=brevo-api count=9
README.md: eleven validated, nine synced count=3
README.md: Brevo HTTPS API count=7
README.md: brevo_api_transport_verify_ok count=5
containerization.md: no-new-service sentence count=1
observability.md: brevo_api_transport_verify_ok count=2
observability.md: brevo_api_transport_verify_failed count=3
observability.md: brevo_api_transport_verify_skipped count=1
observability.md: email transport count=1
PASS stale observability phrase absent
PASS stale containerization phrase absent
docs_strict_exit=0
t6_docs_adapted_exit=0
```

The full T6 stale-string negatives (the deployed-uses-SMTP claims and the old seven-name counts) are also covered by that block and passed (silent `! grep` assertions; strict exit 0).

### 9. Shared build-log guard and credential/PII/token/branch-history audits (AC-12(e))

The credential-only subset of the shared guard (no address/bare-token alternative) was applied with the amended `*.test.ts`/`*.spec.ts` pathspec exclusion; the real Brevo/Render key-shape pattern stayed strict on every path, including tests and logs; the extended shared guard was applied to every `build-log-*.md`:

```
PASS real-key shapes absent from the tracked tree
PASS real-key shapes absent from tracked+untracked files
PASS real-key shapes absent from the branch diff
PASS real-key shapes absent from branch history
PASS credential assignments absent from tracked non-test paths
PASS credential assignments absent from tracked+untracked non-test paths
PASS credential assignments absent from the non-test branch diff
PASS credential assignments absent from non-test branch history
PASS no .env* file in branch history
PASS shared log guard clean: docs/features/brevo-api-email-transport/build-log-T1.md
PASS shared log guard clean: docs/features/brevo-api-email-transport/build-log-T2.md
PASS shared log guard clean: docs/features/brevo-api-email-transport/build-log-T3.md
PASS shared log guard clean: docs/features/brevo-api-email-transport/build-log-T4.md
PASS shared log guard clean: docs/features/brevo-api-email-transport/build-log-T6.md
PASS shared log guard clean: docs/features/brevo-api-email-transport/build-log-T7.md
audit_strict_exit=0
```

No match was printed; no credential, address, token, key shape or `.env*` file is present in the scanned surfaces.

### 10. Scope and artifact checks (AC-12(f))

```
committed changed files (origin/main...HEAD):
  .github/workflows/ci.yml
  .github/workflows/deploy.yml
  README.md
  compose.smoke.yaml
  compose.yaml
  docs/architecture/containerization.md
  docs/architecture/deployment.md
  docs/architecture/email.md
  docs/architecture/observability.md
  docs/architecture/vercel-render-neon.md
  docs/features/brevo-api-email-transport/build-log-T1.md
  docs/features/brevo-api-email-transport/build-log-T2.md
  docs/features/brevo-api-email-transport/build-log-T3.md
  docs/features/brevo-api-email-transport/build-log-T4.md
  docs/features/brevo-api-email-transport/build-log-T6.md
  render.yaml
  src/backend/src/app.test.ts
  src/backend/src/app.ts
  src/backend/src/auth/auth-routes.test.ts
  src/backend/src/auth/auth-routes.ts
  src/backend/src/auth/config.test.ts
  src/backend/src/auth/config.ts
  src/backend/src/auth/email-cli.test.ts
  src/backend/src/auth/email-cli.ts
  src/backend/src/auth/email.test.ts
  src/backend/src/auth/email.ts
  src/backend/src/deploy/render-env-cli.test.ts
  src/backend/src/deploy/render-env-cli.ts
  src/backend/src/deploy/render-env.test.ts
  src/backend/src/deploy/render-env.ts
PASS no forbidden source/frontend/Dockerfile/migration path in the committed diff
PASS docs/features/README.md absent from the committed diff
PASS no other feature directory in the committed diff
PASS artifact present: spec.md
PASS artifact present: plan.md
PASS artifact present: tasks.md
PASS artifact present: status.md
PASS artifact present: build-log-T7.md
```

The list is pre-commit; this commit adds only `docs/features/brevo-api-email-transport/build-log-T7.md` (inside the allowed feature directory). The required compose environment pass-throughs are the only `compose*` change; no frontend, `auth-service.ts`, `email-template.ts`, migration/schema or Dockerfile path is in the diff.

### 11. Verbatim T7 verify block

The block at `docs/features/brevo-api-email-transport/tasks.md` lines 262–369 was extracted verbatim to `/tmp/opencode/t7/t7-verify.sh` and run from the repository root with the documented provider fallback exported only for the compose commands:

```
$ PODMAN_COMPOSE_PROVIDER=/tmp/opencode/pcvenv/bin/podman-compose bash /tmp/opencode/t7/t7-verify.sh > /tmp/opencode/t7/verbatim-run1.out 2>&1
$ echo $?
0
T7_VERBATIM_EXIT=0
```

Observed milestone output in that run:

```
 Test Files  52 passed (52); Tests  2093 passed (2093)      (backend)
 Test Files  83 passed (83); Tests  2867 passed (2867)      (frontend)
All files          |   97.09 |    92.24 |   99.65 |   97.09 |   (backend coverage)
All files          |   97.22 |     96.8 |    98.6 |   97.22 |   (frontend coverage)
compose: services/images/builds/ports/volumes/depends_on/healthchecks/top-level volumes unchanged; only environment values changed
SMOKE PASS (29/29 checks)
vercel.json: valid JSON
render.yaml: valid YAML, new names sync:false
deploy.yml: triggers/concurrency/permissions/job/step order/uses/run/with unchanged; only the two CLI steps gained EMAIL_TRANSPORT and BREVO_API_KEY
```

All silent `grep -Fq`/`test -f` assertions and all `!`-inverted guards passed under `set -euo pipefail` (exit 0). The block was re-run after this log was finalized (pre-commit and post-commit); every re-run exited 0.

## Acceptance audit (AC-10(b), AC-10(c), AC-12)

- **AC-10(b) → met.** The pinned cold sequence `podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit` then `npm run smoke` exits 0 with `SMOKE PASS (29/29 checks)`, including `auth register → Mailpit → verify → login`; `compose.smoke.yaml` still pins Mailpit/SMTP and an empty API key, so the smoke never contacts Brevo. The default provider's host limitation and the documented `PODMAN_COMPOSE_PROVIDER` fallback are recorded in § Environment; no repository file was changed.
- **AC-10(c) → met.** The parsed top-level comparison of `compose.yaml` and `compose.smoke.yaml` against `origin/main` reports the service set, images/builds, ports, volumes, `depends_on`, healthchecks and top-level volumes unchanged; only environment values differ (the two required pass-throughs).
- **AC-12(a) → met.** `npm run lint` 0, `npm run typecheck` 0 (both workspaces), `npm test` 0 (backend 52 files/2093 tests; frontend 83 files/2867 tests), `npm run coverage` 0 (backend 97.09/92.24/99.65/97.09; frontend 97.22/96.8/98.6/97.22 — all ≥ 80), `npm run build` 0 with `Bundle budget OK`. The coverage-config diff against `origin/main` is empty; both configs keep the four `80` thresholds and no exclusion/threshold change.
- **AC-12(b) → met.** `npm run smoke` passes with `compose.smoke.yaml` still pinning Mailpit (`SMOKE PASS (29/29 checks)`, exit 0).
- **AC-12(c) → met.** `actionlint` over `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` exits 0 with no findings; `src/frontend/vercel.json` parses as JSON; `render.yaml` parses as YAML with `EMAIL_TRANSPORT` and `BREVO_API_KEY` `sync: false` and no value.
- **AC-12(d) → met.** The real-process deploy CLI fixtures cover the 11-name acceptance (exit 0, exact success line), the 6-placeholder production rejection (exit 1, exact header/placeholder list, no port/transport block), the `EMAIL_TRANSPORT=smtp` rejection, the SMTP-key-reuse rejection, the local-sender rejection and the SMTP port guard (exit 1, exact blocks).
- **AC-12(e) → met.** The extended shared guard passes over every `docs/features/brevo-api-email-transport/build-log-*.md` (T1, T2, T3, T4, T6, T7); the credential-only subset with the `*.test.ts`/`*.spec.ts` pathspec exclusion passes over the tracked tree, tracked+untracked files, the branch diff and branch history, while the real key-shape patterns stay strict on every path; no `.env*` file appears in branch history; no match is printed.
- **AC-12(f) → met.** The committed diff is tightly scoped: no `src/frontend/**`, `auth-service.ts`, `email-template.ts`, migration/schema, Dockerfile, compose service/image/port/volume/healthcheck or `docs/features/README.md` change; the required compose environment pass-throughs and the feature directory are the allowed changes, and no other feature directory is touched.

Deviations from spec: none. The only environment-level deviation is the documented `PODMAN_COMPOSE_PROVIDER` compose-provider fallback (host `podman exec` limitation), recorded in § Environment; it changes no repository file.
