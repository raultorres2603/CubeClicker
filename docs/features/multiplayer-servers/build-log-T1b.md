# Build log — T1b — Stable slot occupancy (corrective)

Task: T1b (2026-10-21)
Files changed: `src/backend/src/game/servers.ts`, `src/backend/src/game/servers.test.ts`,
`src/backend/src/game/hub.ts`, `src/backend/src/game/hub.test.ts`,
`docs/features/multiplayer-servers/build-log-T1b.md` (this log)

## Sketch (≤5 lines)

`ServerState.members` becomes the server's **slot table** (`(string | null)[]`, index = slot − 1)
instead of a dense list: a removal writes `null` into exactly that slot (trailing holes trimmed) and
nobody's index moves; `pickServer`/`assign`/`moveMember` place on the **lowest free slot**
(`firstFreeSlot`), and `computeMovePlan` counts occupied slots rather than array length. The hub keeps
every message shape; `locationOf` reads the slot table index (= the actual slot), and `broadcast`/
`rosterFor` skip holes. Tests pin slot stability with exact `worldPosition` literals.

## What changed & why

- **`servers.ts` — explicit occupancy.** `ServerState.members` is now the slot table: index `i` is
  slot `i + 1`, `null` is a free slot, trailing free slots are trimmed so `length` is the highest
  occupied slot and never exceeds capacity. New private helpers `firstFreeSlot` (lowest free slot of a
  table, `null` at capacity), `occupiedCount`, `vacate` (frees one slot + trims trailing holes) and
  `place` (fills a slot, padding with holes only when the slot is beyond the current length).
- **`pickServer`** returns the lowest free slot of the lowest-id server with capacity (a hole is now a
  valid destination — the old `members.length + 1` could not express one), else a new server at slot 1.
- **`computeMovePlan`** counts `maxUsers − occupiedCount` free slots and walks donors in slot order
  skipping holes. The plan still only names a target server (strictly lower), so its contract and all
  pinned fixtures are unchanged.
- **`ServerRegistry`** — `assign` places on the returned slot; `removeMember` vacates exactly that slot
  and destroys the server only when no slot is occupied; `moveMember` keeps its re-validation
  (member found, target exists, strictly lower, has a free slot) and now puts the mover on the target's
  lowest free slot while vacating (and possibly destroying) the old server. Ids stay monotonic and are
  never reused; destroy-when-empty is unchanged.
- **`hub.ts`** — only the slot/position source changed: `locationOf` reads the member's slot-table index
  (= its actual slot) with the comment pinning the invariant; `broadcast` and `rosterFor` skip `null`
  holes so the roster stays slot order. No message type, field or envelope changed.
- **Tests** — `servers.test.ts` gains a `stable slots (T1b)` suite (X = 4: removal keeps p3 slot 3 /
  p4 slot 4 with exact `worldPosition` literals; a join fills the vacated slot 2; a mover takes the
  target's lowest free slot and only holes its old slot; `pickServer` on a hole; `computeMovePlan`
  counting occupancy). `hub.test.ts` gains two X = 4 end-to-end cases: after p2's grace expiry, p3's
  `levelAdvanced` still carries the slot-3 position, and a new join lands in slot 2 while the roster is
  emitted in slot order (p1 slot 1, p4 slot 2, p3 slot 3).

## Decisions

- **Field name stays `members`.** `players.test.ts` (not in this task's `files_owned`) asserts
  `registry.servers()` against `{ id, members: [...] }`, so the plan's field name is kept and its
  meaning is documented as "slot table (index = slot − 1)". This also keeps the plan § Interfaces
  shape (`members in slot/join order (index = slot−1)`) literally true.
- **Trailing holes are trimmed.** Without trimming, a removal in the highest slot would leave
  `['p1', null]`, and the untouched `players.test.ts` removal fixture (`['p1']`) would break. Trimming
  never changes any surviving member's slot.
- **Donor order is slot order.** Spec § 4 says donors are taken "in join order"; with stable slots a
  refilled hole makes slot order the only order the registry holds, and it is the order the hub
  exposes everywhere (roster). No pinned fixture distinguishes the two (all plan fixtures are dense).
- **Movers take the lowest free slot** (not the next slot after the current members), per spec § 5
  "new members take the lowest free slot" and the T1b brief. This is the visible change in three
  pre-existing fixtures (see below).

## Pre-existing tests that had to change (and why)

All changes are in files this task owns. Each one **encoded dense-index compaction**, which is exactly
the behavior the brief removes; no acceptance semantics were weakened.

| Test | Old expectation (dense/compacted) | New expectation (stable slots) |
| --- | --- | --- |
| `servers.test.ts > createServerRegistry > assigns a rejoin to the lowest-id free slot after churn` | p1 leaves → p2 shifts to slot 1; p4 joins at slot 2 | p2 keeps slot 2; p4 joins at slot 1 |
| `servers.test.ts > … > executes a planned move, destroys the vacated server and appends to the target` (renamed: "…into the target's lowest free slot…") | p4 appended at slot 3 | p4 fills the vacated slot 2; p3 keeps slot 3 |
| `servers.test.ts > … > keeps the vacated server when other members remain on it` | p4 appended at slot 3; server 2 = `['p5']` | p4 fills slot 2; server 2 = `[null, 'p5']` (p5 keeps slot 2) |
| `servers.test.ts > plans only strictly lower targets` | iterated `members` as `string[]` | skips `null` holes (helper/type change only) |
| `hub.test.ts > reconnect grace > removes the member at exactly the grace deadline …` | new join at slot 2, roster `[p2 slot 1, p3 slot 2]` | new join at slot 1, roster `[p3 slot 1, p2 slot 2]` |
| `hub.test.ts > cube completion > merges a lone server-2 member into server 1 (X = 2, AC-11)` | mover p3 at slot 2, roster `[p2 slot 1, p3 slot 2]` | mover p3 fills freed slot 1, roster `[p3 slot 1, p2 slot 2]` |
| `hub.test.ts > cube completion > announces memberLeft moved …` (X = 3) | mover p4 at slot 3, roster `[p1, p3 slot 2, p4 slot 3]` | mover p4 fills freed slot 2, roster `[p1 slot 1, p4 slot 2, p3 slot 3]` |

No other test file needed a change: `players.test.ts` removes the member in the highest slot, so
trailing-hole trimming keeps its `['p1']` snapshot valid; `app.test.ts` has no churn.

## Evidence (raw command output)

```
$ npm test --workspace @cubeclicker/backend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/config.test.ts (13 tests) 5ms
 ✓ src/game/cubes.test.ts (24 tests) 9ms
 ✓ src/game/players.test.ts (13 tests) 8ms
 ✓ src/game/servers.test.ts (36 tests) 13ms
 ✓ src/game/hub.test.ts (31 tests) 25ms
 ✓ src/game/protocol.test.ts (56 tests) 8ms
 ✓ src/app.test.ts (7 tests) 114ms

 Test Files  7 passed (7)
      Tests  180 passed (180)
   Start at  23:28:13
   Duration  459ms (transform 322ms, setup 0ms, collect 688ms, tests 182ms, environment 1ms, prepare 401ms)
test exit=0
```

```
$ npm run coverage --workspace @cubeclicker/backend
> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/cubes.test.ts (24 tests) 7ms
 ✓ src/game/config.test.ts (13 tests) 9ms
 ✓ src/game/servers.test.ts (36 tests) 8ms
 ✓ src/game/players.test.ts (13 tests) 7ms
 ✓ src/game/hub.test.ts (31 tests) 31ms
 ✓ src/game/protocol.test.ts (56 tests) 8ms
 ✓ src/app.test.ts (7 tests) 131ms

 Test Files  7 passed (7)
      Tests  180 passed (180)
   Start at  23:28:19
   Duration  570ms (transform 251ms, collect 612ms, tests 201ms, environment 1ms, prepare 560ms)

 % Coverage report from v8
--------------|---------|----------|---------|---------|------------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s      
--------------|---------|----------|---------|---------|------------------------
All files     |   98.47 |    97.09 |     100 |   98.47 |                        
 src          |     100 |      100 |     100 |     100 |                        
  app.ts      |     100 |      100 |     100 |     100 |                        
 src/game     |   98.38 |    96.87 |     100 |   98.38 |                        
  config.ts   |     100 |      100 |     100 |     100 |                        
  cubes.ts    |     100 |      100 |     100 |     100 |                        
  hub.ts      |   96.62 |    92.79 |     100 |   96.62 | ...344,372-373,390-392 
  players.ts  |     100 |      100 |     100 |     100 |                        
  protocol.ts |     100 |      100 |     100 |     100 |                        
  servers.ts  |     100 |      100 |     100 |     100 |                        
--------------|---------|----------|---------|---------|------------------------
coverage exit=0
```

```
$ npm run typecheck --workspace @cubeclicker/backend
> typecheck
> tsc --noEmit

typecheck exit=0
```

```
$ npm run lint
> lint
> eslint .

lint exit=0
```

```
$ grep -nE "expect\.(anything|any|closeTo)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeCloseTo|toMatchSnapshot|toBeTruthy|toBeDefined|toHaveBeenCalled|not\.toThrow" src/game/servers.test.ts src/game/hub.test.ts
banned-matcher grep exit=1 (no matches)

$ grep -nE "Math\.random|Date\.now|setTimeout|setInterval" src/game/servers.ts
purity grep exit=1 (no matches)

$ git status --short src/backend
 M src/backend/src/game/hub.test.ts
 M src/backend/src/game/hub.ts
 M src/backend/src/game/servers.test.ts
 M src/backend/src/game/servers.ts
```

## Coverage

| Scope | % Stmts | % Branch | % Funcs | % Lines | Gate (≥ 80) |
| --- | --- | --- | --- | --- | --- |
| `src/game/servers.ts` | 100 | 100 | 100 | 100 | pass |
| `src/game/hub.ts` | 96.62 | 92.79 | 100 | 96.62 | pass |
| backend workspace (all files) | 98.47 | 97.09 | 100 | 98.47 | pass |

No exclusions added, no thresholds changed. The uncovered `hub.ts` lines are the same defensive
guards as T5 (peer already closed, member already gone, already-closed peer on a heartbeat tick).

## Acceptance audit

- **Spec § 5 (layout paragraph) — positions stable while the member stays.** `servers.test.ts >
  stable slots (T1b) > keeps every surviving member's slot when another member leaves`: X = 4,
  p1..p4 assigned to slots 1..4, `removeMember('p2')` → the slot table is exactly
  `['p1', null, 'p3', 'p4']` and the exact positions are unchanged
  (slot 3 `(-15.278874536821952, 1.8711224796093003e-15)`, slot 4
  `(-2.8066837194139503e-15, -15.278874536821952)`), with the now-free slot 2 pinned as
  `(9.355612398046502e-16, 15.278874536821952)`. **met.**
- **AC-9 — join lands on the lowest free slot.** `pickServer` now resolves holes:
  `accepts a join on a hole that a dense table could not express` (`server(1,'a',null,'c')`, X = 3 →
  slot 2) and `puts a new join on the vacated slot without moving the remaining members` (X = 4 →
  `{ serverId: 1, slot: 2 }`, table `['p1','p5','p3','p4']`). Overflow/gap/created cases unchanged and
  green. **met.**
- **AC-11 — lone-user merge (X = 2).** `hub.test.ts > merges a lone server-2 member into server 1
  (X = 2, AC-11)` still runs the full end-to-end sequence (disconnect → exact grace → `memberLeft
  left` → completion → `worldEntered` + `memberJoined` + server 2 destroyed → next join creates
  server 3); the mover now lands on the freed slot 1 (`X2_SLOT_1`) while p2 keeps slot 2 — the exact
  slot is asserted, as AC-11 requires. **met.**
- **AC-13 — ring layout & hub emission.** `worldPosition` is unchanged (formula tests untouched and
  green) and the hub still emits it for the member's actual slot: the new X = 4 hub tests pin
  `welcome`/`memberJoined` at slot 2 and `levelAdvanced` at slot 3 after a neighbour left, with the
  X = 4 literals. **met (server side).**
- **Brief: roster/list order stays slot order, holes skipped.** `hub.test.ts > places a new join in
  the vacated slot …` asserts the `welcome` roster `[p1 slot 1, p4 slot 2, p3 slot 3]`. **met.**
- **Brief: message shapes unchanged, no new messages.** `hub.ts` diff touches only `locationOf`,
  `broadcast` and `rosterFor`; every `hub.test.ts` protocol assertion (including the untouched
  explode/rate-limit/heartbeat suites) passes unchanged. **met.**
- **Brief: remove/leave/destroy-when-empty, monotonic never-reused ids.** `removeMember` vacates one
  slot and destroys only an empty server; `destroys an emptied server and never reuses its id` and the
  AC-11 "next join creates server 3" assertion are green. **met.**
- **Brief: `moveMember` re-validation semantics unchanged.** `rejects a move to a detached server`,
  `rejects a move into a full target`, `rejects upward and same-server targets and unknown members`
  are green (only the successful-move slot changed). **met.**
- **Brief: injectable clock/RNG/timers, no new deps/persistence.** `hub.ts` still takes `now`/`random`/
  `timers` from `HubDeps`; the purity grep shows no `Math.random`/`Date.now`/timers in `servers.ts`;
  `package.json`/lockfiles untouched. **met.**

## Deviations from spec

None. This task implements spec § 5's stability clause, which T5's build log had flagged as a deviation
(deviations 3 / Q-T5-2); that flag is now resolved. Donor iteration is documented as slot order (see
Decisions) — no pinned fixture or AC distinguishes it from join order.

## Open questions

- Q-T1b-1: the corrective brief pins "movers take the lowest free slot"; if a reviewer prefers
  "append after the current members" for movers (keeping the freed slot for future joins), the three
  hub/servers fixtures above and `firstFreeSlot` in `moveMember` are the only places to change.
