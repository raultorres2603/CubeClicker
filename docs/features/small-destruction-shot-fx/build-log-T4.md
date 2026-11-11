# Build log — T4 — Fix impact core size (review B1)

Task: T4 (2026-11-11)
Feature: small-destruction-shot-fx
Branch: main (no branch switch)
Base: T3 docs commit `657f4ae` on top of `09c5f25` (`feat: wire the destruction and shot effects`).
Files changed:
- `src/frontend/src/render/impact-effects.ts` — flash geometry radius 1 → 0.5.
- `src/frontend/src/render/impact-effects.test.ts` — pins the 0.5 radius, the 0.55 peak scale and
  the 0.55 world-unit-diameter invariant.
- `docs/features/small-destruction-shot-fx/build-log-T3.md` — corrected the false core-size claim
  (before/after markup).
- `docs/features/small-destruction-shot-fx/evidence/t4-core-*.png` — 4 re-captured frames
  (impact + peak at 1280×720 and 1920×1080).
- `docs/features/small-destruction-shot-fx/build-log-T4.md` (this file).

What changed & why (≤5 lines):
- Review B1: `OctahedronGeometry(1, 0)` takes a **radius**, so the 0.55 peak scale rendered a
  1.1 world-unit-diameter core (90 px at 1280, 136 px at 1920) instead of the spec's 0.55 world-unit /
  ≈45 px core.
- Chose the geometry-radius fix: the prebuilt flash geometry is now `OctahedronGeometry(0.5, 0)`
  (internal `IMPACT_FLASH_GEOMETRY_RADIUS = 0.5`) at the unchanged `IMPACT_FLASH_PEAK_SCALE = 0.55`
  → 0.5 × 2 × 0.55 = **0.55 world-unit diameter**.
- The test now pins `geometry.parameters.radius === 0.5`, `IMPACT_FLASH_PEAK_SCALE === 0.55` and the
  derived 0.55 world diameter, so a future geometry/scale drift cannot silently restore B1.
- No other behavior changed: caps 42/6/72, lifetimes 140/380/480/1200 ms, growth/fade envelope,
  palette, spawn order, recycling, quality/reduced tiers, destroy timeline, shot/muzzle/recoil, and
  no-gold/no-shake are untouched.

Decisions:
- **Geometry-radius fix, not peak-scale fix.** `IMPACT_FLASH_START_SCALE`/`IMPACT_FLASH_PEAK_SCALE`
  remain the spec's 0.18/0.55 and every scale read-back in the accepted tests stays valid; only the
  prebuilt radius changes. The geometry still has 8 triangles, one drawable and one material, so the
  T3 object/draw/triangle accounting is unchanged (`6 × 8 = +48` static core triangles).
- **Test pin is explicit.** `impact-effects.test.ts` asserts the radius, the peak scale and their
  product; no wildcard/matcher weakening, no new export (the module export list is unchanged).
- **Measurement method (reproduces B1's numbers).** Crop ±130 px around the live core centre, select
  the largest 8-connected component of additive warm glow with RGB > (210, 200, 140), and report its
  bounding box. The same method on the T3 frames returns exactly the review's **90 × 90 px**
  (1280×720, `t3-click-core-0252ms-1280x720.png`) and **136 × 136 px**
  (1920×1080, `t3-click-core-0275ms-1920x1080.png`).
- **Capture harness.** Test-only CDP harness in `/tmp/opencode/t4/` (patches the dev-server
  `src/render/scene.ts` response with `window.__t14Scene`, as in T3; no repository file changed).
  Peak frames are screencast frames inside 240–280 ms; impact frames use a test-only renderer-surface
  `Page.captureScreenshot` armed at the measured offset because the compositor can deliver a stale
  screencast frame for the fast impact transition. The live 4 ms sampler projects the six octahedron
  vertices through the camera at every tick, giving the exact screen-space diameter independently of
  the PNG threshold.
- **Spec wording note (planner-owned).** `spec.md` AC-3 still literally names
  `OctahedronGeometry(1, 0)`; B1's INFO item asks the planner to align AC-3 with the corrected
  0.5-radius geometry. `spec.md` is not in T4 `files_owned` and was not edited. The implementation
  and tests now pin the B1-corrected combination.

## Before / after measurements

Environment: Node v24.22.0 / npm 11.19.1; frontend dev server `localhost:5173` (Vite, hot reload);
headless Google Chrome 157.0.8103.50 over CDP; online guest, forced high tier, same click helper
(index 2 face centre) as T3. Frames at 1280×720 and 1920×1080, device scale factor 1.

| size | frame | measured time | core instance scale | projected core diameter | PNG glow bbox |
| --- | --- | --- | --- | --- | --- |
| 1280×720 | **before** `t3-click-core-0252ms-1280x720.png` | 252 ms | 0.55 on a radius-1 geometry | — (derived 90.8 px from 1.1 world) | **90 × 90 px** |
| 1280×720 | **after** `t4-core-impact-200.8ms-1280x720.png` | 200.8 ms | 0.410937 on radius 0.5 | **33.91 px** | 48 × 48 px (incl. brightened tile wash) |
| 1280×720 | **after** `t4-core-peak-0245ms-1280x720.png` | 245 ms | 0.548287 → peak 0.55 | **45.25 px** (peak 45.39) | **42 × 44 px** |
| 1920×1080 | **before** `t3-click-core-0275ms-1920x1080.png` | 275 ms | 0.55 on a radius-1 geometry | — (derived 136.2 px from 1.1 world) | **136 × 136 px** |
| 1920×1080 | **after** `t4-core-impact-200.1ms-1920x1080.png` | 200.1 ms | 0.410937 on radius 0.5 | **50.87 px** | 71 × 75 px (incl. brightened tile wash) |
| 1920×1080 | **after** `t4-core-peak-0254ms-1920x1080.png` | 254 ms | 0.55 | **68.08 px** | **61 × 69 px** |

- The after peak is **42–44 px (pixel glow) / 45.25 px (live projection) at 1280×720** — the spec's
  ≈45 px — and **61–69 px (pixel glow) / 68.08 px (live projection) at 1920×1080**, exactly
  45.39 × 1.5 = 68.08 px at the taller viewport. Before/after is a halving of the rendered diameter:
  measured glow 90 → 42–44 px at 1280 and 136 → 61–69 px at 1920; live projection 45.25/68.08 px
  after (the before projection follows from the measured 1.1 world-unit diameter).
- The impact-window PNG bbox includes the swelled/brightened clicked tile behind the additive core
  (the tile itself is warm-bright at +16 ms), so the impact core size is quoted from the live
  vertex projection; the peak-window bbox is measured on the isolated glow. The reviewer's method
  returns the same 90/136 px on the T3 before frames.
- Sampler onsets: 1280 impact at 184.5 ms, 1920 impact at 174.5/184.1 ms across runs; the 140 ms
  flash lifetime and 60 ms growth / 80–140 ms fade are unchanged (impact-effects unit tests still
  assert 0.18 → 0.55 at 30/60/80/110/139/140 ms).
- The shot/muzzle/recoil, destroy collapse, quality tiers, reduced motion, coin popup, reticle,
  cursor ship, banner/fly-by, no shake and no-gold checks were not altered; the T3 evidence matrix
  and its suites remain the record for those windows.

## Verification evidence (raw)

- `npm run lint` → exit 0:
  ```
  > lint
  > eslint .
  ```
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0:
  ```
  > typecheck
  > tsc --noEmit
  ```
- `npm test --workspace @cubeclicker/frontend` → exit 0:
  ```
   Test Files  64 passed (64)
        Tests  1738 passed (1738)
  ```
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds ≥80 × 4):
  ```
   Test Files  64 passed (64)
        Tests  1738 passed (1738)
  All files          |   96.44 |    95.44 |   97.47 |   96.44 |
  ```
  `impact-effects.test.ts` (22 tests) is included; no exclusion or threshold changed.
- Measurement command (`python3 /tmp/opencode/t4/measure.py`, same threshold/crop method):
  ```
  t3-click-core-0252ms-1280x720.png    bbox [90, 90]    glow pixels 5307
  t3-click-core-0275ms-1920x1080.png   bbox [136, 136]  glow pixels 9744
  t4-core-impact-200.8ms-1280x720.png  bbox [48, 48]    glow pixels 1683  (tile wash)
  t4-core-peak-0245ms-1280x720.png     bbox [42, 44]    glow pixels 1389
  t4-core-impact-200.1ms-1920x1080.png bbox [71, 75]    glow pixels 3738  (tile wash)
  t4-core-peak-0254ms-1920x1080.png    bbox [61, 69]    glow pixels 3190
  ```
- Live projection sampler (`/tmp/opencode/t4/capture-*.json` and `timed-*.json`):
  - 1280 peak: `{"radius":0.5,"scale":0.548287,"w":45.25,"h":45.25,"cx":691.6,"cy":205.2}`;
    at 250.8 ms `scale 0.55, w 45.39`.
  - 1920 peak: `{"radius":0.5,"scale":0.55,"w":68.08,"h":68.08,"cx":871.6,"cy":274.7}`.
  - 1280 impact: `{"radius":0.5,"scale":0.410937,"w":33.91,"h":33.91,"cx":777.6,"cy":222.4}`.
  - 1920 impact: `{"radius":0.5,"scale":0.410937,"w":50.87,"h":50.87,"cx":960,"cy":292.4}`.
- `git status` after the fix contains only the T4-owned source/test/log/evidence files (plus the
  orchestrator-owned untracked feature docs). No backend, protocol, config, container, README or
  index change.

## Acceptance audit

| AC | status | evidence |
| --- | --- | --- |
| AC-3 | **met** | Three children, caps, palette, lifetimes, spawn order, recycling, `activeCounts`, no-gold names/geometry, no post-construction drawable/geometry/material and idempotent dispose remain exactly as accepted (`impact-effects.test.ts`, 22 tests). The only delta is the flash geometry radius: `OctahedronGeometry(0.5, 0)`, pinned with `geometry.parameters.radius === 0.5`, `IMPACT_FLASH_PEAK_SCALE === 0.55` and the 0.55 world-diameter invariant; the 8-triangle/drawable/material accounting is unchanged. |
| AC-9 | **met** | Corrected core frames: `t4-core-peak-0245ms-1280x720.png` measures **42 × 44 px** glow / **45.25 px** projected at 1280×720 (spec ≈45 px), and `t4-core-peak-0254ms-1920x1080.png` measures **61 × 69 px** glow / **68.08 px** projected at 1920×1080 (proportional 1.5×). The impact-window frames (`t4-core-impact-200.8ms-1280x720.png`, `t4-core-impact-200.1ms-1920x1080.png`) show the swelled tile + core at 33.91/50.87 px projected. `build-log-T3.md` now marks its false 90/136 px-era “≈45 px” claim as corrected (before/after). All other AC-9 windows, reduced-motion frames and preserved behaviours are unchanged from T3. |
| Preserved AC-4…AC-8, AC-10…AC-12 | unchanged | No code path other than the flash geometry radius changed; the full frontend suite (1738 tests) and coverage (96.44/95.44/97.47/96.44) are green; T3’s destroy/shot/quality/reduced/README/index/fork-point evidence remains valid. |

## Documentation / scope

- No user-facing documentation change: the geometry correction restores the size already documented
  in the spec/README wording (“small white-orange impact burst”); `README.md`,
  `docs/features/README.md`, `docs/architecture/**` and `docs/product/glossary.md` are untouched.
- `docs/features/README.md` remains orchestrator-owned; no row change.
- No spec/plan/tasks/status edit (planner/orchestrator-owned). The AC-3 literal geometry wording is
  flagged above for the planner.
- No dependency, backend, protocol, lockfile, compose, Dockerfile, asset or audio change.

## Deviations from spec / task scope

- None. `build-log-T3.md` is explicitly T4-owned and was edited only to correct the core-size claim
  and the geometry name/triangle note; no predecessor artifact, spec, plan, tasks or status file was
  changed.
