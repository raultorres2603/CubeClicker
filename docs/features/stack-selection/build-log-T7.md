# Build log — T7 — Verify & integrate (final gate before code review)

Task: T7 (dispatched 2026-10-18; executed 2026-10-18 on the verified host)
Files changed: `docs/features/stack-selection/build-log-T7.md` (this log) — **the only file this task writes**. T7 is a verification gate: it produces evidence, not product change. No deliverable file (docs, scaffold, compose, Dockerfile, `.opencode`, manifest, lockfile) was modified by T7; the working tree of every deliverable is byte-identical to `2f62057` (T6b), the pre-T7 HEAD.
Status: **completed** — the full pinned pass runs green (`npm ci`; `lint`/`typecheck`/`test`/`build`; the AC-26/AC-27 compose sequence with `npm run smoke` = `SMOKE PASS (4/4 checks)`; the four pinned `podman build --format docker` images with healthchecks present and zero OCI warnings), the stale-token scan is empty, and the per-AC inspection table below finds **AC-1 … AC-34 all met**, with the AC-32/AC-33/AC-34 final checks done at whole-history scope. Three carried MINORs are noted (§ 9) — none blocks an AC, none contradicts an AC letter.

Sketch (≤5 lines): run the pinned T7 pass in order — `npm ci`; `npm run lint && npm run typecheck && npm test && npm run build`; the AC-26 stack-up + `npm run smoke` + host-path checks + `down`; re-run the T4b/T5b `podman build --format docker` forms and `podman image inspect`; the stale-token scan; then the inspection gates (per-AC grep anchors AC-1…AC-34, per-commit diffs for AC-32, permission inspection across every commit for AC-33, cross-file consistency for AC-34, the no-template/gameplay/provider/CI scan); record raw output here; stage only this log and commit the pinned message.

## 0. Environment and build-start baseline

```
$ node --version
v24.22.0
$ npm --version
11.19.1
$ podman --version
podman version 5.8.7
$ podman compose version
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<
Docker Compose version v5.6.0
$ getenforce
Enforcing

$ git branch --show-current
feat/stack-selection
$ git log --oneline -1
2f62057 fix: relabel compose bind mounts for SELinux hosts (T6b)
$ git status --short
 M docs/features/README.md
 M docs/features/project-glossary/status.md
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md

$ for p in 8080 5173; do ss -ltnH | grep -q ":$p " && echo "port $p: OCCUPIED" || echo "port $p: free"; done
port 8080: free
port 5173: free
```

Deliverable hashes at build start (unchanged through the whole pass — re-checked in § 1.4/§ 2.4 and at commit time in § 11):

```
$ sha256sum compose.yaml compose.smoke.yaml tests/e2e/smoke.mjs README.md src/backend/Dockerfile src/frontend/Dockerfile package-lock.json
d8e588c773c694d93ff357c82a7b379d0f64b1ee6f8bca444214bc4e8babc6b5  compose.yaml
23a3d8d1dce71401e2e048720fdb9d0680428c02db65354f1374e93994af21d7  compose.smoke.yaml
a14c30a2ec7a28f5b984dc7c352a7eee283bce832378758acb07ed98db2e90dd  tests/e2e/smoke.mjs
187c78ef9f56b1be5c1772649dc98d8bd92cc56b0eb65d819d9db74b8189f549  README.md
48b3ee8478fa22e2aba3654c6ade73c1cc3ea82e8b683468f6aac3a10e6ee5a2  src/backend/Dockerfile
5f7a105deb128c2aec463837e6ac60a66c59b54e5fe541875c3bda449b1729d9  src/frontend/Dockerfile
c6c7a26f4434f083c45201b7c72fc6afdffebbe1476f224109dacaff9c2fadf2  package-lock.json
```

`tests/e2e/smoke.mjs` still carries the T6 deliverable hash (`a14c30a2…` = `03772b1:tests/e2e/smoke.mjs`, per `build-log-T6b.md` § 1/§ 3.8).

Pre-existing working-tree dirt (`docs/features/README.md`, `docs/features/project-glossary/status.md` — one bookkeeping line each, from the project-glossary post-acceptance packaging) and the untracked stack-selection artifacts (spec/plan/tasks/status/reviews) are outside this task's write scope; they were left untouched and unstaged (§ 11).

Reading note: raw session logs were kept under `/tmp/opencode/t7/*.log`; the transcripts below are verbatim copies apart from the compose-provider banner's ANSI escapes, and `$ …`/`exit=` markers added by the capture wrapper (they are visible in the quoted output and labelled as such). No `curl`/`wget` was used anywhere; build-host HTTP checks are `node -e "fetch(...)"` / `node -e` WebSocket clients.

## 1. The full pinned pass — raw evidence

### 1.1 `npm ci` — exit 0 (AC-28 lockfile-in-sync proof)

```
$ npm ci
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 277 packages, and audited 280 packages in 1s

78 packages are looking for funding
  run `npm fund` for details

3 vulnerabilities (1 moderate, 2 critical)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
npm warn install-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn install-scripts   esbuild@0.28.2 (postinstall: node install.js)
npm warn install-scripts
npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.
npm-ci-exit=0
```

(`npm ci` installs strictly from the committed lockfile and fails if the lockfile and the manifests disagree — exit 0 is the AC-28 in-sync proof. The 3 transitive advisories and the esbuild install-scripts notice are the T3-recorded, predecessor-carried items, unchanged here.)

### 1.2 `npm run lint && npm run typecheck && npm test && npm run build` — all exit 0

```
$ npm run lint
> lint
> eslint .
lint-exit=0

$ npm run typecheck
> typecheck
> npm run typecheck --workspaces --if-present
> typecheck
> tsc --noEmit
> typecheck
> tsc --noEmit
typecheck-exit=0

$ npm test
> test
> npm run test --workspaces --if-present

> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/app.test.ts (4 tests) 90ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  12:59:33
   Duration  367ms (transform 30ms, setup 0ms, collect 72ms, tests 90ms, environment 0ms, prepare 62ms)


> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ws/connection.test.ts (9 tests) 12ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  12:59:34
   Duration  270ms (transform 46ms, setup 0ms, collect 49ms, tests 12ms, environment 0ms, prepare 53ms)

test-exit=0

$ npm run build
> build
> npm run build --workspaces --if-present

> build
> tsc

> build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 29 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                  0.32 kB │ gzip:  0.23 kB
dist/assets/index-C70WgBoq.js  223.76 kB │ gzip: 69.91 kB
✓ built in 622ms
build-exit=0
```

13 unit tests (4 backend + 9 frontend) pass; `npm run build` writes only the gitignored `dist/` trees of the two workspaces (no tracked file is touched: § 2.6).

### 1.3 The AC-26/AC-27 sequence end to end, including `npm run smoke`

Every command is the pinned form; `--wait` is supported by the provider (no contingency needed).

```
$ podman compose down -v --rmi local
down-clean-exit=0

$ podman compose up -d --build --wait
 Image cubeclicker-backend:dev Building
 Image cubeclicker-frontend:dev Building
 STEP 1/12: FROM docker.io/library/node:24-alpine AS dev
 STEP 1/11: FROM docker.io/library/node:24-alpine AS dev
 ...  (both images built from the qualified base; no OCI-format warning)
 STEP 9/11: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD node -e "fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
 STEP 10/12: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
 Network cubeclicker_default Created
 Container cubeclicker-backend-1 Started
 Container cubeclicker-frontend-1 Started
 Container cubeclicker-backend-1 Waiting
 Container cubeclicker-frontend-1 Waiting
 Container cubeclicker-frontend-1 Healthy
 Container cubeclicker-backend-1 Healthy
up-wait-exit=0

$ podman compose ps
NAME                     IMAGE                                        COMMAND                  SERVICE    CREATED          STATUS          PORTS
cubeclicker-backend-1    docker.io/library/cubeclicker-backend:dev    "npm run dev -w @cub…"   backend    11 seconds ago   Up 10 seconds   127.0.0.1:8080->8080/tcp
cubeclicker-frontend-1   docker.io/library/cubeclicker-frontend:dev   "npm run dev -w @cub…"   frontend   11 seconds ago   Up 10 seconds   127.0.0.1:5173->5173/tcp
ps-exit=0

$ podman inspect cubeclicker-backend-1 --format '{{.Config.Healthcheck}} {{.State.Health.Status}}'
{[CMD-SHELL node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"] 15s 0s 10s 3s 5} healthy
inspect-backend-exit=0

$ podman inspect cubeclicker-frontend-1 --format '{{.Config.Healthcheck}} {{.State.Health.Status}}'
{[CMD-SHELL node -e "fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"] 15s 0s 10s 3s 5} healthy
inspect-frontend-exit=0

$ npm run smoke
> smoke
> podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke

 Container cubeclicker-backend-1 Running
 Container cubeclicker-frontend-1 Running
 Container cubeclicker-smoke-run-2d6d1b4646fc Creating
 Container cubeclicker-smoke-run-2d6d1b4646fc Created
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
SMOKE PASS (4/4 checks)
smoke-exit=0

$ node -e "fetch('http://localhost:8080/healthz').then(async r => { … })"
status 200 application/json; charset=utf-8
body {"status":"ok"}
backend-fetch-exit=0

$ node -e "fetch('http://localhost:5173/').then(async r => { … })"
status 200 text/html
has #root: true
frontend-fetch-exit=0

$ node -e "const ws = new WebSocket('ws://localhost:8080/ws'); …"
WS MESSAGE {"type":"hello","serverTime":"2026-10-18T11:00:14.246Z"}
ws-probe-exit=0

$ podman compose down
 Container cubeclicker-frontend-1 Stopping / Stopped / Removing / Removed
 Container cubeclicker-backend-1 Stopping / Stopped / Removing / Removed
 Network cubeclicker_default Removing / Removed
down-exit=0

$ for p in 8080 5173; do … done
port 8080: free
port 5173: free
$ podman ps -a --format '{{.Names}} {{.Status}}'
davincibox Exited (0) 4 weeks ago
```

(The `…` elisions are shell-quoted one-liners already quoted in full in `build-log-T6b.md` § 3.7 and reproduced verbatim there; the line-per-step provider progress of `down` is compressed with `/` separators (`Stopping / Stopped / Removing / Removed`) — the full per-step transcript is in the session log `/tmp/opencode/t7/compose-sequence.log`; the wrapper's exit markers are shown. The pre-existing unrelated `davincibox` container is untouched.)

### 1.4 AC-13/AC-14 config gates and the four pinned `--format docker` builds (AC-15/16/17 build-form re-verification)

```
$ podman compose config -q
config-exit=0
$ podman compose -f compose.yaml -f compose.smoke.yaml config -q
config-merged-exit=0

$ podman build --format docker --target dev  -f src/backend/Dockerfile  -t cubeclicker-backend:dev-check  .   # exit 0
$ podman build --format docker --target prod -f src/backend/Dockerfile  -t cubeclicker-backend:prod-check .   # exit 0
$ podman build --format docker --target dev  -f src/frontend/Dockerfile -t cubeclicker-frontend:dev-check  .  # exit 0
$ podman build --format docker --target prod -f src/frontend/Dockerfile -t cubeclicker-frontend:prod-check .  # exit 0
backend-dev-build-exit=0
backend-prod-build-exit=0
frontend-dev-build-exit=0
frontend-prod-build-exit=0

$ for f in backend-dev backend-prod frontend-dev frontend-prod; do grep -c "HEALTHCHECK is not supported" /tmp/opencode/t7/build-$f.log; done
0
0
0
0

$ podman image inspect cubeclicker-backend:dev-check cubeclicker-backend:prod-check --format '{{.Id}} | Interval=…'
dfe80e631c91…a77 | Interval=10s Timeout=3s Retries=5 StartPeriod=15s | Test1=node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
02e03d2e0673…826 | Interval=10s Timeout=3s Retries=5 StartPeriod=15s | Test1=node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
inspect-backend-exit=0

$ podman image inspect cubeclicker-frontend:dev-check cubeclicker-frontend:prod-check --format '{{.Id}} | Interval=…'
6d5350281b1a…109 | Interval=10s Timeout=3s Retries=5 StartPeriod=15s | Test1=node -e "fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
37ade370cbe6…be5 | Interval=10s Timeout=3s Retries=5 StartPeriod=15s | Test1=wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
inspect-frontend-exit=0

$ podman image inspect cubeclicker-backend:prod-check --format 'backend-prod User=…'
backend-prod User=node Env=[… NODE_ENV=production]
$ podman image inspect cubeclicker-frontend:prod-check --format 'frontend-prod User=…'
frontend-prod User=101 ExposedPorts=map[8080/tcp:{}]
```

Post-pass hygiene (no deliverable byte moved by the whole pass):

```
$ git status --short
 M docs/features/README.md
 M docs/features/project-glossary/status.md
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md
$ sha256sum compose.yaml compose.smoke.yaml tests/e2e/smoke.mjs   # unchanged from § 0
d8e588c773c694d93ff357c82a7b379d0f64b1ee6f8bca444214bc4e8babc6b5  compose.yaml
23a3d8d1dce71401e2e048720fdb9d0680428c02db65354f1374e93994af21d7  compose.smoke.yaml
a14c30a2ec7a28f5b984dc7c352a7eee283bce832378758acb07ed98db2e90dd  tests/e2e/smoke.mjs
```

## 2. Stale-token scan (pinned) and out-of-scope scans

### 2.1 Pinned stale-token scan — no hits

```
$ grep -rn "docker compose" AGENTS.md docs/architecture .opencode README.md compose.yaml compose.smoke.yaml src tests package.json
stale-grep-exit=1     # exit 1 = no match anywhere in the live set
```

(Frozen historical records under `docs/features/**` and the `Dockerfile`/`.dockerignore` filenames are out of the scan's scope by the task pin.)

### 2.2 Broadened tooling scan — only legitimate residual tokens

```
$ grep -rniE "docker" AGENTS.md README.md compose.yaml compose.smoke.yaml src tests package.json package-lock.json tsconfig.json eslint.config.mjs .dockerignore .gitignore | grep -viE "dockerfile|\.dockerignore|dockerfile:"
README.md:59:The `--format docker` form keeps the image `HEALTHCHECK`, which Podman 5's default OCI build format would drop.
compose.smoke.yaml:5:    image: docker.io/library/node:24-alpine
tests/e2e/smoke.mjs:4:// as-is on `docker.io/library/node:24-alpine` with no install step.
```

Three hits, all pinned r4 tokens/intent: the `--format docker` build pin (README), the registry-qualified smoke image and the same token in the smoke file's comment. No stale `docker compose`/Docker-CLI guidance survives.

### 2.3 No template / gameplay / provider / CI assets

```
$ grep -rniE "score|points|clickCount|GameState|requestAnimationFrame|localStorage|indexedDB|sqlite|prisma|persistence|migration|auth|login|session token" src tests --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.json' --include='*.conf' --include='*.html'
gameplay-scan-exit=1        # no gameplay / game state / persistence / identity code anywhere in the scaffold

$ grep -rniE "playwright|puppeteer|prettier|cypress" package.json src tests
tooling-scan-exit=1         # no browser-e2e tooling, no formatter beyond ESLint

$ git diff --name-only 5d47786..HEAD | grep -nE "\.github|gitlab|circleci|Jenkinsfile|terraform|\.tf$|k8s|helm|pulumi|serverless|cloudformation|ecs|fargate"
provider-scan-exit=1        # the feature adds no CI, infra, or provider file

$ grep -rniE "aws|azure|gcp|ecs|fargate|kubernetes|terraform" README.md AGENTS.md compose.yaml compose.smoke.yaml src tests package.json
AGENTS.md:8:- **Containerized delivery path (DECIDED).** … (AWS ECS Fargate is an example only — no provider is chosen); …
provider-name-exit=0        # single hit = the pre-existing example-only wording, retained per AC-8
```

The feature adds no template file either: every `templates/` path in the repository is a pre-existing `.opencode` skill template untouched by this feature (they do not appear in § 5's change set). `src/shared` is referenced nowhere (`grep -rn "src/shared" …` → exit 1), matching D-12.

## 3. Per-AC inspection table (AC-1 … AC-34)

Legend: **met** = the AC's tokens/behavior are present and evidenced; evidence is raw command output quoted in this log or in the named per-task log (cited, not trusted). T7's own acceptance is AC-1…AC-34.

| AC | Verdict | Evidence (raw anchor) |
| --- | --- | --- |
| **AC-1** | met | `stack.md:3` `**Status: DECIDED** (application stack, 2026-10-17)…`; `grep -n "NOT DECIDED" docs/architecture/stack.md` → exit 1 (no "NOT DECIDED" anywhere); `grep -rn "remains NOT DECIDED"` over the three decided docs → exit 1; component list `stack.md:9–16` names TypeScript (strict), Node.js 24 LTS, Fastify, `@fastify/websocket`, React, Vite, npm (workspaces), Vitest, ESLint, `tsx` |
| **AC-2** | met | `stack.md:37–43` retains the container path (containers, single `podman compose up`-style run, `:39` provider-neutral + "AWS ECS Fargate is an example only and no provider is chosen" byte-retained from `5d47786:stack.md:15`, `:40` future services, `:43` pointer to `containerization.md`) and `:41` states the assets exist (`compose.yaml`, `compose.smoke.yaml`, Dockerfiles under `src/{backend,frontend}`) |
| **AC-3** | met | `stack.md:45` `## Hard constraints`; `:47` capability bullet and `:48` rationale survive verbatim (diff shows only the heading and the closing sentence changed); `:49` states the decision satisfies it (backend serves `GET /ws`; frontend connects over WebSocket) |
| **AC-4** | met | `stack.md:24–33` canonical command table; `AGENTS.md:15–22` § Commands — the eight AC-4 tokens (`npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run dev`, `npm run smoke`, `podman compose up`) appear in both files (§ 7 token matrix); `stack.md` layout at `:13/:44–51` |
| **AC-5** | met | `containerization.md:31` retitled `## Container conventions (settled at stack selection, 2026-10-17)`; every resolved item present as a value: `:35` ports/env (`HOST` 0.0.0.0, `PORT` 8080, 5173, `127.0.0.1:${BACKEND_PORT:-8080}:8080`, `127.0.0.1:${FRONTEND_PORT:-5173}:5173`), `VITE_WS_URL` default `ws://localhost:8080/ws`; `:36` health (`GET /healthz`, image `HEALTHCHECK`, interval 10s / timeout 3s / retries 5 / start-period 15s); `:37` image naming (`cubeclicker-backend`, `cubeclicker-frontend`, `:dev`, release tagging deferred); `:38` file locations (`compose.yaml`, `compose.smoke.yaml`, both Dockerfiles); `:39` dev mode (tsx watch + Vite HMR over bind mounts, rebuild on dependency change); `:40` local-run command `podman compose up` in `README.md` and mirrored in `AGENTS.md`. No item left open |
| **AC-6** | met | `containerization.md:3` preamble: stack DECIDED 2026-10-17, assets exist, document still binding; H2 set unchanged at 5 — before `5d47786`: Local development contract / Service containerization rules / Deployment neutrality / Real-time (WebSocket) requirement / Conventions to settle at stack selection; after: same five, last one retitled |
| **AC-7** | met | `containerization.md:27` names the concrete endpoint ("the `GET /ws` WebSocket upgrade on the backend listen port 8080"); `:28` upgrade preservation; `:29` proxy/load-balancer kept as a deployment-time decision, no configuration content |
| **AC-8** | met | `AGENTS.md:7` NOT-DECIDED bullet replaced by the decided-stack bullet (names the stack, points to `stack.md`); `:8` containerized bullet updated (assets in repo, `podman compose up`, run instructions in `README.md`, provider-neutral wording retained); `:9` WebSocket bullet no longer claims nothing is chosen — it states the decided stack satisfies the constraint |
| **AC-9** | met | `AGENTS.md:13–22` § Commands holds the full command set plus the prerequisites line and the present-tense local-environment bullet pointing at `README.md`; `grep -n "TBD" AGENTS.md` → exit 1 (no TBD remains) |
| **AC-10** | met | `AGENTS.md:42` `- Language: TypeScript (strict) — decided with the application stack (2026-10-17); see docs/architecture/stack.md.`; `grep -n "per the agreed stack" AGENTS.md` → exit 1 |
| **AC-11** | met | `AGENTS.md` § Project structure lists `src/backend/` (+Dockerfile), `src/frontend/` (+Dockerfile), `tests/e2e/`, `docs/`, `.opencode/`, plus the colocated `*.test.ts` note; `grep -n "public/" AGENTS.md` → exit 1 (the `public/` line is gone) |
| **AC-12** | met | `README.md` — prerequisites `:7–8` (Podman with a compose provider; Node 24 + npm for tooling), single command `:13` + URLs `:20–22` (5173/8080/`ws://localhost:8080/ws`), commands table `:34–40`, env table `:46–48` (`BACKEND_PORT` 8080, `FRONTEND_PORT` 5173, `VITE_WS_URL`), first-run/rebuild `:25` (`podman compose up --build`), prod images `:55–56` (`podman build --format docker --target prod`) + `:59` healthcheck rationale, stack summary `:65–68` with links to both architecture docs |
| **AC-13** | met | `compose.yaml` — `name: cubeclicker` (`:3`), services `backend`/`frontend` with `context: .` + pinned Dockerfile + `target: dev` (`:7–10`, `:20–23`), loopback pinned ports (`:13`, `:26`), `VITE_WS_URL` pinned default (`:29`), workspace-only bind mounts with the r5 `:z` option (`:17`, `:31`); `podman compose config -q` → exit 0 (§ 1.4); healthcheck-free (only `:2`'s comment mentions it, § 5 T6b quote) |
| **AC-14** | met | `compose.smoke.yaml` — service `smoke` with `image: docker.io/library/node:24-alpine` (`:5`), `./tests/e2e:/smoke:ro,z` (`:8`), `command: ["node","smoke.mjs"]` (`:9`), `depends_on: [backend, frontend]` (`:10–12`); merged `podman compose -f compose.yaml -f compose.smoke.yaml config -q` → exit 0 and the merged set contains all three services (T6b § 3.1/§ 3.2; re-run exit 0 here, § 1.4) |
| **AC-15** | met | `grep -n "^FROM" src/backend/Dockerfile` → lines 10/31/46/57, all `docker.io/library/node:24-alpine` (stages dev/build/prod-deps/prod); `grep -nE "^FROM (node\|nginxinc)"` both Dockerfiles → exit 1 (no unqualified token); T7 re-run of both `podman build --format docker --target dev\|prod` → exit 0 (§ 1.4); original T4b evidence with full transcripts in `build-log-T4b.md` § 4.1–§ 4.3 |
| **AC-16** | met | Backend `HEALTHCHECK` declared in both stages (`src/backend/Dockerfile:25–26` dev, `:68–69` prod) hitting `/healthz` with the pinned timing; T7 re-run: both builds exit 0 with **zero** `HEALTHCHECK is not supported` warnings and `podman image inspect` non-null `Healthcheck` with Interval 10s / Timeout 3s / Retries 5 / StartPeriod 15s (§ 1.4); prod image `User=node` + `NODE_ENV=production` in the image config (`:40` of the build output) and the `USER node` (`:71`) / `ENV NODE_ENV=production` (`:59`) instructions; dev stage `CMD ["npm","run","dev","-w","@cubeclicker/backend"]` (`:28`) = tsx watch; original T4b evidence `build-log-T4b.md` § 4.4–§ 4.5 |
| **AC-17** | met | `grep -n "^FROM" src/frontend/Dockerfile` → `docker.io/library/node:24-alpine` (`:6` dev, `:28` build), `docker.io/nginxinc/nginx-unprivileged:1.27-alpine` (`:41` prod); T7 re-run of both targets → exit 0, no OCI warning, `Healthcheck` non-null on both built images (§ 1.4); dev `EXPOSE 5173` (`:19`) + `CMD … @cubeclicker/frontend` (`:25`); prod `EXPOSE 8080` (`:46`), `User=101` (unprivileged nginx) with `ExposedPorts=map[8080/tcp:{}]` (§ 1.4), SPA fallback in `nginx.conf` (`try_files … /index.html`); original T5b evidence `build-log-T5b.md` § 3–§ 5 |
| **AC-18** | met | `.gitignore` covers `node_modules/`, `dist/`, `coverage/`, `*.tsbuildinfo`, `.env*`; `.dockerignore` excludes `.git`, `node_modules`(+`**/node_modules`), `dist`(+`**/dist`), `coverage`(+`**/coverage`), `.env*`, `docs`, `tests`, `.opencode`, `opencode.jsonc`, `README.md` while explicitly NOT excluding the manifests/`tsconfig.json`; `find . -maxdepth 3 -name '.env*' …` → no output (no `.env*` file exists anywhere); no secret token in any scaffold file |
| **AC-19** | met | `src/backend/src/app.ts:26` `app.get('/healthz', async () => ({ status: 'ok' }))`; unit test `app.test.ts:71–72` `describe('GET /healthz')` → `it('returns 200 with the pinned body')` via `inject` (4/4 backend tests pass, § 1.2); end-to-end via smoke `PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}` (§ 1.3) |
| **AC-20** | met | `app.ts:33–35` `/ws` route sends `JSON.stringify(helloMessage())`; `helloMessage(now = new Date())` (`:14–16`) returns the pinned envelope with a **server** clock ISO stamp; `app.test.ts` has a concurrent-clients hello test (`:87`); smoke `PASS websocket client 1/2 received hello` and host WS client received `{"type":"hello","serverTime":"2026-10-18T11:00:14.246Z"}` (§ 1.3) |
| **AC-21** | met | `src/backend/src/server.ts:3–4` are the only literals: `process.env.HOST ?? '0.0.0.0'`, `Number(process.env.PORT ?? 8080)`; live override probes (no env → `0.0.0.0:8080`; `PORT=9099` → `0.0.0.0:9099`; `HOST=127.0.0.1 PORT=9099` → `127.0.0.1:9099`) recorded in `build-log-T4.md` § 4.1/§ 4.3, and the composed run binds `127.0.0.1:8080`/`127.0.0.1:5173` (§ 1.3 `podman compose ps`) |
| **AC-22** | met | `src/frontend/src/ws/connection.ts` is the single lifecycle owner: `ConnectionStatus`, `ConnectionOptions` (injectable `socketFactory`, `maxAttempts`, `baseDelayMs`, `maxDelayMs`, `onStatus`), exported `createConnection(options)` (`:37`), statuses exactly `connecting \| connected \| disconnected` (`:10`); `connection.test.ts` covers connecting→connected on open (`:73`) and disconnected on close (`:86`); `npm test -w @cubeclicker/frontend` → 9/9 pass (§ 1.2) |
| **AC-23** | met | bounded retry with exponential backoff and cap (`connection.ts:87` stop when `attempt > maxAttempts`, `:90` `Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs)`), reset on successful open, `close()` cancels pending retries and closes the socket; tests cover the attempt cap (`connection.test.ts:115`), backoff cap (`:142`), counter reset (`:160`), close-cancels-retry (`:177`), idempotent close (`:190`), post-close drop ignored (`:203`) |
| **AC-24** | met | `App.tsx:30` `<span data-status={status}>` with labels `Connecting…`/`Connected`/`Disconnected` (`:9–11`), created once via `createConnection({ url: WS_URL, … })` (`:19`) with cleanup `connection.close()` (`:21`); `WS_URL` is `import.meta.env.VITE_WS_URL` (`:6`) injected by `vite.config.ts:22–24` `define` from `process.env.VITE_WS_URL ?? 'ws://localhost:8080/ws'`; compose passes the same default (`compose.yaml:29`) |
| **AC-25** | met | `tests/e2e/smoke.mjs` has **zero** imports (Node built-ins only: global `fetch`, global `WebSocket`, timers — `grep -n "^import\|require("` → exit 1); checks exactly: backend `/healthz` 200 (`:50`), frontend `/` 200 + `text/html`, two concurrent WS clients each parsing `hello` (`:103`, `:132`, `:153–156`), bounded readiness `READY_TIMEOUT_MS` default 30000 (`:22`), per-check `PASS`/`FAIL` lines (`:31`), `process.exitCode = 1` on failure (`:173`); live: `SMOKE PASS (4/4 checks)` exit 0 (§ 1.3) |
| **AC-26** | met | Re-run from the feature branch build state: `podman compose up -d --build --wait` → **exit 0** with both containers `Healthy`; `npm run smoke` (= `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`) → **exit 0**, `SMOKE PASS (4/4 checks)`; `podman compose down` → exit 0 (§ 1.3). Health signal = the image `HEALTHCHECK` carried by the compose-provider build path; neither compose file declares a healthcheck (T6b § 2). `--wait` is supported, so the contingency was not needed. **Evidence pointers (spec-r5 F1):** the passing sequence is `build-log-T6b.md` § 3 (re-confirmed here § 1.3); `build-log-T6.md` § 3–§ 4 is the frozen blocked first attempt and is *not* the AC-26 pass evidence |
| **AC-27** | met | From the build host: `node -e` fetch backend `/healthz` → 200 `{"status":"ok"}`; frontend `/` → 200 `text/html` (`has #root: true`); `node -e` global-`WebSocket` client → `{"type":"hello","serverTime":"2026-10-18T11:00:14.246Z"}` (§ 1.3). Same pointer note as AC-26: pass evidence = `build-log-T6b.md` § 3.7 + this re-run |
| **AC-28** | met | `npm ci` → exit 0 (lockfile in sync with both workspace manifests — § 1.1); `npm run lint` → 0, `npm run typecheck` → 0 (both workspaces), `npm test` → 0 (4 + 9 tests pass), `npm run build` → 0 (§ 1.2) |
| **AC-29** | met | Root `package.json`: `private: true`, `workspaces: ["src/backend","src/frontend"]`, `engines.node: ">=24"`, and exactly the six pinned scripts (`dev` = `podman compose up`, `lint` = `eslint .`, `typecheck`/`test`/`build` = `npm run <name> --workspaces --if-present`, `smoke` = the pinned compose run); devDeps exactly `typescript ~5.9`, `eslint ^9`, `@eslint/js ^9`, `typescript-eslint ^8`, `globals ^16`, `eslint-plugin-react-hooks ^5`; `src/backend/package.json` deps `fastify ^5`, `@fastify/websocket ^11` + devDeps `tsx ^4`, `vitest ^3`, `@types/node ^24`; `src/frontend/package.json` deps `react ^19`, `react-dom ^19` + devDeps `vite ^7`, `@vitejs/plugin-react ^5`, `vitest ^3`, `@types/react ^19`, `@types/react-dom ^19` — every row of `plan.md` § Dependency manifest, no extras |
| **AC-30** | met | `.opencode/skills/orchestration-playbook/SKILL.md:79` now reads "…(no shared-file contact (`package.json`, lockfiles, entrypoints, **container definitions such as the compose file and Dockerfiles**))…"; the T2 commit's diff over `.opencode/` shows this as the only line changed in that file (one insertion / one deletion) |
| **AC-31** | met | Exactly five guard-clause files, one line each, per `plan.md` contract 13: `planner.md` (settled-conventions tail), `builder.md` (decided-2026-10-17 tail), `web-implementation/SKILL.md` (container-assets-pinned sentence), `spec-authoring/references/spec-checklist.md` (container item 2), `spec-review/SKILL.md` (container item tail) — the T2 diff over `.opencode/` enumerates exactly those five changed lines plus the playbook line (AC-30); `grep -rn "until it is decided\|until the application stack is decided\|undecided stack\|No container assets before the application stack is decided" .opencode/` → exit 1 |
| **AC-32** | met | Whole-history check: `git diff --name-status 5d47786..HEAD` (the pre-feature `main` tip) lists only the `plan.md` § File inventory files — 8 modified pre-existing files + the new files + 12 build logs, nothing else; every per-task commit's touch-set ⊆ its `files_owned`; per-file level, the only diffs to pre-existing files are the pinned amendment-trace items (§ 5). Recorded build-start baselines exist for every edited file (T0 § 1, T1 § 1, T2 § 1, T2b § 1, T2c § 1, T4b § 1, T5b § 1, T6b § 1); T7 re-derived the per-commit stats live (§ 5) |
| **AC-33** | met | `git log --oneline 5d47786..HEAD -- .opencode/agents/` → exactly T0, T2, T2c. T0's diff adds exactly the six pinned `edit` allow entries (`18 insertions(+), 0 deletions` — six 3-line blocks, nothing else). T2's `builder.md` diff is the line-112 prose tail; T2c's is the line-112 tooling token only — the `permissions:` block (frontmatter lines 1–101) hashes `891015a593990d7629df4249f9e506578bdb0c608cd5b7cf28b6378763698999` at both `7ec718f` and `5afe0fb` (byte-frozen). The permission-line scan across **all** commits' `.opencode/` diffs returns only those six additions. No `.env*` file was ever created/edited/committed (`git log --all -- '.env*'` → empty; feature diff names contain no `env`); no push (remote-tracking refs = `origin/HEAD → origin/main`, `origin/main` still `02a9471`, no `origin/feat-stack-selection` ref); no provider/CI config added (§ 2.3); the aggregate change set is exactly the inventory (§ 5). Full evidence § 6 |
| **AC-34** | met | Command/port/env-name matrix across `AGENTS.md`, `README.md`, `stack.md`, `containerization.md`, `compose.yaml`, `compose.smoke.yaml`, Dockerfiles, workspace scripts — identical tokens, no divergence (§ 7); every cross-reference resolves to an existing path (both architecture docs, `README.md`, both Dockerfiles, both compose files, `tests/e2e/smoke.mjs`, `src/frontend/src/ws/connection.ts`); `docs/product/**` and the other features' artifacts are untouched (`git log --oneline 5d47786..HEAD -- docs/product docs/features/README.md docs/features/project-glossary docs/features/containerized-workflow docs/features/online-realtime-workflow opencode.jsonc LICENSE` → empty) |

## 4. AC-1 … AC-34 count check

```
$ grep -c '^- \*\*AC-' docs/features/stack-selection/spec.md
34
```

AC-1 … AC-34, sequential, no gaps and no renumbering; the r4-amended six (AC-12/15–17/14/26) and the r5-amended two (AC-13/14) keep their numbers and intent.

## 5. AC-32 — whole-history and per-task diff verification

### 5.1 Aggregate change set vs. `plan.md` § File inventory (nothing else)

```
$ git diff --name-status 5d47786..HEAD
A	.dockerignore
A	.gitignore
M	.opencode/agents/builder.md
M	.opencode/agents/planner.md
M	.opencode/skills/code-review/checklists/quality.md
M	.opencode/skills/orchestration-playbook/SKILL.md
M	.opencode/skills/spec-authoring/references/spec-checklist.md
M	.opencode/skills/spec-review/SKILL.md
M	.opencode/skills/web-implementation/SKILL.md
M	.opencode/skills/web-implementation/references/engineering-principles.md
M	AGENTS.md
A	README.md
A	compose.smoke.yaml
A	compose.yaml
M	docs/architecture/containerization.md
M	docs/architecture/stack.md
A	docs/features/stack-selection/build-log-T0.md
A	docs/features/stack-selection/build-log-T1.md
A	docs/features/stack-selection/build-log-T2.md
A	docs/features/stack-selection/build-log-T2b.md
A	docs/features/stack-selection/build-log-T2c.md
A	docs/features/stack-selection/build-log-T3.md
A	docs/features/stack-selection/build-log-T4.md
A	docs/features/stack-selection/build-log-T4b.md
A	docs/features/stack-selection/build-log-T5.md
A	docs/features/stack-selection/build-log-T5b.md
A	docs/features/stack-selection/build-log-T6.md
A	docs/features/stack-selection/build-log-T6b.md
A	eslint.config.mjs
A	package-lock.json
A	package.json
A	src/backend/Dockerfile
A	src/backend/package.json
A	src/backend/src/app.test.ts
A	src/backend/src/app.ts
A	src/backend/src/server.ts
A	src/backend/tsconfig.json
A	src/backend/vitest.config.ts
A	src/frontend/Dockerfile
A	src/frontend/index.html
A	src/frontend/nginx.conf
A	src/frontend/package.json
A	src/frontend/src/App.tsx
A	src/frontend/src/main.tsx
A	src/frontend/src/ws/connection.test.ts
A	src/frontend/src/ws/connection.ts
A	src/frontend/tsconfig.json
A	src/frontend/vite.config.ts
A	src/frontend/vitest.config.ts
A	tests/e2e/smoke.mjs
A	tsconfig.json
```

Every path is a `plan.md` § File inventory row. The 11 `M` rows are exactly the files allowed to be modified in place by `plan.md` § Amendment trace — the three decided docs (`stack.md`, `containerization.md`, `AGENTS.md`), the eight `.opencode` files (T0/T2/T2c: `builder.md`, `planner.md`, `orchestration-playbook/SKILL.md`, `spec-checklist.md`, `spec-review/SKILL.md`, `web-implementation/SKILL.md`, `engineering-principles.md`, `quality.md`); the 40 `A` rows are the inventory's new files plus the 12 build logs of T0–T6b. Nothing else in the repository was touched by the feature.

### 5.2 Per-task commit stats (live re-derivation) vs. recorded baselines

```
$ git log --format="%h %s" --shortstat 5d47786..HEAD
2f62057 fix: relabel compose bind mounts for SELinux hosts (T6b)
 3 files changed, 508 insertions(+), 3 deletions(-)
03772b1 test: containerized smoke test over the composed stack (T6)
 2 files changed, 731 insertions(+)
0da31cc fix: qualify backend base image and pin docker-format builds (T4b)
 2 files changed, 436 insertions(+), 6 deletions(-)
28437ac fix: qualify frontend and smoke base images and pin docker-format builds (T5b)
 4 files changed, 349 insertions(+), 7 deletions(-)
ae3a3f2 feat: backend skeleton with health and WebSocket hello (T4)
 7 files changed, 854 insertions(+)
9d10881 feat: frontend skeleton with connection module (T5)
 11 files changed, 808 insertions(+)
207d642 chore: scaffold workspace, compose stack, and commands (T3)
 12 files changed, 5639 insertions(+)
5afe0fb docs: align remaining framework Docker references with Podman (T2c)
 5 files changed, 170 insertions(+), 4 deletions(-)
3f8483d docs: adopt Podman compose tooling in decided docs (T2b)
 4 files changed, 215 insertions(+), 16 deletions(-)
7ec718f docs: align framework guidance with the decided stack (T2)
 7 files changed, 238 insertions(+), 6 deletions(-)
77be79c docs: decide application stack and settle container conventions (T1)
 4 files changed, 471 insertions(+), 28 deletions(-)
157002c chore: widen builder edit permissions for stack-selection (T0)
 2 files changed, 524 insertions(+)
```

Per-commit `--numstat` (file-level change sizes) — T7's re-derived shape, cross-checked against each task's own log:

| Commit | Task | Files (numstat) | Recorded in the task's log | Verdict |
| --- | --- | --- | --- | --- |
| `157002c` | T0 | `builder.md` 18/0; log 506/0 | `build-log-T0.md` (six entries, idempotent) | matches |
| `77be79c` | T1 | `AGENTS.md` 19/9; `containerization.md` 11/10; `stack.md` 33/9; log 408/0 | `build-log-T1.md` § diff vs baselines | matches (contracts 1.A–1.G, 2.A–2.C, 3.A–3.F) |
| `7ec718f` | T2 | six `.opencode` files 1/1 each; log 232/0 | `build-log-T2.md` § diff | matches (contract 13, six one-liners) |
| `3f8483d` | T2b | `AGENTS.md` 5/5; `containerization.md` 5/5; `stack.md` 6/6; log 199/0 | `build-log-T2b.md` § diff vs baselines | matches (contract 15 tokens) |
| `5afe0fb` | T2c | four `.opencode` files 1/1 each; log 166/0 | `build-log-T2c.md` § diff | matches (contract 16) — see § 9 MINOR 3 on the in-log stat |
| `207d642` | T3 | 11 new scaffold files + log (12 files) | `build-log-T3.md` § file list | matches (inventory rows) |
| `9d10881` | T5 | 10 new frontend files + log | `build-log-T5.md` | matches |
| `ae3a3f2` | T4 | 6 new backend files + log | `build-log-T4.md` | matches |
| `28437ac` | T5b | `README.md` 4/2; `compose.smoke.yaml` 1/1; `src/frontend/Dockerfile` 4/4; log 340/0 | `build-log-T5b.md` § 2/§ 7 | matches (r4 pins only) |
| `0da31cc` | T4b | `src/backend/Dockerfile` 6/6; log 430/0 | `build-log-T4b.md` § 3 (6 insertions / 6 deletions, six pinned lines) | matches |
| `03772b1` | T6 | `tests/e2e/smoke.mjs` 177/0 (new); log 554/0 | `build-log-T6.md` | matches |
| `2f62057` | T6b | `compose.yaml` 2/2; `compose.smoke.yaml` 1/1; log 505/0 | `build-log-T6b.md` § 2 (3 insertions / 3 deletions = three mount tokens) | matches |

No task's commit contains a file outside its `files_owned`, and no amended pre-existing file carries a change outside its `plan.md` § Amendment trace row. The `2f62057` stat (3 content insertions / 3 deletions) equals the three pinned mount tokens exactly; `0da31cc`'s 6/6 equals the four `FROM` tokens + two header comments exactly.

### 5.3 Amendment-trace spot check on the decided docs

`git diff 5d47786..HEAD -- docs/architecture/stack.md` shows exactly: 1.A status line, 1.B prelude+rules → decided preamble, 1.C new `## Application stack (DECIDED, 2026-10-17)` section, 1.D commands sub-table, 1.E heading change + closing sentence, 1.F container bullet replacement (with the leading "remains NOT DECIDED" fragment removed), 1.G closing paragraph, and the 15.A `docker compose` → `podman compose` tokens. `AGENTS.md` (28 lines changed: 19+/9) and `containerization.md` (25 lines: 11+/10) match contracts 3.A–3.F/15.C and 2.A–2.C/15.B respectively. No other line differs.

## 6. AC-33 — permission inspection across every commit

### 6.1 Which commits touch the agent files, and what they change

```
$ git log --oneline 5d47786..HEAD -- .opencode/agents/
5afe0fb docs: align remaining framework Docker references with Podman (T2c)
7ec718f docs: align framework guidance with the decided stack (T2)
157002c chore: widen builder edit permissions for stack-selection (T0)
```

T0 diff (the only permission change anywhere in the feature):

```
$ git show 157002c -- .opencode/agents/builder.md
@@ -32,6 +32,24 @@ permissions:
   - action: edit
     resource: "index.html"
     effect: allow
+  - action: edit
+    resource: "README.md"
+    effect: allow
+  - action: edit
+    resource: ".gitignore"
+    effect: allow
+  - action: edit
+    resource: ".dockerignore"
+    effect: allow
+  - action: edit
+    resource: "package-lock.json"
+    effect: allow
+  - action: edit
+    resource: "compose.yaml"
+    effect: allow
+  - action: edit
+    resource: "compose.smoke.yaml"
+    effect: allow
   - action: edit
     resource: "AGENTS.md"
     effect: allow

$ git show --stat --format="%h %s" 157002c
157002c chore: widen builder edit permissions for stack-selection (T0)
 .opencode/agents/builder.md                   |  18 +
 docs/features/stack-selection/build-log-T0.md | 506 ++++++++++++++++++++++++++
 2 files changed, 524 insertions(+)
```

18 added lines = six 3-line entries, **zero deletions** → no existing permission entry was altered, and the six paths are exactly the pinned set in the pinned order (inserted after the `index.html` allow block). Deny entries (`.env*`, push, sudo, `rm -rf`, curl/wget) are untouched — nothing in the diff reaches them.

T2 and T2c `builder.md` diffs are the line-112 prose line only:

```
$ git show 7ec718f -- .opencode/agents/builder.md | grep -E "^[+-]" | grep -vE "^(---|\+\+\+)"
-- Containerized delivery path (decided): Docker images + Docker Compose, … container assets still require the application stack — report `blocked` instead of guessing until it is decided.
+- Containerized delivery path (decided): Docker images + Docker Compose, … the application stack is decided (2026-10-17) — follow the pinned container conventions (`docs/architecture/containerization.md`); container assets live in the repository (`compose.yaml`, `src/*/Dockerfile`).

$ git show 5afe0fb -- .opencode/agents/builder.md | grep -E "^[+-]" | grep -vE "^(---|\+\+\+)"
-- Containerized delivery path (decided): Docker images + Docker Compose, … container assets live in the repository (`compose.yaml`, `src/*/Dockerfile`).
+- Containerized delivery path (decided): Podman images + Podman Compose (`podman compose`), … container assets live in the repository (`compose.yaml`, `src/*/Dockerfile`).
```

Aggregate over the feature, `builder.md` = 19 insertions / 1 deletion, i.e. the six permission entries + one prose line replaced once (two sequential prose touches: T2 changed the tail, T2c changed the tooling token — the single deletion is T2's removed tail, whose T2c-modified successor is inside the same line).

### 6.2 Permission-content scan over every commit's diff

```
$ git log -p --format="COMMIT %h %s" 5d47786..HEAD -- .opencode/ | grep -nE "^[+-].*(action:|resource:|effect:|permissions:)"
142:+  - action: edit
143:+    resource: "README.md"
144:+    effect: allow
145:+  - action: edit
146:+    resource: ".gitignore"
147:+    effect: allow
148:+  - action: edit
149:+    resource: ".dockerignore"
150:+    effect: allow
151:+  - action: edit
152:+    resource: "package-lock.json"
153:+    effect: allow
154:+  - action: edit
155:+    resource: "compose.yaml"
156:+    effect: allow
157:+  - action: edit
158:+    resource: "compose.smoke.yaml"
159:+    effect: allow
```

Only additions, all six, all in T0. (A whole-history variant of this grep also matches lines inside `build-log-T0.md`, which quotes the entries as evidence — those are log text, not permission content, and the path-scoped scan above excludes the docs tree.)

### 6.3 Byte-freeze of the `permissions:` block across T2c

```
$ git show 7ec718f:.opencode/agents/builder.md | sed -n '1,101p' | sha256sum
891015a593990d7629df4249f9e506578bdb0c608cd5b7cf28b6378763698999  -
$ git show 5afe0fb:.opencode/agents/builder.md | sed -n '1,101p' | sha256sum
891015a593990d7629df4249f9e506578bdb0c608cd5b7cf28b6378763698999  -
```

Identical — and the same value independently derived by the T2c focused check (`reviews/t2c-check.md` § 2) from its own baseline commit `7ec718f`; lines 1–101 are the whole frontmatter (closing `---` at 101, per that check).

### 6.4 No `.env*`, no push, no provider/CI

```
$ find . -maxdepth 3 -name '.env*' -not -path './node_modules/*' -not -path './*/node_modules/*'
                     # no output: no .env* file exists
$ git log --all --oneline -- '.env*' '*.env' '*.env.*'
                     # empty: no .env* path has ever been committed on any ref
$ git diff --name-only 5d47786..HEAD | grep -i "env"
env-diff-grep-exit=1 # no .env-related path in the feature change set

$ git branch -r
  origin/HEAD -> origin/main
  origin/main
$ git log --oneline -1 origin/main
02a9471 Containerized status
```

`origin/main` is still at `02a9471` (the pre-feature tip, unchanged since before this feature — its subject is from the containerized-workflow feature), there is no `origin/feat-stack-selection` ref, and `git status -sb` shows a plain local branch: nothing was pushed. No CI, terraform, k8s, or provider configuration file exists in the feature change set (§ 2.3).

### 6.5 `git status --short` / `git log` at the gate

```
$ git status --short
 M docs/features/README.md
 M docs/features/project-glossary/status.md
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md

$ git log --oneline 5d47786..HEAD
2f62057 fix: relabel compose bind mounts for SELinux hosts (T6b)
03772b1 test: containerized smoke test over the composed stack (T6)
0da31cc fix: qualify backend base image and pin docker-format builds (T4b)
28437ac fix: qualify frontend and smoke base images and pin docker-format builds (T5b)
ae3a3f2 feat: backend skeleton with health and WebSocket hello (T4)
9d10881 feat: frontend skeleton with connection module (T5)
207d642 chore: scaffold workspace, compose stack, and commands (T3)
5afe0fb docs: align remaining framework Docker references with Podman (T2c)
3f8483d docs: adopt Podman compose tooling in decided docs (T2b)
7ec718f docs: align framework guidance with the decided stack (T2)
77be79c docs: decide application stack and settle container conventions (T1)
157002c chore: widen builder edit permissions for stack-selection (T0)
```

The two modified paths are the pre-existing packaging dirt from the accepted `project-glossary` feature (one bookkeeping line each: a README index row and a merge-result line) — neither is part of this feature's change set and neither was staged. The untracked paths are this feature's planner artifacts (spec/plan/tasks/status + reviews), which the builder does not own and leaves untouched. The 12 commits are exactly the pinned per-task commits with their pinned conventional messages (`docs:`, `chore:`, `feat:`, `fix:`, `test:`).

## 7. AC-34 — cross-file consistency matrix

### 7.1 Command tokens

```
npm ci               -> AGENTS.md README.md docs/architecture/stack.md src/backend/Dockerfile src/frontend/Dockerfile
npm run lint         -> AGENTS.md README.md docs/architecture/stack.md
npm run typecheck    -> AGENTS.md README.md docs/architecture/stack.md package.json
npm test             -> AGENTS.md README.md docs/architecture/stack.md
npm run build        -> AGENTS.md README.md docs/architecture/stack.md src/backend/Dockerfile src/frontend/Dockerfile package.json
npm run dev          -> AGENTS.md README.md docs/architecture/stack.md docs/architecture/containerization.md
npm run smoke        -> AGENTS.md README.md docs/architecture/stack.md docs/architecture/containerization.md
podman compose up    -> AGENTS.md README.md docs/architecture/stack.md docs/architecture/containerization.md compose.yaml compose.smoke.yaml package.json
```

Every command token documented in `stack.md` § Commands and `AGENTS.md` § Commands resolves to the same spelling in `README.md` (commands table), the compose files (comments), the Dockerfiles (header build commands), and `package.json` (the script that implements it). No file uses a variant spelling.

### 7.2 Port and environment-variable tokens

```
BACKEND_PORT:-8080       -> docs/architecture/containerization.md compose.yaml
FRONTEND_PORT:-5173      -> docs/architecture/containerization.md compose.yaml
VITE_WS_URL              -> README.md docs/architecture/containerization.md compose.yaml src/frontend/src/App.tsx src/frontend/vite.config.ts
ws://localhost:8080/ws   -> README.md docs/architecture/containerization.md compose.yaml src/frontend/vite.config.ts (default) src/frontend/src/ws/connection.test.ts
5173                     -> README.md docs/architecture/containerization.md compose.yaml src/frontend/vite.config.ts src/frontend/Dockerfile tests/e2e/smoke.mjs
8080                     -> README.md docs/architecture/containerization.md compose.yaml src/backend/src/server.ts (default) src/backend/Dockerfile src/frontend/src/ws/connection.test.ts src/frontend/nginx.conf src/frontend/Dockerfile tests/e2e/smoke.mjs
/ws                      -> AGENTS.md README.md docs/architecture/stack.md docs/architecture/containerization.md compose.yaml src/backend/src/app.ts src/backend/src/server.ts src/frontend/vite.config.ts tests/e2e/smoke.mjs
/healthz                 -> README.md docs/architecture/stack.md docs/architecture/containerization.md src/backend/src/app.ts src/backend/Dockerfile tests/e2e/smoke.mjs
```

Backend listen port 8080 and frontend dev port 5173 appear with the same meaning in the docs, the compose port mappings, the Dockerfile `EXPOSE`/`HEALTHCHECK`/nginx config, and the smoke defaults; `BACKEND_PORT`/`FRONTEND_PORT` are used only in the compose interpolation and the docs table (single definition), and `VITE_WS_URL` flows compose → Vite `define` → `App.tsx` as one default. (The matrix was run over tracked sources only; `dist/` and `node_modules/` build outputs, which are gitignored, also matched the same tokens.)

### 7.3 Cross-references resolve; excluded surfaces untouched

```
docs/architecture/stack.md                 exists
docs/architecture/containerization.md      exists
README.md                                  exists
src/backend/Dockerfile                     exists
src/frontend/Dockerfile                    exists
compose.yaml                               exists
compose.smoke.yaml                         exists
tests/e2e/smoke.mjs                        exists
src/frontend/src/ws/connection.ts          exists

$ grep -rn "src/shared" AGENTS.md README.md docs/architecture src tests compose.yaml compose.smoke.yaml package.json
shared-exit=1                              # no dangling reference to the reserved (not scaffolded) path

$ git log --oneline 5d47786..HEAD -- docs/product docs/features/README.md docs/features/project-glossary docs/features/containerized-workflow docs/features/online-realtime-workflow opencode.jsonc LICENSE
excluded-log-exit=0 (empty)                # docs/product/** and other features' artifacts untouched by the feature
```

## 8. Evidence pointer for AC-15/16/17 build-form (per the T7 brief)

The T7 requirement is that the AC-15/16/17 evidence comes from the T4b/T5b build logs (amended `podman build --format docker` forms + `podman image inspect` healthcheck-present). T7 re-ran those forms live (§ 1.4, all four exit 0, zero OCI warnings, non-null healthchecks) and the original full transcripts remain:

- backend: `build-log-T4b.md` § 4.1 (qualified `FROM` grep), § 4.2/§ 4.3 (dev/prod `--format docker` builds, `EXIT=0`), § 4.4 (OCI warning absent), § 4.5 (`podman image inspect` → non-null `Healthcheck`, pinned values; prod `User=node`, `NODE_ENV=production`).
- frontend + smoke: `build-log-T5b.md` § 3 (qualified `FROM`s), § 4 (both builds `EXIT=0`, no OCI warning), § 5 (healthchecks non-null on both built tags; prod non-root `uid=101(nginx)`, `EXPOSE 8080`, SPA fallback), § 7 (merged-model check: smoke image `docker.io/library/node:24-alpine`, all three services).

## 9. Carried MINORs (noted, not fixed — none affects an AC)

1. **spec-r3 F1 — change-summary quantifier (open, backlogged).** `plan.md:46` still claims "19 occurrences in `spec.md`, 14 in `plan.md`" for the r3 Docker→Podman replacement. From the r5 tree the claim is not re-derivable: `grep -o "docker compose" docs/features/stack-selection/spec.md | wc -l` → `0` (all replaced) and `… plan.md …` → `13` (the retained "before" side of the contract-15/16 replacement rows). No functional impact; carried exactly as the r3 review left it. T7 does not edit `plan.md` (not owned).
2. **spec-r5 F1 — AC-26/AC-27 evidence pointers (noted).** `spec.md:98–99` still say "(recorded in `build-log-T6.md`)". After r5 that log records the *blocked* first attempt; the passing sequence is in `build-log-T6b.md` § 3 (re-confirmed live here, § 1.3). Per the r5 finding's alternative disposition, this log explicitly records: **AC-26/AC-27 pass evidence = `build-log-T6b.md` § 3 (green) + `build-log-T7.md` § 1.3 (re-run); `build-log-T6.md` § 3–§ 4 is the frozen failing run.** T7 does not edit `spec.md` (not owned), so the in-place pointer fix remains for the next artifact touch.
3. **t2c-check F1 — stale in-log stat (confirmed, no substance impact).** `build-log-T2c.md:159–160` records `build-log-T2c.md | 140 +++` and "144 insertions"; the live commit stat is `166` lines and `170 insertions(+), 4 deletions(-)`. T7's carry-forward required cross-check was performed (§ 5.2): the live `--numstat` (`1/1` × 4 files + `166/0` log) confirms the four contract-16 replacements are exactly as the T2c check independently verified — only the log's self-recorded stat line is stale.

## 10. Findings — drift from the pinned contracts

**None.** Every deliverable matches its pinned contract; the amendment trace is closed (the whole-history change set = the inventory, § 5.1); the permissions block is byte-frozen outside T0's six entries; the stale-token scan is empty. Specifically re-verified at the pinned r4/r5 state: every base-image token is registry-qualified in both Dockerfiles and the smoke image row; every bare build in README/Dockerfile headers uses `--format docker`; the three compose bind mounts carry `:z`/`:z`/`:ro,z`; `compose.yaml` remains healthcheck-free; `tests/e2e/smoke.mjs` is byte-unchanged (`a14c30a2…`); the r5 SELinux relabel works through the provider on the Enforcing host with no manual step and no host flag.

Observations (not drift): (a) `npm run build` and the compose builds create gitignored `dist/`/`node_modules/` artifacts inside the workspaces — no tracked file moves (§ 1.4 hygiene check); (b) the compose provider's banner and its `localhost/`-prefixed tag echo are provider output, not repository content.

## 11. Acceptance audit (this task) and commit

T7's acceptance is the verification gate itself: AC-1 … AC-34, with AC-28/AC-32/AC-33/AC-34 as the final checks.

- **AC-28 — met.** `npm ci` exit 0 (lockfile in sync) and `npm run lint` / `npm run typecheck` / `npm test` / `npm run build` all exit 0 (§ 1.1/§ 1.2).
- **AC-32 — met.** Whole-history diff = the inventory; every per-task commit's touch-set ⊆ `files_owned`; every amended pre-existing file's diff = its `plan.md` § Amendment trace row (§ 5).
- **AC-33 — met.** Six-entry T0 addition (18+/0−), byte-frozen `permissions:` sha `891015a5…` across T2c, permission scan clean across all commits, no `.env*`, no push, no provider/CI, aggregate = inventory (§ 6).
- **AC-34 — met.** Command/port/env matrix consistent across all seven surfaces, all cross-references resolve, `docs/product/**` and other features untouched (§ 7).
- **AC-1 … AC-27, AC-29 … AC-31 — met** (§ 3 table, § 1 command evidence, § 2 scans).

Commit — only this log is staged, by explicit pathspec; never `git add .`/`-A`:

```
$ git add docs/features/stack-selection/build-log-T7.md
$ git diff --cached --name-only
docs/features/stack-selection/build-log-T7.md
$ git commit -m "docs: record T7 verification pass for stack-selection (T7)"
```

The pre-existing dirt (`docs/features/README.md`, `docs/features/project-glossary/status.md`) and the untracked spec/plan/tasks/status/reviews artifacts remain untouched and unstaged. Nothing was pushed; no `.env*` file exists or was touched; no deliverable byte changed during this task.

## 12. Deviations and notes

- **No deviation from the pinned verify list.** Every pinned T7 command was run in the pinned form; the only additions are non-mutating inspections used as evidence (`podman image inspect` field-by-field templates, `podman compose config -q` ×2, `git show`/`git diff`/`git log`/`git grep`-style read-only checks) and the four live build re-runs requested for AC-15/16/17 build-form evidence.
- **Evidence-pointer precision (spec-r5 F1) applied in this log** rather than in `spec.md`: AC-26/AC-27 point at `build-log-T6b.md` § 3 + this log's § 1.3 (§ 9.2).
- **Raw logs** for the session live in `/tmp/opencode/t7/` (`npm-ci.log`, `verify.log`, `compose-sequence.log`, `builds.log`, `build-*.log`, the `*-scans`/`ac-*`/`ac-anchors-*` files); the transcripts above are verbatim copies from them (ANSI banner escapes stripped).
