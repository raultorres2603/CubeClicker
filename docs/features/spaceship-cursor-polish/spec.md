---
feature: spaceship-cursor-polish
revision: 3
status: draft
created: 2026-10-27
updated: 2026-10-27
---
# Spec — Spaceship Cursor Polish

## Summary

A frontend-only follow-up to the accepted `spaceship-cursor` feature. The spaceship is made larger and more bullet-like (a scaled, cylinder-bodied craft instead of the small cube-ish primitive), sits farther from the cursor arrow on a diagonal instead of directly in front of it, trails the pointer with a longer smoothing delay, and gains reactive ignition flames that animate while the ship is moving. Game rules, shot timing, deferred explosions, pointer tracking, and reduced-motion collapse are unchanged; only the spaceship's constants, geometry, follow delay and local visual (ignition fire) change. The feature is local to one client: no shared/cross-client state, backend, protocol, container, or persistence change is made.

## User stories

- As a player, the spaceship trails my cursor farther away and on a diagonal, so it reads as a craft behind the arrow rather than overlapping it.
- As a player, the spaceship looks larger and bullet-like, not like a small cube.
- As a player, the spaceship lags more behind the pointer, so its floating motion reads as a heavier craft.
- As a player, when the spaceship moves, its ignitions animate with fire, so motion feels alive.
- As a player who prefers reduced motion, the spaceship still snaps to the cursor and ignitions stay inactive, so there is no motion sickness.

## Acceptance criteria

Verification notes: "the frontend workspace" means `src/frontend`. Evidence per AC: a test file asserting concrete values, or a command. All tests use concrete expected values (no banned matchers, no useless tests). Commands (from `AGENTS.md`): `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend` (pre-gate), full `npm run coverage` (final gate), `npm run build`.

- **AC-1 — Polished constants are pinned.** `SPACESHIP_FOLLOW_TAU_MS === 240`, `SPACESHIP_CURSOR_NDC_OFFSET_X === -0.12`, `SPACESHIP_CURSOR_NDC_OFFSET_Y === -0.12`, `SPACESHIP_SCALE === 1.5`, `SPACESHIP_IGNITION_COUNT === 2`, `SPACESHIP_IGNITION_MOVEMENT_THRESHOLD === 0.01`, `SPACESHIP_IGNITION_FLICKER_PERIOD_MS === 100`. `SHOT_TRAVEL_MS` remains `180`. Evidence: `effects-spaceship.test.ts`.
- **AC-2 — Follow factor uses the new delay.** `spaceshipFollowFactor(240, false) === 1 - 1 / Math.E` (tolerance 1e-6); `spaceshipFollowFactor(0, false) === 0`; under reduced motion the factor is `1` for any `dtMs >= 0`. Evidence: `spaceship.test.ts`.
- **AC-3 — Spaceship is farther from the cursor on a diagonal.** `spaceshipTargetPosition(camera, ndcX, ndcY)` is unchanged in method (ray through the offset NDC at `SPACESHIP_PLANE_DISTANCE`) but uses the new offsets. At NDC `(0, 0)` on the default camera (position `(0, 0, 12)`, FOV 50, aspect 1) the result is approximately `(-0.334695, -0.334695, 6.018699)` (tolerance 1e-6 on each component). Evidence: `spaceship.test.ts`.
- **AC-4 — Spaceship is larger and bullet-like.** `createSpaceship().group.scale` is `(SPACESHIP_SCALE, SPACESHIP_SCALE, SPACESHIP_SCALE)`. The group contains at least one mesh whose `geometry.type === 'ConeGeometry'` and at least one whose `geometry.type === 'CylinderGeometry'`, and no mesh whose `geometry.type === 'BoxGeometry'`. Evidence: `spaceship.test.ts`.
- **AC-5 — Ignition flames are present and reactive.** `createSpaceship()` exposes `ignitions: readonly Mesh[]` of length `SPACESHIP_IGNITION_COUNT`, each named `'ignition'`. Ignitions are created with `visible === false` and `getIgnitionIntensity() === 0`. At rest (no pointer) `getIgnitionIntensity() === 0` and every ignition mesh has `visible === false`. After an `update` that moves the ship (non-reduced motion, `dtMs === 120`, pointer present, resulting movement delta ≥ `SPACESHIP_IGNITION_MOVEMENT_THRESHOLD`) `getIgnitionIntensity() > 0` and at least one ignition mesh has `visible === true`. Under reduced motion `getIgnitionIntensity() === 0` and every ignition mesh has `visible === false` even after a moving update. Evidence: `spaceship.test.ts`.
- **AC-6 — Ignition animation advances while moving.** Two consecutive moving updates with the same non-zero `dtMs` (e.g. `120`) that both produce a movement delta ≥ `SPACESHIP_IGNITION_MOVEMENT_THRESHOLD` produce different ignition flame scale on at least one ignition mesh (`scale.z` after the second update is not equal to `scale.z` after the first, tolerance 1e-9). When the ship does not move (no pointer, or `dtMs === 0`, or a sub-threshold movement delta) the ignition time does not advance and intensity stays `0`. Evidence: `spaceship.test.ts`.
- **AC-7 — Spaceship shot behaviour is preserved.** `SHOT_TRAVEL_MS` remains `180`; `spawnShot`, `updateShots`, midpoint-at-90-ms and completion-after-180-ms behaviour, and the scene's deferred-explosion/arrival behaviour are unchanged. Evidence: `spaceship.test.ts`, `scene-spaceship.test.ts`.
- **AC-8 — Reduced motion collapses delay and ignitions.** Under reduced motion the follow factor is `1` for any `dtMs >= 0`, the ship snaps to the target, and ignitions remain inactive. Evidence: `spaceship.test.ts`, `scene-spaceship.test.ts`.
- **AC-9 — Coverage.** `npm run coverage` (both workspaces) exits 0 with ≥ 80% statements/branches/functions/lines per workspace; frontend pre-gate `npm run coverage --workspace @cubeclicker/frontend` is the task-level check. Evidence: final build log.
- **AC-10 — No container or backend change.** `git diff` for `compose.yaml`, `compose.smoke.yaml`, `src/backend/**`, Dockerfiles is empty. Evidence: final build log.

## Non-goals

- No change to game rules, stats, intents, phase sequencing, level progression, server protocol, or persistence. The engine's `explodeMiniCube` path is untouched; `clicks` and board removal stay synchronous at click time.
- No change to shot timing or deferred explosion semantics: `SHOT_TRAVEL_MS` stays `180`, origin/normal captured at fire time, burst uses retained frame time.
- No change to pointer tracking formula or `SPACESHIP_PLANE_DISTANCE`.
- No multiplayer visibility of the spaceship or ignitions: they remain local to one client.
- No audio, no new dependencies, no textures/assets, no shaders.
- No customisation UI (future feature; constants and geometry remain the seam).
- No browser automation or pixel/perceptual tests.
- No change to the existing reduced-motion decision to snap (not hide) the spaceship.

## Boundaries

- ✅ Always: keep `game/**` pure and DOM-free; named tree-shakeable imports from `three`; tests with concrete expected values beside every behavior change; run lint, typecheck, tests, and the coverage command before reporting done; record raw evidence in build logs; stage only `files_owned` per task.
- ⚠️ Ask first: any new dependency (none needed); any pinned-constant deviation from this spec; touching any file outside a task's `files_owned`; any coverage exclusion or threshold change; any change to backend/container files.
- 🚫 Never: weaken assertions (banned matchers, snapshot-only, assertion-free, useless tests); exclude production code from coverage; touch `.env*`, secrets, backend/container files, `main.tsx`, or configs; use `import *` from `three`; read browser globals inside `game/**` or pure render math; push; rewrite predecessor specs.

## Security considerations

- **No new dependencies.** Only existing `three` named imports (including `CylinderGeometry`); `BoxGeometry` is dropped where it becomes unused (F2); lockfile untouched.
- **No user data, storage, or network.** All state is in-memory per client; nothing is persisted or sent. Ignitions are a local visual; no new message types.
- **Rendering safety.** Fully procedural geometry (cone + cylinder + sphere + ignition cones); no loaders, textures, or external assets; no `innerHTML`.
- **Resource bounds.** Ignitions are created once with the spaceship and reused; `dispose()` clears them. No unbounded growth.
- **Test integrity.** Coverage bar and concrete-assertion rule protect the unchanged pure logic and server-authority paths.

## Real-time impact

**None for shared state.** The spaceship, its pointer target, the ignitions and the shots are client-local visuals: no shared or cross-client state is created or read, no protocol message is added, and connection lifecycle, reconnection, multi-client behavior, and server authority are unaffected (they remain as in the predecessor features). **Open question Q-1** carries over whether other clients should see a player's spaceship; the default (local-only) is chosen and flagged.

## Containerization impact

**None expected.** Frontend source changes only: no new services, images, ports, environment variables, or health signals; no compose/Dockerfile/README change. The frontend image absorbs the diff through the existing build; the unchanged containerized smoke test (`npm run smoke`) remains the regression check at the final gate where the environment allows it.

## Testing strategy

- **Unit (Vitest, node environment):** `effects-spaceship.test.ts` pins the changed/new constants (`SPACESHIP_FOLLOW_TAU_MS` 240, offsets -0.12, `SPACESHIP_SCALE` 1.5, `SPACESHIP_IGNITION_COUNT` 2, threshold 0.01, flicker period 100, `SHOT_TRAVEL_MS` 180). `spaceship.test.ts` pins `spaceshipFollowFactor`, `spaceshipTargetPosition` (new expected vector), the bullet-like geometry/scale, and ignition presence/reactivity/animation.
- **Integration (same node environment — real three.js scene graph):** `scene-spaceship.test.ts` asserts spaceship presence, follow smoothing with the new tau, shot spawn/travel/arrival, reduced-motion collapse, disposal/rebuild safety. Existing assertions are updated to the new tau/offsets; no new scene-level ignition assertions are required because ignition state is owned by the spaceship.
- **E2E / container:** no browser automation (predecessor non-goal retained); `npm run smoke` unchanged, run at the final gate where the environment allows.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace (frontend pre-gate: `npm run coverage --workspace @cubeclicker/frontend`); config exclusions unchanged (only `src/main.tsx` + test patterns). If a metric cannot honestly clear 80, the task reports `blocked` — no carve-outs.

## Open questions

- **Q-1 — Cross-client visibility (carried over, user checkpoint).** Default: the spaceship, ignitions and shots are local to one client. Broadcasting a lightweight pointer position would need a protocol addition and server authority; not implemented. Choosing it requires a spec revision.
- **Q-2 — Visual vs. state timing (carried over, user checkpoint).** Default: game state (board/stats) stays synchronous at click; only the explosion *visual* (pop + burst) is delayed to shot arrival. Delaying the engine's `explodeMiniCube` itself changes game rules and is not implemented.
- **Q-3 — Spaceship shape (updated).** Pinned: a scaled craft with an elongated cone nose, a cylinder body (bullet-like), a sphere cockpit and ignition cones, built from `three` primitives with `SPACESHIP_SCALE = 1.5`. Dimensions are tunable with a spec note.
- **Q-4 — Shot appearance.** Unchanged: a small sphere mesh travelling linearly; no trail geometry.
- **Q-5 — Reduced motion.** Pinned: spaceship snaps to the cursor (no smoothing) and explosions apply instantly with no shot; ignitions stay inactive. Alternative: hide the spaceship entirely under reduced motion (not chosen).
- **Q-6 — Ignition count and placement.** Pinned: `SPACESHIP_IGNITION_COUNT = 2` flames at the ship's rear. Count/placement are tunable with a spec note.
- **Q-7 — Offset magnitude.** Pinned: `-0.12` on both NDC axes. A different diagonal (e.g. `-0.10` / `-0.16`) is a constant edit plus a spec note.
- **Q-8 — Follow delay magnitude.** Pinned: `SPACESHIP_FOLLOW_TAU_MS = 240`. A heavier (`300`) or lighter (`180`) delay is a constant edit plus a spec note.

## Assumptions

- The pointer is tracked via Pointer Events on the canvas (existing single input path); `pointermove` is unchanged.
- Ignition animation is driven by the per-frame movement delta of the spaceship group and an accumulated time; no new timers or DOM access.
- Reduced motion disables ignition visibility and intensity even though the ship snaps.
- Predecessor specs/plan/tasks stay authoritative for everything not superseded; this spec is read alongside them and never edits them.
- Stack unchanged: `three@0.186.1` / `@types/three@0.186.0`, TypeScript strict, Vitest, ESLint; the project testing bar governs.

## Revision history

- r1 — 2026-10-27 — initial draft (planning phase).
- r2 — 2026-10-27 — revision after spec review r1: corrected AC-3 expected vector (F1); pinned ignition trigger dtMs/threshold and animation inequality conditions (F2); added ignition creation-hidden and reset/no-movement semantics (F3, F5); tightened flicker affine formula (F4). F6/F7 informational.
- r3 — 2026-10-27 — revision after spec review r2: reordered ignition update so the group position lerp (factor = spaceshipFollowFactor) runs first on every pointer path, including reduced motion and dtMs === 0, before the ignition reset/early-return (F1); noted removal of the now-unused `BoxGeometry` import in T1 (F2). No acceptance-criteria change.