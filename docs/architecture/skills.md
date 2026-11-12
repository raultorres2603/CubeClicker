# Skills — Canonical Locations, Policy, and Inventory

This document is the single source of truth for how CubeClicker stores, discovers, permits, and documents agent skills. It covers the six project-owned pipeline skills and the 31 imported third-party packs, the per-agent allow-list policy, and the disposition of every imported pack. `AGENTS.md`, the agent prompts, the six project skills, and the other `docs/architecture/*` documents are binding; imported packs are advisory (see § Binding vs advisory).

## Canonical locations

- `.opencode/skills/<id>/SKILL.md` — project-owned pipeline skills, authored and reviewed in this repository like code. They are the project source and take precedence if an ID ever collides with an imported pack. The six IDs are `orchestration-playbook`, `spec-authoring`, `spec-review`, `task-decomposition`, `web-implementation`, and `code-review`.
- `.agents/skills/<id>/SKILL.md` — imported third-party packs, vendored from upstream and installer-managed. They are a project compatibility source with lower precedence. Every pack is pinned by `skills-lock.json` (`version: 2`; each entry records `source`, `sourceType`, `skillPath`, and `computedHash`).
- No `opencode.jsonc` change is required: the default discovery covers both project locations; the agent frontmatter `skill` rules decide which IDs each agent may load.

## Precedence and ID rules

1. A skill ID is the directory name under `.opencode/skills/` or `.agents/skills/`, in lowercase kebab-case. The `name:` frontmatter is a display name, not a permission key.
2. `.opencode/skills/` has higher precedence than `.agents/skills/`. No ID may exist in both locations: the intersection of the two directory-name sets must be empty (`comm -12` prints nothing).
3. When an imported pack conflicts with `AGENTS.md`, an agent prompt, a project skill, or `docs/architecture/*`, the project rule wins. The imported pack is advisory guidance only.
4. Namespaced references such as `superpowers:test-driven-development` resolve to the local allow-listed ID when one exists (here `test-driven-development`) and are otherwise ignored. No named namespace is installed or consulted.
5. Imported instructions that tell an agent to "ask your human partner" map to a `blocked` report to the orchestrator: subagents never address the user. The orchestrator decides whether to escalate.
6. The `skill` permission block follows one contract: the first rule is `{action: skill, resource: "*", effect: deny}`, followed by exactly one `{action: skill, resource: "<id>", effect: allow}` rule per permitted ID in the order listed in § Per-agent skill policy, and no other `skill` rules. Last-match evaluation therefore allows every listed ID and denies every other skill.

## Per-agent skill policy

The allow-lists are curated, not wildcarded: no wildcard allow, no `ask` effect, and no excluded pack is reachable. Non-skill permissions are not part of this policy and are unchanged from the pre-migration baseline.

| Agent | Project (binding) | Imported (advisory) | Total skill allows |
| --- | --- | --- | --- |
| orchestrator | `orchestration-playbook` | none | 1 |
| planner | `spec-authoring`, `task-decomposition` | `writing-plans` | 3 |
| builder | `web-implementation` | `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `receiving-code-review`, `threejs-fundamentals`, `threejs-geometry`, `threejs-materials`, `threejs-lighting`, `threejs-shaders`, `threejs-textures`, `threejs-animation`, `threejs-interaction`, `threejs-performance`, `threejs-postprocessing`, `fixing-accessibility`, `fixing-motion-performance` | 17 |
| reviewer | `spec-review`, `code-review` | `systematic-debugging`, `verification-before-completion` | 4 |

The builder's ten core `threejs-*` packs cover the raw three.js rendering work; `fixing-accessibility` and `fixing-motion-performance` support the project's accessibility baseline and 60 fps interaction target. The excluded and unassigned packs in § Excluded and unassigned packs are tracked but not allow-listed.

## Imported pack inventory

The inventory lists all 31 directories under `.agents/skills/` with the `skills-lock.json` source and the disposition: `allowed` (in at least one agent allow-list), `excluded` (tracked, never allow-listed, conflicting or irrelevant), or `unassigned` (tracked, not currently allow-listed).

| ID | Source | Disposition |
| --- | --- | --- |
| baseline-ui | ibelick/ui-skills | excluded |
| brainstorming | obra/superpowers | unassigned |
| component-canvas | ibelick/ui-skills | unassigned |
| create-canvas | ibelick/ui-skills | unassigned |
| create-design-md | ibelick/ui-skills | unassigned |
| executing-plans | obra/superpowers | excluded |
| fixing-accessibility | ibelick/ui-skills | allowed |
| fixing-metadata | ibelick/ui-skills | unassigned |
| fixing-motion-performance | ibelick/ui-skills | allowed |
| improve-ui | ibelick/ui-skills | unassigned |
| openai-docs | openai/skills | excluded |
| receiving-code-review | obra/superpowers | allowed |
| subagent-driven-development | obra/superpowers | excluded |
| systematic-debugging | obra/superpowers | allowed |
| test-driven-development | obra/superpowers | allowed |
| threejs-animation | CloudAI-X/threejs-skills | allowed |
| threejs-asset-pipeline | CloudAI-X/threejs-skills | excluded |
| threejs-fundamentals | CloudAI-X/threejs-skills | allowed |
| threejs-geometry | CloudAI-X/threejs-skills | allowed |
| threejs-interaction | CloudAI-X/threejs-skills | allowed |
| threejs-lighting | CloudAI-X/threejs-skills | allowed |
| threejs-loaders | CloudAI-X/threejs-skills | excluded |
| threejs-materials | CloudAI-X/threejs-skills | allowed |
| threejs-performance | CloudAI-X/threejs-skills | allowed |
| threejs-postprocessing | CloudAI-X/threejs-skills | allowed |
| threejs-react-three-fiber | CloudAI-X/threejs-skills | excluded |
| threejs-shaders | CloudAI-X/threejs-skills | allowed |
| threejs-textures | CloudAI-X/threejs-skills | allowed |
| ui-skills-root | ibelick/ui-skills | unassigned |
| verification-before-completion | obra/superpowers | allowed |
| writing-plans | obra/superpowers | allowed |

## Excluded and unassigned packs

Every non-allowed pack has an explicit category and reason. Exclusion means the pack is tracked for provenance but never allow-listed; unassigned means it has no current pipeline role but remains tracked and available for a future, reviewed decision. No pack is deleted by this policy.

| ID | Category | Reason |
| --- | --- | --- |
| baseline-ui | excluded | Mandates Tailwind, motion/react, Base UI/Radix, and its own design rules; conflicts with the decided stack and the project HUD/design system. |
| executing-plans | excluded | Inline plan-execution method; overlaps the orchestrator/builder pipeline. |
| openai-docs | excluded | OpenAI product documentation; irrelevant to CubeClicker. |
| subagent-driven-development | excluded | Own subagent execution/review loop; duplicates the four-agent pipeline. |
| threejs-asset-pipeline | excluded | glTF compression/tooling for imported assets; conflicts with the procedural-asset approach. |
| threejs-loaders | excluded | External model/texture loading guidance; the game uses procedural assets. |
| threejs-react-three-fiber | excluded | Proposes a React Three Fiber rewrite; the frontend uses raw three.js directly. |
| brainstorming | unassigned | Open-ended ideation tool with no current pipeline role. |
| component-canvas | unassigned | Design/authoring tool with no current pipeline role. |
| create-canvas | unassigned | Design/authoring tool with no current pipeline role. |
| create-design-md | unassigned | Design/authoring tool with no current pipeline role. |
| fixing-metadata | unassigned | Design/authoring tool with no current pipeline role. |
| improve-ui | unassigned | Design/authoring tool with no current pipeline role. |
| ui-skills-root | unassigned | Design/authoring tool with no current pipeline role. |

## Binding vs advisory

- **Binding:** `AGENTS.md`, the four agent prompts, the six project skills, and `docs/architecture/*`. They define the state machine, permissions, testing bar, verification evidence, and documentation policy of this repository.
- **Advisory:** every pack under `.agents/skills/`, even when allow-listed. The packs assume their own stacks, execution models, save paths, and a human partner; none of that overrides the four-agent pipeline.
- `writing-plans` contributes only file structure, task right-sizing, step granularity, and self-review. Its `docs/superpowers/plans/` save path, plan header, execution handoff, and `superpowers:*` sub-skill references do not apply; the CubeClicker `spec.md`/`plan.md`/`tasks.md` templates remain binding.
- `test-driven-development` and `verification-before-completion` reinforce the existing testing bar; they never weaken it. `receiving-code-review` governs how review findings are handled, not how they are judged.
- Imported "ask your human partner" instructions become `blocked` reports to the orchestrator (see § Precedence and ID rules). Namespaced references resolve to a local allow-listed ID when present and are otherwise ignored.
- Imported packs may contain scripts (for example `brainstorming/scripts/`, `systematic-debugging/find-polluter.sh`, `openai-docs/scripts/`). The pipeline tracks them for provenance and never executes them automatically.

## Maintenance

- **Pack updates** go through the skills installer plus a reviewed `skills-lock.json` change. Never hand-edit vendored pack content: it would invalidate `computedHash` and the installer update path.
- **Allow-list changes** must keep the rule contract in § Precedence and ID rules: `*` deny first, exact allow IDs in the documented order, no other `skill` rules, and non-skill permissions untouched. Update § Per-agent skill policy and the affected agent prompt in the same change.
- **New project skills** are authored under `.opencode/skills/` and appear in the owning agent's allow-list; they must not reuse an imported ID.
- **Deletion** of an excluded or unassigned pack is a separate, user-approved decision. Until then the pack stays tracked and its disposition and reason stay in this document.
- **Duplicate IDs** are forbidden: adding an ID to one location requires checking the other location first.

## Verification

The machine checks live in the feature `tasks.md` verify blocks and are re-run at final verification:

- exact allow-list rule sequence per agent plus last-match semantics for every known ID;
- non-skill permission parity with the pre-migration `BASE_SHA` for all four agents;
- the 31-row inventory and 14-row disposition tables against `skills-lock.json` and the `.agents/skills/` directory set;
- this document's nine required sections;
- no duplicate ID between `.opencode/skills/` and `.agents/skills/`;
- every allowed ID resolves to exactly one `<id>/SKILL.md` and every live `.opencode/skills/<id>/<file>` reference in `AGENTS.md`, `README.md`, `.opencode/**`, and `docs/architecture/**` exists.

Static resolution is the authoritative gate. The optional `opencode run --format json` skill-load smoke is supplementary only and is never the acceptance basis.

## History

- 2026-11-12 — created by the `agent-skill-migration` feature: restored the six pipeline skills from `HEAD`, commit-tracked the 31 imported packs and `skills-lock.json`, curated the per-agent allow-lists (orchestrator 1, planner 3, builder 17, reviewer 4), and documented the two-location split, precedence, dispositions, and advisory policy in this document.
