# Build log — T4 — HUD panel markup and icons

Task: T4 (2026-11-07)
Files changed: `src/frontend/src/ui/Hud.tsx`, `src/frontend/src/ui/Hud.test.tsx`
What changed & why: `Hud` now renders `class="hud-panel"` and five `<p class="hud-row" data-row="...">` rows in reference order, each with its T3 icon (`cursor`, `cube`, `coin`, `cube-level`, `server`) before the unchanged label text and `data-stat` span. The optional minimize button is still the last child with `aria-label="Toggle HUD"`, `aria-expanded`, `onClick` and the `data-minimized`/`data-blinking` attributes. No behavior, state, label, value or accessibility semantics changed.
Decisions: icons sit inside each row before the label (no extra wrappers); the existing `<p>`/`<span data-stat>` structure is preserved so `app.css`/`game-view.css` hooks keep working; the test file gains exact icon markup constants plus a jsdom row-order/icon/attribute assertion, with every pre-existing golden-string test updated to the new markup.

## Evidence

### `npm run lint`

```
> lint
> eslint .
```

Exit 0.

### `npm run typecheck`

```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

Exit 0 (both workspaces).

### `npm test --workspace @cubeclicker/frontend -- src/ui/Hud.test.tsx`

```
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/Hud.test.tsx (16 tests) 123ms

 Test Files  1 passed (1)
      Tests  16 passed (16)
   Start at  21:42:11
   Duration  830ms (transform 57ms, setup 0ms, collect 138ms, tests 123ms, environment 356ms, prepare 61ms)
```

Exit 0.

### `npm test --workspace @cubeclicker/frontend`

Exit 1. Re-run after the concurrent T5/T6 test updates landed; the only remaining failures are the seven `App.test.tsx` shell golden-string tests owned by T8 (they still assert the pre-T4 HUD markup via `shellHtml`):

```
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

Each failure compares the whole rendered shell against `shellHtml`, whose HUD fragment is T8-owned (`tasks.md` T8: "Update `App.test.tsx` `shellHtml` and all expected shell strings for the new HUD/UserPanel/UpgradesPanel/CustomizationToggle markup/classes/attribute"). The received side already contains the new `.hud-panel`/`.hud-row`/SVG markup; no behavior test fails. Earlier in the same window a T6 `UpgradesPanel.test.tsx` run was transiently red while T6 was mid-flight; the re-run above shows it green.

### `npm run coverage --workspace @cubeclicker/frontend`

Exit 1, same seven T8-owned `App.test.tsx` golden-string failures (Vitest does not print the coverage table when the run fails):

```
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

Supplementary threshold evidence for the T4 scope (`npx vitest run --coverage --exclude src/App.test.tsx`, exit 0):

```
All files          |   90.35 |    94.19 |   96.13 |   90.35 |
 ...
 Hud.tsx          |     100 |      100 |     100 |     100 |
 icons.tsx        |     100 |      100 |     100 |     100 |
```

All four metrics clear the ≥80 gate and `Hud.tsx` itself is 100% statements/branches/functions/lines. The pinned coverage command goes green as soon as T8 updates the `App.test.tsx` shell strings; it is the only red file in the workspace.

## Acceptance audit

- AC-4 → met (evidence: `Hud.test.tsx` zero-state/live/toggle golden strings plus the `Hud icon rows` test: exactly five `data-row` values `clicks`, `faces-destroyed`, `coins`, `cube`, `server` in order; one SVG per row with `data-icon` `cursor`, `cube`, `coin`, `cube-level`, `server`; labels and `data-stat` values preserved; the minimize button stays the last child with `aria-label="Toggle HUD"` and `aria-expanded`).
- AC-19 → met for the T4 surface (evidence: every HUD SVG asserted `aria-hidden="true"` and `focusable="false"`; the only interactive control remains the pre-existing minimize button with its existing accessible name; no contrast or CSS values changed in this task — those gates live in T1/T2).

## Deviations from spec

None in owned source files. Cross-task integration note: the full frontend suite and the pinned workspace coverage command stay red until T8 updates the `App.test.tsx` `shellHtml` golden strings for the new HUD/UserPanel/UpgradesPanel/CustomizationToggle markup; T4 leaves that file untouched per scope, and the T4-scoped `Hud.test.tsx` suite is green.
