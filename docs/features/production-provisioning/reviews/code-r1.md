---
feature: production-provisioning
phase: code
round: 1
iteration: 1
verdict: approved
blocking: 0
nonblocking: 4
---
# Code Review — r1

## Summary

✅ **approved** — The production provisioning is verified end to end: the reused Neon `production` branch is migrated and zero-data, the Vercel and Render resources match the naming/resource contract, the GitHub `production` Environment carries the 15-variable / 8-secret catalog with `main`-only branch protection and required reviewers, and the `workflow_dispatch` live proof (`46004355405`) passed every required line including nine `SYNCED` lines, `No pending migrations.`, `healthz OK after 0s: {"status":"ok"}` and `DEPLOYED SMOKE PASS (8/8 checks)`.

The one blocking documentation defect (F1) was corrected by `bad1c52`: the strict SMTP port guard is now documented as development-only, with production on the safe `2525`/`false` pair without the guard and Q-2 explicitly open. No open BLOCKER or MAJOR remains. Four non-blocking notes are recorded for backlog/orchestrator cleanup.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 — production resource names carry no environment token | ✅ | Live read-backs: Render `cubeclicker` / `https://cubeclicker.onrender.com`; Vercel `cubeclicker` / `https://cubeclicker.vercel.app`; Neon branch and GitHub Environment `production` are environment identifiers; `grep -Ei 'production|prod|dev|staging|stage'` over the recorded display names/hosts returns no match; no `cubeclicker-production` resource. |
| AC-2 — existing Neon `production` branch reused, migrated, zero application data | ✅ | Live `list_branches`: `br-floral-dream-zarerhtw`, `primary: true`, `default: true`, parent none; `development` = `br-ancient-smoke-za1pdv7w` distinct and present. Live read-only SQL on the production branch: `schema_migrations: 7` with the seven exact names; `users: 0`, `sessions: 0`, `verification_tokens: 0`, `user_economy: 0`. T2 records pooled `-pooler`/direct hosts with `sslmode=require` and real `pg` connections. No create/delete/branch-from-development. |
| AC-3 — Vercel production project mirrors the development build | ✅ | Live `get_project`: `cubeclicker`, `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH`, domain `cubeclicker.vercel.app`, `framework: vite`, Node `24.x`, SSO/password protection off; latest deployment `dpl_2wFeBSaUSxYKkhpNtqZGFcby1Duq` `READY` target `production`. Distinct from development `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV`; T3 created zero deployments. |
| AC-4 — Render production service and runtime configuration | ✅ | Live `get_service`: `cubeclicker`, `srv-dc4mjd15efls739ua63g`, `https://cubeclicker.onrender.com`, docker, `./src/backend/Dockerfile`, context `.`, `plan: free`, `frankfurt`, `main`, one instance, `autoDeployTrigger: off`, no health check, not suspended. T4 records the accepted 15-key replace-all write (8 committed + 7 dashboard-owned) and the deploy-hook owner hand-off. The Render MCP has no environment-read tool (accepted limitation); T6’s nine-name sync, deploy, health poll and smoke are the functional proof. `RENDER_API_KEY`/`RENDER_SERVICE_ID` are not service variables. |
| AC-5 — exact 23-name catalog, protection, development untouched | ✅ | Live listings: 15 variables / 8 secrets with the exact names; `SMTP_USER` is secret-only. Exact builder values read back: `SMTP_PORT=2525`, `SMTP_SECURE=false`, `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_CONNECTION_TIMEOUT_MS=10000`, `EMAIL_TRANSPORT=brevo-api`, `MAX_USERS_PER_SERVER=10`, `SESSION_COOKIE_SECURE=true`, `SESSION_COOKIE_SAMESITE=none`, `FRONTEND_ORIGIN=https://cubeclicker.vercel.app`, `VITE_API_URL=https://cubeclicker.onrender.com`, `VITE_WS_URL=wss://cubeclicker.onrender.com/ws`, `VERCEL_ORG_ID=team_7cz2iixGr020Vqvjhj7Y1DNp`, `VERCEL_PROJECT_ID=prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH`, `RENDER_SERVICE_ID=srv-dc4mjd15efls739ua63g`. Protection read-back: `custom_branch_policies: true`, exactly one `main` policy, `required_reviewers` naming owner `raultorres2603` with `prevent_self_review: false`. Development remains 15/8, unprotected; pre/post names match. |
| AC-6 — owner-held/existing secret values never read or recorded | ✅ | Credential-shaped, key-shape (`xsmtpsib-`, `xkeysib-`, `rnd_`, `FlyV1`), address/hex and connection-string guards return no match over the feature build logs; repository credential-shaped audit returns no match; `.env*` status and base diff are empty. No `gh secret get`, no development secret copy and no value comparison in the logs. Owner-held names were verified by name only; provider-generated Neon URLs were handled in process. |
| AC-7 — one live production deploy proves the path end to end | ✅ | Run `46004355405`: `workflow_dispatch`, `main`, head `d10dfb1`, `completed/success`, URL `https://github.com/raultorres2603/CubeClicker/actions/runs/46004355405`. Verified from the run log: exact guard line `Deploy configuration OK: 11 value(s) present for the 'production' environment.`; exactly nine `SYNCED … (value verified, not shown)` lines and `Synced 9 value(s) to Render service srv-dc4mjd15efls739ua63g for the 'production' environment.`; `No pending migrations.`; `healthz OK after 0s: {"status":"ok"}`; Vercel `vercel deploy --prebuilt --prod --yes`; `DEPLOYED SMOKE PASS (8/8 checks)`; no `DEPLOYED SMOKE FAIL`. Deployed smoke independently re-run at review time → 8/8. `Render deploy: dep-dc4o1fff3r2c73c4asp0 live`; `Vercel deployment: dpl_2wFeBSaUSxYKkhpNtqZGFcby1Duq ready`; post-run `/healthz` 200. The anchored `production frontend:`/`production api:` lines are recorded. |
| AC-8 — development path and production trigger unchanged | ✅ | Development Environment remains 15/8 with no protection, and the development Neon branch, Vercel project `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV` and Render service `srv-dbtcvv9srm7s73au5bag` remain present and distinct; development `/healthz` returned 200 after its free-instance cold start. `deploy.yml` has exactly the T6a one-line `--repo "$GITHUB_REPOSITORY"` change in the pre-checkout `gh run list`; guard condition, step `if`, order, permissions, triggers and concurrency unchanged; no push trigger; automatic path still resolves to development. No rollback to development; no deletion of the existing Neon production branch; production read-backs are recorded. |
| AC-9 — documentation matches the live production state | ✅ | The stale production-unprovisioned/placeholder-only/unprotected strings are absent from `README.md`, `deployment.md`, `vercel-render-neon.md`, `email.md`, `observability.md` and `AGENTS.md`; the final six-doc scan returns only allowlisted historical/superseded lines. Positive statements, the 23-name catalog, the 11/9 split, `main`-only policy/reviewers, the manual command, live proof, cost/limits and the ledger row are present in both architecture references. The proposed feature-index row is recorded in `build-log-T7.md`; `docs/features/README.md` was not edited. **F1 correction (`bad1c52`)** now states: “For development, the strict SMTP port guard requires `SMTP_PORT=2525` with `SMTP_SECURE=false`; production carries the same safe `2525`/`false` pair without the guard, and extending the guard to production remains open (Q-2).” The old “for both deployed environments” phrase is absent from the six docs. T7 records `F1_VERIFY_EXIT=0` and the correction in `build-log-T7.md` § Code-review correction (F1). |
| AC-10 — feature-appropriate verification gate | ✅ | Pinned actionlint `1.7.12` passes (independently run from the pinned image’s 1.7.12 binary; the Podman wrapper itself was blocked by host storage damage). `vercel.json` valid JSON; `render.yaml` one `cubeclicker-development` service unchanged; `deploy.yml` dispatch/automatic-path/job-count parse passes; both Brevo guard fixtures pass with exact expected output; T6a PR diff is exactly 1 added / 1 removed content line with the authorized `gh run list --repo "$GITHUB_REPOSITORY"` line. No application/test/migration/Dockerfile/compose/package/lockfile change. Frontend coverage 97.22 / 96.79 / 98.6 / 97.22; T8 records backend 97.09 / 92.24 / 99.65 / 97.09, 2,867 tests and local smoke 29/29 via the documented provider fallback. The reviewer’s full backend/coverage/local-smoke rerun was blocked by host Podman storage damage, not by a test assertion or code change (F5). |
| AC-11 — failure cleanup and safe retention | ✅ | Partial failures were fixed forward (T6a preflight, Brevo REST key, Vercel token); no production resource was deleted, suspended or repointed to development; the pre-existing Neon branch is retained; `No rollback to development` and `No deletion of the existing Neon production branch` are recorded. Cleanup scope is limited to the Render/Vercel resources this feature created. |
| AC-12 — dependency and ordering honest | ✅ | T1 verifies `EMAIL_CATALOG` in `src/backend/src/deploy/render-env.ts` and `EMAIL_TRANSPORT`/`BREVO_API_KEY` in `deploy.yml` on `origin/main`; the live deploy is from `main` at `d10dfb1` after T6a merged. `registration-account-exists` Q-2 remains open and the production `SMTP_PORT=2525`/`SMTP_SECURE=false` pair is documented as safe without a guard-code change. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR (resolved) | `README.md:351`; `docs/architecture/vercel-render-neon.md:175` | The docs originally claimed the strict SMTP port guard applied “for both deployed environments,” but `src/backend/src/deploy/render-env.ts:271-288` returns `{ ok: true }` for any `TARGET_ENVIRONMENT !== 'development'`; the spec keeps `registration-account-exists` Q-2 open and does not extend the guard. This falsely implied a production safety control. **Resolved by `bad1c52`**: both docs now state the guard is development-only, production uses the same safe `2525`/`false` pair without the guard, and extending it remains open (Q-2); `build-log-T7.md` records the correction and `F1_VERIFY_EXIT=0`. The old “for both deployed environments” phrase is absent from the six docs. | None; correction verified. | fixed |
| F2 | MINOR | `docs/features/production-provisioning/status.md` “Blockers / open questions” | Stale orchestrator-owned bullets remain (“T8 currently has a long-hex build-log guard…”, “The live T6 proof remains”, “T5 must re-read/derive…”), and the loop log calls `46004355405` the “sixth attempt” while `build-log-T6.md` correctly records it as the seventh successful attempt (the sixth was `46003860223`, failed). | Orchestrator status cleanup; no builder action. | open (non-blocking) |
| F3 | MINOR/INFO | `build-log-T8.md:32-33` / static-gate evidence | AC-10(b) names a `ci.yml` dispatch parse; the T8 exact block and “Full gate” table cite the `deploy.yml` dispatch parse but not an explicit `ci.yml` parse. CI’s `verify-workflows` job covers the workflow parses on the merge-SHA run; the T8 narrative should cite that job or add the parse to the final gate. | Backlog: cite `verify-workflows` or add the explicit `ci.yml` parse. | open (non-blocking) |
| F4 | INFO | `3277661`; `f29bcc6` | `3277661` mixes the six T7 docs, `build-log-T7.md`, orchestrator `status.md` and a concurrent feature’s `production-build-selection` artifacts; both `3277661` (“docs”) and `f29bcc6` (“verifying docs”) are non-conventional commit messages. The mix and the T7/T8 integration-hygiene note are documented; no history rewrite is appropriate. | No history rewrite; note for future orchestration batches. | accepted (non-blocking) |
| F5 | INFO | Host verification environment | The reviewer’s independent full backend `npm test`/`npm run coverage`, actionlint-via-Podman and local `npm run smoke` reruns were blocked by host Podman storage damage: `allocating lock for new container: allocation failed; exceeded num_locks (2048)` and `podman system check` → “damage detected in local storage.” Non-container backend tests passed 2,058; frontend and coverage passed; deployed smoke passed 8/8; actionlint 1.7.12 was independently run from the pinned image binary. T8 records the full green run and the code is unchanged. | Environment limitation only; rerun the full suite/smoke when Podman is healthy or retain the T8 evidence. | accepted (non-blocking) |

**Accepted limitation (not counted): F6 — Render MCP has no environment-variable read tool.** T4’s accepted 15-key replace-all write is the environment record, and T6’s nine-name sync/deploy/health/smoke is the functional proof. The spec explicitly accepts this limitation; no action.

## Verification performed

- `gh run view 46004355405 --json event,headBranch,headSha,status,conclusion,createdAt,updatedAt,url` → `workflow_dispatch` / `main` / `d10dfb1…` / `completed` / `success`; run URL recorded.
- `gh run view 46004355405 --log` → exact guard line, exactly 9 `SYNCED … (value verified, not shown)` lines, `Synced 9 value(s) to Render service srv-dc4mjd15efls739ua63g …`, `No pending migrations.`, `healthz OK after 0s: {"status":"ok"}`, `DEPLOYED SMOKE PASS (8/8 checks)`, no `DEPLOYED SMOKE FAIL`, `vercel deploy --prebuilt --prod --yes`.
- `gh variable list --env production` / `gh secret list --env production` → 15 variables / 8 secrets, exact name sets.
- `gh variable get` for the 14 builder-set variables → exact values recorded; `SMTP_FROM` present by name only, never read.
- `gh api repos/.../environments/production` → `custom_branch_policies: true`, exactly one `main` policy, `required_reviewers` owner `raultorres2603`, `prevent_self_review: false`.
- Development Environment listings → 15 variables / 8 secrets, no protection; identities of the development Neon branch, Vercel project and Render service unchanged.
- Neon `list_branches` → `production` `br-floral-dream-zarerhtw` primary/default; `development` `br-ancient-smoke-za1pdv7w` present.
- Neon read-only `run_sql` → `schema_migrations: 7` with the seven exact names; four application tables zero rows.
- Vercel `get_project` → `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH`, domain, framework/Node, protection off, latest `dpl_2wFeBSaUSxYKkhpNtqZGFcby1Duq` `READY`/`production`.
- Render `get_service` → `srv-dc4mjd15efls739ua63g`, docker/free/frankfurt/main, one instance, auto-deploy off, no health check, not suspended.
- `node tests/e2e/deployed-smoke.mjs` against the anchored production URLs → `DEPLOYED SMOKE PASS (8/8 checks)`; `/healthz` 200 exact body; production `/metrics` 404.
- Pinned actionlint `1.7.12` → exit 0; `vercel.json` parse → valid JSON; `render.yaml` parse → one development service unchanged; `deploy.yml` parse → dispatch choices/automatic path/job count unchanged.
- Brevo fixtures: development 11 values → exact success line; production 6 placeholders → exit 1 with exact block.
- Address/hex build-log guard → direct grep exit 1, no output; credential-shaped and key-shape audits → no matches; `.env*` status/diff empty.
- `git diff --name-only d10dfb1..HEAD -- src tests compose.yaml compose.smoke.yaml package.json package-lock.json` → empty; no application/test/container/lockfile change.
- Frontend `npm run coverage` → 97.22 / 96.79 / 98.6 / 97.22 (thresholds 80 unchanged); backend non-container tests 2,058 passed; T8 records backend coverage 97.09 / 92.24 / 99.65 / 97.09 and local smoke 29/29.
- `git show bad1c52` → exactly three files (`README.md`, `vercel-render-neon.md`, `build-log-T7.md`); corrected rule present in both docs; `grep -RF 'for both deployed environments'` over the six docs → no match; T7 log records `F1_VERIFY_EXIT=0`.
- `git show --stat 3277661` → six T7 docs + `build-log-T7.md` + orchestrator `status.md` + `production-build-selection` spec/plan/tasks/reviews/status; documented integration-hygiene note; no source change.

No new live provider call was made for this closure; the evidence above is the prior review’s read-only provider/GitHub verification plus the corrected-doc check.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | Secrets are names-only; no credential, hook or connection string appears in the logs or tree; `.env*` untouched; production protection (`main`-only + required reviewers) is active; the guard documentation is now development-only and Q-2 remains open; no production resource points at development. |
| Quality | ✅ | Exact one-line `deploy.yml` fix, actionlint 1.7.12, config parses, provider read-backs and live proof; no application/test/container changes; docs match the live state after `bad1c52`. |
| Testing | ✅ (environment caveat) | Feature-appropriate proof: live deploy `46004355405`, deployed smoke 8/8 re-run independently, provider/GitHub read-backs, both Brevo fixtures, actionlint/parses and credential audits. Full backend/coverage/local-smoke rerun was blocked by host Podman storage damage (F5); T8 records the green run and no code changed. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| Spec r2 F28 — T7 duplicate guards omit `FlyV1` | open (non-blocking, spec backlog) | T8 full key-shape audits include `FlyV1`; no Fly token present. Not a code-gate blocker. |
| Spec r2 F29 — spec table `SMTP_FROM` how-cell wording | open (non-blocking, spec backlog) | Spec-only wording; T5a/T5 behavior is correct. |
| Spec r2 F30 — T8 allowlist slightly broad | open (non-blocking, spec backlog) | Final scan returns only historical/superseded hits; no current-state production claim remains. |
| Code review F1 (this round) — false “both deployed environments” guard claim | fixed | `bad1c52`; corrected rule quoted in AC-9; old phrase absent from all six docs; T7 log records `F1_VERIFY_EXIT=0`. |

## Notes / backlog (non-blocking)

- **F2** — Orchestrator-owned `status.md` retains stale T5/T6/T8 bullets and mislabels `46004355405` as the sixth attempt; cleanup only, no builder edit.
- **F3** — Cite the `ci.yml` dispatch parse from `verify-workflows` in the T8 evidence, or add it to the final gate.
- **F4** — `3277661` integration-hygiene mix and non-conventional commit messages; documented and accepted, no history rewrite.
- **F5** — Host Podman storage damage is an environment limitation; re-run backend coverage and local smoke when healthy if desired.
- **F6** — Render MCP environment-variable read limitation is accepted; T4’s replace-all write and T6’s functional proof are the evidence.

## Verdict

✅ **approved** — 0 blocking, 4 non-blocking. All AC-1–AC-12 are met; the only prior MAJOR (F1) is fixed by `bad1c52`; the remaining items are status cleanup, evidence-citation, commit-hygiene and environment-limitation notes.
