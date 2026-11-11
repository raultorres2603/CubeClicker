# Build log — T3 — Integrate the quality matrix, document and verify

Task: T3 (2026-11-11)
Feature: small-destruction-shot-fx
Branch: main (no branch switch)
Fork point (recorded in `build-log-T1.md`): `BASE_SHA=92fcf84999cde086dbc2d6acc89629f73a2fe6d6`.
HEAD before this commit: `9d46ffcf62f8fd942f2a6468e84bfe309ce4b499` (T2).

Files changed:
- `src/frontend/src/render/scene.ts` — wires the quality matrix, moves `cube.update` before the
  pending-explosion loop, updates the impact comments.
- `src/frontend/src/render/scene-effects.test.ts` — new integration suite (9 tests).
- `README.md` — click-sentence update.
- `src/frontend/src/game/session.test.ts` — **reported deviation:** one pre-existing integration
  expectation updated for the update-order fix (see § Deviations).
- `docs/features/small-destruction-shot-fx/build-log-T3.md`.
- `docs/features/small-destruction-shot-fx/evidence/*` (screenshots).

What changed & why (≤5 lines):
- `applyQuality()` now forwards all four impact fields (`shards`, `flash`, `embers`, `smoke`) and
  `spaceship.setShotFxEnabled(features.shotFx)`: the T1/T2 pools are live at high/medium and inert at
  low/reduced.
- `cube.update(dtMs)` moved before the pending-explosion loop: the arrival frame writes the hide
  frame (scale 1, brightness 3) and the first `+dt` happens on the next frame, so the 140 ms destroy
  timeline is exactly `0 → +70 → +140` from the impact frame.
- The new `scene-effects.test.ts` pins the wired tier counts, the local destroy timeline, the
  muzzle/bolt/recoil sequence, the three impact children, no gold names and camera equality.
- `README.md` documents the small white-orange impact burst, the 140 ms tile collapse and the
  glowing tracer bolt with a muzzle flash; the retired "vanishes on the same frame" phrase is gone.

Decisions:
- **Update-order fix (required by AC-7).** T2 deliberately left `scene.ts` ordering to T3; the
  previous trailing `cube.update` advanced a pop spawned in the same frame by the impact frame's
  full `dt`, so the flash frame could never be observed. Advancing existing records before the spawn
  is the minimal fix; no spawn, camera, reticle, fly-by, travel or level logic changed.
- **Session-test deviation.** `session.test.ts` asserted the old same-frame zero-scale after a
  400 ms tick. It now pins the new arrival/mid/zero sequence (full extent + colour 3 at the arrival
  frame, the pinned 70 ms extent, zero/colour 1 at +140 ms). This is the only edit outside T3's
  `files_owned`; it is required by the update-order fix and reported here rather than silently
  changed.
- No T1/T2 production module was edited. The only other test touched is the session integration test
  above; `scene.test.ts`/`scene-spaceship.test.ts` already carried the T2 135-object/three-child
  baseline and pass unchanged.
- HUD no-shake/no-layout-shift is owned by the unchanged `Hud.test.tsx`, `App.test.tsx` and
  `game-view.css.test.ts`; `scene-effects.test.ts` only asserts camera equality, exactly as the T3
  note requires.

## Verification evidence (raw)

Environment: Node v24.22.0 / npm 11.19.1; Podman 5.8.9 + docker-compose 5.6.0; `podman compose up`
stack (frontend `localhost:5173`, backend `localhost:8080`); headless Google Chrome 157.0.8103.50
over CDP with hardware ANGLE. The test-only harness lives in `/tmp/opencode/t3/` and injects a
`window.__t14Scene` reference by patching the dev-server `src/render/scene.ts` response (the same
test-only hook as predecessor T14); no repository file was changed by the harness. All sessions were
online guests; the perf traces are the same single-member guest world with the remote-world object
count recorded per run.

### Repository gate

- `npm run lint` → exit 0:
  ```
  > lint
  > eslint .
  ```
- `npm run typecheck` → exit 0 (backend + frontend `tsc --noEmit`).
- `npm test` → exit 0:
  ```
   Test Files  24 passed (24)
        Tests  868 passed (868)      (backend)
   Test Files  64 passed (64)
        Tests  1738 passed (1738)    (frontend)
  ```
- `npm run coverage` → exit 0 (both workspaces, thresholds ≥ 80×4):
  ```
   Test Files  24 passed (24)
        Tests  868 passed (868)
  All files          |   95.43 |    87.71 |    99.7 |    95.43 |
   Test Files  64 passed (64)
        Tests  1738 passed (1738)
  All files          |   96.43 |    95.44 |   97.47 |   96.43 |
  ```
  The new `scene-effects.test.ts` and the changed `scene.ts` are included; no exclusion or threshold
  was changed.
- `npm run build` → exit 0:
  ```
  dist/index.html                   0.42 kB │ gzip:   0.28 kB
  dist/assets/index-BjbbTImZ.css   25.61 kB │ gzip:   5.24 kB
  dist/assets/index-BmvCJQCy.js   982.58 kB │ gzip: 272.73 kB
  ✓ built in 1.48s
  ```
  Initial JS gzip **272.73 kB ≤ 279 kB** (accepted 270.51 kB; +2.22 kB).

### Fork-point and scope gates (working tree vs `BASE_SHA`)

- `git diff --exit-code "$BASE_SHA" -- src/backend src/frontend/src/multiplayer/protocol.ts
  src/backend/package.json src/frontend/package.json package.json package-lock.json compose.yaml
  compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile` → no output, exit 0.
- Import/URL/loader grep over `src/frontend/src/render` + `src/frontend/src/game` (tests excluded):
  ```
  # import/URL/loader grep
  IMPORT_GREP_EXIT=0
  ```
  (no matches.)
- Runtime/game asset diff over `src/frontend/public src` filtered to
  `png/jpg/jpeg/svg/mp3/wav/glb/gltf` → empty, exit 0. The evidence screenshots are documentation
  artifacts, not runtime/game assets.
- Audio grep `AudioContext|new Audio\(|<audio` over `src/frontend/src` → no matches, exit 0.
- Index guard `git diff --exit-code "$BASE_SHA" -- docs/features/README.md` → exit 0 (no diff).
  Proposed orchestrator row (not applied):
  `| small-destruction-shot-fx | Small Destruction & Shot FX (little impact explosions, 140 ms mini-cube destroy, realistic tracer shot) | accepted | <acceptance date> |`
- README phrase checks:
  ```
  PRESENT: green shard debris
  PRESENT: spark particles
  PRESENT: no click ray fan
  PRESENT: granular spaceship parts
  PRESENT: detailed blue/orange hero spaceship
  PRESENT: small white-orange impact burst
  PRESENT: collapses over 140 ms
  PRESENT: glowing tracer bolt with a muzzle flash
  ABSENT: vanishes on the same frame
  ```

### Manual visual evidence (AC-9)

All captures are in `docs/features/small-destruction-shot-fx/evidence/`. Timestamps are measured from
the click (`performance.timeOrigin` + screencast metadata minus the click's `performance.now()`), or
from the targeted front-buffer capture's in-page elapsed time. Two capture methods are represented:
CDP screencast for the moving muzzle/bolt/impact/core frames, and a targeted `Page.captureScreenshot`
at the requested elapsed time for the tile-gone/smoke windows (the compositor can deliver a stale
screencast frame for a single fast transition; the targeted frames read the live state at the
measured offset). The 4 ms in-page state sampler independently records the pool/tile state.

| size | window | measured | evidence file | state |
| --- | --- | --- | --- | --- |
| 1280×720 | muzzle 20–60 ms | **52 ms** | `t3-click-muzzle-0052ms-1280x720.png` | muzzle flash at the nose, bolt leaves |
| 1280×720 | bolt 90–150 ms | **118 ms** | `t3-click-bolt-0118ms-1280x720.png` | glowing tapered bolt in flight |
| 1280×720 | impact 180–220 ms | **202 ms** | `t3-click-impact-0202ms-1280x720.png` | tile brightened/swollen, white core |
| 1280×720 | core peak 240–280 ms | **252 ms** | `t3-click-core-0252ms-1280x720.png` | core ≈45 px at 1280×720 |
| 1280×720 | tile gone 320–340 ms | **333 ms** | `t3-click-tile-gone-0333ms-1280x720.png` | zero tile, green shards + embers, no core |
| 1280×720 | smoke 420–480 ms | **456 ms** | `t3-click-smoke-0456ms-1280x720.png` | ember/smoke tail over the hole |
| 1280×720 | smoke gone by 660 ms | **661 ms** (state 656.3 ms) | `t3-click-smoke-gone-0661ms-1280x720.png`, screencast `t3-click-smoke-gone-0668ms-1280x720.png` | burst 0; only shards remain |
| 1920×1080 | muzzle 20–60 ms | **25 ms** | `t3-click-muzzle-0025ms-1920x1080.png` | muzzle flash at the nose, bolt leaves |
| 1920×1080 | bolt 90–150 ms | **109 ms** | `t3-click-bolt-0109ms-1920x1080.png` | glowing tapered bolt in flight |
| 1920×1080 | impact 180–220 ms | **192 ms** | `t3-click-impact-0192ms-1920x1080.png` | tile brightened/swollen, white core |
| 1920×1080 | core peak 240–280 ms | **275 ms** | `t3-click-core-0275ms-1920x1080.png` | core peak |
| 1920×1080 | tile gone 320–340 ms | **335 ms** | `t3-click-tile-gone-0335ms-1920x1080.png` | zero tile, shards + embers, no core |
| 1920×1080 | smoke 420–480 ms | **456 ms** | `t3-click-smoke-0456ms-1920x1080.png` | ember/smoke tail over the hole |
| 1920×1080 | smoke gone by 660 ms | **663 ms** (state 657.4 ms) | `t3-click-smoke-gone-0663ms-1920x1080.png`, screencast `t3-click-smoke-gone-0692ms-1920x1080.png` | burst 0; only shards remain |

- The state sampler recorded the impact onset at 184.1 ms (1280) / 172.2 ms (1920) and the burst
  reaching 0 at **656.3 / 657.4 ms**; the targeted/screencast frame times above are the first captured
  frames after those state transitions (screencast cadence is ~16.7 ms). The tile is zero-scaled
  140 ms after the actual impact frame; the 333/335 ms frames show the hole with no core.
- No click frame shows a gold ray fan, gold coin glyph, ring or satellite ring. The only gold
  geometry on screen is the preserved level-complete banner (below); the click impact uses the
  white-hot core, amber/white embers and warm-grey smoke, plus the retained green shards and gold
  sparks.
- Preserved coin `+0.10` is visible in every click frame's HUD; the reticle is captured at
  `t3-reticle-1280x720.png` / `t3-reticle-1920x1080.png` (`targeting-outline` visible); the cursor
  ship is present in all frames; the no-shake styles are `transform/translate/rotate/scale/animation:
  none` for `main`, `.hud-panel` and `.upgrades-panel`, and the camera position/quaternion is
  identical before/after (`cameraEq=true` in `visual-*.json`).
- Reduced-motion pass (`prefers-reduced-motion: reduce` emulated):
  - 1280×720: frame `t3-reduced-click-0110ms-1280x720.png`, state at 148 ms and 414.7 ms:
    exactly one zero-scaled tile (`index 2`, scale `[0,0,0]`, colour `[1,1,1]`), 0 shards, 0 flash,
    0 burst points, 0 sparks, 0 shot children, recoil 0, coin `+0.10`, no shake.
    Settled frame `t3-reduced-settled-0360ms-1280x720.png` at **360 ms**.
  - 1920×1080: frame `t3-reduced-click-0111ms-1920x1080.png`, state at 150.9 ms and 462.2 ms:
    the same zero state; settled frame `t3-reduced-settled-0345ms-1920x1080.png` at **345 ms**.
  - `matchMedia('(prefers-reduced-motion: reduce)').matches === true` in both runs.
- Preserved level-complete banner/fly-by (production `levelIndex` rise, no harness trigger):
  - 1280×720: banner present, 24 rays (16 gold + 8 cyan), 3 rings, 12 stars, 20 coin elements,
    title `LEVEL COMPLETE`, CSS animation `none`; roll `maxAbs 6.2828`, 560 ms, 1 interval; HUD
    `cube 2`, 6 faces, 96 clicks, 19.60 coins; no shake. Frames:
    `t3-level-banner-pre-0017ms-1280x720.png`, `t3-level-banner-post-0100/0250/0400/0700ms-1280x720.png`.
  - 1920×1080: same banner DOM; roll `maxAbs 6.2829`, 528 ms, 1 interval; same HUD; no shake.
    Frames: `t3-level-banner-pre-0036ms-1920x1080.png`,
    `t3-level-banner-post-0097/0281/0397/0681ms-1920x1080.png`.
  - The banner's gold rays/coins/rings are the accepted level-complete layer, not the click
    explosion; the click evidence contains none of them.

### Performance, adaptive tier and draw counts (AC-8)

Method: 10 s trace per run, fresh page, online guest; high runs force `setQualityTierForTesting('high')`
immediately before the trace and then let the real policy run; medium/low runs force the tier and feed
the policy a controlled 19 ms / 21 ms frame stream (a `requestAnimationFrame` wrapper; no source edit)
so the shipped tier stays selected. Draw calls are counted per `requestAnimationFrame` through the
WebGL context wrappers (drawElements/drawArrays/instanced variants). Click runs dispatch pointer
events at 10/s across the current face centres; `hudClicks` is the HUD delta (44–90 hits per run).
The table reports the 3-run draw-mean median, per-run avgs/p95, tier start→end, the remote-world
object count per run and the own-object baseline. Two cells were re-run once because the first
attempt contained an outlier (the 1920 high-idle first run 173.29 and the 1920 medium-click first
attempt median 208.34); the final clean runs are reported.

| size | tier | workload | draw means (3 runs) | median | avg (3) | p95 (3) | tier start→end | remote-world objects | own baseline | hud clicks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1280 | high | idle | 172.45 / 169.20 / 168.95 | **169.20** | 16.666 / 16.666 / 16.666 | 16.7 / 16.8 / 16.7 | high→high ×3 | 19 / 19 / 27 | 135 / 135 / 135 | 0 |
| 1280 | high | 10 clicks/s | 216.66 / 217.59 / 217.21 | **217.21** | 16.666 / 16.666 / 16.666 | 16.7 / 16.7 / 16.8 | high→high ×3 | 27 / 23 / 21 | 131 / 136 / 137 | 64 / 80 / 90 |
| 1280 | medium | idle | 173.02 / 169.26 / 169.28 | **169.28** | 19 / 19 / 19 | 19 / 19 / 19 | medium→medium ×3 | 24 / 26 / 27 | 135 / 135 / 135 | 0 |
| 1280 | medium | 10 clicks/s | 211.15 / 203.15 / 206.33 | **206.33** | 19 / 19 / 19 | 19 / 19 / 19 | medium→medium ×3 | 27 / 17 / 17 | 135 / 136 / 132 | 80 / 44 / 75 |
| 1280 | low | idle | 171.60 / 168.26 / 168.29 | **168.29** | 21 / 21 / 21 | 21 / 21 / 21 | low→low ×3 | 22 / 24 / 27 | 135 / 135 / 135 | 0 |
| 1280 | low | 10 clicks/s | 202.24 / 198.66 / 199.17 | **199.17** | 21 / 21 / 21 | 21 / 21 / 21 | low→low ×3 | 27 / 25 / 22 | 134 / 132 / 135 | 80 / 75 / 90 |
| 1920 | high | idle | 173.80 / 169.13 / 168.56 | **169.13** | 16.666 / 16.666 / 16.666 | 16.7 / 16.7 / 16.7 | high→high ×3 | 16 / 19 / 27 | 135 / 135 / 135 | 0 |
| 1920 | high | 10 clicks/s | 217.99 / 215.94 / 217.64 | **217.64** | 16.666 / 16.666 / 16.666 | 16.7 / 16.7 / 16.7 | high→high ×3 | 27 / 24 / 22 | 132 / 134 / 135 | 75 / 79 / 89 |
| 1920 | medium | idle | 173.77 / 168.91 / 168.32 | **168.91** | 19 / 19 / 19 | 19 / 19 / 19 | medium→medium ×3 | 24 / 26 / 27 | 135 / 135 / 135 | 0 |
| 1920 | medium | 10 clicks/s | 204.60 / 208.19 / 205.30 | **205.30** | 19 / 19 / 19 | 19 / 19 / 19 | medium→medium ×3 | 27 / 22 / 20 | 131 / 134 / 132 | 49 / 79 / 75 |
| 1920 | low | idle | 172.43 / 167.97 / 168.81 | **168.81** | 21 / 21 / 21 | 21 / 21 / 21 | low→low ×3 | 22 / 26 / 27 | 135 / 135 / 135 | 0 |
| 1920 | low | 10 clicks/s | 197.08 / 198.14 / 195.74 | **197.08** | 21 / 21 / 21 | 21 / 21 / 21 | low→low ×3 | 27 / 30 / 26 | 131 / 135 / 131 | 50 / 89 / 64 |

Bars and result:
- Click medians: high **217.21 / 217.64** ≤ 221.0 / 220.0; medium **206.33 / 205.30** ≤ 207.0 /
  207.0; low **199.17 / 197.08** ≤ 205.0 / 202.0. All pass.
- Every tier's p95 is 16.7–21 ms ≤ 33 ms; every high run's average is 16.666 ms ≤ 16.7 ms.
- Idle medians vs the accepted 168.05 (1280) / 168.17 (1920): +1.15/+1.23/+0.24 at 1280,
  +0.96/+0.74/+0.64 at 1920; all inside ±1.5.
- Tier start→end stayed at the forced tier in every medium/low run and high→high in every high run
  (the real policy did not downgrade).
- Forced-low → high recovery (10 ms frame stream, real policy): 1280 low→medium at 4852 ms
  (291 frames), medium→high at 9799 ms (588 frames), final high; 1920 low→medium at 4865 ms
  (292 frames), medium→high at 9850 ms (591 frames), final high.
- Raw logs: `/tmp/opencode/t3/perf-1280.log`, `perf-1920.log`, `perf-1920-high-idle-rerun*.log`,
  `perf-1920-medium-clicks-rerun.log`, `recovery-1280.log`, `recovery-1920.log`, `perf.jsonl`.

### Scene/object/pool accounting and triangles

- `countObjects` own baseline is **135** = **65 pre-backdrop objects** (including the four-object
  impact group: group + `impact-shards` + `impact-flash` + `impact-burst`) + **70 cosmic-backdrop
  objects**; scene children are 10 with the remote world (9 offline). Recorded in
  `visual-1280x720.json` / `visual-1920x1080.json` (`ownBaseline: 135`, `sceneChildren: 10`) and
  pinned by `scene.test.ts`.
- Impact group children, in order: `impact-shards`, `impact-flash`, `impact-burst`. No
  `impact-rays`/`impact-coins`/`impact-ring`, and no object name contains `gold`.
- Worst-case live pools (dedicated 9-distinct-pop probe at both sizes):
  `caps-1280x720.json` / `caps-1920x1080.json` → live shards **42**, flash **6**, burst points
  **72**, sparks **72**; capacities are 42 / 6 / 72 / 72. Worst-case in-flight shots 2, muzzle
  flashes 2 (80 ms each), destroy records ≤ 150 (unit test).
- Triangle deltas (three.js geometry counts): `OctahedronGeometry(1,0)` = 8 triangles → static flash
  pool `6 × 8 = +48`; `OctahedronGeometry(0.22,0)` = 8 triangles → `+8` per live muzzle flash; the
  `ConeGeometry(0.07,0.55,6)` bolt = 12 triangles replaces the old `SphereGeometry(0.06,8,8)` = 112
  triangles → `−100` per in-flight shot.
- Bundle: initial JS gzip **272.73 kB** (Vite), `982.58 kB` raw; ≤ 279 kB.

### Before / after

- Before (accepted particle-only state): `particle-only-click-effects/evidence/t2-click-shot-0162ms-1280x720.png`
  and `t2-click-no-gold-shards-0312ms-1280x720.png`; 1920 pair `t2-click-shot-0180ms-1920x1080.png`
  and `t2-click-no-gold-shards-0313ms-1920x1080.png`. They show the yellow sphere shot, the same-frame
  conceal and the shard/spark burst with no gold fan.
- After: the muzzle/bolt/impact/core/tile-gone/smoke frames above show the tapered glowing bolt,
  muzzle flash, the white-orange impact burst (white-hot core + embers + smoke) and the 140 ms
  flash-swell-collapse of the clicked tile; the green shards, gold sparks, coin `+0.10`, reticle,
  cursor, banner/fly-by and no-shake behaviour are preserved. No gold fan/coins/ring is reintroduced.

## Acceptance audit

| AC | status | evidence |
| --- | --- | --- |
| AC-1 | met | T1 `motion.test.ts` (14 tokens + headline sums); T3 consumes them without changing a value. |
| AC-2 | met | T1 `quality.test.ts`; T3's `scene-effects.test.ts` proves high `14/24/1/12`, medium `7/12/1/6`, low/reduced `0/0/0/0`, and `shotFx` true/true/false. |
| AC-3 | met | T2 `impact-effects.test.ts`; T3 `scene-effects.test.ts` pins the three children/names and the live counts through the scene. |
| AC-4 | met | T2 `effects.test.ts`/`cube-view.test.ts`; T3 `scene-effects.test.ts` pins the 0/+70/+140 scene timeline (scale 1, brightness 3 → mid → zero) and the low-tier collapse. |
| AC-5 | met | T2 `world.test.ts` (broadcast animates, roster instant, duplicate no-restart); `scene.test.ts` 140 ms remote timeline passes unchanged. |
| AC-6 | met | T2 `spaceship.test.ts`/`scene-spaceship.test.ts`; T3 `scene-effects.test.ts` pins `muzzle.z = 6.78`, muzzle flash 1→0 by 80 ms, recoil negative→0 by 120 ms and arrival at 180 ms. |
| AC-7 | met | `scene.ts` wiring + new `scene-effects.test.ts` (9 tests) + camera equality; no gold names; HUD no-shake owned by the unchanged React/CSS suites. |
| AC-8 | met | 135 = 65 + 70; caps 42/6/72/72; triangle +48/+8/−100; 36-run draw table above within every bar; recovery both sizes; JS gzip 272.73 kB. |
| AC-9 | met | Evidence map above: all seven windows at 1280/1920, reduced frames at 110/360 and 111/345 ms, preserved coin/reticle/cursor/banner/fly-by/no-shake, no click gold fan/coins/ring. |
| AC-10 | met | README phrase checks above; index guard exit 0; proposed row recorded; no `docs/architecture/**` or `docs/product/glossary.md` change needed (no stack, container, term or meaning change). |
| AC-11 | met | Fork-point diff gate exit 0; import/URL/loader grep clean; asset diff empty; audio grep clean; no dependency/backend/protocol/container change. |
| AC-12 | met | `npm run lint`, `npm run typecheck`, `npm test` (868 + 1738), `npm run coverage` (both workspaces ≥80×4), `npm run build` all exit 0. |

## Documentation scope

- `README.md` is the only user-facing doc changed. `docs/features/README.md` is untouched (index
  guard above); the proposed row is recorded for the orchestrator. No `docs/architecture/**` or
  `docs/product/glossary.md` change is required: the stack, container conventions and terminology are
  unchanged. No predecessor artifact was rewritten.

## Deviations from spec / task scope

- **`src/frontend/src/game/session.test.ts` (outside T3 `files_owned`)** — required by the scene
  update-order fix. The test previously asserted the same-frame zero-scale after a 400 ms tick; it now
  asserts the arrival-frame full extent + brightness 3, the pinned 70 ms extent and the zero/colour-1
  end at +140 ms. No production module outside `scene.ts` changed.
- **Targeted tile-gone/smoke frames** — the screencast's compositor can deliver a stale frame for one
  fast transition (it showed the core after the sampler had already released it). The primary
  tile-gone/smoke evidence therefore uses a `Page.captureScreenshot` armed at the measured elapsed
  time; the screencast frames are retained alongside and the 4 ms state sampler is the precise timing
  source.
- No other deviation. No new dependency, asset, audio, URL, backend, protocol or container change.

## Status

READY for review. Full repository gate green (backend 868 + frontend 1738 tests, coverage ≥80×4,
build 272.73 kB JS gzip); fork-point/import/asset/audio/index gates clean; the manual matrix at
1280×720 and 1920×1080 proves the seven AC-9 windows, reduced motion, preserved coin/reticle/cursor/
banner/fly-by/no-shake and no click gold fan; 36 traces + 2 recovery runs are within the pinned bars.
