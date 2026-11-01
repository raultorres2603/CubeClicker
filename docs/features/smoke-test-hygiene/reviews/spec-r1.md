---
feature: smoke-test-hygiene
phase: spec
iteration: 1
verdict: approved
blocking: []
nonblocking: 3
---

# Spec Review — r1

## Summary

✅ approved — The spec covers both carried-over INFO items (trailing newline in `compose.smoke.yaml`; Mailpit readiness poll using `MAILPIT_TIMEOUT_MS`), with 10 binary ACs mapped across T1∥T2→T3, disjoint `files_owned`, and no scope invention. Security, container, and real-time considerations are correctly addressed or explicitly out of scope. Three non-blocking notes remain (AC granularity, OQ-1 framing, OQ-2 wording).

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | tasks.md § T3 verify / spec.md § Acceptance criteria (AC-8) | AC-8 bundles four gate commands plus the `src/`-diff condition into a single AC, which makes partial-failure attribution harder during T3. | Either split AC-8 into per-command sub-criteria or keep it as a regression guard but require the build log to record each command's exit code separately (T3's verify already lists them individually). | open |
| F2 | MINOR | spec.md § Open questions (OQ-1) | OQ-1 is phrased as an open question but is actually an accepted limitation with no decision/default to resolve; it reads as unresolved risk. | Reword OQ-1 as an assumption/default (or move it to § Assumptions), stating explicitly that no unit tests are added and verification relies on source inspection + `node --check` + the containerized run, matching `smoke-mailpit-ordering`. | open |
| F3 | INFO | spec.md § Open questions (OQ-2) vs plan.md § Open questions | Wording mismatch: spec OQ-2 says the positional-vs-options decision is "Proposed", while plan.md marks OQ-1 (positional) "Resolved". | Align tense — update spec OQ-2 to "Resolved: third positional parameter (see plan.md decision 1)" so the two artifacts agree. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Both backlog items (trailing newline, Mailpit timeout) covered by AC-1/AC-2 and AC-3–AC-5; verification/regression ACs AC-6–AC-10; non-goals explicit. No scope invented. |
| Testability | ✅ | All ACs are binary with concrete expected values/exit codes; AC-9/AC-10 pin exact `SMOKE PASS (12/12 checks)` output. |
| Boundaries | ✅ | Three tiers present (✅/⚠️/🚫) plus Non-goals; minimal/confined scope stated. |
| Dependency graph | ✅ | `T1 ∥ T2 → T3`, acyclic; dependencies point earlier; all 10 ACs mapped (T1: AC-1,2,7; T2: AC-3,4,5,6; T3: AC-7,8,9,10). Tasks sized to one builder session. |
| Parallel safety | ✅ | T1 owns `compose.smoke.yaml`, T2 owns `tests/e2e/smoke.mjs`, T3 owns only its build log; `[P]` markers match disjoint ownership. |
| Security | ✅ | No user-controlled data, persistence, secrets, auth paths, dependencies, ports, images, env vars, or `src/` changes; `.env*` untouched. |
| Testing | ✅ | Unit/none-new justified (no TS touched); containerized e2e for AC-6/7/9/10; `npm run coverage` ≥80% regression guard (AC-8); commands exist in `AGENTS.md`. |
| Consistency | ✅ | Aligns with vision and `AGENTS.md`; reuses existing `pollUntilReady`/`MAILPIT_TIMEOUT_MS`; no contradictions. |
| Real-time | ✅ | Explicitly out of scope; no shared/cross-client state, connection lifecycle, or server authority changes. |
| Containers | ✅ | No new service/image/port/config/deployable; merged Compose config validity pinned (AC-7); follows `docs/architecture/containerization.md`. |

## Previous round verification (if iteration > 1)

N/A — first iteration (r1).

## Notes / backlog (non-blocking)

- Documentation gate: spec correctly records no doc changes required; `docs/features/README.md` row is orchestrator-owned and applied on acceptance per `docs/architecture/documentation.md` § Ownership.
- The two source edits are minimal and confined: append one `\n` to `compose.smoke.yaml`; add optional third positional param to `pollUntilReady` defaulting to `READY_TIMEOUT_MS` and pass `MAILPIT_TIMEOUT_MS` at the Mailpit call site. No application behavior change.
- OQ-1/OQ-2 are well-posed with defaults (positional param defaulting to `READY_TIMEOUT_MS`; 10 s Mailpit budget), with F2/F3 noting only wording/framing.