# Build log — T5 — Wire HUD minimize state in App
Task: T5 (2026-10-28)
Files changed: src/frontend/src/App.tsx, src/frontend/src/App.test.tsx, docs/features/modern-visual-overhaul/build-log-T5.md
What changed & why: Added local `hudMinimized` state in `App` and passed `minimized`/`onToggleMinimize` to `Hud` only in the welcomed branch; pre-welcome stats section remains unchanged. Updated App tests to reflect the new toggle button in welcomed markup and added a toggle interaction test.
Decisions: Functional state updater avoids stale closures; initial state false so default markup carries no `data-minimized`.
Evidence:
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm test --workspace @cubeclicker/frontend` → exit 0 (Test Files 40 passed, Tests 880 passed)
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (All files 95.01% stmts / 94.84% branches / 96.42% funcs / 95.01% lines)
Acceptance audit: AC-6 met (welcomed Hud gains minimize toggle wired to local state; pre-welcome section unchanged).
Deviations from spec: none