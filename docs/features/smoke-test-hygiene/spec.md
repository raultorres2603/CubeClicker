---
feature: smoke-test-hygiene
revision: 1
status: draft
created: 2026-11-01
updated: 2026-11-01
---

# Spec — Smoke Test Hygiene

## Summary

This feature closes the two remaining INFO items carried over from the `smoke-mailpit-ordering` code review (r1): the missing trailing newline at the end of `compose.smoke.yaml` (pre-existing, cosmetic) and the Mailpit readiness poll in `tests/e2e/smoke.mjs` that reuses the 30-second `READY_TIMEOUT_MS` budget instead of the dedicated 10-second `MAILPIT_TIMEOUT_MS`. The change is confined to those two files and adds no application behavior, no new services, images, ports, or dependencies. Its purpose is hygiene: POSIX-clean file termination and a correctly-scoped readiness budget for Mailpit, while keeping the one-shot smoke green at 12/12 and the primed (CI belt-and-braces) run green.

## User stories

- As a developer, I want `compose.smoke.yaml` to end with a single trailing newline, so the file is POSIX-clean and diff-friendly.
- As a maintainer, I want the Mailpit readiness poll to use its own 10-second budget rather than borrowing the 30-second backend/frontend budget, so each readiness check is bounded by an appropriate, documented timeout.

## Acceptance criteria

- **AC-1** — `compose.smoke.yaml` ends with exactly one trailing newline: the final byte is `\n` and the byte immediately preceding it is not `\n`.
- **AC-2** — Aside from the single added trailing newline, `compose.smoke.yaml` is byte-identical to its pre-change content (no other bytes are modified).
- **AC-3** — `pollUntilReady` accepts an optional readiness-budget parameter defaulting to `READY_TIMEOUT_MS`, so existing callers (backend and frontend health) retain their 30-second budget and their behavior is unchanged.
- **AC-4** — The Mailpit readiness poll in `checkAuthFlow()` passes `MAILPIT_TIMEOUT_MS` as the budget (not `READY_TIMEOUT_MS`).
- **AC-5** — `MAILPIT_TIMEOUT_MS` is defined with value `10000` and is the budget used by the Mailpit readiness poll.
- **AC-6** — `node --check tests/e2e/smoke.mjs` exits 0 (syntactically valid).
- **AC-7** — `podman compose -f compose.yaml -f compose.smoke.yaml config` exits 0 (valid merged Compose configuration).
- **AC-8** — Regression guard: `npm run lint`, `npm run typecheck`, `npm test`, and `npm run coverage` exit 0, and no file under `src/` is changed.
- **AC-9** — Unprimed one-shot smoke: on a host with no containers running and no prior `up -d mailpit`, `npm run smoke` prints `SMOKE PASS (12/12 checks)` and exits 0.
- **AC-10** — Primed smoke: with Mailpit pre-started (`up -d mailpit`), `npm run smoke` prints `SMOKE PASS (12/12 checks)` and exits 0.

## Non-goals

- No application behavior changes beyond the timeout constant selection and the trailing newline.
- No changes to `src/`, Dockerfiles, CI workflows, `compose.yaml`, or the Mailpit image.
- No new dependencies.
- No change to the smoke check count (12) or to the smoke command string in `package.json`.
- No change to `READY_TIMEOUT_MS` or its use by the backend/frontend readiness polls.
- No Mailpit healthcheck added and no change to the `service_started` condition (carried as OQ-1 of `smoke-mailpit-ordering`).
- No edits to the prior feature's spec, plan, tasks, or review artifacts.
- No change to the CI Mailpit pre-start step (retained as belt-and-braces).

## Boundaries

- ✅ Always: keep the change minimal and confined to `compose.smoke.yaml` and `tests/e2e/smoke.mjs`; run `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`; validate the merged Compose config; keep `node --check` green; record verification evidence in the build log.
- ⚠️ Ask first: adding dependencies; editing CI workflows, Dockerfiles, `compose.yaml`, or any file under `src/`; changing the smoke check count or the smoke command string; changing a pinned constant other than the timeout selection above.
- 🚫 Never: edit `.env*`; push; weaken tests (wildcard matchers, assertion-free tests); remove the CI Mailpit pre-start step; introduce any new service, image, port, or environment variable.

## Security considerations

- No user-controlled data, persistence, secrets, or authentication paths are introduced or altered.
- No new dependencies are added.
- Compose changes are limited to file termination; no new ports, images, environment variables, or service definitions.
- `.env*` remains untouched.

## Testing strategy

- Unit: none new — no TypeScript is touched; `smoke.mjs` is plain JS exercised by the containerized run.
- Integration: none new at the TypeScript boundary.
- Containerized e2e: `npm run smoke` must print `SMOKE PASS (12/12 checks)` and exit 0 both unprimed (AC-9) and primed (AC-10); merged Compose config must validate (AC-7); `node --check tests/e2e/smoke.mjs` must pass (AC-6).
- Coverage: `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace (unchanged; regression guard, AC-8). No new TS, so no coverage delta expected.
- Verification commands: `tail`/`od` byte check on `compose.smoke.yaml` (AC-1); `git diff` review (AC-2, AC-8); source inspection of `pollUntilReady` and the Mailpit call site (AC-3, AC-4, AC-5); `node --check tests/e2e/smoke.mjs` (AC-6); `podman compose -f compose.yaml -f compose.smoke.yaml config` (AC-7); `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage` (AC-8); `npm run smoke` unprimed and primed (AC-9, AC-10).

## Real-time considerations

Out of scope. This feature changes neither shared/cross-client state nor any connection lifecycle, reconnection, multi-client behavior, or server authority. It touches only Compose file termination and a test-harness readiness budget. No identity-vs-"no accounts" conflict is introduced.

## Containerization impact

None beyond formatting. `compose.smoke.yaml` is already a settled container asset; this feature adds no service, image, port, configuration, or deployable, and changes no environment variable. The merged Compose configuration remains valid (AC-7). The added trailing newline has no semantic effect on Compose parsing. Container details follow the settled conventions in `docs/architecture/containerization.md` and are not reopened.

## Documentation impact

None required. No user-facing behavior, command, port, image, or configuration changes. The `docs/features/README.md` row for this feature is proposed/applied by the orchestrator on acceptance per `docs/architecture/documentation.md` § Ownership; no architecture or product doc updates are needed.

## Open questions

- OQ-1 — The smoke script has no automated unit tests; verification of AC-3/AC-4/AC-5 relies on source inspection plus `node --check` and the containerized run. This matches the prior feature's approach (no TS touched).
- OQ-2 — Whether the optional budget parameter should be positional or an options object. Proposed: a third positional parameter defaulting to `READY_TIMEOUT_MS`, minimizing the diff and preserving all existing call sites. (Decision recorded in plan.md.)

## Assumptions

- `MAILPIT_TIMEOUT_MS` (10 s) is sufficient for Mailpit readiness, consistent with the prior feature's OQ-2.
- Adding the optional parameter with a default preserves the behavior of every existing `pollUntilReady` caller.
- The trailing newline is the only byte-level change to `compose.smoke.yaml`.

## Revision history

- r1 — 2026-11-01 — initial draft
