# Tasks — Spaceship Customization Minor Fixes (Hardening Follow-up)

Dependency overview: T1 ∥ T2 ∥ T4; T3 after T2; T5 after T1, T2, T3, T4

## T1 — Add `customization?` to backend protocol `welcome`/`worldEntered` variants `[P]`
depends_on: —
files_owned: src/backend/src/game/protocol.ts
verify: `npm run lint`, `npm run typecheck --workspace=src/backend`, `npm run test --workspace=src/backend`
acceptance: AC-1
status: [x]

## T2 — Add `customization?` to frontend protocol `welcome`/`worldEntered` variants `[P]`
depends_on: —
files_owned: src/frontend/src/multiplayer/protocol.ts
verify: `npm run lint`, `npm run typecheck --workspace=src/frontend`, `npm run test --workspace=src/frontend`
acceptance: AC-2
status: [x]

## T3 — Remove customization casts in `session.ts`
depends_on: T2
files_owned: src/frontend/src/game/session.ts
verify: `npm run lint`, `npm run typecheck --workspace=src/frontend`, `npm run test --workspace=src/frontend`
acceptance: AC-3
status: [x]

## T4 — Defensive-copy `parts`/`appearance` on engine cube-completion grant `[P]`
depends_on: —
files_owned: src/frontend/src/game/engine.ts, src/frontend/src/game/engine.test.ts
verify: `npm run lint`, `npm run typecheck --workspace=src/frontend`, `npm run test --workspace=src/frontend`, `npm run coverage --workspace=src/frontend`
acceptance: AC-4, AC-5
status: [x]

## T5 — Verify & integrate `[seq]`
depends_on: T1, T2, T3, T4
files_owned: (none)
verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `git diff --exit-code -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile src/backend/src/server.ts`
acceptance: AC-1, AC-2, AC-3, AC-4, AC-5
status: [x]