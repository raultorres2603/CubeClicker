# Build log — T6 — Live production deploy proof

Task: T6 (2026-11-27; fifth live attempt after the owner re-saved the production `BREVO_API_KEY` as a REST key)
Files changed: `docs/features/production-provisioning/build-log-T6.md` (only; no application code, workflow, provider asset, architecture doc, `status.md` or `docs/features/README.md` edit)
What changed & why: The metadata gate passed (`BREVO_API_KEY.updated_at` advanced to `2026-11-27T12:49:02Z`), and the fifth dispatch passed the CI preflight, the eleven-name guard, the Neon migration, the nine-name Render sync, the Render deploy hook, the `/healthz` poll and the Brevo API-transport runtime probe. It then failed at `Pull Vercel project settings` with `Error: Project not found` for the correct production project/org IDs, so the frontend deploy and deployed smoke did not run. The live proof is blocked on the owner-held production `VERCEL_TOKEN`, which cannot see the team/project; no Vercel deployment exists yet. No rollback or deletion was performed. Prior failed runs are retained as history.
Decisions: Approval used the authenticated owner session through the GitHub API (fifth time); the guard was not bypassed, no development dispatch was made by this task, no rollback was performed and the pre-existing Neon branch was not deleted. The builder did not read, copy or set any secret value. Because the failure is in the owner-held `VERCEL_TOKEN`, no further production dispatch is made until the owner replaces it.
Testing note: T6 is the feature's live-proof infrastructure task per `tasks.md` (provider/GitHub state plus a build log; no application code). The feature-appropriate end-to-end proof is the workflow run with the deployed smoke; the backend half succeeded (migration, sync, Render deploy, health, Brevo probe) but the frontend half did not run. No repository unit/integration test boundary exists for the live deploy, and T8 owns the full repository suite/no-regression gate.

## Status: BLOCKED — production `VERCEL_TOKEN` cannot see the team/project

- The required metadata gate passed: `GET /repos/raultorres2603/CubeClicker/environments/production/secrets/BREVO_API_KEY` returned `created_at: 2026-11-27T11:36:46Z`, `updated_at: 2026-11-27T12:49:02Z` — advanced past `2026-11-27T11:36:46Z`.
- `origin/main` is still `d10dfb1`; merge-SHA CI run `45997877865` is `completed` / `success`.
- Fifth attempt `run_id=46001870210` passed the repaired `Verify CI succeeded for target commit` guard (`CI succeeded for d10dfb1`), the eleven-name guard, the migration, the sync, the Render deploy and the health poll, then failed at `Pull Vercel project settings`:
  `Error: Project not found ({"VERCEL_PROJECT_ID":"prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH","VERCEL_ORG_ID":"team_7cz2iixGr020Vqvjhj7Y1DNp"})`
- The production Vercel project exists and is visible through the Vercel API/MCP: `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH` (`cubeclicker`) belongs to `team_7cz2iixGr020Vqvjhj7Y1DNp`; it has `latestDeployment: null` and `0` deployments. The production Environment's `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` match those non-secret IDs, and the development Environment uses the same org ID with a working token, so the failure is specific to the owner-held production `VERCEL_TOKEN`.
- The Vercel build, Vercel deploy, warm health and deployed smoke steps were `skipped`; `DEPLOYED SMOKE PASS` did not run and no `Vercel deployment: dpl_…` exists.
- The backend is live: the new Render deploy `dep-dc4npdk9v7es73fn4kfg` is `live`, the runtime probe logged `brevo_api_transport_verify_ok` (`api.brevo.com`, `443`), and the post-run `/healthz` is `HTTP 200` exactly `{"status":"ok"}`.

## Pre-dispatch gate (fifth attempt)

### `BREVO_API_KEY` metadata (names/metadata only)

`GET /repos/raultorres2603/CubeClicker/environments/production/secrets/BREVO_API_KEY`:

```
BREVO_API_KEY	2026-11-27T11:36:46Z	2026-11-27T12:49:02Z
```

- The `updated_at` advanced to `2026-11-27T12:49:02Z` (creation time unchanged), satisfying the gate; the value was never read.
- Production counts stayed at **15 variables / 8 secrets = 23 names**.

### CI for `origin/main` (`d10dfb1`)

`gh run list --workflow CI --commit "$(git rev-parse origin/main)" --limit 3 --json databaseId,conclusion,headSha,status`:

```
45997877865	completed	success	d10dfb1
```

- `origin/main` is `d10dfb1` (PR #4 merge); CI run `45997877865` is event `push`, head branch `main`, head SHA `d10dfb1`, status `completed`, conclusion `success`.

### Protection (names only)

- Environment id `25891960251`; `required_reviewers` naming `raultorres2603` with `prevent_self_review: false`, plus the `branch_policy` rule; `deployment_branch_policy` is `custom_branch_policies: true`, and the deployment-branch-policies list contains exactly one policy, `main`.

### Pinned production URLs (from the T3/T4 records)

production frontend: https://cubeclicker.vercel.app
production api: https://cubeclicker.onrender.com

### Dispatch baseline

`gh run list --workflow Deploy --event workflow_dispatch --limit 5` before the fifth dispatch:

```
46001011034	2026-11-27T12:43:19Z	main	completed	failure
46000139093	2026-11-27T12:37:06Z	main	completed	failure
45998841039	2026-11-27T12:27:50Z	main	completed	failure
45993542551	2026-11-27T11:49:03Z	main	completed	failure
45700752621	2026-11-25T21:03:20Z	main	completed	failure
```

## T6a fix reference

Fix PR: https://github.com/raultorres2603/CubeClicker/pull/4
Fix commit: d10dfb1

- PR #4 — `fix: add repository context to the deploy CI preflight` — merged to `main` as `d10dfb1`.
- The fix adds `--repo "$GITHUB_REPOSITORY"` to the `gh run list` call in `Verify CI succeeded for target commit`; the fifth attempt's step is `success` and printed `CI succeeded for d10dfb1`.

## Fifth dispatch

Command:

```bash
gh workflow run deploy.yml --ref main -f environment=production --repo raultorres2603/CubeClicker
```

- Response: `https://github.com/raultorres2603/CubeClicker/actions/runs/46001870210`.
- run_id=46001870210
- Run metadata: event `workflow_dispatch`, head branch `main`, head SHA `d10dfb1`, created `2026-11-27T12:49:28Z`, updated `2026-11-27T12:52:03Z`, conclusion `failure`, URL `https://github.com/raultorres2603/CubeClicker/actions/runs/46001870210`.
- The post-dispatch manual list contains exactly one new run (`46001870210`), the fourth attempt (`46001011034`), the third attempt (`46000139093`), the second attempt (`45998841039`), the first attempt (`45993542551`) and the pre-feature `45700752621`.

## Approval (fifth attempt)

- The run paused with status `waiting` for the `production` Environment.
- `GET /repos/raultorres2603/CubeClicker/actions/runs/46001870210/pending_deployments` returned the `production` environment (id `25891960251`) with `current_user_can_approve: true`.
- `POST /repos/raultorres2603/CubeClicker/actions/runs/46001870210/pending_deployments` with body `{"environment_ids":[25891960251],"state":"approved","comment":"T6 live production deploy proof (fifth attempt after the owner re-saved the production BREVO_API_KEY as a REST key): approved by the authenticated repository owner."}` was accepted.
- Approval read-back (`GET .../runs/46001870210/approvals`): `{"comment":"T6 live production deploy proof (fifth attempt after the owner re-saved the production BREVO_API_KEY as a REST key): approved by the authenticated repository owner.","environments":["production"],"state":"approved","user":"raultorres2603"}`.
- approval: authenticated owner via GitHub API
- The protection gate was not bypassed: the `required_reviewers` rule and the `main`-only branch policy remained in place; no protection was removed or weakened.

## Fifth outcome — backend success, Vercel failure

- Job `deploy` started `2026-11-27T12:49:42Z` and completed `2026-11-27T12:52:03Z` with conclusion `failure`.
- Successful steps: `Set up job`, `Verify CI succeeded for target commit`, `Checkout`, `Setup Node`, `Install dependencies`, `Check deployment Brevo configuration`, `Migrate Neon database`, `Sync Brevo SMTP settings to Render`, `Deploy Render backend`, `Wait for Render deploy to start`, `Wait for Render backend health`, `Install Vercel CLI`.
- Failing step: `Pull Vercel project settings` (`conclusion: failure`). The later steps — `Build Vercel frontend`, `Deploy Vercel frontend`, `Warm Render backend before smoke`, `Run deployed smoke` — are `skipped`.

### Backend evidence (exact workflow lines)

```
Deploy configuration OK: 11 value(s) present for the 'production' environment.
SYNCED SMTP_HOST (value verified, not shown)
SYNCED SMTP_PORT (value verified, not shown)
SYNCED SMTP_SECURE (value verified, not shown)
SYNCED SMTP_CONNECTION_TIMEOUT_MS (value verified, not shown)
SYNCED SMTP_FROM (value verified, not shown)
SYNCED SMTP_USER (value verified, not shown)
SYNCED SMTP_PASS (value verified, not shown)
SYNCED EMAIL_TRANSPORT (value verified, not shown)
SYNCED BREVO_API_KEY (value verified, not shown)
Synced 9 value(s) to Render service srv-dc4mjd15efls739ua63g for the 'production' environment.
No pending migrations.
healthz OK after 1s: {"status":"ok"}
```

- Neon migration: 0 applied (No pending migrations.)
- Sync: 9 SYNCED
- Render deploy: dep-dc4npdk9v7es73fn4kfg live
- Render runtime probe (`list_logs`, `text=brevo_api_transport_verify`): `brevo_api_transport_verify_ok` with `host: api.brevo.com`, `port: 443` at `2026-11-27T12:51:37.842270935Z`.
- Post-run health check (`node -e "fetch('https://cubeclicker.onrender.com/healthz')…"`): `POST-RUN HEALTH 200` with exactly `{"status":"ok"}`.
- `No rollback to development`
- `No deletion of the existing Neon production branch`

### Vercel failure (exact)

```
Retrieving project…
Error: Project not found ({"VERCEL_PROJECT_ID":"prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH","VERCEL_ORG_ID":"team_7cz2iixGr020Vqvjhj7Y1DNp"})
##[error]Process completed with exit code 1.
```

- Vercel deployment: none (the pull failed before the build); `list_deployments` for `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH` returns `count: 0` and `latestDeployment: null`.
- `DEPLOYED SMOKE PASS (8/8 checks)` did not run; the deployed smoke step was skipped.
- Diagnostic: the project exists and is visible via the Vercel API/MCP (`prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH`, account `team_7cz2iixGr020Vqvjhj7Y1DNp`); the development Environment uses the same org ID with a working token and successfully deploys its own project. The production `VERCEL_TOKEN` secret is owner-held and cannot see this team/project.

## Provider state after the fifth attempt (read-only)

- Render service `srv-dc4mjd15efls739ua63g` (`cubeclicker`): newest deploy `dep-dc4npdk9v7es73fn4kfg`, status `live`, trigger `deploy_hook`, commit `d10dfb1`, created `2026-11-27T12:51:02Z`, finished `2026-11-27T12:51:43Z`; the older T4-era deploy `dep-dc4mjuu1egvs7391bjgg` is now `deactivated`. The service is `not_suspended`.
- Vercel production project `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH` (`cubeclicker`): `latestDeployment: null`; `list_deployments` returns `count: 0`. No production Vercel deployment exists.
- Neon project `patient-mountain-41401588`: branch `production` is present as `br-floral-dream-zarerhtw` (`primary: true`, `default: true`, `current_state: ready`, `protected: false`, `updated_at: 2026-11-27T12:05:27Z`); the `development` branch `br-ancient-smoke-za1pdv7w` is also present (`current_state: ready`). The migration ran with the production `DIRECT_DATABASE_URL` and applied 0 migrations (already current).
- `No rollback to development`
- `No deletion of the existing Neon production branch`

## Prior failed attempts (retained history)

### Fourth attempt (owner-key failure) — run `46001011034`

- 2026-11-27T12:43:19Z, `workflow_dispatch`, `main`, commit `d10dfb1`; passed the CI preflight and failed at `Check deployment Brevo configuration` with `Deploy blocked: BREVO_API_KEY is the Brevo SMTP key, not the REST API key ('production' environment).`; all later steps skipped; the secret metadata was `updated_at: 2026-11-27T11:36:46Z` before and after.

### Third attempt (owner-key failure) — run `46000139093`

- 2026-11-27T12:37:06Z, `workflow_dispatch`, `main`, commit `d10dfb1`; same Brevo SMTP-key guard failure; all later steps skipped.

### Second attempt (owner-key failure) — run `45998841039`

- 2026-11-27T12:27:50Z, `workflow_dispatch`, `main`, commit `d10dfb1`; same Brevo SMTP-key guard failure; all later steps skipped.

### First attempt (CI-preflight failure) — run `45993542551`

- 2026-11-27T11:49:03Z, `workflow_dispatch`, `main`, commit `00e2359c`; failed at `Verify CI succeeded for target commit` because the step ran before `Checkout` and called `gh run list` without `--repo`/`GH_REPO`. Exact output then:

```
failed to determine base repo: failed to run git: fatal: not a git repository (or any of the parent directories): .git
Unable to query CI runs for 00e2359c; the token may lack actions:read
##[error]Process completed with exit code 1.
```

- The pre-feature manual run `45700752621` (2026-11-25, commit `b7dbcb98`) failed at the same step with the identical message. T6a (PR #4, merge `d10dfb1`) fixed the missing repository context; the later attempts prove the guard now executes and prints `CI succeeded for d10dfb1`.

## Blocker and owner action

Exact action required from the owner: replace the `production` Environment secret `VERCEL_TOKEN` with a Vercel token that has access to team `team_7cz2iixGr020Vqvjhj7Y1DNp` and project `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH` (the same team as the working development deploys; a team-scoped token created under that team, or the owner's known-good development token), using the GitHub UI (**Settings → Environments → production → Secrets**) or `gh secret set VERCEL_TOKEN --env production` on stdin. The builder must not read, copy or set this token.

After the owner updates the secret, re-dispatch:

```bash
gh workflow run deploy.yml --ref main -f environment=production --repo raultorres2603/CubeClicker
```

The re-run is safe and idempotent: the migration reports no pending changes, the sync rewrites the same nine names, the Render deploy hook rebuilds the tracked `main`, and only the Vercel steps and the deployed smoke remain to prove. Do not roll back to development, never delete the Neon `production` branch, and do not delete or suspend the Render/Vercel resources: the backend is live and healthy, and the remaining fix is the owner-held token.

## Verify

Command: the exact T6 verify block from `tasks.md` (the `bash` block under `## T6 — Live production deploy proof`, lines 298–326), extracted to `/tmp/opencode/t6/t6-verify.sh` and run as `bash /tmp/opencode/t6/t6-verify.sh`; `set -euo pipefail` is inside the block. Raw output:

```
$ bash /tmp/opencode/t6/t6-verify.sh
$ echo "VERIFY_EXIT=$?"
VERIFY_EXIT=1
```

- The block is silent on success and stops at the first failing assertion. Here it fails at the run-conclusion check because the first `run_id=` in this log (`46001870210`, the latest attempt) is `workflow_dispatch` / `main` / `failure`, not `success`; the log greps for the guard line, nine `SYNCED` lines, migration, health poll and smoke are unreachable because the run never reached a successful conclusion.
- Discrepancy recorded per the task instruction: there is **no successful run** to assert. The verify block keys on the first `run_id=` in the log, which is the latest attempt; the prior failed runs are recorded separately under § Prior failed attempts. When a later attempt succeeds, its `run_id=` must become the first occurrence (or the block must be amended) so the verify asserts the successful run.
- Supplementary checks over this build log (the verify block's credential guards, run separately): connection-string pattern and credential-shape pattern both find no match; `.env*` is untouched.

## Acceptance audit

- **AC-7 — live production deploy proves the path end to end:** **partially met / blocked.** (a) is satisfied for the fifth attempt — `workflow_dispatch` from `main` with `environment=production`, dispatched only after CI for `d10dfb1` reported `success`, no push-triggered production deploy. (b) the eleven-value guard line is present; (c) the nine `SYNCED` lines and `Synced 9 value(s) to Render service ...` are present; (d) the migration ran on the production URL and reported 0 pending; (e) the exact `healthz OK after 1s: {"status":"ok"}` line is present; (f) the Vercel deploy did not run — `Pull Vercel project settings` failed with `Project not found`; (g) the deployed smoke did not run; (h) the Render deploy ID/status are recorded and the post-run health is 200, but no Vercel deployment ID exists; (i) the anchored URLs are recorded. The remaining proof is the Vercel deployment and smoke after the owner fixes `VERCEL_TOKEN`.
- **AC-8(c) — no rollback to development, no Neon branch deletion:** **met so far.** `No rollback to development`; `No deletion of the existing Neon production branch`; the production branch is present and no development resource was targeted by this task.
- **AC-11 — partial failure handled safely:** **met for the failure that occurred.** The run failed after the migration and after the Render deploy, so the fix-forward path is the owner-held Vercel token; no resource was deleted or suspended, no rollback to development occurred, and the pre-existing Neon branch was retained. The backend remains live and healthy.
- **Testing tiers:** T6 is an infrastructure task (`tasks.md` T1–T6 add no application tests or coverage target); the live run and deployed smoke are the feature-appropriate E2E proof. The backend half is proven; the frontend half awaits the token fix. T8 owns the full repository suite/no-regression gate.

## Deviations from spec

- None performed. The task did not edit a workflow, bypass a guard, set an owner-held secret, dispatch development, roll back or delete the Neon branch. The only repository change is this build log; `.env*` is untouched and nothing was pushed.
