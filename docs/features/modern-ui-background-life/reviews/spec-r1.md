---
feature: modern-ui-background-life
phase: spec
iteration: 1
verdict: changes_requested
blocking: 3
nonblocking: 4
---

# Spec Review — r1

## Summary

❌ **changes requested** — The spec, plan and tasks cover all three asks (animated HUD borders, shot blink, background life) plus reduced motion, are frontend-only, and the dependency graph and parallel-safety checks pass (T1 ∥ T2 ∥ T4 with disjoint `files_owned`). However, three acceptance criteria leave implementation-critical details unspecified in ways that will produce wrong or unverifiable work at the code gate: AC-6 never pins the reduced-motion signal App must read; AC-5 never pins whether the blink flip and its 200 ms reset happen during render or in a commit effect (and how the previous-clicks value is tracked); and AC-1/AC-2/AC-4 leave the CSS selectors and animation shorthand flexible enough ("or their bordered children", "or equivalent") that an automated grep guard cannot be written against them. Required actions under F1–F3.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | spec.md § Acceptance criteria (AC-6); plan.md § App wiring | AC-6 says "when the scene runs under reduced motion" but never names the signal App reads. App has no direct reduced-motion source of its own; the engine publishes it on `EngineSnapshot.reducedMotion` (see `engine.ts` `setReducedMotion` and `session.ts`). A builder could instead read `window.matchMedia('(prefers-reduced-motion: reduce)')`, which is undefined in the node/jsdom SSR path used by `App.test.tsx` and would make AC-6 untestable and inconsistent with the scene. | Amend AC-6 (and plan.md § App wiring) to state explicitly: App derives reduced motion from `snapshot.reducedMotion` and skips setting `hudBlinking` when it is `true`. | open |
| F2 | MAJOR | spec.md § Acceptance criteria (AC-5); plan.md § App wiring; tasks.md T3 | AC-5 says "whenever `snapshot.stats.clicks` increases relative to the previous render, App sets `hudBlinking = true` and resets it to `false` after `HUD_BLINK_MS` ms" but does not pin (a) how the previous clicks value is retained across renders, (b) whether the flip/timer are scheduled during render or in a commit effect, and (c) timer cleanup on repeated increases / unmount. A render-body implementation and an effect-based implementation produce different commit timing, so a hidden `App.test.tsx` that asserts `data-blinking="true"` immediately after a rerender may pass or fail depending on the builder's choice. | Amend AC-5 to pin the contract: track previous clicks in a `useRef`; compare in a `useEffect` keyed on `snapshot.stats.clicks` (and `snapshot.reducedMotion`); set `hudBlinking = true` and (re)arm a single `setTimeout(..., HUD_BLINK_MS)` that clears it, clearing any prior timer; clean up the timer on unmount. State in the testing strategy that blink assertions must await commit (e.g. `waitFor`/`findBy`). | open |
| F3 | MAJOR | spec.md § Acceptance criteria (AC-1, AC-2, AC-4); plan.md § Border light & HUD blink CSS | AC-1/AC-2/AC-4 use flexible phrasing ("or their bordered children", "or equivalent") for both the target selectors and the animation shorthand, and allow any duration in a range. An automated `app.css.test.ts` guard cannot be written against that: it cannot tell whether `border-light-travel` must appear in a rule whose selector is exactly `main > section` / `.user-panel` or in a child rule, nor whether the shorthand must read `border-light-travel 3000ms linear infinite` vs. `animation-name: border-light-travel`. Left as-is this is a guaranteed mismatch point at the code gate. | Pin the canonical, greppable form in the ACs: `@keyframes border-light-travel` and `@keyframes hud-blink`; a single rule (or one rule per selector) of the form `animation: border-light-travel <n>ms linear infinite;` applied to `main > section` and `.user-panel` (pseudo-element allowed, but the selector text must contain those tokens); `animation: hud-blink <n>ms <easing>;` with `<n> <= 300` applied to `main > section[data-blinking="true"]`; and an `@media (prefers-reduced-motion: reduce)` block containing `animation: none` for `main > section`, `.user-panel` and `main > section[data-blinking="true"]`. State the duration bounds as inclusive. | open |
| F4 | MINOR | spec.md § Acceptance criteria (AC-7, AC-8) | "Recycles when it leaves the view" and the motion bounds for shooting stars / spaceships are not quantified (no view region, no speed units, no recycle trigger). Hidden tests can only assert "positions change" and "stay finite", which is weak and risks a useless test; a stronger bar needs a pinned region and a deterministic recycle rule. | Add one clause: each shooting star advances along a fixed axis within a pinned world-space band (e.g. `x ∈ [-X, X]`, `y ∈ [-Y, Y]`) and, when it exits the band, resets to the opposite edge using the injected `random`; spaceships drift/orbit within a pinned distant band. State that `update` clamps `dtMs` with `Math.max(0, dtMs)` before any motion. | open |
| F5 | MINOR | plan.md § File inventory; tasks.md T6 | T6's `files_owned` includes `README.md`, but the documentation pass (root README, features index, architecture/product docs) is defined by `docs/architecture/documentation.md` as an acceptance-time activity, and this feature changes no install/run/port/container fact that README documents. Editing README during the build task is premature and risks an unnecessary diff. | Either remove `README.md` from T6 `files_owned` (leaving the acceptance-time documentation pass to confirm no change is needed) or state in the plan which README section the feature actually affects. | open |
| F6 | INFO | spec.md § Open questions (Q-5) | One feature bundles three distinct visual changes; the spec already acknowledges the split option and gates it on user approval. No artifact change required — recorded for the approval checkpoint. | Confirm scope (one feature vs. split) at `awaiting_approval`. | open — checkpoint |
| F7 | INFO | spec.md § Assumptions; plan.md § Background life | "Spaceships fighting" is decorative only and has no observable contract beyond counts, Mesh-ness and motion; hidden tests cannot assert "fighting". Acceptable given the non-goal list, but the term should not be read as requiring shot/collision logic. | None — keep non-goals as written; ensure no builder adds shot logic to background life. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All three asks (border light, shot blink, background life) plus reduced motion are covered by AC-1…AC-10; container/backend changes explicitly excluded by AC-11; coverage by AC-12. Non-goals exhaustive. |
| Testability | ❌ | F1, F2, F3: AC-6's reduced-motion signal, AC-5's commit/timer semantics and AC-1/2/4's CSS selectors are not pinned enough to write a deterministic guard. |
| Boundaries | ✅ | Three tiers present and specific; non-goals listed; single feature scope (Q-5 flagged). |
| Dependency graph | ✅ | Acyclic: T1 ∥ T2 ∥ T4 → T3 (T2), T5 (T4) → T6 (all). Every AC mapped (AC-1/2/4→T1, AC-3→T2, AC-5/6→T3, AC-7/8→T4, AC-9/10→T5, AC-11/12→T6); every task maps to ACs; sized to one builder session. |
| Parallel safety | ✅ | `[P]` tasks T1/T2/T4 own disjoint files (app.css+test, Hud.tsx+test, background-life.ts+test); no shared-file contact. |
| Security | ✅ | No new dependencies, no user data/storage/network, procedural geometry only, fixed counts, `dispose()` releases all; dependency additions gated as ask-first. |
| Testing | ✅ | Unit + integration tiers defined; commands from `AGENTS.md` named; `npm run coverage` with ≥ 80% all four metrics per workspace named; concrete-assertion and no-useless-tests bars referenced; edge cases (reduced motion, rebuild, disposal) named. |
| Consistency | ✅ | Aligns with vision and predecessor specs (modern visual overhaul); reuses existing render/UI layer; no contradiction with `AGENTS.md`; real-time and container impact correctly stated as none/local-only. |
| Real-time | ✅ | No shared/cross-client state created; connection lifecycle, reconnection, multi-client and server authority unaffected; local-only default flagged via Q-1. |
| Containers | ✅ | Frontend source only; AC-11 pins the container-file diff gate; no services/images/ports/config added. |

## Previous round verification

N/A — iteration 1.

## Notes / backlog (non-blocking)

- F4's recycle region should be chosen to match the existing starfield bounds style (world-space band) so the new module stays consistent with `starfield.ts`.
- The documentation pass on acceptance should confirm `README.md` needs no change (F5); if it does, record it in the build log.
- F1/F2/F3 are spec-text amendments only; no plan/tasks restructuring is required unless the planner prefers to also tighten T3's `files_owned` (unchanged).