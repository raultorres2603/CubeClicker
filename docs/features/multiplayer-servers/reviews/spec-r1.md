---
feature: multiplayer-servers
kind: spec
iteration: 1
verdict: approved
blocking: 0
---

# Spec Review — Multiplayer Servers & Spectating (r1)

## Summary

The spec comprehensively addresses every requirement from the user's raw request, maintains consistency across spec/plan/tasks, and aligns with the existing codebase architecture. All 27 acceptance criteria are binary-testable with concrete evidence files, the task graph is acyclic with correct parallel safety, and the real-time contract is complete. No blockers or majors found.

## Findings

### MINOR — Message shape validation for `worldEntered` not explicitly pinned in a dedicated AC

**Location:** spec.md §8 (Protocol), AC-12

**Problem:** While the protocol catalog defines `worldEntered` with all required fields (playerId, name, token, serverId, maxUsers, position, self, roster) and AC-12 tests the client-visible move effect mentioning `worldEntered`, there's no dedicated acceptance criterion that explicitly validates the complete message shape with all fields and their types. AC-12 focuses on the sequence and behavior but doesn't explicitly pin the message structure.

**Why it matters:** The message is critical for cross-server moves — it must contain the full roster, the new server ID, and the member's new position. An incomplete message would break the world swap.

**Required change:** Either add an explicit AC that pins the `worldEntered` message shape (all fields, types, presence assertions) or enhance AC-12 to include explicit message shape validation. The protocol codec tests in AC-20 may implicitly cover this, but an explicit AC would be clearer.

**Severity:** MINOR — implicitly covered by AC-12 and AC-20, but an explicit pin would prevent ambiguity during implementation.

---

### MINOR — Message shape validation for `stateSync` not explicitly pinned in a dedicated AC

**Location:** spec.md §8 (Protocol), AC-14

**Problem:** The protocol catalog defines `stateSync` with fields (playerId, levelIndex, gridSize, styleId, removedIds), and AC-14 tests the validation failure path that sends `stateSync`, but there's no dedicated acceptance criterion that explicitly validates the complete message shape. AC-14 focuses on the validation logic and reconciliation behavior but doesn't explicitly pin the message structure.

**Why it matters:** `stateSync` is the authoritative board correction mechanism — it must contain the complete removed-id set so the client can reconcile to server authority. An incomplete message would leave the client in an inconsistent state.

**Required change:** Either add an explicit AC that pins the `stateSync` message shape or enhance AC-14 to include explicit message shape validation. The protocol codec tests in AC-20 may implicitly cover this, but an explicit AC would be clearer.

**Severity:** MINOR — implicitly covered by AC-14 and AC-20, but an explicit pin would prevent ambiguity during implementation.

---

### INFO — Button label vs aria-label naming convention

**Location:** spec.md §6 (Spectating & travel)

**Problem:** The spec uses "Users on Server" (capitalized 'S') for the button label and "Users on server" (lowercase 's') for the aria-label. This is intentional (visible button text vs accessibility label), but the distinction could be confusing during implementation.

**Why it matters:** Implementers might inadvertently use the wrong capitalization, leading to inconsistencies between the visible UI and accessibility announcements.

**Required change:** None required — the spec is clear on the intent. This is an informational note for implementers to be aware of the intentional difference.

**Severity:** INFO — no action required, just awareness.

---

## Verification of user requirements

All requirements from the user's raw request are explicitly covered:

1. ✅ **"Every time backend goes online, if user connects to it, it will create the first server"** — AC-1 (First connection creates server 1), AC-4 (In-memory lifecycle across restart)
2. ✅ **"Each server can include X number of users maximum (I would like you to analize, based on game, how many people you think is worth or stable to have)"** — §2 (Server capacity X), plan § Capacity analysis (X=10 recommended with detailed analysis)
3. ✅ **"For each user, you'll create a cube in the space"** — §5 (Per-user cube & the shared space), AC-13 (World layout & remote cubes)
4. ✅ **"We can, as user playing, see other's playing (camera going/travelling with an animation to the other's user cube)"** — §6 (Spectating & travel), AC-17 (Spectate travel & view-only mode)
5. ✅ **"User can return to his cube when he wants to, or see others"** — §6, AC-18 (Return to my cube)
6. ✅ **"The selection to see other's playing on their cubes should be by clicking to a button, on screen, that says something like 'Users on server' and, then, clicking on the user I want to see"** — §6, AC-16 ("Users on Server" button & panel)
7. ✅ **"If X+1 users on server, this new one, will create another server, to allow other X number of users join him"** — §4 (Assignment, overflow, and the move plan), AC-2 (Fill to X, then overflow)
8. ✅ **"If one server that was full, somehow, an user disconnects, servers that are not full or users that are alone on another server, it will be a recalculation of exchanging users from 1 server to another"** — §4, §7 (Rebalancing policy), AC-10 (Move plan: deterministic packing), AC-11 (Lone-user merge scenario)
9. ✅ **"This will happen when a user finishes he's cube, so, next cube, will be on this new server he will go"** — §4 (Execution: next cube goes to the new server), §7, AC-10, AC-11

## Consistency checks

### spec.md ↔ plan.md agreement

- ✅ Capacity value: spec §2 (X=10 default, 2-24 valid) matches plan § Capacity analysis (X=10 recommended, 2-24 range)
- ✅ Protocol messages: spec §8 catalog matches plan § Protocol definitions
- ✅ Rebalance triggers: spec §7 table matches plan § Architecture (backend data flow)
- ✅ IDs and naming: consistent throughout (playerId p<N>, server IDs sequential, etc.)

### AC testability

- ✅ All 27 ACs are binary-testable (pass/fail with concrete assertions)
- ✅ Every AC names specific evidence files (test files, commands, or inspections)
- ✅ Every AC has concrete expected values (no vague "should work" language)
- ✅ No wildcard matchers, snapshot-only tests, or assertion-free tests mentioned

### Requirement ↔ AC traceability

- ✅ Every user requirement maps to at least one AC
- ✅ Every AC traces to a stated requirement or architectural constraint
- ✅ No orphan ACs (ACs without requirements)
- ✅ No orphan requirements (requirements without ACs)

## Feasibility against real codebase

### File paths verified

- ✅ `src/backend/src/app.ts` exists with existing `/ws` route and `helloMessage` envelope
- ✅ `src/backend/src/server.ts` exists (unchanged per plan)
- ✅ `src/frontend/src/game/engine.ts` exists with travel logic, `travelDirection`, `gridSize` override
- ✅ `src/frontend/src/render/scene.ts` exists with `travelCameraPose`, `CUBE_SPACING = 24`, `createCubeView`
- ✅ `src/frontend/src/game/session.ts` exists with engine/scene wiring
- ✅ `src/frontend/src/ws/connection.ts` exists with retry logic (transport wraps it)
- ✅ `src/frontend/src/render/cube-view.ts` exists with `createCubeView` interface
- ✅ `compose.yaml` and `compose.smoke.yaml` exist at root

### Existing patterns reused

- ✅ Fastify `/ws` route pattern (existing `app.ts:33`)
- ✅ `helloMessage` envelope (existing `app.ts:4-16`)
- ✅ `travelCameraPose` formula (existing `scene.ts:152`)
- ✅ `CUBE_SPACING = 24` constant (existing `scene.ts:102`)
- ✅ `createCubeView` interface (existing `cube-view.ts`)
- ✅ Engine's `gridSize` override option (existing `engine.ts:110`)
- ✅ Engine's `setRandomSource` method (existing for deterministic RNG)
- ✅ WS connection retry logic (existing `connection.ts`)

### No missing modules

- ✅ All claimed existing modules are present in the codebase
- ✅ No phantom modules or interfaces referenced but not implemented

## Task graph verification

### Dependency graph (acyclic)

```
T1 (no deps) → T2, T3, T4 (parallel) → T5
T7 (no deps) → T8, T9, T10, T11 (parallel) → T12 → T13 → T14
T5 + T14 → T15 → T16 (all deps)
```

- ✅ No cycles
- ✅ All dependencies point to earlier tasks
- ✅ T16 depends on all others (verification gate)

### Parallel safety

- ✅ T2, T3, T4 each own disjoint file sets (players.ts, cubes.ts, protocol.ts)
- ✅ T8, T9, T10, T11 each own disjoint file sets (engine.ts, transport.ts, world.ts, spectate-travel.ts)
- ✅ Shared files owned by exactly one task:
  - `engine.ts` → T8
  - `scene.ts` → T12
  - `session.ts` → T13
  - `app.ts` → T5
  - `compose.yaml` → T15
  - `compose.smoke.yaml` → T15
  - `smoke.mjs` → T15
- ✅ No shared files touched by multiple tasks
- ✅ `package.json` and lockfile not owned by any task (correct — no new dependencies)

### Task sizing

- ✅ Each task is sized for one builder run (not too large, not too small)
- ✅ Tests + workspace coverage pre-gates present in every task
- ✅ Backend tasks (T1-T5) and frontend tasks (T7-T14) are clearly separated

## Real-time contract completeness

### Server authority

- ✅ Explicitly defined in spec § Real-time impact (contract)
- ✅ Server owns: identities/tokens, membership/slots, cube boards, level advancement, positions, move plan
- ✅ Client-reported values (`explode`, `cubeCompleted`) are validated requests, not truth
- ✅ No last-write-wins for shared state

### Rate limits

- ✅ Per-member click rate: 30/s (spec §5, § Pinned constants)
- ✅ Excess dropped with `error rate_limited` at most once per second (AC-14)

### Heartbeat

- ✅ WS protocol pings every 30s (spec §8, § Pinned constants)
- ✅ Terminate after 2 missed pongs (AC-21)
- ✅ Pong resets the count (AC-21)

### Reconnect/grace

- ✅ Grace window: 30s default (spec §3, § Pinned constants)
- ✅ State retained during grace (member still listed, cube visible)
- ✅ Rejoin with token resumes exactly (AC-7)
- ✅ Grace expiry removes member, broadcasts `memberLeft`, recomputes plan (AC-7)

### Broadcast scoping

- ✅ Server-only broadcasts (spec §8)
- ✅ Client receives only its own server's members' events (AC-20)
- ✅ Broadcasts include origin where noted (e.g., `miniCubeRemoved` ack)

### Error paths

- ✅ Unknown message type → `error bad_message` (AC-20)
- ✅ Oversized message → dropped + `error bad_message` (AC-20)
- ✅ Message before join/rejoin → `error not_joined` (AC-20)
- ✅ Second join/rejoin → `error bad_message` (AC-20)
- ✅ Invalid click → `error invalid_click` + `stateSync` (AC-14)
- ✅ Invalid completion → `error invalid_completion` + `stateSync` (AC-15)
- ✅ Unknown/expired token → `error resume_failed` (AC-7)

### Connection-loss behavior

- ✅ Socket close starts grace window (spec §3)
- ✅ Disconnected client: input ignored, world frozen, travel holds (AC-22)
- ✅ Reconnect within grace: `rejoin` → `welcome` → re-sync to authority (AC-22)
- ✅ Reconnect after grace: new identity (AC-7)

## Risks and gaps analysis

### Oscillation in rebalancing

- ✅ Explicitly addressed in spec §4: "strict server-id decrease per move → no oscillation"
- ✅ Sum of member server-ids strictly decreases per move
- ✅ Converges to: all servers except at most the last one full, no empty servers

### Race conditions on join/close during rebalance

- ✅ Plan recomputes on every membership change (spec §7 table)
- ✅ Execution re-validates: target must exist and have capacity, else stay (spec §4)
- ✅ Deterministic and idempotent for a given membership state

### Client-side handling of spectated-target disconnect

- ✅ Target's grace expires → auto-return with flight (AC-19a)
- ✅ Target moves servers → auto-return (AC-19b)
- ✅ Target completes on same server → spectator stays, remote view rebuilds (AC-19c)
- ✅ Spectator reconnects → instant reset to own cube (AC-19d)

### Capacity change requiring layout recompute

- ✅ Ring layout recomputes from X automatically (spec §2)
- ✅ Radius R = X·SLOT_SPACING/(2π), angle = 2π·(s−1)/X
- ✅ Changing X is a one-env change, no code change

### Testability of rebalancing determinism

- ✅ AC-10: pinned fixtures for `computeMovePlan` with concrete expected maps
- ✅ AC-11: lone-user merge scenario with concrete ids/positions
- ✅ End-to-end hub tests with fake timers

## Boundaries verification

### No silent decisions on identity/accounts

- ✅ Ephemeral identity explicitly chosen (spec §3, Q-3, Q-10)
- ✅ No accounts, no authentication beyond token (spec § Scope, § Out of scope)
- ✅ User-chosen display names deferred (Q-2)
- ✅ Token in memory only, no persistence (AC-6)

### No unnecessary dependency additions

- ✅ Plan § Dependency requests: "None"
- ✅ Uses Node 24 global `WebSocket` client for tests (no `ws` client dependency)
- ✅ Uses existing `@fastify/websocket` for server (already present)
- ✅ Uses existing `three` for rendering (already present)

### No out-of-scope scope creep

- ✅ Explicit "Out of scope" section in spec § Scope
- ✅ No persistence, no accounts, no chat, no leaderboards, no economy
- ✅ No cross-server interaction, no server browser, no manual server choice
- ✅ No multi-process backend, no load balancer design, no TLS

### No weakening of existing tests

- ✅ Supersession ledger explicitly lists what changes (spec § Supersessions)
- ✅ Predecessor specs never edited (spec § Supersessions, AGENTS.md)
- ✅ Offline defaults retained for tests/fallback (spec § Assumptions)
- ✅ Existing tests pass with only ledgered fixture re-pins (AC-24)

## Containerization contract

- ✅ Single-command local run: `podman compose up` unchanged (AC-25)
- ✅ Environment-based config: `MAX_USERS_PER_SERVER`, `RECONNECT_GRACE_MS` with defaults (AC-25)
- ✅ No secrets in images: ephemeral token only (spec § Security)
- ✅ Provider-neutral images: no AWS/GCP/Azure specifics (spec § Out of scope)
- ✅ Backend WebSocket endpoint exposed: `GET /ws` on port 8080 (AC-25)

## Conclusion

The spec is comprehensive, well-designed, and ready for implementation. All user requirements are explicitly covered, all acceptance criteria are binary-testable, the task graph is correct, and the real-time contract is complete. The two minor findings (message shape validation) are polish items that can be addressed during implementation or added as explicit ACs without blocking progress.

**Verdict: approved** (blocking: 0)
