---
feature: registration-account-exists
revision: 4
---
# Plan — Registration Account Exists: Working Verification Delivery, Honest Conflicts & Resumable Registration

> Revision r4 (2026-11-24): spec-review r2 BLOCKER F1 — records the added-lines-only docs token guard with its single documented synthetic `verify?token=cli-test` exemption (D-14, risks); no task or acceptance change.

> Revision r3 (2026-11-24): final self-consistency pass — removed the unused `VerificationPending.initialError` prop from the frontend contract and file inventory; no task or acceptance change.

## Architecture

### Component view

```
Render-free development (owner sets SMTP_PORT=2525 / SMTP_SECURE=false BEFORE merge)
  GitHub Environment development
        │  deploy workflow: validate nine → strict guard → sync seven → Render
        ▼
  deploy/render-env.ts ── validateDeployEnv (accepted)
        ├─ validateSmtpTransportPort  (new: blocked / invalid / local / STARTTLS)
        └─ formatSmtpPortFailure      (new: four exact operator blocks)
        ▼
  auth/email.ts ── SmtpEmailService
        ├─ sendVerification → EmailDeliveryError on transport rejection
        └─ verify()        → EmailDeliveryError on probe rejection
        ▼
  auth/auth-service.ts ── register / resume / resend / login
        ├─ resume unverified same-pair registration (password-verified)
        ├─ field-specific DuplicateAccountError incl. DB-race re-query
        ├─ identifier = '@' ? email : username
        └─ invalidate the just-issued token on every failed send
        ▼
  auth/auth-routes.ts ── mapError + register handler
        ├─ EmailDeliveryError → 502 verification_email_failed + warn event
        ├─ DuplicateAccountError → 409 with field/fields
        ├─ register → 202 with resumed only when true
        └─ anything else → existing 500 internal_error
        ▼
  app.ts ── onReady: fire-and-forget, credential-gated email.verify()
```

The frontend consumes the same contract: `auth/api.ts` parses `fields` into `AuthError`; `ui/AuthForms.tsx` renders field-scoped messages with pinned ARIA ids and the 502 resend block; `ui/VerificationPending.tsx` catches resend rejections. No `App.tsx`/`AuthMenu.tsx` change is needed because `onVerificationRequired` already carries the email.

### State ownership

- **Server-authoritative:** account existence, `verified`, password hash, token issuance/consumption/invalidation, sessions and every conflict decision. The client never infers identity from a field error.
- **No shared real-time state:** the WS hub still resolves identity exclusively from the `HttpOnly` session cookie; resume never issues a session; login by email changes only HTTP session issuance. No protocol/state change.
- **Configuration ownership:** the GitHub `development` Environment remains the source of truth for the seven SMTP names. This feature changes **values** (`SMTP_PORT=2525`, `SMTP_SECURE=false`), not names, and only the owner writes them — before merge (Phase A).

### Registration decision table (exact order)

`U<username>` = `findByUsername(username)`, `U<email>` = `findByEmail(email)` (both case-insensitive).

| `U<username>` | `U<email>` | Same row? | Row state | Password verifies? | Result |
| --- | --- | --- | --- | --- | --- |
| null | null | — | — | — | create, issue token, send; 202 `{message}`; failed send invalidates |
| row A | null | — | any | not checked | 409 `field:'username'`, `fields:['username']` |
| null | row B | — | any | not checked | 409 `field:'email'`, `fields:['email']` |
| row A | row B | no | any | not checked | 409 `field:'both'`, `fields:['username','email']` |
| row A | row A | yes | verified | not checked | 409 `field:'both'`, `fields:['username','email']` |
| row A | row A | yes | unverified | no | 409 `field:'both'`, `fields:['username','email']` |
| row A | row A | yes | unverified | yes | **resume**: rate-limit, invalidate old tokens, issue one, send; 202 `{message, resumed:true}`; failed send invalidates |
| `create` throws `DuplicateUserError('unknown')` | — | — | — | — | re-query both identifiers and emit the found field(s); both null → `field:'both'`, `fields:['username','email']` |

The send step (create, resume and resend) is wrapped: on any rejection, `invalidateForUser(user.id)` is attempted (best-effort) and the error is rethrown. Only `EmailDeliveryError` becomes 502; unknown errors keep 500.

### Delivery-error flow

1. `nodemailer` rejects inside `SmtpEmailService.sendVerification`.
2. `EmailDeliveryError` captures `host`, `port`, `errorType`, whitelisted `transportCode` and the **source message** (the CLI needs it for its accepted redacted lines).
3. `AuthService` invalidates the just-issued token (create/resume/resend) and rethrows.
4. `auth-routes` maps by class to the fixed 502 body, logs one redacted `warn` event, and never returns `error.message`; the register handler serializes `resumed` only when true.
5. `EmailDeliveryError.message` remains reachable only to the operator CLI, which runs `redactSecrets` before printing.

### Startup probe flow

`buildApp` registers `app.addHook('onReady', ...)` after constructing the email service. The hook runs only when `authConfig.smtpUser` and `authConfig.smtpPass` are both non-null (the deployed relay path; unauthenticated Mailpit is skipped with `reason: 'no_credentials'`), starts `email.verify()` and attaches `.then/.catch`; it returns `undefined`, so Fastify does not await the probe. The probe is bounded by the transport's existing `SMTP_CONNECTION_TIMEOUT_MS`. Outcomes log `smtp_transport_verify_ok` (info), `smtp_transport_verify_failed` (warn), or `smtp_transport_verify_skipped` (debug, `reason: 'no_credentials' | 'unsupported'`). `/healthz` and `listen` are untouched.

### Merge-ordering flow

1. **Before merge:** owner sets `SMTP_PORT=2525` and `SMTP_SECURE=false` in GitHub `development`, records `gh variable get` in `build-log-T9.md` Phase A.
2. Merge → CI → Deploy: catalog validates nine, the strict guard accepts 2525/false, the sync writes seven (including 2525), Render restarts.
3. **After deploy:** T9 Phase B records the sync line, Render probe, Brevo delivery, verified login and `joined as account`.
4. If Phase A is missed, the first deploy fails at `Check deployment Brevo configuration`; the documented recovery is to set the values and re-run — never to bypass the guard.

## Interfaces / contracts

### Deploy module (`src/backend/src/deploy/render-env.ts`)

```ts
export const BLOCKED_RENDER_FREE_SMTP_PORTS = [25, 465, 587] as const;
export const LOCAL_MAILPIT_PORT = 1025;
export const RENDER_FREE_SMTP_PORT = 2525;

export type SmtpPortFailure =
  | { ok: false; reason: 'render_free_blocked'; port: number }
  | { ok: false; reason: 'invalid_port'; raw: string }
  | { ok: false; reason: 'local_port'; port: number }
  | { ok: false; reason: 'starttls_required'; value: string };

export function validateSmtpTransportPort(
  env: Record<string, string | undefined>,
): { ok: true } | SmtpPortFailure;

export function formatSmtpPortFailure(
  environment: string,
  failure: SmtpPortFailure,
): string;
```

- Guard only when `env.TARGET_ENVIRONMENT === 'development'`; production/unknown environments return `{ ok: true }` (Q-2).
- Presence/`CHANGEME` is the catalog's job; a missing/empty/`CHANGEME` port is not a port-guard failure.
- Strict parse: `/^\d+$/` and 1–65535; otherwise `invalid_port`. No trimming (whitespace is invalid).
- 25/465/587 → `render_free_blocked`; 1025 → `local_port`; 2525 requires `SMTP_SECURE` in `undefined | '' | 'false' | '0'`, else `starttls_required`.
- Any other valid port is allowed; `SMTP_HOST` reachability is explicitly out of the guard's scope (operator/live proof).
- `runRenderEnvCli` calls the guard **after** `validateDeployEnv` succeeds and **before** dry-run lines or any fetch, in `--check-only`, `--dry-run` and default mode; a failure prints the block via `io.log` and returns `1`.

### Email module (`src/backend/src/auth/email.ts`)

```ts
export interface EmailTransport {
  sendMail(options: OutgoingEmail): Promise<unknown>;
  verify?(): Promise<unknown>;           // new, optional for existing fakes
}

export interface EmailService {
  sendVerification(...): Promise<void>;
  verify?(): Promise<void>;              // new, optional so existing test doubles compile
}

export class EmailDeliveryError extends Error {
  readonly code = 'verification_email_failed';
  readonly transport = 'smtp';
  readonly host: string;
  readonly port: number;
  readonly errorType: string;
  readonly transportCode?: string;       // /^[A-Z0-9_]{1,40}$/ only
  constructor(source: unknown, host: string, port: number);
}
```

`FakeEmailService` gains `verifyCalls: number`, `failNextVerify?: Error`, and `verify()`.

### Auth service (`src/backend/src/auth/auth-service.ts`)

```ts
export type AccountField = 'username' | 'email';

export class DuplicateAccountError extends AuthServiceError {
  readonly field: AccountField | 'both';
  readonly fields: AccountField[];       // ordered: ['username'] / ['email'] / ['username','email']
  constructor(fieldOrFields?: AccountField | AccountField[] | 'unknown');
}

export interface RegisterResult { /* existing */ resumed?: boolean }

// login: input.username is the identifier
//   identifier.includes('@') ? users.findByEmail(identifier) : users.findByUsername(identifier)
```

- Resume limiter: `rateLimiter.allow('account:' + id + ':register-resume', 3, 3_600_000)`.
- `RegisterResult.resumed` is `true` only on resume; the new-registration result omits it.
- `create` catch: `DuplicateUserError('unknown')` triggers one re-query; the resolved field(s) drive `field`/`fields`; both null → `'both'`/`['username','email']`. The constructor maps a bare `'unknown'` to that same `'both'` fallback, so no 409 can omit `fields`.
- Send wrapper applies to `register` (create), `resumeUnverified`, and `resendVerification`; each invalidates `user.id`'s tokens before rethrowing.

### HTTP contract (`src/backend/src/auth/auth-routes.ts`)

| Case | Status | Body |
| --- | --- | --- |
| register/resend delivery failure | `502` | `{ message: 'verification email could not be sent', code: 'verification_email_failed', error: 'verification_email_failed' }` |
| username conflict | `409` | `{ message: 'account already exists', code: 'duplicate_account', error: 'duplicate_account', field: 'username', fields: ['username'] }` |
| email conflict | `409` | same, `field: 'email'`, `fields: ['email']` |
| both / verified / resume-password-mismatch / unknown-race fallback | `409` | same, `field: 'both'`, `fields: ['username','email']` |
| resume success | `202` | `{ message: 'verification email sent', resumed: true }` |
| new registration success | `202` | `{ message: 'verification email sent' }` |
| resume rate limit | `429` | `{ message: 'rate limit exceeded', code: 'rate_limited', error: 'rate_limited' }` + `Retry-After` |
| unknown error | `500` | `{ message: 'internal error', code: 'internal_error', error: 'internal_error' }` |

`mapError` gains the request (or a logger callback) so it can emit the delivery event. The register handler passes `resumed` through only when true. All existing call sites pass the request.

### Structured log events

| Event | Level | Fields |
| --- | --- | --- |
| `verification_email_delivery_failed` | warn | `route` (`register`/`resend-verification`), `errorType`, `transportCode?`, `host`, `port` |
| `smtp_transport_verify_ok` | info | `host`, `port` |
| `smtp_transport_verify_failed` | warn | `errorType`, `transportCode?`, `host`, `port` |
| `smtp_transport_verify_skipped` | debug | `reason: 'no_credentials' \| 'unsupported'` |

No message, stack, email, username, account id, token or credential appears in any of these events.

### Frontend contract (`src/frontend/src/auth/api.ts`, `ui/AuthForms.tsx`, `ui/VerificationPending.tsx`)

```ts
export type AccountField = 'username' | 'email';

export class AuthError {
  readonly fields?: AccountField[];      // parsed from a 409 body
}

export type AuthSubmitResult =
  | { outcome: 'success'; mode: 'login'; user: AuthFormUser | null }
  | { outcome: 'success'; mode: 'register' }
  | { outcome: 'verification'; email: string }
  | { outcome: 'email_delivery_failed'; email: string }
  | { outcome: 'error'; message: string; fields?: AccountField[] };

export interface AuthFormApi {
  login?; register?;
  resend?(input: { email: string }): Promise<unknown>;   // new
}
```

- Server messages stay generic; the frontend owns the field copy: `That username is already taken.`, `That email is already registered.`, `That username and email are already registered.`
- Field ARIA: username `aria-invalid="true"` + `aria-describedby="auth-error-username"` / alert id `auth-error-username`; email analogous `auth-error-email`; both share `auth-error-account`; exactly one `role="alert"`.
- 502 copy: `Account created, but the verification email could not be sent.` + `Resend verification email`.
- Resend failure copy: `Could not resend the verification email. Try again.`
- Login hint: `Username or email`; the accessible label stays `Username` and the submitted field stays `name="username"`, so existing queries and the route's accepted mapping are unchanged.

## File inventory

| Path | New/Edit | Purpose | Owner task |
| --- | --- | --- | --- |
| `src/backend/src/deploy/render-env.ts` | Edit | Strict `SmtpPortFailure` union, validator, four exact blocks | T1 |
| `src/backend/src/deploy/render-env.test.ts` | Edit | Truth table (blocked/invalid/local/STARTTLS/allowed/production) + four blocks | T1 |
| `src/backend/src/deploy/render-env-cli.ts` | Edit | Call the guard in check-only/dry-run/sync with catalog precedence | T1 |
| `src/backend/src/deploy/render-env-cli.test.ts` | Edit | 2525 shared values/bodies; 587/malformed/secure reject; production precedence; zero-fetch | T1 |
| `.github/workflows/ci.yml` | Edit | One development accept fixture at 2525; production placeholder stays 587 | T1 |
| `src/backend/src/auth/email.ts` | Edit | `EmailDeliveryError`, optional `verify`, `FakeEmailService.verify` | T2 |
| `src/backend/src/auth/email.test.ts` | Edit | Error fields, verbatim message, code whitelist, verify delegation | T2 |
| `src/backend/src/auth/auth-service.ts` | Edit | Resume, field arrays, unknown-race re-query, token invalidation on create/resume/resend, identifier login, limiter | T3 |
| `src/backend/src/auth/auth-service.test.ts` | Edit | Decision table, token rotation/invalidation, race, login cases | T3 |
| `src/backend/src/auth/auth-routes.ts` | Edit | 502 mapping, 409 `field`/`fields`, `resumed` passthrough, delivery warn event | T4 |
| `src/backend/src/auth/auth-routes.test.ts` | Edit | Exact bodies incl. `resumed`/429, cookie/session absence, log capture, U1/U2 fixture, email login | T4 |
| `src/backend/src/app.ts` | Edit | `onReady` non-blocking, credential-gated `verify()` probe | T5 |
| `src/backend/src/app.test.ts` | Edit | Probe once/non-blocking/events/skip | T5 |
| `src/frontend/src/auth/api.ts` | Edit | `AuthError.fields` parsing | T6 |
| `src/frontend/src/auth/api.test.ts` | Edit | Fields present/absent | T6 |
| `src/frontend/src/ui/AuthForms.tsx` | Edit | Hint, ARIA field errors, 502 resend block, `AuthFormApi.resend` | T6 |
| `src/frontend/src/ui/AuthForms.test.tsx` | Edit | Exact copy, ARIA ids, resend success/failure | T6 |
| `src/frontend/src/ui/VerificationPending.tsx` | Edit | Catch/display resend rejection; no new caller prop | T6 |
| `src/frontend/src/ui/VerificationPending.test.tsx` | Edit | Rejected resend alert, no false success, retry | T6 |
| `README.md` | Edit | Blocked-port rule, 2525 recipe/table/CLI, pre-merge checklist, recovery incl. `email:test`, 502 | T7 |
| `docs/architecture/deployment.md` | Edit | Guard scope, 2525/false, 502 | T7 |
| `docs/architecture/vercel-render-neon.md` | Edit | Troubleshooting/email: blocked ports, 2525, 502, guard | T7 |
| `docs/architecture/observability.md` | Edit | New event catalog rows + no-PII statement | T7 |
| `docs/features/registration-account-exists/build-log-T{1..9}.md` | New | Raw evidence per task (redacted; index proposal in T7) | T1–T9 |

**Deliberately untouched:** `render.yaml` (value-free, `sync: false`), `compose.yaml`, `compose.smoke.yaml`, both Dockerfiles, `src/backend/src/db/**` (no schema/migration change), `src/backend/src/auth/email-cli.ts` and `email-cli.test.ts` (the wrapper preserves their exact lines), `src/frontend/src/auth/store.ts`, `src/frontend/src/App.tsx`, `src/frontend/src/ui/AuthMenu.tsx`, `docs/features/README.md` (orchestrator-owned; T7 proposes the row), `.env*`.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Render-free **development** uses `SMTP_PORT=2525`, `SMTP_SECURE=false`, set before merge | 2525 is Brevo's documented alternate STARTTLS port and is not in Render's free-tier block; pre-setting avoids a guaranteed first-deploy failure | Keep 587 (never works); 465 (blocked); Brevo REST API (new feature); paid plan (owner cost); accept a blocked first deploy (documented fallback only) |
| D-2 | Guard is development-scoped | Production is unprovisioned; applying it now would fail on placeholders before they are filled; Q-2 revisits at provisioning | Global guard now (blocks production placeholder path); no guard (silent recurrence) |
| D-3 | Delivery failure → `502 verification_email_failed` | Upstream provider failure; machine-detectable; UI needs a distinct resend path | 500 (undiagnosable); 503 (implies service down); 202 with hidden failure (lies) |
| D-4 | `EmailDeliveryError.message` preserves the source message; routes/logs never expose it | Keeps accepted `email-cli` exact lines and its redaction contract while keeping HTTP/Pino clean | Wrapper message (breaks CLI AC-9); pre-redact in the service (needs a new shared redactor or a cycle) |
| D-5 | A failed send invalidates the just-issued token on **create, resume and resend** | An undelivered token has no legitimate user; invalidation makes failure state clean; resume/resend issues a fresh one | Leave the token (usable if leaked; remains valid 24 h); atomic DB/email transaction (no transactional email rollback exists) |
| D-6 | Resume requires the stored Argon2 hash to verify and the row to be unverified | Proves the retrying party is the account owner; issues an emailed token, never a session | Resume on username+email alone (takeover of an unverified account) |
| D-7 | Keep the accepted generic 409 message; add `field`/`fields`; unknown race re-queries | Preserves `user-authentication` AC-2 and the accepted enumeration posture; the client gets precision; the race is mapped honestly | Field-specific messages (breaks AC-2 text); omit fields on race (contradicts AC-5) |
| D-8 | Login identifier with `@` resolves by email, otherwise by username | Usernames cannot contain `@`; one field recovers U2 by email | Separate fields (more UI); try both (ambiguous/extra queries) |
| D-9 | Probe on `onReady`, fire-and-forget, credential-gated, bounded by SMTP timeouts | Gives operators a signal while honoring "must boot while Brevo is down"; no listen delay; Mailpit/tests never dial | Await before listen (violates boot-while-down); no probe (superseded behavior); `/healthz` probe (fails deploys) |
| D-10 | Frontend owns field/resend copy; `VerificationPending` self-contains resend error state; no `App`/`AuthMenu` change | Reuses the existing `onVerificationRequired` path; minimal surface; exact copy/ARIA is testable | Route 502 to the pending screen (gate state change); global toast (less explicit) |
| D-11 | No schema, migration, delete or merge code | The data problem is two rows and is destructive; owner decision (Q-1), not an autonomous path | Soft delete (new schema); merge endpoint (new feature, Q-3) |
| D-12 | Strict guard: integer 1–65535, reject 1025, require STARTTLS on 2525 | `validateDeployEnv` only checks presence/`CHANGEME`; without strict parsing a bad value is synced and crashes at startup | Port-block-only guard (review F8); full `loadAuthConfig` in the CLI (duplicates config semantics) |
| D-13 | Resend 502 is a recorded seventh supersession | UI needs a visible resend failure; the difference is provider-outage-scoped and unknown emails still return 202 | Preserve identical 202 statuses (hides the action); always 202 with a field (still reveals existence) |
| D-14 | Docs/evidence use placeholders and explicit PII/token guards; the docs-diff token guard reads added lines only and exempts exactly the documented synthetic `verify?token=cli-test` | Build logs otherwise risk recording addresses/links; a guard makes the rule binary; a whole-diff scan false-positives on the README CLI block that the required AC-9(b) edit sits next to (review r2 F1) | Rely on reviewer discretion (not testable); whole-diff scan of context lines (cannot pass with correct docs) |
| D-15 | T4 owns the `resumed` route contract; T3 owns the service result | Keeps `files_owned` exclusive and the BLOCKER fix concrete | Move route edits into T3 (duplicates ownership with T4) |

## Risks & mitigations

- **2525 is also unreachable** → T9 records the failure; the feature stops and a Brevo REST API feature is required. No silent fallback (Q-5/F22).
- **Brevo credential/sender mismatch survives the port fix** → AC-11 plus the `email:test`/transactional-log/verified-sender step in § Immediate workaround; owner-owned remediation.
- **Resume becomes an account-takeover vector** → password hash verification, unverified-only, emailed token, no session, 3/hour per account; wrong password returns the same 409.
- **Resend 502 reveals existence during an outage** → accepted and recorded as the seventh supersession; unknown emails still 202; login stays generic.
- **Field errors weaken enumeration resistance** → human message stays `account already exists`; only the client sees `fields`.
- **Malformed port slips through** → strict parse and `invalid_port`; tests cover `0`, `65536`, `-1`, `587abc`, `25.5`, `' 2525'`; the CLI runs the guard before any fetch.
- **First post-merge deploy blocked** → Phase A pre-merge setting is required and recorded; the blocked-deploy fallback is documented with a re-run recovery.
- **Probe unhandled rejection or listen delay** → hook returns `undefined`, attaches both handlers, bounded by SMTP timeout; never-settling test.
- **Wrapper breaks the accepted CLI lines** → D-4 preserves the source message; `email-cli.test.ts` is required unchanged in T2/T8.
- **Docs drift/stale 587** → per-file T7 loops with exact positives/negatives for both architecture docs and README; T8 re-runs verbatim.
- **PII/token in build logs** → T7/T8/T9 guards plus placeholder-only commands; the docs-diff token guard reads added lines only and exempts exactly the documented synthetic `verify?token=cli-test`, so the required README CLI-example edit cannot false-positive while any other token value still fails; any other false positive is fixed by replacing the value, not weakening the check.
- **Owner does not run the live proof** → AC-11 keeps the feature from being green on local Mailpit alone; status records the gap.
- **Destructive cleanup temptation** → no task owns SQL; Q-1 requires explicit owner authorization.

## Task sizing notes

- **T3** is the largest task (resume, field arrays, unknown race, three token-invalidation paths, login). It stays one task because both halves edit `auth-service.ts`; splitting would duplicate `files_owned`. The builder records a size note and may make two sequential commits within the task.
- **T6** has a concrete disjoint split if needed: **T6a** owns `api.ts`, `api.test.ts`, `AuthForms.tsx`, `AuthForms.test.tsx`; **T6b** owns `VerificationPending.tsx`, `VerificationPending.test.tsx`. Both keep AC-7 and run their own coverage; they stay `[seq]` because the working tree and coverage output are shared.

## Open questions

Mirrors spec § Open questions: Q-1 (owner destructive reconciliation of U1/U2 — "delete both or keep U2"; no merge implementation), Q-2 (production guard when provisioned), Q-3 (future change-identifier/merge feature), Q-4 (U2 password availability; unauthenticated resend covers it), Q-5 (Brevo sender/domain authentication; 2525 stop condition), Q-6 (resume rate-limit bound), Q-7 (production merge ordering when provisioned). None blocks T1–T8; Q-1 and the live proof gate the exact-pair outcome.
