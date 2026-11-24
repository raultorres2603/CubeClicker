# Build log — T6 — Frontend field errors, resend action and resend-failure display

Task: T6 (2026-11-24)
Files changed: `src/frontend/src/auth/api.ts`, `src/frontend/src/auth/api.test.ts`, `src/frontend/src/ui/AuthForms.tsx`, `src/frontend/src/ui/AuthForms.test.tsx`, `src/frontend/src/ui/VerificationPending.tsx`, `src/frontend/src/ui/VerificationPending.test.tsx`, `docs/features/registration-account-exists/build-log-T6.md`

## What changed & why
- `api.ts`: exports `AccountField`; `AuthError` gains `fields?: AccountField[]` parsed from an error body via one shared `parseAccountFields` helper (known values only, server order kept, `undefined` when the body has no `fields` array).
- `AuthForms.tsx`: `AuthSubmitResult` gains `email_delivery_failed` and `fields`; `AuthFormApi` gains `resend`; the login form keeps the accessible `Username` label/`name="username"` and adds the `Username or email` placeholder plus the pinned subtitle.
- The register form renders the three exact field messages with the pinned `aria-invalid`/`aria-describedby` ids and exactly one `role="alert"`; a 409 body without `fields` keeps the generic server message.
- A register `502 verification_email_failed` renders the pinned delivery block plus a working resend button (success `role="status"`, rejection exact alert, button re-enabled); `VerificationPending` catches a rejected `onResend`, shows the exact alert, never a false success, and re-enables the button.
- Tests: API `fields` parsing (present/absent/unknown entries), `submitAuthForm` outcome mapping, DOM ARIA/copy for all three 409 shapes, 502 resend success/failure/retry/no-client, and pending-screen rejection/retry/edit.

## Decisions
- **Single task, no split.** The change fits one sequential T6: the API/types, form and pending screen are small and the working tree/coverage output is shared. No T6a/T6b split was needed.
- **One parser for the body.** `parseAccountFields` lives in `api.ts` and is reused by `AuthForms` for structurally-shaped rejections (including store-thrown `AuthError`s), so the UI and the client cannot disagree about which values count.
- **`AuthError` API.** The existing positional constructor is preserved; `fields` is an optional fifth argument, so all existing call sites/tests keep compiling unchanged.
- **Field rendering.** `fields` is only surfaced when non-empty; `['username','email']` uses `aria-error-account` on both inputs and a single alert, while the single-field shapes blame only their own input. The generic banner is mutually exclusive with the field alert.
- **502 block.** The pinned message is its own `role="alert"`; resend calls `AuthFormApi.resend({ email })` with the submitted address; success is a `role="status"` line; failure is a second exact `role="alert"` line and the button stays enabled (disabled only while pending).
- **No adjacent changes.** `App.tsx`, `AuthMenu.tsx`, `store.ts` and all CSS are untouched; existing `App`/`AuthMenu` suites pass unchanged (83 files / 2867 tests in the gate).

## Evidence

### Verbatim T6 verify block (`tasks.md` T6 § verify)
Executed as one script under `set -euo pipefail` after the log existed:
```bash
set -euo pipefail
npm run lint
npm run typecheck --workspace @cubeclicker/frontend
npm test --workspace @cubeclicker/frontend
npm run coverage --workspace @cubeclicker/frontend
npm run build --workspace @cubeclicker/frontend
test -f docs/features/registration-account-exists/build-log-T6.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/registration-account-exists/build-log-T6.md
```

Raw result: `BLOCK_EXIT=0` (1263-line capture; key excerpts below). `test -f` and the credential `! grep` print nothing on success.

```text
> lint
> eslint .

> typecheck
> tsc --noEmit

> test
> vitest run

 RUN  v3.2.7 /…/src/frontend

 ✓ src/ui/AuthForms.test.tsx (60 tests) 2008ms
 …
 Test Files  83 passed (83)
      Tests  2867 passed (2867)
   Duration  4.56s (transform 10.49s, setup 0ms, collect 28.68s, tests 18.76s, environment 12.45s, prepare 7.23s)

> coverage
> vitest run --coverage

 RUN  v3.2.7 /…/src/frontend
      Coverage enabled with v8
 …
 Test Files  83 passed (83)
      Tests  2867 passed (2867)
   Duration  6.34s (transform 11.43s, setup 0ms, collect 29.42s, tests 28.49s, environment 13.74s, prepare 9.47s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   97.22 |     96.8 |    98.6 |   97.22 |                   
 src/auth          |   97.14 |     87.2 |   96.29 |   97.14 |                   
  api.ts           |    97.1 |    89.42 |     100 |    97.1 | …55,173-174,249 
  store.ts         |   97.18 |    85.04 |   93.93 |   97.18 | …63-164,190-193 
 src/ui            |   97.77 |    95.23 |   99.11 |   97.77 |                   
  AuthForms.tsx    |   99.39 |    97.82 |     100 |   99.39 | 295-296          
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |                   
  …onPending.tsx   |     100 |      100 |     100 |     100 |                   
-------------------|---------|----------|---------|---------|-------------------

> build
> vite build && node scripts/check-bundle-budget.mjs

vite v7.3.7 building client environment for production...
✓ 117 modules transformed.
dist/assets/index-DCVPnCyo.js                        111.21 kB │ gzip:  33.66 kB
dist/assets/react-BYqCGoBQ.js                        221.70 kB │ gzip:  68.96 kB
dist/assets/three-Ddozhxko.js                        610.56 kB │ gzip: 154.65 kB
✓ built in 1.49s
entry index assets/index-DCVPnCyo.js raw=111213 gzip=33660
initial files=2 raw=332912 gzip=102616 budget=150000
three assets/three-Ddozhxko.js raw=610563 gzip=154647 budget=165000
total files=6 raw=1027045 gzip=287223 budget=300000
chunk index assets/index-DCVPnCyo.js raw=111213 gzip=33660 initial=true
chunk react assets/react-BYqCGoBQ.js raw=221699 gzip=68956 initial=true
chunk three assets/three-Ddozhxko.js raw=610563 gzip=154647 initial=false

Bundle budget OK.
```

Aggregate gate: **97.22 statements / 96.8 branches / 98.6 functions / 97.22 lines**, all ≥ 80. The changed files: `api.ts` 97.1/89.42/100/97.1, `AuthForms.tsx` 99.39/97.82/100/99.39, `VerificationPending.tsx` 100/100/100/100. The only uncovered `AuthForms.tsx` lines (295–296) are the defensive double-click guard in `handleResend` (the button is disabled while pending), not a pinned AC path.

### Focused run (new cases)
```
$ npx --no-install vitest run src/auth/api.test.ts src/ui/AuthForms.test.tsx src/ui/VerificationPending.test.tsx

 ✓ src/auth/api.test.ts (34 tests) 10ms
 ✓ src/ui/VerificationPending.test.tsx (6 tests) 201ms
 ✓ src/ui/AuthForms.test.tsx (60 tests) 1929ms

 Test Files  3 passed (3)
      Tests  100 passed (100)
```

### Post-append guard (after this log's final edit)
```bash
test -f docs/features/registration-account-exists/build-log-T6.md
! grep -qE "xsmtpsib-[A-Za-z0-9]{15,}|xkeysib-[A-Za-z0-9]{20,}|SMTP_(USER|PASS)=[\"']?[A-Za-z0-9+/_-]{12,}|RENDER_API_KEY=[\"']?[A-Za-z0-9_-]{12,}|rnd_[A-Za-z0-9_-]{20,}" docs/features/registration-account-exists/build-log-T6.md
```
Both exited 0 with no output; the log records no address, token, link or credential.

## Acceptance audit
- AC-7(a) → met: `AuthError.fields` is parsed from `fields: ['username','email']` in server order (exact `toEqual(['username','email'])`), is `undefined` when the body has no `fields`, and drops unknown entries (`['email','password','username']` → `['email','username']`).
- AC-7(b) → met: the login form renders `<p class="auth-subtitle">Sign in with your username or email.</p>` and `placeholder="Username or email"`; `getByLabelText('Username')` still resolves the `name="username"` input, and the `AuthForms`/`AuthMenu`/`App` suites pass unchanged.
- AC-7(c) → met: each 409 shape renders exactly one `role="alert"` — username (`id="auth-error-username"`, `That username is already taken.`, sniffed input `aria-invalid="true"`/`aria-describedby="auth-error-username"`), email (analogous `auth-error-email`), both (`id="auth-error-account"`, `That username and email are already registered.`, both inputs described by `auth-error-account`); the other input stays clean and no generic banner appears. The store registration path renders the same email field message.
- AC-7(d) → met: a register 502 renders `Account created, but the verification email could not be sent.` plus `Resend verification email`; clicking calls `resend({ email })` with the submitted address; success renders `Verification email sent.`; rejection renders `Could not resend the verification email. Try again.` and the button is still enabled; a retry then succeeds. A missing resend client reports the failure rather than a false success.
- AC-7(e) → met: a rejected `onResend` renders `Could not resend the verification email. Try again.` in a `role="alert"`, `Verification email sent.` is absent, the button is re-enabled, and a later successful resend renders the success line and clears the alert.
- AC-7(f) → met: no `App.tsx`/`AuthMenu.tsx` edit; the full frontend suite (83 files / 2867 tests) passes, including the existing `App`/`AuthMenu` files unchanged.
- Testing bar → met: unit tier (injected-fetch API parsing, `submitAuthForm` outcomes) and integration tier (real React DOM render via Testing Library + `userEvent`). Assertions use concrete values (`toEqual` on exact arrays/outcomes, exact `textContent`/ids/attributes, exact `resend` call args and counts); no wildcard matcher, snapshot, assertion-free test, or bounded exception was needed. No test relies on a banned `jest-dom` matcher (the workspace has none; DOM attributes are asserted via `getAttribute`).

## Deviations from spec
- None. Scope stayed inside the seven `files_owned` paths; `App.tsx`, `AuthMenu.tsx`, `store.ts` and CSS were not touched. `parseAccountFields` is an added named export in the owned `api.ts` so the form and the client share one parsing rule; the externally observable `AuthError.fields` contract is unchanged.
- Documentation: T7 owns the README/architecture updates for this feature, so no docs outside the build log are edited here (per `files_owned`).
