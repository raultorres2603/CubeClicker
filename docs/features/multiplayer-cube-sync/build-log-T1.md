# Build log — T1 — Backend protocol: orientation fields + `rotate`/`cubeRotated` + `stateSync` orientation

Task: T1 (2026-10-23)
Files changed: src/backend/src/game/protocol.ts, src/backend/src/game/protocol.test.ts

What changed & why: Added `yawSteps`/`pitchSteps` to wire `CubeState`/`MemberState`/`CubeSync`; added `rotate` to `ClientMessage` and `cubeRotated` to `ServerMessage`; `parseClientMessage` accepts `rotate` on integer type only (out-of-range accepted, clamped server-side per r2 F1); builders `cubeRotatedMessage`/`rotateMessage`; `stateSyncMessage` carries orientation; defensive copies updated. Added `MAX_STEPS` (= 3, yaw upper bound) and `MAX_ROTATE_BYTES` (= `MAX_MESSAGE_BYTES`).

Decisions:
- Rotate codec validates integer type only (r2 F1 resolution); out-of-range integers accepted and clamped server-side (AC-4). Server-originated range validation (yaw 0..3, pitch -1..1) is the frontend codec's job (T3).
- `MAX_STEPS` default fallback in brief was 8, but spec pins yaw 0..3 / pitch -1..1, so 3 is used and the "8 default" is overridden (open question recorded).
- Builders `cubeRotatedMessage`/`rotateMessage` accept either positional or payload-object form for parity flexibility.
- `MAX_ROTATE_BYTES` reuses the global 1024-byte cap (no separate rotate cap in spec).

Evidence:
- `npm run lint` → exit 0 (no output).
- `npm run typecheck --workspace @cubeclicker/backend` → FAILS on unowned `src/backend/src/game/hub.ts` (T2 owns it): missing `yawSteps`/`pitchSteps` in `cubeState()`/`memberState()` and `.level` access on the new `rotate` variant. Expected to be resolved by T2; protocol.ts itself typechecks.
- `npm test --workspace @cubeclicker/backend` → 7 test files, 200 tests passed (protocol.test.ts 68 tests).
- `npm run coverage --workspace @cubeclicker/backend` → All files 98.58% stmts / 97.33% branches / 100% funcs / 98.58% lines; protocol.ts 100% all four metrics. Thresholds (≥ 80) met.

Acceptance audit:
- AC-2 (orientation on wire): met — `CubeState`/`MemberState` gain `yawSteps`/`pitchSteps`; codec matrix in protocol.test.ts (backend builds trusted data; frontend T3 validates range).
- AC-3 (rotate): met — `parseClientMessage` accepts integer rotate, rejects non-integer/missing/wrong types; out-of-range accepted.
- AC-5 (codec half): met — `cubeRotated` added to `ServerMessage`; `cubeRotatedMessage` builder; `encodeServerMessage` serialises it.
- AC-13 (wire): met — `CubeSync` gains `yawSteps`/`pitchSteps`; `stateSyncMessage` carries them.

Deviations from spec: none functional. Typecheck failure confined to unowned hub.ts (T2 dependency). `MAX_STEPS` = 3 (spec-derived) overriding brief's 8 fallback, recorded as open.

Open questions: MAX_STEPS value (3 vs brief's 8 default) — spec pins yaw 0..3/pitch -1..1, so 3 used; recorded as open per brief. hub.ts typecheck pending T2.