# Build log — T2 verification — Redeploy Render from pushed `main` and run the deployed smoke

Task: T2 verification round (2026-11-16)
Files changed: `docs/features/render-backend-migration/build-log-T2-smoke.md` (this log only; no source, workflow, container, or config file touched)
What changed & why: Nothing in the repository. Rebuilt the Render development service from the pushed `origin/main` tip, warmed the free instance, and re-ran the deployed smoke against the fixed backend to close the check-8 failure recorded in `build-log-T2-vercel.md`.

## 1. Remote `main` contains the origin fix

```
$ git fetch origin
$ git log --oneline origin/main -5
ec9949d docs
e6a7afd fix: reject disallowed websocket origins before upgrade
fc5babe feat: deploy render development backend
3fecb37 docs: record fly development deploy blocker
7232648 docs: record development provisioning

$ git merge-base --is-ancestor e6a7afd origin/main
e6a7afd IS ancestor of origin/main

$ git rev-parse origin/main
ec9949dc1880bc368b117aa923acf90cdfd32890

$ git show origin/main:src/backend/src/app.ts | grep -n 'origin_not_allowed'
360:        await reply.code(403).send({ message: 'origin not allowed', code: 'origin_not_allowed' });
```

Local `HEAD` equals `origin/main` (`ec9949dc1880bc368b117aa923acf90cdfd32890`); no divergence.

## 2. GitHub `development` environment

```
$ gh api repos/raultorres2603/CubeClicker/environments --jq '.environments[] | .name'
development
production

$ gh secret list --env development --repo raultorres2603/CubeClicker
RENDER_DEPLOY_HOOK_URL	2026-11-16T10:05:54Z
VERCEL_TOKEN	2026-11-16T10:05:05Z
```

Both required names are present in the `development` environment. Names only; values were never read or printed.

## 3. Render deploy

Service `srv-dbtcvv9srm7s73au5bag` (`cubeclicker-development`, free, frankfurt, Docker, `src/backend/Dockerfile`, branch `main`), workspace `tea-cspt720gph6c739lkvs0`. `autoDeploy` is `off`, so the deploy was triggered explicitly.

```
tools.render.trigger_deploy({ workspaceId: "tea-cspt720gph6c739lkvs0",
                              serviceId: "srv-dbtcvv9srm7s73au5bag",
                              clearCache: false })
→ id            dep-dbtdbrdckfvc73eh5c9g
  status        build_in_progress (accepted)
  commit.id     ec9949dc1880bc368b117aa923acf90cdfd32890
  commit.msg    docs
  trigger       api
  createdAt     2026-11-16T10:07:41.609111Z
```

Final state (`tools.render.get_deploy`):

```
id            dep-dbtdbrdckfvc73eh5c9g
status        live
commit.id     ec9949dc1880bc368b117aa923acf90cdfd32890
createdAt     2026-11-16T10:07:41.609111Z
finishedAt    2026-11-16T10:08:27.415714Z
trigger       api
```

Service events (`tools.render.list_events`, 2026-11-16T10:07:00Z onward):

```
10:07:41.855Z build_started   bld-dbtdbrdckfvc73eh5ca0
10:08:14.434Z build_ended     buildStatus=succeeded
10:08:27.498Z deploy_ended    deployStatus=succeeded, status=2
```

Build log (`tools.render.list_logs`, ANSI stripped) confirming the checked-out commit:

```
==> Cloning from https://github.com/raultorres2603/CubeClicker
==> Checking out commit ec9949dc1880bc368b117aa923acf90cdfd32890 in branch main
#1 [internal] load build definition from Dockerfile
...
==> Your service is live 🎉
==> Available at your primary URL https://cubeclicker-development.onrender.com
```

No failure events; `list_logs`/`list_events` contained no `server_failed`/`image_pull_failed` entry.

## 4. Health warm-up

Node `fetch` loop on `https://cubeclicker-development.onrender.com/healthz`, 120 s budget:

```
attempt=1 status=200 ms=162 body={"status":"ok"}
HEALTH OK
exit=0
```

## 5. Deployed smoke

Command (the pinned contract, verbatim):

```
SMOKE_FRONTEND_URL=https://cubeclicker-development.vercel.app \
SMOKE_API_URL=https://cubeclicker-development.onrender.com \
SMOKE_WS_URL=wss://cubeclicker-development.onrender.com/ws \
SMOKE_ORIGIN=https://cubeclicker-development.vercel.app \
node tests/e2e/deployed-smoke.mjs
```

Run 1:

```
deployed smoke: frontend=https://cubeclicker-development.vercel.app api=https://cubeclicker-development.onrender.com ws=wss://cubeclicker-development.onrender.com/ws origin=https://cubeclicker-development.vercel.app timeoutMs=10000
PASS backend /healthz returns 200 with {"status":"ok"} — 200 {"status":"ok"}
PASS CORS preflight from https://cubeclicker-development.vercel.app is allowed — 204; access-control-allow-origin https://cubeclicker-development.vercel.app
PASS CORS preflight from https://disallowed.invalid is rejected — 403 origin_not_allowed without access-control-allow-origin
PASS frontend / serves the SPA shell with no-cache — 200 text/html; cache-control no-cache
PASS frontend /deep/link serves the SPA fallback — 200 text/html SPA fallback
PASS frontend /assets/does-not-exist.js is a real 404 — 404 without the SPA shell
PASS WebSocket at wss://cubeclicker-development.onrender.com/ws accepts Origin https://cubeclicker-development.vercel.app: hello, guest join, explode — hello -> welcome server 1 -> miniCubeRemoved front:0:0
PASS WebSocket rejects a disallowed Origin before the upgrade (HTTP 403 or close 1008) — HTTP 403 before the upgrade ({"message":"origin not allowed","code":"origin_not_allowed"}), no hello
DEPLOYED SMOKE PASS (8/8 checks)
exit=0
```

Run 2 (repeat, same command, tail):

```
PASS frontend /assets/does-not-exist.js is a real 404 — 404 without the SPA shell
PASS WebSocket at wss://cubeclicker-development.onrender.com/ws accepts Origin https://cubeclicker-development.vercel.app: hello, guest join, explode — hello -> welcome server 1 -> miniCubeRemoved front:0:0
PASS WebSocket rejects a disallowed Origin before the upgrade (HTTP 403 or close 1008) — HTTP 403 before the upgrade ({"message":"origin not allowed","code":"origin_not_allowed"}), no hello
DEPLOYED SMOKE PASS (8/8 checks)
```

### Corroborating backend logs (same run)

```
{"level":30,...,"reqId":"req-7","req":{"method":"GET","url":"/ws",...},"msg":"incoming request"}
{"level":30,...,"connectionId":"req-7","msg":"ws_connection_opened"}
{"level":30,...,"reqId":"req-8","req":{"method":"GET","url":"/ws",...},"msg":"incoming request"}
{"level":30,...,"reqId":"req-8","res":{"statusCode":403},"responseTime":0.535...,"msg":"request completed"}
```

The disallowed-Origin upgrade is now denied with `403` **before** the `101`, so the Render free edge no longer has to relay a post-upgrade close frame — the check-8 failure from `build-log-T2-vercel.md` is resolved at the edge. Startup logs show `CubeClicker backend listening on http://0.0.0.0:8080 (WebSocket ws://0.0.0.0:8080/ws)`; the only warning is the known `pg-connection-string` `sslmode` deprecation notice.

## Acceptance audit

1. `origin/main` contains `e6a7afd` and the pre-upgrade `origin_not_allowed` gate → **met** (SHA, ancestry check, `app.ts:360` above).
2. `development` environment with `VERCEL_TOKEN` + `RENDER_DEPLOY_HOOK_URL` → **met** (names only, section 2).
3. Render deploy triggered, ended successfully → **met** (`dep-dbtdbrdckfvc73eh5c9g` live, build succeeded, commit `ec9949d`).
4. `/healthz` 200 `{"status":"ok"}` within 120 s → **met** (attempt 1, 162 ms).
5. Deployed smoke `DEPLOYED SMOKE PASS (8/8 checks)` → **met** (two runs).
6. This log → **met**; no secret values recorded.
7. Remaining CI blockers reported → **met** (below).

## Remaining CI blockers (unchanged by this run)

1. **Workflow still deploys Fly.** `.github/workflows/deploy.yml` keeps the `FLY_*` env block (`vars.FLY_APP_NAME`, `vars.FLY_REGION`), the `Setup flyctl` step, `flyctl secrets set` and `flyctl deploy --config fly.config.toml` (lines 35–46, 64–94). The Render deploy-hook step replacing them is still to be written.
2. **GitHub environment variables are empty.** `gh variable list --env development` and `--env production` return nothing (also nothing at repo level), so `vars.FRONTEND_ORIGIN`, `vars.VITE_API_URL`, `vars.VITE_WS_URL`, `vars.VERCEL_ORG_ID`, `vars.VERCEL_PROJECT_ID` and the Render equivalents are unset. The `production` environment has no secrets at all.
3. **Database secrets for CI.** `secrets.DATABASE_URL` / `secrets.DIRECT_DATABASE_URL` are not present in either environment (the workflow's migration step would fail).
4. **Free-tier cold start.** The instance is hibernated when idle; a CI smoke must warm `GET /healthz` first or raise `SMOKE_TIMEOUT_MS`, otherwise the first check can exceed the 10 s per-check budget.
5. **SMTP.** The Render service still carries placeholder `SMTP_*` values; deployed verification email delivery remains unimplemented.

## Repo gates at the deployed SHA

The deployed commit `ec9949d` is the local tree (`git status --short` clean apart from this log), so the workspace gates were run as supporting evidence; the smoke above is the feature-appropriate live proof. No unit/integration test was added or changed by this task because no production code changed — the origin-guard tests for `e6a7afd` are already in `src/backend/src/app.test.ts` and were green before the deploy.

```
$ npm run lint
> eslint .
lint_exit=0

$ npm run typecheck
> tsc --noEmit   (backend)
> tsc --noEmit   (frontend)
typecheck_exit=0

$ npm run coverage
@cubeclicker/backend   Test Files 37 passed (37)  Tests 1507 passed (1507)
  All files            | 96.15 | 89.81 | 99.57 | 96.15 |
@cubeclicker/frontend  Test Files 74 passed (74)  Tests 2248 passed (2248)
  All files            | 96.63 | 96.35 | 97.80 | 96.63 |
coverage_exit=0
```

## Deviations from spec

None. No source modified, nothing pushed, no secret values printed, no paid resources created.
