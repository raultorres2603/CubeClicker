# Build log — T9 — Upgrades, users and connection markup

Task: T9 (2026-11-16), feature `game-feel-overhaul`, branch `feat/game-feel-overhaul`
at `07dd9fb` (`feat: restyle the gameplay shell and add the non-modal reveal spotlight`).

Files changed (only `files_owned`):

- `src/frontend/src/ui/UpgradesPanel.tsx`
- `src/frontend/src/ui/UpgradesPanel.test.tsx`
- `src/frontend/src/ui/UserPanel.tsx`
- `src/frontend/src/ui/UserPanel.test.tsx`
- `src/frontend/src/ui/ConnectionBanner.tsx`
- `src/frontend/src/ui/ConnectionBanner.test.tsx`
- `docs/features/game-feel-overhaul/build-log-T9.md`

## Change sketch (≤5 lines, before implementing)

1. `UpgradesPanel`: add `h2.upgrades-title`, `p.upgrades-balance[data-coins]`, per-row
   `data-affordable` and an `aria-hidden` `.upgrade-pips` with `def.maxLevel`
   `.upgrade-pip[data-filled]` dots; keep catalog text/levels/costs/buy/pulse semantics.
2. `UserPanel`: add the `aria-hidden` `.gf-live-dot` and `.users-count[data-count]` to the
   toggle, `<h2 class="users-list-title">Crew</h2>` before the `<ul>`, and `data-level` on
   each member button; keep spectate/return copy and no live region.
3. `ConnectionBanner`: add `data-status` and an `aria-hidden` `.connection-dot` before the
   text; keep the exact copy, `Retry` and no live region.
4. Tests: pin the new DOM/data hooks with concrete SSR strings + jsdom queries, retain the
   accepted pulse/reduced-motion/focus/44 px contract evidence.
5. Verify: lint, typecheck, frontend tests, frontend coverage, `git diff --check`.

## What changed & why

1. **`UpgradesPanel.tsx`** now renders, inside the existing
   `<section aria-label="Upgrades" class="upgrades-panel" data-mode="…">`:
   `<h2 class="upgrades-title">Upgrades</h2>`, then
   `<p class="upgrades-balance" data-coins="{coins.toFixed(2)}">Coins {coins.toFixed(2)}</p>`,
   then the catalog `<ul>`. Each `<li class="upgrade-row" data-upgrade="…">` gains
   `data-affordable="true|false"` (the same computed boolean that drives `disabled`) and an
   `aria-hidden` `<span class="upgrade-pips">` positioned after `data-cost` and before the
   buy button, containing exactly `def.maxLevel` `<span class="upgrade-pip"
   data-filled="true|false">` dots (first `level` filled). Catalog names, levels, effects,
   costs (`10/50/25` scaled by level), max-level `Infinity`, the guest default, the buy
   callback and the accepted `data-purchased` 260 ms pulse/reduced-motion behavior are
   byte-for-byte unchanged; only the documented markup was added. The `+` glyph,
   `--upgrade-green` fill, `--gf-success` rim, 44×44 px target, circular shape and focus
   ring stay in `app.css`/`game-view.css` (T6/T7).
2. **`UserPanel.tsx`** keeps the `user-panel` root, the `users-badge` toggle class and its
   exact `Users on Server` text; the toggle now also carries an `aria-hidden`
   `<span class="gf-live-dot" data-live-dot="true">` before the label and an `aria-hidden`
   `<span class="users-count" data-count="{members.length + 1}">{members.length + 1}</span>`
   after it, so the accessible name stays exactly `Users on Server`. The open roster keeps
   `class="users-list"` / `aria-label="Users on server"`, gains
   `<h2 class="users-list-title">Crew</h2>` immediately before the `<ul>`, keeps the
   disabled self row first and the `Return to my cube` control, and each member button
   gains `data-level="{member.levelIndex + 1}"` while its text
   (`{name} · Cube {levelIndex + 1}`) and slot order stay unchanged. No live region.
3. **`ConnectionBanner.tsx`** adds `data-status="{status}"` to the banner root and one
   `aria-hidden` `<span class="connection-dot" data-connection-dot="true">` before the
   text, including the exhausted branch (dot before `<span>Connection lost</span>` and
   `Retry`). The exact copy (`Connecting…`, `Connection lost — retrying…`,
   `Connection lost` + `Retry`), the connected `null` render and the no-live-region rule
   are unchanged.
4. **Tests.** `UpgradesPanel.test.tsx` rewrites the golden-string helper to the new
   markup and adds focused heading/balance, affordability and pip tests (the pulse suite
   is kept). `UserPanel.test.tsx` updates every golden string, adds count/dot/Crew/data-level
   pins, and moves to jsdom for three real interaction tests (toggle accessible name,
   spectate-and-close, return). `ConnectionBanner.test.tsx` updates the three status
   strings, adds the dot/`data-status`/order loop, and adds a jsdom `Retry` callback test.

## Decisions

- **Pips live in the row, after the cost.** AC-20 does not pin the pip position; placing
  the level track next to the cost/buy control keeps the existing icon → name → level →
  effect → diamond → cost → buy reading order intact and lets `game-view.css` (`.upgrade-pips`,
  flex `none`) place it without reordering existing children.
- **`data-affordable` mirrors the buy state.** The attribute is the same `affordable`
  expression that sets `disabled`, so a maxed, guest-locked or too-expensive row is
  `false` and the CSS cost accent can never disagree with the control.
- **The count and live dot are `aria-hidden`.** The toggle's accessible name must remain
  the exact `Users on Server` (AC-24); the visible count is decorative redundancy of the
  roster, so it adds no name noise. The dot is purely decorative.
- **Crew heading is an `h2` immediately before the `<ul>`.** It satisfies AC-24 placement
  and AC-29 (`h2` + `.users-list-title`), and it is not inside the `<ul>` (no invalid list
  content).
- **New DOM tests are integration-tier.** The components are presentational; their pure
  seam is the golden-string SSR contract (unit tier). The jsdom interaction tests exercise
  the real callback wiring (spectate/return/retry) that SSR cannot reach.
- **Cross-task fixture note.** `App.test.tsx` is T8-owned and still compares whole-shell
  golden strings that embed the pre-T9 `ConnectionBanner`, `UserPanel` and `UpgradesPanel`
  markup. The required T9 markup therefore makes seven of its shell-string tests red until
  T8 rewrites `shellHtml`; this matches the approved DAG (T8 depends on T9/T10 and owns
  `App.test.tsx`) and the precedent in
  `docs/features/reference-image-game-view/build-log-T4.md`. No T9 behavior test fails and
  `App.test.tsx` was not edited (out of scope).

## Exact DOM/data evidence

Rendered with the real components (`renderToStaticMarkup`; SVG markup elided as `[SVG]`
only for readability — the test files pin the full strings):

```text
UPGRADES (coins=10, mini_cube_value=1):
<section aria-label="Upgrades" class="upgrades-panel" data-mode="account">
  <h2 class="upgrades-title">Upgrades</h2>
  <p class="upgrades-balance" data-coins="10.00">Coins 10.00</p>
  <ul>
    <li class="upgrade-row" data-upgrade="mini_cube_value" data-affordable="false">
      [SVG]<span data-name="true">Click Power</span><span data-level="true">1/10</span>
      <span data-effect="true">+10% coins per mini-cube</span>[SVG]
      <span data-cost="true">20</span>
      <span class="upgrade-pips" aria-hidden="true">
        <span class="upgrade-pip" data-filled="true"></span>
        <span class="upgrade-pip" data-filled="false"></span> ×9
      </span>
      <button type="button" class="upgrade-buy" aria-label="Buy" disabled=""></button>
    </li>
    <li class="upgrade-row" data-upgrade="cube_value" data-affordable="false">… (10 pips, 0 filled)</li>
    <li class="upgrade-row" data-upgrade="speed_window" data-affordable="false">… (5 pips, 0 filled)</li>
  </ul>
</section>
```

```text
USERS (self Player 1 + members Player 2 [levelIndex 1], Player 3 [levelIndex 0], open):
<div class="user-panel">
  <button type="button" class="users-badge" aria-expanded="true">
    [SVG]<span class="gf-live-dot" data-live-dot="true" aria-hidden="true"></span>Users on Server
    <span class="users-count" data-count="3" aria-hidden="true">3</span>
  </button>
  <section class="users-list" aria-label="Users on server">
    <h2 class="users-list-title">Crew</h2>
    <ul>
      <li><button type="button" disabled="">Player 1 (You)</button></li>
      <li><button type="button" data-level="2">Player 2 · Cube 2</button></li>
      <li><button type="button" data-level="1">Player 3 · Cube 1</button></li>
    </ul>
  </section>
</div>
```

```text
BANNER connecting:   <div class="connection-banner" data-status="connecting"><span class="connection-dot" data-connection-dot="true" aria-hidden="true"></span>Connecting…</div>
BANNER disconnected: <div class="connection-banner" data-status="disconnected"><span class="connection-dot" data-connection-dot="true" aria-hidden="true"></span>Connection lost — retrying…</div>
BANNER exhausted:    <div class="connection-banner" data-status="exhausted"><span class="connection-dot" data-connection-dot="true" aria-hidden="true"></span><span>Connection lost</span><button type="button">Retry</button></div>
```

## Raw verify output

All commands were run on the real branch workspace. Because T10 was editing
`ActivityFeed*`/`Leaderboard*` in the same worktree during this task, the full-suite
evidence below also includes an isolated detached worktree at `07dd9fb` with **only the six
T9 files** copied in, so the failure attribution is exact.

### `npm run lint`

```text
> lint
> eslint .

LINT_EXIT=0
```

Exit 0.

### `npm run typecheck`

```text
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

Exit 0 (both workspaces).

### `npm test --workspace @cubeclicker/frontend -- src/ui/UpgradesPanel.test.tsx src/ui/UserPanel.test.tsx src/ui/ConnectionBanner.test.tsx`

```text
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/ConnectionBanner.test.tsx (7 tests) 100ms
 ✓ src/ui/UserPanel.test.tsx (13 tests) 173ms
 ✓ src/ui/UpgradesPanel.test.tsx (15 tests) 182ms

 Test Files  3 passed (3)
      Tests  35 passed (35)
```

Exit 0; 35 T9 tests green.

### `npm test --workspace @cubeclicker/frontend`

Pinned command, isolated worktree with only T9 applied:

```text
 FAIL  src/App.test.tsx > App > renders the full intro shell on first paint (default online session, no DOM)
 FAIL  src/App.test.tsx > App > renders the travel phase copy in the same single live region
 FAIL  src/App.test.tsx > App > announces a spectate flight with the target member name (AC-17)
 FAIL  src/App.test.tsx > App > announces the return flight with the pinned copy (AC-18)
 FAIL  src/App.test.tsx > App > renders the playing phase with an empty live region that is still present
 FAIL  src/App.test.tsx > App > renders Return to my cube in the shell exactly while spectating (AC-18)
 FAIL  src/App.test.tsx > App > renders the pinned banner copy per transport status (AC-22)
 Test Files  1 failed | 76 passed (77)
      Tests  7 failed | 2365 passed (2372)
```

Exit 1. Every failure is an `App.test.tsx` whole-shell golden-string comparison whose
expected side (`shellHtml`) still embeds the pre-T9 banner/users/upgrades markup; the
received side contains exactly the new `data-status`/dot, live dot/count/`Crew`/`data-level`
and `upgrades-title`/`upgrades-balance`/`data-affordable`/pips markup. No other test file
fails. In the shared worktree the shared-tree `npx vitest run` reported
`9 failed | 2362 passed` because two additional `App.test.tsx` shell-string tests were red
from T10's in-flight feed/leaderboard markup (received HTML showed the new
`.gf-live-dot`/medal/bar spans); the isolated run above removes that noise.

### `npm run coverage --workspace @cubeclicker/frontend`

Pinned command, isolated T9 worktree — exit 1 from the same seven T8-owned `App.test.tsx`
shell-string tests (Vitest prints no table when the run fails):

```text
 FAIL  src/App.test.tsx > App > renders the full intro shell on first paint (default online session, no DOM)
 … (same seven App.test.tsx golden-string failures as above)
 Test Files  1 failed | 76 passed (77)
      Tests  7 failed | 2365 passed (2372)

npm error Lifecycle script `coverage` failed with error:
npm error code 1
```

Supplementary threshold evidence (same tree, same production set, all tests):

```text
$ npx vitest run --coverage --coverage.reportOnFailure
…
All files          |   96.78 |    96.44 |      98 |   96.78 |
  App.tsx          |    86.5 |    82.47 |   96.42 |    86.5 |
  UserPanel.tsx    |     100 |     100 |    100 |     100 |
```

Exit 1 (the seven App failures) but every aggregate metric clears the ≥80 gate by a wide
margin, and the three T9 files are fully covered: `UserPanel.tsx` is 100/100/100/100, and
`UpgradesPanel.tsx`/`ConnectionBanner.tsx` are omitted from the text table because they are
100% on every metric (the reporter lists only files with uncovered lines).

Supplementary green run with the T8-owned fixture excluded (threshold proof, not the
gate):

```text
$ npx vitest run --coverage --exclude src/App.test.tsx
 Test Files  76 passed (76)
      Tests  2322 passed (2322)

All files          |   93.05 |    96.88 |   97.79 |   93.05 |
  UserPanel.tsx    |     100 |     100 |     100 |     100 |
```

Exit 0. (`App.tsx` reports 0% in this excluded run because `App.test.tsx` is its only
covering test, which is why the all-tests `reportOnFailure` table above is the meaningful
aggregate.) No coverage exclusion or threshold was changed; the pinned command goes green
as soon as T8 updates the `App.test.tsx` shell strings.

### `git diff --check`

```text
$ git diff --check
DIFF_CHECK_EXIT=0
```

Exit 0 (no whitespace errors).

## Acceptance audit

- **AC-20 — met.** `UpgradesPanel` renders the pinned `section[aria-label="Upgrades"].upgrades-panel`
  with `h2.upgrades-title` `Upgrades`, `p.upgrades-balance[data-coins="{coins.toFixed(2)}"]`
  text `Coins {coins.toFixed(2)}`, and per row `data-upgrade`, `data-affordable`,
  `data-name`/`data-level`/`data-effect`/`data-cost`, the existing icon + diamond, the
  circular `.upgrade-buy` and an `aria-hidden` `.upgrade-pips` with exactly `maxLevel`
  `.upgrade-pip[data-filled]` dots. Evidence: exact DOM dump above; `UpgradesPanel.test.tsx`
  zero-state/level/max/coins-5/coins-10/guest golden strings, the pips test (10/10/5 dots
  with 3/0/5 filled), the `data-affordable` test (true/false/true at 25 coins), the
  heading/balance test (`H2`, `upgrades-title`, `data-coins="12.50"`), the buy-callback
  test, and the kept 260 ms `data-purchased`/reduced-motion pulse tests.
- **AC-24 — met.** The toggle keeps `class="users-badge"` and the exact `Users on Server`
  text, gains the `aria-hidden` `.users-count[data-count="{members+1}"]` and `.gf-live-dot`;
  the open `section.users-list[aria-label="Users on server"]` has
  `h2.users-list-title` `Crew` immediately before the `<ul>`, the self row first, the
  `Return to my cube` control while spectating, and member buttons in slot order with
  `data-level` and unchanged text. Evidence: exact DOM dump; `UserPanel.test.tsx`
  golden strings (closed count 1, spectating count 2, three-member count `data-count="4"`,
  `data-level="2"`/`"1"`), the Crew-placement assertion
  (`Crew</h2><ul>` and heading index < `<ul>` index), the jsdom accessible-name test
  (`getByRole('button', { name: 'Users on Server' })`), the spectate test
  (`onSpectate('p2')` once + roster closed) and the return test (`onReturn` once). No
  `aria-live`/`role="status"` is added.
- **AC-25 — met.** The banner root carries `data-status="connecting|disconnected|exhausted"`
  and exactly one `aria-hidden` `.connection-dot[data-connection-dot="true"]` before the
  text; the three copies and the `Retry` control are unchanged and no live-region semantics
  are added. Evidence: exact DOM dump; `ConnectionBanner.test.tsx` exact strings for all
  three statuses, the dot count/`aria-hidden`/first-child loop, the no-live-region test and
  the jsdom `onRetry` once test. The `data-status` colours and reduced-motion dot are pinned
  by T7's `game-view.css`/`game-view.css.test.ts`.
- **AC-28 — met for the T9 surfaces.** `.users-badge` keeps its class (44 px, focus ring,
  disabled state and `--gf-radius-control` are T6/T7 CSS), `.upgrade-buy` keeps
  `class="upgrade-buy"`, `aria-label="Buy"`, 44×44 px circular CSS and the disabled state,
  and `.connection-banner button` (`Retry`) is unchanged with its 44 px CSS. No information
  is colour-only: affordability is also conveyed by the `disabled` control, levels by the
  text and pips, and connection status by the copy. Evidence: `UpgradesPanel.test.tsx` buy
  states, `UserPanel.test.tsx` toggle/return, `ConnectionBanner.test.tsx` Retry; CSS
  evidence in `app.css.test.ts`/`game-view.css.test.ts` (T6/T7).
- **AC-29 — met for the T9 headings/roles.** `Upgrades` is a real `<h2 class="upgrades-title">`
  and `Crew` a real `<h2 class="users-list-title">`, both matching the `app.css` AC-29
  typography selector block (T6); the panel `aria-label`s (`Upgrades`,
  `Users on server`) are retained; the button roles `.upgrade-buy`, `.users-badge` and
  `.connection-banner button` keep their classes for the AC-29 button-role block. Evidence:
  the exact DOM and the heading tests (`getByRole('heading', { level: 2, name: 'Upgrades' })`,
  `getByRole('heading', { level: 2, name: 'Crew' })`).

## Deviations from spec

None in owned source files. Cross-task integration note: the pinned full frontend suite and
the pinned workspace coverage command stay red (seven `App.test.tsx` shell golden-string
tests) until T8 updates `shellHtml` and the shell string constants for the new
`ConnectionBanner`/`UserPanel`/`UpgradesPanel` markup; `App.test.tsx` is T8-owned
(`tasks.md` T8: "Update `App.test.tsx` … for the new HUD/UserPanel/UpgradesPanel/
CustomizationToggle markup/classes/attribute"), was left untouched per `files_owned`, and
the T9-scoped suites are green (35/35).

## Handoff notes for T8

- `BANNER_CONNECTING`/`BANNER_RETRYING`/`BANNER_EXHAUSTED` in `App.test.tsx` need
  `data-status="…"` and the leading
  `<span class="connection-dot" data-connection-dot="true" aria-hidden="true"></span>`.
- `USERS_BADGE_CLOSED`/`_OPEN` need the live dot and
  `<span class="users-count" data-count="N" aria-hidden="true">N</span>` (the count is
  `members.length + 1`; the shell fixtures currently have one member, so `N=2` where a
  member exists and `1` when alone). The open roster needs the `Crew` heading and
  `data-level` on member buttons.
- `upgradesPanel()` needs the `upgrades-title`, `upgrades-balance` (`data-coins`), per-row
  `data-affordable` and the `upgrade-pips` track (10/10/5 pips); the zero-state coins are
  `0.00`.
