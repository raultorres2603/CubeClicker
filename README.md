# CubeClicker

A web-based, online, real-time, multi-client clicker game — connected clients see each other's live activity.

## Gameplay

Players earn points by clicking the cube and progress through cube levels. Completing a cube grants a **lootbox** and a **key**; opening a lootbox with a key draws one random part from the **granular spaceship parts** catalog — a single part for one **part slot** (for example the port wing, the cockpit or one ignition), not a whole matched set. The catalog now holds **1,351 spaceship parts** across eleven **part slots**: each of the ten ship slots has three classic parts plus 120 generated parts (ten **chassis forms** × twelve **finishes**), and `shot` adds 120 generated **shot styles** plus its standard bolt. The **Spaceship Customization** menu (appearance editor) is a **tabbed spaceship hangar**: six tabs — `Frame`, `Front`, `Wings`, `Engines`, `Ignitions` and `Shots` — split the eleven **part slots** two per tab (one on `Shots`), each tab carries an `owned/<total>` count (244 on the five ship tabs, 120 on `Shots`), a **form and finish picker** narrows each row to its 3 classic or 12 finish cells instead of a thousand-row list, and after a lootbox reveal the hangar lands on the tab that holds the new part. It shows a live 3D preview and lets players equip or unequip each slot independently; the in-game pointer ship reflects the equipped appearance, including asymmetric left/right loadouts and the equipped **shot styles**. The world also renders **remote player spaceships**: while spectating another member, you see their ship with their equipped parts, chassis form and shot style, idling and firing as they clear tiles. Appearance and inventory are persisted per **account**; **guests** keep an ephemeral copy for the session and report it to the server so their ship is visible to others. (Features: `spaceship-customization`, see `docs/features/spaceship-customization/`; `spaceship-cursor-loot-animations`, see `docs/features/spaceship-cursor-loot-animations/`; `remote-spaceship-customization`, see `docs/features/remote-spaceship-customization/`.)

The game view is generated procedurally in code (no external models, textures, images, videos or other assets): a procedural nebula in purple/blue/pink with asteroids, meteors, an orange comet and a detailed blue/orange hero spaceship (layered hull, swept wings, twin glowing engines), an emerald beveled cube with golden spark bursts, and chamfered graphite-glass HUD panels with cyan energy rims and amber reward accents. The Neon Forge HUD restyles the play shell as one game interface: a pilot-status header with a level chip, a coins/keys/lootboxes resource strip, titled panels, rank medals, a crew count, a connection-status chip and a procedural scanline/vignette ambience layer over the canvas. The pointer-following spaceship cursor is also procedural — a small metallic craft with a framed canopy, swept wings, twin engines, panel seams and flames that banks and pitches as it follows the pointer, leaves a fire trail and pulses when its appearance changes. One motion language connects the loop: a hover reticle marks the target; a clicked mini-cube collapses over 140 ms and a small white-orange impact burst (white-hot core, amber embers and a smoke haze) joins green shard debris and spark particles (no click ray fan, no coin glyphs and no ring shockwave); the pointer ship fires its equipped **shot style** — a glowing tracer bolt by default — with a matching muzzle flash and a slight recoil; lootbox opening plays an animated 3D lootbox reveal that stages the won part on the player's own ship in the customization visualizer, and the non-modal stage closes on `Escape`, `Dismiss` or `Equip` (`Equip` also equips the part); level completion raises a full-screen banner. Opening the hangar or the crew list plays a CSS-only **glitch boot animation** — a 320 ms opacity flicker, top-edge scan sweep, rail power-up and stepped chromatic title split — and each hangar tab switch fades its two-row panel in over 140 ms; both are open-only (closing is instant) and reduced motion stops them. An automatic high/medium/low quality tier keeps the frame rate in budget — scaling SSAO and bloom, shadow-map resolution, and render resolution — and reduced motion replaces each of these animations with a static or instant variant. (Features: `reference-image-game-view`, `detailed-hero-spaceship`, `spaceship-cursor-loot-animations`, `game-feel-overhaul` and `hangar-tabs-and-menu-motion`; see `docs/features/spaceship-cursor-loot-animations/`, `docs/features/game-feel-overhaul/` and `docs/features/hangar-tabs-and-menu-motion/`.)

## Prerequisites

- **Running the environment:** Podman with a working compose provider (`podman compose`). No other host prerequisites.
- **Running the tooling commands (`npm …`):** Node.js 24 LTS + npm.

## Quickstart

```bash
podman compose up
```

This builds and starts the full local environment (backend + frontend + Postgres + Mailpit + Adminer containers) with hot reload:

| Surface | URL |
| --- | --- |
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8080 |
| WebSocket | ws://localhost:8080/ws |
| Mailpit (dev email capture) | http://localhost:8025 |
| Adminer (DB browser) | http://localhost:8081 |
| Postgres | localhost:5432 |

- Background: `podman compose up -d`
- First run, or after dependency/manifest changes: `podman compose up --build`
- Stop: `podman compose down`

Both ports are bound to loopback (`127.0.0.1`) only.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | install dependencies from the committed lockfile |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest unit tests, all workspaces |
| `npm run coverage` | Vitest with V8 coverage in all workspaces (thresholds ≥ 80% statements/branches/functions/lines per workspace) |
| `npm run build` | build all workspaces. The frontend build enforces the bundle budget (initial 150,000 B, Three.js 165,000 B, total 300,000 B gzip) and fails on a violation |
| `npm run dev` | start the full local environment with hot reload (equivalent to `podman compose up`) |
| `npm run smoke` | containerized end-to-end smoke test, including the production static-delivery checks (equivalent to `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`) |

### Performance benchmark

```bash
node --import tsx tests/bench/realtime-broadcast.mjs --mode in-process --json
node tests/bench/realtime-broadcast.mjs --mode wire --json
```

Both commands produce reproducible evidence recorded in the feature build logs; they are not a CI gate.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `BACKEND_PORT` | `8080` | host port published for the backend container (`127.0.0.1:${BACKEND_PORT}:8080`) |
| `FRONTEND_PORT` | `5173` | host port published for the frontend container (`127.0.0.1:${FRONTEND_PORT}:5173`) |
| `VITE_WS_URL` | `ws://localhost:8080/ws` | WebSocket URL the frontend connects to |
| `BACKEND_URL` | `http://backend:8080` | Base URL the Vite dev server proxies `/auth/*` to (host-only runs: `http://localhost:8080`) |
| `DB_PORT` | `5432` | host port published for the Postgres container |
| `MAILPIT_SMTP_PORT` | `1025` | host port published for Mailpit SMTP |
| `MAILPIT_UI_PORT` | `8025` | host port published for the Mailpit web UI |
| `ADMINER_PORT` | `8081` | host port published for the Adminer DB browser (`127.0.0.1:${ADMINER_PORT}:8080`) |
| `POSTGRES_USER` | `cubeclicker` | Postgres superuser name |
| `POSTGRES_PASSWORD` | `cubeclicker` | Postgres superuser password |
| `POSTGRES_DB` | `cubeclicker` | Postgres database name |
| `DATABASE_URL` | `postgres://cubeclicker:cubeclicker@db:5432/cubeclicker` | backend connection string (must match the Postgres credentials above if overridden) |
| `DB_SCHEMA_BOOTSTRAP_ENABLED` | `true` | startup schema bootstrap: after migrations and before `listen`, check the five required tables (`users`, `sessions`, `verification_tokens`, `user_economy`, `schema_migrations`) and create any missing one; `false` keeps migrations and skips only the bootstrap |
| `DB_EXPIRED_TOKEN_CLEANUP_ENABLED` | `true` | in-process expired-verification cleanup: after `listen`, delete `verification_tokens` rows with `expires_at <= now`; `false` starts no scheduler |
| `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` | `3600000` | delay in ms between cleanup runs, measured from the previous run's settlement; integer 60000–86400000 (default one hour) |
| `SMTP_HOST` | `mailpit` | SMTP host used by the local/off-Render backend (`mailpit` locally; `smtp-relay.brevo.com` for an off-Render Brevo relay) |
| `SMTP_PORT` | `1025` | SMTP port (`1025` local Mailpit; `2525` STARTTLS, `587` STARTTLS or `465` implicit TLS only for local/off-Render SMTP; the deployed API transport does not read it) |
| `SMTP_SECURE` | _(empty → derived: `true` when `SMTP_PORT` is `465`)_ | implicit TLS for the SMTP connection; `true`/`1`/`false`/`0`, empty derives it from the port |
| `SMTP_USER` | _(empty)_ | SMTP login (optional; must be set together with `SMTP_PASS`) |
| `SMTP_PASS` | _(empty)_ | SMTP password — the Brevo **SMTP key** (optional; must be set together with `SMTP_USER`) |
| `SMTP_FROM` | `no-reply@cubeclicker.local` | sender address for outbound email (`CubeClicker <verified sender>` for Brevo) |
| `SMTP_CONNECTION_TIMEOUT_MS` | `10000` | bound in ms for the SMTP connection, greeting and socket timeouts; integer 1000–120000 |
| `EMAIL_TRANSPORT` | `smtp` | outbound email transport: `smtp` (Mailpit/local) or `brevo-api` (deployed Brevo HTTPS API on port `443`) |
| `BREVO_API_KEY` | _(empty)_ | Brevo **REST API key**; required when `EMAIL_TRANSPORT=brevo-api`, supplied as a runtime secret and never committed or logged |
| `APP_BASE_URL` | `http://localhost:5173` | base URL used to build verification links and the email image URLs |
| `ALLOWED_ORIGIN` | `http://localhost:5173` | allowed Origin for state-changing auth requests (CSRF) |
| `SESSION_COOKIE_SECURE` | `false` | set the session cookie `Secure` flag (enable in production over HTTPS) |
| `LOG_LEVEL` | `debug` | backend Pino log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`); the compose backend passes it with default `debug` |
| `METRICS_ENABLED` | `true` | serve the `GET /metrics` route; compose defaults `true` on the loopback, the deployed Render service sets `false` (public host, no path filter); `false` removes the route (the path returns `404`) |
| `VITE_PERF_OVERLAY` | `false` | dev-only performance overlay; only the exact value `true` enables it (frontend build-time variable) |

The defaults work out of the box. `.env` files are user-owned and off-limits to agents; the canonical way to override a value is a shell export, e.g. `BACKEND_PORT=9090 podman compose up`, though a gitignored `.env` consumed by the compose provider works too because compose interpolates it. Secrets (database password, SMTP credentials) are supplied via environment variables at runtime and are never committed or baked into images.

### Vite dev proxy (host-only runs)

The frontend talks to the backend through same-origin relative paths (`/auth/*`) so the `HttpOnly` session cookie stays on the page origin and the backend's CSRF check (which compares `Origin`) succeeds. In the compose stack Vite proxies `/auth` to the `backend` service with `changeOrigin: false`, keeping the browser's page origin (`http://localhost:5173`) as the forwarded `Origin` header — this must match the backend's `ALLOWED_ORIGIN` (`http://localhost:5173` by default). For host-only development (running Vite on the host against a host backend), point the proxy at the host backend with `BACKEND_URL=http://localhost:8080`; the page origin is still `http://localhost:5173`, so `ALLOWED_ORIGIN` must remain `http://localhost:5173` (or you must run via `podman compose`, which sets both consistently).

## Email

Local `podman compose up` needs no email configuration: the backend defaults to the in-stack **Mailpit** capture container (`EMAIL_TRANSPORT=smtp`, `SMTP_HOST=mailpit`, `SMTP_PORT=1025`, UI at http://localhost:8025), and `compose.smoke.yaml` pins the smoke backend to that same Mailpit so host `SMTP_*` exports cannot redirect a smoke run to a real relay. Development and production deliver verification email through the Brevo HTTPS API on port 443; SMTP remains the local/off-Render transport. The deployed transport is selected with `EMAIL_TRANSPORT=brevo-api` and authenticated by the `BREVO_API_KEY` secret; the GitHub Environment is the source of truth, and the deploy workflow validates eleven names and syncs nine (`eleven validated, nine synced`) to Render before the deploy hook (see § Deployment Brevo runbook). The canonical transport contract is [`docs/architecture/email.md`](docs/architecture/email.md).

### Brevo HTTPS API (deployed)

The deployed backend sends `POST https://api.brevo.com/v3/smtp/email` over HTTPS port `443` with the `api-key` header, the branded template as `htmlContent`/`textContent`, and a fixed `10000` ms request timeout. `SMTP_FROM` is the sender for both transports; for the API it must parse as an address or `Display Name <address>` and must not be the local Mailpit default. A rejected send still returns HTTP `502` with code `verification_email_failed`; the account stays persisted and unverified, the just-issued token is invalidated, and a later resend recovers.

| Variable | Deployed API value |
| --- | --- |
| `EMAIL_TRANSPORT` | `brevo-api` |
| `BREVO_API_KEY` | the Brevo **REST API key** from **Settings → SMTP & API → API Keys**; a GitHub Environment secret, never the SMTP key |
| `SMTP_FROM` | a Brevo **verified sender**, with the display name when possible: `CubeClicker <verified sender>` |
| `APP_BASE_URL` | the public frontend origin (`https://<frontend-host>`); it drives the verification link and the email image URLs |

- The API key is created and rotated in Brevo under **Settings → SMTP & API → API Keys**; the SMTP key under **Settings → SMTP & API → SMTP** cannot authenticate the API. The key never appears in `render.yaml`, an image, the bundle, a log or a command argument; enter it through the GitHub UI or stdin.
- The API path uses the seven SMTP names only as catalogued deployment names: `SMTP_HOST` through `SMTP_CONNECTION_TIMEOUT_MS` stay synced for local/off-Render SMTP parity but are not read by the deployed API transport. The strict SMTP port guard remains in force.
- The startup probe logs `brevo_api_transport_verify_ok` (or `brevo_api_transport_verify_failed`) without blocking `/healthz`; on a failure rotate the key below and re-run the deploy.

### SMTP transport (local and off-Render)

`SMTP_HOST` is `smtp-relay.brevo.com` for an off-Render Brevo relay and `mailpit` locally. **Render free blocks outbound SMTP on ports 25, 465 and 587**, which is why deployed environments use the HTTPS API instead of SMTP. For a local/off-Render SMTP run, `SMTP_PORT=2525` with `SMTP_SECURE=false` (STARTTLS) works where that port is reachable; `587` (STARTTLS) and `465` (implicit TLS, `SMTP_SECURE=true`) are valid only where outbound SMTP is not blocked (a host run, a paid plan or another provider).

| Variable | SMTP value (local / off-Render) |
| --- | --- |
| `SMTP_HOST` | `smtp-relay.brevo.com` (off-Render) or `mailpit` (local) |
| `SMTP_PORT` | `1025` for Mailpit; `2525` (STARTTLS) where reachable; `587` (STARTTLS) or `465` (implicit TLS) only off Render free |
| `SMTP_SECURE` | `false` with `2525`; empty (derived: `465` → `true`, `587` → `false`) or an explicit `true`/`false` |
| `SMTP_USER` | the **SMTP login** shown on Brevo's SMTP page (`<id>@smtp-brevo.com`) |
| `SMTP_PASS` | the **SMTP key** from **Settings → SMTP & API → SMTP** — **not the REST API key** |
| `SMTP_FROM` | a Brevo **verified sender**, with the display name when possible: `CubeClicker <verified sender>` |
| `SMTP_CONNECTION_TIMEOUT_MS` | `10000` (optional; integer 1000–120000) |
| `APP_BASE_URL` | the public frontend origin (`https://<frontend-host>`); it drives the verification link and the email image URLs |

- **The credential is the SMTP key, not the REST API key.** The `xkeysib-…` REST API key cannot authenticate the SMTP relay; read or create the SMTP key on Brevo's **Settings → SMTP & API → SMTP** page and put it in `SMTP_PASS`. The SMTP login (`…@smtp-brevo.com`) is a separate value for `SMTP_USER`.
- `SMTP_USER` and `SMTP_PASS` are both-or-neither: setting only one fails startup with `SMTP_USER and SMTP_PASS must be provided together (both or neither)`.
- With credentials set and `SMTP_SECURE` off, STARTTLS is required, so the key is never sent cleartext; certificate verification stays enabled. `SMTP_CONNECTION_TIMEOUT_MS` bounds the connection, greeting and socket phases, so a stalled provider cannot hang registration.
- `SMTP_FROM` must be a Brevo-verified sender; the display name is passed through verbatim (`CubeClicker <verified sender>`). Sender verification plus SPF/DKIM/DMARC are Brevo-console/DNS actions owned by the repository owner.
- A transport failure returns HTTP `502` with code `verification_email_failed` on registration and on resend; the account stays persisted and unverified, the just-issued token is invalidated, and the pending screen (or § Registration recovery (development) below) offers a working resend.

The canonical local/off-Render SMTP setup is a shell export (a gitignored `.env` consumed by the compose provider is an accepted alternative; agents never read it):

```bash
export SMTP_HOST=smtp-relay.brevo.com
export SMTP_PORT=2525
export SMTP_SECURE=false
export SMTP_USER=<your-smtp-login>
export SMTP_PASS='<SMTP key>'
export SMTP_FROM='CubeClicker <your verified sender>'
export APP_BASE_URL=http://localhost:5173
podman compose up
```

### Branded verification email

Registration and resend send the branded CubeClicker HTML template plus the unchanged plain-text body; the subject stays `Verify your CubeClicker email`. The template is a 600 px table layout with inline CSS only (no web fonts, external stylesheet, `<script>`, `<svg>` or CSS background image), a preheader, hero, one `Verify email` CTA, a visible fallback URL, an accurate expiry note and a footer.

The two images are static files committed under `src/frontend/public/email/` and are referenced by absolute URL from `APP_BASE_URL`:

| Asset | Dimensions | Purpose |
| --- | --- | --- |
| `src/frontend/public/email/cubeclicker-hero.png` | 600×200 | starfield hero with the emerald cube and cyan `CUBECLICKER` wordmark |
| `src/frontend/public/email/cubeclicker-cube.png` | 72×72 | cube mark in the footer |

The existing frontend origin serves them at `/email/*.png` — the Vite dev server on 5173 locally, nginx in the frontend `prod` image, and Vercel when deployed. No new service, port, image or backend route is added, nothing is attached to the message (no CID parts), and `node src/frontend/scripts/generate-email-assets.mjs --check` proves the committed PNGs still match their deterministic source (the script is not part of `npm run build`).

The verification link and the email text still work when images are blocked: the CTA is a text/background button, every image carries `alt` text and explicit dimensions, and the full verification URL is printed below the button (Outlook blocks images by default and Gmail often does until the recipient opts in). If `APP_BASE_URL` is not an absolute URL, the image URLs fall back to relative `/email/…` and the CTA plus the visible URL keep working. Set `SMTP_FROM` to `CubeClicker <verified sender>` so the From line carries the game name.

Deployed-origin asset check (**documented-not-run**: the development frontend deploy is user-triggered and production is unprovisioned, so this is a recipe, not an automated check):

```bash
curl -fsSI https://<frontend-host>/email/cubeclicker-hero.png
# expect HTTP 200 and content-type: image/png
```

### Test-email CLI (user-owned check)

No automated test or CI job contacts Brevo; a live test email is **user-owned** because it needs the real API key or SMTP key and a recipient you control. The CLI loads the same configuration and transport factory as the backend and sends one message rendered with the branded template:

```bash
# Host tooling (tsx), from the repository root
npm run email:test --workspace @cubeclicker/backend -- --to <address>

# Built `dist` entry (also what a prod image contains)
node dist/auth/email-cli.js --to <address>

# Inside the running compose backend container
podman compose exec backend npm run email:test -w @cubeclicker/backend -- --to <address>
```

Prerequisites for the SMTP transport: `SMTP_USER` (SMTP login), `SMTP_PASS` (SMTP key) and a verified sender in `SMTP_FROM`. Expected success line:

```text
Test email sent to <address> via smtp-relay.brevo.com:2525 (secure=false, starttls=required, auth=yes, from="CubeClicker <verified sender>")
```

For the deployed API transport, set `EMAIL_TRANSPORT=brevo-api` and `BREVO_API_KEY`. Expected success line:

```text
Test email sent to <address> via Brevo API (api.brevo.com:443, transport=brevo-api, from="<SMTP_FROM>")
```

When `SMTP_FROM` is still the local default the CLI also prints `Warning: SMTP_FROM is the local default; set it to a verified sender before real delivery.` Failures exit `1`, and every failure line is redacted first, so neither the SMTP login, the SMTP key nor the API key can appear in the output. The link in the message is a synthetic `/verify?token=cli-test` URL: the CLI proves delivery and rendering, it does not verify an account.

### Secret hygiene

The email credentials are runtime-only: `SMTP_USER`, `SMTP_PASS` and `BREVO_API_KEY` live in your shell (or a gitignored `.env` consumed by the compose provider) and in the GitHub `development` Environment — the source of truth the deploy workflow syncs from to the Render service. They are never in `render.yaml`, an image, a log or a tracked file. The eleven deployment names are validated on every deploy: email and deployment secrets include `SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `RENDER_API_KEY`; deployment variables include `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_FROM`, `EMAIL_TRANSPORT`, `RENDER_SERVICE_ID`. The guard fails closed on a missing value or on any value containing `CHANGEME`. The API key is the Brevo **REST API key** from **Settings → SMTP & API → API Keys**; the SMTP key is a separate credential and only the SMTP key belongs in `SMTP_PASS`.

Two key shapes are never valid in a tracked file: a Brevo REST key (`xkeysib-[A-Za-z0-9]{20,}`) and an SMTP key (`xsmtpsib-[A-Za-z0-9]{15,}`). The pinned guard fails on either pattern, on a credential-looking `SMTP_(USER|PASS)` or `BREVO_API_KEY` assignment, on a `RENDER_API_KEY=` assignment, or on a Render key shape (`rnd_[A-Za-z0-9_-]{20,}`) anywhere in the tracked tree, the untracked files, the branch diff or the branch history:

```bash
! git grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
! git grep --untracked -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
! git diff origin/main...HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
! git log -p origin/main..HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|BREVO_API_KEY=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
```

Documented placeholders use angle brackets (`SMTP_USER=<your-smtp-login>`, `SMTP_PASS=<SMTP key>`) so they cannot look like values. The Brevo MCP credential is likewise user-owned and lives only in the global OpenCode config (`~/.config/opencode/`), never in the tracked `opencode.jsonc`.

## Operations

Structured JSON logs go to stdout and are read from the backend container with:

```bash
podman compose logs backend
```

The backend serves a Prometheus-text metrics endpoint on its existing port. Locally it is enabled by default and reachable only through the loopback mapping; scrape it from the host with:

```bash
curl http://localhost:8080/metrics
```

Deployed Render environments set `METRICS_ENABLED=false` (`render.yaml` plus the live service variables), so `GET /metrics` returns `404` on the public API host. Render serves the whole backend on one public host with no path filter, and `/metrics` is excluded from the CORS grant, so the frontend origin cannot read it. To scrape a deployed app deliberately, set `METRICS_ENABLED=true` on the Render service (dashboard) and restart it, scrape the public host, then set it back to `false`; because there is no path filter, treat that short window as an audited exception, not an internal-network guarantee. Metrics are per-process aggregates and reset when the backend restarts (and when the free instance spins down). The full log-event, redaction, catalog and retention reference is [`docs/architecture/observability.md`](docs/architecture/observability.md).

The compose backend passes `LOG_LEVEL` (default `debug`) and `METRICS_ENABLED` (default `true`), and the frontend passes `VITE_PERF_OVERLAY` (default `false`). Override them from the shell:

```bash
LOG_LEVEL=warn podman compose up
METRICS_ENABLED=false podman compose up
VITE_PERF_OVERLAY=true podman compose up
```

`VITE_PERF_OVERLAY=true` shows the dev-only performance overlay (frame time, quality tier, draw calls, triangles and WebSocket RTT). It is a build-time Vite variable: a running dev server must be restarted to pick it up, and production builds leave it unset.

### Database lifecycle

With a database configured, the backend runs two database lifecycle services inside its existing process; no new service, image, port or route is added.

- **Startup: migrations → schema bootstrap → listen.** On one dedicated direct-URL `pg.Client`, the backend acquires a session-level Postgres advisory lock (retrying every 250 ms for at most 30 s), applies pending numbered migrations, then checks the five required tables (`users`, `sessions`, `verification_tokens`, `user_economy`, `schema_migrations`). A missing table and its indexes are created with idempotent `CREATE ... IF NOT EXISTS` DDL in one transaction per table; a required column missing from an existing table is logged as `db_schema_table_outdated` and never altered. `db_schema_bootstrap_completed` (`checked`, `created`, `outdated`, `durationMs`) summarizes the check and `db_startup_completed` closes the phase. A connect, lock, migration or table-creation failure logs `db_startup_failed` and exits `1` without listening. `DIRECT_DATABASE_URL` wins on Neon; when it is absent, the fallback `DATABASE_URL` must be direct/session-capable (the local compose Postgres is direct, while a pooled `-pooler` URL cannot carry a session advisory lock).
- **After listen: expired-verification cleanup.** The in-process scheduler deletes only `verification_tokens` rows with `expires_at <= now` once immediately and then `DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS` after each run settles (default one hour; 60,000–86,400,000 ms). Each run logs `db_verification_cleanup_run` (`deleted`, `durationMs`; `info` when rows were deleted, `debug` when none); a failed run logs `db_verification_cleanup_failed` and never stops the next scheduled run. `SIGTERM`/`SIGINT` stops the scheduler before the pool closes.
- **Opt-outs and no-database mode.** `DB_SCHEMA_BOOTSTRAP_ENABLED=false` still applies migrations and skips the bootstrap; `DB_EXPIRED_TOKEN_CLEANUP_ENABLED=false` starts no cleanup scheduler. With neither database URL set (host-only runs), both services are skipped and the backend uses the in-memory repositories. An invalid or empty value fails startup naming the variable.

The compose backend passes all three names with the defaults above; override them from the shell:

```bash
DB_SCHEMA_BOOTSTRAP_ENABLED=false podman compose up
DB_EXPIRED_TOKEN_CLEANUP_INTERVAL_MS=600000 podman compose up
```

The full log-event, redaction, level and catalog reference is [`docs/architecture/observability.md`](docs/architecture/observability.md) § Database lifecycle events.

## Production images

```bash
podman build --format docker --target prod -f src/backend/Dockerfile .
podman build --format docker --target prod -f src/frontend/Dockerfile .
```

The `--format docker` form keeps the image `HEALTHCHECK`, which Podman 5's default OCI build format would drop.

Both images are provider-neutral deployables: Render builds and runs the backend `prod` image from `render.yaml`, while Vercel builds the static SPA directly from `src/frontend`; the frontend nginx `prod` image remains for local runs, the containerized smoke suite and portability. The deployed commit SHA is the release identity (see the Deployment section below).

The frontend image serves the code-split production build through nginx: the auth/menu entry is Three.js-free (the game runtime and the customization preview are lazy chunks), responses are gzip-compressed (`gzip_comp_level 6`), hashed `/assets/*` files carry `Cache-Control: public, max-age=31536000, immutable`, and the app shell (`/`, `/index.html`, and the SPA fallback) carries `Cache-Control: no-cache` so a deploy is picked up without stale JavaScript. `npm run smoke` includes the production static-delivery checks: it starts the smoke-only `frontend-prod` service (prod target, no published host port; the compose provider builds the image on first use) and asserts the wire headers, gzip encoding, and the served chunk graph from `/bundle-report.json`. Brotli is not enabled: the `nginxinc/nginx-unprivileged:1.27-alpine` base image has no `ngx_brotli` module, and a custom nginx build is out of scope.

## Stack

TypeScript (strict) on Node.js 24 LTS: a Fastify backend (HTTP health at `GET /healthz`, WebSocket at `GET /ws`) and a React + Vite frontend, in an npm-workspaces repo (`src/backend`, `src/frontend`) tested with Vitest and linted with ESLint. The frontend connects to the backend over WebSocket; the containerized smoke test (`npm run smoke`) proves that path through the container network with two concurrent clients.

- `docs/architecture/stack.md` — the decided application stack and the canonical commands
- `docs/architecture/containerization.md` — the settled container conventions (ports, env names, health, images, compose files)
- `docs/architecture/skills.md` — the six project pipeline skills in `.opencode/skills/`, the per-agent allow-lists, and the `skill` rule contract (library/platform documentation comes from Context7 MCP)

## Deployment

CubeClicker deploys to **Vercel + Render + Neon**, driven by GitHub Actions with two GitHub Environments. The local development path above is unchanged. Full conventions: [`docs/architecture/deployment.md`](docs/architecture/deployment.md); architecture, exact environment catalog, runbook, rollback, local-vs-cloud and cost/limits: [`docs/architecture/vercel-render-neon.md`](docs/architecture/vercel-render-neon.md).

| Surface | Platform |
| --- | --- |
| Frontend (static SPA) | Vercel, built from `src/frontend` |
| Backend (`/auth/*`, `/healthz`, `/ws`) | Render, one free Docker web service (`render.yaml`) |
| PostgreSQL | Neon, `development` branch (production intended, not provisioned) |

- `development` deploys from `main`: a push runs CI once, and a successful CI run triggers the Deploy workflow. It uses the Neon `development` branch, the Render service `cubeclicker-development` and the stable `cubeclicker-development.vercel.app` host. It can also be deployed manually: **Actions → Deploy → Run workflow** with `environment: development`, or `gh workflow run deploy.yml --ref main -f environment=development`. The job first requires a successful CI run for that commit, then runs the same steps as the automatic path; manual and automatic development runs share the `deploy-development` concurrency group (`cancel-in-progress: false`). The `environment` input defaults to `production`; select `development` before running.
- `production` is **not provisioned** and stays `placeholder-only`: reachable only through a manual `workflow_dispatch` with `environment: production`. The production catalog defines eleven names with six pinned placeholders, and `no Render service, Vercel project or Neon branch is provisioned`; no protection rules are configured. A production deploy needs a production Render service, a production Vercel project, a Neon `production` branch and the values filled in, and reviewer/branch protection must be added before it is used. The production catalog is a code/documentation contract; no live production environment is modified.
- The backend keeps all in-memory game/room state; one instance is deliberate. Vercel hosts only the static frontend (no functions, no serverless WebSocket).
- The Render free instance spins down after 15 minutes without traffic and cold-starts (~30–60 s) on the next request or WebSocket connection. While clients are connected it stays awake. This is development-only; see the deployment reference for the reconnect behavior.
- Render has no platform health check configured for the service (`healthCheckPath` is empty, and `render.yaml` declares none); the Deploy workflow itself polls `/healthz` before the frontend step.

### What the pipelines run

- `ci.yml` (runs on pull requests and pushes to `main`):
  - `verify-app`: `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run coverage` → `npm run build`.
  - `smoke-e2e`: pre-start Mailpit (`docker compose -f compose.yaml -f compose.smoke.yaml up -d mailpit`) **before** `docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` (the one-shot run never starts Mailpit and fails 9/12; pre-started passes 12/12).
  - `verify-workflows`: `npm ci` on Node 24 → pinned `rhysd/actionlint:1.7.12` over both workflows → a `node -e` JSON parse of `src/frontend/vercel.json` → a YAML parse of `render.yaml` that checks the service name/runtime/plan and that no platform health check is declared → a `dispatch choices` parse that pins both `workflow_dispatch` choices, the `production` default and the unchanged `workflow_run` path → a guard that `deploy.yml` never mentions Fly → `Guard rejects placeholder values` (a credential-free `--check-only` fixture that must exit non-zero and print the exact `'production'` block header) → `Guard accepts a complete value set` (the same CLI with the complete `development` fixture, asserting the exact success line). Every fixture value is an angle-bracket placeholder or shorter than 12 characters, so the repository credential guard cannot match it.
- `deploy.yml` (`workflow_run` after a successful CI run on `main`, or `workflow_dispatch` for development or production): one `deploy` job in the environment selected by the event (`development` after CI or a manual development dispatch, `production` for a production dispatch) — `Check deployment Brevo configuration` (eleven values, `--check-only`, no network) → Neon migration with the direct URL → `Sync Brevo SMTP settings to Render` (nine deployed names through the Render API: the seven SMTP names plus `EMAIL_TRANSPORT` and `BREVO_API_KEY`) → Render deploy hook → 45 s wait → `/healthz` poll → Vercel build/deploy `--prod` → warm + deployed smoke. It does not re-run CI. Runs for the same environment are serialized (`cancel-in-progress: false`).

### Deploy flow

1. Merge or push to `main`, or dispatch the Deploy workflow with `environment: development` for a commit whose CI already succeeded; a manual dispatch does not re-run CI.
2. CI runs once (lint, typecheck, test, coverage, build, containerized smoke, workflow/config checks, and the two Brevo guard fixtures).
3. After CI succeeds, `Check deployment Brevo configuration` validates the eleven GitHub Environment values (`--check-only`, no network) and fails the job before any provider is touched when a value is missing or still contains `CHANGEME`.
4. Deploy applies pending Neon migration with `DIRECT_DATABASE_URL`, then `Sync Brevo SMTP settings to Render` writes the nine deployed names (the GitHub Environment is the source of truth), then `POST`s the Render deploy hook, waits 45 s and requires `/healthz` to return HTTP `200` within 180 s. Render has no platform health check configured; this workflow poll is the health gate.
5. Vercel builds from `src/frontend` with `VITE_CLOUD_DEPLOY=true` and the environment's API/WS URLs and deploys the prebuilt output to the production target (`--prod` updates `cubeclicker-development.vercel.app`; no separate alias step).
6. `node tests/e2e/deployed-smoke.mjs` proves health, allowed and disallowed CORS preflight, SPA fallback, a real `/assets/*` 404 and a WebSocket hello/join/click plus the disallowed-Origin `403`.

Rollback, migrations, DNS/cookies and the single-instance trade-off are documented in [`docs/architecture/deployment.md`](docs/architecture/deployment.md); the architecture and runbook are in [`docs/architecture/vercel-render-neon.md`](docs/architecture/vercel-render-neon.md). The previous Vercel/Fly reference is retained, marked SUPERSEDED, at [`docs/architecture/vercel-fly-neon.md`](docs/architecture/vercel-fly-neon.md).

### User-side asset checklist (one-time, performed by the repository owner)

The `development` GitHub Environment is provisioned with the exact secrets/variables catalogued in [`docs/architecture/vercel-render-neon.md`](docs/architecture/vercel-render-neon.md) § Environment catalog. The eleven deployment names are the source of truth the deploy workflow validates, and nine are synced to Render (`eleven validated, nine synced`):

- Secrets: `VERCEL_TOKEN`, `RENDER_DEPLOY_HOOK_URL`, `DATABASE_URL`, `DIRECT_DATABASE_URL`, `SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `RENDER_API_KEY`.
- Variables: `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `FRONTEND_ORIGIN`, `VITE_API_URL`, `VITE_WS_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_FROM`, `EMAIL_TRANSPORT`, `RENDER_SERVICE_ID`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`, `MAX_USERS_PER_SERVER`.

Also required: a Vercel project whose Root Directory is `src/frontend` (Node 24, deployment protection disabled for development), one Render free Docker web service tracked to `main` with auto-deploy off (the deploy workflow writes the nine deployed names to it before the hook), one Neon project with a `development` branch, and the stable frontend host per environment. Production is `placeholder-only`: the production catalog defines eleven names with six pinned placeholders, but `no Render service, Vercel project or Neon branch is provisioned` and no protection rules are configured; it must be provisioned — including required reviewers and a deployment branch policy — before use. Development email uses the Brevo HTTPS API on port 443 (`EMAIL_TRANSPORT=brevo-api` plus the `BREVO_API_KEY` secret), synced from the GitHub Environment; no Mailpit container runs in the cloud (§ Email). The production catalog is a code/documentation contract; no live production environment is modified. `RENDER_API_KEY` and `RENDER_SERVICE_ID` are pipeline wiring only and are `never written to the Render service`; the other `sync: false` Render names (`DATABASE_URL`, `DIRECT_DATABASE_URL`, `CORS_ORIGIN`, `ALLOWED_ORIGIN`, `APP_BASE_URL`, `SESSION_COOKIE_*`) `stay dashboard-owned` and are `never synced`. No secret value is committed; the archived AWS tree and the archived Fly configs are not deployed.

### Deployment Brevo runbook

The deploy workflow treats the GitHub Environment as the single source of truth for deployment email: `Check deployment Brevo configuration` validates **eleven** names (seven variables, four secrets) and `Sync Brevo SMTP settings to Render` writes the nine deployed names to the Render service before the deploy hook — eleven validated, nine synced. `RENDER_SERVICE_ID` (URL path coordinate) and `RENDER_API_KEY` (bearer credential) are validated but **never written to the Render service**. The guard is strict: it fails closed on a missing value or on any value containing `CHANGEME`, and a production dispatch therefore stops at `Check deployment Brevo configuration` before any provider is touched.

Deployed delivery is the Brevo HTTPS API on port `443`; the seven SMTP names stay catalogued and synced for local/off-Render parity but are not read by the deployed API transport.

The catalog and its state (names only; no value is recorded here):

| Name | GitHub type | `development` state | `production` value | Synced to Render? |
| --- | --- | --- | --- | --- |
| `SMTP_HOST` | variable | preserved (existing) | `smtp-relay.brevo.com` | yes |
| `SMTP_PORT` | variable | `2525 (set before merge)` | `587` | yes |
| `SMTP_SECURE` | variable | `false` (set before merge) | `false` | yes |
| `SMTP_CONNECTION_TIMEOUT_MS` | variable | created by T5 (`10000`) | `10000` | yes |
| `SMTP_FROM` | variable | preserved (existing; the Brevo-verified sender) | `<CHANGEME-verified-sender>` | yes |
| `SMTP_USER` | secret | preserved (existing; the variable value moved to the secret) | `<CHANGEME-smtp-login>` | yes |
| `SMTP_PASS` | secret | preserved (existing; never read by the API transport) | `<CHANGEME-smtp-key>` | yes |
| `EMAIL_TRANSPORT` | variable | `brevo-api` (set before merge) | `brevo-api` (pinned constant) | yes |
| `BREVO_API_KEY` | secret | set before merge (owner) | `<CHANGEME-brevo-api-key>` | yes |
| `RENDER_SERVICE_ID` | variable | created by T5 (`srv-dbtcvv9srm7s73au5bag`) | `<CHANGEME-render-service-id>` | no — URL path only |
| `RENDER_API_KEY` | secret | placeholder created by T5 | `<CHANGEME-render-api-key>` | no — bearer header only |

The production column is a code/documentation catalog: it defines all eleven names with six pinned placeholders (`SMTP_FROM`, `SMTP_USER`, `SMTP_PASS`, `BREVO_API_KEY`, `RENDER_SERVICE_ID`, `RENDER_API_KEY`) and five pinned constants. The production catalog is a code/documentation contract; no live production environment is modified. The strict SMTP port guard still requires `SMTP_PORT=2525` with `SMTP_SECURE=false` for `development` even though the API transport does not read the relay; the production `587` is placeholder-only until production is provisioned.

**Entering values (UI path).** GitHub → repository → **Settings → Environments → <environment>**; open the **Environment variables** area for a variable or the **Environment secrets** area for a secret and enter the value there. The UI is for entering values only, never as verification evidence; a real secret value is entered through the UI or stdin, never as a command argument or in a file. The placeholder `--body` commands below are the only value-bearing commands in this runbook.

**Exact `gh` commands (22 lines).** These are the exact per-environment create/refresh commands with the pinned literals and placeholders: eleven commands per environment (seven variables, four secrets), 22 lines total. The `development` block is the reference form for a clean environment: the provisioned `development` Environment already holds the preserved values; this feature requires `EMAIL_TRANSPORT=brevo-api` and a real `BREVO_API_KEY` secret before merge, refreshes `SMTP_PORT` to `2525` (with `SMTP_SECURE=false`), and keeps `RENDER_SERVICE_ID`/`RENDER_API_KEY` wiring non-empty, so do not overwrite the other preserved names (the `SMTP_USER` variable-to-secret move is the sequence in § `SMTP_USER` migration below). Replace the angle-bracket `BREVO_API_KEY` placeholder through the UI or stdin, never as a command argument. Run the `production` block only when provisioning production; production stays placeholder-only until then.

```bash
# development
gh variable set SMTP_HOST --env development --repo raultorres2603/CubeClicker --body 'smtp-relay.brevo.com'
gh variable set SMTP_PORT --env development --repo raultorres2603/CubeClicker --body '2525'
gh variable set SMTP_SECURE --env development --repo raultorres2603/CubeClicker --body 'false'
gh variable set SMTP_CONNECTION_TIMEOUT_MS --env development --repo raultorres2603/CubeClicker --body '10000'
gh variable set SMTP_FROM --env development --repo raultorres2603/CubeClicker --body '<CHANGEME-verified-sender>'
gh variable set EMAIL_TRANSPORT --env development --repo raultorres2603/CubeClicker --body 'brevo-api'
gh variable set RENDER_SERVICE_ID --env development --repo raultorres2603/CubeClicker --body 'srv-dbtcvv9srm7s73au5bag'
gh secret set SMTP_USER --env development --repo raultorres2603/CubeClicker --body '<CHANGEME-smtp-login>'
gh secret set SMTP_PASS --env development --repo raultorres2603/CubeClicker --body '<CHANGEME-smtp-key>'
gh secret set BREVO_API_KEY --env development --repo raultorres2603/CubeClicker --body '<CHANGEME-brevo-api-key>'
gh secret set RENDER_API_KEY --env development --repo raultorres2603/CubeClicker --body '<CHANGEME-render-api-key>'

# production (placeholder-only)
gh variable set SMTP_HOST --env production --repo raultorres2603/CubeClicker --body 'smtp-relay.brevo.com'
gh variable set SMTP_PORT --env production --repo raultorres2603/CubeClicker --body '587'
gh variable set SMTP_SECURE --env production --repo raultorres2603/CubeClicker --body 'false'
gh variable set SMTP_CONNECTION_TIMEOUT_MS --env production --repo raultorres2603/CubeClicker --body '10000'
gh variable set SMTP_FROM --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-verified-sender>'
gh variable set EMAIL_TRANSPORT --env production --repo raultorres2603/CubeClicker --body 'brevo-api'
gh variable set RENDER_SERVICE_ID --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-render-service-id>'
gh secret set SMTP_USER --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-smtp-login>'
gh secret set SMTP_PASS --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-smtp-key>'
gh secret set BREVO_API_KEY --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-brevo-api-key>'
gh secret set RENDER_API_KEY --env production --repo raultorres2603/CubeClicker --body '<CHANGEME-render-api-key>'
```

**Names-only verification.** These listing commands and API forms print names only, never values:

```bash
gh variable list --env development --repo raultorres2603/CubeClicker --json name --jq '.[].name'
gh secret list --env development --repo raultorres2603/CubeClicker --json name --jq '.[].name'
gh variable list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name'
gh secret list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name'
gh api repos/raultorres2603/CubeClicker/environments --jq '.environments[].name'
# single-environment fallback forms (some gh/api versions return one object):
gh api repos/raultorres2603/CubeClicker/environments/development --jq '.name'
gh api repos/raultorres2603/CubeClicker/environments/production --jq '.name'
```

**`SMTP_USER` migration (variable → secret).** GitHub variables and secrets are separate contexts (`vars.SMTP_USER` vs `secrets.SMTP_USER`), so a leftover variable is hygiene, not a shadowing risk; the deploy workflow reads `secrets.SMTP_USER` only. In `development` the value was moved in-process, never printed: `gh variable get SMTP_USER --env development` reads it into a shell variable, the value is piped into `gh secret set SMTP_USER --env development` on stdin, and the temporary variable is unset before the conditional `gh variable delete SMTP_USER --env development`. In `production`, which has no such variable today, only the conditional delete is documented. Real values are never passed as a command argument.

```bash
if gh variable list --env development --repo raultorres2603/CubeClicker --json name --jq '.[].name' | grep -qx SMTP_USER; then
  smtp_user_value=$(gh variable get SMTP_USER --env development --repo raultorres2603/CubeClicker)
  printf '%s' "$smtp_user_value" | gh secret set SMTP_USER --env development --repo raultorres2603/CubeClicker
  unset smtp_user_value
  gh variable delete SMTP_USER --env development --repo raultorres2603/CubeClicker
fi
if gh variable list --env production --repo raultorres2603/CubeClicker --json name --jq '.[].name' | grep -qx SMTP_USER; then
  gh variable delete SMTP_USER --env production --repo raultorres2603/CubeClicker
fi
```

**Supersession, rotation and merge ordering.** This feature supersedes the SMTP delivery recipe for deployed environments: `EMAIL_TRANSPORT=brevo-api` with a Brevo REST API key replaces Brevo SMTP delivery on `2525`, while SMTP remains the local/off-Render transport. Create a replacement key under Settings → SMTP & API → API Keys, update the `BREVO_API_KEY` GitHub Environment secret (UI or stdin), re-run **Deploy**, confirm `brevo_api_transport_verify_ok`, then revoke the old key. The feature requires EMAIL_TRANSPORT and BREVO_API_KEY before merge (the `development` variable and secret); if either is missing, the first post-merge Deploy fails closed at `Check deployment Brevo configuration`. Because the earlier T9 values were applied after the merge and the first Deploy was re-run, the owner proof log records the AC-11(a) ordering deviation rather than claiming AC-11(a) closed.

**Source of truth.** The nine deployed names are written to Render by the deploy workflow from the GitHub Environment; GitHub is the source of truth; Render dashboard edits are reverted on the next deploy. Only those nine names are written — `RENDER_API_KEY` and `RENDER_SERVICE_ID` are never written to the service, and the remaining `sync: false` names stay dashboard-owned.

#### Deployed proof (user-owned)

After the owner sets `EMAIL_TRANSPORT=brevo-api` and `BREVO_API_KEY` in the `development` Environment, fills the development `RENDER_API_KEY`, and merges, the first development deploy is the live proof. Record it as user-owned; no CI job contacts Brevo and no value is printed:

1. The deploy run shows nine `SYNCED <KEY>` lines (the seven SMTP names plus `EMAIL_TRANSPORT` and `BREVO_API_KEY`), including `SYNCED EMAIL_TRANSPORT (value verified, not shown)` and `SYNCED BREVO_API_KEY (value verified, not shown)`, and the summary `Synced 9 value(s) to Render service <id> for the 'development' environment.`
2. The Render deploy list shows no deploy between the sync and the hook; if the per-key write does trigger a deploy, record the documented mitigation (cancel it before the hook or let both finish and re-run the post-deploy checks).
3. The Render dashboard lists the nine deployed names (names only).
4. `curl -fsS "$VITE_API_URL/healthz"` returns `{"status":"ok"}`.
5. The Render logs show `brevo_api_transport_verify_ok` with `host=api.brevo.com` and `port=443`; a failed probe shows `brevo_api_transport_verify_failed`.
6. A registration or resend from the deployed frontend delivers the verification email through the Brevo HTTPS API to a mailbox the owner controls. A rejected send returns HTTP `502` with code `verification_email_failed`; the account stays persisted and unverified, and a later resend recovers.
7. A Render free web service has no shell, so the deployed-container `email:test` recipe is only available on a paid plan; the local `npm run email:test` equivalent with the same API key is the CLI check (its API success line is in § Test-email CLI).
8. The GitHub UI is for entering values only, never as verification evidence; the proof is the run output, the names-only listing, the Render probe line and the delivery result.

#### Rollback and rotation

- **Wrong value:** correct it in the GitHub Environment and re-run the deploy workflow; the sync rewrites all nine deployed names, so no partial state survives.
- **Bad deployed revision:** Render dashboard → service → **Deploys → Rollback** to the last known-good deploy (this bypasses the workflow and the guard), or revert on `main` and let CI → Deploy rebuild once the GitHub values are valid.
- **Brevo API key:** Create a replacement key under Settings → SMTP & API → API Keys, update the `BREVO_API_KEY` GitHub Environment secret (stdin or UI, never a command argument), re-run the workflow, confirm `brevo_api_transport_verify_ok`, then revoke the old key. The new instance reads the replacement through the sync; the old key stops working after revocation.
- **Render API key:** rotate it in Render, update the `RENDER_API_KEY` GitHub Environment secret (stdin or UI, never a command argument), and re-run the workflow. A revoked key fails the preflight/sync with a clear message and never reaches the running instance; the key is never a Render service variable, so rotation does not touch the service environment.
- **Dashboard-only emergency fix:** it applies at the next deploy only and is then overwritten from GitHub; make the same change in the GitHub Environment to persist it.

### Registration recovery (development)

Deployed delivery uses the Brevo HTTPS API on port `443`, so Render's outbound SMTP block (ports 25, 465 and 587) no longer applies to verification email. If registration or resend returns HTTP `502` with code `verification_email_failed`, the account remains persisted and unverified, the just-issued token is invalidated, and a later resend issues a fresh one.

**Check the deployed transport.** In the GitHub `development` Environment, confirm `EMAIL_TRANSPORT=brevo-api` and that `BREVO_API_KEY` holds a Brevo **REST API key** from **Settings → SMTP & API → API Keys** (not the SMTP key). Set `BREVO_API_KEY` to the Brevo API key from **Settings → SMTP & API → API Keys** and re-run **Deploy**; the deployed API transport does not use an SMTP key. The guard fails closed before any provider call when a value is missing or still contains `CHANGEME`.

**Redeploy and health.** Re-run the latest **Deploy** workflow (Actions → Deploy → **Re-run all jobs**) or push a commit to `main`; the sync writes the nine deployed names to Render and restarts the instance. Confirm `curl -fsS https://cubeclicker-development.onrender.com/healthz` returns `{"status":"ok"}`.

**Check the probe.** The new Render instance logs `brevo_api_transport_verify_ok` with `host=api.brevo.com` and `port=443`; a rejected probe logs `brevo_api_transport_verify_failed` with `errorType` and an optional `transportCode` (for example `HTTP_401` or `HTTP_403`).

**Resend and verify the stale account.** Sign in and use **Resend verification email** on the pending screen, or call the unauthenticated resend endpoint directly:

```bash
curl -i -X POST https://cubeclicker-development.onrender.com/auth/resend-verification \
  -H "Origin: <frontend origin>" \
  -H "Content-Type: application/json" \
  --data '{"email":"<the account email>"}'
# expect HTTP 202 {"message":"verification email sent"}
```

A failed send returns HTTP `502` with code `verification_email_failed`; the account stays persisted and unverified, the just-issued token is invalidated, and a later resend issues a fresh one.

**If the resend still fails.** Check the Brevo side: run `npm run email:test --workspace @cubeclicker/backend -- --to <owner-address>` with `EMAIL_TRANSPORT=brevo-api` and the same key (the API success line is in § Test-email CLI), then check the Brevo transactional log and the verified sender. If the key is the problem, create a replacement key under Settings → SMTP & API → API Keys, update the `BREVO_API_KEY` GitHub Environment secret, re-run Deploy and revoke the old key.

**Exact desired pair.** The desired username + account email still cannot register while one unverified row holds the username and the other holds the email; cleanup is owner-only (Q-1: delete both unverified rows or keep the stale account), and no code deletes or merges rows. Production remains unprovisioned; its catalog defines eleven names and six pinned placeholders.
