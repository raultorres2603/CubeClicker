# Build log — T1 — Fullscreen viewport CSS, shell & index.html

Task: T1 (2026-10-23) — `docs/features/fullscreen-responsive-layout/tasks.md`
Files changed:
- `src/frontend/index.html`
- `src/frontend/src/ui/app.css`
- `src/frontend/src/main.tsx`

## Sketch (≤ 5 lines, written before the code)

1. `index.html`: add `viewport-fit=cover` to the viewport meta for safe-area support.
2. `app.css`: make `html`/`body`/`#root`/`main` fill the viewport with `100vh`/`100dvh` (100vh fallback), no margin/padding/scrollbars.
3. `app.css`: safe-area-aware offsets on HUD, banner, panel, and phase announcement via `env(safe-area-inset-*)`.
4. `app.css`: `min-width`/`min-height: 44px` on the three shell controls (Users on Server, Return to my cube, Retry).
5. `main.tsx`: document that viewport sizing and resize handling are owned by CSS/session (no new bootstrap).

## What changed & why
- **`index.html`** — `viewport-fit=cover` enables `env(safe-area-inset-*)` on notched devices.
- **`app.css`** — viewport units + overflow hidden eliminate letterboxing/scrollbars; overlays keep absolute positioning with safe-area offsets; tap targets meet 44 px.
- **`main.tsx`** — comment only; mount path unchanged.
- No markup change to `App.tsx`/`App.test.tsx`: SSR assertions preserved (no ledgered additions).

## Evidence

- `npm run lint` → exit 0 (no diagnostics).
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0 (no diagnostics).
- `npm test --workspace @cubeclicker/frontend` → 28 test files, 642 tests passed.
- `npm run coverage --workspace @cubeclicker/frontend` → All files 95.97% statements, 96.68% branches, 97.26% functions, 95.97% lines (all ≥ 80).
- `npm run build --workspace @cubeclicker/frontend` → exit 0 (built in 1.28s).

## Acceptance audit
- AC-1 (full viewport fill) → met by CSS (`100vw`/`100vh`/`100dvh`, overflow hidden); manual browser pass recorded per § Testing strategy sizes.
- AC-2 (dynamic viewport units) → met: `100dvh` + `100vh` present in `app.css`.
- AC-3 (no letterboxing) → met: no aspect-ratio/max-width clamping on `main`/`canvas`/`#root`.
- AC-4 (overlaid HUD/panels) → met: absolute positioning + pointer-events retained.
- AC-5 (safe-area insets) → met: `env(safe-area-inset-*)` in `app.css`.
- AC-13 (tap targets ≥ 44 px) → met: `min-width`/`min-height: 44px` on the three shell controls.
- AC-14 (accessibility retained) → met: markup unchanged; `index.html` has no orientation lock.

## Deviations from spec
None. No markup changes; SSR assertions unchanged.