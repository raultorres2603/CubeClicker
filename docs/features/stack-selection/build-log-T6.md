# Build log — T6 — Containerized smoke test + single-command run

Task: T6 (dispatched 2026-10-18; executed 2026-10-18 on the verified host)
Files changed: `tests/e2e/smoke.mjs` (net-new, the only T6 code path) + `docs/features/stack-selection/build-log-T6.md` (this log).
Status: **blocked** — `tests/e2e/smoke.mjs` is authored, committed and independently exercised green (AC-25 met), but the pinned compose sequence fails on this host for a reason outside T6's `files_owned`: the pinned bind-mount specs (contracts 5/6) carry no SELinux relabel option and the verified host runs SELinux **Enforcing**, so both service containers exit `243` with `EACCES` and the smoke container cannot read its read-only mount. AC-26 and AC-27 are **unmet** pending a plan/spec amendment (§ 6 has the exact question, raw errors, and candidate answers). No workaround was applied and no file outside `files_owned` was touched.

Sketch (≤5 lines): author `tests/e2e/smoke.mjs` exactly per `plan.md` contract 12 (zero deps, pinned env defaults, bounded readiness poll on `/healthz` + `/`, two concurrent WebSocket clients with the pinned `hello` validation, per-check PASS/FAIL, non-zero exit on any failure); run the pinned compose sequence and record every command's raw output; capture the health signal (`ps` + `podman inspect`); record first-live-use findings for each `podman compose` form; exercise the script's PASS **and** FAIL paths; stage only the two T6 paths and commit the pinned message.

## 1. Build-start baseline

```
$ git log --oneline -1
0da31cc fix: qualify backend base image and pin docker-format builds (T4b)
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
?? tests/

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
$ ls -Zd . src src/backend tests
unconfined_u:object_r:user_home_t:s0 .
unconfined_u:object_r:user_home_t:s0 src
unconfined_u:object_r:user_home_t:s0 src/backend
unconfined_u:object_r:user_home_t:s0 tests
```

Precondition check — host loopback ports 8080/5173 free before `up` (T6 constraint):

```
$ for p in 8080 5173; do ss -ltnH | grep -q ":$p " && echo "port $p: OCCUPIED" || echo "port $p: free"; done
port 8080: free
port 5173: free
$ node -e "for (const p of [8080,5173]) { fetch('http://127.0.0.1:'+p+'/').then(...).catch(...) }"
port 8080 no listener: ECONNREFUSED
port 5173 no listener: ECONNREFUSED
```

`tests/e2e/` did not exist at build start (`ls: cannot access 'tests/e2e': No such file or directory`), so `tests/e2e/smoke.mjs` is net-new: no pre-existing content to diff, and AC-32 / § Amendment trace hold for this task by construction. The pre-existing modified files (`docs/features/README.md`, `docs/features/project-glossary/status.md`) and the untracked stack-selection artifacts were left untouched and unstaged. No manifest, lockfile, compose file, Dockerfile, or config owned by another task was touched.

## 2. Deliverable — `tests/e2e/smoke.mjs` (plan contract 12)

| Contract 12 requirement | Implementation |
| --- | --- |
| zero dependencies, Node built-ins/globals only | no `import`/`require` at all — global `fetch`, global `WebSocket`, `setTimeout`, `AbortSignal.timeout`, `console`, `process` (grep evidence § 5.1) |
| runs only inside the compose network by default | defaults `BACKEND_URL=http://backend:8080`, `FRONTEND_URL=http://frontend:5173`, `WS_URL=ws://backend:8080/ws`; every target overridable from the environment |
| bounded readiness wait (`READY_TIMEOUT_MS`) | `READY_TIMEOUT_MS` default `30000`; `pollUntilReady()` polls a URL every 500 ms (per-request 3 s abort) until it validates or the budget expires, and reports the last observed problem |
| (1) backend `/healthz` → 200 | `checkBackendHealth()` — status 200 **and** the pinned body `{"status":"ok"}` (this doubles as AC-19's end-to-end-through-smoke leg) |
| (2) frontend `/` → 200 + `text/html` | `checkFrontendServesHtml()` — status 200 and `content-type` contains `text/html` |
| (3) two concurrent WebSocket clients, each receiving `hello` with parseable `serverTime` within 5 s | `checkConcurrentWebSocketClients()` — `Promise.all([receiveHello(), receiveHello()])`; each client validates `type === 'hello'` and `Date.parse(serverTime)` non-NaN with a 5 s (`HELLO_TIMEOUT_MS`) bound; sockets are always closed on settle |
| (4) prints per-check results; non-zero exit if any check fails | one `PASS`/`FAIL` line per check (with a detail on failure) plus a `SMOKE PASS`/`SMOKE FAIL` summary; `process.exitCode = 1` when any check failed |
| mounted read-only; runs via the `smoke` compose service | nothing in the script writes; it is mounted `:ro` by `compose.smoke.yaml` and executed as `node smoke.mjs` (working dir `/smoke`) |

The file was validated in three independent ways (§ 5) rather than only by inspection, because the containerized run of the pinned sequence is blocked (§ 3–§ 4).

## 3. The pinned verify sequence — raw output

Every command below is the pinned form from `tasks.md` § T6. ANSI escape sequences emitted by the compose provider are stripped for readability; text is otherwise verbatim. The full raw logs are also kept in `/tmp/opencode/t6/*.log` during the session.

Reading note: the `$ …` lines are the commands as pinned (single quotes, backslash continuations), while the capture echoed a few of them in shell-escaped form; every line of **program output** below is byte-faithful to the captured logs (verified by a containment check of each `/tmp/opencode/t6/*.log` against this file).

### 3.1 `podman compose down -v --rmi local` (clean state) — first live use: **supported, exit 0**

```
$ podman compose down -v --rmi local
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

down-clean-exit=0
```

### 3.2 `podman compose up -d --build --wait` — first live use: `--wait` **is** supported; exit 1 because both containers exit 243

```
$ podman compose up -d --build --wait
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Image cubeclicker-backend:dev Building
 Image cubeclicker-frontend:dev Building
 Image cubeclicker-backend:dev Building
 Image cubeclicker-frontend:dev Building
Sending build context to Docker daemon   49.2kB
Sending build context to Docker daemon   49.2kB
STEP 1/11: FROM docker.io/library/node:24-alpine AS dev
STEP 1/12: FROM docker.io/library/node:24-alpine AS dev
STEP 2/12: ENV NODE_ENV=development
STEP 2/11: WORKDIR /app
--> Using cache 60c303bd8d80b5f9fb2988802d25398341bd5ca094481331f3e91e9e1256eb8c
--> 60c303bd8d80
--> Using cache ed1df529191f62a88286bbf4e58a82a1d758ee408befd62aad65e6fb71abce04
--> ed1df529191f
STEP 3/12: WORKDIR /app
STEP 3/11: COPY package.json package-lock.json tsconfig.json ./
--> Using cache 84248e617fea7ac842b6b10856c6635ecb2e1e785f4a86f2717777c1620dbbaa
--> 84248e617fea
STEP 4/12: COPY package.json package-lock.json tsconfig.json ./
--> Using cache 68cb20c7e99a854dff600ac844d3a6537dec9a63c4149c35fc25754066e0defc
--> 68cb20c7e99a
STEP 4/11: COPY src/backend/package.json src/backend/package.json
--> Using cache 0ab5e4f3204475d1664124f85eabc1e3d5d1cd932fff2f52b22b47c72403cd35
--> 0ab5e4f32044
STEP 5/12: COPY src/backend/package.json ./src/backend/package.json
--> Using cache 7ae993bf4a90a891d91695a14c0a07bd68423dab6c256e3dc63e28b45a01bdde
--> 7ae993bf4a90
STEP 5/11: COPY src/frontend/package.json src/frontend/package.json
--> Using cache 443837732b5e96ecbe2c9faa6439156ba5518e0b7e58d1883092ad467d73f5bb
--> 443837732b5e
STEP 6/12: COPY src/frontend/package.json ./src/frontend/package.json
--> Using cache 7775fa135f53f0e758286c4934c7b5ef58cf805dfcb62b250a97a4ca6d320481
--> 7775fa135f53
STEP 6/11: RUN npm ci
--> Using cache a6000591230eb7dc0b0efd87d7b6fa7235714e6c9244ba956584d7441d586ff2
--> a6000591230e
STEP 7/11: COPY src/frontend src/frontend
--> Using cache bde6c8da22691da47900a69ac34ff0b5104596930c2d8200e6bff6629594512d
--> bde6c8da2269
STEP 7/12: RUN npm ci
--> Using cache ea742e00f3f88e1ba3dd4cb0118779d4aa231f8bab959c6bec43203563026664
--> ea742e00f3f8
STEP 8/12: COPY src/backend ./src/backend
--> Using cache 13284d1fd37ac4dc3c97678a16ff458ab681a305359c759b5deec8486e70db83
--> 13284d1fd37a
STEP 8/11: EXPOSE 5173
--> Using cache 3af4a33c9060a1a6082c718ded4bdde3f85a05566973249e66787955516b97e0
--> 3af4a33c9060
STEP 9/11: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD node -e "fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
--> Using cache a3f9c281e71310d9830393407ae24806b5aa3fdf8fd53fe9532c4b383d7ffe6b
--> a3f9c281e713
STEP 9/12: EXPOSE 8080
--> Using cache 5d873660b24a97578bcf041a576f8674df552dcfad8c74392ac461703a72f630
--> 5d873660b24a
STEP 10/11: CMD ["npm", "run", "dev", "-w", "@cubeclicker/frontend"]
--> Using cache fe9db97d65961e48e1829194b535f891895755e6e6058d62269b4e5fe8d02b46
--> fe9db97d6596
STEP 10/12: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
--> Using cache 6d5350281b1a91e3678ff55b9aac41fd820ffcddcf0949bb3d41eabaf5ab7109
--> 6d5350281b1a
STEP 11/11: LABEL "com.docker.compose.image.builder"="classic"
--> Using cache 27cc9b1319bfe5c38a019b8accccbddc7f95b292ce4ccc30da26d06f814eb2bd
--> 27cc9b1319bf
STEP 11/12: CMD ["npm", "run", "dev", "-w", "@cubeclicker/backend"]
COMMIT docker.io/library/cubeclicker-frontend:dev
--> Using cache dfe80e631c91edfa2acd5829988289bd36bf05859abfef4bc0a5145e14b31a77
--> dfe80e631c91
--> 69106bd84aa8
Successfully tagged docker.io/library/cubeclicker-frontend:dev
STEP 12/12: LABEL "com.docker.compose.image.builder"="classic"
69106bd84aa8a232b0032d3de944636adfe308c7e581d0a9887ce513acc8c477
Successfully built 69106bd84aa8
Successfully tagged cubeclicker-frontend:dev
 Image cubeclicker-frontend:dev Built
 Image cubeclicker-frontend:dev Built
COMMIT docker.io/library/cubeclicker-backend:dev
--> 301dbd1ec7bb
Successfully tagged docker.io/library/cubeclicker-backend:dev
301dbd1ec7bbca18d55ee7decad8eb344ea1bdf540516f29b97614143c45cc17
Successfully built 301dbd1ec7bb
Successfully tagged cubeclicker-backend:dev
 Image cubeclicker-backend:dev Built
 Image cubeclicker-backend:dev Built
 Network cubeclicker_default Creating
 Network cubeclicker_default Creating
 Network cubeclicker_default Created
 Network cubeclicker_default Created
 Container cubeclicker-frontend-1 Creating
 Container cubeclicker-backend-1 Creating
 Container cubeclicker-frontend-1 Created
 Container cubeclicker-backend-1 Created
 Container cubeclicker-frontend-1 Starting
 Container cubeclicker-backend-1 Starting
 Container cubeclicker-frontend-1 Started
 Container cubeclicker-backend-1 Started
 Container cubeclicker-backend-1 Waiting
 Container cubeclicker-frontend-1 Waiting
container cubeclicker-frontend-1 exited (243)
Error: executing /usr/local/bin/docker-compose up -d --build --wait: exit status 1
up-wait-exit=1
```

Findings from this single command:

- **`--wait` is supported by the provider** — it printed `Container cubeclicker-backend-1 Waiting` / `Container cubeclicker-frontend-1 Waiting`, i.e. it actually waited on the health signal. AC-26's `--wait`-unavailable contingency (poll `podman compose ps`) is therefore **not** needed; the exit is not a provider-form gap.
- The builds themselves are green: both `:dev` images build through the compose provider, and **the compose-provider build path carries the image `HEALTHCHECK`** (no OCI-format warning; § 3.3), confirming the r4 pin (`build-log-T4.md` § 5.2) on the composed stack. `compose.yaml` stays healthcheck-free (contract 5).
- The failure is that the containers **exit immediately** — see container logs below.

Container logs (the actual failure):

```
$ podman logs cubeclicker-frontend-1
npm error code EACCES
npm error syscall open
npm error path /app/src/frontend/package.json
npm error errno -13
npm error Error: Could not read package.json: Error: EACCES: permission denied, open '/app/src/frontend/package.json'
npm error     at async open (node:internal/fs/promises:1345:25)
npm error     at async readFile (node:internal/fs/promises:2003:14)
npm error     at async read (/usr/local/lib/node_modules/npm/node_modules/@npmcli/package-json/lib/read-package.js:9:18)
npm error     at async PackageJson.load (/usr/local/lib/node_modules/npm/node_modules/@npmcli/package-json/lib/index.js:131:31)
npm error     at async PackageJson.normalize (/usr/local/lib/node_modules/npm/node_modules/@npmcli/package-json/lib/index.js:117:31)
npm error     at async mapWorkspaces (/usr/local/lib/node_modules/npm/node_modules/@npmcli/map-workspaces/lib/index.js:135:13)
npm error     at async getWorkspaces (/usr/local/lib/node_modules/npm/lib/utils/get-workspaces.js:14:22)
npm error     at async RunScript.setWorkspaces (/usr/local/lib/node_modules/npm/lib/base-cmd.js:270:16)
npm error     at async RunScript.execWorkspaces (/usr/local/lib/node_modules/npm/lib/commands/run.js:51:16)
npm error     at async Npm.exec (/usr/local/lib/node_modules/npm/lib/npm.js:193:16) {
npm error   errno: -13,
npm error   code: 'EACCES',
npm error   syscall: 'open',
npm error   path: '/app/src/frontend/package.json'
npm error }
npm error
npm error The operation was rejected by your operating system.
npm error It is likely you do not have the permissions to access this file as the current user
npm error A complete log of this run can be found in: /root/.npm/_logs/2026-10-18T10_09_49_201Z-debug-0.log

$ podman logs cubeclicker-backend-1 | tail -20     # identical failure, path '/app/src/backend/package.json'
npm error     at async readFile (node:internal/fs/promises:2003:14)
npm error     at async read (/usr/local/lib/node_modules/npm/node_modules/@npmcli/package-json/lib/read-package.js:9:18)
npm error     at async PackageJson.load (/usr/local/lib/node_modules/npm/node_modules/@npmcli/package-json/lib/index.js:131:31)
npm error     at async PackageJson.normalize (/usr/local/lib/node_modules/npm/node_modules/@npmcli/package-json/lib/index.js:117:31)
npm error     at async mapWorkspaces (/usr/local/lib/node_modules/npm/node_modules/@npmcli/map-workspaces/lib/index.js:135:13)
npm error     at async getWorkspaces (/usr/local/lib/node_modules/npm/lib/utils/get-workspaces.js:14:22)
npm error     at async RunScript.setWorkspaces (/usr/local/lib/node_modules/npm/lib/base-cmd.js:270:16)
npm error     at async RunScript.execWorkspaces (/usr/local/lib/node_modules/npm/lib/commands/run.js:51:16)
npm error     at async Npm.exec (/usr/local/lib/node_modules/npm/lib/npm.js:193:16) {
npm error   errno: -13,
npm error   code: 'EACCES',
npm error   syscall: 'open',
npm error   path: '/app/src/backend/package.json'
npm error }
npm error
npm error The operation was rejected by your operating system.
npm error It is likely you do not have the permissions to access this file as the current user
npm error A complete log of this run can be found in: /root/.npm/_logs/2026-10-18T10_09_49_300Z-debug-0.log
```

### 3.3 Health capture (both services) — image healthcheck present, but containers are not healthy

```
$ podman compose ps -a
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

NAME                     IMAGE                                        COMMAND                  SERVICE    CREATED         STATUS                       PORTS
cubeclicker-backend-1    docker.io/library/cubeclicker-backend:dev    "npm run dev -w @cub…"   backend    2 minutes ago   Exited (243) 2 minutes ago   127.0.0.1:8080->8080/tcp
cubeclicker-frontend-1   docker.io/library/cubeclicker-frontend:dev   "npm run dev -w @cub…"   frontend   2 minutes ago   Exited (243) 2 minutes ago   127.0.0.1:5173->5173/tcp
ps-exit=0

$ podman inspect cubeclicker-backend-1 --format '{{.Config.Healthcheck}} {{.State.Health.Status}}'
{[CMD-SHELL node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"] 15s 0s 10s 3s 5} stopped
inspect-backend-exit=0
$ podman inspect cubeclicker-frontend-1 --format '{{.Config.Healthcheck}} {{.State.Health.Status}}'
{[CMD-SHELL node -e "fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"] 15s 0s 10s 3s 5} starting
inspect-frontend-exit=0

$ podman image inspect cubeclicker-backend:dev cubeclicker-frontend:dev --format '{{.Config.Healthcheck}}'
{[CMD-SHELL node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"] 15s 0s 10s 3s 5}
{[CMD-SHELL node -e "fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"] 15s 0s 10s 3s 5}
image-inspect-exit=0

$ podman inspect cubeclicker-backend-1 --format '{{.State.Status}} {{.State.ExitCode}} {{.State.Error}}'
exited 243
```

Reading: the r4 health-signal pin **holds on the composed path** — the compose-built `:dev` images carry the pinned `HEALTHCHECK` (interval 10s / timeout 3s / retries 5 / start-period 15s, `podman image inspect` non-null), which is why `--wait` engaged. `compose.yaml` declares no healthcheck (contract 5 intact). The health *status* is `stopped`/`starting` only because both containers died instantly from the bind-mount denial — no `healthy` state is reachable until § 6 is resolved. No compose-level healthcheck was added or considered as a fix.

### 3.4 `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` — provider form supported; exit 1 from the same root cause

```
$ podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-backend-1 Starting
 Container cubeclicker-frontend-1 Starting
 Container cubeclicker-backend-1 Started
 Container cubeclicker-frontend-1 Started
 Container cubeclicker-smoke-run-9b7db32fda8e Creating
 Container cubeclicker-smoke-run-9b7db32fda8e Created
node:internal/modules/cjs/loader:1568
  throw err;
  ^

Error: Cannot find module '/smoke/smoke.mjs'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1564:15)
    at wrapResolveFilename (node:internal/modules/cjs/loader:1118:27)
    at defaultResolveImplForCJSLoading (node:internal/modules/cjs/loader:1142:10)
    at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1169:12)
    at Module._load (node:internal/modules/cjs/loader:1341:5)
    at wrapModuleLoad (node:internal/modules/cjs/loader:261:19)
    at Module.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:154:5)
    at node:internal/main/run_main_module:33:47 {
  code: 'MODULE_NOT_FOUND',
  requireStack: []
}

Node.js v24.22.0

Error: executing /usr/local/bin/docker-compose -f compose.yaml -f compose.smoke.yaml run --rm smoke: exit status 1
smoke-run-exit=1
```

Reading: the pinned `run --rm smoke` form is **supported** — the provider started the dependencies, created and started the `smoke` service container from the qualified smoke image (`docker.io/library/node:24-alpine` — present locally, `podman image inspect … → b842533ff063 [docker.io/library/node:24-alpine]`), and ran `node smoke.mjs` in it. The `MODULE_NOT_FOUND` is the read-only `./tests/e2e:/smoke:ro` mount being inaccessible inside the container (SELinux), not a missing file on the host (§ 4).

### 3.5 AC-27 host-path checks (`node -e "fetch(...)"`, no `curl`/`wget`)

```
$ node -e "fetch('http://localhost:8080/healthz')…"
FETCH ERROR ECONNREFUSED
backend-fetch-exit=1

$ node -e "fetch('http://localhost:5173/')…"
FETCH ERROR ECONNREFUSED
frontend-fetch-exit=1

$ node -e "new WebSocket('ws://localhost:8080/ws') …"
WS ERROR (connection failed)
ws-probe-exit=1
```

Reading: nothing is published because both containers died (§ 3.2); the published-port path therefore cannot be verified on this host until § 6 is resolved.

### 3.6 `podman compose down` — first live use: **exit 0**

```
$ podman compose down
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-backend-1 Stopping
 Container cubeclicker-frontend-1 Stopping
 Container cubeclicker-backend-1 Stopped
 Container cubeclicker-backend-1 Removing
 Container cubeclicker-frontend-1 Stopped
 Container cubeclicker-frontend-1 Removing
 Container cubeclicker-frontend-1 Removed
 Container cubeclicker-backend-1 Removed
 Network cubeclicker_default Removing
 Network cubeclicker_default Removed
down-exit=0
```

## 4. Root cause — host SELinux labeling, not the provider and not the scaffold

The pinned bind-mount specs (`compose.yaml`: `./src/backend:/app/src/backend`, `./src/frontend:/app/src/frontend`; `compose.smoke.yaml`: `./tests/e2e:/smoke:ro`) carry no SELinux relabel option, while the verified host is SELinux **Enforcing** and the repository lives under `/var/home/...` labeled `user_home_t`. The container runtime denies `container_t` access to those paths. Three isolated probes (each with the exact mount spec, on the pinned base image, native `podman run` — i.e. independent of the compose provider):

```
=== probe A: same mount spec as compose.yaml, default labels ===
$ podman run --rm -v "$PWD/src/backend:/app/src/backend" docker.io/library/node:24-alpine sh -c 'head -3 /app/src/backend/package.json'
head: /app/src/backend/package.json: Permission denied

$ podman run --rm -v "$PWD/src/backend:/app/src/backend" docker.io/library/node:24-alpine sh -c 'id; ls -ln /app/src/backend; cat /app/src/backend/package.json | head -3'
uid=0(root) gid=0(root) groups=0(root),1(bin),2(daemon),3(sys),4(adm),6(disk),10(wheel),11(floppy),20(dialout),26(tape),27(video)
total 0
ls: can't open '/app/src/backend': Permission denied
cat: can't open '/app/src/backend/package.json': Permission denied
# denied even for uid 0 inside the container

=== probe B: same mount spec with --security-opt label=disable ===
$ podman run --rm --security-opt label=disable -v "$PWD/src/backend:/app/src/backend" docker.io/library/node:24-alpine sh -c 'head -3 /app/src/backend/package.json'
{
  "name": "@cubeclicker/backend",
  "private": true,

=== probe C: ':z' relabel on an isolated copy (repo labels untouched) ===
$ ls -Z /tmp/opencode/t6/labelprobe/package.json
unconfined_u:object_r:user_tmp_t:s0 /tmp/opencode/t6/labelprobe/package.json
$ podman run --rm -v "/tmp/opencode/t6/labelprobe:/probe:z" docker.io/library/node:24-alpine sh -c 'head -3 /probe/package.json'
{
  "name": "@cubeclicker/backend",
  "private": true,
$ ls -Z /tmp/opencode/t6/labelprobe/package.json
system_u:object_r:container_file_t:s0 /tmp/opencode/t6/labelprobe/package.json      # ':z' relabels the source for container access

=== probe D: same mount spec as compose.smoke.yaml, default labels ===
$ podman run --rm -v "$PWD/tests/e2e:/smoke:ro" docker.io/library/node:24-alpine sh -c 'ls -ln /smoke; echo "ls-exit=$?"; node /smoke/smoke.mjs 2>&1 | head -5'
ls: can't open '/smoke': Permission denied
total 0
ls-exit=1
node:internal/modules/cjs/loader:1568
  throw err;
  ^

Error: Cannot find module '/smoke/smoke.mjs'      # identical failure to § 3.4

=== probe E: same mount spec, label=disable (control) ===
$ podman run --rm --security-opt label=disable -v "$PWD/tests/e2e:/smoke:ro" docker.io/library/node:24-alpine sh -c 'ls -ln /smoke; head -2 /smoke/smoke.mjs'
total 8
-rw-r--r--    1 0        0             5897 Oct 18 10:09 smoke.mjs
// CubeClicker — containerized smoke test (plan contract 12; feature `stack-selection` T6).
//
```

No host-config override exists that silently removes this (the effective default is `label = true`, i.e. labeling on; `/usr/share/containers/containers.conf` line 207 is commented/`true`). Probes B/C/E are **diagnostics only** — no deliverable was changed to use them, and the pinned compose specs were not edited (they are T3/T5b-owned and byte-pinned by contracts 5/6).

## 5. Supplementary evidence for `tests/e2e/smoke.mjs` (not a substitute for AC-26/27)

Because the containerized sequence is blocked at a layer *outside* the script, the script itself was validated independently so that T6's code path is not the open variable when the compose path is fixed.

### 5.1 Zero-dependency inspection (contract 12)

```
$ grep -nE "^import |^const .*= require\(|require\(" tests/e2e/smoke.mjs
(no import/require statements; globals only: fetch, WebSocket, setTimeout, console, process, AbortSignal)
```

### 5.2 FAIL path — nothing listening, bounded readiness honored, non-zero exit

```
$ BACKEND_URL=http://localhost:8080 FRONTEND_URL=http://localhost:5173 WS_URL=ws://localhost:8080/ws READY_TIMEOUT_MS=3000 node tests/e2e/smoke.mjs
smoke: backend=http://localhost:8080 frontend=http://localhost:5173 ws=ws://localhost:8080/ws readyTimeoutMs=3000
FAIL backend http://localhost:8080/healthz responds 200 with {"status":"ok"} — fetch failed
FAIL frontend http://localhost:5173/ responds 200 with text/html — fetch failed
FAIL websocket client 1 received hello from ws://localhost:8080/ws — websocket error before hello
FAIL websocket client 2 received hello from ws://localhost:8080/ws — websocket error before hello
SMOKE FAIL (0/4 checks passed)
fail-path-exit=1
```

### 5.3 PASS path — the real scaffold services (host-run `npm run dev` in both workspaces), pinned 30 s default

```
$ npm run dev -w @cubeclicker/backend   # (background, log)
> dev
> tsx watch src/server.ts

CubeClicker backend listening on http://0.0.0.0:8080 (WebSocket ws://0.0.0.0:8080/ws)

$ npm run dev -w @cubeclicker/frontend  # (background, log)
> dev
> vite

  VITE v7.3.7  ready in 96 ms
  ➜  Local:   http://localhost:5173/

$ BACKEND_URL=http://localhost:8080 FRONTEND_URL=http://localhost:5173 WS_URL=ws://localhost:8080/ws node tests/e2e/smoke.mjs
smoke: backend=http://localhost:8080 frontend=http://localhost:5173 ws=ws://localhost:8080/ws readyTimeoutMs=30000
PASS backend http://localhost:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://localhost:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://localhost:8080/ws
PASS websocket client 2 received hello from ws://localhost:8080/ws
SMOKE PASS (4/4 checks)
pass-path-exit=0
```

### 5.4 The same file, unmodified, on the pinned smoke image with no install step

```
$ podman run --rm --network=host \
    -e BACKEND_URL=http://localhost:8080 -e FRONTEND_URL=http://localhost:5173 -e WS_URL=ws://localhost:8080/ws \
    -v /tmp/opencode/t6/imageprobe:/smoke:ro,z -w /smoke docker.io/library/node:24-alpine node smoke.mjs
smoke: backend=http://localhost:8080 frontend=http://localhost:5173 ws=ws://localhost:8080/ws readyTimeoutMs=30000
PASS backend http://localhost:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://localhost:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://localhost:8080/ws
PASS websocket client 2 received hello from ws://localhost:8080/ws
SMOKE PASS (4/4 checks)
image-run-exit=0
```

(`--network=host` + `:z` were needed only *because* the composed network path is blocked; the run proves the contract-12 requirement "runs under `node smoke.mjs` on `docker.io/library/node:24-alpine` with no install step" and the two-concurrent-client behaviour. It does not replace AC-26/27, which require the compose network and published ports.)

Teardown of the host-run services (ports returned to the free state):

```
$ kill -TERM -<backend-pgid> -<frontend-pgid>
$ for p in 8080 5173; do …; done
port 8080: free
port 5173: free
$ pgrep -af "tsx watch|vite"     # only the probing shell itself
$ podman ps -a --format '{{.Names}} {{.Status}}'
davincibox Exited (0) 4 weeks ago        # pre-existing, unrelated container
```

## 6. Blocked — exact question and candidate answers (no workaround applied)

**Question (for the planner; a spec/plan amendment decision, not a T6 decision):** the decided single-command run and the smoke test cannot execute on the verified host because the pinned bind mounts do not relabel for SELinux, and relabeling is a property of the compose volume spec — a file T6 does not own and whose values are byte-pinned (`plan.md` contracts 5/6, `spec.md` AC-13/AC-14). Which of the following does the planner/spec owner want?

- **Candidate A — environment precondition (no repo change).** Record "SELinux hosts must relabel the bind-mounted sources (or run the containers unconfined)" as a host precondition, i.e. relabel out-of-band: `chcon -Rt container_file_t src/backend src/frontend tests/e2e` on the build/verification host. Consequences: unblocks AC-26/27 with zero artifact drift, but is host-coupled, privilege-requiring, must be re-applied after checkouts/file creation (git does not carry SELinux labels), is absent from AC-12's "no other host prerequisites" promise, and leaves every other SELinux host (or CI runner) failing the decided single command.
- **Candidate B — repo-carried pin amendment (r5), same shape as r4 (recommended).** Add the SELinux relabel option to the three pinned bind mounts: `compose.yaml` → `./src/backend:/app/src/backend:z` and `./src/frontend:/app/src/frontend:z`; `compose.smoke.yaml` → `./tests/e2e:/smoke:ro,z`; via a remediation task (e.g. T6b) owning those two files, plus in-place token updates to `plan.md` contracts 5/6 and `spec.md` AC-13/AC-14, then re-verify AC-26/AC-27 (T6's sequence re-run) and the T4/T5-unaffected claim. Consequences: single command works out of the box on SELinux hosts and stays a no-op where SELinux is disabled; `:z` (shared label) is required rather than `:Z` (private) because the smoke service and the frontend/backend services mount distinct trees but the developer's own tooling also reads these files; the developer's checkout files get relabeled by the first `podman compose up` (standard Podman practice). Note the smoke entry must be `:ro,z` (read-only + shared label).
- **Candidate C — host-wide tooling change (not repo-carried; not recommended).** Set `label = false` in `/etc/containers/containers.conf` (or `--security-opt label=disable` per service). Disables SELinux separation for all containers, contradicts the containerization conventions' security posture, and is an environment change outside the repository — the same class of fix the r4 amendment explicitly rejected for registries.

Evidence for the choice: § 3.2–§ 3.5 (raw failures), § 4 (three isolated probes proving the mechanism and that both fixes work). Everything else the sequence is supposed to prove **did pass**: the `down -v --rmi local`, `up … --wait` (provider support), `run --rm smoke` (provider support) and `down` forms are all supported by the provider, the compose-built images carry the pinned `HEALTHCHECK` (r4 pin confirmed on the composed path), and the smoke script itself is green on the pinned image (§ 5).

## 7. Acceptance audit (T6 scope: AC-25, AC-26, AC-27)

- **AC-25 — met.** `tests/e2e/smoke.mjs` is dependency-free (no `import`/`require`; global `fetch`/`WebSocket`/timers only — § 5.1) and performs exactly the pinned checks: backend `/healthz` 200, frontend `/` 200 with `text/html`, two **concurrent** WebSocket clients each receiving a parseable `hello`, bounded readiness wait (default `READY_TIMEOUT_MS=30000`), per-check PASS/FAIL output, exit 0 only when all checks pass. Live both ways: FAIL path 0/4 with exit 1 and the bounded wait honored (§ 5.2); PASS path 4/4 with exit 0 on the real scaffold services at the pinned default budget (§ 5.3) and the same file unmodified on the pinned smoke image with no install step (§ 5.4). The only unexercised leg is mounting/launching it via the compose service, which is blocked for the AC-26 reason below (and is `compose.smoke.yaml`'s contract, verified in T3/T5b).
- **AC-26 — unmet (blocked).** `podman compose up -d --build --wait` exits **1**: the provider supports `--wait` (it waited on both services — so the AC's documented fallback is not the issue), the images build and carry the pinned healthcheck, but both containers exit `243` (`npm error code EACCES … /app/src/[backend|frontend]/package.json`) because the pinned bind mounts are SELinux-denied on this Enforcing host; consequently `run --rm smoke` also exits 1 (the smoke container cannot read `/smoke` — `MODULE_NOT_FOUND`). Raw failures: § 3.2, § 3.4; mechanism: § 4; decision needed: § 6. This is a host/precondition-vs-pin gap of exactly the kind `plan.md` § Risks says must be recorded as `blocked`/spec gap rather than worked around — no compose-level healthcheck, no compose edit, no host config change was made.
- **AC-27 — unmet (blocked).** The published-port checks return `ECONNREFUSED` for `http://localhost:8080/healthz`, `http://localhost:5173/`, and the WebSocket probe fails to connect, because no container survives § 3.2. The equivalent checks over the same services were green on the host-run path and inside the pinned image (§ 5.3, § 5.4), so the scripts/endpoints are proven; only the published-container path is unverifiable until § 6 is resolved.

Adjacent findings recorded for the reviewer (no T6 defect):
- The r4 pins behave as designed on the composed path: compose-built `:dev` images carry the pinned `HEALTHCHECK` (`podman image inspect` non-null, § 3.3), `compose.yaml` remains healthcheck-free (contract 5), and the smoke image row resolves to the qualified `docker.io/library/node:24-alpine` (present locally).
- `--wait` **is** supported by the verified provider (Docker Compose v5.6.0 via `podman compose`), so AC-26's contingency clause is not triggered by the provider.

## 8. Decisions

1. **Script shape:** plain top-level `await` async flow with small helpers (`record`, `pollUntilReady`, `receiveHello`) — no dependency, no bundling, straight `node smoke.mjs`. Readiness polling is per-URL and additive (backend budget, then frontend budget) so a slow first start is tolerated without letting a dead service pass; each request is individually aborted after 3 s so a hang cannot eat the whole budget.
2. **`/healthz` body assertion.** Contract 12 pins "→ 200"; the check additionally asserts the pinned body `{"status":"ok"}` so the smoke leg also evidences AC-19 end-to-end. Superset of the pinned check, no contradictory behaviour.
3. **WebSocket bound.** `HELLO_TIMEOUT_MS = 5000` per contract's "within 5s", separate from the 30 s readiness budget; sockets are closed on every settle path (no dangling handles, process exits cleanly).
4. **No workaround for the compose blocker.** Blocked paths were recorded raw and the fix routed to the planner (§ 6); the T6 artifacts contain no SELinux flag, no compose edit, no host config change. The supplementary § 5 runs used `label=disable`/`:z` **only** on isolated copies/controls and are labelled diagnostics, not deliverables.
5. **The script was exercised before declaring blocked** so the report separates "the deliverable works" from "the environment prevents the end-to-end leg" — the smoke file is not the open variable for whichever amendment § 6 produces.

## 9. Working-tree hygiene and staging

```
$ git status --short -uall      # at build end, before staging
 M docs/features/README.md
 M docs/features/project-glossary/status.md
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/spec-r1.md
?? docs/features/stack-selection/reviews/spec-r2.md
?? docs/features/stack-selection/reviews/spec-r3.md
?? docs/features/stack-selection/reviews/spec-r4.md
?? docs/features/stack-selection/reviews/t2c-check.md
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md
?? tests/e2e/smoke.mjs

$ find . -maxdepth 3 -name '.env*' -not -path './node_modules/*' -not -path './*/node_modules/*'
find-exit=0        # no .env* file exists

$ ls -la tests/e2e
-rw-r--r--. 1 raultorraco raultorraco 5897 … smoke.mjs
```

No file outside the two `files_owned` paths was created, edited, or staged; no manifest/lockfile/compose/Dockerfile/decided-doc was touched; no `.env*` file was read or written. All probe copies lived under `/tmp/opencode/t6/` (outside the repository) and the diagnostic mount probes left repository SELinux labels untouched (verified: `ls -Zd tests src/backend` unchanged, § 1). No leftover containers (`podman ps -a` shows only the pre-existing unrelated `davincibox`) and host ports 8080/5173 are free again.

```
$ git add tests/e2e/smoke.mjs docs/features/stack-selection/build-log-T6.md
$ git diff --cached --name-only
docs/features/stack-selection/build-log-T6.md
tests/e2e/smoke.mjs
$ git commit -m "test: containerized smoke test over the composed stack (T6)"
```

## 10. Deviations and notes

- **No deviation from the pinned contracts.** `tests/e2e/smoke.mjs` implements contract 12 as written; no compose/Dockerfile/manifest/lockfile edit was made; no substitute command was used for any pinned verify step.
- **Routed finding (blocked):** the SELinux bind-mount gap (§ 6) — the single-command run and the smoke test cannot pass on the verified host until the planner amends the volume specs (or records a host precondition). This is the same class of finding T4/T5 routed and the r4 amendment resolved as pins.
- Notes: the provider banner (`>>>> Executing external compose provider "/usr/local/bin/docker-compose" …`) is printed on every `podman compose` invocation on this host and was retained (ANSI escapes stripped); the build-context `Sending build context to Docker daemon 49.2kB` line is the provider's wording for Podman's API build path. `docs/features/README.md` and `docs/features/project-glossary/status.md` were already modified before this task and remain untouched/unstaged.
