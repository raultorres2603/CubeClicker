# Build log — T1 — Strict Render-free SMTP guard and CI fixtures

Task: T1 (2026-11-24)
Files changed: `src/backend/src/deploy/render-env.ts`, `src/backend/src/deploy/render-env.test.ts`, `src/backend/src/deploy/render-env-cli.ts`, `src/backend/src/deploy/render-env-cli.test.ts`, `.github/workflows/ci.yml`, `docs/features/registration-account-exists/build-log-T1.md`

## What changed & why
- Added `BLOCKED_RENDER_FREE_SMTP_PORTS` (25/465/587), `LOCAL_MAILPIT_PORT` (1025), `RENDER_FREE_SMTP_PORT` (2525), the strict `SmtpPortFailure` union, `validateSmtpTransportPort(env)` and `formatSmtpPortFailure(environment, failure)` with the four exact AC-1(b) operator blocks.
- The guard is development-only (`TARGET_ENVIRONMENT === 'development'`), leaves missing/empty/`CHANGEME` to the catalog, parses `/^\d+$/` with 1–65535 and no trimming, rejects the Render-free blocklist and 1025, and requires `SMTP_SECURE` in `undefined | '' | 'false' | '0'` on 2525; production returns `{ ok: true }`.
- `runRenderEnvCli` calls the guard immediately after `validateDeployEnv` succeeds and before the `--check-only` success line, any `DRY RUN:` line or any fetch, so catalog failures take precedence and a blocked/malformed/local/non-STARTTLS port can never be synced.
- `render-env-cli.test.ts` fixtures moved to 2525 (`SMTP_VALUES`, `COMPLETE_ENV`, `EXPECTED_BODIES`); the production placeholder fixture pins `SMTP_PORT: '587'` explicitly to prove catalog precedence; new guard tests cover all four blocks, zero output/fetch in `--check-only`/`--dry-run`/default mode, and one process-boundary rejection.
- `ci.yml`: the single development accept fixture is now `SMTP_PORT: '2525'`; the single production placeholder fixture stays at `587`. `deploy.yml`, `render.yaml` and the compose files are untouched.

## Decisions
- `BLOCKED_RENDER_FREE_SMTP_PORTS` is typed `readonly number[]` so `.includes(port)` accepts the parsed `number` without a cast.
- The `SMTP_SECURE` check uses explicit `!==` comparisons rather than a lookup array: it narrows `secure` to `string` for the `starttls_required.value` field, so the raw value is echoed with no assertion or fallback coercion.
- `invalid_port` is checked before the blocklist/local checks, so `0`, `65536`, `-1`, `587abc`, `25.5` and `' 2525'` all report `invalid_port` with the untouched `raw` input (a whitespace-prefixed `2525` is malformed, not accepted).
- The guard is invoked in the CLI after the catalog and once for every mode, not inside `syncRenderEnv`: the pure sync function stays mode-agnostic (and its existing tests keep their sync-only fixtures), while the CLI owns the fail-closed ordering.
- Two tiers are present: unit truth tables/blocks in `render-env.test.ts` and `render-env-cli.test.ts` (injected fetch/logger), plus a real-process integration test (`spawnSync` with `tsx`) that asserts the exact blocked-port block through the actual entrypoint.

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

 Test Files  52 passed (52)
      Tests  1947 passed (1947)
   Start at  18:49:32
   Duration  4.00s (transform 5.50s, setup 0ms, collect 15.91s, tests 24.51s, environment 9ms, prepare 3.93s)

exit 0
```

Focused run of the two changed suites (`npx --no-install vitest run src/deploy/render-env.test.ts src/deploy/render-env-cli.test.ts --reporter=verbose`, cwd `src/backend`), new AC-1 cases:
```
 ✓ src/deploy/render-env.test.ts > validateSmtpTransportPort (AC-1(a)) > pins the Render-free blocklist, the local Mailpit port and the STARTTLS port 0ms
 ✓ src/deploy/render-env.test.ts > validateSmtpTransportPort (AC-1(a)) > rejects the three Render-free blocked ports 0ms
 ✓ src/deploy/render-env.test.ts > validateSmtpTransportPort (AC-1(a)) > rejects every non-integer or out-of-range port with the untouched raw input 0ms
 ✓ src/deploy/render-env.test.ts > validateSmtpTransportPort (AC-1(a)) > rejects the local Mailpit port 0ms
 ✓ src/deploy/render-env.test.ts > validateSmtpTransportPort (AC-1(a)) > accepts 2525 with an unset, empty, false or 0 SMTP_SECURE 0ms
 ✓ src/deploy/render-env.test.ts > validateSmtpTransportPort (AC-1(a)) > requires STARTTLS on 2525 and keeps the raw SMTP_SECURE value 0ms
 ✓ src/deploy/render-env.test.ts > validateSmtpTransportPort (AC-1(a)) > leaves presence and CHANGEME to the catalog 0ms
 ✓ src/deploy/render-env.test.ts > validateSmtpTransportPort (AC-1(a)) > accepts the inclusive 1-65535 boundaries and other non-blocked ports 0ms
 ✓ src/deploy/render-env.test.ts > validateSmtpTransportPort (AC-1(a)) > passes every port in production and in an unlabelled environment 0ms
 ✓ src/deploy/render-env.test.ts > formatSmtpPortFailure (AC-1(b)) > renders the exact blocked-port block naming the port 0ms
 ✓ src/deploy/render-env.test.ts > formatSmtpPortFailure (AC-1(b)) > renders the equivalent first line for 25 and 465 0ms
 ✓ src/deploy/render-env.test.ts > formatSmtpPortFailure (AC-1(b)) > renders the exact malformed-port block quoting the raw value 0ms
 ✓ src/deploy/render-env.test.ts > formatSmtpPortFailure (AC-1(b)) > renders the exact local Mailpit block 0ms
 ✓ src/deploy/render-env.test.ts > formatSmtpPortFailure (AC-1(b)) > renders the exact STARTTLS block echoing the raw SMTP_SECURE value 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli --check-only (AC-4) > prints the exact production placeholder block at 587 (catalog wins over the port guard) and exits 1 1ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli strict SMTP transport guard (AC-1) > rejects a development 587 in --check-only before any success line or fetch 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli strict SMTP transport guard (AC-1) > rejects a malformed development port in --check-only 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli strict SMTP transport guard (AC-1) > rejects the local Mailpit port in --check-only 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli strict SMTP transport guard (AC-1) > rejects 2525 with SMTP_SECURE=true in --check-only 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli strict SMTP transport guard (AC-1) > prints no DRY RUN line and makes no fetch for a blocked or malformed port 0ms
 ✓ src/deploy/render-env-cli.test.ts > runRenderEnvCli strict SMTP transport guard (AC-1) > fails the default sync mode on 587 without a network call 0ms
 ✓ src/deploy/render-env-cli.test.ts > integration through the process boundary (AC-4/AC-6) > exits 1 with the exact blocked-port block for a development 587 fixture 79ms

 Test Files  2 passed (2)
      Tests  74 passed (74)
   Start at  18:49:20
   Duration  631ms (transform 67ms, setup 0ms, collect 110ms, tests 388ms, environment 0ms, prepare 113ms)
```

### `npm run coverage --workspace @cubeclicker/backend`
```
$ npm run coverage --workspace @cubeclicker/backend

 Test Files  52 passed (52)
      Tests  1947 passed (1947)
All files          |   96.84 |    91.26 |    99.63 |   96.84 |
 src/deploy        |   98.52 |     99.1 |     100 |   98.52 |
  render-env.ts    |     100 |      100 |     100 |     100 |

exit 0 — aggregate pass: 96.84 statements / 91.26 branches / 99.63 functions / 96.84 lines, all ≥ 80. The two changed modules are fully covered on branches and functions; the only uncovered lines in `render-env-cli.ts` (171–175) are the pre-existing `import.meta.url === pathToFileURL(...)` process-entrypoint guard, which child-process runs cannot attribute to the parent V8 report.
```

### `actionlint` container check (verbatim from the task)
```
$ podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml

exit 0 (no findings)
```

### CI fixture assertions (verbatim from the task)
```
$ test "$(grep -c "SMTP_PORT: '2525'" .github/workflows/ci.yml)" -eq 1
$ test "$(grep -c "SMTP_PORT: '587'" .github/workflows/ci.yml)" -eq 1
$ grep -B5 "SMTP_PORT: '2525'" .github/workflows/ci.yml | grep -q 'TARGET_ENVIRONMENT: development'
$ grep -B5 "SMTP_PORT: '587'" .github/workflows/ci.yml | grep -q 'TARGET_ENVIRONMENT: production'

all exit 0; context lines printed:
          TARGET_ENVIRONMENT: development
          TARGET_ENVIRONMENT: production
```

### CLI process fixtures (verbatim from the task, `tsx` entrypoint)
```
$ env TARGET_ENVIRONMENT=development ... SMTP_PORT=587 ... npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only
EXIT=1
Deploy blocked: SMTP_PORT=587 is blocked for outbound SMTP on the Render free plan ('development' environment).
  Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS); ports 25, 465 and 587 stay blocked on Render free.
  Runbook: README.md § Deployment Brevo runbook

$ env TARGET_ENVIRONMENT=development ... SMTP_PORT=587abc ... --check-only
EXIT=1
Deploy blocked: SMTP_PORT="587abc" must be an integer between 1 and 65535 ('development' environment).
  Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS) on Render free.
  Runbook: README.md § Deployment Brevo runbook

$ env TARGET_ENVIRONMENT=development ... SMTP_PORT=2525 SMTP_SECURE=true ... --check-only
EXIT=1
Deploy blocked: SMTP_SECURE must be "false" when SMTP_PORT=2525 ('development' environment); received "true".
  Port 2525 uses STARTTLS; set SMTP_SECURE=false.
  Runbook: README.md § Deployment Brevo runbook

$ env TARGET_ENVIRONMENT=development ... SMTP_PORT=1025 ... --check-only
EXIT=1
Deploy blocked: SMTP_PORT=1025 is the local Mailpit port and is not reachable from a deployed Render service ('development' environment).
  Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS).
  Runbook: README.md § Deployment Brevo runbook

$ env TARGET_ENVIRONMENT=development ... SMTP_PORT=2525 SMTP_SECURE=false ... --check-only
EXIT=0
Deploy configuration OK: 9 value(s) present for the 'development' environment.

$ env TARGET_ENVIRONMENT=production ... SMTP_PORT=587 ... placeholder names ... --check-only
EXIT=1
Deploy blocked: the 'production' environment has 5 unset or placeholder value(s).
  Placeholder: SMTP_FROM, SMTP_USER, SMTP_PASS, RENDER_SERVICE_ID, RENDER_API_KEY
... (catalog block; no SMTP_PORT line) → catalog precedence proven

$ env TARGET_ENVIRONMENT=development ... SMTP_PORT=587 ... --dry-run
EXIT=1; zero `DRY RUN:` lines (output is exactly the blocked-port block)

$ env TARGET_ENVIRONMENT=development ... SMTP_PORT=587 ... (default sync mode)
EXIT=1; zero `SYNCED ` lines (output is exactly the blocked-port block); no network call
```

## Acceptance audit
- AC-1(a) → met: `validateSmtpTransportPort` exports the exact union; tests cover 25/465/587 → `render_free_blocked` (`port` equal to the parsed port), `0`/`65536`/`-1`/`587abc`/`25.5`/`' 2525'` → `invalid_port` (`raw` untouched), `1025` → `local_port`, `2525` with unset/empty/`false`/`0` → `{ ok: true }`, `2525` with `true`/`1`/`yes` → `starttls_required` (`value` raw), missing/empty/`CHANGEME` → `{ ok: true }`, `1`/`65535`/`2465` → `{ ok: true }`, and production/unlabelled → `{ ok: true }` for every probed input.
- AC-1(b) → met: five exact-string formatter tests (the 587 block, the 25/465 equivalent first lines, the malformed `587abc` block, the 1025 local block and the `true` STARTTLS block) assert every line, including the two-space indentation and the runbook line.
- AC-1(c) → met: `--check-only` at 587, `587abc`, `2525`+`true` and `1025` each return 1 with only the exact block; 2525/false returns 0 with only `Deploy configuration OK: 9 value(s) present for the 'development' environment.`; `--dry-run` with 587 and `587abc` returns 1 with zero `DRY RUN:` lines (strict line equality); default mode with 587 returns 1 with a no-network harness whose fetch throws (call count 0); the production placeholder fixture at explicit `587` prints the catalog block, never the port block. The same six fixtures are also exercised through the real process boundary.
- AC-1(d) → met: `ci.yml` holds exactly one `SMTP_PORT: '2525'` (development accept) and one `SMTP_PORT: '587'` (production placeholder), each within five lines of its `TARGET_ENVIRONMENT`; actionlint exits 0; no fixture value is a credential (`fixture`, `fixture-key`, placeholders).
- AC-1(e) → met: `SMTP_VALUES`, `COMPLETE_ENV` and `EXPECTED_BODIES` now use `2525` for the development fixture; `PRODUCTION_PLACEHOLDER_ENV` sets `SMTP_PORT: '587'` explicitly and keeps its 587 sync/check-only assertions.
- Testing bar → met: unit truth table + exact formatter blocks, CLI unit tests with injected fetch/logger proving zero calls and exact lines, and a real `tsx` process integration test; no wildcard matchers, no snapshot-only or assertion-free tests, no coverage exclusion or threshold change.

## Deviations from spec
- None. `deploy.yml`, `render.yaml` and the compose files were not modified.

## Full T1 verify block (verbatim re-run)
Executed exactly the block from `tasks.md` T1 § verify (lint → backend typecheck → backend tests → backend coverage → actionlint → CI fixture assertions → eight `tsx` CLI process fixtures → build-log existence → credential guard) as one `bash` script under `set -euo pipefail`, so any failing step aborts the run. Exit status 0; the final marker printed:
```
T1 VERIFY BLOCK: ALL COMMANDS EXITED 0
```
Key raw lines from the transcript:
```
> lint
> eslint .
> typecheck
> tsc --noEmit
 Test Files  52 passed (52)
      Tests  1947 passed (1947)
All files          |   96.84 |    91.26 |   99.63 |   96.84 |
 src/deploy        |   98.52 |     99.1 |     100 |   98.52 |
  render-env.ts    |     100 |      100 |     100 |     100 |
T1 VERIFY BLOCK: ALL COMMANDS EXITED 0
```
The actionlint step and the eight CLI fixtures, the two fixture-count/grep assertions and the final `test -f` / `! grep` guards print nothing on success; their failure would have aborted the script before the marker.
