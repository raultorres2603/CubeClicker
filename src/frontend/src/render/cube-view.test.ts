import { describe, expect, it, vi } from 'vitest';
import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  type Material,
} from 'three';

import { CUBE_STYLES } from '../game/progression';
import { FACE_IDS, GRID_SIZE, type FaceId, type MiniCubeId } from '../game/types';
import {
  createCubeView,
  CUBE_HALF_SIZE,
  CUBE_SIZE,
  CURSOR_PADDING,
  CURSOR_THICKNESS_FACTOR,
  MINI_CUBE_THICKNESS,
  MINI_CUBE_TILE_RATIO,
  PLATE_OFFSET,
  type CubeView,
} from './cube-view';

/**
 * The view is exercised against real three.js objects (the integration tier the spec
 * pins for `render/**`): every assertion below reads the scene graph or a material —
 * no mocks except the `dispose` spies that count disposal.
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

/** One of the highlight mesh's local axes in group space. */
function highlightAxis(view: CubeView, axis: 0 | 1 | 2): Vector3 {
  return new Vector3()
    .set(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0)
    .applyQuaternion(view.highlight.quaternion);
}

function plateMaterial(view: CubeView, faceId: FaceId): MeshStandardMaterial {
  return facePlate(view, faceId).material as MeshStandardMaterial;
}

function geometrySpies(view: CubeView): Array<ReturnType<typeof vi.spyOn>> {
  return [
    view.body.geometry,
    view.highlight.geometry,
    ...FACE_ORDER.map((faceId) => faceMesh(view, faceId).geometry),
    ...FACE_ORDER.map((faceId) => facePlate(view, faceId).geometry),
  ].map((geometry) => vi.spyOn(geometry, 'dispose'));
}

function materialSpies(view: CubeView): Array<ReturnType<typeof vi.spyOn>> {
  const materials: Material[] = [
    view.body.material as Material,
    view.highlight.material as Material,
    ...FACE_ORDER.map((faceId) => tileMaterial(view, faceId)),
    ...FACE_ORDER.map((faceId) => plateMaterial(view, faceId)),
  ];
  return materials.map((material) => vi.spyOn(material, 'dispose'));
}

describe('cube geometry constants', () => {
  it('pins the body, tile, plate and highlight geometry values', () => {
    expect(CUBE_SIZE).toBe(5);
    expect(CUBE_HALF_SIZE).toBe(2.5);
    expect(MINI_CUBE_THICKNESS).toBe(0.25);
    expect(MINI_CUBE_TILE_RATIO).toBe(0.9);
    expect(PLATE_OFFSET).toBe(0.0625);
    expect(CURSOR_PADDING).toBe(0.0625);
    expect(CURSOR_THICKNESS_FACTOR).toBe(1.5);
  });
});

describe('createCubeView', () => {
  it('builds one body, six face grids, six plates and one hidden highlight', () => {
    const view = createCubeView(STYLE);

    expect(view.group).toBeInstanceOf(Group);
    expect(view.group.children).toHaveLength(14);
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
    expect([...view.plateMeshes.keys()]).toEqual(FACE_ORDER);
    expect(view.faces.size).toBe(6);
    expect(view.plateMeshes.size).toBe(6);
    for (const faceId of FACE_IDS) {
      expect(faceMesh(view, faceId).count).toBe(25);
      expect(faceMesh(view, faceId).instanceMatrix.count).toBe(25);
      expect(facePlate(view, faceId).geometry).toBeInstanceOf(PlaneGeometry);
    }

    expect(view.highlight).toBeInstanceOf(Mesh);
    expect(view.highlight.visible).toBe(false);
  });

  it('takes the pinned colours and PBR values from the style', () => {
    const view = createCubeView(CUBE_STYLES[0]!);
    const body = view.body.material as MeshStandardMaterial;
    const highlight = view.highlight.material as MeshBasicMaterial;

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
    expect(highlight).toBeInstanceOf(MeshBasicMaterial);
    expect(highlight.color.getHexString()).toBe('7cf6ff');
    expect(highlight.transparent).toBe(true);
    expect(highlight.opacity).toBe(0.9);
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
  it('zeroes one instance matrix while keeping its position', () => {
    const view = createCubeView(STYLE);

    view.hideMiniCube('front:0:0');

    expect(instancePosition(faceMesh(view, 'front'), 0)).toEqual([-2, 2, TILE_DISTANCE]);
    expect(instanceAxis(faceMesh(view, 'front'), 0, 0)).toEqual([0, 0, 0]);
    expect(instanceAxis(faceMesh(view, 'front'), 0, 1)).toEqual([0, 0, 0]);
    expect(instanceAxis(faceMesh(view, 'front'), 0, 2)).toEqual([0, 0, 0]);
    expect(faceMesh(view, 'front').count).toBe(25);
    expect(faceMesh(view, 'front').instanceMatrix.count).toBe(25);
    expect(view.isMiniCubeHidden('front:0:0')).toBe(true);
  });

  it('hides exactly the requested id, on its own face, and is idempotent', () => {
    const view = createCubeView(STYLE);

    view.hideMiniCube('top:1:1');
    view.hideMiniCube('top:1:1');

    // top index 6 = row 1, col 1 → (0, 2.625, 0) + right * -1 + down * -1.
    expect(instancePosition(faceMesh(view, 'top'), 6)).toEqual([-1, TILE_DISTANCE, -1]);
    expect(instanceAxis(faceMesh(view, 'top'), 6, 0)).toEqual([0, 0, 0]);
    expect(view.isMiniCubeHidden('top:1:1')).toBe(true);
    expect(view.isMiniCubeHidden('top:1:2')).toBe(false);
    expect(view.isMiniCubeHidden('front:0:0')).toBe(false);
    expect(instanceAxis(faceMesh(view, 'front'), 0, 0)).toEqual([TILE_SIZE_F32, 0, 0]);
    expect(instanceAxis(faceMesh(view, 'top'), 7, 0)).toEqual([TILE_SIZE_F32, 0, 0]);
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
  });
});

describe('highlightCursor', () => {
  it('moves the accent highlight onto the pinned cell and clears it again', () => {
    const view = createCubeView(STYLE);

    expect(view.highlight.visible).toBe(false);

    view.highlightCursor({ faceId: 'front', row: 2, col: 2 });

    expect(view.highlight.visible).toBe(true);
    expect(view.highlight.position.toArray()).toEqual([0, 0, TILE_DISTANCE]);
    expect(view.highlight.scale.toArray()).toEqual([
      TILE_SIZE + CURSOR_PADDING,
      TILE_SIZE + CURSOR_PADDING,
      MINI_CUBE_THICKNESS * CURSOR_THICKNESS_FACTOR,
    ]);
    expect(view.highlight.scale.toArray()).toEqual([0.9625, 0.9625, 0.375]);
    expect(highlightAxis(view, 0).toArray()).toEqual([1, 0, 0]);
    expect(highlightAxis(view, 1).toArray()).toEqual([0, 1, 0]);
    expect(highlightAxis(view, 2).toArray()).toEqual([0, 0, 1]);

    view.highlightCursor({ faceId: 'top', row: 4, col: 0 });

    expect(view.highlight.position.toArray()).toEqual([-2, TILE_DISTANCE, 2]);
    expect(highlightAxis(view, 2).dot(new Vector3(0, 1, 0))).toBe(1);
    expect(highlightAxis(view, 0).dot(new Vector3(1, 0, 0))).toBe(1);
    expect(highlightAxis(view, 1).dot(new Vector3(0, 0, -1))).toBe(1);

    view.highlightCursor(null);

    expect(view.highlight.visible).toBe(false);
    // The highlight keeps its last placement while hidden.
    expect(view.highlight.position.toArray()).toEqual([-2, TILE_DISTANCE, 2]);
  });

  it('orients the highlight on every face (right, up, normal)', () => {
    const view = createCubeView(STYLE);

    for (const { faceId, right, up, normal } of PINNED_AXES) {
      view.highlightCursor({ faceId, row: 0, col: 0 });

      expect(view.highlight.visible).toBe(true);
      expect(highlightAxis(view, 0).dot(new Vector3(...right))).toBe(1);
      expect(highlightAxis(view, 1).dot(new Vector3(...up))).toBe(1);
      expect(highlightAxis(view, 2).dot(new Vector3(...normal))).toBe(1);
    }

    view.highlightCursor(null);
    expect(view.highlight.visible).toBe(false);
  });

  it('stays hidden for a face that is already removed', () => {
    const view = createCubeView(STYLE);

    view.highlightCursor({ faceId: 'bottom', row: 0, col: 0 });
    expect(view.highlight.visible).toBe(true);

    view.removeFace('bottom');
    view.highlightCursor({ faceId: 'bottom', row: 0, col: 0 });

    expect(view.highlight.visible).toBe(false);
  });

  it('rejects a cursor outside the grid', () => {
    const view = createCubeView(STYLE);

    expect(() => view.highlightCursor({ faceId: 'front', row: 5, col: 0 })).toThrow(
      RangeError('mini-cube "front:5:0" is outside the 5x5 grid'),
    );
    expect(() => view.highlightCursor({ faceId: 'front', row: -1, col: 4 })).toThrow(
      RangeError('mini-cube "front:-1:4" is outside the 5x5 grid'),
    );
    expect(() => view.highlightCursor({ faceId: 'front', row: 0.5, col: 0 })).toThrow(
      RangeError('mini-cube "front:0.5:0" is outside the 5x5 grid'),
    );
    expect(() => view.highlightCursor({ faceId: 'front', row: 0, col: Number.NaN })).toThrow(
      RangeError('mini-cube "front:0:NaN" is outside the 5x5 grid'),
    );
    expect(view.highlight.visible).toBe(false);
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
    expect(view.group.children).toHaveLength(12);
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
    expect(view.group.children).toHaveLength(12);
  });

  it('leaves the remaining faces hittable', () => {
    const view = createCubeView(STYLE);

    view.removeFace('front');
    view.hideMiniCube('back:0:0');

    expect(instancePosition(faceMesh(view, 'back'), 0)).toEqual([2, 2, -TILE_DISTANCE]);
    expect(instanceAxis(faceMesh(view, 'back'), 0, 0)).toEqual([0, 0, 0]);
    expect(view.isMiniCubeHidden('back:0:0')).toBe(true);
  });
});

describe('applyStyle', () => {
  it('re-colours the existing materials in place', () => {
    const view = createCubeView(CUBE_STYLES[0]!);
    const mesh = faceMesh(view, 'front');
    const body = view.body.material as MeshStandardMaterial;
    const highlight = view.highlight.material as MeshBasicMaterial;

    view.applyStyle(CUBE_STYLES[3]!);

    expect(CUBE_STYLES[3]!.id).toBe('solar-gold');
    expect(body.color.getHexString()).toBe('2a1a05');
    expect(body.metalness).toBe(0.9);
    expect(body.roughness).toBe(0.25);
    expect(tileMaterial(view, 'front').color.getHexString()).toBe('ffcc66');
    expect(tileMaterial(view, 'front').metalness).toBe(0.9);
    expect(tileMaterial(view, 'front').roughness).toBe(0.25);
    expect(plateMaterial(view, 'top').color.getHexString()).toBe('2a1a05');
    expect(highlight.color.getHexString()).toBe('ffe9b3');
    // In place: same mesh, same instance count, nothing rebuilt.
    expect(faceMesh(view, 'front')).toBe(mesh);
    expect(mesh.count).toBe(25);
    expect(view.group.children).toHaveLength(14);
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

    expect(geometryDisposers).toHaveLength(14);
    expect(materialDisposers).toHaveLength(14);

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
