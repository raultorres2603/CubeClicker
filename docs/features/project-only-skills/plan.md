---
feature: project-only-skills
revision: 2
---
# Plan — Project-Only Skills

## Architecture

This is a repository-state and policy change, not a runtime feature: no application modules, data flow, or runtime state ownership change. Two skill domains exist before the feature and only one survives:

| Domain | Before | After | Ownership |
| --- | --- | --- | --- |
| Project pipeline skills | `.opencode/skills/<id>/SKILL.md` (6 IDs, binding, reviewed like code) | unchanged, byte-identical | repository (like code) |
| Imported third-party packs | `.agents/skills/<id>/SKILL.md` (33 IDs, advisory) + `skills-lock.json` | deleted | removed |
| Technology/library documentation | vendored packs (redundant) | Context7 MCP (external, no repo state) | environment / MCP |

Data flow for the change: `.agents/skills/**` and `skills-lock.json` are deleted (T1) → the agent frontmatter `skill` blocks and the live policy docs are reconciled to the remaining domain (T2) → the full repository gate and stale-reference scans prove the result (T3). The four-agent pipeline, its states, gates, and verdict formats are untouched. The orchestrator allow-list is already project-only and is verified, not edited.

**Supersession.** This plan supersedes the imported-skill policy of the accepted `agent-skill-migration` feature: the two-location split, the imported inventory/dispositions, the `skills-lock.json` installer workflow, and every imported allow-list entry are removed. Retained are the six project pipeline skills, the four-agent pipeline, the `skill` deny-first rule contract, and the static-resolution verification approach. The historical `agent-skill-migration` artifacts are not edited; they remain the record of that migration.

## Interfaces / contracts

**Skill path contract.** A project skill is a directory `<id>` under `.opencode/skills/` containing `SKILL.md`; the directory name is the permission key. The six IDs are `orchestration-playbook`, `spec-authoring`, `spec-review`, `task-decomposition`, `web-implementation`, and `code-review`. There is no second skill source after this feature.

**Skill permission block contract (unchanged, now project-only).** Each agent frontmatter has exactly one wildcard deny followed by one allow per permitted ID in documented order, and no other `skill` rules; last-match evaluation applies:

```yaml
  - action: skill
    resource: "*"
    effect: deny
  - action: skill
    resource: "<id>"
    effect: allow   # repeated once per permitted ID, in order
```

**Expected post-change allow sets.**

| Agent | Allowed skills (in order) |
| --- | --- |
| orchestrator | `orchestration-playbook` |
| planner | `spec-authoring`, `task-decomposition` |
| builder | `web-implementation` |
| reviewer | `spec-review`, `code-review` |

Counts after the change: orchestrator 1, planner 2, builder 1, reviewer 2 (six project-skill allows total, down from six project + nineteen imported).

**Removed allow entries.** planner: `writing-plans`. builder: `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `receiving-code-review`, `threejs-fundamentals`, `threejs-geometry`, `threejs-materials`, `threejs-lighting`, `threejs-shaders`, `threejs-textures`, `threejs-animation`, `threejs-interaction`, `threejs-performance`, `threejs-postprocessing`, `fixing-accessibility`, `fixing-motion-performance`. reviewer: `systematic-debugging`, `verification-before-completion`. orchestrator: none. The three "Imported skills are advisory …" prompt bullets (planner, builder, reviewer) are removed in full; no replacement bullet reintroduces imported packs.

**Permission parity contract.** The verifier parses every agent frontmatter into `(action, resource, effect)` rule blocks. It asserts (a) the total count of `action: skill` occurrences equals the parsed skill-rule count, so a differently shaped or unmatched skill rule fails; (b) the skill sequence is exactly the expected `*` deny plus allows; and (c) the ordered non-skill rule list is identical to the same parse of `git show "$BASE_SHA:.opencode/agents/<agent>.md"`. Any added, removed, or edited non-skill permission (`shell`, `edit`, `subagent`, `question`, `external`, or future actions) fails T2 and T3.

**Deletion contract.** Delete the 33 enumerated `.agents/skills/<id>/` directories and `skills-lock.json`; remove the then-empty `.agents/` directory. Never touch `.opencode/skills/`. Use `git rm -r` (tracked) plus `rm -r` for any untracked remainder; `rm -rf` and `git clean` are banned. Enumerate the tree before deletion and record it.

**Documentation contract.**

- `docs/architecture/skills.md` — rewrite around these sections: `## Canonical location`, `## Precedence and ID rules` (single source; rule contract), `## Per-agent skill policy` (the exact four-row table above), `## Maintenance` (project skills only; allow-list changes), `## Verification` (the static checks), `## History` (migration slugs and removal date; say "third-party packs and installer lockfile", never the old `.agents`/`skills-lock` strings). One statement that library/platform documentation comes from Context7 MCP. No inventory, dispositions, lockfile filename, installer workflow, or a "Context7 redundancy" section.
- `AGENTS.md` — delete the `.agents/skills/` Project-structure bullet; rewrite the Skills convention line to name `.opencode/skills/` only and link `docs/architecture/skills.md`. Leave `podman compose`, the four-agent pipeline, and the proof-of-working text intact.
- `README.md` — rewrite the `docs/architecture/skills.md` bullet in `## Stack` to describe the six project pipeline skills and per-agent allow-lists only. Leave the quickstart and command tables intact.
- `docs/architecture/documentation.md` — audit for `.agents`/`skills-lock`/imported-pack text. None exists, so AC-7 requires an empty diff: record the evidence and make no edit; report `blocked` if a stale reference is found. Keep the `docs/architecture/skills.md` reference and the resolving playbook path.

**Baseline contract.** T1 records `BASE_SHA=$(git rev-parse HEAD)` and the full `git status --porcelain` before any deletion. The planning checkout already has an unrelated pre-existing modification — `M docs/features/vercel-fly-neon-deployment/status.md` — which this feature must never edit, stage, or commit; T1 records that path (and any other unowned dirty path) in `build-log-T1.md`. T3's clean check is scoped to feature-owned paths (`docs/features/project-only-skills`, `.opencode`, `.agents`, `skills-lock.json`, `AGENTS.md`, `README.md`, `docs/architecture`) and explicitly excludes the Vercel status. A whole-tree clean `git status --porcelain` is not required. `BASE_SHA` is written at the top of `build-log-T1.md` in the form `BASE_SHA=<sha>` so later tasks can extract it.

## File inventory

| Path | New/Edit/Delete | Purpose |
| --- | --- | --- |
| `.agents/skills/**` (33 dirs) | Delete | imported third-party packs |
| `.agents/` | Delete (empty dir) | remove the second skill source completely |
| `skills-lock.json` | Delete | installer lockfile for the deleted packs |
| `.opencode/agents/planner.md` | Edit | remove `writing-plans` allow; remove advisory bullet |
| `.opencode/agents/builder.md` | Edit | remove 16 imported allows; remove advisory bullet |
| `.opencode/agents/reviewer.md` | Edit | remove 2 imported allows; remove advisory bullet |
| `.opencode/agents/orchestrator.md` | Unchanged | audit only: already project-only |
| `docs/architecture/skills.md` | Rewrite | project-only policy and allow-list table |
| `AGENTS.md` | Edit | remove `.agents/skills/` bullet; rewrite Skills convention |
| `README.md` | Edit | rewrite the skills bullet in `## Stack` |
| `docs/architecture/documentation.md` | Audit (no-op required) | confirm no imported references; AC-7 empty diff; links valid |
| `docs/features/project-only-skills/spec.md` | New (planner) | this feature's spec |
| `docs/features/project-only-skills/plan.md` | New (planner) | this plan |
| `docs/features/project-only-skills/tasks.md` | New (planner) | task DAG |
| `docs/features/project-only-skills/status.md` | Unchanged | orchestrator-owned state |
| `docs/features/project-only-skills/build-log-T1.md` | New (builder) | T1 raw evidence |
| `docs/features/project-only-skills/build-log-T2.md` | New (builder) | T2 raw evidence |
| `docs/features/project-only-skills/build-log-T3.md` | New (builder) | T3 raw evidence |
| `docs/features/project-only-skills/reviews/**` | Stage/commit at T3 (never edit) | spec-review and code-review verdict artifacts |
| `docs/features/vercel-fly-neon-deployment/status.md` | Do not touch | pre-existing `M` from the blocked feature; excluded from the scoped clean check |
| `docs/features/README.md` | Edit at acceptance (orchestrator) | feature index row |

Not touched: `.opencode/skills/**`, `src/**`, `tests/**`, `compose.yaml`, `compose.smoke.yaml`, `src/*/Dockerfile`, `.github/**`, `opencode.jsonc`, `package.json`, `package-lock.json`, deployment configs, and every historical feature artifact under `docs/features/**`.

## Deletion and edit sequence

1. **Baseline (T1).** `BASE_SHA=$(git rev-parse HEAD)`; record the full `git status --porcelain`, `git status --porcelain -- docs/features/vercel-fly-neon-deployment/status.md` (pre-existing `M` expected), `find .agents/skills -mindepth 1 -maxdepth 1 -type d`, the 33 `SKILL.md` count, `git ls-files .agents`, and `git status --porcelain -- .agents`. If `.agents/` contains anything other than the 33 skill directories, stop and report `blocked`.
2. **Delete (T1).** `git rm -r -- .agents/skills`; `git rm -- skills-lock.json` (add `-f` only if git reports local modifications, after recording them); remove any untracked remainder under `.agents/` with `rm -r` (never `git clean`, never `rm -rf`); once `find .agents -type f` prints nothing, `rm -r -- .agents` removes the empty directory tree. Verify with `test ! -e .agents`, `test ! -e skills-lock.json`, and empty `git ls-files`/`git status` for both paths.
3. **Preserve project skills (T1 verify).** Confirm the six `.opencode/skills/<id>/SKILL.md` files and `git diff --exit-code "$BASE_SHA" -- .opencode/skills`.
4. **Agents (T2).** In planner/builder/reviewer, delete the imported allow rules so each `skill` block matches the expected sequence, and delete the advisory bullet. Do not touch the wildcard deny or any non-skill permission. Orchestrator is audited and left unchanged.
5. **Docs (T2).** Rewrite `docs/architecture/skills.md`; edit `AGENTS.md` and `README.md`; audit `docs/architecture/documentation.md` and leave it unchanged (AC-7 requires an empty diff — report `blocked` if a stale reference is found instead of editing).
6. **Gates (T1, T2, T3).** T1 and T2 run lint/typecheck/coverage; T3 runs lint, typecheck, test, coverage, build and the full stale-reference sweep.
7. **Bookkeeping (T3).** Commit T3's evidence, stage the feature artifacts (`spec.md`, `plan.md`, `tasks.md`, `status.md`) and `reviews/**` without editing them, and run the scoped clean check over the feature-owned paths. The pre-existing `docs/features/vercel-fly-neon-deployment/status.md` is excluded and must not be staged or committed. The reviewer's verdict and the acceptance index row are committed by the orchestrator during acceptance.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Delete the packs and lockfile outright | The user explicitly authorized deletion; only project skills should remain; git history preserves recoverability | Keep packs but disable allow-lists (leaves a discoverable second source and the drift); archive under `docs/` (keeps a second source and bloats the repo) |
| 2 | Remove `.agents/` entirely | No directory means no accidental discovery or future re-import ambiguity | Keep an empty `.agents/` with a README (still advertises a second skill home) |
| 3 | Preserve the exact `*` deny → allow contract | Least privilege and last-match semantics are already reviewed and understood; no permission widening | Switch to an explicit deny list (does not deny unknown future IDs); wildcard allow (forbidden by the project bar) |
| 4 | Keep process discipline in binding project files, not imported packs | `AGENTS.md`, the agent prompts, `web-implementation`, `code-review`, and the reviewer checklist already state the testing/verification bar | Re-author the process imports as project skills (out of scope; the six pipeline skills are the project's process) |
| 5 | Static assertions as the unit tier | The change has no runtime code; content/config checks are the honest unit-level proof | Adding runtime tests that exercise nothing (useless tests, banned by the project bar) |
| 6 | No repo-level Context7 configuration change | Context7 availability is environment-level per the user's statement; adding MCP config is a separate decision | Add a Context7 server to `opencode.jsonc` now (scope creep; not needed for the deletion) |
| 7 | History line names slugs, not paths | Records the supersession without reintroducing the forbidden path/filename strings the stale-reference checks ban | Link the old spec and list the packs again (recreates the inventory this feature removes) |
| 8 | Scope the final clean check to feature-owned paths | The checkout already carries an unrelated `M docs/features/vercel-fly-neon-deployment/status.md` from a blocked feature; a whole-tree clean gate would fail on another flow's file and invite an illegal edit | Whole-tree `git status --porcelain` clean (unachievable without touching another feature); commit the Vercel status (forbidden) |

## Rollback

- **Trigger.** Any gate failure caused by the deletion or the edit set, a discovery/load regression traced to the removed source, or a user decision to restore the packs.
- **Before the feature commits are merged:** `git checkout "$BASE_SHA" -- .agents skills-lock.json .opencode/agents AGENTS.md README.md docs/architecture`, then commit the restore. The deleted files are tracked, so this restores them byte-identically.
- **After merge:** `git revert --no-edit <T3> <T2> <T1>` (reverse chronological order) restores the packs, lockfile, agent rules, and docs while preserving the feature history; then re-run the gates.
- **Recovery without a revert:** `git show "$BASE_SHA:skills-lock.json"` and `git show "$BASE_SHA:.agents/skills/<id>/SKILL.md"` recover any file or the full upstream provenance map.
- **Evidence.** T1 records `BASE_SHA`; T3 records the feature commit SHAs (`git log --oneline "$BASE_SHA"..HEAD -- .agents skills-lock.json .opencode/agents AGENTS.md README.md docs/architecture/skills.md`) and the revert procedure.
- **Out of scope for rollback.** Never restore, stage, revert, or otherwise touch `docs/features/vercel-fly-neon-deployment/status.md`: it belongs to another blocked feature and is excluded from every feature commit and clean check.

## Risks & mitigations

- **R1 — Loss of useful tech guidance (Three.js, Vercel, Neon).** → Context7 MCP supplies current library/platform docs; the user made this trade-off explicitly; git history keeps the old packs recoverable if a concrete gap appears.
- **R2 — Process guidance regression (TDD, debugging, verification, review reception).** → The binding bar lives in `AGENTS.md`, the builder/reviewer prompts, `web-implementation`, `code-review`, and the reviewer checklist; no rule is removed there. T3's full gate proves the pipeline still passes.
- **R3 — Stale references break trust or discovery.** → Exact forbidden-string/forbidden-ID scans over live files in T2 and T3; link-resolution check for the playbook path; historical artifacts are explicitly exempt.
- **R4 — Untracked or foreign files under `.agents/`.** → T1 enumerates the tree and `git ls-files`/`git status` before deletion; non-skill content blocks the task instead of being deleted.
- **R5 — Dirty pre-existing worktree muddies commits.** → Baseline `git status --porcelain` recorded; the unrelated `M docs/features/vercel-fly-neon-deployment/status.md` is recorded and excluded; each task commits only its `files_owned` plus its build log; the scoped clean check covers feature-owned paths only.
- **R6 — Discovery/load smoke unavailable.** → Static resolution is authoritative (same policy as `agent-skill-migration` AC-13); an optional `opencode run --format json` smoke is supplementary and never the acceptance basis.
- **R7 — Scope creep into the blocked Vercel feature or deployment config.** → Non-goals and the `BASE_SHA` unchanged-path diff; the deleted `deploy-to-vercel`/`neon-postgres` packs are not a reason to edit deployment artifacts.
- **R8 — Acceptance bookkeeping leaves a dirty tree.** → T3 stages spec/plan/tasks/status and `reviews/**` without editing; the scoped clean check excludes the Vercel status; the orchestrator commits the verdict and index row at acceptance per `docs/architecture/documentation.md`.

## Verification

- **Unit (static content assertions):** agent frontmatter block parser (exact skill sequences, total `action: skill` count, non-skill parity vs `BASE_SHA`); project-skill set equals the six IDs and is unchanged vs `BASE_SHA`; `.agents/` and `skills-lock.json` absent and untracked; forbidden-path and forbidden-ID scans; `skills.md` required sections/rows/`Context7 MCP`; positive literals in `AGENTS.md`/`README.md`; playbook path resolves; scoped clean check over feature-owned paths with the Vercel status excluded.
- **Integration (repository gate):** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (four metrics ≥ 80 per workspace), `npm run build`.
- **E2E:** none — no service, port, container, or WebSocket change; `npm run smoke` is not required.
- **Containerization:** explicitly out of scope; `podman compose up` remains documented and unmodified.
- **Real-time:** explicitly out of scope; no shared/cross-client state, connection lifecycle, reconnection, or identity behavior changes.

## Open questions

- **Q-1 (carried from spec)** — whether to add a project-level Context7 MCP entry to `opencode.jsonc`. Not part of this feature; Context7 is assumed available at environment level.
- **Q-2 (carried from spec)** — History wording: slugs only (`agent-skill-migration`, `project-only-skills`), no old path/filename strings; recommended and planned unless the reviewer objects.
