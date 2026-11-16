---
feature: presence-and-activity-liveness
phase: code_review
round: 1
iteration: 1
verdict: changes_requested
reviewed: 2026-11-16
blocking: 1
nonblocking: 4
---
# Code Review — r1

## Summary

❌ changes requested — every executable gate was reproduced green (lint, typecheck, both test suites, coverage ≥ 80 in all four metrics per workspace, build, frontend-prod image build, smoke 28/28, protected-file diff), and AC-1…AC-23 appear met on independent code/test inspection. The sole blocking defect is repository state: the approved feature artifacts (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/`) are untracked, so the committed `docs/architecture/realtime.md` contains a relative link to a file that does not exist on a clean checkout and the approved spec is absent from version control. One tracking commit plus three small fixes closes the gate.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `hub.test.ts` `removes the member immediately on leave, closes the peer and leaves no grace timer (AC-1)`: B gets exactly one `memberLeft(left)` then the activity event; A gets `[]`; `closeCalls === 1`; timers 3→2 (`vi.getTimerCount()`); gauges `members_active` 1 / `servers_active` 1; no second `memberLeft` after one full grace. |
| AC-2 | ✅ | `hub.test.ts` `keeps the accepted grace and resumes identity, cube and counters on rejoin (AC-2)` (no `memberLeft` before the deadline; at grace−1 same `playerId`/server/position/`removedIds`, roster `[A,B]`, `leaderboard.entries` `p1 clicks 54` / `p2 clicks 0`, `totals.facesDestroyed 6`) and `finalizes an unrejoined abrupt close exactly at the grace deadline and frees the slot (AC-2)` (exactly one `memberLeft(left)` + activity at `t + 30 000`). |
| AC-3 | ✅ | `hub.test.ts` `fails rejoin after leave and creates a fresh member in the freed slot (AC-3)`: two `resume_failed` errors; the following `join` creates `p3` / `Player 3` at A's slot-1 position with a new token and roster `[p3,p2]`. |
| AC-4 | ✅ | `hub.test.ts` `destroys the last member server immediately on leave and starts no grace (AC-4)` (timers 2→0, gauges 0/0, one peer close, no frames, token fails, next join server 2) and `keeps an abruptly closed last member server alive through the grace window (AC-4)`; `activity.test.ts` unchanged `dropServer`/`clear` ring-teardown tests. |
| AC-5 | ✅ | `hub.test.ts` `rebuilds roster and leaderboard inputs from the surviving members after leave (AC-5)`: next coalesced update exactly `[p2]` with zero totals; C fills slot 1; `welcome.roster` exactly `[p3,p2]` in slot order; C's position equals A's old slot; `welcome.leaderboard.entries` exactly `[p3,p2]`; `server-state.test.ts` `memberLeft` reducer removal green. |
| AC-6 | ✅ | `hub.test.ts` `leaves only the sending tab and keeps the account other tab playing (AC-6)`: only `p1` leaves; tab 2 stays open/joined; one `p2 alice` row with zero totals; tab 2's accepted `explode` is broadcast. |
| AC-7 | ✅ | `session.test.ts` `pagehide leave (AC-7)` block: exactly one `{"type":"leave"}` after welcome (real transport, exact frames); bfcache/pre-welcome/disconnected/dispose/escaped-callback silence; throwing socket records only the leave attempt and teardown still clears every timer. `browser-env.test.ts` pins the `pagehide` subscription, strict `persisted` forwarding and exact listener removal. |
| AC-8 | ✅ | `protocol.test.ts` in both workspaces: exact fixture, extra-field dropping (forged `playerId`), re-encode exactly `{"type":"leave"}`, malformed/unknown/`memberLeft` frames `bad_message`; `hub.test.ts` `rejects leave from a connection that never joined and removes nothing (AC-8)` returns exactly `error not_joined`. |
| AC-9 | ✅ | `metrics.test.ts` accepted `leave` series and unchanged catalog count (30), encoded/frames list excludes `leave`; `hub.test.ts` `counts the leave frame and the client close reason exactly once (AC-9)`: received `leave` 1, `members_active` 1, `servers_active` 1, `ws_connections_open` 1, closed `reason="client"` 1. |
| AC-10 | ✅ | `protocol.test.ts` (backend) `keeps the representative welcome frame byte-identical (AC-10)`; frontend `server catalog unchanged by leave and the TTL (AC-10)` (`leave` as a server frame is `bad_message`, presence/connected fields dropped); feature diff adds only the TTL constant, the client union variant, the decoder case and the metrics label — no `ServerMessage`/`MemberState`/`LeaderboardSnapshot`/`ActivityEvent`/placement change, no version bump. |
| AC-11 | ✅ | `activity.test.ts` `pins the 5000 ms activity eligibility TTL`, `serves an event at 4999 ms and expires it at exactly 5000 ms`, and the independent-events snapshot at 6000; both `protocol.test.ts` mirrors pin `ACTIVITY_EVENT_TTL_MS === 5000`. |
| AC-12 | ✅ | `activity.test.ts` `keeps the 20 newest events newest first with a long TTL seam` (`ttlMs: 1_000_000`, ids `[25…6]`), `serves exactly the five freshest events at 24 000 and keeps advancing ids` (`[25,24,23,22,21]`, next acceptance id 26), `prunes the expired tail without moving nextId or lastAcceptedAt`; unchanged 1 s gate/drop and `dropServer`/`clear` tests. |
| AC-13 | ✅ | `hub.test.ts` `carries only unexpired events on welcome across the 4999/5000 boundary (AC-13)` (both at 4999; only the 1000 event at exactly 5000; `[]` on a fresh join at 6000) and `carries only the target server unexpired events on worldEntered (AC-13)`; rejoin ring test asserts `[26,25,24,23,22]`. |
| AC-14 | ✅ | Unchanged `hub.test.ts` encode-once test (one `JSON.stringify` per accepted event, identical bytes to every recipient); `session.test.ts` `expires a live event exactly 5000 ms after local receipt (AC-14)` (present at 4999, absent after the 5000 tick). |
| AC-15 | ✅ | `activity-lifetime.test.ts` `expires the current feed at 5000 and the pending feed at 6000/8000, then the swap carries only e3` (0/1000/3000/5000/6000/7000/8000 timeline, untouched-branch `toBe` identity); `session.test.ts` equivalent travel test through the real engine/reducer/`applyWorldSwap`. |
| AC-16 | ✅ | `activity-lifetime.test.ts` `preserves the remaining lifetime of a re-seeded event and anchors a new id at its own receipt` and `session.test.ts` `keeps the remaining lifetime across a same-server rejoin and anchors new ids at receipt (AC-16)`: e1 present at 4999, absent at 5000, not extended to 9000; new id expires at 9000; no pending swap. |
| AC-17 | ✅ | `activity-lifetime.test.ts` `filters a locally expired key from a 5001 re-seed synchronously, before any tick`; `session.test.ts` `filters a locally expired re-seed synchronously on the next reduction, before any tick (AC-17)`: immediately after the 5001 `welcome` (no timer advanced) the feed is `[]` and every publish on that reduction is `[]`; stale-server keys dropped; `size()` bounded to 0 after the window. |
| AC-18 | ✅ | `activity-lifetime.test.ts` `pins the 250 ms fallback prune cadence`; `session.test.ts` one interval per online attach cycle and `getTimerCount()` 1→0 on dispose, no publish while nothing expires, visibility resume prunes before the next frame, no callback/publish/state after dispose; `server-state.test.ts` `pruneActivity (AC-15, AC-18)` pins same-reference no-ops and per-branch identity. |
| AC-19 | ✅ | No `src/ui`/CSS file in the feature diff; `ActivityFeed.test.tsx` (7), `App.test.tsx` (50) and `game-view.css.test.ts` (58) are green unchanged in the reproduced frontend run (single live region, no exit animation, reduced-motion entry untouched). |
| AC-20 | ✅ | The nine pinned `grep -F` checks pass; `realtime.md` has `## Presence and explicit leave` and `### Lifetime` with `ACTIVITY_EVENT_TTL_MS`; `observability.md` lists `leave`, states the explicit-leave `members_active` behavior and corrects the encoded/frames rows; `frontend-rendering.md` records page lifecycle and `ACTIVITY_EXPIRY_TICK_MS`; `glossary.md` adds `### presence` and updates the activity-feed/server-member terms; the relative-link check exits 0 against the working tree; `README.md`, `containerization.md` and `docs/features/README.md` are unchanged (index row proposed only). See F1 for the committed-tree caveat. |
| AC-21 | ✅ | `git diff --exit-code -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json` exits 0 with no output; the smoke's `hello` check proves `GET /ws` on the existing port remains; no new service/image/port/env/health signal. |
| AC-22 | ✅ | Reproduced smoke: `SMOKE PASS (28/28)`; B's abrupt close unchanged at 1002 ms (≥ 900); D's explicit leave 0 ms (< 900); E's `welcome.roster` exactly `[A, E]` in D's freed slot 2; existing activity-`memberLeft` check unchanged; no new fixed 5 s wait. |
| AC-23 | ✅ | Reproduced independently: lint 0, typecheck 0, backend 1537 tests / frontend 2301 tests / 0 failures, coverage backend 96.2/89.92/99.57/96.2 and frontend 96.68/96.43/97.85/96.68 (all ≥ 80), build 0 (`Bundle budget OK.`), smoke 0; no assertion weakened and no coverage exclusion/threshold added. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | **MAJOR (blocking)** | `docs/architecture/realtime.md` § Presence and explicit leave; feature folder tracking | The committed doc links to `../features/presence-and-activity-liveness/spec.md`, but `spec.md`, `plan.md`, `tasks.md`, `status.md` and `reviews/` are untracked (`git ls-files` lists only `build-log-T1…T9.md`). On a clean checkout of the branch the relative link is broken and the approved spec/plan/tasks/reviews are absent from version control; the T8 link check only passed because the files exist in the working tree. | Include `spec.md`, `plan.md`, `tasks.md`, `status.md` and `reviews/` in the final tracking commit (or remove/adjust the committed doc link until they are tracked). No source change required. | open |
| F2 | MINOR | `docs/features/presence-and-activity-liveness/build-log-T9.md` § Task-board and build-log audit | The log says T9 remains `[>]` and that `tasks.md`/`status.md` are orchestrator-owned/not yet closed, while the current `tasks.md:84` has `status: [x]` for T9 and `status.md:57-58` records building → code_review. The raw evidence is valid; only the task-state wording is stale. | Reconcile the T9 log wording with the final task/status state when the artifacts are tracked. | open |
| F3 | MINOR | `docs/features/presence-and-activity-liveness/build-log-T2.md:188` | `git diff --check main...HEAD` exits 2 with `new blank line at EOF`; the T9 log records this as a known non-blocking nit. | Remove the trailing blank line in the tracking/docs commit. | open |
| F4 | MINOR | `src/backend/src/game/hub.ts:899`, `:985` | `handleLeave` sets `connection.closeReason = 'client'` but leaves the connection heartbeat interval running until `handleClose`. If the peer's close event were delayed past a heartbeat tick, `terminate(connection, 'heartbeat')` would overwrite the reason to `'heartbeat'` before `cubeclicker_ws_connections_closed_total` increments, mislabeling a deliberate leave. The plan's F14 accepts a heartbeat may run until its next tick, but not the close-reason overwrite. | Clear the heartbeat in `handleLeave` (without adding a new shutdown path) or add a test/comment that explicitly accepts the delayed-close race. | open |
| F5 | INFO | `docs/features/presence-and-activity-liveness/spec.md:4` | The approved r3 spec frontmatter still declares `status: draft`. | Align the artifact metadata (e.g. approved) when the spec is tracked. | open |

## Verification performed

| Command / check | Result |
| --- | --- |
| `npm run lint` | exit 0; no diagnostics |
| `npm run typecheck` | exit 0; both workspaces (`tsc --noEmit`) |
| `npm test` | exit 0; backend 37 files / 1537 tests, frontend 75 files / 2301 tests; 0 failures |
| `npm run coverage` | exit 0; backend 96.2 statements / 89.92 branches / 99.57 functions / 96.2 lines; frontend 96.68 / 96.43 / 97.85 / 96.68 (all ≥ 80) |
| `npm run build` | exit 0; `tsc` + `vite build` + `Bundle budget OK.` (same hashes as the T9 log) |
| `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod` | exit 0; image `1c708e05e08ffa95f9b72f440a18fea128777cd54aa057a3c7a56368301021ed` (fully cached; equals the running `frontend-prod` image) |
| `npm run smoke` | exit 0; `SMOKE PASS (28/28)`; abrupt close 1002 ms; explicit leave 0 ms; slot reuse roster `[A, E]` |
| `git diff --exit-code -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json` | exit 0; no output (protected files byte-unchanged) |
| Config/coverage audit | no Vitest, ESLint, tsconfig, package or compose file in the feature diff; exclusions remain test files + the one composition-root entrypoint per workspace; thresholds unchanged at 80 |
| Banned-matcher audit of added test lines | no `expect.anything/any/objectContaining/arrayContaining/stringContaining/stringMatching`, no snapshots, no `toMatchObject`, no argument-unchecked `toHaveBeenCalled()`, no assertion-free tests |
| T8 doc greps (9 checks) | all OK (`## Presence and explicit leave`, `### Lifetime`, `ACTIVITY_EVENT_TTL_MS`, the three observability sentences, `pagehide`, `ACTIVITY_EXPIRY_TICK_MS`, `### presence`) |
| Relative-link check (`node -e`, four edited docs) | exit 0 against the working tree (clean-checkout caveat = F1) |
| `git diff --exit-code -- README.md docs/architecture/containerization.md docs/features/README.md` | exit 0; index row absent, as expected (orchestrator-owned) |
| `git diff --check main...HEAD` | exit 2 — `build-log-T2.md:188: new blank line at EOF` (= F3) |
| Task board / logs | T1–T9 `[x]` in `tasks.md`; every build log contains raw verify output; T2 records the pre-T3 red run (5 hub expectations, `hub.test.ts` welcome TTL) and the post-T3 green re-verification on `5b678e1` (backend 1537 tests, coverage 96.2/89.92/99.57/96.2) |
| Repo state | `git status --short` shows the feature artifacts untracked; `git ls-files` lists only the build logs (= F1) |

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | `leave` has no payload; extra/forged fields are dropped by the decoder; only the sender's own member is removed; non-joined connections get `not_joined`; no secrets, dependency, route or storage added; inbound frames remain shape-validated; server-authoritative presence/activity. |
| Quality | ❌ | Product code and tests pass every check, but the committed tree has a broken documentation link / untracked approved artifacts (F1) and a stale T9 log (F2). F3/F4 are small hygiene defects. |
| Testing | ✅ | Coverage ≥ 80 in all metrics per workspace, no exclusions/threshold changes, concrete-value assertions, no banned matchers, no useless tests, every AC has direct evidence; AC-19 UI suites green unchanged. |
| Real-time | ✅ | Connection lifecycle unchanged for abrupt close; explicit leave is self-only and server-authoritative; multi-client leave/rejoin/travel tested with fake peers/fake timers; reconnect resync and single-owner transport preserved. |
| Containerized delivery | ✅ | Single-command run preserved; protected compose/Dockerfile/package files byte-unchanged; prod frontend image rebuilds from the repository; smoke proves the WebSocket path end-to-end. |
| Documentation | ❌ | T8 pass is complete and accurate in the working tree, but the committed link targets an untracked file (F1); `docs/features/README.md` is correctly left to the orchestrator. |

## Previous round verification

Not applicable — first code-review round.

## Notes / backlog (non-blocking)

- T1/T2/T4/T5 record a documented integration-tier exception (T3 hub suite, T6 session suite, T7 containerized smoke); the evidence is present and green.
- The feature index row is proposed in `build-log-T9.md` and not applied; this is the only expected index gap.
- `spec.md:4` still says `status: draft` (F5, INFO).
- No new dependency, secret, `.env*`, coverage exclusion or threshold change; no production code excluded from coverage.

## Verdict

**changes_requested** — AC-1…AC-23 are met and every executable gate is reproducible. The only blocking item is F1: the feature artifacts must be tracked in the final commit (or the committed doc link adjusted) so a clean checkout contains the approved spec and a valid link. After the tracking commit and F2–F4, the feature is ready for r2 approval.
