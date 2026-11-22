# Build log — T4 — Transport options, factory seam and template wiring

Task: T4 (2026-11-22)
Files changed: `src/backend/src/auth/email.ts`, `src/backend/src/auth/email.test.ts`, `src/backend/src/app.ts`, `src/backend/src/app.test.ts`, `docs/features/brevo-smtp-email-delivery/build-log-T4.md`

## What changed & why
- `email.ts` now owns the exact `nodemailer` connection object: `buildSmtpTransportOptions` pins `secure` (explicit, else port 465), `requireTLS` (only when credentials exist and implicit TLS is off), one `connectionTimeout`/`greetingTimeout`/`socketTimeout` value from `SMTP_CONNECTION_TIMEOUT_MS` (default 10000) and an `auth` property that exists only when both `user` and `pass` are non-empty. AC-5/AC-6.
- `createSmtpEmailService(config, transportFactory?)` is the single composition path: it maps the `AuthConfig` SMTP subset onto the service options and constructs `SmtpEmailService`, which calls the injected factory exactly once (default: one lazy `nodemailer.createTransport`). The old inline mapping in `app.ts` is gone.
- `email.ts` re-exports `VERIFICATION_EMAIL_SUBJECT` and `renderVerificationEmail` from `email-template.ts`, so every existing import keeps working while the branded template renders the HTML. `sendVerification(to, url, { expiresInMs })` forwards the TTL to the template; the subject/plain-text body are the T3 strings (byte-for-byte unchanged).
- `FakeEmailService` records the TTL as `expiresInMs` (required field, `undefined` = 24-hour default) so T5 can assert `verificationTokenTtlMs` propagation.
- `app.ts` gains the `BuildAppOptions.auth.emailTransportFactory` seam and builds email through `createSmtpEmailService(authConfig, options.auth?.emailTransportFactory)`; every other default and precedence (`options.auth.email` first, `FakeEmailService` when `smtpHost` is empty) is preserved.
- Tests: `email.test.ts` replaces the moved-out template tests with exact transport-object pins (Brevo 587, 465 explicit, 465 derived, 465 explicit `secure:false`, Mailpit no-auth, 2500 ms override, single-credential cases), factory-once assertions, the exact `{ from, to, subject, text, html }` send payload and TTL propagation. `app.test.ts` adds the AC-3 composition-root fail-fast errors and the factory seam (one exact call, no send at construction) plus a registration that sends through the factory transport with the branded HTML.

## Decisions
- **`SmtpEmailService`'s second argument is now a `SmtpTransportFactory`, not an `EmailTransport`.** That keeps the transport options derived in exactly one place (`buildSmtpTransportOptions`) and lets `createSmtpEmailService` call the injected factory once without a second mapping. The only call sites were `app.ts` and `email.test.ts` (both owned here).
- **`auth` is attached conditionally (`...(auth === null ? {} : { auth })`)**, so the Mailpit default object has no `auth` property at all, exactly as AC-5/AC-6 pin; `toStrictEqual` plus `Object.hasOwn` assert the absence.
- **Credential fixtures stay object/colon form** (`smtpUser`/`smtpPass`/`SMTP_USER:`/`SMTP_PASS:`), never `SMTP_PASS=…` assignment form, so the credential guard cannot match test data and no key-shaped literal exists anywhere.
- **AC-3 tests assert the exact thrown message** (`thrownMessage` helper captures the error and compares with `toBe`), not a substring match, so a wording drift fails.
- **Registration-through-factory integration test** proves the composition root really uses the injected transport and the branded template, deriving the expected HTML from the URL embedded in the sent plain text (random token, exact equality otherwise).

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
 ✓ src/auth/email.test.ts (16 tests) 17ms
 ✓ src/app.test.ts (42 tests) 2500ms
 ...
 Test Files  39 passed (39)
      Tests  1746 passed (1746)
   Start at  11:59:02
   Duration  3.45s (transform 3.78s, setup 0ms, collect 12.15s, tests 14.22s, environment 7ms, prepare 4.08s)
test exit=0
```

Targeted run while iterating:
```
$ npm test --workspace @cubeclicker/backend -- --run src/auth/email.test.ts src/app.test.ts
 ✓ src/auth/email.test.ts (16 tests) 6ms
 ✓ src/app.test.ts (42 tests) 2372ms
 Test Files  2 passed (2)
      Tests  58 passed (58)
```

### `npm run coverage --workspace @cubeclicker/backend`
```
$ npm run coverage --workspace @cubeclicker/backend
 Test Files  39 passed (39)
      Tests  1746 passed (1746)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
All files          |   96.53 |    90.64 |    99.6 |   96.53 |
 src               |   96.72 |    91.45 |     100 |   96.72 |
  app.ts           |   95.74 |     88.5 |     100 |   95.74 |
 src/auth          |   95.98 |    83.67 |     100 |   95.98 |
  ...l-template.ts |     100 |      100 |     100 |     100 |
  email.ts         |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|
coverage exit=0 (thresholds 80/80/80/80 met)
```

### `test -f docs/features/brevo-smtp-email-delivery/build-log-T4.md`
```
$ test -f docs/features/brevo-smtp-email-delivery/build-log-T4.md
exit 0
```

### Build-log credential guard (tasks.md T4, verbatim)
```
$ ! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}" docs/features/brevo-smtp-email-delivery/build-log-T4.md
exit 0 (no match, no output)
```

### Scope check
```
$ git status --short -- src/backend/src/auth/email.ts src/backend/src/auth/email.test.ts src/backend/src/app.ts src/backend/src/app.test.ts docs/features/brevo-smtp-email-delivery/build-log-T4.md
 M src/backend/src/app.test.ts
 M src/backend/src/app.ts
 M src/backend/src/auth/email.test.ts
 M src/backend/src/auth/email.ts
?? docs/features/brevo-smtp-email-delivery/build-log-T4.md

$ git diff --check
exit 0
```
Only the five `files_owned` paths changed; `auth-service.ts`, the CLI, compose/Render/README/docs and the freshly moved-out `email-template.*` files are untouched.

## Acceptance audit
- **AC-3 → met (buildApp half).** `buildApp({ SMTP_SECURE: 'yes' })` throws exactly `SMTP_SECURE must be a boolean ("true", "false", "1", or "0"); received "yes"`, and `buildApp({ SMTP_CONNECTION_TIMEOUT_MS: '120001' })` throws exactly `SMTP_CONNECTION_TIMEOUT_MS must be an integer between 1000 and 120000; received "120001"` — both before `listen` (the call throws synchronously). Evidence: `app.test.ts` § `SMTP composition root (T4)`, first two tests. The `loadAuthConfig` half is T1's `config.test.ts`.
- **AC-5 → met.** `buildSmtpTransportOptions` returns the exact Brevo 587 object (`secure:false`, `requireTLS:true`, `auth`, all three timeouts 10000), the 465 object (`secure:true`, `requireTLS:false`) and the Mailpit object with no `auth` property; a 2500 ms override lands in all three timeout fields. `createSmtpEmailService` calls the injected factory exactly once with the built object, and `buildApp` builds through it via the `options.auth.emailTransportFactory` seam (exact call asserted in `app.test.ts`). Evidence: `email.test.ts` transport/factory tests; `app.test.ts` factory-seam and registration tests.
- **AC-6 → met (email half).** Mailpit defaults build `{ host:'mailpit', port:1025, secure:false, requireTLS:false, connectionTimeout:10000, greetingTimeout:10000, socketTimeout:10000 }` and `Object.hasOwn(options, 'auth') === false`; the config half is T1. Evidence: `buildSmtpTransportOptions` Mailpit test.
- **AC-7 → met (email half).** The plain-text body and subject are the unchanged T3 strings (pinned exactly as `PLAIN_TEXT`/`Verify your CubeClicker email`); `SMTP_FROM='CubeClicker <no-reply@example.com>'` is passed verbatim as `sendMail.from`; the `sendMail` argument is exactly `{ from, to, subject, text, html }` with no `replyTo`/`attachments` (`toStrictEqual` in the registration test, `toHaveBeenCalledWith` in the unit tests); the TTL reaches the template (`This link expires in 1 hour.`). The HTML template itself is T3's `email-template.test.ts`.
- **Not claimed here (owned by other tasks).** AC-1/AC-2/AC-4 are T1; AC-19(b) auth-service TTL propagation is T5; the CLI (AC-8/AC-9) is T6; compose/Render (AC-11, AC-12) is T7; docs (AC-13/AC-14/AC-20) is T8; the full gate is T9.

## Deviations from spec
None. One documented interface change: `SmtpEmailService`'s optional second constructor argument is a transport *factory* rather than a ready transport (see Decisions); `createSmtpEmailService` remains the pinned public composition path.
