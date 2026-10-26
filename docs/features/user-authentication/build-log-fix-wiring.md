# Build log — fix-wiring — user-authentication corrective (auth choice starts the game)

Task: fix-wiring (2026-10-26)
Files changed:
- `src/frontend/src/App.tsx`
- `src/frontend/src/ui/AuthMenu.tsx`
- `src/frontend/src/ui/AuthForms.tsx`
- `src/frontend/src/ui/app.css`
- `src/frontend/src/App.test.tsx`
- `src/frontend/src/ui/AuthMenu.test.tsx`
- `src/frontend/src/ui/AuthForms.test.tsx`
- `src/frontend/vite.config.ts`

## Root cause

The intro menu was rendering-only: every choice dismissed the overlay, but nothing
called `session.join(...)`, and `AuthForms` had no auth API/store instance. The intro
engine holds at progress 0 until the server's `welcome`, so dismissing the menu left
the user on a frozen cinematic — the reported "static intro". Guest play never sent
`join { mode: 'guest' }`; login/register had no real request path. `VerifyEmail` also
received `null` for its default `api`/`store`, so it could report success without
calling the server. This builds on the CSS-only corrective in
`build-log-fix-menu.md`, which made the overlay visible and centered but did not wire
the actions.

## What changed & why

- Added an exported `createAuthGate` external store in `App.tsx` as the single owner of
  menu → game transitions. `playAsGuest()` calls `session.join('guest')` exactly once
  (idempotent against double clicks); `loginSucceeded()` runs `session.retryConnection()`
  before `session.join('account')` because the backend reads the HttpOnly account
  cookie at the WebSocket upgrade; `verificationRequired()` opens a pending screen and
  never joins. App subscribes through `useSyncExternalStore`.
- App now composes the real default `createAuthApi()` / `createAuthStore({ api })` when
  the host does not inject them, and passes the same instances to `AuthMenu`,
  `AuthForms`, `VerificationPending` and `VerifyEmail`.
- `AuthForms` gained an exported `submitAuthForm` pipeline: store/API login or register,
  server-authoritative user read from the store, unverified login routed to the pending
  screen, rejected requests rendered as an inline `.auth-error`, and pending labels
  while the request is in flight.
- `AuthMenu` restyled as a centered vertical action column (`.auth-panel`,
  `.auth-menu-actions`), full-viewport dialog/backdrop semantics, and forwards
  store/api plus success/verification callbacks to the forms.
- `app.css` supplies the overlay backdrop, centered panel, full-width button column,
  labeled inputs, error/pending states, and responsive sizing. The cinematic keeps
  running behind the overlay.
- `vite.config.ts` proxies `/auth` to `http://backend:8080` (override
  `BACKEND_URL`) so the same-origin auth client works in the compose dev stack
  (frontend :5173, backend :8080) and the session cookie stays on the page origin.
- `VerifyEmail` now receives the resolved default client, and the verification route
  offers `Continue to login`.

## Decisions

- Gate state lives outside React so joins are idempotent and testable without a DOM.
- Login ordering is `store.login` → `session.retryConnection()` → `session.join('account')`;
  the reconnect is required for the upgrade-time cookie resolution.
- Registration and unverified login enter the App-owned pending screen; neither joins.
- The pending screen is dismissible straight to the login form (remounted via `key`).
- Frontend tests run in the Node environment (no jsdom); interaction flows exercise the
  same exported `createAuthGate` / `submitAuthForm` functions the buttons call, with a
  real React server render for the rendered state. This is the integration tier for the
  change; no DOM library was added.

## Evidence

- `npm run lint` → exit 0 (`eslint .`, no findings).
- `npm run typecheck` → exit 0 (backend and frontend `tsc --noEmit`).
- `npm test` → exit 0; backend 18 files / 492 tests passed, frontend 34 files / 742 tests passed.
- `npm run coverage` → exit 0 (thresholds ≥ 80 per workspace):
  - backend: `All files | 94.66 | 84.32 | 99.6 | 94.66`
  - frontend: `All files | 92.46 | 91.65 | 93.67 | 92.46`
- `npm run build` → exit 0; `dist/index.html 0.42 kB`, `dist/assets/index-*.css 7.65 kB`,
  `dist/assets/index-*.js 820.64 kB`, built in 1.44s.
- `git grep` over the changed test files for banned matcher forms → no matches.

## Acceptance audit

- AC-18 (intro overlay with `Login`, `Register`, `Play as guest`, cinematic behind) → met:
  `AuthMenu.test.tsx` pins the three labels inside `.auth-panel`/`.auth-menu-actions`;
  `App.test.tsx` renders the menu over the canvas before a choice. CSS keeps the canvas
  animating behind the dialog.
- AC-19 (guest play dismisses the menu and proceeds; skip does not select a mode) → met:
  `App.test.tsx` asserts `session.join('guest')` called exactly once with `'guest'` after
  a double activation, `retryConnection` untouched, and the menu gone from the render.
- AC-20 (login/register forms open; cancel returns to the menu) → met: `AuthMenu.test.tsx`
  renders both form views and the menu; `AuthForms` cancel wiring returns to the menu.
- AC-4 / AC-24 (unverified accounts cannot join) → met client-side: login with a
  `verified: false` user routes to verification-pending and never calls `join` or
  `retryConnection`; `App.test.tsx` asserts the exact pending snapshot.
- AC-23 (WS auth via cookie) → met: successful login reconnects the socket before
  choosing account mode; invocation-order assertions pin login < retry < join.
- AC-34 (deferred join / reconnect keeps the chosen mode) → met by using the existing
  transport contract: `join` queues the mode until `hello`; the gate only calls the
  session API, and the transport test suite remains green.
- Verification → usable login → met: `VerifyEmail` now uses the resolved default
  store/api, and the route links back to login; the pending screen's `Back to login`
  reopens the login form.
- Login failure → met: exact error is returned and shown, and no join/reconnect occurs.
- Registration success → met: enters pending with the registered email and never joins.

## Deviations from spec

- None in behavior. `vite.config.ts` is included because the default same-origin
  `/auth/*` client cannot reach the backend container in the documented compose dev
  setup without the proxy; this is required for the real login/register path the fix
  restores.
- `npm run smoke` was not run (not required for this corrective; container images were
  not part of the change).

## Out of scope / untouched

- `docs/features/user-authentication/status.md` was already modified by the orchestrator
  (`accepted → building`) and is intentionally excluded from this task's commit.
