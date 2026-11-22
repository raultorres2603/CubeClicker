# Build log — T5 — Pass the verification TTL and lock failure surfacing

Task: T5 (2026-11-22)
Files changed: `src/backend/src/auth/auth-service.ts`, `src/backend/src/auth/auth-service.test.ts`, `src/backend/src/auth/auth-routes.test.ts`, `docs/features/brevo-smtp-email-delivery/build-log-T5.md`

## What changed & why
- `AuthService.register` and `AuthService.resendVerification` now pass `{ expiresInMs: this.verificationTokenTtlMs }` into `EmailService.sendVerification`, so the branded HTML expiry sentence states the token's actual lifetime instead of the template's 24-hour default (AC-19(b)).
- No other auth behavior changed: token TTL computation, issuance/invalidation order, rate limits, session issuance, status codes and error mapping are untouched. The only failure-path behavior is now pinned by tests: a transport rejection propagates out of `register`, the route returns `500 internal_error`, the account stays persisted and unverified, and no session is created.
- `auth-service.test.ts` gains TTL propagation tests (2-hour non-default TTL from `VERIFICATION_TOKEN_TTL_HOURS=2`, exact `expiresInMs` for register and resend), a `SmtpEmailService` integration test asserting the rendered payload contains `This link expires in 2 hours.`, and the failure/recovery regression.
- `auth-routes.test.ts` gains the HTTP regression: `POST /auth/register` with a rejecting transport returns exactly `{ message: 'internal error', code: 'internal_error', error: 'internal_error' }`, no cookie, no session row; a follow-up `POST /auth/resend` returns `202`, sends a new email, invalidates the first token and verifies with the fresh one.

## Decisions
- **Test failure seam is a local recording email service, not a change to `FakeEmailService` or `email.ts`.** `RejectingEmailService` (auth-service) and `FlakyRecordingEmailService` (auth-routes) record each attempt before rejecting, so the test can capture the registration-issued URL/token even though the send failed; this is what lets the recovery test prove the old token is invalid and the resend token works.
- **The non-default TTL test derives the value through `loadAuthConfig({ VERIFICATION_TOKEN_TTL_HOURS: '2' })`** and hands it to the service, then renders through the real `SmtpEmailService` with an injected in-memory transport; the assertion is on the actual `sendMail` HTML, not a re-rendered expectation (T3 already covers `renderVerificationEmail` formatting).
- **"No session issued" is asserted by counting `SessionRepository.create` calls** (exact empty array) in both tiers, rather than probing a fabricated cookie; this is deterministic and cannot pass vacuously.
- **The route test keeps the existing `buildCtx` wiring** by adding one optional injected email argument and a `RecordingEmailService` structural type; no existing test changed behavior.

## Evidence

### `npm run lint`
```
$ npm run lint
> lint
> eslint .

lint exit=0
```

### `npm run typecheck --workspace @cubeclicker/backend`
```
$ npm run typecheck --workspace @cubeclicker/backend
> typecheck
> tsc --noEmit

typecheck exit=0
```

### `npm test --workspace @cubeclicker/backend`
```
$ npm test --workspace @cubeclicker/backend
 ✓ src/auth/auth-routes.test.ts (29 tests) 1031ms
 ✓ src/auth/auth-service.test.ts (55 tests) 1274ms
 ... (37 more files)

 Test Files  39 passed (39)
      Tests  1752 passed (1752)
   Start at  12:04:44
   Duration  3.52s (transform 5.35s, setup 0ms, collect 15.05s, tests 15.11s, environment 8ms, prepare 3.22s)
test exit=0
```

Targeted run while iterating:
```
$ npm test --workspace @cubeclicker/backend -- --run src/auth/auth-service.test.ts src/auth/auth-routes.test.ts
 ✓ src/auth/auth-routes.test.ts (29 tests) 701ms
 ✓ src/auth/auth-service.test.ts (55 tests) 932ms
 Test Files  2 passed (2)
      Tests  84 passed (84)
```

### `npm run coverage --workspace @cubeclicker/backend`
```
$ npm run coverage --workspace @cubeclicker/backend
 Test Files  39 passed (39)
      Tests  1752 passed (1752)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
All files          |   96.56 |    90.69 |    99.6 |   96.56 |
 src/auth          |   96.07 |    83.82 |     100 |   96.07 |
  auth-service.ts  |     100 |    81.87 |     100 |     100 |
  config.ts        |     100 |      100 |     100 |     100 |
  email.ts         |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|
coverage exit=0 (thresholds 80/80/80/80 met)
```

### `test -f docs/features/brevo-smtp-email-delivery/build-log-T5.md`
```
$ test -f docs/features/brevo-smtp-email-delivery/build-log-T5.md
exit 0
```

### Build-log credential guard (tasks.md T5, verbatim)
```
$ ! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}" docs/features/brevo-smtp-email-delivery/build-log-T5.md
exit 0 (no match, no output)
```

### Scope check
```
$ git status --short -- src/backend/src/auth/auth-service.ts src/backend/src/auth/auth-service.test.ts src/backend/src/auth/auth-routes.test.ts docs/features/brevo-smtp-email-delivery/build-log-T5.md
 M src/backend/src/auth/auth-routes.test.ts
 M src/backend/src/auth/auth-service.test.ts
 M src/backend/src/auth/auth-service.ts
?? docs/features/brevo-smtp-email-delivery/build-log-T5.md
```
Only the four `files_owned` paths changed; `email.ts`, `email-template.ts`, `app.ts`, the CLI, compose/Render and docs are untouched.

## Acceptance audit
- **AC-10 → met.** `auth-routes.test.ts` § `POST /auth/register transport rejection returns 500 internal_error, then resend recovers with a fresh token`: the first registration returns exactly HTTP `500` / `{ message: 'internal error', code: 'internal_error', error: 'internal_error' }`, sets no cookie (`getSetCookie` is `''`), creates no session (`SessionRepository.create` call list is `[]`), and the account is persisted with `username: 'flaky'`, `verified: false`. The follow-up `POST /auth/resend` returns `202` with `{ message: 'verification email sent' }`, captures a second email with a new 64-hex token, rejects the first token with `400`/`invalid_token`, and verifies the second token (`200`, `verified: true`). `auth-service.test.ts` § `AuthService transport failure recovery (AC-10)` proves the same at the service tier (exact propagated `SMTP transport failed: connection refused` message, account unverified, no session create).
- **AC-19(b) → met.** `auth-service.test.ts` § `AuthService verification TTL propagation (AC-19(b))`: with `loadAuthConfig({ VERIFICATION_TOKEN_TTL_HOURS: '2' })` → `verificationTokenTtlMs = 7200000`, `register` and `resendVerification` both record `expiresInMs === 7200000` on `FakeEmailService`, and the `SmtpEmailService` integration test asserts the `sendMail` HTML contains `This link expires in 2 hours.` (plus the pinned subject). The default-path calls in the route test record `expiresInMs === 86400000`, so no call site falls back to the template default.
- **Not claimed here (owned by other tasks).** AC-19(a) template formatting is T3; AC-3/AC-5/AC-6/AC-7 are T4; the full gate is T9.

## Deviations from spec
None.
