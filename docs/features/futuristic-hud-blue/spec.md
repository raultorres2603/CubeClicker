---
feature: futuristic-hud-blue
revision: 2
status: draft
created: 2026-10-28
updated: 2026-10-28
---

# Spec — Futuristic HUD Blue

## Summary

A frontend-only redesign of the game HUD (the `main > section` statistics overlay) into a futuristic, blue, technologic presentation: a glassy translucent panel with neon-cyan framing, glow, and subtle animated detailing, plus a clearly visible, usable minimize control. The redesign also fixes the currently broken/undersized minimize button; the layering of detailing pseudo-elements is an implementation detail handled via `pointer-events: none` (and non-obscuring paint order) and is covered by AC-2/AC-6/AC-8. Game rules, stats, intents, phase sequencing, level progression, server protocol, persistence, backend, and containers are untouched; all visuals remain local to one client. Because the reference image supplied with the request could not be viewed by tooling, the exact on-screen layout is not pinned here; the default interpretation retains the existing top-left placement and stat list, and the unknowns are captured as open questions.

## User stories

- As a player, I see a futuristic blue, technologic HUD panel with glow and glassmorphism so the interface matches the game's visual tone.
- As a player, the minimize control is clearly visible and clickable, so I can collapse the HUD without guessing.
- As a player who prefers reduced motion, the new animated detailing collapses or disables, so there is no motion sickness.
- As a maintainer, the HUD redesign does not change React markup contracts, game logic, networking, persistence, or container assets, so existing tests and behaviour remain stable.

## Acceptance criteria

Verification notes: "the frontend workspace" means `src/frontend`. Evidence per AC: a test file asserting concrete values, or a command. All tests use concrete expected values (no banned matchers, no useless tests). Commands (from `AGENTS.md`): `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend` (pre-gate), full `npm run coverage` (final gate), `npm run build`.

- **AC-1 — Theme constants unchanged.** `HUD_TEXT === '#e8f6ff'`, `HUD_BACKGROUND === 'rgba(6, 10, 20, 0.72)'`, `ACCENT === '#7cf6ff'`, and `PAGE_BACKGROUND === '#000000'` remain pinned in `src/frontend/src/ui/theme.ts`; the WCAG AA contrast gate in `theme.test.ts` still passes. Evidence: `theme.test.ts`.

- **AC-2 — Futuristic HUD panel frame.** All of the following tokens live in the existing base `main > section` rule (the first `main > section` block, lines 67–82 of `app.css`), consolidated into that single rule rather than a new block: `position: absolute`, a `backdrop-filter` (or `-webkit-backdrop-filter`) declaration containing `blur(`, a `box-shadow` declaration containing `rgba(124, 246, 255`, a `border` declaration containing `rgba(124, 246, 255`, and `overflow: hidden`. The detailing pseudo-elements `main > section::before` and `main > section::after` carry `pointer-events: none` (see AC-6/AC-8). Evidence: `app.css.test.ts` (grep guards anchored to the base rule).

- **AC-3 — Visible, usable minimize control.** The `main > section button` rule (the existing button rule) contains `pointer-events: auto`, `cursor: pointer`, and the canonical size declarations `min-width: 1.5rem;` and `min-height: 1.5rem;` (equivalently `24px` at a 16px root; the guard converts `rem` using a 16px base and requires the numeric value to be ≥ 24px). A separate `main > section button::before` (or `::after`) rule contains a `content:` declaration, providing a visible icon/glyph without changing React markup. Evidence: `app.css.test.ts`.

- **AC-4 — Minimize control focus ring.** A `main > section button:focus-visible` rule in `src/frontend/src/ui/app.css` contains `outline: 2px solid var(--accent)` (or equivalent `outline: 2px solid #7cf6ff`). Evidence: `app.css.test.ts`.

- **AC-5 — Minimized state presentation.** A rule whose selector is exactly `main > section[data-minimized="true"]` (no trailing ` p` or pseudo, `\{` immediately after optional whitespace) contains `opacity:` or `filter: brightness(` to dim the panel; the adjacent `main > section[data-minimized="true"] p` rule collapses the stat paragraphs (`max-height: 0`, `opacity: 0`, `overflow: hidden`). Evidence: `app.css.test.ts`.

- **AC-6 — Scanline detailing.** `src/frontend/src/ui/app.css` defines `@keyframes hud-scanline` and applies it to `main > section::after` only (not `::before`, which remains the border-light carrier per AC-8), with a rule of the form `animation: hud-scanline <n>ms linear infinite;` where `<n>` is an integer in the inclusive range `2000..6000`. The `main > section::after` rule contains `content:`, `position: absolute`, and `pointer-events: none`. Evidence: `app.css.test.ts`.

- **AC-7 — Reduced motion.** Under `@media (prefers-reduced-motion: reduce)`, the scanline, border-light, blink, and panel transitions are disabled (`animation: none` and `transition: none`) for `main > section`, `main > section::before`, `main > section::after`, `main > section button`, `main > section[data-minimized="true"] p`, and `main > section[data-blinking="true"]`; the media block contains `main > section::after` and `animation: none`. Evidence: `app.css.test.ts`.

- **AC-8 — Retained border light.** The existing `@keyframes border-light-travel` animation remains defined and applied to `main > section` and `.user-panel` with durations in `2000..6000ms`, as pinned by the predecessor feature. Because AC-2 sets `overflow: hidden` on `main > section`, the border-light carrier `main > section::before` uses `inset: 0` (ring inside the padding box) rather than `inset: -1px`, so the ring is not clipped; `animation: border-light-travel` remains present on `main > section::before`. `main > section::before` carries `pointer-events: none`. Evidence: `app.css.test.ts`.

- **AC-9 — Retained blink.** The existing `@keyframes hud-blink` animation remains defined and applied to `main > section[data-blinking="true"]` with duration `<= 300ms`. Evidence: `app.css.test.ts`.

- **AC-10 — Markup contract unchanged.** `Hud` (in `src/frontend/src/ui/Hud.tsx`) retains its existing props (`stats`, `levelIndex`, `serverId`, `minimized`, `blinking`, `onToggleMinimize`) and data hooks (`data-minimized`, `data-blinking`, `data-stat`); the existing `Hud.test.tsx` assertions continue to pass without weakening. Evidence: `Hud.test.tsx`, `App.test.tsx`.

- **AC-11 — Responsive fit.** Inside the existing `@media (max-width: 480px)` block, a rule whose selector contains `main > section` adjusts `padding` and/or `font-size`, so the HUD does not overflow narrow viewports. Guards scan every `@media (max-width: 480px)` block (no second 480px block is introduced). Evidence: `app.css.test.ts`.

- **AC-12 — No backend/container change.** `git diff` is empty for `compose.yaml`, `compose.smoke.yaml`, `src/backend/**`, `src/frontend/Dockerfile`, and any other `**/Dockerfile` in the tree. Verification command: `git diff --exit-code -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'`. Evidence: final build log.

- **AC-13 — Coverage.** `npm run coverage` (both workspaces) exits 0 with ≥ 80% statements/branches/functions/lines per workspace; frontend pre-gate `npm run coverage --workspace @cubeclicker/frontend` is the task-level check. Evidence: final build log.

## Non-goals

- No change to game rules, stats, intents, phase sequencing, level progression, server protocol, or persistence.
- No React markup or component-structure change by default (the HUD keeps its `main > section` shape and data hooks); any markup change requires a spec revision.
- No new dependencies, no textures/assets, no shaders, no audio, no fonts beyond the existing system stack.
- No browser automation or pixel/perceptual tests.
- No change to spaceship shot timing or deferred explosion semantics.
- No change to theme colour constants (contrast gate preserved).
- No persistence or cross-client propagation of HUD state.
- No redesign of auth overlays beyond the existing CSS.
- No exact replication of the (unreadable) reference image; layout specifics are captured as open questions.

## Boundaries

- ✅ Always: keep `game/**` pure and DOM-free; named tree-shakeable imports from `three` where used; tests with concrete expected values beside every behaviour change; run lint, typecheck, tests, and the coverage command before reporting done; stage only `files_owned` per task.
- ⚠️ Ask first: any new dependency (none needed); any pinned-constant or theme-colour deviation from this spec; touching any file outside a task's `files_owned`; any coverage exclusion or threshold change; any change to backend/container files; any React markup change.
- 🚫 Never: weaken assertions (banned matchers, snapshot-only, assertion-free, useless tests); exclude production code from coverage; touch `.env*`, secrets, backend/container files, `main.tsx`, or configs; use `import *` from `three`; read browser globals inside `game/**` or pure render math; push; rewrite predecessor specs.

## Security considerations

- **No new dependencies.** Only the existing stack; lockfile untouched.
- **No user data, storage, or network.** All visual state is in-memory per client; nothing is persisted or sent.
- **Rendering safety.** CSS-only detailing (gradients, keyframes, pseudo-elements); no loaders, textures, external assets, or `innerHTML`.
- **Resource bounds.** Fixed-count pseudo-elements and a single scanline animation; no unbounded growth. `dispose()` unaffected.
- **Test integrity.** Coverage bar and concrete-assertion rule protect unchanged pure logic and server-authority paths.

## Real-time impact

**None for shared state.** The HUD redesign is a client-local visual change: no shared or cross-client state is created or read, no protocol message is added, and connection lifecycle, reconnection, multi-client behaviour, and server authority are unaffected (they remain as in predecessor features). Reduced-motion handling stays local.

## Containerization impact

**None expected.** Frontend source/CSS changes only: no new services, images, ports, environment variables, or health signals; no compose/Dockerfile/README change. The frontend image absorbs the diff through the existing build; the unchanged containerized smoke test (`npm run smoke`) remains the regression check at the final gate where the environment allows it. AC-12 pins the container-file diff gate.

## Testing strategy

- **Unit (Vitest, node environment):** `app.css.test.ts` pins the new CSS guards (panel frame tokens, minimize button visibility/focus, scanline keyframe/duration, responsive media query, reduced-motion disabling) alongside the existing guards (border light, blink, overlay motion). `theme.test.ts` pins unchanged colour constants and contrast.
- **Integration (React, jsdom):** `Hud.test.tsx` and `App.test.tsx` confirm the markup contract is unchanged (props, data hooks, minimize toggle, blink wiring). No new React behaviour is added, so no new interaction tests are required.
- **E2E / container:** no browser automation (predecessor non-goal retained); `npm run smoke` unchanged, run at the final gate where the environment allows.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace (frontend pre-gate: `npm run coverage --workspace @cubeclicker/frontend`); config exclusions unchanged (only `src/main.tsx` + test patterns). If a metric cannot honestly clear 80, the task reports `blocked` — no carve-outs.

## Open questions

- **Q-1 — Reference layout (user checkpoint, image unavailable).** The supplied image could not be viewed by tooling, so the exact panel shape, corner treatment, iconography, and stat arrangement are unknown. Default: retain the existing top-left placement and stat list and apply a futuristic blue technologic style (glassmorphism, cyan glow, scanline, visible minimize button). Choosing a different layout requires a spec revision and CSS/possibly markup updates.
- **Q-2 — Minimize button affordance.** Default: a visible rounded button with a CSS-provided chevron glyph (`main > section button::before` `content:`) and `aria-label="Toggle HUD"`. Alternative: a text label ("Minimize"/"Expand"). The default keeps markup unchanged; the alternative changes `Hud.tsx` and tests.
- **Q-3 — Scanline intensity.** Default: a single low-opacity horizontal scanline animation over the panel. If it causes visual noise or performance issues, it can be reduced to a static gradient (constant edit + spec note).
- **Q-4 — Theme colour change.** Default: keep the existing theme colour constants to preserve the WCAG AA contrast gate. If a deeper blue palette is desired, it requires updating `theme.ts`, `theme.test.ts`, and the CSS variables together.
- **Q-5 — Feature scope.** The request bundles a visual redesign with a minimize-control fix. Default: one feature. If review finds the scope too large, split into `hud-visual-redesign` and `hud-minimize-fix` and sequence them; requires user approval. (Scope split, if chosen, is confirmed at the `awaiting_approval` checkpoint — see review r1 F9.)

## Assumptions

- The HUD keeps its `main > section` selector and existing data hooks; styling is applied through CSS and pseudo-elements so tests remain stable.
- Reduced motion is honoured by disabling all new animations/transitions under `prefers-reduced-motion: reduce`.
- No new RNG, persistence, or cross-client propagation is introduced.
- Predecessor specs/plan/tasks stay authoritative for everything not superseded; this spec is read alongside them and never edits them.
- Stack unchanged: TypeScript strict, Vitest, ESLint; the project testing bar governs.

## Revision history

- r1 — 2026-10-28 — initial draft (planning phase).
- r2 — 2026-10-28 — revision after spec review r1: F1 AC-6 scanline pinned to `main > section::after` only (`::before` stays border-light carrier); F2 AC-2/3/4/5/11 canonical greppable rule/media-block references (base rule, button rule, exact minimized selector, 480px block); F3 `overflow: hidden` reconciled with border light via `inset: 0` on `::before`; F4 AC-7 reduced-motion selector list includes `::before`/`::after` and other selectors; F5 summary layering wording; F6 AC-3 canonical `1.5rem`/`24px` size with conversion rule; F7 `pointer-events: none` on detailing pseudo-elements; F8/F9 informational noted (T1 sizing note, scope split at approval).