# Build log — T11 — Live preview

Task: T11 (2026-11-08)
Files changed: `src/frontend/src/render/preview.ts`, `src/frontend/src/render/preview.test.ts`,
`src/frontend/src/ui/SpaceshipPreview.tsx`, `src/frontend/src/ui/SpaceshipPreview.test.tsx`,
`docs/features/spaceship-cursor-loot-animations/build-log-T11.md`

Sketch:
- `render/preview.ts`: `createPreviewScene(appearance)` builds a two-light scene + fixed
  `PerspectiveCamera` + `createCursorShipModel`, applies the same
  `appearanceToCursorShipParams` mapping as the cursor, rotates at `0.0004 rad/ms` (never under
  reduced motion), pins `PREVIEW_MAX_FPS = 30` / `1000/30` ms, and disposes the model/scene
  idempotently.
- `ui/SpaceshipPreview.tsx`: one `WebGLRenderer` + one RAF loop while mounted, renders at most
  30 fps, resizes from the canvas box, re-applies appearance changes to the existing model
  without rebuilding the GL context, reads `prefers-reduced-motion: reduce`, and disposes
  renderer + model on unmount; a throwing WebGL constructor leaves the empty labeled canvas.
- Backward compatibility: canvas/class/aria and the five predecessor `data-*-color` attributes
  stay; the ten `data-preview-slot-<slotId>` attributes expose the resolved v2 part per slot.

What changed & why:
- `render/preview.ts` (new): real preview scene for the cursor model. Scene children are
  `preview-ambient` (AmbientLight), `preview-key-light` (DirectionalLight) and
  `cursor-ship-model`; the camera is a fixed `PerspectiveCamera(35, 1, 0.1, 20)` at
  `(0, 0.32, 2.15)` looking at `(0, 0.02, 0)`. The rest yaw is `0.55 rad`; `update` adds
  `0.0004 * dtMs` only for finite positive deltas and not under reduced motion. `dispose`
  clears the scene and disposes the cursor model, idempotently.
- `ui/SpaceshipPreview.tsx`: creates exactly one `WebGLRenderer({ canvas, antialias: true,
  alpha: true })` in the mount effect; catches construction and scene-creation failures
  (renderer disposed on scene failure) so the canvas stays an empty labeled preview. The RAF
  loop renders only when the gap since the last rendered frame is `>= 1000/30` ms; every RAF
  schedules the next frame, so consecutive `16 ms` frames do not render. A `ResizeObserver`
  (when available) re-sizes the drawing buffer and camera aspect; unmount cancels the frame,
  disconnects the observer, removes the motion listener, then disposes the model and renderer.
  The appearance sync effect re-applies `model.applyAppearance(appearance)` in place, so an
  equip never recreates the WebGL context.
- `render/preview.test.ts` (new): pins 30 fps/interval/rotation constants, the scene/camera
  composition, exact slot colours (hull/seam/wings/ignition via `MeshPhysicalMaterial`
  `color`/`emissive`), legacy `wings`/`body` normalization, the rotation/reduced/zero/negative/
  NaN branches and idempotent disposal.
- `ui/SpaceshipPreview.test.tsx`: keeps the five predecessor SSR contracts and adds the ten
  `data-preview-slot-*` attributes, v2/legacy resolution, the real three.js scene graph behind
  a recording `WebGLRenderer` fake (one renderer, 1×1 jsdom size, 0 → 16 → 34 ms throttle,
  rotation step, unmount dispose/cancel, model removal), reduced-motion static pose, in-place
  appearance update (one renderer, hull `8f9bad` → `ccaa44`) and the WebGL-throw fallback.

Decisions:
- The renderer and the RAF loop stay in the React component while `createPreviewScene` owns
  the scene/camera/model/update/dispose contract exactly as specified in AC-31; the preview
  reuses the cursor factory instead of duplicating model/appearance logic.
- The five predecessor colour attributes keep their legacy semantics (`appearanceToSpaceshipParams`),
  which is why the default `data-body-color` remains `#4466cc` and `data-cockpit-color`
  `#ffffff`; the v2 slot attributes are the forward-compatible surface.
- `appearance` changes are applied to the live model in a second effect (no context rebuild);
  the mount effect reads the initial appearance through a ref so it has no prop dependency.
- Reduced motion is read once per mount from `window.matchMedia` (with a safe no-DOM path) and
  updated from its `change` event; the rotation is simply not advanced, so the reduced frame
  stays at the `0.55 rad` rest pose.

Evidence:
- T10 was being implemented concurrently in the shared working tree (`game/engine.ts`,
  `game/session.ts`, `game/types.ts`, `multiplayer/protocol.ts` + tests, `render/picking.ts`
  dirty and mid-edit), so the T11 gate was run in a clean detached worktree at the same base
  commit (`9e06e6a`) with only the five T11 files applied:
  `git worktree add --detach /tmp/opencode/t11-verify-1676032 HEAD` + the four source/test
  files copied in. This isolates the gate from foreign in-progress edits; the T11 commit
  contains only the five owned paths.
- `npm run lint` → exit 0:
  ```
  > lint
  > eslint .

  ```
- `npm run typecheck --workspace @cubeclicker/frontend` → exit 0:
  ```
  > typecheck
  > tsc --noEmit

  ```
- `npm test --workspace @cubeclicker/frontend` → exit 0 (62 files, 1545 tests):
  ```
   ✓ src/render/preview.test.ts (7 tests) 48ms
   ✓ src/ui/SpaceshipPreview.test.tsx (12 tests) 90ms
   Test Files  62 passed (62)
        Tests  1545 passed (1545)
  ```
- `npm run coverage --workspace @cubeclicker/frontend` → exit 0 (all four thresholds 80):
  ```
  % Coverage report from v8
  All files          |    96.1 |    95.48 |   97.01 |    96.1 |
    preview.ts       |     100 |      100 |     100 |     100 |
    ...ipPreview.tsx |    87.2 |      100 |     100 |    87.2 | ...24-125,130-131
  ```
  The only uncovered `SpaceshipPreview.tsx` lines are the optional `ResizeObserver`/
  legacy-listener branches; the workspace aggregate stays far above the gate.

Acceptance audit:
- AC-31 — met:
  - `createPreviewScene(appearance)` returns `{ scene, camera, model, update(dtMs,
    reducedMotion), dispose }` — pinned by `preview.test.ts` scene/camera/dispose cases.
  - Same `appearanceToCursorShipParams` mapping as the cursor — `model.applyAppearance` is the
    cursor-model method and the tests pin exact hull/gold, wing/silver, ignition/blue colours,
    plus legacy `wings`/`body` normalization.
  - `0.0004 rad/ms` only when not reduced — constants + rotation/reduced tests.
  - Maximum 30 fps — `PREVIEW_MAX_FPS`/`PREVIEW_FRAME_INTERVAL_MS` pinned; component test
    proves a 16 ms frame does not render and a 34 ms frame does.
  - Renderer/model disposed on unmount — component test asserts `disposeCalls === 1`,
    `cancelAnimationFrame(4)` and an emptied scene.
  - Canvas keeps `aria-label="Spaceship preview"`, `spaceship-preview`, the five predecessor
    data attributes and exposes all ten `data-preview-slot-<slotId>` attributes.
  - WebGL construction failure leaves the empty labeled canvas and does not throw — fallback
    test; the existing `SpaceshipCustomizationPanel.test.tsx` canvas/class assertions stay
    green in the full suite.
- AC-8/AC-47 do not apply to this task (no scene draw-count change; the preview is a separate
  panel context rendered at 30 fps).

Deviations from spec: none. The T11 files are the only ones changed; panel/App/CSS/scene/
backend/config/lockfiles/tasks/status/README are untouched.
