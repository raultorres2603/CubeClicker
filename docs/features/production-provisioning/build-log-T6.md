# Build log — T6 — Live production deploy proof

Task: T6 (2026-11-27; re-run after T6a)
Files changed: `docs/features/production-provisioning/build-log-T6.md` (only; no application code, workflow, provider asset, architecture doc, `status.md` or `docs/features/README.md` edit)
What changed & why: T6a fixed the manual-path CI preflight (PR #4, merge `d10dfb1`) and the re-run passed that guard with `CI succeeded for d10dfb1`; it then failed at the next pre-provider guard, `Check deployment Brevo configuration`, because the production `BREVO_API_KEY` is the Brevo SMTP key, not the REST API key. The live proof remains blocked on that owner-held value; no provider step ran. The first failed attempt is retained as history at the end of this log.
Decisions: Approval used the authenticated owner session through the GitHub API; the guard was not bypassed, no development dispatch was made by this task, no rollback was performed and the pre-existing Neon branch was not deleted. The builder did not read, copy or set any secret value; fixing the wrong production `BREVO_API_KEY` is an owner action because it is an owner-held secret.
Testing note: T6 is the feature's live-proof infrastructure task per `tasks.md` (provider/GitHub state plus a build log; no application code). The feature-appropriate end-to-end proof is the workflow run with the deployed smoke; it did not reach the provider steps because the value guard failed closed before any provider call. No repository unit/integration test boundary exists for the live deploy, and T8 owns the full repository suite/no-regression gate.

## Status: BLOCKED — owner-held Brevo REST API key

- T6a is complete: PR #4 merged to `main` as `d10dfb1`; merge-SHA CI run `45997877865` is `completed` / `success`; the local feature branch carries the fix.
- Re-run `run_id=45998841039` passed the repaired `Verify CI succeeded for target commit` guard (`CI succeeded for d10dfb1`) and then failed at `Check deployment Brevo configuration`:
  `Deploy blocked: BREVO_API_KEY is the Brevo SMTP key, not the REST API key ('production' environment).`
- The builder must not read, copy or set owner-held secret values (T5a/T5 division and spec AC-6(c)/(d)). The fail-closed guard is doing its job; the fix forward is for the owner to replace the production `BREVO_API_KEY` secret with a Brevo **REST API key** (prefix `xkeysib-`, created under Settings → SMTP & API → API Keys; not an `xsmtpsib-` key and not identical to `SMTP_PASS`) via the GitHub UI or `gh secret set` stdin, then re-dispatch the same command.
- No provider was touched: every step after the failed guard is `skipped`; the Neon migration did not run on either T6 attempt, and no sync, Render deploy hook, Vercel build/deploy or deployed smoke ran.

## Pre-dispatch gates (re-run)

### CI for `origin/main` (`d10dfb1`)

`gh run list --workflow CI --commit "$(git rev-parse origin/main)" --limit 3 --json databaseId,conclusion,headSha,status`:

```
45997877865	completed	success	d10dfb1
```

- `origin/main` is `d10dfb1` (PR #4 merge); CI run `45997877865` is event `push`, head branch `main`, head SHA `d10dfb1`, status `completed`, conclusion `success`.
- The prior `main` SHA (`00e2359c`) and its successful CI `45957565326` are superseded for this dispatch; the re-run's target SHA is `d10dfb1`.

### Production Environment (names only)

`gh variable list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | sort`:

```
EMAIL_TRANSPORT
FRONTEND_ORIGIN
MAX_USERS_PER_SERVER
RENDER_SERVICE_ID
SESSION_COOKIE_SAMESITE
SESSION_COOKIE_SECURE
SMTP_CONNECTION_TIMEOUT_MS
SMTP_FROM
SMTP_HOST
SMTP_PORT
SMTP_SECURE
VERCEL_ORG_ID
VERCEL_PROJECT_ID
VITE_API_URL
VITE_WS_URL
```

`gh secret list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | sort`:

```
BREVO_API_KEY
DATABASE_URL
DIRECT_DATABASE_URL
RENDER_API_KEY
RENDER_DEPLOY_HOOK_URL
SMTP_PASS
SMTP_USER
VERCEL_TOKEN
```

- Counts: **15 variables / 8 secrets = 23 names**.
- Protection read-back: environment id `25891960251`; `required_reviewers` naming `raultorres2603` with `prevent_self_review: false`, plus the `branch_policy` rule; `deployment_branch_policy` is `custom_branch_policies: true`, and the deployment-branch-policies list contains exactly one policy, `main`.
- No variable or secret value was read.

### Pinned production URLs (from the T3/T4 records)

production frontend: https://cubeclicker.vercel.app
production api: https://cubeclicker.onrender.com

### Dispatch baseline

`gh run list --workflow Deploy --event workflow_dispatch --limit 5` before the re-run:

```
45993542551	2026-11-27T11:49:03Z	main	completed	failure
45700752621	2026-11-25T21:03:20Z	main	completed	failure
```

- The only prior manual runs are the first T6 attempt (`45993542551`, guard bug) and the pre-feature `45700752621` (same guard bug). Both are history below.

## T6a fix reference

Fix PR: https://github.com/raultorres2603/CubeClicker/pull/4
Fix commit: d10dfb1

- PR #4 — `fix: add repository context to the deploy CI preflight` — merged to `main` as `d10dfb1`.
- The fix adds `--repo "$GITHUB_REPOSITORY"` to the `gh run list` call in `Verify CI succeeded for target commit`, giving `gh` the repository context it cannot derive before `Checkout`.
- Effective proof: the re-run's `Verify CI succeeded for target commit` step is `success` and printed `CI succeeded for d10dfb1`; the first attempt failed at the same step (history below).

## Re-run dispatch

Command:

```bash
gh workflow run deploy.yml --ref main -f environment=production --repo raultorres2603/CubeClicker
```

- Response: `https://github.com/raultorres2603/CubeClicker/actions/runs/45998841039`.
- run_id=45998841039
- Run metadata: event `workflow_dispatch`, head branch `main`, head SHA `d10dfb1`, created `2026-11-27T12:27:50Z`, updated `2026-11-27T12:29:11Z`, conclusion `failure`, URL `https://github.com/raultorres2603/CubeClicker/actions/runs/45998841039`.
- The post-dispatch manual list contains exactly one new run (`45998841039`), the first attempt (`45993542551`) and the pre-feature `45700752621`.

## Approval (re-run)

- The run paused with status `waiting` for the `production` Environment.
- `GET /repos/raultorres2603/CubeClicker/actions/runs/45998841039/pending_deployments` returned the `production` environment (id `25891960251`) with `current_user_can_approve: true`.
- `POST /repos/raultorres2603/CubeClicker/actions/runs/45998841039/pending_deployments` with body `{"environment_ids":[25891960251],"state":"approved","comment":"T6 live production deploy proof (re-run after T6a fix): approved by the authenticated repository owner."}` was accepted; the run moved to `in_progress` and the pending list became empty.
- Approval read-back (`GET .../runs/45998841039/approvals`): `{"comment":"T6 live production deploy proof (re-run after T6a fix): approved by the authenticated repository owner.","environments":["production"],"state":"approved","user":"raultorres2603"}`.
- approval: authenticated owner via GitHub API
- The protection gate was not bypassed: the `required_reviewers` rule and the `main`-only branch policy remained in place; no protection was removed or weakened.

## Re-run outcome

- Job `deploy` started `2026-11-27T12:28:05Z` and completed `2026-11-27T12:29:10Z` with conclusion `failure`.
- Successful pre-provider steps: `Set up job`, `Verify CI succeeded for target commit`, `Checkout`, `Setup Node`, `Install dependencies`.
- Failing step: `Check deployment Brevo configuration` (`conclusion: failure`). Every later step — `Migrate Neon database`, `Sync Brevo SMTP settings to Render`, `Deploy Render backend`, `Wait for Render deploy to start`, `Wait for Render backend health`, `Install Vercel CLI`, `Pull Vercel project settings`, `Build Vercel frontend`, `Deploy Vercel frontend`, `Warm Render backend before smoke`, `Run deployed smoke` — is `skipped`.

Exact guard output:

```
Deploy blocked: BREVO_API_KEY is the Brevo SMTP key, not the REST API key ('production' environment).
  Create a Brevo API key under Settings → SMTP & API → API Keys and store it as the BREVO_API_KEY secret.
  Runbook: README.md § Deployment Brevo runbook
##[error]Process completed with exit code 1.
```

- Root cause: the production `BREVO_API_KEY` secret is an SMTP-type key (`xsmtpsib-` prefix) or is identical to `SMTP_PASS`; the guard rejects both because the deployed HTTPS transport needs the Brevo REST API key (`xkeysib-`). The guard is documented to fail closed before the Neon migration and before any provider call, so this run touched no provider.
- No value, key or sender address is recorded in this log; the Actions log masks the secrets and this build log records only the guard's fixed message lines.

## Provider state after the re-run (read-only)

- Render service `srv-dc4mjd15efls739ua63g` (`cubeclicker`): the latest deploy is still `dep-dc4mjuu1egvs7391bjgg`, status `live`, created `2026-11-27T11:31:07Z`, finished `2026-11-27T11:32:48Z` — the T4-era provider deploy, created before both T6 dispatches. No new production Render deploy exists.
- Vercel production project `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH` (`cubeclicker`): `latestDeployment: null`; `list_deployments` returns `count: 0`. No production Vercel deployment exists.
- Neon project `patient-mountain-41401588`: branch `production` is still present as `br-floral-dream-zarerhtw` (`primary: true`, `default: true`, `current_state: ready`, `protected: false`); the `development` branch `br-ancient-smoke-za1pdv7w` is also present. No branch was created, deleted or re-created; the migration step never ran on either attempt.
- Read-only `/healthz` observation on `https://cubeclicker.onrender.com`: HTTP `200` with exactly `{"status":"ok"}`, served by the T4-era deploy. This is a liveness observation only, not the T6 post-deploy proof.
- `No rollback to development`
- `No deletion of the existing Neon production branch`

## First attempt (retained history)

- Run `45993542551` (2026-11-27T11:49:03Z, `workflow_dispatch`, `main`, commit `00e2359c`) failed at `Verify CI succeeded for target commit`: the step ran before `Checkout` and called `gh run list` without `--repo`/`GH_REPO`, so `gh` could not resolve the repository.
- Exact output then:

```
failed to determine base repo: failed to run git: fatal: not a git repository (or any of the parent directories): .git
Unable to query CI runs for 00e2359c; the token may lack actions:read
##[error]Process completed with exit code 1.
```

- The pre-feature manual run `45700752621` (2026-11-25, commit `b7dbcb98`) failed at the same step with the identical message.
- T6a (PR #4, merge `d10dfb1`) fixed the missing repository context; the re-run above proves the guard now executes and prints `CI succeeded for d10dfb1`.
- No provider step ran on the first attempt either; the full log was written only to a temp file under `/tmp/opencode` and deleted after the evidence extraction.

## Blocker and owner action

Exact action required from the owner: replace the `production` Environment secret `BREVO_API_KEY` with a Brevo **REST API key** — created under Brevo Settings → SMTP & API → API Keys (prefix `xkeysib-`), not an SMTP key (`xsmtpsib-`) and not the same value as `SMTP_PASS` — using the GitHub UI or `gh secret set` on stdin. The builder must not read, copy or set this value.

After the owner updates the secret, re-dispatch:

```bash
gh workflow run deploy.yml --ref main -f environment=production --repo raultorres2603/CubeClicker
```

Candidates if the owner cannot supply a REST key: (a) reuse the owner's valid development REST key by setting the production secret from the owner's own copy (the builder still reads nothing); (b) leave T6 fail-closed and defer the live proof until a key is available. No bypass, no `EMAIL_TRANSPORT=smtp` fallback, no development deploy, no rollback and no Neon branch deletion.

## Verify

Command: the exact T6 verify block from `tasks.md` (the `bash` block under `## T6 — Live production deploy proof`, lines 298–326), extracted to `/tmp/opencode/t6/t6-verify.sh` and run as `bash /tmp/opencode/t6/t6-verify.sh`; `set -euo pipefail` is inside the block. Raw output:

```
$ bash /tmp/opencode/t6/t6-verify.sh
$ echo "VERIFY_EXIT=$?"
VERIFY_EXIT=1
```

- The block is silent on success and stops at the first failing assertion. Here it fails at the run-conclusion check because the first `run_id=` in this log (`45998841039`) is `workflow_dispatch` / `main` / `failure`, not `success`; the log greps for the guard line, nine `SYNCED` lines, migration, health poll and smoke are unreachable because the run never reached those steps.
- Supplementary checks over this build log (the verify block's credential guards, run separately): connection-string pattern and credential-shape pattern both find no match; `.env*` is untouched.

## Acceptance audit

- **AC-7 — live production deploy proves the path end to end:** **unmet / blocked.** (a) is satisfied for the re-run — `workflow_dispatch` from `main` with `environment=production`, dispatched only after CI for `d10dfb1` reported `success`, no push-triggered production deploy — but (b)–(i) are unproven: the `Deploy configuration OK: 11 value(s) ...` line, the nine `SYNCED` lines, `Synced 9 value(s) to Render service ...`, migration output, `healthz OK after <n>s: {"status":"ok"}`, the Vercel deployment and `DEPLOYED SMOKE PASS (8/8 checks)` did not run. The value guard failed closed before the migration and before any provider call.
- **AC-8(c) — no rollback to development, no Neon branch deletion:** **met so far.** `No rollback to development`; `No deletion of the existing Neon production branch`; `br-floral-dream-zarerhtw` is present and no development resource was targeted by this task.
- **AC-11 — partial failure handled safely:** **met for the failures that occurred.** Both attempts failed before any migration or provider call; no resource was deleted or suspended, no rollback to development occurred, and the pre-existing Neon branch was retained. The fix-forward requirement now needs the owner's REST API key; this log does not bypass the guard.
- **Testing tiers:** T6 is an infrastructure task (`tasks.md` T1–T6 add no application tests or coverage target); the live run and deployed smoke are the feature-appropriate E2E proof but have not executed successfully yet. T8 owns the full repository suite/no-regression gate.

## Deviations from spec

- None performed. The task did not edit a workflow, bypass the guard, set an owner-held secret, dispatch development, roll back or delete the Neon branch. The only repository change is this build log; `.env*` is untouched and nothing was pushed.
