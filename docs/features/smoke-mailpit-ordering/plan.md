---
feature: smoke-mailpit-ordering
revision: 1
---

# Plan — Smoke Test Mailpit Ordering Fix

## Architecture

Two-file change. `compose.smoke.yaml` gains `mailpit` in the `smoke` service's `depends_on` (long form, `condition: service_started`), so Compose starts Mailpit as part of the one-shot closure. `tests/e2e/smoke.mjs` polls Mailpit HTTP readiness before `POST /auth/register`, so a slow start cannot turn into a false 500. No backend/frontend/Dockerfile/CI changes; no new services, images, or ports. `compose.yaml` is unchanged (Mailpit is already defined there; no healthcheck is added — see OQ-1).

## Interfaces / contracts

- Compose (merged): `smoke.depends_on` = `{ backend: service_started, frontend: service_started, mailpit: service_started }`.
- Smoke script: `checkAuthFlow()` polls `MAILPIT_URL + '/'` via the existing `pollUntilReady` helper before issuing registration; on failure sets `registerProblem` and skips verify/login (existing control flow), so the guest check still runs.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `compose.smoke.yaml` | Edit | Add `mailpit` to `smoke.depends_on` (service_started). |
| `tests/e2e/smoke.mjs` | Edit | Poll Mailpit readiness before auth registration. |
| `docs/features/smoke-mailpit-ordering/build-log-final-verification.md` | New (T3) | Recorded verification evidence. |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Use `condition: service_started` for Mailpit instead of `service_healthy`. | The `axllent/mailpit` image is minimal (no shell/wget), so an in-image healthcheck is not reliably available; `service_started` plus script-level readiness poll avoids depending on image internals and cannot mark the service unhealthy. | (a) Add a healthcheck + `service_healthy` — rejected due to image uncertainty (OQ-1); (b) restructure compose.smoke.yaml — unnecessary; (c) make the smoke script wait — adopted as the complementary half. |
| D-2 | Retain CI's Mailpit pre-start step. | Idempotent belt-and-braces; removing it is out of scope and risks the pipeline contract. | Remove it — rejected (AC-3). |
| D-3 | Poll Mailpit HTTP readiness before registration rather than retrying registration. | Retrying registration with the same payload can collide on username if the first attempt partially succeeded; a readiness poll avoids duplicate users. | Retry registration — rejected. |

## Risks & mitigations

- Mailpit starts slower than assumed → mitigated by the readiness poll (AC-7) and the existing `waitForMailpitMessage` polling.
- Compose provider parity (`podman` vs `docker compose`) → same assumption as `aws-deploy-pipeline` F2 notes; validated by running `npm run smoke` (AC-1).
- Healthcheck absence means no hard readiness gate → mitigated by script-level polling; documented as OQ-1.

## Open questions

- OQ-1, OQ-2, OQ-3 (see spec.md).