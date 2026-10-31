---
feature: futuristic-hud-blue
revision: 2
---

# Plan — Futuristic HUD Blue

## Architecture

The feature is a CSS presentation pass over the existing HUD overlay plus a test guard update. No runtime logic changes.

- **Modules touched:**
  - `src/frontend/src/ui/app.css` — restyles `main > section` and its minimize button; adds scanline keyframe/animation on `::after`; retains border-light on `::before` (inset adjusted to `0` to survive `overflow: hidden`) and blink; adds responsive and reduced-motion rules.
  - `src/frontend/src/ui/app.css.test.ts` — adds grep guards for the new CSS contracts (AC-2..AC-9, AC-11), anchored to the canonical rules/media blocks per review F2.
  - `src/frontend/src/ui/theme.ts` / `theme.test.ts` — unchanged (AC-1).
  - `src/frontend/src/ui/Hud.tsx` — unchanged markup/props (AC-10); styling is driven by the `main > section` selector.
- **Data flow / state ownership:** unchanged. `App` continues to own `hudMinimized` and `hudBlinking`; `Hud` remains a pure presentational component. No new state.
- **Rendering:** the HUD remains a DOM overlay above the canvas. CSS pseudo-elements provide the scanline (`::after`), border light (`::before`), and minimize-button glyph without altering the React tree.

## Interfaces / contracts

No TypeScript interface changes. The CSS contract (grep-guarded) is:

- `main > section` base rule (single consolidated block) contains: `position: absolute`, `backdrop-filter`/`-webkit-backdrop-filter` with `blur(`, `box-shadow` with `rgba(124, 246, 255`, `border` with `rgba(124, 246, 255`, `overflow: hidden`, and `pointer-events: none` on the detailing pseudo-elements (AC-2).
- `main > section button` rule contains: `pointer-events: auto`, `cursor: pointer`, `min-width: 1.5rem`, `min-height: 1.5rem` (AC-3).
- `main > section button::before` (or `::after`) contains `content:` (AC-3).
- `main > section button:focus-visible` contains `outline: 2px solid var(--accent)` (or `#7cf6ff`) (AC-4).
- `main > section[data-minimized="true"]` (selector exactly, no trailing ` p`/pseudo) contains `opacity:` or `filter: brightness(` to dim the panel; the adjacent `... p` rule collapses stat paragraphs (AC-5).
- `@keyframes hud-scanline` exists; applied to `main > section::after` only as `animation: hud-scanline <n>ms linear infinite;` with `2000 <= n <= 6000`; the `::after` rule carries `content:`, `position: absolute`, `pointer-events: none` (AC-6). `::before` remains the border-light carrier (AC-8).
- `@media (prefers-reduced-motion: reduce)` disables `animation` and `transition` for `main > section`, `main > section::before`, `main > section::after`, `main > section button`, `main > section[data-minimized="true"] p`, and `main > section[data-blinking="true"]` (AC-7).
- `@media (max-width: 480px)` existing block gains a `main > section` rule adjusting `padding` and/or `font-size` (AC-11).
- Retained: `@keyframes border-light-travel`, `@keyframes hud-blink`, and their application rules and reduced-motion disabling; `main > section::before` uses `inset: 0` (AC-8, F3).

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/ui/app.css` | Edit | Futuristic blue technologic HUD styling, scanline (on `::after`), minimize button, responsive + reduced-motion rules; border-light retained on `::before` with `inset: 0` |
| `src/frontend/src/ui/app.css.test.ts` | Edit | Grep guards for new and retained CSS contracts (anchored per F2) |
| `src/frontend/src/ui/Hud.tsx` | Unchanged | Markup contract preserved (AC-10) |
| `src/frontend/src/ui/theme.ts` | Unchanged | Colour constants preserved (AC-1) |
| `src/frontend/src/ui/theme.test.ts` | Unchanged | Contrast gate preserved |
| `src/frontend/src/App.tsx` | Unchanged | State ownership unchanged |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | CSS-only redesign (no React markup change) | Keeps existing tests and data hooks stable; pseudo-elements provide detailing | Restructure `Hud.tsx` with new wrappers/classes — rejected as default because it breaks pinned markup and requires a spec revision |
| D-2 | Retain theme colour constants | Preserves WCAG AA contrast gate and avoids cascading test edits | Deeper blue palette — deferred to open question Q-4 |
| D-3 | Visible minimize button via CSS only | Fixes the broken/undersized control without changing markup | Add button children/icon in JSX — deferred to open question Q-2 |
| D-4 | Single scanline keyframe in 2000–6000 ms range on `::after` only | Testable, bounded animation consistent with border-light range; avoids overwriting the border-light animation on `::before` (F1) | Faster flicker — rejected for motion-sickness risk; combined shorthand on one pseudo — rejected (F1) |
| D-5 | No backend/container change | Frontend presentation only; matches predecessor non-goals | None |
| D-6 | `overflow: hidden` retained; border-light ring moved inside via `inset: 0` (F3) | Reconciles AC-2 with AC-8 so the border light is not clipped while both guards pass | Move border light to a non-clipped layer — rejected as more invasive |
| D-7 | Reduced-motion selector list explicitly names `::before`/`::after` (F4) | Prevents the scanline animating under `prefers-reduced-motion: reduce` | Rely on "and its pseudo-elements" shorthand — rejected (unverifiable) |

## Risks & mitigations

- Reference image unavailable → layout may not match user expectation → open question Q-1; default retains existing placement; spec revision required for a different layout.
- CSS pseudo-element layering could obscure HUD text → mitigate with `pointer-events: none` on pseudo-elements (AC-2/AC-6/AC-8) and paint order (`::before` before content, `::after` after but low opacity); covered by grep guards and manual visual check (F7).
- Scanline animation could affect performance on low-end devices → bounded duration and single element; open question Q-3 allows reducing to a static gradient.
- Reduced-motion regressions → media query disables all animations/transitions for the named selectors including `::after`; guarded by AC-7 (F4).
- Border light clipped by `overflow: hidden` → reconciled via `inset: 0` on `::before` (F3); verify visually at the code gate (grep guards alone will not catch a clipped ring).
- Coverage churn → no TS behaviour change; CSS guards added to `app.css.test.ts` only.
- T1 owns a 626-line stylesheet plus its guard test in one session (F8): `files_owned` cannot be split across tasks without overlapping edits, so T1 stays single; if the builder reports overload, escalate to the orchestrator rather than splitting files.

## Open questions

See spec.md § Open questions (Q-1..Q-5). Key items: reference layout unknown due to unreadable image; minimize-button affordance; scanline intensity; theme colour change; feature scope (split option confirmed at `awaiting_approval`, F9).

## Documentation impact

- No README, architecture, or container documentation change expected (CSS-only, no new services/ports/config).
- `docs/features/README.md` row update is orchestrator-owned on acceptance (status transition).

## Revision history

- r2 — 2026-10-28 — revision after spec review r1 (F1–F9): see spec.md § Revision history.