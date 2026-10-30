# Build log — T8 — Engine upgrades (multipliers, adoptUpgrades, snapshot)

Task: T8 (2026-10-30)
Files changed: src/frontend/src/game/engine.ts, src/frontend/src/game/engine.test.ts
What changed & why: Implemented upgrade effects in the engine: mini-cube awards now use `roundCoins(COINS_PER_MINI_CUBE * miniCubeMultiplier(upgrades))`; full-cube awards use `roundCoins(COINS_PER_CUBE * cubeMultiplier(upgrades) * (2 if speed bonus else 1))` with the speed bonus computed as `cubeElapsedMs <= (thresholdSeconds(gridSize) + speedWindowSeconds(upgrades)) * 1000` (inclusive). `adoptUpgrades` already replaces the whole map and invalidates the snapshot; `upgrades` is carried in the snapshot (optional base, required in `OnlineEngineSnapshot`). Added unit tests for per-upgrade effects, speed-window boundary, future-only application, adoptUpgrades replacement and snapshot carriage.
Decisions: Imported `roundCoins`/`thresholdSeconds` from `./economy` and the three multipliers from `./upgrades`; dropped the now-unused `speedBonusApplies` import. Kept `SPEED_BONUS_MULTIPLIER` for the 2x factor. `adoptUpgrades` assigns the incoming map (whole replacement, no merge) and invalidates.
Evidence:
- `npm run lint` → pass (no output)
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0
- `npm test --workspace @cubeclicker/frontend` → 43 test files, 1085 tests passed
- `npm run coverage --workspace @cubeclicker/frontend` → All files 95.24% statements / 95.04% branches / 96.65% functions / 95.24% lines (≥80); `src/game` 95.37% / 99.64% / 97.88% / 95.37%; `engine.ts` 99.68% statements / 100% branches / 100% functions / 99.68% lines
Acceptance audit: AC-2 → met (mini-cube reward uses `roundCoins(COINS_PER_MINI_CUBE * miniCubeMultiplier(upgrades))`); AC-3 → met (cube reward uses `roundCoins(COINS_PER_CUBE * cubeMultiplier(upgrades) * (2 if speed bonus else 1))`); AC-4 → met (speed-bonus threshold `(thresholdSeconds(gridSize) + speedWindowSeconds(upgrades)) * 1000`, inclusive); AC-5 → met (upgrades adopted mid-play affect only subsequent awards; tested); AC-16 → met (engine holds `upgrades` init `{}`, applies it, exposes `adoptUpgrades`); AC-17 → met (`EngineSnapshot.upgrades` optional base, `OnlineEngineSnapshot.upgrades` required, always populated).
Deviations from spec: none