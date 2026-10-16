# Containerized Delivery Path

Decided 2026-10-17 per direct user direction (recorded in `docs/architecture/stack.md` § Containerized delivery path). This document is binding for the stack-selection task and for all future container work. The application stack itself (language, framework, runtime, tooling, ports) remains NOT DECIDED — see `docs/architecture/stack.md`.

## Local development contract

- The full environment — backend and frontend containers, plus any future services — starts from a clean checkout with a single `docker compose up`-style command.
- No host prerequisites beyond Docker with Compose.
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

- The backend container exposes the WebSocket endpoint required by `docs/architecture/stack.md` § Hard constraints.
- Local and deployed container environments must preserve WebSocket connections end-to-end: no proxy or load balancer may strip connection upgrades.
- Proxy/load-balancer handling is flagged as a deployment-time decision and is not designed here (this document contains no configuration).

## Conventions to settle at stack selection

The stack-selection task resolves and documents each item below:

- Listen ports and their environment-variable names (backend HTTP/WebSocket, frontend, future services).
- Health signal per long-running service (compose healthcheck and platform health checks).
- Image naming/tagging convention.
- Compose file location/name and Dockerfile locations.
- Dev-mode behavior (serving mode, rebuild/hot-reload expectations).
- The exact local-run command(s), documented in the README and mirrored in `AGENTS.md` § Commands.
