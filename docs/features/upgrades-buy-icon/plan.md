---
feature: upgrades-buy-icon
revision: 1
---

# Plan — Upgrades panel: buy icon (HUD improvement)

## Architecture

- **Component (`src/frontend/src/ui/UpgradesPanel.tsx`):** the buy `<button>` becomes icon-only. Remove the "Buy" text child; add `aria-label="Buy"` so the control keeps an accessible name. No prop, state, or affordability-logic changes; `disabled={!affordable}` and the guarded `onClick` remain identical.
- **Styling (`src/frontend/src/ui/app.css`):** add `.upgrades-panel button::before { content: '+'; }` to override the inherited `main > section button::before { content: '▾'; }` glyph. The selector is class-based, so it wins on specificity; all other inherited button styles (min size, focus ring, pointer-events on the pseudo-element) carry over.
- **Tests:** `UpgradesPanel.test.tsx` (button markup assertions), `App.test.tsx` (golden shell string), `app.css.test.ts` (CSS guard for the override). No backend, protocol, persistence, or container changes.

Data flow and state ownership are unchanged: the panel still receives `upgrades`, `coins`, `mode`, `onPurchase` and derives `affordable` the same way. The server remains authoritative for purchases.

## Interfaces / contracts

- Button markup contract (SSR): `<button type="button" aria-label="Buy" disabled=""></button>` when disabled, and `<button type="button" aria-label="Buy"></button>` when enabled. Empty children; accessible name from `aria-label`.
- CSS contract: `.upgrades-panel button::before { content: '+'; }` (glyph per Q-1 default; override of the inherited '▾').
- No TypeScript interface or prop changes.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/ui/UpgradesPanel.tsx` | Edit | Icon-only buy button with `aria-label="Buy"` |
| `src/frontend/src/ui/UpgradesPanel.test.tsx` | Edit | Button markup assertions for new form |
| `src/frontend/src/App.test.tsx` | Edit | Golden shell string button markup |
| `src/frontend/src/ui/app.css` | Edit | `.upgrades-panel button::before` icon override |
| `src/frontend/src/ui/app.css.test.ts` | Edit | CSS guard for the override |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| 1 | CSS content glyph over inline SVG/emoji | Matches the established HUD minimize-button pattern (`main > section button::before { content: '▾'; }`); keeps markup empty and SSR golden strings tractable; monochrome, inherits button color | Inline SVG (crisp, themeable, but bloats golden strings); emoji (simple, but font-dependent and colorful) |
| 2 | `aria-label="Buy"` mirroring the existing literal | Minimal change; preserves the prior accessible name exactly | `aria-label="Buy <upgrade name>"` for per-control specificity |
| 3 | Icon-only (no "Buy" text) | Compact HUD; matches the request ("instead of a buy button, add an icon") | Icon + "Buy" text |
| 4 | Class-based override selector | `.upgrades-panel button::before` is more specific than `main > section button::before`, so the glyph swaps without `!important` | `!important` on content (brittle) |

## Risks & mitigations

- Inherited '▾' glyph leaking onto upgrades buttons if the override is not specific enough → mitigation: class-based selector (decision 4); verified by CSS guard.
- SSR attribute-order mismatch in pinned golden strings → mitigation: builder runs tests and adjusts strings if the installed React version differs (assumption in spec).
- Disabled styling regression on empty buttons → mitigation: `disabled=""` attribute retained; browser default disabled treatment applies; no removal of disabled logic.
- Coverage drop from changed assertions → mitigation: replacement assertions are equally concrete; final gate runs `npm run coverage`.

## Open questions

See `spec.md` § Open questions (Q-1 icon representation, Q-2 accessible name, Q-3 text alongside icon), all default-with-notice.

## Assumptions

See `spec.md` § Assumptions. Notably: no prop/interface changes, no server or container impact, guest semantics retained.