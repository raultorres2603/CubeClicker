# Build log — T14 — React UI: shell, HUD, canvas, theme

Task: T14 (2026-10-19) — `docs/features/cube-game-frontend/tasks.md` (r4)
Build-start baseline: `9b90190` (T13 completion) — branch `main`

Files changed:
- `src/frontend/src/App.tsx` (rewrite) — game shell
- `src/frontend/src/App.test.tsx` (rewrite) — SSR shell tests
- `src/frontend/src/ui/Hud.tsx` (new) — stats HUD
- `src/frontend/src/ui/Hud.test.tsx` (new)
- `src/frontend/src/ui/GameCanvas.tsx` (new) — canvas + session lifecycle
- `src/frontend/src/ui/GameCanvas.test.tsx` (new)
- `src/frontend/src/ui/theme.ts` (new) — pinned colours
- `src/frontend/src/ui/theme.test.ts` (new)
- `src/frontend/src/ui/app.css` (new)
- `docs/features/cube-game-frontend/build-log-T14.md` (this file)

## Sketch (≤ 5 lines, written before the code)

1. `theme.ts`: `HUD_TEXT`/`HUD_BACKGROUND`/`ACCENT` + the black `PAGE_BACKGROUND` reference; `theme.test.ts` computes WCAG contrast from the exports (≥ 4.5).
2. `Hud.tsx`: pure `{ stats, levelIndex }` → `<section aria-label="Game statistics">` with the three pinned `<p>`/`data-stat` rows; no live attributes on either counter.
3. `GameCanvas.tsx`: `<canvas tabIndex={0} aria-label="…" style={{ touchAction: 'none' }}>`; one effect attaches the session on mount and disposes it on unmount.
4. `App.tsx`: one session per mount via `useState` initializer (optional injected session for SSR phase tests), `useSyncExternalStore` with `getSnapshot` as server snapshot, `<main>` = canvas + HUD + the single `role="status" aria-live="polite"` region (pinned text per phase, always rendered).
5. `app.css`: full-viewport canvas, HUD panel from the theme colours, canvas focus ring, CSS-only treatment of the empty (`playing`) phase region.

## What changed & why

- **`App.tsx`** — full rewrite of the scaffold shell (`createConnection`/`VITE_WS_URL`/status
  text removed; `ws/connection.ts` stays untouched and unreferenced, as the spec's non-goals
  require). One session per mount (`useState` lazy initializer, so a re-render never builds a
  second engine/scene), `useSyncExternalStore(session.subscribe, session.getSnapshot,
  session.getSnapshot)` — the engine's referential-stability contract (AC-11) means the shell
  re-renders only when stats/phase/level change, never per frame. `<main>` composes
  `GameCanvas` + `Hud` + the single `role="status" aria-live="polite"` region. The region is
  unconditional and its text is pinned: intro `Click or press any key to skip`, travel
  `Traveling to the next cube…`, playing `` (empty text content — never removed, never
  `hidden`). `./ui/app.css` is imported here (Vitest stubs CSS; Vite bundles it).
- **`ui/Hud.tsx`** — pure props (`stats`, `levelIndex`): the pinned
  `<section aria-label="Game statistics">` with `Clicks: <span data-stat="clicks">N</span>`,
  `Faces destroyed: <span data-stat="faces-destroyed">N</span>`, `Cube
  <span data-stat="cube">N+1</span>`. No `role`/`aria-live` on either counter; the code
  comment states the AC-14 rationale (one predictable announcement stream).
- **`ui/GameCanvas.tsx`** — the `<canvas>` with `tabIndex={0}`, the pinned `aria-label`, and
  `style={{ touchAction: 'none' }}` (AC-13). Deliberately thin effect: `session.attach(canvas)`
  on mount, `session.dispose()` in the cleanup (the session owns the whole runtime).
- **`ui/theme.ts`** — `HUD_TEXT = '#e8f6ff'`, `HUD_BACKGROUND = 'rgba(6, 10, 20, 0.72)'`,
  `ACCENT = '#7cf6ff'`, `PAGE_BACKGROUND = '#000000'` (the contrast reference: black under
  the starfield, as plan § UI interfaces states).
- **`ui/app.css`** — full-viewport black page, canvas as the layout's drawing surface,
  visible canvas focus ring, HUD panel + tabular-numeral accents from the theme colours, and
  the phase region as a bottom pill. The CSS-only phase treatment drops the pill's chrome
  when the region is `:empty` (`padding`/border/background transparent) instead of
  `display:none`, so the element is never hidden (AC-14 wording).
- **Tests** — `App.test.tsx` rewritten (old scaffold assertions gone), plus `Hud.test.tsx`,
  `GameCanvas.test.tsx`, `theme.test.ts`. All SSR via `react-dom/server` in the existing node
  environment (no DOM dependency); exact full-markup assertions per phase.

## Decisions

- **App accepts an optional injected `session`.** Spec AC-1/AC-14 and T14 require exact
  markup *per phase*, and this workspace deliberately has no DOM test environment (plan D-5,
  spec Q-8), so the phase must be controllable without running effects. The prop is an
  additive test seam in the same dependency-injection style the session itself uses
  (`env`/`engine`); production (`main.tsx`, untouched) renders `<App />` with no props and the
  `useState` initializer creates the real browser session. The default path is itself tested
  (the first `App` test renders `<App />` and gets the intro shell).
- **Pinned `aria-label`** (T14 leaves the exact string to the test; spec AC-1 only requires it
  to name rotate/select/explode keys):
  `Game canvas: drag or press arrow keys to rotate, W A S D to select a mini-cube, Enter or Space to explode it`.
- **`PAGE_BACKGROUND` is exported from `theme.ts`** as the contrast reference. The plan pins
  the other three constants and describes the HUD text as checked "vs page background (black
  #000000 under the starfield)"; exporting the black makes the test compute the real
  composite instead of hard-coding a second literal.
- **`app.css` mirrors the theme literals as CSS custom properties.** A stylesheet cannot
  import TypeScript constants and CSS-in-JS is out of scope; `theme.test.ts` is the guard that
  keeps the pair honest (it computes contrast from `theme.ts`, not from the CSS).
- **The HUD panel is styled with element selectors (`main > section`)** because the pinned HUD
  markup carries no class attribute; adding one would deviate from the pinned markup.
- **Counter style**: `src/ui` directory subtotal is 79.48% statements because the SSR tier
  cannot execute the `GameCanvas` attach/dispose effect (lines 23–30) — the documented
  residual (spec § Testing strategy, plan D-6). The coverage gate is the workspace aggregate,
  which clears comfortably (below); no exclusion or threshold change.

## Evidence

### Tests — `npm test --workspace @cubeclicker/frontend` → 0

Raw log: `/tmp/opencode/t14-test.log`. New/changed test files in the transcript:

```
 ✓ src/ui/theme.test.ts (2 tests) 5ms
 ✓ src/ui/Hud.test.tsx (3 tests) 12ms
 ✓ src/ui/GameCanvas.test.tsx (2 tests) 13ms
 ✓ src/App.test.tsx (4 tests) 20ms
 ...
 Test Files  20 passed (20)
      Tests  273 passed (273)
```

All three `.test.tsx` component files are listed; the pre-existing 19 files (263 tests) still
pass unchanged, including `src/ws/connection.test.ts` (10 tests) — that module is retained and
no longer referenced by the shell.

### Coverage — `npm run coverage --workspace @cubeclicker/frontend` → 0

Raw log: `/tmp/opencode/t14-coverage.log`.

```
 % Coverage report from v8
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|-------------------
All files        |   99.17 |    99.13 |     100 |   99.17 |
 src             |     100 |      100 |     100 |     100 |
  App.tsx        |     100 |      100 |     100 |     100 |
  browser-env.ts |     100 |      100 |     100 |     100 |
 src/game        |     100 |     99.6 |     100 |     100 |
  session.ts     |     100 |    98.18 |     100 |     100 | 173
 src/input       |     100 |      100 |     100 |     100 |
 src/render      |   99.68 |    99.27 |     100 |   99.68 |
  picking.ts     |   93.54 |     87.5 |     100 |   93.54 | 88-89
 src/ui          |   79.48 |      100 |     100 |   79.48 |
  GameCanvas.tsx |    61.9 |      100 |     100 |    61.9 | 23-30
  Hud.tsx        |     100 |      100 |     100 |     100 |
  theme.ts       |     100 |      100 |     100 |     100 |
 src/ws          |   95.34 |    92.59 |     100 |   95.34 |
-----------------|---------|----------|---------|---------|-------------------
```

Per-metric workspace aggregate: **statements 99.17, branches 99.13, functions 100, lines
99.17** — all four ≥ 80. Thresholds and exclusions untouched (still only `src/main.tsx` + test
patterns). `App.tsx` is 100% because both initializer arms are exercised (injected and default
session).

### Typecheck / lint → 0

```
$ npm run typecheck --workspace @cubeclicker/frontend
> tsc --noEmit
(no diagnostics; exit 0)

$ npm run lint
> eslint .
(no diagnostics; exit 0)
```

### Build — `npm run build --workspace @cubeclicker/frontend` → 0

Raw log: `/tmp/opencode/t14-build.log`.

```
vite v7.3.7 building client environment for production...
✓ 49 modules transformed.
dist/index.html                   0.40 kB │ gzip:   0.27 kB
dist/assets/index-BaygJ9fo.css    1.32 kB │ gzip:   0.63 kB
dist/assets/index-BOpRCXKK.js   770.83 kB │ gzip: 209.10 kB
✓ built in 1.25s
(!) Some chunks are larger than 500 kB after minification. ... (warning only, exit 0)
```

Initial JS **209.10 kB gzip** (CSS 0.63 kB gzip, HTML 0.27 kB gzip) — the T15 AC-20 budget is
≤ 350 kB gzip, so this is the recorded baseline (140.9 kB of headroom). The 500 kB warning is
Vite's uncompressed chunk advisory, not a failure.

### Banned-matcher grep over the new/changed test files → no matches

```
$ grep -nE "expect\.anything|expect\.any\(|objectContaining|arrayContaining|stringContaining|stringMatching|toMatchObject|toBeTruthy|toBeDefined|not\.toThrow|toHaveBeenCalled" \
    src/frontend/src/App.test.tsx src/frontend/src/ui/Hud.test.tsx \
    src/frontend/src/ui/GameCanvas.test.tsx src/frontend/src/ui/theme.test.ts
(no output; exit 1)
```

**0** bounded exceptions (no `closeTo`/tolerance matcher); float contrast is asserted as the
exact rounded value (`18.26`) plus the concrete `≥ 4.5` gate.

### Scope — only `files_owned` paths changed

```
$ git status --short
 M src/frontend/src/App.test.tsx
 M src/frontend/src/App.tsx
?? src/frontend/src/ui/            (app.css, HUD, canvas, theme + 3 tests)
?? docs/features/cube-game-frontend/build-log-T14.md
```

The pre-existing `docs/features/README.md`, `docs/features/cube-game-frontend/status.md`,
`tasks.md` modifications and the `agent-model-tuning` files were already in the working tree
before this task (orchestrator's) and are **not** staged or committed here. No
`main.tsx`/`ws/**`/`game/**`/`render/**`/`input/**`/config/container/dependency change.

## Acceptance audit

- **AC-1 (game shell renders on first paint) → met.** `App.test.tsx` asserts the full
  `renderToStaticMarkup(<App />)` string: focusable `<canvas tabindex="0">` with the pinned
  `aria-label`, the HUD section `aria-label="Game statistics"` with `Clicks: 0`,
  `Faces destroyed: 0`, `Cube 1`, the skip hint `Click or press any key to skip`, and
  `style="touch-action:none"` on the canvas. `GameCanvas.test.tsx` pins the canvas markup
  alone; `Hud.test.tsx` pins the HUD markup alone.
- **AC-3 (canvas) → met for T14's surface.** The shell renders the canvas the scene draws
  into; starfield/background evidence stays in `starfield.test.ts`/`scene.test.ts` (T7/T12).
- **AC-11 (live HUD binding) → met.** `App` passes `snapshot.stats`/`snapshot.levelIndex` to
  the pure HUD; the App binding test renders `{ clicks: 12, facesDestroyed: 4 }, levelIndex 3`
  and asserts `Clicks: 12`, `Faces destroyed: 4`, `Cube 4`; `Hud.test.tsx` pins the zero state
  and `levelIndex + 1`. Snapshot stability itself is T6's `engine.test.ts`.
- **AC-13 (touch-action) → met.** Inline `touch-action:none` is asserted in the exact canvas
  markup of `GameCanvas.test.tsx`/`App.test.tsx`; `app.css` repeats it for the element rule.
  Sizing/pixel-ratio behavior is T13 (`session.test.ts`).
- **AC-14 (accessibility semantics/announcements) → met.** Exactly one `role="status"
  aria-live="polite"` element in every phase (uniqueness counted in the playing/stats tests);
  intro/travel/playing texts are pinned and the playing region is empty *text* while still
  rendered (asserted present, and `hidden` absent); `Hud.test.tsx` asserts neither counter span
  carries `role`/`aria-live` (and the HUD markup contributes neither attribute at all);
  `theme.test.ts` computes WCAG contrast **18.26:1** from the exported constants
  (`HUD_TEXT` over `HUD_BACKGROUND` composited on `PAGE_BACKGROUND`) and asserts ≥ 4.5.

## Replaced scaffold assertions (expected behavior change)

`App.test.tsx` previously asserted the scaffold's connection status
(`<span data-status="connecting">Connecting…</span>`) and `App.tsx` imported
`createConnection` plus `import.meta.env.VITE_WS_URL`. T14 replaces that with the game shell:
the shell no longer imports `ws/connection.ts` (the module and its 10 tests are untouched and
still pass — it is kept for the future real-time feature per spec § Non-goals). This is the
feature's intended behavior change, not a weakened assertion: the new tests pin a strictly
larger exact markup (canvas + HUD + live region).

## Residuals / honest limits

- `GameCanvas.tsx` lines 23–30 (the mount effect: `attach`/`dispose`) are not executed by the
  SSR tier — no DOM environment exists by design (plan D-5). The session lifecycle itself is
  fully covered by `session.test.ts` (T13); the component body is one call each way.
  Workspace aggregate still clears 80 on all four metrics.
- The CSS literals are a mirror of `theme.ts` (documented under Decisions); no automated test
  parses CSS in this environment.

## Deviations from spec

- None in behavior, pinned copy, colours, constants or ACs. Two additive implementation
  choices are recorded above and change no AC: the optional `session` prop (a test seam with
  the same default behavior) and exporting `PAGE_BACKGROUND` as the contrast reference. No
  dependency, config, container, `main.tsx`, `ws/**` or other feature-doc change; no coverage
  exclusion or threshold change.
