# Build log — T5 — Documentation and final verification

Task: T5 (2026-11-12)
Feature: adaptive-render-budget-v2

Files changed:
- `README.md`
- `docs/architecture/frontend-rendering.md` (new)
- `docs/features/adaptive-render-budget-v2/build-log-T5.md` (new)
- Staged without edits (planner/reviewer/orchestrator artifacts, per `commits_also`): `spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/**`; `build-log-T1.md`–`build-log-T4.md` were already tracked.

What changed & why:
- `README.md`: the existing quality-tier clause is replaced, verbatim, with the AC-16 sentence; no other README text is touched.
- `docs/architecture/frontend-rendering.md` is the new architecture reference: renderer lifecycle (gate-deferred attach, hidden-tab suspension, dispose/re-attach), the pinned tier matrix with AC-5 numbers and reduced-motion invariance, the frame-loop order (`applySnapshot` → `update` → tier poll → `setQuality`/DPR → `render`), and verification (commands plus the containerized manual pass).
- No application, test, config, container, or package change.

Decisions:
- README keeps a minimal diff: exactly the one AC-16 sentence replaces the old clause; the surrounding gameplay prose and feature references are untouched.
- The new doc documents shipped behavior only and links only to repository files that exist; the link checker below reports every relative link resolved (the link to this build log resolves because this file is committed in the same change).
- `docs/features/README.md` is orchestrator-owned and was **not** edited; the proposed row is recorded below for the orchestrator.
- The containerized visual pass is interactive (screenshots, network panel, DevTools CPU throttling, tab switching). This environment has Podman with a working compose provider but **no browser/GUI** (no `chromium`/`chrome`/`firefox` binary and no Playwright/Puppeteer in `node_modules`), so every step is recorded as "not executed — environment"; none is recorded as passed.

Evidence:

- `npm run lint` → exit 0
```
> lint
> eslint .
```

- `npm run typecheck` → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
```

- `npm test` → exit 0
```
> test
> npm run test --workspaces --if-present

> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
 Test Files  24 passed (24)
      Tests  868 passed (868)
   Duration  3.14s

> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
 Test Files  64 passed (64)
      Tests  1770 passed (1770)
   Duration  3.38s
```
  The full suite includes the AC-2 named test `receives welcome after a detached retryConnection → join(account) → attach cycle`, the AC-13 context-loss probe, the `GameCanvas` close/reopen + StrictMode-like remount tests, and the production-adapter contract test.

- `npm run coverage` → exit 0 (thresholds ≥ 80 statements/branches/functions/lines per workspace)
```
> coverage
> npm run coverage --workspaces --if-present

> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
 Test Files  24 passed (24)
      Tests  868 passed (868)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.43 |    87.71 |    99.7 |   95.43 |
-------------------|---------|----------|---------|---------|-------------------

> coverage
> vitest run --coverage

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
 Test Files  64 passed (64)
      Tests  1770 passed (1770)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.47 |    96.14 |   97.64 |   96.47 |
  App.tsx          |   86.22 |    81.91 |   96.42 |   86.22 |
  GameCanvas.tsx   |   92.85 |    85.71 |     100 |   92.85 |
  session.ts       |   90.16 |    98.93 |   96.77 |   90.16 |
  quality.ts       |   98.31 |      100 |     100 |   98.31 |
  postprocessing.ts|     100 |      100 |     100 |     100 |
  webgl.ts         |     100 |      100 |     100 |     100 |
  scene.ts         |   97.26 |    99.39 |   95.34 |   97.26 |
-------------------|---------|----------|---------|---------|-------------------
```
  Per workspace: backend 95.43 / 87.71 / 99.70 / 95.43; frontend 96.47 / 96.14 / 97.64 / 96.47 — all four metrics ≥ 80 in both workspaces, no coverage exclusion or threshold was changed.

- `npm run build` → exit 0
```
> build
> npm run build --workspaces --if-present

> build
> tsc

> build
> vite build

vite v7.3.7 building client environment for production...
✓ 102 modules transformed.
dist/index.html                   0.42 kB │ gzip:   0.28 kB
dist/assets/index-BjbbTImZ.css   25.61 kB │ gzip:   5.24 kB
dist/assets/index-Dn5pY2q7.js   983.50 kB │ gzip: 273.10 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 1.54s
```
  (The chunk-size warning is pre-existing and non-failing.)

- Pinned docs checks → exit 0
```
$ test -f docs/architecture/frontend-rendering.md
$ for h in "Renderer lifecycle" "Quality tier budget" "Frame loop" "Verification"; do grep -qx "## $h" docs/architecture/frontend-rendering.md; done
$ grep -F 'An automatic high/medium/low quality tier keeps the frame rate in budget — scaling SSAO and bloom, shadow-map resolution, and render resolution — and reduced motion replaces each of these animations with a static or instant variant.' README.md
The game view is generated procedurally in code (no external models, textures, images, videos or other assets): … An automatic high/medium/low quality tier keeps the frame rate in budget — scaling SSAO and bloom, shadow-map resolution, and render resolution — and reduced motion replaces each of these animations with a static or instant variant. (Features: `reference-image-game-view`, `detailed-hero-spaceship` and `spaceship-cursor-loot-animations`; see `docs/features/spaceship-cursor-loot-animations/`.)
$ test -z "$(git status --porcelain -- docs/features/README.md)"
$ git diff --exit-code -- docs/features/user-authentication docs/features/realistic-lighting-materials docs/features/spaceship-cursor-loot-animations
$ git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile' package.json package-lock.json
ALL PINNED DOC CHECKS: exit 0
```

- Relative-link resolution check for `docs/architecture/frontend-rendering.md` (extracted every `[text](target)` and resolved it against the file's directory) → exit 0, all links resolve:
```
OK   ../../src/frontend/src/render/quality.ts
OK   ../features/adaptive-render-budget-v2/spec.md
OK   stack.md
OK   ../../src/frontend/src/App.tsx
OK   ../../src/frontend/src/ui/GameCanvas.tsx
OK   ../../src/frontend/src/browser-env.ts
OK   ../../src/frontend/src/render/webgl.ts
OK   ../../src/frontend/src/render/postprocessing.ts
OK   ../../src/frontend/src/render/scene.ts
OK   ../../src/frontend/src/game/session.ts
OK   ../../README.md
OK   ../features/adaptive-render-budget-v2/plan.md#verification
OK   ../features/adaptive-render-budget-v2/build-log-T5.md
```

- Predecessor immutability (AC-17): the three-directory `git diff --exit-code` above produced no output → exit 0. `spec.md` § Supersessions contains the pinned ledger rows (`user-authentication` AC-18, `realistic-lighting-materials` AC-1/AC-4/AC-6/Q-4, `spaceship-cursor-loot-animations` AC-52/AC-47/Q-13, `modern-visual-overhaul` shadow AC, impact matrices); the predecessor artifacts were not edited.

- Scope check: `compose.yaml`, `compose.smoke.yaml`, all Dockerfiles, `src/backend/**`, `package.json` and `package-lock.json` have an empty diff (command above, exit 0); `docs/features/README.md` is untouched (`git status --porcelain` empty).

Containerized manual visual pass (plan § Verification):

Environment probe:
```
$ podman compose version
Docker Compose version v5.6.0            # compose provider available
$ podman info --format '{{.Host.OS}}/{{.Host.Arch}}'
linux/amd64
$ command -v chromium chromium-browser google-chrome google-chrome-stable firefox firefox-esr epiphany
# no output — no browser binary installed
$ ls node_modules/.bin | grep -iE 'playwright|puppeteer'
# no output — no browser automation binary
```

1. **High-tier parity** (1280×720 and 1920×1080 screenshots, before/after comparison of SSAO contact shading, bloom, the soft 2048 shadow edge, cursor material) → **not executed — environment**: this is a headless environment with no browser/GUI, no stored before-change screenshots, and no browser automation binary; the comparison requires a rendered page and visual inspection.
2. **Gate deferral** (no `/ws` upgrade while the auth menu is open; one socket after guest/login; none while verification is pending; intro starts at gate close; cookie present on the login-upgrade) → **not executed — environment**: observing the network panel/WebSocket upgrade timing requires an interactive browser; a headless HTTP client cannot execute the React gate.
3. **Graceful degradation** (DevTools CPU throttling 6× then 4×, observe medium/low looks and the backing-store ratio `min(devicePixelRatio, 1.5)` then `min(devicePixelRatio, 1)`, then recovery to high) → **not executed — environment**: DevTools Performance CPU throttling, canvas backing-store inspection and visual tier observation require an interactive browser session.
4. **Lifecycle probes** (resize during the menu, tab switch during play with no time jump, reload/gate repeat) → **not executed — environment**: resize/tab interaction and observation require an interactive browser.

None of the four steps is recorded as passed; the automated tier/lifecycle suites above remain the evidence for AC-6/7/8/9/10/13. No `npm run smoke` gate applies (no container/backend change); it was not run.

Checkpoint record (Q-1/Q-2/Q-3 and the AC-18 animation-clause supersession):
- `status.md` loop log records the approval gate: `2026-11-12 — awaiting_approval → building — user approved defaults: Q-1 low-tier shadows off; Q-2 intro from start at gate close (AC-18 animation clause superseded); Q-3 DPR 2/1.5/1.0 — user message`.
- `reviews/spec-review-r3.md` § Checkpoint summary items pins what the awaiting-approval summary had to present explicitly: Q-1 low-tier shadows fully off, Q-2 intro plays from its start at gate close (superseding the `user-authentication` AC-18 "keeps animating behind the overlay" animation clause while retaining the canvas/overlay markup), Q-3 `2 / 1.5 / 1.0`, and the named AC-18 supersession.
- The T5 checkpoint presentation requirement is therefore recorded as satisfied at the approval gate; this task did not re-run it.

Proposed feature-index row (for the orchestrator; `docs/features/README.md` intentionally unedited):
```
| adaptive-render-budget-v2 | Adaptive Render Budget v2 (gate-deferred renderer, GPU-scaled tiers, sorted p95) | planning | 2026-11-12 |
```

Acceptance audit:
- AC-15 → met: every changed behavior is covered by unit/integration tests with concrete values (T1–T4 logs plus the full-suite and coverage evidence above); `npm run coverage` exits 0 with statements/branches/functions/lines ≥ 80 in both workspaces; no new exclusion and no threshold change. Per workspace: backend 95.43/87.71/99.70/95.43, frontend 96.47/96.14/97.64/96.47.
- AC-16 → met: the README contains the exact AC-16 sentence (`grep -F` exit 0); `docs/architecture/frontend-rendering.md` exists with the four exact `##` sections (`grep -qx` exit 0); every relative link resolves; `git status --porcelain -- docs/features/README.md` is empty; the proposed index row is recorded above.
- AC-17 → met: the supersession ledger rows are present in `spec.md` § Supersessions; the three predecessor feature directories have an empty diff (exit 0).

Deviations from spec: none.

## Commit stat

`git show --stat --format=%s HEAD` after the first T5 commit:
```
docs: document adaptive render budget

 README.md                                          |   2 +-
 docs/architecture/frontend-rendering.md            |  73 ++++++
 .../adaptive-render-budget-v2/build-log-T5.md      | 222 +++++++++++++++++
 docs/features/adaptive-render-budget-v2/plan.md    | 248 +++++++++++++++++++++
 .../reviews/spec-review-r1.md                      |  68 ++++++
 .../reviews/spec-review-r2.md                      |  72 ++++++
 .../reviews/spec-review-r3.md                      |  70 ++++++
 docs/features/adaptive-render-budget-v2/spec.md    | 155 +++++++++++++
 docs/features/adaptive-render-budget-v2/status.md  |  38 ++++
 docs/features/adaptive-render-budget-v2/tasks.md   |  83 +++++++
 10 files changed, 1030 insertions(+), 1 deletion(-)
```
This stat matches the final T5 commit: the commit was amended with `git commit --amend --no-edit` only to carry this recorded stat and note, without changing the file list or line counts. The pre-existing `build-log-T1.md`–`build-log-T4.md` are not modified by T5; they were committed with their own tasks.
