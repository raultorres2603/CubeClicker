# Tasks — Presence & Activity Liveness

Dependency overview: T1 → (T2 ∥ T4); T2 → T3; T4 → T5; (T3 ∥ T5); T5 → T6; T3 → T7; (T3, T6) → T8; (T7 ∥ T8) → T9.

> Gate: the approval checkpoint (spec Q-1, Q-2, Q-4; Q-3 is decided in the spec) must be confirmed and recorded in `status.md` before T1 starts. `docs/features/README.md` is orchestrator-owned and is never edited by a task; T9 proposes the row in its build log.

## T1 — Backend wire: `leave`, TTL constant, received allow-list `[seq]`
depends_on: —
files_owned: `src/backend/src/game/protocol.ts`, `src/backend/src/game/protocol.test.ts`, `src/backend/src/observability/metrics.ts`, `src/backend/src/observability/metrics.test.ts`
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/backend`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-8, AC-9, AC-10, AC-11
status: [x]

Add `ACTIVITY_EVENT_TTL_MS = 5000`, the `{ type: 'leave' }` client message and its decoder case to the backend catalog, and `leave` to the received `type` allow-list. Pin the exact `leave` fixture, extra-field dropping, the TTL constant and the unchanged `welcome` fixture; add the allow-list test.

## T2 — Backend activity TTL `[P]`
depends_on: T1
files_owned: `src/backend/src/game/activity.ts`, `src/backend/src/game/activity.test.ts`
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/backend`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-11, AC-12
status: [x]

Add the `ttlMs` option (default `ACTIVITY_EVENT_TTL_MS`), snapshot filtering at `now - at < ttlMs`, and expired-tail pruning without touching `nextId`/`lastAcceptedAt`. Pin the 4999/5000 boundary, the long-TTL 20-ring test, the default-TTL five-event snapshot at 24 000 and the cadence/drop invariants.

## T3 — Backend hub explicit leave `[P]`
depends_on: T1, T2
files_owned: `src/backend/src/game/hub.ts`, `src/backend/src/game/hub.test.ts`
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/backend`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-9, AC-13, AC-14
status: [x]

Dispatch `leave` only for a joined connection, remove the member through the existing `removeMember` path, set `closeReason = 'client'`, and close the peer; leave `handleClose`/grace untouched. Test explicit vs abrupt close, rejoin after leave, last-member destroy, multi-tab, roster/leaderboard via observable `welcome`/`leaderboardUpdate` frames and gauges, the rejoin counter resume (`leaderboard.entries` `clicks`/`cubesCompleted` and `totals.facesDestroyed`), welcome TTL filtering, metrics, and timer counts (`vi.getTimerCount()` 3→2 after a leave with a surviving member; 2→0 after a last-member leave), plus ring teardown evidence in `activity.test.ts`.

## T4 — Frontend protocol mirror `[P]`
depends_on: T1
files_owned: `src/frontend/src/multiplayer/protocol.ts`, `src/frontend/src/multiplayer/protocol.test.ts`
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-8, AC-10, AC-11
status: [x]

Mirror `ACTIVITY_EVENT_TTL_MS` and the `leave` client message/decoder; pin parity with the backend fixtures (valid, extra fields dropped, unknown/malformed rejected) and confirm no server catalog variant was added.

## T5 — Frontend activity lifetime + prune helper `[P]`
depends_on: T4
files_owned: `src/frontend/src/multiplayer/activity-lifetime.ts`, `src/frontend/src/multiplayer/activity-lifetime.test.ts`, `src/frontend/src/multiplayer/server-state.ts`, `src/frontend/src/multiplayer/server-state.test.ts`
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-5, AC-15, AC-16, AC-17, AC-18
status: [x]

Implement the deadline/tombstone bookkeeping (`serverId:id`, first-seen only, stale-server cleanup, bounded size) and the pure `pruneActivity(state, isExpired)` helper. Test the three separate scenarios: current+pending travel without a post-seed welcome (exact 5000/6000/7000/8000 deadlines), same-server rejoin with no pending swap (deadline not extended), and tombstone/no-reappearance/stale-server cleanup; plus prune reference stability across current/pending/no-op cases.

## T6 — Frontend session + browser env
depends_on: T4, T5
files_owned: `src/frontend/src/game/session.ts`, `src/frontend/src/game/session.test.ts`, `src/frontend/src/browser-env.ts`, `src/frontend/src/browser-env.test.ts`
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-7, AC-14, AC-15, AC-16, AC-17, AC-18, AC-19
status: [x]

Add the optional `pageLifecycle` source (`pagehide` + `persisted`) to the environment and the session's exception-safe, non-bfcache leave send (`try`/`catch` around `transport.send`; fake-socket-throws test). On **every** world reduction (immediately after `reduceWorldState`, before the message switch) and after `applyWorldSwap`, apply reduce → `lifetime.observe` → synchronous `pruneActivity` → the handler/final publishes, so a tombstoned/expired seed is never published; the 250 ms interval is only the fallback for time passing without a reduction, and visibility resume prunes before the next frame. Test pagehide conditions, exact expiry timing, the split travel/rejoin/tombstone scenarios (including "immediately after the 5001 same-server `welcome` the published feed is `[]`"), visibility and no callbacks after dispose.

## T7 — Containerized smoke `[P]`
depends_on: T3
files_owned: `tests/e2e/smoke.mjs`
verify: `node --check tests/e2e/smoke.mjs`, `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod`, `npm run smoke`
acceptance: AC-22
status: [x]

Keep the existing B abrupt-close check (socket close without `leave`; A sees `memberLeft(left)` at or after 900 ms; `LEAVE_CHECK_LABEL` and `GRACE_LOWER_BOUND_MS` unchanged). Add D's explicit `leave` after B's grace expiry: D joins server 1 (slot 2), A sees `memberLeft(left)` in < 900 ms; E then joins in D's freed slot with `welcome.roster === [A, E]`. Update the header/labels to describe both paths; keep the existing activity leave for B and add no fixed 5 s wait. Test-only task: no production code and no coverage delta; the final task runs the root coverage gate.

## T8 — Documentation pass `[P]`
depends_on: T3, T6
files_owned: `docs/architecture/realtime.md`, `docs/architecture/observability.md`, `docs/architecture/frontend-rendering.md`, `docs/product/glossary.md`
verify: `grep -F "## Presence and explicit leave" docs/architecture/realtime.md`, `grep -F "### Lifetime" docs/architecture/realtime.md`, `grep -F "ACTIVITY_EVENT_TTL_MS" docs/architecture/realtime.md`, `grep -F "allow-list includes" docs/architecture/observability.md`, `grep -F "An explicit leave drops" docs/architecture/observability.md`, `grep -F "The encoded and frame-sent allow-lists" docs/architecture/observability.md`, `grep -F "pagehide" docs/architecture/frontend-rendering.md`, `grep -F "ACTIVITY_EXPIRY_TICK_MS" docs/architecture/frontend-rendering.md`, `grep -F "### presence" docs/product/glossary.md`, `node -e "const fs=require('fs'),p=require('path');for(const f of ['docs/architecture/realtime.md','docs/architecture/observability.md','docs/architecture/frontend-rendering.md','docs/product/glossary.md'])for(const m of fs.readFileSync(f,'utf8').matchAll(/\]\(([^)#]+)/g))if(!/^https?:/.test(m[1])&&!fs.existsSync(p.resolve(p.dirname(f),m[1]))){console.error(f,m[1]);process.exit(1)}"`, `git diff --check -- docs/architecture/realtime.md docs/architecture/observability.md docs/architecture/frontend-rendering.md docs/product/glossary.md`, `git diff --exit-code -- README.md docs/architecture/containerization.md docs/features/README.md`
acceptance: AC-20
status: [x]

Document presence/explicit leave, the activity lifetime and client expiry, the observability `leave` allow-list and `members_active` semantics, and correct the pre-existing encoded/frames rows (`activityEvent`, `leaderboardUpdate`); record the page-lifecycle session seam and `ACTIVITY_EXPIRY_TICK_MS`; add the glossary terms. Keep the edited links simple relative targets (no Markdown titles or absolute paths) so the T8 `node -e` link check stays valid. Do not edit `docs/features/README.md` (T9 proposes the row). Documentation-only task: no production code and no coverage delta; the final task runs the root coverage gate.

## T9 — Verify & integrate `[seq]`
depends_on: T7, T8
files_owned: `docs/features/presence-and-activity-liveness/build-log-T9.md`
verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `podman compose -f compose.yaml -f compose.smoke.yaml build frontend-prod`, `npm run smoke`, `git diff --exit-code -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile package.json package-lock.json`
acceptance: AC-1…AC-23 (final evidence)
status: [x]

Run the full gate, record raw output and the smoke transcript in the build log, confirm the container/package files are unchanged, and propose the `presence-and-activity-liveness` row for `docs/features/README.md` in the log for the orchestrator. No source changes in this task.
