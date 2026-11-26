# Build log — T3 — Runtime transport selection, startup probe and 502 logging

Task: T3 (2026-11-26)
Files changed: `src/backend/src/app.ts`, `src/backend/src/app.test.ts`, `src/backend/src/auth/auth-routes.ts`, `src/backend/src/auth/auth-routes.test.ts`, `docs/features/brevo-api-email-transport/build-log-T3.md`

## What changed & why

- `buildApp` now composes the email service through `createEmailService(authConfig, { smtpTransportFactory, brevoRequest })`; the inline `createSmtpEmailService` branch and the unreachable `FakeEmailService` fallback are gone. `emailTransportFactory` stays the SMTP-only seam.
- `BuildAppOptions.auth` gains the API-only `brevoRequest` seam, passed only to `createEmailService`.
- The `onReady` probe is gated by `authConfig.emailTransport`: the API path always probes (the config layer guarantees a key) and logs `brevo_api_transport_verify_ok` (info), `_failed` (warn, redacted fields) or `_skipped` (debug, `unsupported`); the SMTP path keeps its credential gate and `smtp_transport_*` events unchanged.
- The probe is started through `void Promise.resolve().then(...)` and never awaited. A never-settling API request leaves `/healthz` and `inject` green; a synchronous throw becomes the same caught rejection.
- `verification_email_delivery_failed` gains `transport` (`error.transport`); the 502 body, resend behavior and `auth-service.ts` are untouched.

## Decisions

- The API probe failure fields reuse the existing redacting `probeFailureFields` helper (renamed from `smtpProbeFailureFields`): a typed `EmailDeliveryError` contributes `errorType`, the whitelisted `transportCode` and its `host`/`port` only; the message and stack never reach a line.
- The SMTP branch keeps the existing `verify.call(...)` start form; only the new API branch uses `Promise.resolve().then(...)` for synchronous-throw containment.
- Tests: `app.test.ts` covers transport selection, the untouched SMTP factory/`brevoRequest` separation, the never-settling probe, and the three exact `brevo_api_transport_*` events with their levels and fields. `auth-routes.test.ts` exercises the real `BrevoApiEmailService` through `createEmailService` and an injected request seam: exact 502 bodies, one transport-tagged warn, token invalidation captured from the `verificationTokens.issue` spy, and resend recovery with the exact 202 body and one API send.
- No network in tests: every API path uses a scripted `brevoRequest`; no response body is read.

## Evidence

Command (the exact T3 `verify` block, run from the repository root; it applies the shared log guard to this file):

```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend
npm run coverage --workspace @cubeclicker/backend
grep -q "brevo_api_transport_verify_ok" src/backend/src/app.ts
grep -q "brevo_api_transport_verify_failed" src/backend/src/app.ts
grep -q "brevo_api_transport_verify_skipped" src/backend/src/app.ts
grep -q "error.transport" src/backend/src/auth/auth-routes.ts
log=docs/features/brevo-api-email-transport/build-log-T3.md
test -f "$log"
log_guard="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|verify\?token=|[0-9a-f]{32,}|xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|rnd_[A-Za-z0-9_-]{20,}|(SMTP_(USER|PASS)|BREVO_API_KEY|RENDER_API_KEY)[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9+/_-]{12,}"
! grep -qE "$log_guard" "$log"
```

Result: exit `0` (`T3 VERIFY PASS`). Raw output:

```text
> lint
> eslint .


> typecheck
> tsc --noEmit


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/auth/config.test.ts (61 tests) 10ms
 ✓ src/game/config.test.ts (13 tests) 5ms
 ✓ src/auth/user-repository.test.ts (40 tests) 13ms
 ✓ src/auth/session-repository.test.ts (35 tests) 15ms
 ✓ src/game/parts-v2.test.ts (40 tests) 16ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 18ms
 ✓ src/game/cubes.test.ts (24 tests) 7ms
 ✓ src/game/broadcast.test.ts (13 tests) 11ms
 ✓ src/game/leaderboard.test.ts (23 tests) 19ms
 ✓ src/observability/metrics.test.ts (37 tests) 19ms
 ✓ src/auth/email.test.ts (62 tests) 35ms
 ✓ src/db/startup.test.ts (18 tests) 26ms
 ✓ src/observability/metrics-route.test.ts (3 tests) 121ms
 ✓ src/game/servers.test.ts (47 tests) 183ms
 ✓ src/observability/logging.test.ts (29 tests) 149ms
 ✓ src/game/parts-v3.test.ts (63 tests) 263ms
 ✓ src/auth/email-template.test.ts (30 tests) 10ms
 ✓ src/db/verification-cleanup.test.ts (10 tests) 18ms
 ✓ src/db/migrate-runner.test.ts (9 tests) 12ms
 ✓ src/db/migrate.test.ts (11 tests) 11ms
 ✓ src/observability/shutdown.test.ts (7 tests) 12ms
 ✓ src/game/activity.test.ts (24 tests) 11ms
 ✓ src/game/protocol.test.ts (533 tests) 82ms
 ✓ src/game/players.test.ts (13 tests) 15ms
 ✓ src/db/schema-bootstrap.test.ts (12 tests) 15ms
 ✓ src/deploy/render-env.test.ts (46 tests) 21ms
 ✓ src/server.test.ts (6 tests) 17ms
 ✓ src/observability/db-metrics.test.ts (8 tests) 30ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 14ms
 ✓ src/observability/shutdown-before-close.test.ts (5 tests) 12ms
 ✓ src/game/upgrades.test.ts (20 tests) 13ms
 ✓ src/cors.test.ts (20 tests) 269ms
 ✓ src/auth/password.test.ts (17 tests) 494ms
 ✓ src/db/schema-contract.test.ts (11 tests) 14ms
 ✓ src/auth/email-cli.test.ts (28 tests) 516ms
 ✓ src/game/hub.test.ts (212 tests) 439ms
 ✓ src/deploy/render-env-cli.test.ts (28 tests) 584ms
 ✓ src/game/parts.test.ts (19 tests) 11ms
 ✓ src/auth/rate-limit.test.ts (19 tests) 12ms
 ✓ src/observability/config.test.ts (24 tests) 8ms
 ✓ src/db/pool.test.ts (10 tests) 8ms
 ✓ src/db/lifecycle-config.test.ts (29 tests) 7ms
 ✓ src/game/economy.test.ts (20 tests) 8ms
 ✓ src/auth/auth-routes.test.ts (43 tests) 1518ms
 ✓ src/auth/auth-service.test.ts (73 tests) 1809ms
 ✓ src/db/verification-cleanup-postgres.test.ts (2 tests) 2581ms
 ✓ src/app.test.ts (56 tests) 2618ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1105ms
 ✓ src/db/schema-contract-postgres.test.ts (4 tests) 2796ms
 ✓ src/auth/economy-repository.test.ts (124 tests) 2562ms
 ✓ src/db/migration-007.test.ts (11 tests) 2626ms
 ✓ src/db/migration-006.test.ts (13 tests) 2905ms
 ✓ src/db/schema-bootstrap-postgres.test.ts (7 tests) 2958ms

 Test Files  52 passed (52)
      Tests  2064 passed (2064)
   Start at  18:36:53
   Duration  3.88s (transform 5.82s, setup 0ms, collect 16.45s, tests 25.95s, environment 10ms, prepare 4.75s)


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/parts-v2.test.ts (40 tests) 16ms
 ✓ src/auth/session-repository.test.ts (35 tests) 21ms
 ✓ src/db/verification-cleanup.test.ts (10 tests) 20ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 16ms
 ✓ src/deploy/render-env.test.ts (46 tests) 16ms
 ✓ src/game/players.test.ts (13 tests) 10ms
 ✓ src/observability/db-metrics.test.ts (8 tests) 9ms
 ✓ src/game/leaderboard.test.ts (23 tests) 15ms
 ✓ src/observability/metrics.test.ts (37 tests) 27ms
 ✓ src/server.test.ts (6 tests) 12ms
 ✓ src/auth/email.test.ts (62 tests) 39ms
 ✓ src/db/startup.test.ts (18 tests) 30ms
 ✓ src/observability/metrics-route.test.ts (3 tests) 123ms
 ✓ src/game/servers.test.ts (47 tests) 175ms
 ✓ src/observability/logging.test.ts (29 tests) 175ms
 ✓ src/game/parts-v3.test.ts (63 tests) 309ms
 ✓ src/db/schema-bootstrap.test.ts (12 tests) 16ms
 ✓ src/auth/user-repository.test.ts (40 tests) 23ms
 ✓ src/game/upgrades.test.ts (20 tests) 8ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 15ms
 ✓ src/db/schema-contract.test.ts (11 tests) 15ms
 ✓ src/auth/rate-limit.test.ts (19 tests) 11ms
 ✓ src/observability/shutdown.test.ts (7 tests) 14ms
 ✓ src/auth/password.test.ts (17 tests) 445ms
 ✓ src/observability/shutdown-before-close.test.ts (5 tests) 13ms
 ✓ src/game/protocol.test.ts (533 tests) 78ms
 ✓ src/db/migrate-runner.test.ts (9 tests) 14ms
 ✓ src/db/migrate.test.ts (11 tests) 27ms
 ✓ src/game/broadcast.test.ts (13 tests) 22ms
 ✓ src/auth/email-cli.test.ts (28 tests) 489ms
 ✓ src/game/activity.test.ts (24 tests) 17ms
 ✓ src/deploy/render-env-cli.test.ts (28 tests) 616ms
 ✓ src/auth/config.test.ts (61 tests) 27ms
 ✓ src/game/parts.test.ts (19 tests) 20ms
 ✓ src/cors.test.ts (20 tests) 282ms
 ✓ src/auth/email-template.test.ts (30 tests) 10ms
 ✓ src/observability/config.test.ts (24 tests) 8ms
 ✓ src/db/pool.test.ts (10 tests) 8ms
 ✓ src/game/hub.test.ts (212 tests) 545ms
 ✓ src/game/economy.test.ts (20 tests) 9ms
 ✓ src/db/lifecycle-config.test.ts (29 tests) 11ms
 ✓ src/game/config.test.ts (13 tests) 10ms
 ✓ src/game/cubes.test.ts (24 tests) 16ms
 ✓ src/auth/auth-routes.test.ts (43 tests) 1565ms
 ✓ src/auth/auth-service.test.ts (73 tests) 1890ms
 ✓ src/db/schema-contract-postgres.test.ts (4 tests) 2609ms
 ✓ src/db/verification-cleanup-postgres.test.ts (2 tests) 2741ms
 ✓ src/db/migration-006.test.ts (13 tests) 2825ms
 ✓ src/db/migration-007.test.ts (11 tests) 2594ms
 ✓ src/auth/economy-repository.test.ts (124 tests) 2634ms
 ✓ src/app.test.ts (56 tests) 2736ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1106ms
 ✓ src/db/schema-bootstrap-postgres.test.ts (7 tests) 2916ms

 Test Files  52 passed (52)
      Tests  2064 passed (2064)
   Start at  18:36:58
   Duration  4.14s (transform 6.02s, setup 0ms, collect 17.53s, tests 26.29s, environment 11ms, prepare 6.01s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   97.06 |    92.16 |   99.65 |   97.06 |                   
 src               |   97.58 |    93.52 |     100 |   97.58 |                   
  app.ts           |   97.01 |    91.74 |     100 |   97.01 | ...10-411,459-461 
  cors.ts          |     100 |      100 |     100 |     100 |                   
 src/auth          |   96.79 |     86.8 |     100 |   96.79 |                   
  auth-routes.ts   |    84.4 |    61.26 |     100 |    84.4 | ...30-432,438-439 
  auth-service.ts  |     100 |    87.62 |     100 |     100 | ...29,534,551,636 
  config.ts        |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   95.74 |      86.2 |     100 |   95.74 | ...77-778,834-847 
  email-cli.ts     |   98.48 |    88.09 |     100 |   98.48 | 195-196           
  ...l-template.ts |     100 |      100 |     100 |     100 |                   
  email.ts         |     100 |      100 |     100 |     100 |                   
  password.ts      |     100 |      100 |     100 |     100 |                   
  rate-limit.ts    |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   96.53 |    84.37 |     100 |   96.53 | ...40-141,146-147 
  ...repository.ts |   98.8 |    89.65 |     100 |   98.8 | 61-62,315         
  ...repository.ts |   97.29 |    91.66 |     100 |   97.29 | 63-68             
 src/db            |   99.07 |    96.44 |     100 |   99.07 |                   
  ...cle-config.ts |     100 |      100 |     100 |     100 |                   
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 | 82-83             
  ...ate-runner.ts |   96.61 |    95.45 |     100 |   96.61 | 107-108           
  migrate.ts       |     100 |      100 |     100 |     100 |                   
  pool.ts          |     100 |      100 |     100 |     100 |                   
  ...-bootstrap.ts |     100 |    97.56 |     100 |     100 | 181               
  ...a-contract.ts |     100 |      100 |     100 |     100 |                   
  startup.ts       |    98.5 |    96.29 |     100 |   98.5 | 162-163           
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
T3 VERIFY PASS
```

Final guard re-run against this finalized log (the only file the `verify` block reads back):

```text
$ log_guard="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|verify\?token=|[0-9a-f]{32,}|xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|rnd_[A-Za-z0-9_-]{20,}|(SMTP_(USER|PASS)|BREVO_API_KEY|RENDER_API_KEY)[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9+/_-]{12,}"
$ grep -qE "$log_guard" docs/features/brevo-api-email-transport/build-log-T3.md
guard: no match (exit 1 from grep, so the negated check passes)
```

Full block re-run after this log was finalized: exit `0` (`T3 FINAL VERIFY PASS`), same 52 files / 2064 tests, all-file coverage 97.06% statements / 92.17% branches / 99.65% functions / 97.06% lines (V8 branch micro-variance; both runs ≥ 80).

## Acceptance audit

- AC-5(a) → met: `constructs the API service through brevoRequest, never the SMTP factory` builds with the API environment and both seams, asserts the SMTP factory is never called, and asserts the exact `GET https://api.brevo.com/v3/account` probe plus the exact `POST https://api.brevo.com/v3/smtp/email` send (three headers, five-key body, branded template, `AbortSignal`) through the injected seam.
- AC-5(b) → met: `keeps the SMTP factory path and never calls the brevoRequest seam` pins the SMTP factory call and the absent API seam; the pre-existing `constructs the SMTP service through the injected transport factory exactly once` and all `smtp_transport_*` probe tests pass unchanged.
- AC-5(c) → met: `serves /healthz while a never-settling API probe is pending and starts it once` returns `200 {"status":"ok"}` for two `inject` calls while the request promise never settles, then proves one probe start after `ready()`.
- AC-5(d) → met: `logs exactly one info brevo_api_transport_verify_ok with host and port` asserts one level-30 event with `host: 'api.brevo.com'` and `port: 443`, and no failed/skipped event.
- AC-5(e) → met: `logs exactly one warn brevo_api_transport_verify_failed with fields only and keeps /healthz green` asserts one level-40 event with `errorType: 'BrevoApiError'`, `transportCode: 'HTTP_401'`, `host: 'api.brevo.com'`, `port: 443`; asserts no `err`/`stack`, no API key, no sender address and no provider message in the captured text, and `/healthz` still `200 {"status":"ok"}`.
- AC-5(f) → met: `logs one debug brevo_api_transport_verify_skipped with unsupported and never fails readiness` asserts one level-20 skipped event with `reason: 'unsupported'` and a green `/healthz`.
- AC-5(g) → met: the never-settling probe test completes `inject`/`ready`, the failed-probe test keeps `/healthz` green, and `app.close()` succeeds in every case; the probe is started fire-and-forget from `onReady`.
- AC-6(a) → met: `register returns the exact 502, logs one transport-tagged warn and invalidates the issued token` uses the real `BrevoApiEmailService` whose request returns 401, returns exactly `{"message":"verification email could not be sent","code":"verification_email_failed","error":"verification_email_failed"}`, sets no session cookie and creates no session.
- AC-6(b) → met: `resend returns the same exact 502 and invalidates the resend token when the API rejects` asserts the same exact 502 body on `POST /auth/resend-verification`.
- AC-6(c) → met: both failure tests assert exactly one level-40 `verification_email_delivery_failed` with `transport: 'brevo-api'`, `errorType: 'BrevoApiError'`, `transportCode: 'HTTP_401'`, `host: 'api.brevo.com'`, `port: 443` and the canonical route, plus absence of the address, username, account id, token, API key, provider message and `err`/`stack` in the captured lines. The pre-existing SMTP tests now also pin `transport: 'smtp'`.
- AC-6(d) → met: the `verificationTokens.issue` spy captures the raw token; after the rejected send `tokens.consume(capturedToken)` returns `null`, and the account row remains persisted with `verified: false`.
- AC-6(e) → met: `a later resend returns the exact 202 body and sends exactly once through the API` flips the seam to `201`, asserts `202 {"message":"verification email sent"}`, asserts exactly two API calls (failed register + one resend), filters the request bodies containing the fresh resend token to exactly one send, and pins its URL, method, headers and five-key body with the branded template.
- AC-6(f) → not in this task's diff: no `src/frontend/**` change.

## Assertions

Concrete expected values only: exact 502/202 bodies, exact event names/levels/field values, exact URLs, methods, headers and JSON bodies, exact status codes and exact token invalidation outcomes. No wildcard matchers, snapshots or assertion-free tests; no bounded-exception allowance used.

## Coverage

`npm run coverage --workspace @cubeclicker/backend`: all-files 97.06% statements, 92.16% branches, 99.65% functions, 97.06% lines. `src/app.ts` is 97.01/91.74/100/97.01 and `src/auth/auth-routes.ts` is 84.4/61.26/100/84.4 (its uncovered branches predate this task). Thresholds remain 80; no exclusion added.

## Deviations from spec

None.
