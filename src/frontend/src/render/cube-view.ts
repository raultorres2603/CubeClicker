/**
 * Cube view — the cube body and one instanced mini-cube grid per face (spec AC-2 / AC-4 /
 * AC-16).
 *
 * Layer: render adapter (`render/**`) — three.js only, no DOM, no game rules. The view never
 * reads the engine; callers (`scene.ts`) push intents into it (`hideMiniCube`, `removeFace`,
 * `applyStyle`) and advance time through `update`; the view owns every geometry/material it
 * creates, so `dispose()` can release them exactly once.
 *
 * Seamed mini-cube surface (spec AC-1). Each face is tiled by its mini-cubes with a thin
 * uniform seam: the body is a `CUBE_SIZE` cube centred on the group origin and every face
 * carries a `gridSize²`-instance `InstancedMesh` whose instance index is
 * `row * gridSize + col` and whose tiles are `0.95 × CUBE_SIZE / gridSize` wide. The tiles
 * are inset inside their cells, so the body shows through the gaps between adjacent tiles
 * as thin tile lines and through the half-seam rim around each face's perimeter — no plate,
 * no extra geometry, no new drawable. The body is the dark interior a player sees in those
 * seams and where tiles have been removed. Each tile is a `RoundedBoxGeometry` with the
 * pinned bevel segments/radius (spec AC-14) so the face reads as glossy beveled mini-cubes;
 * the body stays a plain `BoxGeometry`. Tile thickness is the exported constant below —
 * the single home for the cube-view geometry numbers (the plan's non-grid effect constants
 * live in `game/effects.ts` and are imported, never redefined).
 *
 * Instant conceal (superseded by the 140 ms destroy, spec AC-4). `hideMiniCube` marks the id
 * hidden (unpickable) on the same frame; with `instant === true` (reduced motion, roster
 * hydration) it also zero-scales the instance immediately and leaves its colour at 1. With
 * `instant === false` it writes brightness 3 on the hide frame and records the destroy;
 * `update` advances each record through the pure {@link miniCubeDestroyScaleAt} /
 * {@link miniCubeDestroyBrightnessAt} curves, writing the instance matrix and colour each
 * frame, and zero-scales/restores the idle colour at 140 ms. Every face keeps one static
 * `instanceColor` buffer initialised to `(1, 1, 1)`, so idle tiles render exactly as before
 * and the destroy needs no new three.js object (the AC-8 drawable ceilings hold).
 */

import {
  BoxGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

import {
  miniCubeDestroyBrightnessAt,
  miniCubeDestroyScaleAt,
  MINI_CUBE_POP_MS,
} from '../game/effects';
import { FACE_IDS, GRID_SIZE, type CubeStyle, type FaceId, type MiniCubeId } from '../game/types';

/** Cube body edge length in world units; the body is centred on the group origin. */
export const CUBE_SIZE = 5;

/** Distance from the cube centre to each face plane (`CUBE_SIZE / 2`). */
export const CUBE_HALF_SIZE = CUBE_SIZE / 2;

/** Tile thickness along the face normal — the tiles sit proud of the body. */
export const MINI_CUBE_THICKNESS = 0.25;

/**
 * Tile edge length as a fraction of the grid cell (spec AC-1).
 *
 * `0.95` — the tiles are inset inside their cells: `tileSize = 0.95 × CUBE_SIZE / gridSize`,
 * so adjacent tiles are separated by a uniform seam of `0.05 × CUBE_SIZE / gridSize` world
 * units and the outermost tiles leave a half-seam rim at the face perimeter. The cube body
 * (the dark interior) shows through every seam as the tile lines — no plates, no new
 * objects, nothing covers the body. The seam fraction is derived from this ratio
 * (`1 − MINI_CUBE_TILE_RATIO`), never a second constant.
 */
export const MINI_CUBE_TILE_RATIO = 0.95;

/** Bevel segments per tile edge for the rounded mini-cube geometry (spec AC-14). */
export const MINI_CUBE_BEVEL_SEGMENTS = 2;

/** Bevel radius of the tile geometry, in tile-local units (spec AC-14). */
export const MINI_CUBE_BEVEL_RADIUS = 0.08;

/** Clearcoat amount for the cube's PBR surfaces (AC-3). */
export const MATERIAL_CLEARCOAT = 0.35;

/** Clearcoat roughness for the cube's PBR surfaces (AC-3). */
export const MATERIAL_CLEARCOAT_ROUGHNESS = 0.2;

/** The view handed to the scene: meshes plus the intent/time entry points. */
export interface CubeView {
  /** Everything the view adds to the scene lives under this group. */
  readonly group: Group;
  /** The cube body behind the tile grids — the dark interior (spec AC-2). */
  readonly body: Mesh;
  /** One `InstancedMesh` (`gridSize²` instances) per live face, in `FACE_IDS` order. */
  readonly faces: ReadonlyMap<FaceId, InstancedMesh>;
  /**
   * Marks one mini-cube hidden (unpickable) on the same frame and starts its destroy
   * (spec AC-4). With `instant === true` (reduced motion / roster snapshots) the instance is
   * zero-scaled immediately and its colour left at 1; with `instant === false` the tile
   * flashes brightness 3 and collapses over 140 ms through {@link CubeView.update}.
   * Idempotent: an id already hidden is never restarted, and a face whose meshes are gone
   * only records the id (no matrix write).
   */
  hideMiniCube(id: MiniCubeId, instant?: boolean): void;
  /** Whether {@link CubeView.hideMiniCube} already hid that id (used by picking). */
  isMiniCubeHidden(id: MiniCubeId): boolean;
  /**
   * Advances every live destroy record by `dtMs` (`dtMs <= 0` advances nothing), writing the
   * instance matrix and colour from the pinned scale/brightness curves. A record reaching
   * 140 ms is zero-scaled, its colour restored to 1 and dropped.
   */
  update(dtMs: number): void;
  /** Zero-scales every live destroy record and restores its colour 1 immediately. */
  settlePops(): void;
  /**
   * Removes one face (spec AC-2): its `InstancedMesh` leaves the group, and its geometry
   * and material are disposed exactly once. There is no plate and no opacity write anywhere
   * on the cube.
   */
  removeFace(faceId: FaceId): void;
  /** Re-colours the body and the live faces' tile materials in place; nothing is rebuilt. */
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
  readonly tileMaterial: MeshPhysicalMaterial;
  /** Live destroy records for this face: instance index → elapsed ms (≤ 25 entries). */
  readonly pops: Map<number, number>;
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
  // Seamed tiling (spec AC-1): the tile edge is 95% of the cell, so the tiles keep their
  // centres and leave a uniform 5% seam between neighbours and around the face perimeter.
  const tileSize = cellSize * MINI_CUBE_TILE_RATIO;
  const tileScale = new Vector3(tileSize, tileSize, MINI_CUBE_THICKNESS);
  const gridMid = (gridSize - 1) / 2;
  const tileDistance = CUBE_HALF_SIZE + MINI_CUBE_THICKNESS / 2;
  const instanceCount = gridSize * gridSize;

  const group = new Group();
  const bodyMaterial = new MeshPhysicalMaterial({
    color: style.cubeColor,
    metalness: style.metalness,
    roughness: style.roughness,
    clearcoat: MATERIAL_CLEARCOAT,
    clearcoatRoughness: MATERIAL_CLEARCOAT_ROUGHNESS,
  });
  const body = new Mesh(new BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE), bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const records = new Map<FaceId, FaceRecord>();
  const faces = new Map<FaceId, InstancedMesh>();
  const hiddenIndices = new Map<FaceId, Set<number>>();
  const removedFaces = new Set<FaceId>();
  const disposedResources = new Set<BufferGeometry | Material>();
  const scratch = new Matrix4();
  const popScale = new Vector3();
  let disposed = false;

  for (const faceId of FACE_IDS) {
    const frame = FACE_BASES[faceId];
    const basis = new Matrix4().makeBasis(frame.right, frame.up, frame.normal);

    // One geometry per face (rather than one shared tile geometry) so a face removal
    // can dispose its own resources without touching the surviving faces.
    const tileMaterial = new MeshPhysicalMaterial({
      color: style.miniCubeColor,
      metalness: style.metalness,
      roughness: style.roughness,
      clearcoat: MATERIAL_CLEARCOAT,
      clearcoatRoughness: MATERIAL_CLEARCOAT_ROUGHNESS,
    });
    // Beveled tile (spec AC-14): the instance matrix still scales this unit tile to
    // `tileSize × tileSize × MINI_CUBE_THICKNESS`, so the pop math is geometry-agnostic.
    const mesh = new InstancedMesh(
      new RoundedBoxGeometry(1, 1, 1, MINI_CUBE_BEVEL_SEGMENTS, MINI_CUBE_BEVEL_RADIUS),
      tileMaterial,
      instanceCount,
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
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

    records.set(faceId, { basis, positions, mesh, tileMaterial, pops: new Map() });
    faces.set(faceId, mesh);
    hiddenIndices.set(faceId, new Set());
    group.add(mesh);
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

  /** Writes the scalar brightness (r = g = b) into one instance's colour slot. */
  function writePopColor(record: FaceRecord, index: number, brightness: number): void {
    const color = record.mesh.instanceColor;
    if (color === null) {
      return;
    }
    color.setXYZ(index, brightness, brightness, brightness);
    color.needsUpdate = true;
  }

  function hideMiniCube(id: MiniCubeId, instant = false): void {
    const { faceId, index } = parseMiniCubeId(id, gridSize);
    const hidden = hiddenIndices.get(faceId)!;
    if (hidden.has(index)) {
      // Already hidden: a repeated intent never restarts the destroy.
      return;
    }
    hidden.add(index);
    const record = records.get(faceId)!;
    if (removedFaces.has(faceId)) {
      // The face's mesh is already detached; the id is only recorded as hidden.
      return;
    }
    if (instant) {
      // Reduced motion / roster hydration: gone now, colour stays at the idle multiplier.
      writePopMatrix(record, index, 0);
      return;
    }
    // AC-4: the hide frame is the destroy's t = 0 (scale 1, brightness 3); `update`
    // advances the record and `MINI_CUBE_POP_MS` later zero-scales it.
    writePopMatrix(record, index, miniCubeDestroyScaleAt(0));
    writePopColor(record, index, miniCubeDestroyBrightnessAt(0));
    record.pops.set(index, 0);
  }

  function isMiniCubeHidden(id: MiniCubeId): boolean {
    const { faceId, index } = parseMiniCubeId(id, gridSize);
    return hiddenIndices.get(faceId)!.has(index);
  }

  function update(dtMs: number): void {
    if (dtMs <= 0) {
      // A paused/zero frame never skips the flash: records advance by positive deltas only.
      return;
    }
    for (const record of records.values()) {
      if (record.pops.size === 0) {
        continue;
      }
      for (const [index, elapsedMs] of record.pops) {
        const next = elapsedMs + dtMs;
        if (next >= MINI_CUBE_POP_MS) {
          writePopMatrix(record, index, 0);
          writePopColor(record, index, 1);
          record.pops.delete(index);
        } else {
          writePopMatrix(record, index, miniCubeDestroyScaleAt(next));
          writePopColor(record, index, miniCubeDestroyBrightnessAt(next));
          record.pops.set(index, next);
        }
      }
    }
  }

  function settlePops(): void {
    for (const record of records.values()) {
      if (record.pops.size === 0) {
        continue;
      }
      for (const index of record.pops.keys()) {
        writePopMatrix(record, index, 0);
        writePopColor(record, index, 1);
      }
      record.pops.clear();
    }
  }

  function removeFace(faceId: FaceId): void {
    if (removedFaces.has(faceId)) {
      return;
    }
    removedFaces.add(faceId);
    const record = records.get(faceId)!;
    // A face detached mid-destroy drops its records with it: no write after disposal.
    record.pops.clear();
    // The mesh leaves the group and its resources are released exactly once. There is no
    // plate and no opacity write: the body behind the removed tiles is the dark interior.
    faces.delete(faceId);
    group.remove(record.mesh);
    disposeResource(record.mesh.geometry);
    disposeResource(record.tileMaterial);
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
    }
  }

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    for (const record of records.values()) {
      record.pops.clear();
    }
    disposeResource(body.geometry);
    disposeResource(bodyMaterial);
    for (const record of records.values()) {
      disposeResource(record.mesh.geometry);
      disposeResource(record.tileMaterial);
    }
    group.clear();
    faces.clear();
  }

  return {
    group,
    body,
    faces,
    hideMiniCube,
    isMiniCubeHidden,
    update,
    settlePops,
    removeFace,
    applyStyle,
    dispose,
  };
}
