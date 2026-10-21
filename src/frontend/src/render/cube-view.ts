/**
 * Cube view (T8) — the cube body, one instanced mini-cube grid per face and the per-face
 * base plate (spec AC-4 / AC-5 / AC-16).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. The view never
 * reads the engine; callers (`scene.ts`) push intents into it (`hideMiniCube`, `removeFace`,
 * `applyStyle`) and advance time through `update`; the view owns every geometry/material it
 * creates, so `dispose()` can release them exactly once.
 *
 * Grid layout (pinned by the plan and asserted in `cube-view.test.ts`): the body is a
 * `CUBE_SIZE` cube centred on the group origin; every face carries a `gridSize²`-instance
 * `InstancedMesh` whose instance index is `row * gridSize + col` and whose cells tile the
 * face at `CUBE_SIZE / gridSize` spacing. Tile thickness and the plate/body gap are the
 * exported constants below — the single home for the cube-view geometry numbers (the plan's
 * non-grid effect constants live in `game/effects.ts` and are imported, never redefined).
 *
 * Pop-then-shrink removal (spec AC-4). `hideMiniCube` marks the id hidden (unpickable)
 * immediately and, unless the caller asks for `instant` (reduced motion), starts one plain
 * record `{ faceId, index, elapsedMs }`. Each `update(dtMs)` rewrites that instance's matrix
 * — the face basis scaled by `tileScale * popScaleAt(elapsed)`, position preserved — and its
 * `instanceColor` slot (the brightness multiplier `popColorMultiplierAt(elapsed)` on all
 * three channels), then drops the record once the timeline ended. Every face carries one
 * static `instanceColor` buffer initialised to `(1, 1, 1)`, so idle tiles render exactly as
 * before and the pop needs no new three.js object (AC-16's drawable ceilings hold).
 */

import {
  BoxGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';

import {
  MINI_CUBE_POP_MS,
  popColorMultiplierAt,
  popScaleAt,
} from '../game/effects';
import { FACE_IDS, GRID_SIZE, type CubeStyle, type FaceId, type MiniCubeId } from '../game/types';

/** Cube body edge length in world units; the body is centred on the group origin. */
export const CUBE_SIZE = 5;

/** Distance from the cube centre to each face plane (`CUBE_SIZE / 2`). */
export const CUBE_HALF_SIZE = CUBE_SIZE / 2;

/** Tile thickness along the face normal — the tiles sit proud of the body. */
export const MINI_CUBE_THICKNESS = 0.25;

/** Tile edge length as a fraction of the grid cell, leaving the visible grid gaps. */
export const MINI_CUBE_TILE_RATIO = 0.9;

/** Gap between the body surface and a face plate. */
export const PLATE_OFFSET = 0.0625;

/** The view handed to the scene: meshes plus the intent/time entry points. */
export interface CubeView {
  /** Everything the view adds to the scene lives under this group. */
  readonly group: Group;
  /** The cube body behind the tile grids. */
  readonly body: Mesh;
  /** One `InstancedMesh` (`gridSize²` instances) per live face, in `FACE_IDS` order. */
  readonly faces: ReadonlyMap<FaceId, InstancedMesh>;
  /** One plate mesh per live face — transparent, so a clear can fade it out. */
  readonly plateMeshes: ReadonlyMap<FaceId, Mesh>;
  /**
   * Marks one mini-cube hidden (unpickable) and starts its pop animation.
   *
   * `instant` (reduced motion) zero-scales the matrix at once, with no record and no colour
   * write. Idempotent: an id already animating or hidden is never restarted, and a face
   * whose meshes are gone only records the id (no matrix write).
   */
  hideMiniCube(id: MiniCubeId, instant?: boolean): void;
  /** Whether {@link CubeView.hideMiniCube} already hid that id (used by picking). */
  isMiniCubeHidden(id: MiniCubeId): boolean;
  /**
   * Advances every running pop by `dtMs` (negative advances age nothing): rewrites the
   * instance matrix and its `instanceColor` slot, and removes the settled records.
   */
  update(dtMs: number): void;
  /** Instantly zero-scales every running pop and clears the records (live reduced-motion switch). */
  settlePops(): void;
  /** Fades + removes one face: plate opacity 0, meshes detached, resources disposed, pops cancelled. */
  removeFace(faceId: FaceId): void;
  /** Re-colours the existing materials in place (level change); nothing is rebuilt. */
  applyStyle(style: CubeStyle): void;
  /** Disposes every geometry/material exactly once, clears the records and empties the group. */
  dispose(): void;
}

/**
 * One face's outward frame: the normal plus the screen-right/screen-up axes.
 * `(right, up, normal)` is a proper rotation (right × up = normal) that puts the
 * face's local `+z` along its outward normal and its local `+y` towards the face's
 * top row.
 */
interface FaceBasis {
  /** Points away from the cube centre. */
  readonly normal: Vector3;
  /** Direction of increasing column, seen from outside the cube. */
  readonly right: Vector3;
  /** Direction of decreasing row (screen-up), seen from outside the cube. */
  readonly up: Vector3;
}

/**
 * Face frames. `back`, `left` and `bottom` are mirrored so their columns run the
 * right way when seen from outside. The vectors are written out (rather than derived
 * with `negate()`) so every component stays a plain `0`, never a signed zero.
 */
const FACE_BASES: Readonly<Record<FaceId, FaceBasis>> = {
  front: { normal: new Vector3(0, 0, 1), right: new Vector3(1, 0, 0), up: new Vector3(0, 1, 0) },
  back: { normal: new Vector3(0, 0, -1), right: new Vector3(-1, 0, 0), up: new Vector3(0, 1, 0) },
  left: { normal: new Vector3(-1, 0, 0), right: new Vector3(0, 0, 1), up: new Vector3(0, 1, 0) },
  right: { normal: new Vector3(1, 0, 0), right: new Vector3(0, 0, -1), up: new Vector3(0, 1, 0) },
  top: { normal: new Vector3(0, 1, 0), right: new Vector3(1, 0, 0), up: new Vector3(0, 0, -1) },
  bottom: { normal: new Vector3(0, -1, 0), right: new Vector3(1, 0, 0), up: new Vector3(0, 0, 1) },
};

/**
 * Group-space unit outward normals, one per face (spec AC-3): exactly the `normal` axis of
 * each face frame, with every component a plain `0` / `±1`. The scene transforms them by
 * the cube group's world matrix to place a burst in front of the clicked tile; callers
 * never mutate these vectors (clone before transforming).
 */
export const FACE_NORMALS: Readonly<Record<FaceId, Vector3>> = {
  front: FACE_BASES.front.normal,
  back: FACE_BASES.back.normal,
  left: FACE_BASES.left.normal,
  right: FACE_BASES.right.normal,
  top: FACE_BASES.top.normal,
  bottom: FACE_BASES.bottom.normal,
};

/** Mutable per-face bookkeeping kept for the lifetime of the view (removal included). */
interface FaceRecord {
  readonly basis: Matrix4;
  /** Instance centre per index (`row * gridSize + col`), in group space. */
  readonly positions: Vector3[];
  readonly mesh: InstancedMesh;
  readonly plate: Mesh;
  readonly tileMaterial: MeshStandardMaterial;
  readonly plateMaterial: MeshStandardMaterial;
}

/** One running pop: which instance of which face, and how far along the timeline it is. */
interface PopRecord {
  readonly faceId: FaceId;
  readonly index: number;
  elapsedMs: number;
}

/** `row * gridSize + col`, rejecting anything off the grid with a concrete message. */
function miniCubeIndex(id: string, row: number, col: number, gridSize: number): number {
  if (
    !Number.isInteger(row) ||
    !Number.isInteger(col) ||
    row < 0 ||
    row >= gridSize ||
    col < 0 ||
    col >= gridSize
  ) {
    throw new RangeError(`mini-cube "${id}" is outside the ${gridSize}x${gridSize} grid`);
  }
  return row * gridSize + col;
}

/** Splits `face:row:col`, rejecting malformed ids before they reach the grid. */
function parseMiniCubeId(
  id: string,
  gridSize: number,
): { faceId: FaceId; row: number; col: number; index: number } {
  const parts = id.split(':');
  if (parts.length !== 3) {
    throw new Error(`invalid mini-cube id "${id}"`);
  }
  const faceId = parts[0] as string;
  const row = Number(parts[1]);
  const col = Number(parts[2]);
  if (
    !(FACE_IDS as readonly string[]).includes(faceId) ||
    !Number.isInteger(row) ||
    !Number.isInteger(col)
  ) {
    throw new Error(`invalid mini-cube id "${id}"`);
  }
  return { faceId: faceId as FaceId, row, col, index: miniCubeIndex(id, row, col, gridSize) };
}

/**
 * Builds the cube view for one cube level.
 *
 * @param style pinned cube style (`game/progression.ts`) applied at creation.
 * @param gridSize tiles per face edge; defaults to the pinned `GRID_SIZE` (5).
 */
export function createCubeView(style: CubeStyle, gridSize: number = GRID_SIZE): CubeView {
  if (!Number.isInteger(gridSize) || gridSize < 1) {
    throw new RangeError(`gridSize must be a positive integer, received ${gridSize}`);
  }

  const cellSize = CUBE_SIZE / gridSize;
  const tileSize = cellSize * MINI_CUBE_TILE_RATIO;
  const tileScale = new Vector3(tileSize, tileSize, MINI_CUBE_THICKNESS);
  const gridMid = (gridSize - 1) / 2;
  const tileDistance = CUBE_HALF_SIZE + MINI_CUBE_THICKNESS / 2;
  const plateDistance = CUBE_HALF_SIZE + PLATE_OFFSET;
  const instanceCount = gridSize * gridSize;

  const group = new Group();
  const bodyMaterial = new MeshStandardMaterial({
    color: style.cubeColor,
    metalness: style.metalness,
    roughness: style.roughness,
  });
  const body = new Mesh(new BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE), bodyMaterial);
  group.add(body);

  const records = new Map<FaceId, FaceRecord>();
  const faces = new Map<FaceId, InstancedMesh>();
  const plateMeshes = new Map<FaceId, Mesh>();
  const hiddenIndices = new Map<FaceId, Set<number>>();
  const removedFaces = new Set<FaceId>();
  const disposedResources = new Set<BufferGeometry | Material>();
  const pops: PopRecord[] = [];
  const scratch = new Matrix4();
  const popScale = new Vector3();
  let disposed = false;

  for (const faceId of FACE_IDS) {
    const frame = FACE_BASES[faceId];
    const basis = new Matrix4().makeBasis(frame.right, frame.up, frame.normal);

    // One geometry per face (rather than one shared tile geometry) so a face removal
    // can dispose its own resources without touching the surviving faces.
    const tileMaterial = new MeshStandardMaterial({
      color: style.miniCubeColor,
      metalness: style.metalness,
      roughness: style.roughness,
    });
    const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), tileMaterial, instanceCount);
    // Static per-instance colour multiplier, white by default: idle tiles are unchanged,
    // and the pop only writes scalar brightness into the running instance's slot.
    const instanceColor = new InstancedBufferAttribute(new Float32Array(instanceCount * 3), 3);
    instanceColor.array.fill(1);
    instanceColor.needsUpdate = true;
    mesh.instanceColor = instanceColor;

    const positions: Vector3[] = [];
    for (let row = 0; row < gridSize; row += 1) {
      for (let col = 0; col < gridSize; col += 1) {
        const index = row * gridSize + col;
        const position = new Vector3()
          .copy(frame.normal)
          .multiplyScalar(tileDistance)
          .addScaledVector(frame.right, (col - gridMid) * cellSize)
          .addScaledVector(frame.up, (gridMid - row) * cellSize);
        positions.push(position);
        // `copy(basis).scale(...)` scales the exact axis-aligned basis columns instead
        // of round-tripping a quaternion; the position is set afterwards so a zero
        // scale empties only the linear part and keeps the tile's slot visible to
        // `getMatrixAt` readers (picking reads it to skip hidden instances).
        scratch.copy(basis).scale(tileScale).setPosition(position);
        mesh.setMatrixAt(index, scratch);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;

    const plateMaterial = new MeshStandardMaterial({
      color: style.cubeColor,
      metalness: style.metalness,
      roughness: style.roughness,
      transparent: true,
      opacity: 1,
    });
    const plate = new Mesh(new PlaneGeometry(CUBE_SIZE, CUBE_SIZE), plateMaterial);
    plate.position.copy(frame.normal).multiplyScalar(plateDistance);
    plate.quaternion.setFromRotationMatrix(basis);

    records.set(faceId, { basis, positions, mesh, plate, tileMaterial, plateMaterial });
    faces.set(faceId, mesh);
    plateMeshes.set(faceId, plate);
    hiddenIndices.set(faceId, new Set());
    group.add(mesh, plate);
  }

  function disposeResource(resource: BufferGeometry | Material): void {
    if (disposedResources.has(resource)) {
      return;
    }
    disposedResources.add(resource);
    resource.dispose();
  }

  /** Writes the instance matrix for a pop scale factor, preserving the tile's position. */
  function writePopMatrix(record: FaceRecord, index: number, factor: number): void {
    popScale.set(tileSize * factor, tileSize * factor, MINI_CUBE_THICKNESS * factor);
    scratch.copy(record.basis).scale(popScale).setPosition(record.positions[index]!);
    record.mesh.setMatrixAt(index, scratch);
    record.mesh.instanceMatrix.needsUpdate = true;
  }

  /** Writes the instance's brightness multiplier on all three channels. */
  function writePopColor(record: FaceRecord, index: number, multiplier: number): void {
    const instanceColor = record.mesh.instanceColor!;
    instanceColor.setXYZ(index, multiplier, multiplier, multiplier);
    instanceColor.needsUpdate = true;
  }

  function hideMiniCube(id: MiniCubeId, instant = false): void {
    const { faceId, index } = parseMiniCubeId(id, gridSize);
    const hidden = hiddenIndices.get(faceId)!;
    if (hidden.has(index)) {
      // Already hidden or animating: a repeated intent never restarts the pop.
      return;
    }
    hidden.add(index);
    const record = records.get(faceId)!;
    if (removedFaces.has(faceId)) {
      // The face's meshes are already detached; the id is only recorded as hidden.
      return;
    }
    if (instant) {
      // Reduced motion: the predecessor's instantaneous hidden end state, no flash.
      writePopMatrix(record, index, 0);
      return;
    }
    // The pop starts at factor 1 (the tile's own size), so the matrix needs no write now.
    pops.push({ faceId, index, elapsedMs: 0 });
  }

  function isMiniCubeHidden(id: MiniCubeId): boolean {
    const { faceId, index } = parseMiniCubeId(id, gridSize);
    return hiddenIndices.get(faceId)!.has(index);
  }

  function update(dtMs: number): void {
    if (pops.length === 0) {
      return;
    }
    const advanceMs = Math.max(0, dtMs);
    for (let popIndex = pops.length - 1; popIndex >= 0; popIndex -= 1) {
      const pop = pops[popIndex]!;
      pop.elapsedMs += advanceMs;
      const record = records.get(pop.faceId)!;
      writePopMatrix(record, pop.index, popScaleAt(pop.elapsedMs));
      writePopColor(record, pop.index, popColorMultiplierAt(pop.elapsedMs));
      if (pop.elapsedMs >= MINI_CUBE_POP_MS) {
        pops.splice(popIndex, 1);
      }
    }
  }

  function settlePops(): void {
    for (const pop of pops) {
      const record = records.get(pop.faceId)!;
      // The timeline's exact end state: zero scale, colour back to the idle multiplier.
      writePopMatrix(record, pop.index, 0);
      writePopColor(record, pop.index, 1);
    }
    pops.length = 0;
  }

  function removeFace(faceId: FaceId): void {
    if (removedFaces.has(faceId)) {
      return;
    }
    removedFaces.add(faceId);
    // The face is leaving: its running pops can never be written again.
    for (let popIndex = pops.length - 1; popIndex >= 0; popIndex -= 1) {
      if (pops[popIndex]!.faceId === faceId) {
        pops.splice(popIndex, 1);
      }
    }
    const record = records.get(faceId)!;
    // Fade end state first (the scene drives the fade by lowering `opacity`), then the
    // meshes leave the group and their resources are released exactly once.
    record.plateMaterial.opacity = 0;
    record.plate.visible = false;
    faces.delete(faceId);
    plateMeshes.delete(faceId);
    group.remove(record.mesh);
    group.remove(record.plate);
    disposeResource(record.mesh.geometry);
    disposeResource(record.tileMaterial);
    disposeResource(record.plate.geometry);
    disposeResource(record.plateMaterial);
  }

  function applyStyle(next: CubeStyle): void {
    bodyMaterial.color.set(next.cubeColor);
    bodyMaterial.metalness = next.metalness;
    bodyMaterial.roughness = next.roughness;
    for (const [faceId, record] of records) {
      if (removedFaces.has(faceId)) {
        // Disposed materials are left untouched.
        continue;
      }
      record.tileMaterial.color.set(next.miniCubeColor);
      record.tileMaterial.metalness = next.metalness;
      record.tileMaterial.roughness = next.roughness;
      record.plateMaterial.color.set(next.cubeColor);
    }
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    pops.length = 0;
    disposeResource(body.geometry);
    disposeResource(bodyMaterial);
    for (const record of records.values()) {
      disposeResource(record.mesh.geometry);
      disposeResource(record.tileMaterial);
      disposeResource(record.plate.geometry);
      disposeResource(record.plateMaterial);
    }
    group.clear();
    faces.clear();
    plateMeshes.clear();
  }

  return {
    group,
    body,
    faces,
    plateMeshes,
    hideMiniCube,
    isMiniCubeHidden,
    update,
    settlePops,
    removeFace,
    applyStyle,
    dispose,
  };
}
