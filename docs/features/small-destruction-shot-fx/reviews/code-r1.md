---
feature: small-destruction-shot-fx
phase: code
iteration: 1
verdict: changes_requested
blocking: 1
---

# Code Review — r1

## Summary

❌ **changes_requested — one open BLOCKER.** The build is complete and the repository gates are
green: lint, typecheck, tests (backend 868 + frontend 1738), coverage (both workspaces
≥ 80 × 4), build (initial JS gzip **272.73 kB ≤ 279 kB**), the fork-point diff gate, the
README phrase checks and the feature-index guard all reproduce. The three pillars are wired and
the preserved behaviour is intact. One acceptance criterion fails: **AC-9's pinned core size**.
`impact-flash` is built from `OctahedronGeometry(1, 0)` and scaled by
`IMPACT_FLASH_PEAK_SCALE = 0.55`, which produces an octahedron **1.1 world units in diameter**
(radius 0.55), not 0.55 world units. The measured evidence is **90 × 90 px at 1280×720** and
**136 × 136 px at 1920×1080**, exactly double the spec's **≈ 45 px at 1280×720**; the
`build-log-T3.md` claim “core ≈ 45 px at 1280×720” is false. The required fix is a one-line
geometry/scale correction plus updated tests and re-captured evidence, followed by a round-2
review.

Two MINOR process/evidence findings accompany the blocker (a test edited outside T3
`files_owned`, and the inaccurate core-size measurement in the build log).

## Reproduced verification (this review)

Environment: Node **v24.22.0**, npm **11.19.1**; `BASE_SHA = 92fcf84999cde086dbc2d6acc89629f73a2fe6d6`
(recorded in `build-log-T1.md`); HEAD **657f4ae** (`cae667b` T1 → `9d46ffc` T2 → `09c5f25` T3 →
`657f4ae` docs).

| Command / check | Result | Evidence |
| --- | --- | --- |
| `npm run lint` | exit 0 | `eslint .` produced no output |
| `npm run typecheck` | exit 0 | both workspaces `tsc --noEmit` |
| `npm test` | exit 0 | backend **24 files / 868 tests**, frontend **64 files / 1738 tests** |
| `npm run coverage` | exit 0, thresholds ≥ 80 × 4 | backend **95.43 / 87.71 / 99.7 / 95.43**; frontend **96.43 / 95.44 / 97.47 / 96.43** (statements / branches / functions / lines) |
| `npm run build` | exit 0 | JS **982.58 kB raw / 272.73 kB gzip**; CSS 25.61 kB / 5.24 kB gzip; ≤ 279 kB bar |
| Fork-point diff gate (`src/backend`, protocol, manifests, lockfiles, compose, Dockerfiles) | exit 0 | `git diff --exit-code "$BASE_SHA"...HEAD -- …` |
| Import/URL/loader grep; asset diff; audio grep | clean (recorded, not re-run here) | build-log-T3 § Fork-point and scope gates |
| README required phrases | all present; `vanishes on the same frame` absent | `README.md:9`; eight greps |
| `docs/features/README.md` index guard | exit 0, no diff; proposal only in `build-log-T3.md:111` | `git diff --exit-code "$BASE_SHA"...HEAD -- docs/features/README.md` |
| Evidence files | **38** files under `evidence/`, including 7 windows × 2 sizes, reduced-motion frames, reticle and level-banner frames | directory listing |

Coverage exclusions and thresholds are unchanged from `BASE_SHA`; the only frontend exclusion is
`src/main.tsx` (composition root) and the only backend exclusion is `src/server.ts`, both
pre-existing. No production file was excluded and no threshold was lowered.

Limitation: the browser performance/idle/trace table in `build-log-T3.md` § Performance was not
independently re-run in this review. The `countObjects === 135`, pool-cap and triangle unit/
integration assertions are reproduced by the green suites, and the bundle number is reproduced
by the build; the recorded trace medians and recovery runs are accepted as recorded evidence for
this round. The `/tmp/opencode/t3/perf-*.log` files exist, but re-validating them is deferred to
round 2 (this review was instructed not to attempt further verification).

## AC verification

| AC | Status | Evidence |
| --- | --- | --- |
| AC-1 — Motion vocabulary | **met** | `motion.ts:87-101` adds exactly the 14 pinned keys/values and changes no accepted value; `motion.test.ts` pins the exact `MOTION` object and the three headline sums; `motion.ts` coverage 100 %. |
| AC-2 — Adaptive quality matrix | **met** | `quality.ts:92-118` exports the four pinned constants; `QualityFeatures` adds `explosionFlash/Embers/Smoke/shotFx`; `qualityFeatures` forces `0/0/0/false` under reduced motion; all policy constants and `createQualityPolicy` untouched; `quality.test.ts` exact matrices pass. |
| AC-3 — Little explosion module | **met (literal pins), with a size caveat** | `impact-effects.ts` has exactly three children in order (`impact-shards`, `impact-flash`, `impact-burst`), caps 6/72, `0xfff2dc` additive core with `instanceColor`, amber/white embers and warm-grey smoke, 380/480 ms lifetimes, pinned ember drag/gravity and constant smoke bias, oldest-first recycling, no gold names/geometry, idempotent dispose, no post-construction drawable/geometry/material; `impact-effects.test.ts` passes. The geometry+scale combination does not reproduce the spec's visible size — see BLOCKER below. |
| AC-4 — Mini-cube destroy | **met** | `effects.ts:165-210` sets `MINI_CUBE_POP_MS = 140` and implements the exact scale/brightness curves; `cube-view.ts:342-394` validates first, hides/unpickable immediately, is idempotent, uses the instant zero-scale path, writes matrix + `instanceColor` each frame, zero-scales/restores at 140 ms, and clears via `settlePops`/`removeFace`/`dispose`; `effects.test.ts` and `cube-view.test.ts` pass. |
| AC-5 — Remote cube parity | **met** | `world.ts` applies `miniCubeRemoved` through the animating `hideMiniCube(id)` path and roster `removedIds` through `hideMiniCube(id, true)`; duplicate ids are no-ops; face countdown/detachment and burst are unchanged; `world.test.ts` and `scene.test.ts` remote timeline pass. |
| AC-6 — Realistic shot | **met** | `SHOT_TRAVEL_MS === 180`; `Shot.start` stays the ship anchor, `Shot.muzzle = start + rotate(quaternion, (0,0,0.78))`; bolt is a shared `ConeGeometry(0.07, 0.55, 6)` named `shot-bolt` with the pinned material; muzzle flash is a shared `OctahedronGeometry(0.22,0)` named `shot-muzzle-flash`, 80 ms, `1 → 1.4`, opacity `0.9 → 0`; `shotRecoilOffsetAt` pins `0 → −0.12`, `60 → −0.015`, `120 → 0` on `model.group.position.z` only; `setShotFxEnabled(false)` suppresses flash/recoil and keeps the bolt; `spaceship.test.ts` and `scene-spaceship.test.ts` pass. |
| AC-7 — Scene integration | **met** | `scene.ts:929-952` forwards all four impact fields and `shotFx`; `cube.update` now runs before the pending-explosion loop so the arrival frame writes the hide frame and the next frames advance the 140 ms timeline; `scene-effects.test.ts` pins high `14/24/1/12`, medium `7/12/1/6`, low/reduced `0/0/0/0`, the 0/+70/+140 destroy timeline, `muzzle.z === 6.78`, flash 1 → 0 by 80 ms, recoil negative → 0 by 120 ms, arrival at 180 ms, three impact children, no gold names and camera equality; HUD no-shake remains owned by the unchanged `Hud`/`App`/`game-view.css` suites. |
| AC-8 — Object, draw, triangle and frame budget | **met on recorded evidence; trace re-run deferred** | `scene.test.ts` passes `countObjects === 135` (65 + 70), 9 scene children (10 with a remote world); cap assertions pass (42/6/72/72); `npm run build` reproduces 272.73 kB gzip; `build-log-T3.md` records click medians high 217.21/217.64 ≤ 221.0/220.0, medium 206.33/205.30 ≤ 207.0/207.0, low 199.17/197.08 ≤ 205.0/202.0, p95 16.7–21 ms, high averages 16.666 ms and both recovery runs reaching high. The browser traces were not independently re-run (limitation). |
| AC-9 — Visual evidence and manual check | **UNMET** | All seven timing windows, reduced-motion frames, coin/reticle/banner/no-shake evidence and the no-gold click frames are present at both sizes, but the core-size requirement fails: measured core **90 × 90 px at 1280×720** and **136 × 136 px at 1920×1080** versus the spec's **≈ 45 px at 1280×720**. See BLOCKER B1. |
| AC-10 — Documentation | **met** | `README.md:9` contains `green shard debris`, `spark particles`, `no click ray fan`, `granular spaceship parts`, `detailed blue/orange hero spaceship`, `small white-orange impact burst`, `collapses over 140 ms` and `glowing tracer bolt with a muzzle flash`; `vanishes on the same frame` is absent; `docs/features/README.md` is untouched (guard exit 0) and the proposed row is recorded in `build-log-T3.md:111`; no `docs/architecture/**` or glossary change is needed. |
| AC-11 — No dependency/backend/protocol/container/audio change | **met** | Fork-point diff gate exits 0; no `src/backend`, protocol, manifest, lockfile, compose or Dockerfile change; no new dependency/loader/asset/audio/URL; evidence PNGs are documentation artifacts. |
| AC-12 — Coverage and full gate | **met** | `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (both workspaces ≥ 80 × 4) and `npm run build` all exit 0; every edited/new frontend module is included and no exclusion or threshold changed. |

## Findings

### B1 — BLOCKER — Impact core renders at ~2× the pinned visual size

- **Location:** `src/frontend/src/render/impact-effects.ts:196` (`new OctahedronGeometry(1, 0)`),
  `:353-356` (scale `IMPACT_FLASH_START_SCALE + … * easeOutCubic`), `:62-66`
  (`IMPACT_FLASH_PEAK_SCALE = 0.55`); `spec.md` AC-9 (lines 265-277) and AC-3's
  “bounded to roughly the observed pop core's size” wording (lines 44-50);
  `build-log-T3.md:155,162,171-177`.
- **What is wrong:** `OctahedronGeometry(1, 0)` has a **radius** of 1, so scaling it by 0.55
  produces a **1.1 world-unit diameter** (radius 0.55). At the front-face distance the spec's
  0.55 world units are ≈ 45 px at 1280×720; the rendered core is ≈ 90 px across (measured
  **90 × 90 px** in `t3-click-core-0252ms-1280x720.png` and **136 × 136 px** in
  `t3-click-core-0275ms-1920x1080.png`, consistent with 1.1 world units at the two viewport
  heights). The reference pop core is 20–45 px; the implemented core is 2× the upper bound and
  reaches the lower bound of the removed 90–160 px rays. `build-log-T3.md` states
  “core ≈ 45 px at 1280×720”, which is false.
- **Why it matters:** AC-9 is the user-facing visual acceptance for the little explosion and is
  **unmet**; the feature's central promise — a small, local core rather than the removed
  massive gold explosion — is visually diluted. The evidence claim is also inaccurate, so the
  build log cannot be trusted as proof for this window.
- **Required action:** make the rendered core ≈ 0.55 world units in diameter: either build the
  pool from `OctahedronGeometry(0.5, 0)` and keep `IMPACT_FLASH_PEAK_SCALE = 0.55`, or keep
  `OctahedronGeometry(1, 0)` and set the peak scale to ≈ 0.275; update the pinned constant and
  `impact-effects.test.ts` (including the growth read-back), re-capture the core and impact
  frames at both sizes, correct the measured-pixel claim in `build-log-T3.md`, and re-run the
  full gate. Re-review in round 2. (The same geometry/scale inconsistency should be corrected
  in the spec's AC-3/AC-9 wording so the pin and the visual check cannot diverge again.)

### M1 — MINOR — `session.test.ts` edited outside T3 `files_owned`

- **Location:** `src/frontend/src/game/session.test.ts:1097-1126`;
  `tasks.md` T3 `files_owned` (lines 119-122); `build-log-T3.md:15-16,37-41,308-311`.
- **What is wrong:** T3's declared ownership lists `scene.ts`, `scene-effects.test.ts`,
  `README.md`, the T3 build log and evidence; `session.test.ts` is outside that inventory. The
  builder changed it to match the update-order fix and disclosed the deviation, but did not ask
  first (`AGENTS.md` / tasks: “Ask first: editing files outside the task inventory”).
- **Why it matters:** ownership is the mechanism that prevents silent test churn; the change is
  correct and stronger (it now pins the arrival-frame extent + brightness 3, the +70 ms
  mid-collapse and the +140 ms zero/colour-1 end instead of the old same-frame zero), so this
  is a process finding, not a behavioural defect. The test change is justified by
  `scene.ts` moving `cube.update` before the pending-explosion loop.
- **Required action:** the planner/orchestrator should add `session.test.ts` to T3's ownership
  (or create a small explicit T4/test-ownership task) and record the disposition. No code change
  is required.

### M2 — MINOR — Build-log core-size measurement is inaccurate

- **Location:** `build-log-T3.md:155` (“core ≈ 45 px at 1280×720”) and the AC-9 audit row
  `build-log-T3.md:294` (“all seven windows … met”).
- **What is wrong / why it matters:** the recorded pixel measurement contradicts the captured
  frame and the implementation’s world-space size (see B1). A build log is a claim; a visually
  falsifiable claim undermines the evidence trail for AC-8/AC-9 and made the AC-9 miss easy to
  overlook.
- **Required action:** after the B1 fix, re-measure the core at both sizes, record the new
  measured pixel extents with the same method, and correct the AC-9 audit row; do not restate
  the 45 px figure without a measurement that supports it.

## Visual / performance / documentation audit

- **Visual:** 38 evidence files are present (7 windows × 2 sizes, reduced-motion 120/360–365 ms,
  reticles, level banner/fly-by, preserved-after frames). The muzzle, bolt, impact, core,
  tile-gone, smoke and smoke-gone windows are represented at both sizes with measured
  timestamps; the click frames show no gold ray fan, coin glyph or ring; green shards and gold
  sparks remain; coin `+0.10`, reticle, cursor, banner/fly-by and no-shake styles are visible in
  the preserved frames. The only visual acceptance failure is B1 (core size); the muzzle flash
  is a hard-edged octahedron but matches the pinned `OctahedronGeometry(0.22, 0)` design and is
  not a finding.
- **Performance:** `countObjects === 135` (65 + 70) and the pool caps are reproduced by the
  green unit/integration suites; the bundle is 272.73 kB gzip ≤ 279 kB. The recorded 3-run
  click medians are within the AC-8 bars at both sizes and all tiers; p95 is 16.7–21 ms and the
  forced-low→high recovery is recorded for both sizes. The browser trace table itself was not
  independently re-run in this review (limitation); it should be re-validated in round 2
  together with the B1 evidence.
- **Documentation:** README wording matches AC-10 exactly; the feature-index guard is empty;
  no predecessor artifact or `docs/architecture/**`/glossary file was changed; the proposed
  index row is recorded in the build log for the orchestrator.
- **Tests:** changed suites use concrete expected values; no snapshots, wildcard matchers,
  assertion-free tests or tautologies were found; the `session.test.ts` change adds assertions
  rather than removing them; no coverage exclusion or threshold was changed.
- **Real-time/multi-client:** server remains the authority for removals; live
  `miniCubeRemoved` animates on every client; roster hydration/reconnection uses the instant
  path; no protocol, lifecycle, backend or container change.
- **Containerization:** unchanged; no service, image, port, env var, health signal, compose
  entry, Dockerfile or WebSocket endpoint change; `npm run smoke` correctly not required.

## Previous-round findings

`spec.md` r3 § Review r1 disposition: all F1–F11 fixed; no rebuttals. The spec-r2 review approved
with 0 blocking and left N1–N3 as non-blocking precision notes. None of the accepted Q-1/Q-2/Q-3
defaults or the removal of the massive gold explosion is reopened here.

## Backlog / next steps

1. **B1** — fix the core geometry/scale to ≈ 0.55 world-unit diameter, update
   `impact-effects.test.ts`, re-capture the core evidence at 1280×720 and 1920×1080, correct the
   build log, re-run the full gate.
2. **M1** — record `session.test.ts` in T3's ownership (or a follow-up task) so the deviation is
   closed administratively.
3. **M2** — replace the false 45 px claim with a measured value after the fix.
4. **Round 2** — independently validate the `/tmp/opencode/t3/perf-*.log` traces against the
   AC-8 bars and re-inspect the corrected core frames; then re-evaluate AC-9.
5. **Spec consistency (INFO, for the planner)** — AC-3 pins `OctahedronGeometry(1, 0)` plus scale
   0.55 while AC-9 expects ≈ 45 px; one of the two must change so future builds cannot repeat
   the same ambiguity.

## Verdict

**changes_requested — 1 blocking finding (B1).** The implementation, tests, docs and most of the
visual/perf evidence are otherwise in good shape; B1 is a bounded visual fix plus evidence
correction, not a redesign.
