# Build log — T11 — Verify & integrate (documentation + full gates)

Task: T11 (2026-11-16); evidence refreshed at the code-review r1 tip `544cce8` (2026-11-17).
Feature: game-feel-overhaul
Branch: `feat/game-feel-overhaul`, HEAD `544cce8` (`8ff8e71` T12 + the r1 code fixes).
**Status: automated gate GREEN at the reviewed tip. The manual `workMs`, main-scene frame
trace and visual/keyboard rows are covered by an explicit user waiver (2026-11-17,
§ Manual trace waiver) recorded in `status.md`; no trace table is claimed as passed.**

Files changed by T11 (content):

- `README.md` — Neon Forge HUD + 3D reveal wording, stale sentences removed.
- `docs/architecture/frontend-rendering.md` — `## Lootbox reveal stage`,
  `## Game shell layering`, qualified single-loop wording.
- `docs/product/glossary.md` — `lootbox reveal` updated, `### reveal stage` added,
  motion-token count 13 → 17; restored from `af97f5a` at review r1 (F1), presence terms kept.
- `docs/features/game-feel-overhaul/build-log-T11.md` (this file).

Review r1 docs fixes (F1/F2/F5/F7) are recorded in
`build-log-review-r1-docs.md`; the gate evidence below is from the reviewed tip.

## Branch provenance and base

The branch was squashed onto `main`: `5ef561e` (presence-and-activity-liveness, the squash
of the earlier presence tip `36d03e7`) → `dcb0573` (the game-feel feature squash, = `main`)
→ `8ff8e71` (T12 leaderboard/HUD clearance) → `544cce8` (code-review r1 code fixes).
`git merge-base main HEAD` is now `dcb0573`, so that literal diff is empty at this tip; the
protected-file gates are proven against the pre-squash presence base **`BASE=5ef561e`**,
whose tree is equivalent to the `36d03e7` base recorded by the earlier T11 run.

```text
$ git log --oneline -5
544cce8 fix: close game-feel review r1 code findings
8ff8e71 fix: clear the leaderboard below the HUD
dcb0573 Squashed commit of the following:          # = main
5ef561e Squashed commit of the following:          # presence squash = BASE
294b302 docs: accept render-backend-migration
$ git rev-parse 5ef561e dcb0573
5ef561e5b894d30e693e802b04b1023c78e54235
dcb0573fe7f3981525e41af96080bfb1d85a7694
$ git merge-base main HEAD
dcb0573fe7f3981525e41af96080bfb1d85a7694
$ git diff --stat 5ef561e...HEAD -- src/backend
(empty; exit 0)
```

`docs/product/glossary.md` is restored from `af97f5a` (review r1 F1), so the glossary at
this tip carries the accepted `lootbox reveal` 3D wording, `### reveal stage`, the 17
CSS-mapped durations and the presence term; `git diff af97f5a -- docs/product/glossary.md`
is empty.

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

Commands run from the repository root at `544cce8` with only the docs edits of this fix in
the working tree (no source/test change).

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
      Tests  2439 passed (2439)
```

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
      Tests  2439 passed (2439)
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.84 |    96.51 |   98.04 |   96.84 |
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
- **Frontend workspace: 96.84 / 96.51 / 98.04 / 96.84 — all four ≥ 80**, new modules
  included (`reveal-motion.ts` and `render/lootbox-reveal.ts` 100%,
  `LootboxReveal.tsx` 98.24). No exclusion or threshold was changed.

### `npm run build` → exit 0

```text
> build
> npm run build --workspaces --if-present


> build
> tsc


> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
transforming...
✓ 113 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.49 kB │ gzip:   0.31 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-BDvF3gy2.css                        38.94 kB │ gzip:   7.29 kB
dist/assets/cursor-ship-YWEzR2zT.js                    6.73 kB │ gzip:   2.21 kB
dist/assets/SpaceshipCustomizationPanel-Baxl9jh6.js   15.99 kB │ gzip:   5.67 kB
dist/assets/browser-env-DX-N50Hx.js                   49.34 kB │ gzip:  18.21 kB
dist/assets/index-CWLKQMhG.js                        101.64 kB │ gzip:  31.01 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-4kUmpljF.js                        610.31 kB │ gzip: 154.62 kB
✓ built in 1.42s
entry index assets/index-CWLKQMhG.js raw=101641 gzip=31014
initial files=2 raw=323340 gzip=99970 budget=150000
three assets/three-4kUmpljF.js raw=610310 gzip=154617 budget=165000
total files=6 raw=1005710 gzip=280670 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-Baxl9jh6.js raw=15987 gzip=5666 initial=false
chunk browser-env assets/browser-env-DX-N50Hx.js raw=49344 gzip=18205 initial=false
chunk cursor-ship assets/cursor-ship-YWEzR2zT.js raw=6729 gzip=2212 initial=false
chunk index assets/index-CWLKQMhG.js raw=101641 gzip=31014 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-4kUmpljF.js raw=610310 gzip=154617 initial=false

Bundle budget OK.
```

`dist/bundle-report.json`: **1884 bytes** (`wc -c`). `initial.files` is exactly
`[assets/index-CWLKQMhG.js, assets/react-BYqCGoBQ.js]` — the `three` chunk is
`initial=false`. `dist/index.html` preloads only the react chunk;
`grep -c 'three-' dist/index.html` = `0`.

### `npm run smoke` → exit 0 (recorded; not a cross-service acceptance gate)

F7 provenance: the smoke-only `frontend-prod` image was **rebuilt from the current tip**
(`podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` → exit 0,
`Successfully tagged cubeclicker-frontend:prod-smoke`), with image id
**`sha256:4b4d7e12231406c75559e5964f3a0f618a63a16900f371d600e6c696df386de4`**
(`podman image inspect … --format '{{.Id}}'`) and the `frontend-prod` container recreated
from that image before the run. The image's own build serves
**`/assets/index-6XwuB9OH.js`** (101,707 B decompressed, gzip + immutable caching), so the
28/28 result is tied to the reviewed tip, not a cached T11 image.

```text
> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-backend-1 Running 
 Container cubeclicker-frontend-1 Running 
 Container cubeclicker-db-1 Running 
 Container cubeclicker-mailpit-1 Running 
 Container cubeclicker-frontend-prod-1 Running 
 Container cubeclicker-db-1 Waiting 
 Container cubeclicker-db-1 Healthy 
 Container cubeclicker-smoke-run-08bb5edf964d Creating 
 Container cubeclicker-smoke-run-08bb5edf964d Created 
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
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1003ms
PASS activity leave: A receives the memberLeft activity event with B's name and an id newer than the snapshot id — memberLeft id 2 for p9
PASS multiplayer explicit leave: D's leave yields memberLeft(left) on A in under 900ms without the grace window — memberLeft(left) received after 0ms
PASS multiplayer slot reuse: E fills D's freed slot 2 with welcome.roster exactly [A, E] — server 5; roster [A, E] in D's freed slot 2
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=18 cubeclicker_ws_messages_received_total{type="join"}=14 cubeclicker_ws_frames_sent_total{type="hello"}=18
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-6XwuB9OH.js is served gzip with immutable caching — content-encoding gzip; 101707 B decompressed
PASS prod /assets/three-4kUmpljF.js is served gzip with immutable caching — content-encoding gzip; 610310 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (28/28 checks)
```

## Protected-file proof

`BASE=5ef561e` (the presence squash, tree-equivalent to the `36d03e7` presence tip used by
the earlier T11 run). All gates exit 0:

```text
$ BASE=$(git rev-parse 5ef561e)
BASE=5ef561e5b894d30e693e802b04b1023c78e54235
HEAD=544cce8d0dd4a3ae431e3fac423336e1307607c1
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

`src/backend` is byte-identical to the pre-squash presence base; the feature-only diff is
the frontend/DOM/CSS work plus this feature's documentation (appendix). Because the branch
is now squashed onto `main` (`git merge-base main HEAD` = `dcb0573`), the literal
merge-base range is empty; `5ef561e` is the presence-tree base the review used, so the
protected proof is unchanged in substance from the merged-base run.

## Documentation gates

```text
BASE=5ef561e5b894d30e693e802b04b1023c78e54235
HEAD=544cce8d0dd4a3ae431e3fac423336e1307607c1
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
PASS glossary 17 CSS-mapped durations
PASS docs/features/README.md not modified in the working tree
```

All strings and negatives from the T11 verify list pass at `544cce8`; the glossary now
carries the accepted 3D `lootbox reveal` wording, `### reveal stage`, the 17-duration count
and the presence term (review r1 F1 fixed). New documentation links resolve:
`docs/architecture/frontend-rendering.md` links to `src/frontend/src/game/reveal-motion.ts`,
`src/frontend/src/render/lootbox-reveal.ts` and `src/frontend/src/ui/LootboxReveal.tsx`,
all present at `HEAD`; the README's `docs/features/game-feel-overhaul/` directory is
tracked by the feature-artifact commits.

## Performance — traces (waived) and structural budget

**Reveal `workMs` traces — not executed — environment (waived by the user, 2026-11-17).**
AC-15 asks for a 10-second trace at 1280×720 and 1920×1080, three clean runs per size,
measuring `performance.now()` either side of `stage.update()` + `renderer.render()` in the
reveal frame callback. No browser runs in this environment (§ Environment) and the spec
excludes browser automation, so no run exists; per the explicit waiver below, no table is
claimed as passing:

| Size | Run 1 | Run 2 | Run 3 | Median | Verdict |
| --- | --- | --- | --- | --- | --- |
| 1280×720 | not executed — environment | not executed — environment | not executed — environment | — | waived, not passed |
| 1920×1080 | not executed — environment | not executed — environment | not executed — environment | — | waived, not passed |

**Main-scene trace with the customization panel open — not executed — environment (same
waiver).** AC-34's avg ≤ 16.7 / p95 ≤ 33 requirement is waived; the bundle budget is met
and the main scene adds no loop, render pass, light, post-processing parameter or
quality-tier input.

**Structural budget pinned by code and tests** (the accepted code-pinned evidence):

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
  animations (T7 log), and the review r1 session reduced-motion fix extends the disables to
  the session preference (`544cce8`).

## Manual trace waiver (2026-11-17)

**The user explicitly waived the AC-15 `workMs` and AC-34 main-scene trace requirement
because the build environment is headless.** The waiver accepts the real-browser visual
pass plus the code-pinned draw/triangle/allocation/30 fps budgets as the evidence for those
criteria. **No trace table is claimed as passed**; the "not executed — environment" rows
above remain the honest record. The waiver covers the AC-30 320×568 / 375×667 / 768×1024
visual rows that share the same environment limitation, and the AC-31/AC-15 real-browser
keyboard/visual checks. It is recorded in `docs/features/game-feel-overhaul/status.md`
(2026-11-17 loop-log entry, "explicit user waiver") and in `reviews/code-review-r1.md` §
Manual-evidence disposition as the accepted alternative to the traces.

## Manual visual/motion matrix

Recorded from code/tests where possible; the browser-only rows are **not executed —
environment** and are covered by the 2026-11-17 waiver (§ Manual trace waiver), never
claimed as passed.

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
  exclude `three`; `index.html` preloads no `three-` asset; build budget 99,970 / 154,617 /
  280,670 B gzip vs 150,000 / 165,000 / 300,000.
- **AC-13 — Panel close is a dismissal → met.** Unmount dismisses once, reopen normal,
  data attribute true/false; App toggle-click test green.
- **AC-14 — Rarity, duplicate and epic flourish → met.** Component/panel tests plus the
  exact eight-ray CSS and reduced-motion off-switch.
- **AC-15 — Reveal per-frame work and budget → met (user waiver).** 22 draw calls ≤ 24,
  872 triangles ≤ 2596, one pose buffer, 30 fps cap/hidden pause/dispose tests. The
  three-run `workMs` traces per size are **not executed — environment** (no browser) and
  are explicitly waived by the user on 2026-11-17 (§ Manual trace waiver); they are not
  claimed as passed.
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
  controls, focus rings, disabled states. AC-28 now states explicitly that `.users-badge`
  intentionally keeps the capsule `border-radius: 999px` while the other badge/control
  surfaces use `--gf-radius-control` (review r1 F5 wording clarification; no CSS change).
- **AC-29 — Typography and headings → met.** T6 owns the block; T8/T9/T10 assert the real
  `h2` elements and classes.
- **AC-30 — Responsive fit → met (CSS + user waiver).** 720/721/short-viewport rule tests
  pass; the 320/375/768 visual fit rows are **not executed — environment** and are covered
  by the same 2026-11-17 waiver (§ Manual trace waiver).
- **AC-31 — Accessibility, single live region and contrast → met.** Contrast table,
  aria-hidden decoration, single polite region tests, non-modal focus contract, 24 px
  minimize retained.
- **AC-32 — Motion tokens → met.** 12 tokens exact; four CSS mappings equal
  `${MOTION.<token>}ms`; 13 accepted mappings unchanged.
- **AC-33 — No external assets or dependencies → met.** Stylesheet hygiene tests (T6/T7);
  package/lockfile/workspace manifests byte-identical under the protected gates.
- **AC-34 — Render and bundle budget preserved → met (bundle + user waiver).** Build
  budget green (see AC-12); no main-scene loop/render/light/post/tier change. The
  main-scene frame trace is **not executed — environment** and is explicitly waived by the
  user on 2026-11-17 (§ Manual trace waiver); it is not claimed as passed.
- **AC-35 — Documentation → met.** All new-string greps pass at `544cce8`, both stale
  phrases are absent, both preserved phrases pass, controls are described, the two sections
  and the qualified single-loop wording exist. The glossary is restored from `af97f5a`
  (review r1 F1): 3D `lootbox reveal` wording, `### reveal stage`, 17 CSS-mapped durations,
  and the presence term kept; `docs/features/README.md` is untouched by this task.
- **AC-36 — Coverage → met.** `npm run coverage` exits 0 at `544cce8`: backend
  96.2 / 89.92 / 99.57 / 96.2 and frontend 96.84 / 96.51 / 98.04 / 96.84 — all four
  metrics ≥ 80 in both workspaces, new modules included. No threshold or exclusion was
  changed.
- **AC-37 — Full gates → met.** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run coverage` and `npm run build` all exit 0 at `544cce8`; `npm run smoke` was run
  against the rebuilt tip image (28/28 PASS) and is recorded, not a cross-service
  acceptance gate.
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
| game-feel-overhaul | Game-Feel Overhaul (3D lootbox reveal on the player's ship + Neon Forge game shell) | code_review | 2026-11-17 |
```

The automated gate is green at `544cce8`; the manual `workMs`/main-scene/visual evidence is
covered by the explicit 2026-11-17 user waiver (§ Manual trace waiver). The orchestrator
sets the row/state per its own rules. No other row is touched.

## Review close-out (code-review r1 docs/evidence fixes)

- **F1 (BLOCKER) — fixed.** `docs/product/glossary.md` is restored from `af97f5a`;
  `git diff af97f5a -- docs/product/glossary.md` is empty, so `lootbox reveal` is the
  accepted 3D wording, `### reveal stage` exists and `motion token` says 17 CSS-mapped
  durations. The presence term is preserved. The glossary greps in § Documentation gates
  pass.
- **F2 (BLOCKER) — fixed by explicit user waiver (2026-11-17).** § Manual trace waiver
  records the waiver of AC-15 `workMs` and the AC-34 main-scene trace; `status.md` records
  it in the loop log; no trace table is claimed as passed. The AC-15/AC-34 findings are met
  under that waiver, not silently relaxed.
- **F5 (MINOR) — fixed.** AC-28 and the per-surface Users row in `spec.md` now state the
  capsule `border-radius: 999px` for `.users-badge`; the other badge/control surfaces use
  `--gf-radius-control`; revision-history r3a records a wording clarification only. No CSS
  change.
- **F7 (INFO) — fixed.** The smoke image was rebuilt from `544cce8`
  (`sha256:4b4d7e12231406c75559e5964f3a0f618a63a16900f371d600e6c696df386de4`), the
  `frontend-prod` container recreated from it, the served prod asset is
  `/assets/index-6XwuB9OH.js`, and `npm run smoke` passes 28/28 (raw block above).
- **F3/F4/F6/F8** are code/spec findings closed in `544cce8` and this docs commit; this
  log records the re-run gate and does not re-review them.

**Remaining manual-evidence status.** The 2026-11-17 user waiver is the recorded
disposition for the headless environment: the real-browser visual pass and the code-pinned
budgets are accepted, and the trace rows stay honest as "not executed — environment".

## Deviations from spec

- None in the documentation content or the owned files.
- This fix changes only documentation (glossary restore, spec wording clarification, build
  log evidence/waiver and the new review-docs log). No source, test, CSS or container file
  is changed.
- The manual visual/motion and frame-trace evidence is waived by the user (2026-11-17) and
  remains recorded as not executed; nothing is claimed as passed that was not run.

## Appendix — `BASE...HEAD` file list

```text
$ git diff --name-status 5ef561e...HEAD
M	README.md
M	docs/architecture/frontend-rendering.md
A	docs/features/game-feel-overhaul/build-log-T1.md
A	docs/features/game-feel-overhaul/build-log-T10.md
A	docs/features/game-feel-overhaul/build-log-T11.md
A	docs/features/game-feel-overhaul/build-log-T12.md
A	docs/features/game-feel-overhaul/build-log-T2.md
A	docs/features/game-feel-overhaul/build-log-T3.md
A	docs/features/game-feel-overhaul/build-log-T4.md
A	docs/features/game-feel-overhaul/build-log-T5.md
A	docs/features/game-feel-overhaul/build-log-T6.md
A	docs/features/game-feel-overhaul/build-log-T7.md
A	docs/features/game-feel-overhaul/build-log-T8.md
A	docs/features/game-feel-overhaul/build-log-T9.md
A	docs/features/game-feel-overhaul/build-log-review-r1-code.md
A	docs/features/game-feel-overhaul/plan.md
A	docs/features/game-feel-overhaul/reviews/spec-review-r1.md
A	docs/features/game-feel-overhaul/reviews/spec-review-r2.md
A	docs/features/game-feel-overhaul/reviews/spec-review-r2a.md
A	docs/features/game-feel-overhaul/spec.md
A	docs/features/game-feel-overhaul/status.md
A	docs/features/game-feel-overhaul/tasks.md
M	src/frontend/src/App.test.tsx
M	src/frontend/src/App.tsx
M	src/frontend/src/game/motion.test.ts
M	src/frontend/src/game/motion.ts
A	src/frontend/src/game/reveal-motion.test.ts
A	src/frontend/src/game/reveal-motion.ts
M	src/frontend/src/game/session.test.ts
M	src/frontend/src/game/session.ts
A	src/frontend/src/render/lootbox-reveal.test.ts
A	src/frontend/src/render/lootbox-reveal.ts
M	src/frontend/src/ui/ActivityFeed.test.tsx
M	src/frontend/src/ui/ActivityFeed.tsx
M	src/frontend/src/ui/ConnectionBanner.test.tsx
M	src/frontend/src/ui/ConnectionBanner.tsx
M	src/frontend/src/ui/Hud.test.tsx
M	src/frontend/src/ui/Hud.tsx
M	src/frontend/src/ui/Leaderboard.test.tsx
M	src/frontend/src/ui/Leaderboard.tsx
A	src/frontend/src/ui/LootboxReveal.test.tsx
A	src/frontend/src/ui/LootboxReveal.tsx
M	src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx
M	src/frontend/src/ui/SpaceshipCustomizationPanel.tsx
M	src/frontend/src/ui/UpgradesPanel.test.tsx
M	src/frontend/src/ui/UpgradesPanel.tsx
M	src/frontend/src/ui/UserPanel.test.tsx
M	src/frontend/src/ui/UserPanel.tsx
M	src/frontend/src/ui/app.css
M	src/frontend/src/ui/app.css.test.ts
M	src/frontend/src/ui/game-view.css
M	src/frontend/src/ui/game-view.css.test.ts
M	src/frontend/src/ui/icons.test.tsx
M	src/frontend/src/ui/icons.tsx
M	src/frontend/src/ui/theme.test.ts
M	src/frontend/src/ui/theme.ts
```

No protected file is modified: `src/backend`, `compose.yaml`, `compose.smoke.yaml`, both
Dockerfiles, the root/workspace package files, and
`src/frontend/src/render/{preview,cursor-ship,spaceship,scene,webgl,postprocessing}.ts`,
`src/frontend/src/game/engine.ts`, `src/frontend/src/multiplayer/**`,
`src/frontend/src/main.tsx` and the four auth component modules are byte-identical to
`5ef561e` (§ Protected-file proof). `docs/features/README.md` carries only the
presence-authored row; the game-feel row remains orchestrator-owned.
