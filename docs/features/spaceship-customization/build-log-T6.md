# Build log — T6 (Frontend parts catalog + params helper)

## Files
- src/frontend/src/game/parts.ts (new)
- src/frontend/src/game/parts.test.ts (new)

## Verify commands

### npm run lint
```
> lint
> eslint .
```
(exit 0)

### npm run typecheck --workspace @cubeclicker/frontend
```
> typecheck
> tsc --noEmit
```
(exit 0)

### npm test --workspace @cubeclicker/frontend -- parts
```
 RUN  v3.2.7 .../src/frontend

 ✓ src/game/parts.test.ts (23 tests) 7ms

 Test Files  1 passed (1)
      Tests  23 passed (23)
```
(exit 0)

### npm run coverage --workspace @cubeclicker/frontend
```
 Test Files  45 passed (45)
      Tests  1122 passed (1122)
All files          |   95.27 |    95.15 |   96.96 |   95.27 |
```
(exit 0)

## Notes
- parts.ts mirrors backend catalog (12 parts, 5 categories).
- Implemented isValidPartId, partCategory (throws), randomPartId (rng/seed/none), appearanceToSpaceshipParams.
- Pure, no DOM.
- Seeded LCG helper exported for engine/guest usage.