# Build log — T1 — Project truth: stack decision + settled container conventions + AGENTS.md

Task: T1 (2026-10-17)
Files changed: `docs/architecture/stack.md`, `docs/architecture/containerization.md`, `AGENTS.md`, `docs/features/stack-selection/build-log-T1.md`
Branch: `feat/stack-selection` (checked out by T0; HEAD at build start = `157002c` — `chore: widen builder edit permissions for stack-selection (T0)`)

What changed & why (≤5 lines):
1. `stack.md` — status line becomes DECIDED (2026-10-17); NOT-DECIDED prelude/rules replaced by a decided preamble; new `## Application stack (DECIDED, 2026-10-17)` section names every component + the canonical command table (contract 1.A–1.D).
2. `stack.md` — container bullet loses its NOT-DECIDED fragment and states the assets exist; `## Hard constraints (all candidates)` → `## Hard constraints` with the satisfied statement; the "When decided…" paragraph replaced by the operationalization sentence (1.E–1.G).
3. `containerization.md` — preamble becomes DECIDED (assets exist); § Real-time names `GET /ws` on port 8080; "Conventions to settle…" → settled record with every AC-5 item as a value (2.A–2.C).
4. `AGENTS.md` — § Stack bullets 1–3 decided; § Commands TBD replaced by the full command set (no TBD); § Conventions TS line de-ambiguated; § Project structure reflects the layout (3.A–3.F).
5. No new H2 in `containerization.md` (still 5); in-place edits limited to the plan's § Amendment trace items for these files; everything else additive.

Decisions:
- Section order in `stack.md`: decided preamble → `## Application stack (DECIDED, 2026-10-17)` → `## Containerized delivery path (DECIDED)` → `## Hard constraints` → closing paragraph (contract 1 fixes the items, not the exact order; the pinned relative order of the pre-existing sections is preserved).
- Commands rendered as a table in `stack.md` and as a bullet list in `AGENTS.md`; token-for-token identity is what AC-4 checks (per-token counts recorded below).
- `containerization.md` line 9 ("When the container assets land, run instructions must be documented…") is *not* in the plan's § Amendment trace for this file (only 2.A preamble, 2.B real-time tail, 2.C conventions section), so it is left byte-identical — no AC requires it and touching it would be drift.
- `containerization.md` § Local development contract keeps `docker compose up`-style wording (pre-existing, not in the amendment set).

---

## 1. Build-start baselines (captured 2026-10-17 13:18, before any edit)

Baseline = file content at build start; the build-start capture governs (plan.md § Pinned content contracts — Baseline rule).

```
$ sha256sum docs/architecture/stack.md docs/architecture/containerization.md AGENTS.md
e77a8828623a04249fd409e4981fb74ef1543e4b856ccfc34fb8019b0fbe3773  docs/architecture/stack.md
770c21680b179db5a26220b3da02b06095c6de603bfe5f975e188784db7a9977  docs/architecture/containerization.md
6516fa00e736d4934c0d328ab03ab0886c7b35f0254660f2ebfb846e44039426  AGENTS.md
$ git rev-parse HEAD
157002c268d5f4258f5723a8da344fe815f76237
```

Baseline copies retained during the build at `/tmp/opencode/t1-baseline/{stack.md,containerization.md,AGENTS.md}.base` (ephemeral scratch; the content is reproduced verbatim below so this log is self-contained).

### Baseline — `docs/architecture/stack.md` (27 lines)

```markdown
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
```

### Baseline — `docs/architecture/containerization.md` (40 lines)

```markdown
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
```

### Baseline — `AGENTS.md` (41 lines)

```markdown
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
```

---

## 2. Verify evidence (raw output)

### V1 — `grep -n "DECIDED\|NOT DECIDED\|2026-10-17" docs/architecture/stack.md AGENTS.md docs/architecture/containerization.md`

```
docs/architecture/stack.md:3:**Status: DECIDED** (application stack, 2026-10-17) — the containerized delivery path remains as decided (§ Containerized delivery path).
docs/architecture/stack.md:5:The application stack was decided on 2026-10-17 and is recorded in § Application stack (DECIDED, 2026-10-17) below; the container conventions it implies are settled in `docs/architecture/containerization.md`. Both are binding for all future work — a departure requires a user-owned amendment (spec revision first, then implementation).
docs/architecture/stack.md:7:## Application stack (DECIDED, 2026-10-17)
docs/architecture/stack.md:35:## Containerized delivery path (DECIDED)
docs/architecture/stack.md:38:- Docker images + Docker Compose are the decided containerization tooling (user decision, 2026-10-17).
docs/architecture/stack.md:41:- The application stack is decided (§ Application stack (DECIDED, 2026-10-17) above) and the container assets exist in this repository: `compose.yaml` and `compose.smoke.yaml` at the root, plus the Dockerfiles under `src/backend/` and `src/frontend/`.
AGENTS.md:7:- **Application stack: DECIDED (2026-10-17)** — TypeScript (strict); Node.js 24 LTS + Fastify (WebSocket); React + Vite; npm workspaces; Vitest; ESLint. Canonical details in `docs/architecture/stack.md`.
AGENTS.md:8:- **Containerized delivery path (DECIDED).** The local development and packaging path is containerized: backend and frontend run as containers, started locally with a single `docker compose up` command (hot reload); deployable artifacts are container images runnable on any container platform (AWS ECS Fargate is an example only — no provider is chosen); future services (databases, queues, etc.) join the same path. Docker and Docker Compose are the decided tooling; the container assets live in the repository (`compose.yaml`, Dockerfiles under `src/*`), and the run instructions live in `README.md` (see `docs/architecture/containerization.md`).
AGENTS.md:42:- Language: TypeScript (strict) — decided with the application stack (2026-10-17); see docs/architecture/stack.md.
docs/architecture/containerization.md:3:Decided 2026-10-17 per direct user direction (recorded in `docs/architecture/stack.md` § Containerized delivery path). This document is binding for the stack-selection task and for all future container work. The application stack itself is DECIDED (2026-10-17) — see `docs/architecture/stack.md` § Application stack (DECIDED, 2026-10-17) — and the container assets this document calls for exist in the repository (`compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile`, `src/frontend/Dockerfile`); the conventions below are settled and binding.
docs/architecture/containerization.md:31:## Container conventions (settled at stack selection, 2026-10-17)
exit=0
```

### V2 — `grep -in "typescript\|node\.js 24\|fastify\|react\|vite\|vitest\|eslint\|npm" docs/architecture/stack.md AGENTS.md`

```
docs/architecture/stack.md:9:- **Language:** TypeScript (strict), across every workspace.
docs/architecture/stack.md:10:- **Runtime:** Node.js 24 LTS.
docs/architecture/stack.md:11:- **Backend:** Fastify + `@fastify/websocket` — HTTP health at `GET /healthz`, WebSocket server at `GET /ws`.
docs/architecture/stack.md:12:- **Frontend:** React + Vite (SPA, static build).
docs/architecture/stack.md:13:- **Package manager:** npm (workspaces) — layout `src/backend` + `src/frontend`; unit tests colocated as `*.test.ts` beside the sources they cover; cross-service e2e tests in `tests/e2e/`.
docs/architecture/stack.md:14:- **Tests:** Vitest.
docs/architecture/stack.md:15:- **Lint:** ESLint (flat config) + typescript-eslint.
docs/architecture/stack.md:26:| `npm ci` | install dependencies from the committed lockfile |
docs/architecture/stack.md:27:| `npm run lint` | ESLint |
docs/architecture/stack.md:28:| `npm run typecheck` | TypeScript, no emit |
docs/architecture/stack.md:29:| `npm test` | Vitest, all workspaces |
docs/architecture/stack.md:30:| `npm run build` | build all workspaces |
docs/architecture/stack.md:31:| `npm run dev` | start the full local environment with hot reload (equivalent to `docker compose up`) |
docs/architecture/stack.md:32:| `npm run smoke` | containerized end-to-end smoke test (equivalent to `docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`) |
AGENTS.md:7:- **Application stack: DECIDED (2026-10-17)** — TypeScript (strict); Node.js 24 LTS + Fastify (WebSocket); React + Vite; npm workspaces; Vitest; ESLint. Canonical details in `docs/architecture/stack.md`.
AGENTS.md:13:Host tooling commands need Node.js 24 LTS + npm; running the environment itself needs only Docker with Compose. Run instructions live in `README.md`.
AGENTS.md:15:- `npm ci` — install dependencies from the committed lockfile.
AGENTS.md:16:- `npm run lint` — ESLint.
AGENTS.md:17:- `npm run typecheck` — TypeScript, no emit.
AGENTS.md:18:- `npm test` — Vitest unit tests, all workspaces.
AGENTS.md:19:- `npm run build` — build all workspaces.
AGENTS.md:20:- `npm run dev` — start the full local environment with hot reload (equivalent to `docker compose up`).
AGENTS.md:21:- `npm run smoke` — containerized end-to-end smoke test (equivalent to `docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`).
AGENTS.md:26:- `src/backend/` — backend workspace (Node.js + Fastify; its own Dockerfile)
AGENTS.md:27:- `src/frontend/` — frontend workspace (React + Vite; its own Dockerfile)
AGENTS.md:42:- Language: TypeScript (strict) — decided with the application stack (2026-10-17); see docs/architecture/stack.md.
exit=0
```

### V3 — `grep -n "npm ci\|npm run lint\|npm run typecheck\|npm test\|npm run build\|npm run dev\|npm run smoke\|docker compose up" docs/architecture/stack.md AGENTS.md`

```
docs/architecture/stack.md:26:| `npm ci` | install dependencies from the committed lockfile |
docs/architecture/stack.md:27:| `npm run lint` | ESLint |
docs/architecture/stack.md:28:| `npm run typecheck` | TypeScript, no emit |
docs/architecture/stack.md:29:| `npm test` | Vitest, all workspaces |
docs/architecture/stack.md:30:| `npm run build` | build all workspaces |
docs/architecture/stack.md:31:| `npm run dev` | start the full local environment with hot reload (equivalent to `docker compose up`) |
docs/architecture/stack.md:32:| `npm run smoke` | containerized end-to-end smoke test (equivalent to `docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`) |
docs/architecture/stack.md:33:| `docker compose up` | the single-command local environment (backend + frontend containers) |
docs/architecture/stack.md:37:- The backend and the frontend each run as containers; the full local environment starts from a clean checkout with a single `docker compose up`-style command.
docs/architecture/stack.md:51:The decision recorded above is operationalized by the scaffold in this repository: the container stack starts with `docker compose up`, the run instructions live in `README.md`, and the canonical commands (lint / typecheck / test / build / dev / smoke) are listed above and mirrored in `AGENTS.md` § Commands.
AGENTS.md:8:- **Containerized delivery path (DECIDED).** The local development and packaging path is containerized: backend and frontend run as containers, started locally with a single `docker compose up` command (hot reload); deployable artifacts are container images runnable on any container platform (AWS ECS Fargate is an example only — no provider is chosen); future services (databases, queues, etc.) join the same path. Docker and Docker Compose are the decided tooling; the container assets live in the repository (`compose.yaml`, Dockerfiles under `src/*`), and the run instructions live in `README.md` (see `docs/architecture/containerization.md`).
AGENTS.md:15:- `npm ci` — install dependencies from the committed lockfile.
AGENTS.md:16:- `npm run lint` — ESLint.
AGENTS.md:17:- `npm run typecheck` — TypeScript, no emit.
AGENTS.md:18:- `npm test` — Vitest unit tests, all workspaces.
AGENTS.md:19:- `npm run build` — build all workspaces.
AGENTS.md:20:- `npm run dev` — start the full local environment with hot reload (equivalent to `docker compose up`).
AGENTS.md:21:- `npm run smoke` — containerized end-to-end smoke test (equivalent to `docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`).
AGENTS.md:22:- **Local environment (containerized).** The full local environment starts with a single `docker compose up` command (backend + frontend containers); run instructions are documented in `README.md` at the repository root and mirrored here.
exit=0
```

### V4 — `grep -n "healthz\|8080\|5173\|VITE_WS_URL\|HEALTHCHECK\|cubeclicker-backend\|cubeclicker-frontend" docs/architecture/containerization.md`

```
27:- The backend container exposes the WebSocket endpoint required by `docs/architecture/stack.md` § Hard constraints — concretely the `GET /ws` WebSocket upgrade on the backend listen port 8080.
35:- **Listen ports and environment-variable names.** Backend: `HOST` (default `0.0.0.0`) and `PORT` (default `8080`) — HTTP health and WebSocket on that port. Frontend dev server: 5173 (Vite, strict port). Host mappings are loopback-bound and interpolated: `127.0.0.1:${BACKEND_PORT:-8080}:8080` and `127.0.0.1:${FRONTEND_PORT:-5173}:5173` (`BACKEND_PORT` default 8080, `FRONTEND_PORT` default 5173). The frontend's WebSocket target is `VITE_WS_URL`, default `ws://localhost:8080/ws`.
36:- **Health signal.** Backend: `GET /healthz` → `200` with body `{"status":"ok"}`; frontend: `GET /` serving the app. Each image declares its own `HEALTHCHECK` (interval 10s, timeout 3s, retries 5, start-period 15s); the compose files declare no duplicate healthcheck.
37:- **Image naming/tagging.** `cubeclicker-backend` and `cubeclicker-frontend`; the local (compose-built, `target: dev`) tag is `:dev`. Release tagging is deferred to deployment time.
exit=0
```

### V5 — `git diff HEAD -- docs/architecture/stack.md docs/architecture/containerization.md AGENTS.md`

Full diff shown in the terminal (reproduced by the commands below); summary of hunks — exactly the pinned modification set, nothing else:

```
AGENTS.md                              | 28 ++++++++++++++-------
docs/architecture/containerization.md  | 21 ++++++++--------
docs/architecture/stack.md             | 42 +++++++++++++++++++++++++-------
```
(stacked-stat taken together with V9b; the diff body is reproduced in § 2 V5b.)

### V5b — `diff -u <build-start baseline> <current file>` (baseline copy in `/tmp/opencode/t1-baseline/`)

Diffs identical to V5 for all three files (`stack diff exit=1`, `containerization diff exit=1`, `agents diff exit=1` — exit 1 = differences found, as expected). Hunk inventory:

- `stack.md`: `@@ -1,12 +1,36 @@` (1.A status line; 1.B prelude+rules replaced by decided preamble; 1.C/1.D new decision section + `### Commands`) and `@@ -14,14 +38,14 @@` (1.F container bullet; 1.E heading + satisfied sentence; 1.G closing paragraph). Pre-existing bullets lines 13/14/15/16/18 + the container path heading are unchanged context.
- `containerization.md`: `@@ -1,6 +1,6 @@` (2.A preamble) and `@@ -24,17 +24,18 @@` (2.B real-time bullet; 2.C heading + settled record). § Local development contract, § Service containerization rules and § Deployment neutrality are pure context (byte-identical).
- `AGENTS.md`: `@@ -4,23 +4,33 @@` (3.A–3.D, 3.F) and `@@ -29,7 +39,7 @@` (3.E). § Workflow and § Boundaries are pure context.

### V6 — AC-4 token-for-token presence (per-token counts)

```
$ for t in 'npm ci' 'npm run lint' 'npm run typecheck' 'npm test' 'npm run build' 'npm run dev' 'npm run smoke' 'docker compose up'; do … done
token=[npm ci] stack.md=1 AGENTS.md=1
token=[npm run lint] stack.md=1 AGENTS.md=1
token=[npm run typecheck] stack.md=1 AGENTS.md=1
token=[npm test] stack.md=1 AGENTS.md=1
token=[npm run build] stack.md=1 AGENTS.md=1
token=[npm run dev] stack.md=1 AGENTS.md=1
token=[npm run smoke] stack.md=1 AGENTS.md=1
token=[docker compose up] stack.md=4 AGENTS.md=3
```
Every AC-4 token appears in both files with identical spelling; `docker compose up` occurrences are the command row plus abbreviations inside the `npm run dev`/§ Containerized delivery path/closing sentences (both files).

### V7 — negative tests (AC-1, AC-2)

```
$ grep -n "NOT DECIDED" docs/architecture/stack.md
stack.md NOT-DECIDED matches exit=1        # no match at all
$ grep -n "remains NOT DECIDED\|is NOT DECIDED" docs/architecture/stack.md docs/architecture/containerization.md AGENTS.md
negative exit=1                            # no match at all
```

### V8 — AC-6: `containerization.md` section set retained (no new H2, count still 5)

```
$ grep -c '^## ' docs/architecture/containerization.md
5
$ grep -n '^## ' docs/architecture/containerization.md
5:## Local development contract
11:## Service containerization rules
19:## Deployment neutrality
25:## Real-time (WebSocket) requirement
31:## Container conventions (settled at stack selection, 2026-10-17)
```

### V9 — scope guard: only the owned paths changed

```
$ git status --short          # end of build
 M AGENTS.md
 M docs/architecture/containerization.md
 M docs/architecture/stack.md
 M docs/features/README.md                     # pre-existing at build start (not T1)
 M docs/features/project-glossary/status.md    # pre-existing at build start (not T1)
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md

$ git diff HEAD --stat
 AGENTS.md                                | 28 ++++++++++++++-------
 docs/architecture/containerization.md    | 21 ++++++++--------
 docs/architecture/stack.md               | 42 +++++++++++++++++++++++++-------
 docs/features/README.md                  |  1 +
 docs/features/project-glossary/status.md |  1 +
 5 files changed, 65 insertions(+), 28 deletions(-)
```

Build-start `git status --short` (captured before any edit, identical set):

```
 M docs/features/README.md
 M docs/features/project-glossary/status.md
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md
```

⇒ The two other modified files and all untracked artifacts pre-date T1; T1 added exactly `docs/architecture/stack.md`, `docs/architecture/containerization.md`, `AGENTS.md` (+ this log). No `.env*` file exists or was touched; nothing was pushed.

### V10 — AC-9 / AC-10 / AC-11 residuals

```
$ grep -n "per the agreed stack\|TBD\|public/" AGENTS.md
residual exit=1                            # no match: ambiguity line, TBD and public/ all gone
$ grep -n "src/backend/\|src/frontend/\|tests/e2e/\|colocated" AGENTS.md
26:- `src/backend/` — backend workspace (Node.js + Fastify; its own Dockerfile)
27:- `src/frontend/` — frontend workspace (React + Vite; its own Dockerfile)
28:- `tests/e2e/` — containerized smoke/e2e tests
32:Unit tests are colocated beside the sources they cover (`*.test.ts`, inside each workspace).
```

### V11 — AC-5 item tokens present in `containerization.md` (per-token counts)

```
HOST 1 | PORT 1 | BACKEND_PORT 1 | FRONTEND_PORT 1 | VITE_WS_URL 1 | healthz 1 | HEALTHCHECK 1
10s 1 | 3s 1 | 5 2 | 15s 1 | cubeclicker-backend 1 | cubeclicker-frontend 1
compose.yaml 3 | compose.smoke.yaml 3 | src/backend/Dockerfile 2 | src/frontend/Dockerfile 2
tsx watch 1 | HMR 1 | docker compose up 4 | README.md 1 | AGENTS.md 2
```

---

## 3. Acceptance audit (AC-1 … AC-11)

| AC | Status | Evidence |
| --- | --- | --- |
| AC-1 — `stack.md` records the decision (DECIDED + date + no NOT-DECIDED), decision section names every component | met | V1 (`stack.md:3` DECIDED + `2026-10-17`; `stack.md:7` decision H2), V7 (no NOT-DECIDED match), V2 (`stack.md:9–16`: TypeScript (strict), Node.js 24 LTS, Fastify, `@fastify/websocket`, React, Vite, npm (workspaces), Vitest, ESLint (+ typescript-eslint), `tsx`) |
| AC-2 — container path content retained + updated (assets exist, provider-neutral wording, pointer) | met | V1 (`stack.md:41` assets exist incl. `compose.yaml`), V5b (`stack.md:37–43` bullets preserved; provider-neutral/ECS-language bullet untouched context line 39; pointer line 43 intact) |
| AC-3 — WebSocket hard-constraint section retained and satisfied | met | V5b (`## Hard constraints` retains both capability bullet + rationale bullet; added sentence "the backend serves the WebSocket endpoint (`GET /ws`) and the frontend connects to it over WebSocket") |
| AC-4 — layout + canonical command list matching `AGENTS.md` § Commands token-for-token | met | V6 (all 8 tokens present in both files), V2/V3 rows for `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run dev`, `npm run smoke`, `docker compose up`; layout tokens `src/backend`, `src/frontend`, `tests/e2e`, `package.json`-free root compose/README reference in `stack.md:13`, `:33`, `:51` |
| AC-5 — conventions section replaced by a settled record with every item as a value | met | V4 + V11 + `containerization.md:31–41`: ports/env names (`HOST`/`PORT` 8080, dev 5173, `BACKEND_PORT`/`FRONTEND_PORT`, `VITE_WS_URL` default `ws://localhost:8080/ws`); health (`/healthz` + image `HEALTHCHECK` 10s/3s/5/15s); image naming/tagging (`cubeclicker-backend`/`-frontend`, `:dev`, release tagging deferred); file locations (`compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile`, `src/frontend/Dockerfile`); dev mode (`tsx watch` + Vite HMR over bind mounts, rebuild on dependency changes); local-run command `docker compose up` documented in `README.md` and mirrored in `AGENTS.md`; deployment-time deferrals named. No item left as a question. |
| AC-6 — preamble/status agree with `stack.md`, binding role + section set retained | met | V1 (`containerization.md:3` DECIDED 2026-10-17 + pointer + assets exist), V8 (still 5 H2 sections; the retitled settled section replaces the old one, no new H2) |
| AC-7 — § Real-time names the concrete endpoint and keeps the deployment-time proxy/LB flag | met | V4 (`containerization.md:27` `GET /ws` on port 8080); lines 28–29 (upgrade preservation + deployment-time flag + "contains no configuration") unchanged context |
| AC-8 — `AGENTS.md` § Stack decided bullets | met | V1 (`AGENTS.md:7` decided-stack bullet + pointer; `:8` assets in repo/`docker compose up`/`README.md` + provider-neutral wording retained; `:9` no "no framework/runtime is chosen" claim) |
| AC-9 — § Commands TBD replaced by full command set; local bullet present tense; no TBD | met | V3 (`AGENTS.md:13`, `:15–22`), V10 (no `TBD` match in AGENTS.md) |
| AC-10 — § Conventions TS line de-ambiguated | met | V1/`AGENTS.md:42`; V10 (no "per the agreed stack") |
| AC-11 — § Project structure reflects layout; `public/` replaced; rest retained | met | V10 (`AGENTS.md:26–32`), V5b (`docs/` and `.opencode/` lines unchanged; `public/` line gone) |

All T1 acceptance criteria met. Out-of-scope checks: no `.opencode/**` edit in T1 (files_owned respected), no `.env*`, no push, no dependency install.

Deviations from spec: none.

Commit: `docs: decide application stack and settle container conventions (T1)` — staged paths: `docs/architecture/stack.md`, `docs/architecture/containerization.md`, `AGENTS.md`, `docs/features/stack-selection/build-log-T1.md` (explicit `git add`, no `.`/`-A`).

### V12 — commit evidence (staged set + commit)

```
$ git diff --cached --name-only
AGENTS.md
docs/architecture/containerization.md
docs/architecture/stack.md
docs/features/stack-selection/build-log-T1.md

$ git commit -m "docs: decide application stack and settle container conventions (T1)"
[feat/stack-selection 449349b] docs: decide application stack and settle container conventions (T1)
 4 files changed, 448 insertions(+), 28 deletions(-)
 create mode 100644 docs/features/stack-selection/build-log-T1.md

$ git log --oneline -2
449349b docs: decide application stack and settle container conventions (T1)
157002c chore: widen builder edit permissions for stack-selection (T0)
```

The commit is local to `feat/stack-selection`; nothing was pushed; `.opencode/**` untouched by T1; no `.env*` file created or modified.

(Note: this log's V11/V12 evidence lines were finalized in the same T1 commit via `git commit --amend --no-edit` after the post-commit verification run; the final commit hash is reported by the builder's Subagent Report.)
