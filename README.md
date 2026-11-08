# CubeClicker

A web-based, online, real-time, multi-client clicker game — connected clients see each other's live activity.

## Gameplay

Players earn points by clicking the cube and progress through cube levels. Completing a cube grants a **lootbox** and a **key**; opening a lootbox with a key draws one random part from the **granular spaceship parts** catalog — a single part for one **part slot** (for example the port wing, the cockpit or one ignition), not a whole matched set. The **Spaceship Customization** menu (appearance editor) shows a live 3D preview and lets players equip or unequip each slot independently; the in-game pointer ship reflects the equipped appearance, including asymmetric left/right loadouts. Appearance and inventory are persisted per **account**; **guests** keep an ephemeral copy for the session. (Features: `spaceship-customization`, see `docs/features/spaceship-customization/`; `spaceship-cursor-loot-animations`, see `docs/features/spaceship-cursor-loot-animations/`.)

The game view is generated procedurally in code (no external models, textures, images, videos or other assets): a procedural nebula in purple/blue/pink with asteroids, meteors, an orange comet and a detailed blue/orange hero spaceship (layered hull, swept wings, twin glowing engines), an emerald beveled cube with golden spark bursts, and rounded translucent cyan HUD panels. The pointer-following spaceship cursor is also procedural — a small metallic craft with a framed canopy, swept wings, twin engines, panel seams and flames that banks and pitches as it follows the pointer, leaves a fire trail and pulses when its appearance changes. One motion language connects the loop: a hover reticle marks the target, a clicked mini-cube vanishes on the same frame, and rays, shards and coin popups burst out; lootbox opening uses a wireframe charge-orb reveal; level completion raises a full-screen banner. An automatic high/medium/low quality tier keeps the frame rate in budget, and reduced motion replaces each of these animations with a static or instant variant. (Features: `reference-image-game-view`, `detailed-hero-spaceship` and `spaceship-cursor-loot-animations`; see `docs/features/spaceship-cursor-loot-animations/`.)

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
| `npm run build` | build all workspaces |
| `npm run dev` | start the full local environment with hot reload (equivalent to `podman compose up`) |
| `npm run smoke` | containerized end-to-end smoke test (equivalent to `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`) |

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

The defaults work out of the box. `.env` files are user-owned and are not used by this scaffold — export a variable in your shell instead, e.g. `BACKEND_PORT=9090 podman compose up`. Secrets (database password, SMTP credentials) are supplied via environment variables at runtime and are never committed or baked into images.

### Vite dev proxy (host-only runs)

The frontend talks to the backend through same-origin relative paths (`/auth/*`) so the `HttpOnly` session cookie stays on the page origin and the backend's CSRF check (which compares `Origin`) succeeds. In the compose stack Vite proxies `/auth` to the `backend` service with `changeOrigin: false`, keeping the browser's page origin (`http://localhost:5173`) as the forwarded `Origin` header — this must match the backend's `ALLOWED_ORIGIN` (`http://localhost:5173` by default). For host-only development (running Vite on the host against a host backend), point the proxy at the host backend with `BACKEND_URL=http://localhost:8080`; the page origin is still `http://localhost:5173`, so `ALLOWED_ORIGIN` must remain `http://localhost:5173` (or you must run via `podman compose`, which sets both consistently).

## Production images

```bash
podman build --format docker --target prod -f src/backend/Dockerfile .
podman build --format docker --target prod -f src/frontend/Dockerfile .
```

The `--format docker` form keeps the image `HEALTHCHECK`, which Podman 5's default OCI build format would drop.

Both images are provider-neutral and are the deployable artifacts. Release tagging = commit SHA in the deploy pipeline (see the Deployment section above).

## Stack

TypeScript (strict) on Node.js 24 LTS: a Fastify backend (HTTP health at `GET /healthz`, WebSocket at `GET /ws`) and a React + Vite frontend, in an npm-workspaces repo (`src/backend`, `src/frontend`) tested with Vitest and linted with ESLint. The frontend connects to the backend over WebSocket; the containerized smoke test (`npm run smoke`) proves that path through the container network with two concurrent clients.

- `docs/architecture/stack.md` — the decided application stack and the canonical commands
- `docs/architecture/containerization.md` — the settled container conventions (ports, env names, health, images, compose files)

## Deployment

CubeClicker deploys to AWS from the existing container images through Terraform-defined infrastructure and a GitHub Actions pipeline. The local development path above is unchanged; deployment is a separate, cloud-side concern. See `docs/architecture/deployment.md` for the full conventions.

### What the pipelines run

- `ci.yml` (reusable; runs on pull requests, pushes to `main`, and via `workflow_call`):
  - `verify-app`: `npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npm run coverage` → `npm run build`.
  - `smoke-e2e`: pre-start Mailpit (`docker compose -f compose.yaml -f compose.smoke.yaml up -d mailpit`) **before** `docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` (the one-shot run never starts Mailpit and fails 9/12; pre-started passes 12/12).
  - `verify-infra`: containerized `terraform fmt -check -recursive`, `terraform init -backend=false`, `terraform validate` (no AWS credentials).
- `deploy.yml` (manual, via `workflow_dispatch`): calls `ci.yml` via `workflow_call` (gates re-run on the selected ref by design), then builds and pushes both images to ECR tagged with the commit SHA (frontend bakes `VITE_WS_URL` from `PUBLIC_WS_URL`), assumes the deploy role via OIDC, runs `terraform init`/`plan`/`apply`, then deploys both ECS services and waits for stability. Wrapped in a `deploy-production` concurrency group.

### Deploy flow

1. Trigger manually via `workflow_dispatch` (Actions → Deploy → Run workflow), selecting the ref to deploy (typically the merge commit on `main`, only after a feature is accepted and merged).
2. `verify` job re-runs all three gates.
3. `build-and-push` builds/pushes `cubeclicker-backend` and `cubeclicker-frontend` to ECR tagged with `github.sha`.
4. `infra` runs `terraform plan` (with the SHA-tagged image URIs) then `terraform apply`.
5. `deploy-services` renders and deploys both task definitions with `wait-for-service-stability: true`.

Note: continuous deployment (CD) is manual because only the `production` environment exists; automatic deploy is deferred until a staging environment is added.

### User-side asset checklist (one-time, performed by the repository owner)

Repository variables (Settings → Secrets and variables → Actions → Variables):

- `AWS_REGION` — target region (default `us-east-1`).
- `AWS_DEPLOY_ROLE_ARN` — ARN of `GitHubActionsCubeDeploy`.
- `AWS_PLAN_ROLE_ARN` — ARN of `GitHubActionsCubeCI` (provisioned for the plan-on-PR follow-up; consumed by no workflow today).
- `TF_STATE_BUCKET` — name of the one-time bootstrap-created state bucket.
- `PUBLIC_WS_URL` — public WebSocket URL baked into the frontend image at build time.

GitHub environment:

- Protected `production` environment (required reviewers / branch protection as desired). The workflow's `environment: production` and the deploy role's `environment:production` trust condition both depend on it.

One-time bootstrap apply (local, by the owner):

- Apply `infra/terraform/bootstrap/` once to create the shared state bucket; record its name in `TF_STATE_BUCKET`. See `infra/README.md`.

No long-lived AWS keys are stored anywhere; all authentication uses GitHub OIDC. Images remain provider-neutral deployables; only the infrastructure target is AWS.
