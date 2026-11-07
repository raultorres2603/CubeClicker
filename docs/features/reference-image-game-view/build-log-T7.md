# Build log — T7 — Spaceship customization toggle

Task: T7 (2026-11-07)

Files changed:
- `src/frontend/src/ui/CustomizationToggle.tsx` (new)
- `src/frontend/src/ui/CustomizationToggle.test.tsx` (new)
- `docs/features/reference-image-game-view/build-log-T7.md` (this file)

## Sketch (≤5 lines)

- New presentational `CustomizationToggle({ open, onToggle })` rendering a native `<button type="button" class="customization-toggle" aria-expanded={open}>`.
- Put the T3 `GearIcon` and `ShipIcon` (both `aria-hidden="true"`, `focusable="false"`) before the exact label `Spaceship customization`.
- Forward activation to `onToggle` once per click; own no state.
- Test with exact SSR goldens (closed/open), jsdom structural/icon assertions, one-callback-per-click, and keyboard activation.
- Do not wire into `App.tsx`; T8 owns the app-shell integration.

## What changed & why

- `CustomizationToggle.tsx` publishes the AC-7 control contract: `type="button"`, `className="customization-toggle"`, `aria-expanded` driven by the `open` prop, the gear + ship icons from `icons.tsx`, the exact visible label `Spaceship customization`, and `onClick={onToggle}`. It holds no state, so the open/closed source of truth stays in `App` (T8).
- `CustomizationToggle.test.tsx` pins the complete SSR markup for both `open={false}` and `open` (exact class/attribute order, both exact SVGs, exact label), asserts the DOM structure (one button, two hidden/unfocusable icons in `gear`→`ship` order, no icon text, exact `textContent`) and that `aria-expanded` follows the prop across a re-render.
- The interaction tier uses `@testing-library/react` + `userEvent` in jsdom: one click calls `onToggle` exactly once and a second click raises the count to exactly two (catches double-wiring); Tab moves focus to the button and Enter activates it exactly once (native keyboard operability, AC-19).
- No `App.tsx`, icons, CSS, HUD/UserPanel/UpgradesPanel, config, dependency or container change. No wiring into `App.tsx` by design (T8 `files_owned`).

## Decisions

- **Prop-driven, stateless component:** `open`/`onToggle` are passed through so `App` keeps the existing `customizationOpen` state and the `SpaceshipCustomizationPanel` keeps its current open/close behavior (AC-7). The component adds no internal toggle.
- **Icon markup unchanged:** icons are used without a wrapper or extra class; `game-view.css` already sizes `.customization-toggle svg` (T2), and the icons' own `aria-hidden`/`focusable` contract comes from T3. The label stays a single JSX text child with no icon text, so the accessible name is exactly `Spaceship customization`.
- **`onClick={onToggle}` (no wrapper):** matches the existing `Hud` minimize-button precedent and guarantees one handler invocation per activation. The callback signature is `() => void`, so the click event argument is ignored.
- **Test tiers:** SSR goldens (component render through `react-dom/server`) plus a jsdom interaction test (real DOM events); no snapshot files, no wildcard matchers, no exempted loose assertions.

## Evidence

Environment: repository root `/var/home/raultorraco/Documents/Projects/CubeClicker`; frontend workspace `@cubeclicker/frontend`. T12 landed (`f9978f8 feat: retune default cube to emerald neon`) during verification, so the workspace also carries the expected T8/T11/T13 test debt listed below. Only the two owned source files and this log were staged.

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

### `npm test --workspace @cubeclicker/frontend -- src/ui/CustomizationToggle.test.tsx` — exit 0

```text

> test
> vitest run src/ui/CustomizationToggle.test.tsx


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 139ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  21:44:46
   Duration  844ms (transform 48ms, setup 0ms, collect 129ms, tests 139ms, environment 363ms, prepare 70ms)

FOCUSED_EXIT=0
```

### `npm test --workspace @cubeclicker/frontend` — exit 1 (only the planned non-T7 debt; `CustomizationToggle` green)

```text
 FAIL  src/App.test.tsx > App > renders the travel phase copy in the same single live region
 FAIL  src/App.test.tsx > App > announces a spectate flight with the target member name (AC-17)
 FAIL  src/App.test.tsx > App > announces the return flight with the pinned copy (AC-18)
 FAIL  src/App.test.tsx > App > renders the playing phase with an empty live region that is still present
 FAIL  src/App.test.tsx > App > binds the HUD to the engine snapshot and the server id to the multiplayer store (AC-11, AC-23)
 FAIL  src/App.test.tsx > App > renders Return to my cube in the shell exactly while spectating (AC-18)
 FAIL  src/App.test.tsx > App > renders the pinned banner copy per transport status (AC-22)
 FAIL  src/render/cube-view.test.ts > createCubeView > takes the pinned colours and PBR values from the style (body = dark interior)
 FAIL  src/render/cube-view.test.ts > applyStyle > leaves a removed face untouched
 FAIL  src/render/scene.test.ts > intent application > exposes the live cube view through the rebuild-aware accessor (AC-16)

 Test Files  3 failed | 49 passed (52)
      Tests  10 failed | 1279 passed (1289)
```

- **7 × `App.test.tsx`** — stale exact `shellHtml` against the new T4/T5/T6 markup; explicitly T8 `files_owned` (`tasks.md` T8: "Update `App.test.tsx` `shellHtml` and all expected shell strings for the new HUD/UserPanel/UpgradesPanel/CustomizationToggle markup/classes/attribute").
- **2 × `cube-view.test.ts`** — style-0 literals (`0b0b12`/`1de9b6`) not yet updated to T12's emerald palette; T13 owns those literals (`tasks.md` T13: "style-0 literals in the 'pinned colours and PBR values' test (lines 321–326, 329) ... and the removed-face material retentions (lines 855–856)").
- **1 × `scene.test.ts`** — style-0 literal at line 1596; T11 owns it (`tasks.md` T11: "update the two style-0 body literals at lines 1596/1623").

Representative assertions for the non-App debt (all palette-literal, no behavior change):

```text
FAIL src/render/cube-view.test.ts > createCubeView > takes the pinned colours and PBR values from the style (body = dark interior)
AssertionError: expected '0a2418' to be '0b0b12' // Object.is equality
 ❯ src/render/cube-view.test.ts:321:39

FAIL src/render/cube-view.test.ts > applyStyle > leaves a removed face untouched
AssertionError: expected '2ee27f' to be '1de9b6' // Object.is equality
 ❯ src/render/cube-view.test.ts:855:48

FAIL src/render/scene.test.ts > intent application > exposes the live cube view through the rebuild-aware accessor (AC-16)
AssertionError: expected '0a2418' to be '0b0b12' // Object.is equality
 ❯ src/render/scene.test.ts:1596:82
```

`CustomizationToggle.test.tsx` is green in the full run (`✓ src/ui/CustomizationToggle.test.tsx (6 tests)`); no failure names this task.

Supplementary run excluding only the three known-debt files (proves the rest of the workspace, including this task, is green):

```text
$ npm test --workspace @cubeclicker/frontend -- --run --exclude src/App.test.tsx --exclude src/render/cube-view.test.ts --exclude src/render/scene.test.ts

 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 202ms
 ...
 Test Files  49 passed (49)
      Tests  1156 passed (1156)
EXIT=0
```

### `npm run coverage --workspace @cubeclicker/frontend -- --coverage.reportOnFailure=true --coverage.reportsDirectory=/tmp/opencode/t7/coverage-report` — table green; exit 1 only from the same 10 known failures

The two plain invocations (both `--coverage.reportOnFailure=true`) were interrupted by the shared `.tmp` race already documented in `build-log-T6.md` (a concurrent task's coverage run deletes `src/frontend/coverage/.tmp/coverage-*.json`):

```text
Error: ENOENT: no such file or directory, open '.../src/frontend/coverage/.tmp/coverage-51.json'
```

The retry with an isolated `--coverage.reportsDirectory` avoided the shared artifact and produced the table (thresholds are unchanged; only the report directory moved):

```text
 Test Files  3 failed | 49 passed (52)
      Tests  10 failed | 1279 passed (1289)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.28 |    95.01 |   96.13 |   95.28 |
 src               |   82.95 |    78.34 |   89.47 |   82.95 |
  App.tsx          |   81.98 |    76.05 |   88.46 |   81.98 | ...17,486-491,507
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
 src/render        |   98.82 |     95.6 |   98.49 |   98.82 |
  ...round-life.ts |     100 |      100 |     100 |     100 |
  cube-view.ts     |     100 |      100 |     100 |     100 |
  nebula.ts        |     100 |      100 |     100 |     100 |
  particles.ts     |     100 |      100 |     100 |     100 |
  picking.ts       |     100 |      100 |     100 |     100 |
  ...processing.ts |     100 |      100 |     100 |     100 |
  scene.ts         |   97.41 |    96.17 |   94.73 |   97.41 | ...95-896,920-921
  spaceship.ts     |   98.25 |    85.45 |     100 |   98.25 | ...44,360,380,391
  ...ate-travel.ts |     100 |      100 |     100 |     100 |
  starfield.ts     |     100 |      100 |     100 |     100 |
  webgl.ts         |     100 |      100 |     100 |     100 |
  world.ts         |   98.41 |    91.75 |     100 |   98.41 | 229-232,442
 src/ui            |   95.69 |    97.23 |   86.79 |   95.69 |
  AuthForms.tsx    |     100 |    99.09 |     100 |     100 | 219
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |
  ...ionToggle.tsx |     100 |      100 |     100 |     100 |
  GameCanvas.tsx   |   90.47 |      100 |     100 |   90.47 | 25-26
  Hud.tsx          |     100 |      100 |     100 |     100 |
  ...tionPanel.tsx |   81.17 |    68.75 |   33.33 |   81.17 | 45-50,52-57,96-99
  ...ipPreview.tsx |    71.87 |      100 |     100 |   71.87 | 16-24
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

All four aggregate metrics clear the ≥80 gate (95.28 statements / 95.01 branches / 96.13 functions / 95.28 lines); `CustomizationToggle.tsx` is 100% on every metric. `COVERAGE_EXIT=1` is solely the 10 known failed tests above — the threshold check itself reports no shortfall.

## Acceptance audit

- **AC-7 → met (component half):**
  - `ui/CustomizationToggle.tsx` renders `<button type="button" class="customization-toggle" aria-expanded={open}>` — exact SSR goldens for closed and open (`CustomizationToggle.test.tsx`, two `toBe(toggleMarkup(...))` assertions) and jsdom `getAttribute('type'|'class'|'aria-expanded')` assertions.
  - It contains a gear SVG (`data-icon="gear"`) and a ship SVG (`data-icon="ship"`) before the exact label `Spaceship customization` — exact SVG goldens plus `data-icon`/`aria-hidden="true"`/`focusable="false"`/`fill="none"`/`viewBox` arrays and `textContent === 'Spaceship customization'`.
  - One click calls `onToggle` exactly once (`toHaveBeenCalledTimes(1)`; second click exactly 2; keyboard Enter exactly 1) — `CustomizationToggle.test.tsx` jsdom interaction tests.
  - App wiring (`open={customizationOpen}`, `onToggle={() => setCustomizationOpen(v => !v)}`), the `SpaceshipCustomizationPanel` state continuity and the `.customization-toggle` CSS (`44px`/focus ring) are **not** this task: the CSS landed with T2 (`game-view.css`, green `game-view.css.test.ts`) and the app-shell integration is T8 (`tasks.md` T8, `App.test.tsx` works there). No `App.tsx` edit made here.
- **AC-19 → met (toggle surface):** both toggle SVGs are decorative (`aria-hidden="true"`, `focusable="false"`, asserted 2/2); the control is the native `<button>` (Tab reaches it, Enter activates it, asserted); its 44×44 px target and accent `:focus-visible` outline are declared by T2's `.customization-toggle` rule and guarded by the green `game-view.css.test.ts`.

## Deviations from spec

None in the owned files. Intentional scope boundary: the component is not yet used by `App.tsx` — T8 owns that wiring per `tasks.md` T8 ("Import ... replace the inline customization `<button>` with `CustomizationToggle`"). No documentation change beyond this build log is required for an internal component; the T15 documentation pass covers user-facing docs.
