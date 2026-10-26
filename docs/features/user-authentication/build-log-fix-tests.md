# Build log — fix-tests — user-authentication corrective round 1 (F1 interaction tests)

Task: fix-tests (2026-10-26)
Files changed:
- `src/frontend/src/ui/AuthMenu.tsx` (F8: removed `autoFocus` from the menu `Login` button)
- `src/frontend/src/ui/AuthForms.tsx` (F3: `autoFocus` on the first input; F5: documented mount-only `initialError`)
- `src/frontend/src/App.tsx` (F3: `autoFocus` on the pending screen's `Back to login` button)
- `docs/features/user-authentication/build-log-fix-tests.md`

## Status: BLOCKED on F1

The MAJOR finding F1 asks for interaction-level coverage that drives the real
rendered `onClick`/`onSubmit` bindings. The frontend test environment is `node`
(see `src/frontend/vitest.config.ts`: `environment: 'node'`) and no DOM
implementation or testing library is available anywhere in the dependency tree:

- `src/frontend/package.json` devDependencies: only `@vitest/coverage-v8`, `vite`,
  `vitest`, `@vitejs/plugin-react`, react types. No `jsdom`, no `happy-dom`, no
  `@testing-library/*`.
- `package.json` (root) devDependencies: eslint, typescript, etc. No DOM test
  libraries.
- `node_modules` search (`find / -type d -name jsdom`, `find / -path *testing-library*`)
  returned no matches; `require('jsdom')` fails with "Cannot find module 'jsdom'".
- Global npm (`npm ls -g`) only has corepack and npm.

Per AGENTS.md, adding dependencies requires user approval, so I did NOT add any.
Per scope item 2, a minimal DOM shim via React's `act` is not feasible in a Node
environment without a DOM, and the source-reading guard described as the fallback
is explicitly acknowledged as weak. I therefore report `blocked` on F1 rather than
fabricating passing tests.

### Requested approval (exact commands)

Run from the repository root:

    npm install -D -w @cubeclicker/frontend jsdom @testing-library/react @testing-library/user-event

(or, equivalently, `cd src/frontend && npm install -D jsdom @testing-library/react @testing-library/user-event`)

Then, for the affected test files, add a per-file docblock as the first line:

    /** @vitest-environment jsdom */

to `src/frontend/src/App.test.tsx`, `src/frontend/src/ui/AuthMenu.test.tsx`, and
`src/frontend/src/ui/AuthForms.test.tsx` (or set `environment: 'jsdom'` in
`src/frontend/vitest.config.ts` for those files via `environmentMatchGlobs`).

After approval I will add the interaction tests:
- AuthMenu: clicking the rendered `Play as guest` button calls the injected
  `onPlayAsGuest` exactly once; clicking `Login`/`Register` switches views via
  `onSelect`/`onChoose`; `Cancel` returns to the menu.
- AuthForms: submitting the rendered login form with valid values calls
  `onLogin`/`onSubmit` with those values; submitting register calls `onRegister`;
  a thrown login error renders the exact error text in the DOM.
- App: with a mock session, clicking the rendered `Play as guest` button results
  in `session.join('guest')` being called and the menu unmounting.

These tests will be written to FAIL if the corresponding `onClick`/`onSubmit`
binding is removed (verified by temporarily reverting a binding locally).

## Safe MINORs addressed (F3, F5, F8; F6 already satisfied)

- F3: added `autoFocus` to the first input (username) of `AuthForms` and to the
  pending screen's primary `Back to login` button in `App.tsx`.
- F5: documented `initialError` as mount-only at the `useState` initializer in
  `AuthForms.tsx` (remount via `key` re-reads the prop); no behavior change.
- F6: `createAuthGate.verificationRequired` already guards with
  `if (closed()) return;` (present since `ee4a667`); no change required.
- F8: removed `autoFocus` from the menu's `Login` button in `AuthMenu.tsx`.

F2, F4, F7 left open per the brief (trade-offs/docs).

## Evidence
- `npm run lint` -> exit 0.
- `npm run typecheck` -> exit 0 (backend + frontend `tsc --noEmit`).
- `npm test` -> exit 0 (backend 18 files / 492 tests; frontend 34 files / 742 tests).
- `npm run coverage` -> exit 0 (thresholds 80/80/80/80):
  - backend: `All files | 94.66 | 84.32 | 99.6 | 94.66`
  - frontend: `All files | 92.46 | 91.65 | 93.67 | 92.46`
- `npm run build` -> exit 0 (`dist/assets/index-*.js 820.66 kB`).

## Acceptance audit
- F1 (interaction tests) -> unmet: blocked pending approval to add
  `jsdom` + `@testing-library/react` + `@testing-library/user-event` (see above).
- F3 -> met: `autoFocus` on first input + pending primary button.
- F5 -> met: mount-only documented in code comment.
- F6 -> met: guard already present.
- F8 -> met: `autoFocus` removed from menu `Login` button.
- F2, F4, F7 -> left open per brief.

## Deviations from spec
- None in behavior. No dependencies added. No backend/compose/docs (beyond feature
  artifact folder) modified.
