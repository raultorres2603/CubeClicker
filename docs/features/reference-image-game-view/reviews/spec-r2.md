---
feature: reference-image-game-view
phase: spec
iteration: 2
verdict: approved
blocking: 0
nonblocking: 4
---
# Spec Review — r2

## Summary

✅ approved — all nine r1 blocking findings (F1–F9) are resolved and every non-blocking finding F10–F17 is folded in or explicitly dispositioned. The revised package is internally consistent on the nine-token contract, the panel/badge reset declarations, the T12→T11/T13 resequencing, and the `BASE`-based final gates. Four residual MINOR documentation/verification gaps (protected-set parity, unpinned import/budget evidence, one missing predecessor-supersession note, and one task-note omission) are backlog and do not block building.

## Findings (round 2 — new only)

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| N1 | MINOR | `spec.md` AC-1 (lines 54-58), AC-20 (line 98), supersession AC-18 bullet (line 180); `tasks.md` T15 verify (lines 175-179) | AC-1/AC-20 protected sets omit `src/frontend/src/ui/app.css` and `app.css.test.ts`, which T15 gates in a separate `BASE` set, so the "match verbatim" property does not hold. Also, the sentence that the remaining `metallic-hud-frames` AC-18 files (`AuthMenu.tsx`, `AuthForms.tsx`, `ConnectionBanner.tsx`, `VerificationPending.tsx`, `VerifyEmail.tsx`) "remain covered by the final diff gate" is not backed by any AC-1/AC-20/T15 command. | Add `src/frontend/src/ui/app.css` and `src/frontend/src/ui/app.css.test.ts` to the AC-1/AC-20 unchanged set (or state AC-8 owns that gate and cross-reference it), and either add the remaining AC-18 production files/tests to a T15 protected set or correct the sentence to reference the predecessor AC-18 gate. | open |
| N2 | MINOR | `spec.md` AC-20 (line 98); `tasks.md` T15 verify (lines 169-181) | AC-20 asserts no import outside React/workspace modules/`three`/`three/examples/jsm/*` and that the 350 KB gzip budget remains, but T15 pins only `npm run build`; no command records the import scan or a gzip-size pass/fail, so the evidence is not reproducible. | Add named commands to T15 (an import grep restricted to the allowed modules; the build-output gzip total compared with 350 KB) and paste both outputs in `build-log-T15.md`. | open |
| N3 | MINOR | `spec.md` § Superseded predecessor criteria (lines 167-206); `docs/features/cube-world-transition/spec.md` § Non-goals (line 153) and AC-4 (line 147) | AC-13 retunes `CUBE_STYLES[0]` (palette/name/metalness/roughness) while `cube-world-transition`'s non-goal says "No change to ... style values" and AC-4 retains "the style list"; the supersession list does not mention that predecessor. Ids/order/cycling are retained, so the accepted style-list contract still holds and this is not a contradiction that blocks. | Add one supersession line: `cube-world-transition` § Non-goals / AC-4 "style list" is superseded only for the `CUBE_STYLES[0]` palette/name; ids, order and cycling remain authoritative. | open |
| N4 | MINOR | `tasks.md` T11 notes (line 136); `src/frontend/src/render/scene.test.ts:473-478` | T11 enumerates the exact child counts and palette literals to update but omits the existing "sets a black background..." assertion that `scene.background` is `Color(0x000000)`; AC-10 requires the nebula texture, so this test must change too. | Add "replace/rename the black-background assertion at `scene.test.ts:473-478` with `scene.background === view.cosmicBackdrop.nebulaTexture`" to T11's exact update list. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Every reference element is mapped; F1–F17 are addressed; no user ask is dropped; Q-1/Q-2 and the non-goals cover the approximated artwork and topology. N1–N4 are verification/doc consistency, not missing asks. |
| Testability | ✅ | All 22 ACs are binary-testable with named evidence; `npm run coverage` and the 80% thresholds are pinned; N2/N4 are evidence/task-note gaps, not AC ambiguity. |
| Boundaries | ✅ | Three tiers are present; T15 no longer owns the orchestrator feature index; no predecessor spec is edited. |
| Dependency graph | ✅ | Acyclic; T10+T12→T11, T12→T13; every AC maps to at least one task; T15 is the single final gate. |
| Parallel safety | ✅ | Group A `{T1,T3,T9,T12,T14}` and Group B `{T4–T7,T13}` have disjoint `files_owned`; T12 owns `world.test.ts`, T13 `cube-view.test.ts`, T11 `scene.test.ts`; no shared-file collisions. |
| Security | ✅ | No new dependency, asset, URL, user data, storage or secret; procedural texture/geometry only; fixed resource counts. |
| Testing | ✅ | Unit + integration + manual tiers; concrete assertions; `npm run coverage` with ≥80 statements/branches/functions/lines per workspace; no new exclusions. N2 is an evidence-pin gap. |
| Consistency | ✅ | Nine tokens and grouped declarations are identical across spec/plan/tasks/CSS guard; T12→T11/T13 is fixed; N1/N3 are residual documentation-level gaps. |
| Accessibility & responsive | ✅ | Contrast independently verified (HUD text 18.03/12.49/17.03/8.81; white on badge 4.66/7.46; white on `#16a34a` 3.30); 44px targets, focus rings, reduced motion; 2:1, 375×667, 320×568 and 768×1024 matrix. |
| Real-time & containers | ✅ | No shared/cross-client state, protocol, service, image, port, environment variable, health signal, compose entry or Dockerfile change; `/ws` and the `podman compose up` path are untouched; AC-20 gates them. |
| Documentation | ✅ | T15 includes the docs pass; `docs/features/README.md` is proposal-only; root `README.md` is conditional; N1 is the auth/app.css gate note. |

## Previous round verification (F1–F17)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 | resolved | `world.test.ts` added to T12 `files_owned`; T13 and T11 depend on T12; every old style-0 literal enumerated (`world.test.ts:165,168,309`; `cube-view.test.ts:321-326,329,855-856`; `scene.test.ts:1596,1623`); AC-13 names all four test files; DAG, mermaid, overview and groups updated. |
| F2 | resolved | AC-5/T2 use `.user-panel > .users-badge` (0,2,0) with the full reset; verified against `app.css` `.user-panel > button` (0,1,1); the hover form is (0,3,0) vs (0,2,1). |
| F3 | resolved | `.user-panel .users-list::before` (0,2,1) is in the `content: none` reset; `app.css` paints no `.user-panel section::after`, so no `::after` reset is needed. |
| F4 | resolved | One grouped panel rule with the complete declaration set (border, `border-image`, radius, gradient, glow, both backdrop filters, `clip-path`, `filter`) covers all four gameplay surfaces; T2 and the CSS guard match. |
| F5 | resolved | Nine `:root` tokens with exact values are identical in AC-3, the plan CSS contract and T1/T2; `theme.ts` mirrors all nine; the CSS guard reads both files. |
| F6 | resolved | AC-1 is scoped to production non-test `game/**`; `progression.ts`/`progression.test.ts` are explicitly allowed; the glob+exclude diff and status gates are pinned; T15 mirrors them. |
| F7 | resolved | The supersession list adds `theme.ts` additive tokens, the `.upgrades-panel` metallic-frame clause, both "Black background" clauses and the `cube-game-frontend` no-addons precedent with the existing `three/examples/jsm/*` precedent. Predecessor specs are unedited. N1/N3 are residual documentation gaps. |
| F8 | resolved | Nebula stops/hue ranges/pixel/variance constants are exported; comet/hero colours, positions, rotation and the seven-mesh set are pinned; T9/T10 carry the evidence. |
| F9 | resolved | AC-1/AC-20/T15 use the recorded `BASE` with `git diff --exit-code "$BASE"...HEAD -- <paths>` plus `test -z "$(git status --porcelain -- <paths>)"`; T15 adds the `app.css`/`app.css.test.ts` set; both outputs are pasted in `build-log-T15.md`. N1/N2 are residual gate/evidence gaps. |
| F10 | resolved | T11 enumerates `scene.children` 8→9 at 481/1689/1737, 9→10 at 1779/1986 and `baselineObjects` 32→60 at 1651; `createCosmicBackdrop` is constructed after `createStarfield`/`createBackgroundLife` and appended as the ninth child; verified against `scene.test.ts`. N4 is a task-note omission. |
| F11 | resolved | The camera-anchored plane fallback is removed; AC-10 requires the texture and an invisible texture is a blocked condition requiring a spec revision; plan risk and T11 notes align. |
| F12 | resolved | `docs/features/README.md` is removed from T15 `files_owned`; the proposed row diff is recorded in `build-log-T15.md` for the orchestrator; this matches `docs/architecture/documentation.md` ownership. |
| F13 | resolved | The ≤720px bottom-band stack and `main[data-customization-open='true'] .upgrades-panel { display: none; }` are pinned; 375×667, 320×568 and 768×1024 checks plus the usable-upgrade-row check are added. |
| F14 | resolved | 2560×1280 (2:1) is added to AC-17 and the manual matrix; 2560×1080 remains as the extra 21:9 case. |
| F15 | resolved | `.connection-banner` and `.phase-announcement` are added to the absence guard in AC-8/T2. |
| F16 | resolved | AC-2/T2 state that unchanged `app.css` owns the four base corners; the guard reads `app.css` and asserts no base position duplication in `game-view.css`. |
| F17 | resolved | AC-22 adds 10-second idle/rapid-click frame-time traces at 1280×720 and 1920×1080 (average ≤ 16.7 ms, p95 ≤ 33 ms) and records the object/geometry growth. |

## Coverage / traceability summary

- **AC → task:** AC-1→T15; AC-2→T2,T8; AC-3→T1,T2; AC-4→T4,T8; AC-5→T1,T2,T5,T8; AC-6→T2,T6,T8; AC-7→T2,T7,T8; AC-8→T2; AC-9→T9; AC-10→T11; AC-11→T10; AC-12→T10,T11; AC-13→T11,T12,T13; AC-14→T13; AC-15→T14; AC-16→T11; AC-17→T15; AC-18→T2,T8,T15; AC-19→T1,T2,T3,T4,T5,T6,T7,T10; AC-20→T15; AC-21→T15 (and every task's pre-gate); AC-22→T15. All 22 ACs are mapped; no orphan AC.
- **Task → AC:** every task lists acceptance; T15 claims final verification for all prior ACs.
- **DAG:** acyclic; T12→T11 and T12→T13; T10+T12→T11; T2+T4..T7→T8; T1–T14→T15. The two parallel groups are disjoint and the sequential tasks are correctly marked.
- **Palette literal ownership:** every old style-0 literal in `src/frontend/src` is covered by T11/T12/T13 (`progression.test.ts`, `world.test.ts`, `cube-view.test.ts`, `scene.test.ts`); no other source/test file asserts the old palette.
- **Scene counts:** verified `scene.children` 8 at 481/1689/1737, 9 at 1779/1986 and `baselineObjects` 32 at 1651; 32 + `COSMIC_BACKDROP_OBJECT_COUNT` 28 = 60.
- **CSS contract:** the nine tokens and the grouped panel declarations are identical across spec/plan/tasks; the specificity table matches the implementation; no `!important`.
- **Coverage:** `npm run coverage` with 80 thresholds in both workspaces; frontend pre-gate per task; no new exclusions; new modules ship their tests in the same task.
- **Evidence:** the `BASE` diff gates, the manual width/mobile matrix and the frame-time traces are recorded; N2/N4 pin the remaining evidence/task-note gaps.

## Notes / backlog (non-blocking)

- **N1 MINOR** — protected-set parity: add `app.css`/`app.css.test.ts` to AC-1/AC-20 (or cross-reference AC-8), and back the remaining AC-18 auth files with a real gate or correct the sentence.
- **N2 MINOR** — pin the import scan and the 350 KB gzip-budget check in T15's recorded verification.
- **N3 MINOR** — add the `cube-world-transition` style-values supersession note (ids/order/cycling retained).
- **N4 MINOR** — name the `scene.test.ts:473-478` black-background update in T11's exact update list.
- **INFO** — manual visual/frame-time evidence is accepted by project precedent; pixel/perceptual automation is a recorded non-goal.
