# Build log — T13 (Documentation pass)

## Files written
- `README.md`
- `docs/product/glossary.md`

## Changes
- `README.md`: added a `## Gameplay` section mentioning the Spaceship Customization menu (appearance editor), lootboxes, and keys, plus a pointer to the `spaceship-customization` feature folder. Run instructions, commands, configuration, and container references are unchanged.
- `docs/product/glossary.md`: added glossary terms `appearance`, `key`, `lootbox`, and `part` (alphabetically placed), defining each per the feature spec and consistent with README/architecture terminology. No second name introduced for an already-defined concept.

## Proposed `docs/features/README.md` row diff (orchestrator applies on acceptance)
```diff
+| spaceship-customization | Spaceship Customization (lootboxes, keys, parts, appearance editor) | building | 2026-11-05 |
```
Appended after the last feature row, before the "States:" legend line. No other feature's row modified. (Orchestrator updates state to `accepted` and date on acceptance.)

## No-change evidence

### `docs/architecture/*` and container paths
- `git diff --exit-code HEAD -- docs/architecture compose.yaml compose.smoke.yaml 'src/backend/Dockerfile' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile' 'src/backend/src/server.ts'` → exit 0 (no diff).
- `git status --porcelain -- docs/architecture compose.yaml compose.smoke.yaml 'src/backend/Dockerfile' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile' 'src/backend/src/server.ts'` → empty.

## Verification

### `npm run lint`
```
> lint
> eslint .
```
Exit 0.

### grep checks
- `grep -q "spaceship-customization" README.md` → exit 0 (PASS).
- `grep -q "lootbox" README.md` → exit 0 (PASS).
- `grep -q "lootbox" docs/product/glossary.md` → exit 0 (PASS).
- `grep -q "key" docs/product/glossary.md` → exit 0 (PASS).
- `grep -q "part" docs/product/glossary.md` → exit 0 (PASS).
- `grep -q "appearance" docs/product/glossary.md` → exit 0 (PASS).

## Notes
- `docs/features/README.md` is orchestrator-owned and was not edited directly; only a proposed row diff is recorded above.
- Run instructions and container assets are unaffected (AC-18).