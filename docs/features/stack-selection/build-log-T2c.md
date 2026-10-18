# Build log — T2c — `.opencode` tooling-token alignment (Docker → Podman, reviewer oversight)

Task: T2c (`docs/features/stack-selection/tasks.md` § T2c; plan.md contract 16) — 2026-10-18
Branch: `feat/stack-selection` · HEAD at build start: `3f8483d`
Files changed: `.opencode/agents/builder.md`, `.opencode/skills/web-implementation/SKILL.md`, `.opencode/skills/web-implementation/references/engineering-principles.md`, `.opencode/skills/code-review/checklists/quality.md`, `docs/features/stack-selection/build-log-T2c.md`

## What changed & why (≤5 lines)

- Applied `plan.md` contract 16 exactly: four pinned stale Docker tooling references replaced with the pinned Podman tokens.
- `builder.md:112` prose only — `permissions:` block (frontmatter lines 1–101) byte-frozen per AC-33.
- No other line, filename (`Dockerfile`/`.dockerignore`) mention, or rule text changed.

## Decisions

- Third sequential edit of `builder.md` (T0 permissions → T2 prose → T2c token); no other task in flight. Baseline = committed post-T2 (HEAD `3f8483d`).
- Used the `edit` tool for the byte-exact replacements (each old string a single, unique occurrence verified pre-edit).
- Build-start baselines captured to `/tmp/opencode/t2c-baseline/` (outside the repo) + `git hash-object`; no repo working-tree artifacts added.

## Baseline (build-start capture)

```
git rev-parse HEAD                       → 3f8483d5d534b94ebeecf8514a0f427cb8cb1901
git branch --show-current                → feat/stack-selection
git hash-object <four files>:
  .opencode/agents/builder.md                                              → fb9b4b15456c4221cf393b7abd5609fc4f5a0716
  .opencode/skills/web-implementation/SKILL.md                             → fefd33667af4f5cb7e336d28381bd1c79b4d3503
  .opencode/skills/web-implementation/references/engineering-principles.md → d223add2129cc4b8872a3261b27243d867d45064
  .opencode/skills/code-review/checklists/quality.md                       → 63c9dd1b514e1229b4eaa6b02aef9b732f004e1b
permissions/frontmatter block (lines 1–101 of builder.md), sha256:
  891015a593990d7629df4249f9e506578bdb0c608cd5b7cf28b6378763698999
```

## Pre-edit: old-string occurrence check (each must be a single occurrence at its pinned line)

```
grep -n "Docker images + Docker Compose" .opencode/agents/builder.md
  → 112:  (builder.md, page). ✓ pinned line 112
grep -n "docker compose up" .opencode/skills/web-implementation/SKILL.md
  → 27:   ✓ pinned line 27
grep -n "Docker + Compose" .opencode/skills/web-implementation/references/engineering-principles.md
  → 57:   ✓ pinned line 57
grep -n "docker compose up" .opencode/skills/code-review/checklists/quality.md
  → 41:   ✓ pinned line 41
```

No old-string occurrence outside the pinned lines (no drift).

## Evidence

### 1) Positive grep — `podman compose` present in the four files
`grep -n "podman compose" .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md .opencode/skills/web-implementation/references/engineering-principles.md .opencode/skills/code-review/checklists/quality.md` → exit 0

```
.opencode/agents/builder.md:112:- Containerized delivery path (decided): Podman images + Podman Compose (`podman compose`), single-command local run, provider-neutral deployment — see `docs/architecture/containerization.md`. When a task authors container assets, follow that contract (environment-based config, no secrets in images, health signal, backend exposes the WebSocket endpoint); the application stack is decided (2026-10-17) — follow the pinned container conventions (`docs/architecture/containerization.md`); container assets live in the repository (`compose.yaml`, `src/*/Dockerfile`).
.opencode/skills/web-implementation/SKILL.md:27:- Containerized delivery (`docs/architecture/containerization.md`): one image per deployable; `podman compose up`-style single-command local dev; runtime config via environment variables (never secrets in images); a health signal per service; backend WebSocket endpoint exposed; provider-neutral images. Container assets and conventions are pinned in the repository (`compose.yaml`, `src/*/Dockerfile`; `docs/architecture/containerization.md`). Depth in `references/engineering-principles.md` § Containerization principles.
.opencode/skills/web-implementation/references/engineering-principles.md:57:- **Single-command local run.** The full environment starts from a clean checkout with one `podman compose up`-style command; no host-specific setup beyond Podman with a working compose provider.
.opencode/skills/code-review/checklists/quality.md:41:- [ ] Single-command local run preserved (`podman compose up`-style starts the full environment)
```

### 2) Negative grep — no live stale token remains anywhere in `.opencode/`
`grep -rn "docker compose up\|Docker images + Docker Compose\|Docker + Compose" .opencode/` → exit 1 (no hits) ✅

(Prior to the edit this matched exactly the four pinned lines; after the edit it matches nothing in `.opencode/`.)

### 3) Permission freeze — `git diff HEAD -- .opencode/agents/builder.md` (prose only)

```
diff --git a/.opencode/agents/builder.md b/.opencode/agents/builder.md
index fb9b4b1..f36b3a9 100644
--- a/.opencode/agents/builder.md
+++ b/.opencode/agents/builder.md
@@ -109,7 +109,7 @@ You are the CubeClicker builder — a subagent and web technologies specialist.
 - Load the `web-implementation` skill before acting; its rules and Definition of Done are binding.
 - Real-time: shared/cross-client state is server-authoritative — never trust client-reported values; own the connection lifecycle (connect/reconnect/teardown, no duplicate handlers); follow the `web-implementation` skill's real-time rules.
 - The stack is whatever `AGENTS.md` and `docs/architecture/stack.md` say. If the stack is NOT DECIDED, report `blocked` — never introduce tooling, frameworks, or dependencies on your own.
-- Containerized delivery path (decided): Docker images + Docker Compose, single-command local run, provider-neutral deployment — see `docs/architecture/containerization.md`. When a task authors container assets, follow that contract (environment-based config, no secrets in images, health signal, backend exposes the WebSocket endpoint); the application stack is decided (2026-10-17) — follow the pinned container conventions (`docs/architecture/containerization.md`); container assets live in the repository (`compose.yaml`, `src/*/Dockerfile`).
+- Containerized delivery path (decided): Podman images + Podman Compose (`podman compose`), single-command local run, provider-neutral deployment — see `docs/architecture/containerization.md`. When a task authors container assets, follow that contract (environment-based config, no secrets in images, health signal, backend exposes the WebSocket endpoint); the application stack is decided (2026-10-17) — follow the pinned container conventions (`docs/architecture/containerization.md`); container assets live in the repository (`compose.yaml`, `src/*/Dockerfile`).
 - Read before you write: spec, plan, your task section, and the files you will touch.
 - Stay inside your task's `files_owned`. Out-of-scope edits are a reportable failure.
 - Verify: run the task's `verify` commands and record raw evidence in `build-log-<taskid>.md`. Never claim success without command output.
```

Single changed line, at line 112; no frontmatter/permission line in the hunk.

Permission-block byte check (frontmatter lines 1–101) vs build-start baseline:
```
sed -n '1,101p' .opencode/agents/builder.md | sha256sum
  → 891015a593990d7629df4249f9e506578bdb0c608cd5b7cf28b6378763698999
sed -n '1,101p' /tmp/opencode/t2c-baseline/builder.md | sha256sum
  → 891015a593990d7629df4249f9e506578bdb0c608cd5b7cf28b6378763698999   IDENTICAL ✅
diff <(sed -n '1,101p' baseline) <(sed -n '1,101p' current) → (empty) IDENTICAL
```
Full-file diff = exactly 1 changed line (`diff | grep -c '^[<>]'` → `2`, i.e. one `<` + one `>`).

### 4) `git diff HEAD -- <files_owned>` — exactly the four contract-16 replacements

`git diff HEAD --stat -- <four files>`:
```
 .opencode/agents/builder.md                                             | 2 +-
 .opencode/skills/code-review/checklists/quality.md                      | 2 +-
 .opencode/skills/web-implementation/SKILL.md                            | 2 +-
 .opencode/skills/web-implementation/references/engineering-principles.md | 2 +-
 4 files changed, 4 insertions(+), 4 deletions(-)
```

Hunks pinned to contract 16:
| File | Line | Old → New |
| --- | --- | --- |
| `.opencode/agents/builder.md` | 112 | `Docker images + Docker Compose` → ``Podman images + Podman Compose (`podman compose`)`` |
| `.opencode/skills/web-implementation/SKILL.md` | 27 | `` `docker compose up`-style single-command local dev `` → `` `podman compose up`-style single-command local dev `` |
| `.opencode/skills/web-implementation/references/engineering-principles.md` | 57 | ``one `docker compose up`-style command; no host-specific setup beyond Docker + Compose.`` → ``one `podman compose up`-style command; no host-specific setup beyond Podman with a working compose provider.`` |
| `.opencode/skills/code-review/checklists/quality.md` | 41 | ``(`docker compose up`-style starts the full environment)`` → ``(`podman compose up`-style starts the full environment)`` |

### 5) Filename mentions preserved
`grep -n "Dockerfile\|\.dockerignore" <four files>` → still present at `builder.md:42` (`.dockerignore` permission resource), `builder.md:112` (`src/*/Dockerfile`), `SKILL.md:27` (`src/*/Dockerfile`) — untouched.

### 6) `git status --short`
```
 M .opencode/agents/builder.md
 M .opencode/skills/code-review/checklists/quality.md
 M .opencode/skills/web-implementation/SKILL.md
 M .opencode/skills/web-implementation/references/engineering-principles.md
 M docs/features/README.md                      ← pre-existing, not owned, left unstaged
 M docs/features/project-glossary/status.md     ← pre-existing, not owned, left unstaged
?? docs/features/stack-selection/...            ← feature artifacts, not staged
```
No `.env*`, no stray files.

## Acceptance audit

- **chore (framework wording; no content AC)** → met: the four pinned replacements applied byte-exact (evidence §1, §4).
- **AC-33 freeze re-verified** → met: `permissions:` block byte-identical (sha256 match, evidence §3); only line 112 prose changed; no allow/deny entry altered.

## Deviations from spec

None. All four pins byte-matched at their pinned lines before the edit (spec-r3 corroborated), each a single occurrence; no pin mismatch, no occurrence outside a pinned line → no `blocked` condition triggered.

## Commit

`docs: align remaining framework Docker references with Podman (T2c)` — staged via explicit `git add` pathspecs (four files + this build log) only; never `git add .`/`-A`; never pushed.

## Post-commit verification

`git diff --cached --name-only` at stage time (exactly the five T2c paths):
```
.opencode/agents/builder.md
.opencode/skills/code-review/checklists/quality.md
.opencode/skills/web-implementation/SKILL.md
.opencode/skills/web-implementation/references/engineering-principles.md
docs/features/stack-selection/build-log-T2c.md
```

`git show --stat HEAD`:
```
 .opencode/agents/builder.md                        |   2 +-
 .opencode/skills/code-review/checklists/quality.md |   2 +-
 .opencode/skills/web-implementation/SKILL.md       |   2 +-
 .../references/engineering-principles.md           |   2 +-
 docs/features/stack-selection/build-log-T2c.md     | 140 +++++++++++++++++++++
 5 files changed, 144 insertions(+), 4 deletions(-)
```

`git show HEAD -- .opencode/agents/builder.md` → single hunk, line 112 prose only (frontmatter untouched).
AC-33 re-check on the committed blob: `git show HEAD:.opencode/agents/builder.md | sed -n '1,101p' | sha256sum` → `891015a593990d7629df4249f9e506578bdb0c608cd5b7cf28b6378763698999` (matches baseline) ✅
Negative grep at HEAD: `grep -rn "docker compose up\|Docker images + Docker Compose\|Docker + Compose" .opencode/` → exit 1 (no hits) ✅
`docs/features/README.md` and `docs/features/project-glossary/status.md` (pre-existing modifications) and the other `docs/features/stack-selection/**` artifacts were left unstaged/untracked.
