# Build log — T1 — Transport configuration, sender parsing, and local defaults

Task: T1 (2026-11-26)
Files changed: `src/backend/src/auth/config.ts`, `src/backend/src/auth/config.test.ts`, `compose.yaml`, `compose.smoke.yaml`, `docs/features/brevo-api-email-transport/build-log-T1.md`

## What changed & why

- `config.ts`: added the exported `EmailTransportKind`, `ParsedEmailSender` and `parseEmailSender`, plus `emailTransport` and `brevoApiKey` on `AuthConfig`. `EMAIL_TRANSPORT` unset/empty means `smtp` for every `NODE_ENV`; an explicit `smtp` or `brevo-api` is honored for every `NODE_ENV`; any other value is rejected with the AC-1(e) message.
- `brevo-api` is fail-closed at startup: the key is required (AC-1(d)), `SMTP_FROM` must be explicitly set, parseable and not the local default (AC-1(g)/(h)). The three accepted sender forms are bare, angle-only and `Display Name <address>`.
- `compose.yaml` passes `EMAIL_TRANSPORT` (default `smtp`) and `BREVO_API_KEY` (default empty) through to the backend environment; `compose.smoke.yaml` pins the same two values. No service, image, build, port, volume, `depends_on` or healthcheck change.

## Decisions

- The stored `smtpFrom` stays byte-identical to the input (no trimming), while `parseEmailSender` trims only for parsing/validation — AC-1(i) and AC-2(c).
- Unset `SMTP_FROM` under `brevo-api` throws the existing non-empty message; an empty value takes the same exact path through `readRequiredString`; whitespace-only reaches the parser after trimming and throws the AC-1(g) message. Explicit local-default values (bare, angle-only, display-name) throw the AC-1(h) message.
- Validation order under `brevo-api`: key presence, explicit sender presence, sender parse, local-default check.
- The address shape is deliberately pragmatic (one `@`, non-empty local part/domain, no whitespace or brackets); deliverability stays Brevo's responsibility.
- Testing tier: `config.ts` is a pure parser with no I/O boundary inside T1's file scope, so no new in-process integration test exists for it (documented exception). The existing backend suite's app/server integration tests construct `AuthConfig` through `loadAuthConfig` and all pass, and the compose config evaluation below is the integration evidence for the compose behavior change (AC-10(a)/(c)).

## Evidence

Command (task `verify`, run from the repository root; the shared log guard is applied to this file):

```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend
npm run coverage --workspace @cubeclicker/backend
for v in SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_SECURE SMTP_FROM SMTP_CONNECTION_TIMEOUT_MS EMAIL_TRANSPORT BREVO_API_KEY; do unset "$v"; done
tmp=$(mktemp)
podman compose --env-file /dev/null -f compose.yaml config > "$tmp"
node -e "const fs=require('node:fs');const yaml=require('js-yaml');const c=yaml.load(fs.readFileSync(process.argv[1],'utf8'));const raw=c.services.backend.environment;const e=Array.isArray(raw)?Object.fromEntries(raw.map((x)=>x.split('='))):raw;const got={SMTP_HOST:e.SMTP_HOST,SMTP_PORT:String(e.SMTP_PORT),EMAIL_TRANSPORT:e.EMAIL_TRANSPORT,BREVO_API_KEY:e.BREVO_API_KEY??''};if(got.SMTP_HOST!=='mailpit'||got.SMTP_PORT!=='1025'||got.EMAIL_TRANSPORT!=='smtp'||got.BREVO_API_KEY!=='')throw new Error('local email defaults changed: '+JSON.stringify(got));console.log('compose local: mailpit/1025/smtp/empty-key')" "$tmp"
podman compose --env-file /dev/null -f compose.yaml -f compose.smoke.yaml config > "$tmp"
node -e "const fs=require('node:fs');const yaml=require('js-yaml');const c=yaml.load(fs.readFileSync(process.argv[1],'utf8'));const raw=c.services.backend.environment;const e=Array.isArray(raw)?Object.fromEntries(raw.map((x)=>x.split('='))):raw;const got={SMTP_HOST:e.SMTP_HOST,SMTP_PORT:String(e.SMTP_PORT),EMAIL_TRANSPORT:e.EMAIL_TRANSPORT,BREVO_API_KEY:e.BREVO_API_KEY??''};if(got.SMTP_HOST!=='mailpit'||got.SMTP_PORT!=='1025'||got.EMAIL_TRANSPORT!=='smtp'||got.BREVO_API_KEY!=='')throw new Error('smoke email pin changed: '+JSON.stringify(got));console.log('compose smoke: mailpit/1025/smtp/empty-key')" "$tmp"
node - <<'NODE'
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const yaml=require('js-yaml');
const strip=(text)=>{const c=yaml.load(text);for(const s of Object.values(c.services||{}))delete s.environment;return c;};
const eq=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(label+' changed')};
eq(strip(fs.readFileSync('compose.yaml','utf8')),strip(execFileSync('git',['show','origin/main:compose.yaml'],{encoding:'utf8'})),'compose.yaml');
eq(strip(fs.readFileSync('compose.smoke.yaml','utf8')),strip(execFileSync('git',['show','origin/main:compose.smoke.yaml'],{encoding:'utf8'})),'compose.smoke.yaml');
console.log('compose: services/images/builds/ports/volumes/depends_on/healthchecks/top-level volumes unchanged; only environment values changed');
NODE
log=docs/features/brevo-api-email-transport/build-log-T1.md
test -f "$log"
log_guard="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|verify\?token=|[0-9a-f]{32,}|xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|rnd_[A-Za-z0-9_-]{20,}|(SMTP_(USER|PASS)|BREVO_API_KEY|RENDER_API_KEY)[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9+/_-]{12,}"
! grep -qE "$log_guard" "$log"
```

Result: exit `0` (`T1 VERIFY PASS`). Raw output (terminal colour escapes stripped):

```text

> lint
> eslint .


> typecheck
> tsc --noEmit


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/auth/config.test.ts (61 tests) 20ms
 ✓ src/db/schema-contract.test.ts (11 tests) 14ms
 ✓ src/auth/session-repository.test.ts (35 tests) 16ms
 ✓ src/game/parts.test.ts (19 tests) 11ms
 ✓ src/auth/email-template.test.ts (30 tests) 12ms
 ✓ src/game/broadcast.test.ts (13 tests) 18ms
 ✓ src/observability/db-metrics.test.ts (8 tests) 11ms
 ✓ src/game/activity.test.ts (24 tests) 11ms
 ✓ src/game/leaderboard.test.ts (23 tests) 20ms
 ✓ src/server.test.ts (6 tests) 12ms
 ✓ src/auth/email.test.ts (36 tests) 22ms
 ✓ src/db/startup.test.ts (18 tests) 25ms
 ✓ src/observability/metrics-route.test.ts (3 tests) 148ms
 ✓ src/observability/logging.test.ts (29 tests) 143ms
 ✓ src/game/servers.test.ts (47 tests) 195ms
 ✓ src/game/players.test.ts (13 tests) 10ms
 ✓ src/game/parts-v3.test.ts (63 tests) 228ms
 ✓ src/db/migrate.test.ts (11 tests) 16ms
 ✓ src/observability/metrics.test.ts (37 tests) 16ms
 ✓ src/observability/config.test.ts (24 tests) 10ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 21ms
 ✓ src/game/protocol.test.ts (533 tests) 84ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 16ms
 ✓ src/db/schema-bootstrap.test.ts (12 tests) 14ms
 ✓ src/game/cubes.test.ts (24 tests) 15ms
 ✓ src/game/parts-v2.test.ts (40 tests) 39ms
 ✓ src/deploy/render-env.test.ts (46 tests) 31ms
 ✓ src/auth/password.test.ts (17 tests) 473ms
 ✓ src/db/migrate-runner.test.ts (9 tests) 13ms
 ✓ src/observability/shutdown.test.ts (7 tests) 13ms
 ✓ src/observability/shutdown-before-close.test.ts (5 tests) 9ms
 ✓ src/auth/email-cli.test.ts (21 tests) 538ms
 ✓ src/game/hub.test.ts (212 tests) 419ms
 ✓ src/auth/user-repository.test.ts (40 tests) 25ms
 ✓ src/db/verification-cleanup.test.ts (10 tests) 52ms
 ✓ src/cors.test.ts (20 tests) 299ms
 ✓ src/db/pool.test.ts (10 tests) 17ms
 ✓ src/game/upgrades.test.ts (20 tests) 8ms
 ✓ src/auth/rate-limit.test.ts (19 tests) 12ms
 ✓ src/db/lifecycle-config.test.ts (29 tests) 8ms
 ✓ src/game/config.test.ts (13 tests) 11ms
 ✓ src/game/economy.test.ts (20 tests) 7ms
 ✓ src/deploy/render-env-cli.test.ts (28 tests) 665ms
 ✓ src/auth/auth-routes.test.ts (40 tests) 1483ms
 ✓ src/auth/auth-service.test.ts (73 tests) 1720ms
 ✓ src/app.test.ts (50 tests) 2561ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1106ms
 ✓ src/db/migration-006.test.ts (13 tests) 2768ms
 ✓ src/auth/economy-repository.test.ts (124 tests) 2544ms
 ✓ src/db/migration-007.test.ts (11 tests) 2603ms
 ✓ src/db/schema-contract-postgres.test.ts (4 tests) 3021ms
 ✓ src/db/verification-cleanup-postgres.test.ts (2 tests) 2985ms
 ✓ src/db/schema-bootstrap-postgres.test.ts (7 tests) 3457ms

 Test Files  52 passed (52)
      Tests  2022 passed (2022)
   Start at  18:16:27
   Duration  4.27s (transform 5.36s, setup 0ms, collect 15.14s, tests 26.88s, environment 10ms, prepare 4.90s)


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/auth/user-repository.test.ts (40 tests) 16ms
 ✓ src/db/pool.test.ts (10 tests) 7ms
 ✓ src/game/broadcast.test.ts (13 tests) 13ms
 ✓ src/auth/session-repository.test.ts (35 tests) 20ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 16ms
 ✓ src/game/parts-v2.test.ts (40 tests) 23ms
 ✓ src/deploy/render-env.test.ts (46 tests) 22ms
 ✓ src/db/verification-cleanup.test.ts (10 tests) 19ms
 ✓ src/auth/config.test.ts (61 tests) 14ms
 ✓ src/game/leaderboard.test.ts (23 tests) 18ms
 ✓ src/auth/email.test.ts (36 tests) 19ms
 ✓ src/db/startup.test.ts (18 tests) 31ms
 ✓ src/game/servers.test.ts (47 tests) 162ms
 ✓ src/observability/metrics-route.test.ts (3 tests) 158ms
 ✓ src/game/parts-v3.test.ts (63 tests) 271ms
 ✓ src/observability/logging.test.ts (29 tests) 188ms
 ✓ src/game/cubes.test.ts (24 tests) 13ms
 ✓ src/db/schema-bootstrap.test.ts (12 tests) 12ms
 ✓ src/db/migrate.test.ts (11 tests) 23ms
 ✓ src/auth/password.test.ts (17 tests) 415ms
 ✓ src/observability/metrics.test.ts (37 tests) 30ms
 ✓ src/db/schema-contract.test.ts (11 tests) 17ms
 ✓ src/db/migrate-runner.test.ts (9 tests) 13ms
 ✓ src/observability/shutdown.test.ts (7 tests) 12ms
 ✓ src/auth/email-template.test.ts (30 tests) 12ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 12ms
 ✓ src/game/protocol.test.ts (533 tests) 93ms
 ✓ src/auth/rate-limit.test.ts (19 tests) 18ms
 ✓ src/auth/email-cli.test.ts (21 tests) 455ms
 ✓ src/game/activity.test.ts (24 tests) 26ms
 ✓ src/deploy/render-env-cli.test.ts (28 tests) 590ms
 ✓ src/server.test.ts (6 tests) 15ms
 ✓ src/game/config.test.ts (13 tests) 11ms
 ✓ src/observability/db-metrics.test.ts (8 tests) 22ms
 ✓ src/game/parts.test.ts (19 tests) 15ms
 ✓ src/observability/config.test.ts (24 tests) 9ms
 ✓ src/cors.test.ts (20 tests) 317ms
 ✓ src/game/hub.test.ts (212 tests) 509ms
 ✓ src/game/upgrades.test.ts (20 tests) 10ms
 ✓ src/db/lifecycle-config.test.ts (29 tests) 9ms
 ✓ src/observability/shutdown-before-close.test.ts (5 tests) 14ms
 ✓ src/game/players.test.ts (13 tests) 9ms
 ✓ src/game/economy.test.ts (20 tests) 9ms
 ✓ src/auth/auth-routes.test.ts (40 tests) 1506ms
 ✓ src/auth/auth-service.test.ts (73 tests) 1804ms
 ✓ src/app.test.ts (50 tests) 2614ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1100ms
 ✓ src/db/migration-006.test.ts (13 tests) 3062ms
 ✓ src/db/verification-cleanup-postgres.test.ts (2 tests) 3141ms
 ✓ src/db/migration-007.test.ts (11 tests) 2877ms
 ✓ src/db/schema-contract-postgres.test.ts (4 tests) 3208ms
 ✓ src/auth/economy-repository.test.ts (124 tests) 3000ms
 ✓ src/db/schema-bootstrap-postgres.test.ts (7 tests) 3359ms

 Test Files  52 passed (52)
      Tests  2022 passed (2022)
   Start at  18:16:31
   Duration  4.43s (transform 4.60s, setup 0ms, collect 16.21s, tests 28.26s, environment 12ms, prepare 5.69s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.98 |    91.98 |   99.64 |   96.98 |                   
 src               |   97.13 |    92.36 |     100 |   97.13 |                   
  app.ts           |   96.41 |    90.09 |     100 |   96.41 | ...79-380,428-430 
  cors.ts          |     100 |      100 |     100 |     100 |                   
 src/auth          |    96.6 |    86.21 |     100 |    96.6 |                   
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
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

compose local: mailpit/1025/smtp/empty-key
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

compose smoke: mailpit/1025/smtp/empty-key
compose: services/images/builds/ports/volumes/depends_on/healthchecks/top-level volumes unchanged; only environment values changed
T1 VERIFY PASS
```

Final re-run of the same verify block against the final tree (log evidence embedded), exit `0`:

```text
compose local: mailpit/1025/smtp/empty-key
compose smoke: mailpit/1025/smtp/empty-key
compose: services/images/builds/ports/volumes/depends_on/healthchecks/top-level volumes unchanged; only environment values changed
T1 VERIFY PASS
```

## Acceptance audit

- AC-1(a) → met: `AuthConfig` exposes `emailTransport: EmailTransportKind` (`'smtp' | 'brevo-api'`) and `brevoApiKey: string | null`; the `selects brevo-api with a key and a bare sender` and `defaults to smtp` tests assert both values.
- AC-1(b) → met: unset and empty `EMAIL_TRANSPORT` return `smtp` for `development`, `test` and `production` (test `defaults to smtp when unset or empty for every NODE_ENV`).
- AC-1(c) → met: explicit `smtp` is accepted for every `NODE_ENV`, including `production` (test `honors an explicit smtp in every NODE_ENV`); no startup path rejects it.
- AC-1(d) → met: absent and empty keys throw exactly `BREVO_API_KEY must be a non-empty string when EMAIL_TRANSPORT=brevo-api`.
- AC-1(e) → met: `mailgun` and `SMTP` throw exactly `EMAIL_TRANSPORT must be "smtp" or "brevo-api"; received "<value>"`.
- AC-1(f) → met: `smtp` with a set key is accepted and the key is carried; every pre-existing SMTP parse test is unchanged and the whole backend suite passes (52 files, 2022 tests).
- AC-1(g) → met: bare, angle-only and display-name senders are accepted; invalid non-whitespace values throw the exact parse message; unset and empty throw the existing non-empty message before parsing; whitespace-only throws the parse message after trimming.
- AC-1(h) → met: bare, angle-only and display-name forms of the local default throw exactly `SMTP_FROM must be a Brevo-verified sender when EMAIL_TRANSPORT=brevo-api; the local default is not deliverable`.
- AC-1(i) → met: `brevo-api` with a valid key returns `emailTransport: 'brevo-api'`, the exact input key, and an untrimmed `smtpFrom` (padded input preserved).
- AC-2(a) → met: `parseEmailSender` returns `{ name: 'CubeClicker', email: <fixture> }` for the display-name form.
- AC-2(b) → met: bare and angle-only forms return `{ email: <fixture> }`; `toStrictEqual` pins the absence of a `name` property.
- AC-2(c) → met: surrounding whitespace around the whole value and around the display name is trimmed.
- AC-2(d) → met: `null` for `CubeClicker <not-an-address>`, `not an address`, `''`, whitespace-only, two bracket pairs, no-`@` values, an empty local part, an unclosed bracket and a stray `>`.
- AC-2(e) → met: `parseEmailSender` is exported and `loadAuthConfig` uses it for the AC-1(g)/(h) decisions (brevo sender contract tests).
- AC-10(a) → met: with all email variables unset, the merged compose config resolves `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `EMAIL_TRANSPORT=smtp`, empty `BREVO_API_KEY`; the smoke override pins the same four (raw output above).
- AC-10(c) → met: the parsed top-level comparison against `origin/main` shows services, images/builds, ports, volumes, `depends_on`, healthchecks and top-level volumes unchanged; only `environment` values differ (raw output above).

## Coverage

`npm run coverage --workspace @cubeclicker/backend`: all-files 96.98% statements, 91.98% branches, 99.64% functions, 96.98% lines; `src/auth/config.ts` 100% on all four metrics. Thresholds unchanged at 80.

## Assertions

Concrete expected values only: exact strings for every error, `toBe`/`toStrictEqual` for parsed objects, `toBeNull` for the parser negatives. No wildcard matchers, no snapshot-only or assertion-free tests, no bounded-exception allowance used.

## Deviations from spec

None. The AC-1(g) "unset `SMTP_FROM`" clause is implemented as the existing non-empty error for `brevo-api` (unset is distinguished from the explicit local-default forms, which throw AC-1(h)).
