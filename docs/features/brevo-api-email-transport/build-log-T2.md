# Build log — T2 — Brevo API service and operator CLI

Task: T2 (2026-11-26)
Files changed: `src/backend/src/auth/email.ts`, `src/backend/src/auth/email.test.ts`, `src/backend/src/auth/email-cli.ts`, `src/backend/src/auth/email-cli.test.ts`, `docs/features/brevo-api-email-transport/build-log-T2.md`

## What changed & why

- `email.ts` adds `BrevoApiEmailService` (fixed `POST https://api.brevo.com/v3/smtp/email`, the branded template as `htmlContent`/`textContent`, a fresh `AbortSignal.timeout(BREVO_API_TIMEOUT_MS)`, fixed failure messages and `HTTP_<status>` codes, `GET https://api.brevo.com/v3/account` for `verify()`) plus the `createEmailService` selector and the `BREVO_API_*` constants.
- `EmailDeliveryError` gains `transport` as an optional fourth constructor argument defaulting to `smtp`, so the existing three-argument SMTP form and the verbatim SMTP message are unchanged.
- `createEmailService` delegates `smtp` to the untouched `createSmtpEmailService` and `brevo-api` to the new service through the injectable request seam; a missing/empty key fails closed with the AC-1(d) message.
- `email-cli.ts` now composes through `createEmailService`, prints the exact API success/failure lines, and redacts `BREVO_API_KEY` in configuration and transport failures; every SMTP line and argument path is unchanged.

## Decisions

- The API transport never reads a response body: the `BrevoResponseLike` seam exposes only `ok`/`status`, and the default `fetch` wrapper reduces the `Response` to those two fields. Non-2xx, timeout and other rejections are re-emitted as fixed-message source errors, so no provider message, body, address or code can reach `EmailDeliveryError` fields (only the whitelisted `HTTP_<status>` code survives).
- The timeout message interpolates the configured bound (`10000` at the default); `timeoutMs` exists only so a test can pin the non-default message path. The service always uses the exported `BREVO_API_TIMEOUT_MS` by default, and `email.test.ts` asserts the exported value `10000` rather than the source spelling.
- A direct `new BrevoApiEmailService(...)` with an unparseable `SMTP_FROM` throws the existing AC-1(g) message; the config layer (`loadAuthConfig`) is still the primary guard, and the constructor guard protects the composition boundary.
- Testing tiers: unit tests cover every request/response/error branch in `email.ts` and the CLI lines/redaction in `email-cli.test.ts`; the integration tier is the operator CLI running through the real `loadAuthConfig` → `createEmailService` → `BrevoApiEmailService` → injected request seam (no network), which also covers the real branded template. The app-level `buildApp`/`inject` integration for transport selection belongs to T3, whose `files_owned` includes `app.ts`/`app.test.ts`; T2 changes no app code.

## Evidence

Command (the task `verify` block, run from the repository root; it applies the shared log guard to this file):

```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend
npm run coverage --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend -- src/auth/email-cli.test.ts
grep -q "https://api.brevo.com/v3/smtp/email" src/backend/src/auth/email.ts
grep -q "https://api.brevo.com/v3/account" src/backend/src/auth/email.ts
grep -q "BREVO_API_TIMEOUT_MS" src/backend/src/auth/email.ts
log=docs/features/brevo-api-email-transport/build-log-T2.md
test -f "$log"
log_guard="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|verify\?token=|[0-9a-f]{32,}|xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|rnd_[A-Za-z0-9_-]{20,}|(SMTP_(USER|PASS)|BREVO_API_KEY|RENDER_API_KEY)[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9+/_-]{12,}"
! grep -qE "$log_guard" "$log"
```

Result: exit `0` (`T2 VERIFY PASS`). Raw output (terminal colour escapes stripped):

```text

> lint
> eslint .


> typecheck
> tsc --noEmit


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/auth/user-repository.test.ts (40 tests) 11ms
 ✓ src/db/verification-cleanup.test.ts (10 tests) 17ms
 ✓ src/auth/session-repository.test.ts (35 tests) 12ms
 ✓ src/game/broadcast.test.ts (13 tests) 17ms
 ✓ src/db/migrate.test.ts (11 tests) 12ms
 ✓ src/game/cubes.test.ts (24 tests) 7ms
 ✓ src/game/players.test.ts (13 tests) 11ms
 ✓ src/game/activity.test.ts (24 tests) 17ms
 ✓ src/server.test.ts (6 tests) 18ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 20ms
 ✓ src/db/startup.test.ts (18 tests) 28ms
 ✓ src/auth/email.test.ts (62 tests) 32ms
 ✓ src/game/servers.test.ts (47 tests) 159ms
 ✓ src/observability/metrics-route.test.ts (3 tests) 148ms
 ✓ src/game/parts-v2.test.ts (40 tests) 22ms
 ✓ src/observability/logging.test.ts (29 tests) 180ms
 ✓ src/game/upgrades.test.ts (20 tests) 6ms
 ✓ src/game/leaderboard.test.ts (23 tests) 20ms
 ✓ src/db/schema-bootstrap.test.ts (12 tests) 11ms
 ✓ src/game/parts.test.ts (19 tests) 9ms
 ✓ src/game/parts-v3.test.ts (63 tests) 263ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 25ms
 ✓ src/game/protocol.test.ts (533 tests) 88ms
 ✓ src/auth/email-template.test.ts (30 tests) 17ms
 ✓ src/auth/config.test.ts (61 tests) 23ms
 ✓ src/db/pool.test.ts (10 tests) 13ms
 ✓ src/observability/shutdown-before-close.test.ts (5 tests) 11ms
 ✓ src/observability/metrics.test.ts (37 tests) 26ms
 ✓ src/observability/db-metrics.test.ts (8 tests) 18ms
 ✓ src/observability/shutdown.test.ts (7 tests) 19ms
 ✓ src/auth/password.test.ts (17 tests) 502ms
 ✓ src/db/migrate-runner.test.ts (9 tests) 12ms
 ✓ src/db/schema-contract.test.ts (11 tests) 15ms
 ✓ src/game/hub.test.ts (212 tests) 445ms
 ✓ src/cors.test.ts (20 tests) 296ms
 ✓ src/auth/email-cli.test.ts (28 tests) 524ms
 ✓ src/db/lifecycle-config.test.ts (29 tests) 8ms
 ✓ src/deploy/render-env.test.ts (46 tests) 20ms
 ✓ src/observability/config.test.ts (24 tests) 7ms
 ✓ src/game/config.test.ts (13 tests) 8ms
 ✓ src/auth/rate-limit.test.ts (19 tests) 10ms
 ✓ src/game/economy.test.ts (20 tests) 8ms
 ✓ src/deploy/render-env-cli.test.ts (28 tests) 664ms
 ✓ src/auth/auth-routes.test.ts (40 tests) 1499ms
 ✓ src/auth/auth-service.test.ts (73 tests) 1761ms
 ✓ src/db/migration-006.test.ts (13 tests) 2584ms
 ✓ src/app.test.ts (50 tests) 2592ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1100ms
 ✓ src/db/verification-cleanup-postgres.test.ts (2 tests) 2816ms
 ✓ src/auth/economy-repository.test.ts (124 tests) 2566ms
 ✓ src/db/migration-007.test.ts (11 tests) 2609ms
 ✓ src/db/schema-contract-postgres.test.ts (4 tests) 2886ms
 ✓ src/db/schema-bootstrap-postgres.test.ts (7 tests) 3019ms

 Test Files  52 passed (52)
      Tests  2055 passed (2055)
   Start at  18:29:52
   Duration  4.08s (transform 6.14s, setup 0ms, collect 17.67s, tests 26.11s, environment 11ms, prepare 4.18s)


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/auth/config.test.ts (61 tests) 16ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 23ms
 ✓ src/game/parts-v2.test.ts (40 tests) 23ms
 ✓ src/observability/shutdown.test.ts (7 tests) 8ms
 ✓ src/observability/db-metrics.test.ts (8 tests) 10ms
 ✓ src/deploy/render-env.test.ts (46 tests) 22ms
 ✓ src/game/leaderboard.test.ts (23 tests) 22ms
 ✓ src/observability/metrics.test.ts (37 tests) 21ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 14ms
 ✓ src/server.test.ts (6 tests) 13ms
 ✓ src/db/startup.test.ts (18 tests) 21ms
 ✓ src/auth/email.test.ts (62 tests) 37ms
 ✓ src/game/servers.test.ts (47 tests) 109ms
 ✓ src/observability/metrics-route.test.ts (3 tests) 158ms
 ✓ src/observability/logging.test.ts (29 tests) 182ms
 ✓ src/game/parts-v3.test.ts (63 tests) 304ms
 ✓ src/game/activity.test.ts (24 tests) 18ms
 ✓ src/game/broadcast.test.ts (13 tests) 21ms
 ✓ src/db/verification-cleanup.test.ts (10 tests) 19ms
 ✓ src/auth/email-template.test.ts (30 tests) 24ms
 ✓ src/db/pool.test.ts (10 tests) 10ms
 ✓ src/db/schema-contract.test.ts (11 tests) 33ms
 ✓ src/db/migrate-runner.test.ts (9 tests) 14ms
 ✓ src/game/protocol.test.ts (533 tests) 84ms
 ✓ src/auth/password.test.ts (17 tests) 498ms
 ✓ src/auth/session-repository.test.ts (35 tests) 28ms
 ✓ src/game/players.test.ts (13 tests) 13ms
 ✓ src/db/migrate.test.ts (11 tests) 16ms
 ✓ src/observability/shutdown-before-close.test.ts (5 tests) 18ms
 ✓ src/db/schema-bootstrap.test.ts (12 tests) 13ms
 ✓ src/deploy/render-env-cli.test.ts (28 tests) 590ms
 ✓ src/auth/email-cli.test.ts (28 tests) 495ms
 ✓ src/auth/rate-limit.test.ts (19 tests) 8ms
 ✓ src/auth/user-repository.test.ts (40 tests) 33ms
 ✓ src/game/hub.test.ts (212 tests) 441ms
 ✓ src/game/parts.test.ts (19 tests) 19ms
 ✓ src/game/economy.test.ts (20 tests) 19ms
 ✓ src/db/lifecycle-config.test.ts (29 tests) 13ms
 ✓ src/cors.test.ts (20 tests) 336ms
 ✓ src/game/config.test.ts (13 tests) 9ms
 ✓ src/game/cubes.test.ts (24 tests) 12ms
 ✓ src/game/upgrades.test.ts (20 tests) 6ms
 ✓ src/observability/config.test.ts (24 tests) 5ms
 ✓ src/auth/auth-routes.test.ts (40 tests) 1528ms
 ✓ src/auth/auth-service.test.ts (73 tests) 1827ms
 ✓ src/db/schema-contract-postgres.test.ts (4 tests) 2787ms
 ✓ src/db/verification-cleanup-postgres.test.ts (2 tests) 2765ms
 ✓ src/db/migration-006.test.ts (13 tests) 2837ms
 ✓ src/auth/economy-repository.test.ts (124 tests) 2603ms
 ✓ src/app.test.ts (50 tests) 2663ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1114ms
 ✓ src/db/migration-007.test.ts (11 tests) 2652ms
 ✓ src/db/schema-bootstrap-postgres.test.ts (7 tests) 3170ms

 Test Files  52 passed (52)
      Tests  2055 passed (2055)
   Start at  18:29:57
   Duration  4.36s (transform 6.25s, setup 0ms, collect 18.92s, tests 26.61s, environment 13ms, prepare 5.43s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   97.04 |    92.09 |   99.65 |   97.04 |                   
 src               |   97.13 |    92.36 |     100 |   97.13 |                   
  app.ts           |   96.41 |    90.09 |     100 |   96.41 | ...79-380,428-430 
  cors.ts          |     100 |      100 |     100 |     100 |                   
 src/auth          |   96.79 |    86.74 |     100 |   96.79 |                   
  auth-routes.ts   |   84.35 |    61.26 |     100 |   84.35 | ...29-431,437-438 
  auth-service.ts  |     100 |    87.62 |     100 |     100 | ...29,534,551,636 
  config.ts        |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   95.74 |     86.2 |     100 |   95.74 | ...77-778,834-847 
  email-cli.ts     |   98.48 |    88.09 |     100 |   98.48 | 195-196           
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

> test
> vitest run src/auth/email-cli.test.ts


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/auth/email-cli.test.ts (28 tests) 253ms

 Test Files  1 passed (1)
      Tests  28 passed (28)
   Start at  18:30:02
   Duration  548ms (transform 67ms, setup 0ms, collect 97ms, tests 253ms, environment 0ms, prepare 62ms)

T2 VERIFY PASS
```

## Acceptance audit

- AC-3(a) → met: `pins the exact POST request with a display-name sender and the branded template` asserts the exact URL, `POST`, the three headers, the five-key body (`sender`, `to`, `subject`, `htmlContent`, `textContent`), the exact `sender` with `name`, `to` as `[{ email: recipient }]`, the pinned subject, the renderer HTML, the plain-text body and an `AbortSignal`; `omits the sender name for a bare sender and matches the SMTP payload byte-for-byte` pins the absent `name` and sender `{ email }` only; `pins the exported endpoint and 10-second timeout by value` asserts `BREVO_API_TIMEOUT_MS === 10000`.
- AC-3(b) → met: `resolves on HTTP 201 without reading the response body` and the 202 case resolve with a response whose body getter is never read (`bodyReads === 0`).
- AC-3(c) → met: the body is asserted with `Object.keys(...)` exactly `['sender','to','subject','htmlContent','textContent']` and with a full JSON-string equality, so no `attachments`, `replyTo`, `params`, `tags`, `templateId` or `messageVersions` key can exist.
- AC-3(d) → met: the bare-sender test sends the same URL/options through `SmtpEmailService` and asserts the API `subject`, `textContent` and `htmlContent` are byte-identical to the SMTP payload.
- AC-4(a) → met: `maps HTTP 400/401/403/429/500 to the fixed typed failure` assert `name`, `code`, `transport`, `host`, `port`, `errorType`, `transportCode` and `message` with exact values.
- AC-4(b) → met: `maps a TimeoutError to the fixed timeout message with no transport code` pins the exact `Brevo API request timed out after 10000ms`; `uses the configured timeout in the timeout message` pins the derived `2500ms` path.
- AC-4(c) → met: `maps any other rejection without smuggling its provider code` (an `Error` carrying a provider-shaped code) and `reports unknown for a non-Error rejection` both pin the fixed `Brevo API request failed`, the source name/`unknown`, and the absent `transportCode`.
- AC-4(d) → met: `never reads or leaks a provider body and never exposes the API key` feeds a 401 body containing the recipient and synthetic REST-key/SMTP-key-shaped tokens, proves the body is never read (`bodyReads === 0`), and proves none of those values or the configured key appears in any enumerable field or the message.
- AC-4(e) → met: `calls GET /v3/account once with the exact headers and a timeout signal` pins the URL, `GET`, the two headers, the absent body and the `AbortSignal`; `maps a 401 probe rejection without reading the account body` pins `errorType: 'BrevoApiError'`, `transportCode: 'HTTP_401'` and the exact message with `bodyReads === 0`; the probe timeout and generic rejection cases are also pinned. The default seam test (`posts through the default global-fetch seam and reads only ok/status`) proves the global `fetch` path never touches a body.
- AC-9(a) → met: `prints exactly the API success line and no SMTP fields` pins the full line and asserts no `secure=`/`starttls=`/`auth=` text; `sends the branded API request through the real factory and prints the success line` exercises the real config/service/factory path through an injected request seam.
- AC-9(b) → met: `prints exactly the API failure line for a 401 without a key or address` pins the exact line and asserts the key and recipient are absent.
- AC-9(c) → met: `prints exactly the missing-key configuration line and constructs no service` pins the exact AC-1(d) line and `createService` call count `0`.
- AC-9(d) → met: the pre-existing SMTP success, warning, failure, argument and `--help` tests pass unchanged; the usage text and all SMTP argument paths are untouched.
- AC-9(e) → met: `redacts the configured Brevo API key value` pins the configured-value redaction; `redacts the configured API key and the SMTP values from an injected rejection` and `redacts the configured API key from a configuration error` prove the CLI wiring uses the API key alongside the SMTP values, and the pre-existing REST/SMTP-key shape tests remain green.

## Coverage

`npm run coverage --workspace @cubeclicker/backend`: all-files 97.04% statements, 92.09% branches, 99.65% functions, 97.04% lines. `src/auth/email.ts` is 100% on all four metrics; `src/auth/email-cli.ts` is 98.48% statements, 88.09% branches, 100% functions, 98.48% lines (only the executable entry guard lines are uncovered). Thresholds unchanged at 80; no exclusion added.

## Assertions

Concrete expected values only: exact URLs, headers, JSON bodies, messages, status codes, transport codes and full success/failure lines via `toBe`/`toStrictEqual`; the only type-level check is `toBeInstanceOf(AbortSignal)` for the required signal. No wildcard matchers, no snapshot-only or assertion-free tests, no bounded-exception allowance used.

## Deviations from spec

None.
