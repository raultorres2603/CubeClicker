---
feature: hangar-tabs-and-menu-motion
state: accepted
spec_review_round: 2
build_round: 1
created: 2026-11-17
updated: 2026-11-17
---

# Status — Hangar Tabs & Menu Motion

## Summary

Refine the shipped Neon Forge UI: split the oversized spaceship customization panel into smaller in-panel tabs, add glitch/futuristic open animations to menus, and apply screenshot-driven polish. The leaderboard/HUD overlap reported in the same message is fixed in the `game-feel-overhaul` T12 review fix and is out of this feature's scope. Raw request: "Cool, now, it look awesome, BUT: - Leaderboard overlaps a little bit Pilot Status box - Spaceship customization is quite big, we should be able to split it into smaller menus inside it, like, different tabs. - I want you to add glitch animations and/or futuristic animations when we open a menu. Check if you can improve any other thing based on this screenshot, that is how is looking game now: [Image 1]"

## Task board

- [x] T1 — Menu-motion tokens `[P]`
- [x] T2 — Hangar tab catalog module `[P]`
- [x] T3 — Hangar tabs in the panel `[seq]` — App.test two-hunk rewrite included (r2a)
- [x] T4 — CSS: tab chrome, menu boot, screenshot polish `[seq]` — 4a + 4b
- [x] T5 — Verify, integrate and document `[seq]`

## Loop log

- 2026-11-17 — created → PLANNING — request: hangar tabs, menu-open glitch/futuristic animations, screenshot polish; leaderboard overlap handled in `game-feel-overhaul` T12.
- 2026-11-17 — planning → spec_review — planner completed spec/plan/tasks r1 after a completion pass: 29 ACs, 6 tasks, five catalog tabs, CSS-only 320 ms menu boot, screenshot polish — `spec.md`, `plan.md`, `tasks.md`
- 2026-11-17 — spec_review → planning — changes_requested r1 (4 BLOCKER, 4 MAJOR, 8 MINOR/INFO) — `reviews/spec-review-r1.md`
- 2026-11-17 — planning → spec_review — planner applied r2: set-union catalog, wing count 2, height/geometry ban fixed, reduced-motion specificity + reveal-spotlight gap, control counts, aria-controls removed/stable panel id, keyframe stops pinned, T5 App task deleted/rebase on `544cce8`, 5 tasks — `spec.md` r2
- 2026-11-17 — spec_review → awaiting_approval — r2 approved (0 blocking, 3 MINOR, 3 INFO); spec ready for Q-1…Q-15 checkpoint — `reviews/spec-review-r2.md`
- 2026-11-17 — awaiting_approval → building — user approved the spec and Q-1…Q-15 defaults, and confirmed presence/game-feel were moved to `main`; build starts from a fresh `feat/hangar-tabs-and-menu-motion` branch — user decision
- 2026-11-17 — building T1 + T2 queued — motion tokens ∥ tab catalog (parallel-safe) — `tasks.md` T1/T2
- 2026-11-17 — building T1 completed — commit `bc41e9a`; four tokens 320/120/90/140, 96-key pin; frontend 2440 tests, coverage 96.84/96.51/98.04/96.84 — `build-log-T1.md`
- 2026-11-17 — building T2 completed — commit `adcb7f2`; five-tab catalog, set-union/order, legacy count 2, 100% coverage; frontend 2457 tests, coverage 96.85/96.52/98.04/96.85 — `build-log-T2.md`
- 2026-11-17 — building T3 started — tablist/tabpanel in the panel, roving focus, badges, post-reveal landing — `tasks.md` T3
- 2026-11-17 — T3 test-ownership amendment (r2a) — App.test.tsx's two pre-tab assertions moved into T3; spec AC-29/T5 gate updated; no design change — `spec.md` r2a
- 2026-11-17 — building T3 completed — commit `9f4543b`; tablist/tabpanel, roving keyboard, 20/40 counts, landing; frontend 2479 tests, coverage 96.86/96.52/98.06/96.86 — `build-log-T3.md`
- 2026-11-17 — building T4a started — tab chrome, preview heights, scrollbars, HUD chevron, mobile strip — `tasks.md` T4
- 2026-11-17 — building T4a completed — commit `b144c8b`; tab chrome/badges/panel, scrollbars, 24 px HUD chevron, 44 px/stack checks; frontend 2491 tests, coverage 96.86/96.52/98.06/96.86 — `build-log-T4.md`
- 2026-11-17 — building T4b started — menu boot keyframes, crew pill, reduced-motion specificity, no-timer crew test — `tasks.md` T4
- 2026-11-17 — building T4b completed — commit `e8eff72`; five keyframes, boot gating, crew pill, scoped reduced-motion (OS + session), specificity/order guards; frontend 2505 tests, coverage 96.86/96.52/98.06/96.86 — `build-log-T4.md`
- 2026-11-17 — building T5 started — root gates, docs (`## Menu motion`, glossary), bundle/deferred chunk; manual matrix pending GUI host — `tasks.md` T5
- 2026-11-17 — T5 executable gate completed — commit `1dd73db`; lint/typecheck/test/coverage/build/smoke 28/28 green; backend 1538 / frontend 2505; deferred chunk proof; docs pass; manual matrix + AC-24 traces still need a GUI host — `build-log-T5.md`
- 2026-11-17 — awaiting user visual/motion pass — tabs, menu boot, crew pill, HUD chevron, scrollbars, reduced motion, reveal non-modal, 375/320 mobile — user checklist sent
- 2026-11-17 — user visual/motion pass — "It works well" for tabs, boot, polish, responsive and reveal; recorded as manual matrix evidence. AC-24 instrumentation traces were not captured; the automated no-new-rAF/context/bundle evidence covers the structural half and the trace tables remain environment-deferred. — user message
- 2026-11-17 — building → code_review — all T1–T5 `[x]`; executable gate green; manual visual pass recorded — `build-log-T5.md`
- 2026-11-17 — code review verified code/gates green; sole remaining gap is the AC-24 10s idle + 10 clicks/s trace protocol, not captured in the headless environment — reviewer report
- 2026-11-17 — **explicit user waiver** — the user waived the AC-24 10s idle + 10 clicks/s trace protocol because the environment is headless; the real-browser visual/motion pass and the structural/bundle evidence (no new rAF/WebGL/quality code, CSS-only boot, deferred chunk) are accepted, and no trace table is claimed as passed — user decision
- 2026-11-17 — code_review → accepted — code review r1 approved (0 blocking, 2 MINOR/INFO: F1 optional `<canvas>` identity assertion, F2 acceptance bookkeeping); all AC-1…AC-29 met with the AC-24 waiver recorded; docs pass complete; index row updated — `reviews/code-review-r1.md`

## Blockers / open questions

- none
- **Backlog (MINOR/INFO):** F1 the AC-4 test could additionally assert the preview `<canvas>` node identity (optional); F2 acceptance bookkeeping (index row plus the board/status/review commit) closed by this commit.

## Review history

- Spec: r1 changes requested (4 BLOCKER, 4 MAJOR, 8 MINOR/INFO) → r2 approved (0 blocking, 3 MINOR, 3 INFO).
- Code: r1 approved (0 blocking, 2 MINOR/INFO).
