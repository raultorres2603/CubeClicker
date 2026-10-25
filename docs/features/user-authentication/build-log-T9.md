# Build log — T9 — Auth service (orchestration)

Task: T9 (2026-10-25)
Files changed: src/backend/src/auth/auth-service.ts, src/backend/src/auth/auth-service.test.ts
What changed & why: Implemented AuthService orchestrating register/login/verifyEmail/resendVerification/logout/getSession over injected repos, email, password hasher, rate limiter, and clock. Includes password policy, uniqueness, lockout, single active session, verification token consumption, and resend rate limiting. Added tests (467 passing) with concrete values for all paths and error cases.
Decisions: Method names per task brief; flexible input shapes and aliases for compatibility with future T10/T11 callers; error classes carry status/statusCode/retryAfter. Integration boundary is exercised via in-memory repos (pure orchestration); route-level integration lands in T10. Password reset is a non-goal (not implemented).
Evidence:
- `npm run typecheck --workspace @cubeclicker/backend` → exit 0 (no output)
- `npm test --workspace @cubeclicker/backend` → 17 test files, 467 tests passed, 0 failed
- `npm run coverage --workspace @cubeclicker/backend` → All files 98.53% stmts / 92.57% branches / 100% funcs / 98.53% lines (auth-service.ts 100% stmts / 80.4% branches)
- `npm run lint` → exit 0 (no errors)
Acceptance audit: AC-1 → met (unverified account, hashed password verifies, email sent); AC-2 → met (duplicate username/email → DuplicateAccountError 409, no email); AC-3 → met (11/12/128/129 boundaries); AC-5 → met (valid token verifies + session; reused/expired/unknown → InvalidTokenError); AC-6 → met (one email on register; resend invalidates prior + new email; 3/hour rate limit); AC-7/AC-8 → met (login, invalid creds 401, lockout after 5, retryAfter); AC-9/AC-10 → met (logout revokes, getSession); AC-12 → met (no secrets in service return values); AC-33 → met (login revokes prior sessions).
Deviations from spec: none.
