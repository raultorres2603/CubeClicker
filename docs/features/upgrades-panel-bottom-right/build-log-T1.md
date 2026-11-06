# Build log — T1 — Add `upgrades-panel` class to the UpgradesPanel root section

Task: T1 (2026-11-06)
Files changed: src/frontend/src/ui/UpgradesPanel.tsx
What changed & why: Added `className="upgrades-panel"` to the root `<section>` (between `aria-label="Upgrades"` and `data-mode={mode}`), mirroring the `customization-panel` ownership pattern. No other markup/state change.
Decisions: Component-owned class hook; panel remains a direct child of `<main>` to keep metallic frame styling.

Evidence:
- `npm run lint` → exit code 0 (no errors).
- `npm run typecheck` → exit code 0 (backend + frontend `tsc --noEmit`).
- `npm test` → backend: Test Files 22 passed, Tests 700 passed. frontend: Test Files 1 failed | 46 passed (47); Tests 6 failed | 1188 passed (1194). The 6 failures are all in `src/frontend/src/App.test.tsx` and are solely due to the section now carrying `class="upgrades-panel"`; the expected markup strings pin the old `<section aria-label="Upgrades" data-mode="...">` form. These expectations are updated in T3 (which owns `App.test.tsx`). No other test files fail. This is an expected, scoped consequence of the T1 change pending the downstream T3 expectation update; not a defect in the change itself.
- `npm run coverage` not required by T1 verify; deferred to T3/T4.

Acceptance audit: AC-2 → met (class hook added to root section, attribute order matches plan).

Deviations from spec: none.