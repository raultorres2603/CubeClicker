---
feature: docs-on-feature-acceptance
revision: 2
status: draft
created: 2026-10-26
updated: 2026-10-26
---
# Spec — Documentation Update on Feature Acceptance

## Summary

When a feature's final code review is approved (state → accepted), the builder must perform a documentation update pass over the repository's documentation (README, architecture docs, product docs, and the feature index) following a pinned set of best practices, so shipped behavior and documentation never drift. This feature is documentation/config-content only: it adds a documentation best-practices reference, and updates `AGENTS.md`, the orchestration playbook, the agent instruction files, and the relevant skills so the post-approval documentation pass is a defined, required step of the workflow rather than an ad-hoc one. No application code, tests, dependencies, or container assets are touched; the application stack and container conventions remain as decided.

## Scope

### In scope

Eleven target files, each with a pinned content contract in `plan.md` § Pinned content contracts:

- **Best-practices reference (1, new):** `docs/architecture/documentation.md` — documentation best practices and an acceptance-time update checklist.
- **Project-level workflow (1):** `AGENTS.md` — a documentation-update rule in the workflow section.
- **Orchestration (1):** `.opencode/skills/orchestration-playbook/SKILL.md` — the `code_review → accepted` transition requires the documentation update pass to be complete.
- **Agent instruction files (3):** `.opencode/agents/builder.md`, `.opencode/agents/reviewer.md`, `.opencode/agents/orchestrator.md` — role rules for the post-approval documentation pass.
- **Skills (5):** `.opencode/skills/task-decomposition/SKILL.md`, `.opencode/skills/spec-authoring/references/spec-checklist.md`, `.opencode/skills/code-review/checklists/quality.md`, `.opencode/skills/web-implementation/SKILL.md`, `.opencode/skills/web-implementation/references/engineering-principles.md` — documentation-impact and documentation-drift guidance.

Plus per-task build logs inside `docs/features/docs-on-feature-acceptance/`.

### Explicitly out of scope

- Any application code, tests, build config, dependency, or container asset change.
- Any change to the application stack, container conventions, or `docs/architecture/stack.md` / `docs/architecture/containerization.md`.
- Any change to agent `permissions:` blocks or allow/deny entries (no permission bootstrap; all targets are already writable).
- Retroactive documentation updates to previously accepted features or their artifacts.
- Automated documentation linting/CI checks.
- Resolving which individual docs a future feature must touch beyond the best-practices checklist (that is the builder's judgment per the reference).
- Editing `docs/features/README.md` (orchestrator-owned on acceptance; the builder's pass may propose but not own that edit).
- This feature installs the documentation rule and reference only; it does not perform a documentation pass on its own acceptance. If such a pass runs, it is limited to verifying the eleven pinned targets and adds no further doc edits beyond those already pinned (otherwise deferred to the orchestrator).

## User stories

- As the project owner, I want repository documentation updated whenever a feature is accepted so docs never drift from shipped behavior.
- As the builder, I want a pinned best-practices reference and a defined post-approval step so documentation updates are consistent and reviewable.
- As the reviewer, I want documentation drift called out at the code gate so missing doc updates are findings, not silent regressions.
- As the orchestrator, I want the acceptance transition to require evidence of the documentation pass so state advances only on proof.

## Acceptance criteria

Verification notes: every AC is verified **by inspection** — this feature changes no runtime behavior and touches no testable code, so `npm run coverage` is not applicable and no project commands are required. `grep`, `git diff`/`git show`, `ls`/`test`, and `git status` may be cited as build-time aids. "Added content" means net-new lines relative to the file's build-start baseline (recorded per task in `build-log-T<id>.md`); in-place modifications are limited to the pinned contracts in `plan.md` § Pinned content contracts. The only technology names introduced may be "documentation", "Markdown", and existing repository paths.

- **AC-1** — `docs/architecture/documentation.md` exists and contains a section whose heading contains "best practices" (case-insensitive) describing, at minimum, these six items: (1) keep docs accurate (docs match shipped behavior); (2) keep docs minimal (change only what the behavior change requires); (3) update documentation in the same change as the behavior; (4) prefer concrete specifics (paths, commands, env vars) over prose; (5) keep links valid; (6) update the glossary when a term's meaning changes.
- **AC-2** — `docs/architecture/documentation.md` contains an acceptance-time checklist (a section whose heading contains "checklist" and a list of at least four items) naming at least these update targets: `README.md` (root), `docs/architecture/**`, `docs/product/**` (glossary/vision/backlog), and `docs/features/README.md`, with a note that `docs/features/README.md` is orchestrator-owned (the builder proposes changes rather than editing it) and that targets are applied as applicable to the feature, not as a blanket rewrite.
- **AC-3** — `AGENTS.md` gains a workflow rule stating that on feature acceptance (final code review approved) the builder performs a documentation update pass over repository docs before the feature is marked accepted, and pointing to `docs/architecture/documentation.md` (added content contains "documentation" and "accepted").
- **AC-4** — `.opencode/skills/orchestration-playbook/SKILL.md` is amended so the `code_review → accepted` transition requires the documentation update pass to be complete, with builder-committed doc updates and recorded evidence; added content contains "documentation" (case-insensitive).
- **AC-5** — `.opencode/agents/builder.md` gains a rule requiring the post-approval documentation pass per `docs/architecture/documentation.md`, with evidence recorded in a build log (added content contains "documentation").
- **AC-6** — `.opencode/agents/reviewer.md` gains a rule requiring verification that the documentation update pass occurred on acceptance, with missing/outdated docs counted as findings (added content contains "documentation").
- **AC-7** — `.opencode/agents/orchestrator.md` gains a rule to dispatch and verify the documentation update pass before transitioning to `accepted` (added content contains "documentation").
- **AC-8** — `.opencode/skills/task-decomposition/SKILL.md` gains a rule noting that features must identify their documentation impact and that the documentation update pass may occur post-approval per the playbook (added content contains "documentation").
- **AC-9** — `.opencode/skills/spec-authoring/references/spec-checklist.md` gains a documentation-impact item requiring specs to name the repository docs affected by the feature (added content contains "Documentation" or "documentation").
- **AC-10** — `.opencode/skills/code-review/checklists/quality.md` gains a documentation-drift check requiring that repository docs reflect shipped behavior on acceptance (added content contains "documentation").
- **AC-11** — `.opencode/skills/web-implementation/SKILL.md` gains a documentation rule or Definition-of-Done item referencing `docs/architecture/documentation.md` (added content contains "documentation").
- **AC-12** — `.opencode/skills/web-implementation/references/engineering-principles.md` gains a `## Documentation principles` section (case-insensitive heading) covering at least: accuracy, minimal diffs, link validity, and glossary updates.
- **AC-13** — No task commit modifies any `permissions:` block or allow/deny entry in `.opencode/agents/*.md`; no `.env*` file is created, edited, or committed; no application code, tests, dependencies, or container assets are added or changed.
- **AC-14** — For each of the eleven target files, the diff vs. its task's build-start baseline contains only the additions/amendments pinned in `plan.md` § Pinned content contracts; no pre-existing content is removed beyond those pinned replacements; no unrelated edits.
- **AC-15** — Cross-file consistency: every reference to `docs/architecture/documentation.md` resolves to the file created by AC-1; the ownership caveat for `docs/features/README.md` is consistent between the reference and AC-2; all stack/container status statements remain unchanged (application stack DECIDED, containerized path DECIDED); no new technology or provider commitment is introduced.

## Non-goals

- No application code, tests, build config, dependencies, or container assets.
- No change to the application stack, container conventions, or their docs.
- No permission changes anywhere; no `.env*`; no secrets; no push.
- No retroactive documentation updates to previously accepted features.
- No automated documentation linting or CI checks.
- No new agent states or status-template changes (the pass is a post-approval step, not a new state).
- No editing of `docs/features/README.md` by this feature (orchestrator-owned).
- This feature installs the documentation rule and reference only; it does not perform a documentation pass on its own acceptance. If such a pass runs, it is limited to verifying the eleven pinned targets and adds no further doc edits beyond those already pinned (otherwise deferred to the orchestrator).

## Boundaries

- ✅ Always: follow the pinned per-file contracts exactly; capture build-start baselines and per-AC inspection evidence in `build-log-T<id>.md`; keep edits additive/minimal; respect that `AGENTS.md`, `docs/architecture/**`, and `.opencode/**` are shared user-owned config.
- ⚠️ Ask first: any addition beyond the pinned contracts; touching any file outside the eleven-target inventory; changing the best-practices content beyond the pinned bullets.
- 🚫 Never: introduce application technologies or dependencies; change permissions or `opencode.jsonc`; edit `.env*`; commit secrets; rewrite pre-existing content beyond the pinned amendments; resolve open questions unilaterally.

## Security considerations

- Documentation/config-content change: no runtime, no user-controlled data paths, no persistence — no new attack surface in the product.
- No secrets, tokens, or keys are introduced; no `.env*` edits; no dependency additions (supply chain unchanged).
- Self-referential edits: the feature updates agent/skill files that govern the pipeline; all edits are content-only, pinned, baseline-diffed (AC-14), and git-revertible with no push. No `permissions:` block is touched (AC-13).
- The best-practices reference instructs future doc updates to avoid leaking secrets and to keep `.env*` user-owned (consistent with `docs/architecture/containerization.md`).

## Testing strategy

- No runtime behavior change and no code touched → `npm run coverage` is not applicable and no project commands are required, per the precedent of documentation/config-content features. Verification is by inspection.
- Evidence per task: build log with (a) build-start baseline capture per edited file (`git show HEAD:<path>` excerpt or verbatim copy), (b) `git diff` output vs. baseline, (c) per-AC inspection table, (d) `grep` anchor outputs for the tokens named in each AC.
- Reviewer re-verifies independently: reads each target file's added content, reruns greps, inspects diffs for AC-13/AC-14, checks cross-file consistency (AC-15), treats anything unverifiable as unmet.
- Edge cases addressed by construction: baseline drift (build-start capture governs), wording drift (tokens + concepts), reference resolution (`documentation.md` must exist before dependent checks — T1 sequence), accidental permission edits (AC-13), scope creep (AC-14).

## Real-time considerations

- This feature changes no runtime behavior and touches no shared/cross-client state → connection lifecycle, reconnection, multi-client behavior, and server authority for shared values are **out of scope here** (owned by application features per the accepted online-realtime-workflow rules).
- Identity vs. "no accounts": not implicated — no identity surface is touched.

## Container considerations

- This feature adds no services, images, ports, configuration, or deployables and touches no container assets → containerization impact is **out of scope here**; the stack and container conventions remain as decided (`docs/architecture/stack.md`, `docs/architecture/containerization.md` untouched).

## Open questions

- **Q-1** — RESOLVED (r2): the pinned token set for AC-1/AC-2 is sufficient for reviewability; wording latitude is bounded by the six bullets and four targets pinned in `plan.md` § Interfaces / contracts. (Original question confirmed.)
- **Q-2** — RESOLVED (r2): ownership of `docs/features/README.md` updates stays with the orchestrator (D-5); the best-practices reference lists it as a target for the builder to propose changes, not to own.
- **Q-3** — DEFERRED: whether a future feature should add an automated documentation link checker. Out of scope here (non-goal); flagged for a later feature.
- **Q-4** — RESOLVED (r2): the best-practices reference lives at `docs/architecture/documentation.md` (D-2).

## Assumptions

- All eleven targets are writable by the builder under the current allowlist (`AGENTS.md`, `docs/architecture/**`, `.opencode/agents/*.md`, `.opencode/skills/**`, `docs/features/**/build-log*.md`); no permission bootstrap is needed.
- Wording latitude is bounded by the tokens/concepts pinned in `plan.md`; baselines are captured at build start per task.
- The documentation pass is a post-approval step, not a new state or a pre-review task, so the state machine's existing states are unchanged.
- No application-stack or container decision is implied by any wording introduced here.
- The acceptance-time checklist in `docs/architecture/documentation.md` doubles as the reusable documentation-pass template artifact; no separate template file is added (scope control, AC-13/AC-14).

## Revision history

- r1 — 2026-10-26 — initial draft
- r2 — 2026-10-26 — revision per reviews/spec-r1.md (F1–F9): aligned AC-1 bullets with plan interface (six items, incl. same-change); added ownership caveat to AC-2/AC-15; added Container considerations; resolved Q-1/Q-2/Q-4; deferred Q-3; added self-acceptance-pass non-goal and checklist-as-template assumption.