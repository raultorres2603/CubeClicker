---
feature: manual-deploy-trigger
phase: spec
iteration: 1
verdict: changes_requested
blocking: 1
nonblocking: 8
---

# Spec Review — r1

## Summary

❌ changes requested — 1 MAJOR (AC-9's `id-token: write` scope sub-check has no pinned verify command in any task, so that sub-AC cannot be evidenced as written) plus 6 MINOR verification/wording gaps. The trigger change, AC coverage, DAG, parallel safety, security, and open questions are otherwise sound and consistent with the `aws-deploy-pipeline` contract.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | tasks.md T1 `verify:` (acceptance AC-9) and tasks.md T-final `verify:` | AC-9 requires `grep -n "id-token: write" .github/workflows/deploy.yml` scoped to the deploy jobs, but neither T1 nor T-final pins that grep in its `verify:` list. T1 claims acceptance of AC-9 and T-final claims AC-1–AC-10, yet no task runs the anchor, so the sub-check cannot be evidenced by a recorded command (unverifiable AC as specified). | Add `grep -n "id-token: write" .github/workflows/deploy.yml` (with an inspection note that matches fall only inside the `build-and-push`/`infra`/`deploy-services` job permission blocks, never at workflow level) to T1 `verify:` and T-final `verify:`; record raw output in the build logs. | open |
| F2 | MINOR | tasks.md T2 `verify:` | The anchor `grep -c "no provider is chosen" docs/architecture/deployment.md` (unchanged, 0) targets a file that never contained that phrase, so the check is vacuous and cannot evidence anything. (The analogous aws-feature check targets `stack.md`/`containerization.md`, which are out of scope here.) | Remove this grep from T2 `verify:`, or replace it with a meaningful deployment.md anchor (e.g., absence of the stale "push to `main`" trigger wording). | open |
| F3 | MINOR | spec.md § Acceptance criteria AC-10; tasks.md T-final `verify:` | AC-10's evidence command `git diff --name-only` does not surface untracked new files, so the build-log portion of the allowed-file set cannot be evidenced by that command (only the three tracked files would appear). The tracked-file portion is fine. | In T-final `verify:`, either stage the build logs before running `git diff --name-only`, or add `git status --porcelain` to evidence the untracked set; document which command covers which set. | open |
| F4 | MINOR | spec.md § Summary | The Summary states the gates "re-run on the merge commit immediately before any deploy"; on a manual `workflow_dispatch` trigger the selected ref need not be a merge commit (Q-1 assumes the triggering ref's tip SHA). | Reword to "re-run on the selected ref (typically the merge commit on `main` for the default flow) immediately before any deploy". | open |
| F5 | MINOR | tasks.md T1 `verify:`; spec.md non-goals / D-2 | The non-goal "no `workflow_dispatch` input" (D-2) has no verify anchor; T1's verify does not check that `workflow_dispatch` carries no `inputs:` block, so the minimal-trigger contract is asserted but not evidenced. | Add a verify anchor to T1 (e.g., inspection note / `grep` that `inputs:` does not appear under `workflow_dispatch`), recorded in `build-log-T1.md`. | open |
| F6 | MINOR | spec.md § Acceptance criteria AC-6; tasks.md T2 `verify:` | AC-6 requires a note that CD is manual because only the `production` environment exists, but T2's only README anchor is the loose `grep -n "workflow_dispatch\|manual" README.md`. No precise reason-phrase anchor is pinned, so the note could be missing while the grep still passes. | Add a reason-phrase grep to T2 `verify:` (e.g., `grep -ni "manual.*production\|only.*production environment" README.md`) and record it. | open |
| F7 | MINOR | spec.md § Boundaries / Assumptions; tasks.md | Unlike the `aws-deploy-pipeline` spec (AC-21(f)), this spec does not state that the acceptance documentation pass will propose the `docs/features/README.md` row (orchestrator-owned index). The omission leaves the doc-gate integration implicit. | Add a one-line note in Boundaries/Assumptions that the acceptance doc pass proposes the `docs/features/README.md` row per `docs/architecture/documentation.md`, consistent with the aws feature. | open |
| F8 | INFO | spec.md § Open questions | Q-1 (no `workflow_dispatch` input; rely on GitHub's ref selector + `github.sha`) and Q-2 (verify re-runs all gates on manual trigger) are well-posed, each with a stated default, rationale, and follow-up boundary. No action. | None. | open |
| F9 | INFO | spec.md § Acceptance criteria AC-5/AC-6; tasks.md T2 `verify:` | AC-5/AC-6 reason-phrase anchors are presence-based (house style, matching the aws feature). Stronger section-context/line-range checks would reduce false positives but are not required. | Optional: tighten anchors at build time; no spec change required. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Raw request fully covered (CI auto on push/PR via AC-4; CD manual via AC-1; reason documented via AC-5/AC-6); non-goals explicit and consistent with `aws-deploy-pipeline`. |
| Testability | ❌ | Most ACs are binary grep/inspection anchors; AC-9's `id-token: write` scope sub-check has no pinned verify command (F1). AC-5/AC-6 anchors are presence-based (F9). |
| Boundaries | ✅ | Three tiers present (Always/Ask first/Never); out-of-scope list explicit. |
| Dependency graph | ✅ | Acyclic `T1 → T2 → T-final`; dependencies point forward; every AC mapped to at least one task; tasks sized to one builder session. |
| Parallel safety | ✅ | All tasks `[seq]`; `files_owned` disjoint (deploy.yml / deployment.md+README.md / build log). No `[P]` misuse. |
| Security | ✅ | No secrets introduced; SHA-pinned actions retained (T1 leaves jobs untouched); OIDC unchanged; no new credentials; credential audit pinned (AC-9/AC-15-equivalent). |
| Testing | ✅ | actionlint wrapper on changed workflow (AC-7), Terraform wrapper regression (AC-8), coverage gate (T-final `npm run coverage`) all pinned; minor evidence-command gaps (F2, F3, F5, F6). |
| Consistency | ✅ | Aligns with `aws-deploy-pipeline` (supersedes only the trigger sentence of AC-12; other AC-12 content in force); no contradiction with AGENTS.md. |
| Real-time | ✅ (N/A) | Explicitly out of scope with justification; WebSocket edge untouched (containerization/real-time impact section present). |
| Containers | ✅ (N/A) | Explicitly out of scope with justification; no services/images/ports/config added. |

## Previous round verification (if iteration > 1)

N/A (iteration 1).

## Notes / backlog (non-blocking)

- The misplaced `grep -c "no provider is chosen" docs/architecture/deployment.md` (F2) is a copy-paste artifact from the aws feature's T14 verify; the substantive deployment.md anchors (workflow_dispatch present; single production/staging reason present) remain in T2.
- The documentation pass on acceptance (per `docs/architecture/documentation.md`) should also propose the `docs/features/README.md` row for this feature (F7); the orchestrator owns the index.
- Q-1/Q-2 defaults (none / yes) are recorded in `status.md` blockers/open questions and in spec.md § Open questions; confirm or override at approval.