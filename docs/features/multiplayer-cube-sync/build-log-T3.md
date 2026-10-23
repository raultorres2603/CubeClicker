# Build log — T3 — Frontend protocol mirror + parity

Task: T3 (2026-10-23)
Files changed: src/frontend/src/multiplayer/protocol.ts, src/frontend/src/multiplayer/protocol.test.ts
What changed & why: Mirrored backend catalog: added `MAX_STEPS` (=3), `MAX_ROTATE_BYTES`, `yawSteps`/`pitchSteps` to `CubeState`/`MemberState`, `rotate` client message, `cubeRotated` server message, orientation on `stateSync`, `CubeSync` interface, range validation in `parseCubeState`/`parseMemberState`/`cubeRotated`, `rotate` integer-only codec, builders `rotateMessage`/`cubeRotatedMessage`/`stateSyncMessage`, `encodeServerMessage`. Updated parity fixtures (orientation fields).
Decisions: Range validation (0..MAX_STEPS / -1..1) applies to server-originated fields; `rotate` codec validates integer type only (out-of-range accepted, clamped server-side) per r2 F1. `MAX_STEPS` = 3 per spec. Builders added for parity.
Evidence:
- `npm run lint` → exit 0 (no output).
- `npm run typecheck --workspace @cubeclicker/frontend` → fails on unowned consumers (world.ts, server-state.test.ts, transport.test.ts, session.test.ts, etc.) pending T4/T5/T6 field touch-ups; protocol.ts itself typechecks.
- `npm test --workspace @cubeclicker/frontend` → 28 files: 24 passed, 4 failed (server-state.test.ts, transport.test.ts, session.test.ts) due to un-updated fixtures in unowned tests; protocol.test.ts 112 passed.
- `npm run coverage --workspace @cubeclicker/frontend` → protocol.ts 100% statements/branches/functions/lines; workspace gate blocked by the 4 failing unowned tests.
Acceptance audit:
- AC-2 → met (orientation fields + range validation in protocol.ts)
- AC-3 → met (rotate codec integer-only, round-trips)
- AC-5 (codec half) → met (cubeRotated decode + range validation)
Deviations from spec: none functional. Unowned consumer typecheck/test failures pending later tasks (T4/T5/T6), recorded per T1 precedent.