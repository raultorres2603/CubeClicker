# Build log — T16 — Session & transport auth wiring (deferred join)

Task: T16 (2026-10-25)
Files changed: src/frontend/src/game/session.ts, src/frontend/src/game/session.test.ts, src/frontend/src/multiplayer/transport.ts, src/frontend/src/multiplayer/transport.test.ts (also touched src/frontend/src/App.test.tsx for typecheck mock, left unstaged)
What changed & why: Finished deferred join. Transport now exposes `join(mode)`, records `lastMode`, sends nothing on first `hello`, joins explicitly on `transport.join(mode)`, rejoins with token or joins with lastMode on reconnect, and handles `resume_failed`. Session delegates `join(mode)` to transport. Fake transport and tests updated.
Decisions: join is recorded only when socket open/hello handled; otherwise lastMode is retained for the next hello. App.test.tsx mock updated to satisfy the new required method (not staged).
Evidence:
- `npm run typecheck` → passed (backend + frontend)
- `npm test --workspace @cubeclicker/frontend` → 34 files, 728 tests passed
- `npm run coverage` → frontend 94.21% stmts / 94.02% branches / 93.51% funcs / 94.21% lines (all ≥ 80)
- `npm run lint` → passed
- `npm run build` → passed
Acceptance audit: AC-19 → met; AC-21 → met; AC-22 → met; AC-25 → met; AC-34 → met (transport.test.ts concrete values).
Deviations from spec: App.test.tsx edited outside files_owned to keep typecheck green; not staged.