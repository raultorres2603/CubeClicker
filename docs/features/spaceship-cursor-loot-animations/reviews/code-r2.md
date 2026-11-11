---
feature: spaceship-cursor-loot-animations
phase: code
iteration: 2
verdict: approved
blocking: 0
---
# Code Review — r2

## Summary

✅ **approved — no open BLOCKER/MAJOR.** T16 `ba77801` closes the round-1 AC-40 blocker: `SceneView.applySnapshot` now starts exactly one fly-by on the production `levelIndex` rise, with a guarded `startFlyBy()` call, reduced-motion cancellation and a three-test integration suite. The final T14 re-run records production evidence (one 2π roll, 16-point trail at high, return to follow, reduced 0) and the T15 reveal fix remains green (306 px reveal / 80 px orb / unclipped card, 1290 ms unchanged).

I reproduced the full code gate on the current tree (`ba11d9a` docs evidence commit; verified source `ba77801`). Remaining items are MINOR/INFO documentation-metadata and evidence-budget notes; no functional blocker remains. AC-1…AC-52 are mapped to the shipped code/tests/evidence below.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F4 | MINOR | `docs/features/spaceship-cursor-loot-animations/tasks.md:262,267`; `docs/features/spaceship-cursor-loot-animations/build-log-T14.md:14-15` | Documentation metadata is slightly stale. The `tasks.md` T16 section still says `status: [ ]` (while `status.md` and the build log mark T16 complete) and its note still names the earlier `0bfc524`/`8d4c633` correction, whereas the final T14 log records verified tree `ba77801` and the follow-on docs evidence commit. Separately, the T14 BASE/HEAD command block labels `git rev-parse HEAD` as the verified tree `ba77801`; at the evidence commit `ba11d9a` that command would print `ba11d9a`, although the adjacent bullet correctly says the docs-only evidence commit follows the verified tree. | Before acceptance, update the T16 task status/note to the final `ba77801`/`ba11d9a` record (or remove the stale commit ids) and label the T14 command `git rev-parse ba77801` or add the evidence commit explicitly. Docs-only; no source change required. | open (nonblocking) |
| F5 | INFO | `src/frontend/src/ui/game-view.css:360-391` | AC-41 orb easing interpretation: the CSS reaches the pinned `scale(1.25)` over `250 ms` using `cubic-bezier(0.34,1.56,0.64,1)`, not a literal JS `easeOutBack(3.0)` curve. The observable envelope (25% overshoot at 250 ms) and all phase timings are met; the exact easing curve is an approximation. | No action required unless exact curve fidelity is desired; if so, implement the back-out envelope explicitly and pin it with a CSS/keyframe test. | open (INFO) |
| F6 | INFO | `docs/features/spaceship-cursor-loot-animations/build-log-T14.md` performance sections | AC-8/AC-47 high/medium/low browser traces and AC-30 mobile 320×568/375×667 manual checks were recorded in the T14 evidence but were not independently re-run in this review round; the build log retains the raw trace tables and the CSS/tests cover the responsive rules. | No action required for the feature; if a future change touches the render loop or panel layout, re-run the T14 harness. | open (INFO) |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) — AC-40 fly-by never triggered in production | **fixed** | T16 `ba77801`: `src/frontend/src/render/scene.ts:955-960` adds the guarded `triggerLevelFlyBy()`; `scene.ts:1102-1105` starts it on the production `levelIndex` rise. `src/frontend/src/render/scene-spaceship.test.ts:507-604` adds three integration tests: exactly one 700 ms/2π roll on a level rise, 16-point trail at 350 ms, return to follow, repeated same-level no restart, reduced-motion zero/cancel. T14 production evidence: one roll interval, max \|rotation.z\| 2π, max trail 16 at high, return to follow; reduced max 0/trail 0; `t14-flyby-production-0305ms-1920x1080.png`, `…-after-*`, `…-reduced-*`. |
| F2 (r1) — T14 BASE/HEAD stale | **fixed** | `build-log-T14.md:11-33` now records feature `BASE = f07d067…`, verification tree HEAD `ba77801…` (all recorded gates ran there), prior T15 `0bfc524`, prior evidence `8d4c633`, and the docs-only evidence commit that follows. Residual transcript label documented as F4 (MINOR). |
| F3 (r1) — `toBeTruthy()` weak assertion | **fixed** | `src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx:386-388` now asserts the reveal button’s exact `className` (`customization-reveal-equip`) instead of `toBeTruthy()`. |

## Acceptance verification — AC-1…AC-52

All rows are met in the current tree. Evidence is the shipped source/test file, the reproduced command, or the recorded T14/T15/T16 evidence noted. Items with an asterisk carry the review limitation noted in the row.

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `render/cursor-ship.ts` factory: `cursor-ship-model`, 10 slot groups, 21 meshes, 2 ignitions, 19 materials, 32-object subtree, <=2500 tris, no lights/points/sprites/textures/loaders/random, idempotent dispose; `cursor-ship.test.ts` passed. |
| AC-2 | ✅ | Exact 20-name/21-mesh map and slot membership; `cursor-ship.test.ts`. |
| AC-3 | ✅ | `CURSOR_SHIP_LENGTH/WIDTH/HEIGHT` 1.4/0.9/0.4, measured boxes, nose z>=0.65, flames z<=-0.6; `spaceship` scale/rest/name preserved; `cursor-ship.test.ts`, `spaceship.test.ts`. |
| AC-4 | ✅ | Structural `MeshPhysicalMaterial` values (metalness .55/roughness .38/clearcoat .4/clearcoatRoughness .2), canopy glass, basic highlight, emissive transparent ignitions opacity .55, thin seams/vents/nozzles, no textures/assets; `cursor-ship.test.ts`; T14 visual matrix. |
| AC-5 | ✅ | 240 ms follow formula, reduced snap, NDC offsets, plane distance 6, default-camera vector; `spaceship.test.ts`, `scene-spaceship.test.ts`. |
| AC-6 | ✅ | `SHOT_TRAVEL_MS=180`, endpoints/linear travel/deferred explosion; 2 ignitions, 100 ms flicker, .01 threshold, hidden at rest/reduced; `spaceship.test.ts`, `scene-spaceship.test.ts`. |
| AC-7 | ✅ | `Spaceship.applyAppearance` slot isolation/idempotence and outer-group identity; `SceneView.applySnapshot` applies changed appearance and retains `lastAppearance`; `spaceship.test.ts:122-151`, `scene-spaceship.test.ts:448-505`. |
| AC-8 | ✅* | Build 273.23 kB gzip; T14 high-tier idle/click traces 3/3 at both sizes avg 16.666 ms/p95 16.7–16.8; cursor 22 draws high/21 meshes/19 materials; `*` traces recorded in T14, not re-run in r2. |
| AC-9 | ✅ | Reduced motion zeros bank/pitch/trail/pulse, ignitions hidden, materials still applied; `spaceship.test.ts:241-273`; T14 reduced A/B. |
| AC-10 | ✅ | Both `parts-v2.ts` modules: 10 slots in pinned order/names; `isValidSlotId` rejects `wings`/`engine`/`body`/empty/`Hull`; `parts-v2.test.ts` both workspaces. |
| AC-11 | ✅ | Exactly 30 rows, exact ids/names/rarities/colours/accents/shapes, 10/10/10, `PART_CATALOG_VERSION=2`; both literal tables and tests match. |
| AC-12 | ✅ | Standard parts implicitly owned, never looted, missing appearance falls to standard; `parts-v2.test.ts`, `hub.test.ts`, `engine.test.ts`. |
| AC-13 | ✅ | One weighted draw over 20 parts, rare 3/epic 1, total 40; rng 0→`hull-obsidian`, 0.999999/1→`tail-fin-comet`, one draw, no standards; both `parts-v2.test.ts`. |
| AC-14 | ✅ | Migration 006 adds version default 1, backfills 2, default 2; `schema.sql` mirror; idempotent; `migration-006.test.ts` independently re-run (13 tests, real PostgreSQL 16) + `migrate.test.ts` (11 tests). |
| AC-15 | ✅ | Exact legacy key/value rewrite, split wings/ignitions, nose/cockpit retained, non-numeric/overflow skipped, collisions summed, version 2, idempotent re-run; `migration-006.test.ts` real-PG suite; T2 `pg_dump`/restore evidence (dump hash `b1e9d30…`, restore exit 0, re-apply unchanged). |
| AC-16 | ✅ | `findCustomizationByUserId` defensive copy + normalization on every read, zero state, unknown/mismatch dropped; in-memory and PG shapes agree; `economy-repository.test.ts`. |
| AC-17 | ✅ | `applyLootboxOpenV2` single conditional update, both counts decremented, duplicate flag, `no_lootbox` before `no_key`, no negatives; `economy-repository.test.ts`. |
| AC-18 | ✅ | Hub uses captured `random`/`selectLootPart`, one draw, updates members, account-wide `customizationUpdate`, opener-only `lootboxOpened` with partId/slot/rarity/duplicate/absolute state; `hub.test.ts`, `app.test.ts`. |
| AC-19 | ✅ | `no_lootbox`/`no_key` order, no write/broadcast/grant/state change; `hub.test.ts`. |
| AC-20 | ✅ | Per-member `openingMembers` guard, silent drop, released in `finally`; independent tabs allowed; `hub.test.ts`. |
| AC-21 | ✅ | Unknown/malformed→`unknown_part`; non-standard unowned→`not_owned`; standards allowed; server-derived slot; legacy two-slot exception; no state change on error; `hub.test.ts`, `engine.test.ts`. |
| AC-22 | ✅ | Atomic per-slot equip/unequip, no-op re-equip/default unequip, other slots untouched, account-wide update/broadcast; `hub.test.ts`, `economy-repository.test.ts`. |
| AC-23 | ✅ | Client `openLootbox`/`equipPart`/`unequipPart`, non-empty string validation, `bad_message`; both `protocol.test.ts`. |
| AC-24 | ✅ | Server `lootboxOpened` shape/codec: non-empty part/slot, rare/epic, boolean duplicate, non-negative integer counts, positive part counts, non-empty appearance; defensive copies; both `protocol.test.ts`. |
| AC-25 | ✅ | Backend/frontend parity fixture matrix and shared constants/codes; both `protocol.test.ts`. |
| AC-26 | ✅ | Account-wide `customizationUpdate`, opener-only grant, reconnect welcome persisted customization/no replay, guest no account broadcasts; `hub.test.ts`, `session.test.ts`. |
| AC-27 | ✅ | Guest synchronous open consumes one of each, one weighted part, monotonic grant sequence/snapshot, no transport; guest equip/unequip; ephemeral; `engine.test.ts`, `session.test.ts`. |
| AC-28 | ✅ | Legacy equip ids map `body→hull`, `wings→both`, `engine→both`; all-or-nothing ownership for multi-slot ids; nose/cockpit direct; frontend normalizer; `hub.test.ts`, `parts-v2.test.ts`, `engine.test.ts`. |
| AC-29 | ✅ | 10 slot rows, 3 variants each, owned/locked/equipped, equip `aria-pressed`/Equipped, locked text/no button, unequip label/disabled default, pending-open disabled; `SpaceshipCustomizationPanel.test.tsx`. |
| AC-30 | ✅* | 44×44 targets, `:focus-visible` `var(--accent)`, section ARIA/data-mode, locked entries non-focusable, `max-height: 60vh` scroll; `SpaceshipCustomizationPanel.test.tsx`, `app.css.test.ts`, `game-view.css.test.ts`; `*` 320×568/375×667 manual check not re-run, CSS mobile width/overflow rules inspected. |
| AC-31 | ✅ | `createPreviewScene` real model/appearance, 0.0004 rad/ms, 30 fps cap, reduced static, dispose, WebGL fallback, aria + 10 slot attrs; `preview.test.ts`, `SpaceshipPreview.test.tsx`; T14 preview screenshots. |
| AC-32 | ✅ | `lastLootboxGrant` set/advanced on grant, not cleared by `customizationUpdate`, dismiss clears, reveal region role/status/data/copy/Equip, same-part new sequence restarts; panel/engine/session/App tests. |
| AC-33 | ✅ | Migration/repo/hub/session fixtures; restored v2 legacy row normalizes; exact AC-33 fixture; welcome/rejoin; T2 restore/re-apply; smoke. |
| AC-34 | ✅ | `motion.ts` exact observed/extrapolated tokens and easings; `easeOutCubic` re-export; 13 CSS tokens on `main`; `motion.test.ts`, `game-view.css.test.ts`. |
| AC-35 | ✅ | Preallocated hover pick, one raycast/frame, 1.03 outline, six 60° ticks/12 vertices, 120 ms fade/250 ms hold, miss hide, reduced static/no ticks; `picking.test.ts`, `targeting.test.ts`, `session.test.ts`, `scene-spaceship.test.ts`; T14 target-lock screenshots. |
| AC-36 | ✅ | `MINI_CUBE_POP_MS=0`, same-frame zero scale, no pop records/colour writes, remote cubes identical; `effects.test.ts`, `cube-view.test.ts`, `world.test.ts`, `scene.test.ts`. |
| AC-37 | ✅ | 12-ray/14-shard/6-coin pools, caps 3/42/18, one InstancedMesh each, grow/hold/fade 80/100/270, debris speed/drag/gravity/angular/lifetime, reuse oldest, reduced suppression; `impact-effects.test.ts`; T14 burst frames. |
| AC-38 | ✅ | 3 ring instances of one baked 32-segment/8-spoke/4-satellite geometry, one additive material/draw, 1→5 over 330 ms easeOutQuad, 150 ms fade/480 visible, reduced 120 ms final-scale flash; `impact-effects.test.ts`, `scene-spaceship.test.ts`. |
| AC-39 | ✅ | One `+delta` popup per coin gain, max 3/oldest dropped, 1100 ms, 0.7→1 over 80 ms, 45 px rise/220 ms, no HUD pulse/shake, reduced static 600 ms; `Hud.test.tsx`, `App.test.tsx`; T14 measured 1057–1121 ms. |
| AC-40 | ✅ | **T16 fix:** `scene.ts:955-960` guarded `triggerLevelFlyBy`, `scene.ts:1102-1105` production `levelIndex` rise; `scene-spaceship.test.ts:507-604` exactly one 700 ms/2π roll, 16-point trail, return to follow, no restart, reduced zero/cancel; T14 production sampler max \|rotation.z\| 2π, max trail 16, return, reduced 0; `t14-flyby-production-*` screenshots. |
| AC-41 | ✅* | T15 `0bfc524`: reveal 306 px, orb 80 px (100 px overshoot), card 198/183 px unclipped at 1280/1920; exact phases 420+250+120+360+140=1290, copy/ARIA/reduced unchanged; panel/CSS tests; `*` exact CSS easing is a back-out approximation (F5 INFO). |
| AC-42 | ✅ | Bank/pitch formulas/clamps, 8-point/220 ms trail, .015/2600 idle, 260 ms/4% pulse, 100 ms plume, no muzzle/recoil/press, zero at dt 0/rest/reduced; `ship-motion.test.ts`, `spaceship.test.ts`. |
| AC-43 | ✅ | 260 ms `data-equipping` row flash + 4% ship pulse; 260 ms `data-purchased` upgrade pulse; no coin HUD pulse; reduced instant; panel/upgrades/App tests; T14 measured data-equipping 9–263 ms. |
| AC-44 | ✅ | Camera/HUD/main/upgrades/customization transforms unchanged across pop/ring/level/banner; no shake token/random camera; `scene.test.ts`, `App.test.tsx`, `game-view.css.test.ts`; T14 computed styles none. |
| AC-45 | ✅ | `video-analysis.md` §4.11 records 1.292/1.35–1.40, 6.792/6.92/7.01, banner 7.87, true peak −1.6 dBFS; no audio asset/dependency/playback code. |
| AC-46 | ✅ | `video-analysis.md` metadata/40 frames/3 contact sheets/observed timestamps and `[O]`/`[E]` mapping; `reference/` has 43 files; T14 reference table maps observed vs extrapolated beats; no unobserved value claimed observed. |
| AC-47 | ✅* | T14 high-tier 6/6 runs avg 16.666 ms/p95 <=16.8 at both sizes/workloads; medium/low forced traces and lower draw loads; recovery 289/290 + 589/590 frames; draw accounting 22/17/15, net +21; bundle 273.23 kB; `*` recorded T14 evidence, not re-run in r2. |
| AC-48 | ✅ | Every new animation has pinned reduced variant (reticle static, instant conceal/no particles, static ring flash, static coin popup, 150 ms overlay banner, instant lootbox, cursor zeros, instant equip/upgrade); tests + T14 AE 0 A/B. |
| AC-49 | ✅ | `npm run coverage` exit 0: backend 95.43/87.71/99.7/95.43, frontend 96.34/95.31/97.43/96.34; both workspaces >=80; Vitest config diff vs `BASE` empty; no exclusions/threshold changes. |
| AC-50 | ✅ | README contains `granular spaceship parts` and preserves `detailed blue/orange hero spaceship`, states procedural/no external assets; glossary defines `part slot`, `lootbox reveal`, `motion token`; `docs/features/README.md` unchanged vs `BASE`; proposed row in T14 log. |
| AC-51 | ✅ | Container diff vs `BASE` empty (compose/smoke override/Dockerfiles/server/manifests/lockfile); only migration 006 DB artifact; real `npm run smoke` 12/12 including WebSocket/Mailpit/auth/multiplayer. |
| AC-52 | ✅ | `quality.ts` pure policy: 120-frame window, 250 ms clamp, 60 samples, avg/p95 nearest-rank, exact high/medium/low thresholds, 1000/3000 ms cooldowns, one change/decision, high default, reduced-motion authority; `quality.test.ts` exact boundary/hysteresis/recovery; T14 traces/recovery. |

## Verification performed

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0 (both workspaces).
- `npm test` → backend **868 tests / 24 files**, frontend **1,700 tests / 63 files**, all passed.
- `npm run coverage` → backend **95.43 / 87.71 / 99.7 / 95.43**; frontend **96.34 / 95.31 / 97.43 / 96.34**; both workspaces >= 80 on statements/branches/functions/lines; `npm run coverage` exit 0.
- `npm run build` → exit 0; initial JS **985.27 kB / 273.23 kB gzip** (<=350 KB), CSS 5.24 kB gzip.
- `npm run smoke` → real containerized run, **SMOKE PASS (12/12 checks)** including backend health, frontend HTML, two WebSocket clients, multiplayer join/overflow/sync/leave, Mailpit register/verify, login, guest join.
- Targeted migration re-run: `npm test --workspace @cubeclicker/backend -- --run src/db/migration-006.test.ts src/db/migrate.test.ts` → **24 tests passed** (13 migration-006 including the real PostgreSQL suite, 11 migrate).
- T16 diff inspected: `scene.ts` adds `triggerFlyBy()` and the `levelIndex`-rise guard; `scene-spaceship.test.ts` adds three production-path integration tests; `SpaceshipCustomizationPanel.test.tsx` replaces the weak assertion; T14 log records the corrected fly-by claim.
- T15 fix inspected: `game-view.css` `.lootbox-reveal` `flex: 0 0 auto`/`min-height: 18rem`/`overflow: visible`, orb/card non-shrinking; T15/T14 tests assert reveal 306 px, orb 80/100 px, card fully visible; 1290 ms/copy/ARIA/reduced tests unchanged.
- T14 evidence inspected: `t14-flyby-production-0305ms-1920x1080.png` (mid-roll), `…-after-1920x1080.png` (return to follow), `…-reduced-1280x720.png` (no roll); `evidence/` contains 96 files / 75 MB; reference/ contains 43 files.
- `git diff ba77801..HEAD` → docs/evidence only; current source tip `ba77801`; current docs evidence HEAD `ba11d9a`; no source/container/dependency drift after the verified build.

## Security / real-time / container / docs audit

- **Security:** no new dependency, asset, loader, texture, URL, secret or `.env*` change (package/compose/Dockerfile diff empty vs `BASE`). Account inventory and appearance remain server-authoritative; client part/slot ids are validated against the catalog and ownership; SQL is parameterized; protocol maps are defensively copied. No `innerHTML`/`eval`/dangerous HTML in the reviewed feature paths.
- **Real-time:** hub account broadcasts, opener-only `lootboxOpened`, per-member in-flight guard, multi-tab state, reconnect `welcome`, and guest isolation are covered by `hub.test.ts`/`app.test.ts`/`session.test.ts`; the smoke run verifies the WebSocket upgrade, multiplayer sync/leave and Mailpit/auth flow through containers.
- **Container:** `npm run smoke` 12/12; `podman compose` path unchanged; compose/Dockerfiles/`server.ts`/manifests/lockfile diff vs `BASE` empty; migration 006 is applied by the existing startup runner; no new service/port/env/health signal.
- **Docs:** README and glossary updates verified; `docs/features/README.md` unchanged vs `BASE` and the proposed row is recorded in the T14 log for the orchestrator; no builder rewrite of the feature index.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | Server authority, codec validation, parameterized SQL, no new deps/assets/secrets; reviewed paths pass. |
| Quality | ✅ | AC-40 production trigger is guarded and integration-tested; T15 layout fix verified; no open functional gap. F4 is docs metadata only. |
| Testing | ✅ | Full suite green; coverage >=80 on all four metrics in both workspaces; config/exclusions unchanged; F3 weak assertion fixed; no new banned matcher/snapshot-only/assertion-free test found in the changed set. |
| Real-time | ✅ | Multi-client, reconnect and opener-only reveal covered; containerized WebSocket smoke passes. |
| Containerization | ✅ | Single-command local path and smoke regression preserved; container assets untouched. |
| Documentation | ✅ (with F4) | AC-50 docs/index verified; F4 is a small stale task/log metadata cleanup, not a behavior-doc drift. |

## Notes / backlog (non-blocking)

1. **F4 (MINOR):** update `tasks.md` T16 status/note and the T14 `HEAD` transcript label to the final `ba77801`/`ba11d9a` record before acceptance. Docs-only.
2. **F5 (INFO):** AC-41 orb easing is a back-out cubic-bezier approximation of `easeOutBack(3.0)`; the pinned 1.25/250 ms envelope is met. No change unless exact curve fidelity is required.
3. **F6 (INFO):** AC-8/47 browser traces and AC-30 mobile manual checks rely on the recorded T14 evidence; re-run the T14 harness if the render loop or panel layout changes.
4. **Acceptance:** apply the proposed `docs/features/README.md` row from the T14 log when the orchestrator moves the feature to `accepted`; do not edit the index from the builder workspace.
