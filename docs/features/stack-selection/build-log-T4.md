# Build log — T4 — Backend skeleton: Fastify app, health, WebSocket hello

Task: T4 (dispatched 2026-10-18; executed 2026-10-18 on the fixed environment)
Files changed: `src/backend/tsconfig.json`, `src/backend/vitest.config.ts`, `src/backend/Dockerfile`, `src/backend/src/app.ts`, `src/backend/src/server.ts`, `src/backend/src/app.test.ts` — the six T4 paths, all net-new — plus `docs/features/stack-selection/build-log-T4.md` (this log).

Sketch (≤5 lines): author the six T4 files exactly per `plan.md` contracts 8 (config/Dockerfile rows) + 10 (`buildApp()` factory, `/healthz`, `/ws` hello, entrypoint with `HOST`/`PORT` defaults, Vitest `inject` + hello-shape tests); run the five pinned verify commands; add runtime evidence for the images (healthz, WS hello, non-root prod, env-driven listen); record the first-live-use provider finding on `podman build` vs. `HEALTHCHECK`; then stage only T4 paths + this log and commit the pinned message.

Status: **completed** — all five pinned verify commands exit 0, AC-15/AC-19/AC-20/AC-21 met with evidence, AC-16's source-level clauses met (see § 6 for the one provider-compat caveat, which is the divergence already routed to the planner's r4 pin amendment by T5).

## 1. Build-start baseline

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

$ git log --oneline -1
207d642 chore: scaffold workspace, compose stack, and commands (T3)
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

$ ls -A src/backend
package.json
```

All six T4 paths are absent at build start (the `ls` above shows only T3's `src/backend/package.json`), so every file this task authors is net-new: there is no pre-existing content to diff against and AC-32/§ Amendment trace hold for this task by construction (no in-place modification). The pre-existing modified files (`docs/features/README.md`, `docs/features/project-glossary/status.md`) and the untracked stack-selection artifacts were left untouched and unstaged. No manifest, lockfile, compose file, or config owned by T3 was touched (`git status` at commit time — § 9 — shows the six T4 paths + this log only).

Environment note: T5 ran concurrently in the `[P]` batch and committed `9d10881` while this task was running; T4's commit therefore lands on top of it (§ 9). No file of T5's was read, edited, or staged.

## 2. Files authored (pins applied)

| Path | Contract | Key pinned content applied |
| --- | --- | --- |
| `src/backend/tsconfig.json` | 8 | `extends: ../../tsconfig.json`; `module`/`moduleResolution` `NodeNext`; `target` `ES2023`; `outDir: "dist"`; `rootDir: "src"`; `types: ["node"]`; relative imports use `.js` specifiers. Added `include: ["src/**/*.ts"]` + `exclude: ["src/**/*.test.ts", "dist"]` (decision § 7 — the pinned `build`/`typecheck` scripts are bare `tsc`, and the prod image must not ship `*.test.js`) |
| `src/backend/vitest.config.ts` | 8 | `environment: "node"`; `include: ["src/**/*.test.ts"]` |
| `src/backend/src/app.ts` | 10 | `buildApp(): FastifyInstance` (no side effects on import); `GET /healthz` → `{status:'ok'}`; `GET /ws` (`{ websocket: true }`) → `socket.send(JSON.stringify(helloMessage()))`; exported `helloMessage(now = new Date())` → `{type:'hello', serverTime: now.toISOString()}`. Registration ordering per § 7 |
| `src/backend/src/server.ts` | 10 | only entrypoint: `HOST` default `0.0.0.0`, `PORT` default `8080`, `buildApp()`, `listen`, log the listen address — no other logic |
| `src/backend/src/app.test.ts` | 10 | `/healthz` via `inject` (200 + pinned body); `helloMessage()` shape (type, parseable ISO `serverTime`, stamped from the clock); plus a real-socket `/ws` test proving the pinned envelope reaches two concurrent clients |
| `src/backend/Dockerfile` | 8 | multi-stage `dev`/`build`/`prod-deps`/`prod`, context = repo root; every stage copies root manifests + both workspace manifests then `npm ci`; `dev` = `node:24-alpine`, `ENV NODE_ENV=development`, `CMD ["npm","run","dev","-w","@cubeclicker/backend"]` (tsx watch); `build` = `npm ci` + `npm run build -w @cubeclicker/backend`; `prod-deps` = `npm ci --omit=dev`; `prod` = `node:24-alpine`, `ENV NODE_ENV=production`, copies `dist/` + prod `node_modules`, `USER node`, `CMD ["node","dist/server.js"]`; both runtime stages carry the pinned `HEALTHCHECK` (`node -e fetch('http://127.0.0.1:8080/healthz')`, interval 10s / timeout 3s / retries 5 / start-period 15s); no `latest` tags, no secrets |

Inspection of the pinned tokens:

```
$ grep -n "module\|moduleResolution\|target\|outDir\|rootDir\|types" src/backend/tsconfig.json
6:    "module": "NodeNext",
7:    "moduleResolution": "NodeNext",
8:    "target": "ES2023",
9:    "outDir": "dist",
10:    "rootDir": "src",
11:    "types": ["node"]

$ grep -n "FROM\|USER\|ENV NODE_ENV\|CMD\|HEALTHCHECK\|EXPOSE\|RUN npm" src/backend/Dockerfile
9:FROM node:24-alpine AS dev
11:ENV NODE_ENV=development
18:RUN npm ci
24:HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s \
27:CMD ["npm", "run", "dev", "-w", "@cubeclicker/backend"]
30:FROM node:24-alpine AS build
37:RUN npm ci
41:RUN npm run build -w @cubeclicker/backend
44:FROM node:24-alpine AS prod-deps
51:RUN npm ci --omit=dev
54:FROM node:24-alpine AS prod
56:ENV NODE_ENV=production
61:COPY --from=prod-deps /app/node_modules /app/node_modules
63:COPY --from=build /app/src/backend/dist ./dist
65:EXPOSE 8080
67:HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s \
70:USER node
72:CMD ["node", "dist/server.js"]

$ grep -n "healthz\|'/ws'\|websocket: true\|serverTime\|HOST\|PORT" src/backend/src/app.ts src/backend/src/server.ts
src/backend/src/app.ts:11:export interface HelloMessage {
src/backend/src/app.ts:12:  type: 'hello';
src/backend/src/app.ts:13:  serverTime: string;
src/backend/src/app.ts:19:export function helloMessage(now: Date = new Date()): HelloMessage {
src/backend/src/app.ts:20:  return { type: 'hello', serverTime: now.toISOString() };
src/backend/src/app.ts:31:  app.get('/healthz', async () => ({ status: 'ok' }));
src/backend/src/app.ts:36:    instance.get('/ws', { websocket: true }, (socket) => {
src/backend/src/server.ts:3:const HOST = process.env.HOST ?? '0.0.0.0';
src/backend/src/server.ts:4:const PORT = Number(process.env.PORT ?? 8080);

$ grep -rn "HOST\|PORT\|8080\|0\.0\.0\.0" src/backend/src/*.ts          # no hardcoded host/port beyond the two defaults
src/backend/src/server.ts:3:const HOST = process.env.HOST ?? '0.0.0.0';
src/backend/src/server.ts:4:const PORT = Number(process.env.PORT ?? 8080);
src/backend/src/server.ts:11:  `CubeClicker backend listening on http://${HOST}:${PORT} (WebSocket ws://${HOST}:${PORT}/ws)`,
```

## 3. Evidence — the five pinned verify commands

### R1 — `npm run typecheck -w @cubeclicker/backend`

```
$ npm run typecheck -w @cubeclicker/backend

> typecheck
> tsc --noEmit

typecheck-exit=0
```

### R2 — `npm test -w @cubeclicker/backend`

```
$ npm test -w @cubeclicker/backend

> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 ✓ src/app.test.ts (4 tests) 88ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  10:59:34
   Duration  378ms (transform 37ms, setup 0ms, collect 83ms, tests 88ms, environment 0ms, prepare 49ms)

test-exit=0
```

The four tests are: `helloMessage` pinned envelope (fixed `Date` → exact object), `helloMessage` default clock (parseable ISO inside the observed `before`/`after` window), `GET /healthz` via `inject` (200 + `application/json` + `{"status":"ok"}`), and `GET /ws` over a real listener on an ephemeral port with **two concurrent clients**, both receiving `{"type":"hello","serverTime":"<ISO>"}` (in-process evidence for AC-20's concurrency clause; the cross-container version is T6's smoke).

### R3 — `npm run lint`

```
$ npm run lint

> lint
> eslint .

lint-exit=0
```

### R4 — `podman build --target dev -f src/backend/Dockerfile -t cubeclicker-backend:dev-check .`

First (cold) run — exit 0, with the provider warning discussed in § 6:

```
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
--> 0e2f4a190ddc
STEP 8/11: COPY src/backend ./src/backend
--> 6c01d8b299be
STEP 9/11: EXPOSE 8080
--> 20af6ff88b76
STEP 10/11: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
time="2026-10-18T10:59:48+02:00" level=warning msg="HEALTHCHECK is not supported for OCI image format and will be ignored. Must use `docker` format"
--> b0af23698156
STEP 11/11: CMD ["npm", "run", "dev", "-w", "@cubeclicker/backend"]
COMMIT cubeclicker-backend:dev-check
time="2026-10-18T10:59:48+02:00" level=warning msg="HEALTHCHECK is not supported for OCI image format and will be ignored. Must use `docker` format"
--> d0f2a3a891c8
Successfully tagged localhost/cubeclicker-backend:dev-check
d0f2a3a891c8537d62063e2395f6ba997ca6bff0bff5842bf9c854541378d925
dev-build-pipestatus=0
```

Re-run captured in full for the record (cache-warm; same exit status, same final image digest):

```
$ podman build --target dev -f src/backend/Dockerfile -t cubeclicker-backend:dev-check .
STEP 1/11: FROM node:24-alpine AS dev
STEP 2/11: ENV NODE_ENV=development
--> Using cache 3e2d9dcc64011d260758326534d1612c9c434716aef8a28dfbd7d0676ef2779a
--> 3e2d9dcc6401
STEP 3/11: WORKDIR /app
--> Using cache 1e024c6214619f57da51a1420af4bc84ec339cceb8f5999562bde13f2b9d3b49
--> 1e024c621461
STEP 4/11: COPY package.json package-lock.json tsconfig.json ./
--> Using cache 3f07b12876515e3b8b4bf688b87f4e3becc47f619c17a5415fac51ec9f7502d0
--> 3f07b1287651
STEP 5/11: COPY src/backend/package.json ./src/backend/package.json
--> Using cache 9149afce6a56142e5027296ec207227c73f2d6450823d55fad4466cb80ae60ee
--> 9149afce6a56
STEP 6/11: COPY src/frontend/package.json ./src/frontend/package.json
--> Using cache 507111f55117010629df1f927990551d9c17ff269b3f2e061fbe769deed29078
--> 507111f55117
STEP 7/11: RUN npm ci
--> Using cache 0e2f4a190ddcce6bb73bd3eb90114edda7c2644b8b607cc062877f906c1ed46f
--> 0e2f4a190ddc
STEP 8/11: COPY src/backend ./src/backend
--> Using cache 6c01d8b299be2384b37be107f89b548f4f7c25f34e09cc1b0d173de176433109
--> 6c01d8b299be
STEP 9/11: EXPOSE 8080
--> Using cache 20af6ff88b767b988c82e4a50897378c265378f5fb32521afa97ef38156f45d5
--> 20af6ff88b76
STEP 10/11: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
--> Using cache b0af2369815622750a68867565713c4b30437520f160941191cccb4ef4fdcba1
--> b0af23698156
STEP 11/11: CMD ["npm", "run", "dev", "-w", "@cubeclicker/backend"]
--> Using cache d0f2a3a891c8537d62063e2395f6ba997ca6bff0bff5842bf9c854541378d925
COMMIT cubeclicker-backend:dev-check
--> d0f2a3a891c8
Successfully tagged localhost/cubeclicker-backend:dev-check
d0f2a3a891c8537d62063e2395f6ba997ca6bff0bff5842bf9c854541378d925
dev-exit=0
```

(STEP 8 copies the whole `src/backend` tree, sources included — the dev stage bakes them and compose bind-mounts `./src/backend` over them for hot reload, per contract 8 and compose contract 5.)

### R5 — `podman build --target prod -f src/backend/Dockerfile -t cubeclicker-backend:prod-check .`

First (cold) run — exit 0; final stages in full:

```
[3/4] STEP 6/6: RUN npm ci --omit=dev

added 72 packages, and audited 75 packages in 888ms

22 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
npm notice
npm notice New major version of npm available! 11.19.1 -> 12.2.0
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.0
npm notice To update run: npm install -g npm@12.2.0
npm notice
--> f38af8a28ae2
[4/4] STEP 1/10: FROM node:24-alpine AS prod
[4/4] STEP 2/10: ENV NODE_ENV=production
--> 3aa8edb7f16a
[4/4] STEP 3/10: WORKDIR /app/src/backend
--> 6f93a5326146
[4/4] STEP 4/10: COPY --from=prod-deps /app/node_modules /app/node_modules
--> e7c656ca43b9
[4/4] STEP 5/10: COPY --from=build /app/src/backend/package.json ./package.json
--> f31fbe48fc4c
[4/4] STEP 6/10: COPY --from=build /app/src/backend/dist ./dist
--> bddf4a12e7bd
[4/4] STEP 7/10: EXPOSE 8080
--> 8599e0fa0571
[4/4] STEP 8/10: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
time="2026-10-18T11:02:29+02:00" level=warning msg="HEALTHCHECK is not supported for OCI image format and will be ignored. Must use `docker` format"
--> 208f4e6e8f06
[4/4] STEP 9/10: USER node
time="2026-10-18T11:02:29+02:00" level=warning msg="HEALTHCHECK is not supported for OCI image format and will be ignored. Must use `docker` format"
--> 5d52d81b9c3a
[4/4] STEP 10/10: CMD ["node", "dist/server.js"]
[4/4] COMMIT cubeclicker-backend:prod-check
time="2026-10-18T11:02:29+02:00" level=warning msg="HEALTHCHECK is not supported for OCI image format and will be ignored. Must use `docker` format"
--> 18dbb7efc9f1
Successfully tagged localhost/cubeclicker-backend:prod-check
18dbb7efc9f193c63a8f30ee211351087159dfa3b831c51620e9fe99b3e698ae
prod-build-pipestatus=0
```

Re-run captured in full (cache-warm; exit 0; same final digest):

```
$ podman build --target prod -f src/backend/Dockerfile -t cubeclicker-backend:prod-check .
[2/4] STEP 1/8: FROM node:24-alpine AS build
[2/4] STEP 2/8: WORKDIR /app
--> Using cache 26afcd033c69e360cb496f560adddf488e84e786fac5d9daee3be8f993f0078d
--> 26afcd033c69
[2/4] STEP 3/8: COPY package.json package-lock.json tsconfig.json ./
--> Using cache 00a82f00d375059740d29e10b09d3d92e5e29c1a2e95a7bad06c3de6a0c3ae21
--> 00a82f00d375
[2/4] STEP 4/8: COPY src/backend/package.json ./src/backend/package.json
--> Using cache bba0a4f3429fcfbc76bada22e9bdd2e9a894c07d10c9ad83820c469f4cc06a80
--> bba0a4f3429f
[2/4] STEP 5/8: COPY src/frontend/package.json ./src/frontend/package.json
--> Using cache 8f79be82cb940bd7f993082f5ac89bed1abb8fadcac42346953571a6014b76f7
--> 8f79be82cb94
[2/4] STEP 6/8: RUN npm ci
--> Using cache 36540169fbdde26eb499f0fe15174fcd99601a4f47333a0c6b599fd77e1e35ce
--> 36540169fbdd
[2/4] STEP 7/8: COPY src/backend ./src/backend
--> Using cache d67c24144c64a8a12d51f6278ece1f7d2a73ad20768dd122900f690991436fac
--> d67c24144c64
[2/4] STEP 8/8: RUN npm run build -w @cubeclicker/backend
--> Using cache da7551687c4230262e29cc5e081d3196e69db57286874a4b9d5a763277e0250c
--> da7551687c42
[3/4] STEP 1/6: FROM node:24-alpine AS prod-deps
[3/4] STEP 2/6: WORKDIR /app
--> Using cache 26afcd033c69e360cb496f560adddf488e84e786fac5d9daee3be8f993f0078d
--> 26afcd033c69
[3/4] STEP 3/6: COPY package.json package-lock.json ./
--> Using cache 9037cf5a10e2dc523721bd3c7b67c2ccc7ab2cd2d6e3ce3702b40999b4af2d73
--> 9037cf5a10e2
[3/4] STEP 4/6: COPY src/backend/package.json ./src/backend/package.json
--> Using cache eeabd12c09be35ff23f578de0a1ec46933808d00bfe7a6f0456889fa7779c723
--> eeabd12c09be
[3/4] STEP 5/6: COPY src/frontend/package.json ./src/frontend/package.json
--> Using cache 49806968eba1f8be4f559ca4be6e813e96d67d2774058bf09e6764669644310e
--> 49806968eba1
[3/4] STEP 6/6: RUN npm ci --omit=dev
--> Using cache f38af8a28ae2d18ff85f961807dfd5d73d65e7770c8452478c54418f171df59e
--> f38af8a28ae2
[4/4] STEP 1/10: FROM node:24-alpine AS prod
[4/4] STEP 2/10: ENV NODE_ENV=production
--> Using cache 3aa8edb7f16a4e773d358f0b18d9ad1d4675bfeaeba8c224dc2f49adadf56178
--> 3aa8edb7f16a
[4/4] STEP 3/10: WORKDIR /app/src/backend
--> Using cache 6f93a5326146d2f1e7f57107153d4120fa960e280fa7c310d85dd48c97486f01
--> 6f93a5326146
[4/4] STEP 4/10: COPY --from=prod-deps /app/node_modules /app/node_modules
--> Using cache e7c656ca43b9db0474c2dc3f95ae7c4deaf949baf51ae0efc4d6d9c3b3c32b9d
--> e7c656ca43b9
[4/4] STEP 5/10: COPY --from=build /app/src/backend/package.json ./package.json
--> Using cache f31fbe48fc4c85fbce75d6dd6993d5e4308ea8530a7e8c4a07d2163057d44004
--> f31fbe48fc4c
[4/4] STEP 6/10: COPY --from=build /app/src/backend/dist ./dist
--> Using cache bddf4a12e7bd503709d950138d17215a3be36d61af421741b74ce304ce2d2e4b
--> bddf4a12e7bd
[4/4] STEP 7/10: EXPOSE 8080
--> Using cache 8599e0fa0571fd580b32c5e9d7aae569d61b8c64a4f509c7adbd23c082b1cf1e
--> 8599e0fa0571
[4/4] STEP 8/10: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
--> Using cache 208f4e6e8f061fb642902bfeeee58abd15d1aec8ae464937bcb5d49c109c0c0c
--> 208f4e6e8f06
[4/4] STEP 9/10: USER node
--> Using cache 5d52d81b9c3a60cd7bb1825c334e94e9778b476433fed7be3090599acec9da8a
--> 5d52d81b9c3a
[4/4] STEP 10/10: CMD ["node", "dist/server.js"]
--> Using cache 18dbb7efc9f193c63a8f30ee211351087159dfa3b831c51620e9fe99b3e698ae
[4/4] COMMIT cubeclicker-backend:prod-check
--> 18dbb7efc9f1
Successfully tagged localhost/cubeclicker-backend:prod-check
18dbb7efc9f193c63a8f30ee211351087159dfa3b831c51620e9fe99b3e698ae
prod-exit=0
```

## 4. Supplementary runtime evidence (not in the pinned verify list; recorded for honesty)

Neither pinned step runs the images, so the prod and dev images were started once each (loopback port 18080/18081 — the pinned host ports 8080/5173 were left untouched and stayed free for T6) and probed with `node -e "fetch(...)"` / Node's global `WebSocket` (never `curl`/`wget`), then removed.

### 4.1 prod image (`cubeclicker-backend:prod-check`) with no env overrides

```
$ podman run -d --name cubeclicker-t4-prod -p 127.0.0.1:18080:8080 cubeclicker-backend:prod-check
run-exit=0
$ podman exec cubeclicker-t4-prod id -u
1000
$ podman exec cubeclicker-t4-prod id -un
node
$ podman exec cubeclicker-t4-prod printenv NODE_ENV PORT HOST
production
$ podman inspect cubeclicker-t4-prod --format 'State.Status={{.State.Status}} | Config.User={{.Config.User}} | Config.Env={{.Config.Env}} | Healthcheck={{.Config.Healthcheck}}'
State.Status=running | Config.User=node | Config.Env=[NODE_ENV=production NODE_VERSION=24.22.0 PATH=… container=podman YARN_VERSION=1.22.22 HOME=/home/node HOSTNAME=ae498b48c5a2] | Healthcheck=<nil>
$ node -e "fetch('http://127.0.0.1:18080/healthz').then(async r=>{console.log('status:',r.status);console.log('content-type:',r.headers.get('content-type'));console.log('body:',await r.text())})"
status: 200
content-type: application/json; charset=utf-8
body: {"status":"ok"}
$ node -e "… new WebSocket('ws://127.0.0.1:18080/ws') …"
ws message: {"type":"hello","serverTime":"2026-10-18T09:02:47.030Z"}
$ podman logs cubeclicker-t4-prod | head -5
CubeClicker backend listening on http://0.0.0.0:8080 (WebSocket ws://0.0.0.0:8080/ws)
```

Reading: the prod image runs as uid 1000 (`node`), `NODE_ENV=production`, listens on the default `0.0.0.0:8080` (no `HOST`/`PORT` in the container env), answers `GET /healthz` with the pinned `{"status":"ok"}` and serves the pinned `hello` envelope on `/ws`.

Image content check (prod ships only the compiled server, no dev tooling, no test files):

```
$ podman run --rm --entrypoint sh cubeclicker-backend:prod-check -c "ls -la /app/src/backend/dist; …; ls -d /app/node_modules/vitest; id -un"
-rw-r--r--    1 root     root          1124 Oct 18 09:02 app.js
-rw-r--r--    1 root     root           306 Oct 18 09:02 server.js
ls: /app/node_modules/vitest: No such file or directory
node
$ ls -d src/backend/dist
ls: cannot access 'src/backend/dist': No such file or directory      # build output lives in the image only
```

### 4.2 dev image (`cubeclicker-backend:dev-check`)

```
$ podman run -d --name cubeclicker-t4-dev -p 127.0.0.1:18081:8080 cubeclicker-backend:dev-check
run-exit=0
$ podman exec cubeclicker-t4-dev printenv NODE_ENV
development
$ node -e "fetch('http://127.0.0.1:18081/healthz')…"
status: 200 body: {"status":"ok"}
$ node -e "… new WebSocket('ws://127.0.0.1:18081/ws') …"
ws message: {"type":"hello","serverTime":"2026-10-18T09:04:48.273Z"}
$ podman logs cubeclicker-t4-dev | head -12

> dev
> tsx watch src/server.ts

CubeClicker backend listening on http://0.0.0.0:8080 (WebSocket ws://0.0.0.0:8080/ws)
```

Reading: the dev stage runs the pinned workspace dev script (`tsx watch src/server.ts`) — hot reload per contract 8/AC-16 — and serves both endpoints.

### 4.3 env-driven listen (AC-21)

```
$ podman run -d --name cubeclicker-t4-env2 -e PORT=9099 -p 127.0.0.1:18082:9099 cubeclicker-backend:prod-check
$ podman logs cubeclicker-t4-env2 | head -3
CubeClicker backend listening on http://0.0.0.0:9099 (WebSocket ws://0.0.0.0:9099/ws)
$ node -e "fetch('http://127.0.0.1:18082/healthz')…"
status: 200 body: {"status":"ok"}

$ podman run -d --name cubeclicker-t4-env -e HOST=127.0.0.1 -e PORT=9099 -p 127.0.0.1:18082:9099 cubeclicker-backend:prod-check
$ podman logs cubeclicker-t4-env | head -3
CubeClicker backend listening on http://127.0.0.1:9099 (WebSocket ws://127.0.0.1:9099/ws)
$ node -e "fetch('http://127.0.0.1:18082/healthz')…"
FETCH ERROR fetch failed
```

Reading: `HOST`/`PORT` are read from the environment (both overrides took effect in the listen log); with `HOST=127.0.0.1` the service binds the container's own loopback, so the published port is unreachable from the host — expected for that override, recorded so the failed fetch is not misread as a defect. Defaults (no env) are `0.0.0.0:8080` (§ 4.1).

## 5. First live use of the pinned build commands — provider findings

### 5.1 Finding: the bare `podman build` CLI forms drop the pinned `HEALTHCHECK`

Both pinned build commands exit 0, but Podman 5.8.7's default image format for `podman build` is **OCI**, and the OCI image config cannot carry a healthcheck — the instruction is emitted and then ignored (warning printed at STEP 10/8). Raw evidence:

```
$ podman build --help | grep -A1 -- "--format"
      --format format                                format of the built image's manifest and metadata. Use BUILDAH_FORMAT environment variable to override. (default "oci")

$ podman inspect cubeclicker-backend:dev-check | node -e "… look for a Healthcheck key …"
NO healthcheck key

$ podman inspect cubeclicker-backend:dev-check --format '… .Config …'
config keys: ExposedPorts,Env,Entrypoint,Cmd,WorkingDir,Labels

$ podman inspect cubeclicker-backend:prod-check  # same result
NO healthcheck key
$ podman inspect cubeclicker-t4-prod --format '… Healthcheck={{.Config.Healthcheck}}'
Healthcheck=<nil>
```

Diagnostic (characterization only — **not** a substituted verify command, no deliverable changed to use it):

```
$ BUILDAH_FORMAT=docker podman build --target dev -f src/backend/Dockerfile -t cubeclicker-backend:dev-dockerfmt .
diag-build-exit=0            # no OCI-format warning emitted
$ podman inspect cubeclicker-backend:dev-dockerfmt | node -e "… Healthcheck key …"
"Healthcheck":{"Test":["CMD-SHELL","node -e \"fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))\""],"StartPeriod":15000000000,"Interval":10000000000,"Timeout":3000000000,"Retries":5}
```

So the pinned instruction is correct and complete (command + interval 10s / timeout 3s / retries 5 / start-period 15s); only the *format* of the CLI-built image discards it. Host config check (read-only): no `[build] format` override exists anywhere, so `oci` is the effective default:

```
$ env | grep -iE "buildah|format"          # (no output, exit 1)
$ grep -n -A6 "^\[build\]" /usr/share/containers/containers.conf
(no [build] section)
$ ls /etc/containers/containers.conf ~/.config/containers/containers.conf
(both absent)
```

### 5.2 Refinement: the compose-provider build path *keeps* the healthcheck

The provider path used by the single-command run — `podman compose up --build`, i.e. what T6 exercises — builds through the Podman API, which produced a **docker-format** image here. Raw evidence (diagnostic build via the compose provider; it produced compose's own tag `cubeclicker-backend:dev`, not a verify artefact):

```
$ podman compose build backend        # diagnostic; provider exit 0
STEP 10/12: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD node -e "fetch('http://127.0.0.1:8080/healthz')…"
…
COMMIT docker.io/library/cubeclicker-backend:dev
Successfully tagged cubeclicker-backend:dev
compose-build-exit=0

$ grep -in "warning\|healthcheck" /tmp/…-compose-build.log     # only the HEALTHCHECK step line; no OCI-format warning
$ podman inspect cubeclicker-backend:dev | node -e "… Healthcheck key …"
"Healthcheck":{"Test":["CMD-SHELL","node -e \"fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))\""],"StartPeriod":15000000000,"Interval":10000000000,"Timeout":3000000000,"Retries":5}
```

This narrows the impact: the images the local environment and the smoke test actually run (compose-built) **do** carry the pinned health signal, while images built with the bare `podman build` CLI — T4/T5's verify commands and the README's documented production-image command — do not. The finding is the same root cause T5 reported as its divergence 2; this task's evidence adds that the compose path is unaffected (relevant to AC-26's `--wait` step), and that the *deployment* command documented in `README.md` builds an image without a health signal.

Candidate resolutions (identical to the ones T5 routed; the pin decision is spec/plan-owned, so nothing was improvised):
- **A** — build with docker-format manifests on every path (`podman build --format docker`, or `BUILDAH_FORMAT=docker`) and document it (README + pinned commands). Restores the image-level health signal everywhere; changes pinned command forms (T4/T5 verify lists, README, T6's build path).
- **B** — move the health signal to the compose layer (per-service `healthcheck:`), which contradicts contract 5's "no healthcheck duplication" and needs a plan change.
- **C** — keep the source-level declarations and record the Podman-OCI caveat as a documented provider limitation (healthchecks honoured on Docker; compose path already honours them on Podman), leaving AC-26's `--wait` behaviour to T6's contingency.

No deliverable was changed to work around this; the six files stay exactly on the pinned contract.

## 6. Acceptance audit (T4 scope: AC-15, AC-16, AC-19, AC-20, AC-21)

- **AC-15 — met.** `src/backend/Dockerfile` is multi-stage with `dev` and `prod` targets (stages `dev`, `build`, `prod-deps`, `prod` — `target: dev` and `target: prod` both exist and both were built); `podman build --target dev …` and `podman build --target prod …` (context `.`) both exit 0 (§ R4, § R5; cached re-runs reproduce the same image digests `d0f2a3a891c8…` / `18dbb7efc9f1…`, i.e. the builds are deterministic).
- **AC-16 — met at source level; one provider-compat caveat recorded (not a T4 defect).** The image declares the pinned `HEALTHCHECK` hitting `/healthz` with the pinned numbers (grep in § 2; `BUILDAH_FORMAT=docker` diagnostic shows the exact `Test`/`StartPeriod=15000000000`/`Interval=10000000000`/`Timeout=3000000000`/`Retries=5` in the image). The `prod` stage runs as a non-root user with `NODE_ENV=production` (live: `id -u` → 1000, `id -un` → node, `NODE_ENV=production`, § 4.1); the `dev` stage runs the workspace dev script (`tsx watch src/server.ts`, live log in § 4.2). Caveat (routed finding, § 5): under Podman 5.8.7's default *CLI* build format (OCI) the instruction is ignored in the built image metadata; the compose-provider path (the environment's and T6's build path) keeps it. Fixing this is a pinned-command/plan decision (candidates A/B/C), outside this task's `files_owned`.
- **AC-19 — met.** `GET /healthz` returns 200 with `{"status":"ok"}` in the unit test via Fastify `inject` (§ R2) and end-to-end against the real prod and dev containers (§ 4.1, § 4.2). The end-to-end-through-the-compose-network leg is T6's smoke.
- **AC-20 — met.** `/ws` accepts WebSocket connections and, per connection, sends exactly the pinned envelope `{"type":"hello","serverTime":"<ISO-8601>"}` generated by the server clock (`helloMessage()`); the unit test opens **two concurrent** clients on a real listener and both receive the envelope (§ R2), and both containers served it live (§ 4.1, § 4.2). No inbound message processing exists in the scaffold (pinned). The cross-container two-client assertion is T6's smoke.
- **AC-21 — met.** `src/backend/src/server.ts` is the only entrypoint and reads `HOST` (default `0.0.0.0`) and `PORT` (default `8080`) from the environment; no other host/port literal exists in the backend sources (grep in § 2). Live evidence: with no env set the log reads `http://0.0.0.0:8080`; with `PORT=9099` it reads `http://0.0.0.0:9099` and the published port answers; with `HOST=127.0.0.1 PORT=9099` it reads `http://127.0.0.1:9099` (§ 4.3).

## 7. Decisions (implementation details inside the pinned contracts)

1. **WebSocket route registration ordering (raw probe below).** The pinned factory `buildApp(): FastifyInstance` is synchronous, and `@fastify/websocket`'s `onRoute` hook only rewrites `{ websocket: true }` routes registered *after* the plugin has finished loading. Registering the plugin with a bare `app.register(websocket)` and then adding `app.get('/ws', …)` in the same tick silently skips that hook: the request is routed as plain HTTP and the handler receives `(request, reply)` — the first probe produced `{"statusCode":500,"error":"Internal Server Error","message":"socket.send is not a function"}` and even the plugin's own `app.injectWS('/ws')` failed with `Unexpected server response: 500`. Probe:

   ```
   $ npx tsx (scratch)   # variant: app.register(websocket); app.get('/ws', {websocket:true}, …)
   onRoute: {"method":"GET","url":"/ws","websocket":true,"handlerName":""}
   onRequest url: /ws | ws flag: true | raw symbols: [ … Symbol(ws-socket), Symbol(ws-head) ]
   handler arg0 ctor: _Request | arg1 ctor: Reply          ← the ws handler was never wired
   RAW RESPONSE: HTTP/1.1 500 Internal Server Error … {"message":"socket.send is not a function"}

   # variants that DO wire the handler (both probed green):
   [A] await instance.register(websocket) inside a registered plugin, then instance.get('/ws', …)
   [B] app.register(websocket); app.register(async (instance) => instance.get('/ws', …))
   [A] healthz: 200 {"status":"ok"} | [A] ws message: {"type":"hello","serverTime":"2026-10-18T08:59:10.592Z"}
   [B] healthz: 200 {"status":"ok"} | [B] ws message: {"type":"hello","serverTime":"2026-10-18T08:59:10.603Z"}
   ```

   `src/backend/src/app.ts` therefore registers `@fastify/websocket` and the `/ws` route inside one plugin scope, awaiting the plugin registration first (variant A: self-contained ordering, no reliance on cross-plugin sequencing). Every pinned observable (factory, `/healthz`, `/ws` + hello handler, no import side effects) is unchanged; this is the minimal mechanism that makes the pinned behaviour real with the resolved versions (`fastify@5.12.7`, `@fastify/websocket@11.3.4`). The scratch probes were deleted (no stray files, § 8).
2. **`tsconfig.json` `include`/`exclude`.** Contract 8 pins `outDir`/`rootDir`/`types` but names no include/exclude; the pinned `build`/`typecheck` scripts are bare `tsc`, and the prod image copies `dist/` wholesale. `include: ["src/**/*.ts"]` with `exclude: ["src/**/*.test.ts", "dist"]` keeps `*.test.js` out of the shipped image (verified: `/app/src/backend/dist` contains only `app.js` and `server.js`) and out of `tsc --noEmit`. Trade-off recorded: the test file is transpiled/executed by Vitest (which does not type-check a prior `tsc` pass), so a test-only type error would surface at runtime rather than at the typecheck gate.
3. **Real-socket `/ws` test.** Node 24 exposes global `WebSocket`, so the unit test binds the app on `127.0.0.1:0` (ephemeral port — no interference with the pinned host ports or with the parallel T5 run) and uses real clients instead of the plugin's `injectWS`, whose message delivery is racy for a message sent immediately on connect. `app.inject` is used for `/healthz` as pinned, and `app.close()` in a `finally` guarantees teardown.
4. **No logger in `buildApp()`.** Fastify's request logger is left off so the app factory has no output side effects; the only logging is `server.ts`'s listen line (pinned: "logs the listen address"). Pino request logs and healthcheck noise are avoided.

## 8. Working-tree hygiene

```
$ ls src/backend
Dockerfile  node_modules  package.json  src  tsconfig.json  vitest.config.ts      # node_modules is npm's workspace-local .bin dir (gitignored)

$ git status --short -uall      # at build end, before staging
 M docs/features/README.md
 M docs/features/project-glossary/status.md
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/spec-r1.md
?? docs/features/stack-selection/reviews/spec-r2.md
?? docs/features/stack-selection/reviews/spec-r3.md
?? docs/features/stack-selection/reviews/t2c-check.md
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md
?? src/backend/Dockerfile
?? src/backend/src/app.test.ts
?? src/backend/src/app.ts
?? src/backend/src/server.ts
?? src/backend/tsconfig.json
?? src/backend/vitest.config.ts

$ find . -maxdepth 3 -name '.env*' -not -path './node_modules/*'
(no output)   # find-exit=0 — no .env* file exists
```

No scratch/debug file remains (`debug-scratch*.mts`, `debug-*.mts` probes were created under `src/backend/`/`/tmp/opencode/` and deleted); no `.env*` file was created, read, or written; no manifest, lockfile, compose file, or root config was modified. Diagnostic images (`cubeclicker-backend:dev-dockerfmt`, `:dev-dockerfmt2`) were removed after the evidence above was captured; the two pinned verify tags (`:dev-check`, `:prod-check`) and compose's own `cubeclicker-backend:dev` remain in the local store, and all probe containers were removed.

```
$ podman images | grep -E "cubeclicker|REPOSITORY"
REPOSITORY                             TAG                 IMAGE ID      CREATED
docker.io/library/cubeclicker-backend  dev                 580ea7554797  …
localhost/cubeclicker-backend          prod-check          18dbb7efc9f1  …
localhost/cubeclicker-backend          dev-check           d0f2a3a891c8  …
localhost/cubeclicker-frontend         dev-fmt-diagnostic  1fd56a6ee4d5  …      # parallel T5 run's diagnostic image
localhost/cubeclicker-frontend         dev-check           00e3c828c83e  …
```

## 9. Staging and commit

T5 committed `9d10881` (`feat: frontend skeleton with connection module (T5)`) while this task was running, so T4's commit lands on top of it; no T5 path was touched, read into staging, or edited. Explicit pathspecs only — never `git add .`/`-A`; no push.

```
$ git add src/backend/tsconfig.json src/backend/vitest.config.ts src/backend/Dockerfile \
          src/backend/src/app.ts src/backend/src/server.ts src/backend/src/app.test.ts \
          docs/features/stack-selection/build-log-T4.md
$ git diff --cached --name-only
docs/features/stack-selection/build-log-T4.md
src/backend/Dockerfile
src/backend/src/app.test.ts
src/backend/src/app.ts
src/backend/src/server.ts
src/backend/tsconfig.json
src/backend/vitest.config.ts
$ git commit -m "feat: backend skeleton with health and WebSocket hello (T4)"
```

The staged set is exactly the six `files_owned` paths + this build log; the pre-existing modified files (`docs/features/README.md`, `docs/features/project-glossary/status.md`) and every other `docs/features/stack-selection/**` artifact stay unstaged/untracked. The resulting commit is verifiable with `git log -1 --oneline` / `git show --stat HEAD` on `feat/stack-selection`.

## 10. Deviations and notes

- **No deviation from the pinned contracts.** Every pinned token (routes, envelope, defaults, healthcheck numbers, stage names, `USER node`, `NODE_ENV=production`, `node dist/server.js`, `tsx watch`, NodeNext `.js` specifiers) is applied as written; the six paths are net-new, so the amendment rule and AC-32 are untouched.
- **Flagged (routed, not improvised):** the Podman OCI-format `HEALTHCHECK` divergence (§ 5) — same root cause as T5's divergence 2, with the added evidence that the compose-provider build path keeps the pinned healthcheck. Candidate fixes A/B/C are listed for the planner's r4 pin amendment.
- Notes: no dependency was added or changed and no manifest/lockfile was touched (T3-owned; `npm ci` inside both images resolved the committed lockfile: 276 packages in dev, 72 in `--omit=dev`); the npm 11 install-scripts gate on `esbuild@0.28.2` prints the same harmless warning inside the dev image that T3 recorded on the host; three transitive `npm audit` advisories in the resolved tree remain a T3-recorded backlog item, not fixed here (that would move pinned ranges).
