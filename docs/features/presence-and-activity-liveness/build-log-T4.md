# Build log — T4 — Frontend protocol mirror

Task: T4 (`presence-and-activity-liveness`, 2026-11-16)
Files changed:

- `src/frontend/src/multiplayer/protocol.ts`
- `src/frontend/src/multiplayer/protocol.test.ts`
- `docs/features/presence-and-activity-liveness/build-log-T4.md`

## What changed & why

1. Mirrored `ACTIVITY_EVENT_TTL_MS = 5000` in the frontend protocol catalog (the shared
   activity eligibility/display lifetime; the backend already exports it from T1).
2. Mirrored the additive, self-only client frame `{ type: 'leave' }` in `ClientMessage` and
   in `parseClientMessage` (exactly the empty payload; every extra field is dropped).
3. Added **no** `ServerMessage` variant and no wire-shape/version change: the outcome travels
   on the existing `memberLeft { reason: 'left' }`.
4. Extended the header doc comment to describe the `leave` frame and the mirrored TTL.
5. Added parity tests replaying the backend's T1 fixtures verbatim plus AC-10 shape checks.

## Parity evidence

The `leave` fixtures and expectations are copied verbatim from
`src/backend/src/game/protocol.test.ts` (`client leave — additive self-only frame (AC-8)`,
`ACTIVITY_EVENT_TTL_MS (AC-11)`): exact valid frame, forged `playerId`/`reason`/nested extras
dropped, re-encoded frame exactly `{"type":"leave"}`, malformed/unknown variants rejected
(`leave` unterminated, trailing data, `LEAVE`, leading/trailing spaces, `leaveMember`), and
no client message can remove another member (`memberLeft` frames → `bad_message`).

Fixture-set extraction from both test files (a dependency-free one-liner):

```
$ node -e '<extracts every single-quoted {"type":…} frame literal from the "client leave"
describe block in both test files and compares the sorted sets>'
backend : ["{\"type\":\" leave\"}","{\"type\":\"LEAVE\"}","{\"type\":\"leave \"}","{\"type\":\"leave\"","{\"type\":\"leave\",\"playerId\":\"p2\",\"reason\":\"left\",\"nested\":{\"a\":[1]}}","{\"type\":\"leave\",\"playerId\":\"p2\"}","{\"type\":\"leave\"}","{\"type\":\"leave\"} trailing","{\"type\":\"leaveMember\",\"playerId\":\"p2\"}","{\"type\":\"memberLeft\",\"playerId\":\"p2\",\"reason\":\"left\"}","{\"type\":\"memberLeft\"}"]
frontend: ["{\"type\":\" leave\"}","{\"type\":\"LEAVE\"}","{\"type\":\"leave \"}","{\"type\":\"leave\"","{\"type\":\"leave\",\"playerId\":\"p2\",\"reason\":\"left\",\"nested\":{\"a\":[1]}}","{\"type\":\"leave\",\"playerId\":\"p2\"}","{\"type\":\"leave\"}","{\"type\":\"leave\"} trailing","{\"type\":\"leaveMember\",\"playerId\":\"p2\"}","{\"type\":\"memberLeft\",\"playerId\":\"p2\",\"reason\":\"left\"}","{\"type\":\"memberLeft\"}"]
leave fixture parity: IDENTICAL 11/11
EXIT=0
```

AC-10 end-state checks in the frontend suite:

- `parseServerMessage('{"type":"leave"}')` and `parseServerMessage('{"type":"leave","playerId":"p2"}')`
  are `{ ok: false, error: 'bad_message' }` → **no server catalog variant was added**.
- A `welcome` frame carrying `"presence":"connected","connected":true` decodes to exactly the
  pinned `Placement` → **no presence field is part of the server shape**.
- The pinned representative `WELCOME_TEXT` still decodes to exactly `{ type: 'welcome', ...PLACEMENT }`.
- The pre-existing `ServerMessage`, `MemberState`, `LeaderboardSnapshot`, `ActivityEvent`,
  placement (`welcome`/`worldEntered`) and activity-ring suites are green unchanged.

## Test tiers

- **Unit:** the `leave` decoder matrix and the TTL constant, pure text-in/data-out (no I/O).
- **Integration/contract:** the parity replay of the backend T1 fixture set against this
  decoder (the frontend half of the wire contract; the frontend `parseServerMessage` is the
  transport's real decode path). The live socket boundary of this feature is owned by T3
  (hub), T6 (session send) and T7 (containerized smoke); this task adds no runtime
  integration surface of its own — documented exception for a pure protocol mirror.

## Verify — raw output

```
$ npm run lint
> lint
> eslint .
lint EXIT=0
```

```
$ npm run typecheck
> typecheck
> npm run typecheck --workspaces --if-present
> typecheck
> tsc --noEmit
> typecheck
> tsc --noEmit
typecheck EXIT=0
```

```
$ npm test --workspace @cubeclicker/frontend
 ✓ src/multiplayer/protocol.test.ts (554 tests) 43ms
 ...
 Test Files  74 passed (74)
      Tests  2262 passed (2262)
   Duration  4.41s (transform 8.95s, setup 0ms, collect 25.27s, tests 13.65s, environment 12.05s, prepare 6.00s)
```

(the `protocol.test.ts` suite runs 554 tests, 14 of them added by T4: 3 valid/extra-field/
re-encode cases, 6 malformed `it.each` cases, 1 no-remote-removal, 1 TTL pin, and 3
server-catalog-unchanged cases; the file totals include pre-existing suites.)

```
$ npm run coverage --workspace @cubeclicker/frontend
 ✓ src/multiplayer/protocol.test.ts (554 tests) 43ms
 Test Files  74 passed (74)
      Tests  2262 passed (2262)
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.63 |    96.35 |    97.8 |   96.63 |
 src/multiplayer   |   94.52 |    97.12 |   96.55 |   94.52 |
  protocol.ts      |   91.85 |    97.15 |   92.85 |   91.85 |
EXIT=0
```

Coverage gate: statements 96.63, branches 96.35, functions 97.8, lines 96.63 (all ≥ 80);
`src/multiplayer/protocol.ts` 91.85 / 97.15 / 92.85 / 91.85. No exclusion or threshold change.

```
$ git diff --check
EXIT=0
```

## Acceptance audit

- **AC-8 — `leave` is server-authoritative and self-only.** Met (frontend half). The frontend
  catalog accepts exactly `{ "type": "leave" }` → `{ ok: true, message: { type: 'leave' } }`,
  drops `playerId`/`reason`/nested extras, re-encodes to exactly `{"type":"leave"}`, rejects
  every malformed/unknown variant with `bad_message`, and exposes no client message that can
  remove another member (`memberLeft` → `bad_message`). Hub authority/no-member-for-non-joined
  and the not-joined `error` are T3's evidence (`hub.test.ts`).
- **AC-10 — No wire-shape change and no protocol version bump.** Met. No `ServerMessage`
  variant added (`leave` as a server frame is `bad_message`); `MemberState`,
  `LeaderboardSnapshot`, `ActivityEvent`, placement (`welcome`/`worldEntered`) declarations are
  untouched; a `presence`/`connected` extra is dropped; the pinned representative `welcome`
  fixture decodes byte-for-byte to the same `Placement`.
- **AC-11 — TTL constant.** Met. `ACTIVITY_EVENT_TTL_MS === 5000` exported and pinned in the
  frontend mirror; the server boundary behaviour is T2's `activity.test.ts` evidence.

## Deviations from spec

None. Scope kept to `files_owned`; no dependency, script, coverage or assertion change. Only
the two owned frontend files plus this log are staged (the concurrent T2 backend edits were
left unstaged). No push.
