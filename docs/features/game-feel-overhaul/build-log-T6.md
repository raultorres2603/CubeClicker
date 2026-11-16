# Build log — T6 — Neon Forge tokens, shared frame, auth/shell CSS

Task: T6 (2026-11-16), feature `game-feel-overhaul`, branch `feat/game-feel-overhaul` off
`763bf3e` (`feat: integrate the 3D lootbox reveal into the customization panel`).

Files changed (only `files_owned`):

- `src/frontend/src/ui/app.css`
- `src/frontend/src/ui/app.css.test.ts`
- `src/frontend/src/ui/theme.ts`
- `src/frontend/src/ui/theme.test.ts`
- `docs/features/game-feel-overhaul/build-log-T6.md`

## What changed & why

1. Replaced the retired `--frame-*` metal tokens/rules with the additive `--gf-*` Neon
   Forge palette (spec AC-17), keeping the accepted `--hud-*`/`--accent` tokens and every
   `--panel-*` value in `game-view.css` untouched.
2. Added the one grouped chamfered graphite-glass frame (AC-18): exact 11-selector list
   ending in `main > section`, 1 px cyan rim, chamfer `clip-path`, grid+gradient surface,
   inset highlight + **inset-only** depth/glow, 14 px blur; deliberately **no `position`**,
   no `filter` and no outer `box-shadow` (clip-path-safe).
3. Added the separate `.auth-panel, .auth-error, .user-panel .users-list { position:
   relative; }` containing-block rule, the exact top-edge `::before`, the exact left-rail
   `::after`, the auth chamfer/radius retargets, the compact banner/phase chamfer and the
   `.phase-announcement:empty` chrome reset.
4. Restyled auth (AC-26), the amber `.gf-cta` and secondary glass controls (AC-28), and
   added the whole AC-29 typography block in `app.css`; the existing 480 px block,
   24 px HUD minimize target, placements and reduced-motion contract are retained.
5. Added the `GF_*` TypeScript mirrors (AC-17) and the AC-31 WCAG contrast gates; rewrote
   `app.css.test.ts` to pin the new exact declarations and added a jsdom integration test
   that mounts real auth/connection markup with the shipped stylesheet and reads computed
   styles.

## Decisions

- **Inset-only depth.** `clip-path` clips an element's own outer shadow/filter, so the
  shared rule uses only `inset` shadow layers and declares no `filter`. `app.css.test.ts`
  splits the `box-shadow` at top level and asserts all four layers are `inset`.
- **The shared rule owns no `position`.** The accepted absolute HUD/pre-welcome placement
  survives; only the three surfaces that need a containing block for their pseudo-elements
  get `position: relative` in a separate rule.
- **Auth uses the same frame.** `--gf-chamfer`/`--gf-radius-panel` are overridden on
  `.auth-panel` (1.1 rem / 1.25 rem) rather than duplicating a second frame rule.
- **No new animation in `app.css`.** The old sheen/scanline keyframes are removed; the
  remaining motion is the accepted HUD blink/minimize transition and the new 90 ms press
  transitions, all disabled under `prefers-reduced-motion: reduce`.
- **Removed the obsolete `main > section[data-minimized='true'] p` collapse rule.** Spec
  AC-19 requires it removed or rewritten to the new `.hud-grid` selector; the new rule
  `<.hud-panel[data-minimized='true'] .hud-grid { display: none; }>` belongs to T7
  (`game-view.css`), and the new markup belongs to T8 (`Hud.tsx`). No later task owns
  `app.css`, so T6 removes the stale rule now. Until T7/T8 land, the HUD minimize only
  dims; this is the sequenced handoff described in the tasks graph (T6 → T7 → T9/T10 → T8).
- **Keep auth markup tests unmodified.** `AuthMenu.test.tsx`, `AuthForms.test.tsx`,
  `VerifyEmail.test.tsx` and `VerificationPending` were not edited; only the CSS guards
  changed.

## Token evidence (AC-17)

`src/frontend/src/ui/app.css` `:root` (exact, raw):

```css
:root {
  --hud-text: #e8f6ff;
  --hud-background: rgba(6, 10, 20, 0.72);
  --accent: #7cf6ff;
  --page-background: #000000;

  /* Neon Forge palette (spec AC-17). Additive: the accepted `--panel-*` tokens stay. */
  --gf-void: #04060d;
  --gf-surface-top: rgba(10, 18, 34, 0.94);
  --gf-surface-bottom: rgba(5, 10, 20, 0.9);
  --gf-surface-raised: rgba(18, 30, 52, 0.94);
  --gf-rim: rgba(124, 246, 255, 0.56);
  --gf-rim-strong: #7cf6ff;
  --gf-rim-warm: #ffb35c;
  --gf-text: #e8f6ff;
  --gf-text-muted: rgba(232, 246, 255, 0.76);
  --gf-gold: #ffcc66;
  --gf-amber: #ffb35c;
  --gf-amber-deep: #ff7a1a;
  --gf-success: #34d399;
  --gf-danger: #ff6b6b;
  --gf-rare: #60a5fa;
  --gf-epic: #c084fc;
  --gf-grid: rgba(124, 246, 255, 0.05);
  --gf-scanline: rgba(124, 246, 255, 0.06);
  --gf-shadow: rgba(0, 0, 0, 0.55);
  --gf-panel-glow: rgba(124, 246, 255, 0.2);
  --gf-radius-panel: 1rem;
  --gf-radius-control: 0.6rem;
  --gf-chamfer: 0.65rem;
  --gf-chamfer-auth: 1.1rem;
  --gf-focus: #7cf6ff;
  --gf-cta-text: #1a1206;

  color-scheme: dark;
}
```

`grep -c -- '--gf-' src/frontend/src/ui/app.css` → `106` (26 declarations + 80
references). `grep -n -- '--frame-' src/frontend/src/ui/app.css` → no matches.
`grep -n 'border-image\|frame-sheen\|hud-scanline' src/frontend/src/ui/app.css` → no
matches.

`theme.ts` exports the 11 required mirrors; `GF_TEXT` is literally `HUD_TEXT` and the
rarity channels come from `REVEAL_RARITY_HEX`:

```ts
export const GF_TEXT = HUD_TEXT;
export const GF_RARE = REVEAL_RARITY_HEX.rare;
export const GF_EPIC = REVEAL_RARITY_HEX.epic;
```

`app.css.test.ts` pins all 26 tokens and asserts the `--gf-*` declaration count is 26;
`theme.test.ts` pins every export and asserts each mirror equals its CSS `:root` value.

## Frame evidence (AC-18)

Raw grouped rule (`app.css` line 596):

```css
.hud-panel,
.upgrades-panel,
.customization-panel,
.activity-feed,
.leaderboard,
.user-panel .users-list,
.connection-banner,
.phase-announcement,
.auth-panel,
.auth-error,
main > section {
  border: 1px solid var(--gf-rim);
  border-radius: var(--gf-radius-panel);
  clip-path: polygon(var(--gf-chamfer) 0, 100% 0, 100% calc(100% - var(--gf-chamfer)), calc(100% - var(--gf-chamfer)) 100%, 0 100%);
  background: repeating-linear-gradient(0deg, transparent 0 23px, var(--gf-grid) 23px 24px), linear-gradient(180deg, var(--gf-surface-top), var(--gf-surface-bottom));
  color: var(--gf-text);
  box-shadow: inset 0 1px 0 rgba(232, 246, 255, 0.16), inset 0 0 0 1px rgba(124, 246, 255, 0.08), inset 0 0 40px var(--gf-shadow), inset 0 0 24px var(--gf-panel-glow);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
  backdrop-filter: blur(14px) saturate(1.2);
}
```

- `app.css.test.ts` normalizes the selector list and asserts **exactly one** rule equals
  the pinned 11-selector list; it asserts the eight declarations byte-for-byte, the
  property count is 8, `position`/`filter` are absent and every `box-shadow` layer starts
  with `inset `.
- The containing-block rule is exactly
  `.auth-panel, .auth-error, .user-panel .users-list { position: relative; }` and is the
  only top-level rule whose trimmed body is exactly `position: relative;`.
- `.auth-panel` declares `--gf-chamfer: var(--gf-chamfer-auth);` and
  `--gf-radius-panel: 1.25rem;`; `.connection-banner, .phase-announcement` declares
  `--gf-chamfer: 0.45rem;`.
- `::before` selector list = the 11 selectors + `::before`; exactly 8 declarations
  (`content`, `position`, `left`, `right`, `top`, `height`, `background`,
  `pointer-events`).
- `::after` selector list = the 11 selectors + `::after`; exactly 9 declarations
  (`content`, `position`, `left`, `top`, `width`, `height`, `background`, `box-shadow`,
  `pointer-events`).
- `.phase-announcement:empty` declares exactly `padding: 0; border: none; background:
  transparent; box-shadow: none; filter: none; clip-path: none;`; both
  `.phase-announcement:empty::before` and `::after` declare exactly `content: none;`.
- The jsdom integration test mounts `<main><section>`, the connection banner, the empty
  phase announcement and the real auth form markup with the shipped `app.css` and reads
  computed styles: the HUD section is `position: absolute` with the shared clip-path, the
  connection banner stays `position: absolute` + `translateX(-50%)` with
  `--gf-chamfer: 0.45rem` (the cascade override actually wins), the auth panel is
  `position: relative` with `--gf-chamfer: var(--gf-chamfer-auth)` and
  `--gf-radius-panel: 1.25rem`, and the empty announcement computes `padding: 0px`,
  `border-top-style: none`, `box-shadow: none`, `filter: none`, `clip-path: none`.

## Auth, control and typography evidence (AC-26, AC-28, AC-29)

- Auth scrim background layers (raw): `repeating-linear-gradient(0deg, transparent 0 2px,
  var(--gf-scanline) 2px 3px)`, `radial-gradient(circle at 18% 24%, rgba(124, 246, 255,
  0.18), transparent 44%)`, `radial-gradient(circle at 82% 76%, rgba(255, 179, 92, 0.14),
  transparent 46%)`, `var(--gf-void)`; `background-origin: border-box`.
- `.auth-title` = `clamp(2rem, 6vw, 2.8rem)` / `800` / `0.18em` / uppercase; its
  `::after` is the `linear-gradient(90deg, var(--gf-rim-strong), transparent)` bar.
  jsdom computes the wordmark at `44.8px`, weight `800`, letter-spacing `8.064px`,
  uppercase.
- `.auth-button, .verification-pending button` = glass (`var(--gf-surface-raised)`, 1 px
  `var(--gf-rim)`, `var(--gf-radius-control)`) and `min-height: 48px`.
- `.auth-button-primary` = `linear-gradient(180deg, var(--gf-amber), var(--gf-amber-deep))`
  with `color: var(--gf-cta-text)` and the warm rim.
- `.auth-input, .verification-pending input` = `min-height: 44px`, `border: 1px solid
  var(--gf-rim)`, `background: rgba(0, 0, 0, 0.42)`, `box-shadow: inset 0 2px 8px
  var(--gf-shadow)`, no clip-path/border-image; focus uses `var(--gf-focus)` for the border,
  outline and inset ring.
- `.auth-error` uses the danger channel: `--gf-rim: rgba(255, 107, 107, 0.56)` and
  `color: var(--gf-danger)`.
- `.gf-cta` = amber gradient, `var(--gf-cta-text)`, 44 px minimum, `var(--gf-rim-warm)`
  rim; `:hover` brightness 1.08 + warm rim, `:active` `translateY(1px)`,
  `:focus-visible` `outline: 2px solid var(--gf-focus); outline-offset: 2px;`,
  `:disabled` `opacity: 0.5` with `box-shadow: none; filter: none;`.
- Secondary `.user-panel > button`, `.connection-banner button`, `.customization-equip`,
  `.customization-unequip` = glass surface, `var(--gf-radius-control)`, 44 px, gf-focus
  ring, `opacity: 0.5` disabled. The 24 px `main > section button` minimize target and its
  `▾` glyph are unchanged.
- AC-29 title block: `.hud-title`, `.upgrades-title`, `.activity-feed-title`,
  `.leaderboard-title`, `.customization-title`, `.users-list-title` = `0.72rem` / `800` /
  `0.18em` / uppercase; `.hud-level` = `0.8rem` / `800` / `0.1em` / uppercase;
  `.hud-resource-value` = `1.05rem` / `700` / `0.02em` + tabular numerals; button roles
  `.gf-cta`, `.upgrade-buy`, `.customization-equip`, `.customization-unequip`,
  `.users-badge`, `.connection-banner button` = `0.9rem` / `700` / `0.08em` / uppercase.
  The body font stack is unchanged.

## Contrast proof (AC-31)

`theme.test.ts` composites each translucent surface over black **and** white and asserts
these exact rounded ratios (all gates ≥ 4.5 text / ≥ 3.0 non-text):

| Token | top/black | top/white | bottom/black | bottom/white |
| --- | --- | --- | --- | --- |
| `GF_TEXT` | 17.13 | 14.76 | 18.09 | 14.38 |
| `GF_TEXT_MUTED` | 10.07 | 9.03 | 10.43 | 8.85 |
| `GF_RARE` | 7.42 | 6.4 | 7.84 | 6.23 |
| `GF_EPIC` | 7.14 | 6.16 | 7.54 | 6.0 |
| `GF_SUCCESS` | 9.82 | 8.46 | 10.37 | 8.24 |
| `GF_DANGER` | 6.8 | 5.86 | 7.18 | 5.71 |
| composited `--gf-rim` (non-text) | 5.25 | 4.93 | 5.29 | 4.86 |
| disabled text (0.62) | 7 | 6.47 | 7.13 | 6.37 |
| input-well text | 18 | 16.92 | 18.49 | 16.73 |

`GF_CTA_TEXT` is 10.46 over `GF_AMBER` and 7.11 over `GF_AMBER_DEEP`. The accepted
`--panel-*`/`UPGRADE_GREEN`/badge contrast gates from the previous theme test remain
unchanged and green.

## Responsive, reduced motion and asset proof (AC-31, AC-33)

- Exactly one `@media (max-width: 480px)` block; it keeps the 0.75 rem auth scrim padding,
  1.15 rem auth-panel padding, 1.75 rem wordmark, 48 px auth buttons and the 0.5/0.75 rem
  HUD padding/0.85 rem HUD font size. `app.css.test.ts` pins the block count and each
  declaration.
- The `prefers-reduced-motion: reduce` block names `main > section`, the minimize button,
  the blink state, `.auth-button`, `.verification-pending button`, `.auth-input`,
  `.gf-cta`, `.user-panel > button`, `.connection-banner button`,
  `.customization-equip`/`.customization-unequip` with `transition: none; animation:
  none;`, and resets every press transform to `none`.
- The AC-33 guard reads **both** stylesheets (app + game-view) and asserts no `url(http`,
  `@font-face`, `data:image`, `@import` or `<img>`; `git diff --exit-code HEAD --`
  `package.json package-lock.json src/frontend/package.json src/backend/package.json` and
  the corresponding `git status --porcelain` are clean.
- jsdom computed-style proof for the 44 px contracts: connection `Retry` 44×44, auth input
  44 px, auth button 48 px, CTA 44 px, all with `var(--gf-radius-control)`.

## Cascade handoff notes (not deviations)

- `game-view.css` is intentionally untouched (T7 owns it). Its old grouped rounded rule
  (`.hud-panel, .upgrades-panel, …`) is later in the cascade and therefore still wins on
  the gameplay panels until T7 removes it; the shared Neon Forge frame is already effective
  for the pre-welcome stats panel, the connection banner, the phase announcement, the auth
  panel and the auth error in this change.
- T7 must remove the duplicate `.activity-feed-title` / `.leaderboard-title` typography
  from `game-view.css` (and the old grouped rule/pseudo resets) so the AC-29 block in
  `app.css` is the single owner.
- T7 must add `.hud-panel[data-minimized='true'] .hud-grid { display: none; }`; T6 removed
  the obsolete `main > section[data-minimized='true'] p` collapse rule per AC-19. T8 adds
  the `.hud-grid` markup, HUD title/level/resources and the ambience element. Until those
  tasks land the HUD minimize only dims.
- The game-view-owned `.users-badge` and `.upgrade-buy` keep their accepted 44 px/focus/
  disabled behavior; their Neon Forge chrome (`.users-badge` pill radius, `.upgrade-buy`
  circular shape) is T7/T9's surface, so the final AC-28 visual audit records them there.
- T8/T11 own the single polite live region, the non-modal reveal and the browser matrix;
  this task adds no live region and no animation that needs a session-preference variant.

## Raw verify output

```text
$ npm run lint

> lint
> eslint .

LINT_EXIT=0
```

```text
$ npm run typecheck

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

```text
$ npm test --workspace @cubeclicker/frontend

> test
> vitest run


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 Test Files  77 passed (77)
      Tests  2350 passed (2350)
   Start at  16:55:01
   Duration  3.57s (transform 8.17s, setup 0ms, collect 23.46s, tests 12.62s, environment 9.41s, prepare 6.52s)

TEST_EXIT=0
```

```text
$ npm run coverage --workspace @cubeclicker/frontend

> coverage
> vitest run --coverage


 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 Test Files  77 passed (77)
      Tests  2350 passed (2350)
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   96.74 |    96.44 |   97.86 |   96.74 |
 src/ui            |   97.15 |    95.11 |    95.78 |   97.15 |
  theme.ts         |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
COVERAGE_EXIT=0
```

(Table abridged to the summary and the `theme.ts` row; the full per-file table is printed
by the command and all four thresholds are the 80 % pinned in `vitest.config.ts`.)

```text
$ git diff --check
DIFF_CHECK_EXIT=0
```

```text
$ git diff --exit-code HEAD -- package.json package-lock.json src/frontend/package.json src/backend/package.json
PACKAGE_DIFF_EXIT=0
$ test -z "$(git status --porcelain -- package.json package-lock.json src/frontend/package.json src/backend/package.json)"
PACKAGE_STATUS_CLEAN_EXIT=0
```

Focused CSS tests (raw):

```text
$ npx vitest run src/ui/app.css.test.ts src/ui/theme.test.ts
 ✓ src/ui/app.css.test.ts (46 tests)
 ✓ src/ui/theme.test.ts (17 tests)
 Test Files  2 passed (2)
      Tests  63 passed (63)
```

## Acceptance audit

- **AC-17 — met.** 26 `--gf-*` tokens pinned exactly; accepted `--panel-*` values remain
  in `game-view.css` (tested) and all nine `theme.ts` constants are unchanged; the 11
  `GF_*` mirrors exist, `GF_TEXT === HUD_TEXT`, and rarity comes from
  `REVEAL_RARITY_HEX`. Evidence: `app.css.test.ts` token block, `theme.test.ts` mirror
  checks, `grep -c -- '--gf-'` = 106.
- **AC-18 — met.** One exact 11-selector grouped frame rule with the eight pinned
  declarations, no `position`/`filter`/outer shadow; the three-selector relative rule; the
  exact `::before`/`::after`; the 1.1 rem auth and 0.45 rem compact chamfer overrides; the
  full `:empty` reset with both `content: none;`; the old `--frame-*` metal/sheen/scanline
  rules removed; no importance flag. Evidence: `app.css.test.ts` AC-18 blocks, jsdom
  computed-style integration test.
- **AC-26 — met.** `--gf-void` + two radial pools + scanline scrim; shared frame with the
  1.1 rem auth chamfer; uppercase wordmark and gradient `::after` bar; amber primary with
  `--gf-cta-text`; glass secondary; inset wells with the cyan focus ring; danger error;
  auth markup/tests untouched; 48 px buttons and 44 px inputs. Evidence: `app.css.test.ts`
  auth chrome + integration tests; `AuthMenu.test.tsx`/`AuthForms.test.tsx` pass
  unmodified.
- **AC-28 — met (app.css-owned controls).** `.gf-cta` states pinned exactly; secondary
  controls are 44 px, gf-focus-ringed, disabled and `--gf-radius-control` rounded; the
  circular `.upgrade-buy` and the `.users-badge` pill are game-view-owned and preserved
  for T7/T9 (handoff above). Evidence: `app.css.test.ts` control-state + integration
  tests.
- **AC-29 — met (app.css block).** All title, HUD level/resource and button-role
  declarations exist in `app.css` and are pinned; body stack unchanged; markup/ARIA
  assertions belong to T8/T9/T10. `game-view.css`'s duplicate feed/leaderboard title
  styles are T7's removal (handoff above). Evidence: `app.css.test.ts` typography +
  integration tests.
- **AC-31 — met (CSS/contrast scope).** Exact contrast gates on both surfaces over black
  and white, CTA ink over both amber stops, rim ≥ 3.0; 44 px targets/focus rings/gf-focus;
  24 px HUD minimize retained; every new transition and press transform disabled under
  `prefers-reduced-motion`; reduced-motion `data-reduced-motion='true'` variants for the
  gameplay surfaces remain T7's; the single polite live region and non-modal reveal are
  integration-owned by T8/T11 and are not changed here. Evidence: `theme.test.ts`
  contrast table, `app.css.test.ts` AC-31/AC-28 blocks.
- **AC-33 — met.** Both stylesheets are free of `url(http`, `@font-face`, `data:image`,
  `@import` and `<img>`; package/lockfile/workspace manifests are byte-identical and
  status-clean. Evidence: `app.css.test.ts` hygiene test, package diff/status above.

## Deviations from spec

None from the pinned AC-17/AC-18/AC-26/AC-28/AC-29/AC-31/AC-33 declarations. The only
deliberate sequencing actions are the AC-19 removal of the obsolete minimized `p` rule and
the T7/T8/T9 handoffs recorded above; `game-view.css`, components and markup were not
edited.

## Verification checklist

- [x] `npm run lint` (exit 0)
- [x] `npm run typecheck` (exit 0)
- [x] `npm test --workspace @cubeclicker/frontend` (77 files / 2350 tests, exit 0)
- [x] `npm run coverage --workspace @cubeclicker/frontend` (96.74/96.44/97.86/96.74, exit 0)
- [x] `git diff --check` (exit 0)
- [x] Unit tests rewritten to exact declarations; integration test uses real markup +
  shipped stylesheet; no banned matchers, no assertions removed without a replacement.
