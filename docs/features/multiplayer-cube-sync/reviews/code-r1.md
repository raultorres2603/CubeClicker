---
feature: multiplayer-cube-sync
kind: code
iteration: 1
verdict: approved
blocking: 0
---

# Code Review — r1

## Summary
Approved. All 17 ACs are met with reproducible evidence; lint, typecheck, tests (backend 208, frontend 642), coverage (backend 98.64/97.4/100/98.64; frontend 95.97/96.68/97.26/95.97) and build all pass; smoke 8/8; no protected/container/predecessor files touched. Minor test-hygiene notes only.

## Acceptance verification
| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 Baseline preserved | ✅ | `npm test` green: backend protocol/servers/cubes/hub/app; frontend protocol/server-state/world/scene/session/engine. Additive orientation fields only. |
| AC-2 Orientation travels with cube state | ✅ | `src/backend/src/game/protocol.ts`, `src/frontend/src/multiplayer/protocol.ts`; codec matrix in both `protocol.test.ts` (valid (0,0),(3,1),(2,-1); invalid 1.5,4,-1 yaw; 2,-2 pitch). |
| AC-3 Client→server `rotate` | ✅ | `protocol.test.ts` parity: `{yawSteps:1.5,pitchSteps:0}` → bad_message; `{yawSteps:5,pitchSteps:0}` accepted (clamped). |
| AC-4 Server handles `rotate` | ✅ | `src/backend/src/game/hub.test.ts`: clamp 5→1, -1→3, pitch 5→1, -5→-1; not_joined; broadcast to others. |
| AC-5 `cubeRotated` broadcast | ✅ | `protocol.test.ts`, `server-state.test.ts`, `world.test.ts` (applyMessage updates member + animator; self defensive only; engine does not adopt). |
| AC-6 Rate limit | ✅ | `hub.test.ts`: 20/21 boundary within 1000 ms, reset after 1000 ms, silent drop. |
| AC-7 Remote cubes rotate | ✅ | `world.test.ts`: group rotation at t=0/150/300 ms, settled matrix, no-op on identical. |
| AC-8 Initial orientation sync | ✅ | `server-state.test.ts`, `world.test.ts`: welcome/worldEntered/memberJoined carry orientation. |
| AC-9 Level advance resets orientation | ✅ | `world.test.ts`, `hub.test.ts`: member orientation → (0,0), remote rebuild. |
| AC-10 Full spectating | ✅ | `session.test.ts`, `scene.test.ts`: spectate view rotates via world animator; camera identity quaternion. |
| AC-11 No vision-range culling | ✅ | `world.test.ts`: all members rendered (≤ X, X ≤ 24). |
| AC-12 Completion across level advance | ✅ | `session.test.ts`, `world.test.ts`: rebuild/move, orientation reset, spectate cleared on welcome/resume. |
| AC-13 Own cube adopts server orientation | ✅ | `engine.test.ts`, `session.test.ts`: AuthoritativeCubeState gains fields; adoptCubeState adopts (settled, rotationFrom=null); stats not rolled back. |
| AC-14 Reconnection convergence | ✅ | `session.test.ts`: resume welcome carries own + roster orientations; adopt + reset view; spectate cleared. |
| AC-15 Loss tolerance | ✅ | `world.test.ts`: unchanged group matrix after dropped packet, converges after next accepted `cubeRotated`. |
| AC-16 No containerization impact | ✅ | `git diff` on compose/Dockerfile/README/smoke empty; smoke 8/8 unchanged. |
| AC-17 Coverage gate | ✅ | `npm run coverage` exit 0; backend 98.64/97.4/100/98.64; frontend 95.97/96.68/97.26/95.97; no exclusions/threshold changes. |

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | src/backend/src/game/hub.test.ts:1403,1431 | `expect(sync).toBeDefined()` / `expect(joined).toBeDefined()` weak existentials before property access; no in-test justification comment. | Replace with concrete assertions or add an in-test unavoidability comment; ≤1-per-task exception not satisfied. | open |
| F2 | MINOR | src/frontend/src/multiplayer/protocol.ts (coverage) | File-level functions coverage 78.94% (<80) although workspace aggregate passes (95.97/97.26). | Optional: add tests for the unhit builder branches; not blocking (AC-17 is workspace-aggregate). | open |
| F3 | INFO | docs/features/multiplayer-cube-sync/tasks.md, status.md | T7/T8 remain marked in-progress (`[>]`/`[ ]`) despite completed build logs and verified implementation. | Update task board/status to reflect completion. | open |

## Verification performed
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0 (both workspaces)
- `npm test` → backend 7 files/208 tests; frontend 28 files/642 tests; all pass
- `npm run coverage` → backend 98.64 stmts/97.4 branches/100 funcs/98.64 lines; frontend 95.97/96.68/97.26/95.97; thresholds ≥80 met
- `npm run build` → exit 0
- `npm run smoke` → 8/8 PASS
- `git diff f04f14d..HEAD` → no compose/Dockerfile/README/smoke/main.tsx/index.html/ws/connection.ts/server.ts/package files/predecessor spec edits; no new dependencies.

## Checklists
| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No secrets, no new deps, WS messages shape-validated, orientation clamped server-side, rate-limited. |
| Quality | ✅ | Pure logic separated; single connection owner; no debug leftovers; container contract preserved. |
| Testing | ✅ | Coverage reproducible; no snapshot-only/assertion-free tests; two weak existentials noted (F1). |

## Deviation adjudications
- T1 MAX_STEPS=3 (vs brief fallback 8): accepted — spec pins yaw 0..3, so 3 is correct; brief's 8 overridden by spec.
- T4 `withRotated` no-op on identical orientation: accepted — matches AC-7/AC-5 (no animation restart).
- T6 300 ms (vs 200 ms): accepted — F4 resolved to `timingsFor(false).rotationMs` = 300 ms; code uses that constant.
- T7 queue-on-disconnect (latest-wins single slot): accepted — documented implementation choice; flush on reconnect adopts server authority.

## Notes / backlog (non-blocking)
- Predecessor residual N2 (faceCleared replay coverage) remains in inherited `world.test.ts`; no new requirement.
- Manual browser checklist not executed (no display in container); automated smoke + unit/integration suites green.
