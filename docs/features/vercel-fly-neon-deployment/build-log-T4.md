# Build log — T4 — Zero-dependency deployed smoke script

Task: T4 (2026-11-13) — `docs/features/vercel-fly-neon-deployment/tasks.md`
Files changed:
- `tests/e2e/deployed-smoke.mjs` (new)
- `docs/features/vercel-fly-neon-deployment/build-log-T4.md` (this log)

What changed & why (≤5 lines):
- Added the plan contract 9 deployed smoke: Node 24 built-ins/globals only, no npm dependency, no import.
- Eight fail-fast checks: backend `/healthz`; allowed CORS preflight (exact allow headers); disallowed preflight rejection; frontend `/` shell + `no-cache`; `/deep/link` SPA fallback; `/assets/does-not-exist.js` 404; WebSocket allowed-Origin `hello` → guest `join`/`welcome` → level-0 `explode` ack; WebSocket disallowed-Origin close `1008` with no `hello`.
- All targets come from environment input; `SMOKE_*` is the canonical spec/plan/tasks/T7 contract and `DEPLOYED_*` aliases are accepted for the dispatch brief. No secrets, cookies or credentials are used.
- One `PASS`/`FAIL` line per executed check; the first broken check prints `FAIL` and exits `1`; a configuration error names every missing variable.
- `tests/e2e/smoke.mjs` was not modified.

Decisions:
- **Fail-fast.** The dispatch brief asks the script to fail on the first broken check; the plan's "one PASS/FAIL line per check" is satisfied for every executed check. The success summary is `DEPLOYED SMOKE PASS (8/8 checks)`; a failure prints `DEPLOYED SMOKE FAIL (n/8 checks passed)` and exits `1`.
- **Env naming.** Spec AC-18, plan contract 9, tasks T4 and T7's verify all pin `SMOKE_FRONTEND_URL`, `SMOKE_API_URL`, `SMOKE_WS_URL`, `SMOKE_ORIGIN`, optional `SMOKE_TIMEOUT_MS` (default 10 000). The dispatch brief names `DEPLOYED_*`; both spellings resolve to the same values, with `SMOKE_*` taking precedence. This is additive and lets T5/T7 use the pinned names.
- **Origin header on the WS client.** Node's global `WebSocket` accepts undici's non-standard `{ headers }` init object, which is the only way to prove the upgrade allowlist with a zero-dependency client. Browsers do not allow this; the script is Node-only. The real `wss://` handshake is otherwise the standard WebSocket client path.
- **Mixed-content guard.** When `SMOKE_FRONTEND_URL` is `https://`, the script rejects an `http://` API base or a `ws://` WS URL at configuration time; the local compose dry-run uses `http://`/`ws://` targets and still exercises every check.
- **No unit tests.** The script exports no pure helpers (it is an executable artifact, not imported production code); per T4, it stays executable and is proved by the task's smoke run. It is under the ESLint-ignored `tests/e2e/**` tree and outside both Vitest workspaces, so the coverage metric is unaffected; the root coverage gate is still green below.
- **Disallowed WS Origin.** Uses the reserved `https://disallowed.invalid` origin, so no real frontend origin can be mistaken for the deny case. The check asserts close code `1008` and no frames before the close.

## Evidence

### Syntax check

```
$ node --check tests/e2e/deployed-smoke.mjs
(no output; exit 0)
```

### T4 anchor grep

```
$ grep -nE 'healthz|auth/login|access-control-allow-origin|deep/link|does-not-exist|new WebSocket|join|explode|welcome' tests/e2e/deployed-smoke.mjs
15:// join plus one level-0 explode on that guest's own cube, which the server validates
19://   1. backend  GET  <api>/healthz -> 200 + {"status":"ok"}
20://   2. CORS     OPTIONS <api>/auth/login from the allowed Origin -> 204 + exact allow headers
21://   3. CORS     OPTIONS <api>/auth/login from a disallowed Origin -> 403 without an allow header
23://   5. frontend GET  <frontend>/deep/link -> 200 + text/html + the SPA shell (rewrite fallback)
24://   6. frontend GET  <frontend>/assets/does-not-exist.js -> 404, never the SPA shell
25://   7. WebSocket wss:// with the allowed Origin -> hello, guest join/welcome, explode ack
68:      `${name} must use ${allowedProtocols.join(' or ')}, got ${JSON.stringify(url.protocol)}`,
122:    throw new Error(`missing required environment variable(s): ${missing.join(', ')}`);
175:  const url = `${config.api}/healthz`;
184:  const url = `${config.api}/auth/login`;
198:  assertEqual(header(response, 'access-control-allow-origin'), config.origin, `${url} allow-origin`);
204:  return `204; access-control-allow-origin ${config.origin}`;
208:  const url = `${config.api}/auth/login`;
222:  assertEqual(header(response, 'access-control-allow-origin'), '', `${url} disallowed allow-origin`);
230:  return `403 origin_not_allowed without access-control-allow-origin`;
245:  const url = `${config.frontend}/deep/link`;
255:  const url = `${config.frontend}/assets/does-not-exist.js`;
280:    this.socket = new WebSocket(url, { headers: { Origin: origin } });
479:    client.send({ type: 'join', mode: 'guest' });
480:    const welcome = await waitForMessage(client, (message) => message?.type === 'welcome', config.timeoutMs, 'welcome');
481:    if (!Number.isInteger(welcome.serverId) || welcome.serverId < 1) {
482:      throw new Error(`welcome.serverId expected a positive integer, got ${JSON.stringify(welcome.serverId)}`);
484:    if (welcome.identity?.kind !== 'guest') {
485:      throw new Error(`welcome.identity.kind expected "guest", got ${JSON.stringify(welcome.identity?.kind)}`);
488:    client.send({ type: 'explode', id: 'front:0:0', level: 0 });
495:    if (removal.playerId !== welcome.playerId) {
497:      throw new Error(`removal.playerId expected the joined guest ${JSON.stringify(welcome.playerId)}, got ${JSON.stringify(removal.playerId)}`);
502:    return `hello -> welcome server ${welcome.serverId} -> ${removal.type} front:0:0`;
543:    ['backend /healthz returns 200 with {"status":"ok"}', () => checkBackendHealth(config)],
547:    ['frontend /deep/link serves the SPA fallback', () => checkFrontendDeepLink(config)],
548:    ['frontend /assets/does-not-exist.js is a real 404', () => checkFrontendMissingAsset(config)],
550:      `WebSocket at ${config.ws} accepts Origin ${config.origin}: hello, guest join, explode`,
exit 0
```

### Missing-environment failure (exact, no live deployment available)

```
$ env -u SMOKE_FRONTEND_URL -u DEPLOYED_FRONTEND_URL -u SMOKE_API_URL -u DEPLOYED_API_URL \
    -u SMOKE_WS_URL -u DEPLOYED_WS_URL -u SMOKE_ORIGIN -u DEPLOYED_FRONTEND_ORIGIN \
    node tests/e2e/deployed-smoke.mjs
FAIL configuration — missing required environment variable(s): SMOKE_FRONTEND_URL (or DEPLOYED_FRONTEND_URL), SMOKE_API_URL (or DEPLOYED_API_URL), SMOKE_WS_URL (or DEPLOYED_WS_URL), SMOKE_ORIGIN (or DEPLOYED_FRONTEND_ORIGIN)
exit 1
```

No deployed `development`/`production` URLs or provider assets exist in this workspace, so the live development deployment run is pending T7 (AC-19). This log does not claim a live deployed pass.

### Local dry-run against the unchanged compose stack (canonical `SMOKE_*` inputs)

The existing compose stack (`compose.yaml` + `compose.smoke.yaml`, `frontend-prod` = the prod nginx image) was already up; the script ran in the smoke service's Node 24 container on the compose network. This exercises the same HTTP/CORS/WS contracts as a deployed target without touching any compose file.

```
$ podman compose -f compose.yaml -f compose.smoke.yaml run --rm --no-deps \
    -e SMOKE_FRONTEND_URL=http://frontend-prod:8080 \
    -e SMOKE_API_URL=http://backend:8080 \
    -e SMOKE_WS_URL=ws://backend:8080/ws \
    -e SMOKE_ORIGIN=http://localhost:5173 \
    -e SMOKE_TIMEOUT_MS=10000 \
    smoke node deployed-smoke.mjs
deployed smoke: frontend=http://frontend-prod:8080 api=http://backend:8080 ws=ws://backend:8080/ws origin=http://localhost:5173 timeoutMs=10000
PASS backend /healthz returns 200 with {"status":"ok"} — 200 {"status":"ok"}
PASS CORS preflight from http://localhost:5173 is allowed — 204; access-control-allow-origin http://localhost:5173
PASS CORS preflight from https://disallowed.invalid is rejected — 403 origin_not_allowed without access-control-allow-origin
PASS frontend / serves the SPA shell with no-cache — 200 text/html; cache-control no-cache
PASS frontend /deep/link serves the SPA fallback — 200 text/html SPA fallback
PASS frontend /assets/does-not-exist.js is a real 404 — 404 without the SPA shell
PASS WebSocket at ws://backend:8080/ws accepts Origin http://localhost:5173: hello, guest join, explode — hello -> welcome server 3 -> miniCubeRemoved front:0:0
PASS WebSocket rejects a disallowed Origin with close 1008 — close 1008 without hello
DEPLOYED SMOKE PASS (8/8 checks)
exit 0
```

### Local dry-run with the `DEPLOYED_*` aliases

```
$ podman compose -f compose.yaml -f compose.smoke.yaml run --rm --no-deps \
    -e DEPLOYED_FRONTEND_URL=http://frontend-prod:8080 \
    -e DEPLOYED_API_URL=http://backend:8080 \
    -e DEPLOYED_WS_URL=ws://backend:8080/ws \
    -e DEPLOYED_FRONTEND_ORIGIN=http://localhost:5173 \
    -e DEPLOYED_TIMEOUT_MS=10000 \
    smoke node deployed-smoke.mjs
deployed smoke: frontend=http://frontend-prod:8080 api=http://backend:8080 ws=ws://backend:8080/ws origin=http://localhost:5173 timeoutMs=10000
PASS backend /healthz returns 200 with {"status":"ok"} — 200 {"status":"ok"}
PASS CORS preflight from http://localhost:5173 is allowed — 204; access-control-allow-origin http://localhost:5173
PASS CORS preflight from https://disallowed.invalid is rejected — 403 origin_not_allowed without access-control-allow-origin
PASS frontend / serves the SPA shell with no-cache — 200 text/html; cache-control no-cache
PASS frontend /deep/link serves the SPA fallback — 200 text/html SPA fallback
PASS frontend /assets/does-not-exist.js is a real 404 — 404 without the SPA shell
PASS WebSocket at ws://backend:8080/ws accepts Origin http://localhost:5173: hello, guest join, explode — hello -> welcome server 4 -> miniCubeRemoved front:0:0
PASS WebSocket rejects a disallowed Origin with close 1008 — close 1008 without hello
DEPLOYED SMOKE PASS (8/8 checks)
exit 0
```

(The two post-change runs report server `3` and `4` because the local backend process has served earlier smoke runs; the check is run-relative and asserts a positive integer, not a literal. Earlier evidence runs observed `1` and `2`.)

### `npm run lint` → exit 0

```
> lint
> eslint .

```

`tests/e2e/**` is outside the ESLint scope by the repository's existing flat config; the script still follows the repository style (2-space indent, single quotes, semicolons, trailing commas, Node built-ins only).

### `npm run typecheck` → exit 0

```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

### `npm run coverage` → exit 0 (regression gate)

```
> coverage
> npm run coverage --workspaces --if-present

...

 Test Files  32 passed (32)
      Tests  1110 passed (1110)
...
All files          |   95.25 |    88.68 |   99.53 |   95.25 |

...

 Test Files  70 passed (70)
      Tests  1873 passed (1873)
...
All files          |   96.48 |    96.14 |   97.56 |   96.48 |
...
coverage_exit=0
```

All four metrics are above the 80 threshold in both workspaces. The T4 script is an e2e executable outside both workspaces, so it adds no unit-coverage gap (no production code changed).

### Scope audit

```
$ git status --porcelain
 M docs/features/vercel-fly-neon-deployment/status.md   <- orchestrator-owned transition edit, pre-existing before T4
?? tests/e2e/deployed-smoke.mjs
?? docs/features/vercel-fly-neon-deployment/build-log-T4.md

$ git diff --name-only
docs/features/vercel-fly-neon-deployment/status.md
```

`git diff --name-only` lists only tracked modifications; the T4 files are new/untracked until committed. `status.md` is the orchestrator's pre-existing edit and is deliberately not part of the T4 commit. No frontend/backend source, workflow, compose, Terraform, `tests/e2e/smoke.mjs` or architecture-doc file was edited.

### Credential/secret audit of the new script

```
$ grep -nEi "token|password|secret|cookie|authorization|postgres://|wss://.*@|https://.*@" tests/e2e/deployed-smoke.mjs
14:// No credentials, cookies, tokens or destructive state: the only game action is a guest
71:  if (url.username !== '' || url.password !== '') {
exit 0
```

The two matches are the comment stating the script uses no credentials and the config guard that rejects URLs containing credentials; there is no credential value in the file.

The script has no `Authorization`/cookie/token input, no SMTP or database URL, and no destructive action. The only game action is a guest join + one level-0 explode, validated server-side; the deployed database is not touched.

## Acceptance audit

- **AC-18 — implementation met; live development-deployment evidence pending T7.** The zero-dependency script asserts health, exact allowlisted CORS preflight, disallowed preflight rejection, frontend shell/cache, deep-link fallback, real asset 404, WS `hello` → guest `join`/`welcome` → level-0 `explode` ack, and the disallowed-Origin `1008` close, printing one PASS/FAIL line per check and exiting non-zero on failure. Local compose dry-run: PASS 8/8 twice (canonical and alias env names). No deployed environment is provisioned here, so AC-18's "run against the development deployment" evidence remains T7's live proof; this log does not claim it.
- **AC-19 — not a T4 gate.** No workflow run or provider assets exist; T7 records `blocked`/live proof.
- **AC-20 (scope portion) — met.** No change to `compose.yaml`, `compose.smoke.yaml`, `src/frontend/nginx.conf`, `src/frontend/Dockerfile` or `tests/e2e/smoke.mjs`; the dry-run used the unchanged compose stack and left it running.
- **AC-23 (new-file portion) — met.** No secret, token, credential or connection string was added; the script reads only public URLs and an Origin.
- **AC-1..AC-17, AC-21, AC-22 — not T4.** No application, config, workflow, infra or architecture-doc file changed.

Deviations from spec: none. The `DEPLOYED_*` alias is additive to the pinned `SMOKE_*` contract and is recorded above. T5–T7 were not started.
