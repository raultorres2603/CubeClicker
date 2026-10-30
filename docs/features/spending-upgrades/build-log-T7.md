# Build log — T7 — Frontend protocol mirror

Task: T7 (2026-10-30)
Files changed: src/frontend/src/multiplayer/protocol.ts, src/frontend/src/multiplayer/protocol.test.ts
What changed & why: Mirrored the backend protocol for spending/upgrades: added `UpgradeState` (re-exported from game/types), `upgrades?: UpgradeState` on `Placement`, `upgradesUpdate` server message, `purchaseUpgrade` client message, error codes `insufficient_funds`/`unknown_upgrade`/`max_level`, codec validation (integer levels, non-empty keys) for placement/upgradesUpdate, and builders `upgradesUpdateMessage`/`purchaseUpgradeMessage`. Parity tests added.
Decisions: Kept `upgrades` optional on Placement (matches backend); parseUpgradeState validates non-empty string keys and integer values; defensive copies in builders/decode.
Evidence:
- `npm run lint` → pass (no output)
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0
- `npm test --workspace @cubeclicker/frontend` → 43 test files, 1077 tests passed
- `npm run coverage --workspace @cubeclicker/frontend` → All files 95.22% statements / 95.02% branches / 96.64% functions / 95.22% lines (≥80); protocol.ts 85.71% stmts / 95.53% branches / 88% funcs / 85.71% lines
Acceptance audit: AC-6 → met (purchaseUpgrade client message + codec validates non-empty string upgradeId); AC-11 → met (upgrades field on Placement, parsed/copied); AC-12 → met (upgradesUpdate server message + upgradesUpdateMessage builder + integer-level codec validation).
Deviations from spec: none