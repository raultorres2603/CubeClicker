# Build log — T2 — Hud `blinking` prop + `HUD_BLINK_MS` export

Task: T2 (2026-10-28)
Files changed: src/frontend/src/ui/Hud.tsx, src/frontend/src/ui/Hud.test.tsx
What changed & why: Added optional `blinking?: boolean` prop to `Hud` rendering `data-blinking="true"` only when true; exported `HUD_BLINK_MS = 200` for App wiring (T3). Default markup unchanged when omitted.
Decisions: blinking spread placed after minimized spread; const exported as named export.
Evidence:
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0
- `npm test --workspace @cubeclicker/frontend` → 40 files, 888 tests passed
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0; All files 95.03% stmts / 94.85% branches / 96.42% funcs / 95.03% lines
Acceptance audit: AC-3 → met (Hud.test.tsx blinking prop + data-blinking assertions); HUD_BLINK_MS === 200 met (export test).
Deviations from spec: none