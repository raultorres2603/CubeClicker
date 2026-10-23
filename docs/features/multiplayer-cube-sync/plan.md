---
feature: multiplayer-cube-sync
revision: 2
---

# Plan — Multiplayer Cube Actions & Full Spectating

## Architecture

```
client (owner) ──rotate──► server (relay+clamp+store) ──cubeRotated──► other clients
                                     │
                                     └── welcome/worldEntered/memberJoined/stateSync carry orientation
```

- **Backend** (`src/backend/src/game`): `protocol.ts` gains orientation fields on the wire `CubeState`/`MemberState`, `rotate` (client) and `cubeRotated` (server), plus orientation on `CubeSync`; `hub.ts` carries `yawSteps`/`pitchSteps` on `Member`, initialises them on join, updates+clamps on `rotate`, resets on completion, projects them onto wire states, broadcasts `cubeRotated`, and applies the 20/s trailing rate limit. `cubes.ts` is unchanged (board-only `CubeState`); `servers.ts` is unchanged.
- **Frontend** (`src/frontend/src/multiplayer`, `render`, `game`): protocol mirror; reducer stores orientation and applies `cubeRotated` (defensive self update); `WorldView` animates remote cube groups and handles `cubeRotated` in `applyMessage`; `session.ts` sends throttled `rotate` on orientation change, adopts server orientation on welcome/stateSync, and clears spectate state on every `welcome`/`resume_failed`; `engine.adoptCubeState` adopts orientation.
- **No new service/port/dependency.** Container assets untouched.

## Interfaces / contracts

### Protocol (additive)

```ts
// backend + frontend (wire)
interface CubeState { levelIndex; gridSize; styleId; removedIds; yawSteps: number; pitchSteps: number; }
interface MemberState { /* ... */ yawSteps: number; pitchSteps: number; }
// client -> server
{ type: 'rotate'; yawSteps: number; pitchSteps: number }
// server -> client
{ type: 'cubeRotated'; playerId: string; yawSteps: number; pitchSteps: number }
// stateSync (CubeSync) also gains yawSteps + pitchSteps
```

**Codec rule (r2).** Server-originated orientation fields (`CubeState`, `MemberState`, `cubeRotated`, `stateSync`) are validated for type + range: non-integer or out-of-range → `bad_message`. The client-originated `rotate` is validated for integer type only; non-integer → `bad_message`, out-of-range integers are accepted by the codec and clamped server-side (AC-4). Range: `yawSteps` 0..3, `pitchSteps` -1..1.

### Backend hub handling

```
on 'rotate' (joined member):
  (already joined; else not_joined)
  if rotateRateLimit(member) rejects: drop silently (no state change, no broadcast, no reply)
  else:
    yawSteps = ((yawSteps % 4) + 4) % 4
    pitchSteps = max(-1, min(1, pitchSteps))
    member.yawSteps = yawSteps; member.pitchSteps = pitchSteps
    broadcast cubeRotated(playerId, yawSteps, pitchSteps) to others
```

Order of checks for any incoming frame (r2): **size (`MAX_MESSAGE_BYTES`) → codec type/shape (`parseClientMessage`) → join/rejoin duplicate guard → joined check (`not_joined`) → per-message rate limit (rotate 20/s silent drop; explode 30/s with at-most-once `rate_limited`) → semantic validation/clamping/broadcast.** The rate check precedes the store update for `rotate`.

Rate limit: trailing 1000 ms window, max 20 `rotate` per member, dropped silently (no broadcast, no reply). The 30/s explode limit remains separate (with at-most-once-per-second `rate_limited`).

Backend storage (r2): `Member` carries `yawSteps`/`pitchSteps`; `handleJoin` initialises `(0, 0)`; `handleCompletion` resets them to `(0, 0)` alongside `member.cube = next`; `cubeState()`/`memberState()` project them onto the wire. `createNextCube` (board-only) is unchanged.

### Frontend reducer

- `reduceWorldState`: handle `cubeRotated` → update the matching member's (or, defensively, `self`'s) `yawSteps`/`pitchSteps`. Self update is defensive only; the engine does not adopt orientation from `cubeRotated`.
- `welcome`/`worldEntered`/`memberJoined`: carry orientation via `MemberState`/`CubeState`.
- `levelAdvanced`: resets orientation to `(0, 0)` for that member (already rebuilds).
- `stateSync`: carries orientation; `withSync` adopts it into `self`/member cube state.

### World view rotation animator

Per `MemberCube` (r2, extended):

```
orientation: { yawSteps, pitchSteps }   // settled target
rotationFrom: { yawSteps, pitchSteps } | null
rotationElapsedMs: number
rotationDurationMs: number  // timingsFor(false).rotationMs (300 ms)
```

On upsert with differing orientation: set `rotationFrom = currentSettled`, `rotationElapsedMs = 0`, `orientation = next`. On upsert with identical orientation: no-op (no restart). On rebuild (level advance): orientation `(0,0)`, `rotationFrom = null`.

In `update(dt)`: if `rotationFrom !== null`, advance elapsed; compute `t = min(1, elapsed/duration)` (linear, matching the engine's `rotationProgress`); set `view.group.rotation` via `interpolateRotation(rotationFrom, orientation, t)`. When `t` reaches 1, set `rotationFrom = null`.

`WorldView.applyMessage` handles `cubeRotated`: update the matching member's orientation and start the animator; no-op for unknown members. `miniCubeRemoved`, `levelAdvanced`, `memberJoined`, `memberLeft` retained.

Need import `interpolateRotation` from `../game/rotation` and `timingsFor` (already imported). Duration = `timingsFor(false).rotationMs`.

### Session send-on-change + throttle

```
lastBroadcastOrientation: { yawSteps, pitchSteps } | null
lastSendMs: number
pendingOrientation: { yawSteps, pitchSteps } | null
timer: number | null

on orientation change (after dispatch/advance):
  if !online || !canRun: return
  if orientation === lastBroadcast: return
  if now - lastSendMs >= 50:
     send rotate(orientation); lastBroadcast = orientation; lastSendMs = now; clear pending
  else:
     pending = orientation; if timer null: timer = setTimeout(flush, 50 - (now-lastSendMs))
flush(): send rotate(pending); ...
```

Adopt on welcome/stateSync: extend `AuthoritativeCubeState` with `yawSteps`/`pitchSteps`; engine adopts (settled, no animation, `rotationFrom = null`). Session maps `cube.yawSteps`/`pitchSteps`.

Spectate reset (r2): on **every** `welcome` (regardless of identity) and on `resume_failed`, clear spectate state (`setSpectating(false)`), cancel any camera travel (`cancelTravel()`), and reset the view to the own cube instantly. This folds predecessor residual N1 into this feature.

### Engine adoption

`AuthoritativeCubeState` gains `yawSteps` + `pitchSteps`. `adoptCubeState` adopts them as the settled orientation (`orientation = { yawSteps, pitchSteps }`, `rotationFrom = null`, `rotationElapsedMs = 0`, `queuedStep = null`) for both same-cube corrections and different-level rebuilds, in addition to the existing board rebuild. Stats are never rolled back.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/backend/src/game/protocol.ts` | Edit | Add orientation fields to wire `CubeState`/`MemberState`/`CubeSync`, `rotate`, `cubeRotated` |
| `src/backend/src/game/protocol.test.ts` | Edit | Codec matrix additions |
| `src/backend/src/game/hub.ts` | Edit | Member orientation storage, join init, completion reset, projection, rotate handling, clamp, broadcast, rate limit |
| `src/backend/src/game/hub.test.ts` | Edit | Rotate tests |
| `src/backend/src/game/app.test.ts` | Edit | Live socket rotate check (optional) |
| `src/frontend/src/multiplayer/protocol.ts` | Edit | Mirror protocol changes |
| `src/frontend/src/multiplayer/protocol.test.ts` | Edit | Parity tests |
| `src/frontend/src/multiplayer/server-state.ts` | Edit | Store orientation, reduce `cubeRotated`, `stateSync` adoption, copy |
| `src/frontend/src/multiplayer/server-state.test.ts` | Edit | New tests |
| `src/frontend/src/render/world.ts` | Edit | Remote rotation animator, `applyMessage` `cubeRotated`, upsert |
| `src/frontend/src/render/world.test.ts` | Edit | Rotation tests |
| `src/frontend/src/game/engine.ts` | Edit | Extend `AuthoritativeCubeState` + `adoptCubeState` orientation |
| `src/frontend/src/game/engine.test.ts` | Edit | Adoption orientation tests |
| `src/frontend/src/game/session.ts` | Edit | Send-on-change throttle, adopt orientation, spectate reset |
| `src/frontend/src/game/session.test.ts` | Edit | New tests |

No container files touched. `servers.ts`, `cubes.ts` unchanged (board-only orientation lives on `Member`).

## Key decisions

| # | Decision | Rationale | Alternatives |
| --- | --- | --- | --- |
| 1 | Server-relay with clamping + latest-wins (member's own orientation only) | Manual input is client-only; server shouldn't generate orientation | Server-authoritative (rejected: needs keypress forwarding) |
| 2 | Absolute orientation on wire | Self-healing, trivial convergence | Deltas |
| 3 | Orientation in `CubeState`/`MemberState` (wire) | Initial sync for new joiners | Separate initial message |
| 4 | Remote animation in `world.ts` (render layer) | Follows broadcasts; no game rules in render | Duplicate engine in world |
| 5 | Separate 20/s rate limit for `rotate` | Orientation spam bound independent of clicks | Reuse 30/s |
| 6 | No culling | Bounded by X ≤ 24 | Distance culling (future) |
| 7 | Linear interpolation (no easing) for remote rotation | Matches the engine's `rotationProgress` | Eased curve (would desync t expectations) |
| 8 | `Member`-level storage, not board `CubeState` | Board state and orientation are distinct concerns | Put orientation in `cubes.ts` (rejected: conflates board) |

## Risks & mitigations

- **Protocol churn across two workspaces:** parity tests must be updated in lockstep; run the parity script.
- **Remote animation timing skew:** receivers animate over their own `rotationMs` (300 ms); acceptable.
- **Coalescing manual + auto rotations:** client sends final orientation after a frame; fast auto-rotation chains may coalesce intermediate steps, but final orientation is correct (latest-wins). Mitigation: send immediately on change when ≥ 50 ms since last send; trailing send ensures final state. Coalescing (50 ms) and the face fade (400 ms) are independent layers.
- **Adoption on resume:** orientation adoption must not trigger a rebuild or animation; adopt as settled.
- **Bandwidth:** throttle bounds outbound rotation traffic (≈ 20 sends/s/member).
- **Predecessor residual backlog:** spectate-reset-on-reconnect folded into T7; faceCleared replay coverage stays in inherited `world.test.ts`.

## Open questions

See spec.md § Open questions (Q-10 only remains open; Q-1..Q-9 resolved in r2).

## Revision history

- r1 — 2026-10-23 — initial draft (planning phase).
- r2 — 2026-10-23 — resolves spec review round 1 (F1–F16); see spec.md § Revision history.