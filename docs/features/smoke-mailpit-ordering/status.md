---
feature: smoke-mailpit-ordering
state: accepted
spec_review_round: 1
build_round: 1
created: 2026-11-01
updated: 2026-11-01
---
# Status — Smoke Test Mailpit Ordering Fix

## Summary
Fix the pre-existing one-shot smoke-test defect discovered during `aws-deploy-pipeline`: `npm run smoke` (`podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`) fails 9/12 (auth register 500) unless `podman compose ... up -d mailpit` runs first — Mailpit is not in the smoke service's `depends_on` closure. The fix makes the one-shot smoke command green (12/12) without manual pre-steps, restoring the documented one-command contract. Backlog origin: `aws-deploy-pipeline` reviews spec-r1 (F2) and build logs.

## Task board
- [x] T1 — Add Mailpit to smoke service depends_on (compose.smoke.yaml)
- [x] T2 — Add Mailpit readiness poll to smoke.mjs
- [x] T3 — Full verification sweep

## Loop log
- 2026-11-01 — created → PLANNING — request: "Proceed with all backlogs you posted here." (actionable subset: upstream Mailpit ordering defect)
- 2026-11-01 — planning → spec_review — planner completed r1 spec/plan/tasks — docs/features/smoke-mailpit-ordering/spec.md
- 2026-11-01 — spec_review → awaiting_approval — verdict approved (r1, blocking 0, 5 nonblocking) — docs/features/smoke-mailpit-ordering/reviews/spec-r1.md
- 2026-11-01 — awaiting_approval → building — user approved — status.md (orchestrator)
- 2026-11-01 — building → code_review — all tasks [x]; T-final verification sweep green (unprimed + primed smoke 12/12, lint/typecheck/test/coverage/build all pass) — docs/features/smoke-mailpit-ordering/build-log-final-verification.md
- 2026-11-01 — code_review → accepted — verdict approved (r1, blocking 0, 3 nonblocking); documentation gate satisfied (no doc changes; README row applied) — reviews/code-r1.md

## Blockers / open questions
- None blocking. Backlog (MINOR/INFO) carried forward:
  - 3 INFO notes from code review: pre-existing missing trailing newline in compose.smoke.yaml; readiness poll reuses 30s READY_TIMEOUT_MS instead of 10s MAILPIT_TIMEOUT_MS; compose-provider parity recorded as validated.
  - Spec review F1–F5 (MINOR/INFO): anchor tightenings applied at build time where applicable.
- Non-actionable backlog items documented as out of scope in spec.md Non-goals:
  - Historical verify-anchor false positives (aws-deploy-pipeline, manual-deploy-trigger) — historical artifacts, no action.
  - User-side AWS asset provisioning — operational, not code.
  - F22 podman-vs-Docker ARG nuance — already handled (two-line bridge stands).
- Suggested next step: provision the user-side AWS assets (from aws-deploy-pipeline Q-1) and run the first real `deploy.yml` against a real account; consider the "plan-on-PR" follow-up (Q-7) consuming `AWS_PLAN_ROLE_ARN`; automatic deploy once a staging environment exists.
