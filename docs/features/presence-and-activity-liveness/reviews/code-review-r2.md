---
feature: presence-and-activity-liveness
phase: code_review
round: 2
iteration: 2
verdict: approved
reviewed: 2026-11-16
blocking: 0
nonblocking: 1
---
# Code Review — r2

## Summary

✅ approved — all five r1 findings are closed on the current tree. The feature artifacts are tracked (the committed `realtime.md` link resolves on a clean checkout), the T9/T2 log bookkeeping is reconciled, `git diff --check` is clean, the delayed-close close-reason race is fixed with a regression test that fails without the fix, and the spec frontmatter reads `status: approved`. The independently reproduced gate is green: lint/typecheck 0, backend **1538** tests at 96.2/89.92/99.57/96.2 coverage, frontend 2301 tests unchanged, smoke 28/28 on the final tree, protected files byte-unchanged. The feature is ready for acceptance; the only remaining item is the orchestrator-owned `docs/features/README.md` row (plus committing the current `status.md` transition).

## r1 findings verification

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 — MAJOR: feature artifacts untracked / broken committed link | **Fixed** | `git ls-files docs/features/presence-and-activity-liveness` lists `spec.md`, `plan.md`, `tasks.md`, `status.md` and all `reviews/` (plus the build logs) at `909d0cd`; `HEAD:docs/features/presence-and-activity-liveness/spec.md` exists and `HEAD:docs/architecture/realtime.md:129` links to it, so the relative link resolves on a clean checkout. `909d0cd --name-only` contains no `game-feel` path; `git diff --name-only main...HEAD \| grep game-feel` returns nothing (the other feature's directory remains untracked and uncommitted). |
| F2 — MINOR: stale T9 task-state wording | **Fixed** | `build-log-T9.md:507` adds `## Post-review bookkeeping (code-review r1)` stating T9 is now `[x]`, `status.md` records `building → code_review`, the artifacts are tracked, T2 EOF is fixed, the spec is approved and F4 is fixed. The original T9 evidence above the appended section is byte-unchanged (the commit only appends; no reword). `tasks.md:84` has `status: [x]`; `status.md:3-5` has `state: code_review`, `build_round: 2`. |
| F3 — MINOR: T2 log blank line at EOF | **Fixed** | `tail -c 40 build-log-T2.md` ends with exactly `… source and tests.\n`; `git diff --check main...HEAD` exits 0 with no output (previously exit 2 at `build-log-T2.md:188`). |
| F4 — MINOR: delayed-close `closeReason` overwrite | **Fixed** | `src/backend/src/game/hub.ts:899-906` clears `connection.heartbeat` (and sets it to `null`) after pinning `closeReason = 'client'` and before `removeMember`/`peer.close()`. The new `hub.test.ts` test `keeps the client close reason when a heartbeat tick fires before the close event (AC-9)` uses `DelayedClosePeer`, advances one heartbeat interval, then delivers the close: exactly one `cubeclicker_ws_connections_closed_total{reason="client"}`, no `reason="heartbeat"` sample, peer closed exactly once. The test fails without the clear (recorded negative proof in `build-log-r1-fixes.md`), so it guards the regression. `handleClose` is otherwise untouched; grace/rejoin tests (AC-1/AC-2/AC-4) remain green. |
| F5 — INFO: spec frontmatter `draft` | **Fixed** | `HEAD:docs/features/presence-and-activity-liveness/spec.md:4` is `status: approved`; revision 3 and the content are unchanged. |

## Acceptance criteria

No AC changed in this fix round: only `hub.ts`/`hub.test.ts` and documentation/artifact files moved. The r1 AC evidence remains valid and the full backend suite (including the new AC-9 delayed-close test) is green. AC-1…AC-23 remain **met**; the new test strengthens AC-9 rather than re-pinning it, and the AC-1/AC-4 `vi.getTimerCount()` 3→2 / 2→0 expectations are unaffected by clearing the leaving heartbeat (it is the same interval `handleClose` previously cleared).

## Gate evidence (final tree)

| Check | Result |
| --- | --- |
| `npm run lint` | exit 0, no diagnostics |
| `npm run typecheck` | exit 0, both workspaces |
| `npm test` | exit 0 — backend 37 files / **1538** tests; frontend 75 files / 2301 tests; 0 failures |
| `npm run coverage --workspace @cubeclicker/backend` | exit 0 — 96.2 statements / 89.92 branches / 99.57 functions / 96.2 lines; `hub.ts` 91.12/88.69/98.48/91.12; all ≥ 80 |
| New F4 test (focused) | `hub.test.ts` `keeps the client close reason…` 1 passed / 193 skipped |
| `git diff --check main...HEAD` | exit 0 (clean) |
| `git diff fe567fe..HEAD -- src/frontend tests/e2e compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json` | empty — no frontend/e2e/container/package change since r1 |
| `npm run smoke` (final tree, dev backend bind-mounts current tree) | exit 0 — `SMOKE PASS (28/28)`; explicit leave 0 ms; abrupt close 1001 ms (≥ 900); roster `[A, E]` |
| Coverage/config audit | no Vitest/ESLint/tsconfig/package/compose change in the fix range; thresholds and exclusions unchanged |
| Assertion audit | new test uses concrete values (`.toBe(1)`, `.toBeNull()`, `closeCalls === 1`); no weakened assertion or banned matcher |

## Checks

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | Fix is a timer clear on the sender's own connection; no new surface, secret, dependency or route. |
| Quality | ✅ | Minimal diff; heartbeat clear reuses `timers.clearInterval`; `handleClose` remains idempotent. |
| Testing | ✅ | Regression test is decisive (fails without the fix), exact-value assertions, coverage still ≥ 80; no exclusion/threshold change. |
| Real-time | ✅ | Explicit leave still finalizes self-only and closes the peer; abrupt close/grace/token rejoin unchanged and green. |
| Containerized delivery | ✅ | No compose/Dockerfile/package change; smoke 28/28 on the final tree. |
| Documentation | ✅ | Artifacts tracked; link resolves; T9/T2 logs reconciled; T8 docs unchanged and accurate. |

## Residual findings (non-blocking)

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| R1 | INFO | `docs/features/presence-and-activity-liveness/status.md` | The round-2 transition (`state: code_review`, `build_round: 2`, the fix loop entries) is present in the working tree but not yet committed; `HEAD` still carries the artifact-tracking version. This is orchestrator-owned state, not a code defect. | Include the `status.md` update in the acceptance/status commit and apply the proposed `docs/features/README.md` row. | open |

## Verdict

**approved** — blocking: 0, nonblocking: 1 (INFO). All r1 findings are closed and the gate is reproducible on the final tree. The feature is ready for acceptance; the only remaining work is the orchestrator-owned `docs/features/README.md` row and committing the current `status.md` transition.
