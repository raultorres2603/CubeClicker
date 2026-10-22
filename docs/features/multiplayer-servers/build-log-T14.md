# Build log — T14 — UI: shell, connection banner, users panel, return button, HUD server line

Task: T14 (2026-10-22)
Base: `main` @ `8ea761b` (T13)
Files changed: `src/frontend/src/App.tsx`, `src/frontend/src/App.test.tsx`,
`src/frontend/src/ui/Hud.tsx`, `src/frontend/src/ui/Hud.test.tsx`,
`src/frontend/src/ui/UserPanel.tsx` (new), `src/frontend/src/ui/UserPanel.test.tsx` (new),
`src/frontend/src/ui/ConnectionBanner.tsx` (new), `src/frontend/src/ui/ConnectionBanner.test.tsx` (new),
`src/frontend/src/ui/app.css`, `docs/features/multiplayer-servers/build-log-T14.md` (this log)

## Sketch (≤5 lines)

`ConnectionBanner` maps the four transport statuses to the pinned copy (no live-region role).
`UserPanel` owns the `Users on Server` toggle, the open panel (own disabled row first, other
members in slot order), and the `Return to my cube` command while viewing. `Hud` gains the
`Server N` line. `App` subscribes to the engine snapshot and the multiplayer store, composes
the pieces, and keeps one `role="status"` region whose text also covers spectate/return
flights. `app.css` positions the banner/panel and gives every control a focus ring.

## Implementation summary

- **`ui/ConnectionBanner.tsx`** — `connecting` → `Connecting…`, `disconnected` →
  `Connection lost — retrying…`, `exhausted` → `Connection lost` + a real `<button>Retry</button>`
  wired to the session's `retryConnection`, `connected` → nothing. The banner is deliberately
  **not** a live region so the shell keeps exactly one announcement stream.
- **`ui/UserPanel.tsx`** — toggle `<button aria-expanded>` with the exact label `Users on Server`;
  the open panel is `<section aria-label="Users on server">` with the disabled first row
  `{selfName} (You)` and one `<button>{name} · Cube {levelIndex + 1}</button>` per other member
  in the store's slot order. Selecting a member closes the panel and forwards the player id to
  the session. `Return to my cube` renders exactly while `spectating` (the session's
  `spectate.mode === 'viewing'`), independent of the panel state. `defaultOpen` is a documented
  SSR seam (no DOM test environment in this workspace); production never passes it.
- **`ui/Hud.tsx`** — added the fourth pinned line
  `<p>Server <span data-stat="server">{serverId}</span></p>`; the existing clicks/faces/cube lines
  and their markup are unchanged. No live-region semantics (as before).
- **`App.tsx`** — reads the engine store and the new multiplayer store
  (`subscribeMultiplayer` / `getMultiplayerSnapshot`) and composes `GameCanvas`, `Hud`,
  `ConnectionBanner`, `UserPanel`, and the single live region. The live-region text now resolves
  `Traveling to {name}'s cube…` (travel kind `spectate`, name from the authoritative roster) and
  `Returning to your cube…` (travel kind `return`) before falling back to the retained phase
  copy (`intro` hint / `Traveling to the next cube…` / empty playing).
- **Production wiring** — the default shell session is created online:
  `createGameSession({ transport: createTransport() })`. The transport constructs no socket
  until the canvas effect attaches the session, so SSR stays side-effect-free; this closes the
  production gap left by T13 (spec § 9: "The session runs online-only").
- **`ui/app.css`** — top-centred banner, top-right users panel, button/panel styling, disabled
  own row, and `:focus-visible` rings for every shell control. Colours reuse the
  theme-pinned custom properties (`--hud-text`, `--hud-background`, `--accent`).

## Pinned copy table

| State | Source | Rendered text/markup |
| --- | --- | --- |
| transport `connecting` | ConnectionBanner | `Connecting…` |
| transport `disconnected` | ConnectionBanner | `Connection lost — retrying…` |
| transport `exhausted` | ConnectionBanner | `Connection lost` + button `Retry` |
| transport `connected` | ConnectionBanner | no banner |
| panel toggle (always) | UserPanel | button `Users on Server` (`aria-expanded`) |
| panel open | UserPanel | `<section aria-label="Users on server">` |
| own row (first) | UserPanel | disabled button `{name} (You)` |
| member row (slot order) | UserPanel | button `{name} · Cube {level + 1}` |
| spectating (`viewing`) | UserPanel | button `Return to my cube` |
| HUD | Hud | `Server <serverId>` (retained lines unchanged) |
| live region — spectate flight | App | `Traveling to {name}'s cube…` |
| live region — return flight | App | `Returning to your cube…` |
| live region — level travel | App | `Traveling to the next cube…` (retained) |
| live region — intro / playing | App | `Click or press any key to skip` / empty (retained) |

## Pre-existing UI tests changed (and why)

Only supersession-ledgered markup assertions changed; no assertion was weakened or deleted.

- `ui/Hud.test.tsx` (3 tests, all extended): each expected markup now includes the new
  `<p>Server <span data-stat="server">N</span></p>` line and passes the new `serverId` prop
  (0 / 7 / 3). Ledger: spec § Supersessions — cube-game-frontend AC-1 shell markup, AC-23
  HUD server line. The original clicks/faces/cube markup and the "not a live region"
  assertions are retained verbatim.
- `App.test.tsx` (4 tests → 8): the four original scenarios (intro first paint, travel copy,
  empty playing region, HUD binding + one live region) are retained with the ledgered shell
  additions (connection banner, users-panel toggle, HUD server line). New tests pin the two
  pinned flight announcements, the return-button presence rule, the banner copy per status,
  and the store-bound `Server 7` line. Ledger: cube-game-frontend AC-1 (shell markup) and
  AC-14 (live region additions).
- `ui/GameCanvas.test.tsx`, `ui/theme.test.ts`: unchanged.

## Evidence

### Tests

```
$ npm test --workspace @cubeclicker/frontend
> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/multiplayer/protocol.test.ts (112 tests) 19ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 7ms
 ✓ src/game/effects.test.ts (28 tests) 9ms
 ✓ src/browser-env.test.ts (6 tests) 19ms
 ✓ src/multiplayer/server-state.test.ts (31 tests) 13ms
 ✓ src/game/progression.test.ts (10 tests) 9ms
 ✓ src/ws/connection.test.ts (10 tests) 21ms
 ✓ src/ui/theme.test.ts (2 tests) 5ms
 ✓ src/game/rotation.test.ts (15 tests) 10ms
 ✓ src/render/webgl.test.ts (5 tests) 10ms
 ✓ src/game/board.test.ts (18 tests) 34ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 10ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 26ms
 ✓ src/game/engine.test.ts (58 tests) 68ms
 ✓ src/render/particles.test.ts (19 tests) 35ms
 ✓ src/input/gestures.test.ts (21 tests) 9ms
 ✓ src/input/keyboard.test.ts (13 tests) 20ms
 ✓ src/ui/Hud.test.tsx (3 tests) 23ms
 ✓ src/ui/UserPanel.test.tsx (5 tests) 17ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 12ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 38ms
 ✓ src/render/cube-view.test.ts (32 tests) 83ms
 ✓ src/render/starfield.test.ts (15 tests) 133ms
 ✓ src/render/picking.test.ts (12 tests) 122ms
 ✓ src/render/world.test.ts (19 tests) 75ms
 ✓ src/App.test.tsx (8 tests) 26ms
 ✓ src/game/session.test.ts (41 tests) 171ms
 ✓ src/render/scene.test.ts (68 tests) 210ms

 Test Files  28 passed (28)
      Tests  602 passed (602)
   Start at  10:24:13
   Duration  1.29s (transform 5.58s, setup 0ms, collect 13.04s, tests 1.23s, environment 6ms, prepare 5.67s)
```

Exit code: 0. New test files: `App.test.tsx` (8), `Hud.test.tsx` (3),
`UserPanel.test.tsx` (5), `ConnectionBanner.test.tsx` (5). No banned matchers in the
new/changed test files (grep exit 1 = no matches):

```
$ grep -nE "expect\.(anything|any|closeTo)|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeDefined\(|toBeTruthy\(|toBeCloseTo|toHaveBeenCalled\(\)" src/frontend/src/App.test.tsx src/frontend/src/ui/Hud.test.tsx src/frontend/src/ui/UserPanel.test.tsx src/frontend/src/ui/ConnectionBanner.test.tsx
GREP_EXIT:1
```

### Coverage (workspace gate)

```
$ npm run coverage --workspace @cubeclicker/frontend
 Test Files  28 passed (28)
      Tests  602 passed (602)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   99.04 |    98.28 |   99.25 |   99.04 |
 src               |     100 |      100 |     100 |     100 |
  App.tsx          |     100 |      100 |     100 |     100 |
  browser-env.ts   |     100 |      100 |     100 |     100 |
 src/game          |   98.98 |    98.1 |     100 |   98.98 |
  board.ts         |     100 |      100 |     100 |     100 |
  effects.ts       |     100 |      100 |     100 |     100 |
  engine.ts        |     100 |      100 |     100 |     100 |
  progression.ts   |     100 |      100 |     100 |     100 |
  rotation.ts      |     100 |      100 |     100 |     100 |
  session.ts       |   97.71 |    95.65 |     100 |   97.71 | ...21-622,626-629
  types.ts         |     100 |      100 |     100 |     100 |
 src/input         |     100 |      100 |     100 |     100 |
  gestures.ts      |     100 |      100 |     100 |     100 |
  keyboard.ts      |     100 |      100 |     100 |     100 |
 src/multiplayer   |   99.73 |    99.24 |     100 |   99.73 |
  protocol.ts      |     100 |      100 |     100 |     100 |
  server-state.ts  |   99.18 |    97.18 |     100 |   99.18 | 119-120
  spectate.ts      |     100 |      100 |     100 |     100 |
  transport.ts     |     100 |      100 |     100 |     100 |
 src/render        |   99.83 |    97.84 |     100 |   99.83 |
  cube-view.ts     |     100 |      100 |     100 |     100 |
  particles.ts     |     100 |      100 |     100 |     100 |
  picking.ts       |     100 |      100 |     100 |     100 |
  scene.ts         |   99.54 |    98.41 |     100 |   99.54 | 757-758
  ...ate-travel.ts |     100 |      100 |     100 |     100 |
  starfield.ts     |     100 |      100 |     100 |     100 |
  webgl.ts         |     100 |      100 |     100 |     100 |
  world.ts         |     100 |    93.5 |     100 |     100 | ...85,193,271-274
 src/ui            |   88.98 |      100 |   66.66 |   88.98 |
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |
  GameCanvas.tsx   |    61.9 |      100 |     100 |    61.9 | 23-30
  Hud.tsx          |     100 |      100 |     100 |     100 |
  UserPanel.tsx    |      90 |      100 |   33.33 |      90 | 48-49,71-73
  theme.ts         |     100 |      100 |     100 |     100 |
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100
-------------------|---------|----------|---------|---------|-------------------
```

Exit code: 0. Workspace aggregate is above the 80 gate on all four metrics
(99.04 / 98.28 / 99.25 / 99.04). `UserPanel.tsx`'s uncovered lines are its click handlers
(toggle / member selection), which SSR cannot invoke in this DOM-less workspace; this is
the same documented React residual as the pre-existing `GameCanvas.tsx` effect and does not
affect the per-workspace gate. `ConnectionBanner.tsx` and `Hud.tsx` are at 100%.

### Typecheck, lint, build

```
$ npm run typecheck --workspace @cubeclicker/frontend
> typecheck
> tsc --noEmit
EXIT:0

$ npm run lint
> lint
> eslint .
EXIT:0
```

```
$ npm run build --workspace @cubeclicker/frontend
> build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 58 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.40 kB │ gzip:   0.27 kB
dist/assets/index-DTvgIu_V.css    2.96 kB │ gzip:   0.94 kB
dist/assets/index-BBbyci5a.js   793.75 kB │ gzip: 216.27 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application or
- Adjust build.chunkSizeWarningLimit.
✓ built in 2.33s
EXIT:0
```

Initial JS gzip is **216.27 kB**, inside the 350 kB budget (AC-24). The >500 kB
minified warning is the pre-existing three.js bundle size, not a regression gate.

## Acceptance audit

- **AC-16 — "Users on Server" button & panel.** MET. `UserPanel.test.tsx` pins the exact
  toggle markup (`Users on Server`, `aria-expanded="false"/"true"`), the open panel
  (`<section aria-label="Users on server">`), the empty roster (own disabled row only:
  `Player 1 (You)`), and slot-order member rows (`Player 2 · Cube 2`, `Player 3 · Cube 1`).
  `App.test.tsx` pins the toggle in the composed shell. Selecting a member closes the panel
  and forwards the id; the session owns the travel rules (T13 tests).
- **AC-18 — Return to my cube (markup).** MET. `UserPanel.test.tsx` renders the exact
  `<button type="button">Return to my cube</button>` while spectating and asserts its
  absence otherwise; `App.test.tsx` pins the same presence rule in the full shell. The
  command's dispatch/arrival semantics are the T13 session/spectate tests.
- **AC-22 — Connection states (banner).** MET. `ConnectionBanner.test.tsx` pins the three
  exact copy states plus the `Retry` button and the connected/absent state; `App.test.tsx`
  pins the banner inside the shell for `disconnected` and `exhausted`, with exactly one
  live region. `App` wires `onRetry` to `session.retryConnection` (the close→connect
  behaviour is pinned by T13's session test).
- **AC-23 — HUD server line.** MET. `Hud.test.tsx` pins
  `<p>Server <span data-stat="server">N</span></p>` for 0, 7 and 3 while retaining the
  existing stat lines; `App.test.tsx` binds the line to `world.serverId` (`Server 7` test)
  and shows `Server 1` in the travelled/spectate shells; the default intro shell (no
  `welcome` yet) shows the store's `Server 0`.

## Deviations from spec

1. **App owns the production transport injection.** T13 left `createGameSession()` without
   a transport (offline/inert) and T14 owns the shell; spec § 9 requires online-only in
   production and `main.tsx` is intentionally unchanged, so `App` now creates
   `createTransport()` for its default session. SSR tests inject a fake `OnlineGameSession`;
   the transport opens no socket before the canvas effect attaches.
2. **Panel/HUD before the first `welcome`.** The store is empty until then, so the HUD shows
   `Server 0` and the (closed-by-default) panel's own row would be an empty-name `(You)` if
   opened during the intro. The panel starts closed and no interaction is required for
   AC-16; after `welcome` the real name/server id are shown. No synthetic placeholder copy
   was added because the spec pins the exact row format only for real members.
3. **`UserPanel.defaultOpen` SSR seam.** The workspace has no DOM environment, so the open
   panel is pinned by rendering it open. It is test-only (production omits it) and mirrors
   the existing injected-session seam.
4. **Live-region fallback when the spectated target leaves mid-flight.** The store removes
   the member and the spectate machine drops to `none`; while the in-flight camera travel
   finishes, the region falls back to the retained travel copy (`Traveling to the next
   cube…`) and switches to `Returning to your cube…` once the auto-return flight starts.
   The pinned member-name announcement is used whenever the target is still in the roster.
5. **Cross-server swap display.** The panel and HUD read the current `world` until the
   travel midpoint, then switch to the target roster/`serverId` when the session applies
   the swap — matching AC-12 ("after the swap the mover's Users on Server panel shows the
   new server's roster"). The pending roster is not shown early (T13 open question 3:
   answered as "current world until the midpoint").

No new dependencies; no storage APIs; no changes outside `files_owned`.

## Open questions

- Should the intro (pre-`welcome`) hide the users-panel toggle until an identity exists, or
  is the always-visible toggle acceptable? Current behaviour renders it unconditionally
  (the button is present in every phase, satisfying "always visible while playing" and
  keeping one shell shape); it starts closed, so no empty-name row is visible without a
  click.
- Should the connection banner announce the transition to `exhausted` for screen-reader
  users? That would require a second live region, which the pinned single-region rule
  forbids; the banner text is readable by navigation. Left as-is unless the rule changes.

## Raw diff stat (owned files, pre-commit)

```
$ git diff --stat -- src/frontend/src/App.tsx src/frontend/src/App.test.tsx \
    src/frontend/src/ui/Hud.tsx src/frontend/src/ui/Hud.test.tsx src/frontend/src/ui/app.css
 src/frontend/src/App.test.tsx    | 273 ++++++++++++++++++++++++++++++++++++---
 src/frontend/src/App.tsx         |  82 +++++++++---
 src/frontend/src/ui/Hud.test.tsx |  19 ++-
 src/frontend/src/ui/Hud.tsx      |  25 +++-
 src/frontend/src/ui/app.css      | 118 ++++++++++++++++-
 5 files changed, 462 insertions(+), 55 deletions(-)

$ git status --porcelain -- src/frontend/src/ui/UserPanel*.tsx \
    src/frontend/src/ui/ConnectionBanner*.tsx
?? src/frontend/src/ui/ConnectionBanner.test.tsx
?? src/frontend/src/ui/ConnectionBanner.tsx
?? src/frontend/src/ui/UserPanel.test.tsx
?? src/frontend/src/ui/UserPanel.tsx
```
