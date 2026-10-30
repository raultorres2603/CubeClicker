# Build log — T13 (Documentation pass)

Task: T13 (2026-10-30)
Files changed: docs/product/glossary.md

What changed & why: Added a "coins" glossary term (currency earned by destroying mini-cubes/cubes, persisted per account; guests earn locally only) to docs/product/glossary.md, inserted alphabetically between "click" and "cube". No README.md or docs/architecture/* changes required (no new ports/services/images/env vars).

Decisions: Minimal glossary-only edit per docs/architecture/documentation.md (accuracy + minimal diffs); no README/architecture edits because AC-19 confirms no containerization impact. docs/features/README.md is orchestrator-owned, so only a proposed row diff is recorded below for the orchestrator to apply on acceptance.

Proposed docs/features/README.md row diff (orchestrator to apply on acceptance):
```diff
+ | coin-economy | Coin Economy & Persistent In-Game Stats (coins earned by destroying mini-cubes/cubes, speed bonus, persisted per account) | building | 2026-10-30 |
```
(Appended after the last feature row, before the "States:" legend line. Orchestrator updates state to `accepted` and date on acceptance.)

"No change" evidence:
- README.md: no diff vs HEAD (no new commands/ports/images).
- docs/architecture/*: no diff vs HEAD (no new service/container; migration path unchanged).
- Container paths: unchanged (see T_final container diff gate).

Evidence:
- `grep -q "coins" docs/product/glossary.md` → doc gate OK
- `npm run lint` → no errors
- `npm run typecheck` → no errors (both workspaces)
- `npm test` → Test Files 42 passed (frontend), Tests 1028 passed; backend Test Files 20 passed, Tests 531 passed
- `npm run coverage` → exit 0; backend All files 95.17% stmts / 85.82% branch / 99.62% funcs / 95.17% lines; frontend All files 95.21% stmts / 94.98% branch / 96.78% funcs / 95.21% lines (all ≥ 80)
- Container diff gate: `git diff --exit-code HEAD -- compose.yaml compose.smoke.yaml 'src/backend/Dockerfile' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'` → exit 0; status empty

Acceptance audit: AC-19 → met (no containerization impact; glossary term added; no new service/image/port/env var).

Deviations from spec: none.