# Build log — T2 — Typed email delivery errors and transport `verify()`

Task: T2 (2026-11-24)
Files changed: `src/backend/src/auth/email.ts`, `src/backend/src/auth/email.test.ts`, `docs/features/registration-account-exists/build-log-T2.md`

## What changed & why
- `EmailDeliveryError` (constructor `(source, host, port)`) pins `name: 'EmailDeliveryError'`, `code: 'verification_email_failed'`, `transport: 'smtp'`, the configured `host`/`port`, `errorType` = the source error name or `'unknown'`, and `transportCode` only when the source `code` matches `/^[A-Z0-9_]{1,40}$/`.
- `message` is the **source message verbatim** (D-4): `Error.message` unchanged, non-`Error` rejections stringified; no wrapper text, so `email-cli.test.ts` and `redactSecrets` keep their accepted lines.
- `EmailTransport.verify?()` and `EmailService.verify?()` are optional; `SmtpEmailService` stores the configured `host`/`port`, wraps `sendMail` and `verify()` rejections in `EmailDeliveryError`, and resolves without calling anything when the transport has no `verify`.
- `FakeEmailService` gains `verifyCalls` and a one-shot `failNextVerify` (rejects the next probe, clears itself, then resolves).
- Tests cover every AC-2 clause: typed fields + verbatim message, provider-code whitelist table, non-`Error` sources, no secret in any enumerable field except `message`, real-factory wrapping, verify delegation/wrapping/absence, fake counters, and a cross-module operator-CLI check with the real `SmtpEmailService`.

## Decisions
- `errorType` uses the real `Error.name` only (default `'Error'`, custom names preserved); any non-`Error` rejection reports `'unknown'`, matching AC-2(a).
- `transportCode` is assigned only when whitelisted; otherwise the field is `undefined`, so T4 can omit it from the warn event with a simple presence check.
- `SmtpEmailService.verify()` reads `this.transport.verify` and invokes it with `.call(this.transport)` so nodemailer's method keeps its owner; the optional check happens before any call and returns early.
- `failNextVerify` is one-shot (the name says "next"): T5's probe tests can inject exactly one failed probe, then observe the platform recovering on the next probe.
- Integration tier: `email-cli.test.ts` is untouched and still passes byte-for-byte (including its real `tsx` process-entry tests) — that is AC-2(d)'s explicit proof. Additionally `email.test.ts` exercises the real `runEmailTestCli` + real `SmtpEmailService` + a rejecting transport and asserts the exact redacted failure line, proving the verbatim message survives the wrapper. The unchanged backend suites (`auth-routes.test.ts`, `app.test.ts`) consume the `EmailService` interface through `app.inject`.

## Evidence

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

 ✓ src/auth/email.test.ts (36 tests) 21ms
 ✓ src/auth/email-cli.test.ts (21 tests) 468ms
 Test Files  52 passed (52)
      Tests  1967 passed (1967)
   Start at  18:55:15
   Duration  4.12s (transform 5.68s, setup 0ms, collect 16.52s, tests 25.69s, environment 11ms, prepare 4.58s)

exit 0
```

### `npm run coverage --workspace @cubeclicker/backend`
```
$ npm run coverage --workspace @cubeclicker/backend

> coverage
> vitest run --coverage

 Test Files  52 passed (52)
      Tests  1967 passed (1967)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.86 |    91.41 |   99.63 |   96.86 |
 src/auth          |   96.26 |    84.17 |     100 |   96.26 |
  email-cli.ts     |    98.3 |    86.11 |     100 |   98.3 | 176-177
  email.ts         |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------

exit 0 — aggregate 96.86 statements / 91.41 branches / 99.63 functions / 96.86 lines, all ≥ 80 thresholds. The changed module `email.ts` is 100% on all four metrics (the `email-cli.ts` 176–177 remainder is the pre-existing `import.meta.url === pathToFileURL(...)` process-entrypoint guard).
```

### Focused AC-2 run (new cases, `email.test.ts`)
```
$ npx --no-install vitest run src/auth/email.test.ts --reporter=verbose

 ✓ operator CLI integration (AC-2(d)) > prints the redacted exact failure line through the real SmtpEmailService wrapper
 ✓ FakeEmailService > records verifyCalls and resolves by default
 ✓ FakeEmailService > rejects once with the injected failNextVerify and then clears it
 ✓ SmtpEmailService > wraps transport failures in EmailDeliveryError with the verbatim source message
 ✓ SmtpEmailService > reports the configured host and port when send fails through createSmtpEmailService
 ✓ SmtpEmailService > keeps credentials and token shapes out of every enumerable field except message (AC-2(b))
 ✓ SmtpEmailService.verify (AC-2(c)) > delegates to the transport verify exactly once and resolves
 ✓ SmtpEmailService.verify (AC-2(c)) > wraps a verify rejection in EmailDeliveryError with the configured host and port
 ✓ SmtpEmailService.verify (AC-2(c)) > resolves without calling anything when the transport has no verify
 ✓ EmailDeliveryError (AC-2) > pins the typed fields and preserves the source message verbatim
 ✓ EmailDeliveryError (AC-2) > uses the source error name as errorType
 ✓ EmailDeliveryError (AC-2) > reports unknown errorType and a stringified message for non-Error rejections
 ✓ EmailDeliveryError (AC-2) > keeps 'uppercase acronym' transport codes only when provider-shaped
 ✓ EmailDeliveryError (AC-2) > keeps 'underscore' transport codes only when provider-shaped
 ✓ EmailDeliveryError (AC-2) > keeps '40 characters' transport codes only when provider-shaped
 ✓ EmailDeliveryError (AC-2) > keeps 'lowercase' transport codes only when provider-shaped
 ✓ EmailDeliveryError (AC-2) > keeps 'hyphen' transport codes only when provider-shaped
 ✓ EmailDeliveryError (AC-2) > keeps 'trailing space' transport codes only when provider-shaped
 ✓ EmailDeliveryError (AC-2) > keeps '41 characters' transport codes only when provider-shaped
 ✓ EmailDeliveryError (AC-2) > keeps 'non-string' transport codes only when provider-shaped
 ✓ EmailDeliveryError (AC-2) > keeps 'absent' transport codes only when provider-shaped

 Test Files  1 passed (1)
      Tests  36 passed (36)
```

### `npm test --workspace @cubeclicker/backend -- src/auth/email-cli.test.ts`
```
$ npm test --workspace @cubeclicker/backend -- src/auth/email-cli.test.ts

> test
> vitest run src/auth/email-cli.test.ts

 ✓ src/auth/email-cli.test.ts (21 tests) 263ms

 Test Files  1 passed (1)
      Tests  21 passed (21)
   Start at  18:55:24
   Duration  575ms (transform 67ms, setup 0ms, collect 105ms, tests 263ms, environment 0ms, prepare 47ms)

exit 0 — the suite is byte-for-byte unchanged (`git status` lists only `email.ts` and `email.test.ts` as modified).
```

### Full T2 verify block (verbatim re-run)
Executed exactly the block from `tasks.md` T2 § verify (lint → backend typecheck → backend tests → backend coverage → focused `email-cli.test.ts` → build-log existence → credential guard) as one `bash` script under `set -euo pipefail`:
```
$ <T2 verify block>
...
T2 VERIFY BLOCK: ALL COMMANDS EXITED 0
BLOCK_EXIT=0
```
The `test -f` and `! grep` guards print nothing on success; a match would have aborted the script before the marker.

## Acceptance audit
- AC-2(a) → met: `SmtpEmailService.sendVerification` and `.verify()` rejections are wrapped; tests assert `instanceof EmailDeliveryError` plus exact `name`, `code: 'verification_email_failed'`, `transport: 'smtp'`, configured `host`/`port` (Brevo 587 and 2525 fixtures), `errorType: 'Error'`/custom name, whitelisted `transportCode`, and `message` equal to the untouched source string.
- AC-2(b) → met: the rejection message embeds the configured SMTP login, key and a 64-character token; the test asserts each field individually and filters `Object.entries(error)` to enumerable strings other than `message`, expecting an empty intersection for all three secrets.
- AC-2(c) → met: both interfaces expose optional `verify`; the delegate test asserts one call and a resolved value, the wrapping test asserts the typed rejection, the absent-`verify` test resolves with zero transport calls, and `FakeEmailService` tests assert `verifyCalls` 0 → 2 and the one-shot `failNextVerify` rejection followed by success.
- AC-2(d) → met: `email-cli.test.ts` was not edited and all 21 of its tests pass, including the exact success/failure lines and the `tsx` process-entry tests; the added cross-module test proves the real wrapper still feeds `redactSecrets` the verbatim message.
- Testing bar → met: unit tests exercise the module in isolation with injected transports/factories; integration coverage is the unchanged CLI suite (real process boundary) plus the cross-module CLI + real-service test; assertions are concrete (`toStrictEqual`, exact strings/numbers, `toBe`, `toHaveBeenCalledTimes`); no banned wildcard matcher, no snapshot, no assertion-free test; coverage gate green with no exclusions or threshold changes.

## Deviations from spec
- None. `email-cli.ts` and `email-cli.test.ts` are untouched; only the three owned paths changed.
