# Build log — T12 (Documentation pass)

## Files owned
- `docs/product/glossary.md`

## Changes
- Added a new glossary term `upgrades` (coins spent to increase earning rate; upgrade levels and coin balances persisted per account) to `docs/product/glossary.md`, placed alphabetically after `upgrade` and before `verified account`.

## Proposed `docs/features/README.md` row diff (orchestrator applies on acceptance)
```diff
+| spending-upgrades | Spending & Upgrades (coin sinks, earn faster) | accepted | 2026-10-30 |
```
Applied after the `coin-economy` row, before the `States:` line. No other feature's row modified.

## No-change evidence

### `README.md` and `docs/architecture/*`
- `git status --porcelain -- README.md docs/architecture` → empty (no changes). Verified 2026-10-30.

### Container paths
- `git diff --exit-code HEAD -- compose.yaml compose.smoke.yaml 'src/backend/Dockerfile' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'` → exit 0 (no diff).
- `git status --porcelain -- compose.yaml compose.smoke.yaml 'src/backend/Dockerfile' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'` → empty.

## Verification
- `grep -q "upgrade" docs/product/glossary.md` — passed (exit 0).
- `test -z "$(git status --porcelain -- README.md docs/architecture)"` — passed (empty).
- `git diff --exit-code HEAD -- compose.yaml compose.smoke.yaml 'src/backend/Dockerfile' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'` — passed (exit 0).

## Notes
- No README/architecture/container changes required (no new ports, services, images, or env vars; AC-23).
- `docs/features/README.md` is orchestrator-owned and was not edited directly; only a proposed row diff is recorded above.