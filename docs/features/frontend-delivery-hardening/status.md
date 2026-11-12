---
feature: frontend-delivery-hardening
state: building
spec_review_round: 3
build_round: 1
created: 2026-11-12
updated: 2026-11-12
---
# Status — Frontend Delivery Hardening

## Summary

Next performance feature of the approved audit queue: **P-04** (the frontend is one 982,591 B raw / 271,171 B gzip chunk, with Three.js at 662,772 B raw / 131,382 B gzip statically reachable from the auth/menu) and **P-06** (no gzip, no immutable hashed-asset caching, no explicit `no-cache` shell in `src/frontend/nginx.conf`). The feature makes the auth/menu entry Three-free by moving the game runtime and customization preview behind dynamic imports, adds loading/error/retry states while preserving the accepted gate-deferred attach, adds a fresh-build gzip budget gate to `npm run build` (and therefore CI and the Docker build stage), enables gzip + the cache-header matrix in nginx, and proves the prod image's headers/chunk graph in the containerized smoke. Raw request: "Please, find any kind of performance optimizations we can do on project and, also, find new skills we added and provide some new features you think are good to have" followed by "Proceed with all of them, one by one".

## Task board
- [x] T1 — Runtime environment seam and load status (builder) `[seq]`
- [x] T2 — Gate-close loading/error UI and deferred customization preview (builder) `[seq]`
- [x] T3 — Vite chunking and bundle-budget gate (builder) `[seq]`
- [x] T4 — nginx delivery and containerized prod smoke (builder) `[seq]`
- [ ] T5 — Documentation and final verification (builder) `[seq]`

## Loop log
- 2026-11-12 — created → PLANNING — audit queue item (performance P-04/P-06); planner artifacts r1 written (`spec.md`, `plan.md`, `tasks.md`); raw request quoted above.
- 2026-11-12 — spec review r1 → changes_requested (1 major: intro-timing supersession; 3 minor); planner revision r2 pending — `reviews/spec-review-r1.md`
- 2026-11-12 — planner revision r2 applied — gate-close intro timing preserved (Q-4 resolved, no supersession); CI readiness/budget/byte fixes; → SPEC_REVIEW round 2 — `spec.md` r2
- 2026-11-12 — spec_review → awaiting_approval — r2 approved (0 blockers); delivery decisions Q-1/Q-2/Q-5/Q-6/Q-9 need confirmation — `reviews/spec-review-r2.md`
- 2026-11-12 — awaiting_approval → building — user approved defaults: budgets 150/140/300 KB gzip; gzip only; smoke-only frontend-prod; no-cache shell; explicit CI prod build — user message
- 2026-11-12 — building T1 completed — runtime dynamic seam + load status; commit `7707753`; frontend coverage 96.41/96.12/97.51/96.41; 1778 tests — `build-log-T1.md`
- 2026-11-12 — building T2 completed — loading/error UI + deferred customization; commit `b62dae4`; frontend coverage 96.42/96.1/97.53/96.42; 1791 tests — `build-log-T2.md`
- 2026-11-12 — building T3 blocked — fresh build: three gzip 154,323 B exceeds approved 140,000 B; initial 95,903 ≤ 150,000; total 273,854 ≤ 300,000; no in-scope build change closes the gap; T3 implementation uncommitted — `build-log-T3.md`
- 2026-11-12 — blocked → spec_review — user approved raising the Three.js ceiling to 165,000 B (initial 150,000 / total 300,000 unchanged); planner revision r3 applied; review round 3 pending — `spec.md` r3
- 2026-11-12 — spec_review → building — r3 review confirms spec consistent; sole blocker is the T3 implementation still pinning 140000; no planner revision needed; T3 fix-up/resume — `reviews/spec-review-r3.md`
- 2026-11-12 — building T3 completed — Vite chunking + gzip budget gate; commit `62fde61`; fresh 95,903 / 154,323 / 273,854 B vs 150,000 / 165,000 / 300,000; build green — `build-log-T3.md`
- 2026-11-12 — building T4 completed — nginx gzip/immutable/no-cache + prod smoke; commit `4290713`; smoke 19/19; brotli absent; nginx config valid — `build-log-T4.md`

## Blockers / open questions
- Q-1 — budget ceilings approved r3: initial ≤ 150,000 B gzip, three ≤ 165,000 B gzip, total ≤ 300,000 B gzip; fresh T3 measurement 95,903 / 154,323 / 273,854; future overruns block, never silently raise.
- Q-2 — brotli: recommended gzip only; `nginxinc/nginx-unprivileged:1.27-alpine` has no `ngx_brotli`; a custom nginx build is out of scope.
- Q-3 — loading/error copy: exact strings pinned in AC-2/AC-4 (`Loading the game…`, `The game could not be loaded.`, `Try again`; `Loading customization…`, `Customization could not be loaded.`, `Try again`).
- Q-4 — resolved: gate-close intro timing is preserved; the loader elapsed is skipped; not a user decision and no supersession.
- Q-5 — prod smoke service: recommended smoke-only `frontend-prod` in `compose.smoke.yaml`, no host port; `podman compose up` unchanged.
- Q-6 — shell cache policy: recommended `no-cache` for `/`/`index.html`/SPA fallback.
- Q-7 — bundle-report exposure: recommended serving `/bundle-report.json` (names/sizes only).
- Q-8 — React vendor chunk: recommended explicit `react` manual chunk.
- Q-9 — compose auto-build: if the CI compose provider does not build a missing `frontend-prod` on `run --rm smoke`, a user-owned `--build` CI amendment is needed.
- Planner revision r2 applied; spec review round 2 approved; r3 budget revision applied; T3 fix-up in progress.
- **T3 budget blocker resolved:** user approved raising the Three.js ceiling to 165,000 B; initial 150,000 and total 300,000 unchanged. T3 fix-up/re-run pending.
