# Build log — T5 — Frontend skeleton: React app + connection module

Task: T5 (2026-10-18) — `feat/stack-selection`
Status: **BLOCKED on AC-17's prod-build clause** — 5 of the 6 pinned verify commands exit 0; `podman build --target prod …` exits **125** on the pinned `FROM nginxinc/nginx-unprivileged:1.27-alpine` (Podman short-name policy), and the image `HEALTHCHECK` is inert under Podman 5's default OCI build format. Both are provider pin divergences reported for a decision in § Divergences — **no deliverable was worked around**; all ten files plus this log are committed as pinned on `feat/stack-selection` (`feat: frontend skeleton with connection module (T5)`).
Files changed: `src/frontend/tsconfig.json`, `src/frontend/vite.config.ts`, `src/frontend/vitest.config.ts`, `src/frontend/index.html`, `src/frontend/nginx.conf`, `src/frontend/Dockerfile`, `src/frontend/src/main.tsx`, `src/frontend/src/App.tsx`, `src/frontend/src/ws/connection.ts`, `src/frontend/src/ws/connection.test.ts`, `docs/features/stack-selection/build-log-T5.md`

**Sketch (≤5 lines):**
1. `connection.ts`: single lifecycle owner — state machine `connecting → connected → disconnected`, injectable `socketFactory`, `attempt` counter with `min(baseDelayMs * 2^(attempt-1), maxDelayMs)` backoff, retry while `attempt <= maxAttempts`, `close()` sets a `closed` latch (cancels timer, closes socket, nulls handlers) so no retry/status change follows.
2. `connection.test.ts`: `FakeSocket` + `vi.useFakeTimers()` — open→connected, close→disconnected, attempt cap, success resets counter, `close()` cancels retry + freezes status.
3. `App.tsx` renders title + `<span data-status={status}>` label from `createConnection` in one effect with `close()` cleanup; `main.tsx` mounts into `#root`.
4. Configs per `plan.md` contracts 9/11: tsconfig (bundler/react-jsx/DOM), `vite.config.ts` (host/5173/strictPort/allowedHosts + `define` VITE_WS_URL), `vitest.config.ts` (node), `index.html` (title CubeClicker), `nginx.conf` (8080 + SPA fallback).
5. `Dockerfile`: multi-stage `dev` (node:24-alpine, `npm ci`, HEALTHCHECK on 5173, `npm run dev -w @cubeclicker/frontend`) / `prod` (build stage → `nginxinc/nginx-unprivileged:1.27-alpine` serving `dist/`, HEALTHCHECK, non-root by image default).

## Baselines (build-start capture)

All ten T5 paths are net-new (baseline = absent). No pre-existing file is edited by T5; `package.json` / `package-lock.json` are T3-owned and untouched.

```
$ for f in src/frontend/tsconfig.json src/frontend/vite.config.ts src/frontend/vitest.config.ts src/frontend/index.html src/frontend/nginx.conf src/frontend/Dockerfile src/frontend/src/main.tsx src/frontend/src/App.tsx src/frontend/src/ws/connection.ts src/frontend/src/ws/connection.test.ts; do if [ -e "$f" ]; then echo "PRESENT $f"; else echo "ABSENT  $f"; fi; done
ABSENT  src/frontend/tsconfig.json
ABSENT  src/frontend/vite.config.ts
ABSENT  src/frontend/vitest.config.ts
ABSENT  src/frontend/index.html
ABSENT  src/frontend/nginx.conf
ABSENT  src/frontend/Dockerfile
ABSENT  src/frontend/src/main.tsx
ABSENT  src/frontend/src/App.tsx
ABSENT  src/frontend/src/ws/connection.ts
ABSENT  src/frontend/src/ws/connection.test.ts

$ git status --short -- src/frontend
(empty — T3's committed state only)

$ find src/backend -type f -not -path "*/node_modules/*"
src/backend/package.json        # T4 runs in parallel; its files are disjoint from T5's

$ podman --version
podman version 5.8.7
$ podman compose version
Docker Compose version v5.6.0   # provider delegation (matches build-log-T3.md Run 3)
```

## What changed & why

- `src/frontend/src/ws/connection.ts` — the single client-side connection-lifecycle owner (AC-22/AC-23): pinned `createConnection` interface, injectable socket for tests, bounded exponential-backoff retry, and a `close()` latch that cancels pending retries and freezes status.
- `src/frontend/src/ws/connection.test.ts` — fake-socket unit tests (status transitions, attempt cap, counter reset on successful open, close-cancels-retry) — no real socket, no real timers.
- `src/frontend/src/App.tsx` / `main.tsx` — minimal React shell: one connection created in an effect (cleanup calls `close()`), status text on a `data-status` element (AC-24), mounted into `#root`.
- Vite/Vitest/TS configs + `index.html` — dev server pinned to `host: true`, 5173, `strictPort`, `allowedHosts: ["frontend"]`; `VITE_WS_URL` injected via `define` from the environment with the pinned default.
- `Dockerfile` + `nginx.conf` — multi-stage `dev`/`prod`; prod is unprivileged nginx on 8080 with SPA fallback; both stages carry the pinned `HEALTHCHECK` (AC-17).

## Decisions

- **Retry-wait status (plan.md r2 note F8 defers this disambiguation; no AC tests it).** Chosen reading: `disconnected` is emitted when the drop happens (open/close/error event), and `connecting` is emitted when the retry timer fires and the next socket is actually created. Rationale: matches "`disconnected` after close/error" literally while keeping "`connecting`" meaningful as "a socket attempt is in flight"; it is also the most testable reading (deterministic timer boundaries).
- **Per-socket drop dedupe.** One socket can fire `error` then `close`; the first event per socket is the one that schedules the retry, so a single drop never consumes two attempts.
- **`process.env` in `vite.config.ts`.** `src/frontend/tsconfig.json` pins `types: ["vite/client"]` (plan.md contract 9), which keeps the frontend's *global* type surface browser-only; `vite.config.ts` is the one Node-side file, so it declares the single Node global it reads (`process`) narrowly, in-file. The pinned `define` value (`process.env.VITE_WS_URL ?? 'ws://localhost:8080/ws'`) is unchanged.
- **Dev-stage `COPY src/frontend`.** Both `dev` and `prod` copy the workspace source so each image is runnable standalone; compose's bind mount still shadows it for hot reload (contract 5).
- **No `StrictMode`.** Omitted deliberately: React's double-invoked effects would open and immediately close a second dev socket, adding no scaffold value. Revisit with the first gameplay feature.
- No manifest/lockfile edits (T3-owned); no dependency added.

## Evidence

### Pinned verify list

**1–4 (build host, green).** Consolidated run (`EXIT:` is the command's exit code):

```
### npm run typecheck -w @cubeclicker/frontend

> typecheck
> tsc --noEmit

EXIT:0

### npm test -w @cubeclicker/frontend

> test
> vitest run

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ws/connection.test.ts (9 tests) 17ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  10:58:53
   Duration  264ms (transform 31ms, setup 0ms, collect 31ms, tests 17ms, environment 0ms, prepare 58ms)

EXIT:0

### npm run lint

> lint
> eslint .

EXIT:0

### npm run build -w @cubeclicker/frontend

> build
> vite build

vite v7.3.7 building client environment for production...
transforming...
✓ 29 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                  0.32 kB │ gzip:  0.23 kB
dist/assets/index-C70WgBoq.js  223.76 kB │ gzip: 69.91 kB
✓ built in 627ms

EXIT:0
```

`tsc --noEmit --listFiles` proof that the configs (not only `src/`) are typechecked — `src/frontend/tsconfig.json` `include` → 6 workspace files:

```
/var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend/src/ws/connection.ts
/var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend/src/App.tsx
/var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend/src/main.tsx
/var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend/src/ws/connection.test.ts
/var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend/vite.config.ts
/var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend/vitest.config.ts
```

**5 — `podman build --target dev -f src/frontend/Dockerfile -t cubeclicker-frontend:dev-check .` → EXIT 0 (with a divergence warning, see § Divergences).** Transcript excerpt (final steps):

```
STEP 9/10: HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s   CMD node -e "fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
time="2026-10-18T10:55:14+02:00" level=warning msg="HEALTHCHECK is not supported for OCI image format and will be ignored. Must use `docker` format"
--> 2958cf44b6dd
STEP 10/10: CMD ["npm", "run", "dev", "-w", "@cubeclicker/frontend"]
COMMIT cubeclicker-frontend:dev-check
--> 00e3c828c83e
Successfully tagged localhost/cubeclicker-frontend:dev-check
00e3c828c83ec4f74c4b187da5ec9167367536b7dbb72be57653740635dc9483
EXIT:0
```

**6 — `podman build --target prod -f src/frontend/Dockerfile -t cubeclicker-frontend:prod-check .` → EXIT 125 (BLOCKED, see § Divergences).** Transcript excerpt (final steps):

```
[3/3] STEP 1/5: FROM nginxinc/nginx-unprivileged:1.27-alpine AS prod
Error: creating build container: short-name resolution enforced but cannot prompt without a TTY
EXIT:125
```

(The `build` stage completed fine before this step — `vite build` → `✓ built in 683ms`.)

### Divergence diagnostics (not part of the pinned verify list)

Environment:

```
$ podman --version
podman version 5.8.7
$ podman compose version
Docker Compose version v5.6.0
$ podman images
REPOSITORY                      TAG         IMAGE ID      CREATED          SIZE
<none>                          <none>      0fa256cd8286  19 seconds ago   310 MB
localhost/cubeclicker-frontend  dev-check   00e3c828c83e  42 seconds ago   308 MB
docker.io/library/node          24-alpine   b842533ff063  3 days ago       174 MB
ghcr.io/zelikos/davincibox      latest      e58598115a00  4 weeks ago      2.32 GB
```

**Divergence 1 — the pinned base-image token is unbuildable on this host (non-interactive).**

```
$ grep -n -i "nginx\|\"node\"" /etc/containers/registries.conf.d/000-shortnames.conf
148:  "node" = "docker.io/library/node"
160:  # nginx
161:  "nginx" = "docker.io/library/nginx"
# → no alias for `nginxinc/nginx-unprivileged`; `node` IS aliased (which is why every node-based
#   stage resolves and only the prod `FROM` fails)

$ grep -v "^#" /etc/containers/registries.conf | grep -v "^$"
unqualified-search-registries = ["registry.fedoraproject.org", "registry.access.redhat.com", "docker.io"]
short-name-mode = "enforcing"

$ podman pull nginxinc/nginx-unprivileged:1.27-alpine
Error: short-name resolution enforced but cannot prompt without a TTY
EXIT:125

$ podman pull docker.io/nginxinc/nginx-unprivileged:1.27-alpine
Copying blob sha256:f79056b7935ee1a11822640a4e32333a6fccfc86efddab21fd6d7300edf2d054
...
Writing manifest to image destination
47ce8258a10e28ce4b4498588c25ef77ae328f4c56cbe3e8d5dcf4f6d8019997
EXIT:0
```

Reading: the tag exists and the registries are reachable (fully-qualified pull succeeds). The failure is `short-name-mode = "enforcing"` with three `unqualified-search-registries` and no TTY: Podman cannot prompt for `nginxinc/nginx-unprivileged`. Docker resolves the same token against Docker Hub; Podman does not. `docker.io/nginxinc/nginx-unprivileged:1.27-alpine` is the canonical form of the same pinned image+tag.

**Divergence 2 — the image `HEALTHCHECK` is declared but inert (Podman 5 default OCI image format drops it).**

```
$ podman image inspect cubeclicker-frontend:dev-check    # built by the pinned command
Healthcheck: null

$ podman build --format docker --target dev -f src/frontend/Dockerfile -t cubeclicker-frontend:dev-fmt-diagnostic .
Successfully tagged localhost/cubeclicker-frontend:dev-fmt-diagnostic
EXIT:0
$ podman image inspect cubeclicker-frontend:dev-fmt-diagnostic
Healthcheck: {"Test": ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:5173/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""], "StartPeriod": 15000000000, "Interval": 10000000000, "Timeout": 3000000000, "Retries": 5}
```

Reading: the `HEALTHCHECK` instruction is present in the Dockerfile (and in the image history), but the pinned build command produces an OCI-format image where Podman ignores it — so the composed stack gets **no** health signal at runtime, while `compose.yaml` deliberately relies on the image healthcheck ("Health signals come from each image's HEALTHCHECK (no duplicate healthcheck here)", contract 5) and `containerization.md`'s settled conventions pin "`GET /healthz` + image `HEALTHCHECK`" (AC-5). The dev-format diagnostic image is only a characterization aid — it is **not** the pinned verify command and no deliverable was changed to use it.

### Inspection evidence for the acceptance audit

```
$ grep -n "data-status\|STATUS_LABEL\|VITE_WS_URL\|createConnection" src/frontend/src/App.tsx
3:import { createConnection, type ConnectionStatus } from './ws/connection';
5:/** Injected by `vite.config.ts` `define` from `VITE_WS_URL` (pinned default). */
6:const WS_URL: string = import.meta.env.VITE_WS_URL;
8:const STATUS_LABEL: Record<ConnectionStatus, string> = {
19:    const connection = createConnection({ url: WS_URL, onStatus: setStatus });
30:        <span data-status={status}>{STATUS_LABEL[status]}</span>
# lines 9–11 of STATUS_LABEL: 'Connecting…' / 'Connected' / 'Disconnected' (pinned texts)

$ grep -n "allowedHosts\|strictPort\|port\|host\|process.env.VITE_WS_URL\|declare const" src/frontend/vite.config.ts
7:declare const process: { env: Record<string, string | undefined> };
10:const DEFAULT_WS_URL = 'ws://localhost:8080/ws';
15:    host: true,
16:    port: 5173,
17:    strictPort: true,
20:    allowedHosts: ['frontend'],
23:    'import.meta.env.VITE_WS_URL': JSON.stringify(process.env.VITE_WS_URL ?? DEFAULT_WS_URL),

$ grep -o "ws://localhost:8080/ws" src/frontend/dist/assets/index-C70WgBoq.js | head -1
ws://localhost:8080/ws          # the pinned default is literally inlined by `define`
$ grep -o "Connecting…\|Connected\|Disconnected" src/frontend/dist/assets/index-C70WgBoq.js | sort -u
Connected
Connecting…
Disconnected

$ grep -n "listen\|try_files\|root " src/frontend/nginx.conf
4:    listen 8080;
7:    root /usr/share/nginx/html;
12:        try_files $uri /index.html;

$ grep -n "FROM\|HEALTHCHECK\|EXPOSE\|CMD\|RUN npm" src/frontend/Dockerfile
6:FROM node:24-alpine AS dev
14:RUN npm ci
19:EXPOSE 5173
22:HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s \
23:  CMD node -e "fetch('http://127.0.0.1:5173/')..."     # dev health signal on the Vite port
25:CMD ["npm", "run", "dev", "-w", "@cubeclicker/frontend"]
28:FROM node:24-alpine AS build
35:RUN npm ci
38:RUN npm run build -w @cubeclicker/frontend
41:FROM nginxinc/nginx-unprivileged:1.27-alpine AS prod
46:EXPOSE 8080
48:HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s \
49:  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

$ grep -n "environment" src/frontend/vitest.config.ts
5:    environment: 'node',

$ git status --short -- src/frontend
?? src/frontend/Dockerfile
?? src/frontend/index.html
?? src/frontend/nginx.conf
?? src/frontend/src/
?? src/frontend/tsconfig.json
?? src/frontend/vite.config.ts
?? src/frontend/vitest.config.ts
# `dist/` is git-ignored (no build output staged); no manifest/lockfile touched:
$ git status --short -- package.json package-lock.json src/frontend/package.json
(empty)
```

## Acceptance audit

| AC | Status | Evidence |
| --- | --- | --- |
| **AC-17** — `src/frontend/Dockerfile` multi-stage with `dev` and `prod`; both build; dev runs Vite on 5173; prod serves `dist/` as non-root unprivileged nginx on 8080 with SPA fallback + `HEALTHCHECK` | **partly met — blocked on the prod verify command** | Source-level pins all present (inspection above: `AS dev`/`AS build`/`AS prod`, `FROM nginxinc/nginx-unprivileged:1.27-alpine AS prod`, `nginx.conf` → `listen 8080` + `try_files $uri /index.html`, `dist/` copied to `/usr/share/nginx/html/`, `HEALTHCHECK` in both runtime stages, non-root by image default). `podman build --target dev` → EXIT 0. **`podman build --target prod` → EXIT 125** (`short-name resolution enforced but cannot prompt without a TTY`) → the "both build, exit 0" clause is unmet on this host; see § Divergences item 1 (needs a plan-pin decision — not improvised). |
| **AC-22** — `connection.ts` single lifecycle owner with the pinned interface; unit tests cover connecting→connected and disconnected on close; `npm test -w @cubeclicker/frontend` passes | **met** | `connection.ts` exports exactly `ConnectionStatus`, `ConnectionOptions` (all five pinned fields + `socketFactory`) and `createConnection(options): { close(): void }`; no DOM access, socket injected via `socketFactory`; tests "starts in `connecting` and reports `connected` on open" and "reports `disconnected` when the socket drops…" → `9 passed (9)` / EXIT 0. |
| **AC-23** — bounded reconnection with exponential backoff to a pinned cap, counter reset on successful open, `close()` cancels retries; tests cover the cap and the close-cancels-retry path | **met** | `scheduleRetry()` → `attempt += 1`, stop when `attempt > maxAttempts`, delay `min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs)`; `close()` sets the `closed` latch, `clearTimeout`s the pending retry, nulls the socket handlers and calls `socket.close()`. Tests: "stops retrying once the attempt cap is reached" (3 sockets, then `advanceTimersByTime(60_000)` adds none), "caps the backoff delay at maxDelayMs" (1000 → 1500ms), "resets the retry counter after a successful open" (100ms again, not 200ms), "close() cancels a pending retry and prevents further status changes", "close() closes the live socket and is idempotent", "consumes exactly one attempt per dropped socket (error + close dedupe)", "ignores a drop that arrives after close()" → EXIT 0. |
| **AC-24** — `App.tsx` renders module-driven status ("Connecting…"/"Connected"/"Disconnected") on a `data-status` element; `VITE_WS_URL` default `ws://localhost:8080/ws` injected through `vite.config.ts` | **met** | `App.tsx:6,20,29` (WS URL from the injected define; one `createConnection` in an effect, cleanup `close()`; `data-status={status}` + the three pinned labels); `vite.config.ts:27` injects `import.meta.env.VITE_WS_URL` from `process.env.VITE_WS_URL ?? 'ws://localhost:8080/ws'`; the built bundle contains the literal `ws://localhost:8080/ws` and all three status labels; `compose.yaml` (T3) passes `VITE_WS_URL: "${VITE_WS_URL:-ws://localhost:8080/ws}"` — same token, consistent values. |

## Divergences from spec

Two provider-level divergences were found on the **first live use** of the pinned `podman build` form (exactly the `plan.md` § Risks case: "A provider rejection or behavioral divergence is a `blocked` report / spec gap — never an improvised substitute command"). **No deliverable was changed to work around either; both are reported for a pin decision.**

1. **`podman build --target prod` fails on the pinned `FROM` token (EXIT 125).** `FROM nginxinc/nginx-unprivileged:1.27-alpine` is an unqualified name; this host runs `short-name-mode = "enforcing"` with three `unqualified-search-registries` and no `[aliases]` entry for it, so Podman must prompt and cannot (no TTY). `node:24-alpine` is unaffected (`"node" = "docker.io/library/node"` alias), so every node-based stage — backend T4, frontend dev/build — resolves; only the prod frontend stage fails. Docker resolves this token against Docker Hub; Podman does not. The image and tag are fine (`podman pull docker.io/nginxinc/nginx-unprivileged:1.27-alpine` → EXIT 0).
   - **Candidate A (recommended):** qualify the two pinned base images in the Dockerfiles with their registry host — `docker.io/nginxinc/nginx-unprivileged:1.27-alpine` (T5) and, for symmetry/robustness, `docker.io/library/node:24-alpine` (T4/T5). Same image identity and tags, provider-neutral, no security downgrade; needs two one-line pin updates (`plan.md` § Interfaces "Base images"/"Prod images" + § Dependency manifest "images" rows). Image names/tags stay as pinned.
   - **Candidate B:** keep the tokens as written and record a **user-owned host prerequisite** (Podman short-name policy), e.g. `~/.config/containers/registries.conf` with an `[aliases]` entry `"nginxinc/nginx-unprivileged" = "docker.io/nginxinc/nginx-unprivileged"` (or `unqualified-search-registries = ["docker.io"]`), documented in `README.md` Prerequisites + `containerization.md`. No repo build-file change, but a stock host fails the pinned command and the alternative `short-name-mode = "permissive"` is a security downgrade.
2. **The image `HEALTHCHECK` is inert at runtime.** Podman 5's default build format is OCI, which ignores `HEALTHCHECK` (build warning + `podman image inspect` → `Healthcheck: null`); with `--format docker` the pinned instruction is retained with the pinned numbers. Consequence: `compose.yaml` (which deliberately declares no healthcheck and relies on the image's) and `containerization.md`'s settled "health signal (`GET /healthz` + image `HEALTHCHECK`)" convention produce **no health signal** on this host — relevant to AC-26's "both services healthy" step (T6) and to AC-5's effect. Note the source-level ACs (AC-16/AC-17 "declares a `HEALTHCHECK`") are still satisfied as written.
   - **Candidate A:** build with Docker-format manifests (`podman build --format docker`, or `BUILDAH_FORMAT=docker` in the environment/compose invocation) — one documented flag; keeps the image-level healthcheck convention intact. This changes a pinned command form (T4/T5 verify lists, T6 `up --build`), so it needs a plan/task pin update.
   - **Candidate B:** move the health signal to the compose layer (per-service `healthcheck:` in `compose.yaml`) — but contract 5 explicitly forbids healthcheck duplication, so this is a plan change.
   - **Candidate C:** accept source-level declarations only and record the runtime limitation (healthchecks are honoured on Docker; Podman 5 OCI builds drop them) as a documented, provider-neutral caveat with T6's `--wait` behavior recorded per AC-26's contingency.

Otherwise: no out-of-scope edits; no manifest/lockfile change; no `.env*`; no push.
