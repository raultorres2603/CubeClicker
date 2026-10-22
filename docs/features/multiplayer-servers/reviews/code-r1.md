---
feature: multiplayer-servers
kind: code
iteration: 1
verdict: changes_requested
blocking: 4
---

# Code review — multiplayer-servers — iteration 1

Reviewer: independent code gate. Scope: the `multiplayer-servers` implementation at
`main` @ `c2cb025` (feature commits `f8cf3e1` … `c2cb025`) against `spec.md` (27 ACs),
`plan.md`, `tasks.md`, `status.md`, and the builder artifacts. No source, test, spec, plan,
tasks, status or build-log file was edited; this review file is the only write.

## 1. Verification evidence (independently run)

| Command | Result |
| --- | --- |
| `npm run lint` | exit 0, no diagnostics |
| `npm run typecheck` | exit 0, both workspaces |
| `npm test` | exit 0 — **788/788 tests** (backend 180, frontend 608) |
| `npm run coverage` | exit 0 — backend **98.47 / 97.09 / 100 / 98.47**; frontend **99.11 / 98.29 / 99.26 / 99.11** (statements / branches / functions / lines) |
| `npm run build` | exit 0 — initial JS gzip **216.30 KB** (pinned budget 350 KB) |
| `npm run smoke` | **not rerun by reviewer** (per instruction); builder transcript reports **8/8 PASS on a clean stack**. See AC-26 and finding F8. |

Coverage files inspected: both workspaces exclude only the composition entrypoints
(`src/server.ts`, `src/main.tsx`) and test files; no production source was excluded and no
threshold was lowered. The gate is above 80 on all four metrics in both workspaces.

Builder logs are claims, not evidence. The numbers above were reproduced directly by the
reviewer and match the T17/T16 transcripts. The full container smoke path and a manual
browser/WebGL pass were not independently exercised.

## 2. Per-AC verdict table

| AC | Verdict | Evidence |
| --- | --- | --- |
| **AC-1** — Server at boot | **Met (with note)** | `servers.test.ts` › “starts empty: no server exists before the first join”; `app.test.ts` › “returns 200 with the pinned body” and “keeps each app build independent (in-memory lifecycle, AC-4)”. No direct `serverCount()`-after-healthz assertion exists because `GameHub` exposes no server count; the healthz handler does not touch the hub. |
| **AC-2** — Fill to X, then overflow | **Met** | `servers.test.ts` › “fills server 1 to capacity then overflows into server 2” (X = 3); `hub.test.ts` › “overflows into the next fresh server and keeps broadcasts server-scoped” (X = 2); smoke check `multiplayer overflow` (X = 2, server 2). |
| **AC-3** — Destruction / never reuse | **Met** | `servers.test.ts` › “destroys an emptied server and never reuses its id”; `hub.test.ts` › “destroys an emptied server at grace expiry and never reuses its id”; `servers.test.ts` › composition “merges a lone server-2 member …” (server 2 destroyed, next join creates server 3). |
| **AC-4** — In-memory lifecycle | **Met** | `app.test.ts` › “keeps each app build independent (in-memory lifecycle, AC-4)”; no persistence import or write path was found in the changed source. |
| **AC-5** — Config bounds | **Met** | `config.test.ts` › “pins every constant from the spec table”, “returns the pinned defaults for an empty environment”, “accepts the range boundaries 2, 10 and 24”, “rejects 1 …”, “rejects 25 …”, non-numeric/non-integer/empty cases, and grace boundaries 999/1000/600000/600001. |
| **AC-6** — Ephemeral identity, no storage | **Met** | `players.test.ts` › “issues a 32-character lowercase hex token”, “issues a distinct token to every record (100 joins)”; `transport.test.ts` › “joins, keeps the token in memory and rejoins after the socket drops (AC-22)” uses storage traps and asserts zero storage touches. No storage API appears in the changed transport/session. |
| **AC-7** — Grace and reconnect | **Met** | `players.test.ts` grace-boundary suite; `hub.test.ts` › “keeps a disconnected member in the roster during the window”, “removes the member at exactly the grace deadline …”, “resumes the same identity, server and cube within the window …”, “fails a resume at exactly the deadline …”, “reschedules a grace timer that fires before the deadline …”. Concrete removed ids are asserted in the resume test. |
| **AC-8** — Display names | **Met** | `players.test.ts` › “formats playerId and name from the same counter”; `hub.test.ts` move sequences assert `Player 3`/`Player 4` names in the target roster and `memberJoined`. |
| **AC-9** — Join assignment | **Met** | `servers.test.ts` › “creates a server with the supplied next id when none exist”, “picks the lowest-id server with a free slot”, “skips full servers and keeps a gap in the id sequence”, “assigns a rejoin to the lowest-id free slot after churn…”. |
| **AC-10** — Move plan / execution at completion | **Met for the normative fixtures; §4 convergence gap — F3, F10** | `servers.test.ts` › the three pinned plan fixtures, “plans only strictly lower targets”, re-validation tests; `hub.test.ts` › “merges a lone server-2 member into server 1 when they complete (X = 2, AC-11)” and “announces memberLeft moved …”. The implementation follows the §4 rule for the two-server fixtures, but the plan is not recomputed after an executed move; the §4 “all servers except at most the last one full” claim fails in a reachable three-server sequence (F3). The AC-10 fixture text in `spec.md` is internally contradictory (F10). |
| **AC-11** — Lone-user merge (X = 2) | **Met** | `hub.test.ts` › “merges a lone server-2 member into server 1 when they complete (X = 2, AC-11)”: after p1’s grace expiry, p3 completes, receives `worldEntered` on server 1 slot 1, server 2 is destroyed, and the next join gets server 3. `servers.test.ts` composition test mirrors the registry half. |
| **AC-12** — Client-visible move effect | **Met** | `server-state.test.ts` › “records the pending swap …” and “reduces the AC-12 move sequence”; `session.test.ts` › “queues the worldEntered swap for the midpoint and applies the new world (AC-12)”; `scene.test.ts` › “moves the own cube to the destination at the midpoint and swaps the world exactly once”; `hub.test.ts` cross-server sequence. |
| **AC-13** — World layout, remote cubes, pickable isolation | **Met** | `servers.test.ts` › “pins the ring positions for a full default server (X = 10, slots 1/2/3/10)” and X = 2; `world.test.ts` › “builds one cube view per member at the exact server-assigned ring position”, “renders at most (X - 1) x 7 meshes for a full X = 10 roster”, “resolves null for a ray that hits only a remote cube view”; `world.test.ts` remote `miniCubeRemoved`/`levelAdvanced`/disposal tests. |
| **AC-14** — Server-authoritative board, optimistic play | **Unmet — F1, F4** | Broadcast/validation matrix is met: `hub.test.ts` › “broadcasts a valid explode to every member of the server including the origin”, “rejects unknown, removed and wrong-level clicks with invalid_click + stateSync to the origin only”; `cubes.test.ts` validation matrix. Optimistic play is met (`engine.test.ts`, `session.test.ts` › “forwards a successful explode…”). **Reconciliation is incomplete:** `session.test.ts` › “treats a consistent ack as a no-op and reconciles stateSync without rollback” only adds server removals; it explicitly asserts a different-level `stateSync` is ignored (lines 1554–1558), and no test can restore a locally-ahead tile because the engine has no add seam (F1). **Rate limit is a fixed window, not a trailing second** (`hub.test.ts:697–741`); the 31st-in-a-trailing-second clause is not met (F4). |
| **AC-15** — Completion validation and server-drawn levels | **Met** | `cubes.test.ts` › `allIds` (54/294), `createNextCube` pinned draws and style cycle, `isComplete` (N²−1 vs N², wrong level); `hub.test.ts` › “advances a completed cube on the same server …” and “rejects incomplete cubes and wrong levels …”. |
| **AC-16** — Users on Server button and panel | **Met (with note)** | `UserPanel.test.tsx` exact markup: toggle `Users on Server`, panel `aria-label="Users on server"`, disabled `Player 1 (You)` first row, member rows `Player 2 · Cube 2`, slot order, empty-roster own-row-only; `App.test.tsx` exact shell strings. Note: the toggle is rendered before `welcome` too (F7), although AC-16 only requires it while playing. |
| **AC-17** — Spectate travel and view-only mode | **Met** | `spectate-travel.test.ts` pinned pose tables for `(0,0,12) → (24,0,12)` (p = 0, .25, .5, .75, 1) and the diagonal `(24,0,12) → (0,24,12)`, identity quaternion at every row; `spectate.test.ts` state machine and second-selection refusal; `engine.test.ts` “ignores every gameplay input while spectating”; `scene.test.ts` flight rendering; `session.test.ts` “flies to a member, gates play while viewing…”. |
| **AC-18** — Return to my cube | **Met** | `UserPanel.test.tsx`/`App.test.tsx`: `Return to my cube` exactly while spectating and absent otherwise; `spectate.test.ts` return transitions; `session.test.ts` “flies to a member … and flies home on return” (camera literals and play resumption). |
| **AC-19** — Spectate edge cases (a–e) | **Met** | `spectate.test.ts` `onMemberLeft` tests (a/b), `reset` tests; `session.test.ts` “auto-returns with the flight when the viewed member leaves”, “reverses home after landing when the target leaves mid-flight”, “keeps viewing the target when their same-server cube advances (AC-19 c)”, “resets a mid-flight spectate to the own rest on a resume welcome (AC-19 d, AC-22)”; `world.test.ts` remote `miniCubeRemoved` exact tile/pop (e). T17 closed the previously missing (c)/(d) assertions. |
| **AC-20** — Catalog and hello-first | **Met (cap note — F5)** | `app.test.ts` › “sends the pinned hello envelope to each concurrent client”; `hub.test.ts` › “attaches a socket without sending anything (hello belongs to the route)”, “answers not_joined …”, “answers bad_message for malformed, unknown and oversized frames”, “rejects a second join or rejoin …”, broadcast-scoping tests; frontend `multiplayer/protocol.test.ts` codec parity. `MAX_CONNECTIONS` is enforced by close after the route’s hello (F5), not by rejecting the upgrade as the spec’s robustness line says. |
| **AC-21** — Heartbeat | **Met** | `hub.test.ts` › “pings every 30 s and terminates at the second missed pong”, “resets the missed-pong count on every pong”, “keeps a socket alive when a pong arrives after two missed pings” (fake timers). |
| **AC-22** — Connection states and offline behavior | **Unmet — F1, F2** | Banner exact texts: `ConnectionBanner.test.tsx` (all four statuses); token/resume over retry: `transport.test.ts`; gating: `session.test.ts` “gates every input while disconnected and resumes after welcome”; mid-flight camera reset: `session.test.ts` “resets a mid-flight spectate …” (T17). **Gaps:** resume after `cubeCompleted` but before `levelAdvanced` leaves the engine in the non-cancellable `nextLevel` hold with no release (F2); board equality is only removal-additive and a welcome at a different level/grid is ignored (F1), so “own cube re-syncs to authority (board equality asserted)” is not met for all reachable resume states. |
| **AC-23** — Intro after welcome; HUD server line | **Met (with note)** | `session.test.ts` “holds the intro at progress 0 until welcome, then adopts the server grid and own slot” (camera far pose, no tap skip); `Hud.test.tsx` exact `Server <id>` line; `App.test.tsx` shell. Pre-welcome the HUD shows `Server 0`; after welcome it shows the authoritative id. |
| **AC-24** — No weakening | **Met** | Full suite **788/788** green, lint/typecheck clean, coverage above thresholds, build gzip 216.30 ≤ 350 KB. The supersession ledger tests (offline, rotation, styles, reduced motion, input) remain green; no banned matcher or snapshot-only test was found in the reviewed files. |
| **AC-25** — Containerization impact | **Met** | Diff contains exactly the documented `compose.yaml` backend `MAX_USERS_PER_SERVER` passthrough and `compose.smoke.yaml` X = 2 / grace = 1000 overrides; no Dockerfile, healthcheck, port, service, README or `podman compose up` change. The backend `/ws` endpoint remains on 8080. |
| **AC-26** — Extended container smoke | **Unverified by reviewer — builder transcript 8/8 on clean stack** | Not rerun per instruction. Builder `build-log-T16.md` §1.1.2 records `SMOKE PASS (8/8 checks)` on a stopped/clean stack (hello-first, two joins, overflow, ack+broadcast, grace leave). The script is not idempotent against a warm backend (F8), which is a harness limitation, not a failure of the clean-stack run. |
| **AC-27** — Glossary terms | **Met (with note — F9)** | `docs/product/glossary.md` contains **game server** (line 33), **server member** (line 68) and **spectating** (line 73), and **cube world position** is extended with the online ring/slot definition (line 25). The **cube level** entry still says “online occupancy of those positions is a future feature” (line 20), contradicting the extended definition (F9, MINOR docs erratum). |

**Summary:** 20 ACs met (several with notes), AC-10 met for its normative fixtures but with a
§4 convergence gap, AC-14 and AC-22 unmet, AC-26 unverified by the reviewer. The blocking
findings are F1–F4.

## 3. Findings

### F1 — BLOCKER — `stateSync`/welcome reconciliation cannot restore local-ahead tiles or adopt a different level/grid

- **Locations:** `src/frontend/src/game/session.ts:339-354` (`reconcileCube`), especially
  `:347-350` (different level/grid returns without reconciling); `:366-405` (`handleWelcome`);
  `src/frontend/src/game/session.test.ts:1522-1568` (the reconciliation test), especially
  `:1554-1558` (a different-level `stateSync` is asserted to be ignored).
- **Problem:** `reconcileCube` only dispatches `explodeMiniCube` for authoritative ids still
  present locally. It never restores a tile that is present on the server but missing locally,
  and it returns early when `levelIndex`/`gridSize` differ. The engine has no add/adopt-board
  seam. A rejected optimistic click (`invalid_click` → `stateSync`) therefore leaves the
  rejected tile permanently missing on the client; the client can never clear or complete that
  cube. A resume/fresh-join welcome at a different level (including `resume_failed` → fresh
  `join` while the engine is at level > 0) leaves the engine on the old board. This is the
  exact correction path AC-14 requires and the board-equality clause AC-22 requires.
- **Required change:** Add an engine seam to adopt an authoritative `{ levelIndex, gridSize,
  styleId, removedIds }` exactly (or rebuild the online engine when the welcome/stateSync
  differs), and make `reconcileCube` compute the exact diff in both directions: remove local
  extras, restore missing tiles, and adopt level/grid/style when they differ. Add tests for
  (a) a locally-ahead tile removed by `stateSync`, (b) a locally-missing tile restored,
  (c) a different-level/stateSync adopted, and (d) a fresh join after `resume_failed` at
  level > 0.
- **Why it matters:** Server authority is unenforceable if the client cannot return to the
  authoritative board; the current behavior soft-locks a client that is ever ahead of the
  server. AC-14 and AC-22 are unmet.
- **Root cause:** implementation gap; `spec_defect: false`.

### F2 — BLOCKER — a resume during the online `nextLevel` hold can strand the client forever

- **Locations:** `src/frontend/src/game/session.ts:388-405` (resume branch cancels only
  `spectate`/`return`), `:397-405` (reconcile/welcome does not release or adopt a held
  `nextLevel`); `src/frontend/src/game/engine.ts` `cancelTravel` guard (documented in
  `build-log-T17.md` §2.1, non-cancellable `nextLevel`); `build-log-T17.md` §8 item 4
  (deliberate boundary).
- **Problem:** If the socket drops after the session sends `cubeCompleted` but before the
  server’s `levelAdvanced`/`worldEntered` arrives, the server has already advanced the member
  and the reconnect `welcome` carries the next cube. `handleWelcome` neither cancels nor
  releases the held travel, and `reconcileCube` ignores the new level. The engine remains in
  `travel` at progress 0 with a null destination, and no further authority message will ever
  arrive. The client is frozen. The existing resume tests cover a landed spectator and a
  mid-flight `spectate`/`return`, but not this `cubeCompleted` → drop → `welcome` window.
- **Required change:** On a resume welcome, adopt the authoritative cube/level and either
  cancel/replace the `nextLevel` hold with the server’s next-cube data or have the server replay
  `levelAdvanced`/`worldEntered` on `rejoin`. Add a test that disconnects after the sixth-face
  clear but before `levelAdvanced`, resumes with a welcome at level L+1, and proves the client
  reaches `playing` on the new board with no stale travel.
- **Why it matters:** A normal reconnect in a narrow but reachable completion window bricks the
  session; AC-22’s resume/re-sync promise is not met.
- **Root cause:** implementation gap (T17 deliberately scoped `nextLevel` out);
  `spec_defect: false`.

### F3 — MAJOR — the move plan is not recomputed after an executed move; §4 convergence fails with ≥3 servers

- **Locations:** `src/backend/src/game/hub.ts:500-528` (`handleCompletion` reads `movePlan`
  and calls `registry.moveMember` but never `recomputePlan`); `:354, :377, :440, :467` are the
  only recompute points (removal, close, join, rejoin). `docs/features/multiplayer-servers/spec.md:69-71`
  (trigger list and convergence claim). `src/backend/src/game/servers.test.ts:126-138`
  (three-server plan leaves p4/p5 behind); `hub.test.ts:881-974` exercises only two servers.
- **Problem:** An executed move is itself a membership change, but the plan is not refreshed.
  With X = 2 and servers `[1: p1,p2] [2: p3,p4] [3: p5]`, p1’s grace expiry plans only
  `{p3:1}` (p4 cannot move to 1, p5 cannot move to 2 while p4 is there). After p3 completes and
  moves, server 2 has a free slot and p5 is still alone on server 3, but no new plan exists and
  p4/p5 will not move until an unrelated join/close/expiry/resume. The §4 claim “converges to:
  all servers except at most the last one full, no empty servers” is therefore false in a
  reachable sequence.
- **Required change:** Decide the intended contract. If convergence is required, recompute (or
  iterate) the plan after every successful execution until no further strictly-decreasing moves
  are available, and add a three-server sequence test. If convergence is not required, correct
  §4 and AC-10’s prose to state the actual trigger semantics. The fix touches the hub/registry
  and spec text, so route the decision to the planner/orchestrator; the code half belongs to
  T5b.
- **Why it matters:** The user-facing packing goal (“pack toward the lowest servers”) is not
  reached; players can remain stranded on a higher server indefinitely in ordinary play.
- **Root cause:** spec/plan internal inconsistency; mark **`spec_defect: true`**.

### F4 — MAJOR — the explode rate limit is a fixed window, not a trailing second

- **Locations:** `src/backend/src/game/hub.ts:476-489` (reset when `now - rate.start >= 1000`,
  then a counter); `src/backend/src/game/hub.test.ts:697-741` (the test titled “trailing second”
  asserts the fixed-window reset at exactly one second).
- **Problem:** The server allows 30 attempts in the last instant of one window and 30 in the
  first instant of the next, i.e. up to ~60 attempts in a rolling second. AC-14 and `tasks.md`
  require the 31st explode within one **trailing** second to be dropped, with at most one
  `rate_limited` error per second.
- **Required change:** Implement a timestamp/deque sliding window (drop when 30 accepted
  attempts are already within the preceding 1000 ms) and add a boundary test with 30 attempts
  at t = 999 ms and one at t = 1000 ms; keep the at-most-one-error-per-second behavior.
- **Why it matters:** The abuse bound is twice the specified rate at window boundaries, and the
  test currently gives false confidence by pinning the wrong semantic.
- **Root cause:** implementation gap; `spec_defect: false`.

### F5 — MINOR — `MAX_CONNECTIONS` closes after the route has already sent `hello`, instead of rejecting the upgrade

- **Locations:** `src/backend/src/app.ts:87-92` (route sends `hello`, then `hub.attach`);
  `src/backend/src/game/hub.ts:564-569` (over-cap sockets are closed in `attach`).
  `docs/features/multiplayer-servers/spec.md:131` says “beyond it, upgrades are rejected”;
  `hub.test.ts:589` only asserts the close.
- **Problem:** An over-cap connection completes the WebSocket upgrade and receives a `hello`
  before being closed. No member state is created, so the safety bound holds, but the protocol
  contract (“upgrades are rejected”) is not literally met and the client sees a misleading
  hello-then-close.
- **Required change:** Expose a capacity check before the route sends `hello` (or reject the
  upgrade) and close/deny the excess socket without a hello; pin the order in `app.test.ts`.
- **Why it matters:** Minor protocol/robustness defect; low risk because no state is allocated.
- **Root cause:** implementation gap; `spec_defect: false`.

### F6 — MINOR — move-plan donors are taken in slot order, not join order

- **Locations:** `src/backend/src/game/servers.ts:158-176` (iterates `server.members`, the slot
  table); `docs/features/multiplayer-servers/spec.md:69` says donors are “in join order”;
  `servers.test.ts:97-105` uses a dense fixture where slot order equals join order.
- **Problem:** When a server has a hole and a later join fills a lower slot, slot order differs
  from join order. The plan then chooses a different donor than the spec’s ordering rule; AC-10
  says “both members of 2 planned to 1 (in join order)”.
- **Required change:** Track join sequence per member (or document that slot order is the
  intended donor order and correct the spec), and add a hole/join-order fixture.
- **Why it matters:** Deterministic but spec-divergent move selection when capacity is
  contested; low impact in the default no-hole path.
- **Root cause:** implementation/spec divergence; `spec_defect: false` (spec is clear; the
  implementation and a missing test are the issue).

### F7 — MINOR — the Users on Server toggle and `Server 0` are visible before `welcome`

- **Locations:** `src/frontend/src/App.tsx:87-95` (panel and HUD always rendered);
  `src/frontend/src/App.test.tsx:170-183` (pins the initial `Server 0` shell);
  `spec.md:200` (“While playing, the shell renders a button…”).
- **Problem:** Before any `welcome`, the shell renders an enabled `Users on Server` button
  whose open panel has a blank own row (`world.self.name` is empty), and the HUD shows
  `Server 0`. This is a small UI/state-display inconsistency during intro/connecting.
- **Required change:** Gate the panel on a welcomed/world-server state (or render it disabled
  with a neutral placeholder) and document the pre-welcome HUD value; update the SSR test.
- **Why it matters:** Cosmetic and low-risk; no shared state is affected.
- **Root cause:** implementation/UI gap; `spec_defect: false`.

### F8 — MINOR — the smoke harness is not idempotent on a warm backend

- **Location:** `docs/features/multiplayer-servers/build-log-T16.md` §1.1.2 and §7 F7;
  `tests/e2e/smoke.mjs` (hard-coded server ids 1/2).
- **Problem:** `compose run` reuses a running backend; server ids are never reused, so a second
  smoke run against a warm stack sees ids 3/4 and fails 6/8 checks. The documented clean-stack
  procedure passes 8/8, but the harness itself is fragile.
- **Required change:** Recreate/restart the backend in the smoke path or assert id-relative
  behavior instead of hard-coded ids; record both warm and clean runs.
- **Why it matters:** CI/local verification can fail for an environment reason, masking real
  regressions; AC-26’s clean-stack transcript remains valid.
- **Root cause:** test-harness design; `spec_defect: false`.

### F9 — MINOR — the glossary’s `cube level` entry still says online occupancy is a future feature

- **Location:** `docs/product/glossary.md:20` (“online occupancy of those positions is a future
  feature”), contradicted by the extended `cube world position` entry at `:25` and AC-27
  (`spec.md:220`).
- **Problem:** The required three terms and the `cube world position` extension are present, but
  the old parenthetical is now false and misleads readers about the shipped multiplayer layout.
- **Required change:** Remove/replace the stale parenthetical in a docs erratum; do not redefine
  other terms.
- **Why it matters:** Documentation accuracy only; no runtime impact.
- **Root cause:** docs artifact; `spec_defect: false`.

### F10 — MINOR (spec defect) — AC-10’s fixture text contradicts itself

- **Location:** `docs/features/multiplayer-servers/spec.md:188` (the AC-10 line): the first
  fixture says `[1: X members, 2: 1] → { p2: 1 }`, while the later fixture says
  `[1: X, 2: 1] → empty plan`.
- **Problem:** The implementation and `servers.test.ts:90-113` follow the normative §4 rule
  (free slots, strictly lower targets): `[1: X−1, 2: 1] → { p2: 1 }` and
  `[1: X, 2: 1] → {}`. The spec line is self-contradictory; a reviewer cannot use it literally.
- **Required change:** Planner/orchestrator corrects the AC-10 fixture prose to the §4
  resolution (`X−2`/`X−1` cases as appropriate); no code change is required for the pinned
  fixtures already tested.
- **Why it matters:** Documentation/spec defect that can cause future implementations to pin
  the wrong behavior.
- **Root cause:** spec text; mark **`spec_defect: true`**.

### F11 — INFO — T5 prose says the hub sends `hello`; the route owns it

- **Location:** `docs/features/multiplayer-servers/tasks.md:77` (“attach sends exactly `hello`
  first”) versus `src/backend/src/app.ts:87-92` and `hub.test.ts:208` (“hello belongs to the
  route”).
- **Problem:** The delivered behavior is correct and matches `plan.md`’s route-owned design, but
  the task text is stale.
- **Required change:** Update the task prose in the docs erratum; no code change.
- **Why it matters:** Prevents a future builder from duplicating `hello` if they follow the
  task text literally.
- **Root cause:** task artifact; `spec_defect: false`.

## 4. Deviation adjudications

| Deviation | Adjudication | Rationale |
| --- | --- | --- |
| **T8** — optional base engine snapshot fields with `OnlineEngineSnapshot` narrowing | **Accepted — INFO** | Compatibility seam for pre-online fakes; online behavior is pinned by `engine.test.ts`/`session.test.ts`. No shared-state or AC effect found. |
| **T9** — no client inbound `MAX_MESSAGE_BYTES` cap; optional `TransportOptions.url` | **Accepted — INFO** | The cap is a backend receive-path bound; server frames (`welcome`, `stateSync`) legitimately exceed 1024 B. The URL option is a test seam with the pinned `ws://localhost:8080/ws` default retained (`transport.ts:84-100`). |
| **T10** — remote face clear waits the accepted 400 ms `faceFadeMs` | **Accepted — INFO** | The spec retains face-fade pacing and the pop/burst visibility; `scene.test.ts` pins 399 ms present / 400 ms removed. No shared-state or authority effect. |
| **T13** — remove-only `stateSync` | **Rejected — F1 (BLOCKER)** | Directly contradicts AC-14’s full authoritative board / removed-set equality and AC-22’s board equality; produces a permanent missing-tile desync. |
| **T13/T17** — mid-flight reconnect cannot reset the `nextLevel` hold | **Rejected — F2 (BLOCKER)** | T17 closed the camera-only case but explicitly excluded `nextLevel`; a drop in the completion window leaves the client frozen. |
| **T14** — Users on Server toggle before `welcome` | **Accepted with note — F7 (MINOR)** | AC-16 only mandates the button while playing; the pre-welcome blank row/`Server 0` is a small UI defect, not a data-integrity issue. |
| **T16 F7** — smoke non-idempotent on a warm backend | **Accepted with note — F8 (MINOR)** | The clean-stack procedure passes 8/8; the harness fragility is a follow-up, not an AC-26 failure on the documented procedure. |
| **T5** — route-owned `hello` | **Accepted — F11 (INFO)** | Correct behavior; tasks prose needs a doc correction. |
| **AC-10 fixture contradiction** | **Spec erratum — F10 (MINOR, `spec_defect: true`)** | Code follows §4; spec text needs correction. |
| **Glossary `cube level` stale parenthetical** | **Docs erratum — F9 (MINOR)** | Required AC-27 terms are present; remove the obsolete “future feature” claim. |

## 5. Ordered fix list

1. **T17b — BLOCKER — F1.** Add the authoritative board/level adoption seam and make
   `stateSync`/welcome reconcile exact `removedIds` in both directions; add the four tests in
   F1. This is the highest-priority fix.
2. **T17b — BLOCKER — F2.** Release or replace the online `nextLevel` hold on resume, or replay
   `levelAdvanced`/`worldEntered` on `rejoin`; add the `cubeCompleted` → drop → `welcome` test.
3. **T5b — MAJOR — F4.** Replace the fixed-window rate limiter with a true trailing-second
   window and add the boundary test.
4. **T5b + planner decision — MAJOR (`spec_defect: true`) — F3.** Recompute/iterate the move
   plan after executed moves for true §4 convergence, or correct the §4/AC-10 convergence
   contract; add a three-server sequence test.
5. **T5b — MINOR — F5.** Enforce `MAX_CONNECTIONS` before the route sends `hello` (reject the
   upgrade) and pin the order.
6. **T5b — MINOR — F6.** Track join order for donors (or correct the spec) and add a
   hole/join-order plan fixture.
7. **T17b/T14b — MINOR — F7.** Gate the Users panel and placeholders on a welcomed/server
   state; update the SSR test.
8. **T15b — MINOR — F8.** Make the smoke path idempotent on a warm backend (restart/recreate
   or id-relative assertions).
9. **Docs erratum (planner/orchestrator) — MINOR — F9, F10, F11.** Correct the glossary’s
   `cube level` parenthetical, the AC-10 contradictory fixtures, and the T5 `hello` task prose.
10. **No action — INFO.** T8 optional snapshot fields, T9 client-side frame cap/URL seam, and
    T10 face-clear timing are accepted as documented.

## 6. Residual risks and verification limits

- **Smoke:** unverified by the reviewer; builder transcript 8/8 on a clean stack. The warm-stack
  non-idempotency is F8.
- **Manual browser/WebGL:** not executed by the reviewer. The SSR tests and fake renderer cover
  the markup/wiring; real GPU rendering remains the documented manual residual.
- **Coverage:** above thresholds in both workspaces; entrypoint-only exclusions are justified.
- **Security/config:** no new dependencies, no secrets, no `.env*` edits, no storage/persistence;
  compose changes are exactly the documented passthrough/overrides. The rate-limit boundary
  (F4) is the remaining security-relevant defect.
- **Boundaries:** no protected file, Dockerfile, package file, README, or `main.tsx`/`index.html`
  was changed by this review.

## 7. Verdict

**`changes_requested`** — 2 BLOCKER (F1, F2) + 2 MAJOR (F3, F4) = **4 blocking findings**.
The feature is close on the broad surface (788 tests, strong coverage, exact UI/protocol
evidence), but the authoritative-board reconciliation and the completion-window resume are
core real-time correctness failures and must be fixed before acceptance.
