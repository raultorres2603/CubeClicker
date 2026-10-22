---
feature: cube-visual-polish
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 0
---
# Code Review — r1

## Summary
✅ approved — All seven acceptance criteria met with concrete test evidence. The implementation correctly delivers the five visual polish behaviors (travel expansion, intro cinematic, burst fronting, pop animation, cursor removal) while preserving every retained predecessor behavior. Coverage thresholds met (99.31/99.36/100/99.31), bundle within budget (209.49 kB gzip), and scope discipline verified (only frontend files changed).

## Acceptance verification
| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 — Travel backdrop expansion | ✅ | `starfield.test.ts:168-233` pins expansion values `[1,1,1]@0`, `[1.875,1.875,1]@0.25`, `[4.5,4.5,1]@0.5`, `[7.125,7.125,1]@0.75`, `[8,8,1]@1` with z=1; `starfield.ts:113-117` implements `S = 1 + (TRAVEL_STARFIELD_SCALE-1) * easeInOutQuad(progress)`; clamping, persistence and identity tests present. |
| AC-2 — Intro search → find → approach | ✅ | `scene.ts:110-152` implements `introCameraPose` with three segments (search p∈[0,0.4], find p∈[0.4,0.72], approach p∈[0.72,1]); `scene.test.ts` verifies pose table, Frustum gates (off-screen → centred → framed), identity quaternion at p=0.72/0.86/1, skip/reduced-motion collapses. |
| AC-3 — Burst renders in front | ✅ | `particles.ts:148` sets `depthTest: false`, `particles.ts:153` sets `renderOrder = 10`; `effects.test.ts:94` pins `BURST_ORIGIN_OFFSET = 0.5`; `scene.ts:313-317` spawns burst at `origin + normal * BURST_ORIGIN_OFFSET`; `scene.test.ts` verifies front-face origin `(-2,2,3.125)`, `+1` yaw origin `(3.125,2,2)`, gone-face fallback `(0,0,0)`. |
| AC-4 — Pop-then-shrink disappearance | ✅ | `effects.ts:147-177` implements `popScaleAt` (1→1.1→0) and `popColorMultiplierAt` (1→1.3→1); `effects.test.ts:128-150` pins exact timeline `[1,1.05,1.1,0.55,0,0]` and `[1,1.15,1.3,1.15,1,1]` at t=0/50/100/130/160/161; `cube-view.ts:316-336` implements `hideMiniCube` with instant mode, `cube-view.ts:343-358` advances pop records via `update(dtMs)` rewriting matrix and instanceColor. |
| AC-5 — Pop interactions & resources | ✅ | `cube-view.test.ts` verifies independent records 60 ms apart, repeat-id no-restart, `removeFace` cancellation, `settlePops` on reduced-motion switch, dispose clears records, 10-cycle baseline (AC-16); `cube-view.ts:250-253` allocates static per-face `instanceColor` buffer (no new drawables). |
| AC-6 — Keyboard selection cursor removed | ✅ | `keyboard.ts:42-47` maps only four arrow keys in `PLAYING_KEY_EVENTS`; `keyboard.test.ts` verifies WASD/Enter/Space map to `null` (case-insensitive for letters), arrows map to rotation, intro any-key skip retained; `engine.ts:65-68` defines `GameEvent` without cursor events, `EngineSnapshot` (lines 98-113) has no `cursor` field; `rotation.ts` exports only `Orientation`/`Axis`/`createOrientation`/`rotateStep`/`frontFace`/`interpolateRotation` (no `Cursor` types); `GameCanvas.tsx:37` pins exact aria-label `"Game canvas: click a mini-cube to explode it; drag or press the arrow keys to rotate the cube"`; `grep -rin "Cursor|createCursor|moveCursor|reanchorCursor|highlightCursor"` returns no matches in production code. |
| AC-7 — Supersession ledger & regression | ✅ | Only five predecessor behaviors changed (AC-1 aria-label, AC-3 travel visual, AC-5 instant hide/layering, AC-8 cursor, AC-22 intro path); all retained predecessor ACs passing (AC-2 intro skip, AC-4 level structure, AC-6 pointer classification, AC-7 arrow rotation, AC-9 face destruction, AC-10 travel, AC-11 HUD stats, AC-12 reduced motion, AC-13 touch, AC-14 single live region, AC-15 lifecycle, AC-16 bounded resources, AC-17 coverage bar, AC-18 glossary, AC-19 scope, AC-20 bundle budget, AC-21 container); `git diff --stat 76e9ea5..HEAD` shows only frontend source/test/build-log files changed (26 files, +2294/-985 lines), no backend/container/config changes; `npm run coverage` exits 0 with both workspaces ≥ 80 (backend 100/100/100/100, frontend 99.31/99.36/100/99.31); `npm run build` succeeds with gzip 209.49 kB ≤ 350 kB budget. |

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| — | — | — | No blocking or non-blocking findings. | — | — |

## Verification performed
- `npm run lint` → exit 0 (no output beyond the `eslint .` header).
- `npm run typecheck` → exit 0 (both workspaces).
- `npm test` → exit 0: 21 files / 273 tests all green (4 backend + 269 frontend).
- `npm run coverage` → exit 0: backend 100/100/100/100; frontend 99.31/99.36/100/99.31 (all four metrics ≥ 80). Uncovered lines: `GameCanvas.tsx:23-30` (SSR-unexecuted effect body, pre-existing), `session.ts:173` (pre-existing branch), `connection.ts:53-54,99-100` (pre-existing). No coverage exclusions or threshold changes.
- `npm run build` → exit 0: initial JS gzip 209.49 kB (within 350 kB budget); CSS gzip 0.63 kB; HTML gzip 0.27 kB.
- `grep -nE "toBeCloseTo|expect\.anything|expect\.any\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toMatchSnapshot"` over all test files → no matches (bounded-exception budget 0).
- `grep -rin "Cursor|createCursor|moveCursor|reanchorCursor|CURSOR_|CursorAnchor|highlightCursor|cursorMove|explodeCursor"` over production code (excluding tests) → no matches.
- `git diff --name-only 76e9ea5..HEAD | grep -E "^(src/backend|compose|docs/architecture|package\.json|\.env)"` → no matches (only frontend files changed).
- Inspected implementation files: `effects.ts` (constants and timeline functions), `starfield.ts` (expansion formula), `particles.ts` (depthTest/renderOrder pins), `cube-view.ts` (pop animation, FACE_NORMALS, instanceColor), `scene.ts` (introCameraPose, snapToQuarterTurns, applyExplosion with origin offset, applyCamera), `keyboard.ts` (arrow-only table), `engine.ts` (no cursor field), `rotation.ts` (no cursor types), `GameCanvas.tsx` (pinned aria-label).
- Inspected test files: `effects.test.ts` (pins constants and timeline), `starfield.test.ts` (pins expansion values), `particles.test.ts` (pins depthTest/renderOrder), `cube-view.test.ts` (pins pop timeline, instanceColor, interactions), `scene.test.ts` (pins intro poses, Frustum gates, burst origins).

## Checklists
| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No new dependencies (three 0.186.1 + @types/three 0.186.0 unchanged); no user data, storage, or network; no secrets; no innerHTML; React escapes numeric stats by construction; resource bounds unchanged (pop adds one static per-face instanceColor buffer, bounded). |
| Quality | ✅ | Pure game logic in `game/**` (DOM-free, three-free); single source of truth (engine snapshot); one writer per storage key (no persistence); names describe intent; no dead code; diffs traceable to tasks; no silent float surprises (exact-float assertions use `Math.fround`); edge inputs handled (rapid clicks, repeat-id no-op, tab throttling via rAF); error paths handled (idempotent dispose, removed-face guard); keyboard operable (arrow rotation retained); semantic elements (canvas focus ring); respects prefers-reduced-motion (instant hide, no pop, no burst); no layout shift; immediate feedback (pop animation); interaction latency < 1 frame (synchronous stat increment); no per-frame allocations (scratch vectors reused); timers cleaned up on dispose; bundle justified (209.49 kB gzip); no real-time features in this scope. |
| Testing | ✅ | Coverage gate met (both workspaces ≥ 80 on all four metrics); every AC has direct test evidence; core logic has unit tests independent of DOM; integration points tested (state ↔ scene via applySnapshot, intent application via applyIntents); bug fixes include regression tests (pop animation, burst offset, cursor removal); deterministic (fake timers, seeded random); assertions check behavior not implementation; no flaky patterns; tests fail for the right reason; no banned matchers; no snapshot-only tests; no assertion-free tests; bounded-exception budget 0; every test can fail on a real regression. |

## Previous round verification (if iteration > 1)
N/A (iteration 1)

## Notes / backlog (non-blocking)
- **Manual visual pass (INFO):** Not executed (no browser available to reviewer). Node-assertable substitutes (AC-1…AC-6 tests) provide strong evidence, but the visual feel of the expansion, intro cinematic, burst fronting, and pop animation remains a user step. Recommend `podman compose up --build` + the spec § Manual visual pass checklist before merge.
- **Pre-existing residuals (INFO):** `GameCanvas.tsx:23-30` effect body unexecuted under SSR (61.9% coverage); `session.ts:173` branch uncovered; `connection.ts:53-54,99-100` uncovered. These are documented in the T4 log and predate this feature; no action required.
- **T2 D-1 deviation (INFO):** `session.test.ts` edited outside T2's `files_owned` (2 assertions of superseded predecessor behavior). Ratified in tasks.md r2 (T2 `files_owned` amended: 3 expected values, test-only). No collision with T3's cursor-field edit. Acceptable.
- **T2 D-2 deviation (INFO):** Intro pose row p=0.56 is f64-exact, not decimal-exact (≤ 7e-15 error). Documented in scene.test.ts with in-test comment; no `toBeCloseTo` used. Acceptable.
- **T2 D-3 deviation (INFO):** `lookAt(ORIGIN)` added to travel/playing branches (positions unchanged) so an intro skip lands on the rest orientation (identity quaternion). Required by AC-2; positions byte-identical to predecessor. Acceptable.
- **T2 D-4 deviation (INFO):** `settlePops` restores colour multiplier to 1 as well as zero-scaling. Spec says "zero-scales"; timeline's end state is zero scale **and** multiplier 1. Invisible at zero scale; keeps end state single. Acceptable.
- **T3 command-form note (INFO):** Aria-label verify grep in task text omits `-r`; recursive equivalent returned no matches. No code impact. Acceptable.
- **Spec F1 (INFO):** Root-cause statement "screen-space point size" slightly inaccurate (`sizeAttenuation = true` means point size attenuates with distance), but practical conclusion (no visible radial expansion) correct and fix (uniform x/y expansion) sound. Documentation clarity issue, not a spec defect.
