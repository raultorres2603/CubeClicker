# Build log — F12 — banned matchers in store.test.ts

Task: F12 (2026-10-25)
Files changed:
- src/frontend/src/auth/store.test.ts

What changed & why: Replaced 4 banned-matcher occurrences in store.test.ts with concrete assertions: two weak existentials (`expect(defaultStore).toBeDefined()` / `expect(authStore).toBeDefined()`) became `expect(typeof …getSnapshot).toBe('function')`; two argument-unchecked `expect(fetchMock).toHaveBeenCalled()` became `toHaveBeenCalledWith` with concrete URL/method/credentials/headers. No behavior change.

Decisions:
- Used `typeof …getSnapshot === 'function'` to concretely verify the default/auth store instances expose the store API.
- Replaced `toHaveBeenCalled()` with full fetch-arg assertions mirroring the existing login/register tests, including the baseUrl/credentials 'omit' variant.

Evidence:
- `npm run lint` → exit 0
- `npm run typecheck` → exit 0 (backend + frontend `tsc --noEmit`)
- `npm test --workspace=src/frontend` → exit 0 (34 files / 728 tests)
- `npm run coverage --workspace=src/frontend` → exit 0
  - frontend: All files 92.62% stmts / 92.36% branch / 92.91% funcs / 92.62% lines
- banned-matcher grep (store.test.ts) → 0 occurrences of `toHaveBeenCalled()` / `toBeDefined()` / `expect.any` / `*Containing`
- project banned-matcher count → 6 (all pre-existing, out of scope)

Acceptance audit: F12 → met (store.test.ts no longer contains the 4 banned matchers; tests pass; coverage ≥ 80%).
Deviations from spec: none.