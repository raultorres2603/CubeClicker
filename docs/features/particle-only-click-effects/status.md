---
feature: particle-only-click-effects
state: accepted
spec_review_round: 2
build_round: 1
created: 2026-11-11
updated: 2026-11-11
---
# Status — Particle-only click effects

## Summary
Remove the massive yellow/gold explosion from the click impact while retaining particle sparks/debris. Request: "I don't like this massive yellow explosion you made, remove it. The other features are perfect." Clarification: "I mean, the massive explosion in yellow. I want particles."

## Task board
- [x] T1 — Remove gold rays/coins/ring; keep shards/particles `[seq]`
- [x] T2 — Final visual/perf/docs verification `[seq]`

## Loop log
- 2026-11-11 — created → PLANNING — remove gold explosion, keep particles
- 2026-11-11 — planning → SPEC_REVIEW — spec r1: remove 12-ray fan + coin glyphs + ring; keep 14 shards + sparks; 2 tasks — spec.md
- 2026-11-11 — spec_review → PLANNING — review r1: changes_requested (3 blocking gates, 9 non-blocking); planner r2 — reviews/spec-r1.md
- 2026-11-11 — planning → SPEC_REVIEW — spec r2 fixes F1–F12; spec review round 2 (final allowed) — spec.md
- 2026-11-11 — spec_review → AWAITING_APPROVAL — review r2: approved, 0 blocking, 3 non-blocking; user checkpoint — reviews/spec-r2.md
- 2026-11-11 — awaiting_approval → BUILDING — user approved removal; T1 started (precondition: freeze accepted feature-index row) — status.md
- 2026-11-11 — building — T1 completed (gold rays/coins/ring removed; 14/7/0 shards + 24/12/0 sparks; scene 133); commits d5a83f6/d515a6e; frontend 1,693 tests; coverage 96.31/95.35/97.41/96.31 — build-log-T1.md
- 2026-11-11 — building — T2 completed: all gates green, 36/36 perf traces, no gold explosion, shards/sparks + reduced clear, README updated; commit 2263598 — build-log-T2.md
- 2026-11-11 — building → CODE_REVIEW — all tasks [x]; code review round 1 — build-log-T2.md
- 2026-11-11 — code_review → ACCEPTED — review r1: approved, 0 blocking, 3 minor; docs pass complete; feature index row added — reviews/code-r1.md

## Blockers / open questions
- None blocking. All ACs met; user-approved removal boundary implemented.
- Backlog: MINOR AC-6 90–180 ms spark-window wording vs 180 ms shot-travel (honestly documented; spark proof at 300–320 ms); MINOR 1920 before-frame caption overclaims the predecessor frame; MINOR shard-physics constants verified by diff but not directly pinned by a test.
