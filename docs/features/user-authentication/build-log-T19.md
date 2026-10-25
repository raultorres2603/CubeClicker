# Build log — T19 — Server startup migrations

Task: T19 (2026-10-25)
Files changed: src/backend/src/server.ts, docs/features/user-authentication/build-log-T19.md
What changed & why: On boot, load `AuthConfig`, create the pg pool, and run pending migrations via `runMigrations(pool)` before building/listening; abort startup (close pool, log, exit 1) on failure. Pass the same pool into `buildApp` so the running app reuses it. Skip migrations when no `DATABASE_URL` is configured (in-memory repos).
Decisions: Migration failure aborts with `process.exit(1)`; pool is shared with `buildApp` via `options.auth.pool`. No changes to coverage exclusions (`server.ts` remains the composition-root exclusion).
Evidence:
- `npm run typecheck --workspace @cubeclicker/backend` → exit 0 ("tsc --noEmit" no errors)
- `npm test --workspace @cubeclicker/backend` → exit 0 (18 test files, 492 tests passed)
- `npm run coverage --workspace @cubeclicker/backend` → exit 0 (All files 94.42% stmts / 84.52% branches / 99.6% funcs / 94.42% lines; thresholds ≥80 met)
- `npm run build --workspace @cubeclicker/backend` → exit 0 ("tsc" no errors)
- `npm run lint` → exit 0 (eslint . no output)
- `npm run smoke` → SMOKE PASS (8/8 checks), including backend health and DB-backed startup
Acceptance audit: AC-30 → met (migrations run before listen; idempotent runner in migrate.ts; failure aborts startup via try/catch + process.exit(1); smoke transcript confirms healthy boot against compose db).
Deviations from spec: none.