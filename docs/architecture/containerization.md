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
- The deploy target was selected by this feature per the user's 2026-10-31 request: AWS via ECS Fargate + ALB + RDS + ECR, defined in Terraform (see `docs/architecture/deployment.md`). That selection does not make the images provider-specific — a cloud port swaps the IaC resources, not the images.
- Provider portability of the Terraform modules is an aspiration of the module layout, never a claim in artifacts; this document makes no provider claim of its own.

## Real-time (WebSocket) requirement

- The backend container exposes the WebSocket endpoint required by `docs/architecture/stack.md` § Hard constraints — concretely the `GET /ws` WebSocket upgrade on the backend listen port 8080.
- Local and deployed container environments must preserve WebSocket connections end-to-end: no proxy or load balancer may strip connection upgrades.
- Proxy/load-balancer handling is resolved by the deployment target: the AWS ALB passes WebSocket upgrades through with `idle_timeout = 90` and no request policy stripping `Upgrade`/`Connection` (see `docs/architecture/deployment.md`). This document contains no proxy configuration.

## Container conventions (settled at stack selection, 2026-10-17)

Every item the previous revision left to stack selection is resolved; these values are binding for the scaffold and for future container work.

- **Listen ports and environment-variable names.** Backend: `HOST` (default `0.0.0.0`) and `PORT` (default `8080`) — HTTP health and WebSocket on that port. Frontend dev server: 5173 (Vite, strict port). Host mappings are loopback-bound and interpolated: `127.0.0.1:${BACKEND_PORT:-8080}:8080` and `127.0.0.1:${FRONTEND_PORT:-5173}:5173` (`BACKEND_PORT` default 8080, `FRONTEND_PORT` default 5173). The frontend's WebSocket target is `VITE_WS_URL`, default `ws://localhost:8080/ws`.
- **Health signal.** Backend: `GET /healthz` → `200` with body `{"status":"ok"}`; frontend: `GET /` serving the app. Each image declares its own `HEALTHCHECK` (interval 10s, timeout 3s, retries 5, start-period 15s); the compose files declare no duplicate healthcheck.
- **Image naming/tagging.** `cubeclicker-backend` and `cubeclicker-frontend`; the local (compose-built, `target: dev`) tag is `:dev`. Release tagging = commit SHA (`github.sha`) in the deploy pipeline (see `docs/architecture/deployment.md`); no mutable `:latest` in task definitions.
- **Compose file and Dockerfile locations.** `compose.yaml` at the repository root (project name `cubeclicker`; services `backend`, `frontend`), `compose.smoke.yaml` at the root (service `smoke`; opt-in, never part of a plain `podman compose up`), and one multi-stage Dockerfile per workspace: `src/backend/Dockerfile`, `src/frontend/Dockerfile` (targets `dev` and `prod`).
- **Dev-mode behavior.** Hot reload: backend `tsx watch` and frontend Vite HMR, over bind mounts of each workspace's sources. Dependency or manifest changes require a rebuild (`podman compose up --build`).
- **Local-run command and its README home.** `podman compose up` starts the full local environment; it is documented in `README.md` at the repository root and mirrored in `AGENTS.md` § Commands (as `npm run dev`). The containerized smoke test runs with `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` (`npm run smoke`).
- **Resolved by the deployment target (this feature).** Proxy/load-balancer upgrade handling → ALB WebSocket passthrough (`docs/architecture/deployment.md`); release image tagging → commit SHA (`github.sha`) in the deploy pipeline; production runtime-config injection for the frontend → build-time bake of `PUBLIC_WS_URL` via the Dockerfile `ARG VITE_WS_URL` + `ENV VITE_WS_URL` bridge (`docs/architecture/deployment.md`). The local-dev path and image neutrality are unchanged.
