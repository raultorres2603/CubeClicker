# Build log — T3 — Live prior-build `build_sha` proof and automatic development proof

Task: T3 (2026-11-27; re-run on the merged r4 optional-`build_sha` contract)
Files changed: `docs/features/production-build-selection/build-log-T3.md` (only)
Shortened evidence: 7–12 character SHAs; full SHAs only in the temporary run logs

## Supersession of the earlier T3 proof

- This log **supersedes the earlier T3 `previous-1` evidence** (old run `46060367835`, old `build` choice contract). The owner replaced the `build` dropdown (`latest`/`previous-1` … `previous-9`) with the optional `build_sha` text input: empty = latest successful `CI` push build on `main`; set = that exact commit. The old run and its `previous-1` lines remain historical only and are not current evidence.
- The proof below is re-run from the merged r4 base: exact prior build via `-f build_sha=<prior-full-sha>`, then a no-`build_sha` latest restore, plus the post-merge automatic development deploy.

## What changed & why

- Proved the shipped optional-`build_sha` contract on the merged `main`: a production dispatch pinned a known-good prior successful `CI` push build on `main` and deployed exactly that SHA to Render and Vercel, with the Render completion/current-deploy proof, health and smoke; a no-`build_sha` dispatch then restored production to the newest successful build.
- Proved the automatic development path after the merge: the `workflow_run` Deploy run checked out the merge head, used the hook + 45 s head start, passed the development guard/sync/health and smoke.
- Recorded provider read-backs, the protections actually enforced, and the post-run health. No workflow, application, provider or environment change was made by this task.

## Preflight (dependency and merge gate)

- `Feature merge: 2b7764f17` — squash merge of `feat/production-build-selection` into `main` (PR #6) on top of the previous merged state `5209d804a`; it replaces the static `build` choice with the optional `build_sha` input.
- `origin/main` at the merge head has exactly the two dispatch inputs `environment` + `build_sha` (no `build`, no `previous-N`), the T6a `gh run list --repo "$GITHUB_REPOSITORY"` line, the Render API `commitId` + `Wait for Render deploy to complete`/current-deploy proof, and the r4 docs (`README.md` § Production build SHA selection; `deployment.md` § Build selection (production); `vercel-render-neon.md`; `containerization.md`).
- Merge CI `46065738044`: event `push`, branch `main`, head `2b7764f17`, status `completed`, conclusion `success` (jobs `smoke-e2e`, `verify-workflows`, `verify-app` all success).
- Production Environment read-back: 15 variables / 8 secrets (names only); `custom_branch_policies: true` with exactly one `main` policy; protection `required_reviewers,branch_policy`; reviewer `raultorres2603` (`prevent_self_review: false`). No new name was added.

## Pre-live harness

`Pre-live harness: resolver-* and render-* PASS` — `node tests/deploy/gate-fixtures.mjs` exited 0 with 31/31 cases; the required resolver and Render cases passed:

```
Pre-live harness: PASS resolver-latest
Pre-live harness: PASS resolver-latest-unavailable
Pre-live harness: PASS resolver-exact
Pre-live harness: PASS resolver-malformed
Pre-live harness: PASS resolver-development-default
Pre-live harness: PASS resolver-development-non-default
Pre-live harness: PASS render-creation-201
Pre-live harness: PASS render-creation-202
Pre-live harness: PASS render-creation-non-dep
Pre-live harness: PASS render-creation-commit-mismatch
Pre-live harness: PASS render-completion-live
Pre-live harness: PASS render-completion-build-failed
Pre-live harness: PASS render-completion-update-failed
Pre-live harness: PASS render-completion-canceled
Pre-live harness: PASS render-completion-pre-deploy-failed
Pre-live harness: PASS render-completion-deactivated
Pre-live harness: PASS render-completion-timeout
Pre-live harness: PASS render-completion-transient-retry
Pre-live harness: PASS render-completion-current-match
Pre-live harness: PASS render-completion-current-mismatch
```

## Production previous-build proof (exact SHA via `build_sha`)

- `Previous build SHA: 5209d804a` — a known-good prior successful `CI` push build on `main` (deployed live with smoke 8/8 in the earlier proof); the full 40-character SHA was used only in the dispatch command and temporary logs, never in this log.
- Prior-build CI lookup: successful `CI` push run `46060011935` at `2026-11-27T19:55:05Z` (`gh run list --workflow CI --event push --branch main --commit <prior-sha>`); the r4 resolver prints no `CI run:` output for a pinned SHA (it prints `Resolved build: <sha> (pinned)`), and the guard independently re-verifies the CI run.
- Dispatch: `gh workflow run deploy.yml --ref main -f environment=production -f build_sha=<prior-full-sha> --repo raultorres2603/CubeClicker`.
- `Production previous run: https://github.com/raultorres2603/CubeClicker/actions/runs/46066174413`
- run_id: `46066174413`; metadata: event `workflow_dispatch`, head branch `main`, head SHA `2b7764f17`, status `completed`, conclusion `success`.
- Approval: the run entered the `production` Environment gate (`status: waiting`) and was approved through the authenticated owner API (`POST /repos/raultorres2603/CubeClicker/actions/runs/46066174413/pending_deployments`, `environment_ids=[25891960251]`, `state=approved`). Deployment record `8119070781`: environment `production`, ref `main`, creator `raultorres2603`.

Selected build and gates (log lines; SHAs shortened):

```
Resolved build: 5209d804a (pinned)
CI succeeded for 5209d804a
Deploying build 5209d804a to production
Deploy contract OK for 5209d804a (guard/migration/smoke identical to 2b7764f17).
Schema compatibility OK for 5209d804a: 7 migration(s) in build, 7 applied on the target branch.
Deploy configuration OK: 11 value(s) present for the 'production' environment.
```

The nine synced names (exactly nine `SYNCED` lines):

```
SYNCED SMTP_HOST (value verified, not shown)
SYNCED SMTP_PORT (value verified, not shown)
SYNCED SMTP_SECURE (value verified, not shown)
SYNCED SMTP_CONNECTION_TIMEOUT_MS (value verified, not shown)
SYNCED SMTP_FROM (value verified, not shown)
SYNCED SMTP_USER (value verified, not shown)
SYNCED SMTP_PASS (value verified, not shown)
SYNCED EMAIL_TRANSPORT (value verified, not shown)
SYNCED BREVO_API_KEY (value verified, not shown)
```

Render, health, Vercel and smoke (log lines; SHAs shortened):

```
Render deploy: dep-dc4uq1bl550s73ar170g build_in_progress for 5209d804a
Render current deploy: dep-dc4uq1bl550s73ar170g 5209d804a
Render deploy live: dep-dc4uq1bl550s73ar170g for 5209d804a
healthz OK after 0s: {"status":"ok"}
Vercel deployment: https://cubeclicker-5hbwhd1eu-raultorres2603s-projects.vercel.app for 5209d804a
DEPLOYED SMOKE PASS (8/8 checks)
```

Provider read-back (Render/Vercel APIs, shortened SHAs):

```
Render deploy id: dep-dc4uq1bl550s73ar170g
Render deploy status: live
Render deploy commit: 5209d804a
Render deploy trigger: api
Render current deploy: dep-dc4uq1bl550s73ar170g 5209d804a
Vercel deployment id: dpl_2bi37UEKh99U7E3Kh6quReJXAGED
Vercel deployment commit: 5209d804a
Vercel deployment state: READY
```

- The Render service's current deploy became `dep-dc4uq1bl550s73ar170g` (`status: live`, trigger `api`, commit `5209d804a`); the prior deploy `dep-dc4u3jk9v7es738dip4g` (`5209d804a`) is `deactivated`.
- `No mixed revision`: resolver (`5209d804a`) = checkout (`5209d804a`) = Render `.commit.id`/current deploy (`5209d804a`) = Vercel deployment metadata (`5209d804a`); no provider used another revision.

## Latest restore (no `build_sha`)

- Dispatch: `gh workflow run deploy.yml --ref main -f environment=production --repo raultorres2603/CubeClicker` (no `build_sha`).
- `Production latest run: https://github.com/raultorres2603/CubeClicker/actions/runs/46066583737`
- run_id: `46066583737`; metadata: event `workflow_dispatch`, head branch `main`, head SHA `2b7764f17`, status `completed`, conclusion `success`.
- Approval: the run entered the `production` Environment gate and was approved through the authenticated owner API (same `pending_deployments` call, `environment_ids=[25891960251]`, `state=approved`). Deployment record `8119124343`: environment `production`, ref `main`, creator `raultorres2603`.

Selected build and gates (log lines; SHAs shortened):

```
Resolved build: 2b7764f17 (latest)
CI run: 46065738044 2026-11-27T20:45:05Z
CI succeeded for 2b7764f17
Deploying build 2b7764f17 to production
Deploy contract OK for 2b7764f17 (guard/migration/smoke identical to 2b7764f17).
Schema compatibility OK for 2b7764f17: 7 migration(s) in build, 7 applied on the target branch.
Deploy configuration OK: 11 value(s) present for the 'production' environment.
```

- The same nine `SYNCED <name> (value verified, not shown)` lines were emitted (one per deployed name).
- Render/health/Vercel/smoke:

```
Render deploy: dep-dc4urudg1s2s73fuaa5g build_in_progress for 2b7764f17
Render current deploy: dep-dc4urudg1s2s73fuaa5g 2b7764f17
Render deploy live: dep-dc4urudg1s2s73fuaa5g for 2b7764f17
healthz OK after 0s: {"status":"ok"}
Vercel deployment: https://cubeclicker-ggl0ctjqb-raultorres2603s-projects.vercel.app for 2b7764f17
DEPLOYED SMOKE PASS (8/8 checks)
```

Provider read-back (shortened SHAs):

```
Render deploy id: dep-dc4urudg1s2s73fuaa5g
Render deploy status: live
Render deploy commit: 2b7764f17
Render deploy trigger: api
Render current deploy: dep-dc4urudg1s2s73fuaa5g 2b7764f17
Vercel deployment id: dpl_CKdzBvUnpCCvQxzTQyDKzCREwm2X
Vercel deployment commit: 2b7764f17
Vercel deployment state: READY
```

- `No mixed revision`: resolver (`2b7764f17`) = checkout (`2b7764f17`) = Render `.commit.id`/current deploy (`2b7764f17`) = Vercel deployment metadata (`2b7764f17`). Production ends on the latest successful build; the pinned `dep-dc4uq1bl550s73ar170g` (`5209d804a`) is `deactivated`.

## Automatic development proof

- `Development automatic run: https://github.com/raultorres2603/CubeClicker/actions/runs/46066138982`
- run_id: `46066138982`; metadata: event `workflow_run`, head branch `main`, head SHA `2b7764f17` (the merge head), status `completed`, conclusion `success`. Triggered by CI `46065738044`; no dispatch, no `build_sha`.
- The dispatch-only resolver, CI guard, deploy-contract and schema steps are `skipped` on this path; `Reject non-push CI runs` is skipped because the CI run event is `push`.

Log lines (SHAs shortened):

```
Deploying build 2b7764f17 to development
Deploy configuration OK: 11 value(s) present for the 'development' environment.
```

- The nine `SYNCED` lines: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_TRANSPORT`, `BREVO_API_KEY` — each exactly `SYNCED <name> (value verified, not shown)` (nine total).
- The automatic completion branch kept the existing behavior: `Render deploy hook started; using the existing 45 s head start (no deploy id to poll).` No live-poll claim is made for the automatic path.
- `/healthz` and smoke:

```
healthz OK after 14s: {"status":"ok"}
Vercel deployment: https://cubeclicker-development-4fx9pubd6-raultorres2603s-projects.vercel.app for 2b7764f17
DEPLOYED SMOKE PASS (8/8 checks)
```

Provider read-back (shortened SHAs):

```
Render deploy id: dep-dc4upq6i0phs73bnn1ug
Render deploy status: live
Render deploy commit: 2b7764f17
Render deploy trigger: deploy_hook
Vercel deployment id: dpl_CJmfpfsugx3rVtmbpjPPxjF3cUS2
Vercel deployment commit: 2b7764f17
Vercel deployment state: READY
```

- `No mixed revision` on development: checkout (`2b7764f17`) = Render current deploy commit (`2b7764f17`) = Vercel metadata (`2b7764f17`); the automatic path's pre-existing main-advance race was not triggered (Render built the same head).

## Protection, health and credential evidence

- `Protection gate: not bypassed` — both production runs waited at the `production` Environment gate and were approved via the authenticated owner API; the `main`-only branch policy and required reviewer remained in force; no branch-policy or reviewer bypass, no direct provider deploy, no `push`-triggered production deploy (both production runs are `workflow_dispatch` from `main`).
- `POST-RUN HEALTH 200` — `https://cubeclicker.onrender.com/healthz` returned exactly `{"status":"ok"}`; `PRODUCTION FRONTEND 200` — `https://cubeclicker.vercel.app/` returned 200.
- Anchored production endpoints: `production frontend: https://cubeclicker.vercel.app`; `production api: https://cubeclicker.onrender.com`.
- No secret, connection string or credential is recorded here; only names, ids, statuses and shortened SHAs. `.env*` was not touched (`git status --porcelain -- '.env*'` empty). Full 40-character SHAs stayed only in the temporary run logs (`/tmp/opencode/pbs-prev2.log`, `/tmp/opencode/pbs-latest2.log`, `/tmp/opencode/pbs-dev2.log`), which are deleted by the T3 verify.

## Acceptance audit

- AC-4(d) → met: the pinned and latest runs record the same shortened SHA in the resolver line, checkout line, Render creation `.commit.id`, completion `status: live`/current-deploy ID+commit and the Vercel deployment metadata (`Vercel deployment commit`); no provider shows a different revision, so `No mixed revision` holds and no `Vercel metadata projection: unavailable` fallback was needed.
- AC-5(c) → met: `Wait for Render deploy to complete` polled `dep-dc4uq1bl550s73ar170g` and `dep-dc4urudg1s2s73fuaa5g` to `status: live`, then the current-deploy read-back matched the selected deploy/SHA before health/Vercel/smoke; the automatic path kept the hook + 45 s head start.
- AC-7(d) → met: the post-merge automatic `workflow_run` run `46066138982` deployed the merge head `2b7764f17` to development with the development 11-value guard, nine `SYNCED` lines, `/healthz` 200 and `DEPLOYED SMOKE PASS (8/8 checks)`; its checkout line matches the head SHA.
- AC-11 → met: (a) the `build_sha` dispatch resolved and deployed the exact prior SHA live with every required line and the Render live/current proof; (b) the no-`build_sha` dispatch resolved the newest successful build and restored production; (c) both runs are `workflow_dispatch`/`main`, the protection rule was not bypassed and no production `push` deploy exists; (d) no secret/connection string/credential appears, the post-run health is 200 with the exact body, the evidence is labeled with 7–12 character SHAs and full SHAs exist only in the deleted temporary logs.
- AC-12(e) → partially evidenced here: the live proof is reproducible from the recorded run IDs and the public `/healthz`; the final repository gate and feature-index proposal remain T4.

## T3 verify

- The exact `tasks.md` T3 verify block (r4) was executed after this log was written; raw output is recorded in § T3 verify output below.

## T3 verify output

- `bash /tmp/opencode/t3-verify.sh > /tmp/opencode/t3-verify-out.log 2>&1` → exit 0 (full block: `npm ci`, build-log guards, the 20 `resolver-*`/`render-*` harness cases, `gh run view` metadata and log greps for the pinned/latest/development runs, provider read-back greps, post-run health fetch, temp-log deletion and the no-full-SHA/no-credential/`.env*` guards).
- Run metadata checks: `workflow_dispatch	main	success` (pinned `46066174413`), `workflow_dispatch	main	success` (latest `46066583737`), `workflow_run	main	success` (development `46066138982`).
- Post-run health: `HTTP 200 {"status":"ok"}`.

Raw output (tail):

```
T3_VERIFY_EXIT=0
HTTP 200 {"status":"ok"}
```

## Deviations from spec

None. The previous-log T3 `previous-1` proof is superseded by this exact-SHA `build_sha` proof on the merged r4 contract.
