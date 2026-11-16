# CubeClicker

A web-based, online, real-time, multi-client clicker game — connected clients see each other's live activity.

## Gameplay

Players earn points by clicking the cube and progress through cube levels. Completing a cube grants a **lootbox** and a **key**; opening a lootbox with a key draws one random part from the **granular spaceship parts** catalog — a single part for one **part slot** (for example the port wing, the cockpit or one ignition), not a whole matched set. The **Spaceship Customization** menu (appearance editor) shows a live 3D preview and lets players equip or unequip each slot independently; the in-game pointer ship reflects the equipped appearance, including asymmetric left/right loadouts. Appearance and inventory are persisted per **account**; **guests** keep an ephemeral copy for the session. (Features: `spaceship-customization`, see `docs/features/spaceship-customization/`; `spaceship-cursor-loot-animations`, see `docs/features/spaceship-cursor-loot-animations/`.)

The game view is generated procedurally in code (no external models, textures, images, videos or other assets): a procedural nebula in purple/blue/pink with asteroids, meteors, an orange comet and a detailed blue/orange hero spaceship (layered hull, swept wings, twin glowing engines), an emerald beveled cube with golden spark bursts, and rounded translucent cyan HUD panels. The pointer-following spaceship cursor is also procedural — a small metallic craft with a framed canopy, swept wings, twin engines, panel seams and flames that banks and pitches as it follows the pointer, leaves a fire trail and pulses when its appearance changes. One motion language connects the loop: a hover reticle marks the target; a clicked mini-cube collapses over 140 ms and a small white-orange impact burst (white-hot core, amber embers and a smoke haze) joins green shard debris and spark particles (no click ray fan, no coin glyphs and no ring shockwave); the pointer ship fires a glowing tracer bolt with a muzzle flash and a slight recoil; lootbox opening uses a wireframe charge-orb reveal; level completion raises a full-screen banner. An automatic high/medium/low quality tier keeps the frame rate in budget — scaling SSAO and bloom, shadow-map resolution, and render resolution — and reduced motion replaces each of these animations with a static or instant variant. (Features: `reference-image-game-view`, `detailed-hero-spaceship` and `spaceship-cursor-loot-animations`; see `docs/features/spaceship-cursor-loot-animations/`.)

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
| `SMTP_HOST` | `mailpit` | SMTP host used by the backend |
| `SMTP_PORT` | `1025` | SMTP port used by the backend |
| `SMTP_USER` | _(empty)_ | SMTP username (optional) |
| `SMTP_PASS` | _(empty)_ | SMTP password (optional) |
| `SMTP_FROM` | `no-reply@cubeclicker.local` | sender address for outbound email |
| `APP_BASE_URL` | `http://localhost:5173` | base URL used to build verification links |
| `ALLOWED_ORIGIN` | `http://localhost:5173` | allowed Origin for state-changing auth requests (CSRF) |
| `SESSION_COOKIE_SECURE` | `false` | set the session cookie `Secure` flag (enable in production over HTTPS) |
| `LOG_LEVEL` | `debug` | backend Pino log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent`); the compose backend passes it with default `debug` |
| `METRICS_ENABLED` | `true` | serve the `GET /metrics` route; compose defaults `true` on the loopback, the deployed Render service sets `false` (public host, no path filter); `false` removes the route (the path returns `404`) |
| `VITE_PERF_OVERLAY` | `false` | dev-only performance overlay; only the exact value `true` enables it (frontend build-time variable) |

The defaults work out of the box. `.env` files are user-owned and are not used by this scaffold — export a variable in your shell instead, e.g. `BACKEND_PORT=9090 podman compose up`. Secrets (database password, SMTP credentials) are supplied via environment variables at runtime and are never committed or baked into images.

### Vite dev proxy (host-only runs)

The frontend talks to the backend through same-origin relative paths (`/auth/*`) so the `HttpOnly` session cookie stays on the page origin and the backend's CSRF check (which compares `Origin`) succeeds. In the compose stack Vite proxies `/auth` to the `backend` service with `changeOrigin: false`, keeping the browser's page origin (`http://localhost:5173`) as the forwarded `Origin` header — this must match the backend's `ALLOWED_ORIGIN` (`http://localhost:5173` by default). For host-only development (running Vite on the host against a host backend), point the proxy at the host backend with `BACKEND_URL=http://localhost:8080`; the page origin is still `http://localhost:5173`, so `ALLOWED_ORIGIN` must remain `http://localhost:5173` (or you must run via `podman compose`, which sets both consistently).

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

- `development` deploys from `main`: a push runs CI once, and a successful CI run triggers the Deploy workflow. It uses the Neon `development` branch, the Render service `cubeclicker-development` and the stable `cubeclicker-development.vercel.app` host.
- `production` is **not provisioned**: `workflow_dispatch` only, with no secrets, variables or protection rules yet. A production deploy needs a production Render service, a production Vercel project, a Neon `production` branch and the environment catalog, and reviewer/branch protection must be added before it is used.
- The backend keeps all in-memory game/room state; one instance is deliberate. Vercel hosts only the static frontend (no functions, no serverless WebSocket).
- The Render free instance spins down after 15 minutes without traffic and cold-starts (~30–60 s) on the next request or WebSocket connection. While clients are connected it stays awake. This is development-only; see the deployment reference for the reconnect behavior.
- Render has no platform health check configured for the service (`healthCheckPath` is empty, and `render.yaml` declares none); the Deploy workflow itself polls `/healthz` before the frontend step.

### What the pipelines run

- `ci.yml` (runs on pull requests and pushes to `main`):
  - `verify-app`: `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run coverage` → `npm run build`.
  - `smoke-e2e`: pre-start Mailpit (`docker compose -f compose.yaml -f compose.smoke.yaml up -d mailpit`) **before** `docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` (the one-shot run never starts Mailpit and fails 9/12; pre-started passes 12/12).
  - `verify-workflows`: `npm ci` on Node 24 → pinned `rhysd/actionlint:1.7.12` over both workflows → a `node -e` JSON parse of `src/frontend/vercel.json` → a YAML parse of `render.yaml` that checks the service name/runtime/plan and that no platform health check is declared → a guard that `deploy.yml` never mentions Fly.
- `deploy.yml` (`workflow_run` after a successful CI run on `main`, or `workflow_dispatch` for production): one `deploy` job in the environment selected by the event (`development` after CI, `production` for a dispatch) — Neon migration with the direct URL → Render deploy hook → 45 s wait → `/healthz` poll → Vercel build/deploy `--prod` → warm + deployed smoke. It does not re-run CI. Runs for the same environment are serialized (`cancel-in-progress: false`).

### Deploy flow

1. Merge or push to `main`.
2. CI runs once (lint, typecheck, test, coverage, build, containerized smoke, workflow/config checks).
3. After CI succeeds, Deploy applies pending Neon migrations with `DIRECT_DATABASE_URL`.
4. Deploy `POST`s the Render deploy hook, waits 45 s, then requires `/healthz` to return HTTP `200` within 180 s. Render has no platform health check configured; this workflow poll is the health gate.
5. Vercel builds from `src/frontend` with `VITE_CLOUD_DEPLOY=true` and the environment's API/WS URLs and deploys the prebuilt output to the production target (`--prod` updates `cubeclicker-development.vercel.app`; no separate alias step).
6. `node tests/e2e/deployed-smoke.mjs` proves health, allowed and disallowed CORS preflight, SPA fallback, a real `/assets/*` 404 and a WebSocket hello/join/click plus the disallowed-Origin `403`.

Rollback, migrations, DNS/cookies and the single-instance trade-off are documented in [`docs/architecture/deployment.md`](docs/architecture/deployment.md); the architecture and runbook are in [`docs/architecture/vercel-render-neon.md`](docs/architecture/vercel-render-neon.md). The previous Vercel/Fly reference is retained, marked SUPERSEDED, at [`docs/architecture/vercel-fly-neon.md`](docs/architecture/vercel-fly-neon.md).

### User-side asset checklist (one-time, performed by the repository owner)

The `development` GitHub Environment is provisioned with the exact secrets/variables catalogued in [`docs/architecture/vercel-render-neon.md`](docs/architecture/vercel-render-neon.md) § Environment catalog:

- Secrets: `VERCEL_TOKEN`, `RENDER_DEPLOY_HOOK_URL`, `DATABASE_URL`, `DIRECT_DATABASE_URL`, `SMTP_PASS`.
- Variables: `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `FRONTEND_ORIGIN`, `VITE_API_URL`, `VITE_WS_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_FROM`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_SAMESITE`, `MAX_USERS_PER_SERVER`.

Also required: a Vercel project whose Root Directory is `src/frontend` (Node 24, deployment protection disabled for development), one Render free Docker web service tracked to `main` with auto-deploy off, one Neon project with a `development` branch, and the stable frontend host per environment. Production is not provisioned and has no secrets, variables or protection rules; it must be provisioned — including required reviewers and a deployment branch policy — before use. Development email is guest-only: Render free has no private service for Mailpit, so the SMTP values are placeholders. No secret value is committed; the archived AWS tree and the archived Fly configs are not deployed.
