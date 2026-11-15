# Build log — T2 — Remove imported allow-list entries and rewrite skill policy docs

Task: T2 (2026-11-15) — `docs/features/project-only-skills/tasks.md` (acceptance: AC-3, AC-4, AC-5, AC-6, AC-7; gate contribution to AC-10)

BASE_SHA=7b87cbbfc6821bc2664c3062de0e42d57043a031

T1 commit on top of `BASE_SHA`: `18d5010 chore: remove imported skill packs and lockfile` (the deletion is already committed; this task edits only the agent allow-lists, the policy docs, and this log).

## Files changed

- `.opencode/agents/planner.md` — removed the `writing-plans` allow rule (3 lines) and the "Imported skills are advisory …" bullet; remaining `skill` rules: `*` deny, `spec-authoring` allow, `task-decomposition` allow.
- `.opencode/agents/builder.md` — removed all 16 imported allow rules (48 lines) and the advisory bullet; remaining `skill` rules: `*` deny, `web-implementation` allow.
- `.opencode/agents/reviewer.md` — removed `systematic-debugging` and `verification-before-completion` allow rules (6 lines) and the advisory bullet; remaining `skill` rules: `*` deny, `spec-review` allow, `code-review` allow.
- `docs/architecture/skills.md` — rewritten as the project-only policy: `## Canonical location`, `## Precedence and ID rules`, `## Per-agent skill policy`, `## Maintenance`, `## Verification`, `## History`; six project IDs, the four allow-lists, and Context7 MCP as the library/platform documentation source.
- `AGENTS.md` — deleted the `.agents/skills/` Project-structure bullet; rewrote the Skills convention line to name `.opencode/skills/` only and link `docs/architecture/skills.md`.
- `README.md` — rewrote the `docs/architecture/skills.md` bullet in `## Stack` (six project skills, per-agent allow-lists, `skill` rule contract, Context7 MCP).
- `docs/architecture/documentation.md` — audit only: no stale reference found; empty diff vs `BASE_SHA`; no edit made (AC-7).
- `docs/features/project-only-skills/build-log-T2.md` — this log.

Not touched: `.opencode/agents/orchestrator.md` (audited; already project-only and byte-identical to `BASE_SHA`), `.opencode/skills/**`, `src/**`, `tests/**`, `compose*.yaml`, `.github/**`, `opencode.jsonc`, `package*.json`, Dockerfiles, and the pre-existing `M docs/features/vercel-fly-neon-deployment/status.md` (recorded by T1, never edited/staged/committed).

## What changed & why (≤5 lines)

1. Each edited agent now carries exactly `skill "*" deny` followed by its project-skill allows in the documented order; every imported ID and all three advisory bullets are gone.
2. `docs/architecture/skills.md` is now the single-source project-only policy and points library/platform documentation at Context7 MCP instead of vendored packs.
3. `AGENTS.md`/`README.md` no longer describe a second skill source; `docs/architecture/documentation.md` needed no change.
4. All four agents' ordered non-skill permission rules are identical to `BASE_SHA`; the total `action: skill` counts equal the parsed skill rules (orchestrator 2/2, planner 3/3, builder 2/2, reviewer 3/3).
5. Gates green: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (all four metrics ≥ 80 in both workspaces).

## Decisions

- **Orchestrator audited, unchanged.** It already had exactly `skill "*" deny` + `orchestration-playbook` allow; the parity parser confirms its frontmatter matches `BASE_SHA` byte-for-byte (it is absent from `git diff --name-status`).
- **Only `skill` rules and one bullet per edited agent.** No `edit`, `shell`, `subagent`, or `question` rule changed: the parser's ordered non-skill comparison against `BASE_SHA` passes, with equal counts in both parses (orchestrator 9, planner 12, builder 31, reviewer 10).
- **Advisory bullets deleted, not replaced** (task note) — no replacement text reintroduces a second skill source.
- **`documentation.md` audit produced an empty diff.** `grep -niE '\.agents|skills-lock|imported|advisory'` matched nothing; the `docs/architecture/skills.md` reference remains; `.opencode/skills/orchestration-playbook/SKILL.md` exists; `git diff --exit-code "$BASE_SHA" -- docs/architecture/documentation.md` exits 0. No edit was made, per plan § Documentation contract.
- **History wording is slug-only** (`agent-skill-migration`, `project-only-skills`) and says "third-party packs and installer lockfile" rather than reintroducing a removed path or filename (spec Q-2).
- **Unit tier = the static assertions below.** This feature changes repository content and agent configuration, not runtime code (spec § Testing strategy), so no `*.test.ts` is added; the deterministic parser/scans are the unit tier and `lint`/`typecheck`/`test`/`coverage` are the integration gate.
- **Post-commit assertions live in the Subagent Report** (T1 precedent): the commit and the post-commit scoped `git status` run after this log exists, so their output cannot be contained in the commit that creates the log.

## Evidence

### 1. BASE_SHA and touched paths

```text
$ BASE_SHA=$(sed -n 's/^BASE_SHA=//p' docs/features/project-only-skills/build-log-T1.md | head -1)
$ echo "BASE_SHA=$BASE_SHA"
BASE_SHA=7b87cbbfc6821bc2664c3062de0e42d57043a031
```

`git diff --stat` / `--name-status` for the owned paths (note: `docs/architecture/documentation.md` is absent because the audit produced no change):

```text
$ git diff --stat "$BASE_SHA" -- .opencode/agents docs/architecture/skills.md docs/architecture/documentation.md AGENTS.md README.md
 .opencode/agents/builder.md  |  49 ----------------
 .opencode/agents/planner.md  |   4 --
 .opencode/agents/reviewer.md |   7 ---
 AGENTS.md                    |   3 +-
 README.md                    |   2 +-
 docs/architecture/skills.md  | 136 +++++++++++--------------------------------
 6 files changed, 37 insertions(+), 164 deletions(-)

$ git diff --name-status "$BASE_SHA" -- .opencode/agents docs/architecture/skills.md docs/architecture/documentation.md AGENTS.md README.md
M	.opencode/agents/builder.md
M	.opencode/agents/planner.md
M	.opencode/agents/reviewer.md
M	AGENTS.md
M	README.md
M	docs/architecture/skills.md
```

### 2. AC-3 — exact skill sequences, total `action: skill` count, non-skill parity vs `BASE_SHA`

The command is the `tasks.md` § T2 verify AC-3 parser block verbatim (it parses every permission rule block in each `.opencode/agents/*.md` frontmatter, asserts the exact `skill` sequence, asserts the `action: skill` occurrence count equals the parsed skill-rule count, and compares every non-skill rule, in order, to `git show "$BASE_SHA:<path>"`):

```text
$ BASE_SHA="$BASE_SHA" node -e '<tasks.md § T2 verify AC-3 parser>'
agent frontmatter: skill sequences, total count, and non-skill parity OK
exit=0
```

The laid-out per-agent result (same parse, printed instead of asserted):

```text
orchestrator: action:skill occurrences=2 parsed skill rules=2
  skill "*" deny
  skill "orchestration-playbook" allow
  non-skill rules: work=9 base=9
planner: action:skill occurrences=3 parsed skill rules=3
  skill "*" deny
  skill "spec-authoring" allow
  skill "task-decomposition" allow
  non-skill rules: work=12 base=12
builder: action:skill occurrences=2 parsed skill rules=2
  skill "*" deny
  skill "web-implementation" allow
  non-skill rules: work=31 base=31
reviewer: action:skill occurrences=3 parsed skill rules=3
  skill "*" deny
  skill "spec-review" allow
  skill "code-review" allow
  non-skill rules: work=10 base=10
```

### 3. AC-4 — no imported-skill trace in agent prompts

The command is the `tasks.md` § T2 verify AC-4 block verbatim (all 33 removed IDs, the `imported skills are advisory` phrase, and `superpowers:` across all four agent prompts):

```text
$ node -e '<tasks.md § T2 verify AC-4 scan>'
exit=0
```

Empty output is the pass condition: no ID, no advisory bullet, and no namespaced reference occurs in any agent prompt, and `skill "*" deny` remains first in all four.

### 4. AC-5 — `docs/architecture/skills.md` is the project-only policy

```text
$ <tasks.md § T2 verify AC-5 checks: six required headings, six IDs, Context7 MCP, four exact table rows, forbidden-token scan>
AC-5 checks: all passed
exit=0
```

The six required headings, all six project IDs, the literal `Context7 MCP`, and the four exact rows `| orchestrator | \`orchestration-playbook\` |`, `| planner | \`spec-authoring\`, \`task-decomposition\` |`, `| builder | \`web-implementation\` |`, `| reviewer | \`spec-review\`, \`code-review\` |` are present; the forbidden tokens (`.agents`, `skills-lock`, `Imported pack inventory`, `Excluded and unassigned packs`, `Binding vs advisory`) do not occur.

### 5. AC-6 — `AGENTS.md` and `README.md`

```text
$ <tasks.md § T2 verify AC-6 checks: no .agents/skills-lock/imported/advisory; positive literals present>
AC-6 checks: all passed
exit=0
```

`AGENTS.md` still contains `.opencode/skills`, `docs/architecture/skills.md`, `podman compose`, and `four-agent pipeline`; `README.md` still contains `podman compose up`, `.opencode/skills`, and `docs/architecture/skills.md`.

### 6. AC-7 — `docs/architecture/documentation.md` audit and link resolution

```text
$ <tasks.md § T2 verify AC-7 checks>
AC-7 checks: all passed (documentation.md unchanged vs BASE_SHA)
exit=0
```

No `.agents`/`skills-lock`/`imported`/`advisory` token; `docs/architecture/skills.md` referenced; `test -f .opencode/skills/orchestration-playbook/SKILL.md` exits 0; `git diff --exit-code "$BASE_SHA" -- docs/architecture/documentation.md` exits 0 (empty diff — no edit was needed).

### 7. AC-8 — no live reference to the deleted paths

```text
$ ! grep -rnE '\.agents/skills|skills-lock\.json' AGENTS.md README.md opencode.jsonc .opencode docs/architecture
AC-8 scan: no live reference to the deleted paths
exit=0
```

### 8. Owned diff (exact edits)

```text
diff --git a/.opencode/agents/builder.md b/.opencode/agents/builder.md
index 1553f16..6608423 100644
--- a/.opencode/agents/builder.md
+++ b/.opencode/agents/builder.md
@@ -103,54 +103,6 @@ permissions:
   - action: skill
     resource: "web-implementation"
     effect: allow
-  - action: skill
-    resource: "test-driven-development"
-    effect: allow
-  - action: skill
-    resource: "systematic-debugging"
-    effect: allow
-  - action: skill
-    resource: "verification-before-completion"
-    effect: allow
-  - action: skill
-    resource: "receiving-code-review"
-    effect: allow
-  - action: skill
-    resource: "threejs-fundamentals"
-    effect: allow
-  - action: skill
-    resource: "threejs-geometry"
-    effect: allow
-  - action: skill
-    resource: "threejs-materials"
-    effect: allow
-  - action: skill
-    resource: "threejs-lighting"
-    effect: allow
-  - action: skill
-    resource: "threejs-shaders"
-    effect: allow
-  - action: skill
-    resource: "threejs-textures"
-    effect: allow
-  - action: skill
-    resource: "threejs-animation"
-    effect: allow
-  - action: skill
-    resource: "threejs-interaction"
-    effect: allow
-  - action: skill
-    resource: "threejs-performance"
-    effect: allow
-  - action: skill
-    resource: "threejs-postprocessing"
-    effect: allow
-  - action: skill
-    resource: "fixing-accessibility"
-    effect: allow
-  - action: skill
-    resource: "fixing-motion-performance"
-    effect: allow
 ---
 
 # Builder
@@ -160,7 +112,6 @@ You are the CubeClicker builder — a subagent and web technologies specialist.
 ## Rules
 
 - Load the `web-implementation` skill before acting; its rules and Definition of Done are binding.
-- Imported skills are advisory — project files and the four-agent pipeline win on conflict; imported "ask your human partner" instructions map to a `blocked` report, and namespaced references such as `superpowers:test-driven-development` resolve to the local allow-listed ID when one exists and are otherwise ignored.
 - Real-time: shared/cross-client state is server-authoritative — never trust client-reported values; own the connection lifecycle (connect/reconnect/teardown, no duplicate handlers); follow the `web-implementation` skill's real-time rules.
 - The stack is whatever `AGENTS.md` and `docs/architecture/stack.md` say. If the stack is NOT DECIDED, report `blocked` — never introduce tooling, frameworks, or dependencies on your own.
 - Containerized delivery path (decided): Podman images + Podman Compose (`podman compose`), single-command local run, provider-neutral deployment — see `docs/architecture/containerization.md`. When a task authors container assets, follow that contract (environment-based config, no secrets in images, health signal, backend exposes the WebSocket endpoint); the application stack is decided (2026-10-17) — follow the pinned container conventions (`docs/architecture/containerization.md`); container assets live in the repository (`compose.yaml`, `src/*/Dockerfile`).
diff --git a/.opencode/agents/planner.md b/.opencode/agents/planner.md
index 8768009..ba269bb 100644
--- a/.opencode/agents/planner.md
+++ b/.opencode/agents/planner.md
@@ -49,9 +49,6 @@ permissions:
   - action: skill
     resource: "task-decomposition"
     effect: allow
-  - action: skill
-    resource: "writing-plans"
-    effect: allow
 ---
 
 # Planner
@@ -61,7 +58,6 @@ You are the CubeClicker feature planner — a subagent. You NEVER address the us
 ## Rules
 
 - Load the `spec-authoring` and `task-decomposition` skills before acting; follow their workflows and templates.
-- Imported skills are advisory — project files and the four-agent pipeline win on conflict; `writing-plans` contributes only file structure, task right-sizing, step granularity, and self-review (its save paths, plan header, execution handoff, and sub-skill references do not apply); imported "ask your human partner" instructions map to a `blocked` report, and namespaced references such as `superpowers:test-driven-development` resolve to the local allow-listed ID when one exists and are otherwise ignored.
 - Work strictly from the Task Brief: read all INPUT paths first. The raw request quoted in the brief is the scope boundary.
 - Write `spec.md`, `plan.md`, and `tasks.md` into the feature directory named in the brief. Touch nothing else.
 - If `docs/architecture/stack.md` says NOT DECIDED: stay stack-agnostic and list stack choices as open questions. Never assume tooling.
diff --git a/.opencode/agents/reviewer.md b/.opencode/agents/reviewer.md
index 9827be3..fcaee17 100644
--- a/.opencode/agents/reviewer.md
+++ b/.opencode/agents/reviewer.md
@@ -43,12 +43,6 @@ permissions:
   - action: skill
     resource: "code-review"
     effect: allow
-  - action: skill
-    resource: "systematic-debugging"
-    effect: allow
-  - action: skill
-    resource: "verification-before-completion"
-    effect: allow
 ---
 
 # Reviewer
@@ -58,7 +52,6 @@ You are the CubeClicker reviewer — a subagent and independent quality gate. Yo
 ## Rules
 
 - Determine the gate from the brief: `spec_review` → load the `spec-review` skill; `code_review` → load the `code-review` skill. Follow that skill's checklist and output format.
-- Imported skills are advisory — project files and the four-agent pipeline win on conflict; imported "ask your human partner" instructions map to a `blocked` report, and namespaced references such as `superpowers:test-driven-development` resolve to the local allow-listed ID when one exists and are otherwise ignored.
 - Read every artifact listed in the brief. For code review, inspect the diff file-by-file and run the verification suite yourself — a builder's log is a claim, not evidence.
 - At the code gate, rerun `npm run coverage` yourself and independently rerun any pinned feature-appropriate proof (e.g. the Mailpit-primed containerized smoke recipe for cross-service behavior, or the containerized `terraform fmt -check` / `validate` + `actionlint` wrappers for infra/pipeline config changes): coverage below the thresholds (≥ 80% statements/branches/functions/lines per workspace), or missing unit/integration tests for changed behavior, counts as unmet; weak assertions (banned matchers, snapshot-only, assertion-free, tautological tests) are findings; inspect the coverage exclusions for number-gaming (production code excluded or thresholds lowered to pass); un-recorded or unreproducible evidence counts as unmet; builder logs are claims, not evidence.
 - Every finding: severity (BLOCKER/MAJOR/MINOR/INFO), location (`file:line` or artifact section), what's wrong, why it matters, required action.
diff --git a/AGENTS.md b/AGENTS.md
index d8933b8..bdb5b9a 100644
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -29,7 +29,6 @@ Host tooling commands need Node.js 24 LTS + npm; running the environment itself
 - `tests/e2e/` — containerized smoke/e2e tests
 - `docs/` — product vision, architecture, feature artifacts
 - `.opencode/` — agents, commands, and the six project pipeline skills in `.opencode/skills/` (the AI team)
-- `.agents/skills/` — 31 imported third-party skill packs (advisory), tracked with `skills-lock.json`
 
 Unit tests are colocated beside the sources they cover (`*.test.ts` / `*.test.tsx`, inside each workspace).
 
@@ -48,7 +47,7 @@ Unit tests are colocated beside the sources they cover (`*.test.ts` / `*.test.ts
 - Branches: `feat/<slug>` for feature work; integration happens on `develop` (the `development` deploy environment) and accepted work merges to `main` (the `production` deploy environment).
 - Tests accompany every behavior change: unit tests and integration tests with concrete expected values (no wildcard matchers), and no useless tests; coverage stays ≥ 80% (statements, branches, functions, lines) per workspace, verified with `npm run coverage`.
 - Documentation: every behavior change updates documentation in the same commit (see docs/architecture/documentation.md).
-- Skills: project pipeline skills live in `.opencode/skills/` (binding, higher precedence); imported packs live in `.agents/skills/` (advisory, installer-managed with `skills-lock.json`). Per-agent allow-lists, precedence, and pack dispositions are documented in `docs/architecture/skills.md`.
+- Skills: the six project pipeline skills live in `.opencode/skills/` and are the only skill source; per-agent allow-lists, the `skill` rule contract, and verification are documented in `docs/architecture/skills.md`. Library and platform documentation comes from Context7 MCP.
 
 ## Boundaries
 
diff --git a/README.md b/README.md
index b14dd79..dc8a5a3 100644
--- a/README.md
+++ b/README.md
@@ -108,7 +108,7 @@ TypeScript (strict) on Node.js 24 LTS: a Fastify backend (HTTP health at `GET /h
 
 - `docs/architecture/stack.md` — the decided application stack and the canonical commands
 - `docs/architecture/containerization.md` — the settled container conventions (ports, env names, health, images, compose files)
-- `docs/architecture/skills.md` — skill locations (`.opencode/skills/` and `.agents/skills/`), per-agent allow-lists, imported-pack dispositions, and the binding-vs-advisory policy
+- `docs/architecture/skills.md` — the six project pipeline skills in `.opencode/skills/`, the per-agent allow-lists, and the `skill` rule contract (library/platform documentation comes from Context7 MCP)
 
 ## Deployment
 
```

`docs/architecture/skills.md` is a full rewrite; the net diff across the six owned files is 37 insertions / 164 deletions (dominated by the 16 builder allow rules and the removed inventory document).

### 9. Gates

`npm run lint` (exit 0, full output):

```text

> lint
> eslint .

```

`npm run typecheck` (exit 0, full output):

```text

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

```

`npm test` (exit 0; workspace totals — the full run lists every test file):

```text
 Test Files  32 passed (32)
      Tests  1110 passed (1110)
 Test Files  70 passed (70)
      Tests  1873 passed (1873)
```

`npm run coverage` (exit 0, full raw output — thresholds ≥ 80 statements/branches/functions/lines per workspace):

```text

> coverage
> npm run coverage --workspaces --if-present


> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend
      Coverage enabled with v8

 ✓ src/game/config.test.ts (13 tests) 9ms
 ✓ src/auth/user-repository.test.ts (40 tests) 15ms
 ✓ src/auth/rate-limit.test.ts (19 tests) 12ms
 ✓ src/observability/config.test.ts (24 tests) 6ms
 ✓ src/db/pool.test.ts (10 tests) 7ms
 ✓ src/game/cubes.test.ts (24 tests) 12ms
 ✓ src/auth/config.test.ts (29 tests) 17ms
 ✓ src/game/parts.test.ts (19 tests) 13ms
 ✓ src/game/broadcast.test.ts (13 tests) 19ms
 ✓ src/observability/metrics.test.ts (30 tests) 15ms
 ✓ src/db/migrate.test.ts (11 tests) 14ms
 ✓ src/game/upgrades.test.ts (20 tests) 7ms
 ✓ src/game/parts-v2.test.ts (40 tests) 20ms
 ✓ src/db/migrate-runner.test.ts (14 tests) 14ms
 ✓ src/auth/verification-token-repository.test.ts (44 tests) 19ms
 ✓ src/auth/session-repository.test.ts (35 tests) 18ms
 ✓ src/game/players.test.ts (13 tests) 8ms
 ✓ src/db/migrate-cli.test.ts (8 tests) 13ms
 ✓ src/auth/email.test.ts (12 tests) 13ms
 ✓ src/game/servers.test.ts (47 tests) 136ms
 ✓ src/game/protocol.test.ts (182 tests) 21ms
 ✓ src/observability/logging.test.ts (28 tests) 164ms
 ✓ src/game/economy.test.ts (20 tests) 4ms
 ✓ src/game/hub.test.ts (135 tests) 199ms
 ✓ src/cors.test.ts (15 tests) 126ms
 ✓ src/auth/password.test.ts (17 tests) 338ms
 ✓ src/auth/auth-routes.test.ts (28 tests) 823ms
 ✓ src/auth/auth-service.test.ts (50 tests) 945ms
 ✓ src/app.test.ts (27 tests) 2261ms
   ✓ GET /ws > packs three servers after each completion over live sockets (X = 2, AC-10, F3)  1112ms
 ✓ src/auth/economy-repository.test.ts (119 tests) 2402ms
 ✓ src/db/migration-006.test.ts (13 tests) 2513ms
 ✓ src/db/migration-007.test.ts (11 tests) 2527ms

 Test Files  32 passed (32)
      Tests  1110 passed (1110)
   Start at  08:48:14
   Duration  3.53s (transform 2.94s, setup 0ms, collect 8.91s, tests 12.71s, environment 6ms, prepare 3.95s)

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

 ✓ src/ui/app.css.test.ts (87 tests) 28ms
 ✓ src/game/progression.test.ts (21 tests) 6ms
 ✓ src/game/parts-v2.test.ts (50 tests) 15ms
 ✓ src/ws/connection.test.ts (10 tests) 11ms
 ✓ src/render/background-life.test.ts (14 tests) 18ms
 ✓ src/multiplayer/protocol.test.ts (256 tests) 29ms
 ✓ src/ui/ConnectionBanner.test.tsx (5 tests) 10ms
 ✓ src/render/impact-effects.test.ts (22 tests) 26ms
 ✓ src/render/preview.test.ts (7 tests) 27ms
 ✓ src/ui/icons.test.tsx (16 tests) 22ms
 ✓ src/auth/store.test.ts (31 tests) 15ms
 ✓ src/ui/UserPanel.test.tsx (8 tests) 18ms
 ✓ src/render/quality.test.ts (29 tests) 77ms
 ✓ src/render/spaceship-model.test.ts (33 tests) 129ms
 ✓ src/render/targeting.test.ts (11 tests) 71ms
 ✓ src/build/vite-config.test.ts (11 tests) 346ms
 ✓ src/input/gestures.test.ts (27 tests) 32ms
 ✓ src/render/starfield.test.ts (28 tests) 123ms
 ✓ src/render/cursor-ship.test.ts (34 tests) 175ms
 ✓ src/render/picking.test.ts (16 tests) 170ms
 ✓ src/game/engine.test.ts (113 tests) 101ms
 ✓ src/render/spaceship.test.ts (40 tests) 134ms
 ✓ src/ui/game-view.css.test.ts (45 tests) 24ms
 ✓ src/game/board.test.ts (18 tests) 35ms
 ✓ src/browser-env.test.ts (6 tests) 13ms
 ✓ src/render/cube-view.test.ts (37 tests) 320ms
 ✓ src/render/cosmic-backdrop.test.ts (14 tests) 385ms
 ✓ src/ui/VerificationPending.test.tsx (2 tests) 14ms
 ✓ src/input/keyboard.test.ts (13 tests) 14ms
 ✓ src/multiplayer/transport.test.ts (15 tests) 19ms
 ✓ src/render/world.test.ts (29 tests) 333ms
 ✓ src/auth/api.test.ts (31 tests) 23ms
 ✓ src/game/parts.test.ts (23 tests) 19ms
 ✓ src/game/rotation.test.ts (15 tests) 7ms
 ✓ src/render/ship-motion.test.ts (24 tests) 10ms
 ✓ src/render/postprocessing.test.ts (14 tests) 14ms
 ✓ src/render/webgl.test.ts (22 tests) 25ms
 ✓ src/render/particles.test.ts (24 tests) 18ms
 ✓ src/ui/theme.test.ts (11 tests) 8ms
 ✓ src/render/spectate-travel.test.ts (7 tests) 10ms
 ✓ src/game/upgrades.test.ts (20 tests) 8ms
 ✓ src/multiplayer/server-state.test.ts (52 tests) 17ms
 ✓ src/game/motion.test.ts (12 tests) 8ms
 ✓ src/config.test.ts (20 tests) 11ms
 ✓ src/multiplayer/spectate.test.ts (23 tests) 15ms
 ✓ src/game/effects.test.ts (30 tests) 16ms
 ✓ src/game/economy.test.ts (7 tests) 7ms
 ✓ src/game/effects-spaceship.test.ts (5 tests) 5ms
 ✓ src/game/session-spaceship.test.ts (6 tests) 282ms
 ✓ src/build/bundle-budget.test.ts (11 tests) 11ms
 ✓ src/render/scene-effects.test.ts (9 tests) 418ms
 ✓ src/build/nginx-config.test.ts (6 tests) 6ms
 ✓ src/docs/links.test.ts (1 test) 5ms
 ✓ src/render/nebula.test.ts (11 tests) 915ms
   ✓ createNebulaTexture (AC-9) > produces identical bytes for the same random sequence  732ms
 ✓ src/render/scene-spaceship.test.ts (28 tests) 913ms
 ✓ src/ui/GameCanvas.runtime.test.tsx (5 tests) 150ms
 ✓ src/ui/VerifyEmail.test.tsx (22 tests) 228ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > renders exactly ten slot rows in SLOT_CATALOG order with the section contract
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/Hud.test.tsx (20 tests) 210ms
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

 ✓ src/ui/SpaceshipPreview.test.tsx (12 tests) 74ms
 ✓ src/ui/DeferredSpaceshipCustomizationPanel.test.tsx (5 tests) 275ms
 ✓ src/ui/LevelCompleteBanner.test.tsx (6 tests) 143ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > calls onUnequip with the slot id only for an enabled control
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel slots (AC-29) > normalizes legacy direct props into the v2 slot rows
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/UpgradesPanel.test.tsx (12 tests) 305ms
 ✓ src/ui/CustomizationToggle.test.tsx (6 tests) 221ms
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

 ✓ src/ui/AuthMenu.test.tsx (19 tests) 606ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > restarts the timeline when the same part is reopened with a new sequence
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > renders the settled reveal instantly under reduced motion
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/ui/GameCanvas.test.tsx (7 tests) 245ms
stderr | src/ui/SpaceshipCustomizationPanel.test.tsx > SpaceshipCustomizationPanel reveal (AC-32, AC-41) > dismisses the reveal through onDismissReveal
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

stderr | src/App.test.tsx > App > drives data-customization-open from the customization toggle (AC-7, AC-18)
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

 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (28 tests) 695ms
 ✓ src/ui/AuthForms.test.tsx (44 tests) 963ms
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

 ✓ src/render/scene.test.ts (90 tests) 2601ms
stderr | src/App.test.tsx > App — customization panel integration (AC-29, AC-32, AC-43) > routes panel equip and unequip controls to the session commands
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
Not implemented: HTMLCanvasElement's getContext() method: without installing the canvas npm package
THREE.WebGLRenderer: THREE.WebGLRenderer: Error creating WebGL context.

 ✓ src/App.test.tsx (41 tests) 1301ms
 ✓ src/game/session.test.ts (96 tests) 3000ms

 Test Files  70 passed (70)
      Tests  1873 passed (1873)
   Start at  08:48:18
   Duration  4.54s (transform 8.53s, setup 0ms, collect 20.81s, tests 16.53s, environment 7.86s, prepare 7.17s)

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
```

Per-workspace totals: backend — 95.25 statements / 88.68 branches / 99.53 functions / 95.25 lines (32 test files, 1110 tests passed); frontend — 96.48 statements / 96.14 branches / 97.56 functions / 96.48 lines (70 test files, 1873 tests passed). Both exceed every 80 threshold; `npm run coverage` exit 0.

### 10. Staging and commit

Staged paths are exactly the three edited agent prompts, `docs/architecture/skills.md`, `AGENTS.md`, `README.md`, `docs/architecture/documentation.md` (already identical to `BASE_SHA`, so it contributes no change), and this log:

```text
$ git add .opencode/agents/planner.md .opencode/agents/builder.md .opencode/agents/reviewer.md docs/architecture/skills.md AGENTS.md README.md docs/architecture/documentation.md docs/features/project-only-skills/build-log-T2.md
$ git commit -m "docs: limit skills to the project pipeline"
```

The commit itself and the post-commit `test -z "$(git status --porcelain -- .opencode/agents docs/architecture AGENTS.md README.md)"` are recorded in the Subagent Report (T1 precedent): they run after this log is committed. `docs/features/vercel-fly-neon-deployment/status.md` is never staged.

## Acceptance audit

- **AC-3** → met: the parser asserts, for all four agents, exactly `skill|*|deny` followed by the expected project allows in order (`orchestrator`: `orchestration-playbook`; `planner`: `spec-authoring`, `task-decomposition`; `builder`: `web-implementation`; `reviewer`: `spec-review`, `code-review`), the `action: skill` occurrence count equals the parsed skill-rule count (2/2, 3/3, 2/2, 3/3), and every non-skill rule is identical, in order, to `BASE_SHA` (§ 2). Under last-match evaluation every other skill ID is denied.
- **AC-4** → met: the 33-ID + advisory-phrase + `superpowers:` scan over `.opencode/agents/*.md` exits 0 with no output; `skill "*" deny` is first in all four (§ 3).
- **AC-5** → met: all six required headings, all six IDs, `Context7 MCP`, the four exact table rows, and the forbidden-token scan pass (§ 4).
- **AC-6** → met: no `.agents`/`skills-lock`/`imported`/`advisory` string in `AGENTS.md`/`README.md`; all positive literals present (§ 5).
- **AC-7** → met: `documentation.md` has no stale token, keeps the `docs/architecture/skills.md` reference, the playbook path resolves, and the diff vs `BASE_SHA` is empty (§ 6).
- **AC-8 (T2 part)** → met: no live `.agents/skills` or `skills-lock.json` reference under the scanned live paths (§ 7).
- **AC-10 (T2 gate contribution)** → met: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` all exit 0 with per-workspace coverage ≥ 80 on all four metrics (§ 9); no source/test/container/CI/package file changed.
- **AC-11 (T2 part)** → met: `BASE_SHA` read back from `build-log-T1.md`; only T2-owned files plus this log are staged; the pre-existing `M docs/features/vercel-fly-neon-deployment/status.md` is untouched and unstaged.

## Deviations from spec

- None in scope. Bookkeeping note: the commit and post-commit clean assertion are reported rather than committed, because a commit cannot contain the raw output of itself (same approach as T1).
