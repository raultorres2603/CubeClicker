# Build log — T8 — Verify & integrate (multiplayer-cube-sync)

Task: T8 (2026-10-23)
Files changed:
- src/frontend/src/App.test.tsx
- src/frontend/src/multiplayer/transport.test.ts
- src/frontend/src/render/scene.test.ts
- src/frontend/src/ui/UserPanel.test.tsx
- docs/features/multiplayer-cube-sync/build-log-T8.md

What changed & why:
- Mechanical fixture touch-ups: added `yawSteps: 0, pitchSteps: 0` to stale `CubeState`/`MemberState` fixtures in the four owned test files so strict typecheck and the coverage gate go green (additive only; no assertion meaning changed).
- Full verification run (lint, typecheck, tests, coverage, build, smoke) plus per-AC audit and manual checklist recorded below.

Decisions:
- Did not edit any source file; only the four listed test files and this build log.
- Task brief path `src/frontend/src/ui/App.test.tsx` does not exist; the real file is `src/frontend/src/App.test.tsx`, which was edited instead (deviation recorded).
- Smoke executed against the running containerized stack and passed.

Evidence:

### `npm run lint`
```
> lint
> eslint .

(exit 0, no output)
```

### `npm run typecheck`
```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

(exit 0, no output)
```

### `npm test`
```
> test
> vitest run

 backend: Test Files  7 passed (7); Tests  208 passed (208)
 frontend: Test Files 28 passed (28); Tests 642 passed (642)
 (exit 0)
```

### `npm run coverage`
```
backend:
All files     | 98.64 | 97.4 | 100 | 98.64 |
frontend:
All files     | 95.97 | 96.68 | 97.26 | 95.97 |
(exit 0)
```
Backend per-file: hub.ts 96.93/93.33/100/96.93; all others 100. Frontend notable: session.ts 89.66/90.59/95.65/89.66; protocol.ts 82.78/97.58/78.94/82.78; world.ts 98.41/91.75/100/98.41; scene.ts 99.54/98.38/100/99.54; engine.ts 99.66/98.67/100/99.66.

### `npm run build`
```
backend: tsc (exit 0)
frontend: vite build
dist/index.html                   0.40 kB │ gzip:   0.27 kB
dist/assets/index-DTvgIu_V.css    2.96 kB │ gzip:   0.94 kB
dist/assets/index-S0DRacKv.js   800.23 kB │ gzip: 217.70 kB
✓ built in 1.24s
(exit 0)
```

### `npm run smoke`
```
PASS backend http://backend:8080/healthz responds 200 ...
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello
PASS websocket client 2 received hello
PASS multiplayer join: two clients land on same server (maxUsers 2) ...
PASS multiplayer overflow: third client lands on next server id (X = 2)
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A and B
PASS multiplayer leave: closing B yields memberLeft(left) after grace
SMOKE PASS (8/8 checks)
(exit 0)
```

## Per-AC audit (AC-1 … AC-17)

| AC | Status | Evidence |
|----|--------|----------|
| AC-1 Baseline preserved | met | `npm test` green: backend protocol/servers/cubes/hub/app; frontend protocol/server-state/world/scene/session/engine (T1–T7). Inherited suites pass with additive orientation fields. |
| AC-2 Orientation travels with cube state | met | `src/backend/src/game/protocol.ts`, `src/frontend/src/multiplayer/protocol.ts`; codec matrix in both `protocol.test.ts` (valid (0,0),(3,1),(2,-1); invalid 1.5,4,-1 yaw; 2,-2 pitch). |
| AC-3 Client→server `rotate` | met | `protocol.test.ts` parity: `{yawSteps:1.5,pitchSteps:0}` → bad_message; `{yawSteps:5,pitchSteps:0}` accepted (clamped). |
| AC-4 Server handles `rotate` | met | `src/backend/src/game/hub.test.ts`: clamp cases 5→1, -1→3, pitch 5→1, -5→-1; not_joined for unjoined; broadcast to others. |
| AC-5 `cubeRotated` broadcast | met | `protocol.test.ts`, `server-state.test.ts`, `world.test.ts` (applyMessage updates member + animator; self defensive only; engine does not adopt). |
| AC-6 Rate limit | met | `hub.test.ts`: 20/21 boundary within 1000 ms, reset after 1000 ms, drop before state change. |
| AC-7 Remote cubes rotate | met | `world.test.ts`: group rotation at t=0/150/300 ms, settled matrix, no-op on identical orientation. |
| AC-8 Initial orientation sync | met | `server-state.test.ts`, `world.test.ts`: welcome/worldEntered/memberJoined carry orientation; applyRoster/upsert. |
| AC-9 Level advance resets orientation | met | `world.test.ts`, `hub.test.ts`: member orientation → (0,0), remote rebuild. |
| AC-10 Full spectating | met | `session.test.ts`, `scene.test.ts`: spectate view rotates via world animator; camera stays over target, identity quaternion. |
| AC-11 No vision-range culling | met | `world.test.ts`: all members rendered (≤ X, X ≤ 24). |
| AC-12 Completion across level advance | met | `session.test.ts`, `world.test.ts`: rebuild/move, orientation reset, spectator stay/move, spectate cleared on welcome/resume_failed. |
| AC-13 Own cube adopts server orientation | met | `engine.test.ts`, `session.test.ts`: AuthoritativeCubeState gains fields; adoptCubeState adopts (settled, rotationFrom=null); stats not rolled back. |
| AC-14 Reconnection convergence | met | `session.test.ts`: resume welcome carries own + roster orientations; adopt + reset view; spectate cleared. |
| AC-15 Loss tolerance | met | `world.test.ts`: unchanged group matrix after dropped packet, converges after next accepted `cubeRotated`. |
| AC-16 No containerization impact | met | `git diff` on compose.yaml, compose.smoke.yaml, README.md, src/*/Dockerfile, tests/e2e is empty; smoke 8/8 unchanged. |
| AC-17 Coverage gate | met | `npm run coverage` exit 0; backend 98.64/97.4/100/98.64; frontend 95.97/96.68/97.26/95.97; no exclusions/threshold changes. |

## Coverage residual note
- Thresholds are aggregate per workspace and pass with margin. Residual uncovered lines are pre-existing accepted gaps (session.ts 227, 336-347, 351-360, 365-366, 368-377, 384-385, 388-409, 444-446, 571-572, 714-715, 733-734, 738-741, 818-821; protocol.ts 482-593, 597-607; engine.ts 814-815; scene.ts 757-758; world.ts 229-232, 442; frontend ui 59-60, 82-84). No production code excluded; no threshold lowered.
- frontend protocol.ts functions 78.94% is below 80 at file level but the workspace aggregate (95.97 statements / 97.26 functions) passes the configured gate; thresholds are workspace-aggregate per Vitest config and were not changed.

## Manual browser checklist
Not executed — environment (no browser/display available in this CLI container; verification is via automated smoke + unit/integration suites).
Steps (to be run by a human with two browser tabs):
1. Open two clients on the same server; rotate client A's cube (W/A/S/D or arrows) → client B's remote cube view animates to the reported orientation within rotationMs (300 ms) and settles on the quarter-turns.
2. Spectate client A from client B → B's camera stays over A's cube with identity quaternion; A's further rotations animate on B; pops/face clears/advances visible.
3. Complete a cube on client A → remote view rebuilds in place (same server) or moves slot (cross server), orientation resets to identity; spectator of A stays and sees rebuild (same server) or auto-returns (cross server).
Outcome: not run in this environment.

## Deviations from spec
- Task brief listed `src/frontend/src/ui/App.test.tsx`; actual path is `src/frontend/src/App.test.tsx`; edited the real file (additive fields only).
- No other deviations.

## Open questions
- none.
