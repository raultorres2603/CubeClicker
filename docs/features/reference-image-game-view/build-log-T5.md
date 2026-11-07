# Build log — T5 — Users-on-Server badge markup

Task: T5 (2026-11-07)

Files changed:
- `src/frontend/src/ui/UserPanel.tsx`
- `src/frontend/src/ui/UserPanel.test.tsx`
- `docs/features/reference-image-game-view/build-log-T5.md` (this file)

What changed & why (≤5 lines):
- The toggle now carries `class="users-badge"` and renders the T3 `GroupIcon` (`aria-hidden="true"`, `focusable="false"`) immediately before the unchanged label `Users on Server`; `aria-expanded` and the `onClick` toggle are untouched.
- The open `<section>` now carries `class="users-list"` alongside the unchanged `aria-label="Users on server"`.
- Own disabled row, member rows (`name · Cube N`), `Return to my cube`, ordering and all callbacks are unchanged.
- `UserPanel.test.tsx` goldens now pin the new badge/list markup (exact `GroupIcon` SVG) and two new explicit tests assert the badge class, exactly one decorative group icon before the label, and the `users-list` class/label.

Decisions:
- No DOM interaction test was added: the component's existing SSR seam (`defaultOpen`) and goldens already pin `aria-expanded` and the toggle markup; T5 asks only for golden/icon/class assertions, and adding a jsdom environment was outside the task.
- The `GroupIcon` is rendered with no extra wrapper/space so the SSR text node stays exactly `Users on Server` (the icon is decorative and contributes no accessible name).

## Evidence

### `npm run lint` → PASS (exit 0)

```
> lint
> eslint .
```

### `npm run typecheck` → PASS (exit 0)

```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
```

### `npm test --workspace @cubeclicker/frontend` → exit 1, only `App.test.tsx` (T8-owned stale golden)

Component suite first, in isolation:

```
> test
> vitest run src/ui/UserPanel.test.tsx

 ✓ src/ui/UserPanel.test.tsx (8 tests) 12ms

 Test Files  1 passed (1)
      Tests  8 passed (8)
```

Full workspace run (re-run after the concurrent T4/T6 working-tree files settled):

```
> test
> vitest run

 ✓ src/ui/UserPanel.test.tsx (8 tests) 18ms
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

Cause (raw assertion excerpt from the first failure): the expected shell string contains the old
`<button type="button" aria-expanded="false">Users on Server</button>` while the received markup
contains the new badge, e.g.:

```
Received: "...<div class=\"user-panel\"><button type=\"button\" class=\"users-badge\" aria-expanded=\"false\"><svg aria-hidden=\"true\" data-icon=\"group\" ...></svg>Users on Server</button></div>..."
Expected: "...<div class=\"user-panel\"><button type=\"button\" aria-expanded=\"false\">Users on Server</button></div>..."
```

`App.test.tsx` centralizes the shell in `shellHtml` / `PANEL_CLOSED` / `PANEL_CLOSED_WITH_RETURN`;
it is **not** in T5's `files_owned` and T8 explicitly owns updating that golden ("Update
`App.test.tsx` `shellHtml` and all expected shell strings for the new HUD/UserPanel/UpgradesPanel/
CustomizationToggle markup/classes/attribute"). The other two shell ripples in the same diff are
T4's `.hud-panel`/rows and T6's `.upgrade-row`/`.upgrade-buy` markup. No UserPanel behavior test
fails.

Transient note: the first full run also had 2 failures in `src/ui/UpgradesPanel.test.tsx` from the
concurrent T6 working-tree edit; the re-run above shows those tests green (T6 settled), leaving only
the T8-owned golden.

### `npm run coverage --workspace @cubeclicker/frontend` → exit 1 (same 7 `App.test.tsx` failures), coverage thresholds PASS

The exact command stops before printing the table when tests fail, so the same run was repeated with
`-- --coverage.reportOnFailure` to capture the coverage table (test results identical):

```
 Test Files  1 failed | 50 passed (51)
      Tests  7 failed | 1276 passed (1283)
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.27 |       95 |   96.12 |   95.27 |
 src/ui            |   95.62 |    97.21 |   86.53 |   95.62 |
  UserPanel.tsx    |   91.07 |      100 |   66.66 |   91.07 | 69-70,93-95
```

No `ERROR: Coverage ... does not meet threshold` line is emitted; aggregate 95.27/95/96.12/95.27
clears the ≥80 gate. `UserPanel.tsx`'s uncovered lines are the pre-existing SSR-only gaps (the two
click callbacks), not new production logic.

## Acceptance audit

- **AC-5 — Users-on-Server badge** → **met (component half).** `users-badge` class + one `group` SVG
  (`aria-hidden="true"`, `focusable="false"`) before the exact label and `users-list` on the open
  section are pinned by `UserPanel.test.tsx` goldens and the two explicit AC-5 tests. The CSS half
  (`.user-panel > .users-badge` reset/hover/focus, `.user-panel .users-list` panel treatment) was
  delivered by T2 and is guarded by `game-view.css.test.ts`; `theme.ts` badge-stop contrast is
  guarded by `theme.test.ts`.
- **AC-19 — Accessibility** → **met (component half).** The icon is decorative
  (`aria-hidden="true"`, `focusable="false"`), the toggle keeps its native button semantics and
  `aria-expanded`, the accessible name remains exactly `Users on Server`, and the open list keeps
  its `aria-label`. The CSS focus ring/44px contract is guarded by T2's `game-view.css.test.ts`.

## Deviations from spec

- None in production markup/tests. Known integration state: the full-workspace verify command is red
  **only** on `App.test.tsx`'s stale shell golden, which T8 owns and will reconcile (same precedent as
  `docs/features/coin-economy/build-log-T11.md`). T5 did not touch `App.tsx`, `App.test.tsx`,
  `Hud`/`UpgradesPanel`, CSS, icons, docs status, configs or containers.
