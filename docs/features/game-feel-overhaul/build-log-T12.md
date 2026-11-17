# Build log — T12 — Fix desktop leaderboard/HUD overlap (manual-review fix)

Task: T12 (2026-11-17), feature `game-feel-overhaul`, branch `feat/game-feel-overhaul`
based on `dcb0573` (the squashed feature tip; see *Deviations* for the base note).

Files changed (only `files_owned`):

- `src/frontend/src/ui/game-view.css`
- `src/frontend/src/ui/game-view.css.test.ts`
- `docs/features/game-feel-overhaul/build-log-T12.md`

## Root cause

The user's 1920×1000 screenshot shows the desktop left rail (`.leaderboard`) drawn over
the bottom of the Neon Forge Pilot Status HUD (the `Toggle HUD` row). The rail's top
offset was carried over unchanged from `server-live-leaderboard` AC-23
(`top: calc(12.5rem + …)` = 200 px), while this feature's AC-19 HUD grew taller than the
old compact HUD it was measured against. Summing the pinned AC-19 anatomy below the HUD's
own `1rem` top edge (rem = 16 px):

| HUD part | Source declaration | Height |
| --- | --- | --- |
| header + level chip | `.hud-header`, `.hud-level` (`0.8rem`, `0.15rem` padding, 1 px rim) | 1.545 rem |
| resource strip | `.hud-resources` `0.15rem` margin + `[data-resource]` chip | 2.145 rem |
| stat grid | `.hud-panel .hud-grid` `0.15rem` margin + 3 rows + 2 `0.2rem` gaps | 4.540 rem |
| minimize control | `main > section button` `1.5rem` min target | 1.580 rem |
| flex gaps | `main > section` `gap: 0.25rem` × 3 | 0.750 rem |
| block padding | `main > section` `padding: 0.75rem 1rem` | 1.500 rem |
| rim | shared frame `border: 1px` × 2 | 0.125 rem |
| **content footprint** |  | **12.185 rem** |

HUD bottom edge ≈ `1rem + 12.185rem = 13.185rem` ≈ **211 px**; the rail started at
**200 px**, so the rail overlapped the HUD by ≈11 px at every desktop width (coordinates
are viewport-relative and do not depend on the viewport size, which is why 1920×1000 shows
it). `main > section` keeps `line-height: 1.4`, so the overlap grows if the resource strip
wraps or a value adds a line.

## What changed

Old desktop placement (`src/frontend/src/ui/game-view.css`, `.leaderboard`):

```css
.leaderboard {
  position: absolute;
  top: calc(12.5rem + env(safe-area-inset-top, 0px));
  left: calc(1rem + env(safe-area-inset-left, 0px));
  …
}
```

New desktop placement:

```css
.leaderboard {
  position: absolute;
  top: calc(16rem + env(safe-area-inset-top, 0px));
  left: calc(1rem + env(safe-area-inset-left, 0px));
  …
}
```

16 rem = 256 px leaves ≈ **45 px (2.8 rem)** of clearance below the 211 px HUD, which is
more than one wrapped resource line (≈34 px), so the rail still clears the HUD in the worst
case. Nothing else in the rule moved: `left`, `width`, `max-height`, `padding`, `overflow`,
`pointer-events` and the whole z-index block are unchanged; the HUD, the panel order, the
720 px mobile band (rail `top: 17rem`), the short-viewport cap and both reduced-motion
blocks are untouched. A source comment above `.leaderboard` records the arithmetic, and the
file header now names the rail offset as the one deliberate placement change.

Test pin (`src/frontend/src/ui/game-view.css.test.ts`):

- The existing exact `.leaderboard` declaration list now pins
  `top: calc(16rem + env(safe-area-inset-top, 0px))`.
- A new regression test, `clears the Neon Forge HUD on the desktop left rail (T12
  manual-review regression)`, re-reads the exact top declaration, extracts the `rem`
  constant (16), and asserts `railTop >= HUD_TOP (1rem) + HUD_FOOTPRINT (12.5rem,
  the rounded-up AC-19 anatomy above) + MIN_CLEARANCE (1rem)`; it also asserts the HUD's
  accepted `main > section` top offset (`1rem`) is unchanged, so the test fails if the fix
  regresses to the old 12.5 rem rail or moves the HUD. No banned matchers are used.

## Viewport checks

No browser/GUI tooling exists in this build environment (same limitation recorded in
`build-log-T11.md`), so the matrix below is computed from the pinned declarations (rem =
16 px, `line-height: 1.4` inherited from `main > section`). The rail's content height is
≈219 px (title + 5 two-line rows + totals + `0.5rem` padding + 1 px rim), capped by
`max-height: 40vh`. The HUD bottom is 211 px at every width because the desktop HUD does
not wrap at these widths (its max-content width ≈406 px, available ≈ viewport − 16 px).

| Viewport | HUD (top…bottom) | Rail (top…bottom) | Clearance | Toggle top | Verdict |
| --- | --- | --- | --- | --- | --- |
| 1920×1000 (user screenshot) | 16…211 | 256…475 | 45 px | 940 | clear |
| 1920×1080 | 16…211 | 256…475 | 45 px | 1020 | clear |
| 1280×720 | 16…211 | 256…475 (40vh cap 288) | 45 px | 660 | clear; 185 px above the toggle |
| 768×1024 | 16…211 | 256…475 (40vh cap 410) | 45 px | 964 | clear; four corners separated |

Horizontal checks: rail right edge = 288 px; upgrades panel left edge = 912 px at 1280 px
and 400 px at 768 px; the rail never overlaps the bottom-right panel at any checked width.
`max-width: 720px` is unchanged: feed band `10rem + 6rem = 16rem`, rail `top: 17rem`
(mobile HUD bottom ≈194 px), short-viewport rule caps the rail at `12vh`.
The manual visual re-confirmation on the user's GUI host is still the orchestrator's step.

## Decisions

- **Move the rail, not the HUD.** The brief and AC-19/AC-30 keep the HUD's accepted
  top-left placement and the accepted panel order; only the rail's top offset changed.
- **16 rem, not 13.5 rem.** The minimum clear value is ≈14.2 rem (13.185 rem + 1 rem
  breathing room); 16 rem also absorbs one wrapped resource line and sits well above the
  bottom-left toggle on 1280×720, so it fixes the defect without a second CSS rule.
- **No `app.css` / component change.** The offset is owned by `game-view.css`; the base
  placements in `app.css` are untouched, so no out-of-scope conflict arose.
- **No new token.** A one-off rail offset is not a motion token; adding a `--gf-*` variable
  would widen the AC-17 palette contract for a single consumer.

## Evidence

All commands run from the repository root on `feat/game-feel-overhaul` (HEAD `dcb0573`
before the fix commit).

### `npm run lint`

```text

> lint
> eslint .

```

exit code `0` — no findings.

### `npm run typecheck`

```text

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

```

exit code `0` — both workspaces clean.

### `npm test --workspace @cubeclicker/frontend`

```text
 ✓ src/App.test.tsx (61 tests) 1747ms
   ✓ App > toggles the HUD minimized state from the welcomed branch (AC-6, AC-19)  357ms

 Test Files  78 passed (78)
      Tests  2433 passed (2433)
   Start at  11:20:35
   Duration  6.78s (transform 14.59s, setup 0ms, collect 42.54s, tests 24.31s, environment 23.55s, prepare 13.86s)
```

(2433 = the 2432 pre-existing frontend tests + the 1 new T12 regression test. The
`HTMLCanvasElement getContext` / `THREE.WebGLRenderer` stderr lines are the pre-existing
jsdom WebGL fallbacks, not failures.)

Focused file before the full run:

```text
 ✓ src/ui/game-view.css.test.ts (72 tests) 197ms

 Test Files  1 passed (1)
      Tests  72 passed (72)
```

### `npm run coverage --workspace @cubeclicker/frontend`

```text
 Test Files  78 passed (78)
      Tests  2433 passed (2433)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.84 |    96.53 |   98.04 |   96.84 |
```

(Per-file rows elided; the quoted summary row is trimmed of its trailing padding spaces.)

exit code `0` — thresholds ≥80 statements/branches/functions/lines met (96.84 / 96.53 /
98.04 / 96.84), no exclusion or threshold change.

### `git diff --check`

```text
```

exit code `0` — no whitespace errors.

## Acceptance audit

- **AC-27 — ambience and layering (non-modal).** *Met.* No layer changed: `.leaderboard`
  stays in the pinned `z-index: 3` surface group, the reveal stays 20, the toggle 21, the
  level banner 5 and auth 100; there is still no scrim and no `main[data-reveal-active]`.
  The unchanged assertions in `game-view.css.test.ts` (`puts the canvas at 0, the ambience
  at 2 and every panel at 3`, `keeps level 5, reveal 20, toggle 21 and auth 100`,
  `adds no scrim and no data-reveal-active on main`) are green in the 72-test run above.
- **AC-30 — responsive fit.** *Met.* Desktop: rail top 16 rem clears the 13.185 rem HUD
  bottom at 1280×720, 1920×1080 and 768×1024 (table above; the four corners at 768×1024 are
  HUD 16…211 top-left, users panel top-right, upgrades panel bottom-right, toggle
  964…1008 bottom-left); the `max-width: 720px` block still moves the rail to `17rem`
  below the `10rem + 6rem` feed band, `main[data-customization-open='true']
  .upgrades-panel` stays `display: none`, and the short-viewport `12vh` cap is unchanged —
  all still pinned exactly by the `mobile bands (AC-30)` tests. Panel order unchanged.
- **AC-31 — accessibility, single live region and contrast.** *Met.* No interactive
  control was added or moved; the rail keeps `pointer-events: none`, all decorative
  dots/medals/bars stay `aria-hidden` (markup untouched), `.phase-announcement` stays the
  shell's only polite region and both reduced-motion blocks are byte-identical. Only a
  presentational `top` offset changed; the contrast tokens and focus rings are untouched.

## Deviations from spec / open items

1. **Branch base.** The brief named `feat/game-feel-overhaul` at `af97f5a`; the branch had
   already been squashed into `main` as `dcb0573`/`5ef561e`, and `af97f5a` is not an
   ancestor of `main`. `git diff --stat af97f5a dcb0573 -- src tests compose.yaml README.md`
   is empty (only `docs/features/game-feel-overhaul/status.md` and
   `docs/product/glossary.md` differ), so the work was branched from `dcb0573`, which also
   preserves the orchestrator's uncommitted T12 `tasks.md`/`status.md` edits. No code
   difference.
2. **Computed viewport evidence.** The environment has no browser tooling, so the
   viewport matrix is derived from the pinned declarations rather than measured pixels; the
   manual visual re-check of 1920×1000 / 1280×720 / 1920×1080 / 768×1024 remains a GUI-host
   step, as recorded for T11.
3. **Test tiers.** The change is a CSS-only placement offset with no runtime module or
   component boundary, so there is no unit/integration split to add: the stylesheet-contract
   suite (parsed rules) and the existing jsdom cascade integration test in the same file are
   the applicable tiers, and the new regression test is concrete (exact declaration +
   numeric clearance), not a wildcard or snapshot.
4. No `app.css`, HUD, leaderboard or `App` change was needed; `files_owned` was respected.
5. **Residual short-desktop observation (out of AC scope, not changed).** The rail now
   starts 56 px lower, so on *desktop-width* viewports shorter than ≈590 px (for example a
   844×390 landscape phone, which is above the 720 px breakpoint) the rail's capped content
   can approach the bottom-left customization toggle. At the old 12.5 rem offset the rail
   already met the toggle there (200…356 px, capped at 40vh, against a toggle top of
   330 px), so this is a pre-existing short-landscape limitation, not a new defect class;
   the accepted matrix (1280×720, 1920×1080, 768×1024) is clear and AC-30 does not specify
   desktop-landscape phones. A follow-up could cap the rail with
   `max-height: min(40vh, calc(100vh - 20rem))` if the product wants that case covered.
