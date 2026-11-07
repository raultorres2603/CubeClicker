# Build log — T17 — Mobile top-band spacing

Task: T17 (2026-11-07)
Files changed: `src/frontend/src/ui/game-view.css`, `src/frontend/src/ui/game-view.css.test.ts`, `docs/features/reference-image-game-view/build-log-T17.md`, `docs/features/reference-image-game-view/evidence/t17-*.png`

## What changed & why

- B-2 fix: inside the existing single `@media (max-width: 720px)` block, `.hud-panel` gains `box-sizing: border-box` (so the cap includes the 2px border and padding — there is no global reset) and `max-width: calc(100vw - 2rem - 9rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))`; its existing mobile padding/font declarations are kept.
- `.user-panel` is capped at `max-width: 8.5rem` and the mobile `.user-panel > .users-badge` drops to `padding: 0.5rem 0.5rem; font-size: 0.8rem` (the base AC-5 badge rule is untouched).
- The 9rem reserve minus the 8.5rem pill cap leaves 0.5rem = 8px of horizontal gap at every width ≤720px and any safe-area inset. No `position`/`top`/`right`/`bottom`/`left` was added, so `app.css` keeps all four corners (AC-2); the base rules, bottom-band overrides, hide rule, `app.css` and markup are unchanged.
- `game-view.css.test.ts`: HUD assertion updated to the exact four declarations; added exact `.user-panel` (`max-width: 8.5rem`) and mobile badge (`padding`, `font-size`) assertions; added the 9rem−8.5rem≥0.5rem (≥8px) arithmetic guard and a no-position guard for the three top-band rules inside the 720px block. Existing guards (tokens, grouped panel, base badge, `app.css` corner reads, base-source no-position) are unchanged.

## Decisions

- The arithmetic guard parses the two rem literals from the stylesheet itself (`9` from the HUD calc, `8.5` from the pill cap) and asserts `reserve - cap >= 0.5rem` and `>= 8px` (1rem = 16px), so the gap guarantee cannot drift out of sync with a hand-written expectation.
- The no-position guard is scoped to the three top-band selectors (`.hud-panel`, `.user-panel`, `.user-panel > .users-badge`) inside the media block only; the bottom-band `left`/`right`/`bottom` declarations are the intended AC-18 exceptions and stay untouched.
- Test tier: `game-view.css.test.ts` is the established node-environment source/contract guard for this stylesheet (same precedent as T2). No executable integration boundary exists for a static CSS file beyond the real-browser manual pass, which was executed (below) and is recorded with screenshots and measured rects.
- Manual verification used the running `podman compose` stack (frontend `localhost:5173`, backend `localhost:8080`) and headless Google Chrome 157 over CDP, guest session, mobile device emulation at 375/320 and desktop emulation at 768/1280. No repository dependency was added; the throwaway script lives at `/tmp/opencode/t17/manual.mjs` and its raw JSON at `/tmp/opencode/t17/manual.json`.

## Evidence

Environment: repository root `/var/home/raultorraco/Documents/Projects/CubeClicker`; Node v24.22.0; npm 11.19.1; frontend workspace `@cubeclicker/frontend`.

### `npm run lint` — exit 0

```text

> lint
> eslint .

LINT_EXIT=0
```

### `npm run typecheck` — exit 0

```text

> typecheck
> npm run typecheck --workspaces --if-present


> typecheck
> tsc --noEmit


> typecheck
> tsc --noEmit

TYPECHECK_EXIT=0
```

### `npm test --workspace @cubeclicker/frontend` — exit 0

```text
 RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend

 ✓ src/ui/game-view.css.test.ts (28 tests) 9ms
 ... (53 test files, all green)

 Test Files  53 passed (53)
      Tests  1316 passed (1316)
   Start at  22:31:02
   Duration  2.77s (transform 6.08s, setup 0ms, collect 16.58s, tests 7.27s, environment 4.50s, prepare 4.99s)

TEST_EXIT=0
```

`game-view.css.test.ts` grew from 25 to 28 tests (three net-new: pill cap/typography, arithmetic guard, top-band no-position guard) and all pass.

### `npm run coverage --workspace @cubeclicker/frontend` — exit 0

```text
RUN  v3.2.7 /var/home/raultorraco/Documents/Projects/CubeClicker/src/frontend
      Coverage enabled with v8

 ✓ src/ui/game-view.css.test.ts (28 tests) 17ms
 ...
 Test Files  53 passed (53)
      Tests  1316 passed (1316)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |    95.6 |    95.31 |   96.55 |    95.6 |
...
COVERAGE_EXIT=0
```

Coverage gate green: 95.6% statements / 95.31% branches / 96.55% functions / 95.6% lines (thresholds ≥80 for all four).

### Manual mobile/desktop check — PASS

Method: compose stack up (`podman ps`: `cubeclicker-frontend-1`, `cubeclicker-backend-1` healthy), headless Google Chrome over CDP, guest session, `Emulation.setDeviceMetricsOverride` (`mobile: true` for 375/320), customization closed then opened by clicking `.customization-toggle`, fresh measurement after each resize. Screenshots in `docs/features/reference-image-game-view/evidence/`.

| Size | State | HUD rect `(x, y, w, h)` | Users pill rect | HUD→pill gap | Overlap | scroll/client width | Out of viewport | Screenshot |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 375×667 | closed | `(16, 16, 191.25, 159.16)` | `(223, 16, 136, 53.39)` | **15.75px** | no | 375/375 | `[]` | `evidence/t17-375x667-closed.png` |
| 375×667 | open | `(16, 16, 191.25, 159.16)` | `(223, 16, 136, 53.39)` | **15.75px** | no | 375/375 | `[]` | `evidence/t17-375x667-open.png` |
| 320×568 | closed | `(16, 16, 144, 178.19)` | `(168, 16, 136, 53.39)` | **8px** | no | 320/320 | `[]` | `evidence/t17-320x568-closed.png` |
| 320×568 | open | `(16, 16, 144, 178.19)` | `(168, 16, 136, 53.39)` | **8px** | no | 320/320 | `[]` | `evidence/t17-320x568-open.png` |
| 768×1024 | closed | `(16, 16, 214.36, 178.41)` | `(578.72, 16, 173.28, 44)` | 348.36px | no | 768/768 | `[]` | `evidence/t17-768x1024.png` |
| 1280×720 | closed | `(16, 16, 214.36, 178.41)` | `(1090.72, 16, 173.28, 44)` | 860.36px | no | 1280/1280 | `[]` | `evidence/t17-1280x720.png` |

Computed-style checks from the same measurements:

- 375×667: `.hud-panel` `box-sizing: border-box`, `max-width: 199px` (= 375 − 32 − 144), `padding: 8px 12px`, `font-size: 13.6px`; `.user-panel` `max-width: 136px`; badge `padding: 8px`, `font-size: 12.8px`.
- 320×568: `.hud-panel` `max-width: 144px` (= 320 − 32 − 144), same border-box/padding/font; `.user-panel` `max-width: 136px`.
- Open state at both mobile sizes: `data-customization-open="true"`, upgrades panel `display: none`, customization panel fully inside the viewport (`(16, 277.97, 343, 309.03)` at 375, `(16, 204.41, 288, 283.59)` at 320), no toggle/upgrades overlap.
- 768×1024 and 1280×720: `.hud-panel` `max-width: none`, badge `padding: 8px 16px` / `font-size: 14.4px` — the desktop base rules and corners are unchanged; both size checks pass.
- 375×667 upgrade row usability: `.upgrade-buy` rect `(70, 411.22, 44, 44)`; `document.elementFromPoint(centre)` returns `BUTTON.upgrade-buy` (`same: true`; `disabled: true` because the guest has 0 coins — the clickable target is not occluded).

Raw script output (full per-state measurement lines; full JSON dump at `/tmp/opencode/t17/manual.json`):

```text
ENTERED_GAME
375x667-closed {"viewport":{"w":375,"h":667},"scroll":{"scrollWidth":375,"clientWidth":375,"bodyScrollWidth":375},"customOpen":"false","hud":{"x":16,"y":16,"w":191.25,"h":159.15625,"right":207.25,"bottom":175.15625,"display":"flex","boxSizing":"border-box","maxWidth":"199px","padding":"8px 12px","fontSize":"13.6px","position":"absolute"},"users":{"x":223,"y":16,"w":136,"h":53.390625,"right":359,"bottom":69.390625,"display":"flex","boxSizing":"content-box","maxWidth":"136px","padding":"0px","fontSize":"16px","position":"absolute"},"badge":{"x":223,"y":16,"w":136,"h":53.390625,"right":359,"bottom":69.390625,"display":"block","boxSizing":"border-box","maxWidth":"none","padding":"8px","fontSize":"12.8px","position":"static"},"upgrades":{"x":16,"y":333.5625,"w":343,"h":253.4375,"right":359,"bottom":587,"display":"flex","boxSizing":"content-box","maxWidth":"none","padding":"8px 12px","fontSize":"13.6px","position":"absolute"},"toggle":{"x":16,"y":607,"w":200.21875,"h":44,"right":216.21875,"bottom":651,"display":"block","boxSizing":"border-box","maxWidth":"none","padding":"1px 6px","fontSize":"13.3333px","position":"absolute"},"custom":null,"hudPillGapPx":15.75,"hudPillOverlap":false,"toggleUpgradesOverlap":false,"outOfViewport":[]}
375x667-open {"viewport":{"w":375,"h":667},"scroll":{"scrollWidth":375,"clientWidth":375,"bodyScrollWidth":375},"customOpen":"true","hud":{"x":16,"y":16,"w":191.25,"h":159.15625,"right":207.25,"bottom":175.15625,"display":"flex","boxSizing":"border-box","maxWidth":"199px","padding":"8px 12px","fontSize":"13.6px","position":"absolute"},"users":{"x":223,"y":16,"w":136,"h":53.390625,"right":359,"bottom":69.390625,"display":"flex","boxSizing":"content-box","maxWidth":"136px","padding":"0px","fontSize":"16px","position":"absolute"},"badge":{"x":223,"y":16,"w":136,"h":53.390625,"right":359,"bottom":69.390625,"display":"block","boxSizing":"border-box","maxWidth":"none","padding":"8px","fontSize":"12.8px","position":"static"},"upgrades":{"x":0,"y":0,"w":0,"h":0,"right":0,"bottom":0,"display":"none","boxSizing":"content-box","maxWidth":"none","padding":"8px 12px","fontSize":"13.6px","position":"absolute"},"toggle":{"x":16,"y":607,"w":200.21875,"h":44,"right":216.21875,"bottom":651,"display":"block","boxSizing":"border-box","maxWidth":"none","padding":"1px 6px","fontSize":"13.3333px","position":"absolute"},"custom":{"x":16,"y":277.96875,"w":343,"h":309.03125,"right":359,"bottom":587,"display":"flex","boxSizing":"content-box","maxWidth":"none","padding":"12px 16px","fontSize":"13.6px","position":"absolute"},"hudPillGapPx":15.75,"hudPillOverlap":false,"toggleUpgradesOverlap":false,"outOfViewport":[]}
320x568-closed {"viewport":{"w":320,"h":568},"scroll":{"scrollWidth":320,"clientWidth":320,"bodyScrollWidth":320},"customOpen":"false","hud":{"x":16,"y":16,"w":144,"h":178.1875,"right":160,"bottom":194.1875,"display":"flex","boxSizing":"border-box","maxWidth":"144px","padding":"8px 12px","fontSize":"13.6px","position":"absolute"},"users":{"x":168,"y":16,"w":136,"h":53.390625,"right":304,"bottom":69.390625,"display":"flex","boxSizing":"content-box","maxWidth":"136px","padding":"0px","fontSize":"16px","position":"absolute"},"badge":{"x":168,"y":16,"w":136,"h":53.390625,"right":304,"bottom":69.390625,"display":"block","boxSizing":"border-box","maxWidth":"none","padding":"8px","fontSize":"12.8px","position":"static"},"upgrades":{"x":16,"y":269.203125,"w":288,"h":218.796875,"right":304,"bottom":488,"display":"flex","boxSizing":"content-box","maxWidth":"none","padding":"8px 12px","fontSize":"13.6px","position":"absolute"},"toggle":{"x":16,"y":508,"w":200.21875,"h":44,"right":216.21875,"bottom":552,"display":"block","boxSizing":"border-box","maxWidth":"none","padding":"1px 6px","fontSize":"13.3333px","position":"absolute"},"custom":null,"hudPillGapPx":8,"hudPillOverlap":false,"toggleUpgradesOverlap":false,"outOfViewport":[]}
320x568-open {"viewport":{"w":320,"h":568},"scroll":{"scrollWidth":320,"clientWidth":320,"bodyScrollWidth":320},"customOpen":"true","hud":{"x":16,"y":16,"w":144,"h":178.1875,"right":160,"bottom":194.1875,"display":"flex","boxSizing":"border-box","maxWidth":"144px","padding":"8px 12px","fontSize":"13.6px","position":"absolute"},"users":{"x":168,"y":16,"w":136,"h":53.390625,"right":304,"bottom":69.390625,"display":"flex","boxSizing":"content-box","maxWidth":"136px","padding":"0px","fontSize":"16px","position":"absolute"},"badge":{"x":168,"y":16,"w":136,"h":53.390625,"right":304,"bottom":69.390625,"display":"block","boxSizing":"border-box","maxWidth":"none","padding":"8px","fontSize":"12.8px","position":"static"},"upgrades":{"x":0,"y":0,"w":0,"h":0,"right":0,"bottom":0,"display":"none","boxSizing":"content-box","maxWidth":"none","padding":"8px 12px","fontSize":"13.6px","position":"absolute"},"toggle":{"x":16,"y":508,"w":200.21875,"h":44,"right":216.21875,"bottom":552,"display":"block","boxSizing":"border-box","maxWidth":"none","padding":"1px 6px","fontSize":"13.3333px","position":"absolute"},"custom":{"x":16,"y":204.40625,"w":288,"h":283.59375,"right":304,"bottom":488,"display":"flex","boxSizing":"content-box","maxWidth":"none","padding":"12px 16px","fontSize":"13.6px","position":"absolute"},"hudPillGapPx":8,"hudPillOverlap":false,"toggleUpgradesOverlap":false,"outOfViewport":[]}
768x1024-closed {"viewport":{"w":768,"h":1024},"scroll":{"scrollWidth":768,"clientWidth":768,"bodyScrollWidth":768},"customOpen":"false","hud":{"x":16,"y":16,"w":214.359375,"h":178.40625,"right":230.359375,"bottom":194.40625,"display":"flex","boxSizing":"content-box","maxWidth":"none","padding":"12px 16px","fontSize":"15.2px","position":"absolute"},"users":{"x":578.71875,"y":16,"w":173.28125,"h":44,"right":752,"bottom":60,"display":"flex","boxSizing":"content-box","maxWidth":"320px","padding":"0px","fontSize":"16px","position":"absolute"},"badge":{"x":578.71875,"y":16,"w":173.28125,"h":44,"right":752,"bottom":60,"display":"block","boxSizing":"border-box","maxWidth":"none","padding":"8px 16px","fontSize":"14.4px","position":"static"},"upgrades":{"x":364,"y":666.5,"w":388,"h":341.5,"right":752,"bottom":1008,"display":"flex","boxSizing":"content-box","maxWidth":"352px","padding":"12px 16px","fontSize":"15.2px","position":"absolute"},"toggle":{"x":16,"y":964,"w":200.21875,"h":44,"right":216.21875,"bottom":1008,"display":"block","boxSizing":"border-box","maxWidth":"none","padding":"1px 6px","fontSize":"13.3333px","position":"absolute"},"custom":null,"hudPillGapPx":348.359375,"hudPillOverlap":false,"toggleUpgradesOverlap":false,"outOfViewport":[]}
1280x720-closed {"viewport":{"w":1280,"h":720},"scroll":{"scrollWidth":1280,"clientWidth":1280,"bodyScrollWidth":1280},"customOpen":"false","hud":{"x":16,"y":16,"w":214.359375,"h":178.40625,"right":230.359375,"bottom":194.40625,"display":"flex","boxSizing":"content-box","maxWidth":"none","padding":"12px 16px","fontSize":"15.2px","position":"absolute"},"users":{"x":1090.71875,"y":16,"w":173.28125,"h":44,"right":1264,"bottom":60,"display":"flex","boxSizing":"content-box","maxWidth":"320px","padding":"0px","fontSize":"16px","position":"absolute"},"badge":{"x":1090.71875,"y":16,"w":173.28125,"h":44,"right":1264,"bottom":60,"display":"block","boxSizing":"border-box","maxWidth":"none","padding":"8px 16px","fontSize":"14.4px","position":"static"},"upgrades":{"x":876,"y":362.5,"w":388,"h":341.5,"right":1264,"bottom":704,"display":"flex","boxSizing":"content-box","maxWidth":"352px","padding":"12px 16px","fontSize":"15.2px","position":"absolute"},"toggle":{"x":16,"y":660,"w":200.21875,"h":44,"right":216.21875,"bottom":704,"display":"block","boxSizing":"border-box","maxWidth":"none","padding":"1px 6px","fontSize":"13.3333px","position":"absolute"},"custom":null,"hudPillGapPx":860.359375,"hudPillOverlap":false,"toggleUpgradesOverlap":false,"outOfViewport":[]}
UPGRADE_BUY_HIT {"rect":{"x":70,"y":411.21875,"w":44,"h":44},"topElement":"BUTTON.upgrade-buy","same":true,"disabled":true}
CHECKS [{"label":"375x667-closed","failures":[]},{"label":"375x667-open","failures":[]},{"label":"320x568-closed","failures":[]},{"label":"320x568-open","failures":[]},{"label":"768x1024-closed","failures":[]},{"label":"1280x720-closed","failures":[]}]
ALL_CHECKS_PASS
```

Visual confirmation: at 320×568 the pill text wraps to two lines (`Users on` / `Server`) and grows vertically while the 8px gap holds; the HUD wraps `Faces destroyed` but stays inside its 144px cap. Closed views show the four corners and the usable upgrades panel above the bottom-left toggle; open views show the upgrades panel hidden and the customization panel in its slot. Screenshots listed in the table.

## Acceptance audit

- AC-18 → **met**. Source contract: the single `@media (max-width: 720px)` block (exactly one; no 480px block) now keeps the top band clear with the exact HUD cap calc, `.user-panel` 8.5rem cap and reduced mobile badge padding/font, while the existing bottom-band stacking/hide rules are unchanged. Manual (executed, not just not-run) at 375×667 and 320×568 closed and open: HUD/pill gap 15.75px and 8px respectively, no intersection, `scrollWidth === clientWidth` at both sizes (no horizontal scrollbar), all displayed surfaces inside the viewport, `customization-toggle` does not overlap `.upgrades-panel`, open state hides the upgrades panel, and `.upgrade-buy` is hit-testable at its centre. 768×1024 and 1280×720 are unaffected. Evidence: `game-view.css.test.ts` (28 tests), screenshots/rects above.
- AC-2 → **met**. The base corner rules and their `env(safe-area-inset-*)` offsets are still read from unchanged `app.css`; the base-source no-position guard is unchanged; the new 720px top-band no-position guard proves none of `.hud-panel`, `.user-panel`, `.user-panel > .users-badge` declares `position`/`top`/`right`/`bottom`/`left`. Only sizing/typography declarations were added, and the measured `x/y` of both top corners at 375/320/768/1280 match the base `app.css` offsets (16px / 16px, right edge 359/304/752/1264).
- AC-5 → **met**. The base `.user-panel > .users-badge` exact nine declarations, hover and focus-visible assertions are untouched and green; the mobile-only padding/font override is a separate scoped rule that does not alter the base rule. Manual: pill renders as the red rounded badge with the group icon at all sizes.

## Deviations from spec

None. Only the two owned source files changed; `app.css`, `app.css.test.ts`, components/markup, tasks/status/README, configs, lockfiles and containers are untouched. `README.md` was already modified in the working tree before this task and was not staged or edited.
