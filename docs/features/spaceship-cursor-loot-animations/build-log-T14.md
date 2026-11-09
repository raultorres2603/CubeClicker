# Build log — T14 — Verify & integrate

Task: T14 (2026-11-09; final re-run after T15 `0bfc524` and T16 `ba77801`)
Feature: `spaceship-cursor-loot-animations` (spec r4, plan r4, tasks r4)
Files changed:
- `docs/features/spaceship-cursor-loot-animations/build-log-T14.md` (this file)
- `docs/features/spaceship-cursor-loot-animations/evidence/t14-*.png` (96 screenshots; 75 MB)

What changed & why: T14 is verification-only. No source, test, CSS, config, container, backend or dependency edit was made. This log records the full gate, the final manual matrix, reduced-motion A/B, high/medium/low frame traces with forced recovery, the reference gate, documentation/container evidence, and the AC-41 reveal-layout verification. The first run found the reveal card clipped (blocking); T15 `0bfc524` fixed it. The first run's AC-40 fly-by frame was harness-driven; T16 `ba77801` wired the fly-by to the production level-completion signal, and this final re-run records the production roll/trail/return measurements and the final green gate.

## BASE and HEAD

```text
$ git rev-parse HEAD                     # verified tree: T16 fix
ba77801216aeedd9903d6e7f5222d1b7d9780b36

$ git rev-parse 0bfc524                  # T15 fix: reveal layout
0bfc524beab8f6eb618958a93c9cd19b23778f56

$ git rev-parse 8d4c633                  # prior T14 evidence commit
8d4c6334c8e4a0201d334072f7258ecb3bd42ec7

$ git rev-parse 2c2efcb^                 # pre-feature fork point, parent of T1 commit 2c2efcb
f07d06717b174dc189838d62990a52c925763772

$ git log --oneline -1 2c2efcb
2c2efcb feat: add granular spaceship catalog v2
```

- Feature `BASE = f07d06717b174dc189838d62990a52c925763772` (`features & specs`, parent of T1 `2c2efcb`); the container/diff gates compare against it.
- Verification tree `HEAD = ba77801216aeedd9903d6e7f5222d1b7d9780b36` (`fix: trigger ship fly-by on level completion`): every gate command recorded below ran on this tree. This docs-only T14 evidence commit follows the verified tree; it changes no source.
- `T15 = 0bfc524beab8f6eb618958a93c9cd19b23778f56` fixed AC-41 (reveal layout); `T16 = ba77801216aeedd9903d6e7f5222d1b7d9780b36` fixed AC-40 by starting the fly-by on the production `levelIndex` rise (see `build-log-T16.md`).
- The first T14 run ran on `512c01b55b13b2c8dcd54b8da37cf940bfae9f6c` (before T15/T16); its reveal clipping is retained as historical before/after evidence.
- Branch: `main`. The working tree contains pre-existing orchestrator/planner modifications to `spec.md`, `plan.md`, `tasks.md`, `status.md`, `video-analysis.md` and the untracked `reviews/` directory; they are not staged and are not part of this commit.

Environment: Node v24.22.0 / npm 11.19.1; Podman 5.8.9 with docker-compose 5.6.0; `podman compose up -d` stack (frontend `localhost:5173`, backend `localhost:8080`, Postgres, Mailpit, Adminer); headless Google Chrome 157.0.8103.38 over CDP with hardware ANGLE (`ANGLE (NVIDIA, Vulkan 1.4.351, NVIDIA GeForce RTX 5070 Laptop GPU)`). The browser harness lives in `/tmp/opencode/t14/` and injects a **test-only** `window.__t14Scene` reference by patching the dev-server `src/render/scene.ts` response (it inserts `window.__t14Scene = view;` before `return view;`). No repository file was changed by the harness.

## Gate summary

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm run lint` | **PASS** exit 0 | raw log below |
| `npm run typecheck` | **PASS** exit 0 (both workspaces) | raw log below |
| `npm test` | **PASS** backend 868 / frontend 1,700 tests | raw log below |
| `npm run coverage` | **PASS** backend 95.43/87.71/99.7/95.43; frontend 96.34/95.3/97.43/96.34 | raw log below |
| `npm run build` | **PASS** exit 0; initial JS **273.23 KB gzip** (≤ 350); CSS 5.24 KB gzip | raw log below |
| `npm run smoke` | **PASS 12/12** container checks | raw log below |
| Container diff gate | **PASS** empty | compose/Dockerfiles/server/manifests/lockfile unchanged vs `BASE` |
| Protected paths | **PASS** no working-tree change | `git status` guarded paths empty |
| Bundle/import gate | **PASS** no loaders/fetch/http(s); named three imports only | commands below |
| High-tier frame bar | **PASS** 3/3 runs at both sizes/workloads, avg 16.666 ms, p95 ≤ 16.8 ms | performance tables below |
| Forced recovery | **PASS** low→medium→high at both sizes | recovery tables below |
| Reference gate AC-46 | **PASS** 40 frames + 3 contact sheets + observed/extrapolated mapping | reference table below |
| **Manual reveal layout (AC-41)** | **PASS after T15 `0bfc524`** (was FAIL in the first run) | before/after values below |
| **Production AC-40 fly-by** | **PASS after T16 `ba77801`** | one 700 ms roll, 16-point trail at high, return to follow, no reduced roll — production evidence below |

## AC-41 before/after — fixed by T15 `0bfc524`

The first T14 run (at `512c01b`) found the reveal card **visually clipped** and reported AC-41 blocked. T15 commit `0bfc524` (`fix: keep lootbox reveal fully visible`) changed the T12-owned CSS: `.lootbox-reveal` now has `flex: 0 0 auto`, `min-height: 18rem`, `overflow: visible`; `.lootbox-orb` and `.lootbox-reveal-card` are `flex: none`/`flex: 0 0 auto` with a 5rem minimum orb; `SpaceshipCustomizationPanel.test.tsx` gained layout regression tests (`game-view.css.test.ts` too), and the full frontend suite is now 1,700 tests.

**Before (`512c01b`, first T14 run):**

```text
1280x720:  .lootbox-reveal height = 18 px; .lootbox-orb height = 0 px;
           .lootbox-reveal-card height = 198.1 px but clipped; panel clientHeight 428, scrollHeight 2025
1920x1080: .lootbox-reveal height = 18 px; .lootbox-orb height = 0 px;
           .lootbox-reveal-card height = 198.1 px but clipped; panel clientHeight 644, scrollHeight 2025
Cause: shrinkable overflow:hidden flex child of the max-height:60vh panel.
Screenshots: evidence/t14-reveal-layout-700ms-1280x720.png,
             evidence/t14-reveal-layout-700ms-1920x1080.png,
             evidence/t14-reveal-clipped-1280x720.png,
             evidence/t14-reveal-clipped-1920x1080.png.
```

**After (`0bfc524`, this re-run):**

```text
1280x720:  .lootbox-reveal height = 306 px; .lootbox-orb height = 80 px at charge / 100 px overshoot;
           .lootbox-reveal-card height = 198.1 px (183.4 px at rest), card bottom 606–613 px;
           panel top 224, clientHeight 428 (bottom 652) → the full reveal and card are visible at scrollTop 0.
           panel scrollHeight 2313 (the slots/preview scroll below the full-height reveal).
           phase transitions: charge 9 ms → orb 431 → flash 690 → reveal 808 → settle 1162 → rest 1310 ms
           (5 ms poll + screenshot latency; pinned boundaries 420/670/790/1150/1290; total 1290 in CSS/tests).
1920x1080: .lootbox-reveal height = 306 px; .lootbox-orb height 80/100 px;
           card 198.1/183.4 px, card bottom 750 px; panel top 368, clientHeight 644 → fully visible.
           phase transitions: 7 → 435 → 680 → 810 → 1160 → 1300 ms.
Copy/ARIA unchanged: role="status", aria-live="polite", data-part-id/slot/rarity/duplicate, part/slot names,
           Rare, New, Equip <part> label, Dismiss label.
Reduced motion: phase reaches "rest" at 13 ms (instant), reveal 306 px, orb 80 px, card 183 px,
           data-reduced-motion="true", animation none on reveal/orb/card; copy/ARIA identical.
Screenshots: evidence/t14-reveal-fixed-*.png (1280/1920 phase frames, rest frames, reduced frame).
```

AC-41 is **MET** after T15. The reveal timing is unchanged (1290 ms pinned; measured 1300–1310 ms with a 5 ms poll and blocking screenshots), and the card/orb are no longer clipped at either viewport.

## What was verified

- Full lint/typecheck/test/coverage/build/smoke gate re-run after T15/T16; both workspaces green; coverage ≥80 on all four metrics; bundle 273.23 KB gzip (CSS 5.24 KB gzip).
- Container assets untouched (compose, smoke override, both Dockerfiles, `src/backend/src/server.ts`, root/workspace manifests and lockfile; diff empty vs `BASE`; protected working-tree status empty).
- Feature imports: no `GLTFLoader`/`FileLoader`/`TextureLoader`/`fetch(`/`http(s)://` in production `src/frontend/src/render/**` or `src/frontend/src/game/**`; all `three` imports are named (no wildcard/default).
- Manual matrix at 1280×720, 1920×1080, 2560×1280 and 2560×1080: base game view, target lock/reticle; effect timeline at 1280/1920 (conceal, shot, impact, ring, coin popup, post); level burst/banner frames at 1280; production fly-by frames at 1280/1920; panel/preview/reveal/equip at 1280/1920; reduced-motion A/B.
- Production AC-40 fly-by (T16): real level completion through the shipped app (no `triggerFlyBy` call), measured one production roll interval, max |rotation.z| = 2π, max trail = 16 at high, return to follow (`rotation.z = 0`, normal trail 8); reduced-motion completion: max |rotation.z| = 0, trail 0, no roll interval. Quality tier was forced high only for the 16-point trail detail, never for the fly-by trigger.
- High-tier frame traces: 10 s idle and 10 clicks/s at both sizes, three clean runs each; all six high-tier runs pass (avg 16.666 ms, p95 16.7–16.8 ms, tier start/end high).
- Medium and low traces: forced via the real scene test hook (`setQualityTierForTesting`) plus an injected 19 ms / 21 ms frame-time stream; three runs each at both sizes/workloads; tier start/end stable; lower cursor detail sets.
- Forced recovery at both sizes: forced high→low, then a 10 ms frame stream; the real policy recovers low→medium at ~289–290 frames and medium→high at ~589–590 frames (≈4.82 s / 9.82 s wall), final tier high.
- Scene/draw evidence: 147 objects online = 136 own baseline + 11-object remote world; cursor model 32 objects / 21 meshes / 19 materials; tier hidden sets exactly 4 (medium) and 6 (low); high trail `visible=true`, drawRange 8 while moving; pinned cursor draw counts 22/17/15.
- Reduced motion: `prefers-reduced-motion: reduce` matched; two screenshots 1.5 s apart are **pixel-identical (AE 0)**; hover/reticle static; click conceals instantly with no rays/shards/coins; coin feedback is numeric-only; preview static; core HUD/panel copy remains.
- Documentation AC-50 (T13) re-checked: README exact phrases, procedural/no-external-assets statement, glossary terms; `docs/features/README.md` untouched vs `BASE`; proposed row below.
- Reference AC-46: `video-analysis.md` metadata/provenance/40-frame/3-contact-sheet artifact set and `[O]`/`[E]` mapping inspected; `reference/` contains 40 frames + 3 contact sheets (43 files, 15 MB). AC-45 audio alignment lines present (§4.11).
- Migration evidence: T2's pre-006 `pg_dump` / restore / re-apply outputs are re-cited below (dump sha256, restore, idempotent re-run).


## Raw verification commands (verified tree `ba77801`, after T15/T16)

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

### `npm test`

```text

> test
> npm run test --workspaces --if-present


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/auth/rate-limit.test.ts (16 tests) 5ms
 ✓ src/game/upgrades.test.ts (20 tests) 9ms
 ✓ src/auth/config.test.ts (25 tests) 10ms
 ✓ src/game/config.test.ts (13 tests) 9ms
 ✓ src/auth/session-repository.test.ts (35 tests) 18ms
 ✓ src/db/migrate.test.ts (11 tests) 14ms
 ✓ src/auth/user-repository.test.ts (40 tests) 21ms
 ✓ src/game/economy.test.ts (20 tests) 8ms
 ✓ src/game/cubes.test.ts (24 tests) 12ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 23ms
 ✓ src/game/parts-v2.test.ts (40 tests) 20ms
 ✓ src/game/parts.test.ts (19 tests) 6ms
 ✓ src/db/pool.test.ts (10 tests) 8ms
 ✓ src/auth/email.test.ts (12 tests) 8ms
 ✓ src/game/servers.test.ts (38 tests) 15ms
 ✓ src/game/players.test.ts (13 tests) 14ms
 ✓ src/game/hub.test.ts (93 tests) 88ms
 ✓ src/game/protocol.test.ts (166 tests) 20ms
 ✓ src/auth/password.test.ts (17 tests) 278ms
 ✓ src/auth/auth-routes.test.ts (25 tests) 651ms
 ✓ src/auth/auth-service.test.ts (50 tests) 891ms
 ✓ src/app.test.ts (22 tests) 1761ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1023ms
 ✓ src/db/migration-006.test.ts (13 tests) 2496ms
 ✓ src/auth/economy-repository.test.ts (102 tests) 2438ms

 Test Files  24 passed (24)
      Tests  868 passed (868)
   Start at  19:05:39
   Duration  3.11s (transform 1.91s, setup 0ms, collect 5.47s, tests 8.82s, environment 4ms, prepare 1.95s)


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/app.css.test.ts (87 tests) 26ms
 ✓ src/game/progression.test.ts (21 tests) 11ms
 ✓ src/ui/game-view.css.test.ts (42 tests) 16ms
 ✓ src/ws/connection.test.ts (10 tests) 16ms
 ✓ src/game/effects.test.ts (25 tests) 9ms
 ✓ src/game/parts.test.ts (23 tests) 7ms
 ✓ src/render/quality.test.ts (23 tests) 57ms
 ✓ src/multiplayer/protocol.test.ts (236 tests) 33ms
 ✓ src/game/board.test.ts (18 tests) 15ms
 ✓ src/auth/store.test.ts (31 tests) 17ms
 ✓ src/render/particles.test.ts (24 tests) 23ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 107ms
 ✓ src/render/impact-effects.test.ts (15 tests) 29ms
 ✓ src/render/preview.test.ts (7 tests) 32ms
 ✓ src/ui/icons.test.tsx (16 tests) 24ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 21ms
 ✓ src/render/picking.test.ts (16 tests) 92ms
 ✓ src/render/starfield.test.ts (28 tests) 120ms
 ✓ src/render/targeting.test.ts (11 tests) 59ms
 ✓ src/render/cube-view.test.ts (32 tests) 146ms
 ✓ src/input/gestures.test.ts (27 tests) 50ms
 ✓ src/render/cursor-ship.test.ts (34 tests) 174ms
 ✓ src/render/spaceship.test.ts (31 tests) 106ms
 ✓ src/game/engine.test.ts (113 tests) 105ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 224ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 19ms
 ✓ src/render/world.test.ts (27 tests) 161ms
 ✓ src/auth/api.test.ts (28 tests) 13ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 8ms
 ✓ src/game/parts-v2.test.ts (50 tests) 26ms
 ✓ src/game/upgrades.test.ts (20 tests) 8ms
 ✓ src/render/background-life.test.ts (14 tests) 18ms
 ✓ src/render/ship-motion.test.ts (24 tests) 6ms
 ✓ src/docs/links.test.ts (1 test) 3ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 12ms
 ✓ src/browser-env.test.ts (6 tests) 12ms
 ✓ src/input/keyboard.test.ts (13 tests) 16ms
 ✓ src/render/webgl.test.ts (17 tests) 16ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 6ms
 ✓ src/game/motion.test.ts (11 tests) 8ms
 ✓ src/game/rotation.test.ts (15 tests) 8ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 12ms
 ✓ src/ui/theme.test.ts (11 tests) 12ms
 ✓ src/render/postprocessing.test.ts (10 tests) 27ms
 ✓ src/render/nebula.test.ts (11 tests) 520ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  430ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 25ms
 ✓ src/game/economy.test.ts (7 tests) 11ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 4ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 9ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 169ms
 ✓ src/render/scene-spaceship.test.ts (27 tests) 518ms
 ✓ src/ui/Hud.test.tsx (20 tests) 141ms
 ✓ src/ui/LevelCompleteBanner.test.tsx (6 tests) 109ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > renders exactly ten slot rows in SLOT_CATALOG order with the section contract
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > renders exactly three variants per row in standard → rare → epic order
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/render/scene.test.ts (85 tests) 1096ms
 ✓ src/ui/SpaceshipPreview.test.tsx (12 tests) 61ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > shows the slot display name and the equipped part name for every slot
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/UpgradesPanel.test.tsx (12 tests) 201ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > marks owned parts and exposes equipped/label states on the equip controls
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > renders a 44px-capable unequip control per slot, disabled at the standard part
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/AuthMenu.test.tsx (19 tests) 370ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 251ms
 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 155ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > calls onUnequip with the slot id only for an enabled control
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > normalizes legacy direct props into the v2 slot rows
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/game/session.test.ts (81 tests) 1142ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-29) > calls onOpenLootbox once when the enabled control is clicked
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-29) > keeps the pre-v2 onOpen alias working
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > renders the rare/new grant region with the pinned data attributes and copy
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > renders the epic/duplicate copy and the wireframe orb with an orange core
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > advances through the exact 420 + 250 + 120 + 360 + 140 ms timeline
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > keeps the reveal, orb and card non-shrinking and fully visible at the reveal phase
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > restarts the timeline when the same part is reopened with a new sequence
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > renders the settled reveal instantly under reduced motion
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > dismisses the reveal through onDismissReveal
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > equips the revealed part through the panel command
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App > drives data-customization-open from the customization toggle (AC-7, AC-18)
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

 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (28 tests) 610ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 788ms
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

 ✓ src/App.test.tsx (38 tests) 706ms

 Test Files  63 passed (63)
      Tests  1700 passed (1700)
   Start at  19:05:43
   Duration  3.16s (transform 6.69s, setup 0ms, collect 19.70s, tests 8.79s, environment 5.56s, prepare 6.38s)

TEST_EXIT=0
```

### `npm run coverage`

```text

> coverage
> npm run coverage --workspaces --if-present


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/db/pool.test.ts (10 tests) 6ms
 ✓ src/game/config.test.ts (13 tests) 10ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 13ms
 ✓ src/auth/user-repository.test.ts (40 tests) 19ms
 ✓ src/auth/rate-limit.test.ts (16 tests) 7ms
 ✓ src/game/upgrades.test.ts (20 tests) 11ms
 ✓ src/game/economy.test.ts (20 tests) 6ms
 ✓ src/game/parts.test.ts (19 tests) 12ms
 ✓ src/db/migrate.test.ts (11 tests) 12ms
 ✓ src/game/cubes.test.ts (24 tests) 14ms
 ✓ src/auth/config.test.ts (25 tests) 13ms
 ✓ src/auth/session-repository.test.ts (35 tests) 15ms
 ✓ src/game/servers.test.ts (38 tests) 16ms
 ✓ src/game/players.test.ts (13 tests) 14ms
 ✓ src/game/parts-v2.test.ts (40 tests) 17ms
 ✓ src/auth/email.test.ts (12 tests) 11ms
 ✓ src/game/protocol.test.ts (166 tests) 21ms
 ✓ src/game/hub.test.ts (93 tests) 108ms
 ✓ src/auth/password.test.ts (17 tests) 361ms
 ✓ src/auth/auth-routes.test.ts (25 tests) 720ms
 ✓ src/auth/auth-service.test.ts (50 tests) 957ms
 ✓ src/app.test.ts (22 tests) 1754ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1023ms
 ✓ src/auth/economy-repository.test.ts (102 tests) 2412ms
 ✓ src/db/migration-006.test.ts (13 tests) 2438ms

 Test Files  24 passed (24)
      Tests  868 passed (868)
   Start at  19:05:52
   Duration  3.31s (transform 1.93s, setup 0ms, collect 6.43s, tests 8.97s, environment 5ms, prepare 2.45s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.43 |    87.71 |    99.7 |   95.43 |                   
 src               |   80.54 |    84.44 |     100 |   80.54 |                   
  app.ts           |   80.54 |    84.44 |     100 |   80.54 | ...46,159,226-243 
 src/auth          |   95.61 |    81.43 |     100 |   95.61 |                   
  auth-routes.ts   |      80 |    47.54 |     100 |      80 | ...45-347,353-354 
  auth-service.ts  |     100 |    80.53 |     100 |     100 | ...95,400,417,503 
  config.ts        |     100 |      100 |     100 |     100 |                   
  ...repository.ts |    95.5 |    84.68 |     100 |    95.5 | ...81-682,738-751 
  email.ts         |     100 |      100 |     100 |     100 |                   
  password.ts      |     100 |      100 |     100 |     100 |                   
  rate-limit.ts    |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 | ...40-141,146-147 
  ...repository.ts |    98.8 |    90.58 |     100 |    98.8 | 61-62,315         
  ...repository.ts |   97.29 |    91.57 |     100 |   97.29 | 63-68             
 src/db            |     100 |      100 |     100 |     100 |                   
  migrate.ts       |     100 |      100 |     100 |     100 |                   
  pool.ts          |     100 |      100 |     100 |     100 |                   
 src/game          |   96.53 |    95.35 |   99.26 |   96.53 |                   
  config.ts        |     100 |      100 |     100 |     100 |                   
  cubes.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  hub.ts           |   92.98 |    90.57 |     100 |   92.98 | ...1005,1037-1038 
  parts-v2.ts      |     100 |      100 |     100 |     100 |                   
  parts.ts         |     100 |      100 |     100 |     100 |                   
  players.ts       |     100 |      100 |     100 |     100 |                   
  protocol.ts      |   98.79 |    98.43 |   96.55 |   98.79 | 233-234,548-549   
  servers.ts       |     100 |      100 |     100 |     100 |                   
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
-------------------|---------|----------|---------|---------|-------------------

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ui/app.css.test.ts (87 tests) 17ms
 ✓ src/game/parts-v2.test.ts (50 tests) 29ms
 ✓ src/multiplayer/protocol.test.ts (236 tests) 30ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 13ms
 ✓ src/render/postprocessing.test.ts (10 tests) 9ms
 ✓ src/render/quality.test.ts (23 tests) 65ms
 ✓ src/ws/connection.test.ts (10 tests) 10ms
 ✓ src/auth/store.test.ts (31 tests) 13ms
 ✓ src/render/preview.test.ts (7 tests) 35ms
 ✓ src/ui/icons.test.tsx (16 tests) 26ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 14ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 22ms
 ✓ src/render/background-life.test.ts (14 tests) 19ms
 ✓ src/render/particles.test.ts (24 tests) 23ms
 ✓ src/render/impact-effects.test.ts (15 tests) 38ms
 ✓ src/render/cursor-ship.test.ts (34 tests) 123ms
 ✓ src/render/targeting.test.ts (11 tests) 99ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 149ms
 ✓ src/input/gestures.test.ts (27 tests) 36ms
 ✓ src/render/starfield.test.ts (28 tests) 136ms
 ✓ src/render/spaceship.test.ts (31 tests) 112ms
 ✓ src/render/cube-view.test.ts (32 tests) 245ms
 ✓ src/render/picking.test.ts (16 tests) 185ms
 ✓ src/game/engine.test.ts (113 tests) 124ms
 ✓ src/ui/game-view.css.test.ts (42 tests) 34ms
 ✓ src/auth/api.test.ts (28 tests) 24ms
 ✓ src/game/board.test.ts (18 tests) 27ms
 ✓ src/render/webgl.test.ts (17 tests) 16ms
 ✓ src/ui/theme.test.ts (11 tests) 10ms
 ✓ src/game/economy.test.ts (7 tests) 5ms
 ✓ src/input/keyboard.test.ts (13 tests) 14ms
 ✓ src/browser-env.test.ts (6 tests) 18ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 450ms
 ✓ src/game/upgrades.test.ts (20 tests) 9ms
 ✓ src/game/progression.test.ts (21 tests) 10ms
 ✓ src/game/effects.test.ts (25 tests) 14ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 17ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 10ms
 ✓ src/render/world.test.ts (27 tests) 350ms
 ✓ src/game/motion.test.ts (11 tests) 8ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 14ms
 ✓ src/game/rotation.test.ts (15 tests) 9ms
 ✓ src/render/ship-motion.test.ts (24 tests) 9ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 9ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 34ms
 ✓ src/docs/links.test.ts (1 test) 5ms
 ✓ src/game/parts.test.ts (23 tests) 11ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 8ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 303ms
 ✓ src/render/nebula.test.ts (11 tests) 859ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  701ms
 ✓ src/render/scene-spaceship.test.ts (27 tests) 949ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > renders exactly ten slot rows in SLOT_CATALOG order with the section contract
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > renders exactly three variants per row in standard → rare → epic order
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > shows the slot display name and the equipped part name for every slot
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > marks owned parts and exposes equipped/label states on the equip controls
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > renders a 44px-capable unequip control per slot, disabled at the standard part
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/SpaceshipPreview.test.tsx (12 tests) 84ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > calls onUnequip with the slot id only for an enabled control
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > normalizes legacy direct props into the v2 slot rows
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-29) > calls onOpenLootbox once when the enabled control is clicked
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/LevelCompleteBanner.test.tsx (6 tests) 145ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-29) > keeps the pre-v2 onOpen alias working
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 221ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > renders the rare/new grant region with the pinned data attributes and copy
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > renders the epic/duplicate copy and the wireframe orb with an orange core
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 260ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > advances through the exact 420 + 250 + 120 + 360 + 140 ms timeline
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/Hud.test.tsx (20 tests) 179ms
 ✓ src/ui/UpgradesPanel.test.tsx (12 tests) 319ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > keeps the reveal, orb and card non-shrinking and fully visible at the reveal phase
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/AuthMenu.test.tsx (19 tests) 619ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > restarts the timeline when the same part is reopened with a new sequence
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > renders the settled reveal instantly under reduced motion
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App > drives data-customization-open from the customization toggle (AC-7, AC-18)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > dismisses the reveal through onDismissReveal
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > equips the revealed part through the panel command
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

 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (28 tests) 783ms
stderr | src/App.test.tsx > App — customization panel integration (AC-29, AC-32, AC-43) > passes pendingLootboxOpen to the panel and disables Open lootbox while pending
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/AuthForms.test.tsx (44 tests) 1039ms
   ✓ AuthForms — interaction > submits the rendered login form and calls onLogin with the entered values  310ms
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

 ✓ src/App.test.tsx (38 tests) 1109ms
 ✓ src/render/scene.test.ts (85 tests) 2574ms
 ✓ src/game/session.test.ts (81 tests) 2673ms

 Test Files  63 passed (63)
      Tests  1700 passed (1700)
   Start at  19:05:56
   Duration  4.23s (transform 6.47s, setup 0ms, collect 19.38s, tests 14.80s, environment 5.97s, prepare 6.54s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.34 |     95.3 |   97.43 |   96.34 |                   
 src               |    86.5 |    82.91 |    92.5 |    86.5 |                   
  App.tsx          |   86.03 |    81.52 |   92.85 |   86.03 | ...33,455-456,619 
  browser-env.ts   |   91.66 |      100 |   91.66 |   91.66 | 69-72             
 src/auth          |   96.81 |    86.56 |   96.15 |   96.81 |                   
  api.ts           |   96.33 |    88.29 |     100 |   96.33 | ...54-155,163,209 
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193 
 src/game          |   96.28 |    99.73 |   98.92 |   96.28 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |   99.47 |      100 |     100 |   99.47 | 958-959,1250-1251 
  motion.ts        |     100 |      100 |     100 |     100 |                   
  parts-v2.ts      |     100 |      100 |     100 |     100 |                   
  parts.ts         |     100 |      100 |     100 |     100 |                   
  progression.ts   |     100 |      100 |     100 |     100 |                   
  rotation.ts      |     100 |      100 |     100 |     100 |                   
  session.ts       |   90.03 |    99.63 |   96.77 |   90.03 | ...1277,1290-1291 
  types.ts         |     100 |      100 |     100 |     100 |                   
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
 src/input         |     100 |      100 |     100 |     100 |                   
  gestures.ts      |     100 |      100 |     100 |     100 |                   
  keyboard.ts      |     100 |      100 |     100 |     100 |                   
 src/multiplayer   |   92.94 |    96.42 |   95.83 |   92.94 |                   
  protocol.ts      |   88.57 |    95.73 |      90 |   88.57 | ...1026,1030-1040 
  server-state.ts  |   98.15 |    95.04 |     100 |   98.15 | ...16,318-319,377 
  spectate.ts      |     100 |      100 |     100 |     100 |                   
  transport.ts     |   97.95 |      100 |     100 |   97.95 | 176-178,196       
 src/render        |   98.45 |    96.16 |   98.72 |   98.45 |                   
  ...round-life.ts |     100 |      100 |     100 |     100 |                   
  ...c-backdrop.ts |      99 |       96 |     100 |      99 | 299-300           
  cube-view.ts     |     100 |      100 |     100 |     100 |                   
  cursor-ship.ts   |   99.54 |    97.61 |     100 |   99.54 | 208-209           
  ...ct-effects.ts |   97.24 |    91.76 |     100 |   97.24 | ...83-484,511-512 
  nebula.ts        |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |   97.33 |    90.47 |     100 |   97.33 | 122-123           
  ...processing.ts |     100 |      100 |     100 |     100 |                   
  preview.ts       |     100 |      100 |     100 |     100 |                   
  quality.ts       |   97.68 |    97.05 |     100 |   97.68 | 220-221,301-302   
  scene.ts         |   97.23 |    95.67 |   95.34 |   97.23 | ...1029,1037-1038 
  ship-motion.ts   |     100 |      100 |     100 |     100 |                   
  ...ship-model.ts |     100 |      100 |     100 |     100 |                   
  spaceship.ts     |   96.07 |    96.33 |   96.42 |   96.07 | ...07-516,534-535 
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  targeting.ts     |   95.78 |     92.5 |     100 |   95.78 | ...64-166,178-179 
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |   98.41 |    91.75 |     100 |   98.41 | 229-232,442       
 src/ui            |   96.79 |    94.24 |   94.02 |   96.79 |                   
  AuthForms.tsx    |     100 |    99.09 |     100 |     100 | 219               
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  ...ionToggle.tsx |     100 |      100 |     100 |     100 |                   
  GameCanvas.tsx   |   90.47 |      100 |     100 |   90.47 | 25-26             
  Hud.tsx          |     100 |      100 |     100 |     100 |                   
  ...eteBanner.tsx |     100 |      100 |     100 |     100 |                   
  ...tionPanel.tsx |   96.84 |    88.99 |     100 |   96.84 | ...09-210,216-217 
  ...ipPreview.tsx |    87.2 |    77.41 |      75 |    87.2 | ...24-125,130-131 
  ...adesPanel.tsx |   96.74 |    90.62 |     100 |   96.74 | 77-78,96-97       
  UserPanel.tsx    |   91.07 |      100 |   66.66 |   91.07 | 69-70,93-95       
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 | 30-37             
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |                   
  icons.tsx        |     100 |      100 |     100 |     100 |                   
  theme.ts         |     100 |      100 |     100 |     100 |                   
 src/ws            |   95.34 |    92.85 |     100 |   95.34 |                   
  connection.ts    |   95.34 |    92.85 |     100 |   95.34 | 53-54,99-100      
-------------------|---------|----------|---------|---------|-------------------
COVERAGE_EXIT=0
```

### `npm run build`

```text

> build
> npm run build --workspaces --if-present


> build
> tsc


> build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 103 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.42 kB │ gzip:   0.28 kB
dist/assets/index-BjbbTImZ.css   25.61 kB │ gzip:   5.24 kB
dist/assets/index-DG73kq1J.js   985.27 kB │ gzip: 273.23 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.48s
BUILD_EXIT=0
```

### `npm run smoke`

```text

> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

[4m>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

[0m Container cubeclicker-backend-1 Running 
 Container cubeclicker-frontend-1 Running 
 Container cubeclicker-db-1 Running 
 Container cubeclicker-mailpit-1 Running 
 Container cubeclicker-db-1 Waiting 
 Container cubeclicker-db-1 Healthy 
 Container cubeclicker-smoke-run-2acdb2c84341 Creating 
 Container cubeclicker-smoke-run-2acdb2c84341 Created 
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 41
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 42
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1002ms
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
SMOKE PASS (12/12 checks)
SMOKE_EXIT=0
```
## Container, protected-path and bundle gates

### Container diff vs `BASE`

```text
$ git diff --stat f07d067...HEAD -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile src/backend/src/server.ts package.json package-lock.json src/backend/package.json src/frontend/package.json
CONTAINER_DIFF_EXIT=0
(no output)

$ git diff --name-only f07d067...HEAD -- compose.yaml compose.smoke.yaml 'src/*/Dockerfile' src/backend/src/server.ts package.json package-lock.json 'src/*/package.json'
NAMES_END
(no output)
```

### Working-tree protected paths

```text
$ git status --porcelain -- compose.yaml compose.smoke.yaml 'src/*/Dockerfile' src/backend/src/server.ts package.json package-lock.json 'src/*/package.json' .env .env.local .env.example
PROTECTED_STATUS_END
(no output)
```

The only deployment artifact change in the feature is migration `006_granular_spaceship_parts.sql`, applied by the existing startup runner against the existing `db` service. No new service, image, port, environment variable, health signal, compose entry, Dockerfile or WebSocket endpoint. `podman compose up` and `npm run smoke` remain the local/container paths. `npm run smoke` ran for real (12/12 checks) — not skipped.

### Bundle / import gate

```text
$ grep -rnE "GLTFLoader|FileLoader|TextureLoader|fetch\(|https?://" src/frontend/src/render src/frontend/src/game --include=*.ts --include=*.tsx | grep -v '\.test\.'
NONE

$ grep -rnE "import \* as|import THREE from" src/frontend/src/render src/frontend/src/game src/frontend/src/ui --include=*.ts --include=*.tsx | grep -v '\.test\.'
(no output)

$ grep -rn "from 'three'" <feature render modules>
src/frontend/src/render/cursor-ship.ts:33:} from 'three';
src/frontend/src/render/spaceship.ts:39:} from 'three';
src/frontend/src/render/scene.ts:67:} from 'three';
src/frontend/src/render/targeting.ts:32:} from 'three';
src/frontend/src/render/impact-effects.ts:38:} from 'three';
src/frontend/src/render/particles.ts:44:} from 'three';
src/frontend/src/render/preview.ts:15:import { AmbientLight, DirectionalLight, PerspectiveCamera, Scene } from 'three';
src/frontend/src/render/picking.ts:38:} from 'three';
```

All imports are named; no wildcard or default `three` import. `npm run build` initial JS is **985.27 kB / 273.23 kB gzip** (≤ 350 kB); CSS 25.61 kB / 5.24 kB gzip.

### Pre-006 `pg_dump` / restore evidence (T2, re-cited)

From `build-log-T2.md` § “Pre-migration pg_dump (AC-14/AC-15/F24/T14 acceptance evidence)” and § “Restore command (recorded for T14/rollback)”:

```text
podman run -d --rm --name cc-t2-dump \
  -e POSTGRES_USER=cubeclicker -e POSTGRES_PASSWORD=cubeclicker \
  -e POSTGRES_DB=cubeclicker -p 127.0.0.1:55434:5432 docker.io/library/postgres:16-alpine

podman exec cc-t2-dump pg_dump -U cubeclicker -d cubeclicker --no-owner --no-privileges > /tmp/opencode/cubeclicker-t2/pre-006.sql

pg_dump exit=0
243 7077 /tmp/opencode/cubeclicker-t2/pre-006.sql
b1e9d30f03dc208f6153311513544ca538f68412169b7054914fa2101069d5ab  /tmp/opencode/cubeclicker-t2/pre-006.sql
```

Restore and 006 re-apply (T2):

```text
podman exec cc-t2-dump dropdb -U cubeclicker --if-exists cubeclicker_restore
podman exec cc-t2-dump createdb -U cubeclicker cubeclicker_restore
podman exec -i cc-t2-dump psql -U cubeclicker -d cubeclicker_restore -v ON_ERROR_STOP=1 < /tmp/opencode/cubeclicker-t2/pre-006.sql
restore exit=0

$ ... psql ... "SELECT user_id, parts::text, appearance::text FROM user_economy ORDER BY user_id"
20000000-...-0001|{"body-gold": 1, "engine-blue": 1, "wings-silver": 2}|{"body": "body-gold", "wings": "wings-silver", "engine": "engine-blue"}
20000000-...-0002|{"body-gold": 3, "engine-blue": "abc", "nose-crimson": 2147483647, "wings-silver": 99999999999}|{}

$ ... psql ... < src/backend/src/db/migrations/006_granular_spaceship_parts.sql
ALTER TABLE
UPDATE 2
UPDATE 2
UPDATE 2
ALTER TABLE

$ ... psql ... "SELECT user_id, parts::text, appearance::text, customization_version ..."
20000000-...-0001|{"hull-gold": 1, "wing-left-silver": 2, "wing-right-silver": 2, "ignition-left-blue": 1, "ignition-right-blue": 1}|{"hull": "hull-gold", "wing-left": "wing-left-silver", "wing-right": "wing-right-silver", "ignition-left": "ignition-left-blue", "ignition-right": "ignition-right-blue"}|2
20000000-...-0002|{"hull-gold": 3, "nose-crimson": 2147483647}|{}|2
```

The full dump, idempotent re-run and `schema.sql` mirror outputs are in `build-log-T2.md`; the dump hash above is the acceptance evidence.

## Manual matrix (running stack + headless Chrome)

All captures are in `docs/features/spaceship-cursor-loot-animations/evidence/t14-*.png`. The effect timeline is a `Page.startScreencast` capture; frame labels are the measured capture time relative to the click (metadata timestamp minus `performance.timeOrigin/1000` and click `performance.now()`). The pinned event beats themselves are asserted by the unit tests; the screencast is the visual evidence.

### Per-size matrix

| Size | Base view | Target lock / reticle | Preview (scrolled) | Effects | Reveal |
| --- | --- | --- | --- | --- | --- |
| 1280×720 | `t14-base-1280x720.png` | `t14-target-lock-1280x720.png` | `t14-preview-1280x720.png` (303×153, aria-label, 10 slot attrs) | `t14-pop-*.png`, `t14-level-*.png` | `t14-reveal-fixed-*.png` (fixed) + before-fix `t14-reveal-*.png`/clipped crops |
| 1920×1080 | `t14-base-1920x1080.png` | `t14-target-lock-1920x1080.png` | `t14-preview-1920x1080.png` (303×153, 10 slots) | `t14-pop-*1920x1080.png` | `t14-reveal-fixed-*.png` (fixed) + before-fix layout/crop |
| 2560×1280 | `t14-base-2560x1280.png` | `t14-target-lock-2560x1280.png` | `t14-preview-2560x1280.png` (303×153, 10 slots) | — | — |
| 2560×1080 | `t14-base-2560x1080.png` | `t14-target-lock-2560x1080.png` | `t14-preview-2560x1080.png` (303×153, 10 slots) | — | — |

Measured canvas sizes: 1280×720, 1920×1080, 2560×1280, 2560×1080 (full viewport, no letterbox). Scene/projection is correct at all four sizes; target lock shows the white 1.03-scale tile outline and the six-tick reticle (visible in the target-lock screenshots).

### Effect timeline (1280×720)

```text
Click anchor (page performance.now) = 5282.1 ms; screencast frames = 78
Chosen frames (measured ms after click): -7, 93, 177, 310, 527, 910, 1160
Saved: t14-pop-00-7ms / 0093ms / 0177ms / 0310ms / 0527ms / 0910ms / 1160ms
Coin popup: first seen 64 ms, gone 1121 ms (50 ms polling; lifetime envelope 1057–1121 ms; pinned 1100 ms)
No-shake computed styles after a pop:
  main              transform none; translate none; rotate none; scale none; animation none
  .hud-panel        transform none; translate none; rotate none; scale none; animation none
  .upgrades-panel   transform none; translate none; rotate none; scale none; animation none
Canvas rect = (0,0,1280,720)
```

- Instant conceal: the clicked tile is already a black hole at the 0 ms / 177 ms frames (`HUD clicks 1`, coin `0.10`); no shrink/flash record. AC-36.
- Shot/impact: the 093 ms/177 ms frames show the shot/flight and the first impact core; the 310 ms frame shows the full gold ray fan + 3-instance ring + shards/coins; the 527 ms frame shows the ring at its large scale; 910 ms shows the coin-popup tail; 1160 ms is post-effect. The exact pool counts (12 rays / 14 shards / 6 coins / 3 rings) are pinned by `impact-effects.test.ts` and `QUALITY_IMPACT_COUNTS`.
- 330 ms ring growth / 480 ms visible are pinned by tests; the frames show the ring expanding and fading.
- 1100 ms coin popup is measured above; the max-concurrency 3 and 45 px rise/220 ms are pinned by `Hud.test.tsx`/`App.test.tsx`.
- No screen shake: all four HUD/panel surfaces report no transform/translate/rotate/scale/animation after the pop; tests additionally compare camera position/quaternion across pop/ring/level.

### Effect timeline (1920×1080)

```text
Click anchor = 5483.8 ms; screencast frames = 43
Chosen frames (measured ms after click): -8, 75, 159, 209, 259, 309, 542, 909, 1175
Coin popup: first seen 75 ms, gone 1139 ms (lifetime envelope 1064–1139 ms; pinned 1100 ms)
No-shake computed styles: main/.hud-panel/.upgrades-panel all transform none; canvas rect = (0,0,1920,1080)
```

### Level completion (1280×720)

```text
Level-change timestamp (page performance.now) = 27224.6 ms
Screencast frames = 521; sampled frame times (ms relative to level change):
  -148, -81, -15, 52, 119, 185, 269, 335, 402, 469, 535, 602, 685, 752, 819, 885, 952, 1019, 1085, 1152, 1235
Saved level frames: -15, 102, 185, 235, 302, 402, 702, 1003, 1403 ms
HUD: cube 2, faces destroyed 11, clicks 314, coins 51.40
Banner DOM query 1.9 s later: present=false (banner had already expired after the pinned 1600 ms hold)
```

- The 102/185/235/302 ms frames show the full-screen burst (16 gold + 8 cyan rays, 3 rings, 12 stars, 20 coins) and the `LEVEL COMPLETE` banner entering/overshooting; the 402/702/1003/1403 ms frames show the banner hold and decay.
- The 302 ms frame shows the cursor ship mid-360° roll (nose pointing left, belly visible). That earlier frame was harness-driven at `0bfc524`; T16 `ba77801` added the production `levelIndex`-rise trigger and the integration test. The final production re-capture is in the next subsection.
- Banner timing: CSS/tests pin entry 0.2/−8°, 1.0 at ≈170 ms, 1.08 peak at `bannerPeakMs = 250`, settle by 450 ms with ±2° wobble, halo 250 ms, hold 1600 ms. The screencast captured the peak frames; the DOM query after 1.9 s correctly found it gone. Unit tests in `LevelCompleteBanner.test.tsx`/`game-view.css.test.ts` assert the exact keyframes/counts.
- No camera/HUD shake: computed styles on `main`/`.hud-panel`/`.upgrades-panel` are `none`; `scene.test.ts`/`scene-spaceship.test.ts` pin camera equality.

### Production AC-40 fly-by (T16, shipped level-completion path)

Method: the real app was played as a guest; a level was completed by clicking mini-cubes (no `triggerFlyBy`/`startFlyBy` call). The scene was observed read-only through the harness's `window.__t14Scene` reference (10 ms sampler on the `spaceship` group and its `spaceship-trail` `Points`). The quality tier was forced high at the final face **only** so the 16-point trail is rendered; the fly-by trigger itself was the production `levelIndex` rise. Screenshots are `t14-flyby-production-*.png`.

```text
1280x720 high-tier production run:
  tier at roll: high (tiers=["high"])
  one contiguous roll interval; max |rotation.z| = 6.2832 rad (2π)
  detected interval above 0.05 rad = 606.4 ms; pinned shipRollMs = 700 ms (threshold/sampling excludes the ramp ends)
  max trail drawRange = 16 (MOTION.fireTrailCount) at high
  post-roll: rotation.z = 0, position z 6.93 → 6.68 (following the camera/pointer), normal trail 8
  frames: t14-flyby-production-0007ms / 0107ms / 0174ms / 0241ms / 0341ms / 0491ms / 0707ms / 0907ms-1280x720.png
1280x720 medium-tier production run (no quality force):
  one roll interval; max |rotation.z| = 6.2828; max trail = 0 (medium tier intentionally disables the trail)
1920x1080 high-tier production run:
  one roll interval; max |rotation.z| = 6.2828 rad; max trail = 16; detected interval 592.1 ms
  the 0305 ms frame shows the ship large and mid-roll in front of the banner:
  t14-flyby-production-0305ms-1920x1080.png (also 0022/0105/0189/0239/0522/0689/0905)
Reduced-motion production run (1280x720):
  matchMedia(...) = true; max |rotation.z| = 0; max trail = 0; rollIntervals = []
  screenshot: t14-flyby-production-reduced-1280x720.png; no roll, banner remains
```

The 1920×1080 305 ms frame is the clearest production visual: the ship is mid-roll at the left of the banner. At 1280×720 the roll is partly occluded by the banner/travel plane in the screencast frames; the sampler still proves the same one-roll/2π/16-point/return sequence. No second roll was observed after the 700 ms window.


### Panel / preview / reveal / equip

```text
PANEL (1280x720): open=true, lootboxes=2, keys=2, slots=10,
  slotNames=[hull,nose,cockpit,wing-left,wing-right,engine-left,engine-right,ignition-left,ignition-right,tail-fin],
  variants=[3,3,3,3,3,3,3,3,3,3],
  previewLabel="Spaceship preview", previewSlots=10, openDisabled=false
PANEL_GEOM: panel clientHeight=428, scrollHeight=1970, scrollTop=0;
  preview 303x153 at top=2030.7 in document flow (reachable by panel scroll)
PREVIEW after scroll (all sizes): 303x153, aria-label="Spaceship preview", 10 data-preview-slot attrs
REVEAL transitions after T15 (5 ms polling, 1280x720): charge 9 ms, orb 431 ms, flash 690 ms, reveal 808 ms,
  settle 1162 ms, rest 1310 ms; 1920x1080: 7/435/680/810/1160/1300 ms.
  (pinned boundaries 420/670/790/1150/1290; measured within one poll interval plus screenshot latency; total 1290 in CSS/tests)
REVEAL grant examples: wing-right-silver / wing-right / rare / new; cockpit-amber / cockpit / rare / new;
  engine-left-vector / engine-left / rare / new; data attributes and copy present.
REVEAL LAYOUT AFTER T15 (fixed): .lootbox-reveal height=306 px, .lootbox-orb height=80 px at charge /
  100 px overshoot, .lootbox-reveal-card height=198.1 px (183.4 px at rest), card bottom 606–613 px (1280)
  and 750 px (1920); panel top 224/368, clientHeight 428/644, so the full reveal and card are visible at
  scrollTop 0; panel scrollHeight 2313 (slots/preview scroll below it). Computed flex-shrink 0,
  overflow visible. Screenshots: t14-reveal-fixed-*.png (phase frames, rest frames, reduced frame).
BEFORE T15 (first run): .lootbox-reveal 18 px, orb 0 px, card 198.1 px clipped, scrollHeight 2025.
  Historical screenshots: t14-reveal-layout-700ms-*.png, t14-reveal-layout-1400ms-*.png, t14-reveal-clipped-*.png.
EQUIP (variant in the granted row, panel scrolled by script):
  data-equipping true from 10 ms to 262 ms (cockpit; ~252 ms), and 9 ms to 263 ms (engine-left; ~254 ms);
  pinned MOTION.equipRowFlashMs = 260 ms. Equipped names updated (Amber Razor / Port Vector Engine).
  The row was below the visible scroll window at the recorded scrollTop, so the flash is proven by the
  live `data-equipping` timing and the CSS/panel tests rather than a centered screenshot; `t14-equip-flash-row-1280x720.png`
  records the panel/game frame at the flash instant.
```

- AC-29: 10 slot rows in canonical order, 3 variants each, owned/locked/equipped states, open/pending/unequip controls. Panel tests + manual.
- AC-30: panel max height 428 px at 1280 (≤60vh = 432), vertical scroll; 44 px/focus targets and ARIA in tests/CSS. The reveal's controls are visible after the T15 fix (306 px reveal; orb 80 px; card fully visible).
- AC-31: preview real canvas 303×153, labeled, 10 slot attributes; the canvas is at the bottom of the scrollable panel (top 2030/2174/... before scroll) and renders after scrolling. Preview tests + screenshots.
- AC-32: reveal region `role=status`, `aria-live=polite`, data attrs, part/slot names, rarity/duplicate, Equip/Dismiss; sequence restart tests. Manual data and copy present.
- AC-41: **met after T15 `0bfc524`** — reveal 306 px, orb 80 px, card 198/183 px, fully visible at 1280/1920; timing 1290 pinned (1310/1300 measured with 5 ms poll + screenshot latency); copy/ARIA and reduced-motion instant rest unchanged. The before-fix clipped values are retained as historical evidence.

### Reduced-motion A/B

```text
Emulation.setEmulatedMedia prefers-reduced-motion: reduce → matchMedia(...) true
Screenshots A and B 1.5 s apart: 1280×720 RGB difference AE = 0 pixels (0.000 %), bbox = None, mean abs diff = 0.0
Target lock under reduced motion: static outline, no ticks (t14-reduced-hover-1280x720.png)
Click under reduced motion: tile concealed instantly; NO rays/shards/coins; ring is the 120 ms opacity flash;
  coin feedback numeric-only (HUD coins 0.10, no .hud-coin-pop text); core HUD/panel copy remains.
Preview under reduced motion: static frame, 303×153, 10 slots.
```

- The pixel-identical A/B proves hero ship, background, cursor ship, trail, idle and effects are frozen under reduced motion. The unit suites (`motion.test.ts`, `impact-effects.test.ts`, `spaceship.test.ts`, `Hud.test.tsx`, `LevelCompleteBanner.test.tsx`, `game-view.css.test.ts`, `SpaceshipCustomizationPanel.test.tsx`) pin each reduced variant. The adaptive tier cannot re-enable them (`qualityFeatures(tier, true)`).
- Reduced-motion reveal after T15: `phase=rest` at 13 ms (instant), reveal 306 px, orb 80 px, card 183.4 px,
  `data-reduced-motion="true"`, animation `none` on reveal/orb/card, same copy/ARIA. Screenshot:
  `t14-reveal-fixed-reduced-1280x720.png`.


## Performance, adaptive tier and draw counts

### Policy constants (from `src/frontend/src/render/quality.ts`)

```json
{"window":120,"min":60,"down":60,"up":180,"lowUp":240,"coolD":1000,"coolU":3000,
 "meshes":{"high":21,"medium":17,"low":15},
 "impact":{"high":{"rays":12,"shards":14,"coins":6},"medium":{"rays":6,"shards":7,"coins":3},"low":{"rays":0,"shards":0,"coins":0}},
 "sparks":{"high":24,"medium":12,"low":0},
 "mediumHidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right"],
 "lowHidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","cursor-wing-left-tip","cursor-wing-right-tip"]}
```

Pinned thresholds/cooldowns: 120-frame rolling window (clamp 250 ms, non-finite/≤0 ignored), minimum 60 samples; `avg` arithmetic mean, `p95` nearest-rank `ceil(0.95n)-1`; high→medium `avg>18.0 || p95>24.0` for 60 frames / 1000 ms cooldown; medium→low `avg>20.0 || p95>28.0` for 60 frames / 1000 ms cooldown; medium→high `avg<=16.0 && p95<=20.0` for 180 frames / 3000 ms cooldown; low→medium `avg<=17.0 && p95<=22.0` for 240 frames / 3000 ms cooldown; one change per decision; default high. Reduced motion is authoritative: trail/reticle/cursor motion/impact particles/sparks/shockwave expansion/banner motion are disabled regardless of tier.

### Frame traces — 10 s each, three clean runs (matrix runs, fresh page per run)

Method: high runs use real `requestAnimationFrame` timestamps; high tier is forced with `SceneView.setQualityTierForTesting('high')` immediately before the trace, then `tierStart`/`tierEnd` are read from the live scene. Medium/low runs force the tier with the same hook and feed the policy a controlled 19 ms / 21 ms frame delta stream (`window.requestAnimationFrame` wrapper; no source edit). The high budget applies to high; medium/low frame columns record the injected profile and are not a budget claim. Click runs dispatch pointer events at 10/s; hit counts are the HUD clicks delta (75/75/50 at 1280 and 75/89/64 at 1920 for high; lower on smaller grids/rotation phases).

T15 `0bfc524` is CSS/UI-only; T16 `ba77801` adds the production `levelIndex`-rise trigger in `scene.ts` plus tests. Neither touches the render loop timing, quality policy, cursor/impact/targeting code or bundle dependencies, so the high/medium/low and recovery traces below are reused from the first T14 run. The verified build is 273.23 KB JS gzip (T16 +0.07 KB) and 5.24 KB CSS gzip.

| tier | workload | size | run 1 avg/p95 | run 2 avg/p95 | run 3 avg/p95 | median avg/p95 | tier end |
| --- | --- | --- | --- | --- | --- | --- | --- |
| high | idle | 1280×720 | 16.666/16.7 | 16.666/16.8 | 16.666/16.8 | 16.666/16.8 | high,high,high |
| high | idle | 1920×1080 | 16.666/16.8 | 16.666/16.8 | 16.666/16.8 | 16.666/16.8 | high,high,high |
| high | clicks | 1280×720 | 16.666/16.7 | 16.666/16.8 | 16.666/16.7 | 16.666/16.7 | high,high,high |
| high | clicks | 1920×1080 | 16.666/16.7 | 16.666/16.8 | 16.666/16.7 | 16.666/16.7 | high,high,high |
| medium | idle | 1280×720 | 19/19 | 19/19 | 19/19 | 19/19 | medium,medium,medium |
| medium | idle | 1920×1080 | 19/19 | 19/19 | 19/19 | 19/19 | medium,medium,medium |
| medium | clicks | 1280×720 | 19/19 | 19/19 | 19/19 | 19/19 | medium,medium,medium |
| medium | clicks | 1920×1080 | 19/19 | 19/19 | 19/19 | 19/19 | medium,medium,medium |
| low | idle | 1280×720 | 21/21 | 21/21 | 21/21 | 21/21 | low,low,low |
| low | idle | 1920×1080 | 21/21 | 21/21 | 21/21 | 21/21 | low,low,low |
| low | clicks | 1280×720 | 21/21 | 21/21 | 21/21 | 21/21 | low,low,low |
| low | clicks | 1920×1080 | 21/21 | 21/21 | 21/21 | 21/21 | low,low,low |

- **High tier: 6/6 matrix runs pass** (avg 16.666 ms ≤16.7; p95 16.7–16.8 ≤33) at both sizes and both workloads, with `tierStart=tierEnd=high`. No high-tier miss was reproduced; no AC relaxation is claimed.
- Frame counts: 598–600 frames per 10 s trace. High idle 1280/1920 median 16.666/16.8; high clicks 1280/1920 median 16.666/16.7.
- Draw means (total WebGL draw calls per frame, background-life noise included): high idle 191.91/191.92; high clicks 242.72/242.46/233.84 (1280) and 242.70/246.37/239.22 (1920); medium idle 191.97/191.97/192.00; medium clicks 223.92/234.12/234.32 and 234.28/236.34/232.67; low idle 191.99; low clicks 214.01/225.45/225.62 and 223.65/213.94/214.04. Medium/low click draw loads are **lower** than high at both sizes.

### Forced low → high recovery (real policy, both sizes)

```text
1280×720: start low → medium at 4817 ms / 289 frames → high at 9818 ms / 589 frames; final high
1920×1080: start low → medium at 4829 ms / 290 frames → high at 9838 ms / 590 frames; final high
```

The forced-low start is a clean `setQualityTierForTesting('high')` then `setQualityTierForTesting('low')` (so `lastChangeMs`/streaks reset), followed by a 10 ms injected frame stream. The observed transition frames match the pinned cooldowns: low→medium needs 240 stable frames + 3000 ms / 10 ms = 300 frames (measured 289–290 including the first synthetic delta), medium→high needs 180 + 3000 ms = 300 more (measured 589–590 total). The live tier readout is the evidence; draw means stay ~192 (background-dominated) while the cursor visible set changes (13→15→19 at idle; see below).

### Scene, cursor and draw-count accounting

```text
SCENE: sceneChildren=10, totalObjects=147, worldObjects=11, ownBaseline=136,
       modelObjects=32, meshes=21, materials=19
TIER high:   hidden=[], visible meshes 19 at rest (2 ignitions hidden), trail visible only with pointer motion
TIER medium: hidden=[cursor-hull-seam-1, cursor-hull-seam-2, cursor-vent-left, cursor-vent-right]
TIER low:    hidden=[medium set + cursor-wing-left-tip, cursor-wing-right-tip]
TRAIL high while moving: visible=true, 16 point buffer, drawRange=8; medium: visible=false
```

- The scene baseline is **136** own objects (10 children; the online world adds 11 objects → 147). This matches T9's `countObjects(scene) === 136` + remote world. `scene.children` stays 9/10 because impact and targeting are children of the existing particle group.
- Cursor model: 32 objects (outer group + model root + 10 slot groups + 21 meshes), 21 meshes, 19 materials. High hidden set empty; medium hides the 4 detail meshes; low hides those + 2 wing tips. The pinned counts are **22/17/15 draw calls** (21 meshes + trail at high; 17/15 meshes at medium/low with no trail).
- **Net high-tier growth is +21 draws**: old cursor 7 → new cursor 22 (+15; 21 meshes + trail), impact +4 pools, targeting +2 lines; 19 materials (+12). This is pinned by T9's scene/quality tests and the spec/plan; the old-cursor 7-draw baseline is not buildable in this tree, so T14 records the new-side counts and the net accounting rather than re-running a pre-feature build.
- **GL prepass caveat:** measured total GL calls when hiding/showing the whole `spaceship` group with the pointer moving are **41.61 / 34.00 / 29.99** at high/medium/low. These are larger than 22/17/15 because the post-processing chain runs a RenderPass plus an SSAO normal/depth prepass; opaque meshes are drawn twice, while the transparent ignitions/trail contribute once. The tier deltas confirm the hidden sets: high→medium ≈7 GL calls (4 hidden opaque meshes across two passes + trail), medium→low ≈4 GL calls (2 hidden wing-tip meshes ×2 passes). The contract draw counts remain 22/17/15, and no regression is introduced.
- No per-frame allocation was added to the follow/shot/ignition/pick paths: T9's tests pin preallocated NDC/result storage (`picking.ts`), pooled impact drawables (no per-spawn geometry/material), and the one-raycast-per-frame hover path. T14 did not observe page exceptions or allocation errors in any trace run (`errors: []`).
- `npm run build` initial JS gzip **273.23 KB** (≤350 KB); no loader/URL/fetch import in `render/**`/`game/**`; all `three` imports named.

## Reference gate AC-46 and audio AC-45

`docs/features/spaceship-cursor-loot-animations/video-analysis.md` exists with provenance/metadata (24 fps, 10.0 s, 1280×720, H.264/AAC, 240 frames, true peak −1.6 dBFS), extraction commands, the `[O]`/`[E]` legend, observed timestamps, the §7 mapping table and §8.1/§9 historical markers. `reference/` contains **40 frame PNGs + 3 contact sheets (43 files, 15 MB)**; `contact-3-detail.jpg` covers the 1.042–1.667 s press/pop and 7.583–8.208 s banner/fly-by. No unobserved value is presented as observed; the absent lootbox/equip/upgrade/cursor beats are explicitly `[E]` with their nearest observed envelope.

| AC | Beat | Disposition | Shipped mapping |
| --- | --- | --- | --- |
| AC-35 | Target lock / reticle | `[O]` | 2 px outline, six 60° ticks, ≈250 ms dwell, 120 ms fade `[E]`; `targeting.ts`/`session.ts` + manual target-lock screenshots |
| AC-36 | Instant cube conceal | `[O]` | One-frame face removal; `MINI_CUBE_POP_MS=0`; same-frame zero scale |
| AC-37 | 12 rays / 10–14 shards / 4–6 coins | `[O]` | 12-ray fan / 14 shards / 6 coins / pooled impact; exact counts pinned by tests and `QUALITY_IMPACT_COUNTS` |
| AC-38 | 330 ms ring with 8 spokes + 4 satellites | `[O]` | 330 ms grow 1→5, 150 ms fade, 480 ms visible; one 394-vertex ring geometry/3 instances |
| AC-39 | `+0.50 Coins`, 0.7→1 scale, 45 px rise/220 ms, ≈1.1–1.2 s, max 3 | `[O]` | 1100 ms popup, 45 px/220 ms, max 3; measured 1057–1121 ms/1064–1139 ms |
| AC-40 | 760 ms level burst, 16 gold + 8 cyan rays, 3 rings, 12 stars/20 coins, banner 1.08 at 250 ms, 360° roll/700 ms trail, no shake | `[O]` | DOM burst counts, CSS 760/250/450/1600, ship fly-by 700 ms/1.2 orbit/16-point trail; frames + tests |
| AC-44 | No camera/HUD shake | `[O]` | computed styles none; camera equality tests |
| AC-45 | Audio onsets 1.292/1.35–1.40, 6.792/6.92/7.01, banner 7.87, −1.6 dBFS | `[O]` | `video-analysis.md` §4.11; metadata only, no audio shipped |
| AC-41 | Lootbox reveal | `[E]` (absent in video; nearest orb/banner envelope) | 420 charge + 250 orb overshoot + 120 flash + 360 reveal + 140 settle = 1290 ms; timing verified; T15 `0bfc524` fixed the card layout (306 px reveal/80 px orb/198 px card, fully visible) |
| AC-42 | Cursor ship/trail | `[E]` (video has OS arrow + static companion) | bank ±0.28/pitch ±0.18, 8-point/220 ms trail, 0.015/2600 idle, 260 ms/4 % pulse; tests + moving trail evidence |
| AC-43 | Equip/upgrade feedback | `[E]` (video has no equip/upgrade) | 260 ms row flash/4 % pulse; measured data-equipping 9–263 ms; upgrade pulse tests |

Audio alignment greps (AC-45): `video-analysis.md` lines 38/110/136–140/191/201/209/215/246–251 contain the true peak −1.6 dBFS, 1.292/1.35–1.40 pop alignment, 6.792/6.92/7.01 level alignment, 7.87 banner peak. No audio asset, dependency or playback code was added.

## Documentation AC-50 and proposed index row

```text
$ grep -n "granular spaceship parts" README.md
7:... draws one random part from the **granular spaceship parts** catalog — a single part for one **part slot** ...

$ grep -n "detailed blue/orange hero spaceship" README.md
9:... a detailed blue/orange hero spaceship ...

$ grep -n "part slot\|lootbox reveal\|motion token" docs/product/glossary.md
73:### lootbox reveal
83:### motion token
98:### part slot

$ git diff --exit-code f07d067...HEAD -- docs/features/README.md
INDEX_DIFF_EXIT=0

$ git status --porcelain -- docs/features/README.md
INDEX_STATUS_END
(no output)
```

README also states the view is generated procedurally with no external models/textures/images/videos/assets. T13's full evidence is in `build-log-T13.md`. `docs/features/README.md` is orchestrator-owned and was not edited; the proposed row (append after `detailed-hero-spaceship`, before the `States:` legend; the orchestrator sets the state/date on acceptance) is:

```diff
+| spaceship-cursor-loot-animations | Pointer Ship, Granular Loot Parts & Satisfying Animations (detailed procedural pointer ship, per-slot loot parts, shared motion language) | building | 2026-11-08 |
```

## Acceptance audit — AC-1…AC-52

| AC | Status | Evidence |
| --- | --- | --- |
| AC-1 | met | `cursor-ship.test.ts` (32 objects, 10 slots, 21 meshes, 19 materials, ≤2500 tris, no lights/textures/random, idempotent dispose); full frontend suite green |
| AC-2 | met | `cursor-ship.test.ts` exact 21-mesh list; scene traversal 21 meshes / 19 materials |
| AC-3 | met | `cursor-ship.test.ts`/`spaceship.test.ts` dimensions/rest pose/scale; 4-size manual captures |
| AC-4 | met | `cursor-ship.test.ts` PBR values/canopy/ignition/seams/vents/no assets; manual ship visible at 1280/1920/2560 |
| AC-5 | met | `spaceship.test.ts`/`scene-spaceship.test.ts` follow factor/target/rest; reduced snap |
| AC-6 | met | `spaceship.test.ts`/`scene-spaceship.test.ts` shot travel 180 ms/ignitions/flicker/reduced |
| AC-7 | met | `spaceship.test.ts`/`scene-spaceship.test.ts` per-slot apply, left/right isolation, no-op re-apply, outer identity |
| AC-8 | met | T14 high traces: 3/3 runs at 1280/1920 idle+clicks, avg 16.666/p95 ≤16.8; model 32/21/19; scene 136 own; bundle 273.23 KB gzip; no loader/URL |
| AC-9 | met | reduced A/B pixel-identical AE 0; hover static; no trail/ignitions/pulse; `spaceship.test.ts` |
| AC-10 | met | `parts-v2.test.ts` both workspaces (10 slots/order/names/rejections) |
| AC-11 | met | `parts-v2.test.ts` both workspaces (30 rows, 10/10/10, identical tables, `PART_CATALOG_VERSION=2`) |
| AC-12 | met | `parts-v2.test.ts`/`hub.test.ts`/`engine.test.ts` standard implicit ownership/defaults |
| AC-13 | met | `parts-v2.test.ts`/`hub.test.ts` one draw, weights 3/1, 75/25, 7.5/2.5, rng 0/0.999999/1 |
| AC-14 | met | `migration-006.test.ts`/`migrate.test.ts`/live PG T2 output; `schema.sql` `DEFAULT 2` |
| AC-15 | met | `migration-006.test.ts` exact rewrite/overflow/collisions/idempotent; T2 psql output; AC-33 fixture |
| AC-16 | met | `economy-repository.test.ts` (in-memory + real PG) defensive copy/zero state/normalize version-2 legacy row |
| AC-17 | met | `economy-repository.test.ts` atomic conditional open, duplicate, reason order, no negatives |
| AC-18 | met | `hub.test.ts` captured RNG, one grant, opener-only `lootboxOpened`, account `customizationUpdate`, seeded multi-open |
| AC-19 | met | `hub.test.ts` no_lootbox/no_key order, no writes/broadcast/grant |
| AC-20 | met | `hub.test.ts` per-member in-flight guard, release, concurrent tabs |
| AC-21 | met | `hub.test.ts`/`engine.test.ts` unknown/not_owned/defaults, server-derived target set, legacy two-slot exception |
| AC-22 | met | `hub.test.ts`/`economy-repository.test.ts` per-slot atomic equip/unequip, re-equip no-op, other slots untouched |
| AC-23 | met | `protocol.test.ts` both workspaces client union/codec |
| AC-24 | met | `protocol.test.ts` both workspaces `lootboxOpened` shape/fields/copy/error codes |
| AC-25 | met | `protocol.test.ts` parity fixture matrix both workspaces, no any |
| AC-26 | met | `hub.test.ts`/`session.test.ts`/`app.test.ts` account broadcast, opener-only, reconnect, guest no-op; smoke multi-client |
| AC-27 | met | `engine.test.ts`/`session.test.ts` guest open/equip/unequip/sequence/ephemeral |
| AC-28 | met | `hub.test.ts` full/partial legacy ownership; `parts-v2.test.ts` normalizers; `engine.test.ts` |
| AC-29 | met | `SpaceshipCustomizationPanel.test.tsx` counts/open/pending/10 rows/3 variants/controls; manual 10 slots ×3 |
| AC-30 | met | panel/CSS tests 44 px/focus/ARIA/max-height/scroll; manual 428 px panel at 1280 (≤60vh). The T15 layout guard keeps the reveal orb/card and its Equip/Dismiss controls fully visible (306 px reveal; measured at 1280/1920) |
| AC-31 | met | `preview.test.ts`/`SpaceshipPreview.test.tsx`; manual 303×153 label + 10 slot attrs at all four sizes (scrolled panel) |
| AC-32 | met | panel/App/engine/session tests; manual data-part/slot/rarity/duplicate/copy/sequence |
| AC-33 | met | migration/repo/hub/session tests; T2 exact fixture/restore; welcome/rejoin coverage |
| AC-34 | met | `motion.test.ts` exact tokens/easings; `game-view.css.test.ts` 13-token map/keyframes |
| AC-35 | met | `picking.test.ts`/`targeting.test.ts`/`session.test.ts`/`scene-spaceship.test.ts`; manual outline/reticle at 4 sizes |
| AC-36 | met | `effects.test.ts`/`cube-view.test.ts`/`world.test.ts`/`scene.test.ts`; manual same-frame conceal |
| AC-37 | met | `impact-effects.test.ts` 12/14/6/3 pools, lifetimes, recycling, orientation, reduced; manual burst |
| AC-38 | met | `impact-effects.test.ts` 330/150/480, 1→5, prebuilt ring, 3 pool; manual ring frames |
| AC-39 | met | `Hud.test.tsx`/`App.test.tsx` max 3/1100 ms/45 px/600 ms reduced/no HUD pulse; measured popup lifetime |
| AC-40 | met (production-reproduced after T16 `ba77801`) | `LevelCompleteBanner.test.tsx` counts/CSS; `spaceship.test.ts` roll/trail; T16 `scene-spaceship.test.ts` production `levelIndex`-rise trigger; T14 production run: one roll, max abs(rotation.z) 2π, max trail 16 at high, return to follow, reduced max abs(rotation.z) 0/trail 0; `t14-flyby-production-*.png`; no shake |
| AC-41 | met | T15 `0bfc524` fix verified: reveal 306 px, orb 80 px (100 px overshoot), card 198/183 px, fully visible at 1280/1920; timing 1290 pinned (1300–1310 measured with 5 ms poll + screenshot latency); copy/ARIA and reduced instant rest unchanged. Before-fix clipped values retained as historical evidence |
| AC-42 | met | `ship-motion.test.ts`/`spaceship.test.ts` bank/pitch/trail/idle/pulse/no recoil; moving trail high true/8 points; reduced zeros |
| AC-43 | met | panel `data-equipping` 9–263 ms (~254 ms vs 260 pinned); `UpgradesPanel.test.tsx` 260 ms; no coin HUD pulse; reduced skip |
| AC-44 | met | `scene.test.ts`/`App.test.tsx`/`game-view.css.test.ts`; live computed styles none for main/HUD/upgrades/customization |
| AC-45 | met | `video-analysis.md` §4.11 exact alignments/true peak −1.6 dBFS; no audio asset/code |
| AC-46 | met | 40 frames + 3 contact sheets (43 files, 15 MB), metadata, `[O]`/`[E]` mapping table; table above |
| AC-47 | met | high 3/3 at both sizes/workloads; medium/low forced traces stable and lower draw loads; recovery 289/290 + 589/590 frames; draw accounting; bundle 273.23; no per-frame allocation tests |
| AC-48 | met | reduced A/B AE 0; no rays/shards/coins; numeric coin; static preview; all reduced variants test-pinned; tier cannot re-enable |
| AC-49 | met | `npm run coverage` exit 0; backend 95.43/87.71/99.7/95.43; frontend 96.34/95.3/97.43/96.34 |
| AC-50 | met | README exact phrases/procedural statement; glossary `part slot`/`lootbox reveal`/`motion token`; `docs/features/README.md` unchanged vs `BASE`; proposed row above |
| AC-51 | met | container diff empty; protected paths clean; migration 006 only artifact; real `npm run smoke` 12/12 (not skipped) |
| AC-52 | met | `quality.test.ts` exact policy/matrix; scene hook start/end tiers; forced traces; recovery; reduced authority |

## Deviations and limitations

- **No source/test/CSS/config/container/backend edit was made by T14.** The AC-41 layout defect was found by the first T14 run and fixed by T15 `0bfc524`; this re-run verifies the fixed tree and records the before/after values. T15 is CSS/UI-only; T16 adds the levelIndex-rise trigger in `scene.ts` plus tests. Neither changes the render loop, quality policy, cursor/impact/targeting/bundle code, so the high/medium/low and recovery traces from the first run are reused; the build is 273.23 KB JS gzip (T16 +0.07 KB) and 5.24 KB CSS gzip.
- The medium/low frame columns use an injected 19 ms/21 ms frame-time stream (documented above) so the shipped policy stays in the intended tier; they are not wall-clock performance claims. High-tier columns are real `requestAnimationFrame` traces.
- The high-tier traces force high with the scene's test hook immediately before the trace; the policy is then allowed to run normally. All high runs report `tierStart=tierEnd=high` and no miss.
- The level banner DOM was queried after its 1600 ms hold (present=false, correctly); the visible banner/burst is captured in the screencast frames. Exact counts/timings are test-pinned.
- Screencast frame labels are capture timestamps; the exact event beats are test-pinned. The 1280/1920 effect frames show the same beats at slightly different capture offsets.
- The equip row flash was measured live (`data-equipping` 9–263 ms) but the granted row was below the recorded panel scroll window, so the flash is not centered in the screenshot; the attribute timing and CSS/panel tests are the primary evidence.
- Pre-existing modified feature docs (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `video-analysis.md`) and `reviews/` were not staged.

## Final status

**READY — all gates green.** The first T14 run found AC-41 blocked (reveal card clipped); T15 `0bfc524` fixed the panel layout. T16 `ba77801` fixed AC-40 (production fly-by trigger), and this final re-run verifies both: `.lootbox-reveal` 306 px, orb 80 px (100 px overshoot), card 198/183 px, fully visible at 1280×720 and 1920×1080; the 1290 ms timeline, copy/ARIA and reduced-motion instant result are unchanged. The full gate is green (lint, typecheck, backend 868 + frontend 1,700 tests, coverage, build 273.23 KB JS gzip / 5.24 KB CSS gzip, smoke 12/12, bundle/import, container diff, high-tier traces, forced recovery, docs, reference). No source/test/CSS/config/container/backend edits were made by this T14 re-run; only this build log and the fresh `t14-*.png` evidence are committed. Verified tree: `ba77801`; this docs-only evidence commit follows it.

## Proposed `docs/features/README.md` row (orchestrator applies on acceptance)

```diff
+| spaceship-cursor-loot-animations | Pointer Ship, Granular Loot Parts & Satisfying Animations (detailed procedural pointer ship, per-slot loot parts, shared motion language) | building | 2026-11-08 |
```

## Appendix — raw harness outputs

### `diagnostics.log` (scene / tier / cursor GL draw contribution; first T14 run)

```text
SCENE {"sceneChildren":10,"totalObjects":147,"worldObjects":11,"ownBaseline":136,"modelObjects":32,"meshes":21,"materials":19}
TIER {"tier":"high","meshes":21,"hidden":[],"trailVisible":false,"trailPoints":16,"tierCounts":null}
TIER {"tier":"medium","meshes":21,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right"],"trailVisible":false,"trailPoints":16,"tierCounts":null}
TIER {"tier":"low","meshes":21,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","cursor-wing-left-tip","cursor-wing-right-tip"],"trailVisible":false,"trailPoints":16,"tierCounts":null}
DRAW {"tier":"high","actual":"high","visible":{"n":72,"mean":257.42},"hidden":{"n":73,"mean":215.81},"cursorGlDraws":41.61}
DRAW {"tier":"medium","actual":"medium","visible":{"n":72,"mean":248.93},"hidden":{"n":72,"mean":214.93},"cursorGlDraws":34}
DRAW {"tier":"low","actual":"low","visible":{"n":72,"mean":244.93},"hidden":{"n":72,"mean":214.94},"cursorGlDraws":29.99}
FAILURES []
```

### `recovery-1280.log`

```text
TRANSITION {"from":"low","to":"medium","wallMs":4817,"frames":289,"drawMean":192}
TRANSITION {"from":"medium","to":"high","wallMs":9818,"frames":589,"drawMean":192}
{"width":1280,"height":720,"startTier":"low","finalTier":"high","wallMsEnd":12889,"transitions":[{"from":"low","to":"medium","wallMs":4817,"frames":289,"drawMean":192},{"from":"medium","to":"high","wallMs":9818,"frames":589,"drawMean":192}],"sampleCount":126,"samples":[{"wallMs":103,"tier":"low","frames":6,"drawMean":190},{"wallMs":618,"tier":"low","frames":37,"drawMean":190},{"wallMs":1132,"tier":"low","frames":68,"drawMean":189.27},{"wallMs":1641,"tier":"low","frames":98,"drawMean":189.53},{"wallMs":2154,"tier":"low","frames":129,"drawMean":191.33},{"wallMs":2667,"tier":"low","frames":160,"drawMean":192},{"wallMs":3175,"tier":"low","frames":190,"drawMean":192},{"wallMs":3687,"tier":"low","frames":221,"drawMean":192},{"wallMs":4201,"tier":"low","frames":252,"drawMean":192},{"wallMs":4715,"tier":"low","frames":283,"drawMean":192},{"wallMs":4817,"tier":"medium","frames":289,"drawMean":192},{"wallMs":5224,"tier":"medium","frames":313,"drawMean":192},{"wallMs":5734,"tier":"medium","frames":344,"drawMean":192},{"wallMs":6242,"tier":"medium","frames":374,"drawMean":192},{"wallMs":6752,"tier":"medium","frames":405,"drawMean":192},{"wallMs":7265,"tier":"medium","frames":436,"drawMean":192},{"wallMs":7772,"tier":"medium","frames":466,"drawMean":192},{"wallMs":8287,"tier":"medium","frames":497,"drawMean":192},{"wallMs":8799,"tier":"medium","frames":528,"drawMean":192},{"wallMs":9307,"tier":"medium","frames":558,"drawMean":192},{"wallMs":9818,"tier":"high","frames":589,"drawMean":192},{"wallMs":10332,"tier":"high","frames":620,"drawMean":192},{"wallMs":10841,"tier":"high","frames":650,"drawMean":192},{"wallMs":11354,"tier":"high","frames":681,"drawMean":192},{"wallMs":11867,"tier":"high","frames":712,"drawMean":192},{"wallMs":12374,"tier":"high","frames":742,"drawMean":192},{"wallMs":12886,"tier":"high","frames":773,"drawMean":192}]}
```

### `recovery-1920.log`

```text
TRANSITION {"from":"low","to":"medium","wallMs":4829,"frames":290,"drawMean":192}
TRANSITION {"from":"medium","to":"high","wallMs":9838,"frames":590,"drawMean":192}
{"width":1920,"height":1080,"startTier":"low","finalTier":"high","wallMsEnd":12919,"transitions":[{"from":"low","to":"medium","wallMs":4829,"frames":290,"drawMean":192},{"from":"medium","to":"high","wallMs":9838,"frames":590,"drawMean":192}],"sampleCount":126,"samples":[{"wallMs":102,"tier":"low","frames":6,"drawMean":190},{"wallMs":617,"tier":"low","frames":37,"drawMean":190},{"wallMs":1136,"tier":"low","frames":68,"drawMean":189.23},{"wallMs":1651,"tier":"low","frames":99,"drawMean":189.6},{"wallMs":2165,"tier":"low","frames":130,"drawMean":191.47},{"wallMs":2681,"tier":"low","frames":161,"drawMean":192},{"wallMs":3188,"tier":"low","frames":191,"drawMean":192},{"wallMs":3703,"tier":"low","frames":222,"drawMean":192},{"wallMs":4216,"tier":"low","frames":253,"drawMean":192},{"wallMs":4721,"tier":"low","frames":283,"drawMean":192},{"wallMs":4829,"tier":"medium","frames":290,"drawMean":192},{"wallMs":5236,"tier":"medium","frames":314,"drawMean":192},{"wallMs":5750,"tier":"medium","frames":345,"drawMean":192},{"wallMs":6262,"tier":"medium","frames":376,"drawMean":192},{"wallMs":6770,"tier":"medium","frames":406,"drawMean":192},{"wallMs":7282,"tier":"medium","frames":437,"drawMean":192},{"wallMs":7794,"tier":"medium","frames":468,"drawMean":192},{"wallMs":8302,"tier":"medium","frames":498,"drawMean":192},{"wallMs":8815,"tier":"medium","frames":529,"drawMean":192},{"wallMs":9329,"tier":"medium","frames":560,"drawMean":192},{"wallMs":9838,"tier":"high","frames":590,"drawMean":192},{"wallMs":10354,"tier":"high","frames":621,"drawMean":192},{"wallMs":10866,"tier":"high","frames":652,"drawMean":192},{"wallMs":11378,"tier":"high","frames":683,"drawMean":192},{"wallMs":11887,"tier":"high","frames":713,"drawMean":192},{"wallMs":12401,"tier":"high","frames":744,"drawMean":192},{"wallMs":12916,"tier":"high","frames":775,"drawMean":192}]}
```

### `perf-1280.log` (18 matrix runs; high/medium/low × idle/clicks × 3; reused)

```text
{"tier":"high","workload":"idle","width":1280,"height":720,"run":1,"tierStart":"high","tierEnd":"high","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":16.666,"p50":16.7,"p95":16.7,"min":16.5,"max":16.8},"drawMean":191.91,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":19,"hidden":["ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"high","workload":"idle","width":1280,"height":720,"run":2,"tierStart":"high","tierEnd":"high","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":16.666,"p50":16.7,"p95":16.8,"min":16.5,"max":16.8},"drawMean":191.91,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":19,"hidden":["ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"high","workload":"idle","width":1280,"height":720,"run":3,"tierStart":"high","tierEnd":"high","frames":598,"wallMs":10000,"frameStats":{"n":598,"avg":16.666,"p50":16.7,"p95":16.8,"min":16.5,"max":16.8},"drawMean":191.91,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":19,"hidden":["ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"high","workload":"clicks","width":1280,"height":720,"run":1,"tierStart":"high","tierEnd":"high","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":16.666,"p50":16.7,"p95":16.7,"min":16.5,"max":16.8},"drawMean":242.72,"drawMin":191,"drawMax":251,"clicksDispatched":0,"hudClicks":"75","hudCoins":"7.50","model":{"meshes":21,"visible":19,"hidden":["ignition","ignition"],"objects":32,"trail":true},"errors":[]}
{"tier":"high","workload":"clicks","width":1280,"height":720,"run":2,"tierStart":"high","tierEnd":"high","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":16.666,"p50":16.7,"p95":16.8,"min":16.5,"max":16.8},"drawMean":242.46,"drawMin":191,"drawMax":251,"clicksDispatched":0,"hudClicks":"75","hudCoins":"7.50","model":{"meshes":21,"visible":19,"hidden":["ignition","ignition"],"objects":32,"trail":true},"errors":[]}
{"tier":"high","workload":"clicks","width":1280,"height":720,"run":3,"tierStart":"high","tierEnd":"high","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":16.666,"p50":16.7,"p95":16.7,"min":16.5,"max":16.8},"drawMean":233.84,"drawMin":191,"drawMax":251,"clicksDispatched":0,"hudClicks":"50","hudCoins":"5.00","model":{"meshes":21,"visible":21,"hidden":[],"objects":32,"trail":true},"errors":[]}
{"tier":"medium","workload":"idle","width":1280,"height":720,"run":1,"tierStart":"medium","tierEnd":"medium","frames":598,"wallMs":10000,"frameStats":{"n":598,"avg":19,"p50":19,"p95":19,"min":19,"max":19},"drawMean":191.97,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":15,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"medium","workload":"idle","width":1280,"height":720,"run":2,"tierStart":"medium","tierEnd":"medium","frames":598,"wallMs":10000,"frameStats":{"n":598,"avg":19,"p50":19,"p95":19,"min":19,"max":19},"drawMean":191.97,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":15,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"medium","workload":"idle","width":1280,"height":720,"run":3,"tierStart":"medium","tierEnd":"medium","frames":598,"wallMs":10000,"frameStats":{"n":598,"avg":19,"p50":19,"p95":19,"min":19,"max":19},"drawMean":191.97,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":15,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"medium","workload":"clicks","width":1280,"height":720,"run":1,"tierStart":"medium","tierEnd":"medium","frames":598,"wallMs":10000,"frameStats":{"n":598,"avg":19,"p50":19,"p95":19,"min":19,"max":19},"drawMean":223.92,"drawMin":189,"drawMax":241,"clicksDispatched":0,"hudClicks":"50","hudCoins":"5.00","model":{"meshes":21,"visible":17,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right"],"objects":32,"trail":false},"errors":[]}
{"tier":"medium","workload":"clicks","width":1280,"height":720,"run":2,"tierStart":"medium","tierEnd":"medium","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":19,"p50":19,"p95":19,"min":19,"max":19},"drawMean":234.12,"drawMin":189,"drawMax":241,"clicksDispatched":0,"hudClicks":"80","hudCoins":"8.00","model":{"meshes":21,"visible":17,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right"],"objects":32,"trail":false},"errors":[]}
{"tier":"medium","workload":"clicks","width":1280,"height":720,"run":3,"tierStart":"medium","tierEnd":"medium","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":19,"p50":19,"p95":19,"min":19,"max":19},"drawMean":234.32,"drawMin":189,"drawMax":241,"clicksDispatched":0,"hudClicks":"80","hudCoins":"8.00","model":{"meshes":21,"visible":17,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right"],"objects":32,"trail":false},"errors":[]}
{"tier":"low","workload":"idle","width":1280,"height":720,"run":1,"tierStart":"low","tierEnd":"low","frames":598,"wallMs":10000,"frameStats":{"n":598,"avg":21,"p50":21,"p95":21,"min":21,"max":21},"drawMean":191.99,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":13,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","cursor-wing-left-tip","cursor-wing-right-tip","ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"low","workload":"idle","width":1280,"height":720,"run":2,"tierStart":"low","tierEnd":"low","frames":598,"wallMs":10000,"frameStats":{"n":598,"avg":21,"p50":21,"p95":21,"min":21,"max":21},"drawMean":191.99,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":13,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","cursor-wing-left-tip","cursor-wing-right-tip","ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"low","workload":"idle","width":1280,"height":720,"run":3,"tierStart":"low","tierEnd":"low","frames":598,"wallMs":10000,"frameStats":{"n":598,"avg":21,"p50":21,"p95":21,"min":21,"max":21},"drawMean":191.99,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":13,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","cursor-wing-left-tip","cursor-wing-right-tip","ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"low","workload":"clicks","width":1280,"height":720,"run":1,"tierStart":"low","tierEnd":"low","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":21,"p50":21,"p95":21,"min":21,"max":21},"drawMean":214.01,"drawMin":189,"drawMax":230,"clicksDispatched":0,"hudClicks":"50","hudCoins":"5.00","model":{"meshes":21,"visible":15,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","cursor-wing-left-tip","cursor-wing-right-tip"],"objects":32,"trail":false},"errors":[]}
{"tier":"low","workload":"clicks","width":1280,"height":720,"run":2,"tierStart":"low","tierEnd":"low","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":21,"p50":21,"p95":21,"min":21,"max":21},"drawMean":225.45,"drawMin":189,"drawMax":230,"clicksDispatched":0,"hudClicks":"90","hudCoins":"9.00","model":{"meshes":21,"visible":15,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","cursor-wing-left-tip","cursor-wing-right-tip"],"objects":32,"trail":false},"errors":[]}
{"tier":"low","workload":"clicks","width":1280,"height":720,"run":3,"tierStart":"low","tierEnd":"low","frames":598,"wallMs":10000,"frameStats":{"n":598,"avg":21,"p50":21,"p95":21,"min":21,"max":21},"drawMean":225.62,"drawMin":189,"drawMax":230,"clicksDispatched":0,"hudClicks":"90","hudCoins":"9.00","model":{"meshes":21,"visible":15,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","cursor-wing-left-tip","cursor-wing-right-tip"],"objects":32,"trail":false},"errors":[]}
PERF1280_EXIT=0
```

### `perf-1920.log` (18 matrix runs; reused)

```text
{"tier":"high","workload":"idle","width":1920,"height":1080,"run":1,"tierStart":"high","tierEnd":"high","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":16.666,"p50":16.7,"p95":16.8,"min":16.5,"max":16.8},"drawMean":191.92,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":19,"hidden":["ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"high","workload":"idle","width":1920,"height":1080,"run":2,"tierStart":"high","tierEnd":"high","frames":598,"wallMs":10000,"frameStats":{"n":598,"avg":16.666,"p50":16.7,"p95":16.8,"min":16.5,"max":16.8},"drawMean":191.92,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":19,"hidden":["ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"high","workload":"idle","width":1920,"height":1080,"run":3,"tierStart":"high","tierEnd":"high","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":16.666,"p50":16.7,"p95":16.8,"min":16.5,"max":16.8},"drawMean":191.91,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":19,"hidden":["ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"high","workload":"clicks","width":1920,"height":1080,"run":1,"tierStart":"high","tierEnd":"high","frames":600,"wallMs":10000,"frameStats":{"n":600,"avg":16.666,"p50":16.7,"p95":16.7,"min":16.5,"max":16.8},"drawMean":242.7,"drawMin":188,"drawMax":251,"clicksDispatched":0,"hudClicks":"75","hudCoins":"7.50","model":{"meshes":21,"visible":19,"hidden":["ignition","ignition"],"objects":32,"trail":true},"errors":[]}
{"tier":"high","workload":"clicks","width":1920,"height":1080,"run":2,"tierStart":"high","tierEnd":"high","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":16.666,"p50":16.7,"p95":16.8,"min":16.5,"max":16.8},"drawMean":246.37,"drawMin":191,"drawMax":251,"clicksDispatched":0,"hudClicks":"89","hudCoins":"8.90","model":{"meshes":21,"visible":21,"hidden":[],"objects":32,"trail":true},"errors":[]}
{"tier":"high","workload":"clicks","width":1920,"height":1080,"run":3,"tierStart":"high","tierEnd":"high","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":16.666,"p50":16.7,"p95":16.7,"min":16.5,"max":16.8},"drawMean":239.22,"drawMin":191,"drawMax":251,"clicksDispatched":0,"hudClicks":"64","hudCoins":"6.40","model":{"meshes":21,"visible":19,"hidden":["ignition","ignition"],"objects":32,"trail":true},"errors":[]}
{"tier":"medium","workload":"idle","width":1920,"height":1080,"run":1,"tierStart":"medium","tierEnd":"medium","frames":598,"wallMs":10000,"frameStats":{"n":598,"avg":19,"p50":19,"p95":19,"min":19,"max":19},"drawMean":192,"drawMin":192,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":15,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"medium","workload":"idle","width":1920,"height":1080,"run":2,"tierStart":"medium","tierEnd":"medium","frames":598,"wallMs":10000,"frameStats":{"n":598,"avg":19,"p50":19,"p95":19,"min":19,"max":19},"drawMean":191.97,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":15,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"medium","workload":"idle","width":1920,"height":1080,"run":3,"tierStart":"medium","tierEnd":"medium","frames":598,"wallMs":10000,"frameStats":{"n":598,"avg":19,"p50":19,"p95":19,"min":19,"max":19},"drawMean":191.97,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":15,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"medium","workload":"clicks","width":1920,"height":1080,"run":1,"tierStart":"medium","tierEnd":"medium","frames":598,"wallMs":10000,"frameStats":{"n":598,"avg":19,"p50":19,"p95":19,"min":19,"max":19},"drawMean":234.28,"drawMin":189,"drawMax":241,"clicksDispatched":0,"hudClicks":"80","hudCoins":"8.00","model":{"meshes":21,"visible":17,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right"],"objects":32,"trail":false},"errors":[]}
{"tier":"medium","workload":"clicks","width":1920,"height":1080,"run":2,"tierStart":"medium","tierEnd":"medium","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":19,"p50":19,"p95":19,"min":19,"max":19},"drawMean":236.34,"drawMin":189,"drawMax":241,"clicksDispatched":0,"hudClicks":"89","hudCoins":"8.90","model":{"meshes":21,"visible":17,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right"],"objects":32,"trail":false},"errors":[]}
{"tier":"medium","workload":"clicks","width":1920,"height":1080,"run":3,"tierStart":"medium","tierEnd":"medium","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":19,"p50":19,"p95":19,"min":19,"max":19},"drawMean":232.67,"drawMin":189,"drawMax":241,"clicksDispatched":0,"hudClicks":"75","hudCoins":"7.50","model":{"meshes":21,"visible":15,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"low","workload":"idle","width":1920,"height":1080,"run":1,"tierStart":"low","tierEnd":"low","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":21,"p50":21,"p95":21,"min":21,"max":21},"drawMean":191.99,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":13,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","cursor-wing-left-tip","cursor-wing-right-tip","ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"low","workload":"idle","width":1920,"height":1080,"run":2,"tierStart":"low","tierEnd":"low","frames":598,"wallMs":10000,"frameStats":{"n":598,"avg":21,"p50":21,"p95":21,"min":21,"max":21},"drawMean":191.99,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":13,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","cursor-wing-left-tip","cursor-wing-right-tip","ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"low","workload":"idle","width":1920,"height":1080,"run":3,"tierStart":"low","tierEnd":"low","frames":598,"wallMs":10000,"frameStats":{"n":598,"avg":21,"p50":21,"p95":21,"min":21,"max":21},"drawMean":191.99,"drawMin":188,"drawMax":192,"hudClicks":"0","hudCoins":"0.00","model":{"meshes":21,"visible":13,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","cursor-wing-left-tip","cursor-wing-right-tip","ignition","ignition"],"objects":32,"trail":false},"errors":[]}
{"tier":"low","workload":"clicks","width":1920,"height":1080,"run":1,"tierStart":"low","tierEnd":"low","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":21,"p50":21,"p95":21,"min":21,"max":21},"drawMean":223.65,"drawMin":189,"drawMax":230,"clicksDispatched":0,"hudClicks":"80","hudCoins":"8.00","model":{"meshes":21,"visible":15,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","cursor-wing-left-tip","cursor-wing-right-tip"],"objects":32,"trail":false},"errors":[]}
{"tier":"low","workload":"clicks","width":1920,"height":1080,"run":2,"tierStart":"low","tierEnd":"low","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":21,"p50":21,"p95":21,"min":21,"max":21},"drawMean":213.94,"drawMin":189,"drawMax":230,"clicksDispatched":0,"hudClicks":"50","hudCoins":"5.00","model":{"meshes":21,"visible":15,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","cursor-wing-left-tip","cursor-wing-right-tip"],"objects":32,"trail":false},"errors":[]}
{"tier":"low","workload":"clicks","width":1920,"height":1080,"run":3,"tierStart":"low","tierEnd":"low","frames":599,"wallMs":10000,"frameStats":{"n":599,"avg":21,"p50":21,"p95":21,"min":21,"max":21},"drawMean":214.04,"drawMin":189,"drawMax":230,"clicksDispatched":0,"hudClicks":"50","hudCoins":"5.00","model":{"meshes":21,"visible":15,"hidden":["cursor-hull-seam-1","cursor-hull-seam-2","cursor-vent-left","cursor-vent-right","cursor-wing-left-tip","cursor-wing-right-tip"],"objects":32,"trail":false},"errors":[]}
PERF1920_EXIT=0
```
