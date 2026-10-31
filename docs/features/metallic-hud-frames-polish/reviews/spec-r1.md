---
feature: metallic-hud-frames-polish
phase: spec
iteration: 1
verdict: approved
blocking: 0
nonblocking: 2
---

# Spec Review — r1

## Summary

✅ Approved — the scope is tightly bounded to the two non-blocking findings from `metallic-hud-frames` code-r1 (F1 trailing newline, F2 mask-guard anchor); ACs are binary and evidence-able, the dependency graph is acyclic, no parallel tasks exist, and real-time/container impact is correctly stated as none. Two non-blocking evidence/precision gaps are recorded (F1 MINOR, F2 INFO); neither blocks building.

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | spec.md § AC-3; tasks.md § T1 verify, T2 verify | AC-3 is titled "No other files changed" and claims only `app.css` and `app.css.test.ts` differ, but the listed diff gates check only a subset of protected paths: they omit the integration test files named in the Testing strategy (`Hud.test.tsx`, `UserPanel.test.tsx`, `AuthMenu.test.tsx`, `AuthForms.test.tsx`, `ConnectionBanner.test.tsx`, `VerificationPending.test.tsx`, `App.test.tsx`), the dependency manifests (`package.json`/`package-lock.json`), and they do not assert the complete set of changed files. An edit to an unprotected file or a new dependency could therefore pass the gate, so the AC as worded is stronger than its evidence. | Either extend the protected-path lists in AC-3/T1/T2 to include the integration test files and manifests, or reword AC-3 to "no protected surface changed" and require the build log to record `git diff --name-only "$BASE"...HEAD` plus an assertion that its output is exactly the two owned files. | open |
| F2 | INFO | spec.md § AC-1; plan.md § Interfaces/contracts — Trailing newline | AC-1 requires the final *byte* to be `0x0A` with a non-`0x0A` penultimate byte, but the specified guard (`css.endsWith('\n')` / `!css.endsWith('\n\n')`) operates on UTF-16 code units. For this ASCII stylesheet the two are equivalent, but the evidence does not literally check bytes and the equivalence is not stated. | Either state the ASCII/UTF-8 assumption in AC-1/Assumptions, or strengthen the guard to check the last two bytes via `Buffer` (`Buffer.from(css).subarray(-2)`). | open |

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Both code-r1 findings (F1, F2) mapped to AC-1/AC-2; manual visual check correctly listed as non-goal; no scope invented. |
| Testability | ✅ | AC-1/AC-2 are binary with concrete expected values and named evidence; F1 records a precision gap in AC-3's evidence, not in its pass/fail. |
| Boundaries | ✅ | Always/Ask first/Never present; non-goals listed; `files_owned` limited to the two files. |
| Dependency graph | ✅ | T1 → T2, acyclic; dependencies point at earlier tasks; every AC mapped (T1: AC-1/2/3, T2: AC-4); T2 verification-only. |
| Parallel safety | ✅ | No `[P]` tasks; no shared-file contact; T2 owns no files. |
| Security | ✅ | CSS + test-source only; no new dependencies, user data, storage, or network; F1 notes the manifest gap. |
| Testing | ✅ | Unit + integration + manual visual + container smoke; `npm run coverage` with ≥ 80% statements/branches/functions/lines per workspace; concrete assertions; assertion-quality bar referenced. |
| Consistency | ✅ | Aligns with AGENTS.md, stack.md, containerization.md, documentation.md (no doc change required; orchestrator-owned index row proposed on acceptance). |
| Real-time | ✅ | None: client-local presentation/test change; connection lifecycle, reconnection, multi-client behaviour, and server authority unaffected. |
| Containers | ✅ | None: no new services, images, ports, config, or compose/Dockerfile changes; AC-3 pins the container-file diff gate. |

## Previous round verification (if iteration > 1)

N/A — iteration 1.

## Notes / backlog (non-blocking)

- The anchored regexes in the plan (`/^\s*-webkit-mask:/m`, `/^\s*-webkit-mask-composite:/m`, `/^\s*mask:/m`, `/^\s*mask-composite:/m`) cannot resolve to each other's declarations because the `^` anchor is line-bound and `\s*` matches only whitespace, so `-webkit-mask:`/`-webkit-mask-composite:` lines fail the standard patterns and vice versa. Verified against the current stylesheet (lines 682–685).
- Q-1/Q-2 remain open questions in the spec but both have safe defaults in the plan; the code reviewer should confirm the chosen anchor cannot resolve to `-webkit-mask:` (F2-style check) at the code gate.
- No predecessor spec/plan/task file is edited by this feature; the polish stays confined to the two owned files.