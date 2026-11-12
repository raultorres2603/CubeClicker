---
feature: small-destruction-shot-fx
state: accepted
spec_review_round: 2
build_round: 2
created: 2026-11-11
updated: 2026-11-11
---
# Status — Small explosions, mini-cube destroy, realistic shot

## Summary
Add small local explosions, a mini-cube "destroy" effect, and a more realistic spaceship shot effect, without reintroducing the removed massive gold explosion. Request: "Please, add little explosions, a minicube effect of 'destroy' and also more realistic shot effect from spaceship."

## Task board
- [x] T1 — Motion/quality tokens for small FX `[seq]`
- [x] T2 — Explosion, destroy and shot render effects `[seq]`
- [x] T3 — Scene wiring, visual/perf/docs gate `[seq]`
- [x] T4 — Fix impact core size (review B1) `[seq]`

## Loop log
- 2026-11-11 — created → PLANNING — small explosions + mini-cube destroy + realistic shot FX
- 2026-11-11 — planning → SPEC_REVIEW — spec r2 (3 pillars, 12 ACs, 3 tasks); spec review round 1 — spec.md
- 2026-11-11 — spec_review → PLANNING — review r1: changes_requested (1 blocking draw-bar math + 10 minor); planner r3 — reviews/spec-r1.md
- 2026-11-11 — planning → SPEC_REVIEW — spec r3 fixes F1–F11; spec review round 2 (final allowed) — spec.md
- 2026-11-11 — spec_review → AWAITING_APPROVAL — review r2: approved, 0 blocking, 3 info; user checkpoint — reviews/spec-r2.md
- 2026-11-11 — awaiting_approval → BUILDING — user approved small-FX spec r3; T1 started (freeze accepted index row first) — status.md
- 2026-11-11 — building — T1 completed (14 motion tokens + quality matrices); commit cae667b; frontend 1,694 tests; coverage 96.33/95.36/97.41/96.33 — build-log-T1.md
- 2026-11-11 — building — T2 completed (flash/embers/smoke, 140 ms destroy, bolt/muzzle/recoil); commit 9d46ffc; frontend 1,729 tests; coverage 96.43/95.43/97.47/96.43 — build-log-T2.md
- 2026-11-11 — building — T3 completed: all gates green (868 backend + 1,738 frontend), 38 evidence PNGs, effects windows measured, perf bars met, bundle 272.73 kB; commits 09c5f25/657f4ae — build-log-T3.md
- 2026-11-11 — building → CODE_REVIEW — all tasks [x]; code review round 1 — build-log-T3.md
- 2026-11-11 — code_review → BUILDING — review r1: changes_requested, 1 blocker (impact core ~2× size) + 2 minor; T4 fix required — reviews/code-r1.md
- 2026-11-12 — building — T4 completed (core geometry radius 0.5; 90→42–44 px @1280, 136→61–69 px @1920); commit 0703300; frontend 1,738 tests; coverage 96.44/95.44/97.47/96.44 — build-log-T4.md
- 2026-11-12 — building → CODE_REVIEW — T4 B1 fix verified; code review round 2 — reviews/code-r1.md / build-log-T4.md
- 2026-11-12 — code_review → ACCEPTED — review r2: approved, 0 blocking, 1 minor + 2 info; docs pass complete; feature index row added — reviews/code-r2.md

## Blockers / open questions
- None blocking. All 12 ACs met; core-size review blocker fixed in T4.
- Backlog: MINOR T4 impact-window frame caption says tile swelled when it is already zero-scaled (core size still proven by peak frames); INFO tasks.md T2 note still says `OctahedronGeometry(1,0)`; INFO T3 files_owned omits the disclosed `session.test.ts` update.
