---
feature: runtime-observability
state: code_review
spec_review_round: 2
build_round: 2
created: 2026-11-13
updated: 2026-11-13
---
# Status — Runtime Observability

## Summary

Next feature of the approved audit queue: the backend has no structured logging, metrics endpoint or counters, so production connection counts, room occupancy, message rates, rate-limit drops, heartbeat terminations, DB latency and the post-batching removal/economy flush depth are invisible. This feature adds Fastify/Pino JSON logs with redaction and request correlation, a fixed 30-metric Prometheus catalog, an internal-only `GET /metrics` on the existing backend port 8080 (not ALB-routed), DB pool/query instrumentation, graceful-shutdown metrics, and a dev-only frontend overlay behind `VITE_PERF_OVERLAY`. No new service, image, port, dependency, backend stack or public exposure is added. Raw request: "Please, find any kind of performance optimizations we can do on project and, also, find new skills we added and provide some new features you think are good to have" followed by "Proceed with all of them, one by one".

## Task board

- [x] T1 — Observability core: metrics registry, config, logging/redaction `[seq]`
- [x] T2 — Hub instrumentation and diagnostic ping/pong `[seq]`
- [x] T3 — Backend wiring, `/metrics`, DB metrics, shutdown `[seq]`
- [x] T4 — Frontend dev overlay, session stats and WS RTT `[seq]`
- [x] T5 — Documentation and final verification `[seq]`

## Loop log

- 2026-11-13 — created → PLANNING — planner artifacts r1 written (`spec.md`, `plan.md`, `tasks.md`); audit evidence: `app.ts:193` no logger, no metrics endpoint, `hub.ts` lifecycle/rate-limit/revision paths, `broadcast.ts` pending-depth accessors, `db/pool.ts` uninstrumented; raw request quoted above.
- 2026-11-13 — planning → spec_review — review round 1 pending — `spec.md` r1
- 2026-11-13 — spec review r1 → changes_requested (5 blockers, 3 major); planner revision r2 pending — `reviews/spec-review-r1.md`
- 2026-11-13 — planner revision r2 applied — redaction/le/log sink/sequential T3-T4/escape-label fixes; T5 smoke ownership; → SPEC_REVIEW round 2 — `spec.md` r2
- 2026-11-13 — spec_review → awaiting_approval — r2 approved (0 blockers); Q-1/Q-2/Q-3 checkpoint pending — `reviews/spec-review-r2.md`
- 2026-11-13 — awaiting_approval → building — user approved defaults: Prometheus text, internal-only /metrics, dev-only overlay/RTT — user message
- 2026-11-13 — building T1 started — observability core (metrics registry, config, logging/redaction) — `tasks.md` T1
- 2026-11-13 — building T1 completed — 30-metric registry, config, LogSink/redaction; commit `b5d5869`; backend 1041 tests, coverage 95.1/87.84/99.5/95.1 — `build-log-T1.md`
- 2026-11-13 — building T2 completed — hub instrumentation + ping/pong; commit `c0796f3`; backend 1061 tests, coverage 95.13/88.21/99.51/95.13 — `build-log-T2.md`
- 2026-11-13 — building → blocked — paused for `vercel-deployment` migration; T1/T2 committed, T3-T5 pending — user directive
- 2026-11-15 — blocked → building — resumed T3 (backend wiring, `/metrics`, DB metrics, shutdown) — user directive "proceed with all remaining states"
- 2026-11-15 — building T3 completed — internal `/metrics`, DB metrics, shutdown; commit `ccd149a`; backend 1137 tests, coverage 95.88/89.03/99.54/95.88; container `/healthz` + `/metrics` + pg metrics green — `build-log-T3.md`
- 2026-11-15 — building T4 completed — dev-only perf overlay + session stats/RTT; commit `7299289`; frontend 1902 tests, coverage 96.54/96.21/97.74/96.54 — `build-log-T4.md`
- 2026-11-15 — building T5 completed — docs + compose pass-throughs + smoke metrics; commit `d7f9bfe`; full suite 3,039 tests; coverage backend 95.88/89.03/99.54/95.88, frontend 96.54/96.21/97.74/96.54; smoke 22/22 — `build-log-T5.md`
- 2026-11-15 — building → code_review — all T1-T5 verified; acceptance body pending — `build-log-T5.md`
- 2026-11-15 — code review r1 → changes_requested (1 blocker: /metrics public on Fly; 2 major: docs/spec ALB claims); targeted spec correction + implementation fix pending — `reviews/code-review-r1.md`

## Blockers / open questions

- Q-1 — metrics format: approved Prometheus text.
- Q-2 — exposure: approved internal-only `/metrics` on 8080; no ALB/Terraform route.
- Q-3 — frontend overlay + ping/pong RTT: approved `VITE_PERF_OVERLAY=true`, 1 Hz ping limit.
- Q-4 — metric retention: per-process only, reset on restart; builder default.
- Q-5 — log retention/access: reuse stdout + existing `awslogs` 30-day CloudWatch retention; builder default.
- Q-6 — HTTP limiter drops: include via optional `onDenied` callback; builder default.
- Q-7 — error details: `{type, code?}` only, never message/stack; builder default.
- Q-8 — docs home: new `docs/architecture/observability.md` + README `## Operations`; builder default.
- T1/T2 committed; T3-T5 resumed 2026-11-15.
