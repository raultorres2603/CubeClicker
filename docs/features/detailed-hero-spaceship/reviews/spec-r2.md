---
feature: detailed-hero-spaceship
phase: spec
iteration: 2
verdict: approved
blocking: 0
nonblocking: 1
---
# Spec Review — r2

## Summary

✅ approved — the r2 spec/plan/tasks resolve F1–F20, keep all counts coherent (48 hero meshes, 49 model objects, 50 hero-subtree objects, 15 non-hero + 48 hero = 63 backdrop meshes, 63 + 7 groups = 70 backdrop objects, 32 + 70 = 102 scene objects, 11 materials, ≤6,000 triangles), preserve every accepted default, and add the `scene.ts` comment-only edit to T2 without colliding with T1/T3. One non-blocking MINOR remains: the wing planform's 1.25 span is exactly the AC-8 assertion threshold, so the plan's “float margin” wording is stale (the pinned values still compute 1.25 exactly); this is backlog, not a gate failure.

## F1–F20 verification

| Finding (r1) | Status | Evidence |
| --- | --- | --- |
| F1 — non-hero disposal count 22 | **fixed** | `spec.md` AC-12 now states the **15-mesh non-hero** loop (7 asteroids + 6 meteor + 2 comet) and **63 total** (15 + 48 hero); `plan.md` § Backdrop layer and `tasks.md` T2 repeat 15/63. Verified: 7 + 6 + 2 = 15; 15 + 48 = 63; the old 22 was 15 non-hero + 7 old hero. |
| F2 — world-vs-local detail units | **fixed** | AC-10 tests the **model-local geometry bounding box before the 1.7 scale** (`<= 0.06` local) and defines `HERO_DETAIL_OFFSET === 0.012` in model-local units; the plan's 0.03–0.05 seams and 0.012 offset are consistent; the plan's risk section explicitly forbids mixing world/local thresholds. |
| F3 — AC-12 “moves only” wording | **fixed** | AC-12 now says `update(128)` advances the retained asteroid/meteor/comet motion exactly as before and, **within the hero subtree**, only `backdrop.heroShip.position.y` moves; model group and 48 meshes keep their transforms. |
| F4 — protected-path set incomplete | **fixed** | The AC-1/T3 `git diff --exit-code` set is 36 paths and includes `main.tsx`, `cube-view.ts/.test.ts`, `postprocessing.ts/.test.ts`, `webgl.ts/.test.ts`, `spectate-travel.ts/.test.ts`, and the `picking`/`particles`/`starfield`/`background-life`/`nebula` tests. Spec and tasks lists are byte-identical. |
| F5 — wing span with no margin | **fixed (note F21)** | AC-8 now requires a `>= 1.25` shape-x span; the plan pins root `±0.40`, tip `±1.65`, `HERO_WING_SHAPE_SPAN = 1.25`. The exact pinned values compute 1.25 in double, so the test passes; the “float margin” wording is stale (the margin is over the old 1.2, not the 1.25 threshold) — F21. |
| F6 — hull-blue material row omitted wings | **fixed** | `plan.md` § Materials row 1 now lists `hull, dorsal spine, hero-wing-left/right`. |
| F7 — “octagonal” vs 10 segments | **fixed** | Spec reference mapping and plan part list now say “low-poly 10-segment `CylinderGeometry`”; “octagonal” is removed. |
| F8 — unpinned README grep phrase | **fixed** | AC-19 pins the exact phrase `detailed blue/orange hero spaceship`; T3 greps the same literal. |
| F9 — unpinned reduced-motion method | **fixed** | AC-17 pins: identical hero bounding box; union crop expanded 8 px; per-RGB-channel absolute difference `> 8/255` on `<= 1%` of crop pixels; no flicker/pulse/rotation/drift. T3 repeats the method. |
| F10 — untestable “offset from base surface” | **fixed** | AC-10 keeps the unit test to observable local thinness/materials and delegates the coplanarity/z-fighting claim to the manual AC-16 matrix. |
| F11 — ambiguous cockpit “surrounds” / fin “rise to” | **fixed** | AC-7 pins frame/cockpit model-local bounding-box containment plus x/z centre deltas `<= 0.02` and y delta `<= 0.05`; AC-8 pins fin `geometry.parameters.height >= 0.5` and `position.y + height/2 >= 0.55` in model-local units. |
| F12 — singular engine centre | **fixed** | AC-6 now compares the nose tip to **both** housing centres and **both** nozzle centres by `>= 0.2` world units. |
| F13 — stale `scene.ts` comment vs frozen file | **fixed** | AC-13, plan § Scene layer and T2 now own a **comment-only** `scene.ts` edit (`28 objects` → `70 objects`); AC-1/T3 exclude `scene.ts` from the protected set and require a separate `git diff ... -- scene.ts` showing only that comment line. T2’s `files_owned` includes `scene.ts`. |
| F14 — now-unused `BoxGeometry` import | **fixed** | T2 notes and plan integration points remove the `BoxGeometry` import from `cosmic-backdrop.ts`; `MeshBasicMaterial`/`MeshStandardMaterial` remain for meteors/asteroids. |
| F15 — build-log ownership | **fixed** | T1, T2 and T3 each list `build-log-T<n>.md` in `files_owned`; the plan file inventory lists all three. |
| F16 — 49/50 object-count naming | **fixed** | `HERO_SHIP_MODEL_OBJECT_COUNT = 49` (model group + 48 meshes) and `HERO_SHIP_SUBTREE_OBJECT_COUNT = 50` (hero group + model subtree) are separate exports; AC-2/AC-14 use the correct one. |
| F17 — no 2560×1080 length range | **fixed** | AC-16 and T3 now pin `300–450 px` at 2560×1080 alongside 160–280 at 1280×720 and 320–560 at 2560×1280. |
| F18 — thin 1920 idle headroom not recorded | **fixed** | AC-14 and plan § Risks record the accepted 16.694 ms median vs the 16.7 ms bar (≈0.006 ms) as the first measurement to watch; a reproducible miss blocks under Q-6. |
| F19 — Q-8 as a user checkpoint | **fixed** | Q-8 is removed from § Open questions and recorded in § Assumptions as a non-blocking future note; Q-1/Q-2 remain the user checkpoints. |
| F20 — “layered armor plates” reads single-plate | **fixed** | `hero-hull-underside` is now a stepped two-tier `ExtrudeGeometry` armor plate; AC-16 checks the layered-armor read (stepped underplate + dorsal spine + hull seams); the mesh count remains 48. |

## Findings (r2)

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F21 | MINOR | `spec.md` § AC-8; `plan.md` § Interfaces / contracts (`HERO_WING_SHAPE_SPAN = 1.25; // >= 1.2 with float margin`); `plan.md` § Model hierarchy (wings row) | The plan's root `±0.40` to tip `±1.65` yields exactly **1.25**, which is now also the AC-8 assertion threshold (`>= 1.25`). The “float margin” is over the earlier 1.2 minimum, not over the current test threshold, and the constant's `// >= 1.2` comment is stale. The exact pinned coordinates happen to compute 1.25 in double, so the test will pass as written, but the planform has zero tolerance to any geometry/bevel rounding and a test author following the comment could assert the weaker 1.2. | Either keep the 1.25 design and assert `>= 1.2` (the earlier minimum), or design a 1.30 span and assert `>= 1.25`; update the AC-8 wording, the plan wing row and the `HERO_WING_SHAPE_SPAN` comment consistently. Backlog, not blocking. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Every reference element is mapped; hero-only/cursor-out is explicit; non-goals remain complete; no accepted default was reopened. |
| Testability | ✅ | All 19 ACs are binary with concrete values/predicates; F21 is a MINOR margin/comment cleanup, not an unverifiable behavior. |
| Boundaries | ✅ | Three tiers present and appropriate; the `scene.ts` comment-only exception is explicitly bounded and guarded. |
| Dependency graph | ✅ | T1→T2→T3 is acyclic; every AC maps to an earlier-or-equal task; T1 remains a single-session model/test task; T2 owns the backdrop/scene count files; T3 is the final gate. |
| Parallel safety | ✅ | T1 owns `spaceship-model.ts`/test + its build log; T2 owns `cosmic-backdrop.*`, `scene.ts`, `scene.test.ts` + its build log; T3 owns `README.md`, `build-log-T3.md`, evidence. No path is shared; T1 is the only `[P]` and is disjoint; T2/T3 are `[seq]`. |
| Predecessors / supersessions | ✅ | `reference-image-game-view` AC-11 seven-mesh/28-object and AC-22 growth are explicitly superseded; retained outer position `(9,-2.5,-14)`, `rotation.y = π/2`, `HERO_HULL_COLOR`/`HERO_FLAME_COLOR`, no-shadow, `z < -4`, the camera-anchor `6/4` and procedural/no-asset clauses remain; cursor specs are explicitly untouched; no predecessor artifact is edited. |
| Performance proof | ✅ | AC-14 retains the three-run average ≤16.7 ms/p95 ≤33 ms protocol with the 1920 idle headroom watch; AC-15 pins the 350 KB gzip/import gate; AC-16 has all four viewport ranges; AC-17 pins the reduced-motion measurement. |
| Security | ✅ | No user-controlled data, secrets or new dependencies/assets; only existing `three` named imports and workspace-relative modules; fixed bounds and one disposal seam; the expanded AC-1 diff gate covers the render/camera/pipeline files. |
| Real-time | ✅ | Explicitly none: client-local decoration; no shared/cross-client state, protocol, lifecycle, reconnection or server-authority change. |
| Containers | ✅ | Explicitly none: frontend source-only; no service/image/port/env/health/compose/Dockerfile/`/ws` change; the container contract still holds. |
| Testing | ✅ | Unit (`spaceship-model.test.ts`) and integration (`cosmic-backdrop.test.ts`, `scene.test.ts`) tiers; commands from `AGENTS.md`; `npm run coverage` with ≥80% all four metrics per workspace and no new exclusions; assertion-quality bar; edge cases named. |
| Consistency | ✅ | Counts verified below; F1–F20 disposition table is accurate; F21 is the only residual wording/margin nit. |
| Documentation | ✅ | AC-19 pins the exact README phrase; the orchestrator-owned `docs/features/README.md` row remains a proposal; architecture/product docs correctly unchanged; the `scene.ts` comment accuracy is now covered by the comment-only edit. |

## Count and ownership re-check

- **Hero meshes:** the AC-3 name map totals 48 (hull/underside/nose/spine 4; fins/tips 4; cockpit 3; hull seams 3; wings/leading/tips/seams 12; engine pylons/housings/ribs/nozzles/flames/cores 14; hull stripes 2; vents 2; antennae 2; greebles 2).
- **Model objects:** `HERO_SHIP_MODEL_OBJECT_COUNT = 49` = model group + 48 meshes.
- **Hero subtree:** `HERO_SHIP_SUBTREE_OBJECT_COUNT = 50` = outer hero group + 49 model objects.
- **Backdrop meshes:** 15 non-hero (7 asteroids + 6 meteor + 2 comet) + 48 hero = **63**.
- **Backdrop objects:** 63 meshes + 7 groups (cosmic, 3 meteor, comet, hero, model) = **70** = `COSMIC_BACKDROP_OBJECT_COUNT`.
- **Scene objects:** 32 pre-backdrop + 70 = **102** = `32 + COSMIC_BACKDROP_OBJECT_COUNT`; `scene.children` 9/10 unchanged.
- **Materials:** 11 shared instances (hull blue, light panel, mid gray, navy, orange, canopy glass, canopy highlight, flame outer, flame core, engine housing, engine nozzle).
- **Triangles:** `HERO_SHIP_MAX_TRIANGLES = 6000`; expected ≈2,500–3,500 from the pinned primitives.
- **Task ownership:** T1→T2→T3 exclusive; T2 owns `scene.ts` (comment-only) and `scene.test.ts`; no path collision; T3 owns the T3 build log.
- **AC-1 protected command:** 36 paths, byte-identical in `spec.md` and `tasks.md`; includes the full F4 set (`main.tsx`, `cube-view`, `postprocessing`, `webgl`, `spectate-travel` and all listed tests); excludes `scene.ts` intentionally, with a separate comment-only `git diff` guard in AC-1/T3.

## AC → task traceability

| AC | Task(s) | Verification artifact |
| --- | --- | --- |
| AC-1 (visual-only scope/protected files) | T3 | Final build log: `BASE`, 36-path protected `git diff`/`git status`, `scene.ts` comment-only diff, full `git status --porcelain` |
| AC-2 … AC-10 (factory, names, materials, dimensions, attitude, cockpit, wings/fins, engines, surface detail) | T1 | `spaceship-model.test.ts` |
| AC-11 (backdrop composition/counts) | T2 | `cosmic-backdrop.test.ts` |
| AC-12 (motion/reduced motion/disposal) | T2 | `cosmic-backdrop.test.ts` |
| AC-13 (scene integration/camera anchor/comment-only scene.ts) | T2 | `scene.test.ts`, `scene.ts` diff |
| AC-14 (performance evidence) | T3 | Build-log three-run traces at 1280×720/1920×1080 |
| AC-15 (bundle/dependency budget) | T3 | Build gzip output + import scan |
| AC-16 (manual visual matrix) | T3 | Evidence screenshots + pass/fail table |
| AC-17 (reduced-motion freeze) | T3 | `t3-reduced-motion-a/b.png` + box/crop measurements |
| AC-18 (coverage) | T3 | `npm run coverage` output |
| AC-19 (documentation) | T3 | README diff/grep + proposed `docs/features/README.md` row |

All 19 acceptance criteria are mapped; T3 also re-runs the final verification for AC-2…AC-13 as the feature-level gate. No AC is assigned to a task lacking the relevant ownership.

## Previous round verification (if iteration > 1)

F1–F20 are verified in the table above; all are fixed or fixed-with-note. No r1 finding is rebutted or left open as a blocker. F21 is the only new (MINOR) finding.

## Notes / backlog (non-blocking)

- **Counts:** all arithmetic is coherent: 48 meshes / 49 model objects / 50 hero-subtree objects / 15 non-hero + 48 hero = 63 meshes / 63 + 7 groups = 70 backdrop objects / 32 + 70 = 102 scene objects / 11 materials / ≤6,000 triangles / children 9 (10 with a remote world).
- **Composition:** the 1.7-scale ship is ≈225 px at 1280×720, ≈400 px at 2560×1280 and ≈337 px at 2560×1080, inside the AC-16 ranges; the AC-16 matrix remains the authority on panel clearance and the layered-armor read.
- **F21:** the wing planform is exactly the 1.25 assertion threshold; the pinned values are exact in double, so this is a wording/robustness cleanup rather than a gate failure. If the builder wants a true float margin, design a 1.30 span or assert `>= 1.2` with the 1.25 planform.
- **Open questions:** Q-1 (procedural vs asset) and Q-2 (hero ship vs cursor) remain the approval-time user checkpoints; Q-3/Q-4/Q-5 are pinned visual defaults; Q-6/Q-7 are risk/scope defaults; Q-8 is now a non-blocking future note in § Assumptions.
- **Evidence:** manual screenshots, reduced-motion A/B and frame-time traces remain acceptable under the project convention; the final build log must include the exact 1920 idle measurement first because of the ≈0.006 ms predecessor headroom.
