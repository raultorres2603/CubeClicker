# Build log — T1 — Frontend per-environment runtime config

Task: T1 (2026-11-13)
Files changed:
- `src/frontend/src/config.ts` (new)
- `src/frontend/src/config.test.ts` (new)
- `src/frontend/src/auth/api.ts`
- `src/frontend/src/auth/api.test.ts`
- `src/frontend/src/multiplayer/transport.ts`
- `src/frontend/src/multiplayer/transport.test.ts`
- `src/frontend/vite.config.ts`
- `src/frontend/src/build/vite-config.test.ts`
- `docs/features/vercel-fly-neon-deployment/build-log-T1.md` (this log)

What changed & why:
- Added the one pure resolver `resolveFrontendConfig(env, options)` from plan contract 1: `apiBaseUrl` is the trimmed `VITE_API_URL` with **all** trailing slashes removed (`https://api.example.test//` → `https://api.example.test`); `wsUrl` is a non-empty `VITE_WS_URL`, else `wss://<api-host>/ws` / `ws://…` derived from the API base, else the pinned `ws://localhost:8080/ws`; cloud mode (`options.cloud === true`) requires an absolute `https://` API URL and a resolved `wss://` socket.
- `createAuthApi()` now resolves its default base through the resolver (explicit `baseUrl` still wins; `credentials: 'include'` untouched); `createTransport()` resolves its default socket URL through the same resolver and the duplicate `DEFAULT_WS_URL` constant is gone.
- `vite.config.ts` bridges `VITE_API_URL`, `VITE_WS_URL` and `VITE_CLOUD_DEPLOY` through `define` and validates the **resolved** config when `VITE_CLOUD_DEPLOY=true`, so the Vercel build fails before `vite build` on a missing/relative API URL or an `ws://` socket.
- Local/same-origin behavior is unchanged: empty API base, `ws://localhost:8080/ws`, `SameSite` cookie path and the Vite `/auth` proxy are untouched.

Decisions:
- Cloud mode is strictly `options.cloud === true`; a `VITE_CLOUD_DEPLOY` value inside the env object never enables validation by itself (pinned by a test), matching AC-1.
- Error messages are exported constants and asserted verbatim: `VITE_API_URL must be set to an absolute https:// URL when VITE_CLOUD_DEPLOY=true` and `VITE_WS_URL must resolve to an absolute wss:// URL when VITE_CLOUD_DEPLOY=true`.
- `FrontendConfigEnv` carries an index signature so Vite's `import.meta.env` object is assignable (the optional-only shape failed TS weak-type detection); the named `VITE_*` fields stay documented and typed.
- `VITE_WS_URL` is used verbatim when set (trimmed only); only the API base is slash-normalized, per plan contract 1.
- The `VITE_WS_URL` default in `define` is now `''` (was the local literal); the resolver owns the fallback, so `src/frontend/Dockerfile`'s existing `ENV VITE_WS_URL=ws://localhost:8080/ws` default still resolves to the same local URL and was not edited.
- No dependency added; `src/frontend/vitest.config.ts` and its coverage thresholds are unchanged.

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

### `npm test -w @cubeclicker/frontend` → exit 0

```
 ✓ src/auth/api.test.ts (31 tests) 20ms
 ✓ src/build/vite-config.test.ts (11 tests) 425ms
 ✓ src/multiplayer/transport.test.ts (15 tests) 20ms
 ✓ src/config.test.ts (20 tests) 7ms
 Test Files  70 passed (70)
      Tests  1873 passed (1873)
```

### `npm run coverage -w @cubeclicker/frontend` → exit 0 (thresholds 80 statements/branches/functions/lines, unchanged in `vitest.config.ts`)

```
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.48 |    96.14 |   97.56 |   96.48 |
 src               |   87.87 |    84.95 |   95.45 |   87.87 |
  config.ts        |     100 |      100 |     100 |     100 |
 src/auth          |   96.85 |     86.2 |   96.15 |   96.85 |
  api.ts           |   96.44 |     87.5 |     100 |   96.44 | ...61-162,170,222
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | ...63-164,190-193
 src/multiplayer   |    93.4 |     96.6 |   95.89 |    93.4 |
  transport.ts     |   99.49 |      100 |     100 |   99.49 | 200
-------------------|---------|----------|---------|---------|-------------------
```

`transport.ts:200` is the pre-existing unexercised `case 'error'` early return (identical in `HEAD`); `config.ts` is at 100% on all four metrics.

### Positive cloud build — API only → exit 0

Command: `VITE_CLOUD_DEPLOY=true VITE_API_URL=https://api.example.test npm run build -w @cubeclicker/frontend`

```
vite v7.3.7 building client environment for production...
transforming...
✓ 105 modules transformed.
rendering chunks...
computing gzip size...
dist/assets/index-CILSpIKR.js                         88.40 kB │ gzip:  27.45 kB
✓ built in 1.42s
entry index assets/index-CILSpIKR.js raw=88401 gzip=27454
initial files=2 raw=310100 gzip=96410 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=165000
total files=6 raw=984752 gzip=274388 budget=300000

Bundle budget OK.
```

Baked-bundle probe (proves cloud mode is statically on and the API URL is the baked source of the derived socket; the `wss://api.example.test/ws` value itself is computed by the resolver at runtime, so its absence as a literal is expected and AC-4 asserts the effective URL through the resolver/transport tests):

```
bundle=src/frontend/dist/assets/index-CILSpIKR.js
tr={VITE_API_URL:"https://api.example.test",VITE_WS_URL:""}
ho={VITE_API_URL:"https://api.example.test",VITE_WS_URL:""}
cloud flags:       2 cloud:!0
https://api.example.test occurrences: 2
literal wss://api.example.test/ws occurrences: 0
ws://localhost:8080/ws occurrences: 1     (allowed: AC-4 forbids asserting literal absence)
```

Effective URL evidence is the resolver/transport tests, not a bundle grep:
- `config.test.ts` — cloud API-only `{ VITE_API_URL: 'https://api.example.test' }` → `{ apiBaseUrl: 'https://api.example.test', wsUrl: 'wss://api.example.test/ws' }`.
- `transport.test.ts` — `VITE_CLOUD_DEPLOY=true` + API-only stubs open exactly `wss://api.example.test/ws` (opened-URL sequence below).

### Positive cloud build — both URLs → exit 0

Command: `VITE_CLOUD_DEPLOY=true VITE_API_URL=https://api.example.test VITE_WS_URL=wss://api.example.test/ws npm run build -w @cubeclicker/frontend`

```
dist/assets/index-DuWPwP8W.js                         88.45 kB │ gzip:  27.47 kB
✓ built in 1.49s
initial files=2 raw=310150 gzip=96422 budget=150000
three assets/three-4rmoIDEa.js raw=609337 gzip=154323 budget=165000
total files=6 raw=984802 gzip=274400 budget=300000

Bundle budget OK.
```

Baked-bundle probe:

```
bundle=src/frontend/dist/assets/index-DuWPwP8W.js
tr={VITE_API_URL:"https://api.example.test",VITE_WS_URL:"wss://api.example.test/ws"}
ho={VITE_API_URL:"https://api.example.test",VITE_WS_URL:"wss://api.example.test/ws"}
cloud flags:       2 cloud:!0
literal wss://api.example.test/ws occurrences: 2
```

### Negative build — missing `VITE_API_URL` → exit 1 (expected)

Command: `VITE_CLOUD_DEPLOY=true npm run build -w @cubeclicker/frontend`

```
> build
> vite build && node scripts/check-bundle-budget.mjs

failed to load config from /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend/vite.config.ts
error during build:
Error: VITE_API_URL must be set to an absolute https:// URL when VITE_CLOUD_DEPLOY=true
    at resolveFrontendConfig (…/vite.config.ts.timestamp-…mjs:40:13)
    …
npm error Lifecycle script `build` failed with error:
npm error code 1
npm error path /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
npm error workspace @cubeclicker/frontend
npm error command failed
npm error command sh -c vite build && node scripts/check-bundle-budget.mjs
```

### Negative build — explicit `ws://` WS URL → exit 1 (expected)

Command: `VITE_CLOUD_DEPLOY=true VITE_API_URL=https://api.example.test VITE_WS_URL=ws://api.example.test/ws npm run build -w @cubeclicker/frontend`

```
> build
> vite build && node scripts/check-bundle-budget.mjs

failed to load config from /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend/vite.config.ts
error during build:
Error: VITE_WS_URL must resolve to an absolute wss:// URL when VITE_CLOUD_DEPLOY=true
    at resolveFrontendConfig (…/vite.config.ts.timestamp-…mjs:43:13)
    …
npm error Lifecycle script `build` failed with error:
npm error code 1
npm error path /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
npm error workspace @cubeclicker/frontend
npm error command failed
npm error command sh -c vite build && node scripts/check-bundle-budget.mjs
```

### Local build regression (no `VITE_*` env) → exit 0

Command: `npm run build -w @cubeclicker/frontend`

```
dist/assets/index-ak4hpiiK.js                         88.35 kB │ gzip:  27.43 kB
✓ built in 1.46s
initial files=2 raw=310052 gzip=96382 budget=150000
total files=6 raw=984704 gzip=274354 budget=300000

Bundle budget OK.

bundle=src/frontend/dist/assets/index-ak4hpiiK.js
tr={VITE_API_URL:"",VITE_WS_URL:""}
ho={VITE_API_URL:"",VITE_WS_URL:""}
cloud flags:       2 cloud:!1
ws://localhost:8080/ws occurrences: 1
```

Local mode stays same-origin: empty API base, `ws://localhost:8080/ws` fallback, cloud validation off.

### Test coverage of the required cases

- Local fallback: `config.test.ts` `{}` → `{ apiBaseUrl: '', wsUrl: 'ws://localhost:8080/ws' }`; `transport.test.ts` opens `ws://localhost:8080/ws`.
- Cloud API-only resolution: `config.test.ts` cloud case; transport opens `wss://api.example.test/ws`; `vite-config.test.ts` API-only bridge accepts and bakes `""` for the WS URL.
- Explicit WS URL: `config.test.ts` → `wss://mp.example.test/ws` verbatim; transport sequence `['ws://localhost:8080/ws', 'wss://mp.example.test/ws', 'ws://localhost:8080/ws', 'wss://api.example.test/ws']`.
- Both-URL build: `vite-config.test.ts` exact `define` object; real build exit 0 (above).
- Missing API negative build: `vite-config.test.ts` exact thrown message; real build exit 1 (above).
- Explicit `ws://` negative: `config.test.ts`, `vite-config.test.ts`, and real build exit 1 (above).
- Trailing-slash normalization (double slash pinned): `config.test.ts` local + cloud, `auth/api.test.ts` `https://api.example.test//` → `https://api.example.test/auth/me`.
- Effective resolved `wss://` URL: `transport.test.ts` asserts the opened URL, not literal absence.

### Scope audit

```
$ git status --porcelain -- src/frontend
 M src/frontend/src/auth/api.test.ts
 M src/frontend/src/auth/api.ts
 M src/frontend/src/build/vite-config.test.ts
 M src/frontend/src/multiplayer/transport.test.ts
 M src/frontend/src/multiplayer/transport.ts
 M src/frontend/vite.config.ts
?? src/frontend/src/config.test.ts
?? src/frontend/src/config.ts

$ git diff --name-only -- src/frontend
src/frontend/src/auth/api.test.ts
src/frontend/src/auth/api.ts
src/frontend/src/build/vite-config.test.ts
src/frontend/src/multiplayer/transport.test.ts
src/frontend/src/multiplayer/transport.ts
src/frontend/vite.config.ts
```

`opencode.jsonc` and `skills-lock.json` show as modified in the working tree but pre-date this task (present before T1 started, skill-install config) and were not touched or staged. No backend, workflow, compose, Dockerfile, nginx, Terraform or architecture-doc file was edited.

## Acceptance audit

- **AC-1 — met.** `src/frontend/src/config.ts` exports `resolveFrontendConfig(env, options)`; local `{}` → `{ apiBaseUrl: '', wsUrl: 'ws://localhost:8080/ws' }`; `https://api.example.test/` and `https://api.example.test//` normalize to `https://api.example.test` with `wss://api.example.test/ws`; explicit `VITE_WS_URL` is used verbatim; cloud mode requires absolute `https://` API (missing/empty/relative/http all throw the exact `VITE_API_URL` message) and rejects a non-`wss://` resolved socket with the exact `VITE_WS_URL`/`wss://` message. 20 `config.test.ts` tests, `config.ts` 100%/100%/100%/100%.
- **AC-2 — met.** `createAuthApi()` resolves the default base: `VITE_API_URL=https://api.example.test` sends `fetch('https://api.example.test/auth/login', { credentials: 'include', … })`; no env keeps `'/auth/login'`; explicit `baseUrl` still wins; existing relative-path tests unchanged. 31 `api.test.ts` tests.
- **AC-3 — met.** `createTransport()` uses the same resolver; the exact opened sequence `['ws://localhost:8080/ws', 'wss://mp.example.test/ws', 'ws://localhost:8080/ws']` for `VITE_WS_URL` undefined/set/`''` plus the API-only cloud case opening `wss://api.example.test/ws` is asserted in `transport.test.ts`.
- **AC-4 — met.** `vite.config.ts` defines `import.meta.env.VITE_API_URL` from `process.env.VITE_API_URL ?? ''`, `VITE_WS_URL` from `process.env.VITE_WS_URL ?? ''`, `VITE_CLOUD_DEPLOY` from `process.env.VITE_CLOUD_DEPLOY ?? 'false'`; cloud mode validates the resolved config before the build. Both positive builds exit 0 with the bundle-budget gate; missing-API and `ws://` builds exit non-zero naming the variable(s); effective `wss://` URL is pinned by resolver/transport tests, not literal absence.
- **AC-20 (local-path portion) — met.** No compose/Dockerfile/nginx/smoke change; the frontend production build with no `VITE_*` env exits 0 and bakes an empty API base with cloud validation off, so local same-origin and `ws://localhost:8080/ws` behavior is unchanged. Network `/healthz`/in-memory-backend portions belong to T2/T3/T7.
- **AC-15 / AC-23 — out of scope for T1.** This task supplies the build-time `VITE_CLOUD_DEPLOY=true` + `VITE_API_URL`/optional `VITE_WS_URL` contract the T5 Vercel step consumes; no secret or workflow exists yet. No credential value and no `.env*` change is introduced here.

Deviations from spec: none.

Notes: the only documentation change in this commit is this build log; `docs/architecture/*` and `README.md` are owned by T6 (`tasks.md` T6), and `docs/features/README.md` remains orchestrator-owned and untouched.
