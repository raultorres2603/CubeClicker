# Build log — T2 — Gate-close loading/error UI and deferred customization preview

Task: T2 (2026-11-12)
Files changed:
- `src/frontend/src/ui/GameCanvas.tsx`
- `src/frontend/src/ui/GameCanvas.runtime.test.tsx` (new)
- `src/frontend/src/ui/DeferredSpaceshipCustomizationPanel.tsx` (new)
- `src/frontend/src/ui/DeferredSpaceshipCustomizationPanel.test.tsx` (new)
- `src/frontend/src/App.tsx`
- `src/frontend/src/App.test.tsx`
- `src/frontend/src/ui/game-view.css`
- `src/frontend/src/ui/game-view.css.test.ts`
- `docs/features/frontend-delivery-hardening/build-log-T2.md` (this file)

What changed & why:
- `GameCanvas` now reads the session runtime status through `useSyncExternalStore`: `session.subscribeRuntime ?? subscribeRuntimeNoop` and `session.getRuntimeStatus ?? getRuntimeStatusReady` (module-level fallbacks, so the existing status-free fakes keep compiling and render nothing). While the gate is closed and the status is `loading` it renders `<p className="game-runtime-status" role="status">Loading the game…</p>`; on `error` it renders `<div className="game-runtime-error" role="alert">The game could not be loaded. <button type="button">Try again</button></div>`, and the button re-calls `session.attach(canvas)` with the same canvas element (the session's retry path from T1). `ready`/`idle` render neither. The canvas effect is still exactly `session.attach(canvas)` / `session.dispose()`, and the canvas JSX is byte-identical (the status nodes are fragment siblings, never a wrapper).
- New `DeferredSpaceshipCustomizationPanel` owns the preview chunk's async lifecycle: a module-scope default loader (`() => import('./SpaceshipCustomizationPanel')`) keeps the effect dependency stable and keeps the panel — and therefore `SpaceshipPreview → render/preview → three` — out of the static entry graph (the props type is `import type`, review F6). Pending renders `Loading customization…` (`role="status"`), a rejection renders `Customization could not be loaded.` + `Try again` (`role="alert"`), and the retry re-runs the loader. The resolved component is stored through the updater form `setComponent(() => module.SpaceshipCustomizationPanel)`.
- `App` imports/renders the wrapper instead of the panel; only the import and the element name changed (no other App logic).
- `App.test.tsx` customization assertions now await the asynchronously imported panel (`findByRole`/`waitFor` on `Open lootbox` / the reveal region / equip controls); all gate attach/join/retry assertions are untouched and green.
- `game-view.css` gains the centered `.game-runtime-status`/`.game-runtime-error` chrome plus the retry control's 44px target and focus ring; no `!important` and no second `prefers-reduced-motion` block. `game-view.css.test.ts` pins the exact declarations.

Decisions:
- Status fallbacks live at module scope (`subscribeRuntimeNoop` / `getRuntimeStatusReady`), matching the brief; the real session methods are passed unbound exactly like `App` already passes `session.subscribe`/`session.getSnapshot` (the session's methods are closures, no `this`).
- The loading/error nodes are `active`-gated, so the auth menu never shows game chrome; the canvas stays the first child of `main` in every state (the existing SSR markup pin is unchanged and green).
- The retry is a local handler that re-reads `canvasRef.current`; it does not add a dependency to the attach effect, so the accepted gate-deferred attach contract is bit-for-bit preserved.
- The wrapper stores the component in state rather than using `React.lazy`, so an injected/rejected loader is retryable without error-boundary semantics (plan decision 4).
- The "closed wrapper never calls `loadPanel`" case is tested with the App-shaped mount gate (a harness that only mounts the wrapper when the toggle opens): 0 loads while closed, exactly 1 on open. `App` itself never mounts the wrapper while `customizationOpen` is false (the toggle test also pins "no panel/no `Open lootbox`" while closed).
- `DeferredSpaceshipCustomizationPanel.tsx` lines 60-61/66-67 (the `cancelled` guards) are the only new uncovered lines: their outcome (a late resolution after unmount) has no observable DOM/state effect, so no test asserts them; the file is still at 91.66/87.5/100/91.66.

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

- `npm run test --workspace @cubeclicker/frontend` → exit 0 (jsdom WebGL "not implemented" stderr lines are the pre-existing `SpaceshipPreview` no-WebGL fallback noise; filtered here for legibility)
```
 ✓ src/App.test.tsx (41 tests) 1111ms

 Test Files  66 passed (66)
      Tests  1791 passed (1791)
   Start at  21:47:08
   Duration  3.52s (transform 8.37s, setup 0ms, collect 22.81s, tests 11.77s, environment 7.78s, prepare 5.75s)

EXIT=0
```
  (T1 baseline was 64 files / 1778 tests; T2 adds 2 files / 13 tests: 5 game-runtime status, 5 deferred panel, 3 CSS pins.)

- Focused new-block run, `npx vitest run src/ui/GameCanvas.runtime.test.tsx src/ui/DeferredSpaceshipCustomizationPanel.test.tsx src/ui/game-view.css.test.ts --reporter=verbose` (run from `src/frontend`) → exit 0
```
 ✓ src/ui/game-view.css.test.ts > gate-close runtime status (AC-2) > centers the loading and error chrome over the canvas 0ms
 ✓ src/ui/game-view.css.test.ts > gate-close runtime status (AC-2) > gives the retry control a 44px target and an accent focus ring 0ms
 ✓ src/ui/game-view.css.test.ts > gate-close runtime status (AC-2) > adds no second reduced-motion block for the runtime chrome 0ms
 ✓ src/ui/GameCanvas.runtime.test.tsx > GameCanvas runtime status (AC-2) > renders the pinned loading status while the environment loads, then removes it on ready 92ms
 ✓ src/ui/GameCanvas.runtime.test.tsx > GameCanvas runtime status (AC-2) > renders the pinned error alert and re-attaches the session on Try again 18ms
 ✓ src/ui/GameCanvas.runtime.test.tsx > GameCanvas runtime status (AC-2) > renders no runtime status while the gate is still open 9ms
 ✓ src/ui/GameCanvas.runtime.test.tsx > GameCanvas runtime status (AC-2) > keeps the same canvas element mounted in every runtime state 4ms
 ✓ src/ui/GameCanvas.runtime.test.tsx > GameCanvas runtime status (AC-2) > treats a session without the optional runtime store as ready 2ms
 ✓ src/ui/DeferredSpaceshipCustomizationPanel.test.tsx > DeferredSpaceshipCustomizationPanel (AC-4) > renders the resolved panel and forwards the existing props 103ms
 ✓ src/ui/DeferredSpaceshipCustomizationPanel.test.tsx > DeferredSpaceshipCustomizationPanel (AC-4) > shows the pinned loading status until the panel import resolves 8ms
 ✓ src/ui/DeferredSpaceshipCustomizationPanel.test.tsx > DeferredSpaceshipCustomizationPanel (AC-4) > shows the pinned alert when the import rejects 5ms
 ✓ src/ui/DeferredSpaceshipCustomizationPanel.test.tsx > DeferredSpaceshipCustomizationPanel (AC-4) > re-runs the loader on Try again and renders the panel when the retry resolves 14ms
 ✓ src/ui/DeferredSpaceshipCustomizationPanel.test.tsx > DeferredSpaceshipCustomizationPanel (AC-4) > never calls loadPanel while the customization toggle is closed 8ms

 Test Files  3 passed (3)
      Tests  55 passed (55)
```

- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (thresholds 80 on statements/branches/functions/lines, per workspace; no exclusion or threshold change)
```
 Test Files  66 passed (66)
      Tests  1791 passed (1791)
   Start at  21:46:15
   Duration  4.71s (transform 8.39s, setup 0ms, collect 22.56s, tests 18.46s, environment 8.73s, prepare 7.81s)

All files          |   96.42 |     96.1 |   97.53 |   96.42 |
 src               |   86.83 |    83.25 |      95 |   86.83 |
  App.tsx          |   86.22 |    81.91 |   96.42 |   86.22 | ...31-433,455-456
  browser-env.ts   |   92.72 |      100 |   91.66 |   92.72 | 74-77
 ...
 src/ui            |   96.71 |    93.95 |   94.59 |   96.71 |
  AuthForms.tsx    |     100 |    99.07 |     100 |     100 | 219
  AuthMenu.tsx     |     100 |      100 |     100 |     100 |
  ...ionBanner.tsx |     100 |      100 |     100 |     100 |
  ...ionToggle.tsx |     100 |      100 |     100 |     100 |
  ...tionPanel.tsx |   91.66 |     87.5 |     100 |   91.66 | 60-61,66-67   (DeferredSpaceshipCustomizationPanel)
  GameCanvas.tsx   |   96.61 |       95 |     100 |   96.61 | 62-63
  Hud.tsx          |     100 |      100 |     100 |     100 |
  ...eteBanner.tsx |     100 |      100 |     100 |     100 |
  ...tionPanel.tsx |   96.84 |    88.99 |     100 |   96.84 | ...09-210,216-217   (SpaceshipCustomizationPanel)
  ...ipPreview.tsx |    87.2 |    77.41 |      75 |    87.2 |
  ...adesPanel.tsx |   96.74 |    90.62 |     100 |   96.74 |
  UserPanel.tsx    |   91.07 |      100 |   66.66 |   91.07 |
  ...onPending.tsx |   80.95 |       50 |   33.33 |   80.95 |
  VerifyEmail.tsx  |     100 |      100 |     100 |     100 |
  icons.tsx        |     100 |      100 |     100 |     100 |
  theme.ts         |     100 |      100 |     100 |     100 |
```
  (Vitest's text reporter truncates file names to a fixed column; the two `...tionPanel.tsx` rows are the new wrapper at 91.66/87.5/100/91.66 — uncovered lines 60-61/66-67 are its `cancelled` guards — and `SpaceshipCustomizationPanel.tsx` at 96.84. Both are above the 80 gate.)

- Entry-graph static edge (AC-4 groundwork): `App` only references the wrapper, and the wrapper's panel import is `import type` + the dynamic loader:
```
$ grep -n "SpaceshipCustomizationPanel" src/frontend/src/App.tsx
14:import { DeferredSpaceshipCustomizationPanel } from './ui/DeferredSpaceshipCustomizationPanel';
593:        <DeferredSpaceshipCustomizationPanel

$ grep -n "SpaceshipCustomizationPanel" src/frontend/src/ui/DeferredSpaceshipCustomizationPanel.tsx
3:import type { SpaceshipCustomizationPanelProps } from './SpaceshipCustomizationPanel';
27:const loadSpaceshipCustomizationPanel: LoadSpaceshipCustomizationPanel = () =>
28:  import('./SpaceshipCustomizationPanel');

$ grep -rn "from './ui/SpaceshipCustomizationPanel'\|from './SpaceshipCustomizationPanel'" src/frontend/src --include=*.tsx --include=*.ts
src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx:14:} from './SpaceshipCustomizationPanel';
src/frontend/src/ui/DeferredSpaceshipCustomizationPanel.tsx:3:import type { SpaceshipCustomizationPanelProps } from './SpaceshipCustomizationPanel';
src/frontend/src/ui/DeferredSpaceshipCustomizationPanel.test.tsx:11:import type { SpaceshipCustomizationPanelProps } from './SpaceshipCustomizationPanel';
```
  (test-file value imports are test-only; no production static value import of the panel remains. The built chunk graph proof is T3.)

- Canvas contract untouched (the accepted attach/dispose effect has no diff hunks, and the rendered canvas markup is pinned by the existing SSR test):
```
$ git diff -- src/frontend/src/ui/GameCanvas.tsx | grep -nE '^[-+].*(attach|dispose)'
36:+ * status, a rejected one renders the pinned alert with a retry that re-attaches the
61:+      session.attach(canvas);
```
  (the only added `session.attach` call is the retry handler; the effect's `attach`/`dispose` lines are context, not changed. The canvas JSX is re-indented inside the fragment, so `renderToStaticMarkup` still returns exactly `<canvas tabindex="0" aria-label="Game canvas: click a mini-cube to explode it; press W, A, S, D or the arrow keys to rotate the cube" style="touch-action:none"></canvas>` — pinned by `GameCanvas.test.tsx` and the App SSR shell.)

- Scope: `git diff --stat` for T2 source/test files:
```
 src/frontend/src/App.test.tsx             | 41 ++++++++++++--------
 src/frontend/src/App.tsx                  |  4 +-
 src/frontend/src/ui/GameCanvas.tsx        | 64 +++++++++++++++++++++++++++----
 src/frontend/src/ui/game-view.css         | 43 +++++++++++++++++++++
 src/frontend/src/ui/game-view.css.test.ts | 55 ++++++++++++++++++++++++++
 5 files changed, 181 insertions(+), 26 deletions(-)
```
  plus the three new files (two suites + the wrapper) and this build log. No edits outside T2's `files_owned`; `session.ts`, `browser-env.ts`, `scene.ts`, Vite/nginx/compose config, and every doc outside this feature dir are untouched.

Acceptance audit:
- AC-2 (UI half) → met: `GameCanvas.runtime.test.tsx` pins the exact `role="status"` `/Loading the game…/` text while loading, its removal on `ready`, the exact `role="alert"` text `The game could not be loaded.` + the `Try again` button, that a click re-calls `session.attach(canvas)` (2 total attach calls, second with the same canvas), that `active={false}` renders no status/alert, and that the same canvas element stays mounted through `loading → ready → error → loading`; the pre-existing `GameCanvas.test.tsx` SSR markup pin (`<canvas tabindex="0" aria-label="…" style="touch-action:none"></canvas>`) and the App SSR shell pin stay byte-identical and green. The session half (loader once, one attach cycle, retry) is T1's green evidence.
- AC-4 → met: the wrapper's five tests pin loading, resolve+prop forwarding, rejection, a retry that re-runs the loader and renders the panel, and zero loader calls while closed; `App` renders only the wrapper (type-only panel edge) and its customization tests pass through the async import; the CSS/status copy is pinned. The initial-graph/budget proof is T3 by design.
- AC-3 (regression) → met: the attach effect is unchanged (`attach(canvas)` / `dispose()`), and the accepted gate-deferred attach, dispose/re-attach, StrictMode-shaped, transport-order and intro-clock suites are all green in the full run (66 files / 1791 tests).
- AC-10 (T2 portion) → met: every changed behavior has unit and integration coverage with concrete expected values (no wildcard/snapshot-only/assertion-free tests); `npm run coverage --workspace @cubeclicker/frontend` exits 0 at 96.42/96.1/97.53/96.42 overall with both new/edited UI files above 80; no exclusion or threshold change.

Deviations from spec: none. Notable interpretation: the spec's "closed wrapper never calls `loadPanel`" is exercised as the App-shaped mount gate (wrapper absent while closed, mounted on open) because the pinned wrapper props carry no `open` flag; `App`'s closed state is additionally pinned in the toggle test.

## Test-only correction during implementation

The third runtime-chrome CSS pin initially referenced `block` before it was declared in that
test; it was corrected to read the single reduced-motion block through
`mediaBlock(cssSource, '@media (prefers-reduced-motion: reduce)')` and assert the runtime
selectors are absent from it. This was a test-only fix made before any of the evidence
commands above were captured, so every recorded run reflects the final code.
