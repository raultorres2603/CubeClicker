# CubeClicker — Project Instructions

CubeClicker is a web-based, online, real-time, multi-client clicker game. Clients are expected to see each other's live activity (live stats, other users' clicks, connected users). This project is AI-native: feature work flows through a four-agent pipeline defined in `.opencode/` — `orchestrator` (primary, user-facing) delegates to `planner`, `builder`, and `reviewer` subagents.

## Stack

- **Application stack: DECIDED (2026-10-17)** — TypeScript (strict); Node.js 24 LTS + Fastify (WebSocket); React + Vite; npm workspaces; Vitest; ESLint. Canonical details in `docs/architecture/stack.md`.
- **Containerized delivery path (DECIDED).** The local development and packaging path is containerized: backend and frontend run as containers, started locally with a single `podman compose up` command (hot reload); deployable artifacts are container images runnable on any container platform (AWS ECS Fargate is an example only — no provider is chosen); future services (databases, queues, etc.) join the same path. Podman and Podman Compose (`podman compose`) are the decided tooling; the container assets live in the repository (`compose.yaml`, Dockerfiles under `src/*`), and the run instructions live in `README.md` (see `docs/architecture/containerization.md`).
- **Online/real-time constraint (protocol-level).** The game is online and real-time: the backend must be WebSocket-compatible and the frontend must connect to it over WebSocket. The decided stack satisfies this constraint: the backend serves the WebSocket endpoint (`/ws`) and the frontend connects to it over WebSocket. See docs/architecture/stack.md § Hard constraints.

## Commands

Host tooling commands need Node.js 24 LTS + npm; running the environment itself needs only Podman with a working compose provider (`podman compose`). Run instructions live in `README.md`.

- `npm ci` — install dependencies from the committed lockfile.
- `npm run lint` — ESLint.
- `npm run typecheck` — TypeScript, no emit.
- `npm test` — Vitest unit tests, all workspaces.
- `npm run coverage` — Vitest with V8 coverage in all workspaces (thresholds ≥ 80% statements/branches/functions/lines per workspace; part of the build gate).
- `npm run build` — build all workspaces.
- `npm run dev` — start the full local environment with hot reload (equivalent to `podman compose up`).
- `npm run smoke` — containerized end-to-end smoke test (equivalent to `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`).
- **Local environment (containerized).** The full local environment starts with a single `podman compose up` command (backend + frontend containers); run instructions are documented in `README.md` at the repository root and mirrored here.

## Project structure

- `src/backend/` — backend workspace (Node.js + Fastify; its own Dockerfile)
- `src/frontend/` — frontend workspace (React + Vite; its own Dockerfile)
- `tests/e2e/` — containerized smoke/e2e tests
- `docs/` — product vision, architecture, feature artifacts
- `.opencode/` — agents, skills, commands (the AI team)

Unit tests are colocated beside the sources they cover (`*.test.ts` / `*.test.tsx`, inside each workspace).

## Workflow

- Feature state lives in `docs/features/<slug>/status.md` — never rely on chat memory.
- Feature artifacts: `spec.md`, `plan.md`, `tasks.md`, `status.md`, `build-log-<taskid>.md`, `reviews/`.
- Only the orchestrator communicates with the user; worker agents return reports.

## Conventions

- Language: TypeScript (strict) — decided with the application stack (2026-10-17); see docs/architecture/stack.md.
- Commits: conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Branches: `feat/<slug>` for feature work; merge to main only after a feature is `accepted`.
- Tests accompany every behavior change: unit tests and integration tests with concrete expected values (no wildcard matchers), and no useless tests; coverage stays ≥ 80% (statements, branches, functions, lines) per workspace, verified with `npm run coverage`.

## Boundaries

- ✅ Always: run lint, typecheck, tests, and the coverage command before reporting done; keep artifacts under `docs/features/<slug>/`; follow existing patterns.
- ⚠️ Ask first: adding dependencies; changing shared config (CI, entrypoints, lockfiles) outside a task that owns it; deleting files.
- 🚫 Never: commit secrets or API keys; edit `.env*`; `git push`; edit outside your role's write scope; rewrite a spec to match buggy code; weaken assertions (wildcard matchers, snapshot-only or assertion-free tests) or exclude production code from coverage without a justified, reviewer-approved reason.
