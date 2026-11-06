---
feature: upgrades-buy-icon
revision: 1
status: draft
created: 2026-11-06
updated: 2026-11-06
---

# Spec — Upgrades panel: buy icon (HUD improvement)

## Summary

Improve the HUD by replacing the textual "Buy" label on each upgrade's buy button in the upgrades panel with an icon, keeping the existing disabled/affordability semantics and accessibility. The button element, its enable/disable logic, and its `onPurchase` wiring stay unchanged; only its visible label becomes an icon and its accessible name is preserved via `aria-label`. No catalog, cost, effect, persistence, server, or container changes are involved.

## User stories

- As a player, I want the upgrade buy control to show an icon instead of the word "Buy", so the HUD stays compact and visually consistent with the other icon-driven controls.
- As a player using assistive technology, I want the icon-only buy control to announce its purpose, so the change does not reduce accessibility.

## Acceptance criteria

Verification notes: "frontend" = `src/frontend`. Evidence per AC: a test file asserting concrete values, a command, or an observable step. All tests use concrete expected values (no banned matchers, no useless tests). Commands from `AGENTS.md`.

- **AC-1 — Icon replaces text.** In `src/frontend/src/ui/UpgradesPanel.tsx`, each buy `<button>` no longer contains the literal text "Buy". Its visible glyph is supplied by CSS (`.upgrades-panel button::before`), overriding the inherited `main > section button::before` '▾' glyph. Evidence: `UpgradesPanel.test.tsx` (button markup contains no "Buy" text) and `App.test.tsx` golden string.
- **AC-2 — Accessible name.** Each buy button carries `aria-label="Buy"` so the control has an accessible name despite having no text content. Evidence: SSR markup contains `aria-label="Buy"` on every buy button.
- **AC-3 — Affordability/disabled semantics unchanged.** A buy button is enabled iff `coins >= cost && level < maxLevel && !guestLocked`; otherwise it is `disabled`. `onClick` still calls `onPurchase(id)` only when `affordable`. No change to the `mode`/guest handling (Q-5 default "yes" retained). Evidence: `UpgradesPanel.test.tsx` (maxed, below-cost, affordable, guest cases).
- **AC-4 — Disabled form preserved.** Disabled buy buttons render the `disabled=""` attribute; enabled buttons do not. Evidence: SSR markup in `UpgradesPanel.test.tsx` and `App.test.tsx`.
- **AC-5 — Icon glyph override.** `app.css` contains a `.upgrades-panel button::before` rule with a `content:` declaration that overrides the inherited minimize glyph, so upgrades buttons do not display '▾'. Evidence: `app.css` + `app.css.test.ts` CSS guard.
- **AC-6 — No regression.** `npm run lint`, `npm run typecheck`, `npm test`, and `npm run coverage` pass in the frontend workspace with the new/changed modules included and no coverage exclusions. Evidence: final build log.
- **AC-7 — No other surface moved (production scope).** Production (non-test) changes touch only `src/frontend/src/ui/UpgradesPanel.tsx` and `src/frontend/src/ui/app.css`. The test files `UpgradesPanel.test.tsx`, `App.test.tsx`, and `app.css.test.ts` change only for expectation updates. The HUD, user panel, connection banner, phase announcement, spaceship customization panel, backend, and all container assets are unchanged. Evidence: `git diff --stat` / `git diff --name-only`.
- **AC-8 — No containerization impact.** No new service, image, port, env var, health signal, Dockerfile, or compose change. Evidence: container paths unchanged in `git diff`.
- **AC-9 — Coverage gate.** `npm run coverage` meets ≥ 80% statements/branches/functions/lines in the frontend workspace. Evidence: coverage report at final gate.

## Non-goals

- No change to the upgrade catalog, costs, effects, max levels, or cost formula.
- No change to persistence, server authority, protocol, or multiplayer behavior.
- No new dependency, service, port, image, or env var.
- No change to button size, layout, or positioning beyond the icon glyph (panel placement unchanged).
- No change to other panels/buttons (HUD minimize button, customization panel, auth buttons).
- No text alongside the icon by default (icon-only); see Q-3.
- No in-flight purchase disabling (deferred per spending-upgrades F16).

## Boundaries

- ✅ Always: keep disabled/affordability semantics and `aria-label`; run lint/typecheck/tests/coverage before reporting done; use concrete test assertions; stage only `files_owned` per task; keep `game/**` and server code untouched.
- ⚠️ Ask first: changing the pinned icon glyph after it is settled; adding dependencies; touching files outside a task's `files_owned` (especially `app.css` shared styles, `compose.yaml`, Dockerfiles, `App.tsx`).
- 🚫 Never: weaken assertions (wildcard matchers, snapshot-only or assertion-free tests); remove the `aria-label`; edit predecessor feature specs/plans/tasks; push; change ACs unilaterally.

## Security considerations

- **User-controlled data:** none new. `upgradeId` handling is unchanged and still server-validated. No free text reaches the DOM beyond pinned catalog names.
- **Persistence integrity:** unchanged; no DB or persistence touch.
- **Secrets:** no new secrets; nothing added to the client bundle beyond a CSS glyph.
- **Client safety:** the icon is decorative (CSS-generated) and the button's accessible name comes from `aria-label`; no `dangerouslySetInnerHTML` or untrusted content. Disabled state is derived from the same pinned affordability logic as before.

## Testing strategy

- **Frontend unit (Vitest, node):** `src/frontend/src/ui/UpgradesPanel.test.tsx` (SSR) — button markup now carries `aria-label="Buy"` and no "Buy" text; disabled/enabled forms. Concrete expected strings:
  - Disabled button: `<button type="button" aria-label="Buy" disabled=""></button>`
  - Enabled button: `<button type="button" aria-label="Buy"></button>`
  - Maxed/below-cost cases: `expect(html).not.toContain('<button type="button" aria-label="Buy"></button>');`
  - Affordable case: `expect(html).toContain('<button type="button" aria-label="Buy"></button>');`
  - Guest case: `expect(html).toContain('<button type="button" aria-label="Buy"></button>');`
- **Frontend integration (SSR):** `src/frontend/src/App.test.tsx` — golden shell string updated so each buy button reads `<button type="button" aria-label="Buy" disabled=""></button>` (in the welcomed branch, coins 0 → all disabled).
- **CSS guard:** `src/frontend/src/ui/app.css.test.ts` — assert a `.upgrades-panel button::before` rule exists with a `content:` declaration (icon override).
- **E2E / container:** no change (no cross-service behavior; AC-8).
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace; no exclusions.
- **Assertion bar:** concrete expected values; no banned wildcard matchers; no snapshot-only or assertion-free tests. The pre-existing `expect(onPurchase).not.toHaveBeenCalled()` in `UpgradesPanel.test.tsx` is retained as-is (not introduced by this feature).

## Real-time impact

Out of scope. This feature touches only presentational UI (button label → icon). No shared or cross-client state, connection lifecycle, reconnection, multi-client behavior, or server authority is affected; all of those remain as established by the spending-upgrades feature.

## Containerization impact

Out of scope (none). No new service, image, port, env var, health signal, Dockerfile, or compose change. `podman compose up` and `npm run smoke` are unchanged (AC-8).

## Open questions

Default-with-notice (resolved as proposed defaults; no approval gate, but flagged):

- **Q-1 (default with notice) — Icon representation.** Proposed default: a CSS-generated monochrome glyph via `.upgrades-panel button::before { content: '+'; }`, overriding the inherited '▾', consistent with the HUD minimize button pattern (`main > section button::before`). Alternatives: emoji (🛒/💰) — simpler markup but font-dependent rendering and introduces color; inline SVG — crisp and themeable but bloats the SSR golden strings; a different Unicode glyph. If overridden, update T1/T3 and the CSS guard.
- **Q-2 (default with notice) — Accessible name.** Proposed default: `aria-label="Buy"` (mirrors the existing literal text). Alternative: `aria-label="Buy <upgrade name>"` for per-control specificity. If overridden, update the pinned button strings in § Testing strategy.
- **Q-3 (default with notice) — Text alongside icon.** Proposed default: icon-only (no "Buy" text), to keep the HUD compact and match "instead of a buy button, add an icon". Alternative: icon + "Buy" text. If overridden, AC-1's "no Buy text" clause is relaxed and the button keeps its text children.

## Assumptions

- `UpgradesPanel` remains a direct child `<section>` of `<main>`, so it inherits `main > section button` base styles; the icon override selector is more specific and wins.
- React SSR attribute order follows JSX declaration order; the builder confirms the pinned button strings via a test run and adjusts if the installed React version differs.
- No change to disabled/affordability logic, props, or guest handling (spending-upgrades Q-5 default "yes" retained).
- The pre-existing `expect(onPurchase).not.toHaveBeenCalled()` assertion in `UpgradesPanel.test.tsx` is retained unchanged (not introduced by this feature).

## Revision history

- r1 — 2026-11-06 — initial draft (planning phase).