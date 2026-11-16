# Build log — T11 — Verify & integrate (documentation + full gates)

Task: T11 (2026-11-16)
Feature: game-feel-overhaul
Branch: `feat/game-feel-overhaul`, merge HEAD `69cd566` — merge of
`feat/presence-and-activity-liveness` (`36d03e7`) into the feature branch; the T11
build-log update is committed on top (docs-only).
**Status: automated gate GREEN on the merged tree. One T11 item remains BLOCKED:** the
manual `workMs` reveal traces, the main-scene frame trace and the visual/keyboard matrix are
not executable in this environment (no browser/GUI tooling, and the spec excludes browser
automation). Nothing that was not run is recorded as passing.

Files changed by this task (content):

- `README.md` — Neon Forge HUD + 3D reveal wording, stale sentences removed.
- `docs/architecture/frontend-rendering.md` — `## Lootbox reveal stage`,
  `## Game shell layering`, qualified single-loop wording.
- `docs/product/glossary.md` — `lootbox reveal` updated, `### reveal stage` added,
  motion-token count 13 → 17; merge resolution keeps both the presence and the reveal terms.
- `docs/features/game-feel-overhaul/build-log-T11.md` (this file).

Also delivered: the feature artifacts (spec, plan, tasks, status, `reviews/`) in a separate
`docs:` commit, and the presence merge commit `69cd566` (no source/test conflict resolution;
one both-added-terms conflict in `docs/product/glossary.md`).

## What changed & why (documentation pass)

1. **README** — the gameplay paragraph now describes `chamfered graphite-glass HUD panels
   with cyan energy rims and amber reward accents` and the `Neon Forge HUD`; the
   `wireframe charge-orb reveal` clause is replaced by the `animated 3D lootbox reveal` on
   the player's own ship and its controls (`Escape`, `Dismiss`, `Equip` closes the stage;
   `Equip` also equips). `granular spaceship parts` and `detailed blue/orange hero
   spaceship` are preserved. The feature list names `game-feel-overhaul`.
2. **`docs/architecture/frontend-rendering.md`** — the unqualified "session owns the only
   rAF loop" sentence becomes `The session owns the requestAnimationFrame loop for the
   Three.js game scene` plus the statement that the reveal adds `one additional bounded
   30 fps loop` in the deferred customization panel, disposed on unmount. Two new
   sections document the reveal stage (modules, one panel context, 30 fps, deferred chunk,
   reduced-motion/WebGL fallback, non-modal focus contract) and the shell layering table
   (canvas 0, ambience 2, panels/controls 3, level 5, reveal 20, toggle 21, auth 100).
3. **`docs/product/glossary.md`** — `lootbox reveal` now describes the 3D stage, the
   non-modal controls and the opener-only/server-authoritative split; `### reveal stage`
   is added (the presence term that arrived with the merge sits between `### prestige` and
   it); the motion-token definition says 17 CSS-mapped durations (the `game-view.css`
   `--motion-*` map is 17 entries).
4. No source, test, CSS, container, package or protocol file was changed by T11.

## Base provenance and merge resolution

`feat/game-feel-overhaul` was forked from an intermediate `presence-and-activity-liveness`
commit (`e39c378`) that main does not contain; that fork point carried a stale activity-TTL
expectation in five `src/backend/src/game/hub.test.ts` tests, which the presence branch
later fixed. The presence branch (`36d03e7`) is the accepted base of this feature, so it is
now merged into the feature branch and **`BASE=36d03e7`** is the recorded base for every
protected/doc gate below.

```text
$ git log --oneline --graph -5
*   69cd566 merge: integrate presence-and-activity-liveness into game-feel-overhaul
|\
| * 36d03e7 docs: track presence code review r2          (presence tip = BASE)
* | 80e22cc docs: record the merged-base verification in the T11 build log
* | 5e5cc0b docs: track game-feel-overhaul feature artifacts
* | 8d0fc29 docs: document the 3D lootbox reveal and Neon Forge shell
|/
* f723b7e fix: honor session reduced motion on the ambience layer
```

**Merge resolution.** `git merge --no-ff feat/presence-and-activity-liveness` produced
exactly one conflict: `docs/product/glossary.md`, because both features inserted a term
after `### prestige` in the same place. Resolved by keeping **both** definitions verbatim
in the order `### presence` → `### reveal stage`; no definition from either feature was
dropped or reworded. All other files auto-merged, including
`docs/architecture/frontend-rendering.md` (presence's page-lifecycle/activity-expiry
paragraphs plus this feature's reveal-stage/layering sections) and
`src/frontend/src/game/session.ts`/`session.test.ts`. The merge also carries presence's
`docs/features/README.md` row; that edit is presence-authored, not a game-feel edit.

```text
$ grep -n "^### presence$\|^### prestige$\|^### reveal stage$" docs/product/glossary.md
118:### prestige
123:### presence
128:### reveal stage
$ git diff --stat 36d03e7...HEAD -- src/backend
(empty; exit 0)
```

## Environment

```text
$ command -v chromium chromium-browser google-chrome google-chrome-stable firefox
exit=1                      # no browser binary in PATH
$ ls node_modules | grep -iE "playwright|puppeteer|webgl"
exit=0                      # no output: no Playwright/Puppeteer
$ printenv DISPLAY WAYLAND_DISPLAY
:0
wayland-1
$ podman compose version
Docker Compose version v5.6.0
$ podman ps --format "{{.Names}} {{.Status}}"
cubeclicker-mailpit-1 Up 4 hours
cubeclicker-db-1 Up 4 hours (healthy)
cubeclicker-adminer-1 Up 4 hours
cubeclicker-frontend-prod-1 Up 4 hours (healthy)
cubeclicker-frontend-1 Up 4 hours (healthy)
cubeclicker-backend-1 Up 4 hours (healthy)
$ flatpak list --app --columns=application | grep -i chrome
com.google.Chrome
```

A Chrome flatpak exists but no browser is on `PATH`, there is no Playwright/Puppeteer, and
this builder has no interactive GUI/screenshot tooling. The spec forbids browser automation
("No browser automation, pixel/perceptual snapshot tests or visual-regression tooling"), so
the manual visual pass and the `workMs` traces are recorded as **not executed —
environment** (the same disposition as `adaptive-render-budget-v2` build-log-T5), never as
passed. The code/test-pinned structure evidence is recorded in § Performance and § Manual
matrix.

## Gate evidence (raw)

Commands run from the repository root on the merged tree `69cd566` (base `36d03e7`). No
source/test file changed after the merge. The only working-tree modification is the
orchestrator's pre-existing `docs/features/game-feel-overhaul/status.md` blocked entry,
which is not part of the T11 commits.

### `npm run lint` → exit 0

```text

> lint
> eslint .

```

### `npm run typecheck` → exit 0

```text

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

```

### `npm test` → exit 0

```text
> test
> npm run test --workspaces --if-present

> test
> vitest run
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
 Test Files  37 passed (37)
      Tests  1538 passed (1538)

> test
> vitest run
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
 Test Files  78 passed (78)
      Tests  2432 passed (2432)
```

The five `src/backend/src/game/hub.test.ts` failures recorded in the pre-merge run are gone:
the presence merge brings the updated `hub.test.ts`/`hub.ts` (186 tests in that file, all
passing) and the full suite is green in both workspaces.

### `npm run coverage` → exit 0

```text
> coverage
> npm run coverage --workspaces --if-present

> coverage
> vitest run --coverage
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8
 Test Files  37 passed (37)
      Tests  1538 passed (1538)
 % Coverage report from v8
All files          |    96.2 |    89.92 |   99.57 |    96.2 |

> coverage
> vitest run --coverage
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8
 Test Files  78 passed (78)
      Tests  2432 passed (2432)
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.84 |    96.53 |   98.04 |   96.84 |
 src/game          |    96.5 |    99.4 |   99.02 |    96.5 |
  reveal-motion.ts |     100 |      100 |     100 |     100 |
  session.ts       |   91.31 |    98.84 |   97.43 |   91.31 |
 src/multiplayer   |   94.88 |    97.35 |   96.87 |   94.88 |
  ...y-lifetime.ts |     100 |      100 |     100 |     100 |
 src/render        |   98.63 |    98.98 |   98.82 |   98.63 |
  ...box-reveal.ts |     100 |      100 |     100 |     100 |
 src/ui            |   97.51 |    95.19 |    96.9 |   97.51 |
  ...boxReveal.tsx |   98.24 |    94.94 |     100 |   98.24 |
  ...tionPanel.tsx |    96.9 |    91.96 |     100 |    96.9 |
  ...adesPanel.tsx |    97.1 |    91.89 |     100 |    97.1 |
  Hud.tsx          |     100 |      100 |     100 |     100 |
  UserPanel.tsx    |     100 |      100 |     100 |     100 |
  theme.ts         |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
```

- **Backend workspace: 96.2 / 89.92 / 99.57 / 96.2 — all four ≥ 80.**
- **Frontend workspace: 96.84 / 96.53 / 98.04 / 96.84 — all four ≥ 80**, new modules
  included (`reveal-motion.ts` and `render/lootbox-reveal.ts` 100%,
  `LootboxReveal.tsx` 98.24). No exclusion or threshold was changed in either workspace.

### `npm run build` → exit 0

```text
> build
> npm run build --workspaces --if-present

> build
> tsc

> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
✓ 112 modules transformed.
dist/index.html                                        0.49 kB │ gzip:   0.30 kB
dist/assets/index-CoXkPg3Y.css                        38.46 kB │ gzip:   7.25 kB
dist/assets/cursor-ship-Bj0X9LT6.js                    6.73 kB │ gzip:   2.21 kB
dist/assets/SpaceshipCustomizationPanel-Tfn2KlzW.js   16.27 kB │ gzip:   5.75 kB
dist/assets/browser-env-BFzDKYLL.js                   49.34 kB │ gzip:  18.20 kB
dist/assets/index-6XznO9t4.js                        101.59 kB │ gzip:  31.01 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-4kUmpljF.js                        610.31 kB │ gzip: 154.62 kB
✓ built in 1.42s
entry index assets/index-6XznO9t4.js raw=101588 gzip=31012
initial files=2 raw=323287 gzip=99968 budget=150000
three assets/three-4kUmpljF.js raw=610310 gzip=154617 budget=165000
total files=6 raw=1005937 gzip=280751 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-Tfn2KlzW.js raw=16267 gzip=5751 initial=false
chunk browser-env assets/browser-env-BFzDKYLL.js raw=49344 gzip=18204 initial=false
chunk cursor-ship assets/cursor-ship-Bj0X9LT6.js raw=6729 gzip=2211 initial=false
chunk index assets/index-6XznO9t4.js raw=101588 gzip=31012 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-4kUmpljF.js raw=610310 gzip=154617 initial=false

Bundle budget OK.
```

`dist/bundle-report.json`: **1884 bytes** (`wc -c`). `initial.files` is exactly
`[assets/index-6XznO9t4.js, assets/react-BYqCGoBQ.js]` — the `three` chunk is
`initial=false`. `dist/index.html` preloads only the react chunk;
`grep -c 'three-' dist/index.html` = `0`.

### `npm run smoke` → exit 0 (recorded; not a cross-service acceptance gate)

The smoke-only `frontend-prod` image was **rebuilt from the merged tree**
(`podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` → exit 0,
`Successfully tagged cubeclicker-frontend:prod-smoke`) and its container recreated before
this run, so the production static-delivery checks describe the merged build
(`/assets/index-Dh282Nod.js`).

```text
> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-frontend-prod-1 Running
 Container cubeclicker-mailpit-1 Running
 Container cubeclicker-backend-1 Running
 Container cubeclicker-frontend-1 Running
 Container cubeclicker-db-1 Running
 Container cubeclicker-db-1 Waiting
 Container cubeclicker-db-1 Healthy
 Container cubeclicker-smoke-run-0182ef2404b8 Creating
 Container cubeclicker-smoke-run-0182ef2404b8 Created
smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 5
PASS activity snapshot: A's welcome feed is empty and B's welcome carries exactly A's memberJoined event — server 5; memberJoined id 1 for p8
PASS leaderboard join: A's welcome is a one-entry zero snapshot and B's welcome carries A and B with zero counters and totals — server 5
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 6
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)
PASS multiplayer batching: front:0:1 and front:0:2 never arrive as single miniCubeRemoved frames on A or B
PASS leaderboard update: the accepted explodes yield a coalesced leaderboardUpdate with A clicks >= 3, B clicks = 0 and totals clicks >= 3 — A clicks 3, B clicks 0, totals clicks 3
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1004ms
PASS activity leave: A receives the memberLeft activity event with B's name and an id newer than the snapshot id — memberLeft id 2 for p9
PASS multiplayer explicit leave: D's leave yields memberLeft(left) on A in under 900ms without the grace window — memberLeft(left) received after 1ms
PASS multiplayer slot reuse: E fills D's freed slot 2 with welcome.roster exactly [A, E] — server 5; roster [A, E] in D's freed slot 2
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=18 cubeclicker_ws_messages_received_total{type="join"}=14 cubeclicker_ws_frames_sent_total{type="hello"}=18
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-Dh282Nod.js is served gzip with immutable caching — content-encoding gzip; 101654 B decompressed
PASS prod /assets/three-4kUmpljF.js is served gzip with immutable caching — content-encoding gzip; 610310 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (28/28 checks)
```

The two extra checks over the pre-merge 26 are presence's `multiplayer explicit leave` and
`multiplayer slot reuse` cases.

## Protected-file proof

`BASE=36d03e7` (the presence tip merged into this branch). All gates exit 0:

```text
$ BASE=$(git rev-parse feat/presence-and-activity-liveness^{commit})
BASE=36d03e79cfa0af8b9f6bba9fe90f3533da0c7401
HEAD=69cd56662e00ff15b235283dc976f1d58f22a7b5
$ git diff --stat "$BASE"...HEAD -- src/backend
(empty; exit 0)
$ git diff --exit-code "$BASE"...HEAD -- src/backend compose.yaml compose.smoke.yaml ':(glob)**/Dockerfile' package.json package-lock.json src/frontend/package.json src/backend/package.json
GATE1_DIFF_EXIT=0
$ test -z "$(git status --porcelain -- src/backend compose.yaml compose.smoke.yaml ':(glob)**/Dockerfile' package.json package-lock.json src/frontend/package.json src/backend/package.json)"
GATE1_STATUS_EXIT=0
$ git diff --exit-code "$BASE"...HEAD -- src/frontend/src/render/preview.ts src/frontend/src/render/cursor-ship.ts src/frontend/src/render/spaceship.ts src/frontend/src/render/scene.ts src/frontend/src/render/webgl.ts src/frontend/src/render/postprocessing.ts src/frontend/src/game/engine.ts src/frontend/src/multiplayer src/frontend/src/main.tsx src/frontend/src/ui/AuthMenu.tsx src/frontend/src/ui/AuthForms.tsx src/frontend/src/ui/VerificationPending.tsx src/frontend/src/ui/VerifyEmail.tsx
GATE2_DIFF_EXIT=0
$ test -z "$(git status --porcelain -- <same list>)"
GATE2_STATUS_EXIT=0
$ test -z "$(git status --porcelain -- docs/features/README.md)"
FEATURE_INDEX_STATUS_EXIT=0
```

`src/backend` is byte-identical to the merged base (the merge brings presence's backend
work in as base content; the game-feel commits add none). `src/frontend/src/multiplayer`,
`browser-env.ts` and `session.ts` differ from the pre-merge branch only because they are
presence's base content now; against `36d03e7` the game-feel diff is exactly the T1–T10
frontend files (appendix). `docs/features/README.md` is unchanged in the working tree; the
presence row arrived with the merge, not from a T11 edit.

## Documentation gates

```text
BASE=36d03e79cfa0af8b9f6bba9fe90f3533da0c7401
HEAD=69cd56662e00ff15b235283dc976f1d58f22a7b5
PASS grep -F "animated 3D lootbox reveal" README.md
PASS grep -F "Neon Forge HUD" README.md
PASS grep -F "chamfered graphite-glass HUD panels with cyan energy rims and amber reward accents" README.md
PASS grep -F "granular spaceship parts" README.md
PASS grep -F "detailed blue/orange hero spaceship" README.md
PASS absent: rounded translucent cyan HUD panels
PASS absent: wireframe charge-orb reveal
PASS grep -F "## Lootbox reveal stage" docs/architecture/frontend-rendering.md
PASS grep -F "## Game shell layering" docs/architecture/frontend-rendering.md
PASS grep -F "one additional bounded 30 fps loop" docs/architecture/frontend-rendering.md
PASS grep -F "The session owns the requestAnimationFrame loop for the Three.js game scene" docs/architecture/frontend-rendering.md
PASS absent: The session owns the only
PASS grep -F "### reveal stage" docs/product/glossary.md
PASS grep -F "### presence" docs/product/glossary.md
PASS docs/features/README.md not modified in the working tree
```

All strings and negatives from the T11 verify list pass on the merged tree; the glossary
keeps both the presence and the reveal-stage terms. New documentation links resolve:
`docs/architecture/frontend-rendering.md` links to `src/frontend/src/game/reveal-motion.ts`,
`src/frontend/src/render/lootbox-reveal.ts` and `src/frontend/src/ui/LootboxReveal.tsx`,
all present at `HEAD`; the README's `docs/features/game-feel-overhaul/` directory is
tracked by the feature-artifact commit.

## Performance — traces (remaining blocker: not executable here) and structural budget

**Reveal `workMs` traces — not executed — environment.** AC-15 requires a 10-second trace
at 1280×720 and 1920×1080, three clean runs per size, measuring `performance.now()` either
side of `stage.update()` + `renderer.render()` in the reveal frame callback. No browser
runs in this environment (§ Environment) and the spec excludes browser automation, so no
run exists and none is recorded as passing. **This is the only remaining T11 blocker.**

| Size | Run 1 | Run 2 | Run 3 | Median | Verdict |
| --- | --- | --- | --- | --- | --- |
| 1280×720 | not executed — environment | not executed — environment | not executed — environment | — | unverified |
| 1920×1080 | not executed — environment | not executed — environment | not executed — environment | — | unverified |

**Main-scene traces with the customization panel open — not executed — environment** (same
reason; AC-34's avg ≤ 16.7 / p95 ≤ 33 requirement is unverified).

**Structural budget pinned by code and tests** (available evidence):

- Reveal context: one canvas/context besides the main scene's own; 22 draw calls
  (21 cursor meshes + 1 ring) ≤ 24; 872 triangles ≤ 2596; one pre-allocated pose buffer
  (no per-frame allocation); the 30 fps cap (`REVEAL_MAX_FPS = 30`,
  `REVEAL_FRAME_INTERVAL_MS = 1000 / 30 ≈ 33.33 ms`) is asserted in
  `LootboxReveal.test.tsx` ("pins the 30 fps cap, its interval and the pixel-ratio cap";
  "renders at most 30 frames per second and measures elapsed from the first frame"), as is
  the hidden-tab pause/resume and dispose-once. The inter-frame interval is only cap
  evidence, never a pass metric.
- Main scene: the diff adds no `requestAnimationFrame`, render pass, light, post-processing
  parameter or quality-tier input to `render/scene.ts`, `render/webgl.ts`,
  `render/postprocessing.ts`, `render/preview.ts` or `game/session.ts`'s frame loop (all
  protected or unchanged; the reveal loop lives in `ui/LootboxReveal.tsx` inside the
  deferred panel chunk). `game-view.css` adds only compositor-friendly transform/opacity
  animations (T7 log).

## Manual visual/motion matrix

Recorded from code/tests where possible; the browser-only rows are **not executed —
environment** and are not claimed as passed.

| Check | Evidence | Result |
| --- | --- | --- |
| Non-modal reveal: no scrim, no `aria-modal`, no focus trap, `role="group" aria-live="off"` | `game-view.css.test.ts` "adds no scrim and no data-reveal-active on main"; `LootboxReveal.test.tsx` "is a non-live group: no polite/status/alert region and no aria-modal"; `App.test.tsx` "renders one decorative ambience layer and keeps the reveal non-modal (AC-27)" | verified in tests |
| Toggle-click close dismisses the reveal and keeps focus on the toggle; no focus restore to the absent `Open lootbox` | `App.test.tsx` "treats a toggle-click close as a dismissal and never restores focus to the absent Open lootbox (AC-13)" | verified in test |
| Focus may leave the reveal (no trap); Escape/Dismiss/Equip each call their handler once; no auto-dismiss | `LootboxReveal.test.tsx` focus/Escape/Dismiss/Equip/"never auto-dismisses: 10 seconds of timers leave the reveal mounted" | verified in tests; keyboard pass not executed — environment |
| 721 px desktop spotlight vs 720 px bottom sheet (safe-area offsets, `z-index: 20`, `bottom: auto`, 34 rem `max-width`) | `game-view.css.test.ts` "centres the desktop spotlight in the 721px block with the complete override", "keeps the 720px reveal as a safe-area bottom sheet at layer 20", "has exactly one 720px block, one 721px block and one short-viewport block" | verified in tests; visual boundary not executed — environment |
| Epic 8-ray flourish, reduced-motion off-switch | `game-view.css.test.ts` "declares the exact epic-only eight-ray flourish", "removes the flourish under the session preference and prefers-reduced-motion"; `LootboxReveal.test.tsx` epic duplicate card | verified in tests; visual not executed — environment |
| Minimized HUD keeps header + resources and hides `.hud-grid` | `App.test.tsx` "toggles the HUD minimized state from the welcomed branch (AC-6, AC-19)"; `game-view.css.test.ts` "stacks the three stat rows in the grid and hides only the grid when minimized" | verified in tests; visual not executed — environment |
| Pre-welcome state keeps the three-row stats section and no HUD chrome | `App.test.tsx` "keeps the accepted pre-welcome stats rows and no HUD chrome before the first welcome (AC-19)" | verified in test; visual not executed — environment |
| Exactly one polite live region in the settled shell, with and without a grant | `App.test.tsx` "keeps exactly one polite live region in the settled welcomed shell (AC-31)", "…once the customization chunk resolves", "adds no live region while the reveal is mounted" | verified in tests |
| Session reduced-motion ambience (`data-reduced-motion="true"` disables the scanline without relying on the OS media query) | `f723b7e` + `game-view.css.test.ts` "disables the ambience for the session reduced-motion preference outside the media block"; `App.test.tsx` "marks the ambience reduced under the session reduced-motion preference (AC-27)" | verified in tests |
| 1280×720, 1920×1080, 2560×1280, 768×1024, 375×667, 320×568 visual pass (screenshots, keyboard pass, no overflow/overlap) | — | not executed — environment |
| WebGL-blocked fallback in a real browser | `LootboxReveal.test.tsx` fallback tests (renderer throw, stage throw, real `WebGLRenderer` context failure) | verified in tests; browser check not executed — environment |

## Acceptance audit

Evidence sources: T1–T10 build logs and the full gate output above. "met" means the AC's
evidence is present and green in this run unless stated.

- **AC-1 — No protocol, metrics or server change → met.** With `BASE=36d03e7` (the merged
  presence tip) both protected gates exit 0 (§ Protected-file proof) and
  `git diff --stat 36d03e7...HEAD -- src/backend` is empty. The grant remains
  `lootboxOpened`; no metric change.
- **AC-2 — Account grant and opener-only reveal → met.** `session.test.ts` (T4) exact
  grant and second-tab `null`; `hub.test.ts` opener-only send (unchanged, passes on the
  presence-fixed base); `App.test.tsx` "renders the reveal on the opener tab and never on a
  second tab … (AC-2)" green.
- **AC-3 — Guest grant → met.** T4 log: guest open pins `sequence`, duplicate, exact
  customization, `pendingLootboxOpen === false`, `wire.sent === []`; insufficient open
  leaves the grant unchanged.
- **AC-4 — Stage factory contract → met.** `lootbox-reveal.test.ts` (T2 log) pins the
  scene name/order, lights, camera, 21 meshes, ring geometry/material/colour, key-light
  lift `3.0 * (1 + flashOpacity)`, no shadows/textures/random, dispose-once.
- **AC-5 — Try-on appearance, no mutation → met.** T2 + T5 logs: catalog-derived slot,
  staged record, same object identity/`out` handling, no mutation, one `applyAppearance`
  call site; engine appearance unchanged.
- **AC-6 — Pose timeline and slot yaw table → met.** `reveal-motion.test.ts` 43 tests,
  100% coverage; exact boundary values, clamping, reduced rest row, same `out` object.
- **AC-7 — Reveal DOM and card contract → met.** `LootboxReveal.test.tsx` pins the full
  attribute map and texts; sanitised invalid values; catalog slot; canvas `aria-hidden`;
  no raw server string; no live region. Panel/App integration green.
- **AC-8 — Dismiss and equip behaviour → met.** Focus on mount/sequence, Escape/Dismiss/
  Equip once, `onEquip` before `onDismiss`, no auto-dismiss after 10 s, in-panel focus
  restore, unmount governed by AC-13.
- **AC-9 — Reduced motion → met.** First render `rest` + `data-reduced-motion="true"` even
  with an `idle` prop, one static frame, no timers, no flash; idle→charge otherwise.
- **AC-10 — WebGL-unavailable fallback → met.** Renderer/stage throw and a real
  `WebGLRenderer` context failure fall back to the inline SVG with the full card; valid
  part slot is catalog-derived; invalid part renders the sanitised card with no stage.
- **AC-11 — Reconnect, status change and multi-tab one-shot → met.** `session.test.ts`
  clearing + engine-snapshot publish then multiplayer; `App.test.tsx` mid-reveal status
  removes the reveal.
- **AC-12 — One context, deferred chunk and budget → met.** Panel renders `LootboxReveal`
  and not the preview while revealing (T5/T8 tests); `bundle-report.json` initial files
  exclude `three`; `index.html` preloads no `three-` asset; build budget 99,968 / 154,617 /
  280,751 B gzip vs 150,000 / 165,000 / 300,000.
- **AC-13 — Panel close is a dismissal → met.** Unmount dismisses once, reopen normal,
  data attribute true/false; App toggle-click test green.
- **AC-14 — Rarity, duplicate and epic flourish → met.** Component/panel tests plus the
  exact eight-ray CSS and reduced-motion off-switch.
- **AC-15 — Reveal per-frame work and budget → structure met, traces unmet.** 22 draw
  calls ≤ 24, 872 triangles ≤ 2596, one pose buffer, 30 fps cap/hidden pause/dispose tests;
  the three-run `workMs` traces per size are **not executed — environment** (no browser).
- **AC-16 — Rollback and no persistence → met.** No schema/migration/protocol/storage key
  is added (protected diffs, no persistence code in the change); rollback note below.
- **AC-17 — Token contract → met.** T6 log: 26 `--gf-*` tokens, accepted `--panel-*`
  values, `GF_*` mirrors and contrast gates.
- **AC-18 — Shared panel and control chrome → met.** T6/T7 logs: single grouped rule,
  inset-only depth/glow, no `position`/`filter`/outer shadow, pseudo rules, `:empty` reset.
- **AC-19 — HUD markup, data and minimized/pre-welcome states → met.** T8 log + App/Hud
  tests, including the 24 px minimize and the pre-welcome rows.
- **AC-20 — Upgrades markup → met.** T9 log exact DOM/balance/pips/affordability.
- **AC-21 — Customization markup and spotlight → met.** T5/T7 logs; complete 721/720
  overrides with safe-area offsets.
- **AC-22 — Activity feed chrome → met.** T10 log + `game-view.css.test.ts`.
- **AC-23 — Leaderboard chrome → met.** T10 log + medal/bar CSS tests.
- **AC-24 — Users panel chrome → met.** T9 log: `Crew` heading, count badge, `data-level`.
- **AC-25 — Connection banner chrome → met.** T9 log: `data-status`, dot, exact copy.
- **AC-26 — Auth chrome → met.** T6 log; auth markup/tests unchanged.
- **AC-27 — Ambience and layering (non-modal) → met.** `App.test.tsx` ambience tests;
  layering tests canvas 0 / ambience 2 / panels 3 / level 5 / reveal 20 / toggle 21 /
  auth 100; no scrim, no `main[data-reveal-active]`.
- **AC-28 — Control states → met.** T6/T7/T9 logs: `.gf-cta` states, 44 px secondary
  controls, focus rings, disabled states.
- **AC-29 — Typography and headings → met.** T6 owns the block; T8/T9/T10 assert the real
  `h2` elements and classes.
- **AC-30 — Responsive fit → CSS met, manual matrix unmet.** 720/721/short-viewport rule
  tests pass; the 320/375/768 visual fit checks are **not executed — environment**.
- **AC-31 — Accessibility, single live region and contrast → met.** Contrast table,
  aria-hidden decoration, single polite region tests, non-modal focus contract, 24 px
  minimize retained.
- **AC-32 — Motion tokens → met.** 12 tokens exact; four CSS mappings equal
  `${MOTION.<token>}ms`; 13 accepted mappings unchanged.
- **AC-33 — No external assets or dependencies → met.** Stylesheet hygiene tests (T6/T7);
  package/lockfile/workspace manifests byte-identical under the protected gates.
- **AC-34 — Render and bundle budget preserved → bundle met, main-scene traces unmet.**
  Build budget green (see AC-12); no main-scene loop/render/light/post/tier change; the
  main-scene frame trace is **not executed — environment**.
- **AC-35 — Documentation → met.** All new-string greps pass, both stale phrases are
  absent, both preserved phrases pass, controls are described, the two sections and the
  qualified single-loop wording exist, the glossary has the new term (and the merge keeps
  the presence term), and `docs/features/README.md` is untouched by this task.
- **AC-36 — Coverage → met.** `npm run coverage` exits 0 on the merged tree: backend
  96.2 / 89.92 / 99.57 / 96.2 and frontend 96.84 / 96.53 / 98.04 / 96.84 — all four
  metrics ≥ 80 in both workspaces, new modules included. No threshold or exclusion was
  changed.
- **AC-37 — Full gates → met.** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run coverage` and `npm run build` all exit 0 on the merged tree; `npm run smoke` was
  run (28/28 PASS) and is recorded, not a cross-service acceptance gate.
- **AC-38 — Containerization impact: none → met.** `compose.yaml`, `compose.smoke.yaml`,
  both Dockerfiles and `/ws` are unchanged under the protected gate; no service, port, env
  var or health signal is added.

## Rollback note

The change is client-local presentation only: no migration, schema, protocol, storage key
or persisted preference. Reverting the frontend commit/image restores the previous
customization panel (and its accepted 2D reveal) against the **same** `lootboxOpened`
payload; the inventory is still adopted by the opener and still broadcast by
`customizationUpdate`, so the grant and counts stay correct with or without the reveal. If
the deferred customization chunk fails to load, the existing `Customization could not be
loaded.` / `Try again` state applies; if the renderer or stage construction fails, the
inline SVG fallback applies. No server or data action is required. No metric, protocol
version or client cache entry is involved.

## Proposed feature-index row (`docs/features/README.md`, orchestrator-owned)

```markdown
| game-feel-overhaul | Game-Feel Overhaul (3D lootbox reveal on the player's ship + Neon Forge game shell) | code_review | 2026-11-16 |
```

The automated gate is green on the merged tree; the only open item is the manual
`workMs`/visual evidence (not executable here). The orchestrator should set the row to
`code_review` (or `accepted` with a recorded manual-evidence waiver) per its own state
rules. No other row is touched.

## Merge outcome and remaining blocker

**Merge outcome.** `69cd566` merges the accepted `feat/presence-and-activity-liveness`
tip (`36d03e7`) into the feature branch. One conflict existed —
`docs/product/glossary.md`, both-added-terms after `### prestige` — resolved by keeping
both definitions verbatim (`### presence`, then `### reveal stage`). No source/test
conflict occurred: `src/frontend/src/game/session.ts` and `session.test.ts` auto-merged, as
did `docs/architecture/frontend-rendering.md` and every other file. The merge commit is on
the feature branch and is not pushed.

**Automated gates.** Green on the merged tree: lint, typecheck, tests (backend 37/1538,
frontend 78/2432), coverage (backend 96.2/89.92/99.57/96.2, frontend
96.84/96.53/98.04/96.84), build (99,968 / 154,617 / 280,751 B gzip), smoke (28/28), and
the protected/doc gates with `BASE=36d03e7`. This satisfies AC-36 and AC-37.

**Remaining blocker — manual evidence only.** AC-15 (reveal `workMs`, three runs per size),
AC-34's main-scene frame trace, and the AC-30/AC-31 visual/keyboard matrix require a real
browser session. This environment has no browser on `PATH` and no Playwright/Puppeteer, and
the spec excludes browser automation, so they are recorded as **not executable in this
environment** — never as passed. The code/test-pinned structure evidence (22 draw calls,
872 triangles, one pose buffer, 30 fps cap, one panel context, deferred chunk) is recorded
in § Performance. Resolution options: run the manual matrix and traces on a GUI host and
append the raw values here, or have the orchestrator explicitly accept the environment
deferral for the human-visible evidence (the disposition used by
`adaptive-render-budget-v2`).

## Deviations from spec

- None in the documentation content or the owned files.
- The merge resolution is the one both-added-terms glossary conflict; both features'
  definitions are kept and no source/test assertion was changed by the merge.
- The manual visual/motion and frame-trace evidence is not executable in this environment
  and is recorded honestly above; nothing is recorded as passed that was not run.

## Appendix — `BASE...HEAD` file list

```text
$ git diff --name-status 36d03e7...HEAD
A  docs/features/game-feel-overhaul/build-log-T1.md … build-log-T10.md
M  src/frontend/src/App.test.tsx
M  src/frontend/src/App.tsx
M  src/frontend/src/game/motion.test.ts
M  src/frontend/src/game/motion.ts
A  src/frontend/src/game/reveal-motion.test.ts
A  src/frontend/src/game/reveal-motion.ts
M  src/frontend/src/game/session.test.ts
M  src/frontend/src/game/session.ts
A  src/frontend/src/render/lootbox-reveal.test.ts
A  src/frontend/src/render/lootbox-reveal.ts
M  src/frontend/src/ui/ActivityFeed.test.tsx / ActivityFeed.tsx
M  src/frontend/src/ui/ConnectionBanner.test.tsx / ConnectionBanner.tsx
M  src/frontend/src/ui/Hud.test.tsx / Hud.tsx
M  src/frontend/src/ui/Leaderboard.test.tsx / Leaderboard.tsx
A  src/frontend/src/ui/LootboxReveal.test.tsx
A  src/frontend/src/ui/LootboxReveal.tsx
M  src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx / .tsx
M  src/frontend/src/ui/UpgradesPanel.test.tsx / .tsx
M  src/frontend/src/ui/UserPanel.test.tsx / .tsx
M  src/frontend/src/ui/app.css / app.css.test.ts
M  src/frontend/src/ui/game-view.css / game-view.css.test.ts
M  src/frontend/src/ui/icons.test.tsx / icons.tsx
M  src/frontend/src/ui/theme.test.ts / theme.ts
```

No file outside `src/frontend/src/{App.tsx,App.test.tsx,game/motion*,game/reveal-motion*,
game/session*,render/lootbox-reveal*,ui/**,}` and `docs/features/game-feel-overhaul/` is
modified against `BASE=36d03e7`. The T11 documentation files (README, frontend-rendering,
glossary, build log) are added on top of this list by the T11 commits. Presence’s
`docs/features/README.md` row and presence’s own files are base content, not a T11 edit.
