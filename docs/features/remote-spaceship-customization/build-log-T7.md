# Build log — T7 — Frontend protocol mirror + world reducer

Task: T7 (2026-11-19)
Files changed: `src/frontend/src/multiplayer/protocol.ts`, `src/frontend/src/multiplayer/protocol.test.ts`, `src/frontend/src/multiplayer/server-state.ts`, `src/frontend/src/multiplayer/server-state.test.ts`, `src/frontend/src/game/session.test.ts` (three fixture-only `appearance: {}` properties, see Deviations), `docs/features/remote-spaceship-customization/build-log-T7.md` (this log)
Branch: `feat/remote-spaceship-customization`
Commit: `fb38938` — `feat: mirror appearance protocol on the client` (not pushed; hash recorded in this follow-up `docs:` commit)

## Sketch (≤5 lines)

- Mirror T3: `MemberState.appearance?`, `APPEARANCE_*` bounds, `parseAppearance`/`copyAppearance`/
  `memberAppearanceOf`, `setAppearance` client frame, `memberAppearance` server frame +
  `memberAppearanceMessage`; `stateSync`/`levelAdvanced` bytes unchanged.
- Decode `memberAppearance` from the wire and copy it; every member decode fills `{}` through
  `memberAppearanceOf` when the field is absent/invalid.
- Reducer: `memberAppearance` updates the matching roster member with a normalized defensive copy;
  unchanged record → same state reference; unknown member → same reference.
- Tests: parity fixtures (valid/invalid 40-char/700-byte/701-byte), missing-field default `{}`,
  reduction/copy/stability, `setAppearance` round trip, pinned `stateSync`/`levelAdvanced` bytes.
- Run lint/typecheck/frontend tests/frontend coverage; record raw output below.

## What changed & why

- `protocol.ts` mirrors T3 on the client: optional `MemberState.appearance`, the
  `APPEARANCE_MAX_ENTRIES = 11` / `APPEARANCE_VALUE_MAX_LENGTH = 40` /
  `APPEARANCE_JSON_MAX_BYTES = 700` constants, the single structural codec `parseAppearance`
  (plain object, ≤ 11 keys from the T1 `isValidSlotIdV3` union, non-empty string values ≤ 40
  characters, JSON ≤ 700 UTF-8 bytes), `copyAppearance`, and the read gate
  `memberAppearanceOf` (valid → fresh copy, otherwise `{}`).
- `protocol.ts` adds the `memberAppearance` server frame (decode validates + copies) and the
  `setAppearance` client frame (decode validates + copies → `bad_message` on any rule
  violation), plus `memberAppearanceMessage` (re-validates, copies, `TypeError` on invalid).
  `parseMemberState` normalizes a **present** appearance and preserves an absent one; the
  reducer is the client copy path that guarantees `{}`.
- `server-state.ts` copies every stored member through `memberAppearanceOf` in `copyMember`
  (`welcome`, `memberJoined`, `worldEntered`, `applyWorldSwap`), and adds the `memberAppearance`
  reduction `withAppearance`: normalized defensive copy onto the matching member, same state
  reference for an unchanged record, an unknown player, the own player, or an invalid payload.
- `server-state.test.ts` now pins the AC-7 defaults and the AC-8 reduction contract (nine new
  reducer tests; 97 tests in the file).
- `session.test.ts` (T13-owned) gained only three `appearance: {}` fixture properties required by
  `copyMember`'s default (see Deviations); no assertion was weakened.

## Decisions

1. **Transport preserves absence; the reducer defaults.** Mirroring T3's Decision #3, a member
   payload without the optional field stays without it after `parseMemberState` (legacy payloads
   stay byte-faithful), and the client copy path (`copyMember` in `server-state.ts`) stores `{}`
   through `memberAppearanceOf`. This keeps every accepted `MemberState` literal compiling while
   guaranteeing that every `WorldState.members` entry carries `{}` or a valid record.
2. **`copyMember` and the `memberAppearance` reducer normalize to `{}`.** `memberAppearanceOf`
   is the only read gate: absent, non-object, > 11 entries, unknown slot key, non-string/empty
   value and > 40-character value all read as `{}`; a valid record is always a fresh copy, so a
   caller mutating the wire object cannot rewrite stored state.
3. **`withAppearance` is an exact no-op in four cases.** Own `playerId` (`SelfState` carries no
   appearance — the engine owns the local loadout and T13 adopts the roster record once on
   `welcome`), unknown member, invalid payload (`parseAppearance` → `null`), and an unchanged
   record (key-order-independent equality → same `WorldState` reference for React).
4. **Exact parity with T3.** Same constants, same codec rules, same fixture families and the same
   pinned frames: the worst-case `memberAppearance` frame measures **492 B** and the worst
   `setAppearance` frame **473 B**; `stateSync`/`levelAdvanced` gain no field and their encoded
   bytes are pinned unchanged in `protocol.test.ts`.
5. **Both test tiers in the task's files.** Unit: the pure codec helpers and the pure
   `reduceWorldState`/`applyWorldSwap` reducer. Integration: `parseServerMessage` /
   `parseClientMessage` on real JSON frame text (including the 700/701-byte boundaries and the
   `memberAppearance` frame), with the decoded message then fed through the reducer. No
   containerized tier applies: T7 changes no service boundary, frame routing or runtime config
   (T16 owns the smoke check).

## Evidence

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

### `npm test --workspace @cubeclicker/frontend`

```
 ✓ src/multiplayer/protocol.test.ts (633 tests) 45ms
 ✓ src/multiplayer/server-state.test.ts (97 tests) 35ms
 ...
 Test Files  83 passed (83)
      Tests  2795 passed (2795)
   Start at  08:59:03
   Duration  4.08s (transform 8.96s, setup 0ms, collect 25.58s, tests 15.62s, environment 11.25s, prepare 6.53s)

EXIT:0
```

(The `HTMLCanvasElement.getContext()` / `THREE.WebGLRenderer` stderr lines are the pre-existing
jsdom WebGL fallback noise from the UI suites; all files and tests pass.)

### `npm run coverage --workspace @cubeclicker/frontend`

```
 Test Files  83 passed (83)
      Tests  2795 passed (2795)
   Start at  08:59:11
   Duration  5.97s (transform 9.83s, setup 0ms, collect 25.49s, tests 24.74s, environment 12.67s, prepare 8.15s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   97.16 |    96.66 |   98.33 |   97.16 |
 src/multiplayer   |   95.67 |    97.41 |   98.03 |   95.67 |
  protocol.ts      |   93.47 |     97.4 |   95.65 |   93.47 | ...1706,1710-1721
  server-state.ts  |   97.57 |    95.53 |     100 |   97.57 | ...44,446-447,510

EXIT:0
```

All four thresholds (≥ 80 statements/branches/functions/lines) pass for the frontend workspace;
`server-state.ts` is at 97.57 / 95.53 / 100 / 97.57 and `protocol.ts` at 93.47 / 97.4 / 95.65 /
93.47. The uncovered `protocol.ts` lines are the pre-existing unused builders, and the uncovered
`server-state.ts` lines are pre-existing stateSync/prune branches unrelated to the appearance path.

## Acceptance audit

- **AC-7 (client half) — met.** `MemberState.appearance?` added; `memberAppearanceOf` is the single
  read gate (valid → fresh copy, absent/invalid → `{}`); `parseMemberState` normalizes a present
  record and preserves an absent one; `copyMember` stores `{}` for every roster member missing the
  field (pinned for `welcome`, `memberJoined`, `worldEntered` and `applyWorldSwap`). `SelfState`
  carries no appearance (`Object.keys(self)` pinned). `stateSync`/`levelAdvanced` have no new field
  and their exact bytes are pinned unchanged.
- **AC-8 (client half) — met.** `memberAppearance` is in the server union and decodes to a fresh
  copy or `bad_message`; `memberAppearanceMessage` re-validates, copies and throws `TypeError` on
  invalid input; the worst-case frame measures 492 B. The reducer replaces exactly the matching
  member with a defensive copy, keeps the other members and `self` identity-stable, and returns
  the same world for an unchanged record, an unknown member, the own player and invalid payloads.
- **AC-9 (client half) — met.** `setAppearance` is in the client union; `parseClientMessage`
  validates and copies the record, rejecting non-object/`null`/array/>11 entries/unknown slot
  (including legacy aliases and `__proto__`)/non-string/empty/41-character/701-byte payloads with
  exactly `bad_message`; the 40-character and 700-byte boundaries are accepted and the worst-case
  frame measures 473 B ≤ `MAX_MESSAGE_BYTES` (1024).
- **AC-14 (protocol pieces owned by T7) — met.** The three bounds are pinned to 11/40/700 and the
  measured 492 B `memberAppearance` frame is asserted. Metrics allow-lists (T4) and the 24-member
  welcome bound (T6) are outside this task's files.
- **AC-32 (coverage, T7 contribution) — met.** Frontend aggregate 97.16 / 96.66 / 98.33 / 97.16
  with no threshold or exclusion change.

## Deviations from spec

- **`src/frontend/src/game/session.test.ts` (T13-owned) needed three fixture-only properties.**
  `copyMember` now stores `appearance: {}` on every roster member, so three existing deep-equal
  expectations on a decoded `welcome`/`worldEntered` roster (`multiplayer authority` ×2 and
  `multiplayer spectate` ×1) gained the expected `appearance: {}` property. This is a fixture
  catch-up, not an assertion weakening: every expected value stays fully pinned. T13 still owns
  the file; this change does not touch its production `session.ts` or any behavioural assertion.
- No other spec deviation. `UserPanel.test.tsx`, `activity-lifetime.test.ts` and `App.test.tsx`
  were **not** touched: the optional field keeps their member literals compiling, as planned.

## Scope / diff checks

- `git diff --check` → exit 0.
- T7 touched exactly the six staged paths above; `git status --porcelain src/backend` is clean, and
  no backend, `game/engine.ts`, `game/session.ts`, `render/**`, `ui/**`, `App.tsx`, `parts-v2`,
  `package.json`, lockfile, compose/Docker or `.env*` file was modified. No new dependency, no
  schema/migration.
- After the two commits, `git status --porcelain` still lists three pre-existing unrelated
  modifications that were already dirty before T7 started (`docs/features/README.md`,
  `docs/features/coin-economy/reviews/code-r2.md`, `docs/features/coin-economy/status.md`); they
  are orchestrator/other-feature-owned and were deliberately left untouched. The remaining
  untracked entries are this feature's orchestrator-owned artifacts
  (`spec.md`, `plan.md`, `tasks.md`, `status.md`, `reviews/`).

