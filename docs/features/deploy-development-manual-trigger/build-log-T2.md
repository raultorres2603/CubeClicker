# Build log — T2 — Documentation and verification

Task: T2 (2026-11-25)
Feature: deploy-development-manual-trigger
Branch: `feat/deploy-development-manual-trigger` (no switch to or rewrite of `main`)
Files changed: `README.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/features/deploy-development-manual-trigger/build-log-T2.md`

## What changed & why

- `README.md` § Deployment: the `development` bullet now names the manual UI/`gh` path, the CI-success preflight, the shared `deploy-development` concurrency group and the `production` default warning; the `production` bullet is manual-only wording. § What the pipelines run lists the dispatch parse and the two dispatch choices; § Deploy flow step 1 offers the manual development dispatch and notes it does not re-run CI.
- `docs/architecture/deployment.md` § Environments and triggers: development gains the manual `environment=development` cell and the dispatch sentence names both choices and environment-scoped reads; § Deploy pipeline says `workflow_dispatch` serves both environments, a development dispatch resolves to development and the manual path checks CI for the target SHA; the supersession ledger notes development is re-deployable by `workflow_dispatch`.
- `docs/architecture/vercel-render-neon.md`: the automatic-path sentence is scoped and the manual path named; the environment catalog and production section reflect the two choices; the routine CI list gains `Validate deploy workflow dispatch choices`; a new `### Manual development deploy` runbook states the command, `--ref main`, the CI preflight, the `production` default warning, the unchanged pipeline and SMTP port guard, the `SYNCED <KEY> (value verified, not shown)` output, the concurrency semantics, the no-protection caveat and the do-not-dispatch-production rule; production promotion gains `--ref main`; troubleshooting gains the manual-dispatch-refused entry; local-vs-cloud lists both manual triggers; the ledger is updated.

## Decisions

- Minimal edits in place: only the stale/inexact sentences and the lists the task names were changed; unrelated sections are byte-identical.
- The `status.md` commit is a separate bookkeeping commit of orchestrator-authored state tracking; its content was **not** edited by the builder.
- This is a config-only feature: no test files were added and `npm run coverage` is not a target; the project ≥ 80% per-workspace bar is unchanged for code changes.
- No live deploy was run by the builder; the optional post-merge development dispatch is user-owned, pending proof (run URL, the `Deploy configuration OK … development` line, seven `SYNCED` lines, `/healthz` 200), and production is never dispatched.
- No edit to `docs/features/README.md`; the feature-index row is proposed below for the orchestrator to apply at acceptance.

## Evidence

### Base

```
base=ca4c046899af8707a5233d5e01c267be7149dd3b
ca4c046 docs: record T9 Phase B resend attempt blocked at SMTP auth
```

### Bookkeeping commit (orchestrator-authored state tracking)

```
$ git log --oneline "$base"..HEAD -- docs/features/deploy-development-manual-trigger/status.md
5dc77a7 chore: track orchestrator status for deploy-development-manual-trigger
```

Any entry on this path is orchestrator-authored state tracking, not a builder edit. The commit added `status.md` exactly as the orchestrator left it in the working tree (30 insertions, `git diff --cached --stat` showed only that file); its content was not modified.

### T2 verify block — raw output

The block was extracted verbatim from `tasks.md` T2 `verify` (lines 48–131) and executed from the repository root with `bash`:

```
$ bash /tmp/opencode/t2/verify.sh > /tmp/opencode/t2/verify-output.txt 2>&1; echo "VERIFY_EXIT=$?"
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 399 packages, and audited 402 packages in 3s

102 packages are looking for funding
  run `npm fund` for details

14 vulnerabilities (12 moderate, 2 critical)

To address issues that do not require attention, run:
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
npm warn install-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn install-scripts   esbuild@0.28.2 (postinstall: node install.js)
npm warn install-scripts
npm warn install-scripts Run `npm install-scripts ls` to review, or run `npm install-scripts approve <pkg>` to allow.
deploy.yml: workflow_dispatch offers development and production; environment mapping and automatic path unchanged; ci.yml verify-workflows dispatch parse step in place
vercel.json: valid JSON
render.yaml: valid YAML (cubeclicker-development, docker, free, no platform health check)
VERIFY_EXIT=0
```

Steps that print nothing on success are `grep -q*`/`test`/`git diff` checks; under `set -euo pipefail` any failure would abort with a non-zero `VERIFY_EXIT`.

### Supplementary raw output (the same checks, shown so each silent step's result is visible)

```
=== actionlint (.github/workflows/*.yml) ===
ACTIONLINT_EXIT=0

=== guard fixture 1: development 2525/false accepted ===
Deploy configuration OK: 9 value(s) present for the 'development' environment.
FIXTURE1_EXIT=0

=== guard fixture 2: development 587 rejected ===
Deploy blocked: SMTP_PORT=587 is blocked for outbound SMTP on the Render free plan ('development' environment).
  Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS); ports 25, 465 and 587 stay blocked on Render free.
  Runbook: README.md § Deployment Brevo runbook
FIXTURE2_EXIT=1

=== guard fixture 3: production placeholders rejected ===
Deploy blocked: the 'production' environment has 5 unset or placeholder value(s).
  Placeholder: SMTP_FROM, SMTP_USER, SMTP_PASS, RENDER_SERVICE_ID, RENDER_API_KEY
Remediation (names only; never paste a value into a command argument):
  variables: gh variable set <NAME> --env production --repo raultorres2603/CubeClicker
  secrets:   gh secret set <NAME> --env production --repo raultorres2603/CubeClicker
Runbook: README.md § Deployment Brevo runbook
FIXTURE3_EXIT=1
```

```
base=ca4c046899af8707a5233d5e01c267be7149dd3b
status_index_clean=[]
readme_diff=[]
deploy_hunks=2 deploy_content_lines=4
ci_hunks=1 ci_removed=0 ci_added_names=1
guard_source_diff_exit=0
env_status=[]
env_diff=[]
no_manual_production_only_exit=0
--- git log status.md ---
5dc77a7 chore: track orchestrator status for deploy-development-manual-trigger
DOC_GREPS_EXIT=0
```

The documentation-grep gate was also run as a standalone subset (`tasks.md` T2 `verify` lines 69–119) and exited `0`; the full block above covers every remaining check (workflow/config parses, merge-base diff purity, `.env*`, status/feature-index, credential audits).

## Required statements

- No live deploy was dispatched during this feature.
- Production remains placeholder-only; no production dispatch was attempted.
- Builder made no edit to status.md or docs/features/README.md.
- The pre-existing ignored .env was not opened, edited or read.

## Proposed feature-index row (orchestrator-owned `docs/features/README.md`; proposed only, not applied)

```
deploy-development-manual-trigger | Manual Development Deploy Trigger | accepted | 2026-11-25
```

## Credential and no-deploy record

- No secret value was read, printed, written or committed. The guard fixtures use short angle-bracket placeholders or the 7-character `fixture` values, below the generator's 12-character credential pattern.
- No deploy was triggered: no `gh workflow run`, no deploy-hook `curl`, no `vercel deploy`, no Render or Neon API call. The only container run is the pinned, read-only `rhysd/actionlint:1.7.12` over `.github/workflows/*.yml`; the only network action is `npm ci` from the committed lockfile.

## Acceptance audit

- **AC-5 — met.** The two guard source files are byte-identical to the merge base (`git diff --exit-code` is empty); the development `2525`/`false` fixture prints `Deploy configuration OK: 9 value(s) present for the 'development' environment.`; the development `587` fixture exits 1 with the exact Render-free header; the production placeholder fixture exits 1 with the exact `'production'` catalog header; the new runbook states the development `SMTP_PORT=2525` with `SMTP_SECURE=false` recipe and the production placeholder-only state.
- **AC-8 — met.** Every positive and negated documentation grep in T2's verify passes, including the three F2 corrections (`deployment.md` dispatch sentence, `vercel-render-neon.md` automatic-path sentence and the routine `verify-workflows` list) and the F9 `production`-default warning plus the production `--ref main` rule.
- **AC-9 — met.** The full static gate is green: pinned actionlint over all workflows, the dispatch parse success line, the `vercel.json` JSON parse, the `render.yaml` YAML parse, the three credential-free guard fixtures with exact headers, the merge-base diff purity checks, the documentation greps, the `.env*` path checks, the status/feature-index clean-tree checks and the credential audits.
- **AC-10 — met.** No deploy was dispatched during planning/building; production remains placeholder-only with no dispatch attempt; the optional live development dispatch is recorded here as user-owned post-merge proof and was not run.

## Deviations from spec

None.
