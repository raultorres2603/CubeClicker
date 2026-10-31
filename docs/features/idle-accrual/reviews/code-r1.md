---
feature: idle-accrual
phase: code
iteration: 1
verdict: changes_requested
blocking: 1
nonblocking: 2
---

# Code Review — r1

## Summary

❌ changes requested — implementation matches the spec and all gates (lint/typecheck/tests/coverage/build/containers) are green, but one MAJOR real-Postgres defect breaks the CAS eligibility contract on migrated rows, plus two MINOR items. Fix F1 before acceptance.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 — `last_seen_at` column | ✅ | `src/backend/src/db/migrations/004_idle_accrual.sql:6-9`; `src/backend/src/db/schema.sql:49`; nullable→backfill→NOT NULL + DEFAULT. Note: F1 precision mismatch affects migrated rows. |
| AC-2 — Accrual on join (accounts) | ✅ | `src/backend/src/app.test.ts` idle-accrual integration tests (post-accrual `welcome.economy`); `src/backend/src/game/hub.test.ts`. |
| AC-3 — No accrual for short gaps | ✅ | `src/backend/src/app.test.ts` "account join with recent last_seen_at does not accrue"; `idleCoins` returns 0 below threshold (`economy.test.ts:106-109`). |
| AC-4 — Cap | ✅ | `src/backend/src/game/economy.test.ts:128-133` (`idleCoins(IDLE_CAP_MS + x) === idleCoins(IDLE_CAP_MS)`); hub tests. |
| AC-5 — Server authority | ✅ | `src/backend/src/game/hub.ts:530-547` (clock + stored timestamp only; no client field read). |
| AC-6 — Idle rate helper | ✅ | `src/backend/src/game/economy.test.ts:104-144` (below-threshold 0, clamping, rounding). |
| AC-7 — Upgrades interaction | ✅ | `src/backend/src/game/economy.test.ts:95-100` (`idleMultiplier === miniCubeMultiplier`). |
| AC-8 — Level independence | ✅ | `src/backend/src/game/economy.test.ts:136-144` (level not a parameter). |
| AC-9 — Coins only | ✅ | `src/backend/src/game/hub.test.ts` idle-accrual cases assert clicks/faces/cubes unchanged. |
| AC-10 — Guests | ✅ | `src/backend/src/game/hub.test.ts` guest join: no DB write, no accrual, no broadcast; `welcome.economy` zeros. |
| AC-11 — Touch on join | ✅ | `src/backend/src/auth/economy-repository.test.ts` (touchLastSeen CAS win); `hub.test.ts`; `app.test.ts` asserts `findLastSeenAt === now`. |
| AC-12 — Touch on final disconnect | ✅ | `src/backend/src/game/hub.ts:445-458` (unconditional touch when no other active connection). |
| AC-13 — Grace expiry | ✅ | `src/backend/src/game/hub.ts:390-404` (expiry calls `removeMember`, no touch); hub tests. |
| AC-14 — Rejoin within grace | ✅ | `src/backend/src/game/hub.ts:585-628` (`handleRejoin` never touches `last_seen_at`). |
| AC-15 — Broadcast after accrual | ✅ | `src/backend/src/game/hub.ts:571-579` (`broadcastEconomyUpdate`); `app.test.ts` receives `economyUpdate` before `welcome`. |
| AC-16 — Reconnect reconciles | ✅ | `src/backend/src/app.test.ts` + existing `session.test.ts` economy adoption. |
| AC-17 — No containerization impact | ✅ | Container diff gate empty (`git diff` on compose/Dockerfiles exit 0); only migration + schema mirror. |
| AC-18 — Coverage gate | ✅ | `npm run coverage` exit 0 — backend 94.97% stmts / 86.19% branch / 99.65% funcs / 94.97% lines; frontend 95.19% / 95.10% / 96.89% / 95.19%. |
| AC-19 — Atomic eligibility (CAS) | ✅ (tests) | `src/backend/src/auth/economy-repository.ts:301-333` (`touchLastSeen` CAS); repo tests win/lose; hub tests race. Caveat: F1 real-Postgres precision mismatch. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MAJOR | `src/backend/src/auth/economy-repository.ts:301-333` (Pg `touchLastSeen`) | Pg CAS compares `last_seen_at = to_timestamp($3 / 1000.0)`. Migrated rows store `last_seen_at = now()` (microsecond precision from Postgres), but the value read back is truncated to whole milliseconds, so the re-encoded `to_timestamp(ms/1000.0)` never equals the stored timestamp. CAS therefore fails for migrated rows (and any non-ms-aligned timestamp), so accrual is never credited and `last_seen_at` is never advanced on join until an unconditional disconnect touch occurs. Breaks AC-19's contract and the "no retroactive accrual on deploy" intent in practice. | Align precision: compare on a normalized (millisecond) basis, e.g. store/compare `to_timestamp(floor($3/1000.0)*1000/1000.0)` consistently, or change the CAS predicate to `floor(extract(epoch from last_seen_at) * 1000) = $3` and write `to_timestamp($2/1000.0)` only. Add a regression test that seeds a microsecond-precision timestamp and asserts CAS success. | open |
| F2 | MINOR | `src/backend/src/auth/economy-repository.ts:53-55,72-76,166-168,216-221` | Both repository implementations accept a `now` option (`InMemoryEconomyRepositoryOptions.now`, `PgEconomyRepositoryOptions.now`) and store it as `this.now`, but `this.now` is never invoked — `touchLastSeen` receives `nowMs` explicitly. Dead configuration surface that misleads callers into thinking the clock is used. | Remove the unused `now` option (and the `this.now` field) from both implementations and update callers/tests, or document why it is retained. | open |
| F3 | MINOR | `src/backend/src/game/hub.ts:860-862` | `handleJoin` is `async` but is invoked as `handleJoin(connection, message.mode)` without `void`/`.catch()` in `handleMessage`. Any rejection from `findByUserId`/`findUpgradesByUserId`/`findLastSeenAt`/`touchLastSeen`/`credit` becomes an unhandled promise rejection. | Invoke as `void handleJoin(connection, message.mode).catch((err) => { /* log */ })` (or wrap the body in try/catch) to guarantee no unhandled rejection. | open |
| F4 | INFO | `src/backend/src/app.ts:262` | `/ws` route sends `helloMessage()` using the default wall-clock `new Date()` instead of the injected `nowFn`, so the hello timestamp is not deterministic under a fake clock. Cosmetic/testability only; no protocol impact. | Pass `nowFn` to `helloMessage(nowFn())`-equivalent (or accept the default). Optional. | open |
| F5 | INFO | build log / verification | Documentation and containerization passes verified: `git status --porcelain -- README.md docs/architecture` empty, container diff gate empty, coverage exclusions limited to `server.ts`/`main.tsx` composition roots. No action required. | None. | open |

## Verification performed

- `npm run lint` → exit 0 (no errors).
- `npm run typecheck` → exit 0 (both workspaces: `tsc --noEmit`).
- `npm test` → backend: Test Files 21 passed, Tests 630 passed; frontend: Test Files 44 passed, Tests 1099 passed.
- `npm run coverage` → exit 0. Backend All files: 94.97% stmts / 86.19% branch / 99.65% funcs / 94.97% lines. Frontend All files: 95.19% stmts / 95.10% branch / 96.89% funcs / 95.19% lines. Thresholds ≥ 80% met in both workspaces.
- `npm run build` → exit 0 (backend tsc; frontend vite build OK).
- Container diff gate: `git diff --exit-code HEAD -- compose.yaml compose.smoke.yaml ...Dockerfile` → exit 0; `git status --porcelain` on those paths empty.
- Doc gate: `git status --porcelain -- README.md docs/architecture` → empty.
- Coverage exclusions inspected: only `src/server.ts` (backend) and `src/main.tsx` (frontend) plus test files and Vitest defaults — matches the spec's justified list; no production logic excluded.
- Banned-matcher spot check: no `expect.any`/`objectContaining`/snapshot-only/assertion-free tests in the changed idle-accrual tests; `not.toHaveBeenCalled()` used only as negative spy assertions.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | Parameterized SQL only; no client input influences `last_seen_at`/elapsed; no secrets; `localStorage`/IndexedDB not touched; container secrets unchanged. |
| Quality | ✅ (with F1) | Pure logic separated; single clock; edge cases (zero/negative/huge deltas) covered. F1 is a real-world correctness defect. |
| Testing | ✅ | Coverage ≥ 80% both workspaces; concrete assertions; deterministic (injected clock); edge cases exercised. |

## Previous round verification (iteration 1)

n/a — first code review round. Spec review r2 was approved (0 blocking) prior to build.

## Notes / backlog (non-blocking)

- F4/F5 are INFO and do not block acceptance; F1 must be fixed and re-reviewed.
- Idle constants remain approval-gated per spec (Q-1..Q-5); no deviations observed.