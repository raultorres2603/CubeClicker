---
feature: upgrades-panel-bottom-right
phase: code
iteration: 1
verdict: approved
blocking: 0
nonblocking: 3
---

# Code Review — r1

## Summary

✅ approved — The implementation matches the spec exactly: the `upgrades-panel` class hook is on the root `<section>` with the documented attribute order, the `.upgrades-panel` rule declares all five required positioning declarations with the specified safe-area insets, and the production scope is limited to the two owned files. Independent reruns of lint, typecheck, test, coverage (both workspaces ≥ 80%), and build all pass; CSS-guard and markup expectations are concrete and green.

## Acceptance verification

| AC | Met? | Evidence |
| --- | --- | --- |
| AC-1 — Panel placement | ✅ | `src/frontend/src/ui/app.css:813-821` declares `position: absolute; top: auto; bottom: calc(1rem + env(safe-area-inset-bottom, 0px)); left: auto; right: calc(1rem + env(safe-area-inset-right, 0px));`. CSS guard `src/frontend/src/ui/app.css.test.ts` (describe "upgrades panel placement (CSS guard)") asserts each declaration. |
| AC-2 — Class hook | ✅ | `src/frontend/src/ui/UpgradesPanel.tsx:55-59` renders `<section aria-label="Upgrades" className="upgrades-panel" data-mode={mode}>`. `UpgradesPanel.test.tsx` (new test "renders the upgrades-panel class on the root section") and `App.test.tsx:252` golden string both assert `class="upgrades-panel"` in the documented attribute order. |
| AC-3 — Safe-area insets | ✅ | Rule uses `env(safe-area-inset-bottom, 0px)` and `env(safe-area-inset-right, 0px)` (app.css:818/820); CSS-guard assertions pin both. |
| AC-4 — No regression | ✅ | Independent runs: `npm run lint` exit 0; `npm run typecheck` exit 0; `npm test` → backend 22 files/700 tests, frontend 47 files/1196 tests, all pass; `npm run coverage` exit 0 (backend 94.34/85.93/99.68/94.34, frontend 94.89/94.89/95.65/94.89); `npm run build` exit 0. |
| AC-5 — No other surface moved | ✅ | `git diff 5c3a7d9..71b67fe --name-only` lists only `src/frontend/src/ui/UpgradesPanel.tsx`, `src/frontend/src/ui/app.css` (production) plus the three test files and build logs. No backend/container/compose/Dockerfile/server.ts changes. |

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |
| F1 | INFO | docs/features/upgrades-panel-bottom-right/build-log-T3.md:37,40 | Two evidence lines in the T3 build log retain trailing whitespace (from the coverage table). | Cosmetic; no code change required. Could be trimmed if the log is re-saved. | open |
| F2 | INFO | src/frontend/src/ui/UpgradesPanel.test.tsx:94 | Pre-existing `expect(onPurchase).not.toHaveBeenCalled()` (argument-unchecked negative) in a test touched by this feature's append. Not introduced by this change and outside the "new/changed assertion" bar; left as-is per the no-retro-refactor rule. | None — documented for traceability only. | open |
| F3 | INFO | docs/features/README.md (working tree, unstaged) | Unstaged index edit adds rows for two other features; no upgrades-panel row present, which is expected while this feature is in `code_review` (index is orchestrator-applied on acceptance). Not part of this feature's commits. | None for this review; orchestrator owns the index. | open |

## Verification performed

- `npm run lint` → exit 0 (no errors).
- `npm run typecheck` → exit 0 (backend + frontend `tsc --noEmit`).
- `npm test` → backend: Test Files 22 passed, Tests 700 passed; frontend: Test Files 47 passed, Tests 1196 passed; exit 0.
- `npm run coverage` → exit 0; backend All files 94.34% stmts / 85.93% branch / 99.68% funcs / 94.34% lines; frontend 94.89% / 94.89% / 95.65% / 94.89%. Thresholds ≥ 80 met in both workspaces.
- `npm run build` → exit 0 (backend tsc; frontend vite build, ✓ built in 1.29s).
- Manual: `grep -n "upgrades-panel" src/frontend/src/ui/app.css` → single rule at line 813 (no duplicate-rule ambiguity); `git diff --check` only flags the two trailing-whitespace lines above.
- Coverage exclusions inspected: frontend excludes test files + `src/main.tsx` + Vitest defaults; backend excludes test files + `src/server.ts` + defaults. Matches the justified list; no production logic excluded, no number-gaming.

## Checklists

| Checklist | Result | Notes |
| --- | --- | --- |
| Security | ✅ | CSS/markup only; no user-controlled data, persistence, secrets, dependencies, or container changes. `.env*` untouched. |
| Quality | ✅ | Change is minimal and traceable to T1/T2; no dead code or drive-by refactors; class selector (0,1,0) reliably overrides `main > section` (0,0,2) without `!important`; panel stays a direct child of `<main>` preserving the metallic frame. |
| Testing | ✅ | CSS guard + SSR markup assertions are concrete (exact `toContain` strings, no banned matchers in the new/changed assertions); coverage thresholds met; no exclusions added. |

## Previous round verification (spec r1)

| Finding | Status | Evidence |
| --- | --- | --- |
| F1 (spec r1, MINOR) — pin concrete expected section string in UpgradesPanel.test.tsx | fixed | Builder added `expect(guest).toContain('<section aria-label="Upgrades" class="upgrades-panel" data-mode="guest">')` and the account variant (UpgradesPanel.test.tsx:118-119), matching the suggested form. |
| F2 (spec r1, INFO) — max-width on narrow viewports | open (by design) | No `max-width` added; spec Non-goals/§Q-3 flag it as a known limitation, not a defect. Acceptable at code gate. |

## Notes / backlog (non-blocking)

- The feature is a pure CSS/markup repositioning; no documentation updates are required beyond the acceptance-time index row, and no container/real-time behavior is touched.
- Q-3 (overlap with phase announcement on very wide panels) remains a documented tunable; revisit only if observed in use.