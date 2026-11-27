# Build log — T8 — Verify & integrate

Task: T8 (2026-11-27)
Files changed: `docs/features/production-provisioning/build-log-T8.md` (only). No application, test, workflow, compose, Dockerfile, `render.yaml`, `src/frontend/vercel.json`, `package.json`, lockfile, `.env*`, `docs/features/README.md` or `status.md` edit was authored by this task. No provider write, deploy dispatch, resource deletion or rollback was performed; every provider and GitHub read below is read-only.
What changed & why: Ran the full T8 no-regression gate and reproduced the T6 live proof/provider read-backs. Every executable gate command is green (lint, typecheck, tests, `npm run coverage`, build, local smoke 29/29 via the documented provider fallback, `actionlint`, the Vercel/Render parses, the dispatch parse, the T6a one-added/one-removed diff guard, both Brevo guard fixtures, the credential-shaped audits and the stale-production scan). The only earlier blocker was `build-log-T1.md:244`, which recorded the public npm maintainer address from an `npm ci` deprecation warning; that line was sanitized in commit `37d3a54` (`chore: redact npm maintainer address in T1 build log`), and the strict address/hex guard now returns no output (direct `grep` exit `1`). The exact T8 block passes in place with `FINAL_VERIFY_EXIT=0`.
Decisions: Executed the T8 verify block with the documented environment-level `PODMAN_COMPOSE_PROVIDER=/tmp/opencode/pcvenv/bin/podman-compose` fallback because the default `podman compose` provider hits the host `crun`/`OomScoreAdj` regression recorded in T7; the fallback is a host workaround only and changes no repository file. The orchestrator authorized committing its unchanged `docs/features/production-provisioning/status.md` together with this log in the final integration commit (`status.md committed unchanged under orchestrator authorization`); the builder did not edit the file's content. The T1 sanitization was authored outside T8 (`37d3a54`), and T8 did not edit the T8 verify block.
Testing note: T8 is the final verification/integration task per `tasks.md` (no application code, no unit/integration boundary of its own). The feature-appropriate evidence is the full repository suite plus coverage, the containerized smoke, the config/workflow parses, the diff guards, the credential audits and the live-proof/provider reproduction. No production code was excluded from coverage and no threshold was changed.

## Final status: COMPLETED — final gate and live proof verified in place

- All executable gates pass; the live production environment and the T6 proof are reproduced (below).
- The address/hex guard is genuinely empty: the direct command `grep -qE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|[0-9a-f]{32,}' docs/features/production-provisioning/build-log-*.md` exits `1` with no output (`ADDRESS_GUARD_GREP_EXIT=1`, `ADDRESS_GUARD_OUTPUT=EMPTY`), so the pass is not masked by the `set -e`/`! grep` shell behavior recorded in the earlier blocked-state history.
- The exact T8 verify block was re-run in place after the integration commit (clean `status.md`, sanitized T1 log): `FINAL_VERIFY_EXIT=0`.
- `status.md` was committed **unchanged** under orchestrator authorization; the builder did not edit its content. The final integration commit contains only `docs/features/production-provisioning/status.md` and this `build-log-T8.md`.
- No application, provider, workflow or environment value was changed to make the guard pass; the only content fix was the externally authored T1 sanitization `37d3a54`.

## Full gate — results

| Command | Result |
| --- | --- |
| `npm ci` | exit 0 — `added 399 packages, and audited 402 packages` |
| `npm run lint` | exit 0 (no output) |
| `npm run typecheck` | exit 0 (no output) |
| `npm test` | exit 0 — `83` test files passed, `2867` tests passed |
| `npm run coverage` | exit 0 — backend `97.09` statements / `92.24` branches / `99.65` functions / `97.09` lines; frontend `97.22` / `96.8` / `98.6` / `97.22`; thresholds ≥ 80 unchanged |
| `npm run build` | exit 0 — `Bundle budget OK.` (initial `102,616` B gzip / `150,000`; Three.js `154,647` / `165,000`; total `287,223` / `300,000`) |
| `npm run smoke` (default provider) | exit 1 — host `crun`/`OomScoreAdj` limitation (see § Smoke), not an application failure |
| `npm run smoke` (`PODMAN_COMPOSE_PROVIDER` fallback) | exit 0 — `SMOKE PASS (29/29 checks)` |
| `git diff --exit-code <base> -- src tests compose.yaml compose.smoke.yaml package.json package-lock.json` | exit 0 — no application code change |
| `actionlint 1.7.12` over `.github/workflows/*.yml` | exit 0 (no output) |
| `vercel.json` parse | `vercel.json: valid JSON` |
| `render.yaml` parse | `render.yaml: one development service, unchanged` |
| `deploy.yml` dispatch parse | `deploy.yml: dispatch choices, automatic path and job count unchanged` |
| T6a PR diff guard | exit 0 — `PR: https://github.com/raultorres2603/CubeClicker/pull/4`, `content_lines=2`, added line contains `gh run list --repo "$GITHUB_REPOSITORY"`, no other content line |
| Brevo guard fixture 1 (development, 11 values) | exit 0 — `Deploy configuration OK: 11 value(s) present for the 'development' environment.` |
| Brevo guard fixture 2 (production, 6 placeholders) | exit 1 expected — `Deploy blocked: the 'production' environment has 6 unset or placeholder value(s).` |
| Credential-shaped tree/diff/log audits | no matches (see § Credential and connection-string audits) |
| Stale-production scan | `stale-production-scan: PASS`; `allowlist: historical AWS/Fly only` |

### Smoke provider note

- The default `podman compose` provider uses `/usr/local/bin/docker-compose` (`Docker Compose v5.6.0`), which creates the `db` container with `OomScoreAdj=200`; the `pg_isready` HEALTHCHECK is a `podman exec` and the host `crun 1.31` refuses it with `crun: write to /proc/self/oom_score_adj: Permission denied: OCI permission denied`. The compose health gate never opens (`dependency failed to start: container cubeclicker-db-1 is unhealthy`).
- The documented environment-level fallback (`podman-compose 1.6.0` in `/tmp/opencode/pcvenv`, selected with `PODMAN_COMPOSE_PROVIDER=/tmp/opencode/pcvenv/bin/podman-compose`) was used exactly as in T7: remove the default-provider containers/network, `down`, `up -d mailpit`, then `npm run smoke`. Result: `SMOKE PASS (29/29 checks)`, including `auth register`, `auth verify`, `auth login`, the metrics check and the production static-delivery checks.
- No repository file was changed for the fallback; CI remains the authoritative cross-service smoke on a host without the `crun` regression.

### Coverage evidence (excerpt)

```text
File               | % Stmts | % Branch | % Funcs | % Lines
All files (backend) |   97.09 |    92.24 |   99.65 |   97.09
All files (frontend)|   97.22 |     96.8 |    98.6 |   97.22
```

- Both workspace runs exit 0 with the committed thresholds (`80`) unchanged; all production files remain in the all-files calculation.

## Live-proof reproduction — run `46004355405`

### Run identity and fix reference

- run URL: `https://github.com/raultorres2603/CubeClicker/actions/runs/46004355405`
- run_id=46004355405
- event `workflow_dispatch`, head branch `main`, head SHA `d10dfb1`, status `completed`, conclusion `success`, created `2026-11-27T13:07:11Z`, updated `2026-11-27T13:09:31Z`.
- Fix PR: https://github.com/raultorres2603/CubeClicker/pull/4
- Fix commit: d10dfb1
- The preflight step executed the repaired form and printed `CI succeeded for d10dfb1` (the log's full-SHA suffix is shortened here to the 7-character commit).
- CI for `origin/main` (`d10dfb1`): run `45997877865`, event `push`, status `completed`, conclusion `success`.

### Exact proof lines reproduced from the run log

- `Deploy configuration OK: 11 value(s) present for the 'production' environment.`
- Nine `SYNCED` lines (count `9`):
  - `SYNCED SMTP_HOST (value verified, not shown)`
  - `SYNCED SMTP_PORT (value verified, not shown)`
  - `SYNCED SMTP_SECURE (value verified, not shown)`
  - `SYNCED SMTP_CONNECTION_TIMEOUT_MS (value verified, not shown)`
  - `SYNCED SMTP_FROM (value verified, not shown)`
  - `SYNCED SMTP_USER (value verified, not shown)`
  - `SYNCED SMTP_PASS (value verified, not shown)`
  - `SYNCED EMAIL_TRANSPORT (value verified, not shown)`
  - `SYNCED BREVO_API_KEY (value verified, not shown)`
- `Synced 9 value(s) to Render service srv-dc4mjd15efls739ua63g for the 'production' environment.`
- `No pending migrations.` (the migration ran with the production URL and applied zero pending migrations).
- `healthz OK after 0s: {"status":"ok"}`
- `DEPLOYED SMOKE PASS (8/8 checks)`
- No `DEPLOYED SMOKE FAIL` line exists in the run log.
- `Render deploy: dep-dc4o1fff3r2c73c4asp0 live`
- `Vercel deployment: dpl_2wFeBSaUSxYKkhpNtqZGFcby1Duq ready`
- `POST-RUN HEALTH 200` with exactly `{"status":"ok"}`.
- `production frontend: https://cubeclicker.vercel.app`
- `production api: https://cubeclicker.onrender.com`

### Deployed smoke re-run (T8)

- First re-run: `FAIL backend /healthz returns 200 with {"status":"ok"} — GET https://cubeclicker.onrender.com/healthz failed: The operation was aborted due to timeout` (Render free-instance cold start); the immediate direct `/healthz` check then returned `HTTP 200 {"status":"ok"}`.
- Warm re-run against the anchored `production frontend:` / `production api:` values:

```text
deployed smoke: frontend=https://cubeclicker.vercel.app api=https://cubeclicker.onrender.com ws=wss://cubeclicker.onrender.com/ws origin=https://cubeclicker.vercel.app timeoutMs=20000
PASS backend /healthz returns 200 with {"status":"ok"} — 200 {"status":"ok"}
PASS CORS preflight from https://cubeclicker.vercel.app is allowed — 204; access-control-allow-origin https://cubeclicker.vercel.app
PASS CORS preflight from https://disallowed.invalid is rejected — 403 origin_not_allowed without access-control-allow-origin
PASS frontend / serves the SPA shell with no-cache — 200 text/html; cache-control no-cache
PASS frontend /deep/link serves the SPA fallback — 200 text/html SPA fallback
PASS frontend /assets/does-not-exist.js is a real 404 — 404 without the SPA shell
PASS WebSocket at wss://cubeclicker.onrender.com/ws accepts Origin https://cubeclicker.vercel.app: hello, guest join, explode — hello -> welcome server 1 -> miniCubeRemoved front:0:0
PASS WebSocket rejects a disallowed Origin before the upgrade (HTTP 403 or close 1008) — HTTP 403 before the upgrade ({"message":"origin not allowed","code":"origin_not_allowed"}), no hello
DEPLOYED SMOKE PASS (8/8 checks)
```

- The smoke is guest-only: no account, email, cookie, token or destructive state; the only game action is a guest join plus one level-0 explode validated by the server.

## Provider and development read-backs (read-only)

### Production

- `production neon branch: br-floral-dream-zarerhtw` — project `patient-mountain-41401588`, name `production`, parent `none` (project default), `primary: true`, `default: true`, `protected: false`, `current_state: ready`, `creation_source: console`, `updated_at: 2026-11-27T13:55:19Z`. The branch is an environment identifier, not a resource display name; it predates this feature and was reused, never created or deleted.
- `production vercel project: prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH https://cubeclicker.vercel.app` — name `cubeclicker`, framework `vite`, Node `24.x`, account `team_7cz2iixGr020Vqvjhj7Y1DNp`, domain `cubeclicker.vercel.app`, `ssoProtection.enabled: false`, `passwordProtection.enabled: false`; latest production deployment `dpl_2wFeBSaUSxYKkhpNtqZGFcby1Duq` state `READY` target `production`, commit `d10dfb1`; `list_deployments` count `1` (the production project has exactly the live deployment).
- `production render service: srv-dc4mjd15efls739ua63g https://cubeclicker.onrender.com` — name `cubeclicker`, type `web_service`, runtime `docker`, `dockerfilePath: ./src/backend/Dockerfile`, `dockerContext: .`, plan `free`, region `frankfurt`, branch `main`, `autoDeployTrigger: off`, `numInstances: 1`, `healthCheckPath: ""`, `suspended: not_suspended`; deploy `dep-dc4o1fff3r2c73c4asp0` status `live`, trigger `deploy_hook`, commit `d10dfb1`, created `2026-11-27T13:08:13Z`, finished `2026-11-27T13:08:43Z`.
- `production github names: 15 variables / 8 secrets` — the exact 23-name catalog is present; the `main`-only custom deployment branch policy is active (`custom_branch_policies: true`, exactly one policy named `main`), and the `required_reviewers` protection rule names the owner with `prevent_self_review: false` (self-approvable single-owner gate; the fallback was not needed). The guarded eleven-name catalog is present (7 variables + 4 secrets); `SMTP_USER` is a secret only.

Non-secret production GitHub values read back exactly: `FRONTEND_ORIGIN=https://cubeclicker.vercel.app`, `VITE_API_URL=https://cubeclicker.onrender.com`, `VITE_WS_URL=wss://cubeclicker.onrender.com/ws`, `VERCEL_ORG_ID=team_7cz2iixGr020Vqvjhj7Y1DNp`, `VERCEL_PROJECT_ID=prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH`, `RENDER_SERVICE_ID=srv-dc4mjd15efls739ua63g`, `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=2525`, `SMTP_SECURE=false`, `SMTP_CONNECTION_TIMEOUT_MS=10000`, `EMAIL_TRANSPORT=brevo-api`, `MAX_USERS_PER_SERVER=10`, `SESSION_COOKIE_SECURE=true`, `SESSION_COOKIE_SAMESITE=none`; `SMTP_FROM` is present by name only (value not read).

### Development (post-read)

- `development unchanged: PASS` — the `development` Environment still holds exactly the same 15 variables / 8 secrets as the T1/T5 pre-state (identical name sets; no production-provisioning command wrote to it), its protection JSON is still `deployment_branch_policy: null`, `protection_rules: []`, and no builder command targeted `development`.
- Neon development branch `br-ancient-smoke-za1pdv7w` (parent `br-floral-dream-zarerhtw`, `primary: false`, `default: false`, `protected: false`, `current_state: ready`) is present and distinct from the production branch.
- Vercel development project `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV` (`cubeclicker-development`, domain `https://cubeclicker-development.vercel.app`, framework `vite`, Node `24.x`, SSO/password protection off) is present and distinct from the production project.
- Render development service `srv-dbtcvv9srm7s73au5bag` (`cubeclicker-development`, `https://cubeclicker-development.onrender.com`, docker, free, frankfurt, branch `main`, `autoDeployTrigger: off`, `healthCheckPath: ""`, `not_suspended`) is present and distinct from the production service.
- Pipeline note (no builder write): the development Vercel latest deployment advanced to `dpl_HEeZ59v1DfLwEzdKynFcWPWyw3s6` for `main` commit `d10dfb1` and the development Render service `updatedAt` is `2026-11-27T12:27:26Z`; these are the normal automatic `workflow_run` development deploys caused by the authorized `main` integration commits (`9e77d62`, `d10dfb1`), not a production-provisioning command or a configuration change. The development Environment names, resource identities and protection are unchanged.

### No production auto-deploy, no rollback, no deletion

- The production path remains manual: `.github/workflows/deploy.yml` has only `workflow_run` (automatic, resolves `development`) and `workflow_dispatch` (default `production`); the deploy job `if` and the environment expression are unchanged from the dispatch parse. The successful production run is a `workflow_dispatch` from `main`; there is no `push`-triggered production run.
- No rollback to development: production's `FRONTEND_ORIGIN`, `VITE_API_URL`, `VITE_WS_URL`, `DATABASE_URL` and `DIRECT_DATABASE_URL` point at the production Vercel/Render/Neon resources; no production value was repointed to a development resource.
- No deletion of the existing Neon production branch: `br-floral-dream-zarerhtw` is present, primary/default, ready; no branch create/delete/rename was issued by T8.
- No resource deletion, provider write, deploy dispatch or rollback was performed by T8; every read above is read-only.

## Workflow, config and diff evidence

### T6a one-line diff guard

```text
PR: https://github.com/raultorres2603/CubeClicker/pull/4
content_lines=2
-          if ! conclusion=$(gh run list --workflow CI --commit "$TARGET_SHA" --limit 1 --json conclusion --jq '.[0].conclusion'); then
+          if ! conclusion=$(gh run list --repo "$GITHUB_REPOSITORY" --workflow CI --commit "$TARGET_SHA" --limit 1 --json conclusion --jq '.[0].conclusion'); then
```

- Exactly one added and one removed non-comment content line; the added line contains `gh run list --repo "$GITHUB_REPOSITORY"`; no other content line changed.
- `.github/workflows/deploy.yml` still has exactly one `gh run list`, the guard condition `if [ "$conclusion" != "success" ]; then`, and the dispatch-only step `if: github.event_name == 'workflow_dispatch'`; the automatic `workflow_run` path, step order, permissions, triggers and concurrency are unchanged.

### Parases

- `actionlint` (pinned `1.7.12`) over `.github/workflows/*.yml`: exit 0 (no output).
- `src/frontend/vercel.json`: `vercel.json: valid JSON`.
- `render.yaml`: `render.yaml: one development service, unchanged` (exactly one `cubeclicker-development` docker/free service; no production entry).
- `.github/workflows/deploy.yml`: `deploy.yml: dispatch choices, automatic path and job count unchanged` (choices `[production, development]`, default `production`, `type: choice`, `required: true`; one job; the exact job `if`; the exact checkout ref).

### Application-code no-op

- `No application code change`: `git diff --exit-code <merge-base> -- src tests compose.yaml compose.smoke.yaml package.json package-lock.json` exits 0; the path list is empty. The only feature-branch difference from `origin/main` before this commit is documentation and build logs.

## Brevo guard fixtures

- Fixture 1 (development, complete eleven values): exit 0, exact output `Deploy configuration OK: 11 value(s) present for the 'development' environment.`
- Fixture 2 (production, six pinned placeholders): exit 1, exact output `Deploy blocked: the 'production' environment has 6 unset or placeholder value(s).` followed by the six placeholder names (`SMTP_FROM`, `SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `RENDER_SERVICE_ID`, `RENDER_API_KEY`) and the names-only remediation text.
- The fixture values were supplied through the process environment only; the fixture command lines are not recorded (T8 instruction), so no synthetic address/value string enters this log. Both fixtures are the same ones CI's `verify-workflows` job runs.

## Credential and connection-string audits

All of the following returned no match on the current tree (tracked and untracked), the `origin/main...HEAD` diff, the `origin/main..HEAD` history and the feature build logs:

- Credential-shaped pattern `(VERCEL_TOKEN|RENDER_API_KEY|RENDER_DEPLOY_HOOK_URL|FLY_API_TOKEN|BREVO_API_KEY|SMTP_PASS|SMTP_USER)=["']?[A-Za-z0-9+/_-]{12,}` plus the retained `FlyV1 [A-Za-z0-9_-]{20,}` key shape (with the documented `docs/` and colocated `*.test.ts`/`*.spec.ts` exclusions); the key-shape patterns (`rnd_`, `xkeysib-`, `xsmtpsib-`, `FlyV1`) remain strict on every path.
- AWS key shapes `AKIA|aws_secret_access_key|AWS_SESSION_TOKEN` outside `docs/`: no match.
- Credentialed connection strings in `.github`/`infra`/`src` (excluding colocated tests): no match.
- Feature build-log guards: no credentialed connection string and no `xsmtpsib-`/`xkeysib-`/`SMTP_USER|PASS=`/`BREVO_API_KEY=`/`RENDER_API_KEY=`/`rnd_`/`FlyV1` match.
- `.env*`: `git status --porcelain -- '.env*'` is empty and the base diff is empty.
- No secret value was read, copied, compared, printed or recorded by T8; no owner-held value was touched; the deployed smoke is guest-only and uses no credential.

## Stale-production scan

- Command: the exact T8 scan over `README.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/email.md`, `docs/architecture/observability.md` and `AGENTS.md` for `not provisioned|unprovisioned|placeholder-only|future production|one project|six pinned placeholders|has no protection rules yet`, filtered by `historical|archived|superseded|it is not provisioned`.
- Result: `stale-production-scan: PASS` (zero remaining current-state matches).
- `allowlist: historical AWS/Fly only` — the only retained deprecated vocabulary is the historical AWS/Fly section and the pinned supersession-ledger row, both explicitly allowlisted by the `historical|archived|superseded` filter.

## Proposed feature-index row

`production-provisioning | Production Environment Provisioning | accepted | 2026-11-27`

- Proposed only: `docs/features/README.md` is orchestrator-owned and was not edited. The earlier address-guard blocker is resolved (`37d3a54`), so the row is ready for the orchestrator to apply.

## Integration-hygiene note — commit `3277661`

- Commit `3277661` (`docs`) captured the six T7 documentation files together with the orchestrator-owned `status.md` and a concurrent feature's artifacts. Exact file list (14 files; `M` modified, `A` added):

```text
M AGENTS.md
M README.md
M docs/architecture/deployment.md
M docs/architecture/email.md
M docs/architecture/observability.md
M docs/architecture/vercel-render-neon.md
A docs/features/production-build-selection/plan.md
A docs/features/production-build-selection/reviews/spec-r1.md
A docs/features/production-build-selection/reviews/spec-r2.md
A docs/features/production-build-selection/spec.md
M docs/features/production-build-selection/status.md
A docs/features/production-build-selection/tasks.md
A docs/features/production-provisioning/build-log-T7.md
M docs/features/production-provisioning/status.md
```

- This commit mixes the production-provisioning T7 docs + build log with the orchestrator's `status.md` update and the `production-build-selection` feature artifacts. No history rewrite is performed; this note is the integration-hygiene record. T8 did not edit any of these files.

## Guard resolution and final in-place run

### Prior blocked-state history (resolved)

The first T8 pass was blocked by `build-log-T1.md:244`, which recorded the public npm maintainer address from an `npm ci` deprecation warning; the strict T8 guard expands `build-log-*.md`, so it matched that line. The in-place block also stopped at the orchestrator-owned dirty `status.md`. A clean-worktree run exited 0 only because `set -e` ignores a failed `! grep` pipeline, while the address guard itself still reported the T1 match. Those observations were recorded in the earlier revision of this log and remain the audit history.

### T1 sanitization

- Commit `37d3a54` (`chore: redact npm maintainer address in T1 build log`) changed exactly one line in `build-log-T1.md`; line 244 now ends `... contacting <address>`.
- `build-log-T1.md` and all other provisioning build logs are address-free.
- Direct guard proof (not masked by `set -e` or `! grep`): `grep -qE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|[0-9a-f]{32,}' docs/features/production-provisioning/build-log-*.md` → `ADDRESS_GUARD_GREP_EXIT=1`, `ADDRESS_GUARD_OUTPUT=EMPTY`. A plain `grep` with no match exits `1`, so the negated `! grep` guard now exits `0` because the build-log set is genuinely empty.

### Status authorization

- The orchestrator explicitly authorized committing its unchanged `docs/features/production-provisioning/status.md` with this log in the final integration commit. The builder did not edit the file's content: `status.md committed unchanged under orchestrator authorization`.
- The final integration commit contains exactly two files: `docs/features/production-provisioning/status.md` and `docs/features/production-provisioning/build-log-T8.md`.

### Final in-place exact block

After the integration commit (clean `status.md` and the sanitized T1 log), the exact T8 block was extracted to `/tmp/opencode/t8/t8-verify.sh` and run from the repository root with the documented smoke-provider fallback (`PODMAN_COMPOSE_PROVIDER=/tmp/opencode/pcvenv/bin/podman-compose`). Raw tail:

```text
$ PODMAN_COMPOSE_PROVIDER=/tmp/opencode/pcvenv/bin/podman-compose bash -x /tmp/opencode/t8/t8-verify.sh
...
+ test -z ''
++ git status --porcelain -- docs/features/README.md docs/features/production-provisioning/status.md
+ test -z ''
++ git status --porcelain -- '.env*'
+ test -z ''
+ grep -qF 'stale-production-scan: PASS' docs/features/production-provisioning/build-log-T8.md
+ grep -qF 'allowlist: historical AWS/Fly only' docs/features/production-provisioning/build-log-T8.md
+ grep -qF 'production-provisioning | Production Environment Provisioning | accepted | 2026-11-27' docs/features/production-provisioning/build-log-T8.md
+ grep -qE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|[0-9a-f]{32,}' docs/features/production-provisioning/build-log-T1.md ... docs/features/production-provisioning/build-log-T8.md
+ grep -qE 'xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|...' docs/features/production-provisioning/build-log-*.md
...
+ grep -qE 'postgres(ql)?://[^"'"'"' ]+:[^"'"'"' ]+@' docs/features/production-provisioning/build-log-T8.md
FINAL_VERIFY_EXIT=0
```

- `SMOKE PASS (29/29 checks)` (fallback provider), `vercel.json: valid JSON`, `render.yaml: one development service, unchanged`, `deploy.yml: dispatch choices, automatic path and job count unchanged` and `DEPLOYED SMOKE PASS (8/8 checks)` all appear in the run.

- The full block ran `npm ci`, lint, typecheck, tests, `npm run coverage`, build, the local smoke (29/29 via the fallback), `actionlint`, the Vercel/Render/dispatch parses, the T6a diff guard, both Brevo fixtures, the deployed smoke (8/8), the build-log content checks and the credential audits.
- The address/hex guard was checked directly as above; the green block is therefore genuine, not a `set -e`/`! grep` artifact.

## Acceptance audit

- **AC-1 — production resource names carry no environment token.** Met: Render `cubeclicker` / `https://cubeclicker.onrender.com`, Vercel `cubeclicker` / `https://cubeclicker.vercel.app`; the Neon branch and GitHub Environment are named `production` as environment identifiers only; no `cubeclicker-production` resource exists.
- **AC-2 — Neon production branch reused, migrated and zero-data.** Met (T2) and re-read: `br-floral-dream-zarerhtw` is the project-default primary branch, `parent: none`, `primary: true`, `default: true`, `protected: false`, ready; the seven migrations were applied in T2 and the live migration step reports no pending migrations; the four application tables are zero-row (T2 evidence).
- **AC-3 — Vercel production project.** Met: `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH`, root request `src/frontend`, `framework: vite`, Node `24.x`, auto-deploy off, SSO/password protection off, domain `https://cubeclicker.vercel.app`, exactly one live production deployment `dpl_2wFeBSaUSxYKkhpNtqZGFcby1Duq`.
- **AC-4 — Render production service and runtime configuration.** Met: `srv-dc4mjd15efls739ua63g`, docker/free/frankfurt/main, one instance, autoDeploy off, no health check, 15 service env names (T4 record), no `RENDER_API_KEY`/`RENDER_SERVICE_ID`; the live deploy is `dep-dc4o1fff3r2c73c4asp0` (`live`).
- **AC-5 — GitHub production Environment catalog and protection; development untouched.** Met: 15 variables / 8 secrets; `SMTP_USER` secret-only; `main`-only custom branch policy; `required_reviewers` naming the owner with `prevent_self_review: false`; `development unchanged: PASS` with identical names/protection and no builder write.
- **AC-6 — owner-held and existing secret values never read/recorded.** Met: no secret value read; audits clean; `.env*` untouched; the T8 log contains no credentialed connection string or credential-shaped assignment.
- **AC-7 — one live production deploy proves the path end to end.** Met: `workflow_dispatch` from `main`, guard line, nine `SYNCED` lines, sync summary, no pending migrations, exact health body, Vercel deployment ready, deployed smoke 8/8, Render deploy ID/status, post-run health 200; reproduced in T8 against the live hosts.
- **AC-8 — workflow fix and safe failure handling.** Met: the only `deploy.yml` change is the T6a one-line preflight fix (1 added / 1 removed); no guard bypass or condition/step-order/permission/trigger/concurrency change; the automatic path remains development; no rollback to development and no Neon branch deletion.
- **AC-9 — documentation.** Met (T7): stale statements removed, provisioned/live state documented, exact ledger row present, feature-index row proposed; T8's stale scan is `stale-production-scan: PASS`.
- **AC-10 — static gate and credential-shaped audit.** Met: `actionlint`, the Vercel/Render/dispatch parses, the T6a diff guard, both Brevo fixtures, the credential-shaped audit and the address/hex build-log guard all pass; the direct guard check confirms the build-log set is empty (`ADDRESS_GUARD_GREP_EXIT=1`).
- **AC-11 — partial-failure safety.** Met: production is live; no resource was deleted or rolled back; failed historical attempts were fixed forward (T6 history).
- **AC-12 — dependency and base-branch gate.** Met (T1): `EMAIL_CATALOG`, `EMAIL_TRANSPORT` and `BREVO_API_KEY` are on `main`; the hard dependency is present.
- **T8 task scope.** Met: the earlier T1 address match is resolved (`37d3a54`), the integrator-owned `status.md` is committed unchanged under orchestrator authorization, and the final in-place exact block returns `FINAL_VERIFY_EXIT=0`. No production/provider/workflow/application change and no `git push`.

## Raw gate excerpts

### Tests

```text
 Test Files  83 passed (83)
      Tests  2867 passed (2867)
   Duration  4.72s
```

### Build budget

```text
initial files=2 raw=332912 gzip=102616 budget=150000
three assets/three-Ddozhxko.js raw=610563 gzip=154647 budget=165000
total files=6 raw=1027045 gzip=287223 budget=300000
Bundle budget OK.
```

### Smoke fallback tail

```text
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-2xID-oc4.js is served gzip with immutable caching — content-encoding gzip; 111279 B decompressed
PASS prod /assets/three-Ddozhxko.js is served gzip with immutable caching — content-encoding gzip; 610563 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (29/29 checks)
```

## Verify summary

- In place after the final integration commit: the exact T8 block returns `FINAL_VERIFY_EXIT=0`; the `status.md`/`README.md` no-edit check passes because `status.md` is committed unchanged under orchestrator authorization.
- The address/hex build-log guard is genuinely satisfied: `ADDRESS_GUARD_GREP_EXIT=1` and `ADDRESS_GUARD_OUTPUT=EMPTY` on the direct (non-negated) command, so the green block is not a `set -e`/`! grep` artifact.
- All block components are green: lint, typecheck, tests, `npm run coverage`, build, smoke (29/29 via the documented fallback), the T6a diff guard, the parses, both fixtures, the credential-shaped audits, the stale scan and the live-proof reproduction.
- `No application code change`; no provider write, deploy dispatch, resource deletion or rollback; no `git push`.
- Final integration commit: `docs/features/production-provisioning/status.md` (unchanged; orchestrator-authorized) + `docs/features/production-provisioning/build-log-T8.md`; no other files.
