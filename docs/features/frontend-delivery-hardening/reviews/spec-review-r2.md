---
feature: frontend-delivery-hardening
phase: spec_review
round: 2
iteration: 2
verdict: approved
reviewed: 2026-11-12
blocking: 0
nonblocking: 8
---
# Spec Review — r2

## Summary

✅ approved — 0 blocking (0 BLOCKER, 0 MAJOR), 0 MINOR, 8 non-blocking INFO observations. The r2 revision resolves all four r1 findings.

**F1 resolved.** The accepted `adaptive-render-budget-v2` Q-2 gate-close intro timing is preserved without a Supersessions row: the loader runs before the start body, the session never calls `engine.advance` while the loader is pending, and the start body sets `frameBaselineMs = env.now()` at runtime start, so the loader elapsed is skipped, not consumed. Q-4 is removed from the user checkpoint and marked resolved; A-10 keeps the accepted attach/dispose, p95, GPU tier matrix, high-tier visuals, and intro timing; AC-3's fake-clock test pins `16 / introMs`, never `(N + 16) / introMs`, for a loader resolving at `t0 + N` and a first frame at `t0 + N + 16`. The mechanism is implementable with the existing start body and is observable through the engine snapshot.

**F2–F4 resolved.** AC-9 adds the bounded `pollUntilReady` of `http://frontend-prod:8080/` (the existing `READY_TIMEOUT_MS`, 500 ms interval) before any header assertion and records the exact CI `--build` prerequisite; Q-9 is now in the checkpoint. AC-6/Q-1 cite the current `adaptive-render-budget-v2` build (≈983.50 kB raw / 273.10 kB gzip, `index-Dn5pY2q7.js`) and the audit remainder (139,789 B gzip), and make T3's fresh post-split measurement authoritative with a `blocked`/no-silent-raise rule. The summary cites both the audit baseline and the current build.

**Hard constraints intact.** The initial graph is Three-free by design: the session's static `browser-env`/`render/scene`/`render/picking` imports move behind the dynamically loaded `renderRuntime`, the customization panel is deferred behind a wrapper, and `three`/`react` are pinned as `manualChunks`. The fresh-build budget gate is chained into the frontend `build` script (`vite build && node scripts/check-bundle-budget.mjs`), so the root `npm run build`, CI's Build step, and the Docker build stage fail on a violation; the report is generated from the fresh manifest in the same build. nginx caches only hashed `/assets/*` immutably and keeps `/`, `/index.html`, and the SPA fallback `no-cache`. All 11 ACs are binary-testable; T1 → T2 → T3 → T4 → T5 are all `[seq]` with disjoint `files_owned`; the AC → task map is complete. The approval checkpoint must present Q-1/Q-2/Q-5/Q-6/Q-9.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F5 | INFO | `spec.md:142` (A-10) | A-10 says the runtime load "must not delay the intro start beyond the gate-close clock". The load does delay runtime availability; the preserved property is that the loader elapsed is never passed to `engine.advance` and the intro begins at progress 0. The literal wording can be read as a gate-close start that an async load cannot provide. | Optional: reword A-10 to "the loader elapsed is never passed to `engine.advance`; the intro is held at progress 0 while loading and begins from 0 at runtime start" (AC-3 is the authoritative pin). No behavioral change. | open |
| F6 | INFO | `tasks.md:26-33` (T2) | T2 replaces `App`'s static panel import with `DeferredSpaceshipCustomizationPanel`, but the wrapper's `SpaceshipCustomizationPanelProps` type import is not explicitly required to be `import type`. A value import would pull the panel (and Three) into the initial graph; T3's budget gate would catch it, but T2's component tests would not. | Optional: add "use `import type { SpaceshipCustomizationPanelProps }`; no runtime import of the panel" to T2's notes. | open |
| F7 | INFO | `spec.md:26` (AC-1), `tasks.md:42` (T3) | The T3 check `! grep -qE 'rel="(modulepreload\|preload)"[^>]*href="[^"]*three-'` assumes `rel` precedes `href`; Vite's attribute order is not guaranteed. AC-1's condition is the truth, and the report/manifest checks are the primary gate. | Keep the grep as a quick check but also inspect the `modulepreload`/`preload` links or use an attribute-order-tolerant check in T3. | open |
| F8 | INFO | `tasks.md:51` (T4), `spec.md:43` (AC-9) | The smoke's raw `node:http`/`node:https` prod request must send `Accept-Encoding: gzip`; otherwise nginx may serve identity and the `content-encoding: gzip`/gzip-magic assertions fail. The task notes specify the assertions but not the request header. | Optional: add "send `Accept-Encoding: gzip` on the raw prod requests" to T4's notes. | open |
| F9 | INFO | `status.md:13` | The status summary cites only the audit bytes (982,591 B raw / 271,171 B gzip); the spec summary also cites the current `adaptive-render-budget-v2` build (≈983.50 kB raw / 273.10 kB gzip). The spec is the source of truth; the status summary is stale on this point. | Update the status summary to cite both (or the current build) at the next status edit. | open |
| F10 | INFO | `spec.md:118` (checkpoint), `spec.md:122`/`:125`/`:126` (Q-3/Q-7/Q-8) | Q-3 (copy), Q-7 (report exposure), and Q-8 (React chunk) remain builder defaults outside the checkpoint. They are low-risk and the copy is test-pinned; the deliverable checkpoint is Q-1/Q-2/Q-5/Q-6/Q-9. | No change required; keep the defaults and the tests. | open |
| F11 | INFO | `spec.md:44` (AC-10), `plan.md:214` | `scripts/check-bundle-budget.mjs`, `vite.config.ts`, and `nginx.conf` are outside the frontend `src` coverage include; AC-10 records test-level coverage and no new exclusion. The budget script is production build code, so the coverage metric does not count it. | Keep the disclosure; the T3/T4 logs must record the test-level coverage explicitly. No exclusion or threshold change. | open |
| F12 | INFO | `spec.md:141` (A-9), `spec.md:125` (Q-7) | Serving `/bundle-report.json` and `.vite/manifest.json` exposes chunk/file names, byte counts, and budget constants. No source maps, code, environment values, or secrets are included; the manifest is not linked from the shell. | Accept per A-9/Q-7; keep the names/sizes-only statement and the Q-7 checkpoint note. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | P-04 and P-06 are covered; the remaining performance/skill/new-feature audit items are explicit non-goals. Q-4 is resolved, and the checkpoint lists Q-1/Q-2/Q-5/Q-6/Q-9. |
| Testability | ✅ | The 11 ACs use concrete commands, exact strings, counts, headers, byte values, and exit codes; AC-3's fake-clock test and AC-9's bounded readiness poll are implementable. F5–F8 are clarity notes, not gaps. |
| Boundaries | ✅ | Three tiers are present; non-goals and the no-application/protocol/container-path boundary are clear; `compose.yaml`, `src/frontend/Dockerfile`, root `package.json`, and `package-lock.json` stay untouched. |
| Dependency graph | ✅ | T1 → T2 → T3 → T4 → T5 is acyclic; every task is `[seq]`; the AC map covers all 11; each task is one builder session. |
| Parallel safety | ✅ | No `[P]`; all tasks sequential; `files_owned` sets are disjoint (T1 `GameCanvas.test.tsx` vs T2 `GameCanvas.tsx`/`GameCanvas.runtime.test.tsx`; T3 config/scripts/package vs T4 nginx/compose-smoke/smoke; T5 docs). |
| Security | ✅ | Dynamic import specifiers are static source strings; the report/manifest contain names, paths, and sizes only; no secrets, source maps, or environment values; immutable only for content-addressed assets; `no-cache` shell; missing assets 404; retries are user-triggered; no new dependency. |
| Testing | ✅ | Unit, integration, and containerized smoke tiers; `npm run coverage` with ≥ 80 statements/branches/functions/lines per workspace; assertion-quality bar; T3/T4 static config tests; the prod smoke is the acceptance gate for AC-7/AC-9. |
| Consistency | ✅ | Aligns with the accepted `adaptive-render-budget-v2`; A-10 preserves the accepted attach/dispose, p95, GPU tier matrix, high-tier visuals, and intro timing; § Supersessions is None; no stale Q-4 wording; the current build numbers are cited. |
| Real-time | ✅ N/A | No shared/cross-client state, protocol message, or server authority changes; subscribe-before-connect, welcome, and reconnect behavior are unchanged; the first socket opens after the runtime chunk loads. |
| Containers | ✅ | The smoke-only `frontend-prod` service is isolated from `compose.yaml`/`podman compose up`, has no host port, uses the provider-neutral prod target, and exercises the real image; the WebSocket endpoint and dev path are unchanged; Q-9 covers the CI build prerequisite. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) | fixed | AC-3 (`spec.md:28`) pins no `engine.advance` while the loader is pending and `16 / introMs` at a deferred resolution; § Supersessions None (`spec.md:49`); Q-4 resolved and not a user decision (`spec.md:118`, `:129`); A-10 (`spec.md:142`); plan intro rule (`plan.md:11`, `:49`); T1 intro-clock test (`tasks.md:24`). |
| F2 (r1) | fixed | AC-9 (`spec.md:43`) adds the bounded `pollUntilReady` of `http://frontend-prod:8080/` (existing `READY_TIMEOUT_MS`, 500 ms interval) before header assertions and the exact CI `--build` prerequisite; Q-9 is in the checkpoint (`spec.md:127`); T4 notes (`tasks.md:51`); plan (`plan.md:212`, `:256`). |
| F3 (r1) | fixed | AC-6 (`spec.md:34`) and Q-1 (`spec.md:120`) cite the current build ≈983.50 kB raw / 273.10 kB gzip and the audit remainder 139,789 B; T3's fresh measurement is authoritative and the builder must report `blocked` rather than raise a ceiling. |
| F4 (r1) | fixed | The summary (`spec.md:12`) cites both the audit baseline and the current `adaptive-render-budget-v2` build (`assets/index-Dn5pY2q7.js`, ≈983.50 kB / 273.10 kB). |
| F5–F11 (r1) | closed | Report/manifest exposure A-9/Q-7 (`spec.md:125`, `:141`); test-level script/config coverage AC-10 (`spec.md:44`); StrictMode cancellation AC-2/AC-3 (`spec.md:27`, `:28`); accepted-file overlap A-10 with the sequential chain (`spec.md:142`); T3 index-link proof (`tasks.md:42`); Q-9 in the checkpoint (`spec.md:118`); exact doc strings AC-11 (`spec.md:45`). |

## Notes / backlog (non-blocking)

- **Source claims verified.** `src/frontend/vite.config.ts` currently has no `build`/`manifest`/`manualChunks`; `src/frontend/nginx.conf` currently has only the SPA fallback; the frontend Docker build stage runs `npm run build -w @cubeclicker/frontend`, so the budget gate will apply; `App.tsx` currently imports `SpaceshipCustomizationPanel` statically and renders `<GameCanvas session={session} active={...} />`; `session.ts` statically imports `browser-env`, `render/scene`, and `render/picking` today, plus a type-only `three` import. The remaining Three importers are the render modules reached only through the dynamic game-runtime and preview chunks. The current `dist/assets/index-Dn5pY2q7.js` measures 983,501 B raw and 273,095 B at Node `zlib` level 6, matching the spec's ≈983.50 kB / 273.10 kB.
- **Initial graph is Three-free by design.** T1 removes the session's static Three-touching imports and injects `renderRuntime`; T2 replaces the static panel import with the deferred wrapper; `manualChunks` pins `three` and `react`; the budget script fails if `three.file` is in the initial closure or no `three` chunk exists.
- **Budget gate is enforceable from a fresh build.** The frontend `build` becomes `vite build && node scripts/check-bundle-budget.mjs`; the script reads the fresh `dist/.vite/manifest.json`, gzip-measures every JS file at level 6, writes `dist/bundle-report.json`, and exits 1 on any ceiling or graph violation. The root `npm run build`, CI's existing Build step, and the Docker build stage inherit the exit code; the report is copied into the prod image by the unchanged Dockerfile.
- **nginx matrix is correct.** `gzip on`, level 6, min length 128, vary, and the listed types; `/assets/` has the immutable header plus `try_files $uri =404`; `/index.html` and `/`/SPA fallback are `no-cache`; there is no brotli directive; hashed assets are content-addressed, so immutable caching is safe; 404s do not receive the long-cache header.
- **Smoke-only `frontend-prod` is isolated.** It lives in `compose.smoke.yaml` only, has no host port, builds the prod target, and is reached over the compose network; `compose.yaml`/`podman compose up` and the dev Vite frontend stay unchanged. The bounded poll handles the `condition: service_started` race, and Q-9 covers the CI auto-build/`--build` prerequisite.
- **Task graph and scopes are executable.** T1 → T2 → T3 → T4 → T5 are all `[seq]`; the `files_owned` sets are disjoint; the AC map covers all 11; T5 owns the docs and records the proposed feature-index row without editing `docs/features/README.md`.
- **Stale-phrase check is clean.** `Q-4` appears only as resolved/not-a-user-decision (`spec.md:49`, `:118`, `:129`; `plan.md:49`, `:198`, `:268`, `:279`; `status.md:31`); `attachRequestedAtMs` is absent; no "intro starts at attach" or "after the chunk load" wording remains.
- **The manual development check is optional.** AC-7/AC-9 are proven by the prod smoke, not the Vite dev server.

## Checkpoint items (required in the `awaiting_approval` summary)

1. **Q-1 — Budget ceilings.** Initial ≤ 150,000 B gzip, three ≤ 140,000 B gzip, total ≤ 300,000 B gzip. Current evidence: the `adaptive-render-budget-v2` build is ≈983.50 kB raw / 273.10 kB gzip (`index-Dn5pY2q7.js`); the audit's non-Three remainder is 139,789 B gzip (271,171 − 131,382), leaving ≈10.2 kB under the initial ceiling, ≈8.6 kB under the three ceiling, and ≈26.9 kB under the total. T3's fresh post-split measurement is authoritative; if a ceiling is exceeded, the builder reports `blocked` and does not silently raise it.
2. **Q-2 — Brotli.** gzip only; `nginxinc/nginx-unprivileged:1.27-alpine` has no `ngx_brotli`, and a custom nginx build is out of scope.
3. **Q-5 — Smoke-only `frontend-prod`.** Add it to `compose.smoke.yaml` only, with no host port; `compose.yaml` and `podman compose up` stay untouched; the smoke's bounded readiness poll is the readiness gate.
4. **Q-6 — Shell cache policy.** `no-cache` for `/`, `/index.html`, and the SPA fallback; hashed `/assets/*` are immutable for one year.
5. **Q-9 — CI smoke build prerequisite.** T4 explicitly builds `frontend-prod`; a clean CI `docker compose -f compose.yaml -f compose.smoke.yaml run --rm smoke` must either auto-build the dependency image or be preceded by `docker compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` (or use `run --build --rm smoke`). This is a user-owned workflow amendment and an acceptance prerequisite if the provider does not auto-build.

## Minimum remaining revisions

None. The eight INFO observations are optional clarifications; no BLOCKER, MAJOR, or MINOR remains. The planner may adopt F5–F9 at its discretion; F10–F12 are accepted as documented. Approval is not conditional on them.
