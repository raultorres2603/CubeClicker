# Build log — T3 — App HUD blink wiring on click increase
Task: T3 (2026-10-28)
Files changed: src/frontend/src/App.tsx, src/frontend/src/App.test.tsx
What changed & why: Added `hudBlinking` state, a `useRef` tracking previous `snapshot.stats.clicks`, and a `useEffect` keyed on clicks and reduced motion that arms a single `setTimeout(..., HUD_BLINK_MS)` (clearing any prior timer) on click increase, skipping entirely under reduced motion; wired `blinking={hudBlinking}` to the welcomed `Hud`. Added blink wiring tests.
Decisions: Timer stored in a ref and cleared both manually on re-arm and in effect cleanup; `prevClicksRef` initialized to null so the initial mount never blinks.
Evidence:
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm test --workspace @cubeclicker/frontend` → 913 tests passed (41 files)
- `npm run coverage --workspace @cubeclicker/frontend` → All files 95.04% stmts / 94.84% branches / 96.46% funcs / 95.04% lines (exit 0)
- `npm run coverage` → both workspaces ≥ 80% (exit 0)
- `npm run build` → exit 0
Acceptance audit: AC-5 → met (blink on click increase, timer clears); AC-6 → met (reduced motion suppresses blink)
Deviations from spec: none