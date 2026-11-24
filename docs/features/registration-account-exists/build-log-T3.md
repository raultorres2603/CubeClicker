# Build log — T3 — Resumable registration, resend invalidation, field conflicts and email login

Task: T3 (2026-11-24)
Files changed: `src/backend/src/auth/auth-service.ts`, `src/backend/src/auth/auth-service.test.ts`, `docs/features/registration-account-exists/build-log-T3.md`

## What changed & why
- `register` now follows the plan's registration decision table in one pass: lookup by username and email; resume only when both match one unverified row and the stored hash verifies the submitted password; otherwise throw a field-specific `DuplicateAccountError`.
- Resume is rate-limited at `account:<id>:register-resume` (3 per hour), retires every prior token, issues exactly one fresh token, sends the email and returns `{ ..., resumed: true }`; a new registration never sets `resumed`.
- `DuplicateAccountError` now carries `field: 'username' | 'email' | 'both'` and canonical `fields: ['username'] | ['email'] | ['username','email']`; `unknown` and absent input fall back to `both` so no conflict can omit `fields`.
- A `users.create` `DuplicateUserError('unknown')` re-queries both identifiers once and maps the rows actually found (both null → `both`); known `username`/`email` fields are emitted directly without a re-query.
- One shared send helper wraps **create, resume and resend**: a rejection retires the user's tokens (best-effort; the original delivery error is rethrown) so an undelivered token never survives.
- Login resolves identifiers containing `@` by `findByEmail` and all others by `findByUsername`; the generic 401, failed-attempt counter and lockout path are unchanged, and there is no cross-fallback.

## Decisions
- Canonical ordering lives in `resolveAccountFields`, so callers may pass an array in any order and the service still emits `['username','email']` for two fields; dedupe is implicit via the ordered membership checks.
- The race branch keeps the structural `name === 'DuplicateUserError'` detection used by the pre-existing code, then reads its `field`; this preserves compatibility with repository instances from either module copy.
- `sendVerificationEmail` swallows only an invalidation failure (best-effort) and always rethrows the send error, matching the plan's D-5/AC-3(c) contract.
- Resume constants (`RESUME_RATE_LIMIT`, `RESUME_RATE_WINDOW_MS`) are named module constants next to `buildDuplicateError`, not magic numbers in the method.
- Test fixtures are synthetic. Failed sends are driven by the local `RejectingEmailService` (extended with `failNextSend()`); raw tokens are captured by awaiting `vi.spyOn(tokens, 'issue').mock.results[0].value`, then `consume(token)` proves invalidation.

## Evidence

### Full T3 verify block (verbatim)
```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend
npm run coverage --workspace @cubeclicker/backend
test -f docs/features/registration-account-exists/build-log-T3.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/registration-account-exists/build-log-T3.md
echo "T3 VERIFY BLOCK: ALL COMMANDS EXITED 0"
```
Final marker printed:
```
T3 VERIFY BLOCK: ALL COMMANDS EXITED 0
```
`test -f` and the credential `! grep` produce no output on success; a match would have aborted the script before the marker.

Re-run after the final build-log edit (same verbatim block):
```
 Test Files  52 passed (52)
      Tests  1985 passed (1985)
All files          |    96.9 |    91.66 |   99.64 |    96.9 |
  auth-service.ts  |     100 |    87.69 |     100 |     100 |
T3 VERIFY BLOCK: ALL COMMANDS EXITED 0 (final)
```

### `npm run lint`
```
$ npm run lint

> lint
> eslint .

exit 0 (no findings)
```

### `npm run typecheck --workspace @cubeclicker/backend`
```
$ npm run typecheck --workspace @cubeclicker/backend

> typecheck
> tsc --noEmit

exit 0 (no diagnostics)
```

### `npm test --workspace @cubeclicker/backend`
```
$ npm test --workspace @cubeclicker/backend

> test
> vitest run

 Test Files  52 passed (52)
      Tests  1985 passed (1985)
   Start at  19:02:38
   Duration  4.25s (transform 5.10s, setup 0ms, collect 16.17s, tests 26.91s, environment 9ms, prepare 4.48s)

exit 0
```

### `npm run coverage --workspace @cubeclicker/backend`
```
$ npm run coverage --workspace @cubeclicker/backend

> coverage
> vitest run --coverage

 Test Files  52 passed (52)
      Tests  1985 passed (1985)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |    96.9 |    91.66 |   99.64 |    96.9 |
 src/auth          |   96.39 |    85.21 |     100 |   96.39 |
  auth-service.ts  |     100 |    87.69 |     100 |     100 | ...29,534,551,636
-------------------|---------|----------|---------|---------|-------------------

exit 0 — aggregate pass: 96.9 statements / 91.66 branches / 99.64 functions / 96.9 lines, all ≥ 80.
```
`auth-service.ts` is 100% statements/functions/lines; the uncovered branches are the pre-existing login/verify/session optional-value branches (529, 534, 551, 636), not the new registration, resume, race or login-resolution paths.

### Focused T3 suite (new cases)
```
$ npx --no-install vitest run src/auth/auth-service.test.ts --reporter=verbose

 ✓ AuthService registration decision table (AC-4) > resumes one unverified row, rotates the token and omits resumed on a new registration
 ✓ AuthService registration decision table (AC-4) > rejects a wrong password on the same row with both ordered fields and no send or token
 ✓ AuthService registration decision table (AC-4) > rejects an already-verified same-pair row with both fields and no resume
 ✓ AuthService registration decision table (AC-4) > limits resume to three per hour per account and opens a new window after one hour
 ✓ AuthService registration decision table (AC-4) > reports both ordered fields when username and email belong to different rows (U1/U2)
 ✓ DuplicateAccountError field contract (AC-5) > canonicalizes arrays and never omits fields
 ✓ AuthService duplicate race re-query (AC-5(f)) > re-queries both identifiers on an unknown duplicate and reports the raced username
 ✓ AuthService duplicate race re-query (AC-5(f)) > falls back to both fields when the unknown-duplicate re-query finds nothing
 ✓ AuthService failed-send token invalidation (AC-3(c)) > invalidates the create-issued token when the send rejects
 ✓ AuthService failed-send token invalidation (AC-3(c)) > invalidates the resume-issued token when the resume send rejects
 ✓ AuthService failed-send token invalidation (AC-3(c)) > invalidates the resend-issued token when the resend send rejects
 ✓ AuthService failed-send token invalidation (AC-3(c)) > still surfaces the delivery failure when best-effort invalidation rejects
 ✓ AuthService email identifier login (AC-6) > logs in by a mixed-case email identifier and issues one session
 ✓ AuthService email identifier login (AC-6) > accepts the identifier alias and prefers username when both are present
 ✓ AuthService email identifier login (AC-6) > returns the generic 401 for an unknown email and only queries by email
 ✓ AuthService email identifier login (AC-6) > never falls back to a username lookup when the identifier contains @
 ✓ AuthService email identifier login (AC-6) > increments the failure counter for a wrong password on an email identifier
 ✓ AuthService email identifier login (AC-6) > locks after five failed email logins and returns Retry-After on a locked email login

 Test Files  1 passed (1)
      Tests  73 passed (73)
```

## Acceptance audit
- AC-3(c) → met at the service layer: create, resume and resend each wrap the send; on rejection the token returned by the awaited `issue` spy consumes to `null`, `invalidateForUser(user.id)` is asserted with the exact account id, and the original delivery error is rethrown. The best-effort invalidation branch is covered (a throwing `invalidateForUser` still surfaces the send error).
- AC-4 → met: resume on one unverified same-pair row verifies the password, creates no row (create spy), retires the prior token (original `consume` → null), issues exactly one fresh token (`issue` called with the exact user id/TTL/clock), sends exactly one email to the stored address and returns `resumed: true`; a new registration omits the property. Wrong password, verified row and a row/identifier mismatch return `DuplicateAccountError` with `both`. The 3/hour per-account limiter returns `RateLimitError` (429/`rate_limited`) on the fourth resume with no email, and a new window admits again after one hour.
- AC-5 → met: username-only → `field: 'username'`, `fields: ['username']`; email-only → `field: 'email'`, `fields: ['email']`; different rows and verified same-pair → `field: 'both'`, `fields: ['username','email']`; all preserve the generic `account already exists` message and 409/`duplicate_account`. The unknown race re-queries both identifiers exactly once (two calls each including the pre-check) and emits the raced username; the both-null fallback emits `both`.
- AC-6 → met: mixed-case email login returns the stored user and one session; `identifier` works and `username` wins when both are supplied; unknown email returns the exact generic 401 (`invalid credentials`/`invalid_credentials`); a wrong email password increments the counter; five failures lock and the locked email login returns 429 with `retryAfter: 900`; an identifier containing `@` never calls `findByUsername`.
- Testing bar → met: all new/changed assertions use concrete values (`toEqual`, exact strings/status/codes, exact spy arguments/order); no wildcard matcher, snapshot, tautology or assertion-free test. Unit tier: `auth-service.test.ts` with in-memory repositories, injected clock/hasher/limiter/email. Integration-boundary exception: the HTTP clauses (502 mapping, `resumed` serialization, route 429) are explicitly owned by T4 (`auth-routes.ts`/`auth-routes.test.ts`); T3's changes are exercised through the unchanged route suite via `app.inject` as regression, and no route file was edited.
- Coverage → met: `npm run coverage --workspace @cubeclicker/backend` passes all four aggregate thresholds; no exclusion or threshold change.

## Deviations from spec
- None. The change stayed inside `files_owned`; `auth-routes.ts`, repositories, docs and configuration were untouched.
- Size note: the task was delivered as one commit (the plan allowed up to two), because the service and its tests landed together without an intermediate green state.

## Raw scaffold note
The pre-implementation sketch is recorded inline: registration decision table → shared send wrapper (create/resume/resend) → unknown-race re-query → `@` identifier login → decision-table/token/login tests.
