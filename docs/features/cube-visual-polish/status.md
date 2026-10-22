---
feature: cube-visual-polish
state: accepted
spec_review_round: 1
build_round: 1
created: 2026-10-20
updated: 2026-10-21
---
# Status — Cube Visual Polish (follow-up to cube-game-frontend)

## Summary
Follow-up visual/behavior polish after the user's manual pass on the accepted `cube-game-frontend`: the travel backdrop must expand; a new intro "search → find → approach" cinematic; explosion particles must render in front of the clicked mini-cube; a pop-then-shrink + subtle colour change on click; and removal of the highlighted mini-cube. Raw request: "Background doesn't expand… remove the highlighted minicube."

## Task board
- [x] T1 — Effect constants, pop timeline math & particle layering pins
- [x] T2 — Starfield expansion, pop animation, burst front-offset & intro cinematic
- [x] T3 — Remove the keyboard selection cursor feature
- [x] T4 — Verify & integrate

## Loop log
- 2026-10-20 — created → planning — request: "Background doesn't expand … intro to search the new cube … particles explode behind mini-cube … animation of the mini-cube disappearing … remove the highlighted minicube" — docs/features/cube-visual-polish/status.md
- 2026-10-20 — planning → spec_review — planner completed r1: spec.md (7 ACs), plan.md, tasks.md (4 sequential tasks) — docs/features/cube-visual-polish/spec.md
- 2026-10-20 — spec_review → awaiting_approval — review r1 verdict: approved (blocking: 0; 1 MINOR doc note F1) — docs/features/cube-visual-polish/reviews/spec-r1.md
- 2026-10-20 — awaiting_approval → building — user approved spec r1 (Option B cursor removal; Q-2 expansion 8×, Q-3 colour 1.3×, Q-4 intro choreography kept) — status.md
- 2026-10-20 — building — T1 completed by builder (constants + pop math + particle layering; commit 4d786b4; 278 tests; coverage 99.19/99.15/100/99.19) — build-log-T1.md
- 2026-10-21 — building — T2 completed by builder (resumed; starfield expansion, pop animation, burst front-offset, intro cinematic, render-layer highlight removal; commit 5804730; 293 tests; coverage 99.34/99.4/100/99.34; D-1 ratified) — build-log-T2.md
- 2026-10-21 — building — T3 completed by builder (keyboard cursor feature removed end-to-end; commit b6f71e6; 269 tests; coverage 99.31/99.36/100/99.31; production-code cursor/highlight grep clean) — build-log-T3.md
- 2026-10-21 — building → code_review — T4 completed by builder (full gate green: lint/typecheck/test 269; coverage backend 100×4, frontend 99.31/99.36/100/99.31; build 209.49 kB gzip ≤ 350; smoke PASS 4/4; AC-1…AC-7 met; commit 423004f) — build-log-T4.md
- 2026-10-21 — code_review → accepted — review r1 verdict: approved (blocking: 0; all AC-1…AC-7 met; supersession ledger verified) — reviews/code-r1.md

## Blockers / open questions
- none blocking. Backlog (post-acceptance):
  - Manual visual pass (spec § Manual visual pass, 9 steps) not yet executed by a human — local stack is up with hot reload at http://localhost:5173; run `podman compose down` when done.
  - Accessibility note (approved Option B): keyboard-only play can no longer explode cubes; arrow-key rotation remains.
  - Residuals: `GameCanvas.tsx` effect body under SSR; mocked `WebGLRenderer`; pre-existing uncovered lines (`ws/connection.ts`, `picking.ts`, `session.ts`); `npm audit` advisories are pre-existing Vitest tooling.
  - Audit notes: T2 D-1 ratified (tasks.md r2); T2 O-2 float residual pinned; T3 label-grep `-r`/doc wording/snapshot-trigger; feature planning docs remain untracked.
  - Post-acceptance visual check (2026-10-21): starfield right-side gap; intro camera should stay framed on the cube while approaching; level change should be an arrival, not an instant swap → follow-up feature `cube-visual-polish-followup` opened.
