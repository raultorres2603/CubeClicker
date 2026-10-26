# Build log — fix-tests — user-authentication corrective round 1 (F1 interaction tests)

Task: fix-tests (2026-10-26)
Files changed:
- `src/frontend/package.json` + lockfile (added devDeps: jsdom, @testing-library/react, @testing-library/user-event)
- `src/frontend/src/App.test.tsx` (jsdom docblock; +3 interaction tests)
- `src/frontend/src/ui/AuthMenu.test.tsx` (jsdom docblock; +5 interaction tests)
- `src/frontend/src/ui/AuthForms.test.tsx` (jsdom docblock; +6 interaction tests)
- `docs/features/user-authentication/build-log-fix-tests.md`

What changed & why: enabled jsdom + RTL per user approval to add DOM-driven interaction tests that exercise the rendered `onClick`/`onSubmit` bindings (F1). Kept all pre-existing SSR tests. Added per-file `/** @vitest-environment jsdom */` docblocks (preferred over global change). Mutation-checked bindings.

Decisions: per-file jsdom docblock (global default stays node). No other deps added. No source changes this round (bindings already present).

Dependency install evidence:
- `npm install -D -w @cubeclicker/frontend jsdom @testing-library/react @testing-library/user-event` → added 47 packages, audited 402.
- `npm ci` → added 399 packages, audited 402 (ci-clean).
- Installed versions: jsdom ^30.1.3, @testing-library/react ^16.3.3, @testing-library/user-event ^14.6.8.

Test additions:
- AuthMenu.test.tsx: Play as guest click → onPlayAsGuest called exactly once; Login/Register clicks → onSelect+onChoose with right view; Cancel returns to menu; focus first input.
- AuthForms.test.tsx: login submit → onLogin with entered values; legacy onSubmit path; register submit → onRegister; thrown login error renders exact text; focus first input (login/register).
- App.test.tsx: Play as guest click → session.join('guest') once + menu unmounts; login success drives form submit → retryConnection then join('account') order; failed login → error text + no join.

Mutation checks:
- AuthMenu: commented `onClick={handleGuest}` → "Play as guest" interaction test failed (1 failed). Restored. Verified via git diff.
- AuthForms: removed `onSubmit={handleSubmit}` → 4 interaction tests failed. Restored. Verified via git diff.

Gate outputs:
- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0 (backend + frontend).
- `npm test` → exit 0 (backend 18 files/492 tests; frontend 34 files/756 tests).
- `npm run coverage` → exit 0:
  - backend: All files 94.66 / 84.32 / 99.60 / 94.66
  - frontend: All files 93.72 / 93.78 / 96.20 / 93.72
- `npm run build` → exit 0 (dist/assets/index-*.js 820.66 kB).
- Banned-matcher grep over changed test files → no matches.
- AuthMenu function coverage: 100% (was 20%); AuthForms function coverage: 100% (was 66.67%).

Acceptance audit:
- F1 → met: DOM interaction coverage added for all three files; tests fail when binding removed (mutation-checked).
- Pre-existing tests retained (756 total vs 742 prior +14).

Deviations from spec: none in behavior. No backend/compose/docs (beyond feature artifact) modified. Only approved deps added.