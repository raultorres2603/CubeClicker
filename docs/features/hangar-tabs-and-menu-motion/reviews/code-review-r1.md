---
feature: hangar-tabs-and-menu-motion
phase: code_review
round: 1
iteration: 1
verdict: approved
reviewed: 2026-11-17
blocking: 0
nonblocking: 2
---

# Code Review — r1

## Summary

✅ **approved** — all 29 acceptance criteria are met against the branch (`2c16983`, code `e8eff72`); the executable gate was independently reproduced green (lint, typecheck, backend 1538 / frontend 2505 tests, coverage, build, smoke 28/28). AC-24 is met under the explicit user waiver recorded in `status.md` (§ Loop log, 2026-11-17) and `build-log-T5.md` § AC-24 trace waiver: the visual/motion pass plus the structural/bundle evidence are accepted, and no trace table is claimed as passed.

The five-tab hangar, the CSS boot on exactly the hangar and crew list, the reduced-motion specificity fix (including the pre-existing `reveal-spotlight` OS gap), the screenshot polish and the T3 r2a `App.test.tsx` two-hunk rewrite are consistent with the spec and the task board. Two non-blocking follow-ups are recorded below; readiness for acceptance is limited to the orchestrator-owned index row plus committing the board/status updates and this review.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `ui/hangar-tabs.ts:32-76` pins the five tabs/labels/slots and `tabForSlot`/`tabOwnedCount`; `ui/hangar-tabs.test.ts` asserts the exact table, set equality against `SLOT_CATALOG` (`:104-113`), per-tab catalog order (`:115-120`), the throw cases (`:156-161`), the legacy counts 2/2/1 (`:234-250`) and module purity (`:253-269`). |
| AC-2 | ✅ | `SpaceshipCustomizationPanel.tsx:486-525` renders one `role="tablist"` with five buttons, exact ids/`data-tab`/`aria-selected`/`tabindex`/`aria-label` and one `aria-hidden` badge; `SpaceshipCustomizationPanel.test.tsx:341-441` asserts the jsdom and SSR contracts and no `aria-controls`. |
| AC-3 | ✅ | `SpaceshipCustomizationPanel.tsx:526-535` renders one `role="tabpanel"` with the stable `id`, `data-tabpanel`, `aria-labelledby` and no `tabindex`; test `:443-514` asserts one panel, two rows per tab, three variants per row and the ten-slot union. |
| AC-4 | ✅ | `SpaceshipCustomizationPanel.tsx:345-378` implements Arrow/Home/End with `preventDefault`, selection and focus; test `:518-637` asserts same-commit selection, wrap, `defaultPrevented === true`, unchanged panel `scrollTop`, preview identity and zero handler calls. See F1 for the unasserted `<canvas>` node detail. |
| AC-5 | ✅ | Badge wiring at `SpaceshipCustomizationPanel.tsx:493,505,514-521`; test `:682-788` asserts `0/4…4/4`, the exact accessible names, standard/unknown exclusion and the normalized legacy values `wings = 2`, `ignitions = 2`, `frame = 1`. |
| AC-6 | ✅ | Render-phase derivation at `SpaceshipCustomizationPanel.tsx:285-302`; `observeLanding` `MutationObserver` proof (`test:281-338`) asserts exactly one `data-active-tab` mutation and one tabpanel for wings, hull and unknown parts, plus the frame default/reset (`:792-814`). |
| AC-7 | ✅ | `game-view.css:446-535` declares the sticky strip, no panel overflow and the `min(12rem, 26vh)` / `8rem` preview; `game-view.css.test.ts:1037-1067` asserts the accepted `app.css` panel body, the short-viewport override and no nested scroll rule. |
| AC-8 | ✅ | `SpaceshipCustomizationPanel.tsx:538-548` keeps `LootboxReveal` as the only reveal content; test `:1328-1370` asserts no tablist/tabpanel/tab/preview/`data-active-tab` while revealing; the accepted reveal suite still passes unchanged in behaviour. |
| AC-9 | ✅ | `game-view.css:470-520` pins the 44 px chip, hover, focus-visible and selected states plus the badge metrics; `game-view.css.test.ts:935-1014` asserts the exact bodies and no literal colour, and `:2508-2551` asserts the computed tab/badge styles. |
| AC-10 | ✅ | Full rewritten panel suite: `SpaceshipCustomizationPanel.test.tsx:890-1130` keeps the variant/equip/unequip/44 px/legacy matrix; `:1169-1232` asserts 10 + 10 = 20 controls for the empty inventory and 30 + 10 = 40 for the all-owned fixture. No pre-feature assertion is deleted without a replacement. |
| AC-11 | ✅ | `game/motion.ts:119-124` adds the four tokens without changing accepted values (`motion.test.ts:109-147` pins 96 keys and the four values); `game-view.css:55-58` mirrors them on `main`; `game-view.css.test.ts:1962-2020` asserts `21` mappings, no `:root` motions and each `MOTION` pair. |
| AC-12 | ✅ | `game-view.css:1483-1560` declares the four hangar beats and their keyframes; `game-view.css.test.ts:1120-1203` pins every stop, the exact animation declarations and the no-`transform`/`filter`/`clip-path`/`margin`/`left` sweep (`:1130-1162`). |
| AC-13 | ✅ | `game-view.css:1485-1500` applies the four beats to `.user-panel .users-list` and its title; `UserPanel.test.tsx:350-386` asserts unmount/remount replay, `aria-expanded` and `vi.getTimerCount() === 0` across the cycle. |
| AC-14 | ✅ | `game-view.css.test.ts:1205-1266` enumerates the only four boot rules, sweeps the ten banned surfaces clean, and confirms reveal-state rules carry no `menu-*` beat while `game-view.css:591-605` keeps `reveal-spotlight`. |
| AC-15 | ✅ | `.customization-tabpanel` animation at `game-view.css:523`; keyframes `:1562-1570`; keyed panel at `SpaceshipCustomizationPanel.tsx:526-535`; `SpaceshipCustomizationPanel.test.tsx:641-678` asserts a new panel per switch, persistent strip/preview and no timer/closing state. |
| AC-16 | ✅ | No exit keyframe or reverse direction (`game-view.css.test.ts:1164-1171`), no closing state/timer (`SpaceshipCustomizationPanel.test.tsx:668-678`, `UserPanel.test.tsx:350-386`) and the reveal dismissal suite still passes. |
| AC-17 | ✅ | Single OS block `game-view.css:1760-1816` and single extended session block `:1735-1757` carry every scoped selector; `game-view.css.test.ts:2085-2192` asserts one of each, the equal-or-higher specificity for every producing rule (including the previously broken `reveal-spotlight`) and declaration-before-media order; `:2279-2373` cascades both onto real markup. `App.tsx` unchanged and its `<main data-reduced-motion>` assertions pass. |
| AC-18 | ✅ | Negative sweep `game-view.css.test.ts:1130-1162`; no `!important` in the stylesheet; the layer table and reveal placement are unchanged (`:1817-1841`); the boot/animation tests confirm the settled state has no running menu animation. |
| AC-19 | ✅ | Additive grouped rule `game-view.css:1590-1596` and the four `::-webkit-*` rules `:1599-1623`; `game-view.css.test.ts:1308-1345` asserts the exact declarations, one rule per surface and one rule per pseudo-part, with the accepted bodies untouched. |
| AC-20 | ✅ | `.user-panel > .users-badge` / `:hover` and `.users-count` at `game-view.css:252-280`; `game-view.css.test.ts:585-613` asserts the rewritten exact bodies and both `--users-badge-*` tokens still declared and consumed once; `:2447-2477` cascades the 44 px pill and white count onto markup. |
| AC-21 | ✅ | `.hud-panel > button` and the `▴` minimized glyph at `game-view.css:137-161`; `game-view.css.test.ts:1270-1302` pins the 24 px (not 44 px) control, the hover/focus state and `app.css`'s retained `▾`; `:2553-2575` asserts the computed size; `app.css`/`app.css.test.ts` unchanged and `Hud.test.tsx` passes. |
| AC-22 | ✅ | `.customization-tabs` grid `game-view.css:446-462`, chip tokens/uppercase `:465-490`, ≤720 px stacked override `:1672-1679`; `game-view.css.test.ts:884-935,1016-1035` assert the grid, the 320 px three-track arithmetic and the stacked override; the mobile panel rules are untouched. |
| AC-23 | ✅ | Reproduced `npm run build`: initial 99,970 B ≤ 150,000; three 154,617 B ≤ 165,000; total 281,381 B ≤ 300,000; `dist/bundle-report.json` initial files are only the entry + React chunks; `SpaceshipCustomizationPanel-6AKSL-yz.js` is a manifest dynamic entry and the only chunk containing the tab markup; package/lock manifests clean. |
| AC-24 | ✅ (under waiver) | Explicit user waiver in `status.md` (2026-11-17 loop entry) and `build-log-T5.md` § AC-24 trace waiver (committed `2c16983`): the visual/motion pass plus structural/bundle evidence are accepted; no trace table is claimed as passed. Structural half reproduced: no added `requestAnimationFrame`/`WebGLRenderer`/quality-tier code, CSS-only boot, one preview context (T3 tests), deferred chunk and the build bytes above. |
| AC-25 | ✅ | Reproduced `npm run coverage`: backend 96.2 / 89.92 / 99.57 / 96.2 and frontend 96.86 / 96.52 / 98.06 / 96.86 (statements / branches / functions / lines), all ≥ 80; `hangar-tabs.ts` 100%; vitest configs unchanged and no exclusion/threshold change. |
| AC-26 | ✅ | Exact greps pass for `tabbed spaceship hangar` and `glitch boot animation` (plus the four retained phrases); `frontend-rendering.md` has `## Menu motion` with all five keyframes, the four tokens/mirrors, 320/140 ms, open-only, no-transform and the tab structure, with the layering table unchanged; glossary has `### hangar tab` and the 21-mapping `motion token`; `docs/features/README.md` untouched and other feature docs clean. |
| AC-27 | ✅ | `compose.yaml`, `compose.smoke.yaml`, both Dockerfiles and the backend `/ws` path are diff/status clean; the smoke recipe runs the containerized stack with the unchanged frontend image build and bundle gate. |
| AC-28 | ✅ | `src/backend` and `src/frontend/src/multiplayer` diff/status clean; `hub.test.ts`, `session.test.ts` and `server-state.test.ts` pass unchanged in the root run; tab/badge/boot state is client-local presentation only. |
| AC-29 | ✅ | Lint/typecheck/test/coverage/build/smoke all exit 0; protected paths status-clean; `git diff --check` exit 0; `App.test.tsx` differs only in the two T3-owned r2a hunks (`:1670` activates the Wings tab before the equip click; `:1757` expects the default tab's 6 variants), with every other assertion unchanged. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | `src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx:641-666` | AC-4 asks for the `.spaceship-preview` element **and its `<canvas>`** to be the same DOM node across a tab switch; the test asserts only the preview element identity (the canvas node is structurally preserved because the preview is not remounted, but it is not explicitly asserted). | Optional follow-up: add a canvas-node identity assertion to the existing preview-identity test, or record that preview identity implies the child canvas. No behaviour change required. | open (non-blocking) |
| F2 | INFO | `docs/features/hangar-tabs-and-menu-motion/status.md`, `tasks.md`, `reviews/code-review-r1.md`; `docs/features/README.md` | The status/task board updates and this review are uncommitted at the reviewed tip; the `docs/features/README.md` row remains orchestrator-owned and pending. | Include the board updates and this review in the acceptance commit; the orchestrator applies only this feature's index row. No source change. | open (non-blocking) |

## Verification performed

- `npm run lint` → exit 0, no output.
- `npm run typecheck` → exit 0 for both workspaces.
- `npm test` → backend 37 files / **1538 tests** passed; frontend 79 files / **2505 tests** passed; exit 0.
- `COLUMNS=220 npm run coverage` → exit 0; backend **96.2 / 89.92 / 99.57 / 96.2**, frontend **96.86 / 96.52 / 98.06 / 96.86** (statements / branches / functions / lines); `hangar-tabs.ts` **100 / 100 / 100 / 100**; `src/frontend/vitest.config.ts` and `src/backend/vitest.config.ts` unchanged from `544cce8`, thresholds still 80.
- `npm run build` → exit 0; initial **99,970 B** (budget 150,000), three **154,617 B** (165,000), total **281,381 B** (300,000); `dist/bundle-report.json` initial files `assets/index-*.js` + `assets/react-*.js`; manifest dynamic entry `src/ui/SpaceshipCustomizationPanel.tsx` → `assets/SpaceshipCustomizationPanel-6AKSL-yz.js`; the string `Spaceship part groups` occurs only in that deferred chunk (0 in the entry/React/three/cursor/browser-env chunks).
- `npm run smoke` → exit 0, **SMOKE PASS (28/28 checks)**, including two live WebSocket clients, presence/leaderboard/activity, auth + Mailpit, metrics and the production delivery/caching checks.
- Protected gates → `git diff --exit-code 544cce8...HEAD -- src/backend compose.yaml compose.smoke.yaml ':(glob)**/Dockerfile' package.json package-lock.json src/frontend/package.json src/backend/package.json src/frontend/src/multiplayer src/frontend/src/ui/app.css src/frontend/src/ui/app.css.test.ts src/frontend/src/App.tsx` exits 0; status empty for those paths, `src/frontend/src/render`, `game/engine.ts`, `main.tsx` and `docs/features` outside this feature; `docs/features/README.md` status empty.
- Doc greps → all AC-26 exact strings present (`tabbed spaceship hangar`, `glitch boot animation`, the four retained README phrases, `## Menu motion`, `menu-boot`, `menu-scan`, `menu-rail`, `menu-chroma`, `tab-panel-in`, `menuBootMs`/`menuFlickerMs`/`menuChromaMs`/`tabSwitchMs`, `### hangar tab`, `### motion token`).
- `git diff --check` → exit 0.
- Manual evidence → user visual/motion pass recorded "It works well" for tabs, boot, polish, responsive and reveal; AC-24 traces not captured and explicitly waived (status + build log), with no trace table claimed.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No user-controlled input, persistence, secret, dependency, external asset, `innerHTML`/`eval`/`fetch` or loader added; badges derive from the client's normalized inventory; unknown part ids are ignored and unknown slots throw only in test/build-time code. |
| Quality | ✅ | No banned matchers, snapshots, assertion-free or tautological tests in the changed suites; no `!important`; no coverage exclusion/threshold change; no new rAF/WebGL/quality code; only the hangar and crew list reference `menu-*`; reduced motion is specificity-safe with source-order guards; no `transform`/`filter`/`backdrop-filter`/`clip-path`/`will-change` on the boot surfaces. The one MINOR is the AC-4 canvas identity assertion (F1). |
| Testing | ✅ | 1538 backend + 2505 frontend tests, coverage ≥ 80 in both workspaces, concrete expected values throughout, legacy normalization and the 20/40 control fixtures covered, SSR + jsdom tab contracts, MutationObserver single-commit landing proof, zero-timer crew/tab checks. AC-24 is waived, not claimed. |

## Real-time / containerization / documentation

- **Real-time:** ✅ unchanged — no protocol, server, persistence or data-flow edit; presence, reveal, feed and leaderboard suites pass; two tabs remain two members; tab/badge/boot state never leaves the client.
- **Containerization:** ✅ unchanged — no service, image, port, environment variable or health signal change; smoke 28/28 against the containerized stack; the frontend image absorbs the CSS/TS diff through the existing Vite build/bundle gate.
- **Documentation:** ✅ complete for the behaviour change — root `README.md`, `docs/architecture/frontend-rendering.md` (`## Menu motion`) and `docs/product/glossary.md` in the same change; no other feature's artifacts touched; the `docs/features/README.md` row is proposed in `build-log-T5.md` and left to the orchestrator (F2).

## Previous round verification

Iteration 1 — no earlier code-review findings. The spec gate (`spec-review-r2.md`) approved with 0 blocking and its F1–F16 fixes are reflected in the implementation (set-union catalog, legacy badge values, keyframe geometry, scoped reduced motion, 20/40 counts, no `aria-controls`, pinned stops, App rebase/r2a, render-phase landing, `preventDefault`, tab metrics, docs, two-session T4).

## Verdict

**approved** — no open BLOCKER or MAJOR. AC-1…AC-29 are met, with AC-24 under the recorded user waiver and no unrecorded trace claimed. Ready for acceptance; the only remaining actions are the orchestrator-owned `docs/features/README.md` row update and committing the `status.md`/`tasks.md` board updates plus this review artifact (F2). F1 is an optional test-strength follow-up and does not block.

## Notes / backlog (non-blocking)

- F1 — assert the preview `<canvas>` node identity explicitly in the existing AC-4 test (optional).
- F2 — commit the board/status/review files and apply only this feature's index row on acceptance.
