---
feature: upgrades-panel-bottom-right
revision: 1
status: draft
created: 2026-11-06
updated: 2026-11-06
---
# Spec — Upgrades Panel Bottom Right

## Summary

The Upgrades panel (the "buy upgrades" box listing +10% coin upgrades) currently renders in the default flow/top-left overlay region as a `main > section` and overlaps other UI. This feature repositions it to the bottom-right corner of the viewport using the existing safe-area-aware absolute-positioning convention, by adding a class hook to the panel's root section and a CSS rule overriding its position. Scope is CSS positioning plus the minimal markup hook and the corresponding test expectations; no gameplay, networking, persistence, or container changes.

## User stories

- As a player, I can open and use the Upgrades panel without it covering other UI, because it is anchored to the bottom-right corner.

## Acceptance criteria

- **AC-1 — Panel placement.** When rendered, `.upgrades-panel` is an absolutely positioned overlay anchored to the bottom-right corner: its CSS rule declares `position: absolute`, `bottom: calc(1rem + env(safe-area-inset-bottom, 0px))`, `right: calc(1rem + env(safe-area-inset-right, 0px))`, `top: auto`, and `left: auto`. Evidence: `app.css.test.ts` CSS guard (concrete `toContain`/regex assertions) plus manual inspection.
- **AC-2 — Class hook.** The Upgrades panel's root `<section>` carries `class="upgrades-panel"` (rendered by `UpgradesPanel`), mirroring the `customization-panel` ownership pattern. Evidence: `UpgradesPanel.test.tsx` and `App.test.tsx` updated expected markup.
- **AC-3 — Safe-area insets.** The rule uses `env(safe-area-inset-bottom, 0px)` and `env(safe-area-inset-right, 0px)` so notched devices keep the panel on-screen. Evidence: grep for `safe-area-inset` in the rule.
- **AC-4 — No regression.** `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run coverage` (frontend workspace) pass; existing `UpgradesPanel.test.tsx`, `App.test.tsx`, and `app.css.test.ts` assertions remain green (with the documented markup update). Evidence: final build log.
- **AC-5 — No other surface moved (production scope).** The production (non-test) change touches only `src/frontend/src/ui/UpgradesPanel.tsx` (class hook on the root section) and `src/frontend/src/ui/app.css` (positioning declarations); the HUD, user panel, connection banner, phase announcement, spaceship customization panel, and all backend/container assets are unchanged. The test files `src/frontend/src/ui/UpgradesPanel.test.tsx`, `src/frontend/src/App.test.tsx`, and `src/frontend/src/ui/app.css.test.ts` are the only other changed files and are changed solely for expectation updates. Evidence: `git diff --stat`.

## Non-goals

- No change to panel content, upgrade list, costs, or buy-button behavior.
- No repositioning of the HUD, user panel, connection banner, phase announcement, or spaceship customization panel.
- No new dependencies, services, images, ports, environment variables, or container changes.
- No change to open/close state logic or keyboard behavior.
- No responsive-breakpoint rework beyond the existing 480px block.

## Boundaries

- ✅ Always: keep changes scoped to the two owned production files; preserve the metallic frame styling inherited from `main > section` for `.upgrades-panel` (class selector specificity 0,1,0 beats `main > section` 0,0,2); use the existing safe-area inset convention; run lint/typecheck/tests/coverage before reporting done; record evidence in build logs.
- ⚠️ Ask first: changing the inset constant, adding a wrapper element instead of the class hook, or repositioning any other panel.
- 🚫 Never: edit backend, protocol, or container assets; weaken or delete existing CSS-guard assertions; add wildcard matchers; push.

## Security considerations

- No user-controlled data, persistence, or secrets involved (CSS/layout and a static class name only).
- No dependency additions.

## Testing strategy

- **Unit (CSS guard, Vitest, node):** extend `src/frontend/src/ui/app.css.test.ts` with concrete assertions that `.upgrades-panel` declares `position: absolute` with the specified `bottom`/`right`/`top: auto`/`left: auto` values. The selector has a single rule, so first-match `css.match(/\.upgrades-panel\s*\{([\s\S]*?)\}/)` selects it deterministically. No wildcard matchers.
- **Integration (SSR, Vitest, jsdom):** update `src/frontend/src/ui/UpgradesPanel.test.tsx` and `src/frontend/src/App.test.tsx` expected markup for the panel section to include `class="upgrades-panel"` (inserted between `aria-label="Upgrades"` and `data-mode`, matching the `customization-panel` attribute order). Existing `SpaceshipCustomizationPanel` tests unchanged.
- **E2E / container:** no change; existing smoke remains the regression check.
- **Coverage:** `npm run coverage` (frontend workspace) — thresholds ≥ 80% statements/branches/functions/lines; pre-gates per task workspace-scoped. No exclusions added.
- **Assertion bar:** concrete expected values everywhere; no banned wildcard matchers; no snapshot-only/assertion-free tests.

## Open questions

- **Q-1 — Class ownership.** Chosen: the class lives on the root section inside `UpgradesPanel` (component-owned), mirroring `customization-panel` in `SpaceshipCustomizationPanel`; `App.tsx` needs no markup change. Alternative (wrapper in `App.tsx`) would detach the section from `main > section` and lose the metallic frame styling; rejected.
- **Q-2 — Inset constant.** `1rem` bottom/right offsets mirror the existing `main > section` / `.user-panel` convention; tunable without spec revision if the panel needs more clearance.
- **Q-3 — Overlap with phase announcement.** The panel is bottom-right while the phase announcement is bottom-center; if a very wide panel overlaps, increase the right inset or add a max-width. Flagged as a known limitation, not a defect.

## Assumptions

- The bottom-right viewport region is free of other overlays (HUD is top-left, phase announcement is bottom-center, user panel is top-right, customization toggle/panel is bottom-left).
- `.upgrades-panel` remains a direct child of `<main>` so it keeps the `main > section` metallic frame styling; only its position is overridden.
- The class selector (specificity 0,1,0) reliably overrides `main > section` (0,0,2) without `!important`.

## Real-time impact

Out of scope: no shared or cross-client state, connection lifecycle, reconnection, or server authority is touched.

## Containerization impact

Out of scope: no services, images, ports, environment variables, health signals, compose entries, Dockerfiles, or `src/server.ts` changes. `podman compose up` and `npm run smoke` are unchanged.

## Revision history

- r1 — 2026-11-06 — initial draft (planning phase).