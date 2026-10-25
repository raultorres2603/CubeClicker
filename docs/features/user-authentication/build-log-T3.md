# Build log — T3 — DB pool, migrations, and schema

Task: T3 (2026-10-25)
Files changed: src/backend/src/db/pool.ts, src/backend/src/db/pool.test.ts, src/backend/src/db/migrate.ts, src/backend/src/db/migrate.test.ts, src/backend/src/db/schema.sql, src/backend/src/db/migrations/001_init.sql, docs/features/user-authentication/build-log-T3.md

What changed & why:
- `pool.ts`: config-driven `pg.Pool` factory. `createPool` accepts a connection string, an `{ databaseUrl }` config-like object, or null/undefined/empty and returns `null` in the no-URL case (so the composition root can fall back to in-memory repos). Pool tuning options are forwarded. `closePool` shuts down best-effort.
- `migrate.ts`: in-repo numbered SQL migration runner. `loadMigrations` reads/sorts `.sql` files from `db/migrations`. `runMigrations` creates `schema_migrations`, skips already-applied files, wraps each migration in BEGIN/COMMIT with ROLLBACK on failure, records the name, and rethrows on error (idempotent; failure aborts). DB access goes through the `MigrationDb` interface so `pg.Pool` qualifies and tests use a fake.
- `schema.sql` / `migrations/001_init.sql`: Postgres 16 DDL for `users`, `sessions`, `verification_tokens`, `schema_migrations`. Username/email uniqueness is enforced only by functional unique indexes `users_username_lower_uq (lower(username))` and `users_email_lower_uq (lower(email))` (no raw UNIQUE on those columns) (F18). Token hashes retain their own UNIQUE constraint for lookup integrity.

Decisions: in-repo runner (no new dependency) per Q-6 proposed default; migration SQL executed as a single multi-statement query per file; `schema.sql` and `001_init.sql` kept identical.

Evidence:
- `npm run typecheck --workspace @cubeclicker/backend` → pass (no output)
- `npm test --workspace @cubeclicker/backend` → 12 files, 282 tests passed
- `npm run coverage --workspace @cubeclicker/backend` → All files 99.02% stmts / 98.03% branch / 100% funcs / 99.02% lines (thresholds 80 met); src/db 100% across all four metrics
- `npm run lint` → pass (no output)

Acceptance audit:
- AC-13 → met (runner/repos use parameterized statements where values are bound; no user input interpolated; migration runner uses `$1` for the recorded name)
- AC-30 → met (`runMigrations` applies pending SQL, is idempotent, rolls back and rethrows on failure; covered by migrate.test.ts)

Deviations from spec: none