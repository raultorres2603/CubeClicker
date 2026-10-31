---
feature: metallic-hud-frames
revision: 2
---

# Plan — Metallic HUD Frames

## Architecture

The feature is a **CSS presentation pass** over the existing shell chrome, plus source-guard tests. No TypeScript runtime code, React component, state, protocol, or container asset changes.

- **Modules touched:**
  - `src/frontend/src/ui/app.css` — new metallic frame token set in `:root`; one shared frame rule for the six panel/menu surfaces; one shared frame rule for the four control types; the existing input rule merged with the inset-well declarations; a masked frame-sheen pseudo-element (positioned inside the padding box) replacing the old border light; focus/hover/disabled state rewrites so the frame survives interaction states; alert token overrides on `.auth-error`; retained scanline, blink (filter-based), minimize/minimized, responsive and reduced-motion rules.
  - `src/frontend/src/ui/app.css.test.ts` — the stylesheet contract: new guards for tokens, ordered selector lists, frame technique, bevel tiers, state persistence, the single merged well rule, focus rings, the sheen (geometry + masks), no-rounded-chrome, the alert overrides, the disabled declarations, and the retained predecessor guards.
  - `src/frontend/src/ui/theme.test.ts` — adds the computed contrast checks for the new frame center (AC-17), the alert center / error text / input well (AC-22) and the disabled opacity composite (AC-23); the existing pinned-colour and 18.26 contrast gate stays untouched.
  - `src/frontend/src/ui/theme.ts` — **unchanged** (AC-1, AC-18).
  - Every `.tsx` file — **unchanged** (AC-18).
- **Data flow / state ownership:** unchanged. `App` still owns `hudMinimized`/`hudBlinking`; `Hud`, `UserPanel`, `AuthMenu`, `AuthForms`, `ConnectionBanner`, `VerificationPending`, `VerifyEmail` remain pure presentational components. The restyle reads no state.
- **Rendering model:** the frame is a **`border-image` metal band** on each element — `border: 2px solid transparent` plus `border-image: var(--frame-metal) 1` paints the brushed-metal gradient only in the 2px border area, while `background: var(--frame-center)` fills the center with the dark translucent gradient (no metal bleeding through the translucent center). The bevel is a `clip-path: polygon(...)` with eight vertices that cuts all four corners; the cyan glow is `filter: drop-shadow(...)`, which (unlike `box-shadow`) follows the clipped silhouette. The animated sheen is a `::before` masked to a 2px ring at the padding-box edge, i.e. immediately inside the metal band and therefore inside the parent's `overflow` clip (see § Frame sheen).

### Why this shape

- **No markup change.** The HUD's SSR test pins `expect(html).not.toContain('class=')` and exact HTML strings; adding a utility class to `Hud.tsx` (or wrappers elsewhere) would break pinned markup contracts and component tests. Existing selectors are stable and already cover every surface, so the frame is applied through selector lists (AC-3/AC-5/AC-7).
- **`border-image` + `clip-path` gives a metal band that the bevel can cut.** A plain `border` cannot carry the six-stop metal gradient; a second background layer would show through the translucent center and lighten it. `border-image` paints only the border area, so the metal band stays on the straight edges, is chamfered away at the cut corners (the silhouette supplies the bevel), and never bleeds into the dark center. A pseudo-element ring was rejected because it cannot draw the chamfer either and adds a stacking layer.
- **`filter: drop-shadow` instead of `box-shadow`.** `clip-path` clips an element's outer `box-shadow` away; `drop-shadow` is applied after clipping and follows the silhouette. Consequence: the old `box-shadow` glows and the card's depth shadow move into `filter`.
- **Inset focus rings.** `clip-path` also clips `outline`; every framed interactive element therefore adds `box-shadow: inset 0 0 0 2px var(--accent)` while keeping its existing `outline` for non-clipped fallbacks (AC-8).
- **The sheen lives inside the padding box.** `main > section` keeps `overflow: hidden` (retained predecessor assertion), and overflow clips at the padding edge. A pseudo-element at `inset: -2px` would therefore paint its 2px band in the border area — outside the clip — and be invisible on the HUD, while the source guard would still pass. AC-9 pins `inset: 0` instead: the pseudo-element's border box coincides with the parent's padding box, so its masked 2px ring sits just inside the metal band and is never clipped (review F1).

## Interfaces / contracts

No TypeScript interface changes. The CSS contract (source-guarded) is:

### Token layer (`:root`)

```css
:root {
  /* existing, unchanged */
  --hud-text: #e8f6ff;
  --hud-background: rgba(6, 10, 20, 0.72);
  --accent: #7cf6ff;
  --page-background: #000000;

  /* metallic frame tokens (AC-2) */
  --frame-metal-light: #c9d8e4;
  --frame-metal-mid: #879db0;
  --frame-metal-dark: #3f5365;
  --frame-metal-deep: #23323e;
  --frame-metal: linear-gradient(
    145deg,
    var(--frame-metal-light) 0%,
    var(--frame-metal-mid) 24%,
    var(--frame-metal-light) 42%,
    var(--frame-metal-dark) 68%,
    var(--frame-metal-mid) 86%,
    var(--frame-metal-deep) 100%
  );
  --frame-glow: rgba(124, 246, 255, 0.4);
  --frame-glow-alert: rgba(255, 107, 107, 0.4);
  --frame-center-top: rgba(18, 26, 36, 0.9);
  --frame-center-bottom: rgba(6, 10, 20, 0.95);
  --frame-center: linear-gradient(180deg, var(--frame-center-top), var(--frame-center-bottom));
  --frame-center-alert-start: rgba(44, 18, 22, 0.92);
  --frame-center-alert-end: rgba(20, 8, 10, 0.95);
  --frame-center-alert: linear-gradient(
    180deg,
    var(--frame-center-alert-start),
    var(--frame-center-alert-end)
  );
  color-scheme: dark;
}
```

The metal gradient is deliberately multi-stop (light → mid → light → dark → mid → deep) so the band reads as brushed/chamfered rather than a flat two-tone border.

### Shared frame rule (panels, menus, boxes — AC-3/AC-4)

```css
main > section,
.user-panel section,
.connection-banner,
.phase-announcement,
.auth-panel,
.auth-error {
  --frame-cut: 0.75rem;
  border: 2px solid transparent;
  border-image: var(--frame-metal) 1;
  border-radius: 0;
  background: var(--frame-center);
  box-shadow: inset 0 0 0 1px rgba(201, 216, 228, 0.22);
  clip-path: polygon(
    var(--frame-cut) 0,
    calc(100% - var(--frame-cut)) 0,
    100% var(--frame-cut),
    100% calc(100% - var(--frame-cut)),
    calc(100% - var(--frame-cut)) 100%,
    var(--frame-cut) 100%,
    0 calc(100% - var(--frame-cut)),
    0 var(--frame-cut)
  );
  filter:
    drop-shadow(0 12px 28px rgba(0, 0, 0, 0.55))
    drop-shadow(0 0 10px var(--frame-glow))
    drop-shadow(0 0 24px rgba(124, 246, 255, 0.16));
}
```

Tier overrides, declared after the shared rule:

```css
.auth-panel {
  --frame-cut: 1rem;
}

.connection-banner,
.phase-announcement {
  --frame-cut: 0.5rem;
}

.auth-error {
  --frame-center: var(--frame-center-alert);
  --frame-glow: var(--frame-glow-alert);
  color: #ffb4b4;
}
```

`.auth-error` keeps its red-tinted center and red glow through custom-property overrides (AC-21); its own rule must stop declaring `background`/`border`/`border-radius`/`box-shadow` (the shared rule owns them), so only the two custom properties and the red text colour remain.

### Shared control rule (AC-5/AC-6)

```css
.user-panel > button,
.connection-banner button,
.auth-button,
.verification-pending button {
  --frame-cut: 0.375rem;
  border: 1px solid transparent;
  border-image: var(--frame-metal) 1;
  border-radius: 0;
  background: var(--frame-center);
  clip-path: polygon(
    var(--frame-cut) 0,
    calc(100% - var(--frame-cut)) 0,
    100% var(--frame-cut),
    100% calc(100% - var(--frame-cut)),
    calc(100% - var(--frame-cut)) 100%,
    var(--frame-cut) 100%,
    0 calc(100% - var(--frame-cut)),
    0 var(--frame-cut)
  );
}
```

State rules must not redeclare `background`/`background-color`/`background-image` (they would erase the metal band). Re-express emphasis with inset rings and filters:

- `.auth-button-primary` / `.verification-pending button`: `box-shadow: inset 0 0 0 1px var(--accent);`
- `.auth-button-primary:hover`: `box-shadow: inset 0 0 0 2px var(--accent); filter: brightness(1.12);`
- `.auth-button-secondary`: only `color: rgba(232, 246, 255, 0.82);` plus a hover brightening.
- `.user-panel > button:hover`, `.connection-banner button:hover`, `.auth-button:hover`: `color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); filter: brightness(1.08);`
- `.auth-button:active` keeps `transform: translateY(1px)`; `.auth-button:disabled, .verification-pending button:disabled` keeps `opacity: 0.62; cursor: progress;` (AC-23).

### Inset wells (AC-7/AC-8)

The existing `.auth-input, .verification-pending input` rule is **merged**, not duplicated (review F2): one rule with that exact selector list carries both the layout declarations and the well declarations, and AC-7's guard counts the occurrences (exactly one) before asserting.

```css
.auth-input,
.verification-pending input {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: 0.6rem 0.75rem;
  color: var(--hud-text);
  font: inherit;
  font-size: 1rem;
  letter-spacing: normal;
  text-transform: none;
  /* well (AC-7) */
  --frame-cut: 0.25rem;
  border: 1px solid var(--frame-metal-dark);
  border-radius: 0;
  background: rgba(0, 0, 0, 0.42);
  clip-path: polygon(/* same eight vertices with var(--frame-cut) */);
}

.auth-input:focus,
.verification-pending input:focus {
  border-color: var(--accent);
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  box-shadow: inset 0 0 0 2px var(--accent);
}
```

No other rule targets those two selectors exactly, so a count guard can prove the singleton.

### Frame sheen (AC-9) — replaces the border light

```css
@keyframes frame-sheen {
  from {
    background-position: -150% 0;
  }
  to {
    background-position: 250% 0;
  }
}

.user-panel section,
.auth-panel {
  position: relative;
}

main > section::before,
.user-panel section::before,
.connection-banner::before,
.phase-announcement::before,
.auth-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  padding: 2px;
  pointer-events: none;
  background: linear-gradient(115deg, transparent 30%, rgba(230, 245, 255, 0.6) 50%, transparent 70%);
  background-size: 300% 100%;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  animation: frame-sheen 3600ms linear infinite;
}
```

Geometry (review F1): the pseudo-element's containing block is the parent's **padding box**, so `inset: 0` puts its border box exactly on the padding edge and `padding: 2px` makes the XOR mask reveal only the 2px ring between that edge and its content box — a highlight sitting immediately inside the 2px metal band. `inset: -2px` would place the ring in the border area, where `main > section`'s retained `overflow: hidden` clips it away; the guard therefore asserts `inset: 0` and rejects a negative inset. Animating `background-position` (not `transform`) keeps the highlight aligned with the static mask. Both mask shorthands are declared (standard + `-webkit-`) and each composite declaration follows its own shorthand so the shorthand cannot reset it (review F5).

### Source order (cascade is the mechanism)

1. `:root` tokens.
2. Existing base/layout rules (positions, padding, sizes, typography) with the superseded `border`/`border-radius`/`background`/outer `box-shadow` declarations removed.
3. The 480px media block.
4. **New "Metallic HUD frames" section** — shared frame rule, tier overrides (including the `.auth-error` alert overrides), control rule, sheen keyframes/pseudo rule (this placement lets the grouped selectors win over earlier equal-specificity declarations). The input well is **not** repeated here: its declarations are merged into the existing `.auth-input, .verification-pending input` rule in step 2 (AC-7).
5. Minimize/minimized motion rules, scanline, blink (retained, updated).
6. `@media (prefers-reduced-motion: reduce)` **last**, extended with the new selectors (so it wins over the sheen's `animation` and any `transition`).

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/ui/app.css` | Edit | Metallic frame tokens; shared frame/control rules plus the merged input well; bevel tiers and alert overrides; sheen replacing the border light; state-rule rewrites; retained scanline/blink/minimize/minimized/responsive/reduced-motion rules |
| `src/frontend/src/ui/app.css.test.ts` | Edit | Contract guards for AC-2..AC-16; rewrite the three superseded predecessor blocks (border light, base frame tokens, border-light-retained) and keep the rest |
| `src/frontend/src/ui/theme.test.ts` | Edit | Keep the pinned-colour + 18.26 contrast test; add the `--frame-center-top` composited contrast test (AC-17) |
| `src/frontend/src/ui/theme.ts` | Unchanged | Theme constants pinned (AC-1) |
| `src/frontend/src/ui/*.tsx` | Unchanged | Markup contract gate (AC-18) |
| `compose.yaml`, `compose.smoke.yaml`, Dockerfiles, `src/backend/**` | Unchanged | Container diff gate (AC-19) |

### Edit map for `app.css`

| Selector / block | Action |
| --- | --- |
| `:root` | Add the `--frame-*` tokens; keep the four theme variables and `color-scheme` |
| `main > section` | Remove `border`, `border-radius`, `background`, the outer `box-shadow`; keep absolute positioning, padding, backdrop-filter, font, `overflow: hidden`, `pointer-events: none`. **Keep `overflow: hidden`** — AC-9's `inset: 0` sheen sits inside the padding box and is not clipped |
| `.phase-announcement` | Remove `border`, `border-radius`, `background`; keep positioning, padding, typography; the `:empty` rule must suppress the whole frame (`border-image: none; background: transparent; box-shadow: none; filter: none;`) and `.phase-announcement:empty::before` must set `content: none;` so the empty live region shows no chrome |
| `.connection-banner` | Remove `border`, `border-radius`, `background`; keep positioning, layout, typography |
| `.user-panel > button, .connection-banner button` | Remove `border`, `border-radius`, `background`; keep 44px tap target, padding, font, cursor |
| `.user-panel > button:hover, .connection-banner button:hover` | Replace `border-color` with inset accent ring + color/brightness |
| panel/banner `:focus-visible` group | Add `box-shadow: inset 0 0 0 2px var(--accent)` |
| `.user-panel section` | Remove `border`, `border-radius`, `background`; add `position: relative` |
| `.user-panel li button` | `border-radius: 0`; keep transparent fill and accent hover border |
| `.auth-panel` | Remove `border`, `border-radius`, `background`, `box-shadow`; add `position: relative` |
| `.auth-button, .verification-pending button` | Remove `border`, `border-radius`, `background`; keep size, typography, transitions |
| `.auth-button:hover`, `:active`, `:focus-visible`, `:disabled`, `-primary`, `-secondary`, and their hovers | Remove `background`/`border-color` frame-erasing declarations; re-express with inset rings + color/brightness. `:disabled` keeps `opacity: 0.62; cursor: progress;` (AC-23); `.user-panel li button:disabled` keeps `color: rgba(232, 246, 255, 0.62); cursor: default;` |
| `.auth-error` | Remove `border`, `border-radius`, `background`, `box-shadow`; keep padding/typography; add the alert center/glow overrides and `color: #ffb4b4` (AC-21) |
| `.auth-input, .verification-pending input` | **Merge** the well declarations into the existing rule — keep sizing/typography and add `--frame-cut`, the `--frame-metal-dark` border, `border-radius: 0`, the `rgba(0, 0, 0, 0.42)` fill and `clip-path`; do not add a second rule with this selector list (AC-7) |
| `.auth-input:focus, .verification-pending input:focus` | Add inset accent ring |
| `@media (max-width: 480px)` | Keep the HUD padding/font adjustment; remove `.auth-panel` `border-radius: 0.85rem` (AC-10) |
| `@keyframes border-light-travel`, `main > section::before` old body, `.user-panel::before` | Remove (superseded by the sheen) |
| `@keyframes hud-blink` | Replace the 50% `box-shadow` with `filter: drop-shadow(...)`; declare `filter` at 0%, 50% and 100% with the same three-function list so the glow interpolates smoothly instead of discretely; application/duration unchanged |
| `@media (prefers-reduced-motion: reduce)` | Extend the selector list per AC-15; keep it last |

### Guard-file mapping (`app.css.test.ts`)

- **Keep unchanged:** overlay motion block; minimize-control visibility block; minimized-state block; responsive-fit block; HUD blink block (duration/application assertions still hold).
- **Keep assertions, update extraction:** the scanline block's `does not apply hud-scanline to ::before` test and the "HUD panel frame" block's pseudo `pointer-events: none` test must extract the grouped sheen rule (a grouped selector ends with `,`, so the old `/main > section::before\s*\{/` pattern no longer matches); the asserted values stay the same.
- **Rewrite:** "animated border light" block → "frame sheen" block; the base-rule token test inside "HUD panel frame" (border/box-shadow assertions become metallic-frame assertions); "border light retained" block → "frame geometry/tier" block.
- **Add:** token block, shared frame rule (exact ordered selector list + technique), bevel tiers, control rule + state persistence, the single merged well rule + its exact-count guard, focus rings, no-rounded-chrome invariant.
- **Sheen guard specifics (F1/F5):** the sheen rule must contain `inset: 0;`, must not contain `inset: -2px`, must contain both `-webkit-mask:` and `mask:` layer declarations, and each `*-mask-composite` must appear *after* its shorthand in the rule body (compare `indexOf`/line-start positions inside the extracted rule; match the standard `mask:` at a declaration start so it is not confused with the tail of `-webkit-mask:`).
- **Alert/disabled guards (F6/F7):** `.auth-error` must declare both overrides + `color: #ffb4b4;` and none of `background`/`border`/`box-shadow`; the two `:disabled` rules must declare their opacity/cursor/colour and no `background`.
- **Contrast (F12/F7):** `theme.test.ts` gains the alert-center, `#ffb4b4`, input-well and `0.62`-alpha disabled composites with the AC-22/AC-23 thresholds.

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | CSS-only; no JSX/class/markup change | HUD's SSR test pins `not.toContain('class=')` and exact HTML; a class would break pinned contracts and require superseding several accepted markup ACs | Add a `.hud-metal` utility class to every component — rejected: markup churn, test churn, no visual benefit |
| D-2 | Frame = transparent border + `border-image: var(--frame-metal) 1` band + `background: var(--frame-center)` | `border-image` paints the metal only in the border area, so the band never bleeds through the translucent center; `clip-path` then chamfers the band at the cut corners | Two-layer background (metal shows through the translucent center and lightens it); pseudo-element ring (cannot draw the chamfer, extra stacking layer) |
| D-3 | Bevel = 8-point `clip-path: polygon(...)` with `--frame-cut` per tier | One shared geometry, three sizes; greppable and testable | `corner-shape` (not broadly supported); rotated pseudo-elements (fragile) |
| D-4 | Cyan glow = `filter: drop-shadow(...)` | `clip-path` clips outer `box-shadow`; `drop-shadow` follows the silhouette and also supplies the card depth shadow | Keep `box-shadow` — rejected: invisible outside the clip |
| D-5 | One ordered selector list per tier instead of per-component rules | Guarantees every surface is framed by the same declarations and lets a guard prove completeness | Per-component blocks — rejected: drift-prone and untestable as a set |
| D-6 | Retire the conic border light; add a masked frame sheen | A rectangular ring cannot follow an eight-point bevel and duplicates the metal edge; the sheen keeps the "alive" quality on the band | Keep the ring (visually broken at corners); static chrome (less lively, allowed by Q-3) |
| D-7 | Inset `box-shadow` focus rings on framed controls | `clip-path` clips `outline`; inset rings stay visible | Remove `outline` only — rejected: invisible focus = WCAG failure |
| D-8 | Blink keyframes animate `filter`, not `box-shadow` | Same clipping reason; keeps the accepted 200ms blink behaviour | Leave `box-shadow` — rejected: blink would be invisible |
| D-9 | Error box keeps red center/glow via token overrides | Preserves error semantics inside the unified metal frame | Uniform cyan (weaker error cue); separate non-metal error box (inconsistent) |
| D-10 | No backend/container/doc change | Pure frontend presentation | None needed |
| D-11 | Sheen ring at the padding edge (`inset: 0`), not over the border area | `main > section` retains `overflow: hidden`, which clips at the padding edge; a `inset: -2px` band would be invisible on the primary surface (review F1). The ring reads as a highlight just inside the metal band | Supersede `overflow: hidden` and rely on `clip-path` — viable but drops an accepted predecessor assertion and lets panel content paint into the border area |
| D-12 | Merge the well declarations into the existing input rule instead of adding a second `.auth-input, .verification-pending input` rule | Keeps AC-7's "exactly one rule with this selector list" guard literal and unambiguous; layout and well stay together, which is where the border/background already lived (review F2) | Add a separate well rule and weaken AC-7 to "a rule containing `--frame-cut: 0.25rem`" — works, but the singleton count is a stronger contract |

## Risks & mitigations

- **Incomplete coverage of "all menus and boxes"** → the shared selector list is exhaustive for today's shell and pinned by a guard; new UI added later must join the list. Q-2 records the deliberate exclusions.
- **The sheen is clipped away on the HUD** (review F1 — the largest visual risk) → `main > section` keeps `overflow: hidden`, so AC-9 pins `inset: 0` (ring at the padding edge, inside the clip) and the guard rejects any negative inset; the manual visual check includes the HUD sheen specifically.
- **Masking silently degrades to a full-bleed overlay** (review F5) → both `mask` and `-webkit-mask` layers are pinned with their composite declarations ordered after the shorthands; if a browser still ignores the mask the highlight stays low-opacity, and the manual visual check catches a wash across the center.
- **A state rule silently erases the frame** (higher-specificity `background`) → AC-6 enumerates the erasing rules and forbids `background` in them; AC-21/AC-23 extend that to `.auth-error` and the disabled rules.
- **`clip-path` clips focus outlines / outer shadows** → inset rings (AC-8) and `drop-shadow` (AC-3, D-4); manual visual check at review.
- **Mobile rule re-rounds the card** → AC-10 makes any non-zero `border-radius` a failure, forcing removal of the 480px `0.85rem`.
- **Sheen animation re-enabled under reduced motion** → the reduced-motion block stays last and names every sheen pseudo plus every transition-bearing control, including `.verification-pending button` (AC-15).
- **Filter containing-block side effect** → verified: no framed surface contains `position: fixed` descendants (`main > section`, `.user-panel section`, `.connection-banner`, `.phase-announcement`, `.auth-panel`, `.auth-error`).
- **Mask support** (`mask-composite`/`-webkit-mask-composite`) → same technique already ships for the border light; if unsupported, the sheen would cover the center, so keep the highlight low-opacity and verify visually. Not automated.
- **A false-green diff gate** (staged/committed edits hidden from a working-tree diff) → AC-18/AC-19 pin the comparison to a recorded `BASE` and add an empty `git status --porcelain` check; the build log names `BASE`.
- **`drop-shadow` cost on low-end devices** → one sheen pseudo and 3–4 filters per surface; Q-8 allows dropping the sheen/glow without layout changes.
- **Single large build task** (stylesheet + guards in one session) → `files_owned` cannot be split without overlapping `app.css`; if the builder reports overload, escalate to the orchestrator rather than splitting files mid-task.
- **Visual expectation mismatch** (image unavailable) → Q-1; defaults are tokenized so a re-tune is a token edit plus guard updates.

## Open questions

See `spec.md` § Open questions (Q-1..Q-9). Key items: reference geometry unknown (unreadable image), scope of "all menus and boxes", retirement of the border light, banner/error state colours, scanline retention, palette/bevel tuning.

## Documentation impact

- No `README.md`, `docs/architecture/**`, or `docs/product/**` change: no command, port, image, config, term, or architecture change.
- `docs/features/README.md` row for `metallic-hud-frames` is **orchestrator-owned**; the builder proposes the row on acceptance but does not edit the index.
- No glossary change (the visual treatment is feature-local, not a product term).

## Revision history

- r1 — 2026-10-28 — initial plan.
- r2 — 2026-10-28 — spec review r1 (F1–F12) applied to the plan: **F1** sheen geometry is `inset: 0` at the padding edge with the retained `overflow: hidden` (rendering model, why-this-shape, sheen snippet, edit map, risk, D-11); **F2** the input well is merged into the single existing rule (inset-wells section, source order, edit map, guard mapping, D-12); **F3** diff gates pinned to a recorded `BASE` plus `git status --porcelain` (guard mapping, risk); **F4** `.verification-pending button` added to reduced motion (state rules, risk); **F5** `mask`/`-webkit-mask` layers and composite ordering pinned (sheen snippet, guard mapping); **F6** `.auth-error` overrides guarded (edit map, guard mapping); **F7** disabled declarations guarded (state rules, edit map, guard mapping); **F8/F10** scope wording; **F9** supersession reference; **F11** SSR-in-node testing wording; **F12** contrast tests added to the module list and guard mapping.
