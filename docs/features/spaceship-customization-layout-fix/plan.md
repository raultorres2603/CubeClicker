---
feature: spaceship-customization-layout-fix
revision: 2
---

# Plan — Spaceship Customization Layout Fix

## Architecture

Two-file change:

1. `src/frontend/src/App.tsx` — add `className="customization-toggle"` to the existing "Spaceship customization" toggle `<button>` rendered when `welcomed`. No other markup/state change. The button keeps `type="button"` and `aria-expanded={customizationOpen}`. The button keeps its intrinsic width (see Q-4).
2. `src/frontend/src/ui/app.css` —
   - `.customization-panel` (existing block): **merge** the bottom-left positioning declarations into the existing block so there is exactly one `.customization-panel { … }` rule (no second block). This keeps the CSS guard deterministic (first-match selection).
   - `.customization-toggle` (new rule): append a new rule at the end of the stylesheet with absolute bottom-left positioning (bottom/left safe-area insets), keeping the button tappable.

Because `.customization-panel` is a `<section>` direct child of `<main>`, it keeps the `main > section` metallic frame styling (border/background/pseudo-elements); only `position`/`top`/`bottom`/`left`/`right` are overridden. The class selector (specificity 0,1,0) beats `main > section` (0,0,2), so the override is reliable without `!important`.

## Interfaces / contracts

CSS changes:

1. Merge into the existing `.customization-panel` block (do NOT append a second block):

```css
.customization-panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  max-width: min(22rem, calc(100vw - 2rem));
  position: absolute;
  top: auto;
  bottom: calc(4rem + env(safe-area-inset-bottom, 0px));
  left: calc(1rem + env(safe-area-inset-left, 0px));
  right: auto;
}
```

2. Append a new `.customization-toggle` rule at the end of the stylesheet (after the existing `.spaceship-preview` rule):

```css
/* Spaceship customization placement (bottom-left). */
.customization-toggle {
  position: absolute;
  bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  left: calc(1rem + env(safe-area-inset-left, 0px));
}
```

CSS-guard selection (F2): positioning is merged into the single existing `.customization-panel` rule, so the standard first-match `css.match(/\\.customization-panel\\s*\\{([\\s\\S]*?)\\}/)` deterministically selects the positioning declarations. A global-match + find-the-block-containing-`position: absolute` strategy is an equivalent acceptable alternative. `.customization-toggle` is a new selector with a single rule, so first-match applies.

App.tsx hook:

```tsx
<button
  type="button"
  className="customization-toggle"
  aria-expanded={customizationOpen}
  onClick={() => setCustomizationOpen((value) => !value)}
>
  Spaceship customization
</button>
```

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/App.tsx` | Edit | Add `customization-toggle` class to the toggle button. |
| `src/frontend/src/ui/app.css` | Edit | Merge bottom-left positioning into `.customization-panel` block; add `.customization-toggle` rule. |
| `src/frontend/src/App.test.tsx` | Edit | Update expected toggle-button markup to include the class. |
| `src/frontend/src/ui/app.css.test.ts` | Edit | Add CSS-guard assertions for the two positioning rules. |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Class hook on the button instead of a wrapper `<div>` | Preserves `main > section` metallic frame styling on `.customization-panel` (a wrapper would detach it from the shared selector list and require re-adding frame CSS, risking the metallic-hud CSS guards). | Wrapper dock at bottom-left; rejected (frame styling loss + larger diff). |
| 2 | Panel bottom offset `4rem` (above toggle) | Prevents the open panel from covering its own toggle button. | `3rem` (tighter) or dynamic; constant tunable (Q-2). |
| 3 | Override via class selector specificity | Avoids `!important` and keeps the rule readable; class (0,1,0) beats `main > section` (0,0,2). | `!important` (rejected: harder to override later). |
| 4 | Merge positioning into existing `.customization-panel` block (not a second block) | Single rule → first-match CSS guard selects positioning deterministically; no duplicate-selector ambiguity (F2). | Appended second block (rejected: first-match guard would select the pre-existing display rule). |

## Risks & mitigations

- **Frame styling regression:** if `.customization-panel` ceases to be a direct child of `<main>`, frame styling disappears. Mitigation: keep markup as-is; only add a class to the sibling button.
- **Test markup drift:** `App.test.tsx` pins the exact button string. Mitigation: update it in the same task; builder verifies.
- **Vertical gap too small on large fonts:** `4rem` may not clear a tall button. Mitigation: Q-2 flags the constant as tunable; manual inspection in smoke.

## Open questions

- Q-1, Q-2, Q-3, Q-4 from the spec. (Q-4: toggle keeps intrinsic width; known limitation.)