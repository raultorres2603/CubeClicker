# Tasks — Registration Account Exists: Working Verification Delivery, Honest Conflicts & Resumable Registration

Dependency overview: **T1 → T2 → T3 → T4 → T6 → T8**; **T2 → T5 → T8**; **T1, T4, T5 → T7 → T8**; **T8 → T9**. Every task is `[seq]`: all behavior tasks run backend/frontend workspace coverage in the same working tree, so parallel execution would race on coverage output, the test caches and the commit surface. No `[P]` batch is declared.

Every behavior task records raw evidence in its own build log under `docs/features/registration-account-exists/` and ends its verify with the repository credential guard over that log. T7/T8/T9 additionally enforce the PII/token guards (no email address, verification link/token, username or third-party PII in the build log). T9 is **user-owned** (owner action + owner evidence); no agent writes GitHub/Render/Neon state or sends email.

Revision r3 (2026-11-24): final self-consistency pass — T1/T8 shell snippets checked under `set -euo pipefail`; T7/T8 documentation checks aligned with AC-9; the docs-diff email guard now extracts addresses; no task titles, ownership or dependencies changed.

Revision r4 (2026-11-24): spec-review r2 BLOCKER F1 — the T7/T8 docs-diff token guard now reads added lines only (`git diff --no-color --unified=0` + `grep '^+'`), extracts token values and exempts exactly the documented synthetic `verify?token=cli-test`, with a no-match-safe `grep . >/dev/null` tail; no task title, ownership, acceptance or dependency changed.

## T1 — Strict Render-free SMTP guard and CI fixtures `[seq]`
depends_on: —
files_owned: `src/backend/src/deploy/render-env.ts`, `src/backend/src/deploy/render-env.test.ts`, `src/backend/src/deploy/render-env-cli.ts`, `src/backend/src/deploy/render-env-cli.test.ts`, `.github/workflows/ci.yml`, `docs/features/registration-account-exists/build-log-T1.md`
verify:
```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend
npm run coverage --workspace @cubeclicker/backend
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml
test "$(grep -c "SMTP_PORT: '2525'" .github/workflows/ci.yml)" -eq 1
test "$(grep -c "SMTP_PORT: '587'" .github/workflows/ci.yml)" -eq 1
grep -B5 "SMTP_PORT: '2525'" .github/workflows/ci.yml | grep -q 'TARGET_ENVIRONMENT: development'
grep -B5 "SMTP_PORT: '587'" .github/workflows/ci.yml | grep -q 'TARGET_ENVIRONMENT: production'
out=$(mktemp)
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM='CubeClicker <verified sender>' SMTP_USER=fixture SMTP_PASS=fixture \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 1
grep -qx "Deploy blocked: SMTP_PORT=587 is blocked for outbound SMTP on the Render free plan ('development' environment)." "$out"
grep -qx "  Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS); ports 25, 465 and 587 stay blocked on Render free." "$out"
grep -qx "  Runbook: README.md § Deployment Brevo runbook" "$out"
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587abc SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM='CubeClicker <verified sender>' SMTP_USER=fixture SMTP_PASS=fixture \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 1
grep -qx "Deploy blocked: SMTP_PORT=\"587abc\" must be an integer between 1 and 65535 ('development' environment)." "$out"
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=2525 SMTP_SECURE=true SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM='CubeClicker <verified sender>' SMTP_USER=fixture SMTP_PASS=fixture \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 1
grep -qx "Deploy blocked: SMTP_SECURE must be \"false\" when SMTP_PORT=2525 ('development' environment); received \"true\"." "$out"
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=1025 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM='CubeClicker <verified sender>' SMTP_USER=fixture SMTP_PASS=fixture \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 1
grep -qx "Deploy blocked: SMTP_PORT=1025 is the local Mailpit port and is not reachable from a deployed Render service ('development' environment)." "$out"
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=2525 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM='CubeClicker <verified sender>' SMTP_USER=fixture SMTP_PASS=fixture \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only | grep -qx "Deploy configuration OK: 9 value(s) present for the 'development' environment."
code=0
env TARGET_ENVIRONMENT=production RENDER_SERVICE_ID='<CHANGEME-render-service-id>' RENDER_API_KEY='<CHANGEME-render-api-key>' \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM='<CHANGEME-verified-sender>' SMTP_USER='<CHANGEME-smtp-login>' SMTP_PASS='<CHANGEME-smtp-key>' \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 1
grep -qx "Deploy blocked: the 'production' environment has 5 unset or placeholder value(s)." "$out"
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM='CubeClicker <verified sender>' SMTP_USER=fixture SMTP_PASS=fixture \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --dry-run > "$out" 2>&1 || code=$?
test "$code" -eq 1
! grep -q 'DRY RUN:' "$out"
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM='CubeClicker <verified sender>' SMTP_USER=fixture SMTP_PASS=fixture \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts > "$out" 2>&1 || code=$?
test "$code" -eq 1
! grep -q 'SYNCED ' "$out"
test -f docs/features/registration-account-exists/build-log-T1.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/registration-account-exists/build-log-T1.md
```
acceptance: AC-1
status: [x]

Implement the strict `SmtpPortFailure` union (`render_free_blocked`, `invalid_port`, `local_port`, `starttls_required`), `validateSmtpTransportPort(env)` and `formatSmtpPortFailure(environment, failure)` with the four exact blocks. Parse `/^\d+$/` and 1–65535 (no trimming), reject 25/465/587, reject 1025, and require `SMTP_SECURE` in `undefined|''|'false'|'0'` on 2525; production returns `{ ok: true }`; missing/empty/`CHANGEME` is catalog-owned. Call the guard after catalog validation and before any dry-run output or fetch in `--check-only`, `--dry-run` and default mode. Update `render-env-cli.test.ts`'s `SMTP_VALUES`, `COMPLETE_ENV` and `EXPECTED_BODIES` to `2525`; set `PRODUCTION_PLACEHOLDER_ENV`'s `SMTP_PORT` explicitly to `'587'` so the test proves catalog precedence over the port guard; update only the development accept fixture in `ci.yml` to 2525 and leave the production placeholder fixture at 587. Do not touch `deploy.yml`, `render.yaml` or compose files.

## T2 — Typed email delivery errors and transport `verify()` `[seq]`
depends_on: T1
files_owned: `src/backend/src/auth/email.ts`, `src/backend/src/auth/email.test.ts`, `docs/features/registration-account-exists/build-log-T2.md`
verify:
```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend
npm run coverage --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend -- src/auth/email-cli.test.ts
test -f docs/features/registration-account-exists/build-log-T2.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/registration-account-exists/build-log-T2.md
```
acceptance: AC-2
status: [x]

Add optional `verify?()` to `EmailTransport`/`EmailService`; implement `SmtpEmailService.verify()` and `FakeEmailService.verify()` (`verifyCalls`, `failNextVerify`). Add `EmailDeliveryError` with `code: 'verification_email_failed'`, `transport: 'smtp'`, `host`, `port`, `errorType`, whitelisted `transportCode`, and the **verbatim source message** (do not wrap; the CLI contract depends on it). Wrap send and verify rejections. Keep `email-cli.test.ts` passing byte-for-byte.

## T3 — Resumable registration, resend invalidation, field conflicts and email login `[seq]`
depends_on: T2
files_owned: `src/backend/src/auth/auth-service.ts`, `src/backend/src/auth/auth-service.test.ts`, `docs/features/registration-account-exists/build-log-T3.md`
verify:
```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend
npm run coverage --workspace @cubeclicker/backend
test -f docs/features/registration-account-exists/build-log-T3.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/registration-account-exists/build-log-T3.md
```
acceptance: AC-3, AC-4, AC-5, AC-6
status: [x]

Implement the plan's registration decision table: lookup by username and email; resume only when both match one unverified row and the password verifies (3/hour per-account limiter); invalidate prior tokens, issue one, send, return `resumed: true`; otherwise throw `DuplicateAccountError` with ordered `fields`/`field` (`'both'` for two). On `create`'s `DuplicateUserError('unknown')`, re-query both identifiers and emit the found field(s); both null → `both`. Wrap the send in **create, resume and resend** to invalidate the just-issued token and rethrow (AC-3(c)); capture the raw token via `issue` spy in tests. Make login resolve `@`-containing identifiers by email, otherwise by username; keep 401/lockout/limiter behavior. Size note: this is the largest task; both halves edit `auth-service.ts`, so it stays one `files_owned` set — the builder may make two sequential commits and records that in the build log.

## T4 — 502 mapping, field payloads, `resumed` passthrough and delivery logging `[seq]`
depends_on: T3
files_owned: `src/backend/src/auth/auth-routes.ts`, `src/backend/src/auth/auth-routes.test.ts`, `docs/features/registration-account-exists/build-log-T4.md`
verify:
```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend
npm run coverage --workspace @cubeclicker/backend
test -f docs/features/registration-account-exists/build-log-T4.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/registration-account-exists/build-log-T4.md
```
acceptance: AC-3, AC-4, AC-5, AC-6
status: [x]

Extend `mapError` (pass the request/logger) to map `EmailDeliveryError` to the fixed `502 verification_email_failed` body and one `verification_email_delivery_failed` warn event (`route`, `errorType`, `transportCode?`, `host`, `port`); emit it from both register and resend. Include `field`/`fields` in the 409 body while keeping `message: 'account already exists'`. **Own AC-4's route contract:** the register handler serializes `resumed: true` only when `RegisterResult.resumed` is true; a new registration omits it; the resume 429 body/`Retry-After` is preserved. Tests must cover the exact `resumed`/no-`resumed`/429 bodies, the U1/U2 fixture, wrong-password and verified no-resume, logger capture with no PII, no session on 502, and email login 200/401/429.

## T5 — Non-blocking startup transport probe `[seq]`
depends_on: T2
files_owned: `src/backend/src/app.ts`, `src/backend/src/app.test.ts`, `docs/features/registration-account-exists/build-log-T5.md`
verify:
```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/backend
npm test --workspace @cubeclicker/backend
npm run coverage --workspace @cubeclicker/backend
test -f docs/features/registration-account-exists/build-log-T5.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/registration-account-exists/build-log-T5.md
```
acceptance: AC-8
status: [x]

Register an `onReady` hook that runs only when both `authConfig.smtpUser` and `authConfig.smtpPass` are set, starts `email.verify()` when present, attaches `.then`/`.catch`, and returns immediately (never await). Log `smtp_transport_verify_ok` (info), `smtp_transport_verify_failed` (warn, fields only) or `smtp_transport_verify_skipped` (debug, `reason: 'no_credentials'` or `'unsupported'`). Test a never-settling `verify()` still serves `/healthz`, exactly one call per app, the credential-gate skip, and the event fields/levels via a logger stream. Do not change `/healthz`, `server.ts`, the hub or the DB startup phase.

## T6 — Frontend field errors, resend action and resend-failure display `[seq]`
depends_on: T4
files_owned: `src/frontend/src/auth/api.ts`, `src/frontend/src/auth/api.test.ts`, `src/frontend/src/ui/AuthForms.tsx`, `src/frontend/src/ui/AuthForms.test.tsx`, `src/frontend/src/ui/VerificationPending.tsx`, `src/frontend/src/ui/VerificationPending.test.tsx`, `docs/features/registration-account-exists/build-log-T6.md`
verify:
```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/frontend
npm test --workspace @cubeclicker/frontend
npm run coverage --workspace @cubeclicker/frontend
npm run build --workspace @cubeclicker/frontend
test -f docs/features/registration-account-exists/build-log-T6.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/registration-account-exists/build-log-T6.md
```
acceptance: AC-7
status: [x]

Parse `fields` in `AuthError`; add `email_delivery_failed` and `fields` to `AuthSubmitResult`; extend `AuthFormApi` with `resend`. In `AuthForms`, keep the accessible `Username` label (existing queries must pass), add the `Username or email` hint and subtitle, render the three exact field-scoped messages with the pinned `aria-invalid`/`aria-describedby` ids and exactly one alert, and render the 502 block with a working resend (success/failure copy). In `VerificationPending`, catch a rejected `onResend`, render the exact alert, do not show success, and re-enable the button. Do not edit `App.tsx`, `AuthMenu.tsx`, `store.ts` or any CSS unless a test proves it is required; existing `App`/`AuthMenu` tests must pass unchanged. Split note: if needed, T6a owns `api.ts`/`api.test.ts`/`AuthForms.tsx`/`AuthForms.test.tsx`; T6b owns `VerificationPending.tsx`/`VerificationPending.test.tsx`; both keep AC-7 and stay sequential.

## T7 — Documentation: blocked ports, 2525, 502, recovery and event catalog `[seq]`
depends_on: T1, T4, T5
files_owned: `README.md`, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md`, `docs/architecture/observability.md`, `docs/features/registration-account-exists/build-log-T7.md`
verify:
```bash
set -euo pipefail
for f in README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md; do
  grep -q '25, 465 and 587' "$f"
  grep -q '2525' "$f"
  grep -q 'verification_email_failed' "$f"
done
grep -q 'Render free blocks outbound SMTP on ports 25, 465 and 587.' README.md
grep -q 'export SMTP_PORT=2525' README.md
grep -q 'SMTP_SECURE=false' README.md
grep -q '502' README.md
grep -q 'STARTTLS, Render free' README.md
grep -q '2525 (set before merge)' README.md
grep -q 'smtp-relay.brevo.com:2525' README.md
grep -Fq "SMTP_PORT --env development --repo raultorres2603/CubeClicker --body '2525'" README.md
! grep -Fq "SMTP_PORT --env development --repo raultorres2603/CubeClicker --body '587'" README.md
grep -q '### Registration recovery (development)' README.md
recovery=$(awk '/^### Registration recovery \(development\)/{flag=1;next}/^### /{flag=0}flag' README.md)
printf '%s\n' "$recovery" | grep -q 'Before merging this feature'
printf '%s\n' "$recovery" | grep -q 'SMTP_PORT=2525'
printf '%s\n' "$recovery" | grep -q 'SMTP_SECURE=false'
printf '%s\n' "$recovery" | grep -q '/healthz'
printf '%s\n' "$recovery" | grep -q 'email:test'
printf '%s\n' "$recovery" | grep -q '/auth/resend-verification'
printf '%s\n' "$recovery" | grep -q '<the U2 address>'
printf '%s\n' "$recovery" | grep -q '<owner-address>'
printf '%s\n' "$recovery" | grep -q 'Q-1'
grep -q 'A Render-free production service also needs 2525.' README.md
grep -q 'stays persisted and unverified' README.md
! grep -q 'A transport failure surfaces as HTTP' README.md
! grep -Fq 'Port `587` with STARTTLS is the pinned recipe' README.md
grep -q 'malformed' docs/architecture/deployment.md
grep -q '1025' docs/architecture/deployment.md
grep -q 'SMTP_PORT=2525' docs/architecture/deployment.md
grep -q 'SMTP_SECURE' docs/architecture/deployment.md
grep -q 'SMTP_SECURE=false' docs/architecture/deployment.md
! grep -qE '587.{0,20}STARTTLS, pinned' docs/architecture/deployment.md
grep -q 'malformed' docs/architecture/vercel-render-neon.md
grep -q '1025' docs/architecture/vercel-render-neon.md
grep -q 'SMTP_PORT=2525' docs/architecture/vercel-render-neon.md
grep -q 'SMTP_SECURE' docs/architecture/vercel-render-neon.md
grep -q 'SMTP_SECURE=false' docs/architecture/vercel-render-neon.md
! grep -qE '587.{0,20}STARTTLS, pinned' docs/architecture/vercel-render-neon.md
! grep -q 'Registration returns HTTP' docs/architecture/vercel-render-neon.md
! grep -q 'surfaces as HTTP' docs/architecture/vercel-render-neon.md
for e in verification_email_delivery_failed smtp_transport_verify_ok smtp_transport_verify_failed smtp_transport_verify_skipped; do
  grep -q "$e" docs/architecture/observability.md
done
grep -q 'warn' docs/architecture/observability.md
grep -q 'info' docs/architecture/observability.md
grep -q 'debug' docs/architecture/observability.md
grep -q 'errorType' docs/architecture/observability.md
grep -q 'transportCode' docs/architecture/observability.md
grep -q 'host' docs/architecture/observability.md
grep -q 'port' docs/architecture/observability.md
grep -q 'No email, username, account id, token, message or stack' docs/architecture/observability.md
grep -q 'Feature-index row proposal' docs/features/registration-account-exists/build-log-T7.md
grep -q 'registration-account-exists' docs/features/registration-account-exists/build-log-T7.md
! git diff --name-only | grep -qx 'docs/features/README.md'
git rev-parse --verify origin/main >/dev/null
! git diff origin/main...HEAD -- README.md docs/architecture | grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' | grep -vxE 'no-reply@cubeclicker\.local|user@example\.com' | grep . >/dev/null
! git diff --no-color --unified=0 origin/main...HEAD -- README.md docs/architecture \
  | grep '^+' \
  | grep -oE 'verify\?token=[A-Za-z0-9_-]+|token=[0-9a-f]{32,}' \
  | grep -vxF 'verify?token=cli-test' \
  | grep . >/dev/null
! grep -qE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' docs/features/registration-account-exists/build-log-T7.md
! grep -qE 'verify\?token=|token=[0-9a-f]{32,}|raultorraco' docs/features/registration-account-exists/build-log-T7.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/registration-account-exists/build-log-T7.md
```
acceptance: AC-9
status: [x]

Update each file separately: README (blocked 25/465/587; `export SMTP_PORT=2525`/`SMTP_SECURE=false`; table `2525` (STARTTLS, Render free); deployment catalog development cell `2525 (set before merge)`; CLI `smtp-relay.brevo.com:2525`; development runbook 2525 and no development 587; `A Render-free production service also needs 2525.`; `### Registration recovery (development)` with the pre-merge setting, both resend paths, `email:test`/sender/SMTP-key check, `<the U2 address>`/`<owner-address>` placeholders and Q-1; 502/`stays persisted and unverified` text; remove the 500/pinned-587 text), `deployment.md` (blocked ports, 2525/false, 502, malformed/1025/STARTTLS guard, remove `587 (STARTTLS, pinned)`), `vercel-render-neon.md` (same, remove `Registration returns HTTP`/`surfaces as HTTP`), and `observability.md` (four events with levels/fields and the no-PII sentence). Add the `Feature-index row proposal` line (slug, title, state, date) to the build log; do not edit `docs/features/README.md`. Record commands/exit codes only — never an address, username, token or link.

## T8 — Verify & integrate `[seq]`
depends_on: T1, T2, T3, T4, T5, T6, T7
files_owned: `docs/features/registration-account-exists/build-log-T8.md`
verify:
```bash
set -euo pipefail
npm run lint
npm run typecheck
npm test
npm run coverage
npm run build
podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit
npm run smoke
podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/ci.yml .github/workflows/deploy.yml
node -e "JSON.parse(require('node:fs').readFileSync('src/frontend/vercel.json','utf8'));console.log('vercel.json: valid JSON')"
node -e "const fs=require('node:fs');const yaml=require('js-yaml');const b=yaml.load(fs.readFileSync('render.yaml','utf8'));if(!Array.isArray(b.services)||b.services.length!==1)throw new Error('render.yaml must declare exactly one service');console.log('render.yaml: valid YAML, one service')"
npm test --workspace @cubeclicker/backend -- src/auth/email-cli.test.ts
# T1 process fixtures re-run
out=$(mktemp)
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM='CubeClicker <verified sender>' SMTP_USER=fixture SMTP_PASS=fixture \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 1
grep -qx "Deploy blocked: SMTP_PORT=587 is blocked for outbound SMTP on the Render free plan ('development' environment)." "$out"
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587abc SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM='CubeClicker <verified sender>' SMTP_USER=fixture SMTP_PASS=fixture \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 1
grep -qx "Deploy blocked: SMTP_PORT=\"587abc\" must be an integer between 1 and 65535 ('development' environment)." "$out"
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=2525 SMTP_SECURE=true SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM='CubeClicker <verified sender>' SMTP_USER=fixture SMTP_PASS=fixture \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 1
grep -qx "Deploy blocked: SMTP_SECURE must be \"false\" when SMTP_PORT=2525 ('development' environment); received \"true\"." "$out"
code=0
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=1025 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM='CubeClicker <verified sender>' SMTP_USER=fixture SMTP_PASS=fixture \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only > "$out" 2>&1 || code=$?
test "$code" -eq 1
grep -qx "Deploy blocked: SMTP_PORT=1025 is the local Mailpit port and is not reachable from a deployed Render service ('development' environment)." "$out"
env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key \
  SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=2525 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 \
  SMTP_FROM='CubeClicker <verified sender>' SMTP_USER=fixture SMTP_PASS=fixture \
  npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only | grep -qx "Deploy configuration OK: 9 value(s) present for the 'development' environment."
# T7 per-file documentation checks re-run verbatim
for f in README.md docs/architecture/deployment.md docs/architecture/vercel-render-neon.md; do
  grep -q '25, 465 and 587' "$f"
  grep -q '2525' "$f"
  grep -q 'verification_email_failed' "$f"
done
grep -q 'Render free blocks outbound SMTP on ports 25, 465 and 587.' README.md
grep -q 'export SMTP_PORT=2525' README.md
grep -q 'SMTP_SECURE=false' README.md
grep -q '502' README.md
grep -q 'STARTTLS, Render free' README.md
grep -q '2525 (set before merge)' README.md
grep -q 'smtp-relay.brevo.com:2525' README.md
grep -Fq "SMTP_PORT --env development --repo raultorres2603/CubeClicker --body '2525'" README.md
! grep -Fq "SMTP_PORT --env development --repo raultorres2603/CubeClicker --body '587'" README.md
grep -q '### Registration recovery (development)' README.md
recovery=$(awk '/^### Registration recovery \(development\)/{flag=1;next}/^### /{flag=0}flag' README.md)
printf '%s\n' "$recovery" | grep -q 'Before merging this feature'
printf '%s\n' "$recovery" | grep -q 'SMTP_PORT=2525'
printf '%s\n' "$recovery" | grep -q 'SMTP_SECURE=false'
printf '%s\n' "$recovery" | grep -q '/healthz'
printf '%s\n' "$recovery" | grep -q 'email:test'
printf '%s\n' "$recovery" | grep -q '/auth/resend-verification'
printf '%s\n' "$recovery" | grep -q '<the U2 address>'
printf '%s\n' "$recovery" | grep -q '<owner-address>'
printf '%s\n' "$recovery" | grep -q 'Q-1'
grep -q 'A Render-free production service also needs 2525.' README.md
grep -q 'stays persisted and unverified' README.md
! grep -q 'A transport failure surfaces as HTTP' README.md
! grep -Fq 'Port `587` with STARTTLS is the pinned recipe' README.md
grep -q 'malformed' docs/architecture/deployment.md
grep -q '1025' docs/architecture/deployment.md
grep -q 'SMTP_PORT=2525' docs/architecture/deployment.md
grep -q 'SMTP_SECURE' docs/architecture/deployment.md
grep -q 'SMTP_SECURE=false' docs/architecture/deployment.md
! grep -qE '587.{0,20}STARTTLS, pinned' docs/architecture/deployment.md
grep -q 'malformed' docs/architecture/vercel-render-neon.md
grep -q '1025' docs/architecture/vercel-render-neon.md
grep -q 'SMTP_PORT=2525' docs/architecture/vercel-render-neon.md
grep -q 'SMTP_SECURE' docs/architecture/vercel-render-neon.md
grep -q 'SMTP_SECURE=false' docs/architecture/vercel-render-neon.md
! grep -qE '587.{0,20}STARTTLS, pinned' docs/architecture/vercel-render-neon.md
! grep -q 'Registration returns HTTP' docs/architecture/vercel-render-neon.md
! grep -q 'surfaces as HTTP' docs/architecture/vercel-render-neon.md
for e in verification_email_delivery_failed smtp_transport_verify_ok smtp_transport_verify_failed smtp_transport_verify_skipped; do
  grep -q "$e" docs/architecture/observability.md
done
grep -q 'warn' docs/architecture/observability.md
grep -q 'info' docs/architecture/observability.md
grep -q 'debug' docs/architecture/observability.md
grep -q 'errorType' docs/architecture/observability.md
grep -q 'transportCode' docs/architecture/observability.md
grep -q 'host' docs/architecture/observability.md
grep -q 'port' docs/architecture/observability.md
grep -q 'No email, username, account id, token, message or stack' docs/architecture/observability.md
! git diff --name-only | grep -qx 'docs/features/README.md'
git rev-parse --verify origin/main >/dev/null
# Credential, PII and token audits
! git grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
! git grep --untracked -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
! git diff origin/main...HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
! git log -p origin/main..HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
! git log --name-only --pretty=format: origin/main..HEAD | grep -qE '(^|/)\.env'
! git diff origin/main...HEAD -- README.md docs/architecture | grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' | grep -vxE 'no-reply@cubeclicker\.local|user@example\.com' | grep . >/dev/null
! git diff --no-color --unified=0 origin/main...HEAD -- README.md docs/architecture \
  | grep '^+' \
  | grep -oE 'verify\?token=[A-Za-z0-9_-]+|token=[0-9a-f]{32,}' \
  | grep -vxF 'verify?token=cli-test' \
  | grep . >/dev/null
! grep -qE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' docs/features/registration-account-exists/build-log-T8.md
! grep -qE 'verify\?token=|token=[0-9a-f]{32,}|raultorraco' docs/features/registration-account-exists/build-log-T8.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/registration-account-exists/build-log-T8.md
test -f docs/features/registration-account-exists/spec.md
test -f docs/features/registration-account-exists/plan.md
test -f docs/features/registration-account-exists/tasks.md
test -f docs/features/registration-account-exists/status.md
test -f docs/features/registration-account-exists/build-log-T8.md
```
acceptance: AC-10
status: [x]

Run the full gate across **both** workspaces and record raw output: lint, typecheck, tests, `npm run coverage` (≥ 80% statements/branches/functions/lines per workspace), build, Mailpit-primed smoke, actionlint over both workflows, the Vercel/Render config parses, the unchanged email-CLI suite, the T1 process fixtures, the T7 per-file doc checks, and the credential/PII/token/branch-history audits. Redact any fixture address in captured output to `<test-address>`; keep exit status and asserted lines. No source edits: a failure reopens the owning task.

## T9 — User-owned pre-merge setting and deployed live proof `[owner]` `[seq]`
depends_on: T8
files_owned: `docs/features/registration-account-exists/build-log-T9.md`
external_side_effects: GitHub `development` variables `SMTP_PORT=2525` and `SMTP_SECURE=false` (Phase A, before merge), a Deploy run (after merge), a live resend/registration to an owner-controlled mailbox, and Brevo/Render log inspection — **owner-executed only**
verify:
```bash
set -euo pipefail
# Phase A: must be recorded before merge
test "$(gh variable get SMTP_PORT --env development --repo raultorres2603/CubeClicker)" = "2525"
test "$(gh variable get SMTP_SECURE --env development --repo raultorres2603/CubeClicker)" = "false"
# Phase B: post-merge deploy and live proof
gh run list --workflow Deploy --limit 1 --repo raultorres2603/CubeClicker --json conclusion,headSha --jq '.[0].conclusion' | grep -qx success
curl -fsS https://cubeclicker-development.onrender.com/healthz | grep -qx '{"status":"ok"}'
log=docs/features/registration-account-exists/build-log-T9.md
test -f "$log"
grep -q 'Phase A (pre-merge)' "$log"
grep -q 'Phase B (post-merge)' "$log"
grep -q 'SYNCED SMTP_PORT (value verified, not shown)' "$log"
grep -q 'smtp_transport_verify_ok\|info level filtered; no verification_email_delivery_failed line' "$log"
grep -q 'Brevo transactional log' "$log"
grep -q 'verified = true' "$log"
grep -q 'joined as account' "$log"
grep -q "join { mode: 'account' }" "$log"
! grep -qE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' "$log"
! grep -qE 'verify\?token=|token=[0-9a-f]{32,}|raultorraco' "$log"
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" "$log"
```
acceptance: AC-11
status: [ ]

**Phase A (before merge):** owner sets `SMTP_PORT=2525` and `SMTP_SECURE=false` in the GitHub `development` Environment, records `gh variable get` for both under the literal marker `Phase A (pre-merge)`. If missed, the first deploy fails at the guard; recovery is to set them and re-run, never bypass. **Phase B (after the post-merge Deploy):** confirm the run succeeded, `/healthz`, and record under `Phase B (post-merge)` the literal lines `SYNCED SMTP_PORT (value verified, not shown)`, the Render probe (`smtp_transport_verify_ok` or the exact `info level filtered; no verification_email_delivery_failed line` fallback), `Brevo transactional log`, `verified = true`, and `joined as account` after a successful login + `join { mode: 'account' }`. Use `<owner-address>`/`<frontend origin>` placeholders; no address, username, token, link, credential or third-party PII in the log. No agent performs the value change, deploy, registration or email send. Q-1 (delete both or keep U2) is **not** part of this task.
