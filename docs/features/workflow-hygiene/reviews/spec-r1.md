---
feature: workflow-hygiene
phase: spec
iteration: 1
verdict: approved
blocking: 0
nonblocking: 7
---

# Spec Review — r1

## Summary

✅ approved — The spec is complete, internally consistent, and testable: all ten ACs (AC-1…AC-10) are binary, mapped to tasks, and covered by the pinned verification strategy (trailing-newline byte checks, actionlint, Terraform fmt/validate wrappers, scoped credential audit, SHA-pin audit, coverage gate, scope audit). The DAG is acyclic with disjoint `files_owned` and correct `[P]`/`[seq]` markers. Security posture (SHA pins, OIDC, no secrets, scoped audit) is preserved and documented. Non-goals enumerate every deferred backlog item (verify-anchor false positives, upstream Mailpit defect, user-side AWS assets, F22 podman-vs-Docker ARG nuance, F5 doc-only hit, historical-artifact non-rewrite). Open questions Q-1 and Q-2 are well-posed with defaults and alternatives. Only non-blocking documentation-accuracy and evidence-completeness nits remain (7 MINOR/INFO).

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | spec.md § Non-goals (line ~47) | The non-goal "optional anchor tightenings" cites `F10/F11 (manual, MINOR)`, but the `manual-deploy-trigger` review artifacts contain no F10/F11 (spec review r1 has F1–F9; code review r1 has F1–F5). The numbers do not resolve to any artifact, so a reader cannot trace them. The described substance (optional anchor tightenings applied where cheap) is nonetheless clear. | Correct the cross-references: keep `F8/F9 (manual, INFO)` for the spec-review info items and drop/replace the fabricated `F10/F11` with the actual code-review anchors (manual F1–F3 MINOR verify-anchor false positives are already covered by the preceding non-goal bullet; F4–F5 are INFO). Or remove the numbers and describe the items in prose. | open |
| F2 | MINOR | spec.md § Acceptance criteria AC-8; tasks.md T2 `verify:`; tasks.md T-final `verify:` | AC-8 requires `grep -E 'uses: .*@v[0-9]+' .github/workflows/ci.yml .github/workflows/deploy.yml` (no match) over **both** files, but T2 only runs the grep on `deploy.yml`, T1 does not run it on `ci.yml`, and T-final's `verify:` list omits the SHA-pin grep entirely. The property is preserved by construction (single-byte append) and actionlint passes, but the combined both-files anchor is not pinned in any task's verify, so it cannot be evidenced as written. | Add `grep -E 'uses: .*@v[0-9]+' .github/workflows/ci.yml .github/workflows/deploy.yml` (must print nothing) to T-final `verify:` (and optionally to T1 for `ci.yml`), and record raw output in `build-log-T-final.md`. | open |
| F3 | MINOR | spec.md § Assumptions (line ~96) | The assumption states the `workflow-hygiene` row is "already present in the index via the orchestrator's bootstrap", but `docs/features/README.md` currently contains no `workflow-hygiene` row (verified by inspection). The row will need to be added by the orchestrator (or proposed during the acceptance documentation pass) before acceptance; stating it as already-present is factually inaccurate. | Reconcile: either have the orchestrator bootstrap the row now, or reword the assumption to "the row will be proposed in the acceptance documentation pass per `docs/architecture/documentation.md` (orchestrator-owned index)", consistent with the manual-deploy-trigger precedent (F5). | open |
| F4 | MINOR | docs/features/workflow-hygiene/status.md (task board) | The status.md task board is out of sync with tasks.md: T1 is described as covering both `ci.yml` and `deploy.yml` (tasks.md splits T1=`ci.yml`, T2=`deploy.yml`), and T3 is described as "Refresh verify anchors in deployment.md" (tasks.md T3 is "Document the scoped credential-audit command"). Descriptions differ materially. | Align the status.md task board with tasks.md (T1 trailing newline ci.yml; T2 trailing newline deploy.yml; T3 scoped audit command in deployment.md; T-final verification sweep). Orchestrator-owned; apply on the next status update. | open |
| F5 | INFO | spec.md § Assumptions (line ~95) | The assumption says the builder's permissions cover `.github/**` and `docs/**`. The actual allowlist in `.opencode/agents/builder.md` scopes docs edits to `docs/architecture/**` (line 56) and `docs/features/**/build-log*.md` (line 20), not `docs/**` generally. The in-scope files (`docs/architecture/deployment.md`, the build logs) are covered, so no permission-bootstrap is needed; the wording is just broader than reality. | Reword to name the actual covered paths (`docs/architecture/**`, `docs/features/**/build-log*.md`, `.github/**`), matching the aws-deploy-pipeline route (a) precedent. Cosmetic. | open |
| F6 | INFO | spec.md § Security considerations; plan.md D-2 | The scoped audit excludes all of `docs/` via `:(exclude)docs/`, which is broader than the benign references under `docs/features/**`. A real AWS credential accidentally committed under `docs/` would not be flagged. The trade-off is documented and Q-1 offers the narrower `src/ infra/ .github/` alternative; the default is defensible (simple, future-proof, still audits every non-doc tracked file). | None required; optionally annotate in `deployment.md` that the exclusion is intentional because review/build-log artifacts quote the audit pattern, and that a broader leak hunt should scan `docs/` too. Not blocking. | open |
| F7 | INFO | spec.md § Acceptance criteria AC-10; tasks.md T-final `verify:` | AC-10's scope audit (`git diff --name-only` + `git status --porcelain`) assumes a clean baseline. The current working tree carries an unrelated modified tracked file (`docs/features/README.md`, manual-deploy-trigger row) that would appear in `git diff --name-only` and could be mistaken for scope creep during verification. | Ensure the baseline is clean (commit/stash the unrelated README change) before running AC-10, or run the scope audit on a clean checkout. Operational note; not a spec defect. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Raw request fully covered: trailing-newline hygiene (F6) and scoped credential audit (F5/F7) both scoped to the two workflow files + `docs/architecture/deployment.md`. |
| Testability | ✅ (minor) | AC-1…AC-10 binary/testable with pinned commands; evidence-completeness gap on AC-8 (F2). |
| Boundaries | ✅ | Three tiers present; out-of-scope list explicit and matches the deferred backlog. |
| Dependency graph | ✅ | Acyclic `T1 ∥ T2 ∥ T3 → T-final`; every AC mapped to at least one task; tasks sized to one builder session. |
| Parallel safety | ✅ | `[P]` only on disjoint-file tasks (T1/T2/T3); `[seq]` on T-final; `files_owned` disjoint (incl. build logs). |
| Security | ✅ | SHA pins retained (AC-8), OIDC untouched, no secrets, scoped audit still covers all non-doc tracked files; audit-exclusion trade-off documented (F6). |
| Testing | ✅ | Trailing-newline byte checks, actionlint wrapper, Terraform fmt/validate regression, scoped audit grep, SHA-pin audit, coverage gate, scope audit all pinned; smoke intentionally not re-run (no cross-service change). |
| Consistency | ✅ (minor) | Aligns with aws-deploy-pipeline/manual-deploy-trigger contracts; finding-number cross-references need correction (F1) and status.md task board needs alignment (F4). |
| Real-time | ✅ (N/A) | Explicitly out of scope with justification; WebSocket edge untouched. |
| Containers | ✅ (N/A) | Explicitly out of scope with justification; no services/images/ports/config added. |
| Documentation gate | ✅ | Assumption about `docs/features/README.md` ownership and acceptance doc pass recorded; row-presence claim needs reconciliation (F3). |

## Open questions

- Q-1 (scoped audit form) and Q-2 (migration of historical anchors) are well-posed: each states a default, an alternative, and a follow-up boundary. No change required. Defaults are acceptable.

## Notes / backlog (non-blocking)

- The spec correctly leaves historical accepted-feature artifacts untouched (Non-goals + Q-2 default `no`); the scoped command becomes canonical in `docs/architecture/deployment.md` going forward.
- The containerization and real-time impact sections correctly state "none" with justification; no contract deviation.
- F1–F4 are documentation-accuracy/evidence-completeness nits; none block approval. The builder may apply F2 (add the SHA-pin grep to T-final verify) during the build without a spec revision, consistent with the manual-deploy-trigger precedent for anchor tightenings.
