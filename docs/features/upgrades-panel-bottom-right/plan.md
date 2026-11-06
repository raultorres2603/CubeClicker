---
feature: upgrades-panel-bottom-right
revision: 1
---
# Plan — Upgrades Panel Bottom Right

## Architecture

Two-file production change:

1. `src/frontend/src/ui/UpgradesPanel.tsx` — add `className="upgrades-panel"` to the root `<section>` (between `aria-label="Upgrades"` and `data-mode={mode}`, matching the `customization-panel` attribute order). No other markup/state change; the panel stays a direct child of `<main>` so it keeps the `main > section` metallic frame styling.
2. `src/frontend/src/ui/app.css` — append a new `.upgrades-panel` rule with absolute bottom-right positioning using safe-area insets. No merge needed (no pre-existing `.upgrades-panel` rule); the rule is appended at the end of the stylesheet.

Because `.upgrades-panel` is a `<section>` direct child of `<main>`, it keeps the `main > section` metallic frame styling (border/background/pseudo-elements); only `position`/`top`/`bottom`/`left`/`right` are overridden. The class selector (specificity 0,1,0) beats `main > section` (0,0,2), so the override is reliable without `!important`.

## Interfaces / contracts

CSS change (new rule, appended at the end of the stylesheet):

```css
/* Upgrades panel placement (bottom-right). */
.upgrades-panel {
  position: absolute;
  top: auto;
  bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  left: auto;
  right: calc(1rem + env(safe-area-inset-right, 0px));
}
```

UpgradesPanel.tsx hook:

```tsx
<section
  aria-label="Upgrades"
  className="upgrades-panel"
  data-mode={mode}
>
```

CSS-guard selection: `.upgrades-panel` has a single rule, so the standard first-match `css.match(/\.upgrades-panel\s*\{([\s\S]*?)\}/)` selects the positioning declarations deterministically.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/ui/UpgradesPanel.tsx` | Edit | Add `upgrades-panel` class to the root section. |
| `src/frontend/src/ui/app.css` | Edit | Add `.upgrades-panel` bottom-right positioning rule. |
| `src/frontend/src/ui/UpgradesPanel.test.tsx` | Edit | Update expected section markup to include the class. |
| `src/frontend/src/App.test.tsx` | Edit | Update inlined upgrades section markup to include the class. |
| `src/frontend/src/ui/app.css.test.ts` | Edit | Add CSS-guard assertions for the positioning rule. |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | Class hook on the panel section instead of a wrapper | Preserves `main > section` metallic frame styling (a wrapper would detach the section from the shared selector list and strip the frame). Mirrors `customization-panel` ownership. | Wrapper dock at bottom-right (rejected: frame styling loss + larger diff). |
| 2 | Override via class selector specificity | Avoids `!important` and keeps the rule readable; class (0,1,0) beats `main > section` (0,0,2). | `!important` (rejected: harder to override later). |
| 3 | `1rem` bottom/right insets | Mirrors the existing safe-area convention used by `main > section` and `.user-panel`. | Larger offsets (rejected: unnecessary; tunable per Q-2). |

## Risks & mitigations

- **Test markup drift:** `App.test.tsx` inlines the upgrades section markup; the class must be inserted in the same attribute order (`aria-label`, `class`, `data-mode`) to keep the golden string exact. Mitigation: update it in the same task; builder verifies.
- **Frame styling regression:** if `.upgrades-panel` ceases to be a direct child of `<main>`, frame styling disappears. Mitigation: keep markup as-is; only add a class to the existing section.
- **Overlap on narrow viewports:** a wide panel could overlap the phase announcement; flagged as Q-3.

## Open questions

- Q-1, Q-2, Q-3 from the spec.