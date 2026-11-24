# Build log — T4 — 502 mapping, field payloads, `resumed` passthrough and delivery logging

Task: T4 (2026-11-24)
Files changed: `src/backend/src/auth/auth-routes.ts`, `src/backend/src/auth/auth-routes.test.ts`, `docs/features/registration-account-exists/build-log-T4.md`

## What changed & why
- `mapError(request, reply, err)` now maps a typed `EmailDeliveryError` to the fixed `502 { message: 'verification email could not be sent', code: 'verification_email_failed', error: 'verification_email_failed' }` body and emits the per-route delivery event; every call site passes the request.
- The event is exactly one `warn` `verification_email_delivery_failed` through `createLogSink(request.log)` with `route`, `errorType`, optional `transportCode`, `host` and `port`; the transport message, stack, email, username, token and credentials never reach the line. The route is derived from the matched Fastify route and canonicalized to the two AC-3(d) values.
- `DuplicateAccountError` keeps the accepted generic `account already exists` message and status `409`, and adds the ordered `field`/`fields`; every other `AuthServiceError` keeps its status/code/`Retry-After`; anything else keeps the generic `500 internal_error`.
- The register handler serializes `resumed: true` only when `RegisterResult.resumed === true`; a new registration sends the exact `202 { message: 'verification email sent' }` body with no `resumed` property.
- Tests now pin the exact route contract: `resumed`/no-`resumed`/429 bodies, all three 409 field shapes (including the U1/U2 split-row fixture), wrong-password and verified no-resume, the 502 body with no session on register and resend, the logger-stream fields and no-PII assertions, and email login 200/401/429.

## Decisions
- **Logger shape.** `mapError` gains the `request` (the plan's request variant) and every call site passes it. The two delivery-capable routes are identified by parsing the matched route (`request.routeOptions.url`): `/auth/register` → `register`, the resend handler → `resend-verification`. This keeps one shared mapper with no fabricated route label and no optional-logger branch; `createLogSink(request.log)` keeps the event-first convention and attaches the request id for correlation.
- **Route values are canonical.** Both resend aliases (`/auth/resend`, `/auth/resend-verification`) emit `route: 'resend-verification'`, the value pinned by AC-3(d); the register handler emits `route: 'register'`. These are the only two routes that can issue a verification email, so the derivation is total for `EmailDeliveryError`.
- **409 body shape.** `field`/`fields` are added inside the existing `AuthServiceError` branch only for `DuplicateAccountError`, so no other error type gains extra keys.
- **`resumed` serialization.** The handler builds the `202` body and adds `resumed: true` only when the service result's property is exactly `true`; `undefined`/absent (new registration) omits the key.
- **Test doubles.** `ScriptedEmailService` applies a per-attempt outcome list (success or a constructed `EmailDeliveryError`) so register and resend failures are driven through the real route/service/repository stack; `FlakyRecordingEmailService` still supplies the untyped-error path for AC-3(e)'s `500`.
- **Fixtures are synthetic.** The U1/U2 fixture uses two synthetic unverified rows with the username on one and the email on the other; no real address, username or credential is recorded here.

## Evidence

### Full T4 verify block (verbatim, plus a final marker echo; final run after this log was written)
```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend
npm run coverage --workspace @cubeclicker/backend
test -f docs/features/registration-account-exists/build-log-T4.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/registration-account-exists/build-log-T4.md
echo "T4 VERIFY BLOCK: ALL COMMANDS EXITED 0"
```
Raw result (key lines from the exact captured block output; lint/typecheck print nothing on success). The block was executed with the draft log and again after every subsequent log edit — including the definitive run below — and exited 0 each time; V8 branch coverage ranged 91.83–91.84 between runs, far above the threshold:
```
 Test Files  52 passed (52)
      Tests  1996 passed (1996)
 Test Files  52 passed (52)
      Tests  1996 passed (1996)
All files          |   96.94 |    91.83 |   99.64 |   96.94 |
  auth-routes.ts   |   84.35 |    61.26 |     100 |   84.35 | ...29-431,437-438
  auth-service.ts  |     100 |    87.62 |     100 |     100 | ...29,534,551,636
T4 VERIFY BLOCK: ALL COMMANDS EXITED 0
```
`test -f` and the credential `! grep` produce no output on success; a match aborts the script before the marker.

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

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 Test Files  52 passed (52)
      Tests  1996 passed (1996)
   Start at  19:09:47
   Duration  4.16s (transform 6.87s, setup 0ms, collect 18.29s, tests 27.84s, environment 11ms, prepare 4.28s)

exit 0
```

### `npm run coverage --workspace @cubeclicker/backend`
```
$ npm run coverage --workspace @cubeclicker/backend

> coverage
> vitest run --coverage

 Test Files  52 passed (52)
      Tests  1996 passed (1996)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.94 |    91.84 |   99.64 |   96.94 |
 src/auth          |   96.52 |    85.74 |     100 |   96.52 |
  auth-routes.ts   |   84.35 |    61.26 |     100 |   84.35 | ...29-431,437-438
  auth-service.ts  |     100 |    87.62 |     100 |     100 | ...29,534,551,636
-------------------|---------|----------|---------|---------|-------------------

exit 0 — aggregate pass: 96.94 statements / 91.84 branches / 99.64 functions / 96.94 lines, all ≥ 80.
```
The new `auth-routes.ts` branches are fully exercised: `EmailDeliveryError` present/absent, both derived route branches (`register`, `resend-verification`), `DuplicateAccountError` present/absent, `transportCode` present/absent and `resumed === true` true/false all appear as covered in the V8 JSON map. The remaining uncovered `auth-routes.ts` statements/branches are the pre-existing defensive paths (`!r.service` 503s, optional body aliases, optional-cookie fallbacks, logout/touch fallbacks).

### Focused T4 suite (new cases)
```
$ npx --no-install vitest run src/auth/auth-routes.test.ts --reporter=verbose

 ✓ src/auth/auth-routes.test.ts > registration route contract (AC-3, AC-4, AC-5) > serializes resumed:true only on a resume and omits it for a new registration
 ✓ src/auth/auth-routes.test.ts > registration route contract (AC-3, AC-4, AC-5) > preserves the resume 429 body after three resumes per hour without sending another email
 ✓ src/auth/auth-routes.test.ts > registration route contract (AC-3, AC-4, AC-5) > reports both ordered fields when the username and email belong to different unverified rows (U1/U2)
 ✓ src/auth/auth-routes.test.ts > registration route contract (AC-3, AC-4, AC-5) > does not resume a wrong password on the same unverified row and sends no email
 ✓ src/auth/auth-routes.test.ts > registration route contract (AC-3, AC-4, AC-5) > does not resume an already-verified pair and sends no email
 ✓ src/auth/auth-routes.test.ts > delivery failure logging (AC-3) > register delivery failure returns the fixed 502 body, sets no session and logs one redacted warn event
 ✓ src/auth/auth-routes.test.ts > delivery failure logging (AC-3) > resend-verification delivery failure returns the same 502 body and logs the resend route without transportCode
 ✓ src/auth/auth-routes.test.ts > email identifier login (AC-6) > logs in with a mixed-case email in the username field and returns the session
 ✓ src/auth/auth-routes.test.ts > email identifier login (AC-6) > logs in with the identifier alias for an email
 ✓ src/auth/auth-routes.test.ts > email identifier login (AC-6) > returns the generic 401 for an unknown email and for a wrong email password
 ✓ src/auth/auth-routes.test.ts > email identifier login (AC-6) > locks an email identifier after five failures and returns Retry-After on the 429

 Test Files  1 passed (1)
      Tests  40 passed (40)
```

## Acceptance audit
- AC-3(a) → met: register with a typed delivery failure returns the exact `502` body, `Set-Cookie` is empty, `sessions.create` is never called, and the user stays persisted and unverified.
- AC-3(b) → met: resend-verification under the same typed failure returns the identical exact `502` body with no cookie.
- AC-3(d) → met at the route layer: exactly one `verification_email_delivery_failed` `warn` event per failure, `route` `register`/`resend-verification`, `errorType`, optional `transportCode`, `host`, `port`; the captured stream contains no synthetic email, username, password, transport message or `verify?token=`.
- AC-3(e) → met: the existing untyped-error test still returns the exact generic `500 internal_error` body (title updated to say "untyped email failure").
- AC-4(a) → met: resume returns the exact `{ message: 'verification email sent', resumed: true }` body; a new registration returns the exact body without `resumed`.
- AC-4(e) → met: the fourth resume request in the window returns the exact `429 { message: 'rate limit exceeded', code: 'rate_limited', error: 'rate_limited' }` body, sends no email and sets no cookie. The shared `Retry-After` header path is unchanged and still proven by the locked-account route test (no `Retry-After` is expected for the resume limiter, whose `RateLimitError` carries no `retryAfter`).
- AC-4(g) → met: the route suite owns and pins the exact `resumed: true` body, the absent `resumed` on a new registration, the exact `429` body, and the untouched 5/minute per-IP register limiter (the 429 test stays at 5 register requests).
- AC-5(a)(b)(c) → met: exact `409` bodies for `field: 'username'`, `field: 'email'`, and `field: 'both'` with `fields: ['username','email']` for the split-row U1/U2 fixture; no email, no cookie and no new row on the conflict.
- AC-5(d) → met: an already-verified same-pair registration returns the exact `field: 'both'` body, sends no email and creates no session.
- AC-5(e) → met: every conflict keeps `message: 'account already exists'`, `code`/`error: 'duplicate_account'`.
- AC-4(c) → met at the route layer: a wrong password on the same unverified row returns the exact `field: 'both'` body, sends no email and sets no cookie.
- AC-6(a)(b) → met: login with a mixed-case email in the `username` field and with `identifier` both return `200` with the exact `{ user: { id, username, email, verified } }` body and an `HttpOnly` session cookie.
- AC-6(c) → met: an unknown email and a wrong email password both return the exact generic `401` body with no cookie.
- AC-6(d) → met: five failed email logins lock the account; the sixth returns `429`, `retry-after: 900` and the exact `account_locked` body.
- Testing bar → met: assertions are concrete (`toEqual` on exact bodies, exact field values, exact timestamps/counts, `toHaveBeenCalledTimes`/`not.toHaveBeenCalled` where behavior is absence); no wildcard matcher, snapshot or assertion-free test. The tier is integration: the auth routes run through `app.inject` with the real Fastify plugin, cookie plugin, Origin check, in-memory repositories and a real Fastify/Pino logger stream. No float tolerance or bounded exception was needed.

## Deviations from spec
- None. The change stayed inside `files_owned`; `auth-service.ts`, `email.ts`, repositories, docs and configuration were untouched.
- Implementation note: `mapError` takes the request (the plan's request variant) and derives the canonical `route` from the matched Fastify route; no call site needs a route argument and no non-delivery endpoint fabricates a label.

## Raw scaffold note
The pre-implementation sketch is recorded inline: `EmailDeliveryError` → 502 + one redacted warn (route derived from the matched route) → `DuplicateAccountError` → 409 with field/fields → generic service error passthrough → `resumed: true` conditional serialization → route contract tests (exact bodies, U1/U2, logger capture, email login).

### Final verify run — raw output (definitive)

Executed verbatim from `tasks.md` with `set -euo pipefail` at 2026-11-24 19:16 (block plus the final marker echo):

```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend
npm run coverage --workspace @cubeclicker/backend
test -f docs/features/registration-account-exists/build-log-T4.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/registration-account-exists/build-log-T4.md
echo "T4 VERIFY BLOCK: ALL COMMANDS EXITED 0"
```

Raw output:
```text

> lint
> eslint .


> typecheck
> tsc --noEmit


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/broadcast.test.ts (13 tests) 21ms
 ✓ src/auth/rate-limit.test.ts (19 tests) 8ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 20ms
 ✓ src/db/verification-cleanup.test.ts (10 tests) 15ms
 ✓ src/game/parts-v2.test.ts (40 tests) 18ms
 ✓ src/auth/session-repository.test.ts (35 tests) 21ms
 ✓ src/auth/config.test.ts (43 tests) 18ms
 ✓ src/game/leaderboard.test.ts (23 tests) 14ms
 ✓ src/observability/metrics.test.ts (37 tests) 16ms
 ✓ src/server.test.ts (6 tests) 16ms
 ✓ src/auth/email.test.ts (36 tests) 24ms
 ✓ src/db/startup.test.ts (18 tests) 33ms
 ✓ src/observability/metrics-route.test.ts (3 tests) 146ms
 ✓ src/game/servers.test.ts (47 tests) 169ms
 ✓ src/observability/logging.test.ts (29 tests) 157ms
 ✓ src/game/parts-v3.test.ts (63 tests) 236ms
 ✓ src/auth/user-repository.test.ts (40 tests) 13ms
 ✓ src/db/schema-bootstrap.test.ts (12 tests) 15ms
 ✓ src/game/cubes.test.ts (24 tests) 12ms
 ✓ src/game/activity.test.ts (24 tests) 15ms
 ✓ src/db/migrate-runner.test.ts (9 tests) 12ms
 ✓ src/deploy/render-env.test.ts (46 tests) 26ms
 ✓ src/game/parts.test.ts (19 tests) 12ms
 ✓ src/auth/email-template.test.ts (30 tests) 18ms
 ✓ src/db/migrate.test.ts (11 tests) 18ms
 ✓ src/db/lifecycle-config.test.ts (29 tests) 11ms
 ✓ src/db/schema-contract.test.ts (11 tests) 19ms
 ✓ src/game/protocol.test.ts (533 tests) 97ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 13ms
 ✓ src/observability/config.test.ts (24 tests) 13ms
 ✓ src/observability/shutdown.test.ts (7 tests) 10ms
 ✓ src/db/pool.test.ts (10 tests) 8ms
 ✓ src/game/upgrades.test.ts (20 tests) 12ms
 ✓ src/observability/shutdown-before-close.test.ts (5 tests) 7ms
 ✓ src/game/players.test.ts (13 tests) 11ms
 ✓ src/cors.test.ts (20 tests) 290ms
 ✓ src/auth/email-cli.test.ts (21 tests) 525ms
 ✓ src/game/hub.test.ts (212 tests) 446ms
 ✓ src/game/config.test.ts (13 tests) 10ms
 ✓ src/game/economy.test.ts (20 tests) 8ms
 ✓ src/observability/db-metrics.test.ts (8 tests) 16ms
 ✓ src/deploy/render-env-cli.test.ts (28 tests) 665ms
 ✓ src/auth/password.test.ts (17 tests) 879ms
 ✓ src/auth/auth-routes.test.ts (40 tests) 1716ms
 ✓ src/auth/auth-service.test.ts (73 tests) 2024ms
 ✓ src/app.test.ts (42 tests) 2617ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1105ms
 ✓ src/db/verification-cleanup-postgres.test.ts (2 tests) 2855ms
 ✓ src/auth/economy-repository.test.ts (124 tests) 2509ms
 ✓ src/db/migration-006.test.ts (13 tests) 2888ms
 ✓ src/db/migration-007.test.ts (11 tests) 2565ms
 ✓ src/db/schema-contract-postgres.test.ts (4 tests) 3108ms
 ✓ src/db/schema-bootstrap-postgres.test.ts (7 tests) 3214ms

 Test Files  52 passed (52)
      Tests  1996 passed (1996)
   Start at  19:16:35
   Duration  4.21s (transform 6.04s, setup 0ms, collect 16.45s, tests 27.61s, environment 10ms, prepare 4.72s)


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/auth/config.test.ts (43 tests) 19ms
 ✓ src/game/parts-v2.test.ts (40 tests) 14ms
 ✓ src/auth/session-repository.test.ts (35 tests) 18ms
 ✓ src/deploy/render-env.test.ts (46 tests) 20ms
 ✓ src/game/broadcast.test.ts (13 tests) 19ms
 ✓ src/auth/email-template.test.ts (30 tests) 9ms
 ✓ src/db/schema-contract.test.ts (11 tests) 12ms
 ✓ src/db/migrate.test.ts (11 tests) 14ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 23ms
 ✓ src/observability/db-metrics.test.ts (8 tests) 11ms
 ✓ src/auth/email.test.ts (36 tests) 25ms
 ✓ src/game/servers.test.ts (47 tests) 127ms
 ✓ src/db/startup.test.ts (18 tests) 24ms
 ✓ src/observability/metrics-route.test.ts (3 tests) 168ms
 ✓ src/observability/logging.test.ts (29 tests) 202ms
 ✓ src/game/parts-v3.test.ts (63 tests) 297ms
 ✓ src/db/verification-cleanup.test.ts (10 tests) 20ms
 ✓ src/observability/metrics.test.ts (37 tests) 18ms
 ✓ src/game/activity.test.ts (24 tests) 19ms
 ✓ src/observability/config.test.ts (24 tests) 7ms
 ✓ src/auth/user-repository.test.ts (40 tests) 21ms
 ✓ src/server.test.ts (6 tests) 18ms
 ✓ src/db/schema-bootstrap.test.ts (12 tests) 14ms
 ✓ src/game/parts.test.ts (19 tests) 13ms
 ✓ src/game/leaderboard.test.ts (23 tests) 31ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 13ms
 ✓ src/game/upgrades.test.ts (20 tests) 13ms
 ✓ src/game/protocol.test.ts (533 tests) 76ms
 ✓ src/db/migrate-runner.test.ts (9 tests) 16ms
 ✓ src/game/cubes.test.ts (24 tests) 30ms
 ✓ src/auth/email-cli.test.ts (21 tests) 540ms
 ✓ src/deploy/render-env-cli.test.ts (28 tests) 656ms
 ✓ src/db/lifecycle-config.test.ts (29 tests) 13ms
 ✓ src/game/players.test.ts (13 tests) 22ms
 ✓ src/auth/password.test.ts (17 tests) 695ms
 ✓ src/game/hub.test.ts (212 tests) 516ms
 ✓ src/observability/shutdown.test.ts (7 tests) 12ms
 ✓ src/game/config.test.ts (13 tests) 11ms
 ✓ src/db/pool.test.ts (10 tests) 9ms
 ✓ src/cors.test.ts (20 tests) 346ms
 ✓ src/auth/rate-limit.test.ts (19 tests) 11ms
 ✓ src/observability/shutdown-before-close.test.ts (5 tests) 11ms
 ✓ src/game/economy.test.ts (20 tests) 6ms
 ✓ src/auth/auth-routes.test.ts (40 tests) 1711ms
 ✓ src/auth/auth-service.test.ts (73 tests) 2031ms
 ✓ src/db/verification-cleanup-postgres.test.ts (2 tests) 2818ms
 ✓ src/app.test.ts (42 tests) 2675ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1100ms
 ✓ src/db/migration-007.test.ts (11 tests) 2899ms
 ✓ src/auth/economy-repository.test.ts (124 tests) 2957ms
 ✓ src/db/migration-006.test.ts (13 tests) 3052ms
 ✓ src/db/schema-contract-postgres.test.ts (4 tests) 3189ms
 ✓ src/db/schema-bootstrap-postgres.test.ts (7 tests) 3393ms

 Test Files  52 passed (52)
      Tests  1996 passed (1996)
   Start at  19:16:39
   Duration  4.52s (transform 4.41s, setup 0ms, collect 15.58s, tests 28.88s, environment 12ms, prepare 5.98s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.94 |    91.83 |   99.64 |   96.94 |                   
 src               |   96.72 |    91.45 |     100 |   96.72 |                   
  app.ts           |   95.74 |     88.5 |     100 |   95.74 | ...18-319,367-369 
  cors.ts          |     100 |      100 |     100 |     100 |                   
 src/auth          |   96.51 |    85.74 |     100 |   96.51 |                   
  auth-routes.ts   |   84.35 |    61.26 |     100 |   84.35 | ...29-431,437-438 
  auth-service.ts  |     100 |    87.62 |     100 |     100 | ...29,534,551,636 
  config.ts        |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   95.74 |     86.2 |     100 |   95.74 | ...77-778,834-847 
  email-cli.ts     |    98.3 |    86.11 |     100 |    98.3 | 176-177           
  ...l-template.ts |     100 |      100 |     100 |     100 |                   
  email.ts         |     100 |      100 |     100 |     100 |                   
  password.ts      |     100 |      100 |     100 |     100 |                   
  rate-limit.ts    |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   96.53 |    84.37 |     100 |   96.53 | ...40-141,146-147 
  ...repository.ts |    98.8 |    89.65 |     100 |    98.8 | 61-62,315         
  ...repository.ts |   97.29 |    91.66 |     100 |   97.29 | 63-68             
 src/db            |   99.07 |    96.44 |     100 |   99.07 |                   
  ...cle-config.ts |     100 |      100 |     100 |     100 |                   
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 | 82-83             
  ...ate-runner.ts |   96.61 |    95.45 |     100 |   96.61 | 107-108           
  migrate.ts       |     100 |      100 |     100 |     100 |                   
  pool.ts          |     100 |      100 |     100 |     100 |                   
  ...-bootstrap.ts |     100 |    97.56 |     100 |     100 | 181               
  ...a-contract.ts |     100 |      100 |     100 |     100 |                   
  startup.ts       |    98.5 |    96.29 |     100 |    98.5 | 162-163           
  ...on-cleanup.ts |     100 |      100 |     100 |     100 |                   
 src/deploy        |   98.52 |     99.1 |     100 |   98.52 |                   
  ...er-env-cli.ts |   95.23 |    96.42 |     100 |   95.23 | 171-175           
  render-env.ts    |     100 |      100 |     100 |     100 |                   
 src/game          |   96.25 |    94.92 |   99.13 |   96.25 |                   
  activity.ts      |     100 |      100 |     100 |     100 |                   
  broadcast.ts     |   97.12 |    95.65 |     100 |   97.12 | 137-138,231-232   
  config.ts        |     100 |      100 |     100 |     100 |                   
  cubes.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  hub.ts           |   91.36 |    89.09 |   98.59 |   91.36 | ...1833,1920-1923 
  leaderboard.ts   |     100 |      100 |     100 |     100 |                   
  parts-v2.ts      |     100 |      100 |     100 |     100 |                   
  parts-v3.ts      |     100 |      100 |     100 |     100 |                   
  parts.ts         |     100 |      100 |     100 |     100 |                   
  players.ts       |     100 |      100 |     100 |     100 |                   
  protocol.ts      |   99.36 |     99.2 |   97.77 |   99.36 | 477-478,1088-1089 
  servers.ts       |   99.01 |    98.71 |     100 |   99.01 | 289-290           
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
 src/observability |   99.67 |    96.66 |     100 |   99.67 |                   
  config.ts        |     100 |      100 |     100 |     100 |                   
  db-metrics.ts    |     100 |      100 |     100 |     100 |                   
  logging.ts       |     100 |      100 |     100 |     100 |                   
  metrics-route.ts |     100 |      100 |     100 |     100 |                   
  metrics.ts       |   99.45 |    93.54 |     100 |   99.45 | 251-252           
  shutdown.ts      |     100 |    94.73 |     100 |     100 | 74                
-------------------|---------|----------|---------|---------|-------------------
T4 VERIFY BLOCK: ALL COMMANDS EXITED 0
BLOCK_EXIT=0
```

Block exit: 0 (lint/typecheck silent success; 52 test files / 1996 tests passed in both the test and coverage runs; aggregate coverage 96.94 statements / 91.83 branches / 99.64 functions / 96.94 lines, all ≥ 80; `test -f` and the credential `! grep` passed, so the marker printed).
- Post-append guard on the installed final file: `test -f` ok; credential `! grep` no match; both exited 0.
