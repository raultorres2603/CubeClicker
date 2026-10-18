# Build log — T6b — Compose bind-mount SELinux relabel (r5)

Task: T6b (dispatched 2026-10-18; executed 2026-10-18 on the verified host)
Files changed: `compose.yaml` (backend + frontend mount tokens), `compose.smoke.yaml` (smoke mount token) — three mount tokens — plus `docs/features/stack-selection/build-log-T6b.md` (this log).
Status: **completed** — the three pinned `:z` / `:ro,z` mount options were applied and accepted by the compose provider on first live use; the previously failing T6 sequence now runs green end-to-end (`up -d --build --wait` exit **0** with both services **healthy**; `run --rm smoke` exit **0** printing `SMOKE PASS (4/4 checks)` with `tests/e2e/smoke.mjs` byte-unchanged; host `/healthz`, `/` and WebSocket checks pass; `down` exit 0), and `git diff HEAD` contains exactly the three pinned tokens. AC-13, AC-14, AC-26, AC-27, AC-32 met.

Sketch (≤5 lines): append the shared SELinux relabel option to the three pinned bind mounts (`:z` on both workspace mounts in `compose.yaml`, `:ro,z` on the smoke mount in `compose.smoke.yaml`) per `plan.md` contracts 5/6; capture both files' build-start baselines; re-run T6's pinned sequence end-to-end (`config -q` ×2 → `down -v --rmi local` → `up -d --build --wait` → health capture → `run --rm smoke` → host `node -e` checks → `down`) recording every command's raw output; check the diff against the baselines; stage only the three owned paths and commit the pinned message.

## 1. Build-start baseline

Captured at build start, **before** the three token edits and before any container start (values as observed in-session; the two file baselines are re-derivable exactly from the pinned pre-amendment blobs below).

```
$ git log --oneline -1
03772b1 test: containerized smoke test over the composed stack (T6)
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
$ git diff 207d642 -- compose.yaml          # empty → worktree byte-identical to the pinned pre-amendment blob
$ git diff 28437ac -- compose.smoke.yaml    # empty → byte-identical
$ sha256sum compose.yaml compose.smoke.yaml tests/e2e/smoke.mjs
bb75c5602d4e39049c5e9f316c9be72c525e82088fe6780dc43e4982415c66a3  compose.yaml
acb5b6f78f878701a22e1b7e6aec4a0646005e73f5e5059ee45c8130ff84c92f  compose.smoke.yaml
a14c30a2ec7a28f5b984dc7c352a7eee283bce832378758acb07ed98db2e90dd  tests/e2e/smoke.mjs
$ node --version
v24.22.0
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
$ for p in 8080 5173; do ss -ltnH | grep -q ":$p " && echo "port $p: OCCUPIED" || echo "port $p: free"; done
port 8080: free
port 5173: free
```

Re-derivation of the baseline blobs (the objects `git diff` compared the pre-edit worktree against) and of the T6 script pin:

```
$ git show 207d642:compose.yaml | sha256sum
bb75c5602d4e39049c5e9f316c9be72c525e82088fe6780dc43e4982415c66a3  -
$ git show 28437ac:compose.smoke.yaml | sha256sum
acb5b6f78f878701a22e1b7e6aec4a0646005e73f5e5059ee45c8130ff84c92f  -
$ git show 03772b1:tests/e2e/smoke.mjs | sha256sum
a14c30a2ec7a28f5b984dc7c352a7eee283bce832378758acb07ed98db2e90dd  -

--- pinned pre-amendment blobs (the build-start baseline) ---
$ git show 207d642:compose.yaml
# CubeClicker — local development stack (single command: `podman compose up`).
# Health signals come from each image's HEALTHCHECK (no duplicate healthcheck here).
name: cubeclicker

services:
  backend:
    build:
      context: .
      dockerfile: src/backend/Dockerfile
      target: dev
    image: cubeclicker-backend:dev
    ports:
      - "127.0.0.1:${BACKEND_PORT:-8080}:8080"
    environment:
      NODE_ENV: development
    volumes:
      - "./src/backend:/app/src/backend"

  frontend:
    build:
      context: .
      dockerfile: src/frontend/Dockerfile
      target: dev
    image: cubeclicker-frontend:dev
    ports:
      - "127.0.0.1:${FRONTEND_PORT:-5173}:5173"
    environment:
      NODE_ENV: development
      VITE_WS_URL: "${VITE_WS_URL:-ws://localhost:8080/ws}"
    volumes:
      - "./src/frontend:/app/src/frontend"
$ git show 28437ac:compose.smoke.yaml
# Containerized smoke test — opt-in override, never started by a plain `podman compose up`.
# Run: podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke
services:
  smoke:
    image: docker.io/library/node:24-alpine
    working_dir: /smoke
    volumes:
      - "./tests/e2e:/smoke:ro"
    command: ["node", "smoke.mjs"]
    depends_on:
      - backend
      - frontend
```

The three mounted source trees carried `unconfined_u:object_r:user_home_t:s0` at build start (T6 § 1 capture; re-observed for `tests/e2e` in § 3.5, before the smoke run relabeled it). Pre-existing working-tree dirt (`docs/features/README.md`, `docs/features/project-glossary/status.md` modified; the stack-selection artifacts untracked) was left untouched and unstaged.

## 2. Deliverable — exactly three mount tokens

`git diff HEAD -- compose.yaml compose.smoke.yaml` (the T6b diff check; post-edit):

```
diff --git a/compose.smoke.yaml b/compose.smoke.yaml
index 78fc6d9..2bafbc8 100644
--- a/compose.smoke.yaml
+++ b/compose.smoke.yaml
@@ -5,7 +5,7 @@ services:
     image: docker.io/library/node:24-alpine
     working_dir: /smoke
     volumes:
-      - "./tests/e2e:/smoke:ro"
+      - "./tests/e2e:/smoke:ro,z"
     command: ["node", "smoke.mjs"]
     depends_on:
       - backend
diff --git a/compose.yaml b/compose.yaml
index ea58494..fcceb9f 100644
--- a/compose.yaml
+++ b/compose.yaml
@@ -14,7 +14,7 @@ services:
     environment:
       NODE_ENV: development
     volumes:
-      - "./src/backend:/app/src/backend"
+      - "./src/backend:/app/src/backend:z"
 
   frontend:
     build:
@@ -28,4 +28,4 @@ services:
       NODE_ENV: development
       VITE_WS_URL: "${VITE_WS_URL:-ws://localhost:8080/ws}"
     volumes:
-      - "./src/frontend:/app/src/frontend"
+      - "./src/frontend:/app/src/frontend:z"
```

```
$ git diff --stat HEAD -- compose.yaml compose.smoke.yaml
 compose.smoke.yaml | 2 +-
 compose.yaml       | 4 ++--
 2 files changed, 3 insertions(+), 3 deletions(-)

$ grep -n 'volumes:' -A1 compose.yaml compose.smoke.yaml
compose.yaml:16:    volumes:
compose.yaml-17-      - "./src/backend:/app/src/backend:z"
--
compose.yaml:30:    volumes:
compose.yaml-31-      - "./src/frontend:/app/src/frontend:z"
--
compose.smoke.yaml:7:    volumes:
compose.smoke.yaml-8-      - "./tests/e2e:/smoke:ro,z"

$ grep -in 'healthcheck' compose.yaml compose.smoke.yaml
compose.yaml:2:# Health signals come from each image's HEALTHCHECK (no duplicate healthcheck here).
grep-healthcheck-exit=0   # only match is the comment on compose.yaml:2; the service-level key grep is below
```

Enumeration (contracts 5/6): the two compose files contain exactly three bind mounts — `compose.yaml:17` `./src/backend:/app/src/backend:z`, `compose.yaml:31` `./src/frontend:/app/src/frontend:z`, `compose.smoke.yaml:8` `./tests/e2e:/smoke:ro,z` — and the diff changes nothing else (no port, env, image, build, topology, or healthcheck change). Contract 5 stays intact:

```
$ grep -n 'healthcheck:' compose.yaml compose.smoke.yaml   # the service-level key
grep-key-exit=1   # no match => no service-level healthcheck in either file (contract 5)
```

(The only `HEALTHCHECK` text in either file is `compose.yaml:2`'s comment stating that health signals come from the image `HEALTHCHECK`; there is no service-level `healthcheck:` key. The smoke `image:` token remains the r4-qualified `docker.io/library/node:24-alpine`.)

## 3. The pinned verify sequence — raw output

Reading note: every command is the pinned form from `tasks.md` § T6b; the `$ …` lines show the command as run (the capture echoed a few of them in shell-escaped form where a single-quoted shell command was summarised). Program output is otherwise verbatim; ANSI escape sequences emitted by the compose-provider banner are stripped for readability. Raw logs were kept in `/tmp/opencode/t6b/*.log` during the session.

### 3.1 `podman compose config -q` and the merged `podman compose -f compose.yaml -f compose.smoke.yaml config -q` — **exit 0** both

```
$ podman compose config -q
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

config-exit=0

$ podman compose -f compose.yaml -f compose.smoke.yaml config -q
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

config-merged-exit=0
```

### 3.2 Merged model inspection (all three services present; smoke bind stays read-only)

```
$ podman compose -f compose.yaml -f compose.smoke.yaml config --format json | node -e "…"
services: backend, frontend, smoke
backend volume: bind /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend -> /app/src/backend read_only=undefined
frontend volume: bind /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend -> /app/src/frontend read_only=undefined
smoke volume: bind /var/home/raultorraco/Documents/Projects/CubeClicker/tests/e2e -> /smoke read_only=true
merged-inspect-exit=0
```

### 3.3 `podman compose down -v --rmi local` (clean state) — exit 0

```
$ podman compose down -v --rmi local
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

down-clean-exit=0
```

### 3.4 `podman compose up -d --build --wait` — **exit 0; both services reported `Healthy`**

This is the command that exited 1 in T6 (§ 3.2 there). `--wait` is supported by the provider and did engage the health signal; the containers no longer die on the bind mounts.

```
$ podman compose up -d --build --wait
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Image cubeclicker-backend:dev Building 
 Image cubeclicker-frontend:dev Building 
 Image cubeclicker-backend:dev Building 
 Image cubeclicker-frontend:dev Building 
Sending build context to Docker daemon   49.2kB
Sending build context to Docker daemon   49.2kB
STEP 1/12: FROM docker.io/library/node:24-alpine AS dev
STEP 1/11: FROM docker.io/library/node:24-alpine AS dev
STEP 2/11: WORKDIR /app
STEP 2/12: ENV NODE_ENV=development
--> Using cache ed1df529191f62a88286bbf4e58a82a1d758ee408befd62aad65e6fb71abce04
--> ed1df529191f
--> Using cache 60c303bd8d80b5f9fb2988802d25398341bd5ca094481331f3e91e9e1256eb8c
--> 60c303bd8d80
STEP 3/11: COPY package.json package-lock.json tsconfig.json ./
STEP 3/12: WORKDIR /app
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
--> Using cache a3f9c281e71310d9830393407ae24806b5aa3fdf8fd53fe9532c4b383d7ffe6b
--> a3f9c281e713
STEP 9/12: EXPOSE 8080
--> Using cache 3af4a33c9060a1a6082c718ded4bdde3f85a05566973249e66787955516b97e0
--> 3af4a33c9060
STEP 9/11: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD node -e "fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
--> Using cache fe9db97d65961e48e1829194b535f891895755e6e6058d62269b4e5fe8d02b46
--> fe9db97d6596
STEP 10/12: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
--> Using cache 5d873660b24a97578bcf041a576f8674df552dcfad8c74392ac461703a72f630
--> 5d873660b24a
STEP 10/11: CMD ["npm", "run", "dev", "-w", "@cubeclicker/frontend"]
--> Using cache 27cc9b1319bfe5c38a019b8accccbddc7f95b292ce4ccc30da26d06f814eb2bd
--> 27cc9b1319bf
STEP 11/12: CMD ["npm", "run", "dev", "-w", "@cubeclicker/backend"]
--> Using cache 6d5350281b1a91e3678ff55b9aac41fd820ffcddcf0949bb3d41eabaf5ab7109
--> 6d5350281b1a
STEP 11/11: LABEL "com.docker.compose.image.builder"="classic"
--> Using cache dfe80e631c91edfa2acd5829988289bd36bf05859abfef4bc0a5145e14b31a77
--> dfe80e631c91
STEP 12/12: LABEL "com.docker.compose.image.builder"="classic"
--> Using cache 69106bd84aa8a232b0032d3de944636adfe308c7e581d0a9887ce513acc8c477
COMMIT docker.io/library/cubeclicker-frontend:dev
--> 69106bd84aa8
Successfully tagged docker.io/library/cubeclicker-frontend:dev
--> Using cache 301dbd1ec7bbca18d55ee7decad8eb344ea1bdf540516f29b97614143c45cc17
COMMIT docker.io/library/cubeclicker-backend:dev
69106bd84aa8a232b0032d3de944636adfe308c7e581d0a9887ce513acc8c477
Successfully built 69106bd84aa8
Successfully tagged cubeclicker-frontend:dev
 Image cubeclicker-frontend:dev Built 
 Image cubeclicker-frontend:dev Built 
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
 Container cubeclicker-backend-1 Healthy 
 Container cubeclicker-frontend-1 Healthy 
up-wait-exit=0
```

### 3.5 Health capture — image `HEALTHCHECK` present + `State.Health.Status` = `healthy` on both containers

```
$ podman compose ps
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

NAME                     IMAGE                                        COMMAND                  SERVICE    CREATED          STATUS          PORTS
cubeclicker-backend-1    docker.io/library/cubeclicker-backend:dev    "npm run dev -w @cub…"   backend    16 seconds ago   Up 14 seconds   127.0.0.1:8080->8080/tcp
cubeclicker-frontend-1   docker.io/library/cubeclicker-frontend:dev   "npm run dev -w @cub…"   frontend   16 seconds ago   Up 15 seconds   127.0.0.1:5173->5173/tcp
ps-exit=0

$ podman inspect cubeclicker-backend-1 --format '{{.Config.Healthcheck}} {{.State.Health.Status}}'
{[CMD-SHELL node -e "fetch('http://127.0.0.1:8080/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"] 15s 0s 10s 3s 5} healthy
inspect-backend-exit=0
$ podman inspect cubeclicker-frontend-1 --format '{{.Config.Healthcheck}} {{.State.Health.Status}}'
{[CMD-SHELL node -e "fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"] 15s 0s 10s 3s 5} healthy
inspect-frontend-exit=0

$ ls -Zd src/backend src/frontend tests/e2e   # r5 relabel observed on the mounted sources
system_u:object_r:container_file_t:s0 src/backend
system_u:object_r:container_file_t:s0 src/frontend
 unconfined_u:object_r:user_home_t:s0 tests/e2e
```

### 3.6 `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` — **exit 0; `SMOKE PASS (4/4 checks)`**

This is the command that exited 1 in T6 (§ 3.4 there, `MODULE_NOT_FOUND`). The script is unchanged (`03772b1`; sha256 re-checked in § 3.8).

```
$ podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-backend-1 Running 
 Container cubeclicker-frontend-1 Running 
 Container cubeclicker-smoke-run-bc2804510e2b Creating 
 Container cubeclicker-smoke-run-bc2804510e2b Created 
smoke: backend=http://backend:8080 frontend=http://frontend:5173 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
SMOKE PASS (4/4 checks)
smoke-run-exit=0
```

### 3.7 AC-27 host-path checks (`node -e "fetch(...)"` / `node -e` WebSocket client; no `curl`/`wget`)

```
$ node -e "fetch('http://localhost:8080/healthz').then(async r => { console.log('status', r.status, r.headers.get('content-type')); console.log('body', await r.text()); process.exit(r.status===200?0:1) }).catch(e => { console.log('FETCH ERROR', e.message); process.exit(1) })"
status 200 application/json; charset=utf-8
body {"status":"ok"}
backend-fetch-exit=0

$ node -e "fetch('http://localhost:5173/').then(async r => { console.log('status', r.status, r.headers.get('content-type')); const t = await r.text(); console.log('has #root:', t.includes('id=\"root\"')); process.exit(r.status===200 && (r.headers.get('content-type')||'').includes('text/html') ? 0 : 1) }).catch(e => { console.log('FETCH ERROR', e.message); process.exit(1) })"
status 200 text/html
has #root: true
frontend-fetch-exit=0

$ node -e "const ws = new WebSocket('ws://localhost:8080/ws'); …"  (hello capture; 5s bound, closes socket on every path)
WS MESSAGE {"type":"hello","serverTime":"2026-10-18T10:49:42.960Z"}
ws-probe-exit=0
```

### 3.8 `podman compose down` + post-run hygiene (script pin re-check, relabel observed, ports back to free)

```
=== smoke.mjs byte-unchanged check (T6 deliverable 03772b1) ===
a14c30a2ec7a28f5b984dc7c352a7eee283bce832378758acb07ed98db2e90dd  tests/e2e/smoke.mjs
a14c30a2ec7a28f5b984dc7c352a7eee283bce832378758acb07ed98db2e90dd  -
(expected a14c30a2ec7a28f5b984dc7c352a7eee283bce832378758acb07ed98db2e90dd)

=== r5 relabel after smoke run ===
system_u:object_r:container_file_t:s0 src/backend
system_u:object_r:container_file_t:s0 src/frontend
system_u:object_r:container_file_t:s0 tests/e2e

=== no leftover smoke containers ===
davincibox Exited (0) 4 weeks ago
cubeclicker-backend-1 Up 38 seconds (healthy)
cubeclicker-frontend-1 Up 38 seconds (healthy)

$ podman compose down
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

 Container cubeclicker-frontend-1 Stopping 
 Container cubeclicker-backend-1 Stopping 
 Container cubeclicker-backend-1 Stopped 
 Container cubeclicker-backend-1 Removing 
 Container cubeclicker-backend-1 Removed 
 Container cubeclicker-frontend-1 Stopped 
 Container cubeclicker-frontend-1 Removing 
 Container cubeclicker-frontend-1 Removed 
 Network cubeclicker_default Removing 
 Network cubeclicker_default Removed 
down-exit=0

=== post-down state ===
davincibox Exited (0) 4 weeks ago
port 8080: free
port 5173: free
```

### 3.9 Working-tree hygiene (build-end, before staging)

```
$ git status --short -uall
 M compose.smoke.yaml
 M compose.yaml
 M docs/features/README.md
 M docs/features/project-glossary/status.md
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/spec-r1.md
?? docs/features/stack-selection/reviews/spec-r2.md
?? docs/features/stack-selection/reviews/spec-r3.md
?? docs/features/stack-selection/reviews/spec-r4.md
?? docs/features/stack-selection/reviews/spec-r5.md
?? docs/features/stack-selection/reviews/t2c-check.md
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md

$ find . -maxdepth 3 -name '.env*' -not -path './node_modules/*' -not -path './*/node_modules/*'
find-exit=0

$ podman ps -a --format '{{.Names}} {{.Status}}'
davincibox Exited (0) 4 weeks ago

$ for p in 8080 5173; do ss -ltnH | grep -q ":$p " && echo "port $p: OCCUPIED" || echo "port $p: free"; done
port 8080: free
port 5173: free
```

## 4. First live use of the compose `z` option through the provider — findings

- **Accepted; no provider rejection and no divergence.** `config -q` exits 0 for both file sets (§ 3.1), `up -d --build --wait` exits 0 with both services `Healthy` (§ 3.4/§ 3.5), `run --rm smoke` exits 0 (§ 3.6). The `blocked`/spec-gap branch of T6b's verify was not triggered.
- **The relabel is host-visible, exactly as the r5 risk bullet predicts.** After the first `up`, `src/backend` and `src/frontend` report `system_u:object_r:container_file_t:s0`; `tests/e2e` moves from `unconfined_u:object_r:user_home_t:s0` (§ 3.5, captured before the smoke run) to `system_u:object_r:container_file_t:s0` after the first `run --rm smoke` (§ 3.8). Shared (`:z`) label, as pinned — no per-container private label.
- **No host prerequisite and no new flag.** The single `podman compose up` command is unchanged; the option is carried in the repository (`compose.yaml`, `compose.smoke.yaml`) and is a no-op where SELinux is disabled.
- **The health signal is still the image `HEALTHCHECK`** carried by the compose-provider build path (no OCI-format warning in § 3.4; `podman inspect` Healthcheck non-null in § 3.5) and `compose.yaml` declares no healthcheck (contract 5) — so no provider regression to record.
- **Read-only preserved:** the merged model reports the smoke bind `read_only=true` (§ 3.2), so `:ro` survived the option addition (`:ro,z`).

## 5. Acceptance audit

- **AC-13 — met.** `compose.yaml` keeps project name `cubeclicker`, both services building from context `.` with the pinned Dockerfile path and `target: dev`, loopback-bound pinned port mappings, `VITE_WS_URL` with the pinned default, and healthcheck-free; the two bind mounts now carry the pinned `:z` option (`./src/backend:/app/src/backend:z`, `./src/frontend:/app/src/frontend:z` — § 2), and `podman compose config -q` exits 0 (§ 3.1).
- **AC-14 — met.** `compose.smoke.yaml` keeps service `smoke` with `image: docker.io/library/node:24-alpine`, `working_dir: /smoke`, `command: ["node","smoke.mjs"]`, `depends_on: [backend, frontend]`, and now mounts `./tests/e2e:/smoke:ro,z` (read-only + shared relabel — § 2); the merged model `podman compose -f compose.yaml -f compose.smoke.yaml config -q` exits 0 and contains all three services `backend`, `frontend`, `smoke` (§ 3.1/§ 3.2).
- **AC-26 — met.** `podman compose up -d --build --wait` exits **0** with both services healthy (the image `HEALTHCHECK` is the health signal; neither compose file declares a healthcheck) — § 3.4/§ 3.5; then `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` exits **0** (§ 3.6); then `podman compose down` succeeds (§ 3.8). The `--wait`-unavailable contingency was not needed (the provider supports `--wait`). Evidence lives here (T6's log records the blocked first attempt; spec-r5 F1 notes the pointer alignment, and T7 routes AC-26/27 to this log).
- **AC-27 — met.** From the build host: backend `/healthz` → 200 `{"status":"ok"}`, frontend `/` → 200 `text/html`, and a WebSocket client connects to `ws://localhost:8080/ws` and receives `{"type":"hello","serverTime":"2026-10-18T10:49:42.960Z"}` (§ 3.7). The same path is also exercised inside the compose network by the smoke run's two concurrent clients (§ 3.6).
- **AC-32 — met.** Diff vs. each file's build-start baseline contains only the three pinned in-place mount-token modifications of `plan.md` § Amendment trace (r5 row for `compose.yaml`, r4+r5 rows for `compose.smoke.yaml`): § 2 shows 3 insertions / 3 deletions across the two files, nothing else; `tests/e2e/smoke.mjs` is byte-unchanged (`a14c30a2…` == `03772b1:tests/e2e/smoke.mjs`, § 1/§ 3.8); no manifest, lockfile, Dockerfile, README, decided-doc, or `.opencode` file was touched (§ 3.9).

## 6. Decisions

1. **Exactly three tokens, nothing else.** The amendment is confined to the pinned diff target (`plan.md` contracts 5/6; AC-13/AC-14). `compose.yaml` was left healthcheck-free and the smoke `image:` token untouched (r4 pin already in place).
2. **Sequence re-run verbatim.** T6's pinned command forms were used unchanged (no substituted or additional flags), since the point of T6b is to re-run that exact sequence on the amended mounts; the only additions are non-mutating inspections (`config --format json`, `podman inspect`, `ls -Zd`) used as evidence.
3. **No workaround anywhere.** Nothing was chcon'd manually, no `label=disable`, no host config change; the relabel occurred through the pinned compose options at the first `up`/`run`.
4. **`tests/e2e/smoke.mjs` untouched** — its sha256 equals the T6 deliverable commit's blob before and after the run.
5. **Build-log honesty note.** The build-start baseline capture predates the edits; because the pre-edit worktree was byte-identical to the pinned blobs `207d642:compose.yaml` / `28437ac:compose.smoke.yaml` (empty `git diff` at build start, § 1), those blobs are reproduced in § 1 as the exact baseline content.

## 7. Working-tree hygiene and staging

Only the three T6b `files_owned` paths are staged, by explicit pathspec:

```
$ git add compose.yaml compose.smoke.yaml docs/features/stack-selection/build-log-T6b.md
$ git diff --cached --name-only
compose.smoke.yaml
compose.yaml
docs/features/stack-selection/build-log-T6b.md
$ git commit -m "fix: relabel compose bind mounts for SELinux hosts (T6b)"
```

No `.env*` file exists or was touched (`find` in § 3.9); the pre-existing modified feature artifacts and the untracked spec/plan/tasks/status/reviews files were left untouched and unstaged; no containers or images from this run were left behind beyond the pre-existing unrelated `davincibox` (§ 3.8/§ 3.9) and host ports 8080/5173 are free again.

## 8. Deviations and notes

- **No deviation from the pinned contracts.** `plan.md` contracts 5/6 tokens applied literally; nothing else in either file changed; no substitute command was used for any pinned verify step; no spec gap or provider regression was encountered (so none was recorded).
- Notes: the provider banner (`>>>> Executing external compose provider "/usr/local/bin/docker-compose" …`) prints on every `podman compose` invocation on this host and was retained (ANSI stripped); `tests/e2e` gained the shared `container_file_t:s0` label at the first smoke run, which is the documented r5 consequence (the next container start/checkout re-applies it).
