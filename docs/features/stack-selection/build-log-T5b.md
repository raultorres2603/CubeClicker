# Build log — T5b — Frontend + smoke image provider-compat pins (r4)

Task: T5b (2026-10-18) — parallel-safe batch with T4b (disjoint `files_owned`).
Files changed: `src/frontend/Dockerfile`, `compose.smoke.yaml`, `README.md`, `docs/features/stack-selection/build-log-T5b.md`.

**What changed & why (≤5 lines):** every `FROM` in `src/frontend/Dockerfile` is registry-qualified (`docker.io/library/node:24-alpine` ×2 — `dev` + `build`; `docker.io/nginxinc/nginx-unprivileged:1.27-alpine` — `prod`) and its `#` header build-command comment gains `--format docker` (r4: the verified host enforces short-name resolution without a TTY; Podman 5's default OCI build format drops `HEALTHCHECK`). The `compose.smoke.yaml` smoke `image:` token is qualified to `docker.io/library/node:24-alpine` (same image/tag). In `README.md` the two production-image commands are pinned as `podman build --format docker --target prod …` plus one rationale sentence. Nothing else in any file changes; no manifest/lockfile edits; nothing outside `files_owned`.

**Decisions:** (1) applied exactly the four lines of the planned diff — frontend Dockerfile line 2 (header) + lines 6/28/41 (3 `FROM`s), `compose.smoke.yaml` line 5 (`image:`), README.md lines 55–56 + one net-new sentence (spec-r4 F2/clause: `git diff HEAD` against the committed pre-amendment state is the operative check); (2) README rationale kept minimal and single-sentence so the net-new delta stays exactly one sentence; (3) no unqualified token retained anywhere, no `latest`, no compose change, no healthcheck duplication (contract 5 / `compose.yaml` byte-unchanged).

## 1. Baselines (build start)

Authoritative baseline per the reviewer clarifier (spec-r4 F2): the committed pre-amendment state at HEAD — `git diff HEAD`.

| File | commit in which authored | HEAD blob id (short) | sha256(`git show HEAD:<file>`) |
| --- | --- | --- | --- |
| `src/frontend/Dockerfile` | `9d10881` (T5) | `20575e8` | `693a38ab124f84bd07c7d82ec99983ea80b3203772149733cac52106692d0d7f` |
| `compose.smoke.yaml` | `9d10881` (T5) | `ff93098` | `5c67e523d7fd29779c4c2d863104f9322e3398f06668fea9a69f797f1702be52` |
| `README.md` | `207d642` (T3) | `dec3fdb` | `7a7f00382acaee52b5d26666c36251b36204a8fb14cb1d5d21efefbf37229d29` |

Baseline capture commands:

```
$ for f in src/frontend/Dockerfile compose.smoke.yaml README.md; do printf '%s  ' "$f"; git show "HEAD:$f" | sha256sum; done
src/frontend/Dockerfile  693a38ab124f84bd07c7d82ec99983ea80b3203772149733cac52106692d0d7f  -
compose.smoke.yaml  5c67e523d7fd29779c4c2d863104f9322e3398f06668fea9a69f797f1702be52  -
README.md  7a7f00382acaee52b5d26666c36251b36204a8fb14cb1d5d21efefbf37229d29  -

$ git rev-parse HEAD:src/frontend/Dockerfile HEAD:compose.smoke.yaml HEAD:README.md
20575e8671e6900c1ef681e628bef8649d63596c
ff93098469a4fcbb4d0f947a565e8b91539744f6
dec3fdb14ed49e603f855f123d4a0917752d0d97
```

Environment (`git log --oneline -3` at build start; T4b runs concurrently on `src/backend/Dockerfile`):

```
ae3a3f2 feat: backend skeleton with health and WebSocket hello (T4)
9d10881 feat: frontend skeleton with connection module (T5)
207d642 chore: scaffold workspace, compose stack, and commands (T3)
```

Tooling: `podman version 5.8.7`; `podman compose version` → `>>>> Executing external compose provider "/usr/local/bin/docker-compose" … <<<<` / `Docker Compose version v5.6.0` (matches the verified environment recorded in `build-log-T3.md` Run 3).

## 2. Diff vs. the committed pre-amendment state (`git diff HEAD`)

````
$ git diff HEAD -- src/frontend/Dockerfile compose.smoke.yaml README.md
diff --git a/README.md b/README.md
index dec3fdb..53c2a96 100644
--- a/README.md
+++ b/README.md
@@ -52,10 +52,12 @@ The defaults work out of the box. `.env` files are user-owned and are not used b
 ## Production images
 
 ```bash
-podman build --target prod -f src/backend/Dockerfile .
-podman build --target prod -f src/frontend/Dockerfile .
+podman build --format docker --target prod -f src/backend/Dockerfile .
+podman build --format docker --target prod -f src/frontend/Dockerfile .
 ```
 
+The `--format docker` form keeps the image `HEALTHCHECK`, which Podman 5's default OCI build format would drop.
+
 Both images are provider-neutral and are the deployable artifacts. Release tagging is deferred to deployment time.
 
 ## Stack
diff --git a/compose.smoke.yaml b/compose.smoke.yaml
index ff93098..78fc6d9 100644
--- a/compose.smoke.yaml
+++ b/compose.smoke.yaml
@@ -2,7 +2,7 @@
 # Run: podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke
 services:
   smoke:
-    image: node:24-alpine
+    image: docker.io/library/node:24-alpine
     working_dir: /smoke
     volumes:
       - "./tests/e2e:/smoke:ro"
diff --git a/src/frontend/Dockerfile b/src/frontend/Dockerfile
index 20575e8..a3cc896 100644
--- a/src/frontend/Dockerfile
+++ b/src/frontend/Dockerfile
@@ -1,9 +1,9 @@
 # CubeClicker frontend image — multi-stage (`dev` for hot-reload development, `prod` for static serving).
-# Build context is the repository root:  podman build --target dev|prod -f src/frontend/Dockerfile .
+# Build context is the repository root:  podman build --format docker --target dev|prod -f src/frontend/Dockerfile .
 # No secrets and no environment-specific values are baked in; runtime config comes from the environment.
 
 # --- dev: Vite dev server on 5173 (source is bind-mounted by compose for hot reload) ---
-FROM node:24-alpine AS dev
+FROM docker.io/library/node:24-alpine AS dev
 
 WORKDIR /app
 
@@ -25,7 +25,7 @@ HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s \
 CMD ["npm", "run", "dev", "-w", "@cubeclicker/frontend"]
 
 # --- build: type-agnostic production build of the SPA (vite build → dist/) ---
-FROM node:24-alpine AS build
+FROM docker.io/library/node:24-alpine AS build
 
 WORKDIR /app
 
@@ -38,7 +38,7 @@ COPY src/frontend src/frontend
 RUN npm run build -w @cubeclicker/frontend
 
 # --- prod: unprivileged nginx serving the static build on 8080 (non-root by image default) ---
-FROM nginxinc/nginx-unprivileged:1.27-alpine AS prod
+FROM docker.io/nginxinc/nginx-unprivileged:1.27-alpine AS prod
 
 COPY src/frontend/nginx.conf /etc/nginx/conf.d/default.conf
 COPY --from=build /app/src/frontend/dist/ /usr/share/nginx/html/
````

Enumeration of the diff: frontend Dockerfile {line 2 header} + {6, 28, 41 `FROM`}; `compose.smoke.yaml` {line 5 `image:`}; README {55, 56 commands} + one net-new sentence. No other line in any of the three files differs — exactly the planned T5b diff (spec-r4 mechanical enumeration).

## 3. Verify — grep pins

```
$ grep -n "FROM" src/frontend/Dockerfile
6:FROM docker.io/library/node:24-alpine AS dev
28:FROM docker.io/library/node:24-alpine AS build
41:FROM docker.io/nginxinc/nginx-unprivileged:1.27-alpine AS prod
exit=0

$ grep -nE "FROM[[:space:]]+(node|nginxinc)/" src/frontend/Dockerfile      # unqualified-token scan
(no output)
unqualified-scan exit=1 (1 = no matches)

$ grep -n "image:" compose.smoke.yaml
5:    image: docker.io/library/node:24-alpine
exit=0

$ grep -n "podman build --format docker --target prod" README.md
55:podman build --format docker --target prod -f src/backend/Dockerfile .
56:podman build --format docker --target prod -f src/frontend/Dockerfile .
exit=0
```

All three `FROM` lines are registry-qualified (`docker.io/library/node:24-alpine` ×2 for `dev`/`build`; `docker.io/nginxinc/nginx-unprivileged:1.27-alpine` for `prod`); no unqualified token remains.

## 4. Verify — `podman build --format docker` (dev, prod)

Raw transcript, dev (22 lines of steps + commit; verbatim from `/tmp/opencode/t5b-build-dev.log`):

```
STEP 1/10: FROM docker.io/library/node:24-alpine AS dev
STEP 2/10: WORKDIR /app
--> Using cache ed1df529191f62a88286bbf4e58a82a1d758ee408befd62aad65e6fb71abce04
--> ed1df529191f
STEP 3/10: COPY package.json package-lock.json tsconfig.json ./
--> Using cache 68cb20c7e99a854dff600ac844d3a6537dec9a63c4149c35fc25754066e0defc
--> 68cb20c7e99a
STEP 4/10: COPY src/backend/package.json src/backend/package.json
--> Using cache 7ae993bf4a90a891d91695a14c0a07bd68423dab6c256e3dc63e28b45a01bdde
--> 7ae993bf4a90
STEP 5/10: COPY src/frontend/package.json src/frontend/package.json
--> Using cache 7775fa135f53f0e758286c4934c7b5ef58cf805dfcb62b250a97a4ca6d320481
--> 7775fa135f53
STEP 6/10: RUN npm ci
--> Using cache a6000591230eb7dc0b0efd87d7b6fa7235714e6c9244ba956584d7441d586ff2
--> a6000591230e
STEP 7/10: COPY src/frontend src/frontend
--> 13284d1fd37a
STEP 8/10: EXPOSE 5173
--> 3af4a33c9060
STEP 9/10: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD node -e "fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
--> 5d873660b24a
STEP 10/10: CMD ["npm", "run", "dev", "-w", "@cubeclicker/frontend"]
COMMIT cubeclicker-frontend:dev-check
--> 6d5350281b1a
Successfully tagged localhost/cubeclicker-frontend:dev-check
6d5350281b1a91e3678ff55b9aac41fd820ffcddcf0949bb3d41eabaf5ab7109
```
`EXIT=0` (pipeline exit of `podman build`).

Warning scan on the dev log (the r4 failure mode — Podman 5's OCI default dropping `HEALTHCHECK`):

```
$ grep -n -i "HEALTHCHECK is not supported\|OCI image format\|WARN" /tmp/opencode/t5b-build-dev.log
(no output)
scan exit=1 (1 = no warning lines)
```

Raw transcript, prod (build stage + nginx runtime stage; verbatim from `/tmp/opencode/t5b-build-prod.log`, 45 lines):

```
[2/3] STEP 1/8: FROM docker.io/library/node:24-alpine AS build
[2/3] STEP 2/8: WORKDIR /app
--> Using cache ed1df529191f62a88286bbf4e58a82a1d758ee408befd62aad65e6fb71abce04
--> ed1df529191f
[2/3] STEP 3/8: COPY package.json package-lock.json tsconfig.json ./
--> Using cache 68cb20c7e99a854dff600ac844d3a6537dec9a63c4149c35fc25754066e0defc
--> 68cb20c7e99a
[2/3] STEP 4/8: COPY src/backend/package.json src/backend/package.json
--> Using cache 7ae993bf4a90a891d91695a14c0a07bd68423dab6c256e3dc63e28b45a01bdde
--> 7ae993bf4a90
[2/3] STEP 5/8: COPY src/frontend/package.json src/frontend/package.json
--> Using cache 7775fa135f53f0e758286c4934c7b5ef58cf805dfcb62b250a97a4ca6d320481
--> 7775fa135f53
[2/3] STEP 6/8: RUN npm ci
--> Using cache a6000591230eb7dc0b0efd87d7b6fa7235714e6c9244ba956584d7441d586ff2
--> a6000591230e
[2/3] STEP 7/8: COPY src/frontend src/frontend
--> Using cache 13284d1fd37ac4dc3c97678a16ff458ab681a305359c759b5deec8486e70db83
--> 13284d1fd37a
[2/3] STEP 8/8: RUN npm run build -w @cubeclicker/frontend

> build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 29 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                  0.32 kB │ gzip:  0.23 kB
dist/assets/index-C70WgBoq.js  223.76 kB │ gzip: 69.91 kB
✓ built in 746ms
--> 5275b8e0570a
[3/3] STEP 1/5: FROM docker.io/nginxinc/nginx-unprivileged:1.27-alpine AS prod
[3/3] STEP 2/5: COPY src/frontend/nginx.conf /etc/nginx/conf.d/default.conf
--> 5b26e009ec7c
[3/3] STEP 3/5: COPY --from=build /app/src/frontend/dist/ /usr/share/nginx/html/
--> 8dea52ddb9e8
[3/3] STEP 4/5: EXPOSE 8080
--> 03226a3ea18d
[3/3] STEP 5/5: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
[3/3] COMMIT cubeclicker-frontend:prod-check
--> 37ade370cbe6
Successfully tagged localhost/cubeclicker-frontend:prod-check
37ade370cbe6fd58d889864d850551c7a7062f446e6c4d7b681b4a95ab81abe5
```
`EXIT=0`.

Warning scan on the prod log:

```
$ grep -n -i "HEALTHCHECK is not supported\|OCI image format\|WARN" /tmp/opencode/t5b-build-prod.log
(no output)
scan exit=1 (1 = no warning lines)
```

Both builds exit 0 and neither prints the OCI-format `HEALTHCHECK` warning (in the r4-pre-amendment T5 run the prod build was `EXIT 124`/`125` on the unqualified token — `build-log-T5.md` § Divergences 1–2).

## 5. Verify — `podman image inspect` (healthcheck carried in the built images)

```
$ podman image inspect cubeclicker-frontend:dev-check cubeclicker-frontend:prod-check --format '{{.Config.Healthcheck}}'
{[CMD-SHELL node -e "fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"] 15s 0s 10s 3s 5}
{[CMD-SHELL wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1] 15s 0s 10s 3s 5}
EXIT=0

$ for t in cubeclicker-frontend:dev-check cubeclicker-frontend:prod-check; do printf '%s => ' "$t"; podman image inspect "$t" --format '{{.Config.Healthcheck}}'; done
cubeclicker-frontend:dev-check => {[CMD-SHELL node -e "fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"] 15s 0s 10s 3s 5}
cubeclicker-frontend:prod-check => {[CMD-SHELL wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1] 15s 0s 10s 3s 5}

$ podman image inspect cubeclicker-frontend:dev-check --format '{{json .Config.Healthcheck}}'
{"Test":["CMD-SHELL","node -e \"fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""],"StartPeriod":15000000000,"Interval":10000000000,"Timeout":3000000000,"Retries":5}
$ podman image inspect cubeclicker-frontend:prod-check --format '{{json .Config.Healthcheck}}'
{"Test":["CMD-SHELL","wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1"],"StartPeriod":15000000000,"Interval":10000000000,"Timeout":3000000000,"Retries":5}
```

Non-null on both tags, with the pinned values: `Interval` 10s (`10000000000` ns), `Timeout` 3s, `Retries` 5, `StartPeriod` 15s — and the pinned commands (`node -e` `/`-fetch on 5173 for dev; `wget -q -O /dev/null` on 8080 for prod).

Supporting AC-17 evidence (image shape; unchanged by r4, re-observed on the freshly built tags):

```
$ grep -n "EXPOSE\|^CMD\|^USER" src/frontend/Dockerfile
19:EXPOSE 5173
25:CMD ["npm", "run", "dev", "-w", "@cubeclicker/frontend"]
46:EXPOSE 8080

$ podman image inspect cubeclicker-frontend:prod-check --format 'User={{.Config.User}} Exposed={{.Config.ExposedPorts}} Entrypoint={{.Config.Entrypoint}}'
User=101 Exposed=map[8080/tcp:{}] Entrypoint=[/docker-entrypoint.sh]

$ podman run --rm --entrypoint id cubeclicker-frontend:prod-check
uid=101(nginx) gid=101(nginx) groups=101(nginx)
EXIT=0
```

## 6. Verify — merged compose model (`compose.yaml` + `compose.smoke.yaml`)

```
$ podman compose -f compose.yaml -f compose.smoke.yaml config -q
>>>> Executing external compose provider "/usr/local/bin/docker-compose". Please see podman-compose(1) for how to disable this message. <<<<

EXIT=0

$ podman compose -f compose.yaml -f compose.smoke.yaml config --format json | node -e '…'
services: ["backend","frontend","smoke"]
smoke.image: docker.io/library/node:24-alpine
MERGED-MODEL CHECK: PASS
EXIT=0
```

Checker body: parses the merged JSON, asserts `Object.keys(services).sort()` = `["backend","frontend","smoke"]` and `services.smoke.image === "docker.io/library/node:24-alpine"`; non-zero exit otherwise.

Positive control that the smoke service is opt-in only (contract 6 — it must never start on a plain `podman compose up`):

```
$ podman compose config --format json 2>/dev/null | node -e '…services…'
services: ["backend","frontend"]
```

## 7. Verify — scope (no out-of-scope edits)

```
$ git status --short
 M README.md
 M compose.smoke.yaml
 M docs/features/README.md
 M docs/features/project-glossary/status.md
 M src/backend/Dockerfile
 M src/frontend/Dockerfile
?? docs/features/stack-selection/plan.md
?? docs/features/stack-selection/reviews/
?? docs/features/stack-selection/spec.md
?? docs/features/stack-selection/status.md
?? docs/features/stack-selection/tasks.md

$ git diff HEAD --name-only -- src/frontend/Dockerfile compose.smoke.yaml README.md
README.md
compose.smoke.yaml
src/frontend/Dockerfile
```

Interpretation: `src/backend/Dockerfile` is the concurrent T4b partner's change (disjoint `files_owned`; never staged here); `docs/features/README.md` and `docs/features/project-glossary/status.md` are the pre-existing orchestrator-owned dirt recorded in `build-log-T4.md` § 1 (left untouched/unstaged); the untracked `plan/spec/tasks/status/reviews` are this feature's artifacts owned by the orchestrator/planner/reviewer. My diff is limited to the three `files_owned` paths above; no manifest/lockfile edit, no `.env*`, no permission content.

## 8. Acceptance audit (self-audit)

- **AC-12** → met (T5b portion). README production-image commands now pinned as `podman build --format docker --target prod -f src/{backend,frontend}/Dockerfile .` (§3 grep, both lines 55/56) with the one-sentence `HEALTHCHECK` rationale (§2 diff). The remaining AC-12 items (prerequisites, quickstart + URLs, commands table, env table, first-run/rebuild note, stack summary + doc links) are T3-owned and unchanged — §7 confirms no other README line differs (`git diff HEAD` shows only lines 55–56 + one net-new sentence).
- **AC-14** → met. `compose.smoke.yaml` smoke service carries `image: docker.io/library/node:24-alpine` (§3), `tests/e2e` mounted read-only, `node smoke.mjs`, `depends_on: [backend, frontend]` (unchanged context in §2); merged model `podman compose -f compose.yaml -f compose.smoke.yaml config -q` exits 0 and the merged service set is `backend`/`frontend`/`smoke` (§6).
- **AC-17** → met. Multi-stage `dev`/`prod` targets both build via `podman build --format docker --target dev|prod` (EXIT 0, no OCI `HEALTHCHECK` warning — §4); every `FROM` registry-qualified (`docker.io/library/node:24-alpine` for dev/build, `docker.io/nginxinc/nginx-unprivileged:1.27-alpine` for prod — §3); dev serves the Vite dev server on `5173` (EXPOSE 5173 + pinned `CMD npm run dev` — §5); prod serves the built `dist/` as non-root nginx on `8080` (`EXPOSE 8080`, runtime `uid=101(nginx)`, `nginx.conf` SPA fallback unchanged — §5) with the `HEALTHCHECK` carried in the built images by the pinned `podman build --format docker` form (non-null, pinned values — §5).
- **AC-32** → met. The diff vs. the task's build-start baseline (= the committed pre-amendment state at HEAD, §1) contains only the pinned in-place modifications of `plan.md` § Amendment trace rows for T5b (frontend Dockerfile `FROM`s + header; `compose.smoke.yaml` smoke image token; README prod commands + rationale sentence) plus this build log — §2 enumeration, §7 scope check. No unrelated edits.

## 9. Deviations from spec

None. Applied only the pinned r4 tokens/lines; no manifest/lockfile edits; nothing outside `files_owned`; the pre-existing dirty feature artifacts were left untouched and unstaged. Two observations (not deviations, no action): (a) the brief's baseline pointers (frontend Dockerfile + `compose.smoke.yaml` at `9d10881`, README at `207d642`) match the `git diff HEAD` baseline bytes exactly (§1); (b) `podman image inspect <two tags> --format '{{.Name}}…'` is not a valid template under Podman 5.8.7 (`can't evaluate field Name`) — the pinned `'{{.Config.Healthcheck}}'` form works and was used verbatim (§5).
