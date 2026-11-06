---
feature: spaceship-customization-layout-fix
phase: spec
iteration: 1
verdict: changes_requested
blocking: 2
nonblocking: 2
---

# Spec Review — r1

## Summary
❌ changes requested — two MAJOR ambiguities block reliable verification (AC-6 counts test files as violations; duplicate `.customization-panel` rule risks first-match CSS-guard failures). Two MINOR clarifications on AC-1's "or" wording and narrow-viewport edge cases.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | spec.md § Acceptance criteria (AC-6) | AC-6 asserts the change "touches only `src/frontend/src/App.tsx` … and `src/frontend/src/ui/app.css`" with evidence `git diff --stat`, but the testing strategy and tasks T3 explicitly edit `App.test.tsx` and `app.css.test.ts`. As written, the AC cannot be satisfied (the diff will show four files) and risks the builder avoiding test edits to pass it. | Reword AC-6 to scope the "no other surface moved" claim to production/non-test files (App.tsx + app.css), and state that the two test files are the only other changed files and only for expectation updates. | open |
| F2 | MAJOR | plan.md § Interfaces / contracts; spec.md § Testing strategy | The plan appends a *second* `.customization-panel { … }` rule while the first (existing) `.customization-panel` rule remains earlier in the file. The project's CSS-guard style (`css.match(/\.customization-panel\s*\{([\s\S]*?)\}/)` → first match) would select the pre-existing display rule, which contains no positioning declarations, so naive guards fail; the spec does not pin the regex/selection strategy. This is a likely mid-build dead end for hidden/added tests. | Clarify in the plan/spec whether positioning is merged into the existing `.customization-panel` block or appended as a second block, and, if appended, specify the CSS-guard selection approach (e.g., global match + find the block containing `position: absolute`, or a regex anchored on the positioning declarations) so tests are deterministic. | open |
| F3 | MINOR | spec.md § Acceptance criteria (AC-1) | AC-1 allows `bottom: calc(1rem + env(...))` *or* "a documented larger offset", leaving two acceptable values even though AC-3 pins the panel to `calc(4rem + env(...))`. | Tighten AC-1 to require `bottom: calc(4rem + env(safe-area-inset-bottom, 0px))` (per AC-3) for the panel, keeping the "documented larger offset" note as rationale only. | open |
| F4 | MINOR | spec.md § Non-goals / Assumptions | The toggle button is moved to an absolute bottom-left position with no responsive-width or overflow consideration; on very narrow viewports the long "Spaceship customization" label may overflow, but the spec declares responsive rework out of scope. | Either add a one-line note that the toggle keeps its intrinsic width (acceptable) or flag as a known limitation in Q-2/Q-3; no code change required. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | User ask (move overlapping feature to bottom-left) covered by AC-1–AC-4; non-goals explicit. |
| Testability | ❌ | AC-1's "or" (F3) and AC-6's unsatisfiable file scope (F1) weaken binary verification. |
| Boundaries | ✅ | Three tiers present; non-goals listed. |
| Dependency graph | ✅ | T1→T2→T3→T4 acyclic; every AC mapped; tasks single-session sized. |
| Parallel safety | ✅ | No `[P]` tasks; `files_owned` disjoint across T1–T3. |
| Security | ✅ | CSS/markup only; no data, secrets, or dependencies. |
| Testing | ✅ | Unit (CSS guard) + integration (SSR) tiers; `npm run coverage` thresholds ≥ 80% named; assertion bar stated. |
| Consistency | ✅ | Aligns with metallic-hud-frame conventions and safe-area inset pattern; no `AGENTS.md` contradiction. |
| Real-time | ✅ | Explicitly out of scope (no shared/cross-client state touched). |
| Containers | ✅ | Explicitly out of scope (no services/images/ports/config changes). |

## Previous round verification (if iteration > 1)

(n/a — first round)

## Notes / backlog (non-blocking)
- Q-1/Q-2/Q-3 in the spec remain open but are documented tunables; acceptable at spec gate.
- Consider whether the toggle button should inherit the framed-control styling; out of scope per AC-2 (position only). Flagged as INFO only.