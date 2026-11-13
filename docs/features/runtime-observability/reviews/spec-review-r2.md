---
feature: runtime-observability
phase: spec_review
round: 2
iteration: 2
verdict: approved
reviewed: 2026-11-13
blocking: 0
nonblocking: 2
---
# Spec Review — r2

## Summary

✅ approved — 0 blocking (0 BLOCKER, 0 MAJOR), 2 MINOR. All r1 blockers and major findings are resolved in the r2 spec/plan/tasks: top-level and nested redaction paths, the reserved `le` histogram label, the joined-state `/metrics` smoke scrape, the `LogSink`/Pino adapter contract, sequential T3/T4 with smoke moved to T5, the `{calls, triangles}` adapter mapping, App-level RTT gating, the exported `escapeLabelValue` seam, and the AC-11/AC-12/AC-13 clarifications. The remaining MINOR items are bookkeeping/verification: the `status.md` task board is stale (`[P]` and T3 smoke), and the T5 entry-hash grep pattern does not match the pretty-printed `bundle-report.json`. Neither changes the design or blocks the build.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `docs/features/runtime-observability/status.md:19-20` | The status task board still marks T3 and T4 `[P]` and describes T3 as including "smoke". `tasks.md:3` now declares **all tasks `[seq]`** (T3 → T4 → T5) and `tasks.md:53` gives `tests/e2e/smoke.mjs` to T5. The status board contradicts the authoritative task graph; if the orchestrator trusts the board, it could launch T3/T4 in parallel and reintroduce the r1 F5 verification/smoke collision. The status loop log at `:28` already says "sequential T3-T4", so only the board is stale. | Update the status task board before T1: T3 `[seq]` without smoke, T4 `[seq]`, T5 `[seq]` with smoke/docs/final verification. This is orchestrator bookkeeping; no spec/plan/tasks change. | open |
| F2 | MINOR | `tasks.md:55` (T5 `verify`), `spec.md:77` (AC-26) | The T5 entry-hash command `grep -o '"file":"assets/index-[^"]*"' src/frontend/dist/bundle-report.json \| head -n 1` does not match the actual pretty-printed report, which writes `"file": "assets/index-BiM91p6y.js"` with a space after the colon. The grep produces no output, and the trailing `| head -n 1` returns exit 0, so the verify silently "passes" without recording the hash that AC-26 requires. | Use a pattern that matches the pretty-printed report (`grep -o '"file": "assets/index-[^"]*"'` or `grep -o 'assets/index-[^"]*\.js'`) and make the step fail when empty (`grep -q` / `test -n`), or record the hash directly from the `npm run build` output. Update `tasks.md:55` and the T5 note/build-log evidence. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All 26 ACs, the user stories, the three-tier boundaries and the non-goals are present; the three compose pass-throughs are explicit and the raw request's audit-queue scope is unchanged. |
| Testability | ✅ | Every AC is binary and mapped to a test/command. F2 is a verification-command bug, not an AC ambiguity; F1 is a status mirror. The redaction, `le`, smoke, `LogSink`, stats, RTT and escape fixes are now concrete. |
| Boundaries | ✅ | Always/Ask-first/Never and the non-goals still exclude public metrics, new infra, dependencies, slow-client policy, protocol versions and production overlay; Q-1..Q-3 are the material choices. |
| Dependency graph | ✅ | T1 → T2 → T3 → T4 → T5 is acyclic; all 26 ACs are mapped; AC-9 is T5-owned; T3 no longer owns smoke; T5 owns the smoke/docs/compose finalization. |
| Parallel safety | ✅ | `tasks.md` has no `[P]` markers; T3/T4 are sequential, with T4 after T3 and smoke/build in T5. F1 is the stale status-board copy, not a task-plan defect; sync it before T1. |
| Security | ✅ | Top-level and nested redaction paths cover the AC-2 test; `/metrics` remains backend-only on 8080 and is not ALB/Terraform-routed; `METRICS_ENABLED` is the kill switch; labels are allow-listed plus the renderer-reserved `le`; the overlay is default false and production-built without the flag. No PII, public exposure or overlay leak remains. |
| Testing | ✅ | Unit/integration/e2e tiers and the ≥ 80% per-workspace coverage gate are present; the `LogSink` adapter, `escapeLabelValue`, AC-11 baseline/delta, post-close gauges and the joined-state smoke are all concrete. F2 only fixes the hash-evidence command. |
| Consistency | ✅ | Spec, plan and tasks agree on the three compose entries, AC-9/T5 ownership, the `LogSink`/Pino order, `{calls, triangles}` → `drawCalls`, the `le` exemption and the sequential graph. F1 is the stale status mirror; sync before T1. |
| Real-time | ✅ | Observability only: no cross-client value, authority, reconnect/grace or game-protocol change; `ping`/`pong` is connection-local, 1 Hz-bounded and cannot alter membership/economy/boards. |
| Containers | ✅ | No new service, image, port, host mapping or healthcheck; `/metrics` is on the existing backend 8080 and not routed; the compose changes are exactly the three safe pass-throughs; `compose.smoke.yaml`, Dockerfiles and Terraform remain unchanged. |
| Documentation | ✅ | `docs/architecture/observability.md` (five sections, 30-metric catalog including `le`), README `## Operations`/configuration rows and the deployment routing sentence cover the shipped behavior; `docs/features/README.md` is not edited by the builder. |
| Risks | ✅ | Log volume/cost is now explicitly risked and bounded; redaction, cardinality, public exposure, DB wrapper semantics, shutdown, overlay and ping abuse remain covered. |
| Approval checkpoint | ✅ | Q-1 (Prometheus text), Q-2 (internal-only on 8080, no public/ALB route) and Q-3 (dev overlay + ping/pong RTT at 1 Hz) are genuine material choices with safe recommended defaults; Q-4..Q-8 are correctly builder defaults. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) — AC-2 top-level email redaction | ✅ fixed | `spec.md:41` now lists top-level `email`/`password`/`pass`/`token`/`sessionToken`/`verificationToken`/`cookie`/`authorization` plus the request/wildcard paths; `tasks.md:22` repeats them; the test input includes top-level and nested values. |
| F2 (r1) — AC-18 forbids `le` | ✅ fixed | `spec.md:49` (AC-7) and `spec.md:63` (AC-18) treat `le` as a renderer-reserved histogram label exempt from catalog allow-lists; `tasks.md:22` and `plan.md:81` repeat it. |
| F3 (r1) — smoke `servers_active >= 1` after settle | ✅ fixed | `spec.md:51` adds a dedicated `checkMetrics` client that joins, stays joined for the scrape, asserts `connections_open >= 1` and `servers_active >= 1`, then closes/settles; `tasks.md:59` assigns the check to T5. |
| F4 (r1) — `app.log` direct sink drops fields | ✅ fixed | `spec.md:42`/`plan.md:16`/`plan.md:85-94` define event-first `LogSink` with `createLogSink(logger)` calling Pino `logger.info(fields, event)`; `tasks.md:22` and `:31` forbid passing `app.log` directly. |
| F5 (r1) — T3/T4 falsely parallel | ✅ fixed | `tasks.md:3` declares all tasks `[seq]`; T3 → T4 → T5; smoke and `frontend-prod` build are T5-owned (`tasks.md:53-59`). F1 (r2) is the stale status-board mirror only. |
| F6 (r1) — AC-21 vs adapter stats shape | ✅ fixed | `spec.md:69`/`plan.md:158-163`/`tasks.md:49` use adapter `{calls, triangles}` and session mapping `calls` → `PerfStats.drawCalls`. |
| F7 (r1) — AC-22 RTT flag gate | ✅ fixed | `spec.md:67` (AC-19) asserts the App-level no-call/no-ping behavior; `spec.md:70` (AC-22) makes `measureRtt` flag-agnostic; `tasks.md:49` repeats it. |
| F8 (r1) — escaped-label test seam | ✅ fixed | `spec.md:48` (AC-6) and `plan.md:75` export `escapeLabelValue`; `tasks.md:22` tests `a"b\c` directly without a 31st metric. |
| F9 (r1) — AC-11 broadcast window | ✅ fixed | `spec.md:56` records the post-join baseline and asserts removal deltas; `tasks.md:31` repeats the baseline/delta. |
| F10 (r1) — AC-13 post-close gauges | ✅ fixed | `spec.md:57-58` scopes AC-12 registry equality to while open and defines AC-13 as a metrics-only reset; `tasks.md:31` says not to assert registry equality after close. |
| F11 (r1) — log volume/cost risk | ✅ fixed | `spec.md:185` and `plan.md:245` add the bounded-volume risk and the future level/health-suppression follow-up. |
| F12 (r1) — `LOG_LEVEL`/`METRICS_ENABLED` compose | ✅ fixed | `spec.md:50`/`spec.md:76`/`plan.md:261`/`tasks.md:13` define the three safe pass-throughs and the local commands; AC-8/AC-25/AC-26 agree. |
| F13 (r1) — stale `frontend-prod` smoke | ✅ fixed in intent | `spec.md:77`/`plan.md:263`/`tasks.md:55` add the `podman compose ... build frontend-prod` step and the entry-hash record; F2 (r2) fixes the hash command itself. |
| F14 (r1) — `instrumentPool` typing | ✅ fixed | `plan.md:127-132` uses `Queryable`, `apply(pool, args)` and a symbol guard; `tasks.md:40` repeats it. |
| F15 (r1) — T3/T4 sizing | ✅ noted | `tasks.md:13` records the cohesive-but-large 5-task shape and the orchestrator-approval rule for any split. |

## Minimum remaining revisions

None. The two open findings are MINOR bookkeeping/verification items (status board and hash grep), not spec/plan/tasks gate failures.

## Checkpoint items for the `awaiting_approval` summary

1. **Q-1 — Metrics format.** Recommended **Prometheus text** (`text/plain; version=0.0.4`) with the fixed 30-metric catalog; alternatives are JSON or both.
2. **Q-2 — Exposure.** Recommended **internal-only on the existing backend port 8080**, no ALB/Terraform route and no public access; `METRICS_ENABLED` defaults to `true` and can remove the route; public scraping is a future user-owned infrastructure decision.
3. **Q-3 — Frontend overlay and WS RTT.** Recommended **include the dev-only overlay** behind `VITE_PERF_OVERLAY=true`, with RTT measured by additive `ping`/`pong` diagnostic frames limited to 1/s per connection; alternatives are overlay without RTT or no overlay.

Q-4 (per-process metric retention), Q-5 (stdout/`awslogs` + 30-day retention), Q-6 (HTTP limiter drops), Q-7 (`{type, code?}` errors) and Q-8 (`docs/architecture/observability.md` + README `## Operations`) remain builder defaults. The orchestrator should present Q-1..Q-3 in `awaiting_approval` and record the user's confirmation in `status.md` before T1.

## Notes / backlog (non-blocking)

- **F1 status sync:** the status task board is the only place that still says T3/T4 `[P]` and T3 smoke; update it to the sequential T5-smoke shape before building so the orchestrator cannot launch the old parallel batch.
- **F2 hash command:** the bundle report is pretty-printed; the T5 hash grep needs the space (or a filename-only pattern) and a non-empty assertion. The T5 build log should show `assets/index-*.js` from the current build.
- **The protected design constraints hold:** `/metrics` is not publicly routed by default, the metrics labels are allow-listed (plus the reserved `le`), the overlay is default false and production-built without the flag, and no secret/PII path was reintroduced.
- **The three compose entries are exactly the agreed set:** `LOG_LEVEL` (default `debug`), `METRICS_ENABLED` (default `true`) and `VITE_PERF_OVERLAY` (default `false`); no service, port, image or Dockerfile change.
- No spec, plan, tasks, status, source, config, compose, Terraform or git state was edited by this review; only this review artifact was written.
