import { describe, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Vector3,
  type Material,
} from 'three';

import { MINI_CUBE_POP_PEAK_SCALE } from '../game/effects';
import { CUBE_STYLES } from '../game/progression';
import { FACE_IDS, GRID_SIZE, type FaceId, type MiniCubeId } from '../game/types';
import {
  createCubeView,
  CUBE_HALF_SIZE,
  CUBE_SIZE,
  FACE_NORMALS,
  MINI_CUBE_THICKNESS,
  MINI_CUBE_TILE_RATIO,
  type CubeView,
} from './cube-view';

/**
 * The view is exercised against real three.js objects (the integration tier the spec
 * pins for `render/**`): every assertion below reads the scene graph, an instance matrix,
 * an instance-colour buffer or a material — no mocks except the `dispose` spies that count
 * disposal.
 *
 * Flush tiling (spec AC-2): the instance matrix is a `Float32Array`, so every geometry
 * value is asserted as the exact float32 value three stores (`Math.fround`, the pinned
 * pattern for three.js round-trips). The exact double spacing is `CUBE_SIZE / gridSize`;
 * for `gridSize = 7` the two outermost column pairs of a face land one float32 ulp below
 * `Math.fround(5 / 7)`, which is pinned explicitly below.
 */

const STYLE = CUBE_STYLES[0]!;

/** Flush tile edge for the default grid: `CUBE_SIZE / GRID_SIZE` = 1 (was 0.9 * cell). */
const TILE_SIZE = CUBE_SIZE / GRID_SIZE;

/** The tile edge as stored in the instance matrices (a `Float32Array`). */
const TILE_SIZE_F32 = Math.fround(TILE_SIZE);

/** Distance from the cube centre to a tile centre (`2.5 + 0.125` = 2.625). */
const TILE_DISTANCE = CUBE_HALF_SIZE + MINI_CUBE_THICKNESS / 2;

/**
 * The pinned per-grid layout (spec AC-2). Tile *centres* are unchanged from the
 * predecessor — `front:0:0` sits at `(−(N−1)/2 · 5/N, (N−1)/2 · 5/N, 2.625)` — only the
 * tile extent grew to the whole cell. `columnSteps` is the stored float32 spacing between
 * consecutive column centres (the ideal double spacing is exactly `CUBE_SIZE / gridSize`).
 */
const FLUSH_LAYOUTS: ReadonlyArray<{
  gridSize: number;
  cell: number;
  frontFirst: [number, number, number];
  frontLast: [number, number, number];
  columnSteps: number[];
}> = [
  {
    gridSize: 3,
    cell: 5 / 3,
    frontFirst: [-1.6666666269302368, 1.6666666269302368, TILE_DISTANCE],
    frontLast: [1.6666666269302368, -1.6666666269302368, TILE_DISTANCE],
    columnSteps: [1.6666666269302368, 1.6666666269302368],
  },
  {
    gridSize: 5,
    cell: 1,
    frontFirst: [-2, 2, TILE_DISTANCE],
    frontLast: [2, -2, TILE_DISTANCE],
    columnSteps: [1, 1, 1, 1],
  },
  {
    gridSize: 7,
    cell: 5 / 7,
    frontFirst: [-2.142857074737549, 2.142857074737549, TILE_DISTANCE],
    frontLast: [2.142857074737549, -2.142857074737549, TILE_DISTANCE],
    // The outermost pairs round one ulp below Math.fround(5 / 7) = 0.7142857313156128.
    columnSteps: [
      0.7142856121063232,
      0.7142857313156128,
      0.7142857313156128,
      0.7142857313156128,
      0.7142857313156128,
      0.7142856121063232,
    ],
  },
];

/** Every face's first (row 0, col 0) and last (row N−1, col N−1) centre, for N = 5. */
const PINNED_POSITIONS: ReadonlyArray<{
  faceId: FaceId;
  first: [number, number, number];
  last: [number, number, number];
}> = [
  { faceId: 'front', first: [-2, 2, TILE_DISTANCE], last: [2, -2, TILE_DISTANCE] },
  { faceId: 'back', first: [2, 2, -TILE_DISTANCE], last: [-2, -2, -TILE_DISTANCE] },
  { faceId: 'left', first: [-TILE_DISTANCE, 2, -2], last: [-TILE_DISTANCE, -2, 2] },
  { faceId: 'right', first: [TILE_DISTANCE, 2, 2], last: [TILE_DISTANCE, -2, -2] },
  { faceId: 'top', first: [-2, TILE_DISTANCE, -2], last: [2, TILE_DISTANCE, 2] },
  { faceId: 'bottom', first: [-2, -TILE_DISTANCE, 2], last: [2, -TILE_DISTANCE, -2] },
];

/** The three tile axes per face: screen-right, screen-up and the outward normal. */
const PINNED_AXES: ReadonlyArray<{
  faceId: FaceId;
  right: [number, number, number];
  up: [number, number, number];
  normal: [number, number, number];
}> = [
  { faceId: 'front', right: [1, 0, 0], up: [0, 1, 0], normal: [0, 0, 1] },
  { faceId: 'back', right: [-1, 0, 0], up: [0, 1, 0], normal: [0, 0, -1] },
  { faceId: 'left', right: [0, 0, 1], up: [0, 1, 0], normal: [-1, 0, 0] },
  { faceId: 'right', right: [0, 0, -1], up: [0, 1, 0], normal: [1, 0, 0] },
  { faceId: 'top', right: [1, 0, 0], up: [0, 0, -1], normal: [0, 1, 0] },
  { faceId: 'bottom', right: [1, 0, 0], up: [0, 0, 1], normal: [0, -1, 0] },
];

const FACE_ORDER: readonly FaceId[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];

function instanceMatrix(mesh: InstancedMesh, index: number): Matrix4 {
  const matrix = new Matrix4();
  mesh.getMatrixAt(index, matrix);
  return matrix;
}

function instancePosition(mesh: InstancedMesh, index: number): number[] {
  return new Vector3().setFromMatrixPosition(instanceMatrix(mesh, index)).toArray();
}

/**
 * Instance matrices live in a `Float32Array`, so the reads are the float32 values.
 * Signed zero is normalised (`-0 + 0 === 0`): `-1 * 0` and float32 rounding both
 * produce a `-0` that carries no meaning here.
 */
function instanceAxis(mesh: InstancedMesh, index: number, axis: 0 | 1 | 2): number[] {
  return new Vector3()
    .setFromMatrixColumn(instanceMatrix(mesh, index), axis)
    .toArray()
    .map((value) => value + 0);
}

/** The per-instance colour multiplier stored for one instance. */
function instanceColor(mesh: InstancedMesh, index: number): number[] {
  const color = mesh.instanceColor;
  if (color === null) {
    throw new Error('the face mesh has no instanceColor buffer');
  }
  return [color.getX(index), color.getY(index), color.getZ(index)];
}

function faceMesh(view: CubeView, faceId: FaceId): InstancedMesh {
  const mesh = view.faces.get(faceId);
  if (mesh === undefined) {
    throw new Error(`face ${faceId} is not in the view`);
  }
  return mesh;
}

function tileMaterial(view: CubeView, faceId: FaceId): MeshStandardMaterial {
  return faceMesh(view, faceId).material as MeshStandardMaterial;
}

/** The component of a position along one face axis. */
function along(position: number[], axis: [number, number, number]): number {
  return position[0]! * axis[0] + position[1]! * axis[1] + position[2]! * axis[2];
}

function geometrySpies(view: CubeView): Array<ReturnType<typeof vi.spyOn>> {
  return [view.body.geometry, ...FACE_ORDER.map((faceId) => faceMesh(view, faceId).geometry)].map(
    (geometry) => vi.spyOn(geometry, 'dispose'),
  );
}

function materialSpies(view: CubeView): Array<ReturnType<typeof vi.spyOn>> {
  const materials: Material[] = [
    view.body.material as Material,
    ...FACE_ORDER.map((faceId) => tileMaterial(view, faceId)),
  ];
  return materials.map((material) => vi.spyOn(material, 'dispose'));
}

describe('cube geometry constants', () => {
  it('pins the body and flush tile geometry values', () => {
    expect(CUBE_SIZE).toBe(5);
    expect(CUBE_HALF_SIZE).toBe(2.5);
    expect(MINI_CUBE_THICKNESS).toBe(0.25);
    expect(MINI_CUBE_TILE_RATIO).toBe(1);
    expect(TILE_SIZE).toBe(1);
    expect(TILE_DISTANCE).toBe(2.625);
  });

  it('pins the group-space face normals (spec AC-3)', () => {
    expect([...Object.keys(FACE_NORMALS)]).toEqual(FACE_ORDER);

    for (const { faceId, normal } of PINNED_AXES) {
      expect(FACE_NORMALS[faceId].toArray()).toEqual(normal);
    }
  });
});

describe('createCubeView', () => {
  it('builds exactly one body and six face grids, in order (AC-2: no plates)', () => {
    const view = createCubeView(STYLE);

    expect(view.group).toBeInstanceOf(Group);
    // Body + one InstancedMesh per live face: no plate drawables at all.
    expect(view.group.children).toHaveLength(7);
    expect(view.group.children).toEqual([view.body, ...FACE_ORDER.map((faceId) => faceMesh(view, faceId))]);
    expect(view.group.children.filter((child) => child instanceof InstancedMesh)).toHaveLength(6);

    expect(view.body.geometry).toBeInstanceOf(BoxGeometry);
    expect((view.body.geometry as BoxGeometry).parameters).toEqual({
      width: 5,
      height: 5,
      depth: 5,
      widthSegments: 1,
      heightSegments: 1,
      depthSegments: 1,
    });

    expect([...view.faces.keys()]).toEqual(FACE_ORDER);
    expect(view.faces.size).toBe(6);
    for (const faceId of FACE_IDS) {
      const mesh = faceMesh(view, faceId);
      expect(mesh).toBeInstanceOf(InstancedMesh);
      expect(mesh.count).toBe(25);
      expect(mesh.instanceMatrix.count).toBe(25);
      expect(mesh.geometry).toBeInstanceOf(BoxGeometry);
    }
  });

  it('exposes the plate-free CubeView surface (AC-2)', () => {
    const view = createCubeView(STYLE);

    expect('plateMeshes' in view).toBe(false);
    expect(Object.keys(view).sort()).toEqual([
      'applyStyle',
      'body',
      'dispose',
      'faces',
      'group',
      'hideMiniCube',
      'isMiniCubeHidden',
      'removeFace',
      'settlePops',
      'update',
    ]);
  });

  it('gives every face an all-white instanceColor buffer (spec AC-4)', () => {
    const view = createCubeView(STYLE);

    for (const faceId of FACE_IDS) {
      const mesh = faceMesh(view, faceId);
      const color = mesh.instanceColor;

      expect(color).toBeInstanceOf(InstancedBufferAttribute);
      expect(color!.count).toBe(25);
      expect(color!.itemSize).toBe(3);
      // Every slot starts at the neutral multiplier, so idle tiles render unchanged.
      expect(Array.from(color!.array as Float32Array)).toEqual(new Array(75).fill(1));
      expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);
      expect(instanceColor(mesh, 24)).toEqual([1, 1, 1]);
    }
  });

  it('takes the pinned colours and PBR values from the style (body = dark interior)', () => {
    const view = createCubeView(CUBE_STYLES[0]!);
    const body = view.body.material as MeshStandardMaterial;

    expect(STYLE.id).toBe('obsidian-neon');
    expect(body.color.getHexString()).toBe(STYLE.cubeColor.replace('#', ''));
    expect(body.color.getHexString()).toBe('0b0b12');
    expect(body.metalness).toBe(0.6);
    expect(body.roughness).toBe(0.35);
    expect(tileMaterial(view, 'front').color.getHexString()).toBe('1de9b6');
    expect(tileMaterial(view, 'front').metalness).toBe(0.6);
    expect(tileMaterial(view, 'front').roughness).toBe(0.35);
    // Every face carries its own tile material, all in the style's mini-cube colour.
    for (const faceId of FACE_IDS) {
      expect(tileMaterial(view, faceId).color.getHexString()).toBe('1de9b6');
    }
  });

  it('rejects a grid size that is not a positive integer', () => {
    expect(() => createCubeView(STYLE, 0)).toThrow(
      RangeError('gridSize must be a positive integer, received 0'),
    );
    expect(() => createCubeView(STYLE, -3)).toThrow(
      RangeError('gridSize must be a positive integer, received -3'),
    );
    expect(() => createCubeView(STYLE, 2.5)).toThrow(
      RangeError('gridSize must be a positive integer, received 2.5'),
    );
  });

  it('scales the grid to the requested grid size', () => {
    const three = createCubeView(STYLE, 3);

    expect(three.faces.size).toBe(6);
    for (const faceId of FACE_IDS) {
      expect(faceMesh(three, faceId).count).toBe(9);
      expect(faceMesh(three, faceId).instanceColor!.count).toBe(9);
    }
    // cell = 5 / 3; first instance (row 0, col 0) and last (row 2, col 2) on the front.
    expect(instancePosition(faceMesh(three, 'front'), 0)).toEqual([
      Math.fround(-(5 / 3)),
      Math.fround(5 / 3),
      TILE_DISTANCE,
    ]);
    expect(instancePosition(faceMesh(three, 'front'), 8)).toEqual([
      Math.fround(5 / 3),
      Math.fround(-(5 / 3)),
      TILE_DISTANCE,
    ]);

    const one = createCubeView(STYLE, 1);
    expect(faceMesh(one, 'back').count).toBe(1);
    expect(instancePosition(faceMesh(one, 'back'), 0)).toEqual([0, 0, -TILE_DISTANCE]);
    // A 1 × 1 grid is one flush tile covering the whole face: the whole cube edge.
    expect(instanceAxis(faceMesh(one, 'back'), 0, 0)).toEqual([-CUBE_SIZE, 0, 0]);
    expect(instanceAxis(faceMesh(one, 'back'), 0, 1)).toEqual([0, CUBE_SIZE, 0]);
  });
});

describe('flush tiling (AC-2)', () => {
  it('sizes every tile to exactly one cell on its face axes (N = 3 and N = 7)', () => {
    for (const { gridSize, cell } of FLUSH_LAYOUTS) {
      const view = createCubeView(STYLE, gridSize);

      for (const { faceId, right, up, normal } of PINNED_AXES) {
        const mesh = faceMesh(view, faceId);
        for (const index of [0, Math.floor((gridSize * gridSize) / 2), gridSize * gridSize - 1]) {
          expect(instanceAxis(mesh, index, 0)).toEqual(right.map((value) => Math.fround(value * cell)));
          expect(instanceAxis(mesh, index, 1)).toEqual(up.map((value) => Math.fround(value * cell)));
          expect(instanceAxis(mesh, index, 2)).toEqual(
            normal.map((value) => Math.fround(value * MINI_CUBE_THICKNESS)),
          );
        }
      }
    }
  });

  it('keeps the pinned first/last centres and the exact cell spacing (N = 3, 5, 7)', () => {
    for (const { gridSize, cell, frontFirst, frontLast, columnSteps } of FLUSH_LAYOUTS) {
      const view = createCubeView(STYLE, gridSize);
      const front = faceMesh(view, 'front');

      expect(instancePosition(front, 0)).toEqual(frontFirst);
      expect(instancePosition(front, gridSize * gridSize - 1)).toEqual(frontLast);
      // The centre component is the pinned formula cast to float32.
      expect(frontFirst[0]).toBe(Math.fround(-((gridSize - 1) / 2) * cell));
      expect(frontFirst[1]).toBe(Math.fround(((gridSize - 1) / 2) * cell));

      // Adjacent column centres: `CUBE_SIZE / N` apart (float32 readback).
      const steps: number[] = [];
      for (let col = 0; col < gridSize - 1; col += 1) {
        const left = instancePosition(front, col)[0]!;
        const right = instancePosition(front, col + 1)[0]!;
        steps.push(right - left);
      }
      expect(steps).toEqual(columnSteps);

      // Adjacent row centres: the same spacing, mirrored on the up axis.
      const rowSteps: number[] = [];
      for (let row = 0; row < gridSize - 1; row += 1) {
        const upper = instancePosition(front, row * gridSize)[1]!;
        const lower = instancePosition(front, (row + 1) * gridSize)[1]!;
        rowSteps.push(upper - lower);
      }
      expect(rowSteps).toEqual(columnSteps);
    }
  });

  it('reaches the cube edges with the outermost tiles on every face (N = 3, 5, 7)', () => {
    for (const { gridSize, cell } of FLUSH_LAYOUTS) {
      const view = createCubeView(STYLE, gridSize);
      const tileHalf = Math.fround(cell) / 2;

      for (const { faceId, right, up } of PINNED_AXES) {
        const mesh = faceMesh(view, faceId);
        const first = instancePosition(mesh, 0);
        const last = instancePosition(mesh, gridSize * gridSize - 1);

        // Columns run right; rows run down (the up axis is mirrored for the first/last tile).
        expect(Math.fround(along(last, right) + tileHalf)).toBe(CUBE_HALF_SIZE);
        expect(Math.fround(along(first, right) - tileHalf)).toBe(-CUBE_HALF_SIZE);
        expect(Math.fround(along(first, up) + tileHalf)).toBe(CUBE_HALF_SIZE);
        expect(Math.fround(along(last, up) - tileHalf)).toBe(-CUBE_HALF_SIZE);
      }
    }
  });

  it('lays every face grid on the pinned first and last positions (N = 5)', () => {
    const view = createCubeView(STYLE);

    for (const { faceId, first, last } of PINNED_POSITIONS) {
      expect(instancePosition(faceMesh(view, faceId), 0)).toEqual(first);
      expect(instancePosition(faceMesh(view, faceId), 24)).toEqual(last);
    }

    // Index encoding: row * gridSize + col.
    expect(instancePosition(faceMesh(view, 'front'), 7)).toEqual([0, 1, TILE_DISTANCE]);
    expect(instancePosition(faceMesh(view, 'front'), 12)).toEqual([0, 0, TILE_DISTANCE]);
    expect(instancePosition(faceMesh(view, 'front'), 23)).toEqual([1, -2, TILE_DISTANCE]);
  });

  it('orients each tile on its face with the flush cell extent (N = 5)', () => {
    const view = createCubeView(STYLE);

    for (const { faceId, right, up, normal } of PINNED_AXES) {
      const mesh = faceMesh(view, faceId);
      expect(instanceAxis(mesh, 0, 0)).toEqual(right.map((value) => Math.fround(value * TILE_SIZE)));
      expect(instanceAxis(mesh, 0, 1)).toEqual(up.map((value) => Math.fround(value * TILE_SIZE)));
      expect(instanceAxis(mesh, 0, 2)).toEqual(
        normal.map((value) => Math.fround(value * MINI_CUBE_THICKNESS)),
      );
      // Every instance of a face shares the basis and the scale.
      expect(instanceAxis(mesh, 12, 2)).toEqual(instanceAxis(mesh, 0, 2));
      expect(instanceAxis(mesh, 24, 0)).toEqual(instanceAxis(mesh, 0, 0));
    }
    expect(TILE_SIZE_F32).toBe(1);
  });
});

describe('hideMiniCube', () => {
  it('hides instantly for reduced motion: zero scale, no colour write', () => {
    const view = createCubeView(STYLE);

    view.hideMiniCube('front:0:0', true);

    expect(instancePosition(faceMesh(view, 'front'), 0)).toEqual([-2, 2, TILE_DISTANCE]);
    expect(instanceAxis(faceMesh(view, 'front'), 0, 0)).toEqual([0, 0, 0]);
    expect(instanceAxis(faceMesh(view, 'front'), 0, 1)).toEqual([0, 0, 0]);
    expect(instanceAxis(faceMesh(view, 'front'), 0, 2)).toEqual([0, 0, 0]);
    expect(instanceColor(faceMesh(view, 'front'), 0)).toEqual([1, 1, 1]);
    expect(view.isMiniCubeHidden('front:0:0')).toBe(true);
    expect(faceMesh(view, 'front').count).toBe(25);

    // No record exists, so time cannot resurrect the flashed intermediate state.
    view.update(50);
    expect(instanceAxis(faceMesh(view, 'front'), 0, 0)).toEqual([0, 0, 0]);
    expect(instanceColor(faceMesh(view, 'front'), 0)).toEqual([1, 1, 1]);
  });

  it('plays the pinned pop timeline on the flush tile (N = 5)', () => {
    const view = createCubeView(STYLE);
    const mesh = faceMesh(view, 'front');

    view.hideMiniCube('front:0:0');

    // t = 0: the pop starts at the tile's own (flush) size — nothing has changed yet.
    expect(instanceAxis(mesh, 0, 0)).toEqual([Math.fround(TILE_SIZE), 0, 0]);
    expect(instanceAxis(mesh, 0, 2)).toEqual([0, 0, Math.fround(MINI_CUBE_THICKNESS)]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);
    expect(instancePosition(mesh, 0)).toEqual([-2, 2, TILE_DISTANCE]);

    // t = 50: expand, factor 1.05, colour 1.15.
    view.update(50);
    expect(instanceAxis(mesh, 0, 0)).toEqual([Math.fround(TILE_SIZE * 1.05), 0, 0]);
    expect(instanceAxis(mesh, 0, 2)).toEqual([0, 0, Math.fround(MINI_CUBE_THICKNESS * 1.05)]);
    expect(instanceColor(mesh, 0)).toEqual([Math.fround(1.15), Math.fround(1.15), Math.fround(1.15)]);
    expect(instancePosition(mesh, 0)).toEqual([-2, 2, TILE_DISTANCE]);

    // t = 100: the peak — factor 1.1, colour 1.3.
    view.update(50);
    expect(instanceAxis(mesh, 0, 0)).toEqual([Math.fround(TILE_SIZE * 1.1), 0, 0]);
    expect(instanceColor(mesh, 0)).toEqual([Math.fround(1.3), Math.fround(1.3), Math.fround(1.3)]);

    // t = 130: shrink, factor 0.55, colour 1.15.
    view.update(30);
    expect(instanceAxis(mesh, 0, 0)).toEqual([Math.fround(TILE_SIZE * 0.55), 0, 0]);
    expect(instanceColor(mesh, 0)).toEqual([Math.fround(1.15), Math.fround(1.15), Math.fround(1.15)]);

    // t = 160: the hidden end state — zero scale, colour back to 1.
    view.update(30);
    expect(instanceAxis(mesh, 0, 0)).toEqual([0, 0, 0]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);
    expect(instancePosition(mesh, 0)).toEqual([-2, 2, TILE_DISTANCE]);

    // Settled: the record is gone, so later frames keep the end state.
    view.update(30);
    expect(instanceAxis(mesh, 0, 0)).toEqual([0, 0, 0]);
    expect(view.isMiniCubeHidden('front:0:0')).toBe(true);
  });

  it('scales the pop from the flush cell of a larger grid (N = 7)', () => {
    const view = createCubeView(STYLE, 7);
    const mesh = faceMesh(view, 'front');
    const cell = CUBE_SIZE / 7;

    view.hideMiniCube('front:3:3');
    view.update(100);

    // Peak: every face-axis extent is exactly `Math.fround((CUBE_SIZE / N) · factor)`.
    expect(instanceAxis(mesh, 24, 0)).toEqual([Math.fround(cell * MINI_CUBE_POP_PEAK_SCALE), 0, 0]);
    expect(instanceAxis(mesh, 24, 1)).toEqual([0, Math.fround(cell * MINI_CUBE_POP_PEAK_SCALE), 0]);
    expect(instanceAxis(mesh, 24, 2)).toEqual([
      0,
      0,
      Math.fround(MINI_CUBE_THICKNESS * MINI_CUBE_POP_PEAK_SCALE),
    ]);
    // The centre is unchanged by the pop.
    expect(instancePosition(mesh, 24)).toEqual([0, 0, TILE_DISTANCE]);
  });

  it('never restarts a running pop when the same id is hidden again', () => {
    const view = createCubeView(STYLE);
    const mesh = faceMesh(view, 'front');

    view.hideMiniCube('front:0:0');
    view.update(50);
    expect(instanceAxis(mesh, 0, 0)).toEqual([Math.fround(TILE_SIZE * 1.05), 0, 0]);

    view.hideMiniCube('front:0:0');
    view.update(0);

    // Still at t = 50: a restart would have brought the factor back to 1.
    expect(instanceAxis(mesh, 0, 0)).toEqual([Math.fround(TILE_SIZE * 1.05), 0, 0]);
    expect(instanceColor(mesh, 0)[0]).toBe(Math.fround(1.15));
    expect(view.isMiniCubeHidden('front:0:0')).toBe(true);
  });

  it('runs independent records 60 ms apart, side by side', () => {
    const view = createCubeView(STYLE);
    const mesh = faceMesh(view, 'front');

    view.hideMiniCube('front:0:0');
    view.update(60);
    view.hideMiniCube('front:0:1');
    view.update(40);

    // The first record is at t = 100 (peak); the second trails it by exactly 60 ms.
    expect(instanceAxis(mesh, 0, 0)).toEqual([Math.fround(TILE_SIZE * 1.1), 0, 0]);
    expect(instanceColor(mesh, 0)[0]).toBe(Math.fround(1.3));

    view.update(60);

    // First record settled at t = 160 while the second reaches the pinned t = 100 peak.
    expect(instanceAxis(mesh, 0, 0)).toEqual([0, 0, 0]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);
    expect(instanceAxis(mesh, 1, 0)).toEqual([
      Math.fround(TILE_SIZE * MINI_CUBE_POP_PEAK_SCALE),
      0,
      0,
    ]);
    expect(instanceColor(mesh, 1)[0]).toBe(Math.fround(1.3));
  });

  it('leaves every other instance and face untouched', () => {
    const view = createCubeView(STYLE);

    view.hideMiniCube('top:1:1');
    view.update(100);

    // top index 6 = row 1, col 1 → (0, 2.625, 0) + right * -1 + down * -1.
    expect(instancePosition(faceMesh(view, 'top'), 6)).toEqual([-1, TILE_DISTANCE, -1]);
    expect(instanceAxis(faceMesh(view, 'top'), 6, 0)).toEqual([
      Math.fround(TILE_SIZE * 1.1),
      0,
      0,
    ]);
    expect(instanceAxis(faceMesh(view, 'top'), 7, 0)).toEqual([Math.fround(TILE_SIZE), 0, 0]);
    expect(instanceColor(faceMesh(view, 'top'), 7)).toEqual([1, 1, 1]);
    expect(instanceAxis(faceMesh(view, 'front'), 6, 0)).toEqual([Math.fround(TILE_SIZE), 0, 0]);
    expect(view.isMiniCubeHidden('top:1:2')).toBe(false);
    expect(view.isMiniCubeHidden('front:0:1')).toBe(false);
  });

  it('rejects malformed and off-grid ids', () => {
    const view = createCubeView(STYLE);

    expect(() => view.hideMiniCube('side:0:0' as MiniCubeId)).toThrow(
      Error('invalid mini-cube id "side:0:0"'),
    );
    expect(() => view.hideMiniCube('front' as MiniCubeId)).toThrow(
      Error('invalid mini-cube id "front"'),
    );
    expect(() => view.hideMiniCube('front:0' as MiniCubeId)).toThrow(
      Error('invalid mini-cube id "front:0"'),
    );
    expect(() => view.hideMiniCube('front:0:0:0' as MiniCubeId)).toThrow(
      Error('invalid mini-cube id "front:0:0:0"'),
    );
    expect(() => view.hideMiniCube('front:one:0' as MiniCubeId)).toThrow(
      Error('invalid mini-cube id "front:one:0"'),
    );
    expect(() => view.hideMiniCube('front:0:two' as MiniCubeId)).toThrow(
      Error('invalid mini-cube id "front:0:two"'),
    );
    expect(() => view.hideMiniCube('front:5:0' as MiniCubeId)).toThrow(
      RangeError('mini-cube "front:5:0" is outside the 5x5 grid'),
    );
    expect(() => view.hideMiniCube('front:-1:0' as MiniCubeId)).toThrow(
      RangeError('mini-cube "front:-1:0" is outside the 5x5 grid'),
    );
    expect(() => view.hideMiniCube('front:0:-1' as MiniCubeId)).toThrow(
      RangeError('mini-cube "front:0:-1" is outside the 5x5 grid'),
    );
    expect(() => view.hideMiniCube('front:0:5' as MiniCubeId)).toThrow(
      RangeError('mini-cube "front:0:5" is outside the 5x5 grid'),
    );
    expect(() => view.isMiniCubeHidden('front:5:5' as MiniCubeId)).toThrow(
      RangeError('mini-cube "front:5:5" is outside the 5x5 grid'),
    );
    expect(() => view.isMiniCubeHidden('nope:0:0' as MiniCubeId)).toThrow(
      Error('invalid mini-cube id "nope:0:0"'),
    );

    // A larger grid accepts ids the default grid rejects.
    const seven = createCubeView(STYLE, 7);
    seven.hideMiniCube('front:6:6');
    expect(seven.isMiniCubeHidden('front:6:6')).toBe(true);
    expect(() => seven.hideMiniCube('front:7:0' as MiniCubeId)).toThrow(
      RangeError('mini-cube "front:7:0" is outside the 7x7 grid'),
    );
  });

  it('records the id as hidden even after its face was removed', () => {
    const view = createCubeView(STYLE);

    view.removeFace('left');
    view.hideMiniCube('left:0:0');

    expect(view.isMiniCubeHidden('left:0:0')).toBe(true);
    expect(view.isMiniCubeHidden('left:1:1')).toBe(false);
    expect(view.faces.has('left')).toBe(false);

    // No mesh is left to animate: the frame update is a silent no-op.
    view.update(100);
    expect(view.isMiniCubeHidden('left:0:0')).toBe(true);
  });
});

describe('settlePops', () => {
  it('zero-scales every running pop at once and clears the records', () => {
    const view = createCubeView(STYLE);
    const front = faceMesh(view, 'front');
    const back = faceMesh(view, 'back');

    view.hideMiniCube('front:0:0');
    view.hideMiniCube('back:4:4');
    view.update(50);
    expect(instanceAxis(front, 0, 0)).toEqual([Math.fround(TILE_SIZE * 1.05), 0, 0]);
    expect(instanceAxis(back, 24, 0)).toEqual([-Math.fround(TILE_SIZE * 1.05), 0, 0]);

    view.settlePops();

    expect(instanceAxis(front, 0, 0)).toEqual([0, 0, 0]);
    expect(instanceAxis(back, 24, 0)).toEqual([0, 0, 0]);
    expect(instanceColor(front, 0)).toEqual([1, 1, 1]);
    expect(instanceColor(back, 24)).toEqual([1, 1, 1]);
    expect(instancePosition(front, 0)).toEqual([-2, 2, TILE_DISTANCE]);

    // The records are empty: no further writes can happen.
    const frontWrites = vi.spyOn(front, 'setMatrixAt');
    const backWrites = vi.spyOn(back, 'setMatrixAt');
    view.update(50);
    expect(frontWrites).toHaveBeenCalledTimes(0);
    expect(backWrites).toHaveBeenCalledTimes(0);
    expect(instanceAxis(front, 0, 0)).toEqual([0, 0, 0]);
  });

  it('is a no-op when no pop is running', () => {
    const view = createCubeView(STYLE);
    const front = faceMesh(view, 'front');
    const writes = vi.spyOn(front, 'setMatrixAt');

    view.settlePops();

    expect(writes).toHaveBeenCalledTimes(0);
    expect(instanceAxis(front, 0, 0)).toEqual([Math.fround(TILE_SIZE), 0, 0]);
  });
});

describe('removeFace', () => {
  it('detaches the face and disposes its geometry and material exactly once (no plate)', () => {
    const view = createCubeView(STYLE);
    const mesh = faceMesh(view, 'front');
    const material = tileMaterial(view, 'front');
    const meshGeometrySpy = vi.spyOn(mesh.geometry, 'dispose');
    const meshMaterialSpy = vi.spyOn(material, 'dispose');
    const backMesh = faceMesh(view, 'back');
    const backGeometrySpy = vi.spyOn(backMesh.geometry, 'dispose');
    const backMaterialSpy = vi.spyOn(backMesh.material as Material, 'dispose');

    view.removeFace('front');

    expect(view.faces.has('front')).toBe(false);
    expect(view.faces.size).toBe(5);
    expect([...view.faces.keys()]).toEqual(['back', 'left', 'right', 'top', 'bottom']);
    // Body + the five surviving grids: nothing plate-like was ever there.
    expect(view.group.children).toHaveLength(6);
    expect(view.group.children).toEqual([view.body, ...(['back', 'left', 'right', 'top', 'bottom'] as FaceId[]).map((faceId) => faceMesh(view, faceId))]);
    expect(meshGeometrySpy).toHaveBeenCalledTimes(1);
    expect(meshMaterialSpy).toHaveBeenCalledTimes(1);
    expect(view.faces.get('back')).toBe(backMesh);
    expect(backGeometrySpy).toHaveBeenCalledTimes(0);
    expect(backMaterialSpy).toHaveBeenCalledTimes(0);
  });

  it('is a no-op when the face is already removed', () => {
    const view = createCubeView(STYLE);
    const mesh = faceMesh(view, 'right');
    const geometrySpy = vi.spyOn(mesh.geometry, 'dispose');
    const materialSpy = vi.spyOn(mesh.material as Material, 'dispose');

    view.removeFace('right');
    view.removeFace('right');

    expect(geometrySpy).toHaveBeenCalledTimes(1);
    expect(materialSpy).toHaveBeenCalledTimes(1);
    expect(view.faces.size).toBe(5);
    expect(view.group.children).toHaveLength(6);
  });

  it('cancels that face’s pop records and keeps the others running', () => {
    const view = createCubeView(STYLE);
    const front = faceMesh(view, 'front');
    const back = faceMesh(view, 'back');

    view.hideMiniCube('front:0:0');
    view.hideMiniCube('back:0:0');
    view.update(50);
    expect(instanceAxis(front, 0, 0)).toEqual([Math.fround(TILE_SIZE * 1.05), 0, 0]);

    view.removeFace('front');
    const frontWrites = vi.spyOn(front, 'setMatrixAt');
    view.update(50);

    expect(frontWrites).toHaveBeenCalledTimes(0);
    // The back face's pop continues: it reaches the pinned t = 100 peak.
    expect(instanceAxis(back, 0, 0)).toEqual([-Math.fround(TILE_SIZE * 1.1), 0, 0]);
    expect(instanceColor(back, 0)[0]).toBe(Math.fround(1.3));
  });

  it('leaves the remaining faces operable', () => {
    const view = createCubeView(STYLE);

    view.removeFace('front');
    view.hideMiniCube('back:0:0', true);

    expect(instancePosition(faceMesh(view, 'back'), 0)).toEqual([2, 2, -TILE_DISTANCE]);
    expect(instanceAxis(faceMesh(view, 'back'), 0, 0)).toEqual([0, 0, 0]);
    expect(view.isMiniCubeHidden('back:0:0')).toBe(true);
  });
});

describe('applyStyle', () => {
  it('re-colours the body and the live tiles in place without touching instance colours', () => {
    const view = createCubeView(CUBE_STYLES[0]!);
    const mesh = faceMesh(view, 'front');
    const body = view.body.material as MeshStandardMaterial;

    view.hideMiniCube('front:0:0');
    view.update(100);
    expect(instanceColor(mesh, 0)).toEqual([Math.fround(1.3), Math.fround(1.3), Math.fround(1.3)]);

    view.applyStyle(CUBE_STYLES[3]!);

    expect(CUBE_STYLES[3]!.id).toBe('solar-gold');
    expect(body.color.getHexString()).toBe('2a1a05');
    expect(body.metalness).toBe(0.9);
    expect(body.roughness).toBe(0.25);
    expect(tileMaterial(view, 'front').color.getHexString()).toBe('ffcc66');
    expect(tileMaterial(view, 'front').metalness).toBe(0.9);
    expect(tileMaterial(view, 'front').roughness).toBe(0.25);
    expect(tileMaterial(view, 'top').color.getHexString()).toBe('ffcc66');
    // The per-instance buffers are untouched: the running flash survives, idle slots stay 1.
    expect(instanceColor(mesh, 0)).toEqual([Math.fround(1.3), Math.fround(1.3), Math.fround(1.3)]);
    expect(instanceColor(mesh, 1)).toEqual([1, 1, 1]);
    // In place: same mesh, same instance count, nothing rebuilt.
    expect(faceMesh(view, 'front')).toBe(mesh);
    expect(mesh.count).toBe(25);
    expect(view.group.children).toHaveLength(7);
  });

  it('leaves a removed face untouched', () => {
    const view = createCubeView(CUBE_STYLES[0]!);
    const frontMaterial = tileMaterial(view, 'front');

    view.removeFace('front');
    view.applyStyle(CUBE_STYLES[1]!);

    // The disposed material keeps the palette it had when it left the scene.
    expect(frontMaterial.color.getHexString()).toBe('1de9b6');
    expect(frontMaterial.metalness).toBe(0.6);
    expect(tileMaterial(view, 'back').color.getHexString()).toBe('ff4d6d');
    expect((view.body.material as MeshStandardMaterial).color.getHexString()).toBe('1a0b0e');
  });
});

describe('dispose', () => {
  it('disposes every geometry and material exactly once and empties the group', () => {
    const view = createCubeView(STYLE);
    const geometryDisposers = geometrySpies(view);
    const materialDisposers = materialSpies(view);

    expect(geometryDisposers).toHaveLength(7);
    expect(materialDisposers).toHaveLength(7);

    view.dispose();

    for (const spy of geometryDisposers) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
    for (const spy of materialDisposers) {
      expect(spy).toHaveBeenCalledTimes(1);
    }

    view.dispose();

    for (const spy of geometryDisposers) {
      expect(spy).toHaveBeenCalledTimes(1);
    }
    for (const spy of materialDisposers) {
      expect(spy).toHaveBeenCalledTimes(1);
    }

    expect(view.group.children).toHaveLength(0);
    expect(view.faces.size).toBe(0);
  });

  it('clears running pop records', () => {
    const view = createCubeView(STYLE);
    const mesh = faceMesh(view, 'front');
    view.hideMiniCube('front:0:0');
    view.update(50);

    view.dispose();
    const writes = vi.spyOn(mesh, 'setMatrixAt');

    view.update(50);

    expect(writes).toHaveBeenCalledTimes(0);
    expect(instanceAxis(mesh, 0, 0)).toEqual([Math.fround(TILE_SIZE * 1.05), 0, 0]);
  });

  it('does not dispose a removed face twice', () => {
    const view = createCubeView(STYLE);
    const mesh = faceMesh(view, 'left');
    const meshGeometrySpy = vi.spyOn(mesh.geometry, 'dispose');
    const meshMaterialSpy = vi.spyOn(mesh.material as Material, 'dispose');

    view.removeFace('left');
    view.dispose();

    expect(meshGeometrySpy).toHaveBeenCalledTimes(1);
    expect(meshMaterialSpy).toHaveBeenCalledTimes(1);
  });
});
