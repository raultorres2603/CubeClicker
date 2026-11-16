---
feature: render-backend-migration
phase: code_review
round: 2
iteration: 2
verdict: approved
reviewed: 2026-11-16
blocking: 0
nonblocking: 5
---
# Code Review — r2

## Summary

✅ **approved** — 0 blocker, 0 major, 2 minor, 3 info. The r1 blocking items are fixed and independently verified:

- `74e0b60` and `0d802e4` are ancestors of `origin/main` (`ac8396d`); remote docs describe **Vercel + Render + Neon**, `render.yaml` and `vercel-render-neon.md` are present, and `vercel-fly-neon.md` carries the SUPERSEDED banner.
- `verify-workflows` now runs `Setup Node` + `npm ci` before the `js-yaml` Render step; CI run `43863104962` is green and the `Validate Render blueprint` step passed.
- `render.yaml` declares no `healthCheckPath`; the live Render service has `healthCheckPath: ""`; the docs/CI say Render has no platform health check, and the Deploy workflow polls `/healthz`.
- The production Environment is documented honestly as unprovisioned, unprotected and manual; the actual `gh api` state still has no protection rules, matching the docs.
- `AGENTS.md`, `ci.yml`, `deployment.md`, `vercel-render-neon.md` and `README.md` now use the `main` → development model and state that there is no `develop` branch.

Live proof is green: Render `/healthz` returns 200 `{"status":"ok"}` and `/metrics` 404; the Vercel root is a 200 `no-cache` app shell with SSO disabled; Render deploy `dep-dbtf3s8ae00c73d8dstg` is `live` at `ac8396d`; Vercel deployment `dpl_68pi3FkrwRVBGk35kYSXqgitu2HL` is `READY` at `ac8396d`; the deployed smoke was independently rerun and passes **8/8**. CI `43863104962` ran the full gates once on `main`; Deploy `43863511736` followed the successful `workflow_run` with no lint/typecheck/test/coverage and no `vercel alias` step.

The remaining findings are non-blocking: F5 (stale blocker line in `status.md`), F7 (stale Fly source comments), F8 (historical build-log sections still cite the pre-fix state), F9 (CI smoke uses `docker compose` while local uses Podman) and F10 (the Render hook builds the branch tip, not the CI SHA). The local long-running `npm run smoke` stack was stale and is not counted as a pass; the CI fresh-stack smoke and the live deployed smoke are green (see Verification performed).

No formal `spec.md`/`plan.md`/`tasks.md` exists (`spec_review_round: 0`); this review is against the user's deployment request and the documented Vercel + Render + Neon contract.

## Request / documented-contract verification

| # | Requirement | Met? | Evidence |
| --- | --- | --- | --- |
| 1 | Render `/healthz` live | ✅ | `GET https://cubeclicker-development.onrender.com/healthz` → 200 `{"status":"ok"}`; `GET /metrics` → 404; Render MCP `get_service` reports `plan: free`, `region: frankfurt`, `suspended: not_suspended`. |
| 2 | Vercel root shell live / deployment READY | ✅ | `GET https://cubeclicker-development.vercel.app/` → 200 `text/html`, `cache-control: no-cache`, 492-byte shell with `id="root"`; Vercel MCP `get_project` reports `ssoProtection.enabled: false`; latest deployment `dpl_68pi3FkrwRVBGk35kYSXqgitu2HL` is `READY`, target `production`, commit `ac8396d`. |
| 3 | Deployed smoke 8/8 | ✅ | Independently rerun with the pinned `SMOKE_*` recipe → `DEPLOYED SMOKE PASS (8/8 checks)`, exit 0; covers health, allowed/disallowed CORS, SPA root/deep link, real `/assets/*` 404, WebSocket hello/join/explode and the pre-upgrade disallowed-Origin 403. The Deploy run log also shows `DEPLOYED SMOKE PASS (8/8 checks)`. |
| 4 | Render deploy and Vercel deployment live/READY | ✅ | Render MCP `list_deploys` → `dep-dbtf3s8ae00c73d8dstg` `live`, commit `ac8396d`; Vercel latest deployment `dpl_68pi3FkrwRVBGk35kYSXqgitu2HL` `READY`, commit `ac8396d`. |
| 5 | Remote docs no longer present Fly as active; T3 pushed | ✅ | `74e0b60` and `0d802e4` are ancestors of `origin/main` (`ac8396d`); remote `deployment.md:3` says Render runs the backend; remote `vercel-fly-neon.md:1-10` is SUPERSEDED; remote `render.yaml`, `vercel-render-neon.md` and `infra/archive/fly/README.md` are present; remote `README.md` has no active Fly deploy path (only historical/superseded references). |
| 6 | Push `main` → CI once with the full gates and clean Render validation | ✅ | CI run `43863104962` `success`, event `push`, `headBranch: main`, `headSha: ac8396d`; `verify-app` ran Install → Lint → Typecheck → Test → Coverage → Build; `smoke-e2e` ran Start Mailpit → Run smoke → Cleanup; `verify-workflows` ran Setup Node → Install dependencies (`npm ci`) → actionlint → Vercel JSON → `Validate Render blueprint` → no-Fly guard. The Render step output is `render.yaml: valid YAML (cubeclicker-development, docker, free, no platform health check)`. |
| 7 | Deploy after successful CI; no CI rerun; no alias step | ✅ | Deploy run `43863511736` `success`, event `workflow_run`, `headBranch: main`, `headSha: ac8396d`; steps Checkout → Node → `npm ci` → Migrate Neon → Render hook → 45 s wait → `/healthz` poll → Vercel pull/build/deploy `--prod` → warm → deployed smoke. No lint/typecheck/test/coverage, no `workflow_call`, no `vercel alias`; the non-push/manual guards are skipped on `workflow_run`, as designed. |
| 8 | `render.yaml` has no healthCheckPath; docs/CI say Render has no platform health check; workflow polls `/healthz` | ✅ | `render.yaml` has no `healthCheckPath` key; the live service has `healthCheckPath: ""`; `ci.yml:76-78` rejects a non-empty platform health check; `deployment.md:95`, `vercel-render-neon.md:28`, `README.md:156` and the `render.yaml` header state that Render does not probe the service and the Deploy job's `/healthz` poll is the health gate. |
| 9 | F2 clean-job Render validation | ✅ | `ci.yml:59-65` installs Node 24 and `npm ci` before the Render step; CI step `Install dependencies` and `Validate Render blueprint` both succeeded; the T3 log records a clean-checkout check with `js-yaml` 4.3.2. |
| 10 | Production documented as unprovisioned/unprotected/manual | ✅ | `deployment.md:34,37`, `vercel-render-neon.md:45,71`, `README.md:153` say no protection rules, no branch policy, no secrets/variables and manual `workflow_dispatch` only. `gh api repos/raultorres2603/CubeClicker/environments` still shows `production` with `protection_rules: []` and `deployment_branch_policy: null`, and `gh secret/variable list` is empty for production. The docs now match the actual state. |
| 11 | No `develop` branch; `main` → development after CI | ✅ | `ci.yml:5-6` pushes on `main` only; `AGENTS.md:47` defines `main` as the integration branch whose push auto-deploys development; `deployment.md:39,55` and `vercel-render-neon.md:115` state there is no `develop` branch. The deploy trigger is `workflow_run` on `main`. |
| 12 | No secrets committed | ✅ | AWS, connection-string and token `git grep` audits are clean; `render.yaml` has only `sync: false` secret names; GitHub environment listings are names only; no secret value appears in the fix commits or docs. |
| 13 | No live resources changed by the fix | ✅ | The `0d802e4` diff is `ci.yml`, `AGENTS.md`, `README.md`, `deployment.md`, `vercel-render-neon.md`, `render.yaml` and the T3 log; `ac8396d` adds only the r1 review and `status.md`. No application source, compose, Dockerfile, package or lockfile changed. The live Render service settings remain free/Frankfurt/Docker/`src/backend/Dockerfile`/branch `main`/auto-deploy off/`healthCheckPath: ""`; the Vercel project remains SSO-disabled; the Neon branch was not modified by the fix. The push triggered the normal Render/Vercel releases, not a manual provider configuration change. |
| 14 | Containerization contract | ✅ | Compose files, both Dockerfiles, `package.json` and `package-lock.json` are unchanged; `podman compose up` remains the single local command; Render builds the provider-neutral `src/backend/Dockerfile`; `/ws` remains on 8080 and the live WebSocket smoke passes; no new service, port or secret-in-image. The CI `smoke-e2e` job ran the same compose smoke on a fresh stack and passed. |
| 15 | `docs/features/README.md` ownership and protected files | ✅ | `git diff 25c2148..origin/main -- docs/features/README.md compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json` is empty. The builder did not edit the orchestrator-owned index; the T3 log proposes the row. The only working-tree modification is `status.md` (orchestrator-owned; not edited by this review). |
| 16 | Status blockers current (F5) | ⚠️ | `status.md:40-47` now lists the correct remaining limitations (Render spin-down/no platform health check, SMTP guest-only, Vercel SSO dev-only, Neon production unprotected, production unprovisioned/unprotected, backlog). Line 48 is stale: it says the T3 commit and fixes "must be pushed before acceptance; review r1 changes requested", but the commits are on `origin/main` and the post-fix pipeline is green (line 38). F5 remains MINOR. |
| 17 | Source comments no longer present Fly as current (F7) | ⚠️ | `src/backend/src/app.ts:162-163,330`, `src/backend/src/observability/metrics-route.ts:5-6`, `src/backend/src/db/migrate-runner.ts:71` and `src/backend/src/app.test.ts:779` still describe Fly. These are code comments/test names, not active-backend docs; the T3 log records them as backlog. F7 MINOR, non-blocking. |
| 18 | Build logs reflect the final state (F8/F9/F10) | ⚠️ | F8: the T2 log's acceptance audit still cites the alias step and direct push; the T3 log still prints the old `healthCheckPath=/healthz` evidence block and says "No push" at line 214, while `origin/main` contains both commits. F9: CI `smoke-e2e` uses `docker compose` while local uses Podman. F10: the Render deploy hook builds the `main` tip, not the CI SHA. All are non-blocking. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F5 | MINOR | `docs/features/render-backend-migration/status.md:48`; loop log `:37-38` | The blockers section still says the T3 commit and follow-up fixes "must be pushed before acceptance; review r1 changes requested". Both `74e0b60` and `0d802e4` are ancestors of `origin/main` (`ac8396d`), CI `43863104962` and Deploy `43863511736` are green, and the live deployments are at `ac8396d`. The working tree also has an uncommitted post-fix loop-log line 38. | On acceptance, replace line 48 with the post-fix state and keep only the real blockers (SMTP guest-only, Neon production unprotected accepted, production unprovisioned/unprotected, backlog). Commit the working-tree status update. This is orchestrator-owned; the review did not edit it. | open |
| F7 | MINOR | `src/backend/src/app.ts:162-163,330`; `src/backend/src/observability/metrics-route.ts:5-6`; `src/backend/src/db/migrate-runner.ts:71`; `src/backend/src/app.test.ts:779` | The source comments/test suite still say Fly terminates TLS, Fly sets `NODE_ENV=production`, deployed Fly sets `METRICS_ENABLED=false`, Fly receives `DIRECT_DATABASE_URL`, and `trust proxy (Fly)`. The runtime is Render; the comments are stale. They are not docs claiming Fly is the active backend, and the T3 log records them as backlog. | Fix the five comments and the suite name in a small chore (no behavior or assertion change), or record an explicit accepted follow-up in `status.md`. Non-blocking for approval. | open |
| F8 | INFO | `docs/features/render-backend-migration/build-log-T2-workflow.md:483-510`; `build-log-T3-docs.md:32-40,214` | The T2 log's acceptance audit still cites the Vercel alias step and the direct push next step; the T3 log's old evidence block still prints `healthCheckPath=/healthz` and its line 214 says "No push", although both commits are on `origin/main` and CI/Deploy are green. The later T3 fix section supersedes the old claims, but a reader can cite the stale block. | Mark the T2 audit and T3 old evidence as pre-fix historical sections, and record the push/CI/Deploy IDs in the T3 log. No source change. | open |
| F9 | INFO | `.github/workflows/ci.yml:44-50` | CI's `smoke-e2e` job uses `docker compose` while the decided local tooling is Podman/Podman Compose. This is pre-existing and reasonable on GitHub-hosted runners, which ship Docker; it does not change the local `podman compose up` contract or the live result. | No action required for this migration. A separate chore can add Podman parity if the project wants it. | open |
| F10 | INFO | `.github/workflows/deploy.yml:80-105`; `docs/architecture/vercel-render-neon.md:31`; `build-log-T2-workflow.md:17,251` | The deploy job checks out the CI head SHA for the migration/Vercel steps, but the Render deploy hook builds the service's tracked branch (`main`), not the CI SHA. A concurrent push could let the backend build a commit CI did not validate; the 45 s wait, `/healthz` poll and smoke do not assert the commit. The live `ac8396d` run did not hit this race, and the T2 log discloses the hook's branch scope. | If hardening is in scope, pin the Render deploy to the CI SHA via a Render API deploy with the commit (if supported) or add a post-deploy commit check; otherwise document the branch-tip limitation in the runbook. Not blocking. | open |

## Verification performed

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0.
- `npm test` → exit 0: backend 37 files / 1507 tests; frontend 74 files / 2248 tests.
- `npm run coverage` → exit 0: backend 96.15 statements / 89.81 branches / 99.57 functions / 96.15 lines; frontend 96.63 / 96.35 / 97.8 / 96.63; all ≥ 80; no coverage-config, exclusion or threshold diff.
- `npm run build` → exit 0; bundle budget OK; entry `index-NkhNsjDs.js` raw 97,263 B / gzip 29,795 B; three 609,337 / 154,323; total 993,754 / 276,782.
- `podman run --rm -v "$PWD:/repo:Z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml` → exit 0.
- The exact `ci.yml` Render check → `render.yaml: valid YAML (cubeclicker-development, docker, free, no platform health check)`; no-Fly deploy guard → `deploy has no Fly`; both exit 0.
- Local `npm run smoke` was **not counted as a pass**: the long-running local stack was stale (backend `ERR_INVALID_PACKAGE_CONFIG: permission denied` on `/app/src/backend/package.json`; frontend Vite restarted with a localhost-only binding), so the run reported 7/26. The CI `smoke-e2e` job at `ac8396d` ran the same compose smoke on a fresh runner and passed; the live deployed smoke independently passed 8/8. The fix changes no compose, Dockerfile or source; the local containers need recreation. This is a local-environment note, not a repository finding.
- Live Render: `/healthz` → 200 `{"status":"ok"}`; `/metrics` → 404; `get_service` → free, Frankfurt, Docker, `src/backend/Dockerfile`, `dockerContext: .`, branch `main`, auto-deploy off, `healthCheckPath: ""`; `list_deploys` → `dep-dbtf3s8ae00c73d8dstg` `live` at `ac8396d`.
- Live Vercel: root → 200 text/html, `cache-control: no-cache`, 492-byte shell with `id="root"`; `get_project` → `ssoProtection.enabled: false`, latest deployment `dpl_68pi3FkrwRVBGk35kYSXqgitu2HL` `READY` at `ac8396d`; the stable domain is present.
- Deployed smoke: independently rerun with the pinned `SMOKE_*` recipe → `DEPLOYED SMOKE PASS (8/8 checks)`, exit 0; the Deploy run log also shows `DEPLOYED SMOKE PASS (8/8 checks)`.
- CI `43863104962` (`gh run view`): `success`, event `push`, `main`, `ac8396d`; `verify-app` ran Install, Lint, Typecheck, Test, Coverage, Build; `smoke-e2e` ran Start Mailpit, Run smoke, Cleanup; `verify-workflows` ran Setup Node, Install dependencies (`npm ci`), actionlint, Vercel JSON, `Validate Render blueprint` and the no-Fly guard. The Render step output is the clean message above.
- Deploy `43863511736` (`gh run view`): `success`, event `workflow_run`, `main`, `ac8396d`; steps Checkout, Setup Node, Install dependencies, Migrate Neon, Deploy Render backend, Wait for Render deploy to start, Wait for Render backend health, Install Vercel CLI, Pull, Build, Deploy, Warm Render backend, Run deployed smoke. No lint/typecheck/test/coverage, no `workflow_call`, no `vercel alias`.
- Repository/remote: `origin/main` is `ac8396d`; `74e0b60` and `0d802e4` are ancestors; remote `deployment.md` describes Render; remote `vercel-fly-neon.md` is SUPERSEDED; remote `render.yaml`, `vercel-render-neon.md` and `infra/archive/fly/README.md` are present; remote `README.md` has no active Fly deploy path.
- GitHub environments: `development` has the expected names; `production` has no secrets, variables, protection rules or branch policy. The docs now say exactly that (F4 fixed).
- Credential audits: AWS, connection-string and token `git grep` audits are clean; `render.yaml` secret-shaped values are all `sync: false`; no secret value is in the repository.
- Protected files/index: `git diff 25c2148..origin/main -- docs/features/README.md compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json` is empty. No application source, compose, Dockerfile, package or lockfile changed in the fix range.
- No live resource configuration was changed by the fix: the Render service settings remain free/Frankfurt/Docker/`src/backend/Dockerfile`/branch `main`/auto-deploy off/`healthCheckPath: ""`; the Vercel project remains SSO-disabled; the Neon branch was not modified by the fix. The push triggered normal Render/Vercel releases at `ac8396d`.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No secrets committed (audits clean, `sync: false`); Vercel SSO is disabled only for the sole development project; `/metrics` is 404 on the public host; production is unprovisioned and documented as unprotected; no secret or live config was changed by the fix. |
| Quality | ✅ | The CI/deploy workflows have a single clear path; Deploy does not re-run CI and has no alias step; no application source changed; the docs match the live configuration, including the no-platform-health-check and unprotected-production facts. F5/F7/F8 are non-blocking. |
| Testing | ⚠️ | Local lint/typecheck/test/coverage/build, actionlint, the Render check and the no-Fly guard pass; CI’s fresh-stack `smoke-e2e` passes; the live deployed smoke passes 8/8. The local long-running `npm run smoke` stack was stale and is not counted as a pass; this is local container state, not a changed-file regression. |
| Real-time | ✅ | Live `wss://cubeclicker-development.onrender.com/ws` accepts the allowed origin and completes hello/join/explode; the disallowed origin gets HTTP 403 before the upgrade; `/ws` remains on backend port 8080; no new port or proxy change. |
| Containers | ✅ | No compose/Dockerfile/package changes; `podman compose up` remains the single local command; Render builds the provider-neutral `src/backend/Dockerfile`; no secrets in images; `/ws` is exposed; the CI fresh-stack smoke passes. F9 is a pre-existing CI tooling observation. |
| Documentation | ⚠️ | The local docs correctly describe Vercel + Render + Neon, the no-platform-health-check posture, the main-only branch model and the unprotected production environment; the Fly reference is SUPERSEDED. F5 (status blocker line 48), F7 (source comments) and F8 (historical log sections) remain non-blocking. |
| Pipeline | ✅ | CI runs once on `main` with all gates, including the clean-job Render validation; Deploy follows the successful `workflow_run`, does not re-run lint/typecheck/test/coverage and has no `vercel alias`; production is manual and unprovisioned. F10 is a residual branch-tip limitation, documented as INFO. |
| Live deployment | ✅ | Render `/healthz`, `/metrics` 404, the Vercel shell and the deployed smoke all pass; Render and Vercel are live/READY at `ac8396d`; the live service matches `render.yaml` on the no-health-check configuration. |
| Out-of-scope edits | ✅ | The fix touches only `ci.yml`, `AGENTS.md`, `README.md`, `deployment.md`, `vercel-render-neon.md`, `render.yaml` and the T3 log; `ac8396d` adds only the r1 review and `status.md`. No application source, compose, Dockerfile, package, lockfile or provider configuration changed. The feature index is untouched; `status.md` is orchestrator-owned and not edited by this review. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| r1 F1 — T3 unpushed; remote docs Fly-active | ✅ fixed | `74e0b60` and `0d802e4` are ancestors of `origin/main` (`ac8396d`); remote docs describe Render; `vercel-fly-neon.md` is SUPERSEDED; remote `render.yaml`/`vercel-render-neon.md` are present; live deployments are at `ac8396d`. |
| r1 F2 — `verify-workflows` lacked `npm ci` for `js-yaml` | ✅ fixed | `ci.yml:59-65` installs Node 24 and `npm ci`; CI `43863104962` step `Validate Render blueprint` passed with the clean message; the T3 log records `js-yaml` 4.3.2 in a clean checkout. |
| r1 F3 — `render.yaml` `/healthz` vs live `""` | ✅ fixed | `render.yaml` has no `healthCheckPath` key; live `get_service` has `healthCheckPath: ""`; docs/CI state Render has no platform health check; the Deploy workflow polls `/healthz`. |
| r1 F4 — false production reviewer claim | ✅ fixed | `deployment.md:34,37`, `vercel-render-neon.md:45,71` and `README.md:153` say production is unprovisioned and unprotected; `gh api` shows no protection rules and no branch policy; the docs match the actual state. |
| r1 F5 — stale status blockers | ⚠️ partial | The blockers section is largely correct, but `status.md:48` still says the commits "must be pushed" and "review r1 changes requested"; the post-fix line 38 is uncommitted. F5 remains MINOR. |
| r1 F6 — `develop` branch model conflict | ✅ fixed | `ci.yml:5-6` pushes on `main` only; `AGENTS.md:47` defines `main` as the integration branch; `deployment.md:39,55` and `vercel-render-neon.md:115` state there is no `develop` branch; no `develop` trigger remains. |
| r1 F7 — stale Fly source comments | ⚠️ open | The five source comments/suite name still name Fly; T3 log backlog. Non-blocking. |
| r1 F8 — T2 log staleness | ⚠️ open | The T2 acceptance audit still cites the alias step/direct push; the T3 log old evidence block and line 214 "No push" are stale. Non-blocking. |
| r1 F9 — CI Docker Compose vs Podman | ⚠️ open | `ci.yml:44-50` still uses `docker compose`; pre-existing and appropriate for GitHub-hosted runners. INFO. |
| r1 F10 — Render hook builds the branch tip | ⚠️ open | `deploy.yml:80-105` triggers a branch build; the live `ac8396d` run did not hit a race. INFO. |

## Acceptance actions

- Set `docs/features/render-backend-migration/status.md` to `state: accepted`, `updated: 2026-11-16`, mark T5 complete, and replace the stale blocker line 48 with the post-fix state. Keep the real limitations: SMTP guest-only, Neon production unprotected accepted, production unprovisioned/unprotected, and the backlog. Commit the working-tree post-fix loop-log line 38.
- Add the `render-backend-migration` row to the orchestrator-owned `docs/features/README.md` with `accepted` and `2026-11-16`; the T3 log's proposed row is the basis, but apply it only now that the review is approved.
- Commit this r2 review artifact (`docs/features/render-backend-migration/reviews/code-review-r2.md`).
- Optional follow-ups: F7 source comments, F8 log cleanup, F9 CI Podman parity, F10 branch-tip documentation or SHA-pinned deploys.
- No existing source, tests, spec, plan, tasks, status, docs, configs or live resources were edited by this review; only `docs/features/render-backend-migration/reviews/code-review-r2.md` was written.
