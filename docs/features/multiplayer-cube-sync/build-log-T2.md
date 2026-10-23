# Build log — T2 — Backend hub orientation storage + rotate handling

Task: T2 (2026-10-23)
Files changed: src/backend/src/game/hub.ts, src/backend/src/game/hub.test.ts, src/backend/src/app.test.ts (mechanical touch-up), docs/features/multiplayer-cube-sync/build-log-T2.md

What changed & why:
- Member now carries yawSteps/pitchSteps (init 0,0 on join) and a separate rotateRate trailing window.
- cubeState()/memberState() project orientation; handleCompletion resets to (0,0); sendSync inherits via cubeState.
- Added handleRotate: trailing 20/s rate limit (silent drop), clamping (yaw ((n%4)+4)%4, pitch max/min), storage update, cubeRotated broadcast to others.
- handleMessage now routes rotate and cubeCompleted explicitly.
- hub.test.ts + app.test.ts fixtures gained yawSteps/pitchSteps (mechanical, AC-1).

Decisions:
- Rate limit constant 20 (not env) per spec Q-1.
- rotateRate is a separate RateWindow from explode rate (Q-5/Q-1).
- cubeRotatedMessage imported from protocol (T1).

Evidence:
- `npm run lint` → (no output, exit 0)
- `npm run typecheck --workspace @cubeclicker/backend` → (no output, exit 0)
- `npm test --workspace @cubeclicker/backend` → Test Files 7 passed (7), Tests 208 passed (208)
- `npm run coverage --workspace @cubeclicker/backend` → All files 98.64% stmts, 97.4% branches, 100% funcs, 98.64% lines (≥80)

Acceptance audit:
- AC-4 → met: clamping cases (5→1, -1→3, pitch 5→1, -5→-1) tested; broadcast to others only; not_joined tested.
- AC-5 (broadcast) → met: cubeRotatedMessage broadcast with concrete member sets.
- AC-6 → met: 20/21 boundary and reset after 1000 ms tested with fake timers.
- AC-9 (backend half) → met: orientation resets to (0,0) on same-server advance and server move.
- AC-14 (backend) → met: stateSync carries orientation; adopt not in backend scope.

Deviations from spec: none (app.test.ts mechanical touch-up per AC-1 allowed).
```

Let me verify coverage numbers exact from output. Yes.

Now commit. Stage specific files. The docs/features/README.md and multiplayer-servers/status.md pre-existing changes should not be staged. I'll stage hub.ts, hub.test.ts, app.test.ts, build-log. But app.test.ts scope... I'll stage it.<|end|><|start|>assandra to=shell<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="command">
cd /var/home/raultorraco/Documents/Projects/CubeClicker && git add src/backend/src/game/hub.ts src/backend/src/game/hub.test.ts src/backend/src/app.test.ts docs/features/multiplayer-cube-sync/build-log-T2.md && git status --short