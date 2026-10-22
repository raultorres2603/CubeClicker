---
feature: cube-visual-polish-followup
revision: 2
---

# Plan — Cube Visual Polish Follow-up (backdrop coverage, intro approach, level arrival)

## Architecture

No new layers and no new modules: the existing four-layer architecture (pure `game/**` core → `render/**` three.js adapter → `input/**` mapping → `session.ts`/`ui/**` shell) is unchanged, and every edit lands inside an existing file (plus its colocated test). Dependency direction stays top→bottom; `game/**` stays DOM-free and three-free; the scene still receives snapshots pull-style and drains intents in order; the engine's click/rotation semantics are untouched — only *when within `travel`* the level advance fires.

| Layer | Change |
| --- | --- |
| `game/effects.ts` (pure) | +`TRAVEL_LEVEL_ADVANCE_P` (0.5), +`travelSwing(progress)` — the single home for the new non-grid constant and the symmetric swing (F2 convention: consumers import, never redefine) |
| `game/engine.ts` (pure) | `advanceTravel` fires the level advance (everything `advanceLevelAndRebuild` did except the phase switch) at the `travelMs · TRAVEL_LEVEL_ADVANCE_P` crossing, once; the phase switch to `playing` stays at `travelMs` |
| `render/starfield.ts` | Cone distribution (depth-anchored tans), camera anchor + view-axis swirl in `update(dtMs, travelProgress?, anchor?)`, symmetric expand→contract scale via `travelSwing` |
| `render/scene.ts` | `introCameraPose` becomes the straight dolly (target = origin, z = 60 − 48·easeOutCubic(p)); travel camera `z = 12 + 78·travelSwing(p)`; passes the camera anchor to `starfield.update`; everything else unchanged |
| `src/frontend/src/game/session.test.ts` | Test-only: re-pin the superseded first-frame intro pose literal `[36, 20, 24]` → `[0, 0, 60]` (line ~516–517, comment included) |

**Data flow (unchanged):** input → `engine.dispatch` → snapshot/intents → `scene.applyIntents`/`applySnapshot`/`update` → renderer. The starfield anchor and the swirl advance in `scene.update` → `starfield.update(dtMs, travelProgress, anchor)`; the intro dolly is a pure function of `phaseProgress` evaluated in `applySnapshot`; the travel camera and the starfield scale both read the raw travel progress and map it through `travelSwing`.

**The coverage argument (AC-1), restated for the builder (corrected in r2).** Every pinned camera pose is on the +z axis looking at the origin (identity quaternion). The star volume is a cone in *camera* space (anchor = camera pose): its cross-section at depth `d` is a **square** of half-side `d·STARFIELD_TAN` (`STARFIELD_TAN = tan(25°)·(7/3)·1.15 = 1.251258882715913`), and the frustum cross-section at depth `d` spans `±d·tan(25°)·aspect × ±d·tan(25°)`. A direction is inside the square in the starfield-local frame iff both its inverse-swirled slope components are ≤ `STARFIELD_TAN`; the longest such direction is the corner ray, whose length is the viewport circumradius — at most `√((tan(25°)·7/3)² + tan²(25°)) = 1.1840` at aspect 7/3. Because rotation preserves length, both components of the inverse-swirled corner slope are ≤ 1.1840 < 1.2513 = `STARFIELD_TAN`, at **every** swirl angle — the square's inradius exceeds every supported viewport circumradius, which is exactly the property the r1 rectangle lacked (its inradius was `TAN_Y = 0.5363`, so at swirl π/4 the corner's `|v|` reached 1.0991 and the pinned test failed). The swirl therefore stays the unbounded ambient drift; the expansion scales `(S,S,1)` about the anchor with `S ≥ 1` at every travel progress (superset). Depth is `[20, 160]` — all inside the far plane (depth ≤ 160 < 200). Therefore the backdrop provably covers the viewport in every phase, at every supported aspect, at every swirl angle, including the maximum expansion. The tests verify exactly this property against the *real* frustum (and fail loudly if the constants diverge).

## Interfaces / contracts

Pinned enough for an independent builder; wording may vary slightly if semantics hold.

### `game/effects.ts` (additions)

```ts
/** Travel-progress fraction at which the level advances (spec AC-3): the midpoint. */
export const TRAVEL_LEVEL_ADVANCE_P = 0.5;

/**
 * Symmetric travel swing (spec AC-3): rises with easeInOutQuad over the first half
 * (easeInOutQuad(2p)) and falls over the second (1 − easeInOutQuad(2p − 1)); clamped;
 * total function of `progress`. Drives both the travel camera and the backdrop scale:
 * camera z = 12 + 78·travelSwing(p); starfield scale = 1 + 7·travelSwing(p).
 */
export function travelSwing(progress: number): number;
```

Pinned outputs (exact, asserted in `effects.test.ts`): `0→0, 0.125→0.125, 0.25→0.5, 0.375→0.875, 0.5→1, 0.625→0.875, 0.75→0.5, 0.875→0.125, 1→0`; `travelSwing(-1) = 0`, `travelSwing(2) = 0`; pure, three-free, DOM-free.

### `render/starfield.ts` (distribution, anchor, swirl, scale)

```ts
/** Camera pose the starfield anchors to (caller-owned references; never copied per frame). */
export interface StarfieldAnchor {
  position: Vector3;
  quaternion: Quaternion;
}

export interface Starfield {
  readonly points: Points<BufferGeometry, PointsMaterial>;
  /**
   * Advances the backdrop by `dtMs`: accumulates the swirl angle (max(0, dtMs) · DRIFT),
   * re-anchors the Points to the camera (position = anchor.position, quaternion =
   * anchor.quaternion × RotZ(swirlAngle); no anchor → world-identity anchor), and applies
   * the travel scale (S,S,1), S = 1 + 7·travelSwing(clamp(progress)) when progress is
   * provided (z stays 1). Omit progress to keep the current scale.
   */
  update(dtMs: number, travelProgress?: number, anchor?: StarfieldAnchor): void;
  dispose(): void;
}
```

Constants (in `starfield.ts`, documented as the coverage contract — verified by the AC-1 corner-ray tests rather than re-pinned by formula): `STARFIELD_DEPTH_NEAR = 20`, `STARFIELD_DEPTH_FAR = 160`, `STARFIELD_ASPECT_MAX = 7 / 3`, `STARFIELD_COVERAGE_MARGIN = 0.15`, `STARFIELD_TAN = Math.tan(Math.PI * 50 / 360) * STARFIELD_ASPECT_MAX * (1 + STARFIELD_COVERAGE_MARGIN)` (= `1.251258882715913` — the single square half-tan used for **both** axes; r2 replaces the r1 `STARFIELD_TAN_X`/`STARFIELD_TAN_Y` pair), `DRIFT_RADIANS_PER_MS = 1 / 65536` (retained). `STAR_SIZE` 0.6, `STAR_MIN_BRIGHTNESS` 0.5, the material pins and `STAR_COUNT` (imported) stay.

Distribution (draw order per star kept at `x → y → depth → brightness`, 4 draws): `depth = 20 + draw·140`; `x = (draw − 0.5)·2·depth·STARFIELD_TAN`; `y = (draw − 0.5)·2·depth·STARFIELD_TAN`; `z = −depth`; brightness unchanged (`0.5 + draw·0.5`). The swirl keeps one preallocated `Quaternion` and an accumulated scalar (zero per-frame allocation); `frustumCulled` stays default (the anchored cone's bounding sphere always contains the camera, so culling never hides it).

### `render/scene.ts` (intro dolly, symmetric travel, anchor wiring)

```ts
/** Intro start distance (spec AC-2) — the original AC-22 value, now always pointing at the cube. */
const INTRO_START_Z = 60;   // replaces the INTRO_SEARCH_*/INTRO_FIND_* constants

/** Pure intro dolly (spec AC-2): target (0,0,0) at every clamped progress;
 *  position (0, 0, 60 − 48·easeOutCubic(clamp(progress))). */
export function introCameraPose(progress: number, outPosition: Vector3, outTarget: Vector3): void;
```

- `applyCamera`: `intro` branch → `introCameraPose(progress, introPosition, introTarget)` + `camera.lookAt(introTarget)` (unchanged wiring); `travel` branch → `travelProgress = progress` and `camera.position.set(0, 0, REST_Z + (TRAVEL_END_Z − REST_Z) * travelSwing(progress))` + `camera.lookAt(ORIGIN)` (`REST_Z` 12, `TRAVEL_END_Z` 90 retained); `reducedMotion` and `playing` branches unchanged.
- `update(dtMs)`: `starfield.update(dtMs, travelProgress, starfieldAnchor)` where `const starfieldAnchor: StarfieldAnchor = { position: camera.position, quaternion: camera.quaternion }` is created once beside the camera (live references — the anchor follows the camera with zero allocation).
- `applyIntents`/`applySnapshot`/`applyExplosion`/fades/pops: unchanged (the `levelChanged` handling already rebuilds the cube view in the new style — only the moment it fires moves, engine-side).
- Everything else (`snapToQuarterTurns`, disposal, the composition) unchanged.

### `game/engine.ts` (midpoint level advance)

Split `advanceLevelAndRebuild` into:

```ts
/** Level advance without the phase switch: progression +1, fresh board, orientation reset,
 *  queued step/fade cleared, one `levelChanged` intent, snapshot invalidated. */
function advanceLevel(): void;

function advanceTravel(dtMs: number): void {
  const before = phaseElapsedMs;
  phaseElapsedMs += dtMs;
  const timings = currentTimings();
  const midpoint = timings.travelMs * TRAVEL_LEVEL_ADVANCE_P;
  if (phaseElapsedMs >= midpoint && (before < midpoint || midpoint <= 0)) {
    advanceLevel();                       // exactly once per travel (the crossing guard)
  }
  if (phaseElapsedMs >= timings.travelMs) {
    phase = 'playing';
    phaseElapsedMs = 0;
    invalidate();
    return;
  }
  invalidate();
}
```

`advancePlaying`/`advanceIntro`/dispatch/`drainIntents`/`getSnapshot`/`setReducedMotion` unchanged. Import `TRAVEL_LEVEL_ADVANCE_P` from `./effects`.

### `session.test.ts` (test-only re-pin)

Line ~516–517: the first-frame assertion `camera.position.toArray()).toEqual([36, 20, 24])` (and its "intro search's opening pose" comment) becomes `[0, 0, 60]` ("the intro dolly's opening pose"). No other line of that file changes.

## File inventory

| Path | New/Edit | Purpose | Owner task |
| --- | --- | --- | --- |
| `src/frontend/src/game/effects.ts` | Edit | +`TRAVEL_LEVEL_ADVANCE_P`, +`travelSwing` | T1 |
| `src/frontend/src/game/effects.test.ts` | Edit | Pin the constant and the swing table; replace the AC-22 travel-position helper with the `travelSwing`-derived camera/scale tables; keep the intro helper values | T1 |
| `src/frontend/src/render/starfield.ts` | Edit | Cone distribution, camera anchor + view-axis swirl, symmetric scale | T2 |
| `src/frontend/src/render/starfield.test.ts` | Edit | Distribution bounds, determinism, swirl rate, anchor copy, scale table, clamping, identity/no-rebuild, dispose | T2 |
| `src/frontend/src/render/scene.ts` | Edit | Straight-dolly `introCameraPose`, `travelSwing` travel camera, anchor wiring | T2 |
| `src/frontend/src/render/scene.test.ts` | Edit | AC-1 corner-ray coverage + per-cell density; AC-2 pose table/monotonic/framing gates; AC-3 travel table/mid-travel rebuild/landing; retained groups | T2 |
| `src/frontend/src/game/session.test.ts` | Edit | Test-only: re-pin the intro opening-pose literal (one assertion block) | T2 |
| `src/frontend/src/game/engine.ts` | Edit | Midpoint level advance in `advanceTravel` | T3 |
| `src/frontend/src/game/engine.test.ts` | Edit | Arrival timeline (default/reduced/single-call/once-only), arrival-half snapshot, input gating; retained groups keep passing | T3 |
| `docs/features/cube-visual-polish-followup/build-log-T1.md` … `-T4.md` | New | Per-task evidence | T1…T4 |

## Files intentionally unchanged

| Path | Why |
| --- | --- |
| `src/frontend/src/game/{board,progression,rotation,types}.ts` (+tests) | No board/style/rotation/type change |
| `src/frontend/src/game/session.ts`, `src/frontend/src/browser-env.ts`, `src/frontend/src/render/{webgl,cube-view,particles,picking}.ts` (+tests except `session.test.ts`'s one literal) | Unaffected behaviors; the session's loop order (intents → snapshot → update → render) already feeds the anchor |
| `src/frontend/src/input/{keyboard,gestures}.ts` (+tests) | Travel gating is unchanged (the arrival stays inside `travel`) |
| `src/frontend/src/App.tsx`, `src/frontend/src/main.tsx`, `src/frontend/src/ui/**`, `src/frontend/src/ws/**`, `src/frontend/index.html`, `App.test.tsx` | Shell/live-region/copy unchanged ("Traveling to the next cube…" still covers the whole transition) |
| `src/frontend/package.json`, `package-lock.json`, configs, `compose*.yaml`, Dockerfiles, `src/backend/**`, `tests/e2e/**`, `README.md`, `docs/features/cube-game-frontend/**`, `docs/features/cube-visual-polish/**`, `docs/product/glossary.md` | No dependency, container, backend, or accepted-artifact change; no new glossary term |

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Backdrop = camera-anchored **square cone** (depth ∈ [20, 160], square cross-section with the single half-tan `STARFIELD_TAN = tan(25°)·(7/3)·1.15 = 1.251258882715913` on both axes), drift = **view-axis swirl** at the retained rate | The defect is the bounded disk + rigid world-yaw drift (the disk's projection stops spanning the viewport after ~30–50 s; see spec § 1 diagnosis). A cone anchored to the camera covers the frustum at every pinned pose/aspect *by construction*. The r1 rectangle failed the pinned corner-ray test at swirl π/4 (inradius `TAN_Y = 0.5363` vs corner slopes up to 1.0991 — the T2 block); the **square** fixes it: its inradius 1.2513 exceeds every supported viewport circumradius (1.1840 at 7/3) and rotation preserves corner-ray length, so the coverage criterion holds at **every** swirl angle. The uniform-over-the-square distribution keeps on-screen density constant (≈ 296 stars at 16:9 rest scale — every sustained view holds ≥ 5 stars per 4×4 cell). The expansion (S ≥ 1) is a superset of the cone, so coverage holds at the maximum expansion | Enlarging the static disk (rejected: yaw drift still edge-ons it; wider cross-section dilutes on-screen density by area); rotating per-star positions (rejected: buffer rewrites, weaker proof); a spherical shell (rejected: near-plane/cube-front stars, harder exact tests); a **circular cone** (rejected: changes the pinned `x → y → depth` draw scheme and the determinism fixtures for no stronger guarantee); **bounding the swirl** to the rectangle's safe angle ≈ 0.086 rad at 16:9 (rejected: defeats the ambient unbounded drift after ≈ 5.6 s — the T2 report); billboarding with the camera quaternion only (accepted — the anchor copies the full quaternion so the mechanism survives future oblique poses) |
| D-2 | Intro = straight dolly `z = 60 − 48·easeOutCubic(p)`, target always the origin | Exactly the user's ask (far away, pointing at the cube, approaching it); reinstates the original accepted AC-22 values with the pointing guarantee; strictly monotonic; fully framed at every progress for aspect ≥ 2/3 (corner half-angle 14.74° < 17.27° at the closest pose) | Keeping any search/pan segment (rejected — the user's complaint); a two-segment path (rejected — adds constants for no observable gain); a larger start distance (rejected — Q-2; 60 is the accepted value) |
| D-3 | Arrival inside the existing `travel` phase: symmetric `travelSwing` halves, level advance at `p = 0.5`, turn-around at `(0,0,90)`, expansion peak 8 contracting to 1 | No new phase → the engine phase machine, input gating, HUD live region, and session wiring stay untouched; the new cube appears 90 units away at the turn-around and grows during the fly-in — "we go to the next cube"; the symmetric swing lands exactly on the rest values (no snap at the phase boundary); one pure shared function drives both the camera and the scale | A new `arrival` phase (rejected — engine/type/input/HUD blast radius, contradicts the brief's recommendation); level advance at travel start (rejected — the cube would shrink then grow); keeping the advance at the end (rejected — that *is* the reported pop); moving the scene-only camera while the engine advances at the end (rejected — the engine owns the level, the camera would land on an unbuilt cube) |
| D-4 | Starfield cone constants live in `starfield.ts`, verified against the *real* frustum by the AC-1 corner-ray tests | The coverage property (not the formula) is the contract: if the FOV in `scene.ts` or the tans ever diverge, the corner-ray test fails the build. Avoids a scene↔starfield import cycle | Moving the lens constants to `game/effects.ts` (rejected — render-only values in the pure layer; the predecessor kept lens constants in `scene.ts`); passing the tans as `createStarfield` options (rejected — more wiring for the same guarantee) |
| D-5 | `travelSwing` and `TRAVEL_LEVEL_ADVANCE_P` in `game/effects.ts` (F2 single-home convention) | Same convention as `STAR_COUNT`/`TRAVEL_STARFIELD_SCALE`; scene and starfield and engine import, never redefine; the pinned tables are derived once | Scene-local swing (rejected — the starfield and the camera must never drift apart mid-transition); engine-local advance constant (rejected — precedent violation) |
| D-6 | `T1 → T2` and `T1 → T3`, with `T2 ∥ T3` | T2 and T3 own disjoint file sets with no shared-file contact (both only *import* T1's exports); each intermediate tree is green because T2's scene tests drive snapshots/intents directly (no engine-timing dependency) and T3's engine tests never touch the scene. The integrated visuals land at T4's verify | Full sequencing (rejected — no compile-order constraint exists between render and engine here; the predecessor sequenced because its T2/T3 shared a snapshot-type landmine, which this feature does not have) |
| D-7 | The anchor is `{ position, quaternion }` referencing the live camera vectors, applied in `update` | Zero per-frame allocation; the loop order (applySnapshot → update → render) guarantees the rendered frame uses the current camera pose; copying the quaternion keeps the mechanism correct if a future pose is oblique (the swirl stays about the view axis) | Rebuilding a matrix each frame (rejected — allocation); anchoring in `applySnapshot` (rejected — `update` already owns the frame-driven parts) |

## Risks & mitigations

- **Exact-float swirl assertion.** `update(1000)` must yield a rotation the test pins exactly. The retained rate `1/65536` and the pure-z compose mirror the landed y-axis drift assertion (which passes exactly today); the builder pins `points.rotation.z === 0.0152587890625` and, if three's euler round-trip differs by ulps, pins the exact composed doubles with an in-test comment — no `toBeCloseTo` (bounded-exception budget stays 0). The quaternion-compose semantics (x = 0, y = 0, z = sin(θ/2), w = cos(θ/2)) are pinned independently.
- **Coverage-test pose sensitivity.** The corner-ray test uses the real `PerspectiveCamera` at the pinned poses/aspects (unprojected near/far points → direction slopes, inverse-rotated by the swirl) compared with exact inequalities against the single `STARFIELD_TAN` (square inradius 1.2513 vs the largest supported viewport circumradius 1.1840 ≈ 5.7% margin, plus the constant's own 15% derivation margin — far from any boundary). A failure means the constants diverge from the frustum — loud, not flaky; the pre-fix failure at swirl π/4 is the recorded negative evidence.
- **Seeded density floors.** The per-cell floors (≥ 5 of ≈ 18.5 expected per 4×4 cell at rest scale with the square cone; ≥ 2 of ≈ 5 expected at the scale-8 peak) are pinned after the builder computes the actual seeded counts (the T2 report already recorded the rectangle's 711 total / 13 peak — the square's values are re-measured on re-dispatch); if the seed lands below a floor, the builder reports `blocked` with the measurement rather than weakening the assertion — pinned values change only via a spec revision.
- **Arrival consistency across the task boundary.** Mid-chain (T2 without T3) the scene lands the camera at rest before the engine's end-of-travel advance — visually inconsistent but green (tests are layer-local); the integrated behavior lands at T4, whose verify re-runs the full suite and the per-AC table.
- **Engine once-only guard edge cases.** `travelMs = 0` (injected weird timings) must still advance the level (`midpoint <= 0` arm) and switch the phase; `advance(dtMs ≤ 0)` stays a no-op; a single advance crossing both thresholds fires the level advance first, then the phase switch. Each is a pinned engine test.
- **Regression into the accepted features' artifacts.** The supersession table is the only bridge; `git diff` on `docs/features/cube-game-frontend/**` and `docs/features/cube-visual-polish/**` must be empty at the final gate.
- **Bundle/coverage regressions.** The changes add ~2 constants + one pure function and rewrite two render paths — the bundle can only stay flat; per-task workspace coverage runs catch any dip; if a metric cannot honestly clear 80, report `blocked` (no carve-outs).

## Open questions

- Q-1…Q-5 mirror spec § Open questions (supported aspect range; intro start distance; arrival geometry; travel-peak star density; reduced-motion instant swap). All recommended defaults are pinned in the artifacts; every alternative is a constant-only change with a spec-revision note (the aspect-range widening additionally touches the accepted rest pose — a user-owned constant change).

## Revision history

- r1 — 2026-10-21 — initial draft (planning phase).
- r2 — 2026-10-21 — correction per the T2 block (build-log-T2.md § The blocker): the rectangular-cone invariance claim was false at swirl π/4; the cone is now a **square** (`STARFIELD_TAN` on both axes — inradius 1.2513 ≥ the largest supported viewport circumradius 1.1840), § The coverage argument, D-1, § Interfaces (starfield constants) and the density numbers (≈ 296 visible at 16:9; per-cell ≥ 5 of ≈ 18.5; peak ≥ 2 of ≈ 5) updated; the circular-cone and swirl-bounding options recorded as rejected. D-2…D-7, the intro/travel/engine contracts, and the file inventory are unchanged.
