# Build log — T4 — Gate-deferred attach

Task: T4 (2026-11-12)

Files changed:
- `src/frontend/src/ui/GameCanvas.tsx`
- `src/frontend/src/ui/GameCanvas.test.tsx`
- `src/frontend/src/App.tsx`
- `src/frontend/src/App.test.tsx`
- `docs/features/adaptive-render-budget-v2/build-log-T4.md`

What changed & why (sketch):
- `GameCanvas` gains `active`; the effect returns early while `!active`, otherwise attaches and returns the existing `session.dispose` cleanup; the canvas element markup (`tabIndex`, `aria-label`, inline `touch-action`) is untouched.
- `App` passes `active={gateState.view === 'closed'}`; `AuthGate`, its methods, and their order are untouched.
- `GameCanvas.test.tsx` becomes jsdom: the SSR markup pin and the SSR no-attach pin are retained verbatim, plus attach gating against the real session (0 attach/listener/frame/renderer while inactive; 1 attach + 1 frame per active cycle; dispose on unmount; `true → false → true`; StrictMode-like remount).
- `App.test.tsx` adds attach-spy assertions for menu-open (guest + login form), guest click, verified login order (`retry < join < attach`), registration-pending/back-to-login, and `chosen: true` mount.

Decisions:
- `GameCanvas` tests drive the **real** `createGameSession` with one fake boundary (`SessionEnvironment`) — the same integration tier as `session.test.ts`. That makes "no listener/frame/renderer before active" an observable host-effect count (motion/visibility/resize/orientation subscriptions, scheduler schedules, renderer-factory calls, canvas/key listeners) instead of a mock tautology. `attach`/`dispose` are `vi.spyOn` wrappers that call through to the real session.
- StrictMode-like sequence is driven explicitly as mount → unmount → remount (deterministic across React builds) and pins final attach `2` / dispose `1`, exactly as AC-4 states; the session's own idempotent attach/dispose is the production path either way.
- The App fake only counts `attach`/`retryConnection`/`join`; the welcome receipt is not duplicated — the T2 `session.test.ts` named test remains authoritative (re-run green below).
- The registration App test's store fake also supplies a `login` function because `App`'s `isAuthStore` guard requires both methods to accept an injected store (test-fixture detail only; production store unchanged).

Evidence:

- `npm run lint` → exit 0
```
> lint
> eslint .
```

- `npm run typecheck` → exit 0
```
> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit
```

- `npm run test --workspace @cubeclicker/frontend` → exit 0
```
 Test Files  64 passed (64)
      Tests  1770 passed (1770)
   Duration  3.45s (transform 7.65s, setup 0ms, collect 21.64s, tests 10.73s, environment 6.33s, prepare 5.51s)
```
  (was 1762 before T4: +8 new tests, no test removed; two pre-existing App auth-interaction tests gained attach/order assertions)

- Focused changed-module run, `npx vitest run src/ui/GameCanvas.test.tsx src/App.test.tsx --reporter=verbose` (from `src/frontend`) → exit 0
```
 Test Files  2 passed (2)
      Tests  48 passed (48)
```
  New/changed tests observed green (verbose):
```
 ✓ src/ui/GameCanvas.test.tsx > GameCanvas > renders a focusable, labelled canvas with pointer gestures left to the game
 ✓ src/ui/GameCanvas.test.tsx > GameCanvas > does not attach the session during server rendering (the effect is client-only)
 ✓ src/ui/GameCanvas.test.tsx > GameCanvas — gate-deferred attach (AC-1, AC-3, AC-4, AC-13) > attaches nothing and creates no listener, frame or renderer while inactive
 ✓ src/ui/GameCanvas.test.tsx > GameCanvas — gate-deferred attach (AC-1, AC-3, AC-4, AC-13) > attaches once and schedules exactly one frame when it becomes active
 ✓ src/ui/GameCanvas.test.tsx > GameCanvas — gate-deferred attach (AC-1, AC-3, AC-4, AC-13) > disposes the session exactly once on unmount, releasing every listener and the renderer
 ✓ src/ui/GameCanvas.test.tsx > GameCanvas — gate-deferred attach (AC-1, AC-3, AC-4, AC-13) > disposes on true → false and attaches a fresh cycle on false → true (AC-4)
 ✓ src/ui/GameCanvas.test.tsx > GameCanvas — gate-deferred attach (AC-1, AC-3, AC-4, AC-13) > survives the StrictMode-like mount → unmount → remount path with attach 2 and dispose 1 (AC-4)
 ✓ src/App.test.tsx > App — auth interaction > does not attach while the guest menu or the login form is open (AC-1, AC-13)
 ✓ src/App.test.tsx > App — auth interaction > clicking the rendered Play as guest button joins as guest and unmounts the menu
 ✓ src/App.test.tsx > App — auth interaction > drives the rendered login form submit and joins as account after reconnect
 ✓ src/App.test.tsx > App — auth interaction > does not attach on the verification-pending screen or after Back to login (AC-3)
 ✓ src/App.test.tsx > App — auth interaction > attaches once on mount when the gate starts closed (AC-4)
```
  Asserted values (concrete): inactive ⇒ `attach 0`, renderer factory `[]`, schedules `0`, pending `0`, key listeners `0`, subscriptions `{motion:0,visibility:0,resize:0,orientation:0}`; active ⇒ `attach` called with the canvas, renderer `[canvas]`, schedules `1`, pending `1`, five pointer listeners (`pointercancel/pointerdown/pointerleave/pointermove/pointerup`) + one key listener; unmount ⇒ `dispose 1`, cancels `1`, adapter disposals `1`, every subscription unsubscribed once; `true → false → true` ⇒ attach `1`, dispose `1`, attach `2`, schedules `1 → 2`; StrictMode-like ⇒ final attach `2`, dispose `1`. App: menu open ⇒ `attach 0` (three menu buttons pinned; login form heading pinned), guest ⇒ `join('guest')` once + `attach 1` with the canvas and `join < attach`, verified login ⇒ retry `1`, join `1`, attach `1` with `login < retry < join < attach`, registration-pending and `Back to login` ⇒ `attach 0` / `join 0` / retry `0`, `chosen: true` ⇒ `attach 1`.

- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (threshold 80 on all four metrics)
```
 Test Files  64 passed (64)
      Tests  1770 passed (1770)
All files          |   96.47 |    96.14 |    97.64 |   96.47 |
  App.tsx          |   86.22 |    81.91 |   96.42 |   86.22 | ...31-433,455-456
  GameCanvas.tsx   |   92.85 |    85.71 |     100 |   92.85 | 36-37
```
  Every metric ≥ 80; the only uncovered `GameCanvas` lines are the defensive `canvasRef.current === null` guard (SSR/unreachable in jsdom), which was uncovered before T4 too. No exclusion or threshold changed.

- Named T2 regression test present and green, `npx vitest run src/game/session.test.ts -t "receives welcome after a detached retryConnection" --reporter=verbose` → exit 0
```
 ✓ src/game/session.test.ts > detached login path (AC-2, AC-14) > receives welcome after a detached retryConnection → join(account) → attach cycle 50ms
 Test Files  1 passed (1)
      Tests  1 passed | 85 skipped (86)
```
  It is also part of the full 1770-test frontend run above.

- Note: the pre-existing jsdom stderr `Not implemented: HTMLCanvasElement's getContext() …` / `THREE.WebGLRenderer: Error creating WebGL context.` originates from `SpaceshipPreview` in the pre-existing customization-panel tests; verified it reproduces with T4's source changes stashed. Unrelated to this task; tests pass.

Acceptance audit:
- AC-1 → met: while the gate is open the canvas renders but `App` passes `active=false`; `attach` stays `0` (guest menu and login-form cases) and the real `GameCanvas` session probe creates no listener/frame/renderer. `Play as guest` calls `join('guest')` once and then exactly one `attach` with the canvas element (`join < attach`).
- AC-2 (attach/order half; welcome half is T2) → met: verified login yields exactly one `attach`, after `retryConnection()` and `join('account')`, with `login < retry < join < attach`; the T2 named welcome test is green in the suite.
- AC-3 → met: registration shows the verification-pending screen with `attach 0`, `join 0`, `retry 0`; `Back to login` keeps `attach 0` and shows the login form. Only guest/verified login close the gate (the gate is untouched).
- AC-4 → met: `chosen: true` mounts with the gate closed and attaches exactly once; the SSR canvas markup string is byte-identical (pinned test unchanged); `active: true → false → true` disposes once and re-attaches once with a fresh adapter/scene (first attach `1`, dispose `1`, second attach `2`; one scheduled frame per active cycle); the StrictMode-like mount → unmount → remount path ends at attach `2`, dispose `1`.
- AC-13 (UI half) → met: `active=false` has zero listener subscriptions, zero scheduled frames, zero renderer-factory calls; unmount releases all five pointer listeners, the key listener, the environment subscriptions and the adapter; session-level late-create/pause/resize/context-loss behavior is T2's (green).
- AC-15 (task scope) → met: both tiers added/updated (unit-ish SSR pin + integration jsdom component/session/App tests), concrete assertions only; frontend coverage ≥ 80 on all four metrics; no exclusion/threshold change.

Deviations from spec: none.

Documentation: no docs outside the feature directory were edited — the user-facing documentation pass (`README.md`, `docs/architecture/frontend-rendering.md`) belongs to T5 per `tasks.md`.

Out-of-scope artifacts: the untracked `spec.md`, `plan.md`, `tasks.md`, `status.md`, and `reviews/**` under the feature directory are planner/reviewer/orchestrator artifacts staged by T5; this commit does not include them.
