# Build log — T5 — Expired verification cleanup scheduler and PostgreSQL proof

Task: T5 (2026-11-24)
Files changed: `src/backend/src/db/verification-cleanup.ts`, `src/backend/src/db/verification-cleanup.test.ts`, `src/backend/src/db/verification-cleanup-postgres.test.ts`
What changed & why: new in-process `createVerificationCleanupScheduler` that runs `PgVerificationTokenRepository.deleteExpired(now)` once immediately after `start()`, then `intervalMs` after each run settles via a recursive `unref()`ed `setTimeout`; an in-flight guard makes a direct `runOnce()` skip with `db_verification_cleanup_skipped { reason: 'in_flight' }`; failures are non-fatal (`db_verification_cleanup_failed`) and still schedule the next interval; `stop()` clears the pending timer and awaits an in-flight run. A unit suite (fake timers + recording sink) and a real-`postgres:16-alpine` suite prove the cadence, events, overlap guard, failure isolation, expired-only deletion, account/session preservation and concurrent idempotence.

## Decisions
- **Recursive timer after settlement, one scheduling owner.** `start()` schedules `runOnce` at 0 ms; the timer callback (`tick`) runs one attempt and only schedules the next timer after the attempt settles, so a run taking `D` ms shifts the following tick by `D` and the timer itself can never overlap a run. Direct `runOnce()` calls never schedule; the timer chain is the only scheduler. A duplicate `start()` returns before creating a second chain.
- **In-flight guard is a promise, not a boolean.** `inFlight` holds the pending `execute()` promise; a second `runOnce()` while it is non-null logs `db_verification_cleanup_skipped { reason: 'in_flight' }` at `debug` and resolves `0` without calling `deleteExpired`. The pending run's own completion schedules the next interval.
- **`runOnce()` is usable before/without `start()`.** The timer callback checks `started` (defensive against a callback that escapes `clearTimeout`), while the public `runOnce()` only guards in-flight runs. This keeps the one-shot seam the Postgres and AC-19 tests use, and matches plan step 2's "(when invoked by a timer)" parenthetical.
- **One clock read for the predicate and the duration start.** `execute()` calls `now()` once, passes that instant to `deleteExpired(ts)`, and computes `durationMs` from a second `now()` read; the default clock is `Date.now`, the default timers are the globals. `deleteExpired` failures emit only `{ errorType, code? }` (message/stack dropped) and return `0` without a `db_verification_cleanup_run` event (AC-18's failure event is the run's trace).
- **`unref()` is capability-guarded.** `(handle as { unref?: () => void }).unref?.()` keeps Node from holding the process open while leaving hand-driven test handles valid; a unit test drives a manual timer seam and asserts the unref/clear calls.
- **No wiring, config, container, docs or dependency changes.** T8 owns `server.ts`/shutdown wiring and T10 owns the README/observability docs; T5 only ships the module and its proofs. `package.json`/`package-lock.json` untouched, no new dependency. `.env*` untouched (manual boundary; no task-owned edit).

## Evidence

All commands run from the repository root on 2026-11-24. Real-Postgres suites **ran** (they are not self-skipped): a container runtime was detected and `verification-cleanup-postgres.test.ts` completed in ~2.7 s inside the coverage run.

### `npm run lint` → exit 0

```text

> lint
> eslint .

LINT_EXIT:0
```

### `npm run typecheck` → exit 0

```text

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT:0
```

### `npm run test --workspace @cubeclicker/backend -- src/db/verification-cleanup.test.ts src/db/verification-cleanup-postgres.test.ts --reporter=verbose` → exit 0

```text

> test
> vitest run src/db/verification-cleanup.test.ts src/db/verification-cleanup-postgres.test.ts --reporter=verbose


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/db/verification-cleanup.test.ts > createVerificationCleanupScheduler — cadence and events (AC-15) > runs immediately then at each interval, logging zero deletes at debug, and stops 5ms
 ✓ src/db/verification-cleanup.test.ts > createVerificationCleanupScheduler — cadence and events (AC-15) > logs a positive delete at info and uses the injected clock 1ms
 ✓ src/db/verification-cleanup.test.ts > createVerificationCleanupScheduler — cadence and events (AC-15) > schedules the next run intervalMs after a slow run settles 2ms
 ✓ src/db/verification-cleanup.test.ts > createVerificationCleanupScheduler — cadence and events (AC-15) > starts one chain for a duplicate start and logs stopped once for a duplicate stop 1ms
 ✓ src/db/verification-cleanup.test.ts > createVerificationCleanupScheduler — failure isolation (AC-18) > logs the failure, resolves 0 and keeps scheduling the next interval 1ms
 ✓ src/db/verification-cleanup.test.ts > createVerificationCleanupScheduler — failure isolation (AC-18) > carries only errorType and an optional string code 0ms
 ✓ src/db/verification-cleanup.test.ts > createVerificationCleanupScheduler — overlap guard and stop (AC-19) > skips a second direct run while the first direct run is still pending 0ms
 ✓ src/db/verification-cleanup.test.ts > createVerificationCleanupScheduler — overlap guard and stop (AC-19) > skips a direct run while a timer run is in flight and schedules from the pending run 0ms
 ✓ src/db/verification-cleanup.test.ts > createVerificationCleanupScheduler — overlap guard and stop (AC-19) > stop awaits an in-flight run, clears the next timer and schedules nothing afterwards 0ms
 ✓ src/db/verification-cleanup.test.ts > createVerificationCleanupScheduler — overlap guard and stop (AC-19) > unrefs each handle, clears the pending timer on stop and ignores a stale callback 1ms
 ✓ src/db/verification-cleanup-postgres.test.ts > expired verification cleanup on PostgreSQL > deletes only the expired row, preserving accounts, sessions and the used token 25ms
 ✓ src/db/verification-cleanup-postgres.test.ts > expired verification cleanup on PostgreSQL > deletes each expired row exactly once across two concurrent runs, then reports zero 20ms

 Test Files  2 passed (2)
      Tests  12 passed (12)
   Start at  09:24:24
   Duration  2.67s (transform 68ms, setup 0ms, collect 205ms, tests 2.32s, environment 0ms, prepare 120ms)

TEST_EXIT:0
```

The Postgres file is counted as **2 passed tests**, not skipped: the suite's `dbDescribe` selected `describe` because Podman/Docker `info` succeeded.

### `npm run coverage --workspace @cubeclicker/backend` → exit 0

The full run reported 48 test files / 1888 tests passing (the per-test-file `✓` listing is elided here; both cleanup files and both real-Postgres suites ran). Coverage tail (rows as printed; trailing padding trimmed):

```text
 Test Files  48 passed (48)
      Tests  1888 passed (1888)
   Start at  09:24:30
   Duration  4.06s (transform 6.00s, setup 0ms, collect 15.96s, tests 22.07s, environment 11ms, prepare 4.88s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.74 |    90.97 |   99.62 |   96.74 |
 src               |   96.72 |    91.45 |     100 |   96.72 |
  app.ts           |   95.74 |     88.5 |     100 |   95.74 | ...18-319,367-369
  cors.ts          |     100 |      100 |     100 |     100 |
 src/auth          |   96.17 |     83.6 |     100 |   96.17 |
  auth-routes.ts   |    81.4 |     55.3 |     100 |    81.4 | ...61-363,369-370
  auth-service.ts  |     100 |    81.87 |     100 |     100 | ...97,402,419,507
  config.ts        |     100 |      100 |     100 |     100 |
  ...repository.ts |   95.74 |     86.2 |     100 |   95.74 | ...77-778,834-847
  email-cli.ts     |    98.3 |    80.55 |     100 |    98.3 | 176-177
  ...l-template.ts |     100 |      100 |     100 |     100 |
  email.ts         |     100 |      100 |     100 |     100 |
  password.ts      |     100 |      100 |     100 |     100 |
  rate-limit.ts    |     100 |      100 |     100 |     100 |
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 | ...40-141,146-147
  ...repository.ts |    98.8 |    90.58 |     100 |    98.8 | 61-62,315
  ...repository.ts |   97.29 |    90.62 |     100 |   97.29 | 63-68
 src/db            |   99.06 |    96.15 |     100 |   99.06 |
  ...cle-config.ts |     100 |      100 |     100 |     100 |
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 | 82-83
  ...ate-runner.ts |    97.1 |       96 |     100 |    97.1 | 107-108
  migrate.ts       |     100 |      100 |     100 |     100 |
  pool.ts          |     100 |      100 |     100 |     100 |
  ...a-contract.ts |     100 |      100 |     100 |     100 |
  ...on-cleanup.ts |     100 |      100 |     100 |     100 |
 src/deploy        |   98.09 |    98.75 |     100 |   98.09 |
  ...er-env-cli.ts |      95 |    96.15 |     100 |      95 | 160-164
  render-env.ts    |     100 |      100 |     100 |     100 |
 src/game          |   96.25 |    94.92 |   99.13 |   96.25 |
  activity.ts      |     100 |      100 |     100 |     100 |
  broadcast.ts     |   97.12 |    95.65 |     100 |   97.12 | 137-138,231-232
  config.ts        |     100 |      100 |     100 |     100 |
  cubes.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  hub.ts           |   91.36 |    89.09 |   98.59 |   91.36 | ...1833,1920-1923
  leaderboard.ts   |     100 |      100 |     100 |     100 |
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts-v3.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  players.ts       |     100 |      100 |     100 |     100 |
  protocol.ts      |   99.36 |     99.2 |   97.77 |   99.36 | 477-478,1088-1089
  servers.ts       |   99.01 |    98.71 |     100 |   99.01 | 289-290
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
 src/observability |   99.67 |    96.64 |     100 |   99.67 |
  config.ts        |     100 |      100 |     100 |     100 |
  db-metrics.ts    |     100 |      100 |     100 |     100 |
  logging.ts       |     100 |      100 |     100 |     100 |
  metrics-route.ts |     100 |      100 |     100 |     100 |
  metrics.ts       |   99.45 |    93.54 |     100 |   99.45 | 251-252
  shutdown.ts      |     100 |    94.73 |     100 |     100 | 74
-------------------|---------|----------|---------|---------|-------------------
COVERAGE_EXIT:0
```

Workspace aggregates (statements/branches/functions/lines) are 96.74/90.97/99.62/96.74 — all ≥ 80 — and `verification-cleanup.ts` is 100% on all four metrics with no new exclusion.

## Acceptance audit
- **AC-15 → met.** `verification-cleanup.test.ts` "runs immediately then at each interval…": `start()` emits `db_verification_cleanup_started { intervalMs: 3600000 }` at `info`; with fake timers + the default clock the repository is called with `0`, `3_600_000`, `7_200_000`; zero-delete runs emit `db_verification_cleanup_run { deleted: 0, durationMs: 0 }` at `debug` (exact array); the positive-delete test emits the same event with `{ deleted: 2, durationMs: 0 }` at `info`; the slow-run test advances 500 ms while the run is pending and observes `durationMs: 500` with the next call at `INTERVAL + 500`; `stop()` clears the next timer, emits `db_verification_cleanup_stopped {}` exactly once, and no further call happens.
- **AC-16 → met.** `verification-cleanup-postgres.test.ts` seeds a verified and an unverified user, an expired token (`NOW - 1 s`), an unexpired token (`NOW + 1 h`) and a used-unexpired token (`used_at = NOW - 1 s`, `expires_at = NOW + 1 h`); one `runOnce()` returns `1`, emits `db_verification_cleanup_run { deleted: 1, durationMs: 0 }` at `info`, leaves exactly the unexpired + used token rows (the used row keeps its `used_at`), leaves both `users.verified` values and the one `sessions` row unchanged, and the second run returns `0` with a `debug` run event.
- **AC-17 → met.** The Postgres concurrency test inserts three expired rows, asserts `count = 3`, runs two independent schedulers concurrently over the same pool/repository via `Promise.all`, asserts the two resolved deleted counts sum to `3` (each row deleted once), asserts two remaining (unexpired + used) rows, and a subsequent run returns `0`.
- **AC-18 → met.** Failure test: `deleteExpired` rejecting with `new Error('cleanup boom')` emits `db_verification_cleanup_failed { errorType: 'Error' }` at `error`, the attempt is recorded once, and the next interval still fires a second failing attempt. The coded test asserts `{ errorType: 'Error', code: '23514' }`; a non-Error rejection asserts `{ errorType: 'unknown' }`. `runOnce()` resolves `0` in both. No app/route/health file is touched by T5 (`app.test.ts`/`metrics.ts` untouched).
- **AC-19 → met.** Direct-overlap test: a second `runOnce()` while the first direct `runOnce()` is pending resolves `0`, calls `deleteExpired` once, and emits `db_verification_cleanup_skipped { reason: 'in_flight' }` at `debug`; after the deferred run settles it emits its run event. The timer variant proves the pending timer run (not the skipped call) schedules the next tick. Duplicate `start()` produces one started event/one chain; duplicate `stop()` produces one stopped event. `stop()` awaits a deferred in-flight run (`settled` stays false until the gate resolves) and no run follows.
- **AC-23 → met.** Every event assertion is an exact `toEqual` on `{ level, event, fields }`; the failure events carry only `errorType` and the optional string `code` (the thrown message `cleanup boom` / `constraint violation` never appears in a field). The Postgres test asserts the same exact run field set. No SQL, email, token hash, row data or error message/stack is logged by the module.

## Deviations from spec
- None. The integration tier is present and ran against a real throwaway `postgres:16-alpine` (not self-skipped). `docs/features/README.md`, `tasks.md`, `status.md`, `observability/shutdown.ts`, compose/render files, shared config and `.env*` were not touched (T8/T10 own wiring and documentation; this task changes no user-facing behavior/config yet).
