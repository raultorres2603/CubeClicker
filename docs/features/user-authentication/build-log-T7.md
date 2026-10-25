# Build log — T7 — Email service (interface + SMTP + fake)

Task: T7 (2026-10-25)
Files changed: src/backend/src/auth/email.ts, src/backend/src/auth/email.test.ts, docs/features/user-authentication/build-log-T7.md
What changed & why: Added pluggable `EmailService` interface, `SmtpEmailService` (nodemailer) with a shared verification-email template (subject + text + HTML carrying the activation link), and `FakeEmailService` for in-memory capture. Tests cover template rendering (exact text/HTML, HTML escaping), fake capture (empty initial, single, multiple in order), SMTP `sendMail` invocation with concrete expected options, transport-failure propagation, and constructor branches (auth/no-auth, secure derivation).
Decisions: `sendVerification(to, verificationUrl)` signature; caller (future AuthService) builds the activation URL from `AuthConfig.appBaseUrl`. Subject pinned to 'Verify your CubeClicker email'. Transport is injectable for tests; defaults to `nodemailer.createTransport`.
Evidence:
- `npm run typecheck --workspace @cubeclicker/backend` → pass (no output)
- `npm test --workspace @cubeclicker/backend` → 12 files, 282 tests passed
- `npm run coverage --workspace @cubeclicker/backend` → All files 99.02% stmts / 98.03% branch / 100% funcs / 99.02% lines; src/auth/email.ts 100% / 100% / 100% / 100%
- `npm run lint` → pass (no output)
Acceptance audit: AC-6 → met (FakeEmailService captures recipient + URL; SmtpEmailService sends rendered template containing the link; exact assertions in email.test.ts)
Deviations from spec: none
