---
feature: cube-visual-polish-followup
state: accepted
spec_review_round: 2
build_round: 1
created: 2026-10-21
updated: 2026-10-21
---
# Status — Cube Visual Polish Follow-up (backdrop, intro, level transition)

## Summary
Second visual pass after `cube-visual-polish`: the starfield backdrop has a gap on the right side; the intro must keep the cube framed while the camera approaches from far away; and the level transition must arrive at the next cube instead of swapping it in instantly. Raw request: "Background looks broken, on right side, there's no stars… Intro should be pointing to the cube BUT, the camera, being far away and, we, as the user, approaching to it… We should go to the next cube, not appearing this new cube instantly."

## Task board
- [x] T1 — `travelSwing`, `TRAVEL_LEVEL_ADVANCE_P` and pinned travel tables
- [x] T2 — Starfield cone + swirl, intro dolly, travel-arrival scene wiring [P]
- [x] T3 — Engine midpoint level advance [P]
- [x] T4 — Verify & integrate

## Loop log
- 2026-10-21 — created → planning — request: "Background looks broken, on right side … camera … approaching to it … go to the next cube, not appearing this new cube instantly" — docs/features/cube-visual-polish-followup/status.md
- 2026-10-21 — planning → spec_review — planner completed r1: spec.md (4 ACs), plan.md, tasks.md (T1 → {T2 ∥ T3} → T4) — docs/features/cube-visual-polish-followup/spec.md
- 2026-10-21 — spec_review → awaiting_approval — review r1 verdict: approved (blocking: 0) — docs/features/cube-visual-polish-followup/reviews/spec-r1.md
- 2026-10-21 — awaiting_approval → building — user approved spec r1 (Q-1…Q-5 pinned; travel-peak sparseness accepted) — status.md
- 2026-10-21 — building — T1 completed by builder (travelSwing + TRAVEL_LEVEL_ADVANCE_P; commit 62616bb; 274 tests; coverage 99.31/99.36/100/99.31) — build-log-T1.md
- 2026-10-21 — building — T2 blocked: rectangular cone not swirl-invariant; coverage fails at swirl π/4 — build-log-T2.md
- 2026-10-21 — building — T3 completed by builder (engine advances the level at the travel midpoint; commit bef14a7; 284 tests; coverage 99.31/99.36/100/99.31) — build-log-T3.md
- 2026-10-21 — building — planner issued spec r2 (square cone `STARFIELD_TAN = 1.251258882715913`; corrected AC-1 coverage criterion; density pins re-grounded; false invariance claim removed; tasks T2 updated) — spec.md (revision 2)
- 2026-10-21 — building — spec review r2: approved (blocking: 0; square-cone geometry and density pins verified) — reviews/spec-r2.md
- 2026-10-21 — building — T2 completed by builder (re-dispatch with spec r2 square cone: camera-anchored cone + swirl, intro dolly, travel arrival wiring; commit 51de432; 291 tests; coverage 99.31/99.36/100/99.31) — build-log-T2.md
- 2026-10-21 — building → code_review — T4 completed by builder (full gate green; build 209.38 kB gzip ≤ 350; smoke PASS 4/4; AC-1…AC-4 met; integration coupling verified; commit 90f407a) — build-log-T4.md
- 2026-10-21 — code_review → accepted — review r1 verdict: approved (blocking: 0; AC-1…AC-4 met; supersession ledger verified) — reviews/code-r1.md

## Blockers / open questions
- none blocking. Backlog (post-acceptance):
  - Manual visual pass (spec § Manual visual pass, 10 steps) not yet executed by a human — stack running with hot reload at http://localhost:5173; steps 1 (backdrop coverage incl. right edge/aspects), 2 (intro framed approach) and 8 (travel arrival) are the reported defects.
  - Superseded accepted behaviors (six, ledger in spec r2): polish AC-1 travel values/drift mechanics, polish AC-2 intro path, polish AC-1 manual step 1, predecessor AC-22 flights, predecessor AC-10 level-advance timing, predecessor AC-3 star positions.
  - Visual notes: rest-scale starfield ≈ 302 visible at 16:9 (per-cell ≥ 5); travel peak ≈ 5 (expansion look); reduced motion = instant swap.
  - Spec r2 correction: T2 block (rectangle not swirl-invariant) → square cone; blocked attempt + resolution preserved in build-log-T2.
  - T4 notes: pre-existing uncommitted docs drift (`docs/features/README.md`, `docs/features/cube-game-frontend/status.md`, untracked planning docs) predates T1; residuals: `GameCanvas.tsx:23–30`, mocked `WebGLRenderer`, `ws/connection.ts`, `session.ts:173`.
  - Post-acceptance request (2026-10-21): directional transition to a randomly placed next cube, mini-cube-built cube surface (no black faces), and random per-level mini-cube counts → follow-up feature `cube-world-transition` opened.
