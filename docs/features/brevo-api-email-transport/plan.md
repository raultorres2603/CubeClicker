---
feature: brevo-api-email-transport
revision: 3
---
# Plan — Brevo HTTPS Email Transport (deployed environments)

Revision 3 (2026-11-26): aligns the plan with spec revision 3 and spec-review r2 F1–F3/F19–F23 (exhaustive stale-doc negatives and README runbook, compose top-level diff mapped to AC-10(c), `render.yaml` other-entry diff, angle-only local sender, `<commit>` evidence rule, T8 fallback/`SMTP_FROM`/`GH_REPO` markers). Builder-blocker amendment: T4 absorbs the former T5 so the catalog, guard, CLI, workflows and `render.yaml` change in one sequential task; T6/T7/T8 keep their numbers. Building-preflight clarification: the T7 repository credential audit excludes synthetic assignment fixtures in `*.test.ts`/`*.spec.ts` by path, while real Brevo/Render key-shape patterns stay strict on every path (including tests and logs), every non-test path, branch diff/history and the unconditional `.env*` check remain in force, and the feature-index check reads committed `origin/main...HEAD` changes. The 11/9/6 counts and all ACs are unchanged.

## Architecture

The feature keeps the existing `EmailService` seam and adds one transport behind it, selected at configuration time. No auth, session, token, database, WebSocket or frontend module changes.

```
process env
  │
  ├─ loadAuthConfig(env) ──► AuthConfig { emailTransport, brevoApiKey, smtpFrom, smtp* }
  │
  ├─ createEmailService(config, deps)
  │     ├─ emailTransport === 'smtp'      ──► createSmtpEmailService (unchanged, Mailpit/local)
  │     └─ emailTransport === 'brevo-api' ──► new BrevoApiEmailService({ apiKey, from, timeout })
  │
  ├─ buildApp onReady probe (non-blocking)
  │     ├─ smtp      ──► email.verify()  ──► existing smtp_transport_verify_* events
  │     └─ brevo-api ──► email.verify()  ──► GET https://api.brevo.com/v3/account
  │                                           └─ brevo_api_transport_verify_* events
  │
  └─ auth register/resend
        auth-service issues token ──► email.sendVerification(to, url, { expiresInMs })
              │                          ├─ smtp      ──► nodemailer (unchanged)
              │                          └─ brevo-api ──► POST https://api.brevo.com/v3/smtp/email
              │                                            { sender, to, subject, htmlContent, textContent }
              └─ rejection ──► EmailDeliveryError ──► auth-service invalidates the user's tokens
                                                   └─ route: 502 verification_email_failed + one warn
```

### Data flow

1. **Boot.** `loadAuthConfig` parses `EMAIL_TRANSPORT`, `BREVO_API_KEY` and the existing SMTP settings. `EMAIL_TRANSPORT` defaults to `smtp` for every `NODE_ENV`, so local and prod-image runs keep working; the deploy catalog/sync supplies `brevo-api` to the managed environments. The API transport requires a key and a parseable, non-local `SMTP_FROM`.
2. **Transport construction.** `buildApp` calls `createEmailService` once. The SMTP path delegates to the existing `createSmtpEmailService` and its injectable transport factory; the API path constructs `BrevoApiEmailService` with an injectable request seam. The old unconditional `FakeEmailService` fallback in `app.ts` is removed because `smtpHost` always has a default and the fallback was unreachable.
3. **Readiness probe.** `onReady` starts `verify()` and never awaits it. The API probe is `GET /v3/account` (key validation only; body never read). Success/failure/skip log one redacted event. `/healthz` and `listen` do not depend on it.
4. **Send.** `auth-service` issues the token, renders the branded template in `email-template.ts`, and calls the service. The API service sends `POST /v3/smtp/email` with the parsed sender, one recipient, the unchanged subject, `htmlContent` and `textContent`. Any non-2xx, timeout or transport rejection becomes `EmailDeliveryError`; `auth-service` invalidates the user's tokens and rethrows; `auth-routes` maps it to the existing fixed `502` body and one warn event with `transport`.
5. **Deploy.** The GitHub Environment is the source of truth for eleven names. The deploy CLI validates all eleven (catalog → email-transport guard → existing SMTP port guard), then `PUT`s exactly nine names to the Render service and verifies each echo. The Render hook starts the build; the startup phase parses the API transport, and the probe reports the key's validity.

### State ownership

- **GitHub Environment:** source of truth for the eleven names (seven SMTP + `EMAIL_TRANSPORT` + `BREVO_API_KEY` + `RENDER_SERVICE_ID` + `RENDER_API_KEY`).
- **Render service environment:** runtime copy of the nine synced names; `RENDER_API_KEY`/`RENDER_SERVICE_ID` never written.
- **Backend process:** transport selection, the parsed sender, the in-memory HTTP client; no new durable state.
- **Neon:** unchanged; the stale unverified account and its zero tokens are recovered by the existing resend path.
- **Brevo:** owns the API key, sender verification and delivery records; the repository never holds these values.

## Interfaces / contracts

### Auth configuration (`src/backend/src/auth/config.ts`)

```ts
export type EmailTransportKind = 'smtp' | 'brevo-api';

export interface ParsedEmailSender {
  email: string;
  name?: string;
}

/** Exported for the deploy guard; accepts bare, angle-only and display-name forms. */
export function parseEmailSender(value: string): ParsedEmailSender | null;

export interface AuthConfig {
  // existing fields unchanged …
  emailTransport: EmailTransportKind;
  brevoApiKey: string | null;
}
```

- `EMAIL_TRANSPORT` empty/unset → `smtp` for every `NODE_ENV`.
- An explicit `smtp` or `brevo-api` is honored in every `NODE_ENV`; the deployed target's `brevo-api` requirement is enforced by the deploy guard (D-1).
- Unknown value → throw the exact AC-1(e) message.
- `brevo-api` without a key → throw the exact AC-1(d) message.
- `brevo-api` sender accepted forms are bare, angle-only `<address>` and `Display Name <address>`; any other non-empty, non-whitespace value → exact AC-1(g) message; unset/empty → the existing `SMTP_FROM must be a non-empty string; received ""` before the parse error; whitespace-only → the AC-1(g) parse error. A parsed address equal to `DEFAULT_SMTP_FROM` → exact AC-1(h) message.
- `smtp` path: no behavior change; `BREVO_API_KEY` is parsed but unused.

### Email service (`src/backend/src/auth/email.ts`)

```ts
export class EmailDeliveryError extends Error {
  readonly code: 'verification_email_failed';
  readonly transport: 'smtp' | 'brevo-api';
  readonly host: string;
  readonly port: number;
  readonly errorType: string;
  readonly transportCode?: string;
  // constructor keeps the existing (source, host, port) SMTP form and accepts
  // an optional transport argument for the API path
}

export const BREVO_API_HOST = 'api.brevo.com';
export const BREVO_API_PORT = 443;
export const BREVO_API_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
export const BREVO_API_ACCOUNT_URL = 'https://api.brevo.com/v3/account';
export const BREVO_API_TIMEOUT_MS = 10_000;

export interface BrevoRequestInit {
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}
export interface BrevoResponseLike { ok: boolean; status: number; }
export type BrevoRequest = (
  url: string,
  init: BrevoRequestInit,
) => Promise<BrevoResponseLike>;

export interface EmailServiceConfig extends SmtpEmailConfig {
  emailTransport: 'smtp' | 'brevo-api';
  brevoApiKey: string | null;
}

export function createEmailService(
  config: EmailServiceConfig,
  deps?: {
    smtpTransportFactory?: SmtpTransportFactory;
    brevoRequest?: BrevoRequest;
  },
): EmailService;

export class BrevoApiEmailService implements EmailService {
  constructor(
    options: { apiKey: string; from: string; timeoutMs?: number },
    request?: BrevoRequest,
  );
  sendVerification(to, verificationUrl, options?): Promise<void>;
  verify(): Promise<void>;
}
```

- API send body keys exactly `sender`, `to`, `subject`, `htmlContent`, `textContent`; `sender` is `{ email, name? }` from `parseEmailSender(from)`; `to` is `[{ email: to }]`.
- Headers exactly `api-key`, `content-type: application/json`, `accept: application/json`; `signal` from `AbortSignal.timeout(BREVO_API_TIMEOUT_MS)`.
- Non-2xx → a source `BrevoApiError` (`name = 'BrevoApiError'`, `code = 'HTTP_<status>'`, fixed message), wrapped by `EmailDeliveryError` with `transport: 'brevo-api'`.
- Timeout → source name `TimeoutError`, fixed message, no code.
- Other rejection → source name, fixed message, no code.
- Never read a response body; never put the key/address/body in a message or field.
- `BREVO_API_TIMEOUT_MS` is asserted by value (`10000`) in `email.test.ts`; a source grep for the literal `10_000` is not acceptance evidence.
- `verify()` uses `GET /v3/account` with the same headers/timeout and the same mapping.

### Composition root (`src/backend/src/app.ts`)

```ts
export interface BuildAppOptions {
  auth?: {
    // existing seams …
    emailTransportFactory?: SmtpTransportFactory; // SMTP only
    brevoRequest?: BrevoRequest;                  // API only
  };
}
```

- `createEmailService(authConfig, { smtpTransportFactory, brevoRequest })`.
- Probe gate: `emailTransport === 'brevo-api'` → probe (key is guaranteed by config); `smtp` → existing `smtpUser && smtpPass` gate.
- Events: `brevo_api_transport_verify_ok` (info), `brevo_api_transport_verify_failed` (warn), `brevo_api_transport_verify_skipped` (debug, `{ reason: 'unsupported' }`). Existing `smtp_transport_*` events unchanged.
- No `FakeEmailService` fallback in `app.ts`; injected fakes still work through `options.auth.email`.

### Delivery logging (`src/backend/src/auth/auth-routes.ts`)

- `logDeliveryFailure` adds `transport: error.transport` to `verification_email_delivery_failed`.
- `EmailDeliveryError` mapping and the exact 502 body are unchanged.
- `auth-service.ts` is unchanged; its catch invalidates tokens for any rejection.

### Operator CLI (`src/backend/src/auth/email-cli.ts`)

- Uses `createEmailService` (default) and `EmailServiceConfig`; `deps.createService` accepts the wider config.
- API success: `Test email sent to <to> via Brevo API (api.brevo.com:443, transport=brevo-api, from="<SMTP_FROM>")`.
- API failure: `Failed to send test email via Brevo API (api.brevo.com:443): <redacted>`.
- SMTP lines unchanged.
- `redactSecrets` includes `env.BREVO_API_KEY`; existing key patterns remain.

### Deploy catalog / guard (`src/backend/src/deploy/render-env.ts`)

```ts
export const SMTP_CATALOG = [/* unchanged seven */] as const;
export const EMAIL_CATALOG = [
  { key: 'EMAIL_TRANSPORT', source: 'variable' },
  { key: 'BREVO_API_KEY', source: 'secret' },
] as const;
export const SYNC_CATALOG = [...SMTP_CATALOG, ...EMAIL_CATALOG] as const; // 9
export const RENDER_WIRING = [/* unchanged two */] as const;
export const CATALOG = [...SYNC_CATALOG, ...RENDER_WIRING] as const;       // 11

export type EmailTransportFailure =
  | { ok: false; reason: 'deployed_requires_api'; transport: string }
  | { ok: false; reason: 'unsupported_transport'; transport: string }
  | { ok: false; reason: 'smtp_key_reused' }
  | { ok: false; reason: 'local_sender' }
  | { ok: false; reason: 'invalid_sender' };

export function validateEmailTransport(
  env: Record<string, string | undefined>,
): { ok: true } | EmailTransportFailure;

export function formatEmailTransportFailure(
  environment: string,
  failure: EmailTransportFailure,
): string;
```

- `validateEmailTransport` applies only to `TARGET_ENVIRONMENT` `development`/`production`; other values return `{ ok: true }`.
- The complete production API-valid fixture (non-placeholder key, parseable non-local sender, key neither SMTP-shaped nor equal to `SMTP_PASS`) returns `{ ok: true }`; this is explicitly tested because the function applies to production.
- It runs after `validateDeployEnv` and before `validateSmtpTransportPort`.
- It uses `parseEmailSender` from `auth/config.ts`; never echoes a configured sender or key. `local_sender` means the parsed sender address equals `DEFAULT_SMTP_FROM` (bare, angle-only or display-name form).
- `BREVO_API_KEY` starting with `xsmtpsib-` or equal to `SMTP_PASS` → `smtp_key_reused`.
- `render.yaml` adds `EMAIL_TRANSPORT` and `BREVO_API_KEY` with `sync: false`, no value.

### Deploy CLI (`src/backend/src/deploy/render-env-cli.ts`)

- `buildSyncValues` projects the nine `SYNC_CATALOG` keys.
- `--check-only`: 11-value success line.
- `--dry-run`: nine lines + `11 value(s) validated ... 9 would be synced`.
- Default: nine `PUT`s, nine `SYNCED` lines, `Synced 9 value(s) ...`.
- Guard order: catalog → email transport → SMTP port.
- Usage text updated from "nine names/seven values" to "eleven names/nine values".

### Workflows

- `deploy.yml`: add `EMAIL_TRANSPORT: ${{ vars.EMAIL_TRANSPORT }}` and `BREVO_API_KEY: ${{ secrets.BREVO_API_KEY }}` to both CLI steps. No order/trigger/permission/action changes. Keep the step name `Sync Brevo SMTP settings to Render` for compatibility; document it as the nine-setting sync.
- `ci.yml`: complete development fixture adds `EMAIL_TRANSPORT: brevo-api` and `BREVO_API_KEY: fixture-key`; production placeholder fixture adds `EMAIL_TRANSPORT: brevo-api` and `BREVO_API_KEY: '<CHANGEME-brevo-api-key>'`; expected counts 11 and 6.

### Events contract

| Event | Fields | Level |
| --- | --- | --- |
| `verification_email_delivery_failed` | `route`, `transport` (`smtp`/`brevo-api`), `errorType`, optional `transportCode`, `host`, `port` | warn |
| `brevo_api_transport_verify_ok` | `host`, `port` | info |
| `brevo_api_transport_verify_failed` | `errorType`, optional `transportCode`, `host`, `port` | warn |
| `brevo_api_transport_verify_skipped` | `reason: 'unsupported'` | debug |
| `smtp_transport_verify_ok/failed/skipped` | unchanged | unchanged |

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/backend/src/auth/config.ts` | Edit | `EMAIL_TRANSPORT`, `BREVO_API_KEY`, `parseEmailSender`, fail-closed validation |
| `src/backend/src/auth/config.test.ts` | Edit | Transport default/errors, sender parser, local-default rejection, SMTP regression |
| `src/backend/src/auth/email.ts` | Edit | `EmailDeliveryError.transport`, `BrevoApiEmailService`, `createEmailService`, constants |
| `src/backend/src/auth/email.test.ts` | Edit | Exact API request, template reuse, status/timeout mapping, redaction, `verify()` |
| `src/backend/src/auth/email-cli.ts` | Edit | Transport-aware CLI, API lines, API key redaction |
| `src/backend/src/auth/email-cli.test.ts` | Edit | API success/failure/config lines, redaction, SMTP regression |
| `src/backend/src/app.ts` | Edit | Transport-aware composition and non-blocking API probe |
| `src/backend/src/app.test.ts` | Edit | Selection seams, never-settling probe, exact events, `/healthz` |
| `src/backend/src/auth/auth-routes.ts` | Edit | `transport` field on the delivery-failure event |
| `src/backend/src/auth/auth-routes.test.ts` | Edit | Exact 502, token invalidation, one warn event, resend recovery |
| `src/backend/src/deploy/render-env.ts` | Edit | Eleven-name catalog, nine-name sync, email transport guard |
| `src/backend/src/deploy/render-env.test.ts` | Edit | Catalog arrays, placeholder lists, guard truth table, exact blocks |
| `src/backend/src/deploy/render-env-cli.ts` | Edit | Counts, sync projection, guard order, usage |
| `src/backend/src/deploy/render-env-cli.test.ts` | Edit | 11 validated / 9 synced / 6 production fixtures, process boundary, precedence, no-network modes |
| `compose.yaml` | Edit | `EMAIL_TRANSPORT`/`BREVO_API_KEY` pass-throughs; Mailpit defaults |
| `compose.smoke.yaml` | Edit | Pin `EMAIL_TRANSPORT=smtp` and empty key |
| `render.yaml` | Edit | `EMAIL_TRANSPORT` and `BREVO_API_KEY` `sync: false`, no values |
| `.github/workflows/ci.yml` | Edit | Guard fixtures for the new names and counts |
| `.github/workflows/deploy.yml` | Edit | Four step env bindings for the new names |
| `README.md` | Edit | Transport contract, env table, runbook, key rotation, recovery, counts |
| `docs/architecture/email.md` | New | Canonical email transport reference (local SMTP vs deployed API) |
| `docs/architecture/deployment.md` | Edit | Catalog, counts, guard, deploy flow, production placeholders |
| `docs/architecture/vercel-render-neon.md` | Edit | Catalog rows, SMTP/email section, deploy flow, troubleshooting |
| `docs/architecture/observability.md` | Edit | API probe events, `transport` field, `HTTP_<status>` |
| `docs/architecture/containerization.md` | Edit | Compose pass-throughs; no service/image/port change |
| `docs/features/brevo-api-email-transport/build-log-T7.md` | New | Full-gate evidence |
| `docs/features/brevo-api-email-transport/build-log-T8.md` | New | Owner live-proof evidence |

No frontend source, `auth-service.ts`, `email-template.ts`, migration or Dockerfile is in the inventory. `compose.yaml`/`compose.smoke.yaml` are edited only for the two environment pass-throughs; no compose service, image, port, volume or healthcheck changes.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Brevo HTTPS API is the deployed transport: the catalog/sync supplies `brevo-api` and the guard rejects `smtp` for `development`/`production`; `EMAIL_TRANSPORT` defaults to `smtp` for every `NODE_ENV`, so local/prod-image behavior is preserved and explicit valid values are always honored | Six SMTP `EAUTH` failures are a credential-provisioning dead end; API works over 443; the guard is the deployed fail-closed layer without breaking existing local/prod-image runs | Retry SMTP credentials (owner-only, failed); make the runtime default production-aware (unnecessary churn; breaks existing production-mode tests) |
| D-2 | Keep the seven SMTP names, the SMTP service and the strict port guard in the catalog | Local Mailpit/smoke and off-Render use remain; the accepted guard contract is preserved; no dead-code removal | Remove SMTP from the deployed catalog (larger, removes local parity) |
| D-3 | Reuse `SMTP_FROM` as the API sender | One verified-sender configuration; no new name; the accepted sender contract stays | Add `BREVO_SENDER_EMAIL`/`BREVO_SENDER_NAME` (more config, same value) |
| D-4 | Add `EMAIL_TRANSPORT` (variable) and `BREVO_API_KEY` (secret); 11 validated / 9 synced. The `production` column is a code/documentation catalog (six pinned placeholders), not a live-environment claim; this feature writes no production values | Runtime needs both; GitHub stays the source of truth; the guard can fail closed; production is unprovisioned, so claiming live names would be false | Dashboard-only config (not reproducible); key in `render.yaml` (forbidden); writing the live production environment (owner-only, out of scope) |
| D-5 | Fixed 10-second API timeout (`BREVO_API_TIMEOUT_MS`), no new env name | Bounded request; matches the existing email timeout posture; fewer failure modes | `BREVO_API_TIMEOUT_MS` (more config, not requested) |
| D-6 | Fixed endpoint `https://api.brevo.com` | Prevents SSRF and accidental redirects; the provider is committed | Configurable base URL (attack surface, no need) |
| D-7 | Add `brevo_api_transport_verify_*` events; keep `smtp_transport_*`; add `transport` to the delivery-failure event | Minimal regression; API-specific naming; the shared event keeps one failure line | Rename all probe events (more churn); reuse `smtp_*` for the API (misleading) |
| D-8 | API key: a dedicated key is the acceptance default and preferred; reusing the existing interactive Brevo MCP REST key is allowed only as an explicit owner risk acceptance with coupled-blast-radius disclosure, separate rotation and least-privilege justification (Q-1) | Least privilege/independent rotation; the MCP key is an interactive credential and reuse couples runtime email to it | Require a dedicated key with no fallback (blocks the live proof if the owner cannot create one); reuse by default (weaker hygiene) |
| D-9 | Keep the deploy step name `Sync Brevo SMTP settings to Render` | Avoids churn in the accepted deploy feature; the step's behavior is documented as nine Brevo settings | Rename the step (docs/tests churn, no functional gain) |
| D-10 | Never read a Brevo response body; fixed error messages | Provider bodies can echo addresses/parameters; fixed text keeps logs and errors safe | Parse the provider `code`/`message` (PII risk) |
| D-11 | One shared build-log guard covers addresses, `verify?token=`, bare 32+ hex tokens, SMTP/Render/Brevo key shapes and YAML/shell assignments; every task applies it and T7 loops over every build log. T8 adds the owner-supplied username pattern; T7's repository audit uses the credential-only subset (no address/bare-token alternative) | A per-task partial guard let links/tokens/usernames through; one pattern keeps evidence comparable and marks logs as untrusted; the credential-only subset avoids false positives from legitimate docs addresses | Separate ad-hoc greps per task (drift, gaps); applying the address guard to docs (false positives) |
| D-12 | The `production` column is a code/documentation catalog only; no task writes the live production GitHub Environment or claims the live names exist | Production is unprovisioned; a code catalog makes future provisioning reviewable without inventing live state | Create the two production placeholders now (owner-only, outside this feature) |
| D-13 | T8 is owner-attested and not CI-reproducible; it requires redacted raw Render/Brevo excerpts and run-time `GH_REPO`/`CUBECLICKER_USERNAME_PATTERN` parameterization | CI cannot send mail or read the owner's mailbox; raw excerpts plus the shared guard make the evidence reviewable without exposing values | Treat phrase-only owner statements as sufficient (self-attestation without evidence) |

## Risks & mitigations

- **Invalid/insufficient API key** → startup probe logs `brevo_api_transport_verify_failed` with `HTTP_401/403`; sends return 502; the owner rotates the key. The managed deployment is API-only via the guard (D-1). Mitigation: key runbook + probe + exact error mapping.
- **Unverified sender** → the probe can pass (account valid) while send returns `400`; the route returns 502. Mitigation: deployment guard rejects a local/unparseable sender; documentation requires the Brevo-verified sender; the owner checks the Brevo sender page.
- **Provider response body leaks PII into logs** → the service never parses a body; fixed messages; tests feed a body containing a synthetic address/key and assert absence.
- **Key accidentally logged/committed** → secret-only env, no echo, fixed messages, the shared build-log guard (including YAML `BREVO_API_KEY:` assignments), and the repository credential guard. Mitigation: no value in argv, UI/stdin only, redacted logs.
- **MCP-key reuse couples runtime email to the owner's interactive credential** → a dedicated key is the acceptance default and preferred; the fallback is allowed only with explicit owner risk acceptance, coupled-blast-radius disclosure and a separate rotation/least-privilege plan. Mitigation: record the acceptance in T8 and keep the dedicated-key path the default.
- **Live production-state claim** → the production column is a code/documentation catalog only; no task writes the live `production` environment. Mitigation: the F12 qualification in the spec, docs and T8.
- **Owner-attested proof cannot be reproduced by CI** → T8 is explicitly owner-attested; it requires redacted raw Render/Brevo excerpts (`Render excerpt`, `Brevo excerpt`, `resend response`) and run-time `GH_REPO`/username parameterization. Mitigation: the shared guard plus raw excerpts; the reviewer checks the excerpts, not just phrases.
- **Deployed SMTP regression** → the deploy guard rejects `smtp` for `development`/`production`; the runtime default is `smtp` for local compatibility, and the port guard remains.
- **First post-merge deploy blocked because the owner has not set the values** → AC-13(a) requires the two `development` values before merge. If missed, the first Deploy fails closed at the guard, the owner sets them and re-runs, and T8 records the `AC-11(a) deviation`; AC-11(a) is not claimed as met.
- **Brevo rate limit (429)** → maps to `HTTP_429` → 502 + resend; verification volume is low; plan upgrade is owner-owned.
- **Coverage regression** → every behavior task adds tests and runs the workspace coverage gate; no exclusion. T7 also asserts the coverage config is unchanged.
- **Docs drift** → the exact positive sentence and stale negatives in T6/T7; no claim that SMTP is the deployed transport; the feature index stays orchestrator-owned.

## Open questions

- Q-1 — dedicated API key is the acceptance default and preferred; reuse of the interactive MCP REST key only as an explicit owner risk acceptance with coupled-blast-radius disclosure and separate rotation/least-privilege justification (owner; not a build blocker).
- Q-2 — production transport when provisioned (owner; the production catalog is code/documentation only and the environment is unprovisioned).
- Q-3 — sender/domain authentication (owner; active sender now, verified domain recommended).
- Q-4 — retire the SMTP names from the deployed catalog later (owner; kept for parity/defense now).
- Q-5 — live-proof recipient/account access (owner; the stale unverified account).
- Q-6 — Brevo plan/limit (owner; 300/day free).

See `spec.md` § Open questions for the full wording and recommendations.
