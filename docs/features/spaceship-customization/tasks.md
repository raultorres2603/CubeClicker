# Tasks — Spaceship Customization

Dependency overview: T1 ∥ T2 ∥ T5 ∥ T6; T3 ← T2; T4 ← T1,T3,T5; T8 ← T6; T7 ← T5,T8; T9 ← T6,T8; T10 ← T6,T9; T11 ← T7,T8; T12 ← T10,T11; T13 ← T12; T14 ← T1..T13

## T1 — Backend parts catalog (pure) `[seq]`
depends_on: —
files_owned: src/backend/src/game/parts.ts, src/backend/src/game/parts.test.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/backend`, `npm test --workspace @cubeclicker/backend -- parts`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-3, AC-4, AC-7, AC-11
status: [x]

## T2 — DB migration 005 + schema.sql mirror `[seq]`
depends_on: —
files_owned: src/backend/src/db/migrations/005_spaceship_customization.sql, src/backend/src/db/schema.sql
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/backend`
acceptance: AC-9
status: [x]

## T3 — Economy repository customization methods `[seq]`
depends_on: T2
files_owned: src/backend/src/auth/economy-repository.ts, src/backend/src/auth/economy-repository.test.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/backend`, `npm test --workspace @cubeclicker/backend -- economy-repository`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-9, AC-10
status: [x]

## T4 — Hub: grant, open lootbox, equip part, broadcast `[seq]`
depends_on: T1, T3, T5
files_owned: src/backend/src/game/hub.ts, src/backend/src/game/hub.test.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/backend`, `npm test --workspace @cubeclicker/backend -- hub`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-10, AC-15, AC-16
status: [x]

## T5 — Backend protocol additions `[seq]`
depends_on: —
files_owned: src/backend/src/game/protocol.ts, src/backend/src/game/protocol.test.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/backend`, `npm test --workspace @cubeclicker/backend -- protocol`, `npm run coverage --workspace @cubeclicker/backend`
acceptance: AC-11
status: [x]

## T6 — Frontend parts catalog + params helper `[P]`
depends_on: —
files_owned: src/frontend/src/game/parts.ts, src/frontend/src/game/parts.test.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend -- parts`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-13
status: [x]

## T7 — Frontend protocol mirror `[seq]`
depends_on: T5, T8
files_owned: src/frontend/src/multiplayer/protocol.ts, src/frontend/src/multiplayer/protocol.test.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend -- protocol`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-11
status: [x]

## T8 — Engine customization state (guest + adopt) `[seq]`
depends_on: T6
files_owned: src/frontend/src/game/engine.ts, src/frontend/src/game/engine.test.ts, src/frontend/src/game/types.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend -- engine`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-2, AC-5, AC-8, AC-10
status: [x]

## T9 — Spaceship render parameterized by appearance + scene apply `[seq]`
depends_on: T6, T8
files_owned: src/frontend/src/render/spaceship.ts, src/frontend/src/render/spaceship.test.ts, src/frontend/src/render/scene.ts, src/frontend/src/render/scene-spaceship.test.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend -- spaceship`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-13, AC-14
status: [x]

## T10 — Customization panel + live preview UI `[seq]`
depends_on: T6, T9
files_owned: src/frontend/src/ui/SpaceshipCustomizationPanel.tsx, src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx, src/frontend/src/ui/SpaceshipPreview.tsx, src/frontend/src/ui/SpaceshipPreview.test.tsx, src/frontend/src/ui/app.css
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend -- SpaceshipCustomization`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-12, AC-13
status: [x]

## T11 — Session customization commands `[seq]`
depends_on: T7, T8
files_owned: src/frontend/src/game/session.ts, src/frontend/src/game/session.test.ts
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend -- session`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-3, AC-5, AC-6, AC-8, AC-10
status: [x]

## T12 — App wiring (panel + menu toggle) `[seq]`
depends_on: T10, T11
files_owned: src/frontend/src/App.tsx, src/frontend/src/App.test.tsx
verify: `npm run lint`, `npm run typecheck --workspace @cubeclicker/frontend`, `npm test --workspace @cubeclicker/frontend -- App`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-12
status: [x]

## T13 — Documentation pass `[seq]`
depends_on: T12
files_owned: README.md, docs/product/glossary.md
verify: `npm run lint`, `grep -q "spaceship-customization" README.md || true`, `grep -q "lootbox" docs/product/glossary.md`
acceptance: (chore) documentation impact
status: [x]

## T14 — Verify & integrate `[seq]`
depends_on: T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13
files_owned: (none — verification only)
verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`, `npm run build`, `git diff --exit-code -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile src/backend/src/server.ts`
acceptance: AC-17, AC-18
status: [x]