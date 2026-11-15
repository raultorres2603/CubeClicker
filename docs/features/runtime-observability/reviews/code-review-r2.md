---
feature: runtime-observability
phase: code_review
round: 2
iteration: 2
verdict: approved
reviewed: 2026-11-15
blocking: 0
nonblocking: 1
---
# Code Review — r2

## Summary

✅ approved — 0 blocking (0 BLOCKER, 0 MAJOR), 1 MINOR. The r1 exposure blocker is fully resolved: `METRICS_ENABLED = "false"` is committed in `fly.config.toml` `[env]` and explicitly staged by the deploy workflow; the CORS hook excludes `/metrics` from every grant on GET and OPTIONS; the disabled route is a plain 404; the local compose default remains `true` on loopback; and the temporary internal enablement/unset procedure is documented. The docs, spec (r3), plan (r3) and tasks now describe the Fly single-public-host model and keep the AWS ALB/CloudWatch text historical only. The F4/F7 comments/tests are fixed; the 30-metric catalog and local `/metrics` behavior are unchanged. The independent gates pass (lint, typecheck, backend 1143 tests, coverage, build) and the pinned greps pass. The only open item is the stale orchestrator-owned status summary/date and the absent feature-index row (F1/F4 acceptance bookkeeping).

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | Logger level table and production/disabled app assertions. |
| AC-2 | ✅ | Top-level/nested redaction paths; captured-stream tests; no request bodies. |
| AC-3 | ✅ | Event-first `LogSink` adapter; `req.id` correlation; hub/app lifecycle tests. |
| AC-4 | ✅ | `err` serializer emits `{type, code?}` only; tests. |
| AC-5 | ✅ | Login + `/auth/me` + WS flow has exact no-PII assertions. |
| AC-6 | ✅ | Exact Prometheus render/escape tests; local `/metrics` 200 with exact content type and `cache-control: no-store`. |
| AC-7 | ✅ | 30-metric catalog, allow-listed labels, reserved `le`, rejection tests. |
| AC-8 | ✅ | `fly.config.toml` has `METRICS_ENABLED = "false"`; `deploy.yml` stages `METRICS_ENABLED=false`; `get /metrics` with `METRICS_ENABLED=false` is 404; CORS tests prove no allow-origin/credentials on GET and no grant/204 on OPTIONS; local compose keeps `true` on loopback; temporary enablement via Fly secret + `fly proxy`/`fly ssh` then unset is documented. |
| AC-9 | ✅ | T5 `npm run smoke` passed 22/22 including the joined-state metrics check; the fix does not change the smoke path (no Origin), and the local `/metrics` probe still returns 200. |
| AC-10 | ✅ | Hub attach/close/capacity/heartbeat tests. |
| AC-11 | ✅ | Encode-once/fan-out baseline/delta, join/explode counters, invalid/oversized. |
| AC-12 | ✅ | Registry-equality gauges while open; move/leave/destroy. |
| AC-13 | ✅ | Pending/flush/id/group and economy cadence; post-close reset. |
| AC-14 | ✅ | Explode/rotate/http drops; no key label/log. |
| AC-15 | ✅ | Stale economy/upgrade rejections; closed-only not counted. |
| AC-16 | ✅ | Dedicated pool wrapper tests; pool gauges; no SQL/params. |
| AC-17 | ✅ | One-shot signal handler; close-once; failure exit 1. |
| AC-18 | ✅ | Metrics scrape has no PII; bounded labels; `le` exempt only. |
| AC-19 | ✅ | Strict flag; App false → no overlay/calls/ping. |
| AC-20 | ✅ | Exact overlay labels, 250/1000 ms polls, placeholders, cleanup. |
| AC-21 | ✅ | Adapter `{calls,triangles}` → `drawCalls`; tier/dispose. |
| AC-22 | ✅ | RTT match/timeout/disconnect/status-change/dispose; App-level no-ping. |
| AC-23 | ✅ | Ping/pong mirrors, exact frame, 1 Hz drop. |
| AC-24 | ✅ | Flag unset → no overlay; production build within budget; compose default false; README command. |
| AC-25 | ✅ | Five required sections; 30-metric catalog; Fly public-host model; deployed false; local true on loopback; CORS exclusion; temporary enablement; ALB/CloudWatch historical; 7/7 links. |
| AC-26 | ✅ | Independent lint/typecheck 0; backend 35 files/1143 tests; frontend 72 files/1902; coverage backend 95.89/89.07/99.54/95.89 and frontend 96.54/96.21/97.74/96.54; build 0; pinned greps pass; no unchanged-path diff. The T6 fix did not re-run the containerized smoke, but the T5 22/22 smoke remains valid (the fix is CORS/environment-only and the local metrics probe is still 200 with no ACAO; integration tests cover the disabled/CORS paths). |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `docs/features/runtime-observability/status.md:4-8`, `:13`, `:32-38` | The status summary still says the endpoint is "internal-only ... (not ALB-routed)" and "no public exposure is added"; the frontmatter still says `updated: 2026-11-13` while the loop log carries 2026-11-15. The status is orchestrator-owned and the T6 log correctly leaves it staged; the content is now stale relative to the Fly model. | At acceptance, update the status summary/date to the Fly exposed-default-false model and set `state: accepted`; do not edit it as part of the code fix. | open |
| F2 | INFO | `docs/features/runtime-observability/build-log-T5.md:21-22`, `:525` | The historical T5 build log still contains the old "not routed by the public edge"/"not a change to the approved exposure decision" text. The live docs/spec/plan were corrected in T6; the T5 log is a historical record. | None; T6 log is the current evidence. Do not rewrite the historical log. | open |
| F3 | INFO | `build-log-T6.md:221` | The T6 fix did not re-run the containerized smoke; the log explains that the change is CORS/environment-only and the integration tests cover it. The T5 22/22 run and the current local `/metrics` 200/no-ACAO probe support the no-regression claim. | Optional: re-run `npm run smoke` once at acceptance for the final tree; not required by the fix's scope. | open |
| F4 | INFO | `docs/features/README.md` (no runtime row), `build-log-T5.md:508` | The runtime-observability row is absent from the feature index; the T5 proposal still says `planning`. | Orchestrator adds the `accepted` row at acceptance. | open |
| F5 | INFO | `build-log-T6.md`/current gates | Coverage and build are green; the 30-metric catalog is unchanged; the T6 tests add only CORS/exposure assertions. | None. | open |
| F6 | INFO | `docs/architecture/observability.md` | The docs now state the Fly public host, deployed false, local true, CORS exclusion, temporary enablement and historical AWS; 7/7 links resolve. | None. | open |
| F7 | INFO | Local probe | `GET http://localhost:8080/metrics` returns 200 with the exact Prometheus content type and `access-control-allow-origin: null`; the local route remains accessible through loopback. | None. | open |
| F8 | INFO | Commit scope | `04a0e69` touches only the runtime observability code/tests/config/docs/status; no other-feature artifact is staged; no new source/deployment surface beyond the intended `fly.config.toml`/deploy value. | None. | open |

## Verification performed

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0.
- `npm test` → exit 0: backend 35 files / 1143 tests; frontend 72 files / 1902 tests.
- `npm run coverage` → exit 0: backend 95.89 statements / 89.07 branches / 99.54 functions / 95.89 lines; frontend 96.54 / 96.21 / 97.74 / 96.54; all ≥ 80.
- `npm run build` → exit 0; bundle budget OK (entry `index-Bu2ZFvtA.js` raw 90,584 B / gzip 28,356 B).
- Pinned greps: `METRICS_ENABLED = "false"` in `fly.config.toml`; `METRICS_ENABLED=false` in `deploy.yml`; `METRICS_ENABLED: "${METRICS_ENABLED:-true}"` in `compose.yaml`; no `not routed by the ALB` or `not routed by the public edge` in the live docs/README; `Fly` and `CORS` present in `observability.md`; `METRICS_ENABLED=false` present in `observability.md`; the five headings present; unchanged-path diff empty.
- Local `GET http://localhost:8080/metrics` → 200, exact Prometheus content type, `access-control-allow-origin: null`.
- CORS tests: `/metrics` GET 200 with no ACAO/credentials; query-string path still excluded; OPTIONS 404 with no grant/204; disabled `/metrics` 404 with no grant.
- Scope: `04a0e69` is limited to `fly.config.toml`, `deploy.yml`, `cors.ts`/tests, `app.ts`/tests, `metrics-route.ts`, README/deployment/observability, spec/plan/tasks/status, T6 log and the r1 review; no other-feature paths staged.
- The T6 fix did not re-run `npm run smoke`; the T5 22/22 run and the local probe/integration tests are the available evidence, and the change is CORS/environment-only (F3).

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Spec compliance | ✅ | AC-8/AC-25 now met on Fly; AC-1–7/9–24/26 pass. |
| Security | ✅ | Deployed `/metrics` is 404 by default; CORS grants nothing on GET/OPTIONS; no PII/secrets; local loopback remains accessible. |
| Testing | ✅ | 1143 backend tests, 1902 frontend tests, coverage ≥ 80, build green; CORS/exposure integration tests added. |
| DB behavior | ✅ | Unchanged; pool wrapper tests still green. |
| Documentation | ✅ | Fly model, deployed false, CORS exclusion, temporary enablement and historical AWS are documented; links resolve. |
| Real-time | ✅ | Ping/pong and overlay unchanged; no shared-state/authority change. |
| Containers | ✅ | Only the intended `fly.config.toml`/deploy env value; compose local default unchanged; no new service/port/image. |
| Coverage | ✅ | Both workspaces pass all four thresholds; no exclusions/threshold changes. |
| Out-of-scope edits | ✅ | Fix commit is scoped; no other-feature artifacts staged. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 r1 — public `/metrics` on Fly | ✅ fixed | Fly `METRICS_ENABLED = "false"`; deploy `METRICS_ENABLED=false`; disabled 404 test; local compose true; CORS no grant. |
| F2 r1 — false docs/route comments | ✅ fixed | `observability.md`, `deployment.md`, README, `metrics-route.ts` and `app.ts` updated; old ALB/public-edge claims gone from live docs. |
| F3 r1 — stale spec/plan ALB model | ✅ fixed | Spec r3 and plan r3 describe Fly public host, deployed false, CORS exclusion, historical AWS; tasks T3/T5 updated. |
| F4 r1 — stale ALB comments | ✅ fixed | `metrics-route.ts` and `app.ts` comments now describe Fly/default-off/CORS. |
| F5 r1 — status date | ⚠️ open MINOR | Status summary/date still old; acceptance action. |
| F6 r1 — index row | ✅ accepted as INFO | `docs/features/README.md` runtime row absent; orchestrator adds accepted row. |
| F7 r1 — CORS grant | ✅ fixed | CORS hook excludes `/metrics`; GET/OPTIONS tests and local probe show no grant. |
| F8–F10 r1 | ✅ unchanged | Local probe 200; coverage green; no PII in metrics/logs. |

## Minimum remaining revisions

None blocking. The only open finding is the non-blocking status/index bookkeeping (F1/F4).

## Notes / acceptance

- **Ready for acceptance after bookkeeping:** set `docs/features/runtime-observability/status.md` to `accepted` and update its summary/date to the Fly default-false model; add the `runtime-observability` row to `docs/features/README.md` (the T5 proposal's `planning` must become `accepted`); commit this review artifact. No post-acceptance source/config/doc content changes.
- **Optional final smoke:** re-running `npm run smoke` once on the final tree would close F3's evidence gap; the local `/metrics` 200/no-ACAO probe and the CORS integration tests already cover the fix's behavior.
- **No additional user gate:** Q-1/Q-2/Q-3 were approved; the deployed default false matches the approved internal-only intent on the Fly target. The temporary-enablement window is documented as audited and user-controlled.
- **Security boundary is now explicit:** Fly has no path filter, the deployed default is false, the frontend origin gets no CORS grant, and the docs do not claim an ALB/edge route as current protection.
- No source, test, docs, compose, or git state was edited by this review; only the review artifact was written.
