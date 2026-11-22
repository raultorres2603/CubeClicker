# Build log — T4 — CI guard fixture checks

Task: T4 (2026-11-22)
Files changed: `.github/workflows/ci.yml`, `docs/features/deploy-brevo-env-placeholders/build-log-T4.md`

## Sketch

- Add two credential-free steps at the end of `verify-workflows`, after the existing config checks.
- `Guard rejects placeholder values`: step-level `env:` with the pinned production placeholder fixture; run the exact CLI `--check-only`, require a non-zero exit, and assert the AC-4(a) header line.
- `Guard accepts a complete value set`: step-level `env:` with the pinned development complete fixture; run the same CLI, assert exit 0 and the AC-4(b) line by exact-line grep.
- Fixtures stay in YAML mapping form (`SMTP_PASS: '…'`) and every credential-bearing value is an angle-bracket placeholder or shorter than 12 characters, so the repository credential guard cannot match them.
- No reordering or modification of `verify-app`, `smoke-e2e`, or the existing workflow-check steps.

## What changed & why

`verify-workflows` now proves AC-8 without credentials: the placeholder fixture must fail closed with the AC-4(a) header, and the complete fixture must pass with the AC-4(b) line. The `run` blocks contain the real CLI invocation and the asserted output string, so a tautological `echo` step cannot satisfy them.

Diff is additive only (45 insertions, 0 deletions); the two new steps are the last two in the job, after `Check deploy workflow has no Fly deploy path`. `verify-app` and `smoke-e2e` are untouched.

## Decisions

- Both steps run the exact `npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only` invocation (2 occurrences in the file), so the T4 invocation-count grep is meaningful.
- The reject step captures stdout, prints it for the run log (names only; the guard block never prints a configured value), requires a non-zero exit, then exact-line greps the header. A guard that unexpectedly exits 0 fails the step with a distinct message.
- The accept step captures stdout, prints it, and exact-line greps the success line; `set -euo pipefail` makes a CLI failure or a missing line fail the step.
- Fixture values are quoted YAML strings so numeric/boolean scalars (`587`, `false`, `10000`) reach the process as text; env values are step-level mappings, never `NAME=value` strings.
- No new action/SHA, no dependency, no permission/trigger change, no real value, no `.env*` edit.
- Testing tiers: no production source changed, so no Vitest unit test is added; the behavior change is the CI workflow itself, proven at the integration boundary by executing both `run` bodies hermetically and by the two process-level CLI fixtures, plus `actionlint` for the pipeline artifact.

## Evidence

### 1. actionlint over `ci.yml`

```
$ podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml
[exit=0; no output]
```

### 2. `ci.yml` content greps and exact counts (T4 verify)

```
$ grep -q 'Guard rejects placeholder values' .github/workflows/ci.yml
[exit=0]
$ grep -q 'Guard accepts a complete value set' .github/workflows/ci.yml
[exit=0]
$ grep -q 'npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only' .github/workflows/ci.yml
[exit=0]
$ grep -q "Deploy blocked: the 'production' environment has 5 unset or placeholder value(s)." .github/workflows/ci.yml
[exit=0]
$ grep -q "Deploy configuration OK: 9 value(s) present for the 'development' environment." .github/workflows/ci.yml
[exit=0]
$ test "$(grep -c 'npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only' .github/workflows/ci.yml)" -eq 2
count=2
[exit=0]
$ test "$(grep -c "Deploy blocked: the 'production' environment has 5 unset or placeholder value(s)." .github/workflows/ci.yml)" -eq 1
count=1
[exit=0]
$ test "$(grep -c "Deploy configuration OK: 9 value(s) present for the 'development' environment." .github/workflows/ci.yml)" -eq 1
count=1
[exit=0]
```

### 3. Local reproduction of the two fixture invocations (T4 verify)

Reject fixture — expected non-zero (1) and the AC-4(a) header:

```
$ code=0; env TARGET_ENVIRONMENT=production RENDER_SERVICE_ID='<CHANGEME-render-service-id>' RENDER_API_KEY='<CHANGEME-render-api-key>' SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='<CHANGEME-verified-sender>' SMTP_USER='<CHANGEME-smtp-login>' SMTP_PASS='<CHANGEME-smtp-key>' npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only || code=$?; test "$code" -eq 1
Deploy blocked: the 'production' environment has 5 unset or placeholder value(s).
  Placeholder: SMTP_FROM, SMTP_USER, SMTP_PASS, RENDER_SERVICE_ID, RENDER_API_KEY
Remediation (names only; never paste a value into a command argument):
  variables: gh variable set <NAME> --env production --repo raultorres2603/CubeClicker
  secrets:   gh secret set <NAME> --env production --repo raultorres2603/CubeClicker
Runbook: README.md § Deployment Brevo runbook
EXIT=1
assert exit-code-1: [exit=0]
```

Accept fixture — expected exit 0 and the AC-4(b) line:

```
$ env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='CubeClicker <no-reply@example.com>' SMTP_USER=fixture SMTP_PASS=fixture npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only | grep -qx "Deploy configuration OK: 9 value(s) present for the 'development' environment."
accept-fixture grep: [exit=0]
```

### 4. The actual workflow step bodies, executed hermetically

The `run` blocks were parsed out of `ci.yml` with `js-yaml`, given exactly their step-level `env:` mapping, and executed with an otherwise empty environment (`env -i PATH… HOME…`), so the step logic—not just the fixture commands—is proven:

```
$ env -i PATH="$PATH" HOME="$HOME" bash /tmp/opencode/Guard-rejects-placeholder-values.sh
Deploy blocked: the 'production' environment has 5 unset or placeholder value(s).
  Placeholder: SMTP_FROM, SMTP_USER, SMTP_PASS, RENDER_SERVICE_ID, RENDER_API_KEY
Remediation (names only; never paste a value into a command argument):
  variables: gh variable set <NAME> --env production --repo raultorres2603/CubeClicker
  secrets:   gh secret set <NAME> --env production --repo raultorres2603/CubeClicker
Runbook: README.md § Deployment Brevo runbook
[step exit=0]

$ env -i PATH="$PATH" HOME="$HOME" bash /tmp/opencode/Guard-accepts-a-complete-value-set.sh
Deploy configuration OK: 9 value(s) present for the 'development' environment.
[step exit=0]
```

Negative control — the reject step body fed the complete fixture must fail (proves the assertion can fail on a real regression):

```
$ env -i PATH="$PATH" HOME="$HOME" bash /tmp/opencode/negative-control.sh
Deploy configuration OK: 9 value(s) present for the 'development' environment.
The placeholder fixture must be rejected, but the guard exited 0.
[step exit=1]
```

### 5. Backend coverage gate (T4 verify)

```
$ npm run coverage --workspace @cubeclicker/backend
 ✓ src/deploy/render-env.test.ts (32 tests) 23ms
 ✓ src/deploy/render-env-cli.test.ts (21 tests) 457ms
 Test Files  42 passed (42)
      Tests  1826 passed (1826)
All files          |   96.64 |     90.8 |   99.61 |   96.64 |
 src/deploy        |   98.09 |    98.75 |     100 |   98.09 |
  render-env.ts    |     100 |      100 |     100 |     100 |
  ...er-env-cli.ts |      95 |    96.15 |     100 |      95 | 160-164
[exit=0]
```

### 6. Fixture hygiene audit

- Credential-bearing fixtures are all angle-bracket placeholders or shorter than 12 characters: `RENDER_SERVICE_ID` = `<CHANGEME-render-service-id>` / `srv-fixture` (11), `RENDER_API_KEY` = `<CHANGEME-render-api-key>` / `fixture-key` (11), `SMTP_FROM` = `<CHANGEME-verified-sender>` / `CubeClicker <no-reply@example.com>`, `SMTP_USER` = `<CHANGEME-smtp-login>` / `fixture` (7), `SMTP_PASS` = `<CHANGEME-smtp-key>` / `fixture` (7).
- The remaining values are the spec-pinned non-secret constants: `smtp-relay.brevo.com`, `587`, `false`, `10000`.
- Every fixture is a YAML `env:` mapping (`SMTP_PASS: '…'`), never an `NAME=value` string; the extended repository credential guard's `SMTP_(USER|PASS)=` and `RENDER_API_KEY=` patterns cannot match the file.

## Final verify pass

```
Deploy blocked: the 'production' environment has 5 unset or placeholder value(s).
  Placeholder: SMTP_FROM, SMTP_USER, SMTP_PASS, RENDER_SERVICE_ID, RENDER_API_KEY
Remediation (names only; never paste a value into a command argument):
  variables: gh variable set <NAME> --env production --repo raultorres2603/CubeClicker
  secrets:   gh secret set <NAME> --env production --repo raultorres2603/CubeClicker
Runbook: README.md § Deployment Brevo runbook

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/deploy/render-env.test.ts (32 tests) 15ms
 ✓ src/auth/rate-limit.test.ts (19 tests) 7ms
 ✓ src/db/migrate.test.ts (11 tests) 15ms
 ✓ src/game/broadcast.test.ts (13 tests) 15ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 19ms
 ✓ src/game/parts-v2.test.ts (40 tests) 22ms
 ✓ src/auth/session-repository.test.ts (35 tests) 22ms
 ✓ src/observability/db-metrics.test.ts (8 tests) 11ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 13ms
 ✓ src/db/migrate-runner.test.ts (14 tests) 12ms
 ✓ src/game/players.test.ts (13 tests) 13ms
 ✓ src/auth/email-template.test.ts (30 tests) 14ms
 ✓ src/game/activity.test.ts (24 tests) 17ms
 ✓ src/game/leaderboard.test.ts (23 tests) 22ms
 ✓ src/observability/metrics.test.ts (37 tests) 15ms
 ✓ src/game/servers.test.ts (47 tests) 128ms
 ✓ src/observability/metrics-route.test.ts (3 tests) 132ms
 ✓ src/observability/logging.test.ts (28 tests) 170ms
 ✓ src/game/parts-v3.test.ts (63 tests) 244ms
 ✓ src/game/upgrades.test.ts (20 tests) 10ms
 ✓ src/game/cubes.test.ts (24 tests) 13ms
 ✓ src/auth/user-repository.test.ts (40 tests) 21ms
 ✓ src/observability/shutdown.test.ts (7 tests) 10ms
 ✓ src/game/protocol.test.ts (533 tests) 82ms
 ✓ src/game/config.test.ts (13 tests) 13ms
 ✓ src/auth/email.test.ts (16 tests) 14ms
 ✓ src/game/parts.test.ts (19 tests) 9ms
 ✓ src/observability/config.test.ts (24 tests) 8ms
 ✓ src/auth/config.test.ts (43 tests) 19ms
 ✓ src/db/pool.test.ts (10 tests) 8ms
 ✓ src/game/economy.test.ts (20 tests) 6ms
 ✓ src/deploy/render-env-cli.test.ts (21 tests) 466ms
 ✓ src/auth/password.test.ts (17 tests) 427ms
 ✓ src/auth/email-cli.test.ts (21 tests) 438ms
 ✓ src/cors.test.ts (20 tests) 287ms
 ✓ src/game/hub.test.ts (212 tests) 434ms
 ✓ src/auth/auth-service.test.ts (55 tests) 1071ms
 ✓ src/auth/auth-routes.test.ts (29 tests) 1048ms
 ✓ src/app.test.ts (42 tests) 2553ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1115ms
 ✓ src/auth/economy-repository.test.ts (124 tests) 2496ms
 ✓ src/db/migration-006.test.ts (13 tests) 2820ms
 ✓ src/db/migration-007.test.ts (11 tests) 2753ms

 Test Files  42 passed (42)
      Tests  1826 passed (1826)
   Start at  19:24:09
   Duration  3.93s (transform 5.02s, setup 0ms, collect 13.66s, tests 15.91s, environment 9ms, prepare 4.24s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.64 |    90.81 |   99.61 |   96.64 |                   
 src               |   96.72 |    91.45 |     100 |   96.72 |                   
  app.ts           |   95.74 |     88.5 |     100 |   95.74 | ...18-319,367-369 
  cors.ts          |     100 |      100 |     100 |     100 |                   
 src/auth          |   96.17 |    83.69 |     100 |   96.17 |                   
  auth-routes.ts   |    81.4 |     55.3 |     100 |    81.4 | ...61-363,369-370 
  auth-service.ts  |     100 |    81.87 |     100 |     100 | ...97,402,419,507 
  config.ts        |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   95.74 |     86.2 |     100 |   95.74 | ...77-778,834-847 
  email-cli.ts     |    98.3 |    80.55 |     100 |    98.3 | 176-177           
  ...l-template.ts |     100 |      100 |     100 |     100 |                   
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
 src/deploy        |   98.09 |    98.75 |     100 |   98.09 |                   
  ...er-env-cli.ts |      95 |    96.15 |     100 |      95 | 160-164           
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
 src/observability |   99.67 |     96.5 |     100 |   99.67 |                   
  config.ts        |     100 |      100 |     100 |     100 |                   
  db-metrics.ts    |     100 |      100 |     100 |     100 |                   
  logging.ts       |     100 |      100 |     100 |     100 |                   
  metrics-route.ts |     100 |      100 |     100 |     100 |                   
  metrics.ts       |   99.45 |    93.54 |     100 |   99.45 | 251-252           
  shutdown.ts      |     100 |    92.85 |     100 |     100 | 57                
-------------------|---------|----------|---------|---------|-------------------
FINAL_VERIFY_EXIT=0
```

Post-append re-check of the two file-level checks: `test -f` exit=0, credential guard exit=0.

## Acceptance audit

AC-8 → met: two credential-free `verify-workflows` steps run the exact CLI with fixture environments and no network; the placeholder fixture exits 1 with the AC-4(a) header, the complete fixture exits 0 with the AC-4(b) line; each `run` block contains the real invocation and the asserted output string (invocation count 2, expected-string counts 1/1); fixtures are mapping-form values that the credential guard cannot match; `actionlint` passes. Evidence in § 1–4 and the final pass below.

## Deviations from spec

none
