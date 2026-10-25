---
feature: fullscreen-responsive-layout
kind: spec
iteration: 2
verdict: approved
blocking: 0
---

# Spec Review — r2

## Summary

✅ approved — All 13 findings from spec-r1 (F1–F13) are closed with concrete, testable changes in the r2 spec/plan/tasks. The revised spec is internally consistent and feasible: touch input now correctly states tap explodes / drag does nothing (parity with the accepted predecessor), resize ACs are re-targeted at `session.applyViewport`/`env.resize`/`env.orientation` with a precise debounce shape, task-graph metadata and `app.css` ownership are corrected, and mobile limitations plus manual verification steps are explicit. All 14 ACs are binary-testable with concrete expected values and named evidence files. The task graph is acyclic with disjoint `files_owned` and `[P]` only on T3. Real-time and containerization contracts are preserved (out of scope, additive-only). Three MINOR wording/ownership refinements and three INFO notes remain; none blocks build.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F14 | MINOR | spec.md § Acceptance criteria (AC-6, AC-8) | AC-6 says "applyViewport runs" on a resize emission, while AC-8 says resize emissions are trailing-debounced and do not apply synchronously. The overlap could let a builder read AC-6 as requiring a synchronous apply. | Reword AC-6 to "schedules `applyViewport` (debounced for resize; immediate for orientation)" so the two ACs cannot be read as contradictory. | open |
| F15 | MINOR | tasks.md T4 `files_owned` | T4 owns `Hud.tsx`/`UserPanel.tsx`/`ConnectionBanner.tsx` but not `UserPanel.test.tsx`/`ConnectionBanner.test.tsx`, so any responsive markup change in those components cannot be accompanied by a test update without an unowned edit (the predecessor pins their SSR markup). | Add `UserPanel.test.tsx` and `ConnectionBanner.test.tsx` to T4 `files_owned` if markup changes are expected, or state explicitly that no markup changes are made in those two components. | open |
| F16 | MINOR | spec.md § Acceptance criteria (AC-1) | AC-1's "within 1px" full-viewport assertion is manual-only (no DOM test env); the manual steps are listed, but the build-log recording format (pass/fail per size) is only implied. | Keep the manual steps; require T1/T5 to record a small pass/fail table per size in the build log (already implied by § Testing strategy — make it explicit). | open |
| F17 | INFO | tasks.md T1 `files_owned` | `main.tsx` is listed as owned but the plan states the mount is unchanged (documentation only). | Remove `main.tsx` from T1 `files_owned` if no edit lands, or keep with a note that the only change is a comment. | open |
| F18 | INFO | tasks.md T3 acceptance / evidence | T3 owns AC-9/AC-10 but their evidence lives in T2-owned `session.test.ts`; T3 cannot independently update that file. | Acceptable as-is; verify at T5. No action required. | open |
| F19 | INFO | (unowned) `src/frontend/src/ui/GameCanvas.tsx` | `GameCanvas.tsx` is intentionally unowned (no markup change expected for AC-14). If responsive classes require touching it, ownership must be added first. | No action unless a change is needed. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Every ask covered by an AC or explicit non-goal; no scope invented. Touch scope now matches the accepted predecessor (tap explodes, drag does nothing). |
| Testability | ✅ | All 14 ACs binary-testable with concrete expected values and named evidence files; manual-only ACs (AC-1, AC-5) have explicit steps. |
| Boundaries | ✅ | Three tiers present; non-goals listed; no new deps. |
| Dependency graph | ✅ | Acyclic; overview matches `depends_on`; phantom T6 removed. |
| Parallel safety | ✅ | `[P]` only on T3; `files_owned` disjoint; `app.css` owned solely by T1 (F4 closed). Minor ownership gaps noted as F15/F17/F19. |
| Security | ✅ | No new user data, persistence, secrets, or deps. |
| Testing | ✅ | Unit + integration tiers named; `npm run coverage` with ≥80% thresholds referenced; no new exclusions; fake-timer contract specified for debounce. |
| Consistency | ✅ | Aligns with vision and accepted predecessors; defect citations corrected (F2, F8 closed). |
| Real-time | ✅ | Out of scope; connection lifecycle/reconnection/multi-client/server authority untouched; smoke unchanged. |
| Containers | ✅ | No services/images/ports/env changes; additive-only; `npm run smoke` remains the gate. |

## Previous round verification (r1 → r2)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (BLOCKER) | fixed | spec.md § Acceptance criteria AC-9/AC-10; spec.md § Scope (Touch input); spec.md § User stories; plan.md § Touch input design — tap explodes, drag does nothing, parity with mouse; "drag to rotate" removed. |
| F2 (BLOCKER) | fixed | spec.md AC-6/AC-7/AC-8; plan.md § Current-defect analysis & § Resize data flow — re-targeted at `session.applyViewport`/`env.resize`/`RendererAdapter`; no `scene.setSize`. |
| F3 (MAJOR) | fixed | tasks.md § Dependency overview — "T1 first; then T2 ∥ T4; T3 after T2; T5 after T2, T3, T4" matches `depends_on`; phantom T6 removed. |
| F4 (MAJOR) | fixed | tasks.md T1/T4 `files_owned` + notes — T1 owns all `app.css` edits; T4 must not edit `app.css`. |
| F5 (MAJOR) | fixed | spec.md AC-8 — trailing debounce ≤ 16 ms via `setTimeout`, attach-time direct, orientation immediate, teardown cancels; fake-timer contract named. |
| F6 (MAJOR) | fixed | spec.md § Summary/Scope/§ Risks & Open questions Q-1 — mobile rotation limitation stated; WebGL context loss listed as out-of-scope limitation. |
| F7 (MAJOR) | fixed | spec.md AC-6/AC-7 — formulas aligned to code (`height > 0 ? width / height : 1`, `env.devicePixelRatio()`); injected resize source terminology used. |
| F8 (MAJOR) | fixed | plan.md § Current-defect analysis — fabricated `scene.ts:33-64` claim removed; `main.tsx` restated as no resize bootstrap (ResizeObserver in browser-env). |
| F9 (MINOR) | fixed | spec.md AC-13 — tap targets on the three interactive shell controls via `min-width`/`min-height: 44px` in `app.css`, no markup change; canvas focus excluded. |
| F10 (MINOR) | fixed | spec.md § Testing strategy — manual verification steps (sizes, portrait/landscape, toolbar collapse, safe-area) and build-log recording. |
| F11 (MINOR) | fixed | spec.md AC-8 / plan.md § Resize data flow — injected resize source is primary trigger; `orientationchange` is an additional immediate trigger. |
| F12 (MINOR) | fixed | spec.md Open questions Q-3/Q-4 — no portrait breakpoint (safe-area + existing clamp) and a profiling trigger for Q-4. |
| F13 (INFO) | fixed | spec.md § Boundaries/Security/Real-time/Containerization — consistent with AGENTS.md and the containerization contract; no new deps/services/ports. |

## Per-AC verification

| AC | Binary-testable | Concrete expected values | Named evidence file(s) | Verdict |
| --- | --- | --- | --- | --- |
| AC-1 | ✅ (manual) | width = `window.innerWidth`, height = `window.innerHeight` within 1 px; no scrollbars; portrait + landscape | `App.test.tsx` + manual pass in build log | ✅ |
| AC-2 | ✅ | grep `100dvh` + `100vh` fallback in `app.css` | `app.css` | ✅ |
| AC-3 | ✅ | no aspect-ratio box / `max-width`/`max-height` clamp on `main`/`canvas`/`#root` | `app.css` | ✅ |
| AC-4 | ✅ | overlays absolutely positioned; `pointer-events` only on interactive parts; no scroll | `app.css`, `App.test.tsx` | ✅ |
| AC-5 | ✅ (manual) | `env(safe-area-inset-*)` padding ≥ inset on all four sides | `app.css` + manual | ✅ |
| AC-6 | ✅ | `setPixelRatio(min(env.devicePixelRatio(), 2))` (dpr 3 → 2); `setSize(rect.width, rect.height)`, `rect = getBoundingClientRect()`; includes empty rect | `session.test.ts` | ✅ |
| AC-7 | ✅ | `view.camera.aspect === (rect.height > 0 ? rect.width / rect.height : 1)`; `updateProjectionMatrix()` invoked | `session.test.ts` | ✅ |
| AC-8 | ✅ | trailing debounce ≤ 16 ms (`setTimeout`); no synchronous apply; attach-time direct; orientation immediate (clears pending timer); teardown cancels timer + unsubscribes both sources | `session.test.ts` (fake timers) | ✅ |
| AC-9 | ✅ | tap < 40 px explodes front face, identical to mouse tap; pointerType-agnostic | `gestures.test.ts`/`session.test.ts` | ✅ |
| AC-10 | ✅ | drag beyond threshold → no rotation, no explosion, no dispatch, snapshot identity unchanged | `gestures.test.ts`/`session.test.ts` | ✅ |
| AC-11 | ✅ | spectate travel/view-only gates touch like mouse/keyboard | `spectate.test.ts`/`session.test.ts` | ✅ |
| AC-12 | ✅ (inspection) | no on-screen joystick/rotate control added | inspection | ✅ |
| AC-13 | ✅ | `min-width`/`min-height: 44px` (or equivalent padding) on the three shell controls in `app.css`; no markup change | `app.css` + inspection | ✅ |
| AC-14 | ✅ | focusable canvas with stable aria-label; single `role="status" aria-live="polite"` in all phases; reduced-motion unchanged; no orientation-lock meta in `index.html` | `App.test.tsx`, `index.html` | ✅ |

## Notes / backlog (non-blocking)

- WebGL context-loss recovery on mobile remains a candidate follow-up feature (out of scope; a browser reload recovers).
- DPR cap stays `min(dpr, 2)` (`PIXEL_RATIO_CAP` in `effects.ts`) — no change (Q-2).
- No PWA manifest, orientation lock, or virtual joystick (Q-6, Q-1) — confirmed non-goals.
- Real-time/WS/container contracts untouched; `npm run smoke` remains the unchanged container gate.
- Minor refinements F14–F16 are recommended before/during build but do not block it.