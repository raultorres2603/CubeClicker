/**
 * Scene composition, camera flights and intent application (T12/T2 — plan § Render
 * interfaces; spec AC-1 … AC-6, AC-9, AC-10, AC-15, AC-16).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. The scene
 * assembles the pieces the other render tasks own ({@link createStarfield} backdrop,
 * {@link createCubeView} cube, {@link createParticleSystem} explosions) plus the lights
 * and the pinned camera, and is the single place that turns engine output into three.js
 * state:
 *
 * - {@link SceneView.applyIntents} consumes the engine's one-shot `EffectIntent`s:
 *   an `explosion` reads the tile's world origin and outward face normal, starts the
 *   pop-then-shrink removal and spawns the burst `BURST_ORIGIN_OFFSET` in front of that
 *   surface (AC-3, AC-4); `faceCleared` fades the face plate and releases the face when
 *   the fade is done; `levelChanged` disposes the old cube view and builds a fresh one in
 *   the new style (AC-9, AC-10); and `travelStarted` needs nothing of its own — the travel
 *   transition is driven by the snapshot.
 * - {@link SceneView.applySnapshot} is the per-frame pull: the intro search → find →
 *   approach choreography and the travel pull-away (AC-2), cube orientation interpolation
 *   (the frame pinned in `game/rotation.ts`: `rotation.set(pitch, yaw, 0)`), the starfield
 *   travel expansion (AC-1) and level reconciliation (a style change that arrives without
 *   its intent is applied anyway, so the cube can never disagree with the snapshot).
 * - {@link SceneView.update} advances the frame-driven parts: starfield drift, particle
 *   aging, the face fades and the running mini-cube pops (AC-4).
 *
 * The scene receives values only; it never reads the engine (plan § Data flow) and it
 * owns every three.js object it creates, so `dispose()` can release them exactly once
 * (AC-15). Drawables stay bounded: one starfield `Points`, one cube view (6
 * `InstancedMesh` + body/plates) and one pooled particle `Points` (AC-16).
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  InstancedMesh,
  Matrix4,
  PerspectiveCamera,
  Scene,
  Vector3,
  type Material,
} from 'three';

import { BURST_ORIGIN_OFFSET, easeInOutQuad, easeOutCubic, timingsFor } from '../game/effects';
import type { EffectIntent, EngineSnapshot } from '../game/engine';
import { interpolateRotation } from '../game/rotation';
import { GRID_SIZE, type CubeStyle, type FaceId, type MiniCubeId } from '../game/types';
import { createCubeView, FACE_NORMALS, type CubeView } from './cube-view';
import { createParticleSystem, type ParticleSystem } from './particles';
import { createStarfield, type Starfield } from './starfield';

/** Black backdrop behind the starfield (AC-3). */
const BACKGROUND_COLOR = 0x000000;

/** Ambient fill-light intensity. */
const AMBIENT_INTENSITY = 0.6;

/** Key-light intensity. */
const KEY_INTENSITY = 1.2;

/** Key-light position: front-top-right of the cube. */
const KEY_LIGHT_POSITION = { x: 6, y: 8, z: 10 };

/** Camera rest distance — the gameplay position, and the end of the intro approach (AC-2). */
const REST_Z = 12;

/** Travel pull-away end distance (AC-2, retained from the predecessor AC-22). */
const TRAVEL_END_Z = 90;

/** Intro segment bounds on the clamped `phaseProgress` (AC-2). */
const INTRO_SEARCH_END_P = 0.4;
const INTRO_FIND_END_P = 0.72;

/** Search beat: the camera pans linearly from its opening pose to this end pose (AC-2). */
const INTRO_SEARCH_START = { x: 36, y: 20, z: 24 } as const;
const INTRO_SEARCH_END = { x: 32, y: 16, z: 28 } as const;

/** Search beat: the camera keeps this fixed sky point in frame (AC-2). */
const INTRO_SEARCH_TARGET = { x: 0, y: 30, z: -40 } as const;

/** Find beat end: centred on the cube's axis, 26 units out, looking at the cube (AC-2). */
const INTRO_FIND_END = { x: 0, y: 0, z: 26 } as const;

/** Approach beat end: the playing rest pose, looking at the origin (AC-2). */
const INTRO_APPROACH_END = { x: 0, y: 0, z: REST_Z } as const;

/** Pinned lens (AC-2). */
const CAMERA_FOV = 50;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 200;

/** The camera always looks at the cube centre, wherever the flights put it. */
const ORIGIN = new Vector3(0, 0, 0);

/** Components this close to an integer are quarter-turn trig residue (spec AC-3). */
const QUARTER_TURN_EPSILON = 1e-9;

/**
 * Writes the intro camera pose for clamped `progress` into the caller-owned vectors
 * (spec AC-2) — zero allocation per frame. Three beats:
 *
 * - **Search** (`p ∈ [0, 0.4]`): position lerps linearly `(36, 20, 24) → (32, 16, 28)`
 *   while looking at the fixed sky point `(0, 30, −40)`; the cube is off-screen.
 * - **Find** (`p ∈ [0.4, 0.72]`): position `(32, 16, 28) → (0, 0, 26)` and target
 *   `(0, 30, −40) → (0, 0, 0)`, both eased with `easeOutCubic` over `(p − 0.4) / 0.32`;
 *   the cube enters the frame and ends fully centred.
 * - **Approach** (`p ∈ [0.72, 1]`): `z 26 → 12` with `easeOutCubic` over
 *   `(p − 0.72) / 0.28`, always looking at the origin; lands exactly at the rest pose.
 */
export function introCameraPose(
  progress: number,
  outPosition: Vector3,
  outTarget: Vector3,
): void {
  const clamped = Math.min(1, Math.max(0, progress));

  if (clamped <= INTRO_SEARCH_END_P) {
    const q = clamped / INTRO_SEARCH_END_P;
    outPosition.set(
      INTRO_SEARCH_START.x + (INTRO_SEARCH_END.x - INTRO_SEARCH_START.x) * q,
      INTRO_SEARCH_START.y + (INTRO_SEARCH_END.y - INTRO_SEARCH_START.y) * q,
      INTRO_SEARCH_START.z + (INTRO_SEARCH_END.z - INTRO_SEARCH_START.z) * q,
    );
    outTarget.set(INTRO_SEARCH_TARGET.x, INTRO_SEARCH_TARGET.y, INTRO_SEARCH_TARGET.z);
    return;
  }

  if (clamped <= INTRO_FIND_END_P) {
    const q = easeOutCubic(
      (clamped - INTRO_SEARCH_END_P) / (INTRO_FIND_END_P - INTRO_SEARCH_END_P),
    );
    outPosition.set(
      INTRO_SEARCH_END.x + (INTRO_FIND_END.x - INTRO_SEARCH_END.x) * q,
      INTRO_SEARCH_END.y + (INTRO_FIND_END.y - INTRO_SEARCH_END.y) * q,
      INTRO_SEARCH_END.z + (INTRO_FIND_END.z - INTRO_SEARCH_END.z) * q,
    );
    outTarget.set(
      INTRO_SEARCH_TARGET.x + (ORIGIN.x - INTRO_SEARCH_TARGET.x) * q,
      INTRO_SEARCH_TARGET.y + (ORIGIN.y - INTRO_SEARCH_TARGET.y) * q,
      INTRO_SEARCH_TARGET.z + (ORIGIN.z - INTRO_SEARCH_TARGET.z) * q,
    );
    return;
  }

  const q = easeOutCubic((clamped - INTRO_FIND_END_P) / (1 - INTRO_FIND_END_P));
  outPosition.set(
    INTRO_FIND_END.x + (INTRO_APPROACH_END.x - INTRO_FIND_END.x) * q,
    INTRO_FIND_END.y + (INTRO_APPROACH_END.y - INTRO_FIND_END.y) * q,
    INTRO_FIND_END.z + (INTRO_APPROACH_END.z - INTRO_FIND_END.z) * q,
  );
  outTarget.set(ORIGIN.x, ORIGIN.y, ORIGIN.z);
}

/**
 * Snaps every component of `v` within {@link QUARTER_TURN_EPSILON} of an integer to that
 * integer and returns `v` (in place, for chaining). A quarter-turn matrix carries residue
 * such as `cos(π/2) ≈ 6.12e-17`, which would otherwise leak into asserted burst positions;
 * genuine in-between normals are far from integers and pass through untouched. `-0` is
 * normalised to `0`, so the snapped vector compares exactly.
 */
export function snapToQuarterTurns(v: Vector3): Vector3 {
  v.set(snapComponent(v.x), snapComponent(v.y), snapComponent(v.z));
  return v;
}

/** One component of {@link snapToQuarterTurns}. */
function snapComponent(value: number): number {
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) <= QUARTER_TURN_EPSILON) {
    // `+ 0` turns a `Math.round(-1e-17)` result of `-0` into a plain `0`.
    return rounded + 0;
  }
  return value;
}

/** One cleared face waiting for its plate to finish fading out. */
interface FaceFade {
  /** Milliseconds the fade has run so far. */
  elapsedMs: number;
  /** Total fade duration: the active profile's `faceFadeMs` (400 / 100 ms). */
  readonly durationMs: number;
}

/**
 * The composed scene handed to the session/loop: the three.js root, the camera, the
 * per-frame inputs and the lifecycle hooks.
 */
export interface SceneView {
  /** The scene root (starfield, cube view, particles, lights). Exposed for tests/loop. */
  scene: Scene;
  /** The pinned camera (AC-2). */
  camera: PerspectiveCamera;
  /**
   * The cube view currently in the scene, for callers that need its handles at call
   * time (the session's `pickMiniCube(camera, cubeView, …)` pick).
   *
   * A `readonly` accessor, not a stored field: `levelChanged` (and the snapshot style
   * reconciliation) replaces the cube view, so a reference captured once would be the
   * disposed previous handle. Re-read it at the point of use.
   */
  readonly cubeView: CubeView;
  /**
   * Applies the engine's ordered effect intents: explosion → start the tile's pop and spawn
   * its burst in front of the face surface; `faceCleared` → start the plate fade that ends
   * in a face removal; `levelChanged` → dispose and rebuild the cube view in the new style.
   * `nowMs` is the frame time used to order pooled bursts.
   */
  applyIntents(intents: EffectIntent[], nowMs: number): void;
  /**
   * Applies one engine snapshot: the intro/travel camera (`introCameraPose` / pull-away),
   * cube orientation, starfield travel input, level reconciliation and, under reduced
   * motion, the instant settle of any running pop.
   *
   * `nowMs` is the frame time the plan's contract carries (the loop passes it); the
   * snapshot application itself is a pure function of the snapshot values — the flights
   * read `phaseProgress`, the expansion is applied on {@link SceneView.update} — so the
   * scene does not consume it.
   */
  applySnapshot(snapshot: EngineSnapshot, nowMs: number): void;
  /** Advances the frame-driven parts: starfield drift, particle aging, face fades, pops. */
  update(dtMs: number): void;
  /** Disposes every geometry/material it owns (exactly once) and empties the scene. */
  dispose(): void;
}

/**
 * Builds the composed scene for one cube level.
 *
 * @param options.style starting cube style (the cube view's materials).
 * @param options.gridSize tiles per face edge; defaults to the pinned `GRID_SIZE` (5).
 * @param options.random source for the starfield layout and the particle jitter; injected
 * so a seeded source makes the whole scene deterministic (defaults to `Math.random`).
 */
export function createSceneView(options: {
  style: CubeStyle;
  gridSize?: number;
  random?: () => number;
}): SceneView {
  const gridSize = options.gridSize ?? GRID_SIZE;
  const random = options.random ?? Math.random;

  const scene = new Scene();
  scene.background = new Color(BACKGROUND_COLOR);

  const ambientLight = new AmbientLight(0xffffff, AMBIENT_INTENSITY);
  const keyLight = new DirectionalLight(0xffffff, KEY_INTENSITY);
  keyLight.position.set(KEY_LIGHT_POSITION.x, KEY_LIGHT_POSITION.y, KEY_LIGHT_POSITION.z);

  const starfield: Starfield = createStarfield(random);
  let cube: CubeView = createCubeView(options.style, gridSize);
  const particles: ParticleSystem = createParticleSystem(random);

  scene.add(ambientLight, keyLight, starfield.points, cube.group, particles.group);

  const camera = new PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR);
  camera.position.set(0, 0, REST_Z);
  camera.lookAt(ORIGIN);

  /** Style of the cube view currently in the scene (snapshot reconciliation uses it). */
  let currentStyle = options.style;
  /** Latest motion setting; decides the face-fade duration and the instant pop mode. */
  let reducedMotion = false;
  /** Starfield travel input kept for `update` — 0..1, 0 outside a travel phase. */
  let travelProgress = 0;
  const fades = new Map<FaceId, FaceFade>();
  const instanceMatrix = new Matrix4();
  const introPosition = new Vector3();
  const introTarget = new Vector3();
  let disposed = false;

  /**
   * World-space origin of the instance an explosion belongs to. `hideMiniCube` validated
   * the id (and keeps the tile's position through the pop), so the index is on the grid;
   * the cube's world matrix carries the current orientation.
   */
  function instanceOrigin(mesh: InstancedMesh, id: MiniCubeId): Vector3 {
    const [, rowText, colText] = id.split(':');
    const index = Number(rowText) * gridSize + Number(colText);
    cube.group.updateMatrixWorld(true);
    mesh.getMatrixAt(index, instanceMatrix);
    instanceMatrix.premultiply(cube.group.matrixWorld);
    return new Vector3().setFromMatrixPosition(instanceMatrix);
  }

  /**
   * World-space outward normal of a face: the group-space {@link FACE_NORMALS} entry turned
   * by the cube's current orientation, with the quarter-turn trig residue snapped away so
   * the burst offset stays exactly assertable (spec AC-3).
   */
  function worldFaceNormal(faceId: FaceId): Vector3 {
    cube.group.updateMatrixWorld(true);
    const normal = FACE_NORMALS[faceId].clone().transformDirection(cube.group.matrixWorld);
    return snapToQuarterTurns(normal);
  }

  /**
   * One explosion: the tile starts its pop, and its burst plays {@link BURST_ORIGIN_OFFSET}
   * in front of the clicked surface so the particles read as blowing towards the camera.
   * Origin and normal are read *before* the hide, so the pop can never affect the burst.
   */
  function applyExplosion(
    intent: Extract<EffectIntent, { kind: 'explosion' }>,
    nowMs: number,
  ): void {
    const mesh = cube.faces.get(intent.faceId);
    if (mesh === undefined) {
      // A face whose instances are already gone has no origin left; the burst falls back to
      // the cube centre (no normal, no offset) rather than producing a NaN position.
      cube.hideMiniCube(intent.id, reducedMotion);
      particles.spawn(intent.burst, new Vector3(), nowMs);
      return;
    }
    const origin = instanceOrigin(mesh, intent.id);
    const normal = worldFaceNormal(intent.faceId);
    cube.hideMiniCube(intent.id, reducedMotion);
    origin.addScaledVector(normal, BURST_ORIGIN_OFFSET);
    particles.spawn(intent.burst, origin, nowMs);
  }

  /** One cleared face: its plate fades out over the active profile's `faceFadeMs`. */
  function applyFaceCleared(faceId: FaceId): void {
    if (fades.has(faceId)) {
      return;
    }
    fades.set(faceId, { elapsedMs: 0, durationMs: timingsFor(reducedMotion).faceFadeMs });
  }

  /** Swaps in a fresh cube view in `style`, disposing the previous one (AC-9, AC-10). */
  function rebuildCube(style: CubeStyle): void {
    const previous = cube;
    // A pending fade belongs to the cube that is leaving; the new cube has no faded faces.
    fades.clear();
    cube = createCubeView(style, gridSize);
    currentStyle = style;
    scene.remove(previous.group);
    scene.add(cube.group);
    previous.dispose();
  }

  /** Keeps the cube in sync with the snapshot style even without its `levelChanged`. */
  function reconcileStyle(style: CubeStyle): void {
    if (style.id !== currentStyle.id) {
      rebuildCube(style);
    }
  }

  /**
   * The intro search → find → approach choreography and the travel pull-away (AC-2), plus
   * the starfield expansion input the travel phase drives (AC-1).
   */
  function applyCamera(snapshot: EngineSnapshot): void {
    const progress = Math.min(1, Math.max(0, snapshot.phaseProgress));

    if (snapshot.reducedMotion) {
      // No fly-through and no expansion: the camera rests at every intro/travel progress.
      travelProgress = 0;
      camera.position.set(0, 0, REST_Z);
      camera.lookAt(ORIGIN);
      return;
    }
    if (snapshot.phase === 'intro') {
      travelProgress = 0;
      introCameraPose(progress, introPosition, introTarget);
      camera.position.copy(introPosition);
      camera.lookAt(introTarget);
      return;
    }
    if (snapshot.phase === 'travel') {
      travelProgress = progress;
      camera.position.set(0, 0, REST_Z + (TRAVEL_END_Z - REST_Z) * easeInOutQuad(progress));
      camera.lookAt(ORIGIN);
      return;
    }
    travelProgress = 0;
    camera.position.set(0, 0, REST_Z);
    // A skip can leave the intro mid-pan; the rest pose is the position *and* the
    // orientation, so the camera always lands looking straight at the cube.
    camera.lookAt(ORIGIN);
  }

  /** Advances the plate fades; each completed fade removes (and disposes) its face. */
  function advanceFaceFades(dtMs: number): void {
    const advanceMs = Math.max(0, dtMs);
    for (const [faceId, fade] of fades) {
      fade.elapsedMs += advanceMs;
      const progress = Math.min(1, fade.elapsedMs / fade.durationMs);
      // Plates always carry one `MeshStandardMaterial` (see `cube-view.ts`); the fade
      // lowers its opacity towards the end state `removeFace` completes.
      (cube.plateMeshes.get(faceId)!.material as Material).opacity = 1 - progress;
      if (fade.elapsedMs >= fade.durationMs) {
        fades.delete(faceId);
        cube.removeFace(faceId);
      }
    }
  }

  const view: SceneView = {
    scene,
    camera,

    get cubeView(): CubeView {
      // Rebuild-aware: `rebuildCube` re-assigns the binding, so the getter always
      // answers with the cube view the scene currently holds (never a stale one).
      return cube;
    },

    applyIntents(intents: EffectIntent[], nowMs: number): void {
      for (const intent of intents) {
        switch (intent.kind) {
          case 'explosion':
            applyExplosion(intent, nowMs);
            break;
          case 'faceCleared':
            applyFaceCleared(intent.faceId);
            break;
          case 'levelChanged':
            rebuildCube(intent.style);
            break;
          case 'travelStarted':
            // Travel lives in the snapshot: camera pull-away + starfield expansion follow
            // `phaseProgress`, so the one-shot marker needs no scene state of its own.
            break;
        }
      }
    },

    applySnapshot(snapshot: EngineSnapshot): void {
      // The frame time stays in the pinned `SceneView` signature for the loop (T13); every
      // value applied here comes from the snapshot (fades/pops are driven by `update`'s dt).
      reducedMotion = snapshot.reducedMotion;
      reconcileStyle(snapshot.style);
      applyCamera(snapshot);
      const from = snapshot.rotationFrom ?? snapshot.orientation;
      const progress = snapshot.rotationFrom === null ? 1 : snapshot.rotationProgress;
      const rotation = interpolateRotation(from, snapshot.orientation, progress);
      // `game/rotation.ts` pins the frame: `rotation.set(pitch, yaw, 0)` in the default
      // three.js 'XYZ' order puts `frontFace(orientation)` at the camera.
      cube.group.rotation.set(rotation.pitch, rotation.yaw, 0);
      if (snapshot.reducedMotion) {
        // A live switch to reduced motion settles any running pop on the spot (AC-4).
        cube.settlePops();
      }
    },

    update(dtMs: number): void {
      // The travel input persists between snapshots: a frame that only advances time
      // keeps the current expansion and the drift (see `starfield.update`).
      starfield.update(dtMs, travelProgress);
      particles.update(dtMs);
      advanceFaceFades(dtMs);
      // Pops advance after the fades, so a face removed this frame never receives a write.
      cube.update(dtMs);
    },

    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      fades.clear();
      starfield.dispose();
      cube.dispose();
      particles.dispose();
      scene.clear();
    },
  };

  return view;
}
