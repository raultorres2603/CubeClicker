# Build log — T5 — Verify, integrate and document

Task: T5 (2026-11-17), feature `hangar-tabs-and-menu-motion`, branch
`feat/hangar-tabs-and-menu-motion` at HEAD `e8eff72`.
Status: **executable gate complete and green**; the visual/motion manual matrix and the
AC-24 render traces are **not executable in this headless environment**. The user accepted
the real-browser visual/motion pass and the structural/bundle evidence, and explicitly
waived the AC-24 trace protocol on 2026-11-17 (§ AC-24 trace waiver); no trace table is
claimed as passed.

Files changed (only `files_owned`):

- `README.md`
- `docs/architecture/frontend-rendering.md`
- `docs/product/glossary.md`
- `docs/features/hangar-tabs-and-menu-motion/build-log-T5.md` (this log)

Base: `BASE=$(git merge-base main HEAD)` = `e613eb4cb9468b60b3ea6b65240548fc324f7bf3`
(`e613eb4 specs`, the feature-planning commit on `main`); the base **code** is `544cce8`
(game-feel review fixes), which `BASE` contains unchanged. `HEAD=e8eff72`.

## What changed & why

1. Ran the full root gate at HEAD `e8eff72` — `npm run lint`, `npm run typecheck`,
   `npm test`, `npm run coverage`, `npm run build` — and the containerized `npm run smoke`
   (Podman 6.1.3 is available): every command exited `0`, both workspace coverage tables
   are above the unchanged 80% thresholds, and the build is inside the
   150,000 / 165,000 / 300,000 B gzip ceilings.
2. Recorded the bundle bytes, `initial.files` membership, the manifest dynamic-import
   membership and a string-level proof that the hangar-tab code lives only in the deferred
   `SpaceshipCustomizationPanel-<hash>.js` chunk.
3. Ran the protected-file `git diff`/`git status` gates (backend, compose, Dockerfiles,
   package files, `multiplayer`, `app.css`/test, `App.tsx`, `render`, `engine.ts`,
   `main.tsx`) and the `docs/features` / `docs/features/README.md` scope gates: all exit
   `0`; `App.test.tsx` shows only the two T3-owned (r2a) hunks.
4. Documentation pass: `README.md` gained the exact phrases `tabbed spaceship hangar` and
   `glitch boot animation` while keeping the four accepted phrases; `frontend-rendering.md`
   gained `## Menu motion` (five keyframes, four tokens and their `--motion-*` mirrors,
   320 ms boot, 140 ms tab swap, open-only, no-`transform`, reduced-motion scoping, tab
   structure) with `## Game shell layering` unchanged; the glossary gained `### hangar tab`
   and updated `### motion token` to 21 CSS-mapped durations including the four new tokens.
5. Recorded the AC-23…AC-29 audit below. The manual visual/motion matrix and the AC-24
   10 s idle + 10 clicks/s traces were **not executed here** (headless host: no GUI browser,
   no real GPU/frame timeline) and are listed as the remaining T5 evidence.

## Decisions

- **The gate ran against the feature HEAD, before the docs edits.** All five root commands
  and smoke were started at `e8eff72`; only the orchestrator's `status.md`/`tasks.md` board
  edits were present in the tree (inside this feature's directory), so no protected or
  other-feature path could influence the result. The docs pass landed after the gate and
  only touches the three documentation targets plus this log.
- **`COLUMNS=220` for coverage** only widens the table so the `Uncovered Line #s` column is
  readable; it changes no threshold, config or result.
- **The bundle proof is membership-based, not a new budget check.** `npm run build` already
  chains `check-bundle-budget.mjs`; this task records its live `dist/bundle-report.json`
  and verifies with `grep -cF` that the tab DOM strings exist in the deferred panel chunk
  and are absent from both initial chunks.
- **Manual matrix and traces stay open.** The project's spec forbids browser automation /
  visual-regression tooling, and this environment has no GUI; claiming those rows would be
  fabricated evidence. They are marked not executable and listed for the user's GUI pass.
- **`docs/features/README.md` is untouched**; the proposed row is recorded at the end of
  this log for the orchestrator to apply.

## Evidence

### 1. Root gate at HEAD `e8eff72`

Commands, in order (raw combined output below, exit codes inline):

```bash
npm run lint
npm run typecheck
npm test
COLUMNS=220 npm run coverage
npm run build
```

```text
=== npm run lint ===

> lint
> eslint .

LINT_EXIT=0
=== npm run typecheck ===

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
=== npm test ===

> test
> npm run test --workspaces --if-present


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/upgrades.test.ts (20 tests) 5ms
 ✓ src/auth/config.test.ts (29 tests) 12ms
 ✓ src/auth/user-repository.test.ts (40 tests) 18ms
 ✓ src/game/parts.test.ts (19 tests) 10ms
 ✓ src/observability/metrics.test.ts (33 tests) 9ms
 ✓ src/db/migrate.test.ts (11 tests) 18ms
 ✓ src/game/cubes.test.ts (24 tests) 11ms
 ✓ src/game/broadcast.test.ts (13 tests) 17ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 16ms
 ✓ src/auth/session-repository.test.ts (35 tests) 17ms
 ✓ src/game/parts-v2.test.ts (40 tests) 19ms
 ✓ src/game/players.test.ts (13 tests) 9ms
 ✓ src/observability/shutdown.test.ts (7 tests) 8ms
 ✓ src/auth/email.test.ts (12 tests) 8ms
 ✓ src/db/migrate-runner.test.ts (14 tests) 13ms
 ✓ src/observability/db-metrics.test.ts (8 tests) 16ms
 ✓ src/game/activity.test.ts (24 tests) 15ms
 ✓ src/game/leaderboard.test.ts (23 tests) 20ms
 ✓ src/game/servers.test.ts (47 tests) 110ms
 ✓ src/observability/config.test.ts (24 tests) 5ms
 ✓ src/game/economy.test.ts (20 tests) 7ms
 ✓ src/observability/logging.test.ts (28 tests) 151ms
 ✓ src/observability/metrics-route.test.ts (3 tests) 180ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 13ms
 ✓ src/db/pool.test.ts (10 tests) 5ms
 ✓ src/game/config.test.ts (13 tests) 8ms
 ✓ src/auth/rate-limit.test.ts (19 tests) 8ms
 ✓ src/game/protocol.test.ts (467 tests) 65ms
 ✓ src/auth/password.test.ts (17 tests) 296ms
 ✓ src/game/hub.test.ts (194 tests) 292ms
 ✓ src/cors.test.ts (20 tests) 191ms
 ✓ src/auth/auth-routes.test.ts (28 tests) 829ms
 ✓ src/auth/auth-service.test.ts (50 tests) 960ms
 ✓ src/db/migration-006.test.ts (13 tests) 2195ms
 ✓ src/auth/economy-repository.test.ts (119 tests) 2161ms
 ✓ src/db/migration-007.test.ts (11 tests) 2193ms
 ✓ src/app.test.ts (38 tests) 2414ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1105ms

 Test Files  37 passed (37)
      Tests  1538 passed (1538)
   Start at  12:36:39
   Duration  3.26s (transform 5.28s, setup 0ms, collect 12.70s, tests 12.33s, environment 7ms, prepare 2.89s)


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/game/parts-v2.test.ts (50 tests) 25ms
 ✓ src/game/rotation.test.ts (15 tests) 6ms
 ✓ src/game/board.test.ts (18 tests) 19ms
 ✓ src/render/webgl.test.ts (25 tests) 23ms
 ✓ src/render/background-life.test.ts (14 tests) 17ms
 ✓ src/ui/ActivityFeed.test.tsx (8 tests) 16ms
 ✓ src/render/impact-effects.test.ts (22 tests) 28ms
 ✓ src/auth/api.test.ts (31 tests) 19ms
 ✓ src/ui/icons.test.tsx (18 tests) 22ms
 ✓ src/render/preview.test.ts (7 tests) 28ms
 ✓ src/multiplayer/protocol.test.ts (554 tests) 72ms
 ✓ src/render/quality.test.ts (29 tests) 84ms
 ✓ src/render/lootbox-reveal.test.ts (16 tests) 61ms
 ✓ src/render/starfield.test.ts (28 tests) 105ms
 ✓ src/render/picking.test.ts (16 tests) 85ms
 ✓ src/input/gestures.test.ts (27 tests) 37ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 125ms
 ✓ src/render/targeting.test.ts (11 tests) 61ms
 ✓ src/game/engine.test.ts (113 tests) 90ms
 ✓ src/render/cursor-ship.test.ts (34 tests) 136ms
 ✓ src/build/vite-config.test.ts (11 tests) 315ms
 ✓ src/render/spaceship.test.ts (40 tests) 122ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 194ms
 ✓ src/render/cube-view.test.ts (37 tests) 176ms
 ✓ src/render/world.test.ts (29 tests) 199ms
 ✓ src/render/particles.test.ts (24 tests) 22ms
 ✓ src/game/parts.test.ts (23 tests) 8ms
 ✓ src/multiplayer/server-state.test.ts (87 tests) 25ms
 ✓ src/ui/Leaderboard.test.tsx (10 tests) 23ms
 ✓ src/render/scene-effects.test.ts (9 tests) 189ms
 ✓ src/multiplayer/activity-lifetime.test.ts (18 tests) 12ms
 ✓ src/ws/connection.test.ts (10 tests) 18ms
 ✓ src/render/ship-motion.test.ts (24 tests) 7ms
 ✓ src/game/progression.test.ts (21 tests) 8ms
 ✓ src/config.test.ts (20 tests) 6ms
 ✓ src/game/effects.test.ts (30 tests) 13ms
 ✓ src/render/postprocessing.test.ts (14 tests) 15ms
 ✓ src/ui/theme.test.ts (17 tests) 15ms
 ✓ src/browser-env.test.ts (7 tests) 15ms
 ✓ src/auth/store.test.ts (31 tests) 16ms
 ✓ src/ui/hangar-tabs.test.ts (17 tests) 9ms
 ✓ src/render/nebula.test.ts (11 tests) 504ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  424ms
 ✓ src/input/keyboard.test.ts (13 tests) 17ms
 ✓ src/multiplayer/transport.test.ts (15 tests) 22ms
 ✓ src/build/bundle-budget.test.ts (11 tests) 11ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 151ms
 ✓ src/game/motion.test.ts (14 tests) 13ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 11ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 12ms
 ✓ src/game/reveal-motion.test.ts (45 tests) 10ms
 ✓ src/perf/overlay.test.ts (4 tests) 11ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 12ms
 ✓ src/docs/links.test.ts (1 test) 6ms
 ✓ src/game/upgrades.test.ts (20 tests) 13ms
 ✓ src/game/economy.test.ts (7 tests) 5ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 5ms
 ✓ src/build/nginx-config.test.ts (6 tests) 6ms
 ✓ src/render/scene-spaceship.test.ts (28 tests) 550ms
 ✓ src/render/scene.test.ts (90 tests) 1172ms
 ✓ src/ui/LevelCompleteBanner.test.tsx (6 tests) 59ms
 ✓ src/ui/PerfOverlay.test.tsx (5 tests) 134ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 289ms
 ✓ src/ui/GameCanvas.runtime.test.tsx (5 tests) 166ms
 ✓ src/ui/ConnectionBanner.test.tsx (7 tests) 196ms
 ✓ src/ui/DeferredSpaceshipCustomizationPanel.test.tsx (5 tests) 247ms
 ✓ src/ui/SpaceshipPreview.test.tsx (12 tests) 108ms
 ✓ src/ui/Hud.test.tsx (24 tests) 299ms
 ✓ src/ui/app.css.test.ts (46 tests) 262ms
 ✓ src/ui/UserPanel.test.tsx (14 tests) 272ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel hangar tabs (AC-2, AC-3) > renders one five-tab tablist with the pinned ARIA contract in the normal state
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 200ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel hangar tabs (AC-2, AC-3) > renders exactly one tabpanel wrapping only the active group rows
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab activation (AC-4) > selects a tab on click in the same commit
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/UpgradesPanel.test.tsx (15 tests) 313ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab activation (AC-4) > moves selection and focus with ArrowRight, ArrowLeft, Home and End, and prevents the default
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab swap (AC-15, AC-16) > mounts a new tabpanel per switch while the strip and the preview stay mounted
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab swap (AC-15, AC-16) > adds no timer and no closing state for a tab switch
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab badges (AC-5) > renders 0/4 for every tab when nothing is owned
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab badges (AC-5) > counts only owned lootable parts, per tab
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab badges (AC-5) > reaches the 4/4 badge maximum when both rare and both epic parts are owned
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab badges (AC-5) > never counts standard parts, zero counts or unknown ids
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab badges (AC-5) > counts a bilateral legacy wing id for both wings after normalization
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/LootboxReveal.test.tsx (39 tests) 446ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab badges (AC-5) > counts the legacy engine id for both ignitions after normalization
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab badges (AC-5) > counts a single-slot legacy hull id once after normalization
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/AuthMenu.test.tsx (19 tests) 403ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel post-reveal landing (AC-6) > opens on frame and resets to frame after a full reveal cycle
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel post-reveal landing (AC-6) > lands on the wings tab in one commit with no frame value (AC-6)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel post-reveal landing (AC-6) > lands on frame for a hull grant in that same single mutation (AC-6)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel post-reveal landing (AC-6) > lands on frame for an unknown or invalid part (AC-6)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/GameCanvas.test.tsx (7 tests) 230ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-21, AC-29) > renders two rows for the active tab and reaches all ten catalog slots through the strip
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/game-view.css.test.ts (99 tests) 633ms
   ✓ stylesheet integration (AC-18, AC-19, AC-21, AC-27) > cascades the shared frame, the minimized grid and the layer stack onto real markup  352ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-21, AC-29) > renders exactly three variants per row with catalog rarity and a colour swatch
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-21, AC-29) > shows the slot display name and the equipped part name for every slot
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-21, AC-29) > marks owned parts and exposes equipped/label states on the equip controls
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-21, AC-29) > renders a 44px-capable unequip control per slot, disabled at the standard part
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-21, AC-29) > calls onUnequip with the slot id only for an enabled control
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-21, AC-29) > normalizes legacy direct props into the v2 slot rows
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App > drives data-customization-open from the customization toggle (AC-7, AC-18)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/game/session.test.ts (132 tests) 1816ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-21, AC-29) > keeps every panel control at a 44px minimum pointer target (AC-28, AC-31)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel control matrix (AC-10) > exposes 10 equip + 10 unequip controls across the five tabs for the empty inventory
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel control matrix (AC-10) > exposes 30 equip + 10 unequip controls across the five tabs when all parts are owned
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > renders the hangar title, both gf chips and one Open lootbox control
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > keeps the pinned normal-state order: title, counts, open control, tablist, tabpanel, preview
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > renders the accepted normal branch without the reveal (AC-13, AC-21)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > disables Open lootbox when lootboxes are zero
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > disables Open lootbox when keys are zero
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > disables Open lootbox while an account open is pending
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > enables Open lootbox with both counts and no pending open
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > calls onOpenLootbox once when the enabled control is clicked
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > keeps the pre-v2 onOpen alias working
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > replaces the whole normal branch with the reveal while a grant is present
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > renders the rare/new reveal region with the pinned attributes and copy
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > renders the epic duplicate copy and the epic rarity channel
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > derives the slot from the catalog and never trusts the wire slot
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > keeps the grant identity on the reveal root, not a section-level mirror (D-1)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > advances through the exact 420 + 250 + 120 + 360 + 140 ms timeline
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > restarts the timeline when the same part is reopened with a new sequence
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > renders the settled reveal instantly under reduced motion without phase timers
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > does not mutate the appearance prop while the reveal is mounted (AC-5)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > focuses the reveal Equip control on mount
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > dismisses the reveal through onDismissReveal exactly once
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > dismisses the reveal on Escape exactly once
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > equips the granted part, then dismisses, and flashes the reappearing row
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/AuthForms.test.tsx (44 tests) 816ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > restores focus to Open lootbox after an in-panel dismissal
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > restores focus to Open lootbox after Escape
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > dismisses exactly once when the panel unmounts while revealing
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > reopens the normal panel after the unmount dismissal cleared the grant
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > never dismisses on a grant-to-grant replacement, but does once on unmount
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > does not restore focus to the absent Open lootbox on unmount
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > keeps the reveal mounted with no input for 10 seconds (no auto-dismiss)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel equip-row flash (AC-43) > sets data-equipping on the equipped slot for exactly 260 ms
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel equip-row flash (AC-43) > adds no row flash under reduced motion
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel preview (AC-31) > renders no preview canvas while revealing (one panel canvas at most)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel mode > records the authenticated mode on the section while revealing
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (66 tests) 802ms
stderr | src/App.test.tsx > App — customization panel integration (AC-29, AC-32, AC-43) > passes pendingLootboxOpen to the panel and disables Open lootbox while pending
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — customization panel integration (AC-29, AC-32, AC-43) > enables Open lootbox when the open is not pending
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — customization panel integration (AC-29, AC-32, AC-43) > passes the last grant into the reveal region and dismisses it through the session
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — customization panel integration (AC-29, AC-32, AC-43) > routes panel equip and unequip controls to the session commands
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > renders the reveal on the opener tab and never on a second tab that only adopted the parts (AC-2)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > renders the reveal on the opener tab and never on a second tab that only adopted the parts (AC-2)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > drops a mid-reveal when the transport leaves connected: the session clears the grant and publishes the snapshot (AC-11)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > drops a mid-reveal when the transport leaves connected: the session clears the grant and publishes the snapshot (AC-11)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > treats a toggle-click close as a dismissal and never restores focus to the absent Open lootbox (AC-13)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > treats a toggle-click close as a dismissal and never restores focus to the absent Open lootbox (AC-13)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > renders one decorative ambience layer and keeps the reveal non-modal (AC-27)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > keeps exactly one polite live region once the customization chunk resolves (AC-31)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > adds no live region while the reveal is mounted (AC-31)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > keeps the gameplay headings real h2 elements and the panel aria-labels (AC-29)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/App.test.tsx (62 tests) 1247ms

 Test Files  79 passed (79)
      Tests  2505 passed (2505)
   Start at  12:36:43
   Duration  3.78s (transform 8.75s, setup 0ms, collect 23.84s, tests 13.93s, environment 11.24s, prepare 6.16s)

TEST_EXIT=0
=== npm run coverage ===

> coverage
> npm run coverage --workspaces --if-present


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/config.test.ts (13 tests) 7ms
 ✓ src/game/broadcast.test.ts (13 tests) 12ms
 ✓ src/auth/user-repository.test.ts (40 tests) 18ms
 ✓ src/observability/metrics.test.ts (33 tests) 13ms
 ✓ src/auth/rate-limit.test.ts (19 tests) 10ms
 ✓ src/game/cubes.test.ts (24 tests) 13ms
 ✓ src/auth/config.test.ts (29 tests) 13ms
 ✓ src/game/players.test.ts (13 tests) 8ms
 ✓ src/db/migrate.test.ts (11 tests) 8ms
 ✓ src/db/migrate-runner.test.ts (14 tests) 8ms
 ✓ src/observability/db-metrics.test.ts (8 tests) 7ms
 ✓ src/game/parts-v2.test.ts (40 tests) 22ms
 ✓ src/game/parts.test.ts (19 tests) 6ms
 ✓ src/auth/session-repository.test.ts (35 tests) 18ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 14ms
 ✓ src/game/activity.test.ts (24 tests) 15ms
 ✓ src/game/leaderboard.test.ts (23 tests) 18ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 14ms
 ✓ src/game/servers.test.ts (47 tests) 125ms
 ✓ src/observability/metrics-route.test.ts (3 tests) 163ms
 ✓ src/observability/logging.test.ts (28 tests) 178ms
 ✓ src/game/economy.test.ts (20 tests) 5ms
 ✓ src/db/pool.test.ts (10 tests) 8ms
 ✓ src/observability/shutdown.test.ts (7 tests) 6ms
 ✓ src/game/upgrades.test.ts (20 tests) 7ms
 ✓ src/observability/config.test.ts (24 tests) 10ms
 ✓ src/auth/email.test.ts (12 tests) 9ms
 ✓ src/game/protocol.test.ts (467 tests) 68ms
 ✓ src/game/hub.test.ts (194 tests) 330ms
 ✓ src/auth/password.test.ts (17 tests) 400ms
 ✓ src/cors.test.ts (20 tests) 256ms
 ✓ src/auth/auth-routes.test.ts (28 tests) 838ms
 ✓ src/auth/auth-service.test.ts (50 tests) 1015ms
 ✓ src/db/migration-006.test.ts (13 tests) 2526ms
 ✓ src/app.test.ts (38 tests) 2435ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1107ms
 ✓ src/auth/economy-repository.test.ts (119 tests) 2421ms
 ✓ src/db/migration-007.test.ts (11 tests) 2498ms

 Test Files  37 passed (37)
      Tests  1538 passed (1538)
   Start at  12:36:47
   Duration  3.64s (transform 4.54s, setup 0ms, collect 12.66s, tests 13.52s, environment 8ms, prepare 3.71s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |    96.2 |    89.92 |   99.57 |    96.2 |
 src               |   96.78 |    90.56 |     100 |   96.78 |
  app.ts           |   95.85 |    86.84 |     100 |   95.85 | ...18-319,367-369
  cors.ts          |     100 |      100 |     100 |     100 |
 src/auth          |   95.74 |    83.13 |     100 |   95.74 |
  auth-routes.ts   |    80.7 |    54.19 |     100 |    80.7 | ...61-363,369-370
  auth-service.ts  |     100 |    81.75 |     100 |     100 | ...95,400,417,503
  config.ts        |     100 |      100 |     100 |     100 |
  ...repository.ts |   95.74 |     86.2 |     100 |   95.74 | ...69-770,826-839
  email.ts         |     100 |      100 |     100 |     100 |
  password.ts      |     100 |      100 |     100 |     100 |
  rate-limit.ts    |     100 |      100 |     100 |     100 |
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 | ...40-141,146-147
  ...repository.ts |    98.8 |    90.58 |     100 |    98.8 | 61-62,315
  ...repository.ts |   97.29 |    91.57 |     100 |   97.29 | 63-68
 src/db            |   98.02 |    93.75 |     100 |   98.02 |
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 | 82-83
  ...ate-runner.ts |    97.1 |       96 |     100 |    97.1 | 107-108
  migrate.ts       |     100 |      100 |     100 |     100 |
  pool.ts          |     100 |      100 |     100 |     100 |
 src/game          |   95.65 |    94.36 |   99.03 |   95.65 |
  activity.ts      |     100 |      100 |     100 |     100 |
  broadcast.ts     |   97.12 |    95.65 |     100 |   97.12 | 137-138,231-232
  config.ts        |     100 |      100 |     100 |     100 |
  cubes.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  hub.ts           |   91.12 |    88.69 |   98.48 |   91.12 | ...1723,1774-1777
  leaderboard.ts   |     100 |      100 |     100 |     100 |
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  players.ts       |     100 |      100 |     100 |     100 |
  protocol.ts      |   99.28 |     99.1 |   97.56 |   99.28 | 386-387,987-988
  servers.ts       |   99.01 |    98.71 |     100 |   99.01 | 289-290
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
 src/observability |   99.67 |     96.5 |     100 |   99.67 |
  config.ts        |     100 |      100 |     100 |     100 |
  db-metrics.ts    |     100 |      100 |     100 |     100 |
  logging.ts       |     100 |      100 |     100 |     100 |
  metrics-route.ts |     100 |      100 |     100 |     100 |
  metrics.ts       |   99.45 |    93.54 |     100 |   99.45 | 248-249
  shutdown.ts      |     100 |    92.85 |     100 |     100 | 57
-------------------|---------|----------|---------|---------|-------------------

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/game/parts-v2.test.ts (50 tests) 18ms
 ✓ src/multiplayer/server-state.test.ts (87 tests) 19ms
 ✓ src/render/webgl.test.ts (25 tests) 12ms
 ✓ src/game/board.test.ts (18 tests) 18ms
 ✓ src/render/impact-effects.test.ts (22 tests) 37ms
 ✓ src/render/preview.test.ts (7 tests) 25ms
 ✓ src/render/particles.test.ts (24 tests) 15ms
 ✓ src/multiplayer/protocol.test.ts (554 tests) 76ms
 ✓ src/multiplayer/transport.test.ts (15 tests) 21ms
 ✓ src/ui/Leaderboard.test.tsx (10 tests) 27ms
 ✓ src/render/quality.test.ts (29 tests) 99ms
 ✓ src/ui/icons.test.tsx (18 tests) 23ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 153ms
 ✓ src/render/starfield.test.ts (28 tests) 129ms
 ✓ src/render/picking.test.ts (16 tests) 129ms
 ✓ src/render/cursor-ship.test.ts (34 tests) 155ms
 ✓ src/render/targeting.test.ts (11 tests) 91ms
 ✓ src/render/lootbox-reveal.test.ts (16 tests) 90ms
 ✓ src/input/gestures.test.ts (27 tests) 41ms
 ✓ src/build/vite-config.test.ts (11 tests) 365ms
 ✓ src/game/engine.test.ts (113 tests) 117ms
 ✓ src/render/spaceship.test.ts (40 tests) 141ms
 ✓ src/ws/connection.test.ts (10 tests) 25ms
 ✓ src/auth/api.test.ts (31 tests) 21ms
 ✓ src/render/cube-view.test.ts (37 tests) 356ms
 ✓ src/render/background-life.test.ts (14 tests) 27ms
 ✓ src/auth/store.test.ts (31 tests) 21ms
 ✓ src/input/keyboard.test.ts (13 tests) 13ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 458ms
 ✓ src/game/upgrades.test.ts (20 tests) 12ms
 ✓ src/game/motion.test.ts (14 tests) 8ms
 ✓ src/game/effects.test.ts (30 tests) 16ms
 ✓ src/browser-env.test.ts (7 tests) 12ms
 ✓ src/render/world.test.ts (29 tests) 399ms
 ✓ src/ui/theme.test.ts (17 tests) 16ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 10ms
 ✓ src/render/postprocessing.test.ts (14 tests) 17ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 9ms
 ✓ src/ui/ActivityFeed.test.tsx (8 tests) 21ms
 ✓ src/multiplayer/activity-lifetime.test.ts (18 tests) 13ms
 ✓ src/build/bundle-budget.test.ts (11 tests) 8ms
 ✓ src/perf/overlay.test.ts (4 tests) 6ms
 ✓ src/game/parts.test.ts (23 tests) 14ms
 ✓ src/game/progression.test.ts (21 tests) 16ms
 ✓ src/game/reveal-motion.test.ts (45 tests) 12ms
 ✓ src/ui/hangar-tabs.test.ts (17 tests) 16ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 28ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 294ms
 ✓ src/render/ship-motion.test.ts (24 tests) 11ms
 ✓ src/render/scene-effects.test.ts (9 tests) 416ms
 ✓ src/docs/links.test.ts (1 test) 5ms
 ✓ src/game/rotation.test.ts (15 tests) 11ms
 ✓ src/build/nginx-config.test.ts (6 tests) 6ms
 ✓ src/game/economy.test.ts (7 tests) 5ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 4ms
 ✓ src/render/nebula.test.ts (11 tests) 868ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  682ms
 ✓ src/config.test.ts (20 tests) 11ms
 ✓ src/render/scene-spaceship.test.ts (28 tests) 1138ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel hangar tabs (AC-2, AC-3) > renders one five-tab tablist with the pinned ARIA contract in the normal state
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/LevelCompleteBanner.test.tsx (6 tests) 116ms
 ✓ src/ui/app.css.test.ts (46 tests) 258ms
 ✓ src/ui/GameCanvas.runtime.test.tsx (5 tests) 236ms
 ✓ src/ui/PerfOverlay.test.tsx (5 tests) 159ms
 ✓ src/ui/SpaceshipPreview.test.tsx (12 tests) 116ms
 ✓ src/ui/ConnectionBanner.test.tsx (7 tests) 219ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel hangar tabs (AC-2, AC-3) > renders exactly one tabpanel wrapping only the active group rows
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/Hud.test.tsx (24 tests) 328ms
 ✓ src/ui/DeferredSpaceshipCustomizationPanel.test.tsx (5 tests) 284ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab activation (AC-4) > selects a tab on click in the same commit
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 343ms
 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 292ms
 ✓ src/ui/UserPanel.test.tsx (14 tests) 340ms
 ✓ src/ui/UpgradesPanel.test.tsx (15 tests) 349ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 627ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab activation (AC-4) > moves selection and focus with ArrowRight, ArrowLeft, Home and End, and prevents the default
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab swap (AC-15, AC-16) > mounts a new tabpanel per switch while the strip and the preview stay mounted
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab swap (AC-15, AC-16) > adds no timer and no closing state for a tab switch
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab badges (AC-5) > renders 0/4 for every tab when nothing is owned
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab badges (AC-5) > counts only owned lootable parts, per tab
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab badges (AC-5) > reaches the 4/4 badge maximum when both rare and both epic parts are owned
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/LootboxReveal.test.tsx (39 tests) 593ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab badges (AC-5) > never counts standard parts, zero counts or unknown ids
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab badges (AC-5) > counts a bilateral legacy wing id for both wings after normalization
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab badges (AC-5) > counts the legacy engine id for both ignitions after normalization
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel tab badges (AC-5) > counts a single-slot legacy hull id once after normalization
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel post-reveal landing (AC-6) > opens on frame and resets to frame after a full reveal cycle
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/GameCanvas.test.tsx (7 tests) 271ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel post-reveal landing (AC-6) > lands on the wings tab in one commit with no frame value (AC-6)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel post-reveal landing (AC-6) > lands on frame for a hull grant in that same single mutation (AC-6)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel post-reveal landing (AC-6) > lands on frame for an unknown or invalid part (AC-6)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-21, AC-29) > renders two rows for the active tab and reaches all ten catalog slots through the strip
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-21, AC-29) > renders exactly three variants per row with catalog rarity and a colour swatch
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App > drives data-customization-open from the customization toggle (AC-7, AC-18)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/game-view.css.test.ts (99 tests) 856ms
   ✓ stylesheet integration (AC-18, AC-19, AC-21, AC-27) > cascades the shared frame, the minimized grid and the layer stack onto real markup  391ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-21, AC-29) > shows the slot display name and the equipped part name for every slot
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-21, AC-29) > marks owned parts and exposes equipped/label states on the equip controls
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-21, AC-29) > renders a 44px-capable unequip control per slot, disabled at the standard part
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-21, AC-29) > calls onUnequip with the slot id only for an enabled control
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-21, AC-29) > normalizes legacy direct props into the v2 slot rows
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-21, AC-29) > keeps every panel control at a 44px minimum pointer target (AC-28, AC-31)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel control matrix (AC-10) > exposes 10 equip + 10 unequip controls across the five tabs for the empty inventory
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel control matrix (AC-10) > exposes 30 equip + 10 unequip controls across the five tabs when all parts are owned
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > renders the hangar title, both gf chips and one Open lootbox control
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > keeps the pinned normal-state order: title, counts, open control, tablist, tabpanel, preview
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > renders the accepted normal branch without the reveal (AC-13, AC-21)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > disables Open lootbox when lootboxes are zero
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > disables Open lootbox when keys are zero
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > disables Open lootbox while an account open is pending
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/AuthForms.test.tsx (44 tests) 1049ms
   ✓ AuthForms — interaction > submits the rendered login form and calls onLogin with the entered values  366ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > enables Open lootbox with both counts and no pending open
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > calls onOpenLootbox once when the enabled control is clicked
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-21, AC-29) > keeps the pre-v2 onOpen alias working
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > replaces the whole normal branch with the reveal while a grant is present
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > renders the rare/new reveal region with the pinned attributes and copy
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > renders the epic duplicate copy and the epic rarity channel
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > derives the slot from the catalog and never trusts the wire slot
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > keeps the grant identity on the reveal root, not a section-level mirror (D-1)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > advances through the exact 420 + 250 + 120 + 360 + 140 ms timeline
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > restarts the timeline when the same part is reopened with a new sequence
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > renders the settled reveal instantly under reduced motion without phase timers
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal branch (AC-7, AC-8, AC-13, AC-14, AC-21) > does not mutate the appearance prop while the reveal is mounted (AC-5)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > focuses the reveal Equip control on mount
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > dismisses the reveal through onDismissReveal exactly once
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > dismisses the reveal on Escape exactly once
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > equips the granted part, then dismisses, and flashes the reappearing row
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/render/scene.test.ts (90 tests) 2774ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > restores focus to Open lootbox after an in-panel dismissal
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > restores focus to Open lootbox after Escape
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > dismisses exactly once when the panel unmounts while revealing
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > reopens the normal panel after the unmount dismissal cleared the grant
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > never dismisses on a grant-to-grant replacement, but does once on unmount
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > does not restore focus to the absent Open lootbox on unmount
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal dismissal and focus (AC-8, AC-13) > keeps the reveal mounted with no input for 10 seconds (no auto-dismiss)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel equip-row flash (AC-43) > sets data-equipping on the equipped slot for exactly 260 ms
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel equip-row flash (AC-43) > adds no row flash under reduced motion
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — customization panel integration (AC-29, AC-32, AC-43) > passes pendingLootboxOpen to the panel and disables Open lootbox while pending
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel preview (AC-31) > renders no preview canvas while revealing (one panel canvas at most)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel mode > records the authenticated mode on the section while revealing
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — customization panel integration (AC-29, AC-32, AC-43) > enables Open lootbox when the open is not pending
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — customization panel integration (AC-29, AC-32, AC-43) > passes the last grant into the reveal region and dismisses it through the session
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (66 tests) 1365ms
stderr | src/App.test.tsx > App — customization panel integration (AC-29, AC-32, AC-43) > routes panel equip and unequip controls to the session commands
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > renders the reveal on the opener tab and never on a second tab that only adopted the parts (AC-2)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > renders the reveal on the opener tab and never on a second tab that only adopted the parts (AC-2)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > drops a mid-reveal when the transport leaves connected: the session clears the grant and publishes the snapshot (AC-11)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > drops a mid-reveal when the transport leaves connected: the session clears the grant and publishes the snapshot (AC-11)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > treats a toggle-click close as a dismissal and never restores focus to the absent Open lootbox (AC-13)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > treats a toggle-click close as a dismissal and never restores focus to the absent Open lootbox (AC-13)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > renders one decorative ambience layer and keeps the reveal non-modal (AC-27)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > keeps exactly one polite live region once the customization chunk resolves (AC-31)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > adds no live region while the reveal is mounted (AC-31)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13, AC-27, AC-29, AC-31) > keeps the gameplay headings real h2 elements and the panel aria-labels (AC-29)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/App.test.tsx (62 tests) 1811ms
   ✓ App > toggles the HUD minimized state from the welcomed branch (AC-6, AC-19)  312ms
 ✓ src/game/session.test.ts (132 tests) 4079ms

 Test Files  79 passed (79)
      Tests  2505 passed (2505)
   Start at  12:36:51
   Duration  5.69s (transform 8.81s, setup 0ms, collect 23.41s, tests 22.59s, environment 12.98s, prepare 8.96s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.86 |    96.52 |   98.06 |   96.86 |
 src               |   88.38 |    86.12 |   95.65 |   88.38 |
  App.tsx          |   86.72 |    83.25 |   96.42 |   86.72 | ...35-437,459-460
  browser-env.ts   |   93.65 |      100 |   92.85 |   93.65 | 76-79
  config.ts        |     100 |      100 |     100 |     100 |
 src/auth          |   96.85 |     86.2 |   96.15 |   96.85 |
  api.ts           |   96.44 |     87.5 |     100 |   96.44 | ...61-162,170,222
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193
 src/game          |   96.57 |    99.42 |   99.04 |   96.57 |
  board.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  effects.ts       |     100 |      100 |     100 |     100 |
  engine.ts        |   99.47 |      100 |     100 |   99.47 | 958-959,1250-1251
  motion.ts        |     100 |      100 |     100 |     100 |
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  progression.ts   |     100 |      100 |     100 |     100 |
  reveal-motion.ts |     100 |      100 |     100 |     100 |
  rotation.ts      |     100 |      100 |     100 |     100 |
  session.ts       |   91.31 |    98.84 |   97.43 |   91.31 | ...1684,1819-1820
  types.ts         |     100 |      100 |     100 |     100 |
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
 src/input         |     100 |      100 |     100 |     100 |
  gestures.ts      |     100 |      100 |     100 |     100 |
  keyboard.ts      |     100 |      100 |     100 |     100 |
 src/multiplayer   |   94.88 |    97.35 |   96.87 |   94.88 |
  ...y-lifetime.ts |     100 |      100 |     100 |     100 |
  protocol.ts      |   91.85 |    97.15 |   92.85 |   91.85 | ...1575,1579-1589
  server-state.ts  |   97.79 |    95.67 |     100 |   97.79 | ...88,390-391,454
  spectate.ts      |     100 |      100 |     100 |     100 |
  transport.ts     |   99.49 |      100 |     100 |   99.49 | 200
 src/perf          |     100 |      100 |     100 |     100 |
  overlay.ts       |     100 |      100 |     100 |     100 |
 src/render        |   98.63 |    98.98 |   98.82 |   98.63 |
  ...round-life.ts |     100 |      100 |     100 |     100 |
  ...c-backdrop.ts |      99 |      100 |     100 |      99 | 299-300
  cube-view.ts     |   99.24 |      100 |     100 |   99.24 | 336-337
  cursor-ship.ts   |   99.54 |    97.61 |     100 |   99.54 | 208-209
  ...ct-effects.ts |   98.64 |      100 |     100 |   98.64 | ...49-350,474-475
  ...box-reveal.ts |     100 |      100 |     100 |     100 |
  nebula.ts        |     100 |      100 |     100 |     100 |
  particles.ts     |     100 |      100 |     100 |     100 |
  picking.ts       |     100 |      100 |     100 |     100 |
  ...processing.ts |     100 |      100 |     100 |     100 |
  preview.ts       |     100 |      100 |     100 |     100 |
  quality.ts       |   98.31 |      100 |     100 |   98.31 | 316-317,400-401
  scene.ts         |   97.26 |    99.39 |   95.34 |   97.26 | ...1076,1084-1085
  ship-motion.ts   |     100 |      100 |     100 |     100 |
  ...ship-model.ts |     100 |      100 |     100 |     100 |
  spaceship.ts     |   96.16 |      100 |   97.05 |   96.16 | ...63-664,690-693
  ...ate-travel.ts |     100 |      100 |     100 |     100 |
  starfield.ts     |     100 |      100 |     100 |     100 |
  targeting.ts     |   95.78 |      100 |     100 |   95.78 | ...64-166,178-179
  webgl.ts         |     100 |      100 |     100 |     100 |
  world.ts         |   98.46 |       92 |     100 |   98.46 | 231-234,453
 src/ui            |   97.55 |    95.21 |   97.11 |   97.55 |
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
  ...boxReveal.tsx |   98.24 |    94.89 |     100 |   98.24 | 152-153,273-274
  PerfOverlay.tsx  |   98.52 |      100 |     100 |   98.52 | 84
  ...tionPanel.tsx |   97.06 |       92 |     100 |   97.06 | ...28-329,335-336
  ...ipPreview.tsx |    87.2 |    77.41 |      75 |    87.2 | ...24-125,130-131
  ...adesPanel.tsx |    97.1 |    91.89 |     100 |    97.1 | 84-85,103-104
  UserPanel.tsx    |     100 |      100 |     100 |     100 |
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |
  hangar-tabs.ts   |     100 |      100 |     100 |     100 |
  icons.tsx        |     100 |      100 |     100 |     100 |
  theme.ts         |     100 |      100 |     100 |     100 |
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100
-------------------|---------|----------|---------|---------|-------------------
COVERAGE_EXIT=0
=== npm run build ===

> build
> npm run build --workspaces --if-present


> build
> tsc


> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
transforming...
✓ 114 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.49 kB │ gzip:   0.30 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-BpDQzfgT.css                        44.24 kB │ gzip:   8.06 kB
dist/assets/cursor-ship-B5FCETDh.js                    6.73 kB │ gzip:   2.21 kB
dist/assets/SpaceshipCustomizationPanel-6AKSL-yz.js   18.01 kB │ gzip:   6.38 kB
dist/assets/browser-env-CCnWcNPn.js                   49.34 kB │ gzip:  18.21 kB
dist/assets/index-QB8amDhR.js                        101.64 kB │ gzip:  31.01 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-4kUmpljF.js                        610.31 kB │ gzip: 154.62 kB
✓ built in 1.45s
entry index assets/index-QB8amDhR.js raw=101641 gzip=31014
initial files=2 raw=323340 gzip=99970 budget=150000
three assets/three-4kUmpljF.js raw=610310 gzip=154617 budget=165000
total files=6 raw=1007729 gzip=281381 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-6AKSL-yz.js raw=18006 gzip=6378 initial=false
chunk browser-env assets/browser-env-CCnWcNPn.js raw=49344 gzip=18205 initial=false
chunk cursor-ship assets/cursor-ship-B5FCETDh.js raw=6729 gzip=2211 initial=false
chunk index assets/index-QB8amDhR.js raw=101641 gzip=31014 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-4kUmpljF.js raw=610310 gzip=154617 initial=false

Bundle budget OK.
BUILD_EXIT=0
```

### 2. Containerized smoke at HEAD `e8eff72`

`command -v podman` → `/usr/bin/podman`; `podman --version` → `podman version 6.1.3`; the
compose provider is Docker Compose v5.6.0 (`podman compose version`). Smoke therefore ran
rather than being recorded as `not applicable`.

```text

> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

[4m>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

[0m Container cubeclicker-frontend-prod-1 Creating
 Container cubeclicker-frontend-prod-1 Created
 Container cubeclicker-db-1 Starting
 Container cubeclicker-mailpit-1 Starting
 Container cubeclicker-frontend-1 Starting
 Container cubeclicker-frontend-prod-1 Starting
 Container cubeclicker-db-1 Started
 Container cubeclicker-db-1 Waiting
 Container cubeclicker-mailpit-1 Started
 Container cubeclicker-frontend-1 Started
 Container cubeclicker-frontend-prod-1 Started
 Container cubeclicker-db-1 Healthy
 Container cubeclicker-backend-1 Starting
 Container cubeclicker-backend-1 Started
 Container cubeclicker-smoke-run-810560d00841 Creating
 Container cubeclicker-smoke-run-810560d00841 Created
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
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1003ms
PASS activity leave: A receives the memberLeft activity event with B's name and an id newer than the snapshot id — memberLeft id 2 for p2
PASS multiplayer explicit leave: D's leave yields memberLeft(left) on A in under 900ms without the grace window — memberLeft(left) received after 0ms
PASS multiplayer slot reuse: E fills D's freed slot 2 with welcome.roster exactly [A, E] — server 1; roster [A, E] in D's freed slot 2
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=9 cubeclicker_ws_messages_received_total{type="join"}=7 cubeclicker_ws_frames_sent_total{type="hello"}=9
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-6XwuB9OH.js is served gzip with immutable caching — content-encoding gzip; 101707 B decompressed
PASS prod /assets/three-4kUmpljF.js is served gzip with immutable caching — content-encoding gzip; 610310 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (28/28 checks)
SMOKE_EXIT=0
```

### 3. Bundle bytes and deferred-chunk membership

`dist/bundle-report.json` after the fresh build (exact file):

```json
{
  "version": 1,
  "budgets": {
    "initialGzipBytes": 150000,
    "threeGzipBytes": 165000,
    "totalGzipBytes": 300000
  },
  "entry": {
    "name": "index",
    "file": "assets/index-QB8amDhR.js",
    "gzipBytes": 31014,
    "rawBytes": 101641
  },
  "initial": {
    "files": [
      "assets/index-QB8amDhR.js",
      "assets/react-BYqCGoBQ.js"
    ],
    "gzipBytes": 99970,
    "rawBytes": 323340
  },
  "three": {
    "file": "assets/three-4kUmpljF.js",
    "name": "three",
    "initial": false,
    "gzipBytes": 154617,
    "rawBytes": 610310
  },
  "total": {
    "files": [
      "assets/cursor-ship-B5FCETDh.js",
      "assets/react-BYqCGoBQ.js",
      "assets/three-4kUmpljF.js",
      "assets/index-QB8amDhR.js",
      "assets/browser-env-CCnWcNPn.js",
      "assets/SpaceshipCustomizationPanel-6AKSL-yz.js"
    ],
    "gzipBytes": 281381,
    "rawBytes": 1007729
  },
  "chunks": [
    {
      "name": "SpaceshipCustomizationPanel",
      "file": "assets/SpaceshipCustomizationPanel-6AKSL-yz.js",
      "initial": false,
      "gzipBytes": 6378,
      "rawBytes": 18006
    },
    {
      "name": "browser-env",
      "file": "assets/browser-env-CCnWcNPn.js",
      "initial": false,
      "gzipBytes": 18205,
      "rawBytes": 49344
    },
    {
      "name": "cursor-ship",
      "file": "assets/cursor-ship-B5FCETDh.js",
      "initial": false,
      "gzipBytes": 2211,
      "rawBytes": 6729
    },
    {
      "name": "index",
      "file": "assets/index-QB8amDhR.js",
      "initial": true,
      "gzipBytes": 31014,
      "rawBytes": 101641
    },
    {
      "name": "react",
      "file": "assets/react-BYqCGoBQ.js",
      "initial": true,
      "gzipBytes": 68956,
      "rawBytes": 221699
    },
    {
      "name": "three",
      "file": "assets/three-4kUmpljF.js",
      "initial": false,
      "gzipBytes": 154617,
      "rawBytes": 610310
    }
  ]
}
```

Against the approved ceilings:

| Budget | Measured | Ceiling | Result |
| --- | --- | --- | --- |
| `initial` | **99,970 B gzip** (323,340 B raw, 2 files) | 150,000 B | inside |
| `three` | **154,617 B gzip** (610,310 B raw) | 165,000 B | inside |
| `total` | **281,381 B gzip** (1,007,729 B raw, 6 files) | 300,000 B | inside |
| entry chunk | 31,014 B gzip (101,641 B raw) | — | recorded |

`initial.files` is exactly `assets/index-QB8amDhR.js` + `assets/react-BYqCGoBQ.js` (the
entry and React chunks); it excludes both the `three` chunk and the panel chunk.

Manifest membership (`dist/.vite/manifest.json`): `index.html` has
`dynamicImports: ["src/browser-env.ts", "src/ui/SpaceshipCustomizationPanel.tsx"]`, and
`src/ui/SpaceshipCustomizationPanel.tsx` resolves to
`assets/SpaceshipCustomizationPanel-6AKSL-yz.js` with `isDynamicEntry: true`. The entry's
static closure is only `assets/react-BYqCGoBQ.js`.

String-level membership proof (`grep -cF`, count of matching lines):

```text
-- dist/assets/index-QB8amDhR.js   (entry / initial)
customization-tabpanel: 0
customization-tabs: 0
Spaceship hangar: 0
parts owned: 0
tablist: 0
-- dist/assets/react-BYqCGoBQ.js   (React / initial)
customization-tabpanel: 0
customization-tabs: 0
Spaceship hangar: 0
parts owned: 0
tablist: 0
-- dist/assets/SpaceshipCustomizationPanel-6AKSL-yz.js   (deferred)
customization-tabpanel: 1
customization-tabs: 1
Spaceship hangar: 1
parts owned: 1
tablist: 1
```

So `ui/hangar-tabs.ts` and the tab markup live only in the deferred
`SpaceshipCustomizationPanel-<hash>.js` chunk and are absent from the entry closure
(AC-23). No stylesheet line added by this feature contains `url(http`, `@font-face`,
`data:image`, `@import` or `<img` (sweep below), and no package or build/test config file
changed:

```text
$ git diff e613eb4...HEAD -- src/frontend/src/ui/game-view.css | grep -E '^\+.*(url\(http|@font-face|data:image|@import|<img)'
(none)
$ git diff --numstat e613eb4...HEAD -- package.json package-lock.json src/frontend/package.json src/backend/package.json
(empty)
$ git diff --stat e613eb4...HEAD -- ':(glob)**/vitest.config.*' ':(glob)**/vite.config.*'
(empty)
```

### 4. Protected-file, scope and whitespace gates

Run at HEAD before the docs pass (only the orchestrator's `status.md`/`tasks.md` board
edits were present, inside this feature's directory):

```text
$ BASE=$(git merge-base main HEAD); echo "$BASE"
e613eb4cb9468b60b3ea6b65240548fc324f7bf3
$ git diff --exit-code "$BASE"...HEAD -- src/backend compose.yaml compose.smoke.yaml ':(glob)**/Dockerfile' package.json package-lock.json src/frontend/package.json src/backend/package.json src/frontend/src/multiplayer src/frontend/src/ui/app.css src/frontend/src/ui/app.css.test.ts src/frontend/src/App.tsx
PROTECTED_DIFF_EXIT=0
$ test -z "$(git status --porcelain -- src/backend compose.yaml compose.smoke.yaml ':(glob)**/Dockerfile' package.json package-lock.json src/frontend/package.json src/backend/package.json src/frontend/src/multiplayer src/frontend/src/ui/app.css src/frontend/src/ui/app.css.test.ts src/frontend/src/App.tsx src/frontend/src/render src/frontend/src/game/engine.ts src/frontend/src/main.tsx)"
PROTECTED_STATUS_EXIT=0
$ test -z "$(git status --porcelain -- docs/features ':(exclude)docs/features/hangar-tabs-and-menu-motion')"
OTHER_DOCS_STATUS_EXIT=0
$ test -z "$(git status --porcelain -- docs/features/README.md)"
FEATURES_README_EXIT=0
$ git diff --check
DIFFCHECK_EXIT=0
```

Re-run after the three documentation edits (same exits; `git diff --check` also verifies
the new prose/table whitespace):

```text
DIFFCHECK_EXIT=0
OTHER_DOCS_STATUS_EXIT=0
FEATURES_README_EXIT=0
PROTECTED_STATUS_EXIT=0
PROTECTED_DIFF_EXIT=0
```

`src/frontend/src/App.test.tsx` is T3-owned after r2a; its full diff against `BASE`
contains exactly the two approved hunks and nothing else:

```diff
@@ -1667,8 +1667,11 @@ describe('App — customization panel integration (AC-29, AC-32, AC-43)', () =>
-    fireEvent.click(await screen.findByRole('button', { name: 'Equip Port Silver Wing' }));
+    // The Wings row is only mounted on its tab, so activate it before the equip click; the
+    // Unequip Hull control stays on the default Frame tab.
     fireEvent.click(await screen.findByRole('button', { name: 'Unequip Hull' }));
+    fireEvent.click(await screen.findByRole('tab', { name: 'Wings, 1 of 4 parts owned' }));
+    fireEvent.click(await screen.findByRole('button', { name: 'Equip Port Silver Wing' }));
@@ -1754,7 +1757,8 @@ describe('App — reveal ownership and shell accessibility (AC-2, AC-11, AC-13,
-    expect(document.querySelectorAll('.customization-panel .customization-variant')).toHaveLength(30);
+    // The tabbed panel mounts only the default tab's two rows: 2 rows x 3 variants.
+    expect(document.querySelectorAll('.customization-panel .customization-variant')).toHaveLength(6);
```

`src/frontend/src/App.tsx` itself is byte-identical to `BASE`
(`PROTECTED_DIFF_EXIT=0` includes it), so the session reduced-motion hook is the
pre-existing base behaviour (AC-17's App half, verified read-only).

### 5. Real-time / container impact (AC-27, AC-28)

AC-27: the compose files, both Dockerfiles and `GET /ws` are unchanged — covered by
`PROTECTED_DIFF_EXIT=0` / `PROTECTED_STATUS_EXIT=0` above; no service, port, host
mapping, environment variable or health signal was added (the feature diff touches only
frontend TS/CSS/tests and feature docs).

AC-28: `git diff --exit-code "$BASE"...HEAD -- src/backend src/frontend/src/multiplayer`
exits `0` (included in the protected diff gate), and the unchanged protocol/session
suites still pass:

```text
$ (cd src/backend && npx vitest run src/game/hub.test.ts --reporter=basic)
 ✓ src/game/hub.test.ts (194 tests) 164ms

 Test Files  1 passed (1)
      Tests  194 passed (194)
$ (cd src/frontend && npx vitest run src/game/session.test.ts src/multiplayer/server-state.test.ts --reporter=basic)
 ✓ src/game/session.test.ts (132 tests) 1367ms

 Test Files  2 passed (2)
      Tests  219 passed (219)
```

### 6. Documentation pass and AC-26 greps

- `README.md` — the **Spaceship Customization** paragraph now describes a **tabbed
  spaceship hangar** (five part-group tabs splitting the ten part slots two per tab, the
  per-tab `n/4` owned count, the post-reveal landing), and the game-view paragraph adds
  the CSS-only **glitch boot animation** (320 ms flicker + scan + rail + chroma) and the
  140 ms tab fade, open-only and stopped by reduced motion. The accepted phrases
  `granular spaceship parts`, `detailed blue/orange hero spaceship`, `animated 3D lootbox
  reveal` and `Neon Forge HUD` are untouched; the feature reference list now includes
  `hangar-tabs-and-menu-motion`.
- `docs/architecture/frontend-rendering.md` — new `## Menu motion` section: the two
  animated surfaces, all five keyframes with their pinned stops, the
  `menuBootMs`/`menuFlickerMs`/`menuChromaMs`/`tabSwitchMs` tokens and their
  `--motion-*` mirrors (`--motion-menu-boot-ms`, `--motion-menu-flicker-ms`,
  `--motion-menu-chroma-ms`, `--motion-tab-switch-ms`), 320 ms boot, 140 ms tab swap,
  open-only/no-close, no-`transform`/`filter`/`clip-path`, both reduced-motion variants
  with the specificity scoping and source-order rule, and the tab structure
  (`role="tablist"`, five groups, one panel, no `aria-controls`). `## Game shell layering`
  is unchanged (no layering line added or removed in the diff).
- `docs/product/glossary.md` — new `### hangar tab` entry (UI grouping, not a domain term;
  five groups over the ten `part slot`s; ephemeral panel state) and `### motion token`
  updated to **21** CSS-mapped durations with the four new tokens named and mirrored.
- `docs/features/README.md` is untouched; the proposed row is at the end of this log.

Exact AC-26 greps:

```text
README.md :: tabbed spaceship hangar -> 1
README.md :: glitch boot animation -> 1
README.md :: granular spaceship parts -> 1
README.md :: detailed blue/orange hero spaceship -> 1
README.md :: animated 3D lootbox reveal -> 1
README.md :: Neon Forge HUD -> 1
docs/architecture/frontend-rendering.md :: ## Menu motion -> 1
docs/architecture/frontend-rendering.md :: menu-boot -> 3
docs/architecture/frontend-rendering.md :: tab-panel-in -> 2
docs/architecture/frontend-rendering.md :: tabSwitchMs -> 1
docs/product/glossary.md :: ### hangar tab -> 1
docs/product/glossary.md :: ### motion token -> 1
```

The docs diff is minimal (`3 files changed, 27 insertions(+), 3 deletions(-)`) and every
relative link added or reused resolves to an existing file
(`game-view.css` under `src/frontend/src/ui/`, `docs/features/hangar-tabs-and-menu-motion/`).

## Manual matrix and traces — **not executable in this environment**

This host is headless: there is no GUI browser, no display server and no real GPU frame
timeline, and the project's non-goals forbid browser-automation/visual-regression tooling.
The following rows were therefore **not run** and are **not claimed as passed**. The user
accepted this real-browser visual/motion pass and explicitly waived the AC-24 trace row on
2026-11-17 (§ AC-24 trace waiver); the rows remain not executed and no result is claimed
(start `podman compose up`, open http://localhost:5173).

| Manual row | What is already code/test-pinned at HEAD | Still to observe on a GUI host |
| --- | --- | --- |
| Five tabs, two rows each, labels and `n/4` badges | AC-2/AC-3/AC-5 suites (SSR + jsdom, exact attrs/text/counts) | Visual rendering of all five groups |
| `IGNITIONS` label/badge unclipped at 375×667 and 320×568 | CSS guards: 44 px chip, `nowrap`, auto-fit `minmax(5rem, 1fr)`, 320 px three-track arithmetic | Actual clipping/overflow at both widths |
| Tab strip sticky while the panel scrolls | CSS guard (`position: sticky; top: 0; z-index: 1`) | Behaviour in the real scroll container |
| `scrollHeight`/`clientHeight` at 1920×1000 (no scroll) and 1280×720 (≤ 140 px) | Preview heights + panel `max-height` guards only; jsdom has no layout | Measured numbers at both sizes |
| No horizontal overflow; no nested scrollbar | Single-scroll-container and no-`overflow` tabpanel guards | Visual check |
| Themed scrollbars in hangar/upgrades/crew list | AC-19 CSS guards (thin + `::-webkit-*` values) | Rendered scrollbars in Chromium/Firefox |
| Crew pill glass + warm count badge | AC-20 guards + computed-style test (44 px, 999 px, white text) | Visual check |
| Compact HUD minimize `▴` | AC-21 CSS guards (24 px chevron, `content: '▴'`) | Visual check |
| Boot captured at ~40/120/240 ms for hangar and crew | Keyframe/stop and rule guards (AC-12/AC-13); jsdom cannot animate | Frame captures at the three timestamps |
| Open → close → open replays the boot | Crew remount test + keyed tabpanel/no-timer tests | Visual replay confirmation |
| No motion on HUD/upgrades/feed/leaderboard/banner/auth | AC-14 positive/negative selector sweep | Visual check |
| Keyboard pass (toggle → `Open lootbox` → arrows/Home/End) with visible focus and no panel scroll | AC-4 jsdom tests (`defaultPrevented`, unchanged `scrollTop`, focus follows selection) | Real-browser focus ring/scroll check |
| Reveal non-modal, toggle clickable, no `reveal-spotlight` under the OS reduced-motion preference | AC-17 specificity/order guards + reveal tests | OS preference on/off visual check |
| Reduced motion on/off; session attribute flips to `true` and the boot stops | Both selector-list guards + `App.test.tsx` `<main data-reduced-motion>` assertions | End-to-end preference check |
| AC-24 traces: 10 s idle + 10 clicks/s, three clean runs per size, fresh load, median named, at least two of three pass, `average ≤ 16.7 ms`, `p95 ≤ 33 ms`, hangar open on the default tab at 1280×720 and 1920×1080 | No new `requestAnimationFrame`/`WebGLRenderer`/quality-tier code (diff sweep), CSS-only boot, one preview context (T3 tests) | The trace protocol itself |

The automated half of AC-24 is proven statically — no added line in the non-test frontend
sources introduces `requestAnimationFrame`, `WebGLRenderer`, `setPixelRatio`, `setQuality`
or `new THREE.`:

```text
$ git diff e613eb4...HEAD -- 'src/frontend/src/**/*.ts' 'src/frontend/src/**/*.tsx' ':(exclude)**/*.test.ts' ':(exclude)**/*.test.tsx' | grep -E '^\+.*(requestAnimationFrame|WebGLRenderer|setPixelRatio|setQuality|new THREE\.)'
(no added rAF/WebGLRenderer/quality lines in non-test frontend sources)
```

## Acceptance audit

- **AC-23 — met.** `package.json`/`package-lock.json`/both workspace manifests show no
  diff and an empty status; lint/typecheck/test/coverage/build all exit `0`; the fresh
  build measures `initial 99,970 B ≤ 150,000`, `three 154,617 B ≤ 165,000`,
  `total 281,381 B ≤ 300,000`; `initial.files` is only the entry + React chunks (no
  `three`, no panel); `SpaceshipCustomizationPanel-6AKSL-yz.js` is a manifest
  `dynamicImports` target with `isDynamicEntry: true`; the tab strings occur only in that
  deferred chunk. No stylesheet asset literal, dependency, script or loader was added.
- **AC-24 — met under the recorded user waiver (trace protocol not executable here).** No
  new rAF loop, `WebGLRenderer`, light, post-processing parameter or quality-tier change
  (diff sweep above); the boot is CSS-only (AC-12/AC-15 guards) and the panel keeps one
  preview context (T3 tests). The 10 s idle / 10 clicks/s trace matrix at 1280×720 and
  1920×1080 was **not executable in this headless environment** and was never run; the user
  explicitly waived it on 2026-11-17 (§ AC-24 trace waiver), and no trace table is claimed
  as passed.
- **AC-25 — met.** `npm run coverage` exits `0`: backend `96.2 / 89.92 / 99.57 / 96.2`,
  frontend `96.86 / 96.52 / 98.06 / 96.86` (statements / branches / functions / lines), all
  ≥ 80; `hangar-tabs.ts` is 100% in the frontend table and the updated panel is included;
  no vitest config, exclusion or threshold changed.
- **AC-26 — met.** The three docs above contain the required sections, phrases, keyframes,
  tokens, mirrors, durations, open-only/no-close rule, no-`transform` rule, both
  reduced-motion variants with specificity scoping, and the tab structure; the four
  accepted README phrases remain; `## Game shell layering` is unchanged;
  `docs/features/README.md` is untouched and the whole `docs/features` tree outside this
  feature is clean (`OTHER_DOCS_STATUS_EXIT=0`). Exact greps recorded in § 6.
- **AC-27 — met.** No container asset, service, image, port, host mapping, environment
  variable or health signal changed: the protected diff/status gates over `compose.yaml`,
  `compose.smoke.yaml` and both Dockerfiles exit `0`, and `GET /ws` lives in the untouched
  backend. The frontend image absorbs the TS/CSS diff through its existing Vite build and
  bundle gate.
- **AC-28 — met.** No protocol, server, persistence or data-flow change: the backend and
  `src/frontend/src/multiplayer` diff gate exits `0`; `hub.test.ts` (194), `session.test.ts`
  (132) and `server-state.test.ts` (87) pass unchanged; the root suites are green; the tab,
  badge and boot state are client-local presentation derived from state the client already
  holds.
- **AC-29 — met (executable scope).** `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run coverage`, `npm run build` and `npm run smoke` all exit `0`; the protected-file
  diff/status gates are clean for `src/backend`, `src/frontend/src/multiplayer`,
  `src/frontend/src/render`, `src/frontend/src/game/engine.ts`,
  `src/frontend/src/main.tsx`, `src/frontend/src/ui/app.css`,
  `src/frontend/src/ui/app.css.test.ts` and `src/frontend/src/App.tsx`; every
  `docs/features/**` path outside this feature is clean and `docs/features/README.md` is
  untouched; `App.test.tsx` differs only in the two T3-owned r2a hunks. All other ACs
  (AC-1…AC-22) are re-verified by the full root suites re-run at HEAD (frontend 2,505
  tests, backend 1,538 tests), and AC-17's App half is verified read-only as pre-existing
  base behaviour.

## Proposed `docs/features/README.md` row (orchestrator-owned — not applied here)

Add after the `game-feel-overhaul` row:

```markdown
| hangar-tabs-and-menu-motion | Hangar Tabs & Menu Motion (5 hangar tab groups, CSS menu boot animation, screenshot polish) | building | 2026-11-17 |
```

Final state for the orchestrator is whatever the review/acceptance flow sets; the row above
is the spec's proposed text.

## Deviations from spec

- None in the implemented/documentation scope. The only non-executed items are the
  environment-blocked manual matrix and AC-24 traces, recorded above as not executed and
  not claimed as passed; the user's explicit AC-24 waiver and acceptance of the
  visual/motion pass are recorded in the next section.

## AC-24 trace waiver (2026-11-17)

The user explicitly **waived** the AC-24 10 s idle + 10 clicks/s trace protocol at
1280×720 and 1920×1080 for `hangar-tabs-and-menu-motion`, because the build environment is
headless (no GUI browser, display server or real GPU frame timeline, and browser
automation/visual-regression tooling is a spec non-goal).

Under that waiver the user accepted:

- the real-browser visual/motion pass as recorded evidence (it was not executed here and is
  not claimed as passed), and
- the structural/bundle evidence for AC-24: no new `requestAnimationFrame` loop,
  `WebGLRenderer`, light, post-processing parameter or quality-tier change (diff sweep
  above), the CSS-only boot with no per-frame JavaScript, the single preview context
  (T3 tests), the deferred `SpaceshipCustomizationPanel-<hash>.js` chunk, and the bundle
  bytes (`initial 99,970 B`, `three 154,617 B`, `total 281,381 B`).

No trace table is claimed as passed. The AC-24 audit line reads "met under the recorded
user waiver" while retaining the "not executable" note. The waiver applies to this feature
on branch `feat/hangar-tabs-and-menu-motion` at HEAD `1dd73db` (the T5 documentation
commit); it is recorded in this follow-up documentation commit.
