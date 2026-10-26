---
feature: docs-on-feature-acceptance
phase: spec
iteration: 1
verdict: changes_requested
blocking: 2
nonblocking: 7
---
# Spec Review — r1

## Summary

❌ **changes requested** — The spec covers the verbatim request (builder updates repository docs on final code-review approval, pinned best practices) across 15 binary ACs, an acyclic T1→T6 graph, and no scope collisions. Two consistency gaps would let a builder either miss a required AC or attempt an edit it lacks permission for: (1) `plan.md`'s pinned best-practices bullet list omits the "update in the same change as the behavior" item that AC-1 requires, and collapses accuracy/minimal differently than AC-1; (2) the best-practices reference's checklist names `docs/features/README.md` as a target but neither the plan's interface nor an AC requires the ownership caveat that D-5 assumes, even though the builder has no write permission on that file. Resolve both before approval; the remaining findings are minor wording/verify-command and open-question housekeeping.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | plan.md § Interfaces / contracts → `docs/architecture/documentation.md` (best-practices section); spec.md § Acceptance criteria (AC-1) | The pinned bullet list in the plan names five bullets — accuracy, minimal diffs, concrete specifics, link validity, glossary updates — and does not name "update in the same change as the behavior", which AC-1 explicitly requires as one of its minimum items. AC-1 also phrases the first item as "keep docs accurate and minimal" while the plan splits accuracy and minimal diffs. A builder following only the plan can ship a reference that fails AC-1 (missing the same-change bullet) or, to satisfy AC-1, add a bullet the plan did not pin and risk an AC-14 "beyond pinned contracts" flag. | Align the two: update plan.md's interface bullet list to include "update documentation in the same change as the behavior" (six bullets minimum) and split accuracy vs. minimal diffs to match AC-1's wording, or rewrite AC-1 to exactly match the plan's five. Pick one source of truth and make the other reference it. | open |
| F2 | MAJOR | plan.md § Interfaces / contracts → `docs/architecture/documentation.md` (checklist section); plan.md § Key decisions (D-5); spec.md § Acceptance criteria (AC-2, AC-13) | AC-2 requires the acceptance-time checklist to name `docs/features/README.md` as an update target, and D-5 defers ownership of that file to the orchestrator. But the plan's pinned interface for `documentation.md` does not require any ownership caveat, and the builder's allowlist (`docs/features/**/build-log*.md` only) does not include `docs/features/README.md`. A builder following the pinned contract could instruct "update `docs/features/README.md`", which the builder cannot perform and which would violate AC-13 (no out-of-scope edits) or fail at permission time. | Add to plan.md's interface for `documentation.md` (and reflect in AC-2/AC-15) a required note: `docs/features/README.md` is orchestrator-owned — the builder proposes changes in the build log / review rather than editing it. Also state in the best-practices section that the checklist targets are "as applicable to the feature", not a blanket rewrite. | open |
| F3 | MINOR | tasks.md T5 (verify command) | T5 verify greps for `"Documentation principles"` case-sensitively, but AC-12 requires the heading case-insensitively. A valid `## documentation principles` heading would fail the pinned verify command even though it satisfies the AC. | Change the verify command to `grep -in "documentation principles"` (case-insensitive) to match AC-12's wording. | open |
| F4 | MINOR | tasks.md T6 (verify command) | T6 verify says `git grep -n "permissions:" -- .opencode/agents/*.md` (unchanged vs. baseline), but the command as written only lists current matches; it does not compare against the build-start baseline, so it cannot actually prove AC-13. | Replace with a diff-based check, e.g. `git diff HEAD -- .opencode/agents/*.md \| grep -n "permissions:"` must be empty, or `git diff -- .opencode/agents/*.md` must show no `permissions:` hunk. | open |
| F5 | MINOR | spec.md § Open questions (Q-1, Q-2, Q-4); plan.md § Open questions | Q-1 (token set sufficiency), Q-2 (feature-index ownership), and Q-4 (reference location) are resolvable now from the artifacts: the AC-1/AC-2 tokens are concrete enough for reviewability; D-5 already decides ownership; D-2 already decides `docs/architecture/documentation.md`. Leaving them open invites the builder to stall on questions the spec has already answered. Q-3 (automated link checker) is genuinely deferred and may stay open as backlog. | Planner resolves Q-1, Q-2, Q-4 in the next revision (record the resolution in the spec/plan open-questions sections and the status loop log) and leaves Q-3 as a deferred non-goal/backlog item. | open |
| F6 | MINOR | spec.md § Non-goals; spec.md § Assumptions; spec.md § Acceptance criteria (AC-13, AC-14) | The spec does not state whether this feature's own acceptance triggers a documentation pass (and which docs it would touch), even though the pass it installs would logically fire on this feature's approval. That leaves an ambiguity against AC-13 (no out-of-scope edits) and AC-14 (diffs limited to the eleven targets). | Add one assumption/non-goal line clarifying that this feature installs the rule and reference only; its own acceptance pass, if run, is limited to verifying the eleven pinned targets and adds no further doc edits beyond those already pinned (or is explicitly deferred to the orchestrator). | open |
| F7 | MINOR | spec.md (no "Container considerations" section); spec.md § Non-goals | The spec has a dedicated "Real-time considerations" section stating out-of-scope, but no equivalent for containers, even though the containerization checklist item requires an explicit out-of-scope statement when a feature does not touch services/images/ports/config/deployables. Non-goals mentions "no container assets", but a dedicated section (mirroring the real-time one) makes the out-of-scope claim unambiguous and reviewable. | Add a short "Container considerations" section (or a sentence in Non-goals) stating that no services, images, ports, configuration, or deployables are touched and that stack/container conventions remain as decided. | open |
| F8 | INFO | tasks.md (T2–T5 markers) | T2–T5 have disjoint `files_owned` and depend only on T1, so they are eligible for `[P]` under the task-decomposition rules; marking them all `[seq]` is safe but serializes work that could run in parallel. Not a defect. | Optional: re-mark T2–T5 as `[P]` if the orchestrator wants parallelism; otherwise leave `[seq]`. | open |
| F9 | INFO | docs/features/docs-on-feature-acceptance/status.md (Task board) | Status task board still reads "(planner to populate)" even though tasks.md exists. Bookkeeping only; no spec-gate impact. | Update the task board in status.md from tasks.md (orchestrator bookkeeping). | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All asks in the request (builder updates docs on final approval, best-practices based) are covered by AC-1…AC-5; institutionalization via reviewer/orchestrator/skills (AC-6…AC-12) is justified by the "defined, reviewable step" user stories. No scope invented beyond those stories. |
| Testability | ✅ | All 15 ACs are binary and inspectable (grep/test/git diff); tokens and thresholds named. F1 notes a token-set mismatch to resolve, not an untestable AC. |
| Boundaries | ✅ | Three tiers present (spec § Boundaries); non-goals listed; out-of-scope explicit. |
| Dependency graph | ✅ | T1→T2→…→T6 linear, acyclic; every AC maps to at least one task (AC-1/2→T1, AC-3/4→T2, AC-5/6/7→T3, AC-8/9→T4, AC-10/11/12→T5, AC-13/14/15→T6); tasks are one builder session each. |
| Parallel safety | ✅ | No `[P]` tasks; all `[seq]`. `files_owned` disjoint across tasks (F8 notes an optional parallelism opportunity, not a violation). |
| Security | ✅ | Docs/config-content only: no runtime, no user-controlled data, no persistence, no secrets, no dependency additions; permissions untouched (AC-13). |
| Testing | ✅ | `npm run coverage` correctly named as not applicable with a justified deviation (no code/tests touched); evidence-per-task inspection strategy defined; edge cases named (baseline drift, wording drift, reference resolution, permission edits, scope creep). |
| Consistency | ❌ | F1 (AC-1 vs. plan bullet mismatch) and F2 (missing orchestrator-ownership caveat for `docs/features/README.md`) must be reconciled; otherwise the builder's work and the reviewer's AC-14 diff check will disagree. |
| Real-time | ✅ | Explicitly out of scope (spec § Real-time considerations); no shared/cross-client state touched. |
| Containers | ✅ | No services/images/ports/config/deployables touched; stack/container conventions unchanged (F7 asks for a dedicated section, not a substantive change). |

## Previous round verification (if iteration > 1)

n/a — iteration 1.

## Notes / backlog (non-blocking)

- Recommendations for open questions: resolve Q-1, Q-2, Q-4 now (F5); keep Q-3 as a deferred future feature (automated link checker) — consistent with non-goal "no automated documentation linting".
- Q-2 ownership clarification (F2) should also be echoed in the best-practices reference's checklist wording so a future builder does not treat `docs/features/README.md` as directly editable.
- The acceptance-time doc pass is a post-approval step, not a new state (D-1); the playbook amendment should make clear that the feature remains in `code_review` while the pass runs and only transitions to `accepted` once evidence is recorded, to avoid implying a new state.
- Wishlist only (not required): a future feature may add an automated documentation link checker (Q-3) and universal agent discovery via `AGENTS.md`/`.opencode/` prompts; both are out of scope here.