---
feature: deploy-development-manual-trigger
state: accepted
spec_review_round: 2
build_round: 1
created: 2026-11-25
updated: 2026-11-25
---
# Status — Manual Development Deploy Trigger

## Summary
Add `development` to the `deploy.yml` `workflow_dispatch` input so the development environment can be deployed manually, while preserving the automatic `workflow_run` deploy from `main` and the existing production manual path.

## Task board
- [x] T1 — Add the development manual dispatch path `[seq]`
- [x] T2 — Documentation and verification `[seq]`

## Loop log
- 2026-11-25 — created → planning — raw request: "Need you to add development on deploy pipeline, to be able to trigger it manually aswell" — docs/features/deploy-development-manual-trigger/status.md
- 2026-11-25 — planning → spec_review — spec/plan/tasks r1 authored (10 ACs, 2 tasks); spec review round 1 dispatched — spec.md, plan.md, tasks.md
- 2026-11-25 — spec_review → planning — review r1 changes_requested (2 blocking: CI parse substring drift; missing deployment/vercel doc statements); planner revision r2 dispatched — reviews/spec-r1.md
- 2026-11-25 — planning → spec_review — r2 authored addressing F1–F9; spec review round 2 dispatched (final) — reviews/spec-r2.md (pending)
- 2026-11-25 — spec_review → awaiting_approval — review r2 approved (0 blocking; 5 nonblocking); user checkpoint dispatched — reviews/spec-r2.md
- 2026-11-25 — awaiting_approval → building — user approved spec r2; T1 dispatched — reviews/spec-r2.md
- 2026-11-25 — building — T1 completed (commit f169648; verify exit 0; actionlint/parse/diff/guard fixtures pass); T2 dispatched — build-log-T1.md
- 2026-11-25 — building → code_review — T1/T2 complete; T2 verify exit 0 on committed tree; commits 5dc77a7 + 8d5f8fc; code review round 1 dispatched — build-log-T2.md
- 2026-11-25 — code_review → accepted — review r1 approved (0 blocking; 6 nonblocking); T2 docs pass complete; feature-index row applied — reviews/code-r1.md

## Blockers / open questions
- Accepted 2026-11-25. Optional post-merge live development dispatch remains user-owned proof.
- Q-1 (user-owned): production remains the default manual choice (preserves production behavior; fails closed while unprovisioned). Development default is the alternative.
- Q-2 (user-owned): production stays manual-only and unprovisioned; auto-deploy production is out of scope.
- Q-3 (user-owned): a non-`main` dispatch would mix Vercel's dispatched ref with Render's tracked `main`; docs pin `--ref main` but no ref guard is added.
