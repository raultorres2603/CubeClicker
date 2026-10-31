---
feature: spaceship-cursor-polish
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 3
---

# Code Review — r1

## Summary

✅ Approved — all AC-1..AC-10 verified with evidence; lint, typecheck, tests (frontend 862, backend 492), coverage (frontend 94.97/94.81/96.39/94.97; backend 94.66/84.32/99.6/94.66) and build all exit 0; no backend/container change. Three non-blocking process findings (README ownership deviation, out-of-scope test baseline edit, untracked predecessor row).

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `effects-spaceship.test.ts` (5 tests) asserts `SHOT_TRAVEL_MS === 180`, `SPACESHIP_FOLLOW_TAU_MS === 240`, offsets `-0.12`, `SPACESHIP_SCALE === 1.5`, `SPACESHIP_IGNITION_COUNT === 2`, threshold `0.01`, flicker period `100`; constants present in `effects.ts:167-188`. |
| AC-2 | ✅ | `spaceship.test.ts` "spaceshipFollowFactor": `spaceshipFollowFactor(240, false)` `toBeCloseTo(1 - 1/Math.E, 6)`; `spaceshipFollowFactor(0, false) === 0`; reduced motion returns 1 for dt 0/120/1000. Code `spaceship.ts:92-97`. |
| AC-3 | ✅ | `spaceship.test.ts` "spaceshipTargetPosition": default camera gives `(-0.334695, -0.334695, 6.018699)` within 1e-6; method unchanged, uses new offsets. Code `spaceship.ts:105-115`. |
| AC-4 | ✅ | `spaceship.test.ts`: group scale equals `SPACESHIP_SCALE` on all axes; geometry types include `ConeGeometry` and `CylinderGeometry`, no `BoxGeometry`. Code `spaceship.ts:119-135`. |
| AC-5 | ✅ | `spaceship.test.ts`: ignitions length `SPACESHIP_IGNITION_COUNT`, each named `'ignition'`; created `visible === false`, intensity 0; rest (no pointer) intensity 0 + hidden; moving update (dtMs 120, pointer) intensity > 0 + a visible ignition; reduced motion stays hidden/intensity 0. Code `spaceship.ts:145-164, 200-245`. |
| AC-6 | ✅ | `spaceship.test.ts`: two consecutive moving updates (dtMs 120) yield `scale.z` differing by > 1e-9; dtMs 0 / sub-threshold (dtMs 1) keep intensity 0 and no time advance. Code `spaceship.ts:229-245`. |
| AC-7 | ✅ | `SHOT_TRAVEL_MS === 180` (effects-spaceship.test.ts); shot spawn/midpoint@90ms/completion@180ms in `spaceship.test.ts`; deferred explosion/arrival in `scene-spaceship.test.ts` (midpoint + arrival + hidden + burst count). |
| AC-8 | ✅ | `spaceship.test.ts` reduced-motion snap test; `scene-spaceship.test.ts` "snaps under reduced motion for dtMs 0" and "reduced motion: instant, no shot"; ignitions inactive under reduced motion. |
| AC-9 | ✅ | `npm run coverage` exit 0; frontend All files 94.97 stmts / 94.81 branch / 96.39 funcs / 94.97 lines; backend All files 94.66 / 84.32 / 99.6 / 94.66; all ≥ 80. spaceship.ts 97.66 stmts / 84.09 branch. |
| AC-10 | ✅ | `git diff` for `compose.yaml`, `compose.smoke.yaml`, `src/backend/**`, Dockerfiles empty (no protected-path changes). |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `docs/features/README.md` (working tree, uncommitted) | Builder appended the predecessor `spaceship-cursor` row to the orchestrator-owned feature index during a feature that is still `code_review`, instead of proposing its own row diff. Not a rewrite, but ownership/process deviation (no build-log note). | Revert the unexplained row or document it in the build log; orchestrator applies the `spaceship-cursor-polish` row on acceptance per `documentation.md` § ownership. | open |
| F2 | INFO | `src/frontend/src/render/scene.test.ts:1633` | Baseline object count updated `19 → 21` to reflect the two new ignition meshes. Justified (+2 nodes), but `scene.test.ts` is outside T1's `files_owned`; deviation is documented in build-log-T1. | None required; keep the mechanical update. | open |
| F3 | INFO | `docs/features/spaceship-cursor-polish/build-log-T1.md:4` | Build log lists `scene.test.ts` among changed files (matches F2); no other out-of-scope edits detected. | None required. | open |

## Verification performed

- `npm run lint` → exit 0 (no output/errors).
- `npm run typecheck` → exit 0 (backend + frontend `tsc --noEmit`).
- `npm test` → exit 0; backend 18 files / 492 tests; frontend 40 files / 862 tests.
- `npm run coverage` → exit 0; frontend All files 94.97% stmts / 94.81% branch / 96.39% funcs / 94.97% lines; backend All files 94.66% / 84.32% / 99.6% / 94.66%; all ≥ 80. `spaceship.ts` 97.66% stmts / 84.09% branch. Exclusions unchanged (`src/main.tsx` / `src/server.ts` + test patterns + Vitest defaults).
- `npm run build` → exit 0 (backend tsc; frontend vite build).
- `git diff` protected paths (`compose.yaml`, `compose.smoke.yaml`, `src/backend/**`, Dockerfiles) → empty.
- Banned-matcher scan of changed tests → none (`expect.any`, `objectContaining`, snapshots, unchecked `toHaveBeenCalled` all absent).
- Manual inspection of `spaceship.ts` update ordering: lerp runs first on every pointer path (including reduced motion and dtMs 0), then reset + early-return — matches spec r3 F1.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No new deps, no innerHTML/eval, no storage/network, procedural geometry only; no secrets. |
| Quality | ✅ | Pure helpers separated; single source of state; no debug leftovers; constants pinned; diff traceable to T1/T2/T3. |
| Testing | ✅ | All AC have direct test evidence; coverage ≥ 80 both workspaces; no banned matchers; no assertion-free tests; exclusions justified. |

## Previous round verification (if iteration > 1)

n/a — first code review round.

## Notes / backlog (non-blocking)

- Real-time/container checks n/a: feature is client-local; no backend/protocol/container change (AC-10). Connection lifecycle, reconnection, multi-client behavior and server authority are unaffected.
- Documentation pass is acceptance-time per `docs/architecture/documentation.md`; no architecture doc change required for this visual-only feature. Feature index row for `spaceship-cursor-polish` to be applied by orchestrator on acceptance.