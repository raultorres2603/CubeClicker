# Build log — T7 — Shutdown `beforeClose` hook

Task: T7 (2026-11-24)
Feature: db-schema-bootstrap-and-expiry-cleanup
Files changed:
- `src/backend/src/observability/shutdown.ts`
- `src/backend/src/observability/shutdown-before-close.test.ts`
- `docs/features/db-schema-bootstrap-and-expiry-cleanup/build-log-T7.md`

Sketch (≤5 lines):
- Add optional `beforeClose?: () => void | Promise<void>` to `InstallShutdownHandlersOptions`.
- In the existing once-only signal path, after the start log + counter, await the hook, then `app.close()`.
- Normalize a synchronous hook throw into a rejection; route hook and close failures into the existing `shutdown_failed` + exit `1` handler.
- With no hook, keep the current immediate `app.close()` call path.
- New `shutdown-before-close.test.ts` pins ordering, once-only behavior and rejection handling with exact entries.

What changed & why:
- `InstallShutdownHandlersOptions` gains the optional `beforeClose` hook (AC-20). On the first signal the handler logs `shutdown_started`, increments `cubeclicker_shutdown_total{signal}`, awaits `beforeClose` when supplied, calls `app.close()`, logs `shutdown_complete` and exits `0`.
- A hook rejection (or synchronous throw) is routed by the unchanged once-only chain into `shutdown_failed { signal, errorType }` + exit `1`; `app.close()` is not called in that branch. A close failure after a successful hook is reported the same way as before.
- The once-only `closing` guard is untouched, so the hook runs exactly once and later signals (while pending or after completion) are inert.
- Without `beforeClose`, `app.close()` is still invoked synchronously inside `settle`, so the pre-existing behavior and `shutdown.test.ts` (T1-owned, unedited) are unchanged.
- No new event, field, metric, level or import; `shutdown.ts` still uses only the `LogSink`/`Metrics` types.

Decisions:
- The hook is awaited through a small `settle(step)` helper that converts a synchronous throw into a rejection, so the hook and the close share one failure path (`shutdown_failed`). With a hook, `app.close()` runs in a `.then` continuation after the hook settles; without one, `close()` stays synchronous (the existing `shutdown.test.ts` asserts `closeCalls === 1` immediately after emitting the signals).
- Test tiers: the unit tier drives the real `installShutdownHandlers` over an injected fake process (`on`/`exit`), a fake app and a recording `LogSink`, including a deferred hook promise to pin start→await→close→complete ordering. The real `Metrics` registry is used (no metric stub) and its rendered text is asserted. Documented exception for the integration tier: this helper's only integration boundary is the OS signal handler plus Fastify's `close()`, and installing real `SIGTERM` handlers in Vitest would risk terminating the test runner; the server↔shutdown wiring is T8's `server.test.ts` (out of this task's scope) and the containerized smoke exercises the real process path. There is no additional in-process boundary this task can exercise.
- No test was added for the no-hook path: T1-owned `shutdown.test.ts` already pins it (7 tests, unchanged and green), and a duplicate would be a useless test.
- `docs/architecture/observability.md` and the deployment docs are T10-owned; this change adds no event or configuration, so the doc pass there records the wiring, not this task.
- Shared-index race: the parallel T2 builder staged its untracked `schema-contract*` files while this task was committing, so the first commit attempt swept them in. It was reset immediately and the final commit contains exactly this task's three paths; the T2 files are back to their pre-existing unstaged/untracked state for T2's own commit.

Evidence:

- `npm run lint` → exit 0
```
> lint
> eslint .

lint exit=0
```

- `npm run typecheck` → exit 0 (both workspaces)
```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

typecheck exit=0
```

- `npm run test --workspace @cubeclicker/backend -- src/observability/shutdown.test.ts src/observability/shutdown-before-close.test.ts` → exit 0 (12 tests: 7 existing + 5 new)
```
> test
> vitest run src/observability/shutdown.test.ts src/observability/shutdown-before-close.test.ts

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/observability/shutdown-before-close.test.ts (5 tests) 6ms
 ✓ src/observability/shutdown.test.ts (7 tests) 7ms

 Test Files  2 passed (2)
      Tests  12 passed (12)
   Start at  09:20:29
   Duration  269ms (transform 58ms, setup 0ms, collect 91ms, tests 13ms, environment 0ms, prepare 96ms)

tests exit=0
```

- `npm run coverage --workspace @cubeclicker/backend` → exit 0 (thresholds ≥ 80 statements/branches/functions/lines; exit 0 is the gate pass)
```
 Test Files  46 passed (46)
      Tests  1876 passed (1876)
All files          |    96.7 |    90.89 |   99.62 |    96.7 |
 src/observability |   99.67 |    96.64 |     100 |   99.67 |
  shutdown.ts      |     100 |    94.73 |     100 |     100 | 74
```
  The uncovered branch/line is the pre-existing default `options.process ?? process` fallback (line 74), which tests never take because they inject a process. `shutdown.ts` is 100% statements/functions/lines and 94.73% branches, above the 80 gate.
  Note: the parallel T2 worker's untracked `src/backend/src/db/schema-contract*.ts` files were present in the working tree during this run, so the all-files coverage run included them (they pass, 100% for `schema-contract.ts`). This task staged none of them.

- Diff scope (`git diff --stat` for the owned source file + the new test file):
```
 src/backend/src/observability/shutdown.ts | 50 ++++++++++++++++++++-----------
 1 file changed, 33 insertions(+), 17 deletions(-)
```
  plus the new untracked `shutdown-before-close.test.ts` (283 lines, 5 tests).

Acceptance audit:
- AC-20 → met:
  - Ordering: `shutdown-before-close.test.ts` test 1 installs `beforeClose` returning a deferred promise; before release the hook has recorded `beforeClose:start`, `shutdown_started { signal: 'SIGTERM' }` is the only log entry and `cubeclicker_shutdown_total{signal="SIGTERM"} 1` is rendered; after release the recorded order is exactly `['beforeClose:start', 'beforeClose:end', 'app.close']`, the log entries are exactly `shutdown_started` then `shutdown_complete`, and the process exits `0`.
  - Rejection: test 3 (`Promise.reject` with `name = 'CleanupError'`) asserts exit `1`, `closeCalls === 0` and the exact entries `shutdown_started` then `shutdown_failed { signal: 'SIGTERM', errorType: 'CleanupError' }`; test 4 pins a synchronous throw (`errorType: 'Error'`) with the same no-close behavior; test 5 proves a close failure after a successful hook still logs `shutdown_failed` and exits `1`.
  - Once-only: test 2 emits `SIGTERM`, `SIGINT`, `SIGTERM` while the hook is pending and asserts one hook call, zero close calls, one `shutdown_started`, one counter increment; after completion and a late `SIGINT` it asserts one hook call, one close call, `['beforeClose', 'app.close']`, `proc.exits` `[0]`, and exactly two log entries.
  - No `beforeClose`: the existing T1-owned `shutdown.test.ts` (7 tests) is unedited and green, proving the original close/exit behavior is unchanged.
- Unit tier: real helper with injected fakes and real `Metrics` registry. Integration tier: documented exception above (OS signal + Fastify close boundary cannot be exercised in-process; T8 `server.test.ts` covers the wiring).

Deviations from spec: none.

Out-of-scope confirmation: `shutdown.test.ts`, `src/backend/src/db/verification-cleanup.*`, `tasks.md`, `status.md`, `docs/features/README.md`, `.env*`, compose/render files and shared config were not modified or staged by this task. Only the two owned paths above and this build log are committed.
