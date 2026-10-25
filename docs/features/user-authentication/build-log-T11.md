# Build Log — T11 (WS auth integration)

## Summary

Completed T11 across the 8 owned files: backend composition root wires `AuthConfig`/pool/repos/service/cookie/routes/hub with a `SessionResolver`; hub gains `AccountSession`, join modes, account resume validation, and `identity` on placement; protocol gains `mode` on join, `identity` on welcome/worldEntered, and new error codes `account_unverified`/`not_authenticated`; frontend protocol mirror updated for parity. `transport.test.ts` welcome fixtures updated to include `identity`.

## Files changed

- src/backend/src/app.ts
- src/backend/src/app.test.ts (no edits needed; existing suite green)
- src/backend/src/game/hub.ts
- src/backend/src/game/hub.test.ts
- src/backend/src/game/protocol.ts
- src/backend/src/game/protocol.test.ts
- src/frontend/src/multiplayer/protocol.ts
- src/frontend/src/multiplayer/protocol.test.ts
- src/frontend/src/multiplayer/transport.test.ts (fixture-only identity update)

## Verification evidence

### Lint
Command: `npm run lint`
Result: exit 0, no output (clean).

### Typecheck
Command: `npm run typecheck`
Result: exit 0
- backend: `tsc --noEmit` exit 0
- frontend: `tsc --noEmit` exit 0

### Tests
Command: `npm test`
Result: exit 0
- backend: Test Files 18 passed (18), Tests 492 passed (492)
- frontend: Test Files 29 passed (29), Tests 683 passed (683)

### Coverage
Command: `npm run coverage`
Result: exit 0
- backend: All files 94.42% statements / 84.52% branches / 99.6% functions / 94.42% lines (≥80%)
- frontend: All files 95.57% statements / 95.3% branches / 97.14% functions / 95.57% lines (≥80%)

## Acceptance audit (T11)

- AC-4: hub `join { mode: 'account' }` on unverified session → `error { code: 'account_unverified' }`; guest join succeeds. Implemented in `hub.ts handleJoin`.
- AC-21: verified account session joins as account; member display name = username; identity stable. Implemented via `accountId`/`name` assignment and `identity` on placement.
- AC-23: backend resolves account session from upgrade cookie; connections without valid session are guests. Implemented in `app.ts sessionResolver` + `hub.attach(peer, accountSession)`.
- AC-24: (see AC-4) `account_unverified` for unverified; `not_authenticated` for no session.
- AC-25: reconnect preserves account identity via `rejoin { token }` with account validation; post-grace new member. Implemented in `handleRejoin`.
- AC-26: server authority; client-supplied account ids/verified flags ignored. Mode is the only client input; identity resolved server-side.
- AC-35: account resume token-based; hub validates token's member `accountId` == connection `userId` and verified; `join { mode: 'account' }` always creates new member. Implemented.

## Protocol parity

- `join` gains optional `mode: 'account' | 'guest'` on both sides.
- `welcome`/`worldEntered` carry `identity`.
- New error codes `account_unverified`, `not_authenticated` on both sides.
