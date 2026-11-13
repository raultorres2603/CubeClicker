# Build log — T2 — Backend cross-origin auth (CORS, SameSite, WS Origin)

Task: T2 (2026-11-13)
Files changed:
- `src/backend/src/cors.ts` (new)
- `src/backend/src/cors.test.ts` (new)
- `src/backend/src/auth/config.ts`
- `src/backend/src/auth/config.test.ts`
- `src/backend/src/auth/auth-routes.ts`
- `src/backend/src/auth/auth-routes.test.ts`
- `src/backend/src/app.ts`
- `src/backend/src/app.test.ts`
- `docs/features/vercel-fly-neon-deployment/build-log-T2.md` (this log)

What changed & why:
- Added the in-repo, dependency-free CORS hook from plan contract 2: `CORS_ORIGIN` is a comma-separated exact-origin allowlist that falls back to `ALLOWED_ORIGIN` (single origin) so the local same-origin path is unchanged; allowlisted origins get the exact `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true` and `Vary: Origin`; preflights answer `204` with the pinned methods/headers/max-age; no wildcard is ever emitted and no origin is reflected without an exact match.
- Registered the hook before auth routes (Fastify `onRequest`, async so the hook chain settles), so an allowlisted preflight never reaches cookie/auth handling and a disallowed preflight is denied without an allow header.
- Auth CSRF `checkOrigin` now validates the full allowlist (default `[allowedOrigin]`), preserving the existing missing-Origin allowance while rejecting any present, non-allowlisted origin with the existing `403 origin_not_allowed`.
- Added `SESSION_COOKIE_SAMESITE` (`lax` default; `strict`; `none`, case-insensitive) to `AuthConfig`; an unknown value throws naming the variable and `none` without `SESSION_COOKIE_SECURE=true` throws the exact required message. Set and clear cookies now use the configured `SameSite`; `HttpOnly`, `Path=/`, `Max-Age` and the CSRF behavior are unchanged.
- Added the `/ws` Origin guard from plan contract 4: a present, non-allowlisted `Origin` closes with code `1008` before `hello`; a missing `Origin` remains allowed for non-browser clients; the same `CORS_ORIGIN` allowlist is reused, so the configured frontend origin and the local dev origin keep working.
- Set Fastify `trustProxy: env.NODE_ENV === 'production'`: Fly sets `NODE_ENV=production` via `fly.config.toml`, so `X-Forwarded-For`/`X-Forwarded-Proto` are trusted at the Fly edge (client IP for auth rate limiting, public `https` protocol) while local compose stays on direct-connection semantics and cannot spoof its IP into the limiter.

Decisions:
- Disallowed preflights are answered `403 { message: "origin not allowed", code: "origin_not_allowed" }` with `Vary: Origin` and no `Access-Control-Allow-Origin`; actual requests from disallowed origins still fall through so the auth CSRF check owns the `/auth/*` 403 and `/healthz` stays public without a CORS grant. This keeps AC-5's "POST from evil → 403 with no allow-origin" while giving browsers a deterministic preflight denial.
- `CORS_ORIGIN` wins when it contains at least one non-empty entry; `ALLOWED_ORIGIN` is the fallback (including a `buildApp` `authConfig` override) and `http://localhost:5173` is the final default. Empty/whitespace-only entries are dropped; an entirely empty configured list throws `CORS_ORIGIN must list at least one origin`.
- The WS predicate lives in `cors.ts` with the HTTP allowlist (`isWebSocketOriginAllowed`), so HTTP CORS, CSRF and WS upgrades share one exact-match implementation; only `undefined` Origin is treated as missing.
- `trustProxy` is gated on `NODE_ENV === 'production'` rather than a new environment variable: Fly's pinned config already sets `NODE_ENV=production`, no new env name is introduced outside the spec catalog, and local `podman compose up` (`NODE_ENV=development`) keeps the untrusted default.
- The CORS hook is declared `async`: a plain two-argument sync `onRequest` handler hung Fastify 5's request lifecycle in this app (captured while probing); the async form is the supported hook shape and is pinned by the integration tests.
- No dependency added; `@fastify/cors` was not introduced (Q-6 default), and no frontend, compose, Dockerfile, nginx, workflow, Fly/Vercel config or Terraform file was touched.

## Evidence

### `npm run lint` → exit 0

```
> lint
> eslint .
```

### `npm run typecheck` → exit 0

```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

### `npm test -w @cubeclicker/backend` → exit 0

```
 ✓ src/auth/config.test.ts (29 tests) 10ms
 ✓ src/cors.test.ts (15 tests) 116ms
 ✓ src/auth/auth-routes.test.ts (28 tests) 796ms
 ✓ src/app.test.ts (27 tests) 2245ms
 Test Files  30 passed (30)
      Tests  1088 passed (1088)
```

### `npm run coverage -w @cubeclicker/backend` → exit 0 (thresholds 80 on all four metrics, unchanged in `vitest.config.ts`)

```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.22 |     88.7 |   99.52 |   95.22 |
 src               |   85.88 |       90 |     100 |   85.88 |
  app.ts           |   81.72 |     85.1 |     100 |   81.72 | ...59,172,249-266
  cors.ts          |     100 |      100 |     100 |     100 |
 src/auth          |   95.74 |    82.88 |     100 |   95.74 |
  auth-routes.ts   |    80.7 |    54.19 |     100 |    80.7 | ...61-363,369-370
  config.ts        |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
```

All four aggregate metrics are above 80; `cors.ts` is at 100% on statements/branches/functions/lines and `auth/config.ts` is at 100% on all four. The uncovered `auth-routes.ts` branches are the pre-existing service/fallback branches already uncovered before T2 (the new cookie/allowlist paths are exercised).

### Scope audit — pre-commit working tree

```
$ git status --porcelain
 M src/backend/src/app.test.ts
 M src/backend/src/app.ts
 M src/backend/src/auth/auth-routes.test.ts
 M src/backend/src/auth/auth-routes.ts
 M src/backend/src/auth/config.test.ts
 M src/backend/src/auth/config.ts
?? src/backend/src/cors.test.ts
?? src/backend/src/cors.ts

$ git diff --name-only
src/backend/src/app.test.ts
src/backend/src/app.ts
src/backend/src/auth/auth-routes.test.ts
src/backend/src/auth/auth-routes.ts
src/backend/src/auth/config.test.ts
src/backend/src/auth/config.ts

$ git diff --stat
 src/backend/src/app.test.ts              | 223 +++++++++++++++++++++++++++++++
 src/backend/src/app.ts                   |  32 ++++-
 src/backend/src/auth/auth-routes.test.ts | 127 +++++++++++++++++-
 src/backend/src/auth/auth-routes.ts      |  42 ++++--
 src/backend/src/auth/config.test.ts      |  43 ++++++
 src/backend/src/auth/config.ts           |  29 ++++
 6 files changed, 479 insertions(+), 17 deletions(-)
```

The two new files plus the six tracked edits are exactly the T2 `files_owned` set; this log is the ninth committed path. No `opencode.jsonc`, `skills-lock.json`, feature artifact, frontend, compose, Dockerfile, nginx, workflow, Fly/Vercel config, Terraform or architecture doc was staged.

### Test coverage of the required cases

- **Allowed CORS preflight:** `cors.test.ts` asserts `204`, exact `access-control-allow-origin`, `access-control-allow-credentials: true`, `access-control-allow-methods: GET,POST,OPTIONS`, `access-control-allow-headers: Content-Type,Accept` (and the lower-case token split `content-type, accept`), `access-control-max-age: 600`, `vary: Origin`, empty body and no `set-cookie`.
- **Allowed actual request:** `cors.test.ts` asserts the exact allow-origin/credentials/`vary` headers on `GET /healthz`.
- **Disallowed actual request:** `POST /auth/login` with `Origin: https://evil.example` → `403` with `{ message: 'origin not allowed', code: 'origin_not_allowed' }` and no allow-origin/credentials header.
- **Disallowed preflight:** `403` with no reflected origin and `vary: Origin`.
- **No-Origin health:** `GET /healthz` without `Origin` (and with a disallowed `Origin`) → `200 { status: 'ok' }` with no allow-origin.
- **Comma-separated allowlist:** each listed origin gets its exact `Access-Control-Allow-Origin`; a third origin is denied.
- **Local dev regression:** `ALLOWED_ORIGIN` fallback keeps `http://localhost:5173` allowed on preflight.
- **No wildcard:** exact-origin assertions plus `not.toBe('*')` and absent header for unknown origins.
- **Cookie flags:** `auth/config.test.ts` pins the `lax` default, `strict`/`none` parsing (case-insensitive), the unknown-value error and the exact `none`+`Secure` error; `auth/auth-routes.test.ts` pins default `SameSite=Lax` with no `Secure`, `SameSite=None; Secure` on login and logout, and `SameSite=Strict` on login and logout.
- **WS Origin:** `cors.test.ts` pins `isWebSocketOriginAllowed(undefined) === true`, exact allowlist `true`, `https://evil.example` and `''` `false`; `app.test.ts` performs raw `node:http` upgrades and asserts a disallowed Origin yields `101` then exactly one close frame with code `1008` (no text/`hello` frame), allowlisted and missing Origins each receive one text frame whose payload is `{ type: 'hello', serverTime: <ISO> }`, and the default local origin remains allowed.
- **Trust proxy:** `app.test.ts` asserts a production app reads `request.ip`/`request.protocol` from `X-Forwarded-For`/`X-Forwarded-Proto`, while a development app keeps the direct socket address/`http`.

## Acceptance audit

- **AC-5 — met.** With `CORS_ORIGIN=https://app.example.test`, the preflight assertions above match the AC exactly (`204`, exact allow-origin, credentials true, methods containing `POST`, headers containing `content-type`, `vary` containing `Origin`); `POST /auth/login` from `https://evil.example` is `403` with no allow-origin; `GET /healthz` without Origin is `200` with no allow-origin; the comma-separated list allows each listed origin and no others. 15 `cors.test.ts` tests.
- **AC-6 — met.** `SESSION_COOKIE_SAMESITE` defaults to `lax`, accepts `lax`/`strict`/`none` case-insensitively, throws naming the variable for an unknown value, and throws the exact `SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true` without Secure. With `none`+Secure the login `Set-Cookie` contains `HttpOnly`, `Secure`, `SameSite=None`, `Path=/`, and logout clears with `Secure`/`SameSite=None`; the default config produces `SameSite=Lax` and no `Secure`. 29 `auth/config.test.ts` + 28 `auth/auth-routes.test.ts` tests.
- **AC-7 — met.** `isWebSocketOriginAllowed` returns `true` for `undefined`, `true` for an exact allowlisted origin and `false` for `https://evil.example` (and `''`); the raw `node:http` integration test shows a disallowed present Origin is closed with `1008` and receives no `hello`, while an allowlisted and a missing Origin both receive the pinned `{ type: 'hello', serverTime: <ISO> }`. 27 `app.test.ts` tests.
- **Trust-proxy instruction — met.** Production (`NODE_ENV=production`, Fly) trusts the edge's forwarded address/protocol; local development does not. Pinned in `app.test.ts`.
- **Local-path constraint — met.** No change to `compose.yaml`, `compose.smoke.yaml`, `src/frontend/**`, `src/frontend/nginx.conf`, `tests/e2e/smoke.mjs`, workflows, Fly/Vercel config or Terraform. The default `ALLOWED_ORIGIN`/local WS origin behavior is unchanged and explicitly regression-tested.
- **AC-20 (local portion relevant to T2) — met.** The default app keeps the local `http://localhost:5173` HTTP and WS origin allowed and uses the in-memory repositories when no database URL is set; T2 introduces no startup requirement. Containerized smoke re-verification belongs to T7.

Deviations from spec: none.

Notes: the only documentation change in this commit is this build log; `README.md`, `docs/architecture/*` and `docs/features/README.md` remain out of T2 scope (T6 owns the architecture docs; the feature index is orchestrator-owned). T3–T7 were not started.
