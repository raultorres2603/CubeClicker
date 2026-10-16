# CubeClicker — Project Instructions

CubeClicker is a web-based, online, real-time, multi-client clicker game. Clients are expected to see each other's live activity (live stats, other users' clicks, connected users). This project is AI-native: feature work flows through a four-agent pipeline defined in `.opencode/` — `orchestrator` (primary, user-facing) delegates to `planner`, `builder`, and `reviewer` subagents.

## Stack

- **Application stack: NOT DECIDED.** The canonical stack lives in `docs/architecture/stack.md`. Until that file defines it, agents MUST NOT introduce, assume, or install any framework, runtime, build tool, or dependency beyond the decided containerized delivery path (next bullet); the builder reports `blocked` for stack-dependent implementation instead of guessing.
- **Containerized delivery path (DECIDED).** The local development and packaging path is containerized: backend and frontend run as containers, started locally with a single `docker compose up`-style command; deployable artifacts are container images runnable on any container platform (AWS ECS Fargate is an example only — no provider is chosen); future services (databases, queues, etc.) join the same path. Docker and Docker Compose are the decided tooling; concrete container assets are authored once the application stack is decided (see `docs/architecture/containerization.md`).
- **Online/real-time constraint (protocol-level).** The game is online and real-time: the backend must be WebSocket-compatible and the frontend must connect to it over WebSocket. Any stack selection must satisfy this. No framework, library, or runtime is implied or chosen. See docs/architecture/stack.md § Hard constraints.

## Commands

- **TBD** — filled in after the stack-selection task (lint, typecheck, test, build, dev). Until then, treat commands as unavailable and say so in reports.
- **Local environment (containerized).** The full local environment will start with a single `docker compose up`-style command (backend + frontend containers) once the container assets land; run instructions will be documented at the repo root and mirrored here.

## Project structure

- `src/` — application source
- `tests/` — unit and e2e tests
- `public/` — static assets
- `docs/` — product vision, architecture, feature artifacts
- `.opencode/` — agents, skills, commands (the AI team)

## Workflow

- Feature state lives in `docs/features/<slug>/status.md` — never rely on chat memory.
- Feature artifacts: `spec.md`, `plan.md`, `tasks.md`, `status.md`, `build-log-<taskid>.md`, `reviews/`.
- Only the orchestrator communicates with the user; worker agents return reports.

## Conventions

- Language: TypeScript (strict) per the agreed stack.
- Commits: conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Branches: `feat/<slug>` for feature work; merge to main only after a feature is `accepted`.
- Tests accompany every behavior change.

## Boundaries

- ✅ Always: run lint, typecheck, and tests before reporting done; keep artifacts under `docs/features/<slug>/`; follow existing patterns.
- ⚠️ Ask first: adding dependencies; changing shared config (CI, entrypoints, lockfiles) outside a task that owns it; deleting files.
- 🚫 Never: commit secrets or API keys; edit `.env*`; `git push`; edit outside your role's write scope; rewrite a spec to match buggy code.
