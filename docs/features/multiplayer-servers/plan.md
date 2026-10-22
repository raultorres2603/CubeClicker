---
feature: multiplayer-servers
revision: 1
---
# Plan — Multiplayer Servers & Spectating (online, real-time cube worlds)

## Architecture

Two workspaces, one authority. The backend (single Fastify process) owns every shared value; the frontend adds a multiplayer layer that consumes authority through a pull-style store and a push-style transport — the same discipline the accepted features established (`game/**` pure, renderers as leaves).

### Backend (`src/backend/src/game/**`)

```
config.ts   — env parsing/validation (MAX_USERS_PER_SERVER, RECONNECT_GRACE_MS, rate/heartbeat/size/cap constants)
servers.ts  — pure: registry (create/assign/remove/destroy), pickServer (join rule), computeMovePlan (rebalance),
              worldPosition (ring layout). Mutable registry wrapper over the pure functions.
players.ts  — identity records: playerId p<N>, name "Player <N>", crypto token, grace tracking (injectable clock/timers)
cubes.ts    — per-member cube state: removed-id sets, validateExplode, validateCompletion, createNextCube
              (N = 3 + ⌊random()·5⌋, injectable RNG; style cycle from levelIndex)
protocol.ts — message type union + codecs (parse with validation → ok | error), MAX_MESSAGE_BYTES
hub.ts      — GameHub: attaches/detaches Peer sockets, join/rejoin/explode/cubeCompleted handling, broadcasts
              (server-scoped, incl. origin), rate limiting, WS heartbeat (ping/2-missed-pongs), move execution
app.ts      — /ws route: send hello, then hub.attach(socket); unchanged /healthz (creates nothing)
```

- **State ownership:** the hub holds the registry (servers → members → players → cubes). All state in memory; restart = reset. `server.ts` unchanged (env parsing lives in `config.ts`).
- **Data flow (C→S):** `explode` → validate against the member's cube → apply → broadcast `miniCubeRemoved` to the server's members (incl. origin) or `error` + `stateSync` to the origin only. `cubeCompleted` → validate full board → `createNextCube` + move decision (plan execution) → same-server: broadcast `levelAdvanced` (incl. origin); cross-server: broadcast `memberLeft (moved)` to the old server, `memberJoined` to the new one, `worldEntered` to the mover, destroy the old server if empty.
- **Joins:** `join` → identity → `pickServer` (lowest-id with capacity, else new) → slot = lowest free → `welcome` (full roster incl. self) → broadcast `memberJoined` to the others → recompute move plan. `rejoin {token}` → match within grace → resume (fresh `welcome`) or `error resume_failed`.

### Frontend (`src/frontend/src`)

```
multiplayer/protocol.ts   — mirrored codec (parity fixtures with the backend)
multiplayer/server-state.ts — pure reducer: messages → { serverId, maxUsers, self: CubeState, members: Member[] (slot order),
                               pending world-swap } — referentially stable per change (React contract)
multiplayer/spectate.ts   — spectate machine: 'none' | 'traveling' | 'viewing'; targets, auto-return triggers (AC-19)
multiplayer/transport.ts  — wraps ws/connection.ts: connect → hello → join/rejoin → token (in-memory), send(),
                               status callback (banner), VITE_WS_URL resolution (import.meta.env)
render/world.ts           — WorldView: one cube view per member (own excluded; scene owns the own view), positions from
                               server state, applies miniCubeRemoved/faceCleared/levelAdvanced/memberJoined/memberLeft,
                               dispose (exact-once); ≤ X views, ≤ 7 meshes each
render/spectate-travel.ts — pure travelCameraPose(origin, destination, p) → { position, lookTarget } reusing the
                               accepted formula (lateral easeInOutQuad·offset; z = 12 + 78·travelSwing(p)); pinned tables
game/engine.ts            — additive online mode: options.online; travel holds until completeNextLevel({ gridSize, style,
                               destination }); travelKind ('nextLevel' | 'spectate' | 'return'); setSpectating(bool);
                               snapshot += travelKind, travelDestination, spectating. Offline defaults unchanged.
render/scene.ts           — additive: own-cube world position, destination-driven travel (server-assigned), midpoint
                               world swap (WorldView rebuild), spectate/return flights; offline defaults unchanged.
game/session.ts           — wiring: transport injection (default inert for tests/SSR), welcome → intro start,
                               explode forwarding, cubeCompleted on 6th face, disconnect gating, resume → re-sync.
ui/UserPanel.tsx, ui/ConnectionBanner.tsx, ui/Hud.tsx (+Server line), App.tsx, ui/app.css — pinned markup/copy.
```

- **Data flow (S→C):** transport → `server-state` reducer → (a) `world.ts` applies remote-cube changes; (b) the session applies own-cube authority (`nextCube` data → `engine.completeNextLevel`, `stateSync` → board reconcile); (c) React subscribes to server-state for the panel/HUD/banner.
- **State ownership:** engine owns local play state (optimistic); server-state owns the world/roster; spectate.ts owns the spectate mode; the session composes them; the scene owns three.js objects only.

## Capacity analysis (server capacity X)

This is the requested analysis; the numbers drive Q-1 (X = 10).

**Message inventory (per member, per second).** Steady-state traffic is dominated by clicks: `explode` (C→S, ~120 B) and its broadcast `miniCubeRemoved` (S→C, ~150 B). Human sustained click rates are 4–8/s with bursts to ~10/s; the rate limit (30/s) only caps auto-clickers. Structural messages (join/leave/advance) are < 1/s per member.

| X (capacity) | Fan-out per click | Outbound msgs/s at r = 10/s per member (worst burst) | Outbound payload | Notes |
| --- | --- | --- | --- | --- |
| 6 | 5 | 6·10·5 = 300 | ~45 KB/s | Cozy; servers split/rebalance often |
| **10 (default)** | 9 | 10·10·9 = **900** | ~135 KB/s (~0.2 MB/s wire w/ framing) | Recommended |
| 16 | 15 | 16·10·15 = 2400 | ~360 KB/s | Still trivial for Node; heavier client |
| 25 (cap) | 24 | 25·10·24 = 6000 | ~0.9 MB/s | Node fine; client GPU is the wall |

**Server-side cost.** Node + `ws` sustains tens of thousands of messages/s on one core; at X = 25 worst case (~6 k msgs/s, < 1 MB/s) the event loop is far from saturation — server CPU/bandwidth is **not** the binding constraint. Memory: a member's cube ≤ 294 removed ids ≈ 6 KB; a full server ≤ ~150 KB at X = 25 — negligible. Validation/rate-limit work per click is O(1).

**Client-side cost — the binding constraint.** Every server member's cube is a full cube view: 1 body + up to 6 `InstancedMesh` faces with ≤ N² = 49 instances each (worst-case N = 7). One cube view ≤ 7 meshes/294 instances. World total: X cubes → X·7 meshes, X·294 instances worst case:

| X | Meshes | Instances (worst case) | Assessment |
| --- | --- | --- | --- |
| 6 | 42 | 1764 | Easy on any WebGL device |
| **10** | **70** | **2940** | Comfortable on integrated GPUs (same order as a busy three.js scene) |
| 16 | 112 | 4704 | Fine on dedicated GPUs, borderline on old integrated ones |
| 25 | 175 | 7350 | Jank risk on integrated GPUs → would need LoD (Q-8, out of scope) |

**Social & operational tradeoffs.** X = 10 gives a populated spectating world without crowding; the ring stays compact (radius R = X·24/(2π) ≈ 38.2 world units — adjacent arcs exactly 24 units, matching the accepted `CUBE_SPACING` feel). Larger X means fewer cross-server moves (less rebalancing churn); smaller X splits servers sooner and moves members more often. The rebalance itself is cheap: a move is one membership change executed at the mover's completion, never a live migration.

**Recommendation: X = 10 default, valid range 2–24, env-configurable (`MAX_USERS_PER_SERVER`).** The ceiling (24) is set where the render bound stops being comfortably safe; raising it beyond 24 requires the LoD work of Q-8. Changing X never needs code changes — the ring layout recomputes from X.

## Protocol

Transport: `GET /ws` (existing). JSON text frames; one message per frame; `hello` first (exact existing envelope). Transport-level heartbeat: WS ping every 30 s, terminate after 2 missed pongs (browsers auto-pong; no app-level ping/pong). Catalog and shapes (mirrored verbatim in `src/backend/src/game/protocol.ts` and `src/frontend/src/multiplayer/protocol.ts`):

```ts
// Shared shapes
type MiniCubeId = `${FaceId}:${number}:${number}`;      // face:row:col (retained)
interface Position { x: number; y: number }             // world plane, z = 0
interface CubeState { levelIndex: number; gridSize: number; styleId: string; removedIds: string[] }
interface MemberState { playerId: string; name: string; position: Position;
                        levelIndex: number; gridSize: number; styleId: string; removedIds: string[] }
type ErrorCode = 'bad_message' | 'not_joined' | 'rate_limited'
               | 'invalid_click' | 'invalid_completion' | 'resume_failed';

// Client → server
type ClientMessage =
  | { type: 'join' }                                                    // once, after hello
  | { type: 'rejoin'; token: string }                                   // resume attempt
  | { type: 'explode'; id: MiniCubeId; level: number }                  // own-cube click
  | { type: 'cubeCompleted'; level: number };                           // 6th face cleared

// Server → client
type ServerMessage =
  | { type: 'hello'; serverTime: string }                               // exact retained shape, always first
  | { type: 'welcome'; playerId: string; name: string; token: string;
      serverId: number; maxUsers: number; position: Position;
      self: CubeState; roster: MemberState[] }
  | { type: 'worldEntered'; playerId: string; name: string; token: string;
      serverId: number; maxUsers: number; position: Position;
      self: CubeState; roster: MemberState[] }                          // cross-server move (same shape)
  | { type: 'memberJoined'; member: MemberState }
  | { type: 'memberLeft'; playerId: string; reason: 'left' | 'moved' }
  | { type: 'miniCubeRemoved'; playerId: string; id: MiniCubeId }       // broadcast incl. origin (ack)
  | { type: 'levelAdvanced'; playerId: string; levelIndex: number; gridSize: number;
      styleId: string; position: Position; removedIds: [] }             // broadcast incl. origin
  | { type: 'stateSync'; playerId: string; levelIndex: number; gridSize: number;
      styleId: string; removedIds: string[] }                           // authoritative board (correction)
  | { type: 'error'; code: ErrorCode; detail?: string };
```

**Ordering & validation rules (hub):** `hello` before anything; messages before a successful join/rejoin → `error not_joined`; second join/rejoin → `error bad_message`; unknown type or > 1024 B → `error bad_message` (oversized messages dropped); `explode`/`cubeCompleted` with a wrong `level` → `error invalid_click`/`invalid_completion` + `stateSync`; explode rate limit 30/s per member (excess dropped, `rate_limited` at most 1/s). **Broadcast scoping:** every broadcast targets exactly the members of the affected server (including the origin where noted) — never other servers.

**Sequence pins (tested end-to-end in `hub.test.ts`):**
1. Join: `hello` → `join` → `welcome` (self + roster) → others get `memberJoined`; plan recomputed.
2. Click: `explode(valid)` → `miniCubeRemoved` to all members (incl. origin). `explode(invalid)` → `error invalid_click` + `stateSync` to origin only.
3. Completion, same server: `cubeCompleted` → `levelAdvanced` to all members (incl. origin); the origin's client runs `engine.completeNextLevel` with `gridSize`/`styleId`/`position`.
4. Completion, cross-server (move): `cubeCompleted` → old server gets `memberLeft (moved)`; mover gets `worldEntered`; target server gets `memberJoined`; vacated empty server destroyed.
5. Disconnect: close → grace (member stays in roster) → expiry → `memberLeft (left)` → plan recomputed.

## Interfaces / contracts

Pinned enough for parallel builders; wording may vary slightly if the semantics hold. All `game/**`/`multiplayer/**` modules are DOM-free with injected clock/RNG/timers.

### Backend (`src/backend/src/game/**`)

```ts
// config.ts
export interface GameConfig {
  maxUsersPerServer: number;       // default 10, valid 2..24 (throw on invalid)
  reconnectGraceMs: number;        // default 30000, valid 1000..600000
  clickRateLimitPerSecond: number; // 30
  heartbeatIntervalMs: number;     // 30000
  missedPongsLimit: number;        // 2
  maxMessageBytes: number;         // 1024
  maxConnections: number;          // 200
}
export function loadGameConfig(env: Record<string, string | undefined>): GameConfig; // throws Error naming the variable

// servers.ts — pure functions + registry
export const SLOT_SPACING = 24;
export function worldPosition(slot: number, maxUsers: number): Position;
//   angle = 2π·(slot−1)/maxUsers; radius = maxUsers·SLOT_SPACING/(2π); → (R·cos θ, R·sin θ)
export interface ServerState { id: number; members: string[] } // members in slot/join order (index = slot−1)
export function pickServer(servers: readonly ServerState[], maxUsers: number, nextId: number):
  { serverId: number; slot: number; created: boolean };        // lowest-id with a free slot; else new (nextId)
export function computeMovePlan(servers: readonly ServerState[], maxUsers: number): Map<string, number>;
//   destinations ascending id with free slots; donors = higher-id servers' members in join order;
//   target always strictly lower than the member's current id; deterministic
export interface ServerRegistry {
  serverCount(): number;
  servers(): ServerState[];
  assign(joining: string): { serverId: number; slot: number }; // pickServer + create if needed (fresh monotonic id)
  removeMember(playerId: string): { left: boolean; serverDestroyed: boolean };
  moveMember(playerId: string, targetServerId: number): { slot: number } | null; // null when target invalid
  plan(): Map<string, number>;                                 // recompute from current state
}

// players.ts
export interface PlayerRecord { playerId: string /* p<N> */; name: string /* Player <N> */;
                                token: string /* 32 hex, crypto.randomBytes(16) */ }
export function createPlayerRecord(counter: number): PlayerRecord;
export interface GraceTracker { begin(playerId: string): void; expiresAt(playerId: string): number;
                                cancel(playerId: string): void; expired(playerId: string, nowMs: number): boolean; }
// (injectable clock/timers for tests)

// cubes.ts
export interface CubeState { levelIndex: number; gridSize: number; styleId: string; removedIds: Set<string> }
export function createNextCube(prev: CubeState | null, styleFor: (levelIndex: number) => string,
                               random: () => number): CubeState;        // N = 3 + ⌊random()·5⌋; levelIndex+1
export function validateExplode(cube: CubeState, id: string, level: number): boolean;
export function isComplete(cube: CubeState, level: number): boolean;    // removedIds covers all 6·gridSize² ids
export function allIds(gridSize: number): string[];                     // the 6N² face:row:col ids

// hub.ts
export interface Peer { send(text: string): void; close(): void; isOpen(): boolean;
                        on(event: 'message'|'close'|'pong', handler: (arg?: unknown) => void): void;
                        ping(): void; }                                 // socket-like; fake in tests
export interface HubDeps { config: GameConfig; now(): number; random(): () => number;
                           timers: { setInterval: typeof setInterval; clearInterval: typeof clearInterval;
                                     setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout } }
export function createGameHub(deps: HubDeps): GameHub;
export interface GameHub { attach(peer: Peer): void; connectionCount(): number; }
// attach: hello → wait join/rejoin → welcome/worldEntered flows above; heartbeat per peer;
//         detach on close → grace → expiry → memberLeft + destroy-if-empty + plan recompute
```

`app.ts`: `buildApp()` registers `/ws` and hands each socket to the hub after sending `hello`; `helloMessage` (exact existing shape) is reused — the existing `app.test.ts` hello assertions keep passing. `server.ts` unchanged.

### Frontend (`src/frontend/src`)

```ts
// multiplayer/server-state.ts — pure reducer over ServerMessage (after transport decode)
export interface WorldState {
  serverId: number; maxUsers: number;
  self: { playerId: string; name: string; position: Position; cube: CubeState };
  members: MemberState[];            // slot order (self excluded)
  pendingWorldSwap: { serverId: number; position: Position; roster: MemberState[] } | null; // set by worldEntered
}
export function createWorldState(): WorldState;
export function reduceWorldState(state: WorldState, msg: ServerMessage): WorldState; // referentially stable
// miniCubeRemoved → update the member's cube removedIds; levelAdvanced → replace that member's cube/position;
// memberJoined/memberLeft → add/remove; stateSync → authoritative board replace; worldEntered → pending swap

// multiplayer/spectate.ts
export type SpectateStatus = { mode: 'none' } | { mode: 'traveling'; target: string; destination: Position }
                           | { mode: 'viewing'; target: string };
export function createSpectateController(): {
  get(): SpectateStatus;
  requestTravel(targetId: string, destination: Position): boolean;  // false when already traveling
  arrive(): void;                       // traveling → viewing
  requestReturn(ownPosition: Position): boolean;
  arrivedHome(): void;                  // → none
  onMemberLeft(playerId: string): void; // viewing/traveling that target → auto-return request
  reset(): void;                        // reconnect
};

// multiplayer/transport.ts
export type TransportStatus = 'connecting' | 'connected' | 'disconnected' | 'exhausted';
export interface Transport {
  connect(): void; close(): void;
  send(message: ClientMessage): void;
  onMessage(handler: (msg: ServerMessage) => void): () => void;
  onStatus(handler: (status: TransportStatus) => void): () => void;
}
export function createTransport(options: { url: string; socketFactory?: (url: string) => WebSocket;
  token?: string | null }): Transport;  // hello → join or rejoin(token) → resume_failed → join;
                                        // decode+validate; unknown/malformed server frames dropped (logged)

// game/engine.ts — additive online seams (offline defaults unchanged)
export interface EngineOptions { /* existing */ online?: boolean }
export interface NextLevelData { gridSize: number; style: CubeStyle; destination: Position }
export type GameEvent = /* existing events */ | { type: 'travelTo'; kind: 'spectate' | 'return'; destination: Position };
export interface GameEngine { /* existing */ +
  completeNextLevel(data: NextLevelData): void;     // online: releases the held travel (midpoint advance, once)
  setSpectating(active: boolean): void;             // view-only input gating
}
export interface EngineSnapshot { /* existing */ +
  travelKind: 'nextLevel' | 'spectate' | 'return' | null;
  travelDestination: Position | null;               // non-null during a travel with a known destination
  spectating: boolean;
}
// Online travel: phase becomes travel after the face fade; travelStarted + the progress clock hold until
// completeNextLevel (destination arrives with the data); midpoint advance exactly once; then playing.
// Spectate/return: session dispatches travelTo (kind + destination); no level advance; on completion → playing.
```

- **Session wiring (`game/session.ts`, additive):** `GameSessionOptions` gains `transport?: Transport` (default: inert no-op — existing tests/SSR unaffected). Attach: create/connect the transport (or use the injected one), forward `explode` on each successful `explodeMiniCube` dispatch (level from the snapshot), send `cubeCompleted` when the sixth face clears, apply authority: `miniCubeRemoved` for self → reconcile (no-op when consistent), `levelAdvanced`/`worldEntered` for self → `engine.completeNextLevel`, `stateSync` → board reconcile, `welcome` → start the intro clock (position → scene), disconnect → gate input (dispatch no-ops) and hold travel, resume → re-sync + `spectate.reset()` + instant view reset. Spectate requests flow through `spectate.ts` → engine travel (kind spectate/return) → scene destination.
- **Scene (`render/scene.ts`, additive):** `createSceneView` gains options `{ ownPosition?: Position }` and consumes `travelKind`/`travelDestination` for destination-driven flights (the accepted formula, destination instead of the drawn offset); at the midpoint of a `nextLevel` travel with a `worldEntered`-driven server change, the WorldView rebuilds (old disposed once); spectate/return flights render the same formula to/from the target; the own cube group sits at `ownPosition`. Offline defaults (origin, direction offsets) unchanged.
- **World (`render/world.ts`):** `createWorldView(options: { maxUsers: number })` → `{ applyRoster(members: MemberState[]): void; applyMessage(msg: ServerMessage): void; views(): ReadonlyMap<string, CubeView-like>; dispose(): void }` — one cube view per member (reusing `createCubeView` per member's `gridSize`/style), positioned at the member's position; `miniCubeRemoved` → hide tile + spawn the accepted pop/burst at the tile origin; face-cleared derived from removed-set transitions → `removeFace`; `levelAdvanced` → dispose old view once + rebuild; drawable bound ≤ (X−1)·7 meshes; all views non-pickable (picking still receives only the own `cubeView` — the isolation is asserted in `world.test.ts`).
- **UI (pinned copy):** `ConnectionBanner` status texts `Connecting…` / `Connection lost — retrying…` / `Connection lost` + button `Retry`. `UserPanel`: toggle button `Users on Server`; panel `aria-label="Users on server"`; rows = slot-order `<button>`s `{name} · Cube {level+1}`; own row (first, disabled) `{name} (You)`; while spectating a pinned `Return to my cube` button renders. `Hud` gains the `Server <serverId>` line (existing lines unchanged). Live region additions (same single region): `Traveling to {name}'s cube…`, `Returning to your cube…`.

## File inventory

| Path | New/Edit | Purpose | Owner task |
| --- | --- | --- | --- |
| `src/backend/src/game/config.ts` + `config.test.ts` | New | env config + validation | T1 |
| `src/backend/src/game/servers.ts` + `servers.test.ts` | New | registry, assignment, move plan, ring layout | T1 |
| `src/backend/src/game/players.ts` + `players.test.ts` | New | identity, tokens, grace tracking | T2 |
| `src/backend/src/game/cubes.ts` + `cubes.test.ts` | New | cube state, validation, next-cube draws | T3 |
| `src/backend/src/game/protocol.ts` + `protocol.test.ts` | New | catalog + codecs | T4 |
| `src/backend/src/game/hub.ts` + `hub.test.ts` | New | connection lifecycle, broadcasts, limits, heartbeat | T5 |
| `src/backend/src/app.ts` + `app.test.ts` | Edit | `/ws` → hello + hub attach (hello tests retained) | T5 |
| `src/frontend/src/multiplayer/protocol.ts` + `protocol.test.ts` | New | mirrored codec (parity fixtures) | T7 |
| `src/frontend/src/multiplayer/server-state.ts` + `server-state.test.ts` | New | world/roster reducer | T7 |
| `src/frontend/src/multiplayer/spectate.ts` + `spectate.test.ts` | New | spectate machine | T7 |
| `src/frontend/src/game/engine.ts` + `engine.test.ts` | Edit | online seams (hold/complete, travel kinds, spectating gate) | T8 |
| `src/frontend/src/multiplayer/transport.ts` + `transport.test.ts` | New | join/rejoin/token/send over ws/connection.ts | T9 |
| `src/frontend/src/render/world.ts` + `world.test.ts` | New | remote cube views + layout | T10 |
| `src/frontend/src/render/spectate-travel.ts` + `spectate-travel.test.ts` | New | pinned flight pose math | T11 |
| `src/frontend/src/render/scene.ts` + `scene.test.ts` | Edit | own position, destinations, world swap, spectate flights | T12 |
| `src/frontend/src/game/session.ts` + `session.test.ts` | Edit | transport wiring, authority application, gating | T13 |
| `src/frontend/src/App.tsx` + `App.test.tsx` | Edit | shell: banner, panel, return button, live-region copy | T14 |
| `src/frontend/src/ui/Hud.tsx` + `Hud.test.tsx` | Edit | + `Server N` line | T14 |
| `src/frontend/src/ui/UserPanel.tsx` + `UserPanel.test.tsx` | New | roster panel + return button | T14 |
| `src/frontend/src/ui/ConnectionBanner.tsx` + `ConnectionBanner.test.tsx` | New | status banner + retry | T14 |
| `src/frontend/src/ui/app.css` | Edit | banner/panel layout | T14 |
| `compose.yaml` | Edit | backend env passthrough `MAX_USERS_PER_SERVER` (default 10) | T15 |
| `compose.smoke.yaml` | Edit | backend env overrides: `MAX_USERS_PER_SERVER: "2"`, `RECONNECT_GRACE_MS: "1000"` | T15 |
| `tests/e2e/smoke.mjs` | Edit | extended checks (AC-26) | T15 |
| `docs/product/glossary.md` | Edit | +game server, +server member, +spectating; cube world position extension | T16 |
| `docs/features/multiplayer-servers/build-log-T1.md` … `-T16.md` | New | per-task evidence | T1…T16 |

## Files intentionally unchanged

| Path | Why |
| --- | --- |
| `src/backend/src/server.ts` | env parsing lives in `game/config.ts` (injected at app build); listening unchanged |
| `src/backend/Dockerfile`, `src/frontend/Dockerfile`, `src/frontend/src/main.tsx`, `src/frontend/index.html`, `src/frontend/vite.config.ts`, `vitest.config.ts` (both), `tsconfig.json` (both), `eslint.config.mjs` | no structural/config change; no new deps; coverage exclusions unchanged |
| `src/frontend/src/ws/connection.ts` + `connection.test.ts` | the existing retry connection is **used**, not modified (transport wraps it) |
| `src/frontend/src/render/picking.ts` + `picking.test.ts` | pick path unchanged — remote cubes are never handed to `pickMiniCube` (isolation pinned in `world.test.ts`) |
| `src/frontend/src/browser-env.ts` | no new browser-global reader (VITE_WS_URL resolves via `import.meta.env` in transport) |
| `README.md`, `AGENTS.md`, `docs/architecture/**`, predecessor feature docs | run instructions unchanged; no direction change |
| `package.json` (both), `package-lock.json` | zero new dependencies |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | "Servers" = logical rooms in the one backend process | Matches the decided single-service container model and the `podman compose up` contract; avoids infra sprawl for a clicker | Per-user processes/containers — rejected (breaks deployment-neutral single-image model; Q-9) |
| D-2 | X = 10 default, env-configurable 2–24 | § Capacity analysis: client render budget binds first; 10 balances density/render/churn | 6 / 16 / 25 — tabled; one-env change |
| D-3 | Ephemeral identity: `p<N>` + crypto token, in-memory only, 30 s grace | No accounts decided → minimal viable presence; token enables exact resume; memory-only honors the no-persistence stance | sessionStorage token — Q-3 (deferred); signed JWT — overkill, adds deps |
| D-4 | Join rule: lowest-id server with capacity, else new; fill-then-spill in the common case | Reproduces the user's fill/spill model and stays well-defined after churn | Strict "first non-full" — ambiguous after rebalances; balanced fill — breaks the user's sequential model |
| D-5 | Two-phase rebalance: plan on membership changes, execute at completion | The user's exact ask ("recalculation" on disconnect, "next cube on the new server"); never evicts mid-cube; strictly-decreasing ids ⇒ no oscillation | Live migration at trigger time — rejected (yanks players mid-cube); plan-only-at-completion — rejected (no recalc on disconnect) |
| D-6 | Ring layout: slot angle 2π·(s−1)/X, radius X·24/(2π), stable slots | Occupancy by construction (no collision checks), deterministic + testable, reuses the 24-unit spacing language, stable positions for existing members | Grid layout — needs sizing for X; random placement — needs occupancy checks (the rejected complexity) |
| D-7 | Own-cube play optimistic; server authority validates + broadcasts incl. origin (ack); `stateSync` correction | Preserves the accepted instant-click feel (no waiting for the ack) while keeping every shared value authoritative; conflicts are rare (only stale clients) and cheap to correct | Fully authoritative (wait for ack) — adds visible click latency, weakens accepted behavior; LWW — violates the server-authority principle outright |
| D-8 | Server draws N per level; style from the accepted cycle; engine's offline draws retained for tests | The server must know the board to validate; keeps the accepted visual variety; the cube-world-transition "future online hook" seam is used as documented | Client-drawn N accepted on trust — rejected (server can't validate completion) |
| D-9 | Spectate = client-local view-only mode; destination always server-assigned | Camera/spectate state affects no shared value → no protocol round-trips; view-only avoids per-cube permission complexity | Server-tracked spectators — rejected (state with no authority value); interactive spectating — rejected (Q-7, scope) |
| D-10 | Online travel holds at progress 0 until next-cube data arrives; midpoint advance once | Latency never desyncs state; the transition start shifts, not its shape; the accepted travel animation is reused verbatim for destination-driven flights | Buffer-free advance with local N — rejected (breaks authority); re-request loop — unnecessary |
| D-11 | Node 24 global `WebSocket` client + fake `Peer` sockets for all backend integration tests; no new deps | Zero-dependency honest integration (real socket upgrade on an ephemeral port) + deterministic fake-peer unit coverage | `ws` client for tests — rejected (new dep); `injectWS` — rejected (extra coupling to light-my-request internals) |
| D-12 | Extended smoke: X = 2 via compose override, grace 1 s for the memberLeft check | The containerized e2e exercises the full protocol (overflow, broadcast, leave) within the smoke budget; overrides are smoke-only | Keep smoke minimal — rejected (the feature's core claims deserve e2e evidence) |

## Risks & mitigations

- **Existing test suite breaks from fixture drift** → all engine/scene/session changes are additive with unchanged offline defaults; existing tests pass unmodified except the ledgered fixture re-pins (AC-24); per-task workspace-scoped coverage catches a dip early; the supersession ledger bounds what may change.
- **Coverage drop in the backend** (previously trivial 100%) → every backend module lands with its tests in the same task (unit + hub integration); workspace-scoped pre-gate per task; no carve-outs (report `blocked` if a metric can't honestly clear 80).
- **Timing flakiness in grace/heartbeat/rate-limit tests** → all timing injectable (fake timers + injected clock); boundary assertions at exactly the pinned durations.
- **Cross-task collision on shared files** (`scene.ts`, `session.ts`, `engine.ts`, `app.ts`) → each shared file is owned by exactly one task; dependents consume the pinned interfaces, not edits.
- **Broadcast amplification / abuse** → X ≤ 24 cap, 30/s rate limit with at-most-1/s error feedback, 1024 B message cap, 200-connection cap, heartbeat cleanup of dead peers (security § of the spec).
- **Grace-ghost confusion (member listed but dead ≤ 30 s)** → pinned as intended behavior (their cube stays frozen); `memberLeft` on expiry is the single source of truth for the panel.
- **Latency on the level advance** (travel holds until `worldEntered`) → the hold is progress-0 (camera at rest over the finished cube), so the wait reads as a beat after the face fade, not a frozen mid-flight; on the LAN it is ~ms.
- **Move-plan staleness between evaluations** → execution re-validates (target must exist + have capacity, else stay); plan recomputes on every membership change (join/close/expiry/resume).
- **World-swap mid-travel rendering leaks** → midpoint swap disposes the old WorldView exactly once (asserted); drawable bounds re-pinned (≤ X·7 meshes).
- **Smoke flakiness under podman** → existing poll/readiness discipline retained; new checks reuse the same PASS/FAIL pattern; grace set to 1 s so the leave check runs in-budget.

## Dependency requests

**None.** The feature needs no new packages: backend WS server comes from the existing `@fastify/websocket` (its `ws` transport handles ping/pong natively); backend integration tests use Node 24's built-in global `WebSocket` client against an ephemeral-port listener plus fake `Peer` sockets for the hub; frontend uses the native `WebSocket` already wrapped by `ws/connection.ts`; rendering reuses the accepted `three` (0.186.1); tests reuse Vitest. If the builder finds an integration seam that genuinely requires a package (e.g., `ws` as an explicit client dev-dep), that is a ⚠️ Ask-first checkpoint — stop and escalate; do not install.

## Open questions

Mirrors spec § Open questions (Q-1…Q-10): capacity X (10, analysis above); display names (auto, Q-2); token persistence (in-memory, Q-3); grace length (30 s, Q-4); empty-server destruction + id reuse (immediate / never, Q-5/Q-6); spectate view controls (view-only, Q-7); remote cube detail (full, Q-8); logical vs process servers (logical, Q-9); identity-vs-no-accounts tension (flagged, Q-10). Recommended defaults are pinned in the artifacts; none blocks building.

## Revision history

- r1 — 2026-10-21 — initial draft (planning phase).
