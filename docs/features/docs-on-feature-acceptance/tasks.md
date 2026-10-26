# Tasks — Documentation Update on Feature Acceptance

Dependency overview: T1 → T2 → T3 → T4 → T5 → T6.

## AC → Task mapping

| AC | Task |
| --- | --- |
| AC-1, AC-2 | T1 |
| AC-3, AC-4, AC-5 | T2 |
| AC-6, AC-7 | T3 |
| AC-8, AC-9 | T4 |
| AC-10, AC-11, AC-12 | T5 |
| AC-13, AC-14, AC-15 | T6 |

## T1 — Create documentation best-practices reference `[seq]`
depends_on: —
files_owned: docs/architecture/documentation.md
verify: `test -f docs/architecture/documentation.md`; `grep -in "best practices" docs/architecture/documentation.md`; `grep -in "checklist" docs/architecture/documentation.md`; `grep -n "README.md" docs/architecture/documentation.md`; `grep -n "docs/architecture" docs/architecture/documentation.md`; `grep -n "docs/product" docs/architecture/documentation.md`; `grep -n "docs/features/README.md" docs/architecture/documentation.md`; `grep -in "same change" docs/architecture/documentation.md`; `grep -in "orchestrator" docs/architecture/documentation.md`
acceptance: AC-1, AC-2
status: [x]

## T2 — AGENTS.md workflow rule + playbook transition + builder rule `[seq]`
depends_on: T1
files_owned: AGENTS.md, .opencode/agents/builder.md, .opencode/skills/orchestration-playbook/SKILL.md
verify: `grep -n "documentation" AGENTS.md`; `grep -n "accepted" AGENTS.md`; `grep -n "documentation" .opencode/skills/orchestration-playbook/SKILL.md`; `grep -n "documentation" .opencode/agents/builder.md`; `git diff -- AGENTS.md .opencode/agents/builder.md .opencode/skills/orchestration-playbook/SKILL.md`
acceptance: AC-3, AC-4, AC-5
status: [x]

## T3 — Reviewer and orchestrator agent rules `[seq]`
depends_on: T2
files_owned: .opencode/agents/reviewer.md, .opencode/agents/orchestrator.md
verify: `grep -n "documentation" .opencode/agents/reviewer.md`; `grep -n "documentation" .opencode/agents/orchestrator.md`; `git diff -- .opencode/agents/reviewer.md .opencode/agents/orchestrator.md`
acceptance: AC-6, AC-7
status: [x]

## T4 — Task decomposition and spec-authoring checklist `[seq]`
depends_on: T3
files_owned: .opencode/skills/task-decomposition/SKILL.md, .opencode/skills/spec-authoring/references/spec-checklist.md
verify: `grep -n "documentation" .opencode/skills/task-decomposition/SKILL.md`; `grep -in "documentation" .opencode/skills/spec-authoring/references/spec-checklist.md`; `git diff -- .opencode/skills/task-decomposition/SKILL.md .opencode/skills/spec-authoring/references/spec-checklist.md`
acceptance: AC-8, AC-9
status: [x]

## T5 — Web-implementation, engineering principles, code-review quality `[seq]`
depends_on: T4
files_owned: .opencode/skills/web-implementation/SKILL.md, .opencode/skills/web-implementation/references/engineering-principles.md, .opencode/skills/code-review/checklists/quality.md
verify: `grep -n "documentation" .opencode/skills/web-implementation/SKILL.md`; `grep -in "documentation principles" .opencode/skills/web-implementation/references/engineering-principles.md`; `grep -in "documentation" .opencode/skills/code-review/checklists/quality.md`; `git diff -- .opencode/skills/web-implementation/SKILL.md .opencode/skills/web-implementation/references/engineering-principles.md .opencode/skills/code-review/checklists/quality.md`
acceptance: AC-10, AC-11, AC-12
status: [x]

## T6 — Verify & integrate `[seq]`
depends_on: T5
files_owned: — (verification only)
verify: `git diff --stat` (only the eleven target files + feature build logs changed); `grep -rn "docs/architecture/documentation.md" AGENTS.md .opencode/` (every reference resolves); `git status --short` (no `.env*`, no app code/tests/deps/container assets); `test -z "$(git diff HEAD -- .opencode/agents/*.md | grep 'permissions:')"` (no permissions hunk)
acceptance: AC-13, AC-14, AC-15
status: [x]