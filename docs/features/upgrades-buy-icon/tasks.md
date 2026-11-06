# Tasks — Upgrades panel: buy icon (HUD improvement)

Dependency overview: T1 → T2, T3; T2, T3 → T4

## T1 — Make buy button icon-only with accessible name `[seq]`

depends_on: —
files_owned: src/frontend/src/ui/UpgradesPanel.tsx, src/frontend/src/ui/UpgradesPanel.test.tsx
verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`
acceptance: AC-1, AC-2, AC-3, AC-4, AC-6, AC-9
status: [x]

Notes: Remove the "Buy" text child from the buy `<button>`; add `aria-label="Buy"`. Update `UpgradesPanel.test.tsx` button assertions to the new forms (disabled: `<button type="button" aria-label="Buy" disabled=""></button>`; enabled: `<button type="button" aria-label="Buy"></button>`), including maxed/below-cost (no enabled form), affordable (enabled form present), and guest (enabled form present). Keep disabled/affordability logic and `onClick` guard unchanged.

## T2 — Update App.test.tsx golden shell string `[P]`

depends_on: T1
files_owned: src/frontend/src/App.test.tsx
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-6, AC-7, AC-9
status: [x]

Notes: In the welcomed-branch golden string, replace each `<button type="button" disabled="">Buy</button>` with `<button type="button" aria-label="Buy" disabled=""></button>` (3 occurrences). No production code change.

## T3 — Add CSS icon override + guard test `[seq]`

depends_on: T1
files_owned: src/frontend/src/ui/app.css, src/frontend/src/ui/app.css.test.ts
verify: `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend`
acceptance: AC-5, AC-6, AC-7, AC-9
status: [x]

Notes: Add `.upgrades-panel button::before { content: '+'; }` (or the settled glyph per Q-1) overriding the inherited '▾'. Add a CSS guard in `app.css.test.ts` asserting a `.upgrades-panel button::before` rule with a `content:` declaration exists. Keep the change scoped to the icon override; no other styling changes.

## T4 — Verify & integrate `[seq]`

depends_on: T1, T2, T3
files_owned: —
verify: `npm run lint`, `npm run typecheck`, `npm test`, `npm run coverage`
acceptance: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9
status: [x]

Notes: Run the full verification suite. Confirm via `git diff --name-only` that production changes are limited to `src/frontend/src/ui/UpgradesPanel.tsx` and `src/frontend/src/ui/app.css` (AC-7) and that no container/backend paths changed (AC-8). Confirm no "Buy" text remains in the button (`grep -n "Buy" src/frontend/src/ui/UpgradesPanel.tsx` should not match the button). Proposed documentation diff (none required beyond the feature index row, which is orchestrator-owned per `docs/architecture/documentation.md`).