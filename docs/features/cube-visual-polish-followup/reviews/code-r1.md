---
feature: cube-visual-polish-followup
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 0
---
# Code Review — r1

## Summary
✅ approved — all four acceptance criteria met with strong evidence. The implementation correctly delivers the three defect fixes (backdrop coverage via camera-anchored square cone, intro dolly pointing at the cube from frame 1, and travel arrival with midpoint level advance), preserves every retained behavior from the accepted features, and passes the full verification suite with coverage well above thresholds. Test quality is excellent: concrete assertions, no banned matchers, deterministic seeded fixtures, and the r1 negative evidence retained as documentation.

## Acceptance verification
| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | Square-cone distribution asserted at `starfield.test.ts:78–96` (depths `[20,160]`, `|x|/depth, |y|/depth ≤ 1.251258882715913`); corner-ray coverage at 4 pinned poses × 3 aspects × 2 swirls at `scene.test.ts:586–618`; density floors asserted at `scene.test.ts:621–660` (16:9 total 302, per-cell min 14 ≥ 5; scale-8 peak 5 ≥ 2); swirl rate and anchor composition at `starfield.test.ts:163–250`; production coverage 100/100/100/100 for `starfield.ts` and `scene.ts`. |
| AC-2 | ✅ | 5-row pose table with exact literals at `scene.test.ts:432–455`; monotonic sweep at `:457–473`; framing gates (all 8 cube corners inside frustum) at 5 p × 3 aspects at `:475–504`; skip-to-rest at `:539–548`; reduced-motion collapse at `:550–582`; `INTRO_DURATION_MS` 2500 unchanged at `effects.test.ts:46`; `session.test.ts:517` first-frame pose re-pinned to `[0,0,60]`. |
| AC-3 | ✅ | Pure math: `travelSwing` table and `TRAVEL_LEVEL_ADVANCE_P === 0.5` at `effects.test.ts:104,127–166`; engine: midpoint advance at `engine.test.ts:568–730` (10 cases including default/reduced timelines, once-only firing, input gating, zero-midpoint arm); scene: symmetric camera/scale table at `scene.test.ts:665–765` with identity quaternion and same `Points` identity; mid-travel rebuild at `:714–765`; integrated T4 check (`/tmp/opencode/t4-integration-check.ts`) confirmed rebuild while `travel` at `cameraZ = 90` / scale `(8,8,1)`, exactly one rebuild, landing `[0,0,12]` + `[1,1,1]` at `playing`. |
| AC-4 | ✅ | Supersession ledger verified: only the 6 named behaviors changed (polish AC-1 travel values/drift mechanics, polish AC-2 intro path, polish AC-1 manual step 1, predecessor AC-22 flights, predecessor AC-10 level-advance timing, predecessor AC-3 star positions); `git diff HEAD~4..HEAD` on `docs/features/cube-game-frontend docs/features/cube-visual-polish compose.yaml compose.smoke.yaml src/backend src/frontend/src/main.tsx src/frontend/src/ws src/frontend/index.html src/frontend/Dockerfile src/backend/Dockerfile` → empty (exit 0); retained ACs evidenced by 16 unchanged test files all passing; full gate: `npm run lint` → 0, `npm run typecheck` → 0, `npm test` → 295 tests green, `npm run coverage` → backend 100/100/100/100, frontend 99.31/99.36/100/99.31; `npm run build` → gzip 209.38 kB ≤ 350 kB; `npm run smoke` → 4/4 pass; no banned matchers in changed test files (grep exit 1); no DOM globals in `game/**` (grep exit 1). |

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| — | — | — | No blocking findings. | — | — |

## Verification performed
- `npm run lint` → 0 (no findings)
- `npm run typecheck` → 0 (both workspaces clean)
- `npm test` → 0 (backend 1 file / 4 tests; frontend 20 files / 291 tests; 295 tests green)
- `npm run coverage` → 0 (backend 100/100/100/100; frontend 99.31/99.36/100/99.31 — both well above 80 thresholds)
- `npm run build` → 0 (initial JS gzip 209.38 kB ≤ 350 kB budget)
- `npm run smoke` → 0 (4/4 checks pass: backend healthz, frontend index, two WebSocket clients)
- `git diff HEAD~4..HEAD -- docs/features/cube-game-frontend docs/features/cube-visual-polish compose.yaml compose.smoke.yaml src/backend src/frontend/src/main.tsx src/frontend/src/ws src/frontend/index.html src/frontend/Dockerfile src/frontend/Dockerfile` → empty (accepted features and container/config paths untouched)
- `grep -nE "expect\.(anything|any)\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toMatchSnapshot|toBeTruthy|toBeDefined|not\.toThrow" $FILES` → exit 1 (no banned matchers in changed test files)
- `grep -rnE "\b(document|window|requestAnimationFrame|cancelAnimationFrame|performance|localStorage|navigator|HTMLElement|Element|Event)\b" game/ --include='*.ts'` → exit 1 (no DOM globals in `game/**`)
- Manual visual pass: not executed (no browser in sandbox — spec § Manual visual pass declares it not an AC; nearest automated evidence recorded in build-log-T4.md)

## Checklists
| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No new dependencies, no user data, no storage, no network; rendering safety unchanged (procedural geometry, no loaders); resource bounds as robustness (same star count, drawable ceilings, anchor/swirl allocate nothing per frame); test integrity as a control (coverage bar, concrete assertions, `game/**` DOM-freedom retained). |
| Quality | ✅ | Pure game logic separated from rendering/DOM (`game/**` DOM-free); single source of truth for game state (engine owns state, scene reads snapshots); one writer per storage key / one owner per timer (n/a — no persistence); names describe intent; files organized per the plan's file inventory; no dead code, commented-out blocks, or debug leftovers; DRY honored (single `travelSwing` drives camera and scale); diffs traceable to the task; number handling correct (exact dyadic-exact doubles); time handling correct (one clock source, offline/elapsed-time math correct); edge inputs handled (rapid clicks, tab throttling, reload mid-action); error paths handled (storage failure n/a — no persistence); keyboard operable (unchanged); semantic elements (unchanged); text contrast (unchanged); respects `prefers-reduced-motion` (verified); no layout shift (unchanged); feedback immediate (unchanged); interaction latency within spec (unchanged); no per-frame allocations or DOM churn in hot loops (anchor/swirl preallocated); timers/observers cleaned up on teardown (verified); bundle additions justified (0.11 kB smaller than predecessor). |
| Testing | ✅ | Coverage gate: both workspaces ≥ 80 on all four metrics (backend 100×4; frontend 99.31/99.36/100/99.31); coverage exclusions match spec (only `src/main.tsx` + test patterns); un-imported production files count (all at 100%); raw command output recorded in build logs; every AC has direct evidence (tests, commands); core logic has unit tests independent of DOM (`game/**`); integration points tested (state ↔ UI via snapshots, save ↔ load n/a — no persistence); bug fixes include regression tests (r1 negative evidence retained at `scene.test.ts:610`); determinism: no reliance on real wall-clock sleeps (time injected/faked); assertions check behavior, not implementation details; no flaky patterns (no timing races, order dependence, or shared mutable fixtures); tests fail for the right reason (negative evidence retained); no banned matchers; no weak existentials; spy calls checked with concrete arguments; no snapshot-only tests; no assertion-free tests; every added/changed test can fail on a real regression (spot-checked); no tautologies; tests assert behavior/outcomes, not implementation details; review records raw command names and result summaries; every AC marked met cites where the proof lives. |

## Previous round verification (if iteration > 1)
n/a — this is iteration 1.

## Notes / backlog (non-blocking)
- **Manual visual pass (spec § Manual visual pass):** not executed in the builder sandbox (no browser available). The spec explicitly declares it not an AC, and the nearest automated evidence (corner-ray coverage, framing gates, density floors, integrated T4 check) is strong. The orchestrator/user should run steps 1–10 in a real browser (the stack is up at `http://localhost:5173`) before the feature is marked accepted; steps 1, 2 and 8 are the defect fixes and deserve the most attention.
- **Coverage residuals (pre-existing, not introduced by this feature):** `GameCanvas.tsx` 61.9% stmts/lines (thin effect body unexecuted under node test environment), `ws/connection.ts` 95.34/92.59/100/95.34 (scaffold code, untouched by this feature), `session.ts:173` branch 98.18 (untouched by this feature). All are pre-existing and the workspace aggregate is 99.31/99.36/100/99.31, well above the 80 threshold. No exclusion was added.
- **Pre-existing banned-matcher forms (not introduced by this feature):** four `not.toHaveBeenCalled()` in `render/webgl.test.ts:91` and `browser-env.test.ts:203,223,313` — unchanged files, not touched by this feature; the retroactivity rule keeps them out of scope. The five changed test files are clean.
- **Bundle advisory (informational):** Vite's >500 kB chunk advisory (uncompressed 771.46 kB) is pre-existing; gzip 209.38 kB is inside the 350 kB budget.
- **npm advisories (informational):** 4 pre-existing advisories (2 moderate / 2 critical) in dev tooling — unchanged by this feature (lockfile diff empty); out of scope.
