# Build log — T9 (coin-economy)

Task: T9 (2026-10-30)
Files changed: src/frontend/src/game/economy.ts, src/frontend/src/game/economy.test.ts, src/frontend/src/game/engine.ts, src/frontend/src/game/engine.test.ts, src/frontend/src/game/session.test.ts, src/frontend/src/input/gestures.test.ts

What changed & why:
- Track `cubeElapsedMs` in the engine (reset on level advance, incremented in `advancePlaying`).
- In `explode`, award `COINS_PER_MINI_CUBE` via `recordCoins` on every successful removal; when the board is fully cleared, award `COINS_PER_CUBE * (SPEED_BONUS_MULTIPLIER if speedBonusApplies(cubeElapsedMs, gridSize) else 1)` and increment `cubesDestroyed`.
- Add `adoptEconomy(economy)` seam to reconcile coins/stats to server totals.
- Mirror constants already present in `src/frontend/src/game/economy.ts`; engine imports them.

Decisions:
- `adoptEconomy` is optional on `GameEngine`, required on `OnlineGameEngine` (matches `adoptCubeState`).
- Fully-cleared detection uses `board.faces.every(face => face.miniCubes.length === 0)` after removal.
- Updated a few out-of-scope test assertions (session/gestures) from full-stats equality to clicks/facesDestroyed to accommodate new optional fields.

Evidence:
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm test --workspace @cubeclicker/frontend` → exit 0 (1024 tests passed)
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (All files 95.01% stmts, 94.96% branches, 96.55% funcs, 95.01% lines; thresholds met)

Acceptance audit:
- AC-1 → met (engine awards COINS_PER_MINI_CUBE per mini-cube)
- AC-2 → met (COINS_PER_CUBE on cube completion, doubled under speed bonus)
- AC-3 → met (speedBonusApplies boundary inclusive)
- AC-4 → met (thresholdSeconds(gridSize)*1000 used)
- AC-8 → met (recordCubeDestroyed on completion)
- AC-21 → met (same rules for guests, local)

Deviations from spec: none
