# Build log — T6 — Live production deploy proof

Task: T6 (2026-11-27; third live attempt after T6a and the owner's `BREVO_API_KEY` replacement)
Files changed: `docs/features/production-provisioning/build-log-T6.md` (only; no application code, workflow, provider asset, architecture doc, `status.md` or `docs/features/README.md` edit)
What changed & why: T6a's preflight fix is verified on `main` (`d10dfb1`) and the third dispatch passed the CI preflight (`CI succeeded for d10dfb1`), but it failed again at `Check deployment Brevo configuration`: the production `BREVO_API_KEY` is still the Brevo SMTP key. The names-only secret metadata shows the `production` Environment secret has not changed since `2026-11-27T11:36:46Z`, so the owner's replacement did not reach the GitHub `production` secret that the workflow reads. The live proof remains blocked on that owner-held value; no provider step ran. Prior failed runs are retained as history.
Decisions: Approval used the authenticated owner session through the GitHub API (third time); the guard was not bypassed, no development dispatch was made by this task, no rollback was performed and the pre-existing Neon branch was not deleted. The builder did not read, copy or set any secret value; the names-only `updated_at` metadata is the evidence that the GitHub secret was not replaced.
Testing note: T6 is the feature's live-proof infrastructure task per `tasks.md` (provider/GitHub state plus a build log; no application code). The feature-appropriate end-to-end proof is the workflow run with the deployed smoke; it did not reach the provider steps because the value guard failed closed before any provider call. No repository unit/integration test boundary exists for the live deploy, and T8 owns the full repository suite/no-regression gate.

## Status: BLOCKED — production GitHub secret not updated

- `origin/main` is still `d10dfb1`; merge-SHA CI run `45997877865` is `completed` / `success`.
- Third attempt `run_id=46000139093` passed the repaired `Verify CI succeeded for target commit` guard (`CI succeeded for d10dfb1`) and failed again at `Check deployment Brevo configuration`:
  `Deploy blocked: BREVO_API_KEY is the Brevo SMTP key, not the REST API key ('production' environment).`
- Names-only metadata check of `GET /repos/raultorres2603/CubeClicker/environments/production/secrets/BREVO_API_KEY`: `created_at: 2026-11-27T11:36:46Z`, `updated_at: 2026-11-27T11:36:46Z` both before and after the run. The secret has not been rewritten since the T5a hand-off; the owner's replacement did not take effect on the **GitHub `production` Environment** secret.
- The workflow reads `${{ secrets.BREVO_API_KEY }}` from that Environment and syncs it to Render; updating the Render service env or another environment does not satisfy this guard.
- No provider was touched: every step after the failed guard is `skipped`; the Neon migration did not run on this attempt, and no sync, Render deploy hook, Vercel build/deploy or deployed smoke ran.

## Pre-dispatch gates (third attempt)

### CI for `origin/main` (`d10dfb1`)

`gh run list --workflow CI --commit "$(git rev-parse origin/main)" --limit 3 --json databaseId,conclusion,headSha,status`:

```
45997877865	completed	success	d10dfb1
```

- `origin/main` is `d10dfb1` (PR #4 merge); CI run `45997877865` is event `push`, head branch `main`, head SHA `d10dfb1`, status `completed`, conclusion `success`.
- No new `main` commit exists; the T6a fix remains the deployed workflow version.

### Production Environment (names and secret metadata only)

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
- `BREVO_API_KEY` exists; its names-only metadata is `created_at: 2026-11-27T11:36:46Z`, `updated_at: 2026-11-27T11:36:46Z` (unchanged before and after the third run). The value was never read.
- Protection read-back: environment id `25891960251`; `required_reviewers` naming `raultorres2603` with `prevent_self_review: false`, plus the `branch_policy` rule; `deployment_branch_policy` is `custom_branch_policies: true`, and the deployment-branch-policies list contains exactly one policy, `main`.
- No variable or secret value was read.

### Pinned production URLs (from the T3/T4 records)

production frontend: https://cubeclicker.vercel.app
production api: https://cubeclicker.onrender.com

### Dispatch baseline

`gh run list --workflow Deploy --event workflow_dispatch --limit 5` before the third dispatch:

```
45998841039	2026-11-27T12:27:50Z	main	completed	failure
45993542551	2026-11-27T11:49:03Z	main	completed	failure
45700752621	2026-11-25T21:03:20Z	main	completed	failure
```

- The prior manual runs are the first T6 attempt (guard bug), the second T6 attempt (Brevo key), and the pre-feature run (guard bug); all are history below.

## T6a fix reference

Fix PR: https://github.com/raultorres2603/CubeClicker/pull/4
Fix commit: d10dfb1

- PR #4 — `fix: add repository context to the deploy CI preflight` — merged to `main` as `d10dfb1`.
- The fix adds `--repo "$GITHUB_REPOSITORY"` to the `gh run list` call in `Verify CI succeeded for target commit`, giving `gh` the repository context it cannot derive before `Checkout`.
- Effective proof: the third attempt's `Verify CI succeeded for target commit` step is `success` and printed `CI succeeded for d10dfb1`.

## Third dispatch

Command:

```bash
gh workflow run deploy.yml --ref main -f environment=production --repo raultorres2603/CubeClicker
```

- Response: `https://github.com/raultorres2603/CubeClicker/actions/runs/46000139093`.
- run_id=46000139093
- Run metadata: event `workflow_dispatch`, head branch `main`, head SHA `d10dfb1`, created `2026-11-27T12:37:06Z`, conclusion `failure`, URL `https://github.com/raultorres2603/CubeClicker/actions/runs/46000139093`.
- The post-dispatch manual list contains exactly one new run (`46000139093`), the second attempt (`45998841039`), the first attempt (`45993542551`) and the pre-feature `45700752621`.

## Approval (third attempt)

- The run paused with status `waiting` for the `production` Environment.
- `GET /repos/raultorres2603/CubeClicker/actions/runs/46000139093/pending_deployments` returned the `production` environment (id `25891960251`) with `current_user_can_approve: true`.
- `POST /repos/raultorres2603/CubeClicker/actions/runs/46000139093/pending_deployments` with body `{"environment_ids":[25891960251],"state":"approved","comment":"T6 live production deploy proof (re-run after the owner replaced the production BREVO_API_KEY): approved by the authenticated repository owner."}` was accepted.
- Approval read-back (`GET .../runs/46000139093/approvals`): `{"comment":"T6 live production deploy proof (re-run after the owner replaced the production BREVO_API_KEY): approved by the authenticated repository owner.","environments":["production"],"state":"approved","user":"raultorres2603"}`.
- approval: authenticated owner via GitHub API
- The protection gate was not bypassed: the `required_reviewers` rule and the `main`-only branch policy remained in place; no protection was removed or weakened.

## Third outcome

- Job `deploy` started `2026-11-27T12:37:21Z` and completed `2026-11-27T12:38:24Z` with conclusion `failure`.
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
- The GitHub Environment secret metadata proves the value received by the workflow is unchanged from the T5a hand-off; the owner's replacement has not reached this secret.
- No value, key or sender address is recorded in this log; the Actions log masks the secrets and this build log records only the guard's fixed message lines.

## Provider state after the third attempt (read-only)

- Render service `srv-dc4mjd15efls739ua63g` (`cubeclicker`): the latest deploy is still `dep-dc4mjuu1egvs7391bjgg`, status `live`, created `2026-11-27T11:31:07Z`, finished `2026-11-27T11:32:48Z` — the T4-era provider deploy, created before all three T6 dispatches. No new production Render deploy exists.
- Vercel production project `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH` (`cubeclicker`): `latestDeployment: null`; `list_deployments` returns `count: 0`. No production Vercel deployment exists.
- Neon project `patient-mountain-41401588`: branch `production` is still present as `br-floral-dream-zarerhtw` (`primary: true`, `default: true`, `current_state: ready`, `protected: false`); the `development` branch `br-ancient-smoke-za1pdv7w` is also present. No branch was created, deleted or re-created; the migration step never ran on any T6 attempt.
- Read-only `/healthz` observation on `https://cubeclicker.onrender.com`: HTTP `200` with exactly `{"status":"ok"}`, served by the T4-era deploy. This is a liveness observation only, not the T6 post-deploy proof.
- `No rollback to development`
- `No deletion of the existing Neon production branch`

## Prior failed attempts (retained history)

### Second attempt (owner-key failure) — run `45998841039`

- 2026-11-27T12:27:50Z, `workflow_dispatch`, `main`, commit `d10dfb1`; failed at `Check deployment Brevo configuration` with the same Brevo SMTP-key guard output; all later steps skipped; no provider touched.
- Its `BREVO_API_KEY` secret metadata was already `updated_at: 2026-11-27T11:36:46Z`, i.e. the same value the third attempt received.

### First attempt (CI-preflight failure) — run `45993542551`

- 2026-11-27T11:49:03Z, `workflow_dispatch`, `main`, commit `00e2359c`; failed at `Verify CI succeeded for target commit` because the step ran before `Checkout` and called `gh run list` without `--repo`/`GH_REPO`. Exact output then:

```
failed to determine base repo: failed to run git: fatal: not a git repository (or any of the parent directories): .git
Unable to query CI runs for 00e2359c; the token may lack actions:read
##[error]Process completed with exit code 1.
```

- The pre-feature manual run `45700752621` (2026-11-25, commit `b7dbcb98`) failed at the same step with the identical message.
- T6a (PR #4, merge `d10dfb1`) fixed the missing repository context; the second and third attempts prove the guard now executes and prints `CI succeeded for d10dfb1`.
- No provider step ran on the first attempt either; the full log was written only to a temp file under `/tmp/opencode` and deleted after the evidence extraction.

## Blocker and owner action

Exact action required from the owner: set the **GitHub Environment** secret `production` → `BREVO_API_KEY` to a Brevo **REST API key** — created under Brevo Settings → SMTP & API → API Keys (prefix `xkeysib-`), not an SMTP key (`xsmtpsib-`) and not the same value as `SMTP_PASS` — using the GitHub UI (**Settings → Environments → production → Secrets**) or `gh secret set BREVO_API_KEY --env production` on stdin. Updating the Render service environment, the development Environment or the Brevo account alone does not change the value this workflow reads.

Before re-running, verify by name/metadata only that the production secret's `updated_at` has advanced past `2026-11-27T11:36:46Z` (the builder can re-check this without reading the value). Then re-dispatch:

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

- The block is silent on success and stops at the first failing assertion. Here it fails at the run-conclusion check because the first `run_id=` in this log (`46000139093`, the latest attempt) is `workflow_dispatch` / `main` / `failure`, not `success`; the log greps for the guard line, nine `SYNCED` lines, migration, health poll and smoke are unreachable because the run never reached those steps.
- Discrepancy recorded per the task instruction: there is **no successful run** to assert. The verify block currently keys on the first `run_id=` in the log, which is the latest attempt; the prior failed runs are recorded separately under § Prior failed attempts. If a later attempt succeeds, its `run_id=` must become the first occurrence (or the block must be amended) so the verify asserts the successful run.
- Supplementary checks over this build log (the verify block's credential guards, run separately): connection-string pattern and credential-shape pattern both find no match; `.env*` is untouched.

## Acceptance audit

- **AC-7 — live production deploy proves the path end to end:** **unmet / blocked.** (a) is satisfied for the third attempt — `workflow_dispatch` from `main` with `environment=production`, dispatched only after CI for `d10dfb1` reported `success`, no push-triggered production deploy — but (b)–(i) are unproven: the `Deploy configuration OK: 11 value(s) ...` line, the nine `SYNCED` lines, `Synced 9 value(s) to Render service ...`, migration output, `healthz OK after <n>s: {"status":"ok"}`, the Vercel deployment and `DEPLOYED SMOKE PASS (8/8 checks)` did not run. The value guard failed closed before the migration and before any provider call.
- **AC-8(c) — no rollback to development, no Neon branch deletion:** **met so far.** `No rollback to development`; `No deletion of the existing Neon production branch`; `br-floral-dream-zarerhtw` is present and no development resource was targeted by this task.
- **AC-11 — partial failure handled safely:** **met for the failures that occurred.** All three attempts failed before any migration or provider call; no resource was deleted or suspended, no rollback to development occurred, and the pre-existing Neon branch was retained. The fix-forward requirement now needs the owner to set the GitHub `production` secret; this log does not bypass the guard.
- **Testing tiers:** T6 is an infrastructure task (`tasks.md` T1–T6 add no application tests or coverage target); the live run and deployed smoke are the feature-appropriate E2E proof but have not executed successfully yet. T8 owns the full repository suite/no-regression gate.

## Deviations from spec

- None performed. The task did not edit a workflow, bypass the guard, set an owner-held secret, dispatch development, roll back or delete the Neon branch. The only repository change is this build log; `.env*` is untouched and nothing was pushed.
