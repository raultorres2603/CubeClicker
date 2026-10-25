# Build log — T1 — Backend dependency & config scaffolding

Task: T1 (2026-10-25)
Files changed: src/backend/package.json, src/backend/src/auth/config.ts, src/backend/src/auth/config.test.ts, docs/features/user-authentication/build-log-T1.md
What changed & why: Added approved dependencies (@fastify/cookie, @node-rs/argon2, pg, nodemailer, types) to backend package.json. Created separate AuthConfig with env parsing/validation (DATABASE_URL, SMTP_*, APP_BASE_URL, ALLOWED_ORIGIN, SESSION_COOKIE_SECURE, SESSION_TTL_DAYS, Argon2 params, verification-token TTL) and comprehensive tests. GameConfig untouched (F27).
Decisions: Flat AuthConfig shape mirroring GameConfig; OWASP-minimum Argon2 defaults (m=19456 KiB, t=2, p=1); SMTP defaults point at Mailpit (host mailpit, port 1025); DATABASE_URL empty/unset => null (in-memory repos); empty optional SMTP credentials => null.
Evidence:
- `npm run typecheck --workspace @cubeclicker/backend` → pass (no output)
- `npm test --workspace @cubeclicker/backend` → 8 files, 233 tests passed
- `npm run coverage --workspace @cubeclicker/backend` → All files 98.84% stmts / 97.64% branch / 100% funcs / 98.84% lines (thresholds 80 met)
- `npm run lint` → pass (no output)
Acceptance audit: AC-11 → met (config exports OWASP-minimum Argon2 params with bounds; config.test.ts); AC-29 → met (secrets read from env only; no .env* touched)
Deviations from spec: none