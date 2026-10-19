---
feature: agent-model-tuning
phase: spec
iteration: 2
verdict: approved
blocking: 0
nonblocking: 0
---
# Spec Review — r2

## Summary

✅ approved — All five r1 findings are closed with evidence at exact locations: the approval claim is now consistently prospective ("proposed at the `awaiting_approval` checkpoint", gated and recorded before T1), the reviewer percentages are recomputed against the $4/$20 referent (10%/8%, arithmetic checked), the tier claim is narrowed to what holds (above the builder; family-independent from DeepSeek by design), T1 pins `git rev-parse HEAD` as the pre-feature baseline ref with AC-6/T2 anchored on `<recorded-ref>`, and AC-9 carries the acceptance-time README carve-out. Regression passed: mapping, catalog rows, and AC-1…AC-9 are unchanged except the intended F2/F4/F5 text; zero stale phrases; agent files untouched; tasks graph `T1 → T2` intact. No new findings.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| — | — | — | No new or open findings in this delta review. | — | — |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Unchanged from r1 (all four asks of the verbatim request covered). r2 added no scope. |
| Testability | ✅ | ACs unchanged except AC-6/AC-9 text, which remain binary and now evidenceable via an explicit recorded ref; F4's evidentiary gap is closed. |
| Boundaries | ✅ | Unchanged. |
| Dependency graph | ✅ | `T1 → T2` unchanged; AC mapping unchanged (T1: 1–5, 7; T2: 1–9). |
| Parallel safety | ✅ | Unchanged — zero `[P]` tasks; `files_owned` disjoint. |
| Security | ✅ | Unchanged; the spend gate is now accurately worded as the `awaiting_approval` checkpoint gating T1. |
| Testing | ✅ | Coverage-N/A justification unchanged and stands (r1 ruling maintained); tasks.md verification note intact. |
| Consistency | ✅ | Approval wording is internally consistent across spec.md:14/60/64/190 and plan.md:70; spec/plan/tasks README-row carve-out aligned (spec AC-9:167, plan:45, tasks:36); status.md loop log r1→r2 trace complete (round 2 recorded). |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1, MAJOR — opaque approval prose) | fixed | spec.md:14 now "proposed at the approval checkpoint; the build copies the target strings byte-for-byte only after the user approves this spec at that checkpoint"; spec.md:60 "proposed for user approval at the `awaiting_approval` checkpoint"; spec.md:64 "The user approves (or amends) this table at the `awaiting_approval` checkpoint … only after that approval is recorded per the workflow"; spec.md:190 the approval "is the user-owned spend decision and gates the build — nothing starts before that approval is recorded"; plan.md:70 the checkpoint "presents the mapping table … and is the user-owned spend decision"; "the build (T1) proceeds only after that approval is recorded". Grep for "approved at the checkpoint" over spec/plan/tasks/status: zero matches — no assertion anywhere that approval already happened; wording is now internally consistent and the `awaiting_approval` gate governs T1. Ruling: acceptable — the wait-for-approval trace is now the artifact's own gate rather than an unverifiable memory claim. |
| F2 (r1, MINOR — ambiguous "%" referents) | fixed | spec.md:100 recomputes "$0.40/$1.60 = 10% of the $4 top-tier input and 8% of the $20 top-tier output (same $4/$20 referent as the planner paragraph)" — 0.40/4 = 10%, 1.60/20 = 8%: arithmetic checks against the same referent as the planner paragraph (spec.md:93). plan.md D-3 ("\~1/6 of the $4 top-tier input / \~1/10 of the $20 top-tier output") and D-4 ("10%/8% of the $4/$20 top tier") mirror it. |
| F3 (r1, MINOR — "a tier above the producers" overstate) | fixed | spec.md:99 "the gate sits above the builder it most directly gates (flash) and is family-independent from the DeepSeek planner/builder by design — independence was chosen over price tier versus the planner"; Q-4 (spec.md:210) and plan.md D-4 use the same narrowed claim. True for the builder (0.40/1.60 > 0.15/0.60, qwen ≠ deepseek); the planner price relationship is now stated explicitly instead of implied. |
| F4 (r1, MINOR — pre-feature ref not recorded) | fixed | tasks.md:26 T1 verify: "before editing, record the pre-feature baseline commit (`git rev-parse HEAD`)" and "raw outputs in `build-log-T1.md` (including the recorded `git rev-parse HEAD` pre-feature ref)"; T2 (tasks.md:36) anchors on the recorded ref: "`git diff <recorded-ref> -- opencode.jsonc .opencode/commands/feature.md` is empty, where `<recorded-ref>` is the pre-feature baseline commit recorded via `git rev-parse HEAD` in `build-log-T1.md`"; AC-6 (spec.md:164) carries the same recorded-ref check; spec.md:154 pins the definition and explicitly forbids relative refs ("never a relative ref such as `HEAD~1`"). Grep confirms `HEAD~1` appears only in that prohibition — no stale usage. Concurrency rationale (in-flight `cube-game-frontend`) stated consistently with plan.md:68. |
| F5 (r1, MINOR — AC-9 vs README row tension) | fixed | AC-9 (spec.md:167) now carries: "the acceptance-time `docs/features/README.md` index row is orchestrator-owned, lands after the code gate, is outside all T1/T2 `files_owned`, and is outside this AC's build-commit scope-discipline evidence"; mirrored in plan.md:45 (inventory row's purpose) and tasks.md:36 (AC-9 scope-discipline parenthetical). All three documents aligned. |

## Regression check

- **Mapping tables unchanged:** spec.md:18–21, plan.md:21–24, tasks.md:15–18 — byte-identical to r1 (targets `opencode-go/deepseek-v4.1-flash#low` / `opencode-go/deepseek-v4-pro#max` / `opencode-go/deepseek-v4.1-flash#high` / `opencode-go/qwen3.7-plus#max`); tasks.md still labels spec § Model mapping and tasks § Change set as identical normative tables (AC-7 forbids drift).
- **Catalog rows unchanged:** spec.md § Catalog basis identical to the r1 table (23 rows; r1 live re-query matched 23/23 — no drift recorded).
- **AC-1…AC-9:** AC-1–5, AC-7, AC-8 unchanged; AC-6 and AC-9 carry only the intended F4/F5 text; no new ACs; no new scope.
- **Stale phrases:** grep over spec/plan/tasks/status for "approved at the checkpoint", "20%/27%", "out-tier", "tier above the producers" → zero matches.
- **Repository state:** `git diff --stat -- .opencode/agents/` empty — the four agent files untouched since r1, baselines still byte-match the pinned tables; graph `T1 → T2` unchanged; `files_owned` unchanged; no `[P]` tasks.
- **Revision history:** spec.md r2 entry documents all five fixes with locations and claims "no mapping, price, catalog, or scope changes" — confirmed by this review line-by-line; status.md records both loop-log turns (spec_review → planning → spec_review, round 2) and the r1 verdict echo with blocking counts.

## Notes / backlog (non-blocking)

- **INFO — recorded for the log, no action:** plan.md D-2's alternatives cell describes deepseek-v4-pro/qwen3.7-plus as "3–4× unit price" over the largest volume; the per-millo figures are 2.7× (plus) to 4.4× (pro). Pre-existing r1 rounding in an alternatives cell with no decision impact; not carried as a finding under the no-re-litigation final-round budget.
- R1's live-catalog ruling stands: the recorded catalog is the AC basis for AC-7's variant cross-check; a live re-query was optional enrichment and remains available to the code gate (build-time re-check is already pinned in tasks T2 and matters more at build time than now).
