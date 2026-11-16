# Build log — code-review r1 fixes

Task: code-review r1 fixes for `presence-and-activity-liveness` (2026-11-16)
Files changed: `src/backend/src/game/hub.ts`, `src/backend/src/game/hub.test.ts`, `docs/features/presence-and-activity-liveness/build-log-r1-fixes.md` (code commit); the feature artifacts (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/`), `build-log-T2.md` and `build-log-T9.md` (artifact-tracking commit).
Branch: `feat/presence-and-activity-liveness`.
What changed & why: closes the five code-review r1 findings with minimal edits — tracks the approved feature artifacts so the committed `docs/architecture/realtime.md` link resolves on a clean checkout (F1), reconciles the T9 log wording with the final task state (F2), fixes the T2 log's trailing blank line (F3), clears the leaving connection's heartbeat before the peer close so a delayed close cannot be relabelled `heartbeat` (F4), and marks the approved spec frontmatter `status: approved` (F5). No grace/rejoin behavior, dependency, coverage exclusion or assertion strength changes.

## F1 — feature artifacts tracked (MAJOR)

`spec.md`, `plan.md`, `tasks.md`, `status.md` and `reviews/` (all spec-review rounds and `code-review-r1.md`) are added to git in the artifact-tracking commit. `git ls-files` after the commit lists them, so the `../features/presence-and-activity-liveness/spec.md` link in the committed `docs/architecture/realtime.md` resolves on a clean checkout. `docs/features/game-feel-overhaul/` and every other feature's files remain untracked and are not staged (proof below).

## F2 — T9 log reconciled (MINOR)

A `## Post-review bookkeeping (code-review r1)` section is appended to `build-log-T9.md`; the original T9 evidence is retained unchanged. It records that T9 is now `[x]` in `tasks.md`, `status.md` records `building → code_review`, the artifacts are tracked, T2's EOF is fixed, the spec is `approved`, and F4 is fixed. `status.md` gains the matching `review r1 fixes applied` loop entry.

## F3 — T2 EOF (MINOR)

`build-log-T2.md` now ends with exactly one newline (`… same T2 source and tests.\n`; the previous extra blank line is gone). `git diff --check` over the feature range is clean.

## F4 — delayed-close close reason (MINOR)

`handleLeave` now clears `connection.heartbeat` (and sets it to `null`) after pinning `closeReason = 'client'` and before `removeMember`/`peer.close()`. A heartbeat tick can no longer observe the closed peer and call `terminate(connection, 'heartbeat')` during a delayed transport close, so the eventual close event is counted/logged as `reason="client"`. `handleClose` keeps its existing `heartbeat !== null` guard, so it stays idempotent for every other path. Grace, token rejoin, activity/leaderboard cleanup and the peer close are unchanged.

New test: `hub.test.ts` `keeps the client close reason when a heartbeat tick fires before the close event (AC-9)`. `DelayedClosePeer` (a test-only `FakePeer` subclass) marks the socket closed on `close()` but withholds the close event. The test advances one heartbeat interval after the leave, asserts neither the `heartbeat` nor the `client` closed sample exists yet (the connection is still attached), then delivers the delayed close event and asserts exactly one `cubeclicker_ws_connections_closed_total{reason="client"}` and no `reason="heartbeat"` sample, with the peer closed exactly once.

Negative proof (temporarily removing the heartbeat clear from `hub.ts`, running only the new test, then restoring the fixed file):

```text
 ❯ src/game/hub.test.ts:7015:7
    7015|     ).toBe(1);
         |       ^
 Test Files  1 failed (1)
      Tests  1 failed | 193 skipped (194)
```

The failing assertion is the post-close `reason="client"` sample (received `null`): without the clear the heartbeat tick had already set `closeReason = 'heartbeat'`, and the delayed close was counted under that label. With the fix restored:

```text
 ✓ src/game/hub.test.ts (194 tests | 193 skipped) 10ms
 Test Files  1 passed (1)
      Tests  1 passed | 193 skipped (194)
```

## F5 — spec metadata (INFO)

`spec.md` frontmatter now declares `status: approved` (was `draft`); revision r3 and the content are unchanged.

## Artifact-tracking staging proof (no game-feel files)

Captured with all fix-round paths staged (before splitting the two commits). The `?? docs/features/game-feel-overhaul/` line is the other feature's untracked directory; no game-feel path is staged:

```text
$ git add src/backend/src/game/hub.ts src/backend/src/game/hub.test.ts \
    docs/features/presence-and-activity-liveness/build-log-r1-fixes.md \
    docs/features/presence-and-activity-liveness/spec.md \
    docs/features/presence-and-activity-liveness/plan.md \
    docs/features/presence-and-activity-liveness/tasks.md \
    docs/features/presence-and-activity-liveness/status.md \
    docs/features/presence-and-activity-liveness/reviews \
    docs/features/presence-and-activity-liveness/build-log-T2.md \
    docs/features/presence-and-activity-liveness/build-log-T9.md
$ git status --porcelain
M  docs/features/presence-and-activity-liveness/build-log-T2.md
M  docs/features/presence-and-activity-liveness/build-log-T9.md
A  docs/features/presence-and-activity-liveness/build-log-r1-fixes.md
A  docs/features/presence-and-activity-liveness/plan.md
A  docs/features/presence-and-activity-liveness/reviews/code-review-r1.md
A  docs/features/presence-and-activity-liveness/reviews/spec-review-r1.md
A  docs/features/presence-and-activity-liveness/reviews/spec-review-r2.md
A  docs/features/presence-and-activity-liveness/reviews/spec-review-r2a.md
A  docs/features/presence-and-activity-liveness/spec.md
A  docs/features/presence-and-activity-liveness/status.md
A  docs/features/presence-and-activity-liveness/tasks.md
M  src/backend/src/game/hub.test.ts
M  src/backend/src/game/hub.ts
?? docs/features/game-feel-overhaul/
$ git diff --cached --name-only | grep -c 'game-feel'
0
```

## Evidence

### `npm run lint` — exit 0

```text
> lint
> eslint .
```

### `npm run typecheck` — exit 0

```text
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit
```

### `npm test --workspace @cubeclicker/backend` — exit 0

```text
 Test Files  37 passed (37)
      Tests  1538 passed (1538)
   Duration  3.59s (transform 4.58s, setup 0ms, collect 13.29s, tests 14.35s, environment 9ms, prepare 4.16s)
```

### `npm run coverage --workspace @cubeclicker/backend` — exit 0

```text
 Test Files  37 passed (37)
      Tests  1538 passed (1538)
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |    96.2 |    89.92 |   99.57 |    96.2 |
  hub.ts           |   91.12 |    88.69 |   98.48 |   91.12 | ...1723,1774-1777
-------------------|---------|----------|---------|---------|-------------------
```

All four backend metrics remain above the 80 threshold; `hub.ts` statements/lines rose from 91.1 to 91.12 with the new test.

### `git diff --check` — exit 0

```text
(no output)
```

### `git ls-files docs/features/presence-and-activity-liveness` (after the tracking commit)

```text
docs/features/presence-and-activity-liveness/build-log-T1.md
docs/features/presence-and-activity-liveness/build-log-T2.md
docs/features/presence-and-activity-liveness/build-log-T3.md
docs/features/presence-and-activity-liveness/build-log-T4.md
docs/features/presence-and-activity-liveness/build-log-T5.md
docs/features/presence-and-activity-liveness/build-log-T6.md
docs/features/presence-and-activity-liveness/build-log-T7.md
docs/features/presence-and-activity-liveness/build-log-T8.md
docs/features/presence-and-activity-liveness/build-log-T9.md
docs/features/presence-and-activity-liveness/build-log-r1-fixes.md
docs/features/presence-and-activity-liveness/plan.md
docs/features/presence-and-activity-liveness/reviews/code-review-r1.md
docs/features/presence-and-activity-liveness/reviews/spec-review-r1.md
docs/features/presence-and-activity-liveness/reviews/spec-review-r2.md
docs/features/presence-and-activity-liveness/reviews/spec-review-r2a.md
docs/features/presence-and-activity-liveness/spec.md
docs/features/presence-and-activity-liveness/status.md
docs/features/presence-and-activity-liveness/tasks.md
```

## Acceptance audit (fix round)

- **F1 — met.** Feature artifacts staged and committed; `git ls-files` proof above; no game-feel path staged (`grep -c` = 0).
- **F2 — met.** T9 post-review note appended; original evidence intact; status loop entry added.
- **F3 — met.** `build-log-T2.md` ends with exactly one newline; `git diff --check` clean.
- **F4 — met.** Heartbeat cleared in `handleLeave`; delayed-close test passes with the fix and fails without it; AC-1/AC-4 timer counts and AC-9 client-close metric remain green in the full backend suite.
- **F5 — met.** `spec.md` frontmatter `status: approved`.

Deviations from the review instructions: none. Only the two requested commits were created (code fix first, artifact tracking second); no other source/test changes.
