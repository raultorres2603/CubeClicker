# Build log — T8 — HUD and app-shell markup

Task: T8 (2026-11-16), feature `game-feel-overhaul`, branch `feat/game-feel-overhaul`
at `a586547` (`feat: add the Neon Forge upgrades, crew and connection markup`).

Files changed (only `files_owned`):

- `src/frontend/src/ui/icons.tsx`
- `src/frontend/src/ui/icons.test.tsx`
- `src/frontend/src/ui/Hud.tsx`
- `src/frontend/src/ui/Hud.test.tsx`
- `src/frontend/src/App.tsx`
- `src/frontend/src/App.test.tsx`
- `docs/features/game-feel-overhaul/build-log-T8.md` (this file)

Tree check before commit: `git status --porcelain` showed exactly the six modified
sources plus this untracked build log; the orchestrator artifacts (`spec.md`, `plan.md`,
`tasks.md`, `status.md`, `reviews/`) stayed untracked and were never staged.

## Change sketch (≤5 lines, before implementing)

1. `icons.tsx`: add decorative `KeyIcon` (`data-icon="key"`) and `LootboxIcon`
   (`data-icon="lootbox"`) with inline shapes only.
2. `Hud`: section → `.hud-header` (`h2.hud-title` `Pilot status` + `span.hud-level
   [data-stat=cube]`), `.hud-resources` (`role="group" aria-label="Resources"`, three
   chips coins/keys/lootboxes with `.hud-resource-value`), `.hud-grid` (three rows
   clicks/faces-destroyed/server), toggle last; add `keys`/`lootboxes` props; coin pops
   move inside the coins chip.
3. `App`: render the `.game-ambience` layer and pass `snapshot.customization` counts to
   `Hud`; keep the pre-welcome stats section, the single `.phase-announcement`, and never
   set `data-reveal-active` on `<main>`.
4. `App.test.tsx`: rewrite the stale shell fixtures (HUD/banner/users/upgrades/feed/
   leaderboard) to the T9/T10 markup and add the App-level AC-2/AC-11/AC-13/AC-19/AC-27/
   AC-29/AC-31 assertions.
5. Verify: lint, typecheck, frontend tests, frontend coverage, `git diff --check`.

## What changed & why

1. **`icons.tsx`** adds two decorative inline-SVG icons with the shared `Icon` wrapper:
   `KeyIcon` (`data-icon="key"`, one circle + one multi-subpath path) and `LootboxIcon`
   (`data-icon="lootbox"`, three paths). Both are `aria-hidden="true"`,
   `focusable="false"`, `stroke="currentColor"`, 24×24 `viewBox`, contain no
   `href`/`<use>`/`<image>`/`<foreignObject>`; every existing icon is byte-for-byte
   unchanged (`CubeLevelIcon` is retained per the plan even though the HUD no longer
   renders it).
2. **`Hud.tsx`** is restructured to the AC-19 contract. The section keeps
   `class="hud-panel"`/`aria-label="Game statistics"`, `data-minimized` and
   `data-blinking`, and now renders, in order: `.hud-header` (a real `h2.hud-title`
   `Pilot status` + `span.hud-level[data-stat="cube"]` `Cube N`), `.hud-resources`
   (`role="group" aria-label="Resources"`, exactly three chips `data-resource="coins"`,
   `"keys"`, `"lootboxes"` carrying the `CoinIcon`/`KeyIcon`/`LootboxIcon`, the exact
   labels `Coins`/`Keys`/`Lootboxes` and
   `span.hud-resource-value[data-stat=…]` values), `.hud-grid` with exactly three
   `p.hud-row` rows `clicks`/`faces-destroyed`/`server`, and the optional minimize
   control last (`aria-label="Toggle HUD"`, `aria-expanded`). The old coin/cube rows are
   gone; the coin value moved into the coins chip (`data-stat="coins"`), and the coin
   popup queue now renders **inside** the coins chip so `.hud-panel [data-resource='coins']`
   remains its positioning context. New `keys`/`lootboxes` props default to `0`. No
   `data-stat` value appears twice (seven unique hooks). The accepted 24 px target is
   untouched: the control is still a direct `<button>` child of `main > section`, sized
   by the retained `main > section button { min-width/min-height: 1.5rem }` rule.
3. **`App.tsx`** renders exactly one decorative ambience layer inside the game `<main>`,
   directly after `<GameCanvas>` and before the panels:
   `<div class="game-ambience" aria-hidden="true" data-reduced-motion="true|false">` with
   `data-reduced-motion` from `snapshot.reducedMotion` (AC-27). It also forwards
   `keys={snapshot.customization?.keys ?? 0}` and
   `lootboxes={snapshot.customization?.lootboxes ?? 0}` to `Hud` (AC-19). The pre-welcome
   `<section aria-label="Game statistics">` (three `<p>` rows, `data-stat` clicks /
   faces-destroyed / cube), the single `.phase-announcement` polite region, the
   customize-toggle wiring and the deferred customization panel are unchanged; `<main>`
   never gains `data-reveal-active` and no scrim is rendered.
4. **Tests.** `Hud.test.tsx` is rewritten around a byte-exact AC-19 golden helper and adds
   focused header/level-chip, Resources-group, three-row, data-stat-uniqueness,
   minimized-set, no-live-region and coin-pop-inside-the-chip tests (the accepted blink,
   toggle and coin-pop behaviour suites are kept). `icons.test.tsx` adds the `key` and
   `lootbox` cases and moves the module contract to fourteen exports. `App.test.tsx`
   rewrites `BANNER_*`, the users badge/panel, `hudMarkup`, `upgradesPanel` and the
   `shellHtml` builder to the T9/T10 markup (plus the ambience element), updates the
   feed/leaderboard expected strings, and adds the App-level AC-2/AC-11/AC-13/AC-19/
   AC-27/AC-29/AC-31 suite described below.

## Exact DOM/data/ARIA evidence

Rendered by the real components through `renderToStaticMarkup` / RTL+jsdom; SVG children
are elided as `[coin icon]`/`[key icon]`/`[lootbox icon]`/`[cursor icon]`/`[cube icon]`/
`[server icon]` only for readability — `Hud.test.tsx` and `App.test.tsx` pin the complete
strings with `toBe`/`toContain`.

### HUD, welcomed, expanded (`clicks 0`, `faces 0`, `coins 0.00`, `cube 1`, `server 0`, keys 0, lootboxes 0)

```text
<section aria-label="Game statistics" class="hud-panel">
  <div class="hud-header">
    <h2 class="hud-title">Pilot status</h2>
    <span class="hud-level" data-stat="cube">Cube 1</span>
  </div>
  <div class="hud-resources" role="group" aria-label="Resources">
    <span data-resource="coins">[coin icon]Coins <span class="hud-resource-value" data-stat="coins">0.00</span></span>
    <span data-resource="keys">[key icon]Keys <span class="hud-resource-value" data-stat="keys">0</span></span>
    <span data-resource="lootboxes">[lootbox icon]Lootboxes <span class="hud-resource-value" data-stat="lootboxes">0</span></span>
  </div>
  <div class="hud-grid">
    <p class="hud-row" data-row="clicks">[cursor icon]Clicks: <span data-stat="clicks">0</span></p>
    <p class="hud-row" data-row="faces-destroyed">[cube icon]Faces destroyed: <span data-stat="faces-destroyed">0</span></p>
    <p class="hud-row" data-row="server">[server icon]Server <span data-stat="server">0</span></p>
  </div>
</section>
```

With `onToggleMinimize` the last child is
`<button type="button" aria-expanded="true" aria-label="Toggle HUD"></button>`; minimized
it is `data-minimized="true"` + `aria-expanded="false"`, while `.hud-header`,
`.hud-resources` and `.hud-grid` all remain rendered (the grid is hidden only by
`.hud-panel[data-minimized='true'] .hud-grid { display: none; }`, T7 CSS). Coin popups
render inside the coins chip as
`<span class="hud-coin-pops" aria-hidden="true" data-coin-pops="true"><span class="hud-coin-pop" data-coin-pop="1" data-amount="0.5">+0.50</span>…</span>`.

### Pre-welcome shell stats (unchanged, AC-19)

```text
<section aria-label="Game statistics">
  <p>Clicks: <span data-stat="clicks">5</span></p>
  <p>Faces destroyed: <span data-stat="faces-destroyed">2</span></p>
  <p>Cube <span data-stat="cube">3</span></p>
</section>
```

No `.hud-panel` class, no `.hud-header`/`.hud-resources`/`.hud-grid`/`.hud-level`, no
`Pilot status`, no `Toggle HUD`; exactly three `<p>` rows and one occurrence of each of
the three `data-stat` hooks.

### Ambience layer (AC-27)

```text
<main data-customization-open="false">
  <canvas tabindex="0" aria-label="Game canvas: …" style="touch-action:none"></canvas>
  <div class="game-ambience" aria-hidden="true" data-reduced-motion="false"></div>
  …
</main>
```

Exactly one direct `.game-ambience` child of the game `<main>`; `aria-hidden="true"`;
`data-reduced-motion` is `"true"` when `snapshot.reducedMotion` is true and `"false"`
otherwise (both pinned). The layering/pointer-events/scanline declarations are T7 CSS.

### Reveal region on the opener tab (AC-2)

```text
<section aria-label="Spaceship customization" class="customization-panel" data-mode="guest"
         data-reveal-active="true" data-part-id="wing-left-silver" data-slot="wing-left"
         data-rarity="rare" data-duplicate="false">
  <div class="lootbox-reveal" role="group" aria-live="off"
       aria-label="Lootbox reveal: Port Silver Wing" data-reveal-active="true"
       data-reveal-sequence="1" …>
    … Port Silver Wing …
  </div>
</section>
```

### Single settled-shell polite region (AC-31)

```text
<div class="phase-announcement" role="status" aria-live="polite">…</div>
```

`getAllByRole('status')` has length 1 in the settled welcomed shell, in the shell with the
customization chunk resolved and while the reveal is mounted; `[aria-live="polite"]` is
exactly 1, `[aria-live="assertive"]`, `[role="alert"]` and `[role="log"]` are 0.

## App-level reveal assertions (AC-2, AC-11, AC-13)

All three live in `App.test.tsx` → `describe('App — reveal ownership and shell
accessibility …')` and drive the real `App` + real components; only the session store
boundary is faked (`sessionFor`/`mutableSession`, the existing integration seam).

- **AC-2 — opener-only rendering.** Opener session: snapshot with the adopted
  `customization.parts` **and** `lastLootboxGrant = { partId: 'wing-left-silver', slot:
  'wing-left', rarity: 'rare', duplicate: false, sequence: 1 }`. Asserted: the panel
  `data-reveal-active="true"`, `data-part-id="wing-left-silver"`,
  `data-slot="wing-left"`, `data-rarity="rare"`; the reveal root `role="group"`,
  `aria-live="off"`, `aria-label="Lootbox reveal: Port Silver Wing"`,
  `data-reveal-sequence="1"`, `data-reveal-active="true"` and the part name text. The same
  account's second tab: identical adopted `customization.parts` but
  `lastLootboxGrant = null` (it received only `customizationUpdate`). Asserted:
  `Open lootbox` present, panel `data-reveal-active="false"`, 0 `.lootbox-reveal`,
  30 `.customization-panel .customization-variant` (the part is still owned in that tab),
  no `Dismiss lootbox reveal`. The session/hub one-shot proof stays in
  `hub.test.ts`/`session.test.ts` (T4).
- **AC-11 — mid-reveal status change.** `mutableSession` starts with the grant and
  `status: 'connected'`; the reveal is awaited. Then the session boundary does what
  `OnlineGameSession.handleStatus` (T4) does on a non-`connected` status — clear the grant
  and publish the engine snapshot, then publish multiplayer — in one `act`. Asserted: 0
  `.lootbox-reveal`, 0 `[data-reveal-active="true"]`, panel `data-reveal-active="false"`,
  `Open lootbox` back with text `Open lootbox`, and the banner
  `data-status="disconnected"`. Because the shell reads the grant only from the store
  snapshot, no local copy can keep the reveal alive.
- **AC-13 — toggle-click close is a dismissal.** The reveal is awaited, the toggle is
  focused, then clicked. Asserted: `dismissLootboxReveal` called exactly once (the panel's
  unmount-only cleanup), 0 `.customization-panel`, 0 `.lootbox-reveal`, no `Open lootbox`
  button, and `document.activeElement === toggle` (the activator keeps focus; no
  restoration to the absent button). After the session publishes the cleared grant,
  reopening the panel renders the normal branch (`Open lootbox`, no reveal) with the
  toggle `aria-expanded="true"`.

## Decisions

- **`.hud-grid` is the minimized collapse seam.** The header and the resource strip are
  elevation-worthy, so AC-19 hides only the stat grid. Keeping all three containers in the
  DOM while minimized lets the CSS rule (T7) own visibility and keeps the component
  markup stable; `Hud.test.tsx` pins the rendered set and `game-view.css.test.ts` pins the
  exact `display: none` rule.
- **The coin popup moves with the coin value.** AC-19 requires `coinPops` inside the coins
  chip, and the T7 CSS positions `.hud-coin-pops` against
  `.hud-panel [data-resource='coins']`; putting the queue after the value keeps both true
  and makes the popup overlay the chip's right edge as designed.
- **`keys`/`lootboxes` are optional with a `0` default.** The HUD stays renderable from
  `stats`/`levelIndex`/`serverId` alone (pre-existing callers/tests), and `App` always
  supplies the authoritative counts from `snapshot.customization` (guest and account share
  the same engine snapshot).
- **The ambience is a sibling of the canvas, not of the panels.** It sits directly after
  `<GameCanvas>` inside `<main>`; `z-index: 2` between canvas 0 and panels 3 (T7) does the
  layering, so DOM order stays the accepted panel order and the auth gate still renders
  over everything.
- **The App-level reveal tests use the store seam, not a real WebSocket.** Session-level
  behaviour (one-shot grant, welcome/status clearing) is T4-owned and tested in
  `session.test.ts`; T8 owns the rendering contract — the shell renders the reveal from the
  snapshot grant and re-renders when that snapshot changes. Faking the store boundary is
  the existing `App.test.tsx` integration pattern (and keeps the real deferred panel, the
  real reveal component and the real fallback in the loop).
- **No CSS edit.** The AC-19 minimized rule, the `.game-ambience` layering and the
  `--gf-*` typography are T7/T6-owned and already green; T8 only emits the matching
  classes/attributes.

## Raw verify output

Run on the final working tree (all six sources + this build log; no commit yet). The
jsdom `HTMLCanvasElement.getContext()` / `THREE.WebGLRenderer: Error creating WebGL
context` lines on stderr are the expected AC-10 fallback path (T3): jsdom has no WebGL, so
`LootboxReveal` renders its inline-SVG fallback — they are not failures.

### `npm run lint`

```text
> lint
> eslint .

LINT_EXIT=0
```

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

### `npm test --workspace @cubeclicker/frontend`

```text
> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/game/parts-v2.test.ts (50 tests) 23ms
 ✓ src/render/webgl.test.ts (25 tests) 20ms
 ✓ src/multiplayer/protocol.test.ts (554 tests) 46ms
 …

 ✓ src/App.test.tsx (61 tests) 1325ms

 Test Files  77 passed (77)
      Tests  2392 passed (2392)
   Start at  17:24:18
   Duration  3.84s (transform 10.67s, setup 0ms, collect 24.18s, tests 13.88s, environment 10.81s, prepare 6.06s)

TEST_EXIT=0
```

Baseline before T8 was `1 failed | 76 passed (77)` / `9 failed | 2366 passed (2375)`
(T9/T10 handoff: the stale `App.test.tsx` shell fixtures). All nine are green here, and the
count grows by the 17 new T8 tests (Hud 19→24, icons 16→18, App 50→61).

### `npm run coverage --workspace @cubeclicker/frontend`

```text
> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8
…
 Test Files  77 passed (77)
      Tests  2392 passed (2392)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |    96.8 |    96.45 |      98 |    96.8 |
 src               |    88.2 |    85.77 |   95.45 |    88.2 |
  App.tsx          |   86.67 |    83.08 |   96.42 |   86.67 | ...35-437,459-460
  browser-env.ts   |   92.72 |      100 |   91.66 |   92.72 | 74-77
  config.ts        |     100 |      100 |     100 |     100 |
…
 src/ui            |   97.51 |    95.19 |    96.9 |   97.51 |
  ActivityFeed.tsx |     100 |      100 |     100 |     100 |
  AuthForms.tsx    |     100 |    99.07 |     100 |     100 | 219
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |
  ...ionToggle.tsx |     100 |      100 |     100 |     100 |
  ...tionPanel.tsx |   91.66 |    86.66 |     100 |   91.66 | 60-61,66-67
  GameCanvas.tsx   |   96.61 |       95 |     100 |   96.61 | 62-63
  Hud.tsx          |     100 |      100 |     100 |     100 |
  Leaderboard.tsx  |     100 |      100 |     100 |     100 |
  ...eteBanner.tsx |     100 |      100 |     100 |     100 |
  ...boxReveal.tsx |   98.24 |    94.94 |     100 |   98.24 | 152-153,273-274
  PerfOverlay.tsx  |   98.52 |      100 |     100 |   98.52 | 84
  ...tionPanel.tsx |    96.9 |    91.96 |     100 |    96.9 | ...71-272,278-279
  ...ipPreview.tsx |    87.2 |    77.41 |      75 |    87.2 | ...24-125,130-131
  ...adesPanel.tsx |    97.1 |    91.89 |     100 |    97.1 | 84-85,103-104
  UserPanel.tsx    |     100 |      100 |     100 |     100 |
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |
  icons.tsx        |     100 |      100 |     100 |     100 |
  theme.ts         |     100 |      100 |     100 |     100 |
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100
-------------------|---------|----------|---------|---------|-------------------

COVERAGE_EXIT=0
```

All four aggregates clear the pinned ≥ 80 threshold per workspace; no exclusion or
threshold was changed. The three T8 files: `Hud.tsx` 100/100/100/100, `icons.tsx`
100/100/100/100, `App.tsx` 86.67/83.08/96.42/86.67.

### `git diff --check`

```text
$ git diff --check
DIFF_CHECK_EXIT=0
```

Exit 0 (no whitespace errors).

## Acceptance audit

- **AC-2 — Account grant and opener-only reveal → met (App evidence).** The App renders
  the reveal only from the snapshot's `lastLootboxGrant`: on the opener it renders the
  panel `data-reveal-active="true"` with the catalog identity and the reveal root
  `role="group" aria-live="off" aria-label="Lootbox reveal: Port Silver Wing"
  data-reveal-sequence="1"`; a second tab with the same adopted `parts` and a `null` grant
  renders `data-reveal-active="false"`, the normal `Open lootbox` panel and zero
  `.lootbox-reveal` nodes while still showing the 30 catalog variants. Evidence:
  `App.test.tsx` → `renders the reveal on the opener tab and never on a second tab …`;
  session/hub one-shot and `customizationUpdate`-only coverage in `session.test.ts`/
  `hub.test.ts` (T4).
- **AC-11 — Reconnect, status change and multi-tab one-shot → met (App evidence).** A
  mid-reveal non-`connected` status (session clears the grant, publishes the engine
  snapshot then multiplayer, per T4) removes the reveal: zero `.lootbox-reveal`, panel
  `data-reveal-active="false"`, `Open lootbox` restored, banner `data-status="disconnected"`.
  Evidence: `App.test.tsx` → `drops a mid-reveal when the transport leaves connected …`;
  session-level clearing and ordering in `session.test.ts` (T4).
- **AC-13 — Panel close is a dismissal → met (App evidence).** Clicking the customization
  toggle while revealing calls `dismissLootboxReveal` exactly once (unmount cleanup),
  unmounts the reveal/panel, leaves no `Open lootbox` target and keeps focus on the
  activator (`document.activeElement === toggle`); reopening after the cleared grant
  renders the normal panel with no reveal. Evidence: `App.test.tsx` → `treats a
  toggle-click close as a dismissal …`; panel-level unmount/focus split in
  `SpaceshipCustomizationPanel.test.tsx` (T5).
- **AC-19 — HUD markup, data and minimized/pre-welcome states → met.** `Hud` renders the
  exact header (`h2.hud-title` `Pilot status`, `span.hud-level[data-stat="cube"]`
  `Cube N`), the `role="group" aria-label="Resources"` strip with exactly three
  `data-resource` chips (`data-icon` `coin`/`key`/`lootbox`, labels `Coins`/`Keys`/
  `Lootboxes`, `.hud-resource-value[data-stat]` values with coins two decimals), the three
  `hud-grid` rows, the toggle last with `aria-label="Toggle HUD"`/`aria-expanded`, seven
  unique `data-stat` hooks, coin pops inside the coins chip, no live region, and the
  retained `blinking`/`data-blinking` and 24 px `main > section button` target (no class or
  inline size added). Minimized keeps header + resources + grid rendered with
  `data-minimized="true"`; the collapse is the T7 rule
  `.hud-panel[data-minimized='true'] .hud-grid { display: none; }`. Pre-welcome `App`
  keeps the accepted three-row section with exact labels and hooks and no HUD chrome; the
  HUD keys/lootboxes come from `snapshot.customization`. Evidence: `Hud.test.tsx` (exact
  golden markup, header/resources/rows, uniqueness, minimized set, toggle, blink, coin
  pops), `icons.test.tsx` (key/lootbox shapes and 14-export contract), `App.test.tsx`
  (welcomed shell, customization counts, minimized toggle, pre-welcome rows), T7
  `game-view.css.test.ts` for the minimized rule.
- **AC-27 — Ambience and layering (non-modal) → met (App evidence).** Exactly one
  `<div class="game-ambience" aria-hidden="true" data-reduced-motion="true|false">` is a
  direct child of the game `<main>`, with `data-reduced-motion` following the session
  preference (both values pinned). There is no `data-reveal-active` on `<main>` and no
  scrim; the reveal stays non-modal and the toggle (z-index 21 in T7 CSS) is still
  clickable while revealing (the test clicks it and the panel closes). The pointer-events,
  `inset: 0`, `z-index: 2`, layers and reduced-motion `animation: none` are pinned by T7's
  `game-view.css.test.ts`. Evidence: `App.test.tsx` → `renders one decorative ambience
  layer …`, `marks the ambience reduced …`.
- **AC-29 — Typography and headings → met (component evidence).** The HUD title is a real
  `<h2 class="hud-title">Pilot status</h2>`; the welcomed shell and the open customization
  panel expose `Pilot status`, `Spaceship hangar` and `Upgrades` as level-2 headings with
  their pinned classes, and the panel aria-labels (`Game statistics`, `Spaceship
  customization`, `Upgrades`) are retained. The declarations live in T6's `app.css` block
  (unchanged, `app.css.test.ts` green); `.hud-resource-value`, `.hud-level` and the button
  roles already carry the classes used here. Evidence: `Hud.test.tsx` (heading role/level/
  class), `App.test.tsx` → `keeps the gameplay headings real h2 elements …`.
- **AC-31 — Accessibility, single live region and contrast → met (T8 scope).** In the
  settled welcomed shell there is exactly one polite live region
  (`.phase-announcement`, `role="status" aria-live="polite"`); it stays exactly one after
  the deferred customization chunk resolves and while the reveal is mounted (the reveal is
  `role="group" aria-live="off"` and adds none), with zero assertive/alert/log regions.
  Every new HUD icon and the ambience layer are `aria-hidden`. The HUD minimize control
  keeps its accepted 24 px target; no new interactive control is added. Evidence:
  `App.test.tsx` → three live-region tests; `Hud.test.tsx` no-live-region + `aria-hidden`
  icon pins; CSS focus/contrast gates in T6/T7 suites.

## Deviations from spec

None in T8's owned source files or tests.

## Reviewer / T11 note (T7-owned, not fixed here)

`App` emits `data-reduced-motion="true|false"` on `.game-ambience` as AC-27 requires, but
`game-view.css` disables the ambience scanline only in the
`@media (prefers-reduced-motion: reduce)` block; there is no
`.game-ambience[data-reduced-motion='true']::before { animation: none; }` rule. A session
`reducedMotion` preference that is not mirrored by the OS media query therefore still
animates the scanline. This is a `game-view.css` (T7) gap, outside T8's `files_owned`; T8
records it so the reviewer/T11 can decide whether T7 needs the matching selector. T8's
evidence for AC-27 covers the attribute contract and the non-modal/toggle-click path; the
CSS declarations remain T7's pinned evidence.

## Handoff notes for T11

- The full frontend suite is green (77 files / 2392 tests) and coverage is green
  (96.8/96.45/98/96.8), so the T9/T10 stale `App.test.tsx` fixtures are fully reconciled.
- `App.test.tsx` now owns the App-level AC-2/AC-11/AC-13 assertions and the AC-31
  single-polite-region gates; keep them green through the documentation pass.
- The manual matrix should still confirm the minimized HUD visually (header + resources
  visible, grid collapsed), the pre-welcome stats panel, the ambience under the panels,
  and exactly one polite live region in the browser.
