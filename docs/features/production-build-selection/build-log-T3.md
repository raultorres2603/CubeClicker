# Build log — T3 — Live selected-build proof and automatic development proof

Task: T3 (2026-11-27)
Files changed: `docs/features/production-build-selection/build-log-T3.md` (only)
Shortened evidence: 7–12 character SHAs; full SHAs only in the temporary run logs

## What changed & why

- Proved the shipped build selection on the merged `main`: a production dispatch of `previous-1` resolved and deployed one previous successful `CI` push build on `main` (Render API deploy-by-commit + completion/current-deploy proof, Vercel same-SHA build, health, smoke), then a `latest` dispatch restored production to the newest successful build.
- Proved the automatic development path after the merge: the `workflow_run` Deploy run for the merge head checked out that head, used the hook + 45 s head start, passed the development guard/sync/health and the deployed smoke.
- Recorded provider read-backs (Render deploy ids/status/commits; Vercel deployment ids/metadata), the protections actually enforced, and the post-run health. No workflow, application, provider or environment change was made by this task.

## Preflight (dependency and merge gate)

- `Feature merge: 5209d804a` — fast-forward merge of `feat/production-build-selection` into `main`: T1 `2e648ed48` and T2 `142ea984e` are on `origin/main`; `5209d804a` is the pushed merge head (with the orchestrator status commit) and its CI run is the merge's CI.
- `origin/main` anchors confirmed on the pushed merge head: `build`/`build_sha` dispatch inputs, `Resolve selected build`, the Render API `commitId` and `Wait for Render deploy to complete` steps, `gh run list --repo "$GITHUB_REPOSITORY"`, and the T2 docs (`README.md` § Production build selection, `deployment.md` § Build selection (production)).
- Merge-head CI `46060011935`: event `push`, branch `main`, head `5209d804a`, status `completed`, conclusion `success` (jobs `smoke-e2e`, `verify-workflows`, `verify-app` all success).
- Production Environment read-back: 15 variables / 8 secrets (names only); `custom_branch_policies: true` with exactly one `main` policy; protection `required_reviewers,branch_policy`; reviewer `raultorres2603` (`prevent_self_review: false`). No new name was added.

## Pre-live harness

`Pre-live harness: render-* PASS` — `node tests/deploy/gate-fixtures.mjs` exited 0 with 34/34 cases; the 14 live-path cases passed:

```
PASS render-creation-201
PASS render-creation-202
PASS render-creation-non-dep
PASS render-creation-commit-mismatch
PASS render-completion-live
PASS render-completion-build-failed
PASS render-completion-update-failed
PASS render-completion-canceled
PASS render-completion-pre-deploy-failed
PASS render-completion-deactivated
PASS render-completion-timeout
PASS render-completion-transient-retry
PASS render-completion-current-match
PASS render-completion-current-mismatch
```

## Production previous-build proof

- `Production previous run: https://github.com/raultorres2603/CubeClicker/actions/runs/46060367835`
- run_id: `46060367835`; metadata: event `workflow_dispatch`, head branch `main`, head SHA `5209d804a`, status `completed`, conclusion `success`; dispatch: `gh workflow run deploy.yml --ref main -f environment=production -f build=previous-1 --repo raultorres2603/CubeClicker`.
- Approval: the run entered the `production` Environment gate (`status: waiting`) and was approved through the authenticated owner API (`POST /repos/raultorres2603/CubeClicker/actions/runs/46060367835/pending_deployments`, `environment_ids=[25891960251]`, `state=approved`). Deployment record `8118280126`: environment `production`, ref `main`, SHA `5209d804a`, creator `raultorres2603`.

Selected build and gates (log lines; SHAs shortened):

```
Resolved build: de5b829d5 (previous-1)
CI run: 46019910795	2026-11-27T14:53:07Z
CI succeeded for de5b829d5
Deploying build de5b829d5 to production
Deploy contract OK for de5b829d5 (guard/migration/smoke identical to 5209d804a).
Schema compatibility OK for de5b829d5: 7 migration(s) in build, 7 applied on the target branch.
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
Render deploy: dep-dc4u29mi0phs73bksleg build_in_progress for de5b829d5
Render current deploy: dep-dc4u29mi0phs73bksleg de5b829d5
Render deploy live: dep-dc4u29mi0phs73bksleg for de5b829d5
healthz OK after 0s: {"status":"ok"}
Vercel deployment: https://cubeclicker-9q7508ybl-raultorres2603s-projects.vercel.app for de5b829d5
DEPLOYED SMOKE PASS (8/8 checks)
```

Provider read-back (Render/Vercel APIs, shortened SHAs):

```
Render deploy id: dep-dc4u29mi0phs73bksleg
Render deploy status: live
Render deploy commit: de5b829d5
Render deploy trigger: api
Render current deploy: dep-dc4u29mi0phs73bksleg de5b829d5
Vercel deployment id: dpl_EefCVz1PPst24imsqyTHe7vycCMo
Vercel deployment commit: de5b829d5
Vercel deployment state: READY
```

- The Render service's current deploy became `dep-dc4u29mi0phs73bksleg` (`status: live`, trigger `api`, commit `de5b829d5`); the previous deploy `dep-dc4o1fff3r2c73c4asp0` (`d10dfb1ff`) is `deactivated`.
- `No mixed revision`: resolver (`de5b829d5`) = checkout (`de5b829d5`) = Render `.commit.id`/current deploy (`de5b829d5`) = Vercel deployment metadata (`de5b829d5`); no provider used another revision.

## Latest restore

- `Production latest run: https://github.com/raultorres2603/CubeClicker/actions/runs/46060683509`
- run_id: `46060683509`; metadata: event `workflow_dispatch`, head branch `main`, head SHA `5209d804a`, status `completed`, conclusion `success`; dispatch: same command with `-f build=latest` (resolved `latest` explicitly).
- Approval: the run entered the `production` Environment gate and was approved through the authenticated owner API (same `pending_deployments` call, `environment_ids=[25891960251]`, `state=approved`). Deployment record `8118322375`: environment `production`, ref `main`, SHA `5209d804a`, creator `raultorres2603`.

Selected build and gates (log lines; SHAs shortened):

```
Resolved build: 5209d804a (latest)
CI run: 46060011935	2026-11-27T19:55:05Z
CI succeeded for 5209d804a
Deploying build 5209d804a to production
Deploy contract OK for 5209d804a (guard/migration/smoke identical to 5209d804a).
Schema compatibility OK for 5209d804a: 7 migration(s) in build, 7 applied on the target branch.
Deploy configuration OK: 11 value(s) present for the 'production' environment.
```

- The same nine `SYNCED <name> (value verified, not shown)` lines were emitted (one per deployed name).
- Render/health/Vercel/smoke:

```
Render deploy: dep-dc4u3jk9v7es738dip4g build_in_progress for 5209d804a
Render current deploy: dep-dc4u3jk9v7es738dip4g 5209d804a
Render deploy live: dep-dc4u3jk9v7es738dip4g for 5209d804a
healthz OK after 0s: {"status":"ok"}
Vercel deployment: https://cubeclicker-ksv66kv93-raultorres2603s-projects.vercel.app for 5209d804a
DEPLOYED SMOKE PASS (8/8 checks)
```

Provider read-back (shortened SHAs):

```
Render deploy id: dep-dc4u3jk9v7es738dip4g
Render deploy status: live
Render deploy commit: 5209d804a
Render deploy trigger: api
Render current deploy: dep-dc4u3jk9v7es738dip4g 5209d804a
Vercel deployment id: dpl_CXYRLt78JFvr5icsmCJiTFRwKHMk
Vercel deployment commit: 5209d804a
Vercel deployment state: READY
```

- `No mixed revision`: resolver (`5209d804a`) = checkout (`5209d804a`) = Render `.commit.id`/current deploy (`5209d804a`) = Vercel deployment metadata (`5209d804a`). Production ends on the latest successful build; the previous `dep-dc4u29mi0phs73bksleg` (`de5b829d5`) is `deactivated`.

## Automatic development proof

- `Development automatic run: https://github.com/raultorres2603/CubeClicker/actions/runs/46060358305`
- run_id: `46060358305`; metadata: event `workflow_run`, head branch `main`, head SHA `5209d804a` (the merge head), status `completed`, conclusion `success`. Triggered by CI `46060011935`; no dispatch, no build selection.
- The dispatch-only resolver, CI guard, deploy-contract and schema steps are `skipped` on this path; `Reject non-push CI runs` is skipped because the CI run event is `push`.

Log lines (SHAs shortened):

```
Deploying build 5209d804a to development
Deploy configuration OK: 11 value(s) present for the 'development' environment.
```

- The nine `SYNCED` lines: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_TRANSPORT`, `BREVO_API_KEY` — each exactly `SYNCED <name> (value verified, not shown)`.
- The automatic completion branch kept the existing behavior: `Render deploy hook started; using the existing 45 s head start (no deploy id to poll).` No live-poll claim is made for the automatic path.
- `/healthz` and smoke:

```
healthz OK after 0s: {"status":"ok"}
Vercel deployment: https://cubeclicker-development-7gr2cwuen-raultorres2603s-projects.vercel.app for 5209d804a
DEPLOYED SMOKE PASS (8/8 checks)
```

Provider read-back (shortened SHAs):

```
Render deploy id: dep-dc4u28dg1s2s73fr4pl0
Render deploy status: live
Render deploy commit: 5209d804a
Render deploy trigger: deploy_hook
Vercel deployment id: dpl_DxVV2CX8oLwfHPU6GRoEzasYprQC
Vercel deployment commit: 5209d804a
Vercel deployment state: READY
```

- `No mixed revision` on development: checkout (`5209d804a`) = Render current deploy commit (`5209d804a`) = Vercel metadata (`5209d804a`); the automatic path's pre-existing main-advance race was not triggered (Render built the same head).

## Protection, health and credential evidence

- `Protection gate: not bypassed` — both production runs waited at the `production` Environment gate and were approved via the authenticated owner API; the `main`-only branch policy and required reviewer remained in force; no branch-policy or reviewer bypass, no direct provider deploy, no `push`-triggered production deploy (both production runs are `workflow_dispatch` from `main`).
- `POST-RUN HEALTH 200` — `https://cubeclicker.onrender.com/healthz` returned exactly `{"status":"ok"}`; `PRODUCTION FRONTEND 200` — `https://cubeclicker.vercel.app/` returned 200.
- Anchored production endpoints: `production frontend: https://cubeclicker.vercel.app`; `production api: https://cubeclicker.onrender.com`.
- No secret, connection string or credential is recorded here; only names, ids, statuses and shortened SHAs. `.env*` was not touched (`git status --porcelain -- '.env*'` empty). Full 40-character SHAs stayed only in the temporary run logs (`/tmp/opencode/pbs-prev.log`, `/tmp/opencode/pbs-latest.log`, `/tmp/opencode/pbs-dev.log`), which are deleted by the T3 verify.

## Acceptance audit

- AC-4(d) → met: the previous-build and latest runs record the same shortened SHA in the resolver line, checkout line, Render creation `.commit.id`, completion `status: live`/current-deploy ID+commit and the Vercel deployment metadata (`Vercel deployment commit`); no provider shows a different revision, so `No mixed revision` holds and no `Vercel metadata projection: unavailable` fallback was needed.
- AC-5(c) → met: `Wait for Render deploy to complete` polled `dep-dc4u29mi0phs73bksleg` and `dep-dc4u3jk9v7es738dip4g` to `status: live`, then the current-deploy read-back matched the selected deploy/SHA before health/Vercel/smoke; the automatic path kept the hook + 45 s head start.
- AC-7(d) → met: the post-merge automatic `workflow_run` run `46060358305` deployed the merge head `5209d804a` to development with the development 11-value guard, nine `SYNCED` lines, `/healthz` 200 and `DEPLOYED SMOKE PASS (8/8 checks)`; its checkout line matches the head SHA.
- AC-11 → met: (a) previous-1 resolved and deployed live with every required line and the Render live/current proof; (b) `latest` restored production to the newest successful build; (c) both runs are `workflow_dispatch`/`main`, the protection rule was not bypassed and no production `push` deploy exists; (d) no secret/connection string/credential appears, the post-run health is 200 with the exact body, the evidence is labeled with 7–12 character SHAs and full SHAs exist only in the deleted temporary logs.
- AC-12(e) → partially evidenced here: the live proof is reproducible from the recorded run IDs and the public `/healthz`; the final repository gate and feature-index proposal remain T4.

## T3 verify

- The exact `tasks.md` T3 verify block was executed after this log was written; raw output is recorded in § T3 verify output below.

## T3 verify output

- `bash /tmp/opencode/t3-verify.sh > /tmp/opencode/t3-verify-out.log 2>&1` → exit 0 (full block: `npm ci`, build-log guards, pre-live harness `render-*` PASS, `gh run view` metadata and log greps for the previous/latest/development runs, provider read-back greps, post-run health fetch, temp-log deletion and the no-full-SHA/no-credential/`.env*` guards).
- Run metadata checks: `workflow_dispatch	main	success` (previous `46060367835`), `workflow_dispatch	main	success` (latest `46060683509`), `workflow_run	main	success` (development `46060358305`).
- Post-run health: `HTTP 200 {"status":"ok"}`.

Raw output (tail):

```
added 399 packages, and audited 402 packages in 3s
T3_VERIFY_EXIT=0
HTTP 200 {"status":"ok"}
```

The exact `tasks.md` T3 block was re-run on this final log after the raw-output section was added; it exited 0 again (no content change to the runs or provider evidence).

## Deviations from spec

None. The feature reached `main` as a fast-forward (no merge commit); `Feature merge: 5209d804a` records the pushed merge head whose CI run is the merge's CI and the automatic-development trigger.
