---
feature: modern-visual-overhaul
phase: spec
iteration: 2
verdict: approved
blocking: 0
nonblocking: 3
---

# Spec Review — r2

## Summary
✅ approved — r2 resolves all eleven r1 findings (F1–F11): the AC-2 twinkle formula is now single-form, the pulse-phase/reduced-motion contract and constant export modules are pinned, the user story is reworded to star-driven ambient fill with shadow strength fixed as a non-goal, the HUD button click and `pointer-events: auto` rule are specified, and the container verification command is corrected and validated. Dependency graph, parallel safety, boundaries, real-time and container scoping remain sound. Three minor/info clean-ups remain (F12–F14).

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F12 | MINOR | plan.md § Risks & mitigations | The risk note still quotes the superseded r1 values ("amplitude small (0.05 around 0.95)"), contradicting the pinned AC-2 constants (`STARFIELD_OPACITY_AMPLITUDE === 0.1` around `STARFIELD_OPACITY_BASE === 1.0`). | Update the risk line to the pinned 0.1/1.0 values (or remove the numeric mitigation). | open |
| F13 | MINOR | spec.md § Acceptance criteria (AC-3) | AC-3 asserts `AMBIENT_INTENSITY === 0.6` but, unlike F3's constants, does not state the defining module/export status, leaving it unclear whether scene tests should import it or use the literal. | State that `AMBIENT_INTENSITY` is defined in `src/frontend/src/render/scene.ts` (module-private is acceptable) or exported, matching the F3 convention. | open |
| F14 | INFO | tasks.md (T3) | `T3` declares `depends_on: T1`, but the spaceship refinement does not consume the starfield or its constants (only `SPACESHIP_*` from `game/effects.ts`). The edge is harmless but reduces parallelism. | Drop the `T1` dependency from T3 (or document the actual reason) to maximize parallel build. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All asks mapped to ACs; F4 resolved by rewording to star-driven fill light plus explicit non-goal on key-light/shadow scaling. |
| Testability | ✅ | AC-1..AC-10 concrete and single-behavior; F1–F3 resolved. F13 is a minor export-location clarity gap. |
| Boundaries | ✅ | Three tiers present; non-goals listed (incl. shadow-strength non-goal). |
| Dependency graph | ✅ | Acyclic; all ACs mapped; tasks sized for one builder session. F14 is a harmless extra edge. |
| Parallel safety | ✅ | `[P]` T3 files disjoint from T1/T2/T4/T5. |
| Security | ✅ | No new deps, no data/network, no secrets. |
| Testing | ✅ | Unit + integration named; `npm run coverage` with ≥ 80% thresholds referenced; concrete-assertion bar stated. |
| Consistency | ✅ | Aligns with stack/container constraints; F12 is a stale plan risk note. |
| Risks | ✅ | r1 ambiguities (F1, F2, F4, F5, F6) resolved; remaining items are minor. |
| Real-time | ✅ | Explicitly local-only; no shared state; Q-1 flagged. |
| Containers | ✅ | F6 command corrected and validated (`git ls-files` pathspec resolves backend + Dockerfiles); no container change claimed. |

## Previous round verification (r1 findings)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) | fixed | spec.md § AC-2 now contains a single pinned formula (`STARFIELD_OPACITY_BASE - STARFIELD_OPACITY_AMPLITUDE * (0.5 - 0.5 * cos(2π * pulseTimeMs / STARFIELD_PULSE_PERIOD_MS))`) with no draft/alternative lines. |
| F2 (r1) | fixed | spec.md § AC-2 pins `readonly pulseTimeMs: number`, the `reducedMotion` 4th param (default `false`), and reduced-motion opacity `1.0`; Assumptions § states scene forwards `reducedMotion`. |
| F3 (r1) | fixed | spec.md § AC-1/AC-2/AC-5 state exporting modules (`render/starfield.ts`, `game/effects.ts`) for each named constant. |
| F4 (r1) | fixed | spec.md § User stories + Non-goals reword to star-driven fill light and fix shadow strength; plan.md Key decision 6 records it. |
| F5 (r1) | fixed | spec.md § AC-6 button calls `onToggleMinimize` on click; § AC-7 grants `pointer-events: auto` to `main > section button`. |
| F6 (r1) | fixed | spec.md § AC-9 command validated against `git ls-files` (resolves `src/backend/**` and `**/Dockerfile`). |
| F7 (r1) | fixed | spec.md § AC-3 removes the rebuild clause ("created once per scene; no rebuild path"). |
| F8 (r1) | fixed | spec.md § AC-5 scopes materials to meshes under `spaceship.group` (excluding `shotsGroup`). |
| F9 (r1) | fixed | tasks.md T3 notes update `spaceship.test.ts` to require wing meshes/standard materials. |
| F10 (r1) | fixed | spec.md § AC-6 clarifies button render condition and keyboard focusability. |
| F11 (r1) | fixed | plan.md § Architecture/App wiring and tasks.md T5 record minimize applies only to the `Hud` branch. |

## Notes / backlog (non-blocking)

- F12–F14 are non-blocking clean-ups; the spec is approved for build.
- Q-1..Q-6 remain user checkpoints carried in spec.md § Open questions (defaults chosen).
- `docs/features/README.md` row update is orchestrator-owned; Tfinal should append/update only the `modern-visual-overhaul` row. (Carried over from r1.)