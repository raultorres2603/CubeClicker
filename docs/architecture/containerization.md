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

- Images must run on any container platform with no provider-specific lock-in.
- AWS ECS Fargate (named by the user) is an example only; no provider is chosen and no commitment is recorded.
- Provider selection is a separate future decision and is not made by this document.

## Real-time (WebSocket) requirement

- The backend container exposes the WebSocket endpoint required by `docs/architecture/stack.md` § Hard constraints — concretely the `GET /ws` WebSocket upgrade on the backend listen port 8080.
- Local and deployed container environments must preserve WebSocket connections end-to-end: no proxy or load balancer may strip connection upgrades.
- Proxy/load-balancer handling is flagged as a deployment-time decision and is not designed here (this document contains no configuration).

## Container conventions (settled at stack selection, 2026-10-17)

Every item the previous revision left to stack selection is resolved; these values are binding for the scaffold and for future container work.

- **Listen ports and environment-variable names.** Backend: `HOST` (default `0.0.0.0`) and `PORT` (default `8080`) — HTTP health and WebSocket on that port. Frontend dev server: 5173 (Vite, strict port). Host mappings are loopback-bound and interpolated: `127.0.0.1:${BACKEND_PORT:-8080}:8080` and `127.0.0.1:${FRONTEND_PORT:-5173}:5173` (`BACKEND_PORT` default 8080, `FRONTEND_PORT` default 5173). The frontend's WebSocket target is `VITE_WS_URL`, default `ws://localhost:8080/ws`.
- **Health signal.** Backend: `GET /healthz` → `200` with body `{"status":"ok"}`; frontend: `GET /` serving the app. Each image declares its own `HEALTHCHECK` (interval 10s, timeout 3s, retries 5, start-period 15s); the compose files declare no duplicate healthcheck.
- **Image naming/tagging.** `cubeclicker-backend` and `cubeclicker-frontend`; the local (compose-built, `target: dev`) tag is `:dev`. Release tagging is deferred to deployment time.
- **Compose file and Dockerfile locations.** `compose.yaml` at the repository root (project name `cubeclicker`; services `backend`, `frontend`), `compose.smoke.yaml` at the root (service `smoke`; opt-in, never part of a plain `podman compose up`), and one multi-stage Dockerfile per workspace: `src/backend/Dockerfile`, `src/frontend/Dockerfile` (targets `dev` and `prod`).
- **Dev-mode behavior.** Hot reload: backend `tsx watch` and frontend Vite HMR, over bind mounts of each workspace's sources. Dependency or manifest changes require a rebuild (`podman compose up --build`).
- **Local-run command and its README home.** `podman compose up` starts the full local environment; it is documented in `README.md` at the repository root and mirrored in `AGENTS.md` § Commands (as `npm run dev`). The containerized smoke test runs with `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` (`npm run smoke`).
- **Deferred to deployment time (named, not designed here).** Proxy/load-balancer upgrade handling; release image tagging; production runtime-config injection for the frontend.
