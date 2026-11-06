# Build log — T2 — Add `.upgrades-panel` bottom-right positioning rule to app.css

Task: T2 (2026-11-06)
Files changed: src/frontend/src/ui/app.css
What changed & why: Appended a new `.upgrades-panel` rule at the end of the stylesheet declaring `position: absolute; top: auto; bottom: calc(1rem + env(safe-area-inset-bottom, 0px)); left: auto; right: calc(1rem + env(safe-area-inset-right, 0px));` per plan. The class selector (specificity 0,1,0) overrides `main > section` (0,0,2) without `!important`; the panel keeps its metallic frame styling as a direct child of `<main>`. No pre-existing `.upgrades-panel` rule existed, so no merge was required.

Decisions: Appended at end of stylesheet; used safe-area inset convention matching `main > section` / `.user-panel`; `1rem` bottom/right offsets per plan.

Evidence:
- `npm run lint` → exit code 0 (no errors).
- `npm run typecheck` → exit code 0 (backend + frontend `tsc --noEmit`).
- `npm test` → backend: Test Files 22 passed, Tests 700 passed. frontend: Test Files 1 failed | 46 passed (47); Tests 6 failed | 1188 passed (1194). The 6 failures are all in `src/frontend/src/App.test.tsx` and are solely due to the section now carrying `class="upgrades-panel"` (T1); the expected markup strings pin the old `<section aria-label="Upgrades" data-mode="...">` form. These expectations are updated in T3 (which owns `App.test.tsx`). No other test files fail. This is an expected, scoped consequence pending the downstream T3 expectation update; not a defect in this change. My CSS-only change introduces no new failures.
- `npm run coverage` not required by T2 verify; deferred to T3/T4.

Acceptance audit: AC-1 → met (rule declares position: absolute, bottom/top/left/right per spec). AC-3 → met (uses `env(safe-area-inset-bottom, 0px)` and `env(safe-area-inset-right, 0px)`).

Deviations from spec: none.