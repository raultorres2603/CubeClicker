# Build log — T17b — Corrective: authoritative cube adoption, held-travel release, pre-welcome UI gating

Task: T17b (2026-10-22)
Files changed: `src/frontend/src/game/engine.ts`, `src/frontend/src/game/engine.test.ts`, `src/frontend/src/game/session.ts`, `src/frontend/src/game/session.test.ts`, `src/frontend/src/App.tsx`, `src/frontend/src/App.test.tsx`, `src/frontend/src/ui/UserPanel.tsx`, `src/frontend/src/ui/UserPanel.test.tsx`, `docs/features/multiplayer-servers/build-log-T17b.md`
What changed & why: closed review-r1 findings **F1** (stateSync/welcome reconciliation was remove-only and ignored different-level boards), **F2** (a resume inside the `cubeCompleted` → `levelAdvanced` window stranded the engine in the non-cancellable `nextLevel` hold) and **F7** (`Users on Server`/blank own row/`Server 0` rendered before `welcome`). The engine gained an `adoptCubeState` seam that replaces the own board exactly in both directions and releases superseded travel; the session routes `welcome`/`stateSync` through it; the shell and panel gate on a welcomed server identity.

Decisions:
- **Seam shape.** `adoptCubeState(cube: AuthoritativeCubeState)` with `{ levelIndex, gridSize, style, removedIds }` (the resolved `CubeStyle`, because the scene needs the full style object and the session already owns `resolveStyle`). Optional on the base `GameEngine` and required on `OnlineGameEngine`, mirroring the existing `completeNextLevel`/`cancelTravel` compatibility pattern; the session calls it only when defined so pre-online fakes keep the removal-only fallback.
- **Rebuild vs removal-only.** The engine rebuilds the board and queues one `levelChanged` when the level, grid or style differs **or** when the authority still has a tile the local board removed (the scene has no "show tile again" seam). Otherwise it walks the authoritative `removedIds` and applies them through the same accepted-reconcile accounting (removal + click/face counters) with one intent each.
- **Stats (AC-14).** Session-local stats are never rolled back. Authority removals count as accepted removals only on the *same* level and grid (the previous reconcile contract, kept by the existing resume tests). A different level/grid is a different cube: its removal set says nothing about clicks this client made, so no click/face accounting is applied there.
- **Deferred removal replay (deviation, § 6.2).** A rebuilt scene cube is fully visible by construction (`scene.ts` rebuilds from the snapshot), so the adoption replays its authoritative removals as burst-free `explosion` intents one frame after the rebuild drains the `levelChanged` intent. The replay uses `{ particles: [], lifetimeMs: currentTimings().explosionMs }`; empty faces additionally emit `faceCleared`.
- **Held-travel release (F2).** Any adoption releases a running face fade, a held `nextLevel` travel, or a stale `pendingNextLevel`: phase returns to `playing`, every travel field is cleared, no `travelStarted` is queued. Camera-only flights are still owned by `cancelTravel` on the same-identity resume path; an adoption is the backstop for every other state.
- **Different level resets the view.** Adopting a different `levelIndex` resets orientation and clears the rotation/queued step, exactly like `advanceLevel`; a same-level reconcile keeps the player's current orientation.
- **Pre-welcome signal (F7).** `world.serverId > 0` is the welcomed signal (server ids start at 1). `Hud.tsx` is outside this task's `files_owned`, so `App` renders the same three stats lines in a stats-only `<section aria-label="Game statistics">` pre-welcome, without the `Server` line. `UserPanel` takes a required `welcomed` prop and returns `null` before it.
- No dependency, config, threshold, exclusion or shared-state change.

---

## 1. Finding → fix mapping

| Review finding | Task item | Fix | Evidence |
| --- | --- | --- | --- |
| **F1 (BLOCKER)** — `stateSync`/welcome reconciliation is remove-only; a rejected optimistic click leaves a tile permanently missing and a different level/grid is ignored | T17b F1 | Engine `adoptCubeState` rebuilds the exact board (restore + remove), adopts level/grid/style; `session.reconcileCube` hands `welcome.self`/`stateSync` over as-is | 7 engine tests (§ 3.1), 5 session tests (§ 3.2), rewritten fake-engine expectation (§ 3.3) |
| **F2 (BLOCKER)** — a resume after `cubeCompleted` before `levelAdvanced` leaves the engine in the non-cancellable `nextLevel` hold forever | T17b F2 | Adoption releases the held travel/face fade and the session's welcome adoption replaces the cube; no second `travelStarted`, phase `playing` | Engine tests 5–6, session test "releases the held nextLevel travel when a resume welcome answers the completion (F2)" |
| **F7 (MINOR)** — `Users on Server` button, blank own row and `Server 0` before `welcome` | T17b F7 | `UserPanel` returns `null` unless `welcomed`; `App` computes `welcomed` from `world.serverId > 0`, renders `Hud` only then, and a stats-only section pre-welcome | `UserPanel.test.tsx` pre-welcome test; `App.test.tsx` first-paint + stats-only tests (§ 3.4) |

Spec text being satisfied:

- AC-14: "server-authoritative board … own cube re-syncs to the exact `removedIds` from the server, no local rollback" (`spec.md` § AC-14).
- AC-16: "While playing, the shell renders a button 'Users on Server' …" (`spec.md` line 200).
- AC-22: "On reconnect within grace: `rejoin` → `welcome` → own cube re-syncs to authority (board equality asserted), the view resets to the own cube instantly, and spectate state is cleared" (`spec.md` line 212).
- § Real-time contract: the client never trusts reported local values; authority replaces them (no LWW).

---

## 2. Implementation

### 2.1 `src/frontend/src/game/engine.ts` (+201)

- Module header documents authoritative adoption: exact replacement in both directions, level/grid/style adoption, stat preservation, held-travel release, and the deferred removal replay.
- `AuthoritativeCubeState` interface and `GameEngine.adoptCubeState?` / `OnlineGameEngine.adoptCubeState` declarations.
- New state: `pendingBoardReplay: { removedIds, clearedFaceIds } | null` and `boardReplayArmed`, plus module helper `boardHasId`.
- Helpers:
  - `replayBurst()` — empty-particle burst with the active profile's `explosionMs`.
  - `removeForAuthority(id, emitIntent)` — removes one authoritative id, records the click/face counters, and either forwards the intents now or leaves them to the rebuild replay. No auto-rotation/settle.
  - `authoritativeBoard(cube)` — builds `createBoard(gridSize)` minus the valid authoritative ids, returning the exact removal and cleared-face sets (invalid ids ignored).
  - `releaseAuthorityTravel()` — clears a running travel (phase `playing`), the face fade, every travel field and `pendingNextLevel`; returns whether anything was released.
  - `flushBoardReplay()` — arms on the first `advance` after a rebuild and emits the removal replay on the next one (one frame after the scene drains `levelChanged`).
- `adoptCubeState`:
  - computes `levelDiffers` / `gridDiffers` / `styleDiffers` / `restoreNeeded`;
  - applies same-level/grid authoritative removals with stats accounting;
  - on rebuild sets `progression.levelIndex`, `gridSize`, `styleOverride`, `board`, resets orientation when the level differs, queues `levelChanged`, arms the replay;
  - releases superseded travel and invalidates only when something changed (a repeated identical adoption keeps the snapshot identity).

### 2.2 `src/frontend/src/game/session.ts` (+34/−14, comments mostly)

- Header now states that `welcome`/`stateSync` adopt the authoritative cube exactly and that the resume adoption releases a held level travel.
- `reconcileCube`:
  ```ts
  if (engine.adoptCubeState !== undefined) {
    engine.adoptCubeState({
      levelIndex: cube.levelIndex,
      gridSize: cube.gridSize,
      style: resolveStyle(cube.styleId, cube.levelIndex),
      removedIds: cube.removedIds as MiniCubeId[],
    });
    return;
  }
  for (const id of cube.removedIds) {
    applyAuthoritativeRemoval(id as MiniCubeId);
  }
  ```
  The fallback keeps the pre-adoption contract for engine fakes (their tests own it); the real engine always implements the seam. The `handleWelcome` resume branch still cancels camera-only flights first; the adoption that follows releases the level hold (F2).

### 2.3 `src/frontend/src/App.tsx` (+25/−7)

- `welcomed = world.serverId > 0`.
- `welcomed ? <Hud …/> : <section aria-label="Game statistics">` with `Clicks`, `Faces destroyed` and `Cube` only (no `Server` line).
- `UserPanel` receives `welcomed`.
- `ConnectionBanner` and the single `role="status"` phase announcement are unchanged.

### 2.4 `src/frontend/src/ui/UserPanel.tsx` (+13/−3)

- New required `welcomed: boolean` prop; returns `null` (type `ReactElement | null`) before the first `welcome`. Header documents the gate.

---

## 3. Tests (14 new, 1 rewritten; 608 → 622 frontend tests)

### 3.1 `engine.test.ts` — `describe('authoritative cube adoption (AC-14, AC-22)')` (7 new)

1. **"adopts the removed set of the same cube exactly and forwards the removal intent"** — grid 3, adopt `removedIds: ['front:0:0']`: front face `[8, 9, 9, 9, 9, 9]`, ids equal the full face minus the authority id, stats `{clicks:1, facesDestroyed:0}`, exactly one empty-burst explosion intent.
2. **"reports a face cleared by an authoritative removal without auto-rotating"** — grid 1: stats `{clicks:1, facesDestroyed:1}`, orientation unchanged, `[0, 1, 1, 1, 1, 1]`, explosion + `faceCleared` for `front`.
3. **"restores a locally missing tile with a fresh cube view (local extra is not authoritative)"** — the client exploded `front:1:1`, the authority still has it: full 3×3 board, stats stay `{clicks:1, facesDestroyed:0}`, one `levelChanged`, no stray replay intents on the next two frames.
4. **"adopts a different level, grid and style exactly and replays its removals after the rebuild"** — level 1 / grid 4 / `emerald-crystal` with `['front:0:0','front:1:1']`: exact board `[14,16,16,16,16,16]`, exact id list, old stats retained (no new-cube click accounting), `levelChanged`, then frame 1 no intents and frame 2 the two empty-burst explosions, frame 3 empty.
5. **"releases the held nextLevel travel with the authoritative cube (F2)"** — `sweepOnlineIntoTravel` (54 clicks, 6 faces) held at progress 0 → adopt level 1/grid 4: phase `playing`, progress `1`, all travel fields `null`, level/grid/style adopted, stats `{clicks:54,facesDestroyed:6}`, one `levelChanged`; `advance(2500)` never flies.
6. **"releases a running face fade so the old completion cannot start a travel (F2)"** — a completed grid-1 cube in its face fade is adopted to level 1/grid 2; advancing `faceFadeMs` leaves phase `playing`, level 1, no `travelStarted`.
7. **"treats a repeated identical adoption as a no-op"** — the second identical adoption returns the same snapshot object and zero intents.

### 3.2 `session.test.ts` — `describe('authoritative cube adoption over the wire (AC-14, AC-22)')` (5 new, real engine + real scene)

1. **"restores a locally removed tile the server still has and forwards the next tap again"** — a tap removes `front:2:2` (stats 1, 24 front ids, one sent `explode`); `stateSync {removedIds: []}` restores 25 ids, keeps stats 1 and sends nothing; the next frame renders the tile at scale `Math.fround(0.95)` / position `[0,0,2.625]`; the next centre tap sends the same `{type:'explode',id:'front:2:2',level:0}` again (stats 2).
2. **"removes the authoritative ids of a stateSync exactly and never echoes them"** — `removedIds: ['front:0:0','front:0:1']`: exact 23-id front list, stats `{clicks:2,facesDestroyed:0}`, no send; after the pop the instance is zero-scaled at `[-2,2,2.625]`; a duplicate sync returns the same snapshot object.
3. **"adopts a different level, grid and style from stateSync exactly (AC-14)"** — after one local click, `stateSync {levelIndex:1, gridSize:4, styleId:'crimson-alloy', removedIds:['front:1:1']}`: level 1, grid 4, style `crimson-alloy`, stats stay `{clicks:1,facesDestroyed:0}`, board `[15,16,16,16,16,16]`, no send. The rebuild frame renders 16 instances; after the deferred replay + 160 ms pop, `front:1:1` is zero-scaled at `[-0.625,0.625,2.625]`, a control tile has scale `Math.fround(1.1875)`, and `top` stays 16.
4. **"adopts a fresh level-0 cube when a resume fails and the client rejoins as a new identity"** — level 0 is completed through the real advance to a level-1/grid-4 cube (stats `{clicks:150,facesDestroyed:6}`); disconnect → reconnect → `welcome` for new `p3` at level 0: phase `playing`, level 0, grid 5, `obsidian-neon`, full board, stats preserved, world self `p3`, next frame renders 25 per face, and a centre tap sends `{type:'explode',id:'front:2:2',level:0}` (stats 151).
5. **"releases the held nextLevel travel when a resume welcome answers the completion (F2)"** — the sixth face sends `explode` + `cubeCompleted`; after the 400 ms fade the travel is held (`phase:'travel'`, `travelKind:'nextLevel'`, progress 0). A drop and a resume `welcome` at level 1/grid 4/`crimson-alloy` resume playing: progress `1`, travel fields `null`, level 1, grid 4, style `crimson-alloy`, stats `{clicks:150,facesDestroyed:6}`, board `[16×6]`, world self cube at level 1. The old 2500 ms window leaves it `playing` at camera `[0,0,12]`; a quarter-offset tap sends `{type:'explode',id:'front:1:1',level:1}` (stats 151).

### 3.3 `session.test.ts` — rewritten fake-engine contract test

- **"treats a consistent ack as a no-op and hands stateSync to the adoption seam"** (was "…reconciles stateSync without rollback"): `createFakeEngine` now records `adoptCubeState` calls in `cubeAdoptions`. The test pins the welcome adoption `{levelIndex:0, gridSize:5, style:CUBE_STYLES[0], removedIds:[]}`, the exact `stateSync` cube with three ids (no per-tile dispatch, no echo), a different level/grid/style adoption, and that a remote player's `stateSync` never reaches the own engine. Stats/removal accounting moved to the real-engine tests above (the recording fake owns no game logic).

### 3.4 Shell tests

- `UserPanel.test.tsx` — **"renders nothing before the first welcome assigns a server identity (F7)"**: `welcomed={false}` + `defaultOpen` renders `''`; the six existing renders now pass `welcomed`.
- `App.test.tsx` — **"keeps the stats visible without a server line before the first welcome (F7)"**: `serverId: 0` with stats `{3,1}`/level 2 renders the three stats lines and no `Server` line/panel. The first-paint test now asserts no `data-stat="server"` and no `Users on Server`; `shellHtml` treats `serverId > 0` as welcomed.

---

## 4. Gate transcripts

Environment: Node `v24.22.0`, npm `11.19.1`, branch `main`, committed baseline HEAD `c96b3dd` (backend T5b), no push.

### 4.1 `npm run lint` → exit 0

```text
$ npm run lint

> lint
> eslint .
```

### 4.2 `npm run typecheck` → exit 0

```text
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
```

### 4.3 `npm test` → exit 0 (810 tests: backend 188, frontend 622)

```text
> test
> vitest run

 Test Files  7 passed (7)
      Tests  188 passed (188)

> test
> vitest run

 Test Files  28 passed (28)
      Tests  622 passed (622)
```

### 4.4 `npm run coverage` → exit 0 (thresholds ≥ 80 all four metrics, per workspace)

Backend (`src/backend`):

```text
 % Coverage report from v8
--------------|---------|----------|---------|---------|------------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
--------------|---------|----------|---------|---------|------------------------
All files     |   98.51 |    97.16 |     100 |   98.51 |
 src          |     100 |      100 |     100 |     100 |
  app.ts      |     100 |      100 |     100 |     100 |
 src/game     |   98.42 |    96.92 |     100 |   98.42 |
  config.ts   |     100 |      100 |     100 |     100 |
  cubes.ts    |     100 |      100 |     100 |     100 |
  hub.ts      |   96.64 |    92.85 |     100 |   96.64 | ...352,380-381,398-400
  players.ts  |     100 |      100 |     100 |     100 |
  protocol.ts |     100 |      100 |     100 |     100 |
  servers.ts  |     100 |      100 |     100 |     100 |
--------------|---------|----------|---------|---------|------------------------
```

Frontend (`src/frontend`):

```text
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   99.01 |    98.28 |   99.28 |   99.01 |
 src               |     100 |      100 |     100 |     100 |
  App.tsx          |     100 |      100 |     100 |     100 |
  browser-env.ts   |     100 |      100 |     100 |     100 |
 src/game          |   98.87 |    98.11 |     100 |   98.87 |
  board.ts         |     100 |      100 |     100 |     100 |
  effects.ts       |     100 |      100 |     100 |     100 |
  engine.ts        |   99.65 |    99.54 |     100 |   99.65 | 811-812
  progression.ts   |     100 |      100 |     100 |     100 |
  rotation.ts      |     100 |      100 |     100 |     100 |
  session.ts       |   97.58 |    95.65 |     100 |   97.58 | ...36-637,641-644
  types.ts         |     100 |      100 |     100 |     100 |
 src/input         |     100 |      100 |     100 |     100 |
  gestures.ts      |     100 |      100 |     100 |     100 |
  keyboard.ts      |     100 |      100 |     100 |     100 |
 src/multiplayer   |   99.73 |    99.24 |     100 |   99.73 |
  protocol.ts      |     100 |      100 |     100 |     100 |
  server-state.ts  |   99.18 |    97.18 |     100 |   99.18 | 119-120
  spectate.ts      |     100 |      100 |     100 |     100 |
  transport.ts     |     100 |      100 |     100 |     100 |
 src/render        |   99.83 |    97.83 |     100 |   99.83 |
  cube-view.ts     |     100 |      100 |     100 |     100 |
  particles.ts     |     100 |      100 |     100 |     100 |
  picking.ts       |     100 |      100 |     100 |     100 |
  scene.ts         |   99.54 |    98.38 |     100 |   99.54 | 757-758
  ...ate-travel.ts |     100 |      100 |     100 |     100 |
  starfield.ts     |     100 |      100 |     100 |     100 |
  webgl.ts         |     100 |      100 |     100 |     100 |
  world.ts         |     100 |    93.58 |     100 |     100 |
 src/ui            |   89.34 |      100 |   66.66 |   89.34 |
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |
  GameCanvas.tsx   |    61.9 |      100 |     100 |    61.9 | 23-30
  Hud.tsx          |     100 |      100 |     100 |     100 |
  UserPanel.tsx    |   90.74 |      100 |   33.33 |   90.74 | 59-60,82-84
  theme.ts         |     100 |      100 |     100 |     100 |
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100
-------------------|---------|----------|---------|---------|-------------------
```

No threshold, exclusion or test pattern was changed.

### 4.5 `npm run build --workspace @cubeclicker/frontend` → exit 0

```text
vite v7.3.7 building client environment for production...
✓ 58 modules transformed.
dist/index.html                   0.40 kB │ gzip:   0.27 kB
dist/assets/index-DTvgIu_V.css    2.96 kB │ gzip:   0.94 kB
dist/assets/index-BS7BoqJD.js   796.11 kB │ gzip: 216.71 kB
✓ built in 1.48s
```

Gzip total `0.27 + 0.94 + 216.71 = 217.92 kB`; the JS chunk is `+0.41 kB` gzip vs the T16 baseline `216.30 kB` (smaller than the 350 kB ceiling; the additions are the adoption helpers and gating markup).

---

## 5. Acceptance audit

- **AC-14 — full authoritative board, optimistic play:** met. `stateSync`/welcome adopt `{levelIndex, gridSize, styleId, removedIds}` exactly through `adoptCubeState`; local extras are removed, locally missing ids are restored, a different level/grid/style is adopted. Evidence: engine tests 1–4, session tests 1–3, rewritten fake-engine test. Stats are never rolled back (asserted in tests 1–4 and the resume/restore tests).
- **AC-16 — Users on Server while playing:** met with the F7 gate. `UserPanel` renders nothing pre-welcome; the six existing panel tests and the new pre-welcome test pass; `App` omits the panel before `welcome`.
- **AC-22 — resume/re-sync:** met. A resume welcome adopts the authoritative cube (including a different level), releases a held `nextLevel` or a running fade, and the view resets instantly (existing T17 tests still pass). Evidence: session tests 4–5, engine tests 5–6, plus the unchanged "resets a mid-flight spectate…" test.
- **§ Real-time contract (no LWW):** met. Every `welcome.self`/`stateSync` is treated as authority, never merged with local values; the one-way reconcile is replaced by exact adoption.
- **AC-24 — no weakening:** met. All assertions are concrete expected values (ids, counts, stats, exact payloads); no wildcard/loose matcher, snapshot or assertion-free test was added; no production code was excluded. One assertion uses `Math.fround(...)` to match the float32 instance matrices (not a tolerance matcher).
- **Out-of-scope check:** exactly the eight owned files plus this log changed; `Hud.tsx`, `scene.ts`, `protocol.ts`, backend files and container assets are untouched.

## 6. Deviations from spec

1. **App-level stats-only pre-welcome section (F7).** `Hud.tsx` is not in this task's `files_owned`, so `App` composes the same three `<p>` stats (clicks/faces/cube) in a stats-only `<section aria-label="Game statistics">` while `!welcomed`. After welcome the normal `Hud` (with the `Server` line) renders; exactly one stats section exists in either state. A future cleanup can move the optional `serverId` into `Hud` and delete the duplication.
2. **Deferred removal replay after a rebuild.** `scene.ts` rebuilds the cube view from the snapshot (fully visible) and is not owned here, so the engine replays authoritative removals one frame after the rebuild as empty-burst `explosion` intents (plus `faceCleared` for emptied faces). The engine tests pin the one-frame sequencing; the session different-level test pins the rendered zero scale. Net effect: no visible burst for authority removals, and the rendered board matches the engine.
3. **F2 implemented client-side, not by replaying `levelAdvanced`/`worldEntered`.** The server has no replay hook in scope; adopting the welcome cube and releasing the hold is equivalent for the reachable completion window and avoids a protocol change.
4. **`resume_failed` is observed as a new-identity `welcome`.** The transport owns the handshake; the session test models the contract by emitting a welcome for a different `playerId` at level 0, which the adoption handles exactly.
5. **Stats accounting on a different cube.** Unlike the previous remove-only reconcile, authoritative removals from a different level/grid do not increment clicks/faces (they are not clicks this client made). Same-level/grid syncs keep the accepted accounting that existing tests pin.

## 7. Open questions

- None blocking. Follow-ups already tracked by review r1: the backend trailing-second limiter/move-plan (T5b, now committed) and the smoke-harness idempotency (T15b).
- The `Hud` duplication noted in § 6.1 is a deliberate scope boundary; moving the pre-welcome gate into `Hud` would need a separate task that owns `Hud.tsx`.
