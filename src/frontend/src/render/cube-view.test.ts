import { describe, expect, it, vi } from 'vitest';
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
  PLATE_OFFSET,
  type CubeView,
} from './cube-view';

/**
 * The view is exercised against real three.js objects (the integration tier the spec
 * pins for `render/**`): every assertion below reads the scene graph, an instance matrix,
 * an instance-colour buffer or a material — no mocks except the `dispose` spies that count
 * disposal.
 */

const STYLE = CUBE_STYLES[0]!;

/** Tile edge for the default grid: `CUBE_SIZE / GRID_SIZE * MINI_CUBE_TILE_RATIO` = 0.9. */
const TILE_SIZE = (CUBE_SIZE / GRID_SIZE) * MINI_CUBE_TILE_RATIO;

/** The tile edge as stored in the instance matrices (a `Float32Array`). */
const TILE_SIZE_F32 = Math.fround(TILE_SIZE);

/** Distance from the cube centre to a tile centre (`2.5 + 0.125` = 2.625). */
const TILE_DISTANCE = CUBE_HALF_SIZE + MINI_CUBE_THICKNESS / 2;

/** Distance from the cube centre to a plate (`2.5 + 0.0625` = 2.5625). */
const PLATE_DISTANCE = CUBE_HALF_SIZE + PLATE_OFFSET;

/** Every face's first (row 0, col 0) and last (row 4, col 4) instance centre. */
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

/** The three scale factors of one instance: the length of each basis column. */
function instanceScale(mesh: InstancedMesh, index: number): number[] {
  const matrix = instanceMatrix(mesh, index);
  return [0, 1, 2].map((axis) => new Vector3().setFromMatrixColumn(matrix, axis).length());
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

function facePlate(view: CubeView, faceId: FaceId): Mesh {
  const plate = view.plateMeshes.get(faceId);
  if (plate === undefined) {
    throw new Error(`plate ${faceId} is not in the view`);
  }
  return plate;
}

function tileMaterial(view: CubeView, faceId: FaceId): MeshStandardMaterial {
  return faceMesh(view, faceId).material as MeshStandardMaterial;
}

function plateMaterial(view: CubeView, faceId: FaceId): MeshStandardMaterial {
  return facePlate(view, faceId).material as MeshStandardMaterial;
}

function geometrySpies(view: CubeView): Array<ReturnType<typeof vi.spyOn>> {
  return [
    view.body.geometry,
    ...FACE_ORDER.map((faceId) => faceMesh(view, faceId).geometry),
    ...FACE_ORDER.map((faceId) => facePlate(view, faceId).geometry),
  ].map((geometry) => vi.spyOn(geometry, 'dispose'));
}

function materialSpies(view: CubeView): Array<ReturnType<typeof vi.spyOn>> {
  const materials: Material[] = [
    view.body.material as Material,
    ...FACE_ORDER.map((faceId) => tileMaterial(view, faceId)),
    ...FACE_ORDER.map((faceId) => plateMaterial(view, faceId)),
  ];
  return materials.map((material) => vi.spyOn(material, 'dispose'));
}

describe('cube geometry constants', () => {
  it('pins the body, tile and plate geometry values', () => {
    expect(CUBE_SIZE).toBe(5);
    expect(CUBE_HALF_SIZE).toBe(2.5);
    expect(MINI_CUBE_THICKNESS).toBe(0.25);
    expect(MINI_CUBE_TILE_RATIO).toBe(0.9);
    expect(PLATE_OFFSET).toBe(0.0625);
  });

  it('pins the group-space face normals (spec AC-3)', () => {
    expect([...Object.keys(FACE_NORMALS)]).toEqual(FACE_ORDER);

    for (const { faceId, normal } of PINNED_AXES) {
      expect(FACE_NORMALS[faceId].toArray()).toEqual(normal);
    }
  });
});

describe('createCubeView', () => {
  it('builds exactly one body, six face grids and six plates, in order', () => {
    const view = createCubeView(STYLE);

    expect(view.group).toBeInstanceOf(Group);
    expect(view.group.children).toHaveLength(13);
    expect(view.group.children.filter((child) => child instanceof InstancedMesh)).toHaveLength(6);

    // Exact child order: the body, then each face's grid followed by its plate.
    const expectedChildren = [view.body];
    for (const faceId of FACE_ORDER) {
      expectedChildren.push(faceMesh(view, faceId), facePlate(view, faceId));
    }
    expect(view.group.children).toEqual(expectedChildren);

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
    expect([...view.plateMeshes.keys()]).toEqual(FACE_ORDER);
    expect(view.faces.size).toBe(6);
    expect(view.plateMeshes.size).toBe(6);
    for (const faceId of FACE_IDS) {
      expect(faceMesh(view, faceId).count).toBe(25);
      expect(faceMesh(view, faceId).instanceMatrix.count).toBe(25);
      expect(facePlate(view, faceId).geometry).toBeInstanceOf(PlaneGeometry);
    }
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

  it('takes the pinned colours and PBR values from the style', () => {
    const view = createCubeView(CUBE_STYLES[0]!);
    const body = view.body.material as MeshStandardMaterial;

    expect(STYLE.id).toBe('obsidian-neon');
    expect(body.color.getHexString()).toBe('0b0b12');
    expect(body.metalness).toBe(0.6);
    expect(body.roughness).toBe(0.35);
    expect(tileMaterial(view, 'front').color.getHexString()).toBe('1de9b6');
    expect(tileMaterial(view, 'front').metalness).toBe(0.6);
    expect(tileMaterial(view, 'front').roughness).toBe(0.35);
    expect(plateMaterial(view, 'front').color.getHexString()).toBe('0b0b12');
    expect(plateMaterial(view, 'front').transparent).toBe(true);
    expect(plateMaterial(view, 'front').opacity).toBe(1);
  });

  it('places every plate at the pinned distance, facing outwards', () => {
    const view = createCubeView(STYLE);
    const expected: ReadonlyArray<{ faceId: FaceId; position: [number, number, number] }> = [
      { faceId: 'front', position: [0, 0, PLATE_DISTANCE] },
      { faceId: 'back', position: [0, 0, -PLATE_DISTANCE] },
      { faceId: 'left', position: [-PLATE_DISTANCE, 0, 0] },
      { faceId: 'right', position: [PLATE_DISTANCE, 0, 0] },
      { faceId: 'top', position: [0, PLATE_DISTANCE, 0] },
      { faceId: 'bottom', position: [0, -PLATE_DISTANCE, 0] },
    ];

    for (const { faceId, position } of expected) {
      const plate = facePlate(view, faceId);
      const normal = PINNED_AXES.find((entry) => entry.faceId === faceId)!.normal;
      expect(plate.position.toArray()).toEqual(position);
      expect(
        new Vector3(0, 0, 1).applyQuaternion(plate.quaternion).dot(new Vector3(...normal)),
      ).toBe(1);
    }
    expect(PLATE_DISTANCE).toBe(2.5625);
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
    expect(instanceAxis(faceMesh(three, 'front'), 0, 0)).toEqual([
      Math.fround((5 / 3) * MINI_CUBE_TILE_RATIO),
      0,
      0,
    ]);

    const one = createCubeView(STYLE, 1);
    expect(faceMesh(one, 'back').count).toBe(1);
    expect(instancePosition(faceMesh(one, 'back'), 0)).toEqual([0, 0, -TILE_DISTANCE]);
    expect(instanceAxis(faceMesh(one, 'back'), 0, 0)).toEqual([-4.5, 0, 0]);
  });
});

describe('instance matrices', () => {
  it('lays every face grid on the pinned first and last positions', () => {
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

  it('sizes every instance to the tile and orients it on its face', () => {
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
    expect(TILE_SIZE).toBe(0.9);
    expect(TILE_SIZE_F32).toBe(0.8999999761581421);
  });
});

describe('hideMiniCube', () => {
  it('hides instantly for reduced motion: zero scale, no colour write', () => {
    const view = createCubeView(STYLE);

    view.hideMiniCube('front:0:0', true);

    expect(instancePosition(faceMesh(view, 'front'), 0)).toEqual([-2, 2, TILE_DISTANCE]);
    expect(instanceScale(faceMesh(view, 'front'), 0)).toEqual([0, 0, 0]);
    expect(instanceColor(faceMesh(view, 'front'), 0)).toEqual([1, 1, 1]);
    expect(view.isMiniCubeHidden('front:0:0')).toBe(true);
    expect(faceMesh(view, 'front').count).toBe(25);

    // No record exists, so time cannot resurrect the flashed intermediate state.
    view.update(50);
    expect(instanceScale(faceMesh(view, 'front'), 0)).toEqual([0, 0, 0]);
    expect(instanceColor(faceMesh(view, 'front'), 0)).toEqual([1, 1, 1]);
  });

  it('plays the pinned pop timeline on the real instance matrix and colour', () => {
    const view = createCubeView(STYLE);
    const mesh = faceMesh(view, 'front');

    view.hideMiniCube('front:0:0');

    // t = 0: the pop starts at the tile's own size — nothing has changed yet.
    expect(instanceScale(mesh, 0)).toEqual([TILE_SIZE_F32, TILE_SIZE_F32, Math.fround(0.25)]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);
    expect(instancePosition(mesh, 0)).toEqual([-2, 2, TILE_DISTANCE]);

    // t = 50: expand, factor 1.05, colour 1.15.
    view.update(50);
    expect(instanceScale(mesh, 0)).toEqual([
      Math.fround(0.9 * 1.05),
      Math.fround(0.9 * 1.05),
      Math.fround(0.25 * 1.05),
    ]);
    expect(instanceColor(mesh, 0)).toEqual([Math.fround(1.15), Math.fround(1.15), Math.fround(1.15)]);
    expect(instancePosition(mesh, 0)).toEqual([-2, 2, TILE_DISTANCE]);

    // t = 100: the peak — factor 1.1, colour 1.3.
    view.update(50);
    expect(instanceScale(mesh, 0)).toEqual([
      Math.fround(0.9 * 1.1),
      Math.fround(0.9 * 1.1),
      Math.fround(0.25 * 1.1),
    ]);
    expect(instanceColor(mesh, 0)).toEqual([Math.fround(1.3), Math.fround(1.3), Math.fround(1.3)]);
    expect(instancePosition(mesh, 0)).toEqual([-2, 2, TILE_DISTANCE]);

    // t = 130: shrink, factor 0.55, colour 1.15.
    view.update(30);
    expect(instanceScale(mesh, 0)).toEqual([
      Math.fround(0.9 * 0.55),
      Math.fround(0.9 * 0.55),
      Math.fround(0.25 * 0.55),
    ]);
    expect(instanceColor(mesh, 0)).toEqual([Math.fround(1.15), Math.fround(1.15), Math.fround(1.15)]);
    expect(instancePosition(mesh, 0)).toEqual([-2, 2, TILE_DISTANCE]);

    // t = 160: the predecessor's hidden end state — zero scale, colour back to 1.
    view.update(30);
    expect(instanceScale(mesh, 0)).toEqual([0, 0, 0]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);
    expect(instancePosition(mesh, 0)).toEqual([-2, 2, TILE_DISTANCE]);

    // Settled: the record is gone, so later frames keep the end state.
    view.update(30);
    expect(instanceScale(mesh, 0)).toEqual([0, 0, 0]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);
    expect(view.isMiniCubeHidden('front:0:0')).toBe(true);
  });

  it('never restarts a running pop when the same id is hidden again', () => {
    const view = createCubeView(STYLE);
    const mesh = faceMesh(view, 'front');

    view.hideMiniCube('front:0:0');
    view.update(50);
    expect(instanceScale(mesh, 0)[0]).toBe(Math.fround(0.9 * 1.05));

    view.hideMiniCube('front:0:0');
    view.update(0);

    // Still at t = 50: a restart would have brought the factor back to 1.
    expect(instanceScale(mesh, 0)[0]).toBe(Math.fround(0.9 * 1.05));
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
    expect(instanceScale(mesh, 0)[0]).toBe(Math.fround(0.9 * 1.1));
    expect(instanceColor(mesh, 0)[0]).toBe(Math.fround(1.3));

    view.update(60);

    // First record settled at t = 160 while the second reaches the pinned t = 100 peak.
    expect(instanceScale(mesh, 0)).toEqual([0, 0, 0]);
    expect(instanceColor(mesh, 0)).toEqual([1, 1, 1]);
    expect(instanceScale(mesh, 1)[0]).toBe(Math.fround(0.9 * MINI_CUBE_POP_PEAK_SCALE));
    expect(instanceColor(mesh, 1)[0]).toBe(Math.fround(1.3));
  });

  it('leaves every other instance and face untouched', () => {
    const view = createCubeView(STYLE);

    view.hideMiniCube('top:1:1');
    view.update(100);

    // top index 6 = row 1, col 1 → (0, 2.625, 0) + right * -1 + down * -1.
    expect(instancePosition(faceMesh(view, 'top'), 6)).toEqual([-1, TILE_DISTANCE, -1]);
    expect(instanceScale(faceMesh(view, 'top'), 6)).toEqual([
      Math.fround(0.9 * 1.1),
      Math.fround(0.9 * 1.1),
      Math.fround(0.25 * 1.1),
    ]);
    expect(instanceScale(faceMesh(view, 'top'), 7)).toEqual([
      TILE_SIZE_F32,
      TILE_SIZE_F32,
      Math.fround(0.25),
    ]);
    expect(instanceColor(faceMesh(view, 'top'), 7)).toEqual([1, 1, 1]);
    expect(instanceScale(faceMesh(view, 'front'), 6)).toEqual([
      TILE_SIZE_F32,
      TILE_SIZE_F32,
      Math.fround(0.25),
    ]);
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
    expect(instanceScale(front, 0)[0]).toBe(Math.fround(0.9 * 1.05));
    expect(instanceScale(back, 24)[0]).toBe(Math.fround(0.9 * 1.05));

    view.settlePops();

    expect(instanceScale(front, 0)).toEqual([0, 0, 0]);
    expect(instanceScale(back, 24)).toEqual([0, 0, 0]);
    expect(instanceColor(front, 0)).toEqual([1, 1, 1]);
    expect(instanceColor(back, 24)).toEqual([1, 1, 1]);
    expect(instancePosition(front, 0)).toEqual([-2, 2, TILE_DISTANCE]);

    // The records are empty: no further writes can happen.
    const frontWrites = vi.spyOn(front, 'setMatrixAt');
    const backWrites = vi.spyOn(back, 'setMatrixAt');
    view.update(50);
    expect(frontWrites).toHaveBeenCalledTimes(0);
    expect(backWrites).toHaveBeenCalledTimes(0);
    expect(instanceScale(front, 0)).toEqual([0, 0, 0]);
  });

  it('is a no-op when no pop is running', () => {
    const view = createCubeView(STYLE);
    const front = faceMesh(view, 'front');
    const writes = vi.spyOn(front, 'setMatrixAt');

    view.settlePops();

    expect(writes).toHaveBeenCalledTimes(0);
    expect(instanceScale(front, 0)).toEqual([TILE_SIZE_F32, TILE_SIZE_F32, Math.fround(0.25)]);
  });
});

describe('removeFace', () => {
  it('detaches the face, zeroes its plate opacity and disposes its resources once', () => {
    const view = createCubeView(STYLE);
    const mesh = faceMesh(view, 'front');
    const plate = facePlate(view, 'front');
    const plateMat = plateMaterial(view, 'front');
    const meshGeometrySpy = vi.spyOn(mesh.geometry, 'dispose');
    const meshMaterialSpy = vi.spyOn(mesh.material as Material, 'dispose');
    const plateGeometrySpy = vi.spyOn(plate.geometry, 'dispose');
    const plateMaterialSpy = vi.spyOn(plateMat, 'dispose');
    const backMesh = faceMesh(view, 'back');
    const backGeometrySpy = vi.spyOn(backMesh.geometry, 'dispose');
    const backMaterialSpy = vi.spyOn(backMesh.material as Material, 'dispose');

    view.removeFace('front');

    expect(plateMat.opacity).toBe(0);
    expect(plate.visible).toBe(false);
    expect(view.faces.has('front')).toBe(false);
    expect(view.plateMeshes.has('front')).toBe(false);
    expect(view.faces.size).toBe(5);
    expect(view.plateMeshes.size).toBe(5);
    expect([...view.faces.keys()]).toEqual(['back', 'left', 'right', 'top', 'bottom']);
    expect(view.group.children).toHaveLength(11);
    expect(meshGeometrySpy).toHaveBeenCalledTimes(1);
    expect(meshMaterialSpy).toHaveBeenCalledTimes(1);
    expect(plateGeometrySpy).toHaveBeenCalledTimes(1);
    expect(plateMaterialSpy).toHaveBeenCalledTimes(1);
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
    expect(view.group.children).toHaveLength(11);
  });

  it('cancels that face’s pop records and keeps the others running', () => {
    const view = createCubeView(STYLE);
    const front = faceMesh(view, 'front');
    const back = faceMesh(view, 'back');

    view.hideMiniCube('front:0:0');
    view.hideMiniCube('back:0:0');
    view.update(50);
    expect(instanceScale(front, 0)[0]).toBe(Math.fround(0.9 * 1.05));

    view.removeFace('front');
    const frontWrites = vi.spyOn(front, 'setMatrixAt');
    view.update(50);

    expect(frontWrites).toHaveBeenCalledTimes(0);
    // The back face's pop continues: it reaches the pinned t = 100 peak.
    expect(instanceScale(back, 0)[0]).toBe(Math.fround(0.9 * 1.1));
    expect(instanceColor(back, 0)[0]).toBe(Math.fround(1.3));
  });

  it('leaves the remaining faces operable', () => {
    const view = createCubeView(STYLE);

    view.removeFace('front');
    view.hideMiniCube('back:0:0', true);

    expect(instancePosition(faceMesh(view, 'back'), 0)).toEqual([2, 2, -TILE_DISTANCE]);
    expect(instanceScale(faceMesh(view, 'back'), 0)).toEqual([0, 0, 0]);
    expect(view.isMiniCubeHidden('back:0:0')).toBe(true);
  });
});

describe('applyStyle', () => {
  it('re-colours the existing materials in place without touching instance colours', () => {
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
    expect(plateMaterial(view, 'top').color.getHexString()).toBe('2a1a05');
    // The per-instance buffers are untouched: the running flash survives, idle slots stay 1.
    expect(instanceColor(mesh, 0)).toEqual([Math.fround(1.3), Math.fround(1.3), Math.fround(1.3)]);
    expect(instanceColor(mesh, 1)).toEqual([1, 1, 1]);
    // In place: same mesh, same instance count, nothing rebuilt.
    expect(faceMesh(view, 'front')).toBe(mesh);
    expect(mesh.count).toBe(25);
    expect(view.group.children).toHaveLength(13);
  });

  it('leaves a removed face untouched and keeps a plate fade in progress', () => {
    const view = createCubeView(CUBE_STYLES[0]!);
    const frontMaterial = tileMaterial(view, 'front');
    const frontPlateMaterial = plateMaterial(view, 'front');
    const topPlateMaterial = plateMaterial(view, 'top');
    topPlateMaterial.opacity = 0.5;

    view.removeFace('front');
    view.applyStyle(CUBE_STYLES[1]!);

    expect(frontMaterial.color.getHexString()).toBe('1de9b6');
    expect(frontMaterial.metalness).toBe(0.6);
    expect(frontPlateMaterial.color.getHexString()).toBe('0b0b12');
    expect(frontPlateMaterial.opacity).toBe(0);
    expect(topPlateMaterial.color.getHexString()).toBe('1a0b0e');
    expect(topPlateMaterial.opacity).toBe(0.5);
    expect(tileMaterial(view, 'back').color.getHexString()).toBe('ff4d6d');
    expect((view.body.material as MeshStandardMaterial).color.getHexString()).toBe('1a0b0e');
  });
});

describe('dispose', () => {
  it('disposes every geometry and material exactly once and empties the group', () => {
    const view = createCubeView(STYLE);
    const geometryDisposers = geometrySpies(view);
    const materialDisposers = materialSpies(view);

    expect(geometryDisposers).toHaveLength(13);
    expect(materialDisposers).toHaveLength(13);

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
    expect(view.plateMeshes.size).toBe(0);
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
    expect(instanceScale(mesh, 0)[0]).toBe(Math.fround(0.9 * 1.05));
  });

  it('does not dispose a removed face twice', () => {
    const view = createCubeView(STYLE);
    const mesh = faceMesh(view, 'left');
    const plate = facePlate(view, 'left');
    const meshGeometrySpy = vi.spyOn(mesh.geometry, 'dispose');
    const meshMaterialSpy = vi.spyOn(mesh.material as Material, 'dispose');
    const plateGeometrySpy = vi.spyOn(plate.geometry, 'dispose');
    const plateMaterialSpy = vi.spyOn(plate.material as Material, 'dispose');

    view.removeFace('left');
    view.dispose();

    expect(meshGeometrySpy).toHaveBeenCalledTimes(1);
    expect(meshMaterialSpy).toHaveBeenCalledTimes(1);
    expect(plateGeometrySpy).toHaveBeenCalledTimes(1);
    expect(plateMaterialSpy).toHaveBeenCalledTimes(1);
  });
});
