# Skills — Canonical Location, Policy, and Verification

This document is the single source of truth for how CubeClicker stores, discovers, permits, and verifies agent skills. The repository carries exactly the six project-owned pipeline skills under `.opencode/skills/`; there is no second skill source. Library and platform documentation is not vendored as skills — it comes from Context7 MCP on demand.

`AGENTS.md`, the four agent prompts, the six project skills, and the other `docs/architecture/*` documents are binding. A skill is guidance for how to perform a role; it never overrides the project rules, the four-agent pipeline, or the testing/verification bar.

## Canonical location

- `.opencode/skills/<id>/SKILL.md` — project-owned pipeline skills, authored and reviewed in this repository like code. The directory name `<id>` is the skill ID and the permission key.
- The six IDs are `orchestration-playbook`, `spec-authoring`, `spec-review`, `task-decomposition`, `web-implementation`, and `code-review`.
- No `opencode.jsonc` change is required: default discovery covers `.opencode/skills/`, and the agent frontmatter `skill` rules decide which IDs each agent may load.

## Precedence and ID rules

1. A skill ID is the directory name under `.opencode/skills/`, in lowercase kebab-case. The `name:` frontmatter is a display name, not a permission key.
2. `.opencode/skills/` is the only skill location. New skills are added there; no second location is consulted or maintained.
3. When a skill conflicts with `AGENTS.md`, an agent prompt, another project skill, or `docs/architecture/*`, the project rule wins.
4. The `skill` permission block follows one contract: the first rule is `{action: skill, resource: "*", effect: deny}`, followed by exactly one `{action: skill, resource: "<id>", effect: allow}` rule per permitted ID in the order listed in § Per-agent skill policy, and no other `skill` rules. Under last-match evaluation every listed ID is allowed and every other skill is denied.
5. Library and platform documentation (Three.js, React, Vite, Fastify, Vercel, Neon, and similar) comes from Context7 MCP at the time an agent needs it. The project does not vendor technology skills, so agents query Context7 instead of relying on copied guidance that drifts from upstream.

## Per-agent skill policy

The allow-lists are curated, not wildcarded: no wildcard allow, no `ask` effect, and no unlisted skill is reachable. Every other skill is denied by the leading `*` rule. Non-skill permissions (file edits, shell, subagent, question) are outside this policy and are unchanged by skill-policy edits.

| Agent | Allowed skills (in order) | Skill allows |
| --- | --- | --- |
| orchestrator | `orchestration-playbook` | 1 |
| planner | `spec-authoring`, `task-decomposition` | 2 |
| builder | `web-implementation` | 1 |
| reviewer | `spec-review`, `code-review` | 2 |

The table rows are the canonical allow-lists: each row must match the corresponding agent prompt's `skill` rules exactly, in the same order.

## Maintenance

- **Allow-list changes** must keep the rule contract in § Precedence and ID rules: `*` deny first, exact allow IDs in the documented order, no other `skill` rules, and no change to non-skill permissions. Update § Per-agent skill policy and the affected agent prompt in the same change.
- **New project skills** are authored under `.opencode/skills/` and added to the owning agent's allow-list; a skill that no agent allows is dead weight and must not be added.
- **Removing a project skill** is a user-approved decision; remove the directory, the allow rules, and the table row in one change.
- **No second skill location** is added without an explicit, reviewed policy change to this document. Library/platform documentation is obtained from Context7 MCP rather than copied into the repository.
- **Non-skill permissions** are governed by the agent prompts and are never widened as part of a skill-policy edit.

## Verification

The static checks run in the feature tasks' `verify` blocks and are re-run at final verification:

- a parser enumerates every permission rule block in each `.opencode/agents/<agent>.md` frontmatter and asserts the `skill` sequence is exactly the `*` deny followed by the allowed IDs in the documented order;
- the total count of `action: skill` occurrences equals the parsed skill-rule count, so a differently shaped or unmatched skill rule fails;
- the ordered non-skill permission rules of each agent are identical to the recorded baseline commit — any added, removed, or edited non-skill permission fails;
- `.opencode/skills/` contains exactly the six IDs, each with a `SKILL.md`, and is unchanged by skill-policy edits;
- no live document references a removed skill location or installer lockfile;
- every allowed ID resolves to exactly one `<id>/SKILL.md` and every live `.opencode/skills/<id>/<file>` reference in `AGENTS.md`, `README.md`, `.opencode/**`, and `docs/architecture/**` exists.

Static resolution is the authoritative gate. An optional `opencode run --format json` skill-load smoke is supplementary only and is never the acceptance basis.

## History

- 2026-11-12 — created by the `agent-skill-migration` feature: restored the six pipeline skills from `HEAD`, tracked the third-party packs and the installer lockfile, and curated the per-agent allow-lists.
- 2026-11-15 — `project-only-skills` supersedes the multi-source policy: the third-party packs and the installer lockfile are removed, every agent's `skill` rules are reduced to the project IDs above (orchestrator 1, planner 2, builder 1, reviewer 2), the inventory/disposition policy is replaced by this project-only policy, and library/platform documentation is sourced from Context7 MCP.
