---
feature: spaceship-customization-layout-fix
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 0
---

# Code Review — r1

## Summary

✅ approved — implementation matches spec r2 exactly: toggle button gains `customization-toggle` class and both `.customization-panel` / `.customization-toggle` rules are positioned absolute at the bottom-left with safe-area insets; CSS guard and SSR markup expectations updated; lint/typecheck/tests/coverage/build all green; production scope limited to `App.tsx` + `app.css` with container/backend assets untouched.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 — Panel placement | ✅ | `src/frontend/src/ui/app.css:756-766`: `.customization-panel { position: absolute; top: auto; bottom: calc(4rem + env(safe-area-inset-bottom, 0px)); left: calc(1rem + env(safe-area-inset-left, 0px)); right: auto; }`. CSS guard `app.css.test.ts` (describe "spaceship customization placement") asserts `position: absolute;`, `top: auto;`, `bottom: calc(4rem + env(safe-area-inset-bottom, 0px));`, `left: calc(1rem + env(safe-area-inset-left, 0px));` via first-match regex. |
| AC-2 — Toggle placement | ✅ | `src/frontend/src/App.tsx:478`: `className="customization-toggle"` on the toggle button; `app.css:806-810`: `.customization-toggle { position: absolute; bottom: calc(1rem + env(safe-area-inset-bottom, 0px)); left: calc(1rem + env(safe-area-inset-left, 0px)); }`. `App.test.tsx:257` expected markup now includes `class="customization-toggle"`. CSS guard asserts the three declarations. |
| AC-3 — No self-overlap | ✅ | Panel `bottom: calc(4rem + env(...))` sits above the toggle `bottom: calc(1rem + env(...))`; 4rem clears the ~2.5rem toggle (Q-2). |
| AC-4 — Safe-area insets | ✅ | Both rules use `env(safe-area-inset-bottom, 0px)` and `env(safe-area-inset-left, 0px)`, mirroring `main > section` / `.user-panel`. Grep confirms 4 occurrences across the two rules. |
| AC-5 — No regression | ✅ | `npm run lint` EXIT 0; `npm run typecheck` EXIT 0 (both workspaces); `npm test` 22/22 backend (700) + 47/47 frontend (1194) passed; `npm run coverage` backend 94.34/85.93/99.68/94.34, frontend 94.89/94.89/95.65/94.89 (all ≥ 80); `npm run build` EXIT 0. |
| AC-6 — No other surface moved (production scope) | ✅ | Feature commit range `4d3c244..5c3a7d9`: changed files are `App.tsx`, `app.css`, `App.test.tsx`, `app.css.test.ts` only. `SpaceshipCustomizationPanel.tsx`, `UpgradesPanel`, HUD, user panel, connection banner, backend, compose/Dockerfile/server.ts all unchanged (verified via `git diff --name-only` and grep for container paths). |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| (none) | — | — | No findings. | — | — |

## Verification performed

- `npm run lint` → EXIT 0, no output/errors.
- `npm run typecheck` → EXIT 0 (backend + frontend `tsc --noEmit`).
- `npm test` → backend Test Files 22 passed (22), Tests 700 passed (700); frontend Test Files 47 passed (47), Tests 1194 passed (1194).
- `npm run coverage` → backend All files 94.34 stmts / 85.93 branch / 99.68 funcs / 94.34 lines; frontend All files 94.89 / 94.89 / 95.65 / 94.89. All four metrics ≥ 80 in both workspaces; EXIT 0. Raw output captured in `/tmp/opencode/coverage.log`.
- `npm run build` → backend tsc EXIT 0; frontend vite build ✓ built in 1.35s; EXIT 0.
- Container gate: `git diff 4d3c244..5c3a7d9 -- compose.yaml compose.smoke.yaml src/backend/Dockerfile src/frontend/Dockerfile src/backend/src/server.ts` → no changes (EXIT 0).
- Manual inspection: `main { position: relative; }` (app.css:64-65) so the absolute offsets resolve against `<main>`; `.customization-panel` remains a direct child of `<main>` (App.tsx:486), preserving `main > section` metallic-frame styling; only position/top/bottom/left/right are overridden.
- Coverage config inspection: exclusions limited to test files + composition-root entrypoint (`main.tsx`/`server.ts`); thresholds pinned at 80 on all four metrics; `all: true` so un-imported files count. No number-gaming.
- Banned-matcher / assertion-quality spot-check of the new CSS guard tests: uses `not.toBeNull()` + concrete `toContain(...)` strings; no `expect.any*`, `objectContaining`, snapshot-only, or assertion-free tests. New `App.test.tsx` change is an exact-markup `toBe` string update.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | CSS/markup only; no user-controlled data, persistence, secrets, dependencies, or container changes. |
| Quality | ✅ | Pure positioning change; single writer per rule; no dead code/debug leftovers; metallic frame preserved; diff traceable to T1–T4. |
| Testing | ✅ | Coverage ≥ 80% both workspaces; CSS guard + SSR markup expectations updated; no banned matchers; un-imported files counted (`all: true`). |

## Previous round verification (if iteration > 1)

n/a — first code-review iteration. Spec-review findings F1–F4 (r1) were resolved in spec r2 and are reflected in the implementation (AC-6 scopes production files; positioning merged into the single existing `.customization-panel` block; panel bottom pinned to `calc(4rem + env(...))`; Q-4 intrinsic-width limitation documented).

## Notes / backlog (non-blocking)

- The uncommitted `docs/features/README.md` change present in the working tree adds the `spaceship-customization-minor-fixes` row and is unrelated to this feature; the layout-fix builder correctly proposed its own row in `build-log-T4.md` rather than editing the orchestrator-owned index. Orchestrator applies the layout-fix row on acceptance.
- Q-1/Q-2/Q-3/Q-4 remain documented tunables (4rem gap, intrinsic toggle width); acceptable per spec Non-goals and flagged as known limitations rather than defects.
- The CSS guard's first-match regex relies on there being a single `.customization-panel` block; verified (`grep` shows exactly one). If a future change adds a second block, the guard (and this review's AC-1 evidence) must be revisited.