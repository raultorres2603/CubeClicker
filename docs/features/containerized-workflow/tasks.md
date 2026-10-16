# Tasks — Containerized Workflow Alignment

Dependency overview: `T1 → {T2, T3, T4} → T5`. T2–T4 are one `[P]` batch (pairwise disjoint `files_owned`, no shared files, single earlier dependency T1). T1 is `[seq]` because T2–T4's rules reference `docs/architecture/containerization.md`, which T1 creates.

**No permission bootstrap exists in this feature:** all 14 target files are already inside the builder's edit allowlist (`AGENTS.md`, `docs/architecture/**`, `.opencode/agents/*.md`, `.opencode/skills/**`, `docs/features/**/build-log*.md`) — widened by online-realtime-workflow T0. No task modifies any `permissions:` block or allow/deny entry (AC-25); no user action gates `building`.

**Verification note:** `AGENTS.md` § Commands is TBD (application stack NOT DECIDED) — `grep`, `git diff`/`git show`, `ls`, `test`, and `git status` below are inspection aids, not project commands. Every AC is verified by inspection; per-AC evidence goes in the task's build log.

**Baseline note:** each task captures the build-start content of every file it edits (`git show HEAD:<path>` excerpt or verbatim copy) in its build log; all diffs are checked against that baseline (AC-26). Baselines govern over plan-time wording.

**Commit staging note:** every task commit stages only that task's `files_owned` paths (explicit `git add` of those paths) — never `git add .` or `git add -A`; never push.

## T1 — Project-level truth: split status + containerized delivery path `[seq]`
depends_on: —
files_owned: `AGENTS.md`, `docs/architecture/stack.md`, `docs/architecture/containerization.md`, `docs/features/containerized-workflow/build-log-T1.md`
verify: `test -f docs/architecture/containerization.md` (new doc exists); `grep -n "^## " docs/architecture/containerization.md` (closed H2 set per contract 2); `grep -in "NOT DECIDED\|containerized delivery path\|docker compose\|Docker Compose\|ECS Fargate" AGENTS.md docs/architecture/stack.md docs/architecture/containerization.md`; `git diff HEAD -- AGENTS.md docs/architecture/stack.md` vs. build-start baselines (record all output in `build-log-T1.md`)
acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12, AC-13
status: [x]

Apply `plan.md` § Pinned content contracts items 1–3 exactly: split status line, rules-bullet exception, WebSocket closing-sentence amendment, new `## Containerized delivery path (DECIDED)` section, and closing-paragraph addition in `stack.md`; the new `containerization.md` with its closed section set; the `AGENTS.md` § Stack modification (3.A) + additions (3.B, 3.C). Capture build-start baselines. Amendment rule: only the pinned replacements in contracts 1/3/6 are in-place modifications; everything else additive. No application technology names (AC-28); no container assets (AC-27). Commit `docs: record containerized delivery path and split stack status (T1)`.

## T2 — Planning guidance: planner, spec checklist, task decomposition `[P]`
depends_on: T1
files_owned: `.opencode/agents/planner.md`, `.opencode/skills/spec-authoring/references/spec-checklist.md`, `.opencode/skills/task-decomposition/SKILL.md`, `docs/features/containerized-workflow/build-log-T2.md`
verify: `grep -in "container" .opencode/agents/planner.md .opencode/skills/spec-authoring/references/spec-checklist.md .opencode/skills/task-decomposition/SKILL.md`; `git diff HEAD -- <files_owned>` vs. build-start baselines (record in `build-log-T2.md`)
acceptance: AC-14, AC-15, AC-24
status: [x]

Apply contracts 4–6: one container rule in `planner.md`; the conditional container section in the spec-authoring checklist; the rule-5 shared-file example-list amendment in the task-decomposition skill (only the parenthetical changes). No permission-block edits; no other rule text changes. Commit `docs: add container guidance for planner and task decomposition (T2)`.

## T3 — Builder guidance: agent rule + web skill + principles `[P]`
depends_on: T1
files_owned: `.opencode/agents/builder.md`, `.opencode/skills/web-implementation/SKILL.md`, `.opencode/skills/web-implementation/references/engineering-principles.md`, `docs/features/containerized-workflow/build-log-T3.md`
verify: `grep -in "container" .opencode/agents/builder.md .opencode/skills/web-implementation/SKILL.md .opencode/skills/web-implementation/references/engineering-principles.md`; `git diff HEAD -- <files_owned>` vs. build-start baselines (record in `build-log-T3.md`)
acceptance: AC-17, AC-18, AC-19
status: [x]

Apply contracts 7–9: one container rule in `builder.md`; the architecture-rule bullet in the SKILL (summary + depth pointer); the `## Containerization principles` section in engineering principles. Baseline for `builder.md` includes the T0-widened permissions — touch no permission entry (AC-25). Commit `docs: add container engineering guidance for builder and web skill (T3)`.

## T4 — Reviewer guidance: agent rule + spec/code gate checklists `[P]`
depends_on: T1
files_owned: `.opencode/agents/reviewer.md`, `.opencode/skills/spec-review/SKILL.md`, `.opencode/skills/code-review/checklists/quality.md`, `.opencode/skills/code-review/checklists/security.md`, `.opencode/skills/code-review/checklists/testing.md`, `docs/features/containerized-workflow/build-log-T4.md`
verify: `grep -in "container" .opencode/agents/reviewer.md .opencode/skills/spec-review/SKILL.md .opencode/skills/code-review/checklists/*.md`; `git diff HEAD -- <files_owned>` vs. build-start baselines (record in `build-log-T4.md`)
acceptance: AC-16, AC-20, AC-21, AC-22, AC-23
status: [x]

Apply contracts 10–14: one container rule in `reviewer.md`; one checklist item in the spec-review skill; one conditional container section in each code-review checklist (follow the files' existing `✅/❌/n/a` conventions). Commit `docs: add container review checks for spec/code gates (T4)`.

## T5 — Verify & integrate `[seq]`
depends_on: T1, T2, T3, T4
files_owned: `docs/features/containerized-workflow/build-log-T5.md`
verify: full inspection pass over all 14 target files against AC-1…AC-28: per-file `git diff` vs. each task's recorded build-start baseline (AC-26; verify the amendment trace — in-place modifications only in `AGENTS.md` § Stack bullet 1, `stack.md` (status line, rules bullet 1, WebSocket closing sentence, closing paragraph), and task-decomposition rule 5's example list); `grep` anchors for every token named in the ACs; permission freeze inspection across every task commit's diff plus `grep -n "permissions:" .opencode/agents/*.md` content comparison (AC-25); `git status --short` shows no `.env*` or new container/CI/config assets (AC-25, AC-27); reference resolution: every pointer to `docs/architecture/containerization.md` resolves to the existing file (AC-28); cross-file status-consistency review (AC-28). Record the full per-AC evidence table in `build-log-T5.md`.
acceptance: AC-1 … AC-28 (verification gate; AC-25/AC-26/AC-27/AC-28 include the cross-cutting checks)
status: [x]

Independent re-check of the complete deliverable before code review; report any AC not met with exact location. Flag any drift from the pinned contracts instead of papering over it. Commit `docs: record T5 verification pass for containerized-workflow (T5)`.
