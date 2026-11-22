---
feature: brevo-smtp-email-delivery
revision: 4
---
# Plan — Brevo SMTP Email Delivery & Branded Verification Email

## Architecture

Five application layers, all inside the existing backend/frontend workspaces, preceded by a repository-configuration task:

0. **Repository configuration (`opencode.jsonc`, T0).** The Brevo MCP credential moves to the user-owned global OpenCode config (`~/.config/opencode/opencode.json` or `opencode.jsonc`, exactly one candidate); the tracked repo file keeps exactly one `brevo` MCP entry under its `mcp.servers` map, referenced the same way as `vercel`/`Neon` (`type`/`url`, no `headers`). T0 resolves the entry map as `cfg.mcp?.servers ?? cfg.mcp ?? cfg.mcpServers` in both files, adds the global `brevo` entry with `headers.Authorization`, removes the repo `headers`, and records only entry names, the global path, count-only greps, `--numstat` and a key-path-only diff. `opencode.jsonc` stays tracked — no `.gitignore`, `git rm --cached` or `skip-worktree` mechanism is used.
1. **Configuration (`src/backend/src/auth/config.ts`).** `loadAuthConfig` owns the SMTP contract: `smtpSecure` (explicit `SMTP_SECURE`, otherwise derived as `port === 465`), `smtpConnectionTimeoutMs` (`SMTP_CONNECTION_TIMEOUT_MS`, default `10000`), and the existing host/port/user/pass/from fields. It validates the user/pass pair and throws on the first invalid variable. `server.ts` already calls it before `listen`, so a bad configuration aborts startup; `buildApp` calls it too, which gives tests a seam.
2. **Pure template (`src/backend/src/auth/email-template.ts`, new).** Owns `VERIFICATION_EMAIL_SUBJECT`, the palette constants, `formatExpiryDuration`, `emailAssetUrls`, `escapeHtml` and `renderVerificationEmail(verificationUrl, options?)`. It has no I/O, clock or randomness; it returns `{ subject, text, html }`. The plain-text body is the current body unchanged; the HTML is the branded table layout. Image URLs are derived from `new URL(verificationUrl).origin` + `/email/...`, with a relative `/email/...` fallback for a non-absolute or malformed URL, so `APP_BASE_URL` remains the single source of the public origin.
3. **Transport/service (`src/backend/src/auth/email.ts`).** Exposes `buildSmtpTransportOptions` (the exact `nodemailer` connection object including `connectionTimeout`, `greetingTimeout` and `socketTimeout`), `createSmtpEmailService(config, transportFactory?)` (single composition path for the app and the CLI), and `SmtpEmailService`/`FakeEmailService` implementing the optional-`expiresInMs` `EmailService.sendVerification(to, verificationUrl, options?)`. It re-exports `renderVerificationEmail`/`VERIFICATION_EMAIL_SUBJECT` from the template module so existing imports keep working. `app.ts` replaces its inline options with `createSmtpEmailService(authConfig, emailTransportFactory?)`, where `emailTransportFactory` is the `BuildAppOptions.auth` test seam.
4. **Operator CLI (`src/backend/src/auth/email-cli.ts`, new).** `runEmailTestCli(argv, env, deps?)` parses `--to`/`--help`, loads the same `AuthConfig`, builds the same service through the factory, and sends the real template with a synthetic `${APP_BASE_URL}/verify?token=cli-test` URL. It returns an exit code instead of exiting, mirroring `migrate-cli.ts`; the module-level entry uses the `import.meta.url` guard. Every failure line is passed through `redactSecrets` (credentials + key patterns → `[redacted]`) before it is logged. `auth-service.ts` passes `verificationTokenTtlMs` into both registration and resend sends so the expiry note is accurate.
5. **Asset authoring (`src/frontend/scripts/generate-email-assets.mjs`, new).** A committed Node built-ins-only script writes the two PNGs pixel-by-pixel (pinned-seed starfield, isometric emerald cube, 5×7 bitmap `CUBECLICKER` wordmark, footer cube mark) into `src/frontend/public/email/`. `--check` regenerates in memory and compares SHA-256 with the committed files. The PNGs are committed artifacts; the script is not imported by the app and is not part of `npm run build`.

Data flow:

```text
T0: opencode.jsonc (repo, reference-only) ──credential (one-time move)──▶ ~/.config/opencode/opencode.{json,jsonc} (global, out of repo)

register/resend → AuthService → EmailService.sendVerification(to, url, {expiresInMs})
  → renderVerificationEmail (pure) → SmtpEmailService.sendVerification
  → nodemailer transport (host/port/TLS/connection+greeting+socket timeouts/auth) → Brevo relay → inbox

email:test CLI → loadAuthConfig → createSmtpEmailService → the same send path
                 (failure text → redactSecrets → output)

node src/frontend/scripts/generate-email-assets.mjs [--check] → public/email/*.png
HTML → absolute image URLs → frontend origin /email/*.png (Vite 5173 | nginx 8080 | Vercel)
```

State ownership is unchanged: the backend owns SMTP configuration at runtime, the frontend statically owns the two image files, and no shared/game state is involved. The global OpenCode config is user-owned and outside the repository.

## Interfaces / contracts

### Repository configuration (T0)

```text
opencode.jsonc (tracked)                        → mcp.servers.{vercel,Neon,brevo}
                                                  brevo keys == vercel/Neon keys (type,url); no headers
~/.config/opencode/opencode.{json,jsonc} (one)  → mcp.{context7,github,render,brevo}
                                                  brevo carries headers.Authorization (never committed)
entry resolution (both files): cfg.mcp?.servers ?? cfg.mcp ?? cfg.mcpServers
```

- The repo Brevo entry mirrors the `vercel`/`Neon` reference shape (same key set, `type`/`url`, no `headers`, no secret); the global Brevo entry carries the credential in `headers.Authorization`. T0 prints entry names and the global path only, never values, and compares the repo key set against both `vercel` and `Neon`.
- T0 is explicitly authorized to write the out-of-repo global config as a local action (it is not a repository `files_owned` edit; nothing global is committed). The builder's `edit` allow-list does not include root `opencode.jsonc`, so T0 edits it through a `node`/shell command (`shell: *` is permitted); the global file is edited the same way and never printed.
- Guard (count/silent only): `git show HEAD:opencode.jsonc | grep -cE 'xkeysib-[A-Za-z0-9]{20,}'` and the `xsmtpsib-[A-Za-z0-9]{15,}` variant must print `0`; `! git grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"` must pass with no output. No value is ever printed.

### Configuration

```ts
export const DEFAULT_SMTP_CONNECTION_TIMEOUT_MS = 10_000; // 1_000..120_000

export interface AuthConfig {
  // existing fields …
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;              // SMTP_SECURE, default port === 465
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFrom: string;
  smtpConnectionTimeoutMs: number;  // SMTP_CONNECTION_TIMEOUT_MS
  // …
}
```

- `SMTP_SECURE` is an optional boolean: empty/undefined = derive from port; `true`/`1`/`false`/`0` = explicit. Invalid values throw `SMTP_SECURE must be a boolean ("true", "false", "1", or "0"); received "<value>"`.
- `SMTP_CONNECTION_TIMEOUT_MS` uses the existing integer parser with range `1000..120000`; invalid values throw `SMTP_CONNECTION_TIMEOUT_MS must be an integer between 1000 and 120000; received "<value>"`.
- Pairing: `(smtpUser === null) !== (smtpPass === null)` throws `SMTP_USER and SMTP_PASS must be provided together (both or neither)`.
- Environment contract table (also in spec): `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_CONNECTION_TIMEOUT_MS`, `APP_BASE_URL`; Brevo values `smtp-relay.brevo.com`, `587` (STARTTLS) or `465` (implicit TLS), SMTP login + SMTP key, verified sender.

### Transport

```ts
export interface SmtpTransportOptions {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;              // !secure && hasAuth
  auth?: { user: string; pass: string };
  connectionTimeout: number;
  greetingTimeout: number;          // same value as connectionTimeout
  socketTimeout: number;            // same value as connectionTimeout
}

export interface SmtpEmailServiceOptions {
  host: string;
  port: number;
  secure?: boolean;
  connectionTimeoutMs?: number;
  user?: string | null;
  pass?: string | null;
  from: string;
}

export interface SmtpEmailConfig {  // structural subset of AuthConfig
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFrom: string;
  smtpConnectionTimeoutMs: number;
}

export type SmtpTransportFactory = (options: SmtpTransportOptions) => EmailTransport;

export function buildSmtpTransportOptions(options: SmtpEmailServiceOptions): SmtpTransportOptions;
export function createSmtpEmailService(
  config: SmtpEmailConfig,
  transportFactory?: SmtpTransportFactory,
): SmtpEmailService;
```

- Brevo 587 with credentials: `{ host:'smtp-relay.brevo.com', port:587, secure:false, requireTLS:true, auth:{user,pass}, connectionTimeout:10000, greetingTimeout:10000, socketTimeout:10000 }`.
- Brevo 465 with `SMTP_SECURE=true`: `secure:true`, `requireTLS:false`, same three timeouts.
- Mailpit defaults: `{ host:'mailpit', port:1025, secure:false, requireTLS:false, connectionTimeout:10000, greetingTimeout:10000, socketTimeout:10000 }` and **no `auth` property**; plaintext, as today.
- An override of `SMTP_CONNECTION_TIMEOUT_MS=2500` yields `2500` in all three timeout fields; `socketTimeout` closes the "provider accepts then stalls" gap that the connection/greeting bounds left open.
- `SmtpEmailService` passes exactly `{ from, to, subject, text, html }` to `sendMail`; no `replyTo`, no `attachments`, no CID.
- `BuildAppOptions` gains the seam:
  ```ts
  auth?: {
    // existing seams …
    emailTransportFactory?: SmtpTransportFactory;
    email?: unknown;
  };
  ```
  `buildApp` constructs the service with `createSmtpEmailService(authConfig, options.auth?.emailTransportFactory)`; `app.test.ts` asserts the factory is called exactly once with the exact transport object derived from `AuthConfig`.

### Template and email content

```ts
export const VERIFICATION_EMAIL_SUBJECT = 'Verify your CubeClicker email';
export interface VerificationEmailOptions { expiresInMs?: number } // default 24h
export function renderVerificationEmail(
  verificationUrl: string,
  options?: VerificationEmailOptions,
): { subject: string; text: string; html: string };
export function formatExpiryDuration(expiresInMs: number): string; // "1 hour" | "24 hours" | "7 days"
export function emailAssetUrls(verificationUrl: string): {
  hero: string;   // `${origin}/email/cubeclicker-hero.png`, or '/email/cubeclicker-hero.png'
  cube: string;   // `${origin}/email/cubeclicker-cube.png`, or '/email/cubeclicker-cube.png'
};
```

Email structure (all inline CSS, every layout table `role="presentation"`, `bgcolor` fallbacks):

| Part | Contract |
| --- | --- |
| Document | `<!doctype html>`, `<html lang="en">`, `meta charset`, viewport, `color-scheme`, `<title>`; no `<style>/<link>/<script>/<svg>`; no web fonts; no CSS `url(` |
| Preheader | `Your CubeClicker verification link is inside — verify your email to start playing.` hidden with the standard max-height/opacity/mso-hide pattern |
| Shell | outer `width="100%"` bg `#04060d`; inner `width="600"` table; metallic border `#2b4a63`/`#1d3b52`; 3px cyan `#7cf6ff` rim strip; chamfer/glow replaced by square border (Outlook-safe) |
| Hero | `<img src="${hero}" width="600" height="200" alt="CubeClicker">`; dark starfield + emerald cube + cyan CUBECLICKER wordmark |
| Headline | `Verify your CubeClicker account`, 26px, `#e8f6ff` |
| Body | `#e8f6ff` on `#0a1222`; muted `#a9c2d8` for the fallback/expiry/footer |
| CTA | table cell bg `#34d399`, ink `#04120c`, radius 8px; exactly one `<a id="verify-cta" href="<escaped url>">Verify email</a>` |
| Fallback | `Button not working? Copy this link into your browser:` + visible `<a href>` with `word-break:break-all`, URL text identical to the verification URL |
| Expiry | `This link expires in <formatExpiryDuration(...)>.` (default `24 hours`) |
| Footer | cube `<img src="${cube}" width="72" height="72" alt="CubeClicker cube">`, `CubeClicker — an online cube-clicking game.`, "if it wasn't you, ignore this email" |
| Plain text | Byte-for-byte current body: `Welcome to CubeClicker!\n\nVerify your email address by opening the link below:\n<url>\n\nIf you did not create an account, you can ignore this email.` |

Client compatibility: Gmail/Apple Mail render the table + inline CSS; Outlook desktop (Word engine) uses tables, `bgcolor`, width/height attributes and cell padding, with border-radius/chamfer/gradients degrading to square/solid; Outlook web follows inline CSS. No `<style>`/media queries (Gmail strips them); the 600px table sits in a `width="100%"` wrapper and mobile clients scale it. Images blocked → alt text + text CTA + visible URL. Total message < 100 KiB avoids Gmail clipping.

**Palette:** the HTML uses exactly the spec's nine literals — game literals `#04060d`, `#7cf6ff`, `#34d399`, `#e8f6ff`, plus email-safe derivations `#0a1222` (surface), `#a9c2d8` (muted), `#2b4a63` (metallic), `#1d3b52` (border), `#04120c` (CTA ink). Game `ui/theme.ts`/`app.css` are read-only. The template test asserts every `#rrggbb` literal in the HTML belongs to that set. In-test contrast: text/surface, muted/surface, muted/void, cyan/void and ink/emerald ≥ 4.5:1.

### Assets (public URL strategy)

| File | Dimensions | Budget (KiB = 1024 B) | Purpose |
| --- | --- | --- | --- |
| `src/frontend/public/email/cubeclicker-hero.png` | 600×200 | ≤ 60 KiB (61,440 bytes) | starfield + emerald isometric cube + cyan CUBECLICKER wordmark |
| `src/frontend/public/email/cubeclicker-cube.png` | 72×72 | ≤ 15 KiB (15,360 bytes) | compact emerald cube mark in the footer |

- Chosen over CID attachments: no multipart/related or attachment heuristics, no backend image bloat, cacheable through image proxies, and the CTA/visible URL make image blocking harmless. The full rationale is in spec § Email content, assets and deliverability.
- Served by Vite dev (`http://frontend:5173/email/...`), the nginx prod image (`http://frontend-prod:8080/email/...`) and Vercel (`https://<frontend>/email/...`) from the existing frontend build; no Dockerfile, route, port or backend change. Added payload < 100 KiB.
- **Authoring source:** `src/frontend/scripts/generate-email-assets.mjs`, committed with the PNGs. Node built-ins only (`node:fs`, `node:zlib`, `node:crypto`), no npm dependency, no network. PNG scanlines are filter 0; zlib level pinned; chunk CRCs computed by the script; PRNG seed pinned; the asset palette is `#04060d`, `#0a1222`, `#34d399`, `#2a9e78`, `#1f7a5c`, `#7cf6ff`, `#e8f6ff`, `#2b4a63` (the two darker emerald literals are email-safe shading derivations of `#34d399`).
- **Modes:** no flag writes the two PNGs; `--check` regenerates in memory and compares SHA-256 with the committed files (`PASS <file> <bytes> B <sha256>`), exiting non-zero on drift. The script is never imported by the app and is not run by `npm run build`.
- If the hero wordmark cannot be produced cleanly as raster, the fallback is a cube-only hero plus an HTML text wordmark in the system stack; the brand requirement (emerald cube + cyan neon + starfield) is still met. The builder records the decision and visual self-check in `build-log-T2.md`; the reviewer records visual approval in `reviews/code-r<n>.md`.
- **Serving proof:** T9 fetches all four asset URLs from the compose network (`frontend:5173` and `frontend-prod:8080`) and asserts `200`, `content-type: image/png` and the PNG signature. The Vercel-origin check is a documented user-run recipe (`curl -fsSI https://<frontend-host>/email/cubeclicker-hero.png` → `200`, `image/png`), not automation, because the development frontend deploy is user-triggered and production is unprovisioned.
- `emailAssetUrls` derives the origin from the verification URL and falls back to relative `/email/...` when the URL is not absolute or is malformed, so rendering never throws; a malformed `APP_BASE_URL` degrades images only, not the CTA/URL.

### CLI

```ts
export interface EmailTestCliDeps {
  createService?: (config: SmtpEmailConfig) => Pick<EmailService, 'sendVerification'>;
  log?: (line: string) => void;
  logError?: (line: string) => void;
}
export async function runEmailTestCli(
  argv: string[],
  env: Record<string, string | undefined>,
  deps?: EmailTestCliDeps,
): Promise<number>;

export function redactSecrets(
  message: string,
  secretValues: Array<string | null | undefined>,
): string; // replaces each non-empty value and each key-pattern match with "[redacted]"
```

| Situation | Output (exact) | Exit |
| --- | --- | --- |
| Success | `Test email sent to <to> via <host>:<port> (secure=<bool>, starttls=<required\|opportunistic>, auth=<yes\|no>, from="<from>")` | 0 |
| Default From warning (with success) | `Warning: SMTP_FROM is the local default; set it to a verified sender before real delivery.` | 0 |
| Missing `--to` | `Missing required option: --to <address>` + usage | 1 |
| Invalid address | `Invalid recipient address: "<value>"` + usage | 1 |
| Unknown option | `Unknown option: <option>` + usage | 1 |
| `--help` | usage | 0 |
| Config error | `Invalid email configuration: <redactSecrets(message)>` | 1 |
| Send failure | `Failed to send test email via <host>:<port>: <redactSecrets(message)>` | 1 |

The output never contains `SMTP_USER` or `SMTP_PASS`. `redactSecrets` replaces every occurrence of each configured credential value and every `xkeysib-[A-Za-z0-9]{20,}` / `xsmtpsib-[A-Za-z0-9]{15,}` match with `[redacted]`. The CLI sends the real template with a synthetic `.../verify?token=cli-test` URL (the email is a transport test, not a working verification link). The tests assemble the REST-key-shaped fixture from `'xkeysib-' + 'a'.repeat(24)` and the short SMTP-key-shaped fixture from `'xsmtpsib-' + 'b'.repeat(15)` so no key-shaped literal ever exists in the tree; the fixture credentials are written in object/colon form (`smtpUser`, `smtpPass`), never in `SMTP_PASS=` assignment form, so the credential guard cannot trip on test data.

## Credential audit commands (pinned)

Per-task closing check (replace `T<n>`; reads the task's own build log after it is written):

```sh
test -f docs/features/brevo-smtp-email-delivery/build-log-T<n>.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}" docs/features/brevo-smtp-email-delivery/build-log-T<n>.md
```

Branch/tree/history audit (T0 and T9):

```sh
git show HEAD:opencode.jsonc | grep -cE 'xkeysib-[A-Za-z0-9]{20,}'
git show HEAD:opencode.jsonc | grep -cE 'xsmtpsib-[A-Za-z0-9]{15,}'
! git grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
! git grep --untracked -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
! git diff origin/main...HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
! git log -p origin/main..HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}"
test -z "$(git log origin/main..HEAD --name-only --pretty=format: | grep -E '^\.env')"
```

Guard self-test (T0/T9; runtime-constructed synthetic strings, no key-shaped literal stored):

```sh
node -e "const cases=[['xsmtpsib-15','xsmtpsib-'+ 'a'.repeat(15),/xsmtpsib-[A-Za-z0-9]{15,}/],['xkeysib-24','xkeysib-'+'b'.repeat(24),/xkeysib-[A-Za-z0-9]{20,}/],['assigned-15','SMTP_PASS='+'c'.repeat(15),/SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}/]];for(const [label,value,re] of cases){if(!re.test(value))throw new Error('guard pattern misses '+label)}const allowed=['SMTP_USER=<your-smtp-login>','SMTP_PASS=<SMTP key>','SMTP_USER=hostile'];for(const value of allowed){if(/SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}/.test(value))throw new Error('guard rejects a documented placeholder')}console.log('credential guard self-test: key formats matched, documented placeholders allowed')"
```

No command prints a match (`grep -q`, `git grep -q`, `grep -c`); `git grep --untracked` covers untracked new files (ignored files such as `.env*` stay excluded) and `git log -p` covers a key added then removed in an intermediate commit. The `xsmtpsib-` pattern covers the 15-character short and 64-character standard SMTP key forms; the 12-character assignment check covers a bare value after `SMTP_USER=`/`SMTP_PASS=`. Documented placeholders must use angle brackets (`SMTP_USER=<your-smtp-login>`, `SMTP_PASS=<SMTP key>`) or a short quoted value (`SMTP_USER=hostile`). The guard is task/verify-scoped because no task in this feature owns a `.github/workflows/*` file; `README.md` documents the tree guard for future use.

## File inventory

| Path | New/Edit | Purpose | Owner |
| --- | --- | --- | --- |
| `opencode.jsonc` | Edit | Remove the credential; keep one secret-free Brevo MCP entry | T0 |
| `docs/features/brevo-smtp-email-delivery/build-log-T0.md` | New | Redacted config-move evidence (entry names, counts, `--numstat`) | T0 |
| `src/backend/src/auth/config.ts` | Edit | `smtpSecure`, `smtpConnectionTimeoutMs`, pairing validation | T1 |
| `src/backend/src/auth/config.test.ts` | Edit | Parsing/defaults/invalid/pairing tests | T1 |
| `src/frontend/scripts/generate-email-assets.mjs` | New | Deterministic PNG authoring source + `--check` | T2 |
| `src/frontend/public/email/cubeclicker-hero.png` | New | 600×200 brand hero (committed artifact) | T2 |
| `src/frontend/public/email/cubeclicker-cube.png` | New | 72×72 cube mark (committed artifact) | T2 |
| `src/backend/src/auth/email-template.ts` | New | Branded renderer, palette, expiry, asset URLs, fallback | T3 |
| `src/backend/src/auth/email-template.test.ts` | New | Structure, exact assertions, safety, budgets, assets, contrast, fallback | T3 |
| `src/backend/src/auth/email.ts` | Edit | Transport options, factory, TTL option, re-export | T4 |
| `src/backend/src/auth/email.test.ts` | Edit | Transport/service tests; template tests move out | T4 |
| `src/backend/src/app.ts` | Edit | Use `createSmtpEmailService(authConfig, emailTransportFactory?)` | T4 |
| `src/backend/src/app.test.ts` | Edit | `buildApp` fail-fast + factory-seam assertions | T4 |
| `src/backend/src/auth/auth-service.ts` | Edit | Pass `verificationTokenTtlMs` into register/resend sends | T5 |
| `src/backend/src/auth/auth-service.test.ts` | Edit | TTL capture, failure-then-resend regression | T5 |
| `src/backend/src/auth/auth-routes.test.ts` | Edit | 500 `internal_error` on transport rejection | T5 |
| `src/backend/src/auth/email-cli.ts` | New | Operator test-email CLI + `redactSecrets` | T6 |
| `src/backend/src/auth/email-cli.test.ts` | New | Exit codes, exact output, redaction, injectable service | T6 |
| `src/backend/package.json` | Edit | `email:test` (`tsx`) and `email:test:dist` (`node dist`) scripts | T6 |
| `compose.yaml` | Edit | `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS` passthrough | T7 |
| `compose.smoke.yaml` | Edit | Pin smoke SMTP to Mailpit | T7 |
| `render.yaml` | Edit | Two `sync: false` SMTP entries | T7 |
| `README.md` | Edit | Env table, Brevo recipe, CLI, assets/serving/image-blocked, secret hygiene, deployed recipe; fix the guest-only paragraph (line 183 at review time) | T8 |
| `docs/architecture/deployment.md` | Edit | Secrets/vars catalog, Render env, email status | T8 |
| `docs/architecture/vercel-render-neon.md` | Edit | Environment catalog, SMTP/email section, local-vs-cloud Email row, compose-change note (fixes line 251) | T8 |
| `docs/architecture/containerization.md` | Edit | Remove the "compose.yaml … untouched" claim in § Frontend static delivery; record the two SMTP pass-throughs and the smoke pinning (no convention change) | T8 |
| `docs/features/brevo-smtp-email-delivery/build-log-T9.md` | New | Full-gate evidence | T9 |
| `docs/features/README.md` | Orchestrator-owned | Builder proposes the row; does not edit | — |
| `~/.config/opencode/opencode.{json,jsonc}` | T0 local action (authorized, out-of-repo) | Holds the Brevo MCP `headers.Authorization`; one candidate, never committed | T0 |

No Dockerfile, `server.ts`, `tests/e2e/smoke.mjs`, game UI (`src/frontend/src/**`), GitHub workflow, `.gitignore` or dependency change is expected. If a builder finds one is necessary, it stops and asks (out of `files_owned` / ⚠️ Ask first). `opencode.jsonc` is edited through a shell command because the builder's `edit` allow-list does not cover it; the credential value/header is never printed.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Brevo SMTP relay, not the REST API | The existing `nodemailer` transport already sends raw MIME; no new dependency, no API key scopes, provider-neutral | Brevo API v3 (`/v3/smtp/email`), Brevo SDK — both add code/tests/dependency |
| 2 | `SMTP_PASS` holds the Brevo **SMTP key**, not the REST API key | The relay authenticates SMTP login + SMTP key; a REST key returns 535 | Rename to `BREVO_SMTP_KEY` — needless provider coupling; existing deploy catalog already has `SMTP_PASS` |
| 3 | Pin 587 STARTTLS; support 465 via `SMTP_SECURE` | Brevo's recommended port; avoids implicit-TLS cert/SNI quirks; 2525 remains a documented fallback | 465 default — known regional-certificate issue; 2525 default — nonstandard |
| 4 | `SMTP_SECURE` optional, derived from port 465 | Keeps Mailpit/legacy behavior unchanged while allowing explicit TLS | Require `SMTP_SECURE` always — breaks existing configs |
| 5 | `requireTLS` whenever credentials are set and `secure` is false | Prevents cleartext credential fallback; Mailpit (no auth) unaffected | Opportunistic STARTTLS — silently insecure |
| 6 | One `SMTP_CONNECTION_TIMEOUT_MS` sets connection, greeting and socket timeouts | Bounds unreachable and stalled-provider latency without three knobs; 10 s vs nodemailer's 120 s / 30 s / 10 min | Separate greeting/socket vars — unnecessary surface |
| 7 | Fail-fast config validation, no startup SMTP probe | `/healthz` must stay green while Brevo is down; delivery errors surface at register + CLI | `transporter.verify()` at boot — couples availability to the provider |
| 8 | Registration keeps HTTP 500 on transport failure | Existing behavior; account persists unverified and resend works; no queue in scope | 202 + background retry — needs outbox/state |
| 9 | Operator CLI reuses the production factory/template | Proves the real config and message path, not a synthetic ping | Raw socket/SMTP ping; Brevo API call (different credential) |
| 10 | Plain text unchanged; TTL passed for the HTML expiry note | Preserves the Mailpit fallback and token regex; makes the note truthful for `VERIFICATION_TOKEN_TTL_HOURS` | Hardcode 24h (lies when configured); change plain text (breaks degradation contract) |
| 11 | Public-URL PNG assets under `src/frontend/public/email/`, not CID | No attachment/multipart code, smaller messages, cacheable, block-safe CTA+URL; hosting already exists | CID attachments — image bloat, attachment heuristics, extra transport complexity |
| 12 | Raster assets authored by a committed built-ins-only Node script, PNGs committed | Reproducible and reviewable without external tools; no rasterizer dependency; `--check` proves drift | Ad-hoc generation with no source (r1 gap); SVG (Gmail strips); runtime generation (nondeterministic) |
| 13 | Split pure template into `email-template.ts` | Keeps `email.ts` transport-focused and template tests deterministic/fast | One 500-line module — harder to review/test |
| 14 | Brevo MCP read-only by reviewer/planner only | Enables account/sender verification without risking account changes or third-party sends; builder has no MCP access and the orchestrator is a strict router | Giving the builder/orchestrator MCP access — contradicts the agent permission model |
| 15 | Repository MCP credential lives in global OpenCode config; repo file stays tracked and reference-only | The owner's directive; a tracked file cannot be protected by `.gitignore`, and moving auth out of the repo removes the leak path | `git rm --cached` (removes the file from the repository and depends on an ignore rule for the local copy) / `skip-worktree` (fragile local index state) — the owner chose to keep the file tracked and sanitized instead |
| 16 | CLI failures run through `redactSecrets` | A nodemailer/auth error can embed the SMTP login or key; redaction is the only way to keep the "never printed" contract | Print only an error code — loses operator diagnosis |
| 17 | Full-tree credential audit including build logs | Build logs are exactly where raw command output lands; docs-excluded audits miss them | Diff-only/staged-only audit — vacuous when nothing is staged |
| 18 | KiB = 1024 bytes, pinned byte numbers | Removes the 60 KB vs 60 KiB ambiguity between ACs and task commands | Decimal KB — contradicts the existing `60*1024` checks |
| 19 | Task acceptance uses AC clause labels | Each task claims only what its verify proves; T9 remains the full gate | Whole-AC claims per task — over-claims unproven clauses (r1 F11) |

## Risks & mitigations

- **Images blocked by default (Outlook/Gmail)** → CTA is a background/table button with text, the raw URL is visible, both images have alt text; verification never depends on image loading.
- **Frontend asset 404 (deploy order, wrong `APP_BASE_URL`)** → email still works via CTA/URL; docs require `APP_BASE_URL` to be the public frontend origin; images deploy with the frontend step; T9 proves both local serving paths.
- **Generated asset text corruption / off-brand art** → deterministic script + reviewer visual inspection; if the wordmark is unreliable, use a cube-only hero plus an HTML text wordmark; assets are small and replaceable.
- **Asset drift (script and PNGs diverge)** → `--check` SHA-256 comparison is a T2 and T9 gate; the PNGs are committed artifacts.
- **HTML over Gmail's ~102 KiB clip** → budgets: HTML ≤ 20 KiB, hero ≤ 60 KiB, cube ≤ 15 KiB, total < 100 KiB; tests enforce in bytes.
- **Outlook ignores border-radius/gradients/chamfer** → square metallic border + solid CTA colors; no layout depends on radius or gradient.
- **Dark-mode inversion** → `color-scheme` meta and solid high-contrast colors; no light-only text on transparent backgrounds.
- **Mailpit token extraction breaks** → plain text unchanged and the HTML CTA/URL carry the raw alphanumeric token; a unit test runs the smoke regex and the smoke is a final gate.
- **SMTP outage blocks registration (500)** → CLI pinpoints config/auth/transport; account persists and resend recovers; no queue by scope.
- **Hung provider after accept** → `socketTimeout` is bounded by the same knob as connection/greeting; a stalled socket is destroyed instead of waiting nodemailer's 10-minute default.
- **Brevo 465 certificate/SNI mismatch** → 587 is the pinned recipe; 465 only via `SMTP_SECURE=true`, revisit with `tls.servername` only if the live check fails (Q-8).
- **Credential leakage** → env-only, `redactSecrets` on every CLI failure, full-tree/diff/build-log audits, `sync: false`; the MCP credential leaves the repository in T0 and lives only in the global config.
- **Tracked `opencode.jsonc` regains a key** → T0's guard + T9 audit fail on any key pattern in the tracked tree; the owner's "never pushed" statement bounds the rotation contingency.
- **Global config edit breaks the running session's MCP connection** → expected and documented; a session restart is acceptable and is not a build failure.
- **Scope creep into game UI** → `src/frontend/src/**` is read-only; only `public/email/` and `scripts/generate-email-assets.mjs` are added.

## Brevo MCP availability

A Brevo MCP server is available to the **reviewer** and **planner** agent sessions for read-only checks during review (for example confirming the relay host/port and that a sender/domain is verified). The builder has no MCP access (its skill/tool allow-list excludes it), and the orchestrator is a strict router with no read/execute tools, so neither can use the Brevo MCP. A live test email requires explicit user approval, only to an address the user controls, and the user records the outcome without credentials. Agents must not create/update/delete senders, domains, settings or keys, must not send to third parties, and must not copy any API key or secret into artifacts. The MCP auth header is user-owned global configuration (T0), not a repository artifact.

## Containerization impact

- No new service, image, port, volume or health signal; the backend image and `GET /ws` are unchanged, and `dist/auth/email-cli.js` ships via the existing `dist` copy.
- `compose.yaml` adds two environment passthroughs; Mailpit stays the default. `compose.smoke.yaml` pins the smoke backend's six SMTP fields to Mailpit so host Brevo exports cannot poison CI/smoke.
- `render.yaml` adds `SMTP_SECURE` and `SMTP_CONNECTION_TIMEOUT_MS` as `sync: false`; all SMTP values stay dashboard-supplied.
- The frontend image/Vercel build serves the two PNGs from `public/email/`; Vercel serves existing files before SPA rewrites, so no `vercel.json` change is needed. Payload < 100 KiB and no Dockerfile change. T9 proves serving from both the Vite dev container and the nginx prod image over the compose network.
- The asset generator is a repo script, not a build stage or image dependency.
- Conventions in `docs/architecture/containerization.md` are followed; none is reopened.

## Real-time impact

Out of scope. Email is a request/response auth side effect; no WebSocket protocol, connection lifecycle, reconnection, presence or server-authority behavior changes. The T0 config move affects editor/MCP configuration only, not the game's WebSocket path.

## Documentation impact

- `README.md`: env rows for `SMTP_SECURE`/`SMTP_CONNECTION_TIMEOUT_MS`; Brevo recipe (host/ports/SMTP login/SMTP key/not the REST API key/verified sender/From display name); CLI commands and expected line marked user-owned; branded email + `public/email/` asset hosting + image-blocked behavior + `SMTP_FROM` + subject; the documented deployed-origin asset check; a **Secret hygiene** note with the credential guard. Fixes the guest-only paragraph at line 183 (review time).
- `docs/architecture/deployment.md`: secrets/variables lists and Render `sync: false` catalog; email is no longer guest-only; no new secret name; no stale placeholder claims.
- `docs/architecture/vercel-render-neon.md`: environment catalog rows, Render service table, SMTP/email section (Brevo, `public/email/` assets served by the frontend origin, CLI, limits), troubleshooting, local-vs-cloud Email row, cost note; the local-vs-cloud invariants no longer claim the compose files are untouched (line 251 at review time).
- `docs/architecture/containerization.md`: § Frontend static delivery no longer claims `compose.yaml` is untouched; it records the two SMTP pass-throughs and the `compose.smoke.yaml` Mailpit pinning. No convention is changed.
- `docs/features/README.md`: builder proposes the feature row; the orchestrator applies it (file is orchestrator-owned).
- No containerization convention change: no service, image or port is added; only the stale "`compose.yaml` … untouched" sentence is corrected and the two SMTP pass-throughs are recorded.

## Testing strategy

- **Unit:** config parsing/validation; transport option objects (including `socketTimeout`); template structure/safety/expiry/assets/contrast/palette whitelist/relative-URL fallback; CLI parsing/output/redaction; `app.test.ts` factory seam and fail-fast.
- **Integration:** `buildApp` fail-fast + factory wiring; auth service TTL + failure/resend; auth route 500 mapping.
- **Containerized e2e:** clean-stack Mailpit-primed smoke with a hostile host `SMTP_*` environment; token extraction from the branded HTML; compose-network fetches of all four `/email/*.png` URLs (`200`, `image/png`, PNG signature).
- **Asset-tier:** `node src/frontend/scripts/generate-email-assets.mjs --check` + the PNG spec command (signature/dimensions/bytes).
- **Credential-tier:** per-task build-log grep; branch-diff, branch-history (`git log -p`), tracked-tree and untracked (`git grep --untracked`) guards; the guard self-test; T0's schema-aware JSONC/entry checks (repo reference shape vs. global `headers.Authorization`). No command prints a match.
- **Manual live:** documented user-owned CLI + registration check; no live Brevo access in CI.
- **Coverage:** `npm run coverage` ≥ 80% statements/branches/functions/lines per workspace; workspace-scoped pre-gates per behavior task; no exclusions, no snapshots, no wildcard matchers.
- **Evidence locations:** builder self-check → `build-log-T2.md`; reviewer visual approval → `reviews/code-r<n>.md`; raw command output for every task → `build-log-T<n>.md`; the full gate → `build-log-T9.md`.

## Open questions

See spec § Open questions. User-owned: Q-1 (SMTP key vs API key) blocks live delivery; Q-2 (sender identity/domain), Q-3 (live-delivery verifier), Q-5 (plan), Q-7 (production provisioning). Agent-decided with recorded defaults: Q-4 (587, 2525/465 fallback), Q-6 (shell export canonical, `.env` accepted), Q-8 (465 allowed, no pre-emptive SNI workaround), Q-10 (`APP_BASE_URL` origin + tested fallback). Resolved: Q-9 (asset script + visual sign-off). The MCP-credential question is resolved by the owner directive and T0 (spec § Pre-build repository configuration checkpoint).

## Backlog (r2 residuals not folded)

F21 (3-digit/named-color whitelist breadth), F22 (task/evidence mapping), F26 (dev-image generator wording), F27 (`js-yaml` provenance), F28 (explicit frontend build in T9), F29 (README line citation), F30 (superseded Fly doc), F31 (case-sensitive T8 phrasing) and F32 (broad T0 diff pattern) are recorded backlog and intentionally not changed in r4; no AC or scope change.
