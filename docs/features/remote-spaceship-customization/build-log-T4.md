# Build log — T4 — Metrics allow-lists for the new frames

Task: T4 (2026-11-19)
Files changed: `src/backend/src/observability/metrics.ts`, `src/backend/src/observability/metrics.test.ts`, `docs/features/remote-spaceship-customization/build-log-T4.md` (this log)
Branch: `feat/remote-spaceship-customization`
Commit: `8096f6e` — `feat: allow appearance frames in metrics` (not pushed; hash recorded in this follow-up `docs:` commit, mirroring T1/T2/T3/T5).

## Sketch (≤5 lines)

- Add `memberAppearance` to the closed `type` allow-lists of
  `cubeclicker_ws_messages_encoded_total` and `cubeclicker_ws_frames_sent_total`.
- Add `setAppearance` to the `cubeclicker_ws_messages_received_total` allow-list.
- Every accepted type stays unchanged and the catalog stays at exactly 30 metrics (AC-14c).
- Tests: pinned allow-list expectations, concrete rendered series for the new labels, wrong-direction
  labels still throw the exact existing errors, and one protocol-built `memberAppearance` encode +
  one decoded `setAppearance` frame counted through the registry.
- No `hub.test.ts` edit: the metrics-enabled hub broadcast integration is T6 scope (reviewer M2).

## What changed & why

- `cubeclicker_ws_messages_received_total.labels.type` gained `'setAppearance'` — the T3 client frame
  is decoded by `parseClientMessage` and counted by the hub's `metrics.inc(... { type })` call, so
  its exact wire name must be in the closed list (AC-14c).
- `cubeclicker_ws_messages_encoded_total.labels.type` and
  `cubeclicker_ws_frames_sent_total.labels.type` gained `'memberAppearance'` — the T3 server frame is
  encoded once (`encodeServerMessage` + one encoded counter) and delivered per recipient (one
  frames-sent counter) by the hub, so both lists need the name (AC-14c).
- No other entry changed: both outbound lists keep their 18 accepted types plus the new one; the
  received list keeps its 13 accepted types plus the new one; the catalog remains exactly 30 metrics.
- `metrics.test.ts` updated:
  - the three pinned allow-list expectations now include the new names in wire-union order
    (`setAppearance` after `unequipPart`; `memberAppearance` after `cubeRotated`), so a removed or
    renamed accepted type fails the pin;
  - four new tests (37 in the file): accepted labels render their exact series on both outbound
    counters and on the received counter, the opposite-direction labels still throw the exact
    `invalid value` error and create no series, and one `memberAppearanceMessage` frame encoded with
    `encodeServerMessage` plus one `parseClientMessage` `setAppearance` frame are counted through the
    same registry calls the hub uses.

## Decisions

1. **Order = wire-union adjacency, not append-at-tail.** The new names sit next to the frame groups
   they belong to (`setAppearance` after `unequipPart` exactly as in `ClientMessage`;
   `memberAppearance` after `cubeRotated`, its position in `ServerMessage`). Membership is what the
   allow-list enforces, so order is cosmetic; every previously accepted value is byte-identical and
   still present. The pinned equality tests prove it.
2. **No `hub.test.ts` change (reviewer M2).** The brief assigns the metrics-enabled hub broadcast
   integration to T6, so the integration tier here is the protocol↔registry boundary inside
   `metrics.test.ts`: the real frame builder, the real encoder and the real client decoder feed the
   exact `metrics.inc(..., { type })` calls `hub.ts` executes (lines 563/573/592/1791). The registry
   itself is pure and has no I/O boundary of its own.
3. **Wrong-direction labels are asserted as rejected.** `memberAppearance` on the received counter and
   `setAppearance` on either outbound counter must keep throwing the existing
   `has invalid value "<v>"` error because neither is an accepted type in that direction. This is a
   real regression guard (it fails if a future edit widens the lists in the wrong direction), not a
   tautology: it also asserts the rendered block stays empty (no series created).
4. **The integration test asserts exact bytes.** The `memberAppearance` frame is pinned to
   `{"type":"memberAppearance","playerId":"player-2","appearance":{"hull":"hull-dart-chrome"}}` and the
   decoded `setAppearance` to its exact message object, so a frame-name or shape drift fails before the
   counters are asserted. No wildcard matchers; no `not.toThrow()` stand-ins.

## Evidence

### Parallel-batch contamination (recorded for reproducibility)

The first recipe attempt (09:42) ran while the parallel T5 builder had `src/backend/src/auth/economy-repository.ts`
mid-edit on disk (not committable, not in T4's scope). Raw output of that attempt:

```
$ npm run lint
  46:3  error  'normalizeCustomizationStateV3' is defined but never used
  47:8  error  'PartIdV3' is defined but never used
  48:8  error  'SlotIdV3' is defined but never used
EXIT:1
$ npm run typecheck
src/auth/economy-repository.ts(118,13): error TS2552: Cannot find name 'PartIdV2'. Did you mean 'PartId'?
... (same file only)
EXIT:2
```

T5 committed (`7637179`), the tree settled, and the full recipe was re-run on the clean tree below.

### `npm run lint`

```
> lint
> eslint .

EXIT:0
```

### `npm run typecheck`

```
> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

EXIT:0
```

### `npm test --workspace @cubeclicker/backend`

```
 ✓ src/observability/metrics.test.ts (37 tests) 24ms
 ✓ src/game/hub.test.ts (194 tests) 267ms
 ...
 Test Files  38 passed (38)
      Tests  1676 passed (1676)
   Start at  09:47:41
   Duration  3.41s (transform 4.92s, setup 0ms, collect 13.27s, tests 13.53s, environment 0ms, prepare 3.25s)

EXIT:0
```

Focused run (cwd `src/backend`, before the full recipe):

```
$ npx vitest run src/observability/metrics.test.ts
 ✓ src/observability/metrics.test.ts (37 tests) 12ms
 Test Files  1 passed (1)
      Tests  37 passed (37)
EXIT:0
```

`metrics.test.ts` went from 33 to 37 tests (4 added). The backend total (1,676) includes T5's
committed 9 tests; T4's +4 are the difference from the 1,667 recorded by T3.

### `npm run coverage --workspace @cubeclicker/backend`

```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.48 |    90.43 |   99.59 |   96.48 |
...
 src/observability |   99.67 |     96.5 |     100 |   99.67 |
  metrics.ts       |   99.45 |    93.54 |     100 |   99.45 | 251-252
...
-------------------|---------|----------|---------|---------|-------------------
 Test Files  38 passed (38)
      Tests  1676 passed (1676)

EXIT:0
```

All four thresholds (statements/branches/functions/lines ≥ 80, pinned in `vitest.config.ts`) pass;
`metrics.ts` is 99.45 / 93.54 / 100 / 99.45. The two uncovered lines (251-252, `formatNumber`) are
pre-existing and unrelated (the same lines are reported uncovered on `HEAD` before this task); every
added allow-list line and every added branch is exercised by the new tests.

### Scope / diff checks

- `git diff --stat -- src/backend/src/observability/metrics.ts src/backend/src/observability/metrics.test.ts`
  → only those two files; `git status` shows no other T4-owned path.
- Untouched by this task: `hub.ts`/`hub.test.ts` (T6), `protocol.ts`/`protocol.test.ts` (T3),
  `economy-repository.ts`/test (T5), frontend files, `package.json`, lockfiles, compose/Docker,
  `.env*`, `spec.md`/`plan.md`/`tasks.md`/`status.md`/`reviews/`, `docs/features/README.md`.
- No new dependency; no schema/migration change.

## Acceptance audit

- **AC-14(c) — met at the registry layer.** `memberAppearance` is accepted by
  `cubeclicker_ws_messages_encoded_total` and `cubeclicker_ws_frames_sent_total`, and `setAppearance`
  by `cubeclicker_ws_messages_received_total`; concrete rendered series are pinned
  (`…{type="memberAppearance"} 1` / `3`, `…{type="setAppearance"} 1`). The opposite-direction labels
  still throw the exact existing error and create no series, so the lists stay closed. One
  protocol-built `memberAppearance` frame encodes and counters, and one decoded `setAppearance` frame
  counts, without throwing. The catalog stays at exactly 30 metrics. The hub-level
  metrics-enabled broadcast assertion is T6 (reviewer M2, not edited here).
- **AC-14(a)/(b)** are T3/T6 evidence and are not re-asserted here.

## Deviations from spec

- No spec deviation. One scope note: the harness-level "metrics-enabled hub broadcast does not
  throw" is exercised at the protocol↔registry boundary in `metrics.test.ts`; the hub broadcast
  variant is intentionally T6's per the brief and reviewer finding M2.
