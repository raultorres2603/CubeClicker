# Build log — fix-menu — user-authentication corrective (login menu visibility)

Task: fix-menu (2026-10-25)
Files changed:
- src/frontend/src/ui/app.css
- src/frontend/src/App.test.tsx

What changed & why: Added overlay CSS for `.auth-menu` (and `.auth-forms`) so the intro auth menu sits above the full-screen canvas, is centered, has a high z-index, and captures pointer events, preventing gameplay input before a choice while the intro cinematic keeps animating behind it. Added an App.test.tsx assertion that the menu (Login/Register/Play as guest) renders before a choice while the canvas still renders.

Decisions:
- CSS-only fix; no markup change, preserving existing AuthMenu/App test expectations.
- `.auth-menu` doubles as its own full-viewport backdrop (semi-transparent) to block canvas interaction.

Evidence:
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0 (backend + frontend tsc --noEmit)
- `npm test` → exit 0 (backend 18 files / 492 tests; frontend 34 files / 729 tests)
- `npm run coverage` → exit 0 (backend 94.66/84.32/99.60/94.66; frontend 92.88/92.92/92.91/92.88)
- `npm run build` → exit 0 (frontend dist 807.52 kB)

Acceptance audit:
- AC-18 → met: menu renders three buttons before a choice; canvas renders behind overlay.
- Gameplay input blocked until choice → met via full-viewport backdrop with pointer-events auto over canvas.

Deviations from spec: none.