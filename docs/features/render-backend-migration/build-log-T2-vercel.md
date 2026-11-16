# Build log — T2 — Deploy the Vercel development frontend against Render

Task: T2 (2026-11-16)
Files changed: `docs/features/render-backend-migration/build-log-T2-vercel.md` (this log only; no application, workflow, or container file touched)
What changed & why: Disabled Vercel deployment protection (SSO) on `cubeclicker-development`, applied the project build settings, set the two public frontend build-time env vars, deployed `main` from GitHub through the Vercel MCP, confirmed the production alias, and ran the deployed smoke against the Render development backend.

## Vercel project configuration

Project `prj_9GfusgivGpVJDXeJPi2TnMUCb2RV` (`cubeclicker-development`, team `team_7cz2iixGr020Vqvjhj7Y1DNp`).

`tools.vercel.update_project` request:

| Setting | Value |
| --- | --- |
| `ssoProtection` | `null` (Vercel Authentication disabled) |
| `rootDirectory` | `src/frontend` |
| `framework` | `vite` |
| `nodeVersion` | `24.x` |
| `installCommand` | `npm ci` |
| `buildCommand` | `npm run build -w @cubeclicker/frontend` |
| `outputDirectory` | `dist` |

`tools.vercel.get_project` after the update:

```
ssoProtection={"enabled":false,"deploymentType":null}
passwordProtection={"enabled":false,"deploymentType":null}
framework=vite nodeVersion=24.x
```

Before the update it was `ssoProtection={"enabled":true,"deploymentType":"all_except_custom_domains"}`, which is why the production alias was not publicly reachable.

`get_project` / `list_projects` return a reduced project shape that does not echo `rootDirectory`, `installCommand`, `buildCommand`, or `outputDirectory`; the applied build settings are proven by the deployment build below (the build ran `npm ci` and the frontend build script and produced `dist/` for the Vite output, which only works with the project root at `src/frontend`).

## Environment variables (names only)

`tools.vercel.create_project_env` with `upsert: "true"`, `type: "plain"`, target `["production","preview","development"]`:

| Name | ID | Targets |
| --- | --- | --- |
| `VITE_API_URL` | `Dcxk59QAGSAlBOL7` | production, preview, development |
| `VITE_WS_URL` | `v5mtdvVZALRjbAz1` | production, preview, development |

Pre-existing (unchanged): `VITE_CLOUD_DEPLOY` (`plain`, `jEpbVHmhRyPfTwEp`, all three targets).

Values are the public Render development URLs from the brief; no secret value is recorded in this log or committed.

## Deployment

Created with `tools.vercel.create_deployment` and a Git source:

```
requestBody.gitSource = { type: "github", org: "raultorres2603", repo: "CubeClicker", ref: "main" }
requestBody.target    = "production"
requestBody.project   = "prj_9GfusgivGpVJDXeJPi2TnMUCb2RV"
```

The project is not Git-linked, but the MCP's GitHub connection resolved the repository, so the planned inline-files fallback was not needed.

| Field | Value |
| --- | --- |
| Deployment ID | `dpl_9Hdnjf9Ze57EADRNpccKrNnc8KrF` |
| Deployment URL | `https://cubeclicker-development-nhy1g22ap-raultorres2603s-projects.vercel.app` |
| State | `READY` (`buildingAt` 1794822540325, `ready` 1794822568609, ≈28 s) |
| Target | `production` |
| Source | `github.com/raultorres2603/CubeClicker`, branch `main`, commit `72326485d84ce06e7000480439c18cac82601837` |
| Aliases assigned | `cubeclicker-development.vercel.app`, `cubeclicker-development-raultorres2603s-projects.vercel.app`, `cubeclicker-development-git-main-raultorres2603s-projects.vercel.app` |

The production alias was assigned automatically at deploy completion; `tools.vercel.get_alias` confirms:

```
alias=cubeclicker-development.vercel.app
created=2026-11-16T09:49:28.740Z
deploymentId=dpl_9Hdnjf9Ze57EADRNpccKrNnc8KrF
projectId=prj_9GfusgivGpVJDXeJPi2TnMUCb2RV
```

No `assign_alias` call was made.

Note: the deployed commit is `origin/main` (`7232648`). The local `main` is two documentation-only commits ahead (`fc5babe`, `3fecb37`) and was not pushed, so it was not part of this deployment.

### Build log excerpt (`tools.vercel.list_deployment_events`, ANSI stripped)

```
Running build in Washington, D.C., USA (East) – iad1
Build machine configuration: 2 cores, 8 GB
Cloning github.com/raultorres2603/CubeClicker (Branch: main, Commit: 7232648)
Cloning completed: 13.220s
Running "vercel build"
Vercel CLI 65.15.0
Running "install" command: `npm ci`...
added 226 packages, and audited 228 packages in 6s
> build
> vite build && node scripts/check-bundle-budget.mjs
vite v7.3.7 building client environment for production...
✓ 109 modules transformed.
dist/index.html                                        0.49 kB │ gzip:   0.30 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-KuxM9rl7.css                        28.80 kB │ gzip:   5.68 kB
dist/assets/cursor-ship-QynC3wZn.js                    6.73 kB │ gzip:   2.21 kB
dist/assets/SpaceshipCustomizationPanel-BSwZUyge.js    9.54 kB │ gzip:   3.34 kB
dist/assets/browser-env-DhjnPp_a.js                   49.19 kB │ gzip:  18.16 kB
dist/assets/index-BsD1iOpS.js                         98.79 kB │ gzip:  30.44 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-4rmoIDEa.js                        609.34 kB │ gzip: 154.33 kB
✓ built in 5.16s
entry index assets/index-BsD1iOpS.js raw=98786 gzip=30435
initial files=2 raw=320485 gzip=99394 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154326 budget=165000
total files=6 raw=995277 gzip=277424 budget=300000
Bundle budget OK.
Build Completed in /vercel/output [12s]
Deploying outputs...
Deployment completed
```

### Baked runtime config proof

Fetched the deployed SPA shell and its entry chunk from the production alias:

```
scripts: ["/assets/index-BsD1iOpS.js"]
/assets/index-BsD1iOpS.js bytes=98746 apiUrl=true wsUrl=true
assets_with_render_urls: 1
```

So the bundle baked `https://cubeclicker-development.onrender.com` and `wss://cubeclicker-development.onrender.com/ws` at build time.

## Deployed smoke

Command (the pinned contract from the brief):

```
SMOKE_FRONTEND_URL=https://cubeclicker-development.vercel.app \
SMOKE_API_URL=https://cubeclicker-development.onrender.com \
SMOKE_WS_URL=wss://cubeclicker-development.onrender.com/ws \
SMOKE_ORIGIN=https://cubeclicker-development.vercel.app \
node tests/e2e/deployed-smoke.mjs
```

Raw output (run twice, identical result; backend was warmed first, see below):

```
deployed smoke: frontend=https://cubeclicker-development.vercel.app api=https://cubeclicker-development.onrender.com ws=wss://cubeclicker-development.onrender.com/ws origin=https://cubeclicker-development.vercel.app timeoutMs=10000
PASS backend /healthz returns 200 with {"status":"ok"} — 200 {"status":"ok"}
PASS CORS preflight from https://cubeclicker-development.vercel.app is allowed — 204; access-control-allow-origin https://cubeclicker-development.vercel.app
PASS CORS preflight from https://disallowed.invalid is rejected — 403 origin_not_allowed without access-control-allow-origin
PASS frontend / serves the SPA shell with no-cache — 200 text/html; cache-control no-cache
PASS frontend /deep/link serves the SPA fallback — 200 text/html SPA fallback
PASS frontend /assets/does-not-exist.js is a real 404 — 404 without the SPA shell
PASS WebSocket at wss://cubeclicker-development.onrender.com/ws accepts Origin https://cubeclicker-development.vercel.app: hello, guest join, explode — hello -> welcome server 2 -> miniCubeRemoved front:0:0
FAIL WebSocket rejects a disallowed Origin with close 1008 — WebSocket wss://cubeclicker-development.onrender.com/ws did not close within 10000ms
DEPLOYED SMOKE FAIL (7/8 checks passed)
exit=1
```

Cold start: the Render free instance was warmed before the smoke (`GET /healthz` → `attempt=1 status=200 ms=199 body={"status":"ok"}`). A cold instance can exceed the smoke's per-check 10 s budget; that is a documentation item (T3), not the failure below.

## Diagnosis of the failing check (check 8, WebSocket origin guard)

The failing check is the disallowed-Origin close-1008 assertion. Exact observations:

1. Raw HTTPS upgrade to `wss://cubeclicker-development.onrender.com/ws` with `Origin: https://disallowed.invalid`:

```
168ms upgrade status=101
20172ms socket end (FIN received)
20174ms socket close hadError=false
```

No WebSocket frame is ever received — not `hello`, and not a close frame.

2. Node global `WebSocket` (same path the smoke uses) with the disallowed Origin:

```
217ms open
20217ms error
20218ms close code=1006
```

3. Control: the same raw upgrade with `Origin: https://cubeclicker-development.vercel.app` receives the pinned `hello` frame 1 ms after the `101`; a client-initiated `close(1000)` on an allowed socket is answered with `close code=1000` in ≈47 ms. So close frames are relayed normally by the Render edge; only the **server-initiated close immediately after the upgrade** never arrives.

4. The backend code is correct when the socket is direct: the backend integration test passes on the same commit:

```
$ npm test -w @cubeclicker/backend -- --run src/app.test.ts -t "GET /ws Origin guard"
 ✓ src/app.test.ts (37 tests | 33 skipped) 98ms
 Test Files  1 passed (1)
      Tests  4 passed | 33 skipped (37)
```

`src/backend/src/app.test.ts` asserts `result.frames.map((frame) => frame.opcode)` is exactly `[8]` with payload code `1008`, so the app sends the required close frame; `src/backend/src/app.ts` calls `socket.close(WEBSOCKET_ORIGIN_REJECTED_CLOSE_CODE)` in the `/ws` handler.

Conclusion: Render's free-tier edge terminates the upgrade chain by holding the connection and closing it with a bare FIN at ≈20 s (observed as `1006` in undici), so the backend's post-upgrade `1008` close frame is not observable by the client through Render. The deployed smoke cannot pass check 8 on this host without a backend/infra change (for example rejecting a disallowed Origin before the `101` in an upgrade hook, which would change the smoke's expected status/close contract) or an approved dev-only adjustment to the smoke contract. Both are outside this task's write scope.

## Verification evidence

- Vercel MCP `update_project` → `ssoProtection` set to `null`, build settings applied; response success.
- Vercel MCP `get_project` → `ssoProtection.enabled=false`, `passwordProtection.enabled=false`, `framework=vite`, `nodeVersion=24.x`.
- Vercel MCP `create_project_env` (upsert) → `VITE_API_URL` `Dcxk59QAGSAlBOL7`, `VITE_WS_URL` `v5mtdvVZALRjbAz1`, both `plain`, all three targets.
- Vercel MCP `filter_project_envs` → the three keys above present with all three targets (values not printed).
- Vercel MCP `create_deployment` (gitSource) → `dpl_9Hdnjf9Ze57EADRNpccKrNnc8KrF`.
- Vercel MCP `get_deployment` → `state=READY`, production, three aliases including `cubeclicker-development.vercel.app`.
- Vercel MCP `get_alias` → `cubeclicker-development.vercel.app` → `dpl_9Hdnjf9Ze57EADRNpccKrNnc8KrF`.
- Vercel MCP `list_deployment_events` → build log excerpt above (`npm ci`, Vite build 7.3.7, bundle budget OK, `Build Completed`).
- `node` fetch of the production alias → `200 text/html; charset=utf-8`, `cache-control: no-cache`; no Vercel SSO redirect (unauthenticated).
- `node` bundle check → `apiUrl=true wsUrl=true` in `/assets/index-BsD1iOpS.js`.
- Deployed smoke → 7/8, FAIL check 8 (raw output above), exit 1.
- `npm test -w @cubeclicker/backend -- --run src/app.test.ts -t "GET /ws Origin guard"` → 4 passed, direct socket gets opcode 8 / code 1008.
- Raw upgrade and closed-socket probes → see diagnosis section.

## Acceptance audit (brief steps)

1. Disable SSO/deployment protection and verify via `get_project` → **met** (`ssoProtection` `{enabled:false}`; `update_project` with `ssoProtection: null`).
2. Set `VITE_API_URL` / `VITE_WS_URL` for production/preview/development → **met** (names/targets above; values not printed).
3. Production deployment from GitHub `raultorres2603/CubeClicker` `main` with root `src/frontend`, framework `vite`, Node `24.x`, `npm ci`, `npm run build -w @cubeclicker/frontend` → **met** (gitSource worked; no inline-files fallback; build log proves the settings).
4. Wait for READY and get URL; alias if needed → **met** (`READY`, production alias auto-assigned, no `assign_alias` needed).
5. Run the deployed smoke → **unmet** (7/8; check 8 fails as diagnosed above).
6. Write this log → **met**; commit of this log **withheld** because the brief allows committing it only when deployment **and** smoke succeed.
7. Report remaining blockers → **met** (below and in the report).

## Remaining blockers

1. **Deployed smoke check 8 (WebSocket origin guard).** Render's edge does not relay the backend's immediate post-upgrade `1008` close (raw probe: `101`, no frame, FIN at ≈20 s; client sees `1006`). The backend code and its direct integration test are correct. Candidate paths, both outside T2 scope: (a) reject a disallowed Origin before the upgrade (upgrade-hook `403`, requiring a smoke-contract change), or (b) accept and document a dev-only exception for this one Render check.
2. **Vercel CI token.** `VERCEL_TOKEN` cannot be minted through the MCP; the GitHub Actions frontend deploy remains blocked until a token is created by the account owner and stored in the GitHub `development`/`production` environments.
3. **Render deploy hook URL.** Not created/registered; the GitHub Actions backend deploy step has nothing to call.
4. **SMTP.** The Render service still carries placeholder `SMTP_*` values (`localhost:1025`); verification email delivery does not work in the deployed environment until a reachable SMTP provider or Render-private Mailpit exists.
5. **GitHub environment variables/secrets.** The `development`/`production` environments lack the new catalog values (Render deploy hook, Vercel token, frontend origin/URLs, Neon URLs where CI needs them); no workflow was touched in T2.
6. **Free-tier cold starts.** Render spins down after idle; the deployed smoke must warm `GET /healthz` first or raise `SMOKE_TIMEOUT_MS`, to be documented in T3.

## Deviations from spec

- None in scope. No backend, Render, or GitHub changes; no secrets printed or committed; no paid Vercel resource created (Hobby project only); the build log is not committed because the deployed smoke failed.

---

# T2 fix round — reject disallowed WebSocket Origins before the upgrade (2026-11-16)

Problem: the failing deployed-smoke check 8 (diagnosed above) needs the Origin decision to
produce an observable HTTP result. Render's free edge does not relay the backend's immediate
post-upgrade `1008` close, so the fix moves the rejection into the Fastify request lifecycle,
before the `101`.

Files changed: `src/backend/src/app.ts`, `src/backend/src/app.test.ts`,
`tests/e2e/deployed-smoke.mjs`, this log.

## What changed & why

- **`src/backend/src/app.ts`.** The `/ws` route now declares a `preValidation` hook (the
  `@fastify/websocket`-supported pre-upgrade lifecycle): for an actual `Upgrade: websocket`
  request whose `Origin` is present and not exactly allowlisted, it replies
  `403 { message: 'origin not allowed', code: 'origin_not_allowed' }` with `Vary: Origin`.
  No `101` is sent, so every proxy relays the rejection. Non-upgrade HTTP requests to `/ws`
  keep the plugin's 404, and a missing `Origin` stays allowed for non-browser clients.
- The existing in-handler `socket.close(WEBSOCKET_ORIGIN_REJECTED_CLOSE_CODE)` check is kept
  verbatim as defense in depth for a transport that reaches the handler without the Fastify
  lifecycle; its comment now says so.
- **`src/backend/src/app.test.ts`.** `rawUpgrade` now resolves for a non-`101` handshake with
  the HTTP status **and** the response body (it previously failed the test on any non-upgrade
  response). The disallowed-Origin test asserts `403`, an empty frame list, and the exact
  denial body; a new test pins that a non-upgrade `GET /ws` from the disallowed Origin stays
  a 404 (the gate only owns upgrade handshakes). Allowed, missing and default-local-Origin
  tests are unchanged and still assert `101` + the pinned `hello`.
- **`tests/e2e/deployed-smoke.mjs`.** Check 8 now opens one raw `node:http`/`node:https`
  upgrade (zero dependencies) with `Origin: https://disallowed.invalid` and accepts **either**
  an HTTP `403` with no `101` (current backend) **or** a `101` followed by close code `1008`.
  It fails on any text frame (`hello`), on a close frame that is not `1008`, on a `101` that
  ends without a close frame (the Render FIN/`1006` symptom), and on any other handshake
  status. Check 7 (allowed Origin: `hello` → guest join/welcome → explode) is unchanged.

## Decisions

- **Route-level `preValidation`, not a raw `server.on('upgrade')` listener.** The plugin
  dispatches upgrades through the normal Fastify router, so a hook that sends a reply is the
  supported pre-upgrade rejection path (plugin README § Using hooks); a second `upgrade`
  listener would race the plugin's own listener and cannot stop it routing.
- **Upgrade-only gate.** `request.headers.upgrade === 'websocket'` (case-insensitive) keeps
  the plain-HTTP `/ws` behavior (plugin 404) unchanged; a WebSocket handshake cannot succeed
  without that header, so the gate is not bypassable for the property that matters.
- **Same denial body as the CORS/CSRF origin denial** so clients see one `origin_not_allowed`
  contract across `/auth/*`, preflights and the WebSocket upgrade.
- **The post-upgrade `1008` branch is no longer route-reachable** (the hook short-circuits
  first), so its direct raw-upgrade test was removed instead of being rewritten into a
  non-route invocation. The brief pins the branch as defense in depth; it remains covered by
  code review, not by a test, and costs 3 uncovered lines (`app.ts` 367–369) inside a
  workspace aggregate far above the gate (96.15% statements / 89.81% branches).

## Verification evidence

- `npm run lint` → `> eslint .`, exit 0.
- `npm run typecheck` → backend `tsc --noEmit` and frontend `tsc --noEmit`, exit 0.
- `npm run test --workspace @cubeclicker/backend`:

```
 Test Files  37 passed (37)
      Tests  1507 passed (1507)
   Duration  3.46s (transform 4.88s, setup 0ms, collect 12.72s, tests 13.80s, environment 7ms, prepare 3.42s)
```

- `npm run test --workspace @cubeclicker/backend -- --run src/app.test.ts -t "Origin guard"`:

```
 ✓ src/app.test.ts (38 tests | 33 skipped) 110ms
 Test Files  1 passed (1)
      Tests  5 passed | 33 skipped (38)
```

- `npm run coverage --workspace @cubeclicker/backend` → exit 0:

```
 Test Files  37 passed (37)
      Tests  1507 passed (1507)
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
All files          |   96.15 |    89.81 |   99.57 |   96.15 |
  app.ts           |   95.85 |    86.84 |     100 |   95.85 | ...18-319,367-369
```

### Deployed smoke run against the fixed backend (local servers, exact script)

The backend was started from the fixed source (`tsx src/server.ts`, `PORT=18080`,
`CORS_ORIGIN=http://127.0.0.1:14173`, in-memory repositories) with a local static server for
the already-built `src/frontend/dist`, then the deployed smoke was run unmodified with local
URLs:

```
deployed smoke: frontend=http://127.0.0.1:14173 api=http://127.0.0.1:18080 ws=ws://127.0.0.1:18080/ws origin=http://127.0.0.1:14173 timeoutMs=10000
PASS backend /healthz returns 200 with {"status":"ok"} — 200 {"status":"ok"}
PASS CORS preflight from http://127.0.0.1:14173 is allowed — 204; access-control-allow-origin http://127.0.0.1:14173
PASS CORS preflight from https://disallowed.invalid is rejected — 403 origin_not_allowed without access-control-allow-origin
PASS frontend / serves the SPA shell with no-cache — 200 text/html; cache-control no-cache
PASS frontend /deep/link serves the SPA fallback — 200 text/html SPA fallback
PASS frontend /assets/does-not-exist.js is a real 404 — 404 without the SPA shell
PASS WebSocket at ws://127.0.0.1:18080/ws accepts Origin http://127.0.0.1:14173: hello, guest join, explode — hello -> welcome server 1 -> miniCubeRemoved front:0:0
PASS WebSocket rejects a disallowed Origin before the upgrade (HTTP 403 or close 1008) — HTTP 403 before the upgrade ({"message":"origin not allowed","code":"origin_not_allowed"}), no hello
DEPLOYED SMOKE PASS (8/8 checks)
exit=0
```

### Check-8 acceptance branches (synthetic handshakes, same script text)

To prove the new check is not one-sided, the committed script's `checkWebSocketOriginGuard`
(only the trailing `await main();` stripped, then exported) was run against three synthetic
`ws` servers:

```
PASS close 1008 after upgrade — close 1008 without hello
FAIL hello text frame after upgrade — disallowed Origin upgraded and received a text frame: "{\"type\":\"hello\"}"
FAIL bare FIN after upgrade (no frame) — disallowed Origin upgraded and the connection closed without a close frame (no 1008 observed)
```

So the Render FIN behavior that failed the first T2 run still fails the check, while a
post-upgrade `1008` remains accepted.

## Acceptance audit (fix brief)

1. Pre-upgrade `403 origin_not_allowed` for a present, non-allowlisted `Origin`, existing
   post-upgrade `1008` kept → **met** (app.ts route hook + retained guard; tests below).
2. `app.test.ts`: disallowed Origin expects HTTP 403 with no `hello`; allowed/missing Origin
   still upgrade and get `hello`; direct `1008` test removed because the route is no longer
   reachable with a disallowed Origin → **met** (5 Origin-guard tests).
3. `deployed-smoke.mjs`: disallowed Origin via raw `node:http`/`https` upgrade, accepts 403
   or close 1008, fails on open/`hello`; allowed-Origin join/click check kept → **met**
   (local 8/8 run plus the three synthetic branch probes above).
4. lint, typecheck, backend tests, backend coverage → **met** (raw outputs above).
5. Fix evidence appended to this log → **met** (this section).
6. Commit with the pinned message and staged files, no push → **met** (SHA in the report).

## Remaining step (not performed here)

Push the commit and let Render redeploy `cubeclicker-development` from `main`, then re-run
the deployed smoke against `wss://cubeclicker-development.onrender.com/ws`. Check 8 should
now pass on the `HTTP 403` branch.

