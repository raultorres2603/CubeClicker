---
feature: live-activity-feed
phase: code_review
round: 1
iteration: 1
verdict: approved
reviewed: 2026-11-16
blocking: 0
nonblocking: 3
---
# Code Review — r1

## Summary

✅ approved — 0 blocker, 0 major, 1 minor, 2 info. The six server-derived events, the inclusive 1 s per-server gate with per-type drops, the completion-first move with the move-in join suppressed, the 20-event newest-first ring, the `welcome`/reconnect/`worldEntered` snapshots and the travel-window pending feed are all implemented and tested. The additive `activityEvent` protocol, the validation matrix, the exactly-two metrics allow-list entries, the `WorldState.activity` reducer/session chain, the five-item non-live ticker with reduced motion, the docs/glossary and the containerized A/B proof are present, and the independent gates pass. The only code-quality MINOR is the T2 `app.test.ts` adaptation, which uses a real 250 ms wait and is outside T2's `files_owned`; the two INFOs are acceptance/bookkeeping (the stale `status.md` Q-4 bullet/date and the T5-proposed README row still says `planning`). No PII/cross-server leak, second live region, coverage failure or unobservable move completion was found.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `hub.test.ts:4710` slow `cubeCleared`; `:5069` invalid completion creates no candidate; `:4844` 999 ms drop. |
| AC-2 | ✅ | `hub.test.ts:4680` fast clear with `elapsedMs: 1000`; `:4888` dropped fast clear; existing threshold boundary test remains green. |
| AC-3 | ✅ | `hub.test.ts:4741` four `fastClear` events then one `levelMilestone` at 5; `:4930` dropped milestone; `activity.ts` `completedLevel % 5` in `recordCompletion`. |
| AC-4 | ✅ | `hub.test.ts:4766` new + duplicate epic; `:5103` rare/failed/guest no candidate; `:5143` in-flight duplicate; `:4956` dropped epic. |
| AC-5 | ✅ | `hub.test.ts:4660` fresh join once, joiner excluded, ring visible to second joiner; `:5171` rejoin records nothing; `:4822` dropped join. |
| AC-6 | ✅ | `hub.test.ts:4802` final grace leave after protocol frame; `:5193` destroy drops buffer; `:5211` no-op removal records nothing; `:4985` dropped leave. |
| AC-7 | ✅ | `hub.test.ts:5231` accepted completion is the sole new-server event, old leave after its protocol frame, `worldEntered` target ring; `:5316` dropped completion adds no new-server event and suppresses the move-in join. |
| AC-8 | ✅ | `protocol.test.ts` "never accepts a client activityEvent frame"; frontend `protocol.test.ts:1567`; `parseClientMessage` default is `bad_message`. |
| AC-9 | ✅ | `activity.test.ts:197` 999/1000 boundary, `:219` ten-candidate sequence, `:242` drop does not move the window; `hub.test.ts:4822`–`:5025` per-type integration drops. |
| AC-10 | ✅ | `activity.test.ts:328` 25 acceptances → ids 25…6 newest first; `:288` per-server `nextId` 1; `hub.test.ts:5391` reconnect ring 26…7. |
| AC-11 | ✅ | `activity.test.ts:412` terminal `clear()`, `:431` no timer; `hub.test.ts:5193` destroy drop; `:5624` nothing after close. |
| AC-12 | ✅ | `protocol.test.ts` exact representative frame + `TypeError` matrix; `metrics.test.ts:532` both allow-lists and 30-metric catalog; `hub.test.ts:5469` encode once, `:5493` exact metrics. |
| AC-13 | ✅ | `hub.test.ts:5391` reconnect eviction; `protocol.test.ts` welcome/worldEntered defensive copy; `session.test.ts:3018` welcome seed. |
| AC-14 | ✅ | `hub.test.ts:5469` one encode and identical text; `:5231`/`:5316` move precedence; `:5569` 39/1 ms removal and 249/1 ms economy windows unchanged. |
| AC-15 | ✅ | `frontend protocol.test.ts:1551`–`:1719` exact frame, valid/invalid parity, legacy welcome, 20/21 array bound; `:1624` invalid matrix. |
| AC-16 | ✅ | `server-state.test.ts:662` welcome seed/replace, `:744` `worldEntered` pending without changing the feed. |
| AC-17 | ✅ | `server-state.test.ts:682` prepend/copy/identity, `:705` 20 cap, `:720` duplicate, `:756` target pending, `:767` swap, `:777` old-server isolation. |
| AC-18 | ✅ | `session.test.ts:3018` real decoder/reducer snapshot; `:3073` target event between `worldEntered` and `applyWorldSwap`. |
| AC-19 | ✅ | `ActivityFeed.test.tsx:79` exact markup/text, `:106` all six sentences, `:115` `2.5s`/`1.0s`, `:121` 5-visible cap, `:145` empty→null; `App.test.tsx:854`. |
| AC-20 | ✅ | `ActivityFeed.test.tsx:150` no live role/focusable; `App.test.tsx:854` exactly one polite/assertive region. |
| AC-21 | ✅ | `ActivityFeed.test.tsx:164` reduced attribute; `App.test.tsx:883`; `game-view.css.test.ts:844`/`:858` 160 ms and both disables. |
| AC-22 | ✅ | `game-view.css.test.ts:802`/`:809`/`:825`/`:864` exact chrome, placement, mobile offset; `ActivityFeed` has no focusable control. |
| AC-23 | ✅ | `hub.test.ts:5431` two-server buffers/ids/fan-out; `server-state.test.ts:731`/`:777` mismatch and old-server isolation; `session.test.ts` wrong-server frame leaves the snapshot unchanged. |
| AC-24 | ✅ | `hub.test.ts:5526` scan restricted to `activityEvent` + `welcome.activity`; token/accountId/email absent and the welcome identity exempt; client catalog unchanged. |
| AC-25 | ✅ | `activity.test.ts:219` five accepted/ten candidates; `hub.test.ts:5316` dropped move adds none; `:5624` no post-close state. |
| AC-26 | ✅ | `docs/architecture/realtime.md` `## Activity feed` before `## Benchmark` with both constants and the contract; `docs/product/glossary.md` `### activity feed`; `docs/features/README.md` untouched; `npm test` links pass; protected diff empty. |
| AC-27 | ✅ | `npm run smoke` → 24/24 with `PASS activity snapshot...` and `PASS activity leave...` (ids 1 and 2). |
| AC-28 | ✅ | Independent lint 0; typecheck 0; backend 36 files/1324 tests; frontend 73 files/2069; coverage backend 96.13/89.58/99.55/96.13 and frontend 96.61/96.31/97.78/96.61; build 0; smoke 24/24; protected files unchanged. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `src/backend/src/app.test.ts:472-474`; `docs/features/live-activity-feed/build-log-T2.md:10,93` | The T2 adaptation of the live-socket A/B/C test is outside T2's `files_owned`, and the log calls it "fixture-only" even though it also pins the hub clock, adds a real `await new Promise(resolve => setTimeout(resolve, 250))` and adds two exact activity assertions. The test is sound and passes, but the real wait is a flakiness risk under load and contradicts the spec's assertion bar ("fake timers/manual clock, never real sleeps"). | Correct the T2 log wording to "test adaptation, not fixture-only" and either replace the 250 ms wait with a deterministic close-observation seam (or a bounded test helper) or record it as a reviewer-approved bounded exception. Keep the exact activity assertions; no production change is required. | open |
| F2 | INFO | `docs/features/live-activity-feed/status.md:7,44` | The loop log records the user's approval of the top-center ticker (`status.md:30`), but the blockers bullet still says `Q-4 — top-center ticker (recommended)`; the frontmatter `updated: 2026-11-15` also trails the 2026-11-16 T5 entries. This is status bookkeeping, not a code or behavior gap. | At acceptance set `state: accepted`, update `updated` to 2026-11-16, and change the Q-4 bullet to approved. No source change. | open |
| F3 | INFO | `docs/features/live-activity-feed/build-log-T5.md:473`; `docs/features/README.md` (untouched) | The T5-proposed feature-index row still says `planning`; the feature is at code review with all tasks complete. The builder correctly left the orchestrator-owned index untouched. | Orchestrator applies the `live-activity-feed` row with the final state (`accepted`) and the acceptance date; do not copy `planning` from the T5 proposal. | open |

## Verification performed

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0.
- `npm test` → exit 0: backend 36 files / 1324 tests; frontend 73 files / 2069 tests.
- `npm run coverage` → exit 0: backend 96.13 statements / 89.58 branches / 99.55 functions / 96.13 lines; frontend 96.61 / 96.31 / 97.78 / 96.61; all ≥ 80; no coverage-config or exclusion diff.
- `npm run build` → exit 0; bundle budget OK; entry `index-D9_xQ_JO.js` raw 94,165 B / gzip 29,033 B; three 609,337/154,323; total 990,656/276,021.
- `npm run smoke` → exit 0, `SMOKE PASS (24/24 checks)`, including `PASS activity snapshot: A's welcome feed is empty and B's welcome carries exactly A's memberJoined event` and `PASS activity leave: A receives the memberLeft activity event...` (memberJoined id 1, leave id 2). The `frontend-prod` service served `index-BC6ZsTxs.js` (the Docker image build); the independent host build emitted `index-D9_xQ_JO.js`; the activity checks are backend/WebSocket and the UI is covered by the SSR/unit suite, so this hash difference is not an AC failure and is noted as an image-vs-host build artifact, not a feature defect.
- Docs: `docs/architecture/realtime.md` has `## Activity feed` before `## Benchmark` with `ACTIVITY_MIN_INTERVAL_MS`, `ACTIVITY_FEED_LIMIT` and `ACTIVITY_MILESTONE_EVERY`; `docs/product/glossary.md` has `### activity feed`; `docs/features/README.md` is untouched; `git diff --exit-code` on `compose.yaml`, `compose.smoke.yaml`, both Dockerfiles and both package files is clean; no new dependency, secret or `.env*` change.
- Changed tests: grep over the feature test diffs found no `expect.any`, `expect.objectContaining`, `toMatchObject`, snapshot-only, `toBeTruthy`/`toBeDefined` stand-ins or argument-free `toHaveBeenCalled()`; the added tests pin exact arrays/objects/text/frames. The one real-sleep exception is F1.
- Scope: the five target commits contain the T1–T5 source/tests/docs; the documented fixture-only deviations (`hub.test.ts` T1 four `activity: []` lines; `App.test.tsx` and `transport.test.ts` T3 one-liners) are additive; the `app.test.ts` T2 adaptation is the F1 MINOR. No production code outside the feature, no compose/Dockerfile/package/README change, and no orchestrator-owned feature-index edit.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | Activity events carry only server-issued ids/name/numbers/catalog `partId`; no accountId/token/email/IP/free text; both decoders enforce the validation matrix and drop unknown fields; per-server fan-out and the reducer `serverId` guard; no `innerHTML`/`eval`; no new dependency/secret/image; no second live region. |
| Quality | ✅ | Pure `activity.ts` over injected time, no timer/per-client queue; one hub authority; encode-once via the existing `broadcast`; immutable snapshot/pending copies; no dead code; docs updated. The F1 test adaptation is the only quality deviation. |
| Testing | ✅ | Coverage ≥ 80 in both workspaces; per-type accepted/dropped cases; move accepted/dropped; ring/reconnect/travel; encode-once; metrics; privacy; batching non-regression; concrete assertions, no banned matchers. F1's real 250 ms wait is a bounded integration-test exception to record. |
| Real-time | ✅ | Server authority, connection lifecycle, rejoin snapshot, per-server isolation, multi-client fan-out, completion-first move and pending-target travel events are all covered by hub/reducer/session tests and the smoke. |
| Containers | ✅ | No new service, image, port, environment variable or compose/Dockerfile change; the feed rides the existing `/ws` on 8080; `podman compose up` remains the single local command; the containerized smoke passes 24/24. |
| Documentation | ✅ | The `realtime.md` contract and glossary match the shipped constants/behavior; `docs/features/README.md` is untouched; README/compose/Dockerfiles/package files unchanged. F2/F3 are acceptance bookkeeping. |
| Out-of-scope edits | ✅ | Only documented additive fixture lines (T1/T3) and the T2 live-socket test adaptation (F1); no assertion was weakened, skipped or removed; no production source outside the feature. |

## Spec-gate follow-up

| Finding | Status | Evidence |
| --- | --- | --- |
| r2 F1 (`memberJoined` "or move-in" / r2 history "except") | ✅ fixed | Current `spec.md:62` says "fresh `join` (move-in suppressed)"; `:258` says "suppresses the move-in join and pins the fresh-join `except`"; the code and `realtime.md` suppress the move-in activity. |
| r2 F2 (`memberLeft` catalog move-out condition) | ✅ fixed | `spec.md:63` now splits the grace-expiry (`left: true` + server alive) and move-out (`moveMember` + `serverHasMembers`) conditions; the hub implements both and the tests cover them. |
| r2 F3 ("completion recorded first" INFO) | ⚠️ non-blocking | `spec.md:67`/AC-7 still say "first"; the plan/code record it after the existing protocol broadcasts as the sole new-server activity candidate. Optional wording cleanup; behavior is correct. |
| r2 F4 (Q-5/Q-6 defaults; `firstId`) | ✅ present | `spec.md:213` states Q-5/Q-6 defaults; `tasks.md:49` defines `firstId` as "the `id` from B's snapshot". |

## Notes / acceptance

- **All 28 ACs are met and independently verified.** No PII, cross-server leak, unbounded memory, second live region, cadence/ring derivation contradiction, unobservable move completion or coverage shortfall was found.
- **Acceptance actions:** set `docs/features/live-activity-feed/status.md` to `accepted` with `updated: 2026-11-16` (and Q-4 approved); add the `live-activity-feed` row to `docs/features/README.md` with `accepted` and the acceptance date; commit this review artifact. No post-acceptance source/config change is required beyond the F1 test-log/exception cleanup.
- **F1 cleanup:** the 250 ms real wait is the only testing deviation; the existing live-socket test is otherwise strengthened with exact activity assertions, and the production behavior is unaffected.
- **Optional UX observation:** the ticker is centered at up to 24 rem while the top-right `UserPanel` can be up to 20 rem; at intermediate widths an open roster can visually meet the ticker. `pointer-events: none` keeps the panel usable and the 720 px offset avoids the phone case; the AC-22 contract is met, so this is polish only, not a finding.
- **No new dependency, service, port, environment variable or secret was added.** The feature is process-memory only, has no feature flag and no persisted data; rollback remains backend-first or frontend-first as documented.
