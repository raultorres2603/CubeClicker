# Build log — T5 — Documentation and final verification

Task: T5 (2026-11-12)
Files changed:
- `README.md` (edit: `npm run build` budget purpose, `npm run smoke` prod-delivery purpose, production static-delivery paragraph)
- `docs/architecture/containerization.md` (edit: `## Frontend static delivery` + the `compose.smoke.yaml` service bullet)
- `docs/architecture/frontend-rendering.md` (edit: `## Loading and code splitting`, verification build/smoke commands, scoped smoke sentence)
- `docs/features/frontend-delivery-hardening/build-log-T5.md` (this file)
- Committed without editing (`commits_also`): `spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/**`, `build-log-T1.md`, `build-log-T2.md`, `build-log-T3.md`, `build-log-T4.md`

What changed & why:
- `README.md` now states that **The frontend build enforces the bundle budget** (initial 150,000 B, Three.js 165,000 B, total 300,000 B gzip), that `npm run smoke` includes the production static-delivery checks, and — in § Production images — documents the code-split Three.js-free entry, gzip level 6, immutable hashed `/assets/*`, `no-cache` shell/SPA fallback, and that **Brotli is not enabled** because the base image has no `ngx_brotli` module and a custom nginx build is out of scope.
- `docs/architecture/containerization.md` gains `## Frontend static delivery` with the plan's header matrix, the smoke-only `frontend-prod` service (prod target, no published host port, `condition: service_started`, bounded readiness poll before assertions), the unchanged `compose.yaml`/`podman compose up` path, the unchanged health/WebSocket/environment conventions, and the gzip-only brotli reason. The existing `compose.smoke.yaml` bullet now lists both `smoke` and `frontend-prod`.
- `docs/architecture/frontend-rendering.md` gains `## Loading and code splitting` covering the Three-free entry, the gate-close runtime dynamic import with loading/error/retry and the preserved intro clock, the deferred customization preview, the chunk graph, and the bundle-budget gate. `## Verification` now lists `npm run build` (budget gate) and `npm run smoke` (production static-delivery proof), names the new suites, and the old "No `npm run smoke` gate applies" sentence is scoped to the rendering-behavior contract instead of the new static-delivery gate.
- No application code, container asset, workflow, root manifest, or lockfile changed. `docs/features/README.md` was not edited; the proposed orchestrator row is recorded below.

Decisions:
- Docs use the concrete fresh-build values (95,903 / 154,323 / 273,854 B) and `<hash>` placeholders for file names, because hashes change on every source change while the ceilings and measurement rules are stable.
- The exact pinned phrases are used verbatim in `README.md`; the exact section headings are used verbatim in both architecture docs.
- The edited docs were link-checked with a local resolver: `frontend-rendering.md` has 22 relative links, all resolving; `README.md` and `containerization.md` use inline code paths only (no relative markdown links).
- The smoke run used the prod image built by T4 (`cubeclicker-frontend:prod-smoke`); it served the same `assets/index-Cu7lmcVH.js` / `assets/three-4rmoIDEa.js` hashes produced by the fresh T5 build, so the wire proof matches the current tree. The docs-only T5 change cannot alter the image.

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

- `npm test` → exit 0 (two workspaces; 2,681 tests total)
```
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/backend

 Test Files  24 passed (24)
      Tests  868 passed (868)

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 Test Files  69 passed (69)
      Tests  1813 passed (1813)
TEST_EXIT=0
```
  The jsdom WebGL "not implemented" stderr lines are the pre-existing `SpaceshipPreview` no-WebGL fallback noise.

- `npm run coverage` → exit 0, thresholds ≥ 80 in both workspaces (statements / branches / functions / lines)
```
src/backend  All files  | 95.43 | 87.71 |  99.7 | 95.43 |
src/frontend All files  | 96.42 |  96.1 | 97.53 | 96.42 |
COVERAGE_EXIT=0
```
  Per workspace: **backend 95.43 / 87.71 / 99.70 / 95.43**, **frontend 96.42 / 96.10 / 97.53 / 96.42**. No coverage exclusion or threshold change was added by this feature; the budget script, Vite config, and nginx config remain test-level covered (`bundle-budget.test.ts`, `vite-config.test.ts`, `nginx-config.test.ts`).

- `npm run build` → exit 0 (fresh Vite build + bundle-budget gate; values unchanged from T3)
```
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
✓ 104 modules transformed.
dist/index.html                                        0.49 kB │ gzip:   0.30 kB
dist/.vite/manifest.json                               1.37 kB │ gzip:   0.38 kB
dist/assets/index-CWGWNrMl.css                        26.36 kB │ gzip:   5.32 kB
dist/assets/cursor-ship-fi2YCtK6.js                    6.73 kB │ gzip:   2.21 kB
dist/assets/SpaceshipCustomizationPanel-PD8H8p33.js    9.54 kB │ gzip:   3.34 kB
dist/assets/browser-env-CX-sYLqK.js                   48.95 kB │ gzip:  18.08 kB
dist/assets/index-Cu7lmcVH.js                         87.06 kB │ gzip:  26.95 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-4rmoIDEa.js                        609.34 kB │ gzip: 154.32 kB
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
BUILD_EXIT=0
```

- Fresh-report / index-link proof (AC-1, AC-5, AC-6) → exit 0
```
$ grep -qE 'rel="(modulepreload|preload)"[^>]*href="[^"]*three-' src/frontend/dist/index.html
NO_THREE_PRELOAD_GREP_EXIT=1   # grep found nothing → the negation passes
links: ["<link rel=\"modulepreload\" crossorigin href=\"/assets/react-BYqCGoBQ.js\">","<link rel=\"stylesheet\" crossorigin href=\"/assets/index-CWGWNrMl.css\">"]
three links: []
entry: assets/index-Cu7lmcVH.js
initial.files: ["assets/index-Cu7lmcVH.js","assets/react-BYqCGoBQ.js"]
initial.gzipBytes: 95903
three.file: assets/three-4rmoIDEa.js
three.gzipBytes: 154323
three.initial: false
total.gzipBytes: 273854
budgets: {"initialGzipBytes":150000,"threeGzipBytes":165000,"totalGzipBytes":300000}
entry.dynamicImports: ["src/browser-env.ts","src/ui/SpaceshipCustomizationPanel.tsx"]
entry.staticImports: ["_react-BYqCGoBQ.js"]
```

- `npm run smoke` (`podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`) → exit 0, **19/19 checks**
```
smoke: backend=http://backend:8080 frontend=http://frontend:5173 prodFrontend=http://frontend-prod:8080 ws=ws://backend:8080/ws readyTimeoutMs=30000
PASS backend http://backend:8080/healthz responds 200 with {"status":"ok"}
PASS frontend http://frontend:5173/ responds 200 with text/html
PASS websocket client 1 received hello from ws://backend:8080/ws
PASS websocket client 2 received hello from ws://backend:8080/ws
PASS multiplayer join: two clients land on the same server (maxUsers 2) with roster sizes 1 then 2 and A receives memberJoined — server 1
PASS multiplayer overflow: the third client lands on the next server id (X = 2) — server 2
PASS multiplayer sync: A's valid explode yields miniCubeRemoved on A (ack) and B (broadcast)
PASS multiplayer leave: closing B's socket yields memberLeft(left) on A after the 1s grace window — memberLeft(left) received after 1002ms
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
  The production readiness check is the first prod request; every header/body assertion runs after it. The smoke-only `frontend-prod` container carries no published host port.

- Pinned docs checks → all exit 0
```
grep -F 'The frontend build enforces the bundle budget' README.md               → exit 0
  README.md:48: | `npm run build` | build all workspaces. The frontend build enforces the bundle budget (initial 150,000 B, Three.js 165,000 B, total 300,000 B gzip) and fails on a violation |
grep -F 'Brotli is not enabled' README.md                                       → exit 0
  README.md:94: … Brotli is not enabled: the `nginxinc/nginx-unprivileged:1.27-alpine` base image has no `ngx_brotli` module, and a custom nginx build is out of scope.
grep -F '## Frontend static delivery' docs/architecture/containerization.md     → exit 0
  docs/architecture/containerization.md:43: ## Frontend static delivery
grep -F '## Loading and code splitting' docs/architecture/frontend-rendering.md → exit 0
  docs/architecture/frontend-rendering.md:59: ## Loading and code splitting
test -z "$(git status --porcelain -- docs/features/README.md)"                  → exit 0 (index untouched)
git diff --exit-code -- compose.yaml src/frontend/Dockerfile package.json package-lock.json → exit 0 (no diff)
```

- Edited-doc link check → all resolvable
```
README.md links=0 bad=[]
docs/architecture/containerization.md links=0 bad=[]
docs/architecture/frontend-rendering.md links=22 bad=[]
```
  (`README.md` and `containerization.md` reference paths as inline code, not markdown links; the 22 relative links in `frontend-rendering.md` resolve to existing files.)

Environment note: the dev stack was stopped (`podman compose down`, volumes preserved) so the smoke override's `MAX_USERS_PER_SERVER=2` / `RECONNECT_GRACE_MS=1000` configuration was exercised, then restored with `podman compose up -d`; the leftover smoke-only `frontend-prod` container was removed afterwards. `compose.yaml`, `src/frontend/Dockerfile`, root `package.json`/`package-lock.json`, and `.github/workflows/ci.yml` were not edited.

Proposed feature-index row for the orchestrator (`docs/features/README.md` is orchestrator-owned and was not edited):

```
| frontend-delivery-hardening | Frontend Delivery Hardening (gate-deferred three.js chunk, bundle budget, nginx gzip/immutable assets, prod smoke) | planning | 2026-11-12 |
```

Acceptance audit:
- AC-1 → **met**: fresh `dist/bundle-report.json` has `initial.files = ["assets/index-Cu7lmcVH.js", "assets/react-BYqCGoBQ.js"]` (no three file); the manifest entry's static `imports` are only the React vendor with `browser-env`/`SpaceshipCustomizationPanel` in `dynamicImports`; `dist/index.html` has no `modulepreload`/`preload` link containing `three-`; `bundle-budget.test.ts` pins the initial-closure exclusion (T3 log).
- AC-2 → **met**: T1 session status/loader/retry/StrictMode tests and T2 `GameCanvas.runtime.test.tsx`/`App.test.tsx` are green in the full suite; the exact copy and canvas invariance are pinned in the T1/T2 logs.
- AC-3 → **met**: the accepted attach/dispose, hidden-tab, transport-order, welcome and intro-clock tests remain green; T1's deferred-vs-immediate intro test pins `16 / introMs` and zero `engine.advance` during loading.
- AC-4 → **met**: `DeferredSpaceshipCustomizationPanel.test.tsx`, the async `App.test.tsx` customization assertions, and the AC-1 build graph (panel not in the entry) are green.
- AC-5 → **met**: `src/frontend/package.json` runs `vite build && node scripts/check-bundle-budget.mjs`; the fresh root build exits 0; `bundle-budget.test.ts` pins all five violation conditions; the Docker `build` stage and CI Build step inherit the exit code (T3 log).
- AC-6 → **met**: fresh values initial **95,903 B** ≤ 150,000, three **154,323 B** ≤ 165,000, total **273,854 B** ≤ 300,000; no ceiling changed in T5 (T3 r3 log).
- AC-7 → **met**: `nginx-config.test.ts` passes and the live smoke asserts gzip, `Vary`, immutable hashed assets, `no-cache` shell/fallback, and the missing-asset 404 (T4 log + the 19/19 output above).
- AC-8 → **met**: `docs/architecture/containerization.md` § Frontend static delivery states delivery is gzip-only, why brotli is not enabled (no `ngx_brotli` in the base image; a custom build would be required), and that the custom build is out of scope; T4's `nginx -V` probe shows zero brotli matches and `nginx-config.test.ts` asserts no brotli directive.
- AC-9 → **met**: the smoke-only `frontend-prod` service (prod target, no ports, `service_started`) and the bounded readiness poll precede all prod assertions; all seven prod checks pass within the 19/19 run; T4 records the Q-9 auto-build result and fallback.
- AC-10 → **met**: `npm test` is green (868 backend + 1,813 frontend), `npm run coverage` exits 0 with backend 95.43/87.71/99.70/95.43 and frontend 96.42/96.10/97.53/96.42; no exclusion/threshold change and no test weakened.
- AC-11 → **met**: both exact README strings, both exact section headings, and the 22-link resolution check pass; `docs/features/README.md` is untouched; the proposed row is recorded above.

Deviations from spec: none.

## Commit stat

`git show --stat --format=%s HEAD` for the T5 commit:
```
docs: document frontend delivery hardening

 README.md                                          |   6 +-
 docs/architecture/containerization.md              |  22 +-
 docs/architecture/frontend-rendering.md            |  31 ++-
 .../frontend-delivery-hardening/build-log-T5.md    | 211 ++++++++++++++
 docs/features/frontend-delivery-hardening/plan.md  | 285 +++++++++++++++++++++
 .../reviews/spec-review-r1.md                      |  65 +++++
 .../reviews/spec-review-r2.md                      |  82 ++++++
 .../reviews/spec-review-r3.md                      |  72 ++++++
 docs/features/frontend-delivery-hardening/spec.md  | 148 +++++++++++
 .../features/frontend-delivery-hardening/status.md |  47 ++++
 docs/features/frontend-delivery-hardening/tasks.md |  79 ++++++
 11 files changed, 1042 insertions(+), 6 deletions(-)
```

