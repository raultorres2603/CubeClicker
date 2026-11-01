---
feature: smoke-mailpit-ordering
revision: 1
status: draft
created: 2026-11-01
updated: 2026-11-01
---

# Spec — Smoke Test Mailpit Ordering Fix

## Summary

`npm run smoke` (i.e. `podman compose -f compose.yaml -f compose.smoke.yaml run --rm smoke`) is documented as a single command that runs the 12-check containerized smoke suite, but it exits non-zero (`SMOKE FAIL (9/12)`) on a clean host because the `smoke` service's `depends_on` closure does not include `mailpit`: Mailpit is never started by the one-shot run, so the backend's SMTP send during `POST /auth/register` fails and returns 500. The fix restores the one-command contract by ensuring Mailpit is started (and ready) before the smoke checks run, without manual pre-steps and without breaking the CI pipeline's existing Mailpit pre-start step. No application behavior changes; only compose/smoke configuration and the e2e smoke script.

## User stories

- As a developer, I want `npm run smoke` to pass 12/12 from a clean checkout with no manual pre-steps, so the documented one-command contract holds.
- As a CI consumer, I want the existing Mailpit pre-start step to remain valid (belt-and-braces) rather than be removed or invalidated by the fix.

## Acceptance criteria

- **AC-1** — Running `npm run smoke` on a host with no containers running and no prior `up -d mailpit` exits 0 and prints `SMOKE PASS (12/12 checks)`.
- **AC-2** — `compose.smoke.yaml` declares `mailpit` in the `smoke` service's `depends_on` (so Compose starts Mailpit as part of the one-shot run).
- **AC-3** — The CI pipeline's Mailpit pre-start step (`up -d mailpit` before `run --rm smoke`) still succeeds; the fix does not remove or invalidate it.
- **AC-4** — `podman compose -f compose.yaml -f compose.smoke.yaml config` exits 0 (valid merged Compose configuration).
- **AC-5** — No application source under `src/` is changed; `npm run lint`, `npm run typecheck`, `npm test`, and `npm run coverage` exit 0 (regression guard).
- **AC-6** — `tests/e2e/smoke.mjs` passes `node --check` (syntactically valid).
- **AC-7** — The smoke script waits for Mailpit readiness before attempting `POST /auth/register`, so a slow Mailpit start cannot produce a false 500.

## Non-goals

- Historical build-log verify-anchor false positives (artifact-only; no code).
- User-side AWS asset provisioning (operational; external to the repo).
- F22 podman-vs-Docker ARG nuance (already handled in `aws-deploy-pipeline`).
- No changes to application behavior, backend/frontend source, Dockerfiles, CI workflows, or the Mailpit image.
- No new dependencies.
- The CI Mailpit pre-start step is retained (not removed) as belt-and-braces.
- No change to the smoke check count or to the smoke command string.

## Boundaries

- ✅ Always: run `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`; validate merged Compose config; keep the change minimal and confined to `compose.smoke.yaml` and `tests/e2e/smoke.mjs`.
- ⚠️ Ask first: adding dependencies; editing CI workflows, Dockerfiles, or `compose.yaml`; changing the smoke check count.
- 🚫 Never: edit `.env*`; push; weaken tests (wildcard matchers, assertion-free tests); change application behavior beyond Mailpit ordering; remove the CI Mailpit pre-start step.

## Security considerations

- No user-controlled data, persistence, or secrets are introduced or altered.
- No new dependencies are added.
- Compose configuration changes are limited to service ordering; no new ports, images, or environment variables.

## Testing strategy

- Unit: none new — no TypeScript is touched.
- Integration: none new at the TS boundary.
- Containerized e2e: `npm run smoke` must print `SMOKE PASS (12/12 checks)` and exit 0 (AC-1). CI's Mailpit-primed run continues to pass (AC-3).
- Coverage: `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace (unchanged; regression guard, AC-5). No new TS, so no coverage delta expected.
- Verification commands: `podman compose -f compose.yaml -f compose.smoke.yaml config` (AC-4); `node --check tests/e2e/smoke.mjs` (AC-6); `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (AC-5); `npm run smoke` (AC-1).

## Open questions

- OQ-1 — The `axllent/mailpit` image is a minimal (scratch-based) image with no shell or `wget`, so no in-image healthcheck is added and `depends_on` uses `condition: service_started` rather than `service_healthy`. If a health-gated condition is desired later, it requires either a sidecar or an image variant. Mitigation: the smoke script polls Mailpit HTTP readiness before registration (AC-7).
- OQ-2 — Mailpit is assumed to become ready (HTTP + SMTP) within the smoke readiness budget; the readiness poll in `smoke.mjs` covers transient slowness.
- OQ-3 — Compose provider parity: the fix relies on `podman compose` honoring `depends_on` the same way CI's `docker compose` does (the same assumption recorded in `aws-deploy-pipeline` F2 notes).

## Assumptions

- Mailpit starts in well under one second; `service_started` plus the script-level readiness poll is sufficient to avoid the registration race.
- No change to the smoke check count (12) or to the smoke command string in `package.json`.

## Revision history

- r1 — 2026-11-01 — initial draft