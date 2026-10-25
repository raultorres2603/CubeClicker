---
feature: fullscreen-responsive-layout
kind: spec
iteration: 1
verdict: changes_requested
blocking: 8
---

# Spec Review — r1

## Summary
❌ changes requested — 2 blockers and 6 majors. The spec's touch-input contract contradicts the accepted `cube-tile-lines-and-controls` predecessor (drags do nothing in this codebase), and its renderer-resize contract targets a `scene.setSize` API that does not exist (sizing lives in `session.applyViewport`). Task-graph metadata and file-ownership are also inconsistent with their own `depends_on`, and several current-defect citations are fabricated. Fix the ordered list below before build.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | BLOCKER | spec.md § Acceptance criteria (AC-9, AC-10); spec.md § Scope (Touch input); spec.md § User stories; plan.md § Touch input design | AC-10 promises "touch drag rotates" (one 90° step), but the accepted predecessor `cube-tile-lines-and-controls` explicitly disabled pointer-drag rotation and the live `session.ts` `dispatchGesture` returns nothing for any `drag` (comment: "Pointer rotation was removed (spec AC-2)"). Reintroducing drag rotation would be a game-logic change and scope creep, and would break the accepted contract. | Rewrite AC-9/AC-10 and the user story to state: touch tap explodes (identical to mouse tap); touch drag does nothing (parity with mouse drag — no rotation, no explosion, no dispatch). Drop "drag to rotate" from scope. Revise Q-1 (no virtual joystick; mobile rotation relies on auto-rotate after face clear and on any attached keyboard) and state the mobile playability limitation explicitly. | open |
| F2 | BLOCKER | spec.md § Acceptance criteria (AC-6, AC-7); plan.md § Current-defect analysis (`scene.ts:33-64`); plan.md § Resize data flow | AC-6 references `scene.setSize(width, height, dpr)`, but `render/scene.ts` exposes no `setSize` (and no resize listener); sizing is owned by `game/session.ts` `applyViewport` (adapter `setPixelRatio` + `setSize` + camera aspect/projection). There is no `createSceneAdapter`. The AC is untestable as written and would force an invented API. | Re-target AC-6/AC-7/AC-8 and the plan's resize data flow at `session.applyViewport` / the injected `env.resize` source / `RendererAdapter` + `view.camera`, and correct the defect citation. Keep the scene adapter out of sizing. | open |
| F3 | MAJOR | tasks.md § Dependency overview; tasks.md task list | The overview ("T1 → T2 → T3 → T4 → T6; T5 ∥ T4 (after T2)") contradicts the actual `depends_on` (T5 depends on T2, T3, T4; no T6 exists). Parallel groups are misstated. | Rewrite the overview to match `depends_on`: T1 first; then T2 ∥ T4; T3 after T2; T5 after T2, T3, T4. Remove the phantom T6. | open |
| F4 | MAJOR | tasks.md T1/T4 `files_owned`; spec.md AC-4/AC-5/AC-13/AC-14 | `app.css` is owned only by T1, yet T4 (components) carries AC-4/AC-5/AC-13/AC-14, which require CSS changes (safe-area insets, tap targets). T4 cannot edit CSS without colliding with T1; the ownership split is ambiguous. | Clarify ownership: T1 owns all `app.css` edits; T4 owns only `Hud.tsx`/`UserPanel.tsx`/`ConnectionBanner.tsx` and verifies the CSS-driven ACs. Add a note that T4 must not edit `app.css`. (Or consolidate all CSS ACs under T1.) | open |
| F5 | MAJOR | spec.md AC-8; session.test.ts `resize and visibility` | Debouncing resize by ≤16ms conflicts with the existing session test, which expects synchronous `applyViewport` on `resize.emit()` (concrete `setSize`/aspect assertions before any frame tick). The spec does not state the debounce shape (leading/trailing) or how attach-time sizing stays immediate, and gives no fake-timer contract for the existing test. | Specify the debounce precisely (e.g. trailing debounce of ≤16ms with immediate apply on first call / attach; `orientationchange` immediate), state that attach-time `applyViewport` is not debounced, and list the session tests that must be updated with fake timers. | open |
| F6 | MAJOR | spec.md § Risks/Open questions; plan.md § Risks & mitigations | Mobile playability and resilience are under-specified: rotation is keyboard-only in the current codebase (no pointer drag), so phones without keyboards can only navigate faces via auto-rotate — the spec does not state this limitation. WebGL context loss on mobile (common) is not addressed at all (no recovery, no non-goal). "Playable on small devices" is therefore not substantiated. | Add an explicit mobile-input subsection stating rotation relies on auto-rotate plus any attached keyboard, and either (a) list WebGL context loss as an out-of-scope limitation with rationale, or (b) add minimal context-loss recovery to scope. Reconcile with Q-1. | open |
| F7 | MAJOR | spec.md AC-6/AC-7; session.ts `applyViewport` | Formula mismatches between spec and code: AC-7 pins `width / max(1, height)` but `applyViewport` uses `height > 0 ? width / height : 1` (differ for 0 < height < 1 and for height = 0 with width ≠ 1). AC-6 pins `window.devicePixelRatio` but the session reads `env.devicePixelRatio()` (the test seam). Also AC-8 references window `resize`/`orientationchange`, but sizing is driven by a `ResizeObserver` on the canvas (browser-env.ts); there is no window resize/orientation listener today. | Align the AC formulas with the code (`height > 0 ? width / height : 1`, `env.devicePixelRatio()`), or change the code deliberately and update tests. Specify the new `orientationchange` listener and its teardown/unsubscribe. Use the injected resize source terminology. | open |
| F8 | MAJOR | plan.md § Current-defect analysis (lines `scene.ts:33-64`, `main.tsx:5-11`) | `scene.ts:33-64` is cited as "createSceneAdapter has setSize but no resize listener" — false: those lines are imports and `scene.ts` has no `setSize`/listener. `main.tsx:5-11` "no resize bootstrap" is misleading because resize is handled by the `ResizeObserver` in `browser-env.ts`, not `main.tsx`. Defect analysis must be accurate. | Correct both citations: remove the fabricated `scene.ts` claim (session owns sizing), and restate `main.tsx` as "mounts into #root; no app-level resize bootstrap needed (ResizeObserver in browser-env)". | open |
| F9 | MINOR | spec.md AC-13; app.css buttons | "canvas focus" as a tap target ≥44px is not meaningful (the canvas fills the viewport); tap-target application on buttons must preserve existing SSR markup and focus styles. | Clarify AC-13 applies to the three interactive shell controls (Users on Server, Return to my cube, Retry) via `min-width`/`min-height: 44px` (or equivalent padding) in `app.css`, with no markup change. | open |
| F10 | MINOR | spec.md AC-1; plan.md | AC-1's "within 1px" full-viewport assertion and scrollbar check require a DOM; the workspace has no DOM test env (SSR-only), so evidence is manual-only. The manual pass steps and where they are recorded are not specified. | Add explicit manual verification steps (sizes to test, portrait/landscape, toolbar collapse) and require the build log to record them (AC-1 evidence). | open |
| F11 | MINOR | spec.md AC-8; plan.md § Resize data flow | Terminology says "Window resize / orientationchange" but the live path is a `ResizeObserver` on the canvas. Orientation changes are already observed indirectly via canvas resize. | Reconcile wording: keep the injected resize source as the trigger; treat `orientationchange` as an additional immediate trigger, not the primary one. | open |
| F12 | MINOR | spec.md Open questions Q-3/Q-4 | Portrait HUD/panel overlap and mobile GPU performance are acknowledged but unquantified (no concrete width breakpoints, no measurement plan). | Add a concrete portrait breakpoint or state "no breakpoint; rely on safe-area insets + existing max-width clamp" (Q-3 recommendation) and a profiling trigger for Q-4. | open |
| F13 | INFO | spec.md § Boundaries/Security/Containerization | Boundaries, security, containerization and real-time sections are consistent with AGENTS.md and the containerization contract; no new deps/services/ports. Smoke passes unchanged (AC-16/AC-16 of predecessor). No action. | None. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ❌ | AC-10 and scope overstate touch capability (drag rotates) relative to the accepted predecessor; mobile rotation limitation unaddressed. |
| Testability | ❌ | AC-6 references a non-existent `scene.setSize`; AC-7 formula and AC-8 debounce shape are ambiguous. |
| Boundaries | ✅ | Three tiers present; non-goals listed; no new deps; no container changes. |
| Dependency graph | ❌ | Overview contradicts `depends_on`; phantom T6. |
| Parallel safety | ⚠️ | `[P]` sets are disjoint, but `app.css` ownership is split ambiguously between T1 and T4 (F4). |
| Security | ✅ | No new user data, persistence, secrets, or deps. |
| Testing | ✅ | Unit + integration tiers named; `npm run coverage` with ≥80% thresholds referenced; no new exclusions. |
| Consistency | ❌ | Contradicts `cube-tile-lines-and-controls` (drags do nothing) and misstates `scene.ts`/`main.tsx` defects (F1, F2, F8). |

## Previous round verification (if iteration > 1)
n/a — round 1.

## Ordered fix list (required before re-review)

1. Fix AC-10 and touch scope: tap explodes, drag does nothing (parity with mouse); remove drag-to-rotate claims; revise Q-1 and add mobile rotation limitation (F1, F6).
2. Re-target resize ACs at `session.applyViewport`/`env.resize`/`RendererAdapter`; remove fabricated `scene.ts:33-64` citation and correct `main.tsx` (F2, F8).
3. Align AC-6/AC-7 formulas with code or change code deliberately; specify debounce shape and attach-time immediacy; add orientationchange listener + teardown (F5, F7, F11).
4. Fix task overview and ownership: remove phantom T6; clarify T1 owns `app.css`, T4 verifies (F3, F4).
5. Clarify AC-13 tap targets and AC-1 manual verification steps (F9, F10).
6. Quantify Q-3/Q-4 or accept the recommended defaults explicitly (F12).

## Notes / backlog (non-blocking)
- WebGL context-loss recovery on mobile is a candidate follow-up feature; out of scope here unless added in F6.
- DPR cap stays `min(dpr, 2)` (`PIXEL_RATIO_CAP` in `effects.ts`) — no change (Q-2).
- No PWA manifest, orientation lock, or virtual joystick (Q-6, Q-1) — confirmed non-goals.
- Real-time/WS/container contracts untouched; `npm run smoke` remains the unchanged container gate.
