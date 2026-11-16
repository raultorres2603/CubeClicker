---
feature: game-feel-overhaul
state: blocked
spec_review_round: 2
build_round: 0
created: 2026-11-16
updated: 2026-11-16
---

# Status — Game-Feel Overhaul

## Summary

Raise the game's presentation quality: a 3D lootbox-reveal animation that showcases the won item on the player's spaceship (like the customization visualizer), and a UI overhaul that makes the game feel less like a simple web page and more like a game. Raw request: "Also, when openning a lootbox, it should have an animation of showing the item you won, in 3D, like customization visualizer with the space ship itself" and "Also, I would like to improve UI to make it more \"game\" looking, it seems very simple."

## Task board

- [x] T1 — Reveal motion tokens and pure pose function `[seq]`
- [x] T2 — 3D reveal stage factory `[P]`
- [x] T3 — Reveal React component `[seq]`
- [x] T4 — Session grant lifecycle `[P]`
- [x] T5 — Customization panel reveal integration `[seq]`
- [x] T6 — Neon Forge tokens, shared frame, auth/shell CSS `[seq]`
- [x] T7 — Neon Forge gameplay CSS, ambience and reveal spotlight `[seq]`
- [x] T8 — HUD and app-shell markup `[seq]`
- [x] T9 — Upgrades, users and connection markup `[P]`
- [x] T10 — Activity feed and leaderboard markup `[P]` — 2 stale `App.test.tsx` strings belong to T8
- [>] T11 — Verify & integrate (documentation + full gates) `[seq]`

## Loop log

- 2026-11-16 — created → PLANNING — request: 3D lootbox reveal + game-like UI overhaul.
- 2026-11-16 — planning → spec_review — planner completed spec/plan/tasks r1 after final consistency edits (38 ACs, 11 tasks); reveal reuses the existing server-authoritative `lootboxOpened` grant; UI direction proposed as "Neon Forge" — `spec.md`, `plan.md`, `tasks.md`
- 2026-11-16 — spec_review → planning — changes_requested r1 (2 BLOCKER, 13 MAJOR, 5 MINOR) — `reviews/spec-review-r1.md`
- 2026-11-16 — planning → spec_review — planner applied r2: inset-only depth/glow, non-modal no-scrim reveal, no reveal live region, `RevealUiPhase` mapping, spotlight overrides, testability fixes, T11 gates; final consistency pass completed — `spec.md` r2
- 2026-11-16 — spec_review → escalated — changes_requested r2 (2 MAJOR, 8 MINOR); r1 findings fixed but mobile reveal safe-area/z-index pinning and App-test acceptance ownership remain; spec-review budget exhausted — `reviews/spec-review-r2.md`
- 2026-11-16 — escalated → planning — user authorized a targeted fix + verification for the two MAJORs — user decision
- 2026-11-16 — planning → spec_review — planner applied r2a: mobile safe-area/z-index pinned, App-level AC ownership moved to T8, eight minors applied; spec revision 3 — `spec.md` r3
- 2026-11-16 — spec_review → awaiting_approval — targeted r2a verification approved (0 blocking, 1 INFO); spec ready for checkpoint Q-1…Q-18 — `reviews/spec-review-r2a.md`
- 2026-11-16 — awaiting_approval → building — user approved the spec and all Q-1…Q-18 defaults (Neon Forge, 3D reveal, no sound, non-modal, one feature) — user decision
- 2026-11-16 — building T1 started — reveal motion tokens + pure pose function — `tasks.md` T1
- 2026-11-16 — building T1 completed — commit `4421351`; 12 motion tokens, exact 1290 ms pose timeline; frontend 2306 tests, coverage 96.67/96.37/97.82/96.67; `reveal-motion.ts` 100% — `build-log-T1.md`
- 2026-11-16 — building T2 + T4 started — parallel-safe batch: 3D reveal stage ∥ session grant lifecycle — `tasks.md` T2/T4
- 2026-11-16 — building T4 completed — commit `f01c8b0`; grant cleared on welcome/rejoin and every non-`connected` status, engine snapshot published; frontend 2315 tests, coverage 95.55/96.37/97.82/95.55 — `build-log-T4.md`
- 2026-11-16 — building T2 completed — commit `cfb7d96`; 4-child scene, 22 draw calls, 872 triangles, pose/key-light writes, dispose-once; frontend 2331 tests, coverage 96.71/96.39/97.83/96.71; `lootbox-reveal.ts` 100% — `build-log-T2.md`
- 2026-11-16 — building paused — T3 is next; presence branch work resumes first to avoid cross-branch checkout races
- 2026-11-16 — building T3 completed — commit `3acba32`; reveal component: non-live, one WebGL context/30 fps loop, phase mapping, fallback, focus, sanitization; frontend 2370 tests, coverage 96.73/96.35/97.87/96.73 — `build-log-T3.md`
- 2026-11-16 — building T5 started — customize panel reveal integration, `data-reveal-active`, Equip/unmount dismissal, focus restore — `tasks.md` T5
- 2026-11-16 — building T5 completed — commit `763bf3e`; reveal/normal branches, rarity swatch, Equip/unmount/focus behavior, 43 panel tests; frontend 2385 tests, coverage 96.74/96.44/97.86/96.74; bundle budget OK — `build-log-T5.md`
- 2026-11-16 — building T6 started — Neon Forge tokens, shared frame, auth/shell CSS — `tasks.md` T6
- 2026-11-16 — building T6 completed — commit `0680393`; 26 `--gf-*` tokens, shared frame, auth shell, contrast gates; frontend 2350 tests, coverage 96.74/96.44/97.86/96.74; bundle budget OK — `build-log-T6.md`
- 2026-11-16 — building T7 started — gameplay CSS, ambience, reveal spotlight, mobile/reduced-motion rules — `tasks.md` T7
- 2026-11-16 — building T7 completed — commit `07dd9fb`; spotlight layering/safe-area, ambience, glyphs, minimized HUD; frontend 2362 tests, coverage 96.74/96.44/97.86/96.74; bundle budget OK — `build-log-T7.md`
- 2026-11-16 — building T9 + T10 started — parallel-safe markup batch: upgrades/users/connection ∥ feed/leaderboard — `tasks.md` T9/T10
- 2026-11-16 — building T10 completed — commit `83c17ed`; feed/leaderboard live dots + medal/bar spans; component tests 18 green, coverage 96.74/96.44/97.86/96.74; full frontend suite red only on two T8-owned `App.test.tsx` exact strings — `build-log-T10.md`
- 2026-11-16 — building T9 completed — commit `a586547`; upgrades/crew/connection markup; 35 T9 tests, modules 100%; 9 T8-owned `App.test.tsx` golden strings expected red until T8 — `build-log-T9.md`
- 2026-11-16 — building T8 started — HUD/app shell markup, icons, ambience, App-level reveal/grant assertions and fixture rewrite — `tasks.md` T8
- 2026-11-16 — building T8 completed — commit `73a4505`; HUD restructure, ambience, App-level AC-2/11/13, fixture rewrite; frontend 2392 tests, coverage 96.8/96.45/98/96.8 — `build-log-T8.md`
- 2026-11-16 — T7 ambience reduced-motion gap found — T8 emits `data-reduced-motion`; `game-view.css` only honors the OS media query. Small T7 fix queued before T11.
- 2026-11-16 — T7 ambience fix completed — commit `f723b7e`; session `data-reduced-motion` disables animation independently of the OS media query; focused 71 tests green.
- 2026-11-16 — building T11 started — full root gate, manual matrix, docs pass, bundle/protected checks, feature-artifact tracking — `tasks.md` T11
- 2026-11-16 — building T11 blocked — branch was stacked on presence commits `2e4a2ce`/`7c212d5`/`e39c378`; backend red on five `hub.test.ts` TTL expectations that presence T3 fixes. Throwaway merge of the presence tip passes the full gate; glossary conflict only. Manual `workMs`/visual traces cannot run in this environment (no browser tooling). — `build-log-T11.md`
- 2026-11-16 — T11 integrated — merged presence tip `36d03e7` as `69cd566` (glossary both-terms conflict resolved), evidence `af97f5a`; full automated gate green: backend 1538 tests / coverage 96.2/89.92/99.57/96.2, frontend 2432 tests / 96.84/96.53/98.04/96.84, build/budget OK, smoke 28/28, protected files unchanged — `build-log-T11.md`
- 2026-11-16 — building → blocked — remaining T11 evidence is the manual visual/motion matrix and the AC-15 `workMs` / AC-34 main-scene traces; no GUI/browser tooling in the build environment — user decision needed
- 2026-11-16 — user chose to run the manual matrix on a GUI host — awaiting pass/issues report; automated gate already green

## Blockers / open questions

- none
