# Build log — T3 — Backend protocol upgrades + codec
Task: T3 (2026-10-30)
Files changed: src/backend/src/game/protocol.ts, src/backend/src/game/protocol.test.ts
What changed & why: Added `UpgradeState` type, optional `upgrades` field on `Placement`, `upgradesUpdate` server message, `purchaseUpgrade` client message, and new error codes `insufficient_funds`/`unknown_upgrade`/`max_level`. `placementPayload` now defensively copies `upgrades` when present; added `upgradesUpdateMessage` (and `purchaseUpgradeMessage`) builders. `parseClientMessage` decodes `purchaseUpgrade` with a non-empty string `upgradeId`. Updated tests with concrete payloads.
Decisions: `upgrades` kept optional on `Placement`/welcome/worldEntered (always present for accounts at runtime, possibly `{}`); `copyUpgradeState` shallow-copies keys; `purchaseUpgradeMessage` builder added for parity convenience.
Evidence:
- `npm run lint` → pass (no output)
- `npm run typecheck --workspace @cubeclicker/backend` → exit 0
- `npm test --workspace @cubeclicker/backend` → 21 test files, 580 tests passed
- `npm run coverage --workspace @cubeclicker/backend` → exit 0 (protocol.ts 97.43% stmts / 95.94% branches / 96% funcs / 97.43% lines; all files ≥ 80%)
Acceptance audit: AC-6 → met (purchaseUpgrade client message + codec validates non-empty string upgradeId); AC-11 → met (upgrades field on Placement, copied in placementPayload); AC-12 → met (upgradesUpdate server message + upgradesUpdateMessage builder; UpgradeState type).
Deviations from spec: none