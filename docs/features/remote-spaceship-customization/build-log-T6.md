# Build log — T6 — Hub appearance authority

Task: T6 (2026-11-19)
Files changed: `src/backend/src/game/hub.ts`, `src/backend/src/game/hub.test.ts`, `src/backend/src/app.test.ts`, `docs/features/remote-spaceship-customization/build-log-T6.md`
Branch: `feat/remote-spaceship-customization`
Commit: `<pending>` — recorded in the follow-up `docs:` commit (not pushed)

## What changed & why

- `hub.ts` now imports the v3 catalog (`isValidPartIdV3`, `isValidSlotIdV3`,
  `normalizeAppearanceV3`, `partDefinitionV3`, `defaultPartForSlotV3`, `selectLootPartV3`) and no
  longer imports `parts-v2`. The equip/unequip validation, legacy-id expansion and the lootbox
  draw all resolve through v3; the legacy `body-*`/`wings-*`/`engine-*` aliases still expand to
  their v3 targets.
- `Member` gains `appearance` (the public slot→part-id projection) and `appearanceAdmitted` (the
  trailing-window timestamps). `memberState()` always emits a copied `appearance`; account members
  are seeded on join/rejoin from `normalizeAppearanceV3(loadedCustomization.appearance)`, guests
  start from `{}`.
- The accepted account equip/unequip path first mirrors the persisted appearance onto **every**
  member of the account (`updateMembersAppearance`), then sends the unchanged account-scoped
  `customizationUpdate`, then one `memberAppearance` per **changed** member on that member's own
  server. Same-server two tabs ⇒ two frames; two servers ⇒ one each; unchanged ⇒ none.
- Guest `setAppearance` is implemented: account members are a silent no-op; guests are normalized
  against v3, stored only on a real change, and rebroadcast to the server's other members (origin
  excluded). The true trailing window admits at most 10 frames per member per 1000 ms.
- The stored appearance survives a socket close inside grace and a rejoin, travels with the member
  on a cross-server move, and is discarded on final removal; a new guest identity starts empty.

## Decisions

- **Authority first, then broadcast.** `updateMembersAppearance` runs before
  `broadcastCustomizationUpdate` and before the per-member frames, so every recipient's view of a
  member is already the new record when the frame arrives (AC-10).
- **One frame per affected member/`playerId`, on that member's server.** The fan-out is driven by
  the members whose record actually changed (`setMemberAppearance` returns a boolean), and each
  frame is encoded once by the existing `broadcast` helper. A single frame per account would leave
  a sibling tab's roster stale; a server-wide frame would leak across servers.
- **Copy-on-store, order-independent comparison.** `setMemberAppearance` stores a fresh copy and
  `sameAppearance` compares key/value pairs, so a normalized draft can never alias member state and
  an equivalent record (e.g. legacy `body-gold` normalizing to `hull-gold`) emits no frame.
- **True trailing window.** Timestamps `<= now - RATE_WINDOW_MS` are dropped before the quota check;
  the admitted timestamp is pushed before normalization, so admitted no-ops also consume quota
  while 11th-and-later frames are dropped silently (no state change, no broadcast, no error). The
  950/1000 ms boundary is pinned by the fake-clock test.
- **Reuse the T3 protocol and T4 metrics allow-lists.** No codec, frame-shape, allow-list or
  dependency change was needed; the metrics-enabled test proves the new broadcast encodes and
  counts without throwing.
- **Both test tiers.** Unit: the hub sequences with fake peers, a fake clock, the in-memory economy
  repository and the fake server registry. Integration: the existing `app.test.ts` customization
  flow over real live sockets now consumes the new `memberAppearance` frames with concrete
  envelopes. No tier exception is needed.
- **No user-facing documentation change in this task.** T17 owns the documentation pass for the
  feature (README, architecture, glossary); this change is internal server authority whose
  behavior is specified in `spec.md` § Real-time impact and `plan.md`. Nothing in
  `docs/architecture`/`docs/product`/`README.md` describes the hub's appearance projection yet.
- The R1 sequencing gate was released 2026-11-18 (`status.md`); `coin-economy` is `accepted`.

## Evidence

All commands were re-run on the final tree in the T6 finish pass (2026-11-19 10:06–10:07) and
exited `0`.

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
 ✓ src/game/hub.test.ts (212 tests) 313ms
 ✓ src/app.test.ts (38 tests) 2472ms
 Test Files  38 passed (38)
      Tests  1694 passed (1694)
   Start at  10:06:58
   Duration  3.39s (transform 5.81s, setup 0ms, collect 12.87s, tests 13.79s, environment 6ms, prepare 3.10s)

EXIT:0
```

`hub.test.ts` grew from 194 to 212 tests (+18: the
`public appearance projection (remote-spaceship-customization T6)` suite); `app.test.ts` stays at
38 tests (fixtures and frame consumption only). Backend total 1,676 → 1,694.

### `npm run coverage --workspace @cubeclicker/backend`

```
 Test Files  38 passed (38)
      Tests  1694 passed (1694)
   Start at  10:07:02

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.46 |    90.49 |   99.59 |   96.46 |
 src               |   96.78 |    90.56 |     100 |   96.78 |
  app.ts           |   95.85 |    86.84 |     100 |   95.85 | ...18-319,367-369
  cors.ts          |     100 |      100 |     100 |     100 |
 src/auth          |   95.74 |    83.13 |     100 |   95.74 |
  auth-routes.ts   |    80.7 |    54.19 |     100 |    80.7 | ...61-363,369-370
  auth-service.ts  |     100 |    81.75 |     100 |     100 | ...95,400,417,503
  config.ts        |     100 |      100 |     100 |     100 |
  ...repository.ts |   95.74 |     86.2 |     100 |   95.74 | ...77-778,834-847
  email.ts         |     100 |      100 |     100 |     100 |
  password.ts      |     100 |      100 |     100 |     100 |
  rate-limit.ts    |     100 |      100 |     100 |     100 |
  ...repository.ts |   96.53 |    85.48 |     100 |   96.53 | ...40-141,146-147
  ...repository.ts |    98.8 |    90.58 |     100 |    98.8 | 61-62,315
  ...repository.ts |   97.29 |    91.57 |     100 |   97.29 | 63-68
 src/db            |   98.02 |    93.75 |     100 |   98.02 |
  migrate-cli.ts   |   95.74 |       75 |     100 |   95.74 | 82-83
  ...ate-runner.ts |    97.1 |       96 |     100 |    97.1 | 107-108
  migrate.ts       |     100 |      100 |     100 |     100 |
  pool.ts          |     100 |      100 |     100 |     100 |
 src/game          |   96.25 |    94.92 |   99.13 |   96.25 |
  activity.ts      |     100 |      100 |     100 |     100 |
  broadcast.ts     |   97.12 |    95.65 |     100 |   97.12 | 137-138,231-232
  config.ts        |     100 |      100 |     100 |     100 |
  cubes.ts         |     100 |      100 |     100 |     100 |
  economy.ts       |     100 |      100 |     100 |     100 |
  hub.ts           |   91.36 |    89.09 |   98.59 |   91.36 | ...1833,1920-1923
  leaderboard.ts   |     100 |      100 |     100 |     100 |
  parts-v2.ts      |     100 |      100 |     100 |     100 |
  parts-v3.ts      |     100 |      100 |     100 |     100 |
  parts.ts         |     100 |      100 |     100 |     100 |
  players.ts       |     100 |      100 |     100 |     100 |
  protocol.ts      |   99.36 |     99.2 |   97.77 |   99.36 | 477-478,1088-1089
  servers.ts       |   99.01 |    98.71 |     100 |   99.01 | 289-290
  upgrades.ts      |   94.44 |    93.33 |     100 |   94.44 | 41-42
 src/observability |   99.67 |     96.5 |     100 |   99.67 |
  config.ts        |     100 |      100 |     100 |     100 |
  db-metrics.ts    |     100 |      100 |     100 |     100 |
  logging.ts       |     100 |      100 |     100 |     100 |
  metrics-route.ts |     100 |      100 |     100 |     100 |
  metrics.ts       |   99.45 |    93.54 |     100 |   99.45 | 251-252
  shutdown.ts      |     100 |    92.85 |     100 |     100 | 57
-------------------|---------|----------|---------|---------|-------------------
EXIT:0
```

Thresholds (≥ 80 on statements/branches/functions/lines) passed. `hub.ts` is
`91.36 / 89.09 / 98.59 / 91.36`, up from `91.12 / 88.69 / 98.48 / 91.12` at the T5 baseline: the
new authority paths are exercised, and no production file was excluded.

### AC-14 outbound measurements

- 24-member full-appearance `welcome` (`removedIds: []` on every member, full 11-entry
  `appearance` on every member, `customization` absent): **16,362 B ≤ 17,408 B**.
- Largest per-member `appearance` JSON: **435 B ≤ 550 B** (the 11 `FULL_APPEARANCE` ids).
- Worst `memberAppearance` frame: **492 B** for `playerId: 'p1'`, **493 B** for `playerId: 'p24'`.

The three per-frame/per-member byte counts were re-derived from the shipped `FULL_APPEARANCE`
fixture with Node's UTF-8 byte counter (same serialization as the wire):

```
appearance JSON bytes: 435
p1 memberAppearance bytes: 492
p24 memberAppearance bytes: 493
```

The 16,362 B welcome size is the measurement recorded by the T6 verification fixture run; the
shipped test (`pins the 24-member full-appearance welcome inside the AC-14 outbound budget`)
asserts the budget (`≤ 17,408 B`, `≤ 550 B` per member appearance) on the same fixture, and the
spec's planning-time note records 16,710 B for a slightly different fixture — both are inside the
same bound, which is the requirement. `MAX_MESSAGE_BYTES` is incoming-only and untouched.

## Acceptance audit

- **AC-10 — met.** `equipPart`/`unequipPart` keep catalog validation, ownership, standard-part
  allowance, legacy ids, the `not_owned`/`unknown_part`/`unknown_slot` errors and the
  no-op re-equip rule (the existing `re-equipping the already equipped part is a no-op` test still
  asserts `peer.messages()` is exactly `[]`). Accepted changes set the appearance on every member
  of the account before broadcasting (`updateMembersAppearance`), then emit one frame per changed
  member on that member's server. Evidence: `fans out one public frame per member for two tabs on
  the same server` asserts `[customizationUpdate, p1 frame, p2 frame]` for both tabs and
  `[p1 frame, p2 frame]` for a guest; `fans out one public frame per server when the account has a
  tab on each` asserts p1 on server 1 and p3 on server 2, never cross-server. `customizationUpdate`
  is unchanged in shape and remains account-scoped.
- **AC-11 — met.** A guest report with a wrong-slot id and an unknown id is normalized to just the
  valid entry (`{ 'wing-left': 'wing-left-gold' }`), stored, broadcast only to the other members
  (origin receives nothing), and later joiners see it in the roster. A report that normalizes to
  the stored record (legacy `body-gold` → `hull-gold`) sends no frame; a report that normalizes to
  `{}` sends the stored clearing frame. An account report is a silent no-op: no member frame, no
  error, and the persisted customization is exactly unchanged; a sibling tab still sees the
  persisted record and the next accepted equip builds on it. The > 11-entry rejection is the T3
  codec's (`protocol.test.ts`).
- **AC-12 — met.** The fake-clock test admits exactly 10 frames at `t = 0, 100, …, 900`, drops the
  11th at `t = 950` (10 frames observed, 0 origin echoes), and admits the next at `t = 1000`
  because the `t = 0` timestamp is forgotten at `<= now - 1000`. Dropped frames changed no state:
  a later joiner sees the 10th record, never the 11th. No frame, error or state change is emitted
  for the dropped attempts.
- **AC-13 — met.** (a) Fresh join: `welcome.roster[self]` and a sibling tab's `memberJoined` carry
  `{ hull: 'hull-obsidian' }` seeded from the persisted customization; a rejoin inside grace
  resumes with the same roster entry. (b) A guest starts `{}` on `welcome`/`memberJoined`; guest
  change/adoption/one-send behavior is T8/T13 (frontend) with `session.test.ts` evidence. (c) The
  full appearance survives a socket close inside grace and a rejoin (a resume sends no extra
  frame — the roster is authoritative); it travels on a cross-server move (`worldEntered` and the
  target server's `memberJoined` carry it); a final removal discards it and a new guest identity
  starts from `{}`.
- **AC-14 — met.** (a) 435 B worst appearance ≤ 550 B/700 B; 492 B/493 B worst frame ≤
  `MAX_MESSAGE_BYTES` (incoming-only) and inside the 700 B appearance bound. (b) 24-member
  `welcome` 16,362 B ≤ 17,408 B with `removedIds: []` and no `customization` on every member. (c)
  the metrics-enabled hub test (`counts a metrics-enabled memberAppearance broadcast without
  throwing`) asserts one `setAppearance` received, one `memberAppearance` encoded and one frame
  sent. Allow-lists are T4's; the privacy test additionally pins the public member keys
  (`appearance`, `gridSize`, `levelIndex`, `name`, `pitchSteps`, `playerId`, `position`,
  `removedIds`, `styleId`, `yawSteps`) with no account id or inventory.

## Deviations from spec

- **`app.test.ts` fixture catch-up (mechanical, AC-7).** Eight inline `MemberState` literals gained
  `appearance: {}` because the server projection now always emits the field; no assertion was
  weakened.
- **T5 integration flow extended.** The existing `app.test.ts` customization test now consumes the
  new public frames after each `customizationUpdate` — two `memberAppearance` frames on equip
  (`p1`, `p2`) and three on unequip (`p1`, `p2`, `p3`) — with exact expected envelopes. This is an
  extension, not a replacement: the `customizationUpdate` assertions are unchanged.
- **Test-shape notes.** The guest no-op case uses `{ hull: 'body-gold' }` (a legacy id that
  normalizes to the stored `hull-gold`, with a valid slot key so the codec admits it) to prove that
  an equivalent record emits no frame. The account silent-no-op test asserts the later equip fan-out
  as two concrete frames (`p1`/`p2`, both `{ hull: 'hull-obsidian', nose: 'nose-crimson' }`).
- No protocol, repository, metrics, frontend, package, compose, Docker or `.env*` change. No new
  dependency, schema or migration.

## Scope / diff checks

- `git diff --name-only` before staging showed exactly the task's three source files plus
  pre-existing unrelated documentation modifications (`docs/features/README.md`,
  `docs/features/coin-economy/reviews/code-r2.md`, `docs/features/coin-economy/status.md`), which
  are not staged.
- Out-of-scope diff check
  (`git diff --name-only -- src/backend/src/game/protocol.ts src/backend/src/game/protocol.test.ts
  src/backend/src/observability/metrics.ts src/backend/src/observability/metrics.test.ts
  src/backend/src/auth/economy-repository.ts src/backend/src/auth/economy-repository.test.ts
  src/frontend package.json package-lock.json compose.yaml compose.smoke.yaml
  src/backend/Dockerfile src/frontend/Dockerfile .env .env.local`) → empty.
- `hub.ts` no longer imports `parts-v2`; every equip/loot path resolves v3.
- The commit stages only `hub.ts`, `hub.test.ts`, `app.test.ts` and this log. No `git push`.
