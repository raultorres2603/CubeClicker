# Build log — T6 — Live production deploy proof

Task: T6 (2026-11-27)
Files changed: `docs/features/production-provisioning/build-log-T6.md` (only; no application code, workflow, provider asset, architecture doc, `status.md` or `docs/features/README.md` edit)
What changed & why: Confirmed the `main` SHA's CI success, confirmed the 23 production names and the protection gate, dispatched the production deploy from `main`, approved the protection gate through the authenticated owner session, and captured the run. The run failed at the pre-provider `Verify CI succeeded for target commit` step because `gh run list` runs before `Checkout` and has no repository argument; no provider was touched. T6 is blocked on a one-line workflow fix that the feature spec's Non-goals forbid and this task does not own, so no out-of-scope edit and no second dispatch were made.
Decisions: Approval used the authenticated owner session through the GitHub API (not the UI); the guard was not bypassed, no development deploy was dispatched, no rollback was performed and the pre-existing Neon branch was not deleted. The failure is a pre-existing `deploy.yml` defect, not a value/catalog/protection failure; the only available fix changes a CI step body on `main`, so the task reports blocked with a candidate fix instead of improvising scope.
Testing note: T6 is the feature's live-proof infrastructure task per `tasks.md` (provider/GitHub state plus a build log; no application code). The feature-appropriate end-to-end proof is the workflow run with the deployed smoke; it could not execute because the run stopped before any provider step. No repository unit/integration test boundary exists for the live deploy, and T8 owns the full repository suite/no-regression gate.

## Status: BLOCKED

- The production deploy run `45993542551` failed at `Verify CI succeeded for target commit` with `failed to determine base repo: failed to run git: fatal: not a git repository (or any of the parent directories): .git`.
- The step executes before `actions/checkout`, and its `gh run list` command has neither `--repo` nor a `GH_REPO` environment mapping, so `gh` cannot resolve the repository from the empty runner workspace.
- Fixing it requires a non-comment CI step-body change to `.github/workflows/deploy.yml` on `main`. The feature spec § Non-goals explicitly forbids a "CI step-body change", T7's verify requires an empty non-comment diff for `deploy.yml`, and T6's `files_owned` is this build log only; the builder cannot push to `main` in any case. See § Blocker for the exact question and candidate answers.

## Pre-dispatch gates

### CI for the `main` SHA

`gh run list --workflow CI --commit "$(git rev-parse origin/main)" --limit 3 --json databaseId,conclusion,headSha,status`:

```
45957565326	completed	success	00e2359c79e2713422a0a0ef8421d6fff47f16b2
```

- The `main` SHA is `00e2359c79e2713422a0a0ef8421d6fff47f16b2`; its CI run `45957565326` is `completed` / `success`.
- The workflow's own `CI succeeded for <commit>` line was never reached (the guard failed before printing it); see § Failure.

### Production Environment (names only)

- `gh variable list --env production ... --json name`: 15 variables; `gh secret list --env production ... --json name`: 8 secrets; total 23 names.
- Protection read-back: `required_reviewers` naming `raultorres2603` (id `55553058`) with `prevent_self_review: false`, plus the `branch_policy` rule; `deployment_branch_policy` is `custom_branch_policies: true`, and the deployment-branch-policies list contains exactly the `main` policy (id `68496749`).
- Environment id: `25891960251`. No secret or variable value was read.

### Dispatch baselines

`gh run list --workflow Deploy --event workflow_dispatch --limit 5` before dispatch:

```
45700752621	2026-11-25T21:03:20Z	main	completed	failure
```

- The only prior manual deploy run was `45700752621` (2026-11-25, commit `b7dbcb985e31c56619a87386179900c081b2f052`), also a failure; it failed at the same guard with the same `failed to determine base repo` message (corroboration in § Failure).

## Dispatch

Command:

```bash
gh workflow run deploy.yml --ref main -f environment=production --repo raultorres2603/CubeClicker
```

- Response: `https://github.com/raultorres2603/CubeClicker/actions/runs/45993542551`.
- The post-dispatch list contains exactly one new run:

```
45993542551	2026-11-27T11:49:03Z	main	waiting		https://github.com/raultorres2603/CubeClicker/actions/runs/45993542551
45700752621	2026-11-25T21:03:20Z	main	completed	failure	https://github.com/raultorres2603/CubeClicker/actions/runs/45700752621
```

- run_id=45993542551
- Run metadata: event `workflow_dispatch`, head branch `main`, head SHA `00e2359c79e2713422a0a0ef8421d6fff47f16b2`, created `2026-11-27T11:49:03Z`, updated `2026-11-27T11:49:21Z`, conclusion `failure`, URL `https://github.com/raultorres2603/CubeClicker/actions/runs/45993542551`.

## Approval

- The run paused with status `waiting` for the `production` Environment.
- `GET /repos/raultorres2603/CubeClicker/actions/runs/45993542551/pending_deployments` returned the `production` environment (id `25891960251`) with `current_user_can_approve: true`.
- `POST /repos/raultorres2603/CubeClicker/actions/runs/45993542551/pending_deployments` with body `{"environment_ids":[25891960251],"state":"approved","comment":"T6 live production deploy proof: approved by the authenticated repository owner."}` was accepted; the run moved to `in_progress` and the pending list became empty.
- Approval read-back (`GET .../runs/45993542551/approvals`): `{"comment":"T6 live production deploy proof: approved by the authenticated repository owner.","environments":["production"],"state":"approved","user":"raultorres2603"}`.
- approval: authenticated owner via GitHub API
- The protection gate was not bypassed: the `required_reviewers` rule and the `main`-only branch policy remained in place; no protection was removed or weakened.

## Failure

Run `45993542551` conclusion `failure`, job `deploy` started `2026-11-27T11:49:18Z` and completed `2026-11-27T11:49:21Z`.

Failing step: `Verify CI succeeded for target commit` (`conclusion: failure`). `Set up job` succeeded; `Reject non-push CI runs` was skipped (dispatch path); every step after the guard — `Checkout`, `Setup Node`, `Install dependencies`, `Check deployment Brevo configuration`, `Migrate Neon database`, `Sync Brevo SMTP settings to Render`, `Deploy Render backend`, `Wait for Render deploy to start`, `Wait for Render backend health`, `Install Vercel CLI`, `Pull Vercel project settings`, `Build Vercel frontend`, `Deploy Vercel frontend`, `Warm Render backend before smoke`, `Run deployed smoke` — is `skipped`.

Exact guard block (the failing step's run body):

```bash
if ! conclusion=$(gh run list --workflow CI --commit "$TARGET_SHA" --limit 1 --json conclusion --jq '.[0].conclusion'); then
  echo "Unable to query CI runs for $TARGET_SHA; the token may lack actions:read" >&2
  exit 1
fi
if [ "$conclusion" != "success" ]; then
  echo "CI for $TARGET_SHA is not successful (conclusion: ${conclusion:-none}); refusing to deploy" >&2
  exit 1
fi
echo "CI succeeded for $TARGET_SHA"
```

Exact failure output:

```
failed to determine base repo: failed to run git: fatal: not a git repository (or any of the parent directories): .git
Unable to query CI runs for 00e2359c79e2713422a0a0ef8421d6fff47f16b2; the token may lack actions:read
##[error]Process completed with exit code 1.
```

- Root cause: the step runs before `Checkout`, so the runner workspace has no `.git`; `gh run list` resolves the target repository from the git remote and fails before querying. The job has `actions: read` permission, so the "token may lack actions:read" hint is not the cause.
- Corroboration: the only prior manual dispatch (`45700752621`, 2026-11-25, commit `b7dbcb98…`) failed at the same step with the identical `failed to determine base repo` message; this is a pre-existing defect of the manual path, not a production value, catalog or protection failure.
- The failure happened before the guard read any GitHub Environment value and before any provider step; no Neon migration, sync, Render hook, Vercel build or smoke ran. The full workflow log was written only to a temp file under `/tmp/opencode` and deleted after this extraction.

## Provider state after the failed run (read-only)

- Render service `srv-dc4mjd15efls739ua63g` (`cubeclicker`): `suspended: not_suspended`, `updatedAt: 2026-11-27T11:32:48.677457Z`. Its latest deploy is `dep-dc4mjuu1egvs7391bjgg`, status `live`, created `2026-11-27T11:31:07Z`, finished `2026-11-27T11:32:48Z` — i.e. the T4-era provider deploy, created before the `11:49:03Z` dispatch. No new Render deploy was created by this run.
- Vercel project `prj_1NUoVWaPsgmFe8QtKJ1JuckhwplH` (`cubeclicker`): `latestDeployment: null`; `list_deployments` returns `count: 0`. No T6 Vercel build or deployment exists.
- Neon project `patient-mountain-41401588`: branch `production` is still present exactly as `br-floral-dream-zarerhtw` (`primary: true`, `default: true`, `current_state: ready`, `protected: false`); the `development` branch `br-ancient-smoke-za1pdv7w` is also present. No branch was created, deleted or re-created; the migration step never ran.
- Read-only `/healthz` observation on `https://cubeclicker.onrender.com`: HTTP `200` with exactly `{"status":"ok"}`, served by the T4-era deploy. This is a liveness observation only, not the T6 post-deploy proof.
- `No rollback to development`
- `No deletion of the existing Neon production branch`

## Blocker

Exact question: may the `production` deploy guard be fixed by a one-line CI step-body change to `.github/workflows/deploy.yml` on `main` before T6 is re-dispatched — adding `--repo "$GITHUB_REPOSITORY"` to the `gh run list` call (or a step-level `GH_REPO: ${{ github.repository }}` env mapping) in `Verify CI succeeded for target commit`?

Why the current spec cannot proceed:

- The feature spec § Non-goals says "No ... CI step-body change."
- T7's verify requires the `deploy.yml` non-comment diff to be empty, so the required fix would fail T7 as written; the manual-path docs (`deployment.md`, `vercel-render-neon.md`) also describe the guard as working.
- T6's `files_owned` is only this build log, and the builder cannot push; the fix must reach `main` before `gh workflow run --ref main` can exercise it.
- The guard must not be bypassed, so re-dispatching the same broken workflow would produce the identical failure.

Candidate answers:

1. **Authorize a spec amendment and a small workflow-fix step** (e.g., a T6a task or a T7 pre-step) that adds `--repo "$GITHUB_REPOSITORY"` (or the `GH_REPO` step env) to the guard, updates T7's non-comment-diff guard and the two architecture references, merges to `main`, and then re-runs the same `gh workflow run deploy.yml --ref main -f environment=production` dispatch. This keeps the CI-success guard intact (it would then query and enforce the same conclusion) and makes the documented manual path functional for both environments.
2. **Keep the no-step-body-change rule** and leave the feature fail-closed at T6: provisioning stays complete but production stays unpromoted, with the live proof recorded as unobtainable until a follow-up feature fixes the manual path. No bypass, no development deploy, no rollback, no Neon branch deletion.

## Verify

Command: the exact T6 verify block from `tasks.md` (the `bash` block under `## T6 — Live production deploy proof`, lines 264–290), extracted to `/tmp/opencode/t6/t6-verify.sh` and run as `bash /tmp/opencode/t6/t6-verify.sh`; `set -euo pipefail` is inside the block. Raw output:

```
$ bash /tmp/opencode/t6/t6-verify.sh
$ echo "VERIFY_EXIT=$?"
VERIFY_EXIT=1
```

- The block is silent on success and stops at the first failing assertion. Here it fails at the run-conclusion check because run `45993542551` is `workflow_dispatch` / `main` / `failure`, not `success`; the later log greps (guard line, nine `SYNCED` lines, migration, health poll, smoke) are unreachable because the run never reached those steps.
- Supplementary checks over this build log (the verify block's credential guards, run separately): connection-string pattern and credential-shape pattern both find no match.

## Acceptance audit

- **AC-7 — live production deploy proves the path end to end:** **unmet / blocked.** (a) is partly satisfied — the run is a `workflow_dispatch` from `main` with `environment=production`, dispatched only after CI for the `main` SHA reported `success`, and no push-triggered production deploy exists — but (b)–(i) are unproven: the guard step printed neither the 11-value line nor `CI succeeded for`; the nine `SYNCED` lines, `Synced 9 value(s) to Render service`, migration output, `healthz OK after <n>s: {"status":"ok"}`, Vercel deployment, `DEPLOYED SMOKE PASS (8/8 checks)` and the post-run proof did not run. The 200 `/healthz` observation is from the T4-era deploy.
- **AC-8(c) — no rollback to development, no Neon branch deletion:** **met so far.** `No rollback to development`; `No deletion of the existing Neon production branch`; the branch is present (`br-floral-dream-zarerhtw`) and no development resource or deployment was targeted.
- **AC-11 — partial failure handled safely:** **met for the failure that occurred.** The failure was before any migration or provider call; no resource was deleted or suspended, no rollback to development occurred, and the pre-existing Neon branch was retained. The fix-forward requirement needs the workflow fix authorized above; this log does not bypass the guard.
- **Testing tiers:** T6 is an infrastructure task (`tasks.md` T1–T6 add no application tests or coverage target); the live run and deployed smoke are the feature-appropriate E2E proof but could not execute. T8 owns the full repository suite/no-regression gate.

## Deviations from spec

- None performed. The task stopped at a pre-existing workflow defect rather than editing an out-of-scope CI step body or bypassing the guard. No provider write, no development deploy, no rollback, no deletion and no push occurred; `.env*` is untouched.
