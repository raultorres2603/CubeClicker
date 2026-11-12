---
feature: agent-skill-migration
phase: spec_review
round: 2
iteration: 2
verdict: changes_requested
reviewed: 2026-11-12
blocking: 1
nonblocking: 7
---
# Spec Review — r2

## Summary
❌ changes requested — 1 MAJOR, 7 MINOR, 2 INFO. The r1 MAJORs F1–F3 are fully resolved: T3 is now an orchestrator-only edit and T4 is the builder-owned verification/commit task; the allow-list checker binds `resource` and `effect`, enforces the exact sequence, and evaluates last-match semantics; and AC-4 now pins two machine-readable tables with a matching inventory/disposition checker. F4 is structurally resolved — T4 and T5 now have explicit `commits_also` bookkeeping commits and clean-tree checks — but the **T5 acceptance sequence is now self-contradictory** (F1-r2), so the acceptance half of F4 is not yet implementable as written.

F5–F13 and the D-5 count are addressed: `BASE_SHA`/`INDEX_BASE_SHA` are pinned and read from build logs; the T4 row check is exact-row/date/position/additive-only; AC-8 has scoped `.opencode/skills` and README § Stack checks; the credential scan is broadened and passes on the live tree; the smoke is explicitly supplementary with static authority; A-4, the build-log inventory, the Boundaries/`commits_also` contract, the `baseline-ui` classification, and the lockfile provenance checks are fixed. The remaining MINORs are verification nits and one ownership-contract inconsistency.

The migration remains safe for the 18 untracked packs: T1 merges restore and tracking, stages the packs/lockfile before any doc edit, and the plan bans `git clean` and worktree-wide restores. No task can leave stale `.opencode/skills` references: T1 restores, T2 updates the docs/agents, and AC-9 plus the T4 re-run check live paths.

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1-r2 | MAJOR | `tasks.md:321`, `tasks.md:325`, `plan.md:103-104`, `spec.md:48-49` | T5's verify requires the orchestrator to have already set `status.md` to `accepted` and added the `agent-skill-migration` README row before the builder commits. The T5 Notes instead say the orchestrator keeps the feature in `code_review` while T5 runs and transitions to `accepted` afterwards, and plan step 6 says the orchestrator updates the status loop log after T5. If the Notes/step 6 are followed, T5's acceptance checks fail because the state is still `code_review`; if the post-T5 status update happens, the tree is dirty after the T5 commit and AC-14/AC-15's clean-tree invariant fails. | Make the sequence explicit and one-directional: after code-review approval, the orchestrator sets `status.md` to `accepted` with the acceptance loop-log entry and adds the README row **before** T5; T5 verifies the accepted state and commits; no post-T5 status edits — the orchestrator confirms the documentation pass without editing, or a T6 commit covers any needed post-acceptance edit. Remove the "keeps the feature in code_review while T5 runs, then transitions" sentence and the post-T5 "updates the status loop log if needed" step. | open |
| F2-r2 | MINOR | `spec.md:40-44` (AC-10), `spec.md:49` (AC-15), `tasks.md:259-302`, `tasks.md:327-333` | AC-10 says the diff against `INDEX_BASE_SHA` contains exactly the three pre-existing feature rows and no other changes. AC-15 adds the `agent-skill-migration` accepted row at acceptance, a fourth addition against the same base. The T4 check is scoped pre-acceptance, but AC-10's text is not; a reviewer applying AC-10 at acceptance would find a contradiction. | Scope AC-10 to T4/pre-acceptance ("before the acceptance row is added") or state that the AC-15 row is the only later addition; optionally add a T5 check that the final README diff is the three rows plus the one accepted row. | open |
| F3-r2 | MINOR | `tasks.md:14`, `tasks.md:20`, `tasks.md:25`, `plan.md:95` | The shared conventions and the plan's Bookkeeping commit contract say `files_owned` lists paths a task edits and `commits_also` lists paths staged/committed without editing, and that only T4/T5 have `commits_also`. T1 lists `.agents/skills/**` and `skills-lock.json` in `files_owned` but only stages them (no content edits), and has no `commits_also`. | Add a T1 `commits_also` for `.agents/skills/**` and `skills-lock.json` with a note that they are staged, not edited, or redefine T1's `files_owned` as restored/staged/owned and update the shared convention so the contract is unambiguous. | open |
| F4-r2 | MINOR | `spec.md:26` (AC-3), `tasks.md:31-50` | The T1 lockfile/provenance script checks the 13/31 ID counts, deep-equal existing entries, and zero deletions, but it does not assert `version === 2` for either `HEAD` or the working tree. AC-3 requires `version: 2`; a version change would pass the script. | Assert `head.version === 2 && wt.version === 2` in the T1 script. | open |
| F5-r2 | MINOR | `spec.md:48` (AC-14), `tasks.md:253`, `tasks.md:321` | AC-14 requires each feature commit's `git show --stat` to list only `files_owned` plus `commits_also`. T5 runs and records `git show --stat --oneline HEAD`, but T4's verify does not run or record the stat audit for its own commit. | Add `git show --stat --oneline HEAD` after T4's commit and record it in `build-log-T4.md`. | open |
| F6-r2 | MINOR | `tasks.md:327-333`, `spec.md:49` (AC-15) | T5's acceptance check uses `grep -n 'accepted' status.md`, which can match the `state: accepted` line or a task-board note; it does not prove an acceptance loop-log entry. The README row date is also not compared to the status loop-log date. | Add a loop-log-specific check (for example a `^- YYYY-MM-DD — .*accepted` line) and compare the README acceptance date to the latest accepted loop-log date. | open |
| F7-r2 | MINOR | `tasks.md:304-315`, `plan.md:148` (D-13), `spec.md:47` (AC-13) | The optional smoke check passes when the JSON output contains `"skill"` and both IDs, but that does not prove `skill` tool invocations. Its pass message says "smoke shows skill tool invocations," contradicting D-13's statement that a repeated phrase does not prove a `skill` tool call. | Parse actual JSON tool-call events (tool name `skill` with the loaded ID), or change the pass message to "expected strings present; not tool-call proof" and keep the static result authoritative. | open |
| F8-r2 | MINOR | `spec.md:71` (Security), `tasks.md:95` (T2 verify), `tasks.md:101-147` | The T2 checker verifies only the `skill` rule sequence. The Security section says no shell, edit, question, or subagent permission is widened; a change to a non-skill permission would pass the checker. | Compare the non-skill `permissions` entries of the three edited agents to `BASE_SHA` (or the pre-T2 state) and record the diff, or explicitly state that the code-review diff is the control for non-skill permissions. | open |

## Previous round verification
| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) T4 owner cannot verify/commit | fixed | T3 is orchestrator edit-only (`tasks.md:228-247`); T4 is builder-owned verification/commit (`tasks.md:249-315`); plan ownership table (`plan.md:71-77`). |
| F2 (r1) allow-list effect/order unchecked | fixed | T2 checker parses `action`/`resource`/`effect`, compares the exact sequence, and evaluates last-match for every known ID (`tasks.md:101-147`); I tested the parser against the live agent files. |
| F3 (r1) AC-4 inventory/disposition unchecked | fixed | AC-4 now specifies 31-row and 14-row machine-readable tables (`spec.md:27-30`); T2 checker validates headers, IDs, sources, dispositions, categories, and reasons (`tasks.md:149-201`); Q-6's `baseline-ui` classification now matches the excluded table (`spec.md:89`). |
| F4 (r1) feature/acceptance artifacts unowned | partially fixed | T4/T5 `commits_also` and clean-tree checks added (`tasks.md:251-253`, `tasks.md:319-321`, AC-14/15); new T5 sequence contradiction remains (F1-r2). |
| F5 (r1) undefined SHA placeholders | fixed | `BASE_SHA`/`INDEX_BASE_SHA` contract (`plan.md:94`, `tasks.md:16`); T4 reads both with `sed`; no placeholders in verify commands. |
| F6 (r1) non-row-scoped T4 checks | fixed | T4 exact-row/date/position/additive-diff check (`tasks.md:259-302`); I verified the status dates and README anchors on the live tree. |
| F7 (r1) AC-8 checks incomplete | fixed | AC-8 now scoped (`spec.md:38`); T2 checks both AGENTS.md locations and README § Stack (`tasks.md:210-218`). |
| F8 (r1) narrow credential scan | fixed | T1 node scan covers `.env*`, private keys, provider token prefixes, named env vars, and credential assignments (`tasks.md:54-85`); it prints clean on the live tree. |
| F9 (r1) smoke not evidence-able | fixed with residual | Static resolution is authoritative and the smoke is supplementary (`spec.md:47`, `plan.md:148`); pass-message overclaim remains (F7-r2). |
| F10 (r1) A-4/T1 commit contradiction | fixed | A-4 now says T1 makes two commits and no skill-content commit (`spec.md:96`); T1 notes align (`tasks.md:25`). |
| F11 (r1) missing `build-log-T2.md` | fixed | Plan inventory lists T1/T2/T4/T5 logs (`plan.md:122-125`); T3 has no log because it is edit-only. |
| F12 (r1) Boundaries vs T5 staging | fixed | Boundaries now allow `files_owned` plus `commits_also` (`spec.md:63,65`); plan defines the bookkeeping contract (`plan.md:95`); T1 semantic nit remains (F3-r2). |
| F13 (r1) lockfile provenance unchecked | fixed with residual | T1 deep-equals the 13 existing entries and requires zero deletions (`tasks.md:31-52`); version-2 check missing (F4-r2). |
| D-5 count | fixed | Plan now reports total counts per agent (`plan.md:42-47`, `plan.md:140`). |

## Checklist results
| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | The audit is covered; the later "all of them" items remain explicit non-goals. |
| Testability | ❌ | F2-r2, F4-r2, F5-r2, F6-r2, F7-r2: several acceptance checks are weak or scoped ambiguously. |
| Boundaries | ✅ | `commits_also` and the builder-stages-never-edits rule are clear; T1's `files_owned` semantics are a minor contract nit (F3-r2). |
| Dependency graph | ✅ | T1 → T2 → T3 → T4 → code review → T5 is acyclic; every AC maps to a task (`tasks.md:335-353`). |
| Parallel safety | ✅ | All tasks are `[seq]`; no `[P]`; no shared-file contact. |
| Security | ✅ | Allow-list effect/order is now mechanically checked; credential scan is broadened and passes; non-skill permission control is a minor residual (F8-r2). |
| Testing | ❌ | Static-check strategy is appropriate, but F4-r2/F5-r2/F6-r2/F7-r2 leave acceptance evidence incomplete. |
| Consistency | ❌ | F1-r2 (T5 sequence), F2-r2 (AC-10/AC-15), F3-r2 (files_owned), F7-r2 (smoke claim vs D-13). |
| Pipeline/permissions | ❌ | F1-r2 is a pipeline/acceptance-sequencing contradiction; T3's orchestrator edit is permitted, but the orchestrator prompt line 44 still says it must not use write tools (INFO). |
| Real-time | ✅ N/A | No shared/cross-client state or connection-lifecycle change. |
| Containers | ✅ N/A | No service, image, port, route, or container change; `npm run smoke` remains correctly omitted; AC-12 pins the container/root files. |

## Minimum remaining revisions
1. **Resolve F1-r2 (the only blocking finding).** Choose one acceptance sequence and make T5, the plan, and AC-14/AC-15 agree: the orchestrator sets `status.md` to `accepted` with the acceptance loop-log entry and adds the README row **before** T5; T5 verifies and commits; no post-T5 status edits. Remove the T5 Notes sentence about keeping the feature in `code_review` and the plan step 6 post-T5 "updates the status loop log if needed," or add a T6 commit for any post-acceptance edit. The T5 verify already encodes the correct pre-T5 state; the Notes and plan step 6 are the outliers.
2. **Non-blocking corrections (fix or explicitly rebut in the same revision).** F2-r2 (scope AC-10), F3-r2 (T1 `commits_also`), F4-r2 (lockfile version 2), F5-r2 (T4 stat audit), F6-r2 (T5 acceptance loop-log/date), F7-r2 (smoke pass message), and F8-r2 (non-skill permission control). None blocks approval once F1-r2 is fixed, but the planner's revision mode requires every finding to be fixed or explicitly rebutted.

## Notes / backlog (non-blocking)
- **Verified live.** The T1 lockfile/provenance script passes against the current tree (`31 lockfile IDs match 31 directories; 13 pre-existing entries unchanged`; 108 insertions, 0 deletions); the T1 credential scan prints clean; the T2 allow-list parser correctly extracts the current rule sequences; the status dates are `building`/`accepted`/`accepted` with latest `2026-10-30`; the README anchors exist at the expected positions; `npm run typecheck` exits 0 and ESLint on the only vendored TypeScript example exits 0.
- **No data-loss or stale-reference regression.** T1 restores the six pipeline skills and commits the 31 packs/lockfile before any doc edit; the plan prohibits `git clean`, `git checkout -- .`, and worktree-wide restores; T2 updates the agents/docs; AC-9 and the T4 re-run check live `.opencode/skills/...` references. The empty `aws-free-tier-infra/` and `remote-cube-action-sync/` directories still correctly receive no feature-index row.
- **INFO — rollback placeholders.** The SHA contract says no angle-bracket placeholders remain in any command (`plan.md:94`), but the rollback notes still use `<T1-pack-sha>` and `<sha>` (`plan.md:170-171`). These are rollback examples, not pinned verify commands; consider replacing them with `T1_PACK_SHA`/`<commit>` wording or narrowing the contract sentence.
- **INFO — orchestrator prompt.** T3 relies on the orchestrator's `edit` permission for `docs/features/README.md` (`spec.md:100` A-8, `plan.md:75`), while `.opencode/agents/orchestrator.md:44` still says the orchestrator must not use read/write/execute tools directly. The permission model and the established `docs-on-feature-acceptance` policy make T3 executable, but the prompt should be reconciled in a future change so the declared owner and its instructions agree.
