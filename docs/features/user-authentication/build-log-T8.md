# Build log — T8 — Keyed rate limiter

Task: T8 (2026-10-25)
Files changed: src/backend/src/auth/rate-limit.ts, src/backend/src/auth/rate-limit.test.ts, docs/features/user-authentication/build-log-T8.md
What changed & why: Added a keyed fixed-window rate limiter implementing `allow(key, limit, windowMs): boolean` with an injectable clock and per-key isolation. A window starts on the first call for a key and resets once `now - windowStart >= windowMs`; the counter is not inflated on rejection. Exported both a `RateLimiter` class (constructor takes an optional clock, defaulting to `Date.now`) and a `createRateLimiter` factory. Tests pin concrete boundaries (limit 0/1/3, exact window-elapse boundary, per-key and per-namespace isolation, limit-0/-negative, default clocks).
Decisions: Class named `RateLimiter` (no separate interface) to avoid `@typescript-eslint/no-unsafe-declaration-merging`; factory provided for functional callers. No persistence/cleanup of buckets (YAGNI; out of scope).
Integration test exception: this module is pure logic with no I/O or framework boundary; it is consumed by T9/T10. Unit tests only; integration coverage lands with those tasks.
Evidence:
- `npm run typecheck --workspace @cubeclicker/backend` → pass (no output)
- `npm test --workspace @cubeclicker/backend` → 14 test files, 330 tests passed (includes rate-limit.test.ts: 16 tests)
- `npm run coverage --workspace @cubeclicker/backend` → All files 98% stmts / 95.16% branch / 100% funcs / 98% lines (thresholds 80 met); src/auth/rate-limit.ts 100% / 100% / 100% / 100%
- `npx eslint src/backend/src/auth/rate-limit.ts src/backend/src/auth/rate-limit.test.ts` → pass (no output)
Acceptance audit: AC-6 → met (per-account/per-IP resend limiting supported via keyed allow); AC-8 → met (lockout counters can reuse the limiter or its clock; utility available); AC-14 → met (per-IP per-endpoint limits via namespaced keys). Utility is consumed by T9/T10.
Deviations from spec: none