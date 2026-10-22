---
feature: multiplayer-servers
revision: 2
status: draft
created: 2026-10-21
updated: 2026-10-22
---
# Spec — Multiplayer Servers & Spectating (online, real-time cube worlds)

## Summary

Bring the backend online and make CubeClicker a real-time multiplayer game. The backend (a single Fastify process, in-memory only) hosts **game servers** — logical rooms, not OS processes or containers. The first user connection creates server 1; joining fills servers up to **X** members (capacity analysed in the plan; default 10, configurable); the (X+1)th user spills into a new server. Every member gets one cube placed on a deterministic ring in their server's world, and all members of a server see each other's cubes and each other's live play (mini-cubes popping in real time). A "Users on Server" button lists the server's members; clicking one animates the camera travelling to that user's cube (reusing the accepted directional-travel flight), and a "Return to my cube" button travels back. Clicks are per-cube and server-authoritative with optimistic local play. When a member disconnects (after a reconnect grace window) or joins, the server recalculates a move plan that packs members toward the lowest-numbered servers; moves execute when the moving user **finishes their cube**, so their next cube lands on the target server (scene swap inside the existing travel transition). Server state is in-memory: a backend restart resets everything; empty servers are destroyed immediately. Identity is ephemeral (server-issued id + token, no accounts); nothing is persisted, and no new dependency is required.

## Scope

### In scope

- Backend workspace (`src/backend`): new pure `game/**` modules — `config.ts` (env parsing/validation), `servers.ts` (registry, assignment, move plan, ring layout), `players.ts` (ephemeral identity, tokens, grace windows), `cubes.ts` (per-member cube state, click/completion validation, next-cube draws), `protocol.ts` (message catalog + codecs) — plus `hub.ts` (connection lifecycle, broadcasts, rate limits, heartbeat) wired into the existing `GET /ws` route in `app.ts`. The pinned `hello` envelope stays exactly as-is and remains the first message.
- Frontend workspace (`src/frontend`): new `multiplayer/**` — `protocol.ts` (mirrored codecs), `server-state.ts` (pure reducer for world/roster state), `spectate.ts` (spectate state machine), `transport.ts` (join/rejoin/token/send over the existing `ws/connection.ts` retry connection); new `render/world.ts` (remote cube views + world layout) and `render/spectate-travel.ts` (pinned camera flight to another member's cube); additive online-mode seams in `game/engine.ts`, `render/scene.ts`, `game/session.ts`; UI: `ui/UserPanel.tsx`, `ui/ConnectionBanner.tsx`, HUD "Server N" line, extended `App.tsx` shell and `ui/app.css`.
- Pinned constants, protocol catalog, connection lifecycle (heartbeat, grace, resume), rate limits, rebalance policy, spectate UX, reduced-motion collapses, and the container/e2e additions (`compose.yaml` env passthrough, `compose.smoke.yaml` capacity override, extended `tests/e2e/smoke.mjs`).
- `docs/product/glossary.md`: new canonical terms **game server**, **server member**, **spectating**; the **cube world position** definition is extended for server-assigned slot positions (supersession ledger).

### Explicitly out of scope

- Persistence of any kind (no database, no files): restart = full reset; no offline/idle progress; the existing local no-save stance is retained.
- Accounts, authentication, user-chosen display names (auto-generated names only — Q-2), chat, leaderboards (server- or cross-server), shared/global counters, economy (points/upgrades), cross-server visibility or interaction.
- Scaling the backend beyond one process; multi-process/container-per-server architectures (Q-9); load balancers/proxies (deployment-time, per `docs/architecture/containerization.md`).
- Remote-cube level-of-detail/culling (full detail is bounded at X ≤ 24 — Q-8); spectating with view rotation (Q-7); mobile-specific additions beyond what already works.
- New dependencies (plan § Dependency requests: none needed); browser automation beyond the existing containerized smoke test; CI changes; Dockerfile/HEALTHCHECK changes.

## Supersessions of accepted behaviors

Everything in the four accepted features (`cube-game-frontend`, `cube-visual-polish`, `cube-visual-polish-followup`, `cube-world-transition`, `cube-tile-lines-and-controls`) stays in force **except** the following, superseded by AC ID (the ledger rule: predecessor specs are never edited):

| Superseded | Behavior replaced | Replaced by (this spec) | Retained from that AC |
| --- | --- | --- | --- |
| **cube-world-transition AC-1** (grid draw) | The engine draws each level's N from its own RNG | In online mode the **server** draws N ∈ [3, 7] per level (`N = 3 + ⌊draw·5⌋`, injectable RNG) and delivers it in the next-cube message; the engine accepts the server's N at the level advance (AC-14/AC-15). The engine's offline draw (and the LCG fallback) stays as the tests'/fallback path | Board structure, ids, 6 faces, remove semantics, stats |
| **cube-world-transition AC-3** (travel destination) | Next-cube position = old position + drawn direction offset (`CUBE_SPACING` 24) | In online mode the destination is the **server-assigned slot position** (same-server advance or cross-server move); the direction draw is unused online. The flight formula (lateral `easeInOutQuad·offset`, z `12 + 78·travelSwing(p)`, identity quaternion) is retained | Midpoint advance semantics (online: holds until next-cube data arrives — below), `travelStarted` once, input gating, pose-table formula |
| **cube-world-transition AC-3 / cube-game-frontend AC-22** (rest pose, level 0) | Level 0 rests at the origin `(0,0,12)` | In online mode the own cube's world position is the server-assigned ring slot; rest = `(px, py, 12)`; the intro dolly flies to it. Origin poses stay in offline mode/tests | Rest-pose generalization `(cx, cy, 12)` looking at `(cx, cy, 0)`, intro dolly table, FOV/near/far, reduced-motion collapse |
| **cube-game-frontend AC-10** (level advance timing) | Midpoint advance with locally drawn data | In online mode: `travelStarted` and the travel clock **hold** (progress 0, camera at rest) after the face fade until the server's next-cube data arrives; then the 2500 ms travel runs with the midpoint advance at 0.5, exactly once | Face-fade pacing, phase sequence, stats carry-over, style cycle, exactly one `levelChanged` |
| **cube-game-frontend AC-1** (shell markup) | Exact SSR markup without multiplayer UI | The shell adds: a pinned `Users on Server` button (with `Users on server` panel section), a `Return to my cube` button rendered only while spectating, a connection banner with pinned texts, and a `Server N` line in the HUD. Existing pinned HUD/canvas/live-region markup is retained; the exact-string tests are updated to the extended markup (AC-16/AC-22/AC-23) | HUD stats markup, canvas attributes, single live region, focusability |
| **cube-game-frontend AC-14** (live region copy) | Pinned phase copy (`intro`/`travel`/`playing`) | Adds pinned spectate-travel announcements: `Traveling to {name}'s cube…`, `Returning to your cube…` — same single live region, same rule (never removed/hidden; `playing` = empty text) | Single-region rule, counters not live-announced |
| **cube-game-frontend AC-16** (drawable bounds) | ≤ 6 `InstancedMesh` + body + starfield per scene | Re-pinned for the multiplayer world: **≤ X cube views** (X ≤ 24 config bound → ≤ 24 × 7 = 168 meshes; at the default X = 10 → ≤ 70), exactly one cube view per server member (own + remote), rebuilt/disposed on roster change; starfield/particle caps unchanged | Pool cap, disposal, no unbounded growth |
| **cube-tile-lines-and-controls ACs** (input controls) | Clicks/keys active while playing | Retained in full **while playing at your own cube**; in the new **spectating** view-only mode and during any travel, all game input (clicks, W/A/S/D, arrows) is ignored (same gating as `travel`) — spectating is a new mode, not a weakening of the accepted playing controls | Seamed surface, pointer-click explode, WASD/arrows rotation, auto-rotation |
| **cube-world-transition AC-5** (glossary) | `cube world position` = random directional spawn, "online occupancy is a future feature" | Definition extended: online play assigns each member's cube a server slot position on the ring layout (occupancy by construction, no overlap); offline walk retained as the single-player mode's definition. Three new terms added (AC-27) | Definition+example format; no other term redefined |

## UX behavior (pinned)

Subsections define behavior; § Acceptance criteria turns each into a binary-testable obligation. All numeric values are pinned in § Pinned constants.

### 1. Game server model & lifecycle

A **game server** is a logical room inside the single backend process (Q-9): an ordered membership (join order = slot order) and the members' cube states. **No server exists at boot** — `/healthz` works and creates nothing (AC-4). **Creation:** the backend creates server **1** on the first `join` ever received; servers are created lazily, only by the backend (clients never create servers). **Numbering:** sequential integers from 1, assigned at creation, **never reused** after destruction (gaps after churn are fine; no ABA confusion) (AC-3). **Destruction:** when the last member leaves a server — by disconnect after grace expiry, or by a completed-cube move — the server and all its state are destroyed immediately (AC-3). **Restart:** all state is in-memory; a backend restart discards every server, member, token and cube; the next `join` creates server 1 again; no file or database is written (AC-4).

### 2. Server capacity X (analysed)

X = `MAX_USERS_PER_SERVER` — an environment variable, default **10**, valid integer range **2–24**, invalid values fail startup with a clear error (AC-5). The recommendation is the result of the load analysis in plan.md § Capacity analysis: click/broadcast fan-out is trivial for Node at X = 25, but **client rendering** (one full cube view per member, worst-case N = 7 → 294 mini-cubes each) is the binding constraint — X = 10 keeps the world renderable on integrated GPUs, feels populated for spectating, and keeps ring radius compact (R ≈ 38.2 world units at X = 10). Tradeoffs are tabled in plan.md; changing X is a one-env change (no code change), and the layout math (slot ring) recomputes from X automatically.

### 3. Identity (no accounts)

- **Issuance:** on `join`, the server issues an ephemeral identity: `playerId` (`p<N>` from a monotonic counter) plus a `sessionToken` (32 hex chars from `crypto.randomBytes(16)`). Nothing is written to storage; no cookies/localStorage by the game (AC-6).
- **Display name:** auto-generated `Player <N>` (the same counter) — unique, stable across server moves (AC-8). User-chosen names are Q-2 (not in v1).
- **Grace window & reconnect:** on socket close (any close), the member stays for `RECONNECT_GRACE_MS` (default 30 000 ms): state retained, cube still visible, still listed in the roster (their broadcasts to the dead socket are dropped). A `rejoin` presenting the token within the window resumes identity, server and cube exactly; the resumed client gets a fresh `welcome`. After the window the member is removed (`memberLeft` broadcast, rebalance plan recomputed). A page reload discards the token (in-memory only, Q-3) and therefore gets a **new** identity — the old one expires via grace (AC-7).
- **Multi-client:** one connection = one identity; two tabs are two members. The server is the sole authority over identities and membership (Real-time contract).

### 4. Assignment, overflow, and the move plan

- **Join rule:** a joining member is placed on the **lowest-numbered server with a free slot**; if none has one, the backend creates the next fresh-id server. Consequence: the first X joins fill server 1 in join order (slots 1..X), join X+1 creates server 2 and lands on it, join 2X+1 creates server 3 (AC-9).
- **Move plan (the "recalculation"):** a pure function `computeMovePlan(servers, X)` computes, for every trigger (join, socket close, grace expiry, successful resume), a map `playerId → targetServerId` that **packs membership toward the lowest ids**: iterating servers by ascending id as destinations (free slots), donors are members of higher-id servers taken in **join order**, targeting the lowest id with capacity; a planned target is always **strictly lower** than the member's current server id. The plan is deterministic; it changes only on membership changes (AC-10).
- **Execution (the "next cube goes to the new server"):** the move executes **only when the moving user finishes their cube** (`cubeCompleted` accepted): the member leaves their current server, joins the planned target (re-validated: the target must still exist and have a free slot, else they stay), and their next cube is created there (AC-10/AC-11). If the vacated server is now empty it is destroyed (AC-3). A member never moves twice for one trigger, and never spontaneously (AC-10).
- **Stability:** every executed move strictly decreases the mover's server id, ids are never reused, and execution happens only at cube completion → the sum of member server-ids strictly decreases per move, so there is no oscillation and the system converges to: all servers except at most the last one full, no empty servers (AC-10).
- **Client-visible effect of a move:** the mover's cube-completion travel flies to the assigned slot position on the target server; at the midpoint the world swaps (new roster/layout, `worldEntered`); old-server members see `memberLeft (moved)`, new-server members see `memberJoined` (AC-12). A client only ever sees cubes of members of its own server (broadcasts are server-scoped).

### 5. Per-user cube & the shared space

- **Layout:** each server's members' cubes sit on a **ring** around the origin of the server's world: slot `s` (1-based, join order) → angle `2π·(s−1)/X`, radius `R = X·SLOT_SPACING/(2π)` with `SLOT_SPACING = 24` (= the accepted `CUBE_SPACING`), position `(R·cos θ, R·sin θ, 0)`. Adjacent arc spacing is exactly 24; positions never collide (occupancy by construction). Positions are **stable** while the member stays (new members take the lowest free slot; existing members never shuffle) (AC-13).
- **One cube per member per level:** the member's cube = the accepted cube level (6 faces, N² mini-cubes, ids `face:row:col`). **The server draws N** ∈ [3, 7] per level and assigns the style by the accepted 5-style cycle from `levelIndex`; the server is the authority for which mini-cubes exist and remain (AC-14/AC-15).
- **Visibility:** the client renders exactly one cube view per server member — own + remote — placed at their slot positions. Remote cubes are full-detail views driven exclusively by server broadcasts: `miniCubeRemoved` pops the tile (the accepted pop/burst plays on remote cubes too), `faceCleared` removes the face, `levelAdvanced` rebuilds in place (AC-13).
- **Per-cube clicks & synchronization (server authority):** the player clicks only their **own** cube — remote cube views are not pickable (raycasts resolve only against the own cube view). Own-cube play is **optimistic**: the engine applies the removal and stats instantly (the accepted behavior), the session forwards `explode` to the server, and the server — the sole authority — validates (id must exist in the member's current level) then broadcasts `miniCubeRemoved` to **all** server members **including the sender** (ack: no-op when local state matches). On a validation failure (stale/unknown id, wrong level) the server sends `error` + `stateSync` (full authoritative board for that cube); the client reconciles its board to authority (stats counters are not rolled back — they are session-local). Rate limit: ≤ 30 explode/s per member; excess dropped with `error rate_limited` at most once per second (AC-14).
- **What others see of a player's progress:** live tile removals (with pops), face clears, and — when the player completes their cube — an instant in-place rebuild of that member's cube view at the `levelAdvanced` state (possibly at a new server's slot for movers, per § 4). Remote cube views do not play the owner's travel animation (the owner's camera flight is per-client) (AC-13).
- **Stats:** `clicks`/`facesDestroyed`/`Cube N` remain session-local HUD values (no shared counters — out of scope); the server tracks only removed-id sets for validation.

### 6. Spectating & travel

- **"Users on Server" button:** always visible while the game is playing (pinned label `Users on Server`). It toggles the panel (`aria-label="Users on server"`) listing the server's **other** members as buttons in slot order, each with their display name and current cube level (`Cube <n>`); a disabled first row shows the player's own name marked `(You)` (AC-16).
- **Travelling to a user:** clicking a member closes the panel and starts a **spectate travel**: the accepted flight formula (lateral `easeInOutQuad(p)·offset`, depth `z = 12 + 78·travelSwing(p)`, look target `(x(p), y(p), 0)`, identity quaternion at every p) from the current cube's position to the target member's position over `TRAVEL_DURATION_MS` (2500 ms; reduced motion: instant positional swap). Pinned pose tables for concrete positions in AC-17. Input is gated for the whole flight; a second selection during flight is ignored (one travel at a time). On arrival the phase returns to `playing` in **spectating mode** (AC-17).
- **Spectating mode:** the camera rests over the target's cube (`(tx, ty, 12)`); the view is **view-only** — clicks, W/A/S/D and arrows are ignored (Q-7); the target's live play (pops, face clears, advances) is visible through broadcasts. The player's own cube stays in the world (others can still see it) (AC-17).
- **Return to my cube:** while spectating, a pinned `Return to my cube` button shows; clicking it runs the same flight back to the player's own cube; on arrival normal play resumes (AC-18).
- **Edge cases (AC-19):** the spectated member disconnects and their grace expires → the spectator auto-returns to their own cube with the flight; the spectated member **moves servers** (completes a cube) → auto-return; the spectated member completes a cube **on the same server** → the spectator stays, the remote cube view rebuilds in place at the `levelAdvanced` state; the spectator reconnects → the view resets to their own cube instantly (no flight). During the target's grace window the member is still listed and the cube remains (frozen) — spectating continues until `memberLeft`.
- **Travel authority:** the destination position always comes from the server (`memberJoined`/`welcome`/`levelAdvanced`/`worldEntered`); the client never invents positions. Camera/spectate state itself is client-local by design — no other client's view depends on it.

### 7. Rebalancing policy (exact triggers)

| Trigger | Action |
| --- | --- |
| member `join` | assign per § 4 join rule; recompute move plan |
| socket close (grace starts) | member retained; recompute move plan (their departure is *anticipated* in the plan — the plan assumes the grace may expire) |
| grace expiry (member removed) | broadcast `memberLeft (left)`; destroy server if empty; recompute move plan |
| successful `rejoin` (resume) | no membership change visible to others; recompute move plan |
| `cubeCompleted` accepted | **execute** the member's planned move (re-validated) if any; assign next cube on the (possibly new) server per § 4; destroy the vacated server if empty |

The plan recomputation is deterministic and idempotent for a given membership state; moves execute only at completion; strict server-id decrease per move (stability argument in § 4).

### 8. Real-time protocol

Transport: the existing `GET /ws` WebSocket on the backend (unchanged endpoint). JSON text messages; one message per WS frame. **On connect the server sends exactly one `hello`** (the exact accepted envelope `{ type: 'hello', serverTime }`) **before anything else** (AC-20). Liveness is transport-level: the server sends WS protocol pings every `WS_HEARTBEAT_INTERVAL_MS` (30 000) and terminates the connection after `WS_MISSED_PONGS_LIMIT` (2) missed pongs — browsers answer pongs automatically, no app-level ping messages (AC-21).

Message catalog (payload shapes pinned; unknown fields ignored; see plan.md § Protocol for the TypeScript shapes and code lists):

**Client → server**
| type | payload | semantics |
| --- | --- | --- |
| `join` | `{}` | first message after `hello` for a fresh identity; a second `join`/`rejoin` on the same connection → `error bad_message` |
| `rejoin` | `{ token: string }` | resume attempt; success → `welcome`; unknown/expired token → `error resume_failed`, then the client sends `join` |
| `explode` | `{ id: MiniCubeId, level: number }` | own-cube click; validated (AC-14) |
| `cubeCompleted` | `{ level: number }` | own cube fully cleared; validated (AC-15); drives move execution + next cube |

**Server → client**
| type | payload | semantics |
| --- | --- | --- |
| `hello` | `{ serverTime }` | first message, exact accepted shape (unchanged) |
| `welcome` | `{ playerId, name, token, serverId, maxUsers, position, self: CubeState, roster: MemberState[] }` | identity + assignment + full world state (on join and on resume) |
| `worldEntered` | `{ playerId, name, token, serverId, maxUsers, position, self, roster }` | same shape, sent to a mover whose next cube lands on a **different** server |
| `memberJoined` | `{ member: MemberState }` | broadcast to the server's other members |
| `memberLeft` | `{ playerId, reason: 'left' \| 'moved' }` | broadcast; `left` after grace expiry/removal, `moved` when the member's completion moved them |
| `miniCubeRemoved` | `{ playerId, id }` | broadcast to **all** members incl. the origin player (ack) |
| `levelAdvanced` | `{ playerId, levelIndex, gridSize, styleId, position, removedIds: [] }` | a member advanced to a fresh cube; broadcast to all members incl. the mover (the mover's next-cube trigger for same-server advances); `position` changes only for cross-server moves |
| `stateSync` | `{ playerId, levelIndex, gridSize, styleId, removedIds }` | authoritative board for one member's cube — join/resume payloads and correction after validation failures |
| `error` | `{ code, detail? }` | codes: `bad_message` \| `not_joined` \| `rate_limited` \| `invalid_click` \| `invalid_completion` \| `resume_failed` |

`MemberState = { playerId, name, position: { x, y }, levelIndex, gridSize, styleId, removedIds: string[] }`; `CubeState = { levelIndex, gridSize, styleId, removedIds: string[] }`. Broadcast scoping: **server-only** — a client receives only its own server's members' events (AC: broadcast isolation pinned in tests). Robustness: unknown message types → `error bad_message` to the sender; messages > `MAX_MESSAGE_BYTES` (1024) dropped with `error bad_message`; any message before a successful join/rejoin → `error not_joined` (AC-20). Connection cap `MAX_CONNECTIONS` (200 sockets) — beyond it, upgrades are rejected (safety bound).

### 9. Client connection & offline behavior

The session runs online-only (there is no offline play mode in production; the engine's offline defaults remain for tests). Connection states drive a pinned banner: `Connecting…` while connecting; `Connection lost — retrying…` during the existing bounded retry; after retries are exhausted, `Connection lost` with a pinned `Retry` button that reconnects. While disconnected: gameplay input is ignored (no clicks dispatch, no rotations), the world stays rendered but frozen, and travel holds. On reconnect within grace: `rejoin` → `welcome` → the client re-syncs its own cube to authority (the server never re-sends the old local state) and the view resets to the own cube instantly (AC-22). The intro flight starts only once `welcome` arrives (before that, the camera idles at the far intro pose and the starfield is visible) (AC-23).

### Pinned constants

| Constant | Value | Home | Purpose |
| --- | --- | --- | --- |
| `MAX_USERS_PER_SERVER` (env) | 10 (valid 2–24; invalid → startup failure) | `src/backend/src/game/config.ts` | server capacity X |
| `RECONNECT_GRACE_MS` (env) | 30000 (valid 1000–600000) | config | resume window |
| `CLICK_RATE_LIMIT_PER_SECOND` | 30 | config | explode cap per member |
| `WS_HEARTBEAT_INTERVAL_MS` | 30000 | config | liveness ping |
| `WS_MISSED_PONGS_LIMIT` | 2 | config | termination threshold |
| `MAX_MESSAGE_BYTES` | 1024 | `game/protocol.ts` (backend), mirrored in `multiplayer/protocol.ts` | message size cap |
| `MAX_CONNECTIONS` | 200 | `game/hub.ts` | socket cap |
| `SLOT_SPACING` | 24 (= accepted `CUBE_SPACING`) | `game/servers.ts`; mirrored in `render/world.ts` | ring arc spacing |
| Ring radius | `R = X·SLOT_SPACING/(2π)` (≈ 38.2 at X = 10) | servers.ts | slot layout |
| Slot angle | `2π·(s−1)/X` | servers.ts | slot layout |
| Grid draw (server) | `N = 3 + ⌊random()·5⌋` | `game/cubes.ts` | next-cube size |
| Token | 32 hex chars, `crypto.randomBytes(16).toString('hex')` | `game/players.ts` | session credential |
| Spectate flight | lateral `easeInOutQuad(p)·offset`; z `12 + 78·travelSwing(p)`; target `(x(p), y(p), 0)` | `render/spectate-travel.ts` | travel to/from remote cubes |
| `TRAVEL_DURATION_MS`, `REDUCED_INTRO_TRAVEL_MS`, pop/burst/starfield constants | unchanged | `game/effects.ts` | retained pacing |

## User stories

- As a player, I want the game to connect to an online backend and put me in a server with other players, so the game feels alive and shared.
- As a player, I want my own cube in the shared space and to see other players' cubes and their live clicking, so I can tell who is active.
- As a player, I want a "Users on Server" button that lists who is with me, and to click one of them to fly to their cube and watch them play, so I can spectate.
- As a player, I want to return to my own cube whenever I want, so spectating never traps me.
- As a player on a full server, I want the next player to land on a fresh server, so my server never gets overcrowded.
- As a player on a near-empty server, I want to be merged toward a fuller server on my next cube, so servers repopulate after others leave.
- As a player who briefly loses connection, I want my cube and identity restored when I reconnect, so a blip doesn't cost me my progress.
- As a player who prefers reduced motion, I want spectate travel to be an instant swap, like every other transition.

## Acceptance criteria

Verification notes: "the backend workspace" = `src/backend`, "the frontend workspace" = `src/frontend`. Evidence per AC: a test file asserting concrete values, or a command/transcript. All tests use concrete expected values (no banned matchers, no useless tests, no snapshot-only/assertion-free tests). Commands (from `AGENTS.md`): `npm run lint`, `npm run typecheck`, `npm test --workspace …`, `npm run coverage --workspace @cubeclicker/backend|@cubeclicker/frontend` (pre-gate per task), full `npm run coverage` (final gate), `npm run build`, `npm run smoke` where the environment allows. Raw transcripts recorded in `docs/features/multiplayer-servers/build-log-T<id>.md`.

### Server model & lifecycle

- **AC-1 — First connection creates server 1.** With a fresh registry (fresh backend), no server exists before any connection: `registry.serverCount() === 0` at boot, and `/healthz` → 200 `{"status":"ok"}` creates nothing. The first client `join` creates exactly one server, id `1`, containing exactly that member. Evidence: `servers.test.ts` + `hub.test.ts` (boot state, healthz, first join).
- **AC-2 — Fill to X, then overflow.** With capacity X (tests use X = 3 for compactness; the smoke test uses X = 2): the first X joins land on server 1 with slots 1..X in join order (pinned ring positions asserted via the layout formula); join X+1 creates server 2 (id 2) and lands on it; join 2X+1 creates server 3. Evidence: `servers.test.ts`, `hub.test.ts` (multi-join sequences with concrete server/slot ids), smoke (`AC-25`).
- **AC-3 — Empty servers are destroyed; ids never reused.** When the last member leaves a server — via grace expiry (disconnect + `RECONNECT_GRACE_MS`) or via a completion-move — the server is removed immediately (`serverCount()` drops, its members' state discarded). A later new server gets the next fresh id (never the destroyed one): e.g. server 2 destroyed → the next created server is id 3. Evidence: `servers.test.ts`, `hub.test.ts` (concrete id sequences with fake timers).
- **AC-4 — In-memory lifecycle across restart.** No state survives a restart: building the app twice yields an empty registry both times; no file/database writes anywhere in the diff (grep: no `fs` writes, no persistence imports under `src/backend`). Evidence: `hub.test.ts`/`app.test.ts` (fresh builds), `git diff` grep at the final gate.
- **AC-5 — Capacity X config.** `MAX_USERS_PER_SERVER` default `10`; valid integer range 2–24; an out-of-range/non-integer value makes startup fail with an error naming the variable. `RECONNECT_GRACE_MS` default 30000 (valid 1000–600000). The capacity analysis with the tradeoff table exists in plan.md § Capacity analysis. Evidence: `config.test.ts` (boundary values 1/2/10/24/25, `'abc'`, missing → default; exact error cases).

### Identity

- **AC-6 — Ephemeral identity, no storage.** On `join`: `playerId` = `p<N>` (monotonic counter), `sessionToken` = 32 lowercase hex chars; two joins yield different tokens. The game writes nothing to `localStorage`/`sessionStorage`/cookies (frontend grep: no storage calls added; backend: no persistence). Evidence: `players.test.ts`, frontend grep at final gate.
- **AC-7 — Grace window & reconnect.** After a socket close, the member stays for `RECONNECT_GRACE_MS`: their cube remains in `roster` (others see no `memberLeft` yet) and broadcasts to the dead socket are dropped without error. A `rejoin` with the token within the window: the member resumes — same `playerId`, same server, same cube state (`removedIds` preserved, concrete ids asserted) — and receives a fresh `welcome`. After the window: the member is removed, `memberLeft { reason: 'left' }` broadcasts, the move plan is recomputed. `rejoin` with an unknown token → `error resume_failed`. Evidence: `players.test.ts` + `hub.test.ts` with fake timers (grace boundary at exactly `RECONNECT_GRACE_MS`), concrete message sequences.
- **AC-8 — Display names.** `Player <N>` from the same monotonic counter as `playerId` (`p<N>`); unique; stable across server moves (the same name in the target server's roster). Evidence: `players.test.ts`, `hub.test.ts` (move sequence keeps name).

### Assignment & rebalancing

- **AC-9 — Join assignment rule.** A join lands on the lowest-numbered server with a free slot; if none exists, a new server is created with the next fresh id. Evidence: `servers.test.ts` (exhaustive small cases: full server 1 + join → server 2; gap — server 1 with free slot after churn + join → server 1).
- **AC-10 — Move plan: deterministic packing, execution only at completion, strictly decreasing ids.** For every trigger (join, close, grace expiry, resume), `computeMovePlan` recomputes; pinned fixtures: servers `[1: X−1, 2: 1]` → `{p2: 1}` (the lone member moves down into the free slot); `[1: X−2, 2: 2]` → `{p2: 1, p3: 1}` (both members of 2 planned to 1 in join order); `[1: X, 2: 1]` → `{}` (no free slot below, nowhere to go). Planned targets are always strictly lower ids. A planned move **executes only** when that member's `cubeCompleted` is accepted — never at plan time, never spontaneously; the member's next cube is created on the target. Re-validation: if the target no longer exists or is full at execution time, the member stays. Evidence: `servers.test.ts` (plan fixtures), `hub.test.ts` (full sequences: plan exists after a disconnect, no roster change until the mover completes their cube, then `memberLeft (moved)` + `memberJoined` + mover's `worldEntered`).
- **AC-11 — Lone-user merge scenario (the user's exact ask).** Fixture (X = 2): server 1 has 2 members, server 2 has 1. A server-1 member disconnects and their grace expires → plan recomputed: the server-2 member's target = server 1. When the server-2 member completes their cube: they move to server 1 (slot asserted), server 2 is destroyed, old-server members see `memberLeft (moved)`, server-1 members see `memberJoined` with the mover's next-cube state. Evidence: `hub.test.ts` end-to-end sequence with concrete ids/positions.
- **AC-12 — Client-visible move effect.** On a cross-server completion: the mover's client receives `worldEntered` (target server, position, full roster) and plays the accepted travel flight to the assigned slot position with the world swap at the midpoint (no travel before `worldEntered` arrives — progress holds at 0); after the swap the mover's `Users on Server` panel shows the new server's roster; the old server's clients remove the mover's cube (`memberLeft`). Evidence: `server-state.test.ts` (reducer over the exact message sequence), `scene.test.ts` (destination + midpoint world swap with concrete positions), `session.test.ts` (wiring).

### Cubes & synchronization

- **AC-13 — World layout & remote cubes.** The slot→position formula is exact: slot s of a server with capacity X → angle `2π·(s−1)/X`, radius `X·24/(2π)`, position `(R·cos θ, R·sin θ, 0)` (concrete literals asserted for X = 10, slots 1/2/3/10 and X = 2). Each member has exactly one cube per level; the client renders exactly one cube view per server member (own + remote, ≤ X), remote views are non-pickable (a ray that hits only a remote cube resolves to `null`), and remote cubes apply broadcasts: `miniCubeRemoved` hides the tile + plays the accepted pop/burst, `faceCleared` removes the face, `levelAdvanced` rebuilds in place. Drawable bound: ≤ X × 7 meshes per world; roster removals dispose the view (asserted exactly once). Evidence: `servers.test.ts` (formula), `world.test.ts` (real three.js scene-graph counts/positions/disposal; picker isolation — a ray that hits only a remote cube view resolves to `null`), `server-state.test.ts`.
- **AC-14 — Server-authoritative board, optimistic own-cube play.** An `explode` for an id that exists in the member's current level: applied server-side, `miniCubeRemoved { playerId, id }` broadcast to **all** members **including the sender** (concrete member sets asserted). An `explode` for a removed/unknown id or a wrong `level` → no broadcast; `error invalid_click` + `stateSync` (full authoritative board) to that client only; the client reconciles its board to the `stateSync` (removed set equality asserted). Rate limit: the 31st `explode` within one trailing second is dropped with `error rate_limited`, and at most one `rate_limited` error per second. Own-cube clicks remain instantaneous locally (engine applies removal at dispatch — retained behavior). Evidence: `cubes.test.ts` (validation matrix), `hub.test.ts` (broadcast sets, rate-limit boundaries with fake timers), `engine.test.ts` + `server-state.test.ts` (optimistic path + reconciliation).
- **AC-15 — Completion validation & server-drawn levels.** `cubeCompleted` is accepted only when the removed set covers exactly all `6N²` ids of the member's current level (else `error invalid_completion` + `stateSync`); on acceptance the server draws the next N ∈ [3, 7] via its injectable RNG (`N = 3 + ⌊draw·5⌋`, concrete values for pinned draws asserted), advances `levelIndex`, assigns the style by the accepted cycle from `levelIndex`, and delivers `gridSize`/`styleId`/`position` in `levelAdvanced`/`worldEntered`. Evidence: `cubes.test.ts` (boundary: N²−1 removals → rejected; N² → accepted; pinned draw values), `hub.test.ts`.

### Spectating

- **AC-16 — "Users on Server" button & panel.** While playing, the shell renders a button with the exact label `Users on Server`; activating it opens a panel (`aria-label="Users on server"`) listing the server's other members in slot order, each as a `<button>` showing their display name and `Cube <levelIndex+1>`, plus a disabled first row with the own name marked `(You)`. With an empty roster (alone on the server) the panel shows only the own row. SSR markup pinned by tests. Evidence: `UserPanel.test.tsx`, `App.test.tsx` (exact strings).
- **AC-17 — Spectate travel & view-only mode.** Selecting a member starts a travel: the pinned flight formula from the current cube's position to the target's position over `TRAVEL_DURATION_MS` with concrete pose tables asserted (e.g. from `(0,0,12)` to a target at `(24,0,12)`: p = 0.25 → `(3, 0, 51)`, p = 0.5 → `(12, 0, 90)`, p = 1 → `(24, 0, 12)`, targets `(x(p), y(p), 0)`, identity quaternion at every p; and a second pinned case with a non-axis-aligned delta). Input is gated for the whole flight; a second selection during flight is ignored. On arrival: phase `playing`, spectating mode — clicks, W/A/S/D and arrows dispatch nothing (asserted: no board/stat/orientation change). Reduced motion: instant positional swap (camera at the target's rest pose with no flight). Evidence: `spectate-travel.test.ts` (pose tables), `engine.test.ts` (gating + view-only), `spectate.test.ts` (machine states), `scene.test.ts` (flight rendering).
- **AC-18 — Return to my cube.** While spectating, a button with the exact label `Return to my cube` is rendered (and absent otherwise); activating it runs the same flight back to the own cube; on arrival normal play resumes (clicks dispatch again). Evidence: `App.test.tsx`/`UserPanel.test.tsx` (markup presence rules), `spectate.test.ts`, `session.test.ts` (dispatch sequences before/after).
- **AC-19 — Spectate edge cases.** (a) Target's grace expires → `memberLeft (left)` → the spectator auto-returns with the flight to the own cube. (b) Target completes a cube and moves servers → `memberLeft (moved)` → auto-return. (c) Target completes a cube on the same server → `levelAdvanced` → the spectator stays; the target's cube view rebuilds in place (view count unchanged, old view disposed once). (d) Spectator reconnects → view resets to the own cube instantly (no flight). (e) Live remote play is visible: a `miniCubeRemoved` for the spectated member hides the exact tile on their cube view and plays the pop/burst. Evidence: `spectate.test.ts`, `world.test.ts`, `server-state.test.ts`, `session.test.ts` (concrete sequences).

### Protocol & connection

- **AC-20 — Message catalog & hello-first.** On every connect the first server→client message is exactly `{ type: 'hello', serverTime }` (existing shape, exact assertion; no message precedes it). Each catalog message validates its required fields (unknown type → `error bad_message` to the sender; a message > `MAX_MESSAGE_BYTES` → dropped + `error bad_message`; any message before a successful join/rejoin → `error not_joined`; a second `join`/`rejoin` → `error bad_message`). Broadcasts are server-scoped: a member never receives events for members of another server (asserted member sets). Evidence: `protocol.test.ts` (codec matrix: valid + invalid payloads), `hub.test.ts` (hello order, scoping, error cases), mirrored `multiplayer/protocol.test.ts` (frontend codec parity on the same fixtures).
- **AC-21 — Heartbeat.** The hub sends WS protocol pings every `WS_HEARTBEAT_INTERVAL_MS` (30000) per connection; after `WS_MISSED_PONGS_LIMIT` (2) consecutive missed pongs it terminates the socket (`close()` called); a pong resets the count. Evidence: `hub.test.ts` with fake timers (ping at 30 s / 60 s / 90 s; close at the second miss; reset on pong).

### Client states & UI

- **AC-22 — Connection states & offline behavior.** The banner shows exact texts: `Connecting…` while connecting, `Connection lost — retrying…` during retries, and after retry exhaustion `Connection lost` with a `Retry` button whose activation reconnects. While disconnected: gameplay input is ignored (clicks/keys dispatch nothing — asserted), the world stays rendered and frozen, travel holds. On reconnect within grace: `rejoin` → `welcome` → own cube re-syncs to authority (board equality asserted), the view resets to the own cube instantly, and spectate state is cleared. Evidence: `ConnectionBanner.test.tsx` (exact strings per status), `transport.test.ts` (join/rejoin/token flow over a fake connection), `session.test.ts` (gating + resume wiring).
- **AC-23 — Intro after welcome; HUD server line.** The intro clock starts only when `welcome` arrives (before that: phase `intro` with progress 0, camera at the far pose, starfield visible). The HUD renders a pinned `Server <serverId>` line (value from the multiplayer store; `Server 1` in the zero-config world). Evidence: `session.test.ts`, `Hud.test.tsx` (exact markup), `App.test.tsx`.
- **AC-24 — No weakening (supersession ledger).** Every accepted behavior outside the § Supersessions ledger holds: board/rotation/pick semantics, pop/burst math, face-clear auto-rotation, style cycle, reduced-motion profile values, frame-loop lifecycle/disposal, starfield cone + expansion, the intro, burst fronting, seams and the pointer/keyboard controls (clicks, WASD/arrows, drags ignored), snapshot referential stability. All existing tests pass with only the ledgered fixture re-pins; `npm run build` succeeds with initial JS gzip ≤ `BUNDLE_BUDGET_GZ_KB` (350 KB). Evidence: full test transcripts, final build log.

### Containers, e2e & glossary

- **AC-25 — Containerization impact.** No new services, images, ports, or health signals; the backend container still exposes `GET /ws` on port 8080; `podman compose up` remains the single local command. `compose.yaml` changes only by adding the `MAX_USERS_PER_SERVER` passthrough (default 10) to the backend service's environment; `compose.smoke.yaml` gains only the backend environment overrides `MAX_USERS_PER_SERVER: "2"` and `RECONNECT_GRACE_MS: "1000"` (smoke-only settings); both Dockerfiles and healthchecks unchanged; README unchanged (run instructions unchanged). Evidence: `git diff` on container paths (exact hunks), optional smoke transcript.
- **AC-26 — Extended containerized smoke test.** `tests/e2e/smoke.mjs` additionally: (1) each client receives `hello` first; (2) two clients `join` → each `welcome` has `serverId 1`, `maxUsers 2`, roster size 2; (3) a third client → `serverId 2` (overflow at X = 2); (4) client A's valid `explode` yields `miniCubeRemoved` on B (broadcast) and on A (ack); (5) closing B's socket → A receives `memberLeft` after the grace window (the smoke backend env override sets `RECONNECT_GRACE_MS: "1000"` so the check runs in-budget); one PASS/FAIL line per check, non-zero exit on any failure. Evidence: smoke transcript at the final gate.
- **AC-27 — Glossary terms.** `docs/product/glossary.md` adds **game server** (a logical room inside the backend holding up to X members' cubes in one world; created when the first user joins; destroyed when its last member leaves), **server member** (a connected user assigned to a game server, with one cube on its ring layout), **spectating** (view-only camera travel to another member's cube, with return to one's own cube), and extends **cube world position** (online play assigns each member's cube a server slot position on the ring — occupancy by construction; the offline directional walk remains as the single-player definition). No other term redefined. Evidence: file inspection; reviewer.

## Non-goals

- No persistence of any kind (database, files, saves) — restart = full reset; no offline/idle progress, no save migration.
- No accounts, no authentication beyond the ephemeral token, no user-chosen display names (Q-2), no profile/settings surfaces.
- No chat, no leaderboards (server- or cross-server), no shared/global counters, no economy, no prestige.
- No cross-server interaction or visibility (members see only their own server — by design); no server browser/list; no manual server choice.
- No multi-process or multi-container backend (one process, logical servers — Q-9); no load-balancer/proxy design; no TLS.
- No remote-cube level-of-detail/culling (Q-8), no spectate-view rotation (Q-7), no remote travel animations for other members' level advances (instant in-place rebuilds).
- No new dependencies (plan § Dependency requests); no CI/config/healthcheck changes; no browser automation beyond the existing smoke test; no pixel tests.
- No changes to `main.tsx`, `index.html`, backend `server.ts` (env parsing lives in `game/config.ts`), or the Dockerfiles.

## Boundaries

- ✅ Always: keep `game/**` and `multiplayer/**` pure and DOM-free (injected environment/clock/RNG only); tests with concrete expected values beside every behavior change; run lint, typecheck, tests, and the coverage command before reporting done; record raw evidence in `build-log-T<id>.md`; stage only `files_owned` per task; server authority over every shared value (identity, membership, boards, positions) — clients are never trusted.
- ⚠️ Ask first: any new dependency (none needed); any pinned-constant deviation; touching a file outside a task's `files_owned` (especially `compose.yaml`/`compose.smoke.yaml`/`smoke.mjs` — T15 only); any coverage exclusion or threshold change; user-chosen display names or token persistence beyond in-memory (Q-2/Q-3).
- 🚫 Never: weaken assertions (banned matchers, snapshot-only, assertion-free, useless tests) or add coverage exclusions; touch `.env*` or commit secrets; store the session token outside memory; treat client-reported values as truth (no last-write-wins for shared state); edit the accepted features' specs/plans/tasks (this spec supersedes via the ledger); push; change pinned constants or ACs unilaterally.

## Security considerations

- **User-controlled data:** display names are server-generated (no user text in v1 — Q-2); the only client-authored values are `token`, mini-cube ids and levels — all validated against authoritative state (unknown/removed ids, wrong levels, bad messages are rejected with errors, never applied). Message size capped (`MAX_MESSAGE_BYTES` 1024) and connection count capped (`MAX_CONNECTIONS` 200) to bound parsing and socket abuse.
- **Tokens & secrets:** `sessionToken` is 128-bit CSPRNG (`crypto.randomBytes`); held in client memory only, short-lived in effect (grace window), compared on the server against the in-memory registry; nothing is logged. No API keys, no `.env*`, no secrets in the bundle beyond the ephemeral token (an acceptable session credential, not an account).
- **Abuse/DoS bounds:** per-member click rate limit (30/s) with at-most-once-per-second error feedback; per-socket size cap; transport-level heartbeat terminates dead peers (no ghost members forever); broadcast fan-out is bounded by X ≤ 24 and is server-scoped, so no message can amplify beyond 23 recipients; server-authoritative completion validation prevents level-skipping.
- **Persistence integrity:** not applicable — nothing is persisted; a restart wipes all state, so there is no data to corrupt or leak. This is a pinned non-goal with the implication documented in § 1.
- **Rendering safety:** procedural geometry only (no loaders/assets); remote cubes render server-controlled numeric data only; all DOM text is static copy or server-generated names (React-escaped).
- **Test integrity as a control:** the coverage bar and concrete-assertion rule protect the pure logic; `game/**`/`multiplayer/**` DOM-freedom keeps the shared-state reducer auditable and testable (this is the same discipline the accepted features established).

## Real-time impact (contract)

This feature **creates** the shared-state layer, so the contract is explicit:

- **Server authority.** The backend is the single authority for: identities/tokens, server membership and slots, per-member cube boards (removed-id sets), level advancement (N, style, levelIndex), world positions, and the move plan. Client-reported values (`explode`, `cubeCompleted`) are requests, validated against authority, and corrected via `stateSync`. There is no last-write-wins anywhere for shared state.
- **Connection lifecycle.** connect → `hello` → `join`/`rejoin` → `welcome`; heartbeat pings every 30 s terminate unresponsive peers after 2 missed pongs; socket close starts the 30 s grace window (state retained, member still listed); grace expiry removes the member and broadcasts `memberLeft`; rejoin within grace resumes exactly; after grace, identity is unrecoverable (fresh join). Backend restart invalidates every token (in-memory registry).
- **Multi-client behavior.** Two tabs = two independent identities (no account to correlate them). Concurrent clients on one server each get a distinct slot/cube; broadcasts reach all members including the origin (ack semantics). Conflicting requests are serialized server-side in arrival order; the first valid request wins and the second is rejected with `stateSync` correction.
- **Latency behavior.** Own-cube play is optimistic (instant local response, ≤ 1 frame); remote updates arrive within network latency; the next-cube level advance waits for the server response (travel holds at progress 0 — pinned, so latency shifts the transition start, never desyncs it); spectate travel is purely client-side rendering of server-assigned positions. Disconnection freezes the world but never corrupts it (authority resumes on reconnect).

## Containerization impact

**Additive, no new services.** The feature runs inside the existing backend container (new modules, no new process/image/port; the WebSocket endpoint stays `GET /ws` on 8080). Runtime configuration comes from environment variables with safe defaults (`MAX_USERS_PER_SERVER`, `RECONNECT_GRACE_MS` — defaults make a plain `podman compose up` work unchanged); `compose.yaml` gains only the documented passthrough and `compose.smoke.yaml` only the smoke-time capacity/grace overrides (T15 owns both files). Dockerfiles, HEALTHCHECKs, and README run instructions are unchanged. The smoke test (`npm run smoke`) is extended, not replaced. No deployment-time decisions are made (proxies/load balancers stay deferred per `docs/architecture/containerization.md`).

## Testing strategy

- **Backend unit (Vitest, node):** `config.test.ts` (env parsing boundaries), `servers.test.ts` (registry lifecycle, assignment, `computeMovePlan` fixtures, ring-layout formula literals, id reuse), `players.test.ts` (identity formats, token uniqueness, grace transitions with fake timers), `cubes.test.ts` (validation matrix, completion boundary N²−1/N², pinned draw values), `protocol.test.ts` (codec matrix: every catalog message valid + malformed → exact errors; size cap).
- **Backend integration (same node environment, no new deps):** `hub.test.ts` drives `GameHub` through fake `Peer` sockets (join/welcome order, broadcast member sets, server scoping, rate limits, heartbeat via fake timers, grace expiry, move execution end-to-end); `app.test.ts` extends the existing app tests: the real app on an ephemeral port with Node 24's global `WebSocket` client — `hello` first, then the catalog (no `ws`-client dependency needed).
- **Frontend unit (Vitest, node):** `multiplayer/protocol.test.ts` (codec parity on the same fixtures as the backend), `server-state.test.ts` (reducer over pinned message sequences → exact world/roster/board state), `spectate.test.ts` (state machine incl. every AC-19 edge case), `transport.test.ts` (join/rejoin/token/send over the injected connection factory), `engine.test.ts` additions (online-mode hold/complete, travel kinds, spectate gating, view-only input), `spectate-travel.test.ts` (exact pose tables).
- **Frontend integration (node, real three.js scene graph, SSR for React):** `world.test.ts` (real `InstancedMesh`-based remote cube views: positions, counts ≤ X·7, broadcast application, exact-once disposal), `scene.test.ts` additions (own-cube position, server-assigned destinations, midpoint world swap, spectate flight rendering), `session.test.ts` additions (welcome → intro, explode forwarding, disconnect gating, resume wiring), React SSR tests (`App.test.tsx`, `Hud.test.tsx`, `UserPanel.test.tsx`, `ConnectionBanner.test.tsx`) asserting exact markup per state.
- **E2E / container:** the extended `smoke.mjs` (AC-26) via `npm run smoke` where the environment allows; run at the final gate, result recorded in the build log.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines **per workspace** (backend and frontend both; backend's previously-trivial 100% is now a real gate over the new modules). Pre-gates per task are workspace-scoped (`npm run coverage --workspace @cubeclicker/backend` / `--workspace @cubeclicker/frontend`). Coverage exclusions unchanged; no carve-outs — if a metric cannot honestly clear 80, the task reports `blocked`. Known honest residual carries over from the accepted features (thin React effect bodies, mocked `WebGLRenderer`, `ws/connection.ts`); the multiplayer logic itself is fully node-testable by construction.
- **Assertion bar:** concrete expected values everywhere (exact message objects, exact positions, exact counts); no banned matchers, no snapshot-only/assertion-free tests, no `toBeCloseTo` (dyadic-exact values + the accepted `Math.fround` pattern where three.js round-trips).
- **Verification commands:** `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage --workspace …` (per-task pre-gates), `npm run coverage` (final), `npm run build` (budget check), `npm run smoke` (final, where the environment allows).

## Open questions

- **Q-1 — Server capacity X (user-visible decision; the analysis was requested).** **Recommended: X = 10** per the plan's capacity analysis (client render budget + social density + rebalance churn). Alternatives: 6 (intimate, more splits/moves), 16 (busier world, heavier integrated GPUs, ~1.6× fan-out), 25 (the config ceiling — needs LoD later). It is a one-env change with no code change; the ring layout recomputes from X.
- **Q-2 — Display names.** Pinned: auto-generated `Player <N>`. **Recommended: keep auto-generated in v1** — no user text → no moderation/validation surface; user-chosen names are a future feature (would need name validation, uniqueness handling, and a moderation decision the user should own). If the user wants names now, the spec needs a revision with a name-length/character policy.
- **Q-3 — Token persistence across page reloads.** Pinned: token in memory only — a reload gets a new identity and the old one expires via grace (consistent with "no accounts required" and the accepted no-persistence stance). **Recommended: keep in-memory** for v1; sessionStorage resume (reload keeps your cube) is a small later feature if wanted.
- **Q-4 — Grace window length.** Pinned: 30 s (range 1000–600000, env). **Recommended: 30 s** — long enough for transient drops and short refreshes, short enough that ghost cubes don't linger. 10 s/60 s are one-env changes.
- **Q-5 — Empty-server destruction.** Pinned: immediate destruction, ids never reused. **Recommended: keep** (in-memory state has no value after the last member leaves; monotonic ids avoid any ABA confusion). Alternative (destroy only after an idle timeout) adds state for no benefit.
- **Q-6 — Server id reuse.** Pinned: never reuse. **Recommended: keep** (see Q-5). Alternative (lowest-free id) makes ids depend on history and complicates client logs.
- **Q-7 — Spectating view controls.** Pinned: view-only — no rotation of the spectated cube (you watch the front face at the standard rest pose). **Recommended: keep for v1**; a spectator-rotation mode (rotate the view without touching game state) is a clean follow-up.
- **Q-8 — Remote cube rendering detail.** Pinned: full-detail cube views for all members (bounded by X ≤ 24). **Recommended: keep** while X ≤ 16; simplified placeholder cubes/instanced point clouds become worth it only if the user raises X above 16 (then the render bound argument changes).
- **Q-9 — What a "server" is.** Pinned: **logical rooms inside the single backend process** — the containerized architecture runs one backend service, and per-user OS processes/containers would break the single `podman compose up` contract and the deployment-neutral image model. **Recommended: keep.** If the user ever wants true isolated server processes, that is a separate architecture amendment (stack-level decision).
- **Q-10 — Identity vs "no accounts" (flagged tension).** Ephemeral identities resolve the immediate presence/attribution need, but they make future features that depend on stable identity (leaderboards, reputation, friends) impossible without a new decision. Not resolved here; carried forward in `docs/product/realtime-backlog.md`'s open tension. **Recommended: revisit when a leaderboard/friends feature is requested.**

## Assumptions

- "Every time backend goes online, if user connects to it, it will create the first server" = servers are created lazily by the backend on the first connection (no servers exist at boot); "servers" are logical rooms in the one backend process (Q-9), not separate OS processes.
- "X number of users maximum" = one global capacity X applied to every server, configurable by env (Q-1); X is not per-server.
- "If X+1 users on server, this new one, will create another server" = the join rule in § 4 (lowest-id server with a free slot; else a new server) — which reproduces strict fill-then-spill in the common case and stays well-defined after churn.
- "A recalculation of exchanging users from 1 server to another … happens when a user finishes his cube" = the two-phase rebalance: plan recomputed on membership changes, executed at the mover's cube completion (§ 4, § 7) — no mid-cube eviction, ever.
- "We can, as user playing, see other's playing (camera going/travelling with an animation to the other's user cube)" = spectating: view-only travel to another member's cube plus live broadcast-driven visibility of their play; all members' cubes are also rendered in the world from one's own position (§ 5).
- "For each user, you'll create a cube in the space" = one cube per member per level, placed on the deterministic server ring (§ 5); positions are server-assigned and stable.
- The stack is decided and unchanged (TypeScript strict, Node 24 + Fastify `@fastify/websocket` at `/ws`, React + Vite, Vitest, ESLint, npm workspaces); no dependency additions are needed (plan § Dependency requests) — Node 24's global `WebSocket` client and fake `Peer` sockets cover all test tiers.
- The four accepted features' specs/plans/tasks remain authoritative for everything not superseded by the § Supersessions ledger; this spec is read alongside them and never edits them.
- The engine keeps its offline defaults (local grid/direction draws, origin positions) as the test/fallback path; the production session always runs online-mode.
- Stats (`clicks`, `facesDestroyed`) remain session-local HUD values; the server tracks only removed-id sets (no shared counters — out of scope), so `stateSync` corrections reconcile boards but never roll back stats.
- The smoke test's grace override (`RECONNECT_GRACE_MS: "1000"`) is passed via `compose.smoke.yaml` so the `memberLeft` check runs within the smoke budget; this is a smoke-only setting.
- `VITE_WS_URL` (already decided: default `ws://localhost:8080/ws`) is the frontend's WebSocket target; the transport resolves it from `import.meta.env` in the bundle (no new global reader).

## Revision history

- r1 — 2026-10-21 — initial draft (planning phase).
- r2 — 2026-10-22 — documentation erratum (AC-10 fixture, T5 hello ownership, glossary parenthetical); no requirement changed.
