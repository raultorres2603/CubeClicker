---
feature: manual-deploy-trigger
revision: 2
---
# Plan — Manual Deploy Trigger

## Architecture

A single, small change to the deploy trigger plus documentation:

1. `.github/workflows/deploy.yml` — the `on:` block changes from `push: branches: [main]` to `workflow_dispatch`. No other workflow structure changes: the `verify` job still calls `./.github/workflows/ci.yml` via `workflow_call`, the `concurrency` group, `environment: production`, OIDC, and the job chain remain as pinned by `aws-deploy-pipeline`. Image tagging continues to use `github.sha` (the triggering ref's tip SHA on a manual run).
2. `.github/workflows/ci.yml` — untouched; its triggers (PR + push to `main` + `workflow_call`) are asserted, not changed.
3. Documentation — `docs/architecture/deployment.md` gains a trigger-policy section (manual `workflow_dispatch` only; automatic deploy deferred because only a single `production` environment exists; staging is a future additive recipe) and the "Double gate" section is generalized to manual triggers; the README Deployment section's deploy-flow first step becomes a manual trigger with a matching note.

No modules, data flow, or state ownership changes. No application code, Terraform, or container changes.

## Interfaces / contracts

- Trigger contract (pinned): `deploy.yml` `on:` = `workflow_dispatch` only (no `push:`); `ci.yml` `on:` = `pull_request` + `push: branches: [main]` + `workflow_call`.
- Gate contract (unchanged): `deploy.yml` `verify` job `uses: ./.github/workflows/ci.yml`.
- Protection contract (unchanged): `environment: production` on deploy jobs.
- Image tag contract (unchanged): `github.sha`.
- Documentation contract: deployment.md + README record the manual-deploy policy and reason.

## File inventory

| Path | New/Edit | Purpose | Owned by |
| --- | --- | --- | --- |
| `.github/workflows/deploy.yml` | Edit | trigger: `workflow_dispatch` only | T1 |
| `docs/architecture/deployment.md` | Edit | manual-deploy policy + reason; trigger generalization | T2 |
| `README.md` | Edit | Deployment section: manual trigger first step + note | T2 |
| `docs/features/manual-deploy-trigger/build-log-*.md` | New | per-task raw evidence | each task (own build log only) |

Never touched: `src/**`, `tests/**`, `compose*`, `infra/**`, `.github/workflows/ci.yml`, `package.json`, lockfiles, `.env*`, other docs.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Trigger becomes `workflow_dispatch` only (remove `push`) | Matches the request: CI auto-runs, CD is manual while only `production` exists | Keeping `push` but gating with a boolean input (still auto-fires; defeats the purpose); moving CI into deploy (loses auto-CI on push) |
| D-2 | No `workflow_dispatch` input for ref/image tag; rely on GitHub's built-in ref selector and `github.sha` | Minimal; the existing build/push steps already use `github.sha`, which equals the selected ref's tip SHA on a manual run | Adding a `ref` input (requires checkout-ref handling and a second source of truth for the tag; deferred) |
| D-3 | `verify` job still calls `ci.yml` via `workflow_call` on manual trigger | Deliberate double gate: gates re-run on the selected ref before any deploy; documented, not an oversight | Skipping gates on manual trigger (would let an unverified ref deploy) |
| D-4 | Documentation-only scope beyond the YAML | The policy and its reason must be auditable; README + deployment.md are the pinned doc targets | Editing only deployment.md (README's deploy flow would still say "push to main", contradicting the workflow) |

## Risks & mitigations

- **Forgetting to deploy** after a merge → documented manual step in README + deployment.md; CI still runs automatically so regressions surface on push; the `production` environment protection remains.
- **Stale "push to main" wording in docs** → T2 updates both README deploy flow and deployment.md trigger policy in the same task; grep guards in verify.
- **Manual trigger on a non-`main` ref** → `github.sha` tracks the selected ref; image tags remain commit SHAs; gates re-run on that ref via `verify`. Documented in Q-1/Q-2.
- **Trigger removal accidentally drops `workflow_dispatch`** → AC-1 grep guards (presence of `workflow_dispatch`, absence of `push:`) in T1 and T-final.

## Open questions

- Consumes spec.md § Open questions Q-1, Q-2 (same IDs; plan adds no new ones).

## Verification boundary

Acceptance is artifact + credential-less verification green (actionlint, Terraform wrapper regression, grep audits, coverage regression) — no real AWS apply, consistent with `aws-deploy-pipeline`. No new verification boundary is introduced.

## Revision history

- r2 — 2026-11-01 — spec-r1 review fixes (F1–F7): T1/T-final verify now pin `grep -n "id-token: write"` (scoped to deploy jobs); T2 verify drops the vacuous deployment.md grep and adds the reason-phrase + stale-"push to main" anchors; T-final verify adds `git status --porcelain` alongside `git diff --name-only` with documented coverage split; T1 verify adds the bare-`workflow_dispatch`/no-`inputs:` anchor. Spec Summary reworded per F4. No interface/contract or file-inventory changes.