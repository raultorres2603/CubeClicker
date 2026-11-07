# Build log — T8 — App shell integration

Task: T8 (2026-11-07)

Files changed:
- `src/frontend/src/App.tsx`
- `src/frontend/src/App.test.tsx`
- `docs/features/reference-image-game-view/build-log-T8.md` (this file)

## Sketch (≤5 lines)

- Import `./ui/game-view.css` immediately after `./ui/app.css` so the reference HUD chrome wins the cascade.
- Add `data-customization-open={customizationOpen ? 'true' : 'false'}` to the game-shell `<main>` only (never the email-verification branch) so T2's `main[data-customization-open='true'] .upgrades-panel { display: none; }` rule is state-driven.
- Replace the inline customization `<button>` with `<CustomizationToggle open={customizationOpen} onToggle={() => setCustomizationOpen((value) => !value)} />`.
- Rebuild `App.test.tsx`'s `shellHtml`/panel constants with the exact T4–T7 icon markup, classes and `upgrade-buy` control; keep every behavioral test.
- Add integration coverage for the attribute flip and the verify-route exclusion; no engine/session change.

## What changed & why

- `App.tsx` now imports the gameplay stylesheet directly after `app.css` (AC-2/AC-3 cascade), renders the same `customizationOpen` state through the new presentational `CustomizationToggle` (AC-7), and exposes that state on the shell `<main>` as `data-customization-open="true|false"` (AC-18). The email-verification `<main>` stays untouched.
- `App.test.tsx`'s full-shell goldens were rebuilt for the T4/T5/T6/T7 markup: the HUD golden now pins the five `p.hud-row[data-row]` rows with their exact icons and the trailing `Toggle HUD` button; the users badge pins `class="users-badge"` + the `group` icon; the upgrades panel pins `class="upgrade-row"`/`upgrade-buy` rows with per-row icons and the cost `diamond`; the customization toggle pins both icons and `aria-expanded`. `data-mode="guest"` and the `disabled=""` affordability state are derived from the shell's real props.
- New tests: (1) a source guard that `App.tsx` imports `./ui/app.css` immediately followed by `./ui/game-view.css` (AC-2); (2) a jsdom integration test that drives the toggle and asserts `data-customization-open` and `aria-expanded` flip `false → true → false` while `.customization-panel` mounts/unmounts (AC-7/AC-18); (3) an SSR assertion that the verify route has no `data-customization-open` attribute (AC-18 boundary).
- The two stale HUD assertions in the snapshot-binding test now pin the full HUD row markup (icon + label + value), and the "`hidden`" check on the playing live region was replaced with the exact live-region markup (the old `not.toContain('hidden')` would now collide with the icons' `aria-hidden="true"`).
- No engine, session, transport, CSS, component or configuration change.

## Decisions

- **Attribute is always rendered on the game shell.** `data-customization-open` is emitted as `"false"`/`"true"` (never omitted) so the selector matches deterministically in every shell state; the verification branch does not render it.
- **Goldens stay literal.** The shell helper composes the exact SVG/button strings (copied from the owning component tests) rather than re-rendering the components, so a markup regression in any T4–T7 component fails `App.test.tsx` instead of silently matching itself.
- **One source-read guard only.** The CSS import-order assertion reads `src/App.tsx` via the frontend workspace cwd because Vitest runs this jsdom file with an http-style module URL (`readFileSync(new URL(...))` throws `The URL must be of scheme file` in jsdom).
- **No redundant order test.** The exact `toBe(shellHtml(...))` goldens already pin the four gameplay surfaces' classes and their rendered order (`hud-panel` → `users-badge` → `upgrades-panel` → `customization-toggle` → `phase-announcement`), so no duplicate assertion test was added.

## Evidence

Environment: repository root `/var/home/raultorraco/Documents/Projects/CubeClicker`; frontend workspace `@cubeclicker/frontend`. Concurrent workers were active: T13 (`feat: bevel mini-cube tiles`) and T14 (`feat: tint cue spark bursts gold`) landed during verification; T10's `cosmic-backdrop.ts`/test were untracked in the worktree; T11 had not yet updated the `scene.test.ts` style-0 palette literals. Only the two owned source files and this log were staged.

### `npm run lint` — exit 0

```text
> lint
> eslint .

LINT_EXIT=0
```

### `npm run typecheck` — exit 0

```text
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

### `npm test --workspace @cubeclicker/frontend -- src/App.test.tsx` — exit 0 (26/26 green)

```text
> test
> vitest run src/App.test.tsx


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/App.test.tsx (26 tests) 467ms

 Test Files  1 passed (1)
      Tests  26 passed (26)
   Start at  21:49:15
   Duration  1.63s (transform 357ms, setup 0ms, collect 589ms, tests 467ms, environment 357ms, prepare 58ms)

FOCUSED_EXIT=0
```

### `npm test --workspace @cubeclicker/frontend` — exit 1 (only the T11 known-red palette literal; `App.test.tsx` green)

```text
 ✓ src/App.test.tsx (26 tests) 479ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/render/scene.test.ts > intent application > exposes the live cube view through the rebuild-aware accessor (AC-16)
AssertionError: expected '0a2418' to be '0b0b12' // Object.is equality

Expected: "0b0b12"
Received: "0a2418"

 ❯ src/render/scene.test.ts:1596:82
    1594|     // The accessor answers with the cube view the scene holds right n…
    1595|     expect(initial.group).toBe(cubeGroup(view));
    1596|     expect((initial.body.material as MeshStandardMaterial).color.getHe…
       |                                                                                  ^
    1597| 
    1598|     // `levelChanged` alone is pending; the snapshot performs the rebu…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯

 Test Files  1 failed | 52 passed (53)
      Tests  1 failed | 1305 passed (1306)
   Start at  21:49:28
TEST_EXIT=1
```

This is the exact known in-flight T11 debt: `tasks.md` T11 updates the two style-0 body literals at `scene.test.ts:1596` and `scene.test.ts:1623` from `0b0b12` to `0a2418`. The test aborts on the first assertion, so line 1623 is masked. No failure names `App.test.tsx` or any file owned by T8.

Supplementary run excluding only the T11 file (proves the rest of the workspace, including this task, is green):

```text
$ npm test --workspace @cubeclicker/frontend -- --exclude src/render/scene.test.ts

 ✓ src/App.test.tsx (26 tests) 823ms

 Test Files  52 passed (52)
      Tests  1229 passed (1229)
EXCLUDE_EXIT=0
```

### `npm run coverage --workspace @cubeclicker/frontend -- --coverage.reportOnFailure=true --coverage.reportsDirectory=/tmp/opencode/t8/coverage-report` — thresholds green; exit 1 only from the same T11 failure

The isolated `--coverage.reportsDirectory` avoids the shared `src/frontend/coverage/.tmp` race documented in `build-log-T6.md`/`build-log-T7.md`; thresholds and exclusions are unchanged.

```text
 Test Files  1 failed | 52 passed (53)
      Tests  1 failed | 1305 passed (1306)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |    95.6 |     95.3 |   96.55 |    95.6 |
 src               |   84.16 |     79.5 |    92.1 |   84.16 |
  App.tsx          |   83.33 |    77.39 |    92.3 |   83.33 | ...03,417-419,505
  browser-env.ts   |   91.66 |      100 |   91.66 |   91.66 | 69-72
 src/auth          |   96.81 |    86.56 |   96.15 |   96.81 |
  api.ts           |   96.33 |    88.29 |     100 |   96.33 | ...54-155,163,209
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193
 src/game          |   95.44 |    99.68 |   98.75 |   95.44 |
  board.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  effects.ts       |     100 |      100 |     100 |     100 |
  engine.ts        |    99.7 |      100 |     100 |    99.7 | 882-883
  parts.ts         |     100 |      100 |     100 |     100 |
  progression.ts   |     100 |      100 |     100 |     100 |
  rotation.ts      |     100 |      100 |     100 |     100 |
  session.ts       |   89.85 |    99.61 |   96.55 |   89.85 | ...1140,1153-1154
  types.ts         |     100 |      100 |     100 |     100 |
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
 src/input         |     100 |      100 |     100 |     100 |
  gestures.ts      |     100 |      100 |     100 |     100 |
  keyboard.ts      |     100 |      100 |     100 |     100 |
 src/multiplayer   |   92.47 |    96.05 |   95.71 |   92.47 |
  protocol.ts      |   87.09 |     94.9 |   89.28 |   87.09 | ...94-905,909-919
  server-state.ts  |   98.15 |    95.04 |     100 |   98.15 | ...16,318-319,377
  spectate.ts      |     100 |      100 |     100 |     100 |
  transport.ts     |   97.95 |      100 |     100 |   97.95 | 176-178,196
 src/render        |   98.88 |    96.56 |   98.55 |   98.88 |
  ...round-life.ts |     100 |      100 |     100 |     100 |
  ...c-backdrop.ts |   99.28 |    95.83 |     100 |   99.28 | 380-381
  cube-view.ts     |     100 |      100 |     100 |     100 |
  nebula.ts        |     100 |      100 |     100 |     100 |
  particles.ts     |     100 |      100 |     100 |     100 |
  picking.ts       |     100 |      100 |     100 |     100 |
  ...processing.ts |     100 |      100 |     100 |     100 |
  scene.ts         |   97.41 |    96.17 |   94.73 |   97.41 | ...95-896,920-921
  spaceship.ts     |   98.25 |    94.54 |     100 |   98.25 | ...44,360,380,391
  ...ate-travel.ts |     100 |      100 |     100 |     100 |
  starfield.ts     |     100 |      100 |     100 |     100 |
  webgl.ts         |     100 |      100 |     100 |     100 |
  world.ts         |   98.41 |    91.75 |     100 |   98.41 | 229-232,442
 src/ui            |   96.45 |    97.26 |   88.67 |   96.45 |
  AuthForms.tsx    |     100 |    99.09 |     100 |     100 | 219
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |
  ...ionToggle.tsx |     100 |      100 |     100 |     100 |
  GameCanvas.tsx   |   90.47 |      100 |     100 |   90.47 | 25-26
  Hud.tsx          |     100 |      100 |     100 |     100 |
  ...tionPanel.tsx |   81.17 |    68.75 |      50 |   81.17 | 45-50,52-57,96-99
  ...ipPreview.tsx |   93.75 |      100 |     100 |   93.75 | 18-19
  ...adesPanel.tsx |     100 |      100 |     100 |     100 |
  UserPanel.tsx    |   91.07 |      100 |   66.66 |   91.07 | 69-70,93-95
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |
  icons.tsx        |     100 |      100 |     100 |     100 |
  theme.ts         |     100 |      100 |     100 |     100 |
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100
-------------------|---------|----------|---------|---------|-------------------
```

All four aggregate metrics clear the ≥ 80 gate (95.6 statements / 95.3 branches / 96.55 functions / 95.6 lines); no threshold shortfall is reported. `COVERAGE_EXIT=1` is solely the T11 `scene.test.ts:1596` failure above.

## Acceptance audit

- **AC-2 → met.** `App.tsx` imports `./ui/app.css` then `./ui/game-view.css` contiguously; `App.test.tsx` asserts that exact import pair (`imports the gameplay stylesheet immediately after app.css`) and the full welcomed-shell golden `toBe(shellHtml(...))` pins the rendered order/classes of `.hud-panel`, `.user-panel > .users-badge`, `.upgrades-panel`, `.customization-toggle` and the trailing `.phase-announcement`. Base corner placement remains owned by unchanged `app.css` (T2's `game-view.css.test.ts` reads it).
- **AC-4 → met.** The welcomed-shell goldens pin `<section aria-label="Game statistics" class="hud-panel">` with exactly the five `<p class="hud-row" data-row="clicks|faces-destroyed|coins|cube|server">` rows, each with its exact `cursor`/`cube`/`coin`/`cube-level`/`server` SVG and the preserved labels/`data-stat` values, plus the trailing `aria-label="Toggle HUD"` button.
- **AC-5 → met.** The shell goldens pin `<div class="user-panel">` with the `users-badge` toggle carrying the `group` icon before the exact `Users on Server` label, closed `aria-expanded="false"`; `PANEL_CLOSED_WITH_RETURN` pins the spectating `Return to my cube` command.
- **AC-6 → met.** The shell goldens pin all three `li.upgrade-row[data-upgrade]` rows with per-row `upgrade-click`/`upgrade-cube`/`upgrade-speed` icons, the `diamond` cost icon, the exact names/levels/effects/costs and the `class="upgrade-buy" aria-label="Buy"` buttons (disabled at 0 coins).
- **AC-7 → met.** The welcomed-shell golden contains the `CustomizationToggle` markup (`class="customization-toggle" aria-expanded="false"`, gear + ship icons, exact label); the jsdom test clicks it and asserts the rendered `SpaceshipCustomizationPanel` (`.customization-panel`) mounts and the `aria-expanded` state flips `false → true → false`; the pre-welcome golden omits the toggle.
- **AC-18 → met.** `App.tsx` sets `data-customization-open={customizationOpen ? 'true' : 'false'}` on the game-shell `<main>`; `App.test.tsx` asserts `"false" → "true" → "false"` across toggle clicks, the verification-route shell has no attribute, and the full shell goldens start at `data-customization-open="false"`. The ≤720 px hide rule that consumes the attribute is T2's `game-view.css` (green `game-view.css.test.ts`).

## Deviations from spec

None in the owned files. No engine/session/transport, component, CSS, config, dependency or container change. `build-log-T8.md` is the only artifact outside the two source files.

## Environment note

The full-suite and coverage exits are red solely because T11's palette-literal update had not landed during this task; excluding only `src/render/scene.test.ts` makes the entire remaining workspace (52 files, 1229 tests) green. `App.test.tsx` is green in every run (26/26).
