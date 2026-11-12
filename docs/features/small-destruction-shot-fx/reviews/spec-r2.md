---
feature: small-destruction-shot-fx
phase: spec
iteration: 2
verdict: approved
blocking: 0
nonblocking: 3
---
# Spec Review — r2

## Summary

✅ **approved — no open BLOCKER/MAJOR.** Spec r3 fixes all eleven r1 findings: the AC-8 click bars are re-based on the worst accepted predecessor trace per size/tier plus the true +2.8 effect mean and a 2.6–4.1 margin (high 221.0/220.0, medium 207.0/207.0, low 205.0/202.0; verified margins 2.66–4.06), the plan's muzzle mean is +0.8, and the shard-allocation, HUD, 320/660 ms, exports, constant-drift, `feat:` commit, tolerance, `instanceColor` and `t < 0` items are resolved. The three pillars, Q-1–Q-3 accepted defaults, the no-gold boundary, T1 → T2 → T3 ownership, all twelve AC mappings and the budgets/supersessions are retained. Three non-blocking evidence-precision notes follow.

## Previous round verification (F1–F11)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (MAJOR) — click-draw bars | **fixed** | `spec.md` AC-8 lines 251–262: bars re-based on the worst accepted predecessor trace per size/tier (high 215.54/214.15, medium 201.40/201.24, low 201.79/197.94 — the larger of the builder median and the independent rerun) plus +2.8 high/medium (0 low) plus a documented 2.6–4.1 margin: high ≤ **221.0/220.0**, medium ≤ **207.0/207.0**, low ≤ **205.0/202.0**. Arithmetic re-checked with `node`: base (worst + effect) 218.34/216.95/204.20/204.04/201.79/197.94, margins **2.66/3.05/2.80/2.96/3.21/4.06** — inside the stated range. Trace environment pinned (same single-member guest world, same harness, fresh page, three clean runs, remote-world object count recorded). `plan.md` lines 78–85 and `tasks.md` lines 146–153 mirror the values. |
| F2 (MINOR) — muzzle mean | **fixed** | `spec.md` AC-8 line 250: “the 80 ms muzzle flash at a 100 ms click interval = **+0.8**”; total **+2.8** high/medium, 0 low. `plan.md` line 79 and `tasks.md` line 151 match; the +3 worst case is retained. |
| F3 (MINOR) — post-construction wording | **fixed** | `spec.md` AC-3 lines 169–171 and AC-8 lines 243–245: “no new drawable, geometry or material is created after construction and the pools allocate nothing per frame”; the unchanged shard pool's per-spawn scratch vectors (`base.clone()`, `new Vector3()`, `direction.clone()`) are explicitly exempt. `plan.md` lines 73–74 and `tasks.md` lines 88–90 match; the T2 test asserts children/geometry/material identities and per-frame allocation freedom. |
| F4 (MINOR) — HUD ownership | **fixed** | `spec.md` AC-7 lines 227–235: camera equality stays in `scene-effects.test.ts`; HUD no-shake/no-layout-shift evidence is owned by the unchanged `Hud.test.tsx`, `App.test.tsx` and `game-view.css.test.ts` assertions (a scene unit test cannot observe the DOM HUD). `tasks.md` lines 168–171 explicitly forbids a HUD assertion in the scene test. |
| F5 (MINOR) — visual windows | **fixed** | `spec.md` AC-9 lines 268–271: tile fully gone at **320–340 ms** (destroy ends at 180 + 140 = 320 ms); smoke visible/fading at **420–480 ms**, gone by **660 ms** (impact 180 + 480). `plan.md` lines 57–59/417–419 and `tasks.md` lines 141–143 match. |
| F6 (MINOR) — exports wording | **fixed** | `spec.md` AC-2 lines 122–123: “exports these four constants with exactly these values (all existing exports and `QualityFeatures` fields remain)”. |
| F7 (MINOR) — smoke drift | **fixed** | `spec.md` AC-3 lines 156–159: “random direction times speed plus a constant **+0.25 world/s** upward bias (no acceleration or gravity)”. `plan.md` lines 214–216: `velocity = direction · speed` with `vy += 0.25` at spawn; `tasks.md` line 209 pins the same. |
| F8 (MINOR) — T3 commit | **fixed** | `tasks.md` lines 191–194: commit `feat: wire the destruction and shot effects` (a separate `docs: document small destruction and shot effects` commit for the README/index proposal is acceptable). |
| F9 (MINOR) — tolerance rule | **fixed** | `tasks.md` lines 71–74: the one-tolerance rule applies to **new** assertions only; pre-existing accepted `spaceship.test.ts`/scene tolerances stay and need no rewrite. |
| F10 (MINOR) — instanceColor | **fixed** | `spec.md` AC-3 lines 144–145: “an `InstancedBufferAttribute` assigned to `mesh.instanceColor` as the per-instance brightness channel (r = g = b)”. |
| F11 (INFO) — `t < 0` brightness | **fixed** | `spec.md` AC-4 lines 178–180: `miniCubeDestroyBrightnessAt(t < 0) → 1` (“an idle tile is unflashed; live records start at `t = 0`”); `plan.md` table line 154 uses `< 0 | 1 | 1`; `tasks.md` line 213 pins it. |

## New non-blocking findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| N1 | INFO | `spec.md` AC-8 lines 255–258 | The parenthetical “the larger of the builder median and the independent rerun” is not literally auditable for **medium 1920**: the predecessor review records no independent medium-1920 rerun, so 201.24 is the builder median only. The bar (207.0) remains valid. | Optionally annotate medium 1920 as builder-only, or record the independent value if one exists. No blocking change. | open (non-blocking) |
| N2 | INFO | `spec.md` AC-8 line 258 | “the observed 1280 high spread is 4.30 draws across individual runs” is the builder-median-vs-independent difference (215.54 − 211.24); the full individual range across the four accepted runs is 6.55 (208.99–215.54). The 3-run-median rationale still holds and the bars are unchanged. | Optionally relabel 4.30 as the “builder median vs independent rerun difference” to keep the margin derivation precise. No blocking change. | open (non-blocking) |
| N3 | MINOR | `spec.md` AC-7 lines 228–235; `tasks.md` lines 168–171 | `App.test.tsx` is cited for HUD no-shake/no-layout-shift, but that suite has no direct no-shake assertion (its closest check is “no HUD pulse”); the direct check is `game-view.css.test.ts` AC-44 (no transform/translate/rotate/scale on `main` and the panels) plus `Hud.test.tsx`'s no-inline-layout test. The HUD is unchanged and the CSS test carries the proof. | Cite the actual assertions (`game-view.css.test.ts` AC-44 and `Hud.test.tsx` AC-4) or add a no-shake check to `App.test.tsx`; no blocking change. | open (non-blocking) |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Three user asks covered (Pillar A little explosion, Pillar B 140 ms mini-cube destroy, Pillar C realistic shot); the massive gold explosion stays gone (non-goals + AC-3/AC-7/AC-9 no ray/coin/ring); Q-4–Q-7 documented; no unrelated scope. |
| Testability | ✅ | Every AC is binary and evidence-mapped; the F1 bars are now reproducible against the worst accepted trace + true effect mean + margin with the trace environment pinned; F4 assigns the HUD to the unchanged React/CSS suites; F5's windows are physically consistent; F6/F7/F10/F11 are concrete. |
| Boundaries | ✅ | Always / Ask first / Never tiers and non-goals present and consistent with `AGENTS.md`. |
| Dependency graph | ✅ | T1 → T2 → T3, acyclic; AC-1…AC-12 mapped; tasks one-session sized. |
| Parallel safety | ✅ | No `[P]` tasks; `files_owned` disjoint; T2 owns all affected unit/integration tests (`effects`, `impact-effects`, `cube-view`, `world`, `spaceship`, `scene`, `scene-spaceship`); T3 owns `scene.ts`, the new `scene-effects.test.ts`, README, logs and evidence; no shared-file contact. |
| Security | ✅ | Presentation-only; no user-controlled data, persistence, secret or network request; bounded pools (6 flash / 72 points / transient shots/flashes) recycle oldest-first; no dependency/loader/asset added. |
| Testing | ✅ | Unit + integration + manual tiers present; commands exist in `AGENTS.md`; `npm run coverage` ≥80×4 per workspace; assertion-quality and edge cases (negative/zero/late elapsed, caps, duplicate ids, reduced/instant) named. |
| Consistency | ✅ | Aligns with the vision (reduced motion, no shake), predecessor supersessions, `docs/architecture/documentation.md` index ownership and `AGENTS.md`; N1–N3 are precision/evidence notes only. |
| Risks | ✅ | The draw-budget risk is now mitigated by the worst-accepted-trace bars, the true +2.8 mean and the median-of-three acceptance; the trace environment is pinned. |
| Real-time / multi-client | ✅ | Server remains the authority for mini-cube removal; live `miniCubeRemoved` animates identically on every client; roster hydration/reconnection uses the instant path (no historical replay); no protocol/lifecycle change. |
| Containerization | ✅ | Explicitly out of scope; no service, image, port, env var, health signal, compose entry, Dockerfile or WebSocket endpoint change; `podman compose up` / `npm run dev` remains the local path; `npm run smoke` correctly not required. |
| Documentation | ✅ | Root `README.md` click sentence and phrases pinned; `docs/features/README.md` orchestrator-owned with a guarded proposed row; no `docs/architecture/**` or glossary change needed (no stack/container/term change). |
| Preserved behaviour | ✅ | Green shards (14/7/0), gold sparks (24/12/0), coin `+0.10`, banner/fly-by, reticle, cursor ship, lootbox, quality policy, reduced motion and no shake preserved; no backend/protocol/lootbox/container/dependency/audio change; no new assets. |

## AC → task traceability

| AC | Task | Evidence |
| --- | --- | --- |
| AC-1 — Motion vocabulary | T1 | `motion.test.ts` exact `MOTION` + headline sums |
| AC-2 — Adaptive quality matrix | T1 | `quality.test.ts` exact high/medium/low/reduced matrices; policy untouched |
| AC-3 — Little explosion module | T2 | `impact-effects.test.ts` |
| AC-4 — Mini-cube destroy | T2 | `cube-view.test.ts`, `effects.test.ts` |
| AC-5 — Remote cube parity | T2 | `world.test.ts` |
| AC-6 — Realistic shot | T2 | `spaceship.test.ts`, `scene-spaceship.test.ts` |
| AC-7 — Scene integration | T3 | `scene-effects.test.ts`, `scene.test.ts`, `scene-spaceship.test.ts`; HUD via unchanged `Hud`/`App`/`game-view.css` suites |
| AC-8 — Object/draw/triangle/frame budget | T3 | Build-log traces + accounting |
| AC-9 — Visual evidence and manual check | T3 | `docs/features/small-destruction-shot-fx/evidence/` + build log |
| AC-10 — Documentation | T3 | README greps, index guard, build-log proposal |
| AC-11 — No dependency/backend/protocol/container/audio change | T3 | Fork-point diff/import/asset/audio gates |
| AC-12 — Coverage and full gate | T3 | `npm run coverage`, lint, typecheck, test, build |

## Verification performed

- Read `spec.md` r3, `plan.md` r3, `tasks.md` r3, `status.md` (spec_review round 2) and `reviews/spec-r1.md`; compared every F1–F11 row against the revised text in all three artifacts.
- Re-verified the AC-8 arithmetic with `node`: worst accepted + effect = 218.34/216.95/204.20/204.04/201.79/197.94 for high-1280/high-1920/medium-1280/medium-1920/low-1280/low-1920; bars 221.0/220.0/207.0/207.0/205.0/202.0; margins 2.66/3.05/2.80/2.96/3.21/4.06, inside the stated 2.6–4.1.
- Re-checked the predecessor accepted values against `docs/features/particle-only-click-effects/build-log-T2.md` (builder high 211.24/214.15, medium 201.09/201.24, low 198.09/197.94; idle 168.05/168.17) and `reviews/code-r1.md:25` (independent high 215.54/209.47, medium 1280 201.40, low 1280 201.79, low 1920 195.27).
- Re-confirmed the three pillars (scope lines 44–63; AC-3/4/6), Q-1/Q-2/Q-3 accepted defaults and Q-4–Q-7 documentation (lines 411–437), the no-gold boundary (non-goals; AC-3 166–168; AC-7 231–232; AC-9 270–271), the preserved-behaviour list (lines 65–68; AC-7 232–235; AC-9 271–274), T1 → T2 → T3 ownership (tasks lines 7–13, 22–33, 51–66, 116–123, 154–155), the AC-1…AC-12 mapping, and the 135-object/impact-group-4/pool/triangle/bundle budgets (AC-8; plan lines 62–85).
- Confirmed the supersession table still explicitly covers `spaceship-cursor-loot-animations` AC-6/34/36/37/42/47/48/52 and `particle-only-click-effects` AC-1/2/3/5/6/7, and that no predecessor artifact is rewritten.
- Checked the HUD evidence claim against the current suites: `game-view.css.test.ts` has the AC-44 no-shake test (no transform/translate/rotate/scale on `main`/panels) and `Hud.test.tsx` has the no-inline-layout AC-4 test; `App.test.tsx` has no direct no-shake assertion (N3).
- Re-ran the AC-11 import/URL/loader and audio greps over the current production surfaces: clean; the root README still has the five preserved phrases and the retired `vanishes on the same frame`; `docs/features/README.md` is committed with the predecessor rows and no row for this feature.
- Did not run the test/coverage/build suite: this is the spec gate; the code gate will run it.

## Notes / backlog (non-blocking)

- **N1–N3** are evidence-precision notes; none changes the three-pillar design, the supersession boundary, the task DAG or any budget.
- All r1 findings are fixed; no rebuttal. The AC-8 bars are now defensible: worst accepted trace + true +2.8 effect + a 2.6–4.1 margin, with the 3-run median as the acceptance statistic and the trace environment pinned.
- The three asks are delivered in substance; the 140 ms destroy is the explicit user-requested deviation from the reference's one-frame conceal, and the supersession table remains authoritative (predecessor artifacts untouched).
- Q-1 (140 ms tile destroy), Q-2 (bolt + muzzle + 0.12/120 ms recoil with 180 ms travel) and Q-3 (warm-white core 0.18→0.55, amber embers, warm-grey haze) are reasonable accepted defaults; Q-4–Q-7 are documented and non-blocking.
- The visual evidence plan at 1280×720 and 1920×1080 with measured frame timestamps and the existing particle-only frames as “before” is sound; the F5 windows are now physically consistent (320–340/420–480/660 ms).
- No open BLOCKER or MAJOR: the feature may proceed to the build gate.
