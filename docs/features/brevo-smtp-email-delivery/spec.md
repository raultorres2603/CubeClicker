---
feature: brevo-smtp-email-delivery
revision: 4
status: draft
created: 2026-11-20
updated: 2026-11-21
---
# Spec — Brevo SMTP Email Delivery & Branded Verification Email

## Summary

Make Brevo the SMTP provider that delivers CubeClicker account-verification email in the `development` and `production` environments, while local `podman compose up` keeps using Mailpit unchanged. The application already has a provider-neutral SMTP email service (`nodemailer`), `SMTP_HOST/PORT/USER/PASS/FROM` parsing, and a containerized Mailpit-backed smoke test; what is missing for a real-TLS provider is an explicit TLS mode, bounded connection/greeting/socket timeouts, fail-fast validation of the credential pair, an operator-facing delivery check that never echoes credentials, and the documentation/deployment catalog updates that let an operator supply the Brevo host, SMTP login and **SMTP key** without committing or logging them. The user's "API Key" is a Brevo REST API key; Brevo's SMTP relay authenticates with the SMTP login plus an **SMTP key** (Settings → SMTP & API → SMTP), which is a different credential. This feature implements the SMTP path only; it does not add a Brevo REST API integration.

The same feature replaces the plain HTML fragment in the verification email with a branded, table-based, inline-CSS-only game shell (dark void, cyan/emerald palette, metallic/neon frame motifs, starfield hero, prominent CubeClicker wordmark, one CTA, a visible fallback URL, an accurate expiry note and a footer) while keeping the existing plain-text body byte-for-byte. The game ships no committed logo/icon assets and its visuals are procedural (three.js), so the feature authors new raster PNG brand assets for email from a committed, dependency-free Node script (deterministic, regenerable, `--check`-verifiable). Images are referenced by public URL from `src/frontend/public/email/` (served by Vite locally, nginx in the prod image, Vercel in deployment), not CID attachments; the verification link and the raw URL remain visible when images are blocked. No web fonts, external stylesheets, `<svg>` or `<script>` are used, and no new dependency or build step is introduced.

Before implementation the repository's own OpenCode configuration is sanitized in a dedicated pre-build task (T0): the Brevo MCP credential moves to the user-owned global config under `~/.config/opencode/`, and the tracked repo-level `opencode.jsonc` keeps a reference-only Brevo entry shaped like the other MCP entries. The repository never carries the credential.

## Context and current state

### What exists today

- `src/backend/src/auth/config.ts` parses `SMTP_HOST` (default `mailpit`), `SMTP_PORT` (default `1025`), `SMTP_USER`/`SMTP_PASS` (optional, empty = unset), and `SMTP_FROM` (default `no-reply@cubeclicker.local`). It has no TLS-mode, timeout, or user/pass pairing validation.
- `src/backend/src/auth/email.ts` implements `SmtpEmailService` with `nodemailer`; `secure` is `options.secure ?? port === 465`, auth is enabled only when both user and pass exist, and there is no `requireTLS`, no timeout, and no transport-option factory seam. `renderVerificationEmail` returns a three-paragraph HTML fragment with no layout, brand, images or expiry note; the plain-text body carries the activation URL.
- `src/backend/src/app.ts` constructs `SmtpEmailService` inline from `AuthConfig` (no factory, no test seam); `app.test.ts` has no SMTP-related test.
- No logo/icon/brand asset is committed anywhere under `src/` (`**/*.{png,jpg,jpeg,webp,svg,ico,gif}` finds none) and there is no `src/frontend/public/` directory yet; the game's visuals are procedural three.js, so email brand assets must be authored for this feature. The game's palette/motifs live in `src/frontend/src/ui/theme.ts` and `src/frontend/src/ui/app.css` (void `#04060d`, cyan `#7cf6ff`, emerald `#34d399`, text `#e8f6ff`, translucent glass panels, cyan rim, starfield backdrop); those UI files are read-only inputs and must not change. The opaque solids the email needs for clients that drop alpha (`#0a1222`, `#2b4a63`, `#1d3b52`, `#a9c2d8`, `#04120c`) are **email-safe derivations**, not game literals.
- `compose.yaml` runs Mailpit and passes `SMTP_HOST/PORT/USER/PASS/FROM` with Mailpit defaults; `tests/e2e/smoke.mjs` registers an account, reads the verification mail from Mailpit and verifies the account. `compose.smoke.yaml` does not yet pin the smoke backend's SMTP values, so host `SMTP_*` exports can leak in.
- `render.yaml` and the GitHub `development` Environment catalog already carry `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (Render: `sync: false`; GitHub: one secret plus runtime-parity variables). Development is documented as **guest-only** because the SMTP values are placeholders (`README.md` § User-side asset checklist, `docs/architecture/deployment.md`, `docs/architecture/vercel-render-neon.md` § Environment catalog / SMTP and email / Local development vs cloud).
- Planning-time read-only inspection of the linked Brevo account (no writes) shows the relay is enabled at `smtp-relay.brevo.com:587`, with an account-specific SMTP login in `<id>@smtp-brevo.com` form, a free plan limited to 300 emails/day, and one active sender (a personal mailbox). The SMTP key itself is not readable through the API and remains user-owned.
- `opencode.jsonc` is tracked at the repository root. Its planning-time working copy carries an uncommitted Brevo REST API key in the Brevo MCP header; the committed revision on `main` does not, and the repository owner states the key was **never pushed**. `.gitignore` cannot protect a tracked file, so the fix is structural, not an ignore rule: the credential belongs in the global OpenCode config (`~/.config/opencode/`), and the tracked file keeps only a secret-free reference.

### What is missing for a real-TLS provider

1. No `SMTP_SECURE` (implicit TLS) control and no STARTTLS enforcement: a configuration with credentials can fall back to cleartext if the server does not advertise STARTTLS, and a non-465 implicit-TLS port cannot be expressed.
2. No bounded connection/greeting/socket timeout: `nodemailer` defaults are 120 s / 30 s / 10 min, so an unreachable or stalled provider can hang registration far longer than acceptable.
3. No fail-fast pairing rule: setting only `SMTP_USER` or only `SMTP_PASS` silently disables auth and fails later with a confusing server error.
4. No operator-facing way to prove delivery with the real configuration, and no guarantee that a transport error cannot echo the credential.
5. No Brevo recipe, no distinction between the REST API key and the SMTP key, no verified-sender guidance, and deployment docs still describe email as guest-only.
6. The Mailpit smoke test is not insulated from host `SMTP_*` exports, and an already-running backend from a plain `podman compose up` can be reused by `compose run`.
7. The verification email has no game identity: no wordmark, no hero/logo art, no CTA button, no expiry note, no preheader and no email-safe layout or image strategy. No brand assets exist to reuse and no authoring source is recorded.
8. The repository-level MCP configuration carries a live credential in a tracked file, and no mechanical guard prevents a key pattern from being committed again.

## User stories

- As a registrant, I want the verification email to arrive in my real inbox so I can activate my account in development or production.
- As a registrant, I want the verification email to look like it comes from CubeClicker — recognizable game art, a clear button and a fallback link — so I trust it and can act even with images blocked.
- As the operator, I want to set the Brevo host, TLS mode, SMTP login and SMTP key through environment configuration, and to prove delivery with one command before/after deploying.
- As the operator, I want a misconfigured SMTP setup to fail fast with a message naming the variable, and I never want the credential printed or committed.
- As a developer, I want `podman compose up` and Mailpit to keep working with unchanged defaults, so local development never needs Brevo.
- As the repository owner, I want the Brevo MCP credential to live in my global OpenCode config while the committed repo file only references the server, so no key can leak through the repository.

## Acceptance criteria

Clause suffixes (`AC-12(c)`) identify the part a single task can prove; the final verification task (T9) covers every whole AC. Units: **1 KiB = 1024 bytes**; the spec never uses decimal "KB".

- **AC-1 — TLS mode parses with a Mailpit-safe default.** `loadAuthConfig` exposes `smtpSecure: boolean`. With `SMTP_SECURE` unset or empty it is `true` exactly when the effective `SMTP_PORT` is `465` (default port `1025` → `false`; `SMTP_PORT=465` → `true`). `SMTP_SECURE=true|1` and `SMTP_SECURE=false|0` override the derivation regardless of port. Evidence: `config.test.ts` exact assertions for all five cases.

- **AC-2 — Timeout parses.** `loadAuthConfig` exposes `smtpConnectionTimeoutMs`, default `10000` (`DEFAULT_SMTP_CONNECTION_TIMEOUT_MS`), accepting integers from `1000` to `120000` inclusive. Evidence: `config.test.ts` exact values at both boundaries and the default.

- **AC-3 — Invalid SMTP settings fail fast.** `SMTP_SECURE=yes` throws `SMTP_SECURE must be a boolean ("true", "false", "1", or "0"); received "yes"`; a non-integer, empty, `999` or `120001` `SMTP_CONNECTION_TIMEOUT_MS` throws `SMTP_CONNECTION_TIMEOUT_MS must be an integer between 1000 and 120000; received "<value>"`. The error is thrown by `loadAuthConfig`, and `buildApp` throws the same error (so `server.ts` exits non-zero before listening). Evidence: `config.test.ts` (parse errors), `app.test.ts` (composition-root propagation).

- **AC-4 — Credential pairing is validated.** An environment with exactly one of `SMTP_USER`/`SMTP_PASS` set throws `SMTP_USER and SMTP_PASS must be provided together (both or neither)` from `loadAuthConfig`; both set (including non-empty) or both unset/empty are accepted. Evidence: `config.test.ts`.

- **AC-5 — Transport options are pinned and the composition root uses the factory.** `buildSmtpTransportOptions` returns exactly `{ host: 'smtp-relay.brevo.com', port: 587, secure: false, requireTLS: true, auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000 }` for the Brevo 587 recipe; `{ secure: true, requireTLS: false }` for `SMTP_SECURE=true` on 465; and `{ host: 'mailpit', port: 1025, secure: false, requireTLS: false, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000 }` with **no `auth` property** for Mailpit defaults. All three timeout fields receive the same `SMTP_CONNECTION_TIMEOUT_MS` value (a `2500` override yields `2500` in all three). `createSmtpEmailService` passes the built object to the injected transport factory exactly once. `buildApp` accepts a test seam `options.auth.emailTransportFactory` and constructs its `SmtpEmailService` through `createSmtpEmailService(authConfig, factory)` (no inline option mapping); `app.test.ts` asserts the factory was called exactly once with the exact Brevo transport object derived from `AuthConfig`. Evidence: `email.test.ts` exact-object assertions; `app.test.ts` factory-seam assertion.

- **AC-6 — Mailpit defaults are unchanged.** With an empty environment, `loadAuthConfig` returns `smtpHost: 'mailpit'`, `smtpPort: 1025`, `smtpSecure: false`, `smtpUser: null`, `smtpPass: null`, `smtpFrom: 'no-reply@cubeclicker.local'`, `smtpConnectionTimeoutMs: 10000`, and the built transport is plaintext with no auth and no STARTTLS requirement. Evidence: `config.test.ts`, `email.test.ts`.

- **AC-7 — Email content boundaries.** The plain-text body remains byte-for-byte the existing body (same subject `Verify your CubeClicker email`, same greeting/link/ignore text); the HTML body is replaced by the branded template specified in AC-15…AC-19. `SMTP_FROM='CubeClicker <no-reply@example.com>'` is passed verbatim as `sendMail.from`; `sendMail` receives exactly `{ from, to, subject, text, html }` (no `replyTo`, no `attachments`). Evidence: `email.test.ts`, `email-template.test.ts`.

- **AC-8 — Test-email CLI succeeds.** `runEmailTestCli(['--to', 'user@example.com'], brevoEnv, { createService })` returns `0`, sends exactly one message to `user@example.com` with the pinned verification subject, and writes exactly `Test email sent to user@example.com via smtp-relay.brevo.com:587 (secure=false, starttls=required, auth=yes, from="no-reply@example.com")`; when `SMTP_FROM` is the local default it also writes `Warning: SMTP_FROM is the local default; set it to a verified sender before real delivery.` The output never contains the SMTP user or the SMTP key. Evidence: `email-cli.test.ts` exact lines.

- **AC-9 — Test-email CLI failures are explicit, redacted and non-sending.** Missing `--to` prints `Missing required option: --to <address>` plus usage and returns `1`; an invalid address prints `Invalid recipient address: "<value>"` and returns `1`; an unknown option prints `Unknown option: <option>` and returns `1` — in all three cases no service/transport is constructed. `--help` prints usage and returns `0`. A transport rejection returns `1` and prints `Failed to send test email via smtp-relay.brevo.com:587: <sanitized message>`; a config error returns `1` and prints `Invalid email configuration: <sanitized message>`. `redactSecrets(text, secretValues)` replaces every occurrence of each configured `SMTP_USER`/`SMTP_PASS` value and of every `xkeysib-[A-Za-z0-9]{20,}` / `xsmtpsib-[A-Za-z0-9]{15,}` match with `[redacted]`. With `smtpUser = 'cli-user@example.com'`, `smtpPass = 'cli-pass-9f3a'` and a rejection message carrying both values plus a REST-key-shaped token (assembled in the test as `'xkeysib-' + 'a'.repeat(24)`), the printed line is exactly `Failed to send test email via smtp-relay.brevo.com:587: 535 authentication failed for [redacted] ([redacted]) with [redacted]`, the exit code is `1`, and the output contains neither credential value nor the token. A second rejection whose message carries a short SMTP-key-shaped token (assembled as `'xsmtpsib-' + 'b'.repeat(15)`) prints `[redacted]` instead of the token and still returns `1`. Evidence: `email-cli.test.ts`.

- **AC-10 — Registration delivery failures surface without corrupting state.** When the email transport rejects during `POST /auth/register`, the route returns HTTP `500` with `{ message: 'internal error', code: 'internal_error', error: 'internal_error' }`; the account remains persisted and unverified; once the transport recovers, `POST /auth/resend-verification` returns `202` and sends a new email. Evidence: `auth-routes.test.ts`, `auth-service.test.ts`.

- **AC-11 — Local Mailpit path is hermetic and unchanged.**
  (a) `compose.smoke.yaml` pins the smoke backend to `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, empty `SMTP_USER`/`SMTP_PASS`, `SMTP_FROM=no-reply@cubeclicker.local`, `SMTP_SECURE=false`; the merged smoke config, evaluated under a hostile host environment (`SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER`/`SMTP_PASS` set, `SMTP_SECURE=true`), still resolves those six Mailpit values. With the host SMTP variables unset and the compose interpolation file bypassed (`env -u SMTP_HOST -u SMTP_PORT -u SMTP_USER -u SMTP_PASS -u SMTP_SECURE -u SMTP_FROM -u SMTP_CONNECTION_TIMEOUT_MS podman compose --env-file /dev/null -f compose.yaml config` parsed by the pinned Node assertion), the plain compose backend environment also resolves `SMTP_HOST=mailpit`, `SMTP_PORT=1025`.
  (b) The hostile-environment proof starts from a clean stack (`podman compose -f compose.yaml -f compose.smoke.yaml down --remove-orphans`), starts only Mailpit, then runs `SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_USER=hostile SMTP_PASS=hostile SMTP_SECURE=false npm run smoke`, which exits `0` with every check PASS. Evidence: raw commands and output in `build-log-T7.md` (a) and `build-log-T9.md` (b).

- **AC-12 — Repository and deployment credential safety.**
  (a) `render.yaml` declares `SMTP_SECURE` and `SMTP_CONNECTION_TIMEOUT_MS` (plus the existing SMTP names) with `sync: false` and no `value`; the parse command passes.
  (b) The feature branch diff (`git diff origin/main...HEAD`), branch history (`git log -p origin/main..HEAD`), tracked tree (`git grep`) and untracked files (`git grep --untracked`) contain no `xsmtpsib-[A-Za-z0-9]{15,}` or `xkeysib-[A-Za-z0-9]{20,}` match and no `SMTP_USER=`/`SMTP_PASS=` assignment whose value is 12 or more credential characters; the branch history adds no `.env*` file. The audit commands use `grep -q`/`git grep -q` and print no matches.
  (c) `opencode.jsonc` stays tracked and is sanitized by T0. The repo schema is `mcp.servers.{vercel,Neon,brevo}`; the check resolves `cfg.mcp?.servers ?? cfg.mcp ?? cfg.mcpServers`, iterates the actual entry map, and asserts exactly one case-insensitive `brevo` entry whose key set equals both `vercel`'s and `Neon`'s (`type`/`url`) and which has no `headers` and no key pattern. The global config (`~/.config/opencode/opencode.json` or `opencode.jsonc`) uses the `mcp.{...}` schema; the same traversal asserts exactly one `brevo` entry carrying `headers.Authorization` that matches the key pattern, and the global path must exist (exactly one candidate). Both checks print entry names and the global path only — never values. T0's build log records count-only greps, `--numstat`, and the key-path-only diff.
  (d) No commit in the feature range touches `.env*`, and no key pattern appears in any build log (`docs/features/brevo-smtp-email-delivery/build-log-*.md`).
  Evidence: the pinned T0/T7/T9 commands below.

- **AC-13 — Documentation matches shipped behavior.** `README.md` lists `SMTP_SECURE` (default: derived, `true` on 465) and `SMTP_CONNECTION_TIMEOUT_MS` (default `10000`) and contains a Brevo subsection naming `smtp-relay.brevo.com`, ports `587` (STARTTLS) and `465` (implicit TLS), **Settings → SMTP & API → SMTP**, **SMTP key** and the phrase **not the REST API key**, verified sender, and the CLI commands. `docs/architecture/deployment.md` and `docs/architecture/vercel-render-neon.md` catalogs list both new names, describe `SMTP_PASS` as the Brevo SMTP key, and no longer state that development email is guest-only or that the SMTP values are placeholders — including `README.md` line 183 at review time (`§ User-side asset checklist`). `docs/architecture/vercel-render-neon.md` § Local development vs cloud no longer claims the compose files are untouched: it states that `compose.yaml` gains the two SMTP pass-throughs and `compose.smoke.yaml` pins the smoke backend to Mailpit (line 251 at review time). `docs/architecture/containerization.md` § Frontend static delivery likewise no longer claims `compose.yaml` is untouched. `README.md` also carries a short **Secret hygiene** note with the key-pattern guard command. Evidence: exact greps in T8's verify.

- **AC-14 — Manual live-delivery check is documented and user-owned.** `README.md` documents the user-run check with exact commands — `podman compose exec backend npm run email:test -w @cubeclicker/backend -- --to <address>` and `node dist/auth/email-cli.js --to <address>` in a built image — plus the expected success line (`Test email sent to`) and prerequisites (SMTP login, SMTP key, verified sender). The README contains those literal command fragments (`podman compose exec backend`, `node dist/auth/email-cli.js`) and is marked user-owned; no automated test or CI job contacts Brevo. Evidence: exact greps in T8's verify; the user may record the redacted run in the feature build log.

- **AC-15 — Branded HTML shell is email-safe and palette-pinned.** `renderVerificationEmail` returns an HTML document with a 600px-wide, table-based shell in which every `<table>` carries `role="presentation"`, all CSS is inline (no `<style>`, `<link>`, `@import` or `@font-face`), and the pinned palette literals appear: `#04060d` (void; game literal), `#0a1222` (surface; opaque equivalent of the game's translucent panel), `#7cf6ff` (cyan; game literal), `#34d399` (emerald; game literal), `#e8f6ff` (text; game literal), `#a9c2d8` (muted; email-safe solid derivation of the game's `rgba(232,246,255,0.76)`), `#2b4a63` (metallic; email-safe solid derivation of the game's glass-panel fill), `#1d3b52` (border; email-safe solid derivation) and `#04120c` (CTA ink; email-safe solid derivation). No other `#rrggbb` literal appears in the HTML. It contains the preheader `Your CubeClicker verification link is inside — verify your email to start playing.`, the headline `Verify your CubeClicker account`, exactly one anchor with `id="verify-cta"` whose `href` is the HTML-escaped verification URL and whose text is `Verify email`, a visible fallback URL equal to the verification URL, the AC-19 expiry sentence, and the footer `CubeClicker — an online cube-clicking game.` It contains no `<script`, `<svg`, external stylesheet, web font or CSS `url(`. Evidence: `email-template.test.ts` exact substring, count, palette-whitelist and regex assertions.

- **AC-16 — Public-URL asset strategy with an image-blocked fallback and serving proof.**
  (a) The HTML references exactly two images, `${origin}/email/cubeclicker-hero.png` and `${origin}/email/cubeclicker-cube.png`, where `origin` is derived from the verification URL (`APP_BASE_URL`), with `alt="CubeClicker"` and `alt="CubeClicker cube"` and explicit width/height attributes. The `sendMail` call has no `attachments` and no CID URL. The CTA is a text/background button and the raw URL is visible, so verification remains actionable when images are blocked.
  (b) The two assets are committed at `src/frontend/public/email/cubeclicker-hero.png` and `src/frontend/public/email/cubeclicker-cube.png`; no build step is required.
  (c) Proven local serving: from the compose network, `GET http://frontend:5173/email/cubeclicker-hero.png`, `GET http://frontend:5173/email/cubeclicker-cube.png`, `GET http://frontend-prod:8080/email/cubeclicker-hero.png` and `GET http://frontend-prod:8080/email/cubeclicker-cube.png` each return `200`, a `content-type` beginning with `image/png`, and the 8-byte PNG signature `89 50 4e 47 0d 0a 1a 0a`; raw output in `build-log-T9.md`.
  (d) Documented deployed-origin recipe (not executed by automation): `README.md` or `docs/architecture/vercel-render-neon.md` gives the user-run check `curl -fsSI https://<frontend-host>/email/cubeclicker-hero.png` and its expected `200` + `content-type: image/png`, marked literally `documented-not-run` because the development frontend deploy is user-triggered and production is unprovisioned.
  (e) Fallback: `emailAssetUrls('/verify?token=x')` and `emailAssetUrls('not a url')` return exactly `{ hero: '/email/cubeclicker-hero.png', cube: '/email/cubeclicker-cube.png' }`; rendering with such a URL does not throw and the HTML still carries the CTA and the visible raw URL. Evidence: `email-template.test.ts` (both fallback cases) and the T8 doc greps for the deployed recipe.

- **AC-17 — Asset budgets, determinism and contrast.**
  (a) Both assets are valid PNGs (8-byte signature), the hero is exactly 600×200 and the cube exactly 72×72; hero ≤ 60 KiB (61,440 bytes), cube ≤ 15 KiB (15,360 bytes); `node src/frontend/scripts/generate-email-assets.mjs --check` exits `0` only when the committed files are byte-identical to a fresh deterministic generation (matching SHA-256), and the script emits only the pinned asset palette. `email-template.test.ts` resolves each PNG from the test file, not from the workspace cwd: `new URL('../../../frontend/public/email/cubeclicker-hero.png', import.meta.url)` (tests run with `src/backend` as cwd).
  (b) HTML ≤ 20 KiB (20,480 bytes).
  (c) The combined text + HTML + referenced image bytes are < 100 KiB (102,400 bytes). In-test WCAG contrast ratios are ≥ 4.5:1 for text (`#e8f6ff`) on surface (`#0a1222`), muted (`#a9c2d8`) on surface, muted on void (`#04060d`), cyan (`#7cf6ff`) on void, and CTA ink (`#04120c`) on emerald (`#34d399`). Evidence: `email-template.test.ts` reading `src/frontend/public/email/`, computing ratios and byte counts; T2's `--check` output.

- **AC-18 — Plain-text degradation and Mailpit extraction.**
  (a) The plain-text body remains byte-for-byte unchanged; the HTML contains the raw token and `/token=([A-Za-z0-9]+)/` extracts the same token from the HTML body that it extracts today. Evidence: `email-template.test.ts`.
  (b) The containerized smoke still passes register → read Mailpit → verify → login. Evidence: raw `npm run smoke` output in `build-log-T9.md`.

- **AC-19 — Expiry note is accurate.**
  (a) `renderVerificationEmail(url)` with the default TTL renders `This link expires in 24 hours.`; `{ expiresInMs: 3_600_000 }` renders `This link expires in 1 hour.`; `{ expiresInMs: 604_800_000 }` renders `This link expires in 7 days.`
  (b) `AuthService.register` and `resendVerification` pass `verificationTokenTtlMs` into `sendVerification`, and `FakeEmailService` records the value. Evidence: `email-template.test.ts` (a), `auth-service.test.ts` (b).

- **AC-20 — Branded-email documentation.** `README.md` states that verification email is the branded CubeClicker template, that images live in `src/frontend/public/email/` and are served from the frontend origin (`APP_BASE_URL`/Vercel), that the CTA and the visible verification URL work when images are blocked, that `SMTP_FROM` should be the literal `CubeClicker <verified sender>`, and that the subject remains `Verify your CubeClicker email`. The README contains the literal `APP_BASE_URL` token. The architecture docs note that email images are served by the existing frontend origin with no new service, port or image. Evidence: exact greps in T8's verify.

- **AC-21 — Brand assets are reproducible from a committed authoring source.** `src/frontend/scripts/generate-email-assets.mjs` is committed and is the only authoring source for the two PNGs. It uses only Node built-ins (`node:fs`, `node:zlib`, `node:crypto`; no npm dependency, no network), pins a deterministic PRNG seed, the geometry, a 5×7 bitmap font for `CUBECLICKER` and the asset palette (`#04060d`, `#0a1222`, `#34d399`, `#2a9e78`, `#1f7a5c` emerald shading, `#7cf6ff`, `#e8f6ff`, `#2b4a63`). `--check` regenerates in memory and compares SHA-256 with the committed files (printing `PASS <file> <bytes> B <sha256>`), failing non-zero on any mismatch; the script is part of the feature diff and is not wired into `npm run build`. Evidence: T2 verify output in `build-log-T2.md`.

## Non-goals

- No Brevo REST API (`/v3/smtp/email`) integration, no Brevo SDK, and no new npm dependency; `nodemailer` remains the only mail dependency, and the asset script adds none.
- No Reply-To, List-Unsubscribe, bounce/complaint webhooks, transactional templates, campaigns, or contact management.
- No DNS/SPF/DKIM/DMARC setup and no sender/domain verification performed by the repository — those are Brevo-console and DNS actions owned by the user.
- No change to registration, verification-token, session or rate-limit behavior; no retry queue/outbox and no asynchronous email delivery.
- No change to the plain-text body, subject, token/session semantics or auth flow; the HTML body is replaced by the branded template (AC-15…AC-19).
- No CID attachments, external stylesheets, web fonts, `<svg>`, `<script>`, CSS background images, tracking pixels or unsubscribe flow in the email; no image generation at send time.
- No build-time asset pipeline and no rasterizer dependency: the committed authoring script runs manually (or as `--check`) and is never part of `npm run build`.
- No changes to the game UI (`src/frontend/src/**` is read-only reference for the palette/motifs) and no new frontend feature integration beyond `public/email/` static assets and `scripts/generate-email-assets.mjs`.
- No removal of Mailpit or of the Mailpit-backed smoke test; local capture remains the default.
- No production Render/Vercel/Neon provisioning; production stays unprovisioned (documented recipe only).
- No provider abstraction beyond SMTP (no Resend/Postmark adapters) and no non-TLS credential transport.
- No GitHub Actions/workflow change: no task in this feature owns a workflow file, so the credential guard is a pinned local verify command (T0/T9), documented in `README.md`.
- No `.gitignore` or index manipulation as secret protection: `opencode.jsonc` stays tracked in a sanitized, reference-only shape, and the credential lives in the global OpenCode config.

## Boundaries

- ✅ Always: keep the Mailpit defaults working unchanged; parse and validate every new value in `auth/config.ts`; keep the transport injectable and assert exact `nodemailer` options; never print `SMTP_PASS` or `SMTP_USER` (redact transport/config error text); run the credential audit before each commit and record count-only/key-name-only evidence; keep the frontend bundle free of SMTP settings; render the email with inline CSS, table layout, alt text and a visible fallback URL; use the pinned palette (game literals + labelled email-safe derivations) without editing game code; author assets only through the committed script; record raw evidence in build logs; run lint, typecheck, tests, coverage and build before reporting done.
- ⚠️ Ask first: any new dependency or rasterization/build step for assets (none is expected); editing `.env*` (never by agents); changing the plain-text body or subject; changing auth flows; changing coverage thresholds or exclusions; touching files outside a task's `files_owned` (especially `compose.yaml`, `compose.smoke.yaml`, `render.yaml`, `opencode.jsonc` outside T0); any Brevo MCP action beyond read-only inspection; any live test email (only to a user-controlled address, with explicit user approval).
- 🚫 Never: commit a Brevo SMTP key or REST API key; log, echo, diff or `cat` a credential value; run a value-bearing `git diff`/`git show` on `opencode.jsonc` while the working copy holds a credential; put a value on a `sync: false` Render variable; stage `.env*`; claim `.gitignore` protects a tracked file or use it as the `opencode.jsonc` mechanism; weaken existing auth/email assertions; disable TLS certificate verification; remove Mailpit defaults; send a real email to a third party, change Brevo account settings/senders/keys/domains, or record Brevo secrets from the MCP; add `<script>`, `<svg>`, web fonts, external CSS or tracking pixels to the email.

## Security considerations

- **Credentials:** `SMTP_PASS` (Brevo SMTP key) and `SMTP_USER` are environment-only, never committed, baked into an image, or written to logs. Config errors name variables; only non-secret numeric/boolean raw values appear in messages. Every CLI failure line runs through `redactSecrets`, so a transport/config error that embeds the user or key prints `[redacted]` instead. The credential guard (below) fails on any key-shaped string in the branch diff, the tracked tree or a build log.
- **Repository MCP configuration (T0):** the Brevo MCP credential is user-owned global configuration under `~/.config/opencode/`. The tracked repo file uses `mcp.servers.{vercel,Neon,brevo}`; T0 removes the credential-bearing `headers` from the `brevo` entry and leaves it with the same key set as `vercel`/`Neon` (`type`/`url`). The global file uses the `mcp.{...}` shape; T0 adds exactly one `brevo` entry carrying `headers.Authorization` with the key. Both checks resolve `cfg.mcp?.servers ?? cfg.mcp ?? cfg.mcpServers`, iterate the actual entry map, assert exactly one case-insensitive `brevo` entry (repo: reference shape, no `headers`, no key; global: `headers.Authorization` matches the key pattern) and print entry names plus the global path only. T0 is explicitly authorized to write the out-of-repo global file (`opencode.json` or `opencode.jsonc`, exactly one candidate); that local action is not a repository `files_owned` edit and nothing global is committed. `opencode.jsonc` remains tracked; `.gitignore` is not used and is not a protection mechanism for tracked files. The owner states the key was never pushed; rotation becomes mandatory only if a pushed revision is ever found to contain a key pattern (the count-only HEAD checks below are `0`). Moving the credential may require restarting the running OpenCode session before the Brevo MCP reconnects with the global config; that is expected and is not a build failure.
- **Credential guard (pinned, no output):**
  ```sh
  git show HEAD:opencode.jsonc | grep -cE 'xkeysib-[A-Za-z0-9]{20,}'
  git show HEAD:opencode.jsonc | grep -cE 'xsmtpsib-[A-Za-z0-9]{15,}'
  ! git grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
  ! git grep --untracked -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
  ! git diff origin/main...HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
  ! git log -p origin/main..HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
  ```
  The first two print counts only; the rest print nothing on success. `git grep --untracked` covers untracked new files (ignored files such as `.env*` stay excluded), and `git log -p origin/main..HEAD` covers a key added and then removed in an intermediate branch commit. The `xsmtpsib-` pattern matches the 15-character short SMTP key as well as the 64-character standard form; the assignment check catches a bare 15-character value after `SMTP_USER=`/`SMTP_PASS=`. The 12-character threshold means documented placeholders must use angle brackets (`SMTP_USER=<your-smtp-login>`, `SMTP_PASS=<SMTP key>`) or a short quoted placeholder (`SMTP_USER=hostile`); T0/T9 run a guard self-test that proves synthetic 15-character `xsmtpsib-`, 24-character `xkeysib-` and assigned 15-character strings match while those placeholders do not. The self-test constructs the synthetic strings at runtime, so no key-shaped literal exists in the tree. Each task also runs the same pattern against its own build log file (exact command in `tasks.md`).
- **Transport:** STARTTLS is required whenever credentials are configured and implicit TLS is off (`requireTLS`), so the SMTP key cannot be sent cleartext; certificate verification stays enabled (no `rejectUnauthorized:false`). `connectionTimeout`, `greetingTimeout` and `socketTimeout` are all bounded by `SMTP_CONNECTION_TIMEOUT_MS`, so a provider that accepts the connection and then stalls cannot hang registration.
- **Email content:** the verification URL contains a raw single-use token; it is rendered only inside the email (CTA + visible URL), never logged. No user-controlled data is interpolated into the HTML except the already-escaped verification URL. Images are static brand assets with no tracking pixels, no per-recipient query parameters and no recipient data in URLs; Gmail/Apple proxy image fetches, so open tracking is neither provided nor claimed.
- **Links:** the CTA and fallback URL point to the configured `APP_BASE_URL` origin over the scheme it declares; no user-supplied redirect target is introduced. `SMTP_FROM` is operator configuration, not user input, and must be a verified sender.
- **MCP:** the Brevo MCP server is available to the reviewer and planner agent sessions for read-only checks; the builder cannot use it (its skill/tool allow-list excludes MCP), and the orchestrator is a strict router without MCP tools. Live sends require explicit user approval, only to an address the user controls; no Brevo settings, senders, domains or keys are created/changed/deleted by agents, and no MCP credential is recorded in artifacts.
- **Dependencies/supply chain:** no new dependency, no web font, no external stylesheet and no remote script; assets are local PNGs shipped with the frontend and generated only by the committed built-ins-only script.

## Configuration contract

### Environment variables

| Variable | Default | Brevo value | Rules |
| --- | --- | --- | --- |
| `SMTP_HOST` | `mailpit` | `smtp-relay.brevo.com` | non-empty string (existing) |
| `SMTP_PORT` | `1025` | `587` (STARTTLS, pinned) or `465` (implicit TLS) | integer 1–65535 (existing) |
| `SMTP_SECURE` | derived: `true` iff port `465` | `false` for 587, `true` for 465 | `true`/`1`/`false`/`0`; empty = unset |
| `SMTP_USER` | unset | Brevo **SMTP login** (`<id>@smtp-brevo.com`, shown on the SMTP page) | must be set together with `SMTP_PASS`; empty = unset |
| `SMTP_PASS` | unset | Brevo **SMTP key** (Settings → SMTP & API → SMTP), not the REST API key | must be set together with `SMTP_USER`; secret |
| `SMTP_FROM` | `no-reply@cubeclicker.local` | a Brevo-verified sender, optionally `CubeClicker <address>` | non-empty string (existing) |
| `SMTP_CONNECTION_TIMEOUT_MS` | `10000` | `10000` | integer 1000–120000; sets `connectionTimeout`, `greetingTimeout` and `socketTimeout` |
| `APP_BASE_URL` | `http://localhost:5173` | the deployed frontend origin (already required for links) | non-empty string (existing) |

### Fail-fast behavior

`loadAuthConfig` throws on the first invalid variable, naming it and (for numeric/boolean parse failures only) the received raw value. Because `server.ts` calls `loadAuthConfig` before `listen`, the process exits non-zero; Render fails the deploy/health and the container exits, with the variable name in the logs. There is deliberately **no** startup SMTP connectivity probe: the app must boot and serve `/healthz` while Brevo is unreachable, and delivery failures surface at registration (HTTP 500) and through the CLI. The CLI catches config errors and prints them sanitized, without a stack trace.

### Secret handling by environment

| Environment | Supply | Never |
| --- | --- | --- |
| Local (`podman compose up`) | exported shell variables (canonical) or a gitignored `.env` consumed by the compose provider for interpolation | commit/echo values; agents read `.env*` |
| Render `development` | dashboard service variables for the `sync: false` names (`SMTP_HOST/PORT/SECURE/USER/PASS/FROM/CONNECTION_TIMEOUT_MS`) | put values in `render.yaml` or the image |
| GitHub `development`/`production` | `SMTP_PASS` already exists as an Environment secret; `SMTP_HOST/PORT/USER/FROM` as variables; add `SMTP_SECURE` and `SMTP_CONNECTION_TIMEOUT_MS` as runtime-parity variables | add a new secret name; stage values in the workflow |
| CI | nothing SMTP-related; the smoke uses Mailpit | any live Brevo call |
| OpenCode MCP | the Brevo MCP auth header lives in the user-owned global config (`~/.config/opencode/`, out of the repository) | put a credential in `opencode.jsonc` or any tracked file |

No new secret name is required: `SMTP_PASS` already exists in the GitHub catalog and on Render; it now holds the Brevo SMTP key.

### Pre-build repository configuration checkpoint (T0, builder-owned)

The owner directive supersedes the earlier "untrack + ignore" idea. `opencode.jsonc` stays tracked; the credential moves to the global config. T0 runs before T1 and before any feature commit, and is **explicitly authorized** to write the user-owned global config (`~/.config/opencode/opencode.json` or `opencode.jsonc`, exactly one candidate) as a local action — that path is not in the repository `files_owned` and nothing global is committed.

1. **Inspect without printing values.** Parse both files with the TypeScript JSONC parser and list only MCP entry names. The repo schema is `mcp.servers.{vercel,Neon,brevo}` (the `brevo` entry currently carries `headers.Authorization`); the global schema is `mcp.{context7,github,render}` with no `brevo` entry yet. Resolve entries as `cfg.mcp?.servers ?? cfg.mcp ?? cfg.mcpServers`.
2. **Count-only HEAD check.** `git show HEAD:opencode.jsonc | grep -cE 'xkeysib-[A-Za-z0-9]{20,}'` and `git show HEAD:opencode.jsonc | grep -cE 'xsmtpsib-[A-Za-z0-9]{15,}'`. Any count greater than `0` stops the build and requires user-owned key rotation (the owner states the key was never pushed, so this is expected to be `0`).
3. **Move the credential to global config.** Resolve the one global config candidate and add a `brevo` entry to its `mcp` map (or to `mcp.servers` if that shape is present) carrying `headers.Authorization` with the key. Write the file with owner-only permissions; never print its content or the value.
4. **Sanitize the repo file.** Remove `headers`/the credential from the `opencode.jsonc` `brevo` entry so its key set equals `vercel`'s and `Neon`'s (`type`/`url`), keeping the entry referenced like the others. Do not revert unrelated user edits; change only credential material and the reference shape. The file remains tracked.
5. **Guard + evidence.** Parse-check both JSONC files; assert the repo map has exactly one case-insensitive `brevo` entry with the reference shape, no `headers` and no key pattern; assert the global map has exactly one `brevo` entry whose `headers.Authorization` matches the key pattern; run the count-only/tree/untracked/branch-history guards and the guard self-test; and record `git diff origin/main --numstat -- opencode.jsonc` (may be empty only when `origin/main` already carries the exact reference entry — T0 must ensure the entry exists), the key-path-only diff (changed JSON key paths, no values), the global path and the entry names in `build-log-T0.md`. A value-bearing `git diff`/`git show`/`cat` of either file is forbidden.

The credential move is not a build failure; a running session may need a restart before the Brevo MCP reconnects from the global config.

## Email content, assets and deliverability

### Branded template

- **Layout:** 600px max width, table-based (every layout table `role="presentation"`), inline CSS only, with `bgcolor` fallbacks for Outlook. The shell is a dark void (`#04060d`) with a surface panel (`#0a1222`), a metallic slate border (`#2b4a63`/`#1d3b52`) and a cyan rim strip (`#7cf6ff`) as the email-safe translation of the game's chamfered graphite-glass frame (chamfer/`clip-path` and outer glows are not portable). A starfield hero carries the brand.
- **Structure:** preheader (hidden), hero/logo, headline `Verify your CubeClicker account`, one primary CTA button (`id="verify-cta"`, emerald `#34d399` with ink `#04120c`) labelled `Verify email`, a visible fallback URL, an expiry sentence, and a footer with the cube mark, `CubeClicker — an online cube-clicking game.` and the "if it wasn't you, ignore this email" line.
- **Typography:** system stack only (`'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif`), no web fonts; 16px body, 26px headline; body `#e8f6ff`, muted `#a9c2d8`; contrast ≥ 4.5:1 pinned in tests.
- **Expiry:** the note is accurate to the configured token TTL (`VERIFICATION_TOKEN_TTL_HOURS`, default 24): formats whole hours/days (`1 hour`, `24 hours`, `7 days`). `AuthService` passes `verificationTokenTtlMs` into `sendVerification`; the CLI/omitted value uses the 24-hour default.
- **Plain-text fallback:** unchanged, byte-for-byte (subject `Verify your CubeClicker email`; greeting, link and ignore text as today), so the Mailpit smoke's `/token=([A-Za-z0-9]+)/` extraction keeps working.
- **Client compatibility:** Gmail (web/iOS/Android) strips `<style>` and SVG (none used) and renders tables/inline CSS; Apple Mail renders the same; Outlook desktop uses the Word engine, so the layout relies on tables, `bgcolor`, `width`/`height` attributes and cell padding, while `border-radius`, chamfer and gradients degrade to a square/solid frame; Outlook web follows the same inline-CSS path. Images are blocked by default in Outlook and often in Gmail until enabled, which is why the CTA is a text/background button and the raw URL is visible. Gmail may clip messages over ~102 KiB; the budget keeps the message below 100 KiB. The 600px table sits in a `width="100%"` wrapper; no media queries are used (they are stripped by Gmail), and mobile clients scale the message.
- **Deliverability:** subject stays `Verify your CubeClicker email` (no urgency/ALL-CAPS/prize wording); `SMTP_FROM` should be `CubeClicker <verified sender>`; no attachments, no tracking pixels, no unsubscribe link on transactional mail. SPF/DKIM/DMARC and sender/domain verification are Brevo-console/DNS actions owned by the user.

### Palette — game literals and email-safe derivations (pinned)

| Token | Literal | Source |
| --- | --- | --- |
| void | `#04060d` | game `theme.ts`/`app.css` literal |
| surface | `#0a1222` | email-safe opaque equivalent of the game's translucent panel |
| cyan | `#7cf6ff` | game `theme.ts` literal |
| emerald | `#34d399` | game `theme.ts` literal |
| text | `#e8f6ff` | game `theme.ts` literal |
| muted | `#a9c2d8` | email-safe solid derivation of `rgba(232,246,255,0.76)` |
| metallic | `#2b4a63` | email-safe solid derivation of the game's glass-panel fill |
| border | `#1d3b52` | email-safe solid derivation of the glass-panel fill |
| CTA ink | `#04120c` | email-safe solid derivation (dark ink on emerald) |

These are the only six-digit hex literals allowed in the HTML (AC-15). Game files stay read-only.

### Asset strategy — public URLs (chosen)

| Option | Decision | Why |
| --- | --- | --- |
| (a) CID-attached PNGs shipped in the backend image | Rejected | Adds `multipart/related` + attachment wiring, re-sends bytes on every message, grows the backend image, triggers attachment/clipping heuristics, and gains nothing because images are blocked by default in Outlook/Gmail anyway. |
| (b) PNGs committed under `src/frontend/public/email/`, referenced by absolute URL from `APP_BASE_URL` | **Chosen** | Static hosting already exists (Vite locally, nginx prod image, Vercel in deployment); assets are cacheable through image proxies; email stays small; no backend/transport complexity or image bytes; the CTA is text/background and the raw URL is visible, so blocking images never blocks verification. |

- **Files:** `src/frontend/public/email/cubeclicker-hero.png` (600×200, ≤ 60 KiB = 61,440 bytes) — starfield + emerald isometric cube + cyan `CUBECLICKER` wordmark; `src/frontend/public/email/cubeclicker-cube.png` (72×72, ≤ 15 KiB = 15,360 bytes) — compact emerald cube mark for the footer. PNG only, no SVG, no web font.
- **Origin:** the HTML derives the image origin from the verification URL (`new URL(verificationUrl).origin`, i.e. `APP_BASE_URL`) and points at `/email/...`. Locally that is the Vite dev server; in the prod image it is nginx on 8080; deployed it is the Vercel frontend. If the verification URL is not absolute or is malformed, the image URLs fall back to relative `/email/...` (images may not render, but the CTA/URL still work) and rendering never throws. The backend image and ports are untouched.
- **Image-blocked behavior:** both `<img>` elements have explicit `width`/`height` and `alt` text; the CTA is a styled table cell with a text label (background/border render without images), and the full verification URL is printed below it.
- **Serving proof:** locally proven from the compose network against both the Vite dev server (`http://frontend:5173`) and the nginx prod image (`http://frontend-prod:8080`) with `200` + `image/png` + PNG-signature assertions (AC-16(c), T9). The deployed-origin check is a documented, user-run recipe (AC-16(d)); production is unprovisioned.
- **Brand mapping (read-only reference):** the game's `src/frontend/src/ui/theme.ts` and `app.css` supply the literals above plus the translucent panel recipe; the email uses the labelled solid derivations in the palette table. No game UI file changes.

### Asset source and authoring (T2)

- **Source of truth:** `src/frontend/scripts/generate-email-assets.mjs`, committed with the PNGs. It is the only authoring source; the PNGs are committed artifacts (AC-21).
- **Technique:** pixels are written programmatically — a pinned-seed starfield, an isometric emerald cube (three shaded faces), a 5×7 bitmap font for `CUBECLICKER` in cyan, and the footer cube mark. PNG rows are filtered `0` (None) and compressed with `node:zlib.deflateSync` at a pinned level; chunk CRCs are computed by the script. Only the asset palette (`#04060d`, `#0a1222`, `#34d399`, `#2a9e78`, `#1f7a5c`, `#7cf6ff`, `#e8f6ff`, `#2b4a63`) is emitted.
- **Determinism:** a fixed PRNG seed and pinned zlib settings on the project's Node 24 runtime make generation byte-reproducible; `--check` regenerates in memory and compares SHA-256 with the committed PNGs, so a drift fails non-zero.
- **No runtime/build coupling:** the script is not imported by the app and is not run by `npm run build`; it is invoked manually (`node src/frontend/scripts/generate-email-assets.mjs`) or as `--check` in verification.
- **Visual sign-off:** the builder records the visual self-check (cube/starfield/wordmark legibility, no text corruption) in `build-log-T2.md`; the reviewer records the visual approval in the code-review artifact (`reviews/code-r<n>.md`). If the wordmark cannot be produced cleanly, the fallback is a cube-only hero plus an HTML text wordmark in the system stack, reflected in the same artifacts; the brand requirement (emerald cube + cyan neon + starfield) still holds.

### Brevo service notes

- The relay is `smtp-relay.brevo.com:587` (STARTTLS; `465` implicit TLS) and authenticates with the SMTP login + **SMTP key**, not the REST API key.
- Brevo's free plan reports a 300-email/day send limit; verification volume is expected to fit, and plan changes are user-owned.
- The Brevo MCP server may be used **read-only** by the reviewer and planner agent sessions for account/sender-domain verification during review; the builder has no MCP access. A live test email requires explicit user approval and a user-controlled recipient. No Brevo settings are changed and no secret is recorded.

## Operator verification

- `npm run email:test --workspace @cubeclicker/backend -- --to <address>` (host/dev dependencies) and `npm run email:test:dist --workspace @cubeclicker/backend -- --to <address>` (built `dist`, including the prod image) run `runEmailTestCli`, which loads the same `AuthConfig`, builds the same transport through `createSmtpEmailService`, and sends the real verification template with a synthetic `.../verify?token=cli-test` link. Success/failure lines are pinned in AC-8/AC-9 and never include credentials.
- In the compose stack: `podman compose exec backend npm run email:test -w @cubeclicker/backend -- --to <address>`.
- The manual live check is user-owned (real SMTP key only in the user's shell) and is documented in `README.md`; no CI job contacts Brevo.

## Real-time impact

Out of scope. Email delivery is a request/response auth side effect; it shares no cross-client state, adds no WebSocket message, and changes no connection lifecycle, reconnection, presence or server-authority behavior. Identity vs. "no accounts" is already resolved by `user-authentication` and is not reopened here. The credential move in T0 touches editor/MCP configuration only and does not affect the game's WebSocket path.

## Containerization impact

- No new service, image, port, volume, health check or WebSocket endpoint. The backend image, `GET /healthz` and `GET /ws` are unchanged; `dist/auth/email-cli.js` ships through the existing `dist` copy.
- `compose.yaml` gains two environment passthroughs (`SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`) with defaults that keep Mailpit selected.
- `compose.smoke.yaml` pins the smoke backend's sixth-field SMTP set (`SMTP_HOST/PORT/USER/PASS/FROM/SECURE`) to Mailpit so host Brevo exports cannot make the smoke nondeterministic; no new service depends on it.
- `render.yaml` gains two `sync: false` environment entries; all SMTP values stay dashboard-supplied, never committed or baked.
- The two email PNGs live in `src/frontend/public/email/`; the existing frontend dev image (Vite) and `prod` image (nginx) serve them at `/email/*.png` with no Dockerfile, port or service change. The T9 serving proof fetches both origins over the compose network. Vercel serves existing files before applying SPA rewrites, so no `vercel.json` change is needed. The added payload is < 100 KiB.
- The asset generator is a repo script (`src/frontend/scripts/`), not a service, build stage or dependency; it is not copied into any runtime image.
- This follows `docs/architecture/containerization.md` (environment-based config, runtime-only secrets, provider-neutral images, existing health signal); no convention is reopened.

## Testing strategy

- **Unit (backend, Vitest):**
  - `auth/config.test.ts` — `SMTP_SECURE` derivation/override, timeout boundaries, invalid-value messages, pairing.
  - `auth/email.test.ts` — exact transport objects including `socketTimeout`, `requireTLS` policy, auth omit/empty, From display-name pass-through, transport-failure propagation, factory wiring, no attachments.
  - `auth/email-template.test.ts` — shell structure, exact palette literals + no other `#rrggbb`, exact link/CTA/count assertions, no `<script>`/`<style>`/`<svg>`/web font/external CSS/CSS `url(`, preheader/headline/footer, expiry formats, absolute and relative/malformed image-URL cases, alt/width/height, PNG signature/dimensions/budgets in bytes and KiB, combined budget, contrast ratios, token regex.
  - `auth/email-cli.test.ts` — arg parsing, exact success/warning/failure/usage lines, exit codes, `redactSecrets` with both credential values plus a REST-key-shaped token and a short SMTP-key-shaped token, no credential in output, no transport on invalid input.
  - `app.test.ts` — `buildApp` throws on invalid SMTP config; the email service is built through the injected `emailTransportFactory` exactly once with the exact Brevo transport object.
- **Integration (backend):** `auth/auth-service.test.ts` — registration rejection when email fails, account persists unverified, resend succeeds after recovery, `verificationTokenTtlMs` passed to both sends; `auth/auth-routes.test.ts` — HTTP 500 `internal_error` mapping. In-memory repositories and a faked transport; no network.
- **Containerized e2e:** clean-stack hostile-env `npm run smoke` with Mailpit priming (the smoke's register → Mailpit read → verify → login path proves the branded HTML still carries the extractable token), plus compose-network fetches of both `/email/*.png` assets from the Vite dev server and the nginx prod image. The deployed smoke is unchanged and does not send real mail.
- **Asset-tier proof:** `node src/frontend/scripts/generate-email-assets.mjs --check` reproduces the committed PNGs byte-for-byte and the PNG spec assertion pins signature, dimensions and bytes. This is the asset task's automated evidence (no Vitest surface; recorded in `build-log-T2.md`).
- **Credential-tier proof:** per-task closing grep of the task's own build log; the branch-diff, branch-history, tracked-tree and untracked-file guards (AC-12(b)); the schema-aware repo/global OpenCode entry checks (exactly one `brevo`, repo reference shape, global `headers.Authorization`); and the guard self-test. No command prints a match or a value.
- **Manual live check:** documented, user-owned (AC-14); evidence optional in the build log, never CI.
- **Asset review evidence:** the builder's visual self-check goes in `build-log-T2.md`; the reviewer's visual approval goes in `reviews/code-r<n>.md`. The reviewer does not edit build logs.
- **Coverage:** `npm run coverage` — ≥ 80% statements/branches/functions/lines per workspace; behavior tasks use the workspace-scoped pre-gate `npm run coverage --workspace @cubeclicker/backend`. No exclusions. Concrete expected values, no wildcard matchers, no snapshot-only assertions, no useless tests, no live-network tests.
- **Verification commands:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `npm run smoke`, the asset `--check`, the compose/render/Vercel parse checks and `actionlint` (workflows unchanged; run as a no-drift proof).

## Supersessions

| Superseded | Behavior replaced | Replaced by (this spec) | Retained |
| --- | --- | --- | --- |
| `user-authentication` Q-2 (production email provider undecided) | Provider left open; default dev Mailpit | Brevo SMTP chosen for `development` and `production` via the existing generic SMTP configuration | Mailpit as local default |
| `user-authentication` non-goal "no production email provider commitment" | No provider commitment | Provider committed: Brevo SMTP (no REST API integration) | Provider-neutral `EmailService` interface |
| `user-authentication` AC-28 (dev Mailpit capture) | — | Unchanged: Mailpit remains the dev default | AC-28 |
| `user-authentication` email HTML body (three-paragraph fragment) | Unbranded HTML fragment, no layout/assets/expiry | Branded, table-based, inline-CSS game shell with public-URL PNG assets, CTA, visible URL, expiry and footer (AC-15…AC-19) | Plain-text body, subject, link/token semantics |
| `deployment.md` / `vercel-render-neon.md` "development is guest-only; SMTP values are placeholders" | Placeholder SMTP, no delivery | Brevo SMTP configured for development/production; email delivery becomes usable | Guest play |
| r1/r2 `opencode.jsonc` protection proposal (`git rm --cached` / `skip-worktree` / `.gitignore`) | Tracked file with a working-copy credential and no mechanism | T0: credential moved to the user-owned global OpenCode config; repo file stays tracked, sanitized and reference-only; key-pattern guard in T0/T9 | `opencode.jsonc` itself, now secret-free |

Predecessor specs/plans are not edited.

## Open questions

### User-owned (require a user decision or action)

- **Q-1 — SMTP key vs REST API key (BLOCKING for live delivery).** The request says "API Key", but Brevo's relay authenticates with the SMTP login + **SMTP key** (Settings → SMTP & API → SMTP), not the REST API key. The planning-time read-only account check confirms the relay and SMTP login exist but cannot expose the SMTP key. Confirm the SMTP key exists (or generate one) and place it in `SMTP_PASS`. The working-copy REST key that motivated r1 is handled by T0 (global config); the owner states it was never pushed, so rotation is a contingency only.
- **Q-2 — Sender identity and domain.** The account currently has one active sender (a personal mailbox). Confirm whether that sender is used for development and whether an owned domain with `no-reply@<domain>` will be verified for production (SPF/DKIM/DMARC user-owned). Using a personal mailbox as the production From is discouraged.
- **Q-3 — Live-delivery verification owner.** Who runs the documented CLI + registration check with the real credential and records the redacted evidence? Agents must not handle the secret; this is a user-owned checkpoint action.
- **Q-5 — Brevo plan.** The free plan reports 300 emails/day. Confirm it is sufficient for development + planned production verification volume. Upgrade is user-owned.
- **Q-7 — Production provisioning.** Production has no Render service, Vercel project or Neon branch. Confirm this feature stops at the documented recipe for production (proposed) and does not provision it.

### Agent-decided (defaults recorded; no user action required)

- **Q-4 — Port and egress (decided: 587).** 587 STARTTLS is pinned; if the operator or Render egress blocks 587, the documented fallbacks are 2525 (STARTTLS) and 465 (implicit TLS, `SMTP_SECURE=true`). The first live run confirms the choice; no code change is needed to switch ports.
- **Q-6 — Local secret storage (decided: shell export canonical).** `README.md` documents shell export as the canonical local path and a gitignored `.env` as an accepted compose-interpolation alternative for operators; agents never read `.env*`.
- **Q-8 — 465 support depth (decided: allow, don't optimize).** Pin 587 as the supported recipe, allow `SMTP_SECURE=true` for 465, and revisit a `tls.servername` override only if the user-run live check fails. No pre-emptive TLS workaround is added.
- **Q-10 — Image origin (decided: `APP_BASE_URL` origin with tested fallback).** Email images are served from `new URL(APP_BASE_URL).origin` at `/email/...` (Vite locally, nginx prod image, Vercel deployed); relative/malformed verification URLs fall back to `/email/...` and are covered by a test. `APP_BASE_URL` remains the public frontend origin with no path prefix. Using the Q-2 sender until a domain is verified is acceptable for development.

### Resolved

- **Q-9 — Brand asset production and sign-off (resolved in r3).** The assets are authored by the committed deterministic script `src/frontend/scripts/generate-email-assets.mjs` with `--check` SHA-256 verification (AC-21); the builder records the visual self-check in `build-log-T2.md` and the reviewer records visual approval in the code-review artifact. The user may replace the art later with supplied brand art as a separate change; the orchestrator/user-generated-art path is not needed for this feature.

## Assumptions

- `SMTP_PASS` will hold the Brevo SMTP key; its standard (64-char) or short (15-char) form is accepted by `nodemailer` as a plain password.
- The Brevo 587 endpoint presents a certificate valid for `smtp-relay.brevo.com`; STARTTLS succeeds with default verification. This is proven by the user-run live check, not assumed silently by tests.
- `nodemailer@10.2.1` (already locked) supports `secure`, `requireTLS`, `connectionTimeout`, `greetingTimeout` and `socketTimeout`; no dependency change is needed.
- Render's dashboard is the source of runtime values; `render.yaml` is descriptive and is not applied by the pipeline (existing convention).
- The GitHub Environment catalog is documentation/runtime parity; the deploy workflow does not stage SMTP values. `SMTP_PASS` remains a secret, and the two new names are variables.
- Local compose providers interpolate an untracked `.env` for `${VAR}` substitution; the canonical documented path is shell export, and agents never read `.env*`.
- The user owns Brevo account setup, sender/domain verification, DNS, plan limits and credential rotation, and the global OpenCode config (including the Brevo MCP auth header).
- Production remains unprovisioned; the recipe is prepared but not exercised there.
- The frontend serves `public/` at the site root in Vite dev, in the nginx prod image and on Vercel, so `/email/*.png` resolves from `APP_BASE_URL` without a backend route or new service.
- Node 24's bundled zlib produces byte-identical PNG output for the pinned input, filter and level across the project's supported runtime; `--check` proves the committed files match on the build machine.
- Gmail/Outlook/Apple Mail render table layout with inline CSS; border-radius/chamfer and gradients degrade gracefully (square metallic frame in Outlook) without affecting the CTA or URL.
- The existing Mailpit smoke's token regex remains compatible with the branded HTML because the raw token is alphanumeric and appears unescaped in the CTA href and visible URL.
- The global OpenCode config is exactly one of `~/.config/opencode/opencode.json` or `~/.config/opencode/opencode.jsonc`; T0/T9 resolve the existing candidate, fail when neither or both exist, and record the actual path. The reviewer's r2 inspection found `opencode.json` with the `mcp.{context7,github,render}` shape.

## Revision history

- r1 — 2026-11-20 — initial draft (planning phase).
- r2 — 2026-11-20 — added the branded verification-email scope (addendum): table-based inline-CSS game shell, public-URL PNG asset strategy with image-blocked fallback, asset budgets/contrast, accurate expiry note, plain-text/Mailpit compatibility, Brevo MCP usage policy, and AC-15…AC-20; AC-7 revised from "HTML unchanged" to "plain-text unchanged, HTML branded".
- r3 — 2026-11-21 — spec-review r1 response (F1–F16) plus the owner's mid-revision directive on the MCP credential: T0 pre-build config move (global config owns the Brevo credential; tracked `opencode.jsonc` stays reference-only), CLI error redaction, full-tree credential audit, deterministic asset generator, local serving proof + documented deployed recipe, documentation greps, `app.test.ts` factory seam, clean-stack smoke, Q reclassification, palette derivations, task acceptance narrowing, KiB units, `socketTimeout`, verification-URL fallback test, MCP ownership correction, and evidence locations.
- r4 — 2026-11-21 — spec-review r2 scoped fix: F17 corrected (both OpenCode schemas, `cfg.mcp?.servers ?? cfg.mcp ?? cfg.mcpServers`, exactly one `brevo` entry, repo reference shape vs. global `headers.Authorization`, names/paths only); folded F18 (authorized global-config scope), F19 (per-file T8 statement greps), F20 (branch-history + untracked credential audits), F23 (backend-cwd asset path), F24 (`xsmtpsib-` short-key pattern, placeholder rule, guard self-test), F25 (T0 numstat/global-path resolution); F21/F22 and F26–F32 remain recorded backlog.

## Revision note — r3 (F1–F16 dispositions)

| # | Disposition in r3 |
| --- | --- |
| F1 | **Superseded by the owner directive, then fixed.** The credential moves to the global OpenCode config; T0 sanitizes the tracked `opencode.jsonc` without printing it, adds a key-pattern guard, and records count/key-name-only evidence. `.gitignore`/`git rm --cached`/`skip-worktree` are explicitly dropped; the file stays tracked. AC-12(c), § Pre-build repository configuration checkpoint, § Security. |
| F2 | **Fixed.** `redactSecrets` strips `SMTP_USER`/`SMTP_PASS` values and both key patterns from every printed failure line; AC-9 pins the exact redacted line, the exit code and a both-values test. |
| F3 | **Fixed.** Full-tree + branch-diff audits include `docs/features/**/build-log*.md`; strict key patterns plus a 12+ character `SMTP_USER=`/`SMTP_PASS=` check; per-task closing grep on each build log; audits print no matches. AC-12(b)/(d), § Security, T0/T9. |
| F4 | **Fixed (owner path chosen).** `src/frontend/scripts/generate-email-assets.mjs` is the committed, dependency-free, deterministic authoring source; PNGs are committed artifacts; `--check` matches SHA-256; visual self-check/approval locations pinned. AC-21, AC-17(a), AC-16(c)/(d). Q-9 resolved. |
| F5 | **Fixed.** Compose-network fetches prove `200` + `image/png` + PNG signature from both the Vite dev server and the nginx prod image; the Vercel check is a documented user-run recipe (production unprovisioned). AC-16(c)/(d), T9/T8. |
| F6 | **Fixed.** T8's verify greps `SMTP key`/`not the REST API key`, 587/465, CLI commands + expected line + user-owned marker, `src/frontend/public/email/`, image-blocked/visible-URL behavior and `SMTP_FROM`; `README.md` joins the stale-claim grep; README line 183 and `vercel-render-neon.md` line 251 are named for correction. AC-13, AC-20. |
| F7 | **Fixed.** `app.test.ts` moves to T4; `buildApp` gains an `emailTransportFactory` seam and a test asserts one factory call with the exact Brevo transport object. AC-5, T4. |
| F8 | **Fixed.** Clean-stack `down --remove-orphans` before the hostile smoke; the config check unsets `SMTP_*` and bypasses `.env` interpolation with `--env-file /dev/null`. AC-11(a)/(b), T7/T9. |
| F9 | **Fixed.** Q-4/Q-6/Q-8/Q-10 are agent-decided with recorded defaults; Q-1/Q-2/Q-3/Q-5/Q-7 remain user-owned; Q-9 is resolved. § Open questions. |
| F10 | **Fixed.** Non-game colors are labelled email-safe derivations; every template color is pinned in AC-15 and contrast pairs in AC-17(c); game files stay read-only. |
| F11 | **Fixed.** Task acceptance uses AC clause labels (e.g. `AC-16(b)`) and each task claims only what its verify proves; T9 remains the full-AC gate. `tasks.md`. |
| F12 | **Fixed.** KiB = 1024 bytes everywhere; byte values pinned (61,440 / 15,360 / 20,480 / 102,400). AC-17. |
| F13 | **Fixed.** `socketTimeout` added to the transport contract and set from `SMTP_CONNECTION_TIMEOUT_MS`; exact objects and tests updated. AC-5, AC-2. |
| F14 | **Fixed.** Relative/malformed verification-URL fallback is an explicit AC clause and a template test. AC-16(e). |
| F15 | **Fixed.** The claim now names the reviewer/planner sessions as the read-only MCP users; the builder has no MCP access and the orchestrator is a strict router; live sends need explicit user approval. § Brevo service notes, § Security, plan § Brevo MCP availability. |
| F16 | **Fixed.** Builder self-check → `build-log-T2.md`; reviewer visual approval → `reviews/code-r<n>.md`. § Testing strategy, T2/T9. |

## Revision note — r4 (r2 findings)

| # | Disposition in r4 |
| --- | --- |
| F17 | **Fixed (blocker).** The T0/T9 OpenCode checks now resolve `cfg.mcp?.servers ?? cfg.mcp ?? cfg.mcpServers`, iterate the actual entry map, assert exactly one case-insensitive `brevo` entry, compare the repo entry's key set with both `vercel` and `Neon` (`type`/`url`, no `headers`, no key pattern), and assert the global entry's `headers.Authorization` matches the key pattern. Entry names and the global path are printed; values never are. AC-12(c), § Security, § Pre-build checkpoint, plan interfaces/audit commands and T0/T9 are updated for both schemas (`mcp.servers` repo, `mcp` global). |
| F18 | **Folded.** T0 declares the global config as an explicitly authorized `local_action` (out-of-repo, never committed); the plan owner column and the pre-build section align with that scope. |
| F19 | **Folded.** T8's multi-file `grep -n` is replaced by a per-file `grep -q` loop for `SMTP_SECURE`/`SMTP_CONNECTION_TIMEOUT_MS`, per-file `SMTP key` checks in both architecture catalogs, and per-statement checks for `derived`/`10000`, `verified sender`, the CLI commands/`Test email sent to`, prerequisites, `APP_BASE_URL`, `CubeClicker <verified sender>`, the `200`/`documented-not-run` recipe marker and the Secret hygiene patterns. T8's acceptance stays at AC-13/14/16(d)/20, now proven by those checks. |
| F20 | **Folded.** T0/T9 add `! git log -p origin/main..HEAD | grep -qE …` (intermediate-commit history) and `! git grep --untracked -qE …` (untracked files, ignored files excluded); AC-12(b), § Security and the plan audit commands list them. |
| F23 | **Folded.** AC-17/T3 pin the test-file-relative asset resolution: `new URL('../../../frontend/public/email/cubeclicker-hero.png', import.meta.url)`, because Vitest runs with `src/backend` as cwd. |
| F24 | **Folded.** The `xsmtpsib-` key pattern is now `[A-Za-z0-9]{15,}` (short 15-character and standard 64-character forms); `redactSecrets` uses the same pattern; documented placeholders must use angle brackets or a short quoted value; T0/T9 run a guard self-test with runtime-constructed synthetic strings and assert the placeholders do not match. |
| F25 | **Folded.** T0 states it must ensure the reference entry exists; the numstat check is evidence (empty only if `origin/main` already carries the exact reference entry); the global config is resolved as exactly one of `opencode.json`/`opencode.jsonc` and asserted to exist in both T0 and T9 (no conditional skip). |
| F21, F22, F26–F32 | **Backlog — not folded in r4** (hex-literal whitelist breadth, task/evidence mapping, dev-image generator wording, `js-yaml` provenance, explicit frontend build, README line citation, superseded Fly doc, case-sensitive grep phrasing, broad T0 diff pattern). No AC or scope change in r4. |
