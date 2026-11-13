---
feature: realtime-broadcast-batching
revision: 3
status: draft
created: 2026-11-13
updated: 2026-11-13
---
# Spec — Real-Time Broadcast Batching

## Summary

The multiplayer hub currently serializes every server message once **per recipient** and deep-copies the whole server registry on every broadcast and every location lookup. Each accepted mini-cube removal is broadcast immediately, and each accepted account click resolves a database credit and then broadcasts an absolute `economyUpdate` to every connection of that account. With ten members on a server clicking at the accepted 30/s cap, one click costs ten `JSON.stringify` calls, a full registry snapshot, and ten sends; a clicking account additionally produces up to 30 economy frames per second. This feature keeps the single-process, server-authoritative architecture and changes only the outbound path: each server message is encoded **once** and the same string is fanned out; the registry gains an O(1) `locationOf` index and a no-copy `forEachMember` visitor while the defensive `servers()` snapshot survives for tests and other callers; accepted mini-cube removals are coalesced into a 40 ms window and delivered as one `miniCubesRemoved` batch (with the legacy `miniCubeRemoved` shape when exactly one id is pending); and credit-driven economy updates are coalesced to at most 4 Hz per account with absolute totals, ordered by a monotonic per-account write revision so an older async result can never regress the published totals, while database writes remain one-per-click. A dependency-free Node 24 benchmark records the before/after numbers. Raw request: "Please, find any kind of performance optimizations we can do on project and, also, find new skills we added and provide some new features you think are good to have" followed by "Proceed with all of them, one by one"; this is the next performance feature in the approved audit queue.

## Context and audit evidence

Verified by the read-only audit (file:line at the time of planning):

- `src/backend/src/game/hub.ts:333-363` — `send()` calls `encodeServerMessage` (JSON.stringify) for every recipient; `broadcast()` loops the server's members and encodes the same message once per member.
- `src/backend/src/game/servers.ts:274-276` — `servers()` maps every server to a fresh object and copies every member array; `hub.ts:352-353, 371-379, 412-413` call it on hot broadcast, location and roster (`rosterFor`) paths.
- `src/backend/src/auth/economy-repository.ts:551-572` — `credit()` is an async `UPDATE ... RETURNING` that returns the row state after its own write; two concurrent credits can resolve out of order, so promise-resolution order is not write order and an older absolute state can otherwise overwrite a newer one.
- `src/backend/src/game/hub.ts:787-800` — every accepted explode credits the economy asynchronously and calls `broadcastEconomyUpdate`, which loops all connections of the account and encodes per connection.
- `src/backend/src/game/hub.ts:866-890` — cube completion performs two independent DB writes and two account broadcasts.
- `src/backend/src/game/hub.ts:615-639` — join performs five separate queries; explicitly out of scope.
- Mini-cube removals are sent per click as `miniCubeRemoved`; both protocol mirrors are `src/backend/src/game/protocol.ts` and `src/frontend/src/multiplayer/protocol.ts`; the frontend reducer is `src/frontend/src/multiplayer/server-state.ts`.
- The stack is a single backend process with in-memory servers and Postgres only for accounts/economy. No Redis, queues or microservices exist and none are added.

## User stories

- As a player sharing a server with ten active players, I want a click burst to cost one shared update per burst, not one frame per click per recipient, so the world stays smooth under load.
- As a spectator, I want remote cube removals to remain correct after I disconnect and resume, even if a batch was in flight when my socket dropped.
- As an account holder, I want my coins, clicks and destruction totals to remain exact while the HUD updates at a bounded, smooth rate and upgrades/purchases stay immediate.
- As a maintainer, I want both protocol mirrors to agree on every new frame and a repeatable before/after benchmark that records the five cost metrics.

## Acceptance criteria

### Encode-once fan-out

- **AC-1** — With ten joined members on one server, one server broadcast (a `memberLeft` message and a two-id removal batch are both exercised) serializes the message exactly once: a `JSON.stringify` spy counts exactly one serialization of that message, and all ten peers receive byte-identical text.
- **AC-2** — A peer whose `send` throws does not stop delivery to the remaining members: every other open peer still receives the frame, the throwing peer is closed, and its connection is removed through the normal close path.
- **AC-3** — With three joined connections of one account, each of `economyUpdate`, `upgradesUpdate` and `customizationUpdate` is serialized exactly once and the three peers receive byte-identical text.

### Registry index

- **AC-4** — `registry.locationOf(playerId)` returns the same `{ serverId, slot }` as the `servers()` snapshot for every live member after every step of a deterministic 200-operation assign/remove/move sequence (covering holes, refilled slots and destroyed servers), and returns `null` for an unknown member.
- **AC-5** — `registry.forEachMember(serverId, visit)` visits exactly the occupied slots of that server in ascending slot order, skips holes, and visits nothing for an unknown or destroyed server; the visitor receives only primitives, so no mutable slot table escapes.
- **AC-6** — `servers()` keeps its defensive-copy contract: mutating a returned snapshot (members array, entries, or the array itself) never changes the registry, and the pre-existing snapshot test passes unchanged.
- **AC-7** — During a join, an accepted explode plus flush, a completion, a rotate and a grace-expiry removal, the hub calls `registry.servers()` exactly zero times (verified through an injected counting registry); the default registry still serves `servers()` to tests and external callers.

### Mini-cube removal batching

- **AC-8** — Two or more accepted removals for one member inside one 40 ms window produce exactly one `miniCubesRemoved { playerId, ids }` per recipient, with `ids` in acceptance order and no `miniCubeRemoved` for those ids: for example, two accepted clicks yield `{"type":"miniCubesRemoved","playerId":"p1","ids":["front:0:0","front:0:1"]}`.
- **AC-9** — Exactly one pending id at flush time produces the legacy `miniCubeRemoved { playerId, id }` shape, byte-identical to today's frame, so a single click (and a mixed-version client) still sees the accepted message.
- **AC-10** — A burst of 25 accepted removals in one window produces exactly one removal frame per recipient, not 25; two members with ten removals each produce at most two batch frames (one per member), never a per-click frame.
- **AC-11** — Boundary ordering: pending removals for a server are flushed synchronously before any `levelAdvanced`, `memberJoined`, `memberLeft` or `welcome` for that server, so each recipient's frame order is removal batch → boundary message.
- **AC-12** — Cross-server isolation: a batch records the server where its removals were accepted and is delivered only to that server's members; a mover's completion flushes their batch to the old server before `memberLeft (moved)` and never delivers it to the new server.
- **AC-13** — Reconnect authority: if a member's socket is closed when a batch flushes and the member later rejoins with its token, the `welcome` carries every accepted removal in `self.removedIds` and in the roster entry; the authoritative removed set is unchanged by the missed batch. `stateSync` (sent after an invalid click) likewise remains a full authoritative board.
- **AC-14** — A batch frame for the maximum one-window burst (30 ids, the accepted click cap) is at most 1024 bytes, and `MAX_MESSAGE_BYTES` (1024) and every existing client-frame limit stay unchanged.
- **AC-15** — Timer and shutdown hygiene: `hub.close()` sets a closed guard, clears the removal flush timer and every economy timer, and makes late client frames and late credit/purchase continuations inert; advancing fake timers after close produces no sends and no callbacks (AC-30).

### Protocol and client consumption

- **AC-16** — The backend builder/encoder and the frontend decoder agree on the exact `miniCubesRemoved` frame: the frontend decodes the backend's encoded fixture to `{ type, playerId, ids }` with a copied array; both reject a missing/empty `playerId`, missing/non-array/empty `ids`, and non-string/empty ids; the backend builder performs full runtime validation (`typeof playerId === 'string' && playerId.length > 0`, `Array.isArray(ids)`, `ids.length > 0`, every id a non-empty string) and copies its input. No protocol version bump is made, and no existing message shape changes.
- **AC-17** — `reduceWorldState` applies every id in a batch exactly once and idempotently (duplicate ids and replayed frames return the same state reference when nothing changes), for both the self board and a remote member; `WorldView.applyMessage` applies every batch id to the member's live view; `session` reconciles every self id through `applyAuthoritativeRemoval`.
- **AC-18** — `miniCubesRemoved` is proven end-to-end by a single frontend integration test: the exact backend frame is emitted through a real `createTransport` with a fake WebSocket socket (the real decoder path), then the real `reduceWorldState` (via the session), the real session self-reconciliation, and a fake scene whose `applyWorldMessage` delegates directly to a real `createWorldView(...).applyMessage`; it covers two ids, self and remote, a duplicate frame, an unknown member, and a malformed frame dropped by the decoder with no state change.

### Economy coalescing

- **AC-19** — Thirty accepted account clicks resolved within one 250 ms window produce exactly one `economyUpdate` per joined connection of that account, carrying the **highest-revision** absolute totals (for no upgrades: `coins: 3`, `clicks: 30`, `facesDestroyed` and `cubesDestroyed` as accumulated), never a delta; the repository still receives exactly thirty one-write-per-click calls (AC-29 pins the revision ordering).
- **AC-20** — Automatic economy broadcasts are limited to at most four per account per second: updates queued at t=0 and t=100 produce one frame; updates queued at t=0 and t=300 produce two; a 1000 ms stream of accepted clicks produces at most four automatic frames per account.
- **AC-21** — Account actions force an immediate flush: a purchase whose economy revision is newer than the last applied economy sends exactly one `economyUpdate` with its post-purchase totals and cancels the pending automatic economy flush, while a purchase whose economy revision is older never regresses the economy. A purchase's `upgrades` apply and broadcast **only when its purchase revision is newer than `lastAppliedUpgradeRevision`** (a separate guard from the economy), so two purchases resolving out of order cannot let the older absolute `upgrades` overwrite the newer `member.upgrades` or emit an older `upgradesUpdate`; a later credit does not suppress a newest purchase's upgrade frame. Join-time idle credit keeps today's immediate pre-`welcome` `economyUpdate`.
- **AC-22** — Reconnect during a pending coalesced update: a rejoin `welcome` carries the latest in-memory absolute economy (the highest applied revision) and the latest applied upgrades — including when another connection of the account already holds a newer applied revision than the join read — so no client-side delta reconstruction is required; a coalesced flush that fires with no joined account connection returns before encoding and sends nothing (no `JSON.stringify` call), and `hub.close()` sends nothing afterwards (AC-30).
- **AC-23** — Database writes are unchanged: one economy write per accepted click (`creditWithRevision`, or the equivalent one-write method) and the existing completion `creditWithRevision`/`grantCustomization` calls remain at their current call sites and timing; the revision is a write-order stamp on that same write, not write-behind, batching or deferred persistence.

### Proof, docs and quality gates

- **AC-24** — `tests/bench/realtime-broadcast.mjs` is dependency-free beyond Node 24 and the existing `tsx` dev dependency. `--mode in-process` exits 0 and prints one JSON object containing `encodeCallsPerBroadcast`, `registrySnapshotsPerBroadcast`, `removalFramesPer100Clicks`, `economyFramesPer100Clicks`, `dbCreditsPer100Clicks` and `maxRemovalFrameBytes`; `--mode wire` exits 0 against a running backend and adds `p95AckLatencyMs` and per-client frame counts. Every documented command includes `--json`, and all counters are reset after the ten joins/`welcome` setup so the measured window is only the 100-click burst.
- **AC-25** — Same-machine before/after targets are met and recorded: `encodeCallsPerBroadcast` 1 over the post-setup 100-click burst (baseline 10 on a ten-member server), `registrySnapshotsPerBroadcast` 0 (static baseline: `broadcast` + `locationOf`, 2 per accepted click), `removalFramesPer100Clicks` ≤ 8 for four 25-click bursts (baseline 100), `economyFramesPer100Clicks` ≤ 16 over the same ~3.3 s run (baseline 100), `dbCreditsPer100Clicks` = 100 (unchanged), `maxRemovalFrameBytes` ≤ 1024, and `p95AckLatencyMs` ≤ baseline + 60 ms.
- **AC-26** — `npm run smoke` passes with a new check that two explodes sent in one event-loop turn (`front:0:1` then `front:0:2`, after the existing `front:0:0` single-click check) produce one `miniCubesRemoved` carrying both ids in that order on the origin and on a second client, while the existing single-click check still receives `miniCubeRemoved`; neither `front:0:1` nor `front:0:2` appears in any single `miniCubeRemoved` frame on either client.
- **AC-27** — Documentation reflects shipped behavior: `docs/architecture/realtime.md` exists with the sections `## Fan-out`, `## Removal batching`, `## Economy coalescing`, `## Reconnect and authority` and `## Benchmark`; every relative link resolves; `README.md` documents the benchmark commands; no documentation claims a behavior the code does not have.
- **AC-28** — Quality gates pass: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (≥ 80% statements/branches/functions/lines in each workspace), `npm run build` and `npm run smoke`; `compose.yaml`, `compose.smoke.yaml`, every Dockerfile, `package.json` and `package-lock.json` are unchanged.

### Economy ordering and shutdown

- **AC-29** — Per-account write results are ordered by a monotonic revision: every economy write (`creditWithRevision` and `purchaseUpgrade`) atomically increments `user_economy.economy_revision` and returns it. The hub keeps two guards: `lastAppliedRevision` for economy totals (apply/queue only when newer; the coalescer keeps the highest-revision pending snapshot) and **`lastAppliedUpgradeRevision`** for upgrades (apply/broadcast only when the purchase revision is newer than the last applied purchase). A two-purchase out-of-order test resolves the older purchase last and asserts the final `member.upgrades` and the only `upgradesUpdate` are the newer purchase's, the older upgrades never overwrite them, and a subsequent accepted explode's credit delta uses the newer multiplier (no under-credit); the test also resolves a later credit before an earlier one and races a purchase against a credit, asserting the final economy frame equals the repository's final absolute economy with no regression. One `purchaseUpgrade` DB write remains.
- **AC-30** — After `hub.close()`, the hub is closed: `handleMessage` drops late client frames (no membership mutation, no removal timer, no send), `attach` closes a late peer, and every async continuation returns before updating members, queueing a timer or broadcasting — including **`handleJoin` after each of its repository awaits** (no `registry.assign`, `members.set`, `tokens.set`, `connection.playerId`, `recomputePlan`, timer or send when a join that started before close resumes). A pending removal batch and pending economy state are discarded; advancing fake timers after close yields zero sends and zero callback invocations. The removal batcher and economy coalescer make `enqueue`/`queue`/`flush` inert after `discard()`.

## Non-goals

- No DB write-behind, batched credits or deferred persistence — that is the separate `economy-write-behind` feature.
- No join-query optimization (the five queries in `handleJoin`) and no account/auth/identity changes.
- No new service, queue, cache, Redis, worker or multi-process architecture; the single-process in-memory hub stays.
- No protocol version bump or negotiation; the frontend and backend deploy together, and the single-id legacy shape limits mixed-version exposure. Mixed-version behavior is documented, not supported indefinitely.
- No client visual or rendering redesign: the only client changes are protocol decoding, world-state reduction, session reconciliation and applying the new frame to existing remote-cube visuals.
- No slow-client queue, `bufferedAmount` policy, drop/replace-on-backpressure policy or per-client outbound buffer (see Real-time contract; a follow-up candidate).
- No message fusion of the completion path's `economyUpdate` and `customizationUpdate`; each is encoded once and sent as its own frame (see Key decisions).
- No changes to the 30/s click rate limit, rotation limit, heartbeat, reconnect grace, server capacity or ring layout.
- No container, compose, Dockerfile, CI workflow or package-script change; no new npm dependency.
- No benchmark in the CI gate; it is reproducible evidence recorded in build logs (Q-4).

## Boundaries

- ✅ Always: keep the server authoritative for boards and economy; encode a broadcast once; use the registry index on hot paths; use injected/fake timers and deterministic clocks in tests; run lint, typecheck, tests, coverage, build and smoke; record raw benchmark JSON in the build log; update documentation in the same change as the behavior.
- ⚠️ Ask first: changing the 40 ms batch window or the 250 ms economy interval; changing the new frame shape or flush boundaries; adding a dependency, npm script or CI gate; changing protocol versioning; enabling any slow-client policy.
- 🚫 Never: encode a broadcast per recipient; deep-copy the registry inside a broadcast or location lookup; send economy deltas instead of absolute totals; expose or mutate registry internals; batch or defer database writes; commit secrets or edit `.env*`; `git push`.

## Real-time contract

**Server authority.** The hub remains the only authority for shared state. A removal is written to `member.cube.removedIds` at acceptance, before any message is queued; an economy credit is applied to `member.economy` from the repository's absolute result. Batching changes when and in what shape a notification is sent, never what the server believes. No client-supplied value becomes authoritative.

**Per-server ordering.** `broadcast(serverId, message)` encodes once and synchronously walks the server's current slot table, sending to every member with an open socket (the origin included, as today). Frames for a socket are therefore emitted in the order the hub calls `broadcast`, and Node's `ws` preserves per-socket order. A flush is an ordinary broadcast at the moment it runs; because boundaries flush synchronously before level/membership messages, every recipient sees a level's removals before that level's `levelAdvanced`, and removals before `memberLeft`/`memberJoined` for the same server.

**Flush boundaries.** The removal batcher flushes on: its 40 ms timer; a successful `cubeCompleted` (before the cube is replaced and before `levelAdvanced`/`worldEntered`/`memberLeft`/`memberJoined`); `join` and `rejoin` (before `welcome`/`memberJoined`); final removal after grace expiry (before `memberLeft`); and `hub.close()` (discard, no sends). Rotation does not flush because orientation is independent of the removed set. An invalid click's `stateSync` carries the complete authoritative board, so a subsequent duplicate batch is an idempotent no-op.

**Reconnect and `stateSync`.** The hub keeps no per-client outbound queue; a batch is a presentation delta, not state. A member that disconnects during a window receives no batch; its `rejoin` `welcome` carries the authoritative `self.removedIds` and the roster entries, and the client reducer replaces the board. A missed or dropped batch can therefore leave a remote cube visually stale only until the next authoritative snapshot or reconnect; it cannot corrupt state. The server's removed set is never recomputed from a batch at flush time.

**Multi-client and identity.** Every joined connection of a server receives the same encoded batch. Every joined connection of an account receives the same encoded economy frame with absolute totals; multi-tab accounts cannot diverge by applying deltas. Batching and coalescing apply equally to guests and accounts for removals; economy coalescing applies only to accounts (guests have no persisted economy and receive no `economyUpdate`, as today). No identity, token, session or account-resolution behavior changes. No identity-versus-accounts conflict arises: guest play stays first-class and unchanged, batching applies equally to guests and accounts, and economy coalescing applies only to accounts.

**Cross-server state.** A batch is keyed by the server recorded when its removals were accepted. Membership boundaries flush before a move or removal, so a batch never crosses servers, and no shared value is introduced across servers.

**Economy result ordering.** Every economy write (click credit, completion credit, idle credit and purchase) atomically increments a per-account `economy_revision` in the same statement and returns the post-write absolute totals with that revision. It is still exactly one write per event; the revision is a write-order stamp, not a second write and not write-behind. The hub keeps **two** guards: `lastAppliedRevision` for economy totals (apply/publish only when the revision is greater; the coalescer stores only the highest-revision pending snapshot) and `lastAppliedUpgradeRevision` for purchase upgrades (apply/broadcast only when the purchase revision is greater). A late older credit is dropped even if its promise resolves after a newer one. A purchase's `upgrades` are ordered independently of economy totals: an older purchase resolving after a newer purchase never overwrites `member.upgrades` or emits an older `upgradesUpdate`, while a newest purchase still applies its upgrades even when a later credit has already pushed the economy revision higher (credits do not change upgrades). This keeps `miniCubeMultiplier`/`cubeMultiplier` — which read `member.upgrades` for later credit deltas — on the newest purchase. A rejoin `welcome` carries the latest applied absolute economy and upgrades. The revisions are read on join (`findEconomySnapshot` and `findUpgradesSnapshot`) so an in-flight older result cannot beat the persisted baseline.

**Shutdown.** `hub.close()` flips a closed flag before clearing state. A late client frame is dropped before decoding/validation; a late peer `attach` is closed; every async continuation — including **`handleJoin` after each repository await** — checks the flag before touching membership/tokens, updating members, scheduling or sending; the batcher/coalescer `discard()` clears timers and makes later `enqueue`/`queue` no-ops. No timer, callback, send or membership mutation can happen after close.

**Slow clients.** Out of scope. `Peer.send` is fire-and-forget and the transport (`ws`/TCP) owns buffering and backpressure; this feature adds no per-client queue, no drop/replace policy and no `bufferedAmount` close threshold. The only new behavior is error isolation: if one `peer.send` throws synchronously, that peer is closed (through the normal close path) and the remaining fan-out continues. A user-space slow-client policy is a separate follow-up because it needs a bounded-queue, drop/close decision and its own tests; AC-2 and AC-18 pin the behavior this feature does implement.

**Connection lifecycle.** All new timers use the injected `HubTimers` and are cleared by `hub.close()`; the closed guard makes late frames and late async continuations inert, no timer survives shutdown, and no send happens after close. Heartbeat, grace, capacity and rate-limit behavior are unchanged.

## Security considerations

- `miniCubesRemoved` is server-to-client only; a client cannot forge it (the client catalog has no such message). Every id is a server-generated `MiniCubeId` from a validated explode against the authoritative board; there is no user-controlled free text in the frame.
- The frontend decoder validates presence, type and non-emptiness before handing the payload to the reducer, copies the `ids` array, and rejects malformed frames through the existing `bad_message` path.
- Memory is bounded: per member, at most 30 ids can be accepted in a trailing second, so one window holds at most 30 ids; per account, the coalescer stores one `EconomyState` and one timer. No unbounded outbound queue is introduced.
- A burst cannot amplify traffic: N accepted clicks produce at most one batch frame per recipient per window, and a single-id flush uses the smaller legacy frame. The 1024-byte server-frame bound is pinned for a 30-id batch.
- No new dependency, no secrets, no new environment variable, no PII on the wire (player id, mini-cube id and economy totals only).
- Database integrity is unchanged: the same credit and customization writes at the same call sites; no client input reaches a write as a result of this feature.

## Containerization impact

No new service, image, port, environment variable, health signal or deployable is added. The backend container keeps `GET /healthz` and the `GET /ws` WebSocket upgrade on port 8080; `compose.yaml`, `compose.smoke.yaml`, `src/backend/Dockerfile` and `src/frontend/Dockerfile` are unchanged, and `podman compose up` remains the single-command local environment. The benchmark runs from the host against the published loopback port (`ws://localhost:8080/ws`) or, if the host cannot reach it, inside the existing backend container with the same command; neither path changes the container definitions. Per `docs/architecture/containerization.md`, this feature reopens no settled convention.

## Testing strategy

- **Unit (backend):** `servers.test.ts` for `locationOf`, `forEachMember`, the index-vs-snapshot invariant and the unchanged defensive `servers()`; `broadcast.test.ts` for the removal batcher and revision-aware economy coalescer using injected fake timers (window start, cadence, boundary flush, discard, highest-revision-wins, lower-revision drop, no duplicate flush, inert after `discard`); `protocol.test.ts` for the `miniCubesRemoved` builder's full runtime validation (non-array/empty/non-string ids and empty player), defensive copy, exact encoded frame and 1024-byte bound; `auth/economy-repository.test.ts` for the monotonic revision returned by `creditWithRevision`/`purchaseUpgrade`, `findEconomySnapshot` and `findUpgradesSnapshot`; `db/migration-007.test.ts` for the additive `economy_revision` column.
- **Integration (backend):** `hub.test.ts` drives the real hub, real registry, real protocol builders and `InMemoryEconomyRepository` (plus a deferred wrapper for out-of-order results) through fake peers — encode-once counts, byte-identical fan-out, send-error isolation, zero `servers()` calls via an injected counting registry, batching shape/order/boundaries/cross-server/reconnect, economy coalescing/forced flushes/timer hygiene, **two-purchase out-of-order upgrade ordering with the newer multiplier used by a later credit (no under-credit)**, out-of-order credit and purchase-vs-credit economy ordering with no regression, **shutdown after pending state, a late credit, an in-flight `handleJoin` resolving after close, and a late client frame**, and unchanged message payloads. The pre-existing suite is adapted only by inserting flush steps; no expected payload is loosened.
- **Unit (frontend):** `multiplayer/protocol.test.ts` valid/invalid `miniCubesRemoved` frames and parity with the backend literal; `multiplayer/server-state.test.ts` batch idempotence and referential stability; `multiplayer/transport.test.ts` a raw batch frame reaches the decoder; `game/session.test.ts` self reconciliation for every id; `render/world.test.ts` every id applied to the member's live view.
- **Integration (frontend):** one explicit chain test in `game/session.test.ts` using the exact backend frame: a real `createTransport` with a fake WebSocket socket (the real decoder path) → real `reduceWorldState` (through the session) → session self reconciliation → a fake scene whose `applyWorldMessage` delegates to a real `createWorldView(...).applyMessage`, covering two ids, self and remote, a duplicate frame, an unknown member and a malformed frame dropped with no state change.
- **E2E (containerized):** `npm run smoke` with the new one-burst check on two real WebSocket clients; the existing single-click `miniCubeRemoved` check stays green.
- **Benchmark (evidence, not CI):** `tests/bench/realtime-broadcast.mjs` in-process and wire modes; commands and targets in § Benchmark methodology.
- **Coverage:** `npm run coverage` — ≥ 80% statements, branches, functions and lines in each workspace. Behavior-change tasks use the workspace-scoped pre-gate form (`npm run coverage --workspace @cubeclicker/backend` / `@cubeclicker/frontend`); the final task runs the root command.
- **Assertion bar:** concrete expected values and exact arrays/objects; no wildcard matchers (`expect.any`, `expect.objectContaining` as a substitute for a pinned payload), no snapshot-only tests, no assertion-free tests; fake timers and the injected clock, never real sleeps; no wall-clock performance assertion in unit tests (performance is measured by the benchmark).
- **Commands:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `npm run smoke`; benchmark commands in § Benchmark methodology.

## Benchmark methodology

Two modes in one zero-dependency script, `tests/bench/realtime-broadcast.mjs`:

| Mode | Command | What it measures |
| --- | --- | --- |
| in-process | `node --import tsx tests/bench/realtime-broadcast.mjs --mode in-process --json` | hub + real registry + `InMemoryEconomyRepository` + fake peers and a manual clock: encodes per broadcast, registry snapshots per broadcast, removal/economy frames per 100 clicks, DB credits per 100 clicks, max removal-frame bytes |
| wire | `node tests/bench/realtime-broadcast.mjs --mode wire --json` (backend running) | real WebSocket clients against `ws://localhost:8080/ws`: removal frames per 100 clicks per recipient and p95 click→removal-ack latency |

**Load shape.** 100 clicks delivered as four bursts of 25 (1.1 s apart) so each burst stays inside the accepted 30/s trailing window and exercises one flush window. The clicker is an account in in-process mode (to include economy frames) and a guest in wire mode (to avoid auth setup; economy coalescing is proven in-process). After the ten joins and their `welcome`/`memberJoined` frames, every counter is reset and only the 100-click burst is measured: `encodeCallsPerBroadcast` is the post-reset server-message encode count divided by the post-reset broadcast count, so setup frames never inflate it. Wire mode likewise measures only frames received after the last `welcome` and before the burst completes.

**Metrics and targets (AC-25).**

| Metric | Baseline | Target |
| --- | --- | --- |
| `encodeCallsPerBroadcast` (10 recipients) | 10 | 1 |
| `registrySnapshotsPerBroadcast` | 2 per accepted click (`broadcast` + `locationOf`) | 0 |
| `removalFramesPer100Clicks` (four 25-click bursts) | 100 | ≤ 8 |
| `economyFramesPer100Clicks` (account, ~3.3 s) | 100 | ≤ 16 |
| `dbCreditsPer100Clicks` | 100 | 100 (unchanged) |
| `maxRemovalFrameBytes` (30-id window) | n/a (30 separate frames) | ≤ 1024 |
| `p95AckLatencyMs` | measured at the baseline commit | ≤ baseline + 60 ms |

**Method.** Run the baseline **before** the behavior changes land (task T2, before the modules are wired), then run the same script after (task T3). Three runs per mode; record every raw JSON object and compare medians. Same machine/container host and the same compose backend for the wire runs. Every documented command includes `--json`; raw output lives in `build-log-T2.md` (baseline) and `build-log-T3.md` (after); the final log links both. If the containerized backend cannot start in the builder environment, record the wire mode as "not executed — environment", keep the in-process numbers (four of the five metrics), and state that p95 is unmeasured; never record an unrun measurement as a pass.

## Approval checkpoint

This feature needs explicit user confirmation of five decisions before building. The blanket "Proceed with all of them, one by one" queue approval is **not** approval of these values; the orchestrator must present them in the `awaiting_approval` summary and record the user's confirmation in `status.md` before the build starts.

1. **Q-1 — 40 ms removal batch window.** Remote cube removals can arrive up to 40 ms late; a click burst collapses into one frame. (Alternative: 30 ms lower latency, 50 ms more coalescing.)
2. **Q-2 — 250 ms (4 Hz) economy/HUD coalescing.** Coin/click/destruction totals update at most four times per second with absolute values; purchases and join-time idle credit stay immediate.
3. **Q-3 — Slow-client policy out of scope.** No per-client queue, drop/replace policy or `bufferedAmount` close threshold; only a synchronous send error closes that one peer.
4. **Q-4 — Benchmark evidence-only.** The before/after benchmark is recorded in build logs; no CI performance gate is added.
5. **Q-5 — Legacy single-id compatibility shape.** A one-id flush keeps `miniCubeRemoved`; multi-id bursts use `miniCubesRemoved`.

Q-6 (no completion message fusion), Q-7 (`HubDeps.registry` test seam) and Q-8 (new `docs/architecture/realtime.md` plus a README benchmark subsection) remain builder defaults and do not need a separate user decision.

## Open questions

- **Q-1 — Removal batch window.** Recommended default **40 ms** (within the audited 30–50 ms range): at most 25 flush opportunities per second, a burst of 25 collapses to one frame, and remote removal latency stays below the 140 ms destroy effect. Alternatives: 30 ms (lower latency, less coalescing) or 50 ms (more coalescing, +10 ms latency).
- **Q-2 — Economy cadence.** Recommended default **250 ms (4 Hz)**, as requested in the audit. Alternative: 200 ms (5 Hz); more frames, slightly snappier HUD.
- **Q-3 — Slow clients.** Recommended **out of scope** with only the synchronous-send-error isolation in AC-2. A `bufferedAmount` drop/close policy is a separate feature with its own product decision.
- **Q-4 — Benchmark gate.** Recommended **evidence only** (build-log proof, no CI workflow change); the repo has no performance CI job today and wall-clock thresholds are machine-dependent.
- **Q-5 — Single-id compatibility shape.** Recommended **yes** (a one-id flush keeps `miniCubeRemoved`), which preserves the single-click smoke check and limits mixed-version exposure. Alternative: always send `miniCubesRemoved`, even for one id.
- **Q-6 — Completion message fusion.** Recommended **no**: encode-once already removes the per-recipient cost; fusing `economyUpdate` and `customizationUpdate` would add a compound protocol shape and client reducer branch for a low-frequency path.
- **Q-7 — Registry test seam.** Recommended **yes**: an optional `HubDeps.registry` (matching `config.maxUsersPerServer`) makes the zero-snapshot claim testable and mirrors the existing `now`/`random`/`timers`/`economy` seams. Alternative: prove by code inspection only.
- **Q-8 — Documentation home.** Recommended **new `docs/architecture/realtime.md`** plus a benchmark subsection in `README.md`; no existing architecture document owns the hub's outbound contract.

## Assumptions

- One backend process, in-memory game servers, Postgres only for accounts/economy; no Redis, queue or microservice is introduced.
- Frontend and backend are deployed together; the protocol has no version negotiation, and the single-id legacy shape is the only mixed-version allowance.
- Node's `ws` delivers `peer.send` synchronously in call order per socket; `Peer.send` can throw only when the socket is no longer usable.
- The accepted 30/s per-member rate limit bounds a removal batch to at most 30 ids per window.
- Repository results (`EconomyState`, `UpgradeState`, `CustomizationState`) are immutable snapshots; the hub never mutates them after receipt.
- `economy_revision` is an additive BIGINT column: existing rows start at 0, the first write bumps to 1, and the pre-feature code ignores it, so the migration is safe to leave in place on rollback. Each result carries the absolute post-write totals for that write. `findEconomySnapshot` and `findUpgradesSnapshot` seed the two revision guards on join.
- Tests use the injected clock and fake timers; no test depends on wall-clock sleeps.
- The benchmark runs from the host against the compose-published backend port; no container or compose change is needed.

## Revision history

- r1 — 2026-11-13 — initial draft from the verified broadcast/registry/economy audit evidence and the approved performance queue; pins encode-once fan-out, the O(1) registry index with the surviving snapshot API, 40 ms removal batching with the single-id legacy shape, 4 Hz economy coalescing with absolute totals, the real-time contract, and the before/after benchmark methodology.
- r2 — 2026-11-13 — spec-review r1 revision: adds the five-item Approval checkpoint (F1), the per-account `economy_revision` ordering contract and AC-29 (F2), the closed/shutdown guard and AC-30 (F3), the explicit frontend integration chain for AC-18 (F4), corrects the roster `servers()` citation to `hub.ts:412-413` (F5), specifies full backend builder validation (F6), makes the no-recipient account flush encode-free (F7), resets benchmark counters after setup and standardizes `--json` commands (F8), and pins the smoke burst ids/order plus the no-single-frame assertion (F9).
- r3 — 2026-11-13 — spec-review r2 revision: adds the separate `lastAppliedUpgradeRevision` guard and the two-purchase out-of-order/under-credit proof (F1), extends the shutdown guard to every `handleJoin` await with a deferred-join test (F2), and makes the AC-18 integration wiring concrete (real transport socket + fake scene delegating to a real `WorldView.applyMessage`).
