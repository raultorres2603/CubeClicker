---
feature: spaceship-cursor-loot-animations
phase: spec
iteration: 1
verdict: changes_requested
blocking: 15
nonblocking: 12
---

# Spec Review — r1

## Summary

❌ **Changes requested.** The package is well structured and unusually well sourced (the video evidence and the `[O]`/`[E]` distinction are real), but it is not buildable as written: the per-task workspace coverage gates cannot pass, the scene-object baseline (`102 → 107`) is arithmetically wrong, migration 006 does not produce the AC-33 legacy appearance values, and the detailed-hero predecessor criteria changed by Pillars A/C are not fully superseded.

The 4 blockers and 11 majors below must be closed before build; the motion values that are actually observed are mostly pinned correctly, but several observed-block values contradict or exceed the video analysis and one reveal timeline does not add up.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | BLOCKER | `tasks.md` T1 (line 59), T2 (75), T4 (105), T5 (121), T7 (151), T11 (210), T13 (243), T14 (261); `plan.md` § Verification (838–841) | Every task's verify runs **full-workspace** `npm run coverage`, but the package deliberately leaves old tests for later tasks (e.g. T1 rewrites the 12-part catalog while `hub.test.ts`/`economy-repository.test.ts` still assert the old ids; T7 rewrites the frontend catalog while `engine.test.ts`/`session.test.ts` still use `body-gold`/`wings-default`). T1/T2/T4/T5/T7/T11/T13/T14 therefore cannot be green at their own gates. | Scope each per-task gate to the task's test files/changed files (e.g. `vitest run --coverage --coverage.include='src/game/parts.ts' src/game/parts.test.ts`), or consolidate consumer-test updates into the task that changes the contract, or run full-workspace coverage only at T23 and say so. Do not claim per-task full coverage with exclusive `files_owned`. | open |
| F2 | BLOCKER | `plan.md` § Scene data flow (59–64), § File inventory T13 (725–727); `spec.md` AC-8 (144–149), AC-47 (457–461); `tasks.md` T13 notes (253), T23 (409–417); `src/frontend/src/render/scene.test.ts:1657–1664`; `detailed-hero-spaceship/spec.md` AC-13 (76) | The pinned `countObjects(scene) 102 → 107` is wrong. The current scene holds the old 8-object cursor (group + 7 meshes); the new cursor is 34 objects (outer group + `cursor-ship-model` + 10 slot groups + 21 meshes + trail `Points`), i.e. **+26**, then impact `+5` (group + four drawables) and targeting `+3` (group + two `LineSegments`): the baseline is ~**136**, not 107. The targeting group is not accounted for at all. The accepted `detailed-hero-spaceship` AC-13 `countObjects(scene) === 102` and `scene.children.length === 9` are not superseded. | Recompute and pin the exact new baseline (model replacement + impact + targeting), update `scene.test.ts` and T13/T23, and add the detailed-hero AC-13/AC-14 count supersession to the ledger. | open |
| F3 | BLOCKER | `spec.md` AC-15 (192–200), AC-16 (201–207), AC-33 (318–324); `plan.md` § Migration 006 step 2 (368–380), § Repository (483–488) | Migration 006 moves the legacy appearance **key** (`wings`) to `wing-left`/`wing-right` but leaves the legacy **value** (`appearance->'wings'` = `wings-silver`) in both slots. AC-33 requires `appearance['wing-left']='wing-left-silver'` and `['wing-right']='wing-right-silver'`; the migration writes `wings-silver` twice, then sets `customization_version = 2`, so `findCustomizationByUserId` does not normalize on read. AC-15/16/28's exact mapping cannot be produced. | Rewrite legacy appearance values in migration 006 (`wings-silver` → `wing-left-silver` and `wing-right-silver`, `body-*` → `hull-*`, `engine-*` → `ignition-*-*`), or normalize values on every read when legacy keys/ids are present; add the exact AC-33 row fixture to `migration-006.test.ts` and `economy-repository.test.ts`. | open |
| F4 | MAJOR | `spec.md` § Superseded predecessor criteria (764–768), § Assumptions (854–855); `detailed-hero-spaceship/spec.md` AC-1 (52), AC-13 (76), AC-14 (78) | The ledger names the `detailed-hero-spaceship` AC-1 protected-path clause as superseded but narrows the explanation to "the cursor-ship protection and 'cursor out of scope' clauses"; the sentence "The hero ship … and its protected files are unchanged" is ambiguous because AC-1's protected list covered `src/backend`, `src/frontend/src/game`, `src/frontend/src/App.tsx`, `src/frontend/src/ui` and `src/frontend/src/render/{spaceship, scene, cube-view, world.test, picking}`, which this feature changes. AC-13's `countObjects(scene) === 102` / `scene.children.length === 9` and AC-14's scene-count line are not superseded at all. | State the exact AC-1 paths released and that only the hero-ship files/properties remain unchanged; explicitly supersede AC-13/AC-14's scene counts alongside F2. | open |
| F5 | BLOCKER | `tasks.md` T1 (54–68), T7 (146–158); `src/backend/src/game/hub.ts:102,874,906`; `src/frontend/src/game/engine.ts:103,1167,1187`; `src/frontend/src/render/scene.ts:89,873–895`; `src/frontend/src/render/spaceship.ts:35,125–152`; `src/frontend/src/ui/SpaceshipPreview.tsx:5,20,27` | T1/T7 rewrite `game/parts.ts` but do not state any compatibility contract for the symbols still imported by untouched files (`partCategory`, `randomPartId`, `appearanceToSpaceshipParams`, `SpaceshipVisualParams`). If they are removed as the new API implies, the workspace typecheck fails at T1/T7; no task owns the consumer files yet. | Pin a compatibility policy in T1/T7 (keep aliases/re-exports until T5/T11/T14/T16/T17 migrate, with tests pinning them), or include the consumer updates in the owning task without colliding `files_owned`. | open |
| F6 | MAJOR | `spec.md` AC-29 (281–291); `plan.md` § UI design (666–687); `tasks.md` T18 (319–330), T21 (366–380); `src/frontend/src/game/session.ts:896–906` | AC-29 requires the Open button disabled when `pendingOpen`, but nothing produces `pendingOpen`: the session has no pending-open state, T16's API has none, and T21's App wiring list omits it. The panel prop will always be undefined/false, so the in-flight state cannot be met or tested end-to-end. | Add a session `pendingLootboxOpen` (set on send, cleared on `lootboxOpened`/`customizationUpdate`/error/reconnect), pass it from App, and test the disabled state in T18/T21/T23; or remove `pendingOpen` from AC-29. | open |
| F7 | MAJOR | `spec.md` AC-41 (411–420); `plan.md` § Motion CSS (617–620), `MOTION` (274–275); `tasks.md` T19 (344–345) | AC-41's stage durations `420 + 250 + 120 + 360 + 140 = 1290 ms`, but the pinned `lootboxTotalMs` is `1040` and the CSS keyframe is 1040 ms. The plan's CSS has no separate 250 ms orb overshoot: it only has a 40–52 % `scale 1.25` flash. The orb does not get its own 420 ms charge + 250 ms overshoot sequence. | Reconcile the reveal timeline (e.g. 420 ms charge including the 250 ms overshoot, or set `lootboxTotalMs = 1290`), give the orb its own keyframe/token, and update `MOTION`, T19 CSS/tests, T18 tests and AC-41 together. | open |
| F8 | MAJOR | `spec.md` AC-34 (330–343), AC-40 (400–402), AC-46 (448–453); `video-analysis.md` § 4.8 (208–216), § 4.7 (199–200), § 4.3 (151–153); `reference/contact-3-detail.jpg` | Several values in the **observed `[O]`** block are not supported by the video analysis: `bannerPeakMs 370` contradicts § 4.8/contact-3 (1.08 at 7.875, first visible 7.625 ⇒ **≈250 ms**; settle ≈450 ms); `reticleFadeMs 120` is a § 7 recommendation, not a measured value; `levelCoinCount 12` is below § 4.7's "20+ gold coins" (the 3D pool may supply the rest, but the token is presented as observed); `debrisLifetimeMs 900` is below § 4.3's ">1.2 s" (within § 5's 0.8–2.0 s, but the mapping table says >1.2 s). | Correct the observed values (notably `bannerPeakMs = 250`), reclassify recommendation-only values as `[E]` or label them as implementation choices, and update AC-34/AC-40/AC-46 + the mapping table + T19/T20 tests so every `[O]` value is traceable to a frame/measurement. | open |
| F9 | MAJOR | `spec.md` AC-4 (107–117); `plan.md` § Materials (543–554); `src/frontend/src/render/spaceship.ts:37–41` | AC-4 pins the hull/underside/nose/wings/tail-fin metal values (`metalness 0.55`, `roughness 0.38`, `clearcoat 0.4`, `clearcoatRoughness 0.2`) with no rarity distinction. The plan invents rarity-specific finishes (`rare 0.65/0.30/0.5`, `epic 0.70/0.22/0.7`) and omits `clearcoatRoughness` for those finishes. A rare/epic hull would violate the AC; T10's "finish values" tests have no single source of truth. | Either remove the rarity-specific finish values (all hull-family parts use the AC-4 values) or add the complete rarity finish table to AC-4 and T10 tests; do not leave AC and plan in conflict. | open |
| F10 | MAJOR | `spec.md` AC-21 (231–235), AC-28 (274–280); `plan.md` § Hub design (507–514); `src/backend/src/game/hub.ts:889–915` | AC-28 accepts legacy `wings-*`/`engine-*` ids on equip and maps them to two slots, but the ownership rule is unpinned: after migration the legacy key no longer exists, so checking `parts['wings-silver'] > 0` yields `not_owned`; checking either mapped v2 part would let a user who owns only the left wing equip both. AC-21 also says "the target slot is derived from the catalog entry", which is not true for a two-slot legacy id. | Pin the legacy mapping + ownership rule (e.g. `body-*` → `hull-*` owned; `wings-*` → both `wing-left-*` and `wing-right-*` must be owned, partial → `not_owned`; `engine-*` same for both ignitions), add tests for full/partial ownership, and align AC-21's wording. | open |
| F11 | MAJOR | `spec.md` AC-43 (428–433); `plan.md` § UI design (666–687); `tasks.md` T18 (326–330), T19 (342–348) | AC-43 requires a 260 ms **part-equip row flash**, but no task owns its behavioral state: T18 adds the row and callbacks but not a flash state/class, T19 only defines CSS, and T20 does not touch the panel. `equipRowFlashMs` exists in `MOTION` with no producer. | Assign the row flash state/class/timer to T18 (or T21), have T19 style it, and add reduced-motion + T18/T23 tests. | open |
| F12 | MAJOR | `spec.md` AC-8 (141–149), AC-47 (454–461); `plan.md` § Frame budget (631–644) | The accepted 1920×1080 idle median is `16.694 ms` against a `16.7 ms` average bar (≈0.006 ms headroom). The feature adds a net ~+15 cursor draws (21 new meshes replacing 7 old, +1 trail), +4 impact draws and +2 targeting draws, plus 12 extra `MeshPhysicalMaterial`s. The plan's "low-poly / no shadows / pooled" mitigations do not reduce draw calls; a reproducible miss blocks and there is no quality tier. | Treat the frame bar as a design input: reduce draw calls (merge per-material geometry, reuse materials, simplify the model), or obtain explicit approval to change the budget/quality tier before build; record the expected net draw-call count in AC-8/47. | open |
| F13 | MAJOR | `spec.md` AC-35 (355–363); `plan.md` § Targeting (303–319); `tasks.md` T13 (238–254), T16 (285–300); `src/frontend/src/render/picking.ts:32–35,72` | AC-35 requires the hover pick to be "`pickMiniCube`; no allocation", but `pickMiniCube` allocates an id string and `raycaster.intersectObject` allocates intersection records per call. `picking.ts` is in **no** task's `files_owned`, so no builder can fix it without a scope violation. | Add `picking.ts`/`picking.test.ts` to T16 (or T13) with an allocation-free hover path (preallocated result, shared arrays), or soften AC-35 to "at most one raycast per frame, event coalescing" and test that instead. | open |
| F14 | MAJOR | `spec.md` AC-34 (350–357); `src/frontend/src/game/effects.ts:67–80`; `src/frontend/src/render/scene.ts:70–77`; `tasks.md` T8 (160–172), T12 (222–236), T13 (238–254) | AC-34 says `motion.ts` is the single home and "no second copy exists in `effects.ts`". `effects.ts` already exports `easeOutCubic`, `scene.ts` imports `easeOutCubic` from it, and T8 adds a second `easeOutCubic` in `motion.ts`. No task owns removing/re-exporting the old easing, and T12/T13 cannot remove it without breaking each other's typecheck. | Make `effects.ts` re-export the easing from `motion.ts` (single implementation) or add the dedupe to a task that owns both `effects.ts` and `scene.ts`; test the single source. | open |
| F15 | MAJOR | `plan.md` § Repository (483–488), § Rollback (824–834); `spec.md` AC-16 (201–207), Q-12 (821–824) | The plan says `normalizeCustomizationState` runs only when `customization_version < 2`, but also claims a manually restored legacy row "still renders" via repository normalization. A row restored into a 006 database takes the column default `2`, so it is **not** normalized on read; its legacy ids cannot be equipped and its appearance may not render. | Normalize when legacy keys/ids are present regardless of version, or make the restore path re-run the 006 data rewrite and document/test it. Do not claim read normalization that the version gate skips. | open |
| F16 | MINOR | `tasks.md` T22 (382–395); `docs/features/README.md` working tree | T22's verify `git diff --exit-code -- docs/features/README.md` fails in the current worktree because the accepted `detailed-hero-spaceship` row is uncommitted. It also cannot distinguish this feature's edits from unrelated work. | Use the feature base (`git diff --exit-code "$BASE"...HEAD -- docs/features/README.md` plus a scoped `git status`) or commit/freeze the predecessor row before T22. | open |
| F17 | MINOR | `tasks.md` T22 (391–395); `spec.md` AC-50 (477–482); `detailed-hero-spaceship/spec.md` AC-19 (88); `README.md:9` | T22 rewrites the README's procedural-visual sentence to add `granular spaceship parts`, but `detailed-hero-spaceship` AC-19 still requires the exact phrase `detailed blue/orange hero spaceship`. AC-50 does not require preserving predecessor README claims, so the rewrite can regress an accepted criterion. | Add "preserve the existing `detailed blue/orange hero spaceship` sentence" to T22/AC-50, or explicitly supersede detailed-hero AC-19. | open |
| F18 | MINOR | `plan.md` § Migration 006 step 3 (395–400); `src/backend/src/auth/economy-repository.ts:375–392` | The numeric guard `value ~ '^[0-9]+$'` admits arbitrarily large digit strings; `value::int` can overflow and abort migration 006 at startup. This is exactly the malformed-JSONB case the security section says parsing must filter. | Bound the value (`value::numeric BETWEEN 0 AND 2147483647`, or `::bigint` with an explicit cap) and add an overflow-skip migration test. | open |
| F19 | MINOR | `spec.md` AC-34 (350–354); `tasks.md` T19 (344); `plan.md` § Motion CSS (609–616) | "`game-view.css` mirrors the durations" is underspecified: T19 lists 11 `--motion-*` properties while `MOTION` has ~50 duration tokens; it is unclear which tokens are mandatory and whether `lootboxTotalMs`, `equipRowFlashMs`, `bannerHoldMs`, `shipRollMs` etc. need properties. | Pin the exact CSS-token map (the durations actually used by CSS) and require `game-view.css.test.ts` to assert each mapped token equals `${MOTION.<name>}ms`; list unmapped tokens as intentionally JS-only. | open |
| F20 | MINOR | `video-analysis.md` § 8.1 (339–343), § 9 (403–424) | The analysis still recommends "keep 160 ms scale; conceal at t=0" (superseded by AC-36) and refers to the pre-r2 "AC-40" status/`pressMs`/`shockwaveMs` values. A builder using the analysis as evidence can implement the superseded behavior. | Mark § 8.1/§ 9 as historical or update them to point at r2's AC-36/AC-46 and the supersession ledger; do not leave a recommendation that contradicts the accepted AC. | open |
| F21 | MINOR | `spec.md` AC-18 (215–221); `plan.md` § Hub design (492–503); `src/backend/src/game/hub.ts:235,874` | The hub's `deps.random` is a **factory**; `selectLootPart(deps.random())` creates a fresh RNG per open. With a deterministic factory this makes every open draw the same part; it also leaves the draw order relative to cube-grid draws implicit. | Pin the RNG source: use the hub's captured `random` for `selectLootPart` (and document the draw order), or add a dedicated `lootRandom` to `HubDeps`; add a seeded multi-open test that expects different parts. | open |
| F22 | MINOR | `spec.md` AC-21 (231–235), AC-28 (274–280); `plan.md` § Hub design (507–514) | AC-21 says "The target slot is derived from the catalog entry, never from the client"; AC-28 then maps one legacy id to two slots. The exception is only in the plan, not the AC; a builder can implement the literal AC and reject legacy two-slot ids. | State the legacy mapping as the explicit exception in AC-21/AC-28 ("the server-derived target set may be one or two slots for a legacy id"). | open |
| F23 | MINOR | `spaceship-cursor/spec.md` AC-10 (33); `spec.md` § Superseded from spaceship-cursor (729–736), AC-51 (483–488) | `spaceship-cursor` AC-10 says "No container or backend change"; this feature adds migration 006 and backend protocol/catalog changes. The ledger does not supersede AC-10, so the predecessor remains nominally authoritative. | Add `spaceship-cursor` AC-10 (backend/container prohibition) to the supersession ledger with the exact scope now allowed (migration 006 only). | open |
| F24 | MINOR | `spec.md` Q-12 (821–824); `plan.md` § Rollback (824–834); `tasks.md` T23 (397–425) | Q-12/rollback requires a database backup (`pg_dump`) before migration 006 and records the restore command, but no task's verify includes a backup command or a recorded pre-migration dump; T23 only records `BASE` and the diff. | Add a T23 step (or a T2 build-log step) that records the exact `pg_dump` command/output and the restore command; state that a pre-006 dump exists for acceptance. | open |
| F25 | INFO | `status.md:44–46` | The status blocker still says "Reference video must be inspected by the planner"; Q-1 is resolved and the package is in spec_review. | Orchestrator should update the stale blocker list (status.md is orchestrator-owned; not a builder action). | open |
| F26 | INFO | `tasks.md` T23 (425); `spec.md` AC-51 (483–488) | T23 allows "Podman unavailable" as an environment caveat. AC-51 says the final gate runs `npm run smoke`; if it cannot run, the code gate will treat the smoke evidence as unmet. | Keep the caveat, but require the orchestrator/environment to supply Podman for T23; do not count a skipped smoke as passed. | open |
| F27 | INFO | `docs/features/README.md` working tree; `spec.md` AC-50 (480–482) | The only current diff in the orchestrator-owned index is the accepted `detailed-hero-spaceship` row; this feature has not edited it. No ownership violation by this builder, but the worktree is not clean. | Commit the predecessor row before the feature build; T22 should propose, not apply, the new row. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ❌ | Non-goals/boundaries are complete, but AC-29 has no `pendingOpen` producer, AC-43 has no row-flash owner, AC-35's `picking.ts` has no owner, and the predecessor supersession ledger is incomplete (F4/F6/F11/F13/F23). |
| Testability | ❌ | AC-41's stage sum contradicts `lootboxTotalMs`; AC-34's CSS mirror is underspecified; AC-8/47's scene count is wrong; observed-block values F8 are not all traceable; AC-29's in-flight state is not reachable. |
| Boundaries | ✅ | Always/Ask-first/Never tiers and non-goals are present and consistent with server authority/local-only presentation. |
| Dependency graph | ✅ (structural) | 23 tasks; acyclic; every dependency points at an earlier task; every AC appears in at least one task (traceability below). Execution is not green because of F1. |
| Parallel safety | ✅ (files) | No `files_owned` path is duplicated; `[P]` tasks are disjoint at the file level. Semantic parallel safety (workspace green) fails under F1. |
| Predecessors | ❌ | `detailed-hero-spaceship` AC-1 protected paths / AC-13 count and AC-14 baseline are not superseded (F2/F4); `spaceship-cursor` AC-10 is not superseded (F23); detailed-hero AC-19 README phrase is at risk (F17). |
| Performance | ❌ | 16.694 ms vs 16.7 ms at 1920×1080; a net ~+21 draw calls and 12 extra physical materials with no draw-call reduction or quality tier (F12). |
| Security | ✅ | Catalog/ownership validation, server-derived slots, parameterized SQL, no secrets, no client counts/rarity; only the migration numeric-overflow robustness issue (F18). |
| Real-time | ✅ | Account-scoped `customizationUpdate`, opener-only `lootboxOpened`, per-member open guard, atomic repository writes, reconnect/welcome state; no cross-client visibility (Q-6). |
| Containers | ✅ | Migration 006 only; no service/image/port/env/compose/Dockerfile/`/ws` change; final `npm run smoke` is pinned (subject to F24/F26). |
| Accessibility | ✅ | 44×44 targets, `:focus-visible` accent outline, native buttons, ARIA pressed/labels, `role="status"`, `aria-live`, locked entries non-focusable; reduced variants are pinned for every new animation (AC-30/48). |
| Docs | ❌ | T22 verify is fragile (F16); detailed-hero README phrase at risk (F17); stale `video-analysis.md` recommendations (F20); stale `status.md` blocker (F25). |
| Consistency | ❌ | AC-4 vs plan material finishes (F9); AC-34 vs `effects.ts` duplicate easing (F14); AC-41 timeline (F7); observed values vs video analysis (F8); legacy mapping vs AC-21/28 (F10/F22). |
| Testing | ❌ | Per-task full coverage is unattainable (F1); missing tests for legacy equip ownership/restore normalization; otherwise the stated unit/integration/manual tiers and assertion-quality bars are good. |

## AC → task traceability

| AC | Task(s) | Gap |
| --- | --- | --- |
| AC-1, AC-2 | T10 | — |
| AC-3 | T10, T11 | — |
| AC-4 | T10, T23 (manual) | F9 material-finish conflict |
| AC-5 | T11 | — |
| AC-6 | T11 | — |
| AC-7 | T7, T11, T13 | — |
| AC-8 | T23 | F2 count; F12 performance; no task measures before T23 |
| AC-9 | T11, T13 | — |
| AC-10, AC-11 | T1, T7 | F5 intermediate compile |
| AC-12 | T1, T5, T7, T14 | — |
| AC-13 | T1, T5, T7 | — |
| AC-14 | T2 | F3 value rewrite |
| AC-15 | T2, T7 | F3 value rewrite; F15 read normalization |
| AC-16 | T4, T7, T14 | F3/F15 |
| AC-17 | T4 | — |
| AC-18 | T5, T6 | F21 RNG source |
| AC-19 | T5 | — |
| AC-20 | T5 | — |
| AC-21 | T5, T14 | F10/F22 legacy ownership |
| AC-22 | T4, T5, T14 | — |
| AC-23 | T3, T15 | — |
| AC-24 | T3, T6, T15 | — |
| AC-25 | T3, T15 | — |
| AC-26 | T5, T16 | — |
| AC-27 | T14, T16 | — |
| AC-28 | T5, T7, T14 | F3/F10/F15/F22 |
| AC-29 | T18, T21 | F6 `pendingOpen` has no producer |
| AC-30 | T18, T19, T21, T23 | — |
| AC-31 | T17, T21 | — |
| AC-32 | T14, T16, T18, T21 | — |
| AC-33 | T4, T5, T6, T16, T23 | F3 migration values |
| AC-34 | T8, T19, T23 | F8 observed labels; F14 duplicate easing; F19 CSS mirror |
| AC-35 | T13, T16, T23 | F2 targeting count; F13 `picking.ts` allocation |
| AC-36 | T12, T13, T23 | — |
| AC-37 | T12, T13, T23 | — |
| AC-38 | T12, T13, T23 | — |
| AC-39 | T19, T20, T21, T23 | — |
| AC-40 | T11, T13, T16, T19, T20, T21, T23 | F8 banner peak |
| AC-41 | T18, T19, T23 | F7 timeline arithmetic |
| AC-42 | T9, T11, T23 | — |
| AC-43 | T19, T20, T23 | F11 row-flash owner |
| AC-44 | T13, T19, T21, T23 | — |
| AC-45 | T23 | — |
| AC-46 | T23 | F8 observed-value honesty |
| AC-47 | T23 | F12 performance |
| AC-48 | T12, T18, T19, T20, T23 | — |
| AC-49 | T23 | F1 per-task coverage |
| AC-50 | T22, T23 | F16/F17 |
| AC-51 | T23 | F23/F24/F26 |

## Previous round verification

Not applicable — this is round 1.

## Notes / backlog (non-blocking)

- The `[O]`/`[E]` split is genuinely useful and the `video-analysis.md` + `reference/` evidence set exists (40 frames + 3 contact sheets; verified). Keep it.
- The catalog tables (30 rows, 10 slots, 10 standard/10 rare/10 epic), the 19-material/21-mesh/32-object cursor contract, the 22-draw cursor budget, and the 20-lootable/40-weight odds are internally consistent and testable; the main risk is the scene-count baseline (F2) and performance (F12), not the catalog math.
- `source` feasibility checks: the current `HubDeps`, `EconomyRepository`, `CustomizationState`, `createEngine`, `SceneView`, `Spaceship`, `CubeView`, `HUD_BLINK_MS`, `game-view.css` nine-token `:root` guard, and the `app.css` border-radius guard all support the planned seams; the gaps above are contract/ownership issues rather than missing framework capabilities.
- Recommendation: fix F1–F5 first (they change the task plan), then F6–F15 (AC/contract corrections), then the minor doc/verify items, and re-run the spec gate (round 2). Do not start the builder on this package until the task DAG has a green-per-task verification story.
