# Build log — T10 — Auth HTTP routes (Fastify plugin)

Task: T10 (2026-10-25)
Files changed: src/backend/src/auth/auth-routes.ts, src/backend/src/auth/auth-routes.test.ts

What changed & why: Implemented Fastify auth plugin exposing /auth/register, /auth/login, /auth/verify (GET+POST), /auth/resend and /auth/resend-verification, /auth/logout, /auth/me, and /auth/session-touch (GET+POST, plus touch/session aliases). Includes Origin/CSRF checks (allow missing, reject mismatched), per-IP rate limits (register 5/min, login 10/min, resend 3/hour), HttpOnly/Secure/SameSite=Lax/Path=/ 7-day sliding cookie set/clear, status mapping for auth errors (401/409/429/400), Retry-After, and best-effort sliding touch. Tests cover all routes, error codes, cookies, origin, rate limits, sliding expiry, single-session revocation.

Decisions: Cookie name `session` with read fallbacks for common names; service/sessions/rate-limiter injected via flexible options; cookie plugin registered lazily inside the plugin; origin check allows absent Origin for non-browser/test clients.

Evidence:
- `npm run typecheck --workspace @cubeclicker/backend` → pass (no output)
- `npm run lint` → pass (no output)
- `npm test --workspace @cubeclicker/backend` → 18 files, 492 tests passed
- `npm run coverage --workspace @cubeclicker/backend` → All files 96.61% stmts / 86.46% branch / 100% funcs / 96.61% lines (thresholds 80 met)

Acceptance audit:
- AC-5 → met (verify GET/POST activates + cookie; reused/unknown → 400)
- AC-7 → met (login 200 + cookie + user; invalid 401; locked 429 + Retry-After)
- AC-9 → met (logout 204 + clear cookie; /me 401 after)
- AC-10 → met (/me 200/401)
- AC-12 → met (no secrets logged; redacted responses)
- AC-14 → met (rate limits 429)
- AC-15 → met (Origin mismatch 403)
- AC-16 → met (cookie attributes + 7-day sliding)
- AC-33 → met (revoked session → 401)

Deviations from spec: none.