---
feature: project-only-skills
phase: spec_review
round: 1
iteration: 1
verdict: changes_requested
reviewed: 2026-11-14
blocking: 2
nonblocking: 2
---
# Spec Review — r1

## Summary

❌ changes requested — 1 BLOCKER, 1 MAJOR, 2 MINOR, 3 INFO. The deletion inventory is accurate (33 `.agents/skills` directories and 33 lockfile entries, with no non-skill content under `.agents/`), the six project skills are present, and the allow-list target sequences match the current agent frontmatter. Two problems must be fixed before the spec is buildable: AC-11's whole-tree clean assertion cannot pass on the current checkout because `docs/features/vercel-fly-neon-deployment/status.md` is modified (a pre-existing path the feature must not touch) and the untracked feature directory contains `reviews/**`, which T3's `commits_also` does not stage; and the spec's claim that T2/T3 re-verify non-skill permission parity against `BASE_SHA` has no corresponding check in the task verify commands.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | BLOCKER | `spec.md:66` (AC-11), `tasks.md:148`, `:227-229`, current checkout | AC-11 requires `git status --porcelain` to print nothing after T3. The current checkout already has a pre-existing `M docs/features/vercel-fly-neon-deployment/status.md` (another feature's status; this feature must not edit it) and the untracked `docs/features/project-only-skills/` directory. T3's `commits_also`/`git add` stages `spec.md`, `plan.md`, `tasks.md`, `status.md` and `build-log-T3.md` but **not** `reviews/**`, so the spec-review artifact remains untracked after T3. The whole-tree clean assertion therefore fails regardless of the feature's own correctness. (The earlier `M opencode.jsonc`/`M skills-lock.json`/untracked-pack state has been resolved in the current checkout; the remaining blocker is the pre-existing other-feature status plus the missing `reviews/**` staging.) | Add `docs/features/project-only-skills/reviews/**` to T3 `commits_also` and the AC-11 staging list, and record the pre-existing `M docs/features/vercel-fly-neon-deployment/status.md` (and any other unowned dirty path) in the T1 baseline. Scope AC-11's clean-tree assertion to the feature-owned paths, or have the orchestrator resolve the pre-existing status before T1; do not require the feature to commit another feature's status. | open |
| F2 | MAJOR | `spec.md:96` (Security — "T2 proves … T3 re-verifies … non-skill parity"), `tasks.md:79-102` (T2 parser), `tasks.md:172-194` (T3 parser), `tasks.md:216` | The spec says the permission surface is protected because T2/T3 re-verify every agent's non-skill permissions against `BASE_SHA`, but neither task does. The T2/T3 parsers only extract the `skill` rules; there is no diff/parse of the remaining `permission` frontmatter, and the T3 unchanged-path diff does not include `.opencode/agents`. A builder could accidentally widen a `bash`, `edit`, `question`, `task`, or `webfetch` permission and every task gate would still pass. | Add a non-skill permission parity check to T2 and T3: compare each agent's frontmatter/permission block with the `skill` rules removed (or the exact non-skill rule sequence) to `BASE_SHA`, and fail on any difference. Record the exact command/output in `build-log-T2.md` and `build-log-T3.md`. | open |
| F3 | MINOR | `tasks.md:79-88` (T2 parser), `tasks.md:172-181` (T3 parser) | The frontmatter parser matches only the exact three-line `- action: skill` / `resource` / `effect` shape. An unmatched `action: skill` rule in another shape (inline map, different spacing, or an extra rule that does not match the regex) would be silently omitted from the parsed sequence, so AC-3's "no other `skill` rules" is not fully proven. | Add an exact count assertion (`grep -c 'action: skill'` equals one deny plus the allowed IDs) or a small YAML/frontmatter parser that enumerates every skill rule; fail on any unmatched skill rule. | open |
| F4 | MINOR | `tasks.md:38-41` (T1 verify) | The current checkout's `.agents/skills` is fully tracked (33 directories/33 `SKILL.md`; no untracked packs), so T1's `git rm -r -- .agents/skills` removes the enumerated set and the `test -z`/`rm -r` sequence works. The earlier untracked-pack condition is resolved; this is closed. | None; keep the final `test -z` and the "rm -r untracked remainder" comment as the fallback. | closed |
| F5 | MINOR | `status.md:28` | The status says "Blockers: None", but the current checkout has the pre-existing `M docs/features/vercel-fly-neon-deployment/status.md` and the untracked `docs/features/project-only-skills/` directory (including `reviews/`). The T1 baseline will record them, but the status's "no blockers" wording and the AC-11 whole-tree clean goal conflict with the actual checkout. | Update the status at the next orchestration step with the pre-existing path baseline and the F1 exclusion; do not claim a whole-tree clean until the feature-owned paths are clean and the T3 staging includes `reviews/**`. | open |
| F6 | INFO | `tasks.md:39` (T1 verify) | The current `skills-lock.json` is clean (no local modification), so the plain `git rm -- skills-lock.json` works; the note's `-f` branch remains a safe fallback if a dirty tree reappears. This is closed for the current checkout. | None; keep the `-f` note for a dirty baseline. | closed |
| F7 | INFO | `docs/architecture/skills.md:1-124` (current), `spec.md:16` | The current policy document says 31 imported packs, while the actual `.agents/skills`/lockfile set is 33 (`neon-postgres`, `deploy-to-vercel` were added later). The rewrite in T2 must use the 33-set and not copy the current 31-row inventory; the spec already states 33. | Keep the rewrite project-only (no inventory) and do not preserve the stale 31 count in History or prose. | open |
| F8 | INFO | `spec.md:126-127` (Q-1/Q-2) | Q-1 (repo-level Context7 entry) and Q-2 (History slug wording) are non-blocking defaults; the spec correctly leaves them out of scope. No action for this gate. | None; keep the environment-level Context7 assumption and the slug-only History wording unless the user decides otherwise. | open |
| F9 | INFO | `.gitignore`, repository root | No `.gitignore`, installer script, or CI reference to `.agents`/`skills-lock` was found in the live tree; the deletion does not leave a discovery/installer hook behind. The historical `agent-skill-migration` artifacts are the only remaining references and are intentionally exempt. | None; the AC-8 live scan is sufficient for the current tree. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | 11 ACs cover deletion, project-skill preservation, agent allow-lists, prompts, docs, live references, supersession, the full gate and the clean finish; the scope inventory lists all 33 packs. |
| Testability | ❌ | F1 makes AC-11 unachievable on the current checkout; F2 leaves non-skill parity unverified; F3 is a smaller assertion gap. |
| Boundaries | ✅ | The deletion is explicitly authorized; deletion is limited to the 33 packs and lockfile; `.opencode/skills`, game code, tests, containers, workflows, deployment config and historical artifacts are excluded. |
| Dependency graph | ✅ | T1 → T2 → T3 is acyclic and sequential; the AC map covers AC-1…AC-11; `files_owned` sets are disjoint. |
| Parallel safety | ✅ | All tasks are `[seq]`; T2 depends on T1 and T3 on T2; no `[P]` markers. |
| Security | ❌ | The deletion reduces the prompt-injection surface and preserves project skills, but the spec's non-skill permission parity claim is not executable (F2); the current dirty baseline (F1) also undermines the permission/clean-tree evidence. |
| Testing | ❌ | The static assertion tier is appropriate, but F1/F2/F3 mean the stated checks do not prove the whole contract; the full lint/typecheck/test/coverage/build gate is correctly included. |
| Consistency | ❌ | The current `.agents`/lockfile count is 33 (the spec says 33; the old `skills.md` says 31), and AC-11's whole-tree clean conflicts with the pre-existing `docs/features/vercel-fly-neon-deployment/status.md` modification and the missing `reviews/**` staging; F1/F7. |
| Real-time | ✅ | Explicitly out of scope; no shared state, connection lifecycle, reconnection or identity change. |
| Containers | ✅ | Explicitly out of scope; `compose.yaml`, `compose.smoke.yaml`, Dockerfiles and the `podman compose up` path are unchanged. |
| Documentation | ✅ | The planned `skills.md` rewrite, `AGENTS.md`/`README.md` edits and `documentation.md` audit cover the policy change; the current `documentation.md` has no stale `.agents`/lockfile reference, and the playbook path resolves. |
| Risks | ❌ | R5 records a dirty worktree but the AC-11 clean-tree rule is absolute; the plan needs the F1 exclusion. The remaining risks (future re-adding, line drift, Context7 config) are acknowledged as non-blocking. |
| Approval checkpoint | ✅ | Q-1 and Q-2 are non-blocking defaults; the deletion itself is explicitly user-authorized, so no additional user gate is required by this feature. |

## Minimum revisions (blocking)

1. **F1** — Reconcile the T3 staging and AC-11 with the current checkout: add `docs/features/project-only-skills/reviews/**` to T3 `commits_also`/staging, record the pre-existing `M docs/features/vercel-fly-neon-deployment/status.md` in `build-log-T1.md`, and scope the final clean-tree assertion to the feature-owned paths (or have the orchestrator resolve the pre-existing status before T1). Do not require the feature to commit another feature's status.
2. **F2** — Add the non-skill permission parity check to T2 and T3: compare each agent's non-skill frontmatter/permission rules to `BASE_SHA` and fail on any difference; record the command and output in the build logs.

## Notes / backlog (non-blocking)

- **F3/F5** are smaller assertion/status fixes: enumerate every `action: skill` rule (not only the regex-matched shape) and update the status "Blockers" wording with the pre-existing `M docs/features/vercel-fly-neon-deployment/status.md` baseline. F4/F6 are closed for the current checkout (all 33 packs are tracked and `skills-lock.json` is clean).
- **The deletion inventory is correct:** `find .agents/skills` shows 33 directories and 33 top-level `SKILL.md` files; `skills-lock.json` has 33 entries; `.agents/` has no non-skill content; `.opencode/skills` has exactly the six project skills. The current agent allows match the spec's "before" counts (planner 3, builder 17, reviewer 4; orchestrator 1 project skill), and the current live references are exactly `AGENTS.md`, `README.md` and `docs/architecture/skills.md`, which T2 rewrites/edits.
- **No current stale reference in `docs/architecture/documentation.md`:** AC-7's empty-diff audit is realistic; the doc still links `docs/architecture/skills.md`, and `.opencode/skills/orchestration-playbook/SKILL.md` exists.
- **The historical `agent-skill-migration` artifacts stay untouched:** AC-9's `git diff` against the feature directory is the right guard; the new spec's `## Supersession note` is present.
- **Q-1/Q-2 are non-blocking:** Context7 is assumed to be environment-level; the History slugs are sufficient; no repo-level MCP or new skill is required for this feature.
- No skill, agent, doc, config or git state was edited by this review; only this review artifact was written.
