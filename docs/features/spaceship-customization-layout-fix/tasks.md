# Tasks — Spaceship Customization Layout Fix

Dependency overview: T1 → T2 → T3 → T4

## T1 — Add `customization-toggle` class to the toggle button `[seq]`
depends_on: —
files_owned: src/frontend/src/App.tsx
verify: `npm run lint`, `npm run typecheck`, `npm run test`
acceptance: AC-2
status: [x]

## T2 — Merge bottom-left positioning into `.customization-panel` and add `.customization-toggle` rule `[seq]`
depends_on: T1
files_owned: src/frontend/src/ui/app.css
verify: `npm run lint`, `npm run typecheck`, `npm run test`
acceptance: AC-1, AC-3, AC-4
status: [x]

## T3 — Update test expectations and add CSS-guard assertions `[seq]`
depends_on: T2
files_owned: src/frontend/src/App.test.tsx, src/frontend/src/ui/app.css.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run coverage` (frontend workspace pre-gate acceptable)
acceptance: AC-1, AC-2, AC-5
status: [x]

## T4 — Verify & integrate `[seq]`
depends_on: T3
files_owned: (none — verification only)
verify: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run coverage`, `npm run build`
acceptance: AC-5, AC-6
status: [x]