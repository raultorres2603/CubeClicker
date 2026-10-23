---
feature: multiplayer-servers
kind: code
iteration: 2
verdict: approved
blocking: 0
---

# Code review — multiplayer-servers — iteration 2

Reviewer: independent code gate. Scope: `main` @ `f04f14d` (r1 baseline `c2cb025`;
corrective commits `c96b3dd` T5b, `1babb4e` T17b, `ab31888` T15b, `8bc1159` docs errata)
against `spec.md` (27 ACs), `plan.md`, `tasks.md`, `status.md`, the r1 review, and the
corrective build logs. No source, test, spec, plan, tasks, status or build-log file was
edited; this review file is the only write. Builder logs were treated as claims and every
gate below was reproduced directly.

## 1. Summary

**Approved.** All 27 ACs are met on reproduced evidence, and all eleven r1 findings
(F1–F11) are closed. The two r1 blockers are fixed at the right layer: the frontend now
adopts the authoritative cube exactly (including level/grid/style changes and tile
restores) and releases a held `nextLevel` travel on resume; the backend now converges
rebalancing after every executed move and enforces a true trailing-second limiter.
`npm run smoke` passes 8/8 twice, on a cold and on a warm stack.

Four residual items are non-blocking: one narrow UI-state MINOR, one coverage MINOR,
and two INFO notes. No open BLOCKER or MAJOR remains.

## 2. Verification evidence (independently run)

| Command | Result |
| --- | --- |
| `npm run lint` | exit 0, no diagnostics |
| `npm run typecheck` | exit 0, both workspaces |
| `npm test` | exit 0 — **810/810 tests** (backend 188 across 7 files, frontend 622 across 28 files) |
| `npm run coverage` | exit 0 — backend **98.51 / 97.16 / 100 / 98.51**; frontend **99.01 / 98.28 / 99.28 / 99.01** (statements / branches / functions / lines) |
| `npm run build` | exit 0 — initial JS gzip **216.71 KB** (pinned budget 350 KB) |
| `npm run smoke` (run 1, cold) | **SMOKE PASS (8/8)** — server ids 1/2, grace leave observed after 1001 ms |
| `npm run smoke` (run 2, warm) | **SMOKE PASS (8/8)** — server ids 3/4, grace leave observed after 1001 ms |

Coverage files inspected: both workspaces exclude only the composition entrypoints
(`src/server.ts`, `src/main.tsx`) plus test files; every other production file is counted
(`all: true`) and all four thresholds remain pinned at 80. No production code was excluded
and no threshold was lowered.

No banned matcher (`toHaveBeenCalled*` is used only for listener-count assertions in
pre-existing session tests, not as behaviour proxies in the changed tests), no
snapshot-only and no assertion-free test was found in the changed test files. The changed
tests assert concrete values (ids, slots, levels, grids, styles, exact frames, exact
timings).

## 3. Per-AC verdict table

| AC | Verdict | Evidence |
| --- | --- | --- |
| **AC-1** — Server at boot | **Met (with note)** | `servers.test.ts` › “starts empty: no server exists before the first join”; `app.test.ts` › healthz returns 200 with the pinned body. No direct healthz→`serverCount` cross-assertion exists because the hub exposes no count; the healthz handler does not touch the hub. |
| **AC-2** — Fill to X, then overflow | **Met** | `servers.test.ts` › fill/overflow fixtures; `hub.test.ts` › “overflows into the next fresh server and keeps broadcasts server-scoped”; smoke check `multiplayer join`/`overflow` (X = 2, server 2). |
| **AC-3** — Destruction / never reuse | **Met** | `servers.test.ts` › “destroys an emptied server and never reuses its id”; `hub.test.ts` › grace-expiry destruction and the three-server live sequence (server 2 destroyed, next join creates server 3). |
| **AC-4** — In-memory lifecycle | **Met** | `app.test.ts` › “keeps each app build independent (in-memory lifecycle, AC-4)”; no persistence import or write path in the changed source. |
| **AC-5** — Config bounds | **Met** | `config.test.ts` pinned defaults, range boundary cases (2/10/24 accepted; 1/25 rejected) and grace boundaries 999/1000/600000/600001. |
| **AC-6** — Ephemeral identity, no storage | **Met** | `players.test.ts` token shape/uniqueness; `transport.test.ts` storage traps assert zero storage touches; token held in memory only. |
| **AC-7** — Grace and reconnect | **Met** | `players.test.ts` grace boundaries; `hub.test.ts` in-window roster retention, exact-deadline removal, resume at deadline and before-deadline reschedule. |
| **AC-8** — Display names | **Met** | `players.test.ts` id/name counter; hub move sequences assert `Player N` names in the target roster and `memberJoined`. |
| **AC-9** — Join assignment | **Met** | `servers.test.ts` lowest-id free slot, gap skipping, refilled-hole rejoin. |
| **AC-10** — Move plan / execution at completion | **Met** | Pinned plan fixtures in `servers.test.ts` (corrected §4 semantics); plan recomputed after every executed move (`hub.ts:533-536`); `app.test.ts` › “packs three servers after each completion over live sockets (X = 2, AC-10, F3)”; strictly-lower targets and no oscillation. |
| **AC-11** — Lone-user merge (X = 2) | **Met** | `hub.test.ts` › “merges a lone server-2 member into server 1 when they complete (X = 2, AC-11)”: `worldEntered` on server 1, server 2 destroyed, next join gets server 3. |
| **AC-12** — Client-visible move effect | **Met** | `server-state.test.ts` pending swap + reduction; `session.test.ts` midpoint `worldEntered` swap; `scene.test.ts` move-at-midpoint and single world swap. |
| **AC-13** — World layout, remote cubes, picking isolation | **Met** | `servers.test.ts` ring positions for X = 10 and X = 2; `world.test.ts` one view per member at exact slot, remote mini-cube events/disposal, ray resolving null through remote cubes. |
| **AC-14** — Server-authoritative board, optimistic play | **Met** | Broadcast/validation matrix (`hub.test.ts`, `cubes.test.ts`); exact two-way adoption via `engine.adoptCubeState` (`engine.ts:986-1039`) and `session.reconcileCube` (`session.ts:348-361`), including locally-ahead removal, missing-tile restore, different level/grid/style, and no stat rollback; true trailing-second limiter (`hub.ts:484-498`) with 30/1000 ms boundary and one-error-per-window tests (`hub.test.ts:697-803`, live socket rate test in `app.test.ts`). |
| **AC-15** — Completion validation and server-drawn levels | **Met** | `cubes.test.ts` `allIds` 54/294, pinned draws/style cycle, N²−1 vs N²; `hub.test.ts` advance-in-place and invalid completion/wrong level → `invalid_completion` + `stateSync`. |
| **AC-16** — Users on Server button and panel | **Met** | `UserPanel.test.tsx` exact toggle/panel labels, disabled own row, `Player 2 · Cube 2` rows, slot order; now gated on a welcomed world (F7). |
| **AC-17** — Spectate travel and view-only mode | **Met** | `spectate-travel.test.ts` pinned pose tables; `spectate.test.ts` state machine and second-selection refusal; `engine.test.ts` gameplay input ignored while spectating; `scene.test.ts` flight rendering. |
| **AC-18** — Return to my cube | **Met** | `UserPanel`/`App` render `Return to my cube` exactly while spectating; `spectate.test.ts` transitions; `session.test.ts` flight home and play resumption. |
| **AC-19** — Spectate edge cases (a–e) | **Met (with note)** | (a/b) `spectate.test.ts` `onMemberLeft`; (c) session test keeps viewing when the target’s cube advances; (d) resume resets mid-flight spectate; (e) `world.test.ts` remote removal. Note: the new-identity reconnect while spectating combination is not covered and keeps the stale spectate gate (residual N1, MINOR). |
| **AC-20** — Catalog and hello-first | **Met** | `app.test.ts` hello-first per concurrent client; `hub.test.ts` attach sends nothing, `not_joined`, `bad_message` malformed/oversized; `MAX_CONNECTIONS` now checked **before** `hello` (`app.ts:98-110`); codec parity tests. |
| **AC-21** — Heartbeat | **Met** | `hub.test.ts` ping every 30 s, terminate on second missed pong, pong reset, late pong keeps the socket. |
| **AC-22** — Connection states and offline behavior | **Met** | Four exact banner statuses; token/resume transport tests; input gate until welcome; board equality via exact adoption in both directions; completion-window resume releases the held `nextLevel` (`session.test.ts:1988-2055`). |
| **AC-23** — Intro after welcome; HUD server line | **Met** | `session.test.ts` intro held until welcome then adopts the server grid/slot; `Hud.test.tsx` exact `Server <id>`; `App.test.tsx` shell. Pre-welcome HUD is gated/neutral (F7). |
| **AC-24** — No weakening | **Met** | **810/810** green; lint/typecheck clean; coverage above 80 on all four metrics in both workspaces; build gzip 216.71 ≤ 350 KB; supersession-ledger tests remain green; no banned or snapshot-only tests. |
| **AC-25** — Containerization impact | **Met** | No Dockerfile, service, port, healthcheck or README change; only the documented compose passthrough/overrides; backend `/ws` remains on 8080 and the frontend connects to it. |
| **AC-26** — Extended container smoke | **Met** | Reviewer ran `npm run smoke` twice: 8/8 cold (server 1/2) and 8/8 warm (server 3/4), each with hello-first, two joins, overflow, ack+broadcast, and a 1001 ms grace leave. |
| **AC-27** — Glossary terms | **Met** | `docs/product/glossary.md`: **game server** (line 33), **server member** (line 68), **spectating** (line 73), extended **cube world position** (line 25); stale `cube level` parenthetical removed (line 20). |

**Summary:** 27/27 ACs met. No AC is unmet or unable to verify.

## 4. Previous-round findings (r1)

| Finding | Status | Evidence |
| --- | --- | --- |
| **F1** — BLOCKER — reconciliation could not restore local-ahead tiles or adopt a different level/grid | **Fixed** | `engine.adoptCubeState` (`engine.ts:986-1039`) computes the authoritative board and rebuilds/replays on level, grid, style or restore; `session.reconcileCube` (`session.ts:348-361`) delegates to it for welcome and `stateSync`. Tests: 7 adoption cases in `engine.test.ts` (removal, restore, different level/grid/style, held travel, idempotence) and real-engine session tests including locally-ahead restore, different-level `stateSync`, and fresh level-0 join after `resume_failed`. Stats are never rolled back. |
| **F2** — BLOCKER — resume during the `nextLevel` hold stranded the client | **Fixed** | `releaseAuthorityTravel` (`engine.ts:773`) is invoked by `adoptCubeState` (`:1035`); `handleWelcome` reconciles the authoritative cube before publishing (`session.ts:405`). `session.test.ts:1988-2055` drops after the sixth-face clear, resumes with level 1, and asserts `playing`, no travel, 4×4 board, and live play. |
| **F3** — MAJOR — plan not recomputed after an executed move; §4 convergence failed with ≥3 servers | **Fixed** | `hub.ts:533-536` recomputes immediately after a successful `moveMember`; `app.test.ts` live three-server sequence asserts the remaining donor is planned and moved at its own completion; no oscillation (strictly lower ids). |
| **F4** — MAJOR — fixed-window limiter | **Fixed** | Deque of admitted timestamps (`hub.ts:484-498`), evicts `≤ now − 1000 ms`, drops the 31st in any trailing second, and sends `rate_limited` at most once per trailing second. Boundary tests at 30/999/1000 ms and live-socket rate test. |
| **F5** — MINOR — cap enforced after `hello` | **Fixed** | `app.ts:98-110` checks `hub.hasCapacity()` before sending `hello` and closes without hello; `hub.attach` keeps the backstop (`hub.ts:581-587`). `app.test.ts` pins the order. |
| **F6** — MINOR — donors taken in slot order, not join order | **Fixed** | `JoinSequence` tracked in the registry (`servers.ts:253-299`), donors sorted by it (`:176-186`), tests for refilled holes and join-order donors. |
| **F7** — MINOR — Users panel / `Server 0` visible before welcome | **Fixed** | `welcomed = world.serverId > 0`, pre-welcome HUD is neutral/stats-only, `UserPanel` gated (`App.tsx`, `UserPanel.tsx`); SSR tests updated. |
| **F8** — MINOR — smoke not idempotent on a warm backend | **Fixed** | `smoke.mjs` derives ids from the observed first `welcome`, drains at end of run; reviewer reproduced 8/8 on cold and warm stacks. |
| **F9** — MINOR — glossary `cube level` stale parenthetical | **Fixed** | `docs/product/glossary.md:20` no longer claims online occupancy is a future feature. |
| **F10** — MINOR (spec defect) — AC-10 fixture text contradicted itself | **Fixed** | `spec.md:188` and `tasks.md` now use the §4 free-slot fixtures `[1: X−1, 2: 1] → {p2: 1}`, `[1: X−2, 2: 2] → {p2: 1, p3: 1}`, `[1: X, 2: 1] → {}`. |
| **F11** — INFO — T5 prose said the hub sends `hello` | **Fixed** | `tasks.md:77` now states the `/ws` route sends the retained `hello`, then attaches. |

## 5. Findings

No open BLOCKER or MAJOR. Residual findings only:

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| **N1** | MINOR | `src/frontend/src/game/session.ts:396-404` | On a fresh-identity reconnect (drop while spectating → `resume_failed` → new `join`), `handleWelcome` resets `spectate`/`engine.setSpectating(false)` only when `previousSelfId === message.playerId`; the new identity can therefore retain the stale spectate `viewing` state and the input gate until the user presses “Return to my cube”. Recoverable and visually reset by `enterWorld`, but no test covers this combination. | Reset client-local spectate state on every welcome (or on `resume_failed`), and add a spectating → new-identity welcome test. | open (non-blocking) |
| **N2** | MINOR | `src/frontend/src/game/engine.ts:811-812` | The `faceCleared` replay branch after a rebuild is uncovered by tests (the non-rebuild `faceCleared` path is covered; the rebuild replay path is not). Coverage remains 99.01/98.28/99.28/99.01, above the bar. | Add one engine test that adopts a rebuilt board whose cleared face still needs replay and asserts the face-clear effect/state. | open (non-blocking) |
| **N3** | INFO | `docs/features/multiplayer-servers/status.md:35` | T15b is still marked `[>]` although T15b and the errata commit are complete and this gate is r2. Process artifact only. | Mark T15b `[x]` and log the r2 review result when the orchestrator closes the loop. | open (non-blocking) |
| **N4** | INFO | Review scope | Manual browser/WebGL rendering was not exercised by the reviewer; SSR tests, fake renderers and the smoke container cover markup, wiring and protocol. | Retain the documented manual visual pass as a residual check; no code action. | open (non-blocking) |

## 6. Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | Server-authoritative board, 30/s trailing limiter with one-error cadence, `MAX_CONNECTIONS` before `hello`, `MAX_MESSAGE_BYTES` receive cap, ephemeral in-memory tokens (no storage), malformed/unknown/oversized frames rejected, broadcasts server-scoped, no secrets, no `.env*` edits, no new dependencies. |
| Quality | ✅ | Lint/typecheck/build clean; 216.71 KB gzip within the 350 KB budget; changes are scoped to the corrective tasks; no protected file (`Dockerfile`, `main.tsx`, `index.html`, `ws/connection.ts`, `server.ts`, package files, README) or compose port/service change. |
| Testing | ✅ | 810 tests green with concrete expected values; coverage 98.51/97.16/100/98.51 (backend) and 99.01/98.28/99.28/99.01 (frontend); no coverage exclusions beyond the entrypoints; no threshold change; changed tests include the F1–F8 regression cases; smoke verified twice. N1/N2 are narrow gaps, not weakened assertions. |

## 7. Verification limits

- The smoke transcript is from the reviewer’s two runs (cold and warm); both are 8/8.
  The stack was left as found; no source or configuration was changed.
- Real GPU/browser rendering is not exercised by this gate; the SSR/fake-renderer tests
  and the container smoke cover the wiring and protocol.
- The `docs/features/multiplayer-servers/reviews/code-r1.md` baseline and corrective
  commits were read in full; no build-log assertion was accepted without a matching
  reproduction.

## 8. Verdict

**`approved`** — 27/27 ACs met, F1–F11 closed, **0 blocking findings**. The four residual
items (N1, N2 MINOR; N3, N4 INFO) do not block acceptance and are recorded for the
backlog.
