# Build log — T2 — Planning guidance: planner, spec checklist, task decomposition

Task: T2 (2026-10-17) — `[P]`, depends_on T1. Branch `feat/containerized-workflow` (stay; no switch).
Base at build start: `ffadd1d` (T1).

Files changed:
- `.opencode/agents/planner.md` (edit — one Rules bullet)
- `.opencode/skills/spec-authoring/references/spec-checklist.md` (edit — one conditional section)
- `.opencode/skills/task-decomposition/SKILL.md` (edit — rule 5 example-list parenthetical only)
- `docs/features/containerized-workflow/build-log-T2.md` (this file)

What changed & why (≤5 lines):
1. `planner.md` § Rules gains one container bullet (plan contract 4): features adding services/images/ports/config/deployables
   must cover containerization impact per `docs/architecture/containerization.md` — or state it out of scope — and
   stack-dependent container details stay open questions (AC-14).
2. `spec-checklist.md` gains the conditional `## Containers (…)` section after the Real-time section (plan contract 5; AC-15).
3. `task-decomposition/SKILL.md` rule 5's shared-file parenthetical gains ", container definitions such as the compose file and
   Dockerfiles" before the closing paren; nothing else in the rule/skill changes (plan contract 6; AC-24).
4. No permission block / allow / deny entry touched (AC-25); no application technology names (AC-28); no new files beyond
   `files_owned`.

Decisions:
- Baseline rule D-11: captured build-start content via `git show HEAD:<path>` (HEAD `ffadd1d`) **before** the first edit;
  working tree was byte-identical to HEAD at capture (sha256 matches, § Baselines), so `git show HEAD:<path>` == build-start content.
- Contract 4 bullet placed as the last `## Rules` bullet (after the Real-time bullet) — additive, no other Rules text altered.
- Contract 5 section appended after the Real-time section, matching the pinned block byte-for-byte.
- Contract 6 is the **only** in-place modification in this task (plan § Amendment rule): exactly the parenthetical changes;
  `package.json`, the rest of rule 5, the other rules, and the template are byte-identical to baseline.
- Stayed on `feat/containerized-workflow`; no branch switch, no rebase/reset/history rewrite, no push.

Commit staging: explicit `git add` of only the four `files_owned` paths; `git commit -m '<msg>' -- <four paths>`
(pathspec form); no `git add .` / `git add -A`; no bare `git commit`. Pre-existing dirty tree entries
(`docs/features/README.md`, `docs/features/online-realtime-workflow/status.md`, untracked
`docs/features/containerized-workflow/**` process files) left exactly as found / unstaged.

---

## Build-start baselines (governing, D-11)

Build-start ref: `ffadd1d` (branch `feat/containerized-workflow`). Full `git show HEAD:<path>` captured verbatim before
the first edit; sha256 of the captured baseline recorded below (working tree matched HEAD at capture time).

| File (baseline) | sha256 (baseline) |
| --- | --- |
| `.opencode/agents/planner.md` | `8076e84fcce4986991f3495343723f1815943ab8c96e9edbd05bd9a46a3319f0` |
| `.opencode/skills/spec-authoring/references/spec-checklist.md` | `3ba69fba663c8e66a1980ad2e19cea0430b45b2ee7a379a665dfb5f7977bf20d` |
| `.opencode/skills/task-decomposition/SKILL.md` | `f10f18b33bca96ff800b4b701b588b6cf0f4ae7c88fb040c5549f39a6097fe72` |

### `git show HEAD:.opencode/agents/planner.md` (baseline, verbatim)
```markdown
---
description: Feature spec author. Turns a raw CubeClicker feature request into spec.md, plan.md, and a dependency-ordered tasks.md, and revises them in response to spec reviews.
mode: subagent
model: opencode/deepseek-v4.1-flash-free#max
color: "#3b82f6"
steps: 50
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: edit
    resource: "docs/features/**"
    effect: allow
  - action: edit
    resource: "docs/features/**/status.md"
    effect: deny
  - action: edit
    resource: "docs/features/**/reviews/**"
    effect: deny
  - action: edit
    resource: "docs/features/**/build-log*"
    effect: deny
  - action: shell
    resource: "*"
    effect: deny
  - action: shell
    resource: "git status *"
    effect: allow
  - action: shell
    resource: "git log *"
    effect: allow
  - action: shell
    resource: "git diff *"
    effect: allow
  - action: shell
    resource: "git show *"
    effect: allow
  - action: subagent
    resource: "*"
    effect: deny
  - action: question
    resource: "*"
    effect: deny
  - action: skill
    resource: "*"
    effect: deny
  - action: skill
    resource: "spec-authoring"
    effect: allow
  - action: skill
    resource: "task-decomposition"
    effect: allow
---

# Planner

You are the CubeClicker feature planner — a subagent. You NEVER address the user; you return your report to the orchestrator. You write specs, plans, and task breakdowns; you write no application code.

## Rules

- Load the `spec-authoring` and `task-decomposition` skills before acting; follow their workflows and templates.
- Work strictly from the Task Brief: read all INPUT paths first. The raw request quoted in the brief is the scope boundary.
- Write `spec.md`, `plan.md`, and `tasks.md` into the feature directory named in the brief. Touch nothing else.
- If `docs/architecture/stack.md` says NOT DECIDED: stay stack-agnostic and list stack choices as open questions. Never assume tooling.
- Acceptance criteria are binary-testable or they don't exist. Non-goals are mandatory. Boundaries use the three tiers.
- `tasks.md`: exclusive `files_owned` per task, acyclic `depends_on`, `[P]` only with disjoint files and no shared-file contact.
- Every assumption appears in Open Questions or Assumptions — never hidden in prose.
- Real-time: specs for features touching shared or cross-client state address connection lifecycle, reconnection, multi-client behavior, and server authority for shared values — or state them as explicitly out of scope — and flag identity vs. "no accounts" conflicts as open questions. Assume no stack beyond the WebSocket protocol requirement.

## Revision mode

When the brief references spec-review findings: read the review artifact and address EVERY finding by ID — fixed (with what changed) or explicitly rebutted (with reasoning). Bump the spec `revision` and add a revision-history line. Never change acceptance criteria silently; changes must trace to the request, the review, or a listed open question.

## Report

Finish with the Subagent Report (status, artifacts, evidence summary, open questions, next recommendation). Use `status: blocked` if the brief is contradictory or missing required inputs.
```

### `git show HEAD:.opencode/skills/spec-authoring/references/spec-checklist.md` (baseline, verbatim)
```markdown
# Spec checklist — run before reporting

## Completeness vs request
- [ ] Every explicit ask is covered by at least one AC or listed as a non-goal or open question
- [ ] Nothing beyond the request is invented without being flagged

## Acceptance criteria
- [ ] Numbered, binary-testable, one behavior each (no conjoined criteria)
- [ ] Bad: "clicking feels fast and satisfying" → Good: "a click updates the counter within the same frame (no visible lag at 60 fps)"
- [ ] Each AC can cite evidence: a test, a command, or an observable step

## Boundaries & scope
- [ ] Three tiers present and specific
- [ ] Non-goals listed
- [ ] Spec covers exactly one feature

## Dependency & sizing (with tasks.md)
- [ ] Every task sized to one builder session, exclusive `files_owned`
- [ ] Dependency graph acyclic; `[P]` only with disjoint files and no shared-file contact
- [ ] Every AC maps to at least one task; every task maps to an AC (or is labeled chore)

## Security
- [ ] User-controlled data identified (names, imports, URLs)
- [ ] Persistence integrity considered (validation on load, corruption handling)
- [ ] No secrets in the client bundle; dependency additions flagged as ⚠️ Ask first

## Testing strategy
- [ ] Commands exist in AGENTS.md (else flagged as an open question)
- [ ] Edge cases named where relevant (offline progress, clock skew, storage quota, rapid input, corrupted save)

## Plan quality
- [ ] File inventory lists everything the feature will touch
- [ ] Interfaces/contracts pinned enough for an independent builder

## Real-time (when the feature touches shared/cross-client state)
- [ ] Connection lifecycle, reconnection, multi-client behavior, and server authority addressed — or explicitly out of scope
- [ ] Identity vs. "no accounts" conflicts flagged as open questions
```

### `git show HEAD:.opencode/skills/task-decomposition/SKILL.md` (baseline, verbatim)
```markdown
---
name: Task Decomposition
description: Use when turning a CubeClicker spec into the tasks.md DAG — task sizing, dependency links, file ownership, and parallel-safety markers.
---

# Task Decomposition

Produce `tasks.md` from `spec.md` and `plan.md`. The orchestrator executes it literally; ambiguity or overlap here causes collisions and rework.

## Rules

1. One task = one coherent change a builder can finish in a single session (describe it in at most two lines).
2. Every task has: `depends_on`, `files_owned`, `verify` (exact commands from `AGENTS.md`), `acceptance` (AC ids it satisfies), `status: [ ]`.
3. `files_owned` MUST be exclusive across tasks. Two tasks may never list the same file.
4. Default order: scaffolding/setup → pure logic (game math, state) → integration (state ↔ UI) → UI polish → persistence. Later tasks depend on earlier ones unless independence is proven.
5. `[P]` (parallel-safe) only when: dependencies are already-earlier tasks, `files_owned` is disjoint, and the task touches no shared file (`package.json`, lockfiles, entrypoints, global styles, routers). When in doubt → `[seq]`.
6. Every AC maps to at least one task; every task maps to at least one AC, or is explicitly labeled a chore (e.g., scaffolding).
7. Keep the graph acyclic — reviewers verify this.
8. Finish with a final task `T<final> — Verify & integrate` `[seq]` that runs the full verification suite before code review.

## Output

Use `templates/tasks.md`. Include a dependency overview line at the top (and optionally a mermaid graph).
```

---

## Verify commands (raw output, § T2)

### `grep -in "container" .opencode/agents/planner.md .opencode/skills/spec-authoring/references/spec-checklist.md .opencode/skills/task-decomposition/SKILL.md`
```
.opencode/agents/planner.md:69:- Containerization: specs for features that add services, images, ports, configuration, or deployables must cover their containerization impact per `docs/architecture/containerization.md` (compose service, image, environment-based config, health signal, WebSocket endpoint exposure) — or state it explicitly out of scope — and stack-dependent container details stay open questions until the application stack is decided.
.opencode/skills/spec-authoring/references/spec-checklist.md:39:## Containers (when the feature adds services, images, ports, configuration, or deployables)
.opencode/skills/spec-authoring/references/spec-checklist.md:40:- [ ] Containerization impact addressed per `docs/architecture/containerization.md` (local-run contract, image/service rules, deploy neutrality, WebSocket endpoint exposure) — or explicitly out of scope
.opencode/skills/spec-authoring/references/spec-checklist.md:41:- [ ] Stack-dependent container details flagged as open questions; no container assets specified for an undecided stack
.opencode/skills/task-decomposition/SKILL.md:16:5. `[P]` (parallel-safe) only when: dependencies are already-earlier tasks, `files_owned` is disjoint, and the task touches no shared file (`package.json`, lockfiles, entrypoints, global styles, routers, container definitions such as the compose file and Dockerfiles). When in doubt → `[seq]`.
```

### `git diff HEAD -- <files_owned>` vs. build-start baselines
```
diff --git a/.opencode/agents/planner.md b/.opencode/agents/planner.md
index 8e2a796..d54a717 100644
--- a/.opencode/agents/planner.md
+++ b/.opencode/agents/planner.md
@@ -66,6 +66,7 @@ You are the CubeClicker feature planner — a subagent. You NEVER address the us
 - `tasks.md`: exclusive `files_owned` per task, acyclic `depends_on`, `[P]` only with disjoint files and no shared-file contact.
 - Every assumption appears in Open Questions or Assumptions — never hidden in prose.
 - Real-time: specs for features touching shared or cross-client state address connection lifecycle, reconnection, multi-client behavior, and server authority for shared values — or state them as explicitly out of scope — and flag identity vs. "no accounts" conflicts as open questions. Assume no stack beyond the WebSocket protocol requirement.
+- Containerization: specs for features that add services, images, ports, configuration, or deployables must cover their containerization impact per `docs/architecture/containerization.md` (compose service, image, environment-based config, health signal, WebSocket endpoint exposure) — or state it explicitly out of scope — and stack-dependent container details stay open questions until the application stack is decided.
 
 ## Revision mode
 
diff --git a/.opencode/skills/spec-authoring/references/spec-checklist.md b/.opencode/skills/spec-authoring/references/spec-checklist.md
index b270cd3..54217ad 100644
--- a/.opencode/skills/spec-authoring/references/spec-checklist.md
+++ b/.opencode/skills/spec-authoring/references/spec-checklist.md
@@ -35,3 +35,7 @@
 ## Real-time (when the feature touches shared/cross-client state)
 - [ ] Connection lifecycle, reconnection, multi-client behavior, and server authority addressed — or explicitly out of scope
 - [ ] Identity vs. "no accounts" conflicts flagged as open questions
+
+## Containers (when the feature adds services, images, ports, configuration, or deployables)
+- [ ] Containerization impact addressed per `docs/architecture/containerization.md` (local-run contract, image/service rules, deploy neutrality, WebSocket endpoint exposure) — or explicitly out of scope
+- [ ] Stack-dependent container details flagged as open questions; no container assets specified for an undecided stack
diff --git a/.opencode/skills/task-decomposition/SKILL.md b/.opencode/skills/task-decomposition/SKILL.md
index 6178553..eee63c8 100644
--- a/.opencode/skills/task-decomposition/SKILL.md
+++ b/.opencode/skills/task-decomposition/SKILL.md
@@ -13,7 +13,7 @@ Produce `tasks.md` from `spec.md` and `plan.md`. The orchestrator executes it li
 2. Every task has: `depends_on`, `files_owned`, `verify` (exact commands from `AGENTS.md`), `acceptance` (AC ids it satisfies), `status: [ ]`.
 3. `files_owned` MUST be exclusive across tasks. Two tasks may never list the same file.
 4. Default order: scaffolding/setup → pure logic (game math, state) → integration (state ↔ UI) → UI polish → persistence. Later tasks depend on earlier ones unless independence is proven.
-5. `[P]` (parallel-safe) only when: dependencies are already-earlier tasks, `files_owned` is disjoint, and the task touches no shared file (`package.json`, lockfiles, entrypoints, global styles, routers). When in doubt → `[seq]`.
+5. `[P]` (parallel-safe) only when: dependencies are already-earlier tasks, `files_owned` is disjoint, and the task touches no shared file (`package.json`, lockfiles, entrypoints, global styles, routers, container definitions such as the compose file and Dockerfiles). When in doubt → `[seq]`.
 6. Every AC maps to at least one task; every task maps to at least one AC, or is explicitly labeled a chore (e.g., scaffolding).
 7. Keep the graph acyclic — reviewers verify this.
 8. Finish with a final task `T<final> — Verify & integrate` `[seq]` that runs the full verification suite before code review.
```

### AC-25 — no `permissions:` / allow / deny entry touched (diff scan)
```
$ git diff HEAD -- .opencode/agents/planner.md | grep -nE "^[+-].*(permissions:|effect:|action:|resource:)"
(no output — exit 1)
```
`planner.md` diff (`git diff HEAD`) touches only the `## Rules` bullet list; the front-matter `permissions:` block
(baseline l.7–52) is byte-identical (no `permissions:`-region hunk appears in the diff above). No `opencode.jsonc` edit.

### AC-28 — technology allow-list scan of new content
```
$ git diff HEAD -- .opencode/agents/planner.md .opencode/skills/spec-authoring/references/spec-checklist.md .opencode/skills/task-decomposition/SKILL.md \
  | grep -E "^\+" | grep -oiE "container|docker|compose|websocket|image|port|ecs|fargate|kubernetes|podman|node|typescript|react|vite|npm|yarn|pnpm|python|rust|java|service" | sort | uniq -c
      2 compose
      7 container
      3 Container
      1 Docker
      1 ecs
      4 image
      2 port
      4 service
      2 WebSocket
```
All matches reduce to the permitted set — container vocabulary ("Container" + "container", "compose", "image", "port",
"service"), the WebSocket protocol, and "Docker" only inside the compound "Dockerfiles". The `ecs` hit is the substring
inside "sp**ecs**", not a provider token. Corroborating forbidden-name scan (framework/runtime/vendor names), which must be empty:
```
$ git diff HEAD -- <same three files> | grep -E "^\+" | grep -oiE "react|nextjs|next\.js|vue|angular|svelte|express|fastify|nestjs|django|flask|spring|typescript|javascript|nodejs|node\.js|deno|bun|webpack|rollup|esbuild|vite|postgres|mysql|mongodb|redis|kubernetes|helm|podman|terraform|aws|azure|gcp"
(none found)
```
Only added lines are scanned (pre-existing planner.md front-matter tokens are outside the diff). No provider commitment,
no application-stack token introduced.

### Cross-file consistency (AC-28 support)
- Every reference added points to `docs/architecture/containerization.md` (created by T1): `test -f docs/architecture/containerization.md` → EXIT 0.
- Status statements in the added text agree with `stack.md`: added content speaks of the "application stack" staying undecided and container details as open questions; no added line claims a decided application stack.

---

## Diff-vs-baseline analysis (AC-26, T2 scope)

Baseline = `HEAD` (`ffadd1d`) content captured verbatim above. Diff shape vs. baseline:

- **Additive (no pre-existing content removed):**
  - `planner.md`: **+1** bullet at end of `## Rules`; every other line byte-identical (diff = 1 insertion, 0 deletions).
  - `spec-checklist.md`: **+1** section (`## Containers (…)`) with 2 checkbox bullets appended after the Real-time section; all prior lines byte-identical (diff = 4 insertions, 0 deletions).
- **In-place modification (exactly the plan contract 6 pinned replacement — the only in-place change in T2):**
  - `task-decomposition/SKILL.md` rule 5: the shared-file parenthetical gains `, container definitions such as the compose file and Dockerfiles`
    before the closing paren; `package.json`, the rest of rule 5's text, rules 1–4 and 6–8, the front matter, and the template are
    byte-identical (diff = 1 insertion, 1 deletion).
- **No drift:** beyond the single contract-6 replacement line, `git diff HEAD` shows no removed lines; no unrelated edits; no
  `permissions:` content; no new files outside `files_owned`.

## Acceptance audit (AC-14, AC-15, AC-24 (+ AC-25/AC-26/AC-28 boundary))

| AC | Verdict | Evidence (file:line / command) |
| --- | --- | --- |
| AC-14 | met | `planner.md:69` — one container rule added to `## Rules`: "specs for features that add services, images, ports, configuration, or deployables must cover their containerization impact per `docs/architecture/containerization.md` (compose service, image, environment-based config, health signal, WebSocket endpoint exposure) — or state it explicitly out of scope — and stack-dependent container details stay open questions until the application stack is decided." Contains "container" (grep). Located in the Rules section (not front matter); one bullet only. |
| AC-15 | met | `spec-checklist.md:39–41` — conditional section `## Containers (when the feature adds services, images, ports, configuration, or deployables)` requiring (l.40) containerization impact addressed per the containerization doc or explicitly out of scope, and (l.41) stack-dependent container details as open questions / no assets for an undecided stack. Added content contains "Container"/"container" (grep). |
| AC-24 | met | `task-decomposition/SKILL.md:16` — rule 5's shared-file examples now read `(… global styles, routers, container definitions such as the compose file and Dockerfiles)`; grep confirms the compose file/Dockerfiles examples. The rest of rule 5 and the whole skill are unchanged (diff = exactly the parenthetical; rules 1–4, 6–8, front matter, and template byte-identical). |
| AC-25 (T2 boundary) | met | `git diff HEAD` for the three edited files contains no `permissions:` / `action:` / `resource:` / `effect:` line (grep above → no output). `planner.md` front-matter permissions block byte-identical. No `opencode.jsonc` edit. |
| AC-26 (T2 boundary) | met | Diff-vs-baseline analysis above — only the contract-4/5 additions and the single contract-6 replacement; no other removed lines; no unrelated edits. |
| AC-28 (T2 boundary) | met | Technology scan reduces to the allow-list (container vocabulary + WebSocket + "Dockerfiles"); no application technology name introduced; pointers to `docs/architecture/containerization.md` resolve (`test -f` EXIT 0); status wording agrees with `stack.md`. |

## Testing strategy note

No automated commands exist (`AGENTS.md` § Commands: TBD; application stack NOT DECIDED) — verification is by inspection:
`grep`, `git diff`/`git show` vs. the build-start baselines above, and `test -f` for reference resolution. No tests are added
(no runtime behavior change; docs/config-content only).

## Deviations from spec

None. Contract 4 and 5 are additive and preserve the pinned wording/tokens; contract 6 is the sole in-place modification
(exactly the pinned parenthetical). No permission-block edits, no application technology names, no new files beyond `files_owned`.

## Commit record

- Message (exact): `docs: add container guidance for planner and task decomposition (T2)`
- Staged paths (explicit `git add`, pathspec-committed): `.opencode/agents/planner.md`,
  `.opencode/skills/spec-authoring/references/spec-checklist.md`, `.opencode/skills/task-decomposition/SKILL.md`,
  `docs/features/containerized-workflow/build-log-T2.md` — and no others.
- Post-commit check: `git show --stat HEAD` lists exactly those four paths (verified after committing; the commit hash and
  `git show --stat` output are reported to the orchestrator — a commit cannot embed its own hash). No sibling commit or branch-tip
  state is recorded here.
