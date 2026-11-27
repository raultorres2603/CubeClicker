# Build log — T1 — Build-selection workflow contract, completion proof, CI parse and gate harness

Task: T1 (2026-11-27)
Branch: `feat/production-build-selection` from `origin/main` `de5b829`
Files changed: `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `tests/deploy/gate-fixtures.mjs`, `docs/features/production-build-selection/build-log-T1.md`

## What changed & why

- `deploy.yml`: adds the `build` (`latest`, `previous-1` … `previous-9`, default `latest`) and optional `build_sha` dispatch inputs (environment input untouched); a pre-checkout `Resolve selected build` step (Actions API, dedupe/index, `build_sha` validation, development selection rejection, `sha`/`source` outputs); a resolved-SHA CI guard with `--event push --branch main` plus the on-`main` compare check; selected-SHA checkout and confirm; deploy-contract and schema-compatibility gates; Render API `commitId` creation plus a live completion/current-deploy proof; Vercel same-SHA metadata. The 21-step order and the automatic `workflow_run` path are preserved.
- `ci.yml`: updates `Validate deploy workflow dispatch choices` to the three-input/`workflow_run` contract and adds `Validate deploy build selection contract` at the pinned position (11-step `verify-workflows` list).
- `tests/deploy/gate-fixtures.mjs`: executes the actual workflow `run` blocks (resolver, guard, contract, schema, Render creation/completion and the CI parse) with stub `gh`/`curl`, a local git remote and a stub `pg`; 34 cases with exact-message assertions.

## Decisions

- The resolver uses the Actions API instead of a second `gh run list`, so the T6a "exactly one `gh run list`" invariant stays true; the guard is the only `gh run list` and keeps `--repo "$GITHUB_REPOSITORY"`.
- Render HTTP 202 fails closed because it carries no deploy ID; a 201 `created`/`queued` deploy is polled to `live`, then the service's current deploy ID/commit must match the selected deploy/SHA.
- The completion timeout/poll defaults are env-driven in the step (`${RENDER_DEPLOY_TIMEOUT_SECONDS:-900}`, `${RENDER_DEPLOY_POLL_INTERVAL_SECONDS:-10}`); the workflow sets neither, and the harness overrides them.
- The deploy-contract gate excludes migration SQL on purpose: the selected build carries its own migration set, which the schema gate validates by name under the immutable-migration policy.
- The gate harness extracts the real `run` strings from the YAML and stubs only external surfaces; no gate logic is reimplemented.

## Evidence

Dependency gate: production-provisioning accepted
- `git show origin/main:docs/features/production-provisioning/status.md` → `3:state: accepted`.
- `git show origin/main:.github/workflows/deploy.yml` → 1 occurrence; local `deploy.yml` → 1 occurrence.
- T6a fix present on origin/main and locally (counts above; the line is `gh run list --repo "$GITHUB_REPOSITORY"`).
- `gh api .../environments/production` → `{"branch_policies":true,"protection":"required_reviewers,branch_policy"}`; deployment branch policy → `main`; `gh variable list --env production` → 15 names; `gh secret list --env production` → 8 names.

Workflow contract parse (the T1 verify's Node/js-yaml block):
```
deploy.yml: build selection inputs, 21-step order, completion step and same-SHA checkout pinned
```
`ci.yml` step list + build parse extraction:
```
ci.yml: verify-workflows 11-step list and build parse pinned
```

Diff anchors (all `grep -qF` checks in the T1 verify passed):
- Actions API list URL, `!seen[$1]++`, `sed -n "$((index + 1))p"`, resolver outputs.
- Guard: `--workflow CI --event push --branch main --commit "$TARGET_SHA"`, `compare/$TARGET_SHA...main`, `ahead|identical`.
- Checkout/confirm: `git rev-parse HEAD`, `Checked-out build`, `Deploying build`.
- Contract: seven contract file paths, `git diff --quiet "$PIPELINE_SHA"`, `require.resolve('pg')`, `Deploy contract OK for`.
- Schema: `schema_migrations`, migrations directory, `predates applied migration(s):`, `Schema compatibility OK for`.
- Render: `api.render.com/v1/services/`, `commitId`, `id: render_deploy`, `steps.render_deploy.outputs.deploy_id`, `deploys?limit=1`, `Render deploy live:`, `Render current deploy:`, `RENDER_DEPLOY_HOOK_URL`, 202/non-`dep-`/commit-mismatch/terminal/timeout/current-mismatch messages.
- Vercel: `--meta githubCommitSha`; `ci.yml`: `Validate deploy build selection contract`.
- Invariants: exactly one `gh run list`; no `push:` trigger; the old false 45 s comment phrase is absent; the 29 exact-message greps matched.

Exact messages: PASS

Gate harness (`node tests/deploy/gate-fixtures.mjs`, 34/34): exit 0
```
Gate harness: PASS resolver-latest
Gate harness: PASS resolver-previous-1
Gate harness: PASS resolver-previous-9
Gate harness: PASS resolver-unavailable
Gate harness: PASS resolver-pinned
Gate harness: PASS resolver-dispatch-ref
Gate harness: PASS resolver-malformed
Gate harness: PASS resolver-mixed
Gate harness: PASS resolver-development-non-default
Gate harness: PASS guard-success
Gate harness: PASS guard-ci-failure
Gate harness: PASS guard-missing
Gate harness: PASS guard-not-on-main
Gate harness: PASS contract-pass
Gate harness: PASS contract-changed
Gate harness: PASS contract-missing-pg
Gate harness: PASS schema-pass
Gate harness: PASS schema-missing-007
Gate harness: PASS schema-missing-table
Gate harness: PASS render-creation-201
Gate harness: PASS render-creation-202
Gate harness: PASS render-creation-non-dep
Gate harness: PASS render-creation-commit-mismatch
Gate harness: PASS render-completion-live
Gate harness: PASS render-completion-build-failed
Gate harness: PASS render-completion-update-failed
Gate harness: PASS render-completion-canceled
Gate harness: PASS render-completion-pre-deploy-failed
Gate harness: PASS render-completion-deactivated
Gate harness: PASS render-completion-timeout
Gate harness: PASS render-completion-transient-retry
Gate harness: PASS render-completion-current-match
Gate harness: PASS render-completion-current-mismatch
Gate harness: PASS ci-build-parse
```
Harness coverage detail: resolver latest/previous-1/previous-9/unavailable/pinned/dispatch-ref/malformed/mixed/development-non-default; guard success/failure/missing/not-on-main; contract pass/changed/missing-pg; schema pass/missing-007/missing-table; Render creation 201/202/non-`dep-`/commit-mismatch; Render completion live/terminal statuses/timeout/transient-retry/current-match/current-mismatch; CI parse. Exact messages asserted for every case.

ci.yml parse execution: PASS
```
deploy.yml: build selection contract pinned (resolver, guard, contract, schema, Render API/completion, Vercel and 21-step order)
```
actionlint: pass
```
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/deploy.yml .github/workflows/ci.yml
→ exit 0, no findings
```
Static config parses:
```
vercel.json: valid JSON
render.yaml: one development service, unchanged
```

No application code change
- `git diff --exit-code <base> -- src compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json render.yaml src/frontend/vercel.json` → empty (verify prefix passed).
- The only `tests` addition is `tests/deploy/gate-fixtures.mjs` (verify prefix passed by name).

`npm run coverage`: exit 0
```
backend:  Test Files 52 passed (52), Tests 2093 passed (2093)
frontend: Test Files 83 passed (83), Tests 2867 passed (2867)
backend All files:  97.09 statements | 92.24 branches | 99.65 functions | 97.09 lines
frontend All files: 97.22 statements | 96.80 branches | 98.60 functions | 97.22 lines
```
Thresholds stay 80 on all four metrics per workspace; `npm run lint` also exits 0.

Host note: the first coverage attempt failed only in three PostgreSQL integration suites that start `postgres:16-alpine` containers (`allocation failed; exceeded num_locks (2048)`); pruning 2043 unused anonymous test volumes cleared the host limit, and the re-run above was fully green. No repository change was involved.

T1 verify block: PASS (exit 0) — the full `tasks.md` T1 verify block (`set -euo pipefail`, dependency gate through build-log guards) was executed end to end after this log was written; raw log `/tmp/opencode/t1-verify.log`, and a second run on the committed tree also exited 0 (`/tmp/opencode/t1-verify-postcommit.log`).

Secrets / environment:
- `git status --porcelain -- '.env*'` → empty; `git diff --name-only <base> -- '.env*'` → empty.
- `deploy.yml` has no credential value; `RENDER_API_KEY`/`RENDER_DEPLOY_HOOK_URL`/`DIRECT_DATABASE_URL` are step `env:` only; the Render response body is parsed for `id/status/commit.id` and never printed; the schema error prints `error.message` only.
- Build-log credential guards (database connection-string user/password form, Brevo/Render/Fly token patterns) → no match; no full 40-character SHA in this log (short SHAs only).

## Acceptance audit

- AC-1 → met: the dispatch parse pins exactly the keys `build,build_sha,environment`, the byte-identical `environment` input, the `build` choice/default/options/description, the `build_sha` string/default/description, the two triggers and no `push` trigger.
- AC-2 → met: resolver is dispatch-only/pre-checkout, uses the Actions API with `!seen[$1]++` dedupe and index selection, writes `sha`/`source`, validates `build_sha`, rejects mixes and development selections, and prints `Resolved build`/`CI run`; 9 resolver harness cases PASS.
- AC-3 → met: guard uses `steps.resolve_build.outputs.sha`, the single `gh run list` with `--event push --branch main --repo`, and the compare `ahead|identical`; 4 guard harness cases PASS.
- AC-4 → met: checkout ref is the same expression, `Confirm selected build checkout` asserts `git rev-parse HEAD` and prints `Deploying build`, Render uses the resolved SHA, Vercel adds `--meta githubCommitSha` and prints the same-SHA line; the live read-back is T3.
- AC-5 → met (static): manual dispatches POST `commitId` and require 201 + `dep-` ID + commit match, fail closed on 202/mismatch; completion polls, fails on terminal/timeout/current-mismatch and prints `Render deploy live`/`Render current deploy`; the automatic path keeps the hook and 45 s head start; 14 Render cases PASS (live/current proof is T3).
- AC-6 → met (static): contract gate diffs the seven files against the dispatch ref and requires `pg`; schema gate reads `schema_migrations` (missing table = zero) and compares names under the immutable-migration policy; both run before migration/provider steps; 6 gate cases PASS.
- AC-7(a)-(c) → met: `workflow_run`/job `if`/concurrency unchanged, no `push`; resolver/guard/contract/schema are dispatch-only and the automatic path keeps `head_sha`/hook/45 s; a development dispatch with defaults resolves `dispatch-ref` and a non-default selection fails closed.
- AC-8 → met: the parsed 21-step list matches exactly; one job; production protection read-back (main-only policy + required reviewers) and the 15/8 catalog are unchanged.
- AC-9 → met: both `ci.yml` parses pass, the new parse executes against the real workflow, actionlint exits 0, and the diff is limited to the owned workflow/harness/log files.
- AC-12(a)-(d) (T1 scope) → met: coverage green, no application/container/config change, only the harness under `tests`, `.env*` untouched, no credential or full-SHA leak in this log.

## Deviations from spec

None.
