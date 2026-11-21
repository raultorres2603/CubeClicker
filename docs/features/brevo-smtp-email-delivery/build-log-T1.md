# Build log — T1 — Add SMTP TLS mode, timeout and credential-pair validation

Task: T1 (2026-11-22)
Files changed: `src/backend/src/auth/config.ts`, `src/backend/src/auth/config.test.ts`, `docs/features/brevo-smtp-email-delivery/build-log-T1.md`

## What changed & why
- `AuthConfig` gains `smtpSecure` (explicit `SMTP_SECURE`, otherwise derived as `smtpPort === 465`) and `smtpConnectionTimeoutMs` (`SMTP_CONNECTION_TIMEOUT_MS`, default `10000`, range `1000..120000` via the existing integer parser).
- `loadAuthConfig` validates the both-or-neither credential rule right after reading `SMTP_USER`/`SMTP_PASS`: exactly one non-empty value throws the pinned pairing error before any transport is built.
- Boolean parsing was split into `parseBoolean`/`readBoolean`/`readOptionalBoolean` so `SMTP_SECURE` can treat absent/empty as "derive" while `SESSION_COOKIE_SECURE` keeps its existing absent-only fallback and empty-string rejection (no default or validation change for existing settings).
- Pinned constants added: `DEFAULT_SMTP_CONNECTION_TIMEOUT_MS = 10_000`, `MIN_SMTP_CONNECTION_TIMEOUT_MS = 1_000`, `MAX_SMTP_CONNECTION_TIMEOUT_MS = 120_000`.
- `config.test.ts` pins Mailpit defaults (`smtpSecure: false`, `smtpConnectionTimeoutMs: 10000` inside the full `DEFAULT_CONFIG` equality), both secure derivations, all four explicit boolean forms, empty-as-unset, the invalid boolean, both timeout boundaries, `999`/`120001`/non-integer/empty rejections and every credential-pairing combination — all with exact values/messages.

## Decisions
- Explicit `true`/`1`/`false`/`0` are matched case-sensitively, consistent with `SESSION_COOKIE_SECURE`; `TRUE` is rejected (pinned in the test).
- `SMTP_CONNECTION_TIMEOUT_MS=''` is rejected (the existing `readInteger` contract), as AC-3 requires.
- Pairing is enforced before `SMTP_FROM`/timeout parsing so a half-configured credential fails with the pairing message; the pre-existing "first invalid variable" ordering for `SMTP_PORT` is unchanged.
- `readOptionalBoolean` only treats `undefined`/`''` as unset; `SESSION_COOKIE_SECURE=''` still throws exactly as before (no regression of an existing setting).
- No integration tier for this task: `config.ts` is pure environment parsing with no I/O or framework boundary. AC-3's `buildApp` propagation half is explicitly T4 (owns `app.test.ts`); the `loadAuthConfig` half is covered here (see AC audit). Documented exception, per skill § Testing bar.
- No new dependency, no changes to existing defaults, `app.ts`/`email.ts`/`auth-service.ts` untouched.

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

 ✓ src/auth/config.test.ts (43 tests) 19ms
 ... (37 further test files, all passed)

 Test Files  38 passed (38)
      Tests  1708 passed (1708)
   Start at  00:11:32
   Duration  3.64s (transform 7.26s, setup 0ms, collect 15.29s, tests 14.43s, environment 7ms, prepare 2.99s)
exit 0
```

Focused run of the changed suite (`npx vitest run src/auth/config.test.ts --reporter=verbose`, cwd `src/backend`; 14 new tests, 29 pre-existing):
```
 ✓ src/auth/config.test.ts > SMTP_SECURE > derives false for the default Mailpit port 0ms
 ✓ src/auth/config.test.ts > SMTP_SECURE > derives true for port 465 0ms
 ✓ src/auth/config.test.ts > SMTP_SECURE > treats an empty SMTP_SECURE as unset and keeps the port derivation 0ms
 ✓ src/auth/config.test.ts > SMTP_SECURE > accepts explicit true/1 and false/0 overrides regardless of port 0ms
 ✓ src/auth/config.test.ts > SMTP_SECURE > rejects values other than true/false/1/0 naming the variable 0ms
 ✓ src/auth/config.test.ts > SMTP_CONNECTION_TIMEOUT_MS > defaults to 10000 0ms
 ✓ src/auth/config.test.ts > SMTP_CONNECTION_TIMEOUT_MS > accepts the 1000 and 120000 boundaries and a mid-range override 0ms
 ✓ src/auth/config.test.ts > SMTP_CONNECTION_TIMEOUT_MS > rejects 999 and 120001 naming the variable and the value 0ms
 ✓ src/auth/config.test.ts > SMTP_CONNECTION_TIMEOUT_MS > rejects non-integer and empty values 0ms
 ✓ src/auth/config.test.ts > SMTP credential pairing > accepts both credentials 0ms
 ✓ src/auth/config.test.ts > SMTP credential pairing > accepts both credentials absent or both empty 0ms
 ✓ src/auth/config.test.ts > SMTP credential pairing > rejects SMTP_USER without SMTP_PASS 0ms
 ✓ src/auth/config.test.ts > SMTP credential pairing > rejects SMTP_PASS without SMTP_USER 0ms
 ✓ src/auth/config.test.ts > SMTP credential pairing > rejects a pair where the other credential is empty 0ms
 ✓ src/auth/config.test.ts > pinned constants > pins every default constant 0ms
 ✓ src/auth/config.test.ts > loadAuthConfig defaults > returns the pinned defaults for an empty environment 0ms
 ... (28 remaining pre-existing tests passed)

 Test Files  1 passed (1)
      Tests  43 passed (43)
   Duration  266ms
exit 0
```

### `npm run coverage --workspace @cubeclicker/backend`
```
$ npm run coverage --workspace @cubeclicker/backend
> coverage
> vitest run --coverage

 Test Files  38 passed (38)
      Tests  1708 passed (1708)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.48 |    90.52 |   99.59 |   96.48 |
 src               |   96.78 |    90.56 |     100 |   96.78 |
  app.ts           |   95.85 |    86.84 |     100 |   95.85 | ...18-319,367-369
  cors.ts          |     100 |      100 |     100 |     100 |
 src/auth          |    95.8 |    83.27 |     100 |    95.8 |
  auth-routes.ts   |    80.7 |    54.19 |     100 |    80.7 | ...61-363,369-370
  auth-service.ts  |     100 |    81.75 |     100 |     100 | ...95,400,417,503
  config.ts        |     100 |      100 |     100 |     100 |
  ...repository.ts |   95.74 |     86.2 |     100 |   95.74 | ...77-778,834-847
  email.ts         |     100 |      100 |     100 |     100 |
  password.ts      |     100 |      100 |     100 |     100 |
  rate-limit.ts    |     100 |      100 |     100 |     100 |
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 | ...40-141,146-147
  ...repository.ts |    98.8 |    90.58 |     100 |    98.8 | 61-62,315
  ...repository.ts |   97.29 |    91.57 |     100 |   97.29 | 63-68
 src/db            |   98.02 |    93.75 |     100 |   98.02 |
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 | 82-83
  ...ate-runner.ts |    97.1 |       96 |     100 |    97.1 | 107-108
  migrate.ts       |     100 |      100 |     100 |     100 |
  pool.ts          |     100 |      100 |     100 |     100 |
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
 src/observability |   99.67 |     96.5 |     100 |   99.67 |
  config.ts        |     100 |      100 |     100 |     100 |
  db-metrics.ts    |     100 |      100 |     100 |     100 |
  logging.ts       |     100 |      100 |     100 |     100 |
  metrics-route.ts |     100 |      100 |     100 |     100 |
  metrics.ts       |   99.45 |    93.54 |     100 |   99.45 | 251-252
  shutdown.ts      |     100 |    92.85 |     100 |     57
-------------------|---------|----------|---------|---------|-------------------
exit 0 — thresholds 80/80/80/80 met (aggregate 96.48 / 90.52 / 99.59 / 96.48); changed file `src/auth/config.ts` is 100 / 100 / 100 / 100
```

### `test -f docs/features/brevo-smtp-email-delivery/build-log-T1.md`
```
$ test -f docs/features/brevo-smtp-email-delivery/build-log-T1.md
exit 0
```

### Build-log credential guard (tasks.md T1, verbatim)
```
$ ! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}" docs/features/brevo-smtp-email-delivery/build-log-T1.md
exit 0 (no match, no output)
```
Test fixtures appear only in object/colon form with short values (for example `SMTP_USER: 'smtp-login'`, `SMTP_PASS: 'smtp-key'`), never in `NAME=` assignment form, so the guard cannot trip on test data.

## Acceptance audit
- **AC-1 → met.** `smtpSecure` is derived (`port === 465`) when `SMTP_SECURE` is absent/empty and overridden by `true|1|false|0`; evidence: `SMTP_SECURE` tests + `DEFAULT_CONFIG.smtpSecure: false` equality for the empty environment.
- **AC-2 → met.** `smtpConnectionTimeoutMs` defaults to `10000`, accepts `1000` and `120000`, rejects `999`, `120001`, `10000.5`, `abc`, `''`; evidence: `SMTP_CONNECTION_TIMEOUT_MS` tests.
- **AC-3 → met for the `loadAuthConfig` half.** Exact messages for `SMTP_SECURE="yes"` and the timeout cases are pinned. The `buildApp` propagation half is T4 (owns `app.test.ts`) and is intentionally not claimed here.
- **AC-4 → met.** Exactly one credential throws `SMTP_USER and SMTP_PASS must be provided together (both or neither)`; both-set and both-absent/empty accepted; evidence: `SMTP credential pairing` tests.
- **AC-6 → met for the config half.** Empty environment returns `smtpHost: 'mailpit'`, `smtpPort: 1025`, `smtpSecure: false`, `smtpUser: null`, `smtpPass: null`, `smtpFrom: 'no-reply@cubeclicker.local'`, `smtpConnectionTimeoutMs: 10000` via the full-object equality test. The transport half is T4.

## Deviations from spec
None. Scope stayed inside `files_owned`; `app.test.ts`, `email.ts`, `app.ts`, `auth-service.ts`, compose files and docs outside this build log were not touched.
