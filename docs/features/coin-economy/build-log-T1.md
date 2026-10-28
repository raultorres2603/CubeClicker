# Build log — T1 (coin-economy)

## Scope

Implemented backend economy constants and pure helpers in
`src/backend/src/game/economy.ts` with unit tests in
`src/backend/src/game/economy.test.ts`.

## Approved defaults used (Q-1/Q-2/Q-3 approval-gated; Q-4/Q-8 default-with-notice)

- `COINS_PER_MINI_CUBE = 0.1`
- `COINS_PER_CUBE = 5`
- `SPEED_BONUS_MULTIPLIER = 2`
- `thresholdSeconds(gridSize) = gridSize * 5`
- `roundCoins`: 2 decimals, half-up
- `speedBonusApplies`: elapsed ms <= threshold (seconds) * 1000, inclusive boundary

## Verify commands

- `npm run lint` — exit 0
- `npm run typecheck` — exit 0
- `npm test --workspace @cubeclicker/backend` — exit 0 (510 tests passed incl. 9 new)
- `npm run coverage --workspace @cubeclicker/backend` — exit 0 (thresholds met; economy.ts 100% stmts/branches/funcs/lines)
