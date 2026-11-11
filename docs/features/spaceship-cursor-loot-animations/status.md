---
feature: spaceship-cursor-loot-animations
state: accepted
spec_review_round: 2
build_round: 2
created: 2026-11-08
updated: 2026-11-09
---
# Status — Pointer ship, granular loot parts, satisfying animations

## Summary
Three-part enhancement: (1) replace the default pointer-following spaceship with a simple but realistic model; (2) make lootbox customization parts highly specific (one wing at a time, cabin, ignitions, etc.) instead of whole sets; (3) add fluent, satisfying animations inspired by the user's reference video. Request: "Now, it looks better. What about changing default spaceship that is following our pointer? Is super simple, I would like one that looks more realistic, something simple, but realistic. Also, the parts we gain by openning lootboxes must be very specific and detailed, so: gaining 1 wing instead of all wings in ones, cabine, ignitions, etc... Also, I would like to have this animations on game: /home/raultorraco/Downloads/gemini_generated_video_6c10d7c9.mp4 ... Proceed with this feature."

## Task board
- [x] T1 — Backend v2 catalog module `[P]`
- [x] T2 — Migration 006 + schema mirror `[P]`
- [x] T3 — Backend protocol v2 `[P]`
- [x] T4 — Repository v2/normalization `[seq]`
- [x] T5 — Hub + app migration to v2 `[seq]`
- [x] T6 — Frontend v2 catalog module `[P]`
- [x] T7 — Motion tokens + ship motion `[P]`
- [x] T8 — Cursor model factory `[seq]`
- [x] T9 — Cursor + scene + effects integration `[seq]`
- [x] T10 — Protocol mirror + engine/session/picking `[seq]`
- [x] T11 — Live preview `[seq]`
- [x] T12 — UI integration `[seq]`
- [x] T13 — Documentation pass `[seq]`
- [x] T15 — Fix lootbox reveal layout `[seq]`
- [x] T16 — Wire ship fly-by to level completion `[seq]`
- [x] T14 — Verify & integrate `[seq]`

## Loop log
- 2026-11-08 — created → PLANNING — request: pointer ship realism + granular lootbox parts + reference-video animations
- 2026-11-08 — reference video decoded (10 s, 24 fps) and analyzed; observed/extrapolated motion folded into spec r2 — video-analysis.md / reference/
- 2026-11-08 — planning → SPEC_REVIEW — package complete (51 ACs, 23 tasks); spec review round 1 — spec.md
- 2026-11-08 — spec_review → PLANNING — review r1: changes_requested (15 blocking, 12 non-blocking); planner revision r3 required — reviews/spec-r1.md
- 2026-11-08 — planning → SPEC_REVIEW — planner delivered r3 (14 green-per-task tasks); spec review round 2 (final allowed) — spec.md
- 2026-11-08 — spec_review → ESCALATED — review r2: changes_requested, 1 blocking (performance design vs. 16.7 ms budget) + 9 non-blocking; spec review budget exhausted; user decision required — reviews/spec-r2.md
- 2026-11-08 — escalated → PLANNING — user chose adaptive quality tier to preserve 60 fps; planner r4 amendment required — user decision
- 2026-11-08 — planning → AWAITING_APPROVAL — r4 adds user-approved adaptive tier (AC-52); all 52 ACs map to 14 tasks; final user checkpoint — spec.md r4
- 2026-11-08 — awaiting_approval → BUILDING — user approved spec r4; T1/T6/T7 started — status.md
- 2026-11-08 — building — T1 completed (backend catalog v2, 30 parts/10 slots); commit 2c2efcb; backend 740 tests; coverage 94.63/86.63/99.69/94.63 — build-log-T1.md
- 2026-11-08 — building — T7 completed (motion tokens + ship motion math); commit 1658cf5; frontend 1,435 tests; coverage 96.12/95.61/96.8/96.12 — build-log-T7.md
- 2026-11-08 — building — T6 completed (frontend catalog v2, 30 parts/10 slots); commit 6baaf22; frontend 1,441 tests; coverage 96.13/95.62/96.8/96.13 — build-log-T6.md
- 2026-11-08 — building — T3 completed (protocol v2, additive); commit 5c35052; backend 804 tests; coverage 94.73/87.01/99.69/94.73 — build-log-T3.md
- 2026-11-08 — building — T2 completed (migration 006 + schema, real PG, pg_dump); commit 43ebfe4; backend 818 tests; coverage 94.73/87.02/99.69/94.73 — build-log-T2.md
- 2026-11-08 — building — T8 completed (cursor model factory, 32 objects/21 meshes/19 materials/776 tris); commit ac0dce4; frontend 1,475 tests; coverage 96.29/95.66/96.87/96.29 — build-log-T8.md
- 2026-11-08 — building — T4 completed (repository v2 + normalization, real PG); commit e59f2c8; backend 851 tests; coverage 95.34/87.48/99.69/95.34 — build-log-T4.md
- 2026-11-08 — building — T5 completed (hub/app v2, opener-only reveal, legacy ownership); commit c5edbcb; backend 868 tests; coverage 95.43/87.71/99.7/95.43 — build-log-T5.md
- 2026-11-08 — building — T9 completed (cursor/scene/effects/quality; 136 objects, +21 draws, adaptive tier); commit 9e06e6a; frontend 1,531 tests; coverage 96.17/95.61/96.98/96.17 — build-log-T9.md
- 2026-11-08 — building — T10 completed (protocol mirror + session/picking); commit 42ed34a; frontend 1,636 tests; coverage 96.11/95.61/97.06/96.11 — build-log-T10.md
- 2026-11-08 — building — T11 completed (live 30 fps preview); commit b767084; frontend 1,545 tests (clean worktree); coverage 96.1/95.48/97.01/96.1 — build-log-T11.md
- 2026-11-08 — building — T12 completed (UI integration: slots/reveal/coin/banner/CSS); commit 34df3d2; frontend 1,695 tests; coverage 96.28/95.26/97.42/96.28 — build-log-T12.md
- 2026-11-08 — building — T13 completed (README + glossary + docs pass); commit 512c01b; feature-index row proposed — build-log-T13.md
- 2026-11-09 — building — T14 blocked at AC-41: lootbox reveal card clipped (reveal 18 px, orb 0 px, card 198 px clipped) by panel flex/scroll; T15 CSS/layout fix added — build-log-T14.md
- 2026-11-09 — building — T15 completed (reveal layout fixed; 18→306 px, orb 0→80 px); commit 0bfc524; frontend 1,697 tests; coverage 96.28/95.26/97.42/96.28 — build-log-T15.md
- 2026-11-09 — building — T14 completed: all gates green (868 backend + 1,697 frontend tests, coverage, build 273.16 kB, smoke 12/12); AC-41 fixed; high-tier 16.666 ms; evidence committed 8d4c633 — build-log-T14.md
- 2026-11-09 — building → CODE_REVIEW — all tasks T1–T15 [x]; code review round 1 — tasks.md / build-log-T14.md
- 2026-11-09 — code_review → BUILDING — review r1: changes_requested, 1 blocking (AC-40 fly-by not triggered in production) + 2 minor; T16 fix required — reviews/code-r1.md
- 2026-11-09 — building — T16 completed (production level-completion fly-by trigger, 1,700 tests); commit ba77801; AC-40 integration test — build-log-T16.md
- 2026-11-09 — building — T14 completed (post-T16): production fly-by 2π/16-point trail, reduced-motion zero, all gates green, smoke 12/12; commit ba11d9a — build-log-T14.md
- 2026-11-09 — building → CODE_REVIEW — T16 AC-40 fix verified; code review round 2 — reviews/code-r1.md / build-log-T16.md
- 2026-11-09 — code_review → ACCEPTED — review r2: approved, 0 blocking, 1 minor + 2 info; docs pass complete; feature index row added — reviews/code-r2.md

## Blockers / open questions
- None blocking. All 52 ACs verified met; adaptive quality tier user-approved and implemented.
- Backlog: MINOR stale `build-log-T14.md` HEAD transcript label; INFO AC-41 orb easing approximation (cubic-bezier vs keyframed overshoot); INFO mobile/browser evidence not re-run in round 2.
