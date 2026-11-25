---
feature: deploy-development-manual-trigger
revision: 2
status: draft
created: 2026-11-25
updated: 2026-11-25
---
# Spec — Manual Development Deploy Trigger

## Summary

Development already deploys automatically: a push to `main` runs CI once, and a successful `workflow_run` of that CI run triggers the `Deploy` workflow in the `development` GitHub Environment. The same workflow also has a `workflow_dispatch` trigger, but its `environment` input offers only the `production` choice, so the development environment cannot be deployed by hand. The request is to add development to the manual pipeline.

The smallest safe change adds `development` to the existing `workflow_dispatch` `environment` choice (appending it, keeping `production` as the default so the production manual path is unchanged) and reuses the single `deploy` job, whose `environment`, `TARGET_ENVIRONMENT` and concurrency group already resolve from the input with a `development` fallback. A development dispatch therefore runs the exact ordered pipeline — `Check deployment Brevo configuration` → Neon migration → `Sync Brevo SMTP settings to Render` → Render deploy hook → `/healthz` poll → Vercel `--prod` → deployed smoke — with only the `development` Environment's variables and secrets, the development Render service and the seven-name SMTP sync. A `verify-workflows` parse in CI pins both choices, the `production` default, the complete dispatch-input key set and the input→environment mapping with exact parsed values (including the deploy job `if` and the checkout `ref`), and the README plus the two architecture references gain the UI/`gh` command, the `production`-is-default warning and the safety contract (environment-scoped credentials only, no secret printing, concurrency behavior, and the development `SMTP_PORT=2525`/`SMTP_SECURE=false` rule while production stays `587` placeholder-only). No application code, tests, containers, providers or production assets change, and the automatic `main` path is preserved exactly — pinned by exact parsed values and an input-only diff.

## Raw request (verbatim, scope boundary)

> "Need you to add development on deploy pipeline, to be able to trigger it manually aswell"

## Scope

### In scope

- `.github/workflows/deploy.yml`: change only the two `workflow_dispatch.environment` input lines — the `description` and `options` — so the choice offers exactly `production` and `development`; `default: production`, `type: choice` and `required: true` stay.
- `.github/workflows/ci.yml`: add one `verify-workflows` step, `Validate deploy workflow dispatch choices`, that parses `deploy.yml` with `js-yaml` and asserts the dispatch choices/default, the complete dispatch-input key set, the input→environment mapping, and the automatic trigger/job condition/checkout ref/step list by exact parsed value; it also parses `ci.yml` to assert the step sits at the pinned position in `jobs['verify-workflows'].steps`.
- Documentation: `README.md` § Deployment / § What the pipelines run / § Deploy flow; `docs/architecture/deployment.md` § Environments and triggers and § Deploy pipeline; `docs/architecture/vercel-render-neon.md` § Architecture, § Environment catalog, § Routine development deploy, § Runbook (new `### Manual development deploy`), § Promote to production, § Troubleshooting and § Local development vs cloud.
- Evidence: per-task build logs under this feature directory.

### Explicitly out of scope

- No application code, tests, coverage targets, containers, compose files, Dockerfiles, `render.yaml`, `vercel.json`, ports, health signals or WebSocket endpoints.
- No deploy trigger change for production: production stays manual-only and unprovisioned; whether production should ever auto-deploy is a user-owned question (Q-2), not this feature.
- No production provisioning, protection rules, required reviewers, deployment branch policy or secrets/variables changes.
- No new environment (no staging, no third choice), no new `workflow_dispatch` inputs (no `ref`, image tag or force flag).
- No change to the CI-success preflight, the Brevo guard/sync, the Render hook, the health poll, the Vercel steps or the deployed smoke.
- No live deploy during planning or building: no `gh workflow run`, no production dispatch, no provider call. The optional live development dispatch is user-owned post-merge proof (AC-10(c)).
- No edit of `status.md` or `docs/features/README.md` (orchestrator-owned; the feature-index row is proposed only).

## Context and current state

- `.github/workflows/deploy.yml` (lines 10–17) declares `workflow_dispatch` with a required `choice` input named `environment`, `default: production`, `options: [production]`, description `GitHub Environment to deploy (manual production only)`.
- The workflow also triggers on `workflow_run` of `CI` completing on `main` (types `completed`, branches `main`), gated by the job `if` (`workflow_dispatch` **or** a successful push CI run on `main`) and a dispatch-only preflight step (`Verify CI succeeded for target commit`) that refuses unless `gh run list` reports `success` for `github.sha`.
- Environment resolution already exists and is shared: concurrency `group: deploy-${{ github.event.inputs.environment || 'development' }}`, `jobs.deploy.environment: ${{ github.event.inputs.environment || 'development' }}`, job-level `TARGET_ENVIRONMENT: ${{ github.event.inputs.environment || 'development' }}`. On a `workflow_run` event `github.event.inputs.environment` is empty, so the automatic deploy resolves to `development`.
- The job is a single `deploy` job: checkout (`ref: workflow_run.head_sha || github.sha`) → setup/install → Brevo guard (`--check-only`) → Neon migration → SMTP sync → Render deploy hook → 45 s wait → `/healthz` poll → Vercel pull/build/deploy `--prod` → warm → deployed smoke. Every provider value is read from the selected GitHub Environment (`vars.*`/`secrets.*`); no value is read from an input.
- The Brevo guard is strict and environment-aware: it validates the nine deployment names (the seven SMTP names plus `RENDER_SERVICE_ID` and `RENDER_API_KEY`) and fails closed on missing/`CHANGEME` values; the SMTP transport guard runs only when `TARGET_ENVIRONMENT === 'development'`, rejecting ports 25/465/587, the Mailpit port 1025, malformed/out-of-range values, and `SMTP_SECURE` other than `false`/`0`/empty with 2525. The development recipe is `SMTP_PORT=2525`, `SMTP_SECURE=false`; production holds `587` as a placeholder and fails at the catalog guard before the transport guard.
- Evidence that the current automatic path works and keeps development: `docs/features/registration-account-exists/build-log-T9.md` records Deploy run `45664106846` (`workflow_run`, `headSha=0af87b0…`, attempts 2/3 success) printing `Deploy configuration OK: 9 value(s) present for the 'development' environment.` plus seven `SYNCED <KEY>` lines, and `/healthz` returning `{"status":"ok"}`.
- Production remains `placeholder-only` with the nine deployment names and `no Render service, Vercel project or Neon branch is provisioned`; a production dispatch fails at `Check deployment Brevo configuration` before any provider call.
- `ci.yml` `verify-workflows` already performs pinned `actionlint`, a `vercel.json` JSON parse, a `render.yaml` YAML parse (via `js-yaml` from the locked eslint tree), a no-Fly guard and two credential-free Brevo guard fixtures. The dispatch-choice parse belongs there.
- Current documentation statements this feature must correct: `docs/architecture/deployment.md` says “A dispatch chooses production explicitly.”; `docs/architecture/vercel-render-neon.md` § Architecture says “Only a successful `workflow_run` of that CI run triggers **Deploy**”; its § Routine development deploy `verify-workflows` list omits the new dispatch parse; and its § Promote to production runbook omits the `--ref main` rule.
- `AGENTS.md` § Conventions: `main` is the integration branch and a `main` push deploys `development` automatically after CI; production is manual and unprovisioned. There is no `develop` branch.

## Configuration contract

`deploy.yml` `workflow_dispatch` input after the change (only `description` and `options` differ from today):

```yaml
  workflow_dispatch:
    inputs:
      environment:
        description: GitHub Environment to deploy (development or production)
        type: choice
        required: true
        default: production
        options: [production, development]
```

Resolution contract (unchanged text, restated for the verifier):

```
concurrency.group                     = deploy-${{ github.event.inputs.environment || 'development' }}
jobs.deploy.environment               = ${{ github.event.inputs.environment || 'development' }}
jobs.deploy.env.TARGET_ENVIRONMENT    = ${{ github.event.inputs.environment || 'development' }}
```

Consequence: a dispatch with `environment=development` runs the job in the `development` GitHub Environment and a dispatch with `environment=production` runs it in `production`; an automatic `workflow_run` resolves to `development` because the input is absent. The input is a `choice` limited to two fixed names.

## User stories

- As the repository owner, I want to re-deploy `development` on demand (for example after changing a GitHub Environment value or after a provider hiccup), so I do not need a throwaway commit to trigger the deploy.
- As the repository owner, I want the manual development path to use exactly the same guarded pipeline as the automatic one, so a manual deploy cannot skip the Brevo guard, the migration, the SMTP sync or the smoke.
- As the security reviewer, I want a manual dispatch to read only the selected environment's credentials, to print no secret, and to leave production manual and placeholder-only, so the new trigger cannot widen the credential surface.
- As the reviewer, I want the trigger contract pinned by a CI parse with exact values and the docs to state the exact command and the production default, so a future edit cannot silently remove the development choice or change the automatic path.

## Acceptance criteria

Commands run from the repository root; "parse" means the pinned `node -e`/`js-yaml` check specified in `plan.md` § Interfaces and implemented as the `Validate deploy workflow dispatch choices` CI step. `base` is the feature base, `git merge-base origin/main HEAD`, so main advances do not enter the diff counts. No production deploy is run to verify anything.

- **AC-1 — The dispatch offers exactly `development` and `production`, and `production` stays the default.**
  (a) Parsing `.github/workflows/deploy.yml` yields `on.workflow_dispatch.inputs` with exactly one key, `environment`; that input is exactly `type: 'choice'`, `required: true`, `default: 'production'`, `options: ['production', 'development']`, `description: 'GitHub Environment to deploy (development or production)'`.
  (b) `deploy.yml` contains no `manual production only` text.
  Evidence: the parse prints the AC-7 success line; `! grep -q 'manual production only' .github/workflows/deploy.yml`.

- **AC-2 — The input drives the environment, the job target and concurrency through one expression.**
  (a) `jobs.deploy.environment`, `jobs.deploy.env.TARGET_ENVIRONMENT` and `concurrency.group` (minus the `deploy-` prefix) are the same string; each contains `github.event.inputs.environment` and the `development` fallback, and none contains a hardcoded `production`.
  (b) `concurrency.group` equals `'deploy-' + jobs.deploy.environment`; `concurrency.cancel-in-progress` is `false`.
  (c) No `environment: production` literal remains in the file.
  Consequence: a development dispatch runs as development and a production dispatch as production; the automatic event keeps resolving to `development` through the fallback.
  Evidence: the parse assertions; a user-owned post-merge development dispatch (AC-10(c)) is the end-to-end confirmation.

- **AC-3 — The automatic `workflow_run` deploy from `main` is preserved exactly.**
  (a) `on.workflow_run` is exactly `workflows: ['CI']`, `types: ['completed']`, `branches: ['main']`; the workflow has no `push` trigger.
  (b) `jobs.deploy.if` is exactly, by string equality, `github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == 'main')`.
  (c) Workflow permissions are exactly `contents: read` and `actions: read`; `jobs.deploy.timeout-minutes` is `45`; the workflow has exactly one job.
  (d) The `Checkout` step's `with` block has exactly the `ref` key, and `with.ref` is exactly, by string equality, `${{ github.event.workflow_run.head_sha || github.sha }}` (the parse builds the expected dollar sign with `String.fromCharCode(36)` so the `${{` sequence is never literal inside the `run:` script).
  (e) The deploy step list is exactly the 17 existing names, in order: `Reject non-push CI runs`, `Verify CI succeeded for target commit`, `Checkout`, `Setup Node`, `Install dependencies`, `Check deployment Brevo configuration`, `Migrate Neon database`, `Sync Brevo SMTP settings to Render`, `Deploy Render backend`, `Wait for Render deploy to start`, `Wait for Render backend health`, `Install Vercel CLI`, `Pull Vercel project settings`, `Build Vercel frontend`, `Deploy Vercel frontend`, `Warm Render backend before smoke`, `Run deployed smoke`.
  (f) `git diff -U0 "$base" -- .github/workflows/deploy.yml` contains exactly 2 hunks and 4 added+removed content lines (the 2-line input change), and no added/removed line touches `if:`, `ref:`, `secrets.`, `vars.`, `echo `, `uses:`, `permissions:`, `concurrency:`, `workflow_run:` or a `production` environment literal.
  Evidence: the parse; the diff counts/greps recorded in the T1 build log.

- **AC-4 — A manual development dispatch runs the same pipeline with environment-scoped configuration and the same SMTP sync.**
  (a) No deploy step is added, removed or reordered (AC-3(e)); no `vars.*`/`secrets.*` binding is added or removed (AC-3(f)).
  (b) Because the job's `environment` is the selected environment, a development dispatch reads only the `development` Environment. That environment supplies the nine names validated by `Check deployment Brevo configuration` — the seven SMTP names plus `RENDER_SERVICE_ID` (`srv-dbtcvv9srm7s73au5bag`) and `RENDER_API_KEY` — and also the separate deploy-hook secret `RENDER_DEPLOY_HOOK_URL`, the Neon `DATABASE_URL`/`DIRECT_DATABASE_URL` secrets and the Vercel `VERCEL_TOKEN`/`VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` values. The sync writes exactly the seven SMTP names to the development Render service before the hook; the hook, migration and Vercel steps consume the other names.
  (c) No new secret, variable, environment name or provider credential is introduced.
  Evidence: AC-3 parse/diff checks; the docs catalog is unchanged apart from the trigger text.

- **AC-5 — The SMTP guard behavior is unchanged and environment-correct for a manual dispatch.**
  (a) `src/backend/src/deploy/render-env.ts` and `src/backend/src/deploy/render-env-cli.ts` are unchanged from the feature base.
  (b) With `TARGET_ENVIRONMENT=development`, the guard rejects `SMTP_PORT=587` with the exact header `Deploy blocked: SMTP_PORT=587 is blocked for outbound SMTP on the Render free plan ('development' environment).` and accepts `SMTP_PORT=2525` with `SMTP_SECURE=false`; the unchanged guard source retains the Mailpit-1025 and malformed-port rejections covered by its existing unit tests. With `TARGET_ENVIRONMENT=production` and the pinned placeholders the catalog guard exits `1` with the exact header `Deploy blocked: the 'production' environment has 5 unset or placeholder value(s).` before any network call.
  (c) The documentation states the deployed development recipe stays `SMTP_PORT=2525` with `SMTP_SECURE=false`, that a manual development dispatch applies the same development SMTP port guard, and that production stays `587` placeholder-only until provisioned.
  Evidence: the credential-free guard fixture commands in T2 with exact exit codes and exact rejection lines; `git diff --exit-code "$base"` on the two guard files; doc greps.

- **AC-6 — No secret exposure and no permission widening.**
  (a) The `deploy.yml` diff adds/removes no `secrets.`, `vars.`, `echo`, token, credential, `if:` or `ref:` line (AC-3(f)); `permissions` is unchanged (AC-3(c)) and no `uses:` line or action pin changes.
  (b) The input is a `choice` limited to `development` and `production` (AC-1(a)); a value forced through the API outside those options selects an environment with no deployment values and fails the nine-name guard before any provider call, and only the selected environment's values resolve.
  (c) No tracked or untracked (non-ignored) `.env*` path is modified or added: `git status --porcelain -- '.env*'` and `git diff --name-only "$base" -- '.env*'` are both empty. The pre-existing ignored `.env` is user-owned and is not opened, read or edited by this feature (the no-edit rule stands; the path checks cannot prove an ignored file's content, which is why the build log records the no-read statement).
  Evidence: AC-3(f) greps; the `.env*` commands; the build-log statement; the repository credential audits.

- **AC-7 — CI pins the dispatch contract with exact values.**
  (a) `.github/workflows/ci.yml` `verify-workflows` contains a step named `Validate deploy workflow dispatch choices`, and the parsed `jobs['verify-workflows'].steps` list is exactly `Checkout`, `Setup Node`, `Install dependencies`, `Lint GitHub Actions workflows`, `Validate Vercel config`, `Validate Render blueprint`, `Validate deploy workflow dispatch choices`, `Check deploy workflow has no Fly deploy path`, `Guard rejects placeholder values`, `Guard accepts a complete value set`, in that order.
  (b) The step runs the pinned Node/`js-yaml` parse over `.github/workflows/deploy.yml` and prints the AC-7 success line. The parse asserts `jobs.deploy.if` and the checkout `with.ref` by exact string equality (no `.includes()` on either), the complete `workflow_dispatch.inputs` key set is `['environment']`, and any drift in AC-1/AC-2/AC-3(a)–(e) fails the step.
  (c) `git diff -U0 "$base" -- .github/workflows/ci.yml` is a single pure insertion (1 hunk, 0 removed content lines, exactly 1 added `- name:` line, which is the new step), so the actionlint, Vercel/Render parses, no-Fly guard and both Brevo fixtures remain.
  (d) Pinned `actionlint` over both workflows exits `0`.
  Success line: `deploy.yml: workflow_dispatch offers development and production; environment mapping and automatic path unchanged; ci.yml verify-workflows dispatch parse step in place`.
  Evidence: the AC-7 parse in T1/T2; the ci.yml diff checks; actionlint output.

- **AC-8 — README and deployment documentation show the manual development path and its contract.**
  (a) `README.md` § Deployment states the development environment can also be deployed manually, with both the UI path (`Actions → Deploy → Run workflow`) and `gh workflow run deploy.yml --ref main -f environment=development`, that the job first requires a successful CI run for that commit, and that the `environment` input defaults to `production`, so the operator must select `development` before running; § What the pipelines run says `deploy.yml` runs on `workflow_run` or `workflow_dispatch` for development or production and lists the new dispatch parse; § Deploy flow offers the manual alternative for step 1; the production bullet says production is reachable only through a manual `workflow_dispatch` with `environment: production`.
  (b) `docs/architecture/deployment.md` § Environments and triggers gives development a manual trigger (`workflow_dispatch` with `environment=development`, CI for the target SHA required), replaces “A dispatch chooses production explicitly.” with a sentence saying a dispatch chooses `development` or `production` explicitly and reads only the selected environment's secrets/variables; § Deploy pipeline says `workflow_dispatch` serves development or production, the manual path (either environment) checks CI, and the CI list names the dispatch parse; the supersession ledger line notes development is re-deployable by `workflow_dispatch`.
  (c) `docs/architecture/vercel-render-neon.md` § Architecture scopes the old “Only a successful `workflow_run` … triggers **Deploy**” statement to the automatic path and names the manual path; § Environment catalog says the same input can re-deploy development with `environment: development` and that the input offers both choices; § Routine development deploy's `verify-workflows` list includes `Validate deploy workflow dispatch choices`; the new `### Manual development deploy` runbook subsection states the command, the `--ref main` rule and why, the CI preflight (the manual path never bypasses CI), the `production`-is-default warning, the same steps as the automatic path with the development SMTP port guard (`SMTP_PORT=2525` with `SMTP_SECURE=false`), no secret printing (`SYNCED <KEY> (value verified, not shown)`), the concurrency semantics (`deploy-development`, `cancel-in-progress: false`, newer pending run replaces older pending), the lack of development protection rules (any Actions-write user can dispatch), and “do not dispatch `production` for development work”; § Promote to production adds the `--ref main` rule for the same Render-main/Vercel-ref hazard; § Troubleshooting gains a manual-dispatch-refused entry; § Local development vs cloud's development deploy trigger lists the manual path; the ledger line is updated.
  (d) No stale wording remains: `manual production only` (workflow), ``Manual trigger | none needed``, ``single `production` choice``, `` `workflow_dispatch` for production `` in README/deployment.md, `A dispatch chooses production explicitly` in `deployment.md`, and ``Only a successful `workflow_run` of that CI run triggers`` in `vercel-render-neon.md`.
  (e) `docs/features/README.md` is not edited (the row is proposed in the T2 build log with the single target state `accepted`); `status.md` is not edited by the builder (no working-tree modification; any orchestrator state commit is recorded in the build log).
  Evidence: the exact greps in T2's verify.

- **AC-9 — The static verification gate is green.**
  Pinned `actionlint` over both workflows exits `0`; `src/frontend/vercel.json` parses as JSON; `render.yaml` parses as the one expected service with no platform health check; the dispatch parse prints the AC-7 success line; the three guard fixtures behave exactly (development `2525`/`false` accepted, development `587` rejected with its exact header, production placeholders rejected with their exact header); the ci.yml pure-insertion checks pass; the documentation greps of AC-8 pass; the `.env*` path checks are empty.
  Evidence: T1/T2 build logs with raw output.

- **AC-10 — No live deploy and no production deploy.**
  (a) Planning and building execute no deploy: no `gh workflow run`, `gh api …/dispatches`, deploy-hook `curl`, `vercel deploy` or `render deploys create` is run; `build-log-T2.md` records `No live deploy was dispatched during this feature`.
  (b) Production is not deployed: `production` remains `placeholder-only`; no production dispatch is attempted; `build-log-T2.md` records `Production remains placeholder-only; no production dispatch was attempted`, and the docs state a production dispatch fails at `Check deployment Brevo configuration` before any provider.
  (c) The optional live proof is user-owned post-merge: one dispatch with `environment=development` (no production dispatch), recorded in `build-log-T2.md` with its run URL, the `Deploy configuration OK: 9 value(s) present for the 'development' environment.` line and a `/healthz` `200`; it is not a build gate.
  Evidence: the build logs' command inventory and pinned statements; the reviewer can inspect the recorded run.

## Non-goals

- No change to the automatic `workflow_run` trigger, the deploy job `if`, concurrency expression, permissions, timeout, step bodies/order, action pins or job count.
- No change to the Brevo guard CLI, its tests, the SMTP names, the Neon migration, the Render hook, the health poll, the Vercel steps or the deployed smoke.
- No production provisioning, protection rules, reviewers, deployment branch policy or production value changes; production stays manual and unprovisioned.
- No new environment choice (no staging, no third environment), no `ref`/image-tag/force input, no ref-selection guard.
- No skip/override of the CI-success preflight for either environment.
- No application, test, coverage, compose, Dockerfile, `render.yaml`, `vercel.json`, port, health-signal or WebSocket change.
- No new GitHub Action or npm dependency; `js-yaml` comes from the locked tree.
- No live deploy during planning/building and no production dispatch at all.
- No edit of `status.md` or `docs/features/README.md`.

## Boundaries

- ✅ Always: keep the automatic path exactly as it is (pinned by exact parsed values and an input-only diff); keep the input a closed two-choice `production`/`development` with `production` default; keep the single environment expression for `environment`, `TARGET_ENVIRONMENT` and concurrency; keep the CI-success preflight; keep the guard → migration → sync → hook → health → Vercel → smoke order; keep the development `2525`/`false` and production `587` placeholder contract; assert the automatic-path `if`/`ref` by exact parsed values; run actionlint plus the config parses; record raw, names-only/no-value evidence; update the three docs in the same feature; propose (not apply) the feature-index row.
- ⚠️ Ask first: changing the default choice, adding or removing a choice, adding a `ref` guard or a skip-CI/force override, changing concurrency or the preflight, touching the guard/sync code, provisioning or filling production, running any live dispatch.
- 🚫 Never: dispatch `production` for development work; trigger a deploy during planning/building; print, echo, log or commit a secret; weaken or bypass the Brevo or SMTP guard; reorder the deploy steps; edit `.env*`, `status.md` or `docs/features/README.md`; add an unpinned action; `git push`.

## Security considerations

- **Environment-scoped credentials only.** The job runs in the selected GitHub Environment, so only that environment's `vars.*`/`secrets.*` resolve. The input is a `choice` limited to `development` and `production`; there is no free-text ref or value input, and no new secret/variable is introduced. If GitHub were to accept an out-of-options value through the API, the job would select an environment with no deployment values and fail the nine-name guard before any provider call. A development dispatch cannot read production values and vice versa.
- **No secret printing.** The diff adds no `echo` and no new secret read. The existing steps keep their redaction behavior: the Render hook URL is passed as `env:` to `curl` and never echoed; the SMTP sync prints `SYNCED <KEY> (value verified, not shown)` and names only; Vercel tokens are environment-only; GitHub masks registered secrets and no step enables shell tracing.
- **Production stays fail-closed.** `production` is `placeholder-only`; a production dispatch stops at `Check deployment Brevo configuration` (five placeholders today) before the Neon migration, the Render API and Vercel. It stays manual-only, and protection rules remain a prerequisite before provisioning (out of scope, Q-2). Because `production` is the default choice, the docs tell the operator to select `development`; until production is provisioned, an accidental default run still fails at the guard.
- **Write access is the dispatch gate.** `development` has no protection rules, so any repository user with Actions write access can dispatch it; the CI-success preflight still refuses unverified commits. Production's missing protection is a pre-existing, documented gap that must be closed before provisioning; this feature does not change it.
- **Dispatch ref integrity.** The Render deploy hook builds the service's tracked `main` branch while Vercel builds the dispatched ref, so a non-main dispatch would mix revisions. The development runbook and README pin `--ref main`; the production runbook gains the same rule. Enforcement is left as a user-owned follow-up (Q-3) because a new guard would change the existing production manual path and step order.
- **Concurrency.** `deploy-development` is shared by automatic and manual development runs with `cancel-in-progress: false`, so they never overlap; an in-progress deploy completes, and a newer *pending* run replaces an older pending one (GitHub semantics). Production uses `deploy-production`, so a (hypothetical) production run would not serialize against development; production has no assets today.
- **No supply-chain or credential additions.** `js-yaml` is already in the locked tree (the `render.yaml` parse uses it); no action, dependency, secret or provider call is added. The input choice itself has no credential.
- **No user-controlled data, persistence or client-side secrets.** The feature touches workflow configuration and docs only.

## Real-time impact

Out of scope for behavior change. The manual development dispatch runs the same deploy, so it has exactly the existing deploy effect on the single Render process: the instance restarts, every WebSocket closes, clients reconnect on the unchanged bounded policy (10 attempts, 500 ms → 5 s) and in-memory rooms reset. Server authority, the WebSocket protocol, heartbeat/grace, reconnection and presence are untouched. No identity or "no accounts" question is reopened: the environment choice is operator configuration, not a user identity.

## Containerization impact

None. This feature adds no service, image, Dockerfile stage, compose service, port, volume, build argument, environment variable, health signal or WebSocket endpoint. The backend image, frontend image, `compose.yaml`, `compose.smoke.yaml`, `render.yaml` and `src/frontend/vercel.json` are untouched; deployables remain provider-neutral, configuration remains environment-based, and `podman compose up` is unchanged. The only change is a GitHub Actions trigger input plus its CI parse and documentation, which is pipeline configuration, not a container or deployable. This follows `docs/architecture/containerization.md` without reopening any settled convention.

## Testing strategy

- **Unit: not applicable.** No TypeScript, application or library code changes; no unit tests or test files are added. Adding a unit test around workflow YAML would be test theater — the workflow file itself is the artifact under test.
- **Integration (workflow/config boundary — the feature-appropriate tier).** The `verify-workflows` step `Validate deploy workflow dispatch choices` parses the real `.github/workflows/deploy.yml` and `.github/workflows/ci.yml` with `js-yaml`. It asserts the dispatch choices/default and complete input key set, the input→environment mapping, the exact `jobs.deploy.if` string, the exact checkout `with.ref` string (the dollar sign built with `String.fromCharCode(36)` so `${{` is never literal in the `run:` script), the unchanged `workflow_run` trigger, permissions, timeout, the 17-step deploy list, and the 10-step `verify-workflows` list with the new step at its pinned position. Pinned `rhysd/actionlint:1.7.12` over both workflows validates the YAML/Actions schema. The existing `src/frontend/vercel.json` JSON parse and `render.yaml` YAML parse run unchanged.
- **Diff purity (one-time, complements the durable parse).** Against `base = git merge-base origin/main HEAD`, `deploy.yml` has exactly 2 hunks / 4 content lines and no `if:`/`ref:`/secret/vars/echo/uses/permissions/concurrency/workflow_run change; `ci.yml` has 1 hunk, 0 removed content lines and exactly 1 added `- name:` line (the new step).
- **Guard regression (no network).** The three credential-free CLI fixtures prove the SMTP interaction: development `2525`/`false` prints `Deploy configuration OK: 9 value(s) present for the 'development' environment.`; development `587` exits `1` and prints its exact Render-free rejection header; production placeholders exit `1` and print the exact `'production'` catalog header. The guard source files are also asserted unchanged.
- **E2E/containerized: not applicable.** No container or cross-service behavior changes; the Mailpit-primed smoke and the deployed smoke are not re-run by this feature. The post-merge automatic development deploy continues to exercise the deployed smoke unchanged.
- **Deployed proof (user-owned, optional, not a build gate).** After merge, one `environment=development` dispatch (`gh workflow run deploy.yml --ref main -f environment=development`) proves the manual path end to end; record the run URL, the `Deploy configuration OK … development` line, seven `SYNCED <KEY>` lines, `/healthz` `200` and the deployed smoke result. No production dispatch.
- **Coverage expectation.** No behavior code changes, so this config-only feature adds no coverage target and no test files; per the brief, the actionlint/config-parse proof replaces `npm run coverage` for this change. The project bar (`npm run coverage`, thresholds ≥ 80% statements/branches/functions/lines per workspace) is unchanged and remains the gate for any code change; no workspace source is touched.
- **Verification commands:** `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml`; the pinned dispatch parse; `node -e "JSON.parse(…vercel.json…)"`; the `render.yaml` YAML parse; the three guard fixtures via `npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only`; the merge-base diff counts; the documentation greps; the `.env*` path checks; `git diff --exit-code "$base"` on the guard sources; the repository credential audit.

## Supersessions

| Superseded | Behavior replaced | Replaced by (this spec) | Retained |
| --- | --- | --- | --- |
| `deploy-brevo-env-placeholders` AC-7 and AC-10(b) trigger clause "`workflow_dispatch` with the single `production` choice" | A single manual choice | Two choices (`production`, `development`) with `production` default | Everything else in that spec: step order and bindings, preflight, guard, seven-name sync, production `placeholder-only` and fail-closed behavior |
| `manual-deploy-trigger` (already superseded by `render-backend-migration`/CI-once → deploy) trigger policy | "Development may only deploy from a `main` push after CI" | Development also re-deployable by `workflow_dispatch` with `environment=development`, still after a CI-success check | Automatic `main` → CI → Deploy for development; production manual and unprovisioned; the accepted spec itself stays untouched |

## Open questions

- **Q-1 (user-owned) — Should `production` remain the default choice?** Default decision: yes, keep `default: production` to preserve the existing production manual behavior exactly as the brief requires; the development choice is selected explicitly and the docs warn about the default. Risk: someone accepting the default targets production, which today fails closed at the Brevo placeholder guard because production is unprovisioned, and protection rules are required before it is provisioned. If the owner prefers `default: development`, it is a one-line change plus the parse assertion and docs update, but it changes the production manual default and therefore needs an explicit decision.
- **Q-2 (user-owned) — Should production ever auto-deploy from `main`?** No in this feature: production stays manual-only and unprovisioned (the status.md blocker records the same question). Auto-deploying production would require provisioning, protection rules and a separate spec amendment.
- **Q-3 (user-owned) — Should a manual dispatch be restricted to `refs/heads/main`?** Default decision: document the rule and pin `--ref main` in both the development and production runbooks; do not add a guard. A new ref guard would change the existing production manual path and insert a step into the accepted deploy order; a non-main dispatch would mix the dispatched ref's Vercel build with Render's `main` build. Enforcement is a follow-up if the owner wants it.
- **Q-4 — Should a manual dispatch skip the CI-success preflight (deploy while CI is red)?** Default decision: no. The preflight is the safety contract for both environments and the manual path never bypasses CI; a dispatch re-deploys a commit whose CI already succeeded. Ask first if a red-CI redeploy is ever needed.

## Assumptions

- GitHub validates `choice` inputs against `options` and supplies the `default` when the input is omitted, so the input always resolves to `development` or `production`.
- `github.event.inputs.environment` is the correct context for `workflow_dispatch` inputs (already in force on `main`); on `workflow_run` it is empty and the `'development'` fallback applies.
- The `development` Environment already holds the nine non-placeholder deployment names (including `SMTP_PORT=2525`/`SMTP_SECURE=false`), so a manual development dispatch needs no environment change; the guard checks presence/placeholders, not credential correctness, and the existing `RENDER_DEPLOY_HOOK_URL` targets the development service.
- The UI branch selector and `gh workflow run` default to the repository's default branch (`main`); the docs command passes `--ref main` explicitly for both the development and production paths.
- `js-yaml` remains available to the `verify-workflows` job after `npm ci` through the locked eslint tree (the existing `render.yaml` parse proves it); no dependency is added.
- Production stays `placeholder-only`; a production dispatch continues to fail at `Check deployment Brevo configuration`.
- The accepted `deploy-brevo-env-placeholders` step order, bindings, guard, sync and security posture remain in force except the trigger-choice wording superseded above.
- The brief resolves the first status.md blocker (whether the manual development dispatch syncs the GitHub development values to Render exactly like the automatic path): it does (AC-4). The second blocker (whether production should also auto-deploy) is carried as Q-2, not answered here.
- `docs/features/README.md` and `status.md` are orchestrator-owned and are not edited by this feature.

## Revision history

- r2 — 2026-11-25 — spec-review r1 fixes: **F1 (BLOCKER)** replaced the substring-based automatic-path assertions with exact parsed-value equality for `jobs.deploy.if` and the checkout `with.ref` (the expected dollar sign built with `String.fromCharCode(36)` so `${{` never appears literally in the `run:` script), pinned `workflow_dispatch.inputs` to exactly `['environment']`, added `if:`/`ref:` to the deploy diff forbidden set, and switched diff counting to the merge base; **F2 (BLOCKER)** added the three missing documentation corrections and matching greps (`deployment.md` “A dispatch chooses production explicitly.”, `vercel-render-neon.md` “Only a successful `workflow_run` … triggers **Deploy**”, and the § Routine development deploy `verify-workflows` list); **F3** corrected the AC-4(b) credential inventory (nine validated names are seven SMTP + `RENDER_SERVICE_ID` + `RENDER_API_KEY`; the hook, Neon and Vercel values are separate); **F4** the two failure fixtures now assert their exact rejection headers; **F5** added status/feature-index no-edit evidence; **F6** the proposed index row uses the single state `accepted`; **F7** the CI check now parses `ci.yml` and asserts the step list/position plus a pure-insertion diff; **F8** the `.env*` claim now covers tracked and untracked (non-ignored) paths with a recorded no-read statement for the ignored file; **F9** added the `production`-is-default warning and the `--ref main` rule to the production runbook. The INFO robustness note (merge-base diff) is folded into AC-3/AC-7.
- r1 — 2026-11-25 — initial draft.
