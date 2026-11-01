---
feature: smoke-test-hygiene
state: accepted
spec_review_round: 1
build_round: 1
created: 2026-11-01
updated: 2026-11-01
---
# Status — Smoke Test Hygiene

## Summary
Close the two remaining MINOR/INFO items from `smoke-mailpit-ordering`: (1) add the missing trailing newline to `compose.smoke.yaml` (F3/INFO); (2) make the Mailpit readiness poll use the dedicated 10s `MAILPIT_TIMEOUT_MS` instead of reusing the 30s `READY_TIMEOUT_MS` (F2/INFO). Backlog origin: `smoke-mailpit-ordering` code review r1.

## Task board
- [x] T1 — Add trailing newline to compose.smoke.yaml
- [x] T2 — Switch Mailpit readiness poll to MAILPIT_TIMEOUT_MS
- [x] T3 — Full verification sweep

## Loop log
- 2026-11-01 — created → PLANNING — request: "Do the 2 remaining backlog."
- 2026-11-01 — planning → spec_review — planner completed r1 spec/plan/tasks — docs/features/smoke-test-hygiene/spec.md
- 2026-11-01 — spec_review → awaiting_approval — verdict approved (r1, blocking 0, 3 nonblocking) — docs/features/smoke-test-hygiene/reviews/spec-r1.md
- 2026-11-01 — awaiting_approval → building — user approved — status.md (orchestrator)
- 2026-11-01 — building → code_review — all tasks [x]; T-final verification sweep green (unprimed + primed smoke 12/12, lint/typecheck/test/coverage/build all pass) — docs/features/smoke-test-hygiene/build-log-final-verification.md
- 2026-11-01 — code_review → accepted — verdict approved (r1, blocking 0, 1 nonblocking); documentation gate satisfied (no doc changes; README row applied) — reviews/code-r1.md

## Blockers / open questions
- None blocking. Backlog (MINOR/INFO) carried forward:
  - 1 nonblocking (INFO) from code review: pre-existing missing trailing newline in compose.smoke.yaml (now fixed); readiness poll reuses 30s READY_TIMEOUT_MS instead of 10s MAILPIT_TIMEOUT_MS (now fixed); compose-provider parity recorded as validated.
  - Spec review F1–F3 (MINOR/INFO): anchor tightenings, optional.
- Non-actionable backlog items documented as out of scope in spec.md Non-goals:
  - Historical verify-anchor false positives (aws-deploy-pipeline, manual-deploy-trigger) — historical artifacts, no action.
  - User-side AWS asset provisioning — operational, not code.
  - F22 podman-vs-Docker ARG nuance — already handled (two-line bridge stands).
- Suggested next step: provision the user-side AWS assets (from aws-deploy-pipeline Q-1) and run the first real `deploy.yml` against a real account; then consider the "plan-on-PR" follow-up (Q-7) consuming `AWS_PLAN_ROLE_ARN`; automatic deploy once a staging environment exists.
