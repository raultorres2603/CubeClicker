# Build log — T4 — Hub integration (load, multipliers, purchase, broadcast)

Task: T4 (2026-10-30)
Files changed: src/backend/src/game/hub.ts (src/backend/src/game/hub.test.ts unchanged)
What changed & why: Added `upgrades: UpgradeState` to `Member`. `handleJoin` now awaits `findUpgradesByUserId` for accounts and stores the loaded levels (default `{}` for guests/absent repo); `placementFor` includes `upgrades` for accounts (possibly `{}`). `handleExplode` credits `roundCoins(COINS_PER_MINI_CUBE * miniCubeMultiplier(member.upgrades))`. `handleCompletion` credits `roundCoins(COINS_PER_CUBE * cubeMultiplier(member.upgrades) * (2 if speed bonus else 1))` and computes the speed bonus using `thresholdSeconds(gridSize) + speedWindowSeconds(member.upgrades)` seconds (inclusive) against the server clock. Added `handlePurchaseUpgrade(member, connection, upgradeId)` (async): early return for guests; reloads upgrades from the repository first; derives `currentLevel`/`cost` from that DB value; validates the catalog (`unknown_upgrade`) and max level (`max_level`); calls `purchaseUpgrade` (any `null` → `insufficient_funds`); on success updates all members with the same `accountId` and broadcasts `economyUpdate` + `upgradesUpdate` to joined account connections. Routed `message.type === 'purchaseUpgrade'` in `handleMessage`. Added `broadcastUpgradesUpdate` helper.

Decisions: `upgrades` only included in `Placement` for accounts (guests omit, per AC-11). Guest purchase is a silent no-op with no repo call/broadcast. `speedBonusApplies` helper no longer used; inlined comparison with the upgrade-extended threshold. `upgradeCost` returns `Infinity` at max but max-level is rejected before reaching purchase.

Evidence:
- `npm run lint` → pass (no output)
- `npm run typecheck --workspace @cubeclicker/backend` → exit 0
- `npm test --workspace @cubeclicker/backend` → 21 test files, 580 tests passed
- `npm run coverage --workspace @cubeclicker/backend` → exit 0 (hub.ts 85.54% stmts / 90.36% branches / 94.11% funcs / 85.54% lines; all files ≥ 80%)
Acceptance audit: AC-2, AC-3, AC-4, AC-5, AC-7, AC-9, AC-10, AC-11, AC-14, AC-15, AC-21, AC-22 → met.
Deviations from spec: none