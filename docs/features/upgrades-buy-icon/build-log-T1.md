# Build Log — upgrades-buy-icon / T1

## Summary
Made the upgrades panel buy button icon-only with an accessible name. Removed the "Buy" text child and added `aria-label="Buy"`. Updated `UpgradesPanel.test.tsx` assertions to the new disabled/enabled markup forms.

## Files changed
- src/frontend/src/ui/UpgradesPanel.tsx
- src/frontend/src/ui/UpgradesPanel.test.tsx

## Verification
### npm run lint
```
> eslint .
```
(exit 0, no errors)

### npm run typecheck
```
> tsc --noEmit (backend + frontend)
```
(exit 0)

### npm test (targeted: UpgradesPanel)
```
✓ src/ui/UpgradesPanel.test.tsx (9 tests)
Test Files  1 passed (1)
Tests  9 passed (9)
```

### Full npm test
App.test.tsx golden-string failures (6) are expected and owned by T2 (out of this task's files_owned); they will be resolved when T2 updates the golden shell string. UpgradesPanel.test.tsx passes.

### npm run coverage (targeted: UpgradesPanel.test.tsx)
UpgradesPanel.tsx: statements 91.83%, branches 100%, functions 50%, lines 91.83%. No coverage exclusions added.

## Commit
feat(upgrades-buy-icon): make buy button icon-only with accessible name (T1)
