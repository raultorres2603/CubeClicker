# Build Log — T4: User repository

## Files created
- `src/backend/src/auth/user-repository.ts`
- `src/backend/src/auth/user-repository.test.ts`

## Summary
- Defined `UserRepository` interface: `create`, `findById`, `findByUsername`, `findByEmail`, `setVerified`/`updateVerification`, `updatePasswordHash`, `recordFailedLogin`, `resetFailedLogin`.
- `InMemoryUserRepository` and `PgUserRepository` implementations.
- Case-insensitive username/email lookup (in-memory via `toLowerCase`, Postgres via `lower(...)`).
- `DuplicateUserError` thrown on unique violations (Pg maps `23505`).
- All SQL uses bound parameters (AC-13).

## Verify evidence
- `npm run typecheck --workspace @cubeclicker/backend` — exit 0 (no output).
- `npm test --workspace @cubeclicker/backend` — 14 test files, 330 tests passed.
- `npm run coverage --workspace @cubeclicker/backend` — exit 0; All files 98.5% stmts / 96.16% branches / 100% funcs / 98.5% lines; user-repository.ts 97.61% stmts / 91.35% branches.
- `npm run lint` — exit 0 (no errors).

## Notes
- Lockout threshold (5 attempts / 15 min) and `recordFailedLogin`/`resetFailedLogin` included per plan interface to support T9 (auth service) which cannot edit this file. `setVerified` and `updateVerification` are aliases for naming compatibility with both plan and task brief.
- Repositories accept an injectable clock (`now`) for deterministic lockout tests.
