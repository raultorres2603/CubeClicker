---
feature: spaceship-cursor-loot-animations
phase: code
iteration: 1
verdict: changes_requested
blocking: 1
---
# Code Review — r1

## Summary

❌ **changes requested — 1 blocking finding.** The reproduced gates are green (lint, typecheck, 868 backend + 1,697 frontend tests, coverage 95.43/87.71/99.7/95.43 and 96.28/95.26/97.42/96.28, build 273.16 KB gzip, real smoke 12/12), and the inspected backend catalog/migration/repository/hub and frontend model/motion/effects/quality/panel code largely match spec r4.

However, AC-40's cursor-ship fly-by is implemented but never triggered by production code. The review budget was exhausted before the full AC-1…AC-52 sweep could be completed; unverified items below are explicitly **not** counted as passes.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | BLOCKER | `src/frontend/src/render/spaceship.ts:380` (definition); `src/frontend/src/render/spaceship.test.ts:323,347,358` (only callers); `src/frontend/src/render/scene.ts:1065-1144` (no trigger) | **AC-40 unmet — level-complete ship fly-by never runs in production.** `startFlyBy()` exists and is exercised only by unit tests. No production module calls it: the scene’s `applySnapshot`/`update` never starts it, `SceneView` exposes no fly-by trigger, and the session/App never call one. A level change therefore shows the DOM burst/banner but the cursor ship never performs the required 700 ms 360° roll on the 1.2-world orbit with the 16-point fire trail. The T14 log is also unsupported here: `docs/features/spaceship-cursor-loot-animations/build-log-T14.md:941` claims the 302 ms frame shows the mid-roll and `:1156` claims `scene-spaceship.test.ts`/`scene.test.ts` pin it, but neither test file calls `startFlyBy` (grep finds only `spaceship.test.ts`), so the screenshot claim is not reproducible through the shipped app and appears to be harness-driven rather than feature-driven. | Add a production trigger on the level-index increase (e.g. `SceneView` tracks the previous `snapshot.levelIndex` and calls `spaceship.startFlyBy()` on a rise, or the session/App invokes a new `SceneView.startFlyBy()`), add an integration test asserting the fly-by starts on a level change and returns to pointer-follow after 700 ms (including reduced-motion cancellation), regenerate the T14 level evidence through the real app, and correct the T14 log’s unsupported claim. | open |
| F2 | MINOR | `docs/features/spaceship-cursor-loot-animations/build-log-T14.md:11-24` | The “BASE and HEAD” block records `HEAD = 512c01b` even though the log header says the gate was re-run after T15 `0bfc524` (current feature tip is `8d4c633`). The evidence is therefore recorded against the wrong commit for the claimed re-run. | Re-record the BASE/HEAD block for the actual final re-run commit and state which commit each gate ran against. | open |
| F3 | MINOR | `src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx:386` | `expect(screen.getByRole('button', { name: 'Equip Port Silver Wing' })).toBeTruthy()` is a weak existential banned by the testing checklist; `getByRole` already throws on absence and the accessible name is already pinned, so this assertion adds no regression protection. | Replace it with a concrete behavior/attribute assertion (or delete the redundant assertion); do not use `toBeTruthy` as a stand-in. | open |

## Acceptance verification — sampled, not a full AC-1…AC-52 pass

The budget was exhausted before every AC could be independently checked. The rows below are the ACs with direct evidence gathered in this review; ACs not listed remain **unable-to-verify**, not met.

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1…AC-4 | ✅ (inspection + green suite) | `cursor-ship.ts` inspected: 10 slot groups, 21 named meshes, 19 materials, AC-4 finish values on structural parts, canopy/ignition values, no lights/textures/loaders/random, idempotent `dispose()`; `cursor-ship.test.ts` passed in `npm test`. |
| AC-5, AC-6 | ✅ (inspection + green suite) | `spaceship.ts` retains follow/target/shot/ignition constants and formulas; `spaceship.test.ts` passed. |
| AC-7 | ✅ (inspection + green suite) | `Spaceship.applyAppearance` delegates slot-isolated changes and pulses only on change; `SceneView.applySnapshot` compares `lastAppliedAppearance` before applying; tests passed. |
| AC-8 | unable | Bundle size reproduced (273.16 KB gzip); the 10 s idle / 10 clicks/s frame traces and per-size medians were **not** independently reproduced. |
| AC-9 | partial | Reduced-motion paths inspected; manual A/B screenshots were not independently reproduced. |
| AC-10…AC-13 | ✅ (inspection + green suite) | Both `parts-v2.ts` catalogs inspected: 10 slots, 30 exact rows, 10 standard/10 rare/10 epic, rare 3 / epic 1 (total 40), one-draw `selectLootPart` with boundaries; `parts-v2.test.ts` (both workspaces) passed. |
| AC-14, AC-15 | partial | Migration 006 SQL inspected: version column/default, appearance key+value rewrite, count bounds, collision summing, idempotent shape; `migration-006.test.ts` passed inside `npm test`, but the migration/pg_dump was **not** independently re-run against real Postgres. |
| AC-16, AC-17 | ✅ (inspection + green suite) | `economy-repository.ts` normalizes every read, returns defensive copies, and implements the conditional atomic v2 open with duplicate detection and `no_lootbox`/`no_key` order; tests passed. |
| AC-18…AC-22 | ✅ (inspection + green suite) | Hub uses the captured `random`, per-member in-flight guard, opener-only `lootboxOpened`, account-wide `customizationUpdate`, equip/unequip validation and per-slot atomic writes; `hub.test.ts`/`app.test.ts` passed. |
| AC-23…AC-25 | ✅ (inspection + green suite) | Client/server protocol additions and `lootboxOpened` codec inspected; both `protocol.test.ts` suites passed. |
| AC-26, AC-27, AC-28 | ✅ (inspection + green suite) | Multi-tab broadcast, reconnect customization load, guest local flow and legacy all-or-nothing ownership inspected; hub/session/engine tests passed. |
| AC-29, AC-30 | partial | Panel rendered 10 slot rows/3 variants/equip/unequip and 44 px/focus CSS inspected; manual 320×568/375×667 checks were not reproduced. |
| AC-31 | partial | Preview factory/component inspected (30 fps cap, 0.0004 rad/ms, reduced static, dispose, 10 data attributes, WebGL fallback); screenshots not independently reproduced. |
| AC-32 | ✅ (inspection + green suite) | Grant flow, sequence increment, dismiss, `customizationUpdate` non-clearing, reveal attributes/copy inspected; panel/engine/session/App tests passed. |
| AC-33 | partial | Repository/hub fixtures and tests passed; the real-Postgres end-to-end restore/rejoin path was not independently reproduced. |
| AC-34 | ✅ (inspection + green suite) | `motion.ts` values and easings inspected; CSS maps the 13 pinned tokens on `main`; `motion.test.ts`/`game-view.css.test.ts` passed. |
| AC-35 | partial | `picking.ts` preallocated hover path and `targeting.ts` outline/reticle inspected; reticle visual fidelity was not manually verified. |
| AC-36…AC-39 | ✅ (inspection + green suite) | `MINI_CUBE_POP_MS = 0`/same-frame zero-scale inspected; 12-ray/14-shard/6-coin/3-ring pools inspected; coin popup queue/1100 ms/CSS inspected; tests passed. |
| AC-40 | ❌ **unmet** | See F1: fly-by is never triggered in production; T14 fly-by evidence claim is unsupported. |
| AC-41 | partial | T15 layout fix and 1290 ms phase timeline inspected (panel/CSS tests passed); the exact `easeOutBack(3.0)` orb envelope is not confirmed (see limitations). |
| AC-42, AC-43, AC-44 | ✅ (inspection + green suite) | Ship bank/pitch/trail/pulse, row flash/upgrade pulse and no-shake CSS inspected; tests passed. Manual visual checks not reproduced. |
| AC-45, AC-46 | unable | Audio alignment metadata and reference-frame provenance were not independently audited. |
| AC-47 | unable | Tiered frame traces/recovery were not independently reproduced; draw-count constants were inspected only. |
| AC-48 | partial | Reduced-motion code paths and CSS block inspected; manual A/B was not reproduced. |
| AC-49 | ✅ **reproduced** | `npm run coverage`: backend 95.43/87.71/99.7/95.43; frontend 96.28/95.26/97.42/96.28; both workspaces ≥ 80 on all four metrics. Config diff vs `BASE` empty. |
| AC-50 | unable | README/glossary/feature-index docs were not independently audited. |
| AC-51 | partial | Smoke reproduced 12/12 through the container path; compose/Dockerfile/`server.ts` diff vs `BASE` was not independently re-run. |
| AC-52 | partial | `quality.ts` policy/matrix inspected and tests passed; the forced-tier traces and recovery proof were not independently reproduced. |

## Verification performed

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0 (both workspaces).
- `npm test` → backend 868 tests / 24 files, frontend 1,697 tests / 63 files, all passed.
- `npm run coverage` → backend **95.43 statements / 87.71 branches / 99.7 functions / 95.43 lines**; frontend **96.28 / 95.26 / 97.42 / 96.28**; both above the 80 threshold; `vitest.config.ts` diff vs `f07d067` empty (no new exclusions/threshold change).
- `npm run build` → exit 0; initial JS **273.16 kB gzip** (≤ 350 KB), CSS 5.24 kB gzip.
- `npm run smoke` → real containerized run, **SMOKE PASS (12/12 checks)** including backend health, frontend HTML, two WebSocket clients, multiplayer join/overflow/sync/leave, Mailpit register/verify, login and guest join.
- `git diff --stat f07d067..HEAD` inspected; the feature diff is confined to backend parts/migration/protocol/repository/hub, frontend game/render/ui/session and feature docs/evidence, plus README/glossary.
- Source inspection: backend `parts-v2.ts`, migration `006`, `protocol.ts`, `economy-repository.ts`, `hub.ts`; frontend `parts-v2.ts`, `motion.ts`, `ship-motion.ts`, `cursor-ship.ts`, `spaceship.ts`, `targeting.ts`, `impact-effects.ts`, `quality.ts`, `scene.ts`, `cube-view.ts`, `picking.ts`, `session.ts`, `engine.ts`, `preview.ts`, `SpaceshipPreview.tsx`, `SpaceshipCustomizationPanel.tsx`, `App.tsx`, `Hud.tsx`, `UpgradesPanel.tsx`, `LevelCompleteBanner.tsx`, `app.css`, `game-view.css`; changed tests spot-checked.
- Static search for `startFlyBy`/`flyBy`: production references exist only in `render/spaceship.ts`; the only call sites are `render/spaceship.test.ts:323,347,358`. `scene.py`/`session.ts`/`App.tsx` contain no trigger.
- Evidence spot-check: `evidence/t14-level-0302ms-1280x720.png` visually shows a rolled cursor ship, but no production code path can produce that state; the image is consistent with the harness driving the model directly, not with the shipped level-change path.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ⚠️ partial | Server-authoritative inventory, catalog/ownership validation, protocol codecs, parameterized SQL and absence of new dependencies/assets were inspected. Not an exhaustive security pass (no full `innerHTML`/secret/DOM sweep). |
| Quality | ❌ | AC-40 integration gap (F1); T14 evidence claim does not match the shipped code. |
| Testing | ⚠️ partial | Reproduced gates are green and coverage is above threshold, but the full banned-matcher/useless-test sweep was not completed; one weak `toBeTruthy` assertion recorded as F3. |

## Previous round verification

Not applicable — iteration 1.

## Review limitations — unable-to-verify (not passes)

The review budget was exhausted before the full AC-1…AC-52 sweep. The following are **not** verified and must not be treated as green:

- **Full AC-1…AC-52 table:** only the sampled rows above have direct evidence; the remainder are unable-to-verify.
- **Migration execution:** migration 006 was not independently re-run against real Postgres; the pre-006 `pg_dump`/restore/AC-33 database fixture was not reproduced (the unit test passed inside `npm test`).
- **AC-46 reference provenance:** the 40 reference frames/3 contact sheets, observed timestamps and `[O]`/`[E]` mapping were not independently audited; only the T14 log’s claims were read.
- **Docs / AC-50:** README exact phrases, procedural/no-external-assets statement, glossary entries and `docs/features/README.md` ownership were not independently verified.
- **Test integrity:** no exhaustive banned-matcher/snapshot/tautology sweep across all changed tests; F3 is one observed instance, not a complete result.
- **T14 BASE/HEAD:** the recorded HEAD does not match the claimed post-T15 re-run (F2).
- **AC-41 orb easing:** the CSS uses a `cubic-bezier(0.34,1.56,0.64,1)` scale to `1.25` rather than a confirmed `easeOutBack(3.0)` 250 ms envelope; the exact spec match is unresolved and needs a focused check.
- **AC-8/AC-47 performance:** the high/medium/low frame traces, p95 figures and forced recovery were not reproduced; only the build size and draw-count constants were inspected.
- **AC-9/AC-48 reduced motion:** code/CSS paths inspected, but the manual A/B and pixel-identical reduced-motion screenshots were not independently reproduced.
- **AC-51 container/protected diff:** smoke passed, but the empty compose/Dockerfile/`src/server.ts`/manifest/lockfile diff versus `BASE` was read from the log, not re-run.
- **AC-33 real-DB end-to-end:** the repository/hub unit fixtures passed; a real Postgres restore/rejoin path was not independently exercised.
- **AC-30 responsive layout:** the 320×568/375×667 manual checks were not reproduced.
- **T14 evidence images:** only one evidence image was spot-checked; the full 57-image set was not reviewed.

## Backlog / next round

1. **Fix F1:** wire a production level-change trigger to `spaceship.startFlyBy()`, add an integration test (scene or session level) that observes the fly-by starting on a level increase and returning to pointer-follow after 700 ms, and correct the T14 evidence/log claim.
2. **Re-review with a fresh budget:** the next reviewer must complete the full AC-1…AC-52 table, independently re-run the migration/pg_dump path, audit AC-46/reference provenance and AC-50 docs, complete the test-integrity sweep, and resolve the AC-41 orb-easing question before a verdict can be considered.
3. **Then address F2 (T14 BASE/HEAD) and F3 (weak assertion)** as part of the same correction round.
