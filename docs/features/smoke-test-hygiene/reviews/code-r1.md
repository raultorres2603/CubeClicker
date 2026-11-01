---
feature: smoke-test-hygiene
phase: code
iteration: 1
verdict: approved
blocking: []
nonblocking: 1
---

# Code Review — r1

## Summary

✅ approved — Both carried-over INFO items are implemented exactly as specified: `compose.smoke.yaml` now ends with a single trailing newline (byte-verified), and `pollUntilReady` takes an optional third positional budget defaulting to `READY_TIMEOUT_MS` with the Mailpit call site passing `MAILPIT_TIMEOUT_MS` (10000). Independently reran the full gate suite (lint, typecheck, test, coverage ≥ 80% both workspaces, build) and both smoke variants; all green at 12/12. No `src/` changes; framework/container contracts unchanged.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `tail -c 2 compose.smoke.yaml \| od -c` → `d  \n` (single trailing newline); independently rerun 2026-11-01. |
| AC-2 | ✅ | `git show e52a090^:compose.smoke.yaml` tail → `e d` (no newline); committed version → `d  \n`; only the trailing newline added. `git diff -- compose.smoke.yaml` empty (already committed). |
| AC-3 | ✅ | `tests/e2e/smoke.mjs:75` `async function pollUntilReady(url, validate, timeoutMs = READY_TIMEOUT_MS)`; deadline uses `timeoutMs`; backend/frontend call sites (lines 99, 114) omit it. |
| AC-4 | ✅ | `tests/e2e/smoke.mjs:597`–602 Mailpit call passes `MAILPIT_TIMEOUT_MS` as the third argument. |
| AC-5 | ✅ | `tests/e2e/smoke.mjs:55` `const MAILPIT_TIMEOUT_MS = 10000;` and it is the budget used by the Mailpit readiness poll (line 602). |
| AC-6 | ✅ | `node --check tests/e2e/smoke.mjs` → exit 0 (independently rerun). |
| AC-7 | ✅ | `podman compose -f compose.yaml -f compose.smoke.yaml config` → exit 0 (independently rerun; only provider notice on stderr). |
| AC-8 | ✅ | `npm run lint`/`typecheck`/`test`/`coverage`/`build` all exit 0; coverage 94.97%/86.19% (backend), 95.19%/95.09% (frontend); `git diff --name-only` shows no path under `src/`. |
| AC-9 | ✅ | Unprimed cold start `npm run smoke` → `SMOKE PASS (12/12 checks)`, exit 0 (independently rerun). |
| AC-10 | ✅ | Primed run (Mailpit pre-started, all containers running) `npm run smoke` → `SMOKE PASS (12/12 checks)`, exit 0 (independently rerun). |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | INFO | working tree (docs/features/README.md) | Uncommitted modification adds the `smoke-mailpit-ordering` row to the orchestrator-owned feature index. This is unrelated to `smoke-test-hygiene` (this feature adds no README row, as specified) and is not a `src/` change; it appears to be the carried-over acceptance row for the prior feature. | No action for this feature; orchestrator to confirm ownership/application of that row per `docs/architecture/documentation.md` § Ownership. | open |

## Verification performed

- `tail -c 2 compose.smoke.yaml | od -c` → `d  \n`, exit 0 (single trailing newline).
- `git diff -- compose.smoke.yaml` → empty (already committed); pre-change (e52a090^) tail → `e d` (no newline); committed version → `d  \n`. Confirms only the added newline.
- `git show e52a090^:compose.smoke.yaml \| tail -c 2 \| od -c` → `e d` (pre-change had no trailing newline).
- `podman compose -f compose.yaml -f compose.smoke.yaml config` → exit 0 (provider notice only on stderr).
- `node --check tests/e2e/smoke.mjs` → exit 0.
- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0.
- `npm test` → backend 21 files/630 tests, frontend 44 files/1099 tests, exit 0.
- `npm run coverage` → backend 94.97% stmts / 86.19% branch / 99.65% funcs / 94.97% lines; frontend 95.19% / 95.09% / 96.89% / 95.19%; exit 0 (thresholds ≥ 80% met both workspaces).
- `npm run build` → exit 0 (backend tsc clean; frontend vite built in ~1.4s).
- Unprimed `npm run smoke` (cold start, all containers stopped then recreated) → `SMOKE PASS (12/12 checks)`, exit 0.
- Primed `npm run smoke` (mailpit/db/backend/frontend already running) → `SMOKE PASS (12/12 checks)`, exit 0.
- Source inspection: `pollUntilReady(url, validate, timeoutMs = READY_TIMEOUT_MS)` (line 75); Mailpit call site passes `MAILPIT_TIMEOUT_MS` (line 602); `MAILPIT_TIMEOUT_MS = 10000` (line 55); backend/frontend call sites (lines 99, 114) retain default 30 s.
- `git diff --name-only` → `docs/features/README.md`, `tests/e2e/smoke.mjs`; no path under `src/`. `compose.smoke.yaml` already committed (T1). No production code changed.
- Coverage config inspection: `src/backend/vitest.config.ts` and `src/frontend/vitest.config.ts` unchanged; thresholds pinned at 80 on all four metrics; exclusions limited to test files + composition-root entrypoint (`server.ts`/`main.tsx`) plus Vitest built-in defaults; no number-gaming introduced by this feature.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No `src/`, compose service/image/port/env, dependency, or secret changes. `.env*` untouched. `compose.smoke.yaml` change is file termination only. |
| Quality | ✅ | Minimal, confined diff traceable to T1/T2; no dead code, no drive-by refactors; backward-compatible default preserves existing callers. |
| Testing | ✅ | No new TS (no new unit tests expected per spec); `node --check` green; containerized smoke 12/12 both unprimed and primed; coverage ≥ 80% both workspaces; no banned matchers introduced (no tests changed). |

## Previous round verification (if iteration > 1)

N/A — first code iteration (r1). Spec review r1 (approved, 0 blocking, 3 non-blocking MINOR/INFO: AC-8 granularity, OQ-1 framing, OQ-2 wording) carried forward as non-blocking; none affect the code or the gate.

## Notes / backlog (non-blocking)

- Spec-review findings F1–F3 (MINOR/INFO) remain open as documentation/wording notes; they do not block acceptance and are tracked in `reviews/spec-r1.md`.
- The `docs/features/README.md` modification (F1) is outside this feature's ownership scope and is an orchestrator-owned row for `smoke-mailpit-ordering`; it is not counted as a change to this feature.
- Real-time, containerization, and framework contracts: unchanged by this feature (verified by absence of `src/`, compose service, Dockerfile, CI, or config diffs). Container contract (`docs/architecture/containerization.md`) still holds; merged Compose config validates.