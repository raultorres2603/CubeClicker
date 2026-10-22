---
verdict: approved
blocking: 0
nonblocking: 0
iteration: 1
---

# Spec Review — cube-tile-lines-and-controls (r1)

## Summary

The spec is complete, testable, feasible, and faithful to the raw request. All three requested changes (visible tile seams, no pointer rotation, WASD keyboard rotation) are mapped to binary-testable acceptance criteria with concrete pinned values. The supersession ledger is complete and honest. The parallel task decomposition (T1 ∥ T2) is safe with no shared file contact. All open questions are genuinely user-owned with clear recommendations.

## Findings

| # | Severity | Location | Finding | Required Action | Status |
|---|----------|----------|---------|-----------------|-----|
| — | — | — | No blockers or majors found | — | — |

## Supersession Ledger Verification

Verified all superseded behaviors are correctly listed and retained behaviors are preserved:

| Predecessor AC | Superseded Behavior | Spec Coverage | Retained |
|----------------|---------------------|---------------|----------|
| cube-game-frontend AC-1 | Canvas aria-label string | ✅ AC-4 | tabindex, touch-action, focus ring |
| cube-game-frontend AC-6 | Pointer drag rotation | ✅ AC-2 | Tap threshold (40px), tap→explode |
| cube-game-frontend AC-7 | Keyboard rotation table | ✅ AC-3 | Arrow key mappings |
| cube-game-frontend AC-13 | Touch drag rotation | ✅ AC-2 | touch-action:none, tap→explode |
| cube-game-frontend AC-18 | Mini-cube glossary wording | ✅ AC-1 | Definition+example format |
| cube-visual-polish AC-6 | WASD null mapping | ✅ AC-3 | Cursor removed, Enter/Space null |
| cube-world-transition AC-2 | Flush tiling (ratio=1) | ✅ AC-1 | Body as dark interior, no plates |

All retained behaviors from predecessor specs are in force and re-asserted by unchanged tests (AC-5).

## Feasibility Verification

### Seam Math (AC-1)
- **N=5, CUBE_SIZE=5**: cell=1, tile edge=0.95, seam=0.05
- **Seam location**: between col 2 and col 3, centered at x=0.5, spans [0.475, 0.525]
- **NDC conversion**: 1 world unit = 0.2287474 NDC (from picking.test.ts:12)
- **Seam-miss cases**:
  - NDC 0.11 → x ≈ 0.4809 → inside seam [0.475, 0.525] → **miss** ✓
  - NDC 0.12 → x ≈ 0.5246 → inside seam [0.475, 0.525] → **miss** ✓
- **Inset-hit cases**:
  - x=0.45 → col 2 tile [0, 0.475] → **hit front:2:2** ✓
  - x=0.55 → col 3 tile [0.525, 1] → **hit front:2:3** ✓
  - NDC conversion: 0.45 × 0.2287474 ≈ 0.1029, 0.55 × 0.2287474 ≈ 0.1258

### Code Seams
- **MINI_CUBE_TILE_RATIO**: exists in cube-view.ts:65 (currently 1, will change to 0.95) ✓
- **Picking**: uses InstancedMesh raycasting (picking.ts:72), works with any tile size ✓
- **Drag rotation dispatch**: single location in session.ts:272, can be removed ✓
- **Keyboard map**: PLAYING_KEY_EVENTS map in keyboard.ts:42, can add WASD rows ✓
- **Aria-label**: hardcoded in GameCanvas.tsx:37, can be updated ✓
- **Glossary**: mini-cube definition in glossary.md:40, can be updated ✓

### Parallel Safety (T1 ∥ T2)
- **T1 files**: cube-view.ts, cube-view.test.ts, picking.test.ts, scene.test.ts, session.ts, session.test.ts, gestures.ts, glossary.md
- **T2 files**: keyboard.ts, keyboard.test.ts, GameCanvas.tsx, GameCanvas.test.tsx, App.test.tsx
- **Intersection**: empty ✓
- **Session test dependency**: verified via grep that session.test.ts only uses ArrowRight/ArrowLeft (lines 729, 764, 968, 973), no WASD keys → T1's green tree does not depend on T2 ✓

## Testability Verification

| AC | Testability | Evidence |
|----|-------------|----------|
| AC-1 (seamed surface) | ✅ Binary | Assert ratio=0.95, tile extents via getMatrixAt, seam widths, picking seam-miss returns null, center hits resolve |
| AC-2 (no pointer rotation) | ✅ Binary | Assert drag dispatches zero events, tap still explodes, 39/40/41 boundary retained |
| AC-3 (WASD rotation) | ✅ Binary | Assert key→event table, case-insensitivity, six-face reachability via WASD alone |
| AC-4 (aria-label) | ✅ Binary | Assert exact string in GameCanvas.tsx, GameCanvas.test.tsx, App.test.tsx |
| AC-5 (untouched core) | ✅ Binary | git diff empty on engine.ts, rotation.ts, etc.; unchanged tests pass |
| AC-6 (ledger + regression) | ✅ Binary | git diff empty on accepted feature docs; npm run coverage ≥80% |

All ACs use concrete pinned values (0.95, 0.05, WASD mappings), no visual-only acceptance, no banned matchers.

## Checklist Results

| Area | Result | Notes |
|------|--------|-------|
| Completeness | ✅ | All request items mapped to ACs; no scope invented |
| Testability | ✅ | Each AC binary-testable with concrete values |
| Boundaries | ✅ | Three tiers present; non-goals listed |
| Dependency graph | ✅ | Acyclic; T1 ∥ T2 → T3 |
| Parallel safety | ✅ | Disjoint files_owned; no shared-file contact |
| Security | ✅ | No new deps, no user data, no network |
| Testing | ✅ | Strategy present; coverage ≥80%; no banned matchers |
| Consistency | ✅ | Aligns with vision; reuses architecture |

## Risks

- **Seam tap misses**: seams are ≤8.3% of cell width (0.0833 units at N=3); tile centers unchanged, so rapid clicks at tile centers never miss. Spec pins this as tested behavior (picking.test.ts seam-miss cases).
- **Fast-click misclassification**: threshold retained inclusive (40px = tap); per-gesture reset retained; no change to classification logic.
- **Keyboard auto-repeat**: engine queue (≤1 step) unchanged; no new deduplication needed (Q-5).

## Open Questions

All Q-1...Q-6 are genuinely user-owned with clear recommendations:

- **Q-1** (seam mechanism): inset/gap approach recommended (no new drawables)
- **Q-2** (ratio value): 0.95 recommended (middle of 0.94–0.96 band)
- **Q-3** (drag treatment): fully ignored recommended (no alternative use requested)
- **Q-4** (WASD mapping): W/A/S/D → up/left/down/right recommended (matches arrows)
- **Q-5** (key auto-repeat): inherit browser behavior recommended (engine queue handles it)
- **Q-6** (seam constancy): constant ratio recommended (scales with cell)

No deferral issues; all are constant-only tuning paths.

## Conclusion

The spec is ready for implementation. All acceptance criteria are testable, the code seams exist and are feasible, the parallel task decomposition is safe, and the supersession ledger is complete. No blockers or majors found.
