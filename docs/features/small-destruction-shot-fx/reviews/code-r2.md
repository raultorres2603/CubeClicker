---
feature: small-destruction-shot-fx
phase: code
iteration: 2
verdict: approved
blocking: 0
---

# Code Review — r2

## Summary

✅ **approved — no open BLOCKER/MAJOR.** T4 fixes review B1 with the geometry-radius correction:
`impact-flash` is now a prebuilt `OctahedronGeometry(0.5, 0)` (`impact-effects.ts:73,203`) at the
unchanged peak scale `0.55`, so the octahedron's diameter is **0.55 world units** (0.5 × 2 ×
0.55). The test pins the radius, the peak scale and their product (`impact-effects.test.ts:191-196`),
so geometry/scale drift cannot silently restore the 2× core. The corrected evidence measures
**42 × 44 px at 1280×720** and **61 × 69 px at 1920×1080** with the same threshold method that
returns 90 × 90 px / 136 × 136 px on the T3 before-frames; the live vertex projection records
**45.25 px / 68.08 px** at the peaks, matching the spec's ≈45 px at 1280. The false
`build-log-T3.md` claim is corrected with a post-review block and annotated rows (M2 closed).

All repository gates reproduce: lint, typecheck, 868 backend + 1,738 frontend tests, coverage
≥ 80 × 4 in both workspaces, build (initial JS gzip **272.74 kB ≤ 279 kB**), fork-point diff gate,
README phrase checks and the feature-index guard. The T3 performance logs were independently
parsed against the AC-8 bars and pass (see below). M1 is closed on substance: the
`session.test.ts` update-order change remains disclosed and justified, and its assertions are
stronger than the old same-frame test. One non-blocking evidence note (M3) and one stale
planner/task bookkeeping note (INFO) follow.

## Previous findings disposition

| Finding | Status | Evidence |
| --- | --- | --- |
| **B1 (BLOCKER)** — core ~2× pinned size | **fixed / closed** | `impact-effects.ts:73` defines `IMPACT_FLASH_GEOMETRY_RADIUS = 0.5`; `:203` builds `OctahedronGeometry(0.5, 0)`; `:66` keeps `IMPACT_FLASH_PEAK_SCALE = 0.55`; `impact-effects.test.ts:191-196` pins `radius === 0.5`, `detail === 0`, `IMPACT_FLASH_PEAK_SCALE === 0.55` and `radius × 2 × peakScale === 0.55`. Independent pixel measurement: T4 peak **42 × 44 px @1280**, **61 × 69 px @1920**; T3 before **90 × 90 / 136 × 136 px**. Live projection: 45.25 px / 68.08 px. Math: 0.5 radius × 2 × 0.55 = 0.55 world diameter. |
| **M1 (MINOR)** — `session.test.ts` outside T3 `files_owned` | **closed on substance; bookkeeping open** | `session.test.ts:1100-1126` still asserts the arrival frame (full extent + brightness 3), the +70 ms mid-collapse and the +140 ms zero/colour-1 end — more assertions than the old same-frame expectation. `build-log-T3.md:15-16,37-41,308-311` discloses the deviation and its update-order justification. The T3 `files_owned` list still omits the file (administrative only; no code change). |
| **M2 (MINOR)** — false core-size claim in the T3 log | **fixed / closed** | `build-log-T3.md:10-18` adds a post-review correction block stating the original “≈45 px” claim was false and recording 90 × 90 / 136 × 136 px; the core-peak rows (`:163-171`) annotate the old frames as superseded and give the T4 corrected measurements; the AC-9 audit row (`:300-301`) is updated. |

## Reproduced verification (this review)

Environment: Node **v24.22.0**, npm **11.19.1**; current HEAD **0703300** (`fix: halve impact
core size`) on top of `657f4ae`; `BASE_SHA = 92fcf84999cde086dbc2d6acc89629f73a2fe6d6`.

| Command / check | Result | Evidence |
| --- | --- | --- |
| `npm run lint` | exit 0 | `eslint .`, no output |
| `npm run typecheck` | exit 0 | both workspaces `tsc --noEmit` |
| `npm test` | exit 0 | backend **24 files / 868 tests**; frontend **64 files / 1,738 tests** |
| `npm run coverage` | exit 0, thresholds ≥ 80 × 4 | backend **95.43 / 87.71 / 99.7 / 95.43**; frontend **96.44 / 95.44 / 97.47 / 96.44** (statements / branches / functions / lines) |
| `npm run build` | exit 0 | JS **982.59 kB raw / 272.74 kB gzip**; CSS 25.61 kB / 5.24 kB gzip; ≤ 279 kB bar |
| Fork-point diff gate (`src/backend`, protocol, manifests, lockfiles, compose, Dockerfiles) | exit 0 | `git diff --exit-code "$BASE_SHA"...HEAD -- …` |
| Import/URL/loader/asset/audio gates | clean | no asset diff; audio grep no matches; T4 adds only `t4-core-*.png` documentation artifacts |
| README phrase checks | all present; `vanishes on the same frame` absent | `README.md:9` |
| `docs/features/README.md` index guard | exit 0, no diff | `git diff --exit-code "$BASE_SHA"...HEAD -- docs/features/README.md` |
| Evidence files | **42** = 38 T3 + 4 T4 | `evidence/` listing |
| Core-size measurement | **42 × 44 px** @1280, **61 × 69 px** @1920; projected **45.25 / 68.08 px** | independent threshold/connected-component measurement of `t4-core-peak-0245ms-1280x720.png` / `t4-core-peak-0254ms-1920x1080.png`; T3 before-frames return 90 / 136 px with the same method |
| AC-8 draw medians | all pass | parsed `/tmp/opencode/t3/perf.jsonl` + rerun/recovery logs: final clean 3-run medians high **217.21 / 217.64** ≤ 221.0 / 220.0; medium **206.33 / 205.30** ≤ 207.0 / 207.0; low **199.17 / 197.08** ≤ 205.0 / 202.0; idle medians 169.20 / 169.13 etc. within ±1.5; p95 16.7–21 ms |
| AC-8 recovery | both pass | `/tmp/opencode/t3/recovery-1280.log`: low→medium 4,852 ms, medium→high 9,799 ms, final high; `recovery-1920.log`: 4,865 / 9,850 ms, final high |
| `countObjects` / caps / bundle | 135 (65 + 70), caps 42/6/72/72, gzip 272.74 kB | green `scene.test.ts`/cap assertions; `npm run build` |

The `perf.jsonl` contains the retained rerun rows for the two outlier cells noted in
`build-log-T3.md:218-221`; filtering to the final clean 3-run cells reproduces the committed
medians. The `/tmp/opencode/t3` logs are outside the repository, so this validation is noted as
reproduced-now evidence rather than a committed artifact; the committed T3 table matches it.

## AC verification

| AC | Status | Evidence |
| --- | --- | --- |
| AC-1 — Motion vocabulary | **met** | Unchanged from r1; `motion.ts` adds exactly the 14 pinned tokens, no accepted value changed. |
| AC-2 — Adaptive quality matrix | **met** | Unchanged; exact high/medium/low/reduced matrices; policy untouched. |
| AC-3 — Little explosion module | **met** | Three children in order, caps 6/72, palette/lifetimes/physics/recycling unchanged; the flash geometry is now `OctahedronGeometry(0.5, 0)` with peak scale 0.55 → **0.55 world-unit diameter**, and the test pins radius/scale/product. 8 triangles, one drawable, one material; object/draw/triangle accounting unchanged. |
| AC-4 — Mini-cube destroy | **met** | Unchanged 140 ms curves, instant semantics, per-face records, 150-record ceiling, settle/remove/dispose; suites green. |
| AC-5 — Remote cube parity | **met** | Unchanged broadcast-animate vs roster-instant path; suites green. |
| AC-6 — Realistic shot | **met** | Unchanged 180 ms travel, muzzle/bolt/muzzle flash/recoil; suites green. |
| AC-7 — Scene integration | **met** | Unchanged wiring and destroy order; `scene-effects.test.ts` green; HUD no-shake owned by unchanged suites. |
| AC-8 — Object/draw/triangle/frame budget | **met** | 135 objects, caps 42/6/72/72, triangle +48/+8/−100 unchanged, bundle 272.74 kB ≤ 279; independently parsed T3 draw medians/p95/recovery all within bars. |
| AC-9 — Visual evidence and manual check | **met** | Corrected peak frames measure **42 × 44 px @1280** (projected 45.25) and **61 × 69 px @1920** (projected 68.08), matching the spec's ≈45 px and its 1.5× scaling; all other T3 windows/reduced/preserved evidence unchanged. One non-blocking evidence note M3 (impact-window PNG tile state). |
| AC-10 — Documentation | **met** | README phrases present; index untouched; T3 correction recorded; no architecture/glossary change required. |
| AC-11 — No dependency/backend/protocol/container/audio change | **met** | Fork-point diff gate exit 0; no dependency, loader, backend, protocol, lockfile, compose, Dockerfile or audio change; T4 PNGs are documentation artifacts. |
| AC-12 — Coverage and full gate | **met** | lint, typecheck, test, coverage (both workspaces ≥ 80 × 4) and build all exit 0; exclusions/thresholds unchanged. |

## Findings

### M3 — MINOR — T4 impact-window frames do not show the claimed brightened/swollen tile

- **Location:** `build-log-T4.md:63-66,74-77` and
  `evidence/t4-core-impact-200.8ms-1280x720.png` / `t4-core-impact-200.1ms-1920x1080.png`.
- **What is wrong:** the log says the impact-window PNG bbox includes “the swelled/brightened
  clicked tile behind the additive core (the tile itself is warm-bright at +16 ms)”. Both frames
  instead show the clicked tile already zero-scaled/texture-less — the dark cube body is visible
  around the small white core — so the filename time is the sampler time, not a trustworthy
  captured tile state. The tile state is covered by the unchanged T3 impact frames and by
  `scene-effects.test.ts`/`cube-view.test.ts`; the corrected core size is proven by the peak
  frames and the live projection. This is an evidence-accuracy issue, not a code or acceptance
  failure.
- **Why it matters:** the log's “tile wash” explanation for the impact PNG bboxes is not
  reproducible, and a future reader could mistake the frame for proof of the destroy start.
- **Required action:** re-capture the two impact frames with a frame-accurate capture, or annotate
  them as “core only; tile state known-stale” and rely on the T3 impact frames + scene tests for
  the 180–220 ms tile state. No code change and no verdict change.

### INFO — Historical task note still names the old geometry; M1 ownership bookkeeping

- **Location:** `tasks.md:83` (T2 note still says `OctahedronGeometry(1,0)`); T3 `files_owned`
  (`tasks.md:119-122`) still omits `session.test.ts`.
- **What is wrong:** the spec r4 and T4 task note are authoritative and correctly say
  `OctahedronGeometry(0.5,0)`, but the historical T2 note remains stale; the M1 ownership change
  was justified in the T3 log but never added to the T3 `files_owned` list.
- **Why it matters:** planner/task-history consistency only; no production or test impact.
- **Required action:** planner cleanup in a future artifact revision (add the file to the T3
  ownership record and update/annotate the T2 note). No builder action.

## Visual / performance / documentation audit

- **Visual:** 42 evidence files. The T4 peak frames show a small isolated white core at both
  sizes; the T3 windows (muzzle, bolt, impact, tile-gone, smoke, smoke-gone), reduced-motion
  frames, no-gold click frames, coin `+0.10`, reticle, cursor ship, banner/fly-by and no-shake
  styles remain the record. No gold ray fan, coin glyph or ring is introduced. M3 is the only
  evidence note.
- **Performance:** independently parsed T3 traces: all six click medians within the AC-8 bars,
  p95 16.7–21 ms, high averages 16.666 ms, idle medians within ±1.5, both forced-low→high recovery
  runs reach high. `countObjects === 135`, caps and the triangle accounting are unchanged by the
  radius-only fix; gzip 272.74 kB ≤ 279 kB.
- **Documentation:** README wording unchanged and correct; `docs/features/README.md` untouched
  with the proposed row in the build log; T3's false claim corrected; no `docs/architecture/**`,
  glossary or predecessor artifact rewritten.
- **Tests:** no weakened assertions; the new radius/scale/product pins are concrete; the
  `session.test.ts` update-order test remains stronger than the old expectation; no snapshot,
  wildcard or assertion-free tests; coverage exclusions/thresholds unchanged.
- **Real-time/multi-client / container:** no change; server authority, reconnection instant path,
  and the containerization contract are unaffected; no compose/Dockerfile/protocol/backend edits.

## Limitations

- The browser capture harness was not re-run in this review; the T4 PNG measurements and live
  projection values are verified from the committed frames and the build log's recorded sampler
  values, and the geometry math is independently checked.
- The T3 perf logs live under `/tmp/opencode/t3` rather than the repository; the committed build
  log table matches the independently parsed medians, but the raw logs are not a committed
  artifact.

## Backlog / next steps

1. **M3** — re-capture or annotate the two T4 impact-window frames; the peak evidence and
   automated tile-state tests already carry the acceptance.
2. **INFO** — planner cleanup of the stale T2 task note and the T3 `session.test.ts` ownership
   record.
3. Orchestrator may apply the proposed `docs/features/README.md` row after acceptance.

## Verdict

**approved — 0 blocking findings.** B1 is fixed and closed, M1 is closed on substance, M2 is
closed, and the remaining M3/INFO items are non-blocking evidence/bookkeeping cleanups.
