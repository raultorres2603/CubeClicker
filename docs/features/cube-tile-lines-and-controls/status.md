---
feature: cube-tile-lines-and-controls
state: accepted
spec_review_round: 1
build_round: 1
created: 2026-10-21
updated: 2026-10-21
---
# Status — Cube Tile Lines & Pointer/Keyboard Controls

## Summary
Follow-up on `cube-world-transition`: make the mini-cube seams visible (lines between tiles) while keeping the cube-made-of-mini-cubes look; disable mouse/pointer-drag rotation so fast clicking never rotates the cube; rotation stays automatic (face-clear auto-rotation) and via keyboard W/A/S/D or arrows. Raw request: "I want to see the lines of the mini-cubes… we are going to click so fast … disable rotation by using click on mouse. Rotation … will be automatic as it is OR by using W/A/S/D or arrows (on keyboard)."

## Task board
- [x] T1 — Seamed mini-cube surface + pointer drag removal [P]
- [x] T2 — WASD + arrow keyboard rotation, canvas label [P]
- [x] T3 — Verify & integrate

## Loop log
- 2026-10-21 — created → planning — request: "see the lines of the mini-cubes … disable rotation by using click on mouse … automatic as it is OR by using W/A/S/D or arrows" — docs/features/cube-tile-lines-and-controls/status.md
- 2026-10-21 — planning → spec_review — planner completed r1: spec.md (AC-1…AC-6), plan.md, tasks.md (T1 ∥ T2 → T3) — docs/features/cube-tile-lines-and-controls/spec.md
- 2026-10-21 — spec_review → awaiting_approval — review r1 verdict: approved (blocking: 0) — docs/features/cube-tile-lines-and-controls/reviews/spec-r1.md
- 2026-10-21 — awaiting_approval → building — user approved spec r1 (Q-1…Q-6 pinned; ratio 0.95; drags ignored; WASD mapping) — status.md
- 2026-10-21 — building — T2 completed by builder (WASD + arrows, canvas label; commit 2dae075; 333 tests; coverage 99.33/99.41/100/99.33) — build-log-T2.md
- 2026-10-21 — building — T1 completed by builder (seams ratio 0.95, pointer drags ignored; commit 6e227bc; 336 tests; coverage 99.33/99.41/100/99.33; picking seam-miss literals corrected) — build-log-T1.md
- 2026-10-21 — building → code_review — T3 completed by builder (full gate green; build 209.69 kB gzip ≤ 350; smoke PASS 4/4; AC-1…AC-6 met; commit 37dd07c) — build-log-T3.md
- 2026-10-21 — code_review → accepted — review r1 verdict: approved (blocking: 0; AC-1…AC-6 met; 340 tests; coverage backend 100×4, frontend 99.33/99.41/100/99.33) — reviews/code-r1.md

## Blockers / open questions
- none blocking. Backlog (post-acceptance):
  - Manual visual pass (9 steps) pending — the frontend dev container was serving a stale transform; restart it (`podman compose restart frontend`) before the pass; focus: seams between mini-cubes (N = 3/5/7), fast clicking never rotates, drag does nothing, W/A/S/D + arrows rotate, intro skip, touch.
  - T1 picking deviation (code-review accepted): the task's NDC 0.11/0.12 seam-miss hint was geometrically impossible; the tests pin the true N=5 seam-miss window (0.110123, 0.118512) via 0.1144/0.118 → null plus inset hits; AC-1 met.
  - Residuals: `GameCanvas.tsx:23–30` (SSR), mocked `WebGLRenderer`, `ws/connection.ts`, `session.ts` branch.
  - Pre-existing docs drift outside the feature (README/cube-game-frontend status edits; untracked accepted-feature docs) left untouched.
