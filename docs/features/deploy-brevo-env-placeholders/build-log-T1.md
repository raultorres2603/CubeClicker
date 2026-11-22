# Build log — T1 — Catalog split, placeholder guard and Render sync logic

Task: T1 (2026-11-22)
Files changed: `src/backend/src/deploy/render-env.ts`, `src/backend/src/deploy/render-env.test.ts`, `docs/features/deploy-brevo-env-placeholders/build-log-T1.md`

## What changed & why
- Added the pure deploy module: the pinned 7-name `SMTP_CATALOG`, the 2-name `RENDER_WIRING`, the 9-name `CATALOG`, the `SmtpKey`/`SmtpValues` sync type and `PLACEHOLDER_TOKEN = 'CHANGEME'`.
- Added the guard (`isPlaceholder`, `validateDeployEnv`, `formatGuardFailure`) that classifies all nine names in catalog order and renders the pinned AC-4 block (`Missing:` before `Placeholder:`).
- Added the Render helpers (`renderEnvVarUrl`, `buildEnvVarPayload`, `redactValues`) and `syncRenderEnv`, which writes exactly the seven SMTP names as one per-key `PUT` each, verifies the echo, and maps every failure to its pinned line.
- `syncRenderEnv` iterates `SMTP_CATALOG` only: `RENDER_SERVICE_ID` stays in the URL path and `RENDER_API_KEY` in the `authorization` header; neither reaches a request body, and a stray `RENDER_API_KEY` property on the payload is ignored.
- 32 unit tests use an injected fake fetch and an injected logger: no network, no timers.

## Decisions
- `syncRenderEnv` accepts an optional `environment` label (default `unknown`) because the pinned summary line contains the environment name and T1 owns the summary assertion; the CLI passes `TARGET_ENVIRONMENT`.
- Any unverifiable echo (value mismatch, key mismatch, unparseable or non-object 2xx body) uses the pinned AC-5(d) abort line, because the write cannot be confirmed; the request loop stops immediately.
- `redactValues` replaces every non-empty configured value (longest first, so no partial suffix survives) plus `rnd_` tokens, `RENDER_API_KEY=` assignments and the two Brevo key shapes; empty values are skipped so a blank value cannot match between every character.
- The Render error path parses the response body only for `code`; the body text is never logged and a missing/unparseable `code` prints `unknown`.
- No integration tier inside T1: the module is pure logic with an injected transport seam, so the tier is unit-only here. The feature's integration proof is T2's process-level CLI fixtures and T3/T4's pipeline assertions; documented exception per the skill's § Testing bar.

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

 ✓ src/deploy/render-env.test.ts (32 tests) 16ms
 ... (40 further test files, all passed)

 Test Files  41 passed (41)
      Tests  1805 passed (1805)
   Start at  19:08:41
   Duration  3.46s (transform 4.61s, setup 0ms, collect 14.09s, tests 14.50s, environment 7ms, prepare 3.65s)
```

Focused run of the changed suite (`npx vitest run src/deploy/render-env.test.ts --reporter=verbose`, cwd `src/backend`):
```
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/deploy/render-env.test.ts > deployment catalog (AC-2) > pins the seven SMTP names in order with their GitHub classification 2ms
 ✓ src/deploy/render-env.test.ts > deployment catalog (AC-2) > pins the two Render-wiring names and the nine-name validation catalog 0ms
 ✓ src/deploy/render-env.test.ts > deployment catalog (AC-2) > pins the CHANGEME sentinel and the 10000ms request timeout 0ms
 ✓ src/deploy/render-env.test.ts > isPlaceholder (AC-3) > is true exactly when the value contains the literal CHANGEME 0ms
 ✓ src/deploy/render-env.test.ts > validateDeployEnv (AC-3) > classifies the pinned development placeholders in catalog order 0ms
 ✓ src/deploy/render-env.test.ts > validateDeployEnv (AC-3) > classifies the pinned production placeholders in catalog order 0ms
 ✓ src/deploy/render-env.test.ts > validateDeployEnv (AC-3) > reports every name missing for an empty environment 0ms
 ✓ src/deploy/render-env.test.ts > validateDeployEnv (AC-3) > reports whitespace-only values as missing while preserving list order 0ms
 ✓ src/deploy/render-env.test.ts > validateDeployEnv (AC-3) > returns all nine values only when every name is real 0ms
 ✓ src/deploy/render-env.test.ts > formatGuardFailure (AC-4) > renders the exact production placeholder block 0ms
 ✓ src/deploy/render-env.test.ts > formatGuardFailure (AC-4) > prints Missing before Placeholder when both kinds exist 0ms
 ✓ src/deploy/render-env.test.ts > formatGuardFailure (AC-4) > omits the Placeholder line when only names are missing 0ms
 ✓ src/deploy/render-env.test.ts > renderEnvVarUrl (AC-5) > builds the pinned per-key Render URL 0ms
 ✓ src/deploy/render-env.test.ts > buildEnvVarPayload (AC-5) > JSON-encodes exactly one value field 0ms
 ✓ src/deploy/render-env.test.ts > buildEnvVarPayload (AC-5) > escapes quotes and backslashes without adding fields 0ms
 ✓ src/deploy/render-env.test.ts > redactValues (AC-5(c), AC-9) > replaces every configured value 0ms
 ✓ src/deploy/render-env.test.ts > redactValues (AC-5(c), AC-9) > replaces longest values first so no suffix survives 0ms
 ✓ src/deploy/render-env.test.ts > redactValues (AC-5(c), AC-9) > replaces values shorter than four characters too 0ms
 ✓ src/deploy/render-env.test.ts > redactValues (AC-5(c), AC-9) > ignores empty configured values 0ms
 ✓ src/deploy/render-env.test.ts > redactValues (AC-5(c), AC-9) > redacts rnd_-shaped tokens, Render key assignments and Brevo key shapes 0ms
 ✓ src/deploy/render-env.test.ts > syncRenderEnv success (AC-5) > sends exactly seven PUTs in catalog order with the pinned URL, headers and body 1ms
 ✓ src/deploy/render-env.test.ts > syncRenderEnv success (AC-5) > never writes either wiring name and keeps the service id and key out of every body 1ms
 ✓ src/deploy/render-env.test.ts > syncRenderEnv success (AC-5) > ignores a stray RENDER_API_KEY property on the sync payload 0ms
 ✓ src/deploy/render-env.test.ts > syncRenderEnv failures (AC-5) > stops on the first non-2xx response and prints the Render code only 0ms
 ✓ src/deploy/render-env.test.ts > syncRenderEnv failures (AC-5) > reports an unparseable error body as an unknown code and prints no body text 0ms
 ✓ src/deploy/render-env.test.ts > syncRenderEnv failures (AC-5) > maps a timeout rejection to the pinned 10000ms line 0ms
 ✓ src/deploy/render-env.test.ts > syncRenderEnv failures (AC-5) > redacts every configured value and the Render key shape in a transport rejection 0ms
 ✓ src/deploy/render-env.test.ts > syncRenderEnv failures (AC-5) > sanitizes a non-Error rejection value 0ms
 ✓ src/deploy/render-env.test.ts > syncRenderEnv failures (AC-5) > aborts when the echoed value differs from the sent value 0ms
 ✓ src/deploy/render-env.test.ts > syncRenderEnv failures (AC-5) > aborts when the echoed key differs from the sent key 0ms
 ✓ src/deploy/render-env.test.ts > syncRenderEnv failures (AC-5) > treats an unparseable 2xx echo as an unverified write 0ms
 ✓ src/deploy/render-env.test.ts > syncRenderEnv failures (AC-5) > treats a non-object 2xx echo as an unverified write 0ms

 Test Files  1 passed (1)
      Tests  32 passed (32)
   Start at  19:08:59
   Duration  265ms (transform 43ms, setup 0ms, collect 41ms, tests 9ms, environment 0ms, prepare 62ms)
```

### `npm run coverage --workspace @cubeclicker/backend`
```
$ npm run coverage --workspace @cubeclicker/backend
> coverage
> vitest run --coverage

 Test Files  41 passed (41)
      Tests  1805 passed (1805)
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.66 |    90.75 |   99.61 |   96.66 |
 src/deploy        |     100 |      100 |     100 |     100 |
  render-env.ts    |     100 |      100 |     100 |     100 |
exit 0 — all four backend aggregate metrics are ≥ 80 (96.66 / 90.75 / 99.61 / 96.66); the new file is 100 on all four.
```

### Guard self-test (AC-9(a))
```
$ node -e "const cases=[['render-assigned','RENDER_API_KEY='+'a'.repeat(16),/RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}/],['render-shape','rnd_'+'b'.repeat(24),/rnd_[A-Za-z0-9_-]{20,}/],['smtp-assigned','SMTP_PASS='+'c'.repeat(15),/SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}/],['brevo-rest','xkeysib-'+'d'.repeat(20),/xkeysib-[A-Za-z0-9]{20,}/],['brevo-smtp','xsmtpsib-'+'e'.repeat(15),/xsmtpsib-[A-Za-z0-9]{15,}/]];for(const [label,value,re] of cases){if(!re.test(value))throw new Error('guard pattern misses '+label)}const allowed=['RENDER_API_KEY=<CHANGEME-render-api-key>','RENDER_API_KEY=fixture-key','SMTP_USER=<CHANGEME-smtp-login>','SMTP_PASS=<CHANGEME-smtp-key>'];for(const value of allowed){if(/RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}/.test(value))throw new Error('guard rejects a documented placeholder: '+value)}console.log('credential guard self-test: Render/SMTP key shapes matched, placeholders allowed')"
credential guard self-test: Render/SMTP key shapes matched, placeholders allowed
exit 0
```

### Build-log credential guard
```
$ ! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/deploy-brevo-env-placeholders/build-log-T1.md
exit 0 (no credential-shaped token in this log)
```

## Acceptance audit
- AC-2(a) → met: `pins the seven SMTP names in order with their GitHub classification` and `pins the two Render-wiring names and the nine-name validation catalog` assert the exact objects, lengths 7/2/9, and the sync iteration keys/URLs are the seven SMTP keys. No other name is defined, required, validated or synced.
- AC-3 → met: `isPlaceholder` contains/absent/case tests; `validateDeployEnv` development placeholders (`['SMTP_FROM','SMTP_USER','SMTP_PASS','RENDER_API_KEY']`), production placeholders (plus `RENDER_SERVICE_ID`), all-missing, whitespace/mixed ordering, and the all-real `{ ok: true, values }` fixture with all nine values.
- AC-5 → met (module half): exactly seven `PUT`s in `SMTP_CATALOG` order with the pinned URLs, `authorization: Bearer …`, `content-type: application/json` and exact `{"value":"…"}` bodies; per-key `SYNCED` lines and `Synced 7 value(s) to Render service … for the 'development' environment.`; non-2xx with parsed `code` and `unknown` for an unparseable body; timeout line; transport line with every value, the API key and `rnd_` tokens redacted; value/key/unparseable echo mismatch abort; stop on first failure; no wiring name in any body; a stray payload property ignored. The CLI half (process exit codes, `--dry-run`, fixtures) is T2.
- AC-9(a) → met (module/build-log half): redaction covers configured values, `RENDER_API_KEY=` assignments, `rnd_` tokens and Brevo key shapes; no value appears in any success/failure line (asserted by absence checks); this build log passes the extended guard; the guard self-test matches the synthetic key shapes and allows the documented placeholders. The repository-wide tree/branch/history guard is T7.

## Deviations from spec
- None from the spec. Relative to the plan's interface sketch, `syncRenderEnv` takes an optional `environment` label for the pinned summary line and `redactValues` has no 4-character floor: AC-5(c)/(f) require *every* configured SMTP value to be absent from failure output, and `SMTP_PORT=587` / `SMTP_SECURE=false` are shorter than four characters. Both choices are covered by tests.

## Full T1 verify block (verbatim re-run)
Command: the seven-line block from `tasks.md` T1 § verify, executed from the repository root (`npm run lint`; backend typecheck; backend test; backend coverage; `test -f` build log; `! grep` credential guard; guard self-test). Every line exited 0:
```
npm run lint → EXIT 0
npm run typecheck --workspace @cubeclicker/backend → EXIT 0
npm test --workspace @cubeclicker/backend → EXIT 0
npm run coverage --workspace @cubeclicker/backend → EXIT 0
test -f docs/features/deploy-brevo-env-placeholders/build-log-T1.md → EXIT 0
! grep -qE "<extended credential guard>" docs/features/deploy-brevo-env-placeholders/build-log-T1.md → EXIT 0
node -e "<guard self-test>" → EXIT 0
```
Raw transcript tail (full output is the sections above plus the unchanged pre-existing suite output):
```
> eslint .
EXIT npm run lint=0
> tsc --noEmit
EXIT typecheck=0
 Test Files  41 passed (41)
      Tests  1805 passed (1805)
EXIT test=0
 Test Files  41 passed (41)
      Tests  1805 passed (1805)
All files          |   96.66 |    90.75 |   99.61 |   96.66 |
  render-env.ts    |     100 |      100 |     100 |     100 |
EXIT coverage=0
EXIT build-log-exists=0
EXIT build-log-guard=0
credential guard self-test: Render/SMTP key shapes matched, placeholders allowed
EXIT guard-self-test=0
```
