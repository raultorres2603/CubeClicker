# Build log — T12 — Frontend auth API client
Task: T12 (2026-10-25)
Files changed: src/frontend/src/auth/api.ts, src/frontend/src/auth/api.test.ts
What changed & why: Added a fetch-based client wrapping /auth/* (register, login, verify, resend-verification, logout, me) with credentials: 'include', JSON parsing, and typed AuthError failures; supports flexible input shapes and a createAuthApi factory for fetch/baseUrl injection. Added 28 unit tests with a fake fetch.
Decisions: Relative default base URL (`/auth/...`) to match the same-origin route shape; fetch is resolved at call time so the default singleton picks up a stubbed global fetch; aliases provided for common method names (signIn/login, etc.) to ease T13/T14 integration.
Evidence:
- `npx vitest run src/frontend/src/auth/api.test.ts` → Test Files 1 passed, Tests 28 passed.
- `npx tsc --noEmit ... src/frontend/src/auth/api.ts` → no errors.
- `npx eslint src/frontend/src/auth/api.ts src/frontend/src/auth/api.test.ts` → no output (clean).
- Targeted coverage: `src/frontend/src/auth/api.ts` statements 96.33%, branches 83.51%, functions 100%, lines 96.33%.
- Full frontend verify not fully green due to pre-existing in-progress failures in `src/frontend/src/multiplayer/protocol.test.ts` and `transport.test.ts` (T11 not complete) and `src/backend/src/app.ts` lint parse (T11), outside this task's files_owned.
Acceptance audit: AC-5 → met (verify client); AC-7 → met (login client); AC-9 → met (logout client); AC-10 → met (me client).
Deviations from spec: none.