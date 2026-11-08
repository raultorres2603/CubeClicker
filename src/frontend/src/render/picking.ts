/**
 * Mini-cube picking (T10 — plan § Render interfaces `pickMiniCube`, spec AC-5/AC-6/AC-35).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. It turns a
 * pointer NDC position into a mini-cube id; the caller owns the phase policy and supplies
 * the front face (`session.ts` passes `frontFace(snapshot.orientation)`).
 *
 * Two paths share one raycaster:
 *
 * - {@link pickMiniCube} is the click path: one raycast per tap, returns a fresh
 *   `MiniCubeId` string (or `null`). Its behaviour is unchanged.
 * - {@link pickHoverTarget} is the pointer-move path (AC-35): the session coalesces moves
 *   to at most one call per animation frame, and this function reuses a module-owned NDC
 *   vector, intersection array and result object, so a stream of pointer events never
 *   allocates a per-event result. The hit id string is also cached until the hovered tile
 *   changes.
 *
 * Pinned contract for both paths:
 *
 * - A real `THREE.Raycaster` casts through `(ndcX, ndcY)` from the given camera.
 * - Only the `InstancedMesh` of the face named by `frontFaceId` is intersected: a ray that
 *   reaches the cube through the body, a plate or any of the other five faces is a miss
 *   (`null`) — the gate is the target itself, so no ordering or occlusion bookkeeping is
 *   needed.
 * - A hit decodes to `face:row:col` with the cube view's own instance encoding
 *   (`row * gridSize + col`); the grid size is read back from the instance count, so grids
 *   other than the pinned `GRID_SIZE` pick correctly.
 * - A hidden instance (`CubeView.hideMiniCube`) is not pickable, and a removed face
 *   (`CubeView.removeFace`) has no pickable geometry left.
 */

import {
  Raycaster,
  Vector2,
  type InstancedMesh,
  type Intersection,
  type PerspectiveCamera,
} from 'three';

import type { FaceId, MiniCubeId } from '../game/types';
import type { CubeView } from './cube-view';

/**
 * Shared raycaster. Picking is event/frame-driven (never nested), so a single instance is
 * reused by both paths.
 */
const raycaster = new Raycaster();

/** Shared NDC port for the click path's {@link Raycaster.setFromCamera} call. */
const pointerNdc = new Vector2();

/** Preallocated NDC port for the hover path (AC-35: no per-event vector). */
const hoverNdc = new Vector2();

/** Preallocated intersection storage for the hover path (AC-35: no per-event result array). */
const hoverIntersections: Intersection<InstancedMesh>[] = [];

/** The reusable hover result the session reads immediately after the call. */
export interface HoverPick {
  /** The hovered front-face mini-cube, or `null` for a miss/hidden tile. */
  id: MiniCubeId | null;
}

const hoverResult: HoverPick = { id: null };

/** The cached hover hit, so a pointer moving within one tile never rebuilds the id string. */
let cachedFace: FaceId | null = null;
let cachedRow = -1;
let cachedCol = -1;
let cachedId: MiniCubeId | null = null;

/**
 * Resolves a pointer position on the canvas to the mini-cube it hits (click path).
 *
 * @param camera the perspective camera the frame was rendered with.
 * @param cubeView the live cube view; only its `faces`/`isMiniCubeHidden` surface is used.
 * @param frontFaceId the face that currently faces the camera — the only pickable one.
 * @param ndcX normalised device x in `[-1, 1]` (`-1` = left edge).
 * @param ndcY normalised device y in `[-1, 1]` (`-1` = bottom edge).
 * @returns the hit mini-cube id, or `null` for a miss, a hit on any other object, a hidden
 *   instance or a face that was already removed.
 */
export function pickMiniCube(
  camera: PerspectiveCamera,
  cubeView: CubeView,
  frontFaceId: FaceId,
  ndcX: number,
  ndcY: number,
): MiniCubeId | null {
  const mesh = cubeView.faces.get(frontFaceId);
  if (mesh === undefined) {
    // The face was cleared and removed: nothing of it is left to hit.
    return null;
  }

  // A tap can arrive in the same task as a rotation, before the frame loop refreshes the
  // world matrices, so both ends of the ray are brought up to date here: the camera
  // (`unproject` reads `matrixWorld`) and the target's ancestor chain (the cube group
  // carries the orientation, so the ray matches what the next frame would draw).
  camera.updateMatrixWorld();
  mesh.updateWorldMatrix(true, false);

  pointerNdc.set(ndcX, ndcY);
  raycaster.setFromCamera(pointerNdc, camera);

  // Non-recursive: the face's `InstancedMesh` is the whole target set.
  const instanceId = raycaster.intersectObject(mesh, false)[0]?.instanceId;
  if (instanceId === undefined) {
    return null;
  }

  // `InstancedMesh.raycast` tags every hit with the instance it tested; the cube view
  // allocates `gridSize²` instances numbered `row * gridSize + col`.
  const gridSize = Math.round(Math.sqrt(mesh.count));
  const row = Math.floor(instanceId / gridSize);
  const col = instanceId % gridSize;
  const id: MiniCubeId = `${frontFaceId}:${row}:${col}`;

  if (cubeView.isMiniCubeHidden(id)) {
    // An exploded instance is unpickable from the intent on, before its conceal has
    // settled, so a second tap on the animating tile can never double-fire.
    return null;
  }

  return id;
}

/**
 * Resolves the hovered front-face mini-cube for the target lock (AC-35).
 *
 * The session calls this at most once per animation frame; the returned {@link HoverPick}
 * object is module-owned and reused on every call, and the cached id string only changes
 * when the hovered tile changes. The result's `id` is `null` for a miss, a hit on a
 * non-front face, a hidden instance or a removed face.
 */
export function pickHoverTarget(
  camera: PerspectiveCamera,
  cubeView: CubeView,
  frontFaceId: FaceId,
  ndcX: number,
  ndcY: number,
): HoverPick {
  const mesh = cubeView.faces.get(frontFaceId);
  if (mesh === undefined) {
    hoverResult.id = null;
    return hoverResult;
  }

  camera.updateMatrixWorld();
  mesh.updateWorldMatrix(true, false);

  hoverNdc.set(ndcX, ndcY);
  raycaster.setFromCamera(hoverNdc, camera);

  // Preallocated result storage: three appends each hit to this array; clearing its
  // length drops the references without allocating a new array per pointer event.
  hoverIntersections.length = 0;
  raycaster.intersectObject(mesh, false, hoverIntersections);
  const instanceId = hoverIntersections[0]?.instanceId;
  hoverIntersections.length = 0;

  if (instanceId === undefined) {
    hoverResult.id = null;
    return hoverResult;
  }

  const gridSize = Math.round(Math.sqrt(mesh.count));
  const row = Math.floor(instanceId / gridSize);
  const col = instanceId % gridSize;

  if (cachedFace !== frontFaceId || cachedRow !== row || cachedCol !== col) {
    cachedFace = frontFaceId;
    cachedRow = row;
    cachedCol = col;
    cachedId = `${frontFaceId}:${row}:${col}`;
  }

  hoverResult.id =
    cachedId !== null && cubeView.isMiniCubeHidden(cachedId) ? null : cachedId;
  return hoverResult;
}
