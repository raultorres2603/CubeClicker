# Build log — T5 — Non-blocking startup transport probe

Task: T5 (2026-11-24)
Files changed: `src/backend/src/app.ts`, `src/backend/src/app.test.ts`, `docs/features/registration-account-exists/build-log-T5.md`

## What changed & why
- `buildApp` now registers one `onReady` hook (after the email service is constructed) that is gated on both `authConfig.smtpUser` and `authConfig.smtpPass` being non-null: the local Mailpit path never probes.
- When the service exposes `verify`, the hook starts it, attaches `.then`/`.catch`, and returns immediately (the hook's body returns `undefined`, so Fastify never awaits the probe). `listen` and `GET /healthz` are untouched: a probe that never settles cannot delay or fail readiness.
- Outcomes are the three pinned events: `smtp_transport_verify_ok` (info, `{host, port}`), `smtp_transport_verify_failed` (warn, `{errorType, transportCode?, host, port}`) and `smtp_transport_verify_skipped` (debug, `{reason: 'no_credentials' | 'unsupported'}`).
- `smtpProbeFailureFields` builds the failed event from names/configuration only: a typed `EmailDeliveryError` contributes its source `errorType`, its whitelisted `transportCode` and the configured `host`/`port`; any other rejection contributes its `Error.name` (or `'unknown'` for a non-`Error`) and this app's configured `host`/`port`. The rejection message, stack, SMTP user and SMTP key are never copied.
- Tests add an 8-case `SMTP startup probe (T5, AC-8)` block using the existing logger-stream capture helpers: never-settling probe + `/healthz` + one call per app, the exact levels/fields of ok/failed/skipped, both skip reasons, and no message/credential in the captured text.

## Decisions
- **Gate order:** credentials first (`no_credentials`), then `verify` presence (`unsupported`). This follows the plan: an unauthenticated path is skipped regardless of whether the service could probe.
- **Non-blocking start:** the hook calls `void verify.call(emailService).then(...).catch(...)`; the `.catch` handles the rejection (no unhandled rejection) and the discarded promise is never awaited by Fastify. A never-settling promise therefore leaves readiness and `/healthz` unaffected.
- **Failure fields:** `EmailDeliveryError` is the production shape (`SmtpEmailService.verify()` wraps transport rejections); the plain-`Error` and non-`Error` branches cover injected/fake services, so the probe cannot throw while formatting a log line and never leaks the source text.
- **No adjacent changes:** `/healthz`, `server.ts`, the hub and the DB startup phase are untouched. The hook is registered on the root instance, so `startServer`'s pre-`listen` database phase keeps its existing order.
- **Tests:** concrete assertions only (`toBe(30)`/`toBe(40)`/`toBe(20)`, exact `host`/`port`, exact `reason`, `toHaveLength(1)`, `'transportCode' in entry === false`); no wildcard matchers, no snapshots, no assertion-free tests. The integration tier is real Fastify boot via `app.inject`/`app.ready()` with the real logger pipeline writing to a capture stream.

## Evidence
Captured by the verbatim T5 verify block below plus one focused probe run.

### Focused AC-8 run (new cases only)
```
$ npx --no-install vitest run src/app.test.ts -t 'SMTP startup probe' --reporter=verbose

 ✓ src/app.test.ts > SMTP startup probe (T5, AC-8) > serves /healthz while a never-settling verify() is pending and probes once per app (AC-8(a)) 74ms
 ✓ src/app.test.ts > SMTP startup probe (T5, AC-8) > logs exactly one info smtp_transport_verify_ok with host and port (AC-8(b)) 13ms
 ✓ src/app.test.ts > SMTP startup probe (T5, AC-8) > logs exactly one warn smtp_transport_verify_failed with fields only and catches the rejection (AC-8(c)) 5ms
 ✓ src/app.test.ts > SMTP startup probe (T5, AC-8) > reports a plain rejection with the configured host/port and no transportCode (AC-8(c)) 4ms
 ✓ src/app.test.ts > SMTP startup probe (T5, AC-8) > omits transportCode for a typed rejection without a provider code (AC-8(c)) 4ms
 ✓ src/app.test.ts > SMTP startup probe (T5, AC-8) > reports an unknown errorType for a non-Error rejection (AC-8(c)) 4ms
 ✓ src/app.test.ts > SMTP startup probe (T5, AC-8) > logs one debug smtp_transport_verify_skipped with no_credentials and never probes without a credential pair (AC-8(d)) 5ms
 ✓ src/app.test.ts > SMTP startup probe (T5, AC-8) > logs one debug smtp_transport_verify_skipped with unsupported when the service has no verify (AC-8(d)) 5ms

 Test Files  1 passed (1)
      Tests  8 passed | 42 skipped (50)
```

### Verbatim T5 verify block (`tasks.md` T5 § verify)
Executed exactly the block from `tasks.md` T5 (lint → backend typecheck → backend tests → backend coverage → build-log existence → credential guard) as one script under `set -euo pipefail`, after this log existed:
```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend
npm run coverage --workspace @cubeclicker/backend
test -f docs/features/registration-account-exists/build-log-T5.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/registration-account-exists/build-log-T5.md
```
```
$ bash /tmp/opencode/t5-verify.sh
> lint
> eslint .

> typecheck
> tsc --noEmit

> test
> vitest run

 RUN  v3.2.7 /…/src/backend

 ✓ src/auth/session-repository.test.ts (35 tests) 18ms
 ✓ src/auth/email.test.ts (36 tests) 21ms
 …
 ✓ src/auth/auth-routes.test.ts (40 tests) 1558ms
 ✓ src/auth/auth-service.test.ts (73 tests) 1827ms
 ✓ src/app.test.ts (50 tests) 2612ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1105ms

 Test Files  52 passed (52)
      Tests  2004 passed (2004)
   Start at  19:22:27
   Duration  3.82s (transform 5.26s, setup 0ms, collect 16.23s, tests 24.76s, environment 9ms, prepare 4.31s)

> coverage
> vitest run --coverage

 RUN  v3.2.7 /…/src/backend
      Coverage enabled with v8

 ✓ src/app.test.ts (50 tests) 2740ms
 …

 Test Files  52 passed (52)
      Tests  2004 passed (2004)
   Start at  19:22:32
   Duration  4.37s (transform 4.60s, setup 0ms, collect 15.84s, tests 27.42s, environment 12ms, prepare 5.74s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.96 |    91.88 |   99.64 |   96.96 |                   
 src               |   97.13 |    92.36 |     100 |   97.13 |                   
  app.ts           |   96.41 |    90.09 |     100 |   96.41 | ...79-380,428-430 
  cors.ts          |     100 |      100 |     100 |     100 |                   
 [remaining per-file rows omitted only for length; the subset above already shows both
  the aggregate gate and the changed file]
-------------------|---------|----------|---------|---------|-------------------
```
`BLOCK_EXIT=0` — all four metrics are ≥ 80 (96.96 statements / 91.88 branches / 99.64 functions / 96.96 lines); `app.ts` itself is 96.41 / 90.09 / 100 / 96.41. The `test -f` and `! grep` guards print nothing on success; the credential guard printed no match. The full capture (198 lines) was reviewed; a per-file V8 statement/branch dump confirms the uncovered `app.ts` lines are the pre-existing `parseCookieHeader` branches (143–148), the unused `FakeEmailService` default (253) and two pre-existing WS branches (379–380, 428–430) — every line and branch of the new `smtpProbeFailureFields` helper (158–175) and `onReady` hook (255–285) executes, including both failure-field shapes and both skip reasons.

## Acceptance audit
- AC-8(a) → met: the hook is registered on `onReady` and gated on both `smtpUser` and `smtpPass`; the never-settling test boots through `app.inject` twice, then `ready()`, and still gets `200 {"status":"ok"}` with `verify` called exactly once.
- AC-8(b) → met: the resolved probe yields exactly one `info` (level 30) `smtp_transport_verify_ok` with `host: 'smtp-relay.brevo.com'`, `port: 587`, and no failed/skipped event.
- AC-8(c) → met: the typed rejection yields exactly one `warn` (level 40) `smtp_transport_verify_failed` with `errorType: 'Error'`, `transportCode: 'ETIMEDOUT'`, `host`, `port`; the entry has no `err`/`stack`, and the captured text contains neither the rejection message nor the synthetic SMTP user/key. Plain-`Error` and non-`Error` rejections are asserted with `errorType: 'Error'`/`'unknown'` and no `transportCode`.
- AC-8(d) → met: no credential pair logs one `debug` (level 20) `smtp_transport_verify_skipped` with `reason: 'no_credentials'` and calls `verify` zero times; a service without `verify` logs one `debug` event with `reason: 'unsupported'`. Neither changes `/healthz` (both assert 200 `{"status":"ok"}` afterwards).
- AC-8(e) → met: the probe is fire-and-forget and caught; `/healthz` is the unchanged `{ status: 'ok' }` route, and no close/exit path was added.

## Deviations from spec
- None. Only the three owned paths changed; `/healthz`, `server.ts`, the hub and the DB startup phase are untouched.
