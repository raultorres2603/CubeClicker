# Build log — minor-backlog — F2/F4/F7

Task: minor-backlog (corrective round 3) (2026-10-26)
Files changed:
- src/frontend/src/ui/VerifyEmail.tsx
- src/frontend/src/ui/VerifyEmail.test.tsx
- src/frontend/src/ui/AuthMenu.tsx
- src/frontend/src/ui/app.css
- README.md
- docs/features/user-authentication/build-log-minor-backlog.md

What changed & why:
- VerifyEmail now hydrates the client store after a successful verification (bootstrap -> me -> refresh), keeping verification success even if bootstrap fails and retaining the "Continue to login" fallback.
- AuthMenu shows "Press any key to skip the intro" and app.css documents the full-viewport backdrop trade-off (keyboard skip remains available).
- README documents BACKEND_URL, changeOrigin: false, and CSRF origin matching for the Vite dev proxy.

Decisions:
- Bootstrap method resolution priority: bootstrap, then me, then refresh (first available).
- Backdrop retained to block pre-choice gameplay input (F4).
- F6 left open: focused tests added only for VerifyEmail; no further UI coverage chase.

Evidence:
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0 (backend + frontend)
- `npm test` → exit 0 (backend 18 files / 492 tests; frontend 34 files / 758 tests)
- `npm run coverage` → exit 0 (backend 94.66/84.32/99.60/94.66; frontend 93.96/93.32/96.21/93.96; thresholds 80/80/80/80 intact)
- `npm run build` → exit 0 (frontend dist 820.92 kB)

Acceptance audit:
- F2 → met: VerifyEmail calls store bootstrap on success and shows error on failure; tests added.
- F4 → met: hint text added; backdrop retained; decision documented in app.css comment.
- F7 → met: README dev-proxy section added.
- F6 → open (optional, not pursued beyond VerifyEmail).

Deviations from spec: none.