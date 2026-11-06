# Build log — T2 (DB migration 005 + schema.sql mirror)

Task: T2 — DB migration 005 + schema.sql mirror
Files owned: src/backend/src/db/migrations/005_spaceship_customization.sql, src/backend/src/db/schema.sql

## Changes
- Created `src/backend/src/db/migrations/005_spaceship_customization.sql` adding columns to `user_economy`: `lootboxes INT NOT NULL DEFAULT 0`, `keys INT NOT NULL DEFAULT 0`, `parts JSONB NOT NULL DEFAULT '{}'::jsonb`, `appearance JSONB NOT NULL DEFAULT '{}'::jsonb` (idempotent, `ADD COLUMN IF NOT EXISTS`).
- Mirrored the four columns in `src/backend/src/db/schema.sql` (`user_economy`).

## Verification

### npm run lint
```
> lint
> eslint .
```
(exit 0, no errors)

### npm run typecheck --workspace @cubeclicker/backend
```
> typecheck
> tsc --noEmit
```
(exit 0, no errors)

### npm test --workspace @cubeclicker/backend
```
Test Files  22 passed (22)
Tests  649 passed (649)
```

### Migration syntax + idempotency (podman postgres:16-alpine)
Applied migrations 001–005 in order; 005 reported:
```
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
```
Re-running 005:
```
NOTICE:  column "lootboxes" of relation "user_economy" already exists, skipping
...
NOTICE:  column "appearance" of relation "user_economy" already exists, skipping
```
Idempotent. Container stopped after validation.