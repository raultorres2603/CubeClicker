/**
 * Scene composition, camera flights and intent application (T12 — plan § Render
 * interfaces; spec AC-3, AC-9, AC-10, AC-15, AC-16, AC-22).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. The scene
 * assembles the pieces the other render tasks own ({@link createStarfield} backdrop,
 * {@link createCubeView} cube, {@link createParticleSystem} explosions) plus the lights
 * and the pinned camera, and is the single place that turns engine output into three.js
 * state:
 *
 * - {@link SceneView.applyIntents} consumes the engine's one-shot `EffectIntent`s:
 *   an `explosion` hides the instance and plays its burst at the mini-cube's world
 *   origin, `faceCleared` fades the face plate and releases the face when the fade is
 *   done, `levelChanged` disposes the old cube view and builds a fresh one in the new
 *   style (AC-9, AC-10), and `travelStarted` needs nothing of its own — the travel
 *   transition is driven by the snapshot.
 * - {@link SceneView.applySnapshot} is the per-frame pull: camera flights (AC-22),
 *   cube orientation interpolation (the frame pinned in `game/rotation.ts`:
 *   `rotation.set(pitch, yaw, 0)`), the cursor highlight, the starfield travel progress
 *   and level reconciliation (a style change that arrives without its intent is applied
 *   anyway, so the cube can never disagree with the snapshot).
 * - {@link SceneView.update} advances the frame-driven parts: starfield drift, particle
 *   aging and the face fades.
 *
 * The scene receives values only; it never reads the engine (plan § Data flow) and it
 * owns every three.js object it creates, so `dispose()` can release them exactly once
 * (AC-15). Drawables stay bounded: one starfield `Points`, one cube view (6
 * `InstancedMesh` + body/highlight/plates) and one pooled particle `Points` (AC-16).
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

import { easeInOutQuad, easeOutCubic, timingsFor } from '../game/effects';
import type { EffectIntent, EngineSnapshot } from '../game/engine';
import { interpolateRotation } from '../game/rotation';
import { GRID_SIZE, type CubeStyle, type FaceId, type MiniCubeId } from '../game/types';
import { createCubeView, type CubeView } from './cube-view';
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

/** Camera rest distance — the gameplay position, and the end of the intro flight (AC-22). */
const REST_Z = 12;

/** Intro flight start distance (AC-22). */
const INTRO_START_Z = 60;

/** Travel pull-away end distance (AC-22). */
const TRAVEL_END_Z = 90;

/** Pinned lens (AC-22). */
const CAMERA_FOV = 50;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 200;

/** The camera always looks at the cube centre, wherever the flights put it. */
const ORIGIN = new Vector3(0, 0, 0);

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
  /** The pinned camera (AC-22). */
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
   * Applies the engine's ordered effect intents: explosion → hide the instance and spawn
   * its burst at the mini-cube origin; `faceCleared` → start the plate fade that ends in
   * a face removal; `levelChanged` → dispose and rebuild the cube view in the new style.
   * `nowMs` is the frame time used to order pooled bursts.
   */
  applyIntents(intents: EffectIntent[], nowMs: number): void;
  /**
   * Applies one engine snapshot: camera flight (`intro`/`travel`), cube orientation,
   * cursor highlight, starfield travel progress and level reconciliation.
   *
   * `nowMs` is the frame time the plan's contract carries (the loop passes it); the
   * snapshot application itself is a pure function of the snapshot values — the flights
   * read `phaseProgress`, the streak is applied on {@link SceneView.update} — so the
   * scene does not consume it.
   */
  applySnapshot(snapshot: EngineSnapshot, nowMs: number): void;
  /** Advances the frame-driven parts: starfield drift, particle aging, face fades. */
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
  /** Latest motion setting; decides the face-fade duration of new fades. */
  let reducedMotion = false;
  /** Starfield streak input kept for `update` — 0..1, 0 outside a travel phase. */
  let travelProgress = 0;
  const fades = new Map<FaceId, FaceFade>();
  const instanceMatrix = new Matrix4();
  let disposed = false;

  /**
   * World-space origin of the instance an explosion belongs to. `hideMiniCube` validated
   * the id (and only zero-scaled the tile, keeping its position), so the index is on the
   * grid; the cube's world matrix carries the current orientation.
   */
  function instanceOrigin(mesh: InstancedMesh, id: MiniCubeId): Vector3 {
    const [, rowText, colText] = id.split(':');
    const index = Number(rowText) * gridSize + Number(colText);
    cube.group.updateMatrixWorld(true);
    mesh.getMatrixAt(index, instanceMatrix);
    instanceMatrix.premultiply(cube.group.matrixWorld);
    return new Vector3().setFromMatrixPosition(instanceMatrix);
  }

  /** One explosion: the tile disappears and its burst plays from where it was. */
  function applyExplosion(
    intent: Extract<EffectIntent, { kind: 'explosion' }>,
    nowMs: number,
  ): void {
    cube.hideMiniCube(intent.id);
    const mesh = cube.faces.get(intent.faceId);
    // A face whose instances are already gone has no origin left; the burst falls back to
    // the cube centre rather than producing a NaN position.
    const origin = mesh === undefined ? new Vector3() : instanceOrigin(mesh, intent.id);
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

  /** The AC-22 camera flights, plus the starfield streak input the travel phase drives. */
  function applyCamera(snapshot: EngineSnapshot): void {
    const progress = Math.min(1, Math.max(0, snapshot.phaseProgress));

    if (snapshot.reducedMotion) {
      // No fly-through and no streak: the camera rests through intro and travel (AC-22).
      travelProgress = 0;
      camera.position.set(0, 0, REST_Z);
      return;
    }
    if (snapshot.phase === 'intro') {
      travelProgress = 0;
      camera.position.set(0, 0, INTRO_START_Z + (REST_Z - INTRO_START_Z) * easeOutCubic(progress));
      return;
    }
    if (snapshot.phase === 'travel') {
      travelProgress = progress;
      camera.position.set(0, 0, REST_Z + (TRAVEL_END_Z - REST_Z) * easeInOutQuad(progress));
      return;
    }
    travelProgress = 0;
    camera.position.set(0, 0, REST_Z);
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
            // Travel lives in the snapshot: camera pull-away + starfield streak follow
            // `phaseProgress`, so the one-shot marker needs no scene state of its own.
            break;
        }
      }
    },

    applySnapshot(snapshot: EngineSnapshot): void {
      // The frame time stays in the pinned `SceneView` signature for the loop (T13); every
      // value applied here comes from the snapshot (fades are driven by `update`'s dt).
      reducedMotion = snapshot.reducedMotion;
      reconcileStyle(snapshot.style);
      applyCamera(snapshot);
      const from = snapshot.rotationFrom ?? snapshot.orientation;
      const progress = snapshot.rotationFrom === null ? 1 : snapshot.rotationProgress;
      const rotation = interpolateRotation(from, snapshot.orientation, progress);
      // `game/rotation.ts` pins the frame: `rotation.set(pitch, yaw, 0)` in the default
      // three.js 'XYZ' order puts `frontFace(orientation)` at the camera.
      cube.group.rotation.set(rotation.pitch, rotation.yaw, 0);
      cube.highlightCursor(snapshot.cursor);
    },

    update(dtMs: number): void {
      // The streak value persists between snapshots: a frame that only advances time
      // keeps the current travel streak and the drift (see `starfield.update`).
      starfield.update(dtMs, travelProgress);
      particles.update(dtMs);
      advanceFaceFades(dtMs);
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
