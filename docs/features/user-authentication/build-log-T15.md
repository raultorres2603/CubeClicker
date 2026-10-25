# Build log — T15 — App.tsx intro-menu and verify handling integration

Task: T15 (2026-10-25)
Files changed:
- src/frontend/src/App.tsx
- src/frontend/src/App.test.tsx
- docs/features/user-authentication/build-log-T15.md

What changed & why: Integrated AuthMenu into the game shell (rendered until an auth choice is made, so the intro cinematic keeps running behind it), added verify-email route handling that renders VerifyEmail (token resolved from props/window/query), and preserved the existing shell markup for chosen/guest states. App now accepts flexible auth/verify props for SSR tests.

Decisions: Menu visibility is choice-based (not phase-gated) per AC-19 so intro skip does not dismiss it; guest/hasChosen props hide it. Verify token resolution supports multiple prop aliases and window location for browser use.

Evidence:
- npm run typecheck --workspace @cubeclicker/frontend -> exit 0
- npm run lint -> exit 0
- npm test --workspace @cubeclicker/frontend -> 728 tests passed, 0 failed
- npm run coverage --workspace @cubeclicker/frontend -> All files 94.21% statements/branches/functions/lines (thresholds >= 80 met)

Acceptance audit:
- AC-5 -> met (VerifyEmail rendered for verify route/token)
- AC-18 -> met (AuthMenu renders Login/Register/Play as guest during entry)
- AC-19 -> met (Play as guest dismisses menu; skip does not dismiss)
- AC-20 -> met (AuthMenu handles Login/Register forms and cancel internally)

Deviations from spec: none.
