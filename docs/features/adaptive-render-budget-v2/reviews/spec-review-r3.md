---
feature: adaptive-render-budget-v2
phase: spec_review
round: 3
iteration: 3
verdict: approved
reviewed: 2026-11-12
blocking: 0
nonblocking: 1
---
# Spec Review — r3

## Summary
✅ approved — 0 blocking, 1 non-blocking status-housekeeping note. F1-r2 is fully resolved: AC-12 no longer claims an internal low→medium stable-streak value; it states that the low→medium gate requires 240 stable frames, the 180-push stream ends before that gate can be reached, and the test asserts only `QualityPolicy`-observable values (`getWindowSize`, `getAverageFrameMs`, `getP95FrameMs`, `getTier`). The AC-12 table (60/30/30, 120/20/30, 120/10/10), tier sequence (high 1–59, medium 60–159, low 160–180), high→medium push 60, and medium→low push 160/streak 100/cooldown 1000/push-159 990 ms are correct.

F3-r2 is fixed: AC-2 now says the named session test observes the connect count, not the cookie, and cites the unchanged `ws/connection` path plus `plan.md` § Verification step 2 for the cookie-at-upgrade behavior. F4-r2 is fixed: AC-4 states the unambiguous counts (first attach 1, dispose 1, second attach 2; final attach 2, final dispose 1), matching T4. F5-r2 is resolved by the same AC-12 rewrite. The r1/r2 blocking findings remain fixed: the task chain is strictly T1 → T2 → T3 → T4 → T5 (all `[seq]`, T4 depends on T2 and T3), the welcome test is named in AC-2/AC-14 and T2/T4, and the production-adapter contract test is present.

High-tier parity is preserved: AC-6 still pins the exact four-pass high composer, SSAO `0.5/0.005/0.1`, bloom `0.45/0.4/0.85`, shadows enabled with a 2048 × 2048 map, DPR `min(devicePixelRatio, 2)`, and the composer render; the ledger keeps the high tier exact and separates the tier-aware `createRealisticRenderer` from the unchanged `createWebGLRenderer`. The plan is implementable by the declared builder-owned T1–T5 chain and cannot lose the scope: no application/backend/container/dependency change is introduced.

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1-r3 | MINOR | `status.md:31` | The status's last open-questions bullet still says "Draft artifacts written (spec r2, plan r2, tasks); spec review rounds 1-2 completed; revision r3 pending." The frontmatter is `spec_review_round: 3`, the loop log already records r1/r2 and the r3-intake line, and the r3 artifacts are present; the line is stale (it still says r2/pending). The task board itself is correct: T1–T5 are all `[seq]`, T3 matches the revised tasks. | Orchestrator-only housekeeping: remove or update the stale bullet so it reflects the r3 state. No spec, plan, tasks, or build change. Build-time note only. | open |

## Previous round verification
| Finding | Status | Evidence |
| --- | --- | --- |
| F1-r2 (AC-12 stable-streak claim) | fixed | `spec.md:56` removes the unobservable streak value and states the 240-frame gate/stream-end outcome and that only `QualityPolicy`-observable values are asserted; `tasks.md:24` pins the test to `getWindowSize`/`getAverageFrameMs`/`getP95FrameMs`/`getTier`; the AC-12 table and tier sequence are unchanged and correct. |
| F2-r2 (stale status bullet) | partially fixed | The line was updated from "spec review not yet started", but now says "revision r3 pending"; the r3 artifacts are applied and this is round 3, so the line is still stale (F1-r3). The task board is correct. |
| F3-r2 (AC-2 cookie evidence) | fixed | `spec.md:27` now says the named session test observes the connect count, not the cookie, and cites the unchanged `ws/connection` path plus `plan.md` § Verification step 2; `plan.md:155` repeats the distinction. |
| F4-r2 (AC-4 `1/1/2` shorthand) | fixed | `spec.md:29` states first attach 1, dispose 1, second attach 2, final attach 2 / dispose 1; `tasks.md:51` matches with "first attach 1, dispose 1, second attach 2" and the StrictMode final counts. |
| F5-r2 (unexposed streak) | fixed | AC-12 explicitly says the internal stable-streak counter is not part of `QualityPolicy` and is not asserted; the T1 test asserts only observable values. |

## Checklist results
| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | P-01/P-02/P-03/P-09 are covered; the skill/new-feature/other-queue asks are explicit non-goals. |
| Testability | ✅ | AC-12's table/tier sequence/test values are exact and observable; AC-2's welcome test, AC-4's counts, AC-13(g)'s context probe, AC-16's exact sentence, and AC-17's predecessor diffs are pinned. |
| Boundaries | ✅ | Three tiers, non-goals, and the no-application/backend/container boundary are present. |
| Dependency graph | ✅ | T1 → T2 → T3 → T4 → T5 is acyclic; T4 depends on T2 and T3; every AC is mapped. |
| Parallel safety | ✅ | All tasks are `[seq]`; no `[P]`; the shared full-suite verify is not claimed as parallel. |
| Security | ✅ | No user data, secrets, dependency, persistence, or auth weakening; the server remains the authority; the deferral only delays the socket. |
| Testing | ✅ | Unit/integration tiers, coverage ≥ 80 per workspace, assertion-quality bar, welcome test, context-loss probe, and the production-adapter contract are present. |
| Consistency | ✅ | Spec/plan/tasks agree on the gate, tier matrix, p95, lifecycle, T5 checks, and the ledger; the only stale item is the orchestrator-owned status bullet (F1-r3). |
| Real-time | ✅ N/A | Client-local rendering; AC-14 pins the unchanged transport and welcome path. |
| Containers | ✅ N/A | No service, image, port, env, or endpoint change; `npm run smoke` is not an acceptance gate. |

## Non-blocking observations for the build phase
- **Status housekeeping (F1-r3):** the orchestrator should update the last status bullet to reflect the r3 applied and round 3 (or remove it); the task board itself is correct.
- **AC-12 test:** assert only the observable table/tier values (`getWindowSize`/`getAverageFrameMs`/`getP95FrameMs`/`getTier`); do not add a stable-streak assertion, since `QualityPolicy` does not expose it. The T1 build log should record the post-block values.
- **AC-2 welcome/cookie:** the `session.test.ts` named test must record handler registration before `connect`, assert one connect and zero closes for the detached phase, assert the welcome `serverId`, and assert the next frame advances the intro. The cookie-at-upgrade claim is evidenced by the `ws/connection` path and the manual step 2, not the named test.
- **AC-4 counts:** the `GameCanvas.test.tsx` must pin first attach 1 / dispose 1 / second attach 2 and the StrictMode-like final attach 2 / dispose 1; the T4 review should check both sequences.
- **AC-13(g):** the synthetic `webglcontextlost`/`webglcontextrestored` probe must not throw, must not change the scheduled-frame count, and must not add a context listener of the session's own; the session's canvas listeners stay the five pointer handlers.
- **T5:** list all four build logs explicitly, run the three predecessor-directory `git diff --exit-code` checks, use the exact `grep -F` README sentence, assert `docs/features/README.md` is untouched, and record the manual high-tier parity screenshots / CPU-throttled degradation / resize/tab probes as passed or "not executed — environment".
- **High-tier parity:** the T2/T3 high-tier tests and the manual 1280×720/1920×1080 comparison must show no visible difference (SSAO contact shading, bloom, 2048 shadow edge, cursor material) before acceptance.
- **T3/T4 sequence:** T3 must land before T4; the existing `scene-spaceship.test.ts`/`scene-effects.test.ts` must pass unchanged (or receive only the same concrete high-tier expectation with the reason in the build log).

## Checkpoint summary items (`awaiting_approval`)
The summary must explicitly present, not generically approve:
- **Q-1 — low-tier shadows:** shadows fully off at low (`renderer.shadowMap.enabled = false`, `keyLight.castShadow = false`); alternative is one static contact-shadow plane.
- **Q-2 — intro after gate close:** the intro plays from its start when the gate closes; this supersedes the `user-authentication` AC-18 "cinematic keeps animating behind the overlay" clause (the canvas stays mounted, overlay labels/structure retained; intro starts at gate close). Alternative: skip the intro on late attach and begin in `playing`.
- **Q-3 — DPR ladder:** `2 / 1.5 / 1.0` (high/medium/low); alternatives medium `1.25` / low `0.75`.
- **AC-18 supersession:** the checkpoint must name the `user-authentication` AC-18 animation-clause change and confirm the overlay/canvas markup is retained; the ledger row is not a silent change.

## Notes / backlog
- **AC-12 arithmetic (this review):** 60×30 → push 60 window 60 / average 30 / p95 30 / `medium`; 60×10 → push 120 window 120 / average 20 / p95 30 / `medium`; 60×10 → push 160 `low` (medium miss streak 100, cooldown exactly 1000 ms; push 159 is 990 ms); the low tier remains through push 180; the low→medium gate needs 240 stable frames, so no upgrade fires. The table's post-block values 60/30/30, 120/20/30, 120/10/10 and the tier sequence are correct.
- **High-tier parity:** AC-6 is unchanged and still pins the four-pass high composer, SSAO 0.5/0.005/0.1, bloom 0.45/0.4/0.85, shadows enabled with 2048², DPR 2, and the composer; the ledger keeps the high tier exact and separates the tier-aware `createRealisticRenderer` from the unchanged `createWebGLRenderer`.
- **Welcome race:** AC-2/AC-14 name the `'receives welcome after a detached retryConnection → join(account) → attach cycle'` test; the existing `session.attach` subscribes `onMessage`/`onStatus` before `connect` (`session.ts:1315-1319`), so the attach-time welcome cannot be missed.
- **Source claims rechecked:** `quality.ts:227-232` currently copies and sorts every `p95()`; `createPostprocessing` is 3-arg at present (`postprocessing.ts:75-80`); `createWebGLRenderer` keeps `shadowMap.enabled = true` and has no tier (`webgl.ts:54-70`); `createRealisticRenderer` buffers size/ratio (`webgl.ts:77-127`); `scene.applyQuality`/`setQualityTierForTesting` exist (`scene.ts:929-953`, `1010-1015`); `transport.join` records `lastMode` (`transport.ts:120-121,167-175`). The predecessor ACs/ledger quotes still match `user-authentication:59`, `realistic-lighting-materials:27,49,62,116`, and `spaceship-cursor-loot-animations:513,558,938`.
- **No source, test, config, or artifact edits were made by this review;** only the review file was written. The feature is ready for the `awaiting_approval` checkpoint and the sequential T1–T5 build.
