# Build log — T3 — Backend protocol: optional appearance, `memberAppearance`, `setAppearance`

Task: T3 (2026-11-18/19)
Files changed: `src/backend/src/game/protocol.ts`, `src/backend/src/game/protocol.test.ts`, `docs/features/remote-spaceship-customization/build-log-T3.md` (this log)
Branch: `feat/remote-spaceship-customization`

## Sketch (≤5 lines)

- `MemberState.appearance?` optional; `parseAppearance` validates (plain object, ≤ 11 slot keys,
  non-empty strings ≤ 40 chars, JSON ≤ 700 B) and copies; `memberAppearanceOf` → valid copy else `{}`.
- Add `setAppearance` client frame + `memberAppearance` server frame; `memberAppearanceMessage`
  re-validates and copies; `copyAppearance` defensive copy.
- `copyMemberState` copies a **present** appearance through `memberAppearanceOf` (invalid → `{}`)
  and preserves absence — the server-side key presence is the hub projection's job (AC-7/T6).
- `stateSync`/`levelAdvanced` untouched; pinned bytes re-asserted.
- Tests: 11-slot valid fixture, missing/invalid matrix, 40-char and 700-byte exact boundaries,
  492 B worst-case `memberAppearance` frame, 473 B worst-case `setAppearance` frame, defensive copies.

## What changed & why

- `MemberState` gained `appearance?: Record<string, string>` (optional on the wire so every accepted
  member literal and older payload keeps compiling/decoding).
- Added the exported appearance codec and helpers: `parseAppearance(value)` (structural validation +
  fresh copy), `copyAppearance(appearance)` (defensive copy) and `memberAppearanceOf(member)` (the
  validated copy when the optional field is a valid record, otherwise `{}`).
- Added `APPEARANCE_MAX_ENTRIES = 11`, `APPEARANCE_VALUE_MAX_LENGTH = 40` and
  `APPEARANCE_JSON_MAX_BYTES = 700`; the codec rejects non-objects/`null`/arrays, > 11 entries,
  every key outside the 11-slot v3 union (including the legacy `body`/`wings` aliases), non-string,
  empty and 41+-character values, and an encoded appearance above 700 UTF-8 bytes.
- Added the server frame `{ type: 'memberAppearance'; playerId; appearance }` with
  `memberAppearanceMessage(playerId, appearance)` (re-validates, copies, throws `TypeError` on an
  invalid player id or appearance, matching `lootboxOpenedMessage`/`miniCubesRemovedMessage`).
- Added the client frame `{ type: 'setAppearance'; appearance }` to `ClientMessage` and its
  `parseClientMessage` case: the whole record is validated and copied, so any rule violation is
  exactly `{ ok: false, error: 'bad_message' }`.
- `copyMemberState` (used by `welcome`, `worldEntered`, `memberJoined`) now copies a present
  appearance through `memberAppearanceOf`, so an invalid/aliased record can never travel; an absent
  field stays absent (see Decisions #3).
- `stateSyncMessage` and `levelAdvancedMessage` were not touched; both exact encoded frames are
  pinned in the tests to prove no field/byte change.
- Added 24 tests (533 total in `protocol.test.ts`; backend 38 files / 1,667 tests).

## Decisions

1. **One shared appearance codec, exported.** `parseAppearance` is the single validation/copy path
   used by `memberAppearanceOf`, `setAppearance` (client) and `memberAppearanceMessage` (server).
   Part ids are intentionally *not* resolved against the catalog here — the hub owns semantic
   normalization (unknown/wrong-slot ids), exactly like `explode`/`equipPart` field semantics.
2. **Slot keys come from the T1 catalog.** `isValidSlotIdV3` (from `parts-v3.ts`) is the single
   source of the 11-slot union, so the wire codec cannot drift from the catalog. No cycle:
   `parts-v3.ts` imports only `parts-v2.ts`, which imports nothing.
3. **`copyMemberState` preserves an absent field instead of defaulting `{}`.** The T3 brief says
   "default `{}` on decode", but AC-7's normative sentence is that the backend's
   `memberState()`/`rosterFor()` always populate the field (the hub, T6), while the client's
   decode/copy paths are the ones that fill `{}` through `memberAppearanceOf` (T7). T3 does not own
   `hub.ts`/`hub.test.ts`/`app.test.ts`, and an always-defaulted `appearance: {}` changed 19 accepted
   deep-equal expectations in those files (reproduced: 17 in `hub.test.ts`, 2 in `app.test.ts`, all
   the same `+ "appearance": {}` diff). Since the whole backend suite must stay green and those files
   are out of scope, the copy path normalizes **present** values and leaves legacy members byte-
   identical; once T6 seeds `Member.appearance`, every server-originated `welcome.roster[i]`,
   `worldEntered.roster[i]` and `memberJoined.member` carries the field. `memberAppearanceOf` itself
   returns `{}` for an absent field (pinned in `memberAppearanceOf` tests), so the helper's contract
   is intact for every caller/T7 mirror. **Reviewer note:** this is the one point where the task
   brief's summary sentence and AC-7/plan differ; the chosen behavior follows AC-7 + the green-suite
   constraint.
4. **The 700-byte check runs on the encoded validated copy.** The entry/value bounds alone allow up
   to 603 ASCII bytes (11 × 40-char values), so the byte rule is what bounds multi-byte values
   (40 UTF-16 units can be up to 160 UTF-8 bytes). The boundary fixture uses emoji to hit exactly
   700 accepted / 701 rejected while every value stays ≤ 40 characters.
5. **`memberAppearanceMessage` rejects invalid payloads with `TypeError`** rather than putting them
   on the wire (the established builder precedent), and returns a fresh map, so mutating the
   argument afterwards cannot rewrite the message.
6. **A `{}` `setAppearance` frame is accepted.** AC-9 defines no minimum entry count; AC-11's hub
   path no-ops when the normalized record equals the stored one. The session still sends at most one
   non-empty record (T13).
7. **Two test tiers in one file.** Unit: `parseAppearance`/`copyAppearance`/`memberAppearanceOf`,
   boundaries and rejection matrix. Integration (real boundary, no extra harness): `parseClientMessage`
   on actual JSON frame text and `encodeServerMessage` frame bytes, including the 492 B/473 B
   worst-case frames and the byte-identical `stateSync`/`levelAdvanced` frames.

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

### `npm test --workspace @cubeclicker/backend`

```
 ✓ src/game/protocol.test.ts (533 tests) 76ms
 Test Files  38 passed (38)
      Tests  1667 passed (1667)
   Start at  08:43:34
   Duration  3.39s (transform 4.25s, setup 0ms, collect 11.74s, tests 13.75s, environment 6ms, prepare 2.89s)

EXIT:0
```

Focused run: `npx vitest run src/game/protocol.test.ts` (cwd `src/backend`) →

```
 ✓ src/game/protocol.test.ts (533 tests) 36ms

 Test Files  1 passed (1)
      Tests  533 passed (533)
   Start at  08:44:13
   Duration  714ms (transform 284ms, setup 0ms, collect 461ms, tests 36ms, environment 0ms, prepare 52ms)

EXIT:0
```

### `npm run coverage --workspace @cubeclicker/backend`

```
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.48 |    90.43 |   99.59 |   96.48 |
...
 src/game          |   96.28 |    94.94 |   99.11 |   96.28 |
  parts-v3.ts      |     100 |      100 |     100 |     100 |
  protocol.ts      |   99.36 |     99.2 |   97.77 |   99.36 | 477-478,1088-1089
...
-------------------|---------|----------|---------|---------|-------------------
 Test Files  38 passed (38)
      Tests  1667 passed (1667)

EXIT:0
```

The two uncovered `protocol.ts` lines are pre-existing (the invalid `join.mode` branch and the
unused `purchaseUpgradeMessage` builder); every added appearance line/branch is covered. All four
thresholds (≥ 80) pass.

### Feature proof — measured frames (AC-14)

`npx tsx -e "…memberAppearanceMessage / setAppearance frame / boundary fixtures…"` (cwd `src/backend`):

```
APPEARANCE_JSON_MAX_BYTES = 700 | MAX_MESSAGE_BYTES = 1024
worst appearance JSON bytes = 435
worst memberAppearance frame bytes = 492
worst setAppearance frame bytes = 473
setAppearance decode ok = true
boundary 700 bytes = 700 | accepted = true
boundary 701 bytes = 701 | accepted = false
```

Worst-case fixture = all 11 slots with their longest catalog ids
(`<slot>-bulwark-crimson`; longest `ignition-right-bulwark-crimson`, 30 chars). This reproduces the
spec's measured **492 B** `memberAppearance` frame exactly; the worst valid `setAppearance` frame is
**473 B ≤ 1024**.

### Scope / diff checks

- `git status --porcelain src/backend` → only `M src/backend/src/game/protocol.ts` and
  `M src/backend/src/game/protocol.test.ts`; no other backend file touched.
- `git status --porcelain docs/features/remote-spaceship-customization` → only the new
  `build-log-T3.md` from this task (the pre-existing untracked `spec.md`/`plan.md`/`tasks.md`/
  `status.md`/`reviews/` were not modified).
- `git diff --check` → exit 0.
- `parts-v2.ts`/test, `parts-v3.ts`/test, `hub.ts`/test, `economy-repository.ts`/test,
  `metrics.ts`/test, frontend files, `package.json`, lockfiles, compose/Docker and `.env*` were not
  modified. No new dependency, no schema/migration.

## Acceptance audit

- **AC-7 — met at the protocol layer.** `MemberState.appearance?` added; `memberAppearanceOf`
  returns the validated copy for a valid record and `{}` for absent/non-object/>11/unknown-slot/
  empty/non-string/41-char/701-byte records (all pinned). A present field is copied defensively and
  an invalid present value is normalized to `{}` inside `welcome`/`worldEntered`/`memberJoined`
  packets; an absent field is preserved (Decision #3 — the server-side key-presence guarantee is
  `memberState()`/`rosterFor()` in T6). `stateSync`/`levelAdvanced` have no new field and their
  exact encoded bytes are pinned unchanged.
- **AC-8 — met.** `memberAppearance` is in the server union; `memberAppearanceMessage` validates,
  copies and throws `TypeError` on invalid input; argument mutation cannot change the message; the
  pinned frame encodes exactly and the worst case measures **492 B**.
- **AC-9 — met.** `setAppearance` is in the client union and decodes to the pinned shape; the
  rejection matrix covers non-object (missing/`null`/array/string/number), 12 entries, unknown slot,
  legacy alias, `__proto__`, empty/non-string values, 41 characters and a 701-byte record, each
  exactly `bad_message`; the exact 40-char and 700-byte boundaries are accepted; the worst-case
  valid frame is **473 B ≤ `MAX_MESSAGE_BYTES` (1024)**.
- **AC-14 — protocol evidence met.** (a) `APPEARANCE_JSON_MAX_BYTES === 700`, the worst appearance
  encodes to 435 B, the worst `memberAppearance` frame measures 492 B; (b) the 24-member `welcome`
  bound and (c) the metrics allow-lists are T6/T4 (not in this task's files_owned), and the
  protocol-level pieces they rely on are pinned here.

## Deviations from spec

- **No spec deviation**; one task-brief/AC-7 interpretation is documented in Decision #3:
  `copyMemberState` preserves an absent `appearance` instead of injecting `{}`, because AC-7 assigns
  server-side presence to the hub's `memberState()`/`rosterFor()` (T6) and because injecting `{}`
  breaks 19 accepted deep-equal expectations in `hub.test.ts`/`app.test.ts`, which T3 neither owns
  nor may edit. The helper contract (`memberAppearanceOf` → `{}` when absent) and every codec rule
  are implemented and tested.
