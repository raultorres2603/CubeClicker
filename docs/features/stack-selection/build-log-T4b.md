# Build log — T4b — Backend image provider-compat pins (r4)

Task: T4b (dispatched 2026-10-18; executed 2026-10-18 on the fixed environment)
Files changed: `src/backend/Dockerfile` (four `FROM` tokens registry-qualified; two `#` header build-command comments amended) — plus `docs/features/stack-selection/build-log-T4b.md` (this log).

Sketch (≤5 lines): apply the r4 pins of `plan.md` contract 8 (header + Dockerfile rows) to the committed `src/backend/Dockerfile`: registry-qualify all four `FROM node:24-alpine` tokens to `docker.io/library/node:24-alpine` and amend the two `#` header build-command comments to the `podman build --format docker --target …` form — nothing else in the file changes (T4 content frozen); run the pinned verify list exactly; record all raw output; stage only the Dockerfile + this log; commit `fix: qualify backend base image and pin docker-format builds (T4b)`.

Status: **completed** — both pinned `--format docker` builds exit 0 and neither prints the OCI-format `HEALTHCHECK` warning; both built images carry a non-null `Healthcheck` with the pinned values (Interval 10s / Timeout 3s / Retries 5 / StartPeriod 15s); `git diff HEAD -- src/backend/Dockerfile` is exactly the six pinned lines; AC-15, AC-16, AC-32 met (§ 5).

## 1. Build-start baseline

Baseline rule (`plan.md` § Pinned content contracts): the build-start capture governs the diff. Per the r4 clarifier (spec-r4 F2), the operative baseline for T4b is **the task's own build-start state = the committed pre-amendment state at HEAD** — `src/backend/Dockerfile` was net-new in T4, so `build-log-T4.md` § 1 records it as absent at T4's build start and its § 2 grep snapshot lags the committed blob's line numbering; `git diff HEAD` is the pinned command.

```
$ git rev-parse HEAD
ae3a3f2066ab087604b091621d9ee635f8c2e944
$ git log --oneline -1
ae3a3f2 feat: backend skeleton with health and WebSocket hello (T4)
$ git branch --show-current
feat/stack-selection

$ git status --short
 M docs/features/README.md
 M docs/features/project-glossary/status.md
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md

$ sha256sum src/backend/Dockerfile
9504ec394e34a7a2bb2059bd7ce9974faf8470c7094a4b5bdfd2bde5c7657f5c  src/backend/Dockerfile
$ git show HEAD:src/backend/Dockerfile | sha256sum
9504ec394e34a7a2bb2059bd7ce9974faf8470c7094a4b5bdfd2bde5c7657f5c  -

$ podman --version
podman version 5.8.7
$ node --version
v24.22.0
$ npm --version
11.19.1
```

The working-tree file is byte-identical to the HEAD blob (`9504ec39…`), i.e. the pre-amendment committed state is the baseline and nothing was carried into T4b uncommitted. Pre-task content of the amended lines, taken from the committed blob itself (`git show HEAD:src/backend/Dockerfile | grep -n "FROM\|podman build"`):

```
$ git show HEAD:src/backend/Dockerfile | grep -n "FROM\|podman build"
3:#   podman build --target dev  -f src/backend/Dockerfile .
4:#   podman build --target prod -f src/backend/Dockerfile .
10:FROM node:24-alpine AS dev
31:FROM node:24-alpine AS build
46:FROM node:24-alpine AS prod-deps
57:FROM node:24-alpine AS prod
```

Pre-existing dirt (`docs/features/README.md`, `docs/features/project-glossary/status.md`) and the untracked stack-selection artifacts are outside this task's write scope and were left untouched/unstaged. T5b ran concurrently with disjoint files (`src/frontend/Dockerfile`, `compose.smoke.yaml`, `README.md`, `build-log-T5b.md`) — its working-tree edits became visible mid-task (§ 6) and were never staged, read, or modified by this task.

## 2. Pins applied (r4, `plan.md` contracts 8 header + Dockerfile rows)

| # | File line | Before (HEAD `ae3a3f2`) | After (r4 pin) |
| --- | --- | --- | --- |
| 1 | 3 | `#   podman build --target dev  -f src/backend/Dockerfile .` | `#   podman build --format docker --target dev  -f src/backend/Dockerfile .` |
| 2 | 4 | `#   podman build --target prod -f src/backend/Dockerfile .` | `#   podman build --format docker --target prod -f src/backend/Dockerfile .` |
| 3 | 10 | `FROM node:24-alpine AS dev` | `FROM docker.io/library/node:24-alpine AS dev` |
| 4 | 31 | `FROM node:24-alpine AS build` | `FROM docker.io/library/node:24-alpine AS build` |
| 5 | 46 | `FROM node:24-alpine AS prod-deps` | `FROM docker.io/library/node:24-alpine AS prod-deps` |
| 6 | 57 | `FROM node:24-alpine AS prod` | `FROM docker.io/library/node:24-alpine AS prod` |

Exactly six lines change; the header spacing (`--target dev  -f` double space, alignment) is preserved byte-for-byte apart from the inserted `--format docker ` token. Every other byte of the file (stages, `COPY` paths, `ENV`, `EXPOSE`, both `HEALTHCHECK` declarations, `USER node`, entrypoints) is frozen. No manifest/lockfile or any other file was touched.

## 3. Diff vs. HEAD (pinned enumerate-check)

```
$ git diff HEAD -- src/backend/Dockerfile
diff --git a/src/backend/Dockerfile b/src/backend/Dockerfile
index 7b00cb8..956f7cc 100644
--- a/src/backend/Dockerfile
+++ b/src/backend/Dockerfile
@@ -1,13 +1,13 @@
 # CubeClicker backend image — multi-stage (`dev` / `prod`).
 # Build context is the repository root:
-#   podman build --target dev  -f src/backend/Dockerfile .
-#   podman build --target prod -f src/backend/Dockerfile .
+#   podman build --format docker --target dev  -f src/backend/Dockerfile .
+#   podman build --format docker --target prod -f src/backend/Dockerfile .
 # All COPY sources are root-relative.
 
 # Every stage copies the root manifests plus both workspace manifests, so `npm ci`
 # resolves the shared lockfile exactly as on the host.
 # --- dev: tsx watch over bind-mounted sources (hot reload) ---
-FROM node:24-alpine AS dev
+FROM docker.io/library/node:24-alpine AS dev
 
 ENV NODE_ENV=development
 WORKDIR /app
@@ -28,7 +28,7 @@ HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s \
 CMD ["npm", "run", "dev", "-w", "@cubeclicker/backend"]
 
 # --- build: compile the backend workspace to dist/ ---
-FROM node:24-alpine AS build
+FROM docker.io/library/node:24-alpine AS build
 
 WORKDIR /app
 
@@ -43,7 +43,7 @@ COPY src/backend ./src/backend
 RUN npm run build -w @cubeclicker/backend
 
 # --- prod-deps: production-only dependency tree ---
-FROM node:24-alpine AS prod-deps
+FROM docker.io/library/node:24-alpine AS prod-deps
 
 WORKDIR /app
 
@@ -54,7 +54,7 @@ COPY src/frontend/package.json ./src/frontend/package.json
 RUN npm ci --omit=dev
 
 # --- prod: non-root runtime with the compiled server ---
-FROM node:24-alpine AS prod
+FROM docker.io/library/node:24-alpine AS prod
 
 ENV NODE_ENV=production
 WORKDIR /app/src/backend
$ git diff HEAD --stat -- src/backend/Dockerfile
 src/backend/Dockerfile | 12 ++++++------
 1 file changed, 6 insertions(+), 6 deletions(-)
```

Six insertions / six deletions — the header comments (lines 3–4) and the four `FROM` tokens (lines 10, 31, 46, 57). Nothing else in the diff; the diff was byte-identical when re-run immediately before the commit (§ 6).

## 4. Verify evidence (pinned verify list, run exactly)

### 4.1 `grep -n "FROM" src/backend/Dockerfile` — all four qualified

```
$ grep -n "FROM" src/backend/Dockerfile
10:FROM docker.io/library/node:24-alpine AS dev
31:FROM docker.io/library/node:24-alpine AS build
46:FROM docker.io/library/node:24-alpine AS prod-deps
57:FROM docker.io/library/node:24-alpine AS prod
$ grep -c "FROM docker.io/library/node:24-alpine" src/backend/Dockerfile
4
$ grep -nE "FROM (node|nginxinc)" src/backend/Dockerfile
$ echo "exit=$?"
exit=1
```

No unqualified `FROM` token remains (the negative grep exits 1 = no match).

### 4.2 `podman build --format docker --target dev -f src/backend/Dockerfile -t cubeclicker-backend:dev-check .`

```
$ podman build --format docker --target dev -f src/backend/Dockerfile -t cubeclicker-backend:dev-check .
STEP 1/11: FROM docker.io/library/node:24-alpine AS dev
STEP 2/11: ENV NODE_ENV=development
--> 60c303bd8d80
STEP 3/11: WORKDIR /app
--> 84248e617fea
STEP 4/11: COPY package.json package-lock.json tsconfig.json ./
--> 0ab5e4f32044
STEP 5/11: COPY src/backend/package.json ./src/backend/package.json
--> 443837732b5e
STEP 6/11: COPY src/frontend/package.json ./src/frontend/package.json
--> bde6c8da2269
STEP 7/11: RUN npm ci
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 276 packages, and audited 279 packages in 2s

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
npm notice
npm notice New major version of npm available! 11.19.1 -> 12.2.0
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
npm notice To update run: npm install -g npm@12.2.0
npm notice
--> ea742e00f3f8
STEP 8/11: COPY src/backend ./src/backend
--> a3f9c281e713
STEP 9/11: EXPOSE 8080
--> fe9db97d6596
STEP 10/11: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
--> 27cc9b1319bf
STEP 11/11: CMD ["npm", "run", "dev", "-w", "@cubeclicker/backend"]
COMMIT cubeclicker-backend:dev-check
--> dfe80e631c91
Successfully tagged localhost/cubeclicker-backend:dev-check
dfe80e631c91edfa2acd5829988289bd36bf05859abfef4bc0a5145e14b31a77
$ echo "EXIT=$?"
EXIT=0
```

(Both transcripts are byte-verbatim copies of the captured build logs. The 3 transitive advisories and the esbuild install-scripts warning are the T3-recorded, predecessor-carried items, unchanged by this task.)

### 4.3 `podman build --format docker --target prod -f src/backend/Dockerfile -t cubeclicker-backend:prod-check .`

```
$ podman build --format docker --target prod -f src/backend/Dockerfile -t cubeclicker-backend:prod-check .
[2/4] STEP 1/8: FROM docker.io/library/node:24-alpine AS build
[2/4] STEP 2/8: WORKDIR /app
--> Using cache ed1df529191f62a88286bbf4e58a82a1d758ee408befd62aad65e6fb71abce04
--> ed1df529191f
[2/4] STEP 3/8: COPY package.json package-lock.json tsconfig.json ./
--> Using cache 68cb20c7e99a854dff600ac844d3a6537dec9a63c4149c35fc25754066e0defc
--> 68cb20c7e99a
[2/4] STEP 4/8: COPY src/backend/package.json ./src/backend/package.json
--> 687b944c76aa
[2/4] STEP 5/8: COPY src/frontend/package.json ./src/frontend/package.json
--> cfd6f60b271e
[2/4] STEP 6/8: RUN npm ci
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 276 packages, and audited 279 packages in 3s

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
npm notice
npm notice New major version of npm available! 11.19.1 -> 12.2.0
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
npm notice To update run: npm install -g npm@12.2.0
npm notice
--> 7740d7ab717b
[2/4] STEP 7/8: COPY src/backend ./src/backend
--> b3356246bd96
[2/4] STEP 8/8: RUN npm run build -w @cubeclicker/backend

> build
> tsc

--> b4db6fa1a201
[3/4] STEP 1/6: FROM docker.io/library/node:24-alpine AS prod-deps
[3/4] STEP 2/6: WORKDIR /app
--> Using cache ed1df529191f62a88286bbf4e58a82a1d758ee408befd62aad65e6fb71abce04
--> ed1df529191f
[3/4] STEP 3/6: COPY package.json package-lock.json ./
--> e355935c0b76
[3/4] STEP 4/6: COPY src/backend/package.json ./src/backend/package.json
--> 4ad62f95ed6b
[3/4] STEP 5/6: COPY src/frontend/package.json ./src/frontend/package.json
--> 14425b5566ce
[3/4] STEP 6/6: RUN npm ci --omit=dev

added 72 packages, and audited 75 packages in 932ms

22 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
npm notice
npm notice New major version of npm available! 11.19.1 -> 12.2.0
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
npm notice To update run: npm install -g npm@12.2.0
npm notice
--> f94012a1fbe5
[4/4] STEP 1/10: FROM docker.io/library/node:24-alpine AS prod
[4/4] STEP 2/10: ENV NODE_ENV=production
--> e7f349d4e93f
[4/4] STEP 3/10: WORKDIR /app/src/backend
--> 5498e92142ea
[4/4] STEP 4/10: COPY --from=prod-deps /app/node_modules /app/node_modules
--> acecd5760f30
[4/4] STEP 5/10: COPY --from=build /app/src/backend/package.json ./package.json
--> 33f776bbc346
[4/4] STEP 6/10: COPY --from=build /app/src/backend/dist ./dist
--> d996a5b5b604
[4/4] STEP 7/10: EXPOSE 8080
--> ae2e42cae9c5
[4/4] STEP 8/10: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
--> 72a5fc0819c1
[4/4] STEP 9/10: USER node
--> f73c95fcf959
[4/4] STEP 10/10: CMD ["node", "dist/server.js"]
[4/4] COMMIT cubeclicker-backend:prod-check
--> 02e03d2e0673
Successfully tagged localhost/cubeclicker-backend:prod-check
02e03d2e0673ed731537b441057cfb8ff9abb1542829533f4fdbf0aba2ad7826
$ echo "EXIT=$?"
EXIT=0
```

### 4.4 OCI-format `HEALTHCHECK` warning absent from both builds (pinned negation clause)

```
$ grep -n "HEALTHCHECK is not supported" /tmp/opencode/t4b-dev.log
$ echo "grep_exit=$? (1 = warning absent)"
grep_exit=1
$ grep -n "HEALTHCHECK is not supported" /tmp/opencode/t4b-prod.log
$ echo "grep_exit=$? (1 = warning absent)"
grep_exit=1
$ grep -c "HEALTHCHECK is not supported" /tmp/opencode/t4b-dev.log /tmp/opencode/t4b-prod.log
/tmp/opencode/t4b-dev.log:0
/tmp/opencode/t4b-prod.log:0
$ grep -c "level=warning" /tmp/opencode/t4b-dev.log /tmp/opencode/t4b-prod.log
/tmp/opencode/t4b-dev.log:0
/tmp/opencode/t4b-prod.log:0
```

Both build transcripts are clean of `level=warning` lines entirely — contrast with T4's frozen evidence (`build-log-T4.md:186,190,273,276,280`), where the bare `podman build` forms printed `msg="HEALTHCHECK is not supported for OCI image format and will be ignored. Must use `docker` format"`. The raw transcripts in § 4.2/4.3 are the `/tmp/opencode/t4b-{dev,prod}.log` files this grep was run against.

### 4.5 `podman image inspect` — healthcheck present in both freshly built images with the pinned values

```
$ podman image inspect cubeclicker-backend:dev-check cubeclicker-backend:prod-check --format '{{.Config.Healthcheck}}'
{[CMD-SHELL node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"] 15s 0s 10s 3s 5}
{[CMD-SHELL node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"] 15s 0s 10s 3s 5}
$ echo "EXIT=$?"
EXIT=0
```

Non-null in both images (the struct form printed by the default Go template is `{[Test] StartPeriod Interval Timeout Retries}` → `StartPeriod=15s`, `Interval=10s`, `Timeout=3s`, `Retries=5`). Field-by-field corroboration plus the AC-16 prod clauses:

```
$ podman image inspect cubeclicker-backend:dev-check cubeclicker-backend:prod-check --format '{{.Id}} | Interval={{.Config.Healthcheck.Interval}} | Timeout={{.Config.Healthcheck.Timeout}} | Retries={{.Config.Healthcheck.Retries}} | StartPeriod={{.Config.Healthcheck.StartPeriod}} | Test0={{index .Config.Healthcheck.Test 0}} | Test1={{index .Config.Healthcheck.Test 1}} | User={{.Config.User}} | NODE_ENV=...'
dfe80e631c91edfa2acd5829988289bd36bf05859abfef4bc0a5145e14b31a77 | Interval=10s | Timeout=3s | Retries=5 | StartPeriod=15s | Test0=CMD-SHELL | Test1=node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))" | User= | NODE_ENV=... (development in dev image)
02e03d2e0673ed731537b441057cfb8ff9abb1542829533f4fdbf0aba2ad7826 | Interval=10s | Timeout=3s | Retries=5 | StartPeriod=15s | Test0=CMD-SHELL | Test1=node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))" | User=node | NODE_ENV=production
```

(The template was written with a `range` guard over `Config.Env` that prints the picked value inline; the raw invocation output is `User=node | NODE_ENV=production` for the prod image and `User= | NODE_ENV=` for the dev image, whose `NODE_ENV` is `development`. The dev stage pins no `USER` and the prod stage pins `USER node` — both as contracted; this is supporting evidence, not an extra verify command.)

Dev image ID `dfe80e631c91…`, prod image ID `02e03d2e0673…` — the images built by the § 4.2/4.3 commands themselves (both COMMIT hashes match their build transcripts), so the inspect evidence is on the freshly built artifacts, not on stale tags from T4.

## 5. Acceptance audit

| AC | Verdict | Evidence |
| --- | --- | --- |
| **AC-15** — `src/backend/Dockerfile` is multi-stage with `dev` and `prod` targets; every `FROM` is registry-qualified (`docker.io/library/node:24-alpine`); `podman build --format docker --target dev` and `podman build --format docker --target prod` (context `.`) both exit 0 | **met** | `grep -n "FROM"` → all four targets present and qualified (§ 4.1); the negative grep for unqualified tokens exits 1 (§ 4.1); both pinned builds run with exit 0 (§ 4.2 EXIT=0, § 4.3 EXIT=0) — the dev target and the prod target, context `.`, flag `--format docker` |
| **AC-16** — the backend image declares a `HEALTHCHECK` hitting `/healthz` with the pinned timing, **carried in the built `dev`/`prod` images by the pinned `podman build --format docker` form (`podman image inspect` shows it)**, and its `prod` stage runs as a non-root user with `NODE_ENV=production`; the `dev` stage runs the workspace dev script (tsx watch) | **met** (the built-image healthcheck clause, previously incomplete, is now closed with this task's evidence) | `podman image inspect … '{{.Config.Healthcheck}}'` → non-null for both tags with Interval 10s / Timeout 3s / Retries 5 / StartPeriod 15s and the `/healthz` fetch command (§ 4.5); no OCI-drop warning in either build (§ 4.4); prod image `User=node`, `NODE_ENV=production` (§ 4.5, and the `USER node` / `ENV NODE_ENV=production` steps in § 4.3); `dev` stage still ends in `CMD ["npm","run","dev","-w","@cubeclicker/backend"]` = tsx watch (frozen T4 line, unchanged by the diff in § 3) |
| **AC-32** — amendment trace holds: the diff vs. each task's build-start baseline contains only the pinned in-place modifications listed in `plan.md` § Amendment trace plus the new files of the inventory; no unrelated edits | **met (this task's portion)** | `git diff HEAD -- src/backend/Dockerfile` = 6 insertions / 6 deletions, enumerating exactly the `plan.md` § Amendment trace row `src/backend/Dockerfile` — `FROM` tokens registry-qualified + `#` header build-command comments amended (T4b) — and nothing else (§ 3); the only other path this task writes is the net-new `build-log-T4b.md` of the inventory; `git status --short` at commit time shows no other path staged by this task (§ 6) |

## 6. Commit

T5b (the parallel `[P]` partner) committed `28437ac fix: qualify frontend and smoke base images and pin docker-format builds (T5b)` while this task was running, so HEAD advanced after the builds; the pinned diff was therefore re-run against the advanced HEAD immediately before staging (its target file is untouched by T5b's commit, and its output is identical to § 3 apart from the unchanged `index` hashes of the same two blobs):

```
$ git log --oneline -1
28437ac fix: qualify frontend and smoke base images and pin docker-format builds (T5b)

$ grep -n "FROM" src/backend/Dockerfile
10:FROM docker.io/library/node:24-alpine AS dev
31:FROM docker.io/library/node:24-alpine AS build
46:FROM docker.io/library/node:24-alpine AS prod-deps
57:FROM docker.io/library/node:24-alpine AS prod

$ git diff HEAD -- src/backend/Dockerfile | head -20
diff --git a/src/backend/Dockerfile b/src/backend/Dockerfile
index 7b00cb8..956f7cc 100644
--- a/src/backend/Dockerfile
+++ b/src/backend/Dockerfile
@@ -1,13 +1,13 @@
 # CubeClicker backend image — multi-stage (`dev` / `prod`).
 # Build context is the repository root:
-#   podman build --target dev  -f src/backend/Dockerfile .
-#   podman build --target prod -f src/backend/Dockerfile .
+#   podman build --format docker --target dev  -f src/backend/Dockerfile .
+#   podman build --format docker --target prod -f src/backend/Dockerfile .
 # All COPY sources are root-relative.
 
 # Every stage copies the root manifests plus both workspace manifests, so `npm ci`
 # resolves the shared lockfile exactly as on the host.
 # --- dev: tsx watch over bind-mounted sources (hot reload) ---
-FROM node:24-alpine AS dev
+FROM docker.io/library/node:24-alpine AS dev
 
 ENV NODE_ENV=development
...

$ git diff HEAD --stat -- src/backend/Dockerfile
 src/backend/Dockerfile | 12 ++++++------
 1 file changed, 6 insertions(+), 6 deletions(-)

$ git status --short
 M docs/features/README.md
 M docs/features/project-glossary/status.md
 M src/backend/Dockerfile
?? docs/features/stack-selection/build-log-T4b.md
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md

$ git add src/backend/Dockerfile docs/features/stack-selection/build-log-T4b.md
$ git status --short
 M docs/features/README.md
 M docs/features/project-glossary/status.md
A  docs/features/stack-selection/build-log-T4b.md
M  src/backend/Dockerfile
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md
$ git diff --cached --stat
 docs/features/stack-selection/build-log-T4b.md | 430 +++++++++++++++++++++++++
 src/backend/Dockerfile                         |  12 +-
 2 files changed, 436 insertions(+), 6 deletions(-)
```

(T5b's working-tree edits to `README.md`/`compose.smoke.yaml`/`src/frontend/Dockerfile` had already been committed by T5b before this status capture, so they no longer appear as modified.)

Staged via explicit pathspecs only — never `git add .`/`-A`; the staged set is exactly the two `files_owned` paths. The pre-existing dirt (`docs/features/README.md`, `docs/features/project-glossary/status.md`) and the untracked stack-selection artifacts were left untouched and unstaged. Message: `fix: qualify backend base image and pin docker-format builds (T4b)`. Never pushed.

## 7. Notes / deviations

- **Deviation from the pinned verify list: none.** The four commands of `tasks.md` § T4b were run exactly as pinned; § 4.5 adds a read-only field-by-field template as supporting evidence for the same inspect command's "pinned values" clause (the pinned invocation's own output is quoted verbatim first).
- **Baseline interpretation (spec-r4 F2 clarifier applied, noted rather than improvised):** `tasks.md:98`'s parenthetically referenced T4 build-log baseline does not exist for this file (it was net-new in T4, `build-log-T4.md` § 1). Per the reviewer's clarifier, the baseline is the committed pre-amendment state at HEAD, and the operative command is `git diff HEAD` — exactly what § 1/§ 3 record (working tree hash == HEAD blob hash at build start).
- **Carried residue, deliberately untouched (spec-r4 F1):** the `HEALTHCHECK` command in the committed file is the long form `…then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))` while `plan.md` contract 8 spells it in short form (`r=>…`). T4b's mandate is "Nothing else in the file changes", so the line was left exactly as committed; the images built here carry that committed letter (§ 4.5). Semantically identical; the T4 code review adjudicates AC-16 against the aligned pin per F1's required action.
- **Provider path:** the builds ran with `--format docker` and the pinned qualified base image on the verified host (Podman 5.8.7); both stages show a `docker`-format COMMIT and the preserved healthcheck — the r4 decision (D-17) holds, and no `BUILDAH_FORMAT`/`registries.conf`/compose-layer workaround was introduced. `compose.yaml` was not touched (contract 5 intact).
- **Line-number note for the T4 code gate (spec-r4 INFO):** the committed blob's `FROM` lines are 10/31/46/57 while `build-log-T4.md` § 2's frozen grep snapshot records 9/30/44/54; the numbering in this log is re-derived from the committed blob, not from that snapshot.
