# Build log — T2 — Backend identity: player records, tokens, grace tracking

Task: T2 (2026-10-21)
Files changed: `src/backend/src/game/players.ts`, `src/backend/src/game/players.test.ts`,
`docs/features/multiplayer-servers/build-log-T2.md`

What changed & why:
- `players.ts` implements the plan § Interfaces contract: `createPlayerRecord(counter)` →
  `{ playerId: 'p<N>', name: 'Player <N>', token }` with `token` drawn per call from
  `crypto.randomBytes(16).toString('hex')` (32 lowercase hex chars), and
  `createGraceTracker({ graceMs, now })` → `begin` / `expiresAt` / `cancel` / `expired`
  over a `playerId → deadline` map (spec § 3, AC-6/AC-7/AC-8).
- The grace deadline is exactly `now() + graceMs` (`RECONNECT_GRACE_MS` from `config.ts`)
  and `expired(id, t)` is true at exactly the deadline instant (`t >= deadline`), so the
  window boundary is deterministic and poll-based.
- `players.test.ts` pins counter sequences (`1 → p1 / Player 1`, `2`, `42`, reused `5`),
  the anchored `now + 30 000` deadline (from `loadGameConfig({})`), the exact boundary
  (29 999 → false, 30 000 → true, 30 001 → true), independent windows, restart on a second
  close, cancel/no-deadline/unknown-player behaviour, the `RECONNECT_GRACE_MS=1000`
  override, and a config → registry → tracker composition scenario.

Decisions:
- **Clock injected, timers not scheduled.** The plan says "injectable clock/timers"; the
  tracker takes the injected clock (`now`) and evaluates expiry by comparison with the
  caller-supplied `nowMs`. No `setTimeout` exists in this module: scheduling belongs to
  the hub (`HubDeps.timers`, T5), and a comparison keeps the boundary instant exact and
  the module pure (no wall-clock reads). Recorded as a clarification, not a contract change.
- `expiresAt` for a player with no window returns `Number.POSITIVE_INFINITY` ("never
  expires"); `expired` returns `false` for such a player. `cancel` on an absent player is a
  no-op. Both are pinned by tests.
- `begin` is a restart, not a no-op: a second socket close re-anchors the deadline at the
  new `now()`.
- No counter/`graceMs` validation here: the counter is hub-owned and `graceMs` comes from
  the validated `GameConfig`; duplicating those checks would add unreachable branches.
- No token injection: the token is real CSPRNG output; the tests assert the pinned format
  (`/^[0-9a-f]{32}$/`), length 32, and uniqueness across 100 records rather than mocking
  `node:crypto`.
- Integration tier: `game/players.ts` is pure identity/state with no I/O boundary (the real
  socket boundary is T5). Following the T1 precedent, this task ships the unit tier plus a
  composition scenario through the public APIs (config → registry → grace tracker →
  removal) as integration evidence — documented exception, no I/O mocked.

Evidence (raw command output, at the time of the run):

```
$ npm test --workspace @cubeclicker/backend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/config.test.ts (13 tests) 4ms
 ✓ src/game/servers.test.ts (30 tests) 6ms
 ✓ src/game/players.test.ts (13 tests) 7ms
 ✓ src/app.test.ts (4 tests) 90ms

 Test Files  4 passed (4)
      Tests  60 passed (60)
   Start at  22:36:13
```

Concurrent-workspace observation #1 (identified, not silently retried): this first coverage
run failed **because of another task's in-flight file**. `src/backend/src/game/protocol.ts`
(T4) was already written but its `protocol.test.ts` did not exist yet, so the all-files
coverage semantics counted it at 0%:

```
$ npm run coverage --workspace @cubeclicker/backend
 ✓ src/game/config.test.ts (13 tests) 9ms
 ✓ src/game/servers.test.ts (30 tests) 7ms
 ✓ src/game/players.test.ts (13 tests) 10ms
 ✓ src/app.test.ts (4 tests) 109ms

 Test Files  4 passed (4)
      Tests  60 passed (60)

 % Coverage report from v8
--------------|---------|----------|---------|---------|-------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------|---------|----------|---------|---------|-------------------
All files     |   62.84 |      100 |     100 |   62.84 |
 src          |     100 |      100 |     100 |     100 |
  app.ts      |     100 |      100 |     100 |     100 |
 src/game     |   61.11 |      100 |     100 |   61.11 |
  config.ts   |     100 |      100 |     100 |     100 |
  players.ts  |     100 |      100 |     100 |     100 |
  protocol.ts |       0 |      100 |     100 |       0 | 29-338
  servers.ts  |     100 |      100 |     100 |     100 |
--------------|---------|----------|---------|---------|-------------------
ERROR: Coverage for lines (62.84%) does not meet global threshold (80%)
ERROR: Coverage for statements (62.84%) does not meet global threshold (80%)
coverage exit=1
```

`players.ts` itself was 100% on all four metrics in that run. `cubes.ts` (T3) was being
written at the same moment and was not yet in the file set.

```
$ npm run lint
> lint
> eslint .
lint exit=0
```

Concurrent-workspace observation #2: between the runs above, T3's in-flight
`cubes.test.ts` landed with a failing assertion (`allIds > lists all 294 ids of a 7×7
level`), which made the workspace test command exit 1. My file was unaffected:

```
$ npm test --workspace @cubeclicker/backend
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/config.test.ts (13 tests) 8ms
 ❯ src/game/cubes.test.ts (24 tests | 1 failed) 11ms
   × allIds > lists all 294 ids of a 7×7 level with the same ordering 5ms
     → expected 'left:0:0' to be 'back:6:6' // Object.is equality
 ✓ src/game/servers.test.ts (30 tests) 6ms
 ✓ src/game/players.test.ts (13 tests) 7ms
 ✓ src/game/protocol.test.ts (56 tests) 12ms
 ✓ src/app.test.ts (4 tests) 91ms

 Test Files  1 failed | 5 passed (6)
      Tests  1 failed | 83 passed (84)
test exit=1
```

The failure is entirely in T3-owned files (`cubes.test.ts` / `cubes.ts`), not in the T2
diff. The subsequent workspace runs (below) were green after T3's in-flight fix landed.

```
$ npm run coverage --workspace @cubeclicker/backend
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/config.test.ts (13 tests) 5ms
 ✓ src/game/cubes.test.ts (24 tests) 12ms
 ✓ src/game/servers.test.ts (30 tests) 12ms
 ✓ src/game/players.test.ts (13 tests) 13ms
 ✓ src/game/protocol.test.ts (56 tests) 13ms
 ✓ src/app.test.ts (4 tests) 105ms

 Test Files  6 passed (6)
      Tests  140 passed (140)
   Start at  22:36:39

 % Coverage report from v8
--------------|---------|----------|---------|---------|-------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------|---------|----------|---------|---------|-------------------
All files     |     100 |      100 |     100 |     100 |
 src          |     100 |      100 |     100 |     100 |
  app.ts      |     100 |      100 |     100 |     100 |
 src/game     |     100 |      100 |     100 |     100 |
  config.ts   |     100 |      100 |     100 |     100 |
  cubes.ts    |     100 |      100 |     100 |     100 |
  players.ts  |     100 |      100 |     100 |     100 |
  protocol.ts |     100 |      100 |     100 |     100 |
  servers.ts  |     100 |      100 |     100 |     100 |
--------------|---------|----------|---------|---------|-------------------
coverage exit=0
```

```
$ npm test --workspace @cubeclicker/backend
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/config.test.ts (13 tests) 8ms
 ✓ src/game/cubes.test.ts (24 tests) 9ms
 ✓ src/game/servers.test.ts (30 tests) 7ms
 ✓ src/game/players.test.ts (13 tests) 12ms
 ✓ src/game/protocol.test.ts (56 tests) 7ms
 ✓ src/app.test.ts (4 tests) 118ms

 Test Files  6 passed (6)
      Tests  140 passed (140)
   Start at  22:36:43
test exit=0
```

```
$ npm run typecheck --workspace @cubeclicker/backend
> typecheck
> tsc --noEmit
typecheck exit=0
```

```
$ grep -nE "expect\.(anything|any|closeTo)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toMatchSnapshot|toBeTruthy|toBeDefined|toHaveBeenCalled|not\.toThrow" src/backend/src/game/players.test.ts
grep exit=1 (no matches)
```

Coverage (T2 module and workspace, final run):

| Scope | Stmts | Branch | Funcs | Lines |
| --- | --- | --- | --- | --- |
| `src/game/players.ts` | 100 | 100 | 100 | 100 |
| workspace aggregate | 100 | 100 | 100 | 100 |

Acceptance audit:
- **AC-6 — ephemeral identity, no storage** → met at module level:
  `createPlayerRecord` tests pin `p<N>`, `Player <N>`, the 32-char lowercase-hex token
  format/length, and 100 distinct tokens; `players.ts` imports only `node:crypto` (no
  storage, no `fs`, no persistence).
- **AC-7 — grace window (grace logic)** → met at module level: deadline is exactly
  `now + RECONNECT_GRACE_MS` (default 30 000 from `loadGameConfig({})`; `=1000` override
  pinned), boundary at exactly the expiry instant (29 999 false / 30 000 true / 30 001
  true), independent per member, restart on a second close, cancel drops the window, and
  the composition test removes the member exactly at the deadline. Roster-retention /
  rejoin / broadcast behaviour is T5's hub tier.
- **AC-8 — display names** → met at module level: `Player <N>` uses the same counter as
  `p<N>` (1/2/42 pinned), is unique per counter, and a reused counter keeps the same
  identity while the token stays fresh. Name stability across server moves is T5.
- **AC-5 tie-in** (grace env value consumed) → met: `RECONNECT_GRACE_MS: '1000'` flows
  through `loadGameConfig` into the tracker deadline.

Deviations from spec: none to the pinned constants or public contract. Two recorded
clarifications: (1) no timer scheduling in `GraceTracker` — expiry is clock-comparison
driven, scheduling remains the hub's job; (2) integration-tier exception documented above
(pure module, composition scenario instead of an I/O boundary).

Open questions: none blocking. `expiresAt` returning `Infinity` for a player without a
window is a chosen sentinel (documented and pinned); if T5 prefers an explicit
`hasWindow`/nullable deadline, that is an additive change to this module.
