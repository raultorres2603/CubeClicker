# Stack

**Status: NOT DECIDED** (application stack) — **DECIDED:** the containerized delivery path (§ Containerized delivery path; user decision, 2026-10-17).

The stack will be selected via a dedicated stack-selection task. Until this file is filled in:

- Agents MUST NOT introduce, assume, or install any framework, language runtime, build tool, or dependency beyond the decided containerization tooling (Docker images + Docker Compose; § Containerized delivery path).
- The Builder MUST report `blocked` if asked to implement code before the stack is decided.
- The Planner may write stack-agnostic specs but MUST flag stack-dependent decisions as open questions.

## Containerized delivery path (DECIDED)

- The backend and the frontend each run as containers; the full local environment starts from a clean checkout with a single `docker compose up`-style command.
- Docker images + Docker Compose are the decided containerization tooling (user decision, 2026-10-17).
- Deployable artifacts are container images runnable on any container platform — provider-neutral; AWS ECS Fargate is an example only and no provider is chosen.
- Future services (databases, queues, etc.) are added via the same containerized path.
- The application stack (language, framework, runtime, tooling, ports) remains NOT DECIDED; concrete container assets (Dockerfiles, compose file) are authored at/after stack selection.
- The backend container must expose the WebSocket endpoint required by § Hard constraints.
- Binding requirements live in `docs/architecture/containerization.md`.

## Hard constraints (all candidates)

- Any selected stack must support a WebSocket server on the backend and WebSocket client connections from the frontend.
- Rationale: CubeClicker is an online, real-time game with cross-client visibility — clients are expected to see each other's live activity.
- This section constrains capability only; it names no technology, and the application stack remains NOT DECIDED until the stack-selection task decides it.

When decided, this file will define: language, framework, build tooling, test tooling, package manager, project layout, and the canonical commands (lint / typecheck / test / build / dev) mirrored in `AGENTS.md`. The stack-selection task must also produce the container assets that realize the decided delivery path (Dockerfiles, compose file) and document the single-command local run (see § Containerized delivery path).
