# Build log — T4 — Final verification and pre-review bookkeeping

Task: T4 (2026-11-12)
Files changed: this log; no application, test, container, dependency, agent, skill, or policy file touched. `commits_also`: `docs/features/agent-skill-migration/{spec.md,plan.md,tasks.md,status.md}`, `docs/features/agent-skill-migration/reviews/**`, and the T3 orchestrator edit to `docs/features/README.md` — staged/committed without edit.
What changed & why: read `BASE_SHA`/`INDEX_BASE_SHA`, ran the T3 feature-index row check, re-ran the T1 and T2 pinned verification blocks verbatim, ran the full gate battery (`lint`, `typecheck`, `test`, `coverage`, `build`), the `BASE_SHA..HEAD` no-runtime-diff guard, and the repaired-paths clean check; recorded all raw output here; then made the two pinned bookkeeping commits (content + evidence). The optional `opencode run` skill-load smoke was attempted, is unavailable (provider quota 402), and is recorded as supplementary; static resolution remains authoritative (AC-13).
Decisions: two-commit shape exactly as `tasks.md` T4 pins (content/bookkeeping, then the evidence-log commit); the builder cannot edit `status.md`/`README.md`/`spec.md`/`plan.md`/`tasks.md`/`reviews/**` (edit allow-list grants only `docs/features/**/build-log*.md`), so those are staged as authored; `T4_EVIDENCE_SHA` and the evidence-commit stat are recorded in the Subagent Report and the requested `status.md` loop-log entry rather than a third commit, keeping the pinned two-commit sequence and the AC-14 clean-tree invariant.

## Inputs and baseline

```text
$ git rev-parse HEAD   # pre-T4 HEAD = T2 evidence commit
6faf3b426665aa9e511b596329f1c2ee1e0b15ba

$ git log --oneline -1
6faf3b4 docs: agent-skill-migration T2 evidence

$ sed -n 's/^BASE_SHA=//p' docs/features/agent-skill-migration/build-log-T1.md | tail -1
58012947f8fde800f957f186291898db4401aacb

$ sed -n 's/^INDEX_BASE_SHA=//p' docs/features/agent-skill-migration/build-log-T2.md | tail -1
4a63b1e6582057ba94689213d56099691d08f977

$ git status --porcelain   # before any T4 action
 M docs/features/README.md
?? docs/features/agent-skill-migration/plan.md
?? docs/features/agent-skill-migration/reviews/
?? docs/features/agent-skill-migration/spec.md
?? docs/features/agent-skill-migration/status.md
?? docs/features/agent-skill-migration/tasks.md
```

`docs/features/README.md` carries only the T3 orchestrator edit; the untracked feature artifacts are the planner/reviewer/orchestrator authored files that T4 stages/commits without editing.

## T3 row check (pinned: `tasks.md` T4, lines 292–335)

```text
$ BASE_SHA=$(sed -n 's/^BASE_SHA=//p' docs/features/agent-skill-migration/build-log-T1.md | tail -1)
$ INDEX_BASE_SHA=$(sed -n 's/^INDEX_BASE_SHA=//p' docs/features/agent-skill-migration/build-log-T2.md | tail -1)
$ export BASE_SHA INDEX_BASE_SHA
$ node -e '<pinned T3 row check: exact rows, status-derived dates, anchor positions, additive-only diff vs INDEX_BASE_SHA>'
feature index OK: exact rows, dates from loop logs, chronological, additive-only diff
[exit 0]
```

The T3 edit itself (supplementary view; the pinned check above asserts exactly this):

```text
$ git diff -- docs/features/README.md
diff --git a/docs/features/README.md b/docs/features/README.md
index 002b675..a0ef557 100644
--- a/docs/features/README.md
+++ b/docs/features/README.md
@@ -25,11 +25,14 @@ Feature work runs through the agent workflow (see `AGENTS.md`). Every feature li
 | spaceship-cursor | Spaceship Cursor (3D spaceship follows cursor, shoots mini-cubes on explosion) | accepted | 2026-10-27 |
 | spaceship-cursor-polish | Spaceship Cursor Polish (farther diagonal, larger bullet ship, more delay, ignition fire) | accepted | 2026-10-27 |
 | spaceship-cursor-refinement | Spaceship Cursor Refinement (smaller ship, shifted left) | accepted | 2026-10-27 |
+| coin-economy | Coin Economy (coins from destroyed cubes, speed bonus, persistent per-user stats) | building | 2026-10-30 |
 | modern-visual-overhaul | Modern Visual Overhaul (bright starfield, shadows, fighter ship, animated HUD) | accepted | 2026-10-28 |
 | modern-ui-background-life | Modern UI & Background Life (border light, HUD blink, shooting stars, spaceships) | accepted | 2026-10-28 |
 | futuristic-hud-blue | Futuristic HUD Blue (blue technologic HUD styling) | accepted | 2026-10-28 |
 | metallic-hud-frames | Metallic HUD Frames (beveled metal frames, cyan glow) | accepted | 2026-10-28 |
 | metallic-hud-frames-polish | Metallic HUD Frames Polish (trailing newline, mask guard) | accepted | 2026-10-28 |
+| spending-upgrades | Spending & Upgrades (spend coins on upgrades to earn faster) | accepted | 2026-10-30 |
+| idle-accrual | Idle Accrual (coins accrue while away for accounts) | accepted | 2026-10-30 |
 | aws-deploy-pipeline | AWS Deploy Pipeline (Terraform infrastructure + GitHub Actions CI/CD + framework proof-of-working) | accepted | 2026-10-31 |
 | manual-deploy-trigger | Manual Deploy Trigger (manual `workflow_dispatch` deploy; automatic deploy deferred while only `production` exists) | accepted | 2026-11-01 |
 | workflow-hygiene | Workflow Hygiene (trailing newline in CI/CD workflows + scoped credential-audit command) | accepted | 2026-11-01 |
```

The T3 README edit is consistent with the rows recorded in `build-log-T2.md`; no `blocked` condition.

## T1 pinned verification re-run (verbatim: `tasks.md` T1, lines 22–92)

All blocks below are the T1 verify scripts re-run against the T3-edited tree; no commit command was re-run.

```text
########## T1 verification blocks (verbatim pin: tasks.md T1) ##########
--- git ls-files .opencode/skills | wc -l ---
18
[exit 0]
--- git ls-files "*.opencode/skills/*/SKILL.md" | wc -l ---
6
[exit 0]
--- git diff --exit-code HEAD -- .opencode/skills ---
[exit 0]
--- test -z "$(git status --porcelain -- .opencode/skills)" ---
[exit 0]
--- find .agents/skills -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l ---
31
[exit 0]
--- lockfile/ID script (tasks.md:28-54) ---
31 lockfile IDs match 31 directories; 13 pre-existing entries unchanged
[exit 0]
--- git diff --numstat "$BASE_SHA" -- skills-lock.json ---
108	0	skills-lock.json
--- additive awk gate (tasks.md:53) ---
[exit 0]
--- credential scan (tasks.md:56-87) ---
credential scan clean: no .env files, private keys, or credential patterns
[exit 0]
--- git add .agents/skills skills-lock.json (no-op; already committed) ---
[exit 0]
--- test -z "$(git diff --cached --name-status "$BASE_SHA" -- .agents/skills | grep -v "^A")" ---
[exit 0]
--- test -z "$(git status --porcelain -- .opencode/skills .agents/skills skills-lock.json)" ---
[exit 0]
--- staged index file count after the no-op add ---
0
```

## T2 pinned verification re-run (verbatim: `tasks.md` T2, lines 103–259)

```text
########## T2 verification blocks (verbatim pin: tasks.md T2) ##########
--- allow-list rule-order/effect check (tasks.md:103-149) ---
allow-lists OK: exact rule sequence plus last-match semantics for all known IDs
[exit 0]
--- non-skill permission guard (tasks.md:151-180) ---
non-skill permissions unchanged from BASE_SHA for all four agents
[exit 0]
--- inventory/disposition check (tasks.md:182-234) ---
skills inventory/disposition OK: 31 inventory rows, 14 disposition rows with reasons
[exit 0]
--- nine-section check (tasks.md:236-241; expect no output) ---
[exit 0]
--- AC-8 scoped checks (tasks.md:243-251) ---
31:- `.opencode/` — agents, commands, and the six project pipeline skills in `.opencode/skills/` (the AI team)
51:- Skills: project pipeline skills live in `.opencode/skills/` (binding, higher precedence); imported packs live in `.agents/skills/` (advisory, installer-managed with `skills-lock.json`). Per-agent allow-lists, precedence, and pack dispositions are documented in `docs/architecture/skills.md`.
[grep exit 0]
32:- `.agents/skills/` — 31 imported third-party skill packs (advisory), tracked with `skills-lock.json`
51:- Skills: project pipeline skills live in `.opencode/skills/` (binding, higher precedence); imported packs live in `.agents/skills/` (advisory, installer-managed with `skills-lock.json`). Per-agent allow-lists, precedence, and pack dispositions are documented in `docs/architecture/skills.md`.
[grep exit 0]
51:- Skills: project pipeline skills live in `.opencode/skills/` (binding, higher precedence); imported packs live in `.agents/skills/` (advisory, installer-managed with `skills-lock.json`). Per-agent allow-lists, precedence, and pack dispositions are documented in `docs/architecture/skills.md`.
[grep exit 0]
43:- Link to the glossary: [glossary](../product/glossary.md). Link to the vision: [vision](../product/vision.md). Link to the containerization reference: [containerization](containerization.md). Link to the stack reference: [stack](stack.md). Link to the skills policy: `docs/architecture/skills.md`.
[grep exit 0]
[test -f exit 0]
6:- `docs/architecture/skills.md` — skill locations (`.opencode/skills/` and `.agents/skills/`), per-agent allow-lists, imported-pack dispositions, and the binding-vs-advisory policy
[awk|grep exit 0]
--- duplicate-ID and live-path checks (tasks.md:253-259) ---
[comm exit 0]
[live-path loop exit 0]
```

F3-r3 carry (supplementary cross-check; `tasks.md` T2 log recorded the same loop):

```text
########## F3-r3 cross-check (supplementary: every allow-listed ID resolves) ##########
every allow-listed ID resolves to exactly one SKILL.md (F3-r3 cross-check)
[exit 0]
```

## Regression battery (AC-12)

### `npm run lint`

```text

> lint
> eslint .

[exit 0]
```

### `npm run typecheck`

```text

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

[exit 0]
```

### `npm test`

```text

> test
> npm run test --workspaces --if-present


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/game/config.test.ts (13 tests) 6ms
 ✓ src/game/upgrades.test.ts (20 tests) 9ms
 ✓ src/auth/user-repository.test.ts (40 tests) 11ms
 ✓ src/game/cubes.test.ts (24 tests) 12ms
 ✓ src/auth/rate-limit.test.ts (16 tests) 4ms
 ✓ src/auth/config.test.ts (25 tests) 13ms
 ✓ src/db/migrate.test.ts (11 tests) 17ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 15ms
 ✓ src/db/pool.test.ts (10 tests) 4ms
 ✓ src/game/parts.test.ts (19 tests) 11ms
 ✓ src/auth/session-repository.test.ts (35 tests) 12ms
 ✓ src/game/economy.test.ts (20 tests) 4ms
 ✓ src/game/parts-v2.test.ts (40 tests) 19ms
 ✓ src/game/players.test.ts (13 tests) 10ms
 ✓ src/game/servers.test.ts (38 tests) 9ms
 ✓ src/auth/email.test.ts (12 tests) 15ms
 ✓ src/game/protocol.test.ts (166 tests) 16ms
 ✓ src/game/hub.test.ts (93 tests) 116ms
 ✓ src/auth/password.test.ts (17 tests) 348ms
 ✓ src/auth/auth-routes.test.ts (25 tests) 744ms
 ✓ src/auth/auth-service.test.ts (50 tests) 889ms
 ✓ src/app.test.ts (22 tests) 1730ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1035ms
 ✓ src/db/migration-006.test.ts (13 tests) 2217ms
 ✓ src/auth/economy-repository.test.ts (102 tests) 2169ms

 Test Files  24 passed (24)
      Tests  868 passed (868)
   Start at  16:48:11
   Duration  2.85s (transform 2.03s, setup 0ms, collect 5.79s, tests 8.40s, environment 4ms, prepare 2.12s)


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/game-view.css.test.ts (42 tests) 16ms
 ✓ src/render/webgl.test.ts (17 tests) 9ms
 ✓ src/auth/store.test.ts (31 tests) 22ms
 ✓ src/ui/app.css.test.ts (87 tests) 23ms
 ✓ src/game/parts-v2.test.ts (50 tests) 22ms
 ✓ src/multiplayer/protocol.test.ts (236 tests) 21ms
 ✓ src/render/quality.test.ts (24 tests) 63ms
 ✓ src/render/background-life.test.ts (14 tests) 13ms
 ✓ src/game/board.test.ts (18 tests) 20ms
 ✓ src/render/impact-effects.test.ts (22 tests) 33ms
 ✓ src/render/particles.test.ts (24 tests) 22ms
 ✓ src/render/preview.test.ts (7 tests) 37ms
 ✓ src/ui/icons.test.tsx (16 tests) 25ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 12ms
 ✓ src/render/cursor-ship.test.ts (34 tests) 117ms
 ✓ src/render/starfield.test.ts (28 tests) 99ms
 ✓ src/render/picking.test.ts (16 tests) 84ms
 ✓ src/render/targeting.test.ts (11 tests) 60ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 143ms
 ✓ src/input/gestures.test.ts (27 tests) 43ms
 ✓ src/game/engine.test.ts (113 tests) 91ms
 ✓ src/render/cube-view.test.ts (37 tests) 164ms
 ✓ src/render/spaceship.test.ts (40 tests) 138ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 221ms
 ✓ src/game/motion.test.ts (12 tests) 8ms
 ✓ src/render/world.test.ts (27 tests) 187ms
 ✓ src/auth/api.test.ts (28 tests) 17ms
 ✓ src/game/progression.test.ts (21 tests) 11ms
 ✓ src/ui/theme.test.ts (11 tests) 7ms
 ✓ src/render/postprocessing.test.ts (10 tests) 12ms
 ✓ src/browser-env.test.ts (6 tests) 16ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 12ms
 ✓ src/game/economy.test.ts (7 tests) 4ms
 ✓ src/ws/connection.test.ts (10 tests) 20ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 19ms
 ✓ src/game/effects.test.ts (30 tests) 21ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 25ms
 ✓ src/game/parts.test.ts (23 tests) 15ms
 ✓ src/game/upgrades.test.ts (20 tests) 8ms
 ✓ src/render/scene-effects.test.ts (9 tests) 222ms
 ✓ src/game/rotation.test.ts (15 tests) 9ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 35ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 8ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 14ms
 ✓ src/docs/links.test.ts (1 test) 6ms
 ✓ src/render/nebula.test.ts (11 tests) 502ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  404ms
 ✓ src/render/ship-motion.test.ts (24 tests) 11ms
 ✓ src/input/keyboard.test.ts (13 tests) 16ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 11ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 4ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 221ms
 ✓ src/render/scene-spaceship.test.ts (28 tests) 520ms
 ✓ src/ui/LevelCompleteBanner.test.tsx (6 tests) 83ms
 ✓ src/render/scene.test.ts (85 tests) 1129ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > renders exactly ten slot rows in SLOT_CATALOG order with the section contract
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 192ms
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

 ✓ src/ui/UpgradesPanel.test.tsx (12 tests) 261ms
 ✓ src/ui/SpaceshipPreview.test.tsx (12 tests) 77ms
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

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-29) > keeps the pre-v2 onOpen alias working
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/Hud.test.tsx (20 tests) 204ms
 ✓ src/ui/AuthMenu.test.tsx (19 tests) 399ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > renders the rare/new grant region with the pinned data attributes and copy
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 226ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > renders the epic/duplicate copy and the wireframe orb with an orange core
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > advances through the exact 420 + 250 + 120 + 360 + 140 ms timeline
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/game/session.test.ts (81 tests) 1322ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > keeps the reveal, orb and card non-shrinking and fully visible at the reveal phase
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App > drives data-customization-open from the customization toggle (AC-7, AC-18)
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

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel equip-row flash (AC-43) > sets data-equipping on the equipped slot for exactly 260 ms
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel equip-row flash (AC-43) > adds no row flash under reduced motion
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (28 tests) 556ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 845ms
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

 ✓ src/App.test.tsx (38 tests) 713ms

 Test Files  64 passed (64)
      Tests  1738 passed (1738)
   Start at  16:48:14
   Duration  3.05s (transform 7.77s, setup 0ms, collect 20.66s, tests 9.47s, environment 5.29s, prepare 5.31s)

[exit 0]
```

Note: the repeated `HTMLCanvasElement`/`THREE.WebGLRenderer` stderr lines in `SpaceshipCustomizationPanel.test.tsx`/`App.test.tsx` are pre-existing jsdom/WebGL environment warnings; all 24 backend and 64 frontend test files passed in both `npm test` and `npm run coverage`.

### `npm run coverage` (thresholds ≥ 80 per workspace)

```text

> coverage
> npm run coverage --workspaces --if-present


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/upgrades.test.ts (20 tests) 7ms
 ✓ src/game/economy.test.ts (20 tests) 7ms
 ✓ src/db/migrate.test.ts (11 tests) 10ms
 ✓ src/game/parts-v2.test.ts (40 tests) 23ms
 ✓ src/auth/rate-limit.test.ts (16 tests) 6ms
 ✓ src/game/config.test.ts (13 tests) 9ms
 ✓ src/auth/user-repository.test.ts (40 tests) 18ms
 ✓ src/auth/session-repository.test.ts (35 tests) 14ms
 ✓ src/game/parts.test.ts (19 tests) 8ms
 ✓ src/auth/config.test.ts (25 tests) 8ms
 ✓ src/db/pool.test.ts (10 tests) 8ms
 ✓ src/game/cubes.test.ts (24 tests) 13ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 23ms
 ✓ src/auth/email.test.ts (12 tests) 10ms
 ✓ src/game/players.test.ts (13 tests) 9ms
 ✓ src/game/servers.test.ts (38 tests) 17ms
 ✓ src/game/protocol.test.ts (166 tests) 21ms
 ✓ src/game/hub.test.ts (93 tests) 118ms
 ✓ src/auth/password.test.ts (17 tests) 347ms
 ✓ src/auth/auth-routes.test.ts (25 tests) 673ms
 ✓ src/auth/auth-service.test.ts (50 tests) 972ms
 ✓ src/app.test.ts (22 tests) 1767ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1035ms
 ✓ src/auth/economy-repository.test.ts (102 tests) 2164ms
 ✓ src/db/migration-006.test.ts (13 tests) 2244ms

 Test Files  24 passed (24)
      Tests  868 passed (868)
   Start at  16:48:20
   Duration  3.05s (transform 2.15s, setup 0ms, collect 6.22s, tests 8.50s, environment 4ms, prepare 2.78s)

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

 ✓ src/ui/app.css.test.ts (87 tests) 21ms
 ✓ src/game/parts-v2.test.ts (50 tests) 15ms
 ✓ src/ws/connection.test.ts (10 tests) 15ms
 ✓ src/game/effects.test.ts (30 tests) 7ms
 ✓ src/multiplayer/transport.test.ts (14 tests) 15ms
 ✓ src/auth/store.test.ts (31 tests) 13ms
 ✓ src/render/quality.test.ts (24 tests) 65ms
 ✓ src/multiplayer/protocol.test.ts (236 tests) 38ms
 ✓ src/game/board.test.ts (18 tests) 23ms
 ✓ src/render/impact-effects.test.ts (22 tests) 37ms
 ✓ src/render/preview.test.ts (7 tests) 30ms
 ✓ src/render/particles.test.ts (24 tests) 18ms
 ✓ src/ui/icons.test.tsx (16 tests) 26ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 21ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 149ms
 ✓ src/render/starfield.test.ts (28 tests) 130ms
 ✓ src/render/targeting.test.ts (11 tests) 93ms
 ✓ src/input/gestures.test.ts (27 tests) 51ms
 ✓ src/render/cursor-ship.test.ts (34 tests) 192ms
 ✓ src/render/picking.test.ts (16 tests) 178ms
 ✓ src/render/spaceship.test.ts (40 tests) 133ms
 ✓ src/game/engine.test.ts (113 tests) 143ms
 ✓ src/multiplayer/server-state.test.ts (46 tests) 23ms
 ✓ src/auth/api.test.ts (28 tests) 24ms
 ✓ src/ui/game-view.css.test.ts (42 tests) 33ms
 ✓ src/render/cube-view.test.ts (37 tests) 341ms
 ✓ src/browser-env.test.ts (6 tests) 24ms
 ✓ src/game/parts.test.ts (23 tests) 15ms
 ✓ src/input/keyboard.test.ts (13 tests) 19ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 444ms
 ✓ src/render/postprocessing.test.ts (10 tests) 11ms
 ✓ src/render/world.test.ts (27 tests) 344ms
 ✓ src/render/background-life.test.ts (14 tests) 18ms
 ✓ src/game/rotation.test.ts (15 tests) 7ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 17ms
 ✓ src/game/progression.test.ts (21 tests) 16ms
 ✓ src/render/ship-motion.test.ts (24 tests) 14ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 16ms
 ✓ src/game/motion.test.ts (12 tests) 8ms
 ✓ src/game/upgrades.test.ts (20 tests) 14ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 13ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 27ms
 ✓ src/render/webgl.test.ts (17 tests) 21ms
 ✓ src/ui/theme.test.ts (11 tests) 20ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 17ms
 ✓ src/docs/links.test.ts (1 test) 6ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 5ms
 ✓ src/game/economy.test.ts (7 tests) 5ms
 ✓ src/render/scene-effects.test.ts (9 tests) 422ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 317ms
 ✓ src/render/nebula.test.ts (11 tests) 936ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  751ms
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

 ✓ src/ui/LevelCompleteBanner.test.tsx (6 tests) 79ms
 ✓ src/render/scene-spaceship.test.ts (28 tests) 1217ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > calls onUnequip with the slot id only for an enabled control
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > normalizes legacy direct props into the v2 slot rows
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 215ms
 ✓ src/ui/UpgradesPanel.test.tsx (12 tests) 228ms
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

 ✓ src/ui/SpaceshipPreview.test.tsx (12 tests) 106ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > advances through the exact 420 + 250 + 120 + 360 + 140 ms timeline
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 324ms
 ✓ src/ui/Hud.test.tsx (20 tests) 278ms
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

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel equip-row flash (AC-43) > sets data-equipping on the equipped slot for exactly 260 ms
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel equip-row flash (AC-43) > adds no row flash under reduced motion
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App > drives data-customization-open from the customization toggle (AC-7, AC-18)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/AuthMenu.test.tsx (19 tests) 544ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (28 tests) 779ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 995ms
stderr | src/App.test.tsx > App — customization panel integration (AC-29, AC-32, AC-43) > passes pendingLootboxOpen to the panel and disables Open lootbox while pending
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/render/scene.test.ts (85 tests) 2355ms
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

 ✓ src/App.test.tsx (38 tests) 1012ms
 ✓ src/game/session.test.ts (81 tests) 2924ms

 Test Files  64 passed (64)
      Tests  1738 passed (1738)
   Start at  16:48:24
   Duration  4.62s (transform 8.05s, setup 0ms, collect 21.27s, tests 15.65s, environment 6.11s, prepare 7.36s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.44 |    95.44 |   97.47 |   96.44 |                   
 src               |    86.5 |    82.91 |    92.5 |    86.5 |                   
  App.tsx          |   86.03 |    81.52 |   92.85 |   86.03 | ...33,455-456,619 
  browser-env.ts   |   91.66 |      100 |   91.66 |   91.66 | 69-72             
 src/auth          |   96.81 |    86.56 |   96.15 |   96.81 |                   
  api.ts           |   96.33 |    88.29 |     100 |   96.33 | ...54-155,163,209 
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193 
 src/game          |   96.34 |    99.73 |   98.93 |   96.34 |                   
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
 src/render        |   98.55 |     96.5 |   98.76 |   98.55 |                   
  ...round-life.ts |     100 |      100 |     100 |     100 |                   
  ...c-backdrop.ts |      99 |       96 |     100 |      99 | 299-300           
  cube-view.ts     |   99.24 |     98.5 |     100 |   99.24 | 336-337           
  cursor-ship.ts   |   99.54 |    97.61 |     100 |   99.54 | 208-209           
  ...ct-effects.ts |   98.64 |    94.11 |     100 |   98.64 | ...49-350,474-475 
  nebula.ts        |     100 |      100 |     100 |     100 |                   
  particles.ts     |     100 |      100 |     100 |     100 |                   
  picking.ts       |     100 |      100 |     100 |     100 |                   
  ...processing.ts |     100 |      100 |     100 |     100 |                   
  preview.ts       |     100 |      100 |     100 |     100 |                   
  quality.ts       |   97.91 |    97.18 |     100 |   97.91 | 248-249,329-330   
  scene.ts         |   97.23 |    95.67 |   95.34 |   97.23 | ...1036,1044-1045 
  ship-motion.ts   |     100 |      100 |     100 |     100 |                   
  ...ship-model.ts |     100 |      100 |     100 |     100 |                   
  spaceship.ts     |   96.16 |    95.48 |   97.05 |   96.16 | ...63-664,690-693 
  ...ate-travel.ts |     100 |      100 |     100 |     100 |                   
  starfield.ts     |     100 |      100 |     100 |     100 |                   
  targeting.ts     |   95.78 |     92.5 |     100 |   95.78 | ...64-166,178-179 
  webgl.ts         |     100 |      100 |     100 |     100 |                   
  world.ts         |   98.41 |    91.75 |     100 |   98.41 | 230-233,443       
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
[exit 0]
```

Per-workspace aggregates (from the coverage tables above):

| Workspace | Statements | Branches | Functions | Lines | Gate |
| --- | --- | --- | --- | --- | --- |
| backend | 95.43% | 87.71% | 99.70% | 95.43% | ✅ ≥ 80 |
| frontend | 96.44% | 95.44% | 97.47% | 96.44% | ✅ ≥ 80 |

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
✓ 102 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.42 kB │ gzip:   0.28 kB
dist/assets/index-BjbbTImZ.css   25.61 kB │ gzip:   5.24 kB
dist/assets/index-qRRPF0pW.js   982.59 kB │ gzip: 272.74 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.64s
[exit 0]
```

The chunk-size warning is pre-existing (frontend bundle > 500 kB) and is not a failure.

## No-runtime-diff guard (AC-12) and repaired-path check

```text
$ BASE_SHA=$(sed -n 's/^BASE_SHA=//p' docs/features/agent-skill-migration/build-log-T1.md | tail -1)
$ git diff --exit-code "$BASE_SHA"..HEAD -- src tests compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json
[exit 0, no output]

$ git diff --exit-code HEAD -- src tests compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json   # supplementary working-tree check
[exit 0, no output]

$ git status --porcelain -- src tests compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json
(empty)

$ test -z "$(git status --porcelain -- .opencode/skills .agents/skills skills-lock.json)"
[exit 0]

$ git check-ignore -v src/backend/dist src/frontend/dist
.gitignore:5:dist/	src/backend/dist
.gitignore:5:dist/	src/frontend/dist
```

`npm run build` output (`dist/`) is gitignored, so the tree stays clean.

## Optional skill-load smoke (supplementary; AC-13)

```text
$ time timeout 240 opencode run --format json --agent builder "Load the skills web-implementation and threejs-performance. Reply with exactly LOADED web-implementation and LOADED threejs-performance, then stop. Do not modify files." >/tmp/skill-smoke.json 2>/tmp/skill-smoke.err || true
real 0m0.293s

$ head -c 4000 /tmp/skill-smoke.json
{"type":"step_start","timestamp":1794498535615,"sessionID":"ses_e2f8d5ff0ffeH37Kp2VtPhqk1d","part":{"id":"prt_1d072a0bf001jg9UmGRFwslUk8","sessionID":"ses_e2f8d5ff0ffeH37Kp2VtPhqk1d","messageID":"msg_1d072a02b001gf0NyzqWXVaz63","type":"step-start","snapshot":"70aae1f4ea6448076513cc6b26a2ea3d3d7c78b9"}}
{"type":"error","timestamp":1794498535631,"sessionID":"ses_e2f8d5ff0ffeH37Kp2VtPhqk1d","error":{"type":"provider.quota","message":"Insufficient balance. Top up at https://opencode.ai/console/wrk_01KQPFQTBV074EVGPMVA3GT2JA/billing?credits=1.","status":402,"response":{"body":"{\"error\":{\"code\":402,\"status\":\"UNKNOWN\",\"message\":\"Insufficient balance. Top up at https://opencode.ai/console/wrk_01KQPFQTBV074EVGPMVA3GT2JA/billing?credits=1.\"}}"}}}

$ head -c 2000 /tmp/skill-smoke.err
(empty)

$ node -e '<pinned smoke text check>'
smoke output lacks the expected strings
[exit 1]

$ git status --porcelain   # after smoke
 M docs/features/README.md
?? docs/features/agent-skill-migration/plan.md
?? docs/features/agent-skill-migration/reviews/
?? docs/features/agent-skill-migration/spec.md
?? docs/features/agent-skill-migration/status.md
?? docs/features/agent-skill-migration/tasks.md
```

The smoke is **unavailable/supplementary**: the CLI spawned a session but the provider returned HTTP 402 (insufficient balance) before any model turn, so the JSON contains no `"skill"` strings. No files were modified. Per `tasks.md` T4 Notes and AC-13, static resolution is authoritative; the T1/T2 static checks above are the integration evidence, and this unavailable smoke does not weaken the gate. (`npm run smoke` is intentionally not run: the feature has no container/runtime change — plan D-9.)


## Commit 1 — content/bookkeeping (T4_CONTENT_SHA)

```text
$ git add docs/features/agent-skill-migration/build-log-T4.md docs/features/agent-skill-migration/spec.md docs/features/agent-skill-migration/plan.md docs/features/agent-skill-migration/tasks.md docs/features/agent-skill-migration/status.md docs/features/agent-skill-migration/reviews docs/features/README.md
[exit 0]

$ git diff --cached --stat
 docs/features/README.md                            |   3 +
 .../features/agent-skill-migration/build-log-T4.md | 875 +++++++++++++++++++++
 docs/features/agent-skill-migration/plan.md        | 187 +++++
 .../reviews/spec-review-r1.md                      |  66 ++
 .../reviews/spec-review-r2.md                      |  73 ++
 .../reviews/spec-review-r3.md                      |  71 ++
 docs/features/agent-skill-migration/spec.md        | 106 +++
 docs/features/agent-skill-migration/status.md      |  34 +
 docs/features/agent-skill-migration/tasks.md       | 408 ++++++++++
 9 files changed, 1823 insertions(+)

$ git commit -m "docs: agent-skill-migration final verification and feature bookkeeping"
[main 4c82d38] docs: agent-skill-migration final verification and feature bookkeeping
 9 files changed, 1823 insertions(+)
 create mode 100644 docs/features/agent-skill-migration/build-log-T4.md
 create mode 100644 docs/features/agent-skill-migration/plan.md
 create mode 100644 docs/features/agent-skill-migration/reviews/spec-review-r1.md
 create mode 100644 docs/features/agent-skill-migration/reviews/spec-review-r2.md
 create mode 100644 docs/features/agent-skill-migration/reviews/spec-review-r3.md
 create mode 100644 docs/features/agent-skill-migration/spec.md
 create mode 100644 docs/features/agent-skill-migration/status.md
 create mode 100644 docs/features/agent-skill-migration/tasks.md

$ git rev-parse HEAD
T4_CONTENT_SHA=4c82d38a7148dd3cb22ea557a94e445edae04e0c

$ git show --stat --oneline HEAD
4c82d38 docs: agent-skill-migration final verification and feature bookkeeping
 docs/features/README.md                            |   3 +
 .../features/agent-skill-migration/build-log-T4.md | 875 +++++++++++++++++++++
 docs/features/agent-skill-migration/plan.md        | 187 +++++
 .../reviews/spec-review-r1.md                      |  66 ++
 .../reviews/spec-review-r2.md                      |  73 ++
 .../reviews/spec-review-r3.md                      |  71 ++
 docs/features/agent-skill-migration/spec.md        | 106 +++
 docs/features/agent-skill-migration/status.md      |  34 +
 docs/features/agent-skill-migration/tasks.md       | 408 ++++++++++
 9 files changed, 1823 insertions(+)

$ git status --porcelain
(empty)
```

The content commit lists only this log (`files_owned`) plus the declared `commits_also` bookkeeping paths. `status.md` is committed as authored by the orchestrator (T4 still `[ ]`; the builder's edit allow-list denies `status.md`), and `docs/features/README.md` carries only the T3 rows. `T4_EVIDENCE_SHA` and the evidence commit's `git show --stat --oneline HEAD` are recorded post-commit in the Subagent Report and the requested orchestrator `status.md` loop-log entry (F1-r3 carry); recording them here would require a third commit and dirty the tree, so the pinned two-commit sequence is kept.
