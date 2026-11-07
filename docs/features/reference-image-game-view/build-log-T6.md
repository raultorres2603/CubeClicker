# Build log — T6 — Upgrades panel row and buy markup

Task: T6 (2026-11-07)
Files changed: `src/frontend/src/ui/UpgradesPanel.tsx`, `src/frontend/src/ui/UpgradesPanel.test.tsx`, `docs/features/reference-image-game-view/build-log-T6.md`

## Sketch (≤5 lines)

- Add `className="upgrade-row"` to each `<li>` and keep every `data-upgrade`/`data-name`/`data-level`/`data-effect`/`data-cost` hook, text and cost untouched.
- Map one decorative row icon per upgrade id (`upgrade-click`, `upgrade-cube`, `upgrade-speed`) and add the `diamond` icon beside the cost.
- Add `className="upgrade-buy"` to the existing buy button (same `aria-label`, `disabled` affordability/max logic and `onClick`).
- Rewrite `UpgradesPanel.test.tsx` as exact SSR golden markup plus icon/count assertions, and replace the SSR-only callback test with a jsdom `userEvent` click test.
- Verify with lint, typecheck, frontend tests and the frontend coverage gate; record the T8-owned `App.test.tsx` golden debt.

## What changed & why

- `UpgradesPanel` now renders reference-style rows: a row icon (`UpgradeClickIcon` for `mini_cube_value`, `UpgradeCubeIcon` for `cube_value`, `UpgradeSpeedIcon` for `speed_window`), the unchanged name/level/effect spans, a `DiamondIcon` immediately before the unchanged `data-cost` span, and the existing empty buy button carrying `className="upgrade-buy"`. The button keeps `type="button"`, `aria-label="Buy"`, the `disabled={!affordable}` predicate and the guarded `onPurchase(def.id)` click handler; the catalog, cost formula, max levels and guest default are unchanged.
- `UpgradesPanel.test.tsx` pins the whole panel with exact expected strings (section attributes, `<ul>`, each `<li class="upgrade-row" data-upgrade=...>`, the four inline SVGs per row and the button markup). The zero-state, level-scaled costs (`40`/`400`/`75`), `Infinity` at max level, unaffordable (5 coins), exactly-one-affordable (10 coins) and guest-mode scenarios from the previous suite are retained as full goldens or explicit structure assertions.
- One integration test now renders the panel in jsdom, asserts the three buy buttons' disabled state, clicks the enabled one and asserts `onPurchase` is called exactly once with `mini_cube_value`, then clicks both disabled controls and asserts the callback count stays `1`.

## Decisions

- **Diamond position:** the diamond is placed just before the cost value (currency-prefix reading order: `[row icon] name level effect ◆ cost [+]`); AC-6 only pins that it is decorative and beside the cost, so the test golden fixes the chosen order.
- **Icon import seam:** a typed `Record<UpgradeId, ComponentType<IconProps>>` keeps the id→icon mapping exhaustive; every icon comes from the T3 `icons.tsx` set, so the `aria-hidden="true"`/`focusable="false"` contract is not duplicated in this component.
- **Stronger click coverage:** the previous "calls onPurchase" test only asserted a `vi.fn` was *not* called (SSR cannot dispatch events). Replacing it with a real `@testing-library/react` + `userEvent` interaction is the existing `Hud.test.tsx` precedent and follows the two-tier testing bar (component render through its real event boundary).
- **Downstream golden debt:** `App.test.tsx` owns a duplicated exact shell string whose upgrades section still expects the pre-T6 `<li>`/button markup. It is explicitly T8's `files_owned` (T8 updates `shellHtml` once for T4–T7), so this task neither edits it nor weakens it; the resulting 7 `App.test.tsx` golden failures are recorded below and are expected until T8 lands.
- No CSS, icons, game logic, `App.tsx`, `Hud.tsx`, `UserPanel.tsx`, config or dependency change.

## Evidence

Environment: repository root `/var/home/raultorraco/Documents/Projects/CubeClicker`; frontend workspace `@cubeclicker/frontend`. T4/T5 were editing `Hud.tsx`/`UserPanel.tsx`/their tests concurrently in the same working tree while these commands ran; those files were left untouched and only the owned files were staged. They landed as commits `e1a86a3` (T5) and `6d7411c` (T4) during this task.

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

### `npm test --workspace @cubeclicker/frontend` — exit 1 (expected T8-owned `App.test.tsx` golden debt; no other failure)

```text
 FAIL  src/App.test.tsx > App > renders the travel phase copy in the same single live region
 FAIL  src/App.test.tsx > App > announces a spectate flight with the target member name (AC-17)
 FAIL  src/App.test.tsx > App > announces the return flight with the pinned copy (AC-18)
 FAIL  src/App.test.tsx > App > renders the playing phase with an empty live region that is still present
 FAIL  src/App.test.tsx > App > binds the HUD to the engine snapshot and the server id to the multiplayer store (AC-11, AC-23)
 FAIL  src/App.test.tsx > App > renders Return to my cube in the shell exactly while spectating (AC-18)
 FAIL  src/App.test.tsx > App > renders the pinned banner copy per transport status (AC-22)
 Test Files  1 failed | 50 passed (51)
      Tests  7 failed | 1276 passed (1283)
```

Representative diff (all 7 failures are the same root cause — the stale exact `shellHtml` in `App.test.tsx:255`):

```text
Expected: ...<section aria-label="Upgrades" class="upgrades-panel" data-mode="guest"><ul><li data-upgrade="mini_cube_value"><span data-name="true">Click Power</span>...
Received: ...<section aria-label="Upgrades" class="upgrades-panel" data-mode="guest"><ul><li class="upgrade-row" data-upgrade="mini_cube_value"><svg aria-hidden="true" data-icon="upgrade-click" ...></svg><span data-name="true">Click Power</span>...<svg aria-hidden="true" data-icon="diamond" ...></svg><span data-cost="true">10</span><button type="button" class="upgrade-buy" aria-label="Buy" disabled=""></button>...
```

The received markup also contains the concurrent T4 `hud-panel`/`hud-row` markup and T5 `users-badge` markup, so the stale `shellHtml` is a single combined debt for T8 (planned in `plan.md`/`tasks.md` T8: "Update `App.test.tsx` `shellHtml` and all expected shell strings for the new HUD/UserPanel/UpgradesPanel/CustomizationToggle markup/classes/attribute"). `App.test.tsx` is outside T6 `files_owned`.

Supplementary run excluding the T8-owned file (proves every other frontend test is green, including the T6 file and the concurrent T4/T5 files):

```text
$ npm test --workspace @cubeclicker/frontend -- --run --exclude src/App.test.tsx
 Test Files  50 passed (50)
      Tests  1260 passed (1260)
EXIT=0
```

### `npm run coverage --workspace @cubeclicker/frontend -- --coverage.reportOnFailure=true` — thresholds green; exit 1 only because of the same 7 `App.test.tsx` failures

(`--coverage.reportOnFailure=true` is used so the V8 table prints when the suite contains pre-existing/expected failures. Without it, Vitest suppresses the table on failure.)

```text
 Test Files  1 failed | 50 passed (51)
      Tests  7 failed | 1276 passed (1283)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.27 |       95 |   96.12 |   95.27 |
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
 src/ui            |   95.62 |    97.21 |   86.53 |   95.62 |
  AuthForms.tsx    |     100 |    99.09 |     100 |     100 | 219
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |
  GameCanvas.tsx   |   90.47 |      100 |     100 |   90.47 | 25-26
  Hud.tsx          |     100 |      100 |     100 |     100 |
  ...tionPanel.tsx |   81.17 |    68.75 |   33.33 |   81.17 | 45-50,52-57,96-99
  ...ipPreview.tsx |   71.87 |      100 |     100 |   71.87 | 16-24
  ...adesPanel.tsx |     100 |      100 |     100 |     100 |
  UserPanel.tsx    |   91.07 |      100 |   66.66 |   91.07 | 69-70,93-95
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |
  icons.tsx        |     100 |      100 |     100 |     100 |
  theme.ts         |     100 |      100 |     100 |     100 |
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100
-------------------|---------|----------|---------|---------|-------------------
npm error Lifecycle script `coverage` failed with error:
npm error code 1
npm error path /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
npm error workspace @cubeclicker/frontend
npm error location /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
npm error command failed
npm error command sh -c vitest run --coverage --coverage.reportOnFailure=true
```

All four aggregate metrics are ≥ 80 (95.27 statements / 95 branches / 96.12 functions / 95.27 lines); `UpgradesPanel.tsx` is 100% on every metric. The first coverage attempt hit a transient `ENOENT ... src/frontend/coverage/.tmp/coverage-49.json` because a concurrent task's coverage run deleted the shared `.tmp` artifact; the immediate retry produced the table above.

## Acceptance audit

- **AC-6 → met (markup half):**
  - Each `<li>` has `class="upgrade-row"` and `data-upgrade`; the `data-name`/`data-level`/`data-effect`/`data-cost` spans and exact texts are unchanged (`Click Power`/`Cube Bonus`/`Quick Hands`, `0/10`/`0/10`/`0/5`, the three effect previews, costs `10`/`50`/`25` at level 0) — `UpgradesPanel.test.tsx` golden zero-state test.
  - Each row contains `data-icon="upgrade-click"`/`"upgrade-cube"`/`"upgrade-speed"` and one `data-icon="diamond"`; the panel renders exactly 6 decorative SVGs, each `aria-hidden="true"` and `focusable="false"` — golden + count assertions.
  - The buy button has `class="upgrade-buy"`, `aria-label="Buy"`, the unchanged enabled/disabled affordability and max-level semantics (disabled at coins < cost and at max level / `Infinity`), and only the enabled button calls `onPurchase('mini_cube_value')` exactly once — golden disabled states + jsdom click test.
  - The `.upgrades-panel`/`.upgrade-row`/`.upgrade-buy` CSS contract itself landed in T2 and is covered by the green `game-view.css.test.ts`.
- **AC-19 → met (upgrades surface):** every icon added here is decorative (`aria-hidden="true"`, `focusable="false"`, asserted 6/6), the buy control keeps its `aria-label="Buy"`, and its ≥44 px target/focus-visible ring and green/white contrast are owned by the T2 stylesheet assertions (`game-view.css.test.ts`, `theme.test.ts`).

## Deviations from spec

None in the owned files. The only red verify signal is the planned, T8-owned `App.test.tsx` exact-shell update (plus concurrent T4/T5 markup) — contents above.
