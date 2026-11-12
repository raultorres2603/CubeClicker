---
feature: adaptive-render-budget-v2
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
✅ approved — 0 blocking, 2 MINOR, 3 INFO. I reproduced the full suite rather than trusting the build logs: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, and `npm run build` all exit 0; the coverage is backend 95.43/87.71/99.70/95.43 and frontend 96.47/96.14/97.64/96.47, all four metrics ≥ 80 in both workspaces with no new exclusions or threshold changes. The AC-2 welcome test, AC-12 pinned stream, 10,000-push `Array.prototype.sort` spy, production-adapter contract, scene shadow suite, GameCanvas close/reopen + StrictMode, and the context-loss probe are green in the 1770-test frontend run.

The code matches the spec: gate-deferred attach is exercised for guest/login/registration/initially-closed; the detached retry is status-only and the attach subscribes before connect; the high tier keeps the exact four-pass composer, SSAO `0.5/0.005/0.1`, bloom `0.45/0.4/0.85`, 2048² shadows, DPR 2, and the composer; medium drops SSAO and caps DPR 1.5; low never constructs a composer, performs exactly one `renderer.render`, disables shadows, and caps DPR 1; the sorted-window p95 is exact and sort-free. The docs are correct: the README has the exact AC-16 sentence, `docs/architecture/frontend-rendering.md` has all four sections and every relative link resolves, the predecessor directories are unchanged, and `docs/features/README.md` is untouched. The only out-of-scope commit content is the T2 compile-required no-op `setQuality` in `session-spaceship.test.ts` (documented in `build-log-T2.md`); no behavior or assertion changed.

The manual visual pass was **not executed** — this environment has Podman but no browser/GUI or Playwright/Puppeteer binary (verified). This is acceptable for code-review approval because the spec makes the manual pass supplementary human-visible evidence and every AC is test-pinned; the human-visible high-tier parity, gate network/cookie, CPU-throttled degradation, and lifecycle probes remain a **non-blocking acceptance-time follow-up on a GUI host**. The user approved the visual defaults (low shadows off, intro at gate close, DPR 2/1.5/1.0).

## Acceptance verification
| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `App.test.tsx` shows attach `0` while the menu/login form is open and one attach with the canvas after `join('guest')`; `GameCanvas.test.tsx` shows no renderer/listener/frame while `active=false`. |
| AC-2 | ✅ (cookie manual-deferred) | The T2 named test `'receives welcome after a detached retryConnection → join(account) → attach cycle'` records `join:account, onMessage, onStatus, connect`, `connectCount()===1`, `closeCount()===0`, serverId 42, and the intro advance; the T4 App order is `login < retry < join < attach`. The cookie-at-upgrade is the unchanged browser/`ws/connection` path; its manual network evidence is environment-deferred (F2). |
| AC-3 | ✅ | `App.test.tsx` registration-pending and `Back to login` keep attach/join/retry at `0`; the gate remains `menu`. |
| AC-4 | ✅ | `chosen: true` mount attaches once; the SSR canvas markup is byte-identical; `active=true → false → true` gives first attach 1 / dispose 1 / second attach 2, and the StrictMode-like remount ends at attach 2 / dispose 1. |
| AC-5 | ✅ | `quality.test.ts` exact matrix high/medium/low × reduced-motion true/false with `ssao/bloom/shadowMapSize/pixelRatioCap`; constants and high pins (`2048`, `PIXEL_RATIO_CAP` 2) asserted. |
| AC-6 | ✅ (human-visible manual-deferred) | `postprocessing.test.ts` high pass list, SSAO 0.5/0.005/0.1, bloom 0.45/0.4/0.85; `webgl.test.ts` high composer; `scene.test.ts` `castShadow=true`, 2048²; `session.test.ts` DPR 2. The pixel-level high-parity comparison is environment-deferred (F2). |
| AC-7 | ✅ (visual manual-deferred) | Medium builds `RenderPass, UnrealBloomPass, OutputPass`, no SSAO; shadows 1024; DPR 1.5; scene and adapter suites green. |
| AC-8 | ✅ (visual manual-deferred) | `webgl.test.ts` low never constructs a composer, exactly one `renderer.render` per call, `shadowMap.enabled=false`; `scene.test.ts` `castShadow=false` and the previous map is not resampled; DPR 1. |
| AC-9 | ✅ | `webgl.test.ts`/`scene.test.ts` dispose-every-replaced-composer, rebuild pass list, last size/ratio replay once, high restoration, render-after-dispose no-op; the scene fake map disposed once and nulled. |
| AC-10 | ✅ | Attach order `setQuality:high → setPixelRatio:2 → setSize:800:600`; tier-change frames `setQuality → setPixelRatio → render` for high→medium and medium→low; stable frames add none; the production-adapter contract mirrors it. |
| AC-11 | ✅ | `quality.test.ts` naive-reference equivalence over pushes/duplicates/eviction; 10,000 pushes with `Array.prototype.sort` throwing end at window 120 / average 13.875 / p95 20 / high; pre-existing policy tests unchanged. |
| AC-12 | ✅ | The pinned test `matches the pinned stream: 60×30, 60×10, 60×10` asserts 60/30/30, 120/20/30, 120/10/10; tiers 59 high / 100 medium / 21 low; no internal streak assertion. |
| AC-13 | ✅ (manual lifecycle deferred) | `session.test.ts` resize-before-attach, hidden-at-attach, dispose/re-attach, escaped callback, and synthetic context loss/restore with no new listener/frame; `GameCanvas.test.tsx` listener/frame/scheduler counts. The interactive resize/tab/reload probes are environment-deferred (F2). |
| AC-14 | ✅ | The named welcome test plus the attached `disconnected`/`Retry` close+connect exactly once and one `connecting` publish; `transport.test.ts` unchanged and green. |
| AC-15 | ✅ | Rerun: 868 backend + 1770 frontend tests pass; coverage 95.43/87.71/99.70/95.43 and 96.47/96.14/97.64/96.47; no exclusion or threshold change. |
| AC-16 | ✅ | `grep -F` finds the exact README sentence; `docs/architecture/frontend-rendering.md` has the four `##` sections and all 15 relative links resolve; `git status --porcelain -- docs/features/README.md` is empty. |
| AC-17 | ✅ | The supersession ledger rows are present; `git diff --exit-code -- docs/features/user-authentication docs/features/realistic-lighting-materials docs/features/spaceship-cursor-loot-animations` is empty. |

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `src/frontend/src/game/session-spaceship.test.ts:62,142`, `tasks.md` T2 `files_owned`, `build-log-T2.md` § Deviations | The T2 commit `39f664b` edits `session-spaceship.test.ts` (adds a no-op `setQuality() {}` to two inline renderer fakes), but that file is not in T2's `files_owned`. The change is compile-required by the new `RendererAdapter.setQuality` and the T2 log documents it explicitly; no behavior or assertion changed. | Add `session-spaceship.test.ts` to T2's `files_owned` in the plan/tasks (or record the documented exception at acceptance). Build-time bookkeeping note only; no code change. | open |
| F2 | MINOR | `build-log-T5.md:166-185` | The manual containerized visual pass records all four steps as **not executed — environment** (no browser/GUI, no Playwright/Puppeteer; verified by this review's probe). The high-tier structural parity, gate-deferred attach, degradation, and lifecycle are test-pinned, but the human-visible pixel/network/concurrency checks are not demonstrated. | Carry a non-blocking acceptance-time manual follow-up on a GUI host: high-tier 1280×720/1920×1080 parity screenshots, gate network panel (no `/ws` until choice; one socket after login/guest; cookie present), CPU-throttled medium/low and recovery, resize/tab/reload. Record the results in the acceptance log; the manual pass is human-visible evidence and never a substitute for the automated ACs. | open |
| F3 | INFO | `src/frontend/src/render/postprocessing.ts:80-96` | `createPostprocessing(..., 'low')` builds `RenderPass + OutputPass` if called directly, while AC-8 says the adapter never constructs a composer at low. The production adapter bypasses the builder; the direct low path exists only for the test of the function's pass list. | No change required; the adapter bypass and the test are explicit. Keep the low direct-call as a defensive/test-only branch. | open |
| F4 | INFO | `status.md`, `docs/features/README.md`, `reviews/` | The acceptance bookkeeping is pending: the status is `code_review`, `docs/features/README.md` has no `adaptive-render-budget-v2` row, and this code-review artifact is new. The T5 log's proposed row is `planning`. | Acceptance-time actions: add the `adaptive-render-budget-v2` row with `accepted` and the acceptance date; set `status.md` accepted with an acceptance loop-log entry; commit `reviews/code-review-r1.md` with the acceptance bookkeeping. | open |
| F5 | INFO | `build-log-T5.md:181`, `plan.md` § Verification step 2 | The gate-deferral manual step (no `/ws` before choice, one socket after login/guest, cookie present) is part of the F2 environment deferral; the welcome itself is automated and green. | Covered by the F2 GUI-host follow-up; no separate action. | open |

## Verification performed
- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0 (both workspaces).
- `npm test` → backend 24 files / 868 tests passed; frontend 64 files / 1770 tests passed; exit 0.
- `npm run coverage` → backend 95.43% statements / 87.71% branches / 99.70% functions / 95.43% lines; frontend 96.47% / 96.14% / 97.64% / 96.47%; exit 0; all four metrics ≥ 80 in both workspaces.
- `npm run build` → exit 0; only the pre-existing chunk-size warning.
- Docs: `test -f docs/architecture/frontend-rendering.md` and all four `##` sections present; `grep -F` finds the exact AC-16 README sentence; `git status --porcelain -- docs/features/README.md` empty; the three predecessor directories `git diff --exit-code` empty; the compose/Dockerfile/backend/package no-runtime diff empty; every relative link in `frontend-rendering.md` resolves.
- Manual environment probe: `podman compose version` works, but no `chromium`/`chrome`/`firefox`/`epiphany` binary and no Playwright/Puppeteer in `node_modules`; the four manual steps remain not executed (not treated as passed).
- Commit scope: T1 `0e8343a` (quality + test + log), T2 `39f664b` (postprocessing/webgl/session + tests + the documented `session-spaceship.test.ts` no-op + log), T3 `ff9d1a4` (scene + test + log; the two sibling scene suites unchanged), T4 `5d0869b` (App/GameCanvas + tests + log), T5 `11c5468` (README, new doc, log, and the staged spec/plan/tasks/status/reviews). No source/config/container change outside the feature paths; no secrets.
- Working tree: the only tracked modification is the orchestrator's `status.md` `building → code_review` transition; this review wrote only `reviews/code-review-r1.md`.

## Checklists
| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | Client-local rendering only; no user-controlled data, secrets, dependencies, persistence, or auth weakening; the server remains the authority and the deferral only delays the socket; the context-loss path adds no handler; resource disposal is bounded. |
| Quality | ✅ | The renderer/session/policy seams are clear; the quality matrix is single-source; the docs are accurate and linked; no dead code or drive-by edits; the T2 `session-spaceship.test.ts` no-op is the only out-of-`files_owned` content (F1). |
| Testing | ✅ | 868 + 1770 tests green; coverage ≥ 80 on all four metrics in both workspaces; concrete assertions, no wildcard/snapshot-only/assertion-free tests; the AC-2 welcome, AC-12 stream, sort spy, production contract, scene shadow, GameCanvas/App, and context-loss tests are the evidence. The manual human-visible pass is deferred (F2). |
| Real-time | ✅ N/A | No shared/cross-client state; AC-14 pins the unchanged transport and the detached-path welcome. |
| Containers | ✅ N/A | No service, image, port, env, or endpoint change; `npm run smoke` is not an acceptance gate and was not run. |

## Previous round verification
Code-review r1 has no previous code-review round. The spec-review r3 carries are all closed: F1-r2 (AC-12 unobservable streak) fixed by the r3 rewrite; F3-r2 (AC-2 cookie evidence) fixed by the `ws/connection`/manual citation; F4-r2 (AC-4 counts) fixed by the explicit first/second attach counts; F5-r2 (unexposed streak) fixed; F1-r3 (stale status bullet) fixed by the current status loop log and task board.

## Notes / backlog (non-blocking)
- **High-tier structural parity** is pinned by `postprocessing.test.ts`/`webgl.test.ts`/`scene.test.ts`/`session.test.ts` (four-pass composer, SSAO/bloom constants, 2048², DPR 2, composer render) and the high tier remains the acceptance tier. The pixel-level comparison is the F2 GUI-host follow-up.
- **Welcome race:** the T2 named test and the existing `session.attach` subscribe-before-connect order (`session.ts:1315-1319`) prove the attach-time welcome cannot be missed; the cookie-at-upgrade network evidence is part of F2/F5.
- **T5 docs:** the README sentence is exact, `docs/architecture/frontend-rendering.md` is complete and linked, the predecessor dirs and `docs/features/README.md` are untouched, and the T5 log records the environment deferral honestly.
- **Commit scope:** only the T2 `session-spaceship.test.ts` no-op is outside its declared `files_owned` (F1); T1/T3/T4/T5 are scoped. The T5 `commits_also` staged the planner/reviewer/orchestrator artifacts without editing them.
- **Manual pass:** the environment is headless (verified); no manual step is recorded as passed. The automated AC evidence is authoritative per the spec's testing strategy.

## Acceptance-time actions
1. Add the `adaptive-render-budget-v2` row to `docs/features/README.md` with state `accepted` and the acceptance date (the T5 log's proposed row currently says `planning`).
2. Set `docs/features/adaptive-render-budget-v2/status.md` to `accepted` with an acceptance loop-log entry and the final clean tree.
3. Commit `reviews/code-review-r1.md` with the acceptance bookkeeping (the T5 `commits_also` review path).
4. Run the F2 manual visual pass on a GUI host (high-tier 1280×720/1920×1080 parity; gate network/cookie; CPU-throttled medium/low and recovery; resize/tab/reload) and record the results in the acceptance log; the manual pass is human-visible evidence, not a substitute for the automated ACs.
5. Record the T2 `session-spaceship.test.ts` compile-required no-op exception (F1) in the acceptance log, or update T2's `files_owned` in the plan/tasks before archiving.
