# Build log — T12 (App wiring: panel + menu toggle)

## Files written
- src/frontend/src/App.tsx
- src/frontend/src/App.test.tsx

## Verification evidence

### npm run lint
```
> lint
> eslint .
```
Exit 0.

### npm run typecheck --workspace @cubeclicker/frontend
```
> typecheck
> tsc --noEmit
```
Exit 0.

### npm test --workspace @cubeclicker/frontend -- App
```
 RUN  v3.2.7
 ✓ src/ui/app.css.test.ts (78 tests)
 ✓ src/App.test.tsx (23 tests)
 Test Files  2 passed (2)
      Tests  101 passed (101)
```
Exit 0.

### npm run coverage --workspace @cubeclicker/frontend
```
All files          |   94.89 |   94.89 |   95.65 |   94.89 |
```
Exit 0 (thresholds met).

## Notes
- Added `SpaceshipCustomizationPanel` import and a `customizationOpen` toggle state (supports prop aliases for SSR).
- Rendered a toggle button when welcomed, plus the panel (with session customization state and `openLootbox`/`equipPart` handlers) when open.
- Updated `App.test.tsx` shell markup expectations to include the toggle button.