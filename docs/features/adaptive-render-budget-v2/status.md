---
feature: adaptive-render-budget-v2
state: accepted
spec_review_round: 3
build_round: 2
created: 2026-11-12
updated: 2026-11-12
---
# Status — Adaptive Render Budget v2

## Summary

First performance feature of the approved audit queue: stop creating the Three.js renderer/scene and the rAF loop until the auth gate closes, make the existing automatic high/medium/low tier control GPU cost (SSAO, bloom, shadow resolution, DPR), and replace the per-frame p95 copy+sort with a maintained sorted window. High tier keeps today's exact visual look; medium and low degrade gracefully. Raw request: "Please, find any kind of performance optimizations we can do on project and, also, find new skills we added and provide some new features you think are good to have" followed by "Proceed with all of them, one by one".

## Task board
- [x] T1 — Quality GPU matrix and sorted-window p95 (builder) `[seq]`
- [x] T2 — Tier-aware renderer and session propagation (builder) `[seq]`
- [x] T3 — Scene shadow budget (builder) `[seq]`
- [x] T4 — Gate-deferred attach (builder) `[seq]`
- [x] T5 — Documentation and final verification (builder) `[seq]`

## Loop log
- 2026-11-12 — created → PLANNING — audit queue item 1 (performance); raw request: "Proceed with all of them, one by one"
- 2026-11-12 — spec review r1 → changes_requested (1 blocker, 2 major); planner revision r2 pending — `reviews/spec-review-r1.md`
- 2026-11-12 — planner revision r2 applied; T3 changed to `[seq]`; → SPEC_REVIEW round 2 — `spec.md` r2
- 2026-11-12 — spec review r2 → changes_requested (1 major: AC-12 stable streak 1→7); planner revision r3 pending — `reviews/spec-review-r2.md`
- 2026-11-12 — planner revision r3 applied (AC-12 streak claim removed; AC-2/AC-4 evidence aligned); → SPEC_REVIEW round 3 — `spec.md` r3
- 2026-11-12 — spec_review → awaiting_approval — r3 approved (0 blockers); visual decisions Q-1/Q-2/Q-3 + AC-18 supersession need user confirmation — `reviews/spec-review-r3.md`
- 2026-11-12 — awaiting_approval → building — user approved defaults: Q-1 low-tier shadows off; Q-2 intro from start at gate close (AC-18 animation clause superseded); Q-3 DPR 2/1.5/1.0 — user message
- 2026-11-12 — building T1 completed — quality GPU matrix + sorted p95; commit `0e8343a`; frontend coverage 96.45/95.45/97.48/96.45; `quality.ts` 98.31/97.43/100/98.31 — `build-log-T1.md`
- 2026-11-12 — building T2 completed — tier-aware postprocessing/renderer/session; commit `39f664b`; frontend coverage 96.46/95.47/97.49/96.46; named welcome test green — `build-log-T2.md`
- 2026-11-12 — building T3 completed — tiered shadow map; commit `ff9d1a4`; frontend coverage 96.46/95.48/97.49/96.46; high 2048 / medium 1024 / low off — `build-log-T3.md`
- 2026-11-12 — building T4 completed — gate-deferred attach; commit `5d0869b`; frontend coverage 96.47/96.14/97.64/96.47; named welcome test green — `build-log-T4.md`
- 2026-11-12 — building T5 completed — docs + final verification; commit `11c5468`; manual visual pass not executed (no browser/GUI in environment) — `build-log-T5.md`
- 2026-11-12 — building → code_review — all T1-T5 verified; backend coverage 95.43/87.71/99.70/95.43, frontend 96.47/96.14/97.64/96.47; build green — `build-log-T5.md`
- 2026-11-12 — code_review → accepted — code review r1 approved (0 blockers); all 17 ACs verified; manual visual pass environment-deferred — `reviews/code-review-r1.md`

## Blockers / open questions
- Q-1 — low-tier shadows: recommended fully off (alternative: one static contact-shadow plane); see `spec.md` § Open questions.
- Q-2 — intro timing after gate close: recommended the intro plays from its start at attach; the `user-authentication` AC-18 "animating behind the overlay" clause is superseded in the ledger.
- Q-3 — DPR ladder: recommended 2 / 1.5 / 1.0; tunable before acceptance if the containerized visual pass finds low too soft.
- Draft artifacts written (spec r3, plan r3, tasks); spec approved r3; user approved Q-1/Q-2/Q-3 defaults; building complete; manual visual pass environment-deferred.
