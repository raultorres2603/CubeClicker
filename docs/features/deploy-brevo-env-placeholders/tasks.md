# Tasks — Deployment Brevo Environment Placeholders (GitHub Environment → Render)

Dependency overview: **T1 → T2 → T3 → T4 → T5 → T6 → T7**. Every task is `[seq]`; there is no `[P]` batch. T3 and T4 both run backend coverage and workflow checks, so they are serialized (and their actionlint runs are scoped to their own file) to avoid a false-evidence race. T5 has external side effects and is the only task that may hand off to the owner; T6 owns the shared docs.

Every task records raw evidence in its own build log under `docs/features/deploy-brevo-env-placeholders/`; every verify ends with the extended repository credential guard over that build log, so no real credential can be recorded.

## T1 — Catalog split, placeholder guard and Render sync logic `[seq]`
depends_on: —
files_owned: `src/backend/src/deploy/render-env.ts`, `src/backend/src/deploy/render-env.test.ts`, `docs/features/deploy-brevo-env-placeholders/build-log-T1.md`
verify:
```bash
npm run lint
npm run typecheck --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend
npm run coverage --workspace @cubeclicker/backend
test -f docs/features/deploy-brevo-env-placeholders/build-log-T1.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/deploy-brevo-env-placeholders/build-log-T1.md
node -e "const cases=[['render-assigned','RENDER_API_KEY='+'a'.repeat(16),/RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}/],['render-shape','rnd_'+'b'.repeat(24),/rnd_[A-Za-z0-9_-]{20,}/],['smtp-assigned','SMTP_PASS='+'c'.repeat(15),/SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}/],['brevo-rest','xkeysib-'+'d'.repeat(20),/xkeysib-[A-Za-z0-9]{20,}/],['brevo-smtp','xsmtpsib-'+'e'.repeat(15),/xsmtpsib-[A-Za-z0-9]{15,}/]];for(const [label,value,re] of cases){if(!re.test(value))throw new Error('guard pattern misses '+label)}const allowed=['RENDER_API_KEY=<CHANGEME-render-api-key>','RENDER_API_KEY=fixture-key','SMTP_USER=<CHANGEME-smtp-login>','SMTP_PASS=<CHANGEME-smtp-key>'];for(const value of allowed){if(/RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}/.test(value))throw new Error('guard rejects a documented placeholder: '+value)}console.log('credential guard self-test: Render/SMTP key shapes matched, placeholders allowed')"
```
acceptance: AC-2(a), AC-3, AC-5, AC-9(a)
status: [x]

Create the pure module: `SMTP_CATALOG` (seven entries, pinned order and `source`), `RENDER_WIRING` (two entries), `CATALOG = [...SMTP_CATALOG, ...RENDER_WIRING]` (nine validated), `SmtpKey`/`SmtpValues` (seven-key sync type), `PLACEHOLDER_TOKEN = 'CHANGEME'`, `isPlaceholder`, `validateDeployEnv` (missing vs placeholder, catalog order, `ok` only when all nine pass), `formatGuardFailure` (exact AC-4 block, `Missing:` before `Placeholder:`), `renderEnvVarUrl`, `buildEnvVarPayload`, `redactValues`, and `syncRenderEnv({ serviceId, apiKey, smtpValues, fetchImpl, log })` with the injected `FetchLike`. The sync iterates `SMTP_CATALOG` only; an extra `RENDER_API_KEY` property on `smtpValues` is ignored. Tests use a fake fetch and assert exactly seven PUTs in catalog order, URL/headers/body, the absence of either wiring name from every body, the service ID only in the URL paths, the API key only in the authorization header, `SYNCED`/summary (`Synced 7 …`)/error/timeout/generic-rejection (value- and Render-key-shape-redacted)/mismatch lines, stop-on-first-failure, and the absence of every value in every output path (including a `rnd_`-shaped token in a transport error); no network, no timers (inject the rejection instead of waiting). The guard self-test in `verify` proves synthetic `RENDER_API_KEY=` and `rnd_` shapes match while `<CHANGEME-render-api-key>` and the 11-character `fixture-key` do not. Do not touch `app.ts`, `server.ts`, `auth/**`, `render.yaml` or the images.

## T2 — Render env CLI (`--check-only` / `--dry-run` / sync) `[seq]`
depends_on: T1
files_owned: `src/backend/src/deploy/render-env-cli.ts`, `src/backend/src/deploy/render-env-cli.test.ts`, `docs/features/deploy-brevo-env-placeholders/build-log-T2.md`
verify: `npm run lint`; `npm run typecheck --workspace @cubeclicker/backend`; `npm test --workspace @cubeclicker/backend`; `npm run coverage --workspace @cubeclicker/backend`; `code=0; env TARGET_ENVIRONMENT=production RENDER_SERVICE_ID='<CHANGEME-render-service-id>' RENDER_API_KEY='<CHANGEME-render-api-key>' SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='<CHANGEME-verified-sender>' SMTP_USER='<CHANGEME-smtp-login>' SMTP_PASS='<CHANGEME-smtp-key>' npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only || code=$?; test "$code" -eq 1`; `env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='CubeClicker <no-reply@example.com>' SMTP_USER=fixture SMTP_PASS=fixture npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only | grep -qx "Deploy configuration OK: 9 value(s) present for the 'development' environment."`; `env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='CubeClicker <no-reply@example.com>' SMTP_USER=fixture SMTP_PASS=fixture npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --dry-run | grep -qx "DRY RUN complete: 9 value(s) validated for the 'development' environment; 7 would be synced; no network calls made."`; `test -f docs/features/deploy-brevo-env-placeholders/build-log-T2.md`; `! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/deploy-brevo-env-placeholders/build-log-T2.md`
acceptance: AC-4, AC-5, AC-6
status: [x]

Add the CLI entrypoint mirroring `src/backend/src/db/migrate-cli.ts`: export `runRenderEnvCli(argv, env, { fetchImpl, log }): Promise<number>` with a thin bottom guard that checks `process.argv[1] !== undefined` before `pathToFileURL(process.argv[1]).href`, calls it with `process.argv.slice(2)`, `process.env`, the real `fetch` (`AbortSignal.timeout(10000)` in default mode) and `console.log`, then sets `process.exitCode`. Every logic branch is unit-tested; the bottom guard's true branch is exercised by the process-level integration fixtures in `verify`, not by unit tests. `--check-only` validates nine and makes no network call; `--dry-run` validates nine, prints seven `DRY RUN` lines and the 9-validated/7-synced summary; default mode validates nine, builds `smtpValues` from the seven SMTP keys and calls `syncRenderEnv`. Flag parsing (`--check-only`, `--dry-run`, `--help`, unknown option), `process.env` inputs (`TARGET_ENVIRONMENT` default `unknown`, `RENDER_SERVICE_ID`, `RENDER_API_KEY`, seven `SMTP_*`), and exit codes. Tests cover every flag, the exact AC-4/AC-6 lines, `--help`, unknown options, no `fetch` in `--check-only`/`--dry-run` (throwing injected fetch), and no value leakage on any path. The three shell invocations in `verify` are the pinned fixture proof and the exact commands the workflow will run; reproduce them with `env` overrides, never with exported values in a tracked file.

## T3 — Deploy workflow: preflight guard and Render sync `[seq]`
depends_on: T2
files_owned: `.github/workflows/deploy.yml`, `docs/features/deploy-brevo-env-placeholders/build-log-T3.md`
verify: `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/deploy.yml`; `node -e "const fs=require('node:fs');const t=fs.readFileSync('.github/workflows/deploy.yml','utf8');const n=['- name: Install dependencies','- name: Check deployment Brevo configuration','- name: Migrate Neon database','- name: Sync Brevo SMTP settings to Render','- name: Deploy Render backend','- name: Wait for Render deploy to start','- name: Wait for Render backend health','- name: Pull Vercel project settings','- name: Run deployed smoke'];const i=n.map((x)=>t.indexOf(x));i.forEach((v,k)=>{if(v<0)throw new Error('missing step: '+n[k])});for(let k=1;k<i.length;k++){if(i[k]<=i[k-1])throw new Error('step order wrong at '+n[k])}console.log('deploy.yml step order OK')"`; `for n in SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_CONNECTION_TIMEOUT_MS SMTP_FROM RENDER_SERVICE_ID; do test "$(grep -c "vars\.$n" .github/workflows/deploy.yml)" -eq 2; done`; `for n in SMTP_USER SMTP_PASS RENDER_API_KEY; do test "$(grep -c "secrets\.$n" .github/workflows/deploy.yml)" -eq 2; done`; `grep -q 'run: npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only' .github/workflows/deploy.yml`; `grep -qE '^ *run: npx --no-install tsx src/backend/src/deploy/render-env-cli\.ts$' .github/workflows/deploy.yml`; `! grep -q 'continue-on-error' .github/workflows/deploy.yml`; `! git diff origin/main -- .github/workflows/deploy.yml | grep -qE '^[+-].*(uses:|permissions:|contents: read|actions: read|concurrency:|group:|cancel-in-progress)'`; `node -e "JSON.parse(require('node:fs').readFileSync('src/frontend/vercel.json','utf8'));console.log('vercel.json: valid JSON')"`; `node -e "const fs=require('node:fs');const yaml=require('js-yaml');const b=yaml.load(fs.readFileSync('render.yaml','utf8'));if(!Array.isArray(b.services)||b.services.length!==1)throw new Error('render.yaml must declare exactly one service');const s=b.services[0];if(s.name!=='cubeclicker-development'||s.runtime!=='docker'||s.plan!=='free')throw new Error('unexpected render.yaml service');console.log('render.yaml: valid YAML')"`; `npm run coverage --workspace @cubeclicker/backend`; `test -f docs/features/deploy-brevo-env-placeholders/build-log-T3.md`; `! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/deploy-brevo-env-placeholders/build-log-T3.md`
acceptance: AC-7, AC-10(b)
status: [x]

Insert `Check deployment Brevo configuration` (after `Install dependencies`, before `Migrate Neon database`) and `Sync Brevo SMTP settings to Render` (after the migration, before `Deploy Render backend`), each with its own `env:` block binding six `vars.*` and three `secrets.*` plus the job-level `TARGET_ENVIRONMENT`. Change nothing else: triggers, `concurrency`, `permissions`, `timeout-minutes`, checkout/setup/install, the Render hook, the 45 s wait, the `/healthz` poll, the Vercel steps and the deployed smoke stay byte-identical, and no `uses:` line is added or modified (so no new SHA pin). The sync step runs the CLI with no flags; the CLI validates nine and writes only the seven SMTP keys, so `RENDER_API_KEY`/`RENDER_SERVICE_ID` never become service variables.

## T4 — CI guard fixture checks `[seq]`
depends_on: T3
files_owned: `.github/workflows/ci.yml`, `docs/features/deploy-brevo-env-placeholders/build-log-T4.md`
verify: `podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml`; `grep -q 'Guard rejects placeholder values' .github/workflows/ci.yml`; `grep -q 'Guard accepts a complete value set' .github/workflows/ci.yml`; `grep -q 'npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only' .github/workflows/ci.yml`; `grep -q "Deploy blocked: the 'production' environment has 5 unset or placeholder value(s)." .github/workflows/ci.yml`; `grep -q "Deploy configuration OK: 9 value(s) present for the 'development' environment." .github/workflows/ci.yml`; `test "$(grep -c 'npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only' .github/workflows/ci.yml)" -eq 2`; `test "$(grep -c "Deploy blocked: the 'production' environment has 5 unset or placeholder value(s)." .github/workflows/ci.yml)" -eq 1`; `test "$(grep -c "Deploy configuration OK: 9 value(s) present for the 'development' environment." .github/workflows/ci.yml)" -eq 1`; `code=0; env TARGET_ENVIRONMENT=production RENDER_SERVICE_ID='<CHANGEME-render-service-id>' RENDER_API_KEY='<CHANGEME-render-api-key>' SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='<CHANGEME-verified-sender>' SMTP_USER='<CHANGEME-smtp-login>' SMTP_PASS='<CHANGEME-smtp-key>' npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only || code=$?; test "$code" -eq 1`; `env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='CubeClicker <no-reply@example.com>' SMTP_USER=fixture SMTP_PASS=fixture npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only | grep -qx "Deploy configuration OK: 9 value(s) present for the 'development' environment."`; `npm run coverage --workspace @cubeclicker/backend`; `test -f docs/features/deploy-brevo-env-placeholders/build-log-T4.md`; `! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/deploy-brevo-env-placeholders/build-log-T4.md`
acceptance: AC-8
status: [x]

Add the two credential-free steps to `verify-workflows` after the existing config checks, using step-level `env:` mappings (never `NAME=` strings, so the credential guard cannot match the fixtures) with the pinned placeholder and complete fixtures. The reject step must invoke the exact CLI and assert a non-zero exit plus the AC-4(a) header; the accept step must invoke the same CLI and assert exit 0 plus the AC-4(b) line. The `run` blocks contain the exact CLI invocation and the expected output string (not a tautological `echo`), so the `verify` content greps are meaningful. Every fixture value is an angle-bracket placeholder or shorter than 12 characters. Do not reorder or modify the existing `verify-app`, `smoke-e2e` or workflow-check steps.

## T5 — Create the GitHub Environment placeholders `[seq]`
depends_on: T4
files_owned: `docs/features/deploy-brevo-env-placeholders/build-log-T5.md`
external_side_effects: GitHub Environments `development` and `production` (variables and secrets) — owner-authorized; builder-executable only when the write-permission probes pass, otherwise owner-executed with builder-recorded names-only evidence
verify:
```bash
set -euo pipefail
gh auth status
code=0; out=$(printf '{}' | gh api --method PUT repos/raultorres2603/CubeClicker/environments/development/secrets/__write_permission_probe --input - 2>&1) || code=$?
if [ "$code" -eq 0 ]; then gh secret delete __write_permission_probe --env development --repo raultorres2603/CubeClicker; else printf '%s' "$out" | grep -qE 'HTTP (400|422)'; fi
code=0; out=$(printf '{}' | gh api --method POST repos/raultorres2603/CubeClicker/environments/development/variables --input - 2>&1) || code=$?
if [ "$code" -eq 0 ]; then gh variable delete __write_permission_probe --env development --repo raultorres2603/CubeClicker; else printf '%s' "$out" | grep -qE 'HTTP (400|422)'; fi
gh api repos/raultorres2603/CubeClicker/environments --jq '.environments[].name' | grep -qx development
gh api repos/raultorres2603/CubeClicker/environments --jq '.environments[].name' | grep -qx production
gh api repos/raultorres2603/CubeClicker/environments/development --jq '.name' | grep -qx development
gh api repos/raultorres2603/CubeClicker/environments/production --jq '.name' | grep -qx production
dev_vars=$(gh variable list --env development --repo raultorres2603/CubeClicker --json name --jq '.[].name')
dev_secrets=$(gh secret list --env development --repo raultorres2603/CubeClicker --json name --jq '.[].name')
prod_vars=$(gh variable list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name')
prod_secrets=$(gh secret list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name')
for n in SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_CONNECTION_TIMEOUT_MS SMTP_FROM RENDER_SERVICE_ID; do printf '%s\n' "$dev_vars" | grep -qx "$n"; done
for n in SMTP_USER SMTP_PASS RENDER_API_KEY; do printf '%s\n' "$dev_secrets" | grep -qx "$n"; done
! printf '%s\n' "$dev_vars" | grep -qx SMTP_USER
for n in SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_CONNECTION_TIMEOUT_MS SMTP_FROM RENDER_SERVICE_ID; do printf '%s\n' "$prod_vars" | grep -qx "$n"; done
for n in SMTP_USER SMTP_PASS RENDER_API_KEY; do printf '%s\n' "$prod_secrets" | grep -qx "$n"; done
! printf '%s\n' "$prod_vars" | grep -qx SMTP_USER
log=docs/features/deploy-brevo-env-placeholders/build-log-T5.md
test -f "$log"
for p in 'SMTP_SECURE|false' 'SMTP_CONNECTION_TIMEOUT_MS|10000'; do n=${p%%|*}; v=${p#*|}; grep -qF "gh variable set $n --env development --repo raultorres2603/CubeClicker --body '$v'" "$log"; done
grep -qF "gh variable set RENDER_SERVICE_ID --env development --repo raultorres2603/CubeClicker --body 'srv-dbtcvv9srm7s73au5bag'" "$log"
grep -qF "gh secret set RENDER_API_KEY --env development --repo raultorres2603/CubeClicker --body '<CHANGEME-render-api-key>'" "$log"
for n in SMTP_HOST SMTP_PORT SMTP_FROM SMTP_PASS; do grep -qF "$n: preserved (existing)" "$log"; done
if grep -qF 'SMTP_USER: preserved (existing); variable value moved to the secret, never printed' "$log"; then
  grep -qF 'gh variable get SMTP_USER --env development --repo raultorres2603/CubeClicker' "$log"
  grep -qF 'gh variable delete SMTP_USER --env development --repo raultorres2603/CubeClicker' "$log"
else
  grep -qF 'SMTP_USER: placeholder created (variable absent)' "$log"
  grep -qF "gh secret set SMTP_USER --env development --repo raultorres2603/CubeClicker --body '<CHANGEME-smtp-login>'" "$log"
fi
! grep -qF 'gh variable set SMTP_HOST --env development' "$log"
! grep -qF 'gh variable set SMTP_PORT --env development' "$log"
! grep -qF 'gh variable set SMTP_FROM --env development' "$log"
! grep -qF 'gh secret set SMTP_PASS --env development' "$log"
for p in 'SMTP_HOST|smtp-relay.brevo.com' 'SMTP_PORT|587' 'SMTP_SECURE|false' 'SMTP_CONNECTION_TIMEOUT_MS|10000' 'SMTP_FROM|<CHANGEME-verified-sender>'; do n=${p%%|*}; v=${p#*|}; grep -qF "gh variable set $n --env production --repo raultorres2603/CubeClicker --body '$v'" "$log"; done
grep -qF "gh variable set RENDER_SERVICE_ID --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-render-service-id>'" "$log"
for p in 'SMTP_USER|<CHANGEME-smtp-login>' 'SMTP_PASS|<CHANGEME-smtp-key>' 'RENDER_API_KEY|<CHANGEME-render-api-key>'; do n=${p%%|*}; v=${p#*|}; grep -qF "gh secret set $n --env production --repo raultorres2603/CubeClicker --body '$v'" "$log"; done
grep -qF 'Existing development values preserved by owner decision' "$log"
grep -qF 'SMTP_PASS was not read or overwritten' "$log"
grep -qF 'deploy guard will still block until' "$log"
grep -qF 'Merge-ordering warning' "$log"
grep -qE 'HTTP 422|HTTP 400' "$log"
for n in SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_CONNECTION_TIMEOUT_MS SMTP_FROM SMTP_USER SMTP_PASS RENDER_SERVICE_ID RENDER_API_KEY; do grep -q "$n" "$log"; done
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" "$log"
```
acceptance: AC-2(b), AC-9(c), AC-10(a)
status: [x]

Run the two write-permission probes first. Record their exact status lines (`HTTP 422`/`HTTP 400`; never a body) and the GitHub endpoint-permission citation (classic `repo`, or fine-grained **Environments: Read and write**) in `build-log-T5.md`. Each probe is a validation-failure check: GitHub authorizes the request before it rejects the missing required body, so an empty JSON body to the environment-secret `PUT` or the environment-variable `POST` returns HTTP 422 (or 400) and creates nothing; a 403/404 means the token lacks the write permission. If either probe is not 422/400 (and does not unexpectedly succeed), **stop and report `blocked (user-owned): GitHub environment write permission unavailable`** with the exact commands in `verify`. The owner then runs the same `gh` commands — the GitHub UI may be used only to enter values — and returns the names-only `gh` listings; the builder records them in `build-log-T5.md` and re-runs the read-only half of `verify`. Do not fabricate listings and do not use UI-only evidence.

If the probes pass, apply the owner's 2026-11-22 decision — **preserve the existing `development` values, add only the missing names** — with this exact sequence. The two listings are the names-only pre-state; every create is conditional, so a re-run is idempotent:

```bash
dev_vars_before=$(gh variable list --env development --repo raultorres2603/CubeClicker --json name --jq '.[].name')
dev_secrets_before=$(gh secret list --env development --repo raultorres2603/CubeClicker --json name --jq '.[].name')
if ! printf '%s\n' "$dev_vars_before" | grep -qx SMTP_SECURE; then gh variable set SMTP_SECURE --env development --repo raultorres2603/CubeClicker --body 'false'; fi
if ! printf '%s\n' "$dev_vars_before" | grep -qx SMTP_CONNECTION_TIMEOUT_MS; then gh variable set SMTP_CONNECTION_TIMEOUT_MS --env development --repo raultorres2603/CubeClicker --body '10000'; fi
if ! printf '%s\n' "$dev_vars_before" | grep -qx RENDER_SERVICE_ID; then gh variable set RENDER_SERVICE_ID --env development --repo raultorres2603/CubeClicker --body 'srv-dbtcvv9srm7s73au5bag'; fi
if ! printf '%s\n' "$dev_secrets_before" | grep -qx RENDER_API_KEY; then gh secret set RENDER_API_KEY --env development --repo raultorres2603/CubeClicker --body '<CHANGEME-render-api-key>'; fi
if printf '%s\n' "$dev_vars_before" | grep -qx SMTP_USER; then
  smtp_user_value=$(gh variable get SMTP_USER --env development --repo raultorres2603/CubeClicker)
  printf '%s' "$smtp_user_value" | gh secret set SMTP_USER --env development --repo raultorres2603/CubeClicker
  unset smtp_user_value
  gh variable delete SMTP_USER --env development --repo raultorres2603/CubeClicker
elif ! printf '%s\n' "$dev_secrets_before" | grep -qx SMTP_USER; then
  gh secret set SMTP_USER --env development --repo raultorres2603/CubeClicker --body '<CHANGEME-smtp-login>'
fi
```

The `SMTP_USER` value is read only to be piped into `gh secret set`; it is never echoed, logged, recorded or passed as a command argument. `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` and `SMTP_PASS` are not read or written. Then create the `production` placeholders (unchanged; `production` has none today and stays placeholder-only):

```bash
gh variable set SMTP_HOST --env production --repo raultorres2603/CubeClicker --body 'smtp-relay.brevo.com'
gh variable set SMTP_PORT --env production --repo raultorres2603/CubeClicker --body '587'
gh variable set SMTP_SECURE --env production --repo raultorres2603/CubeClicker --body 'false'
gh variable set SMTP_CONNECTION_TIMEOUT_MS --env production --repo raultorres2603/CubeClicker --body '10000'
gh variable set SMTP_FROM --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-verified-sender>'
gh secret set SMTP_USER --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-smtp-login>'
gh secret set SMTP_PASS --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-smtp-key>'
gh variable set RENDER_SERVICE_ID --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-render-service-id>'
gh secret set RENDER_API_KEY --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-render-api-key>'
```

Record in `build-log-T5.md`, names only: the exact commands actually run for the created `development` names (the four create commands plus the migration commands when the variable was present), the nine production commands, both final names-only listings, and one explicit entry per untouched development name — `SMTP_HOST: preserved (existing)`, `SMTP_PORT: preserved (existing)`, `SMTP_FROM: preserved (existing)`, `SMTP_PASS: preserved (existing)`, `SMTP_USER: preserved (existing); variable value moved to the secret, never printed` (or, only if the variable was absent, `SMTP_USER: placeholder created (variable absent)` plus the placeholder `gh secret set` line). Add these statements: `Existing development values preserved by owner decision`; `SMTP_PASS was not read or overwritten`; the strict guard will still block (`deploy guard will still block until`) the missing placeholder secrets `RENDER_API_KEY` and — if the variable was absent — `SMTP_USER`, plus any other missing or placeholder value; and the `Merge-ordering warning` that the first development deploy after merge is blocked until the `RENDER_API_KEY` placeholder is filled. The decision supersedes the earlier Q-2 overwrite plan; the live Render service keeps its dashboard values until the first sync. If any expected name is missing from the final listings, or `SMTP_USER` remains a variable, fail the verify.

## T6 — Runbook and architecture documentation `[seq]`
depends_on: T5
files_owned: `README.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/features/deploy-brevo-env-placeholders/build-log-T6.md`
verify:
```bash
set -euo pipefail
grep -qF '### Deployment Brevo runbook' README.md
grep -qF 'Settings → Environments' README.md
grep -qF 'Environment variables' README.md
grep -qF 'Environment secrets' README.md
grep -qF 'never as a command argument' README.md
grep -qF 'stdin' README.md
grep -qF 'gh variable list --env development' README.md
grep -qF 'gh secret list --env development' README.md
grep -qF 'gh variable list --env production' README.md
grep -qF 'gh secret list --env production' README.md
grep -qF "gh api repos/raultorres2603/CubeClicker/environments --jq '.environments[].name'" README.md
! grep -qF "gh api repos/raultorres2603/CubeClicker/environments --jq '.[].name'" README.md
grep -qF "gh api repos/raultorres2603/CubeClicker/environments/development --jq '.name'" README.md
grep -qF "gh api repos/raultorres2603/CubeClicker/environments/production --jq '.name'" README.md
grep -qF 'Deploys → Rollback' README.md
grep -qF 'before this feature merges to main' README.md
grep -qF 'SYNCED <KEY>' README.md
grep -qF 'curl -fsS "$VITE_API_URL/healthz"' README.md
grep -qF 'registration from the deployed frontend' README.md
grep -qF 'local `npm run email:test` equivalent' README.md
grep -qF 'Deployed proof (user-owned)' README.md
grep -qF 'never as verification evidence' README.md
grep -qF 'Render dashboard lists the seven keys' README.md
grep -qF 're-run the deploy workflow' README.md
grep -qF 'rotate it in Render' README.md
grep -qF 'preserved development values are already in place' README.md
grep -qE 'production.*has no such variable today' README.md
grep -qF 'Render deploy list' README.md
grep -qF 'from the GitHub Environment' README.md
grep -qF 'preserves the existing development values' README.md
grep -qF 'gh variable get SMTP_USER --env development' README.md
grep -qF 'gh variable delete SMTP_USER --env development' README.md
grep -qF 'gh variable delete SMTP_USER --env production' README.md
grep -qF 'if gh variable list --env development' README.md
grep -qF 'if gh variable list --env production' README.md
grep -qF 'variables and secrets are separate' README.md
grep -qF 'nine validated, seven synced' README.md
grep -qF 'never written to the Render service' README.md
grep -qF 'RENDER_API_KEY' README.md
for e in development production; do for p in 'SMTP_HOST|smtp-relay.brevo.com' 'SMTP_PORT|587' 'SMTP_SECURE|false' 'SMTP_CONNECTION_TIMEOUT_MS|10000' 'SMTP_FROM|<CHANGEME-verified-sender>'; do n=${p%%|*}; v=${p#*|}; grep -qF "gh variable set $n --env $e --repo raultorres2603/CubeClicker --body '$v'" README.md; done; done
grep -qF "gh variable set RENDER_SERVICE_ID --env development --repo raultorres2603/CubeClicker --body 'srv-dbtcvv9srm7s73au5bag'" README.md
grep -qF "gh variable set RENDER_SERVICE_ID --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-render-service-id>'" README.md
for e in development production; do for p in 'SMTP_USER|<CHANGEME-smtp-login>' 'SMTP_PASS|<CHANGEME-smtp-key>' 'RENDER_API_KEY|<CHANGEME-render-api-key>'; do n=${p%%|*}; v=${p#*|}; grep -qF "gh secret set $n --env $e --repo raultorres2603/CubeClicker --body '$v'" README.md; done; done
! grep -qF 'or set them on the Render service' README.md
grep -qF 'deploy workflow syncs the seven SMTP names' README.md
grep -qF 'GitHub Environment is the source' README.md
grep -qE '^- Secrets: .*SMTP_USER' README.md
grep -qE '^- Secrets: .*RENDER_API_KEY' README.md
! grep -qE '^- Variables: .*SMTP_USER' README.md
grep -qE '^- Variables: .*RENDER_SERVICE_ID' README.md
! grep -qE 'the Render service reads .*SMTP_HOST' README.md
! grep -qF 'from the dashboard' README.md
! grep -qF 'in the Render dashboard service variables and in the GitHub' README.md
! grep -qF 'with no secrets, variables or protection rules yet' README.md
! grep -qF 'has no secrets, variables or protection rules' README.md
grep -qF 'placeholder-only' README.md
grep -qF 'no Render service, Vercel project or Neon branch is provisioned' README.md
grep -qF 'Guard rejects placeholder values' README.md
grep -qF 'Guard accepts a complete value set' README.md
node -e "const t=require('node:fs').readFileSync('README.md','utf8');const s=t.slice(t.indexOf('### What the pipelines run'),t.indexOf('### Deploy flow'));const i=s.indexOf('verify-workflows'),a=s.indexOf('Guard rejects placeholder values',i),b=s.indexOf('Guard accepts a complete value set',i);if(!(i>=0&&a>i&&b>i))throw new Error('README verify-workflows guard steps missing');console.log('README verify-workflows guard steps OK')"
node -e "const t=require('node:fs').readFileSync('README.md','utf8');const s=t.slice(t.indexOf('### What the pipelines run'),t.indexOf('### Deploy flow'));const a=s.indexOf('Check deployment Brevo configuration'),b=s.indexOf('Neon migration'),c=s.indexOf('Sync Brevo SMTP settings to Render'),d=s.indexOf('Render deploy hook');if(!(a>=0&&b>a&&c>b&&d>c))throw new Error('README What the pipelines run deploy order missing check < migration < sync < hook');console.log('README What the pipelines run deploy order OK')"
node -e "const t=require('node:fs').readFileSync('README.md','utf8');const s=t.slice(t.indexOf('### Deploy flow'),t.indexOf('### User-side asset checklist'));const a=s.indexOf('Check deployment Brevo configuration'),b=s.indexOf('Neon migration'),c=s.indexOf('Sync Brevo SMTP settings to Render'),d=s.indexOf('Render deploy hook');if(!(a>=0&&b>a&&c>b&&d>c))throw new Error('README Deploy flow order missing check < migration < sync < hook');console.log('README Deploy flow order OK')"
! grep -qF 'Neon migration with the direct URL → Render deploy hook' README.md
grep -qF 'RENDER_API_KEY=' README.md
grep -qF 'rnd_[A-Za-z0-9_-]{20,}' README.md
grep -qF 'git log -p origin/main..HEAD' README.md
grep -qE '^- \*\*Secrets .*SMTP_USER' docs/architecture/deployment.md
grep -qE '^- \*\*Secrets .*RENDER_API_KEY' docs/architecture/deployment.md
! grep -qE '^- \*\*Variables .*SMTP_USER' docs/architecture/deployment.md
grep -qE '^- \*\*Variables .*RENDER_SERVICE_ID' docs/architecture/deployment.md
! grep -qF 'No new secret name is introduced' docs/architecture/deployment.md
! grep -qF 'every value is dashboard- or shell-supplied' docs/architecture/deployment.md
! grep -qE 'SESSION_COOKIE_SAMESITE.*SMTP_\*' docs/architecture/deployment.md
! grep -qF 'runtime-parity' docs/architecture/deployment.md
! grep -qF 'the same names, none provisioned' docs/architecture/deployment.md
! grep -qF 'has no secrets, variables, protection rules or deployment branch policy' docs/architecture/deployment.md
grep -qF 'placeholder-only' docs/architecture/deployment.md
grep -qF 'no Render service, Vercel project or Neon branch is provisioned' docs/architecture/deployment.md
grep -qF 'Guard rejects placeholder values' docs/architecture/deployment.md
grep -qF 'Guard accepts a complete value set' docs/architecture/deployment.md
node -e "const t=require('node:fs').readFileSync('docs/architecture/deployment.md','utf8');const s=t.slice(t.indexOf('## Deploy pipeline'),t.indexOf('## Neon migrations'));const i=s.indexOf('verify-workflows'),a=s.indexOf('Guard rejects placeholder values',i),b=s.indexOf('Guard accepts a complete value set',i);if(!(i>=0&&a>i&&b>i))throw new Error('deployment.md verify-workflows guard steps missing');console.log('deployment.md verify-workflows guard steps OK')"
node -e "const t=require('node:fs').readFileSync('docs/architecture/deployment.md','utf8');const s=t.slice(t.indexOf('## Deploy pipeline'),t.indexOf('## Neon migrations'));const a=s.indexOf('Check deployment Brevo configuration'),b=s.indexOf('Neon migration'),c=s.indexOf('Sync Brevo SMTP settings to Render'),d=s.indexOf('Render deploy hook');if(!(a>=0&&b>a&&c>b&&d>c))throw new Error('deployment.md deploy pipeline order missing check < migration < sync < hook');console.log('deployment.md deploy pipeline order OK')"
node -e "const t=require('node:fs').readFileSync('docs/architecture/deployment.md','utf8');const s=t.slice(t.indexOf('## Platform split and state ownership'),t.indexOf('## Environments and triggers'));const a=s.indexOf('Check deployment Brevo configuration'),b=s.indexOf('Neon migration'),c=s.indexOf('Sync Brevo SMTP settings to Render'),d=s.indexOf('Render deploy hook');if(!(a>=0&&b>a&&c>b&&d>c))throw new Error('deployment.md platform split deploy order missing check < migration < sync < hook');console.log('deployment.md platform split deploy order OK')"
! grep -qF 'Order: Neon migration (direct URL) → Render deploy hook' docs/architecture/deployment.md
! grep -qF 'checkout/install → Neon migration → Render deploy hook' docs/architecture/deployment.md
grep -qF 'the sync runs after the Neon migration and before the Render deploy hook' docs/architecture/deployment.md
! grep -qF 'Failed gates block the deploy before any provider is touched' docs/architecture/deployment.md
grep -qF 'Production holds the nine placeholder names' docs/architecture/deployment.md
! grep -qF 'Production has no secret or protection configured yet' docs/architecture/deployment.md
grep -qF 'nine validated, seven synced' docs/architecture/deployment.md
grep -qF 'never written to the Render service' docs/architecture/deployment.md
grep -qF 'synced from the GitHub Environment' docs/architecture/deployment.md
grep -qF 'Check deployment Brevo configuration' docs/architecture/deployment.md
grep -qF 'Sync Brevo SMTP settings to Render' docs/architecture/deployment.md
grep -qF 'stay dashboard-owned' docs/architecture/deployment.md
grep -qF 'never synced' docs/architecture/deployment.md
grep -qF 'nine validated, seven synced' docs/architecture/vercel-render-neon.md
grep -qE '^\| .*RENDER_API_KEY.*\| secret \|' docs/architecture/vercel-render-neon.md
grep -qE '^\| .*RENDER_SERVICE_ID.*\| var \|' docs/architecture/vercel-render-neon.md
grep -qE '^\| .*SMTP_USER.*\| secret \|' docs/architecture/vercel-render-neon.md
! grep -qE '^\| .*SMTP_USER.*\| vars? \|' docs/architecture/vercel-render-neon.md
! grep -qF 'runtime-parity names are documented so the catalog is complete even though only the Render service consumes them' docs/architecture/vercel-render-neon.md
! grep -qF 'On the live service these values were set in the Render dashboard' docs/architecture/vercel-render-neon.md
! grep -qF 'dashboard-supplied' docs/architecture/vercel-render-neon.md
! grep -qF 'has no secrets, variables or protection rules yet' docs/architecture/vercel-render-neon.md
! grep -qF 'the environment has no secrets and no variables' docs/architecture/vercel-render-neon.md
grep -qF 'placeholder-only' docs/architecture/vercel-render-neon.md
grep -qF 'no Render service, Vercel project or Neon branch is provisioned' docs/architecture/vercel-render-neon.md
node -e "const t=require('node:fs').readFileSync('docs/architecture/vercel-render-neon.md','utf8');const s=t.slice(t.indexOf('## Architecture'),t.indexOf('## Environment catalog'));const a=s.indexOf('Check deployment Brevo configuration'),b=s.indexOf('Neon migration'),c=s.indexOf('Sync Brevo SMTP settings to Render'),d=s.indexOf('Render deploy hook');if(!(a>=0&&b>a&&c>b&&d>c))throw new Error('vercel-render-neon architecture deploy order missing check < migration < sync < hook');console.log('vercel-render-neon architecture deploy order OK')"
node -e "const t=require('node:fs').readFileSync('docs/architecture/vercel-render-neon.md','utf8');const s=t.slice(t.indexOf('### Routine development deploy'),t.indexOf('### Verification commands'));const a=s.indexOf('Check deployment Brevo configuration'),b=s.indexOf('Neon migration'),c=s.indexOf('Sync Brevo SMTP settings to Render'),d=s.indexOf('RENDER_DEPLOY_HOOK_URL');if(!(a>=0&&b>a&&c>b&&d>c))throw new Error('vercel-render-neon routine deploy order missing check < migration < sync < hook');console.log('vercel-render-neon routine deploy order OK')"
! grep -qF 'Order is fixed: **Neon migration with the direct URL → Render deploy hook' docs/architecture/vercel-render-neon.md
! grep -qF 'Nothing is provisioned today' docs/architecture/vercel-render-neon.md
! grep -qF 'fails on the first missing production secret' docs/architecture/vercel-render-neon.md
grep -qF 'fails at the Brevo placeholder guard' docs/architecture/vercel-render-neon.md
! grep -qF 'check the Render service variables' docs/architecture/vercel-render-neon.md
grep -qF 'check the GitHub' docs/architecture/vercel-render-neon.md
! grep -qF 'use the Render dashboard/API for `sync: false` values and GitHub Environment secrets' docs/architecture/vercel-render-neon.md
grep -qF 'the seven SMTP names are synced from the GitHub Environment' docs/architecture/vercel-render-neon.md
grep -qF 'never written to the Render service' docs/architecture/vercel-render-neon.md
grep -qF 'synced from the GitHub Environment' docs/architecture/vercel-render-neon.md
grep -qF 'Placeholder guard' docs/architecture/vercel-render-neon.md
grep -qF 'GitHub Environment (synced to Render for the seven SMTP names)' docs/architecture/vercel-render-neon.md
grep -qF 'stay dashboard-owned' docs/architecture/vercel-render-neon.md
grep -qF 'never synced' docs/architecture/vercel-render-neon.md
grep -qF 'Check deployment Brevo configuration' docs/architecture/vercel-render-neon.md
grep -qF 'Sync Brevo SMTP settings to Render' docs/architecture/vercel-render-neon.md
test -f docs/features/deploy-brevo-env-placeholders/build-log-T6.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/deploy-brevo-env-placeholders/build-log-T6.md
```
acceptance: AC-11, AC-12
status: [ ]

Write the README `### Deployment Brevo runbook` with every AC-11 element: the 18 exact `gh` commands, the UI path for entering values (not for verification), the four names-only list commands plus the `.environments[].name` listing and the single-environment fallback forms, the stdin/never-argv rule, the user-owned deployed proof (seven `SYNCED` lines, the deploy-list check, `curl -fsS`, registration from the deployed frontend, local `email:test`, the Render-free no-shell caveat), rollback, merge ordering (containing `the preserved development values are already in place`), the conditional `SMTP_USER` migration (the exact `gh variable get SMTP_USER --env development` → `gh secret set SMTP_USER --env development` → `gh variable delete SMTP_USER --env development` sequence with the separate-contexts rationale), the preserve note (containing `preserves the existing development values`; the owner re-checks them; `RENDER_API_KEY` is the remaining pre-merge placeholder) and the source-of-truth note. Correct README § Email, § Secret hygiene (GitHub Environment source; guard with `RENDER_API_KEY=`/`rnd_`; branch-history command), § What the pipelines run (both guard fixture steps) and § Deploy flow (check → Neon migration → sync → Render hook; the old direct migration → hook sequence is gone), and § User-side asset checklist (`SMTP_USER` and `RENDER_API_KEY` secrets; `RENDER_SERVICE_ID` variable; drop `SMTP_USER` from variables; sync wording). Update `docs/architecture/deployment.md` § Platform split (deploy order), § Secrets and variables, § Environments and triggers, § Deploy pipeline (CI `verify-workflows` guard steps; deploy order; the "Failed gates block the deploy before any provider is touched" sentence becomes "the sync runs after the Neon migration and before the Render deploy hook"; the old `Order: Neon migration (direct URL) → Render deploy hook` and `checkout/install → Neon migration → Render deploy hook` sequences are gone) and § Security and credential posture (`Production holds the nine placeholder names`; the old "Production has no secret or protection configured yet" is gone), and `docs/architecture/vercel-render-neon.md` § Architecture and § Routine development deploy (check → Neon migration → sync → hook), § Environment catalog, § Render service environment, § SMTP and email, § Runbook, § Promote to production ("Nothing is provisioned today" → `no Render service, Vercel project or Neon branch is provisioned`; "fails on the first missing production secret" → `fails at the Brevo placeholder guard`), § Troubleshooting (email says `check the GitHub` source, not `check the Render service variables`; `Placeholder guard` entry), § Operating rules (`the seven SMTP names are synced from the GitHub Environment`; the old `use the Render dashboard/API for `sync: false` values and GitHub Environment secrets` sentence is gone) and § Local development vs cloud with the exact AC-12 statements. Correct the production "no secrets/variables" statements in all three to `placeholder-only` names with no Render/Vercel/Neon asset or protection rule provisioned. State in all three that GitHub is the source of truth for the nine validated/seven synced names, that `RENDER_API_KEY`/`RENDER_SERVICE_ID` are never written to Render, that the other `sync: false` names stay dashboard-owned, and that a dashboard edit to a synced name is overwritten on the next deploy. Do not edit `docs/features/README.md`.

## T7 — Verify & integrate `[seq]`
depends_on: T6
files_owned: `docs/features/deploy-brevo-env-placeholders/build-log-T7.md`
verify:
```bash
set -euo pipefail
npm ci
npm run lint
npm run typecheck
npm test
npm run coverage
npm run build
git diff --exit-code origin/main...HEAD -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/backend/src/app.ts render.yaml src/backend/src/auth
test -z "$(git diff --name-only origin/main...HEAD -- '.env*')"
env -u SMTP_HOST -u SMTP_PORT -u SMTP_USER -u SMTP_PASS -u SMTP_SECURE -u SMTP_FROM -u SMTP_CONNECTION_TIMEOUT_MS podman compose --env-file /dev/null -f compose.yaml config | node -e "let s='';process.stdin.on('data',(d)=>{s+=d}).on('end',()=>{const yaml=require('js-yaml');const c=yaml.load(s);const e=c.services.backend.environment||{};const get=(k)=>Array.isArray(e)?(e.find((x)=>x.startsWith(k+'='))||'').slice(k.length+1):e[k];const host=get('SMTP_HOST');const port=String(get('SMTP_PORT'));if(host!=='mailpit'||port!=='1025')throw new Error('backend SMTP must resolve to mailpit:1025 without SMTP env; got '+JSON.stringify({host,port}));console.log('compose backend SMTP resolves to mailpit:1025 with no SMTP env')})"
podman compose -f compose.yaml -f compose.smoke.yaml down --remove-orphans
podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit
npm run smoke
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml
node -e "JSON.parse(require('node:fs').readFileSync('src/frontend/vercel.json','utf8'));console.log('vercel.json: valid JSON')"
node -e "const fs=require('node:fs');const yaml=require('js-yaml');const b=yaml.load(fs.readFileSync('render.yaml','utf8'));if(!Array.isArray(b.services)||b.services.length!==1)throw new Error('render.yaml must declare exactly one service');const s=b.services[0];if(s.name!=='cubeclicker-development'||s.runtime!=='docker'||s.plan!=='free')throw new Error('unexpected render.yaml service');console.log('render.yaml: valid YAML')"
code=0; env TARGET_ENVIRONMENT=production RENDER_SERVICE_ID='<CHANGEME-render-service-id>' RENDER_API_KEY='<CHANGEME-render-api-key>' SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='<CHANGEME-verified-sender>' SMTP_USER='<CHANGEME-smtp-login>' SMTP_PASS='<CHANGEME-smtp-key>' npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only || code=$?; test "$code" -eq 1
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='CubeClicker <no-reply@example.com>' SMTP_USER=fixture SMTP_PASS=fixture npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only | grep -qx "Deploy configuration OK: 9 value(s) present for the 'development' environment."
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='CubeClicker <no-reply@example.com>' SMTP_USER=fixture SMTP_PASS=fixture npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --dry-run | grep -qx "DRY RUN complete: 9 value(s) validated for the 'development' environment; 7 would be synced; no network calls made."
node -e "const cases=[['render-assigned','RENDER_API_KEY='+'a'.repeat(16),/RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}/],['render-shape','rnd_'+'b'.repeat(24),/rnd_[A-Za-z0-9_-]{20,}/],['smtp-assigned','SMTP_PASS='+'c'.repeat(15),/SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}/],['brevo-rest','xkeysib-'+'d'.repeat(20),/xkeysib-[A-Za-z0-9]{20,}/],['brevo-smtp','xsmtpsib-'+'e'.repeat(15),/xsmtpsib-[A-Za-z0-9]{15,}/]];for(const [label,value,re] of cases){if(!re.test(value))throw new Error('guard pattern misses '+label)}const allowed=['RENDER_API_KEY=<CHANGEME-render-api-key>','RENDER_API_KEY=fixture-key','SMTP_USER=<CHANGEME-smtp-login>','SMTP_PASS=<CHANGEME-smtp-key>'];for(const value of allowed){if(/RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}/.test(value))throw new Error('guard rejects a documented placeholder: '+value)}console.log('credential guard self-test: Render/SMTP key shapes matched, placeholders allowed')"
# Re-run the T6 verify block verbatim (the reproducible documentation gate).
bash -c "$(sed -n '/^## T6 /,/^## T7 /p' docs/features/deploy-brevo-env-placeholders/tasks.md | sed -n '/^```bash/,/^```/p' | sed '1d;$d')"
test -f docs/features/deploy-brevo-env-placeholders/build-log-T7.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/deploy-brevo-env-placeholders/build-log-T7.md
! git grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
! git grep --untracked -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
! git diff origin/main...HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
! git log -p origin/main..HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
```
acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12
status: [ ]

Run the full suite above and record raw output in `build-log-T7.md`, including the AC coverage table and the user-owned/pending items. The AC-1 proof set (protected-file diff, `.env*` check, hermetic compose config, clean-stack Mailpit smoke) and the guard self-test are part of the final gate; record their raw output. Re-run the whole T6 grep set (the `bash -c` extraction is the reproducible documentation gate) and record it. The deployed proof is **user-owned and pending by design**: after the owner supplies the `development` `RENDER_API_KEY` value (the preserved development values stay as they are), the first development deploy must show seven `SYNCED <KEY>` lines, the Render deploy list must show no deploy between the sync and the hook (or the documented mitigation is applied and recorded), the Render dashboard must list the seven keys, `curl -fsS "$VITE_API_URL/healthz"` must return `{"status":"ok"}`, and a registration from the deployed frontend must deliver to an owner-controlled mailbox; record it as pending with the exact commands the owner runs. Propose (do not apply) the `docs/features/README.md` row diff in the build log for the orchestrator, and list the two merge-ordering checkpoints: the `development` `RENDER_API_KEY` placeholder must be filled before this feature merges to `main` (the preserved development values are already in place), and `production` remains placeholder-only until provisioned. If `npm run smoke` needs a clean stack, tear it down first with `podman compose -f compose.yaml -f compose.smoke.yaml down --remove-orphans` and note it in the build log.
