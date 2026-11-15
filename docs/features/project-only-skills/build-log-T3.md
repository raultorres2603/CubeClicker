# Build log — T3 — Verify no stale references; full gates; commit

Task: T3 (2026-11-15) — `docs/features/project-only-skills/tasks.md` (acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11)

BASE_SHA=7b87cbbfc6821bc2664c3062de0e42d57043a031

Feature commits on top of `BASE_SHA` (pre-T3 log confirmed in § AC-11 below; final SHA in the Subagent Report):

- `18d5010` — `chore: remove imported skill packs and lockfile` (T1)
- `7491db3` — `docs: limit skills to the project pipeline` (T2)
- T3 commit — `docs: verify project-only skills` (this task)

## Files changed

- `docs/features/project-only-skills/build-log-T3.md` — this log (new). No content edits in this task.
- Staged without editing (`commits_also`): `docs/features/project-only-skills/spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/spec-review-r1.md`, `reviews/spec-review-r2.md`.
- Never touched: `docs/features/vercel-fly-neon-deployment/status.md` (pre-existing `M`, blocked feature; excluded from the scoped clean check).

## What changed & why (≤5 lines)

1. No source, agent, doc, config, or container content changed: T3 is verification and bookkeeping for T1 + T2.
2. The full T3 verify block ran in order: deletion and project-skill gates, the total-count/non-skill-parity frontmatter parser, the 33-ID prompt scan, the skills/docs checks, the supersession and unchanged-path diffs, then the full gate.
3. The orchestrator brief's broader sweep additionally scans the live paths (`AGENTS.md`, `README.md`, `opencode.jsonc`, `.opencode`, `docs/architecture`) for the 33 removed IDs, the advisory-pack phrase, and `skills-lock`.
4. All five gates exit 0; per-workspace coverage is backend 95.25/88.68/99.53/95.25 and frontend 96.48/96.14/97.56/96.48 (statements/branches/functions/lines), all ≥ 80.
5. The T3 commit stages this log plus the orchestrator-authored feature artifacts without editing them.

## Decisions

- **T3 makes no content edits.** The only file this task writes is `build-log-T3.md` (`files_owned`); `spec.md`, `plan.md`, `tasks.md`, `status.md`, and `reviews/**` are staged exactly as authored (`commits_also`).
- **`status.md` is not edited.** It remains orchestrator-owned (spec A-6, tasks.md § Shared conventions); T3 stages it only.
- **Commit message follows the orchestrator brief** (`docs: verify project-only skills`). `tasks.md:277` carries the earlier wording `docs: project-only-skills verification evidence`; the brief is the authoritative task input, so the brief's message is used and the discrepancy is recorded here as a bookkeeping deviation (no content impact).
- **Post-commit assertions are reported, not committed** (T1/T2 precedent): the commit and the post-commit scoped `git status` / `git log` run after this file is committed, so their raw output lives in the Subagent Report.
- **`imported` occurs only in project-skill coverage prose.** The only `imported` matches under the swept paths are "un-imported production files" in `.opencode/skills/**` coverage text, which is not advisory-pack wording; the formal AC-6/AC-7 scans over `AGENTS.md`, `README.md`, and `docs/architecture/documentation.md` are empty.
- **Pre-existing Vercel baseline.** `git status --porcelain -- docs/features/vercel-fly-neon-deployment/status.md` shows ` M docs/features/vercel-fly-neon-deployment/status.md` before staging; the path is never added or committed.

## Evidence

### 1. Full T3 verify transcript (every AC check + full gate)

Raw run of `/tmp/opencode/t3-verify.sh` — every command from `tasks.md` § T3 verify in order, plus the brief sweep; each step prints its exit code. `grep-exit=1` on the three negative scans is the pass condition (no match).

```text
### 0. BASE_SHA read-back
$ BASE_SHA=$(sed -n 's/^BASE_SHA=//p' docs/features/project-only-skills/build-log-T1.md | head -1)
BASE_SHA=7b87cbbfc6821bc2664c3062de0e42d57043a031

### AC-1: deleted paths absent and untracked
$ test ! -e .agents
exit=0
$ test ! -e skills-lock.json
exit=0
$ test -z "$(git ls-files -- '.agents/**' 'skills-lock.json')"
exit=0
$ git ls-files -- '.agents/**' 'skills-lock.json'
$ test -z "$(git status --porcelain -- .agents skills-lock.json)"
exit=0
$ git status --porcelain -- .agents skills-lock.json

### AC-2: only the six project skills, byte-identical to baseline
$ test "$(find .opencode/skills -mindepth 1 -maxdepth 1 -type d | wc -l)" -eq 6
exit=0
$ find .opencode/skills -mindepth 1 -maxdepth 1 -type d | sort
.opencode/skills/code-review
.opencode/skills/orchestration-playbook
.opencode/skills/spec-authoring
.opencode/skills/spec-review
.opencode/skills/task-decomposition
.opencode/skills/web-implementation
$ for id in orchestration-playbook spec-authoring spec-review task-decomposition web-implementation code-review; do test -f ".opencode/skills/$id/SKILL.md"; done
  .opencode/skills/orchestration-playbook/SKILL.md exit=0
  .opencode/skills/spec-authoring/SKILL.md exit=0
  .opencode/skills/spec-review/SKILL.md exit=0
  .opencode/skills/task-decomposition/SKILL.md exit=0
  .opencode/skills/web-implementation/SKILL.md exit=0
  .opencode/skills/code-review/SKILL.md exit=0
$ git diff --exit-code "$BASE_SHA" -- .opencode/skills
exit=0

### AC-3 re-check: exact skill sequences, total skill-rule count, non-skill parity vs BASE_SHA
$ BASE_SHA="$BASE_SHA" node -e <tasks.md T3 verify AC-3 parser>
agent frontmatter: skill sequences, total count, and non-skill parity OK
exit=0

### AC-4 re-check: no deleted pack ID / advisory bullet in agent prompts
$ node -e <tasks.md T3 verify AC-4 scan>
exit=0

### AC-5/AC-6/AC-7 re-check
heading [## Canonical location] exit=0
heading [## Precedence and ID rules] exit=0
heading [## Per-agent skill policy] exit=0
heading [## Maintenance] exit=0
heading [## Verification] exit=0
heading [## History] exit=0
$ grep -qF "Context7 MCP" docs/architecture/skills.md
exit=0
$ ! grep -nE ".agents|skills-lock|Imported pack inventory|Excluded and unassigned packs|Binding vs advisory" docs/architecture/skills.md
forbidden-scan-grep-exit=1 (1 = no match = pass)
$ ! grep -niE ".agents|skills-lock|imported|advisory" AGENTS.md README.md docs/architecture/documentation.md
forbidden-scan-grep-exit=1 (1 = no match = pass)
$ grep -qF "podman compose" AGENTS.md
exit=0
$ grep -qF "four-agent pipeline" AGENTS.md
exit=0
$ grep -qF "podman compose up" README.md
exit=0
$ test -f .opencode/skills/orchestration-playbook/SKILL.md
exit=0
$ git diff --exit-code "$BASE_SHA" -- docs/architecture/documentation.md
exit=0

### AC-8: no live reference to the deleted paths
$ ! grep -rnE ".agents/skills|skills-lock\.json" AGENTS.md README.md opencode.jsonc .opencode docs/architecture
grep-exit=1 (1 = no match = pass)

### Brief sweep: no imported skill ID, advisory-pack wording, or stale path in live docs
$ grep -rnE <33 removed skill IDs> AGENTS.md README.md opencode.jsonc .opencode docs/architecture
grep-exit=1 (1 = no match = pass)
$ grep -rniF "imported skills are advisory" AGENTS.md README.md opencode.jsonc .opencode docs/architecture
grep-exit=1 (1 = no match = pass)
$ grep -rnF "skills-lock" AGENTS.md README.md opencode.jsonc .opencode docs/architecture
grep-exit=1 (1 = no match = pass)
note: the word "imported" occurs only in project-skill coverage prose about un-imported production files (not advisory-pack wording); recorded below.
.opencode/skills/code-review/checklists/testing.md:8:- [ ] Un-imported production files count (the report lists every non-excluded module, e.g. a never-imported file at 0%)
.opencode/skills/web-implementation/SKILL.md:44:- **Coverage metric.** `npm run coverage` runs Vitest's V8 provider per workspace with thresholds of **80** on statements, branches, functions, and lines (aggregate per workspace). All-files semantics: un-imported production files count. Only the justified exclusions pinned in the workspace Vitest configs (test patterns + the one composition-root entrypoint per workspace) are allowed; never exclude production code or lower a threshold to pass the gate. Raw command output goes in `build-log-<taskid>.md`.
.opencode/skills/web-implementation/references/engineering-principles.md:55:- **Coverage policy.** The gate is `npm run coverage`: Vitest's V8 provider, thresholds 80 on statements, branches, functions, and **lines** — all four, **aggregate per workspace** (per-file thresholds are a possible future tightening, not the current policy). Semantics are all-files: every non-excluded file matched by `coverage.include` counts, imported by a test or not, so "just don't import it" cannot buy coverage. The only legitimate exclusions are the pinned, justified ones — test-file patterns plus the single composition-root entrypoint per workspace (compensated by the containerized smoke test). Never exclude production logic, lower a threshold, or add tests that assert nothing to clear the gate; the gate exists to catch real regressions, and number-gaming it is a review finding.

### AC-9: supersession recorded; historical artifacts untouched
$ grep -qF "## Supersession note" docs/features/project-only-skills/spec.md
exit=0
$ grep -qF "agent-skill-migration" docs/features/project-only-skills/spec.md
exit=0
$ git diff --exit-code "$BASE_SHA" -- docs/features/agent-skill-migration
exit=0

### AC-10: no application/container/CI/deploy changes vs baseline
$ git diff --exit-code "$BASE_SHA" -- src tests compose.yaml compose.smoke.yaml package.json package-lock.json .github opencode.jsonc
exit=0

### AC-10: full gate
$ npm run lint

> lint
> eslint .

exit=0

$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

exit=0

$ npm test

> test
> npm run test --workspaces --if-present


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/db/pool.test.ts (10 tests) 9ms
 ✓ src/auth/session-repository.test.ts (35 tests) 12ms
 ✓ src/auth/user-repository.test.ts (40 tests) 15ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 17ms
 ✓ src/db/migrate.test.ts (11 tests) 16ms
 ✓ src/observability/config.test.ts (24 tests) 6ms
 ✓ src/game/upgrades.test.ts (20 tests) 9ms
 ✓ src/game/economy.test.ts (20 tests) 7ms
 ✓ src/auth/config.test.ts (29 tests) 10ms
 ✓ src/game/cubes.test.ts (24 tests) 12ms
 ✓ src/game/parts.test.ts (19 tests) 9ms
 ✓ src/auth/rate-limit.test.ts (19 tests) 7ms
 ✓ src/game/parts-v2.test.ts (40 tests) 15ms
 ✓ src/observability/metrics.test.ts (30 tests) 14ms
 ✓ src/game/broadcast.test.ts (13 tests) 18ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 13ms
 ✓ src/db/migrate-runner.test.ts (14 tests) 15ms
 ✓ src/game/players.test.ts (13 tests) 9ms
 ✓ src/auth/email.test.ts (12 tests) 12ms
 ✓ src/game/servers.test.ts (47 tests) 154ms
 ✓ src/observability/logging.test.ts (28 tests) 168ms
 ✓ src/game/protocol.test.ts (182 tests) 33ms
 ✓ src/game/config.test.ts (13 tests) 8ms
 ✓ src/game/hub.test.ts (135 tests) 183ms
 ✓ src/cors.test.ts (15 tests) 111ms
 ✓ src/auth/password.test.ts (17 tests) 350ms
 ✓ src/auth/auth-routes.test.ts (28 tests) 783ms
 ✓ src/auth/auth-service.test.ts (50 tests) 905ms
 ✓ src/app.test.ts (27 tests) 2163ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1111ms
 ✓ src/db/migration-006.test.ts (13 tests) 2235ms
 ✓ src/auth/economy-repository.test.ts (119 tests) 2161ms
 ✓ src/db/migration-007.test.ts (11 tests) 2181ms

 Test Files  32 passed (32)
      Tests  1110 passed (1110)
   Start at  08:52:31
   Duration  3.03s (transform 3.77s, setup 0ms, collect 9.91s, tests 11.66s, environment 5ms, prepare 2.61s)


> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/app.css.test.ts (87 tests) 23ms
 ✓ src/ws/connection.test.ts (10 tests) 8ms
 ✓ src/game/parts-v2.test.ts (50 tests) 21ms
 ✓ src/multiplayer/protocol.test.ts (256 tests) 20ms
 ✓ src/multiplayer/transport.test.ts (15 tests) 13ms
 ✓ src/render/particles.test.ts (24 tests) 15ms
 ✓ src/render/impact-effects.test.ts (22 tests) 30ms
 ✓ src/render/preview.test.ts (7 tests) 21ms
 ✓ src/auth/api.test.ts (31 tests) 22ms
 ✓ src/ui/icons.test.tsx (16 tests) 24ms
 ✓ src/auth/store.test.ts (31 tests) 18ms
 ✓ src/render/quality.test.ts (29 tests) 72ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 93ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 15ms
 ✓ src/render/starfield.test.ts (28 tests) 96ms
 ✓ src/render/picking.test.ts (16 tests) 98ms
 ✓ src/render/cursor-ship.test.ts (34 tests) 150ms
 ✓ src/input/gestures.test.ts (27 tests) 29ms
 ✓ src/render/targeting.test.ts (11 tests) 69ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 199ms
 ✓ src/game/engine.test.ts (113 tests) 77ms
 ✓ src/build/vite-config.test.ts (11 tests) 333ms
 ✓ src/render/spaceship.test.ts (40 tests) 117ms
 ✓ src/game/rotation.test.ts (15 tests) 9ms
 ✓ src/render/cube-view.test.ts (37 tests) 179ms
 ✓ src/render/webgl.test.ts (22 tests) 20ms
 ✓ src/game/effects.test.ts (30 tests) 12ms
 ✓ src/render/world.test.ts (29 tests) 194ms
 ✓ src/browser-env.test.ts (6 tests) 17ms
 ✓ src/game/board.test.ts (18 tests) 23ms
 ✓ src/ui/game-view.css.test.ts (45 tests) 24ms
 ✓ src/game/motion.test.ts (12 tests) 8ms
 ✓ src/build/nginx-config.test.ts (6 tests) 5ms
 ✓ src/game/progression.test.ts (21 tests) 11ms
 ✓ src/render/background-life.test.ts (14 tests) 24ms
 ✓ src/multiplayer/server-state.test.ts (52 tests) 22ms
 ✓ src/render/postprocessing.test.ts (14 tests) 17ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 10ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 173ms
 ✓ src/game/upgrades.test.ts (20 tests) 6ms
 ✓ src/input/keyboard.test.ts (13 tests) 12ms
 ✓ src/render/nebula.test.ts (11 tests) 464ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  398ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 12ms
 ✓ src/config.test.ts (20 tests) 10ms
 ✓ src/render/scene-effects.test.ts (9 tests) 226ms
 ✓ src/docs/links.test.ts (1 test) 4ms
 ✓ src/game/economy.test.ts (7 tests) 5ms
 ✓ src/render/ship-motion.test.ts (24 tests) 10ms
 ✓ src/ui/theme.test.ts (11 tests) 15ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 3ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 16ms
 ✓ src/game/parts.test.ts (23 tests) 15ms
 ✓ src/build/bundle-budget.test.ts (11 tests) 11ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 10ms
 ✓ src/render/scene-spaceship.test.ts (28 tests) 528ms
 ✓ src/ui/LevelCompleteBanner.test.tsx (6 tests) 94ms
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

 ✓ src/ui/GameCanvas.runtime.test.tsx (5 tests) 187ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > marks owned parts and exposes equipped/label states on the equip controls
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > renders a 44px-capable unequip control per slot, disabled at the standard part
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/SpaceshipPreview.test.tsx (12 tests) 95ms
 ✓ src/render/scene.test.ts (90 tests) 1228ms
 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 228ms
 ✓ src/ui/UpgradesPanel.test.tsx (12 tests) 215ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > calls onUnequip with the slot id only for an enabled control
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > normalizes legacy direct props into the v2 slot rows
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/DeferredSpaceshipCustomizationPanel.test.tsx (5 tests) 211ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel lootbox controls (AC-29) > calls onOpenLootbox once when the enabled control is clicked
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/Hud.test.tsx (20 tests) 235ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 228ms
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

 ✓ src/ui/AuthMenu.test.tsx (19 tests) 410ms
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

 ✓ src/game/session.test.ts (96 tests) 1395ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > dismisses the reveal through onDismissReveal
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/GameCanvas.test.tsx (7 tests) 203ms
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

 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (28 tests) 478ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 786ms
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

 ✓ src/App.test.tsx (41 tests) 961ms

 Test Files  70 passed (70)
      Tests  1873 passed (1873)
   Start at  08:52:35
   Duration  3.05s (transform 7.84s, setup 0ms, collect 20.46s, tests 10.61s, environment 6.53s, prepare 5.24s)

exit=0

$ npm run coverage

> coverage
> npm run coverage --workspaces --if-present


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/config.test.ts (13 tests) 8ms
 ✓ src/auth/user-repository.test.ts (40 tests) 13ms
 ✓ src/db/migrate.test.ts (11 tests) 11ms
 ✓ src/auth/rate-limit.test.ts (19 tests) 9ms
 ✓ src/game/upgrades.test.ts (20 tests) 5ms
 ✓ src/auth/config.test.ts (29 tests) 8ms
 ✓ src/game/cubes.test.ts (24 tests) 13ms
 ✓ src/auth/session-repository.test.ts (35 tests) 18ms
 ✓ src/game/parts-v2.test.ts (40 tests) 15ms
 ✓ src/game/players.test.ts (13 tests) 10ms
 ✓ src/observability/metrics.test.ts (30 tests) 12ms
 ✓ src/game/economy.test.ts (20 tests) 7ms
 ✓ src/game/broadcast.test.ts (13 tests) 19ms
 ✓ src/db/pool.test.ts (10 tests) 8ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 23ms
 ✓ src/game/parts.test.ts (19 tests) 11ms
 ✓ src/auth/email.test.ts (12 tests) 14ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 13ms
 ✓ src/db/migrate-runner.test.ts (14 tests) 15ms
 ✓ src/game/servers.test.ts (47 tests) 114ms
 ✓ src/observability/logging.test.ts (28 tests) 167ms
 ✓ src/observability/config.test.ts (24 tests) 5ms
 ✓ src/game/protocol.test.ts (182 tests) 21ms
 ✓ src/game/hub.test.ts (135 tests) 204ms
 ✓ src/auth/password.test.ts (17 tests) 379ms
 ✓ src/cors.test.ts (15 tests) 211ms
 ✓ src/auth/auth-service.test.ts (50 tests) 869ms
 ✓ src/auth/auth-routes.test.ts (28 tests) 866ms
 ✓ src/db/migration-006.test.ts (13 tests) 2273ms
 ✓ src/auth/economy-repository.test.ts (119 tests) 2189ms
 ✓ src/db/migration-007.test.ts (11 tests) 2221ms
 ✓ src/app.test.ts (27 tests) 2240ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1105ms

 Test Files  32 passed (32)
      Tests  1110 passed (1110)
   Start at  08:52:38
   Duration  3.29s (transform 3.08s, setup 0ms, collect 9.61s, tests 11.99s, environment 7ms, prepare 3.53s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.25 |    88.68 |   99.53 |   95.25 |                   
 src               |   85.88 |       90 |     100 |   85.88 |                   
  app.ts           |   81.72 |     85.1 |     100 |   81.72 | ...59,172,249-266 
  cors.ts          |     100 |      100 |     100 |     100 |                   
 src/auth          |   95.74 |    82.88 |     100 |   95.74 |                   
  auth-routes.ts   |    80.7 |    54.19 |     100 |    80.7 | ...61-363,369-370 
  auth-service.ts  |     100 |    81.63 |     100 |     100 | ...95,400,417,503 
  config.ts        |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   95.74 |    86.52 |     100 |   95.74 | ...69-770,826-839 
  email.ts         |     100 |      100 |     100 |     100 |                   
  password.ts      |     100 |      100 |     100 |     100 |                   
  rate-limit.ts    |     100 |      100 |     100 |     100 |                   
  ...repository.ts |   96.53 |    84.12 |     100 |   96.53 | ...40-141,146-147 
  ...repository.ts |    98.8 |    89.53 |     100 |    98.8 | 61-62,315         
  ...repository.ts |   97.29 |    90.62 |     100 |   97.29 | 63-68             
 src/db            |   98.02 |    93.67 |     100 |   98.02 |                   
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 | 82-83             
  ...ate-runner.ts |    97.1 |       96 |     100 |    97.1 | 107-108           
  migrate.ts       |     100 |      100 |     100 |     100 |                   
  pool.ts          |     100 |      100 |     100 |     100 |                   
 src/game          |   94.63 |    93.21 |   98.85 |   94.63 |                   
  broadcast.ts     |   97.12 |    95.65 |     100 |   97.12 | 137-138,231-232   
  config.ts        |     100 |      100 |     100 |     100 |                   
  cubes.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  hub.ts           |   89.98 |    87.71 |   98.27 |   89.98 | ...1506,1636-1637 
  parts-v2.ts      |     100 |      100 |     100 |     100 |                   
  parts.ts         |     100 |      100 |     100 |     100 |                   
  players.ts       |     100 |      100 |     100 |     100 |                   
  protocol.ts      |   98.89 |    98.61 |   96.87 |   98.89 | 248-249,571-572   
  servers.ts       |   99.01 |    98.71 |     100 |   99.01 | 289-290           
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
 src/observability |   99.59 |       96 |     100 |   99.59 |                   
  config.ts        |     100 |      100 |     100 |     100 |                   
  logging.ts       |     100 |      100 |     100 |     100 |                   
  metrics.ts       |   99.44 |    93.54 |     100 |   99.44 | 243-244           
-------------------|---------|----------|---------|---------|-------------------

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ui/app.css.test.ts (87 tests) 19ms
 ✓ src/multiplayer/server-state.test.ts (52 tests) 9ms
 ✓ src/ui/game-view.css.test.ts (45 tests) 19ms
 ✓ src/multiplayer/protocol.test.ts (256 tests) 21ms
 ✓ src/render/webgl.test.ts (22 tests) 15ms
 ✓ src/game/parts-v2.test.ts (50 tests) 28ms
 ✓ src/render/impact-effects.test.ts (22 tests) 25ms
 ✓ src/render/background-life.test.ts (14 tests) 16ms
 ✓ src/game/board.test.ts (18 tests) 30ms
 ✓ src/ui/icons.test.tsx (16 tests) 25ms
 ✓ src/render/preview.test.ts (7 tests) 26ms
 ✓ src/auth/api.test.ts (31 tests) 21ms
 ✓ src/render/starfield.test.ts (28 tests) 86ms
 ✓ src/render/quality.test.ts (29 tests) 97ms
 ✓ src/render/targeting.test.ts (11 tests) 95ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 152ms
 ✓ src/input/gestures.test.ts (27 tests) 56ms
 ✓ src/render/cursor-ship.test.ts (34 tests) 172ms
 ✓ src/render/picking.test.ts (16 tests) 152ms
 ✓ src/game/engine.test.ts (113 tests) 103ms
 ✓ src/render/spaceship.test.ts (40 tests) 137ms
 ✓ src/build/vite-config.test.ts (11 tests) 397ms
 ✓ src/render/cube-view.test.ts (37 tests) 312ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 7ms
 ✓ src/auth/store.test.ts (31 tests) 24ms
 ✓ src/browser-env.test.ts (6 tests) 15ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 380ms
 ✓ src/ui/theme.test.ts (11 tests) 6ms
 ✓ src/game/effects.test.ts (30 tests) 14ms
 ✓ src/render/postprocessing.test.ts (14 tests) 14ms
 ✓ src/render/particles.test.ts (24 tests) 26ms
 ✓ src/multiplayer/transport.test.ts (15 tests) 22ms
 ✓ src/game/parts.test.ts (23 tests) 11ms
 ✓ src/input/keyboard.test.ts (13 tests) 12ms
 ✓ src/game/progression.test.ts (21 tests) 9ms
 ✓ src/build/bundle-budget.test.ts (11 tests) 9ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 23ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 14ms
 ✓ src/render/world.test.ts (29 tests) 365ms
 ✓ src/render/ship-motion.test.ts (24 tests) 8ms
 ✓ src/config.test.ts (20 tests) 12ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 244ms
 ✓ src/game/rotation.test.ts (15 tests) 11ms
 ✓ src/game/motion.test.ts (12 tests) 8ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 15ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 10ms
 ✓ src/ws/connection.test.ts (10 tests) 25ms
 ✓ src/game/upgrades.test.ts (20 tests) 9ms
 ✓ src/game/economy.test.ts (7 tests) 6ms
 ✓ src/build/nginx-config.test.ts (6 tests) 6ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 10ms
 ✓ src/docs/links.test.ts (1 test) 4ms
 ✓ src/render/scene-effects.test.ts (9 tests) 437ms
 ✓ src/render/nebula.test.ts (11 tests) 828ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  643ms
 ✓ src/render/scene-spaceship.test.ts (28 tests) 1041ms
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

 ✓ src/ui/Hud.test.tsx (20 tests) 173ms
 ✓ src/ui/SpaceshipPreview.test.tsx (12 tests) 100ms
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

 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 298ms
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

 ✓ src/ui/UpgradesPanel.test.tsx (12 tests) 303ms
 ✓ src/ui/DeferredSpaceshipCustomizationPanel.test.tsx (5 tests) 188ms
 ✓ src/ui/LevelCompleteBanner.test.tsx (6 tests) 130ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > advances through the exact 420 + 250 + 120 + 360 + 140 ms timeline
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/GameCanvas.runtime.test.tsx (5 tests) 177ms
 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 252ms
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

 ✓ src/ui/AuthMenu.test.tsx (19 tests) 614ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > equips the revealed part through the panel command
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App > drives data-customization-open from the customization toggle (AC-7, AC-18)
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/GameCanvas.test.tsx (7 tests) 307ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel equip-row flash (AC-43) > sets data-equipping on the equipped slot for exactly 260 ms
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel equip-row flash (AC-43) > adds no row flash under reduced motion
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (28 tests) 860ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 1010ms
   ✓ AuthForms — interaction > submits the rendered login form and calls onLogin with the entered values  313ms
 ✓ src/render/scene.test.ts (90 tests) 2525ms
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

 ✓ src/App.test.tsx (41 tests) 1324ms
 ✓ src/game/session.test.ts (96 tests) 2783ms

 Test Files  70 passed (70)
      Tests  1873 passed (1873)
   Start at  08:52:42
   Duration  4.40s (transform 7.79s, setup 0ms, collect 20.60s, tests 16.69s, environment 8.01s, prepare 6.82s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.48 |    96.14 |   97.56 |   96.48 |                   
 src               |   87.87 |    84.95 |   95.45 |   87.87 |                   
  App.tsx          |   86.22 |    81.91 |   96.42 |   86.22 | ...31-433,455-456 
  browser-env.ts   |   92.72 |      100 |   91.66 |   92.72 | 74-77             
  config.ts        |     100 |      100 |     100 |     100 |                   
 src/auth          |   96.85 |     86.2 |   96.15 |   96.85 |                   
  api.ts           |   96.44 |     87.5 |     100 |   96.44 | ...61-162,170,222 
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193 
 src/game          |   96.19 |    99.36 |   98.46 |   96.19 |                   
  board.ts         |     100 |      100 |     100 |     100 |                   
  economy.ts       |     100 |      100 |     100 |     100 |                   
  effects.ts       |     100 |      100 |     100 |     100 |                   
  engine.ts        |   99.47 |      100 |     100 |   99.47 | 958-959,1250-1251 
  motion.ts        |     100 |      100 |     100 |     100 |                   
  parts-v2.ts      |     100 |      100 |     100 |     100 |                   
  parts.ts         |     100 |      100 |     100 |     100 |                   
  progression.ts   |     100 |      100 |     100 |     100 |                   
  rotation.ts      |     100 |      100 |     100 |     100 |                   
  session.ts       |   90.07 |    98.67 |   95.65 |   90.07 | ...1430,1549-1550 
  types.ts         |     100 |      100 |     100 |     100 |                   
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42             
 src/input         |     100 |      100 |     100 |     100 |                   
  gestures.ts      |     100 |      100 |     100 |     100 |                   
  keyboard.ts      |     100 |      100 |     100 |     100 |                   
 src/multiplayer   |    93.4 |     96.6 |   95.89 |    93.4 |                   
  protocol.ts      |   89.13 |    96.04 |   90.32 |   89.13 | ...1076,1080-1090 
  server-state.ts  |   98.19 |    95.09 |     100 |   98.19 | ...19,321-322,380 
  spectate.ts      |     100 |      100 |     100 |     100 |                   
  transport.ts     |   99.49 |      100 |     100 |   99.49 | 200               
 src/render        |   98.58 |    98.96 |   98.79 |   98.58 |                   
  ...round-life.ts |     100 |      100 |     100 |     100 |                   
  ...c-backdrop.ts |      99 |      100 |     100 |      99 | 299-300           
  cube-view.ts     |   99.24 |      100 |     100 |   99.24 | 336-337           
  cursor-ship.ts   |   99.54 |    97.61 |     100 |   99.54 | 208-209           
  ...ct-effects.ts |   98.64 |      100 |     100 |   98.64 | ...49-350,474-475 
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
 src/ui            |   96.71 |    93.95 |   94.59 |   96.71 |                   
  AuthForms.tsx    |     100 |    99.07 |     100 |     100 | 219               
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |                   
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |                   
  ...ionToggle.tsx |     100 |      100 |     100 |     100 |                   
  ...tionPanel.tsx |   91.66 |     87.5 |     100 |   91.66 | 60-61,66-67       
  GameCanvas.tsx   |   96.61 |       95 |     100 |   96.61 | 62-63             
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
exit=0

$ npm run build

> build
> npm run build --workspaces --if-present


> build
> tsc


> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
transforming...
✓ 105 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.49 kB │ gzip:   0.30 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-CWGWNrMl.css                        26.36 kB │ gzip:   5.32 kB
dist/assets/cursor-ship-Bpw8b04A.js                    6.73 kB │ gzip:   2.21 kB
dist/assets/SpaceshipCustomizationPanel-CWQJOBdv.js    9.54 kB │ gzip:   3.34 kB
dist/assets/browser-env-D999_Msh.js                   49.05 kB │ gzip:  18.10 kB
dist/assets/index-ak4hpiiK.js                         88.35 kB │ gzip:  27.43 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-4rmoIDEa.js                        609.34 kB │ gzip: 154.32 kB
✓ built in 1.42s
entry index assets/index-ak4hpiiK.js raw=88353 gzip=27426
initial files=2 raw=310052 gzip=96382 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=165000
total files=6 raw=984704 gzip=274354 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-CWQJOBdv.js raw=9537 gzip=3336 initial=false
chunk browser-env assets/browser-env-D999_Msh.js raw=49049 gzip=18104 initial=false
chunk cursor-ship assets/cursor-ship-Bpw8b04A.js raw=6729 gzip=2209 initial=false
chunk index assets/index-ak4hpiiK.js raw=88353 gzip=27426 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-4rmoIDEa.js raw=609337 gzip=154323 initial=false

Bundle budget OK.
exit=0

### AC-11 (pre-commit): feature commit log so far
$ git log --oneline "$BASE_SHA"..HEAD -- .agents skills-lock.json .opencode/agents AGENTS.md README.md docs/architecture/skills.md
7491db3 docs: limit skills to the project pipeline
18d5010 chore: remove imported skill packs and lockfile

### Working tree before staging
$ git status --porcelain
 M docs/features/vercel-fly-neon-deployment/status.md
?? docs/features/project-only-skills/plan.md
?? docs/features/project-only-skills/reviews/
?? docs/features/project-only-skills/spec.md
?? docs/features/project-only-skills/status.md
?? docs/features/project-only-skills/tasks.md

### DONE
```

### 2. Staging and commit

The declared paths are staged exactly (`tasks.md` § T3 verify add line), then the commit is created with the brief's message. Pre-commit staged-path evidence is appended below this section before the commit; the commit's `--stat`/`--name-only` and the post-commit scoped clean check are in the Subagent Report (a commit cannot contain its own output).

```text
$ git add docs/features/project-only-skills/spec.md docs/features/project-only-skills/plan.md docs/features/project-only-skills/tasks.md docs/features/project-only-skills/status.md docs/features/project-only-skills/reviews docs/features/project-only-skills/build-log-T3.md
$ git diff --cached --name-status
A	docs/features/project-only-skills/build-log-T3.md
A	docs/features/project-only-skills/plan.md
A	docs/features/project-only-skills/reviews/spec-review-r1.md
A	docs/features/project-only-skills/reviews/spec-review-r2.md
A	docs/features/project-only-skills/spec.md
A	docs/features/project-only-skills/status.md
A	docs/features/project-only-skills/tasks.md
$ git status --porcelain
A  docs/features/project-only-skills/build-log-T3.md
A  docs/features/project-only-skills/plan.md
A  docs/features/project-only-skills/reviews/spec-review-r1.md
A  docs/features/project-only-skills/reviews/spec-review-r2.md
A  docs/features/project-only-skills/spec.md
A  docs/features/project-only-skills/status.md
A  docs/features/project-only-skills/tasks.md
 M docs/features/vercel-fly-neon-deployment/status.md
$ test -z "$(git diff --cached --name-only -- docs/features/vercel-fly-neon-deployment/status.md)"
exit=0
$ git commit -m "docs: verify project-only skills"
```

## Acceptance audit

- **AC-1** → met: `test ! -e .agents` and `test ! -e skills-lock.json` exit 0; `git ls-files -- '.agents/**' 'skills-lock.json'` prints nothing; `git status --porcelain -- .agents skills-lock.json` is empty (transcript lines 5-16).
- **AC-2** → met: exactly the six directories (`code-review`, `orchestration-playbook`, `spec-authoring`, `spec-review`, `task-decomposition`, `web-implementation`), all six `SKILL.md` files exist, and `git diff --exit-code "$BASE_SHA" -- .opencode/skills` exits 0 (lines 17-35).
- **AC-3** → met: the block parser prints `agent frontmatter: skill sequences, total count, and non-skill parity OK` and exits 0 (lines 37-40). It asserts, per agent, exactly `skill|*|deny` followed by the expected project allows in order, that the total `action: skill` occurrence count equals the parsed skill-rule count, and that every ordered non-skill rule is identical to `BASE_SHA` — no permission widening.
- **AC-4** → met: the 33-ID + `imported skills are advisory` scan over all four agent prompts exits 0 with no output (lines 42-44); `skill "*" deny` remains the first rule in all four.
- **AC-5** → met: all six required headings, the literal `Context7 MCP`, the four exact per-agent table rows, and the forbidden-token scan (`.agents`, `skills-lock`, `Imported pack inventory`, `Excluded and unassigned packs`, `Binding vs advisory`) is empty (lines 46-56).
- **AC-6** → met: `AGENTS.md`/`README.md` contain no `.agents`/`skills-lock`/`imported`/`advisory`; `podman compose`, `four-agent pipeline`, and `podman compose up` remain (lines 57-64).
- **AC-7** → met: `docs/architecture/documentation.md` has no stale token, still references `docs/architecture/skills.md`, the playbook path resolves, and the diff vs `BASE_SHA` is empty (lines 58, 65-68).
- **AC-8** → met: no `.agents/skills` or `skills-lock.json` reference under `AGENTS.md`, `README.md`, `opencode.jsonc`, `.opencode`, `docs/architecture` (lines 70-72).
- **AC-9** → met: `## Supersession note` names `agent-skill-migration`; `git diff --exit-code "$BASE_SHA" -- docs/features/agent-skill-migration` exits 0 (lines 86-92).
- **AC-10** → met: `src`, `tests`, `compose.yaml`, `compose.smoke.yaml`, `package.json`, `package-lock.json`, `.github`, `opencode.jsonc` are unchanged vs `BASE_SHA` (lines 94-96); `npm run lint`, `npm run typecheck`, `npm test` (32+70 files, 1110+1873 tests), `npm run coverage`, and `npm run build` all exit 0 (lines 98-793), with per-workspace coverage backend 95.25/88.68/99.53/95.25 and frontend 96.48/96.14/97.56/96.48.
- **AC-11** → met: the pre-T3 feature log shows only the T1/T2 commits (lines 795-798); § 2 records the exact staging set and the empty staged-Vercel check; the post-commit scoped clean check, commit contents, and the never-committed Vercel status are recorded in the Subagent Report.

## Rollback (from `plan.md` § Rollback)

- **Trigger:** a gate failure caused by the deletion or the edit set, a discovery/load regression traced to the removed source, or a user decision to restore the packs.
- **Before merge:** `git checkout "$BASE_SHA" -- .agents skills-lock.json .opencode/agents AGENTS.md README.md docs/architecture`, then commit the restore (every deleted file is tracked, so the restore is byte-identical).
- **After merge:** `git revert --no-edit <T3> <T2> <T1>` in reverse chronological order, then re-run the gates.
- **Recovery without a revert:** `git show "$BASE_SHA:skills-lock.json"` and `git show "$BASE_SHA:.agents/skills/<id>/SKILL.md"`.
- **Evidence:** `BASE_SHA` above and the feature commit SHAs in the Subagent Report.
- **Out of scope:** never restore, stage, revert, or otherwise touch `docs/features/vercel-fly-neon-deployment/status.md`.

## Deviations from spec

- None in scope. Bookkeeping only: the commit message follows the orchestrator brief (`docs: verify project-only skills`) instead of `tasks.md`'s earlier wording `docs: project-only-skills verification evidence`; no content impact.
