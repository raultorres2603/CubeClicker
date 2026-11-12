---
feature: small-destruction-shot-fx
phase: spec
iteration: 1
verdict: changes_requested
blocking: 1
nonblocking: 10
---
# Spec Review — r1

## Summary

❌ **changes requested — one MAJOR.** The package covers the user's three asks (little impact explosion, 140 ms mini-cube destroy, realistic bolt/muzzle/recoil), keeps the removed gold ray/coin/ring out, lists an explicit supersession table, and has a safe sequential T1 → T2 → T3 file split. The blocking issue is AC-8: the 1280×720 click-draw bars are pinned against the builder's accepted medians only and are below the independently accepted predecessor traces plus the new effect delta (the plan also undercounts the muzzle-flash mean by 10×), so a clean build can fail the code gate without a regression. Ten MINOR/INFO clarity/evidence findings follow.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | `spec.md` § AC-8 (lines 242–247); `plan.md` § Draw/object accounting (lines 76–78); `tasks.md` T3 verify (lines 139–140) | The 1280×720 high and low click-draw bars are not reproducible against accepted evidence. The bars use the builder medians `211.24/198.09` (plus 5.26 / plus 4), but the independently accepted predecessor traces are **215.54 high / 201.79 low** (`docs/features/particle-only-click-effects/reviews/code-r1.md:25`); the new effect adds at least +2 draws (flash + burst) at high/medium, so independent high-1280 becomes ≈217.6–218.3 > **216.5**, and independent low-1280 is 201.79 vs **202.1** (0.31 margin, with zero new low-tier draws). The plan's “+0.08 mean muzzle flash / ≈+2.1” is a duty-cycle decimal error: an 80 ms flash at 10 clicks/s (100 ms interval) is live 80% of the time → **+0.8 mean**, total **≈+2.8**. The text “plus the effect allowance” is undefined, and the trace environment (single-member guest world / remote-world object count) is not pinned, although the predecessor build log shows that count changes the absolute draw means. | Re-base the click-trace bars on the **worst accepted trace** (independent and builder values) plus the **correct** mean effect delta (+2.8 high/medium, 0 low) plus a documented run-to-run variance margin (the observed 1280 high variance is 4.30 draws): e.g. high 1280 ≈ 219–221, high 1920 ≈ 218–220, medium 1280/1920 ≈ 206–207, low 1280 ≈ 203–205, low 1920 ≈ 202–203 — or state an explicit percentage allowance and justify it. Pin the trace environment (single-member guest world, same harness, three clean runs) and record it in `build-log-T3.md`. Align the spec, plan and task numbers. | open |
| F2 | MINOR | `plan.md` lines 76–78 | The muzzle-flash mean is wrong: `+0.08` implies an 8% duty cycle, but `shotMuzzleFlashMs = 80` against a 100 ms click interval gives 0.8; total mean delta is ≈+2.8, not ≈+2.1. The spec's “worst-case +3” is correct; the plan's mean is not. | Correct the plan to `+0.8 mean muzzle flash` and `≈+2.8` total; keep the spec's +3 worst case. | open |
| F3 | MINOR | `spec.md` § AC-3 line 166; § AC-8 line 237; `src/frontend/src/render/impact-effects.ts:161,177–180` | “The pool creates no three.js object after construction / the pools allocate nothing after construction” conflicts with the explicitly **unchanged** shard pool, which allocates `base.clone()`, `new Vector3()` and `direction.clone()` per shard at spawn. A T2 test that literalizes “no post-construction object” would fail against unchanged accepted code. | Clarify to “no new drawable/geometry/material after construction and no per-frame allocations”; the shard pool's per-spawn scratch vectors are exempt (or preallocate them without changing behaviour). Make the T2 “no post-construction object” test assert the pool's children/geometry/material identities and per-frame allocation freedom, not every JS object. | open |
| F4 | MINOR | `spec.md` § AC-7 line 224; `tasks.md` T3 note line 156 | AC-7/T3 require “HUD layout/equality” in `scene-effects.test.ts`, but a scene unit test cannot observe the DOM HUD; the HUD is owned by React/CSS tests. The camera half is testable; the HUD half is not assigned to an owner. | Cite the unchanged `Hud.test.tsx` / `App.test.tsx` / `game-view.css.test.ts` no-shake assertions as the HUD evidence, or drop the HUD clause from the scene test and keep camera equality only. | open |
| F5 | MINOR | `spec.md` § AC-9 line 255 | The visual windows are physically inconsistent with the pinned timelines: “tile fully gone … at 300–340 ms” starts 20 ms before the 140 ms destroy ends at 320 ms; “smoke fading by 420–480 ms” is mid-life only — smoke starts at impact 180 ms with a 480 ms lifetime and is gone at 660 ms. | Use 320–340 ms for “tile fully gone”; state “smoke visible/fading at 420–480 ms, gone by 660 ms” (or adjust the lifetimes/windows). | open |
| F6 | MINOR | `spec.md` § AC-2 line 122 | “`quality.ts` exports exactly `QUALITY_EXPLOSION_FLASH_COUNTS === …`, …” can be read as “the module's runtime exports are only these four”, which would contradict the required existing exports (`qualityFeatures`, `createQualityPolicy`, `QUALITY_SHARD_COUNTS`, …). | Reword to “exports these four constants with exactly these values; all existing exports and `QualityFeatures` fields remain.” | open |
| F7 | MINOR | `spec.md` § AC-3 line 155; `plan.md` line 207 | “smoke … drift +0.25/s upward” reads as a velocity, but the plan implements `vy += 0.25·dt` (upward acceleration 0.25 world/s²); a test following one would fail the other. | Align the spec and plan on one formula (constant 0.25/s drift or 0.25/s² acceleration) and pin it in the test. | open |
| F8 | MINOR | `tasks.md` T3 note line 177 | T3 is a behavior change (`scene.ts` wiring) but its commit message is `docs: document small destruction and shot effects`; conventional commits require `feat:` for behaviour. | Use `feat: wire the destruction and shot effects` (optionally plus a separate `docs:` commit), or split the task's commit. | open |
| F9 | MINOR | `tasks.md` T2 note line 68 | “At most one tolerance per file” conflicts with the existing `spaceship.test.ts`, which has many `toBeCloseTo` calls (follow factor, positions, rotations, pulse). The builder would have to rewrite accepted tests to satisfy a note. | Scope the tolerance rule to new tests, or allow the pre-existing tolerances with a comment; do not require unrelated rewrites. | open |
| F10 | MINOR | `spec.md` § AC-3 line 143; `plan.md` § impact | “a per-instance brightness attribute (`InstancedBufferAttribute`, r = g = b)” does not name `instanceColor`; `MeshBasicMaterial` only consumes `InstancedMesh.instanceColor` without a custom shader. The plan clarifies `instanceColor`; the AC should too. | Name `instanceColor` explicitly as the per-instance brightness channel (r = g = b). | open |
| F11 | INFO | `spec.md` § AC-4 line 174 | `miniCubeDestroyBrightnessAt(t < 0) = 3` is counter-intuitive (a not-yet-destroyed tile is brightness 1) and unused because live records start at 0. | Consider returning 1 for `t < 0`, or document why the pre-start value is pinned at 3. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | The three user asks are covered: Pillar A little explosion, Pillar B mini-cube destroy, Pillar C realistic shot; the massive gold explosion stays gone (non-goals + AC-3/AC-7/AC-9 no ray/coin/ring); Q-4–Q-7 documented. No unrelated scope invented. |
| Testability | ❌ | AC-8's 1280×720 high/low draw bars are not reproducible against the independently accepted predecessor traces plus the new effect delta (F1); AC-7's HUD half has no owner (F4); AC-9's windows need the 320/660 ms correction (F5). All other ACs are concrete and binary. |
| Boundaries | ✅ | Always / Ask first / Never tiers and non-goals are present and match `AGENTS.md`. |
| Dependency graph | ✅ | T1 → T2 → T3, acyclic; every AC-1…AC-12 is mapped; tasks are one-session sized. |
| Parallel safety | ✅ | No `[P]` tasks; T1/T2/T3 `files_owned` are disjoint; T2 owns all affected unit/integration tests (`effects`, `impact-effects`, `cube-view`, `world`, `spaceship`, `scene`, `scene-spaceship`); T3 owns `scene.ts`, the new `scene-effects.test.ts`, README and logs. No shared-file collision. |
| Security | ✅ | Presentation-only; no user-controlled data, persistence, secret or network request; pools are bounded (6 flash / 72 points / transient shots) and recycle oldest-first; no dependency/loader/asset added. |
| Testing | ✅ | Unit + integration + manual tiers are present; commands exist in `AGENTS.md`; coverage names `npm run coverage` ≥80×4 per workspace; assertion-quality (no wildcard/snapshot/assertion-free) and edge cases (negative/zero/late elapsed, caps, duplicate ids, reduced/instant) are named. The AC-8 bar problem is F1, not a missing strategy. |
| Consistency | ✅ | Aligns with the vision (reduced motion, no shake), predecessor supersessions, `docs/architecture/documentation.md` index ownership and `AGENTS.md`; F2/F3/F6/F7/F10 are wording/accounting fixes, not boundary conflicts. |
| Risks | ❌ | The plan lists draw-budget creep, but the pinned bars understate the independently observed variance and the muzzle-flash mean (F1/F2); the trace environment is not pinned. |
| Real-time / multi-client | ✅ | Server remains the authority for mini-cube removal; live `miniCubeRemoved` animates identically on every client; roster hydration/reconnection uses the instant path (no historical replay); no protocol/lifecycle change. |
| Containerization | ✅ | Explicitly out of scope; no service, image, port, env var, health signal, compose entry, Dockerfile or WebSocket endpoint change; `podman compose up` / `npm run dev` remains the local path; `npm run smoke` correctly not required. |
| Documentation | ✅ | Root `README.md` click sentence and phrases are pinned; `docs/features/README.md` is orchestrator-owned with a guarded proposed row; no `docs/architecture/**` or glossary change is needed (no stack/container/term change). |
| Preserved behaviour | ✅ | Green shards (14/7/0), gold sparks (24/12/0), coin `+0.10`, banner/fly-by, reticle, cursor ship, lootbox, quality policy, reduced motion and no shake are explicitly preserved; no backend/protocol/lootbox/container/dependency/audio change; no new assets. |

## AC → task traceability

| AC | Task | Evidence |
| --- | --- | --- |
| AC-1 — Motion vocabulary | T1 | `motion.test.ts` exact `MOTION` + headline sums |
| AC-2 — Adaptive quality matrix | T1 | `quality.test.ts` exact high/medium/low/reduced matrices; policy untouched |
| AC-3 — Little explosion module | T2 | `impact-effects.test.ts` |
| AC-4 — Mini-cube destroy | T2 | `cube-view.test.ts`, `effects.test.ts` |
| AC-5 — Remote cube parity | T2 | `world.test.ts` |
| AC-6 — Realistic shot | T2 | `spaceship.test.ts`, `scene-spaceship.test.ts` |
| AC-7 — Scene integration | T3 | `scene-effects.test.ts`, `scene.test.ts`, `scene-spaceship.test.ts` |
| AC-8 — Object/draw/triangle/frame budget | T3 | Build-log traces + accounting |
| AC-9 — Visual evidence and manual check | T3 | `docs/features/small-destruction-shot-fx/evidence/` + build log |
| AC-10 — Documentation | T3 | README greps, index guard, build-log proposal |
| AC-11 — No dependency/backend/protocol/container/audio change | T3 | Fork-point diff/import/asset/audio gates |
| AC-12 — Coverage and full gate | T3 | `npm run coverage`, lint, typecheck, test, build |

## Verification performed

- Read `spec.md` r2, `plan.md` r2, `tasks.md`, `status.md`, the predecessor `spaceship-cursor-loot-animations` spec r4 (AC-6/36/37/42/47/48/52) and the relevant plan/tasks sections (the no-muzzle/recoil/press contract and shot values), `particle-only-click-effects` spec r2 (AC-1/2/3/5/6/7), its plan/tasks (the 133-object baseline and the shard-only module contract), its code-r1 review and `build-log-T2.md`, plus `AGENTS.md`, `docs/architecture/documentation.md`, `containerization.md`, `README.md`, `docs/features/README.md` and `docs/product/glossary.md`.
- Inspected the current sources and tests: `effects.ts`, `impact-effects.ts`, `quality.ts`, `cube-view.ts`, `spaceship.ts`, `scene.ts`, `world.ts`, `motion.ts`, `picking.ts`, `impact-effects.test.ts`, `cube-view.test.ts`, `spaceship.test.ts`, `scene.test.ts`, `scene-spaceship.test.ts`, `world.test.ts`.
- Verified the pinned geometry arithmetic with `three` in the frontend workspace: `ConeGeometry(0.07, 0.55, 6)` = 12 triangles, `SphereGeometry(0.08, 8, 8)` = 112, `OctahedronGeometry(1, 0)` = 8; verified `1 + 0.08·easeOutCubic(0.5) = 1.07`, `1.08·(1 − easeOutQuad(0.5)) = 0.27`, `−0.12·(1 − easeOutCubic(0.5)) = −0.015`.
- Confirmed the current call sites: local `cube.hideMiniCube(intent.id, reducedMotion)` (`scene.ts:604,611,626,632`), live remote `hideMiniCube(id)` (`world.ts:323`), roster instant `hideMiniCube(id, true)` (`world.ts:196`); current impact group has one child and the scene baseline is 133 (63 + 70).
- Ran the AC-11 import/URL/loader and audio greps over the current production surfaces: clean; confirmed the root README contains the five preserved phrases and the retired `vanishes on the same frame`, and that `docs/features/README.md` is committed with the predecessor rows and no row for this feature.
- Did not run the test/coverage/build suite: this is the spec gate (round 1); the code gate will run it.

## Notes / backlog (non-blocking)

- F2–F11 are clarity/accounting/evidence fixes; none changes the three-pillar design, supersession boundary or task DAG.
- The three asks are delivered in substance; the 140 ms destroy is an explicit user-requested deviation from the reference's one-frame conceal, and the supersession table is authoritative (predecessor artifacts stay untouched).
- The task DAG is sequential with disjoint ownership; T2's exclusive ownership of the affected tests is the right call, and T3's new `scene-effects.test.ts` avoids cross-task test edits.
- Q-1 (140 ms tile destroy), Q-2 (bolt + muzzle + 0.12/120 ms recoil with 180 ms travel) and Q-3 (warm-white core 0.18→0.55, amber embers, warm-grey haze) are reasonable accepted defaults; Q-4–Q-7 are documented and non-blocking.
- The visual evidence plan at 1280×720 and 1920×1080 with measured frame timestamps and the existing particle-only frames as “before” is sound; the windows need the F5 correction.
