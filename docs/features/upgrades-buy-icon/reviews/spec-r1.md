---
feature: upgrades-buy-icon
phase: spec
iteration: 1
verdict: approved
blocking: 0
nonblocking: 2
---

# Spec Review — r1

## Summary
✅ approved — spec/plan/tasks are complete, testable, and internally consistent; scope is tightly bounded to two production files with clear ACs and concrete SSR golden strings. Two minor clarifications recommended (attribute ordering guidance and AC-7 wording) but neither blocks implementation.

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | tasks.md § T1 (notes) | The pinned SSR strings require `aria-label` before `disabled` in attribute order, but React 19 preserves JSX declaration order and the task notes do not specify where to insert `aria-label`; a builder could place it after `disabled` and produce `<button type="button" disabled="" aria-label="Buy"></button>`, mismatching every pinned expectation. | Add an explicit attribute-order note to T1 (and the plan's interface contract) stating the JSX must read `type="button" aria-label="Buy" disabled={!affordable}` so SSR output matches the pinned strings; keep the existing React-version fallback in the spec assumption. | open |
| F2 | MINOR | spec.md § Acceptance criteria (AC-7) | AC-7 states the three test files change "only for expectation updates," but AC-5/T3 explicitly require adding a new CSS guard test to `app.css.test.ts`, which is new test code rather than an expectation update. The intent (scope control / no test refactoring) is clear but the wording contradicts T3. | Reword AC-7 to "test files change only to update expectations or to add the guards explicitly required by AC-5," keeping the production-scope limit unchanged. | open |

## Checklist results
| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All asks from the request (icon instead of "Buy" text, accessibility retained) covered by AC-1–AC-9; scope explicitly bounded by non-goals. |
| Testability | ✅ | Each AC is binary-testable with concrete expected SSR strings and commands; minor attribute-order ambiguity flagged (F1). |
| Boundaries | ✅ | Three tiers present (✅/⚠️/🚫); non-goals listed; production scope limited to two files. |
| Dependency graph | ✅ | T1 → T2, T3 → T4; acyclic; every AC mapped; tasks sized for one builder session. |
| Parallel safety | ✅ | T2 and T3 are `[P]` with disjoint `files_owned` (App.test.tsx vs app.css + app.css.test.ts); no shared-file contact. |
| Security | ✅ | No user-controlled data, persistence, secrets, or dependency changes; icon is decorative CSS. |
| Testing | ✅ | Unit + integration tiers with concrete values; commands from AGENTS.md; coverage ≥80% named; banned-matchers/useless-tests bars referenced. |
| Consistency | ✅ | Aligns with vision (accessible & responsive) and AGENTS.md conventions; no contradictions. |
| Real-time | ✅ | Explicitly out of scope with justification; no shared/cross-client state touched. |
| Containers | ✅ | Explicitly out of scope (AC-8); no service/image/port/env/Dockerfile/compose change. |

## Previous round verification (if iteration > 1)
N/A — first iteration.

## Notes / backlog (non-blocking)
- The icon glyph (`+`) and `aria-label="Buy"` remain default-with-notice per Q-1/Q-2/Q-3; the user may override before build, which would update T1/T3 and the pinned strings.
- AC-7 wording (F2) should be corrected in the same spec revision if the builder touches it; otherwise the builder should follow T3's explicit guard-test authorization.
- No wishlist items.