# Build log — T5 — Web-implementation, engineering principles, code-review quality

Task: T5 (2026-10-26)
Files changed: `.opencode/skills/web-implementation/SKILL.md`, `.opencode/skills/web-implementation/references/engineering-principles.md`, `.opencode/skills/code-review/checklists/quality.md`

## Build-start baseline

All three targets existed at build start; baselines captured from `HEAD`:

- `.opencode/skills/web-implementation/SKILL.md` (HEAD) — Architecture rules list ending with the Performance bullet, then a blank line and `## Testing bar`.
- `.opencode/skills/web-implementation/references/engineering-principles.md` (HEAD) — ended at `## Containerization principles` / `Deploy neutrality.` bullet.
- `.opencode/skills/code-review/checklists/quality.md` (HEAD) — ended at `## Containerized delivery (if applicable)` block's last checkbox.

No pre-existing content removed; edits are additive only.

## What changed & why

Added a short "Documentation" rule to the web-implementation SKILL.md Architecture rules (every behavior change updates docs in the same commit per `docs/architecture/documentation.md`). Added a `## Documentation principles` section to engineering-principles.md covering accuracy, minimal diffs, same change, concrete specifics, link validity, and glossary updates, referencing `docs/architecture/documentation.md`. Added a `## Documentation` checklist section to code-review/checklists/quality.md with a documentation-drift check (repo docs reflect shipped behavior on acceptance) and a `docs/features/README.md` ownership-respected item.

## Decisions

Additive only; restored the blank line before `## Testing bar` in SKILL.md so no pre-existing formatting was removed.

## Evidence

- `grep -n "documentation" .opencode/skills/web-implementation/SKILL.md` → line 33: `- Documentation: every behavior change updates documentation in the same commit per ...`
- `grep -in "documentation principles" .opencode/skills/web-implementation/references/engineering-principles.md` → line 77: `## Documentation principles`
- `grep -in "documentation" .opencode/skills/code-review/checklists/quality.md` → lines 46-47: `## Documentation` and the drift check.
- `git diff -- .opencode/skills/web-implementation/SKILL.md .opencode/skills/web-implementation/references/engineering-principles.md .opencode/skills/code-review/checklists/quality.md` → only additive hunks (16 insertions, 1 deletion restoring formatting; see diff).

## Acceptance audit

- AC-10 → met: code-review/checklists/quality.md gains a `## Documentation` section with a documentation-drift check requiring repository docs reflect shipped behavior on acceptance; added content contains "documentation" (lines 46-47).
- AC-11 → met: web-implementation/SKILL.md gains a "Documentation" rule referencing `docs/architecture/documentation.md`; added content contains "documentation" (line 33).
- AC-12 → met: engineering-principles.md gains `## Documentation principles` (case-insensitive heading, line 77) covering accuracy, minimal diffs, same change, concrete specifics, link validity, and glossary updates.

## Deviations from spec: none.