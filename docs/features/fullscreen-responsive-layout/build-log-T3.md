# Build log — T3 — Touch gesture support (tap explodes, drag does nothing)

Task: T3 (2026-10-24) — `docs/features/fullscreen-responsive-layout/tasks.md`
Files changed:
- `src/frontend/src/input/gestures.ts`
- `src/frontend/src/input/gestures.test.ts`
- `docs/features/fullscreen-responsive-layout/build-log-T3.md`

## Sketch (≤ 5 lines, written before the code)

1. Confirm no pointerType-dependent branch: grep production sources for `pointerType`/`pointerId` (session reads only `clientX`/`clientY`); if found, stop and report blocked.
2. `gestures.ts`: doc comment only — add the Pointer-type parity / touch contract paragraph (tap = explode, drag = nothing, no joystick, no drag-rotation, predecessor contract reference).
3. `gestures.test.ts`: add touch-vs-mouse parity cases at 39 px tap / 40 px tap (inclusive) / 41 px drag, vertical drag and tap NDC parity.
4. Replace the stale integration test (classified drag → manual `rotate`) with a touch tap → front-face pick → explode integration on the real engine and real three.js picking.
5. Pin the input API surface (only `classifyPointer`, 3 parameters) as the AC-12 no-joystick/no-rotate-control evidence; run lint/typecheck/test/coverage.

## What changed & why

- **`gestures.ts` — doc comment only; no logic change.** Added the **Pointer-type parity — touch contract** paragraph: Pointer Events is the single path (the session reads only `clientX`/`clientY`; the classifier takes only coordinates + rect, never `pointerType`/`pointerId`); touch tap → front-face pick → explode; touch drag → nothing (no rotation, no explosion, no publish, snapshot identity unchanged); no virtual joystick and no drag-rotation (Q-1); predecessor contract referenced (`cube-tile-lines-and-controls` AC-2). The 39 px tap / 40 px tap (inclusive) / 41 px drag boundary is stated.
- **`gestures.test.ts` — new parity group.** `classifyAs(pointerType, …)` feeds touch and mouse samples with identical coordinates; `pointerType` rides on the runtime sample but is not part of the classifier contract, so a branch reading it would make the two assertions disagree.
- **`gestures.test.ts` — replaced the stale integration test.** The old "a classified drag drives the real engine" test manually dispatched `rotate` for a classified drag, which contradicts the retained predecessor contract (drags dispatch nothing) and AC-10. It is replaced by a touch tap → real `pickMiniCube` (real camera + cube view) → real engine `explodeMiniCube` integration: centre tap resolves to `front:2:2`, clicks = 1, front face 24 tiles, tile removed.
- **`gestures.test.ts` — AC-12 API-surface pin.** The module exports exactly `classifyPointer` and its arity is 3 — no new exported input API, joystick or rotate control exists.

## No pointerType-dependent gap found

```
$ grep -rn "pointerType\|pointerId" src/frontend/src --include="*.ts" --include="*.tsx" | grep -v "\.test\."
(no output)
```

Production sources never mention pointer type: `session.ts` destructures only `clientX`/`clientY` on pointer down/up, and `gestures.ts` takes `{x, y}` + rect. Classification is pointerType-agnostic by construction; no logic was changed (out of scope either way).

## Tests added / updated (concrete values only)

New (all in `src/frontend/src/input/gestures.test.ts`):
- `classifyPointer — touch/mouse parity at the boundary (AC-9, AC-10) > classifies a 39 px touch tap exactly like a 39 px mouse tap` — both `{ kind: 'tap', ndcX: 0, ndcY: 0 }`.
- `... > classifies exactly 40 px of touch travel as a tap, like the mouse (inclusive boundary)` — both 40 px taps (the retained predecessor boundary; see Deviations).
- `... > classifies a 41 px touch drag exactly like a 41 px mouse drag` — both `{ kind: 'drag', axis: 'yaw', direction: 1 }`.
- `... > classifies a vertical touch drag exactly like the mouse drag` — both `{ kind: 'drag', axis: 'pitch', direction: -1 }`.
- `... > carries a touch release position into the tap NDC exactly like the mouse` — both `{ kind: 'tap', ndcX: -0.25, ndcY: 0 }`.
- `input API surface — no joystick or rotate control (AC-12) > exports only the pointer classifier, with no pointer-type or control input` — `Object.keys(module)` is exactly `['classifyPointer']`; `classifyPointer.length === 3`.
- `integration — a touch tap picks and explodes the front-face tile (AC-9) > resolves the centre tap to front:2:2 and explodes it on the real engine` — pinned `gridSize: 5`; ndc `(0, 0)` picks `front:2:2`; after the explosion: stats `{ clicks: 1, facesDestroyed: 0 }`, orientation `{ yawSteps: 0, pitchSteps: 0 }`, front face has 24 ids, `front:2:2` absent, `front:0:0` present.

Updated:
- Removed the stale `integration — a classified drag drives the real engine` case (see above); it encoded the superseded drag→rotation behavior. Keyboard/engine rotation remains covered by `keyboard.test.ts`/`engine.test.ts`/`rotation.test.ts`.

Weak/snapshot assertions found in this file: **none** — no `expect.anything()`, `expect.any()`, `objectContaining`, `toMatchObject`, snapshots, assertion-free tests or argument-unchecked mocks. No test was weakened; the only removed case was the superseded integration described above.

Dispatch-level evidence (read-only, `session.test.ts`, unchanged and green in the full run):
- `pointer wiring > ignores a playing drag: no rotation, no click, no publish (AC-2)` — mouse drags leave `session.getSnapshot()` referentially identical, orientation `{ yawSteps: 0, pitchSteps: 0 }`, `stats { clicks: 0, facesDestroyed: 0 }`, front face 25 tiles, zero publishes.
- `pointer wiring > maps taps and drags to the events each phase allows (injected engine, drags do nothing)` — includes `touchTapOn`/`touchDragOn` helpers with `pointerType: 'touch'`, proving the session ignores pointer type; drags produce no events.
- Because classification is pointerType-agnostic (parity group above), the touch drag reaches the same `kind: 'drag'` branch that the session drops without dispatch.

## Evidence

### `npm run lint`

```
> lint
> eslint .
```

Exit code 0.

### `npm run typecheck --workspace @cubeclicker/frontend`

```
> typecheck
> tsc --noEmit
```

Exit code 0.

### `npm test --workspace @cubeclicker/frontend`

```
> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/theme.test.ts (2 tests) 4ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 6ms
 ✓ src/game/progression.test.ts (10 tests) 6ms
 ✓ src/ws/connection.test.ts (10 tests) 15ms
 ✓ src/render/webgl.test.ts (5 tests) 10ms
 ✓ src/multiplayer/server-state.test.ts (40 tests) 7ms
 ✓ src/game/effects.test.ts (28 tests) 11ms
 ✓ src/browser-env.test.ts (6 tests) 9ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 23ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 19ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 8ms
 ✓ src/game/rotation.test.ts (15 tests) 8ms
 ✓ src/game/board.test.ts (18 tests) 24ms
 ✓ src/render/particles.test.ts (19 tests) 13ms
 ✓ src/game/engine.test.ts (71 tests) 45ms
 ✓ src/ui/Hud.test.tsx (3 tests) 10ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 12ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 9ms
 ✓ src/render/cube-view.test.ts (32 tests) 59ms
 ✓ src/input/keyboard.test.ts (13 tests) 10ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 16ms
 ✓ src/render/picking.test.ts (12 tests) 39ms
 ✓ src/render/starfield.test.ts (15 tests) 77ms
 ✓ src/input/gestures.test.ts (27 tests) 24ms
 ✓ src/render/world.test.ts (27 tests) 43ms
 ✓ src/App.test.tsx (9 tests) 18ms
 ✓ src/render/scene.test.ts (69 tests) 131ms
 ✓ src/game/session.test.ts (52 tests) 129ms

 Test Files  28 passed (28)
      Tests  652 passed (652)
   Start at  12:03:12
   Duration  847ms (transform 3.63s, setup 0ms, collect 8.91s, tests 785ms, environment 6ms, prepare 3.71s)
```

Exit code 0. Baseline before T3: 646 tests; `gestures.test.ts` 21 → 27 tests (+6 net: 5 parity + 1 API surface, one stale integration replaced by one new integration).

### `npm run coverage --workspace @cubeclicker/frontend`

```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.81 |    96.54 |   96.94 |   95.81 |                   
 src               |   96.74 |      100 |   92.85 |   96.74 |                   
  App.tsx          |     100 |      100 |     100 |     100 |                   
  browser-env.ts   |   91.66 |      100 |   91.66 |   91.66 | 69-72             
 src/game          |   95.15 |    95.29 |   98.36 |   95.15 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |   99.66 |    98.67 |     100 |   99.66 | 814-815           
  progression.ts   |     100 |      100 |     100 |     100 |                   
  rotation.ts      |     100 |      100 |     100 |     100 |                   
  session.ts       |    89.5 |    89.95 |   95.83 |    89.5 | ...75-976,989-990 
  types.ts         |     100 |      100 |     100 |     100 |                   
 src/input         |     100 |      100 |     100 |     100 |                   
  gestures.ts      |     100 |      100 |     100 |     100 |                   
  keyboard.ts      |     100 |      100 |     100 |     100 |                   
 src/multiplayer   |   92.25 |     97.6 |    93.1 |   92.25 |                   
  protocol.ts      |   82.78 |    97.58 |   78.94 |   82.78 | ...82-593,597-607 
  server-state.ts  |   98.22 |    95.18 |     100 |   98.22 | ...14,293,295-296 
  spectate.ts      |     100 |      100 |     100 |     100 |                   
  transport.ts     |     100 |      100 |     100 |     100 |                   
 src/render        |   99.45 |    97.08 |     100 |   99.45 |                   
  cube-view.ts     |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |     100 |      100 |     100 |     100 |                   
  scene.ts         |   99.54 |    98.38 |     100 |   99.54 | 757-758           
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |   98.41 |    91.75 |     100 |   98.41 | 229-232,442       
 src/ui            |   89.34 |      100 |  66.66 |   89.34 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  GameCanvas.tsx   |    61.9 |      100 |     100 |    61.9 | 23-30             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  UserPanel.tsx    |   90.74 |      100 |   33.33 |   90.74 | 59-60,82-84       
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------
```

Exit code 0. Thresholds ≥ 80 statements/branches/functions/lines are met (frontend aggregate 95.81 / 96.54 / 96.94 / 95.81; `src/input/gestures.ts` 100 across the board). No exclusions or threshold changes.

### `npm run build --workspace @cubeclicker/frontend` (extra, not in T3 verify)

```
> build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 58 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.42 kB │ gzip:   0.28 kB
dist/assets/index-By00Pcz7.css    3.43 kB │ gzip:   1.03 kB
dist/assets/index-B2qSK0ym.js   800.59 kB │ gzip: 217.81 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options#outputmanualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

Exit code 0 (chunk-size warning predates T3 and is unchanged).

## Acceptance audit

- **AC-9 — Touch tap explodes → met.** Touch/mouse parity at 39 px and the 40 px inclusive boundary classifies as `tap` with exact NDC; the integration test carries a touch tap at the canvas centre through the real `pickMiniCube` (real camera + cube view) to `front:2:2` and explodes it on the real engine (clicks 1, tile removed, face 24 tiles). No logic change.
- **AC-10 — Touch drag does nothing → met.** A 41 px touch drag classifies as the exact same `{ kind: 'drag', axis: 'yaw', direction: 1 }` as the mouse (vertical: `{ axis: 'pitch', direction: -1 }`), carrying no pick payload. The session drops classified drags without dispatch: `session.test.ts > pointer wiring > ignores a playing drag: no rotation, no click, no publish (AC-2)` asserts snapshot identity, zero rotation, zero clicks and zero publishes; its touch helpers prove `pointerType` never participates. No rotation path was reintroduced.
- **AC-12 — No virtual joystick in v1 → met.** API-surface test: the input gesture module exports exactly `classifyPointer` with arity 3 (no pointer-type parameter, no joystick/rotate control). No UI/input module was added; `gestures.ts` gained only a doc comment, no behavior.

## Deviations from spec

- **Boundary wording vs. the accepted predecessor contract.** T3's brief (and spec AC-9's paraphrase "tap < 40 px") says 40 px should be a drag, but the retained accepted contract pins **39 px and 40 px as taps and 41 px as a drag** (`cube-tile-lines-and-controls` AC-2; landed `gestures.ts` inclusive `<=`; predecessor tests "exactly 40 px … tap (threshold inclusive)"; `plan-delta-r3` F2 records the same wording mismatch). T3 explicitly forbids logic changes, and inverting the boundary would be a behavior change outside this task and outside the retained contract. The tests therefore pin 39 px tap, **40 px tap (inclusive)**, 41 px drag, matching the landed implementation; no logic was touched. Flagged for the orchestrator in Open questions.
- **Dispatch-level touch drag identity is evidenced in `session.test.ts` (read-only), not duplicated in `gestures.test.ts`.** `session.test.ts` is outside T3's `files_owned`; its existing touch helpers and the playing-drag snapshot-identity test already exercise the session policy, and the new parity group proves touch and mouse produce the same classification there. Duplicating the ~250-line fake session environment inside `gestures.test.ts` would be redundant.
- **Removed the stale drag→rotate integration test.** It manually dispatched `rotate` for a classified drag, a behavior superseded by the retained predecessor contract; leaving it would misrepresent AC-10. Its engine-rotation coverage remains in `engine.test.ts`/`rotation.test.ts`/`keyboard.test.ts`.

## Open questions

1. **Exact-40 px boundary.** The brief's "40 px drag" (and spec AC-9's "< 40 px") conflicts with the accepted predecessor contract (40 px = tap). Which is authoritative for this feature? Candidate answers: (a) keep the landed inclusive contract — 39/40 tap, 41 drag (implemented, no logic change; recommended), or (b) change the threshold to exclusive — 39 tap, 40/41 drag — which is a logic + contract change requiring a spec/plan revision and an update to the predecessor feature, out of T3 scope.
