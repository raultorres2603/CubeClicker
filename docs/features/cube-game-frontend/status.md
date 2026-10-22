---
feature: cube-game-frontend
state: accepted
spec_review_round: 2
build_round: 1
created: 2026-10-18
updated: 2026-10-19
---
# Status — Cube Game Frontend (first playable 3D experience)

## Summary
First playable frontend of CubeClicker: a futuristic 3D cube with galaxy/starfield backdrop — intro animation into the cube, clickable mini-cubes on the big cube's faces that explode away on click, space rotation to change faces, faces disappear when cleared, and a transition to a new, differently styled cube when all faces are gone; live local stats for clicks and faces destroyed. Economy explicitly deferred.

## Task board
- [x] T1 — Add three.js dependencies (chore; Q-1 checkpoint resolved)
- [x] T2 — Domain model, board logic & glossary terms
- [x] T3 — Orientation, front-face and cursor model [P]
- [x] T4 — Progression, stats and cube styles [P]
- [x] T5 — Timings, easings and burst math [P]
- [x] T6 — Game engine: phases, events, intents, snapshot
- [x] T7 — Starfield (galaxy backdrop) [P]
- [x] T8 — Cube view (faces, mini-cubes, highlight, removal) [P]
- [x] T9 — Explosion particles (pooled) [P]
- [x] T10 — Picking (raycast to mini-cube id) [P]
- [x] T11 — Input mapping (gestures, keyboard) [P]
- [x] T12 — Scene composition, camera flights, intent application
- [x] T13 — Session wiring, browser environment & WebGL bootstrap
- [x] T14 — React UI: shell, HUD, canvas, theme
- [x] T15 — Verify & integrate

## Loop log
- 2026-10-18 — created → PLANNING — request: "Let's start by creating the frontend … 3D cube … mini cubes … explote animation … galaxy background"
- 2026-10-18 — planning → spec_review — planner completed r1: spec.md, plan.md, tasks.md written — docs/features/cube-game-frontend/spec.md
- 2026-10-18 — spec_review → planning — review r1 verdict: changes_requested (blocking: 3, F1–F3 MAJOR) — docs/features/cube-game-frontend/reviews/spec-r1.md
- 2026-10-18 — planning → spec_review — planner r2 revision applied (F1–F7 fixed; AC-22 added; T7 DAG edge corrected) — docs/features/cube-game-frontend/spec.md (revision 2)
- 2026-10-18 — spec_review → awaiting_approval — review r2 verdict: approved (blocking: 0) — docs/features/cube-game-frontend/reviews/spec-r2.md
- 2026-10-18 — awaiting_approval → building — user approved spec r2 incl. Q-1 three.js dependency (checkpoint) — status.md
- 2026-10-18 — building — T1 completed by builder (three@0.186.1 + @types/three@0.186.0; commit 035d5c1) — build-log-T1.md
- 2026-10-18 — building — T2 completed by builder (domain model, board logic, glossary; commit 67eb4e2) — build-log-T2.md
- 2026-10-18 — building — T4 completed by builder (progression, stats, 5 cube styles; commit 8dfcd30) — build-log-T4.md
- 2026-10-18 — building — T8 launched by builder into the free batch slot (T3, T5 still running) — status.md
- 2026-10-18 — building — T5 completed by builder (timings, easings, constants; commit 9056dd5) — build-log-T5.md
- 2026-10-18 — building — T7 launched by builder into the free batch slot (T3, T8 still running) — status.md
- 2026-10-18 — building — T3 completed by builder (rotation, front-face, cursor; commit 6e0ebe9) — build-log-T3.md
- 2026-10-18 — building — T9 launched (background) + T6 launched (foreground, seq hub) — status.md
- 2026-10-18 — building — T6 completed by builder (engine core; commit 91a21f2) — build-log-T6.md
- 2026-10-18 — building — T9 completed by builder (pooled particles; commit 4363f9a) — build-log-T9.md
- 2026-10-18 — building — T7 completed by builder (starfield; commit 5e7fddc) — build-log-T7.md
- 2026-10-18 — building — T8 completed by builder (cube view; commits 2e5a321 + docs commits, after index-race repair) — build-log-T8.md
- 2026-10-18 — building — T11 completed by builder (gestures, keyboard; commit 1c91ad7) — build-log-T11.md
- 2026-10-18 — building — T10 launched (background) + T12 launched (foreground, seq) — status.md
- 2026-10-18 — building — T12 completed by builder (scene composition, camera flights; commit 7135d47 + docs) — build-log-T12.md
- 2026-10-18 — building — T10 completed by builder (raycast picking; commit c1b8d0d) — build-log-T10.md
- 2026-10-18 — building — plan gap found pre-T13 (SceneView lacks cube-view handle for pickMiniCube); routed to planner for a minimal seam amendment + delta review — plan.md/tasks.md pending
- 2026-10-18 — building — planner applied plan r3/tasks r3 seam amendment (SceneView.cubeView accessor owned by T13) — plan.md r3
- 2026-10-18 — building — delta review r3: approved (blocking: 0); F1 comment fix folded into T13's brief — reviews/plan-delta-r3.md
- 2026-10-19 — building — T13 resumed: plan-r3 seam delta-approved; held partial work in the working tree; F1 gestures.ts comment-only fix folded (tasks r4) — tasks.md
- 2026-10-19 — building — T13 completed by builder (resume; skeleton was already committed in 02228ac; completion commit 9b90190; 263 tests; coverage 99.39/98.9/100/99.39) — build-log-T13.md
- 2026-10-19 — building — T14 completed by builder (game shell, HUD, canvas, theme; commit 2ca10ce; 273 tests; coverage 99.17/99.13/100/99.17; build 209.10 kB gzip) — build-log-T14.md
- 2026-10-19 — building → code_review — T15 completed by builder (full gate green: both workspaces ≥ 80; build 209.10 kB gzip ≤ 350 KB; smoke PASS 4/4; all AC-1…AC-22 met; commit 46840c7) — build-log-T15.md
- 2026-10-19 — code_review → accepted — review r1 verdict: approved (blocking: 0; all AC-1…AC-22 met; plan-r3 seam verified) — reviews/code-r1.md

## Blockers / open questions
- none blocking. Backlog (post-acceptance):
  - Manual browser visual pass executed 2026-10-20 (user, local stack): issues found — travel backdrop doesn't expand; explosion particles render behind the clicked mini-cube; plus design changes requested (intro search/find cinematic, pop-then-shrink click animation, remove cursor highlight) → follow-up feature `cube-visual-polish` opened.
  - `npm audit`: 4 advisories (2 moderate/2 critical) — pre-existing Vitest dev tooling, not `three`; semver-major fix out of scope.
  - Residual coverage (workspace bars met): `ui/GameCanvas.tsx:23–30` unexecuted under SSR (`src/ui` 79.48 statements); real GL context mocked in `webgl.test.ts`; `session.ts:173` branch; `picking.ts:88–89`; retained scaffold `ws/connection.ts` 95.34.
  - Audit trail: `02228ac` (T13 partial skeleton + feature docs, non-conventional message) and superseded hashes (T7 `5e7fddc`/`5709f45` → `b17058a`; T9 `6494791`→`4363f9a`; T8 `bbf403e`) retained by design — no history rewrite.
  - plan-delta-r3 F2 (spec Q-3 "≥ 40 px" paraphrase): spec r2 untouched; AC-6 evidence is the 39/40/41 px test pins.
