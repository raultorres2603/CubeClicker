---
feature: runtime-observability
phase: code_review
round: 1
iteration: 1
verdict: changes_requested
reviewed: 2026-11-15
blocking: 3
nonblocking: 2
---
# Code Review — r1

## Summary

❌ changes requested — 1 BLOCKER, 2 MAJOR, 2 MINOR, 5 INFO. The implementation is otherwise strong: Pino logging/redaction and the event-first `LogSink` are correct; the 30-metric catalog, reserved `le`, exact Prometheus rendering, DB wrapper and shutdown tests are in place; the dev-only overlay is flag-gated and the production build is clean; the local `/metrics` probe returns the exact Prometheus content type; and the independent gates pass (lint, typecheck, tests, coverage, build, smoke 22/22). However, the feature was approved against the old ALB target and resumed after the Vercel + Fly.io migration: the Fly app exposes every path on one public host, `METRICS_ENABLED` still defaults to `true`, the Fly config/deploy workflow never set it false, and the CORS hook grants the frontend origin access to `/metrics`. The endpoint is therefore publicly reachable by default, contradicting AC-8's internal-only rule. The docs and spec/plan still claim "no public route"/"not routed by the ALB", which is false on Fly.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `logging.test.ts` level table and `app.test.ts` production/disabled logger assertions. |
| AC-2 | ✅ | `redact.paths` covers top-level and nested paths; captured-stream tests prove the `[REDACTED]` values; no request bodies are logged. |
| AC-3 | ✅ | `createLogSink` calls Pino object-first; `req.id` becomes `connectionId`; hub/app tests cover open/close/heartbeat/rejection and field names. |
| AC-4 | ✅ | `serializeError` emits `{ type, code? }` only; tests assert no message/stack/email. |
| AC-5 | ✅ | `app.test.ts` login + `/auth/me` + WS flow has exact `not.toContain` assertions for email, password, username, token, player/account/server ids and remote IP. |
| AC-6 | ✅ | Registry render tests, `escapeLabelValue`, and the local `GET /metrics` probe: 200, `text/plain; version=0.0.4; charset=utf-8`, `cache-control: no-store`. |
| AC-7 | ✅ | 30-metric catalog; allow-listed labels only; `le` renderer-reserved; unknown/undeclared/missing/bad values throw; no forbidden label names. |
| AC-8 | ❌ | **Public on Fly.** `METRICS_ENABLED` defaults `true` (`observability/config.ts:88`); `fly.config.toml` has no `METRICS_ENABLED=false`, the deploy workflow/env catalog does not set it, and Fly serves the app on one public host with no path filter. The route is unauthenticated and the CORS hook grants the configured frontend origin. The local compose loopback is fine, but the deployed default violates "internal-only". |
| AC-9 | ✅ | `npm run smoke` reproduced: 22/22, including the joined-state metrics check (`connections_open=1`, `servers_active=1`, cumulative frame/join counters). |
| AC-10 | ✅ | Hub metrics-injected tests cover attach/close/capacity/heartbeat and the duration histogram. |
| AC-11 | ✅ | Baseline/delta test exact: one removal encode, two frame deliveries, fan-out count/sum, join/explode counters, invalid/oversized. |
| AC-12 | ✅ | Gauge/registry equality while open; move/leave/destroy steps covered. |
| AC-13 | ✅ | Pending/flush/id/group and economy cadence metrics covered; post-close gauges reset per AC-13. |
| AC-14 | ✅ | Explode/rotate/http limiter drops covered; no key label/log. |
| AC-15 | ✅ | Stale economy/upgrade revision rejections covered; closed-only rejections not counted. |
| AC-16 | ✅ | `instrumentPool` resolve/reject/sync-throw tests, exact 12 ms observation; pool gauges/zero null pool; no SQL/params. |
| AC-17 | ✅ | One-shot signal handler, close-once, double-signal ignored, failure exit 1 tests. |
| AC-18 | ✅ | Metrics scrape parser checks PII absence and allow-listed label values, exempting only `le`. |
| AC-19 | ✅ | Strict flag parser; App false → no overlay, no `measureRtt`/`getPerfStats` calls/ping. |
| AC-20 | ✅ | Exact overlay labels, 250 ms/1000 ms polls, placeholders and cleanup tests. |
| AC-21 | ✅ | Adapter `{calls,triangles}` → `PerfStats.drawCalls`; tier/dispose tests. |
| AC-22 | ✅ | RTT send/match/timeout/disconnect/status-change/dispose tests; flag-agnostic; App gate covers no-ping. |
| AC-23 | ✅ | Backend/frontend ping/pong parse/build/reject, exact frame, hub 1 Hz drop. |
| AC-24 | ✅ | Flag unset → no overlay; production build within budget; compose pass-through default false; README exact command. |
| AC-25 | ❌/partial | The five sections, 30 metrics, reserved `le`, overlay, per-process reset and 7 relative links are present. But the exposure claims are false on the current target: `observability.md:87` says the current Vercel + Fly layout "adds no public route"; `deployment.md:21` says the layout "adds no ... Fly route for it"; `README.md:109` says "internal-only ... no public route is added". The docs' caveat that the Fly host is the network boundary does not make the default true route internal-only. |
| AC-26 | ✅ | Independent gates: lint 0; typecheck 0; backend 35 files/1137 tests; frontend 72 files/1902; coverage backend 95.88/89.03/99.54/95.88 and frontend 96.54/96.21/97.74/96.54; build 0; smoke 22/22. `compose.yaml` has exactly the three pass-throughs; no Dockerfile/package/CI/Terraform diff. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | BLOCKER | `src/backend/src/observability/config.ts:88`; `fly.config.toml:7-11`; `.github/workflows/deploy.yml`; `compose.yaml:52`; `src/backend/src/app.ts:329-337`; `src/backend/src/cors.ts` | The deployed backend is now one public Fly host, and the app serves every path on it. `METRICS_ENABLED` defaults to `true`; the Fly config `[env]` and the deploy workflow/environment catalog never set it false, and Fly has no path filter. The unauthenticated `/metrics` route is therefore reachable at the public API host by default, and the CORS hook grants the configured frontend origin (`access-control-allow-origin` plus credentials), so a browser on the Vercel app can read it too. This contradicts AC-8's internal-only requirement and the user-approved Q-2 exposure decision. | Make the deployed default non-public: set `METRICS_ENABLED=false` in the Fly environment for both environments (Fly secret/env or `[env]`) and document how to enable it only for an internal scrape (temporary secret, `fly ssh`/internal tooling, or a separate protected path). Keep the local compose default true on loopback. Exclude `/metrics` from the CORS grant or add an internal-only guard when enabled. Update the env catalog/workflow so the value is explicit. | open |
| F2 | MAJOR | `docs/architecture/observability.md:87`; `docs/architecture/deployment.md:21`; `README.md:109`; `src/backend/src/observability/metrics-route.ts:5-8`; `src/backend/src/app.ts:329`; `build-log-T5.md:21-22`, `:525` | The docs and source comments claim the current Vercel + Fly layout has "no public route"/"not routed by the public edge" and that `/metrics` is internal-only. Fly serves the whole app on one public host, so those claims are false. The T5 log's "internal-only is a network-boundary rule" caveat is honest, but it also says this is "not a change to the approved exposure decision", which is wrong: the ALB boundary no longer exists. | Rewrite the exposure sections to state the actual boundary: the Fly host is public; `/metrics` is disabled by default in deployed environments; enabling it requires an explicit internal mechanism; the historical ALB/CloudWatch notes are historical only. Update the `metrics-route.ts`/`app.ts` comments and the T5 log/acceptance evidence. | open |
| F3 | MAJOR | `spec.md:23`, `:50` (AC-8), `:76` (AC-25); `plan.md` (ALB exposure/evidence); `tasks.md` (T3 smoke/AC-8) | The approved spec/plan predate the Vercel + Fly.io migration. They still define internal-only exposure via the ALB routing table and use ALB/Terraform evidence; the current deployment has no ALB and serves `/metrics` publicly. The spec's AC-8/AC-25 acceptance claims are no longer valid on the shipped target. | Revise the spec/plan/tasks to the current target (Fly public host, `METRICS_ENABLED=false` deployed default, an internal enablement mechanism, updated evidence and docs), or record an explicit spec-revision/waiver that re-targets AC-8/AC-25. The code review cannot approve against a stale exposure contract. | open |
| F4 | MINOR | `src/backend/src/observability/metrics-route.ts:5-8`; `src/backend/src/app.ts:329-330` | The route/app comments still say the ALB does not route `/metrics`, which is stale after the Fly migration and contradicts the actual public host. | Update the comments to the Fly target and the deployed default false; no behavior change. | open |
| F5 | MINOR | `docs/features/runtime-observability/status.md:8`; `:13` | The status frontmatter still says `updated: 2026-11-13` although the feature resumed and completed T3–T5 on 2026-11-15; the status loop log shows the later dates. | Update the `updated` date at the acceptance transition. | open |
| F6 | INFO | `build-log-T5.md:508` | The proposed feature-index row says `planning`; the feature is at code review with the build complete. | Orchestrator applies `accepted` with the acceptance date; the runtime-observability row is currently absent from `docs/features/README.md`. | open |
| F7 | INFO | `src/backend/src/cors.ts:96-110` | The CORS hook grants the frontend origin on every path, including `/metrics`; if the endpoint is ever enabled on the public Fly host, a browser on the app origin can read it. | With F1's default false and/or an internal guard, exclude `/metrics` from the CORS grant; add a test. | open |
| F8 | INFO | Local `/metrics` probe | The local backend returned 200 with the exact Prometheus content type and catalog body; `npm run smoke` passed 22/22 including the joined-state metrics check. | Keep the local proof; it does not prove the Fly exposure control. | open |
| F9 | INFO | Coverage | Independent coverage matches the build logs (backend 95.88/89.03/99.54/95.88; frontend 96.54/96.21/97.74/96.54); no new exclusions or lowered thresholds. | None. | open |
| F10 | INFO | Metrics/log privacy | The catalog labels are allow-listed, errors are `{type, code?}`, logs strip bodies/headers/queries/IPs, and the captured tests find no PII. | None; the exposure blocker is about reachability, not content. | open |

## Verification performed

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0.
- `npm test` → exit 0: backend 35 files / 1137 tests; frontend 72 files / 1902 tests.
- `npm run coverage` → exit 0: backend 95.88 statements / 89.03 branches / 99.54 functions / 95.88 lines; frontend 96.54 / 96.21 / 97.74 / 96.54; all ≥ 80.
- `npm run build` → exit 0; bundle budget OK (host entry `index-Bu2ZFvtA.js` raw 90,584 B / gzip 28,356 B).
- Local `GET http://localhost:8080/metrics` → 200, `text/plain; version=0.0.4; charset=utf-8`, catalog body with the `cubeclicker_*` metrics.
- `npm run smoke` → exit 0, `SMOKE PASS (22/22 checks)`, including the joined-state metrics check (`connections_open=1`, `servers_active=1`, cumulative counters).
- `docs/architecture/observability.md` → exactly the five required `##` headings; 7/7 relative links resolve; the 30-metric catalog cross-check is in the T5 log.
- `README.md` → `## Operations`, `podman compose logs backend`, `curl http://localhost:8080/metrics`, and the three configuration rows; the compose pass-throughs are present.
- **Live Fly probe: not run** — no Fly app was available in this environment; the public exposure is proven by the static Fly/deploy config and the default-true `METRICS_ENABLED` (Fly serves every app path, no path filter). This is not treated as a passed live check.
- Scope: the runtime T5 commit touches only README, compose, deployment, observability, the T5 log, status and smoke; the T1–T4 commits are the observability core/hub/back-end/frontend overlay; no new dependency or Dockerfile/CI/Terraform change in the runtime feature.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Spec compliance | ❌ | AC-8 is unmet on the shipped Fly target; AC-25's exposure claims are false; AC-1–AC-7/9–24/26 pass. |
| Security | ❌ | PII/log/metrics content is clean, but the unauthenticated `/metrics` route is publicly reachable by default on Fly and CORS-readable from the frontend origin. |
| Testing | ✅ | All unit/integration/smoke tests pass; coverage ≥ 80; the smoke check is joined-state and exact. |
| DB behavior | ✅ | The pool wrapper preserves result/error/this; metrics only; no SQL text/params; no DB call-site change. |
| Documentation | ❌ | The observability/deployment/README exposure statements contradict the Fly deployment; the spec/plan still use ALB evidence. |
| Real-time | ✅ | Ping/pong is connection-local, 1 Hz-bounded and does not alter game state; overlay is dev-only. |
| Containers | ✅ | Local compose unchanged except the three pass-throughs; no new service/port/image; the Fly exposure cannot be fixed by a container change alone. |
| Coverage | ✅ | Both workspaces pass all four thresholds; no exclusion/threshold changes. |
| Out-of-scope edits | ✅ | The runtime commits are scoped to observability/hub/protocol/overlay/docs/smoke; no source or deployment change beyond the spec. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| Spec review r2 F1 (redaction) | ✅ fixed | Top-level + nested paths and captured-stream tests pass. |
| Spec review r2 F2 (`le` label) | ✅ fixed | `le` is renderer-reserved; AC-18 parser exempts it. |
| Spec review r2 F3 (smoke joined state) | ✅ fixed | Smoke 22/22 with the joined metrics check. |
| Spec review r2 F4 (`LogSink` Pino order) | ✅ fixed | `createLogSink` object-first adapter; tests pass. |
| Spec review r2 F5 (scoped clean/reviews) | ✅ fixed | Feature artifacts/build logs/tests are committed; the T5 log records the evidence. |
| Spec review r2 F6–F8 | ✅ fixed | Optional WS, dev SMTP, Fly region/trailing slash and Vercel cwd are in the predecessor feature. |
| F5 r1 status date | ⚠️ open MINOR | `status.md` `updated` still 2026-11-13; acceptance action. |

## Minimum fixes (blocking)

1. **F1** — Set `METRICS_ENABLED=false` in the deployed Fly environment (both environments) and make the enablement path explicitly internal; exclude `/metrics` from the CORS grant (or add an internal guard) when enabled. Keep local compose true on loopback.
2. **F2** — Correct the exposure claims in `observability.md`, `deployment.md`, `README.md`, the route/app comments and the T5 log; state the Fly host is public and `/metrics` is disabled by default, with the historical ALB/CloudWatch notes clearly historical.
3. **F3** — Re-target AC-8/AC-25 and the plan/tasks evidence from the ALB to Fly/Neon, or record an explicit spec revision/waiver for the new exposure contract.

## Notes / acceptance

- **Local proof is green:** the `/metrics` probe and 22/22 smoke show the feature works locally; the blocker is deployed reachability on Fly.
- **No PII/secrets found:** the blocker is network exposure, not metric or log content; the tests and catalog are clean.
- **Acceptance actions if the fixes land:** set `docs/features/runtime-observability/status.md` to `accepted` with an updated date, add the `runtime-observability` row to `docs/features/README.md` (the T5 proposal says `planning`), and commit the review artifact. No post-acceptance content edits.
- **No additional user gate for the original Q-1..Q-3 decisions:** they were already approved; the Fly exposure is a new deployment-target consequence that must be resolved before acceptance, not a re-litigation of the format/cadence choices.
- No source, test, docs, compose, or git state was edited by this review; only the review artifact was written.
