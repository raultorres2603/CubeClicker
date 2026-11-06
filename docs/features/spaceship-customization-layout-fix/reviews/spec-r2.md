---
feature: spaceship-customization-layout-fix
phase: spec
iteration: 2
verdict: approved
blocking: 0
nonblocking: 0
---

# Spec Review — r2

## Summary
✅ approved — revision r2 resolves all four r1 findings (F1–F4): AC-6 now scopes the "no other surface moved" claim to production files while acknowledging the two test files; positioning is merged into the existing `.customization-panel` block with a documented CSS-guard selection strategy; AC-1 pins the panel bottom to `calc(4rem + env(...))`; Q-4 records the toggle's intrinsic-width limitation. Spec, plan, and tasks are consistent, testable, and ready for build.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| (none) | — | — | No new findings. | — | — |

## Checklist results
| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | User ask (move overlapping customization menu to bottom-left) covered by AC-1–AC-4; non-goals explicit. |
| Testability | ✅ | AC-1–AC-4 pin concrete CSS values; AC-5/AC-6 binary-verifiable (lint/typecheck/test/coverage + `git diff --stat`). |
| Boundaries | ✅ | Three tiers present; non-goals listed. |
| Dependency graph | ✅ | T1→T2→T3→T4 acyclic; every AC mapped (AC-1..AC-6); tasks single-session sized. |
| Parallel safety | ✅ | No `[P]` tasks; `files_owned` disjoint across T1–T3; T4 verification-only. |
| Security | ✅ | CSS/markup only; no data, secrets, or dependencies. |
| Testing | ✅ | Unit (CSS guard) + integration (SSR) tiers; `npm run coverage` thresholds ≥ 80% named; assertion bar stated; no exclusions added. |
| Consistency | ✅ | Aligns with metallic-frame and safe-area inset conventions; no `AGENTS.md` contradiction. |
| Real-time | ✅ | Explicitly out of scope (no shared/cross-client state touched). |
| Containers | ✅ | Explicitly out of scope (no services/images/ports/config changes). |

## Previous round verification (iteration > 1)
| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) | fixed | spec.md § AC-6 now reads "The production (non-test) change touches only `src/frontend/src/App.tsx` … and `src/frontend/src/ui/app.css` … The two test files … are the only other changed files and are changed solely for expectation updates." |
| F2 (r1) | fixed | plan.md § Interfaces/contracts now merges positioning into the existing `.customization-panel` block (single rule); spec.md § Testing strategy documents first-match `css.match(/\.customization-panel\s*\{([\s\S]*?)\}/)` plus global-match alternative. |
| F3 (r1) | fixed | spec.md § AC-1 now requires `bottom: calc(4rem + env(safe-area-inset-bottom, 0px))`; "documented larger offset" retained as rationale (Q-2). |
| F4 (r1) | fixed | spec.md § Open questions Q-4 records the toggle's intrinsic-width known limitation. |

## Notes / backlog (non-blocking)
- Q-1/Q-2/Q-3/Q-4 in the spec remain documented tunables; acceptable at spec gate.
- Whether the toggle button should inherit framed-control styling remains out of scope per AC-2 (position + class only); INFO only.
- `right: auto` in the merged `.customization-panel` rule is an additional (harmless) override beyond AC-1's listed declarations; builder follows the pinned plan block.