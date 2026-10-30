# Build log — T1 (Migration & schema for idle accrual)

## Files changed
- `src/backend/src/db/migrations/004_idle_accrual.sql` (new)
- `src/backend/src/db/schema.sql` (edit — mirror `last_seen_at` column)

## Verification
- `npm run typecheck` — exit 0
- `npm run test --workspace=src/backend` — 21 files, 584 tests passed (migrate.test.ts 10 tests)
- `npm run coverage --workspace=src/backend` — exit 0; All files 94.83% stmts / 85.99% branches / 99.29% funcs / 94.83% lines

## Notes
- Uses statement-level timestamp approach (F10): column added nullable, `UPDATE user_economy SET last_seen_at = now() WHERE last_seen_at IS NULL`, then `SET NOT NULL` + `DEFAULT now()`.
- `schema.sql` mirrors final column: `last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
- No compose/Dockerfile changes (AC-17). No TS changes.