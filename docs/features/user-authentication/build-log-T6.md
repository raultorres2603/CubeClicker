# Build log — T6 — Verification-token repository

Task: T6 (2026-10-25)
Files changed: src/backend/src/auth/verification-token-repository.ts, src/backend/src/auth/verification-token-repository.test.ts
What changed & why: Implemented VerificationTokenRepository (InMemory + Pg) with create/findById/findByToken/markUsed/deleteExpired plus plan-level issue/consume/invalidateForUser helpers; tokens hashed at rest (SHA-256); tests cover both impls with concrete values.
Decisions: Supports both raw-token and pre-hashed inputs in findByToken/markUsed for test/service flexibility; token generation uses 32 random bytes (64 hex) per security spec.
Evidence:
- `npm run typecheck --workspace @cubeclicker/backend` → exit 0
- `npm test --workspace @cubeclicker/backend` → 16 files, 417 tests passed
- `npm run coverage --workspace @cubeclicker/backend` → All files 98.25% stmts / 94.68% branches / 100% funcs / 98.25% lines; verification-token-repository.ts 97.30% stmts / 90.52% branches
- `npm run lint` → exit 0
Acceptance audit: AC-5 → met (consume single-use, expiry-checked); AC-6 → met (issue/invalidation supports resend flow).
Deviations from spec: none