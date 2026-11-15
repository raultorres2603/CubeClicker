---
feature: project-only-skills
phase: spec_review
round: 2
iteration: 2
verdict: approved
reviewed: 2026-11-15
blocking: 0
nonblocking: 1
---
# Spec Review — r2

## Summary

✅ approved — 0 blocking (0 BLOCKER, 0 MAJOR), 1 MINOR. The r1 blocker and major are resolved: AC-11 now scopes the clean check to feature-owned paths, stages `reviews/**`, records the pre-existing Vercel status in the T1 baseline, and explicitly excludes it; AC-3/T2/T3 now parse every permission rule, assert the total `action: skill` count, and diff every non-skill rule against `BASE_SHA`. The parser's total-count check also closes the r1 F3 shape gap. The only open item is the orchestrator-owned `status.md:28-31`, which still says "Blockers: None" and does not yet record the pre-existing `M docs/features/vercel-fly-neon-deployment/status.md` baseline/exclusion; the spec/plan/tasks already document it, so this is non-blocking bookkeeping.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `status.md:28-31` | The status still says "Blockers: None" and only says "Do not touch the blocked `vercel-fly-neon-deployment`..." — it does not record the pre-existing `M docs/features/vercel-fly-neon-deployment/status.md` baseline or the scoped clean-check exclusion that the spec/plan/tasks now define. The status is orchestrator-owned; the feature itself correctly records the baseline in T1 and excludes the path from T3. | Update `status.md` at the approval transition with the pre-existing Vercel-status baseline and the scoped clean-check exclusion; do not edit the Vercel status itself. No spec/plan/tasks change. | open |
| F2 | INFO | `plan.md:3`, `spec.md:3` | The plan is now `revision: 2` and the spec is `revision: 2`, matching the r2 content (scoped clean, reviews staging, non-skill parity, total-count parser). | None. | closed |
| F3 | INFO | `docs/architecture/skills.md:1-124` (current) | The current policy document still says 31 imported packs while the actual `.agents/skills`/lockfile set is 33; the T2 rewrite must use the project-only policy, not copy the 31-row inventory or the old count. The spec already states 33. | Keep the rewrite project-only and do not preserve the stale 31 count in History or prose. | open |
| F4 | INFO | `spec.md:130-131` (Q-1/Q-2) | Q-1 (repo-level Context7 entry) and Q-2 (History slug wording) remain non-blocking defaults; the spec correctly leaves them out of scope. | None; keep the environment-level Context7 assumption and slug-only History wording. | open |
| F5 | INFO | `.gitignore`, repository root | No `.gitignore`, installer script, or CI reference to `.agents`/`skills-lock` was found in the live tree; the deletion does not leave a discovery/installer hook behind. The historical `agent-skill-migration` artifacts are the only remaining references and are intentionally exempt. | None; the AC-8 live scan is sufficient for the current tree. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | 11 ACs cover deletion, project-skill preservation, agent allow-lists, prompts, docs, live references, supersession, the full gate and the scoped clean finish; the 33-pack inventory is complete. |
| Testability | ✅ | The parser is total-count and shape-aware, non-skill parity is compared to `BASE_SHA`, T3 stages `reviews/**`, and the clean check is scoped with the Vercel status explicitly excluded; every command is deterministic. |
| Boundaries | ✅ | The deletion is explicitly authorized and limited to the 33 packs and lockfile; `.opencode/skills`, game code, tests, containers, workflows, deployment config and historical artifacts are excluded. |
| Dependency graph | ✅ | T1 → T2 → T3 is acyclic and sequential; all 11 ACs are mapped; `files_owned` sets are disjoint and T3 stages `reviews/**` without editing. |
| Parallel safety | ✅ | All tasks are `[seq]`; T2 depends on T1 and T3 on T2; no `[P]` markers. |
| Security | ✅ | The permission parser now proves the exact project-only skill sequence and non-skill parity; the wildcard deny remains first; the deletion reduces the third-party prompt-injection surface; no secret or runtime surface is touched. |
| Testing | ✅ | Static assertions cover the deletion, project-skill preservation, agent rules, docs and stale references; the full lint/typecheck/test/coverage/build gate is the integration proof, with the no-runtime-code exception correctly reasoned. |
| Consistency | ✅ | The spec/plan/tasks agree on 33 packs, the scoped clean check, `reviews/**` staging, non-skill parity and the Vercel-status exclusion; only the orchestrator status baseline note is pending (F1). |
| Real-time | ✅ | Explicitly out of scope; no shared state, connection lifecycle, reconnection or identity change. |
| Containers | ✅ | Explicitly out of scope; `compose.yaml`, `compose.smoke.yaml`, the Dockerfiles and the `podman compose up` path are unchanged. |
| Documentation | ✅ | The project-only `skills.md`, `AGENTS.md`/`README.md` edits and the `documentation.md` audit are specified; the current `documentation.md` has no stale reference, the playbook path resolves, and Context7 MCP is named. |
| Risks | ✅ | The dirty baseline is recorded and scoped out; untracked/foreign `.agents` content blocks; future re-adding, line drift and Context7 config are acknowledged as non-blocking. |
| Approval checkpoint | ✅ | Q-1/Q-2 are non-blocking defaults; the deletion is explicitly user-authorized, so no additional user gate is required. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) — clean-tree/reviews/Vercel baseline | ✅ fixed | `spec.md:66`/`:126` scope the clean check to feature-owned paths, stage `reviews/**`, record the Vercel status in T1 and exclude it; `tasks.md:173`/`:275-279` implement the staging and scoped checks. |
| F2 (r1) — non-skill permission parity | ✅ fixed | `spec.md:53`/`:96`, `plan.md:49`, `tasks.md:80-113`/`:196-229` parse every rule, compare non-skill rules to `BASE_SHA`, and fail on any difference. |
| F3 (r1) — total-count parser | ✅ fixed | `tasks.md:106-109`/`:222-225` assert the total `action: skill` occurrences equal the parsed skill rules. |
| F5 (r1) — baseline exclusion | ✅ in spec/plan/tasks; status pending | `spec.md:124-126`, `plan.md:60`, `tasks.md:8`/`:22` document the Vercel-status baseline/exclusion; the orchestrator status note is F1. |
| F4/F6 (r1) | ✅ closed | All 33 packs are tracked and `skills-lock.json` is clean in the current checkout; the untracked-pack and dirty-lock conditions no longer exist. |
| F7-F9 (r1) | ✅ INFO | The old `skills.md` 31-count is corrected by the T2 rewrite; Q-1/Q-2 remain non-blocking; no `.gitignore`/installer reference survives. |

## Minimum remaining revisions

None. The only open finding is the non-blocking orchestrator status note (F1).

## Notes / backlog (non-blocking)

- **Readiness to build:** the spec/plan/tasks are ready; the orchestrator should record the pre-existing Vercel-status baseline/exclusion in `status.md` at the approval transition, then start T1. No additional user gate is required — the user explicitly authorized deleting the imported packs.
- **Deletion inventory verified:** the current `.agents/skills` has 33 directories and 33 top-level `SKILL.md` files; `skills-lock.json` has 33 entries; `.agents/` has no non-skill content; `.opencode/skills` has exactly the six project skills (orchestration-playbook, spec-authoring, spec-review, task-decomposition, web-implementation, code-review).
- **Agent contract verified:** current skill allows are orchestrator 1 project, planner 2 project + `writing-plans`, builder 1 project + 16 imported, reviewer 2 project + 2 imported; the target removes the imported rules and keeps the wildcard deny first. The new total-count/non-skill parser is the right checker for the frontmatter.
- **Docs verified:** the current `AGENTS.md`/`README.md`/`docs/architecture/skills.md` contain the live `.agents`/`skills-lock` references that T2 rewrites; `docs/architecture/documentation.md` has no stale reference and its playbook path exists; the historical `agent-skill-migration` artifacts remain untouched.
- **The pre-existing Vercel status is excluded, not ignored:** T1 records `M docs/features/vercel-fly-neon-deployment/status.md`; T2/T3 never stage or commit it; the T3 clean check is scoped to feature paths and the T3 log assertion proves the Vercel path was not committed.
- **Q-1/Q-2 remain non-blocking:** Context7 is assumed environment-level; the History may name the slugs without the deleted path/filename strings.
- No skill, agent, doc, config or git state was edited by this review; only this review artifact was written.
