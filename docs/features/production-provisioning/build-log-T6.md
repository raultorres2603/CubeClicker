# Build log — T6 — Live production deploy proof

Task: T6 (2026-11-27; seventh live attempt, final success)
Files changed: `docs/features/production-provisioning/build-log-T6.md` (only; no application code, workflow, provider asset, architecture doc, `status.md` or `docs/features/README.md` edit)
What changed & why: After the owner's team-scoped `VERCEL_TOKEN` re-save advanced its metadata to `2026-11-27T13:04:34Z`, the seventh production dispatch completed end to end: the CI preflight, the eleven-name guard, the Neon migration (no pending), the nine-name Render sync, the Render deploy hook, the `/healthz` poll, the Vercel pull/build/deploy and the deployed smoke all passed. The Render deploy and Vercel deployment IDs and the post-run health are recorded; the live proof is complete. Prior failed attempts are retained as history.
Decisions: Approval used the authenticated owner session through the GitHub API; the metadata gate was applied before the dispatch (the failed sixth run had used the older `13:03:01Z` token because its job started before the `13:04:34Z` re-save). No guard was bypassed, no development dispatch was made by this task, no rollback was performed and the pre-existing Neon branch was not deleted. The builder did not read, copy or set any secret value.
Testing note: T6 is the feature's live-proof infrastructure task per `tasks.md` (provider/GitHub state plus a build log; no application code). The feature-appropriate end-to-end proof is this workflow run with the deployed smoke, which passed. No repository unit/integration test boundary exists for the live deploy, and T8 owns the full repository suite/no-regression gate.

## Final status: COMPLETED — live production deploy proven

- run_id=46004355405
- Run metadata: event `workflow_dispatch`, head branch `main`, head SHA `d10dfb1`, status `completed`, conclusion `success`, created `2026-11-27T13:07:11Z`, updated `2026-11-27T13:09:31Z`, URL `https://github.com/raultorres2603/CubeClicker/actions/runs/46004355405`.
- `CI succeeded for d10dfb1`
- `Deploy configuration OK: 11 value(s) present for the 'production' environment.`
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
- `Neon migration: 0 applied (No pending migrations.)`
- `Sync: 9 SYNCED`
- `healthz OK after 0s: {"status":"ok"}`
- `DEPLOYED SMOKE PASS (8/8 checks)`
- `Render deploy: dep-dc4o1fff3r2c73c4asp0 live`
- `Vercel deployment: dpl_2wFeBSaUSxYKkhpNtqZGFcby1Duq ready`
- `POST-RUN HEALTH 200` — exactly `{"status":"ok"}`.
- `production frontend: https://cubeclicker.vercel.app`
- `production api: https://cubeclicker.onrender.com`
- `No rollback to development`
- `No deletion of the existing Neon production branch`

### Secret metadata gates (names/metadata only)

- `VERCEL_TOKEN`: `updated_at: 2026-11-27T13:04:34Z` (previous value `2026-11-27T11:37:16Z`); the token used by this run was the `13:04:34Z` value.
- `BREVO_API_KEY`: `updated_at: 2026-11-27T12:49:02Z` (creation time `2026-11-27T11:36:46Z`).
- No secret value was read.

### Runtime Brevo probe (read-only Render logs)

- `brevo_api_transport_verify_ok` with `host: api.brevo.com`, `port: 443` at `2026-11-27T13:08:41.57545297Z` on the new instance.

## Pre-dispatch gate (seventh attempt)

### Vercel token metadata

`GET /repos/raultorres2603/CubeClicker/environments/production/secrets/VERCEL_TOKEN`:

```
VERCEL_TOKEN	2026-11-27T11:37:16Z	2026-11-27T13:04:34Z
```

- The `updated_at` advanced past the previous value (`11:37:16Z`), satisfying the gate. The `13:03:01Z` state was used by the failed sixth run because its job started before the `13:04:34Z` re-save; the seventh dispatch used the current value.

### Brevo key metadata

`GET /repos/raultorres2603/CubeClicker/environments/production/secrets/BREVO_API_KEY`:

```
BREVO_API_KEY	2026-11-27T11:36:46Z	2026-11-27T12:49:02Z
```

- The `updated_at` remains advanced past `2026-11-27T11:36:46Z`; the value was never read.

### CI for `origin/main` (`d10dfb1`)

`gh run list --workflow CI --commit "$(git rev-parse origin/main)" --limit 3 --json databaseId,conclusion,headSha,status`:

```
45997877865	completed	success	d10dfb1
```

- `origin/main` is `d10dfb1` (PR #4 merge); CI run `45997877865` is event `push`, head branch `main`, head SHA `d10dfb1`, conclusion `success`.

### Production Environment (names only)

- Counts: **15 variables / 8 secrets = 23 names**.
- Protection: environment id `25891960251`; `required_reviewers` naming `raultorres2603` with `prevent_self_review: false`, plus the `branch_policy` rule; `deployment_branch_policy` is `custom_branch_policies: true`, with exactly one branch policy, `main`.
- No variable or secret value was read.

### Pinned production URLs (from the T3/T4 records)

production frontend: https://cubeclicker.vercel.app
production api: https://cubeclicker.onrender.com

## T6a fix reference

Fix PR: https://github.com/raultorres2603/CubeClicker/pull/4
Fix commit: d10dfb1

- PR #4 — `fix: add repository context to the deploy CI preflight` — merged to `main` as `d10dfb1`.
- The fix adds `--repo "$GITHUB_REPOSITORY"` to the `gh run list` call in `Verify CI succeeded for target commit`; the seventh attempt's step is `success` and printed `CI succeeded for d10dfb1`.

## Seventh dispatch

Command:

```bash
gh workflow run deploy.yml --ref main -f environment=production --repo raultorres2603/CubeClicker
```

- Response: `https://github.com/raultorres2603/CubeClicker/actions/runs/46004355405`.
- run_id=46004355405
- The post-dispatch manual list contains exactly one new run (`46004355405`), the failed sixth attempt (`46003860223`), the fifth attempt (`46001870210`), the fourth attempt (`46001011034`), the third attempt (`46000139093`), the second attempt (`45998841039`), the first attempt (`45993542551`) and the pre-feature `45700752621`.

## Approval (seventh attempt)

- The run paused with status `waiting` for the `production` Environment.
- `GET /repos/raultorres2603/CubeClicker/actions/runs/46004355405/pending_deployments` returned the `production` environment (id `25891960251`) with `current_user_can_approve: true`.
- `POST /repos/raultorres2603/CubeClicker/actions/runs/46004355405/pending_deployments` with body `{"environment_ids":[25891960251],"state":"approved","comment":"T6 live production deploy proof (seventh attempt after the owner re-saved the production VERCEL_TOKEN): approved by the authenticated repository owner."}` was accepted.
- Approval read-back (`GET .../runs/46004355405/approvals`): `{"comment":"T6 live production deploy proof (seventh attempt after the owner re-saved the production VERCEL_TOKEN): approved by the authenticated repository owner.","environments":["production"],"state":"approved","user":"raultorres2603"}`.
- approval: authenticated owner via GitHub API
- The protection gate was not bypassed: the `required_reviewers` rule and the `main`-only branch policy remained in place; no protection was removed or weakened.

## Seventh outcome — all steps success

- Job `deploy` started `2026-11-27T13:07:27Z` and completed `2026-11-27T13:09:30Z` with conclusion `success`.
- Every non-skipped step is `success`: `Set up job`, `Verify CI succeeded for target commit`, `Checkout`, `Setup Node`, `Install dependencies`, `Check deployment Brevo configuration`, `Migrate Neon database`, `Sync Brevo SMTP settings to Render`, `Deploy Render backend`, `Wait for Render deploy to start`, `Wait for Render backend health`, `Install Vercel CLI`, `Pull Vercel project settings`, `Build Vercel frontend`, `Deploy Vercel frontend`, `Warm Render backend before smoke`, `Run deployed smoke`, `Post Setup Node`, `Post Checkout`, `Complete job`. `Reject non-push CI runs` is `skipped` on the dispatch path as designed.
- Exact workflow lines:

```
CI succeeded for d10dfb1
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
healthz OK after 0s: {"status":"ok"}
DEPLOYED SMOKE PASS (8/8 checks)
```

- Vercel deploy output tail: `https://cubeclicker-i32bizms0-raultorres2603s-projects.vercel.app`; `vercel deploy --prebuilt --prod` updated the stable `cubeclicker.vercel.app` domain, and the deployed smoke passed against that stable origin.
- No `DEPLOYED SMOKE FAIL` line exists in the log.

## Provider state after the seventh attempt (read-only)

- Render service `srv-dc4mjd15efls739ua63g` (`cubeclicker`): `Render deploy: dep-dc4o1fff3r2c73c4asp0 live`, trigger `deploy_hook`, commit `d10dfb1`, created `2026-11-27T13:08:13Z`, finished `2026-11-27T13:08:43Z`; the previous deploy `dep-dc4o0317lnhs7397lrpg` is `deactivated`. Service `not_suspended`.
- Vercel production project `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH` (`cubeclicker`): deployment `dpl_2wFeBSaUSxYKkhpNtqZGFcby1Duq`, state `READY`, target `production`, commit `d10dfb1`; `list_deployments` returns `count: 1`. The stable `https://cubeclicker.vercel.app` origin served the deployed smoke.
- Neon project `patient-mountain-41401588`: branch `production` is present as `br-floral-dream-zarerhtw` (`primary: true`, `default: true`, `current_state: ready`, `protected: false`); the `development` branch `br-ancient-smoke-za1pdv7w` is also present. The migration ran with the production `DIRECT_DATABASE_URL` and applied 0 migrations (already current).
- Post-run `/healthz` on `https://cubeclicker.onrender.com`: `POST-RUN HEALTH 200` with exactly `{"status":"ok"}`.
- `No rollback to development`
- `No deletion of the existing Neon production branch`

## Prior failed attempts (retained history)

### Sixth attempt (Vercel token scope) — run `46003860223`

- 2026-11-27T13:03:50Z, `workflow_dispatch`, `main`, commit `d10dfb1`; passed the CI preflight, the eleven-name guard, the migration, the sync, the Render deploy and the health poll, then failed at `Pull Vercel project settings` with `Error: Project not found ({"VERCEL_PROJECT_ID":"prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH","VERCEL_ORG_ID":"team_7cz2iixGr020Vqvjhj7Y1DNp"})`; the Vercel build/deploy and smoke were skipped. Its `VERCEL_TOKEN` metadata advanced to `13:03:01Z` before dispatch and to `13:04:34Z` after the job had started, so the run used the older token.
- No rollback or deletion; the backend was live and healthy.

### Fifth attempt (Vercel token scope) — run `46001870210`

- 2026-11-27T12:49:28Z, `workflow_dispatch`, `main`, commit `d10dfb1`; passed the CI preflight, the eleven-name guard, `Neon migration: 0 applied`, `Sync: 9 SYNCED`, the Render deploy, `healthz OK after 1s: {"status":"ok"}` and the post-run health, then failed at `Pull Vercel project settings` with the same `Project not found` error; the Vercel build/deploy and smoke were skipped.

### Fourth attempt (Brevo key) — run `46001011034`

- 2026-11-27T12:43:19Z, `workflow_dispatch`, `main`, commit `d10dfb1`; passed the CI preflight and failed at `Check deployment Brevo configuration` with `Deploy blocked: BREVO_API_KEY is the Brevo SMTP key, not the REST API key ('production' environment).`; all later steps skipped; secret metadata was `updated_at: 2026-11-27T11:36:46Z` before and after.

### Third attempt (Brevo key) — run `46000139093`

- 2026-11-27T12:37:06Z, `workflow_dispatch`, `main`, commit `d10dfb1`; same Brevo SMTP-key guard failure; all later steps skipped.

### Second attempt (Brevo key) — run `45998841039`

- 2026-11-27T12:27:50Z, `workflow_dispatch`, `main`, commit `d10dfb1`; same Brevo SMTP-key guard failure; all later steps skipped.

### First attempt (CI preflight) — run `45993542551`

- 2026-11-27T11:49:03Z, `workflow_dispatch`, `main`, commit `00e2359c`; failed at `Verify CI succeeded for target commit` because the step ran before `Checkout` and called `gh run list` without `--repo`/`GH_REPO`. Exact output then:

```
failed to determine base repo: failed to run git: fatal: not a git repository (or any of the parent directories): .git
Unable to query CI runs for 00e2359c; the token may lack actions:read
##[error]Process completed with exit code 1.
```

- The pre-feature manual run `45700752621` (2026-11-25, commit `b7dbcb98`) failed at the same step with the identical message. T6a (PR #4, merge `d10dfb1`) fixed the missing repository context; the later attempts prove the guard now executes and prints `CI succeeded for d10dfb1`.

## Verify

Command: the exact T6 verify block from `tasks.md` (the `bash` block under `## T6 — Live production deploy proof`, lines 298–326), extracted to `/tmp/opencode/t6/t6-verify.sh` and run as `bash /tmp/opencode/t6/t6-verify.sh`; `set -euo pipefail` is inside the block. The first `run_id=` in this log is the successful `46004355405`, so the block asserts the success. Raw output:

```
$ bash /tmp/opencode/t6/t6-verify.sh
$ echo "VERIFY_EXIT=$?"
VERIFY_EXIT=0
```

- The block is silent on success (every check is a `test`, a `grep -q`/negated `grep`, or the `node -e` health assertion); exit `0` means every assertion passed:
  - The successful run is `workflow_dispatch` / `main` / `success`.
  - The workflow log contains the eleven-value guard line, exactly nine `SYNCED` lines, `Synced 9 value(s) to Render service ...`, `healthz OK after <n>s: {"status":"ok"}`, `DEPLOYED SMOKE PASS (8/8 checks)` and no `DEPLOYED SMOKE FAIL`.
  - The build log contains the anchored production URLs, the `Neon migration` record, `Render deploy: dep-… live`, `Vercel deployment: dpl_… ready`, `CI succeeded for`, `No rollback to development` and `No deletion of the existing Neon production branch`.
  - The post-verify `node -e fetch(…/healthz)` returns `HTTP 200` and exactly `{"status":"ok"}`.
  - The credential-shaped and connection-string guards find no match.

## Acceptance audit

- **AC-7 — live production deploy proves the path end to end:** **met.** (a) `workflow_dispatch` from `main` with `environment=production`, dispatched only after CI for `d10dfb1` reported `success`, no push-triggered production deploy; (b) exact `Deploy configuration OK: 11 value(s) present for the 'production' environment.`; (c) nine `SYNCED` lines and `Synced 9 value(s) to Render service srv-dc4mjd15efls739ua63g for the 'production' environment.`; (d) the migration ran with the production URL and reported `No pending migrations.` (0 applied, idempotent); (e) exact `healthz OK after 0s: {"status":"ok"}`; (f) the Vercel step deployed the production project with `--prod` and the stable domain served the deployment (the deployed smoke ran against it); (g) exact `DEPLOYED SMOKE PASS (8/8 checks)` with no `FAIL`; (h) the run URL, `Render deploy: dep-dc4o1fff3r2c73c4asp0 live`, `Vercel deployment: dpl_2wFeBSaUSxYKkhpNtqZGFcby1Duq ready` and `POST-RUN HEALTH 200` are recorded; (i) the anchored `production frontend:`/`production api:` lines are recorded.
- **AC-8(c) — no rollback to development, no Neon branch deletion:** **met.** `No rollback to development`; `No deletion of the existing Neon production branch`; the production branch is present and no development resource was targeted by this task.
- **AC-11 — partial failure handled safely:** **met.** The earlier failures were fixed forward (workflow preflight via T6a, then the owner-held Brevo key, then the owner-held Vercel token); no resource was deleted or suspended, no rollback to development occurred, and the pre-existing Neon branch was retained. The final deploy is green.
- **Testing tiers:** T6 is an infrastructure task (`tasks.md` T1–T6 add no application tests or coverage target); this live run and the deployed smoke are the feature-appropriate E2E proof. T8 owns the full repository suite/no-regression gate.

## Deviations from spec

- None performed. The task did not edit a workflow, bypass a guard, set an owner-held secret, dispatch development, roll back or delete the Neon branch. The only repository change is this build log; `.env*` is untouched and nothing was pushed.
