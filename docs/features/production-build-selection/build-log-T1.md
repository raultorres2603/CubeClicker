# Build log — T1 — Build-SHA workflow contract, completion proof, CI parse and gate harness

Task: T1 (2026-11-27, r4 rework)
Branch: `feat/production-build-selection` (HEAD `184674d`; post-merge base `5209d80`, pre-merge base `142ea98`)
Files changed: `.github/workflows/deploy.yml`, `.github/workflows/ci.yml`, `tests/deploy/gate-fixtures.mjs`, `docs/features/production-build-selection/build-log-T1.md`

## Rework note

Supersedes the earlier 34-case/dropdown T1 evidence (`2e648ed`). The owner contract change removes the `build` choice entirely: `workflow_dispatch` now exposes exactly `environment` (unchanged) plus the optional `build_sha`. Empty `build_sha` resolves the newest successful `CI` push build on `main`; a set `build_sha` deploys that exact 40-character lowercase SHA (which may not be the latest on `main`). The resolver no longer dedupes, indexes or exposes relative labels, and the harness now has 31 cases (6 resolver + 4 guard + 3 contract + 3 schema + 14 `render-*` + 1 CI parse). The spec/plan/tasks/status/review revisions are orchestrator-owned and are not part of this commit.

## What changed & why

- `deploy.yml`: inputs are exactly `environment` + `build_sha` (`type: string`, `required: false`, `default: ''`, exact description). The resolver queries the Actions API `per_page=1` with `.workflow_runs[0] // empty`, tests the parsed `sha` (not the formatted TSV), captures `head_sha`/`id`/`created_at`, and prints `Resolved build: <sha> (latest)` plus the exact `CI run: <id> <createdAt>` line; a set `build_sha` is regex-validated and resolved as `pinned`; a non-empty development selection is rejected. The sampler works identically for either source.
- Same-SHA enforcement (guard, checkout/confirm, Render API `commitId` + completion/current-deploy proof, contract/schema gates, Vercel `--meta githubCommitSha`) and the 21-step order are unchanged; the automatic `workflow_run` path keeps the hook and 45 s head start.
- `ci.yml`: both parse steps now pin `build_sha,environment`, reject a `build` input, and pin the new resolver/CI anchors and converted 21-step list.
- `tests/deploy/gate-fixtures.mjs`: 31 cases; the resolver fixtures use the real Actions API response shape, including `{"total_count":0,"workflow_runs":[]}` for `resolver-latest-unavailable`.

## Decisions

- The resolver uses the Actions API instead of a second `gh run list`, so the T6a "exactly one `gh run list`" invariant stays true; the guard is the only `gh run list` and keeps `--repo "$GITHUB_REPOSITORY"`.
- Empty `build_sha` is resolved from `.workflow_runs[0] // empty` and is tested on the parsed SHA, so the real empty response (`{"total_count":0,"workflow_runs":[]}`) yields the exact `No successful CI push build found on main; refusing to deploy.` message.
- A set `build_sha` is only a selector: the guard still proves a successful `CI` push run on `main` and the compare `ahead|identical`, then the contract/schema gates decide eligibility.
- Render HTTP 202 fails closed (no deploy ID); a 201 `created`/`queued` deploy is polled to `live`, then the service's current deploy ID/commit must match.
- The completion timeout/poll defaults stay env-driven in the step; the workflow sets neither and the harness overrides them.

## Evidence

Dependency gate: production-provisioning accepted
- `git show origin/main:docs/features/production-provisioning/status.md` → `state: accepted`.
- T6a fix present on origin/main and locally (the `gh run list --repo "$GITHUB_REPOSITORY"` line once on `origin/main`, once locally).
- `gh api .../environments/production` → branch policy custom `true`, protection `required_reviewers,branch_policy`; deployment branch policy → `main`; 15 variables / 8 secrets.

Workflow contract parse (T1 verify Node/js-yaml block):
```
deploy.yml: build_sha input, 21-step order, completion step and same-SHA checkout pinned
```
`ci.yml` step-list + parse extraction:
```
ci.yml: verify-workflows 11-step list and build parse pinned
```

Diff anchors (all `grep -qF` checks in the T1 verify passed):
- Inputs: `build_sha,environment`; no `build`/`choice`/relative option; no `previous-1` substring; no YAML `build:` key.
- Resolver: `actions/workflows/ci.yml/runs?event=push&branch=main&status=success&per_page=1`, `.workflow_runs[0] // empty`, `Resolved build: $sha ($source)`, `CI run: $ci_run $ci_created`, exact-SHA regex and the three exact failure messages.
- Guard: `--workflow CI --event push --branch main --commit "$TARGET_SHA"`, `compare/$TARGET_SHA...main`, `ahead|identical`.
- Checkout/confirm: `git rev-parse HEAD`, `Checked-out build`, `Deploying build`.
- Contract: seven contract file paths, `git diff --quiet "$PIPELINE_SHA"`, `require.resolve('pg')`, `Deploy contract OK for`.
- Schema: `schema_migrations`, migrations directory, `predates applied migration(s):`, `Schema compatibility OK for`.
- Render: `api.render.com/v1/services/`, `commitId`, `id: render_deploy`, `steps.render_deploy.outputs.deploy_id`, `deploys?limit=1`, `Render deploy live:`, `Render current deploy:`, `RENDER_DEPLOY_HOOK_URL`, 202/non-`dep-`/commit-mismatch/terminal/timeout/current-mismatch messages.
- Vercel: `--meta githubCommitSha`; `ci.yml`: `Validate deploy build selection contract`.
- Invariants: exactly one `gh run list`; no `push:` trigger; the old false 45 s comment phrase is absent.

Exact messages: PASS

Gate harness (`node tests/deploy/gate-fixtures.mjs`, 31/31): exit 0
```
Gate harness: PASS resolver-latest
Gate harness: PASS resolver-latest-unavailable
Gate harness: PASS resolver-exact
Gate harness: PASS resolver-malformed
Gate harness: PASS resolver-development-default
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
Resolver coverage: `resolver-latest` asserts the exact `CI run: 6001 2026-11-27T12:00:00Z` line; `resolver-latest-unavailable` feeds the real `{"total_count":0,"workflow_runs":[]}` shape and asserts `No successful CI push build found on main; refusing to deploy.`; `resolver-exact` asserts the pinned source and that no CI-run line is printed; `resolver-malformed` asserts the lowercase-SHA message; the two development cases assert `dispatch-ref` and the production-only rejection.

ci.yml parse execution: PASS
```
deploy.yml: build_sha contract pinned (resolver, guard, contract, schema, Render API/completion, Vercel and 21-step order)
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

No application code change; the only test addition is the feature-owned harness tests/deploy/gate-fixtures.mjs
- `git diff --exit-code <post-merge base> -- src compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json render.yaml src/frontend/vercel.json` → empty.
- `tests` diff versus the pre-merge base is only `tests/deploy/gate-fixtures.mjs` (allowed by the T1 verify).

`npm run coverage`: exit 0
```
backend:  Test Files 52 passed (52), Tests 2093 passed (2093)
frontend: Test Files 83 passed (83), Tests 2867 passed (2867)
backend All files:  97.09 statements | 92.24 branches | 99.65 functions | 97.09 lines
frontend All files: 97.22 statements | 96.80 branches | 98.60 functions | 97.22 lines
```
Thresholds stay 80 on all four metrics per workspace; `npm run lint` also exits 0.

T1 verify block: PASS (exit 0) — the full revised T1 verify block was executed end to end, including the 31-case harness, the executed `ci.yml` parse, actionlint, the config parses, `npm run coverage`, the pre-merge test-addition check and the build-log guards.

Secrets / environment:
- `git status --porcelain -- '.env*'` → empty; `git diff --name-only <pre-merge base> -- '.env*'` → empty.
- `deploy.yml` has no credential value; `RENDER_API_KEY`/`RENDER_DEPLOY_HOOK_URL`/`DIRECT_DATABASE_URL` are step `env:` only; the Render response body is parsed for `id/status/commit.id` and never printed; the schema error prints `error.message` only.
- Build-log credential guards (database connection-string user/password form, Brevo/Render/Fly token patterns) → no match; no full 40-character SHA in this log.

## Acceptance audit

- AC-1 → met: the dispatch parse pins exactly `build_sha,environment`, the byte-identical `environment` input, the `build_sha` string/optional/empty-default/exact description, and rejects a `build` input; the two triggers are unchanged and there is no `push` trigger.
- AC-2 → met: empty `build_sha` uses the Actions API `per_page=1` + `.workflow_runs[0] // empty`, tests the parsed SHA, prints `Resolved build` and the exact `CI run: <id> <createdAt>` line; the real empty response fails with the exact message; a set SHA is regex-validated and resolved as `pinned`; a non-empty development selection fails; 6 resolver harness cases PASS.
- AC-3 → met: the guard uses `steps.resolve_build.outputs.sha`, the single `gh run list` with `--event push --branch main --repo`, and the compare `ahead|identical`; 4 guard harness cases PASS.
- AC-4 → met: checkout ref is the same expression, `Confirm selected build checkout` asserts `git rev-parse HEAD` and prints `Deploying build`, Render uses the resolved SHA, Vercel adds `--meta githubCommitSha` and prints the same-SHA line; the live read-back is T3.
- AC-5 → met (static): manual dispatches POST `commitId` and require 201 + `dep-` ID + commit match, fail closed on 202/mismatch; completion polls, fails on terminal/timeout/current-mismatch and prints `Render deploy live`/`Render current deploy`; the automatic path keeps the hook and 45 s head start; 14 Render cases PASS.
- AC-6 → met (static): contract gate diffs the seven files against the dispatch ref and requires `pg`; schema gate reads `schema_migrations` (missing table = zero) and compares names under the immutable-migration policy; both run before migration/provider steps; 6 gate cases PASS.
- AC-7(a)-(c) → met: `workflow_run`/job `if`/concurrency unchanged, no `push`; resolver/guard/contract/schema are dispatch-only and the automatic path keeps `head_sha`/hook/45 s; a development dispatch with empty `build_sha` resolves `dispatch-ref` and a non-empty value fails closed.
- AC-8 → met: the parsed 21-step list matches exactly; one job; production protection read-back (main-only policy + required reviewers) and the 15/8 catalog are unchanged.
- AC-9 → met: both `ci.yml` parses pass, the new parse executes against the real workflow, actionlint exits 0, and the diff is limited to the owned workflow/harness/log files.
- AC-12(a)-(d) (T1 scope) → met: coverage green, no application/container/config change, only the harness under `tests`, `.env*` untouched, no credential or full-SHA leak in this log.

## Deviations from spec

None.
