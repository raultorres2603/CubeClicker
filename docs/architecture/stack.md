# Stack

**Status: DECIDED** (application stack, 2026-10-17) — the containerized delivery path remains as decided (§ Containerized delivery path).

The application stack was decided on 2026-10-17 and is recorded in § Application stack (DECIDED, 2026-10-17) below; the container conventions it implies are settled in `docs/architecture/containerization.md`. Both are binding for all future work — a departure requires a user-owned amendment (spec revision first, then implementation).

## Application stack (DECIDED, 2026-10-17)

- **Language:** TypeScript (strict), across every workspace.
- **Runtime:** Node.js 24 LTS.
- **Backend:** Fastify + `@fastify/websocket` — HTTP health at `GET /healthz`, WebSocket server at `GET /ws`.
- **Frontend:** React + Vite (SPA, static build).
- **Package manager:** npm (workspaces) — layout `src/backend` + `src/frontend`; unit tests colocated as `*.test.ts` beside the sources they cover; cross-service e2e tests in `tests/e2e/`.
- **Tests:** Vitest.
- **Lint:** ESLint (flat config) + typescript-eslint.
- **Dev runner:** `tsx` (backend watch mode).

The rationale for this decision (candidate comparison and explicit trade-offs) is recorded in this feature's spec: `docs/features/stack-selection/spec.md` § Stack decision.

### Commands

Canonical commands, mirrored in `AGENTS.md` § Commands:

| Command | Purpose |
| --- | --- |
| `npm ci` | install dependencies from the committed lockfile |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest, all workspaces |
| `npm run build` | build all workspaces |
| `npm run dev` | start the full local environment with hot reload (equivalent to `docker compose up`) |
| `npm run smoke` | containerized end-to-end smoke test (equivalent to `docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`) |
| `docker compose up` | the single-command local environment (backend + frontend containers) |

## Containerized delivery path (DECIDED)

- The backend and the frontend each run as containers; the full local environment starts from a clean checkout with a single `docker compose up`-style command.
- Docker images + Docker Compose are the decided containerization tooling (user decision, 2026-10-17).
- Deployable artifacts are container images runnable on any container platform — provider-neutral; AWS ECS Fargate is an example only and no provider is chosen.
- Future services (databases, queues, etc.) are added via the same containerized path.
- The application stack is decided (§ Application stack (DECIDED, 2026-10-17) above) and the container assets exist in this repository: `compose.yaml` and `compose.smoke.yaml` at the root, plus the Dockerfiles under `src/backend/` and `src/frontend/`.
- The backend container must expose the WebSocket endpoint required by § Hard constraints.
- Binding requirements live in `docs/architecture/containerization.md`.

## Hard constraints

- Any selected stack must support a WebSocket server on the backend and WebSocket client connections from the frontend.
- Rationale: CubeClicker is an online, real-time game with cross-client visibility — clients are expected to see each other's live activity.
- This section constrains capability only; it names no technology. The decided stack satisfies it: the backend serves the WebSocket endpoint (`GET /ws`) and the frontend connects to it over WebSocket.

The decision recorded above is operationalized by the scaffold in this repository: the container stack starts with `docker compose up`, the run instructions live in `README.md`, and the canonical commands (lint / typecheck / test / build / dev / smoke) are listed above and mirrored in `AGENTS.md` § Commands.
