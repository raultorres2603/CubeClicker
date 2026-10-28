# Build log — T1 — Animated border light + HUD blink CSS + reduced motion

Task: T1 (2026-10-28)
Files changed: src/frontend/src/ui/app.css, src/frontend/src/ui/app.css.test.ts
What changed & why: Added `@keyframes border-light-travel` and `@keyframes hud-blink`; applied border light to `main > section::before` and `.user-panel::before` with `animation: border-light-travel 3000ms linear infinite`; applied blink to `main > section[data-blinking="true"]` with `animation: hud-blink 200ms ease`; extended the existing `prefers-reduced-motion: reduce` block to disable animations for the HUD boxes, their pseudo-elements, and the blink selector.
Decisions: Used conic-gradient pseudo-elements for the travelling border light; kept the existing reduced-motion media block and added selectors to it (AC-2/AC-4).
Evidence:
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm test --workspace @cubeclicker/frontend` → 40 test files, 896 tests passed
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds met)
Acceptance audit: AC-1 → met (app.css.test.ts regex guards); AC-2 → met; AC-4 → met.
Deviations from spec: none