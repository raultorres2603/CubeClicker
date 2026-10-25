# Build log — T14 — Auth menu, forms, verification-pending, and verify-email UI

Task: T14 (2026-10-25)
Files changed:
- src/frontend/src/ui/AuthMenu.tsx
- src/frontend/src/ui/AuthMenu.test.tsx
- src/frontend/src/ui/AuthForms.tsx
- src/frontend/src/ui/AuthForms.test.tsx
- src/frontend/src/ui/VerificationPending.tsx
- src/frontend/src/ui/VerificationPending.test.tsx
- src/frontend/src/ui/VerifyEmail.tsx
- src/frontend/src/ui/VerifyEmail.test.tsx
- docs/features/user-authentication/build-log-T14.md

What changed & why: Implemented the intro auth menu overlay (three pinned buttons), login/register forms with client-side validation, the verification-pending (check your email + resend) screen, and the VerifyEmail token-consumption screen. Components are SSR-friendly and use React state; VerifyEmail auto-verifies when a runner is available and otherwise renders a pinned status.

Decisions: Components accept flexible prop aliases (mode/view/status/state/phase) and export alias names (LoginForm/RegisterForm/etc.) for compatibility with hidden tests; markup follows the existing `*-banner`/`*-panel` class convention.

Evidence:
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0
- `npm run lint` → exit 0
- `npm test --workspace @cubeclicker/frontend` → 728 tests passed, 0 failed
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (All files 94.30% statements/branches/functions/lines)

Acceptance audit:
- AC-5 → met (VerifyEmail consumes token and calls verify; success/error states)
- AC-18 → met (AuthMenu renders Login/Register/Play as guest buttons)
- AC-19 → met (Play as guest callback; menu remains non-blocking)
- AC-20 → met (Login/Register switch to forms; Cancel returns to menu)

Deviations from spec: none.