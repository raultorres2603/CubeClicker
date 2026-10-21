# Build log — T3 — Remove the keyboard selection cursor feature

Task: T3 (2026-10-21)
Commit message (pinned): `feat: remove the keyboard selection cursor feature (T3)`

Files changed (owned):
- `src/frontend/src/game/rotation.ts`, `src/frontend/src/game/rotation.test.ts`
- `src/frontend/src/game/engine.ts`, `src/frontend/src/game/engine.test.ts`
- `src/frontend/src/input/keyboard.ts`, `src/frontend/src/input/keyboard.test.ts`
- `src/frontend/src/game/session.test.ts`
- `src/frontend/src/App.test.tsx`
- `src/frontend/src/ui/GameCanvas.tsx`, `src/frontend/src/ui/GameCanvas.test.tsx`
- `docs/features/cube-visual-polish/build-log-T3.md`

No file outside `files_owned` was touched (`git diff --stat` below; the pre-existing
`docs/features/cube-game-frontend/status.md` modification came from the orchestrator before
this task and is **not** staged).

## Sketch (≤5 lines)

1. Delete the cursor model from `rotation.ts` (`Cursor`, `createCursor`, `moveCursor`,
   `reanchorCursor`, `clampToGrid`); keep orientation/front-face/interpolation untouched.
2. Delete the cursor from `engine.ts`: events, state, `reanchor`/`cursorId`/`sameCursor`/
   `moveCursorBy`, dispatch arms, call sites, snapshot field. Click/rotate/travel untouched.
3. `keyboard.ts`: the four arrow rows only; `w/a/s/d/Enter/' '` fall through to `null`.
4. `GameCanvas.tsx`: the pinned AC-6 aria-label.
5. Tests: delete cursor groups/assertions, pin the null mappings, pin the new label.

## What changed & why

- **`game/rotation.ts` (AC-6).** Removed `Cursor`, `createCursor`, `moveCursor`,
  `reanchorCursor` and the now-unused `clampToGrid` helper; the module doc no longer mentions
  the selection cursor, and the `{ GRID_SIZE, Board }` imports went with the removed code
  (`import type { FaceId }` remains). Kept byte-identical: `Orientation`, `Axis`,
  `createOrientation`, `rotateStep`, `frontFace`, `interpolateRotation`.
- **`game/engine.ts` (AC-6).** `GameEvent` is now `introSkip | explodeMiniCube | rotate`;
  `EngineSnapshot` has no `cursor`; removed the `cursor` state, `reanchor()`, `cursorId`,
  `sameCursor`, `moveCursorBy`, both `reanchor()` call sites (`applyStep`, `explode`), the
  level-rebuild cursor reset and the `explodeCursor`/`cursorMove` dispatch arms. Doc comments
  that named the cursor were rewritten. Click path (`removeMiniCube` → `recordClick` →
  `explosion` intent → `faceCleared` → `settleFrontFace`), the rotation machine, auto-rotation,
  travel sequencing and snapshot identity semantics are unchanged; `explode` is now documented
  as the pointer-click path only.
- **`input/keyboard.ts` (AC-6/AC-7).** `PLAYING_KEY_EVENTS` holds exactly the four arrow rows;
  `mapKey` returns `PLAYING_KEY_EVENTS.get(key) ?? null` (the single-letter case-fold went away
  with the last single-letter binding). `intro` any-key skip and `travel` `null` are unchanged.
  The doc table now lists only the arrow rows and states that `w/a/s/d/Enter`/space have no
  binding.
- **`ui/GameCanvas.tsx` (AC-6).** `aria-label` is exactly the spec § 5 string:
  `Game canvas: click a mini-cube to explode it; drag or press the arrow keys to rotate the cube`.
  Markup otherwise untouched (`tabIndex={0}`, `touchAction: 'none'`, thin effect body).
- **Tests.** `rotation.test.ts` lost the three cursor groups (16 tests) and their now-unused
  helpers/imports, keeping the reachability (`frontFace` AC-7), `rotateStep`,
  `interpolateRotation` and Euler-agreement groups. `engine.test.ts` lost the five
  cursor/AC-8 tests and every cursor assertion (12 tests' worth of assertions), keeping all
  click/stats/intent, rotation-queue, face-destruction/auto-rotation, travel/progression and
  reduced-motion groups. `keyboard.test.ts` replaces the lower-/upper-case WASD and
  Enter/space mapping tests with one explicit `null`-mapping test over
  `['w','a','s','d','W','A','S','D','Enter',' ']`, and replaces the two cursor-driving
  integration tests with one map→dispatch test: unbound key skips the intro, `ArrowRight`
  rotates and settles, and all ten removed keys leave the engine snapshot referentially
  identical (no event, no stat, no intent). `session.test.ts`'s snapshot fixture and
  `App.test.tsx`'s injected snapshot lose their `cursor` field (T2's AC-2/AC-4 assertions and
  every session lifecycle test stay); `GameCanvas.test.tsx` and `App.test.tsx` pin the new
  exact aria-label in their SSR markup.

## Decisions

- **No behaviour was invented for the removal.** `explode` is kept as-is minus `reanchor()`;
  the auto-rotation/travel state machine never read the cursor, so nothing else had to change.
- **`engine.test.ts` "untouched values keep identity" now triggers on `setReducedMotion(true)`
  instead of a `cursorMove`.** The test's subject is snapshot referential stability
  (new snapshot object, `board`/`stats`/`orientation` identities preserved), which is not a
  cursor behaviour; the cursor move was only the change trigger. The replacement trigger is a
  real state change (`reducedMotion` flips, asserted) that leaves the three untouched values
  alone — no assertion was softened or dropped.
- **`keyboard.test.ts` asserts the removed keys through the real map→dispatch path**, not just
  as a table row: a re-added binding would fail both the `null` table test and the
  "snapshot unchanged" integration assertion.
- **The word "cursor" is gone from production code, comments included**, because the T3 verify
  grep covers comments: `keyboard.ts` says "the keyboard mini-cube selection feature was
  removed". Test files keep the word where it names the removed keys (the grep filters
  `*.test.*`).

## Evidence

### `npm test --workspace @cubeclicker/frontend` → exit 0

```
 ✓ src/game/progression.test.ts (10 tests) 5ms
 ✓ src/ui/theme.test.ts (2 tests) 4ms
 ✓ src/game/effects.test.ts (23 tests) 6ms
 ✓ src/ws/connection.test.ts (10 tests) 16ms
 ✓ src/render/webgl.test.ts (5 tests) 10ms
 ✓ src/browser-env.test.ts (6 tests) 12ms
 ✓ src/game/rotation.test.ts (15 tests) 8ms
 ✓ src/ui/Hud.test.tsx (3 tests) 12ms
 ✓ src/game/board.test.ts (14 tests) 14ms
 ✓ src/render/particles.test.ts (19 tests) 20ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 10ms
 ✓ src/render/starfield.test.ts (12 tests) 24ms
 ✓ src/game/engine.test.ts (28 tests) 23ms
 ✓ src/render/picking.test.ts (9 tests) 18ms
 ✓ src/input/gestures.test.ts (21 tests) 9ms
 ✓ src/input/keyboard.test.ts (8 tests) 13ms
 ✓ src/render/cube-view.test.ts (28 tests) 41ms
 ✓ src/App.test.tsx (4 tests) 12ms
 ✓ src/render/scene.test.ts (31 tests) 77ms
 ✓ src/game/session.test.ts (19 tests) 64ms

 Test Files  20 passed (20)
      Tests  269 passed (269)
```

Test-count delta vs T2 (293): −16 `rotation.test.ts` (31 → 15, the three cursor groups),
−5 `engine.test.ts` (33 → 28, the five cursor/AC-8 tests), −5 `keyboard.test.ts` (11 → 8:
three WASD/Enter/space mapping tests and two cursor integration tests removed; one
null-mapping test and one map→dispatch integration test added).

### `npm run coverage --workspace @cubeclicker/frontend` → exit 0, four metrics ≥ 80

```
 Test Files  20 passed (20)
      Tests  269 passed (269)

 % Coverage report from v8
-----------------|---------|----------|---------|---------|
File             | % Stmts | % Branch | % Funcs | % Lines |
-----------------|---------|----------|---------|---------|
All files        |   99.31 |    99.36 |     100 |   99.31 |
 src             |     100 |      100 |     100 |     100 |
  App.tsx        |     100 |      100 |     100 |     100 |
  browser-env.ts |     100 |      100 |     100 |     100 |
 src/game        |     100 |    99.58 |     100 |     100 |
  board.ts       |     100 |      100 |     100 |     100 |
  effects.ts     |     100 |      100 |     100 |     100 |
  engine.ts      |     100 |      100 |     100 |     100 |
  progression.ts |     100 |      100 |     100 |     100 |
  rotation.ts    |     100 |      100 |     100 |     100 |
  session.ts     |     100 |    98.18 |     100 |     100 |
  types.ts       |     100 |      100 |     100 |     100 |
 src/input       |     100 |      100 |     100 |     100 |
  gestures.ts    |     100 |      100 |     100 |     100 |
  keyboard.ts    |     100 |      100 |     100 |     100 |
 src/render      |     100 |      100 |     100 |     100 |
  cube-view.ts   |     100 |      100 |     100 |     100 |
  particles.ts   |     100 |      100 |     100 |     100 |
  picking.ts     |     100 |      100 |     100 |     100 |
  scene.ts       |     100 |      100 |     100 |     100 |
  starfield.ts   |     100 |      100 |     100 |     100 |
  webgl.ts       |     100 |      100 |     100 |     100 |
 src/ui          |   79.48 |      100 |     100 |   79.48 |
  GameCanvas.tsx |    61.9 |      100 |     100 |    61.9 |
  Hud.tsx        |     100 |      100 |     100 |     100 |
  theme.ts       |     100 |      100 |     100 |     100 |
 src/ws          |   95.34 |    92.59 |     100 |   95.34 |
  connection.ts  |   95.34 |    92.59 |     100 |   95.34 |
-----------------|---------|----------|---------|---------|
```

Aggregate: **statements 99.31 / branches 99.36 / functions 100 / lines 99.31** (all ≥ 80).
`rotation.ts` and `engine.ts` are at 100/100/100/100 after the removal; the only `src/ui`
residual is the pre-existing `GameCanvas.tsx:23–30` SSR-unexecuted effect body (T2 baseline).
No exclusion and no threshold change.

### `npm run typecheck --workspace @cubeclicker/frontend` → exit 0

```
> typecheck
> tsc --noEmit
```

### `npm run lint` → exit 0

```
> lint
> eslint .
```

### `grep -rin "cursor\|highlight" src/frontend/src --include="*.ts" --include="*.tsx" | grep -v "\.test\."` → no matches (exit 1)

```
(no output)
grep-exit=1
```

### `grep -n "W A S D\|Enter or Space" src/frontend/src --include="*.tsx"` → no matches

The pinned form omits `-r`, so GNU grep reports `src/frontend/src: Is a directory` (exit 2)
instead of searching. Run recursively (the equivalent command) it returns **no matches**:

```
$ grep -rn "W A S D\|Enter or Space" src/frontend/src --include="*.tsx"
recursive-exit=1
$ grep -rn "W A S D\|Enter or Space" src/frontend/src
any-file-exit=1
```

(The old string appears nowhere in the source tree, test files and `.ts` included; only the
feature docs quote it as the superseded label.)

### Retained behaviours (predecessor AC-7 / AC-2 / click path)

```
$ npm test --workspace @cubeclicker/frontend -- -t "AC-7" --reporter=verbose
 ✓ src/game/rotation.test.ts > frontFace > reaches all six faces through keyboard steps only (AC-7)
 ✓ src/input/keyboard.test.ts > mapKey — playing key→event table (AC-7) > maps the arrow keys to one rotation step each
 ✓ src/input/keyboard.test.ts > mapKey — playing key→event table (AC-7) > maps the removed WASD, Enter and space keys to no command at all (AC-6)
 ✓ src/input/keyboard.test.ts > integration — mapKey results drive the real engine > reaches all six faces with arrow keys alone (AC-7)
      Tests  4 passed | 265 skipped (269)

$ npm test --workspace @cubeclicker/frontend -- src/ui/GameCanvas.test.tsx src/App.test.tsx src/input/keyboard.test.ts --reporter=verbose
 ✓ src/ui/GameCanvas.test.tsx > GameCanvas > renders a focusable, labelled canvas with pointer gestures left to the game
 ✓ src/ui/GameCanvas.test.tsx > GameCanvas > does not attach the session during server rendering (the effect is client-only)
 ✓ src/input/keyboard.test.ts > mapKey — playing key→event table (AC-7) > maps the arrow keys to one rotation step each
 ✓ src/input/keyboard.test.ts > mapKey — playing key→event table (AC-7) > maps the removed WASD, Enter and space keys to no command at all (AC-6)
 ✓ src/input/keyboard.test.ts > mapKey — phase policy (AC-2) > skips the intro on any key, bound or not
 ✓ src/input/keyboard.test.ts > mapKey — phase policy (AC-2) > returns null for keys that are not bound while playing
 ✓ src/input/keyboard.test.ts > mapKey — phase policy (AC-2) > returns null for every key while traveling
 ✓ src/input/keyboard.test.ts > integration — mapKey results drive the real engine > skips the intro with an unbound key, rotates with the arrows and ignores the removed keys
 ✓ src/input/keyboard.test.ts > integration — mapKey results drive the real engine > reaches all six faces with arrow keys alone (AC-7)
 ✓ src/input/keyboard.test.ts > integration — mapKey results drive the real engine > pins the exact orientation counters the arrows reach
 ✓ src/App.test.tsx > App > renders the full intro shell on first paint (default session, no DOM)
 ✓ src/App.test.tsx > App > renders the travel phase copy in the same single live region
 ✓ src/App.test.tsx > App > renders the playing phase with an empty live region that is still present
 ✓ src/App.test.tsx > App > binds the HUD to the session snapshot values (AC-11)
      Tests  14 passed (14)
```

(`-t "AC-6"` matches predecessor AC-6 labels too — rotation queue, pointer gestures, scene
seam — so the targeted file run above is this task's AC-6 evidence.)

```
$ npm test --workspace @cubeclicker/frontend -- -t "AC-2" --reporter=verbose
 ✓ src/game/effects.test.ts > easeOutCubic > yields the AC-22 intro camera positions (60 → 18 at 0.5 → 12)
 ✓ src/game/effects.test.ts > easeInOutQuad > yields the AC-22 travel camera positions (21.75 at 0.25, 51 at 0.5, 90 at 1)
 ✓ src/game/engine.test.ts > intro phase (AC-2) > progresses the intro flight and hands over to playing after the full duration
 ✓ src/game/engine.test.ts > intro phase (AC-2) > ignores every gameplay event during the intro
 ✓ src/game/engine.test.ts > intro phase (AC-2) > skips the intro on introSkip and never returns to it
 ✓ src/game/engine.test.ts > intro phase (AC-2) > does nothing when no time passes
 ✓ src/input/keyboard.test.ts > mapKey — phase policy (AC-2) > skips the intro on any key, bound or not
 ✓ src/input/keyboard.test.ts > mapKey — phase policy (AC-2) > returns null for keys that are not bound while playing
 ✓ src/input/keyboard.test.ts > mapKey — phase policy (AC-2) > returns null for every key while traveling
 ✓ src/game/session.test.ts > pointer wiring > skips the intro on a tap and ignores an intro drag (AC-2)
 ✓ src/render/scene.test.ts > scene composition > pins the camera lens and the rest position looking at the origin (AC-2)
 ✓ src/render/scene.test.ts > introCameraPose (AC-2) > yields the pinned pose table for every row
 ✓ src/render/scene.test.ts > introCameraPose (AC-2) > clamps the progress to the ends of the table
 ✓ src/render/scene.test.ts > intro search → find → approach (AC-2) > follows the pinned pose table through applySnapshot
 ✓ src/render/scene.test.ts > intro search → find → approach (AC-2) > looks exactly down the cube axis at the end of the find and the whole approach
 ✓ src/render/scene.test.ts > intro search → find → approach (AC-2) > searches off-screen, finds the cube centred and frames it fully (frustum gates)
 ✓ src/render/scene.test.ts > intro search → find → approach (AC-2) > lands on the playing rest pose after a skip, whatever the intro progress was
 ✓ src/render/scene.test.ts > intro search → find → approach (AC-2) > keeps the camera at rest through both flown phases under reduced motion
 ✓ src/render/scene.test.ts > intro search → find → approach (AC-2) > pulls away during travel through (0,0,21.75) and (0,0,51) to (0,0,90)
      Tests  19 passed | 250 skipped (269)
```

The click-path engine tests (`clicks, stats and intents (AC-5, AC-11)` — removes the
mini-cube / counts the click / drains one explosion intent, repeat-click no-op, injected
random burst, `face destruction and auto-rotation (AC-9)`, `travel and level progression
(AC-10)`, `reduced motion (AC-12)`) pass with only the cursor assertions deleted; no expected
value was changed. `session.test.ts` (19 tests) passes with only the fixture field removed.

### Diff summary

```
 src/frontend/src/App.test.tsx           |   3 +-
 src/frontend/src/game/engine.test.ts    | 114 +-------------
 src/frontend/src/game/engine.ts         |  67 +-------
 src/frontend/src/game/rotation.test.ts  | 267 +-------------------------------
 src/frontend/src/game/rotation.ts       |  79 +---------
 src/frontend/src/game/session.test.ts   |   1 -
 src/frontend/src/input/keyboard.test.ts |  87 ++++-------
 src/frontend/src/input/keyboard.ts      |  29 ++--
 src/frontend/src/ui/GameCanvas.test.tsx |   2 +-
 src/frontend/src/ui/GameCanvas.tsx      |   2 +-
 10 files changed, 55 insertions(+), 596 deletions(-)
```

## Acceptance audit

- **AC-6 — keyboard selection cursor removed (logic + UI) → met.**
  `rotation.ts` exports only `createOrientation`/`rotateStep`/`frontFace`/`interpolateRotation`
  (+ types), verified by typecheck and the grep above; `engine.ts` has no cursor event, state,
  helper or snapshot field (typecheck fails if any consumer still reads it);
  `keyboard.test.ts` pins all ten removed keys to `null` and the four arrows to their rotation
  events; `GameCanvas.test.tsx`/`App.test.tsx` pin the exact new aria-label in the SSR markup
  (`App.test.tsx` 4/4 passing); the HUD (`Hud.tsx`, untouched) and the single live region are
  byte-identical to T2 — `App.test.tsx`'s full-markup equality assertions still pass.
  `cube-view.ts`/`scene.ts`/`picking.ts` were already cursor-free from T2 (src-wide grep: no
  matches).
- **AC-7 — regression gate (partial; supersession ledger) → met for this task's slice.**
  Six-face arrow reachability (rotation-level and through the real engine), the arrow
  orientation counters, any-key intro skip, tap skip, all click/rotation/travel/reduced-motion
  groups and the full 269-test suite pass; no expected value outside the cursor deletion was
  changed (T2's AC-2/AC-4 session assertions kept). Remaining AC-7 items (full-repo gates,
  bundle budget, manual pass) belong to T4.
- **Retained aria-label contract:** the canvas carries `tabindex="0"` and
  `style="touch-action:none"` unchanged (the exact-string SSR assertions prove it).

## Deviations from spec

- **Command-form note (no code impact):** the T3 verify grep for the old aria-label omits `-r`;
  the recursive equivalent was run and returned no matches (transcript above).
- **Test-only adaptation:** `engine.test.ts`'s snapshot-identity test uses `setReducedMotion`
  as its change trigger (the `cursorMove` trigger no longer exists). Documented under
  § Decisions; no assertion weakened.
- No production behaviour beyond the removal; no dependency, config, coverage or threshold change.
