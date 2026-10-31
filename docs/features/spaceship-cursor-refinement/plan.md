---
feature: spaceship-cursor-refinement
revision: 1
---
# Plan — Spaceship Cursor Refinement

## Architecture

Frontend-only. Two constants in the existing spaceship constant home change value; no geometry, logic, or wiring changes:

1. **Constants** (`game/effects.ts`). Changed: `SPACESHIP_SCALE` 1.5 → 1.2, `SPACESHIP_CURSOR_NDC_OFFSET_X` -0.12 → -0.16. All other constants (including `SPACESHIP_CURSOR_NDC_OFFSET_Y`, `SPACESHIP_FOLLOW_TAU_MS`, `SPACESHIP_IGNITION_*`, `SHOT_TRAVEL_MS`) unchanged.
2. **Spaceship + shot manager** (`render/spaceship.ts`) is unchanged in code: it already reads `SPACESHIP_SCALE` and `SPACESHIP_CURSOR_NDC_OFFSET_X` from `effects.ts`, so the new values propagate without edits. The group scale and target position pick up the new constants automatically.
3. **Scene integration** (`render/scene.ts`) and **session** (`game/session.ts`) are unchanged.

Data flow is unchanged: pointermove → session → scene.setPointerTarget → stored NDC → per-frame update → spaceship position. Only the resulting target x shifts left and the group renders smaller.

## Interfaces / contracts

```ts
// game/effects.ts (changed values only)
export const SPACESHIP_CURSOR_NDC_OFFSET_X = -0.16; // was -0.12
export const SPACESHIP_SCALE = 1.2; // was 1.5
// all other constants unchanged
```

No interface, signature, or observable surface changes. `Spaceship.group.scale`, `spaceshipTargetPosition`, `spaceshipFollowFactor`, `ignitions`, `shots` keep their existing contracts; only the numeric outputs of two constants change.

## File inventory

| Path | New/Edit | Purpose |
| --- | --- | --- |
| `src/frontend/src/game/effects.ts` | Edit | Change `SPACESHIP_SCALE` and `SPACESHIP_CURSOR_NDC_OFFSET_X` values |
| `src/frontend/src/game/effects-spaceship.test.ts` | Edit | Update pinned constant assertions to new values |
| `src/frontend/src/render/spaceship.test.ts` | Edit | Update `spaceshipTargetPosition` expected vector to new offset |

`render/spaceship.ts`, `render/scene.ts`, `game/session.ts`, `scene-spaceship.test.ts`, and `session-spaceship.test.ts` are unchanged (they consume the constants or already assert behaviour independent of the offset).

## Key decisions

| # | Decision | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| D-1 | Reduce scale 1.5 → 1.2 only | "a lil bit smaller"; keeps the bullet-like silhouette, just less oversized | 1.0 (rejected: too small, reverts the polish intent) / 1.3 (rejected: barely visible change) |
| D-2 | Shift x offset -0.12 → -0.16 only | "more to the left side, a lil bit"; y stays so the vertical position is preserved | -0.14 (rejected: barely perceptible) / -0.20 (rejected: too far) |
| D-3 | Leave all other constants and code untouched | Smallest coherent change; no geometry/logic ripple | Editing spaceship.ts (rejected: unnecessary) |

## Risks & mitigations

- Hardcoded expected vectors in tests must be updated to the new offset; mitigation: pin the exact vector `(-0.445721, -0.334291, 6.025924)` in AC-2 and update `spaceship.test.ts`.
- Coverage: no new branches; existing tests already cover the touched constants; mitigation: run the frontend pre-gate and full coverage.
- Geometry type assertions depend on three.js class names; unchanged, so no risk.

## Open questions

See spec.md § Open questions (Q-1 … Q-4).