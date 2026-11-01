---
feature: smoke-mailpit-ordering
phase: spec
iteration: 1
verdict: approved
blocking: []
nonblocking: 5
---

# Spec Review — r1

## Summary

✅ approved — The spec fully covers the upstream Mailpit ordering defect (aws-deploy-pipeline F2): AC-1…AC-7 are binary-testable and mapped to T1–T3; the DAG (T1 ∥ T2 → T3) is acyclic with disjoint `files_owned` and correct `[P]` markers. The fix approach was independently validated this round: a proposed-change copy of `compose.smoke.yaml` + `smoke.mjs` runs `npm run smoke` to `SMOKE PASS (12/12 checks)` with no prior `up -d mailpit`, and the Mailpit-primed (CI belt-and-braces) run also passes 12/12. Security, testing, containerization, and non-goal boundaries are sound. Five non-blocking findings remain (task-verify completeness, readiness-predicate precision, parity note, form note, feature-index ownership).

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | tasks.md T3 `verify:`; spec.md AC-3 | T3's verify line runs only the unprimed `npm run smoke`, so AC-3 ("the CI Mailpit pre-start step still succeeds") has no pinned local evidence even though it is listed in T3's `acceptance:`. The primed variant is the one that exercises the belt-and-braces path. | Add the primed run to T3's verify (e.g. `podman compose -f compose.yaml -f compose.smoke.yaml up -d mailpit && npm run smoke`, exit 0 / `SMOKE PASS (12/12 checks)`), or explicitly state that CI (aws-deploy-pipeline `smoke-e2e`) is the evidence source for AC-3. | open |
| F2 | MINOR | plan.md § Interfaces / contracts (Smoke script) | The readiness-poll contract says "polls `MAILPIT_URL + '/'` via the existing `pollUntilReady` helper" but does not state the `validate` predicate, leaving the builder to choose between `response.ok` and an exact status. Both work against Mailpit (root returns 200 `text/html`), but the anchor should be unambiguous. | Pin the predicate in plan.md (e.g. `response.ok` / status 200) alongside the URL and helper name. | open |
| F3 | INFO | spec.md § Open questions OQ-3; plan.md § Risks | Compose-provider parity is stated as an assumption; in this environment `podman compose` delegates to the external docker-compose provider (v5.6.0), so parity with CI's docker compose is effectively identical. Recording this removes the last trace of doubt about OQ-3. | Add one sentence to OQ-3 noting that the local provider is docker-compose under podman, so the `depends_on` semantics are identical. | open |
| F4 | INFO | compose.smoke.yaml (T1); plan.md § Interfaces / contracts | The plan pins the long form (`condition: service_started`) for all three `smoke.depends_on` entries, but the current file uses short form (`- backend` / `- frontend`), which expands to `service_started` in the merged config. Either form satisfies AC-2/AC-4 (verified: merged config shows `mailpit: service_started`). | Builder should match the plan's long form for all three entries for clarity; short form is acceptable if the merged config matches. | open |
| F5 | INFO | docs/features/README.md (orchestrator-owned) | No row exists yet for `smoke-mailpit-ordering`; the builder must not edit the index directly. | Orchestrator appends/updates the feature's row on acceptance per `docs/architecture/documentation.md` § Ownership; builder proposes the diff only. | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | All seven ACs covered; non-goals explicitly exclude historical verify-anchor false positives, AWS provisioning, F22 nuance, src/Dockerfile/CI/image changes, new deps, and check-count/command changes. Backlog origin (aws-deploy-pipeline F2) stated. |
| Testability | ✅ | AC-1..AC-7 are binary (exit code / printed string / grep / config exit / node --check / code inspection + smoke run). Minor evidence gap for AC-3 (F1). |
| Boundaries | ✅ | Three tiers present; non-goals and ⚠️/🚫 boundaries explicit and consistent with the minimal two-file change. |
| Dependency graph | ✅ | Acyclic (`T1 ∥ T2 → T3`); every AC mapped to ≥1 task (AC-1/3/5→T3, AC-2/4→T1, AC-6/7→T2); tasks sized to one builder session. |
| Parallel safety | ✅ | T1 and T2 are `[P]` with disjoint `files_owned` (`compose.smoke.yaml` vs `tests/e2e/smoke.mjs`); T3 `[seq]` owns only the build log. No shared-file contact. |
| Security | ✅ | No user-controlled data, persistence, secrets, new ports, images, env vars, or dependencies; change limited to service ordering. |
| Testing | ✅ | Unit/integration tiers stated as "none new" with justification (no TS touched); containerized e2e (`npm run smoke` → 12/12) and regression guards (`lint`, `typecheck`, `test`, `coverage` ≥80%) pinned; commands exist in AGENTS.md. |
| Consistency | ✅ | Reuses existing compose/smoke infrastructure and the `pollUntilReady` helper; no contradiction with AGENTS.md or the containerization contract. The fix improves the single-command local-run contract. |
| Risks | ✅ | OQ-1/OQ-2/OQ-3 well-posed with defaults and mitigations; mid-build dead ends (slow Mailpit, provider parity) are owned by the readiness poll and the existing assumptions. |
| Real-time (when applicable) | N/A | No shared/cross-client state or connection-lifecycle change; multiplayer checks are exercised, not altered, by the smoke suite. |
| Containers (when applicable) | ✅ | No new services/images/ports/config; merged Compose config validates (exit 0, verified); single-command local run is restored; Mailpit remains provider-neutral and unchanged. |

## Previous round verification (if iteration > 1)

N/A — first iteration.

## Notes / backlog (non-blocking)

- Runtime proof recorded this round (independent, on a repo copy with the proposed change applied): unprimed `podman compose … run --rm smoke` → `SMOKE PASS (12/12 checks)` (exit 0); Mailpit-primed run → `SMOKE PASS (12/12 checks)` (exit 0). Merged Compose config → exit 0 with `mailpit: service_started` under `smoke.depends_on`. `node --check tests/e2e/smoke.mjs` → exit 0. Baseline `npm run lint` / `npm run typecheck` → exit 0 on the repository.
- Verified-good anchors: `tests/e2e/smoke.mjs` prints `SMOKE PASS (12/12 checks)` (line 730, `results.length` = 12) matching AC-1's literal; Mailpit root returns `200 text/html` (suitable readiness predicate); `compose.yaml` defines `mailpit` (image `axllent/mailpit:v1.32.0`) with no healthcheck, justifying `service_started` (OQ-1).
- The builder should record the same raw outputs in `build-log-final-verification.md` (T3) for the code gate.