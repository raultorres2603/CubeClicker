# Build log — T2 — AGENTS.md workflow rule + playbook transition + builder rule

Task: T2 (2026-10-26)
Files changed: AGENTS.md, .opencode/agents/builder.md, .opencode/skills/orchestration-playbook/SKILL.md
What changed & why: Added the documentation-on-acceptance workflow rule and convention bullet to AGENTS.md; amended the `code_review → accepted` transition in the orchestration playbook to require the builder's documentation pass with recorded evidence (plus a note that the feature stays in `code_review` while the pass runs) and added "documentation updated (list)" to the §7 evidence list; added the post-approval documentation-pass rule to the builder agent.
Decisions: Kept edits additive and minimal; preserved all pre-existing content and formatting; no permissions or stack/container statements touched.

Baseline (build-start, HEAD 9a5c342):
- AGENTS.md: f4032e6f46cd1e167565cd1bfb37e526
- .opencode/agents/builder.md: 81015a419c6495e5f478d0dd08cf84b1
- .opencode/skills/orchestration-playbook/SKILL.md: 846283681694003273d93b7932bde2c9

Evidence:
- `grep -n "documentation" AGENTS.md` → lines 40, 48 contain "documentation"
- `grep -n "accepted" AGENTS.md` → lines 40, 45 contain "accepted"
- `grep -n "documentation" .opencode/skills/orchestration-playbook/SKILL.md` → lines 35, 36, 102
- `grep -n "documentation" .opencode/agents/builder.md` → line 118
- `git diff -- AGENTS.md .opencode/agents/builder.md .opencode/skills/orchestration-playbook/SKILL.md` → 3 files changed, 6 insertions(+), 2 deletions (the two deletions are the amended transition line and the §7 evidence line being replaced in place; all other content preserved)
- `git diff HEAD -- .opencode/agents/*.md | grep 'permissions:'` → no permissions hunk

Acceptance audit:
- AC-3 → met: AGENTS.md Workflow bullet contains "documentation" and "accepted" and points to docs/architecture/documentation.md.
- AC-4 → met: playbook `code_review → accepted` transition requires the documentation pass complete with build-log evidence; added content contains "documentation".
- AC-5 → met: builder.md Rules bullet requires the post-approval documentation pass per docs/architecture/documentation.md with evidence in a build log; added content contains "documentation".
- AC-13 → met: no permissions block changed; no .env*; no app code/tests/deps/container assets.
- AC-14 → met: diff vs baseline contains only the pinned additions/amendments.
- AC-15 → met: reference to docs/architecture/documentation.md resolves; ownership caveat consistent.

Deviations from spec: none.
