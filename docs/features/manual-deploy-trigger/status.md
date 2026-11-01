---
feature: manual-deploy-trigger
state: accepted
spec_review_round: 2
build_round: 1
created: 2026-11-01
updated: 2026-11-01
---
# Status — Manual Deploy Trigger

## Summary
Change the deployment workflow so CI runs automatically on push to main (and PRs), but the CD/deploy step is triggered manually (workflow_dispatch) only, because only a single `production` environment exists. Raw request: "I don't want the CI/CD pipeline to trigger deploy automatically. Just, when pushing to main, I want pipeline to trigger CI part. Deployment part (CD) must be triggered manually, for now, because we just have production set."

## Task board
- [x] T1 — Switch deploy.yml trigger to workflow_dispatch (manual)
- [x] T2 — Document manual-deploy policy in deployment.md + README
- [x] T-final — Full verification sweep

## Loop log
- 2026-11-01 — created → PLANNING — request: "I don't want the CI/CD pipeline to trigger deploy automatically. Just, when pushing to main, I want pipeline to trigger CI part. Deployment part (CD) must be triggered manually, for now, because we just have production set."
- 2026-11-01 — planning → spec_review — planner completed r1 spec/plan/tasks — docs/features/manual-deploy-trigger/spec.md
- 2026-11-01 — spec_review → planning — changes_requested (F1 MAJOR: AC-9 id-token scope sub-check has no pinned verify command; F2–F7 MINOR verification/wording gaps) — docs/features/manual-deploy-trigger/reviews/spec-r1.md
- 2026-11-01 — planning → spec_review — planner completed r2 revision (F1–F7 resolved; F8/F9 optional) — docs/features/manual-deploy-trigger/spec.md
- 2026-11-01 — spec_review → awaiting_approval — verdict approved (r2, blocking 0, 2 INFO) — docs/features/manual-deploy-trigger/reviews/spec-r2.md
- 2026-11-01 — awaiting_approval → building — user approved — status.md (orchestrator)
- 2026-11-01 — building → code_review — all tasks [x]; T-final verification sweep green (actionlint/terraform/npm all pass; AC-1..AC-10 met) — docs/features/manual-deploy-trigger/build-log-final-verification.md
- 2026-11-01 — code_review → accepted — verdict approved (r1, blocking 0, 3 MINOR + 2 INFO); documentation gate satisfied (T2 doc pass + README row applied) — reviews/code-r1.md

## Blockers / open questions
- None blocking. Backlog (MINOR/INFO) carried forward:
  - F1 (MINOR, code r1): `push:` grep false positive on `build-and-push` job id (literal trigger key absent).
  - F2 (MINOR, code r1): lowercase stale-wording guard (actual wording capitalized "Push to `main`").
  - F3 (MINOR, code r1): literal positional `terraform validate infra/terraform` exits 1 though the working form passes.
  - F10/F11 (INFO, spec r1/r2): minor anchor tightenings applied at build time.
  - Spec review F8/F9 (INFO): optional AC-5/AC-6 anchor tightening.
- User-side assets still to provision (from aws-deploy-pipeline): AWS account/role ARNs, S3 state bucket, protected `production` environment, `PUBLIC_WS_URL`.
- Suggested next step: when a staging environment is added, revisit automatic deploy (the policy is documented in deployment.md as deferred).
