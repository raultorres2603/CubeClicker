# Email Transport

CubeClicker sends verification email through one of two transports, selected explicitly by `EMAIL_TRANSPORT`: the local/off-Render **SMTP** path (Mailpit in `podman compose up`) or the deployed **Brevo HTTPS Transactional Email API** on port `443`. Development and production deliver verification email through the Brevo HTTPS API on port 443; SMTP remains the local/off-Render transport. Registration, resend, token invalidation and the branded template are shared by both transports; only delivery changes.

The application stack is decided in [stack](stack.md), the delivery path in [containerization](containerization.md), the deployment target in [deployment](deployment.md), and the runtime log/event contract in [observability](observability.md).

## Transport selection

| Name | Local (`podman compose up`) | Deployed `development` / `production` | Rule |
| --- | --- | --- | --- |
| `EMAIL_TRANSPORT` | `smtp` (default) | `brevo-api` | Unset or empty means `smtp` for every `NODE_ENV`; only `smtp` and `brevo-api` are accepted, and the deploy guard requires `brevo-api` for `development`/`production` |
| `BREVO_API_KEY` | unset | secret | Required and non-empty exactly when `EMAIL_TRANSPORT=brevo-api`; a Brevo **REST API key**, never the SMTP key |
| `SMTP_FROM` | `no-reply@cubeclicker.local` | Brevo-verified sender | Sender for both transports; the API path requires a parseable address or `Display Name <address>` and rejects the local Mailpit default |
| `SMTP_HOST` … `SMTP_CONNECTION_TIMEOUT_MS` | Mailpit defaults (`mailpit`, `1025`) | catalogued, synced, unused by the API transport | The existing SMTP contract and the strict port guard remain in force |
| `APP_BASE_URL` | `http://localhost:5173` | frontend origin | Drives the verification link and the email image URLs |

- `smtp` is the default for every `NODE_ENV`, including `NODE_ENV=production`, so a local or off-Render run that sets no transport keeps working. A deployed environment sets `brevo-api` through the deploy catalog/sync, and the deploy guard fails closed on an unset/`smtp`/unknown value before any Render call.
- `BREVO_API_KEY` is read only from `process.env`, is sent only in the `api-key` request header over HTTPS, and is never a URL/query parameter, a body value, a `render.yaml` value, an image layer or a client value.
- `SMTP_FROM` is reused as the API sender: the parsed display name becomes the Brevo `sender.name` and the parsed address becomes `sender.email`. No `BREVO_SENDER_*` name exists.

## Brevo HTTPS API request

The service performs exactly one request shape for a send:

```text
POST https://api.brevo.com/v3/smtp/email
api-key: <BREVO_API_KEY>
content-type: application/json
accept: application/json
```

The JSON body has five keys built in-process from the branded template:

| Body key | Source |
| --- | --- |
| `sender` | `{ email, name? }` parsed from `SMTP_FROM` |
| `to` | `[{ email: <recipient> }]` |
| `subject` | `Verify your CubeClicker email` (unchanged) |
| `htmlContent` | the branded HTML template |
| `textContent` | the unchanged plain-text body |

- The endpoint is the fixed `https://api.brevo.com`; there is no base-URL environment override, so the request cannot be redirected to an arbitrary host. TLS certificate verification stays enabled. Render terminates TLS and forwards the outbound HTTPS request on port `443`, which Render free does not block.
- No attachments, CID parts, `replyTo`, templates, campaigns, contacts, webhooks, tracking or unsubscribe flow are added; the message content is the same one the SMTP transport sends.
- The response body is never read or parsed. The client consumes only `ok` and `status`, because a Brevo error body can echo the recipient address or request values.

### Timeout

`BREVO_API_TIMEOUT_MS` is the fixed `10000` ms bound applied with `AbortSignal.timeout` to both the send request and the account probe. It is a source constant, not an environment variable: there is no new configuration name for it, and `SMTP_CONNECTION_TIMEOUT_MS` continues to bound the SMTP transport only. A request that exceeds `10000` ms rejects with the fixed `Brevo API request timed out after 10000ms` message.

### Probe

A non-blocking `onReady` probe verifies the key by calling `GET https://api.brevo.com/v3/account` with the same `api-key` header and timeout. It starts but is never awaited, so `listen` and `GET /healthz` never wait on Brevo; a never-settling probe still serves health. The probe does not read the account body.

## Error mapping

| Condition | Fixed error message | `errorType` | `transportCode` | Route result |
| --- | --- | --- | --- | --- |
| Non-2xx response | `Brevo API responded with HTTP <status>` | `BrevoApiError` | `HTTP_<status>` | HTTP `502`, code `verification_email_failed` |
| Timeout | `Brevo API request timed out after 10000ms` | `TimeoutError` | absent | HTTP `502`, code `verification_email_failed` |
| Network/other rejection | `Brevo API request failed` | source error name or `unknown` | absent | HTTP `502`, code `verification_email_failed` |

- `transportCode` is `HTTP_<status>` for API failures (for example `HTTP_429` or `HTTP_401`) and only leaves the process when it matches the provider-code whitelist `/^[A-Z0-9_]{1,40}$/`. Brevo response bodies, provider messages and stacks are never copied into a field or a log line.
- A failed send leaves the account persisted and unverified, invalidates the just-issued verification token and returns the same 502 envelope as the SMTP path; a later resend issues a fresh token. `auth-service.ts`, the 502 body, the resend behavior and the frontend are unchanged.
- The API key is never logged, committed, baked into an image or sent to the client. Error messages are fixed strings, and the CLI redacts configured credential values plus `xkeysib-…`/`xsmtpsib-…` shaped tokens before printing.

## Events

The probe and the shared delivery-failure event use the same field discipline as the SMTP path; see [observability](observability.md) § Email delivery events.

| Event | Fields | Level |
| --- | --- | --- |
| `brevo_api_transport_verify_ok` | `host` (`api.brevo.com`), `port` (`443`) | info |
| `brevo_api_transport_verify_failed` | `errorType`, optional string `transportCode`, `host`, `port` | warn |
| `brevo_api_transport_verify_skipped` | `reason: 'unsupported'` | debug |
| `verification_email_delivery_failed` | `route`, `transport` (`smtp` or `brevo-api`), `errorType`, optional string `transportCode`, `host`, `port` | warn |

- A register or resend failure emits exactly one `verification_email_delivery_failed` line; the probe catches its own rejection and logs `brevo_api_transport_verify_failed`, so neither path produces an unhandled rejection and neither changes `/healthz`.
- The API path always probes because configuration guarantees a key; the SMTP path keeps its credential gate and `smtp_transport_*` events (Mailpit is unauthenticated and skips the probe).
- No email, username, account id, token, key, message or stack is logged. `host` and `port` are configuration constants, not provider output.

## Key creation, rotation and redaction

- **Create.** A dedicated key is preferred. The owner creates the Brevo REST API key under **Settings → SMTP & API → API Keys** and stores it as the `BREVO_API_KEY` GitHub Environment secret (UI or stdin). The SMTP key under **Settings → SMTP & API → SMTP** cannot authenticate the API; reusing the interactive MCP key is allowed only as an explicit owner risk acceptance with its own rotation and least-privilege justification.
- **Store.** `BREVO_API_KEY` is a secret, declared `sync: false` with no value in `render.yaml`, passed to the CLI through step-level `env:` from `secrets.*`, and written to the Render service by the sync. It is never a service value committed to git and never an image or bundle input.
- **Rotate.** To rotate, create a replacement key under Settings → SMTP & API → API Keys, update the `BREVO_API_KEY` GitHub Environment secret, re-run **Deploy**, confirm `brevo_api_transport_verify_ok`, then revoke the old key. The sync and the new instance pick up the replacement; the old key stops working only after revocation.
- **Redact.** Logs and failure output never contain the key or a provider body; build logs use `<address>`, `<owner-address>` and `<CHANGEME-brevo-api-key>` placeholders, and the shared build-log guard rejects key-shaped material and credential assignments. The API key is never logged, committed, baked into an image or sent to the client.

## Local Mailpit and the container network

- Local `podman compose up` defaults to `EMAIL_TRANSPORT=smtp`, `SMTP_HOST=mailpit` and `SMTP_PORT=1025`; the Mailpit UI is at `http://localhost:8025`. `compose.smoke.yaml` pins the same transport/host/port and an empty `BREVO_API_KEY`, so a host export cannot redirect the smoke run to Brevo.
- `Mailpit` is unchanged by this feature: the SMTP service, `nodemailer`, the strict SMTP port guard and the `smtp_transport_*` events remain for local and off-Render use. A paid or self-hosted SMTP deployment can still select `smtp` explicitly; only the managed `development`/`production` guard requires the API.
- `compose.yaml` gained only the `EMAIL_TRANSPORT` (default `smtp`) and `BREVO_API_KEY` (default empty) pass-throughs on the existing backend service. No new service, image, port, volume, healthcheck or WebSocket endpoint was added. The backend still serves `GET /ws` on port `8080` and `GET /healthz` unchanged.

## Deploy validation, recovery and supersession

- **Catalog.** The deploy CLI validates eleven names (seven variables, four secrets): the seven SMTP names, `EMAIL_TRANSPORT`, `BREVO_API_KEY`, `RENDER_SERVICE_ID` and `RENDER_API_KEY`. It syncs nine (the seven SMTP names plus `EMAIL_TRANSPORT` and `BREVO_API_KEY`); the two `RENDER_*` wiring names are never written to the service. A missing value or a `CHANGEME` placeholder blocks the deploy before the Neon migration and before any Render call.
- **Guard.** For `development`/`production` the guard requires `EMAIL_TRANSPORT=brevo-api`, rejects an unknown transport, rejects a `BREVO_API_KEY` that is the SMTP key or equals `SMTP_PASS`, and rejects an unparseable or local Mailpit `SMTP_FROM`. It never echoes a sender or a key. The strict SMTP port guard remains as defense in depth even though the API transport ignores the SMTP relay.
- **Recovery.** On HTTP `502` with code `verification_email_failed`, confirm `EMAIL_TRANSPORT=brevo-api` and a REST API key from **Settings → SMTP & API → API Keys**, re-run **Deploy**, check the probe event and resend. The account stays persisted and unverified until a resend issues a fresh token and the link is opened. No account deletion, merge or SQL is part of the recovery.
- **Production.** The production environment is provisioned and uses the same Brevo HTTPS API transport: `EMAIL_TRANSPORT=brevo-api`, a Brevo **REST API key** stored as the `production` Environment's `BREVO_API_KEY` secret, and the Brevo-verified `SMTP_FROM` variable. The live production deploy proved the transport with `brevo_api_transport_verify_ok`, the eleven-name guard line and the nine-name sync to the production Render service; the production values live in the `production` Environment and are synced from there on every deploy. A production delivery failure follows the same 502/resend recovery path as development.
- **Supersession.** This feature supersedes the SMTP delivery recipe for deployed environments: development and production move from Brevo SMTP on `2525` to the HTTPS API on `443`. The SMTP transport code, Mailpit capture and the SMTP configuration remain for local/off-Render use. It also consumes the blocked Phase B of `registration-account-exists` T9/AC-11: the API probe and a live API delivery replace the SMTP probe/delivery evidence, the earlier sync evidence is retained, and the T9 pre-merge ordering is recorded as a deviation rather than claimed closed.

## See also

- [deployment](deployment.md) — target, catalog, deploy flow and rollback.
- [vercel-render-neon](vercel-render-neon.md) — environment catalog and runbook.
- [observability](observability.md) — event and field contract.
- [containerization](containerization.md) — compose pass-through conventions.
- [brevo-api-email-transport spec](../features/brevo-api-email-transport/spec.md) — acceptance criteria and supersession ledger.
