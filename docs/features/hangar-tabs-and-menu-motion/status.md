---
feature: hangar-tabs-and-menu-motion
state: spec_review
spec_review_round: 2
build_round: 0
created: 2026-11-17
updated: 2026-11-17
---

# Status — Hangar Tabs & Menu Motion

## Summary

Refine the shipped Neon Forge UI: split the oversized spaceship customization panel into smaller in-panel tabs, add glitch/futuristic open animations to menus, and apply screenshot-driven polish. The leaderboard/HUD overlap reported in the same message is fixed in the `game-feel-overhaul` T12 review fix and is out of this feature's scope. Raw request: "Cool, now, it look awesome, BUT: - Leaderboard overlaps a little bit Pilot Status box - Spaceship customization is quite big, we should be able to split it into smaller menus inside it, like, different tabs. - I want you to add glitch animations and/or futuristic animations when we open a menu. Check if you can improve any other thing based on this screenshot, that is how is looking game now: [Image 1]"

## Task board

- [ ] T1 — Menu-motion tokens `[P]`
- [ ] T2 — Hangar tab catalog module `[P]`
- [ ] T3 — Hangar tabs in the panel `[seq]`
- [ ] T4 — CSS: tab chrome, menu boot, screenshot polish `[seq]` — budgeted as two sessions
- [ ] T5 — Verify, integrate and document `[seq]`

## Loop log

- 2026-11-17 — created → PLANNING — request: hangar tabs, menu-open glitch/futuristic animations, screenshot polish; leaderboard overlap handled in `game-feel-overhaul` T12.
- 2026-11-17 — planning → spec_review — planner completed spec/plan/tasks r1 after a completion pass: 29 ACs, 6 tasks, five catalog tabs, CSS-only 320 ms menu boot, screenshot polish — `spec.md`, `plan.md`, `tasks.md`
- 2026-11-17 — spec_review → planning — changes_requested r1 (4 BLOCKER, 4 MAJOR, 8 MINOR/INFO) — `reviews/spec-review-r1.md`
- 2026-11-17 — planning → spec_review — planner applied r2: set-union catalog, wing count 2, height/geometry ban fixed, reduced-motion specificity + reveal-spotlight gap, control counts, aria-controls removed/stable panel id, keyframe stops pinned, T5 App task deleted/rebase on `544cce8`, 5 tasks — `spec.md` r2

## Blockers / open questions

- Final spec review round 2 in progress.
- Approval checkpoint will present Q-1…Q-15 defaults (tabs, preview, animation style/intensity/surfaces, crew pill, scrollbars, HUD minimize, mobile, polish scope).
