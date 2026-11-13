# Containerized Delivery Path

Decided 2026-10-17 per direct user direction (recorded in `docs/architecture/stack.md` § Containerized delivery path). This document is binding for the stack-selection task and for all future container work. The application stack itself is DECIDED (2026-10-17) — see `docs/architecture/stack.md` § Application stack (DECIDED, 2026-10-17) — and the container assets this document calls for exist in the repository (`compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile`, `src/frontend/Dockerfile`); the conventions below are settled and binding.

## Local development contract

- The full environment — backend and frontend containers, plus any future services — starts from a clean checkout with a single `podman compose up`-style command.
- No host prerequisites beyond Podman with a working compose provider (`podman compose`).
- When the container assets land, run instructions must be documented at the repository root and mirrored in `AGENTS.md` § Commands.

## Service containerization rules

- Every deployable component builds from this repository into its own container image; the image is the deployable artifact.
- Future supporting services (databases, queues, etc.) are added through the same containerized path.
- Runtime configuration (ports, endpoints, flags) comes from environment variables with safe local defaults.
- Secrets are injected at run time — never committed or baked into images.
- `.env*` remains user-owned and off-limits to agents.

## Deployment neutrality

- Images must run on any container platform with no provider-specific lock-in; the container images remain provider-neutral deployables.
- The deployment target is **Vercel (static frontend) + Fly.io (backend container) + Neon (PostgreSQL)**, selected by the user on 2026-11-13 and superseding the earlier AWS target (see `docs/architecture/deployment.md`). That selection does not make the images provider-specific — a platform port swaps deployment artifacts and configuration, not the images.
- Provider portability of the deployment layout is an aspiration, never a claim in artifacts; this document makes no provider claim of its own.

## Real-time (WebSocket) requirement

- The backend container exposes the WebSocket endpoint required by `docs/architecture/stack.md` § Hard constraints — concretely the `GET /ws` WebSocket upgrade on the backend listen port 8080.
- Local and deployed container environments must preserve WebSocket connections end-to-end: no proxy or load balancer may strip connection upgrades.
- Proxy/load-balancer handling is resolved by the deployment target: the Fly.io proxy terminates TLS and passes WebSocket upgrades through without extra configuration (see `docs/architecture/deployment.md`). This document contains no proxy configuration.

## Container conventions (settled at stack selection, 2026-10-17)

Every item the previous revision left to stack selection is resolved; these values are binding for the scaffold and for future container work.

- **Listen ports and environment-variable names.** Backend: `HOST` (default `0.0.0.0`) and `PORT` (default `8080`) — HTTP health and WebSocket on that port. Frontend dev server: 5173 (Vite, strict port). Host mappings are loopback-bound and interpolated: `127.0.0.1:${BACKEND_PORT:-8080}:8080` and `127.0.0.1:${FRONTEND_PORT:-5173}:5173` (`BACKEND_PORT` default 8080, `FRONTEND_PORT` default 5173). The frontend's WebSocket target is `VITE_WS_URL`, default `ws://localhost:8080/ws`.
- **Health signal.** Backend: `GET /healthz` → `200` with body `{"status":"ok"}`; frontend: `GET /` serving the app. Each image declares its own `HEALTHCHECK` (interval 10s, timeout 3s, retries 5, start-period 15s); the compose files declare no duplicate healthcheck.
- **Image naming/tagging.** `cubeclicker-backend` and `cubeclicker-frontend`; the local (compose-built, `target: dev`) tag is `:dev`. The deployed commit SHA (`github.sha`) is the release identity; Fly keeps prior release images for rollback, and no mutable `:latest` is deployed (see `docs/architecture/deployment.md`).
- **Compose file and Dockerfile locations.** `compose.yaml` at the repository root (project name `cubeclicker`; services `backend`, `frontend`), `compose.smoke.yaml` at the root (services `smoke` and the smoke-only `frontend-prod`; opt-in, never part of a plain `podman compose up`), and one multi-stage Dockerfile per workspace: `src/backend/Dockerfile`, `src/frontend/Dockerfile` (targets `dev` and `prod`).
- **Dev-mode behavior.** Hot reload: backend `tsx watch` and frontend Vite HMR, over bind mounts of each workspace's sources. Dependency or manifest changes require a rebuild (`podman compose up --build`).
- **Local-run command and its README home.** `podman compose up` starts the full local environment; it is documented in `README.md` at the repository root and mirrored in `AGENTS.md` § Commands (as `npm run dev`). The containerized smoke test runs with `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` (`npm run smoke`).
- **Resolved by the deployment target (this feature).** Proxy/load-balancer upgrade handling → Fly.io proxy WebSocket passthrough (`docs/architecture/deployment.md`); release identity → the deployed commit SHA (`github.sha`) recorded by the pipeline; production runtime-config injection for the frontend → build-time Vercel build values (`VITE_CLOUD_DEPLOY=true`, `VITE_API_URL`, optional `VITE_WS_URL`) while the nginx image keeps the local/smoke contract (`docs/architecture/vercel-fly-neon.md`). The local-dev path and image neutrality are unchanged.

## Frontend static delivery

The production frontend image serves the Vite static build with `nginxinc/nginx-unprivileged:1.27-alpine` on port 8080; its delivery contract is pinned in `src/frontend/nginx.conf` and proven on the wire by the containerized smoke test. In the cloud, Vercel serves the same SPA build directly from `src/frontend`, with `src/frontend/vercel.json` replicating the hashed-asset immutability, app-shell `no-cache`, SPA fallback and real `/assets/*` 404 semantics; the nginx `prod` image remains for local/smoke/portability but is no longer the cloud frontend (see `docs/architecture/vercel-fly-neon.md`). The frontend build splits the bundle (a Three.js-free entry plus lazy game-runtime and customization chunks) and enforces the gzip bundle budget, so a budget or initial-graph regression fails the image's `build` stage.

| Request | Served | `Content-Encoding` | `Cache-Control` |
| --- | --- | --- | --- |
| `GET /` | `index.html` | `gzip` (body > `gzip_min_length`) | `no-cache` |
| `GET /index.html` | `index.html` | `gzip` | `no-cache` |
| `GET /assets/index-<hash>.js` | hashed entry | `gzip` | `public, max-age=31536000, immutable` |
| `GET /assets/three-<hash>.js` | hashed lazy vendor | `gzip` | `public, max-age=31536000, immutable` |
| `GET /bundle-report.json` | build metadata | `gzip` | `no-cache` |
| `GET /missing/route` | `index.html` (SPA fallback) | `gzip` | `no-cache` |
| `GET /assets/missing.js` | nginx 404 | not asserted | no long-cache header |

- **Header rules.** `gzip on`, `gzip_comp_level 6`, `gzip_min_length 128`, `gzip_vary on` (adds `Vary: Accept-Encoding`), and `gzip_types` cover JS/CSS/JSON/manifest/SVG; `text/html` is always compressed when gzip is on. `add_header` is declared per location (no inheritance reliance): hashed `/assets/*` files are content-addressed and cached immutably for one year with `try_files $uri =404` (a missing asset is a real 404, never the app shell), while `/`, `/index.html`, and the SPA fallback stay `no-cache` so a deploy is picked up.
- **Smoke-only production service.** `frontend-prod` exists only in `compose.smoke.yaml`: it builds `src/frontend/Dockerfile` target `prod` as `cubeclicker-frontend:prod-smoke`, publishes no host port, and the `smoke` service depends on it with `condition: service_started`. `tests/e2e/smoke.mjs` performs a bounded readiness poll of `http://frontend-prod:8080/` (the existing `READY_TIMEOUT_MS`, 500 ms interval) before any header assertion, then asserts the wire headers, gzip encoding, the served `index.html` module script, and the chunk graph and budgets in `/bundle-report.json`. A compose provider that does not auto-build missing dependencies needs `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` before `npm run smoke` (or `run --build --rm smoke`).
- **Unchanged local path.** `compose.yaml` and the single-command `podman compose up` are untouched: the dev frontend remains Vite on 5173 with hot reload, and `frontend-prod` never starts in a plain `podman compose up`.
- **Unchanged health, WebSocket, and environment conventions.** The prod image keeps its `GET /` `HEALTHCHECK`; no environment variable is added; the backend WebSocket endpoint (`GET /ws`) and every convention above are unchanged.
- **gzip only, no brotli.** Delivery is gzip-only: the `nginxinc/nginx-unprivileged:1.27-alpine` base image does not include `ngx_brotli`, Brotli is not enabled because enabling it would require a custom nginx build, and that custom build is out of scope for this stack.
