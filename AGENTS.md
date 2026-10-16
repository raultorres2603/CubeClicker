# CubeClicker — Project Instructions

CubeClicker is a web-based clicker game. This project is AI-native: feature work flows through a four-agent pipeline defined in `.opencode/` — `orchestrator` (primary, user-facing) delegates to `planner`, `builder`, and `reviewer` subagents.

## Stack

- **NOT DECIDED.** The canonical stack lives in `docs/architecture/stack.md`. Until that file defines it, agents MUST NOT introduce, assume, or install any framework, runtime, build tool, or dependency; the builder reports `blocked` instead of guessing.

## Commands

- **TBD** — filled in after the stack-selection task (lint, typecheck, test, build, dev). Until then, treat commands as unavailable and say so in reports.

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
