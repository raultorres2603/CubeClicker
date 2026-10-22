# Build log — T5b — Corrective (code review r1): plan recompute after moves, trailing-second limiter, cap ordering, donor order

Task: T5b (2026-10-22)
Files changed: `src/backend/src/game/hub.ts`, `src/backend/src/game/hub.test.ts`,
`src/backend/src/game/servers.ts`, `src/backend/src/game/servers.test.ts`,
`src/backend/src/app.ts`, `src/backend/src/app.test.ts`,
`docs/features/multiplayer-servers/build-log-T5b.md` (this log)

Acceptance: AC-3, AC-9, AC-10 (convergence), AC-14 (rate limit), AC-20 (hello ordering),
spec § 4 donor order.

## Sketch (≤5 lines)

After an executed move the hub recomputes the move plan immediately, so each completion can fill
the newest hole without waiting for an unrelated trigger. The explode limiter keeps the timestamps
of admitted attempts and prunes everything at or before `now − 1000`, admitting at most 30 per
trailing second and emitting `rate_limited` at most once per trailing second. The `/ws` route
asks `hub.hasCapacity()` and closes an over-cap upgrade before `hello` (the hub keeps its attach
backstop). The registry tracks a monotonic join sequence, and `computeMovePlan` takes donors in
join order rather than slot order.

## Findings → fixes

| Finding | Fix | Code | Tests |
| --- | --- | --- | --- |
| **F3** (MAJOR) — the move plan was not recomputed after an executed move, so § 4 convergence failed with ≥ 3 servers | `handleCompletion` calls `recomputePlan()` immediately after a successful `registry.moveMember`, before the `worldEntered` / `memberLeft (moved)` / `memberJoined` broadcasts. The mover's move still executes only at their own completion; the other donors' moves still execute only at theirs. Same-server completions (`moved === null`) do not change membership and do not re-plan. | `hub.ts:533-536` | `hub.test.ts` › “re-plans after every executed move so three servers pack completely (X = 2, AC-10, F3)”; `app.test.ts` › “packs three servers after each completion over live sockets (X = 2, AC-10, F3)” |
| **F4** (MAJOR) — the limiter was a fixed 1 s window (≈ 60 attempts possible in a trailing second) | `RateWindow` became a timestamp deque (`admitted: number[]`). On each attempt, every timestamp `<= now − 1000` is pruned, then the attempt is dropped when `admitted.length >= clickRateLimitPerSecond`; otherwise `now` is pushed. `rate_limited` is emitted only when `lastLimitedAt` is null or `now − lastLimitedAt >= 1000`. | `hub.ts:78-79, 149-153, 484-499` | `hub.test.ts` › “drops the 31st explode in a trailing second and keeps the window closed until it ages out”, “keeps the window closed for a burst that a fixed one-second window would admit (F4)”, “reports rate_limited at most once per trailing second (F4)”; `app.test.ts` › “drops the 31st explode in a trailing second over a live socket (AC-14, F4)” |
| **F5** (MINOR) — `MAX_CONNECTIONS` was enforced after the route had already sent `hello` | `GameHub.hasCapacity()` returns `connections.size < config.maxConnections`. The `/ws` route checks it first and closes the socket without sending anything; `attach` keeps the same guard as a backstop for direct hub users. `hello` remains the first frame of every accepted connection. | `hub.ts:122-130, 577-579, 581-586`; `app.ts:99-107` | `app.test.ts` › “closes a socket over the connection cap without sending hello first (AC-20, F5)”; `hub.test.ts` › “closes sockets beyond the connection cap and reports capacity” |
| **F6** (MINOR) — donors were taken in slot order, which differs from join order after a hole refill | The registry keeps `playerId → joinSequence` (incremented on `assign`, deleted on `removeMember`, preserved across moves and grace resumes). `computeMovePlan(servers, maxUsers, joinSequence?)` collects donors in enumeration order, then stably sorts them by the sequence; entries missing from a partial sequence sort last (`Number.MAX_SAFE_INTEGER`). Without a sequence the enumeration order is kept for plain fixtures/backward compatibility. | `servers.ts:136-144, 158-201, 251-257, 284-289, 296-300, 334-336` | `servers.test.ts` › “takes donors in join order, not slot order, when the sequence says so (F6)”, “plans the earlier join out of a server whose lower slot was refilled later (F6)” |

### Test seam added for the live-socket tests

`buildApp(env, options: BuildAppOptions = {})` accepts `config?: Partial<GameConfig>` (merged over
`loadGameConfig(env)`) and `random?: () => () => number` (defaults to `() => Math.random`). Both
defaults preserve production behavior; the seam pins `N = 3` (`random: () => () => 0`) and keeps
the F3 burst clear of the separately pinned limiter (`clickRateLimitPerSecond: 100`) without
touching environment files or adding dependencies (`app.ts:58-83`).

## F3 three-server sequence (X = 2, default draw → N = 3)

Fixtures are slots in order; `—` is a free slot.

| Step | Server 1 | Server 2 | Server 3 | Plan after the trigger | Executed move |
| --- | --- | --- | --- | --- | --- |
| After five joins | p1, p2 | p3, p4 | p5 | — | — |
| p1 socket closes, grace expires | p2 | p3, p4 | p5 | `{p3 → 1}` | none — p3 moves only at their completion |
| p3 completes | p3, p2 | —, p4 | p5 | **recomputed:** `{p5 → 2}` (p4 is already on server 2; its target would not be strictly lower) | p3 → server 1 slot 1 |
| p5 completes | p3, p2 | p5, p4 | destroyed | `{}` | p5 → server 2 slot 1 |
| p6 joins | p3, p2 | p5, p4 | — | `{}` | new server **4** (id 3 is never reused) |

Both server 1 and server 2 are full, there is no empty server, and the id counter stays monotonic.
The hub scenario asserts the full message set per step (`worldEntered` payload + roster, `memberJoined`
on the target, `memberLeft (moved)` on the vacated server, silence on unrelated servers); the
live-socket scenario asserts the same sequence through real `ws` connections plus the sixth join on
server 4.

## F4 trailing-second boundary table

Default `clickRateLimitPerSecond = 30` (the third block uses cap 2 to shorten the fixture).

| Clock (ms) | Attempt | Result |
| --- | --- | --- |
| t = 0 | 30 attempts | 30 `miniCubeRemoved` broadcasts |
| t = 0 | 31st attempt | no broadcast; one `error rate_limited` |
| t = 999 | attempt | dropped silently — the 30 t = 0 attempts are still inside `(now − 1000, now]` |
| t = 1000 | attempt | **admitted** — the t = 0 timestamps are pruned at `<= now − 1000` |
| t = 900 | burst of 30 | all admitted (the join was at t = 0; a fixed t = 0-anchored window would have reset) |
| t = 1000 | attempt | dropped with `rate_limited` — the fixed-window implementation would have admitted it |
| t = 1899 | attempt | dropped silently (inside the burst's trailing second, one error already sent) |
| t = 1900 | attempt | **admitted** — the t = 900 burst ages out exactly 1000 ms later |
| t = 0 (cap 2) | attempts 1, 2 | admitted |
| t = 0 | attempt 3 | one `error rate_limited` |
| t = 400, t = 999 | attempts | dropped silently (same trailing second as the error) |
| t = 1000 | attempts 4, 5 | **admitted** — the two t = 0 admissions aged out |
| t = 1000 | attempt 6 | `error rate_limited` (`now − lastLimitedAt = 1000`) |

Semantics pinned: an attempt exactly 1000 ms after an admitted attempt is outside the window
(`<= now − 1000` is pruned), and an error exactly 1000 ms after the previous error is allowed
(`>= 1000`). Dropped attempts do not extend the window; admitted attempts do.

## Verification (raw output)

Final working tree, 2026-10-22 (sequential runs from the repository root):

```
$ npm run lint
> lint
> eslint .

LINT_EXIT=0

$ npm run typecheck
> typecheck
> npm run typecheck --workspaces --if-present
> typecheck
> tsc --noEmit
> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

```
$ npm test
> test
> npm run test --workspaces --if-present

> test
> vitest run
 RUN  v3.2.7 .../src/backend
 ✓ src/game/servers.test.ts (38 tests)
 ✓ src/game/hub.test.ts (34 tests)
 ✓ src/app.test.ts (10 tests)
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1029ms
 Test Files  7 passed (7)
      Tests  188 passed (188)

> test
> vitest run
 RUN  v3.2.7 .../src/frontend
 Test Files  28 passed (28)
      Tests  617 passed (617)

TEST_EXIT=0
```

```
$ npm run coverage
 RUN  v3.2.7 .../src/backend
 Test Files  7 passed (7)
      Tests  188 passed (188)
 % Coverage report from v8
--------------|---------|----------|---------|---------|------------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------|---------|----------|---------|---------|------------------------
All files     |   98.51 |    97.16 |     100 |   98.51 |
 src          |     100 |      100 |     100 |     100 |
  app.ts      |     100 |      100 |     100 |     100 |
 src/game     |   98.42 |    96.92 |     100 |   98.42 |
  hub.ts      |   96.64 |    92.85 |     100 |   96.64 | ...352,380-381,398-400
  servers.ts  |     100 |      100 |     100 |     100 |
--------------|---------|----------|---------|---------|------------------------

> coverage
> vitest run --coverage
 RUN  v3.2.7 .../src/frontend
 Test Files  28 passed (28)
      Tests  617 passed (617)
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
All files          |   99.09 |    98.29 |   99.28 |   99.09 |
-------------------|---------|----------|---------|---------|-------------------

COVERAGE_EXIT=0
```

Coverage gate is satisfied in both workspaces (thresholds ≥ 80 statements/branches/functions/lines;
no exclusions or threshold changes). Backend wall time is dominated by the live three-server test
(~1.0 s).

### Scope and cleanliness checks

```
$ grep -rn "TEMP-VERIFY\|TEMP_VERIFY\|TEMPVERIFY" src/backend/src
NO_TEMP_MARKERS

$ git diff -- src/backend/src/game/hub.ts src/backend/src/app.ts | grep -nE "TEMP|recomputePlan|hasCapacity|socket.close"
60:+      if (!hub.hasCapacity()) {
61:+        socket.close();
...
190:+    recomputePlan();
198:+    hasCapacity(): boolean {
```

`git status --short` for the six owned files showed only those six modified (plus this untracked
build log); no frontend, docs, config or environment file was touched by T5b. The temporary
verification edits described below were reverted; the final diff contains the F3 recompute at
`hub.ts:536` and the F5 pre-check at `app.ts:102`.

### Regression checks performed before finalization (temporary edits, reverted)

- Removing the `recomputePlan()` call after an executed move made the F3 hub scenario fail: p3
  stayed on server 2 and received `levelAdvanced` instead of `worldEntered`, and server 1 never
  filled. Restored; the test passes.
- Removing the route's `hasCapacity()` pre-check made the F5 live test observe a `hello` frame
  before the close. Restored; the test passes and asserts the frame list is empty.

## Decisions

- **Re-plan only after an executed move.** A completion that stays on the same server is not a
  membership change and leaves the plan untouched; an executed move is one, so it re-plans
  immediately and before broadcasting the move. Re-planning before the broadcast ensures any
  subsequent completion sees the current plan.
- **Join order is join time, not slot time.** `assign` increments a registry-local counter; a
  grace-period resume keeps the original entry (the member never left the roster), while
  `removeMember` deletes it. Moves preserve it, so a member carried to a lower server stays
  “earlier” than a later join that refilled their old hole.
- **Partial join sequences are deterministic.** A donor missing from a supplied sequence keeps
  enumeration position after mapped donors (stable sort, `Number.MAX_SAFE_INTEGER`). The registry
  always supplies a complete map for its live members; the fallback only serves direct callers and
  keeps the pure function usable in fixtures.
- **`hasCapacity()` is a pre-attach check, not a reservation.** It reads the same
  `connections.size` the attach backstop uses. A socket closed by the route never reaches the hub,
  so it cannot create state or receive protocol frames.
- **No new dependencies, no persistence.** The join sequence and rate deque are in-memory state of
  the existing registry/hub; the app seam is a parameter object, not a library.

## Deviations / open questions

1. **F3 illustrative donor is p5, not p4.** The corrective brief's example says that after p3
   completes, p4 is planned. Under spec § 4 a planned target must be **strictly lower** than the
   donor's current server: after p3 moves to server 1, the only free slot is on server 2, where p4
   already is, so p4 cannot be planned (a move to the same server id is not a move). The donor
   that can fill the hole is p5 from server 3. The implementation follows § 4, the final invariant
   (all servers except at most the last one full, no empty servers) is reached, and the tests
   assert the p5 sequence. **Question for the planner/reviewer:** confirm p5 is the intended
   donor (candidate answers: (a) keep § 4 and this sequence, correcting the example; (b) if the
   intended rule was “fill a hole from any higher server, including the same server”, amend § 4 and
   the acceptance fixture — that would be a behavior change outside T5b's corrective scope).
2. **F5 rejection point.** `@fastify/websocket` invokes the route after the HTTP upgrade, so the
   implementation completes the upgrade and closes the socket before any application frame
   (`hello` is never sent). This matches “closed before the protocol starts”, but not an
   HTTP-level 503 before the upgrade. **Question:** is close-before-hello acceptable as “upgrades
   are rejected”, or is an HTTP pre-upgrade rejection required? (The latter needs a different
   Fastify hook/plugin surface and would be a separate task.)
3. **Rate error cadence.** “At most once per second” is implemented as at most one error per
   trailing second (`>= 1000` ms since the last error), independent of how many attempts are
   dropped. If a calendar-second or per-admission cadence was intended, the pinned tests would need
   to change.
4. **Root verification snapshot.** The final root run (188 backend + 617 frontend tests, all green)
   was taken while T17b was still editing frontend files; the frontend count changed during the
   task (608 → 610 → 617). T5b's backend-scoped evidence is independent of those edits; the root
   numbers above describe the tree at the time of the run, not a frozen frontend baseline.
