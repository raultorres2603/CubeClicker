---
feature: manual-deploy-trigger
revision: 2
status: draft
created: 2026-11-01
updated: 2026-11-01
---
# Spec — Manual Deploy Trigger (amend `aws-deploy-pipeline` deploy trigger)

## Summary

Amend the `aws-deploy-pipeline` feature so that the deployment workflow (`deploy.yml`) no longer fires automatically on push to `main`. Instead it runs only on `workflow_dispatch` (manual trigger), so deploys happen on demand. CI is unchanged: `ci.yml` keeps its triggers (pull requests, push to `main`, and `workflow_call`), so the verification gates still run automatically on every push to `main` and on PRs. The deploy workflow's `verify` job still calls `ci.yml` via `workflow_call`, so the gates re-run on the selected ref (typically the merge commit on `main` for the default flow) immediately before any deploy — deliberate and documented. `environment: production` protection continues to apply. The reason for deferring automatic deploy is that only a single `production` environment exists; automatic deployment is deferred until a staging environment exists. This is a small, focused change: workflow YAML plus documentation only, no application code.

### Raw request (verbatim, scope boundary)

> "I don't want the CI/CD pipeline to trigger deploy automatically. Just, when pushing to main, I want pipeline to trigger CI part. Deployment part (CD) must be triggered manually, for now, because we just have production set."

## Scope

### In scope

- `.github/workflows/deploy.yml`: change the trigger from `on: push: branches: [main]` to `on: workflow_dispatch` (manual only). Keep the `verify` job calling `ci.yml` via `workflow_call`, the `concurrency` group, `environment: production`, OIDC, SHA-pinned actions, and the rest of the job chain unchanged.
- `.github/workflows/ci.yml`: explicitly unchanged — keep PR + push-to-main + workflow_call triggers (this feature asserts and protects that contract).
- Documentation: `docs/architecture/deployment.md` and the README Deployment section record the manual-deploy policy and its reason (single `production` environment; automatic deploy deferred until a staging environment exists), plus the updated deploy-flow first step (manual trigger instead of push to `main`).

### Explicitly out of scope

- No application code, tests, build config, or dependency changes. No `src/**`, `tests/**`, `compose*`, or Terraform changes.
- No new deploy environment: staging is still not shipped (carried over from `aws-deploy-pipeline`; this feature only defers automatic deploy because staging does not yet exist).
- No new workflow inputs beyond the minimal trigger. No `ref`/image-tag input is added; the deploy uses the triggering ref's SHA (`github.sha`) by default. Adding an input is a deliberate follow-up, not this feature.
- No changes to the agentic framework, container conventions, or provider-choice statements.
- No changes to OIDC roles, IAM, or Terraform modules.

## User stories

- As the project owner, I want CI to run automatically on push to `main` and on PRs, so every change is verified without manual action.
- As the project owner, I want deploys to happen only when I trigger them manually, so the single `production` environment is never auto-deployed from a merge while no staging environment exists to absorb regressions.
- As the reviewer, I want the manual-deploy policy and its reason recorded in the deployment docs, so the trigger choice is auditable and not mistaken for an oversight.

## Acceptance criteria

Verification conventions: commands run from the repository root. Trigger/contract ACs (AC-1–AC-4, AC-6) are verified by `grep`/inspection anchors recorded in build logs. Config-change ACs (AC-5) likewise. Workflow hygiene ACs (AC-7–AC-9) use the pinned containerized wrappers and audits from `AGENTS.md`/`docs/architecture/deployment.md`.

- **AC-1** — `.github/workflows/deploy.yml` triggers only manually: its `on:` block contains `workflow_dispatch` and contains no `push:` key and no `inputs:` block under `workflow_dispatch` (minimal trigger, per D-2). Evidence: `grep -n "workflow_dispatch" .github/workflows/deploy.yml` returns a match; `grep -n "push:" .github/workflows/deploy.yml` returns no match; `grep -n "inputs:" .github/workflows/deploy.yml` returns no match (inspection confirms the `workflow_dispatch:` key is bare).
- **AC-2** — `.github/workflows/deploy.yml` still gates via CI: it contains `uses: ./.github/workflows/ci.yml` (the `verify` job). Evidence: `grep -n "uses: ./.github/workflows/ci.yml" .github/workflows/deploy.yml` returns a match.
- **AC-3** — `.github/workflows/deploy.yml` retains `environment: production` on the deploy jobs (protection still applies). Evidence: `grep -n "environment: production" .github/workflows/deploy.yml` returns at least one match.
- **AC-4** — `.github/workflows/ci.yml` triggers are unchanged and complete: it contains `pull_request:`, `push:` with `branches: [main]`, and `workflow_call:`. Evidence: `grep -n "pull_request:" .github/workflows/ci.yml`, `grep -n "branches: \[main\]" .github/workflows/ci.yml`, `grep -n "workflow_call:" .github/workflows/ci.yml` each return a match.
- **AC-5** — `docs/architecture/deployment.md` documents the manual-deploy policy and its reason: it states that deploy is triggered manually via `workflow_dispatch`, that automatic deploy is deferred, and that the deferral is because only a single `production` environment exists (staging not yet shipped). Evidence: `grep -n "workflow_dispatch" docs/architecture/deployment.md` and a grep for the reason phrase (e.g. `grep -ni "single.*production\|staging" docs/architecture/deployment.md`) each return a match, recorded in the build log.
- **AC-6** — `README.md` Deployment section reflects the manual trigger: the deploy flow's first step is a manual `workflow_dispatch` trigger (not "push to `main`"), and a note states CD is manual because only the `production` environment exists. Evidence: `grep -n "workflow_dispatch\|manual" README.md` returns a match in the Deployment section; `grep -ni "manual.*production\|only.*production environment" README.md` returns a match (reason phrase); the prior "Push to `main`" first step is removed.
- **AC-7** — The changed workflow passes the pinned containerized `actionlint` wrapper: `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/deploy.yml` exits 0 (and the same over `.github/workflows/*.yml` exits 0).
- **AC-8** — Terraform regression guard is green (no Terraform changes in this feature): `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` exits 0 and `… validate infra/terraform` exits 0.
- **AC-9** — Workflow hygiene preserved: `grep -E 'uses: .*@v[0-9]+' .github/workflows/deploy.yml` returns no match (full-SHA pins only); `grep -n "id-token: write" .github/workflows/deploy.yml` is scoped to the deploy jobs (matches fall only inside the build-and-push/infra/deploy-services job permission blocks, never at workflow level); and the credential audit `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN"` returns no match.
- **AC-10** — No application code or out-of-scope files changed: `git diff --name-only` shows only `.github/workflows/deploy.yml`, `docs/architecture/deployment.md`, `README.md`, and the feature's build-log files (tracked set); `git status --porcelain` evidences the untracked build-log set. Evidence recorded in the build log.

## Non-goals

- No application code, tests, build config, or dependency changes (no `src/**`, `tests/**`, `compose*`, Terraform).
- No staging environment creation; staging remains a documented additive recipe only.
- No `workflow_dispatch` input for ref/image tag (kept minimal; default to the triggering ref's SHA via `github.sha`). Adding one is a deliberate follow-up.
- No changes to `ci.yml` triggers, OIDC roles, IAM, Terraform modules, container conventions, or the agentic framework.
- No new user checkpoint or state-machine change.

## Boundaries

- ✅ Always: keep SHA-pinned actions, OIDC, least-privilege, and the proof-of-working verification gate; record raw verify evidence (including actionlint + terraform wrapper outputs) in build logs; keep the change limited to workflow YAML + docs; treat `AGENTS.md`, `.opencode/**`, `README.md` as shared config (editor-diff discipline, no drive-by rewrites); in the acceptance documentation pass, propose the `docs/features/README.md` row for this feature per `docs/architecture/documentation.md` (orchestrator-owned index), consistent with `aws-deploy-pipeline`.
- ⚠️ Ask first: adding any `workflow_dispatch` input (kept out by default); changing `ci.yml` triggers; changing any Terraform value; running `terraform apply` against a real account.
- 🚫 Never: re-add an automatic `push` trigger to `deploy.yml`; commit secrets/keys/`.env*`/state; edit `src/**`, `tests/**`, `compose*`, or Terraform; weaken the coverage gate or the verification bar; git push.

## Security considerations

- No secrets are introduced or changed. All AWS authentication remains OIDC via `aws-actions/configure-aws-credentials` with `id-token: write` scoped to the deploy jobs; no long-lived keys. The trigger change does not alter the trust conditions (`environment:production`).
- Manual triggering reduces the blast radius of an accidental merge: a deploy now requires an explicit human action plus the `production` environment protection, in addition to the re-run gates.
- No dependency additions; no client-side secrets; no persistence changes.

## Containerization and real-time impact

- **Containerization:** none. This feature changes a workflow trigger and documentation only; it adds no services, images, ports, configuration, or deployables, and follows the settled conventions in `docs/architecture/containerization.md` without deviation. Containerization impact is explicitly out of scope.
- **Real-time:** none. No shared/cross-client state, connection lifecycle, reconnection, or server-authority changes. Real-time impact is explicitly out of scope (the WebSocket edge handling pinned by `aws-deploy-pipeline` is untouched).

## Testing strategy

- Unit: not applicable — no TypeScript/production code changes.
- Integration: not applicable — no module boundaries changed.
- Config/workflow verification (the feature-appropriate proof for this change):
  - `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/deploy.yml` (and `.github/workflows/*.yml`) exits 0.
  - Terraform regression: `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/hashicorp/terraform:1.15.9 fmt -check -recursive infra/terraform` and `… validate infra/terraform` exit 0.
  - Trigger/contract greps (AC-1–AC-6, AC-9) recorded as raw output in build logs.
  - Credential audit: `git grep -nE "AKIA|aws_secret_access_key|AWS_SESSION_TOKEN"` returns empty.
  - Inventory audit: `git diff --name-only` limited to the in-scope files (AC-10), with `git status --porcelain` evidencing the untracked build-log set.
- Coverage: `npm run coverage` is run as a regression guard (no TS changes; thresholds ≥ 80% statements/branches/functions/lines per workspace must remain green). It is not a new coverage target.
- E2E/containerized: the existing Mailpit-primed smoke recipe is unchanged and is not re-run by this feature's build (no cross-service behavior change); the pinned smoke gate remains the deploy-blocking gate inside `ci.yml`.

## Open questions

- **Q-1 — `workflow_dispatch` input for ref/image tag?** Default decision: none. Keep the trigger minimal and rely on GitHub's built-in ref selector plus `github.sha` (the triggering ref's tip SHA), which the existing build/push steps already use. Adding an explicit `ref`/image-tag input would require checkout-ref handling and a second source of truth for the image tag; deferred as a deliberate follow-up if needed. Confirm or override at approval.
- **Q-2 — Should the `verify` job re-run all gates on a manual trigger?** Default: yes (deliberate, documented in `docs/architecture/deployment.md` "Double gate on `main`" — renamed/extended to cover manual triggers). The gates re-run on the selected ref before any build/push/plan/apply.

## Assumptions

- `github.sha` on `workflow_dispatch` equals the tip SHA of the ref selected in the trigger UI, so image tags remain commit SHAs without a new input (Q-1).
- Builder permissions already cover `.github/**` and docs from the accepted `aws-deploy-pipeline` feature (T0 route (a)); no permission-bootstrap task is needed for this feature.
- No Terraform or application changes; the Terraform wrapper runs are regression guards only.
- The `aws-deploy-pipeline` spec's AC-12 sentence "triggers on push to `main`" is superseded by this feature for the trigger only; all other AC-12 content (job chain, flags, bake) remains in force.
- `docs/features/README.md` remains orchestrator-owned; the acceptance documentation pass for this feature proposes its row diff per `docs/architecture/documentation.md` (house rule), consistent with `aws-deploy-pipeline` AC-21(f).

## Revision history

- r2 — 2026-11-01 — spec-r1 review fixes (`reviews/spec-r1.md`, verdict `changes_requested`, 1 MAJOR + 6 MINOR): F1 pinned `grep -n "id-token: write"` in T1 and T-final verify; F2 removed the vacuous deployment.md grep (replaced with stale "push to `main`" absence anchor); F3 added `git status --porcelain` to T-final verify with documented coverage split; F4 reworded the Summary's re-run sentence; F5 added the bare-`workflow_dispatch`/no-`inputs:` verify anchor to T1; F6 added the reason-phrase grep to T2 verify; F7 added the `docs/features/README.md` row note to Boundaries/Assumptions. F8/F9 (INFO) left as build-time optional tightening.
- r1 — 2026-11-01 — initial draft.