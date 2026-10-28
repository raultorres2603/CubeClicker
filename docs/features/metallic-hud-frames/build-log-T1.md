# Build log — T1 (metallic-hud-frames)

## Scope

Implemented metallic frame system in `src/frontend/src/ui/app.css` plus contract guards in `app.css.test.ts` and `theme.test.ts`. No markup/component changes.

## BASE

`BASE=824cb229b7f86d64f6a463db6068a80cfc6d2aab` (`git merge-base main HEAD`).

## Verify commands

- `npm run lint` — exit 0
- `npm run typecheck` — exit 0
- `npm test --workspace @cubeclicker/frontend` — exit 0 (985 tests passed)
- `npm run coverage --workspace @cubeclicker/frontend` — exit 0 (thresholds met)
- Markup gate:
  - `git diff --exit-code "$BASE"...HEAD -- src/frontend/src/App.tsx ... src/frontend/src/ui/theme.ts` — exit 0
  - `test -z "$(git status --porcelain -- ...)"` — exit 0

## Notes

- All `border-radius` declarations are `0`.
- Sheen uses `inset: 0` (no negative inset).
- Input well merged into the single existing `.auth-input, .verification-pending input` rule.