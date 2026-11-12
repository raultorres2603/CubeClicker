---
feature: agent-skill-migration
phase: spec_review
round: 3
iteration: 3
verdict: approved
reviewed: 2026-11-12
blocking: 0
nonblocking: 2
---
# Spec Review — r3

## Summary
✅ approved — 0 blocking, 2 MINOR, 2 INFO. F1-r2 is fully resolved: the acceptance sequence is now strictly one-directional. The orchestrator makes every acceptance edit before T5 (`status.md` state `accepted` with a loop-log entry, exactly one `agent-skill-migration` accepted row dated from that entry, and the task-board update); T5 only verifies and commits; AC-14/AC-15 and plan step 6 forbid post-T5 edits; the orchestrator confirms the documentation pass without editing.

The r2 MINORs are fixed or explicitly addressed: AC-10 is scoped to T4 and AC-15 owns the four-row final README diff; T1 moves `.agents/skills/**` and `skills-lock.json` to `commits_also`; the T1 lockfile script asserts version 2; T4 records its content-commit stat audit and adds an evidence commit; T5 derives the acceptance date from the status loop log and checks the final README diff; the smoke pass message is labelled non-proof; the non-skill permission guard compares all four agents to `BASE_SHA`; rollback uses recorded symbolic SHAs; and the orchestrator-prompt conflict is documented as Q-8 (deferred, no permission widened). The two MINORs are build-time audit observations, not blockers.

The plan is implementable by the declared owners: T1/T2/T4/T5 are builder-owned with shell and edit permissions for their paths; T3 is the orchestrator's permitted README edit. T1 closes the data-loss window by committing the 31 packs/lockfile before any doc edit and the plan forbids `git clean`/worktree-wide restores, so the 18 untracked packs cannot be lost. T2 restores/updates the live docs and agents, and AC-9 plus T4's re-run prevent stale `.opencode/skills` references.

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1-r3 | MINOR | `tasks.md:286`, `tasks.md:290`, `spec.md:48` | T4 records the **content** commit's `git show --stat` in the build log, but after the second (evidence) commit it records only `T4_EVIDENCE_SHA`. AC-14 says each feature commit's `git show --stat` lists only `files_owned` plus `commits_also`; the evidence commit's stat is not recorded, only asserted in the Notes. | Also record `git show --stat --oneline HEAD` for the T4 evidence commit in `build-log-T4.md` (its stat should be only `build-log-T4.md`), or make the Notes' assertion a recorded check. Build-time note; the content commit's stat is already recorded. | open |
| F2-r3 | MINOR | `tasks.md:354`, `tasks.md:360-388`, `spec.md:49` | AC-15 and T5's verify require the orchestrator to update the task board before T5, but the acceptance checks verify only the status state, the acceptance loop-log date, the README row, and the final README diff. A stale `[ ]` task board would pass T5. | Add a small check such as five checked `T1`–`T5` board entries in `status.md` (or record the board state in `build-log-T5.md`), or explicitly state that the orchestrator's board update is reviewed manually at acceptance. Build-time note. | open |
| F3-r3 | INFO | `tasks.md:103-149`, `tasks.md:18-23`, `spec.md:37` | The T2 allow-list checker validates the exact skill rule sequence and last-match semantics, but it does not explicitly assert that every project ID in the expected set resolves to a file; T1's six `SKILL.md` count, the inventory check's `allowed` set, and the duplicate-ID check cover the property across tasks. | Carry to the build review: confirm the project IDs resolve from T1's `git ls-files` count and the inventory check, or add an explicit resolution loop to the T2 checker. No spec change required. | open |
| F4-r3 | INFO | `tasks.md:360-388`, `spec.md:44` | The T5 final README diff hardcodes the three AC-10 row dates (`2026-10-30`). This is intentional (Q-4) and T4 derives those dates, but if a source `status.md` changes between T4 and T5, T5 fails rather than silently accepting drift. | Carry to the build review: if T5 fails on a date mismatch, re-run T4's derivation or report `blocked`; do not hand-edit the dates. No spec change required. | open |

## Previous round verification
| Finding | Status | Evidence |
| --- | --- | --- |
| F1-r2 T5 acceptance sequence | fixed | T5 verify `tasks.md:354` requires the accepted state, row, and task board **before** the commit; T5 Notes `tasks.md:358` forbid post-T5 edits; plan step 5/6 `plan.md:103-104` and AC-15 `spec.md:49` are one-directional. |
| F2-r2 AC-10 vs AC-15 | fixed | AC-10 is scoped to T4 before the acceptance row (`spec.md:44`); AC-15 owns the four-row final README diff (`spec.md:49`); T5 checks exactly four added rows (`tasks.md:369-387`). |
| F3-r2 T1 files_owned semantics | fixed | T1 now lists `.agents/skills/**` and `skills-lock.json` under `commits_also` (`tasks.md:21`); shared conventions define `files_owned` as creates/edits/restores and `commits_also` as staged-not-edited (`tasks.md:14`, `plan.md:95`). |
| F4-r2 lockfile version 2 | fixed | T1 asserts `head.version !== 2` or `wt.version !== 2` fails (`tasks.md:38`); I ran the script against the live tree and it reported version 2 plus the 31/13/provenance checks passing. |
| F5-r2 T4 stat audit | fixed with residual | T4 records the content-commit stat and `T4_CONTENT_SHA`; the evidence commit's stat is asserted in the Notes but not recorded (F1-r3). |
| F6-r2 T5 loop-log/date | fixed with residual | T5 extracts `ACCEPT_DATE` from the acceptance loop-log line and uses it in the README row regex (`tasks.md:362-367`); the final four-row diff is checked (`tasks.md:369-387`). The task-board update has no check (F2-r3). I tested the loop-log date extraction with a synthetic acceptance line; it returns `2026-11-12`, and a bare `state: accepted` line does not match. |
| F7-r2 smoke pass message | fixed | The pass message is now "expected strings present; not tool-call proof (static resolution remains authoritative)" (`tasks.md:345`), and the prose explicitly says it is not a `skill` tool-call proof (`tasks.md:348`). |
| F8-r2 non-skill permission guard | fixed | T2 compares every agent's non-skill rules to `BASE_SHA` (`tasks.md:151-180`); I ran it against the live tree and it printed `non-skill permissions unchanged from BASE_SHA for all four agents`. |
| INFO rollback placeholders | fixed | The SHA contract says rollback uses `T1_PACK_SHA`/`T4_CONTENT_SHA`/`T4_EVIDENCE_SHA` (`plan.md:94`); rollback prose uses those names with no angle brackets (`plan.md:171-172`). |
| INFO orchestrator prompt | fixed as deferral | Q-8 documents the prompt-vs-permission conflict and defers the prompt text change (`spec.md:91`, `plan.md:185-187`); no permission is widened. |
| D-5 count | fixed | The plan reports the correct total/imported counts per agent (`plan.md:42-47`, `plan.md:140`). |

## Checklist results
| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | The audit is covered; the later "all of them" items remain explicit non-goals. |
| Testability | ✅ | Every AC has a pinned check; F1-r3/F2-r3 are small audit-recording gaps, not unverifiable ACs. |
| Boundaries | ✅ | `files_owned` plus `commits_also` is consistent; the builder stages but never edits the bookkeeping paths. |
| Dependency graph | ✅ | T1 → T2 → T3 → T4 → code review → T5 is acyclic; every AC maps to a task (`tasks.md:390-408`). |
| Parallel safety | ✅ | All tasks are `[seq]`; no `[P]`; no shared-file contact. |
| Security | ✅ | Allow-list effect/order and non-skill permission guards are present; the credential scan is broadened and passes; no secret or script auto-execution surface is added. |
| Testing | ✅ | Static checks are the right tier for a content/config change; regression gates run in T4; the smoke is explicitly supplementary. |
| Consistency | ✅ | The T5 one-directional sequence, AC-10/AC-15 scope, T1 `commits_also`, and SHA names are consistent; F1-r3/F2-r3 are recording nits. |
| Pipeline/permissions | ✅ | T1/T2/T4/T5 are builder-owned; T3 is the orchestrator's permitted edit; Q-8 records the prompt deferral; no task requires an impossible agent action. |
| Real-time | ✅ N/A | No shared/cross-client state or connection-lifecycle change. |
| Containers | ✅ N/A | No service, image, port, route, or container change; `npm run smoke` remains correctly omitted; AC-12 pins the container/root files. |

## Approval and build-phase notes
- **Approved.** No BLOCKER or MAJOR remains. The plan is implementable by the declared owners and cannot lose the 18 untracked packs: T1 commits the packs/lockfile before any doc edit, the staged-diff check accepts additions only, and `git clean`/worktree-wide restores are forbidden.
- **Carry F1-r3 into the build:** record the T4 evidence commit's `git show --stat` in `build-log-T4.md`; the content commit's stat is already recorded. The code reviewer should run `git log --stat BASE_SHA..HEAD` once for the whole commit chain.
- **Carry F2-r3 into the build:** confirm the status.md task board is fully checked at acceptance, or add a T5 board check; the current T5 checks cover state/loop-log/README but not the board.
- **Carry F3-r3/F4-r3 as cross-checks:** the project-ID resolution is covered by T1/inventory; the T5 hardcoded AC-10 dates are intentional — a status-date change between T4 and T5 must be reported as `blocked`, not hand-edited.
- **Preserve the one-directional acceptance rule:** the orchestrator makes all acceptance edits before T5; T5 verifies/commits; no post-T5 edits. If the orchestrator needs a change after T5, stop and escalate rather than dirtying the tree.
- **Preserve the data-loss guard:** T1 runs first, restores and commits in one session, and never runs `git clean`; T2/T4/T5 use explicit path staging.

## Verification evidence (this review)
- T1 lockfile/provenance script ran against the live tree: 31 IDs match 31 directories, 13 pre-existing entries unchanged, version 2, 108 insertions/0 deletions.
- T2 non-skill permission guard ran against the live tree: all four agents unchanged from `HEAD`.
- T5 loop-log date extraction tested with a synthetic acceptance line: returns `2026-11-12`; a bare `state: accepted` line does not match.
- Status dates are `building`/`accepted`/`accepted` with latest `2026-10-30`; the README anchors are at the expected positions; the status task board lists T1–T5 consistently.
- `git status --porcelain` shows only the pre-existing 18 deletions and the lockfile modification; no tracked files were changed by this review.
