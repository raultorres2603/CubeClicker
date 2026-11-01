---
feature: workflow-hygiene
state: accepted
spec_review_round: 1
build_round: 1
created: 2026-11-01
updated: 2026-11-01
---
# Status — Workflow Hygiene

## Summary
Close out the remaining actionable hygiene backlog from `aws-deploy-pipeline` and `manual-deploy-trigger`: (1) add trailing newlines to `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` (F6); (2) scope the documented credential-audit command so it does not flag benign documentation references in `docs/features/**` (F5/F7). Non-actionable backlog items (verify-anchor false positives in historical build logs, upstream Mailpit ordering defect, user-side AWS asset provisioning, F22 podman-vs-Docker ARG nuance) are documented as out of scope / external.

## Task board
- [x] T1 — Add trailing newline to ci.yml and deploy.yml
- [x] T2 — Scope the documented credential-audit command
- [x] T3 — Refresh verify anchors in deployment.md (scoped form)
- [x] T-final — Full verification sweep

## Loop log
- 2026-11-01 — created → PLANNING — request: "Proceed with all backlogs you posted here."
- 2026-11-01 — planning → spec_review — planner completed r1 spec/plan/tasks — docs/features/workflow-hygiene/spec.md
- 2026-11-01 — spec_review → awaiting_approval — verdict approved (r1, blocking 0, 7 nonblocking) — docs/features/workflow-hygiene/reviews/spec-r1.md
- 2026-11-01 — awaiting_approval → building — user approved — status.md (orchestrator)
- 2026-11-01 — building → code_review — all tasks [x]; T-final verification sweep green (actionlint/terraform/npm all pass; AC-1..AC-10 met) — docs/features/workflow-hygiene/build-log-T-final.md
- 2026-11-01 — code_review → accepted — verdict approved (r1, blocking 0, 5 nonblocking); documentation gate satisfied (T3 doc pass + README row applied) — reviews/code-r1.md

## Blockers / open questions
- None blocking. Backlog (MINOR/INFO) carried forward:
  - F1 (MINOR, code r1): `push:` grep false positive on `build-and-push` job id (historical, accepted — no action).
  - F2 (MINOR, code r1): lowercase stale-wording guard (optional).
  - F3 (MINOR, code r1): literal positional `terraform validate infra/terraform` exits 1 though working form passes (optional).
  - F4 (MINOR, code r1): `workflow-hygiene` row was absent from README (now applied by orchestrator).
  - F5 (MINOR, code r1): build-log evidence narrative about "untracked build-log set" slightly inaccurate (optional).
  - Spec review F1–F9 (MINOR/INFO): minor anchor tightenings, optional.
- Non-actionable backlog items documented as out of scope in spec.md Non-goals:
  - Verify-anchor false positives in historical build logs (aws-deploy-pipeline, manual-deploy-trigger) — historical artifacts, no action.
  - Upstream Mailpit ordering defect in one-shot `npm run smoke` — pre-existing, separate concern.
  - User-side AWS asset provisioning (account/role ARNs, S3 state bucket, protected `production` environment, `PUBLIC_WS_URL`) — operational, not code.
  - F22 (INFO): podman-vs-Docker ARG injection nuance — already handled (two-line bridge stands).
- Suggested next step: provision the user-side AWS assets (from aws-deploy-pipeline Q-1) and run the first real `deploy.yml` against a real account; consider the "plan-on-PR" follow-up (Q-7) consuming `AWS_PLAN_ROLE_ARN`.
