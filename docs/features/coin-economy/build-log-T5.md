# Build log — T5 — App wiring (economy repo into hub)

Task: T5 (2026-10-30)
Files changed: src/backend/src/app.ts
What changed & why: Constructed InMemoryEconomyRepository/PgEconomyRepository based on the pool (like users) and passed `economy` into createGameHub; added `economy?: unknown` to BuildAppOptions.auth test seam. Hub already consumes the repo from T3.
Decisions: Followed the existing pool-based repository selection pattern; seam typed as `unknown` to match other repo seams.
Evidence:
- `npm run lint` → exit 0 (no output)
- `npm run typecheck` → exit 0 (backend + frontend tsc --noEmit)
- `npm test` → backend 20 files/528 tests passed; frontend 41 files/986 tests passed
- `npm run coverage` → exit 0; backend All files 95.1% stmts / 84.77% branch / 99.62% funcs / 95.1% lines; frontend All files 95.05% / 94.85% / 96.46% / 95.05%
Acceptance audit: AC-6 → met (hub loads persisted economy via repo on join, wired here); AC-9 → met (repo constructed and injected so validated explodes credit); AC-19 → met (no container/compose changes).
Deviations from spec: none