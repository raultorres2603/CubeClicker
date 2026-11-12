---
feature: frontend-delivery-hardening
revision: 3
---
# Plan — Frontend Delivery Hardening

## Architecture

Three delivery changes, each behind an existing seam:

1. **Chunk graph / runtime deferral (session + UI).** The entry graph stays `index.html → main.tsx → App` plus React, the auth/HUD UI, the DOM-free game engine, and the session core. The session's static imports of `browser-env`, `render/scene`, and `render/picking` are removed; the Three-touching scene/picking functions arrive through a new `SessionEnvironment.renderRuntime` field. When no environment is injected, `session.attach(canvas)` sets a session-owned runtime status to `loading` and dynamically imports `browser-env`; the loader runs before the start body and never advances the engine. The resolved environment starts the existing attach body (scene, renderer, listeners, transport, one frame) and flips the status to `ready`. The start body's frame baseline is the runtime-start time, so the loader's elapsed time is never passed to `engine.advance`: the intro clock stays anchored at gate close and the load is skipped, not consumed (the accepted `adaptive-render-budget-v2` Q-2 timing is preserved). A rejection flips the status to `error`; `GameCanvas` renders the loading/error/retry UI from that status. `GameCanvas` still calls `session.attach(canvas)` with one argument, so injected-environment tests and the accepted gate-deferred attach contract are unchanged.
2. **Customization preview deferral (UI).** `App` renders a small `DeferredSpaceshipCustomizationPanel` wrapper instead of the panel. The wrapper's effect dynamically imports `SpaceshipCustomizationPanel` (which imports `SpaceshipPreview → render/preview → three`) only when the panel is open; it owns the loading/error/retry states and forwards the existing props.
3. **Build budget + nginx delivery.** `vite.config.ts` adds `build.manifest`, function-form `manualChunks` (`three`, `react`), and a chunk-warning limit. `package.json` chains `vite build` with `node scripts/check-bundle-budget.mjs`, which reads the fresh manifest, gzip-measures each JS file at level 6, writes `dist/bundle-report.json`, and fails on the approved ceilings or a Three-free initial graph violation. The approved r3 ceilings are **initial 150,000 B, three 165,000 B, total 300,000 B gzip**. The fresh post-split build measured entry `assets/index-Cu7lmcVH.js`, initial `[index, react]` 95,903 B, three `assets/three-4rmoIDEa.js` 154,323 B, and total 273,854 B; the audit's 131,382 B was the unminified `three.module.js`, so the minified production Three chunk compresses to a larger gzip size despite a smaller raw size (609,337 B vs 662,772 B). The prod nginx config gains gzip and the cache-header matrix; a smoke-only `frontend-prod` compose service lets `tests/e2e/smoke.mjs` assert the real image's headers and chunk graph. The smoke performs a bounded readiness poll of the prod `/` (the existing `READY_TIMEOUT_MS`) before header assertions; the CI smoke must build the `frontend-prod` dependency or use the exact `--build` prerequisite documented in Q-9.

### Chunk graph (expected shape)

```
index.html
  └─ assets/index-<hash>.js            entry: main/App/auth/HUD/session core
       ├─ static: assets/react-<hash>.js        react, react-dom, scheduler
       └─ dynamic:
            ├─ <game-runtime>-<hash>.js         browser-env → webgl/scene/picking
            │     └─ static: assets/three-<hash>.js
            └─ <customization>-<hash>.js        panel → preview
                  └─ static: assets/three-<hash>.js
```

`three` and `react` names are pinned by `manualChunks`; the dynamic chunk names are not pinned. The `three` vendor chunk is shared by the game runtime and the customization panel and must never appear in the entry's static closure.

### Data flow: game runtime status

```
gateState.view === 'menu'   ──► GameCanvas active=false ──► no attach, no import
gateState.view === 'closed' ──► GameCanvas effect ──► session.attach(canvas)
      session: runtimeStatus 'idle' → 'loading'
      loadEnvironment(canvas) ──► import('../browser-env') ──► browserEnvironment(canvas)
      resolve ──► start(env): engine random source, scene, renderer, listeners,
                  transport subscribe → connect, status 'ready'
                  (frameBaselineMs = env.now(); the loader ran before this body and
                   never advanced engine.advance, so the intro stays at progress 0
                   plus the post-attach dt)
      reject  ──► runtimeStatus 'error' (no scene/listener/frame/connect)
GameCanvas subscribes runtimeStatus:
      'loading' → role="status"  Loading the game…
      'error'   → role="alert"   The game could not be loaded. [Try again]
      'ready'   → no status element; canvas unchanged
```

The intro-clock rule is the F1 resolution: the loader runs before the start body and never advances the engine; `frameBaselineMs` is set at the runtime start, so a 500 ms loader and an immediate loader produce the same intro progress after the same post-attach frame delta. The loader is a loading state, not part of the cinematic; no `Q-4` user decision and no `adaptive-render-budget-v2` supersession. `dispose()` during `loading` sets `active = false`, increments an attach generation, resets the status to `idle`, and the later resolution is ignored. `attach` while `loading` or `active` is idempotent; `attach` after `error` starts a fresh load (retry). With `options.env`, `start` runs synchronously and the status is set to `ready`; the loader is never called. A StrictMode-shaped mount → unmount → remount cancels the first loader via the generation token and starts only the second (two loader calls, one start).

### Data flow: deferred customization panel

```
customizationOpen=false ──► wrapper not rendered ──► no import
customizationOpen=true  ──► wrapper effect:
      loadPanel() ──► import('./SpaceshipCustomizationPanel')
      pending → role="status"  Loading customization…
      resolve → render <SpaceshipCustomizationPanel {...props} />
      reject  → role="alert"   Customization could not be loaded. [Try again]
```

### nginx header matrix

| Request | Served | `Content-Encoding` | `Cache-Control` |
| --- | --- | --- | --- |
| `GET /` | `index.html` | `gzip` (body > `gzip_min_length`) | `no-cache` |
| `GET /index.html` | `index.html` | `gzip` | `no-cache` |
| `GET /assets/index-<hash>.js` | hashed entry | `gzip` | `public, max-age=31536000, immutable` |
| `GET /assets/three-<hash>.js` | hashed lazy vendor | `gzip` | `public, max-age=31536000, immutable` |
| `GET /bundle-report.json` | build metadata | `gzip` | `no-cache` |
| `GET /missing/route` | `index.html` (SPA fallback) | `gzip` | `no-cache` |
| `GET /assets/missing.js` | nginx 404 | not asserted | no long-cache header |

`gzip_vary on` adds `Vary: Accept-Encoding`. `text/html` is always compressed by nginx when `gzip on`; the explicit `gzip_types` list covers JS/CSS/JSON/manifest/SVG. `add_header` is declared per location (no cross-location inheritance reliance). Hashed assets are content-addressed, so immutable caching is safe; the shell is revalidated so a deploy is picked up.

## Interfaces / contracts

```ts
// game/session.ts
export type RuntimeStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface RenderRuntime {
  createSceneView(options: SceneViewOptions): SceneView;
  pickHoverTarget(
    camera: PerspectiveCamera,
    cubeView: CubeView,
    frontFaceId: FaceId,
    ndcX: number,
    ndcY: number,
  ): HoverPick;
  pickMiniCube(
    camera: PerspectiveCamera,
    cubeView: CubeView,
    frontFaceId: FaceId,
    ndcX: number,
    ndcY: number,
  ): MiniCubeId | null;
}

export interface SessionEnvironment {
  // …existing fields…
  renderRuntime: RenderRuntime;
}

export interface GameSession {
  attach(canvas: CanvasLike): void; // still one argument; env resolution is internal
  dispose(): void;
  // …existing fields…
  /** Optional for source compatibility with existing test fakes; createGameSession implements them. */
  getRuntimeStatus?(): RuntimeStatus;
  subscribeRuntime?(listener: () => void): () => void;
}

export interface GameSessionOptions {
  // …existing options…
  /** Test seam; production default is `import('../browser-env')`. */
  loadEnvironment?: (canvas: CanvasLike) => Promise<SessionEnvironment>;
}

// render/scene.ts
export interface SceneViewOptions {
  style: CubeStyle;
  gridSize?: number;
  random?: () => number;
  ownPosition?: Position;
  appearance?: Record<string, string>;
}
export function createSceneView(options: SceneViewOptions): SceneView;
```

```ts
// src/frontend/scripts/check-bundle-budget.mjs (report written to dist/bundle-report.json)
export interface BundleReport {
  version: 1;
  budgets: { initialGzipBytes: 150000; threeGzipBytes: 165000; totalGzipBytes: 300000 };
  entry: { name: string; file: string; gzipBytes: number; rawBytes: number };
  initial: { files: string[]; gzipBytes: number; rawBytes: number };
  three: { file: string; name: 'three'; initial: false; gzipBytes: number; rawBytes: number } | null;
  total: { files: string[]; gzipBytes: number; rawBytes: number };
  chunks: Array<{ name: string; file: string; initial: boolean; gzipBytes: number; rawBytes: number }>;
}
```

- The budget script exports pure helpers (`initialClosure`, `buildReport`, `evaluateReport`, `formatReport`) plus `BUDGETS`; `check-bundle-budget.d.mts` declares them for the TypeScript test.
- `initial` is the entry chunk plus the recursive static `imports` closure (including the `react` vendor); `dynamicImports` are not followed. `total` is every JS file in the manifest, deduped.
- `manualChunks(id)` returns `'three'` for `/node_modules/three/`, `'react'` for `/node_modules/react/`, `/node_modules/react-dom/`, and `/node_modules/scheduler/`, otherwise `undefined`.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/game/session.ts` | Edit | runtime status store, `loadEnvironment`, `renderRuntime` usage, gate-close intro elapsed skip, remove static Three-touching imports |
| `src/frontend/src/game/session.test.ts` | Edit | deferred-loader/status/retry/dispose-while-loading tests; env fixture gains `renderRuntime` |
| `src/frontend/src/game/session-spaceship.test.ts` | Edit | env fixtures gain `renderRuntime` |
| `src/frontend/src/browser-env.ts` | Edit | expose `renderRuntime` from `render/scene`/`render/picking` |
| `src/frontend/src/browser-env.test.ts` | Edit | assert the runtime function set; mock the render modules |
| `src/frontend/src/render/scene.ts` | Edit | export `SceneViewOptions` (type only) |
| `src/frontend/src/ui/GameCanvas.tsx` | Edit | subscribe runtime status; loading/error/retry UI; canvas unchanged |
| `src/frontend/src/ui/GameCanvas.test.tsx` | Edit | env fixture gains `renderRuntime`; existing gate-discipline assertions unchanged |
| `src/frontend/src/ui/GameCanvas.runtime.test.tsx` | New | loading/ready/error/retry/active=false status tests |
| `src/frontend/src/ui/DeferredSpaceshipCustomizationPanel.tsx` | New | lazy panel loader with loading/error/retry |
| `src/frontend/src/ui/DeferredSpaceshipCustomizationPanel.test.tsx` | New | resolved/rejected/retry/closed tests with injected `loadPanel` |
| `src/frontend/src/App.tsx` | Edit | render the deferred panel wrapper |
| `src/frontend/src/App.test.tsx` | Edit | async customization-panel assertions; existing gate attach tests unchanged |
| `src/frontend/src/ui/game-view.css` | Edit | `.game-runtime-status` / `.game-runtime-error` styling |
| `src/frontend/src/ui/game-view.css.test.ts` | Edit | class/declaration assertions |
| `src/frontend/vite.config.ts` | Edit | `build.manifest`, `manualChunks`, chunk warning limit |
| `src/frontend/src/build/vite-config.test.ts` | New | static Vite config pins |
| `src/frontend/scripts/check-bundle-budget.mjs` | New | fresh-manifest gzip budget gate + report |
| `src/frontend/scripts/check-bundle-budget.d.mts` | New | declarations for the budget helper test |
| `src/frontend/src/build/bundle-budget.test.ts` | New | manifest graph/size/budget unit tests |
| `src/frontend/package.json` | Edit | `build` = `vite build && node scripts/check-bundle-budget.mjs` |
| `src/frontend/nginx.conf` | Edit | gzip and cache-header matrix |
| `src/frontend/src/build/nginx-config.test.ts` | New | static nginx config assertions |
| `compose.smoke.yaml` | Edit | smoke-only `frontend-prod` service (prod target, no host port) |
| `tests/e2e/smoke.mjs` | Edit | prod header/graph/SPA/404 checks via raw HTTP + gzip |
| `README.md` | Edit | budget command, gzip/cache, gzip-only brotli note |
| `docs/architecture/containerization.md` | Edit | static-delivery section + smoke-only prod service |
| `docs/architecture/frontend-rendering.md` | Edit | `## Loading and code splitting` + verification update |
| `docs/features/frontend-delivery-hardening/build-log-T1.md` … `build-log-T5.md` | New | raw evidence per task |
| `docs/features/README.md` | **Not edited** | Orchestrator-owned; T5 records the proposed row |
| `compose.yaml`, `src/frontend/Dockerfile`, `src/backend/**`, root `package.json`, `package-lock.json` | **Not edited** | Preserve the local path, image build, and dependency graph |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Session owns the environment loader and a runtime-status store | Keeps `GameCanvas.attach(canvas)` one-argument and synchronous for injected environments; preserves all accepted session tests; the UI observes status instead of owning the loader | GameCanvas-owned import (would override injected environments and force async rewrites across `App.test`/`GameCanvas.test`) |
| 2 | Inject scene/picking through `SessionEnvironment.renderRuntime` | Removes the static Three edge from `session.ts` without changing the scene/engine ownership; type-only imports keep the entry graph clean | Splitting session into two modules (larger refactor); dynamic imports inside the frame loop (re-entrancy risk) |
| 3 | `manualChunks` names `three` and `react` | One shared Three vendor chunk for the game runtime and preview; stable React caching; the budget script can identify the vendor deterministically | Letting Rollup choose (three may be duplicated or merged with app code; graph assertion becomes brittle) |
| 4 | Defer the customization panel through a wrapper with injected `loadPanel` | Removes the second Three edge (`SpaceshipPreview → render/preview`) from the entry; error/retry is testable without React error-boundary class semantics | `React.lazy` + error boundary (rejected promise caching makes retry awkward); async `SpaceshipPreview` (larger effect rewrite) |
| 5 | Chain the budget check in the frontend `build` script | The existing CI `verify-app` Build step and the Docker `build` stage enforce it with no workflow/Dockerfile edit | A new CI step (shared-config edit); a test-only gate (CI tests run before build) |
| 6 | Fixed gzip ceilings + fresh measured values in the build log | Approved r3 ceilings: initial 150,000, three 165,000 (raised from 140,000 after the fresh measurement), total 300,000 B; T3 blocks rather than silently raising a ceiling | Committed baseline + 5% rule (more state); raw-size ceiling (doesn't reflect wire size) |
| 7 | gzip only; no brotli | The base image lacks `ngx_brotli`; a custom nginx build is outside the feature and would change the image path | Custom nginx image with brotli (rejected: non-goal) |
| 8 | `no-cache` shell + immutable hashed assets | Correct cache busting after a deploy; hashed assets are content-addressed | Immutable shell (stale UI risk); `no-store` (no 304s) |
| 9 | Smoke-only `frontend-prod` service in `compose.smoke.yaml` | Exercises the real prod nginx and chunk graph; `compose.yaml`/`podman compose up` stay untouched | Switching the dev service to prod (breaks HMR); asserting config text only (no wire proof) |
| 10 | Serve `dist/bundle-report.json` for the smoke | Lets the smoke assert the actual served graph and budgets without a second build artifact | Parsing `index.html` + guessing hashed names (brittle); embedding metadata in HTML (couples build to shell) |
| 11 | Keep the accepted gate-close intro clock; skip the loader elapsed | No Q-4 user decision and no `adaptive-render-budget-v2` supersession; the intro still begins at progress 0 and the loading state is not part of the cinematic | Delaying the intro until chunk load (would require a checkpoint item + Supersessions row; rejected by F1) |

## Risks & mitigations

- **A static Three import is missed and the initial graph still includes it** → the budget script fails on `three.file ∈ initial.files`; T3 inspects the manifest/report, greps the entry closure, and fixes the import; AC-1 is the gate.
- **A budget ceiling is too tight for the split output** → the fresh T3 build measured initial 95,903 B / three 154,323 B / total 273,854 B; the r3 user decision raised only the three ceiling to 165,000 B (initial 150,000 and total 300,000 unchanged). The original 140,000 B was the unminified `three.module.js` figure, not the minified production chunk. A future overrun still stops/blocks and requires an orchestrator-approved revision; no silent ceiling raise.
- **Async environment load changes attach timing, the intro clock, or loses a welcome** → the session status is `loading` before the loader; the loader never advances the engine; the environment starts the existing attach body (subscribe-before-connect) once; the start body sets `frameBaselineMs` at runtime start, so the loader elapsed is skipped and a deferred/immediate loader yield the same intro progress after the same post-attach delta; existing welcome/reconnect tests plus the new deferred-loader, StrictMode, and intro-clock tests pin the behavior.
- **Dispose/unmount during a pending load starts a stale cycle** → attach generation token + `active=false` on dispose; a later resolution is ignored; tests pin zero renderer/listener/frame after disposal.
- **StrictMode-like double effect double-starts** → attach is idempotent while loading/active; the generation token cancels the first loader and only the second starts; test attach/dispose/attach (two loader calls, one start).
- **Customization panel load failure crashes `App`** → the wrapper catches the rejection and renders `role="alert"` + retry; tests inject a rejected loader and a resolving retry.
- **The lazy panel changes SSR HTML for open-customization renders** → no SSR test renders an open customization panel; the wrapper's server render is the loading status only when the panel is open; the accepted SSR shell snapshots keep the toggle closed.
- **nginx `add_header` inheritance surprises** → each location declares its own `Cache-Control`; `/assets/` uses `try_files $uri =404`; static test and smoke assert exact values on `/`, `/assets/*`, and the fallback.
- **Index HTML is below `gzip_min_length`** → `gzip_min_length 128` is below the source + Vite-injected shell size; the smoke fails if gzip is absent, and T4 records the actual header.
- **Brotli is assumed available** → T4 runs `nginx -V` and records the absence of `ngx_brotli`; the config has no brotli directive; docs record the decision.
- **Prod smoke service auto-build/readiness** → T4 builds `frontend-prod` explicitly and the smoke polls the prod `/` with the bounded `READY_TIMEOUT_MS` before header assertions; if a clean CI `run` does not build the dependency, Q-9's exact `build frontend-prod` (or `run --build`) prerequisite is an acceptance prerequisite and a user-owned workflow amendment.
- **Bundle report/manifest exposure** → they contain file names, sizes, and budget constants only; no source code, source maps, env values, or secrets. The report is served for the smoke; the manifest is not linked from the shell.
- **Script/config coverage is outside the `src` metric** → `scripts/check-bundle-budget.mjs`, `vite.config.ts`, and `nginx.conf` are test-level covered by `bundle-budget.test.ts`, `vite-config.test.ts`, and `nginx-config.test.ts`; no coverage exclusion is added, and the build logs state this explicitly.
- **Coverage drops because new branches are untested** → T1/T2 add status/retry/StrictMode/intro-clock/panel tests; T3 adds budget/config tests; T4 adds nginx static tests; coverage is a per-task verify command.
- **The new script is not linted/typechecked** → `eslint` covers `src/frontend/**/*.mjs`; the script is outside `tsconfig` (plain `.mjs`), and its pure API is covered by the TypeScript test through the `.d.mts` declaration.

## Rollback

Revert the feature commit range for `src/frontend/**`, `compose.smoke.yaml`, `tests/e2e/smoke.mjs`, `README.md`, `docs/architecture/containerization.md`, and `docs/architecture/frontend-rendering.md`; no persistence, schema, protocol, backend, or container-state migration is involved. The dev path (`compose.yaml`, `podman compose up`, Vite 5173) is untouched. Reverting restores the single-chunk entry and the previous nginx config; the smoke-only `frontend-prod` service disappears with the override file change. Reverting `src/frontend/package.json` restores the plain `vite build` and removes the budget gate. No volume/network cleanup is required. The accepted `adaptive-render-budget-v2` gate-deferred attach, p95 policy, and GPU tier matrix are not touched by a rollback; this feature's session changes are the environment loader/status seam and the gate-close intro anchor (which preserves the accepted timing).

## Verification

### Automated (per-task pre-gates; full suite at T5)

```bash
npm run lint
npm run typecheck
npm test
npm run coverage              # >= 80 statements/branches/functions/lines per workspace
npm run build                 # fresh Vite build + bundle-budget gate
npm run smoke                 # containerized prod delivery proof
```

Frontend pre-gate for T1–T4: `npm run test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`. The full suite includes the StrictMode cancellation test (first loader cancelled, second starts) and the intro-clock test (a deferred loader and an immediate loader produce the same intro progress after the same post-attach delta).

### Fresh bundle measurement and index-link proof (T3)

```bash
npm run build
cat src/frontend/dist/bundle-report.json
! grep -qE 'rel="(modulepreload|preload)"[^>]*href="[^"]*three-' src/frontend/dist/index.html
```

Approved ceilings: **initial 150,000 B, three 165,000 B, total 300,000 B gzip** (three raised from 140,000 B by r3). The fresh T3 measurement is entry `assets/index-Cu7lmcVH.js`, initial `["assets/index-Cu7lmcVH.js", "assets/react-BYqCGoBQ.js"]` 95,903 B, three `assets/three-4rmoIDEa.js` 154,323 B, total 273,854 B; the audit's 131,382 B was the unminified `three.module.js`. Record `entry.file`, `initial.files`, `initial.gzipBytes`, `three.file`, `three.gzipBytes`, `total.gzipBytes`, the budget constants, and the index-link result in `build-log-T3.md`. If any ceiling is exceeded, stop and report `blocked` with the measured values; do not raise the ceiling.

### Containerized delivery proof (T4)

```bash
podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod
npm run smoke
test "$(podman run --rm --entrypoint nginx cubeclicker-frontend:prod-smoke -V 2>&1 | grep -ci brotli)" -eq 0
podman run --rm --entrypoint nginx cubeclicker-frontend:prod-smoke -t
```

The smoke's first prod request is a bounded `pollUntilReady` of `http://frontend-prod:8080/` (the existing `READY_TIMEOUT_MS`, 500 ms interval) before any header assertion, so the `condition: service_started` dependency cannot race nginx. The smoke output must include the new PASS lines for `/`, `/assets/index-*`, `/assets/three-*`, `/bundle-report.json`, `/assets/missing.js`, and `/missing/route`, with the existing backend/multiplayer/auth checks still green. Record the raw output, the readiness result, the `nginx -V` result, and the `nginx -t` result in `build-log-T4.md`. Also record the CI smoke prerequisite: a clean `docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` either builds `frontend-prod` or requires the exact amendment `docker compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` before the run (or `run --build --rm smoke`); that workflow change is user-owned and is an acceptance prerequisite if the provider does not auto-build. If Podman is unavailable, T4 is `blocked`; an unrun step is never recorded as a pass.

### Documentation exact strings (T5)

`README.md` must contain `The frontend build enforces the bundle budget` and `Brotli is not enabled`; `docs/architecture/containerization.md` must contain the exact heading `## Frontend static delivery`; `docs/architecture/frontend-rendering.md` must contain the exact heading `## Loading and code splitting`. These are the T5 verify greps; the docs link test remains the link guard.

### Manual development check (optional, not an acceptance substitute)

`podman compose up`, open `http://localhost:5173`, and in the browser network panel confirm: no `three-*.js` request while the auth menu is open; one after `Play as guest`/login; the customization preview chunk only after opening the panel. The dev Vite server does not exercise the nginx headers; AC-7/AC-9 are proven by the prod smoke.

## Open questions

**Approval checkpoint.** The `awaiting_approval` summary must present Q-1 (budget ceilings, with the fresh T3 measurement and the r3 three-ceiling correction), Q-2 (gzip-only/brotli), Q-5 (smoke-only prod service), Q-6 (`no-cache` shell), and Q-9 (CI smoke build prerequisite) explicitly. Q-4 is resolved in this revision and is **not** a user decision: the intro clock stays anchored at gate close and the loader elapsed is skipped. Approval of the blanket performance queue is not approval of these delivery defaults.

- **Q-1 — Budget ceilings (approved r3).** **Initial 150,000 B, three 165,000 B, total 300,000 B gzip.** The three ceiling was raised from 140,000 B by the r3 user decision; initial and total are unchanged. Fresh post-split T3 measurement: entry `assets/index-Cu7lmcVH.js`; initial `["assets/index-Cu7lmcVH.js", "assets/react-BYqCGoBQ.js"]` 95,903 B (54,097 B / 36.1% headroom); three `assets/three-4rmoIDEa.js` 154,323 B (10,677 B / 6.5% headroom); total 273,854 B (26,146 B / 8.7% headroom). The original 140,000 B was derived from the audit's unminified `three.module.js` (131,382 B gzip); the minified production chunk is 154,323 B because minification strips the whitespace and long identifiers gzip exploits. T3's fresh measurement is authoritative; a future overrun stops/blocks and requires an orchestrator-approved spec revision — T3 must not silently change the ceiling. Alternative: baseline +5%.
- **Q-2 — Brotli.** Default: gzip only; base image has no `ngx_brotli`. Alternative: custom nginx image (rejected).
- **Q-3 — Loading/error copy.** Default exact strings in AC-2/AC-4; tests pin them.
- **Q-5 — Prod smoke service.** Default: `frontend-prod` in `compose.smoke.yaml` only; no host port; `podman compose up` unchanged; the smoke's bounded readiness poll is the readiness gate.
- **Q-6 — Shell cache policy.** Default: `no-cache`; alternative `no-store`/`max-age=0, must-revalidate`.
- **Q-7 — Report exposure.** Default: serve `/bundle-report.json` (names, byte counts, and budget constants only; no source, source maps, env values, or secrets); the manifest is names/paths only and not linked from the shell.
- **Q-8 — React vendor chunk.** Default: explicit `react` manual chunk.
- **Q-9 — CI smoke build prerequisite.** Default: T4 explicitly builds `frontend-prod`; a clean CI `docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` must either auto-build the dependency or be preceded by `docker compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` (or use `run --build --rm smoke`). This is a user-owned workflow amendment, not a builder edit.

**Q-4 — resolved, not a user decision.** The loader runs before the start body and never advances the engine; `frameBaselineMs` is set at runtime start, so the loader elapsed is skipped and the intro begins at progress 0. The accepted `adaptive-render-budget-v2` Q-2 timing is preserved; no Supersessions row is needed.

## Revision history

- r1 — 2026-11-12 — initial plan from the audit (`P-04`, `P-06`).
- r2 — 2026-11-12 — spec-review r1 response (F1 intro timing, F2 smoke readiness/CI prerequisite, F3/F4 budget/current-build numbers, F5-F11 INFO items).
- r3 — 2026-11-12 — user-approved budget correction after the fresh T3 measurement: three gzip ceiling **140,000 → 165,000 B**; initial 150,000 and total 300,000 unchanged; records entry `assets/index-Cu7lmcVH.js`, initial 95,903 B, three 154,323 B, total 273,854 B, and the root cause (the audit's 131,382 B was the unminified `three.module.js`).
