---
feature: metallic-hud-frames
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 2
---

# Code Review — r1

## Summary
✅ Approved — all 23 acceptance criteria met with evidence; full verification suite (lint, typecheck, tests, coverage, build, smoke) passes and both BASE-pinned diff gates are clean. Two minor test/style nits are recorded; no blocker or major finding.

## Acceptance verification
| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ✅ | `theme.test.ts` pins HUD_TEXT/HUD_BACKGROUND/ACCENT/PAGE_BACKGROUND and the 18.26 contrast gate; `theme.ts` unchanged (diff gate 1 exit 0). |
| AC-2 | ✅ | `app.css.test.ts` "metallic frame tokens" block; `:root` tokens at `app.css:15-39`; `--frame-metal` 145deg gradient with 6 stops. |
| AC-3 | ✅ | `app.css.test.ts` "shared frame rule"; selector list `app.css:596-601`, frame technique `app.css:602-622`. |
| AC-4 | ✅ | `app.css.test.ts` "bevel tiers"; `--frame-cut: 0.75rem` at `app.css:602`, `.auth-panel` 1rem at `app.css:625`, banner/phase 0.5rem at `app.css:630`. |
| AC-5 | ✅ | `app.css.test.ts` "framed controls"; rule `app.css:639-657`. |
| AC-6 | ✅ | `app.css.test.ts` "frame persistence across states"; state rules `app.css` contain no `background`; hover changes color/box-shadow/filter; `.auth-button-primary` inset ring at `app.css:372`. |
| AC-7 | ✅ | `app.css.test.ts` "inset wells"; single merged rule `app.css:408-433`; focus rule `app.css:435-441`. |
| AC-8 | ✅ | `app.css.test.ts` "focus rings"; inset rings at `app.css:210-216`, `358-363`, `568-572`, `435-441`. |
| AC-9 | ✅ | `app.css.test.ts` "frame sheen"; keyframes `app.css:661-668`, sheen rule `app.css:670-687` with `inset: 0`, both mask layers and composite ordering; position:relative at `app.css:591-594`. |
| AC-10 | ✅ | `app.css.test.ts` "no rounded chrome"; all four `border-radius` declarations are `0` (`app.css:236,421,605,646`). |
| AC-11 | ✅ | `app.css.test.ts` "scanline"; `@keyframes hud-scanline` `app.css:690-697`, applied to `::after` `app.css:699-706` (4000ms). |
| AC-12 | ✅ | `app.css.test.ts` "HUD blink"; `hud-blink` `app.css:709-722` animates `filter`, no `box-shadow`; applied `app.css:724-726` (200ms). |
| AC-13 | ✅ | `app.css.test.ts` "minimize control"; `app.css:555-576`. |
| AC-14 | ✅ | `app.css.test.ts` "minimized state"; `app.css:578-587`. |
| AC-15 | ✅ | `app.css.test.ts` "reduced motion"; block `app.css:728-753` names all required selectors incl. `.verification-pending button` and `.auth-input`. |
| AC-16 | ✅ | `app.css.test.ts` "responsive fit"; single `@media (max-width: 480px)` at `app.css:524` with `main > section` padding/font-size. |
| AC-17 | ✅ | `theme.test.ts` "HUD text contrast >= 12 over the frame center". |
| AC-18 | ✅ | Diff gate 1: `git diff --exit-code 824cb22...HEAD -- <paths>` exit 0; `git status --porcelain` empty. Build log T2 records BASE and outputs; component tests 985 pass unmodified. |
| AC-19 | ✅ | Diff gate 2: container/backend paths diff exit 0 and empty porcelain; smoke 12/12 pass. |
| AC-20 | ✅ | `npm run coverage` exit 0; backend 94.66/84.32/99.60/94.66, frontend 95.05/94.85/96.46/95.05 (all ≥ 80). |
| AC-21 | ✅ | `app.css.test.ts` "alert overrides"; standalone `.auth-error` rule `app.css:444-452`. |
| AC-22 | ✅ | `theme.test.ts` alert-center, `#ffb4b4`, and input-well contrast tests. |
| AC-23 | ✅ | `app.css.test.ts` "disabled controls"; `.auth-button:disabled…` `app.css:365-369`, `.user-panel li button:disabled` `app.css:251-254`; `theme.test.ts` disabled-alpha test. |

## Findings
| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | src/frontend/src/ui/app.css (EOF) | The stylesheet ends without a trailing newline (diff reports "No newline at end of file"), unlike the predecessor file. | Add a single trailing newline to `app.css`. | open |
| F2 | MINOR | src/frontend/src/ui/app.css.test.ts (frame sheen "mask-composite declarations follow their shorthands") | The guard computes `maskIdx` via `body.indexOf('mask: linear-gradient(#000 0 0)')`, which first matches inside the `-webkit-mask:` declaration rather than at a declaration start, so it does not strictly verify the standard `mask:` composite ordering as AC-9 describes. | Anchor the lookup to a declaration start (e.g. a `^\s*mask:` line match) so the standard `mask:`/`mask-composite:` pair is validated independently of `-webkit-mask:`. | open |

## Verification performed
- `npm run lint` → exit 0 (no output).
- `npm run typecheck` → exit 0 (backend + frontend, no errors).
- `npm test` → exit 0; backend 18 files / 492 tests; frontend 41 files / 985 tests (all passed).
- `npm run coverage` → exit 0; backend All files 94.66% stmts / 84.32% branch / 99.60% funcs / 94.66% lines; frontend All files 95.05% stmts / 94.85% branch / 96.46% funcs / 95.05% lines (all ≥ 80).
- `npm run build` → exit 0 (backend tsc; frontend vite build, 66 modules).
- `npm run smoke` → SMOKE PASS (12/12 checks).
- Diff gate 1 (AC-18): `git diff --exit-code 824cb22...HEAD -- <paths>` exit 0; `test -z "$(git status --porcelain -- <paths>)"` exit 0.
- Diff gate 2 (AC-19): `git diff --exit-code 824cb22...HEAD -- compose.yaml compose.smoke.yaml 'src/backend/**' 'src/frontend/Dockerfile' ':(glob)**/Dockerfile'` exit 0; porcelain empty.
- Manual visual verification: not performed in this headless review (per spec § Testing strategy it is non-automated); containerized smoke passed 12/12 and the sheen geometry guard (`inset: 0`, no negative inset) is green.

## Checklists
| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | CSS + test-source only; no new deps, no secrets, no DOM injection, no container/backend change (AC-19). |
| Quality | ✅ | Diff traceable to T1/T2; no dead code; `!important` absent; retained `overflow: hidden` preserved; reduced-motion extended. |
| Testing | ✅ | Coverage ≥ 80% both workspaces; no banned matchers; concrete expected values; smoke 12/12. |

## Previous round verification (if iteration > 1)
n/a — first code review round.

## Notes / backlog (non-blocking)
- Manual visual check (beveled metal frame, cyan glow, sheen not clipped by `overflow: hidden`, legible centers, hover/focus/disabled, reduced-motion) remains for a human reviewer with `podman compose up`; the geometry guard (`inset: 0`, rejection of `inset: -2px`) pins the sheen inside the padding box.
- The `hud-blink` keyframes use `drop-shadow(0 0 0 …)` at rest (zero blur), which renders no glow at 0%/100%; harmless and consistent with the filter-based blink required by AC-12. Could be tuned to a small non-zero blur if a resting glow is desired (Q-1/Q-7).