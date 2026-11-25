---
feature: registration-account-exists
revision: 4
status: draft
created: 2026-11-24
updated: 2026-11-24
---
# Spec — Registration Account Exists: Working Verification Delivery, Honest Conflicts & Resumable Registration

## Summary

A registrant on the deployed development frontend is told **"account already exists"** and never receives a verification email, with no way forward. The verified diagnosis shows three compounding causes: Render's free web service blocks outbound SMTP on ports 25, 465 and 587 (blocked since 2025-09-26) while the deployment is pinned to `SMTP_PORT=587`, so every verification send fails; registration commits the user and token *before* sending, maps the unknown email failure to a generic `500 internal_error`, and a retry is not idempotent — it returns `409`; and the desired username and email are already held by **two different unverified accounts**, with no merge, change-identifier or delete path. This feature (a) moves the Render-free development target to `SMTP_PORT=2525` with `SMTP_SECURE=false` and adds a strict, fail-closed deploy guard (blocked ports, malformed/out-of-range ports, the local Mailpit port, and a non-STARTTLS `SMTP_SECURE` on 2525); (b) turns email delivery failure into an explicit `502 verification_email_failed` with structured, redacted logging and a non-blocking startup transport probe; (c) makes retry idempotent — the same username + email + password on one unverified account resumes registration with a fresh token (`202`), while genuine conflicts return field-specific `409` data; (d) invalidates the just-issued token on every failed send (register, resume **and** resend); (e) accepts a username **or** an email as the login identifier so the email-holding account is recoverable; and (f) renders field-specific conflicts and working resend actions in the frontend, including resend failures. The exact desired username + email pair still requires an owner-approved destructive cleanup of both unverified rows, which stays an open question, not an autonomous task.

## Diagnosis (verified; authoritative evidence)

Investigation is complete and is not repeated here. Reproduce only through the artifacts named below. The review independently reproduced the Neon facts (`reviews/spec-r1.md` § Evidence reproduced); raw Render/Brevo excerpts are not committed because they can contain addresses, and the redacted facts are summarized here.

### Environment facts

- Neon **development** branch `br-ancient-smoke-za1pdv7w` has exactly **two users**, both `verified = false`, **no sessions**, **no economy rows**, and **2 `verification_tokens` rows** (one issued per failed attempt; both undelivered and both expire within 24 hours of issuance):
  - **U1** — `a7cd44a3-8071-433a-b0a7-e9d74eb5f57d`, username `raultorraco`, created `2026-11-24T06:45:33.399Z`.
  - **U2** — `baa13819-40d7-46be-baa1-87a6550bdd77`, username `raultorraco123`, created `2026-11-24T13:52:52.021Z`.
  - The two owner-controlled Gmail addresses are deliberately not repeated in this artifact; U1 and U2 hold one each. Both are stored lowercase. The **desired pair** is U1's username with U2's email, so it matches two different rows and registration returns `409`.
- There is **no soft-delete column**; username/email uniqueness is enforced by case-insensitive functional unique indexes; `sessions`, `verification_tokens` and `user_economy` reference `users(id) ON DELETE CASCADE`.
- The two undelivered tokens are inert to a third party (the links were never delivered), but they remain consumable until expiry. This feature retires them on the next resend for their account: `resendVerification` already runs `invalidateForUser` before issuing, and AC-3(c) now also invalidates a token whose send fails. Q-1 records them for the owner.
- By contrast, the Neon **production** branch has **no `users` table** — there is no cross-environment data mix-up. The deployed backend is current (`faf8909`), one free Frankfurt Render instance; CORS preflight returns `204`; Vercel is static-only and has no runtime logs.
- Render application logs: both registration attempts created the user **and** a verification token, then returned HTTP `500` at `06:45:33Z` and `13:52:52Z`. Immediate retries returned `409`.

### Ranked root causes

1. **(Primary) Render free blocks outbound SMTP on 25, 465 and 587.** The block has applied to free web services since **2025-09-26** (Render changelog). The repository/deploy contract pins `SMTP_HOST=smtp-relay.brevo.com` with `SMTP_PORT=587` STARTTLS, so every `sendMail` fails **inside Render**. The failures took 207–647 ms — immediate transport rejections, not 10 s timeouts. No credential or template explanation is needed for the failure; the packet never leaves the instance.
2. **(Amplifier) Non-idempotent commit-before-send.** `AuthService.register` persists the user, issues the verification token, then sends; the email error is not a typed delivery failure, so `auth-routes` maps it to `500 internal_error`. Nothing in the UI or API resumes the same registration; the retry path re-enters duplicate detection and returns `409 account already exists` with no field detail and no resend path.
3. **(Identity split) The desired identifiers live on different rows.** U1 owns the username; U2 owns the email. There is no merge, email/username change, or delete path, so the exact pair can never register while both rows exist.
4. **(Possible, unproven, relevant only after 1 is fixed) Brevo credential/sender mismatch.** Brevo has no authenticated domains, one active sender (a personal Gmail address) and **zero transactional email records** for either address over 30 days. Zero records is fully explained by root cause 1 (the send never reached Brevo). A REST key in `SMTP_PASS` and/or an unauthenticated sender domain would still break delivery *after* the port is fixed; the live proof in AC-11 and the recovery step in § Immediate workaround detect that.

### Verified non-causes

- Vercel environment: `VITE_API_URL=https://cubeclicker-development.onrender.com`, `VITE_WS_URL=wss://…/ws`, `VITE_CLOUD_DEPLOY=true`; frontend API wiring; CORS/Origin; DB schema, case normalization and soft-delete; environment isolation. None explains the failure.

### Regression references (accepted specs)

- `docs/features/brevo-smtp-email-delivery/spec.md` **Q-4 anticipated a 587 block** and named 2525/465 fallbacks — but 465 is also blocked on Render free, and the live-delivery proof was user-owned and never run. Its AC-10 intentionally pins the generic `500`; its § Fail-fast behavior deliberately pins **no startup SMTP probe**.
- `docs/features/deploy-brevo-env-placeholders/spec.md` guard only checks non-empty / `CHANGEME`, so `SMTP_PORT=587` passes validation; it also documents the merge-ordering hazard this spec now closes (F7).
- `docs/features/user-authentication/spec.md` AC-2 intentionally returns a generic duplicate message; AC-7 logs in by username only; its Security section pins generic resend statuses, which this spec supersedes for the delivery-failure case (F9).

## User stories

- As the registrant, I want the verification email to arrive on the deployed development site, so I can activate my account instead of being stuck at 409.
- As the registrant, I want a failed send to say so and offer resend, so I do not have to guess or re-register.
- As the registrant retrying the same data, I want the retry to resume my unverified registration, so an earlier failed attempt does not poison the account.
- As the registrant whose username and email are split across accounts, I want an honest field-level explanation and an email-login path, so I can reach and verify the account that holds my address.
- As the operator, I want the deploy to fail closed on a blocked, malformed or non-STARTTLS configuration, so this outage cannot silently return.
- As the operator, I want a redacted startup signal and a typed delivery log, so I can tell "SMTP broken" from "code broken" without reading credentials.
- As the frontend developer, I want a typed conflict/error contract, so the UI renders the right field and action instead of a generic banner.

## Requirements

- **R-1** The Render-free **development** target uses `SMTP_PORT=2525`, `SMTP_SECURE=false` (STARTTLS), and the deploy CLI **fails closed** on `SMTP_PORT` 25/465/587, the local port 1025, any malformed or out-of-range port, and any `SMTP_SECURE` other than false/0 with 2525.
- **R-2** Email delivery failures are a distinct error (`EmailDeliveryError`) surfaced as **HTTP 502** `verification_email_failed` on register and resend, with a fixed public message and structured, redacted logging.
- **R-3** A failed send — register, resume or resend — leaves the account persisted and unverified, creates no session, and invalidates the just-issued token, so no undelivered token remains usable.
- **R-4** Retrying the same `username + email + password` against the same **unverified** row resumes: `202` with `resumed: true`, one fresh token, one email, no new row. Wrong password or an already-verified row does not resume.
- **R-5** Genuine conflicts return `409 duplicate_account` with machine-readable `field` / `fields` in `['username']`, `['email']` or `['username','email']` order, while the human message stays the accepted generic `account already exists`; a DB-race duplicate re-queries to identify the field.
- **R-6** `POST /auth/login` treats its `username` field (and `identifier`) as a username **or** email identifier; resolution is case-insensitive and returns the same generic `401` for unknown/wrong credentials.
- **R-7** The frontend parses `fields`, renders field-specific conflict messages with pinned `aria-invalid`/`aria-describedby` semantics, renders the `502` state with a working resend action, and `VerificationPending` catches and displays resend failures.
- **R-8** A non-blocking startup `verify()` probe reports transport reachability without delaying `listen` or `/healthz`, and never prints credentials.
- **R-9** Local Mailpit, the containerized smoke, existing auth semantics and the accepted Brevo/Deploy contracts are preserved except for the explicit supersessions in § Supersessions.
- **R-10** The immediate recovery path (set 2525, redeploy, resend, verify, and fix a Brevo key/sender mismatch) is documented and executable by the owner today; the exact desired-pair cleanup stays owner-owned.
- **R-11** The GitHub `development` `SMTP_PORT=2525` / `SMTP_SECURE=false` values are set **before merge**, so the first post-merge deploy is not blocked by the new guard; the blocked-deploy fallback is documented.

## Acceptance criteria

Clause suffixes (`AC-1(b)`) identify the part one task proves. All identifiers, messages, status codes and field names below are exact. "No PII" means no email address, username, token or account id in a response body or log line.

### Delivery path and deploy guard

- **AC-1 — The deploy guard is strict and fail-closed for the development target.**
  (a) `src/backend/src/deploy/render-env.ts` exports `validateSmtpTransportPort(env)` returning exactly one of:
  ```ts
  type SmtpPortFailure =
    | { ok: false; reason: 'render_free_blocked'; port: number }
    | { ok: false; reason: 'invalid_port'; raw: string }
    | { ok: false; reason: 'local_port'; port: number }
    | { ok: false; reason: 'starttls_required'; value: string };
  ```
  With `TARGET_ENVIRONMENT: 'development'`: `SMTP_PORT` `25`/`465`/`587` → `render_free_blocked`; `0`, `65536`, `-1`, `587abc`, `25.5`, `' 2525'` → `invalid_port` (the `raw` is the unmodified input); `1025` → `local_port`; `2525` with `SMTP_SECURE` unset/empty/`false`/`0` → `{ ok: true }`; `2525` with `SMTP_SECURE` `true`/`1`/`yes` → `starttls_required` (the `value` is the raw value); a missing, empty or `CHANGEME` `SMTP_PORT` → `{ ok: true }` (the catalog validation owns presence/placeholders); any other integer 1–65535 (e.g. `2465`) → `{ ok: true }` (documented scope: the guard is a Render-free port/STARTTLS guard, not a full `SMTP_HOST` reachability validator). With `TARGET_ENVIRONMENT: 'production'`, every input returns `{ ok: true }` (production is unprovisioned; decision D-2).
  (b) `formatSmtpPortFailure(environment, failure)` returns exactly:
  ```
  Deploy blocked: SMTP_PORT=587 is blocked for outbound SMTP on the Render free plan ('development' environment).
    Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS); ports 25, 465 and 587 stay blocked on Render free.
    Runbook: README.md § Deployment Brevo runbook
  ```
  for `587` (and the equivalent first line for `25`/`465`); exactly
  ```
  Deploy blocked: SMTP_PORT="587abc" must be an integer between 1 and 65535 ('development' environment).
    Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS) on Render free.
    Runbook: README.md § Deployment Brevo runbook
  ```
  for `invalid_port`; exactly
  ```
  Deploy blocked: SMTP_PORT=1025 is the local Mailpit port and is not reachable from a deployed Render service ('development' environment).
    Use SMTP_PORT=2525 with SMTP_SECURE=false (STARTTLS).
    Runbook: README.md § Deployment Brevo runbook
  ```
  for `local_port`; and exactly
  ```
  Deploy blocked: SMTP_SECURE must be "false" when SMTP_PORT=2525 ('development' environment); received "true".
    Port 2525 uses STARTTLS; set SMTP_SECURE=false.
    Runbook: README.md § Deployment Brevo runbook
  ```
  for `starttls_required` with raw `true`.
  (c) `runRenderEnvCli(argv, env, io)` — the existing three-argument signature `(argv: string[], env: Record<string, string | undefined>, io: { fetchImpl: FetchLike; log: (line: string) => void })` — with `['--check-only']` and a development fixture at 587 returns `1`, and the captured `io.log` output joined with newlines equals the AC-1(b) blocked block with no `Deploy configuration OK` line; the same fixture at 2525 returns `0` and prints exactly `Deploy configuration OK: 9 value(s) present for the 'development' environment.` `--dry-run` with 587 or a malformed port returns `1` with **zero** `DRY RUN:` lines; default mode with 587 returns `1` with `io.fetchImpl` call count `0`; `SMTP_PORT=2525, SMTP_SECURE=true` and `SMTP_PORT=587abc` each return `1` with their exact block. Catalog failures take precedence: the production placeholder fixture (which carries 587) prints the accepted `Deploy blocked: the 'production' environment has 5 unset or placeholder value(s).` block, never the port block.
  (d) `.github/workflows/ci.yml` has exactly **one** development accept fixture at `SMTP_PORT: '2525'` and exactly **one** production placeholder fixture still at `SMTP_PORT: '587'` (the catalog rejects it before the port guard); `actionlint` passes; no fixture value is a credential.
  (e) `src/backend/src/deploy/render-env-cli.test.ts`'s shared `SMTP_VALUES`, `COMPLETE_ENV` and `EXPECTED_BODIES` use `2525` for the development fixture; the production placeholder fixture remains 587.
  Evidence: `render-env.test.ts`, `render-env-cli.test.ts`, the T1 build log and process fixtures, the T1 actionlint run.

- **AC-2 — Email transport failures are typed and diagnosable without leaking.**
  (a) `SmtpEmailService.sendVerification` and `.verify()` reject with `EmailDeliveryError` when the transport rejects (`error.name === 'EmailDeliveryError'`, `error.code === 'verification_email_failed'`, `error.transport === 'smtp'`, `error.host`/`error.port` equal the configured values, `error.errorType` equals the source error name or `'unknown'`, `error.transportCode` is the source `code` only when it matches `/^[A-Z0-9_]{1,40}$/`). `error.message` is the **source message verbatim** (not a wrapper), so the accepted CLI lines in `email-cli.test.ts` stay byte-identical and `redactSecrets` still governs them; the HTTP route never returns this message and no log records it.
  (b) With a transport rejection whose message contains a configured SMTP user, a configured SMTP key and a token-shaped string, none of the three appears in `EmailDeliveryError`'s enumerable string **fields** other than `message` (the test asserts `host`, `port`, `errorType`, `transportCode`, `code`, `transport`, `name` individually).
  (c) `EmailTransport` gains optional `verify?(): Promise<unknown>`; `SmtpEmailService.verify()` calls it exactly once and resolves/rejects accordingly; when the transport has no `verify`, `SmtpEmailService.verify()` resolves without calling anything. `FakeEmailService.verify()` records `verifyCalls` and rejects with an injected `failNextVerify`.
  (d) `email-cli.test.ts` passes unchanged, proving the operator CLI's exact failure/success lines survive the wrapper.
  Evidence: `email.test.ts`, `email-cli.test.ts`.

### Registration and resend contract

- **AC-3 — Delivery failure returns 502 and no undelivered token survives.**
  (a) When the email service rejects with `EmailDeliveryError`, `POST /auth/register` returns `502` with exactly `{ "message": "verification email could not be sent", "code": "verification_email_failed", "error": "verification_email_failed" }`, sets no session cookie, and creates no session.
  (b) `POST /auth/resend-verification` under the same failure returns the same `502` body.
  (c) For **every** failed send — create, resume and resend — the token issued for that attempt is invalidated: a test captures the raw token by spying on `verificationTokens.issue` (for resend, the resend-issued token; for create, the create-issued token), triggers the rejection, then calls `consume(capturedToken)` and receives `null`. `invalidateForUser(user.id)` is called for that user. No email is delivered. The two pre-existing undelivered tokens are retired by the next resend for their account (the existing `invalidateForUser` before issue) or by 24-hour expiry.
  (d) The route emits exactly one `warn` event `verification_email_delivery_failed` with fields `{ route: 'register' | 'resend-verification', errorType, transportCode?, host, port }`; the line contains no email, username, token, transport message, stack, SMTP user or SMTP key. `errorType` is the source error name; `transportCode` is omitted when absent.
  (e) A non-`EmailDeliveryError` thrown by the service still returns the existing `500 { message: 'internal error', code: 'internal_error', error: 'internal_error' }`.
  (f) Once the transport recovers, `POST /auth/resend-verification` returns `202 { message: 'verification email sent' }` and sends a new email.
  Evidence: `auth-routes.test.ts`, `auth-service.test.ts`.

- **AC-4 — Retrying the same registration resumes one unverified account.**
  (a) With one unverified row whose username and email both match the request and whose stored password verifies, `POST /auth/register` returns `202` with exactly `{ "message": "verification email sent", "resumed": true }`; it creates **no** new user row. The route serializes `resumed` from `RegisterResult` and omits it for a new registration (AC-4(f)).
  (b) The resume invalidates every prior token for that user and issues exactly one new one; the prior token no longer consumes, the new token consumes to that user id, and exactly one email is sent to the row's address with the new verification URL. If that send fails, AC-3(c) invalidates the new token.
  (c) If the password does **not** verify, the same request returns `409` with `field: 'both'`, `fields: ['username', 'email']`, sends no email and issues no token.
  (d) If the matched row is already `verified = true`, the request returns the same `409` (no resume, no email, no token).
  (e) Resume is rate-limited to **3 per hour per account** (`account:<id>:register-resume`): the fourth resume attempt within the window returns `429 { message: 'rate limit exceeded', code: 'rate_limited', error: 'rate_limited' }` and sends no email. The route preserves that `429` mapping and the existing 5/minute per-IP register limiter.
  (f) A registration whose username and email match **no** row is unchanged: `202 { message: 'verification email sent' }` (no `resumed` property) and one new row.
  (g) The route-level clauses (a), (e) and (f) are owned by T4: `auth-routes.test.ts` asserts the exact `resumed: true` body, the absent `resumed` on a new registration, and the `429` body/`Retry-After` behavior.
  Evidence: `auth-service.test.ts`, `auth-routes.test.ts`.

- **AC-5 — Genuine conflicts are field-specific and non-mutating.**
  (a) Username held by another row: `409` with exactly `{ "message": "account already exists", "code": "duplicate_account", "error": "duplicate_account", "field": "username", "fields": ["username"] }`.
  (b) Email held by another row: the same body with `field: "email"` and `fields: ["email"]`.
  (c) Username and email held by **different** rows (the diagnosed U1/U2 case): `field: "both"` and `fields: ["username", "email"]` in that order.
  (d) A username/email pair on one **verified** row: `field: "both"`, `fields: ["username", "email"]`.
  (e) Every conflict creates no user row, issues no token, sends no email, and returns the accepted generic message `account already exists`; the machine-readable `field`/`fields` are the only differentiator.
  (f) A DB-race duplicate (`users.create` throws `DuplicateUserError('unknown')`) triggers one re-query of both identifiers and returns the field(s) the re-query finds; if both lookups return null (unexpected), it returns `field: 'both'`, `fields: ['username', 'email']` rather than omitting the fields. A test covers the race where the username row appears between the pre-check and the insert, asserting the exact `field: 'username'` body.
  Evidence: `auth-service.test.ts`, `auth-routes.test.ts` (including a fixture mirroring U1/U2).

- **AC-6 — Login accepts a username or an email identifier.**
  (a) `POST /auth/login` with `{ "username": "<the row's email>" }` and the correct password returns `200`, sets the session cookie and returns `{ user: { id, username, email, verified } }`; the same works with the username and with mixed case.
  (b) `{ "identifier": "<email>" }` works identically (the route already maps `identifier` into the identifier slot); when both `username` and `identifier` are present, `username` wins.
  (c) An unknown identifier, an unknown email and a wrong password all return `401` with exactly `{ "message": "invalid credentials", "code": "invalid_credentials", "error": "invalid_credentials" }`; no response distinguishes "no such account" from "wrong password".
  (d) Account lockout (5 failures → 15 minutes) and the 10/minute per-IP login limiter apply identically to an email identifier; a locked email login returns `429` with `Retry-After`.
  (e) Email resolutions never fall back to a username lookup and vice versa: an identifier containing `@` resolves only by `lower(email)`, otherwise only by `lower(username)`.
  Evidence: `auth-service.test.ts`, `auth-routes.test.ts`.

### Frontend

- **AC-7 — The UI renders the right field, the right action and resend failures.**
  (a) `AuthError` exposes `fields?: ('username' | 'email')[]`, parsed from a `409` JSON body; it is `undefined` when the body has no `fields`.
  (b) The login form keeps the accessible label `Username` and the input `name="username"` (so existing `getByLabelText('Username')` queries in `AuthForms`/`AuthMenu`/`App` tests pass unchanged) and adds the visible hint exactly `Username or email` (placeholder and subtitle `Sign in with your username or email.`).
  (c) A register `409` renders **exactly one** `role="alert"` and pins the DOM association:
  - `fields: ['username']` → the username input has `aria-invalid="true"` and `aria-describedby="auth-error-username"`; the alert has `id="auth-error-username"` and text exactly `That username is already taken.`
  - `fields: ['email']` → the email input has `aria-invalid="true"` and `aria-describedby="auth-error-email"`; the alert has `id="auth-error-email"` and text exactly `That email is already registered.`
  - `fields: ['username','email']` → both inputs have `aria-invalid="true"` and `aria-describedby="auth-error-account"`; the single alert has `id="auth-error-account"` and text exactly `That username and email are already registered.`
  No generic banner is also rendered in these states.
  (d) A register `502 verification_email_failed` renders exactly `Account created, but the verification email could not be sent.` plus a `Resend verification email` button; clicking it calls resend with the submitted email; success renders `Verification email sent.`; a rejection renders `Could not resend the verification email. Try again.` and leaves the button enabled.
  (e) `VerificationPending` catches a rejected `onResend`, renders exactly `Could not resend the verification email. Try again.` in a `role="alert"` element, does **not** render `Verification email sent.`, and re-enables the resend button; a later successful resend renders `Verification email sent.`
  (f) No `App.tsx`/`AuthMenu.tsx` change is required: the existing `onVerificationRequired` path continues to show the pending screen after a successful registration or unverified login, and existing `App.test.tsx`/`AuthMenu.test.tsx` pass unchanged.
  Evidence: `api.test.ts`, `AuthForms.test.tsx`, `VerificationPending.test.tsx`.

### Startup probe

- **AC-8 — The transport probe is non-blocking and observable.**
  (a) `buildApp` registers the probe on `onReady`; it runs only when `authConfig.smtpUser` and `authConfig.smtpPass` are both non-null (the deployed relay path; unauthenticated Mailpit skips it), calls `email.verify()` at most once per app instance and **does not await it**. With a `verify()` that returns a promise which never settles, `GET /healthz` still returns `200 {"status":"ok"}` and `app.inject` completes.
  (b) A resolved probe logs exactly one `info` event `smtp_transport_verify_ok` with `{ host, port }`.
  (c) A rejected probe logs exactly one `warn` event `smtp_transport_verify_failed` with `{ errorType, transportCode?, host, port }`; the line carries no message, stack, SMTP user/credential or email, and the rejection is caught (no unhandled rejection).
  (d) An email service without `verify` logs one `debug` event `smtp_transport_verify_skipped` with `{ reason: 'unsupported' }`; no credential pair logs the same event with `{ reason: 'no_credentials' }`. Neither fails readiness or changes `/healthz`.
  (e) The probe's failure never changes `/healthz`, never closes the app and never delays `listen` beyond the existing startup path.
  Evidence: `app.test.ts` (logger-stream capture; pending-promise health test).

### Documentation and recovery

- **AC-9 — Documentation matches the shipped behavior, per file.**
  (a) `README.md` § Brevo SMTP recipe contains the literal `Render free blocks outbound SMTP on ports 25, 465 and 587.`, states the deployed development recipe `SMTP_PORT=2525` with `SMTP_SECURE=false` (STARTTLS), keeps 587 valid only off Render free, and its canonical export example contains `export SMTP_PORT=2525`.
  (b) `README.md`'s `SMTP_PORT` table row contains `2525 (STARTTLS, Render free)`, its deployment catalog's `development` cell contains `2525 (set before merge)`, its CLI success example contains `smtp-relay.brevo.com:2525`, and its deployment runbook contains the development command `SMTP_PORT --env development --repo raultorres2603/CubeClicker --body '2525'` and **no** development `--body '587'` command. Production remains placeholder-only with the exact note `A Render-free production service also needs 2525.`
  (c) `README.md` contains `### Registration recovery (development)` with: the pre-merge setting (`Before merging this feature`, `SMTP_PORT=2525`, `SMTP_SECURE=false`), the Deploy re-run, `/healthz`, the resend path via the pending screen **or** the unauthenticated `POST /auth/resend-verification` with `<the U2 address>` and `<frontend origin>` placeholders, the `email:test` Brevo key/sender check, and a `Q-1` reference. The pre-ship login wording says username login works today and email login arrives with this feature (no claim that email login works pre-ship).
  (d) `README.md` no longer says a transport failure surfaces as HTTP `500`; it says `502` with code `verification_email_failed`, and that the account `stays persisted and unverified` with a resend recovery.
  (e) `docs/architecture/deployment.md` contains `25, 465 and 587`, `SMTP_PORT=2525`, `SMTP_SECURE=false`, `verification_email_failed`, `malformed`, `1025`, and the guard's `SMTP_SECURE` rule; it no longer matches the stale pairing regex `587.{0,20}STARTTLS, pinned`.
  (f) `docs/architecture/vercel-render-neon.md` contains the same blocked-port rule, `SMTP_PORT=2525`, `verification_email_failed`, `malformed`, `1025` and the STARTTLS guard rule; it no longer matches `587.{0,20}STARTTLS, pinned`, `Registration returns HTTP`, or `surfaces as HTTP`.
  (g) `docs/architecture/observability.md` catalogs `verification_email_delivery_failed` (warn), `smtp_transport_verify_ok` (info), `smtp_transport_verify_failed` (warn) and `smtp_transport_verify_skipped` (debug, `no_credentials`/`unsupported`) with their exact fields, and contains `No email, username, account id, token, message or stack`.
  (h) `docs/features/README.md` is **not** edited by this feature; `build-log-T7.md` contains a `Feature-index row proposal` line with the slug `registration-account-exists`, a title, the state and the date for the orchestrator.
  Evidence: T7's per-file verify loop and T8's verbatim re-run.

### Regression, gate and live proof

- **AC-10 — No regression and the full gate is green.**
  (a) `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (≥ 80% statements/branches/functions/lines **per workspace**) and `npm run build` pass with no coverage exclusion or threshold change.
  (b) `npm run smoke` passes the unchanged register → Mailpit → verify → login flow with `compose.smoke.yaml` still pinning Mailpit.
  (c) `actionlint` passes over both workflows; the `render.yaml` YAML parse and `src/frontend/vercel.json` JSON parse pass.
  (d) The repository credential guard passes over the tracked tree, untracked files, branch diff **and branch history** (`git log -p origin/main..HEAD`); the branch history adds no `.env*` file.
  (e) T8 re-executes T1's 587-reject / malformed-reject / 2525-accept process fixtures and T7's per-file documentation checks verbatim; raw output is recorded.
  (f) The existing user-authentication, Brevo email and deploy-placeholder test suites pass, except where this spec records a supersession (AC-3/AC-8, the 502 docs and the resend-enumeration row).
  Evidence: T8 build log with raw commands and output.

- **AC-11 — The owner proves the deployed delivery, with merge ordering and redaction.**
  (a) **Before merge**, the GitHub `development` Environment reports `SMTP_PORT=2525` (non-secret; `gh variable get` output recorded) and `SMTP_SECURE=false`, recorded in `build-log-T9.md` Phase A. If the values are not set, the first post-merge deploy fails at the guard; the documented recovery is to set them and re-run. No agent writes them.
  (b) **After the post-merge Deploy**, the latest run succeeded and the deploy log contains `SYNCED SMTP_PORT (value verified, not shown)`; both are recorded.
  (c) Render logs show `smtp_transport_verify_ok` for the new instance, or — if the level filters info — the recorded fallback `info level filtered; no verification_email_delivery_failed line` plus the successful send evidence.
  (d) A resend to an owner-controlled mailbox produces a Brevo transactional-log entry and a delivered message containing the verification link; the owner clicks it, the account reaches `verified = true`, and the owner records `joined as account` after a successful login and `join { mode: 'account' }` from the deployed frontend.
  (e) The evidence in `docs/features/registration-account-exists/build-log-T9.md` uses placeholders (`<owner-address>`, `<frontend origin>`) and contains no credential, verification link/token, email address or third-party PII; T9's guards enforce that.
  Evidence: T9 build log (owner-provided, redacted), Phase A and Phase B markers.

## Non-goals

- **No automated account deletion, merge or identifier change.** Deleting both rows (or keeping U2) is destructive, owner-only and stays open (Q-1); no task executes SQL against Neon. A future change-identifier/merge feature is separate (Q-3).
- No password reset flow; the accepted user-authentication non-goal stands. Recovery without a password uses the unauthenticated resend endpoint documented in AC-9(c).
- No Brevo REST API adapter, new email provider, new dependency, or change to the branded template/subject/plain-text body.
- No change to WebSocket messages, rooms, presence, reconnection, grace or server authority.
- No schema or migration change; no soft-delete column; no new table.
- No new service, image, port, volume, healthcheck or compose change; no Dockerfile change.
- No production provisioning and no write of production values; `production` stays placeholder-only.
- No change to the deploy trigger model, concurrency, permissions, Render deploy hook, Vercel steps or deployed smoke.
- No new GitHub Action, workflow permission or secret name.
- No UI redesign beyond the field errors, `502` resend block, resend error line and the identifier hint.
- No change to registration/session/token semantics beyond AC-3(c) invalidation (register, resume, resend) and AC-4 resume reissue.
- No edit of `docs/features/README.md` (orchestrator-owned); the builder proposes its row in the build log (AC-9(h)).
- No weakening of TLS, rate limits, password policy or logging redaction.

## Boundaries

- ✅ Always: keep Mailpit the local default; keep the seven SMTP names and their GitHub classifications; validate all nine deployment values before any Render call; fail closed on blocked, malformed, local or non-STARTTLS ports; preserve `EmailDeliveryError.message` for the CLI while never logging/returning it; invalidate an undelivered token on register, resume and resend; hash-verify the password before resume; keep login responses generic; use concrete expected values in tests; record raw evidence in build logs with redaction; run lint, typecheck, tests, coverage and build per task.
- ⚠️ Ask first: changing the GitHub `development` `SMTP_PORT`/`SMTP_SECURE` values or re-running the deploy (owner action); deleting both U1/U2 rows or keeping U2 (owner decision); adding a dependency; changing the resume or resend rate limits; extending the strict guard to production; touching `render.yaml`, `compose*.yaml`, Dockerfiles or migrations; changing an accepted SMTP/deploy contract beyond § Supersessions.
- 🚫 Never: commit, print, log or record an SMTP key, REST key, Render key, session token, verification token or verification link, or a real email address; send email to a third party or from CI; run destructive SQL against Neon; bypass or weaken the port guard; return the transport message to an HTTP client; log an email address, username, account id or request body; edit `.env*`; weaken assertions or exclude production code from coverage; touch `docs/features/README.md`.

## Security considerations

- **User-controlled data:** username, email, password, login identifier, verification token. All validation and normalization stay server-side; the frontend never decides identity or the verified flag.
- **Enumeration posture.** Registration already returns `409` on duplicates (accepted trade-off in user-authentication). This feature adds machine-readable `fields` while keeping the generic message, so the *status/message* contract is unchanged and only the client-side precision improves. Resend returns `502` on a real account's delivery failure while unknown emails still return `202`; this is an accepted, **superseded** posture (seventh supersession row) because the difference is provider-outage-scoped, the UI needs a resend path, and no email/identity is disclosed. Login keeps one identical `401` for unknown/wrong.
- **Resume safety.** Resume requires the stored Argon2 hash to verify for the submitted password and the row to be unverified; it issues a verification **token to the stored address**, never a session, and rate-limits reissue to 3/hour per account. A wrong password never resumes and returns the same `409` as a genuine conflict, so there is no password oracle.
- **Failed-send integrity.** The token issued before a failed send is invalidated on register, resume and resend, so an undelivered token cannot later be used if it leaked; the account remains unverified; a subsequent resume/resend issues a fresh token. The two existing undelivered tokens are retired by the next resend for their account or by expiry.
- **Deploy-guard strictness.** The guard rejects blocked ports, the local 1025, malformed/out-of-range ports and a non-STARTTLS `SMTP_SECURE` on 2525 before any Render call. It deliberately does not validate `SMTP_HOST` reachability (operator-owned) or arbitrary non-blocked ports; those remain `loadAuthConfig`/live-proof concerns, stated in AC-1(a).
- **Logging hygiene.** `verification_email_delivery_failed` and `smtp_transport_verify_failed` carry `errorType`, a whitelisted `transportCode`, `host`, `port` and the route only. `EmailDeliveryError.message` (which preserves the CLI contract) is never logged or returned by a route; the Fastify error serializer still drops messages/stacks. No request body, cookie, email, username, account id or token is logged.
- **Evidence redaction.** Build logs and docs use `<owner-address>`, `<frontend origin>` and `<verification-link>` placeholders. No real email address, verification URL/token, credential or third-party PII may be recorded. T7/T8/T9 enforce the patterns below. The docs-diff token guard exempts exactly one token-shaped literal: the documented synthetic `verify?token=cli-test` value the email CLI prints (it proves delivery/rendering, not an account). The build-log guard stays strict and records no link at all; any other false positive is resolved by replacing the value with a placeholder, never by weakening the check.
  ```
  ! grep -qE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' <build-log>
  ! grep -qE 'verify\?token=|token=[0-9a-f]{32,}' <build-log>
  ! git diff origin/main...HEAD -- README.md docs/architecture | grep -oE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' | grep -vxE 'no-reply@cubeclicker\.local|user@example\.com' | grep . >/dev/null
  ! git diff --no-color --unified=0 origin/main...HEAD -- README.md docs/architecture | grep '^+' | grep -oE 'verify\?token=[A-Za-z0-9_-]+|token=[0-9a-f]{32,}' | grep -vxF 'verify?token=cli-test' | grep . >/dev/null
  ```
  The address guard extracts each address (`grep -oE`) and filters whole-address matches (`grep -vxE`), so one line cannot hide a real address next to an allowed one. The docs token guard reads **added lines only** (`--unified=0`, then `grep '^+'`), so README context lines — including the documented CLI block the AC-9(b) edit sits next to — cannot trip it; it extracts each token-shaped value (`grep -oE`), drops exactly the synthetic `verify?token=cli-test` value (`grep -vxF`), and still fails on a real `verify?token=<value>` or `token=<32+ hex>` added in any of the guarded files, including on a line that also names the synthetic value. Both pipelines end in `grep . >/dev/null`, which reads all input, so `pipefail` cannot turn a real match into a pass through an early `grep -q` exit.
- **Credentials and transport.** TLS settings are unchanged: STARTTLS is required when credentials are set and `SMTP_SECURE=false`, certificate verification stays on, and `SMTP_CONNECTION_TIMEOUT_MS` bounds connection/greeting/socket so the probe and registration cannot hang. `SMTP_PORT=2525` is non-secret; no key is added, moved or printed.
- **Merge ordering.** The owner sets `SMTP_PORT=2525` and `SMTP_SECURE=false` **before merge** (AC-11(a)); otherwise the first deploy is blocked by design and recovered by setting them and re-running. No agent writes GitHub.
- **Destructive actions.** No agent deletes or merges users. Q-1 documents the cascade facts and requires explicit owner authorization; the wording is "delete both or keep U2" (a merge is not implemented; a future change-identifier feature is Q-3).
- **Dependencies/supply chain:** none added; no new Action; no Brevo API call from CI.

## Testing strategy

- **Backend unit (Vitest, node):**
  - `src/backend/src/deploy/render-env.test.ts` — strict `validateSmtpTransportPort` truth table (blocked, malformed, local, STARTTLS, allowed, production, missing/`CHANGEME`), exact four `formatSmtpPortFailure` blocks.
  - `src/backend/src/deploy/render-env-cli.test.ts` — 2525 `SMTP_VALUES`/`COMPLETE_ENV`/`EXPECTED_BODIES`; 587/malformed/`SMTP_SECURE=true` rejection, 2525 acceptance, production placeholder precedence, zero fetches in `--check-only`/`--dry-run`/blocked default, 2525 sync.
  - `src/backend/src/auth/email.test.ts` — `EmailDeliveryError` fields and verbatim message, `transportCode` whitelist, `SmtpEmailService.verify()` delegation/rejection, absent-`verify` resolution, `FakeEmailService.verifyCalls`.
  - `src/backend/src/auth/auth-service.test.ts` — resume success/wrong password/verified/rate limit; no new row; token rotation and failed-send invalidation for create/resume/resend; field arrays for username/email/both; unknown-race re-query; login by email/username/unknown/locked; unchanged create path.
  - `src/backend/src/auth/auth-routes.test.ts` — 502 exact body and cookie/session absence on register and resend; `resumed: true` body and no `resumed` on new registration; 429 body; generic 500 passthrough; 409 exact bodies for the three field shapes incl. U1/U2 fixture; email login 200/401/429; logger-stream assertion for `verification_email_delivery_failed` fields and absence of PII.
  - `src/backend/src/app.test.ts` — probe once, non-blocking with a never-settling `verify()`, `/healthz` unchanged, `smtp_transport_verify_ok`/`_failed`/`_skipped` exact fields and levels.
- **Backend integration (node, real HTTP layer):** the auth-routes and app suites run through `app.inject` with the real Fastify plugins, cookie plugin, CORS/Origin checks and the existing in-memory repositories; the CLI runs as a real process in T1/T8 fixtures (the exact workflow command), with injected fetch proving no network on rejection.
- **Frontend unit (Vitest + jsdom):** `src/frontend/src/auth/api.test.ts` (`fields` parsing, absent fields), `src/frontend/src/ui/AuthForms.test.tsx` (hint, three exact messages with `aria-invalid`/`aria-describedby` ids, 502 block + resend success/failure, unchanged validation), `src/frontend/src/ui/VerificationPending.test.tsx` (rejected resend alert, no false success, retry works).
- **Containerized e2e:** `podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit` then `npm run smoke` — proves the backend image builds and the register → Mailpit → verify → login flow still passes with Mailpit pinned (no SMTP relay contact).
- **Deployed proof (user-owned, not CI):** AC-11, two phases: Phase A (pre-merge 2525/false setting) and Phase B (post-merge deploy, sync line, Render/Brevo evidence, verified login and `joined as account`). The planner/builder never sends email or writes GitHub.
- **Coverage:** `npm run coverage` — ≥ 80% statements/branches/functions/lines **per workspace**; pre-gate form `npm run coverage --workspace @cubeclicker/backend` / `--workspace @cubeclicker/frontend`. No exclusion is added; every new branch (guard reasons, error mapping, resume states, probe outcomes, field shapes, unknown race, resend invalidation) is covered. Concrete expected values, no wildcard matchers, no snapshot-only or assertion-free tests, no network in tests.
- **Verification commands:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `npm run smoke`, `actionlint` over both workflows, the `render.yaml`/`vercel.json` parses, the deploy CLI fixtures and the repository credential/PII guard.

## Configuration contract

| Name | Local (`podman compose up`) | Render-free `development` | Rule |
| --- | --- | --- | --- |
| `SMTP_HOST` | `mailpit` | `smtp-relay.brevo.com` | unchanged; the guard does not validate reachability |
| `SMTP_PORT` | `1025` | **`2525`** | integer 1–65535; guard rejects 25/465/587, 1025, malformed/out-of-range for development; other valid ports allowed (operator-owned) |
| `SMTP_SECURE` | `false` | `false` | empty derives `true` only on 465; with 2525, only unset/empty/`false`/`0` passes the development guard |
| `SMTP_USER` / `SMTP_PASS` | unset | Brevo SMTP login / SMTP key | unchanged, secrets, never printed |
| `SMTP_FROM` | `no-reply@cubeclicker.local` | Brevo-verified sender | unchanged |
| `SMTP_CONNECTION_TIMEOUT_MS` | `10000` | `10000` | unchanged |
| `TARGET_ENVIRONMENT` | n/a | `development` | selects the strict guard; no new variable |

- The guard adds no configuration name; it reads the existing `TARGET_ENVIRONMENT`, `SMTP_PORT` and `SMTP_SECURE`. `render.yaml` is unchanged (`sync: false`, no values). The accepted nine-name catalog and seven-name sync list are unchanged.
- Production remains placeholder-only at `587` in the catalog; when production is provisioned on Render free it must also use `2525` (documented, owner-owned, out of execution scope; Q-2).

## Real-time impact

Out of scope for shared game state: no WebSocket message, room, presence, grace, reconnection or server-authority rule changes. Identity implications are explicit: login by email changes only **HTTP** session issuance; the WS upgrade still resolves the account from the `HttpOnly` session cookie, and `join { mode: 'account' }` still requires `verified = true`. Resume issues a verification token, never a session, so it cannot create a live WS identity. The single-session rule is unchanged: a login by email revokes prior sessions exactly as a username login does. No multi-client shared value is added, so no new server-authority or reconnection behavior is required.

## Containerization impact

No containerization change. The feature adds no service, image, port, volume, healthcheck, compose file or Dockerfile change, and no new environment-variable **name**: `SMTP_PORT`/`SMTP_SECURE` already flow through `compose.yaml`, `render.yaml`, the GitHub Environment and the Render sync, and their values change only in the GitHub `development` Environment (owner action). The startup probe is in-process code in the existing backend image and adds no route; `GET /healthz` and `GET /ws` on port `8080` are unchanged. Runtime configuration remains environment-based, secrets remain runtime-only, and the images stay provider-neutral, per `docs/architecture/containerization.md`. The deploy guard runs in the existing GitHub runner step before Render is touched.

## Immediate workaround and pre-merge checklist (owner)

**Pre-merge (required before merging this feature):**
1. Set `SMTP_PORT=2525` and `SMTP_SECURE=false` in the GitHub `development` Environment (UI, or `gh variable set SMTP_PORT --env development --repo raultorres2603/CubeClicker --body '2525'`; `SMTP_SECURE` is already `false`).
2. Record `gh variable get SMTP_PORT` (`2525`) and `gh variable get SMTP_SECURE` (`false`) in `build-log-T9.md` Phase A. If these are not set before merge, the first deploy fails at `Check deployment Brevo configuration`; recovery is to set them and re-run, not to bypass the guard.

**Immediate recovery (usable before this feature ships):**
1. With 2525 set, re-run the latest **Deploy** workflow (Actions → Deploy → *Re-run all jobs*) or push a commit to `main`; the current (pre-guard) catalog accepts `2525`, the sync writes it to Render, and the deploy restarts the instance.
2. Confirm `curl -fsS https://cubeclicker-development.onrender.com/healthz` returns `{"status":"ok"}`.
3. Resend and verify **U2** (`raultorraco123`): log in as `raultorraco123` (username login works today; email login arrives with this feature) → the pending screen → **Resend verification email**, **or** call the public endpoint with the owner's address:
   `curl -i -X POST https://cubeclicker-development.onrender.com/auth/resend-verification -H "Origin: <frontend origin>" -H "Content-Type: application/json" --data '{"email":"<the U2 address>"}'` → expect `202`.
4. If the resend still fails (should not at 2525), check root cause 4: run `npm run email:test --workspace @cubeclicker/backend -- --to <owner-address>` with the same SMTP values; success prints `Test email sent to …`; then check the Brevo transactional log, the verified sender and that `SMTP_PASS` is the **SMTP key**, not the REST API key. Fix in Brevo/GitHub and re-run.
5. Open the emailed link and confirm the account can play (`joined as account`).
6. The exact pair (`raultorraco` + the U2 address) still cannot register: U1 holds the username and U2 holds the email. Cleanup is **owner-only** (Q-1: delete both or keep U2); this spec's code does not delete or merge rows.

## Supersessions

| Superseded | Behavior replaced | Replaced by (this spec) | Retained |
| --- | --- | --- | --- |
| `brevo-smtp-email-delivery` AC-10 | Email transport rejection on `POST /auth/register` returns `500 internal_error` | `502 verification_email_failed` with a fixed public message and structured log (AC-3) | The account stays persisted and unverified; resend recovers |
| `brevo-smtp-email-delivery` § Fail-fast behavior | "There is deliberately **no** startup SMTP connectivity probe" | Non-blocking `onReady` `verify()` probe with redacted events (AC-8) | Startup still succeeds while Brevo is unreachable; delivery failures surface at request time |
| `brevo-smtp-email-delivery` AC-13/AC-14 + deploy catalog docs | 587 is the pinned deployment recipe; 2525 is only a fallback | Render-free development uses `2525` STARTTLS, strictly guarded (AC-1/AC-9) | 587 remains valid where outbound is not blocked; 465 remains supported off Render free |
| `deploy-brevo-env-placeholders` AC-2(b)/AC-11(i) catalog values | `development` and `production` are documented at `SMTP_PORT=587`; the guard only checks presence/`CHANGEME` | `development` value becomes `2525`; the guard becomes strict and fail-closed (AC-1) | The nine validated / seven synced names, classifications, placeholders and GitHub-as-source-of-truth are unchanged; production stays placeholder-only |
| `user-authentication` AC-2 (generic duplicate) | Every duplicate returns the same generic `409` body with no client-actionable detail | The status and message stay identical; `field`/`fields` are added and a same-pair retry on one unverified row resumes with `202` (AC-4/AC-5) | Generic message, no new row on conflict, accepted enumeration trade-off |
| `user-authentication` AC-7 assumption (username login) | Login resolves only `lower(username)` | Login resolves `@`-containing identifiers by `lower(email)`, otherwise by `lower(username)` (AC-6) | Identical `401`, lockout, rate limit, session cookie and single-session behavior |
| `user-authentication` § Security enumeration (resend) | Resend returns generic messages and identical statuses regardless of existence | A known account's delivery failure returns `502` while an unknown email returns `202` (AC-3(b)) | Unknown emails still return `202`; the difference is outage-scoped, documented, and leaks no email/identity |

## Open questions

- **Q-1 — (OWNER DECISION, DESTRUCTIVE) Reconcile U1 and U2 for the exact desired pair.** Options: (a) delete **both** unverified rows (U1 `a7cd44a3-…`, U2 `baa13819-…`) and register the exact pair; (b) keep U2 and play as `raultorraco123`; (c) defer the exact pair and add a change-identifier/merge feature later (non-goal here; Q-3). Facts: both rows are unverified, no sessions, no economy rows, **2 undelivered verification tokens** (one per row; retired by the next resend or 24-hour expiry), and `sessions`/`verification_tokens`/`user_economy` cascade on delete. No agent executes this; the owner must authorize option (a) explicitly. Recommendation: (b) now for access, (a) only after the live proof.
- **Q-2 — Should the strict guard also apply to `production` when it is provisioned?** This spec is development-scoped per the request; if production later runs on Render free, the same rules apply. Recommendation: extend the guard by environment when production is provisioned.
- **Q-3 — Does the owner want a first-class change-email/change-username or merge flow?** Out of scope here; record as a product follow-up if the exact pair matters after Q-1.
- **Q-4 — Is the owner's known password for U2 available?** Not required: the unauthenticated resend command in § Immediate workaround and AC-9(c) recovers the account by email. If a password reset is wanted, it is a separate feature (accepted non-goal).
- **Q-5 — Brevo sender/domain authentication.** Zero Brevo records over 30 days is explained by the port block; after 2525 works, a REST key in `SMTP_PASS` or an unauthenticated sender would still fail. The `email:test` step and AC-11 detect these; domain authentication is owner-owned and not a blocker for the spec.
- **Q-6 — Resume rate limit (3/hour per account) and its interaction with the 5/minute per-IP register limiter.** Proposed as pinned; confirm if the owner wants a different bound.
- **Q-7 — Production merge ordering when production is provisioned.** The Phase A precondition applies to `development`; production will need its own pre-deploy values (placeholder-only today).

## Assumptions

- Render free allows outbound SMTP on **2525** to `smtp-relay.brevo.com` (Brevo's documented alternate STARTTLS port; Render's block covers 25/465/587). If 2525 is also blocked, T9 records the failure and this feature stops; the fallback is a Brevo REST API feature, not a code change here.
- Brevo authenticates the same SMTP login + SMTP key on 2525; `SMTP_SECURE=false` + `requireTLS` is the correct transport shape.
- The owner controls both diagnosed Gmail addresses and can complete the emailed link; the addresses themselves are intentionally omitted from artifacts and replaced by `<owner-address>`.
- Usernames cannot contain `@` (accepted policy `[a-zA-Z0-9_-]{3,24}`), so `@` reliably selects email resolution. Legacy rows with `@` in a username would resolve by email first; none are known.
- The Render service stays one instance; no cross-instance coordination is introduced.
- The startup probe is credential-gated: local Mailpit and unit-test apps carry no SMTP credential pair, so they log `no_credentials` and open no transport connection; the deployed relay carries the pair.
- Production remains unprovisioned and its placeholder values are not written by this feature.
- The feature branch is `feat/registration-account-exists`; `docs/features/README.md` is updated by the orchestrator on acceptance, based on T7's proposed row.

## Review findings disposition (r1)

| ID | Severity | Disposition | What changed |
| --- | --- | --- | --- |
| F1 | BLOCKER | Fixed | AC-4(g) added; T4 now owns `resumed` passthrough, the exact route body and the 429, with route tests; T4 acceptance includes AC-4. |
| F2 | MAJOR | Fixed | AC-1(d)/(e) and T1 pin exactly one 2525 development fixture and one 587 production placeholder fixture; `render-env-cli.test.ts` `SMTP_VALUES`/`COMPLETE_ENV`/`EXPECTED_BODIES` move to 2525; T1's verify uses `-eq 1` and context checks. |
| F3 | MAJOR | Fixed | R-3/AC-3(c) now cover create, resume and resend; T3 wraps all three sends and invalidates the just-issued token; the two existing undelivered tokens are recorded in the diagnosis and Q-1; the non-goal now names all three invalidation paths. |
| F4 | MAJOR | Fixed | AC-9 rewritten per file; T7 uses per-file loops with exact positives/negatives for export, table, CLI example, runbook 2525/no development 587, stale pinned-587 in both architecture docs, recovery order/both paths/Q-1, 502/guard, event fields/levels/no-PII; T8 re-runs the block verbatim. |
| F5 | MAJOR | Fixed | T8 adds `git log -p origin/main..HEAD`, the `.env*` history check, the T1 process fixtures and T7's per-file doc checks; AC-10(d)/(e) require them. |
| F6 | MAJOR | Fixed | AC-11(e) and § Evidence redaction pin token/link/email guards; T7/T8/T9 run them over build logs and the docs diff; README commands use `<owner-address>`/`<frontend origin>` placeholders. |
| F7 | MAJOR | Fixed | R-11, AC-11(a), § Immediate workaround and T9 Phase A require `SMTP_PORT=2525`/`SMTP_SECURE=false` before merge, recorded with `gh variable get`; the blocked first deploy is documented as the recovery fallback, not the primary path. |
| F8 | MAJOR | Fixed | AC-1(a) requires strict integer 1–65535 validation and returns `invalid_port`; `local_port` rejects 1025; `starttls_required` rejects non-false `SMTP_SECURE` on 2525; tests cover `0`, `65536`, `-1`, `587abc`, `25.5`, `' 2525'`, 1025 and secure variants. |
| F9 | MINOR | Fixed | Seventh supersession row added for the resend enumeration change; § Security states it is accepted and outage-scoped. |
| F10 | MINOR | Fixed | AC-11(b) and T9 require the `SYNCED SMTP_PORT` line in the build log; T9 verify greps it. |
| F11 | MINOR | Fixed | § Immediate workaround step 4 and AC-9(c) add the `email:test`/Brevo transactional-log/sender/SMTP-key check; T7 documents it. |
| F12 | MINOR | Fixed | The pre-ship workaround now says username login works today and email login arrives with this feature; the unauthenticated resend remains the passwordless path. |
| F13 | MINOR | Fixed | AC-1(c) states the exact `runRenderEnvCli(argv, env, io)` three-argument signature with `fetchImpl`/`log`, and joins the captured `io.log` output for the exact block. |
| F14 | MINOR | Fixed | AC-7(c) pins `aria-invalid="true"` and `aria-describedby` ids (`auth-error-username`, `auth-error-email`, `auth-error-account`) and exactly one alert. |
| F15 | MINOR | Fixed | AC-5(f) defines the DB-race re-query and the fallback `both` body; T3 tests the race. |
| F16 | MINOR | Fixed | AC-11(c)/(d) pin the fallback form and require a recorded `joined as account` play proof, not just phrases. |
| F17 | MINOR | Fixed | AC-1(a) rejects 1025 and non-false `SMTP_SECURE` on 2525, and explicitly scopes `SMTP_HOST`/other ports as operator-owned; the config table and T1 tests reflect it. |
| F18 | INFO | Fixed (sizing note) | T6 has a concrete disjoint split (`api`+`AuthForms` vs `VerificationPending`) if needed; T3 remains one task because both halves edit `auth-service.ts` — splitting would duplicate file ownership, so the task records a size note and sequential commits. |
| F19 | INFO | Fixed | The diagnosis records the 2 verification tokens and their retirement; § Diagnosis states the review reproduced the facts and raw Render/Brevo excerpts are omitted for PII. |
| F20 | INFO | Fixed in spec (status is orchestrator-owned) | Q-1/§ Security now say "delete both or keep U2"; the orchestrator should update the status blocker line to the same wording. |
| F21 | INFO | Fixed | AC-9(h) and T7 require a `Feature-index row proposal` line in `build-log-T7.md`; the index itself stays untouched. |
| F22 | INFO | Fixed | The 2525/Brevo assumptions remain explicit and add a stop condition: if 2525 fails, T9 records it and a REST feature is required. |

**r2 review disposition:** F1 (BLOCKER) — fixed in r4: the docs-diff token guard reads **added lines only** (`--no-color --unified=0` plus `grep '^+'`) and exempts exactly the documented synthetic `verify?token=cli-test`, so the required AC-9(b) README CLI-example edit passes while real `verify?token=<value>` / `token=<32+ hex>` additions still fail; § Evidence redaction and the T7/T8 verify commands carry the same pipeline, with the no-match-safe `grep . >/dev/null` tail. F2–F8 (MINOR/INFO: staged-ownership guard for `docs/features/README.md`, residual AC-9 string coverage, resume-429 `Retry-After` ambiguity, T9 run/log pinning, exact-phrase negative guards, the r3 history omission and the status wording) are deliberately **not** changed in r4 per orchestrator scope; they are carried in `reviews/spec-r2.md` § Non-blocking backlog for the final summary.

**r3 pass (final self-consistency, not a review):** F1–F8 were re-checked against the current artifacts and remain coherent: AC-4(g)/T4 own the `resumed` route contract; AC-3(c)/T3 invalidate the just-issued token on create, resume and resend; AC-1(a)/T1 cover blocked, malformed/out-of-range, 1025 and STARTTLS semantics; AC-9 remains per-file with T8 re-running T7's checks; AC-10(d)/(e) and T8 carry the branch-history/`.env` audits and final-gate re-runs; AC-11 has Phase A (pre-merge) and Phase B (live proof); T9 stays owner-only.

## Revision history

- r1 — 2026-11-24 — initial draft from the verified diagnosis (planning phase). No review findings yet.
- r2 — 2026-11-24 — spec review r1 (1 BLOCKER, 7 MAJOR, 14 MINOR/INFO): F1 route `resumed` ownership moved to T4; F2 CI fixture/`render-env-cli.test.ts` 2525 split; F3 resend failed-send token invalidation for create/resume/resend; F4 per-file docs checks and stale 587/500 coverage; F5 branch-history and final-gate re-runs; F6 PII/token guards; F7 pre-merge 2525 sequencing; F8 strict port/STARTTLS guard; F9 seventh supersession; F10 sync-line evidence; F11 Brevo recovery step; F12 pre-ship login wording; F13 CLI signature; F14 accessibility association; F15 unknown-race body; F16 play-proof evidence; F17 guard scope; F18 sizing note; F19 token count/provenance; F20 Q-1 wording; F21 feature-index proposal; F22 2525 stop condition.
- r3 — 2026-11-24 — final self-consistency pass (not a new review): T1/T8 verify snippets checked for syntax and `set -euo pipefail` behavior (the multiline `env` fixtures, `grep -B5` context checks and `awk` recovery extraction are valid); T7/T8 documentation checks aligned with AC-9 (README `SMTP_SECURE=false`, recovery-section `SMTP_PORT=2525`/`SMTP_SECURE=false`/`/healthz`, README `502`, full observability no-PII sentence); the docs-diff email guard now extracts and whole-matches addresses so a mixed allowed/disallowed line cannot pass; T7/T8 assert `origin/main` exists before the negated git guards; plan's unused `VerificationPending.initialError` prop removed; F1–F8 dispositions re-confirmed. No acceptance criterion changed.
- r4 — 2026-11-24 — spec review r2 BLOCKER F1 (docs-diff token guard false-positive on the documented synthetic link): the token guard now scans **added diff lines only** (`git diff --no-color --unified=0 ... | grep '^+'`), extracts each token-shaped value, exempts exactly `verify?token=cli-test`, and ends in `grep . >/dev/null` so a no-match pipeline cannot false-pass; § Evidence redaction and the T7/T8 verify commands carry the same pipeline; real `verify?token=<value>` / `token=<32+ hex>` additions still fail. No acceptance criterion, task, ownership or dependency changed; r2 F2–F8 are not addressed here and remain carried to the final summary.
