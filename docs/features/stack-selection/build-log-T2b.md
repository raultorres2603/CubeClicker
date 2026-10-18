# Build log — T2b — Tooling amendment: decided docs Docker → Podman

Task: T2b (2026-10-18)
Files changed: `docs/architecture/stack.md`, `docs/architecture/containerization.md`, `AGENTS.md`, `docs/features/stack-selection/build-log-T2b.md`

## What changed & why (≤5 lines)

Applied `plan.md` contract 15 byte-exact: `docker compose` → `podman compose` in the three decided docs (5 tokens in `stack.md`, 5 in `containerization.md`, 4 in `AGENTS.md`). Applied the three pinned tooling/prerequisite phrase replacements (15.A tooling bullet, 15.B prerequisite bullet, 15.C tooling + prerequisite phrases). Nothing else changed: no other line, no headings, no counts, no `Dockerfile`/`.dockerignore` filename mentions. Rationale: r3 user decision (Docker → Podman) must reach the decided docs before T3 mirrors them into the scaffold.

## Decisions

- Contract 15 governs over the brief's shorthand: 15.A's tooling bullet is a deliberate phrase-structure change (`- Docker images + Docker Compose are…` → `- Podman and Podman Compose (`podman compose`) are… (user decision, 2026-10-17; tooling amendment 2026-10-17).`) — applied verbatim, no latitude. Same for 15.C's two phrases.
- Baselines captured to `/tmp/opencode/t2b-baseline/` (sha256 + copies) before any edit; per-file `diff -u` vs baseline is the authoritative change check.
- No build/test commands in this task's verify list (docs-only). Nothing was installed or built; no dependency, config, or permission file touched.

## Baselines (build start, HEAD `7ec718f`)

```
eeadf6e66d780fd36e7135f5d8b4e8b235ccbe3844d5482374513335ad8d2fee  docs/architecture/stack.md
0528fa129de3d12db29bc84302eb4c1b93291cea0675abacab2f9f414aee72b6  docs/architecture/containerization.md
d46df8211f949d96c9952b9cf0db48e24350ad0e315d84e27dfd13627b9be3fa  AGENTS.md
   51 docs/architecture/stack.md
   41 docs/architecture/containerization.md
   51 AGENTS.md
```
`git diff --stat HEAD -- <three files>` at build start → empty (clean baseline == HEAD).

Pre-edit old-token inventory (occurrences):

```
$ grep -c "docker compose" docs/architecture/stack.md docs/architecture/containerization.md AGENTS.md
docs/architecture/stack.md:5
docs/architecture/containerization.md:4
AGENTS.md:4
```
(`containerization.md` line 40 carries two occurrences on one line → 5 occurrences / 4 lines, matching contract 15.B's "5 tokens".)

## Evidence

### V1 — positive grep: new tokens present

```
$ grep -n "podman compose" docs/architecture/stack.md docs/architecture/containerization.md AGENTS.md
docs/architecture/stack.md:31:| `npm run dev` | start the full local environment with hot reload (equivalent to `podman compose up`) |
docs/architecture/stack.md:32:| `npm run smoke` | containerized end-to-end smoke test (equivalent to `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`) |
docs/architecture/stack.md:33:| `podman compose up` | the single-command local environment (backend + frontend containers) |
docs/architecture/stack.md:37:- The backend and the frontend each run as containers; the full local environment starts from a clean checkout with a single `podman compose up`-style command.
docs/architecture/stack.md:38:- Podman and Podman Compose (`podman compose`) are the decided containerization tooling (user decision, 2026-10-17; tooling amendment 2026-10-17).
docs/architecture/stack.md:51:The decision recorded above is operationalized by the scaffold in this repository: the container stack starts with `podman compose up`, the run instructions live in `README.md`, and the canonical commands (lint / typecheck / test / build / dev / smoke) are listed above and mirrored in `AGENTS.md` § Commands.
docs/architecture/containerization.md:7:- The full environment — backend and frontend containers, plus any future services — starts from a clean checkout with a single `podman compose up`-style command.
docs/architecture/containerization.md:8:- No host prerequisites beyond Podman with a working compose provider (`podman compose`).
docs/architecture/containerization.md:38:- **Compose file and Dockerfile locations.** `compose.yaml` at the repository root (project name `cubeclicker`; services `backend`, `frontend`), `compose.smoke.yaml` at the root (service `smoke`; opt-in, never part of a plain `podman compose up`), and one multi-stage Dockerfile per workspace: `src/backend/Dockerfile`, `src/frontend/Dockerfile` (targets `dev` and `prod`).
docs/architecture/containerization.md:39:- **Dev-mode behavior.** Hot reload: backend `tsx watch` and frontend Vite HMR, over bind mounts of each workspace's sources. Dependency or manifest changes require a rebuild (`podman compose up --build`).
docs/architecture/containerization.md:40:- **Local-run command and its README home.** `podman compose up` starts the full local environment; it is documented in `README.md` at the repository root and mirrored in `AGENTS.md` § Commands (as `npm run dev`). The containerized smoke test runs with `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` (`npm run smoke`).
AGENTS.md:8:- **Containerized delivery path (DECIDED).** … started locally with a single `podman compose up` command (hot reload); … Podman and Podman Compose (`podman compose`) are the decided tooling; …
AGENTS.md:13:Host tooling commands need Node.js 24 LTS + npm; running the environment itself needs only Podman with a working compose provider (`podman compose`). Run instructions live in `README.md`.
AGENTS.md:20:- `npm run dev` — start the full local environment with hot reload (equivalent to `podman compose up`).
AGENTS.md:21:- `npm run smoke` — containerized end-to-end smoke test (equivalent to `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`).
AGENTS.md:22:- **Local environment (containerized).** The full local environment starts with a single `podman compose up` command (backend + frontend containers); …
exit=0
```

### V2 — negative grep: old tokens absent (case-insensitive)

```
$ grep -in "docker compose\|Docker with Compose\|Docker and Docker Compose\|Docker images + Docker Compose" docs/architecture/stack.md docs/architecture/containerization.md AGENTS.md
exit=1   # no hits
```

### V3 — occurrence counts of the new token

```
$ grep -o "podman compose" docs/architecture/stack.md docs/architecture/containerization.md AGENTS.md | sort | uniq -c
      6 AGENTS.md:podman compose
      6 docs/architecture/containerization.md:podman compose
      6 docs/architecture/stack.md:podman compose
```
(stack.md = 5 replaced tokens + 1 in the 15.A tooling bullet; containerization.md = 5 + 1 in the 15.B prerequisite bullet; AGENTS.md = 4 + 1 in the 15.C tooling phrase + 1 in the 15.C prerequisite phrase.)

### V4/V11 — `Docker` mentions retained are filenames only

```
$ grep -in "docker" docs/architecture/stack.md docs/architecture/containerization.md AGENTS.md
docs/architecture/stack.md:41: … plus the Dockerfiles under `src/backend/` and `src/frontend/`.
docs/architecture/containerization.md:3: … (`compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile`, `src/frontend/Dockerfile`) …
docs/architecture/containerization.md:38: … one multi-stage Dockerfile per workspace: `src/backend/Dockerfile`, `src/frontend/Dockerfile` (targets `dev` and `prod`).
AGENTS.md:8: … the container assets live in the repository (`compose.yaml`, Dockerfiles under `src/*`) …
AGENTS.md:26:- `src/backend/` — backend workspace (Node.js + Fastify; its own Dockerfile)
AGENTS.md:27:- `src/frontend/` — frontend workspace (React + Vite; its own Dockerfile)
```
Every `Docker*` hit is a `Dockerfile`/`Dockerfiles` filename mention — explicitly unchanged by contract 15.

### V5 — per-file diff vs build-start baseline (authoritative: only the pinned deltas)

```
$ diff -u /tmp/opencode/t2b-baseline/stack.md docs/architecture/stack.md
@@ -28,14 +28,14 @@
 | `npm run build` | build all workspaces |
-| `npm run dev` | … (equivalent to `docker compose up`) |
-| `npm run smoke` | … (equivalent to `docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`) |
-| `docker compose up` | the single-command local environment (backend + frontend containers) |
+| `npm run dev` | … (equivalent to `podman compose up`) |
+| `npm run smoke` | … (equivalent to `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`) |
+| `podman compose up` | the single-command local environment (backend + frontend containers) |
 
 ## Containerized delivery path (DECIDED)
 
-- … a single `docker compose up`-style command.
-- Docker images + Docker Compose are the decided containerization tooling (user decision, 2026-10-17).
+- … a single `podman compose up`-style command.
+- Podman and Podman Compose (`podman compose`) are the decided containerization tooling (user decision, 2026-10-17; tooling amendment 2026-10-17).
@@ -48,4 +48,4 @@
-The decision recorded above … starts with `docker compose up`, …
+The decision recorded above … starts with `podman compose up`, …

$ diff -u /tmp/opencode/t2b-baseline/containerization.md docs/architecture/containerization.md
@@ -4,8 +4,8 @@
-- … a single `docker compose up`-style command.
-- No host prerequisites beyond Docker with Compose.
+- … a single `podman compose up`-style command.
+- No host prerequisites beyond Podman with a working compose provider (`podman compose`).
@@ -35,7 +35,7 @@
-- **Compose file and Dockerfile locations.** … never part of a plain `docker compose up`), …
-- **Dev-mode behavior.** … require a rebuild (`docker compose up --build`).
-- **Local-run command and its README home.** `docker compose up` starts … with `docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` (`npm run smoke`).
+- **Compose file and Dockerfile locations.** … never part of a plain `podman compose up`), …
+- **Dev-mode behavior.** … require a rebuild (`podman compose up --build`).
+- **Local-run command and its README home.** `podman compose up` starts … with `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` (`npm run smoke`).

$ diff -u /tmp/opencode/t2b-baseline/AGENTS.md AGENTS.md
@@ -5,21 +5,21 @@ (three hunks: line 8 bullet; line 13 prerequisite sentence; lines 20–22 command/local-env bullets)
-… single `docker compose up` command … Docker and Docker Compose are the decided tooling; …
+… single `podman compose up` command … Podman and Podman Compose (`podman compose`) are the decided tooling; …
-needs only Docker with Compose.
+needs only Podman with a working compose provider (`podman compose`).
-… (equivalent to `docker compose up`). / … (`docker compose -f …`). / … single `docker compose up` command …
+… (equivalent to `podman compose up`). / … (`podman compose -f …`). / … single `podman compose up` command …
```
Line counts unchanged in all three files (51 / 41 / 51). Every hunk is a pinned substitution; no other line, heading, or value changed (contract 15's "every other line stays byte-identical").

### V6 — `git diff HEAD` equals the pinned deltas

`git diff HEAD -- docs/architecture/stack.md docs/architecture/containerization.md AGENTS.md` → the same three diffs as V5 (index `a8a0ded..9799b41`, `1d44b4e..5667073`, `8533d8c..ccf4f18`); no additional hunks.

### V7/V8 — `git status --short` (no stray files, no `.env*`)

```
$ git status --short
 M AGENTS.md
 M docs/architecture/containerization.md
 M docs/architecture/stack.md
 M docs/features/README.md                      # pre-existing, untouched/unstaged
 M docs/features/project-glossary/status.md     # pre-existing, untouched/unstaged
?? docs/features/stack-selection/build-log-T3.md # pre-existing, untouched
?? docs/features/stack-selection/plan.md         # pre-existing, untouched
?? docs/features/stack-selection/reviews/        # pre-existing, untouched
?? docs/features/stack-selection/spec.md         # pre-existing, untouched
?? docs/features/stack-selection/status.md       # pre-existing, untouched
?? docs/features/stack-selection/tasks.md        # pre-existing, untouched

$ git status --short | grep -i "\.env"
exit=1   # no `.env*` entry
```

### V9 — cross-file consistency (AC-4 / AC-9 / AC-34 tooling portion)

```
$ for t in '`npm ci`' '`npm run lint`' '`npm run typecheck`' '`npm test`' '`npm run build`' '`npm run dev`' '`npm run smoke`' '`podman compose up`'; do printf "…"; done
`npm ci`                 stack.md=1 AGENTS.md=1
`npm run lint`           stack.md=1 AGENTS.md=1
`npm run typecheck`      stack.md=1 AGENTS.md=1
`npm test`               stack.md=1 AGENTS.md=1
`npm run build`          stack.md=1 AGENTS.md=1
`npm run dev`            stack.md=1 AGENTS.md=1
`npm run smoke`          stack.md=1 AGENTS.md=1
`podman compose up`      stack.md=4 AGENTS.md=3
```
Every AC-4 token is present exactly once in `stack.md`'s command table and once in `AGENTS.md` § Commands; `podman compose up` appears 4×/3× (command rows + equivalent-command mentions + local-run bullets) — no stale counterpart token anywhere.

### V10 — no `TBD` remains in `AGENTS.md`

```
$ grep -n "TBD" AGENTS.md
exit=1
```

## Acceptance audit (T2b: AC-2, AC-4, AC-5, AC-6, AC-8, AC-9, AC-34 — tooling-consistency portion)

- **AC-2** → met. `stack.md` § Containerized delivery path retains backend/frontend containers, single `podman compose up`-style local run (line 37), provider-neutral images with the pre-existing no-commitment wording (line 39 unchanged), future services (line 40 unchanged), pointer to `containerization.md` (line 43 unchanged), and states the assets exist in the repository (`compose.yaml`, `compose.smoke.yaml`, Dockerfiles) (line 41 unchanged). Evidence: V1 lines 37/38, V5 stack.md hunk.
- **AC-4** → met. `stack.md` command table still defines the layout/command list and matches `AGENTS.md` § Commands token-for-token on all eight tokens including `podman compose up` (row at line 33). Evidence: V9 (1× each), V1 lines 31–33, V10.
- **AC-5** → met. `containerization.md` § Container conventions settled record intact (ports/env names, health signal + numbers, image naming, file locations, dev-mode, local-run command + README home) with the local-run command now `podman compose up` and the smoke command `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` documented in `README.md`/mirrored in `AGENTS.md` (line 40). Evidence: V1 containerization.md lines 35–40 region unchanged except line 38/39/40 tokens; V5 hunk.
- **AC-6** → met. `containerization.md` preamble untouched (line 3) and still agrees with `stack.md` (decided 2026-10-17; assets exist); binding role and 5 H2 sections retained (no new/dropped headings — V5 hunk shows only body-line substitutions). Evidence: V5, V11.
- **AC-8** → met. `AGENTS.md` § Stack containerized-delivery bullet updated: assets in repo, `podman compose up`, run instructions in `README.md`, provider-neutral wording ("AWS ECS Fargate is an example only — no provider is chosen") retained verbatim. Evidence: V1 AGENTS.md:8, V5 hunk.
- **AC-9** → met. `AGENTS.md` § Commands carries the full command set with `npm run dev` = `podman compose up` (line 20) and `npm run smoke` (line 21); the local-environment bullet is present-tense pointing at `README.md` (line 22); no `TBD` remains (V10). Evidence: V1, V9, V10.
- **AC-34 (tooling-consistency portion)** → met. `podman compose …` command tokens are identical across `AGENTS.md` and the two decided docs (V1/V9); all cross-references stay valid (`stack.md`, `containerization.md`, `README.md`, Dockerfiles, compose files named where referenced — V4/V11); no other file in the repo was touched (V7), so `docs/product/**` and other features' artifacts are untouched.

## Deviations from spec

None. Contract 15's pins were applied byte-exact, including the deliberate phrase-structure change in the 15.A/15.B/15.C tooling and prerequisite bullets (flagged as intended by `plan.md` and `reviews/spec-r3.md` F3/INFO). The brief's shorthand ("`Docker images + Docker Compose` → `Podman and Podman Compose (…)`") matched contract 15.A; artifacts governed with no conflict.
