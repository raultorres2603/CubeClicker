---
feature: cube-world-transition
phase: spec
iteration: 1
verdict: approved
blocking: 0
nonblocking: 0
---
# Spec Review — r1

## Summary

✅ **Approved.** The spec r1 correctly maps every request item (random mini-cube counts per level, mini-cube-built surface with no black face plates, directional travel to randomly placed next cubes) to binary-testable acceptance criteria AC-1…AC-5. The supersession ledger is complete and honest: all predecessor ACs (cube-game-frontend AC-4/AC-9/AC-10/AC-22/AC-18; cube-visual-polish-followup AC-3) are correctly identified and superseded; all retained behaviors are documented. The feasibility claims and mid-chain honesty (after T1, levels > 0 render at level 0's grid size; out-of-range picks no-op) are verified against the landed code. The testability and determinism strategy is sound: seeded RNG injection, concrete pinned values, no banned matchers, coverage ≥ 80% × 4 per workspace. The open questions Q-1…Q-8 are genuinely user-owned, clearly stated, and carry recommendations; Q-1 (count scheme option (a) — random square grid N per level) is the key checkpoint item with a clear rejection of option (b) (arbitrary per-face count with partial row, which would break flush tiling and picking decode).

## Findings

| # | Severity | Location | Finding | Required action | Status |
| --- | --- | --- | --- | --- | --- |

No findings. The spec is sound, complete, testable, feasible, and faithful to the raw request.

## Checklist results

| Area | Result | Notes |
| --- | --- | --- |
| Completeness | ✅ | Every request item maps to binary-testable ACs (AC-1 random counts, AC-2 flush surface, AC-3 directional travel, AC-4 supersession ledger, AC-5 glossary) |
| Testability | ✅ | Each AC binary-testable with concrete values; no vague terms; no banned matchers; coverage ≥ 80% × 4 per workspace |
| Boundaries | ✅ | Three tiers present (✅ Always, ⚠️ Ask first, 🚫 Never); non-goals listed; scope discipline enforced |
| Dependency graph | ✅ | Acyclic, fully sequential T1 → T2 → T3 (plan D-6: snapshot-type landmine and cube-view↔scene interface coupling force it) |
| Parallel safety | ✅ | N/A — fully sequential; no parallel collisions possible |
| Security | ✅ | No new dependencies; no user data; no network; no secrets; no supply-chain change |
| Testing | ✅ | Strategy present with unit + integration tiers; commands exist in AGENTS.md; coverage ≥ 80% (statements/branches/functions/lines) per workspace; assertion-quality bar referenced; edge cases named |
| Consistency | ✅ | Aligns with vision; reuses existing architecture; contradicts nothing in AGENTS.md |
| Real-time | ✅ | N/A — explicitly none; no shared or cross-client state; connection lifecycle, reconnection, multi-client behavior, server authority out of scope |
| Containers | ✅ | N/A — no new services, images, ports, environment variables, or health signals; frontend image absorbs the diff through existing build |

## Evidence

### Feasibility verification (claims checked against landed code)

1. **Mid-chain honesty (plan D-6):** After T1, levels > 0 render at level 0's grid size — **VERIFIED**. The scene's `rebuildCube` function (scene.ts:294) uses the `gridSize` from the closure at scene creation time (`options.gridSize ?? GRID_SIZE` at scene.ts:191), so T1's engine snapshot gridSize changes will not affect rendering until T2 rebuilds the scene with the new gridSize parameter.

2. **T1 → T2 snapshot ripple:** **VERIFIED**. The current `EngineSnapshot` interface (engine.ts:106-121) lacks `gridSize` and `travelDirection` fields. `App.test.tsx`'s `snapshotFor` helper (lines 24-41) and `session.test.ts` fixtures will break typecheck when T1 adds these required fields. T1 must update both test files' fixtures to include `gridSize: GRID_SIZE` and `travelDirection: null`.

3. **Math.random removal:** **VERIFIED**. engine.ts:216 has `const random = options.random ?? Math.random;` — this is in `game/**` and must be replaced with the deterministic LCG fallback (seed 1, multiplier 1664525, increment 1013904223, modulus 2³²).

4. **setRandomSource seam:** **VERIFIED**. The current `GameEngine` interface (engine.ts:123-134) lacks `setRandomSource(random: () => number): void`. T1 must add this additive method so the session can inject `env.random` at attach time.

5. **Snapshot field addition:** **VERIFIED**. T1 adds `gridSize: number` and `travelDirection: TravelDirection | null` to the snapshot. Both are set in `buildSnapshot()` and change only at level/travel boundaries, so referential stability holds.

6. **TravelDirection type and TRAVEL_DIRECTIONS constant:** **VERIFIED**. Not in current types.ts. T1 must add `type TravelDirection = 'left' | 'right' | 'top' | 'bottom'` and `const TRAVEL_DIRECTIONS: readonly TravelDirection[] = ['left', 'right', 'top', 'bottom']` (pinned draw-order index).

7. **Grid range constants:** **VERIFIED**. `MINI_CUBE_GRID_MIN` and `MINI_CUBE_GRID_MAX` are not in current types.ts. T1 must add `MINI_CUBE_GRID_MIN = 3` and `MINI_CUBE_GRID_MAX = 7`.

### Supersession ledger verification

- ✅ **cube-game-frontend AC-4 (cube level structure):** Correctly superseded — fixed `GRID_SIZE` 5×5 replaced by per-level random grid N ∈ [3, 7].
- ✅ **cube-game-frontend AC-4 (tile geometry):** Correctly superseded — tiles at 0.9 × cell with visible grid gaps replaced by flush, edge-to-edge tiles (`MINI_CUBE_TILE_RATIO = 1`).
- ✅ **cube-game-frontend AC-9 (face destruction):** Correctly superseded — plate fade replaced by countdown-based face removal (no plate exists to fade).
- ✅ **cube-game-frontend AC-10 (travel → next styled cube):** Correctly superseded — in-place rebuild replaced by directional travel to randomly placed next cube.
- ✅ **cube-game-frontend AC-22 (camera flights):** Correctly superseded — rest pose `(0, 0, 12)` looking at origin replaced by rest pose over current cube `(cx, cy, 12)` looking at `(cx, cy, 0)`.
- ✅ **cube-game-frontend AC-18 (glossary):** Correctly superseded — pinned "25 mini-cubes" / "5×5 grid" definitions updated to random-N model.
- ✅ **cube-visual-polish AC-1 (travel backdrop expansion):** Correctly retained — no change; the same `(S,S,1)` scale table driven by `travelSwing`.
- ✅ **cube-visual-polish AC-2 (intro):** Correctly retained — no change; the same pose table.
- ✅ **cube-visual-polish AC-3 (burst fronting):** Correctly retained — no change; face normals and burst offset unchanged.
- ✅ **cube-visual-polish AC-4 (pop):** Correctly retained in form — `popScaleAt`/`popColorMultiplierAt` unchanged; the base tile extent changes with flush tiling.
- ✅ **cube-visual-polish AC-5 (pop interactions/resources):** Correctly retained — record independence, cancellation, AC-16 ceilings.
- ✅ **cube-visual-polish AC-6 (cursor removed):** Correctly retained — no change.
- ✅ **cube-visual-polish-followup AC-1 (backdrop cone coverage):** Correctly retained — camera stays axis-aligned with identity quaternion; coverage argument transfers.
- ✅ **cube-visual-polish-followup AC-2 (intro dolly):** Correctly retained — no change; the same pose table.
- ✅ **cube-visual-polish-followup AC-3 (arrival):** Correctly superseded — symmetric z-only flight replaced by directional flight; rebuild trigger moves from `applyIntents` to `applySnapshot`; reduced-motion collapse becomes instant positional swap.

No missing touchpoints in the ledger. Every accepted behavior that changes is listed; every retained behavior is documented.

### Testability verification

- ✅ **Random counts:** Seeded RNG injection; concrete pinned N values asserted (e.g., constant draw 0.5 → N = 5; seeded LCG sequence → concrete per-level N values across two level completions). No wall-clock or platform randomness in `game/**`.
- ✅ **Mini-cube-built surface:** `MINI_CUBE_TILE_RATIO === 1` asserted; `CubeView` interface has no `plateMeshes`; group's children are exactly body + one `InstancedMesh` per live face (7 at construction); geometry assertions for N = 3 and N = 7 (tile edge = `CUBE_SIZE / N`, adjacent centres differ by `CUBE_SIZE / N`, outermost tiles reach cube edges).
- ✅ **Directional travel:** Pose tables asserted for all four directions at p ∈ {0, 0.25, 0.5, 0.75, 1} (positions and targets as exact literals); `CUBE_SPACING === 24` with pinned offsets; `travelCameraPose` is a pure function; `travelFrom` capture regression test (no double-count after midpoint rebuild); reduced-motion instant positional swap asserted.
- ✅ **No banned matchers:** No wildcard matchers, no snapshot-only tests, no assertion-free tests, no `toBeCloseTo` (bounded-exception budget stays 0).
- ✅ **No visual-only acceptance:** Every AC has concrete node-assertable scene state or test-file evidence.
- ✅ **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace; frontend pre-gate per task; config exclusions unchanged (only `src/main.tsx` + test patterns).

### Open questions verification

- ✅ **Q-1 (count scheme):** Key checkpoint item. Pinned option (a) — one random integer per level is the square grid edge N ∈ [3, 7] (N² per face, identical on all six faces). Recommended: keep (a). Option (b) — random per-face count C laid out in a near-square grid with a partial last row — is rejected: partial row leaves uncovered strip, breaks flush tiling, forces picking-decode change (`√count` no longer decodes), adds per-face layout state for no gameplay gain. Genuinely user-owned.
- ✅ **Q-2 (grid range):** Pinned [3, 7]. Recommended: keep. Alternatives [4, 6] or [2, 8] are constant-only changes.
- ✅ **Q-3 (surface vs volumetric cube):** Pinned surface tiling. Recommended: keep. Volumetric N³ lattice rejected (board/picking/instancing rework; request speaks about faces).
- ✅ **Q-4 (direction set):** Pinned four cardinal directions. Recommended: keep. Eight directions with diagonals not requested.
- ✅ **Q-5 (spawn spacing and travel geometry):** Pinned `CUBE_SPACING` 24; lateral `easeInOutQuad`, retained z swing 12→90→12, look target the lateral point. Recommended: keep.
- ✅ **Q-6 (old-cube disposal):** Pinned disposal at midpoint. Recommended: keep. Keeping finished cube visible until arrival rejected (two live cube views would break AC-16 ceilings).
- ✅ **Q-7 (level-advance timing):** Pinned midpoint advance. Recommended: keep. Advancing at travel start or end would produce wrong visual.
- ✅ **Q-8 (future online occupancy):** Server-assigned spawn positions with occupancy checks documented as future hook only. Not designed here. Genuinely user-owned.

No deferral issues identified. All open questions are genuinely user-owned, clearly stated, and carry recommendations.
