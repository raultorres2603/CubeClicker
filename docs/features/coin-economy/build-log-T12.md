# Build log — T12 (Backend integration tests)

## Scope

Extended `src/backend/src/app.test.ts` with three integration tests (account join with
seeded economy repo, explode credits + economyUpdate, guest no persist) using the
in-memory repo via `BuildAppOptions.auth.economy`.

## Files changed

- `src/backend/src/app.test.ts`

## Verification

```
$ npm run typecheck --workspace @cubeclicker/backend
> tsc --noEmit
(no errors)

$ npm run lint
> eslint .
(no errors)

$ npm test --workspace @cubeclicker/backend
Test Files  20 passed (20)
Tests  531 passed (531)

$ npm run coverage --workspace @cubeclicker/backend
All files  95.17% stmts / 85.82% branch / 99.62% funcs / 95.17% lines
app.ts     80.54% stmts / 84.09% branch / 91.66% funcs / 80.54% lines
```

All thresholds ≥ 80% met.

## Commit

feat(coin-economy): T12 backend integration tests for economy