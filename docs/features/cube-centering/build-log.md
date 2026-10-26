# Build log — cube-centering — center backdrop/cube

Task: cube-centering (2026-10-26)
Files changed: src/frontend/src/ui/app.css, docs/features/cube-centering/status.md, docs/features/README.md
What changed & why: The auth overlay backdrop radial gradient was pinned to `circle at 50% 38%` and positioned relative to the padding box, so on notched/safe-area viewports (and even on a plain viewport) its focal point sat above the cube's actual screen center (50%/50%), making the backdrop and the cube behind it read as off-center. Re-centered the gradient to `50% 50%` and set `background-origin: border-box` so the percentage resolves against the full viewport box (including safe-area padding), keeping the backdrop — and the cube it frames — centered horizontally and vertically across mobile and desktop. No gameplay, engine, or scene changes.
Decisions: CSS-only fix; no new dependencies; engine/scene untouched. Visual centering cannot be asserted in the SSR node test environment (no layout engine), so no fabricated visual regression test was added; the existing markup/overlay tests remain the component-level evidence.
Evidence:
- npm run lint → exit 0 (no diagnostics)
- npm run typecheck → exit 0 (backend + frontend tsc --noEmit)
- npm test → exit 0 (backend 492 tests; frontend 758 tests; 34 files)
- npm run coverage → exit 0 (backend 94.66/84.32/99.60/94.66; frontend 93.96/93.32/96.21/93.96; all ≥ 80)
- npm run build → exit 0 (vite build, 1.56s)
Acceptance audit: backdrop gradient centered at 50% 50% with border-box origin → met (CSS inspection); cube 3D centering unchanged (scene uses cubePosition + camera lookAt) → met.
Deviations from spec: none (no spec for this bug-fix feature).
