# Build log — cube-centering — CSS centering regression guard (backlog)

Task: css-guard (2026-10-26)
Files changed: src/frontend/src/ui/app.css.test.ts, docs/features/cube-centering/build-log-css-guard.md
What changed & why: Added a lightweight, honest (weak) regression guard that reads app.css via node:fs and asserts the `.auth-menu, .auth-forms` rule still contains `circle at 50% 50%` and `background-origin: border-box`. It is CSS string presence only; real visual centering still requires a browser/DOM layout engine and is out of scope for the node test environment. No production code changed; no new dependencies.
Decisions: Extract the first `.auth-menu, .auth-forms { ... }` rule block with a regex so the assertion targets that rule (not an arbitrary occurrence); throw explicitly if the rule is missing rather than relying on a weak existential. No banned matchers; concrete `toContain` substrings. Documented the weakness in the test comment.
Evidence:
- `npm run lint` → exit 0 (no diagnostics)
- `npm run typecheck` → exit 0 (backend + frontend tsc --noEmit)
- `npm test` → exit 0 (backend 492 tests, 18 files; frontend 812 tests, 35 files; 1304 total)
- `npm run coverage` → exit 0 (backend All files 94.66/84.32/99.60/94.66; frontend All files 94.92/95.17/96.21/94.92; all ≥ 80)
- `npm run build` → exit 0 (vite build, 1.30s)
Acceptance audit: CSS guard present and passing → met (test file added); weak-guard documented in test comment → met; no production change → met.
Deviations from spec: none (backlog task).