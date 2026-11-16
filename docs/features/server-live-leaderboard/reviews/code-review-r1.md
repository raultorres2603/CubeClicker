---
feature: server-live-leaderboard
phase: code_review
round: 1
iteration: 1
verdict: approved
reviewed: 2026-11-16
blocking: 0
nonblocking: 4
---
# Code Review — r1

## Summary

✅ approved — 0 blocker, 0 major, 1 minor, 3 info. The 26 ACs are implemented and independently verified: the three session counters increment only at the hub's accepted transitions; guests and accounts share the same `Member.sessionStats` and the snapshot carries no account id, coins, upgrades or economy; ranking is cubes → clicks → slot order with the top five rendered verbatim and totals over all current members; the per-server coalescer publishes one `leaderboardUpdate` at 1000 ms (no per-click or quiet-server frame); `welcome`/reconnect/`worldEntered` carry the snapshot and the reducer handles the travel-window pending target; `dropServer`/`destroy`/`hub.close()` leave no timer; the protocol/parity/validation matrix and the exactly-two metrics allow-list entries are correct; the non-live left-rail panel, reduced-motion and short-viewport rules are in place; and the A/B smoke prints both leaderboard PASS lines. The independent gates pass: lint 0, typecheck 0, backend 37 files/1506 tests, frontend 74 files/2248, coverage 96.19/89.83/99.57/96.19 and 96.63/96.35/97.8/96.63, build 0, smoke 26/26. The one MINOR is the documented `app.test.ts` helper being called "fixture-only" when it is a filter; the INFOs are the counter-increment comment order, the T5 README row still saying `planning`, and the smoke's prod-image bundle hash differing from the independent host build.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `hub.test.ts` "counts only accepted clicks…" (`:5809`) and "increments facesDestroyed…" (`:5868`); `hub.ts:1216` click after `validateExplode`, `:1236` face predicate; invalid/rate-limited/oversized/pre-join return earlier. |
| AC-2 | ✅ | `hub.test.ts` "increments cubesCompleted once…" (`:5912`) and "attributes a completion to the mover…" (`:6120`); `hub.ts:1374` after `isComplete`, the mover’s target entry and old-server totals verified. |
| AC-3 | ✅ | `hub.test.ts` "ranks guests and accounts identically…" (`:5978`); `leaderboard.test.ts` guest/account-identical snapshots (`:272`); the builder/snapshot has no account/economy field. |
| AC-4 | ✅ | Backend and frontend `protocol.test.ts` "never accepts a client leaderboardUpdate frame"; `parseClientMessage` default is `bad_message`. |
| AC-5 | ✅ | `leaderboard.test.ts` top-five/all-member totals (`:171-251`); `hub.test.ts` "publishes top five entries and totals…" (`:6283`, six members, five entries, totals 21). |
| AC-6 | ✅ | `leaderboard.test.ts` cubes→clicks→slot order (`:85-169`), including the fifth/sixth cutoff; `hub.test.ts` top-five order (`:6283`). |
| AC-7 | ✅ | `hub.test.ts` "carries one zero entry in a fresh welcome…" (`:6015`); frontend placement/legacy tests (`protocol.test.ts:2091-2194`) and `server-state.test.ts:1123-1149`. |
| AC-8 | ✅ | `hub.test.ts` mover attribution (`:6120`); `server-state.test.ts` pending/target/old/apply (`:1223-1326`); `session.test.ts` travel chain (`:3261`). |
| AC-9 | ✅ | `leaderboard.test.ts` coalescer 999/1000/t+1001/ten-marks (`:291-407`); `hub.test.ts` "publishes a join snapshot at 999…" (`:6200`) and ten clicks (`:6223`). |
| AC-10 | ✅ | `hub.test.ts` grace retention (`:6059`), quiet/rotate/rejoin (`:6396`), purchase/loot/equip/unequip (`:6420`); the code marks only join/click/completion/removal. |
| AC-11 | ✅ | `hub.test.ts` one encode and identical bytes plus metrics (`:6326`); 40/250 ms paths unchanged (`:6446`). |
| AC-12 | ✅ | `hub.test.ts` two-server isolation/fan-out (`:6351`); `server-state.test.ts` mismatch/old-server travel (`:1212`, `:1287`). |
| AC-13 | ✅ | `leaderboard.test.ts` drop/discard/pending (`:410-475`); `hub.test.ts` destroyed-server timer (`:6522`) and close (`:6562`, `vi.getTimerCount()` 0). |
| AC-14 | ✅ | Backend `protocol.test.ts` builder/validator/exact frame/deep copy/placement absence; the exact frame matches the spec. |
| AC-15 | ✅ | `frontend protocol.test.ts:1886-2194` exact frame, full valid/invalid parity, five-entry bound, server-mismatch, legacy absence; the parity table replays the backend fixtures. |
| AC-16 | ✅ | `metrics.test.ts:546` both allow-lists and the 30-metric catalog; `hub.test.ts:6326` one encoded and per-recipient frames. |
| AC-17 | ✅ | `server-state.test.ts` null seed, welcome deep copy/replace/absent, `worldEntered` pending, `applyWorldSwap` (`:1118-1150`, `:1223-1326`). |
| AC-18 | ✅ | `server-state.test.ts` current/pending update, identical/mismatch references, untouched branches (`:1176-1320`). |
| AC-19 | ✅ | `session.test.ts:3196` exact backend welcome + update through the real decoder/reducer; `:3261` target update during travel + midpoint swap; no engine/scene events. |
| AC-20 | ✅ | `Leaderboard.test.tsx:35` exact SSR markup/rows/totals, `:63` plurals, `:89` five-row cap, `:123` no re-sort, `:143` null/empty; guest/account parity (`:185`). |
| AC-21 | ✅ | `Leaderboard.test.tsx:157` no live role/focusable/timestamp/coin; `App.test.tsx:944` populated panel and exactly one polite/assertive region. |
| AC-22 | ✅ | `Leaderboard.test.tsx:174` reduced attribute; `game-view.css.test.ts:954` 160 ms + both disables. |
| AC-23 | ✅ | `game-view.css.test.ts:885` desktop rail, `:972` mobile 720px below the feed (17 > 10 + 6), `:1000` short-viewport 12vh, `:1010` existing placements unchanged/no `!important`; the spec’s upgrades-clipping/accessibility caveat is documented. |
| AC-24 | ✅ | `hub.test.ts:6482` counters/name only, no accountId/token/coins/economy/upgrades in the frames or welcome snapshot; protocol/UI scans; client catalog unchanged. |
| AC-25 | ✅ | `npm run smoke` 26/26 with `PASS leaderboard join…` and `PASS leaderboard update… A clicks 3, B clicks 0, totals clicks 3`; `realtime.md` `## Live leaderboard` (line 256) with both constants, glossary `### live leaderboard`, `docs/features/README.md` untouched, protected files unchanged. |
| AC-26 | ✅ | Independent lint 0, typecheck 0, backend 37/1506, frontend 74/2248, coverage backend 96.19/89.83/99.57/96.19 and frontend 96.63/96.35/97.8/96.63, build 0, smoke 26/26; no new dependency and the protected files are byte-identical. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `src/backend/src/app.test.ts:939-952`; `docs/features/server-live-leaderboard/build-log-T2.md:10,31,126` | `app.test.ts` is outside T2's `files_owned`; the T2 log calls the change "fixture-only", but `nextWithoutLeaderboard` is a filter helper that skips the additive `leaderboardUpdate` frames in the existing live-socket packing test. The helper keeps every protocol assertion exact and the leaderboard's own wire behavior is covered by the hub suite and smoke, but the ownership/deviation label is inaccurate. | Correct the T2 log to "authorized test adaptation (not fixture-only)" or explicitly record the helper as the plan's allowed `type === 'leaderboardUpdate'` filter. No production or assertion change is required. | open |
| F2 | INFO | `src/backend/src/game/hub.ts:1374`; `spec.md:52`; `plan.md:27` | `cubesCompleted` is incremented before `completedLevel` is captured at `hub.ts:1383`, while the spec metric table/plan say the completed 1-based cube number is captured and then the counter is incremented. The observable snapshot/count is identical (the member's cube is not replaced yet), so this is a comment/order mismatch only. | Optionally move the increment after the `completedLevel` capture or align the spec/plan/comment wording. No behavior change. | open |
| F3 | INFO | `docs/features/server-live-leaderboard/build-log-T5.md:450`; `docs/features/README.md` (untouched) | The T5-proposed feature-index row still says `planning`; the feature is at code review with all tasks complete and the builder correctly left the orchestrator-owned index untouched. | Orchestrator applies the `server-live-leaderboard` row with `accepted` and the acceptance date; do not copy `planning`. | open |
| F4 | INFO | `npm run smoke` output; `docs/features/server-live-leaderboard/build-log-T5.md` | The smoke’s prod frontend served `index-BY3oMfjV.js` (the Docker image build), while the independent host `npm run build` emitted `index-NkhNsjDs.js`. The leaderboard join/update checks are backend/WebSocket and the panel itself is covered by the SSR/unit suite; the hash difference is an image-vs-host build artifact, not an AC failure. | Keep the image/host evidence separate in the acceptance notes; no activity/leaderboard change. | open |

## Verification performed

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0.
- `npm test` → exit 0: backend 37 files / 1506 tests; frontend 74 files / 2248 tests.
- `npm run coverage` → exit 0: backend 96.19 statements / 89.83 branches / 99.57 functions / 96.19 lines; frontend 96.63 / 96.35 / 97.8 / 96.63; all ≥ 80; no coverage-config, exclusion or threshold diff.
- `npm run build` → exit 0; bundle budget OK; entry `index-NkhNsjDs.js` raw 97,263 B / gzip 29,795 B; three 609,337/154,323; total 993,754/276,782.
- `npm run smoke` → exit 0, `SMOKE PASS (26/26 checks)`, including `PASS leaderboard join: A's welcome is a one-entry zero snapshot and B's welcome carries A and B with zero counters and totals` and `PASS leaderboard update: ... A clicks 3, B clicks 0, totals clicks 3`. The `frontend-prod` image served `index-BY3oMfjV.js`; the independent host build emitted `index-NkhNsjDs.js` (F4).
- Docs: `docs/architecture/realtime.md` has `## Live leaderboard` at line 256 before `## Benchmark` at 398, with `LEADERBOARD_INTERVAL_MS`, `LEADERBOARD_TOP_LIMIT` and the full contract; `docs/product/glossary.md` has `### live leaderboard` between `key` and `lootbox`; `docs/features/README.md` is untouched; `git diff --exit-code` on `compose.yaml`, `compose.smoke.yaml`, both Dockerfiles and both package files is clean; every new relative link resolves.
- Tests: the changed-test diff has no `expect.any`/`objectContaining`/`toMatchObject`/snapshot-only/`toBeTruthy`/`toBeDefined`/argument-free `toHaveBeenCalled()` usage; the added tests pin exact arrays/objects/text/frames. The `app.test.ts` helper is the one documented test adaptation (F1).
- Scope: the five target commits contain the T1–T5 source/tests/docs; the documented fixture-only `App.test.tsx` (`leaderboard: null`) and the T2-owned hub-test filters are additive; `app.test.ts` is outside T2's `files_owned` and is a helper filter, not a fixture-only line (F1). No production code outside the feature and no orchestrator-owned README edit.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | Only server-issued ids/names and integer counters; no accountId/token/email/coins/upgrades/economy/free text in any snapshot; per-server fan-out and reducer guard; both decoders validate the full matrix; no `innerHTML`/`eval`; no new dependency/secret/image; no second live region. |
| Quality | ✅ | Pure `leaderboard.ts` ranking/coalescer over injected timers; one hub authority; no cached snapshot; encode-once via the existing `broadcast`; cleanup on destroy/close; no dead code. F2 is a comment/order nuance. |
| Testing | ✅ | Coverage ≥ 80 in both workspaces; unit ranking/coalescer/protocol, hub integration, frontend reducer/session/UI/CSS, and the A/B smoke; concrete assertions, exact frames and no banned matchers; the leaderboard’s own wire behavior is covered independently. F1’s helper is documented but mislabeled. |
| Real-time | ✅ | Server authority; accepted-only increment points; grace retention; counters follow the mover; rejoin/welcome; target travel-window replacement; per-server isolation; 1 Hz coalescing and no per-click frame. |
| Containers | ✅ | No new service/image/port/environment variable; the frame rides the existing `/ws` on 8080; compose/Dockerfiles/package files unchanged; `podman compose up` remains the single local command; the smoke passes 26/26. |
| Documentation | ✅ | `realtime.md` and the glossary match the shipped counters/ranking/coalescing/snapshot/accessibility; the feature index is untouched; the README row is an acceptance action (F3). |
| Out-of-scope edits | ✅ | Documented `App.test.tsx` fixture line and T2 hub-test filters; the only broader adaptation is the documented `nextWithoutLeaderboard` filter (F1); no assertion weakened or removed; no production source outside the feature. |

## Previous round verification

| Finding | Status | Evidence |
| --- | --- | --- |
| Spec-review r2 F1 (status/checkpoint/coins) | ✅ fixed | `status.md:41-44` now lists Q-1 ranking, Q-2 coins excluded, Q-3 move/grace and Q-4 placement, all approved; Q-5…Q-14 defaults; no coin total. |
| Spec-review r2 F2 (Q numbering/Q-8/Q-15) | ✅ fixed | The spec/plan/status use Q-1…Q-14 consistently; Q-8 is multi-tab and there is no duplicate or Q-15. |
| Spec-review r2 F3 (AC-23 short-viewport) | ✅ fixed | `spec.md:162`/`:224` and `game-view.css`/`game-view.css.test.ts` pin the `(max-width: 720px) and (max-height: 600px)`/12vh cap, the HUD/banner/feed/user no-overlap and the retained DOM/accessibility content. |
| Spec-review r1 F1/F2/F3 | ✅ fixed | The status/Q list, the counter definitions and the AC-23 wording are consistent; the code follows the current spec. |
| Code-review r1 | — | First code gate for this feature. |

## Acceptance actions

- Set `docs/features/server-live-leaderboard/status.md` to `state: accepted` with `updated: 2026-11-16` and the existing approved Q-1…Q-4 values; the status is currently `code_review`.
- Add the `server-live-leaderboard` row to `docs/features/README.md` with `accepted` and the acceptance date (the T5 proposal says `planning`; do not copy that).
- Commit this review artifact.
- Optional cleanup: correct the T2 log’s “fixture-only” label for the `app.test.ts` helper (F1); align the `handleCompletion` counter comment/order with the spec/plan (F2); keep the F4 image-vs-host bundle note in the acceptance evidence.
- No source, test, spec, plan, tasks, status, docs or container/package file was edited by this review; only `docs/features/server-live-leaderboard/reviews/code-review-r1.md` was written. No new dependency, service, port, environment variable or persistence was introduced; coins are not ranked, guests and accounts share the same counters, there are no per-click frames, no cross-server/global state, no PII and no second live region.
