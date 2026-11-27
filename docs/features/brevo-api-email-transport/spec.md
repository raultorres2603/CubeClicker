---
feature: brevo-api-email-transport
revision: 3
status: draft
created: 2026-11-26
updated: 2026-11-26
---
# Spec — Brevo HTTPS Email Transport (deployed environments)

## Summary

The deployed `development` frontend still cannot deliver a verification email: every registration and resend reaches Brevo's SMTP relay and is rejected with SMTP `EAUTH` after six credential/deploy attempts, so no Brevo transactional record is created and the account stays unverified with no usable token. This feature makes **Brevo's HTTPS Transactional Email API on port 443 the transport for deployed environments** — `POST https://api.brevo.com/v3/smtp/email` with `EMAIL_TRANSPORT=brevo-api` and a `BREVO_API_KEY` — while local `podman compose up` and the containerized smoke keep the unchanged Mailpit SMTP path (`EMAIL_TRANSPORT=smtp`). It reuses the existing branded HTML template, keeps the accepted `502 verification_email_failed` / resend / token-invalidation contract and the already-correct frontend, adds a non-blocking API readiness probe with redacted structured logs, extends the GitHub→Render deploy catalog and guard so the managed deploy cannot fall back to SMTP, and records an owner-run live proof that actually delivers to the stale unverified account. It supersedes the SMTP-based deployed delivery recipe and consumes the blocked Phase B of `registration-account-exists` T9/AC-11.

## Diagnosis (verified; authoritative evidence)

The investigation is complete and is not repeated here. The authoritative evidence is `docs/features/registration-account-exists/build-log-T9.md` (deploy attempts 4–6, the diagnosis follow-up and the stale-account row query); no sensitive value is repeated in this artifact.

- The deployed backend is current and healthy: `/healthz` returns exactly `{"status":"ok"}`, the deploy guard and the GitHub→Render sync run green, and the Render service reaches `smtp-relay.brevo.com:2525`.
- Every synced credential pair is rejected at the SMTP authentication stage (`smtp_transport_verify_failed`, and `verification_email_delivery_failed` on register and resend) with transport code `EAUTH`. The SMTP login was corrected and the SMTP key was replaced twice; both freshly synced instances still fail. Brevo has **zero transactional records** for the account, so Brevo never accepted a message.
- SMTP credential provisioning is dashboard/OTP owner-only and has failed six attempts. It is not a code defect.
- The Brevo REST API key available to the Brevo MCP works; the account relay is enabled and one active sender exists. `POST https://api.brevo.com/v3/smtp/email` over HTTPS 443 is therefore a viable transport that avoids Render-free SMTP entirely.
- The account row created by the failed registration exists, is `verified = false`, and has **zero verification tokens** (the failed send invalidated them). A later resend issues a fresh token; no account cleanup or merge is needed for recovery.
- The current backend has one email transport only (`SmtpEmailService`), the route already maps `EmailDeliveryError` to `502 verification_email_failed`, the token is invalidated on every failed send, and the frontend 502/resend UI is already correct.

## User stories

- As the registrant on the deployed development site, I want the verification email to arrive, so I can activate my account and play.
- As the registrant whose earlier attempt failed, I want a resend to issue a fresh token and reach my mailbox, so I do not have to re-register or ask for a database change.
- As the operator, I want deployed delivery to use one working HTTPS credential, so a rotation does not depend on SMTP login/key provisioning.
- As the operator, I want the managed pipeline to fail closed when the API transport or its key is missing, so a deployment cannot silently use the failing SMTP path; a dashboard-only deploy that boots `smtp` must fail visibly at send (`502`), not silently.
- As the security reviewer, I want the API key to remain a runtime secret that never reaches logs, artifacts, the image or the client, and provider response bodies (which may contain addresses) never to be parsed or logged.
- As the developer, I want local Mailpit and the smoke test unchanged, so local work needs no Brevo key.

## Requirements

- **R-1** `EMAIL_TRANSPORT` selects the transport: `smtp` (local/Mailpit and off-Render deployments) or `brevo-api` (deployed). Unset/empty defaults to `smtp` for every `NODE_ENV`, preserving local and prod-image behavior; the deploy guard requires `brevo-api` for the managed `development`/`production` environments.
- **R-2** `EMAIL_TRANSPORT=brevo-api` requires a non-empty `BREVO_API_KEY` and a parseable, non-local `SMTP_FROM`; missing/invalid values fail startup naming the variable and never echo a value.
- **R-3** The API transport sends the existing branded verification template — same subject, plain-text body and HTML — through `POST https://api.brevo.com/v3/smtp/email` with `sender`, `to`, `subject`, `htmlContent` and `textContent`, a 10-second timeout, and no attachments.
- **R-4** API failures become the same typed `EmailDeliveryError` (`code = verification_email_failed`, `transport = brevo-api`, `host = api.brevo.com`, `port = 443`) with a redacted, value-free message and a whitelisted `HTTP_<status>` transport code for non-2xx responses.
- **R-5** A non-blocking `onReady` API probe checks the key against `GET https://api.brevo.com/v3/account` without delaying `listen` or `/healthz`, and logs a redacted outcome.
- **R-6** The existing `502 verification_email_failed` body, one-per-failure warn event, token invalidation on every failed send, resend behavior, frontend UI and rate limits are unchanged.
- **R-7** The GitHub `development`/`production` catalog gains `EMAIL_TRANSPORT` (variable) and `BREVO_API_KEY` (secret); the deploy guard validates 11 names, syncs 9 to Render, and rejects any deployed environment that selects SMTP, reuses the SMTP key as the API key, or configures an unparseable/local sender.
- **R-8** `render.yaml` declares both new names `sync: false` with no value; compose passes both through with Mailpit/SMTP defaults and the smoke pins `EMAIL_TRANSPORT=smtp`.
- **R-9** Documentation names the transport contract, the key creation/rotation runbook, the production catalog, the event catalog, the stale-account recovery and the supersession of the SMTP delivery recipe; `README.md` and the affected architecture references (`email.md`, `deployment.md`, `vercel-render-neon.md`) state that development and production deliver through the Brevo HTTPS API on port 443 and SMTP remains local/off-Render only, and no file retains a current "deployed uses SMTP" claim.
- **R-10** The owner-run live proof deploys development, proves the API probe and a real delivery to the stale account, and records redacted evidence; it is explicitly owner-attested and not CI-reproducible. No agent creates/reads/rotates the key or sends email. The production catalog is a code/documentation contract; this feature writes no live production values.

## Acceptance criteria

Identifiers, status codes, field names and messages below are exact. "No PII" means no email address, username, account id, verification token/link, API key or SMTP credential in a response body, log line or artifact. Configured test values are synthetic fixtures defined in the test files; this spec uses `<address>`, `<verified-sender>`, `<frontend-origin>`, `<repo>` and `<CHANGEME-brevo-api-key>` placeholders instead of real values.

### Configuration and sender contract

- **AC-1 — Transport selection is explicit and fail-closed.**
  (a) `loadAuthConfig` exposes `emailTransport: 'smtp' | 'brevo-api'` and `brevoApiKey: string | null`.
  (b) With `EMAIL_TRANSPORT` unset or empty it is `smtp` for every `NODE_ENV`, including `production`; existing local and prod-image runs need no Brevo configuration.
  (c) `EMAIL_TRANSPORT=smtp` is accepted at runtime for every `NODE_ENV`, including `production`; the deployed-environment enforcement is AC-7's guard, not a startup rejection. No startup path rejects an explicit `smtp` selection.
  (d) `EMAIL_TRANSPORT=brevo-api` with `BREVO_API_KEY` absent or empty throws exactly `BREVO_API_KEY must be a non-empty string when EMAIL_TRANSPORT=brevo-api`.
  (e) `EMAIL_TRANSPORT=mailgun` throws exactly `EMAIL_TRANSPORT must be "smtp" or "brevo-api"; received "mailgun"`.
  (f) `EMAIL_TRANSPORT=smtp` accepts and ignores a set `BREVO_API_KEY`; every existing SMTP parse (host, port, secure, pairing, timeout, from, app base/allowed origin, session and token settings) is unchanged, including the exact pairing error.
  (g) `EMAIL_TRANSPORT=brevo-api` accepts exactly three `SMTP_FROM` forms: a bare address, an angle-only `<address>`, and `Display Name <address>`; any other non-empty, non-whitespace value throws exactly `SMTP_FROM must be an address or "Display Name <address>" when EMAIL_TRANSPORT=brevo-api`. An unset or empty `SMTP_FROM` throws the existing `SMTP_FROM must be a non-empty string; received ""` before the parse error, and a whitespace-only value throws the AC-1(g) parse error after trimming. The empty/whitespace precedence is pinned by tests.
  (h) `EMAIL_TRANSPORT=brevo-api` with a `SMTP_FROM` whose parsed address equals `DEFAULT_SMTP_FROM` (bare, angle-only or display-name form) throws exactly `SMTP_FROM must be a Brevo-verified sender when EMAIL_TRANSPORT=brevo-api; the local default is not deliverable`.
  (i) `EMAIL_TRANSPORT=brevo-api` with a valid key and sender returns `emailTransport: 'brevo-api'`, `brevoApiKey` equal to the input, and the existing `smtpFrom` unchanged (no trimming of the stored value).
  Evidence: `src/backend/src/auth/config.test.ts`.

- **AC-2 — The sender parser is exact.**
  (a) `parseEmailSender` returns `{ name: 'CubeClicker', email: <fixture address> }` for the fixture value `CubeClicker <fixture address>`.
  (b) It returns `{ email: <fixture address> }` (no `name` property) for the bare fixture address and for the angle-only `<fixture address>`; the angle-only form is an accepted bare-address form per AC-1(g).
  (c) It trims surrounding whitespace around the whole value and around the display name.
  (d) It returns `null` for `CubeClicker <not-an-address>`, `not an address`, an empty string, a value with two `<`/`>` pairs, and a value with no `@`-bearing address.
  (e) `loadAuthConfig` with `EMAIL_TRANSPORT=brevo-api` uses this parser for the AC-1(g)/(h) decisions; the parser is exported for the deploy guard (AC-7(c) exercises the caller).
  Evidence: `config.test.ts`.

### Brevo API transport

- **AC-3 — The API send request is exact and reuses the branded template.**
  (a) `BrevoApiEmailService.sendVerification(to, verificationUrl, options)` calls the injected request seam exactly once with:
  - URL exactly `https://api.brevo.com/v3/smtp/email`;
  - method exactly `POST`;
  - headers exactly `{ 'api-key': <BREVO_API_KEY>, 'content-type': 'application/json', accept: 'application/json' }`;
  - a JSON body whose keys are exactly `sender`, `to`, `subject`, `htmlContent`, `textContent`;
  - `sender` exactly `{ email: <SMTP_FROM address>, name: <SMTP_FROM display name> }` (the `name` property is absent when the sender has no display name);
  - `to` exactly `[{ email: <recipient> }]`;
  - `subject` exactly `Verify your CubeClicker email`;
  - `htmlContent` exactly `renderVerificationEmail(verificationUrl, options).html`;
  - `textContent` exactly `renderVerificationEmail(verificationUrl, options).text`;
  - `signal` an `AbortSignal`; the exported timeout constant `BREVO_API_TIMEOUT_MS` is exactly `10000`, asserted by value in `email.test.ts` (the source spelling `10_000` or `10000` is not an acceptance condition).
  (b) A `201` response resolves; a `202` response resolves; the response body is not read.
  (c) The body contains no `attachments`, `replyTo`, `params`, `tags`, `templateId` or `messageVersions` key.
  (d) The plain-text body and subject are byte-identical to the SMTP path; only the transport changes.
  Evidence: `src/backend/src/auth/email.test.ts`.

- **AC-4 — API failures are typed, bounded and redacted.**
  (a) A non-2xx response (`400`, `401`, `403`, `429`, `500`) rejects with `EmailDeliveryError` whose `name` is `EmailDeliveryError`, `code` is `verification_email_failed`, `transport` is `brevo-api`, `host` is `api.brevo.com`, `port` is `443`, `errorType` is `BrevoApiError`, `transportCode` is exactly `HTTP_400`/`HTTP_401`/`HTTP_403`/`HTTP_429`/`HTTP_500`, and `message` is exactly `Brevo API responded with HTTP <status>`.
  (b) A request rejection whose `name` is `TimeoutError` rejects with `EmailDeliveryError` whose `transport` is `brevo-api`, `errorType` is `TimeoutError`, `transportCode` is absent, and `message` is exactly `Brevo API request timed out after 10000ms`.
  (c) Any other request rejection rejects with `EmailDeliveryError` whose `errorType` is the source error name or `unknown`, `transportCode` is absent, and `message` is exactly `Brevo API request failed`.
  (d) A provider response body containing the recipient address, a synthetic REST-key-shaped token and a synthetic SMTP-key-shaped token never appears in any `EmailDeliveryError` field or message (the body is never parsed); the configured API key never appears in any field or message.
  (e) `verify()` calls `GET https://api.brevo.com/v3/account` exactly once with headers exactly `{ 'api-key': <BREVO_API_KEY>, accept: 'application/json' }` and the same timeout signal; a `200` resolves; a `401` rejects with `errorType: 'BrevoApiError'`, `transportCode: 'HTTP_401'` and `message: 'Brevo API responded with HTTP 401'`; the account body is not read.
  Evidence: `email.test.ts`.

- **AC-5 — Composition selects the transport and probes it non-blockingly.**
  (a) `buildApp` with `EMAIL_TRANSPORT=brevo-api`, a valid key and a valid sender constructs the API service through the injected `brevoRequest` seam; the injected SMTP `emailTransportFactory` is **not** called.
  (b) `buildApp` with `EMAIL_TRANSPORT=smtp` keeps the existing factory path: the SMTP factory is called exactly once with the exact SMTP transport object, and the existing probe events are unchanged.
  (c) The `onReady` probe starts `verify()` at most once per app instance and never awaits it: with a `brevoRequest` promise that never settles, `GET /healthz` still returns `200 {"status":"ok"}` and `app.inject` completes.
  (d) A resolved API probe logs exactly one `info` event `brevo_api_transport_verify_ok` with `{ host: 'api.brevo.com', port: 443 }`.
  (e) A rejected API probe logs exactly one `warn` event `brevo_api_transport_verify_failed` with `{ errorType: 'BrevoApiError', transportCode: 'HTTP_401', host: 'api.brevo.com', port: 443 }`; the line carries no API key, message, stack, address or request body, and the rejection is caught.
  (f) An injected email service without `verify` logs exactly one `debug` event `brevo_api_transport_verify_skipped` with `{ reason: 'unsupported' }`; it never fails readiness or changes `/healthz`.
  (g) The probe's failure never closes the app, never changes `/healthz` and never delays `listen` beyond the existing startup path.
  Evidence: `src/backend/src/app.test.ts`.

- **AC-6 — The 502, resend and token contract is unchanged for the API transport.**
  (a) `POST /auth/register` with a real `BrevoApiEmailService` whose request rejects `401` returns exactly `{ "message": "verification email could not be sent", "code": "verification_email_failed", "error": "verification_email_failed" }`, sets no session cookie and creates no session.
  (b) `POST /auth/resend-verification` under the same failure returns the same exact `502` body.
  (c) The route emits exactly one `warn` event `verification_email_delivery_failed` with `{ route: 'register' | 'resend-verification', transport: 'brevo-api', errorType: 'BrevoApiError', transportCode: 'HTTP_401', host: 'api.brevo.com', port: 443 }`; the line contains no address, username, account id, token, API key, provider message or stack.
  (d) The token issued for the failed attempt is invalidated: the test captures the raw token from the `verificationTokens.issue` spy, triggers the rejection, and `consume(capturedToken)` returns `null`; the account stays persisted and unverified.
  (e) Once the request starts succeeding, `POST /auth/resend-verification` returns exactly `202 { "message": "verification email sent" }` and sends exactly one message through the API.
  (f) `src/frontend/**` is unchanged; the existing `AuthForms` and `VerificationPending` tests pass unchanged and render the same 502/resend copy.
  Evidence: `src/backend/src/auth/auth-routes.test.ts`, the existing frontend test suites.

### Deployment contract

- **AC-7 — The deploy catalog carries the API transport and fails closed.**
  (a) `src/backend/src/deploy/render-env.ts` exports `SMTP_CATALOG` unchanged (exactly the seven accepted SMTP names in order), `EMAIL_CATALOG` exactly `[{ key: 'EMAIL_TRANSPORT', source: 'variable' }, { key: 'BREVO_API_KEY', source: 'secret' }]`, `SYNC_CATALOG` exactly the nine names in `SMTP_CATALOG`-then-`EMAIL_CATALOG` order, `RENDER_WIRING` unchanged, and `CATALOG` exactly the eleven names in `SYNC_CATALOG`-then-`RENDER_WIRING` order.
  (b) `validateDeployEnv` with the pinned production placeholder set returns exactly six placeholders in catalog order: `SMTP_FROM`, `SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `RENDER_SERVICE_ID`, `RENDER_API_KEY`; with an empty environment it returns all eleven names as missing in catalog order.
  (c) `validateEmailTransport(env)` returns exactly:
  - `{ ok: true }` for `TARGET_ENVIRONMENT=development` with `EMAIL_TRANSPORT=brevo-api`, a non-placeholder `BREVO_API_KEY`, a parseable non-local `SMTP_FROM`, and a key that is neither SMTP-key-shaped nor equal to `SMTP_PASS`;
  - `{ ok: true }` for `TARGET_ENVIRONMENT=production` with the same complete API-valid fixture (the function applies to production; this case is explicitly tested);
  - `{ ok: false, reason: 'deployed_requires_api', transport: 'smtp' }` for development or production with `EMAIL_TRANSPORT=smtp`;
  - `{ ok: false, reason: 'unsupported_transport', transport: 'mailgun' }` for an unknown non-empty value;
  - `{ ok: false, reason: 'smtp_key_reused' }` when `BREVO_API_KEY` starts with `xsmtpsib-` or equals `SMTP_PASS`;
  - `{ ok: false, reason: 'local_sender' }` when the parsed `SMTP_FROM` address equals `DEFAULT_SMTP_FROM` (bare, angle-only or display-name form);
  - `{ ok: false, reason: 'invalid_sender' }` when `SMTP_FROM` does not parse;
  - `{ ok: true }` for any `TARGET_ENVIRONMENT` other than `development`/`production` (the local/CLI path is not a deployed environment).
  (d) `formatEmailTransportFailure(environment, failure)` returns exactly the pinned block for each reason:
  ```
  Deploy blocked: EMAIL_TRANSPORT must be "brevo-api" for the 'development' environment; received "smtp".
    Deployed verification email uses Brevo's HTTPS API (port 443); SMTP authentication is not used.
    Runbook: README.md § Deployment Brevo runbook
  ```
  ```
  Deploy blocked: EMAIL_TRANSPORT must be "smtp" or "brevo-api" ('development' environment); received "mailgun".
    Runbook: README.md § Deployment Brevo runbook
  ```
  ```
  Deploy blocked: BREVO_API_KEY is the Brevo SMTP key, not the REST API key ('development' environment).
    Create a Brevo API key under Settings → SMTP & API → API Keys and store it as the BREVO_API_KEY secret.
    Runbook: README.md § Deployment Brevo runbook
  ```
  ```
  Deploy blocked: SMTP_FROM is the local Mailpit default and cannot deliver through the Brevo API ('development' environment).
    Set SMTP_FROM to the Brevo-verified sender.
    Runbook: README.md § Deployment Brevo runbook
  ```
  ```
  Deploy blocked: SMTP_FROM must be an address or "Display Name <address>" when EMAIL_TRANSPORT=brevo-api ('development' environment).
    Set SMTP_FROM to the Brevo-verified sender.
    Runbook: README.md § Deployment Brevo runbook
  ```
  The blocks never echo `SMTP_FROM`, `BREVO_API_KEY`, `SMTP_PASS` or any credential/sender value; the only configured value echoed is the rejected non-secret `EMAIL_TRANSPORT` value in the two transport blocks.
  (e) `render.yaml` declares `EMAIL_TRANSPORT` and `BREVO_API_KEY` with `sync: false` and no `value`; the YAML parse passes and all other entries are unchanged, proven by a parsed comparison of the other `envVars` (keys, values, `sync`) and the service-level fields against `origin/main:render.yaml`.
  Evidence: `src/backend/src/deploy/render-env.test.ts`, the `render.yaml` parse.

- **AC-8 — The deploy CLI validates eleven, syncs nine, and CI proves the guard.**
  (a) `--check-only` with the complete development fixture exits `0` and prints exactly `Deploy configuration OK: 11 value(s) present for the 'development' environment.`
  (b) The production placeholder fixture exits `1` and prints the existing `formatGuardFailure` block whose header is exactly `Deploy blocked: the 'production' environment has 6 unset or placeholder value(s).`, whose placeholder line is exactly `  Placeholder: SMTP_FROM, SMTP_USER, SMTP_PASS, BREVO_API_KEY, RENDER_SERVICE_ID, RENDER_API_KEY`, and whose remediation/runbook lines are the existing names-only lines. The test additionally asserts that the output contains neither `Deploy blocked: SMTP_PORT=` nor `Deploy blocked: EMAIL_TRANSPORT must be`, so a port or transport block cannot be added unnoticed.
  (c) `--dry-run` prints one `DRY RUN: would set <KEY> (PUT https://api.render.com/v1/services/<id>/env-vars/<KEY>)` line for each of the nine `SYNC_CATALOG` names in order, then exactly `DRY RUN complete: 11 value(s) validated for the 'development' environment; 9 would be synced; no network calls made.`; no fetch occurs.
  (d) Default mode sends exactly nine `PUT` requests in `SYNC_CATALOG` order, with the existing headers and `{"value":"<value>"}` bodies (including `{"value":"brevo-api"}` and the fixture API key), verifies each echo, prints nine `SYNCED <KEY> (value verified, not shown)` lines, then exactly `Synced 9 value(s) to Render service <id> for the 'development' environment.`
  (e) Guard precedence is exact: development with `EMAIL_TRANSPORT=smtp` and `SMTP_PORT=587` prints the AC-7(d) `deployed_requires_api` block (not the port block) with zero fetches; development with `EMAIL_TRANSPORT=brevo-api` and `SMTP_PORT=587` still prints the existing blocked-port block (the SMTP port guard remains in force); development with `EMAIL_TRANSPORT=brevo-api`, `SMTP_PORT=2525` and `SMTP_SECURE=false` prints the AC-8(a) line.
  (f) `.github/workflows/deploy.yml` binds `EMAIL_TRANSPORT` (variable) and `BREVO_API_KEY` (secret) in both the `--check-only` step and the sync step. A parsed YAML comparison against `origin/main:.github/workflows/deploy.yml` proves that the triggers (`on`), `concurrency`, `permissions`, job `if`/`runs-on`/`timeout-minutes`/`environment`/`env`, the ordered step names and every step's `uses`, `run` and `with` are unchanged, and that the only env additions are exactly those four keys in the two CLI steps. `actionlint` passes over both workflows.
  (g) `.github/workflows/ci.yml` has exactly one complete development fixture containing `EMAIL_TRANSPORT: brevo-api` and `BREVO_API_KEY: fixture-key` and asserting the AC-8(a) line, and exactly one production placeholder fixture containing `EMAIL_TRANSPORT: brevo-api` and `BREVO_API_KEY: '<CHANGEME-brevo-api-key>'` and asserting the six-placeholder header. Exact counts: `EMAIL_TRANSPORT: brevo-api` appears exactly twice, `BREVO_API_KEY: fixture-key` exactly once, `BREVO_API_KEY: '<CHANGEME-brevo-api-key>'` exactly once, `Deploy configuration OK: 11 value(s)` exactly once, and `has 6 unset or placeholder value(s)` exactly once. `actionlint` passes and the fixtures use no credential-shaped value.
  Evidence: `src/backend/src/deploy/render-env-cli.test.ts`, the real-process fixtures, the `actionlint` runs and the workflow greps.

### CLI, local path and documentation

- **AC-9 — The operator email CLI honors the selected transport.**
  (a) With `EMAIL_TRANSPORT=brevo-api`, `--to <address>` and a service that resolves, the CLI returns `0` and prints exactly `Test email sent to <address> via Brevo API (api.brevo.com:443, transport=brevo-api, from="<SMTP_FROM>")`; it prints no SMTP `secure`/`starttls`/`auth` fields.
  (b) With the API request rejecting `401`, the CLI returns `1` and prints exactly `Failed to send test email via Brevo API (api.brevo.com:443): Brevo API responded with HTTP 401`; no key, address or provider body appears.
  (c) With `EMAIL_TRANSPORT=brevo-api` and no `BREVO_API_KEY`, the CLI returns `1` and prints exactly `Invalid email configuration: BREVO_API_KEY must be a non-empty string when EMAIL_TRANSPORT=brevo-api`; no service is constructed.
  (d) The existing SMTP success, warning, failure, argument and `--help` lines remain byte-identical.
  (e) `redactSecrets` redacts the configured `BREVO_API_KEY` value in addition to the SMTP values, and a synthetic `xkeysib-`/`xsmtpsib-` token in a rejection message prints `[redacted]`.
  Evidence: `src/backend/src/auth/email-cli.test.ts`.

- **AC-10 — Local Mailpit and the containerized smoke are unchanged.**
  (a) With the `SMTP_*`, `EMAIL_TRANSPORT` and `BREVO_API_KEY` variables unset, the merged compose config resolves `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, `EMAIL_TRANSPORT=smtp` and an empty `BREVO_API_KEY`; the smoke override pins the same four values.
  (b) `podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit` followed by `npm run smoke` exits `0` with every check passing; the smoke never contacts Brevo.
  (c) `compose.yaml` and `compose.smoke.yaml` add no service, image, port, volume or healthcheck; a parsed top-level comparison against `origin/main:compose.yaml` and `origin/main:compose.smoke.yaml` shows the service set, images/builds, ports, volumes, depends_on, healthchecks and top-level volumes unchanged, with only `environment` values allowed to differ.
  Evidence: the compose-config assertions and `npm run smoke` in the T1/T7 build logs.

- **AC-11 — Documentation matches the shipped behavior, per file.**
  Every file below must contain the exact positive sentence `Development and production deliver verification email through the Brevo HTTPS API on port 443; SMTP remains the local/off-Render transport.` This sentence is the guard against a document keeping a current "deployed uses SMTP" claim.
  (a) `docs/architecture/email.md` exists (new canonical reference) and contains `EMAIL_TRANSPORT`, `brevo-api`, `BREVO_API_KEY`, `POST https://api.brevo.com/v3/smtp/email`, `api-key`, `htmlContent`, `textContent`, `443`, `10000`, `verification_email_failed`, `persisted and unverified`, `brevo_api_transport_verify_ok`, `brevo_api_transport_verify_failed`, `Settings → SMTP & API → API Keys`, `rotate`, `Mailpit`, `No new service, image, port, volume, healthcheck or WebSocket endpoint was added.`, the required positive sentence, and a statement that the API key is never logged, committed, baked into an image or sent to the client.
  (b) `README.md`:
    - Contains: the required positive sentence; `eleven validated, nine synced`; `Brevo HTTPS API`; `443`; `brevo_api_transport_verify_ok`; `persisted and unverified`; `EMAIL_TRANSPORT=brevo-api`; `BREVO_API_KEY`; `Settings → SMTP & API → API Keys`; the API success line `Test email sent to <address> via Brevo API (api.brevo.com:443, transport=brevo-api, from="<SMTP_FROM>")`; the rotation strings `Create a replacement key under Settings → SMTP & API → API Keys`, ``update the `BREVO_API_KEY` GitHub Environment secret`` and `revoke the old key`; the recovery step ``Set `BREVO_API_KEY` to the Brevo API key from **Settings → SMTP & API → API Keys** and re-run **Deploy**; the deployed API transport does not use an SMTP key.``; the catalog rows ``| `EMAIL_TRANSPORT` | variable |`` and ``| `BREVO_API_KEY` | secret |``; `gh variable set EMAIL_TRANSPORT`; `gh secret set BREVO_API_KEY`; the heading ``Exact `gh` commands (22 lines)``; the secrets-list fragment `` `SMTP_PASS`, `BREVO_API_KEY`, `RENDER_API_KEY` ``; the variables-list fragment `` `SMTP_FROM`, `EMAIL_TRANSPORT`, `RENDER_SERVICE_ID` ``; the production code-catalog statement `The production catalog is a code/documentation contract` and `no live production environment is modified`; the supersession statement `This feature supersedes the SMTP delivery recipe`; `records the AC-11(a) ordering deviation`; `requires EMAIL_TRANSPORT and BREVO_API_KEY before merge`; and `### Registration recovery (development)` with the API key path.
    - No longer contains: `Development and production deliver real verification email through **Brevo SMTP**`; `` The deployed `development` recipe is therefore `SMTP_PORT=2525` ``; `The deployed development backend must therefore send through`; `The nine deployment names are the source of truth`; `Development email delivers through Brevo SMTP`; `the nine names exist with pinned placeholders`; `validates **nine** names`; ``This feature supersedes only the preserved `SMTP_PORT` value``; ``seven `SYNCED <KEY>` lines``; `Synced 7 value(s)`; `The Render dashboard lists the seven keys`; `` `SMTP_PASS` holds the **SMTP key** ``; `The seven SMTP names are written to Render`; ``Exact `gh` commands (18 lines)``; `**Preserve note.**`; `` Before this feature merges to `main`, set `SMTP_PORT=2525` ``; ``record both values in `build-log-T9.md` Phase A``; `If the resend still fails at 2525`; `there is no Brevo REST API integration`; `SMTP only`; `nine validated, seven synced`; `syncs the seven SMTP names`; `seven SMTP values`; `seven SMTP names through the Render API`; `writes the seven SMTP names`; `writes only the seven SMTP names`; `seven SMTP names are written`; `rewrites all seven SMTP names`.
  (c) `docs/architecture/deployment.md`:
    - Contains: the required positive sentence; `EMAIL_TRANSPORT`; `BREVO_API_KEY`; `eleven validated, nine synced`; `Brevo HTTPS API`; `443`; `brevo_api_transport_verify_ok`; `six pinned placeholders`; `persisted and unverified`; `production catalog`.
    - No longer contains: `**Brevo SMTP.**`; `` the deployed `development` recipe is `SMTP_PORT=2525` ``; `seven SMTP names, synced from the GitHub Environment`; `the same nine deployment names`; `` nine values, `--check-only` ``; `nine validated, seven synced`; `syncs the seven SMTP names`; `seven SMTP values`; `seven SMTP names via the Render API`; `Delivery is an SMTP side effect`.
  (d) `docs/architecture/vercel-render-neon.md`:
    - Contains: the required positive sentence; the catalog rows ``| `EMAIL_TRANSPORT` | var |`` and ``| `BREVO_API_KEY` | secret |``; `eleven validated, nine synced`; `Brevo HTTPS API`; `443`; `brevo_api_transport_verify_ok`; `six pinned placeholders`; `production catalog`.
    - No longer contains: `Brevo SMTP delivers verification email in development and production`; `Development and production deliver through **Brevo SMTP**`; `SMTP only; no Brevo REST API integration`; `synced to Render for the seven SMTP names`; `the six deployment variables and the three deployment secrets`; `The nine deployment names are validated`; `same nine names`; `` the deployed recipe stays `SMTP_PORT=2525` ``; `Email verification does not arrive`; `The seven SMTP deployment names are validated`; `nine validated, seven synced`; `seven SMTP names are synced`; `syncs the seven SMTP names`; `seven SMTP values`; `writes the seven SMTP names`.
  (e) `docs/architecture/observability.md` catalogs `brevo_api_transport_verify_ok` (info), `brevo_api_transport_verify_failed` (warn), `brevo_api_transport_verify_skipped` (debug, `unsupported`), adds `transport` to `verification_email_delivery_failed`, states `transportCode` is `HTTP_<status>` for API failures, uses the exact phrase `email transport` for the rejection prose, and retains `No email, username, account id, token, message or stack`. It no longer contains `when the SMTP transport rejects` or `SMTP broken`.
  (f) `docs/architecture/containerization.md` records the two new compose pass-throughs (`EMAIL_TRANSPORT`, `BREVO_API_KEY`), contains the exact sentence `No new service, image, port, volume, healthcheck or WebSocket endpoint was added.`, and no longer contains `SMTP pass-throughs recorded`.
  (g) `docs/features/README.md` is **not** edited by this feature; the T6 build log contains a `Feature-index row proposal` line with the slug, title, state and date for the orchestrator.
  Evidence: T6's per-file verify loop and T7's verbatim re-run.

### Gate and live proof

- **AC-12 — No regression and the full gate is green.**
  (a) `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (≥ 80% statements/branches/functions/lines per workspace) and `npm run build` pass with no coverage exclusion or threshold change. The coverage configuration is proven unchanged by `git diff --exit-code origin/main...HEAD -- src/backend/vitest.config.ts src/frontend/vitest.config.ts`; the four thresholds remain exactly `80` and the only excludes remain the test globs, the composition root and `coverageConfigDefaults.exclude`.
  (b) `npm run smoke` passes with `compose.smoke.yaml` still pinning Mailpit.
  (c) `actionlint` passes over both workflows; the `render.yaml` YAML parse and `src/frontend/vercel.json` JSON parse pass.
  (d) The deploy CLI process fixtures cover the 11-name acceptance, the 6-placeholder production rejection, the `EMAIL_TRANSPORT=smtp` rejection, the SMTP-key-reuse rejection and the local-sender rejection.
  (e) One shared build-log guard is applied to every `docs/features/brevo-api-email-transport/build-log-T*.md` and to the final loop over `build-log-*.md`: the extended regex `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|verify\?token=|[0-9a-f]{32,}|xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|rnd_[A-Za-z0-9_-]{20,}|(SMTP_(USER|PASS)|BREVO_API_KEY|RENDER_API_KEY)[[:space:]]*[:=][[:space:]]*["']?[A-Za-z0-9+/_-]{12,}` must not match. It covers addresses, `verify?token=`, bare 32+ hex tokens, SMTP/Render key shapes, and YAML/shell assignments (including `BREVO_API_KEY:`). T6/T7/T8 evidence records commit ids as `<commit>` (or a reviewed exception) so a harmless 40-character SHA cannot trip the bare 32+ hex alternative; the token guard is not weakened. T8 additionally requires the owner-supplied username pattern (AC-13(e)). The guard uses `grep -q` in a negated pipeline and never prints a match. The repository-wide credential audit (tracked tree, untracked files, branch diff and branch history) uses the credential-only subset of the same pattern, without the address/bare-token alternatives, because architecture documentation legitimately contains local/fixture addresses. It excludes synthetic assignment fixtures inside `*.test.ts`/`*.spec.ts` by path (the acceptance-criteria preamble allows synthetic fixtures defined in test files), while the real Brevo/Render key-shape pattern remains strict on every path, including tests and logs; every non-test source/doc/untracked build log, the branch diff and branch history remain scanned, and the `.env*` check is unconditional; no `.env*` file is added.
  (f) The diff is tightly scoped: no `src/frontend/**`, `src/backend/src/auth/auth-service.ts`, `src/backend/src/auth/email-template.ts`, migration/schema, Dockerfile, compose service/image/port/volume/healthcheck, or `docs/features/README.md` change; the required `compose.yaml`/`compose.smoke.yaml` environment pass-through edits are allowed. Existing feature artifacts are untouched.
  Evidence: the T7 build log with raw commands and output.

- **AC-13 — The owner proves deployed API delivery and consumes T9/AC-11.**
  AC-13 is **owner-attested**: CI cannot independently reproduce the live delivery. The build log must include redacted raw excerpts from Render and Brevo, not only phrases the owner types.
  (a) **Before merge**, the owner sets the two GitHub `development` values: `EMAIL_TRANSPORT=brevo-api` (variable, value recorded as non-secret) and `BREVO_API_KEY` as a secret (name only; a dedicated key is the default/preferred — see Q-1), and records the marker `SMTP_FROM confirmed` with no value. If the values are not set before merge, the first post-merge Deploy fails closed at `Check deployment Brevo configuration`; the owner sets them, re-runs, and the log records the deviation. The feature does **not** claim `registration-account-exists` AC-11(a) unless the values were set before merge. If the existing MCP key is reused, the log records the explicit `owner risk accepted`, the `rotation plan` and the `least privilege` justification.
  (b) The Deploy run succeeds and its log contains exactly `Deploy configuration OK: 11 value(s) present for the 'development' environment.`, `SYNCED EMAIL_TRANSPORT (value verified, not shown)` and `SYNCED BREVO_API_KEY (value verified, not shown)`; `/healthz` returns exactly `{"status":"ok"}`.
  (c) The new Render instance logs `brevo_api_transport_verify_ok` with `host=api.brevo.com` and `port=443`; if the deployed level filters info, the log records the literal fallback `info level filtered; no brevo_api_transport_verify_failed line` plus the successful delivery evidence.
  (d) A resend to the stale unverified account returns `202`, a Brevo transactional record exists for the message, the message is delivered, the owner opens the link, the account becomes `verified = true`, and a subsequent login plus `join { mode: 'account' }` succeeds on the deployed frontend.
  (e) The T8 build log records the evidence under `Phase A`/`Phase B` markers using `<owner-address>`, `<frontend-origin>`, `<verification-link>` and `<commit>` placeholders; it contains no address, username, token/link, API key or third-party PII, and the owner-supplied `GH_REPO` slug must not appear (`! grep -qF "$GH_REPO"`). It includes redacted raw excerpts: the Render `brevo_api_transport_verify_ok` line (or the documented fallback), the deployed resend HTTP status, the Brevo transactional record with its message id redacted, and the account `verified = true`/join evidence. It also contains `SMTP_FROM confirmed`; when the fallback key is used it contains `owner risk accepted`, `rotation plan` and `least privilege`. The shared AC-12(e) guard passes. T8 is run with the owner-supplied `GH_REPO` repository slug and `CUBECLICKER_USERNAME_PATTERN` (neither value is recorded in the artifact), so the stale account's username cannot appear.
  (f) The log states the exact supersession: `registration-account-exists` AC-11(c) (SMTP probe) and AC-11(d) (SMTP delivery) are replaced by AC-13(c)/(d); AC-11(b) sync evidence is retained; AC-11(a) was **not** met on ordering (Phase A was applied post-merge, the first Deploy failed at the guard and was re-run) and is recorded as a deviation, not claimed closed; T9 Phase B is consumed and the SMTP key correction is no longer required.
  Evidence: `docs/features/brevo-api-email-transport/build-log-T8.md` (owner-provided, redacted).

## Non-goals

- No frontend change: the 502 panel, resend action and resend-failure copy are already correct.
- No change to `auth-service.ts`, registration/resume/conflict/login behavior, session semantics, rate limits, verification-token lifetimes or the branded template/subject/plain text.
- No schema or migration change; no new table, column or index.
- No new service, image, port, volume, healthcheck, WebSocket message or `/ws` change; no Dockerfile change.
- No Brevo SDK, npm dependency, build step or `fetch` polyfill.
- No Brevo templates, campaigns, contacts, webhooks, bounce/complaint handling, attachments, tracking or unsubscribe flow.
- No DNS/SPF/DKIM/DMARC or sender/domain verification by an agent; owner-owned in Brevo.
- No production provisioning and no agent write of production values; the production catalog stays documentation-only and no live production environment is modified.
- No removal of Mailpit, the SMTP transport code or the strict SMTP port guard; SMTP remains the local/off-Render transport.
- No automatic SMTP fallback in the managed deployment: the catalog requires `EMAIL_TRANSPORT`, and the deploy guard rejects `smtp` for `development`/`production`; the runtime default stays `smtp` for local/off-Render compatibility, so a paid/self-hosted SMTP deployment remains expressible without a code change.
- No key creation, rotation or reading by an agent; no live Brevo call from CI or tests.
- No edit of `docs/features/README.md` (orchestrator-owned) or of any existing feature artifact, including `registration-account-exists/build-log-T9.md`.
- No change to the deploy trigger model, concurrency, permissions, step order or action pins.
- No weakening of assertions, coverage thresholds, redaction or the repository credential guard.

## Boundaries

- ✅ Always: keep Mailpit the local default; make the transport explicit and fail closed; construct the API service through the same `EmailService` contract; reuse the branded template; never log, return, commit or bake the API key or a provider message/body; keep the 502/resend/token semantics; validate all eleven deployment names before any Render call; sync exactly nine names; keep `render.yaml` value-free and `sync: false`; use concrete expected values in tests; record raw evidence in build logs with redaction; run lint, typecheck, tests, coverage and build per behavior task.
- ⚠️ Ask first: adding a dependency (none expected); creating/rotating the Brevo API key or choosing dedicated vs existing (owner); changing the GitHub Environment values or re-running the deploy (owner); removing SMTP names from the deployed catalog or allowing SMTP in production (owner/spec change); renaming the deploy step or changing its order; touching `render.yaml` beyond the two `sync: false` names; changing the API timeout or endpoint.
- 🚫 Never: commit, print, log, diff or record a `BREVO_API_KEY`, SMTP key, Render key or verification token/link; put a key in `render.yaml`, an image, the frontend bundle, a command argument or a tracked file; parse or log a Brevo response body (it may contain an address); fall back to SMTP in a deployed environment; bypass or weaken the deploy guard; edit `.env*`; send email to a third party or from CI; delete/merge accounts; edit `docs/features/README.md`; weaken assertions or exclude production code from coverage.

## Security considerations

- **API key handling.** `BREVO_API_KEY` is a GitHub Environment secret, synced to the Render service as a service variable, read only from `process.env`, and sent only in the `api-key` request header over HTTPS. It is never a URL/query parameter, never in a body, never in `render.yaml`, never in the image or client, and never printed. The workflow passes it through step-level `env:` from `secrets.*`; no step enables shell tracing.
- **Provider response bodies are untrusted PII.** Brevo error bodies can echo the recipient address or parameter values, so the service never reads or parses a response body. API error messages are fixed strings; `transportCode` is derived only from the HTTP status (`HTTP_<status>`) and matches the existing whitelist pattern. `verify()` does not read the account body.
- **Logging hygiene.** `verification_email_delivery_failed` adds `transport` only; `brevo_api_transport_verify_ok/failed/skipped` use the same field discipline as the SMTP events (`errorType`, optional whitelisted `transportCode`, `host`, `port`, `reason`). No address, username, account id, token, key, provider message or stack is logged. The Fastify error serializer remains unchanged.
- **Deploy guard.** It rejects a deployed `smtp` transport, an unknown transport, the SMTP key reused as the API key, and an unparseable/local sender before any Render call. It never echoes `SMTP_FROM` or a key. The strict SMTP port guard remains in force, so switching transport cannot bypass the Render-free egress rules.
- **Deployment fail-closed.** The catalog makes `EMAIL_TRANSPORT` mandatory and the guard rejects `smtp`/unknown/missing values for `development` and `production` before any Render call, so the managed pipeline cannot deploy the broken SMTP path. The runtime default stays `smtp` to preserve local and prod-image behavior; a pipeline-deployed service receives `brevo-api` through the sync, and an unchecked dashboard-only deploy would fail visibly with the existing 502 rather than silently succeeding.
- **Request integrity.** The endpoint is the fixed `https://api.brevo.com` (no environment override, no SSRF), TLS certificate verification stays enabled, and a 10-second `AbortSignal.timeout` bounds connect/response so registration cannot hang. The JSON body is built in-process, so header injection and argument exposure are not possible.
- **Identity/enumeration.** Registration/resend statuses and bodies are unchanged; the 502 remains account-scoped and outage-scoped, and unknown resend inputs still return the accepted generic response. No new identity or session behavior is introduced.
- **Failed-send integrity.** The existing `sendVerificationEmail` catch invalidates every token for the user on any rejection, including a Brevo API rejection; a later resend issues a fresh token. No undelivered token survives.
- **Key lifecycle.** A dedicated key is preferred. The owner creates it in Brevo (Settings → SMTP & API → API Keys), stores it via the UI or `gh secret set` stdin, and rotates it by creating a replacement, updating the secret, re-running the deploy, confirming `brevo_api_transport_verify_ok`, and revoking the old key. This feature's agents never read or record the key. The existing MCP REST key may be reused only under the explicit owner risk acceptance, coupled-blast-radius disclosure and separate rotation/least-privilege justification in Q-1.
- **Supply chain.** No dependency, SDK, action or Docker base change. Node 24's global `fetch` is the only HTTP client.
- **Evidence redaction.** Build logs and docs use `<owner-address>`, `<frontend-origin>`, `<verification-link>`, `<address>`, `<verified-sender>` and `<CHANGEME-brevo-api-key>` placeholders. The shared build-log guard (AC-12(e)) covers addresses, `verify?token=`, bare 32+ hex tokens, SMTP/Render/Brevo key shapes, and YAML/shell assignments including `BREVO_API_KEY:`; T8 adds the owner-supplied username pattern. It never prints a match.

## Testing strategy

- **Unit (backend, Vitest, node):**
  - `src/backend/src/auth/config.test.ts` — transport default (`smtp` for every `NODE_ENV`) and explicit API selection, exact parse errors, key requirement, sender parser truth table, local-default rejection, SMTP path unchanged.
  - `src/backend/src/auth/email.test.ts` — exact API URL/method/headers/body, sender name present/absent, template reuse, 201/202 success, 400/401/403/429/500 mapping, timeout/network mapping, no response-body parsing, no key/PII in fields, `verify()` GET contract.
  - `src/backend/src/auth/email-cli.test.ts` — API success/failure/config lines, redaction of the API key and key shapes, unchanged SMTP lines.
  - `src/backend/src/app.test.ts` — transport selection, SMTP factory untouched under API, non-blocking never-settling probe, exact `brevo_api_transport_verify_*` events and levels, `/healthz` unchanged.
  - `src/backend/src/auth/auth-routes.test.ts` — exact 502 body, one warn event with `transport`, token invalidation for the API failure, resend recovery, no session, no PII.
  - `src/backend/src/deploy/render-env.test.ts` — exact 7/2/9/11 catalog arrays and order, placeholder/missing lists, `validateEmailTransport` truth table, five exact failure blocks, changed-value echo checks, render.yaml parse.
  - `src/backend/src/deploy/render-env-cli.test.ts` — 11-name check-only, 6-placeholder production block, 9-write dry-run and sync, guard precedence, no-network modes, process-boundary fixtures.
- **Integration (backend through real boundaries):** `app.inject` with the real Fastify app, cookie/CORS plugins and the real `BrevoApiEmailService` plus an injected request seam; the deploy CLI as a real process with the exact workflow command; `podman compose` config evaluation for local/smoke defaults. No live network in tests.
- **Containerized e2e:** `podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit` then `npm run smoke` — proves the backend image builds and the register → Mailpit → verify → login flow still passes with Mailpit pinned and no Brevo contact.
- **Deployed proof (owner-owned, not CI):** AC-13, two phases: Phase A (GitHub values set, key only as a secret name) and Phase B (deploy, 11-name/9-sync evidence, API probe, live resend/delivery/link/login/join). The planner/builder never create/read/rotate a key, write GitHub state or send email.
- **Coverage:** `npm run coverage` — ≥ 80% statements/branches/functions/lines **per workspace**; behavior tasks use the pre-gate form `npm run coverage --workspace @cubeclicker/backend`. No exclusion is added; every new branch (transport default, invalid transport, missing key, sender shapes, status classes, timeout, probe outcomes, guard reasons) is covered. Concrete expected values; no wildcard matchers, snapshot-only or assertion-free tests; no network in tests.
- **Verification commands:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `npm run smoke`, `actionlint` over both workflows, the `render.yaml`/`vercel.json` parses, the compose-config assertions, the deploy CLI fixtures and the repository credential/PII/token guards.

## Configuration contract

| Name | Local (`podman compose up`) | Deployed `development` | `production` | Rule |
| --- | --- | --- | --- | --- |
| `EMAIL_TRANSPORT` | `smtp` (default) | `brevo-api` | `brevo-api` (pinned constant) | `smtp` or `brevo-api`; empty/unset → `smtp` for every `NODE_ENV`; the deployed guard requires `brevo-api` for `development`/`production` |
| `BREVO_API_KEY` | unset | secret (dedicated key preferred; existing MCP key only with explicit owner risk acceptance — Q-1) | `<CHANGEME-brevo-api-key>` | required when the API transport is selected; secret; never logged or committed |
| `SMTP_HOST` … `SMTP_CONNECTION_TIMEOUT_MS` | Mailpit defaults | preserved (catalogued; unused by the API transport) | placeholders | existing SMTP contract; the strict port guard remains in force |
| `SMTP_FROM` | local default | Brevo-verified sender | `<CHANGEME-verified-sender>` | sender for both transports; API requires a parseable, non-local address; the display name becomes the Brevo `sender.name` |
| `APP_BASE_URL` | `http://localhost:5173` | the frontend origin | placeholder/owner | unchanged; drives the verification link and email image URLs |

- `EMAIL_TRANSPORT` is a variable (non-secret); `BREVO_API_KEY` is a secret. Both are added to `SYNC_CATALOG` and written to Render; both are declared `sync: false` with no value in `render.yaml`.
- The catalog now validates **eleven** names (seven SMTP + `EMAIL_TRANSPORT` + `BREVO_API_KEY` + `RENDER_SERVICE_ID` + `RENDER_API_KEY`) and synchronizes **nine** (the seven SMTP names plus the two new names). `RENDER_SERVICE_ID` and `RENDER_API_KEY` remain pipeline-only and are never written to the service.
- The **production catalog** defines all eleven names with **six pinned placeholders** (`SMTP_FROM`, `SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `RENDER_SERVICE_ID`, `RENDER_API_KEY`) and the five pinned constants (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `EMAIL_TRANSPORT`). This is a code/documentation contract only: the live `production` GitHub Environment is **not** modified by this feature, and no task writes production values. Production remains unprovisioned.
- The API timeout is the fixed `BREVO_API_TIMEOUT_MS = 10000`; no new timeout variable is introduced. The SMTP timeout variable remains for the SMTP transport only.
- `NODE_ENV=production` is committed in `render.yaml` but is informational for the transport choice: it does not change the `smtp` default. The deployed `brevo-api` value comes from the catalog/sync, and local compose and smoke keep `NODE_ENV=development`.

## Supersessions

| Superseded | Behavior replaced | Replaced by (this spec) | Retained |
| --- | --- | --- | --- |
| `brevo-smtp-email-delivery` AC-13/AC-14 and the deployed Brevo SMTP recipe | Deployed verification email is delivered by Brevo SMTP on `2525` STARTTLS | Deployed environments use the Brevo HTTPS Transactional Email API on `443` (`brevo-api`) | Mailpit local capture; the SMTP transport code and configuration for local/off-Render use |
| `brevo-smtp-email-delivery` non-goal "No Brevo REST API integration" | No Brevo HTTPS API adapter | `BrevoApiEmailService` with the branded template | SMTP remains for local/off-Render |
| `registration-account-exists` non-goal "No Brevo REST API adapter" | No API adapter | Same adapter, typed through the existing `EmailDeliveryError` | 502 mapping, resend, token invalidation and frontend UI |
| `registration-account-exists` AC-11(c)/(d) and T9 Phase B | SMTP probe/`smtp_transport_verify_ok` and SMTP live delivery proof | `brevo_api_transport_verify_ok` plus the AC-13 live API delivery proof | AC-11(b) sync evidence is retained; AC-11(a)'s literal pre-merge ordering was not met (Phase A was applied post-merge; the first Deploy failed at the guard and was re-run) and is recorded as a deviation, not closed |
| `deploy-brevo-env-placeholders` AC-2(b)/AC-11 catalog and counts | Nine validated, seven synced, five production placeholders | Eleven validated, nine synced, six production placeholders; `EMAIL_TRANSPORT` and `BREVO_API_KEY` added | GitHub as source of truth, `CHANGEME` guard, per-key sync, wiring-name rules, production unprovisioned |
| `deploy-development-manual-trigger` AC-4(b)/(e) credential inventory | Nine names / seven synced, with SMTP-only sync | Eleven names / nine synced; the step name `Sync Brevo SMTP settings to Render` is retained for workflow compatibility and is documented as syncing the nine Brevo settings | Dispatch choices, triggers, concurrency, step order, action pins |
| `registration-account-exists` AC-1 strict SMTP port guard | Not superseded; the guard stays active even when `brevo-api` is selected | — (retained as defense in depth) | The blocked/local/malformed/STARTTLS rules |

Existing feature artifacts are not edited; these rows are the supersession ledger for this feature.

## Consumption of `registration-account-exists` T9 / AC-11

- T9 remains `[ ]` in its own feature. Its Deploy/sync evidence (AC-11(b)) was met on the successful re-run: `SMTP_PORT=2525`, `SMTP_SECURE=false`, the sync lines and `/healthz`. Its literal **AC-11(a) pre-merge ordering was not met**: Phase A was applied post-merge, after the first Deploy attempt failed at the guard, and the values were then set and the deploy re-run. This feature records that deviation and does **not** claim AC-11(a) as met.
- Its Phase B is **blocked** at SMTP authentication (`EAUTH`) and cannot satisfy AC-11(c)/(d). This feature supplies the missing outcome through the API transport: AC-13(c) replaces the SMTP probe evidence with `brevo_api_transport_verify_ok`, and AC-13(d) replaces the SMTP delivery proof with a real API delivery to the same stale unverified account.
- The SMTP key correction that T9's recovery runbook requests is **no longer required** for the deployed outcome. The owner may leave the SMTP values in place (they are catalogued but unused by the API transport) or clean them up later as a separate change.
- The stale account row from the failed registration is recovered by a resend: it is unverified with zero tokens, and the resend issues a fresh token. No account deletion, merge or SQL is part of this feature; the existing owner-only Q-1 cleanup of the two earlier unverified rows remains separate.
- The orchestrator should record in `registration-account-exists/status.md` that T9/AC-11(c)/(d) are satisfied/superseded by this feature's AC-13 once the owner proof lands, that AC-11(b) remains met, and that AC-11(a) was not met on ordering (post-merge application, first deploy guard failure, re-run) and must be recorded as a deviation rather than closed. This spec does not edit that status file.

## Real-time impact

Out of scope. This feature adds no WebSocket message, room, presence, grace, reconnection or server-authority behavior. Verification email is an HTTP request/response side effect; the WS upgrade still resolves the account from the same session cookie, and `join { mode: 'account' }` still requires `verified = true`. No cross-client shared value is added, and no identity vs. "no accounts" question is reopened. A Render deploy still restarts the single instance and closes sockets; the existing reconnect policy is unchanged.

## Containerization impact

No new service, image, port, volume, healthcheck or WebSocket endpoint. The backend image ships the new `BrevoApiEmailService` module as inert code; `GET /healthz` and `GET /ws` on port `8080` are unchanged. Configuration stays environment-based: `compose.yaml` gains `EMAIL_TRANSPORT` (default `smtp`) and `BREVO_API_KEY` (default empty) pass-throughs, `compose.smoke.yaml` pins `EMAIL_TRANSPORT=smtp` and an empty key, and `render.yaml` declares both new names `sync: false` with no value. The deployed service receives the two values through the existing GitHub→Render sync; secrets remain runtime-only, never baked into the image, and the images stay provider-neutral. The only new network path is the backend container → `https://api.brevo.com:443`, an outbound HTTPS call; no inbound port, route or service is added. This follows `docs/architecture/containerization.md` (environment-based config, runtime-only secrets, existing health signal, provider-neutral images); no convention is reopened.

## Open questions

- **Q-1 — (OWNER) Dedicated Brevo API key (default/preferred) or the existing MCP REST key (risk-accepted fallback).** The dedicated key is the acceptance default and is preferred for this service (created under Settings → SMTP & API → API Keys, used only for transactional email, rotated independently). The fallback — reusing the existing interactive Brevo MCP REST key — is allowed only with an explicit owner risk acceptance recorded in T8: the runtime email credential would be coupled to the owner's MCP credential, the blast radius broadens, and a separate rotation/least-privilege justification is required. The feature's agents never read either key; the owner supplies it via the GitHub secret UI or stdin, and the runtime value is never recorded. If the fallback is used, the “never read by an agent” statement applies to this feature's agents, not to the owner's existing MCP client.
- **Q-2 — (OWNER) Production scope.** Production stays unprovisioned; the eleven-name catalog is documentation-only. When it is provisioned, confirm it also uses `brevo-api` and a verified sender, and whether the dedicated key is per environment. This feature writes no production values.
- **Q-3 — (OWNER) Sender/domain authentication.** The account currently has one active sender and no authenticated domains. Confirm the active sender is the intended `SMTP_FROM` for development; a verified domain (SPF/DKIM/DMARC) is recommended before production. Owner-owned; not a build blocker.
- **Q-4 — (OWNER) Retire the SMTP names from the deployed catalog later?** This feature keeps the seven SMTP names catalogued and the port guard active (defense in depth, future off-Render use). If the owner wants the deployed service to stop carrying unused SMTP credentials, that is a separate, smaller cleanup.
- **Q-5 — (OWNER) Live-proof recipient.** The proof uses the stale unverified account from the failed registration. The owner must confirm access to that mailbox and be willing to click the link and log in; the address is recorded only as `<owner-address>`.
- **Q-6 — (OWNER) Brevo plan/limit.** The free plan reports a 300-email/day limit. Verification volume is expected to fit; an upgrade is owner-owned. A `429` maps to the existing 502/resend path.

## Assumptions

- Render free allows outbound HTTPS on port `443` to `api.brevo.com`; the verified diagnosis shows the Brevo MCP REST calls work from the environment, and `POST /v3/smtp/email` is the documented transactional endpoint. If 443 were blocked, this feature would stop and the fallback would be a different provider/route, not an SMTP retry.
- The Brevo account's active sender is accepted for transactional email and the API key can send; sender verification is owner-owned and may fail at send time with a `400`, which maps to the existing 502/resend path.
- The stale unverified account's mailbox is owner-controlled and can receive the message; the owner can complete the link and log in.
- Node.js 24 provides a global `fetch` and `AbortSignal.timeout`; no dependency is added.
- Brevo returns `201` on accepted transactional email; any `2xx` is treated as success.
- `SMTP_FROM` is the single sender configuration for both transports; no new `BREVO_SENDER_*` name is introduced.
- The deploy workflow step name `Sync Brevo SMTP settings to Render` is retained for compatibility with the accepted deploy feature, even though it now syncs nine Brevo settings; documentation explains the historical name.
- The GitHub `development` values (`EMAIL_TRANSPORT=brevo-api`, `BREVO_API_KEY`) are owner-set **before merge** (AC-13(a)); the build and automated tests do not depend on them. If they are missed, the first post-merge Deploy fails closed at the guard, the owner sets them and re-runs, and the deviation is recorded rather than claimed as AC-11(a).
- `docs/architecture/email.md` was named as an input but does not exist in the repository; this feature creates it as the canonical email-transport reference, linked from `README.md`, `deployment.md` and `vercel-render-neon.md`.
- `production` remains unprovisioned; its eleven names are a documented code catalog, not a live-environment claim, and no agent writes them.
- The shared build-log guard (AC-12(e)) is the evidence standard; it covers addresses, `verify?token=`, bare 32+ hex tokens, username (T8 only, owner-supplied pattern), and SMTP/Render/Brevo key shapes including YAML `BREVO_API_KEY:` assignments. The guard never prints a match.
- T8 is owner-attested and not CI-reproducible; the owner supplies `GH_REPO` and `CUBECLICKER_USERNAME_PATTERN` at run time, and the artifact records neither value.

## Review findings disposition (r1)

| ID | Severity | Disposition | What changed in r2 |
| --- | --- | --- | --- |
| F1 | MAJOR | Fixed | AC-11 now requires the exact positive sentence in README, `docs/architecture/email.md`, `deployment.md` and `vercel-render-neon.md`, and adds the exact stale negatives for the README/deployment/vercel “deployed uses SMTP” sentences the review named; T6 carries the same checks. |
| F2 | MAJOR | Fixed | AC-11(b)/(d)/(f) pin the README API success line, the `Settings → SMTP & API → API Keys` rotation strings, the exact `BREVO_API_KEY` recovery step, the README/vercel catalog rows with `variable`/`var`/`secret` classification, and the no-service/image/port/WebSocket sentence; T6 greps them. |
| F3 | MAJOR | Fixed | The earlier claim that AC-11(a) and AC-11(b) remained met, and the pre-merge-value wording, were removed. AC-13(a) now requires the two `development` values before merge or records the fail-closed first-deploy deviation; AC-13(f), the supersession row and § Consumption record that AC-11(a) was applied post-merge, the first Deploy failed at the guard and was re-run, and AC-11(a) is not claimed as met. |
| F4 | MAJOR | Fixed | AC-12(e) defines one shared build-log guard (address, `verify?token=`, bare 32+ hex, key shapes, YAML/shell assignments); every task verify applies it, T7 loops over every build log, and T8 adds the owner-supplied username pattern. |
| F5 | MINOR | Fixed | AC-12(a) and T7 add the coverage-config diff assertion over both `vitest.config.ts` files, so a threshold or exclusion change cannot pass. |
| F6 | MINOR | Fixed | AC-8(f)/(g) and T4 add the parsed `deploy.yml` comparison against `origin/main` (triggers, concurrency, permissions, job fields, step order, `uses`, `run`, `with`; only the four CLI env keys added) and exact CI fixture counts. |
| F7 | MINOR | Fixed | AC-8(b) and T4 assert the production placeholder output contains neither a port block nor an email-transport block. |
| F8 | MINOR | Fixed | AC-7(c) and T4 add the production API-valid `{ ok: true }` case. |
| F9 | MINOR | Fixed | AC-1(g) and AC-2(b) now explicitly treat angle-only `<address>` as an accepted bare-address form and pin the test. |
| F10 | MINOR | Fixed | AC-1(g) pins empty/unset `SMTP_FROM` to the existing non-empty error before the parse error and whitespace-only to the AC-1(g) parse error; T1 requires both tests. |
| F11 | MINOR | Fixed | Q-1 now prefers a dedicated key for acceptance; reuse of the existing MCP key is an explicit owner risk acceptance with coupled-blast-radius disclosure and separate rotation/least-privilege justification. The “never read by an agent” wording now applies to this feature's agents and acknowledges the owner's MCP client in the fallback. |
| F12 | MINOR | Fixed | The production column is qualified as a code/documentation catalog with six pinned placeholders; the live `production` environment is not modified by this feature and no task writes production values. AC-11(c)/(d) and the assumptions use the qualification. |
| F13 | MINOR | Fixed | AC-13 is explicitly owner-attested and not CI-reproducible; T8 requires `GH_REPO` and `CUBECLICKER_USERNAME_PATTERN` at run time, records neither, and requires redacted raw Render/Brevo excerpts (`Render excerpt`, `Brevo excerpt`, `resend response`). |
| F14 | MINOR | Fixed | AC-12(f) now forbids a compose service/image/port/volume/healthcheck change and explicitly allows the required `compose.yaml`/`compose.smoke.yaml` env pass-throughs; T7 states the same. |
| F15 | MINOR | Fixed | The shared guard and T7 use `BREVO_API_KEY[[:space:]]*[:=][[:space:]]*…`, catching YAML `BREVO_API_KEY:` assignments as well as shell `=` assignments. |
| F16 | INFO | Fixed | AC-3(a) asserts the exported `BREVO_API_TIMEOUT_MS` value in `email.test.ts`; T2 keeps only a presence grep for the symbol, so `10_000` vs `10000` source spelling is not acceptance evidence. |
| F17 | INFO | Fixed | The user story and security section now say the managed pipeline fails closed; a dashboard-only deploy boots `smtp` and fails visibly at send (`502`), not silently. |
| F18 | INFO | Fixed | AC-11(e) requires the observability prose to say `email transport` and removes the stale `when the SMTP transport rejects`/`SMTP broken` wording; AC-11(f) requires the containerization pass-through/no-service prose. T6 greps both. |

All F1–F18 are fixed in r2; none are deferred.

## Review findings disposition (r2)

| ID | Severity | Disposition | What changed in r3 |
| --- | --- | --- | --- |
| F1 | MAJOR | Fixed | AC-11(b)/(c)/(d) and T6 now list every residual stale string the review named (README nine-name/seven-sync/SMTP-key claims; deployment seven-sync/nine-name claims; vercel nine-name/seven-sync/2525/troubleshooting claims) and require the exact 11-name/9-sync + production-code-catalog statements. |
| F2 | MAJOR | Fixed | AC-11(b)/T6 pin the 22-line `gh` command heading, `gh variable set EMAIL_TRANSPORT`, `gh secret set BREVO_API_KEY`, both names in the README secrets/variables lists, the production code-catalog statement, and removal of the old preserve/merge/recovery instructions. |
| F3 | MAJOR | Fixed | AC-11(b)/T6 add the README supersession statement, the `AC-11(a)` ordering-deviation statement, the before-merge requirement, and negative greps for the old preserve note, old merge ordering, T9-specific `SMTP_PORT` recovery and SMTP-key recovery text. |
| F19 | MAJOR | Fixed | AC-10(c) is mapped to T1 (and re-verified in T7); T1/T7 compare the composed top-level services, images/builds, ports, volumes, depends_on, healthchecks and top-level volumes against `origin/main`, allowing only environment values to differ. |
| F20 | MINOR | Fixed | AC-7(e)/T4 add a parsed comparison of all other `render.yaml` service fields and `envVars` against `origin/main`. |
| F21 | MINOR | Fixed | AC-7(c), the plan guard bullet and T4 now include the angle-only local-sender case. |
| F22 | MINOR | Fixed | AC-12(e)/T6/T7 require `<commit>` placeholders (or a reviewed exception) for commit ids so the bare 32+ hex guard does not false-positive; the token guard is unchanged. |
| F23 | MINOR | Fixed | AC-13(a)/(e)/T8 add `SMTP_FROM confirmed`, conditional `rotation plan`/`least privilege`, and `! grep -qF "$GH_REPO"` markers. |

The non-blocking INFO items were also fixed: the API CLI placeholder is consistently `<address>`, and the security text says “a pipeline-deployed service receives `brevo-api` through the sync.”

## Revision history

- r1 — 2026-11-26 — initial draft from the verified diagnosis (planning phase); no review findings yet.
- r2 — 2026-11-26 — spec review r1 F1–F18 addressed: stale documentation claims and exact README/catalog/no-service clauses pinned (F1/F2); AC-11(a) ordering corrected with the fail-closed deviation recorded (F3); shared build-log guard, coverage and workflow comparison, guard/block/count, angle-only/empty-sender and key/production/owner-proof findings fixed (F4–F18). Revision kept implementable in 8 sequential tasks; the `smtp` runtime default and deployed `brevo-api` transport contract are unchanged.
- r3 — 2026-11-26 — spec review r2 F1–F3 and F19–F23 addressed: exhaustive residual stale-doc negatives plus the 11-name/9-sync and production-code-catalog statements; README 22-command runbook/secrets-variables placement/supersession/AC-11(a) deviation; compose top-level diff mapped to AC-10(c); render.yaml other-entry diff; angle-only local sender; `<commit>` evidence rule; T8 fallback/`SMTP_FROM`/`GH_REPO` markers. INFO placeholder and pipeline-deployed wording fixed; task graph updated so T4 absorbs the former T5 (T6–T8 keep their numbers) and the 11/9/6 counts are unchanged. Building-preflight clarification: AC-12(e) excludes synthetic `*.test.ts`/`*.spec.ts` fixtures by path from the repository credential audit; all non-test paths, branch diff/history and the unconditional `.env*` check remain in force.
