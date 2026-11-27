# Tasks — Brevo HTTPS Email Transport (deployed environments)

Revision r3 (2026-11-26): tasks extended for spec-review r2 F1–F3/F19–F23 — exhaustive stale-doc negatives and README runbook, compose top-level diff mapped to AC-10(c), `render.yaml` other-entry diff, angle-only local sender, `<commit>` evidence rule and T8 fallback/`SMTP_FROM`/`GH_REPO` markers. Builder-blocker amendment: T4 now absorbs the former T5 so `render-env.ts`, `render-env-cli.ts`, their tests, `render.yaml` and both workflows change in one sequential task with no intermediate 9→11 red state; T6/T7/T8 keep their numbers. T7 preflight amendment: the repository credential audit excludes synthetic assignment fixtures in `*.test.ts`/`*.spec.ts` by path while real key-shape patterns remain strict everywhere, and the feature-index check reads committed `origin/main...HEAD` changes. The 11/9/6 counts and all ACs are unchanged.

Dependency overview: **T1 → T2 → T3**; **T1 → T4**; **T2, T3, T4 → T6 → T7 → T8**. T5 is merged into T4 (the deploy catalog, guard, CLI, workflows and `render.yaml` change together, with no intermediate 9→11 state); T6/T7/T8 keep their numbers so the approved spec's AC evidence references stay valid. Every remaining task is `[seq]`: all behavior tasks run backend-workspace coverage in the same working tree, and the docs and final-gate tasks depend on the shipped code; parallel execution would race on coverage output, test caches and the commit surface. No `[P]` batch is declared. Catalog counts: **11 validated / 9 synced / 6 production placeholders**.

Every task records raw evidence in its own build log under `docs/features/brevo-api-email-transport/` and every verify includes the shared build-log guard below. T8 is **owner-owned**: no agent writes GitHub/Render/Brevo state, creates or reads a key, or sends email; T8 is owner-attested and not CI-reproducible.

## Shared build-log guard (AC-12(e))

Every task's verify defines and applies this exact extended regex to its own log; T7 applies it in a loop over every `docs/features/brevo-api-email-transport/build-log-*.md`. It covers addresses, `verify?token=`, bare 32+ hex tokens, SMTP/Render/Brevo key shapes, and YAML/shell assignments including `BREVO_API_KEY:`. It never prints a match.

```bash
log_guard="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|verify\?token=|[0-9a-f]{32,}|xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|rnd_[A-Za-z0-9_-]{20,}|(SMTP_(USER|PASS)|BREVO_API_KEY|RENDER_API_KEY)[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9+/_-]{12,}"
```

T8 additionally requires the owner-supplied `CUBECLICKER_USERNAME_PATTERN`; the value is never recorded in the artifact. The repository-wide credential audit in T7 uses the credential-only subset of the same pattern (no address/bare-token alternative), because architecture documentation legitimately contains local/fixture addresses.

## T1 — Transport configuration, sender parsing, and local defaults `[seq]`
depends_on: —
files_owned: `src/backend/src/auth/config.ts`, `src/backend/src/auth/config.test.ts`, `compose.yaml`, `compose.smoke.yaml`, `docs/features/brevo-api-email-transport/build-log-T1.md`
verify:
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
acceptance: AC-1, AC-2, AC-10(a), AC-10(c)
status: [x]

Add `EmailTransportKind`, `emailTransport`, `brevoApiKey` and `parseEmailSender` to `auth/config.ts`. Default `EMAIL_TRANSPORT` to `smtp` for every `NODE_ENV`; honor an explicit `smtp` or `brevo-api` in every `NODE_ENV`; reject unknown values, a missing key in API mode, and an unparseable/local `SMTP_FROM` with the exact AC-1 messages. Accept bare, angle-only `<address>` and `Display Name <address>` sender forms; pin that unset/empty `SMTP_FROM` throws the existing `SMTP_FROM must be a non-empty string; received ""` before the parse error, while whitespace-only throws the AC-1(g) parse error. Keep every existing SMTP parse and error byte-identical. In `compose.yaml` add `EMAIL_TRANSPORT`/`BREVO_API_KEY` pass-throughs with `smtp`/empty defaults; pin the same in `compose.smoke.yaml`. Do not add a service, port, volume or healthcheck.

## T2 — Brevo API service and operator CLI `[seq]`
depends_on: T1
files_owned: `src/backend/src/auth/email.ts`, `src/backend/src/auth/email.test.ts`, `src/backend/src/auth/email-cli.ts`, `src/backend/src/auth/email-cli.test.ts`, `docs/features/brevo-api-email-transport/build-log-T2.md`
verify:
```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend
npm run coverage --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend -- src/auth/email-cli.test.ts
grep -q "https://api.brevo.com/v3/smtp/email" src/backend/src/auth/email.ts
grep -q "https://api.brevo.com/v3/account" src/backend/src/auth/email.ts
grep -q "BREVO_API_TIMEOUT_MS" src/backend/src/auth/email.ts
log=docs/features/brevo-api-email-transport/build-log-T2.md
test -f "$log"
log_guard="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|verify\?token=|[0-9a-f]{32,}|xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|rnd_[A-Za-z0-9_-]{20,}|(SMTP_(USER|PASS)|BREVO_API_KEY|RENDER_API_KEY)[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9+/_-]{12,}"
! grep -qE "$log_guard" "$log"
```
acceptance: AC-3, AC-4, AC-9
status: [x]

Add `BrevoApiEmailService` and `createEmailService`; extend `EmailDeliveryError` with `transport` while keeping the existing SMTP constructor form and verbatim SMTP message. Pin the exact request URL/method/headers/body, template reuse, 10-second `AbortSignal.timeout`, fixed error messages, `HTTP_<status>` codes, no response-body reads and `GET /v3/account` verification. Assert the exported `BREVO_API_TIMEOUT_MS` equals `10000` in `email.test.ts` (the source spelling is not acceptance evidence). Update the email CLI to select the transport through `createEmailService`, print the exact API success/failure/config lines, and redact `BREVO_API_KEY`; leave every SMTP line and argument path unchanged.

## T3 — Runtime transport selection, startup probe and 502 logging `[seq]`
depends_on: T2
files_owned: `src/backend/src/app.ts`, `src/backend/src/app.test.ts`, `src/backend/src/auth/auth-routes.ts`, `src/backend/src/auth/auth-routes.test.ts`, `docs/features/brevo-api-email-transport/build-log-T3.md`
verify:
```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend
npm run coverage --workspace @cubeclicker/backend
grep -q "brevo_api_transport_verify_ok" src/backend/src/app.ts
grep -q "brevo_api_transport_verify_failed" src/backend/src/app.ts
grep -q "brevo_api_transport_verify_skipped" src/backend/src/app.ts
grep -q "error.transport" src/backend/src/auth/auth-routes.ts
log=docs/features/brevo-api-email-transport/build-log-T3.md
test -f "$log"
log_guard="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|verify\?token=|[0-9a-f]{32,}|xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|rnd_[A-Za-z0-9_-]{20,}|(SMTP_(USER|PASS)|BREVO_API_KEY|RENDER_API_KEY)[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9+/_-]{12,}"
! grep -qE "$log_guard" "$log"
```
acceptance: AC-5, AC-6
status: [x]

Replace the inline SMTP construction in `buildApp` with `createEmailService` and add the `brevoRequest` seam; keep `emailTransportFactory` for SMTP only. Gate the `onReady` probe by transport, never await it, and log the exact `brevo_api_transport_verify_*` events with fields only. Add `transport` to `verification_email_delivery_failed` without changing the exact 502 body, the resend behavior or `auth-service.ts`. Tests must prove a never-settling API probe still serves `/healthz`, the token from a rejected API send no longer consumes, and a later resend returns the exact 202 body and sends once.

## T4 — Deploy catalog, guard, CLI, workflows and `render.yaml` (absorbs T5) `[seq]`
depends_on: T1
files_owned: `src/backend/src/deploy/render-env.ts`, `src/backend/src/deploy/render-env.test.ts`, `src/backend/src/deploy/render-env-cli.ts`, `src/backend/src/deploy/render-env-cli.test.ts`, `render.yaml`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `docs/features/brevo-api-email-transport/build-log-T4.md`
verify:
```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend
npm run coverage --workspace @cubeclicker/backend
node -e "const fs=require('node:fs');const yaml=require('js-yaml');const b=yaml.load(fs.readFileSync('render.yaml','utf8'));const s=b.services[0];for(const k of ['EMAIL_TRANSPORT','BREVO_API_KEY']){const e=s.envVars.find((x)=>x.key===k);if(!e)throw new Error(k+' missing');if(e.sync!==false)throw new Error(k+' must be sync:false');if(Object.prototype.hasOwnProperty.call(e,'value'))throw new Error(k+' must not declare a value');}console.log('render.yaml: EMAIL_TRANSPORT + BREVO_API_KEY sync:false')"
node - <<'NODE'
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const yaml=require('js-yaml');
const base=yaml.load(execFileSync('git',['show','origin/main:render.yaml'],{encoding:'utf8'}));
const now=yaml.load(fs.readFileSync('render.yaml','utf8'));
const filter=(b)=>{const s=b.services[0];const out={...s,envVars:s.envVars.filter((e)=>!['EMAIL_TRANSPORT','BREVO_API_KEY'].includes(e.key))};return out;};
if(JSON.stringify(filter(now))!==JSON.stringify(filter(base)))throw new Error('render.yaml other entries changed');
console.log('render.yaml: other service fields and other envVars unchanged');
NODE
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml
node - <<'NODE'
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const yaml=require('js-yaml');
const now=yaml.load(fs.readFileSync('.github/workflows/deploy.yml','utf8'));
const base=yaml.load(execFileSync('git',['show','origin/main:.github/workflows/deploy.yml'],{encoding:'utf8'}));
const triggers=(w)=>w.on&&typeof w.on==='object'?w.on:w[true];
const job=now.jobs.deploy, old=base.jobs.deploy;
const eq=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(label+' changed')};
eq(triggers(now),triggers(base),'triggers'); eq(now.concurrency,base.concurrency,'concurrency'); eq(now.permissions,base.permissions,'permissions');
eq(job.if,old.if,'job if'); eq(job['runs-on'],old['runs-on'],'runs-on'); eq(job['timeout-minutes'],old['timeout-minutes'],'timeout'); eq(job.environment,old.environment,'environment'); eq(job.env,old.env,'job env');
eq(job.steps.map((s)=>s.name),old.steps.map((s)=>s.name),'step order');
eq(job.steps.map((s)=>s.uses),old.steps.map((s)=>s.uses),'action pins');
eq(job.steps.map((s)=>s.run),old.steps.map((s)=>s.run),'step run blocks');
eq(job.steps.map((s)=>s.with),old.steps.map((s)=>s.with),'step with blocks');
const expected=['EMAIL_TRANSPORT','BREVO_API_KEY'];
for(const name of ['Check deployment Brevo configuration','Sync Brevo SMTP settings to Render']){
  const a=job.steps.find((s)=>s.name===name), b=old.steps.find((s)=>s.name===name);
  const added=Object.keys(a.env).filter((k)=>!(k in b.env)).sort();
  if(JSON.stringify(added)!==JSON.stringify([...expected].sort()))throw new Error(name+' env additions '+JSON.stringify(added));
  for(const k of Object.keys(b.env)) eq(a.env[k],b.env[k],name+' '+k);
}
console.log('deploy.yml: triggers/concurrency/permissions/job/step order/uses/run/with unchanged; only the two CLI steps gained EMAIL_TRANSPORT and BREVO_API_KEY');
NODE
fixture_sender="CubeClicker <fixture-sender$(printf '@')example.test>"
out=$(mktemp)
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=2525 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM="$fixture_sender" SMTP_USER=fixture SMTP_PASS=fixture \
  EMAIL_TRANSPORT=brevo-api BREVO_API_KEY=fixture-key \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 0
grep -qx "Deploy configuration OK: 11 value(s) present for the 'development' environment." "$out"
code=0
env TARGET_ENVIRONMENT=production RENDER_SERVICE_ID='<CHANGEME-render-service-id>' RENDER_API_KEY='<CHANGEME-render-api-key>' \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM='<CHANGEME-verified-sender>' SMTP_USER='<CHANGEME-smtp-login>' SMTP_PASS='<CHANGEME-smtp-key>' \
  EMAIL_TRANSPORT=brevo-api BREVO_API_KEY='<CHANGEME-brevo-api-key>' \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 1
grep -qx "Deploy blocked: the 'production' environment has 6 unset or placeholder value(s)." "$out"
grep -qx "  Placeholder: SMTP_FROM, SMTP_USER, SMTP_PASS, BREVO_API_KEY, RENDER_SERVICE_ID, RENDER_API_KEY" "$out"
! grep -q 'Deploy blocked: SMTP_PORT=' "$out"
! grep -q 'Deploy blocked: EMAIL_TRANSPORT must be' "$out"
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM="$fixture_sender" SMTP_USER=fixture SMTP_PASS=fixture \
  EMAIL_TRANSPORT=smtp BREVO_API_KEY=fixture-key \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 1
grep -qx "Deploy blocked: EMAIL_TRANSPORT must be \"brevo-api\" for the 'development' environment; received \"smtp\"." "$out"
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM="$fixture_sender" SMTP_USER=fixture SMTP_PASS=fixture \
  EMAIL_TRANSPORT=brevo-api BREVO_API_KEY=fixture-key \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 1
grep -qx "Deploy blocked: SMTP_PORT=587 is blocked for outbound SMTP on the Render free plan ('development' environment)." "$out"
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=2525 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM="$fixture_sender" SMTP_USER=fixture SMTP_PASS=fixture \
  EMAIL_TRANSPORT=brevo-api BREVO_API_KEY=fixture \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 1
grep -qx "Deploy blocked: BREVO_API_KEY is the Brevo SMTP key, not the REST API key ('development' environment)." "$out"
local_sender="$(printf 'no-reply%scubeclicker.local' '@')"
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=2525 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM="$local_sender" SMTP_USER=fixture SMTP_PASS=fixture \
  EMAIL_TRANSPORT=brevo-api BREVO_API_KEY=fixture-key \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 1
grep -qx "Deploy blocked: SMTP_FROM is the local Mailpit default and cannot deliver through the Brevo API ('development' environment)." "$out"
test "$(grep -c 'EMAIL_TRANSPORT: brevo-api' .github/workflows/ci.yml)" -eq 2
test "$(grep -c 'BREVO_API_KEY:' .github/workflows/ci.yml)" -eq 2
test "$(grep -c 'BREVO_API_KEY: fixture-key' .github/workflows/ci.yml)" -eq 1
test "$(grep -cF "BREVO_API_KEY: '<CHANGEME-brevo-api-key>'" .github/workflows/ci.yml)" -eq 1
test "$(grep -c 'Deploy configuration OK: 11 value(s)' .github/workflows/ci.yml)" -eq 1
test "$(grep -c 'has 6 unset or placeholder value(s)' .github/workflows/ci.yml)" -eq 1
test "$(grep -cF 'EMAIL_TRANSPORT: ${{ vars.EMAIL_TRANSPORT }}' .github/workflows/deploy.yml)" -eq 2
test "$(grep -cF 'BREVO_API_KEY: ${{ secrets.BREVO_API_KEY }}' .github/workflows/deploy.yml)" -eq 2
log=docs/features/brevo-api-email-transport/build-log-T4.md
test -f "$log"
log_guard="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|verify\?token=|[0-9a-f]{32,}|xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|rnd_[A-Za-z0-9_-]{20,}|(SMTP_(USER|PASS)|BREVO_API_KEY|RENDER_API_KEY)[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9+/_-]{12,}"
! grep -qE "$log_guard" "$log"
```
acceptance: AC-7, AC-8
status: [x]

Add `EMAIL_CATALOG`, `SYNC_CATALOG` (9) and `CATALOG` (11) in the pinned order; keep `SMTP_CATALOG` and `RENDER_WIRING` unchanged. Implement `validateEmailTransport`/`formatEmailTransportFailure` with the exact five blocks and reasons, using `parseEmailSender` from `auth/config.ts`, without echoing a sender or key. Apply it to `development`/`production` only, after catalog validation and before the SMTP port guard. Add the production API-valid `{ ok: true }` case (non-placeholder key, parseable non-local sender, key neither SMTP-shaped nor equal to `SMTP_PASS`) and the angle-only local-sender case. Add `EMAIL_TRANSPORT` and `BREVO_API_KEY` to `render.yaml` with `sync: false` and no value; the parsed comparison must show every other service field and `envVars` entry unchanged against `origin/main`. In the **same task**, project `SYNC_CATALOG` in `render-env-cli.ts` (`buildSyncValues`), change the usage/check/dry-run/sync counts to 11/9, update `render-env-cli.test.ts` fixtures (nine expected URLs/bodies, 11-name success, six-placeholder production with negative port/transport assertions, nine-write dry-run/sync and the transport guard cases), update `ci.yml` fixtures (two new names and the exact counts) and bind `EMAIL_TRANSPORT`/`BREVO_API_KEY` in both `deploy.yml` CLI steps. There is **no intermediate 9→11 state**: `render-env.ts`, `render-env-cli.ts` and both test files change together, and the full backend suite/coverage is green at the task boundary. The verify includes the `render.yaml` comparison, parsed `deploy.yml` comparison, actionlint, CI fixture counts and the shared log guard.

<!-- The former deploy-CLI task is absorbed by T4; there is no separate task. -->

## T6 — Documentation: transport contract, runbook, events and supersession `[seq]`
depends_on: T1, T2, T3, T4
files_owned: `README.md`, `docs/architecture/email.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/observability.md`, `docs/architecture/containerization.md`, `docs/features/brevo-api-email-transport/build-log-T6.md`
verify:
```bash
set -euo pipefail
positive='Development and production deliver verification email through the Brevo HTTPS API on port 443; SMTP remains the local/off-Render transport.'
for f in README.md docs/architecture/email.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md; do grep -Fq "$positive" "$f"; done
test -f docs/architecture/email.md
for s in EMAIL_TRANSPORT brevo-api BREVO_API_KEY 'POST https://api.brevo.com/v3/smtp/email' 'api-key' htmlContent textContent 443 10000 verification_email_failed 'persisted and unverified' brevo_api_transport_verify_ok brevo_api_transport_verify_failed 'Settings → SMTP & API → API Keys' rotate Mailpit 'No new service, image, port, volume, healthcheck or WebSocket endpoint was added.'; do grep -Fq "$s" docs/architecture/email.md; done
for s in 'EMAIL_TRANSPORT=brevo-api' BREVO_API_KEY 'Settings → SMTP & API → API Keys' 'eleven validated, nine synced' 'Brevo HTTPS API' 443 brevo_api_transport_verify_ok 'persisted and unverified' '### Registration recovery (development)' 'email:test' 'Test email sent to <address> via Brevo API (api.brevo.com:443, transport=brevo-api, from="<SMTP_FROM>")' 'Create a replacement key under Settings → SMTP & API → API Keys' 'update the `BREVO_API_KEY` GitHub Environment secret' 'revoke the old key' 'Set `BREVO_API_KEY` to the Brevo API key from **Settings → SMTP & API → API Keys** and re-run **Deploy**; the deployed API transport does not use an SMTP key.' '| `EMAIL_TRANSPORT` | variable |' '| `BREVO_API_KEY` | secret |' 'gh variable set EMAIL_TRANSPORT' 'gh secret set BREVO_API_KEY' 'Exact `gh` commands (22 lines)' '`SMTP_PASS`, `BREVO_API_KEY`, `RENDER_API_KEY`' '`SMTP_FROM`, `EMAIL_TRANSPORT`, `RENDER_SERVICE_ID`' 'The production catalog is a code/documentation contract' 'no live production environment is modified' 'This feature supersedes the SMTP delivery recipe' 'records the AC-11(a) ordering deviation' 'requires EMAIL_TRANSPORT and BREVO_API_KEY before merge'; do grep -Fq "$s" README.md; done
for s in 'there is no Brevo REST API integration' 'SMTP only' 'Development and production deliver real verification email through **Brevo SMTP**' 'The deployed `development` recipe is therefore `SMTP_PORT=2525`' 'The deployed development backend must therefore send through' 'The nine deployment names are the source of truth' 'Development email delivers through Brevo SMTP' 'the nine names exist with pinned placeholders' 'validates **nine** names' 'This feature supersedes only the preserved `SMTP_PORT` value' 'seven `SYNCED <KEY>` lines' 'Synced 7 value(s)' 'The Render dashboard lists the seven keys' '`SMTP_PASS` holds the **SMTP key**' 'The seven SMTP names are written to Render' 'Exact `gh` commands (18 lines)' '**Preserve note.**' 'Before this feature merges to `main`, set `SMTP_PORT=2525`' 'record both values in `build-log-T9.md` Phase A' 'If the resend still fails at 2525' 'nine validated, seven synced' 'syncs the seven SMTP names' 'seven SMTP values' 'seven SMTP names through the Render API' 'writes the seven SMTP names' 'writes only the seven SMTP names' 'seven SMTP names are written' 'rewrites all seven SMTP names'; do ! grep -Fq "$s" README.md; done
for s in EMAIL_TRANSPORT BREVO_API_KEY 'eleven validated, nine synced' 'Brevo HTTPS API' 443 brevo_api_transport_verify_ok 'six pinned placeholders' 'persisted and unverified' 'production catalog'; do grep -Fq "$s" docs/architecture/deployment.md; done
for s in '**Brevo SMTP.**' 'the deployed `development` recipe is `SMTP_PORT=2525`' 'seven SMTP names, synced from the GitHub Environment' 'the same nine deployment names' 'nine values, `--check-only`' 'nine validated, seven synced' 'syncs the seven SMTP names' 'seven SMTP values' 'seven SMTP names via the Render API' 'Delivery is an SMTP side effect'; do ! grep -Fq "$s" docs/architecture/deployment.md; done
for s in EMAIL_TRANSPORT BREVO_API_KEY 'eleven validated, nine synced' 'Brevo HTTPS API' 443 brevo_api_transport_verify_ok 'six pinned placeholders' 'production catalog' '| `EMAIL_TRANSPORT` | var |' '| `BREVO_API_KEY` | secret |'; do grep -Fq "$s" docs/architecture/vercel-render-neon.md; done
for s in 'Brevo SMTP delivers verification email in development and production' 'Development and production deliver through **Brevo SMTP**' 'SMTP only; no Brevo REST API integration' 'synced to Render for the seven SMTP names' 'the six deployment variables and the three deployment secrets' 'The nine deployment names are validated' 'same nine names' 'the deployed recipe stays `SMTP_PORT=2525`' 'Email verification does not arrive' 'The seven SMTP deployment names are validated' 'nine validated, seven synced' 'seven SMTP names are synced' 'syncs the seven SMTP names' 'seven SMTP values' 'writes the seven SMTP names'; do ! grep -Fq "$s" docs/architecture/vercel-render-neon.md; done
for s in brevo_api_transport_verify_ok brevo_api_transport_verify_failed brevo_api_transport_verify_skipped transport brevo-api HTTP_ 'No email, username, account id, token, message or stack' 'email transport'; do grep -Fq "$s" docs/architecture/observability.md; done
! grep -Fq 'when the SMTP transport rejects' docs/architecture/observability.md
! grep -Fq 'SMTP broken' docs/architecture/observability.md
for s in EMAIL_TRANSPORT BREVO_API_KEY 'No new service, image, port, volume, healthcheck or WebSocket endpoint was added.'; do grep -Fq "$s" docs/architecture/containerization.md; done
! grep -Fq 'SMTP pass-throughs recorded' docs/architecture/containerization.md
grep -q 'Feature-index row proposal' docs/features/brevo-api-email-transport/build-log-T6.md
grep -q 'brevo-api-email-transport' docs/features/brevo-api-email-transport/build-log-T6.md
! git diff --name-only | grep -qx 'docs/features/README.md'
log=docs/features/brevo-api-email-transport/build-log-T6.md
test -f "$log"
log_guard="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|verify\?token=|[0-9a-f]{32,}|xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|rnd_[A-Za-z0-9_-]{20,}|(SMTP_(USER|PASS)|BREVO_API_KEY|RENDER_API_KEY)[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9+/_-]{12,}"
! grep -qE "$log_guard" "$log"
```
acceptance: AC-11
status: [x]

Create `docs/architecture/email.md` as the canonical transport reference (local Mailpit SMTP vs deployed Brevo HTTPS API, exact env names, request shape, timeout, error mapping, events, key creation/rotation, redaction, recovery, supersession). Update `README.md` (email section, env table, test-email CLI, secret hygiene, asset checklist, pipeline counts, deployment runbook with the two new names, the 22-line `gh` command block, the secrets/variables list placement, key rotation, the exact `BREVO_API_KEY` recovery step, catalog rows, the production code-catalog statement, the AC-11(a) deviation/supersession statement, registration recovery), `deployment.md`, `vercel-render-neon.md`, `observability.md` and `containerization.md`. Every affected file carries the exact positive sentence and removes the stale "deployed uses SMTP" claims and old seven-name counts listed above. Production is described as a catalog, not a live environment claim. Record commit ids as `<commit>` (or a reviewed exception), never a bare 40-character SHA, so the shared guard does not false-positive. Do not edit `docs/features/README.md`; add the `Feature-index row proposal` line to the build log.

## T7 — Verify & integrate `[seq]`
depends_on: T1, T2, T3, T4, T6
files_owned: `docs/features/brevo-api-email-transport/build-log-T7.md`
verify:
```bash
set -euo pipefail
git rev-parse --verify origin/main >/dev/null
npm run lint
npm run typecheck
npm test
npm run coverage
npm run build
git diff --exit-code origin/main...HEAD -- src/backend/vitest.config.ts src/frontend/vitest.config.ts
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
podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit
npm run smoke
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml
node -e "JSON.parse(require('node:fs').readFileSync('src/frontend/vercel.json','utf8'));console.log('vercel.json: valid JSON')"
node -e "const fs=require('node:fs');const yaml=require('js-yaml');const b=yaml.load(fs.readFileSync('render.yaml','utf8'));const s=b.services[0];for(const k of ['EMAIL_TRANSPORT','BREVO_API_KEY']){const e=s.envVars.find((x)=>x.key===k);if(!e||e.sync!==false||Object.prototype.hasOwnProperty.call(e,'value'))throw new Error(k+' must be sync:false without a value');}console.log('render.yaml: valid YAML, new names sync:false')"
node - <<'NODE'
const {execFileSync}=require('node:child_process');
const fs=require('node:fs');
const yaml=require('js-yaml');
const now=yaml.load(fs.readFileSync('.github/workflows/deploy.yml','utf8'));
const base=yaml.load(execFileSync('git',['show','origin/main:.github/workflows/deploy.yml'],{encoding:'utf8'}));
const triggers=(w)=>w.on&&typeof w.on==='object'?w.on:w[true];
const job=now.jobs.deploy, old=base.jobs.deploy;
const eq=(a,b,label)=>{if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(label+' changed')};
eq(triggers(now),triggers(base),'triggers'); eq(now.concurrency,base.concurrency,'concurrency'); eq(now.permissions,base.permissions,'permissions');
eq(job.if,old.if,'job if'); eq(job['runs-on'],old['runs-on'],'runs-on'); eq(job['timeout-minutes'],old['timeout-minutes'],'timeout'); eq(job.environment,old.environment,'environment'); eq(job.env,old.env,'job env');
eq(job.steps.map((s)=>s.name),old.steps.map((s)=>s.name),'step order');
eq(job.steps.map((s)=>s.uses),old.steps.map((s)=>s.uses),'action pins');
eq(job.steps.map((s)=>s.run),old.steps.map((s)=>s.run),'step run blocks');
eq(job.steps.map((s)=>s.with),old.steps.map((s)=>s.with),'step with blocks');
const expected=['EMAIL_TRANSPORT','BREVO_API_KEY'];
for(const name of ['Check deployment Brevo configuration','Sync Brevo SMTP settings to Render']){
  const a=job.steps.find((s)=>s.name===name), b=old.steps.find((s)=>s.name===name);
  const added=Object.keys(a.env).filter((k)=>!(k in b.env)).sort();
  if(JSON.stringify(added)!==JSON.stringify([...expected].sort()))throw new Error(name+' env additions '+JSON.stringify(added));
  for(const k of Object.keys(b.env)) eq(a.env[k],b.env[k],name+' '+k);
}
console.log('deploy.yml: triggers/concurrency/permissions/job/step order/uses/run/with unchanged; only the two CLI steps gained EMAIL_TRANSPORT and BREVO_API_KEY');
NODE
fixture_sender="CubeClicker <fixture-sender$(printf '@')example.test>"
out=$(mktemp)
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=2525 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM="$fixture_sender" SMTP_USER=fixture SMTP_PASS=fixture \
  EMAIL_TRANSPORT=brevo-api BREVO_API_KEY=fixture-key \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 0
grep -qx "Deploy configuration OK: 11 value(s) present for the 'development' environment." "$out"
code=0
env TARGET_ENVIRONMENT=production RENDER_SERVICE_ID='<CHANGEME-render-service-id>' RENDER_API_KEY='<CHANGEME-render-api-key>' \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM='<CHANGEME-verified-sender>' SMTP_USER='<CHANGEME-smtp-login>' SMTP_PASS='<CHANGEME-smtp-key>' \
  EMAIL_TRANSPORT=brevo-api BREVO_API_KEY='<CHANGEME-brevo-api-key>' \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 1
grep -qx "Deploy blocked: the 'production' environment has 6 unset or placeholder value(s)." "$out"
! grep -q 'Deploy blocked: SMTP_PORT=' "$out"
! grep -q 'Deploy blocked: EMAIL_TRANSPORT must be' "$out"
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM="$fixture_sender" SMTP_USER=fixture SMTP_PASS=fixture \
  EMAIL_TRANSPORT=smtp BREVO_API_KEY=fixture-key \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 1
grep -qx "Deploy blocked: EMAIL_TRANSPORT must be \"brevo-api\" for the 'development' environment; received \"smtp\"." "$out"
positive='Development and production deliver verification email through the Brevo HTTPS API on port 443; SMTP remains the local/off-Render transport.'
for f in README.md docs/architecture/email.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md; do grep -Fq "$positive" "$f"; done
for s in 'EMAIL_TRANSPORT=brevo-api' 'eleven validated, nine synced' 'Brevo HTTPS API' brevo_api_transport_verify_ok; do grep -Fq "$s" README.md; done
grep -Fq 'No new service, image, port, volume, healthcheck or WebSocket endpoint was added.' docs/architecture/containerization.md
for s in brevo_api_transport_verify_ok brevo_api_transport_verify_failed brevo_api_transport_verify_skipped 'email transport'; do grep -Fq "$s" docs/architecture/observability.md; done
! grep -Fq 'when the SMTP transport rejects' docs/architecture/observability.md
! grep -Fq 'SMTP pass-throughs recorded' docs/architecture/containerization.md
# Synthetic assignment fixtures inside test files are allowed (spec § Acceptance criteria preamble and AC-12(e)); real key-shape patterns stay strict on every path.
real_key_guard="xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|rnd_[A-Za-z0-9_-]{20,}"
assignment_guard="(SMTP_(USER|PASS)|BREVO_API_KEY|RENDER_API_KEY)[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9+/_-]{12,}"
test_pathspecs=(':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.spec.ts')
! git grep -qE "$real_key_guard"
! git grep --untracked -qE "$real_key_guard"
! git diff origin/main...HEAD | grep -qE "$real_key_guard"
! git log -p origin/main..HEAD | grep -qE "$real_key_guard"
! git grep -qE "$assignment_guard" -- . "${test_pathspecs[@]}"
! git grep --untracked -qE "$assignment_guard" -- . "${test_pathspecs[@]}"
! git diff origin/main...HEAD -- . "${test_pathspecs[@]}" | grep -qE "$assignment_guard"
! git log -p origin/main..HEAD -- . "${test_pathspecs[@]}" | grep -qE "$assignment_guard"
! git log --name-only --pretty=format: origin/main..HEAD | grep -qE '(^|/)\.env'
log_guard="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|verify\?token=|[0-9a-f]{32,}|xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|rnd_[A-Za-z0-9_-]{20,}|(SMTP_(USER|PASS)|BREVO_API_KEY|RENDER_API_KEY)[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9+/_-]{12,}"
for log in docs/features/brevo-api-email-transport/build-log-*.md; do
  test -f "$log"
  ! grep -qE "$log_guard" "$log"
done
! git diff --name-only origin/main...HEAD | grep -qE '^src/frontend/|^src/backend/src/auth/(auth-service|email-template)\.ts$|^src/backend/src/db/migrations/|Dockerfile$'
! git diff --name-only origin/main...HEAD | grep -qx 'docs/features/README.md'
! git diff --name-only origin/main...HEAD | grep -E '^docs/features/' | grep -v '^docs/features/brevo-api-email-transport/' | grep .
test -f docs/features/brevo-api-email-transport/spec.md
test -f docs/features/brevo-api-email-transport/plan.md
test -f docs/features/brevo-api-email-transport/tasks.md
test -f docs/features/brevo-api-email-transport/status.md
test -f docs/features/brevo-api-email-transport/build-log-T7.md
```
acceptance: AC-10(b), AC-10(c), AC-12
status: [x]

Run the full gate across both workspaces and record raw output: lint, typecheck, tests, `npm run coverage` (≥ 80% statements/branches/functions/lines per workspace), build, the coverage-config diff, Mailpit-primed smoke, actionlint over both workflows, the Vercel/Render config parses, the parsed deploy.yml comparison, the deploy CLI fixtures, the T6 documentation checks, the shared guard over every build log, and the credential/PII/token/branch-history/scope audits. The repository credential audit excludes synthetic assignment fixtures inside `*.test.ts`/`*.spec.ts` by pathspec (the acceptance-criteria preamble allows synthetic fixtures defined in test files); the real Brevo/Render key-shape pattern remains strict on every path, including tests and logs, and every non-test source/doc/untracked build log, the branch diff, the branch history and the unconditional `.env*` check remain in force. The feature-index check reads committed `origin/main...HEAD` changes, so the orchestrator-owned uncommitted acceptance row cannot fail the builder; no feature commit may touch `docs/features/README.md`. Redact any fixture address in captured output to `<address>` and record commit ids as `<commit>` (or a reviewed exception), never a bare 40-character SHA; keep exit status and asserted lines. The required `compose.yaml`/`compose.smoke.yaml` environment pass-throughs are allowed; no compose service/image/port/volume/healthcheck change is. No source edits: a failure reopens the owning task.

## T8 — Owner live proof and T9/AC-11 consumption `[owner]` `[seq]`
depends_on: T7
files_owned: `docs/features/brevo-api-email-transport/build-log-T8.md`
external_side_effects: GitHub `development` variable `EMAIL_TRANSPORT=brevo-api` and secret `BREVO_API_KEY` (owner-set **before merge**), a Deploy run, a live resend to an owner-controlled mailbox, and Brevo/Render log inspection — **owner-executed only; no live production write**
verify:
```bash
set -euo pipefail
: "${GH_REPO:?owner must supply the repository slug}"
: "${CUBECLICKER_USERNAME_PATTERN:?owner must supply the known username pattern}"
test "$(gh variable get EMAIL_TRANSPORT --env development --repo "$GH_REPO")" = "brevo-api"
gh secret list --env development --repo "$GH_REPO" | grep -q '^BREVO_API_KEY'
gh run list --workflow Deploy --limit 1 --repo "$GH_REPO" --json conclusion --jq '.[0].conclusion' | grep -qx success
node -e "fetch('https://cubeclicker-development.onrender.com/healthz').then(async (r)=>{const b=await r.text();if(r.status!==200||b!=='{\"status\":\"ok\"}')throw new Error('healthz '+r.status+' '+b);console.log('healthz 200')}).catch((e)=>{console.error(e);process.exit(1)})"
log=docs/features/brevo-api-email-transport/build-log-T8.md
test -f "$log"
grep -q 'owner-attested' "$log"
grep -q 'not CI-reproducible' "$log"
grep -q 'Phase A' "$log"
grep -q 'Phase B' "$log"
grep -q 'Deploy configuration OK: 11 value(s) present' "$log"
grep -q 'SYNCED EMAIL_TRANSPORT (value verified, not shown)' "$log"
grep -q 'SYNCED BREVO_API_KEY (value verified, not shown)' "$log"
grep -qE 'brevo_api_transport_verify_ok|info level filtered; no brevo_api_transport_verify_failed line' "$log"
grep -q 'Render excerpt' "$log"
grep -q 'Brevo excerpt' "$log"
grep -q 'resend response' "$log"
grep -q 'Brevo transactional' "$log"
grep -q 'verified = true' "$log"
grep -q 'joined as account' "$log"
grep -q "join { mode: 'account' }" "$log"
grep -q 'AC-11(a) deviation' "$log"
grep -q 'AC-11(b)' "$log"
grep -q 'AC-11(c)' "$log"
grep -q 'AC-11(d)' "$log"
! grep -q 'AC-11(a) met' "$log"
grep -qiE 'dedicated key|owner risk accepted' "$log"
grep -q 'SMTP_FROM confirmed' "$log"
if grep -q 'owner risk accepted' "$log"; then
  grep -q 'rotation plan' "$log"
  grep -qi 'least privilege' "$log"
fi
! grep -qF "$GH_REPO" "$log"
grep -q 'no live production write' "$log"
! grep -qE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' "$log"
! grep -qE 'verify\?token=|[0-9a-f]{32,}' "$log"
! grep -qE "$CUBECLICKER_USERNAME_PATTERN" "$log"
log_guard="[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|verify\?token=|[0-9a-f]{32,}|xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|rnd_[A-Za-z0-9_-]{20,}|(SMTP_(USER|PASS)|BREVO_API_KEY|RENDER_API_KEY)[[:space:]]*[:=][[:space:]]*[\"']?[A-Za-z0-9+/_-]{12,}"
! grep -qE "$log_guard" "$log"
```
acceptance: AC-13
status: [ ]

**Phase A (before merge, owner):** set `EMAIL_TRANSPORT=brevo-api` as a `development` variable and `BREVO_API_KEY` as a `development` secret (UI or stdin; never a command argument), confirm the Brevo-verified sender, record the marker `SMTP_FROM confirmed` with no value, and record the names/`gh variable get` output under `Phase A`. A dedicated key is preferred; if the existing MCP key is reused, record `owner risk accepted`, the coupled blast radius, the `rotation plan` and the `least privilege` justification. If the values are missed before merge, the first post-merge Deploy fails closed at `Check deployment Brevo configuration`; record `AC-11(a) deviation` (post-merge application, guard failure, re-run) and do not claim AC-11(a). **Phase B (owner, owner-attested, not CI-reproducible):** run Deploy; record `Deploy configuration OK: 11 value(s)`, `SYNCED EMAIL_TRANSPORT`, `SYNCED BREVO_API_KEY`, `/healthz`, a resend `202`, delivery, `verified = true`, login and `join { mode: 'account' }`. Record the raw redacted evidence under the literal markers `Render excerpt` (the `brevo_api_transport_verify_ok` line), `Brevo excerpt` (the Brevo transactional record with its message id redacted) and `resend response` (the HTTP status/body with no address). Record that AC-11(c) and AC-11(d) are replaced by AC-13(c) and AC-13(d), AC-11(b) is retained, AC-11(a) is not met on ordering and is recorded as a deviation, and T9 Phase B is consumed. Record `no live production write`: the production catalog is code/documentation only. Use `<owner-address>`, `<frontend-origin>`, `<verification-link>` and `<commit>` placeholders; never record `GH_REPO`, the username pattern, an address, username, token, link, key or a bare 32+ hex commit id.
