# Build log — T2 — Framework alignment: stale guard clauses + playbook §4

Task: T2 (2026-10-17), feature `stack-selection`, branch `feat/stack-selection`
Files changed: `.opencode/skills/orchestration-playbook/SKILL.md`, `.opencode/agents/planner.md`, `.opencode/agents/builder.md`, `.opencode/skills/web-implementation/SKILL.md`, `.opencode/skills/spec-authoring/references/spec-checklist.md`, `.opencode/skills/spec-review/SKILL.md`, `docs/features/stack-selection/build-log-T2.md`

What changed & why (≤5 lines):
- Applied `plan.md` contract 13 exactly: six one-line replacements, one per file, each replacing stale "stack not decided" guidance with the decided stack / settled container conventions.
- `builder.md` is the second of its two sequential edits (T0 = permissions at `157002c`, T2 = prose); baseline captured post-T0.
- No other rule text changed in any file; no permission content touched anywhere (AC-33: T0's six entries are the only permission change, already committed).
- No new files other than this build log; no dependencies, no Docker/Node needed (grep/diff/git tooling only).

Decisions:
- Pinned replacement strings are quoted in the plan's table without sentence-final punctuation (e.g. `…until it is decided`). Where the original file line ended a sentence with `.`, the sentence-final period was retained; nothing else beyond the pinned span was altered. Pinned token sets are matched verbatim.
- Baseline capture: the six files were clean against `HEAD` (`77be79c`) at build start (initial `git status --short` listed only `docs/features/**` paths), so the recorded sha256 values are also the `HEAD` blob states.
- Verification used token-bounded permission greps after the first grep produced a false positive: the substring `action:` occurs inside the untouched word `abstraction:` in a `web-implementation/SKILL.md` context line. Recorded both, with the corrected check.

## Baselines (build start, pre-edit)

| File | Line | sha256 (build start = HEAD `77be79c`) | Exact old line |
| --- | --- | --- | --- |
| `.opencode/skills/orchestration-playbook/SKILL.md` | 79 | `00665560e4a815e62a1bd98d5148c4268b663fe06f6e5c75affef3bdaa5318be` | `3. Several ready and ALL are `[P]` with pairwise disjoint `files_owned` and no shared-file contact (`package.json`, lockfiles, entrypoints) → launch them as **background** subagents (max 3) in one batch.` |
| `.opencode/agents/planner.md` | 69 | `ee3d2beeeb8828cdc24def1f1da27173fa7324e0ed7161f511344c5deb614439` | `- Containerization: specs for features that add services, images, ports, configuration, or deployables must cover their containerization impact per `docs/architecture/containerization.md` (compose service, image, environment-based config, health signal, WebSocket endpoint exposure) — or state it explicitly out of scope — and stack-dependent container details stay open questions until the application stack is decided.` |
| `.opencode/agents/builder.md` | 112 | `d6c55de5d77891346b620d00945aebf1049763c704b4d31fd4970a1952535b18` | `- Containerized delivery path (decided): Docker images + Docker Compose, single-command local run, provider-neutral deployment — see `docs/architecture/containerization.md`. When a task authors container assets, follow that contract (environment-based config, no secrets in images, health signal, backend exposes the WebSocket endpoint); container assets still require the application stack — report `blocked` instead of guessing until it is decided.` |
| `.opencode/skills/web-implementation/SKILL.md` | 27 | `7a5b063a854bdf47e00d8e46d0e3d5b34603dc01ef15647d1791d0e73b0635cf` | `- Containerized delivery (`docs/architecture/containerization.md`): one image per deployable; `docker compose up`-style single-command local dev; runtime config via environment variables (never secrets in images); a health signal per service; backend WebSocket endpoint exposed; provider-neutral images. No container assets before the application stack is decided. Depth in `references/engineering-principles.md` § Containerization principles.` |
| `.opencode/skills/spec-authoring/references/spec-checklist.md` | 41 | `3b0029ad4f4f5aa18953999b67442e834e4d62d5866278f6f4bbae13870cebd3` | `- [ ] Stack-dependent container details flagged as open questions; no container assets specified for an undecided stack` |
| `.opencode/skills/spec-review/SKILL.md` | 26 | `76e09c792f1afb13487f526a9a46529b553d04d79ee3bd5f6644f22ea4c9daa4` | `- **Containers (when applicable)** — features adding services, images, ports, configuration, or deployables address the containerization contract (`docs/architecture/containerization.md`: local-run contract, image/service rules, deploy neutrality, WebSocket endpoint exposure) or state it out of scope; stack-dependent container details are open questions.` |

## Post-edit sha256

```
b80d4f0851caa43de90a3f021fce8fd1a7aa0b1b5a2426d46a20827d21d6553e  .opencode/skills/orchestration-playbook/SKILL.md
e7d498e9b12bf6281cb7f167adcd6b7cc339e0df100b5fbeea1a59ab28847016  .opencode/agents/planner.md
c1f9b4a34f830b6a62dc586a6e8d00be2aaa4f8a959ffca4a420ce3f66033ecf  .opencode/agents/builder.md
be667a22aec022bd0cefdd091492a5714124fafe37a1c26c3581f13ee778f2c8  .opencode/skills/web-implementation/SKILL.md
c15079a53acdcd36b8103fae40f27e877500a709c398cd919a21de462dd98e62  .opencode/skills/spec-authoring/references/spec-checklist.md
c5e9c34c902cc8d30b98864a6cdb24a779d2cad933e23de96f887199aaacd522  .opencode/skills/spec-review/SKILL.md
```

## Evidence (raw output)

### E1 — `grep -n "container definitions such as the compose file" .opencode/skills/orchestration-playbook/SKILL.md`

```
79:3. Several ready and ALL are `[P]` with pairwise disjoint `files_owned` and no shared-file contact (`package.json`, lockfiles, entrypoints, container definitions such as the compose file and Dockerfiles) → launch them as **background** subagents (max 3) in one batch.
exit=0
```

### E1b — mirror source (task-decomposition rule 5) and AC-30 wording character match

```
$ grep -rn "container definitions" .opencode/skills/task-decomposition/
.opencode/skills/task-decomposition/SKILL.md:16:5. `[P]` (parallel-safe) only when: dependencies are already-earlier tasks, `files_owned` is disjoint, and the task touches no shared file (`package.json`, lockfiles, entrypoints, global styles, routers, container definitions such as the compose file and Dockerfiles). When in doubt → `[seq]`.
```

The added fragment is verbatim `, container definitions such as the compose file and Dockerfiles` — identical wording to rule 5's tail.

### E2 — stale-clause scan: `grep -rn "until it is decided\|until the application stack is decided\|undecided stack\|No container assets before the application stack is decided" .opencode/`

```
exit=1   (no hits)
```

Extended scan (also covers the planner phrase removed with its clause):

```
$ grep -rn "until the application stack is decided\|until it is decided\|undecided stack\|No container assets before the application stack is decided\|stay open questions" .opencode/
grep exit=1 (1 = no hits)
```

### E3 — `git diff HEAD -- <files_owned>`

```
diff --git a/.opencode/agents/builder.md b/.opencode/agents/builder.md
index 5567fcd..fb9b4b1 100644
--- a/.opencode/agents/builder.md
+++ b/.opencode/agents/builder.md
@@ -109,7 +109,7 @@ You are the CubeClicker builder — a subagent and web technologies specialist.
 - Load the `web-implementation` skill before acting; its rules and Definition of Done are binding.
 - Real-time: shared/cross-client state is server-authoritative — never trust client-reported values; own the connection lifecycle (connect/reconnect/teardown, no duplicate handlers); follow the `web-implementation` skill's real-time rules.
 - The stack is whatever `AGENTS.md` and `docs/architecture/stack.md` say. If the stack is NOT DECIDED, report `blocked` — never introduce tooling, frameworks, or dependencies on your own.
-- Containerized delivery path (decided): Docker images + Docker Compose, single-command local run, provider-neutral deployment — see `docs/architecture/containerization.md`. When a task authors container assets, follow that contract (environment-based config, no secrets in images, health signal, backend exposes the WebSocket endpoint); container assets still require the application stack — report `blocked` instead of guessing until it is decided.
+- Containerized delivery path (decided): Docker images + Docker Compose, single-command local run, provider-neutral deployment — see `docs/architecture/containerization.md`. When a task authors container assets, follow that contract (environment-based config, no secrets in images, health signal, backend exposes the WebSocket endpoint); the application stack is decided (2026-10-17) — follow the pinned container conventions (`docs/architecture/containerization.md`); container assets live in the repository (`compose.yaml`, `src/*/Dockerfile`).
 - Read before you write: spec, plan, your task section, and the files you will touch.
 - Stay inside your task's `files_owned`. Out-of-scope edits are a reportable failure.
 - Verify: run the task's `verify` commands and record raw evidence in `build-log-<taskid>.md`. Never claim success without command output.
diff --git a/.opencode/agents/planner.md b/.opencode/agents/planner.md
index d54a717..2a9de0d 100644
--- a/.opencode/agents/planner.md
+++ b/.opencode/agents/planner.md
@@ -66,7 +66,7 @@ You are the CubeClicker feature planner — a subagent. You NEVER address the us
 - `tasks.md`: exclusive `files_owned` per task, acyclic `depends_on`, `[P]` only with disjoint files and no shared-file contact.
 - Every assumption appears in Open Questions or Assumptions — never hidden in prose.
 - Real-time: specs for features touching shared or cross-client state address connection lifecycle, reconnection, multi-client behavior, and server authority for shared values — or state them as explicitly out of scope — and flag identity vs. "no accounts" conflicts as open questions. Assume no stack beyond the WebSocket protocol requirement.
-- Containerization: specs for features that add services, images, ports, configuration, or deployables must cover their containerization impact per `docs/architecture/containerization.md` (compose service, image, environment-based config, health signal, WebSocket endpoint exposure) — or state it explicitly out of scope — and stack-dependent container details stay open questions until the application stack is decided.
+- Containerization: specs for features that add services, images, ports, configuration, or deployables must cover their containerization impact per `docs/architecture/containerization.md` (compose service, image, environment-based config, health signal, WebSocket endpoint exposure) — or state it explicitly out of scope — and container details follow the settled conventions (`docs/architecture/stack.md`, `docs/architecture/containerization.md`); they are reopened only by a user-owned stack amendment.
 
 ## Revision mode
 
diff --git a/.opencode/skills/orchestration-playbook/SKILL.md b/.opencode/skills/orchestration-playbook/SKILL.md
index e694d95..c258f42 100644
--- a/.opencode/skills/orchestration-playbook/SKILL.md
+++ b/.opencode/skills/orchestration-playbook/SKILL.md
@@ -76,7 +76,7 @@ REQUIRED OUTPUT: Subagent Report. Do not address the user.
 
 1. Read `tasks.md`. A task is **ready** when all `depends_on` are `[x]`.
 2. Exactly one ready → run Builder in the foreground with a brief for that task.
-3. Several ready and ALL are `[P]` with pairwise disjoint `files_owned` and no shared-file contact (`package.json`, lockfiles, entrypoints) → launch them as **background** subagents (max 3) in one batch.
+3. Several ready and ALL are `[P]` with pairwise disjoint `files_owned` and no shared-file contact (`package.json`, lockfiles, entrypoints, container definitions such as the compose file and Dockerfiles) → launch them as **background** subagents (max 3) in one batch.
 4. Otherwise pick the first ready `[seq]` task and run it in the foreground.
 5. After each Builder report: update `tasks.md` and the loop log, then re-evaluate.
 
diff --git a/.opencode/skills/spec-authoring/references/spec-checklist.md b/.opencode/skills/spec-authoring/references/spec-checklist.md
index 54217ad..7f99f55 100644
--- a/.opencode/skills/spec-authoring/references/spec-checklist.md
+++ b/.opencode/skills/spec-authoring/references/spec-checklist.md
@@ -38,4 +38,4 @@
 
 ## Containers (when the feature adds services, images, ports, configuration, or deployables)
 - [ ] Containerization impact addressed per `docs/architecture/containerization.md` (local-run contract, image/service rules, deploy neutrality, WebSocket endpoint exposure) — or explicitly out of scope
-- [ ] Stack-dependent container details flagged as open questions; no container assets specified for an undecided stack
+- [ ] Container details follow the settled conventions (`docs/architecture/containerization.md`); deviations are flagged as open questions for a user-owned amendment
diff --git a/.opencode/skills/spec-review/SKILL.md b/.opencode/skills/spec-review/SKILL.md
index 5cfe1a4..de42f39 100644
--- a/.opencode/skills/spec-review/SKILL.md
+++ b/.opencode/skills/spec-review/SKILL.md
@@ -23,7 +23,7 @@ Task Brief plus `spec.md`, `plan.md`, `tasks.md`, `docs/product/vision.md`, `AGE
 - **Consistency** — aligns with the vision; reuses existing architecture; contradicts nothing in `AGENTS.md`.
 - **Risks** — ambiguities that will surface mid-build as blockers.
 - **Real-time (when applicable)** — features touching shared/cross-client state define connection lifecycle, reconnection, multi-client behavior, and server authority for shared values; identity/accounts conflicts are flagged.
-- **Containers (when applicable)** — features adding services, images, ports, configuration, or deployables address the containerization contract (`docs/architecture/containerization.md`: local-run contract, image/service rules, deploy neutrality, WebSocket endpoint exposure) or state it out of scope; stack-dependent container details are open questions.
+- **Containers (when applicable)** — features adding services, images, ports, configuration, or deployables address the containerization contract (`docs/architecture/containerization.md`: local-run contract, image/service rules, deploy neutrality, WebSocket endpoint exposure) or state it out of scope; container details must match the settled conventions (`docs/architecture/containerization.md`) or be flagged as open questions.
 
 ## Severity & verdict
 
diff --git a/.opencode/skills/web-implementation/SKILL.md b/.opencode/skills/web-implementation/SKILL.md
index 4fe1c6c..fefd336 100644
--- a/.opencode/skills/web-implementation/SKILL.md
+++ b/.opencode/skills/web-implementation/SKILL.md
@@ -24,7 +24,7 @@ You implement exactly one task (or a small parallel-safe batch) per invocation,
 - Rendering/UI subscribes to state; it does not own it. Single source of truth for game state.
 - One place owns `requestAnimationFrame`/interval usage; clean up on teardown. No leaks.
 - Real-time (WebSocket): one owner for the connection lifecycle (connect → open → close → reconnect); reconnection is bounded and resyncs state; shared/cross-client state is server-authoritative (the client never trusts reported values); teardown closes connections and removes handlers. Depth in `references/engineering-principles.md` § Real-time principles.
-- Containerized delivery (`docs/architecture/containerization.md`): one image per deployable; `docker compose up`-style single-command local dev; runtime config via environment variables (never secrets in images); a health signal per service; backend WebSocket endpoint exposed; provider-neutral images. No container assets before the application stack is decided. Depth in `references/engineering-principles.md` § Containerization principles.
+- Containerized delivery (`docs/architecture/containerization.md`): one image per deployable; `docker compose up`-style single-command local dev; runtime config via environment variables (never secrets in images); a health signal per service; backend WebSocket endpoint exposed; provider-neutral images. Container assets and conventions are pinned in the repository (`compose.yaml`, `src/*/Dockerfile`; `docs/architecture/containerization.md`). Depth in `references/engineering-principles.md` § Containerization principles.
 - Persistence: versioned save schema plus a migration function; validate on load; a corrupt save must never crash the game.
 - DRY without premature abstraction: extract on the third repetition, not the first. KISS: prefer the boring solution. YAGNI: build what the task asks, nothing speculative.
 - `textContent`, never `innerHTML`, for user-controlled strings. No `eval`, no remote code.
```

Every hunk is a single `-`/`+` pair; the only context lines shown are the surrounding rules, none of which are modified.

### E3b — exactly one line per file: `git diff HEAD --numstat -- <files_owned>`

```
1	1	.opencode/agents/builder.md
1	1	.opencode/agents/planner.md
1	1	.opencode/skills/orchestration-playbook/SKILL.md
1	1	.opencode/skills/spec-authoring/references/spec-checklist.md
1	1	.opencode/skills/spec-review/SKILL.md
1	1	.opencode/skills/web-implementation/SKILL.md
```

`git diff --stat` totals: `6 files changed, 6 insertions(+), 6 deletions(-)`.

### E3c — file line counts unchanged (HEAD vs worktree)

```
.opencode/skills/orchestration-playbook/SKILL.md HEAD=126 WT=126
.opencode/agents/planner.md HEAD=77 WT=77
.opencode/agents/builder.md HEAD=121 WT=121
.opencode/skills/web-implementation/SKILL.md HEAD=59 WT=59
.opencode/skills/spec-authoring/references/spec-checklist.md HEAD=41 WT=41
.opencode/skills/spec-review/SKILL.md HEAD=37 WT=37
```

(In-place line replacement only — no added/removed lines anywhere in the six files.)

### E4 — AC-33 check: no permission content in the six diffs

```
$ git diff HEAD -- <six files> | grep -inE "(^|[^a-z-])permission|(^|[^a-z-])resource: |(^|[^a-z-])effect:|(^|[^a-z-])action:|frontmatter|(^|[^a-z-])allow($|[^a-z-])|(^|[^a-z-])deny($|[^a-z-])"
grep exit=1 (1 = no permission content in the six diffs)
```

```
$ diff <(git show HEAD:.opencode/agents/builder.md | head -101) <(head -101 .opencode/agents/builder.md)
IDENTICAL (frontmatter + permission entries unchanged)
```

`builder.md`'s diff hunk header is `@@ -109,7 +109,7 @@` — inside § Rules, far below the frontmatter permission block (lines 1–101). T0's permission commit is untouched:

```
$ git show 157002c --stat | tail -3
 .opencode/agents/builder.md                   |  18 +
 docs/features/stack-selection/build-log-T0.md | 506 ++++++++++++++++++++++++++
 2 files changed, 524 insertions(+)
```

False-positive note: a first, non-token-bounded grep matched `action:` inside the untouched word `abstraction:` (a context line of the `web-implementation/SKILL.md` hunk). The token-bounded re-run (above) returns no hits.

### E5 — no new/deleted files in the change set

```
$ git status --short
 M .opencode/agents/builder.md
 M .opencode/agents/planner.md
 M .opencode/skills/orchestration-playbook/SKILL.md
 M .opencode/skills/spec-authoring/references/spec-checklist.md
 M .opencode/skills/spec-review/SKILL.md
 M .opencode/skills/web-implementation/SKILL.md
 M docs/features/README.md
 M docs/features/project-glossary/status.md
?? docs/features/stack-selection/build-log-T2.md
?? docs/features/stack-selection/build-log-T3.md
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md
```

Only the six `files_owned` framework files (all `M`, no `A`/`D`) plus this build log belong to T2. `docs/features/README.md` and `docs/features/project-glossary/status.md` were already modified before T2 started (orchestrator-owned, unrelated) and are **not** staged by this task; `build-log-T3.md` and the other untracked feature artifacts belong to the concurrent `[P]` task T3 (disjoint paths) and are likewise not staged — T2 commits with explicit pathspecs only.

## Acceptance audit

- **AC-30 — met.** `grep -n "container definitions such as the compose file" .opencode/skills/orchestration-playbook/SKILL.md` → line 79 with the fragment `, container definitions such as the compose file and Dockerfiles`, byte-identical in wording to `.opencode/skills/task-decomposition/SKILL.md:16` rule 5 (F2 fold). "Nothing else in the file changes" — `--numstat` is `1 1` for the file and its line count is unchanged (126/126); the single hunk touches only that line (E3).
- **AC-31 — met.** Exactly five framework files, one line each: `planner.md:69`, `builder.md:112`, `web-implementation/SKILL.md:27`, `spec-checklist.md:41`, `spec-review/SKILL.md:26` — each now references the decided stack (2026-10-17) / settled conventions (`docs/architecture/stack.md`, `docs/architecture/containerization.md`) instead of "until decided"/"undecided stack"; `grep -rn` for all four stale patterns over `.opencode/` returns no hits (E2). "No other rule text changes" — five files × `1 1` numstat, unchanged line counts, no permission content (E4).
- **AC-33 — not applicable to T2 / no regression.** No permission content appears in the six diffs; `builder.md`'s permission block is byte-identical to `HEAD`; the only permission change in the feature remains T0 (`157002c`).

## Deviations from spec

None. Contract 13 applied exactly as pinned. Minor, recorded detail: the plan quotes the replacement spans without sentence-final punctuation; where the original line terminated a sentence with `.`, the period was retained (planner, builder, spec-review). No pinned token was altered or omitted, and no unpinned text was touched.
