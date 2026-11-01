---
feature: smoke-mailpit-ordering
phase: code
iteration: 1
verdict: approved
blocking: []
nonblocking: 3
---

# Code Review — r1

## Summary

✅ approved — The two-file change (compose.smoke.yaml + tests/e2e/smoke.mjs) restores the one-command smoke contract. Independently reproduced: unprimed `npm run smoke` → `SMOKE PASS (12/12 checks)`, exit 0; Mailpit-primed run → 12/12, exit 0; merged Compose config valid with `mailpit: service_started` under `smoke.depends_on`; `node --check` passes; lint/typecheck/test/coverage (backend 94.97/86.19/99.65/94.97, frontend 95.19/95.10/96.89/95.19) and build all exit 0. No `src/`, Dockerfile, CI, or framework changes. Three INFO notes remain (cosmetic/pre-existing or optional); no BLOCKER/MAJOR.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | Tore down all containers, ran `npm run smoke` (no `up -d mailpit` pre-step) → `SMOKE PASS (12/12 checks)`, exit 0 (observed 2026-11-01; backend healthz, frontend html, 2× ws hello, multiplayer join/overflow/explode/leave, auth register/verify/login/guest all PASS). |
| AC-2 | ✅ | `compose.smoke.yaml:22-28` `smoke.depends_on` now long form includes `mailpit: condition: service_started` (T1 commit 794737b). Merged config shows `mailpit: { condition: service_started, required: true }`. |
| AC-3 | ✅ | CI workflow `.github/workflows/ci.yml:44-46` retains `up -d mailpit` pre-start step before `run --rm smoke` (untouched by this feature). Independently ran `podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit` then `npm run smoke` → `Container cubeclicker-mailpit-1 Running` / `SMOKE PASS (12/12 checks)`, exit 0. |
| AC-4 | ✅ | `podman compose -f compose.yaml -f compose.smoke.yaml config` → exit 0 (stderr only the podman external-provider notice); merged `smoke.depends_on` = backend/frontend/mailpit all `service_started`. |
| AC-5 | ✅ | `git diff 9b87fb1..HEAD --name-only` shows only `compose.smoke.yaml` + `tests/e2e/smoke.mjs` (no `src/`). `npm run lint`/`typecheck`/`test` (44 files, 1099 tests)/`coverage`/`build` all exit 0. |
| AC-6 | ✅ | `node --check tests/e2e/smoke.mjs` → exit 0. |
| AC-7 | ✅ | `tests/e2e/smoke.mjs:593-605` `checkAuthFlow()` calls `pollUntilReady(MAILPIT_URL + '/', …)` (status 200 predicate) before `POST /auth/register`; on failure sets `registerProblem = "Mailpit not ready: …"` and skips verify/login via existing control flow, guest check still runs. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | INFO | `compose.smoke.yaml` (EOF) | File has no trailing newline (carried from the original pre-change file; not introduced by T1). | None required; cosmetic. Optional: add trailing newline for POSIX cleanliness. | open (pre-existing) |
| F2 | INFO | `tests/e2e/smoke.mjs:597` | Mailpit readiness poll reuses `READY_TIMEOUT_MS` (30s) via `pollUntilReady` instead of `MAILPIT_TIMEOUT_MS` (10s). Gives Mailpit more headroom; harmless. | None required. If a tighter bound is desired, pass a dedicated budget. | open (optional) |
| F3 | INFO | `build-log-final-verification.md` (AC-3 evidence) | Spec-review F3 (compose-provider parity) was not recorded in the build log, but is validated here: local provider is docker-compose v5.6.0 under podman, so `depends_on` semantics are identical to CI's docker compose. | None required; note for the record. | waived/noted |

## Verification performed

- `podman compose -f compose.yaml -f compose.smoke.yaml down` (clean host) → no containers; then `npm run smoke` → `SMOKE PASS (12/12 checks)`, exit 0 (unprimed).
- `podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit` → `Container cubeclicker-mailpit-1 Running`; then `npm run smoke` → `SMOKE PASS (12/12 checks)`, exit 0 (primed).
- `podman compose -f compose.yaml -f compose.smoke.yaml config` → exit 0; merged `smoke.depends_on` = backend/frontend/mailpit all `condition: service_started, required: true`.
- `node --check tests/e2e/smoke.mjs` → exit 0.
- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0 (backend + frontend).
- `npm test` → `Test Files 44 passed (44)`, `Tests 1099 passed (1099)`, exit 0.
- `npm run coverage` → backend All files 94.97/86.19/99.65/94.97; frontend 95.19/95.10/96.89/95.19; exit 0 (≥80 all four metrics, both workspaces).
- `npm run build` → exit 0 (backend tsc; frontend vite built in 1.46s).
- `git diff 9b87fb1..HEAD --name-only` → only `compose.smoke.yaml` + `tests/e2e/smoke.mjs` (plus feature artifacts); no `src/`, no `.opencode/`, no `docs/architecture/`, no Dockerfile/CI changes.
- `.github/workflows/ci.yml` Mailpit pre-start step (line 46) present and unchanged.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No secrets, ports, images, env vars, or dependencies added; `.env*` untouched; change limited to service ordering + readiness poll. |
| Quality | ✅ | Diff traceable to T1/T2; no drive-by refactors; no dead code; single-command local run restored. |
| Testing | ✅ | Coverage ≥80 both workspaces (verified independently); no TS tests changed; containerized e2e 12/12 both unprimed and primed; `node --check` passes. |

## Spec-review findings (r1) resolution

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (MINOR) T3 verify missing primed run | fixed | `build-log-final-verification.md` records both unprimed and primed smoke runs (12/12 each). |
| F2 (MINOR) readiness predicate unspecified | fixed | Code uses `response.status !== 200` (line 598); build log T2 documents "validate requires HTTP 200". |
| F3 (INFO) compose-provider parity | noted | Validated here (F3 above); local provider = docker-compose v5.6.0. |
| F4 (INFO) long form for all depends_on | fixed | T1 commit converted backend/frontend to long form and added mailpit (all `service_started`). |
| F5 (INFO) `docs/features/README.md` row | deferred | Orchestrator applies the row on acceptance per `docs/architecture/documentation.md` § Ownership; builder did not edit the index. |

## Notes / backlog (non-blocking)

- Documentation gate: no doc changes in this feature (infra/config only; no new ports/services/images). Per spec, the `docs/features/README.md` row is proposed/applied by the orchestrator at acceptance. No architecture doc updates required.
- Framework contracts (8 states, autonomy directive, verdict/report formats) unchanged — no `.opencode/` or `docs/architecture/` edits in this feature.
- Wishlist/out-of-scope items (historical verify-anchor false positives, AWS provisioning, F22 podman ARG nuance) remain INFO at most per spec Non-goals.