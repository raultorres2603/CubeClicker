# Build log — T1 — Futuristic blue technologic HUD CSS + guards

Task: T1 (2026-10-28)
Files changed: src/frontend/src/ui/app.css, src/frontend/src/ui/app.css.test.ts
What changed & why: Restyled the HUD panel with glassmorphism/overflow-hidden frame, visible minimize button with glyph + focus ring, dimmed minimized state, scanline on ::after, retained border light on ::before (inset 0), reduced-motion + responsive guards; added grep guards.
Decisions: CSS-only; kept theme constants and markup unchanged; scanline 4000ms; border-light stays on ::before.

Evidence:
- `npm run lint` → exit 0 (no output)
- `npm run typecheck` → exit 0 (all workspaces)
- `npm test --workspace @cubeclicker/frontend` → exit 0, 41 test files, 936 tests passed
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0, thresholds met (>=80% all metrics)

Acceptance audit:
- AC-2 → met (base rule contains position: absolute, backdrop-filter blur, box-shadow rgba(124,246,255), border rgba(124,246,255), overflow: hidden; pseudo-elements pointer-events: none)
- AC-3 → met (button rule pointer-events: auto, cursor: pointer, min-width/min-height 1.5rem; button::before content:)
- AC-4 → met (button:focus-visible outline: 2px solid var(--accent))
- AC-5 → met (exact minimized rule opacity; adjacent p rule max-height 0/opacity 0/overflow hidden)
- AC-6 → met (@keyframes hud-scanline applied to ::after only, 4000ms, ::after content/position absolute/pointer-events none)
- AC-7 → met (reduced-motion block contains ::after and disables animation/transition for required selectors)
- AC-8 → met (border-light-travel retained on ::before and .user-panel; ::before inset: 0; pointer-events none)
- AC-9 → met (hud-blink retained, <=300ms)
- AC-11 → met (existing 480px block gains main > section padding/font-size; only one 480px block)

Deviations from spec: none