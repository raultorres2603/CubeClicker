# Build log — T4 — Responsive HUD & panel placement

Task: T4 (2026-10-25) — `docs/features/fullscreen-responsive-layout/tasks.md`
Files changed:
- `src/frontend/src/ui/Hud.tsx`
- `src/frontend/src/ui/Hud.test.tsx`
- `src/frontend/src/ui/UserPanel.tsx`
- `src/frontend/src/ui/ConnectionBanner.tsx`
- `docs/features/fullscreen-responsive-layout/build-log-T4.md`
- `docs/features/fullscreen-responsive-layout/tasks.md`

## Sketch (≤ 5 lines, written before the code; kept from the first T4 attempt)

1. Confirm T1's `app.css` selectors already match the markup (`main > section`, `.connection-banner button`, `.user-panel > button`, `.user-panel`); no class/wrapper change is needed (and any markup change would break the read-only `App.test.tsx` SSR strings).
2. Document the responsive overlay contract in each component's doc comment (absolute overlay, safe-area offsets, `pointer-events`, 44 px hooks, portrait/landscape neutral).
3. `Hud.test.tsx`: pin the section root / no inline style / no interactive descendants, plus a composed HUD → banner → panel order with no `z-index`/inline layout.
4. `UserPanel.test.tsx`: pin the `.user-panel` clamp class, direct-child controls, and absence of inline widths/orientation.
5. `ConnectionBanner.test.tsx`: pin Retry as the sole direct button, non-interactive states without a button, and no inline style/safe-area override; run lint/typecheck/test/coverage.

## What changed & why

- **`Hud.tsx`, `UserPanel.tsx`, `ConnectionBanner.tsx` — doc comments only; no markup/class/behavior change.** Each comment now records the contract T1's `app.css` relies on: absolute overlay root, safe-area inset ownership, the `pointer-events` split, and the 44 px direct-child hooks.
- **`Hud.test.tsx` — three contract tests added.** They pin the markup T1's selectors target (bare `main > section`, `.connection-banner`, `.user-panel`), prove the overlays add no inline layout/`z-index` and no second live region.
- **No `app.css`, `App.tsx`, `index.html`, backend, gesture, session or renderer edits.** T1 owns all CSS; this task verifies the contract through component markup only.
- No markup change means the read-only `App.test.tsx` exact SSR strings stay green.

## Prior-attempt reconciliation (working tree inspection before finishing)

`git status` showed unstaged changes only in `Hud.tsx`, `Hud.test.tsx`, `UserPanel.tsx`, `UserPanel.test.tsx`; no T4 commit existed and `tasks.md` still had T4 `[>]`.

- **Kept:** the `Hud.tsx` / `UserPanel.tsx` doc comments (accurate, no behavior change).
- **Rewritten:** the `Hud.test.tsx` additions. The first attempt's `shell overlay stacking` test rendered `Hud`, `ConnectionBanner` and `UserPanel` in an order the test itself authored and then asserted that order — a tautology, not a production behavior. It was replaced with three contract tests that can each fail on a real regression (class/style added, interactive descendant added, wrapper/direct-child structure changed).
- **Reverted:** the `UserPanel.test.tsx` additions. The file is not in T4's `files_owned`, and its existing tests already pin the **entire** closed/open panel markup with `toBe`, including `.user-panel`, direct button children and the absence of inline attributes. The additions were redundant, so no scope exception is needed in the final change.
- **Not needed:** `ConnectionBanner.test.tsx` edits. Its existing `toBe` cases already pin `Retry` as the sole direct `<button>` child of `.connection-banner` and the non-interactive states without a button; the component only gained a doc comment.

## Markup ↔ CSS contract (evidence)

| Contract | `app.css` rule | Component/markup evidence |
| --- | --- | --- |
| HUD absolute overlay | `main > section` — `position: absolute` (line 68), safe-area `top`/`left` (lines 69–70) | `Hud` renders the bare `<section aria-label="Game statistics">` with no class/style (`responsive overlay contract` test 1) |
| Banner absolute overlay | `.connection-banner` — `position: absolute` (127), safe-area `top` (128), `pointer-events: none` (142) | `ConnectionBanner` renders `<div class="connection-banner">` (`renders the exhausted copy…`, new test 3) |
| Banner tap target | `.connection-banner button` — `pointer-events: auto` (146), `min-width/min-height: 44px` (163–164) | `Retry` is a direct `<button>` child (existing + new exact `toBe`) |
| Users panel absolute overlay + clamp | `.user-panel` — `position: absolute` (151), safe-area `top`/`right` (152–153), `max-width: min(...)` (158) | `UserPanel` root class is exactly `user-panel` (existing exact `toBe` + new test 3) |
| Panel tap targets | `.user-panel > button` — `min-width/min-height: 44px` (163–164) | `Users on Server` and `Return to my cube` are direct `<button>` children (new test 3) |
| Pass-through overlays | `pointer-events: none` on HUD (81) and banner (142) | HUD has no interactive descendants (new test 2); banner only re-enables `Retry` |
| No stacking override | no `z-index` anywhere in `app.css` (`grep` exit 1) | no component renders `z-index` (new tests) |
| Safe-area ownership stays in CSS | `env(safe-area-inset-*)` lines 69–70, 102, 128, 152–153, 158 | no owned component renders `style=` (`grep` exit 1; new tests) |
| No orientation lock | not applicable (`index.html` unchanged) | `grep -n "orientation" src/frontend/index.html` → no match |

## Tests added (concrete values only)

New in `src/frontend/src/ui/Hud.test.tsx`:

- `"responsive overlay contract > renders the HUD as the bare main > section overlay with no inline layout (AC-4, AC-5)"` — props `stats { clicks: 5, facesDestroyed: 2 }`, `levelIndex 1`, `serverId 4`; asserts the exact prefix `<section aria-label="Game statistics">` and the absence of `class=`, `style=`, `z-index`, `width=`, `height=`.
- `"responsive overlay contract > has no interactive descendants, so pointer-events: none passes gestures to the canvas (AC-4)"` — props `stats { clicks: 3, facesDestroyed: 1 }`, `levelIndex 2`, `serverId 7`; asserts no `<button`, `<a `, `tabindex`, `role=` or `aria-live` in the HUD markup.
- `"responsive overlay contract > keeps the banner and panel selector hooks with the tap targets as direct children (AC-4, AC-5, AC-13)"` — banner `status="exhausted"` renders exactly `<div class="connection-banner"><span>Connection lost</span><button type="button">Retry</button></div>`; panel `welcomed`, `selfName="Player 1"`, `members=[]`, `spectating` renders exactly `<div class="user-panel"><button type="button" aria-expanded="false">Users on Server</button><button type="button">Return to my cube</button></div>`; both are checked for the absence of `style=`, `z-index`, `width=`, `height=`, `role=`, `aria-live`.

Existing (read-only) evidence relied upon:

- `UserPanel.test.tsx` (6 tests) — exact `toBe` markup for closed/open/spectating states; pins `.user-panel`, direct controls, `aria-expanded`, `aria-label="Users on server"`.
- `ConnectionBanner.test.tsx` (5 tests) — exact `toBe` markup per status; pins `Retry` as the sole direct button and no live-region semantics.
- `App.test.tsx` (9 tests) — exact shell markup: `<canvas tabindex="0" aria-label="…">`, exactly one `role="status" aria-live="polite"` region in every phase, exact overlay order/composition unchanged.
- `Hud.test.tsx` existing 3 tests — exact HUD markup and no live-region semantics.

Weak/snapshot assertions in the new content: **none** — no `expect.anything()`, `expect.any()`, `objectContaining`/`arrayContaining`/`stringContaining`, `toMatchObject`, snapshots or assertion-free tests. No bounded exception used.

## Evidence

### `npm run lint`

```
> lint
> eslint .

npm notice
npm notice New major version of npm available! 11.19.1 -> 12.2.1
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.1
npm notice To update run: npm install -g npm@12.2.1
npm notice
```

Exit code 0 (the npm update notice is environment noise, not a lint diagnostic).

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

 ✓ src/game/progression.test.ts (10 tests) 9ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 10ms
 ✓ src/ui/theme.test.ts (2 tests) 4ms
 ✓ src/game/effects.test.ts (28 tests) 10ms
 ✓ src/multiplayer/protocol.test.ts (112 tests) 24ms
 ✓ src/ws/connection.test.ts (10 tests) 14ms
 ✓ src/render/webgl.test.ts (5 tests) 10ms
 ✓ src/multiplayer/server-state.test.ts (40 tests) 16ms
 ✓ src/browser-env.test.ts (6 tests) 17ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 20ms
 ✓ src/game/rotation.test.ts (15 tests) 6ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 6ms
 ✓ src/game/board.test.ts (18 tests) 23ms
 ✓ src/render/particles.test.ts (19 tests) 22ms
 ✓ src/game/engine.test.ts (71 tests) 53ms
 ✓ src/input/keyboard.test.ts (13 tests) 12ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 13ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 10ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 17ms
 ✓ src/render/cube-view.test.ts (32 tests) 75ms
 ✓ src/render/picking.test.ts (12 tests) 33ms
 ✓ src/render/starfield.test.ts (15 tests) 96ms
 ✓ src/ui/Hud.test.tsx (6 tests) 19ms
 ✓ src/input/gestures.test.ts (27 tests) 19ms
 ✓ src/render/world.test.ts (27 tests) 67ms
 ✓ src/App.test.tsx (9 tests) 19ms
 ✓ src/render/scene.test.ts (69 tests) 158ms
 ✓ src/game/session.test.ts (52 tests) 138ms

 Test Files  28 passed (28)
      Tests  655 passed (655)
   Start at  12:19:58
   Duration  910ms (transform 3.59s, setup 0ms, collect 9.05s, tests 919ms, environment 5ms, prepare 2.86s)
```

Exit code 0. Baseline before T4: 652 tests (T3 log); `Hud.test.tsx` 3 → 6 tests (+3), all other suites unchanged.

### `npm run coverage --workspace @cubeclicker/frontend`

```
> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/multiplayer/protocol.test.ts (112 tests) 15ms
 ✓ src/ui/theme.test.ts (2 tests) 4ms
 ✓ src/game/effects.test.ts (28 tests) 11ms
 ✓ src/multiplayer/server-state.test.ts (40 tests) 12ms
 ✓ src/ws/connection.test.ts (10 tests) 19ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 11ms
 ✓ src/game/progression.test.ts (10 tests) 10ms
 ✓ src/browser-env.test.ts (6 tests) 12ms
 ✓ src/game/board.test.ts (18 tests) 29ms
 ✓ src/game/rotation.test.ts (15 tests) 7ms
 ✓ src/render/webgl.test.ts (5 tests) 10ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 13ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 9ms
 ✓ src/input/keyboard.test.ts (13 tests) 11ms
 ✓ src/game/engine.test.ts (71 tests) 61ms
 ✓ src/ui/UserPanel.test.tsx (6 tests) 13ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 12ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 15ms
 ✓ src/render/cube-view.test.ts (32 tests) 46ms
 ✓ src/render/particles.test.ts (19 tests) 24ms
 ✓ src/input/gestures.test.ts (27 tests) 19ms
 ✓ src/ui/Hud.test.tsx (6 tests) 21ms
 ✓ src/render/picking.test.ts (12 tests) 42ms
 ✓ src/render/starfield.test.ts (15 tests) 122ms
 ✓ src/render/world.test.ts (27 tests) 91ms
 ✓ src/App.test.tsx (9 tests) 29ms
 ✓ src/render/scene.test.ts (69 tests) 178ms
 ✓ src/game/session.test.ts (52 tests) 171ms

 Test Files  28 passed (28)
      Tests  655 passed (655)
   Start at  12:20:03
   Duration  1.06s (transform 2.98s, setup 0ms, collect 8.25s, tests 1.02s, environment 6ms, prepare 3.12s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.81 |    96.53 |   96.94 |   95.81 |
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
  UserPanel.tsx    |   90.74 |      100 |   33.33 |   90.74 | 66-67,89-91
  theme.ts         |     100 |      100 |     100 |     100 |
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100
-------------------|---------|----------|---------|---------|-------------------
```

Exit code 0. Frontend workspace aggregate: **95.81 statements / 96.53 branches / 96.94 functions / 95.81 lines** — all ≥ 80. No exclusions or thresholds changed. The 0.01 branch delta vs. T3 (96.54) is V8 noise; no production code changed in T4.

Root gate (extra evidence, both workspaces): `npm run coverage` → exit 0; backend **98.64 / 97.4 / 100 / 98.64**, frontend **95.81 / 96.53 / 96.94 / 95.81**; backend 208 tests, frontend 655 tests, all passed.

## Acceptance audit

- **AC-4 — Overlaid HUD/panels → met.** `app.css` keeps all three overlays absolutely positioned (`main > section` line 68, `.connection-banner` 127, `.user-panel` 151) with no `z-index`; HUD and banner are `pointer-events: none` (81, 142) with `pointer-events: auto` only on `.connection-banner button` (146). New tests pin the HUD section with no class/inline layout and no interactive descendants, and pin `Retry`, `Users on Server` and `Return to my cube` as direct children of their overlay roots. Existing `App.test.tsx` exact shell markup stays green, proving the overlays do not enter the canvas DOM flow; `main` keeps `overflow: hidden` (47).
- **AC-5 — Safe-area insets → met.** CSS owns every inset: HUD `top/left` (69–70), phase `bottom` (102), banner `top` (128), panel `top/right` (152–153) and the panel `max-width` clamp (158). The new tests prove no component adds an inline `style=` or layout attribute that could override those rules; the workspace is SSR-only, so computed notched-device layout remains the T5 manual inspection recorded in the spec's testing strategy.
- **AC-13 — Tap targets ≥ 44 px → met.** `app.css` applies `min-width: 44px; min-height: 44px` (163–164) to `.user-panel > button` and `.connection-banner button`. The three controls are pinned as direct children with exact markup: `Users on Server`, `Return to my cube` (new test 3) and `Retry` (existing `ConnectionBanner.test.tsx` + new test 3). No markup change was needed.
- **AC-14 — Accessibility retained → met.** `App.test.tsx` (read-only, 9 tests green) pins the focusable canvas (`tabindex="0"`), its stable aria-label, exactly one `role="status" aria-live="polite"` region in `intro`/`travel`/`playing`, and the empty-but-present playing region. The new tests assert the overlays contribute no `role=`/`aria-live`, so the single region stays unique. `index.html` has no `orientation` lock (`grep` exit 1) and no reduced-motion code was touched.

## Deviations from spec

None in the final change: no markup/class changes, no `app.css` edits, no behavior changes, no new dependencies. `UserPanel.test.tsx`, `ConnectionBanner.test.tsx` and `App.test.tsx` were not edited.

## Open questions

1. **AC-4 wording vs. the users panel hit area.** HUD and banner are pass-through (`pointer-events: none`) and only `Retry` re-enables events. `.user-panel` itself has no `pointer-events: none`; its container is the interactive control surface, so only its buttons handle events but the panel box is in the hit-test path. T1 owns `app.css`, so T4 did not change it. Candidates: (a) accept the landed CSS — the panel is the interactive overlay, not a pass-through label (implemented; recommended), or (b) a T1 follow-up adding `.user-panel { pointer-events: none; }` + `.user-panel button { pointer-events: auto; }`, which changes panel-gap behavior and needs its own verification.
2. **Branch.** The working branch is `main`, which already holds the T1–T3 commits; T4 is committed there per the task brief's "current feature branch". If the workflow requires `feat/fullscreen-responsive-layout`, the branch move is an orchestrator-level decision (no history rewrite was attempted).

## DoD self-audit

- [x] AC-4, AC-5, AC-13, AC-14 audited with evidence (above)
- [x] `verify` commands pass: lint, frontend typecheck, frontend tests, frontend coverage
- [x] Unit + integration tests: SSR component tests (integration through `react-dom/server`) added; no behavior change outside the tested contract
- [x] Coverage gate green (frontend 95.81 / 96.53 / 96.94 / 95.81; root gate also green)
- [x] Concrete assertions only; no banned wildcard matchers, snapshots or assertion-free tests
- [x] No useless tests: each new test fails on a concrete regression (class/style/z-index added, interactive descendant added, overlay wrapper/direct-child changed)
- [x] `build-log-T4.md` contains raw evidence
- [x] Committed on the current branch with a conventional message; not pushed
- [x] `files_owned` respected: only `Hud.tsx`, `Hud.test.tsx`, `UserPanel.tsx`, `ConnectionBanner.tsx` plus T4 docs
