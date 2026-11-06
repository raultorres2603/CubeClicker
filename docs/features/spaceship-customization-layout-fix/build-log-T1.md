# Build Log — T1 (spaceship-customization-layout-fix)

## Change

`src/frontend/src/App.tsx`: added `className="customization-toggle"` to the "Spaceship customization" toggle `<button>` rendered when `welcomed`. Button keeps `type="button"` and `aria-expanded={customizationOpen}`. No other markup/state change.

## Verify

### npm run lint
```
> lint
> eslint .
```
Exit code 0 (no output/errors).

### npm run typecheck
```
> typecheck
> npm run typecheck --workspaces --if-present
> typecheck
> tsc --noEmit
> typecheck
> tsc --noEmit
```
Exit code 0.

### npm test
```
Test Files  22 passed (22)   [backend]
Tests  700 passed (700)

Test Files  1 failed | 46 passed (47)   [frontend]
Tests  6 failed | 1186 passed (1192)
```
The 6 failures are all in `src/frontend/src/App.test.tsx` and are solely due to the toggle button now carrying `class="customization-toggle"`; the expected markup strings pin the old `<button type="button" aria-expanded="false">Spaceship customization</button>` form. These expectations are updated in T3 (which owns `App.test.tsx`). No other test files fail. This is an expected, scoped consequence of the T1 change pending the downstream T3 expectation update; not a defect in the change itself.

## Diff stat
```
src/frontend/src/App.tsx | 1 insertion(+)
```

## Commit
Conventional commit: `feat(spaceship-customization-layout-fix): add customization-toggle class to toggle button (T1)`