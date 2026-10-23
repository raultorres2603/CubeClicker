# Tasks — Multiplayer Cube Actions & Full Spectating

Dependency overview: T1 → T2, T3; T3 → T4, T5, T6; T4, T5, T6 → T7; T2, T7 → T8

## T1 — Backend protocol: orientation fields + `rotate`/`cubeRotated` + `stateSync` orientation `[seq]`
depends_on: —
files_owned: src/backend/src/game/protocol.ts, src/backend/src/game/protocol.test.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/backend`, `npm test --workspace @cubeclicker/backend`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-2, AC-3, AC-5 (codec half), AC-13 (wire)
status: [x]

## T2 — Backend hub: Member orientation storage + `rotate` handling (clamp, broadcast, rate limit, init, reset) `[seq]`
depends_on: T1
files_owned: src/backend/src/game/hub.ts, src/backend/src/game/hub.test.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/backend`, `npm test --workspace @cubeclicker/backend`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-4, AC-5 (broadcast), AC-6, AC-9 (backend half), AC-14 (backend)
status: [x]

## T3 — Frontend protocol mirror + parity `[P]`
depends_on: T1
files_owned: src/frontend/src/multiplayer/protocol.ts, src/frontend/src/multiplayer/protocol.test.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-2, AC-3, AC-5 (codec half)
status: [x]

## T4 — Frontend reducer: store orientation + `cubeRotated` + `stateSync` `[P]`
depends_on: T3
files_owned: src/frontend/src/multiplayer/server-state.ts, src/frontend/src/multiplayer/server-state.test.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-5 (reducer half), AC-8, AC-9 (frontend half), AC-14
status: [x]

## T5 — Frontend engine: adopt orientation in `adoptCubeState` `[P]`
depends_on: T3
files_owned: src/frontend/src/game/engine.ts, src/frontend/src/game/engine.test.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-13
status: [x]

## T6 — Frontend world view: remote rotation animator + `cubeRotated` in `applyMessage` `[P]`
depends_on: T3
files_owned: src/frontend/src/render/world.ts, src/frontend/src/render/world.test.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-5 (world half), AC-7, AC-8, AC-9, AC-11, AC-15
status: [x]

## T7 — Frontend session: send-on-change throttle + adoption + spectate reset `[seq]`
depends_on: T4, T5, T6
files_owned: src/frontend/src/game/session.ts, src/frontend/src/game/session.test.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-10, AC-12, AC-13, AC-14
status: [ ]

## T8 — Verify & integrate `[seq]`
depends_on: T2, T7
files_owned: `src/frontend/src/multiplayer/transport.test.ts`, `src/frontend/src/render/scene.test.ts`, `src/frontend/src/ui/App.test.tsx`, `src/frontend/src/ui/UserPanel.test.tsx`, `docs/features/multiplayer-cube-sync/build-log-T8.md`
verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`
acceptance: AC-1, AC-16, AC-17
status: [ ]

## Errata (r2)

- Merged the former T2 (backend defaults) and T3 (backend hub) into a single task T2, because both edit `src/backend/src/game/hub.ts`; exclusive file ownership forbids splitting one file across tasks. Orientation storage lives on `Member` in `hub.ts`; `servers.ts` and `cubes.ts` are unchanged.
- T6 no longer claims AC-10 (spectating camera behaviour lives in `scene.ts`/`session.ts`); AC-10 is owned by T7. T6 retains AC-7, AC-8, AC-9, AC-11, AC-15 and the world half of AC-5.
- T4/T5/T6 are all `[P]` after T3 (disjoint file sets, no shared files).
- T1 now also covers the `stateSync` (`CubeSync`) orientation field (F13) and the `cubeRotated` codec half of AC-5.
- No `smoke.mjs`, compose, Dockerfile, or README change is owned by any task (AC-16).