---
feature: spaceship-cursor-loot-animations
phase: spec
iteration: 2
verdict: changes_requested
blocking: 1
nonblocking: 9
---

# Spec Review — r2 (r3 package)

## Summary

The r3 package is a substantial, mostly successful disposition of the 27 r1 findings: the additive `parts-v2.ts` compatibility model, the 14 green-per-task structure, the 136-object / +21-draw baseline, migration appearance-value rewriting, the 1290 ms reveal, the observed-value corrections, legacy ownership, row-flash ownership, `picking.ts`, and the single `easeOutCubic` are all now pinned coherently.

One previous **MAJOR** is not actually fixed: **F12 (performance)**. The package now records the expected +21 draw calls and says a miss blocks, but it does not reduce draw calls or obtain explicit approval to change the accepted frame budget/quality tier. With the accepted 1920×1080 idle median at 16.694 ms against a 16.7 ms bar, this is still a design-vs-budget contradiction, not a resolved finding. Verdict: **changes_requested** on that one blocker; the remaining gaps are non-blocking precision/pre-build items.

## F1–F27 verification

| # | r1 severity | r3 status | Evidence / remaining issue |
| --- | --- | --- | --- |
| F1 | BLOCKER | **Fixed** | `tasks.md` has 14 green-per-task tasks (T1–T14); contract changes are additive (`parts-v2.ts`, protocol additions, repository v2 methods) and T9/T10/T12 own the consumers/tests they change. T1/T6 legacy modules stay untouched; T9 owns `effects/cube-view/world.test/spaceship/scene/targeting/impact`; T10 owns `protocol/types/engine/session/picking`; T12 owns `panel/App/CSS/HUD/upgrades/banner`. No later task is needed to fix an earlier test. (One compatibility note: T9 must keep `createSpaceship(appearance?)` accepting the old preview shape until T11; see N1.) |
| F2 | BLOCKER | **Fixed** | Scene baseline is **136** everywhere (spec AC-8/AC-47, plan § Scene data flow, T9 notes, T14): old cursor 8 → new 34 (+26), impact +5, targeting +3; `scene.children` stays 9/10 because both groups are under the particle group. Detailed-hero AC-13/AC-14 102 is superseded in the ledger. |
| F3 | BLOCKER | **Fixed** | AC-15/AC-33 rewrite appearance **values** (`wings-silver`→both `wing-left-silver`/`wing-right-silver`, `body-*`→`hull-*`, `engine-*`→both ignition ids), set version 2, and pin the exact AC-33 row fixture; plan § Migration 006 step 2 and T2 repeat it. |
| F4 | MAJOR | **Partially fixed (non-blocking)** | The detailed-hero AC-1 release scope and AC-13/14 136 supersession are present. The "exact" release list omits the modified protected **test** paths (`render/spaceship.test.ts`, `scene.test.ts`, `scene-spaceship.test.ts`, `cube-view.test.ts`, `picking.test.ts`); it lists only `spaceship.ts`, `scene.ts`, `cube-view.ts`, `picking.ts`, `world.test.ts`. Add those test files to the release list (or release all `render/**` except the hero files) so the "exact" claim is true. |
| F5 | BLOCKER | **Fixed (verification note)** | `parts-v2.ts` is additive in T1/T6; legacy `partCategory`/`randomPartId`/`appearanceToSpaceshipParams`/`SpaceshipVisualParams` remain until T5/T10/T12/T11 migrate. The plan promises a T14 production-import grep for legacy helpers, but T14's verify list does not include that grep (N2); add it. |
| F6 | MAJOR | **Fixed** | AC-29 now requires session-produced `pendingLootboxOpen`; T10 sets/clears it on send/`lootboxOpened`/`customizationUpdate`/`error`/status/`welcome`; T12 passes it to the panel. |
| F7 | MAJOR | **Fixed** | AC-41 is **1290 ms** (`420+250+120+360+140`), `lootboxTotalMs 1290`, plan/T12 CSS and T7 tokens align. |
| F8 | MAJOR | **Fixed** | `bannerPeakMs 250`, `levelCoinCount 20`, `debrisLifetimeMs 1200`; `reticleFadeMs 120` is explicitly `[E]`; AC-40's banner timing and the mapping table match § 4.8/§ 4.7. |
| F9 | MAJOR | **Fixed** | AC-4/plan/T8 now state rarity changes colour/accent/shape only; all structural hull-family parts use the AC-4 finish values (including `clearcoatRoughness 0.2`). |
| F10 | MAJOR | **Fixed** | AC-28/T5 pin all-or-nothing legacy ownership: `body-*` requires `hull-*`; `wings-*` requires both wing v2 parts; `engine-*` requires both ignition v2 parts; partial → `not_owned`; tests full/partial. |
| F11 | MAJOR | **Fixed** | AC-43/T12 own `data-equipping="true"` for `MOTION.equipRowFlashMs` (260 ms), CSS styled in T12, reduced-motion instant. |
| F12 | MAJOR | **NOT fixed (blocking)** | AC-8/47 now record old cursor 7 → new 22 (+15) + impact 4 + targeting 2 = **+21 draws**, 19 materials (+12), and T14 repeats it — but the design still adds those draws against a 16.694 ms / 16.7 ms idle bar with ~0.006 ms headroom. The plan only says "a reproducible miss blocks"; there is no draw-call reduction, merged-detail fallback, or explicit user approval of a budget/quality change. This is the one open major. |
| F13 | MAJOR | **Fixed** | AC-35/T10 add `pickHoverTarget` with preallocated NDC/result and one raycast per frame; `picking.ts`/test are in T10's `files_owned`; click-path allocation is explicitly separate. |
| F14 | MAJOR | **Fixed** | `easeOutCubic` lives only in `motion.ts`; T9's `effects.ts` re-exports it; plan/AC-34/T9 pin the single implementation. |
| F15 | MAJOR | **Fixed** | AC-16 normalizes whenever legacy keys/ids are present **or** version < 2; T4 tests a restored version-2 legacy row; plan § Read normalization repeats it. |
| F16 | MINOR | **Partially fixed (non-blocking)** | T13 now uses the feature `BASE` and a scoped `git status`. The exact `test -z "$(git status --porcelain -- docs/features/README.md)"` still fails in the current worktree because the accepted `detailed-hero-spaceship` row is uncommitted (F27). Either commit/freeze the predecessor row before T13 or drop the redundant `git status` test and rely on `git diff "$BASE"...HEAD`. |
| F17 | MINOR | **Fixed** | AC-50/T13 require both `granular spaceship parts` and the preserved `detailed blue/orange hero spaceship` phrase; T13 greps both. |
| F18 | MINOR | **Fixed** | AC-15/T2/plan use `value::numeric BETWEEN 0 AND 2147483647`; overflow-skip test. |
| F19 | MINOR | **Fixed** | AC-34/plan pin the exact 13 CSS-mapped tokens; T12 maps them on `main`; all other tokens are JS-only. |
| F20 | MINOR | **Partially fixed (non-blocking)** | § 8.1/§ 9 are marked historical, but `video-analysis.md` § 7 still recommends "160 ms pop scale + 350 ms burst; add a 1-frame conceal" and the § 8.2 lootbox keyframe still says 1040 ms. Mark those rows historical/point them at AC-36/AC-41 so a builder cannot use the superseded values. |
| F21 | MINOR | **Fixed** | AC-18/T5/plan use the captured hub `random` for `selectLootPart`, not a fresh `deps.random()`; draw order documented; seeded multi-open test. |
| F22 | MINOR | **Fixed** | AC-21/AC-28 now state the server-side legacy two-slot target-set exception explicitly. |
| F23 | MINOR | **Fixed** | `spaceship-cursor` AC-10 is superseded in the ledger to the migration 006/backend-scope extent, with no new service/port/env. |
| F24 | MINOR | **Fixed** | T2 records the pre-006 `pg_dump`/restore; T14 records the dump as acceptance evidence. |
| F25 | INFO | **Open (non-blocking)** | `status.md` still lists the old **T1–T23** task board and the stale video blocker (N3). Orchestrator-owned; update before the build starts. |
| F26 | INFO | **Fixed** | T14/AC-51 require real smoke; a skipped smoke is not a pass and Podman must be supplied before acceptance. |
| F27 | INFO | **Fixed (non-blocking note)** | `docs/features/README.md` remains unedited by this feature; T13 proposes the row. The worktree still carries the predecessor row (see F16). |

## New findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| N1 | MINOR | `tasks.md` T9 (line 170), T11 (line 201); `src/frontend/src/ui/SpaceshipPreview.tsx`; `plan.md` § Cursor model (247–250) | T9 rewrites `spaceship.ts` while `SpaceshipPreview.tsx` (owned by T11) still calls `createSpaceship(appearance)`. The plan says preview migrates in T11, so T9 must keep the constructor signature accepting the predecessor `Record<string,string>`/`Partial<SpaceshipVisualParams>` shape. T9's notes do not state this compatibility seam. | Add to T9: keep `createSpaceship(appearance?)` accepting the old shape (defaulting legacy keys to standard slots) until T11; add a T9 test for the old preview call; T11 then migrates it. | open |
| N2 | MINOR | `plan.md` § Additive compatibility (30–33); `tasks.md` T14 (238–251) | The plan promises a T14 production-import grep for legacy `parts.ts` helpers, but T14's verify list has no such grep (only bundle/loader/URL checks). | Add the exact grep to T14's verify and record its output; fail if a production file outside tests still imports `partCategory`/`randomPartId`/`appearanceToSpaceshipParams`/`SpaceshipVisualParams`. | open |
| N3 | MINOR | `status.md` (lines 15–37, 44–46) | The status task board still lists **T1–T23** (T15–T23-era names) and the stale "Reference video must be inspected" blocker, contradicting tasks.md's T1–T14 and Q-1 resolved. The user explicitly asked for no T15–T23 remnants. | Orchestrator-owned: replace the task board with T1–T14 and remove the stale blocker before build. | open |
| N4 | MINOR | `spec.md` AC-29 (310–316) | The new `pendingOpen` sentence ends with a period before "and exactly 10 `<li...>` rows"; the requirement reads as a fragment. | Join the two sentences / fix the paragraph so AC-29 is one readable requirement. | open |
| N5 | MINOR | `tasks.md` T4 (95–100); `spec.md` AC-16 (221–229); `plan.md` § Repository (100–108) | T4 says "keep old methods … add a v2 read path returning normalized state", but neither AC-16 nor the plan names that v2 read method; AC-16/plan name `findCustomizationByUserId`. If T4 adds a separately named method, AC-16 is not literally satisfied; if it changes the old method, the task's "old methods unchanged" wording is misleading. | Name the method explicitly (`findCustomizationByUserId` normalizes always; old `applyLootboxOpen`/`setAppearance` remain for compatibility) and align T4's tests. | open |
| N6 | MINOR | `plan.md` § Performance (265–269); `tasks.md` T9 (158–175), T14 (246–248) | AC-47/plan say "T9/T14 performance traces", but T9's verify is only the full workspace suite; no trace command/evidence is in T9's task. Early measurement is the only thing that could de-risk F12 before T14. | Add a T9 manual trace step (idle and 10 clicks/s at both sizes, three runs) to T9's build log, or state that T14 is the first measurement and accept the late block. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | 51 ACs, 14 tasks, all requested pillars and verification/docs/container criteria present; non-goals and boundaries complete. |
| Testability | ✅ | AC-41/AC-34 arithmetic and token map are now exact; AC-40 banner timing and AC-33 fixture are concrete; reduced-motion variants pinned. N4 is editorial only. |
| Boundaries | ✅ | Always/Ask-first/Never tiers and non-goals are consistent with server authority/local-only presentation. |
| Dependency graph | ✅ | T1–T14 acyclic; every dependency points earlier; T14 depends on T1–T13 and is last; no T15–T23 in tasks/plan/spec (status.md only — N3). |
| Parallel safety | ✅ | `files_owned` are disjoint; T1/T6 additive; T9/T10/T12 own the consumers/tests they change; no shared-file collision. |
| Predecessors | ⚠️ | Detailed-hero release scope/count supersession is present; exact release list omits protected test paths (F4). `spaceship-cursor` AC-10 is superseded (F23). |
| Performance | ❌ | **F12 remains a blocking design-vs-budget contradiction**: +21 draws/19 materials against 16.694 ms vs 16.7 ms; no reduction/approval, only a late hard gate. |
| Security | ✅ | Catalog/ownership validation, server-derived slots, parameterized SQL, no secrets, no client counts/rarity; migration overflow bounded (F18). |
| Real-time | ✅ | Account-scoped `customizationUpdate`, opener-only `lootboxOpened`, per-member open guard, atomic open/setSlot, reconnect/welcome state, guest no-persist; no cross-client visibility. |
| Containers | ✅ | Migration 006 only; no service/image/port/env/compose/Dockerfile/`/ws` change; T14 real smoke required; backup/restore pinned (F24). |
| Accessibility | ✅ | 44×44 targets, accent `:focus-visible`, native buttons, ARIA pressed/labels, `role="status"`, `aria-live`, locked entries non-focusable; reduced variants for every new animation. |
| Docs | ⚠️ | AC-50/T13 preserve the README phrase and glossary terms; T13's `git status` guard is fragile on the current worktree (F16); video-analysis § 7 still has stale 160 ms wording (F20); status.md is stale (F25/N3). |
| Consistency | ⚠️ | F4 exact release list and F20 § 7 are the remaining precision issues; the core AC/token/plan tables otherwise agree. |
| Testing | ✅ | Per-task full-workspace gates are structurally green; T14 final; coverage thresholds unchanged; no exclusion; N2's legacy grep is a verification gap, not a broken test. |

## AC → task traceability

| AC | Task(s) |
| --- | --- |
| AC-1, AC-2, AC-3, AC-4 | T8 |
| AC-5, AC-6, AC-7, AC-8, AC-9 | T9 (AC-7 also T6; AC-8 final T14) |
| AC-10, AC-11 | T1, T6 |
| AC-12, AC-13 | T1, T5, T6 |
| AC-14 | T2 |
| AC-15 | T2, T6 |
| AC-16 | T4, T6 |
| AC-17 | T4 |
| AC-18, AC-19, AC-20 | T5 |
| AC-21, AC-22 | T4, T5, T10 |
| AC-23, AC-24, AC-25 | T3, T10 |
| AC-26, AC-27 | T5, T10 |
| AC-28 | T5, T6, T10 |
| AC-29 | T10, T12 |
| AC-30 | T12, T14 |
| AC-31 | T11, T12 |
| AC-32 | T10, T12 |
| AC-33 | T4, T5, T10, T14 |
| AC-34 | T7, T14 |
| AC-35 | T9, T10, T14 |
| AC-36, AC-37, AC-38 | T9, T14 |
| AC-39 | T12, T14 |
| AC-40 | T9, T12, T14 |
| AC-41 | T12, T14 |
| AC-42 | T7, T9, T14 |
| AC-43 | T12, T14 |
| AC-44 | T9, T12, T14 |
| AC-45 | T14 |
| AC-46 | T14 |
| AC-47 | T9, T14 |
| AC-48 | T12, T14 |
| AC-49 | T14 |
| AC-50 | T13, T14 |
| AC-51 | T14 |

All 51 ACs map to at least one of T1–T14. T14's acceptance explicitly includes AC-8, AC-30, AC-34…AC-51 plus final verification of AC-1…AC-33.

## Previous round verification (r1 → r3)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 per-task green | fixed | T1–T14 additive/consumer-owned; full-workspace gates. |
| F2 scene count | fixed | 136 in spec/plan/T9/T14. |
| F3/F15 migration/normalization | fixed | AC-15/16/33, plan, T2/T4. |
| F4 predecessor | partially fixed | Release list omits protected test paths. |
| F5 compatibility | fixed | `parts-v2` additive; T14 legacy grep missing (N2). |
| F6–F11 | fixed | pendingOpen, 1290 ms, observed values, materials, legacy ownership, row flash. |
| F12 performance | **not fixed** | +21 draws/19 materials pinned; no reduction/approval vs 16.694 ms bar. |
| F13/F14 | fixed | `pickHoverTarget`; single `easeOutCubic`. |
| F16 | partially fixed | `git status` still fails on uncommitted predecessor row. |
| F17–F24 | fixed | README phrase, overflow, CSS map, RNG, legacy exception, AC-10 scope, pg_dump. |
| F20 | partially fixed | § 7 still recommends 160 ms; § 8.2 still 1040 ms. |
| F25/F27 | info | status.md stale (N3); docs index proposal remains. |
| F26 | fixed | real smoke required; skipped is not a pass. |

## Final build-readiness summary

**Not ready to build** until the performance blocker is resolved. The package is otherwise coherent and the r3 task graph is executable:

- **Blocking (1):** F12 — either reduce the net draw calls (e.g. merge the 21 cursor meshes into fewer per-material draws / merged-detail fallback) or obtain explicit user approval to relax the 16.7 ms budget or introduce a quality tier **before build**; a T14-only "a miss blocks" gate does not resolve the design-vs-budget contradiction.
- **Non-blocking (9):** F4 exact release list (add the protected test paths); F5/N2 T14 legacy-import grep; F16 predecessor-row freeze/`git status`; F20 video-analysis § 7/§ 8.2 stale wording; F25/N3 status.md T1–T23 remnants; N1 T9 `createSpaceship` compatibility note; N4 AC-29 editorial fragment; N5 T4 v2 read-method naming; N6 T9 early performance-trace step.
- **Prerequisites:** commit/freeze the predecessor `detailed-hero-spaceship` row; replace status.md's T1–T23 board with T1–T14; add the T14 legacy-import grep. None of these require a new spec round; they are build-log/docs/task-note fixes.
- **Accepted and verified:** additive `parts-v2`; 102→136 scene count; +21 net draws; cursor 34 objects / 21 meshes / 22 draws / 19 materials; impact +5; targeting +3; migration appearance-value rewrite + read normalization; 1290 ms reveal; observed values (250 ms banner peak, 20 level coins, 1200 ms debris, reticle fade `[E]`); legacy all-or-nothing ownership; row-flash ownership; `picking.ts`; single `easeOutCubic`; 13-token CSS map; docs/container/smoke guards. All 51 ACs map to T1–T14.
