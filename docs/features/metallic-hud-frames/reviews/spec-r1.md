---
feature: metallic-hud-frames
phase: spec
iteration: 1
verdict: changes_requested
blocking: 2
nonblocking: 10
---
# Spec Review — r1

## Summary

❌ **changes requested** — the scope, testing tiers, coverage bar, dependency graph and no-parallel-task plan are sound, but two blocking contradictions must be fixed before building: the pinned sheen geometry is clipped by the retained `overflow: hidden` on the HUD (F1), and AC-7's "single rule" cannot coexist with the plan's second input rule (F2). Ten non-blocking testability/consistency gaps follow; the most important are the missing mask declaration in AC-9, the weak `git diff` evidence gates, and the unpinned alert/disabled treatments.

Reviewed: `spec.md`, `plan.md`, `tasks.md`, `status.md`, `AGENTS.md`, `docs/architecture/stack.md`, `docs/architecture/documentation.md`, `docs/product/vision.md`, the predecessor specs (`futuristic-hud-blue`, `modern-ui-background-life`), and the current `app.css` / `app.css.test.ts` / `theme.test.ts` / component sources.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | `spec.md` § AC-9; `plan.md` § Interfaces/contracts — Frame sheen; `plan.md` § Edit map — `main > section`; `spec.md` § Superseded predecessor criteria (futuristic AC-2) | The sheen is pinned as `inset: -2px; padding: 2px`, which places the masked 2px band in the element's **border area**, outside the padding box. `main > section` deliberately keeps `overflow: hidden` (retained from futuristic-hud-blue AC-2). Overflow clipping happens at the padding edge, so the sheen band is clipped away on the HUD — exactly why the predecessor border light used `inset: 0` (futuristic AC-8). AC-9's source guard would still pass, making this a guaranteed visual miss on the primary surface. | Reconcile geometry and overflow: either supersede the `overflow: hidden` requirement on `main > section` and rely on `clip-path` (updating the supersession text), or move the sheen inside the padding box (`inset: 0` with a 2px inner band and the corresponding mask) so it is not clipped. Update AC-9, the plan's sheen snippet/rationale, and the predecessor supersession; add this to plan risks and the manual visual check. | open |
| F2 | MAJOR | `spec.md` § AC-7; `plan.md` § Edit map — `.auth-input, .verification-pending input`; `plan.md` § Inset wells | AC-7 requires "a single rule whose selector list is exactly `.auth-input, .verification-pending input`" carrying the well declarations, but the plan keeps the existing base rule with that same exact selector list (sizing/typography) and adds a new well rule — two rules with that list. A literal guard (count/first-match) fails or inspects the wrong rule; the AC and the plan disagree. | Choose one: merge the well declarations into the existing `.auth-input, .verification-pending input` rule and adjust the plan wording, or reword AC-7 (and its guard) to "a rule whose selector list is..." and state explicitly that the base layout rule remains separate. The guard must target the rule containing `--frame-cut: 0.25rem`. | open |
| F3 | MINOR | `spec.md` § AC-18, AC-19; `tasks.md` § T2 verify | `git diff --exit-code -- <paths>` compares only the working tree to the index. A staged or committed modification to the forbidden `.tsx`/container files produces an empty diff and a false green gate; the "final build log" is a claim, not independent evidence. | Pin the gate to a base (e.g. `git diff --exit-code $(git merge-base main HEAD) -- <paths>` or `<base>...HEAD`) or record `git status --porcelain` before staging plus `git diff --exit-code HEAD`; name the base ref in the build log. | open |
| F4 | MINOR | `spec.md` § AC-15; `plan.md` § State rules / § Edit map — reduced motion | AC-15 requires reduced-motion `animation: none` + `transition: none` for `.auth-button` but omits `.verification-pending button`, which shares the `.auth-button, .verification-pending button` base rule that declares a transition. The verification-pending control still animates under `prefers-reduced-motion`, so the list is internally inconsistent. | Add `.verification-pending button` to AC-15 and the plan's reduced-motion group (and any other transition-bearing control kept in the plan), or remove `.auth-button` from the list and justify why control transitions are out of scope. | open |
| F5 | MINOR | `spec.md` § AC-9 | AC-9 pins `mask-composite` / `-webkit-mask-composite` but not the `mask` / `-webkit-mask` layer declarations that make the sheen a narrow band. A guard written to AC-9 passes a full-bleed gradient overlay across the panel centre — the exact visual failure the plan says the mask prevents. | Add `-webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);` (and/or the standard `mask`) to AC-9's required declarations and to the guard. | open |
| F6 | MINOR | `spec.md` § Open questions Q-5; `plan.md` § Tier overrides — `.auth-error`; no AC | The Q-5 default (red-tinted centre plus red glow for `.auth-error`) is implemented only in the plan; no AC or guard pins the `.auth-error` `--frame-center` / `--frame-glow` overrides, so the default can be silently dropped while every AC still passes. | Add an AC/guard for the `.auth-error` token overrides (and the red text), or explicitly record the treatment as a non-blocking visual default verified manually. | open |
| F7 | MINOR | `spec.md` § User stories (hover/focus/disabled) and § AC-6/AC-8 | The user story promises hover, focus and disabled states remain visible; the ACs pin hover (AC-6) and focus (AC-8), but no AC or guard pins the disabled styling (`.auth-button:disabled` / `.verification-pending button:disabled` opacity/cursor; `.user-panel li button:disabled` colour). | Add a disabled-state AC/guard with concrete values, or narrow the user story and document the disabled treatment as retained by the plan. | open |
| F8 | INFO | `spec.md` § Open questions Q-2 vs § AC-7 | Q-2 says the inset wells are "the auth inputs", but AC-7 also wells `.verification-pending input`. The scope wording is inconsistent and could lead to only `.auth-input` being styled. | Name `.auth-input` and `.verification-pending input` consistently in Q-2 and the summary. | open |
| F9 | INFO | `spec.md` § Superseded predecessor criteria (futuristic AC-2) | It says the base `main > section` border/box-shadow assertions are "replaced by AC-3/AC-5"; AC-5 is the control rule and does not touch `main > section`. AC-3 is the relevant replacement. | Change "AC-3/AC-5" to "AC-3" (mention AC-4/AC-9 separately if intended). | open |
| F10 | INFO | `spec.md` § Non-goals / Q-2 | The rationale "framing the verification screen would need a markup wrapper" is inaccurate: `.verify-email` is an existing `<div>` in `VerifyEmail.tsx` and could be styled without a wrapper. The real reason is scope/design (it is not a box today). | Reword to state the scope decision and the layout-change cost, not a markup necessity. | open |
| F11 | INFO | `spec.md` § Testing strategy — "Integration (React, SSR + jsdom where already used)" | The frontend Vitest config is `environment: 'node'`; the UI tests are SSR string tests and no jsdom environment is used. The phrase invites a jsdom test that does not exist. | Say "SSR string rendering in the node environment" and drop the jsdom reference. | open |
| F12 | INFO | `spec.md` § AC-17 | Only the main frame centre (`--frame-center-top` over `PAGE_BACKGROUND`) is contrast-gated. The new alert centre (`--frame-center-alert-*`), the new error text `#ffb4b4`, and the input well are new text backgrounds without a contrast assertion. | Add computed-contrast tests for the alert centre (and optionally the well), or record why the existing AA reasoning covers them. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Every requested surface group is covered by an AC or an explicit non-goal/Q-2/Q-9 exclusion; Q-1 records the unavailable reference image. |
| Testability | ❌ | F1 (guard passes a clipped sheen), F2 (contradictory single-rule requirement), F3 (weak diff evidence), F5 (missing mask contract). |
| Boundaries | ✅ | Always / Ask first / Never present; non-goals listed; no new dependencies. |
| Dependency graph | ✅ | T1 → T2, acyclic; dependencies point at earlier tasks; all ACs mapped; T2 is verification-only. |
| Parallel safety | ✅ | No `[P]` tasks; `files_owned` disjoint; T2 owns no files, so no collision risk. |
| Security | ✅ | CSS and test-source edits only; no dependencies, user data, storage, network, external assets, or `innerHTML`. |
| Testing | ✅ | Unit + integration + manual visual + container smoke; `npm run coverage` with ≥ 80% statements/branches/functions/lines per workspace; concrete assertions and edge cases named. F4/F6/F7 remain gaps to close. |
| Consistency | ❌ | F1/F2/F8/F9/F10 contradict the plan or predecessor specifications; the sheen rationale in the plan is technically wrong for the HUD. |
| Risks | ❌ | The plan's risk list omits the overflow/sheen clip (F1), the single largest visual risk in the change. |
| Real-time | ✅ | None: client-local presentation only; connection banner restyled without changing lifecycle, reconnection, multi-client behaviour, or server authority. |
| Containers | ✅ | None: no new services, images, ports, config, or compose/Dockerfile changes; AC-19 pins the diff gate; the frontend image absorbs the CSS. |

## Previous round verification (if iteration > 1)

N/A — iteration 1.

## Notes / backlog (non-blocking)

- The T1 scope is large but is the only way to keep `files_owned` disjoint; the plan's escalation note (do not split `app.css` mid-task) is the right mitigation. No finding.
- The `app.css.test.ts` rewrite plan correctly calls out the two extraction updates needed for grouped selectors (`main > section::before` no longer ends with `{`). Ensure those guards keep asserting `pointer-events: none` and "no `hud-scanline` on `::before`".
- Predecessor index rows remain historical records; no documentation edit is required for this feature beyond the orchestrator-owned `docs/features/README.md` row at acceptance.
- F8–F12 are informational and should be folded into the next revision; they do not block building on their own.
