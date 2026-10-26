---
feature: docs-on-feature-acceptance
revision: 2
---
# Plan — Documentation Update on Feature Acceptance

## Architecture

This is a documentation/config-content feature: no modules, runtime, or state. The change set is a small set of pinned text additions across the workflow's instruction files, plus one new reference document. The mechanism it installs:

- A new reference, `docs/architecture/documentation.md`, becomes the single source of truth for documentation best practices and the acceptance-time update checklist.
- `AGENTS.md` and the orchestration playbook record that, on final code-review approval, the builder runs a documentation update pass before the feature is marked `accepted`.
- The builder, reviewer, and orchestrator agent files each gain one role rule so the pass is performed, verified, and dispatched respectively.
- The task-decomposition, spec-authoring, code-review, and web-implementation skills gain documentation-impact / documentation-drift guidance so future features account for docs by default.

No new state is added to the state machine; the pass is a post-approval step recorded in a build log (`build-log-docs.md` or the feature's final log).

## Interfaces / contracts

### `docs/architecture/documentation.md` (new)

Structure (pinned):

- H1: `# Documentation — Best Practices` (or equivalent title containing "Documentation").
- A section whose heading contains "best practices" (case-insensitive) with at least six bullets covering: (1) accuracy (docs match shipped behavior), (2) minimal diffs (change only what the behavior change requires), (3) update documentation in the same change as the behavior, (4) concrete specifics (paths, commands, env vars over vague prose), (5) link validity (no broken relative links), (6) glossary updates (update `docs/product/glossary.md` when a term's meaning changes).
- A section whose heading contains "checklist" (case-insensitive) with a list of at least four items naming the update targets: `README.md` (root), `docs/architecture/**`, `docs/product/**` (glossary/vision/backlog), and `docs/features/README.md`, with a note that `docs/features/README.md` is orchestrator-owned (the builder proposes changes in the build log / review rather than editing it), that targets are applied as applicable to the feature (not a blanket rewrite), and a merge strategy for the feature index: the builder appends/updates only its feature's row or proposes a diff for the orchestrator to apply.
- A short note that `.env*` stays user-owned and that secrets must never be documented.

### Pinned content contracts (per target file)

1. **`AGENTS.md`** — one additive workflow rule: on feature acceptance (final code review approved) the builder performs a documentation update pass over repository docs before the feature is marked accepted, pointing to `docs/architecture/documentation.md`. (Added content contains "documentation" and "accepted".)
2. **`.opencode/skills/orchestration-playbook/SKILL.md`** — amend the `code_review → accepted` transition rule so it requires the documentation update pass to be complete (builder-committed doc updates with recorded evidence), note that the orchestrator dispatches the pass on approval, and state that the feature remains in `code_review` while the pass runs, transitioning to `accepted` only once evidence is recorded (no new state). (Added content contains "documentation".)
3. **`.opencode/agents/builder.md`** — one additive rule: post-approval documentation pass per `docs/architecture/documentation.md`, with evidence recorded in a build log. (Added content contains "documentation".)
4. **`.opencode/agents/reviewer.md`** — one additive rule: verify the documentation update pass occurred on acceptance; missing/outdated docs are findings. (Added content contains "documentation".)
5. **`.opencode/agents/orchestrator.md`** — one additive rule: dispatch and verify the documentation update pass before transitioning to `accepted`. (Added content contains "documentation".)
6. **`.opencode/skills/task-decomposition/SKILL.md`** — one additive rule: features must identify their documentation impact; the documentation update pass may occur post-approval per the playbook. (Added content contains "documentation".)
7. **`.opencode/skills/spec-authoring/references/spec-checklist.md`** — one additive checklist item: documentation impact — name the repository docs affected by the feature. (Added content contains "Documentation" or "documentation".)
8. **`.opencode/skills/code-review/checklists/quality.md`** — one additive check: repository docs reflect shipped behavior on acceptance (documentation drift). (Added content contains "documentation".)
9. **`.opencode/skills/web-implementation/SKILL.md`** — one additive rule or Definition-of-Done item referencing `docs/architecture/documentation.md`. (Added content contains "documentation".)
10. **`.opencode/skills/web-implementation/references/engineering-principles.md`** — one new section `## Documentation principles` (case-insensitive heading) covering accuracy, minimal diffs, link validity, and glossary updates.
11. **`docs/architecture/documentation.md`** — new file per the interface above, including the orchestrator-ownership caveat and merge strategy for `docs/features/README.md`.

No in-place modification of any pre-existing line is permitted in files 1–10 beyond the additive content; file 11 is new. `AGENTS.md` § Stack, `docs/architecture/stack.md`, and `docs/architecture/containerization.md` are untouched.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `docs/architecture/documentation.md` | New | Documentation best practices + acceptance-time checklist |
| `AGENTS.md` | Edit | Workflow rule for the post-approval documentation pass |
| `.opencode/skills/orchestration-playbook/SKILL.md` | Edit | `code_review → accepted` requires the doc pass |
| `.opencode/agents/builder.md` | Edit | Builder performs the doc pass on acceptance |
| `.opencode/agents/reviewer.md` | Edit | Reviewer verifies the doc pass on acceptance |
| `.opencode/agents/orchestrator.md` | Edit | Orchestrator dispatches/verifies the doc pass |
| `.opencode/skills/task-decomposition/SKILL.md` | Edit | Documentation-impact rule |
| `.opencode/skills/spec-authoring/references/spec-checklist.md` | Edit | Documentation-impact checklist item |
| `.opencode/skills/code-review/checklists/quality.md` | Edit | Documentation-drift check |
| `.opencode/skills/web-implementation/SKILL.md` | Edit | Documentation rule / DoD item |
| `.opencode/skills/web-implementation/references/engineering-principles.md` | Edit | `## Documentation principles` section |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Documentation pass is a post-approval step, not a new state or pre-review task | Docs must reflect final shipped behavior, which is only known after code review approval; adding a state would ripple through status templates and the state machine | A dedicated `documenting` state; a docs task before `T_final` (would run before review, stale) |
| D-2 | Single best-practices reference at `docs/architecture/documentation.md` | One source of truth, already inside the builder's edit/read allowlist, discoverable alongside `containerization.md` | A new `.opencode/skills/documentation/` skill (would require a permission change to load/use) |
| D-3 | No permission changes | All eleven targets are already writable; keeps AC-13 simple and reviewable | Widening builder permissions (rejected — unnecessary) |
| D-4 | No automated docs linting | Keeps the feature docs-only and consistent with prior workflow-alignment features | Adding a CI check (out of scope; flagged as Q-3) |
| D-5 | `docs/features/README.md` is listed as a target in the best-practices checklist but ownership stays with the orchestrator; the builder proposes changes (appends/updates only its feature's row or proposes a diff) rather than editing it | Avoids two writers on the same file during a feature; orchestrator already updates the index on acceptance | Builder owning the index edit (rejected — orchestrator already updates it on acceptance) |

## Risks & mitigations

- **Self-referential edits** (agent/skill files govern the pipeline) → all edits are additive, pinned, baseline-diffed (AC-14), and git-revertible with no push.
- **Wording drift vs. pinned tokens** → AC-1…AC-12 name the required tokens; reviewer re-runs greps.
- **Reference resolution** → `documentation.md` is created in T1 before any dependent edit (T2+); AC-15 verifies.
- **Scope creep into past features** → non-goal: no retroactive edits; AC-13/AC-14 catch stray diffs.
- **Accidental permission edits** → AC-13 freezes permissions; reviewer inspects every diff.
- **Ownership conflict on `docs/features/README.md`** → builder proposes only; orchestrator applies; merge strategy pinned in the reference (D-5).

## Open questions

- **Q-1** — RESOLVED (r2): pinned token set sufficient (see spec § Open questions).
- **Q-2** — RESOLVED (r2): feature-index ownership stays with orchestrator (D-5).
- **Q-3** — DEFERRED: automated documentation link checking (non-goal).
- **Q-4** — RESOLVED (r2): reference location `docs/architecture/documentation.md` (D-2).

## Assumptions

- All eleven targets are writable by the builder under the current allowlist.
- Wording latitude is bounded by the tokens/concepts pinned above; baselines are captured at build start per task.
- No application-stack or container decision is implied by any wording introduced here.