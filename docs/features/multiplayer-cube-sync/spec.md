---
feature: multiplayer-cube-sync
revision: 2
status: draft
created: 2026-10-23
updated: 2026-10-23
---

# Spec — Multiplayer Cube Actions & Full Spectating (orientation sync)

## Summary

Follow-up to the accepted `multiplayer-servers` feature. Today remote cube views mirror mini-cube pops, derived face clears and level advances, but **not** the owner's cube orientation: a spectator or a nearby viewer never sees another player's cube turn (manual W/A/S/D or arrows, or the auto-rotation that follows a cleared face). This feature adds **orientation sync** — the server relays each member's settled cube orientation to the other members of the same server — and makes remote views animate toward the reported orientation, so spectating and viewing show the cube turning exactly as the owner sees it. It also pins that a completed cube is **replaced in place** (same-server) or **moved to its new slot** (cross-server) exactly as already defined by `multiplayer-servers` AC-12/AC-13, with orientation reset to identity, so the behaviour holds across a level advance. No new service, port, dependency or persistence is introduced; the WebSocket protocol gains additive fields and one new message in each direction.

Revision 2 resolves the round-1 spec review (`reviews/spec-r1.md`, F1–F16): codec rule vs. server clamping (F1), rate-limit order (F2), latest-wins scope (F3), rotation duration 300 ms (F4), inherited-suite wording (F5), `cubeRotated` in `applyMessage` (F6), backend orientation storage (F7), self-adopt (F8), reconnect/spectate reset (F9), coalescing vs. face fade (F10), culling wording (F11/F12), `stateSync` orientation (F13), smoke-test scope (F14), dependency confirmation (F15), and predecessor backlog overlap (F16).

## Supersessions of accepted behaviors

Everything in `multiplayer-servers` (and its predecessors) stays in force **except** the following additive protocol extensions (the ledger rule: predecessor specs are never edited):

| Superseded | Behavior replaced | Replaced by (this spec) | Retained |
| --- | --- | --- | --- |
| `multiplayer-servers` § 8 `CubeState` / `MemberState` | Carry `levelIndex, gridSize, styleId, removedIds` only | Both now also carry `yawSteps` (0..3) and `pitchSteps` (-1..1) — the owner's settled orientation (AC-2). | All existing fields, shapes, validation |
| `multiplayer-servers` § 8 client catalog | `join, rejoin, explode, cubeCompleted` | Adds `rotate { yawSteps, pitchSteps }` (AC-3) | Existing messages unchanged |
| `multiplayer-servers` § 8 server catalog | `miniCubeRemoved, levelAdvanced, …` | Adds `cubeRotated { playerId, yawSteps, pitchSteps }` (AC-4/AC-5) | Existing messages unchanged |
| `multiplayer-servers` § 8 `stateSync` | Carries board fields only | Also carries `yawSteps` + `pitchSteps` (AC-13) | Existing fields |
| `multiplayer-servers` AC-13 (remote cubes) | Remote views are static orientation | Remote views now apply and animate orientation from broadcasts (AC-7); drawable bound unchanged | Pop/burst, face clear, level rebuild, picking isolation |
| `multiplayer-servers` AC-14 (board adoption) | `AuthoritativeCubeState` carries level/grid/style/removedIds | Also carries `yawSteps` + `pitchSteps`; `adoptCubeState` adopts the orientation (AC-8, AC-13) | Board adoption, stats never rolled back |

Nothing else is superseded; all 27 `multiplayer-servers` ACs remain met.

## User stories

- As a spectator, I want to see the cube I am watching turn when its owner turns it, so spectating feels like watching a real player.
- As a player in a server, I want to see nearby members' cubes turn when they turn them, so the world feels alive even without spectating.
- As a player, I want a completed cube to be replaced on the map by the next one, so progress stays visible to everyone.

## Acceptance criteria

Verification notes: "backend" = `src/backend`, "frontend" = `src/frontend`. Evidence per AC: a test file asserting concrete values, or a command/transcript. All tests use concrete expected values.

### Baseline / delta

- **AC-1 — Baseline preserved.** All existing `multiplayer-servers` broadcasts (`miniCubeRemoved`, `levelAdvanced`, `memberJoined`, `memberLeft`, `stateSync`, `worldEntered`) keep their pinned shapes and semantics; the inherited test suites pass after the mechanical addition of the new orientation fields, with no behavioral regression, no assertion weakening and no test deletion. Allowed touch-up: existing fixtures that build a `CubeState`/`MemberState`/`AuthoritativeCubeState` add `yawSteps: 0, pitchSteps: 0` (or the reported values) and nothing else. Evidence: `npm test` green on the inherited suites — backend `protocol.test.ts`, `servers.test.ts`, `cubes.test.ts`, `hub.test.ts`, `app.test.ts`; frontend `protocol.test.ts`, `server-state.test.ts`, `world.test.ts`, `scene.test.ts`, `session.test.ts`, `engine.test.ts` — with the field additions recorded in the build log.

### Protocol (orientation on the wire)

- **AC-2 — Orientation travels with cube state.** `CubeState` and `MemberState` (backend `src/backend/src/game/protocol.ts` and frontend mirror `src/frontend/src/multiplayer/protocol.ts`) gain `yawSteps: number` and `pitchSteps: number`. Valid ranges: `yawSteps` integer `0..3`, `pitchSteps` integer `-1..1`. For every server-originated message carrying these fields (`welcome`, `worldEntered`, `memberJoined`, `stateSync`, `cubeRotated`) a non-integer or out-of-range value decodes to `bad_message`. Evidence: `protocol.test.ts` (both workspaces) codec matrix with concrete payloads — valid `(0,0)`, `(3,1)`, `(2,-1)`; invalid `1.5`, `4`, `-1` for yaw, `2`, `-2` for pitch.

- **AC-3 — Client → server `rotate`.** The client catalog gains `rotate { yawSteps, pitchSteps }`. `encodeClientMessage`/`parseClientMessage` round-trip it. The codec validates integer type only: a non-integer decodes to `bad_message`; an out-of-range integer is accepted by the codec and clamped server-side (AC-4). Evidence: protocol parity tests — `{ yawSteps: 1.5, pitchSteps: 0 }` → `bad_message`; `{ yawSteps: 5, pitchSteps: 0 }` → accepted (clamped to 1).

- **AC-4 — Server handles `rotate`.** A `rotate` from a joined member: the server clamps `yawSteps` into `0..3` via `((n % 4) + 4) % 4` and `pitchSteps` into `-1..1` via `Math.max(-1, Math.min(1, n))`, updates that member's stored orientation, and broadcasts `cubeRotated { playerId, yawSteps, pitchSteps }` (clamped values) to **all other members** of the server (not the sender). A `rotate` from a non-joined connection → `error not_joined`. Evidence: `hub.test.ts` with concrete clamping cases (`5→1`, `-1→3`, `pitch 5→1`, `-5→-1`) and concrete member sets.

- **AC-5 — `cubeRotated` broadcast.** The server catalog gains `cubeRotated { playerId, yawSteps, pitchSteps }`; the frontend codec decodes it (range-validated, AC-2); `reduceWorldState` applies it to the matching member's orientation. For `playerId === self.playerId` the reducer updates `self.cube.yawSteps`/`pitchSteps` defensively only; the engine does **not** adopt orientation from `cubeRotated` (own orientation is authoritative locally and is corrected via `welcome`/`stateSync`, AC-13). `WorldView.applyMessage` handles `cubeRotated` by updating the matching member's orientation and starting the animator (no-op for unknown members). Evidence: `protocol.test.ts`, `server-state.test.ts`, `world.test.ts`.

- **AC-6 — Rate limit.** The server processes at most `20` `rotate` messages per trailing 1000 ms per member; additional messages in that window are dropped **before** clamp/update/broadcast — no state change, no broadcast, no reply. Evidence: `hub.test.ts` with fake timers, boundary at 20/21 within 1000 ms and reset after 1000 ms.

- **AC-7 — Remote cubes rotate.** A `cubeRotated` broadcast (or a roster snapshot / `memberJoined` carrying a non-zero orientation) makes the matching remote `CubeView`'s group rotate to the reported orientation with a smooth (linear) animation: yaw shortest path, pitch linear, over `timingsFor(false).rotationMs` (default profile: 300 ms), settling exactly on the reported quarter-turns. A repeated identical orientation is a no-op (no animation restart). Evidence: `world.test.ts`, concrete group rotation at t = 0 / 150 / 300 ms and the settled matrix.

### Spectating & vision range (no culling)

- **AC-8 — Initial orientation sync.** `welcome`, `worldEntered` and `memberJoined` carry the orientation of every member; the frontend reducer stores it; `WorldView.applyRoster` / `upsert` apply it to new and existing views (new members at their reported orientation without animation; existing members animate only if it differs). Evidence: `server-state.test.ts`, `world.test.ts`.

- **AC-9 — Level advance resets orientation.** On `levelAdvanced` for a member, that member's orientation becomes `(0, 0)` and the remote view rebuilds (identity rotation); the backend member's stored orientation is reset to `(0, 0)` alongside the new cube. Evidence: `world.test.ts`, `hub.test.ts`.

- **AC-10 — Full spectating.** While spectating a member, the spectator's view of that member's cube (the world view) rotates according to the target's `cubeRotated` broadcasts and otherwise behaves as the owner sees it (pops, face clears, advances). The spectator camera stays over the target's cube and keeps its identity quaternion (no camera rotation). Evidence: `session.test.ts`, `scene.test.ts`.

- **AC-11 — No vision-range culling.** A non-spectating viewer renders every member of their server (≤ X, X ≤ 24), including their rotations; no distance or frustum culling is added. Evidence: `world.test.ts` (all members rendered) + the documented bound X ≤ 24.

- **AC-12 — Completion across a level advance.** A member completing their cube triggers the accepted in-place rebuild (same server) or slot move (cross server) per `multiplayer-servers` AC-12/AC-13; the member's orientation resets to `(0, 0)`; remote views follow via `levelAdvanced` and stay rendered. Spectators of a member who completes on the **same** server stay and see the rebuild; spectators of a member who **moves** servers auto-return (per `multiplayer-servers` AC-19 b). On every `welcome` (including a fresh-identity reconnect) and on `resume_failed` the spectate state is cleared and the view resets to the own cube instantly. Evidence: `session.test.ts`, `world.test.ts`.

### Own-cube authority

- **AC-13 — Own cube adopts server orientation.** `welcome.self` and `stateSync` carry orientation; `AuthoritativeCubeState` gains `yawSteps` + `pitchSteps`; `engine.adoptCubeState` adopts them (settled, no animation, `rotationFrom = null`) for both same-cube corrections and different-level rebuilds; stats are never rolled back. Evidence: `engine.test.ts`, `session.test.ts`.

### Real-time contract

- **AC-14 — Reconnection convergence.** On resume within grace, `welcome` carries the member's own orientation and the roster's orientations; the client adopts the own orientation via `adoptCubeState` and the remote views adopt via the reducer; the view resets to the own cube instantly and spectate state is cleared. Evidence: `session.test.ts`.

- **AC-15 — Loss tolerance.** A dropped `cubeRotated` packet leaves the receiver's view at its previous orientation; the next accepted `cubeRotated` or the next `welcome`/`memberJoined` converges it. No client or server error is raised for a missing packet. Evidence: required test in `world.test.ts` asserting the remote view's group rotation matrix is unchanged after a dropped packet and converges after the next accepted `cubeRotated`.

### Containers

- **AC-16 — No containerization impact.** No new service, image, port, env var, health signal, Dockerfile or compose change; `podman compose up` and `npm run smoke` unchanged. Evidence: `git diff` on container paths empty.

### Testing / coverage

- **AC-17 — Coverage gate.** `npm run coverage` ≥ 80% (statements, branches, functions, lines) in both workspaces; no exclusions added, no thresholds lowered. Evidence: coverage transcripts.

## Non-goals

- No new message for travel or for camera state (camera/spectate state stays client-local by design, per `multiplayer-servers` § 6).
- No server-side validation of orientation beyond range clamping and the integer type check; the server does not reject a `rotate` for semantic reasons.
- No distance/frustum culling, LOD, or placeholder cubes (bounded by X ≤ 24).
- No spectate-view rotation (the spectator's camera quaternion stays identity; only the cube rotates).
- No new dependencies, no persistence, no accounts, no chat/voice.
- No changes to `main.tsx`, `index.html`, backend `server.ts`, Dockerfiles, compose files, README.
- No extension of `tests/e2e/smoke.mjs` (F14); smoke stays focused on join/overflow/explode/leave.

## Boundaries

- ✅ Always: keep `game/**` and `multiplayer/**` pure and DOM-free; tests with concrete expected values beside every behavior change; run lint, typecheck, tests, coverage before reporting done; record evidence in build logs; stage only `files_owned` per task; server relays orientation (clients never trusted for shared values, but orientation is client-reported intent, clamped + latest-wins for that member's own cube only).
- ⚠️ Ask first: any new dependency (none needed); any pinned-constant deviation (rate limit 20/s, throttle 50 ms, rotationMs 300 ms); touching a file outside a task's `files_owned` (especially `compose.yaml`/`compose.smoke.yaml`/`smoke.mjs`); any coverage exclusion or threshold change.
- 🚫 Never: weaken assertions; touch `.env*` or commit secrets; edit predecessor specs/plans/tasks; change pinned constants or ACs unilaterally; apply last-write-wins to contested shared state (latest-wins is permitted only for a single member's own orientation); push.

## Security considerations

- **User-controlled data:** orientation values are client-reported and clamped server-side to valid ranges; non-integers are rejected at the codec; no free text. Message size cap (`MAX_MESSAGE_BYTES` 1024) and connection cap (`MAX_CONNECTIONS` 200) unchanged.
- **Abuse bounds:** per-member `rotate` rate limit (20/s, trailing window, dropped silently) prevents orientation spam; fan-out bounded by X ≤ 24 and server-scoped. The 50 ms client throttle bounds outbound rotation traffic (≈ 20 sends/s/member; at X = 10 ≈ 200/s total).
- **No secrets/persistence:** unchanged from predecessor.

## Testing strategy

- **Backend unit (Vitest, node):** `protocol.test.ts` (codec matrix: `rotate` + `cubeRotated` valid/invalid; orientation fields in `CubeState`/`MemberState`; `CubeSync` orientation); `hub.test.ts` (rotate handling, clamping, broadcast member sets, rate limit with fake timers, Member orientation init/reset); `cubes.test.ts` (orientation default irrelevant — board-only; no change).
- **Backend integration:** `app.test.ts` (live socket: hello-first, rotate → `cubeRotated` on the other socket, rate-limit boundary).
- **Frontend unit (Vitest, node):** `multiplayer/protocol.test.ts` (parity with backend), `server-state.test.ts` (reduce `cubeRotated`, orientation in welcome/memberJoined/stateSync, referential stability), `engine.test.ts` (`adoptCubeState` orientation adoption).
- **Frontend integration (node, real three.js):** `world.test.ts` (remote rotation animation, initial orientation, level-advance reset, no-op on identical, dropped-packet loss tolerance), `scene.test.ts` (spectate + rotation), `session.test.ts` (send-on-change + throttle, resume convergence, spectate reset).
- **E2E / container:** `npm run smoke` unchanged (no new checks; protocol additions are additive).
- **Coverage:** `npm run coverage` — thresholds ≥ 80% per workspace; pre-gates per task workspace-scoped.
- **Assertion bar:** concrete expected values (ids, slot positions, orientation quarter-turns, rotation matrices at pinned times); no banned wildcard matchers; no snapshot-only or assertion-free tests.

## Open questions

- **Q-10 — Identity vs "no accounts" (carried from predecessor).** Ephemeral identities resolve presence/attribution, but future features needing stable identity (leaderboards, reputation, friends) are impossible without a new decision. Recommended: revisit when such a feature is requested. Options: keep ephemeral (current) vs. add accounts (new spec, new stack amendment). Not resolved here.

All other predecessor open questions (Q-1..Q-9 in the predecessor; this feature's Q-1..Q-9) are **resolved** in r2:

| # | Decision (r2) |
| --- | --- |
| Q-1 rotate rate limit | 20/s, trailing 1000 ms, constant (not env) |
| Q-2 client throttle | 50 ms coalescing with trailing send of latest orientation |
| Q-3 remote rotation duration | `timingsFor(false).rotationMs` = 300 ms for all receivers (independent of receiver motion preference) |
| Q-4 send absolute vs delta | absolute settled orientation |
| Q-5 server authority vs relay | server-relay with clamping + latest-wins for a member's own orientation only |
| Q-6 remote auto-rotate locally | no — follow broadcasts only |
| Q-7 vision-range culling | none — every server member rendered (X ≤ 24) |
| Q-8 orientation in `stateSync` | yes |
| Q-9 smoke test extension | not required; no `smoke.mjs` change |

## Assumptions

- Orientation is the engine's settled target (`orientation`), not the in-flight animation (`rotationFrom`/`rotationProgress`); broadcasting in-flight progress would multiply traffic and is unnecessary because receivers animate locally.
- A `rotate` message reports the *new* settled orientation after a step; the client sends it once per settled change, throttled.
- `levelAdvanced` implies orientation `(0, 0)` (the engine resets on advance); the server stores `(0, 0)` and the broadcast's absence of an orientation field is covered by the field being present with zeros on `CubeState`/`MemberState` in welcome/memberJoined.
- `timingsFor(false).rotationMs` is the remote animation duration (300 ms default profile); reduced-motion on the *receiver* is not applied to remote views (predecessor decision: remote rendering is independent of a spectator's motion preference).
- The stack is decided and unchanged; no dependency additions.
- Backend orientation is stored on `Member` (`yawSteps`/`pitchSteps`), not in `cubes.ts`'s board `CubeState`; `createNextCube` remains board-only and `handleCompletion` resets the member's orientation to `(0,0)` alongside the new cube. The wire `protocol.ts` `CubeState`/`MemberState` carry orientation; the internal board type does not.
- The server does not track sequence numbers for `cubeRotated`: WebSocket preserves per-connection order and the server forwards in arrival order, so the last applied message wins; a dropped packet leaves the previous orientation and the next message converges it (AC-15).
- Latest-wins applies only to a single member's own orientation (single writer); it is never used for contested shared state.
- Coalescing (50 ms client throttle) and the face fade (400 ms) are independent: the throttle bounds network sends, the fade bounds the visual removal of a cleared face. Neither "wins" over the other; they govern different layers.
- The predecessor residual N1 (spectate reset on reconnect) is folded into T7/T8 of this feature; N2 (faceCleared replay coverage) remains covered by the inherited `world.test.ts` suite without new requirements.

## Revision history

- r1 — 2026-10-23 — initial draft (planning phase).
- r2 — 2026-10-23 — resolves spec review round 1 (F1–F16): codec rule vs. clamp, rate-limit order, latest-wins scope, 300 ms duration, inherited-suite wording, `cubeRotated` in `applyMessage`, backend storage, self-adopt, reconnect/spectate reset, coalescing vs. face fade, culling wording, `stateSync` orientation, smoke scope, dependency confirmation, backlog overlap. No AC added or removed; AC-1/AC-2/AC-3/AC-4/AC-5/AC-7/AC-9/AC-11/AC-12/AC-13/AC-15 wording updated.