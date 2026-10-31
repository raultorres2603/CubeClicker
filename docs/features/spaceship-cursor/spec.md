---
feature: spaceship-cursor
revision: 3
status: draft
created: 2026-10-27
updated: 2026-10-27
---
# Spec — Spaceship Cursor

## Summary

A frontend-only feature: a simple 3D spaceship is added to the game scene. It follows the mouse cursor (pointer) but sits slightly offset from the arrow and lags behind it with a smoothed "floating/flying" delay, so it reads as a craft trailing the pointer rather than overlapping it. It is rendered from basic three.js primitives (a cone for the nose, a box for the body, and a small sphere for the cockpit) so it can be customised later. Whenever a mini-cube is exploded, the spaceship fires a short, visible shot from its current position to that mini-cube; the mini-cube's explosion visual (pop + burst) plays when the shot arrives. Game state (board removal, `clicks`, face counters, server sync) is unchanged in timing: it still happens synchronously at click time, as in the predecessor features; only the explosion's *visual* is delayed to shot arrival. Reduced motion collapses the delay and the shot. The feature is local to one client: no shared/cross-client state is created and no backend, protocol, container, or persistence change is made.

## User stories

- As a player, I see a small 3D spaceship trailing my cursor with a floating delay, so the pointer feels like a ship.
- As a player, when I click (or otherwise explode) a mini-cube, the spaceship shoots at it and the mini-cube explodes when the shot lands, so clicking feels like firing.
- As a player who prefers reduced motion, the spaceship snaps to the cursor and explosions apply instantly with no shot, so there is no motion sickness.

## Acceptance criteria

Verification notes: "the frontend workspace" means `src/frontend`. Evidence per AC: a test file asserting concrete values, or a command. All tests use concrete expected values (no banned matchers, no useless tests). Commands (from `AGENTS.md`): `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend` (pre-gate), full `npm run coverage` (final gate), `npm run build`.

- **AC-1 — Spaceship exists in the scene.** `createSceneView(...)` adds a group identifiable as the spaceship (`group.name === 'spaceship'`) containing at least one `Mesh`; the group is present in `scene.children` and survives a cube rebuild (`levelChanged` path) without being disposed. Evidence: `scene-spaceship.test.ts`.
- **AC-2 — Spaceship follows the pointer with a pinned delay.** `SceneView.setPointerTarget(ndcX, ndcY)` stores the pointer. On `update(dtMs)` the spaceship position moves toward the target by the factor `1 - Math.exp(-dtMs / SPACESHIP_FOLLOW_TAU_MS)` with `SPACESHIP_FOLLOW_TAU_MS = 120`: after one update of 120 ms the position is exactly `start + (target - start) * (1 - 1/e)` (tolerance 1e-6 on each component). Under reduced motion the factor is 1 (snap) for any `dtMs >= 0` (including `dtMs === 0`), so reduced motion always snaps regardless of elapsed time; without reduced motion and `dtMs === 0` the factor is `0`. With no pointer yet (`hasPointer === false`) the spaceship stays at its default `(0, 0, 6)` and is not smoothed until the first `setPointerTarget`. The pinned constants are asserted in `effects-spaceship.test.ts`; the follow factor and helpers are asserted in `spaceship.test.ts`; the scene integration is asserted in `scene-spaceship.test.ts`. Evidence: `effects-spaceship.test.ts`, `spaceship.test.ts`, `scene-spaceship.test.ts`.
- **AC-3 — Spaceship is offset from the cursor, not overlapping it.** The target position is the unprojection of the pointer at `SPACESHIP_PLANE_DISTANCE = 6` world units in front of the camera, along the ray through the offset NDC. Concretely, `spaceshipTargetPosition(camera, ndcX, ndcY)` returns `camera.position.clone().add(normalize(unproject(ndcX + SPACESHIP_CURSOR_NDC_OFFSET_X, ndcY + SPACESHIP_CURSOR_NDC_OFFSET_Y, 0) - camera.position) * SPACESHIP_PLANE_DISTANCE)` using the camera's own unprojection (the z component of the NDC input does not change the ray direction). The pinned offsets are `SPACESHIP_CURSOR_NDC_OFFSET_X = -0.05` and `SPACESHIP_CURSOR_NDC_OFFSET_Y = -0.08`. At NDC `(0, 0)` on the default camera (position `(0, 0, 12)`, FOV 50, aspect 1) the result is approximately `(-0.139757, -0.223611, 6.005798)` (tolerance 1e-6 on each component). The pinned constants are asserted in `effects-spaceship.test.ts`; the helper is asserted in `spaceship.test.ts`. Evidence: `effects-spaceship.test.ts`, `spaceship.test.ts`.
- **AC-4 — Shot is fired on explosion (non-reduced motion).** When `applyIntents` receives an `explosion` intent and `reducedMotion` is false, no pop/burst is applied immediately: the mini-cube is not yet hidden, `particles.activeCount()` is unchanged, and exactly one shot object is added to the scene's shot list. The shot list is observable as `SceneView.shots` (a `readonly Shot[]` that delegates to the spaceship's `shots`); `dispose()` empties it. The shot's start position equals the spaceship's position at fire time and its target position equals the mini-cube's world origin captured at fire time. The mini-cube's world origin and outward face normal used for the eventual burst are captured at fire time and stored in the deferred queue; they are not recomputed at shot arrival. Evidence: `scene-spaceship.test.ts`.
- **AC-5 — Shot travels and triggers the explosion on arrival.** After `SHOT_TRAVEL_MS = 180` ms of `update` (in steps or one call), the shot is removed, the mini-cube becomes hidden (`isMiniCubeHidden(id) === true`), and `particles.activeCount() >= 1` (burst spawned). At the midpoint (`90` ms) the shot's position is exactly the component-wise average of its start and target. The burst is spawned using `SceneView.lastFrameTime` — the scene's most recent frame time, retained from the last `applyIntents`/`applySnapshot` call (defaulting to `0` when `update` runs without a prior frame). The retained value is observable as `SceneView.lastFrameTime: number` (default `0`), and the burst's frame time equals `lastFrameTime` at arrival. Evidence: `scene-spaceship.test.ts` (including `view.lastFrameTime`).
- **AC-6 — Reduced motion: instant, no shot.** When `reducedMotion` is true, an `explosion` intent applies immediately (hidden + burst, no shot object) and `update` spawns nothing. Evidence: `scene-spaceship.test.ts`.
- **AC-7 — Pointer tracking in the session.** A `pointermove` event on the canvas computes NDC from the rect as `ndcX = (clientX - rect.left) / rect.width * 2 - 1`, `ndcY = 1 - (clientY - rect.top) / rect.height * 2`, clamps both to `[-1, 1]`, and calls `scene.setPointerTarget(ndcX, ndcY)`; the session's `GameSession` exposes `setPointerTarget(ndcX, ndcY)`. Evidence: `session-spaceship.test.ts`.
- **AC-8 — Disposal and rebuild safety.** `dispose()` removes the spaceship group and all shot objects and empties the shot list (`SceneView.shots.length === 0`); a cube rebuild does not duplicate the spaceship (exactly one group named 'spaceship' after rebuild). Evidence: `scene-spaceship.test.ts`.
- **AC-9 — Coverage.** `npm run coverage` (both workspaces) exits 0 with ≥ 80% statements/branches/functions/lines per workspace; frontend pre-gate `npm run coverage --workspace @cubeclicker/frontend` is the task-level check. Evidence: final build log.
- **AC-10 — No container or backend change.** `git diff` for `compose.yaml`, `compose.smoke.yaml`, `src/backend/**`, Dockerfiles is empty. Evidence: final build log.

## Non-goals

- No change to game rules, stats, intents, phase sequencing, level progression, server protocol, or persistence. The engine's `explodeMiniCube` path is untouched; `clicks` and board removal stay synchronous at click time.
- No change to the explosion's game-state timing: only the *visual* (pop + burst) is delayed to shot arrival. (See Q-2.)
- No multiplayer visibility of the spaceship or shots: they are local to one client. (See Q-1.)
- No audio, no new dependencies, no textures/assets, no shaders.
- No customisation UI (future feature; the simple primitive shape is the seam).
- No browser automation or pixel/perceptual tests.

## Boundaries

- ✅ Always: keep `game/**` pure and DOM-free; named tree-shakeable imports from `three`; tests with concrete expected values beside every behavior change; run lint, typecheck, tests, and the coverage command before reporting done; record raw evidence in build logs; stage only `files_owned` per task.
- ⚠️ Ask first: any new dependency (none needed); any pinned-constant deviation from this spec; touching any file outside a task's `files_owned`; any coverage exclusion or threshold change; any change to backend/container files.
- 🚫 Never: weaken assertions (banned matchers, snapshot-only, assertion-free, useless tests); exclude production code from coverage; touch `.env*`, secrets, backend/container files, `main.tsx`, or configs; use `import *` from `three`; read browser globals inside `game/**` or pure render math; push; rewrite predecessor specs.

## Security considerations

- **No new dependencies.** Only existing `three` named imports; lockfile untouched.
- **No user data, storage, or network.** All state is in-memory per client; nothing is persisted or sent. The shot is a local visual; no new message types.
- **Rendering safety.** Fully procedural geometry (cone + box + sphere); no loaders, textures, or external assets; no `innerHTML`.
- **Resource bounds.** Shots are removed on arrival; `dispose()` clears the list; the spaceship group is created once and reused across rebuilds. No unbounded growth.
- **Test integrity.** Coverage bar and concrete-assertion rule protect the unchanged pure logic and server-authority paths.

## Real-time impact

**None for shared state.** The spaceship, its pointer target, and the shots are client-local visuals: no shared or cross-client state is created or read, no protocol message is added, and connection lifecycle, reconnection, multi-client behavior, and server authority are unaffected (they remain as in the predecessor features). **Open question Q-1** asks whether other clients should see a player's spaceship; the default (local-only) is chosen and flagged.

## Containerization impact

**None expected.** Frontend source changes only: no new services, images, ports, environment variables, or health signals; no compose/Dockerfile/README change. The frontend image absorbs the diff through the existing build; the unchanged containerized smoke test (`npm run smoke`) remains the regression check at the final gate where the environment allows it.

## Testing strategy

- **Unit (Vitest, node environment):** pure math in `spaceship.test.ts` pins `SPACESHIP_FOLLOW_TAU_MS` (120), `SPACESHIP_PLANE_DISTANCE` (6), `SPACESHIP_CURSOR_NDC_OFFSET_X` (-0.05), `SPACESHIP_CURSOR_NDC_OFFSET_Y` (-0.08), `SHOT_TRAVEL_MS` (180) and the follow factor / target-position helpers with exact literals. The pinned constants are asserted in `effects-spaceship.test.ts`. Constant tests in `effects-spaceship.test.ts`.
- **Integration (same node environment — real three.js scene graph):** `scene-spaceship.test.ts` asserts spaceship presence, follow smoothing, shot spawn/travel/arrival triggering the explosion visual, reduced-motion collapse, disposal/rebuild safety, the `SceneView.shots` accessor, and the frame-time default for bursts. `session-spaceship.test.ts` asserts pointermove → `setPointerTarget` NDC conversion.
- **E2E / container:** no browser automation (predecessor non-goal retained); `npm run smoke` unchanged, run at the final gate where the environment allows.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace (frontend pre-gate: `npm run coverage --workspace @cubeclicker/frontend`); config exclusions unchanged (only `src/main.tsx` + test patterns). If a metric cannot honestly clear 80, the task reports `blocked` — no carve-outs.

## Open questions

- **Q-1 — Cross-client visibility (user checkpoint).** Default: the spaceship and shots are local to one client. Alternative: broadcast a lightweight pointer position so other members see each other's ship. That would need a protocol addition and server authority and is flagged, not implemented. Choosing the alternative requires a spec revision.
- **Q-2 — Visual vs. state timing (user checkpoint).** Default: game state (board/stats) stays synchronous at click; only the explosion *visual* (pop + burst) is delayed to shot arrival. Alternative: delay the engine's `explodeMiniCube` itself so stats also land on hit. The latter changes game rules, server sync, and many existing tests; it is not implemented here. Choosing it requires a spec revision.
- **Q-3 — Spaceship shape.** Pinned: a cone (nose) plus a box (body) plus a small sphere (cockpit) built from `three` primitives, no assets. Tuning is a constant/geometry edit with a spec note.
- **Q-4 — Shot appearance.** Pinned: a small sphere mesh travelling linearly; no trail geometry. A trail is a future enhancement.
- **Q-5 — Reduced motion.** Pinned: spaceship snaps to the cursor (no smoothing) and explosions apply instantly with no shot. Alternative: hide the spaceship entirely under reduced motion (not chosen).

## Assumptions

- The pointer is tracked via Pointer Events on the canvas (the existing single input path); `pointermove` is added without changing gesture classification.
- The spaceship lives in a plane `SPACESHIP_PLANE_DISTANCE = 6` world units in front of the camera; its x/y are derived by unprojecting the (offset) NDC at that distance, so it stays visually near the cursor across viewport sizes.
- Shot travel is linear over `SHOT_TRAVEL_MS` and uses the spaceship position captured at fire time and the mini-cube's world origin as endpoints.
- The explosion intent's burst is spawned at shot arrival using the then-current frame time; `particles.spawn` ordering uses that time. When no frame time has been recorded yet (e.g. `update` called before any `applyIntents`/`applySnapshot`), the scene uses `0`.
- The mini-cube's world origin and outward face normal are captured at fire time and stored in the deferred queue, so a cube rotation between fire and arrival does not move the burst.
- With no pointer movement yet, the spaceship rests at `(0, 0, 6)` and does not smooth.
- Predecessor specs/plan/tasks stay authoritative for everything not superseded; this spec is read alongside them and never edits them.
- Stack unchanged: `three@0.186.1` / `@types/three@0.186.0`, TypeScript strict, Vitest, ESLint; the project testing bar governs.

## Revision history

- r1 — 2026-10-27 — initial draft (planning phase).
- r2 — 2026-10-27 — addresses spec review r1 (F1–F7): pins the `SceneView.shots`/spaceship `shots` observable accessor (F1); pins the unprojection method and the expected vector for the default camera (F2); states that origin/normal are captured at fire time and stored in the deferred queue (F3); aligns the Summary shape wording with Q-3 (F4); assigns constant-assertion evidence to `effects-spaceship.test.ts` (F5); states the retained-frame-time default of `0` for bursts in `update` (F6); pins the no-pointer behaviour (F7).
- r3 — 2026-10-27 — addresses spec review r2 (F8–F11): pins the observable retained-frame-time surface `SceneView.lastFrameTime: number` (default `0`) as the evidence path for AC-5's burst frame-time clause (F8); states the reduced-motion follow factor for `dtMs === 0` is `1` (F9); notes the status frontmatter duplicate key is collapsed to a single `spec_review_round: 2` (F10, orchestrator); pins the session NDC conversion formula in AC-7 (F11). No AC added or removed; AC-2, AC-5 and AC-7 wording tightened to match.

## Review response (spec-r1)

- **F1 (MAJOR) — fixed.** Pinned the observable shot surface: `Spaceship.shots: readonly Shot[]` and `SceneView.shots: readonly Shot[]` (delegating), emptied by `dispose()`; AC-4 and AC-8 now cite it.
- **F2 (MAJOR) — fixed.** Pinned the unprojection method (ray through the offset NDC, point at Euclidean distance `SPACESHIP_PLANE_DISTANCE`) and added the concrete expected vector `(-0.139757, -0.223611, 6.005798)` for the default camera to AC-3.
- **F3 (MAJOR) — fixed.** Stated that origin and normal are captured at fire time and stored in the deferred queue; not recomputed at arrival. AC-4/AC-5 updated.
- **F4 (MINOR) — fixed.** Summary now reads "cone (nose) + box (body) + small sphere (cockpit)".
- **F5 (MINOR) — fixed.** AC-2 and AC-3 now state that pinned constants are asserted in `effects-spaceship.test.ts`, with follow/target helpers in `spaceship.test.ts`.
- **F6 (MINOR) — fixed.** AC-5 now states the scene retains the most recent frame time from `applyIntents`/`applySnapshot` and defaults to `0` in `update`.
- **F7 (MINOR) — fixed.** AC-2 now pins the no-pointer behaviour (rest at `(0, 0, 6)`, no smoothing).

## Review response (spec-r2)

- **F8 (MAJOR) — fixed.** Pinned the observable retained-frame-time surface: `SceneView.lastFrameTime: number` (default `0`), recorded from the last `applyIntents`/`applySnapshot` call and used as the burst's frame time at shot arrival. AC-5 now cites it as the evidence path; plan § Interfaces/contracts updated.
- **F9 (MINOR) — fixed.** AC-2 now states the reduced-motion follow factor is `1` for `dtMs === 0` as well (snap regardless of elapsed time); the non-reduced `dtMs === 0` factor remains `0` from the formula.
- **F10 (MINOR) — fixed (orchestrator).** `docs/features/spaceship-cursor/status.md` frontmatter collapsed to a single `spec_review_round: 2` key.
- **F11 (MINOR) — fixed.** AC-7 now pins the NDC conversion: `ndcX = (clientX - rect.left) / rect.width * 2 - 1`, `ndcY = 1 - (clientY - rect.top) / rect.height * 2`, both clamped to `[-1, 1]`.