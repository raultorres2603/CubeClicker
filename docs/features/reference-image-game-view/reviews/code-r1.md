---
feature: reference-image-game-view
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 1
---
# Code Review — r1

## Summary

✅ approved — every AC-1 … AC-22 is verified met against the approved spec r2 and the plan r4 amendments. The independent verification suite is green in both workspaces, the protected-file gates are empty, the visual matrix is backed by artifacts, and the authoritative AC-22 clean sequence meets both limits. One MINOR visual-polish item (upgrades-row buy-button alignment) and three INFO notes remain as backlog; none blocks acceptance.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 — visual-only scope | ✅ | `BASE=b9113c5d83215a6ccb09032cfc668d53bf211b77`, `HEAD=366ad69c942e7f0879500b885c6a141f55054f8e`. All four protected gates exit 0: engine/session/multiplayer/backend/container/dependency diff + status; remaining `game/**` diff + status; `app.css`/`app.css.test.ts` diff + status. `git diff "$BASE"...HEAD -- src/frontend/src/game/progression.ts` is confined to the `CUBE_STYLES[0]` literal (id unchanged). |
| AC-2 — reference layout retained | ✅ | `src/frontend/src/ui/game-view.css.test.ts:159-201` asserts the four corner declarations read from unchanged `app.css` and no base position declarations in `game-view.css`; `src/frontend/src/App.test.tsx:470-476` asserts the `app.css` → `game-view.css` import order. Live T15 rects place all four surfaces in their corners at every size. |
| AC-3 — rounded HUD chrome and token contract | ✅ | `game-view.css.test.ts:65-127` (one `:root` with nine exact tokens; grouped panel rule with all nine exact declarations; `content: none` reset); `theme.test.ts:95-105` pins the nine literals; T15 live computed styles show radius 16 px, cyan border/glow and the pinned gradients. |
| AC-4 — HUD rows, icons and data | ✅ | `Hud.test.tsx:198-245` asserts the five rows in order, one SVG each, `data-icon` `cursor/cube/coin/cube-level/server`, `aria-hidden`, `focusable`, exact labels and `data-stat` values; `Hud.test.tsx:123-157` keeps the minimize button last with `aria-label="Toggle HUD"` and `aria-expanded`. |
| AC-5 — Users-on-Server badge | ✅ | `UserPanel.test.tsx:159-198` asserts `class="users-badge"`, exact `Users on Server`, group SVG and `users-list` section; `game-view.css.test.ts:129-157` asserts the specificity-safe `.user-panel > .users-badge` reset/hover/focus; `theme.test.ts:126-137` pins badge contrast; T15 live pill radius 999 px. |
| AC-6 — Upgrades panel rows and buy control | ✅ | `UpgradesPanel.test.tsx:119-288` asserts the exact rows, costs 10/50/25, row/cost icons, `upgrade-buy`, `aria-label="Buy"`, affordability/max-level semantics and callback arguments; `game-view.css.test.ts:204-241` asserts the panel and buy-control declarations. One MINOR alignment note (F1), not an AC violation. |
| AC-7 — Spaceship customization control | ✅ | `CustomizationToggle.test.tsx:35-99` asserts the native button, `customization-toggle`, both icons, exact label, `aria-expanded`, one callback per click and keyboard operation; `App.test.tsx:724-750` asserts the toggle/state/panel wiring; `game-view.css.test.ts:244-263` pins the toggle/panel declarations. |
| AC-8 — Auth chrome remains metallic and sharp | ✅ | `app.css` and `app.css.test.ts` are unchanged (protected diff/status exit 0); `app.css.test.ts` 83/83 green; `game-view.css.test.ts:433-444` rejects `.auth-*`, `.verification-pending`, `.connection-banner` and `.phase-announcement` selectors. |
| AC-9 — Procedural nebula texture | ✅ | `nebula.test.ts` 11/11: exact constants, 256×128 RGBA, `RGBAFormat`/`UnsignedByteType`/linear filters/sRGB, length 131072, alpha 255, deterministic/seed-different bytes, palette hue ranges, ≥100 saturated pixels per range and RGB variance >100. |
| AC-10 — Scene uses the nebula background | ✅ | `scene.test.ts` 85/85: `scene.background === view.cosmicBackdrop.nebulaTexture` (line 490), exactly one ninth `cosmic-backdrop` child (lines 2491-2500), backdrop retained across a rebuild (2503-2525), `background = null` before backdrop disposal and empty children on dispose (2566-2583). |
| AC-11 — Cosmic backdrop contents | ✅ | `cosmic-backdrop.test.ts` 13/13: 28 objects, seven asteroids, three meteor head/tail groups, comet at `(7.5,2.2,-18)` with `0xff8a3d` head, hero ship at `(9,-2.5,-14)` with `rotation.y = π/2`, seven named meshes, blue hull `0x2f6fd6`, two orange engines `0xff9a3c`, no shadow casting, all `z < -4`. T16b and T15 captures show the comet/hero in the intended screen positions. |
| AC-12 — Cosmic motion, reduced motion and disposal | ✅ | `cosmic-backdrop.test.ts:240-324` asserts exact motion under positive dt, freeze under reduced motion, non-positive dt clamping, dispose-once of every geometry/material/texture and parent removal; `scene.test.ts:2527-2564` asserts update forwarding/freeze; T15 reduced-motion A/B captures show identical object boxes. |
| AC-13 — Green reference cube palette | ✅ | `progression.test.ts:24-30` pins the exact `CUBE_STYLES[0]` literal and ids/order; `progression.test.ts` 21/21, `world.test.ts` 27/27, `cube-view.test.ts` 33/33, `scene.test.ts` 85/85; the `progression.ts` diff is confined to style 0 and backend style ids are gated unchanged. |
| AC-14 — Beveled glossy mini-cubes | ✅ | `cube-view.test.ts:236-288` pins `MINI_CUBE_BEVEL_SEGMENTS = 2`, `MINI_CUBE_BEVEL_RADIUS = 0.08`, `RoundedBoxGeometry` on every face and `BoxGeometry` for the body; `cube-view.test.ts:939-954` keeps the clearcoat constants and material behaviour. Existing hidden/pop/removal tests remain green. |
| AC-15 — Golden spark bursts | ✅ | `particles.test.ts:133-138` pins `PARTICLE_COLOR = 0xffcc66` and the `PointsMaterial.color.getHex()`; the remaining particles suite (20/20) keeps pool/fade/lifetime/recycling behaviour. |
| AC-16 — Starfield and background life retained | ✅ | `starfield.test.ts` 23/23, `background-life.test.ts` 14/14 and the retained `scene.test.ts` assertions keep exactly one starfield `Points` (`STAR_COUNT = 1200`, twinkle/travel expansion) and one `background-life` group with 5 shooting stars and 3 ships. |
| AC-17 — Wide composition does not obscure the cube | ✅ | T15 fresh artifacts `t15-1280x720.png`, `t15-1920x1080.png`, `t15-2560x1280.png`, `t15-2560x1080.png` show the four panels in their corners with the cube clear; T15 per-size metrics record cube right edges < upgrades-panel left edges. T16b slot-1/slot-2/ring-10 captures confirm the comet and hero ship clear the cube and (at 1280×720) the upgrades panel. |
| AC-18 — Responsive fit and bottom-band separation | ✅ | `game-view.css.test.ts:265-366` asserts the single `@media (max-width: 720px)` block, exact stacking/hide rules, the 9rem−8.5rem ≥ 0.5rem reserve and no top-band position declarations; `App.test.tsx:724-750` asserts `data-customization-open`; T15/T17 manual data at 375×667 and 320×568 show 15.75 px/8 px HUD–pill gaps, no horizontal scroll, all surfaces inside the viewport, no toggle/upgrades overlap, a hit-testable upgrade row and the hidden upgrades panel in the open state; 768×1024 fits with non-overlapping bottom controls. |
| AC-19 — Accessibility and contrast | ✅ | `theme.test.ts:107-143` computes the required HUD/badge/green contrasts; `icons.test.tsx` 16/16 asserts every icon's `aria-hidden`/`focusable`/`data-icon`; `game-view.css.test.ts:369-409` asserts focus rings and 44 px targets; T15 `t15-focus-visible.png` shows the cyan 2 px accent outline and the reduced-motion captures show the freeze. Existing CSS motion remains disabled under `prefers-reduced-motion`. |
| AC-20 — No backend, container or dependency change | ✅ | Protected set 1 and 3 gates exit 0; no lockfile/package change; new imports are React, `three`, `three/examples/jsm/geometries/RoundedBoxGeometry.js` and existing workspace modules (no production namespace import); `npm run build` JS gzip `247.22 kB` < 350 kB. Test-only `import * as icons` note: F3 (INFO). |
| AC-21 — Coverage | ✅ | `npm run coverage` exit 0: backend `94.34 / 85.93 / 99.68 / 94.34`, frontend `95.61 / 95.31 / 96.55 / 95.61` (statements/branches/functions/lines), both ≥ 80; no coverage exclusions added beyond the pre-existing justified `main.tsx`/`server.ts` entrypoints. |
| AC-22 — Performance evidence | ✅ | B-3 protocol: 1280×720 idle median `16.666 / 16.800` (3/3), 1280×720 rapid `16.666 / 16.800` (3/3), 1920×1080 idle median `16.694 / 16.700` (2/3 with the recorded run-3 host-stall cluster), 1920×1080 rapid clean sequence `16.666 / 16.800` (3/3); the first rapid sequence's sustained ~30 Hz run was disclosed and invalidated, and the authoritative clean sequence meets both limits. INFO: F2. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `src/frontend/src/ui/game-view.css:124-165`; visual evidence `t15-1280x720.png`, `t15-1920x1080.png`, `t15-2560x1280.png` | The first upgrades row's green buy button wraps onto its own line and left-aligns while rows 2 and 3 keep the button at the row's right edge. It is visible in every wide capture. AC-6 pins the row/button markup and CSS, not the alignment, so this is polish only. | Add `margin-left: auto` to `.upgrade-buy` (or use a two-column row grid with the buy control in the right column) so all three circular `+` controls align; add a CSS guard if the alignment becomes contractual. | open |
| F2 | INFO | `docs/features/reference-image-game-view/build-log-T15.md` § AC-22 / first sequence | The first 1920×1080 rapid sequence contained a sustained ~30 Hz compositor run (avg 19.015 ms, p95 33.4 ms) that the builder disclosed and invalidated; the fresh-browser clean sequence is 3/3 at 16.666/16.800. B-3 does not explicitly spell out “discard a contaminated sequence”, but no threshold was relaxed, every run is reported, and the authoritative clean data meets both limits. | None for this feature. In a future protocol wording, state whether a contaminated sequence may be discarded and re-run, rather than only an outlier caveat. | accepted |
| F3 | INFO | `src/frontend/src/ui/icons.test.tsx:5` | The new icon test uses `import * as icons from './icons'`; AC-20 says “named imports only, no namespace import”. It is test-only, uses an existing workspace module and does not enter the production bundle. | Optional cleanup: replace with named imports or explicitly scope the AC-20 named-import rule to production code. | accepted as INFO |
| F4 | INFO | `src/frontend/src/ui/theme.ts:22-23` | The `PAGE_BACKGROUND` comment still says “The page/canvas backdrop under the starfield”; the canvas background is now the nebula texture (the constant remains the black contrast reference used by `theme.test.ts`). | Update the comment in a cleanup pass; no behaviour change. | accepted as INFO |

## Verification performed

- `npm run lint` → exit 0.
- `npm run typecheck` → exit 0 (both workspaces).
- `npm test` → backend 22 files / 700 tests passed; frontend 53 files / 1317 tests passed; exit 0.
- `npm run coverage` → exit 0; backend `94.34 / 85.93 / 99.68 / 94.34`; frontend `95.61 / 95.31 / 96.55 / 95.61` (statements/branches/functions/lines).
- `npm run build` → exit 0; 92 modules; CSS `17.08 kB` (gzip `3.66 kB`), JS `900.97 kB` (gzip `247.22 kB`); the Vite >500 kB chunk warning remains, but the gzip budget is met.
- `npm run smoke` → `SMOKE PASS (12/12 checks)`; backend health, frontend HTTP, two WebSocket clients, multiplayer join/overflow/sync/leave, auth register/verify via Mailpit, login and guest join all pass.
- Protected-file gates with `BASE=b9113c5d83215a6ccb09032cfc668d53bf211b77` and `HEAD=366ad69c942e7f0879500b885c6a141f55054f8e`:
  - engine/session/multiplayer/backend/container/dependency diff + status → exit 0;
  - remaining `game/**` diff + status → exit 0;
  - `app.css`/`app.css.test.ts` diff + status → exit 0;
  - `progression.ts` diff confined to `CUBE_STYLES[0]`.
- Visual evidence inspected: `t15-1280x720`, `t15-1920x1080`, `t15-2560x1280`, `t15-2560x1080`, `t15-375x667`, `t15-320x568`, `t15-768x1024`, `t15-focus-visible`, `t15-reduced-motion-a/b`; `t16b-slot1/slot2/ring10` at 1280/1920/2560×1280; `t17-375x667-closed/open`, `t17-320x568-closed/open`, `t17-768x1024`, `t17-1280x720`.
- T15 per-size table and T16/T17 claims are backed by those artifacts: the four wide sizes have no panel over the cube; the slot-1, slot-2 and ring-10 captures have the same comet/hero screen composition; the 1280×720 hero clears the upgrades panel; the mobile HUD/pill gap and bottom-band separation match the recorded rects.
- No banned matchers, snapshot-only tests, assertion-free tests, unchecked spy calls, wildcard matchers or coverage exclusions were found in the new/changed feature tests.
- Documentation: root `README.md:9` contains the procedural-nebula sentence; `docs/architecture/**` and `docs/product/**` have no diff vs `BASE`; `docs/features/README.md` is unchanged by the builder and the proposed row is recorded at `build-log-T15.md:1806`.
- Container/real-time: no backend, compose, Dockerfile, package/lockfile, engine, session or multiplayer diff; `/ws` and the single-command compose path are unchanged and the smoke suite exercises them. No new shared/cross-client state, protocol field, service, image, port or environment variable.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No new dependency/asset/URL/loader/secret, no `innerHTML`/`eval`, procedural geometry/texture only; shared state remains server-authoritative and unchanged. |
| Quality | ✅ | Pure render modules, one owner per drawable/lifecycle, bounded counts, disposal contracts, no debug leftovers, traceable diffs; F1 is visual alignment polish only. |
| Testing | ✅ | Coverage ≥80 in both workspaces; every new module ships tests; concrete assertions; deterministic seeded tests; manual visual/performance evidence recorded per the project’s accepted convention. |
| Real-time | ✅ | No protocol/server/shared-state change; the unchanged multiplayer smoke checks pass; the restyled roster/upgrade values remain server-authoritative. |
| Containerized delivery | ✅ | No service/image/port/config/health-signal change; `podman compose` path and `/ws` preserved; `npm run smoke` 12/12. |
| Documentation | ✅ | README sentence matches the shipped procedural view; architecture/product docs correctly unchanged; feature index ownership respected (proposal only). F4 is a source-comment INFO. |

## Previous round verification

N/A — code review iteration 1. The spec-review round 2 (`reviews/spec-r2.md`) is approved with 0 blocking findings and 4 MINOR notes; no open spec finding is carried into this gate.

## Visual/performance evidence audit

- **Wide composition (AC-17):** 1280×720, 1920×1080, 2560×1280 and 2560×1080 captures show the four rounded cyan surfaces in their corners, the green cube unobscured, the orange comet upper-right and the blue/orange hero ship on the right. The T15 measured table agrees with the images (cube right edge < upgrades left edge; hero lower edge above the panel top at 1280).
- **Slot independence (T16/B-1):** `t16b-slot1-*`, `t16b-slot2-*` and `t16b-ring10-*` show the same comet/hero composition from slot 1 (+7.64), slot 2 (−7.64) and the 10-user ring (+38.2); this confirms the camera-anchor offsets `COSMIC_ANCHOR_OFFSET_X = 6` / `Y = 4` behaved as intended.
- **Mobile (AC-18/T17):** 375×667 and 320×568 captures show the HUD and users pill separated, the upgrades panel stacked above the toggle, no horizontal scrollbar and the customization panel fitting while open. The T17 mobile captures do not show the central cube/scene (they evidence panel geometry only), but the fresh T15 mobile captures do; no claim is left unsupported.
- **Accessibility (AC-19):** `t15-focus-visible.png` shows the cyan focus outline on the customization toggle; `t15-reduced-motion-a/b` show identical object positions (the build log records identical measured boxes and only renderer noise).
- **Performance (AC-22):** the authoritative clean sequence meets avg ≤16.7 ms and p95 ≤33 ms at both sizes; the 1920×1080 idle run-3 miss is allowed by the B-3 host-stall caveat (median and 2/3 pass), and the invalidated first 1920×1080 rapid sequence was disclosed rather than hidden (F2 INFO).
- **Evidence caveat:** at 768×1024 the upgrades panel overlaps the cube’s lower-right in the capture; AC-17 does not list 768×1024 and AC-18 only requires viewport fit and non-overlapping bottom controls, both of which pass. This is not an AC failure.

## Notes / backlog (non-blocking)

- **MINOR (F1):** align the first row’s `.upgrade-buy` with rows 2–3 (`margin-left: auto` or a two-column row grid).
- **INFO (F2):** AC-22 first 1920×1080 rapid sequence was contaminated and invalidated; the clean 3/3 sequence is authoritative and meets the limits.
- **INFO (F3):** test-only namespace import in `icons.test.tsx`; no production/bundle impact.
- **INFO (F4):** stale `PAGE_BACKGROUND` comment in `theme.ts`.
- **INFO:** T17’s mobile captures evidence panel geometry but not the cube/scene; the fresh T15 mobile captures close that gap.
