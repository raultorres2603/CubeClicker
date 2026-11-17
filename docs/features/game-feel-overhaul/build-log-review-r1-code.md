# Build log — review r1 code fixes — game-feel-overhaul

Task: code-review r1 code fixes (2026-11-17), branch `feat/game-feel-overhaul`, reviewed tip `8ff8e71`.
Files changed: `src/frontend/src/App.tsx`, `App.test.tsx`, `src/frontend/src/ui/SpaceshipCustomizationPanel.tsx`, `SpaceshipCustomizationPanel.test.tsx`, `src/frontend/src/game/reveal-motion.ts`, `reveal-motion.test.ts`, `src/frontend/src/ui/app.css`, `app.css.test.ts`, `src/frontend/src/ui/game-view.css`, `game-view.css.test.ts`, this log.
What changed & why:

1. **F3 (AC-31)** — `App` propagates the session preference as `data-reduced-motion="true|false"` on the gameplay `<main>`; `game-view.css` adds a top-level `main[data-reduced-motion='true']` block (outside the OS media query) that disables the three `.gf-live-dot` pulses, the `.connection-dot` pulse, the `.customization-toggle`/`.upgrade-buy` press transitions, the reveal spotlight on `.customization-panel[data-reveal-active='true']`, the HUD minimize/button transitions, the HUD blink and the `.hud-coin-pop` rise. The OS `prefers-reduced-motion` block is unchanged, so the session flag works independently.
2. **F4 (D-1)** — dropped the four mirrored grant attributes (`data-part-id`, `data-slot`, `data-rarity`, `data-duplicate`) from the customization `<section>`; `.lootbox-reveal` is the single sanitized identity carrier. App-level queries now target `.lootbox-reveal` (the AC-7 authority). Reveal behaviour is unchanged.
3. **F6 (AC-6)** — `normalizeElapsed` now clamps `+Infinity` to the 1290 ms rest row (`Math.min(+Infinity, 1290)`), while `NaN`, `-Infinity` and non-positive values still map to 0.
4. **F8** — the HUD '▾' pseudo-element glyph is scoped from `main > section button::before` to `.hud-panel > button::before`, so the HUD minimize keeps its glyph and the new `.gf-cta`/reveal controls do not inherit it. The upgrades buy glyph rule stays (now independent).

Decisions:

- The session marker is only on the gameplay shell `<main>`; the email-verification route is not the game shell and keeps its markup (its test still asserts no `data-customization-open`).
- The session reduced-motion rules live in `game-view.css`, imported after `app.css`, so they override the HUD minimize transition declared in `app.css` without touching that base rule.
- The section mirror was removed rather than kept as a convenience; the dedicated panel test asserts all four attributes are absent on the section while the reveal root carries them.
- No new dependency, no coverage exclusion/threshold change, no banned matcher; new tests assert exact selectors/declarations and concrete attribute values.
- F1/F2/F5/F7 are docs/evidence items handled separately; `docs/product/glossary.md` and `build-log-T11.md` were not touched.

Evidence:

- `npm run lint` → exit 0, no output beyond the npm banner (`lint exit=0`).
- `npm run typecheck` → exit 0, both workspaces (`typecheck exit=0`).
- `npm test --workspace @cubeclicker/frontend` → exit 0:

  ```
   Test Files  78 passed (78)
        Tests  2439 passed (2439)
     Duration  3.75s
  ```

- `npm run coverage --workspace @cubeclicker/frontend` → exit 0, per-workspace thresholds ≥ 80 met:

  ```
  All files          |   96.84 |    96.51 |   98.04 |   96.84 |
  ```

- `git diff --check` → exit 0, no whitespace errors (`diff-check exit=0`).

Targeted regression checks added:

- `App.test.tsx`: `main[data-reduced-motion]` false on the default shell, true after a reduced-motion snapshot update; static shell exact markup includes the attribute; reveal queries target `.lootbox-reveal`.
- `game-view.css.test.ts`: top-level exact selector list + `animation: none; transition: none` guard for the session switch; jsdom cascade test with `<main data-reduced-motion="true">` asserting `animationName === 'none'` on the live dots/coin pop/reveal panel and `transitionDuration === '0s'` on the HUD, toggle and buy button.
- `app.css.test.ts`: `.hud-panel > button::before` content `'▾'`; negative checks for `main > section button::before`, `.gf-cta::before` and reveal-button `::before`.
- `SpaceshipCustomizationPanel.test.tsx`: section has none of the four grant attributes while revealing; reveal root keeps the exact sanitized identity.
- `reveal-motion.test.ts`: `+Infinity` → exact rest row (and equal to 1290 ms); `-Infinity`/NaN still the 0 ms charge row; `+Infinity` added to the reduced-motion row list.

Acceptance audit:

- F3 / AC-31 → met: session marker on `<main>`; session rules cover every flagged animation/transition; OS media block retained.
- F4 → met: section mirror removed, App assertions retargeted, reveal behaviour untouched.
- F6 / AC-6 → met: `+Infinity` clamps to the rest row, boundary test added; negative/NaN behaviour retained.
- F8 → met: glyph scoped to the HUD minimize; negative selector checks added.
- F1/F2/F7 (blockers/INFO docs and evidence) → out of this task's scope, unchanged.

Deviations from spec: none.
