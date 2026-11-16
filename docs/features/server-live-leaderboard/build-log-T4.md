# Build log — T4 — Leaderboard UI, App wiring, CSS, smoke proof

Task: T4 (2026-11-16)

Files changed:
- `src/frontend/src/ui/Leaderboard.tsx` (new)
- `src/frontend/src/ui/Leaderboard.test.tsx` (new)
- `src/frontend/src/App.tsx` (edit)
- `src/frontend/src/App.test.tsx` (edit)
- `src/frontend/src/ui/game-view.css` (edit)
- `src/frontend/src/ui/game-view.css.test.ts` (edit)
- `tests/e2e/smoke.mjs` (edit)
- `docs/features/server-live-leaderboard/build-log-T4.md` (this file)

Sketch (before implementation):
1. `Leaderboard.tsx`: pure text helpers (`pluralize`, `leaderboardEntryText`, `leaderboardTotalsText`) and a stateless non-live `<aside aria-live="off">` rendering the server-ordered top five rows plus totals, `null` for a null/empty snapshot.
2. `App.tsx`: render `<Leaderboard snapshot={world.leaderboard} reducedMotion={snapshot.reducedMotion} />` in the welcomed branch beside `ActivityFeed`; `.phase-announcement` stays the only polite live region.
3. `game-view.css`: join the rounded chrome/reset groups, pin the desktop left rail below the HUD, the 720px block below the feed, the short-viewport cap and the 160 ms reduced-motion-aware entry.
4. Tests: exact SSR markup/text/plurals/order/cap, App populated/pre-welcome/single-live-region, CSS placement/short-viewport/hygiene, and the smoke A/B welcome snapshots plus the coalesced `leaderboardUpdate`.

What changed & why:
- `Leaderboard.tsx`: exports `LEADERBOARD_VISIBLE_COUNT = 5`, `pluralize` (0 → plural, 1 → singular), `leaderboardEntryText` (`2 cubes · 40 clicks`) and `leaderboardTotalsText` (`Server totals: 2 cubes · 40 clicks · 3 faces`). The component returns `null` for a null snapshot or an empty `entries` array; otherwise it renders exactly one `<aside className="leaderboard" aria-label="Server leaderboard" aria-live="off" data-reduced-motion="true|false" data-server-id="…">` with the `<h2>`, an `<ol>` of at most five `<li data-rank data-player-id>` rows (rank badge, name, exact score text) and the `<p class="leaderboard-totals">`. It never re-sorts, shows no timestamp and has no coin column, focusable control or live role.
- `App.tsx`: renders the panel in the welcomed branch immediately after `ActivityFeed` and passes `world.leaderboard` plus the session `reducedMotion`; the pre-welcome shell and `.phase-announcement` are untouched.
- `game-view.css`: `.leaderboard` joins the grouped rounded chrome and pseudo-element reset; the desktop left rail is pinned at `top: 12.5rem` / `left: 1rem` / `width: min(17rem, calc(100vw - 2rem))` / `max-height: 40vh` with `pointer-events: none`; title/list/rows/totals are compact with name ellipsis, radix rank badge and a totals separator; rows use the 160 ms `leaderboard-entry` animation, disabled for `.leaderboard[data-reduced-motion='true'] li` and inside the single `@media (prefers-reduced-motion: reduce)` block. The `max-width: 720px` block moves the rail to `top: 17rem` / `width: min(14rem, …)` / `max-height: 18vh` with smaller row text; `@media (max-width: 720px) and (max-height: 600px)` caps it at `max-height: 12vh` with smaller rows. No existing selector's placement changed; no `!important`; one trailing newline.
- Tests: `Leaderboard.test.tsx` pins the exact SSR markup (including 0/1/2 plurals), the five-row cap, wire-order preservation (no re-sort), null/empty → `null`, no live role/focusable/timestamp/coin, the reduced-motion attribute and guest/account parity (same markup except the server-issued name). `App.test.tsx` adds the populated panel beside the ticker (exactly one `aria-live="polite"`/`role="status"`, no alert/log), the pre-welcome absence, empty-snapshot absence and reduced-motion forwarding. `game-view.css.test.ts` pins the chrome membership, desktop/mobile/short-viewport declarations, the 160 ms animation plus both reduced-motion disables, the 17rem > 10rem + 6rem feed clearance, and unchanged upgrades/feed placements. `tests/e2e/smoke.mjs` adds the exact A/B welcome-snapshot assertions and scans/wait A's history for the coalesced `leaderboardUpdate` (A clicks `>= 3`, B clicks `0`, both cubes `0`, totals clicks `>= 3`, run serverId) without weakening any existing check.

Decisions:
- The panel keeps the server order verbatim and does not recompute totals: the wire snapshot is authoritative (the reducer already stores it as a fresh copy).
- Rows are split into `.leaderboard-rank` / `.leaderboard-name` / `.leaderboard-score` spans so the name can ellipsize while the score stays visible; the accessible name is the row's full text in rank → name → score order.
- The 720px block also shrinks `.leaderboard-list` (not only the panel) because the list owns its base `font-size`; the short-viewport block shrinks it once more.
- The smoke predicate is the complete AC-25 frame (serverId + both entries + totals), so the earlier `leaderboardUpdate` carrying only the single click cannot satisfy it; the check scans `history` first and otherwise waits inside the existing `MULTIPLAYER_TIMEOUT_MS` (no new fixed wait).
- `game-view.css.test.ts`'s existing grouped-selector and 720px-block assertions were updated to include `.leaderboard` / distinguish the standalone 720px block from the new combined short-viewport query; no behavioral assertion was weakened.
- Docs outside the feature dir are intentionally untouched: `docs/architecture/realtime.md` and `docs/product/glossary.md` are T5's `files_owned`; the documentation pass runs with T5.

Evidence:

`npm run lint` → exit 0
```
> lint
> eslint .
```

`npm run typecheck` (root, both workspaces) → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

`npm run test --workspace @cubeclicker/frontend` → exit 0
```
 Test Files  74 passed (74)
      Tests  2248 passed (2248)
   Start at  09:13:04
   Duration  4.23s (transform 9.68s, setup 0ms, collect 28.24s, tests 13.74s, environment 9.64s, prepare 7.46s)
```
(T3 baseline: 73 files / 2229 tests. T4 adds 1 file / 19 tests: 8 `Leaderboard.test.tsx`, 4 App, 7 CSS.)

`npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds 80/80/80/80)
```
 Test Files  74 passed (74)
      Tests  2248 passed (2248)
All files          |   96.63 |    96.35 |    97.8 |   96.63 |
  Leaderboard.tsx  |     100 |      100 |     100 |     100 |
```

`npm run build --workspace @cubeclicker/frontend` → exit 0
```
dist/assets/index-NkhNsjDs.js                         97.26 kB │ gzip:  29.80 kB
dist/assets/three-4rmoIDEa.js                        609.34 kB │ gzip: 154.32 kB
✓ built in 1.60s
entry index assets/index-NkhNsjDs.js raw=97263 gzip=29795
initial files=2 raw=318962 gzip=98751 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=165000
total files=6 raw=993754 gzip=276782 budget=300000

Bundle budget OK.
```

`podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` → exit 0
```
[3/3] STEP 6/6: LABEL "com.docker.compose.image.builder"="classic"
--> Using cache a9af56e40a15e10171cbb25190b67ad687edce0adf91175f06b3de27afc0c799
[3/3] COMMIT docker.io/library/cubeclicker-frontend:prod-smoke
--> a9af56e40a15
Successfully tagged docker.io/library/cubeclicker-frontend:prod-smoke
a9af56e40a15e10171cbb25190b67ad687edce0adf91175f06b3de27afc0c799
Successfully built a9af56e40a15
Successfully tagged cubeclicker-frontend:prod-smoke
 Image cubeclicker-frontend:prod-smoke Built
```

`npm run smoke` → exit 0 (26/26 checks)
```
smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 1
PASS activity snapshot: A's welcome feed is empty and B's welcome carries exactly A's memberJoined event — server 1; memberJoined id 1 for p1
PASS leaderboard join: A's welcome is a one-entry zero snapshot and B's welcome carries A and B with zero counters and totals — server 1
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 2
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)
PASS multiplayer batching: front:0:1 and front:0:2 never arrive as single miniCubeRemoved frames on A or B
PASS leaderboard update: the accepted explodes yield a coalesced leaderboardUpdate with A clicks >= 3, B clicks = 0 and totals clicks >= 3 — A clicks 3, B clicks 0, totals clicks 3
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1001ms
PASS activity leave: A receives the memberLeft activity event with B's name and an id newer than the snapshot id — memberLeft id 2 for p2
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=7 cubeclicker_ws_messages_received_total{type="join"}=5 cubeclicker_ws_frames_sent_total{type="hello"}=7
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-BY3oMfjV.js is served gzip with immutable caching — content-encoding gzip; 97329 B decompressed
PASS prod /assets/three-4rmoIDEa.js is served gzip with immutable caching — content-encoding gzip; 609337 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (26/26 checks)
```

Focused T4 run (116 tests):
```
 ✓ src/ui/Leaderboard.test.tsx (8 tests)
 ✓ src/ui/game-view.css.test.ts (58 tests)
 ✓ src/App.test.tsx (50 tests)

 Test Files  3 passed (3)
      Tests  116 passed (116)
```

Acceptance audit (T4 scope per `tasks.md`):
- AC-20 → met: `Leaderboard.test.tsx` pins the exact `<aside class="leaderboard" aria-label="Server leaderboard" aria-live="off" data-reduced-motion data-server-id>` with the `<h2>`, the ordered list of at most five server-ranked `<li data-rank data-player-id>` rows (`#1` + name + `2 cubes · 40 clicks`, 0/1/2 plurals) and the exact `Server totals: 3 cubes · 41 clicks · 3 faces`; a null snapshot and an empty `entries` array render `null`; a six-entry wire snapshot renders only the first five; an "unsorted" two-entry snapshot keeps wire order (no re-sort); guests and accounts differ only by the server-issued name.
- AC-21 → met: the panel markup has `aria-live="off"` and no `role="status"`/`alert`/`log`, `aria-live="polite"`/`assertive`, `<button`, `<a>` or `tabindex`; App SSR with a populated leaderboard has exactly one polite/assertive live region (`.phase-announcement`, `role="status"` + `aria-live="polite"`) and no alert/log.
- AC-22 → met: `reducedMotion` maps to `data-reduced-motion="true"` (default/`false` → `"false"`); CSS pins `animation: leaderboard-entry 160ms ease-out both` on `.leaderboard li`, `animation: none` on `.leaderboard[data-reduced-motion='true'] li`, and `.leaderboard li` inside the single `@media (prefers-reduced-motion: reduce)` block.
- AC-23 → met: `.leaderboard` joins the grouped rounded chrome and `::before`/`::after` reset; desktop rail pins `top: calc(12.5rem + env(safe-area-inset-top, 0px))`, `left: calc(1rem + env(safe-area-inset-left, 0px))`, `width: min(17rem, calc(100vw - 2rem))`, `max-height: 40vh`, `pointer-events: none`; the 720px block pins `top: calc(17rem + …)`, `width: min(14rem, …)`, `max-height: 18vh` and proves `17rem > 10rem + 6rem` (feed clearance); the combined `(max-width: 720px) and (max-height: 600px)` block pins `max-height: 12vh`; existing upgrades/customization/feed/HUD placements are unchanged, with no `!important` and one trailing newline.
- AC-25 (smoke half) → met: the containerized smoke records the one-entry zero `welcome.leaderboard` for A, the two-entry zero snapshot for B (server 1) and `leaderboardUpdate` with `A clicks 3, B clicks 0, totals clicks 3`; all 24 pre-existing checks stay green (26/26 total).
- AC-26 (partial) → met: lint, typecheck, frontend tests (2248), frontend coverage (96.63/96.35/97.8/96.63, all ≥ 80), frontend build, `frontend-prod` rebuild and smoke all exit 0; no dependency, package, compose, Dockerfile, backend or protocol file changed.

Out of T4 scope by `tasks.md` (owned by T5): `docs/architecture/realtime.md`, `docs/product/glossary.md`, the root final gate and the `docs/features/README.md` row proposal.

Deviations from spec: none.
