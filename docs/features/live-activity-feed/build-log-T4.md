# Build log — T4 — ActivityFeed UI, App wiring, CSS, smoke proof

Task: T4 (2026-11-15/16)

Files changed:
- `src/frontend/src/ui/ActivityFeed.tsx` (new)
- `src/frontend/src/ui/ActivityFeed.test.tsx` (new)
- `src/frontend/src/App.tsx` (edit: render the feed in the welcomed branch)
- `src/frontend/src/App.test.tsx` (edit: `activity` fixture + ticker suite)
- `src/frontend/src/ui/game-view.css` (edit: chrome/pseudo reset, placement, entry animation, reduced-motion, 720px offset)
- `src/frontend/src/ui/game-view.css.test.ts` (edit: grouped-rule pins + ticker suite)
- `tests/e2e/smoke.mjs` (edit: activity snapshot and leave-activity checks in the existing A/B flow)
- `docs/features/live-activity-feed/build-log-T4.md` (this file)

What changed & why:
- `ActivityFeed.tsx` exports `ACTIVITY_VISIBLE_COUNT = 5`, `formatActivitySeconds` (`(ms / 1000).toFixed(1) + 's'`) and `activityText` (the six pinned sentences), and renders `null` for an empty feed. Otherwise it renders exactly one `<aside class="activity-feed" aria-label="Server activity" aria-live="off" data-reduced-motion="true|false">` with an `<h2>` and an `<ol>` of the five newest `<li key={events[].id} data-event-type data-event-id>` items, each with a `<span class="activity-feed-text">`. No live role, no focusable control, no timestamp.
- `App.tsx` renders `<ActivityFeed events={world.activity} reducedMotion={snapshot.reducedMotion} />` between the connection banner and the users panel, inside the existing `welcomed` gate; `.phase-announcement` stays the only polite live region.
- `game-view.css` adds `.activity-feed` to the rounded-chrome group and `.activity-feed::before/::after` to the metallic-pseudo reset; places the ticker top-center below the banner (`top: calc(4.25rem + env(safe-area-inset-top, 0px))`, `left: 50%`, `transform: translateX(-50%)`, `width: min(24rem, calc(100vw - 2rem))`, `max-height: 30vh`, `pointer-events: none`, `overflow: hidden`), adds the 160 ms entry animation on `.activity-feed li`, disables it for `[data-reduced-motion='true']` and inside the single `@media (prefers-reduced-motion: reduce)` block, and moves the ticker to `top: calc(10rem + env(safe-area-inset-top, 0px))` / `max-height: 6rem` in the 720px block. No new tokens, no `!important`.
- `tests/e2e/smoke.mjs` extends the existing `checkMultiplayerFlow`: A's `welcome.activity` must be `[]`; B's `welcome.activity` must be exactly A's accepted `memberJoined` event (`type`, `serverId`, `playerId`, `name`, positive integer `id`, finite `at`); after B's existing close/grace and the existing `memberLeft (left)` wait, A must receive an `activityEvent` whose `event.type === 'memberLeft'`, `event.playerId === B`, `event.name === B.name`, `event.serverId === A.serverId` and `event.id > firstId`. The matcher is a predicate on the frame, so an earlier matching activity frame (or any interleaved broadcast) can never satisfy it; the already-consumed frame is read from the socket history, so the check adds no wait.
- Tests: `ActivityFeed.test.tsx` pins the exact markup for the newest five of a six-event ring, all six exact sentences, `2.5s`/`1.0s`/`0.0s`, the 5-visible cap and newest-first order, empty → `null`, `aria-live="off"` with no live roles/focusable controls, and the reduced-motion attribute; `App.test.tsx` adds welcome/populated, reduced-motion and pre-welcome cases plus the single-live-region count; `game-view.css.test.ts` pins the chrome/reset membership, the exact placement declarations, the 160 ms animation, both reduced-motion disables and the 720px offset.

Decisions:
- The ticker is only rendered in the `welcomed` branch (like the HUD/panels); a pre-welcome world with a stale feed renders nothing (covered by an App test).
- `box-sizing: border-box` is declared on `.activity-feed` so the `min(24rem, calc(100vw - 2rem))` cap includes the padding; it is not a new token and does not change the pinned placement values.
- `events.slice(0, ACTIVITY_VISIBLE_COUNT)` takes the head because the reducer stores the feed newest-first (`index 0` is the newest); items are keyed by the server-assigned `id`, so a prepended event mounts a new node and plays the entry animation.
- The smoke activity checks reuse the existing 1 s grace (no new wait): the leave frame arrives right after the protocol `memberLeft`, and the socket history baseline (`activityStart`) keeps the earlier `memberJoined` snapshot out of the match.
- Existing exact-markup App tests are unchanged because an empty feed renders `null`; `worldFor` gains an optional `activity` (default `[]`).

Evidence:

`npm run lint` (root) → exit 0
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
 Test Files  73 passed (73)
      Tests  2069 passed (2069)
   Start at  07:57:17
   Duration  3.35s (transform 7.39s, setup 0ms, collect 21.48s, tests 11.37s, environment 7.61s, prepare 5.70s)
```
(Targeted: `src/ui/ActivityFeed.test.tsx` 7 tests, `src/App.test.tsx` 46 tests, `src/ui/game-view.css.test.ts` green. The jsdom canvas `getContext`/THREE WebGL stderr noise is unchanged and pre-existing.)

`npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds 80 statements/branches/functions/lines)
```
 Test Files  73 passed (73)
      Tests  2069 passed (2069)
   Start at  07:57:37
   Duration  4.78s (transform 7.41s, setup 0ms, collect 21.51s, tests 18.27s, environment 9.12s, prepare 7.14s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.61 |    96.31 |   97.78 |   96.61 |
 src               |      88 |    85.21 |   95.45 |      88 |
  App.tsx          |    86.4 |    82.29 |   96.42 |    86.4 | ...34-436,458-459
 src/ui            |   96.88 |    94.38 |      95 |   96.88 |
  ActivityFeed.tsx |     100 |      100 |     100 |     100 |
```

`npm run build --workspace @cubeclicker/frontend` → exit 0
```
> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
transforming...
✓ 108 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.49 kB │ gzip:   0.31 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-CirLJlxj.css                        27.26 kB │ gzip:   5.46 kB
dist/assets/cursor-ship-BGpPDzKE.js                    6.73 kB │ gzip:   2.21 kB
dist/assets/SpaceshipCustomizationPanel-D_iz0uC5.js    9.54 kB │ gzip:   3.34 kB
dist/assets/browser-env-D0GQg6df.js                   49.19 kB │ gzip:  18.16 kB
dist/assets/index-D9_xQ_JO.js                         94.17 kB │ gzip:  29.03 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-4rmoIDEa.js                        609.34 kB │ gzip: 154.32 kB
✓ built in 1.50s
entry index assets/index-D9_xQ_JO.js raw=94165 gzip=29033
initial files=2 raw=315864 gzip=97989 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=165000
total files=6 raw=990656 gzip=276021 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-D_iz0uC5.js raw=9537 gzip=3339 initial=false
chunk browser-env assets/browser-env-D0GQg6df.js raw=49189 gzip=18160 initial=false
chunk cursor-ship assets/cursor-ship-BGpPDzKE.js raw=6729 gzip=2210 initial=false
chunk index assets/index-D9_xQ_JO.js raw=94165 gzip=29033 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-4rmoIDEa.js raw=609337 gzip=154323 initial=false

Bundle budget OK.
```

`podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` → exit 0
```
[3/3] STEP 6/6: LABEL "com.docker.compose.image.builder"="classic"
--> 1c9286e80b7b
Successfully tagged docker.io/library/cubeclicker-frontend:prod-smoke
1c9286e80b7b9a9e0d109f1eb2d6b781a355f54d710e4176a6f645d67218cb45
Successfully tagged cubeclicker-frontend:prod-smoke
 Image cubeclicker-frontend:prod-smoke Built
```
(The running `frontend-prod` service was recreated from the new image before the smoke, so the served report/asset checks exercised this build: `podman compose -f compose.yaml -f compose.smoke.yaml up -d frontend-prod` → `Recreated`, `Started`.)

`npm run smoke` → exit 0
```
smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 1
PASS activity snapshot: A's welcome feed is empty and B's welcome carries exactly A's memberJoined event — server 1; memberJoined id 1 for p1
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 2
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)
PASS multiplayer batching: front:0:1 and front:0:2 never arrive as single miniCubeRemoved frames on A or B
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1002ms
PASS activity leave: A receives the memberLeft activity event with B's name and an id newer than the snapshot id — memberLeft id 2 for p2
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=7 cubeclicker_ws_messages_received_total{type="join"}=5 cubeclicker_ws_frames_sent_total{type="hello"}=7
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-BC6ZsTxs.js is served gzip with immutable caching — content-encoding gzip; 94231 B decompressed
PASS prod /assets/three-4rmoIDEa.js is served gzip with immutable caching — content-encoding gzip; 609337 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (24/24 checks)
```

Protected files unchanged:
```
$ git diff --exit-code -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json
PROTECTED_EXIT=0
```

Acceptance audit:
- AC-19 → met: `ActivityFeed.test.tsx` "renders exactly the five newest events with the pinned accessible markup" pins the complete HTML (`<aside class="activity-feed" aria-label="Server activity" aria-live="off" data-reduced-motion="false">`, `<h2 class="activity-feed-title">Server activity</h2>`, `<ol class="activity-feed-list">`, `<li data-event-type data-event-id>` + `<span class="activity-feed-text">`) and the exact texts; "pins the exact sentence for every event type" covers all six (`cleared Cube 3`, `fast-cleared Cube 4 in 2.5s`, `completed 5 cubes`, `unboxed an epic part`, `joined`, `left`); "formats the fast-clear duration" pins `2.5s`/`1.0s`/`0.0s`; "shows at most the five newest events" pins ids `8,7,6,5,4` from an eight-event ring; "renders nothing for an empty feed" pins `null`.
- AC-20 → met: "contributes no live-region semantics and no focusable control" asserts `aria-live="off"`, no polite/assertive, no `role="status"/"alert"/"log"`, no `<button`/`<a `/`tabindex`; the App test asserts the populated welcome shell renders exactly one `aria-live="polite"` and one `role="status"` (`.phase-announcement`) with zero assertive/alert/log.
- AC-21 → met: the App test pins `data-reduced-motion="true"` from the session preference and the component test pins `false` by default; `game-view.css.test.ts` pins `.activity-feed li { animation: activity-feed-entry 160ms ease-out both }`, `.activity-feed[data-reduced-motion='true'] li { animation: none }`, and `.activity-feed li,` inside the single `@media (prefers-reduced-motion: reduce)` block.
- AC-22 → met: `game-view.css.test.ts` "pins the top-center placement below the connection banner" asserts the exact declaration list (`position: absolute`, `top: calc(4.25rem + env(safe-area-inset-top, 0px))`, `left: 50%`, `width: min(24rem, calc(100vw - 2rem))`, `max-height: 30vh`, `pointer-events: none`, `transform: translateX(-50%)`); "moves below the HUD and caps at 6rem" pins the 720px override; the chrome/reset membership test pins `.activity-feed` in the rounded group and both pseudo-elements; the App/component markup adds no focusable control; existing app.css placement assertions for the HUD/users/toggle/upgrades remain green.
- AC-27 → met: `npm run smoke` prints both new PASS lines — A's `welcome.activity` empty, B's `welcome.activity` exactly A's `memberJoined` (`id 1`, `p1`, `serverId 1`, matching name, finite `at`), and the live `activityEvent` `memberLeft` (`id 2`, B's name, A's server id) after the existing grace; every pre-existing smoke check stays green (24/24).
- AC-28 (partial) → met: lint, typecheck, frontend tests, frontend coverage (96.61/96.31/97.78/96.61 with `ActivityFeed.tsx` at 100 %), frontend build and the containerized smoke exit 0; the protected container/package files are byte-identical (`git diff --exit-code` exit 0). Root-suite and documentation halves remain T5.

Deviations from spec: none. (`box-sizing: border-box` on `.activity-feed` is an added layout declaration, not a pinned value or new token; it keeps the 24 rem cap inclusive of the padding.)

Out-of-scope files untouched: `src/backend/**`, `src/frontend/src/multiplayer/**`, `src/frontend/src/game/**`, `compose*.yaml`, both Dockerfiles, `package.json`, `package-lock.json`, `.env*`, `docs/features/live-activity-feed/{spec,plan,tasks,status}.md`, `docs/features/live-activity-feed/reviews/**` (T5 stages those).
