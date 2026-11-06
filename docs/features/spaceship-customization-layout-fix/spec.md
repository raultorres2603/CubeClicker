---
feature: spaceship-customization-layout-fix
revision: 2
status: draft
created: 2026-11-06
updated: 2026-11-06
---

# Spec — Spaceship Customization Layout Fix

## Summary

The spaceship customization toggle button and its panel (opened via that toggle) currently render in the default flow / top-left overlay region and overlap the Upgrades panel. This feature repositions the customization toggle button and the customization panel to the bottom-left corner of the viewport so the two panels no longer overlap, using the existing safe-area-aware positioning convention. Scope is CSS positioning plus the minimal markup hook (a class on the toggle button) and the corresponding test expectations; no gameplay, networking, persistence, or container changes.

## User stories

- As a player, I can open the spaceship customization panel without it covering the Upgrades panel, so both menus remain usable at the same time.

## Acceptance criteria

- **AC-1 — Panel placement.** When rendered, `.customization-panel` is an absolutely positioned overlay anchored to the bottom-left corner: its CSS rule declares `position: absolute`, `bottom: calc(4rem + env(safe-area-inset-bottom, 0px))` (the 4rem offset keeps the open panel above its toggle button per AC-3; a larger documented offset is acceptable only if the toggle grows — see Q-2), `left: calc(1rem + env(safe-area-inset-left, 0px))`, and `top: auto`. Evidence: `app.css.test.ts` CSS guard (concrete `toContain`/regex assertions) plus manual inspection.
- **AC-2 — Toggle placement.** The "Spaceship customization" toggle button carries the class `customization-toggle` and is absolutely positioned at the bottom-left corner: `position: absolute`, `bottom: calc(1rem + env(safe-area-inset-bottom, 0px))`, `left: calc(1rem + env(safe-area-inset-left, 0px))`. Evidence: `App.test.tsx` updated expected markup and `app.css.test.ts` CSS guard.
- **AC-3 — No self-overlap.** The panel is offset above the toggle button (bottom ≈ `calc(4rem + env(safe-area-inset-bottom, 0px))`) so the open panel and its toggle button do not overlap each other. Evidence: CSS rule + manual inspection.
- **AC-4 — Safe-area insets.** Both rules use `env(safe-area-inset-bottom, 0px)` and `env(safe-area-inset-left, 0px)` (mirroring the existing `main > section` / `.user-panel` convention) so notched devices keep the panels on-screen. Evidence: grep for `safe-area-inset` in the two rules.
- **AC-5 — No regression.** `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run coverage` (frontend workspace) pass; existing `App.test.tsx`, `SpaceshipCustomizationPanel.test.tsx`, and `app.css.test.ts` assertions remain green (with the documented button-markup update). Evidence: final build log.
- **AC-6 — No other surface moved (production scope).** The production (non-test) change touches only `src/frontend/src/App.tsx` (toggle button class) and `src/frontend/src/ui/app.css` (positioning declarations); `UpgradesPanel`, the HUD, the user panel, the connection banner, and all backend/container assets are unchanged. The two test files `src/frontend/src/App.test.tsx` and `src/frontend/src/ui/app.css.test.ts` are the only other changed files and are changed solely for expectation updates. Evidence: `git diff --stat`.

## Non-goals

- No change to panel content, counts, parts list, or preview behavior.
- No repositioning of the Upgrades panel, HUD, user panel, connection banner, or phase announcement.
- No new dependencies, services, images, ports, environment variables, or container changes.
- No change to open/close state logic or keyboard behavior.
- No responsive-breakpoint rework beyond the existing 480px block.

## Boundaries

- ✅ Always: keep changes scoped to the two owned files; preserve the metallic frame styling inherited from `main > section` for `.customization-panel`; use the existing safe-area inset convention; run lint/typecheck/tests/coverage before reporting done; record evidence in build logs.
- ⚠️ Ask first: changing the vertical gap constant (4rem), adding a wrapper element instead of the class hook, or repositioning any other panel.
- 🚫 Never: edit backend, protocol, or container assets; weaken or delete existing CSS-guard assertions; add wildcard matchers; push.

## Security considerations

- No user-controlled data, persistence, or secrets involved (CSS/layout and a static class name only).
- No dependency additions.

## Testing strategy

- **Unit (CSS guard, Vitest, node):** extend `src/frontend/src/ui/app.css.test.ts` with concrete assertions that `.customization-panel` and `.customization-toggle` declare `position: absolute` with the specified `bottom`/`left`/`top: auto` values. Positioning is merged into the single existing `.customization-panel` rule (not a second block), so the standard first-match `css.match(/\\.customization-panel\\s*\\{([\\s\\S]*?)\\}/)` selects the positioning declarations deterministically; a global match + find-the-block-containing-`position: absolute` strategy is an equivalent acceptable alternative. No wildcard matchers.
- **Integration (SSR, Vitest, jsdom):** update `src/frontend/src/App.test.tsx` expected markup for the toggle button to include `class="customization-toggle"`; existing `SpaceshipCustomizationPanel.test.tsx` unchanged.
- **E2E / container:** no change; existing smoke remains the regression check.
- **Coverage:** `npm run coverage` (frontend workspace) — thresholds ≥ 80% statements/branches/functions/lines; pre-gates per task workspace-scoped. No exclusions added.
- **Assertion bar:** concrete expected values everywhere; no banned wildcard matchers; no snapshot-only/assertion-free tests.

## Open questions

- **Q-1 — Wrapper vs. class hook.** Chosen: a class hook on the existing toggle button (`customization-toggle`) plus absolute positioning on `.customization-panel`, to avoid losing the `main > section` metallic frame styling that a wrapper `<div>` would strip. Alternative (wrapper dock) would require re-adding frame styles; deferred.
- **Q-2 — Vertical gap constant.** `4rem` panel bottom offset assumes a ≤ ~2.5rem toggle button. If the button grows (e.g., longer label / larger font), increase the constant. Tunable without spec revision.
- **Q-3 — Upgrades panel location.** This spec assumes the Upgrades panel keeps its current position; if product later wants it bottom-right, that is a separate feature.
- **Q-4 — Toggle intrinsic width (known limitation).** The toggle button keeps its intrinsic width (no max-width/clamp or label truncation); on very narrow viewports the long `Spaceship customization` label may overflow the viewport. Acceptable per Non-goals (no responsive-breakpoint rework); flagged as a known limitation rather than a defect. Tunable (e.g., clamp/max-width) without spec revision if product later wants it.

## Assumptions

- The bottom-left viewport region is free of other overlays (HUD is top-left, phase announcement is bottom-center, user panel is top-right).
- `.customization-panel` remains a direct child of `<main>` so it keeps the `main > section` metallic frame styling; only its position is overridden.

## Real-time impact

Out of scope: no shared or cross-client state, connection lifecycle, reconnection, or server authority is touched.

## Containerization impact

Out of scope: no services, images, ports, environment variables, health signals, compose entries, Dockerfiles, or `src/server.ts` changes. `podman compose up` and `npm run smoke` are unchanged.

## Revision history

- r1 — 2026-11-06 — initial draft (planning phase).
- r2 — 2026-11-06 — revision round 1: address F1 (AC-6 production-scope reword), F2 (merge positioning into existing `.customization-panel` block; CSS-guard selection approach), F3 (AC-1 panel bottom = `calc(4rem + env(...))`), F4 (Q-4 toggle intrinsic width known limitation). AC count unchanged (6).