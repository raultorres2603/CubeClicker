---
feature: frontend-delivery-hardening
phase: code_review
round: 1
iteration: 1
verdict: approved
reviewed: 2026-11-12
blocking: 0
nonblocking: 2
---
# Code Review — r1

## Summary

✅ approved — 0 blocking, 2 MINOR, 3 INFO. All 11 ACs are verified against the built state and an independently reproduced suite: `npm run lint`, `npm run typecheck`, `npm test` (868 backend + 1,813 frontend), `npm run coverage` (backend 95.43/87.71/99.70/95.43; frontend 96.42/96.10/97.53/96.42), `npm run build`, and `npm run smoke` (19/19) all exit 0. The fresh build report is initial **95,903 B** / three **154,323 B** / total **273,854 B** gzip against 150,000 / 165,000 / 300,000; the initial closure is only `[index, react]`, the manifest entry's static imports are only React, the dynamic imports are `browser-env` and the customization panel, and `index.html` has no Three preload. The production nginx serves the shell `no-cache`, hashed `/assets/*` immutably, gzip with `Vary: Accept-Encoding`, a real 404 for missing assets, and the SPA fallback; the prod smoke proves the wire headers, gzip bytes, served graph, and byte counts.

The two MINOR findings are documentation/bookkeeping: the status still carries pre-approval `recommended` wording for Q-2/Q-5/Q-6 and a stale "T3 fix-up/re-run pending" bullet, and three build logs have an extra blank line at EOF (`git diff --check` exits 2). The three INFO observations are the uncaught `start`-body exception edge, the README's unconditional compose-auto-build wording, and the fact that no real-browser visual pass was run in this environment. None blocks acceptance; the acceptance-time actions below close the MINORs.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | Fresh `dist/bundle-report.json` has `initial.files = ["assets/index-Cu7lmcVH.js", "assets/react-BYqCGoBQ.js"]`; `dist/.vite/manifest.json` entry has only `_react-BYqCGoBQ.js` in static `imports` and `src/browser-env.ts` / `src/ui/SpaceshipCustomizationPanel.tsx` in `dynamicImports`; `dist/index.html` has only the React modulepreload and the stylesheet, with no `three-` link. The smoke report check and `bundle-budget.test.ts` initial-closure test are green. |
| AC-2 | ✅ | `session.test.ts` runtime-loading suite: provided env starts synchronously with `ready` and zero loader calls; a deferred loader leaves `loading` with zero renderer/listener/frame/transport effects, then exactly one start; rejection yields `error`; retry starts a second loader; attach-while-loading is idempotent; StrictMode-shaped mount → unmount → remount is two loader calls / one start. `GameCanvas.runtime.test.tsx` pins exact `role="status"` `Loading the game…`, `role="alert"` `The game could not be loaded.`, the `Try again` re-attach, `active=false` chrome suppression, and the same canvas element in every state; `App.test.tsx` keeps the attach/join/retry ordering. No manual visual pass was run (INFO F5). |
| AC-3 | ✅ | The accepted attach/dispose, hidden-at-attach, transport subscribe-before-connect, welcome, and gate-deferral tests remain green. The new fake-clock test pins a deferred loader resolving at `t0 + N` with a first frame at `t0 + N + 16` to `16 / 2500` intro progress, equal to the immediate-loader baseline and never `(N + 16) / 2500`; `engine.advance` is not called while the loader is pending. |
| AC-4 | ✅ | `DeferredSpaceshipCustomizationPanel.test.tsx` pins loading, resolved panel with forwarded props, rejected alert, retry via a second loader, and zero load while closed; `App.test.tsx` waits for the resolved `.customization-panel` / `Open lootbox`; the build report has no panel/`render/preview`/Three in the initial closure. |
| AC-5 | ✅ | `src/frontend/package.json` runs `vite build && node scripts/check-bundle-budget.mjs`; the script reads the fresh manifest, writes `dist/bundle-report.json`, and exits 1 on initial > 150000, three > 165000, total > 300000, missing three, or three in the initial closure. `bundle-budget.test.ts` pins all five violations (including initial 150001, three 165001, total 300001, missing three, three-in-initial); `npm run build` exits 0 with `Bundle budget OK`; the root build/CI Build step/Docker build stage inherit the script's exit code. |
| AC-6 | ✅ | The fresh T3/T5 build measures entry `assets/index-Cu7lmcVH.js`, initial `["assets/index-Cu7lmcVH.js", "assets/react-BYqCGoBQ.js"]` **95,903 B**, three `assets/three-4rmoIDEa.js` **154,323 B**, total **273,854 B**, all within the approved 150,000 / 165,000 / 300,000 ceilings. The unminified-vs-minified root cause is recorded and reproducible: audit `three.module.js` 662,772 B raw / 131,517 B level-6 gzip vs minified chunk 609,337 B raw / 154,323 B gzip. |
| AC-7 | ✅ | `nginx-config.test.ts` pins the exact gzip directives and types, `/assets/` immutable + `try_files $uri =404`, `/index.html` and `/` no-cache, and the SPA fallback. The prod smoke asserts `GET /` 200/text-html/`no-cache`/gzip/`Vary: Accept-Encoding`/gzip magic, the immutable entry asset, the three chunk, and the `/missing/route` shell; it passes 19/19. |
| AC-8 | ✅ | `nginx -V` on `cubeclicker-frontend:prod-smoke` shows zero `ngx_brotli`/brotli matches; `nginx -t` passes; the config has no brotli directive and `nginx-config.test.ts` asserts its absence; `docs/architecture/containerization.md` § Frontend static delivery states gzip-only, why brotli is unavailable, and that a custom build is out of scope. |
| AC-9 | ✅ | `compose.smoke.yaml` adds the smoke-only `frontend-prod` (prod target, no published host port), `smoke` depends on it with `condition: service_started`, and the first prod request is the bounded `pollUntilReady` of `http://frontend-prod:8080/`. The reproduced `npm run smoke` is 19/19: readiness, `/bundle-report.json` no-cache/gzip/lazy three/budgets, gzip shell with the report entry script, entry and three assets with immutable cache and matching decompressed byte counts, `/assets/missing.js` 404, and `/missing/route` gzip shell. Existing backend/multiplayer/auth checks remain green. |
| AC-10 | ✅ | Independent `npm run coverage` exits 0: backend 95.43% statements / 87.71% branches / 99.70% functions / 95.43% lines; frontend 96.42 / 96.10 / 97.53 / 96.42. `vitest.config.ts` is unchanged (only `main.tsx` + tests excluded); no test is deleted (`git diff --name-status` has no `D`); the new tests use concrete expected values; the script/Vite/nginx configs are test-level covered by the three new suites as AC-10 records. |
| AC-11 | ✅ | `README.md` contains the exact `The frontend build enforces the bundle budget` and `Brotli is not enabled` strings; `containerization.md` has `## Frontend static delivery`; `frontend-rendering.md` has `## Loading and code splitting`; all 22 relative links in the edited architecture doc resolve; `docs/features/README.md` is untouched in the commits and the working tree; `compose.yaml`, `src/frontend/Dockerfile`, root `package.json`, and `package-lock.json` have no diff. The feature-index row is an acceptance-time action (the T5 log's proposed row says `planning`; use `accepted`). |

No AC deviation was found. The `start`-body exception edge (INFO F3), the unrun real-browser visual (INFO F5), and the clean-compose auto-build reproduction (INFO F4) are outside the specified ACs; none is treated as passed where no evidence exists.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `docs/features/frontend-delivery-hardening/status.md:40,43,44,49` | The status still says Q-2/Q-5/Q-6 are "recommended" although the user approved those delivery defaults in the loop log, and the final blocker bullet still says "T3 fix-up/re-run pending" although T3/T4/T5 are checked and the loop log records T5 complete. The r3 F2 r2/round-2 line itself is gone. | In the acceptance status edit, mark Q-2/Q-5/Q-6 approved, remove the stale T3 pending bullet, set `state: accepted`, and add the acceptance loop-log entry. | open |
| F2 | MINOR | `docs/features/frontend-delivery-hardening/build-log-T1.md:176`, `build-log-T3.md:537`, `build-log-T5.md:211` | `git diff --check 7749461..HEAD` reports "new blank line at EOF" for these three new build logs (exit 2). The extra blank line is a hygiene issue, not a behavior issue. | Remove the extra blank line at EOF in the three logs in the acceptance commit. | open |
| F3 | INFO | `src/frontend/src/game/session.ts:1143-1155`, `:1518-1533` | The async loader's rejection handler covers loader failure, but a synchronous `start`-body exception (e.g. `env.renderRuntime.createSceneView` or `env.rendererFactory` throwing on a lost WebGL context) leaves `runtimeStatus` at `loading` and the UI shows the loading status with no error/retry. AC-2 is scoped to loader rejection, so this is not an AC failure, but it is an untested error-path gap. | Future hardening: wrap the start body (or the fulfillment handler) in try/catch, dispose any partially created scene/adapter, and set `error` for the retry UI. No change required for this acceptance. | open |
| F4 | INFO | `README.md:94`, `docs/features/frontend-delivery-hardening/build-log-T4.md:123-143` | The README says "the compose provider builds the image on first use"; the T4 log records a clean auto-build with the tested provider, but a provider that does not auto-build needs the explicit `build frontend-prod` step. I built `frontend-prod` explicitly before reproducing the smoke, so the clean-run auto-build claim itself was not independently reproduced. | No change required for the tested provider; at acceptance record the Q-9 result and, if the CI provider does not auto-build, add the user-owned `docker compose ... build frontend-prod` prerequisite. Optionally soften the README sentence to mention the explicit build. | open |
| F5 | INFO | `docs/features/frontend-delivery-hardening/build-log-T5.md` (verification section) | No real-browser visual/GUI pass was recorded or run; this environment has no Chromium/Chrome/Firefox/Epiphany binary and no Playwright/Puppeteer. The loading/error UI behavior and copy are jsdom-tested and the CSS declarations are static-tested; the prod smoke proves delivery, not the visual overlay. This is not treated as passed. | Optional acceptance-time GUI-host visual check of the gate-close loading/error chrome and the deferred customization panel. The spec's manual dev check is supplementary, not an AC substitute. | open |

## Verification performed

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0 (both workspaces).
- `npm test` → backend 24 files / 868 tests passed; frontend 69 files / 1,813 tests passed; exit 0.
- `npm run coverage` → exit 0; backend 95.43% statements / 87.71% branches / 99.70% functions / 95.43% lines; frontend 96.42% / 96.10% / 97.53% / 96.42%. All four metrics ≥ 80 in both workspaces; no exclusion or threshold change.
- `npm run build` → exit 0; fresh Vite build plus the budget gate; `Bundle budget OK`; entry `assets/index-Cu7lmcVH.js` (26,947 B gzip), initial `["assets/index-Cu7lmcVH.js", "assets/react-BYqCGoBQ.js"]` 95,903 B / 150,000; three `assets/three-4rmoIDEa.js` 154,323 B / 165,000; total 273,854 B / 300,000.
- Budget-gate failure path: `bundle-budget.test.ts` pins all five violation conditions; an independent import-and-evaluate check on a synthetic over-budget/leaked manifest returned `{"ok":false,"violations":[...]}` with the initial, three, total, and three-in-initial violations. A prior blocked T3 run in `build-log-T3.md` records the build exiting 1 when the old ceiling was exceeded; the current active gate is 165,000 and passes.
- `npm run smoke` → exit 0; **SMOKE PASS (19/19 checks)**. I explicitly built `cubeclicker-frontend:prod-smoke` first; the smoke started `frontend-prod` with no host port, the readiness poll was the first prod request, and all existing backend/multiplayer/auth checks plus the seven new prod checks passed. The clean compose `run` auto-build claim was not independently reproduced (INFO F4).
- `nginx -V` on `cubeclicker-frontend:prod-smoke` → zero brotli matches; `nginx -t` → syntax OK. Both match the T4 log.
- Fresh-build graph checks: `dist/bundle-report.json` initial files exclude the three chunk; the manifest entry's static imports are only `_react-BYqCGoBQ.js` with `browser-env` and `SpaceshipCustomizationPanel` in `dynamicImports`; `dist/index.html` has exactly the entry module script, the React modulepreload, and the stylesheet; no `three-` preload.
- Docs/scope: exact README strings, both architecture headings, 22 relative links in `frontend-rendering.md`, empty `docs/features/README.md` status/diff, and empty `compose.yaml`/Dockerfile/root package/lockfile diff all pass.
- Commit scope: T1 `7707753` (session seam/status + tests + log), T2 `b62dae4` (GameCanvas/wrapper/App/tests/CSS + log), T3 `62fde61` (Vite/config/budget script/tests/package + log), T4 `4290713` (nginx/compose-smoke/smoke + log), T5 `ea942e4` (docs/architecture/planner artifacts/reviews/logs). The files match the task `files_owned`/`commits_also`; no source/config/container/workflow change outside the feature. No secrets, `.env*`, source maps, or deleted tests were found.
- `git diff --check 7749461..HEAD` → exit 2, three "new blank line at EOF" messages (F2).
- Manual browser visual: **not run**. No Chromium/Chrome/Firefox/Epiphany binary and no Playwright/Puppeteer are available in this environment; the UI is covered at the jsdom/static-CSS level and the prod smoke covers delivery, not the rendered overlay.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | Dynamic import specifiers are static source strings; no user-controlled chunk loading, `eval`, or remote code. The report/manifest expose names, paths, and byte counts only; no source maps, secrets, or environment values. Hashed assets are immutable only under `/assets/`; the shell and SPA fallback revalidate; missing assets are real 404s. No new dependency, `.env` edit, auth/WS change, or privileged container. |
| Quality | ✅ | The session status/generation seam, the deferred panel wrapper, the budget script, and the nginx config are single-purpose and match the plan's file inventory. The large `session.ts` diff is the start-body extraction plus status/generation; the whitespace-insensitive diff is confined to that refactor. Two MINOR bookkeeping/hygiene findings (F1/F2) are non-blocking. |
| Testing | ✅ | 2,681 tests pass; coverage is above 80 on all four metrics in both workspaces; the new session/UI/budget/config suites use concrete values and no banned wildcard/snapshot/assertion-free patterns; no test was deleted; the prod smoke is the AC-9 wire proof. The `start`-body exception edge and the real-browser visual are untested (F3/F5, non-blocking). |
| Real-time | ✅ N/A | No shared/cross-client state, protocol, identity, or server-authority change. The accepted subscribe-before-connect, welcome, reconnect, and grace behavior are unchanged; the first socket now opens after the game-runtime chunk loads, and the existing multiplayer/auth smoke checks remain green. |
| Containers | ✅ | `compose.yaml`, the Dockerfile, the root package/lockfile, and `podman compose up` are untouched. `frontend-prod` is smoke-only, has no published host port, builds the provider-neutral prod target, and the WebSocket endpoint/health signal are unchanged. `nginx -V`/`-t` and the smoke pass. |
| Documentation | ✅ | Exact README strings, both required headings, and all 22 relative links pass; the feature index is untouched; the proposed row is in `build-log-T5.md`. The status bookkeeping and the proposed `planning` row state are acceptance-time cleanups (F1 and notes). |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| spec-review r3 F1 (active budget literals still 140,000) | fixed | `check-bundle-budget.mjs:22`, `check-bundle-budget.d.mts:7`, and `bundle-budget.test.ts` now use 165,000; `grep` finds no active 140000/140001 in the script, declaration, tests, Vite config, or frontend package; `npm run build` is green at 95,903 / 154,323 / 273,854. |
| spec-review r3 F2 (stale r2/round-2 status line) | fixed; a different stale line remains | The old r2/round-2 line is gone; `status.md:49` still says "T3 fix-up/re-run pending" after T3 completed (F1 MINOR). |
| spec-review r3 F3 (percentage denominator) | closed | The build log's ≈6.9% is measured-relative and the spec/plan Q-1's 6.5% is ceiling-relative; both are arithmetically correct. No action. |
| spec-review r1/r2 findings | fixed/closed | The r2 intro-timing, readiness, ceiling, and summary-byte fixes remain; Q-4/AC-3/A-10 and the Supersessions None section are unchanged; no regression found. |

## Notes / backlog (non-blocking)

- **Acceptance-time actions.**
  1. Add the `frontend-delivery-hardening` row to `docs/features/README.md` with state `accepted` and the acceptance date. The T5 log's proposed row currently says `planning`; use `accepted` when the orchestrator applies it.
  2. Set `status.md` to `accepted` with the acceptance loop-log entry and a clean tree; update Q-2/Q-5/Q-6 to approved and remove the stale T3 pending bullet (F1).
  3. Commit `reviews/code-review-r1.md` and remove the three build-log EOF blank lines (F2).
  4. Record the Q-9 result. The tested compose provider auto-built `frontend-prod` during a clean `run`; if the CI provider does not, the user-owned `docker compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` prereq (or `run --build --rm smoke`) is required.
  5. Optional: run the GUI-host loading/error/customization visual pass (F5); the spec's manual dev check is supplementary and never substitutes for the automated ACs.
  6. Optional follow-up: catch `start`-body exceptions and set the `error` state (F3).
- **The initial graph is Three-free in the built artifact**, not just by source inspection: the report initial files are entry + React; the entry's static imports are only React; the dynamic imports are the game runtime and the customization panel; the shell has no three preload. The `three` chunk is a shared lazy vendor chunk.
- **The budget gate is enforceable on the normal build path**: `src/frontend/package.json` chains the script, the root build/CI Build/Docker build stage inherit the exit code, and the unit suite pins every violation. The report is generated from the same fresh manifest and is served by the prod image for the smoke.
- **The nginx matrix is proven on the wire**: shell/SPA fallback no-cache, hashed assets immutable, gzip + Vary, missing asset 404, and the served graph/byte counts all pass in the 19/19 smoke.
- **No source, test, config, container, workflow, or planner artifact was edited by this review**; only `reviews/code-review-r1.md` was written. The working tree's only tracked change is the orchestrator's `status.md` transition to `code_review` (plus this new review file).
