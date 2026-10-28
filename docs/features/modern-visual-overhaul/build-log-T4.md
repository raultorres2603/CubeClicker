# Build log — T4 — HUD minimize props and overlay motion CSS
Task: T4 (2026-10-28)
Files changed: src/frontend/src/ui/Hud.tsx, src/frontend/src/ui/Hud.test.tsx, src/frontend/src/ui/app.css, src/frontend/src/ui/app.css.test.ts, docs/features/modern-visual-overhaul/build-log-T4.md
What changed & why: Added optional `minimized`/`onToggleMinimize` props to `Hud` with conditional `data-minimized` attribute and last-child toggle button; added CSS transitions, scale-on-active, collapse rule, pointer-events auto and reduced-motion override in app.css; updated tests.
Decisions: Conditional spread keeps default markup byte-identical; button rendered empty with aria-label as specified.
Evidence:
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm test --workspace @cubeclicker/frontend` → exit 0 (Test Files 40 passed, Tests 879 passed)
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (All files 95.01% stmts / 94.83% branches / 96.41% funcs / 95.01% lines)
Acceptance audit: AC-6 met (props/markup); AC-7 met (CSS guards); AC-8 met (reduced-motion block + twinkle unaffected).
Deviations from spec: none
