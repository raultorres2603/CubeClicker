# Build log — T2 — Backend activity TTL

Task: T2 — Backend activity TTL (2026-11-16)
Files changed: `src/backend/src/game/activity.ts`, `src/backend/src/game/activity.test.ts`, `docs/features/presence-and-activity-liveness/build-log-T2.md`
What changed & why: `createActivityFeed` gained a `ttlMs` option defaulting to `ACTIVITY_EVENT_TTL_MS` (`5000`); `snapshot` returns only events with `now - event.at < ttlMs` and prunes the always-expired tail; `record` prunes the same tail on every access. Pruning touches only `events`, never `nextId`/`lastAcceptedAt`, so ids keep advancing and the 1 s gate is unchanged. The 20-ring, drop-not-queue cadence, copy semantics, `dropServer` and `clear` are untouched.

## Decisions

- **Prune location.** One private `pruneExpired(state, now, ttlMs)` truncates the ring at the first event with `now - event.at >= ttlMs`; the ring is newest-first and `at` is non-decreasing down the array, so the expired set is always a suffix. Both `record` (every access, including a dropped candidate) and `snapshot` call it, per plan § Backend feed ("`record` prunes the expired tail before/after accepting but never changes `nextId` or `lastAcceptedAt`").
- **Boundary.** Fresh iff `now - event.at < 5000`; at exactly 5000 ms the event is expired (spec § Temporal activity contract). The default seam is exercised without passing `ttlMs`, so the test also proves the default wiring.
- **Long-TTL seam.** The pre-existing 20-ring test now passes `ttlMs: 1_000_000` (plan § Risks: "the `ttlMs` seam keeps the 20-ring test meaningful with a long TTL"); its assertions are unchanged in strength.
- **No production timer, no new dependency, no coverage exclusion.**

## Test boundaries pinned

- `ACTIVITY_EVENT_TTL_MS === 5000` and the default `ttlMs` behavior: event accepted at `t = 0` is in `snapshot(1)` at `now = 4999` and absent at `now = 5000`.
- Independent filtering: events at `0/1000/2000`; `snapshot(1)` at `6000` is exactly the `at: 2000` event, and `snapshot` still returns fresh arrays/objects (existing copy test).
- Pruning invariance: 7 acceptances at 0..6000; at `6000` the snapshot is ids `[7,6,5,4,3]` (the `at: 0/1000` tail is pruned); a candidate at `6999` is dropped (window still anchored at `6000`), and at `7000` the next acceptance is `id: 8` — pruning reset neither `nextId` nor `lastAcceptedAt`.
- Default TTL at 24 000: 25 acceptances at 1000 ms intervals; `snapshot(1)` is exactly ids `[25,24,23,22,21]` with `at` `24_000..20_000`; a new acceptance at `25_000` is `id: 26`.
- Long TTL: 25 acceptances at 1000 ms intervals with `ttlMs: 1_000_000` keep exactly ids `[25,24,…,6]` newest first (the accepted `live-activity-feed` AC-10 ring).
- Cadence/drop invariants unchanged: the existing 999/1000 boundary, 0..4500 sequence, cross-type drop, custom options, per-server isolation, `dropServer`/`clear` and no-timer tests are green with the new code.

## Integration-tier exception (documented)

The TTL reaches the wire only through `hub`'s `welcome`/`worldEntered` `activity` placement, whose integration suite is `src/backend/src/game/hub.test.ts` — **T3-owned** (`tasks.md` T3: "welcome TTL filtering"; T2 `files_owned` excludes `hub.ts`/`hub.test.ts`). T2 therefore ships its integration boundary evidence through T3's re-pinned hub tests (AC-13), and cannot add an in-task integration test without an out-of-scope edit. The temporary effect is visible in the backend suite below: five pre-TTL hub expectations are now red and are exactly the assertions T3 must re-pin (superseded `live-activity-feed` AC-10/AC-13 per spec § Supersessions).

## Evidence

### `npm run lint` — exit 0

```text
> lint
> eslint .
```

### `npm run typecheck` — exit 0

```text
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
```

### `npm test --workspace @cubeclicker/backend` — exit 1 (cross-task blocker, see below)

```text
 Test Files  1 failed | 36 passed (37)
      Tests  5 failed | 1520 passed (1525)
   Duration  3.90s (transform 7.29s, setup 0ms, collect 20.06s, tests 14.61s, environment 7ms, prepare 5.36s)
npm error Lifecycle script `test` failed with error:
npm error command failed
npm error command sh -c vitest run
```

All five failures are in `src/backend/src/game/hub.test.ts` (T3-owned) and each asserts the pre-TTL welcome/`worldEntered` placement:

1. `cube completion > merges a lone server-2 member into server 1 when they complete (X = 2, AC-11)` — `hub.test.ts:1282`: expected `worldEntered.activity` to include the `at: 0` `memberJoined`; received only the fresh `memberLeft`.
2. `cube completion > announces memberLeft moved to the vacated server and memberJoined to the target` — `hub.test.ts:1408`: same `at: 0` seed now expired.
3. `cube completion > re-plans after every executed move so three servers pack completely (X = 2, AC-10, F3)` — `hub.test.ts:1526`: same `at: 0` seed now expired.
4. `server activity feed (live-activity-feed) > drops a 999 ms cubeCleared candidate without consuming an id (AC-9)` — `hub.test.ts:4949`: `welcome` at 16 000 expected `[cubeCleared id 2, memberJoined id 1 (at 0)]`; received `[cubeCleared id 2]` (`at: 0` is 16 000 ms old).
5. `server activity feed (live-activity-feed) > keeps a 20-event newest-first ring and serves it on reconnect with eviction (AC-10/AC-13)` — `hub.test.ts:5489`: `welcome` at 25 000 expected ids `[26…7]`; received `[26,25,24,23,22]` (events at `≤ 20_000` are ≥ 5000 ms old). This is the `live-activity-feed` AC-10 behavior the spec explicitly supersedes.

Representative raw failure excerpt:

```text
 FAIL  src/game/hub.test.ts > server activity feed (live-activity-feed) > keeps a 20-event newest-first ring and serves it on reconnect with eviction (AC-10/AC-13)
AssertionError: expected [ 26, 25, 24, 23, 22 ] to deeply equal [ 26, 25, 24, 23, 22, 21, 20, …(13) ]
 ❯ src/game/hub.test.ts:5489:55
    5489|     expect(welcome.activity.map((event) => event.id)).toEqual([
    5490|       26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, …
```

Focused T2 suite (green):

```text
 ✓ src/game/activity.test.ts (24 tests) 9ms
 Test Files  1 passed (1)
      Tests  24 passed (24)
```

### `npm run coverage --workspace @cubeclicker/backend` — exit 1 (same five hub failures; Vitest emits no table when tests fail)

```text
      Coverage enabled with v8
 Test Files  1 failed | 36 passed (37)
      Tests  5 failed | 1520 passed (1525)
npm error command failed
npm error command sh -c vitest run --coverage
```

Per-file supplementary run (`npx vitest run src/game/activity.test.ts --coverage --coverage.include=src/game/activity.ts`, exit 0):

```text
-------------|---------|----------|---------|---------|-------------------
File         | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------|---------|----------|---------|---------|-------------------
All files    |     100 |      100 |     100 |     100 |
 activity.ts |     100 |      100 |     100 |     100 |
-------------|---------|----------|---------|---------|-------------------
```

The workspace gate itself cannot report until T3 re-pins the five hub expectations; no threshold or exclusion was changed.

### `git diff --check` — exit 0

```text
(no output)
```

## Acceptance audit

- **AC-11 — TTL constant and server boundary → met.** `ACTIVITY_EVENT_TTL_MS === 5000` is pinned in `activity.test.ts` (and in T1's `protocol.test.ts`); with no `ttlMs` passed, an event at `t = 0` is served at `now = 4999` and absent at `now = 5000`; events at `0/1000/2000` leave exactly the `at: 2000` event at `6000`; snapshot copy semantics are covered by the pre-existing fresh array/object test (still green). Server-side `welcome`/`worldEntered` consumption is T3's AC-13 evidence (integration-tier exception above).
- **AC-12 — Cadence, ids and 20-ring survive TTL → met at unit level.** Long `ttlMs` keeps ids `[25,24,…,6]`; default TTL at `24_000` yields exactly `[25,24,23,22,21]` and `nextId` 26 (next acceptance `id: 26` at `25_000`); pruning changes neither `nextId` nor `lastAcceptedAt` (drop at `6999`, accept `id: 8` at `7000`); the accepted 1 s gate, drop-not-queue, `dropServer` and `clear` tests remain green unchanged.
- **Cross-task gate → not met in this task.** Backend suite and workspace coverage fail on five T3-owned `hub.test.ts` assertions (details above).

Deviations from spec: none in production behavior; the only test edit beyond additions is the `ttlMs: 1_000_000` seam on the pre-existing 20-ring test, as planned (`plan.md` § Risks). Documentation for the snapshot lifetime is T8-owned (`docs/architecture/realtime.md` § Lifetime) and unchanged here.

## Blocked — decision requested

`T2`'s default TTL necessarily makes T3-owned `hub.test.ts` welcome expectations red before T3 runs. Candidate resolutions:

1. Accept the T2 commit as-is and run T3 immediately; T3 re-pins the five welcome/`worldEntered` expectations to the ≤5-fresh-event contract (AC-13) and restores the green backend/coverage gates.
2. Authorize a T2 follow-up (or widen T2's `files_owned`) to update those five `hub.test.ts` expectations now; the exact new values are the received arrays in the failure excerpts above (`[26,25,24,23,22]`, the two-event placements minus the `at: 0` seed, and the 16 000 snapshot minus the `at: 0` join).

## Post-T3 verification (2026-11-16)

Re-verification on branch `feat/presence-and-activity-liveness` at HEAD `4734fe8` (`feat: finalize members immediately on an explicit client leave`). T3's commit re-pinned the five `hub.test.ts` welcome/`worldEntered` expectations that the T2 default TTL expired — the three `cube completion` placements, the 16 000 `welcome` in "drops a 999 ms cubeCleared candidate…", and the ring test now named "serves only the five fresh events from the ring on reconnect (AC-13)" (`[26,25,24,23,22]`). No T2 source or test file changed in this pass; only this log was updated. The pre-T3 red evidence above is retained as history.

### `npm run lint` — exit 0

```text
> lint
> eslint .
```

### `npm run typecheck` — exit 0

```text
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
```

### `npm test --workspace @cubeclicker/backend` — exit 0

```text
 Test Files  37 passed (37)
      Tests  1537 passed (1537)
   Start at  15:36:42
   Duration  3.40s (transform 4.14s, setup 0ms, collect 12.05s, tests 13.33s, environment 6ms, prepare 3.53s)
```

The five previously failing T3-owned tests now pass, including `hub.test.ts` (193 tests).

### `npm run coverage --workspace @cubeclicker/backend` — exit 0

```text
      Tests  1537 passed (1537)
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |    96.2 |    89.92 |   99.57 |    96.2 |
 src/game          |   95.64 |    94.35 |   99.03 |   95.64 |
  activity.ts      |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
```

All four workspace thresholds (≥ 80 statements/branches/functions/lines) pass; `activity.ts` remains at 100 across all four metrics.

### `git diff --check` — exit 0

```text
(no output)
```

**Blocker status: closed.** The cross-task dependency described above (T2 default TTL ⇒ T3-owned welcome expectations) is resolved by `4734fe8`; the backend workspace gate is green with the same T2 source and tests.
