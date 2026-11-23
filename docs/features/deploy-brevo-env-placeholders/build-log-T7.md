# Build log — T7 — Verify & integrate

Task: T7 (2026-11-23; the feature's T1–T6 ran 2026-11-22, the gate crossed local midnight)
Files changed: `docs/features/deploy-brevo-env-placeholders/build-log-T7.md` (this log) plus the integration commit that stages the orchestrator-authored artifacts (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/spec-r1.md`, `reviews/spec-r2.md`, build logs T1–T7). No application, workflow, container or configuration file was modified by T7.
What changed & why: Ran the complete T7 verify block verbatim and in order — `npm ci`, lint, typecheck, tests, coverage, build, the AC-1 protected-file/`.env*`/compose/smoke proof set, actionlint over both workflows, both config parses, the guard fixtures, the guard self-test, the T3/T4 workflow assertions, the extracted T6 documentation gate, and the extended credential guard over the tracked tree, untracked files, branch diff and branch history. Audited the concurrent `5469a7c` commit first. The deployed proof remains user-owned and is recorded as pending with the exact owner checklist. No failure was observed; no fix was needed outside this log.
Decisions: (1) `origin/main` is already at `5469a7c`, so every verbatim `origin/main...HEAD` command covers only the T6 commit; AC-1 and the credential guard are therefore also run over the true feature range `a4a3b6c..HEAD` (the pre-T1 commit), and both results are recorded. (2) The `.agents/skills/**` + `skills-lock.json` bulk in `5469a7c` is assessed as intended repository-state work from the `agent-skill-migration` feature, not a secret, code, workflow or deletion regression (details below). (3) Only this log is authored by T7; every other staged file is orchestrator-authored and untouched.

## Concurrent commit `5469a7c` audit (before the gate)

Commands run (raw results below): `git show --stat 5469a7c`, `git show --name-status 5469a7c`, a full diff review of its contents, the extended credential guard and a second common-secret scan over the diff, and a path audit for code/workflow/config changes.

```text
$ git show -s --format='%H%n%P%n%an <%ae>%n%ad%n%s' 5469a7c
5469a7c9048711af0ebe3a57944eb6efb2bab609
d2041ef3f9abfe21b0e9eeef9f1701a16babe198
Raul Torres <55553058+raultorres2603@users.noreply.github.com>
Sun Nov 22 20:05:37 2026 +0100
specs

$ git show --name-status --format='' 5469a7c | awk '{print $2}' | cut -d/ -f1 | sort | uniq -c
   2113 .agents
     12 docs
      1 README.md
      1 skills-lock.json

$ git show --name-status --format='' 5469a7c | awk '{print $1}' | sort | uniq -c
   2121 A
      6 M
      (0 D)

$ git show --name-status --format='' 5469a7c | grep -vE '^A\s+\.agents/'
M	README.md
M	docs/architecture/deployment.md
M	docs/architecture/vercel-render-neon.md
M	docs/features/README.md
A	docs/features/brevo-smtp-email-delivery/reviews/code-r1.md
M	docs/features/brevo-smtp-email-delivery/status.md
M	docs/features/brevo-smtp-email-delivery/tasks.md
A	docs/features/deploy-brevo-env-placeholders/plan.md
A	docs/features/deploy-brevo-env-placeholders/reviews/spec-r1.md
A	docs/features/deploy-brevo-env-placeholders/reviews/spec-r2.md
A	docs/features/deploy-brevo-env-placeholders/spec.md
A	docs/features/deploy-brevo-env-placeholders/status.md
A	docs/features/deploy-brevo-env-placeholders/tasks.md
A	skills-lock.json
```

Secret / regression / deletion checks (counts only; no matching content was printed):

```text
$ git show 5469a7c | grep -cE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
0
$ git show 5469a7c | grep -cE 'ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
0
$ git show --name-only --format='' 5469a7c | grep -cE '(^|/)(package-lock\.json|package\.json|compose[^/]*\.ya?ml|Dockerfile|render\.yaml|\.github/|src/)'
0
$ git show --name-only --format='' 5469a7c | grep -cE '(^|/)\.env'
0
$ git show --name-status --format='' 5469a7c | grep -E '^D'
(no output)
```

`.agents` content shape:

```text
$ find .agents/skills -mindepth 2 -maxdepth 2 -name SKILL.md | wc -l
72
$ node -e "const l=require('./skills-lock.json');console.log('version',l.version,'entries',Object.keys(l.skills||l).length)"
version 2 entries 72
$ find .agents -name '*.ts' | wc -l
0
```

Assessment: **no secret, no code/workflow/container regression, no destructive deletion, no `.env*` file.** The docs/feature part is the expected bookkeeping (this feature's `spec`/`plan`/`tasks`/`status`/reviews, the previous feature's acceptance row/status/review, and the deployment documentation T6 was writing — `git show 5469a7c:README.md` already contains `### Deployment Brevo runbook`, so the concurrent session swept the then-uncommitted T6 edits into this commit; T6's own commit captured the remaining corrections, and the current HEAD passes the full T6 gate). The `.agents/skills/**` (2,113 files, 72 imported packs) + `skills-lock.json` additions are outside this feature's scope but are the intended repository-state repair of the separate **`agent-skill-migration`** feature: its plan lists `.agents/skills/**` and `skills-lock.json` as T1 `commits_also` (plan lines 99, 111–112, 178; tasks line 21) and proves the lockfile with `version: 2`. They are inert vendored skill assets, not imported by the app, build, tests, lint (no `.ts` there; ESLint passed) or any workflow. Not a blocking unintended change; recorded as an integration observation instead. Note: the message `specs` is non-conventional and under-describes the skills tracking, and `git ls-remote` shows the remote `main` is already at `5469a7c` (this audit read the remote; nothing was pushed).

## Verification environment and range note

```text
$ git branch -vv
* main cb95d75 [origin/main: ahead 1] docs: document deployment Brevo environment runbook
$ git ls-remote origin refs/heads/main
5469a7c9048711af0ebe3a57944eb6efb2bab609	refs/heads/main
$ git log --oneline a4a3b6c..HEAD
cb95d75 docs: document deployment Brevo environment runbook
5469a7c specs
d2041ef chore: add deployment Brevo environment placeholders
38e405f ci: add Brevo guard fixture checks
fa56cb4 ci: guard and sync Brevo SMTP settings during deploy
5cdaa5c feat: add Render env deploy CLI
c33c3b2 feat: add deploy env guard and Render sync logic
$ git rev-parse c33c3b2^
a4a3b6ca38604711db43272184dba005b8bf50ad
$ podman --version
podman version 6.1.3
$ podman compose version
Docker Compose version v5.6.0
```

`origin/main` = `5469a7c` (T1–T5 and the docs are already on the remote), so the verbatim `git diff origin/main...HEAD` / `git log -p origin/main..HEAD` commands see only `cb95d75`. Every range-scoped AC-1/credential check below is run twice: verbatim, and over `a4a3b6c..HEAD` (the complete feature, starting at the pre-T1 commit). Both pass.

## Gate evidence (T7 verify order)

### 1. `npm ci`

```text
$ npm ci
...
added 399 packages, and audited 402 packages in 3m
...
14 vulnerabilities (12 moderate, 2 critical)
npm warn install-scripts 1 package has install scripts not yet covered by allowScripts: esbuild@0.28.2
EXIT=0
```

(The audit findings are pre-existing dependency advisories, not introduced here; `npm ci` installed 399 packages from the committed lockfile with exit 0.)

### 2. `npm run lint`

```text
$ npm run lint
> lint
> eslint .
EXIT=0
```

### 3. `npm run typecheck`

```text
$ npm run typecheck
> typecheck
> npm run typecheck --workspaces --if-present
> tsc --noEmit        (backend)
> tsc --noEmit        (frontend)
EXIT=0
```

### 4. `npm test`

```text
backend:
 Test Files  42 passed (42)
      Tests  1826 passed (1826)

deploy suites in the same run:
 ✓ src/deploy/render-env.test.ts (32 tests) 11ms
 ✓ src/deploy/render-env-cli.test.ts (21 tests) 515ms

frontend:
 Test Files  83 passed (83)
      Tests  2844 passed (2844)
EXIT=0
```

The CLI suite includes the process-boundary integration tier (`spawnSync(node --import tsx …render-env-cli.ts)`): `--help`, the exact AC-4(a) production block with exit 1, the exact AC-4(b) success line with exit 0, and the exact `--dry-run` lines with exit 0; T2's log records the focused 21/21 run.

### 5. `npm run coverage` (thresholds ≥ 80 per workspace)

Backend table:

```text
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.64 |    90.81 |   99.61 |   96.64 |
 src               |   96.72 |    91.45 |     100 |   96.72 |
  app.ts           |   95.74 |     88.5 |     100 |   95.74 | ...18-319,367-369
  cors.ts          |     100 |      100 |     100 |     100 |
 src/auth          |   96.17 |    83.69 |     100 |   96.17 |
  auth-routes.ts   |    81.4 |     55.3 |     100 |    81.4 | ...61-363,369-370
  auth-service.ts  |     100 |    81.87 |     100 |     100 | ...97,402,419,507
  config.ts        |     100 |      100 |     100 |     100 |
  ...repository.ts |   95.74 |     86.2 |     100 |   95.74 | ...77-778,834-847
  email-cli.ts     |    98.3 |    80.55 |     100 |    98.3 | 176-177
  ...l-template.ts |     100 |      100 |     100 |     100 |
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
 src/deploy        |   98.09 |    98.75 |     100 |   98.09 |
  ...er-env-cli.ts |      95 |    96.15 |     100 |      95 | 160-164
  render-env.ts    |     100 |      100 |     100 |     100 |
 src/game          |   96.25 |    94.92 |   99.13 |   96.25 |
  activity.ts      |     100 |      100 |     100 |     100 |
  broadcast.ts     |   97.12 |    95.65 |     100 |   97.12 | 137-138,231-232
  config.ts        |     100 |      100 |     100 |     100 |
  cubes.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  hub.ts           |   91.36 |    89.09 |   98.59 |   91.36 | ...1833,1920-1923
  leaderboard.ts   |     100 |      100 |     100 |     100 |
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts-v3.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  players.ts       |     100 |      100 |     100 |     100 |
  protocol.ts      |   99.36 |     99.2 |   97.77 |   99.36 | 477-478,1088-1089
  servers.ts       |   99.01 |    98.71 |     100 |   99.01 | 289-290
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
 src/observability |   99.67 |     96.5 |     100 |   99.67 |
  config.ts        |     100 |      100 |     100 |     100 |
  db-metrics.ts    |     100 |      100 |     100 |     100 |
  logging.ts       |     100 |      100 |     100 |     100 |
  metrics-route.ts |     100 |      100 |     100 |     100 |
  metrics.ts       |   99.45 |    93.54 |     100 |   99.45 | 251-252
  shutdown.ts      |     100 |    92.85 |     100 |     100 | 57
-------------------|---------|----------|---------|---------|-------------------
```

Frontend table:

```text
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   97.15 |    96.75 |   98.36 |   97.15 |
 src               |   88.38 |    86.12 |   95.65 |   88.38 |
  App.tsx          |   86.72 |    83.25 |   96.42 |   86.72 | ...35-437,459-460
  browser-env.ts   |   93.65 |      100 |   92.85 |   93.65 | 76-79
  config.ts        |     100 |      100 |     100 |     100 |
 src/auth          |   96.85 |     86.2 |   96.15 |   96.85 |
  api.ts           |   96.44 |     87.5 |     100 |   96.44 | ...61-162,170,222
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193
 src/game          |   97.02 |    99.51 |   99.16 |   97.02 |
  board.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  effects.ts       |     100 |      100 |     100 |     100 |
  engine.ts        |   99.48 |      100 |     100 |   99.48 | 987-988,1297-1298
  motion.ts        |     100 |      100 |     100 |     100 |
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts-v3.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  progression.ts   |     100 |      100 |     100 |     100 |
  reveal-motion.ts |     100 |      100 |     100 |     100 |
  rotation.ts      |     100 |      100 |     100 |     100 |
  session.ts       |   91.51 |    98.96 |   97.61 |   91.51 | ...1852,1989-1990
  ship-forms.ts    |     100 |      100 |     100 |     100 |
  types.ts         |     100 |      100 |     100 |     100 |
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
 src/input         |     100 |      100 |     100 |     100 |
  gestures.ts      |     100 |      100 |     100 |     100 |
  keyboard.ts      |     100 |      100 |     100 |     100 |
 src/multiplayer   |   95.77 |    97.56 |   98.03 |   95.77 |
  ...y-lifetime.ts |     100 |      100 |     100 |     100 |
  protocol.ts      |   93.47 |    97.41 |   95.65 |   93.47 | ...1706,1710-1721
  server-state.ts  |   97.97 |    96.15 |     100 |   97.97 | ...44,446-447,510
  spectate.ts      |     100 |      100 |     100 |     100 |
  transport.ts     |   99.49 |      100 |     100 |   99.49 | 200
 src/perf          |     100 |      100 |     100 |     100 |
  overlay.ts       |     100 |      100 |     100 |     100 |
 src/render        |   98.68 |    98.84 |   98.98 |   98.68 |
  ...round-life.ts |     100 |      100 |     100 |     100 |
  ...c-backdrop.ts |      99 |      100 |     100 |      99 | 299-300
  cube-view.ts     |   99.29 |      100 |     100 |   99.29 | 344-345
  cursor-ship.ts   |   99.58 |    98.18 |     100 |   99.58 | 228-229
  ...ct-effects.ts |   98.64 |      100 |     100 |   98.64 | ...49-350,474-475
  ...box-reveal.ts |     100 |      100 |     100 |     100 |
  nebula.ts        |     100 |      100 |     100 |     100 |
  particles.ts     |     100 |      100 |     100 |     100 |
  picking.ts       |     100 |      100 |     100 |     100 |
  ...processing.ts |     100 |      100 |     100 |     100 |
  preview.ts       |     100 |      100 |     100 |     100 |
  quality.ts       |   98.31 |      100 |     100 |   98.31 | 316-317,400-401
  remote-ship.ts   |     100 |    97.93 |     100 |     100 | 509,516
  scene.ts         |   97.32 |      100 |     96 |   97.32 | ...1202,1210-1211
  ship-motion.ts   |     100 |      100 |     100 |     100 |
  shot-visuals.ts  |     100 |      100 |     100 |     100 |
  ...ship-model.ts |     100 |      100 |     100 |     100 |
  spaceship.ts     |   96.33 |      100 |   97.29 |   96.33 | ...23-724,750-753
  ...ate-travel.ts |     100 |      100 |     100 |     100 |
  starfield.ts     |     100 |      100 |     100 |     100 |
  targeting.ts     |   95.78 |      100 |     100 |   95.78 | ...64-166,178-179
  webgl.ts         |     100 |      100 |     100 |     100 |
  world.ts         |   97.56 |    90.98 |     100 |   97.56 | ...09-510,544-545
 src/ui            |   97.38 |    94.93 |   97.27 |   97.38 |
  ActivityFeed.tsx |     100 |      100 |     100 |     100 |
  AuthForms.tsx    |     100 |      100 |     100 |     100 | 219
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |
  ...ionToggle.tsx |     100 |      100 |     100 |     100 |
  ...tionPanel.tsx |   91.66 |    86.66 |     100 |   91.66 | 60-61,66-67
  GameCanvas.tsx   |   96.61 |       95 |     100 |   96.61 | 62-63
  Hud.tsx          |     100 |      100 |     100 |     100 |
  Leaderboard.tsx  |     100 |      100 |     100 |     100 |
  ...eteBanner.tsx |     100 |      100 |     100 |     100 |
  ...boxReveal.tsx |   98.24 |    94.89 |     100 |   98.24 | 154-155,275-276
  PerfOverlay.tsx  |   98.52 |      100 |     100 |   98.52 | 84
  ...tionPanel.tsx |   96.35 |    91.33 |     100 |   96.35 | ...05-406,435-436
  ...ipPreview.tsx |   86.99 |    77.41 |      75 |   86.99 | ...27-128,133-134
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
```

Both workspaces are ≥ 80 on all four metrics. The new `src/deploy` area is `98.09 / 98.75 / 100 / 98.09` with `render-env.ts` at 100 on every metric. `EXIT=0`.

### 6. `npm run build`

```text
...
dist/assets/three-Ddozhxko.js                        610.56 kB │ gzip: 154.65 kB
✓ built in 1.59s
entry index assets/index-CouI9G8n.js raw=108805 gzip=33034
initial files=2 raw=330504 gzip=101990 budget=150000
three assets/three-Ddozhxko.js raw=610563 gzip=154647 budget=165000
chunk three assets/three-Ddozhxko.js raw=610563 gzip=154647 initial=false
Bundle budget OK.
EXIT=0
```

### 7. AC-1(a) protected-file diff and `.env*` check

```text
$ git diff --exit-code origin/main...HEAD -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/backend/src/app.ts render.yaml src/backend/src/auth
verbatim protected diff exit=0
$ git diff --exit-code a4a3b6c..HEAD -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/backend/src/app.ts render.yaml src/backend/src/auth
feature-range protected diff exit=0
$ test -z "$(git diff --name-only origin/main...HEAD -- '.env*')"
verbatim .env diff: empty (pass)
$ test -z "$(git diff --name-only a4a3b6c..HEAD -- '.env*')"
feature-range .env diff: empty (pass)
```

### 8. AC-1(b) hermetic compose config

```text
$ env -u SMTP_HOST -u SMTP_PORT -u SMTP_USER -u SMTP_PASS -u SMTP_SECURE -u SMTP_FROM -u SMTP_CONNECTION_TIMEOUT_MS \
    podman compose --env-file /dev/null -f compose.yaml config | node -e "...assert backend SMTP_HOST=mailpit and SMTP_PORT=1025..."
compose backend SMTP resolves to mailpit:1025 with no SMTP env
EXIT=0
```

(The provider banner `Executing external compose provider /usr/local/bin/docker-compose` is informational stderr; the assertion reads stdout.)

### 9. AC-1(c) clean stack, Mailpit and the containerized smoke

```text
$ podman compose -f compose.yaml -f compose.smoke.yaml down --remove-orphans
 Container cubeclicker-frontend-1 Removed
 Container cubeclicker-mailpit-1 Removed
 Container cubeclicker-adminer-1 Removed
 Container cubeclicker-backend-1 Removed
 Container cubeclicker-db-1 Removed
 Network cubeclicker_default Removed
EXIT=0

$ podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit
 Container cubeclicker-mailpit-1 Started
EXIT=0

$ npm run smoke
smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 1
PASS activity snapshot: A's welcome feed is empty and B's welcome carries exactly A's memberJoined event — server 1; memberJoined id 1 for p1
PASS appearance projection: guest B's 11-slot setAppearance yields exactly one memberAppearance on guest A, and an unknown slot key yields bad_message without a broadcast — playerId p2; 11 slots; unknown slot key rejected with bad_message; 1 memberAppearance frame(s) seen by A
PASS leaderboard join: A's welcome is a one-entry zero snapshot and B's welcome carries A and B with zero counters and totals — server 1
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 2
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer batching: two explodes in one turn yield one miniCubesRemoved [front:0:1, front:0:2] on A (ack) and B (broadcast)
PASS multiplayer batching: front:0:1 and front:0:2 never arrive as single miniCubeRemoved frames on A or B
PASS leaderboard update: the accepted explodes yield a coalesced leaderboardUpdate with A clicks >= 3, B clicks = 0 and totals clicks >= 3 — A clicks 3, B clicks 0, totals clicks 3
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1003ms
PASS activity leave: A receives the memberLeft activity event with B's name and an id newer than the snapshot id — memberLeft id 2 for p2
PASS multiplayer explicit leave: D's leave yields memberLeft(left) on A in under 900ms without the grace window — memberLeft(left) received after 1ms
PASS multiplayer slot reuse: E fills D's freed slot 2 with welcome.roster exactly [A, E] — server 1; roster [A, E] in D's freed slot 2
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS metrics: a joined client sees the Prometheus endpoint with connections_open and servers_active >= 1 and live frame/join counters — cubeclicker_ws_connections_open=1 cubeclicker_servers_active=1 cubeclicker_ws_connections_total=9 cubeclicker_ws_messages_received_total{type="join"}=7 cubeclicker_ws_frames_sent_total{type="hello"}=9
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-CrRKL0ON.js is served gzip with immutable caching — content-encoding gzip; 108871 B decompressed
PASS prod /assets/three-Ddozhxko.js is served gzip with immutable caching — content-encoding gzip; 610563 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (29/29 checks)
EXIT=0
```

The smoke rebuilt and started the backend image with `src/backend/src/deploy/render-env.ts` present (the module is inert: nothing in `server.ts`/`app.ts` imports it) and passed every check, including Mailpit-backed registration/verification.

### 10. `actionlint` over both workflows

```text
$ podman run --rm -v "$PWD:/repo:z" -w /repo docker.io/rhysd/actionlint:1.7.12 .github/workflows/*.yml
[no output]
EXIT=0
```

### 11. Config parses

```text
$ node -e "JSON.parse(require('node:fs').readFileSync('src/frontend/vercel.json','utf8'));console.log('vercel.json: valid JSON')"
vercel.json: valid JSON
$ node -e "const fs=require('node:fs');const yaml=require('js-yaml');const b=yaml.load(fs.readFileSync('render.yaml','utf8'));...check one service, cubeclicker-development, docker, free..."
render.yaml: valid YAML
EXIT=0
```

### 12. Guard fixtures (AC-4(a), AC-4(b), AC-6)

Reject fixture (`--check-only`, pinned production placeholder set):

```text
$ code=0; env TARGET_ENVIRONMENT=production RENDER_SERVICE_ID='<CHANGEME-render-service-id>' RENDER_API_KEY='<CHANGEME-render-api-key>' SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='<CHANGEME-verified-sender>' SMTP_USER='<CHANGEME-smtp-login>' SMTP_PASS='<CHANGEME-smtp-key>' npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only || code=$?
Deploy blocked: the 'production' environment has 5 unset or placeholder value(s).
  Placeholder: SMTP_FROM, SMTP_USER, SMTP_PASS, RENDER_SERVICE_ID, RENDER_API_KEY
Remediation (names only; never paste a value into a command argument):
  variables: gh variable set <NAME> --env production --repo raultorres2603/CubeClicker
  secrets:   gh secret set <NAME> --env production --repo raultorres2603/CubeClicker
Runbook: README.md § Deployment Brevo runbook
exit=1
ASSERT exit=1 passed
```

Accept and dry-run fixtures (complete `development` set):

```text
$ env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='CubeClicker <no-reply@example.com>' SMTP_USER=fixture SMTP_PASS=fixture npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only | grep -qx "Deploy configuration OK: 9 value(s) present for the 'development' environment."
check-only exit=0
$ env TARGET_ENVIRONMENT=development RENDER_SERVICE_ID=srv-fixture RENDER_API_KEY=fixture-key SMTP_HOST=smtp-relay.brevo.com SMTP_PORT=587 SMTP_SECURE=false SMTP_CONNECTION_TIMEOUT_MS=10000 SMTP_FROM='CubeClicker <no-reply@example.com>' SMTP_USER=fixture SMTP_PASS=fixture npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --dry-run | grep -qx "DRY RUN complete: 9 value(s) validated for the 'development' environment; 7 would be synced; no network calls made."
dry-run exit=0
```

### 13. Guard self-test (AC-9(a))

```text
$ node -e "...synthetic RENDER_API_KEY= + 16 chars, rnd_ + 24 chars, SMTP_PASS= + 15 chars, xkeysib- + 20, xsmtpsib- + 15 must match; <CHANGEME-…> and 11-char fixture-key must not..."
credential guard self-test: Render/SMTP key shapes matched, placeholders allowed
EXIT=0
```

### 14. T3/T4 workflow assertions

```text
$ node -e "<deploy.yml step-order assertion>"
deploy.yml step order OK
vars.SMTP_HOST count=2 OK
vars.SMTP_PORT count=2 OK
vars.SMTP_SECURE count=2 OK
vars.SMTP_CONNECTION_TIMEOUT_MS count=2 OK
vars.SMTP_FROM count=2 OK
vars.RENDER_SERVICE_ID count=2 OK
secrets.SMTP_USER count=2 OK
secrets.SMTP_PASS count=2 OK
secrets.RENDER_API_KEY count=2 OK
check-only invocation present
sync invocation present
no continue-on-error
feature-base deploy.yml diff changes no uses/permissions/concurrency line
T3 ASSERTIONS OK

$ grep -q 'Guard rejects placeholder values' .github/workflows/ci.yml
reject step name OK
$ grep -q 'Guard accepts a complete value set' .github/workflows/ci.yml
accept step name OK
$ grep -q 'npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only' .github/workflows/ci.yml
CLI invocation present
$ grep -q "Deploy blocked: the 'production' environment has 5 unset or placeholder value(s)." .github/workflows/ci.yml
reject expected string OK
$ grep -q "Deploy configuration OK: 9 value(s) present for the 'development' environment." .github/workflows/ci.yml
accept expected string OK
$ test "$(grep -c 'npx --no-install tsx src/backend/src/deploy/render-env-cli.ts --check-only' .github/workflows/ci.yml)" -eq 2
CLI invocation count=2 OK
$ test "$(grep -c "Deploy blocked: the 'production' environment has 5 unset or placeholder value(s)." .github/workflows/ci.yml)" -eq 1
reject string count=1 OK
$ test "$(grep -c "Deploy configuration OK: 9 value(s) present for the 'development' environment." .github/workflows/ci.yml)" -eq 1
accept string count=1 OK
T4 ASSERTIONS OK
```

### 15. T6 documentation gate re-run (verbatim extraction)

```text
$ bash -c "$(sed -n '/^## T6 /,/^## T7 /p' docs/features/deploy-brevo-env-placeholders/tasks.md | sed -n '/^```bash/,/^```/p' | sed '1d;$d')"
README verify-workflows guard steps OK
README What the pipelines run deploy order OK
README Deploy flow order OK
deployment.md verify-workflows guard steps OK
deployment.md deploy pipeline order OK
deployment.md platform split deploy order OK
vercel-render-neon architecture deploy order OK
vercel-render-neon routine deploy order OK
T6_VERIFY_EXIT=0
```

Every `grep -qF`/`grep -qE`/negative grep and the eight section-order `node -e` assertions in the T6 block passed; the block is the reproducible documentation gate.

### 16. Extended credential guard and build-log guard

All commands below ran after this log existed, so the build-log guard covers this file. Exit `0` on a negated command means "no match = clean".

```text
$ test -f docs/features/deploy-brevo-env-placeholders/build-log-T7.md
exit=0
$ ! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/deploy-brevo-env-placeholders/build-log-T7.md
exit=0 (no match)
$ ! git grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
tracked tree exit=0
$ ! git grep --untracked -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
untracked files exit=0
$ ! git diff origin/main...HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
branch diff (verbatim) exit=0
$ ! git log -p origin/main..HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
branch history (verbatim) exit=0
$ ! git diff a4a3b6c..HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
feature diff a4a3b6c..HEAD exit=0
$ ! git log -p a4a3b6c..HEAD | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
feature history a4a3b6c..HEAD exit=0
$ ! git show 5469a7c | grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}"
commit 5469a7c diff exit=0
$ git diff --check
diff-check exit=0
```

Only exit codes are recorded (the commands print no matching content); exit `0` after `!`/with `exit=0` means the guard found nothing.

## Acceptance audit — AC-1…AC-12

- **AC-1 — local development is unchanged. Met.**
  - (a) `git diff --exit-code origin/main...HEAD -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/backend/src/app.ts render.yaml src/backend/src/auth` → exit `0`; the same over the full feature range `a4a3b6c..HEAD` → exit `0`. `git diff --name-only … -- '.env*'` → empty for both ranges. Evidence in §7.
  - (b) `podman compose --env-file /dev/null -f compose.yaml config` (with all seven SMTP variables unset) → backend `SMTP_HOST=mailpit`, `SMTP_PORT=1025`; assertion exit `0`. §8.
  - (c) `down --remove-orphans` → exit `0`; `up -d mailpit` → exit `0`; `npm run smoke` → `SMOKE PASS (29/29 checks)`, exit `0`, including Mailpit delivery and WebSocket/health checks with the new deploy module in the image. §9.
- **AC-2 — catalog and classification pinned. Met.**
  - (a) `src/backend/src/deploy/render-env.ts` defines `SMTP_CATALOG` as exactly `SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE`/`SMTP_CONNECTION_TIMEOUT_MS`/`SMTP_FROM` (variable) then `SMTP_USER`/`SMTP_PASS` (secret), `RENDER_WIRING` as `RENDER_SERVICE_ID` (variable) and `RENDER_API_KEY` (secret), and `CATALOG = [...SMTP_CATALOG, ...RENDER_WIRING]` (9). `render-env.test.ts` (`deployment catalog (AC-2)`, three tests) asserts the exact arrays (lengths 7/2/9, key/source pairs) and the seven sync keys; the full suite ran them (32 tests in the file). `src/deploy` coverage is 98.09/98.75/100/98.09.
  - (b) The documented values are the pinned literals: README runbook and architecture docs carry the nine names with `<CHANGEME-…>` placeholders and the four non-secret constants; the T5 log records the exact created-name `--body` commands (`false`, `10000`, `srv-dbtcvv9srm7s73au5bag`, `<CHANGEME-render-api-key>`; production's nine) and the `preserved (existing)` entries for the pre-existing `development` values. No real credential appears (guards clean, §16). The `development` `RENDER_API_KEY` remains the one pre-merge placeholder by owner decision, which is correct for AC-2(b)'s preserve branch.
- **AC-3 — pure missing/placeholder classification. Met.** `isPlaceholder` is `value.includes('CHANGEME')` (case-sensitive) and false for empty; `validateDeployEnv` classifies all nine in catalog order with whitespace-only = missing and returns `ok: true` only when all nine are real. Tests: `isPlaceholder (AC-3)` and `validateDeployEnv (AC-3)` (development/production placeholder sets, empty environment all-missing, whitespace order, all-real success). T1's focused run and the T7 full suite both pass.
- **AC-4 — guard refuses and says what to fix. Met.**
  - (a) The production fixture prints exactly the seven-line block (header, `Placeholder: SMTP_FROM, SMTP_USER, SMTP_PASS, RENDER_SERVICE_ID, RENDER_API_KEY`, remediation names-only lines, runbook line) and exits `1` (§12); `formatGuardFailure` tests pin the `Missing:`-before-`Placeholder:` order and the missing-only case.
  - (b) The complete development fixture prints exactly `Deploy configuration OK: 9 value(s) present for the 'development' environment.` and exits `0` (§12).
  - (c) `--help` prints exactly the usage and returns `0` without a fetch; unknown options print `Unknown option: <option>` plus usage and return `1` without reading the environment; both unit- and process-tested in `render-env-cli.test.ts` (T2 log, 21/21 focused).
- **AC-5 — validate nine, write exactly seven, verify each write. Met.** `syncRenderEnv` iterates `SMTP_CATALOG` only; tests `syncRenderEnv success/failures (AC-5)` assert exactly seven PUTs in order with the pinned URL, `authorization: Bearer …`/`content-type: application/json`, body exactly `{"value":"…"}` (quote/backslash escaping), `SYNCED <KEY> (value verified, not shown)` ×7, `Synced 7 value(s) to Render service <id> for the '<env>' environment.`, non-2xx `Render API error for <KEY>: HTTP <status> (<code>)` with stop-on-first-failure and no body text, timeout `Render API request for <KEY> timed out after 10000ms`, generic `… failed: <sanitized>` with every configured value/API key/`rnd_` shape redacted, value/key mismatch abort, unparseable echo; the wiring names never appear in a body, the service ID only in the URL path, the API key only in the authorization header, and a stray `RENDER_API_KEY` property on the payload is ignored. The CLI default-mode tests repeat the seven-PUT/no-wiring assertions through `runRenderEnvCli`.
- **AC-6 — check-only and dry-run are network-free. Met.** `--dry-run` prints seven `DRY RUN: would set <KEY> (PUT …)` lines in catalog order plus `DRY RUN complete: 9 value(s) validated for the '<env>' environment; 7 would be synced; no network calls made.` and exits `0`; the CLI tests inject a throwing fetch for both modes and assert it is never called. The shell dry-run fixture exits `0` (§12).
- **AC-7 — deploy workflow validates then syncs in the right place. Met.**
  - (a) T3 assertions: step order install → check → migration → sync → Render backend → waits → health → Vercel → smoke; 6 `vars.*` names ×2 and 3 `secrets.*` names ×2 (18 bindings); `--check-only` and no-flag CLI invocations present; no `continue-on-error` (§14). The feature-base diff changes no `uses:`/`permissions:`/`concurrency:` line.
  - (b) `actionlint` over both workflows exits `0`; no action or `uses:` was added.
  - (c) `vercel.json` JSON parse and `render.yaml` YAML parse both pass (§11).
- **AC-8 — CI proves the guard without credentials. Met.** `ci.yml` contains both guard steps, the exact `--check-only` invocation exactly twice, each expected string exactly once, and the local reproduction of both fixture steps exits `1`/`0` as required (§12, §14); `actionlint` passes. The fixtures use YAML mappings, not `NAME=` strings, and every value is an angle-bracket placeholder or shorter than 12 characters (the extended guard is clean).
- **AC-9 — secret hygiene. Met.**
  - (a) Only the pinned non-secret constants and `<CHANGEME-…>` placeholders are committed. The extended guard is clean over the tracked tree, untracked files, verbatim branch diff/history, the full feature diff/history and the `5469a7c` diff (§16); the self-test proves synthetic `RENDER_API_KEY=`/16 chars, `rnd_`/24 chars, `SMTP_PASS=`/15 chars and both Brevo key shapes match, while `<CHANGEME-render-api-key>` and the 11-character `fixture-key` do not (§13).
  - (b) Every CLI success/dry-run/help/guard/error test asserts no configured value or API key appears; T1/T2 logs record the focused 53 tests.
  - (c) T5's names-only listings show `SMTP_USER`, `SMTP_PASS`, `RENDER_API_KEY` as secrets and the other six as variables in both environments, with no `SMTP_USER` variable remaining; the migration commands and `preserved (existing)` entries are recorded; values were never printed.
  - (d) `RENDER_API_KEY` is never a Render service variable or request body (AC-5 tests and the wiring guard); `render.yaml` remains value-free; the smoke image built from the same tree and no tracked file carries a real value (guard).
- **AC-10 — production stays unprovisioned and fails clearly. Met.**
  - (a) The T5 log records the nine `production` placeholder `--body` command lines and the final names-only listing (six variables, three secrets; only the four environment-independent constants are real). The T6/AC-12 greps confirm `placeholder-only` documentation.
  - (b) The workflow offers only the `production` choice, keeps the CI-SHA preflight, and runs `Check deployment Brevo configuration` before the Neon migration and every provider step (T3 order assertion); the production fixture fails at the guard with the AC-4(a) block naming `RENDER_SERVICE_ID` and the other placeholders before any network call (§12). No live dispatch was run (the spec's evidence is the fixture + order).
- **AC-11 — operator runbook exists and is executable. Met.** The extracted T6 block exits `0` (§15), including: (a) the 18 exact per-environment `gh variable set`/`gh secret set` lines with `--repo raultorres2603/CubeClicker`; (b) `Settings → Environments`, `Environment variables`/`Environment secrets`, used only for entering values, `never as verification evidence`; (c) the four names-only lists, the `.environments[].name` form and both single-environment fallbacks (the wrong `'.[].name'` form absent); (d) the stdin/never-argv rule; (e) `Deployed proof (user-owned)` with seven `SYNCED <KEY>` lines, the `Render deploy list` check, `Render dashboard lists the seven keys`, `curl -fsS "$VITE_API_URL/healthz"`, a registration from the deployed frontend, the local `npm run email:test` equivalent and the no-shell caveat; (f) rollback/correction/re-run, `Deploys → Rollback`, `rotate it in Render`; (g) merge ordering `before this feature merges to main` + `preserved development values are already in place`; (h) the conditional `SMTP_USER` migration in both environments, the `variables and secrets are separate` rationale, and the production no-variable note; (i) the preserve note with the four created names and the stdin move; (j) `nine validated, seven synced`, `never written to the Render service`, `GitHub Environment is the source`, and the dashboard-edit reversion rule.
- **AC-12 — architecture and README docs match behavior. Met.** The same extracted T6 block (all greps and eight section-order assertions) exits `0` (§15): `deployment.md` secrets/variables lists, `nine validated, seven synced`, `never written to the Render service`, `placeholder-only`, `no Render service, Vercel project or Neon branch is provisioned`, the check → migration → sync → hook order in § Platform split and § Deploy pipeline, the CI guard steps, and all old phrases gone (a, c, f, h); `vercel-render-neon.md` environment-catalog rows (`RENDER_API_KEY` secret, `RENDER_SERVICE_ID` var, `SMTP_USER` secret, no `SMTP_USER` var), deploy order, `Placeholder guard`, `GitHub Environment (synced to Render for the seven SMTP names)`, production statements and removed stale sentences (b, c, g, h); README § Email, § Secret hygiene, § User-side asset checklist, § What the pipelines run and § Deploy flow corrected, with the extended guard and branch-history command (d, e, h).

## Deployed proof — user-owned and pending by design

Not run by an agent; no real `RENDER_API_KEY` was supplied or used, and no live Render/Vercel/Brevo call was made. The exact owner checklist:

1. **Fill the development Render key (pre-merge, Q-1).** Create a workspace-scoped Render key with the minimum env-var permission, then store it without putting it on a command line:
   `gh secret set RENDER_API_KEY --env development --repo raultorres2603/CubeClicker` (enter the value at the prompt, or pipe it on stdin). The preserved `development` values stay as they are.
2. **Run the first development deploy** from `main` (push) or re-run the Deploy workflow after the merge; open the Actions run for the environment.
3. **Confirm the sync:** the `Sync Brevo SMTP settings to Render` step shows one `SYNCED <KEY> (value verified, not shown)` line per SMTP name — seven lines — and the summary `Synced 7 value(s) to Render service srv-dbtcvv9srm7s73au5bag for the 'development' environment.`
4. **Confirm the sync did not deploy:** in Render → the service → **Deploys**, no deploy starts between the sync step and the `Deploy Render backend` hook. If one does, record it and apply the documented mitigation (cancel before the hook, or let both finish and re-run the post-deploy checks).
5. **Confirm the keys:** the Render dashboard environment lists the seven names (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASS`) and does not list `RENDER_SERVICE_ID`/`RENDER_API_KEY`.
6. **Health:** `curl -fsS "$VITE_API_URL/healthz"` returns `{"status":"ok"}`.
7. **Delivery:** register from the deployed frontend with a mailbox the owner controls and confirm the branded verification email arrives; the local `npm run email:test` with the same credentials is the Render-free equivalent (a Render free service has no shell).
8. **Record the redacted result** (SYNCED key names, timestamps, health output, delivery confirmation) in the feature artifacts; never record a value.

`production` remains placeholder-only and unprovisioned; its dispatch is expected to stop at `Check deployment Brevo configuration` until a production key/service exists.

## Proposed `docs/features/README.md` row (not applied — orchestrator-owned)

```diff
 | brevo-smtp-email-delivery | Brevo SMTP Email Delivery & Branded Verification Email (...) | accepted | 2026-11-22 |
+| deploy-brevo-env-placeholders | Deployment Brevo Environment Placeholders (GitHub Environment source of truth for nine names, nine validated/seven synced to Render, strict CHANGEME guard, placeholder-only production, operator runbook) | building | 2026-11-23 |
```

(The orchestrator sets the final state/date on acceptance; this row is a proposal only, per the spec's non-goal.)

## Merge-ordering checkpoints

- **`development` `RENDER_API_KEY` must be filled before this feature merges to `main`.** The preserved `development` values are already in place (only the missing `SMTP_SECURE`, `SMTP_CONNECTION_TIMEOUT_MS`, `RENDER_SERVICE_ID` and the placeholder `RENDER_API_KEY` were created); the strict guard fails closed on the placeholder, so the first `development` deploy after merge is blocked until step 1 of the checklist is done.
- **`production` remains placeholder-only** until the Render service, Vercel project, Neon branch and protection rules are provisioned by a separate change; its dispatch must fail at the Brevo guard, not at the Neon migration.

## Testing note

T7 changes no production code, so it adds no behavior tests; the feature's tiers were delivered in T1/T2 and are re-run here: unit tests for the pure catalog/guard/sync and the CLI (`render-env.test.ts` 32, `render-env-cli.test.ts` 21, including the process-boundary integration tier), the workflow-artifact integration assertions (actionlint, ordering/bindings, config parses, CI fixture reproduction) and the containerized cross-service smoke (29/29). Coverage is above the 80 gate in both workspaces. No assertion was weakened and no test was added or removed.

## Deviations and observations

- **Range compensation.** The verbatim `origin/main...HEAD` AC-1 and credential-guard commands cover only `cb95d75` because `origin/main` already contains T1–T5 + `5469a7c`; the full feature range `a4a3b6c..HEAD` was run alongside and also passes. Recorded, not a spec deviation.
- **Concurrent commit `5469a7c`.** Audited above: docs/feature bookkeeping plus the separate `agent-skill-migration` skills tracking; no secrets, no app/workflow/container changes, no deletions. Its message is non-conventional and the remote `main` already points at it; no history was rewritten. No blocking question arose.
- **Pending orchestrator bookkeeping.** The brief's pending updates to `docs/features/README.md` and `docs/features/brevo-smtp-email-delivery/status.md` were already contained in `5469a7c`; the working tree had no pending changes for them. The only pending working-tree changes were the orchestrator's T6 completion bookkeeping in this feature's `status.md`/`tasks.md`, staged as authored and not edited.
- No other deviation from the spec.

## Status and integration

`git status --short` before the integration commit: the two orchestrator bookkeeping edits (`docs/features/deploy-brevo-env-placeholders/status.md`, `tasks.md`) plus this new (untracked) log; no other untracked files. The earlier artifacts (`spec.md`, `plan.md`, `reviews/spec-r1.md`, `reviews/spec-r2.md`, build logs T1–T6, `docs/features/README.md`, the previous feature's `status.md`) are already tracked through `5469a7c`/`cb95d75`; staging them again is a no-op that keeps the integration commit complete. The integration commit stages `spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/spec-r1.md`, `reviews/spec-r2.md`, build logs T1–T7 and this log with the message `test: verify deployment Brevo environment placeholders`. Nothing was pushed; no `.env*`, secret or out-of-scope file was touched.
