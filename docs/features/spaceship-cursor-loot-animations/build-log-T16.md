# Build log — T16 — Wire ship fly-by to level completion

Task: T16 (2026-11-09; post-code-review r1 fix)
Feature: `spaceship-cursor-loot-animations` (spec r4, tasks r4)
Files changed:
- `src/frontend/src/render/scene.ts`
- `src/frontend/src/render/scene-spaceship.test.ts`
- `src/frontend/src/ui/SpaceshipCustomizationPanel.test.tsx` (review MINOR F3 only)
- `docs/features/spaceship-cursor-loot-animations/build-log-T14.md` (review MINOR F2 + fly-by claim)
- `docs/features/spaceship-cursor-loot-animations/build-log-T16.md` (this file)

What changed & why: code review r1 F1 blocked AC-40 because `Spaceship.startFlyBy()` was only exercised by `spaceship.test.ts`. The scene now tracks the previous `EngineSnapshot.levelIndex` in `applySnapshot` and starts exactly one fly-by on a rise — the same snapshot transition that mounts the App's `LevelCompleteBanner` — through a new `SceneView.triggerFlyBy()` seam. The fly-by animation itself is untouched. The integration tests wrap `createSpaceship` to record `startFlyBy` calls and assert one 700 ms/360° roll on the 1.2-world orbit with the 16-point fire trail, the return to pointer-follow, and reduced-motion cancellation. F3 replaces the `toBeTruthy()` assertion with the reveal button's exact class; F2 corrects the T14 BASE/HEAD block to the re-run tree `0bfc524` and evidence commit `8d4c633`, and corrects the harness-driven fly-by claim.

## Decisions

- **Production signal:** the scene already receives the authoritative `EngineSnapshot` every frame from the session. Detecting the `levelIndex` rise there needs no new session/App/GameCanvas surface (neither `App.tsx` nor `GameCanvas.tsx` can reach the scene handle), and it is exactly the effect condition the App uses for the banner (`levelIndex > previous`, first snapshot ignored). App/GameCanvas/session remain unchanged — no scope expansion.
- **Exactly once:** `triggerLevelFlyBy()` no-ops when the scene is disposed, when the snapshot is reduced-motion, or while `spaceship.isFlyingBy()` is already true; a repeated same-level snapshot therefore never restarts the roll. A rise still starts one new roll per completion.
- **Reduced motion:** no roll is started (AC-40/AC-48); a live switch mid-roll is cancelled by the existing `Spaceship.update` reduced-motion path, which also clears the trail.
- **No animation change:** only the trigger/guard was added; `spaceship.ts` and the 700 ms orbit/roll/fire-trail math are untouched.

## Evidence

### `npm run lint`

```text
> lint
> eslint .
lint_exit=0
```

### `npm run typecheck --workspace @cubeclicker/frontend`

```text
> typecheck
> tsc --noEmit
typecheck_exit=0
```

### Targeted suite (new integration tests)

```text
$ npm test --workspace @cubeclicker/frontend -- --run src/render/scene-spaceship.test.ts src/ui/SpaceshipCustomizationPanel.test.tsx
 ✓ src/render/scene-spaceship.test.ts (27 tests) 723ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (28 tests) 867ms
 Test Files  2 passed (2)
      Tests  55 passed (55)
```

The three new `scene level-complete fly-by (AC-40)` specs:

```text
✓ starts exactly one 700 ms roll on the production levelIndex rise and returns to pointer-follow
✓ does not start under reduced motion and cancels a running roll on a live switch
✓ ignores a direct trigger while a roll is already running
```

### `npm test --workspace @cubeclicker/frontend`

```text
 ✓ src/render/scene-spaceship.test.ts (27 tests) 723ms
 ✓ src/ui/SpaceshipCustomizationPanel.test.tsx (28 tests) 867ms
 Test Files  63 passed (63)
      Tests  1700 passed (1700)
test_exit=0
```

(1,697 before T16 + 3 new integration specs.)

### `npm run coverage --workspace @cubeclicker/frontend`

```text
 Test Files  63 passed (63)
      Tests  1700 passed (1700)
All files          |   96.34 |     95.3 |   97.43 |   96.34 |
  scene.ts         |   97.23 |    95.67 |   95.34 |   97.23 |
  spaceship.ts     |   96.07 |    96.33 |   96.42 |   96.07 |
coverage_exit=0
```

Thresholds are 80 statements / branches / functions / lines per workspace: frontend **96.34 / 95.3 / 97.43 / 96.34** — PASS. No Vitest config or exclusion changed.

### Test-level evidence for the AC-40 mechanism

- `applySnapshot` on `levelIndex: 0` → `startFlyBy` calls **0**.
- `applySnapshot` on `levelIndex: 1` (production completion transition) → `startFlyBy` calls **1**.
- 20 × 17.5 ms = 350 ms → ship at `(-2.4, 0, 6)`, roll `π`, fire trail `16` / `MOTION.fireTrailCount`.
- Re-applying the same `levelIndex: 1` mid-roll → still **1** call (no restart).
- 20 × 17.5 ms = next 350 ms → ship back at `(0, 0, 6)`, roll `0` (full 700 ms turn complete); the next 16 ms frame follows the pointer with the 240 ms factor from the end pose.
- Reduced-motion level rise → **0** calls; live reduced switch at 350 ms → `isFlyingBy()` false, roll `0`, trail `0`.

## Acceptance audit

- **AC-40 — met.** The production level-completion path (`levelIndex` rise in the scene snapshot stream, the same signal as `LevelCompleteBanner`) invokes `spaceship.startFlyBy()` exactly once; the integration test proves the 700 ms 360° roll on the 1.2-world orbit, the 16-point fire trail, the return to pointer-follow and reduced-motion cancellation. No camera/HUD shake, banner/DOM burst behavior unchanged. The T14 fly-by claim is corrected to state the original screenshot was harness-driven and is now reproducible through the shipped trigger.
- **Review F2 — met.** `build-log-T14.md` now records feature `BASE = f07d067…`, verification `BASE = 0bfc524beab8f6eb618958a93c9cd19b23778f56` (tree the gates ran on), `HEAD = 8d4c6334c8e4a0201d334072f7258ecb3bd42ec7` (evidence commit), the earlier `512c01b` run, and the T15/T16 fixes.
- **Review F3 — met.** `SpaceshipCustomizationPanel.test.tsx` now asserts the reveal button's exact `className` (`customization-reveal-equip`) instead of `toBeTruthy()`.

## Deviations from spec: none

No new dependencies; no change to `spaceship.ts`, the fly-by animation, backend/protocol/parts/CSS/configs/containers, or `docs/features/README.md`. Staged only the files listed above.
