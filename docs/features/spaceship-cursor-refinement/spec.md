---
feature: spaceship-cursor-refinement
revision: 1
status: draft
created: 2026-10-27
updated: 2026-10-27
---
# Spec — Spaceship Cursor Refinement

## Summary

A frontend-only follow-up to the accepted `spaceship-cursor-polish` feature. The spaceship is made a little smaller (group scale reduced from `1.5` to `1.2`) and its resting/trailing position is shifted a little farther to the left of the cursor (NDC x offset changed from `-0.12` to `-0.16`; the y offset stays `-0.12`). The follow delay (`SPACESHIP_FOLLOW_TAU_MS = 240`), geometry (elongated cone nose + cylinder body + sphere cockpit + ignition cones), ignition behaviour, shot timing (`SHOT_TRAVEL_MS = 180`), deferred explosions, pointer tracking, reduced-motion collapse, and all other pinned constants are unchanged. The feature is local to one client: no shared/cross-client state, backend, protocol, container, or persistence change is made.

## User stories

- As a player, the spaceship reads a little smaller than the polished version, so it feels less oversized.
- As a player, the spaceship trails a little farther to the left of the cursor arrow, so it sits more clearly beside/behind the pointer.

## Acceptance criteria

Verification notes: "the frontend workspace" means `src/frontend`. Evidence per AC: a test file asserting concrete values, or a command. All tests use concrete expected values (no banned matchers, no useless tests). Commands (from `AGENTS.md`): `npm run lint`, `npm run typecheck`, `npm test --workspace @cubeclicker/frontend`, `npm run coverage --workspace @cubeclicker/frontend` (pre-gate), full `npm run coverage` (final gate), `npm run build`.

- **AC-1 — Refined constants are pinned.** `SPACESHIP_SCALE === 1.2`, `SPACESHIP_CURSOR_NDC_OFFSET_X === -0.16`, `SPACESHIP_CURSOR_NDC_OFFSET_Y === -0.12`. All other pinned constants are unchanged: `SPACESHIP_FOLLOW_TAU_MS === 240`, `SPACESHIP_PLANE_DISTANCE === 6`, `SPACESHIP_IGNITION_COUNT === 2`, `SPACESHIP_IGNITION_MOVEMENT_THRESHOLD === 0.01`, `SPACESHIP_IGNITION_FLICKER_PERIOD_MS === 100`, `SHOT_TRAVEL_MS === 180`. Evidence: `effects-spaceship.test.ts`.
- **AC-2 — Spaceship target uses the refined offset.** `spaceshipTargetPosition(camera, ndcX, ndcY)` is unchanged in method (ray through the offset NDC at `SPACESHIP_PLANE_DISTANCE`) but uses the new x offset. At NDC `(0, 0)` on the default camera (position `(0, 0, 12)`, FOV 50, aspect 1) the result is approximately `(-0.445721, -0.334291, 6.025924)` (tolerance 1e-6 on each component). The z component of the NDC input does not change the ray direction. Evidence: `spaceship.test.ts`.
- **AC-3 — Spaceship is smaller.** `createSpaceship().group.scale` is `(SPACESHIP_SCALE, SPACESHIP_SCALE, SPACESHIP_SCALE)` with `SPACESHIP_SCALE === 1.2`. The group still contains at least one mesh whose `geometry.type === 'ConeGeometry'` and at least one whose `geometry.type === 'CylinderGeometry'`, and no mesh whose `geometry.type === 'BoxGeometry'`. Evidence: `spaceship.test.ts`.
- **AC-4 — Shot behaviour is preserved.** `SHOT_TRAVEL_MS` remains `180`; `spawnShot`, `updateShots`, midpoint-at-90-ms and completion-after-180-ms behaviour, and the scene's deferred-explosion/arrival behaviour are unchanged. Evidence: `spaceship.test.ts`, `scene-spaceship.test.ts`.
- **AC-5 — Follow behaviour is preserved.** `spaceshipFollowFactor(240, false) === 1 - 1 / Math.E` (tolerance 1e-6); `spaceshipFollowFactor(0, false) === 0`; under reduced motion the factor is `1` for any `dtMs >= 0`. Evidence: `spaceship.test.ts`.
- **AC-6 — Reduced motion collapses delay and ignitions.** Under reduced motion the follow factor is `1` for any `dtMs >= 0`, the ship snaps to the target, and ignitions remain inactive. Evidence: `spaceship.test.ts`, `scene-spaceship.test.ts`.
- **AC-7 — Coverage.** `npm run coverage` (both workspaces) exits 0 with ≥ 80% statements/branches/functions/lines per workspace; frontend pre-gate `npm run coverage --workspace @cubeclicker/frontend` is the task-level check. Evidence: final build log.
- **AC-8 — No container or backend change.** `git diff` for `compose.yaml`, `compose.smoke.yaml`, `src/backend/**`, Dockerfiles is empty. Evidence: final build log.

## Non-goals

- No change to the follow delay (`SPACESHIP_FOLLOW_TAU_MS` stays `240`), plane distance, or pointer tracking formula.
- No change to geometry beyond the group scale value (still cone nose + cylinder body + sphere cockpit + ignition cones); no new shapes or assets.
- No change to ignition count, threshold, flicker period, or animation logic.
- No change to shot timing or deferred explosion semantics: `SHOT_TRAVEL_MS` stays `180`, origin/normal captured at fire time, burst uses retained frame time.
- No change to reduced-motion behaviour (still snaps, ignitions inactive).
- No multiplayer visibility of the spaceship or ignitions: they remain local to one client.
- No audio, no new dependencies, no textures/assets, no shaders.
- No customisation UI (future feature; constants and geometry remain the seam).
- No browser automation or pixel/perceptual tests.

## Boundaries

- ✅ Always: keep `game/**` pure and DOM-free; named tree-shakeable imports from `three`; tests with concrete expected values beside every behavior change; run lint, typecheck, tests, and the coverage command before reporting done; record raw evidence in build logs; stage only `files_owned` per task.
- ⚠️ Ask first: any new dependency (none needed); any pinned-constant deviation from this spec; touching any file outside a task's `files_owned`; any coverage exclusion or threshold change; any change to backend/container files.
- 🚫 Never: weaken assertions (banned matchers, snapshot-only, assertion-free, useless tests); exclude production code from coverage; touch `.env*`, secrets, backend/container files, `main.tsx`, or configs; use `import *` from `three`; read browser globals inside `game/**` or pure render math; push; rewrite predecessor specs.

## Security considerations

- **No new dependencies.** Only existing `three` named imports; lockfile untouched.
- **No user data, storage, or network.** All state is in-memory per client; nothing is persisted or sent. The spaceship and its offset are a local visual; no new message types.
- **Rendering safety.** Fully procedural geometry (cone + cylinder + sphere + ignition cones); no loaders, textures, or external assets; no `innerHTML`.
- **Resource bounds.** Spaceship group created once and reused; `dispose()` clears it. No unbounded growth.
- **Test integrity.** Coverage bar and concrete-assertion rule protect the unchanged pure logic and server-authority paths.

## Real-time impact

**None for shared state.** The spaceship, its pointer target, the ignitions and the shots are client-local visuals: no shared or cross-client state is created or read, no protocol message is added, and connection lifecycle, reconnection, multi-client behavior, and server authority are unaffected (they remain as in the predecessor features). **Open question Q-1** carries over whether other clients should see a player's spaceship; the default (local-only) is chosen and flagged.

## Containerization impact

**None expected.** Frontend source changes only: no new services, images, ports, environment variables, or health signals; no compose/Dockerfile/README change. The frontend image absorbs the diff through the existing build; the unchanged containerized smoke test (`npm run smoke`) remains the regression check at the final gate where the environment allows it.

## Testing strategy

- **Unit (Vitest, node environment):** `effects-spaceship.test.ts` pins the refined constants (`SPACESHIP_SCALE` 1.2, `SPACESHIP_CURSOR_NDC_OFFSET_X` -0.16) alongside the unchanged constants. `spaceship.test.ts` pins `spaceshipTargetPosition` (new expected vector), the group scale (dynamic via `SPACESHIP_SCALE`), and unchanged follow factor / shot / ignition behaviour.
- **Integration (same node environment — real three.js scene graph):** `scene-spaceship.test.ts` asserts spaceship presence, follow smoothing with tau 240, shot spawn/travel/arrival, reduced-motion collapse, disposal/rebuild safety. No new scene-level assertions are required because the offset only changes the target vector (already covered by `spaceship.test.ts`).
- **E2E / container:** no browser automation (predecessor non-goal retained); `npm run smoke` unchanged, run at the final gate where the environment allows.
- **Coverage:** `npm run coverage` — thresholds ≥ 80% statements/branches/functions/lines per workspace (frontend pre-gate: `npm run coverage --workspace @cubeclicker/frontend`); config exclusions unchanged (only `src/main.tsx` + test patterns). If a metric cannot honestly clear 80, the task reports `blocked` — no carve-outs.

## Open questions

- **Q-1 — Cross-client visibility (carried over, user checkpoint).** Default: the spaceship, ignitions and shots are local to one client. Broadcasting a lightweight pointer position would need a protocol addition and server authority; not implemented. Choosing it requires a spec revision.
- **Q-2 — Visual vs. state timing (carried over, user checkpoint).** Default: game state (board/stats) stays synchronous at click; only the explosion *visual* (pop + burst) is delayed to shot arrival. Delaying the engine's `explodeMiniCube` itself changes game rules and is not implemented.
- **Q-3 — Scale magnitude.** Pinned: `SPACESHIP_SCALE = 1.2` (down from 1.5). A different size (e.g. `1.0` or `1.3`) is a constant edit plus a spec note.
- **Q-4 — Offset magnitude.** Pinned: `SPACESHIP_CURSOR_NDC_OFFSET_X = -0.16` (was `-0.12`); y stays `-0.12`. A further shift is a constant edit plus a spec note.

## Assumptions

- The pointer is tracked via Pointer Events on the canvas (existing single input path); `pointermove` is unchanged.
- Only two constants change (`SPACESHIP_SCALE`, `SPACESHIP_CURSOR_NDC_OFFSET_X`); all other pinned constants and code paths are untouched.
- Predecessor specs/plan/tasks stay authoritative for everything not superseded; this spec is read alongside them and never edits them.
- Stack unchanged: `three@0.186.1` / `@types/three@0.186.0`, TypeScript strict, Vitest, ESLint; the project testing bar governs.

## Revision history

- r1 — 2026-10-27 — initial draft (planning phase).