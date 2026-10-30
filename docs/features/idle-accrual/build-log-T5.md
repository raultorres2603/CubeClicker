# Build log — T5 — Integration coverage

Task: T5 (2026-10-30)
Files changed: src/backend/src/app.ts, src/backend/src/app.test.ts
What changed & why: Added a shared-clock test seam (`now`) to `buildApp` (wired into `HubDeps.now`, repository `now`, auth, rate limiter and session expiry) so integration tests can inject one clock; added three integration tests in `app.test.ts` covering stale `last_seen_at` accrual (with and without upgrades) and the below-threshold no-accrual case, asserting post-accrual totals and `economyUpdate` broadcast.
Decisions: Injected the clock via `BuildAppOptions.now` because F9 requires `HubDeps.now` and the repository's `now` to share one clock; app.ts wiring was the minimal change needed.
Evidence:
- `npm run lint` → pass (0 errors)
- `npm run typecheck` → pass (0 errors)
- `npm run test --workspace=src/backend` → 21 files, 630 tests passed
- `npm run coverage` (root) → backend All files 94.97% stmts / 86.19% branches / 99.65% funcs / 94.97% lines; frontend All files 95.19% / 95.09% / 96.89% / 95.19%; exit 0
Acceptance audit: AC-2 → met (welcome.economy coins = seeded + idleCoins); AC-5 → met (clock + stored timestamp server-side); AC-16 → met (post-accrual totals in welcome); AC-18 → met (coverage gate green).
Deviations from spec: files_owned listed only app.test.ts, but app.ts wiring change was required to inject the shared clock per F9; kept to a minimal test seam.