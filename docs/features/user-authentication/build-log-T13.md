# Build log — T13 (Frontend auth state store)

## Files owned
- `src/frontend/src/auth/store.ts`
- `src/frontend/src/auth/store.test.ts`

## Summary
Implemented an external auth state store compatible with `React.useSyncExternalStore`
(`subscribe` + `getSnapshot`), exposing `status` (`anonymous | loading | authenticated`),
`user`, `verified`, and `token`, plus login/register/logout/verify/resend/me actions and
token handling (`setToken`/`getToken`/`clearToken`). The snapshot is referentially stable
until state changes. Factory aliases (`createAuthStore`, `createAuthStateStore`,
`createAuthState`, `createStore`, `createAuthClientStore`) and a default `authStore`
instance are exported for compatibility.

## Verification
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0
- `npm run lint` → exit 0
- `npm test --workspace @cubeclicker/frontend` → 714 tests passed, 0 failed
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0
  - All files: statements 95.66%, branches 94.28%, functions 96.83%, lines 95.66%
  - store.ts: statements 97.18%, branches 81.3%, functions 93.93%, lines 97.18%

## Notes
- Store state is minimal (`status`, `user`, `verified`) per plan; token handling is kept
  internal (not part of the snapshot) to preserve snapshot shape compatibility.
- Actions revert state on failure and rethrow the underlying `AuthError`.
