# Build log — T2 — Render env CLI (`--check-only` / `--dry-run` / sync)

Task: T2 (2026-11-22)
Files changed: `src/backend/src/deploy/render-env-cli.ts`, `src/backend/src/deploy/render-env-cli.test.ts`, `docs/features/deploy-brevo-env-placeholders/build-log-T2.md`

## What changed & why

- Added `src/backend/src/deploy/render-env-cli.ts` with `runRenderEnvCli(argv, env, { fetchImpl, log }): Promise<number>`: flag parsing (`--help`, `--check-only`, `--dry-run`, unknown option), nine-name validation through `validateDeployEnv`, and the three modes from the plan's CLI contract.
- `--check-only` validates all nine names and prints either the exact AC-4(a) guard block (exit `1`) or `Deploy configuration OK: 9 value(s) present for the '<env>' environment.` (exit `0`); it never touches the injected fetch.
- `--dry-run` validates all nine, prints one `DRY RUN: would set <KEY> (PUT <url>)` line per `SMTP_CATALOG` key (seven), then the exact AC-6 summary; exit `0` and no network.
- Default mode validates all nine, projects the seven `SMTP_CATALOG` keys into `SmtpValues` (`buildSmtpValues`, driven by the catalog so the wiring names cannot reach a body), calls `syncRenderEnv` with the validated service id, API key and `TARGET_ENVIRONMENT` label, and returns `1` unless all seven writes were verified.
- The bottom guard mirrors `db/migrate-cli.ts`: `process.argv[1] !== undefined` before `pathToFileURL`, then `process.argv.slice(2)`, `process.env`, the real `fetch`, `console.log`, and `process.exitCode`.
- `src/backend/src/deploy/render-env-cli.test.ts` adds 21 tests: 17 in-process branches with an injected fetch/logger and 4 process-level integration runs of the real script (`--import tsx`, hermetic env, no inherited `SMTP_*`/`TARGET_ENVIRONMENT`).

## Decisions

- `--help` is checked first (mirrors `email-cli.ts`) so it never reads the environment and never validates. The unknown-option path also runs before validation, so both argument errors are credential-free.
- When both mode flags are passed, `--check-only` wins: it is the read-only mode, so an accidental double flag can never trigger a sync. Pinned by a test.
- `TARGET_ENVIRONMENT` absent or blank falls back to `unknown` (spec: default `unknown`); the label is only used in header/success/summary text.
- The fetch seam is wrapped once per request with `AbortSignal.timeout(RENDER_REQUEST_TIMEOUT_MS)` (10 000 ms), so each `PUT` has its own budget and `--check-only`/`--dry-run` never schedule a timer.
- Exit code in default mode is decided by `synced.length === SMTP_CATALOG.length`: `syncRenderEnv` stops on the first failure without a summary, so a short result is the only signal needed.
- The guard passes `console.log` directly as the line writer, keeping the module-level branch thin and leaving only the entrypoint statements uncovered by in-process tests (the true branch is proven by the process-level tests and the shell fixtures).
- No documentation edits: the CLI contract is already pinned in the feature spec/plan, T6 owns `README.md` and the architecture docs, and this task changes no runtime (non-CLI) behavior.
- No dependency added; no network in any test; no `.env*`, workflow, compose, `app.ts`, `render-env.ts` or `render.yaml` change.

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
 ✓ src/deploy/render-env-cli.test.ts (21 tests) 489ms
 ...
 Test Files  42 passed (42)
      Tests  1826 passed (1826)
   Start at  19:14:17
   Duration  3.74s (transform 5.16s, setup 0ms, collect 14.64s, tests 15.81s, environment 8ms, prepare 3.57s)
```

Focused run of the changed suite (`npx vitest run src/deploy/render-env-cli.test.ts --reporter=verbose`, cwd `src/backend`):

```
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli flags (AC-4(c)) > prints exactly the usage for --help and returns 0 without a fetch 2ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli flags (AC-4(c)) > rejects an unknown option with the pinned line plus usage and exit 1 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli flags (AC-4(c)) > rejects an unknown option that follows a known flag before validating 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli flags (AC-4(c)) > prefers --check-only over --dry-run when both are passed 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli --check-only (AC-4) > prints the exact success line for the complete development fixture 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli --check-only (AC-4) > prints the exact AC-4(a) production placeholder block and exits 1 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli --check-only (AC-4) > labels an absent TARGET_ENVIRONMENT as unknown and lists all nine names 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli --check-only (AC-4) > prints Missing before Placeholder and treats a blank target environment as unknown 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli --dry-run (AC-6) > lists the seven writes in catalog order and prints the summary without a fetch 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli --dry-run (AC-6) > fails the guard before printing any DRY RUN line when a value is a placeholder 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli default sync mode (AC-5) > validates nine, then sends exactly the seven SMTP PUTs in order and exits 0 1ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli default sync mode (AC-5) > keeps both wiring names out of every request body and URL credential 1ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli default sync mode (AC-5) > returns 1 and stops after the failing key on a non-2xx response 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli default sync mode (AC-5) > returns 1 when the stored value differs from the sent value 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli default sync mode (AC-5) > returns 1 with the pinned timeout line when a request aborts 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli default sync mode (AC-5) > fails the guard without a network call before syncing placeholders 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli default sync mode (AC-5) > labels the sync summary as unknown when TARGET_ENVIRONMENT is absent 0ms
 ✓ src/deploy/render-env-cli.test.ts > integration through the process boundary (AC-4/AC-6) > prints exactly the usage with exit 0 through the real entrypoint 67ms
 ✓ src/deploy/render-env-cli.test.ts > integration through the process boundary (AC-4/AC-6) > exits 1 with the exact AC-4(a) block for the production placeholder fixture 64ms
 ✓ src/deploy/render-env-cli.test.ts > integration through the process boundary (AC-4/AC-6) > exits 0 with the exact AC-4(b) line for the complete development fixture 69ms
 ✓ src/deploy/render-env-cli.test.ts > integration through the process boundary (AC-4/AC-6) > exits 0 with the exact dry-run lines and summary for the complete fixture 76ms

 Test Files  1 passed (1)
      Tests  21 passed (21)
   Duration  551ms (transform 45ms, setup 0ms, collect 46ms, tests 284ms, environment 0ms, prepare 55ms)
```

The four integration tests spawn `process.execPath --import tsx <render-env-cli.ts>` with a child environment stripped of `TARGET_ENVIRONMENT` and the nine catalog names, then assert `status`, the exact stdout and empty stderr. No test performs a network call: the no-network modes inject a fetch that throws on call and record zero calls, and default-mode tests inject a fake fetch.

### `npm run coverage --workspace @cubeclicker/backend`

```
$ npm run coverage --workspace @cubeclicker/backend
> coverage
> vitest run --coverage
...
 ✓ src/deploy/render-env-cli.test.ts (21 tests) 460ms
...
 Test Files  42 passed (42)
      Tests  1826 passed (1826)
...
 src/deploy        |   98.09 |    98.75 |     100 |   98.09 |
  ...er-env-cli.ts |      95 |    96.15 |     100 |      95 | 160-164
  render-env.ts    |     100 |     100 |     100 |     100 |
...
All files          |   96.64 |    90.81 |   99.61 |   96.64 |
exit=0
```

The command exits `0`, so the workspace thresholds (statements/branches/functions/lines ≥ 80) pass. Lines 160–164 are the module-level entrypoint guard (`process.argv[1] !== undefined` true branch), which only executes in the spawned child process and is proven there and by the shell fixtures; `render-env-cli.ts` has no other uncovered function.

### Fixture 1 — pinned `production` placeholder set, `--check-only`

```bash
code=0; env TARGET_ENVIRONMENT=production RENDER_SERVICE_ID='<CHANGEME-render-service-id>' RENDER_API_KEY='<CHANGEME-render-api-key>' SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='<CHANGEME-verified-sender>' SMTP_USER='<CHANGEME-smtp-login>' SMTP_PASS='<CHANGEME-smtp-key>' npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only || code=$?; test "$code" -eq 1
```

Output:

```
Deploy blocked: the 'production' environment has 5 unset or placeholder value(s).
  Placeholder: SMTP_FROM, SMTP_USER, SMTP_PASS, RENDER_SERVICE_ID, RENDER_API_KEY
Remediation (names only; never paste a value into a command argument):
  variables: gh variable set <NAME> --env production --repo raultorres2603/CubeClicker
  secrets:   gh secret set <NAME> --env production --repo raultorres2603/CubeClicker
Runbook: README.md § Deployment Brevo runbook
exit=1
```

`test "$code" -eq 1` → exit `0` (pass).

### Fixture 2 — complete `development` set, `--check-only`

```bash
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='CubeClicker <no-reply@example.com>' SMTP_USER=fixture SMTP_PASS=fixture npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only | grep -qx "Deploy configuration OK: 9 value(s) present for the 'development' environment."
```

Output:

```
Deploy configuration OK: 9 value(s) present for the 'development' environment.
exit=0
```

`grep -qx` matched the whole line → exit `0` (pass).

### Fixture 3 — complete `development` set, `--dry-run`

```bash
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='CubeClicker <no-reply@example.com>' SMTP_USER=fixture SMTP_PASS=fixture npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --dry-run
```

Output:

```
DRY RUN: would set SMTP_HOST (PUT https://api.render.com/v1/services/srv-fixture/env-vars/SMTP_HOST)
DRY RUN: would set SMTP_PORT (PUT https://api.render.com/v1/services/srv-fixture/env-vars/SMTP_PORT)
DRY RUN: would set SMTP_SECURE (PUT https://api.render.com/v1/services/srv-fixture/env-vars/SMTP_SECURE)
DRY RUN: would set SMTP_CONNECTION_TIMEOUT_MS (PUT https://api.render.com/v1/services/srv-fixture/env-vars/SMTP_CONNECTION_TIMEOUT_MS)
DRY RUN: would set SMTP_FROM (PUT https://api.render.com/v1/services/srv-fixture/env-vars/SMTP_FROM)
DRY RUN: would set SMTP_USER (PUT https://api.render.com/v1/services/srv-fixture/env-vars/SMTP_USER)
DRY RUN: would set SMTP_PASS (PUT https://api.render.com/v1/services/srv-fixture/env-vars/SMTP_PASS)
DRY RUN complete: 9 value(s) validated for the 'development' environment; 7 would be synced; no network calls made.
exit=0
```

`grep -qx` on the summary line → exit `0` (pass).

### T2 verify block verbatim

The `verify:` line of the T2 section in `tasks.md` was extracted mechanically (markdown backtick separators turned into newlines) into `/tmp/opencode/t2-verify.sh` and executed with `bash -euo pipefail`:

```
$ bash -euo pipefail /tmp/opencode/t2-verify.sh
... (lint, typecheck, 1826 tests, coverage)
verify-exit=0
```

Extracted summary lines:

```
 Test Files  42 passed (42)
      Tests  1826 passed (1826)
 Test Files  42 passed (42)
      Tests  1826 passed (1826)
All files          |   96.64 |    90.81 |   99.61 |   96.64 |
```

Every command in the block (including the three fixture invocations, `test -f` and the credential guard) succeeded; the overall exit code is `0`.

### Build log existence and credential guard

```
$ test -f docs/features/deploy-brevo-env-placeholders/build-log-T2.md && echo "build log present: exit=0"
build log present: exit=0
$ ! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/deploy-brevo-env-placeholders/build-log-T2.md && echo "credential guard over build-log-T2.md: clean (no match)"
credential guard over build-log-T2.md: clean (no match)
```

## Acceptance audit

- **AC-4** → met. (a) fixture 1 prints the exact production block and exits `1`; the unit test asserts the identical block via `toStrictEqual` and proves absence of every configured secret value. (b) fixture 2 prints the exact success line and exits `0`; the unit and process tests pin it. (c) `--help` returns `0` with the exact usage, an unknown option (alone or after a valid flag) returns `1` with `Unknown option: <option>` plus usage; both paths use an empty environment, a throwing fetch and zero recorded calls.
- **AC-5** (CLI portion) → met. Default mode validates nine first, then issues exactly seven PUTs in `SMTP_CATALOG` order with the pinned URLs, `authorization`/`content-type` headers, exact `{"value":…}` bodies and an `AbortSignal` per request; stdout is the seven `SYNCED` lines plus `Synced 7 value(s) to Render service <id> for the '<env>' environment.`; exit `0`. Non-2xx, value mismatch and timeout each return `1` with the T1-pinned line and stop early. No body contains `RENDER_SERVICE_ID`, `RENDER_API_KEY`, the API key or the service id; the service id appears only in URLs (public identifier).
- **AC-6** → met. `--dry-run` prints one `DRY RUN: would set <KEY> (PUT <url>)` per SMTP key (seven, catalog order) plus the exact 9-validated/7-synced summary and exits `0`; the no-network harness throws if fetch is called and records zero calls in both `--check-only` and `--dry-run` tests.
- **AC-9(b)** (CLI portion) → met. `expectNoFixtureSecrets` asserts the complete output of the guard, dry-run, success, non-2xx, mismatch and placeholder-sync paths contains none of the configured host/sender/login/pass values and not the bearer credential; exact-line assertions make the remaining text fully pinned.
- **Testing bar** → unit tier (17 injected-io tests) and integration tier (4 process-level runs of the real entrypoint, plus the three shell fixtures in `verify`) both present; concrete assertions only; no network, no snapshots, no wildcard matchers.

## Deviations from spec

None. Two undefined combinations were resolved conservatively and are documented above (help wins; `--check-only` wins over `--dry-run`, so a double mode flag can never sync). The blank-`TARGET_ENVIRONMENT` fallback to `unknown` follows the spec's default rather than printing an empty label.
