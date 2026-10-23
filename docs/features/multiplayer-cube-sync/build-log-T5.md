# Build log — T5 — Frontend engine: adopt orientation in `adoptCubeState`

Task: T5 (2026-10-23)
Files changed: `src/frontend/src/game/engine.ts`, `src/frontend/src/game/engine.test.ts`, `docs/features/multiplayer-cube-sync/build-log-T5.md`

What changed & why: Extended `AuthoritativeCubeState` with optional `yawSteps`/`pitchSteps` (default identity). `adoptCubeState` now adopts them as the settled orientation (`orientation = { yawSteps, pitchSteps }`, `rotationFrom = null`, `rotationElapsedMs = 0`, `queuedStep = null`) on both the same-cube correction path and the rebuild path, invalidating the snapshot when the orientation or in-flight rotation changes. Idempotent: a repeated identical adoption changes nothing and emits no intents.

Decisions: Fields made optional so the not-yet-updated `session.ts` (T7) still typechecks; T7 will pass the server values through. Orientation change invalidates the cached snapshot but emits no new effect intent (no orientation intent exists in `EffectIntent`).

Evidence:
- `npx eslint src/frontend/src/game/engine.ts src/frontend/src/game/engine.test.ts` → (no output, 0 errors)
- `npm test --workspace @cubeclicker/frontend -- --run src/game/engine.test.ts` → Test Files 1 passed, Tests 71 passed
- `npm run typecheck --workspace @cubeclicker/frontend` → no errors in `engine.ts`/`engine.test.ts` (remaining errors are in T4/T6-owned files: `server-state.ts`, `world.ts`, `scene.test.ts`, `transport.test.ts`, `UserPanel.test.tsx`, due to the in-progress protocol fields)
- `cd src/frontend && npx vitest run --coverage --coverage.include='src/game/engine.ts' src/game/engine.test.ts` → engine.ts 99.66% stmts, 98.59% branches, 100% funcs, 99.66% lines

Acceptance audit: AC-13 → met (engine.test.ts: same-cube correction adopts non-zero orientation settled with rotationFrom null; different-level rebuild adopts orientation; idempotent identical adoption; stats never rolled back).
Deviations from spec: none.