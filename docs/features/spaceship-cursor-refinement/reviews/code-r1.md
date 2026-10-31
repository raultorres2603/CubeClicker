---
feature: spaceship-cursor-refinement
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 1
---

# Code Review — r1

## Summary

✅ approved — The implementation is a minimal, correct two-constant change (scale 1.5→1.2, NDC x offset -0.12→-0.16) with no production logic edits. Lint, typecheck, all tests (backend 492 + frontend 862), full coverage (backend 94.66/84.32/99.6/94.66; frontend 94.97/94.81/96.39/94.97), build, and the containerized smoke test (12/12) all pass. Every AC-1..AC-8 is met with concrete evidence; the spec-review F1 (mixed-offset test edits) was handled correctly.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `effects-spaceship.test.ts` (5 tests) asserts `SHOT_TRAVEL_MS === 180`, `SPACESHIP_FOLLOW_TAU_MS === 240`, `SPACESHIP_PLANE_DISTANCE === 6`, offsets `(-0.16, -0.12)`, `SPACESHIP_SCALE === 1.2`, `SPACESHIP_IGNITION_COUNT === 2`, threshold `0.01`, flicker period `100`; constants present in `effects.ts:163-186`. |
| AC-2 | ✅ | `spaceship.test.ts` "matches the pinned default-camera vector" asserts `(-0.445721, -0.334291, 6.025924)` within 1e-6; "is independent of the NDC z input" confirms ray direction unchanged. `spaceshipTargetPosition` unchanged in method, reads `SPACESHIP_CURSOR_NDC_OFFSET_X`. |
| AC-3 | ✅ | `spaceship.test.ts` "group scale is (SPACESHIP_SCALE, …)" asserts all three axes equal `SPACESHIP_SCALE` (1.2); "contains ConeGeometry and CylinderGeometry, no BoxGeometry" passes. |
| AC-4 | ✅ | `spaceship.test.ts` shot tests: `remainingMs === SHOT_TRAVEL_MS` (180), midpoint at 90 ms, completion after 180 ms; `SHOT_TRAVEL_MS` imported and pinned. |
| AC-5 | ✅ | `spaceship.test.ts` "follows 1 - exp(-dt/tau)" asserts `spaceshipFollowFactor(240, false) === 1 - 1/Math.E` (tol 1e-6) and `spaceshipFollowFactor(0, false) === 0`. |
| AC-6 | ✅ | `spaceship.test.ts` reduced-motion tests (factor 1 for dt 0/120/1000) plus `scene-spaceship.test.ts` reduced-motion collapse; ignitions stay hidden. |
| AC-7 | ✅ | `npm run coverage` exit 0; backend All files 94.66% stmts / 84.32% branch / 99.6% funcs / 94.66% lines; frontend 94.97 / 94.81 / 96.39 / 94.97 — all ≥ 80. |
| AC-8 | ✅ | `git diff -- compose.yaml compose.smoke.yaml src/backend 'src/backend/**' '**/Dockerfile'` empty (exit 0); no untracked protected paths. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `src/frontend/src/game/effects.ts:170-178` | The edit removed the blank lines that previously separated `SPACESHIP_CURSOR_NDC_OFFSET_X` from the following Y comment and `SPACESHIP_SCALE` from the following ignition comment, slightly noisier than the smallest diff. | Restore the original blank lines between the changed constants (cosmetic only; no behavior impact). | open |

## Verification performed

- `npm run lint` → exit 0 (no output).
- `npm run typecheck` → exit 0 (backend + frontend `tsc --noEmit`).
- `npm test` → exit 0 (backend: 18 files, 492 tests; frontend: 40 files, 862 tests).
- `npm run coverage` → exit 0 (backend 94.66/84.32/99.6/94.66; frontend 94.97/94.81/96.39/94.97; all ≥ 80).
- `npm run build` → exit 0 (backend tsc; frontend vite build).
- `npm run smoke` → exit 0 (12/12 checks passed).
- `git diff -- compose.yaml compose.smoke.yaml src/backend 'src/backend/**' '**/Dockerfile'` → empty (exit 0).
- Banned-matcher grep on changed tests → no matches.
- Coverage config inspection (`vitest.config.ts` both workspaces) → exclusions limited to `src/main.tsx` / `src/server.ts` + test patterns; thresholds 80 on all four metrics; `all: true`.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No new dependencies; no user data/network; procedural geometry only; no secrets. |
| Quality | ✅ | Pure game logic untouched; constants single-sourced in `effects.ts`; no dead code; only cosmetic blank-line removal (F1). |
| Testing | ✅ | All ACs have direct test/command evidence; coverage ≥ 80 both workspaces; no banned matchers; no snapshot-only or assertion-free tests. |

## Previous round verification (if iteration > 1)

N/A — first code iteration. (Spec-review F1 (mixed-offset test edits) verified resolved: `effects-spaceship.test.ts` uses X -0.16 / Y -0.12 and `spaceship.test.ts` uses `new Vector3(0.1 - 0.16, -0.2 - 0.12, 1)` and vector `(-0.445721, -0.334291, 6.025924)`.)

## Notes / backlog (non-blocking)

- F2 (spec review, INFO) carried over: the feature row is not yet in the orchestrator-owned `docs/features/README.md`; the orchestrator adds it on acceptance per the merge strategy. The builder did not edit the index.
- Documentation: no architecture/product doc references the spaceship constants, so no doc updates are required for this change; root `README.md` is unaffected. The acceptance-time documentation pass can be a no-op for docs content.
- Wishlist: cross-client spaceship visibility (Q-1) remains a future feature requiring a protocol addition.