---
feature: adaptive-render-budget-v2
phase: spec_review
round: 2
iteration: 2
verdict: changes_requested
reviewed: 2026-11-12
blocking: 1
nonblocking: 2
---
# Spec Review — r2

## Summary
❌ changes requested — 1 MAJOR, 2 MINOR, 2 INFO. The r1 blocking findings F1/F2 are fully resolved: the task chain is now strictly sequential (T1 → T2 → T3 → T4 → T5, all `[seq]`, T4 depends on T2 and T3), and AC-2/AC-14 name the concrete `'receives welcome after a detached retryConnection → join(account) → attach cycle'` test with handler-before-connect, one-connect/zero-close, serverId, and intro-release assertions. F4–F17 are fixed: the supersession ledger now carries the `createPostprocessing(..., tier)` signature and the `createWebGLRenderer` versus `createRealisticRenderer` distinction; the approval checkpoint, context-loss clause, gate close/reopen + StrictMode test, explicit non-goals, T5 predecessor diffs, AC-13 mapping, T3 scene test ownership, exact README sentence, p95 allocation wording, `chosen`/`guest` naming, and the production-adapter contract test are all present. High-tier parity is not weakened: AC-6 still pins the four-pass composer, SSAO/bloom constants, 2048 shadow, DPR 2, and the ledger keeps the high tier exact.

One MAJOR remains: AC-12's prose arithmetic. The table and tier sequence are correct and binary-testable, but the low→medium stable streak after push 180 is **7**, not `1`. The low branch starts at push 161; the p95 falls to 10 at push 174, so pushes 174–180 are the seven stable frames. The 240-frame gate still means no upgrade fires, and the table/test values (60/30/30, 120/20/30, 120/10/10; high 1–59, medium 60–159, low 160–180) are correct.

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1-r2 | MAJOR | `spec.md:56` (AC-12 "No upgrade fires" sentence), `spec.md:49-54` (stream/table), `tasks.md:24` (T1 pinned test) | AC-12 says "after push 180 the low→medium stable streak is `1`". The exact stream is 60×30, 60×10, 60×10; the medium→low change occurs on push 160; the low branch is evaluated from push 161. The p95 is 30 while at least 7 of the 20 remaining 30-ms samples are in the window (through push 173); at push 174 the window has 6 of them, p95 = 10, and the low `stable` condition (`avg ≤ 17 && p95 ≤ 22`) first passes. Pushes 174–180 are therefore 7 stable frames, not 1. The table, tier sequence, high→medium push 60, medium→low push 160/streak 100/cooldown 1000, and push-159 990 ms are all correct. | Correct the sentence to `7` (the seven stable frames are pushes 174–180) or remove the unexposed internal-streak claim. Keep the AC-12 table, tier sequence, and T1 test values unchanged; the 240-frame gate still blocks the upgrade. If the exact streak is to be asserted, expose a test-only getter or record it in the T1 build log rather than relying on the prose. | open |
| F2-r2 | MINOR | `status.md:31` | The status's last open-questions bullet still says "Draft artifacts written (spec r1, plan r1, tasks, status); spec review not yet started." The status frontmatter is `spec_review_round: 2` and the loop log records r1/r2, so this line is stale. The task board itself is consistent: T1–T5 are all `[seq]`, T3 matches the revised tasks. | Remove or update the stale bullet so the status matches the r2 state. Orchestrator-owned; no spec change. | open |
| F3-r2 | MINOR | `spec.md:27` (AC-2), `plan.md:238` (manual gate-deferral step), `session.test.ts` named test | AC-2 says the attach-time `transport.connect()` "presents the current cookie", but the named test asserts handler registration, connect/close counts, serverId, and intro release; it cannot observe the browser cookie at the WebSocket upgrade. The cookie evidence lives in the manual step 2 ("with the cookie present") and the unchanged `ws/connection` path, not the named test. | Either cite the manual step/`ws/connection` test as the cookie evidence and soften "that test" in AC-2's evidence line, or add a transport/ws-level assertion for the upgrade URL/cookie behavior. Non-blocking for the welcome race, which is fixed. | open |
| F4-r2 | INFO | `spec.md:29` (AC-4), `tasks.md:51` (T4 notes) | AC-4 says the test asserts "`attach`/`dispose` counts `1/1/2`", while the T4 notes say "2 attaches total, dispose 1" (the sequence is attach 1 → dispose 1 → attach 2, final attach 2 / dispose 1; the StrictMode remount is attach 2 / dispose 1). The `1/1/2` shorthand is ambiguous. | Clarify as "first attach 1, dispose 1, second attach 2 (final attach 2, dispose 1)" in AC-4 or the T4 notes. No behavior change. | open |
| F5-r2 | INFO | `spec.md:56`, `src/frontend/src/render/quality.ts:189-199` (QualityPolicy API) | The low→medium stable streak is not exposed by `QualityPolicy` (`getWindowSize`/`getAverageFrameMs`/`getP95FrameMs` only), so the exact `1`/`7` value cannot be asserted by the T1 test; only the tier/no-upgrade outcome is observable. This is why the prose value can drift unnoticed. | Prefer removing the unexposed streak claim; if the exact streak is kept as an acceptance value, add a test-only getter or assert it via a deterministic tier-change test. | open |

## Previous round verification
| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (r1) T3 `[P]` / "T3 ∥ T2" | fixed | `tasks.md:3` is T1 → T2 → T3 → T4 → T5 (all `[seq]`); T3 `depends_on: T2`; T4 `depends_on: T2, T3`; the sequential rule is explicit; `status.md` task board T3 is `[seq]`. |
| F2 (r1) welcome-race test | fixed | AC-2/AC-14 name `'receives welcome after a detached retryConnection → join(account) → attach cycle'` with handler-before-connect, `connectCount() === 1`, `closeCount() === 0`, `world.serverId`, and the intro-release frame assertion; T2/T4 and the testing strategy reference it. |
| F3 (r1) AC-12 pinning | partially fixed | The stream, post-block window/average/p95, and tier sequence are now exact and correct (`spec.md:49-54`); the low→medium stable-streak value is wrong (F1-r2). |
| F4 (r1) ledger signature/factories | fixed | `spec.md:74-76` adds `createPostprocessing(..., tier)` to AC-4/AC-6 and separates `createRealisticRenderer` (tier-aware) from `createWebGLRenderer` (unchanged, `setQuality` no-op). |
| F5 (r1) approval checkpoint | fixed | `spec.md:134` and `plan.md:244` require the `awaiting_approval` summary to name the AC-18 animation-clause supersession, Q-1, Q-2, and Q-3; T5 records that the checkpoint did so. |
| F6 (r1) context-loss during intro | fixed | AC-13(g) adds the synthetic `webglcontextlost`/`webglcontextrestored` no-throw/no-frame-change/no-new-listener clause; T2 and the plan risk list repeat it. |
| F7 (r1) gate reopen/logout/StrictMode | fixed | AC-4 defines `active: true → false → true` and the StrictMode-like mount/unmount/remount (attach 2 / dispose 1); A-1 states logout clears the store but does not reopen the gate; T4 tests it. |
| F8 (r1) raw-request new skills/features | fixed | Non-goals at `spec.md:93-95` explicitly defer the skill audit, new-feature ideation, and all other audit-queue items. |
| F9 (r1) T5 commits_also/predecessor diff | fixed | `tasks.md` T5 lists all four build logs explicitly and runs the three predecessor-directory `git diff --exit-code` checks. |
| F10 (r1) AC-13 listener/frame mapping | fixed | AC-13(a) cites `GameCanvas.test.tsx`/`App.test.tsx` and the session fake's listener/scheduler counts; the AC map assigns AC-13 to T2 and T4. |
| F11 (r1) T3 scene test ownership / T4 order | fixed | T3 `files_owned` includes `scene-spaceship.test.ts` and `scene-effects.test.ts`; T4 depends on T2 and T3; the notes keep the existing tests' high-tier expectations. |
| F12 (r1) AC-16 README wording | fixed | AC-16 pins the exact README sentence and the T5 `grep -F`; the T5 also asserts `docs/features/README.md` is untouched. |
| F13 (r1) p95 allocation claim | fixed | `plan.md:163` now says `splice` allocates a small array per eviction and the goal is no per-frame sort, not zero allocation. |
| F14 (r1) `chosen`/`guest` vs `initiallyClosed` | fixed | AC-4 states the App props are `chosen`/`guest` and `initiallyClosed` is the gate option. |
| F15 (r1) audit-queue non-goal | fixed | `spec.md:95` explicitly excludes every other audit-queue item. |
| F16 (r1) manual visual evidence | no action | The manual containerized pass remains supplementary and correctly labelled. |
| F17 (r1) fake-adapter drift | fixed | AC-10 and the testing strategy add the production `createRealisticRenderer` contract test (`medium → pixel ratio/size → render → low → render → idempotent low → high → render`); the plan risk list repeats it. |

## Checklist results
| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | The performance asks P-01/P-02/P-03/P-09 are covered; the skill/feature/other-queue asks are explicit non-goals (F8/F15). |
| Testability | ❌ | AC-12's table/tier sequence are exact, but its low→medium stable-streak prose is wrong and not observable through the public policy API (F1-r2/F5-r2); the AC-2 cookie and AC-4 `1/1/2` shorthand are minor (F3-r2/F4-r2). |
| Boundaries | ✅ | Three tiers, non-goals, and the no-application/container boundary are present. |
| Dependency graph | ✅ | T1 → T2 → T3 → T4 → T5 is acyclic; T4 depends on T2/T3; every AC is mapped. |
| Parallel safety | ✅ | All tasks are `[seq]`; no `[P]`; the shared full-suite verify is no longer claimed as parallel. |
| Security | ✅ | No user data, secrets, dependency, persistence, or auth weakening; the server remains the authority; the deferral only delays the socket. |
| Testing | ✅ | Unit/integration tiers, coverage ≥ 80 per workspace, assertion-quality bar, welcome test, context-loss probe, and the production-adapter contract are present; F1-r2/F5-r2 concern the unexposed streak. |
| Consistency | ❌ | The AC-12 low→medium stable-streak value is wrong (F1-r2); the status's last bullet is stale (F2-r2). |
| Real-time | ✅ N/A | Client-local rendering; AC-14 pins the unchanged transport and the welcome path. |
| Containers | ✅ N/A | No service, image, port, env, or endpoint change; `npm run smoke` is not an acceptance gate. |

## Minimum remaining revisions for approval
1. **Resolve F1-r2 (the only blocking finding).** Change AC-12's "the low→medium stable streak is `1`" to `7` (the seven stable frames are pushes 174–180), or remove the unexposed internal-streak claim. The AC-12 table, tier sequence, and T1 test values are correct; the 240-frame gate still blocks the upgrade. If the exact streak is kept, expose a test-only getter or record it in the T1 build log rather than relying on prose.

Non-blocking corrections (fix or explicitly rebut in the same revision): F2-r2 (remove the stale status bullet), F3-r2 (cite the manual/ws evidence for the cookie or soften AC-2's "that test" wording), F4-r2 (clarify the `1/1/2` shorthand), F5-r2 (remove the unexposed streak or add a getter).

## Notes / backlog (non-blocking)
- **AC-12 simulation (this review):** 60×30 → push 60 window 60, average 30, p95 30, `medium`; 60×10 → push 120 window 120, average 20, p95 30, `medium`; 60×10 → push 160 `low` (average 13.33 at the change, p95 30; the medium miss streak 100 and the cooldown exactly 1000 ms; push 159 is 990 ms); push 174 average 11, p95 10, low upgrade streak 1; push 180 average 10, p95 10, low upgrade streak 7. The table's post-block values are 60/30/30, 120/20/30, 120/10/10 and the tier sequence high 1–59 / medium 60–159 / low 160–180 is correct.
- **High-tier parity is preserved:** AC-6 still pins the exact high pass list, SSAO 0.5/0.005/0.1, bloom 0.45/0.4/0.85, shadows enabled with 2048², DPR 2, and the composer; the ledger adds the `createPostprocessing(..., tier)` signature without weakening the high tier, and the `createRealisticRenderer` low-only shadow disable is separated from the unchanged `createWebGLRenderer`.
- **Welcome race is fixed:** the named AC-2 test records `onMessage`/`onStatus` before `connect`, runs detached retry → join → attach, emits `welcome`, and asserts `serverId`, one connect, zero closes, and the intro-release frame. The existing `session.attach` order (`session.ts:1315-1319`) matches it.
- **Status:** the task board is correct (T1–T5 all `[seq]`); only the last open-questions bullet is stale (F2-r2).
- **Source claims rechecked:** `session.attach` subscribes before `connect`; `transport.join` records `lastMode` (`transport.ts:120-121,167-175`); `createPostprocessing` is 3-arg at present (`postprocessing.ts:75-80`); `createWebGLRenderer` keeps `shadowMap.enabled = true` and has no tier (`webgl.ts:54-70`); `createRealisticRenderer` buffers size/ratio (`webgl.ts:77-127`); `scene.applyQuality`/`setQualityTierForTesting` exist (`scene.ts:929-953`, `1010-1015`); `quality.ts:227-232` currently sorts a copy. The predecessor ACs/ledger quotes still match `user-authentication:59`, `realistic-lighting-materials:27,49,62,116`, and `spaceship-cursor-loot-animations:513,558,938`.
