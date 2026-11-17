---
feature: game-feel-overhaul
phase: code_review
round: 1
iteration: 1
verdict: changes_requested
reviewed: 2026-11-17
blocking: 2
nonblocking: 4
---

# Code Review — r1 (game-feel-overhaul)

## Summary

❌ **Changes requested — 2 BLOCKER, 1 MAJOR, 3 MINOR, 2 INFO.**

The automated gate is reproducible and green: lint, typecheck, both workspace test suites (backend 1538, frontend 2433), both coverage tables (≥ 96 % / ≥ 89 % on every metric), the budgeted production build, the protected-file diff/status gates and the containerized smoke (28/28). The reviewed tip is the T12 fix `8ff8e71`, based on the squashed feature tip `dcb0573` (= `main`), and T12 is included.

Approval is blocked by two evidence defects, not by the implementation breadth:

1. **F1** — the T11 glossary documentation pass was lost in the squash: `docs/product/glossary.md` still describes the old **wireframe charge-orb** reveal, has no `### reveal stage` term and says 13 CSS-mapped durations instead of 17. The accepted text exists at `af97f5a` but not at `dcb0573`/`8ff8e71`; AC-35 fails at the reviewed tip.
2. **F2** — AC-15's three-run `workMs` traces and AC-34's main-scene frame trace were never executed or recorded. They are honestly marked “not executed — environment” in `build-log-T11.md`, but there is no user/orchestrator waiver. Unrecorded evidence is unmet, and the user's visual “looks awesome” pass does not measure per-frame work. The AC-30 mobile visual rows share this deferral.

A third, non-blocking-but-failing gate (F3, MAJOR) is the session reduced-motion contract: several new animations/transitions still run when `data-reduced-motion='true'` because only the OS media query covers them — most visibly the reveal spotlight on the panel, the crew/connection live dots and the press transitions.

The D-1 section mirror is acceptable as a sanitized, non-authoritative convenience, but it should be retargeted (F4). The rest of the AC table is met.

## AC-by-AC verification

| AC | Result | Evidence |
| --- | --- | --- |
| AC-1 — no protocol/metrics/server change | ✅ | `git diff --exit-code 5ef561e..HEAD -- src/backend compose.yaml compose.smoke.yaml ':(glob)**/Dockerfile' package.json package-lock.json src/frontend/package.json src/backend/package.json` = 0; status clean; no metric change. |
| AC-2 — account grant, opener-only | ✅ | `session.test.ts` exact `{ partId, slot, rarity, duplicate, sequence: 1 }`; second tab only `customizationUpdate` → `lastLootboxGrant === null`; `App.test.tsx` opener/second-tab tests green. |
| AC-3 — guest grant | ✅ | `session.test.ts` guest sequence 1→2, duplicate flip, exact customization, no wire message; insufficient open leaves the grant unchanged. |
| AC-4 — stage factory contract | ✅ | `lootbox-reveal.test.ts`: four children/order, lights, camera, 21 meshes, `RingGeometry(0.86,0.9,48)`, rarity hex, key-light `3.0*(1+flashOpacity)`, no shadows/textures/random, idempotent dispose. |
| AC-5 — try-on, no mutation | ✅ | `lootbox-reveal.test.ts` catalog slot wins over wire slot, staged copy, one `applyAppearance`; panel test keeps the real appearance/parts. |
| AC-6 — pose timeline and slot yaw | ✅ | `reveal-motion.test.ts` 43 tests, 100 % coverage; exact 0/420/670/730/970/1150/1290 rows, ten yaws, reduced rest row, same `out` object. Literal `+Infinity` edge is F6 (MINOR). |
| AC-7 — reveal DOM/card contract | ✅ | `LootboxReveal.test.tsx` exact attribute map, labels/texts, catalog-derived slot, invalid sanitisation (`unknown`/`''`/`0`/`unavailable`), canvas `aria-hidden`, no live region. |
| AC-8 — dismiss/equip/focus | ✅ | Focus to Equip (or Dismiss), Escape/Dismiss once, Equip→onEquip→onDismiss once, 10 s fake timers still mounted; panel restores focus to `Open lootbox`. |
| AC-9 — reduced motion | ✅ | First render `rest`/`data-reduced-motion="true"` even on `idle`; one static frame, no rAF, no flash, no phase timers. |
| AC-10 — WebGL fallback | ✅ | Renderer throw, stage throw and real jsdom `WebGLRenderer` failure → `unavailable` + one inline SVG with catalog `data-slot`; invalid part → sanitised card, no stage. |
| AC-11 — reconnect/status/multi-tab | ✅ | `session.test.ts` welcome + every non-connected status clears and publishes engine then multiplayer; `App.test.tsx` mid-reveal disconnect removes the reveal; second tab null. |
| AC-12 — one context, deferred, budget | ✅ | Panel reveal branch renders `LootboxReveal` only (one canvas); `App.tsx` does not import the reveal/stage; bundle `initial.files` excludes `three`; build budget green. |
| AC-13 — panel close is dismissal | ✅ | Panel unmount cleanup calls `onDismissReveal` once; reopening normal; `App.test.tsx` toggle-click close keeps focus on the toggle. |
| AC-14 — rarity/duplicate/epic flourish | ✅ | Exact rare/epic labels, `data-duplicate`, `Owned ×N`, `New`/`Duplicate`; CSS 45° eight-ray flourish, exact keyframes, reduced-motion off-switch. |
| AC-15 — per-frame work and budget | ❌ | Structural budget met (22 draw calls, 872 triangles, one pose buffer, 30 fps cap/pause/dispose tests), but the three-run `workMs` traces at 1280×720 and 1920×1080 are **not executed — environment** (`build-log-T11.md:383-395`); no waiver. See F2. |
| AC-16 — rollback/no persistence | ✅ | No schema/migration/protocol/storage key; rollback note in `build-log-T11.md`; protected diffs clean. |
| AC-17 — token contract | ✅ | 26 `--gf-*` tokens exact in `app.css :root`; accepted `--panel-*`/theme constants unchanged; `GF_*` mirrors and contrast gates; rarity from `REVEAL_RARITY_HEX`. |
| AC-18 — shared frame | ✅ | Exact 11-selector grouped rule with the eight pinned declarations, no `position`/`filter`/outer shadow; exact relative rule, `::before`/`::after`, chamfer overrides and `:empty` reset; no `!important`. |
| AC-19 — HUD markup/states | ✅ | `Hud.tsx` header/title/level chip, three resource chips, three stat rows, unique `data-stat`, coin pops inside the coins chip, 24 px minimize; minimized grid rule and pre-welcome rows pinned by tests. |
| AC-20 — upgrades markup | ✅ | Title, balance/`data-coins`, `data-affordable`, exact catalog text/levels/effects/costs, `maxLevel` pips, green circular buy button, pulse/reduced-motion retained. |
| AC-21 — customization markup/spotlight | ✅ | `data-reveal-active`, `Spaceship hangar`, `.gf-chip` counts, `Open lootbox` CTA, 10 slots × 3 variants with swatches/rarity, reveal branch only; desktop 721 px and mobile 720 px overrides pinned exactly incl. safe-area and `z-index: 20`. |
| AC-22 — activity feed chrome | ✅ | One `aria-hidden` live dot; six event glyph/colour rules; five-entry cap, `aria-live="off"`, 160 ms entry and reduced-motion variants unchanged. |
| AC-23 — leaderboard chrome | ✅ | Per-row `aria-hidden` medal/bar with `data-medal`/`data-bar`; live dot; rank text/name/score/totals/top-five/server order unchanged; gold/silver/bronze/cyan and 100/80/64/50/40 % bars. |
| AC-24 — users panel chrome | ✅ | `users-badge` label retained, `aria-hidden` count/dot, `Crew` `<h2>` immediately before `<ul>`, self row first, `Return to my cube`, slot order and `data-level`. |
| AC-25 — connection banner | ✅ | `data-status` and one `aria-hidden` dot before the exact copy; `Retry`; no live region; dot/chip colours and media-query pulse off. |
| AC-26 — auth chrome | ✅ | Void + two radial pools + scanline scrim; shared 1.1 rem auth chamfer; uppercase wordmark; amber primary; glass secondary; inset inputs; danger error; auth markup/tests unchanged; 48/44 px. |
| AC-27 — ambience/layering, non-modal | ✅ | One ambience layer; canvas 0, ambience 2, panels/controls 3, level 5, reveal 20, toggle 21, auth 100; no scrim, no `main[data-reveal-active]`; T12 did not change layers. |
| AC-28 — control states | ✅ | `.gf-cta` amber/44 px/hover/active/focus/disabled exact; secondary controls 44 px/focus/disabled/radius; circular buy shape. F5 notes the `.users-badge` 999 px versus `--gf-radius-control` spec inconsistency. |
| AC-29 — typography/headings | ✅ | Title/level/resource/button roles exact in `app.css`; real `h1`/`h2` headings and panel aria-labels; body stack unchanged; `game-view.css` does not duplicate the block. |
| AC-30 — responsive fit | ✅ | 720 px band, upgrades hide rule, feed/leaderboard tops, reveal safe-area bottom sheet and 721 px 34 rem spotlight pinned by tests; T12 sets rail top 16 rem with a 45 px desktop HUD clearance. Mobile 320/375 and 768 visual rows are not executed (same deferral as F2). |
| AC-31 — accessibility/live region/contrast | ❌ | Contrast gates and the single settled-shell polite region pass (App tests, explicit exemptions), all decorative spans `aria-hidden`, 44 px controls. But session reduced motion is incomplete (F3): several new animations/transitions remain active under `data-reduced-motion='true'`. |
| AC-32 — motion tokens | ✅ | All 12 tokens exact in `MOTION`; the four `--motion-ui-*-ms` declarations equal `${MOTION.<token>}ms`; the 13 accepted mappings remain. |
| AC-33 — no external assets/deps | ✅ | No `url(http`, `@font-face`, `data:image`, external import or `<img>` in either stylesheet; package/lockfile/workspace manifests protected and unchanged. |
| AC-34 — render/bundle budget | ❌ | Build budget green (99,966 / 154,617 / 280,748 B gzip); no main-scene rAF/render/light/post/tier change. The required main-scene frame trace with the panel open is **not executed — environment**; see F2. |
| AC-35 — documentation | ❌ | README exact phrases/controls and `frontend-rendering.md` sections/qualified loop wording pass. Glossary fails: old wireframe definition, no `### reveal stage`, 13 instead of 17 durations (F1). |
| AC-36 — coverage | ✅ | `npm run coverage` exit 0; backend 96.2/89.92/99.57/96.2, frontend 96.84/96.53/98.04/96.84; new modules included; no exclusion/threshold change. |
| AC-37 — full gates | ✅ | Lint, typecheck, test, coverage and build exit 0; smoke 28/28 recorded/rerun. |
| AC-38 — container impact none | ✅ | Compose files, Dockerfiles, ports, env and `/ws` unchanged; protected gate clean; single-command local run unaffected. |

## Findings

| ID | Severity | Location | Finding / why it matters | Required action |
| --- | --- | --- | --- | --- |
| F1 | **BLOCKER** | `docs/product/glossary.md:83-86`, `:95`; feature tip `8ff8e71`/`dcb0573` vs `af97f5a` | The T11 glossary pass was lost in the squash. `lootbox reveal` still describes the 1290 ms **wireframe charge / orb** reveal, there is no `### reveal stage` term, and `motion token` says 13 CSS-mapped durations (actual: 17). AC-35 explicitly requires the 3D description and the new term. The accepted text exists at `af97f5a:docs/product/glossary.md`, but not at the reviewed tip. | Reapply the exact glossary diff from `af97f5a` (updated `lootbox reveal`, new `### reveal stage`, motion-token count 17) on the feature branch/main and re-run the T11 doc gates at the reviewed tip. |
| F2 | **BLOCKER** | `docs/features/game-feel-overhaul/build-log-T11.md:383-395`; `spec.md` AC-15/AC-34/AC-30 | AC-15 requires three clean 10-second `workMs` traces per size at 1280×720 and 1920×1080 (mean ≤ 16.7 ms, p95 ≤ 33 ms, at least two of three pass, median named); AC-34 repeats the main-scene trace with the customization panel open. The log records them as **not executed — environment**. “Unable to verify” counts as unmet; the user's visual pass does not measure per-frame work, and no explicit waiver exists. | Run the traces on a GUI host and append the raw values to `build-log-T11.md`, or record an explicit user/orchestrator waiver (naming AC-15 and the AC-34 main-scene trace) in `status.md`/this review. Do not claim them as passed until one of those exists. |
| F3 | **MAJOR** | `src/frontend/src/ui/game-view.css:287-298` (`.gf-live-dot`), `:995-1012` (`.connection-dot`), `:456-478` (`.customization-toggle` transitions), `:374-405` (`.upgrade-buy` transitions), `:481-484` (reveal spotlight) | AC-31 requires both `prefers-reduced-motion` and the session `data-reduced-motion='true'` to disable **every** new animation/transition. Only the OS media block covers the crew/connection dot pulses, toggle/buy press transitions and the reveal spotlight on the panel; `UserPanel`/`ConnectionBanner` have no `reducedMotion` prop/data attribute, and the reveal root's `data-reduced-motion='true'` cannot disable the parent panel's spotlight. HUD minimize/coin-pop also lack a session variant. The T11 fix (`f723b7e`) addressed only the ambience. | Propagate the session reduced-motion marker to the affected surfaces (e.g. a root/`main` attribute or per-component data attribute) and add CSS rules disabling these animations/transitions; add tests that render with `reducedMotion: true` and assert the disabled state. |
| F4 | MINOR | `src/frontend/src/ui/SpaceshipCustomizationPanel.tsx:294-303`; `src/frontend/src/App.test.tsx:1636-1645`, `:1722-1725` | D-1: the section mirrors sanitized grant attributes so the pre-existing App query (`[data-reveal-active="true"]`, first match = section) stays green. The mirror is catalog-derived, sanitized and not forbidden by AC-7/AC-21, so it is acceptable; it is not part of the AC contract and duplicates the reveal identity. | Retarget the App assertions to `.lootbox-reveal` (the AC-7 authority) and drop the section mirror in a follow-up; keep the panel test on the reveal root. |
| F5 | MINOR | `src/frontend/src/ui/game-view.css:216-227`; `spec.md` AC-28 | AC-28 names `.users-badge` under `border-radius: var(--gf-radius-control)`, but the accepted crew pill keeps `999px` (the per-surface table calls it a “crew pill” and the prior CSS was 999px). The spec is internally inconsistent; the implementation is deliberate and visually correct. | Clarify AC-28 (pill radius for `.users-badge`) or change the CSS/test to `var(--gf-radius-control)`; do not leave the acceptance text contradicting the shipped contract. |
| F6 | MINOR | `src/frontend/src/game/reveal-motion.ts:121-126`; `reveal-motion.test.ts:180-207` | AC-6 says values `> 1290` clamp to 1290; `normalizeElapsed` maps every non-finite value, including `+Infinity`, to 0 ms. The build log records the infinity-to-0 decision, but the literal AC says otherwise. Unreachable from `performance.now()` and untested, so this is an edge-case contract drift. | Clamp `+Infinity` to 1290 (and `-Infinity`/NaN to 0) or record a spec clarification; add the boundary test either way. |
| F7 | INFO | `build-log-T11.md:265-317`; `build-log-T12.md` | My `npm run smoke` rerun passed 28/28 but used the cached T11 `frontend-prod` image (`index-Dh282Nod.js`), not a T12 rebuild. AC-37 is structurally satisfied (no backend/container change), but the current CSS artifact was not what smoke served. | Rebuild the smoke frontend image before claiming the tip's artifact was smoke-tested; not required for this CSS-only T12 if the T11 image provenance is stated. |
| F8 | INFO | `src/frontend/src/ui/app.css:551-554`; `game-view.css:680-691` | The pre-existing `main > section button::before { content: '▾'; }` applies to every button inside a direct `<section>` of `<main>`, so the customization and new reveal buttons inherit the HUD arrow glyph. This predates the feature but the new reveal controls expose it more. | Visual check in the manual browser pass; if confirmed, scope the glyph to the HUD minimize control (or reset it on customization/reveal buttons) in a follow-up. |

## Gate reproduction

Commands run from the repository root on `feat/game-feel-overhaul` at `8ff8e71`.

| Command / gate | Result |
| --- | --- |
| `npm run lint` | exit 0, no findings |
| `npm run typecheck` | exit 0, both workspaces |
| `npm test` | exit 0 — backend 37 files / 1538 tests; frontend 78 files / 2433 tests |
| `npm run coverage` | exit 0 — backend 96.2 / 89.92 / 99.57 / 96.2; frontend 96.84 / 96.53 / 98.04 / 96.84 (statements / branches / functions / lines) |
| `npm run build` | exit 0 — initial 99,966 B, three 154,617 B, total 280,748 B gzip vs 150,000 / 165,000 / 300,000; `Bundle budget OK` |
| `npm run smoke` | exit 0 — `SMOKE PASS (28/28 checks)` (cached T11 `frontend-prod` image; see F7) |
| Protected diff/status gates (`BASE=5ef561e`, the presence squash equivalent to the recorded `36d03e7` base) | exit 0 for backend/compose/Dockerfiles/package/lockfile/workspace manifests; exit 0 for the protected render/engine/multiplayer/main/auth set; `docs/features/README.md` status clean |
| README doc greps | PASS: `animated 3D lootbox reveal`, `Neon Forge HUD`, `chamfered graphite-glass HUD panels with cyan energy rims and amber reward accents`, `granular spaceship parts`, `detailed blue/orange hero spaceship`; ABSENT: `rounded translucent cyan HUD panels`, `wireframe charge-orb reveal` |
| `frontend-rendering.md` doc greps | PASS: `## Lootbox reveal stage`, `## Game shell layering`, `one additional bounded 30 fps loop`, `The session owns the requestAnimationFrame loop for the Three.js game scene`; ABSENT: `The session owns the only` |
| Glossary doc greps | **FAIL**: no `### reveal stage`; `lootbox reveal` still says wireframe charge/orb; `motion token` says 13 durations (F1) |
| `docs/features/README.md` ownership | unchanged across the feature (only the presence row, authored by the merged presence feature); game-feel row correctly left to the orchestrator |

## Quality, security, real-time and docs checks

- **Banned/weak assertions:** no snapshot-only, assertion-free or wildcard matchers in the feature tests. The only `toHaveBeenCalled()` occurrences in the changed suites are precise negative `.not.toHaveBeenCalled()` assertions (zero calls); the pre-existing bare `toHaveBeenCalled()` lines in `session.test.ts` are outside this feature's new blocks. No coverage exclusion or threshold change was made; only the pre-existing justified `src/main.tsx` entrypoint exclusion remains.
- **Security:** no secrets, credentials, new dependency, external asset or `dangerouslySetInnerHTML`; no protocol/backend/metric change; the reveal sanitises the wire `slot`/`partId` and never inserts server strings as markup.
- **Real-time/cross-client:** the opener-only `lootboxOpened` path is unchanged; the second tab receives only `customizationUpdate` and never gets a grant; a non-connected status and `welcome` clear the grant and publish the engine snapshot before the multiplayer store, so the reveal cannot survive a reconnect. The presence merge is base content, not a feature edit.
- **Containerization contract:** `compose.yaml`, `compose.smoke.yaml`, both Dockerfiles, ports, environment variables, health signals and `/ws` are unchanged; `podman compose up` remains the single-command local path; the frontend image absorbs the CSS/JS change through its existing build.
- **Documentation pass:** README and `docs/architecture/frontend-rendering.md` satisfy AC-35. The glossary does not (F1); this is a stale-doc regression at the reviewed tip, not merely a missing prose update.
- **Feature artifacts/links:** T1–T12 build logs are present; T12 is committed in `8ff8e71`; spec-review r1/r2/r2a artifacts resolve; `docs/features/README.md` is intentionally untouched; the untracked `docs/features/hangar-tabs-and-menu-motion/` directory belongs to the next feature and is out of scope.

## Branch-state note

- Actual branch/tip verified: `feat/game-feel-overhaul` = `8ff8e71`, parent `dcb0573` = `main`. T12 (`game-view.css`, its test, `build-log-T12.md`) is included and is the only diff from `dcb0573`.
- The original long-lived feature tip `af97f5a` is not an ancestor of `main`; `git diff --stat af97f5a dcb0573` differs only in `docs/features/game-feel-overhaul/status.md` and `docs/product/glossary.md`. The code/test tree is identical. The glossary difference is the F1 regression; the status difference is the later T12/T11 state.
- `git merge-base main HEAD` now returns `dcb0573`, so AC-1's literal `BASE=$(git merge-base main HEAD)` command is trivially empty at this tip. I verified the protected gates against the pre-squash presence base (`5ef561e`, tree-equivalent to the recorded `36d03e7`) and the feature-only diff range; those gates are clean.
- The working tree also contains orchestrator-owned uncommitted `status.md`/`tasks.md` edits and the untracked next-feature artifacts; neither is part of the reviewed source diff.

## Manual-evidence disposition (explicit)

AC-15 and the AC-34 main-scene trace are **unmet**, not deferred by this review. The build log's “not executed — environment” is honest and should be preserved, but it is not evidence and not a waiver. Approval requires either:

1. the raw three-run `workMs` traces at both sizes plus the main-scene trace, appended to `build-log-T11.md`, or
2. an explicit user/orchestrator waiver naming AC-15 and the AC-34 main-scene trace and recorded in `status.md`/this review.

The user's manual visual pass (“looks awesome”) and the T12 leaderboard fix are valuable visual evidence, but they do not satisfy a per-frame performance criterion. AC-30's 320×568 / 375×667 / 768×1024 visual rows share the same environment limitation and should be covered by the same deferral/waiver.

## D-1 ruling

The panel section's mirrored `data-part-id` / `data-slot` / `data-rarity` / `data-duplicate` attributes are **acceptable as a sanitized, non-authoritative convenience** for the pre-existing App-level query: they are catalog-derived, never copy the raw wire values, and AC-7/AC-21 do not forbid extra attributes on the section. They are not part of the AC contract, however, and the App tests should target `.lootbox-reveal` (the AC-7 authority) so the reveal root, not the section, remains the single source of the rendered identity. Retarget/remove in a follow-up (F4); this is not a blocker for the current build.

## Verdict

**`changes_requested`** — F1 (glossary/AC-35) and F2 (AC-15/AC-34 manual traces) are open BLOCKERs; F3 (AC-31 session reduced motion) is an open MAJOR. F4–F6 are MINOR cleanup/spec-consistency items; F7–F8 are INFO. The automated gate and the D-1 interpretation are otherwise sound and reproducible.
