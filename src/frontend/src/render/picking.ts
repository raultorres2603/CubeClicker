/**
 * Mini-cube picking (T10 — plan § Render interfaces `pickMiniCube`, spec § Click and
 * explosion, AC-5 / AC-6).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. It turns a
 * pointer NDC position into a mini-cube id; the caller owns the phase policy and supplies
 * the front face (`session.ts` passes `frontFace(snapshot.orientation)`).
 *
 * Pinned contract:
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

import { Raycaster, Vector2, type PerspectiveCamera } from 'three';

import type { FaceId, MiniCubeId } from '../game/types';
import type { CubeView } from './cube-view';

/**
 * Shared raycaster. Picking is event-driven (at most one pick per tap, never nested), so a
 * single instance is reused and the function allocates nothing per pick.
 */
const raycaster = new Raycaster();

/** Shared NDC port for {@link Raycaster.setFromCamera} (which only reads its components). */
const pointerNdc = new Vector2();

/**
 * Resolves a pointer position on the canvas to the mini-cube it hits.
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
    // An exploded instance is unpickable from the intent on, before its 160 ms pop has
    // shrunk it away, so a second tap on the animating tile can never double-fire.
    return null;
  }

  return id;
}
