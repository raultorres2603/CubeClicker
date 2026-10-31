---
feature: modern-visual-overhaul
phase: spec
iteration: 1
verdict: changes_requested
blocking: 6
nonblocking: 5
---

# Spec Review — r1

## Summary
❌ changes requested — the spec has six MAJOR ambiguities/gaps (pulse-phase contract, constant exports, formula noise, shadow-vs-fill completeness, HUD interaction/pointer-events, malformed container verification) that will produce wrong or unverifiable work. Dependency graph, parallel safety, boundaries and real-time/container scoping are sound.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | spec.md § Acceptance criteria (AC-2) | AC-2 contains contradictory draft notes ("At pulseTimeMs === 0 opacity is 0.95? Wait formula gives…", "opacity = 0.95 + 0.05 * cos…", and a "Simpler" alternative) alongside the final pinned formula. The noise makes the authoritative value ambiguous to the builder and reviewers. | Remove all draft/alternative formula lines; keep only the final pinned formula and its constants. | open |
| F2 | MAJOR | spec.md § Acceptance criteria (AC-2, AC-8) | The starfield's pulse phase is said to be "exposed" but no contract is defined (property name, type, readonly, where). AC-8 requires twinkle to disable under reduced motion, but `Starfield.update` takes no `reducedMotion` argument and `createStarfield` takes no option, so there is no defined way to propagate reduced motion. AC-8 also leaves the reduced-motion opacity as an open question ("0.95? or 1.0?"). | Pin `Starfield.pulseTimeMs: number` (readonly) and either add an optional `reducedMotion` parameter to `update` (or a `createStarfield` option) plus how `scene.update` forwards `reducedMotion`; pin reduced-motion opacity to `1.0`. | open |
| F3 | MAJOR | spec.md § Acceptance criteria (AC-1, AC-2, AC-5) | ACs assert named constants (`STAR_MIN_BRIGHTNESS`, `STAR_SIZE`, `STARFIELD_PULSE_PERIOD_MS`, `STARFIELD_OPACITY_BASE`, `STARFIELD_OPACITY_AMPLITUDE`, `SPACESHIP_SCALE`, `SPACESHIP_IGNITION_COUNT`) but never state which module exports them. Several (`STAR_SIZE`, `STAR_MIN_BRIGHTNESS`) are currently module-private, so the pinned evidence tests cannot import them. | State the exporting module for each constant (e.g. `render/starfield.ts` for starfield constants, `game/effects.ts` for spaceship constants) and require them to be exported. | open |
| F4 | MAJOR | spec.md § User stories / AC-3 | The user story promises "shadows whose strength follows the starfield brightness", but AC-3 only scales the ambient fill light; no AC scales key-light intensity or shadow strength, so the stated ask is not covered by any AC or non-goal. | Either reword the user story/AC to "star-driven fill light" (current mechanism) or add an AC that scales shadow/key-light intensity with `averageBrightness`; state the chosen mechanism explicitly. | open |
| F5 | MAJOR | spec.md § Acceptance criteria (AC-6, AC-7) | AC-6 renders a minimize `<button>` but specifies no `onClick`/handler, so minimize cannot actually toggle; and the HUD section has `pointer-events: none`, so a button inside it is never clickable unless CSS grants `pointer-events: auto`. AC-7 does not require that. | Add to AC-6 that the button calls `onToggleMinimize` on click; add to AC-7 a `pointer-events: auto` rule for `main > section button` (or the minimize button). | open |
| F6 | MAJOR | spec.md § Acceptance criteria (AC-9); tasks.md (Tfinal verify) | The container verification command `git diff -- compose.yaml compose.smoke.yaml src/backend Dockerfile` is malformed (`Dockerfile` is not a path) and omits the frontend Dockerfile, so the "no container change" gate is not actually executable/complete. | Fix the command to check `compose.yaml`, `compose.smoke.yaml`, `src/backend/**`, `src/frontend/Dockerfile` (and any `**/Dockerfile`) and state it in both AC-9 and Tfinal. | open |
| F7 | MINOR | spec.md § Acceptance criteria (AC-3) | "re-applies it when the starfield is rebuilt" is moot — the starfield is created once and never rebuilt; the phrase implies a code path that does not exist. | Reword to "on construction" (and remove the rebuild clause) or define when recreation occurs. | open |
| F8 | MINOR | spec.md § Acceptance criteria (AC-5) | "All spaceship meshes use MeshStandardMaterial…" is ambiguous about scope: shot spheres use `MeshBasicMaterial` in a separate `shotsGroup`. | Clarify "all meshes under `spaceship.group`" (excluding shots) and keep shot material unconstrained. | open |
| F9 | MINOR | spec.md § Acceptance criteria (AC-5) | The existing `spaceship.test.ts` asserts "no BoxGeometry"; AC-5 now requires wing `BoxGeometry` meshes, so that assertion must be inverted. The spec does not note this test edit. | Note in T3 that `spaceship.test.ts` is updated to require the wing meshes (and standard materials) instead of forbidding BoxGeometry. | open |
| F10 | INFO | spec.md § Acceptance criteria (AC-6) | AC-6 does not state that `onToggleMinimize` is optional-only for rendering the button (already implied) or that the button receives keyboard focus; minor clarity. | Clarify button is rendered iff `onToggleMinimize` is provided and is a normal focusable button. | open |
| F11 | INFO | tasks.md (T5) / plan.md | App wiring holds `hudMinimized` state and passes it to `Hud`, but does not specify whether minimize applies to the pre-welcome (non-`Hud`) stats section. | State default: minimize applies only to the `Hud` branch (pre-welcome section unchanged) or extend; record in plan. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ❌ | F4 — shadow-strength ask not mapped to an AC. |
| Testability | ❌ | F1, F2, F3 — ambiguous/unverifiable ACs. |
| Boundaries | ✅ | Three tiers present; non-goals listed. |
| Dependency graph | ✅ | Acyclic; all ACs mapped; tasks reasonably sized. |
| Parallel safety | ✅ | `[P]` T3 files disjoint from T1/T2/T4/T5. |
| Security | ✅ | No new deps, no data/network, no secrets. |
| Testing | ✅ | Unit + integration named; `npm run coverage` with ≥ 80% thresholds referenced. |
| Consistency | ✅ | Aligns with stack/container constraints; no backend/container change claimed. |
| Risks | ❌ | F1, F2, F4, F5, F6 name ambiguities that will surface mid-build. |
| Real-time | ✅ | Explicitly local-only; no shared state; Q-1 flagged. |
| Containers | ❌ | F6 — verification command malformed/incomplete. |

## Previous round verification (if iteration > 1)

N/A — first iteration.

## Notes / backlog (non-blocking)

- F7–F11 are non-blocking improvements; F1–F6 must be resolved before approval.
- Scope (Q-6) and reduced-motion starfield contract (F2) should be settled by the planner in r2.
- Documentation ownership of `docs/features/README.md` follows the established orchestrator-owned pattern; Tfinal proposes its own row update.