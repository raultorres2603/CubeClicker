# Build log — T4 — nginx delivery and containerized prod smoke

Task: T4 (2026-11-12)
Files changed:
- `src/frontend/nginx.conf` (edit: gzip + cache-header matrix)
- `src/frontend/src/build/nginx-config.test.ts` (new)
- `compose.smoke.yaml` (edit: smoke-only `frontend-prod` service + smoke dependency)
- `tests/e2e/smoke.mjs` (edit: raw HTTP/gunzip prod delivery checks)
- `docs/features/frontend-delivery-hardening/build-log-T4.md` (this file)

What changed & why:
- `nginx.conf` enables gzip (level 6, min length 128, `Vary: Accept-Encoding`, JS/CSS/JSON/manifest/SVG types), serves hashed `/assets/*` with `Cache-Control: public, max-age=31536000, immutable` and a real 404 for missing assets, and keeps `/`, `/index.html`, and the SPA fallback on `Cache-Control: no-cache`. No brotli directive.
- `nginx-config.test.ts` pins the exact gzip directives and type list, the three location blocks, and the absence of `brotli on`/`brotli_types` by reading `../../nginx.conf`.
- `compose.smoke.yaml` adds the smoke-only `frontend-prod` service (prod target, image `cubeclicker-frontend:prod-smoke`, no ports) and makes `smoke` depend on it with `condition: service_started`.
- `smoke.mjs` adds `PROD_FRONTEND_URL` (default `http://frontend-prod:8080`), a bounded readiness poll before any prod header assertion, a raw `node:http`/`node:https` GET helper (raw bytes + headers, `Accept-Encoding: gzip`), and a `node:zlib` gunzip helper. The prod checks assert the shell/headers/gzip magic/module script, the served report graph and budgets, both hashed chunks (gunzipped byte counts match the report), the missing-asset 404, and the SPA fallback. Every existing smoke check is unchanged.

Decisions:
- Header order inside the location blocks is `try_files` then `add_header`; the test pins the exact normalized block bodies rather than relying on formatting.
- `add_header` is deliberately not `always`: a missing `/assets/*` 404 must not inherit the immutable header (asserted by the smoke).
- The readiness poll uses the existing `pollUntilReady` (global `fetch`); every header/body assertion uses the raw helper so `Content-Encoding`/`Vary` are observed on the wire.
- The served `/bundle-report.json` checks the approved budgets (150000/165000/300000) and that each measurement is within budget, in addition to the AC-1 graph conditions.
- `nginx.conf` sits outside the frontend `src` coverage include; it is test-level covered by `nginx-config.test.ts` (6 tests). No coverage exclusion and no threshold change was added.

Evidence:

- `npm run lint` → exit 0
```
> lint
> eslint .

LINT_EXIT=0
```

- `npm run typecheck` → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

- `npx vitest run src/build/nginx-config.test.ts --reporter=verbose` (from `src/frontend`) → exit 0
```
 ✓ src/build/nginx-config.test.ts > production nginx delivery configuration > enables gzip at level 6 with the pinned minimum length and Vary 1ms
 ✓ src/build/nginx-config.test.ts > production nginx delivery configuration > compresses exactly the pinned static asset types 0ms
 ✓ src/build/nginx-config.test.ts > production nginx delivery configuration > declares exactly the three delivery locations 0ms
 ✓ src/build/nginx-config.test.ts > production nginx delivery configuration > serves hashed assets immutably and 404s missing asset paths 0ms
 ✓ src/build/nginx-config.test.ts > production nginx delivery configuration > revalidates the app shell and keeps the SPA fallback 0ms
 ✓ src/build/nginx-config.test.ts > production nginx delivery configuration > does not enable brotli 0ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
```

- `npm run test --workspace @cubeclicker/frontend` → exit 0 (jsdom WebGL "not implemented" stderr lines are the pre-existing `SpaceshipPreview` no-WebGL fallback noise)
```
 ✓ src/App.test.tsx (41 tests) 1000ms

 Test Files  69 passed (69)
      Tests  1813 passed (1813)
TEST_EXIT=0
```

- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds 80 on statements/branches/functions/lines; no exclusion or threshold change)
```
 Test Files  69 passed (69)
      Tests  1813 passed (1813)
All files          |   96.42 |     96.1 |   97.53 |   96.42 |
COVERAGE_EXIT=0
```

- `npm run build` → exit 0 (fresh build + bundle-budget gate)
```
> build
> npm run build --workspaces --if-present


> build
> tsc


> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
transforming...
✓ 104 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                        0.49 kB │ gzip:   0.30 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-CWGWNrMl.css                        26.36 kB │ gzip:   5.32 kB
dist/assets/cursor-ship-fi2YCtK6.js                    6.73 kB │ gzip:   2.21 kB
dist/assets/SpaceshipCustomizationPanel-PD8H8p33.js    9.54 kB │ gzip:   3.34 kB
dist/assets/browser-env-CX-sYLqK.js                   48.95 kB │ gzip:  18.08 kB
dist/assets/index-Cu7lmcVH.js                         87.06 kB │ gzip:  26.95 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-4rmoIDEa.js                        609.34 kB │ gzip: 154.32 kB
✓ built in 1.49s
entry index assets/index-Cu7lmcVH.js raw=87059 gzip=26947
initial files=2 raw=308758 gzip=95903 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=165000
total files=6 raw=983312 gzip=273854 budget=300000
chunk SpaceshipCustomizationPanel assets/SpaceshipCustomizationPanel-PD8H8p33.js raw=9537 gzip=3337 initial=false
chunk browser-env assets/browser-env-CX-sYLqK.js raw=48951 gzip=18081 initial=false
chunk cursor-ship assets/cursor-ship-fi2YCtK6.js raw=6729 gzip=2210 initial=false
chunk index assets/index-Cu7lmcVH.js raw=87059 gzip=26947 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-4rmoIDEa.js raw=609337 gzip=154323 initial=false

Bundle budget OK.
ROOT_BUILD_EXIT=0
```

### Q-9 — clean compose run auto-build behavior (recorded per the task)

The repository convention is `podman compose` (provider: external `docker-compose` v5.6.0). Before any explicit build, there was **no** `cubeclicker-frontend:prod-smoke` image. A clean `run --rm smoke` was executed exactly as CI does it:

```
Image cubeclicker-frontend:prod-smoke Pulling
Image cubeclicker-frontend:prod-smoke denied: requested access to the resource is denied
Image cubeclicker-frontend:prod-smoke Building
Image cubeclicker-frontend:prod-smoke Building
...
Successfully tagged docker.io/library/cubeclicker-frontend:prod-smoke
Image cubeclicker-frontend:prod-smoke Built
...
Network cubeclicker_default Created
Container cubeclicker-frontend-prod-1 Created
Container cubeclicker-frontend-prod-1 Started
...
SMOKE PASS (19/19 checks)
```

**Result: the compose provider auto-builds the missing `frontend-prod` dependency image during `run --rm smoke`.** The CI workflow therefore needs no `--build` amendment **with this provider**. The user-approved Q-9 fallback remains recorded for any provider/version that does not auto-build: run `docker compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` before `docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` (or use `run --build --rm smoke`). The CI workflow was **not edited** (user-owned).

- `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` → exit 0 (the pinned explicit prerequisite; cached after the clean run)
```
Image cubeclicker-frontend:prod-smoke Building
...
Successfully tagged docker.io/library/cubeclicker-frontend:prod-smoke
Successfully tagged cubeclicker-frontend:prod-smoke
 Image cubeclicker-frontend:prod-smoke Built
COMPOSE_BUILD_EXIT=0
```

- `npm run smoke` (`podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`) → exit 0, 19/19 checks
```
smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 1
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 2
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1003ms
PASS auth register: POST /auth/register returns 202
PASS auth verify: Mailpit delivers a verification email and POST /auth/verify activates the account
PASS auth login: POST /auth/login returns 200 with a session cookie
PASS auth guest: WebSocket join with mode "guest" yields a guest welcome
PASS prod frontend http://frontend-prod:8080/ is ready for delivery checks
PASS prod http://frontend-prod:8080/bundle-report.json serves the build report with no-cache, gzip, and a lazy three chunk
PASS prod http://frontend-prod:8080/ serves the gzip app shell with no-cache and the report entry script — content-encoding gzip; cache-control no-cache
PASS prod /assets/index-Cu7lmcVH.js is served gzip with immutable caching — content-encoding gzip; 87059 B decompressed
PASS prod /assets/three-4rmoIDEa.js is served gzip with immutable caching — content-encoding gzip; 609337 B decompressed
PASS prod http://frontend-prod:8080/assets/missing.js returns 404 and never the app shell — status 404 without a long-cache header
PASS prod http://frontend-prod:8080/missing/route serves the gzip SPA shell with no-cache — status 200; cache-control no-cache
SMOKE PASS (19/19 checks)
SMOKE_EXIT=0
```

The readiness check is the **first** prod request; it records its own PASS line and only then do the header/body assertions run. The report's `initial.files`/`three.initial`/budgets and both chunks' gunzipped byte counts are asserted by the checks above.

### Raw header matrix captured from the running prod container (same image/run)

```
=== GET / ===
  HTTP/1.1 200 OK
  Content-Type: text/html
  Vary: Accept-Encoding
  Cache-Control: no-cache
  Content-Encoding: gzip

=== GET /assets/index-Cu7lmcVH.js ===
  HTTP/1.1 200 OK
  Content-Type: application/javascript
  Vary: Accept-Encoding
  Cache-Control: public, max-age=31536000, immutable
  Content-Encoding: gzip

=== GET /bundle-report.json ===
  HTTP/1.1 200 OK
  Content-Type: application/json
  Vary: Accept-Encoding
  Cache-Control: no-cache
  Content-Encoding: gzip

=== GET /missing/route ===
  HTTP/1.1 200 OK
  Content-Type: text/html
  Vary: Accept-Encoding
  Cache-Control: no-cache
  Content-Encoding: gzip

=== GET /assets/missing.js ===
  HTTP/1.1 404 Not Found
```

- `test "$(podman run --rm --entrypoint nginx cubeclicker-frontend:prod-smoke -V 2>&1 | grep -ci brotli)" -eq 0` → exit 0 (`BROTLI_COUNT=0`)
```
NGINX_V_EXIT=0
BROTLI_COUNT=0
BROTLI_TEST_EXIT=0
--- nginx -V output ---
nginx version: nginx/1.27.5
built by gcc 14.2.0 (Alpine 14.2.0)
built with OpenSSL 3.3.3 11 Feb 2025
TLS SNI support enabled
configure arguments: --prefix=/etc/nginx --sbin-path=/usr/sbin/nginx --modules-path=/usr/lib/nginx/modules --conf-path=/etc/nginx/nginx.conf --error-log-path=/var/log/nginx/error.log --http-log-path=/var/log/nginx/access.log --pid-path=/run/nginx.pid --lock-path=/run/nginx.lock --http-client-body-temp-path=/var/cache/nginx/client_temp --http-proxy-temp-path=/var/cache/nginx/proxy_temp --http-fastcgi-temp-path=/var/cache/nginx/fastcgi_temp --http-uwsgi-temp-path=/var/cache/nginx/uwsgi_temp --http-scgi-temp-path=/var/cache/nginx/scgi_temp --with-perl_modules_path=/usr/lib/perl5/vendor_perl --user=nginx --group=nginx --with-compat --with-file-aio --with-threads --with-http_addition_module --with-http_auth_request_module --with-http_dav_module --with-http_flv_module --with-http_gunzip_module --with-http_gzip_static_module --with-http_mp4_module --with-http_random_index_module --with-http_realip_module --with-http_secure_link_module --with-http_slice_module --with-http_ssl_module --with-http_stub_status_module --with-http_sub_module --with-http_v2_module --with-http_v3_module --with-mail --with-mail_ssl_module --with-stream --with-stream_realip_module --with-stream_ssl_module --with-stream_ssl_preread_module --with-cc-opt='-Os -fstack-clash-protection -Wformat -Werror=format-security -fno-plt -g' --with-ld-opt='-Wl,--as-needed,-O1,--sort-common -Wl,-z,pack-relative-relocs'
```
  The configure line contains no `ngx_brotli`/`brotli` match, confirming the base image is gzip-only (AC-8); the config also has no brotli directive (unit test).

- `podman run --rm --entrypoint nginx cubeclicker-frontend:prod-smoke -t` → exit 0
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
NGINX_T_EXIT=0
```

Test-level coverage note (AC-10, task requirement): `src/frontend/nginx.conf` is outside the frontend `src` coverage include. It is covered at test level by `src/build/nginx-config.test.ts` (6 tests pinning every directive, the three location bodies, and the brotli absence). No coverage exclusion and no threshold change was added; frontend coverage remains 96.42 / 96.1 / 97.53 / 96.42.

Environment note: a dev stack was already running under the same compose project, so it was stopped (`podman compose down`, volumes preserved) before the smoke runs to exercise the smoke-override `MAX_USERS_PER_SERVER=2` / `RECONNECT_GRACE_MS=1000` configuration; the dev stack was restored with `podman compose up -d` after verification. `compose.yaml`, `src/frontend/Dockerfile`, root `package.json`/`package-lock.json`, and `.github/workflows/ci.yml` were not edited.

Acceptance audit:
- AC-7 → met: the config pins gzip on/level 6/min length 128/Vary and the six type tokens; `/assets/` is immutable with `try_files $uri =404`; `/index.html` and `/` are no-cache; `nginx-config.test.ts` passes and the live smoke asserts the exact wire headers (19/19).
- AC-8 (T4 portion) → met: no brotli directive (unit test) and `nginx -V` has zero brotli matches; the doc sentence in `docs/architecture/containerization.md` is T5-owned and was not edited here.
- AC-9 → met: `compose.smoke.yaml` has the smoke-only `frontend-prod` service with no ports and the `service_started` dependency; the readiness poll PASS precedes every header assertion; the smoke asserts the served report graph/budgets, shell + module script, entry/three gzip + immutable cache + report byte counts, `/assets/missing.js` 404, and `/missing/route` gzip shell; `npm run smoke` is 19/19 green. Q-9: the clean run auto-built the dependency; the exact fallback prerequisite is recorded above for providers that do not.
- AC-10 (T4 portion) → met: `nginx-config.test.ts` adds 6 concrete assertions; coverage 96.42 / 96.1 / 97.53 / 96.42 with no exclusion/threshold change.

Deviations from spec: none. Docs are intentionally untouched in this task (`files_owned`); T5 owns the README/architecture updates and the AC-8 documentation sentence.
