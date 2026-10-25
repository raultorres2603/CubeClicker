# Build log — T2 — Argon2id password hashing module

Task: T2 (2026-10-25)
Files changed: src/backend/src/auth/password.ts, src/backend/src/auth/password.test.ts, docs/features/user-authentication/build-log-T2.md
What changed & why: Implemented Argon2id password hashing/verification wrapper around `@node-rs/argon2` with OWASP-minimum params (m=19456 KiB, t=2, p=1) sourced from AuthConfig, plus an injectable `PasswordHasher`, param validation, and convenience functions. Verification delegates to the library's constant-time routine; salts are per-hash (distinct digests for identical passwords).
Decisions: Params validated against the same bounds as AuthConfig (19456–1048576 KiB, 2–10 iters, 1–16 parallelism); `validateArgon2Params` returns the validated params; `hashPassword` defaults to OWASP params; `parseOptions` re-exported for needs-rehash checks; no banned matchers (`not.toThrow()` avoided by covering success paths via hashing tests).
Evidence:
- `npm run typecheck --workspace @cubeclicker/backend` → pass (no output)
- `npm run lint` → pass (no output)
- `npm test --workspace @cubeclicker/backend` → 12 files, 277 tests passed
- `npm run coverage --workspace @cubeclicker/backend` → All files 99.02% stmts / 98.03% branch / 100% funcs / 99.02% lines (password.ts 100/100/100/100; thresholds 80 met)
Acceptance audit: AC-11 → met (Argon2id hash/verify with OWASP minimums; password.test.ts round-trip, wrong-password-fails, distinct salts, param validation; config.test.ts pins constants)
Deviations from spec: none