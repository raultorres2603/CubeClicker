# Build log — T4 — Task decomposition and spec-authoring checklist

Task: T4 (2026-10-26)
Files changed: `.opencode/skills/task-decomposition/SKILL.md`, `.opencode/skills/spec-authoring/references/spec-checklist.md`

What changed & why: Added a "Documentation task" section to the task-decomposition skill requiring features that change user-facing behavior/config/commands/ports/images to account for documentation (dedicated or folded into final verification), with `files_owned` covering affected docs and `verify` greps. Added a "Documentation" checklist section to the spec checklist requiring specs to name the docs affected and confirm the documentation pass is scheduled in tasks.

Decisions: Additive only; no pre-existing lines modified.

Evidence:
- `grep -n "documentation" .opencode/skills/task-decomposition/SKILL.md` → line 27 contains "documentation" (and "docs/architecture/documentation.md").
- `grep -in "documentation" .opencode/skills/spec-authoring/references/spec-checklist.md` → lines 47-48 contain "Documentation"/"documentation".
- `git diff -- .opencode/skills/task-decomposition/SKILL.md .opencode/skills/spec-authoring/references/spec-checklist.md` → only additive hunks shown above.

Acceptance audit:
- AC-8 → met: task-decomposition SKILL.md gains a "Documentation task" rule; added content contains "documentation" (line 27) and references `docs/architecture/documentation.md`.
- AC-9 → met: spec-checklist.md gains a "Documentation" checklist item naming the docs affected; added content contains "Documentation" (line 47) and "documentation" (line 48).

Deviations from spec: none.