# Build log — T6 (frontend types + upgrades module)

## Files changed
- `src/frontend/src/game/types.ts` — added `UpgradeState` type.
- `src/frontend/src/game/upgrades.ts` — new mirrored catalog/costs/multipliers + `UpgradeDefinition` alias.
- `src/frontend/src/game/upgrades.test.ts` — new unit tests (20 tests).
- `src/frontend/src/game/engine.ts` — added `upgrades?` to `EngineSnapshot`, required `upgrades` in `OnlineEngineSnapshot`, `adoptUpgrades?` seam on `GameEngine` and required on `OnlineGameEngine`; minimal state + method + snapshot field.

## Verification
- `npm run lint` — passed (no output).
- `npm run typecheck` (frontend) — passed.
- `npm test --workspace @cubeclicker/frontend` — 43 test files, 1057 tests passed.
- `npm run coverage --workspace @cubeclicker/frontend` — All files 95.18% statements / 94.97% branches / 96.62% functions / 95.18% lines (≥80). `upgrades.ts` 94.44%.

## Notes
- `UpgradeDef` (backend mirror) and `UpgradeDefinition` alias both exported for compatibility.