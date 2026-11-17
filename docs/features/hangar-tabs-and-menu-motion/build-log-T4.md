# Build log — T4 — CSS: tab chrome, menu boot, screenshot polish

Task: T4 (2026-11-17), feature `hangar-tabs-and-menu-motion`, branch
`feat/hangar-tabs-and-menu-motion` (4a started from HEAD `9f4543b`, 4b from HEAD `b144c8b`).
Budget: **two builder sessions** over the same two files (`game-view.css`,
`game-view.css.test.ts`); this log carries one section per session and one commit each.

---

## 4a — tab chrome, preview heights, scrollbars, HUD minimize, motion mirrors

Status: **complete** — CSS + test guards green; 4b still owns the menu keyframes, the crew
pill and the reduced-motion scoping.

Files changed:

- `src/frontend/src/ui/game-view.css` (owned)
- `src/frontend/src/ui/game-view.css.test.ts` (owned)
- `docs/features/hangar-tabs-and-menu-motion/build-log-T4.md` (this log)

### What changed & why

1. `main` now mirrors the four T1 tokens as `--motion-menu-boot-ms: 320ms`,
   `--motion-menu-flicker-ms: 120ms`, `--motion-menu-chroma-ms: 90ms`,
   `--motion-tab-switch-ms: 140ms` (21 CSS-mapped durations; `:root` still declares none).
2. `.customization-tabs` — sticky auto-fit grid (`repeat(auto-fit, minmax(5rem, 1fr))`,
   0.25rem gap, 0.15/0.35rem padding) over the Neon Forge gradient — plus the `.customization-tab`
   chip (44 px, `padding: 0.25rem 0.4rem`, `gap: 0.25rem`, `0.68rem`/`0.06em`, uppercase,
   `nowrap`, `--gf-*` only, exact `:hover`, inset `aria-selected` underline, focus ring),
   the `.customization-tab-badge` metrics and the `.customization-tabpanel` `tab-panel-in` rule.
3. Preview override `.customization-panel .spaceship-preview { height: min(12rem, 26vh) }` with
   the `@media (max-height: 760px) { height: 8rem }` block declared **after** it (equal
   specificity → source order wins; `app.css` untouched).
4. Additive scrollbar rule `.customization-panel, .upgrades-panel, .user-panel .users-list`
   (`scrollbar-width: thin; scrollbar-color: var(--gf-rim) transparent`) plus exactly four
   `::-webkit-scrollbar{,-track,-thumb,-thumb:hover}` rules on the same three surfaces.
5. `.hud-panel > button` compact right-aligned 24 px chevron (1.5rem box, `--gf-*` rim/surface,
   `:hover`/`:focus-visible` pair) and `.hud-panel[data-minimized='true'] > button::before
   { content: '▴' }`; the ≤720 px block gains the stacked label/badge tab rule.

### Decisions

- **Preview rule order matters.** The base `min(12rem, 26vh)` rule is written before the
  `max-height: 760px` override: both are (0,2,0), so the later `8rem` wins on short viewports.
- **Scrollbars stay additive**, per plan key decision 17: no existing `.customization-panel`,
  `.upgrades-panel` or `.user-panel .users-list` body changes, so the accepted exact-body
  assertions keep passing untouched.
- **The tab strip background is the pinned plan gradient**
  `linear-gradient(180deg, var(--gf-surface-top), var(--gf-surface-bottom))` (the `--gf-surface-*`
  glass stops composited over the framed panel). No literal colour is introduced in any
  `.customization-tab*` rule; the only literals in this session are the two pinned
  `rgba(124, 246, 255, 0.35|0.55)` scrollbar thumbs.
- **`tab-panel-in` is referenced, not defined, in 4a.** The declaration is 4a scope; the
  keyframe block itself belongs to 4b (tasks.md 4b). Until then the declaration simply has no
  matching keyframes and no animation runs — no behaviour is claimed before 4b.
- **`withGameStyles` hoisted** from the `stylesheet integration` describe to module scope so
  the second integration case (tab grid/chip/badge) reuses the same real-stylesheet harness;
  no assertion changed by the move.
- **jsdom does not evaluate `@media`.** The ≤720 px stacked rule and the short-viewport preview
  height are therefore guarded at the CSS-source level (exact declaration lists inside their
  blocks); the computed checks cover the base cascades (44 px chip, `nowrap`, sticky grid,
  24 px HUD control).
- **No `flex-direction` on the base tab**: the column direction is a phone-only override, so the
  base rule stays a row (asserted).

### Raw evidence

Lint (root, whole repo):

```text
$ npm run lint

> lint
> eslint .

EXIT=0
```

Typecheck (all workspaces):

```text
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

EXIT=0
```

Focused stylesheet suite (86 tests, +12 for 4a):

```text
$ npx vitest run src/ui/game-view.css.test.ts --reporter=basic

 ✓ src/ui/game-view.css.test.ts (86 tests) 272ms

 Test Files  1 passed (1)
      Tests  86 passed (86)
EXIT=0
```

Frontend workspace suite (the task gate):

```text
$ npm test --workspace @cubeclicker/frontend

 Test Files  79 passed (79)
      Tests  2491 passed (2491)
   Duration  4.01s (transform 9.23s, setup 0ms, collect 25.65s, tests 14.86s, environment 11.98s, prepare 6.77s)
EXIT=0
```

Frontend coverage (thresholds unchanged at 80/80/80/80, no exclusion added):

```text
$ COLUMNS=220 npm run coverage --workspace @cubeclicker/frontend

 Test Files  79 passed (79)
      Tests  2491 passed (2491)
   Duration  5.91s (transform 9.40s, setup 0ms, collect 26.38s, tests 22.98s, environment 13.96s, prepare 8.17s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.86 |    96.52 |   98.06 |   96.86 |
 src/ui            |   97.55 |    95.21 |   97.11 |   97.55 |
  hangar-tabs.ts   |     100 |      100 |     100 |     100 |
EXIT=0
```

Whitespace / tree state:

```text
$ git diff --check
(no output)
EXIT=0
```

### Rule / selector evidence (source guards)

`game-view.css.test.ts` asserts, with exact declaration lists:

| Guard | Selector(s) | Pinned evidence |
| --- | --- | --- |
| AC-11 | `main`, `:root` | 21 `--motion-*` entries in order; four new names mapped to `MOTION.menuBootMs/menuFlickerMs/menuChromaMs/tabSwitchMs`; `:root` `--motion-*` list is empty |
| AC-7/AC-22 | `.customization-tabs` | `position: sticky`, `top: 0`, `z-index: 1`, `display: grid`, `grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr))`, `gap: 0.25rem`, `padding: 0.15rem 0 0.35rem`, gradient background |
| AC-9/AC-22 | `.customization-tab`, `:hover`, `[aria-selected='true']`, `:focus-visible` | 17-declaration chip body (44 px, 0.25/0.4 padding, 0.25 gap, 0.68rem, 0.06em, uppercase, `nowrap`), hover exactly `border-color`+`color`, inset `0 -2px 0` underline, 2 px focus ring |
| AC-9 | `.customization-tab-badge` | `min-width: 1.1rem`, `height: 1.1rem`, `padding: 0 0.2rem`, `font-size: 0.6rem`, `nowrap`, `--gf-void`/`--gf-rim-strong` |
| AC-9 | every `.customization-tab*` rule | exact 7-rule selector list; no hex and no `rgb()`/`rgba()` literal in any declaration |
| AC-22 | `@media (max-width: 720px)` `.customization-tab` | `flex-direction: column; gap: 0.1rem; padding: 0.25rem 0.3rem; font-size: 0.66rem; letter-spacing: 0.04em`, and the base rule declares no `flex-direction` |
| AC-7 | `.customization-panel .spaceship-preview`, `@media (max-height: 760px)`, app.css `.customization-panel` | `height: min(12rem, 26vh)`; exactly one 760 px block with `height: 8rem`; `max-height: 60vh`/`overflow-y: auto`/accepted width still in `app.css`; no `overflow*` declaration anywhere in the `.customization-tab*` subtree |
| AC-19 | grouped scrollbar rule + four `::-webkit-*` rules | exact 2-declaration grouped rule, exactly one rule per WebKit part with the pinned 6 px/track/thumb `rgba` values, one base rule per surface (additive, not merged) |
| AC-21 | `.hud-panel > button`, `:hover`/`:focus-visible`, `[data-minimized='true'] > button::before` | exact 10-declaration body (1.5rem box = 24 px < 44 px, `align-self: flex-end`), hover/focus pair, `content: '▴'`, `app.css` still owns `'▾'` |

Computed-style evidence on injected real markup (both stylesheets, jsdom):

- `.customization-tabs` → `display: grid`, `grid-template-columns: repeat(auto-fit, minmax(5rem, 1fr))`,
  `gap: 0.25rem`, `position: sticky`, `top: 0px`, `z-index: 1`.
- `.customization-tab` → `display: inline-flex`, `min-height: 44px`, `padding: 4px 6.4px`,
  `font-size: 10.88px`, `text-transform: uppercase`, `white-space: nowrap`, `cursor: pointer`.
- `.customization-tab-badge` → `min-width: 17.6px`, `height: 17.6px`, `font-size: 9.6px`,
  `white-space: nowrap`.
- `.hud-panel > button` → `align-self: flex-end`, `width/height/min-width/min-height: 24px`,
  `padding: 0px`.

Track arithmetic (AC-22, 320 px viewport): 20rem viewport − 2×1rem panel inset − 2×1rem panel
padding = 16rem content box; three 5rem tracks + two 0.25rem gaps = 15.5rem fit, four tracks +
three gaps = 20.75rem do not (`game-view.css.test.ts`).

### Acceptance audit (4a share)

- **AC-7 — met.** Tabs are `position: sticky; top: 0` over the pinned gradient; `.customization-tabpanel`
  declares only the animation (no `overflow`/`height`/`max-height`); preview `min(12rem, 26vh)` and
  `8rem` under `max-height: 760px` in exactly one block declared after the base rule; `app.css` keeps
  `max-height: 60vh`, `overflow-y: auto`, `overflow-x: hidden` and the accepted width; no second
  scroll box in the hangar subtree; no `!important`, no `app.css` edit. Manual `scrollHeight`/`clientHeight`
  rows are T5's.
- **AC-9 — met.** Exact chip body/hover/selected/focus declarations; auto-fit column minimum 5rem
  (80 px, arithmetic guard) with `min-height: 44px`; badge metrics and tokens; exact 7-rule tab
  selector list with no literal hex/rgb colour; computed 44 px/nowrap; 320/375 px clipping is T5's
  manual matrix.
- **AC-11 — met.** `main` declares the four pinned mirrors and the pair test asserts each equals
  `${MOTION.<token>}ms`; `:root` still declares no `--motion-*`. (`motion.test.ts` half shipped in T1.)
- **AC-19 — met.** New grouped rule with exactly `scrollbar-width: thin` and
  `scrollbar-color: var(--gf-rim) transparent`; exactly one rule per `::-webkit-scrollbar`,
  `-track`, `-thumb`, `-thumb:hover` on the same three surfaces with the pinned values; each
  surface keeps one base rule, so no existing body changed.
- **AC-21 — met.** New `.hud-panel > button` rule with the exact AC-21 declarations, a
  `:hover`/`:focus-visible` state, and the pinned `▴` collapsed glyph; 24 px target (not 44 px);
  `app.css` and its `'▾'` base plus ARIA wiring untouched (read-only assertion).
- **AC-22 — met.** `.customization-tabs` exact declarations; chip token-only chrome + uppercase;
  ≤720 px stacked rule inside the existing single 720 px block; three-column/16rem arithmetic;
  placements, safe-area offsets and the open-panel upgrades hide rule untouched.

### Forced assertion rewrites (replacement assertions — never deletions)

- `main` motion-token `declarationList` (AC-11): the 17-entry list becomes the 21-entry list.
- `MOTION`↔CSS pair table (AC-11): four pairs appended.
- `withGameStyles` moved to module scope (helper only; no assertion changed).
- No other pre-existing assertion in `game-view.css.test.ts` was edited.

### Deviations from spec

- None. 4b items (menu keyframes, crew pill, reduced-motion scoping, `UserPanel.test.tsx`) are
  intentionally absent from this session.

---

## 4b — menu boot, crew pill, reduced-motion scoping

Status: **complete** — T4 finished; the full T4 acceptance audit is at the end of this log.

Files changed:

- `src/frontend/src/ui/game-view.css` (owned)
- `src/frontend/src/ui/game-view.css.test.ts` (owned)
- `src/frontend/src/ui/UserPanel.test.tsx` (owned)
- `docs/features/hangar-tabs-and-menu-motion/build-log-T4.md` (this log)

### What changed & why

1. **Four menu beats + the tab swap (AC-12, AC-13, AC-15, AC-18).** New `@keyframes menu-boot`
   (0/12/22/34/46/60/100), `menu-scan` (0/45/70/100), `menu-rail` (0/100), `menu-chroma`
   (0/50/100) and `tab-panel-in` (0/100) with every pinned spec § Sequence stop. The beats
   animate only `opacity`, `border-color` and `text-shadow`; the sole box geometry is
   `menu-scan` `right` (on `::before`) and `menu-rail` `height` (on `::after`), both settling on
   the accepted `right: 0` / `height: 40%` / `opacity: 1` values.
2. **Boot rule sets, open-only (AC-12, AC-13, AC-14).** Four joint rules gated to
   `.customization-panel:not([data-reveal-active='true'])` + `.user-panel .users-list` cover the
   flicker (root), the scan (the existing top light edge `::before`), the rail (the existing left
   status rail `::after`) and the chroma (the panel title / crew title). No `pointer-events`,
   `inert`, `aria-hidden` or timer is added: nothing is disabled while the beats run, and closing
   still unmounts in one commit, so every open replays the sequence. The tabpanel keeps the
   keyed 140 ms fade declared in 4a, whose keyframes ship here.
3. **Crew pill swap (AC-20).** `.user-panel > .users-badge` is now Neon Forge glass
   (`border: 1px solid var(--gf-rim)`, `background: var(--gf-surface-raised)`,
   `color: var(--gf-text)`) with the accepted `border-radius: 999px` / `min-height: 44px`; its
   `:hover` is exactly `border-color: var(--gf-rim-strong)` + `filter: brightness(1.08)`. The
   `--users-badge-top`/`--users-badge-bottom` gradient moved to `.users-count` with `#ffffff`
   text, so both accepted tokens stay declared **and** consumed (`game-feel-overhaul` AC-17).
4. **Reduced motion, specificity-safe (AC-17).** The single `@media (prefers-reduced-motion:
   reduce)` block and the single top-level `main[data-reduced-motion='true']` session block each
   gained the scoped selector list: the boot root and its `::before`/`::after`/title, the reveal
   state (closing the pre-existing `reveal-spotlight` OS gap), `.customization-tabs`,
   `.customization-tab`, `.customization-tabpanel`, and the crew root/`::before`/`::after`/title.
   No selector was dropped (36 → 46 in the OS list, 9 → 20 in the session list), no second block
   was added, and every animation rule is written before the media block so equal specificity
   resolves to the off-state.
5. **`UserPanel.test.tsx` (AC-13, AC-16).** A fake-timer toggle cycle proves the crew list still
   mounts on open, unmounts immediately on close, remounts as a *new* element on re-open (so the
   boot replays) and leaves `vi.getTimerCount()` at `0` after every step.

### Decisions

- **The boot section sits before the reduced-motion blocks** (after the level banner, before the
  themed-scrollbar rules). Source order is part of the AC-17 contract: the (0,2,0) boot rules lose
  to the equally specific scoped media selector and to the (0,3,x) session selectors only because
  the off-switches come later.
- **Keyframes settle on the accepted resting declarations.** `menu-boot` ends on
  `opacity: 1`/`border-color: var(--gf-rim)`, `menu-scan` on `right: 0`, `menu-rail` on
  `height: 40%`/`opacity: 1`, `menu-chroma` on `text-shadow: none`; with `both` fill the panel
  paints exactly as the unanimated state once the beat ends (AC-18), and no start state is ever
  retained (AC-16).
- **`.users-count` keeps the pinned white text.** `#ffffff` on the count badge is the one literal
  colour this feature adds besides the two pinned scrollbar thumbs (AC-9/AC-20).
- **jsdom cannot compute the `animation` shorthand.** A probe showed cssstyle leaves
  `animation-name` at its initial `none` for `animation: menu-boot var(...) linear both`, so the
  boot is guarded where the plan puts it — CSS source (stops, declarations, order, specificity) —
  and the integration tier instead proves the *selector gating* on real markup
  (`Element.matches` for the normal panel / crew list, never the reveal panel or the HUD), the
  crew-pill computed metrics (44 px target, 999 px radius, 22.4 px count box, white text) and
  that jsdom's real CSS parser keeps the five keyframe rules and both grouped off-switch rules.
- **The session-cascade integration case is a matching proof, not a paint proof.** The extended
  markup asserts which parts of the one session rule actually select each boot surface, so
  deleting `.user-panel .users-list` (or the scoped `:not(...)` panel selector) from the session
  block fails the test even though jsdom cannot animate.
- **Forced rewrites stay replacements.** The three crew bodies, both grouped selector lists and
  the session-cascade markup case were rewritten in place; no assertion was deleted without a
  replacement for the new contract.

### Raw evidence

Lint (root, whole repo):

```text
$ npm run lint

> lint
> eslint .

EXIT=0
```

Typecheck (all workspaces):

```text
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present

> typecheck
> tsc --noEmit

> typecheck
> tsc --noEmit

EXIT=0
```

Focused suites (CSS source guards + the crew integration suite):

```text
$ npx vitest run src/ui/game-view.css.test.ts src/ui/UserPanel.test.tsx

 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/UserPanel.test.tsx (14 tests) 157ms
 ✓ src/ui/game-view.css.test.ts (99 tests) 313ms

 Test Files  2 passed (2)
      Tests  113 passed (113)
EXIT=0
```

Frontend workspace suite (the task gate; 2491 → 2505 tests, +13 CSS guards and +1 crew case):

```text
$ npm test --workspace @cubeclicker/frontend

 Test Files  79 passed (79)
      Tests  2505 passed (2505)
   Duration  3.75s (transform 8.98s, setup 0ms, collect 24.13s, tests 14.06s, environment 11.15s, prepare 5.93s)
EXIT=0
```

Frontend coverage (thresholds unchanged at 80/80/80/80, no exclusion added):

```text
$ COLUMNS=220 npm run coverage --workspace @cubeclicker/frontend

 Test Files  79 passed (79)
      Tests  2505 passed (2505)
   Duration  5.50s (transform 9.93s, setup 0ms, collect 25.01s, tests 22.75s, environment 13.14s, prepare 8.21s)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.86 |    96.52 |   98.06 |   96.86 |
 src/ui            |   97.55 |    95.21 |   97.11 |   97.55 |
  UserPanel.tsx    |     100 |      100 |     100 |     100 |
  hangar-tabs.ts   |     100 |      100 |     100 |     100 |
EXIT=0
```

Whitespace / tree state:

```text
$ git diff --check
(no output)
EXIT=0
```

### Assertion-strength probe

Three deliberate mutations to `game-view.css` (delete the `menu-chroma` 50 % stop, drop
`.customization-tab` from the OS selector list, drop the `:not([data-reveal-active='true'])` gate
from the root boot rule) turned the focused CSS suite red before it was restored:

```text
$ npx vitest run src/ui/game-view.css.test.ts      # mutated source
      Tests  7 failed | 92 passed (99)

$ cp /tmp/opencode/gv.bak src/frontend/src/ui/game-view.css
$ npx vitest run src/ui/game-view.css.test.ts src/ui/UserPanel.test.tsx
      Tests  113 passed (113)
```

### Rule / selector evidence (source guards)

| Guard | Selector(s) | Pinned evidence |
| --- | --- | --- |
| AC-12 | `@keyframes menu-boot`, `menu-scan`, `menu-rail`, `menu-chroma` | every stop + every declaration exactly as spec § Sequence (`0/12/22/34/46/60/100`, `0/45/70/100`, `0/100`, `0/50/100`), one block each |
| AC-12 | the four beats' property set | banned sweep `transform`/`filter`/`backdrop-filter`/`clip-path`/`margin*`/`left` is empty; geometry is only `menu-scan` `right: 100% → 0` and `menu-rail` `height: 8% → 40%` |
| AC-12/AC-13 | `.customization-panel:not([data-reveal-active='true']), .user-panel .users-list` + `::before` + `::after` + titles | exact one-declaration bodies (`menu-boot … linear both`, `menu-scan … linear both`, `menu-rail … steps(2, end) both`, `menu-chroma … steps(3, end) both`) |
| AC-14 | every rule with `animation: menu-*` | exactly the four joint rules; negative sweep over `.hud-panel`, `.upgrades-panel`, `.activity-feed`, `.leaderboard`, `.connection-banner`, `.phase-announcement`, `.auth-menu`, `.auth-panel`, `.game-runtime-status`, `.game-runtime-error` is empty |
| AC-14 | `.customization-panel[data-reveal-active='true']` | body stays `z-index: 20` + `reveal-spotlight …`; no reveal-state selector rule carries a `menu-*` beat |
| AC-15 | `.customization-tabpanel`, `@keyframes tab-panel-in` | `animation: tab-panel-in var(--motion-tab-switch-ms) ease-out both`; the two pinned stops |
| AC-16 | all `@keyframes` names, source | no `-out`/`-exit`/`-close`/`-leave` keyframe, no `animation-direction`, no `animation-fill-mode` |
| AC-17 | OS block | exact 46-selector list, one `@media (prefers-reduced-motion: reduce)` block, body `animation: none; transition: none` |
| AC-17 | session block | exact 20-selector list, one top-level `main[data-reduced-motion='true']` rule, body `animation: none; transition: none` |
| AC-17 | 12 animated selectors | each producing rule is earlier in the file than the media block; both off-switch lists contain an equal-or-higher-specificity selector (pinned specificity: `:not(...)` 0,2,0 · title 0,3,0 · tabpanel 0,1,0 · session scoped 0,3,1); negative controls prove a bare `.customization-panel` (0,1,0) and a bare `.user-panel .users-list` (0,2,0) would **not** suffice |
| AC-20 | `.user-panel > .users-badge`, `:hover`, `.users-count` | exact glass body, exact two-declaration hover, gradient + `#ffffff` count; `var(--users-badge-top|bottom)` referenced exactly once each |
| AC-18 | stylesheet hygiene | no `will-change`, no `!important`, no new `transform`/`filter`/`clip-path` in the boot rules; the reveal `transform: translate(-50%, -50%)` and the z-index table are unchanged |

Computed-style / DOM integration evidence (both real stylesheets in jsdom):

- Normal panel `<section class="customization-panel" data-reveal-active="false">` matches the boot
  root selector, the reveal panel (`data-reveal-active="true"`) does **not**; the crew list
  matches `.user-panel .users-list` while `.hud-panel` does not.
- `.customization-title` in the normal panel and `.users-list-title` in the crew list both match
  their `menu-chroma` selector.
- Session markup: the normal panel matches exactly
  `main[data-reduced-motion='true'] > section` + `… .customization-panel:not([data-reveal-active='true'])`,
  the reveal panel matches exactly the reveal selector, the crew list and its title match only
  their scoped selectors, and a tab button matches `… > section button` + `… .customization-tab`.
- Crew pill: `min-height: 44px`, `border-radius: 999px`, `padding: 8px 16px`; count badge
  `min-width`/`height: 22.4px`, `font-size: 11.52px`, `font-weight: 800`,
  `color: rgb(255, 255, 255)`.
- CSSOM: the five `@keyframes` rules, the joint boot rule, the exact session selector list and
  exactly one `@media (prefers-reduced-motion: reduce)` block survive the real parser.

### Forced assertion rewrites (replacement assertions — never deletions)

- `.user-panel > .users-badge` + `:hover` exact bodies (AC-20): warm-red gradient/warm rim →
  glass pill, two-declaration hover.
- `.users-count` exact body (AC-20): `--gf-void`/`--gf-rim-strong` → `--users-badge-*` gradient
  and `#ffffff`.
- OS reduced-motion grouped selector list (AC-17): 36 → 46 selectors (adds the scoped boot, tab
  and crew selectors and the reveal state).
- Session reduced-motion grouped selector list (AC-17): 9 → 20 selectors.
- Session-cascade integration markup (AC-17): extended with the normal panel, the tab strip, the
  tabpanel and the crew list/title, plus the exact matching-parts assertions.
- New guards added: the five keyframe bodies, the geometry/banned-property sweeps, the boot rule
  bodies, the animated-surface positive/negative sweep, the no-exit sweep, the single-block
  sweep, the specificity/order guard, the token-consumption guard and the crew-pill computed
  metrics.
- No 4a or earlier assertion was weakened, and `app.css`/`app.css.test.ts` are untouched.

### Acceptance audit — full T4 (4a + 4b)

- **AC-7 — met.** Sticky `.customization-tabs`, no `overflow`/height on `.customization-tabpanel`,
  preview `min(12rem, 26vh)` with the single `8rem` `@media (max-height: 760px)` override declared
  after it, `app.css` keeps `max-height: 60vh`/`overflow-y: auto`/the accepted width, no nested
  scroll box, no `!important`, no `app.css` edit (4a evidence; manual `scrollHeight`/`clientHeight`
  rows are T5's).
- **AC-9 — met.** Exact 17-declaration chip body (44 px, 0.25/0.4 padding, 0.25 gap, 0.68rem,
  0.06em, uppercase, `nowrap`), exact `:hover`, `aria-selected` inset underline, 2 px focus ring,
  badge metrics, `minmax(5rem, 1fr)` with the 320 px arithmetic (15.5rem of 16rem), no literal
  colour in any `.customization-tab*` rule, computed 44 px/nowrap (4a evidence).
- **AC-11 — met.** `main` declares the four pinned mirrors (21 mappings) and every
  `--motion-*`↔`MOTION` pair is asserted; `:root` still declares none (4a evidence; `motion.test.ts`
  half shipped in T1).
- **AC-12 — met.** The four boot rule sets + all four keyframed beats with every pinned stop; no
  `transform`/`filter`/`backdrop-filter`/`clip-path`/`margin`/`left`; the only geometry is
  `menu-rail` `height` and `menu-scan` `right` on the two existing pseudo-elements.
- **AC-13 — met.** The crew root/`::before`/`::after`/title carry the same four beats;
  `UserPanel.test.tsx` proves mount on open, immediate unmount on close, a fresh element on
  re-open and `vi.getTimerCount() === 0` throughout.
- **AC-14 — met.** Exactly the two user-opened menus reference `menu-*`; the ten other shell
  surfaces reference none; the reveal state keeps only `reveal-spotlight`.
- **AC-15 — met.** `.customization-tabpanel` declares `tab-panel-in var(--motion-tab-switch-ms)
  ease-out both` and the keyframe has exactly the two pinned stops; the keyed remount / no-timer /
  focus behaviour is T3's `SpaceshipCustomizationPanel.test.tsx` half (green).
- **AC-16 — met.** No exit keyframe, no `animation-direction`, no `animation-fill-mode`; every
  beat settles at the accepted resting values; the crew cycle unmounts synchronously with no
  timer, and the panel suite's zero-timer/no-closing-state assertions pass unchanged.
- **AC-17 — met.** Exactly one OS block and one extended session block; each carries every pinned
  scoped selector with `animation: none; transition: none`; every animation rule precedes the media
  block; the specificity guard passes for all 12 animated selectors; the scoped
  `.customization-panel[data-reveal-active='true']` selector closes the pre-existing OS
  `reveal-spotlight` gap; `App.tsx` untouched (read-only, T5 gate).
- **AC-18 — met.** No new rule on the panel/crew list/pseudo-elements/titles declares `transform`,
  `filter`, `backdrop-filter`, `will-change` or `clip-path`; the z-index table, the reveal
  `translate(-50%, -50%)` and the accepted placements are unchanged; every beat ends at the
  settled values so no animation runs after it (manual paint check is T5's).
- **AC-19 — met (4a).** New grouped `scrollbar-width`/`scrollbar-color` rule plus exactly four
  `::-webkit-scrollbar*` rules with the pinned 6 px/thumb values; no existing surface body changed.
- **AC-20 — met.** Glass pill body (`--gf-rim`, `--gf-surface-raised`, `--gf-text`, 999 px,
  44 px), exact two-declaration hover, `.users-count` warm gradient + white text, both tokens
  declared and consumed, badge text/`data-count`/live dot/`aria-expanded` unchanged.
- **AC-21 — met (4a).** Compact right-aligned 24 px chevron with the pinned declarations, a
  hover/focus pair and the `▴` collapsed glyph; `app.css` keeps the expanded `▾` and the ARIA
  wiring.
- **AC-22 — met (4a).** Tab strip grid/`gap`/padding, uppercase token-only chip, ≤720 px stacked
  label/badge rule inside the existing block, three-column arithmetic, placements and safe-area
  offsets untouched.

### Deviations from spec

- None.
