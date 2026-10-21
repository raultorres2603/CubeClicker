# Build log — T1 — Backend core: config, server registry, assignment, move plan, ring layout

Task: T1 (2026-10-21)
Files changed: `src/backend/src/game/config.ts`, `src/backend/src/game/config.test.ts`,
`src/backend/src/game/servers.ts`, `src/backend/src/game/servers.test.ts`,
`docs/features/multiplayer-servers/build-log-T1.md`

What changed & why:
- `config.ts`: `loadGameConfig(env)` validates `MAX_USERS_PER_SERVER` (default 10, 2–24) and
  `RECONNECT_GRACE_MS` (default 30 000, 1000–600 000), throwing an `Error` that names the
  variable, and pins the fixed limits (rate 30, heartbeat 30 000, missed pongs 2, message
  cap 1024, connections 200) into one `GameConfig` object (spec § Pinned constants, AC-5).
- `servers.ts`: ring layout (`SLOT_SPACING = 24`, `worldPosition`), join rule (`pickServer`),
  rebalance (`computeMovePlan`) and the in-memory `ServerRegistry` (monotonic never-reused
  ids, assign, remove-with-destroy, re-validated move, plan recompute) (spec § 1, § 4, § 5).
- Tests pin every constant, every boundary (1/2/10/24/25, 999/1000/600000/600001, `'abc'`,
  `'10.5'`, `''`, missing → default), exact error strings, exact ring-position literals
  (X = 10 slots 1/2/3/10; X = 2 both slots), the AC-10 plan fixtures, registry id/lifecycle
  sequences, and one composition scenario (config → registry → layout) mirroring the AC-11
  merge at registry level.

Decisions:
- Fixed env semantics: only an **unset** variable yields the default; an **empty string** is
  a startup failure (it names the variable), matching AC-5's "invalid values fail startup".
- `maxMessageBytes` lives in `GameConfig` (T1 task text) but is **not** exported as a
  constant from `config.ts`, because spec § Pinned constants gives the exported
  `MAX_MESSAGE_BYTES` home to `game/protocol.ts` (T4) — no duplicate export, same value.
- `Position` is exported from `servers.ts` (the first pure module that needs it); the T4
  protocol shape is the same `{ x, y }` and may import it.
- `moveMember` re-validates the target exists **and** has a free slot **and** is strictly
  lower than the member's current server (`>=` current → `null`). The last check is not in
  the T1 task text but is the § 4/AC-10 stability invariant (a plan can never move a member
  up or in place); it also makes the "target gone" path reachable and tested.
- Ring math order is fixed as `radius = (maxUsers * SLOT_SPACING) / (2 * Math.PI)` then
  `angle = (2 * Math.PI * (slot - 1)) / maxUsers`, so the pinned literals are exact-double
  equalities (no `toBeCloseTo`, no `Math.fround` needed).
- Registry keeps servers in ascending id order by construction (fresh ids are always the
  highest), so `pickServer`/`computeMovePlan` sorting is a pure-function guard only.
- Integration tier: T1's modules are pure state with no I/O boundary; the real socket
  boundary belongs to T5 (`app.test.ts` / `hub.test.ts`). This task therefore ships the
  unit tier plus a **composition scenario** (config + registry + ring layout end-to-end
  through the public registry API, asserting the AC-11 merge at registry level) as its
  integration evidence — documented exception, no I/O mocked.

Evidence:

```
$ npm test --workspace @cubeclicker/backend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/config.test.ts (13 tests) 4ms
 ✓ src/game/servers.test.ts (30 tests) 6ms
 ✓ src/app.test.ts (4 tests) 90ms

 Test Files  3 passed (3)
      Tests  47 passed (47)
```

```
$ npm run coverage --workspace @cubeclicker/backend
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/config.test.ts (13 tests) 5ms
 ✓ src/game/servers.test.ts (30 tests) 7ms
 ✓ src/app.test.ts (4 tests) 105ms

 Test Files  3 passed (3)
      Tests  47 passed (47)

 % Coverage report from v8
-------------|---------|----------|---------|---------|-------------------
File         | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------|---------|----------|---------|---------|-------------------
All files    |     100 |      100 |     100 |     100 |
 src         |     100 |      100 |     100 |     100 |
  app.ts     |     100 |      100 |     100 |     100 |
 src/game    |     100 |      100 |     100 |     100 |
  config.ts  |     100 |      100 |     100 |     100 |
  servers.ts |     100 |      100 |     100 |     100 |
-------------|---------|----------|---------|---------|-------------------
```

```
$ npm run typecheck --workspace @cubeclicker/backend
> typecheck
> tsc --noEmit
(exit 0, no output)
```

```
$ npm run lint
> lint
> eslint .
(exit 0, no output)
```

```
$ grep -nE "expect\.(anything|any|closeTo)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toMatchSnapshot|toBeTruthy|toBeDefined|toHaveBeenCalled" src/backend/src/game/*.test.ts
(no matches, exit 1)
```

Acceptance audit:
- AC-2 (registry level: fill to X then overflow; slots 1..X in join order) → met:
  `createServerRegistry > fills server 1 to capacity then overflows into server 2` asserts
  `{1,1} {1,2} {1,3} {2,1}` and the exact server map with X = 3; ring positions asserted via
  `worldPosition` literals.
- AC-3 (empty servers destroyed; ids never reused) → met (registry level):
  `destroys an emptied server and never reuses its id` (server 2 destroyed → next created
  server is id 3) and `executes a planned move, destroys the vacated server…`.
- AC-5 (capacity config) → met: `config.test.ts` defaults, boundaries 1/2/10/24/25,
  `'abc'`, `'10.5'`, `''`, exact error strings naming the variable, grace boundaries
  1000/600000 and 999/600001.
- AC-9 (join assignment rule) → met: `pickServer` cases (empty, lowest free, gap, unordered)
  plus registry `assigns a rejoin to the lowest-id free slot after churn`.
- AC-10 (deterministic plan, strictly lower targets, pinned fixtures) → met:
  `computeMovePlan` fixtures `[1: X−1, 2: 1] → {p3: 1}`, `[1: X−2, 2: 2] → {p2: 1, p3: 1}`
  (join order), `[1: X, 2: 1] → {}`, skip-then-move case, capacity-limited packing, and the
  strictly-lower property loop; execution-only-at-completion is pinned at registry level by
  `plan()` recompute + explicit `moveMember` calls (the hub trigger sequence is T5).
- AC-13 (slot formula) → met: exact literals for X = 10 slots 1/2/3/10 and X = 2 slots 1/2.

Deviations from spec:
- **AC-10 fixture contradiction (needs reviewer confirmation).** spec.md AC-10 pins
  `[1: X members, 2: 1 member] → { p2: 1 }` *and* `[1: X, 2: 1] → empty plan`; tasks.md T1
  repeats the same clash (`[1: X, 2: 1] → {p2: 1}` and `[1: X, 2: 1] → empty`). § 4 ("free
  slots") and the third fixture make the capacity-aware reading the only self-consistent
  one: a full server 1 has no destination, so the lone-member fixture is implemented and
  pinned as `[1: X−1, 2: 1] → {p2: 1}` (one free slot), `[1: X−2, 2: 2] → {p2: 1, p3: 1}`,
  and `[1: X, 2: 1] → {}`. No other reading satisfies "target strictly lower" + capacity.
- Empty-string env values are rejected (startup failure) rather than treated as unset;
  spec does not pin this, documented above.
- `MAX_MESSAGE_BYTES` is not exported from `config.ts` (spec home: `game/protocol.ts`, T4);
  `GameConfig.maxMessageBytes` carries 1024 and is asserted.
- No integration test against a real socket in this task: the boundary does not exist yet
  (T5 owns `app.ts`/`hub.ts`); composition scenario shipped instead (documented exception).

Open questions:
- Q-T1-1: confirm the AC-10 lone-member fixture means `[1: X−1, 2: 1] → {p2: 1}` (one free
  slot) and that `[1: X, 2: 1] → {}` is intended (my implementation). Candidate alternative:
  the plan should ignore capacity and always target the lowest id — rejected because it would
  overfill a server and breaks the "free slots" wording of § 4.
- Q-T1-2: should `T4` export `MAX_MESSAGE_BYTES` and have `config.ts` import it (single home),
  or keep the literal duplicated in `GameConfig` as done here? Current task text assigns the
  value to config, the spec table to protocol; both currently agree on 1024 and are pinned.
