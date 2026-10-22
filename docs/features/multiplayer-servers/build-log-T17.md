# Build log — T17 — Corrective: mid-flight resume reset + spectator stays viewing

Task: T17 (2026-10-22)
Files changed: `src/frontend/src/game/engine.ts`, `src/frontend/src/game/engine.test.ts`, `src/frontend/src/game/session.ts`, `src/frontend/src/game/session.test.ts`, `src/frontend/src/render/scene.test.ts`, `docs/features/multiplayer-servers/build-log-T17.md`
What changed & why: closed the two gaps that made AC-19 and AC-22 unmet in T16 (`build-log-T16.md` § 7 F1/F2, § 8). Added the engine `cancelTravel()` seam and called it from the resume `welcome` path while a camera-only `spectate`/`return` flight is running; pinned the "spectator stays viewing" behavior after a same-server `levelAdvanced`.

Decisions:
- The seam is named `cancelTravel()` and takes no argument. The task allowed "a travel-cancel/teleport seam (e.g. `cancelTravel({ restPosition })` or `resetView()`)" and required "phase `playing`, no extra intents, own rest pose retained"; the own rest pose is already derived by the scene from the own position, so no position needs to be passed and no scene production code changes.
- `cancelTravel` is **optional** on the base `GameEngine` and **required** on `OnlineGameEngine`, mirroring the existing `completeNextLevel`/`setSpectating` compatibility pattern; the session calls it through `engine.cancelTravel?.()` so pre-online fakes stay source-compatible.
- `cancelTravel` deliberately leaves `spectating` unchanged; the session owns the spectate state machine and clears the gate right after (`spectate.reset()` + `engine.setSpectating(false)`). The engine guard test pins this contract.
- Only camera-only flights are cancellable. The online `nextLevel` hold and the offline level travel own level data and must run to completion; both are explicit no-ops (task scoped the reset to `spectate`/`return`).
- No dependency, config, threshold, exclusion or assertion was changed.

---

## 1. Gap → fix mapping

| T16 finding | Task item | Fix | Evidence |
| --- | --- | --- | --- |
| **F1 — AC-19(c)** missing "spectator stays viewing" assertion (test-only) | T17 item 1 | Added `session.test.ts` › "keeps viewing the target when their same-server cube advances (AC-19 c)": same-server `levelAdvanced` for `p2` while viewing | Session test below; view-rebuild half intentionally not duplicated (`world.test.ts` already owns it) |
| **F2 — AC-19(d)/AC-22** mid-flight resume still plays the remaining flight (behavior gap) | T17 item 2 | Engine `cancelTravel()` seam; session cancels a `spectate`/`return` travel on a resume `welcome` before `spectate.reset()` / world re-entry | 3 engine tests, 1 session test, 1 scene test, plus the negative control (§ 5) |

Spec text being satisfied:

- AC-19(c): "Target completes a cube on the same server → `levelAdvanced` → the spectator stays; the target's cube view rebuilds in place" (`spec.md` line 203).
- AC-19(d): "Spectator reconnects → view resets to the own cube instantly (no flight)" (`spec.md` line 203).
- AC-22: "On reconnect within grace: `rejoin` → `welcome` → own cube re-syncs to authority …, the view resets to the own cube instantly, and spectate state is cleared" (`spec.md` line 212).

---

## 2. Implementation

### 2.1 `src/frontend/src/game/engine.ts` (+33 lines)

- Module header documents that `cancelTravel` abandons a camera-only flight without intents and never cancels the server-driven `nextLevel` hold or the offline level travel (lines 51–53).
- `GameEngine.cancelTravel?(): void` — documented optional base member for pre-online fakes (lines 243–252).
- `OnlineGameEngine.cancelTravel(): void` — required on the online contract (line 261).
- Implementation (lines 840–856):

```ts
cancelTravel(): void {
  // Resume reset (AC-19 d/AC-22): only a camera-only flight may be abandoned. The
  // online `nextLevel` hold owns the server's next cube and the offline level travel
  // owns the next level, so both always run to completion.
  if (phase !== 'travel' || travelKind === null || travelKind === 'nextLevel') {
    return;
  }
  // No intent is emitted: the scene reads the phase and rests over the own cube.
  phase = 'playing';
  phaseElapsedMs = 0;
  travelDirection = null;
  travelKind = null;
  travelDestination = null;
  pendingNextLevel = null;
  onlineTravelReleased = false;
  invalidate();
},
```

Guards: non-`travel` phases are a no-op; `travelKind === null` (offline level travel) is a no-op; `nextLevel` is a no-op. The snapshot is invalidated only when a real cancel happened, so `advance()` cannot resurrect the abandoned flight and no `travelStarted`/`travelEnded`/`levelChanged` intent is queued.

### 2.2 `src/frontend/src/game/session.ts` (+11/−4)

Header bullet now says a resume `welcome` "abandons a running camera-only flight (the engine returns to `playing` with no intents)". In `handleWelcome`, inside the existing resume branch (`previousSelfId.length > 0 && previousSelfId === message.playerId`) and **before** `spectate.reset()` / `engine.setSpectating(false)`:

```ts
const snapshot = engine.getSnapshot();
const travelKind = snapshot.travelKind ?? null;
if (snapshot.phase === 'travel' && (travelKind === 'spectate' || travelKind === 'return')) {
  engine.cancelTravel?.();
}
```

The board reconcile that follows is unchanged: the resume welcome still re-applies the authoritative self board (the new session test proves `removedIds: ['front:0:0']` lands). A fresh join never cancels anything.

---

## 3. Tests added (6 tests, no existing test changed)

`git diff --stat` for the five source/test files: **5 files changed, 300 insertions(+), 4 deletions(-)** (the 4 deletions are the reworded `session.ts` header/comment lines; no test assertion was removed).

### 3.1 `engine.test.ts` — `describe('travel cancel (AC-19 d, AC-22)')` (+110)

1. **"cancels a spectate flight at once, keeping the own level and emitting no intent"** — travel to `{x:24,y:0}`, advance 1000 ms (progress `0.4`), `cancelTravel()`. Pins phase `playing`, progress `1`, `travelKind`/`travelDestination`/`travelDirection` `null`, level `0`, grid `5`, same `board` reference, stats `{clicks:0,facesDestroyed:0}`, orientation `{yawSteps:0,pitchSteps:0}`, `spectating` `false`, zero intents; `advance(travelMs)` returns the **same snapshot object** (flight never resumes); a subsequent explode yields stats `{clicks:1,facesDestroyed:0}` and 24 front tiles.
2. **"cancels a return flight and leaves the spectating gate to the caller"** — return flight at progress `0.25`; cancel pins phase `playing`, travel fields `null`, `spectating` still `true`; the test then calls `setSpectating(false)` and explodes (stats `{clicks:1,facesDestroyed:0}`, 24 front tiles).
3. **"never cancels the online nextLevel hold, an offline level travel or a rest state"** — `nextLevel` hold snapshot is returned unchanged by identity and still releases `travelDestination {x:24,y:0}` after `completeNextLevel`; an offline level travel (`travelKind` `null`) is returned unchanged and still completes to level `1`; a `playing` snapshot is returned unchanged.

### 3.2 `session.test.ts` (+109)

1. **"keeps viewing the target when their same-server cube advances (AC-19 c)"** — `spectateMember('p2')` + ticks `1016`/`2516` → spectate `{mode:'viewing',target:'p2'}`, camera `[24,0,12]`; emits `levelAdvancedMessage({playerId:'p2', levelIndex:2, gridSize:6, styleId:'emerald-crystal', position:{x:24,y:0}})`. Asserts spectate unchanged, `spectating` `true`, phase `playing`, travel kind/destination `null`, own level `0`/grid `5`, stats `{clicks:0,facesDestroyed:0}`, world member exactly `{playerId:'p2',name:'Player 2',position:{x:24,y:0},levelIndex:2,gridSize:6,styleId:'emerald-crystal',removedIds:[]}`, next tick still camera `[24,0,12]`, and `wire.sent` `[]` (no travel, no click).
2. **"resets a mid-flight spectate to the own rest on a resume welcome (AC-19 d, AC-22)"** — starts online at `(0,0)`/grid 5, taps once, starts spectating `p2`; at tick `1016` the flight is at progress `0.4` with camera `[7.6800000000000015, 0, 83.76]`. Drops the socket mid-flight, reconnects and sends a resume `welcome` with `removedIds: ['front:0:0']` and the matching roster. Asserts immediately: phase `playing`, progress `1`, travel kind/destination `null`, `spectating` `false`, level `0`, stats `{clicks:1,facesDestroyed:0}`, 24 front tiles, spectate `{mode:'none'}`, `world.self.cube.removedIds ['front:0:0']`. Next frame renders camera `[0,0,12]`; at `2516` ms (the abandoned flight's landing time) still `playing` at `[0,0,12]`; a centre tap sends exactly `{type:'explode',id:'front:2:2',level:0}` and clicks `2`.

### 3.3 `scene.test.ts` — `describe('resume reset during a flight (AC-19 d, AC-22)')` (+37)

1. **"rests at the own cube on the first snapshot after a mid-flight reset"** — own position `(24,0)`; a `travel`/`spectate` snapshot at progress `0.5` puts the camera at `[12,12,90]` looking at `[12,12,0]`; then `enterWorld(ownPosition (24,0))` + one `playing` snapshot gives camera `[24,0,12]`, look target `[24,0,0]`, identity quaternion `[0,0,0,1]`, cube group `[24,0,0]`; `update(16)` keeps the starfield scale `[1,1,1]` (no residual flight).

No `scene.ts` production change was needed: the next snapshot is `playing` at the own position, which the scene already applies instantly. The scene test proves that path rather than assuming it.

---

## 4. Gate transcripts

Environment: Node `v24.22.0`, npm `11.19.1`, branch `main` (ahead 31, no push), baseline HEAD `22c8298`.

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

### 4.3 `npm test` → exit 0 (788 tests)

```text
$ npm test

> test
> npm run test --workspaces --if-present


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/config.test.ts (13 tests) 7ms
 ✓ src/game/cubes.test.ts (24 tests) 13ms
 ✓ src/game/servers.test.ts (36 tests) 11ms
 ✓ src/game/players.test.ts (13 tests) 14ms
 ✓ src/game/protocol.test.ts (56 tests) 6ms
 ✓ src/game/hub.test.ts (31 tests) 34ms
 ✓ src/app.test.ts (7 tests) 139ms

 Test Files  7 passed (7)
      Tests  180 passed (180)
   Start at  11:12:55
   Duration  484ms (transform 348ms, setup 0ms, collect 694ms, tests 223ms, environment 1ms, prepare 397ms)


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/multiplayer/server-state.test.ts (31 tests) 7ms
 ✓ src/game/effects.test.ts (28 tests) 9ms
 ✓ src/game/progression.test.ts (10 tests) 10ms
 ✓ src/ui/theme.test.ts (2 tests) 4ms
 ✓ src/browser-env.test.ts (6 tests) 15ms
 ✓ src/ws/connection.test.ts (10 tests) 10ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 9ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 21ms
 ✓ src/game/rotation.test.ts (15 tests) 9ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 19ms
 ✓ src/render/webgl.test.ts (5 tests) 11ms
 ✓ src/render/particles.test.ts (19 tests) 13ms
 ✓ src/game/board.test.ts (18 tests) 18ms
 ✓ src/input/gestures.test.ts (21 tests) 5ms
 ✓ src/ui/Hud.test.tsx (3 tests) 10ms
 ✓ src/game/engine.test.ts (61 tests) 54ms
 ✓ src/render/cube-view.test.ts (32 tests) 56ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 11ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 12ms
 ✓ src/input/keyboard.test.ts (13 tests) 11ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 10ms
 ✓ src/ui/UserPanel.test.tsx (5 tests) 13ms
 ✓ src/render/picking.test.ts (12 tests) 35ms
 ✓ src/render/world.test.ts (19 tests) 46ms
 ✓ src/render/starfield.test.ts (15 tests) 109ms
 ✓ src/App.test.tsx (8 tests) 25ms
 ✓ src/render/scene.test.ts (69 tests) 107ms
 ✓ src/game/session.test.ts (43 tests) 95ms

 Test Files  28 passed (28)
      Tests  608 passed (608)
   Start at  11:12:56
   Duration  704ms (transform 2.40s, setup 0ms, collect 6.05s, tests 754ms, environment 5ms, prepare 3.54s)
```

Deltas vs T16: `engine.test.ts` 58 → **61** (+3), `session.test.ts` 41 → **43** (+2), `scene.test.ts` 68 → **69** (+1); frontend 602 → **608**, total 782 → **788**.

### 4.4 `npm run coverage` → exit 0 (both workspaces ≥ 80 on all four metrics)

```text
$ npm run coverage

> coverage
> npm run coverage --workspaces --if-present


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/config.test.ts (13 tests) 7ms
 ✓ src/game/cubes.test.ts (24 tests) 8ms
 ✓ src/game/servers.test.ts (36 tests) 8ms
 ✓ src/game/players.test.ts (13 tests) 9ms
 ✓ src/game/hub.test.ts (31 tests) 28ms
 ✓ src/game/protocol.test.ts (56 tests) 9ms
 ✓ src/app.test.ts (7 tests) 124ms

 Test Files  7 passed (7)
      Tests  180 passed (180)
   Start at  11:13:22
   Duration  561ms (transform 318ms, setup 0ms, collect 705ms, tests 192ms, environment 1ms, prepare 554ms)

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

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/game/progression.test.ts (10 tests) 6ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 8ms
 ✓ src/ws/connection.test.ts (10 tests) 13ms
 ✓ src/browser-env.test.ts (6 tests) 10ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 12ms
 ✓ src/ui/theme.test.ts (2 tests) 4ms
 ✓ src/game/effects.test.ts (28 tests) 10ms
 ✓ src/game/rotation.test.ts (15 tests) 7ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 16ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 19ms
 ✓ src/render/webgl.test.ts (5 tests) 11ms
 ✓ src/game/board.test.ts (18 tests) 27ms
 ✓ src/input/gestures.test.ts (21 tests) 6ms
 ✓ src/input/keyboard.test.ts (13 tests) 8ms
 ✓ src/game/engine.test.ts (61 tests) 48ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 10ms
 ✓ src/ui/Hud.test.tsx (3 tests) 13ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 13ms
 ✓ src/render/cube-view.test.ts (32 tests) 64ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 11ms
 ✓ src/ui/UserPanel.test.tsx (5 tests) 14ms
 ✓ src/render/particles.test.ts (19 tests) 19ms
 ✓ src/render/picking.test.ts (12 tests) 34ms
 ✓ src/render/starfield.test.ts (15 tests) 124ms
 ✓ src/render/world.test.ts (19 tests) 52ms
 ✓ src/App.test.tsx (8 tests) 25ms
 ✓ src/game/session.test.ts (43 tests) 124ms
 ✓ src/render/scene.test.ts (69 tests) 166ms

 Test Files  28 passed (28)
      Tests  608 passed (608)
   Start at  11:13:22
   Duration  931ms (transform 2.78s, setup 0ms, collect 7.09s, tests 876ms, environment 5ms, prepare 3.30s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   99.11 |    98.29 |   99.26 |   99.11 |                   
 src               |     100 |      100 |     100 |     100 |                   
  App.tsx          |     100 |      100 |     100 |     100 |                   
  browser-env.ts   |     100 |      100 |     100 |     100 |                   
 src/game          |   99.14 |    98.14 |     100 |   99.14 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |     100 |      100 |     100 |     100 |                   
  progression.ts   |     100 |      100 |     100 |     100 |                   
  rotation.ts      |     100 |      100 |     100 |     100 |                   
  session.ts       |   98.08 |    95.76 |     100 |   98.08 | ...28-629,633-636 
  types.ts         |     100 |      100 |     100 |     100 |                   
 src/input         |     100 |      100 |     100 |     100 |                   
  gestures.ts      |     100 |      100 |     100 |     100 |                   
  keyboard.ts      |     100 |      100 |     100 |     100 |                   
 src/multiplayer   |   99.73 |    99.24 |     100 |   99.73 |                   
  protocol.ts      |     100 |      100 |     100 |     100 |                   
  server-state.ts  |   99.18 |    97.22 |     100 |   99.18 | 119-120           
  spectate.ts      |     100 |      100 |     100 |     100 |                   
  transport.ts     |     100 |      100 |     100 |     100 |                   
 src/render        |   99.83 |    97.85 |     100 |   99.83 |                   
  cube-view.ts     |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |     100 |      100 |     100 |     100 |                   
  scene.ts         |   99.54 |    98.41 |     100 |   99.54 | 757-758           
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |     100 |    93.58 |     100 |     100 | ...85,193,271-274 
 src/ui            |   88.98 |      100 |   66.66 |   88.98 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  GameCanvas.tsx   |    61.9 |      100 |     100 |    61.9 | 23-30             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  UserPanel.tsx    |     90 |      100 |   33.33 |      90 | 48-49,71-73       
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------
```

| Workspace | Statements | Branches | Functions | Lines | Gate |
| --- | --- | --- | --- | --- | --- |
| `@cubeclicker/backend` | **98.47** | **97.09** | **100** | **98.47** | PASS (≥ 80 each) |
| `@cubeclicker/frontend` | **99.11** | **98.29** | **99.26** | **99.11** | PASS (≥ 80 each) |

Compared with T16: backend identical; frontend 99.04/98.28/99.25/99.04 → **99.11/98.29/99.26/99.11**. `engine.ts` is **100/100/100/100**; `session.ts` improved from 97.71/95.65/100/97.71 to **98.08/95.76/100/98.08**. The remaining uncovered `session.ts` ranges (`...28-629,633-636`) are the same pre-existing reconnection/attachment guards recorded in T16 § 5 — no threshold or exclusion changed. A second coverage run reproduced the same numbers (exit 0).

### 4.5 `npm run build` → exit 0 (initial JS gzip 216.30 KB)

```text
$ npm run build

> build
> npm run build --workspaces --if-present


> build
> tsc


> build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 58 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.40 kB │ gzip:   0.27 kB
dist/assets/index-DTvgIu_V.css    2.96 kB │ gzip:   0.94 kB
dist/assets/index-DeHy2RIV.js   793.98 kB │ gzip: 216.30 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.31s
```

Exit **0**; gzip 216.30 KB (+0.03 KB vs T16) ≤ the pinned `BUNDLE_BUDGET_GZ_KB = 350` (AC-24).

---

## 5. Negative control (the new session test fails without the fix)

`session.ts` was temporarily replaced with the pre-T17 version (`git show HEAD:src/frontend/src/game/session.ts`), the new test was run alone, then the file was restored and compared byte-for-byte.

```text
$ npx vitest run src/game/session.test.ts -t 'resets a mid-flight spectate'
negative_control_exit=1
restore_ok=yes

 × multiplayer connection gating (AC-22) > resets a mid-flight spectate to the own rest on a resume welcome (AC-19 d, AC-22) 19ms
   → expected 'travel' to be 'playing' // Object.is equality

 FAIL  src/game/session.test.ts > multiplayer connection gating (AC-22) > resets a mid-flight spectate to the own rest on a resume welcome (AC-19 d, AC-22)
AssertionError: expected 'travel' to be 'playing' // Object.is equality

Expected: "playing"
Received: "travel"

 ❯ src/game/session.test.ts:2078:27
    2076|
    2077|     const resumed = session.getSnapshot();
    2078|     expect(resumed.phase).toBe('playing');
       |                           ^

 Test Files  1 failed (1)
      Tests  1 failed | 42 skipped (43)
```

Restored file, same filter:

```text
$ npx vitest run src/game/session.test.ts -t 'resets a mid-flight spectate'
positive_control_exit=0

 Test Files  1 passed (1)
      Tests  1 passed | 42 skipped (43)
```

This demonstrates the new test guards the production behavior (it fails on the exact "no cancel seam" regression), not a tautology. The engine cancel tests and the scene test include their own positive assertions (state, camera and starfield), and the scene test would fail if the next `playing` snapshot still rendered flight frames.

---

## 6. Banned matchers / scope / secrets

Scope: the three changed test files.

```text
$ FILES="src/frontend/src/game/engine.test.ts src/frontend/src/game/session.test.ts src/frontend/src/render/scene.test.ts"
$ grep -nE 'expect\.(anything|any)\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toHaveBeenCalled\(\)|toBeTruthy\(|toBeDefined\(|not\.toThrow\(|toMatchSnapshot|toMatchInlineSnapshot|toBeCloseTo|expect\.closeTo|\.toHaveBeenCalled\(\)' $FILES
banned_grep_exit=1
```

No matches (exit 1 = clean). No snapshot, no assertion-free test, no `toBeCloseTo`/`expect.closeTo`. All expected values are exact literals/envelopes (e.g. camera `[7.6800000000000015, 0, 83.76]`, `{clicks:1,facesDestroyed:0}`, `{type:'explode',id:'front:2:2',level:0}`).

Secrets/storage:

```text
$ git status --porcelain | grep -E '\.env'
env_grep_exit=1
```

No `.env*` file was read, created or modified; no secret, storage, dependency or config change was made.

`files_owned` compliance: only the six paths listed at the top were touched. The pre-existing unrelated dirty files (`.opencode/agents/*`, `docs/features/README.md`, `docs/features/cube-game-frontend/status.md`, untracked predecessor feature docs) were already modified/untracked before this task and remain unstaged; no `git add .` was used.

---

## 7. Acceptance audit

| AC / clause | Status | Evidence |
| --- | --- | --- |
| **AC-19(c)** — same-server target advance keeps the spectator | **met** | `session.test.ts` › "keeps viewing the target when their same-server cube advances (AC-19 c)": spectate `{mode:'viewing',target:'p2'}`, `spectating` `true`, phase `playing`, travel fields `null`, own level `0`/grid `5`, stats unchanged, world member `{levelIndex:2,gridSize:6,styleId:'emerald-crystal',position:{x:24,y:0}}`, camera still `[24,0,12]`, `wire.sent []`. The view-rebuild half remains owned by `world.test.ts` › "rebuilds a member on levelAdvanced exactly once at the new position and cube" (not duplicated, per task). |
| **AC-19(d)** — reconnect resets instantly, mid-flight included | **met** | Engine: 3 tests under `describe('travel cancel (AC-19 d, AC-22)')` — `spectate` cancel (phase `playing`, progress `1`, travel fields `null`, zero intents, same snapshot after `advance`, play resumes), `return` cancel (same, `spectating` left to caller), and the guard test (`nextLevel` hold, offline travel and rest are identity-preserved no-ops). Session: "resets a mid-flight spectate to the own rest on a resume welcome (AC-19 d, AC-22)" — drop at p=0.4 (`[7.6800000000000015,0,83.76]`) → resume welcome → phase `playing`, progress `1`, travels `null`, `spectating` `false`, spectate `none`, board re-synced to 24 tiles with `removedIds:['front:0:0']`, next frame `[0,0,12]`, still `[0,0,12]` at the old landing time, tap sends `{type:'explode',id:'front:2:2',level:0}`. Scene: "rests at the own cube on the first snapshot after a mid-flight reset" — `[12,12,90]` mid-flight → `enterWorld` + `playing` → `[24,0,12]`, identity quaternion, cube group `[24,0,0]`, starfield scale `[1,1,1]`. Negative control § 5. |
| **AC-22** — mid-flight clause (view reset + spectate cleared) | **met** | Same session test: resume clears spectate to `{mode:'none'}` and resets the camera/phase with no remaining flight frames; the existing gating tests (unchanged) still pass for the landed/disconnected cases. Full AC-22 banner/transport evidence remains as recorded in T16 § 4. |
| **AC-19 (a), (b), (e)** — unchanged clauses | **met (carried)** | Not touched by T17; their T16 evidence (`spectate.test.ts`, `session.test.ts`, `world.test.ts`, `hub.test.ts`) still passes in the 788-test run. |
| **AC-24** — no weakening | **met for T17** | Only additive tests; no existing assertion deleted or weakened (session.ts's 4 deleted lines are comments); banned-matcher scan clean; full suite green; build gzip 216.30 ≤ 350 KB. |

**Summary:** T16 findings **F1 and F2 are closed**. AC-19 and AC-22 now have concrete evidence for every clause that was previously unmet; the orchestrator/reviewer should re-run the T16 gate and update the AC-19/AC-22 rows in `build-log-T16.md` (that file is outside T17's `files_owned` and was not edited).

---

## 8. Deviations and observations

1. **Seam shape.** `cancelTravel()` takes no argument (the task allowed `cancelTravel({ restPosition })` or `resetView()` as examples). The rest pose is already owned by the scene (`ownPosition`), and passing it through the engine would duplicate state; the scene test proves the immediate reset.
2. **Optional base member.** `cancelTravel?()` is optional on `GameEngine` (required on `OnlineGameEngine`) to keep pre-online fakes source-compatible, matching the existing `completeNextLevel`/`setSpectating` pattern. The session calls it with `?.()`; a fake without it is only used by offline tests, where no online travel exists.
3. **`spectating` left to the caller.** `cancelTravel` does not clear the gate; the session clears it immediately after (`spectate.reset()` → `engine.setSpectating(false)`). This keeps the engine seam a pure camera/phase operation and is pinned by the return-cancel test.
4. **`nextLevel`/offline travel explicitly not cancellable.** On a resume while the online `nextLevel` hold is pending, the engine keeps the pending server cube data; the task scoped the instant reset to `spectate`/`return`. This is a deliberate boundary, not an oversight.
5. **Coverage branch variance in unchanged files.** `server-state.ts` (97.18 → 97.22) and `world.ts` (93.5 → 93.58) are untouched by T17; the differences are V8 report variation between runs, both far above the gate. No thresholds, exclusions or source files changed.
6. **No `scene.ts` production edit.** The scene already applies a `playing` snapshot at the own position instantly; the new scene test is the proof. This keeps the diff inside `files_owned`.
7. **Not run: `npm run smoke`.** T17's `verify` list does not include it and this is a client-only view-reset fix with no protocol/container change; the T16 smoke evidence remains valid (compose/backend untouched). `npm run build` was run as extra DoD evidence.

Open questions: **none blocking**. The only follow-up is the reviewer/orchestrator update of the T16 AC table (T16 § 8 item 3) and, optionally, the pre-existing T16 observations (F3–F5), none of which are T17 scope.

---

## 9. Commit

Staged explicitly (never `git add .`):

```text
$ git add src/frontend/src/game/engine.ts src/frontend/src/game/engine.test.ts \
    src/frontend/src/game/session.ts src/frontend/src/game/session.test.ts \
    src/frontend/src/render/scene.test.ts docs/features/multiplayer-servers/build-log-T17.md
$ git diff --cached --name-only
docs/features/multiplayer-servers/build-log-T17.md
src/frontend/src/game/engine.test.ts
src/frontend/src/game/engine.ts
src/frontend/src/game/session.test.ts
src/frontend/src/game/session.ts
src/frontend/src/render/scene.test.ts
```

Commit message:

```text
fix: reset the view instantly on mid-flight resume and keep spectators viewing (T17)
```

No push. The pre-existing unrelated dirty files were not staged.
