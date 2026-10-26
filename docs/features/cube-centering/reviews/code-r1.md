---
feature: cube-centering
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 1
---

# Code Review — r1

## Summary

✅ approved — The fix is the smallest correct change: the auth-overlay backdrop radial gradient is re-centered to `50% 50%` and `background-origin: border-box` makes the percentage resolve against the full viewport box (including safe-area padding), aligning the backdrop focal point with the cube's true screen center. Lint, typecheck, tests (backend 492 + frontend 758), coverage (all ≥ 80%), and build all pass. Z-index, pointer-events, padding, and responsive media queries are untouched, so the auth overlay's look and input blocking are preserved. No visual regression test was added (justified by the node test environment) — recorded as INFO backlog.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 — Backdrop gradient centered at `50% 50%` with `border-box` origin | ✅ | `src/frontend/src/ui/app.css:257` `radial-gradient(circle at 50% 50%, …)` and `:259` `background-origin: border-box;` (diff e5ef8cf) |
| AC-2 — Cube 3D centering unchanged (scene uses `cubePosition` + camera `lookAt`) | ✅ | `src/frontend/src/render/scene.ts:362-363` camera created at `(cubePosition.x, cubePosition.y, REST_Z)` with `lookAt(cubePosition.x, cubePosition.y, 0)`; `applyRestAt` `:469-472` sets position `(x,y,REST_Z)` and `lookAt(x,y,0)`; intro branch `:656-665` offsets by `cubePosition`. `src/frontend/src/ui/GameCanvas.tsx:33-40` canvas fills `main` (`app.css:51-57` width/height 100%). |
| AC-3 — Auth overlay look & input blocking preserved (z-index, pointer-events, responsive) | ✅ | `app.css:248` `z-index: 100`, `:255` `pointer-events: auto`, `:252-253` safe-area padding, `:500-527` media queries unchanged by the diff (only lines 257/259 changed). |
| AC-4 — Lint / typecheck / test / coverage / build pass | ✅ | See "Verification performed". |
| AC-5 — No visual regression test added (justified) | ℹ️ | Builder decision recorded in `build-log.md:6`; no layout engine in node env. Recorded as F1 (INFO). |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | INFO | `src/frontend/src/ui/app.css` (no test) | No visual regression test asserts the gradient focal point / centering; the builder justified this by the node test environment having no layout engine. Acceptable as backlog. | Optionally add a jsdom/visual smoke assertion in a future feature if a layout-capable test env is introduced; not blocking. | open |

## Verification performed

- `npm run lint` → exit 0 (no diagnostics)
- `npm run typecheck` → exit 0 (backend `tsc --noEmit`, frontend `tsc --noEmit`)
- `npm test` → exit 0 (backend 492 tests, 18 files; frontend 758 tests, 34 files; 1250 total)
- `npm run coverage` → exit 0 (backend All files 94.66% stmts / 84.32% branches / 99.60% funcs / 94.66% lines; frontend All files 93.96% / 93.32% / 96.21% / 93.96%; both workspaces ≥ 80 on all four metrics; exclusions limited to `src/server.ts` (backend) and `src/main.tsx` (frontend) composition roots plus Vitest defaults)
- `npm run build` → exit 0 (backend `tsc`; frontend Vite build, 2.19s)
- Manual: inspected the diff (e5ef8cf) file-by-file; only `src/frontend/src/ui/app.css` production source changed (2 lines: `50% 38%` → `50% 50%`, plus `background-origin: border-box;`); `GameCanvas.tsx`, `App.tsx`, and `engine.ts` are untouched and were re-verified for camera/canvas centering (see AC-2).
- Manual: confirmed `background-origin: border-box` is placed after the `background` shorthand so it overrides the shorthand's default `padding-box` origin; no other rule sets `background-origin`.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | CSS-only change; no DOM injection, no secrets, no new deps, `.env*` untouched. |
| Quality | ✅ | Smallest correct change; no dead code or drive-by refactors; diff traceable to the centering diagnosis. |
| Testing | ✅ | All ACs have evidence; coverage ≥ 80% both workspaces; no new tests required for a CSS-only fix. Weak-assertion / banned-matcher checks n/a (no test changes). |

## Previous round verification (if iteration > 1)

n/a — first code-review round.

## Notes / backlog (non-blocking)

- Visual centering cannot be asserted in the SSR node test environment; if a layout-capable (jsdom/Playwright) harness is added later, a regression test pinning the gradient focal point and auth-overlay geometry would be valuable.
- No `spec.md`/`plan.md`/`tasks.md` exist for this bug-fix feature; acceptance criteria are taken from `build-log.md`. Consider formalising if the feature is reopened.