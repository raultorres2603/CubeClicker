/**
 * Picking tests (spec § Testing strategy: render-layer modules are exercised against real
 * three.js objects in the node environment, no mocks).
 *
 * Every case builds a real `cube-view` plus a real `PerspectiveCamera` and casts one
 * concrete NDC position; the assertion is always the exact id or the exact `null`, so a
 * dropped front-face gate, a transposed instance decode, a wrong grid size or a pick that
 * ignores the hidden-instance rule fails the test.
 *
 * The NDC literals come from the fixture camera: fov 50, square viewport, at the rest
 * position `(0, 0, 12)` looking at the origin — 9.375 world units in front of the front
 * tile plane (`12 - 2.625`). There, one world unit spans `1 / (9.375 * tan 25°) =
 * 0.2287474…` NDC. The tiles are inset (`MINI_CUBE_TILE_RATIO = 0.95`, spec AC-1): on an
 * N × N grid each tile is `0.95 × 5 / N` world units wide, so adjacent tiles are separated
 * by a seam `0.05 × 5 / N` wide — a tap that lands in that seam is a miss.
 */

import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';

import { CUBE_STYLES } from '../game/progression';
import { createCubeView } from './cube-view';
import { pickMiniCube } from './picking';

const STYLE = CUBE_STYLES[0]!;

/**
 * The picking camera. Note that neither the camera nor the cube group is given a
 * `updateMatrixWorld` call here: `pickMiniCube` refreshes both ends of the ray itself, so a
 * tap dispatched before the next frame is picked against the current transform.
 */
function createCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 0, 12);
  camera.lookAt(0, 0, 0);
  return camera;
}

describe('pickMiniCube', () => {
  it('resolves the mini-cube under the viewport centre', () => {
    const camera = createCamera();
    const view = createCubeView(STYLE);

    // NDC (0, 0) is the front face's centre tile: row 2, col 2 → instance 12.
    expect(pickMiniCube(camera, view, 'front', 0, 0)).toBe('front:2:2');
  });

  it('decodes the instance index into the face row and col of the id', () => {
    const camera = createCamera();
    const view = createCubeView(STYLE);

    // World (-2, 2), (2, 2), (-2, -2) and (2, -2) are the four front-face corners; the two
    // off-diagonal cells would decode to the mirrored id if row and col were transposed.
    expect(pickMiniCube(camera, view, 'front', -0.4575, 0.4575)).toBe('front:0:0');
    expect(pickMiniCube(camera, view, 'front', 0.4575, 0.4575)).toBe('front:0:4');
    expect(pickMiniCube(camera, view, 'front', -0.4575, -0.4575)).toBe('front:4:0');
    expect(pickMiniCube(camera, view, 'front', 0.4575, -0.4575)).toBe('front:4:4');
    expect(pickMiniCube(camera, view, 'front', 0.22875, 0.22875)).toBe('front:1:3');
    expect(pickMiniCube(camera, view, 'front', -0.22875, -0.22875)).toBe('front:3:1');
  });

  it('misses in the seam between two tiles and still hits just inside their edges (N = 5)', () => {
    const camera = createCamera();
    const view = createCubeView(STYLE);

    // The tiles are inset to 0.95 of their cell, so the former shared boundary at world
    // x = 0.5 is now a 0.05-wide seam: the seam midpoint projects to NDC 0.114374 on the
    // tile plane, and the tiles' 0.25 depth keeps the miss window at (0.110123, 0.118512)
    // (the pick ray converges towards the face), so 0.1144 and 0.118 both miss.
    expect(pickMiniCube(camera, view, 'front', 0.1144, 0)).toBeNull();
    expect(pickMiniCube(camera, view, 'front', 0.118, 0)).toBeNull();

    // Same on the row axis: NDC 0.1144 and 0.118 land in the row seam between row 2 and
    // row 1.
    expect(pickMiniCube(camera, view, 'front', 0, 0.1144)).toBeNull();
    expect(pickMiniCube(camera, view, 'front', 0, 0.118)).toBeNull();

    // Inset tiles still resolve just inside their edges: world x = 0.45 → col 2,
    // world x = 0.55 → col 3 (0.2287474… NDC per world unit on the tile plane).
    expect(pickMiniCube(camera, view, 'front', 0.10294, 0)).toBe('front:2:2');
    expect(pickMiniCube(camera, view, 'front', 0.12581, 0)).toBe('front:2:3');
  });

  it('misses at the N = 3 and N = 7 seam midpoints and hits just inside the tiles', () => {
    const camera = createCamera();

    // N = 3: cell 5/3, so the seam between the centre tile and col 2 spans
    // (0.79167, 0.875) and its midpoint is world x = 5/6 = 0.190623 NDC. World x = 0.75
    // is inside the centre tile (0.171561) and world x = 0.90 inside col 2 (0.205873).
    const three = createCubeView(STYLE, 3);
    expect(pickMiniCube(camera, three, 'front', 0.190623, 0)).toBeNull();
    expect(pickMiniCube(camera, three, 'front', 0.171561, 0)).toBe('front:1:1');
    expect(pickMiniCube(camera, three, 'front', 0.205873, 0)).toBe('front:1:2');

    // N = 7: cell 5/7, so the seam between col 3 and col 4 spans (0.33929, 0.375) and its
    // midpoint is world x = 5/14 = 0.081696 NDC. World x = 0.30 is inside col 3 (0.068624)
    // and world x = 0.40 inside col 4 (0.091499).
    const seven = createCubeView(STYLE, 7);
    expect(pickMiniCube(camera, seven, 'front', 0.081696, 0)).toBeNull();
    expect(pickMiniCube(camera, seven, 'front', 0.068624, 0)).toBe('front:3:3');
    expect(pickMiniCube(camera, seven, 'front', 0.091499, 0)).toBe('front:3:4');
  });

  it('returns null when the ray misses the cube', () => {
    const camera = createCamera();
    const view = createCubeView(STYLE);

    // The face spans ±2.5 world units = ±0.5719 NDC; ±0.9 is outside its silhouette.
    expect(pickMiniCube(camera, view, 'front', 0.9, 0.9)).toBeNull();
    expect(pickMiniCube(camera, view, 'front', -0.9, -0.9)).toBeNull();
    expect(pickMiniCube(camera, view, 'front', 0, 1)).toBeNull();
  });

  it('ignores a hit on a face that is not the given front face', () => {
    const camera = createCamera();
    const view = createCubeView(STYLE);

    // A yaw step of +90° turns the cube so that the left face — not the front face — points
    // at the camera: the centre ray now reaches the left face's centre tile only.
    view.group.rotation.y = Math.PI / 2;

    expect(pickMiniCube(camera, view, 'front', 0, 0)).toBeNull();
    expect(pickMiniCube(camera, view, 'left', 0, 0)).toBe('left:2:2');
  });

  it('returns null for a hidden mini-cube and keeps its neighbours pickable', () => {
    const camera = createCamera();
    const view = createCubeView(STYLE);

    view.hideMiniCube('front:2:2');

    expect(pickMiniCube(camera, view, 'front', 0, 0)).toBeNull();
    expect(pickMiniCube(camera, view, 'front', 0.22875, 0)).toBe('front:2:3');
  });

  it('returns null while a mini-cube is still playing its pop', () => {
    const camera = createCamera();
    const view = createCubeView(STYLE);

    // At t = 0 the tile is still full size, but the intent already marked it hidden:
    // a second tap on the animating tile can never double-fire (spec AC-4).
    view.hideMiniCube('front:2:2');
    view.update(50);

    expect(pickMiniCube(camera, view, 'front', 0, 0)).toBeNull();
    expect(pickMiniCube(camera, view, 'front', 0.22875, 0)).toBe('front:2:3');
  });

  it('returns null once the front face has been removed', () => {
    const camera = createCamera();
    const view = createCubeView(STYLE);

    view.removeFace('front');

    expect(pickMiniCube(camera, view, 'front', 0, 0)).toBeNull();
  });

  it('decodes a 3 × 3 grid from its own instance count', () => {
    const camera = createCamera();

    // cell = 5/3: tile centres at ±5/3 = ±0.381245 NDC on each axis. Decoding instance 8
    // with the default grid size would yield row 1, col 3 instead of row 2, col 2.
    const three = createCubeView(STYLE, 3);
    expect(pickMiniCube(camera, three, 'front', 0, 0)).toBe('front:1:1');
    expect(pickMiniCube(camera, three, 'front', -0.38125, 0.38125)).toBe('front:0:0');
    expect(pickMiniCube(camera, three, 'front', 0.38125, 0.38125)).toBe('front:0:2');
    expect(pickMiniCube(camera, three, 'front', -0.38125, -0.38125)).toBe('front:2:0');
    expect(pickMiniCube(camera, three, 'front', 0.38125, -0.38125)).toBe('front:2:2');
  });

  it('decodes a 7 × 7 grid from its own instance count', () => {
    const camera = createCamera();

    // cell = 5/7: tile centres at ±15/7 (0.490173 NDC), ±10/7 (0.326782 NDC) and ±5/7
    // (0.163391 NDC). The expected ids are the exact instance decode `row * 7 + col`.
    const seven = createCubeView(STYLE, 7);
    expect(pickMiniCube(camera, seven, 'front', 0, 0)).toBe('front:3:3');
    expect(pickMiniCube(camera, seven, 'front', -0.49, 0.49)).toBe('front:0:0');
    expect(pickMiniCube(camera, seven, 'front', 0.49, -0.49)).toBe('front:6:6');
    expect(pickMiniCube(camera, seven, 'front', 0.3268, 0.3268)).toBe('front:1:5');

    // A hidden tile inside the 7 × 7 grid is unpickable; its neighbour is still pickable.
    seven.hideMiniCube('front:3:3');
    expect(pickMiniCube(camera, seven, 'front', 0, 0)).toBeNull();
    expect(pickMiniCube(camera, seven, 'front', 0.1634, 0)).toBe('front:3:4');
  });

  it('decodes a 1 × 1 grid: the single inset tile spans 95% of the face', () => {
    const camera = createCamera();
    const one = createCubeView(STYLE, 1);

    expect(pickMiniCube(camera, one, 'front', 0, 0)).toBe('front:0:0');
    // The inset tile spans ±2.375 world units (±0.5433 NDC), so the (0.5, 0.5) fixture
    // stays inside it while the half-seam rim around the face is a miss.
    expect(pickMiniCube(camera, one, 'front', 0.5, 0.5)).toBe('front:0:0');
  });
});
