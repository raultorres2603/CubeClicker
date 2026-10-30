---
feature: coin-economy
state: building
spec_review_round: 2
build_round: 1
created: 2026-10-28
updated: 2026-10-28
---
# Status — Coin Economy

## Summary
Add an in-game economy: coins earned by destroying mini-cubes and cubes, with a speed bonus, persisted per user account along with per-user in-game statistics.

## Task board
(none yet)

## Loop log
- 2026-10-28 — created → PLANNING — request: "I want to add economy on the game. For each mini-cube we destroy, we'll gain 0.X coins, and, for every cube we destroy, we'll gain X amount of coins. Each cube, based on the dimensions of them, if you destroy it in less than X seconds (seconds depend on the size of the cube), you'll gain x2 of regular coins for this specific cube. Coins must remain on user's account, it are persistent. Stadistics that are in-game, per user, must remain on accounts aswell, not per game session."
- 2026-10-28 — planning → spec_review — planner completed spec/plan/tasks — docs/features/coin-economy/spec.md
- 2026-10-28 — spec_review → planning — changes_requested r1 (6 MAJOR) — docs/features/coin-economy/reviews/spec-r1.md
- 2026-10-28 — planning → spec_review — planner revised spec/plan/tasks r2 — docs/features/coin-economy/spec.md
- 2026-10-28 — spec_review → awaiting_approval — verdict approved (r2, 0 blocking, 4 non-blocking) — docs/features/coin-economy/reviews/spec-r2.md
- 2026-10-28 — awaiting_approval → building — user approved spec + Q-1/Q-2/Q-3/Q-5 defaults — docs/features/coin-economy/spec.md
- 2026-10-30 — building → code_review — all tasks [x], T_final verify passed (lint/typecheck/test/coverage/build + container/doc gates) — docs/features/coin-economy/build-log-T_final.md
- 2026-10-30 — code_review → building — changes_requested r1 (2 MAJOR) — docs/features/coin-economy/reviews/code-r1.md

## Blockers / open questions
- Approval-gated questions Q-1, Q-2, Q-3, Q-5 resolved with the approved defaults (COINS_PER_MINI_CUBE=0.1, COINS_PER_CUBE=5, thresholdSeconds(gridSize)=gridSize*5, persisted stats scope coins/clicks/facesDestroyed/cubesDestroyed) per status log entry 2026-10-28 (awaiting_approval -> building). Q-4, Q-6, Q-8, Q-10, Q-11 resolved as proposed defaults; Q-7 deferred and Q-9 non-goal (see spec Open questions).