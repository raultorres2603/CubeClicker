---
feature: futuristic-hud-blue
phase: spec
iteration: 2
verdict: approved
blocking: 0
nonblocking: 1
---

# Spec Review — r2

## Summary

✅ **approved** — r2 fully addresses the four MAJOR blockers (F1–F4) and the five MINOR/INFO items (F5–F9) raised in r1. The scanline is now pinned to `main > section::after` only with `::before` retained as the border-light carrier; AC-2/3/4/5/11 cite canonical greppable rules/media blocks; `overflow: hidden` is reconciled with the border light via `inset: 0` on `::before`; the reduced-motion selector list names `::before`/`::after` and the other selectors; the summary layering wording, canonical `1.5rem`/`24px` size with conversion rule, and `pointer-events: none` on detailing pseudo-elements are all pinned. Dependency graph remains acyclic (T1 → T2), boundaries are complete, real-time/container impacts are explicitly none with AC-12 as the container diff gate, and the testing strategy names the commands and thresholds from `AGENTS.md`. No new BLOCKER or MAJOR issues found.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | INFO | status.md (frontmatter + task board) | `status.md` still has an empty task board ("(none yet)") and a duplicate `spec_review_round` key (both `2` and `1`), so the YAML is ambiguous and the board is not populated despite tasks.md defining T1/T2 (r1 F8 carryover). | Orchestrator to populate the board from tasks.md and dedupe the frontmatter key before T1 starts. No spec change required. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All asks covered by AC-1…AC-13 or non-goals; Q-1…Q-5 recorded as open questions (reference image unavailable). Summary layering claim now tied to AC-2/AC-6/AC-8 (F5). |
| Testability | ✅ | F1/F2/F4 resolved: scanline pseudo pinned (AC-6), canonical greppable rules/media blocks (AC-2/3/4/5/11), reduced-motion selector list named (AC-7). Each AC is binary-testable with concrete evidence. |
| Boundaries | ✅ | Three tiers present and specific; non-goals listed (game rules, markup, deps, backend/container, theme constants). |
| Dependency graph | ✅ | Acyclic: T1 → T2. Every AC mapped (AC-2..9, AC-11 → T1; AC-1, AC-10, AC-12, AC-13 → T2). Tasks sized to one builder session (T1 overload note in plan risks, F8). |
| Parallel safety | ✅ | No `[P]` tasks; both sequential. `files_owned` disjoint by construction (T2 owns none). |
| Security | ✅ | No new dependencies, no user data/storage/network, CSS-only detailing, no `innerHTML`/assets. |
| Testing | ✅ | Unit + integration tiers defined; commands from `AGENTS.md` named; `npm run coverage` with ≥ 80% all four metrics per workspace named; concrete-assertion and no-useless-tests bars referenced; edge cases (reduced motion, responsive) named. |
| Consistency | ✅ | Aligns with vision (reduced motion, responsive) and predecessor CSS; `overflow: hidden` reconciled with border light via `inset: 0` (F3). No contradiction with `AGENTS.md`. |
| Real-time | ✅ | No shared/cross-client state created or read; no protocol message added; connection lifecycle, reconnection, multi-client and server authority unaffected. Local-only reduced-motion handling. |
| Containers | ✅ | Frontend source/CSS only; no services/images/ports/config; AC-12 pins the container-file diff gate. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) | fixed | spec.md AC-6 pins scanline to `main > section::after` only; states `::before` remains border-light carrier; AC-7 includes `main > section::after`. |
| F2 (r1) | fixed | spec.md AC-2 (base rule lines 67–82, consolidated), AC-3 (existing button rule), AC-4 (`focus-visible`), AC-5 (exact `main > section[data-minimized="true"]` selector with `\{`), AC-11 (existing 480px block, scan all). |
| F3 (r1) | fixed | spec.md AC-8 states `main > section::before` uses `inset: 0` instead of `inset: -1px` to survive `overflow: hidden`; AC-2 retains `overflow: hidden`. |
| F4 (r1) | fixed | spec.md AC-7 lists `main > section`, `::before`, `::after`, `button`, minimized `p`, blinking selector; media block must contain `main > section::after` and `animation: none`. |
| F5 (r1) | fixed | spec.md Summary reworded: layering is an implementation detail via `pointer-events: none` (non-obscuring paint order), covered by AC-2/AC-6/AC-8. |
| F6 (r1) | fixed | spec.md AC-3 pins `min-width: 1.5rem;` / `min-height: 1.5rem;` with `rem`→16px conversion rule (≥ 24px). |
| F7 (r1) | fixed | spec.md AC-2/AC-6/AC-8 pin `pointer-events: none` on `::before`/`::after`. `z-index` ordering remains an implementation detail (non-blocking; noted below). |
| F8 (r1) | partially fixed | plan.md risks note T1 sizing and escalation; tasks.md unchanged (T1 → T2). status.md task board still empty (F1 above). |
| F9 (r1) | acknowledged | spec.md Q-5 retains scope-split option gated on `awaiting_approval`. |

## Notes / backlog (non-blocking)

- z-index ordering of the detailing pseudo-elements is left as an implementation detail (paint order + `pointer-events: none`); the grep guards cannot verify a non-obscuring stack, so the builder should keep the scanline low-opacity and the border-light ring on the edge. Verify visually at the code gate.
- F3's reconciliation (border light not clipped by `overflow: hidden`) should be verified visually at the code gate; grep guards alone will not catch a clipped ring.
- status.md duplicate `spec_review_round` key and empty task board should be cleaned up by the orchestrator before building (F1 above).
- Documentation pass on acceptance: no README/architecture/container doc change expected (CSS-only); only the orchestrator-owned `docs/features/README.md` row update. Confirm at acceptance.