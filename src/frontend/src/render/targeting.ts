/**
 * Target lock: tile outline + reticle (T9; spec AC-35, AC-48; plan § Picking / targeting).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. The scene
 * pushes the hovered mini-cube (`setHoverTarget`) and the module renders:
 *
 * - one white `LineSegments` edge box around the hovered tile at `1.03` tile scale,
 *   `depthTest: false`, `renderOrder: 11` (one draw);
 * - six 2×14 px-equivalent ticks at 60° around the tile, 20 px-equivalent from the tip
 *   (one `LineSegments`, 12 vertices / one draw).
 *
 * The reticle fades in over `reticleFadeMs = 120` and holds for `reticleDwellMs = 250`;
 * a miss hides everything. Reduced motion keeps the outline static (opacity 1, no fade)
 * and turns the ticks off. The adaptive quality tier can disable the ticks
 * (`setReticleEnabled`); the outline stays as the lock core.
 *
 * The module is a child of the scene's existing particle group, so `scene.children`
 * stays 9 and every hover update leaves the scene graph untouched.
 */

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';

import { REFERENCE_PIXEL_WORLD } from '../game/effects';
import { MOTION } from '../game/motion';
import type { FaceId, MiniCubeId } from '../game/types';
import type { CubeView } from './cube-view';

/** Outline scale relative to the hovered tile (AC-35). */
export const TARGETING_OUTLINE_SCALE = 1.03;

/** Outline render order (above the cube and the burst). */
export const TARGETING_OUTLINE_RENDER_ORDER = 11;

/** Tick distance from the pointer/tile centre: 20 px-equivalent. */
export const RETICLE_TICK_RADIUS = 20 * REFERENCE_PIXEL_WORLD;

/** Tick length: 14 px-equivalent. */
export const RETICLE_TICK_LENGTH = 14 * REFERENCE_PIXEL_WORLD;

/** Number of reticle ticks (one line each). */
export const RETICLE_TICK_COUNT = 6;

/** Vertex count of the reticle `LineSegments` (two per tick). */
export const RETICLE_VERTEX_COUNT = RETICLE_TICK_COUNT * 2;

/** The targeting handle handed to the scene. */
export interface Targeting {
  /** Group holding exactly two `LineSegments` (outline + reticle). */
  readonly group: Group;
  /** Shows the outline around `id` and the ticks around the tile; `null` hides (a miss). */
  setHoverTarget(id: MiniCubeId | null, cubeView: CubeView | null): void;
  /** Advances the 120 ms fade; reduced motion is static with ticks off. */
  update(dtMs: number, reducedMotion: boolean): void;
  /** Adaptive quality: enables/disables the six reticle ticks (outline unaffected). */
  setReticleEnabled(enabled: boolean): void;
  /** Current reticle opacity (0..1), for tests. */
  getReticleOpacity(): number;
  /** Whether the outline + ticks are currently visible. */
  isVisible(): boolean;
  /** Releases both geometries/materials exactly once; idempotent. */
  dispose(): void;
}

/** Builds the six 60° tick segments in local screen-space XY around the tile centre. */
function createReticleSegments(): LineSegments {
  const positions = new Float32Array(RETICLE_VERTEX_COUNT * 3);
  for (let index = 0; index < RETICLE_TICK_COUNT; index += 1) {
    const angle = (index / RETICLE_TICK_COUNT) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const start = index * 6;
    positions[start] = cos * RETICLE_TICK_RADIUS;
    positions[start + 1] = sin * RETICLE_TICK_RADIUS;
    positions[start + 2] = 0;
    positions[start + 3] = cos * (RETICLE_TICK_RADIUS + RETICLE_TICK_LENGTH);
    positions[start + 4] = sin * (RETICLE_TICK_RADIUS + RETICLE_TICK_LENGTH);
    positions[start + 5] = 0;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const material = new LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const segments = new LineSegments(geometry, material);
  segments.name = 'targeting-reticle';
  segments.renderOrder = TARGETING_OUTLINE_RENDER_ORDER;
  segments.frustumCulled = false;
  return segments;
}

/** Builds the targeting renderer. */
export function createTargeting(): Targeting {
  const group = new Group();
  group.name = 'targeting';
  group.visible = false;

  // Outline: one edge box at 1.03 tile scale.
  const outlineGeometry = new EdgesGeometry(new BoxGeometry(1, 1, 1));
  const outlineMaterial = new LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  });
  const outline = new LineSegments(outlineGeometry, outlineMaterial);
  outline.name = 'targeting-outline';
  outline.renderOrder = TARGETING_OUTLINE_RENDER_ORDER;
  outline.frustumCulled = false;

  const reticle = createReticleSegments();
  group.add(outline, reticle);

  const instanceMatrix = new Matrix4();
  const scratchQuaternion = new Quaternion();
  const scratchPosition = new Vector3();
  const scratchScale = new Vector3();
  let reticleEnabled = true;
  let hovered = false;
  let fadeElapsedMs = 0;
  let disposed = false;

  function applyOpacity(opacity: number): void {
    outlineMaterial.opacity = opacity;
    (reticle.material as LineBasicMaterial).opacity = opacity;
  }

  function hide(): void {
    hovered = false;
    group.visible = false;
  }

  function setHoverTarget(id: MiniCubeId | null, cubeView: CubeView | null): void {
    if (disposed) {
      return;
    }
    if (id === null || cubeView === null) {
      hide();
      return;
    }
    const parts = id.split(':');
    if (parts.length !== 3) {
      throw new Error(`invalid mini-cube id "${id}"`);
    }
    const faceId = parts[0] as FaceId;
    const mesh = cubeView.faces.get(faceId);
    if (mesh === undefined) {
      // A removed face has no tile left to lock.
      hide();
      return;
    }
    const row = Number(parts[1]);
    const col = Number(parts[2]);
    const gridSize = Math.round(Math.sqrt(mesh.count));
    const index = row * gridSize + col;
    if (
      !Number.isInteger(row) ||
      !Number.isInteger(col) ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= mesh.count
    ) {
      throw new RangeError(`mini-cube "${id}" is outside the ${gridSize}x${gridSize} grid`);
    }
    if (cubeView.isMiniCubeHidden(id)) {
      // A concealed tile has no target left to lock.
      hide();
      return;
    }
    cubeView.group.updateMatrixWorld(true);
    mesh.getMatrixAt(index, instanceMatrix);
    instanceMatrix.premultiply(cubeView.group.matrixWorld);
    instanceMatrix.decompose(scratchPosition, scratchQuaternion, scratchScale);
    outline.position.copy(scratchPosition);
    outline.quaternion.copy(scratchQuaternion);
    outline.scale.copy(scratchScale).multiplyScalar(TARGETING_OUTLINE_SCALE);
    reticle.position.copy(scratchPosition);
    reticle.quaternion.copy(scratchQuaternion);
    reticle.scale.set(1, 1, 1);
    hovered = true;
    group.visible = true;
    fadeElapsedMs = 0;
    applyOpacity(0);
    reticle.visible = reticleEnabled;
  }

  function update(dtMs: number, reducedMotion: boolean): void {
    if (disposed || !hovered) {
      return;
    }
    if (reducedMotion) {
      // Static outline, no ticks (AC-35/AC-48).
      applyOpacity(1);
      reticle.visible = false;
      return;
    }
    fadeElapsedMs += Math.max(0, dtMs);
    applyOpacity(Math.min(1, fadeElapsedMs / MOTION.reticleFadeMs));
    reticle.visible = reticleEnabled;
  }

  function setReticleEnabled(enabled: boolean): void {
    reticleEnabled = enabled;
    if (!enabled) {
      reticle.visible = false;
    } else if (hovered) {
      reticle.visible = true;
    }
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    group.visible = false;
    group.clear();
    outlineGeometry.dispose();
    outlineMaterial.dispose();
    reticle.geometry.dispose();
    (reticle.material as LineBasicMaterial).dispose();
  }

  return {
    group,
    setHoverTarget,
    update,
    setReticleEnabled,
    getReticleOpacity: () => outlineMaterial.opacity,
    isVisible: () => group.visible,
    dispose,
  };
}
