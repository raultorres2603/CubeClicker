# Build log — T1 — Project-level truth: split status + containerized delivery path

Task: T1 (2026-10-17, branch `feat/containerized-workflow`, base `8b34eff`)
Files changed:
- `AGENTS.md` (edit)
- `docs/architecture/stack.md` (edit)
- `docs/architecture/containerization.md` (NEW)
- `docs/features/containerized-workflow/build-log-T1.md` (this file)

What changed & why (≤5 lines):
1. `stack.md`: split status line (1.A), rules-bullet excepts decided container tooling (1.B),
   new `## Containerized delivery path (DECIDED)` section (1.C), WebSocket closing sentence
   scoped to the application stack (1.D), closing paragraph gains the stack-selection container
   deliverable (1.E).
2. `containerization.md` NEW: closed H2 set — local-run contract, service rules, deploy
   neutrality, WebSocket requirement, conventions to settle.
3. `AGENTS.md` § Stack: bullet 1 becomes "Application stack: NOT DECIDED" (3.A) + container
   delivery-path bullet (3.B); § Commands gains the local-run contract bullet (3.C).
4. No container assets, no application technology names, no permission edits (AC-25/27/28).

Decisions:
- Baselines captured at build start (D-11) via `git show HEAD:<path>` (HEAD `8b34eff`) BEFORE
  the first edit — recorded verbatim below.
- Step 0 done first: verified branch `feat/online-realtime-workflow`, HEAD `8b34eff`,
  `feat/containerized-workflow` absent; created via `git switch -c feat/containerized-workflow`
  (same commit, dirty tree carried over). `main` untouched; untracked feature process files and
  modified `docs/features/README.md` / `docs/features/online-realtime-workflow/status.md` left as found.

## Step 0 evidence

```
$ git rev-parse HEAD
8b34eff18c67561facc396d2cf0231e0bf61f538
$ git branch --list   (before switch)
* feat/online-realtime-workflow
  main
$ git switch -c feat/containerized-workflow
Switched to a new branch 'feat/containerized-workflow'
$ git branch --list   (after switch)
* feat/containerized-workflow
  feat/online-realtime-workflow
  main
$ git rev-parse HEAD
8b34eff18c67561facc396d2cf0231e0bf61f538
$ git status --short
 M docs/features/README.md
 M docs/features/online-realtime-workflow/status.md
?? docs/features/containerized-workflow/
```

## Build-start baselines (governing, D-11)

### BASELINE CAPTURE (build start, branch feat/containerized-workflow @ 8b34eff18c67561facc396d2cf0231e0bf61f538)

#### git show HEAD:AGENTS.md (md5: eb578d0fa56a115e29898336c7929766)
```markdown
# CubeClicker — Project Instructions

CubeClicker is a web-based, online, real-time, multi-client clicker game. Clients are expected to see each other's live activity (live stats, other users' clicks, connected users). This project is AI-native: feature work flows through a four-agent pipeline defined in `.opencode/` — `orchestrator` (primary, user-facing) delegates to `planner`, `builder`, and `reviewer` subagents.

## Stack

- **NOT DECIDED.** The canonical stack lives in `docs/architecture/stack.md`. Until that file defines it, agents MUST NOT introduce, assume, or install any framework, runtime, build tool, or dependency; the builder reports `blocked` instead of guessing.
- **Online/real-time constraint (protocol-level).** The game is online and real-time: the backend must be WebSocket-compatible and the frontend must connect to it over WebSocket. Any stack selection must satisfy this. No framework, library, or runtime is implied or chosen. See docs/architecture/stack.md § Hard constraints.

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
```

#### git show HEAD:docs/architecture/stack.md (md5: f83fdfa3316bffab4a35f2a8e717ac6f)
```markdown
# Stack

**Status: NOT DECIDED**

The stack will be selected via a dedicated stack-selection task. Until this file is filled in:

- Agents MUST NOT introduce, assume, or install any framework, language runtime, build tool, or dependency.
- The Builder MUST report `blocked` if asked to implement code before the stack is decided.
- The Planner may write stack-agnostic specs but MUST flag stack-dependent decisions as open questions.

## Hard constraints (all candidates)

- Any selected stack must support a WebSocket server on the backend and WebSocket client connections from the frontend.
- Rationale: CubeClicker is an online, real-time game with cross-client visibility — clients are expected to see each other's live activity.
- This section constrains capability only; it names no technology and the stack remains NOT DECIDED until the stack-selection task decides it.

When decided, this file will define: language, framework, build tooling, test tooling, package manager, project layout, and the canonical commands (lint / typecheck / test / build / dev) mirrored in `AGENTS.md`.
```

#### git show HEAD:docs/architecture/containerization.md
fatal: path 'docs/architecture/containerization.md' does not exist in 'HEAD'
(does not exist at HEAD — new file)

Baseline files present at HEAD in docs/architecture/: only `stack.md` (no `containerization.md`). No `Dockerfile*`/compose files exist anywhere in the repo at build start.
## Verify commands (raw output)

### `test -f docs/architecture/containerization.md`
EXIT 0 — new doc exists

### `grep -n "^## " docs/architecture/containerization.md`
5:## Local development contract
11:## Service containerization rules
19:## Deployment neutrality
25:## Real-time (WebSocket) requirement
31:## Conventions to settle at stack selection

### `grep -n "^# " docs/architecture/containerization.md` (H1)
1:# Containerized Delivery Path

### `grep -in "NOT DECIDED\|containerized delivery path\|docker compose\|Docker Compose\|ECS Fargate" AGENTS.md docs/architecture/stack.md docs/architecture/containerization.md`
AGENTS.md:7:- **Application stack: NOT DECIDED.** The canonical stack lives in `docs/architecture/stack.md`. Until that file defines it, agents MUST NOT introduce, assume, or install any framework, runtime, build tool, or dependency beyond the decided containerized delivery path (next bullet); the builder reports `blocked` for stack-dependent implementation instead of guessing.
AGENTS.md:8:- **Containerized delivery path (DECIDED).** The local development and packaging path is containerized: backend and frontend run as containers, started locally with a single `docker compose up`-style command; deployable artifacts are container images runnable on any container platform (AWS ECS Fargate is an example only — no provider is chosen); future services (databases, queues, etc.) join the same path. Docker and Docker Compose are the decided tooling; concrete container assets are authored once the application stack is decided (see `docs/architecture/containerization.md`).
AGENTS.md:14:- **Local environment (containerized).** The full local environment will start with a single `docker compose up`-style command (backend + frontend containers) once the container assets land; run instructions will be documented at the repo root and mirrored here.
docs/architecture/stack.md:3:**Status: NOT DECIDED** (application stack) — **DECIDED:** the containerized delivery path (§ Containerized delivery path; user decision, 2026-10-17).
docs/architecture/stack.md:7:- Agents MUST NOT introduce, assume, or install any framework, language runtime, build tool, or dependency beyond the decided containerization tooling (Docker images + Docker Compose; § Containerized delivery path).
docs/architecture/stack.md:11:## Containerized delivery path (DECIDED)
docs/architecture/stack.md:13:- The backend and the frontend each run as containers; the full local environment starts from a clean checkout with a single `docker compose up`-style command.
docs/architecture/stack.md:14:- Docker images + Docker Compose are the decided containerization tooling (user decision, 2026-10-17).
docs/architecture/stack.md:15:- Deployable artifacts are container images runnable on any container platform — provider-neutral; AWS ECS Fargate is an example only and no provider is chosen.
docs/architecture/stack.md:17:- The application stack (language, framework, runtime, tooling, ports) remains NOT DECIDED; concrete container assets (Dockerfiles, compose file) are authored at/after stack selection.
docs/architecture/stack.md:25:- This section constrains capability only; it names no technology, and the application stack remains NOT DECIDED until the stack-selection task decides it.
docs/architecture/stack.md:27:When decided, this file will define: language, framework, build tooling, test tooling, package manager, project layout, and the canonical commands (lint / typecheck / test / build / dev) mirrored in `AGENTS.md`. The stack-selection task must also produce the container assets that realize the decided delivery path (Dockerfiles, compose file) and document the single-command local run (see § Containerized delivery path).
docs/architecture/containerization.md:1:# Containerized Delivery Path
docs/architecture/containerization.md:3:Decided 2026-10-17 per direct user direction (recorded in `docs/architecture/stack.md` § Containerized delivery path). This document is binding for the stack-selection task and for all future container work. The application stack itself (language, framework, runtime, tooling, ports) remains NOT DECIDED — see `docs/architecture/stack.md`.
docs/architecture/containerization.md:7:- The full environment — backend and frontend containers, plus any future services — starts from a clean checkout with a single `docker compose up`-style command.
docs/architecture/containerization.md:22:- AWS ECS Fargate (named by the user) is an example only; no provider is chosen and no commitment is recorded.

### `git diff HEAD -- AGENTS.md docs/architecture/stack.md` (vs. build-start baseline = HEAD)
diff --git a/AGENTS.md b/AGENTS.md
index e9b5315..888e954 100644
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -4,12 +4,14 @@ CubeClicker is a web-based, online, real-time, multi-client clicker game. Client
 
 ## Stack
 
-- **NOT DECIDED.** The canonical stack lives in `docs/architecture/stack.md`. Until that file defines it, agents MUST NOT introduce, assume, or install any framework, runtime, build tool, or dependency; the builder reports `blocked` instead of guessing.
+- **Application stack: NOT DECIDED.** The canonical stack lives in `docs/architecture/stack.md`. Until that file defines it, agents MUST NOT introduce, assume, or install any framework, runtime, build tool, or dependency beyond the decided containerized delivery path (next bullet); the builder reports `blocked` for stack-dependent implementation instead of guessing.
+- **Containerized delivery path (DECIDED).** The local development and packaging path is containerized: backend and frontend run as containers, started locally with a single `docker compose up`-style command; deployable artifacts are container images runnable on any container platform (AWS ECS Fargate is an example only — no provider is chosen); future services (databases, queues, etc.) join the same path. Docker and Docker Compose are the decided tooling; concrete container assets are authored once the application stack is decided (see `docs/architecture/containerization.md`).
 - **Online/real-time constraint (protocol-level).** The game is online and real-time: the backend must be WebSocket-compatible and the frontend must connect to it over WebSocket. Any stack selection must satisfy this. No framework, library, or runtime is implied or chosen. See docs/architecture/stack.md § Hard constraints.
 
 ## Commands
 
 - **TBD** — filled in after the stack-selection task (lint, typecheck, test, build, dev). Until then, treat commands as unavailable and say so in reports.
+- **Local environment (containerized).** The full local environment will start with a single `docker compose up`-style command (backend + frontend containers) once the container assets land; run instructions will be documented at the repo root and mirrored here.
 
 ## Project structure
 
diff --git a/docs/architecture/stack.md b/docs/architecture/stack.md
index 7784b7f..0328a5b 100644
--- a/docs/architecture/stack.md
+++ b/docs/architecture/stack.md
@@ -1,17 +1,27 @@
 # Stack
 
-**Status: NOT DECIDED**
+**Status: NOT DECIDED** (application stack) — **DECIDED:** the containerized delivery path (§ Containerized delivery path; user decision, 2026-10-17).
 
 The stack will be selected via a dedicated stack-selection task. Until this file is filled in:
 
-- Agents MUST NOT introduce, assume, or install any framework, language runtime, build tool, or dependency.
+- Agents MUST NOT introduce, assume, or install any framework, language runtime, build tool, or dependency beyond the decided containerization tooling (Docker images + Docker Compose; § Containerized delivery path).
 - The Builder MUST report `blocked` if asked to implement code before the stack is decided.
 - The Planner may write stack-agnostic specs but MUST flag stack-dependent decisions as open questions.
 
+## Containerized delivery path (DECIDED)
+
+- The backend and the frontend each run as containers; the full local environment starts from a clean checkout with a single `docker compose up`-style command.
+- Docker images + Docker Compose are the decided containerization tooling (user decision, 2026-10-17).
+- Deployable artifacts are container images runnable on any container platform — provider-neutral; AWS ECS Fargate is an example only and no provider is chosen.
+- Future services (databases, queues, etc.) are added via the same containerized path.
+- The application stack (language, framework, runtime, tooling, ports) remains NOT DECIDED; concrete container assets (Dockerfiles, compose file) are authored at/after stack selection.
+- The backend container must expose the WebSocket endpoint required by § Hard constraints.
+- Binding requirements live in `docs/architecture/containerization.md`.
+
 ## Hard constraints (all candidates)
 
 - Any selected stack must support a WebSocket server on the backend and WebSocket client connections from the frontend.
 - Rationale: CubeClicker is an online, real-time game with cross-client visibility — clients are expected to see each other's live activity.
-- This section constrains capability only; it names no technology and the stack remains NOT DECIDED until the stack-selection task decides it.
+- This section constrains capability only; it names no technology, and the application stack remains NOT DECIDED until the stack-selection task decides it.
 
-When decided, this file will define: language, framework, build tooling, test tooling, package manager, project layout, and the canonical commands (lint / typecheck / test / build / dev) mirrored in `AGENTS.md`.
+When decided, this file will define: language, framework, build tooling, test tooling, package manager, project layout, and the canonical commands (lint / typecheck / test / build / dev) mirrored in `AGENTS.md`. The stack-selection task must also produce the container assets that realize the decided delivery path (Dockerfiles, compose file) and document the single-command local run (see § Containerized delivery path).

### AC-27 — no implementation/container assets added (git status --short, full tree)
 M AGENTS.md
 M docs/architecture/stack.md
 M docs/features/README.md
 M docs/features/online-realtime-workflow/status.md
?? docs/architecture/containerization.md
?? docs/features/containerized-workflow/
-- untracked/added container or CI asset patterns in index/worktree:
(none)

### AC-25 — .env* untouched
(no .env* entries in git status)

### AC-28 — technology-name scan of new content (allow-list check)
-- ECS Fargate occurrences with framing:
AGENTS.md:8:- **Containerized delivery path (DECIDED).** The local development and packaging path is containerized: backend and frontend run as containers, started locally with a single `docker compose up`-style command; deployable artifacts are container images runnable on any container platform (AWS ECS Fargate is an example only — no provider is chosen); future services (databases, queues, etc.) join the same path. Docker and Docker Compose are the decided tooling; concrete container assets are authored once the application stack is decided (see `docs/architecture/containerization.md`).
docs/architecture/stack.md:15:- Deployable artifacts are container images runnable on any container platform — provider-neutral; AWS ECS Fargate is an example only and no provider is chosen.
docs/architecture/containerization.md:22:- AWS ECS Fargate (named by the user) is an example only; no provider is chosen and no commitment is recorded.
-- scan for application technology names outside allow-list in new content:
(none found)

### Reference resolution — pointers to containerization.md resolve
AGENTS.md:8:- **Containerized delivery path (DECIDED).** The local development and packaging path is containerized: backend and frontend run as containers, started locally with a single `docker compose up`-style command; deployable artifacts are container images runnable on any container platform (AWS ECS Fargate is an example only — no provider is chosen); future services (databases, queues, etc.) join the same path. Docker and Docker Compose are the decided tooling; concrete container assets are authored once the application stack is decided (see `docs/architecture/containerization.md`).
docs/architecture/stack.md:19:- Binding requirements live in `docs/architecture/containerization.md`.
RESOLVES: file exists

### files changed vs HEAD (name-status)
 M AGENTS.md
 M docs/architecture/stack.md
 M docs/features/README.md
 M docs/features/online-realtime-workflow/status.md
?? docs/architecture/containerization.md
?? docs/features/containerized-workflow/

## Diff-vs-baseline analysis (AC-26, T1 scope)

Baseline = `HEAD` (`8b34eff`) content captured verbatim above. `git diff HEAD -- AGENTS.md docs/architecture/stack.md` + the new file:

- **In-place modifications (exactly the T1 items pinned by contracts 1.A/1.B/1.D/1.E/3.A):**
  - `AGENTS.md` § Stack bullet 1 — reworded per 3.A. The WebSocket bullet (l.8) and TBD bullet (l.12) are byte-identical to baseline.
  - `stack.md` status line (l.3) — per 1.A.
  - `stack.md` rules bullet 1 (l.7) — per 1.B. Bullets 2–3 byte-identical.
  - `stack.md` WebSocket closing sentence (l.25) — per 1.D. The two capability bullets (l.23–24) byte-identical.
  - `stack.md` closing "When decided…" paragraph (l.27) — per 1.E: original sentence retained verbatim, one sentence appended (amendment-trace class (ii), pre-existing unpinned content).
- **Additions only (no pre-existing content removed):**
  - `AGENTS.md`: +1 § Stack bullet (3.B), +1 § Commands bullet (3.C).
  - `stack.md`: +1 section `## Containerized delivery path (DECIDED)` with 7 bullets (1.C), placed between the "Until this file is filled in" bullet list and `## Hard constraints (all candidates)`.
  - `docs/architecture/containerization.md`: new file (contract 2), H1 + preamble + exactly the 5 pinned H2 sections.
- **No drift:** `git diff` shows no removed lines other than the five in-place replacement lines above; no unrelated edits; no permission blocks (no `.opencode/` file touched at all by T1).

## Acceptance audit (AC-1 … AC-13)

| AC | Verdict | Evidence (file:line / command) |
| --- | --- | --- |
| AC-1 | met | `stack.md:3` — `**Status: NOT DECIDED** (application stack) — **DECIDED:** the containerized delivery path (§ Containerized delivery path; user decision, 2026-10-17).` |
| AC-2 | met | `stack.md:7` rules bullet 1 now excepts only "the decided containerization tooling (Docker images + Docker Compose…)"; bullets 2 (blocked) and 3 (planner open questions) unchanged (diff). |
| AC-3 | met | `stack.md:21–25` — section retained; capability bullets 23–24 and rationale verbatim; closing sentence amended to "…it names no technology, and the application stack remains NOT DECIDED…"; no technology named (AC-28 scan). |
| AC-4 | met | `stack.md:11–19` — heading `## Containerized delivery path (DECIDED)`; l.13 (a)+(b); l.14 (c); l.15 (d, provider-neutral + ECS Fargate example-only, no provider chosen); l.16 (e); l.17 (f); l.19 (g, pointer to `containerization.md`). |
| AC-5 | met | `stack.md:27` — closing paragraph now also: "The stack-selection task must also produce the container assets … (Dockerfiles, compose file) and document the single-command local run…". |
| AC-6 | met | `test -f` EXIT 0; `grep -n "^## "` returns exactly the 5 pinned H2s; H1 `# Containerized Delivery Path` l.1; 3-line preamble l.3 includes application-stack NOT DECIDED pointer. |
| AC-7 | met | `containerization.md:5–9` — clean-checkout single `docker compose up`-style command for backend+frontend+future services; no host prerequisites beyond Docker with Compose; run instructions at repo root mirrored in `AGENTS.md` § Commands (no README created — `git status` shows none). |
| AC-8 | met | `containerization.md:11–17` — own image per deployable (image = artifact); future services same path; env-var config with safe local defaults; secrets injected at run time, never committed/baked; `.env*` user-owned/agent-forbidden. |
| AC-9 | met | `containerization.md:19–23` — any container platform, no lock-in; AWS ECS Fargate example-only with explicit no-commitment; provider selection a separate future decision. |
| AC-10 | met | `containerization.md:25–29` — backend container exposes the WebSocket endpoint; local+deployed must preserve upgrades end-to-end; proxy/LB flagged deployment-time; no proxy/LB configuration present (grep: no config lines). |
| AC-11 | met | `containerization.md:31–38` — ports + env-var names; health signal; image naming/tagging; compose location/name + Dockerfile locations; dev-mode behavior; exact local-run command(s). |
| AC-12 | met | `AGENTS.md:7` retains NOT DECIDED (scoped "Application stack") + `blocked`; `AGENTS.md:8` new bullet contains "Docker", "Docker Compose", "`docker compose up`", "any container platform", "AWS ECS Fargate is an example only", future services, pointer to `docs/architecture/containerization.md`; WebSocket bullet (`AGENTS.md:9` = baseline l.8) untouched. |
| AC-13 | met | `AGENTS.md:12` TBD bullet retained byte-identical; `AGENTS.md:14` new local-run bullet (single `docker compose up`-style command, backend+frontend containers, run instructions at repo root mirrored in § Commands). |
| AC-25 (T1 scope) | met | `git status --porcelain` — no `.env*`; T1 touches no `.opencode/`/`opencode.jsonc` file at all, so no permission block is modified. |
| AC-26 (T1 scope) | met | Diff-vs-baseline analysis above — only the pinned in-place modifications + additions. |
| AC-27 (T1 scope) | met | `git status --porcelain` shows only `AGENTS.md`, `docs/architecture/stack.md`, new `docs/architecture/containerization.md`, build log + pre-existing process files; grep for `dockerfile|compose|yml|src/|tests/|public/` → none. |
| AC-28 (T1 scope) | met | Technology scan of new content → no out-of-allow-list names; `ECS Fargate` only with example-only/no-commitment framing (AGENTS.md:8, stack.md:15, containerization.md:22); `containerization.md` exists and every pointer resolves (grep + `test -f`). |

## Deviations from spec

None. Pinned replacements are byte-exact per contracts 1.A/1.B/1.D/1.E/3.A/3.B/3.C; everything else additive; no container assets, no application technology names, no permission or `.env*` edits.
