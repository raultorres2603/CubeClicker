---
feature: fullscreen-responsive-layout
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 6
---

# Code Review — r1

## Summary

✅ approved — All automated gates pass (lint 0, typecheck 0 both workspaces, 863 tests green, coverage ≥ 80 in both workspaces, build 0, smoke 8/8). Implementation conforms to the approved spec and predecessor contracts: viewport sizing, debounced resize (trailing 16 ms, orientation immediate, teardown), pointerType-agnostic touch tap/drag, responsive overlays with safe-area insets, 44 px tap targets, accessibility retained. Six non-blocking findings remain (wording, CSS pointer-events on the panel, an untested browser-env listener, unverified manual browser matrix, branch discipline, spec wording overlap); none is a BLOCKER/MAJOR. Recommended next state: `accepted` once the orchestrator records the manual browser pass (or explicitly waives it).

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 | ⚠️ partial (static) | `app.css:19-48` uses `100vw`/`100vh`/`100dvh` + `overflow: hidden` on `html`/`body`/`#root`/`main`; `main > canvas` `width/height:100%` (`app.css:51-57`); `index.html:5` viewport meta; `App.test.tsx` (9 tests) green. Manual cells (5 sizes × 2 orientations + dynamic toolbar + WebGL at size) **not verified** — no browser/emulation available (see F4). |
| AC-2 | ✅ | grep: `100dvh` at `app.css:26,46`; `100vh` at `app.css:25,45` (fallback present). |
| AC-3 | ✅ | No `aspect-ratio`/`max-width`/`max-height` on `main`/`canvas`/`#root`; only `max-width` is on `.user-panel` (`app.css:158`, overlay clamp). `main > canvas { width:100%; height:100% }`. |
| AC-4 | ✅ (with F2) | `app.css:68,127,151` `position: absolute` for HUD/banner/panel; `pointer-events: none` on HUD (`app.css:81`) and banner (`app.css:142`), `auto` on banner button (`app.css:146`); no `z-index` in `app.css` (grep exit 1). `Hud.test.tsx` (6 tests) + `App.test.tsx` (9 tests) green. Panel container has no `pointer-events: none` (F2, accepted deviation). |
| AC-5 | ⚠️ partial (static) | `env(safe-area-inset-*)` on HUD top/left (`app.css:69-70`), phase bottom (`app.css:102`), banner top (`app.css:128`), panel top/right + clamp (`app.css:152-153,158`); `viewport-fit=cover` (`index.html:5`). Components add no inline `style=` (T4 tests). Manual notched-device inspection **not verified** (F4). |
| AC-6 | ✅ | `session.ts:813-820` `applyViewport`: `setPixelRatio(Math.min(env.devicePixelRatio(), PIXEL_RATIO_CAP))` (cap 2), `setSize(rect.width, rect.height)`, `rect = target.getBoundingClientRect()`. Tests: dpr 3 → `setPixelRatio:2`; empty rect → `setSize:0:0`; resize → `setSize:800:800`. `session.test.ts` (52 tests) green. |
| AC-7 | ✅ | `session.ts:818-819` `camera.aspect = rect.height > 0 ? rect.width / rect.height : 1` then `updateProjectionMatrix()`. Tests assert aspect `4/3`, `1`, `0.75`. |
| AC-8 | ✅ | `session.ts:972-993` `onResize` schedules trailing `setTimeout(..., RESIZE_DEBOUNCE_MS=16)` (no synchronous apply); attach-time `applyViewport()` direct (`session.ts:997`, `vi.getTimerCount() === 0`); `onOrientation` applies synchronously and clears pending timer; teardown `clearResizeTimer()` + unsubscribes both sources (`session.ts:1026,1031-1033`). Fake-timer tests pin no call until timer fires, call at 16 ms, burst coalescing, synchronous orientation with no duplicate, teardown cancellation. |
| AC-9 | ✅ (wording F1) | `gestures.ts` pointerType-agnostic (no `pointerType`/`pointerId` in production sources; grep empty). `gestures.test.ts` parity group pins 39 px and 40 px (inclusive) as taps with identical NDC for touch and mouse; integration test carries a touch tap at canvas centre through real `pickMiniCube` → `front:2:2` explode (clicks 1, tile removed). `session.test.ts` touch helpers confirm dispatch. Boundary wording mismatch vs. spec "< 40 px" is F1 (retained predecessor contract uses ≤ 40). |
| AC-10 | ✅ | 41 px touch drag classifies as identical `{ kind: 'drag', axis: 'yaw', direction: 1 }` as mouse (vertical: `{ axis: 'pitch', direction: -1 }`); session drops classified drags with no dispatch, snapshot identity unchanged, zero clicks/orientation/publishes (`session.test.ts > pointer wiring > ignores a playing drag`). |
| AC-11 | ✅ | `session.test.ts` gates touch taps/drags exactly like mouse during travel and view-only (zero clicks, zero orientation steps, no wire sends; same touch tap explodes at home). `spectate.test.ts` (23 tests) green. |
| AC-12 | ✅ | `gestures.ts` exports only `classifyPointer` with arity 3 (API-surface test); no new input UI/joystick module; doc comment records gesture-only. `gestures.test.ts > input API surface` green. |
| AC-13 | ✅ | `app.css:163-164` `min-width: 44px; min-height: 44px` on `.user-panel > button` and `.connection-banner button`. Three controls (`Users on Server`, `Return to my cube`, `Retry`) pinned as direct children with exact markup (`Hud.test.tsx`, `UserPanel.test.tsx`, `ConnectionBanner.test.tsx`). |
| AC-14 | ✅ | `App.test.tsx` (9 tests) pins focusable canvas (`tabindex="0"`), stable aria-label, exactly one `role="status" aria-live="polite"` region in every phase; overlays contribute no `role=`/`aria-live` (T4 tests); `index.html` has no orientation lock (grep exit 1); reduced-motion profile untouched. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | MINOR | spec.md § AC-9; `gestures.ts:11-15,85` | Spec paraphrases the tap threshold as "touch tap < 40 px" (40 px = drag), but the retained, accepted predecessor contract (`cube-tile-lines-and-controls` AC-2) and the landed implementation pin 39 px and 40 px as taps and 41 px as a drag (inclusive `<=`). | Correct the spec wording to "touch tap ≤ 40 px" (documentation only). No logic change — the predecessor contract is authoritative here. | open |
| F2 | MINOR | `app.css:149-159` (`.user-panel`); build-log-T4.md Open question 1 | AC-4's literal "pointer-events only on interactive parts" is not applied to `.user-panel`: the container keeps the default `auto`, so empty panel area captures clicks (HUD and banner are `none` with `auto` only on their buttons). | Either accept as documented (panel is the interactive surface; recommended) or follow up with `.user-panel { pointer-events: none; }` + `.user-panel button { pointer-events: auto; }` plus verification. No change required for this gate. | open |
| F3 | MINOR | `browser-env.ts:67-72` | The new `orientationchange` listener has no direct unit test (`browser-env.test.ts` is outside T2 `files_owned`); only the session↔source contract is covered via the injected fake source. File coverage 91.66% (lines 69-72 uncovered). | Add an orientation-listener unit test in `browser-env.test.ts` in a follow-up (ownership exception) or accept the documented exception. | open |
| F4 | MINOR | build-log-T5.md § Manual verification | AC-1/AC-5 manual browser matrix was not performed (no browser/emulation in this environment). Unverified cells: 320×568, 375×667, 768×1024, 1280×720, 1920×1080 × {portrait, landscape} (10 cells); mobile dynamic-toolbar collapse (dvh gaps/scroll); notched-device safe-area padding on all four edges; tap-target hit sizes on a real touch device; WebGL rendering at the five sizes. | Acceptable documented limitation given the environment and the spec's manual-only designation; static CSS/markup audit + automated SSR tests + smoke substitute. Orchestrator to run the matrix before final acceptance (recommended, not blocking). | open |
| F5 | MINOR | tasks.md / build-log-T5.md § Open questions 2; AGENTS.md § Conventions | Feature work landed on `main` rather than `feat/fullscreen-responsive-layout` (4 commits T1–T4 + T5). | Orchestrator decision: no history rewrite recommended (functional impact none); enforce branch discipline for future features. | open |
| F6 | INFO | spec.md § AC-6/AC-8; spec-r2 F14 (open) | AC-6 says "applyViewport runs" on a resize emission while AC-8 says resize emissions are trailing-debounced and do not apply synchronously — apparent overlap. Implementation is correct (resize debounced, orientation immediate). | Clarify AC-6 wording to "schedules applyViewport (debounced for resize; immediate for orientation)" in a future spec revision. | open |

## Verification performed

- `npm run lint` → exit 0 (`eslint .`, no diagnostics).
- `npm run typecheck` → exit 0 (backend `tsc --noEmit`, frontend `tsc --noEmit`).
- `npm test` → exit 0 — backend 7 files / 208 tests; frontend 28 files / 655 tests; 863 total.
- `npm run coverage` → exit 0 — backend 98.64 stmts / 97.4 branches / 100 funcs / 98.64 lines; frontend 95.81 / 96.53 / 96.94 / 95.81 (all ≥ 80). Exclusions: only `src/main.tsx` (frontend) and `src/server.ts` (backend) composition roots plus Vitest defaults; `all: true`. No gaming.
- `npm run build` → exit 0 (backend `tsc`; frontend `vite build`, 58 modules, 1.37s; pre-existing chunk-size warning, unchanged).
- `npm run smoke` → exit 0 — 8/8 checks PASS (healthz, frontend 200, 2 WS hellos, join/overflow/sync/leave).
- Manual checks: static CSS/markup audit of `app.css`/`index.html`/components (recorded in AC table); no browser rendering available.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | No new user data, persistence, secrets, or deps; no `innerHTML`/`eval`; no backend/WS/protocol changes; container contract untouched (no new services/images/ports/env); `.env*` untouched. |
| Quality | ✅ | Pure game logic stays in `session.ts`/`gestures.ts` (testable without browser); single owner of viewport sizing (`applyViewport`); no dead code/debug leftovers; diffs traceable to tasks T1–T5; no drive-by refactors. Real-time contract untouched (out of scope). |
| Testing | ✅ | Coverage ≥ 80 both workspaces (verified above); no banned matchers in changed tests (grep empty); no snapshot-only/assertion-free tests in T3/T4 (build logs audit); concrete expected values throughout. Minor gap: browser-env orientation listener untested (F3). Manual AC-1/AC-5 cells unverified (F4). |

## Previous round verification (spec-r2 → implementation)

| Finding | Status | Evidence |
| --- | --- | --- |
| F14 (MINOR, spec wording AC-6/AC-8) | not fixed (spec) | Implementation is correct; spec wording still open — carried as F6. |
| F15 (MINOR, T4 ownership) | waived | T4 reverted `UserPanel.test.tsx`/`ConnectionBanner.test.tsx` edits; existing exact `toBe` tests already pin markup (build-log-T4). |
| F16 (MINOR, AC-1 recording format) | fixed | build-log-T5 records a per-size pass/fail table (all "not verified"). |
| F17 (INFO, main.tsx ownership) | fixed | T1 edited `main.tsx` (comment only); ownership retained. |
| F18 (INFO, T3 evidence in T2 file) | fixed | T3 verified; evidence in `session.test.ts` (read-only) + `gestures.test.ts`. |
| F19 (INFO, GameCanvas unowned) | fixed | No `GameCanvas.tsx` change landed. |

## Notes / backlog (non-blocking)

- WebGL context-loss recovery on mobile remains a candidate follow-up (out of scope; browser reload recovers).
- DPR cap stays `min(dpr, 2)` (`PIXEL_RATIO_CAP` in `effects.ts`) — unchanged.
- No PWA manifest, orientation lock, or virtual joystick (confirmed non-goals).
- Real-time/WS/container contracts untouched; `npm run smoke` remains the unchanged container gate.
- Recommended next state: `accepted` (automated gates green; manual browser pass recommended but not blocking given environment constraints). If the orchestrator requires the manual matrix before acceptance, state becomes `building` pending F4.