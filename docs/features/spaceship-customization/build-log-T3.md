# Build log — T3 (Economy repository customization methods)

## Files changed
- `src/backend/src/auth/economy-repository.ts`
- `src/backend/src/auth/economy-repository.test.ts`

## Summary
Added `CustomizationState` interface and four customization methods to `EconomyRepository` and both implementations (InMemory + Pg):
- `findCustomizationByUserId(userId)` — default zero state for missing rows.
- `grantCustomization(userId, delta)` — atomic upsert of lootbox/key counts.
- `applyLootboxOpen(userId, partId)` — discriminated `{ state } | { reason: 'no_lootbox' } | { reason: 'no_key' }`, lootboxes checked first.
- `setAppearance(userId, appearance)` — persists appearance, upserts on missing row.

Stored rows now carry a `customization` field; existing methods (credit, purchaseUpgrade, touchLastSeen) preserve it.

## Verification
- `npm run lint`: exit 0
- `npm run typecheck --workspace @cubeclicker/backend`: exit 0
- `npm test --workspace @cubeclicker/backend -- economy-repository`: 69 tests passed
- `npm run coverage --workspace @cubeclicker/backend`: exit 0 (thresholds met)