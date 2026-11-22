# Build log — T6 — Add the test-email CLI, redaction and scripts

Task: T6 (2026-11-22)
Files changed: `src/backend/src/auth/email-cli.ts`, `src/backend/src/auth/email-cli.test.ts`, `src/backend/package.json`, `docs/features/brevo-smtp-email-delivery/build-log-T6.md`

## What changed & why
- Added `runEmailTestCli(argv, env, deps?)` (`src/backend/src/auth/email-cli.ts`): parses `--to <address>`/`--help`, loads the same `loadAuthConfig`, builds the service through the same `createSmtpEmailService` composition path, and sends exactly one message rendered by the branded `renderVerificationEmail` with the synthetic `http://localhost:5173/verify?token=cli-test` link (AC-8).
- Argument validation happens before any configuration read, so `--help`, an unknown option, a missing `--to` and an invalid address never construct a service/transport; each failure prints its pinned line plus the usage and returns `1` (AC-9).
- Added `redactSecrets(text, secretValues)`: replaces every occurrence of each configured `SMTP_USER`/`SMTP_PASS` value and every REST-key/SMTP-key shaped token with `[redacted]`. It is applied to the `Invalid email configuration:` line (using the raw env values, so it also works when parsing failed) and to the `Failed to send test email via <host>:<port>:` line (AC-9).
- Added the executable entry (the `import.meta.url` guard, mirroring `db/migrate-cli.ts`) so both `tsx src/auth/email-cli.ts` and `node dist/auth/email-cli.js` run, plus the `email:test` and `email:test:dist` scripts in `src/backend/package.json`.
- Added `src/backend/src/auth/email-cli.test.ts`: exact usage/exit code per branch, the exact AC-8 Brevo line, the default-`SMTP_FROM` warning, the Mailpit/465 lines, the config-error lines, the AC-9 rejection line with both credential values plus the REST-key-shaped token, the short SMTP-key-shaped token, direct `redactSecrets` cases, and a real-process test of the script entry.

## Decisions
- **Success line format follows the T6 brief/AC: `starttls=required|off`.** The plan's placeholder table writes `starttls=<required|opportunistic>`; no AC pins the non-Brevo value, and the T6 brief pins `required|off`. Implemented: `required` exactly when the built transport would set `requireTLS` (`!secure && auth`), else `off`. `secure` is the parsed `smtpSecure`, `auth=yes` exactly when both `SMTP_USER` and `SMTP_PASS` are set.
- **Warning placement:** the success line is printed first, then the default-`SMTP_FROM` warning, matching the plan table's row order. The warning is emitted whenever the effective `smtpFrom` equals `no-reply@cubeclicker.local` (unset *or* explicitly set to it), and never for a custom/verified sender.
- **Streams:** `--help` usage, the success line and the warning go to `log` (stdout); error lines and the usage echoed after them go to `logError` (stderr) — the `email-cli.test.ts` assertions pin both arrays exactly.
- **Invalid address also prints the usage.** AC-9 pins only the `Invalid recipient address: "<value>"` line; the plan's CLI table adds `+ usage`, so the test pins `[message, usage]`. Unknown/missing/dangling `--to` likewise print the same usage.
- **Recipient validation reuses the registration rule** `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` from `auth-service.ts` instead of introducing a second address notion.
- **Redaction order:** literal configured values first, then the two key patterns. Empty/null/undefined secret values are skipped so an empty value cannot match between characters. Both key patterns are exactly the spec's: `xkeysib-[A-Za-z0-9]{20,}` and `xsmtpsib-[A-Za-z0-9]{15,}`.
- **Tests never construct a real transport for the success path:** the success unit test injects a recording service; a second test injects a factory that delegates to the real `createSmtpEmailService(config, () => transport)` so the CLI→service→template→`sendMail` payload is asserted end to end with no network. Fixture credentials are written in object/colon form only.
- **Integration tier:** the CLI has no HTTP/WebSocket boundary, so its real boundary is the process entry. Two `spawnSync(process.execPath, ['--import', 'tsx', <email-cli.ts>, ...])` tests run the actual script entry and assert exact stdout/stderr and exit codes (`--help` → 0, unknown option → 1); this is the only place the module guard executes and it proves the default writers work.
- **No dependencies added:** `tsx` was already a backend devDependency (`^4`, resolved 4.23.15) and is reused by `email:test`; `email:test:dist` runs the existing `tsc` output.

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
 ✓ src/auth/email-cli.test.ts (21 tests) 436ms
 ...
 Test Files  40 passed (40)
      Tests  1773 passed (1773)
   Start at  12:10:57
   Duration  3.43s (transform 5.74s, setup 0ms, collect 14.04s, tests 14.57s, environment 7ms, prepare 3.12s)
test exit=0
```

### `npm run coverage --workspace @cubeclicker/backend`
```
$ npm run coverage --workspace @cubeclicker/backend
 Test Files  40 passed (40)
      Tests  1773 passed (1773)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.59 |    90.54 |    99.6 |   96.59 |
 src/auth          |   96.17 |    83.69 |     100 |   96.17 |
  email-cli.ts     |    98.3 |    80.55 |     100 |    98.3 | 176-177
  email.ts         |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
coverage exit=0 (thresholds 80/80/80/80 met; uncovered 176-177 is the executable-entry body, exercised by the subprocess tests and by the manual dist run below)
```

### `npm run email:test --workspace @cubeclicker/backend -- --help`
```
$ npm run email:test --workspace @cubeclicker/backend -- --help

> email:test
> tsx src/auth/email-cli.ts --help

Usage: npm run email:test -- --to <address>
       node dist/auth/email-cli.js --to <address>

Sends one test message rendered with the CubeClicker verification template
through the configured SMTP settings. Credentials are never printed.

Options:
  --to <address>  Recipient of the test message (required)
  --help          Show this help and exit
email:test --help exit=0
```

### Dist entry proof (`node dist/auth/email-cli.js`)
```
$ npm run build --workspace @cubeclicker/backend
> build
> tsc
build exit=0

$ node src/backend/dist/auth/email-cli.js --help
Usage: npm run email:test -- --to <address>
       node dist/auth/email-cli.js --to <address>
...
node dist/auth/email-cli.js --help exit=0

$ npm run email:test:dist --workspace @cubeclicker/backend -- --help
> email:test:dist
> node dist/auth/email-cli.js --help
...
email:test:dist --help exit=0
```

### `test -f docs/features/brevo-smtp-email-delivery/build-log-T6.md`
```
$ test -f docs/features/brevo-smtp-email-delivery/build-log-T6.md
exit 0
```

### Build-log credential guard (tasks.md T6, verbatim)
```
$ ! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}" docs/features/brevo-smtp-email-delivery/build-log-T6.md
exit 0 (no match, no output)
```

### Scope check
```
$ git status --short -- src/backend/src/auth/email-cli.ts src/backend/src/auth/email-cli.test.ts src/backend/package.json src/backend/src/auth/email.ts src/backend/src/auth/email-template.ts src/backend/src/app.ts
 M src/backend/package.json
?? src/backend/src/auth/email-cli.test.ts
?? src/backend/src/auth/email-cli.ts
```
Only the three owned code paths changed; `email.ts`, `email-template.ts`, `app.ts`, compose/Render and docs are untouched.

## Acceptance audit
- **AC-8 → met.** `email-cli.test.ts` § `runEmailTestCli successful send (AC-8)`:
  - `runEmailTestCli(['--to', 'user@example.com'], brevoEnv, { createService })` returns `0`, calls `createService` once, calls `sendVerification` exactly once with `('user@example.com', 'http://localhost:5173/verify?token=cli-test')` (two arguments, so the template's 24-hour default expiry applies) and writes exactly `Test email sent to user@example.com via smtp-relay.brevo.com:587 (secure=false, starttls=required, auth=yes, from="no-reply@example.com")`; the same test asserts the printed text contains neither the SMTP user nor the SMTP pass fixture.
  - The real-service test asserts `sendMail` was called once with exactly `{ from, to, subject: 'Verify your CubeClicker email', text: <unchanged plain text>, html: renderVerificationEmail('http://localhost:5173/verify?token=cli-test').html }` and that the HTML carries `token=cli-test`.
  - With Mailpit defaults the output is exactly `Test email sent to user@example.com via mailpit:1025 (secure=false, starttls=off, auth=no, from="no-reply@cubeclicker.local")` followed by `Warning: SMTP_FROM is the local default; set it to a verified sender before real delivery.`; the warning also appears when `SMTP_FROM` is explicitly set to the default, and never appears for `SMTP_FROM=no-reply@example.com`.
- **AC-9 → met.** `email-cli.test.ts` § usage/argument/config/rejection suites:
  - `--help` → exactly the usage string, exit `0`, service not constructed.
  - Missing `--to` and a dangling `--to` → exactly `Missing required option: --to <address>` + usage, exit `1`, service not constructed.
  - `--recipient` (unknown) and a valid `--to` followed by `--verbose` → exactly `Unknown option: <option>` + usage, exit `1`, service not constructed and `sendVerification` not called.
  - `--to not-an-address` → exactly `Invalid recipient address: "not-an-address"` + usage, exit `1`, service not constructed.
  - Config error (`SMTP_SECURE=yes`) → exactly `Invalid email configuration: SMTP_SECURE must be a boolean ("true", "false", "1", or "0"); received "yes"`, exit `1`, service not constructed; a config error whose message echoes the SMTP-pass fixture prints `[redacted]` instead and the output contains no credential.
  - Transport rejection carrying both credential values plus `'xkeysib-' + 'a'.repeat(24)` → exactly `Failed to send test email via smtp-relay.brevo.com:587: 535 authentication failed for [redacted] ([redacted]) with [redacted]`, exit `1`, output contains neither credential value nor the token.
  - A second rejection carrying `'xsmtpsib-' + 'b'.repeat(15)` → exactly `Failed to send test email via smtp-relay.brevo.com:587: relay rejected [redacted]`, exit `1`, token absent from output.
  - `redactSecrets` unit cases: every occurrence of every configured value replaced; null/undefined/empty values ignored; both key patterns redacted at/above their pinned lengths; tokens one character below the pinned lengths left untouched.
- **Not claimed here (owned by other tasks).** The README documentation of the CLI and live-delivery procedure is T8 (AC-13/AC-14); the hostile-env smoke and full credential audits are T9.

## Deviations from spec
- The plan's CLI table writes `starttls=<required|opportunistic>`; the T6 brief pins `starttls=required|off` and no AC pins the non-Brevo value, so the implementation prints `off` when STARTTLS is not required (see Decisions). Everything else follows the plan interfaces (`EmailTestCliDeps`, `redactSecrets` signature, exit-code contract, synthetic URL).
