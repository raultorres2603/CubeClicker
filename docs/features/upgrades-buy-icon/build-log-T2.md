# Build log — T2 — Update App.test.tsx golden shell string

Task: T2 (2026-11-06)
Files changed: src/frontend/src/App.test.tsx
What changed & why: Replaced each `<button type="button" disabled="">Buy</button>` with `<button type="button" aria-label="Buy" disabled=""></button>` (3 occurrences) in the welcomed-branch golden shell string, matching the icon-only buy button markup from T1. No production code change.
Decisions: Followed the pinned replacement from tasks.md T2 notes; attribute order matches JSX in UpgradesPanel.tsx (aria-label before disabled).

Evidence:
- `npm run lint` → exit 0, no errors
- `npm run typecheck` → exit 0 (backend + frontend tsc --noEmit)
- `npm test --workspace @cubeclicker/frontend` → exit 0, Test Files 47 passed (47), Tests 1196 passed (1196)
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0, All files 94.89% Stmts / 94.89% Branch / 95.65% Funcs / 94.89% Lines (≥ 80% thresholds met)

Acceptance audit: AC-6 → met (lint/typecheck/tests/coverage pass); AC-7 → met (only App.test.tsx touched); AC-9 → met (coverage ≥ 80%).
Deviations from spec: none