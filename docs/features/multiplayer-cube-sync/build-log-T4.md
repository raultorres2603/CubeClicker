# Build log — T4 — Frontend reducer: store orientation + `cubeRotated` + `stateSync`

Task: T4 (2026-10-23)
Files changed: `src/frontend/src/multiplayer/server-state.ts`, `src/frontend/src/multiplayer/server-state.test.ts`

## What changed & why
Adopted remote orientation in the world-state reducer: `CubeState`/`MemberState` orientation (`yawSteps`/`pitchSteps`) flows through `copyCube`/`copyMember` spreads, `createWorldState` seeds identity, `welcome`/`worldEntered`/`memberJoined` carry it, `withAdvanced` resets to identity, `withSync` adopts server values, and a new `withRotated` handles `cubeRotated` for self (defensive) and members, no-op for unknown/unchanged. Added 9 tests covering cubeRotated (4) and orientation sync (5); existing fixtures updated with orientation fields.

## Decisions
- `copyCube`/`copyMember` now spread the cube/member so orientation is preserved automatically; only `removedIds` (and `position`) are re-copied.
- `withRotated` returns the same state reference when nothing changes (self identical or unknown member), preserving the React referential-stability contract.
- `withSync` adopts both `yawSteps` and `pitchSteps` from the authoritative board.

## Evidence

### `npm run lint`
```
> lint
> eslint .
```
(exit 0, no output)

### `npm run typecheck --workspace @cubeclicker/frontend`
```
src/App.test.tsx(72,3): error TS2739: ... MemberState missing yawSteps, pitchSteps
src/App.test.tsx(99,7): error TS2739: ... CubeState missing yawSteps, pitchSteps
src/game/session.test.ts(642,3): error TS2322: yawSteps/pitchSteps incompatible
src/game/session.test.ts(687,5): error TS2739: ... CubeState missing yawSteps, pitchSteps
src/game/session.test.ts(717,5): error TS2739: ... CubeState missing yawSteps, pitchSteps
src/game/session.test.ts(741,3): error TS2322: yawSteps/pitchSteps incompatible
src/multiplayer/transport.test.ts(114,5): error TS2739: ... CubeState missing yawSteps, pitchSteps
src/multiplayer/transport.test.ts(115,14): error TS2739: ... MemberState missing yawSteps, pitchSteps
src/render/scene.test.ts(140,3): error TS2322: yawSteps/pitchSteps incompatible
src/ui/UserPanel.test.tsx(14,3): error TS2739: ... MemberState missing yawSteps, pitchSteps
```
(exit 2). No errors in `server-state.ts` or `server-state.test.ts`; remaining errors are in unowned files (`App.test.tsx`, `session.test.ts`, `transport.test.ts`, `scene.test.ts`, `UserPanel.test.tsx`) pending T4/T7-owned fixture touch-ups per T3/T5 precedent — not fixed (out of scope).

### `npm test --workspace @cubeclicker/frontend`
```
Test Files  2 failed | 26 passed (28)
Tests  4 failed | 638 passed (642)
```
Failures are in unowned files only: `src/game/session.test.ts` (2) and `src/multiplayer/transport.test.ts` (2). `src/multiplayer/server-state.test.ts`: 40 passed.
(exit 1)

### `npm run coverage --workspace @cubeclicker/frontend`
```
Test Files  2 failed | 26 passed (28)
Tests  4 failed | 638 passed (642)
```
(exit 1). Reducer-file coverage (isolated, `--coverage.include='src/multiplayer/server-state.ts'`):

| File | % Stmts | % Branch | % Funcs | % Lines | Uncovered |
|------|---------|----------|---------|---------|-----------|
| server-state.ts | 98.22 | 95.12 | 100 | 98.22 | 113-114, 293, 295-296 |

All above the 80% gate.

## New/changed test names
- `reduceWorldState — cubeRotated`:
  - updates a remote member’s orientation
  - updates the own cube orientation defensively
  - is a no-op for an unknown member
  - is a no-op when the orientation is unchanged
- `reduceWorldState — orientation sync`:
  - stores orientation from welcome
  - stores orientation from memberJoined
  - adopts orientation from stateSync for self
  - adopts orientation from stateSync for a member
  - resets orientation to identity on levelAdvanced

## Acceptance audit
- AC-5 (reducer half) → met: orientation carried in welcome/memberJoined/stateSync/cubeRotated and stored in `self.cube`/member.
- AC-8 → met: `withRotated` updates remote member orientation; unknown member no-op.
- AC-9 (frontend half) → met: `withSync` adopts authoritative orientation for self/member.
- AC-14 → met: `withAdvanced` resets orientation to identity on level change.

## Deviations from spec: none.

## Open questions: none.
