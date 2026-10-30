# Build log — T9 — Session wiring

Task: T9 (2026-10-30)
Files changed: src/frontend/src/game/session.ts, src/frontend/src/game/session.test.ts, src/frontend/src/multiplayer/protocol.ts, src/frontend/src/App.test.tsx
What changed & why: Added upgrade adoption on welcome/worldEntered/upgradesUpdate; session.purchaseUpgrade (account sends message, guest local debit); joinedMode tracking exposed as MultiplayerSnapshot.mode with cache invalidation; frontend protocol welcome/worldEntered gains upgrades field for type access.
Decisions: mode made optional on MultiplayerSnapshot to keep typecheck green pre-T11; protocol.ts updated (T7 follow-up) so session can read message.upgrades.
Evidence:
- `npm run lint` → pass (no output)
- `npm run typecheck` → pass (no output)
- `npm test --workspace @cubeclicker/frontend` → 44 files, 1099 tests passed
- `npm run coverage --workspace @cubeclicker/frontend` → All files 95.19% statements, 95.09% branches, 96.89% functions, 95.19% lines; session.ts 89.76%
Acceptance audit: AC-9 → met (upgradesUpdate handling + publish); AC-10 → met (guest path local debit, no message); AC-13 → met (upgradesUpdate replaces levels); AC-15 → met (welcome adopts upgrades).
Deviations from spec: mode optional rather than required (T11 defaults to 'guest'); protocol.ts edit outside files_owned but required for typecheck.